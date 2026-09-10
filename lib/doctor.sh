#!/usr/bin/env bash

# Environment and project diagnostics for roblox-manager.

DOCTOR_PASS=0
DOCTOR_WARN=0
DOCTOR_FAIL=0
DOCTOR_RESULTS=""

doctor_reset() {
    DOCTOR_PASS=0
    DOCTOR_WARN=0
    DOCTOR_FAIL=0
    DOCTOR_RESULTS=""
}

doctor_add_result() {
    local status="$1"
    local name="$2"
    local detail="$3"

    case "$status" in
        PASS) DOCTOR_PASS=$((DOCTOR_PASS + 1)) ;;
        WARN) DOCTOR_WARN=$((DOCTOR_WARN + 1)) ;;
        FAIL) DOCTOR_FAIL=$((DOCTOR_FAIL + 1)) ;;
        *) status="FAIL"; DOCTOR_FAIL=$((DOCTOR_FAIL + 1)) ;;
    esac

    if [ -n "$DOCTOR_RESULTS" ]; then
        DOCTOR_RESULTS="${DOCTOR_RESULTS}
${status}|${name}|${detail}"
    else
        DOCTOR_RESULTS="${status}|${name}|${detail}"
    fi
}

doctor_has_command() {
    command -v "$1" >/dev/null 2>&1
}

doctor_check_command() {
    local command_name="$1"
    local required="${2:-false}"

    if doctor_has_command "$command_name"; then
        doctor_add_result PASS "command:${command_name}" "available"
    elif [ "$required" = "true" ]; then
        doctor_add_result FAIL "command:${command_name}" "missing required command"
    else
        doctor_add_result WARN "command:${command_name}" "missing optional command"
    fi
}

doctor_check_project_files() {
    local project_dir="$1"
    local file

    for file in auto_rejoin.sh setup.sh lib/config.sh lib/android.sh lib/network.sh lib/logger.sh lib/runtime.sh lib/notification.sh lib/monitor.sh lib/roblox.sh lib/doctor.sh lib/ui.sh lib/profile.sh lib/installer.sh lib/updater.sh bin/roblox-manager VERSION; do
        if [ -f "${project_dir}/${file}" ]; then
            doctor_add_result PASS "file:${file}" "present"
        else
            doctor_add_result FAIL "file:${file}" "missing"
        fi
    done
}

doctor_check_command_any() {
    local name="$1"
    shift
    local command_name found=""

    for command_name in "$@"; do
        if doctor_has_command "$command_name"; then
            found="$command_name"
            break
        fi
    done

    if [ -n "$found" ]; then
        doctor_add_result PASS "$name" "available: $found"
    else
        doctor_add_result WARN "$name" "none available"
    fi
}

doctor_check_tmp_storage() {
    local project_dir="$1"
    local tmp_dir="${project_dir}/tmp"
    local free_bytes=""

    mkdir -p "$tmp_dir" 2>/dev/null || {
        doctor_add_result FAIL "storage:tmp" "not writable: $tmp_dir"
        return 0
    }
    if [ -w "$tmp_dir" ]; then
        if command -v df >/dev/null 2>&1; then
            free_bytes="$(df -Pk "$tmp_dir" 2>/dev/null | awk 'NR==2 {print $4 * 1024}')"
        fi
        if [ -n "$free_bytes" ]; then
            doctor_add_result PASS "storage:tmp" "writable, free_bytes=$free_bytes"
        else
            doctor_add_result PASS "storage:tmp" "writable"
        fi
    else
        doctor_add_result FAIL "storage:tmp" "not writable: $tmp_dir"
    fi
}

doctor_check_update() {
    local project_dir="$1"
    local manifest_url="${AUTO_REJOIN_UPDATE_MANIFEST_URL:-}"
    local public_key="${AUTO_REJOIN_UPDATE_PUBLIC_KEY_FILE:-${project_dir}/keys/update-public.pem}"
    local update_tmp="${project_dir}/tmp/update"

    if command -v jq >/dev/null 2>&1; then
        doctor_add_result PASS "update:jq" "available"
    else
        doctor_add_result FAIL "update:jq" "required for signed manifest parsing"
    fi

    if command -v openssl >/dev/null 2>&1; then
        doctor_add_result PASS "update:signature_verifier" "openssl available"
    else
        doctor_add_result FAIL "update:signature_verifier" "openssl required"
    fi

    if command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1; then
        doctor_add_result PASS "update:sha256" "available"
    else
        doctor_add_result FAIL "update:sha256" "sha256sum or shasum required"
    fi

    if command -v tar >/dev/null 2>&1; then
        doctor_add_result PASS "update:tar" "available"
    else
        doctor_add_result FAIL "update:tar" "required for release archive extraction"
    fi

    if [ -f "$public_key" ]; then
        doctor_add_result PASS "update:public_key" "present"
    else
        doctor_add_result FAIL "update:public_key" "missing: $public_key"
    fi

    if [ -n "$manifest_url" ]; then
        case "$manifest_url" in
            https://*) doctor_add_result PASS "update:manifest_url" "HTTPS configured" ;;
            http://*)
                if [ "${AUTO_REJOIN_UPDATE_ALLOW_HTTP_DEV:-false}" = "true" ]; then
                    doctor_add_result WARN "update:manifest_url" "HTTP dev override enabled"
                else
                    doctor_add_result FAIL "update:manifest_url" "HTTP rejected without dev override"
                fi
                ;;
            *) doctor_add_result FAIL "update:manifest_url" "unsupported URL scheme" ;;
        esac
    else
        doctor_add_result WARN "update:manifest_url" "not configured"
    fi

    mkdir -p "$update_tmp" 2>/dev/null || {
        doctor_add_result FAIL "update:storage" "not writable: $update_tmp"
        return 0
    }
    if [ -w "$update_tmp" ]; then
        doctor_add_result PASS "update:storage" "writable"
    else
        doctor_add_result FAIL "update:storage" "not writable: $update_tmp"
    fi
}

doctor_check_license() {
    local mode="${LICENSE_MODE:-optional}"
    local api="${AUTO_REJOIN_LICENSE_API:-}"

    doctor_add_result PASS "license:mode" "$mode"
    if [ -n "$api" ]; then
        case "$api" in
            https://*) doctor_add_result PASS "license:api" "HTTPS configured" ;;
            http://*)
                if [ "${AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV:-false}" = "true" ]; then
                    doctor_add_result WARN "license:api" "HTTP dev override enabled"
                else
                    doctor_add_result FAIL "license:api" "HTTP rejected without dev override"
                fi
                ;;
            *) doctor_add_result FAIL "license:api" "unsupported URL scheme" ;;
        esac
    else
        doctor_add_result WARN "license:api" "not configured"
    fi

    if command -v jq >/dev/null 2>&1; then
        doctor_add_result PASS "license:jq" "available"
    else
        doctor_add_result WARN "license:jq" "required for license commands"
    fi

    if declare -F license_get_installation_id >/dev/null 2>&1; then
        if license_get_installation_id >/dev/null 2>&1; then
            doctor_add_result PASS "license:installation_id" "available"
        else
            doctor_add_result WARN "license:installation_id" "could not create/read"
        fi
        if license_load_cache >/dev/null 2>&1; then
            doctor_add_result PASS "license:cache" "readable"
            doctor_add_result PASS "license:activation_state" "${LICENSE_STATUS:-unknown}"
            doctor_add_result PASS "license:plan" "${LICENSE_PLAN:-unknown}"
            doctor_add_result PASS "license:max_instances" "${LICENSE_MAX_INSTANCES:-unknown}"
            doctor_add_result PASS "license:features" "${LICENSE_FEATURES:-none}"
            doctor_add_result PASS "license:last_validation" "${LICENSE_LAST_VALIDATED_AT:-0}"
            if license_offline_grace_valid; then
                doctor_add_result PASS "license:offline_grace" "available"
            else
                doctor_add_result WARN "license:offline_grace" "unavailable"
            fi
        else
            doctor_add_result WARN "license:cache" "not activated"
            doctor_add_result WARN "license:activation_state" "NOT_ACTIVATED"
            doctor_add_result WARN "license:offline_grace" "unavailable"
        fi
    else
        doctor_add_result WARN "license:installation_id" "license module not loaded"
    fi
}

doctor_check_root_adb_pm() {
    if command -v su >/dev/null 2>&1; then
        doctor_add_result PASS "android:root_command" "su available"
    else
        doctor_add_result WARN "android:root_command" "su missing"
    fi

    if command -v adb >/dev/null 2>&1; then
        doctor_add_result PASS "android:adb_command" "adb available"
    else
        doctor_add_result WARN "android:adb_command" "adb missing"
    fi

    if command -v pm >/dev/null 2>&1; then
        doctor_add_result PASS "android:pm_command" "pm available"
    elif command -v adb >/dev/null 2>&1; then
        doctor_add_result WARN "android:pm_command" "pm not local; adb may provide package manager"
    else
        doctor_add_result WARN "android:pm_command" "pm missing"
    fi
}

doctor_check_config_file() {
    local config_file="$1"

    if [ ! -f "$config_file" ]; then
        doctor_add_result WARN "config" "not found; setup wizard can create it"
        return 0
    fi

    if declare -F config_load >/dev/null 2>&1; then
        if config_load "$config_file"; then
            doctor_add_result PASS "config" "parsed successfully"
        else
            doctor_add_result WARN "config" "parsed with defaults for invalid values"
        fi
    else
        doctor_add_result WARN "config" "config loader not available"
    fi
}

doctor_check_network() {
    if [ "${DOCTOR_SKIP_NETWORK:-false}" = "true" ]; then
        doctor_add_result WARN "network" "skipped"
        return 0
    fi

    if declare -F network_is_online >/dev/null 2>&1 && network_is_online; then
        doctor_add_result PASS "network" "online"
    else
        doctor_add_result WARN "network" "offline or blocked"
    fi
}

doctor_check_android() {
    local executor="direct"
    local packages=""
    local count=0

    if declare -F android_detect_executor >/dev/null 2>&1; then
        executor="$(android_detect_executor)"
        android_set_executor "$executor"
    fi

    case "$executor" in
        su|adb)
            doctor_add_result PASS "android:executor" "$executor"
            ;;
        direct)
            doctor_add_result WARN "android:executor" "direct mode; ROOT/ADB not detected"
            ;;
        *)
            doctor_add_result FAIL "android:executor" "unknown executor: $executor"
            ;;
    esac

    if declare -F android_list_packages >/dev/null 2>&1; then
        packages="$(android_list_packages 2>/dev/null | grep -i 'roblox' | cut -d: -f2 | tr -d '\r' | sort -u || true)"
        if [ -n "$packages" ]; then
            count=$(printf '%s\n' "$packages" | sed '/^$/d' | wc -l | tr -d ' ')
            doctor_add_result PASS "android:roblox_packages" "${count} found"
        else
            doctor_add_result WARN "android:roblox_packages" "none detected"
        fi
    else
        doctor_add_result WARN "android:roblox_packages" "android layer not available"
    fi
}

doctor_print_text() {
    local line status name detail

    printf 'AUTO REJOIN PRO - DOCTOR\n'
    while IFS= read -r line || [ -n "$line" ]; do
        [ -n "$line" ] || continue
        status="${line%%|*}"
        name="${line#*|}"
        detail="${name#*|}"
        name="${name%%|*}"
        printf '[%s] %s - %s\n' "$status" "$name" "$detail"
    done <<EOF
$DOCTOR_RESULTS
EOF
    printf '\nSummary\n'
    printf 'PASS: %s\nWARN: %s\nFAIL: %s\n' "$DOCTOR_PASS" "$DOCTOR_WARN" "$DOCTOR_FAIL"
}

doctor_print_env() {
    local line status name detail safe_name

    printf 'DOCTOR_PASS=%s\n' "$DOCTOR_PASS"
    printf 'DOCTOR_WARN=%s\n' "$DOCTOR_WARN"
    printf 'DOCTOR_FAIL=%s\n' "$DOCTOR_FAIL"
    while IFS= read -r line || [ -n "$line" ]; do
        [ -n "$line" ] || continue
        status="${line%%|*}"
        name="${line#*|}"
        detail="${name#*|}"
        name="${name%%|*}"
        safe_name="$(printf '%s' "$name" | tr '[:lower:]:./-' '[:upper:]____' | tr -cd 'A-Z0-9_')"
        printf 'DOCTOR_%s_STATUS=%s\n' "$safe_name" "$status"
        printf 'DOCTOR_%s_DETAIL=%s\n' "$safe_name" "$detail"
    done <<EOF
$DOCTOR_RESULTS
EOF
}

doctor_run() {
    local project_dir="$1"
    local config_file="${2:-${project_dir}/config.env}"
    local format="${3:-text}"

    doctor_reset
    doctor_check_command bash true
    doctor_check_command curl true
    doctor_check_command ping false
    doctor_check_command jq false
    doctor_check_command tmux false
    doctor_check_command sha256sum false
    doctor_check_command shellcheck false
    doctor_check_command flock false
    doctor_check_command_any "installer:metadata_tool" aapt aapt2 apkanalyzer
    doctor_check_command_any "installer:signature_tool" apksigner jarsigner
    doctor_check_root_adb_pm
    doctor_check_project_files "$project_dir"
    doctor_check_tmp_storage "$project_dir"
    doctor_check_update "$project_dir"
    doctor_check_config_file "$config_file"
    doctor_check_license
    doctor_check_network
    doctor_check_android

    case "$format" in
        env) doctor_print_env ;;
        text|"") doctor_print_text ;;
        *) doctor_print_text ;;
    esac

    [ "$DOCTOR_FAIL" -eq 0 ]
}

doctor_redact_string() {
    local text="$1"
    # Redact discord webhooks
    text="$(printf '%s' "$text" | sed -E 's|https://discord(app)?\.com/api/webhooks/[0-9]+/[A-Za-z0-9_-]+|https://discord.com/api/webhooks/[REDACTED_WEBHOOK]|g')"
    # Redact raw license keys
    text="$(printf '%s' "$text" | sed -E 's|AR-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|AR-XXXX-XXXX-XXXX-XXXX|g')"
    # Redact JWT/bearer tokens
    text="$(printf '%s' "$text" | sed -E 's|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|[REDACTED_JWT]|g')"
    printf '%s' "$text"
}

doctor_generate_support_bundle() {
    local project_dir="$1"
    local output_file="${2:-}"
    local tmp_dir="${project_dir}/tmp"
    mkdir -p "$tmp_dir" 2>/dev/null || true

    if [ -z "$output_file" ]; then
        local ts
        ts="$(date '+%Y%m%d_%H%M%S' 2>/dev/null || date '+%s')"
        output_file="${tmp_dir}/support-bundle-${ts}.tar.gz"
    fi

    local bundle_work
    bundle_work="$(mktemp -d "${tmp_dir}/support-bundle.XXXXXX" 2>/dev/null || mktemp -d 2>/dev/null || echo "${tmp_dir}/bundle_$$")"
    mkdir -p "$bundle_work"

    cleanup_bundle() {
        rm -rf "$bundle_work" 2>/dev/null || true
    }
    trap cleanup_bundle EXIT

    # 1. Version
    if [ -f "${project_dir}/VERSION" ]; then
        cp "${project_dir}/VERSION" "${bundle_work}/VERSION.txt"
    else
        printf 'unknown\n' > "${bundle_work}/VERSION.txt"
    fi

    # 2. Doctor Diagnostics
    doctor_run "$project_dir" "${project_dir}/config.env" "text" > "${bundle_work}/doctor.txt" 2>&1 || true

    # 3. System Environment
    {
        printf 'Date: %s\n' "$(date -u '+%Y-%m-%d %H:%M:%S UTC' 2>/dev/null || date)"
        printf 'Uname: %s\n' "$(uname -a 2>/dev/null || echo 'unavailable')"
        printf 'Bash Version: %s\n' "${BASH_VERSION:-unknown}"
        if [ -n "${TERMUX_VERSION:-}" ]; then
            printf 'Termux Version: %s\n' "$TERMUX_VERSION"
        fi
        if declare -F android_detect_executor >/dev/null 2>&1; then
            printf 'Detected Executor: %s\n' "$(android_detect_executor 2>/dev/null || echo 'unknown')"
        fi
    } > "${bundle_work}/environment.txt"

    # 4. Redacted Config
    if [ -f "${project_dir}/config.env" ]; then
        while IFS= read -r line || [ -n "$line" ]; do
            case "$line" in
                DISCORD_WEBHOOK=*)
                    printf 'DISCORD_WEBHOOK="https://discord.com/api/webhooks/[REDACTED]"\n'
                    ;;
                *PASSWORD*|*SECRET*|*TOKEN*)
                    key="${line%%=*}"
                    printf '%s="[REDACTED]"\n' "$key"
                    ;;
                *)
                    doctor_redact_string "$line"
                    printf '\n'
                    ;;
            esac
        done < "${project_dir}/config.env" > "${bundle_work}/config_redacted.txt"
    fi

    # 5. Redacted License Info
    {
        printf 'License Mode: %s\n' "${LICENSE_MODE:-optional}"
        printf 'License API: %s\n' "${AUTO_REJOIN_LICENSE_API:-not_configured}"
        if declare -F license_get_installation_id >/dev/null 2>&1; then
            local raw_inst
            raw_inst="$(license_get_installation_id 2>/dev/null || echo '')"
            if [ -n "$raw_inst" ] && [ "${#raw_inst}" -ge 8 ]; then
                printf 'Installation ID: %s****%s\n' "${raw_inst:0:4}" "${raw_inst: -4}"
            else
                printf 'Installation ID: [NONE]\n'
            fi
        fi
        if declare -F license_load_cache >/dev/null 2>&1 && license_load_cache >/dev/null 2>&1; then
            printf 'License Status: %s\n' "${LICENSE_STATUS:-unknown}"
            printf 'Plan: %s\n' "${LICENSE_PLAN:-unknown}"
            printf 'Max Instances: %s\n' "${LICENSE_MAX_INSTANCES:-unknown}"
            printf 'Features: %s\n' "${LICENSE_FEATURES:-none}"
            printf 'Offline Grace: %s\n' "$(license_offline_grace_valid && echo 'available' || echo 'unavailable')"
        fi
    } > "${bundle_work}/license_summary.txt"

    # 6. Recent Sanitized Logs
    if [ -f "${project_dir}/logs/roblox.log" ]; then
        tail -n 200 "${project_dir}/logs/roblox.log" | while IFS= read -r log_line || [ -n "$log_line" ]; do
            doctor_redact_string "$log_line"
            printf '\n'
        done > "${bundle_work}/recent_logs.txt"
    fi

    # 7. Package into tar.gz
    tar -czf "$output_file" -C "$bundle_work" . 2>/dev/null || {
        echo "Error: failed to create support bundle tar archive" >&2
        return 1
    }

    cleanup_bundle
    trap - EXIT
    printf '%s\n' "$output_file"
}

