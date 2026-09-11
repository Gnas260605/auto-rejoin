#!/usr/bin/env bash

MONITOR_STATE_STOPPED="STOPPED"
MONITOR_STATE_LAUNCHING="LAUNCHING"
MONITOR_STATE_LOADING="LOADING"
MONITOR_STATE_IN_GAME="IN_GAME"
MONITOR_STATE_DISCONNECTED="DISCONNECTED"
MONITOR_STATE_CRASHED="CRASHED"
MONITOR_STATE_RECOVERING="RECOVERING"
MONITOR_STATE_COOLDOWN="COOLDOWN"
MONITOR_STATE_OFFLINE="OFFLINE"
MONITOR_STATE_ERROR="ERROR"

MONITOR_STATE="${MONITOR_STATE:-$MONITOR_STATE_STOPPED}"
MONITOR_PREVIOUS_STATE="${MONITOR_PREVIOUS_STATE:-}"
MONITOR_STATE_CHANGED_AT="${MONITOR_STATE_CHANGED_AT:-0}"
MONITOR_REASON="${MONITOR_REASON:-startup}"
MONITOR_RECOVERY_REASON="${MONITOR_RECOVERY_REASON:-}"
MONITOR_RECOVERY_COUNT_REJOIN="${MONITOR_RECOVERY_COUNT_REJOIN:-true}"
MONITOR_OFFLINE_NOTIFIED="${MONITOR_OFFLINE_NOTIFIED:-false}"
MONITOR_COOLDOWN_NOTIFIED="${MONITOR_COOLDOWN_NOTIFIED:-false}"

monitor_now() {
    if [ -n "${MONITOR_NOW:-}" ]; then
        printf '%s\n' "$MONITOR_NOW"
    else
        date +%s
    fi
}

monitor_sleep() {
    local seconds="$1"
    if [ -n "${MONITOR_SLEEP_FN:-}" ] && declare -F "$MONITOR_SLEEP_FN" >/dev/null 2>&1; then
        "$MONITOR_SLEEP_FN" "$seconds"
    else
        sleep "$seconds"
    fi
}

monitor_get_state() {
    printf '%s\n' "$MONITOR_STATE"
}

monitor_set_state() {
    local next="$1"
    local reason="${2:-unspecified}"
    local previous="$MONITOR_STATE"

    [ "$previous" = "$next" ] && return 0
    MONITOR_PREVIOUS_STATE="$previous"
    MONITOR_STATE="$next"
    MONITOR_REASON="$reason"
    MONITOR_STATE_CHANGED_AT="$(monitor_now)"
    log_event INFO state_transition "$LOG_FILE" package "$ROBLOX_PACKAGE" from "$previous" to "$next" reason "$reason"
}

monitor_transition() {
    monitor_set_state "$@"
}

monitor_request_recovery() {
    MONITOR_RECOVERY_REASON="$1"
    MONITOR_RECOVERY_COUNT_REJOIN="${2:-true}"
    monitor_transition "$MONITOR_STATE_RECOVERING" "$1"
}

monitor_record_recovery_failure() {
    local reason="$1"
    local now delay failures remaining

    now="$(monitor_now)"
    runtime_failure_record "$now"
    failures="$(runtime_failure_count "$now")"
    log_event WARN recovery_failed "$LOG_FILE" package "$ROBLOX_PACKAGE" reason "$reason" consecutive "$RUNTIME_BACKOFF_FAILURES" window_failures "$failures"

    if runtime_should_cooldown "$now"; then
        runtime_cooldown_start "$now"
        remaining="$(runtime_cooldown_remaining "$now")"
        log_msg "${RED}[COOLDOWN]${NC} Quá nhiều recovery failure (${failures}/${RUNTIME_FAILURE_LIMIT}). Tạm nghỉ ${remaining}s."
        log_event WARN cooldown_start "$LOG_FILE" package "$ROBLOX_PACKAGE" reason "$reason" failures "$failures" seconds "$remaining"
        if [ "$MONITOR_COOLDOWN_NOTIFIED" != "true" ]; then
            send_discord "🚧 **[$ROBLOX_PACKAGE]** Quá nhiều lỗi recovery. Tạm cooldown ${remaining}s để tránh restart storm."
            MONITOR_COOLDOWN_NOTIFIED=true
        fi
        return 1
    fi

    delay="$(runtime_backoff_next "$RUNTIME_BACKOFF_FAILURES")"
    if [ "$delay" -gt 0 ]; then
        log_msg "${YLW}[BACKOFF]${NC} Chờ ${delay}s trước khi recovery (${reason}, failure #${RUNTIME_BACKOFF_FAILURES})."
        log_event INFO backoff_wait "$LOG_FILE" package "$ROBLOX_PACKAGE" reason "$reason" delay_seconds "$delay" consecutive "$RUNTIME_BACKOFF_FAILURES"
        monitor_sleep "$delay"
    fi
    return 0
}

monitor_note_stable_game() {
    local now="$1"

    if [ "$STABLE_SINCE" -eq 0 ]; then
        STABLE_SINCE="$now"
        return 0
    fi

    if [ "${RUNTIME_BACKOFF_FAILURES:-0}" -gt 0 ] && [ $((now - STABLE_SINCE)) -ge "$RUNTIME_STABLE_RESET_SECONDS" ]; then
        log_msg "${GRN}[RECOVERY]${NC} Roblox ổn định ${RUNTIME_STABLE_RESET_SECONDS}s, reset backoff."
        log_event INFO recovery_success "$LOG_FILE" package "$ROBLOX_PACKAGE" stable_seconds "$((now - STABLE_SINCE))"
        runtime_failure_reset
    fi
}

monitor_wrong_place_detected() {
    declare -F check_roblox_log_for_wrong_place >/dev/null 2>&1 && check_roblox_log_for_wrong_place
}

monitor_launch_once() {
    STABLE_SINCE=0
    if ! launch_roblox; then
        log_event WARN launch_attempt_failed "$LOG_FILE" package "$ROBLOX_PACKAGE" reason "${1:-launch_sent}"
        MONITOR_RECOVERY_REASON="launch_failed"
        MONITOR_RECOVERY_COUNT_REJOIN="true"
        monitor_transition "$MONITOR_STATE_RECOVERING" "launch_failed"
        return 1
    fi
    monitor_transition "$MONITOR_STATE_LOADING" "${1:-launch_sent}"
}

monitor_handle_launching() {
    monitor_launch_once "${MONITOR_REASON:-startup}" || return 0
}

monitor_handle_loading() {
    local now remaining time_stuck time_left

    if ! check_internet; then
        monitor_transition "$MONITOR_STATE_OFFLINE" "network_offline"
        return 0
    fi

    now="$(monitor_now)"
    if [ $((now - LAST_LAUNCH)) -lt "$LAUNCH_GRACE" ]; then
        remaining=$((LAUNCH_GRACE - now + LAST_LAUNCH))
        log_msg "${CYN}[WAIT]${NC} Đang chờ game tải... (${remaining}s còn lại)"
        return 0
    fi

    if ! is_roblox_running; then
        monitor_transition "$MONITOR_STATE_CRASHED" "process_missing"
        return 0
    fi

    if check_roblox_log_for_disconnect; then
        monitor_transition "$MONITOR_STATE_DISCONNECTED" "disconnect_detected"
        return 0
    fi

    if monitor_wrong_place_detected; then
        send_discord "[WARN] **[$ROBLOX_PACKAGE]** Roblox vao sai Place ID. Dang rejoin lai dung game..."
        monitor_request_recovery "wrong_place_detected" "true"
        return 0
    fi

    if is_in_game; then
        LAST_IN_GAME="$now"
        monitor_transition "$MONITOR_STATE_IN_GAME" "game_activity_detected"
        return 0
    fi

    time_stuck=$((now - LAST_IN_GAME))
    if [ "$time_stuck" -ge "$IN_GAME_TIMEOUT" ]; then
        if [ "$LOBBY_RETRY_COUNT" -lt 3 ]; then
            LOBBY_RETRY_COUNT=$((LOBBY_RETRY_COUNT + 1))
            LOW_SERVER_RETRY_OFFSET=$(( ${LOW_SERVER_RETRY_OFFSET:-0} + 1 ))
            log_msg "${YLW}[LOBBY]${NC} Kẹt ở sảnh/loading ${time_stuck}s! Force-stop rồi chọn lại server ít người (Lần thử $LOBBY_RETRY_COUNT/3)..."
            send_discord "⚠️ **[$ROBLOX_PACKAGE]** Kẹt ở sảnh/loading ${time_stuck}s. Đang force-stop và chọn lại server ít người (Thử lần $LOBBY_RETRY_COUNT/3)..."
            log_event INFO recovery_attempt "$LOG_FILE" package "$ROBLOX_PACKAGE" reason "lobby_deeplink_retry" retry "$LOBBY_RETRY_COUNT"
            monitor_request_recovery "lobby_deeplink_retry" "true"
        else
            log_msg "${RED}[LOBBY]${NC} Kẹt ở sảnh quá lâu (> 3 lần thử)! Tiến hành khởi động lại game..."
            send_discord "🚨 **[$ROBLOX_PACKAGE]** Kẹt ở sảnh quá lâu. Khởi động lại game!"
            monitor_request_recovery "loading_timeout" "true"
        fi
        return 0
    fi

    STABLE_SINCE=0
    time_left=$((IN_GAME_TIMEOUT - time_stuck))
    log_msg "${YLW}[LOBBY]${NC} Đang ở sảnh/loading, chờ vào map... (${time_left}s còn lại)"
}

monitor_handle_in_game() {
    local now

    if ! check_internet; then
        monitor_transition "$MONITOR_STATE_OFFLINE" "network_offline"
        return 0
    fi

    if ! is_roblox_running; then
        monitor_transition "$MONITOR_STATE_CRASHED" "process_missing"
        return 0
    fi

    if check_roblox_log_for_disconnect; then
        monitor_transition "$MONITOR_STATE_DISCONNECTED" "disconnect_detected"
        return 0
    fi

    if monitor_wrong_place_detected; then
        send_discord "[WARN] **[$ROBLOX_PACKAGE]** Roblox vao sai Place ID. Dang rejoin lai dung game..."
        monitor_request_recovery "wrong_place_detected" "true"
        return 0
    fi

    now="$(monitor_now)"
    if ! is_in_game; then
        monitor_transition "$MONITOR_STATE_LOADING" "game_activity_missing"
        return 0
    fi

    monitor_note_stable_game "$now"
    LAST_IN_GAME="$now"
    if [ "$LOBBY_RETRY_COUNT" -gt 0 ]; then
        log_msg "${GRN}[GAME]${NC} Đã vào game thành công! Reset bộ đếm sảnh."
        LOBBY_RETRY_COUNT=0
        LOW_SERVER_RETRY_OFFSET=0
    fi

    if [ "$TAP_ON_LOAD_DONE" = "false" ]; then
        log_msg "${GRN}[LOAD]${NC} Game đã tải xong! Thực hiện tap kích hoạt tại ($TAP_X, $TAP_Y)..."
        android_input_tap "$TAP_X" "$TAP_Y" >/dev/null 2>&1
        TAP_ON_LOAD_DONE=true
        LAST_AFK_TAP="$now"
    fi

    if [ "$ANTI_AFK" = "true" ] && declare -F entitlement_require_feature >/dev/null 2>&1; then
        if ! entitlement_require_feature anti_afk "Anti-AFK" >/dev/null 2>&1; then
            log_msg "${YLW}[LICENSE]${NC} License hien tai khong co Anti-AFK; tat tap chong AFK."
            ANTI_AFK="false"
        fi
    fi

    if [ "$ANTI_AFK" = "true" ] && [ $((now - LAST_AFK_TAP)) -ge "$AFK_TAP_INTERVAL" ]; then
        log_msg "${CYN}[AFK]${NC} Gửi tap tại ($TAP_X, $TAP_Y)"
        android_input_tap "$TAP_X" "$TAP_Y" >/dev/null 2>&1
        LAST_AFK_TAP="$now"
    fi

    if [ "${AUTO_RESTART_PERIOD:-0}" -gt 0 ] && [ $((now - LAST_RESTART)) -ge "$AUTO_RESTART_PERIOD" ]; then
        log_msg "${YLW}[RESTART]${NC} Restart định kỳ (${AUTO_RESTART_PERIOD}s)..."
        send_discord "🔄 **[$ROBLOX_PACKAGE]** Auto restart định kỳ."
        monitor_request_recovery "periodic_restart" "false"
    fi
}

monitor_handle_disconnected() {
    local cnt
    cnt="$(get_rejoin_count "$ROBLOX_PACKAGE")"
    log_msg "${RED}[DISCONNECT]${NC} Phát hiện mất kết nối/kick từ log Roblox! Rejoin lần #$((cnt + 1))..."
    beep_warn
    send_discord "🚨 **[$ROBLOX_PACKAGE]** Mất kết nối hoặc bị Kick! Đang Rejoin lần #$((cnt + 1))..."
    monitor_request_recovery "disconnect_detected" "true"
}

monitor_handle_crashed() {
    local cnt
    cnt="$(get_rejoin_count "$ROBLOX_PACKAGE")"
    log_msg "${RED}[CRASH]${NC} Game bị tắt/crash! Rejoin lần #$((cnt + 1))..."
    beep_warn
    send_discord "💥 **[$ROBLOX_PACKAGE]** Crash! Rejoin lần #$((cnt + 1))..."
    monitor_request_recovery "process_missing" "true"
}

monitor_handle_recovering() {
    local reason="${MONITOR_RECOVERY_REASON:-recovery_failed}"
    local count_rejoin="${MONITOR_RECOVERY_COUNT_REJOIN:-true}"

    case "$reason" in
        periodic_restart|network_restored)
            ;;
        *)
            if ! monitor_record_recovery_failure "$reason"; then
                monitor_transition "$MONITOR_STATE_COOLDOWN" "cooldown_started"
                return 0
            fi
            ;;
    esac

    log_event INFO recovery_attempt "$LOG_FILE" package "$ROBLOX_PACKAGE" reason "$reason"
    android_force_stop "$ROBLOX_PACKAGE" >/dev/null 2>&1
    monitor_sleep 3
    [ "$count_rejoin" = "true" ] && inc_rejoin_count "$ROBLOX_PACKAGE"
    LOBBY_RETRY_COUNT=0
    STABLE_SINCE=0
    monitor_launch_once "$reason" || return 0
}

monitor_handle_cooldown() {
    local now remaining

    now="$(monitor_now)"
    if runtime_cooldown_is_active "$now"; then
        return 0
    fi

    remaining="$(runtime_cooldown_remaining "$now")"
    log_msg "${GRN}[COOLDOWN]${NC} Hết thời gian cooldown, thử recovery lại."
    log_event INFO cooldown_end "$LOG_FILE" package "$ROBLOX_PACKAGE" remaining_seconds "$remaining"
    send_discord "✅ **[$ROBLOX_PACKAGE]** Hết cooldown, bot sẽ thử recovery lại."
    runtime_cooldown_reset
    runtime_failure_reset
    MONITOR_COOLDOWN_NOTIFIED=false
    monitor_request_recovery "cooldown_expired" "true"
}

monitor_handle_offline() {
    if ! check_internet; then
        if [ "$MONITOR_OFFLINE_NOTIFIED" != "true" ]; then
            log_msg "${RED}[NET]${NC} Mất kết nối Internet! Chờ mạng..."
            beep_warn
            send_discord "⚠️ **[$ROBLOX_PACKAGE]** Mất kết nối Internet!"
            MONITOR_OFFLINE_NOTIFIED=true
        fi
        monitor_sleep 10
        return 0
    fi

    MONITOR_OFFLINE_NOTIFIED=false
    log_msg "${GRN}[NET]${NC} Có mạng lại! Khởi động game..."
    beep_ok
    send_discord "📶 **[$ROBLOX_PACKAGE]** Có mạng, đang vào game!"
    monitor_request_recovery "network_restored" "true"
}

monitor_tick() {
    case "$MONITOR_STATE" in
        "$MONITOR_STATE_STOPPED")
            monitor_transition "$MONITOR_STATE_LAUNCHING" "${MONITOR_REASON:-startup}"
            ;;
        "$MONITOR_STATE_LAUNCHING")
            monitor_handle_launching
            ;;
        "$MONITOR_STATE_LOADING")
            monitor_handle_loading
            ;;
        "$MONITOR_STATE_IN_GAME")
            monitor_handle_in_game
            ;;
        "$MONITOR_STATE_DISCONNECTED")
            monitor_handle_disconnected
            ;;
        "$MONITOR_STATE_CRASHED")
            monitor_handle_crashed
            ;;
        "$MONITOR_STATE_RECOVERING")
            monitor_handle_recovering
            ;;
        "$MONITOR_STATE_COOLDOWN")
            monitor_handle_cooldown
            ;;
        "$MONITOR_STATE_OFFLINE")
            monitor_handle_offline
            ;;
        *)
            monitor_transition "$MONITOR_STATE_ERROR" "unexpected_state"
            return 1
            ;;
    esac
}

monitor_run() {
    load_config
    init_executor
    local win_name="${ROBLOX_PACKAGE//./_}"
    local pid_file="${TMP_DIR}/roblox_bot_${win_name}.pid"
    trap 'runtime_lock_release "$LOG_FILE" "$ROBLOX_PACKAGE"; rm -f "$pid_file"' EXIT
    trap 'runtime_lock_release "$LOG_FILE" "$ROBLOX_PACKAGE"; rm -f "$pid_file"; exit 0' INT TERM

    if declare -F entitlement_admit_instance >/dev/null 2>&1; then
        if ! entitlement_admit_instance "$TMP_DIR" "$ROBLOX_PACKAGE" "$LOG_FILE"; then
            log_msg "${YLW}[LICENSE]${NC} Entitlement denied monitor start for package $ROBLOX_PACKAGE. Exit cleanly."
            exit 1
        fi
    elif ! runtime_lock_acquire "$TMP_DIR" "$ROBLOX_PACKAGE" "$LOG_FILE"; then
        log_msg "${YLW}[LOCK]${NC} Another monitor is already running for package $ROBLOX_PACKAGE. Exit cleanly."
        exit 0
    fi

    echo "$$" > "$pid_file"
    MONITOR_STATE="$MONITOR_STATE_STOPPED"
    MONITOR_REASON="startup"
    MONITOR_OFFLINE_NOTIFIED=false
    MONITOR_COOLDOWN_NOTIFIED=false

    clear
    echo -e "${BGRN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║   ROBLOX AUTO REJOIN - ĐANG CHẠY NGẦM  ║${NC}"
    echo -e "${BGRN}╚══════════════════════════════════════════╝${NC}"
    echo -e " ${GRN}Package :${NC} $ROBLOX_PACKAGE"
    echo -e " ${GRN}PlaceID :${NC} $PLACE_ID  ${GRN}Private:${NC} ${PRIVATE_CODE:-Không}"
    echo -e " ${GRN}Executor:${NC} $EXECUTOR  ${GRN}Anti-AFK:${NC} $ANTI_AFK"
    echo -e "${BGRN}══════════════════════════════════════════${NC}"
    log_msg "${GRN}[START]${NC} Bot khởi động, bắt đầu giám sát..."
    beep_ok
    monitor_transition "$MONITOR_STATE_LAUNCHING" "startup"

    while true; do
        monitor_tick || monitor_transition "$MONITOR_STATE_ERROR" "tick_failed"
        monitor_sleep "$CHECK_INTERVAL"
    done
}
