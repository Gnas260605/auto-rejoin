#!/usr/bin/env bash

# Delta helper library for Auto Rejoin Pro.
# This module may locate a local HWID for support, but it does not bypass key
# systems, scrape key links, or call third-party bypass resolvers.

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
        DELTA_LAST_ERROR="Could not find Delta data directory."
        return 1
    }

    local candidate_files=(
        "${data_dir}/delta_hwid.txt"
        "${data_dir}/delta.json"
        "${data_dir}/hwid.txt"
        "${data_dir}/Delta/config.json"
    )

    for f in "${candidate_files[@]}"; do
        if [ -f "$f" ]; then
            local val
            val="$(tr -d '\r\n' < "$f" 2>/dev/null)"
            if [ -n "$val" ]; then
                DELTA_LAST_HWID="$val"
                return 0
            fi
        fi
    done

    if command -v getprop >/dev/null 2>&1; then
        local serial
        serial="$(getprop ro.serialno 2>/dev/null || true)"
        if [ -n "$serial" ]; then
            DELTA_LAST_HWID="$serial"
            return 0
        fi
    fi

    DELTA_LAST_ERROR="Delta HWID was not found. Open Delta once, then try again."
    return 1
}

delta_resolve_key() {
    local hwid="${1:-$DELTA_LAST_HWID}"
    [ -z "$hwid" ] || :
    DELTA_LAST_ERROR="Automatic Delta key bypass is not supported. Complete the official Delta key flow manually."
    return 1
}

delta_set_clipboard_key() {
    local key="$1"
    [ -n "$key" ] || return 1

    if command -v termux-clipboard-set >/dev/null 2>&1; then
        printf '%s' "$key" | termux-clipboard-set 2>/dev/null
        return 0
    fi

    if command -v service >/dev/null 2>&1; then
        service call clipboard 2 s16 "$key" >/dev/null 2>&1 || true
        return 0
    fi

    return 1
}

delta_find_autoexec_dirs() {
    local pkg="${1:-com.roblox.client}"
    local dirs=(
        "/sdcard/Delta/autoexec"
        "/sdcard/Delta/scripts"
        "/sdcard/Codex/autoexec"
        "/sdcard/Fluxus/autoexec"
        "/sdcard/Arceus/autoexec"
        "/sdcard/Hydrogen/autoexec"
        "/sdcard/Android/data/${pkg}/files/Delta/autoexec"
        "/data/data/${pkg}/files/Delta/autoexec"
    )

    local found=0
    for d in "${dirs[@]}"; do
        if [ -d "$d" ]; then
            printf '%s\n' "$d"
            found=$((found + 1))
        fi
    done
    [ "$found" -gt 0 ]
}

delta_install_companion_script() {
    local source_script="$1"
    local pkg="${2:-com.roblox.client}"
    [ -f "$source_script" ] || return 1

    local installed=0
    while IFS= read -r target_dir; do
        if [ -n "$target_dir" ] && [ -d "$target_dir" ]; then
            cp -f "$source_script" "${target_dir}/auto_rejoin_companion.lua" 2>/dev/null && installed=$((installed + 1))
        fi
    done < <(delta_find_autoexec_dirs "$pkg")

    [ "$installed" -gt 0 ]
}
