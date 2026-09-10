#!/usr/bin/env bash

# Safe Roblox APK installer. Does not install until URL, APK, package, version,
# hash, and signature checks have completed according to policy.

INSTALLER_MAX_APK_SIZE_MB="${INSTALLER_MAX_APK_SIZE_MB:-500}"
INSTALLER_PACKAGE=""
INSTALLER_SHA256=""
INSTALLER_APK_PATH=""
INSTALLER_METADATA_PACKAGE=""
INSTALLER_METADATA_VERSION_CODE=""
INSTALLER_METADATA_VERSION_NAME=""
INSTALLER_METADATA_MIN_SDK=""
INSTALLER_INSTALLED_VERSION_CODE=""
INSTALLER_INSTALLED_VERSION_NAME=""
INSTALLER_VERSION_ACTION="UNKNOWN"
INSTALLER_STEP_INDEX=0
INSTALLER_STEP_TOTAL=13
INSTALLER_KEEP_APK="${INSTALLER_KEEP_APK:-false}"

installer_step() {
    local state="$1"
    local status="${2:-...}"
    local detail="${3:-}"
    local display_index

    display_index=$((INSTALLER_STEP_INDEX + 1))
    if [ -n "$detail" ]; then
        printf '[%s/%s] %-26s %s - %s\n' "$display_index" "$INSTALLER_STEP_TOTAL" "$state" "$status" "$detail"
    else
        printf '[%s/%s] %-26s %s\n' "$display_index" "$INSTALLER_STEP_TOTAL" "$state" "$status"
    fi
    if [ "$status" != "START" ]; then
        INSTALLER_STEP_INDEX=$((INSTALLER_STEP_INDEX + 1))
    fi
}

installer_validate_https_url() {
    local url="$1"
    local rest host

    [ -n "$url" ] || { echo "Error: APK URL is required" >&2; return 2; }
    case "$url" in
        https://*) ;;
        http://*|file://*|ftp://*|javascript:*|data:*)
            echo "Error: APK URL must use HTTPS" >&2
            return 2
            ;;
        *://*)
            echo "Error: unsupported APK URL scheme" >&2
            return 2
            ;;
        *)
            echo "Error: APK URL must use HTTPS" >&2
            return 2
            ;;
    esac
    case "$url" in
        *$'\n'*|*$'\r'*|*' '*|*';'*|*'`'*|*'$('*|*'|'*|*'&'*)
            echo "Error: APK URL contains unsupported characters" >&2
            return 2
            ;;
    esac
    rest="${url#https://}"
    host="${rest%%/*}"
    host="${host%%\?*}"
    host="${host%%#*}"
    [ -n "$host" ] || { echo "Error: APK URL host is empty" >&2; return 2; }
}

installer_validate_size_limit() {
    local value="$1"
    [[ "$value" =~ ^[0-9]+$ ]] || return 1
    [ "$value" -ge 1 ] && [ "$value" -le 2048 ]
}

installer_file_size_bytes() {
    local file="$1"
    stat -c %s "$file" 2>/dev/null || wc -c < "$file" | tr -d ' '
}

installer_disk_available_bytes() {
    local dir="$1"
    df -Pk "$dir" 2>/dev/null | awk 'NR==2 {print $4 * 1024}'
}

installer_check_storage() {
    local dir="$1"
    local max_mb="$2"
    local free_bytes min_bytes

    free_bytes="$(installer_disk_available_bytes "$dir")"
    if ! [[ "$free_bytes" =~ ^[0-9]+$ ]]; then
        echo "storage=unknown"
        return 0
    fi
    min_bytes=$(((max_mb * 1024 * 1024) + (25 * 1024 * 1024)))
    if [ "$free_bytes" -lt "$min_bytes" ]; then
        echo "Error: insufficient disk space for APK download" >&2
        return 1
    fi
    echo "storage=ok:${free_bytes}"
}

installer_validate_apk_file() {
    local file="$1"
    local max_mb="$2"
    local size max_bytes magic

    [ -f "$file" ] || { echo "Error: downloaded APK file does not exist" >&2; return 1; }
    size="$(installer_file_size_bytes "$file")"
    [[ "$size" =~ ^[0-9]+$ ]] || { echo "Error: could not read APK file size" >&2; return 1; }
    [ "$size" -gt 0 ] || { echo "Error: downloaded APK is empty" >&2; return 1; }
    max_bytes=$((max_mb * 1024 * 1024))
    [ "$size" -le "$max_bytes" ] || { echo "Error: APK exceeds max size ${max_mb}MB" >&2; return 1; }

    magic="$(head -c 2 "$file" 2>/dev/null || true)"
    [ "$magic" = "PK" ] || { echo "Error: downloaded file is not an APK/ZIP archive" >&2; return 1; }
}

installer_metadata_from_badging() {
    local badging="$1"

    INSTALLER_METADATA_PACKAGE="$(printf '%s\n' "$badging" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1)"
    INSTALLER_METADATA_VERSION_CODE="$(printf '%s\n' "$badging" | sed -n "s/^package: .*versionCode='\([^']*\)'.*/\1/p" | head -1)"
    INSTALLER_METADATA_VERSION_NAME="$(printf '%s\n' "$badging" | sed -n "s/^package: .*versionName='\([^']*\)'.*/\1/p" | head -1)"
    INSTALLER_METADATA_MIN_SDK="$(printf '%s\n' "$badging" | sed -n "s/^sdkVersion:'\([^']*\)'.*/\1/p" | head -1)"
}

installer_read_apk_metadata() {
    local file="$1"
    local badging

    INSTALLER_METADATA_PACKAGE=""
    INSTALLER_METADATA_VERSION_CODE=""
    INSTALLER_METADATA_VERSION_NAME=""
    INSTALLER_METADATA_MIN_SDK=""

    if command -v aapt >/dev/null 2>&1; then
        badging="$(aapt dump badging "$file" 2>/dev/null)" || {
            echo "Error: aapt could not inspect APK" >&2
            return 1
        }
        installer_metadata_from_badging "$badging"
    elif command -v aapt2 >/dev/null 2>&1; then
        badging="$(aapt2 dump badging "$file" 2>/dev/null)" || {
            echo "Error: aapt2 could not inspect APK" >&2
            return 1
        }
        installer_metadata_from_badging "$badging"
    else
        echo "Error: aapt or aapt2 is required to verify APK package before install" >&2
        return 1
    fi

    [ -n "$INSTALLER_METADATA_PACKAGE" ] || {
        echo "Error: APK package could not be determined" >&2
        return 1
    }
}

installer_validate_roblox_package() {
    local package="$1"
    local expected="${2:-com.roblox.client}"
    local allow_custom="${3:-false}"

    android_validate_package "$package" || {
        echo "Error: APK package name is invalid: $package" >&2
        return 1
    }

    if [ "$allow_custom" != "true" ] && [ "$package" != "com.roblox.client" ]; then
        echo "Error: official Roblox install requires package com.roblox.client; got $package" >&2
        return 1
    fi
    case "$package" in
        com.roblox|com.roblox.*) ;;
        *) echo "Error: APK package is not a Roblox package: $package" >&2; return 1 ;;
    esac
    if [ -n "$expected" ] && [ "$package" != "$expected" ]; then
        echo "Error: APK package mismatch: expected $expected got $package" >&2
        return 1
    fi
}

installer_sha256() {
    local file="$1"
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$file" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$file" | awk '{print $1}'
    else
        echo "Error: sha256sum or shasum is required" >&2
        return 1
    fi
}

installer_verify_signature_if_available() {
    local file="$1"

    if command -v apksigner >/dev/null 2>&1; then
        apksigner verify "$file" >/dev/null 2>&1 || {
            echo "Error: APK signature verification failed via apksigner" >&2
            return 1
        }
        echo "signature=verified:apksigner"
    elif command -v jarsigner >/dev/null 2>&1; then
        jarsigner -verify "$file" >/dev/null 2>&1 || {
            echo "Error: APK signature verification failed via jarsigner" >&2
            return 1
        }
        echo "signature=verified:jarsigner"
    else
        echo "signature=unavailable"
    fi
}

installer_load_installed_version() {
    local package="$1"
    local version_info

    INSTALLER_INSTALLED_VERSION_CODE=""
    INSTALLER_INSTALLED_VERSION_NAME=""

    android_package_exists "$package" || return 1
    version_info="$(android_get_package_version "$package" 2>/dev/null)" || return 0
    INSTALLER_INSTALLED_VERSION_CODE="$(printf '%s\n' "$version_info" | sed -n 's/^VERSION_CODE=//p' | head -1)"
    INSTALLER_INSTALLED_VERSION_NAME="$(printf '%s\n' "$version_info" | sed -n 's/^VERSION_NAME=//p' | head -1)"
    return 0
}

installer_compare_versions() {
    local installed_code="$1"
    local downloaded_code="$2"

    if [ -z "$installed_code" ]; then
        echo "NEW_INSTALL"
    elif [[ "$installed_code" =~ ^[0-9]+$ ]] && [[ "$downloaded_code" =~ ^[0-9]+$ ]]; then
        if [ "$downloaded_code" -gt "$installed_code" ]; then
            echo "UPGRADE"
        elif [ "$downloaded_code" -eq "$installed_code" ]; then
            echo "SAME_VERSION"
        else
            echo "DOWNGRADE"
        fi
    else
        echo "UNKNOWN"
    fi
}

installer_explain_install_failure() {
    local output="$1"

    case "$output" in
        *INSTALL_FAILED_UPDATE_INCOMPATIBLE*)
            echo "Installation failed: installed package signature does not match downloaded APK. Existing Roblox was NOT removed."
            ;;
        *INSTALL_FAILED_VERSION_DOWNGRADE*)
            echo "Installation failed: downloaded APK is older than the installed version. Existing Roblox was NOT removed."
            ;;
        *INSTALL_FAILED_INSUFFICIENT_STORAGE*)
            echo "Installation failed: device has insufficient storage. Existing Roblox was NOT removed."
            ;;
        *)
            echo "Installation failed. Existing Roblox was NOT removed."
            ;;
    esac
}

installer_download_to_part() {
    local url="$1"
    local part_file="$2"
    local final_file="$3"
    local max_bytes="$4"

    rm -f "$part_file" "$final_file"
    if declare -F network_download_secure_https >/dev/null 2>&1; then
        network_download_secure_https "$url" "$part_file" 300 3 "$max_bytes" || return 1
    else
        network_download "$url" "$part_file" 300 3 || return 1
    fi
    [ -s "$part_file" ] || return 1
    mv "$part_file" "$final_file"
}

installer_install_roblox() {
    local url="$1"
    local expected_package="${2:-com.roblox.client}"
    local expected_sha="${3:-}"
    local dry_run="${4:-false}"
    local max_mb="${5:-$INSTALLER_MAX_APK_SIZE_MB}"
    local project_dir="${6:-$(pwd)}"
    local allow_downgrade="${7:-false}"
    local keep_apk="${8:-false}"
    local yes="${9:-false}"
    local allow_custom_package="${10:-false}"
    local tmp_parent tmp_dir apk_file part_file actual_sha signature_status install_output max_bytes storage_result

    INSTALLER_STEP_INDEX=0
    installer_step VALIDATING_URL START
    installer_validate_https_url "$url" || return $?
    installer_step VALIDATING_URL OK

    installer_step CHECKING_ENVIRONMENT START
    command -v curl >/dev/null 2>&1 || { echo "Error: curl is required" >&2; return 1; }
    command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || { echo "Error: sha256sum or shasum is required" >&2; return 1; }
    command -v aapt >/dev/null 2>&1 || command -v aapt2 >/dev/null 2>&1 || { echo "Error: aapt or aapt2 is required" >&2; return 1; }
    installer_step CHECKING_ENVIRONMENT OK

    installer_validate_size_limit "$max_mb" || {
        echo "Error: invalid max APK size: $max_mb" >&2
        return 2
    }
    tmp_parent="${project_dir}/tmp/install"
    mkdir -p "$tmp_parent" || return 1
    tmp_dir="$(mktemp -d "${tmp_parent}/job.XXXXXX")" || return 1
    apk_file="${tmp_dir}/roblox.apk"
    part_file="${apk_file}.part"
    INSTALLER_APK_PATH="$apk_file"
    max_bytes=$((max_mb * 1024 * 1024))

    cleanup_installer_tmp() {
        if [ "$keep_apk" = "true" ]; then
            printf 'keep_apk=%s\n' "$apk_file"
        else
            rm -rf "$tmp_dir"
        fi
    }
    trap cleanup_installer_tmp RETURN
    trap 'cleanup_installer_tmp; exit 130' INT TERM

    installer_step CHECKING_STORAGE START
    storage_result="$(installer_check_storage "$tmp_parent" "$max_mb")" || return 1
    installer_step CHECKING_STORAGE OK "$storage_result"

    installer_step DOWNLOADING START
    installer_download_to_part "$url" "$part_file" "$apk_file" "$max_bytes" || {
        echo "Error: failed to download APK" >&2
        return 1
    }
    installer_step DOWNLOADING OK

    installer_step VALIDATING_FILE START
    installer_validate_apk_file "$apk_file" "$max_mb" || return 1
    installer_step VALIDATING_FILE OK

    installer_step READING_METADATA START
    installer_read_apk_metadata "$apk_file" || return 1
    INSTALLER_PACKAGE="$INSTALLER_METADATA_PACKAGE"
    installer_step READING_METADATA OK "package=$INSTALLER_METADATA_PACKAGE versionCode=${INSTALLER_METADATA_VERSION_CODE:-unknown} versionName=${INSTALLER_METADATA_VERSION_NAME:-unknown} minSdk=${INSTALLER_METADATA_MIN_SDK:-unknown}"

    installer_step VERIFYING_PACKAGE START
    installer_validate_roblox_package "$INSTALLER_METADATA_PACKAGE" "$expected_package" "$allow_custom_package" || return 1
    installer_step VERIFYING_PACKAGE OK "$INSTALLER_METADATA_PACKAGE"

    installer_step VERIFYING_HASH START
    actual_sha="$(installer_sha256 "$apk_file")" || return 1
    INSTALLER_SHA256="$actual_sha"
    if [ -n "$expected_sha" ] && [ "$actual_sha" != "$expected_sha" ]; then
        echo "Error: SHA256 mismatch: expected $expected_sha got $actual_sha" >&2
        return 1
    fi
    installer_step VERIFYING_HASH OK "$actual_sha"

    installer_step VERIFYING_SIGNATURE START
    signature_status="$(installer_verify_signature_if_available "$apk_file")" || return 1
    case "$signature_status" in
        signature=unavailable) installer_step VERIFYING_SIGNATURE WARN "Signature verification unavailable" ;;
        *) installer_step VERIFYING_SIGNATURE OK "$signature_status" ;;
    esac

    installer_step CHECKING_INSTALLED_VERSION START
    if installer_load_installed_version "$INSTALLER_METADATA_PACKAGE"; then
        INSTALLER_VERSION_ACTION="$(installer_compare_versions "$INSTALLER_INSTALLED_VERSION_CODE" "$INSTALLER_METADATA_VERSION_CODE")"
        installer_step CHECKING_INSTALLED_VERSION OK "installedCode=${INSTALLER_INSTALLED_VERSION_CODE:-unknown} installedName=${INSTALLER_INSTALLED_VERSION_NAME:-unknown} action=$INSTALLER_VERSION_ACTION"
    else
        INSTALLER_VERSION_ACTION="NEW_INSTALL"
        installer_step CHECKING_INSTALLED_VERSION OK "action=NEW_INSTALL"
    fi

    case "$INSTALLER_VERSION_ACTION" in
        DOWNGRADE)
            if [ "$allow_downgrade" != "true" ]; then
                echo "Error: downgrade detected; use --allow-downgrade only if you intentionally want this and your install mode supports it" >&2
                return 1
            fi
            ;;
        SAME_VERSION)
            if [ "$yes" != "true" ] && [ "$dry_run" != "true" ]; then
                echo "Error: same version detected; rerun with --yes to reinstall deterministically" >&2
                return 1
            fi
            ;;
    esac

    installer_step INSTALLING START
    if [ "$dry_run" = "true" ]; then
        installer_step INSTALLING SKIPPED "dry-run"
        installer_step VERIFYING_INSTALLATION SKIPPED "dry-run"
        installer_step CLEANUP START
        installer_step CLEANUP OK
        installer_step SUCCESS OK "dry-run completed"
        return 0
    fi

    install_output="$(android_install_apk "$apk_file" "$allow_downgrade" 2>&1)" || {
        installer_explain_install_failure "$install_output" >&2
        return 1
    }
    installer_step INSTALLING OK

    installer_step VERIFYING_INSTALLATION START
    android_package_exists "$INSTALLER_METADATA_PACKAGE" || {
        echo "Error: APK install verification failed for $INSTALLER_METADATA_PACKAGE" >&2
        return 1
    }
    installer_load_installed_version "$INSTALLER_METADATA_PACKAGE" || true
    if [ -n "$INSTALLER_METADATA_VERSION_CODE" ] && [ -n "$INSTALLER_INSTALLED_VERSION_CODE" ] && [ "$INSTALLER_METADATA_VERSION_CODE" != "$INSTALLER_INSTALLED_VERSION_CODE" ]; then
        echo "Error: post-install version mismatch: expected $INSTALLER_METADATA_VERSION_CODE got $INSTALLER_INSTALLED_VERSION_CODE" >&2
        return 1
    fi
    installer_step VERIFYING_INSTALLATION OK "versionCode=${INSTALLER_INSTALLED_VERSION_CODE:-unknown}"

    installer_step CLEANUP START
    installer_step CLEANUP OK
    installer_step SUCCESS OK "Roblox installed successfully"
}
