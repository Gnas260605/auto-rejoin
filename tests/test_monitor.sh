#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/logger.sh
source "${REPO_DIR}/lib/logger.sh"
# shellcheck source=../lib/runtime.sh
source "${REPO_DIR}/lib/runtime.sh"
# shellcheck source=../lib/monitor.sh
source "${REPO_DIR}/lib/monitor.sh"

TEST_TMP="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -rf "$TEST_TMP"; }
trap cleanup EXIT

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_eq() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then pass "$name"; else fail "$name expected=[$expected] actual=[$actual]"; fi
}

assert_contains() {
    local name="$1" pattern="$2" file="$3"
    if grep -q -- "$pattern" "$file"; then pass "$name"; else fail "$name"; fi
}

BGRN=""; GRN=""; RED=""; YLW=""; CYN=""; NC=""
LOG_FILE="${TEST_TMP}/monitor.log"
ROBLOX_PACKAGE="com.roblox.client"
PLACE_ID=1
PRIVATE_CODE=""
EXECUTOR="direct"
CHECK_INTERVAL=30
AUTO_RESTART_PERIOD=7200
ANTI_AFK=false
AFK_TAP_INTERVAL=180
TAP_X=540
TAP_Y=960
LAST_RESTART=0
LAST_AFK_TAP=0
LAST_LAUNCH=0
LAUNCH_GRACE=60
LAST_IN_GAME=0
IN_GAME_TIMEOUT=120
LOBBY_RETRY_COUNT=0
TAP_ON_LOAD_DONE=false
STABLE_SINCE=0
MONITOR_SLEEP_FN=test_sleep
MONITOR_NOW=1000

LOG_MESSAGES=""
DISCORD_COUNT=0
LAUNCH_COUNT=0
FORCE_STOP_COUNT=0
TAP_COUNT=0
REJOIN_COUNT=0
SLEEP_LOG=""
NET_OK=true
RUNNING=true
IN_GAME=false
DISCONNECT=false

test_sleep() {
    SLEEP_LOG="${SLEEP_LOG}${SLEEP_LOG:+ }$1"
}

log_msg() {
    LOG_MESSAGES="${LOG_MESSAGES}${LOG_MESSAGES:+
}$1"
    log_info "$1" "$LOG_FILE"
}

send_discord() {
    DISCORD_COUNT=$((DISCORD_COUNT + 1))
}

beep_warn() { :; }
beep_ok() { :; }
load_config() { :; }
init_executor() { :; }

check_internet() {
    [ "$NET_OK" = "true" ]
}

is_roblox_running() {
    [ "$RUNNING" = "true" ]
}

is_in_game() {
    [ "$IN_GAME" = "true" ]
}

check_roblox_log_for_disconnect() {
    [ "$DISCONNECT" = "true" ]
}

check_roblox_log_for_wrong_place() {
    [ "$WRONG_PLACE" = "true" ]
}

launch_roblox() {
    [ "${LAUNCH_OK:-true}" = "true" ] || return 1
    LAUNCH_COUNT=$((LAUNCH_COUNT + 1))
    LAST_LAUNCH="$MONITOR_NOW"
}

android_force_stop() {
    FORCE_STOP_COUNT=$((FORCE_STOP_COUNT + 1))
}

android_input_tap() {
    TAP_COUNT=$((TAP_COUNT + 1))
}

inc_rejoin_count() {
    REJOIN_COUNT=$((REJOIN_COUNT + 1))
}

get_rejoin_count() {
    printf '%s\n' "$REJOIN_COUNT"
}

reset_monitor_state() {
    : > "$LOG_FILE"
    LOG_MESSAGES=""
    DISCORD_COUNT=0
    LAUNCH_COUNT=0
    FORCE_STOP_COUNT=0
    TAP_COUNT=0
    REJOIN_COUNT=0
    SLEEP_LOG=""
    NET_OK=true
    RUNNING=true
    IN_GAME=false
    DISCONNECT=false
    WRONG_PLACE=false
    LAUNCH_OK=true
    LAST_RESTART=0
    LAST_AFK_TAP=0
    LAST_LAUNCH=0
    LAST_IN_GAME=0
    LOBBY_RETRY_COUNT=0
    TAP_ON_LOAD_DONE=false
    STABLE_SINCE=0
    MONITOR_NOW=1000
    MONITOR_STATE="$MONITOR_STATE_STOPPED"
    MONITOR_PREVIOUS_STATE=""
    MONITOR_STATE_CHANGED_AT=0
    MONITOR_REASON="startup"
    MONITOR_RECOVERY_REASON=""
    MONITOR_RECOVERY_COUNT_REJOIN=true
    MONITOR_OFFLINE_NOTIFIED=false
    MONITOR_COOLDOWN_NOTIFIED=false
    RUNTIME_BACKOFF_FAILURES=0
    RUNTIME_FAILURE_HISTORY=""
    RUNTIME_COOLDOWN_UNTIL=0
    RUNTIME_COOLDOWN_ACTIVE=0
    RUNTIME_FAILURE_LIMIT=10
    RUNTIME_FAILURE_WINDOW_SECONDS=600
    RUNTIME_COOLDOWN_SECONDS=300
}

startup_to_launching() {
    reset_monitor_state
    monitor_tick
    assert_eq "startup -> LAUNCHING" "$MONITOR_STATE_LAUNCHING" "$MONITOR_STATE"
    assert_contains "state transition logged" 'event=state_transition' "$LOG_FILE"
}

launch_success_to_loading() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LAUNCHING"
    monitor_tick
    assert_eq "launch success -> LOADING" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
    assert_eq "launch called once" "1" "$LAUNCH_COUNT"
}

launch_failure_to_recovering() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LAUNCHING"
    LAUNCH_OK=false
    monitor_tick
    assert_eq "launch failure -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "failed launch not counted as sent" "0" "$LAUNCH_COUNT"
    assert_eq "launch failure reason" "launch_failed" "$MONITOR_RECOVERY_REASON"
}

game_activity_to_in_game() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=2000
    LAST_LAUNCH=1000
    IN_GAME=true
    monitor_tick
    assert_eq "GameActivity -> IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
}

process_missing_to_crashed() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=2000
    LAST_LAUNCH=1000
    RUNNING=false
    monitor_tick
    assert_eq "process missing -> CRASHED" "$MONITOR_STATE_CRASHED" "$MONITOR_STATE"
}

disconnect_to_recovering() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    DISCONNECT=true
    monitor_tick
    assert_eq "disconnect signal -> DISCONNECTED" "$MONITOR_STATE_DISCONNECTED" "$MONITOR_STATE"
    monitor_tick
    assert_eq "DISCONNECTED -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
}

wrong_place_to_recovering() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    WRONG_PLACE=true
    monitor_tick
    assert_eq "wrong place -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "wrong place reason" "wrong_place_detected" "$MONITOR_RECOVERY_REASON"
}

recovery_uses_backoff() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_RECOVERING"
    MONITOR_RECOVERY_REASON="process_missing"
    monitor_tick
    assert_eq "recovery fail increments backoff" "1" "$RUNTIME_BACKOFF_FAILURES"
    assert_eq "recovery backoff sleep" "5 3" "$SLEEP_LOG"
    assert_eq "recovery launched" "1" "$LAUNCH_COUNT"
    assert_eq "recovery -> LOADING" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
}

failure_threshold_to_cooldown() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_RECOVERING"
    MONITOR_RECOVERY_REASON="process_missing"
    RUNTIME_FAILURE_LIMIT=1
    monitor_tick
    assert_eq "failure threshold -> COOLDOWN" "$MONITOR_STATE_COOLDOWN" "$MONITOR_STATE"
    assert_eq "cooldown does not launch immediately" "0" "$LAUNCH_COUNT"
}

offline_and_restore() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    NET_OK=false
    monitor_tick
    assert_eq "offline -> OFFLINE" "$MONITOR_STATE_OFFLINE" "$MONITOR_STATE"
    assert_eq "offline no failure count" "0" "$RUNTIME_BACKOFF_FAILURES"
    NET_OK=true
    monitor_tick
    assert_eq "online restored -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
}

periodic_restart_to_recovering() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    IN_GAME=true
    AUTO_RESTART_PERIOD=100
    LAST_RESTART=800
    MONITOR_NOW=1000
    monitor_tick
    assert_eq "periodic restart -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "periodic does not count as crash" "0" "$RUNTIME_BACKOFF_FAILURES"
}

anti_afk_only_in_game() {
    reset_monitor_state
    ANTI_AFK=true
    LAST_AFK_TAP=0
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    monitor_tick
    assert_eq "no anti-afk in LOADING" "0" "$TAP_COUNT"
    reset_monitor_state
    ANTI_AFK=true
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    IN_GAME=true
    LAST_AFK_TAP=0
    MONITOR_NOW=1000
    TAP_ON_LOAD_DONE=true
    monitor_tick
    assert_eq "anti-afk in IN_GAME" "1" "$TAP_COUNT"
}

deep_link_retry_limit() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=1000
    LAST_LAUNCH=0
    LAST_IN_GAME=0
    LOBBY_RETRY_COUNT=0
    RUNNING=true
    IN_GAME=false
    monitor_tick
    assert_eq "deep-link retry increments" "1" "$LOBBY_RETRY_COUNT"
    assert_eq "deep-link retry -> LAUNCHING" "$MONITOR_STATE_LAUNCHING" "$MONITOR_STATE"

    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=1000
    LAST_LAUNCH=0
    LAST_IN_GAME=0
    LOBBY_RETRY_COUNT=3
    RUNNING=true
    IN_GAME=false
    monitor_tick
    assert_eq "deep-link exhausted -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
}

cooldown_expiry_to_recovering() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_COOLDOWN"
    RUNTIME_COOLDOWN_ACTIVE=1
    RUNTIME_COOLDOWN_UNTIL=1100
    MONITOR_NOW=1000
    monitor_tick
    assert_eq "cooldown active no launch" "0" "$LAUNCH_COUNT"
    assert_eq "cooldown stays COOLDOWN" "$MONITOR_STATE_COOLDOWN" "$MONITOR_STATE"
    MONITOR_NOW=1200
    monitor_tick
    assert_eq "cooldown expire -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
}

stable_runtime_resets_backoff() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    IN_GAME=true
    STABLE_SINCE=900
    MONITOR_NOW=1000
    RUNTIME_BACKOFF_FAILURES=2
    RUNTIME_FAILURE_HISTORY="800 900"
    monitor_tick
    assert_eq "stable runtime resets backoff" "0" "$RUNTIME_BACKOFF_FAILURES"
}

startup_to_launching
launch_success_to_loading
launch_failure_to_recovering
game_activity_to_in_game
process_missing_to_crashed
disconnect_to_recovering
wrong_place_to_recovering
recovery_uses_backoff
failure_threshold_to_cooldown
offline_and_restore
periodic_restart_to_recovering
anti_afk_only_in_game
deep_link_retry_limit
cooldown_expiry_to_recovering
stable_runtime_resets_backoff

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
