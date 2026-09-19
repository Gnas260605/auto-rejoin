#!/usr/bin/env bash

# Android command transport for ROOT / ADB / DIRECT modes.
# Most Android actions should use typed wrappers below instead of shell strings.

ANDROID_EXECUTOR="${ANDROID_EXECUTOR:-}"

android_with_timeout() {
    local secs="$1"
    shift
    if declare -F run_with_timeout >/dev/null 2>&1; then
        run_with_timeout "$secs" "$@"
    elif command -v timeout >/dev/null 2>&1; then
        timeout "$secs" "$@"
    else
        "$@"
    fi
}

export PATH="${PATH:-}:/system/bin:/system/xbin:/sbin:/vendor/bin"

android_detect_executor() {
    export PATH="${PATH:-}:/system/bin:/system/xbin:/sbin:/vendor/bin"
    if command -v su >/dev/null 2>&1 && android_with_timeout 3 su -c id >/dev/null 2>&1; then
        echo "su"
    elif [ -x /system/xbin/su ] && android_with_timeout 3 /system/xbin/su -c id >/dev/null 2>&1; then
        echo "su"
    elif [ -x /system/bin/su ] && android_with_timeout 3 /system/bin/su -c id >/dev/null 2>&1; then
        echo "su"
    elif command -v tsu >/dev/null 2>&1 && android_with_timeout 3 tsu -c id >/dev/null 2>&1; then
        echo "su"
    elif command -v adb >/dev/null 2>&1 && android_with_timeout 3 adb shell id >/dev/null 2>&1; then
        echo "adb"
    else
        echo "direct"
    fi
}

android_set_executor() {
    ANDROID_EXECUTOR="$1"
}

android_get_executor() {
    if [ -n "$ANDROID_EXECUTOR" ]; then
        echo "$ANDROID_EXECUTOR"
    elif [ -n "${EXECUTOR:-}" ]; then
        echo "$EXECUTOR"
    else
        android_detect_executor
    fi
}

android_command_allowed() {
    case "$1" in
        am|pm|dumpsys|input|pidof|pgrep|ps|settings|wm|monkey|ls|stat|tail|sqlite3|grep|find)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

android_shell_quote() {
    local arg
    local quoted=""
    for arg in "$@"; do
        if [ -n "$quoted" ]; then
            quoted="${quoted} "
        fi
        quoted="${quoted}$(printf '%q' "$arg")"
    done
    printf '%s' "$quoted"
}

android_exec() {
    local command_name="$1"
    shift
    local executor

    if ! android_command_allowed "$command_name"; then
        echo "android_exec: command is not allowed: $command_name" >&2
        return 2
    fi

    executor="$(android_get_executor)"
    case "$executor" in
        su)
            local su_bin="su"
            if ! command -v su >/dev/null 2>&1; then
                if [ -x /system/xbin/su ]; then su_bin="/system/xbin/su"
                elif [ -x /system/bin/su ]; then su_bin="/system/bin/su"
                elif [ -x /sbin/su ]; then su_bin="/sbin/su"
                elif command -v tsu >/dev/null 2>&1; then su_bin="tsu"
                fi
            fi
            $su_bin -c "$(android_shell_quote "$command_name" "$@")"
            ;;
        adb)
            adb shell "$command_name" "$@"
            ;;
        direct|"")
            "$command_name" "$@"
            ;;
        *)
            echo "android_exec: unknown executor: $executor" >&2
            return 2
            ;;
    esac
}

android_pm() {
    android_exec pm "$@"
}

android_am() {
    android_exec am "$@"
}

android_dumpsys() {
    android_exec dumpsys "$@"
}

android_pidof() {
    local package="$1"
    android_validate_package "$package" || return 2
    android_exec pidof "$package"
}

android_pgrep_package() {
    local package="$1"
    android_validate_package "$package" || return 2
    android_exec pgrep -f "$package"
}

android_ps() {
    android_exec ps "$@"
}

android_settings() {
    android_exec settings "$@"
}

android_wm() {
    android_exec wm "$@"
}

android_monkey_package() {
    local package="$1"
    android_validate_package "$package" || return 2
    android_exec monkey -p "$package" 1
}

android_is_process_running() {
    local package="$1"
    android_validate_package "$package" || return 2

    local pids
    pids="$(android_pidof "$package" 2>/dev/null)"
    if [ -n "$pids" ]; then
        return 0
    fi

    if android_pgrep_package "$package" >/dev/null 2>&1; then
        return 0
    fi

    local ps_out
    ps_out="$(android_ps -A 2>/dev/null)"
    [ -z "$ps_out" ] && ps_out="$(android_ps 2>/dev/null)"
    if [ -n "$ps_out" ] && echo "$ps_out" | grep -q "[[:space:]]${package}$\|[[:space:]]${package}[[:space:]]"; then
        return 0
    fi

    return 1
}

android_is_task_present() {
    local package="$1"
    android_validate_package "$package" || return 2

    local dump
    dump="$(android_dumpsys activity activities 2>/dev/null)"
    if [ -n "$dump" ]; then
        if echo "$dump" | grep -E -q "Task\{.*${package}|realActivity=.*${package}|ActivityRecord\{.*${package}|affinity=.*${package}"; then
            return 0
        fi
        return 1
    fi

    dump="$(android_dumpsys activity recents 2>/dev/null)"
    if [ -n "$dump" ] && echo "$dump" | grep -q "$package"; then
        return 0
    fi

    dump="$(android_dumpsys activity top 2>/dev/null)"
    if [ -n "$dump" ] && echo "$dump" | grep -q "$package"; then
        return 0
    fi

    return 1
}

android_has_window_record() {
    local package="$1"
    android_validate_package "$package" || return 2

    local win_out
    win_out="$(android_dumpsys window windows 2>/dev/null)"
    if [ -n "$win_out" ]; then
        if echo "$win_out" | grep -E -q "Window\{.*${package}"; then
            return 0
        fi
    fi
    return 1
}

android_is_window_surface_visible() {
    local package="$1"
    android_validate_package "$package" || return 2

    local win_out
    win_out="$(android_dumpsys window windows 2>/dev/null)"
    if [ -n "$win_out" ]; then
        if echo "$win_out" | grep -E -q "WindowStateAnimator\{.*${package}|mSurface=Surface\(name=.*${package}|(Window\{.*${package}.*(mHasSurface=true|mViewVisibility=0x0))"; then
            return 0
        fi
        # If window is directly focused, surface is visible
        if echo "$win_out" | grep -E -q "mCurrentFocus=Window\{.*${package}|mFocusedApp=.*${package}"; then
            return 0
        fi
    fi
    return 1
}

android_is_window_focused() {
    local package="$1"
    android_validate_package "$package" || return 2

    local win_out
    win_out="$(android_dumpsys window windows 2>/dev/null)"
    if [ -n "$win_out" ]; then
        if echo "$win_out" | grep -E -q "mCurrentFocus=Window\{.*${package}|mFocusedApp=.*${package}"; then
            return 0
        fi
    fi
    return 1
}

android_is_window_visible() {
    local package="$1"
    android_validate_package "$package" || return 2

    local win_out
    win_out="$(android_dumpsys window windows 2>/dev/null)"
    if [ -n "$win_out" ]; then
        if echo "$win_out" | grep -E -q "Window\{.*${package}|mCurrentFocus=.*${package}|mFocusedApp=.*${package}|mSurface=.*${package}"; then
            return 0
        fi
        return 1
    fi

    local act_out
    act_out="$(android_dumpsys activity top 2>/dev/null)"
    if [ -n "$act_out" ]; then
        # Strictly check ActivityRecord or mResumedActivity without matching Task{...package}
        if echo "$act_out" | grep -E -q "ActivityRecord\{.*${package}|mResumedActivity:.*${package}|mResumed=true.*${package}|ACTIVITY ${package}/"; then
            return 0
        fi
        return 1
    fi

    return 1
}

android_get_resumed_activity() {
    local package="$1"
    local dump comp
    android_validate_package "$package" || return 2

    dump="$(android_dumpsys activity top 2>/dev/null)"
    if [ -n "$dump" ]; then
        comp="$(echo "$dump" | grep -oE "${package}/[A-Za-z0-9_.]+" | head -n 1)"
        if [ -n "$comp" ]; then
            printf '%s\n' "$comp"
            return 0
        fi
    fi

    dump="$(android_dumpsys activity activities 2>/dev/null)"
    if [ -n "$dump" ]; then
        comp="$(echo "$dump" | grep -E "mResumedActivity|topResumedActivity|ResumedActivity" | grep -oE "${package}/[A-Za-z0-9_.]+" | head -n 1)"
        if [ -n "$comp" ]; then
            printf '%s\n' "$comp"
            return 0
        fi
    fi

    return 1
}

android_validate_uint() {
    local value="$1"
    local max="${2:-100000}"
    [[ "$value" =~ ^[0-9]+$ ]] || return 1
    [ "$value" -le "$max" ] || return 1
}

android_validate_package() {
    local package="$1"
    [[ "$package" =~ ^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$ ]] || return 1
}

android_validate_path() {
    local path="$1"
    case "$path" in
        *$'\n'*|*$'\r'*|*';'*|*'&'*|*'|'*|*'`'*|*'$('*|*'>'*|*'<'*)
            return 1
            ;;
        /sdcard/Android/data/*/files/logs|/data/data/*/files/logs|/sdcard/Android/data/*/files/logs/*|/data/data/*/files/logs/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

android_validate_app_data_path() {
    local path="$1"
    case "$path" in
        *$'\n'*|*$'\r'*|*';'*|*'&'*|*'|'*|*'`'*|*'$('*|*'>'*|*'<'*)
            return 1
            ;;
        /data/data/*/shared_prefs|/data/data/*/databases|/data/data/*/databases/*|/data/data/*/files|/data/data/*/files/*)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

android_force_stop() {
    local package="$1"
    android_validate_package "$package" || return 2
    android_am force-stop "$package"
}

android_start_uri_args() {
    local package="$1"
    local uri="$2"
    shift 2
    local args=(start)

    if [ "$#" -eq 4 ]; then
        android_validate_uint "$1" || return 2
        android_validate_uint "$2" || return 2
        android_validate_uint "$3" || return 2
        android_validate_uint "$4" || return 2
        args+=(--windowingMode 5 --launch-bounds "$1" "$2" "$3" "$4")
    elif [ "$#" -ne 0 ]; then
        return 2
    fi

    args+=(-a android.intent.action.VIEW -d "$uri")
    if [ -n "$package" ]; then
        android_validate_package "$package" || return 2
        args+=(-p "$package")
    fi

    android_am "${args[@]}"
}

android_start_uri() {
    android_start_uri_args "$@"
}

android_start_uri_fresh() {
    local package="$1"
    local uri="$2"
    shift 2
    local args=(start -S --activity-clear-task --activity-new-task)

    if [ "$#" -eq 4 ]; then
        android_validate_uint "$1" || return 2
        android_validate_uint "$2" || return 2
        android_validate_uint "$3" || return 2
        android_validate_uint "$4" || return 2
        args+=(--windowingMode 5 --launch-bounds "$1" "$2" "$3" "$4")
    elif [ "$#" -ne 0 ]; then
        return 2
    fi

    args+=(-a android.intent.action.VIEW -d "$uri")
    if [ -n "$package" ]; then
        android_validate_package "$package" || return 2
        args+=(-p "$package")
    fi

    android_am "${args[@]}"
}

android_start_uri_for_user() {
    local user="$1"
    local package="$2"
    local uri="$3"
    shift 3
    local args=(start --user "$user")

    android_validate_uint "$user" 9999 || return 2
    if [ "$#" -eq 4 ]; then
        android_validate_uint "$1" || return 2
        android_validate_uint "$2" || return 2
        android_validate_uint "$3" || return 2
        android_validate_uint "$4" || return 2
        args+=(--windowingMode 5 --launch-bounds "$1" "$2" "$3" "$4")
    elif [ "$#" -ne 0 ]; then
        return 2
    fi

    args+=(-a android.intent.action.VIEW -d "$uri")
    if [ -n "$package" ]; then
        android_validate_package "$package" || return 2
        args+=(-p "$package")
    fi

    android_am "${args[@]}"
}

android_start_uri_for_user_fresh() {
    local user="$1"
    local package="$2"
    local uri="$3"
    shift 3
    local args=(start --user "$user" -S --activity-clear-task --activity-new-task)

    android_validate_uint "$user" 9999 || return 2
    if [ "$#" -eq 4 ]; then
        android_validate_uint "$1" || return 2
        android_validate_uint "$2" || return 2
        android_validate_uint "$3" || return 2
        android_validate_uint "$4" || return 2
        args+=(--windowingMode 5 --launch-bounds "$1" "$2" "$3" "$4")
    elif [ "$#" -ne 0 ]; then
        return 2
    fi

    args+=(-a android.intent.action.VIEW -d "$uri")
    if [ -n "$package" ]; then
        android_validate_package "$package" || return 2
        args+=(-p "$package")
    fi

    android_am "${args[@]}"
}

android_start_activity() {
    local component="$1"
    shift
    local args=(start)

    case "$component" in
        *$'\n'*|*$'\r'*|*';'*|*'&'*|*'|'*|*'`'*|*'$('*|*'>'*|*'<'*)
            return 2
            ;;
    esac

    if [ "$#" -eq 4 ]; then
        android_validate_uint "$1" || return 2
        android_validate_uint "$2" || return 2
        android_validate_uint "$3" || return 2
        android_validate_uint "$4" || return 2
        args+=(--windowingMode 5 --launch-bounds "$1" "$2" "$3" "$4")
    elif [ "$#" -ne 0 ]; then
        return 2
    fi

    args+=(-n "$component")
    android_am "${args[@]}"
}

android_start_activity_for_user() {
    local user="$1"
    local component="$2"
    shift 2
    local args=(start --user "$user")

    android_validate_uint "$user" 9999 || return 2
    case "$component" in
        *$'\n'*|*$'\r'*|*';'*|*'&'*|*'|'*|*'`'*|*'$('*|*'>'*|*'<'*)
            return 2
            ;;
    esac

    if [ "$#" -eq 4 ]; then
        android_validate_uint "$1" || return 2
        android_validate_uint "$2" || return 2
        android_validate_uint "$3" || return 2
        android_validate_uint "$4" || return 2
        args+=(--windowingMode 5 --launch-bounds "$1" "$2" "$3" "$4")
    elif [ "$#" -ne 0 ]; then
        return 2
    fi

    args+=(-n "$component")
    android_am "${args[@]}"
}

android_input_tap() {
    local x="$1"
    local y="$2"
    android_validate_uint "$x" || return 2
    android_validate_uint "$y" || return 2
    android_exec input tap "$x" "$y"
}

android_package_exists() {
    local package="$1"
    android_validate_package "$package" || return 2
    android_pm path "$package" >/dev/null 2>&1
}

android_get_package_version() {
    local package="$1"
    local dump version_code version_name

    android_validate_package "$package" || return 2
    dump="$(android_dumpsys package "$package" 2>/dev/null)" || return 1
    version_name="$(printf '%s\n' "$dump" | sed -n 's/^[[:space:]]*versionName=//p' | head -1 | tr -d '\r')"
    version_code="$(printf '%s\n' "$dump" | sed -n 's/^[[:space:]]*versionCode=\([0-9][0-9]*\).*/\1/p' | head -1 | tr -d '\r')"
    [ -n "$version_code$version_name" ] || return 1
    printf 'VERSION_CODE=%s\n' "$version_code"
    printf 'VERSION_NAME=%s\n' "$version_name"
}

android_install_apk() {
    local apk_path="$1"
    local allow_downgrade="${2:-false}"
    local executor
    local install_args=(install -r)

    case "$apk_path" in
        *$'\n'*|*$'\r'*|*';'*|*'&'*|*'|'*|*'`'*|*'$('*|*'>'*|*'<')
            return 2
            ;;
    esac
    [ -f "$apk_path" ] || return 1
    if [ "$allow_downgrade" = "true" ]; then
        install_args+=( -d )
    fi
    install_args+=("$apk_path")

    executor="$(android_get_executor)"
    case "$executor" in
        adb)
            adb "${install_args[@]}"
            ;;
        su|direct|"")
            android_pm "${install_args[@]}"
            ;;
        *)
            echo "android_install_apk: unknown executor: $executor" >&2
            return 2
            ;;
    esac
}

android_list_packages() {
    android_pm list packages "$@"
}

android_log_dir_exists() {
    local path="$1"
    android_validate_path "$path" || return 2
    android_exec ls -d "$path"
}

android_latest_log_file() {
    local path="$1"
    android_validate_path "$path" || return 2
    android_exec ls -t "$path"
}

android_stat_mtime() {
    local path="$1"
    android_validate_path "$path" || return 2
    android_exec stat -c %Y "$path"
}

android_tail_lines() {
    local count="$1"
    local path="$2"
    android_validate_uint "$count" 10000 || return 2
    android_validate_path "$path" || return 2
    android_exec tail -n "$count" "$path"
}

android_app_grep_recursive() {
    local package="$1"
    local subdir="$2"
    local pattern="$3"
    local path

    android_validate_package "$package" || return 2
    case "$subdir" in
        shared_prefs|files) ;;
        *) return 2 ;;
    esac
    path="/data/data/${package}/${subdir}"
    android_validate_app_data_path "$path" || return 2
    android_exec grep -rh "$pattern" "$path"
}

android_app_list_databases() {
    local package="$1"
    local path

    android_validate_package "$package" || return 2
    path="/data/data/${package}/databases"
    android_validate_app_data_path "$path" || return 2
    android_exec ls "$path"
}

android_app_sqlite_query() {
    local package="$1"
    local db_name="$2"
    local query="$3"
    local path

    android_validate_package "$package" || return 2
    case "$db_name" in
        *$'\n'*|*$'\r'*|*/*|*';'*|*'&'*|*'|'*|*'`'*|*'$('*|*'>'*|*'<')
            return 2
            ;;
    esac
    path="/data/data/${package}/databases/${db_name}"
    android_validate_app_data_path "$path" || return 2
    android_exec sqlite3 "$path" "$query"
}

android_app_find_account_files() {
    local package="$1"
    local path

    android_validate_package "$package" || return 2
    path="/data/data/${package}/files"
    android_validate_app_data_path "$path" || return 2
    android_exec find "$path" -maxdepth 2 '(' -name '*.json' -o -name '*account*' ')'
}

android_app_grep_file() {
    local path="$1"
    local pattern="$2"

    android_validate_app_data_path "$path" || return 2
    android_exec grep -h "$pattern" "$path"
}
