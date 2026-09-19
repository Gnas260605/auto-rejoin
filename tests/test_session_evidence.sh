#!/usr/bin/env bash
# ==============================================================================
# Unit Tests for Session Evidence Engine & Multi-Signal Classifier (Phase P1.1)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Source evidence library
# shellcheck source=lib/session_evidence.sh
source "${PROJECT_ROOT}/lib/session_evidence.sh"

TEST_COUNT=0
PASS_COUNT=0
FAIL_COUNT=0

assert_eq() {
    local label="$1"
    local expected="$2"
    local actual="$3"
    TEST_COUNT=$((TEST_COUNT + 1))
    if [ "$expected" = "$actual" ]; then
        PASS_COUNT=$((PASS_COUNT + 1))
        echo "PASS ${label}"
    else
        FAIL_COUNT=$((FAIL_COUNT + 1))
        echo "FAIL ${label} (expected '${expected}', got '${actual}')"
    fi
}

assert_state() {
    local label="$1"
    local expected_state="$2"
    local classification="$3"
    local actual_state
    actual_state="$(echo "$classification" | cut -d'|' -f1)"
    assert_eq "${label} state" "$expected_state" "$actual_state"
}

echo "=== Scenario 1: Active In-Game Session ==="
ev_game_active="process_alive=true
task_present=true
window_record=true
window_visible=true
window_focused=true
resumed_activity=com.roblox.client/com.roblox.client.ActivityProtocolLaunch
last_event=GAME_READY
observed_place=123456789
observed_universe=987654321
game_ready=true
disconnected=false
network_online=true
expected_place=123456789
expected_universe=987654321"

res="$(session_classify "$ev_game_active")"
assert_state "Scenario 1: Active Game" "GAME_ACTIVE" "$res"


echo "=== Scenario 2: Closed Freeform Window (Process Running, Stale Task) ==="
ev_window_closed="process_alive=true
task_present=true
window_record=false
window_visible=false
window_focused=false
resumed_activity=com.android.launcher3/.QuickstepLauncher
last_event=NONE
observed_place=
game_ready=false
disconnected=false
network_online=true
expected_place=123456789"

res="$(session_classify "$ev_window_closed")"
assert_state "Scenario 2: Closed Freeform Window" "WINDOW_CLOSED" "$res"


echo "=== Scenario 3: Roblox Home Screen (MainActivity, No Active Game) ==="
ev_home="process_alive=true
task_present=true
window_record=true
window_visible=true
window_focused=true
resumed_activity=com.roblox.client/com.roblox.client.RobloxMainActivity
last_event=LAUNCH_STARTED
observed_place=
game_ready=false
disconnected=false
network_online=true
expected_place=123456789"

res="$(session_classify "$ev_home")"
assert_state "Scenario 3: Home Screen" "APP_HOME" "$res"


echo "=== Scenario 4: Disconnected / Kicked ==="
ev_kicked="process_alive=true
task_present=true
window_record=true
window_visible=true
window_focused=true
resumed_activity=com.roblox.client/com.roblox.client.ActivityProtocolLaunch
last_event=KICKED
observed_place=123456789
game_ready=false
disconnected=true
disconnect_reason=kicked
network_online=true
expected_place=123456789"

res="$(session_classify "$ev_kicked")"
assert_state "Scenario 4: Kicked Session" "KICKED" "$res"


echo "=== Scenario 5: Wrong Place (Different Universe) ==="
ev_wrong_place="process_alive=true
task_present=true
window_record=true
window_visible=true
window_focused=true
resumed_activity=com.roblox.client/com.roblox.client.ActivityProtocolLaunch
last_event=GAME_READY
observed_place=999999999
observed_universe=555555555
game_ready=true
disconnected=false
network_online=true
expected_place=123456789
expected_universe=987654321
transit_places=111111,222222
allowed_places=123456789"

res="$(session_classify "$ev_wrong_place")"
assert_state "Scenario 5: Wrong Place" "WRONG_PLACE" "$res"


echo "=== Scenario 6: Same Universe Transit Place (Lobby) ==="
ev_lobby="process_alive=true
task_present=true
window_record=true
window_visible=true
window_focused=true
resumed_activity=com.roblox.client/com.roblox.client.ActivityProtocolLaunch
last_event=GAME_READY
observed_place=111111
observed_universe=987654321
game_ready=true
disconnected=false
network_online=true
expected_place=123456789
expected_universe=987654321
transit_places=111111,222222
allowed_places=123456789"

res="$(session_classify "$ev_lobby")"
assert_state "Scenario 6: Transit Lobby" "LOBBY" "$res"


echo "=== Scenario 7: Handshake Only (Joining / Not Active Yet) ==="
ev_joining="process_alive=true
task_present=true
window_record=true
window_visible=true
window_focused=true
resumed_activity=com.roblox.client/com.roblox.client.ActivityProtocolLaunch
last_event=JOIN_STARTED
observed_place=123456789
game_ready=false
disconnected=false
network_online=true
expected_place=123456789"

res="$(session_classify "$ev_joining")"
assert_state "Scenario 7: Handshake Only" "JOINING" "$res"


echo "=== Scenario 8: Network Offline ==="
ev_offline="process_alive=true
task_present=true
window_record=true
window_visible=true
network_online=false
expected_place=123456789"

res="$(session_classify "$ev_offline")"
assert_state "Scenario 8: Network Offline" "OFFLINE" "$res"


echo "=== Scenario 9: Process Dead ==="
ev_dead="process_alive=false
task_present=false
window_visible=false
network_online=true
expected_place=123456789"

res="$(session_classify "$ev_dead")"
assert_state "Scenario 9: Process Dead" "PROCESS_DEAD" "$res"


echo "=================================================="
echo "Session Evidence Tests: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
echo "=================================================="
[ "$FAIL_COUNT" -eq 0 ]
