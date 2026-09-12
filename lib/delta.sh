#!/usr/bin/env bash

# Delta Executor Auto-Key & Helper Library for Auto Rejoin Pro
# Handles Delta HWID extraction, Key link parsing, and automatic key insertion

DELTA_LAST_HWID=""
DELTA_LAST_KEY_URL=""
DELTA_LAST_KEY=""
DELTA_LAST_ERROR=""

delta_find_data_dir() {
    local pkg="${1:-com.roblox.client}"
    local paths=(
        "/sdcard/Android/data/${pkg}/files"
        "/data/data/${pkg}/files"
        "/sdcard/Delta"
        "/sdcard/Android/media/${pkg}"
    )

    for p in "${paths[@]}"; do
        if [ -d "$p" ]; then
            printf '%s\n' "$p"
            return 0
        fi
    done
    return 1
}

delta_extract_hwid() {
    local pkg="${1:-com.roblox.client}"
    local data_dir
    data_dir="$(delta_find_data_dir "$pkg")" || {
        DELTA_LAST_ERROR="Không tìm thấy thư mục của Delta."
        return 1
    }

    # 1. Search in delta config / log files
    local candidate_files=(
        "${data_dir}/delta_hwid.txt"
        "${data_dir}/delta.json"
        "${data_dir}/hwid.txt"
        "${data_dir}/Delta/config.json"
    )

    for f in "${candidate_files[@]}"; do
        if [ -f "$f" ]; then
            local val
            val="$(cat "$f" 2>/dev/null | tr -d '\r\n')"
            if [ -n "$val" ]; then
                DELTA_LAST_HWID="$val"
                return 0
            fi
        fi
    done

    # 2. Check Android logcat for Delta getkey URL
    if command -v logcat >/dev/null 2>&1; then
        local url
        url="$(logcat -d 2>/dev/null | grep -Eio 'https://gateway\.platoboost\.com/a/[0-9]+\?id=[a-zA-Z0-9_-]+' | tail -1)"
        if [ -n "$url" ]; then
            DELTA_LAST_KEY_URL="$url"
            DELTA_LAST_HWID="$(printf '%s' "$url" | grep -o 'id=[a-zA-Z0-9_-]*' | cut -d= -f2)"
            return 0
        fi
    fi

    # 3. Fallback to generating hardware fingerprint
    if command -v getprop >/dev/null 2>&1; then
        local serial
        serial="$(getprop ro.serialno 2>/dev/null || true)"
        [ -n "$serial" ] && { DELTA_LAST_HWID="$serial"; return 0; }
    fi

    DELTA_LAST_ERROR="Chưa mở Delta hoặc chưa trích xuất được HWID."
    return 1
}

delta_resolve_key() {
    local hwid="${1:-$DELTA_LAST_HWID}"
    [ -n "$hwid" ] || {
        DELTA_LAST_ERROR="HWID trống."
        return 1
    }

    if ! command -v curl >/dev/null 2>&1; then
        DELTA_LAST_ERROR="Thiếu lệnh curl."
        return 1
    fi

    # Check key resolver API (Platoboost / Delta bypass endpoint)
    local resolver_url="https://api.deltaexploits.net/v1/keys/verify?hwid=${hwid}"
    local res
    res="$(curl -sSL --connect-timeout 8 --max-time 15 "$resolver_url" 2>/dev/null)" || {
        DELTA_LAST_ERROR="Không thể kết nối đến máy chủ lấy key."
        return 1
    }

    if command -v jq >/dev/null 2>&1; then
        local key
        key="$(printf '%s' "$res" | jq -r '.key // .token // empty' 2>/dev/null)"
        if [ -n "$key" ] && [ "$key" != "null" ]; then
            DELTA_LAST_KEY="$key"
            return 0
        fi
    fi

    DELTA_LAST_ERROR="Chưa thể bypass key tự động cho HWID này."
    return 1
}

delta_set_clipboard_key() {
    local key="$1"
    [ -n "$key" ] || return 1

    # Android termux-clipboard-set
    if command -v termux-clipboard-set >/dev/null 2>&1; then
        printf '%s' "$key" | termux-clipboard-set 2>/dev/null
        return 0
    fi

    # Android service call clipboard
    if command -v service >/dev/null 2>&1; then
        service call clipboard 2 s16 "$key" >/dev/null 2>&1 || true
        return 0
    fi

    return 1
}
