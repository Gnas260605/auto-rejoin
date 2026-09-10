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

roblox_build_game_uri() {
    local place_id="$1"
    roblox_validate_place_id "$place_id" || return 1
    printf 'roblox://experiences/start?placeId=%s\n' "$place_id"
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
            ROBLOX_LINK_TYPE="game"
            ROBLOX_PARSED_PLACE_ID="$place_id"
            ROBLOX_PARSED_PRIVATE_CODE=""
            ROBLOX_PARSED_URI="$(roblox_build_game_uri "$place_id")"
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
