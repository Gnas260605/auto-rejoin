#!/usr/bin/env bash

notification_redact_webhook() {
    if declare -F network_redact_url >/dev/null 2>&1; then
        network_redact_url "$1"
    else
        case "$1" in
            https://discord.com/api/webhooks/*|https://discordapp.com/api/webhooks/*)
                printf '%s\n' "${1%%/api/webhooks/*}/api/webhooks/***"
                ;;
            *)
                printf '%s\n' "$1"
                ;;
        esac
    fi
}

notification_is_enabled() {
    [ -n "${DISCORD_WEBHOOK:-}" ]
}

notification_json_escape() {
    local input="$1"
    local i char out="" code
    local length=${#input}

    for ((i = 0; i < length; i++)); do
        char="${input:i:1}"
        case "$char" in
            '"') out="${out}\\\"" ;;
            "\\") out="${out}\\\\" ;;
            $'\n') out="${out}\\n" ;;
            $'\r') out="${out}\\r" ;;
            $'\t') out="${out}\\t" ;;
            *)
                LC_CTYPE=C printf -v code '%d' "'$char"
                if [ "$code" -lt 32 ]; then
                    printf -v char '\\u%04x' "$code"
                    out="${out}${char}"
                else
                    out="${out}${char}"
                fi
                ;;
        esac
    done
    printf '%s' "$out"
}

notification_build_discord_payload() {
    local message="$1"
    if command -v jq >/dev/null 2>&1; then
        jq -n --arg content "$message" '{content:$content}'
    else
        printf '{"content":"%s"}\n' "$(notification_json_escape "$message")"
    fi
}

notification_send_discord() {
    local webhook="${1:-${DISCORD_WEBHOOK:-}}"
    local message="$2"
    local payload

    [ -n "$webhook" ] || return 0
    payload="$(notification_build_discord_payload "$message")" || return 1

    if ! network_post_json "$webhook" "$payload" 15 1 >/dev/null 2>&1; then
        if declare -F log_warn >/dev/null 2>&1; then
            log_warn "Discord webhook delivery failed: $(notification_redact_webhook "$webhook")"
        fi
        return 1
    fi
}
