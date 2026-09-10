#!/usr/bin/env bash

LOG_MAX_BYTES="${LOG_MAX_BYTES:-10485760}"
LOG_KEEP_FILES="${LOG_KEEP_FILES:-5}"

log_timestamp() {
    date '+%Y-%m-%dT%H:%M:%S%z' | sed -E 's/([0-9]{2})$/:\1/'
}

log_strip_ansi() {
    sed 's/\x1b\[[0-9;]*m//g'
}

log_redact_secret() {
    local text="$1"
    text="$(printf '%s' "$text" | sed -E 's#https://discord(app)?\.com/api/webhooks/[A-Za-z0-9._~/-]+#https://discord.com/api/webhooks/***#g')"
    printf '%s' "$text"
}

log_kv_escape() {
    local value="$1"
    value="$(log_redact_secret "$value")"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//$'\n'/\\n}"
    value="${value//$'\t'/\\t}"
    printf '%s' "$value"
}

log_rotate_if_needed() {
    local file="$1"
    local max_bytes="${2:-$LOG_MAX_BYTES}"
    local keep="${3:-$LOG_KEEP_FILES}"
    local size i

    [ -n "$file" ] || return 0
    [ -f "$file" ] || return 0
    size=$(wc -c < "$file" 2>/dev/null || echo 0)
    [ "${size:-0}" -gt "$max_bytes" ] || return 0

    i="$keep"
    while [ "$i" -gt 1 ]; do
        if [ -f "${file}.$((i - 1))" ]; then
            mv "${file}.$((i - 1))" "${file}.${i}" 2>/dev/null || return 0
        fi
        i=$((i - 1))
    done
    mv "$file" "${file}.1" 2>/dev/null || return 0
}

log_event() {
    local level="$1"
    local event="$2"
    local file="${3:-${LOG_FILE:-}}"
    shift 3 || true
    local dir line key value

    line="$(log_timestamp) ${level} event=${event}"
    while [ "$#" -gt 0 ]; do
        key="$1"
        value="${2:-}"
        shift 2 || true
        line="${line} ${key}=\"$(log_kv_escape "$value")\""
    done

    if [ -n "$file" ]; then
        dir="$(dirname "$file")"
        [ -d "$dir" ] || mkdir -p "$dir" 2>/dev/null || true
        [ -d "$file" ] && return 0
        log_rotate_if_needed "$file"
        printf '%s\n' "$line" >> "$file" 2>/dev/null || true
    fi
}

log_write() {
    local level="$1"
    local message="$2"
    local file="${3:-${LOG_FILE:-}}"
    local clean

    clean="$(printf '%s' "$message" | log_strip_ansi)"
    clean="$(log_redact_secret "$clean")"
    log_event "$level" message "$file" message "$clean"
}

log_debug() { log_write DEBUG "$1" "${2:-${LOG_FILE:-}}"; }
log_info() { log_write INFO "$1" "${2:-${LOG_FILE:-}}"; }
log_warn() { log_write WARN "$1" "${2:-${LOG_FILE:-}}"; }
log_error() { log_write ERROR "$1" "${2:-${LOG_FILE:-}}"; }
