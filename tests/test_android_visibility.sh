#!/usr/bin/env bash
# ==============================================================================
# Unit Tests for Android Window Visibility Engine (Phase P0.2)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Source android library
# shellcheck source=lib/android.sh
source "${PROJECT_ROOT}/lib/android.sh"

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

assert_status() {
    local label="$1"
    local expected="$2"
    local actual="$3"
    assert_eq "${label} status" "$expected" "$actual"
}

FIXTURES_DIR="${SCRIPT_DIR}/fixtures/android"

echo "=== Test Scenario 1: Visible Window with active surface ==="
android_dumpsys() {
    local service="$1"
    local sub="$2"
    if [ "$service" = "window" ] && [ "$sub" = "windows" ]; then
        cat "${FIXTURES_DIR}/dumpsys_window_visible.txt"
    elif [ "$service" = "activity" ] && [ "$sub" = "top" ]; then
        cat "${FIXTURES_DIR}/dumpsys_activity_top_game.txt"
    fi
}

st=0; android_has_window_record "com.roblox.client" || st=$?
assert_status "has_window_record returns 0 for visible window" 0 "$st"

st=0; android_is_window_surface_visible "com.roblox.client" || st=$?
assert_status "is_window_surface_visible returns 0 for drawn surface" 0 "$st"

st=0; android_is_window_focused "com.roblox.client" || st=$?
assert_status "is_window_focused returns 0 for focused window" 0 "$st"

st=0; android_is_window_visible "com.roblox.client" || st=$?
assert_status "is_window_visible returns 0 for visible window" 0 "$st"

act="$(android_get_resumed_activity "com.roblox.client")"
assert_eq "resumed_activity returns Game Activity" "com.roblox.client/com.roblox.client.ActivityProtocolLaunch" "$act"


echo "=== Test Scenario 2: Closed Freeform Window (Process Alive, Task in Stack) ==="
# In this scenario, dumpsys window windows has no Roblox surface, and activity top is Launcher.
# But activity stack still retains a stale TaskRecord.
android_dumpsys() {
    local service="$1"
    local sub="$2"
    if [ "$service" = "window" ] && [ "$sub" = "windows" ]; then
        cat "${FIXTURES_DIR}/dumpsys_window_freeform_closed.txt"
    elif [ "$service" = "activity" ] && [ "$sub" = "top" ]; then
        # Top activity is launcher
        cat <<EOF
ACTIVITY MANAGER TOP ACTIVITY (dumpsys activity top)
  ACTIVITY com.android.launcher3/.uioverrides.QuickstepLauncher 112233 pid=567
    mResumed=true
EOF
    elif [ "$service" = "activity" ] && [ "$sub" = "activities" ]; then
        # Activity stack contains stale task
        cat "${FIXTURES_DIR}/dumpsys_activity_task_stale.txt"
    fi
}

st=0; android_has_window_record "com.roblox.client" || st=$?
assert_status "has_window_record returns 1 for closed window" 1 "$st"

st=0; android_is_window_surface_visible "com.roblox.client" || st=$?
assert_status "is_window_surface_visible returns 1 for closed window" 1 "$st"

st=0; android_is_window_focused "com.roblox.client" || st=$?
assert_status "is_window_focused returns 1 for closed window" 1 "$st"

st=0; android_is_window_visible "com.roblox.client" || st=$?
assert_status "is_window_visible returns 1 (NOT visible) despite stale task" 1 "$st"

st=0; android_is_task_present "com.roblox.client" || st=$?
assert_status "is_task_present returns 0 for stale task in memory" 0 "$st"


echo "=== Test Scenario 3: Roblox Home Screen (MainActivity Resumed) ==="
android_dumpsys() {
    local service="$1"
    local sub="$2"
    if [ "$service" = "window" ] && [ "$sub" = "windows" ]; then
        cat <<EOF
WINDOW MANAGER WINDOWS (dumpsys window windows)
  Window #1 Window{998877 u0 com.roblox.client/com.roblox.client.RobloxMainActivity}:
    mHasSurface=true mViewVisibility=0x0
  mCurrentFocus=Window{998877 u0 com.roblox.client/com.roblox.client.RobloxMainActivity}
EOF
    elif [ "$service" = "activity" ] && [ "$sub" = "top" ]; then
        cat "${FIXTURES_DIR}/dumpsys_activity_top_home.txt"
    fi
}

st=0; android_is_window_visible "com.roblox.client" || st=$?
assert_status "is_window_visible returns 0 for Home screen" 0 "$st"

act="$(android_get_resumed_activity "com.roblox.client")"
assert_eq "resumed_activity returns RobloxMainActivity" "com.roblox.client/com.roblox.client.RobloxMainActivity" "$act"


echo "=================================================="
echo "Android Visibility Tests: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
echo "=================================================="
[ "$FAIL_COUNT" -eq 0 ]
