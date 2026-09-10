#!/usr/bin/env bash

RUNTIME_BACKOFF_INITIAL="${RUNTIME_BACKOFF_INITIAL:-5}"
RUNTIME_BACKOFF_MAX="${RUNTIME_BACKOFF_MAX:-60}"
RUNTIME_STABLE_RESET_SECONDS="${RUNTIME_STABLE_RESET_SECONDS:-60}"
RUNTIME_FAILURE_WINDOW_SECONDS="${RUNTIME_FAILURE_WINDOW_SECONDS:-600}"
RUNTIME_FAILURE_LIMIT="${RUNTIME_FAILURE_LIMIT:-10}"
RUNTIME_COOLDOWN_SECONDS="${RUNTIME_COOLDOWN_SECONDS:-300}"

RUNTIME_LOCK_PATH=""
RUNTIME_LOCK_METHOD=""
RUNTIME_LOCK_FD=""
RUNTIME_BACKOFF_FAILURES=0
RUNTIME_FAILURE_HISTORY=""
RUNTIME_COOLDOWN_UNTIL=0
RUNTIME_COOLDOWN_ACTIVE=0

runtime_now() {
    if [ -n "${RUNTIME_NOW:-}" ]; then
        printf '%s\n' "$RUNTIME_NOW"
    else
        date +%s
    fi
}

runtime_validate_package() {
    local package="$1"
    [[ "$package" =~ ^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$ ]]
}

runtime_package_key() {
    local package="$1"
    runtime_validate_package "$package" || return 1
    printf '%s\n' "${package//[^A-Za-z0-9_.-]/_}"
}

runtime_pid_is_alive() {
    local pid="$1"
    [[ "$pid" =~ ^[0-9]+$ ]] || return 1
    [ "$pid" -gt 0 ] || return 1
    kill -0 "$pid" 2>/dev/null
}

runtime_lock_metadata() {
    local target="$1"
    local package="$2"
    {
        printf 'pid=%s\n' "$$"
        printf 'package=%s\n' "$package"
        printf 'started_at=%s\n' "$(runtime_now)"
        printf 'script=%s\n' "${0##*/}"
    } > "$target"
}

runtime_lock_is_stale() {
    local lock_dir="$1"
    local pid=""

    [ -d "$lock_dir" ] || return 0
    if [ -f "${lock_dir}/pid" ]; then
        pid="$(tr -cd '0-9' < "${lock_dir}/pid" 2>/dev/null)"
    fi

    [ -n "$pid" ] || return 0
    runtime_pid_is_alive "$pid" && return 1
    return 0
}

runtime_lock_acquire() {
    local base_dir="$1"
    local package="$2"
    local log_file="${3:-${LOG_FILE:-}}"
    local key locks_dir lock_path pid

    key="$(runtime_package_key "$package")" || {
        log_event ERROR lock_invalid_package "$log_file" package "$package"
        return 2
    }

    locks_dir="${base_dir%/}/locks"
    mkdir -p "$locks_dir" 2>/dev/null || return 2

    if command -v flock >/dev/null 2>&1 && [ "${RUNTIME_LOCK_USE_FLOCK:-true}" != "false" ]; then
        lock_path="${locks_dir}/${key}.lock"
        exec {RUNTIME_LOCK_FD}>"$lock_path"
        if flock -n "$RUNTIME_LOCK_FD" 2>/dev/null; then
            RUNTIME_LOCK_PATH="$lock_path"
            RUNTIME_LOCK_METHOD="flock"
            runtime_lock_metadata "$lock_path" "$package"
            log_event INFO lock_acquired "$log_file" package "$package" method "$RUNTIME_LOCK_METHOD" path "$lock_path"
            return 0
        fi

        pid="$(grep '^pid=' "$lock_path" 2>/dev/null | head -1 | cut -d= -f2)"
        log_event WARN lock_denied "$log_file" package "$package" method flock pid "$pid" path "$lock_path"
        return 1
    fi

    lock_path="${locks_dir}/${key}.lockdir"
    if mkdir "$lock_path" 2>/dev/null; then
        RUNTIME_LOCK_PATH="$lock_path"
        RUNTIME_LOCK_METHOD="mkdir"
        runtime_lock_metadata "${lock_path}/meta" "$package"
        printf '%s\n' "$$" > "${lock_path}/pid"
        log_event INFO lock_acquired "$log_file" package "$package" method "$RUNTIME_LOCK_METHOD" path "$lock_path"
        return 0
    fi

    if runtime_lock_is_stale "$lock_path"; then
        rm -rf "$lock_path" 2>/dev/null || true
        log_event WARN lock_stale_recovered "$log_file" package "$package" method mkdir path "$lock_path"
        if mkdir "$lock_path" 2>/dev/null; then
            RUNTIME_LOCK_PATH="$lock_path"
            RUNTIME_LOCK_METHOD="mkdir"
            runtime_lock_metadata "${lock_path}/meta" "$package"
            printf '%s\n' "$$" > "${lock_path}/pid"
            log_event INFO lock_acquired "$log_file" package "$package" method "$RUNTIME_LOCK_METHOD" path "$lock_path"
            return 0
        fi
    fi

    pid=""
    [ -f "${lock_path}/pid" ] && pid="$(tr -cd '0-9' < "${lock_path}/pid" 2>/dev/null)"
    log_event WARN lock_denied "$log_file" package "$package" method mkdir pid "$pid" path "$lock_path"
    return 1
}

runtime_lock_release() {
    local log_file="${1:-${LOG_FILE:-}}"
    local package="${2:-${ROBLOX_PACKAGE:-}}"

    [ -n "$RUNTIME_LOCK_PATH" ] || return 0
    case "$RUNTIME_LOCK_METHOD" in
        flock)
            log_event INFO lock_released "$log_file" package "$package" method "$RUNTIME_LOCK_METHOD" path "$RUNTIME_LOCK_PATH"
            if [ -n "$RUNTIME_LOCK_FD" ]; then
                flock -u "$RUNTIME_LOCK_FD" 2>/dev/null || true
                exec {RUNTIME_LOCK_FD}>&-
            fi
            ;;
        mkdir)
            log_event INFO lock_released "$log_file" package "$package" method "$RUNTIME_LOCK_METHOD" path "$RUNTIME_LOCK_PATH"
            rm -rf "$RUNTIME_LOCK_PATH" 2>/dev/null || true
            ;;
    esac
    RUNTIME_LOCK_PATH=""
    RUNTIME_LOCK_METHOD=""
    RUNTIME_LOCK_FD=""
}

runtime_backoff_reset() {
    RUNTIME_BACKOFF_FAILURES=0
}

runtime_backoff_next() {
    local failure_count="${1:-$((RUNTIME_BACKOFF_FAILURES + 1))}"
    local delay="$RUNTIME_BACKOFF_INITIAL"
    local i=1

    while [ "$i" -lt "$failure_count" ]; do
        delay=$((delay * 2))
        i=$((i + 1))
    done
    [ "$delay" -gt "$RUNTIME_BACKOFF_MAX" ] && delay="$RUNTIME_BACKOFF_MAX"
    printf '%s\n' "$delay"
}

runtime_failure_prune() {
    local now="${1:-$(runtime_now)}"
    local pruned="" ts

    for ts in $RUNTIME_FAILURE_HISTORY; do
        if [ $((now - ts)) -le "$RUNTIME_FAILURE_WINDOW_SECONDS" ]; then
            pruned="${pruned}${pruned:+ }${ts}"
        fi
    done
    RUNTIME_FAILURE_HISTORY="$pruned"
}

runtime_failure_record() {
    local now="${1:-$(runtime_now)}"
    runtime_failure_prune "$now"
    RUNTIME_FAILURE_HISTORY="${RUNTIME_FAILURE_HISTORY}${RUNTIME_FAILURE_HISTORY:+ }${now}"
    RUNTIME_BACKOFF_FAILURES=$((RUNTIME_BACKOFF_FAILURES + 1))
}

runtime_failure_count() {
    local now="${1:-$(runtime_now)}"
    runtime_failure_prune "$now"
    set -- $RUNTIME_FAILURE_HISTORY
    printf '%s\n' "$#"
}

runtime_failure_reset() {
    RUNTIME_FAILURE_HISTORY=""
    RUNTIME_BACKOFF_FAILURES=0
}

runtime_should_cooldown() {
    local now="${1:-$(runtime_now)}"
    local count
    runtime_failure_prune "$now"
    set -- $RUNTIME_FAILURE_HISTORY
    count="$#"
    [ "$count" -ge "$RUNTIME_FAILURE_LIMIT" ]
}

runtime_cooldown_start() {
    local now="${1:-$(runtime_now)}"
    RUNTIME_COOLDOWN_UNTIL=$((now + RUNTIME_COOLDOWN_SECONDS))
    RUNTIME_COOLDOWN_ACTIVE=1
}

runtime_cooldown_remaining() {
    local now="${1:-$(runtime_now)}"
    local remaining=$((RUNTIME_COOLDOWN_UNTIL - now))
    [ "$remaining" -gt 0 ] || remaining=0
    printf '%s\n' "$remaining"
}

runtime_cooldown_is_active() {
    local now="${1:-$(runtime_now)}"
    [ "${RUNTIME_COOLDOWN_ACTIVE:-0}" -eq 1 ] && [ "$now" -lt "${RUNTIME_COOLDOWN_UNTIL:-0}" ]
}

runtime_cooldown_reset() {
    RUNTIME_COOLDOWN_UNTIL=0
    RUNTIME_COOLDOWN_ACTIVE=0
}
