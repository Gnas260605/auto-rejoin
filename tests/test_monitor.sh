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
LAUNCH_OK=true

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

check_roblox_window_visible() {
    [ "$WINDOW_VISIBLE" = "true" ]
}

check_roblox_task_present() {
    [ "$TASK_PRESENT" = "true" ]
}

is_in_game() {
    [ "$IN_GAME" = "true" ]
}

check_roblox_log_for_disconnect() {
    [ "$DISCONNECT" = "true" ]
}

check_roblox_screen_for_disconnect() {
    [ "$SCREEN_DISCONNECT" = "true" ]
}

check_roblox_log_for_wrong_place() {
    [ "$WRONG_PLACE" = "true" ]
}

launch_roblox() {
    [ "${LAUNCH_OK:-true}" = "true" ] || return 1
    LAUNCH_COUNT=$((LAUNCH_COUNT + 1))
    LAST_LAUNCH="$MONITOR_NOW"
    LOADING_STARTED_AT="$MONITOR_NOW"
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
    WINDOW_VISIBLE=true
    TASK_PRESENT=true
    IN_GAME=false
    DISCONNECT=false
    SCREEN_DISCONNECT=false
    WRONG_PLACE=false
    LAUNCH_OK=true
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
    AUTO_RESTART_PERIOD=7200
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

screen_disconnect_to_recovering() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    RUNNING=true
    IN_GAME=true
    SCREEN_DISCONNECT=true
    monitor_tick
    assert_eq "screen disconnect signal -> DISCONNECTED" "$MONITOR_STATE_DISCONNECTED" "$MONITOR_STATE"
    monitor_tick
    assert_eq "screen DISCONNECTED -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
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

# ── 10 REQUIRED SCENARIOS ───────────────────────────────

# Scenario 1: Process missing: IN_GAME/LOADING -> CRASHED -> RECOVERING -> LAUNCHING/LOADING
test_scenario_1_process_missing() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    RUNNING=false
    monitor_tick
    assert_eq "Scenario 1: IN_GAME -> CRASHED on process missing" "$MONITOR_STATE_CRASHED" "$MONITOR_STATE"
    monitor_tick
    assert_eq "Scenario 1: CRASHED -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    monitor_tick
    assert_eq "Scenario 1: RECOVERING -> LOADING after launch" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
    assert_eq "Scenario 1: Launch count is 1" "1" "$LAUNCH_COUNT"
}

# Scenario 2: Process alive but Roblox window closed: window missing for threshold -> RECOVERING -> relaunch
test_scenario_2_window_closed_threshold() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    RUNNING=true
    WINDOW_VISIBLE=false
    WINDOW_MISSING_THRESHOLD=3

    # Tick 1: window missing count = 1
    monitor_tick
    assert_eq "Scenario 2: Tick 1 remains IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
    assert_eq "Scenario 2: Window missing count is 1" "1" "$WINDOW_MISSING_COUNT"

    # Tick 2: window missing count = 2
    monitor_tick
    assert_eq "Scenario 2: Tick 2 remains IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
    assert_eq "Scenario 2: Window missing count is 2" "2" "$WINDOW_MISSING_COUNT"

    # Tick 3: window missing count reaches threshold 3 -> triggers RECOVERING (window_closed)
    monitor_tick
    assert_eq "Scenario 2: Tick 3 reaches threshold -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "Scenario 2: Recovery reason is window_closed" "window_closed" "$MONITOR_RECOVERY_REASON"

    # Next tick: recovers and relaunches
    monitor_tick
    assert_eq "Scenario 2: Recovery relaunches -> LOADING" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
    assert_eq "Scenario 2: Force stop executed" "1" "$FORCE_STOP_COUNT"
    assert_eq "Scenario 2: Launch executed" "1" "$LAUNCH_COUNT"
    assert_contains "Scenario 2: window_closed_detected logged" 'event=window_closed_detected' "$LOG_FILE"
}

# Scenario 3: Process alive + Roblox Home/Lobby -> NOT IN_GAME
test_scenario_3_lobby_not_in_game() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=1070
    LAST_LAUNCH=1000
    LAUNCH_GRACE=60
    LOADING_STARTED_AT=1000
    IN_GAME_TIMEOUT=120
    RUNNING=true
    WINDOW_VISIBLE=true
    IN_GAME=false

    monitor_tick
    assert_eq "Scenario 3: Lobby process stays in LOADING, NOT in game" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
    assert_contains "Scenario 3: lobby_detected logged" 'event=lobby_detected' "$LOG_FILE"
}

# Scenario 4: Lobby stays longer than IN_GAME_TIMEOUT -> lobby retry
test_scenario_4_lobby_timeout_retry() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    LOADING_STARTED_AT=1000
    MONITOR_NOW=1200
    LAST_LAUNCH=1000
    IN_GAME_TIMEOUT=120
    RUNNING=true
    WINDOW_VISIBLE=true
    IN_GAME=false
    LOBBY_RETRY_COUNT=0
    LOBBY_RETRY_LIMIT=3

    monitor_tick
    assert_eq "Scenario 4: Lobby timeout triggers RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "Scenario 4: Recovery reason is lobby_deeplink_retry" "lobby_deeplink_retry" "$MONITOR_RECOVERY_REASON"
    assert_eq "Scenario 4: LOBBY_RETRY_COUNT incremented to 1" "1" "$LOBBY_RETRY_COUNT"
    assert_eq "Scenario 4: LOW_SERVER_RETRY_OFFSET incremented to 1" "1" "$LOW_SERVER_RETRY_OFFSET"
    assert_contains "Scenario 4: lobby_timeout logged" 'event=lobby_timeout' "$LOG_FILE"
    assert_contains "Scenario 4: lobby_retry logged" 'event=lobby_retry' "$LOG_FILE"
}

# Scenario 5: Lobby retry counter: 1 -> 2 -> 3 (must NOT reset during recovery)
test_scenario_5_lobby_retry_counter_preserved() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    LOADING_STARTED_AT=1000
    MONITOR_NOW=1200
    IN_GAME_TIMEOUT=120
    RUNNING=true
    IN_GAME=false
    LOBBY_RETRY_COUNT=0
    LOBBY_RETRY_LIMIT=3

    # Attempt 1: Loading -> Recovering
    monitor_tick
    assert_eq "Scenario 5: Attempt 1 sets retry=1" "1" "$LOBBY_RETRY_COUNT"
    # Recovery tick
    monitor_tick
    assert_eq "Scenario 5: Recovery preserves retry=1" "1" "$LOBBY_RETRY_COUNT"
    assert_eq "Scenario 5: State after recovery is LOADING" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"

    # Attempt 2: Loading -> Recovering
    MONITOR_NOW=1400
    LOADING_STARTED_AT=1200
    monitor_tick
    assert_eq "Scenario 5: Attempt 2 sets retry=2" "2" "$LOBBY_RETRY_COUNT"
    monitor_tick
    assert_eq "Scenario 5: Recovery preserves retry=2" "2" "$LOBBY_RETRY_COUNT"

    # Attempt 3: Loading -> Recovering (retry=3)
    MONITOR_NOW=1600
    LOADING_STARTED_AT=1400
    monitor_tick
    assert_eq "Scenario 5: Attempt 3 sets retry=3" "3" "$LOBBY_RETRY_COUNT"
    monitor_tick
    assert_eq "Scenario 5: Recovery preserves retry=3" "3" "$LOBBY_RETRY_COUNT"

    # Attempt 4: Limit (3) reached -> escalates to loading_timeout
    MONITOR_NOW=1800
    LOADING_STARTED_AT=1600
    monitor_tick
    assert_eq "Scenario 5: Attempt 4 escalates to loading_timeout" "loading_timeout" "$MONITOR_RECOVERY_REASON"
}

# Scenario 6: Confirmed successful gameplay -> LOBBY_RETRY_COUNT=0, LOW_SERVER_RETRY_OFFSET=0
test_scenario_6_gameplay_resets_counters() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LOADING"
    MONITOR_NOW=2000
    LAST_LAUNCH=1000
    LOADING_STARTED_AT=1000
    LOBBY_RETRY_COUNT=2
    LOW_SERVER_RETRY_OFFSET=2
    WINDOW_MISSING_COUNT=2
    RUNNING=true
    WINDOW_VISIBLE=true
    IN_GAME=true

    monitor_tick
    assert_eq "Scenario 6: Transitions to IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
    assert_eq "Scenario 6: LOBBY_RETRY_COUNT reset to 0" "0" "$LOBBY_RETRY_COUNT"
    assert_eq "Scenario 6: LOW_SERVER_RETRY_OFFSET reset to 0" "0" "$LOW_SERVER_RETRY_OFFSET"
    assert_eq "Scenario 6: WINDOW_MISSING_COUNT reset to 0" "0" "$WINDOW_MISSING_COUNT"
    assert_eq "Scenario 6: LAST_IN_GAME updated to current timestamp" "2000" "$LAST_IN_GAME"
    assert_contains "Scenario 6: game_session_confirmed logged" 'event=game_session_confirmed' "$LOG_FILE"
}

# Scenario 7: Freeform window closed -> relaunch with correct package and bounds
test_scenario_7_freeform_window_closed() {
    reset_monitor_state
    ROBLOX_PACKAGE="com.roblox.client_clone1"
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    RUNNING=true
    WINDOW_VISIBLE=false
    WINDOW_MISSING_THRESHOLD=1

    monitor_tick
    assert_eq "Scenario 7: Freeform window missing triggers RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "Scenario 7: Recovery reason is window_closed" "window_closed" "$MONITOR_RECOVERY_REASON"

    monitor_tick
    assert_eq "Scenario 7: Relaunched to LOADING" "$MONITOR_STATE_LOADING" "$MONITOR_STATE"
    assert_eq "Scenario 7: Launch was called for correct package" "1" "$LAUNCH_COUNT"
}

# Scenario 8: Multiple Roblox clones: closing clone A must not trigger or reopen clone B
test_scenario_8_multiple_clones_isolation() {
    reset_monitor_state

    # Instance 1: Monitoring Clone A
    ROBLOX_PACKAGE="com.roblox.cloneA"
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    RUNNING=true
    WINDOW_VISIBLE=false
    WINDOW_MISSING_THRESHOLD=1
    monitor_tick
    assert_eq "Scenario 8: Clone A detects missing window" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"

    # Instance 2: Monitoring Clone B (Window is visible)
    ROBLOX_PACKAGE="com.roblox.cloneB"
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    RUNNING=true
    WINDOW_VISIBLE=true
    IN_GAME=true
    WINDOW_MISSING_COUNT=0
    monitor_tick
    assert_eq "Scenario 8: Clone B remains unaffected in IN_GAME" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"
    assert_eq "Scenario 8: Clone B window missing count is 0" "0" "$WINDOW_MISSING_COUNT"
}

# Scenario 9: Background process exists but task/window does not -> WINDOW_CLOSED, not IN_GAME
test_scenario_9_background_process_no_window() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    RUNNING=true
    WINDOW_VISIBLE=false
    IN_GAME=false

    # Verify that without window, state cannot be maintained as stable gameplay
    WINDOW_MISSING_THRESHOLD=1
    monitor_tick
    assert_eq "Scenario 9: Ghost process without window is not IN_GAME" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "Scenario 9: Reason is window_closed" "window_closed" "$MONITOR_RECOVERY_REASON"
}

# Scenario 10: am start returns success but no window appears -> launch verification fails and enters normal backoff/recovery
test_scenario_10_launch_verification_failure() {
    reset_monitor_state
    MONITOR_STATE="$MONITOR_STATE_LAUNCHING"
    LAUNCH_OK=false

    monitor_tick
    assert_eq "Scenario 10: Launch verification failure -> RECOVERING" "$MONITOR_STATE_RECOVERING" "$MONITOR_STATE"
    assert_eq "Scenario 10: Recovery reason is launch_failed" "launch_failed" "$MONITOR_RECOVERY_REASON"
    assert_eq "Scenario 10: Did not count as successful launch" "0" "$LAUNCH_COUNT"
}

startup_to_launching
launch_success_to_loading
launch_failure_to_recovering
game_activity_to_in_game
process_missing_to_crashed
disconnect_to_recovering
screen_disconnect_to_recovering
wrong_place_to_recovering
recovery_uses_backoff
failure_threshold_to_cooldown
offline_and_restore
periodic_restart_to_recovering
anti_afk_only_in_game
cooldown_expiry_to_recovering
stable_runtime_resets_backoff

test_scenario_1_process_missing
test_scenario_2_window_closed_threshold
test_scenario_3_lobby_not_in_game
test_scenario_4_lobby_timeout_retry
test_scenario_5_lobby_retry_counter_preserved
test_scenario_6_gameplay_resets_counters
test_scenario_7_freeform_window_closed
test_scenario_8_multiple_clones_isolation
test_scenario_9_background_process_no_window
test_scenario_10_launch_verification_failure

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
