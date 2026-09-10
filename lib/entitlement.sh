#!/usr/bin/env bash

# Central license entitlement enforcement. The client remains a convenience
# gate; the backend remains the security authority.

ENTITLEMENT_ADMISSION_LOCK_PATH=""
ENTITLEMENT_ADMISSION_LOCK_METHOD=""
ENTITLEMENT_ADMISSION_LOCK_FD=""
ENTITLEMENT_DISCORD_WARNED="${ENTITLEMENT_DISCORD_WARNED:-false}"
ENTITLEMENT_LAST_ERROR_CODE=""
ENTITLEMENT_LAST_ERROR_MESSAGE=""

entitlement_mode() {
    printf '%s\n' "${AUTO_REJOIN_LICENSE_MODE:-${LICENSE_MODE:-optional}}"
}

entitlement_is_protected_command() {
    case "$1" in
        help|version|license|doctor|parse-link) return 0 ;;
        *) return 1 ;;
    esac
}

entitlement_load_or_allow_optional() {
    local mode
    mode="$(entitlement_mode)"
    case "$mode" in
        disabled) return 0 ;;
        optional)
            license_load_cache >/dev/null 2>&1 || return 0
            return 0
            ;;
        required)
            license_load_cache >/dev/null 2>&1 || {
                ENTITLEMENT_LAST_ERROR_CODE="NO_LICENSE"
                ENTITLEMENT_LAST_ERROR_MESSAGE="A valid license is required."
                return 1
            }
            [ "$LICENSE_STATUS" = "VALID" ] || {
                ENTITLEMENT_LAST_ERROR_CODE="$LICENSE_STATUS"
                ENTITLEMENT_LAST_ERROR_MESSAGE="A valid license is required."
                return 1
            }
            return 0
            ;;
        *)
            ENTITLEMENT_LAST_ERROR_CODE="INVALID_MODE"
            ENTITLEMENT_LAST_ERROR_MESSAGE="Invalid LICENSE_MODE: $mode"
            return 1
            ;;
    esac
}

entitlement_refresh_if_needed() {
    local mode code
    mode="$(entitlement_mode)"
    [ "$mode" = "disabled" ] && return 0
    license_load_cache >/dev/null 2>&1 || {
        [ "$mode" = "optional" ] && return 0
        ENTITLEMENT_LAST_ERROR_CODE="NO_LICENSE"
        ENTITLEMENT_LAST_ERROR_MESSAGE="A valid license is required."
        return 1
    }
    license_should_revalidate || return 0
    if license_validate "${SCRIPT_DIR:-$(pwd)}" >/dev/null 2>&1; then
        return 0
    fi
    code="${LICENSE_ERROR_CODE:-SERVER_ERROR}"
    case "$code" in
        NETWORK_ERROR|SERVER_ERROR|MALFORMED_RESPONSE|"")
            if [ "${LICENSE_MAINTENANCE_ENABLED:-false}" = "true" ] && [ "${LICENSE_MAINTENANCE_ALLOW_CACHE:-false}" != "true" ]; then
                ENTITLEMENT_LAST_ERROR_CODE="MAINTENANCE"
                ENTITLEMENT_LAST_ERROR_MESSAGE="${LICENSE_MAINTENANCE_MESSAGE:-License service maintenance.}"
                [ "$mode" = "optional" ] && return 0
                return 1
            fi
            if license_offline_grace_valid; then
                ENTITLEMENT_LAST_ERROR_CODE="OFFLINE_GRACE"
                ENTITLEMENT_LAST_ERROR_MESSAGE="License server unavailable; using offline grace."
                return 0
            fi
            ENTITLEMENT_LAST_ERROR_CODE="$code"
            ENTITLEMENT_LAST_ERROR_MESSAGE="License validation failed and offline grace is unavailable."
            [ "$mode" = "optional" ] && return 0
            return 1
            ;;
        *)
            ENTITLEMENT_LAST_ERROR_CODE="$code"
            ENTITLEMENT_LAST_ERROR_MESSAGE="${LICENSE_ERROR_MESSAGE:-License validation failed.}"
            [ "$mode" = "optional" ] && return 0
            return 1
            ;;
    esac
}

entitlement_print_license_required() {
    cat >&2 <<'EOF'
A valid license is required to start Auto Rejoin Pro.

Run:
roblox-manager license activate <KEY>
EOF
}

entitlement_require_license() {
    local mode
    mode="$(entitlement_mode)"
    [ "$mode" = "disabled" ] && return 0
    entitlement_refresh_if_needed || {
        [ "$mode" = "optional" ] && return 0
        entitlement_print_license_required
        return 1
    }
    entitlement_load_or_allow_optional || {
        [ "$mode" = "optional" ] && return 0
        entitlement_print_license_required
        return 1
    }
}

entitlement_check_feature() {
    local feature="$1"
    local mode
    mode="$(entitlement_mode)"
    [ "$mode" = "disabled" ] && return 0
    entitlement_refresh_if_needed || {
        [ "$mode" = "optional" ] && return 0
        return 1
    }
    license_has_feature "$feature" >/dev/null 2>&1
}

entitlement_require_feature() {
    local feature="$1"
    local label="${2:-$feature}"
    local mode plan
    mode="$(entitlement_mode)"
    [ "$mode" = "disabled" ] && return 0
    if entitlement_check_feature "$feature"; then
        return 0
    fi
    [ "$mode" = "optional" ] && return 0
    case "$ENTITLEMENT_LAST_ERROR_CODE" in
        NO_LICENSE|MISSING_JQ|INVALID_TOKEN|TOKEN_EXPIRED|INSTALLATION_MISMATCH|REVOKED|EXPIRED|SUSPENDED)
            entitlement_print_license_required
            return 1
            ;;
    esac
    plan="$(license_get_plan 2>/dev/null || printf 'unknown')"
    {
        printf 'This license does not include the %s feature.\n\n' "$label"
        printf 'Plan: %s\n' "$plan"
        printf 'Required feature: %s\n' "$feature"
    } >&2
    return 1
}

entitlement_get_max_instances() {
    local mode max
    mode="$(entitlement_mode)"
    [ "$mode" = "disabled" ] && { printf '999999\n'; return 0; }
    max="$(license_get_max_instances 2>/dev/null || printf '1')"
    [[ "$max" =~ ^[0-9]+$ ]] || max=1
    [ "$max" -ge 1 ] || max=1
    printf '%s\n' "$max"
}

entitlement_count_active_instances() {
    local tmp_dir="$1"
    local locks_dir="${tmp_dir%/}/locks"
    local entry pid count=0
    [ -d "$locks_dir" ] || { printf '0\n'; return 0; }
    for entry in "$locks_dir"/*.lock "$locks_dir"/*.lockdir; do
        [ -e "$entry" ] || continue
        case "${entry##*/}" in license-instance-admission*) continue ;; esac
        pid=""
        if [ -d "$entry" ] && [ -f "$entry/pid" ]; then
            pid="$(tr -cd '0-9' < "$entry/pid" 2>/dev/null)"
        elif [ -f "$entry" ]; then
            pid="$(grep '^pid=' "$entry" 2>/dev/null | head -1 | cut -d= -f2 | tr -cd '0-9')"
        fi
        if [ -n "$pid" ] && runtime_pid_is_alive "$pid"; then
            count=$((count + 1))
        fi
    done
    printf '%s\n' "$count"
}

entitlement_admission_lock_acquire() {
    local tmp_dir="$1"
    local locks_dir="${tmp_dir%/}/locks"
    mkdir -p "$locks_dir" || return 1
    if command -v flock >/dev/null 2>&1 && [ "${RUNTIME_LOCK_USE_FLOCK:-true}" != "false" ]; then
        ENTITLEMENT_ADMISSION_LOCK_PATH="${locks_dir}/license-instance-admission.lock"
        exec {ENTITLEMENT_ADMISSION_LOCK_FD}>"$ENTITLEMENT_ADMISSION_LOCK_PATH"
        flock -n "$ENTITLEMENT_ADMISSION_LOCK_FD" 2>/dev/null || return 1
        ENTITLEMENT_ADMISSION_LOCK_METHOD="flock"
        return 0
    fi
    ENTITLEMENT_ADMISSION_LOCK_PATH="${locks_dir}/license-instance-admission.lockdir"
    if mkdir "$ENTITLEMENT_ADMISSION_LOCK_PATH" 2>/dev/null; then
        ENTITLEMENT_ADMISSION_LOCK_METHOD="mkdir"
        printf '%s\n' "$$" > "${ENTITLEMENT_ADMISSION_LOCK_PATH}/pid"
        return 0
    fi
    return 1
}

entitlement_admission_lock_release() {
    case "$ENTITLEMENT_ADMISSION_LOCK_METHOD" in
        flock)
            flock -u "$ENTITLEMENT_ADMISSION_LOCK_FD" 2>/dev/null || true
            exec {ENTITLEMENT_ADMISSION_LOCK_FD}>&-
            ;;
        mkdir)
            rm -rf "$ENTITLEMENT_ADMISSION_LOCK_PATH" 2>/dev/null || true
            ;;
    esac
    ENTITLEMENT_ADMISSION_LOCK_PATH=""
    ENTITLEMENT_ADMISSION_LOCK_METHOD=""
    ENTITLEMENT_ADMISSION_LOCK_FD=""
}

entitlement_check_instance_limit() {
    local tmp_dir="$1"
    local max active
    max="$(entitlement_get_max_instances)"
    active="$(entitlement_count_active_instances "$tmp_dir")"
    if [ "$active" -lt "$max" ]; then
        return 0
    fi
    ENTITLEMENT_LAST_ERROR_CODE="INSTANCE_LIMIT"
    ENTITLEMENT_LAST_ERROR_MESSAGE="Max instance limit reached (${active}/${max})."
    printf 'Max instance limit reached: %s/%s active.\n' "$active" "$max" >&2
    return 1
}

entitlement_admit_instance() {
    local tmp_dir="$1"
    local package="$2"
    local log_file="${3:-${LOG_FILE:-}}"
    entitlement_require_feature monitor Monitor || return 1
    entitlement_admission_lock_acquire "$tmp_dir" || {
        echo "Could not acquire license admission lock; try again." >&2
        return 1
    }
    if ! entitlement_check_instance_limit "$tmp_dir"; then
        entitlement_admission_lock_release
        return 1
    fi
    if ! runtime_lock_acquire "$tmp_dir" "$package" "$log_file"; then
        entitlement_admission_lock_release
        return 1
    fi
    entitlement_admission_lock_release
}

entitlement_discord_allowed() {
    entitlement_check_feature discord
}
