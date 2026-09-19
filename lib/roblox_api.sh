#!/usr/bin/env bash

# ══════════════════════════════════════════════════════════
#  lib/roblox_api.sh — Roblox Public API Layer
#  Handles HTTP transport, caching, circuit breakers, rate limits,
#  and public Roblox API endpoints for Auto Rejoin Pro V2.
# ══════════════════════════════════════════════════════════

ROBLOX_API_ENABLED="${ROBLOX_API_ENABLED:-true}"
ROBLOX_API_CONNECT_TIMEOUT="${ROBLOX_API_CONNECT_TIMEOUT:-4}"
ROBLOX_API_MAX_TIME="${ROBLOX_API_MAX_TIME:-8}"
ROBLOX_API_CACHE_ENABLED="${ROBLOX_API_CACHE_ENABLED:-true}"
ROBLOX_API_CACHE_DIR="${ROBLOX_API_CACHE_DIR:-${TMP_DIR:-/tmp}/api-cache}"
ROBLOX_API_BREAKER_LIMIT="${ROBLOX_API_BREAKER_LIMIT:-3}"
ROBLOX_API_BREAKER_COOLDOWN="${ROBLOX_API_BREAKER_COOLDOWN:-60}"
ROBLOX_API_MOCK_HANDLER="${ROBLOX_API_MOCK_HANDLER:-}"
ROBLOX_API_TEST_BASE="${ROBLOX_API_TEST_BASE:-}"

# Error Codes
API_OK=0
API_ERR_GENERIC=1
API_ERR_INVALID_ARG=2
API_ERR_TIMEOUT=3
API_ERR_RATE_LIMIT=4
API_ERR_BREAKER_OPEN=5
API_ERR_SCHEMA=6

roblox_api_now() {
    if [ -n "${ROBLOX_API_NOW:-}" ]; then
        printf '%s\n' "$ROBLOX_API_NOW"
    else
        date +%s
    fi
}

roblox_api_json_extract() {
    local json="$1"
    local expr="$2"

    [ -n "$json" ] || return 1

    if command -v jq >/dev/null 2>&1; then
        printf '%s' "$json" | jq -r "${expr}" 2>/dev/null
    elif python3 -c "import sys" >/dev/null 2>&1; then
        printf '%s' "$json" | python3 -c '
import sys, json

expr = sys.argv[1]
try:
    data = json.load(sys.stdin)
except Exception:
    sys.exit(1)

def resolve(d, path):
    if not path or path == ".":
        return d
    if " | length" in path:
        base_path = path.replace(" | length", "").strip()
        val = resolve(d, base_path)
        return len(val) if isinstance(val, (list, dict, str)) else 0
    parts = [p for p in path.strip(".").split(".") if p]
    cur = d
    for p in parts:
        if isinstance(cur, dict):
            cur = cur.get(p)
        elif isinstance(cur, list) and p.isdigit():
            cur = cur[int(p)]
        else:
            return None
    return cur

res = resolve(data, expr)
if res is not None:
    if isinstance(res, bool):
        print("true" if res else "false")
    elif isinstance(res, (dict, list)):
        print(json.dumps(res))
    else:
        print(res)
else:
    print("null")
' "$expr" 2>/dev/null
    elif command -v node >/dev/null 2>&1; then
        printf '%s' "$json" | node -e '
let input = "";
const expr = process.argv[1];
process.stdin.on("data", c => input += c);
process.stdin.on("end", () => {
    try {
        const data = JSON.parse(input);
        if (expr.includes(" | length")) {
            const basePath = expr.replace(" | length", "").trim().replace(/^\./, "");
            const parts = basePath ? basePath.split(".") : [];
            let cur = data;
            for (const p of parts) { if (cur) cur = cur[p]; }
            console.log(cur ? cur.length : 0);
            return;
        }
        const parts = expr.replace(/^\./, "").split(".").filter(Boolean);
        let cur = data;
        for (const p of parts) { if (cur !== undefined && cur !== null) cur = cur[p]; }
        if (cur === undefined || cur === null) {
            console.log("null");
        } else if (typeof cur === "object") {
            console.log(JSON.stringify(cur));
        } else {
            console.log(cur);
        }
    } catch(e) { process.exit(1); }
});
' "$expr" 2>/dev/null
    else
        return 1
    fi
}

# ══════════════════════════════════════════════════════════
#  Circuit Breaker Manager
# ══════════════════════════════════════════════════════════

roblox_api_breaker_file() {
    local provider="${1:-default}"
    local safe_provider="${provider//[^A-Za-z0-9_-]/_}"
    printf '%s/roblox_breaker_%s.dat' "${TMP_DIR:-/tmp}" "$safe_provider"
}

roblox_api_is_available() {
    local provider="${1:-default}"
    local bfile
    bfile="$(roblox_api_breaker_file "$provider")"
    [ -f "$bfile" ] || return 0

    local fails=0 disabled_until=0 now
    now="$(roblox_api_now)"
    if [ -r "$bfile" ]; then
        # Format: fails=N disabled_until=TIMESTAMP
        fails=$(grep '^fails=' "$bfile" 2>/dev/null | cut -d'=' -f2)
        disabled_until=$(grep '^disabled_until=' "$bfile" 2>/dev/null | cut -d'=' -f2)
    fi

    fails="${fails:-0}"
    disabled_until="${disabled_until:-0}"

    if [ "$disabled_until" -gt 0 ]; then
        if [ "$now" -lt "$disabled_until" ]; then
            return 1
        fi
        # Cooldown expired, allow single probe
        return 0
    fi

    return 0
}

roblox_api_record_success() {
    local provider="${1:-default}"
    local bfile
    bfile="$(roblox_api_breaker_file "$provider")"
    rm -f "$bfile" 2>/dev/null || true
}

roblox_api_record_failure() {
    local provider="${1:-default}"
    local status_code="${2:-0}"
    local bfile
    bfile="$(roblox_api_breaker_file "$provider")"

    local fails=0 disabled_until=0 now
    now="$(roblox_api_now)"
    if [ -f "$bfile" ]; then
        fails=$(grep '^fails=' "$bfile" 2>/dev/null | cut -d'=' -f2)
    fi
    fails=$(( ${fails:-0} + 1 ))

    # HTTP 429 immediately trips the breaker
    if [ "$status_code" = "429" ] || [ "$fails" -ge "$ROBLOX_API_BREAKER_LIMIT" ]; then
        disabled_until=$(( now + ROBLOX_API_BREAKER_COOLDOWN ))
    fi

    {
        printf 'fails=%s\n' "$fails"
        printf 'disabled_until=%s\n' "$disabled_until"
        printf 'last_status=%s\n' "$status_code"
        printf 'updated_at=%s\n' "$now"
    } > "$bfile" 2>/dev/null || true
}

roblox_api_reset_breaker() {
    local provider="${1:-}"
    if [ -n "$provider" ]; then
        rm -f "$(roblox_api_breaker_file "$provider")" 2>/dev/null || true
    else
        rm -f "${TMP_DIR:-/tmp}"/roblox_breaker_*.dat 2>/dev/null || true
    fi
}

# ══════════════════════════════════════════════════════════
#  Cache Management Layer
# ══════════════════════════════════════════════════════════

roblox_api_cache_file() {
    local key="$1"
    local safe_key="${key//[^A-Za-z0-9_.-]/_}"
    printf '%s/%s.json' "$ROBLOX_API_CACHE_DIR" "$safe_key"
}

roblox_api_cache_get() {
    [ "$ROBLOX_API_CACHE_ENABLED" = "true" ] || return 1
    local key="$1"
    local allow_stale="${2:-false}"
    local cfile
    cfile="$(roblox_api_cache_file "$key")"
    [ -f "$cfile" ] || return 1

    local now expiresAt status
    now="$(roblox_api_now)"

    # Fast extract expiresAt using awk or sed to avoid parsing overhead
    expiresAt="$(grep -oE '"expiresAt":[ ]*[0-9]+' "$cfile" 2>/dev/null | grep -oE '[0-9]+' || echo 0)"
    if [ "$allow_stale" != "true" ] && [ "${expiresAt:-0}" -le "$now" ]; then
        return 1
    fi

    # Return data payload
    if command -v jq >/dev/null 2>&1; then
        jq -r '.data // empty' "$cfile" 2>/dev/null && return 0
    elif python3 -c "import sys" >/dev/null 2>&1; then
        python3 -c '
import sys, json
try:
    d = json.load(open(sys.argv[1]))
    data = d.get("data")
    if data is not None:
        if isinstance(data, (dict, list)):
            print(json.dumps(data))
        else:
            print(data)
except Exception:
    sys.exit(1)
' "$cfile" 2>/dev/null && return 0
    elif command -v node >/dev/null 2>&1; then
        node -e '
const fs = require("fs");
try {
    const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    if (d.data !== undefined) {
        console.log(typeof d.data === "object" ? JSON.stringify(d.data) : d.data);
    } else {
        process.exit(1);
    }
} catch(e) { process.exit(1); }
' "$cfile" 2>/dev/null && return 0
    fi

    return 1
}

roblox_api_cache_set() {
    [ "$ROBLOX_API_CACHE_ENABLED" = "true" ] || return 0
    local key="$1"
    local json_data="$2"
    local ttl="${3:-60}"
    local status="${4:-200}"

    mkdir -p "$ROBLOX_API_CACHE_DIR" 2>/dev/null || true
    local cfile
    cfile="$(roblox_api_cache_file "$key")"

    local now expiresAt
    now="$(roblox_api_now)"
    expiresAt=$(( now + ttl ))

    # Wrap in JSON envelope
    if command -v jq >/dev/null 2>&1; then
        jq -n \
            --argjson cachedAt "$now" \
            --argjson expiresAt "$expiresAt" \
            --argjson status "$status" \
            --arg raw "$json_data" '
            {
                cachedAt: $cachedAt,
                expiresAt: $expiresAt,
                status: $status,
                data: (try ($raw | fromjson) catch $raw)
            }
        ' > "$cfile" 2>/dev/null || true
    elif python3 -c "import sys" >/dev/null 2>&1; then
        python3 -c '
import sys, json
now, exp, st, raw, out = int(sys.argv[1]), int(sys.argv[2]), int(sys.argv[3]), sys.argv[4], sys.argv[5]
try:
    try:
        parsed = json.loads(raw)
    except Exception:
        parsed = raw
    env = {"cachedAt": now, "expiresAt": exp, "status": st, "data": parsed}
    with open(out, "w") as f:
        json.dump(env, f)
except Exception:
    pass
' "$now" "$expiresAt" "$status" "$json_data" "$cfile" 2>/dev/null || true
    elif command -v node >/dev/null 2>&1; then
        node -e '
const fs = require("fs");
const [now, exp, st, raw, out] = [parseInt(process.argv[1],10), parseInt(process.argv[2],10), parseInt(process.argv[3],10), process.argv[4], process.argv[5]];
try {
    let parsed;
    try { parsed = JSON.parse(raw); } catch(e) { parsed = raw; }
    const env = { cachedAt: now, expiresAt: exp, status: st, data: parsed };
    fs.writeFileSync(out, JSON.stringify(env));
} catch(e) {}
' "$now" "$expiresAt" "$status" "$json_data" "$cfile" 2>/dev/null || true
    fi
}

roblox_api_cache_purge_expired() {
    [ -d "$ROBLOX_API_CACHE_DIR" ] || return 0
    local now
    now="$(roblox_api_now)"
    local f exp
    for f in "$ROBLOX_API_CACHE_DIR"/*.json; do
        [ -f "$f" ] || continue
        exp="$(grep -oE '"expiresAt":[ ]*[0-9]+' "$f" 2>/dev/null | grep -oE '[0-9]+' || echo 0)"
        if [ "${exp:-0}" -gt 0 ] && [ "$exp" -lt "$now" ]; then
            rm -f "$f" 2>/dev/null || true
        fi
    done
}

roblox_api_cache_invalidate() {
    local key="$1"
    local cfile
    cfile="$(roblox_api_cache_file "$key")"
    rm -f "$cfile" 2>/dev/null || true
}

# ══════════════════════════════════════════════════════════
#  HTTP Transport Wrappers
# ══════════════════════════════════════════════════════════

roblox_http_get() {
    local url="$1"
    local provider="${2:-default}"
    local connect_timeout="${3:-$ROBLOX_API_CONNECT_TIMEOUT}"
    local max_time="${4:-$ROBLOX_API_MAX_TIME}"

    if [ "$ROBLOX_API_ENABLED" != "true" ]; then
        return "$API_ERR_GENERIC"
    fi

    if ! roblox_api_is_available "$provider"; then
        return "$API_ERR_BREAKER_OPEN"
    fi

    # Support testing mock handler
    if [ -n "$ROBLOX_API_MOCK_HANDLER" ] && declare -F "$ROBLOX_API_MOCK_HANDLER" >/dev/null 2>&1; then
        "$ROBLOX_API_MOCK_HANDLER" "GET" "$url" "$provider"
        return $?
    fi

    # Target test base origin replacement if configured
    if [ -n "$ROBLOX_API_TEST_BASE" ]; then
        url="$(printf '%s' "$url" | sed -E "s#https://[a-z0-9.-]+\.roblox\.com#${ROBLOX_API_TEST_BASE}#g")"
    fi

    local body_file
    body_file="$(mktemp "${TMP_DIR:-/tmp}/roblox_http_XXXXXX")" || return "$API_ERR_GENERIC"

    local http_code
    http_code=$(curl \
        --silent \
        --show-error \
        --location \
        --connect-timeout "$connect_timeout" \
        --max-time "$max_time" \
        --header "Accept: application/json" \
        --header "User-Agent: Auto-Rejoin-Pro/2.0" \
        --write-out "%{http_code}" \
        --output "$body_file" \
        "$url" 2>/dev/null || echo "000")

    local ret=$?
    if [ "$ret" -ne 0 ] || [ "$http_code" = "000" ]; then
        rm -f "$body_file"
        roblox_api_record_failure "$provider" "000"
        return "$API_ERR_TIMEOUT"
    fi

    if [ "$http_code" = "200" ]; then
        cat "$body_file"
        rm -f "$body_file"
        roblox_api_record_success "$provider"
        return "$API_OK"
    elif [ "$http_code" = "429" ]; then
        cat "$body_file" >&2
        rm -f "$body_file"
        roblox_api_record_failure "$provider" "429"
        return "$API_ERR_RATE_LIMIT"
    else
        rm -f "$body_file"
        roblox_api_record_failure "$provider" "$http_code"
        return "$API_ERR_GENERIC"
    fi
}

roblox_http_post_json() {
    local url="$1"
    local json_payload="$2"
    local provider="${3:-default}"
    local connect_timeout="${4:-$ROBLOX_API_CONNECT_TIMEOUT}"
    local max_time="${5:-$ROBLOX_API_MAX_TIME}"

    if [ "$ROBLOX_API_ENABLED" != "true" ]; then
        return "$API_ERR_GENERIC"
    fi

    if ! roblox_api_is_available "$provider"; then
        return "$API_ERR_BREAKER_OPEN"
    fi

    # Support testing mock handler
    if [ -n "$ROBLOX_API_MOCK_HANDLER" ] && declare -F "$ROBLOX_API_MOCK_HANDLER" >/dev/null 2>&1; then
        "$ROBLOX_API_MOCK_HANDLER" "POST" "$url" "$provider" "$json_payload"
        return $?
    fi

    if [ -n "$ROBLOX_API_TEST_BASE" ]; then
        url="$(printf '%s' "$url" | sed -E "s#https://[a-z0-9.-]+\.roblox\.com#${ROBLOX_API_TEST_BASE}#g")"
    fi

    local body_file
    body_file="$(mktemp "${TMP_DIR:-/tmp}/roblox_http_XXXXXX")" || return "$API_ERR_GENERIC"

    local http_code
    http_code=$(curl \
        --silent \
        --show-error \
        --location \
        --connect-timeout "$connect_timeout" \
        --max-time "$max_time" \
        --header "Content-Type: application/json" \
        --header "Accept: application/json" \
        --header "User-Agent: Auto-Rejoin-Pro/2.0" \
        --data-binary "$json_payload" \
        --write-out "%{http_code}" \
        --output "$body_file" \
        "$url" 2>/dev/null || echo "000")

    local ret=$?
    if [ "$ret" -ne 0 ] || [ "$http_code" = "000" ]; then
        rm -f "$body_file"
        roblox_api_record_failure "$provider" "000"
        return "$API_ERR_TIMEOUT"
    fi

    if [ "$http_code" = "200" ]; then
        cat "$body_file"
        rm -f "$body_file"
        roblox_api_record_success "$provider"
        return "$API_OK"
    elif [ "$http_code" = "429" ]; then
        cat "$body_file" >&2
        rm -f "$body_file"
        roblox_api_record_failure "$provider" "429"
        return "$API_ERR_RATE_LIMIT"
    else
        rm -f "$body_file"
        roblox_api_record_failure "$provider" "$http_code"
        return "$API_ERR_GENERIC"
    fi
}

# ══════════════════════════════════════════════════════════
#  Roblox API Endpoints
# ══════════════════════════════════════════════════════════

# 1. Place → Universe
roblox_api_place_to_universe() {
    local place_id="$1"
    [[ "$place_id" =~ ^[0-9]+$ ]] || return "$API_ERR_INVALID_ARG"
    [ "$place_id" -gt 0 ] || return "$API_ERR_INVALID_ARG"

    local cache_key="place_${place_id}_universe"
    local cached
    if cached="$(roblox_api_cache_get "$cache_key")" && [ -n "$cached" ]; then
        printf '%s\n' "$cached"
        return "$API_OK"
    fi

    local url="https://apis.roblox.com/universes/v1/places/${place_id}/universe"
    local raw_json
    raw_json="$(roblox_http_get "$url" "universes")"
    local http_ret=$?
    if [ "$http_ret" -ne 0 ] || [ -z "$raw_json" ]; then
        return "$http_ret"
    fi

    local universe_id=""
    if command -v jq >/dev/null 2>&1; then
        universe_id="$(printf '%s' "$raw_json" | jq -r '.universeId // empty' 2>/dev/null)"
    elif python3 -c "import sys" >/dev/null 2>&1; then
        universe_id="$(printf '%s' "$raw_json" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    uid = d.get("universeId")
    if uid is not None and int(uid) > 0:
        print(uid)
except Exception:
    sys.exit(1)
' 2>/dev/null)"
    elif command -v node >/dev/null 2>&1; then
        universe_id="$(printf '%s' "$raw_json" | node -e '
let input = "";
process.stdin.on("data", c => input += c);
process.stdin.on("end", () => {
    try {
        const d = JSON.parse(input);
        if (d.universeId && parseInt(d.universeId, 10) > 0) {
            console.log(d.universeId);
        }
    } catch(e) {}
});
' 2>/dev/null)"
    fi

    if [[ "$universe_id" =~ ^[0-9]+$ ]] && [ "$universe_id" -gt 0 ]; then
        roblox_api_cache_set "$cache_key" "$universe_id" 86400 "200"
        printf '%s\n' "$universe_id"
        return "$API_OK"
    fi

    return "$API_ERR_SCHEMA"
}

# 2. Universe → Game Metadata
roblox_api_get_game() {
    local universe_id="$1"
    [[ "$universe_id" =~ ^[0-9]+$ ]] || return "$API_ERR_INVALID_ARG"
    [ "$universe_id" -gt 0 ] || return "$API_ERR_INVALID_ARG"

    local cache_key="universe_${universe_id}_game"
    local cached
    if cached="$(roblox_api_cache_get "$cache_key")" && [ -n "$cached" ]; then
        printf '%s\n' "$cached"
        return "$API_OK"
    fi

    local url="https://games.roblox.com/v1/games?universeIds=${universe_id}"
    local raw_json
    raw_json="$(roblox_http_get "$url" "games")"
    local http_ret=$?
    if [ "$http_ret" -ne 0 ] || [ -z "$raw_json" ]; then
        return "$http_ret"
    fi

    local game_data=""
    if command -v jq >/dev/null 2>&1; then
        game_data="$(printf '%s' "$raw_json" | jq -c '(.data // [])[0] // empty' 2>/dev/null)"
    elif python3 -c "import sys" >/dev/null 2>&1; then
        game_data="$(printf '%s' "$raw_json" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get("data", [])
    if items:
        print(json.dumps(items[0]))
except Exception:
    sys.exit(1)
' 2>/dev/null)"
    elif command -v node >/dev/null 2>&1; then
        game_data="$(printf '%s' "$raw_json" | node -e '
let input = "";
process.stdin.on("data", c => input += c);
process.stdin.on("end", () => {
    try {
        const d = JSON.parse(input);
        if (d.data && d.data.length > 0) {
            console.log(JSON.stringify(d.data[0]));
        }
    } catch(e) {}
});
' 2>/dev/null)"
    fi

    if [ -n "$game_data" ] && [ "$game_data" != "null" ]; then
        roblox_api_cache_set "$cache_key" "$game_data" 600 "200"
        printf '%s\n' "$game_data"
        return "$API_OK"
    fi

    return "$API_ERR_SCHEMA"
}

# 3. Public Servers V2
roblox_api_get_public_servers() {
    local place_id="$1"
    local cursor="${2:-}"
    local limit="${3:-100}"

    [[ "$place_id" =~ ^[0-9]+$ ]] || return "$API_ERR_INVALID_ARG"
    [ "$place_id" -gt 0 ] || return "$API_ERR_INVALID_ARG"

    local cache_key="servers_${place_id}_${cursor:-first}"
    local cached
    if cached="$(roblox_api_cache_get "$cache_key")" && [ -n "$cached" ]; then
        printf '%s\n' "$cached"
        return "$API_OK"
    fi

    local url="https://games.roblox.com/v1/games/${place_id}/servers/Public?sortOrder=Asc&limit=${limit}&excludeFullGames=true"
    if [ -n "$cursor" ]; then
        url="${url}&cursor=${cursor}"
    fi

    local raw_json
    raw_json="$(roblox_http_get "$url" "servers")"
    local http_ret=$?
    if [ "$http_ret" -ne 0 ] || [ -z "$raw_json" ]; then
        return "$http_ret"
    fi

    # Validate JSON has data array
    local valid=false
    if command -v jq >/dev/null 2>&1; then
        if printf '%s' "$raw_json" | jq -e '.data | type == "array"' >/dev/null 2>&1; then
            valid=true
        fi
    elif python3 -c "import sys" >/dev/null 2>&1; then
        if printf '%s' "$raw_json" | python3 -c 'import sys, json; d = json.load(sys.stdin); sys.exit(0 if isinstance(d.get("data"), list) else 1)' 2>/dev/null; then
            valid=true
        fi
    elif command -v node >/dev/null 2>&1; then
        if printf '%s' "$raw_json" | node -e 'let b=""; process.stdin.on("data",c=>b+=c); process.stdin.on("end",()=>{ try{ const d=JSON.parse(b); process.exit(Array.isArray(d.data)?0:1); }catch(e){process.exit(1);} });' 2>/dev/null; then
            valid=true
        fi
    fi

    if [ "$valid" = "true" ]; then
        roblox_api_cache_set "$cache_key" "$raw_json" 15 "200"
        printf '%s\n' "$raw_json"
        return "$API_OK"
    fi

    return "$API_ERR_SCHEMA"
}

# 4. Filter & Sort Public Servers
roblox_api_filter_sort_servers() {
    local raw_json="$1"
    local min_players="${2:-1}"
    local max_players="${3:-0}"
    local failed_jobs="${4:-}"

    [ -n "$raw_json" ] || return 1

    if command -v jq >/dev/null 2>&1; then
        printf '%s' "$raw_json" | jq -r \
            --argjson min "$min_players" \
            --argjson max "$max_players" \
            --arg failed "$failed_jobs" '
            ($failed | split(",") | map(select(length > 0))) as $blacklist |
            [ (.data // [])[]
              | select(.id != null and .playing != null and .maxPlayers != null)
              | select(.playing < .maxPlayers)
              | select($min <= 0 or .playing >= $min)
              | select($max <= 0 or .playing <= $max)
              | select(($blacklist | index(.id)) == null)
            ]
            | sort_by([.playing, (.ping // 999)])
            | .[]
            | [ .id, (.playing | tostring), (.maxPlayers | tostring), ((.ping // 999) | tostring) ]
            | join("|")
        ' 2>/dev/null || true
    elif python3 -c "import sys" >/dev/null 2>&1; then
        printf '%s' "$raw_json" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get("data", [])
    min_p = int(sys.argv[1])
    max_p = int(sys.argv[2])
    failed_list = set(f.strip() for f in sys.argv[3].split(",") if f.strip())
    valid = []
    for it in items:
        jid = it.get("id")
        pl = it.get("playing")
        mx = it.get("maxPlayers")
        png = it.get("ping", 999) or 999
        if not jid or pl is None or mx is None:
            continue
        if str(jid) in failed_list:
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
        print(f"{jid}|{pl}|{mx}|{png}")
except Exception:
    pass
' "$min_players" "$max_players" "$failed_jobs" 2>/dev/null || true
    elif command -v node >/dev/null 2>&1; then
        printf '%s' "$raw_json" | node -e '
let input = "";
process.stdin.on("data", c => input += c);
process.stdin.on("end", () => {
    try {
        const data = JSON.parse(input);
        const minP = parseInt(process.argv[1] || "1", 10);
        const maxP = parseInt(process.argv[2] || "0", 10);
        const failed = new Set((process.argv[3] || "").split(",").map(s=>s.trim()).filter(Boolean));
        const items = (data.data || []).filter(s => {
            if (!s.id || s.playing === undefined || s.maxPlayers === undefined) return false;
            if (failed.has(String(s.id))) return false;
            if (s.playing >= s.maxPlayers) return false;
            if (minP > 0 && s.playing < minP) return false;
            if (maxP > 0 && s.playing > maxP) return false;
            return true;
        });
        items.sort((a, b) => (a.playing - b.playing) || ((a.ping || 999) - (b.ping || 999)));
        for (const it of items) {
            console.log(`${it.id}|${it.playing}|${it.maxPlayers}|${it.ping || 999}`);
        }
    } catch (e) {}
});
' "$min_players" "$max_players" "$failed_jobs" 2>/dev/null || true
    fi
}

# 5. Pick Low Server V2 (Supports pagination and failed Job ID blacklist)
roblox_api_pick_server() {
    local place_id="$1"
    local slot_index="${2:-0}"
    local min_players="${3:-1}"
    local max_players="${4:-0}"
    local failed_jobs="${5:-}"
    local max_pages="${6:-5}"

    [[ "$place_id" =~ ^[0-9]+$ ]] || return "$API_ERR_INVALID_ARG"

    local cursor="" page=1
    local raw_json servers=""

    while [ "$page" -le "$max_pages" ]; do
        raw_json="$(roblox_api_get_public_servers "$place_id" "$cursor" 100)" || return 1
        [ -n "$raw_json" ] || return 1

        servers="$(roblox_api_filter_sort_servers "$raw_json" "$min_players" "$max_players" "$failed_jobs")"
        if [ -n "$servers" ]; then
            break
        fi

        cursor="$(roblox_api_json_extract "$raw_json" ".nextPageCursor")"
        if [ -z "$cursor" ] || [ "$cursor" = "null" ]; then
            break
        fi
        page=$(( page + 1 ))
    done

    [ -n "$servers" ] || return 1

    local count
    count=$(printf '%s\n' "$servers" | sed '/^$/d' | wc -l | tr -d ' ')
    [ "$count" -gt 0 ] || return 1

    local target_line=$(( (slot_index % count) + 1 ))
    local selected
    selected="$(printf '%s\n' "$servers" | sed -n "${target_line}p")"
    [ -n "$selected" ] || return 1

    printf '%s\n' "$selected"
    return 0
}

# 5. Username → User ID
roblox_api_resolve_username() {
    local username="$1"
    [[ "$username" =~ ^[A-Za-z0-9_]{3,20}$ ]] || return "$API_ERR_INVALID_ARG"

    local uname_lower
    uname_lower="$(printf '%s' "$username" | tr '[:upper:]' '[:lower:]')"
    local cache_key="user_${uname_lower}"

    local cached
    if cached="$(roblox_api_cache_get "$cache_key")" && [ -n "$cached" ]; then
        printf '%s\n' "$cached"
        return "$API_OK"
    fi

    local url="https://users.roblox.com/v1/usernames/users"
    local payload
    payload="{\"usernames\":[\"$username\"],\"excludeBannedUsers\":false}"

    local raw_json
    raw_json="$(roblox_http_post_json "$url" "$payload" "users")"
    local http_ret=$?
    if [ "$http_ret" -ne 0 ] || [ -z "$raw_json" ]; then
        return "$http_ret"
    fi

    local user_info=""
    if command -v jq >/dev/null 2>&1; then
        user_info="$(printf '%s' "$raw_json" | jq -r '
            (.data // [])[0]
            | select(.id != null and .name != null)
            | [ (.id | tostring), .name ]
            | join("|")
        ' 2>/dev/null)"
    elif python3 -c "import sys" >/dev/null 2>&1; then
        user_info="$(printf '%s' "$raw_json" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get("data", [])
    if items:
        u = items[0]
        if u.get("id") and u.get("name"):
            print(f"{u[\"id\"]}|{u[\"name\"]}")
except Exception:
    sys.exit(1)
' 2>/dev/null)"
    elif command -v node >/dev/null 2>&1; then
        user_info="$(printf '%s' "$raw_json" | node -e '
let input = "";
process.stdin.on("data", c => input += c);
process.stdin.on("end", () => {
    try {
        const d = JSON.parse(input);
        if (d.data && d.data.length > 0 && d.data[0].id && d.data[0].name) {
            console.log(`${d.data[0].id}|${d.data[0].name}`);
        }
    } catch(e) {}
});
' 2>/dev/null)"
    fi

    if [ -n "$user_info" ]; then
        roblox_api_cache_set "$cache_key" "$user_info" 86400 "200"
        printf '%s\n' "$user_info"
        return "$API_OK"
    fi

    return "$API_ERR_INVALID_ARG"
}

# 6. Presence API
roblox_api_get_presence() {
    local user_id="$1"
    [[ "$user_id" =~ ^[0-9]+$ ]] || return "$API_ERR_INVALID_ARG"
    [ "$user_id" -gt 0 ] || return "$API_ERR_INVALID_ARG"

    local cache_key="presence_${user_id}"
    local cached
    if cached="$(roblox_api_cache_get "$cache_key")" && [ -n "$cached" ]; then
        printf '%s\n' "$cached"
        return "$API_OK"
    fi

    local url="https://presence.roblox.com/v1/presence/users"
    local payload
    payload="{\"userIds\":[$user_id]}"

    local raw_json
    raw_json="$(roblox_http_post_json "$url" "$payload" "presence")"
    local http_ret=$?
    if [ "$http_ret" -ne 0 ] || [ -z "$raw_json" ]; then
        return "$http_ret"
    fi

    # Output format: type|placeId|gameId|universeId|lastLocation
    local presence_out=""
    if command -v jq >/dev/null 2>&1; then
        presence_out="$(printf '%s' "$raw_json" | jq -r '
            (.userPresences // [])[0]
            | select(.userPresenceType != null)
            | [
                (.userPresenceType | tostring),
                ((.placeId // "") | tostring),
                ((.gameId // "") | tostring),
                ((.universeId // "") | tostring),
                ((.lastLocation // "") | tostring)
              ]
            | join("|")
        ' 2>/dev/null)"
    elif python3 -c "import sys" >/dev/null 2>&1; then
        presence_out="$(printf '%s' "$raw_json" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get("userPresences", [])
    if items:
        p = items[0]
        pt = p.get("userPresenceType", 0)
        pl = p.get("placeId") or ""
        gid = p.get("gameId") or ""
        uid = p.get("universeId") or ""
        loc = p.get("lastLocation") or ""
        print(f"{pt}|{pl}|{gid}|{uid}|{loc}")
except Exception:
    sys.exit(1)
' 2>/dev/null)"
    elif command -v node >/dev/null 2>&1; then
        presence_out="$(printf '%s' "$raw_json" | node -e '
let input = "";
process.stdin.on("data", c => input += c);
process.stdin.on("end", () => {
    try {
        const d = JSON.parse(input);
        if (d.userPresences && d.userPresences.length > 0) {
            const p = d.userPresences[0];
            console.log(`${p.userPresenceType || 0}|${p.placeId || ""}|${p.gameId || ""}|${p.universeId || ""}|${p.lastLocation || ""}`);
        }
    } catch(e) {}
});
' 2>/dev/null)"
    fi

    if [ -n "$presence_out" ]; then
        roblox_api_cache_set "$cache_key" "$presence_out" 20 "200"
        printf '%s\n' "$presence_out"
        return "$API_OK"
    fi

    return "$API_ERR_SCHEMA"
}
