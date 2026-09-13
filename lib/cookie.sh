#!/usr/bin/env bash

# Roblox Cookie Safety Library for Auto Rejoin Pro.
# Raw .ROBLOSECURITY cookies are account credentials. This module allows
# explicit user-provided validation only; importing/exporting cookies from app
# storage is intentionally blocked.

COOKIE_LAST_USER_ID=""
COOKIE_LAST_USERNAME=""
COOKIE_LAST_DISPLAY_NAME=""
COOKIE_LAST_ROBUX="0"
COOKIE_LAST_ERROR=""

cookie_clean_token() {
    local raw="$1"
    raw="$(printf '%s' "$raw" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    printf '%s\n' "$raw"
}

cookie_validate() {
    local cookie
    cookie="$(cookie_clean_token "$1")"
    [ -n "$cookie" ] || {
        COOKIE_LAST_ERROR="Cookie is empty."
        return 1
    }

    if ! command -v curl >/dev/null 2>&1; then
        COOKIE_LAST_ERROR="Missing curl."
        return 1
    fi

    local response
    response="$(curl -sSL --connect-timeout 8 --max-time 15 \
        -H "Cookie: .ROBLOSECURITY=${cookie}" \
        -H "User-Agent: Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" \
        "https://users.roblox.com/v1/users/authenticated" 2>/dev/null)" || {
        COOKIE_LAST_ERROR="Could not connect to Roblox."
        return 1
    }

    if command -v jq >/dev/null 2>&1; then
        local user_id name display_name
        user_id="$(printf '%s' "$response" | jq -r '.id // empty' 2>/dev/null)"
        name="$(printf '%s' "$response" | jq -r '.name // empty' 2>/dev/null)"
        display_name="$(printf '%s' "$response" | jq -r '.displayName // empty' 2>/dev/null)"

        if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
            COOKIE_LAST_USER_ID="$user_id"
            COOKIE_LAST_USERNAME="$name"
            COOKIE_LAST_DISPLAY_NAME="$display_name"
            COOKIE_LAST_ERROR=""
            return 0
        fi
    elif command -v grep >/dev/null 2>&1; then
        local user_id
        user_id="$(printf '%s' "$response" | grep -o '"id":[0-9]*' | head -1 | cut -d: -f2)"
        if [ -n "$user_id" ]; then
            COOKIE_LAST_USER_ID="$user_id"
            COOKIE_LAST_USERNAME="$(printf '%s' "$response" | grep -o '"name":"[^"]*"' | head -1 | cut -d'"' -f4)"
            COOKIE_LAST_DISPLAY_NAME="$(printf '%s' "$response" | grep -o '"displayName":"[^"]*"' | head -1 | cut -d'"' -f4)"
            COOKIE_LAST_ERROR=""
            return 0
        fi
    fi

    COOKIE_LAST_ERROR="Cookie is invalid or expired."
    return 1
}

cookie_find_app_data_path() {
    local pkg="$1"
    local possible_paths=(
        "/data/data/${pkg}"
        "/data/user/0/${pkg}"
        "/sdcard/Android/data/${pkg}"
    )

    for p in "${possible_paths[@]}"; do
        if [ -d "$p" ]; then
            printf '%s\n' "$p"
            return 0
        fi
    done
    return 1
}

cookie_export_package() {
    local pkg="${1:-com.roblox.client}"
    COOKIE_LAST_ERROR="Raw Roblox cookie export from ${pkg} is disabled because cookies are login credentials. Use the official Roblox login flow in the app."
    return 1
}

cookie_export_all() {
    local output_file="${1:-}"
    [ -z "$output_file" ] || :
    COOKIE_LAST_ERROR="Raw Roblox cookie export is disabled because cookies are login credentials. Use the official Roblox login flow in the app."
    return 1
}

cookie_import_package() {
    local pkg="${1:-com.roblox.client}"
    local cookie="${2:-}"
    [ -z "$cookie" ] || :
    COOKIE_LAST_ERROR="Raw Roblox cookie import into ${pkg} is disabled because it injects login credentials. Use the official Roblox login flow in the app."
    return 1
}
