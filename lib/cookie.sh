#!/usr/bin/env bash

# Roblox Cookie Management Library for Auto Rejoin Pro
# Handles .ROBLOSECURITY validation, extraction, injection, and export

COOKIE_LAST_USER_ID=""
COOKIE_LAST_USERNAME=""
COOKIE_LAST_DISPLAY_NAME=""
COOKIE_LAST_ROBUX="0"
COOKIE_LAST_ERROR=""

cookie_clean_token() {
    local raw="$1"
    # Strip any leading/trailing whitespace, quotes, or warning prefix
    raw="$(printf '%s' "$raw" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
    # If the token has the WARNING header, preserve or strip cleanly
    printf '%s\n' "$raw"
}

cookie_validate() {
    local cookie
    cookie="$(cookie_clean_token "$1")"
    [ -n "$cookie" ] || {
        COOKIE_LAST_ERROR="Cookie trống."
        return 1
    }

    if ! command -v curl >/dev/null 2>&1; then
        COOKIE_LAST_ERROR="Thiếu lệnh curl."
        return 1
    fi

    local response
    response="$(curl -sSL --connect-timeout 8 --max-time 15 \
        -H "Cookie: .ROBLOSECURITY=${cookie}" \
        -H "User-Agent: Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36" \
        "https://users.roblox.com/v1/users/authenticated" 2>/dev/null)" || {
        COOKIE_LAST_ERROR="Không thể kết nối đến máy chủ Roblox."
        return 1
    }

    if command -v jq >/dev/null 2>&1; then
        local user_id name disp
        user_id="$(printf '%s' "$response" | jq -r '.id // empty' 2>/dev/null)"
        name="$(printf '%s' "$response" | jq -r '.name // empty' 2>/dev/null)"
        disp="$(printf '%s' "$response" | jq -r '.displayName // empty' 2>/dev/null)"

        if [ -n "$user_id" ] && [ "$user_id" != "null" ]; then
            COOKIE_LAST_USER_ID="$user_id"
            COOKIE_LAST_USERNAME="$name"
            COOKIE_LAST_DISPLAY_NAME="$disp"
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

    COOKIE_LAST_ERROR="Cookie không hợp lệ hoặc đã hết hạn."
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
    local pkg="$1"
    local data_path
    data_path="$(cookie_find_app_data_path "$pkg")" || return 1

    local cookie_db_paths=(
        "${data_path}/app_webview/Default/Cookies"
        "${data_path}/app_webview/Cookies"
        "${data_path}/databases/webviewCookiesChromium.db"
        "${data_path}/databases/webview.db"
    )

    local found_cookie=""
    for db in "${cookie_db_paths[@]}"; do
        if [ -f "$db" ]; then
            if command -v sqlite3 >/dev/null 2>&1; then
                found_cookie="$(sqlite3 "$db" "SELECT value FROM cookies WHERE name = '.ROBLOSECURITY' OR name = '.ROBLOSECURITY_V2' LIMIT 1;" 2>/dev/null)"
            fi
            if [ -z "$found_cookie" ] && command -v strings >/dev/null 2>&1; then
                found_cookie="$(strings "$db" 2>/dev/null | grep -E '_\|WARNING:-DO-NOT-SHARE-THIS' | head -1)"
            fi
            if [ -n "$found_cookie" ]; then
                printf '%s\n' "$found_cookie"
                return 0
            fi
        fi
    done

    # Check shared_prefs xml files
    local prefs_dir="${data_path}/shared_prefs"
    if [ -d "$prefs_dir" ]; then
        for xml in "$prefs_dir"/*.xml; do
            [ -f "$xml" ] || continue
            found_cookie="$(grep -oE '_\|WARNING:-DO-NOT-SHARE-THIS[^\"]*' "$xml" 2>/dev/null | head -1)"
            if [ -n "$found_cookie" ]; then
                printf '%s\n' "$found_cookie"
                return 0
            fi
        done
    fi

    return 1
}

cookie_export_all() {
    local output_file="${1:-}"
    local packages=""
    if declare -F android_list_roblox_packages >/dev/null 2>&1; then
        packages="$(android_list_roblox_packages)"
    fi

    if [ -z "$packages" ]; then
        packages="com.roblox.client"
    fi

    local results=()
    local count=0
    for pkg in $packages; do
        local c
        c="$(cookie_export_package "$pkg" 2>/dev/null || true)"
        if [ -n "$c" ]; then
            local info=""
            if cookie_validate "$c" >/dev/null 2>&1; then
                info="${COOKIE_LAST_USERNAME} (ID: ${COOKIE_LAST_USER_ID})"
            else
                info="Chưa xác thực"
            fi
            results+=("${pkg}|${info}|${c}")
            count=$((count + 1))
        fi
    done

    if [ "$count" -eq 0 ]; then
        printf 'Không tìm thấy cookie trên các gói Roblox clone.\n' >&2
        return 1
    fi

    if [ -n "$output_file" ]; then
        > "$output_file"
        for row in "${results[@]}"; do
            printf '%s\n' "$row" >> "$output_file"
        done
        printf 'Đã xuất %d cookie ra file: %s\n' "$count" "$output_file"
    else
        for row in "${results[@]}"; do
            local p; p="$(printf '%s' "$row" | cut -d'|' -f1)"
            local u; u="$(printf '%s' "$row" | cut -d'|' -f2)"
            local ck; ck="$(printf '%s' "$row" | cut -d'|' -f3)"
            printf '📦 Package: %s\n👤 Account: %s\n🔑 Cookie : %s\n----------------------------------------\n' "$p" "$u" "$ck"
        done
    fi
    return 0
}

cookie_import_package() {
    local pkg="$1"
    local cookie="$2"

    cookie="$(cookie_clean_token "$cookie")"
    [ -n "$cookie" ] || {
        COOKIE_LAST_ERROR="Cookie trống."
        return 1
    }

    local data_path
    data_path="$(cookie_find_app_data_path "$pkg")" || {
        COOKIE_LAST_ERROR="Không tìm thấy thư mục dữ liệu của gói: $pkg"
        return 1
    }

    local webview_dir="${data_path}/app_webview/Default"
    mkdir -p "$webview_dir" 2>/dev/null

    local db_path="${webview_dir}/Cookies"
    if command -v sqlite3 >/dev/null 2>&1; then
        sqlite3 "$db_path" <<EOF 2>/dev/null
CREATE TABLE IF NOT EXISTS cookies (creation_utc INTEGER NOT NULL, host_key TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, path TEXT NOT NULL, expires_utc INTEGER NOT NULL, is_secure INTEGER NOT NULL, is_httponly INTEGER NOT NULL, last_access_utc INTEGER NOT NULL, has_expires INTEGER NOT NULL, is_persistent INTEGER NOT NULL, priority INTEGER NOT NULL, encrypted_value BLOB DEFAULT '', samesite INTEGER NOT NULL DEFAULT -1, source_scheme INTEGER NOT NULL DEFAULT 0, source_port INTEGER NOT NULL DEFAULT -1, is_same_party INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (creation_utc, host_key, name, path));
DELETE FROM cookies WHERE host_key LIKE '%roblox.com%' AND (name = '.ROBLOSECURITY' OR name = '.ROBLOSECURITY_V2');
INSERT INTO cookies (creation_utc, host_key, name, value, path, expires_utc, is_secure, is_httponly, last_access_utc, has_expires, is_persistent, priority, encrypted_value, samesite, source_scheme, source_port) VALUES (strftime('%s','now')*1000000+11644473600000000, '.roblox.com', '.ROBLOSECURITY', '$cookie', '/', strftime('%s','now')*1000000+11644473600000000+63072000000000, 1, 1, strftime('%s','now')*1000000+11644473600000000, 1, 1, 1, '', -1, 2, 443);
EOF
        if [ $? -eq 0 ]; then
            return 0
        fi
    fi

    COOKIE_LAST_ERROR="Không thể ghi cookie vào database (cần quyền root hoặc sqlite3)."
    return 1
}
