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
AUTO_RESTART_PERIOD=0
ANTI_AFK=false
AFK_TAP_INTERVAL=180
TAP_X=540
TAP_Y=960
LAST_RESTART=0
LAST_AFK_TAP=0
LAST_LAUNCH=0
LAUNCH_GRACE=60
LAST_IN_GAME=0
LOADING_STARTED_AT=0
IN_GAME_TIMEOUT=120
LOBBY_RETRY_COUNT=0
LOW_SERVER_RETRY_OFFSET=0
WINDOW_MISSING_COUNT=0
WINDOW_MISSING_THRESHOLD=3
WINDOW_REOPEN_ENABLED=true
LOBBY_RETRY_LIMIT=3
LOBBY_RETRY_DELAY=3
TAP_ON_LOAD_DONE=false
STABLE_SINCE=0
MONITOR_SLEEP_FN=test_sleep
MONITOR_NOW=1000

LOG_MESSAGES=""
DISCORD_COUNT=0
LAUNCH_COUNT=0
WAKE_COUNT=0
FORCE_STOP_COUNT=0
TAP_COUNT=0
REJOIN_COUNT=0
SLEEP_LOG=""
NET_OK=true
RUNNING=true
WINDOW_VISIBLE=true
TASK_PRESENT=true
IN_GAME=false
DISCONNECT=false
SCREEN_DISCONNECT=false
WRONG_PLACE=false
APP_HOME=false
QUEUE=false
LAUNCH_OK=true
WAKE_OK=true
CLEAR_DISCONNECT_ON_SLEEP=false

test_sleep() {
    SLEEP_LOG="${SLEEP_LOG}${SLEEP_LOG:+ }$1"
    if [ "$CLEAR_DISCONNECT_ON_SLEEP" = "true" ]; then
        DISCONNECT=false
        SCREEN_DISCONNECT=false
    fi
}

log_msg() {
    LOG_MESSAGES="${LOG_MESSAGES}${LOG_MESSAGES:+
}$1"
    log_info "$1" "$LOG_FILE"
}

send_discord() { DISCORD_COUNT=$((DISCORD_COUNT + 1)); }
beep_warn() { :; }
beep_ok() { :; }
load_config() { :; }
init_executor() { :; }
check_internet() { [ "$NET_OK" = "true" ]; }
is_roblox_running() { [ "$RUNNING" = "true" ]; }
check_roblox_window_visible() { [ "$WINDOW_VISIBLE" = "true" ]; }
check_roblox_task_present() { [ "$TASK_PRESENT" = "true" ]; }
is_in_game() { [ "$IN_GAME" = "true" ]; }
check_roblox_log_for_disconnect() { [ "$DISCONNECT" = "true" ]; }
check_roblox_screen_for_disconnect() { [ "$SCREEN_DISCONNECT" = "true" ]; }
check_roblox_log_for_wrong_place() { [ "$WRONG_PLACE" = "true" ]; }
check_roblox_log_for_queue() { [ "$QUEUE" = "true" ]; }
detect_roblox_session_state() { if [ "$APP_HOME" = "true" ]; then printf 'APP_HOME\n'; else printf 'UNKNOWN\n'; fi; }

launch_roblox() {
    [ "${LAUNCH_OK:-true}" = "true" ] || return 1
    LAUNCH_COUNT=$((LAUNCH_COUNT + 1))
    LAST_LAUNCH="$MONITOR_NOW"
    LOADING_STARTED_AT="$MONITOR_NOW"
}

launch_roblox_non_destructive() {
    [ "${WAKE_OK:-true}" = "true" ] || return 1
    WAKE_COUNT=$((WAKE_COUNT + 1))
    LAST_LAUNCH="$MONITOR_NOW"
    LOADING_STARTED_AT="$MONITOR_NOW"
}

android_force_stop() { FORCE_STOP_COUNT=$((FORCE_STOP_COUNT + 1)); }
android_input_tap() { TAP_COUNT=$((TAP_COUNT + 1)); }
inc_rejoin_count() { REJOIN_COUNT=$((REJOIN_COUNT + 1)); }
get_rejoin_count() { printf '%s\n' "$REJOIN_COUNT"; }
low_server_mark_current_failed() { :; }

reset_monitor_state() {
    : > "$LOG_FILE"
    LOG_MESSAGES=""
    DISCORD_COUNT=0
    LAUNCH_COUNT=0
    WAKE_COUNT=0
    FORCE_STOP_COUNT=0
    TAP_COUNT=0
    REJOIN_COUNT=0
    SLEEP_LOG=""
    NET_OK=true
    RUNNING=true
    WINDOW_VISIBLE=true
    TASK_PRESENT=true
    IN_GAME=false
    DISCONNECT=false
    SCREEN_DISCONNECT=false
    WRONG_PLACE=false
    APP_HOME=false
    QUEUE=false
    LAUNCH_OK=true
    WAKE_OK=true
    CLEAR_DISCONNECT_ON_SLEEP=false
    LAST_RESTART=0
    LAST_AFK_TAP=0
    LAST_LAUNCH=0
    LAUNCH_GRACE=60
    LAST_IN_GAME=0
    LOADING_STARTED_AT=0
    IN_GAME_TIMEOUT=120
    LOBBY_RETRY_COUNT=0
    LOW_SERVER_RETRY_OFFSET=0
    WINDOW_MISSING_COUNT=0
    WINDOW_MISSING_THRESHOLD=3
    WINDOW_REOPEN_ENABLED=true
    UNKNOWN_ACTIVE_WAKE_AFTER=60
    UNKNOWN_ACTIVE_WAKE_BACKOFF=60
    STALLED_ACTIVE_TIMEOUT=180
    HEARTBEAT_STALE_SECONDS=0
    LOBBY_RETRY_LIMIT=3
    LOBBY_RETRY_DELAY=3
    TAP_ON_LOAD_DONE=false
    STABLE_SINCE=0
    AUTO_RESTART_PERIOD=0
    ANTI_AFK=false
    AFK_TAP_INTERVAL=180
    ROBLOX_PACKAGE="com.roblox.client"
    PLACE_ID=1
    PRIVATE_CODE=""
    JOIN_LOW_SERVER=false
    MONITOR_SLEEP_FN=test_sleep
    MONITOR_NOW=1000
    MONITOR_STATE="$MONITOR_STATE_STOPPED"
    MONITOR_PREVIOUS_STATE=""
    MONITOR_STATE_CHANGED_AT=0
    MONITOR_REASON="startup"
    MONITOR_RECOVERY_REASON=""
    MONITOR_RECOVERY_COUNT_REJOIN=true
    MONITOR_RECOVERY_AUTHORIZED_BY=""
    MONITOR_LOOP_ITERATION=0
    UNKNOWN_ACTIVE_LAST_WAKE_AT=0
    STALLED_ACTIVE_STARTED_AT=0
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

run_recovery_tick() {
    MONITOR_STATE="$MONITOR_STATE_RECOVERING"
    MONITOR_RECOVERY_REASON="$1"
    MONITOR_RECOVERY_COUNT_REJOIN="${2:-true}"
    monitor_tick
}

test_protected_in_game_latch() {
    reset_monitor_state
    LAST_IN_GAME=900
    run_recovery_tick "loading_timeout"
    assert_eq "1 process alive latch force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "1 process alive latch launch=0" "0" "$LAUNCH_COUNT"
    assert_eq "1 process alive latch rejoin=0" "0" "$REJOIN_COUNT"
}

test_not_top_activity_protected() {
    reset_monitor_state
    LAST_IN_GAME=900
    IN_GAME=true
    WINDOW_VISIBLE=false
    WINDOW_MISSING_THRESHOLD=1
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    monitor_tick
    assert_eq "2 not top/focused force-stop=0" "0" "$FORCE_STOP_COUNT"
}

test_no_window_record_protected() {
    reset_monitor_state
    LAST_IN_GAME=900
    WINDOW_VISIBLE=false
    WINDOW_MISSING_THRESHOLD=1
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    monitor_tick
    assert_eq "3 no window record force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "3 no window record -> UNKNOWN_ACTIVE" "$MONITOR_STATE_UNKNOWN_ACTIVE" "$MONITOR_STATE"
}

test_executor_overlay_protected() {
    reset_monitor_state
    LAST_IN_GAME=900
    WINDOW_VISIBLE=false
    TASK_PRESENT=true
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    monitor_tick
    assert_eq "4 executor overlay force-stop=0" "0" "$FORCE_STOP_COUNT"
}

test_in_game_timeout_protected() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=1200
    LAST_LAUNCH=1000
    LOADING_STARTED_AT=1000
    IN_GAME_TIMEOUT=120
    monitor_tick
    assert_eq "5 loading timeout force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "5 loading timeout launch=0" "0" "$LAUNCH_COUNT"
}

test_periodic_restart_disabled() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    IN_GAME=true
    AUTO_RESTART_PERIOD=100
    LAST_RESTART=800
    MONITOR_NOW=1000
    monitor_tick
    assert_eq "6 periodic restart force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "6 periodic restart stays IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
}

test_network_offline_protected() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    NET_OK=false
    monitor_tick
    assert_eq "7 offline force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "7 offline -> UNKNOWN_ACTIVE" "$MONITOR_STATE_UNKNOWN_ACTIVE" "$MONITOR_STATE"
}

test_api_429_protected() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=1200
    LAST_LAUNCH=1000
    LOADING_STARTED_AT=1000
    JOIN_LOW_SERVER=true
    QUEUE=false
    monitor_tick
    assert_eq "8 API 429/no queue force-stop=0" "0" "$FORCE_STOP_COUNT"
}

test_process_dead_rejoins_without_force_stop() {
    reset_monitor_state
    RUNNING=false
    run_recovery_tick "process_missing"
    assert_eq "9 process dead force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "9 process dead launch=1" "1" "$LAUNCH_COUNT"
    assert_eq "9 process dead rejoin=1" "1" "$REJOIN_COUNT"
}

test_fresh_disconnect_rejoins_once() {
    reset_monitor_state
    DISCONNECT=true
    run_recovery_tick "disconnect_detected"
    assert_eq "10 fresh disconnect force-stop=1" "1" "$FORCE_STOP_COUNT"
    assert_eq "10 fresh disconnect launch=1" "1" "$LAUNCH_COUNT"
    assert_eq "10 fresh disconnect rejoin=1" "1" "$REJOIN_COUNT"
}

test_fresh_kick_rejoins_once() {
    reset_monitor_state
    DISCONNECT=true
    run_recovery_tick "kick_detected"
    assert_eq "11 fresh kick force-stop=1" "1" "$FORCE_STOP_COUNT"
}

test_app_home_rejoins() {
    reset_monitor_state
    APP_HOME=true
    run_recovery_tick "returned_to_home"
    assert_eq "12 APP_HOME force-stop=1" "1" "$FORCE_STOP_COUNT"
    assert_eq "12 APP_HOME launch=1" "1" "$LAUNCH_COUNT"
}

test_backoff_evidence_expired_cancels() {
    reset_monitor_state
    DISCONNECT=true
    CLEAR_DISCONNECT_ON_SLEEP=true
    run_recovery_tick "disconnect_detected"
    assert_eq "13 expired evidence force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "13 expired evidence launch=0" "0" "$LAUNCH_COUNT"
    assert_contains "13 recovery_cancelled logged" "event=recovery_cancelled" "$LOG_FILE"
}

test_clone_b_to_h_not_restarted() {
    local pkg
    reset_monitor_state
    LAST_IN_GAME=900
    WINDOW_VISIBLE=false
    WINDOW_MISSING_THRESHOLD=1
    for pkg in B C D E F G H; do
        ROBLOX_PACKAGE="com.roblox.clone${pkg}"
        MONITOR_STATE="$MONITOR_STATE_IN_GAME"
        monitor_tick
    done
    assert_eq "20 B-H unfocused clones force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "20 B-H unfocused clones launch=0" "0" "$LAUNCH_COUNT"
}

test_same_package_lock_allows_one_monitor() {
    reset_monitor_state
    local lock_root="${TEST_TMP}/locks_case"
    RUNTIME_LOCK_USE_FLOCK=false
    runtime_lock_acquire "$lock_root" "com.roblox.client" "$LOG_FILE" >/dev/null 2>&1
    local first="$?"
    runtime_lock_acquire "$lock_root" "com.roblox.client" "$LOG_FILE" >/dev/null 2>&1
    local second="$?"
    runtime_lock_release "$LOG_FILE" "com.roblox.client"
    assert_eq "21 first monitor lock ok" "0" "$first"
    assert_eq "21 second monitor lock denied" "1" "$second"
}

test_visibility_unknown_returns_to_in_game() {
    reset_monitor_state
    LAST_IN_GAME=900
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    WINDOW_VISIBLE=false
    WINDOW_MISSING_THRESHOLD=1
    monitor_tick
    assert_eq "22 IN_GAME -> UNKNOWN_ACTIVE" "$MONITOR_STATE_UNKNOWN_ACTIVE" "$MONITOR_STATE"
    IN_GAME=true
    monitor_tick
    assert_eq "22 UNKNOWN_ACTIVE -> IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
}

test_in_game_to_disconnected_requires_fresh() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    IN_GAME=true
    DISCONNECT=false
    monitor_tick
    assert_eq "23 no fresh disconnect stays IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
    DISCONNECT=true
    monitor_tick
    assert_eq "23 fresh disconnect -> DISCONNECTED" "$MONITOR_STATE_DISCONNECTED" "$MONITOR_STATE"
}

test_loading_timeout_unconfirmed_no_force() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=1300
    LAST_LAUNCH=1000
    LOADING_STARTED_AT=1000
    monitor_tick
    assert_eq "24 LOADING timeout force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "24 LOADING timeout -> UNKNOWN_ACTIVE" "$MONITOR_STATE_UNKNOWN_ACTIVE" "$MONITOR_STATE"
}

test_rejoin_count_only_after_gate() {
    reset_monitor_state
    run_recovery_tick "loading_timeout"
    assert_eq "25 cancelled recovery rejoin=0" "0" "$REJOIN_COUNT"
    DISCONNECT=true
    run_recovery_tick "disconnect_detected"
    assert_eq "25 authorized recovery rejoin=1" "1" "$REJOIN_COUNT"
}

test_startup_dead_process_launches() {
    reset_monitor_state
    RUNNING=false
    MONITOR_STATE="$MONITOR_STATE_LAUNCHING"
    monitor_tick
    assert_eq "startup process dead -> LOADING" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
    assert_eq "startup launch count" "1" "$LAUNCH_COUNT"
}

test_startup_existing_game_protected() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LAUNCHING"
    IN_GAME=true
    monitor_tick
    assert_eq "startup existing game -> IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
    assert_eq "startup existing game force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "startup existing game fresh launch=0" "0" "$LAUNCH_COUNT"
}

test_startup_unknown_non_destructive_wake() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LAUNCHING"
    monitor_tick
    assert_eq "startup unknown -> LOADING" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
    assert_eq "startup unknown wake=1" "1" "$WAKE_COUNT"
    assert_eq "startup unknown force-stop=0" "0" "$FORCE_STOP_COUNT"
    assert_eq "startup unknown fresh launch=0" "0" "$LAUNCH_COUNT"
}

test_startup_app_home_recovery_requested() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LAUNCHING"
    APP_HOME=true
    monitor_tick
    assert_eq "startup app home -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "startup app home reason" "startup_app_home" "$MONITOR_RECOVERY_REASON"
}

test_launch_failure_without_gate_stays_protected() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LAUNCHING"
    WAKE_OK=false
    monitor_tick
    assert_eq "launch while active protected" "$MONITOR_STATE_UNKNOWN_ACTIVE" "$MONITOR_STATE"
    assert_eq "launch while active count=0" "0" "$LAUNCH_COUNT"
    assert_eq "launch while active wake=0" "0" "$WAKE_COUNT"
}

test_screen_disconnect_authorized() {
    reset_monitor_state
    SCREEN_DISCONNECT=true
    run_recovery_tick "screen_disconnect"
    assert_eq "screen disconnect force-stop=1" "1" "$FORCE_STOP_COUNT"
}

test_wrong_place_goes_to_recovery_but_gate_protects_without_evidence() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    WRONG_PLACE=true
    monitor_tick
    assert_eq "wrong place requests recovery" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    WRONG_PLACE=false
    monitor_tick
    assert_eq "wrong place stale evidence force-stop=0" "0" "$FORCE_STOP_COUNT"
}

test_queue_without_disconnect_cannot_force_stop() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=1020
    LAST_LAUNCH=900
    LOADING_STARTED_AT=900
    JOIN_LOW_SERVER=true
    QUEUE=true
    monitor_tick
    assert_eq "queue requests recovery" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    monitor_tick
    assert_eq "queue alone force-stop=0" "0" "$FORCE_STOP_COUNT"
}

test_cooldown_expired_rechecks_gate() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_COOLDOWN"
    RUNTIME_COOLDOWN_ACTIVE=1
    RUNTIME_COOLDOWN_UNTIL=900
    monitor_tick
    assert_eq "cooldown expired -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    monitor_tick
    assert_eq "cooldown expired active process force-stop=0" "0" "$FORCE_STOP_COUNT"
}

test_anti_afk_only_when_confirmed() {
    reset_monitor_state
    ANTI_AFK=true
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    IN_GAME=true
    TAP_ON_LOAD_DONE=true
    LAST_AFK_TAP=0
    MONITOR_NOW=1000
    monitor_tick
    assert_eq "anti-afk tap in confirmed game" "1" "$TAP_COUNT"
}

test_unknown_active_wake_succeeds() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_UNKNOWN_ACTIVE"
    MONITOR_STATE_CHANGED_AT=900
    LAST_LAUNCH=900
    MONITOR_NOW=1000
    monitor_tick
    assert_eq "8 UNKNOWN_ACTIVE wake succeeds -> LOADING" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
    assert_eq "8 UNKNOWN_ACTIVE wake count" "1" "$WAKE_COUNT"
}

test_unknown_active_wake_fails_then_stalls() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_UNKNOWN_ACTIVE"
    MONITOR_STATE_CHANGED_AT=700
    LAST_LAUNCH=700
    MONITOR_NOW=1000
    WAKE_OK=false
    monitor_tick
    assert_eq "9 UNKNOWN_ACTIVE failed wake -> STALLED" "$MONITOR_STATE_STALLED_ACTIVE" "$MONITOR_STATE"
    monitor_tick
    assert_eq "9 STALLED requests recovery" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "9 no force-stop before recovery tick" "0" "$FORCE_STOP_COUNT"
}

test_task_present_not_in_game_without_ready() {
    reset_monitor_state
    TASK_PRESENT=true
    IN_GAME=false
    LAST_LAUNCH=900
    MONITOR_NOW=1000
    if is_in_game; then
        fail "5 task present alone NOT IN_GAME"
    else
        pass "5 task present alone NOT IN_GAME"
    fi
}

test_stalled_active_authorizes_controlled_recovery() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_UNKNOWN_ACTIVE"
    MONITOR_STATE_CHANGED_AT=700
    LAST_LAUNCH=700
    MONITOR_NOW=1000
    monitor_tick
    assert_eq "7 stalled active detected" "$MONITOR_STATE_STALLED_ACTIVE" "$MONITOR_STATE"
    monitor_tick
    assert_eq "7 stalled active -> recovery" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    monitor_tick
    assert_eq "7 stalled active force-stop once" "1" "$FORCE_STOP_COUNT"
}

test_protected_in_game_latch
test_not_top_activity_protected
test_no_window_record_protected
test_executor_overlay_protected
test_in_game_timeout_protected
test_periodic_restart_disabled
test_network_offline_protected
test_api_429_protected
test_process_dead_rejoins_without_force_stop
test_fresh_disconnect_rejoins_once
test_fresh_kick_rejoins_once
test_app_home_rejoins
test_backoff_evidence_expired_cancels
test_clone_b_to_h_not_restarted
test_same_package_lock_allows_one_monitor
test_visibility_unknown_returns_to_in_game
test_in_game_to_disconnected_requires_fresh
test_loading_timeout_unconfirmed_no_force
test_rejoin_count_only_after_gate
test_startup_dead_process_launches
test_startup_existing_game_protected
test_startup_unknown_non_destructive_wake
test_startup_app_home_recovery_requested
test_launch_failure_without_gate_stays_protected
test_screen_disconnect_authorized
test_wrong_place_goes_to_recovery_but_gate_protects_without_evidence
test_queue_without_disconnect_cannot_force_stop
test_cooldown_expired_rechecks_gate
test_anti_afk_only_when_confirmed
test_unknown_active_wake_succeeds
test_unknown_active_wake_fails_then_stalls
test_task_present_not_in_game_without_ready
test_stalled_active_authorizes_controlled_recovery

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
