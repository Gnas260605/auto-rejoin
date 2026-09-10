#!/usr/bin/env bash

ROBLOX_LINK_TYPE=""
ROBLOX_PARSED_PLACE_ID=""
ROBLOX_PARSED_PRIVATE_CODE=""
ROBLOX_PARSED_URI=""
ROBLOX_PARSE_ERROR=""

roblox_reset_parse_result() {
    ROBLOX_LINK_TYPE=""
    ROBLOX_PARSED_PLACE_ID=""
    ROBLOX_PARSED_PRIVATE_CODE=""
    ROBLOX_PARSED_URI=""
    ROBLOX_PARSE_ERROR=""
}

roblox_parse_fail() {
    ROBLOX_PARSE_ERROR="$1"
    return 1
}

roblox_trim() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

roblox_validate_place_id() {
    local place_id="$1"
    [[ "$place_id" =~ ^[0-9]+$ ]] || return 1
    [ "$place_id" -gt 0 ] || return 1
}

roblox_validate_private_code() {
    local code="$1"
    [[ "$code" =~ ^[A-Za-z0-9_-]+$ ]]
}

roblox_percent_decode() {
    local value="$1"
    local out="" i=0 len ch hex

    value="${value//+/ }"
    len="${#value}"
    while [ "$i" -lt "$len" ]; do
        ch="${value:$i:1}"
        if [ "$ch" = "%" ]; then
            if [ $((i + 2)) -ge "$len" ]; then
                return 1
            fi
            hex="${value:$((i + 1)):2}"
            [[ "$hex" =~ ^[0-9A-Fa-f]{2}$ ]] || return 1
            out="${out}$(printf '%b' "\\x${hex}")"
            i=$((i + 3))
        else
            out="${out}${ch}"
            i=$((i + 1))
        fi
    done
    printf '%s' "$out"
}

roblox_url_scheme() {
    local input="$1"
    case "$input" in
        *://*) printf '%s\n' "${input%%://*}" ;;
        *:*) printf '%s\n' "${input%%:*}" ;;
        *) return 1 ;;
    esac
}

roblox_url_host() {
    local rest="${1#*://}"
    rest="${rest%%/*}"
    rest="${rest%%\?*}"
    rest="${rest%%#*}"
    printf '%s\n' "$rest" | tr '[:upper:]' '[:lower:]'
}

roblox_validate_web_host() {
    local host="$1"
    [ "$host" = "roblox.com" ] || [ "$host" = "www.roblox.com" ]
}

roblox_query_param() {
    local query="$1"
    local wanted="$2"
    local pair key value decoded

    query="${query%%#*}"
    IFS='&' read -r -a pairs <<< "$query"
    for pair in "${pairs[@]}"; do
        key="${pair%%=*}"
        value=""
        [ "$pair" != "$key" ] && value="${pair#*=}"
        decoded="$(roblox_percent_decode "$key")" || return 2
        if [ "$decoded" = "$wanted" ]; then
            roblox_percent_decode "$value" || return 2
            return 0
        fi
    done
    return 1
}

roblox_validate_job_id() {
    local job_id="$1"
    [[ "$job_id" =~ ^[A-Za-z0-9_-]{10,64}$ ]]
}

roblox_build_game_uri() {
    local place_id="$1"
    local job_id="${2:-}"
    roblox_validate_place_id "$place_id" || return 1
    if [ -n "$job_id" ]; then
        roblox_validate_job_id "$job_id" || return 1
        printf 'roblox://experiences/start?placeId=%s&gameInstanceId=%s&launchData=placeId%%3D%s\n' "$place_id" "$job_id" "$place_id"
    else
        printf 'roblox://experiences/start?placeId=%s&launchData=placeId%%3D%s\n' "$place_id" "$place_id"
    fi
}

roblox_fetch_public_servers() {
    local place_id="$1"
    local limit="${2:-100}"
    roblox_validate_place_id "$place_id" || return 1
    local url="https://games.roblox.com/v1/games/${place_id}/servers/Public?sortOrder=Asc&limit=${limit}&excludeFullGames=true"
    if command -v curl >/dev/null 2>&1; then
        curl -sSL --connect-timeout 6 --max-time 12 "$url" 2>/dev/null
    else
        return 1
    fi
}

roblox_pick_low_server() {
    local place_id="$1"
    local slot_index="${2:-0}"
    local min_players="${3:-1}"
    local max_players="${4:-0}"

    local json_out
    json_out="$(roblox_fetch_public_servers "$place_id" 100)" || return 1
    [ -n "$json_out" ] || return 1

    local servers=""
    if command -v jq >/dev/null 2>&1; then
        servers="$(printf '%s' "$json_out" | jq -r \
            --argjson min "$min_players" \
            --argjson max "$max_players" '
            [ (.data // [])[]
              | select(.id != null and .playing != null and .maxPlayers != null)
              | select(.playing < .maxPlayers)
              | select($min <= 0 or .playing >= $min)
              | select($max <= 0 or .playing <= $max)
            ]
            | sort_by([.playing, (.ping // 999)])
            | .[]
            | [ .id, (.playing | tostring), (.maxPlayers | tostring) ]
            | join("|")
        ' 2>/dev/null || true)"
    elif python3 -c "import sys" >/dev/null 2>&1 || python -c "import sys" >/dev/null 2>&1; then
        local py_bin="python3"
        python3 -c "import sys" >/dev/null 2>&1 || py_bin="python"
        servers="$(printf '%s' "$json_out" | "$py_bin" -c '
import sys, json
try:
    data = json.load(sys.stdin)
    items = data.get("data", [])
    min_p = int(sys.argv[1])
    max_p = int(sys.argv[2])
    valid = []
    for it in items:
        jid = it.get("id")
        pl = it.get("playing")
        mx = it.get("maxPlayers")
        png = it.get("ping", 999) or 999
        if not jid or pl is None or mx is None:
            continue
        if pl >= mx:
            continue
        if min_p > 0 and pl < min_p:
            continue
        if max_p > 0 and pl > max_p:
            continue
        valid.append((pl, png, str(jid), mx))
    valid.sort(key=lambda x: (x[0], x[1]))
    for pl, png, jid, mx in valid:
        print(f"{jid}|{pl}|{mx}")
except Exception:
    pass
' "$min_players" "$max_players" 2>/dev/null || true)"
    elif command -v node >/dev/null 2>&1; then
        servers="$(printf '%s' "$json_out" | node -e '
let input = "";
process.stdin.on("data", c => input += c);
process.stdin.on("end", () => {
    try {
        const data = JSON.parse(input);
        const minP = parseInt(process.argv[1] || "1", 10);
        const maxP = parseInt(process.argv[2] || "0", 10);
        const items = (data.data || []).filter(s => {
            if (!s.id || s.playing === undefined || s.maxPlayers === undefined) return false;
            if (s.playing >= s.maxPlayers) return false;
            if (minP > 0 && s.playing < minP) return false;
            if (maxP > 0 && s.playing > maxP) return false;
            return true;
        });
        items.sort((a, b) => (a.playing - b.playing) || ((a.ping || 999) - (b.ping || 999)));
        for (const it of items) {
            console.log(`${it.id}|${it.playing}|${it.maxPlayers}`);
        }
    } catch (e) {}
});
' "$min_players" "$max_players" 2>/dev/null || true)"
    else
        return 1
    fi

    [ -n "$servers" ] || return 1

    local count
    count=$(printf '%s\n' "$servers" | sed '/^$/d' | wc -l | tr -d ' ')
    [ "$count" -gt 0 ] || return 1

    local target_line=$(( (slot_index % count) + 1 ))
    local selected
    selected="$(printf '%s\n' "$servers" | sed -n "${target_line}p")"
    [ -n "$selected" ] || return 1

    printf '%s\n' "$selected"
}

roblox_build_private_server_uri() {
    local code="$1"
    roblox_validate_private_code "$code" || return 1
    printf 'roblox://navigation/share_links?code=%s&type=Server\n' "$code"
}

roblox_parse_game_url() {
    local input="$1"
    local host path place_id

    host="$(roblox_url_host "$input")"
    roblox_validate_web_host "$host" || return 1
    path="${input#*://$host}"
    path="/${path#/}"
    path="${path%%\?*}"
    path="${path%%#*}"
    case "$path" in
        /games/[0-9]*|/games/[0-9]*/*)
            place_id="${path#/games/}"
            place_id="${place_id%%/*}"
            roblox_validate_place_id "$place_id" || return 1
            ROBLOX_LINK_TYPE="game"
            ROBLOX_PARSED_PLACE_ID="$place_id"
            ROBLOX_PARSED_PRIVATE_CODE=""
            ROBLOX_PARSED_URI="$(roblox_build_game_uri "$place_id")"
            return 0
            ;;
    esac
    return 1
}

roblox_parse_private_server_url() {
    local input="$1"
    local host path query code type

    host="$(roblox_url_host "$input")"
    roblox_validate_web_host "$host" || return 1
    path="${input#*://$host}"
    path="/${path#/}"
    query=""
    case "$path" in
        /share\?*) query="${path#*\?}" ;;
        *) return 1 ;;
    esac

    code="$(roblox_query_param "$query" "code")" || return 1
    type="$(roblox_query_param "$query" "type")" || return 1
    [ "$type" = "Server" ] || return 1
    roblox_validate_private_code "$code" || return 1

    ROBLOX_LINK_TYPE="private_server"
    ROBLOX_PARSED_PLACE_ID=""
    ROBLOX_PARSED_PRIVATE_CODE="$code"
    ROBLOX_PARSED_URI="$(roblox_build_private_server_uri "$code")"
    return 0
}

roblox_parse_uri() {
    local input="$1"
    local rest path query place_id code type

    case "$input" in
        roblox://experiences/start\?*) ;;
        roblox://navigation/share_links\?*) ;;
        *) return 1 ;;
    esac

    rest="${input#roblox://}"
    path="${rest%%\?*}"
    query="${rest#*\?}"
    case "$path" in
        experiences/start)
            place_id="$(roblox_query_param "$query" "placeId")" || return 1
            roblox_validate_place_id "$place_id" || return 1
            local job_id
            job_id="$(roblox_query_param "$query" "gameInstanceId" 2>/dev/null || true)"
            if [ -n "$job_id" ] && ! roblox_validate_job_id "$job_id"; then
                job_id=""
            fi
            ROBLOX_LINK_TYPE="game"
            ROBLOX_PARSED_PLACE_ID="$place_id"
            ROBLOX_PARSED_PRIVATE_CODE=""
            ROBLOX_PARSED_URI="$(roblox_build_game_uri "$place_id" "$job_id")"
            ;;
        navigation/share_links)
            code="$(roblox_query_param "$query" "code")" || return 1
            type="$(roblox_query_param "$query" "type")" || return 1
            [ "$type" = "Server" ] || return 1
            roblox_validate_private_code "$code" || return 1
            ROBLOX_LINK_TYPE="private_server"
            ROBLOX_PARSED_PLACE_ID=""
            ROBLOX_PARSED_PRIVATE_CODE="$code"
            ROBLOX_PARSED_URI="$(roblox_build_private_server_uri "$code")"
            ;;
        *)
            return 1
            ;;
    esac
}

roblox_detect_link_type() {
    local input
    input="$(roblox_trim "$1")"

    if [[ "$input" =~ ^[0-9]+$ ]] && roblox_validate_place_id "$input"; then
        printf 'game\n'
        return 0
    fi
    case "$input" in
        roblox://experiences/start\?*) printf 'game\n'; return 0 ;;
        roblox://navigation/share_links\?*) printf 'private_server\n'; return 0 ;;
        https://roblox.com/games/*|https://www.roblox.com/games/*) printf 'game\n'; return 0 ;;
        https://roblox.com/share\?*|https://www.roblox.com/share\?*) printf 'private_server\n'; return 0 ;;
    esac
    return 1
}

roblox_parse_link() {
    local input scheme

    roblox_reset_parse_result
    input="$(roblox_trim "$1")"
    [ -n "$input" ] || roblox_parse_fail "empty input" || return 1

    if [[ "$input" =~ ^[0-9]+$ ]]; then
        roblox_validate_place_id "$input" || roblox_parse_fail "invalid place id" || return 1
        ROBLOX_LINK_TYPE="game"
        ROBLOX_PARSED_PLACE_ID="$input"
        ROBLOX_PARSED_PRIVATE_CODE=""
        ROBLOX_PARSED_URI="$(roblox_build_game_uri "$input")"
        return 0
    fi

    scheme="$(roblox_url_scheme "$input")" || roblox_parse_fail "missing URL scheme" || return 1
    case "$scheme" in
        https)
            roblox_parse_game_url "$input" && return 0
            roblox_parse_private_server_url "$input" && return 0
            roblox_parse_fail "unsupported Roblox web URL"
            ;;
        roblox)
            roblox_parse_uri "$input" && return 0
            roblox_parse_fail "unsupported Roblox URI"
            ;;
        *)
            roblox_parse_fail "unsupported URL scheme"
            ;;
    esac
}

roblox_print_parse_env() {
    printf 'TYPE=%s\n' "$ROBLOX_LINK_TYPE"
    printf 'PLACE_ID=%s\n' "$ROBLOX_PARSED_PLACE_ID"
    printf 'PRIVATE_CODE=%s\n' "$ROBLOX_PARSED_PRIVATE_CODE"
    printf 'URI=%s\n' "$ROBLOX_PARSED_URI"
}
