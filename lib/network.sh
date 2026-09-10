#!/usr/bin/env bash

NETWORK_CONNECT_TIMEOUT="${NETWORK_CONNECT_TIMEOUT:-10}"
NETWORK_MAX_TIME="${NETWORK_MAX_TIME:-30}"
NETWORK_RETRY="${NETWORK_RETRY:-3}"
NETWORK_RETRY_DELAY="${NETWORK_RETRY_DELAY:-2}"
NETWORK_POST_RETRY="${NETWORK_POST_RETRY:-1}"

network_curl_common_args() {
    local max_time="${1:-$NETWORK_MAX_TIME}"
    local retry="${2:-$NETWORK_RETRY}"
    printf '%s\n' \
        --fail \
        --location \
        --silent \
        --show-error \
        --connect-timeout "$NETWORK_CONNECT_TIMEOUT" \
        --max-time "$max_time" \
        --retry "$retry" \
        --retry-delay "$NETWORK_RETRY_DELAY"
}

network_redact_url() {
    local url="$1"
    case "$url" in
        https://discord.com/api/webhooks/*|https://discordapp.com/api/webhooks/*)
            printf '%s\n' "${url%%/api/webhooks/*}/api/webhooks/***"
            ;;
        *)
            printf '%s\n' "$url"
            ;;
    esac
}

network_get() {
    local url="$1"
    local max_time="${2:-$NETWORK_MAX_TIME}"
    local retry="${3:-$NETWORK_RETRY}"
    local args=()

    while IFS= read -r arg; do
        args+=("$arg")
    done < <(network_curl_common_args "$max_time" "$retry")

    curl "${args[@]}" "$url"
}

network_post_json() {
    local url="$1"
    local payload="$2"
    local max_time="${3:-15}"
    local retry="${4:-$NETWORK_POST_RETRY}"
    local args=()

    while IFS= read -r arg; do
        args+=("$arg")
    done < <(network_curl_common_args "$max_time" "$retry")

    curl "${args[@]}" \
        -H "Content-Type: application/json" \
        -X POST \
        --data-binary "$payload" \
        "$url"
}

network_download() {
    local url="$1"
    local output="$2"
    local max_time="${3:-120}"
    local retry="${4:-$NETWORK_RETRY}"
    local args=()

    while IFS= read -r arg; do
        args+=("$arg")
    done < <(network_curl_common_args "$max_time" "$retry")

    curl "${args[@]}" -o "$output" "$url"
}

network_download_secure_https() {
    local url="$1"
    local output="$2"
    local max_time="${3:-120}"
    local retry="${4:-$NETWORK_RETRY}"
    local max_bytes="${5:-0}"
    local args=()

    while IFS= read -r arg; do
        args+=("$arg")
    done < <(network_curl_common_args "$max_time" "$retry")

    args+=(--proto '=https' --proto-redir '=https')
    if [ "$max_bytes" != "0" ]; then
        args+=(--max-filesize "$max_bytes")
    fi

    curl "${args[@]}" -o "$output" "$url"
}

network_is_online() {
    ping -c 1 -W 2 1.1.1.1 >/dev/null 2>&1 ||
    ping -c 1 -W 2 8.8.8.8 >/dev/null 2>&1 ||
    network_get "http://www.google.com" 5 1 >/dev/null 2>&1
}
