#!/usr/bin/env bash
# ==============================================================================
# Unit Tests for Incremental Roblox Session Log Parser (Phase P0.3)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

export SESSION_RUNTIME_BASE="${PROJECT_ROOT}/tmp/test_session_runtime"
rm -rf "$SESSION_RUNTIME_BASE"
mkdir -p "$SESSION_RUNTIME_BASE"

# Source session library
# shellcheck source=lib/roblox_session.sh
source "${PROJECT_ROOT}/lib/roblox_session.sh"

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

FIXTURES_DIR="${SCRIPT_DIR}/fixtures/roblox_logs"
TEST_LOG_DIR="${PROJECT_ROOT}/tmp/test_logs"
rm -rf "$TEST_LOG_DIR"
mkdir -p "$TEST_LOG_DIR"
export ROBLOX_LOG_MOCK_DIR="$TEST_LOG_DIR"

PKG="com.roblox.client"

echo "=== Test Scenario 1: Session Begin and State Initialization ==="
session_id="$(session_begin "$PKG" "123456789")"
[[ "$session_id" =~ ^com\.roblox\.client_[0-9]+_1$ ]] || assert_eq "session_id format" "valid" "$session_id"
assert_eq "session_begin event" "LAUNCH_STARTED" "$(session_get_latest_event "$PKG")"
assert_eq "game_ready initial" "false" "$([ "$(session_is_game_ready "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"


echo "=== Test Scenario 2: Incremental Log Polling - Handshake to Game Ready ==="
# Write initial handshake chunk
LOG_FILE="${TEST_LOG_DIR}/roblox_session.log"
cat "${FIXTURES_DIR}/join_handshake_only.log" > "$LOG_FILE"

session_poll_incremental "$PKG" "$LOG_FILE" >/dev/null

assert_eq "observed place from handshake" "123456789" "$(session_get_observed_place "$PKG")"
assert_eq "event from handshake" "JOIN_STARTED" "$(session_get_latest_event "$PKG")"
assert_eq "game_ready after handshake" "false" "$([ "$(session_is_game_ready "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"

# Append Game Ready chunk (Simulating incremental real-time append)
cat <<EOF >> "$LOG_FILE"
2026-09-18T09:00:06.000Z,6.000,1234,6 [Info] Connected to game server: 10.0.0.1|50000 (gameId: 11111111-2222-3333-4444-555555555555)
2026-09-18T09:00:07.000Z,7.000,1234,6 [Info] UniverseId: 987654321
2026-09-18T09:00:08.000Z,8.000,1234,6 [Info] Game joined successfully
EOF

session_poll_incremental "$PKG" "$LOG_FILE" >/dev/null

assert_eq "observed universe" "987654321" "$(session_get_observed_universe "$PKG")"
assert_eq "observed job" "11111111-2222-3333-4444-555555555555" "$(session_get_observed_job "$PKG")"
assert_eq "event after game joined" "GAME_READY" "$(session_get_latest_event "$PKG")"
assert_eq "game_ready true" "true" "$([ "$(session_is_game_ready "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"


echo "=== Test Scenario 3: Disconnect and Kick Detection ==="
# Append Disconnect error
cat <<EOF >> "$LOG_FILE"
2026-09-18T09:15:00.000Z,900.000,1234,6 [Error] Disconnected from server: You have been kicked by the server: AFK
EOF

session_poll_incremental "$PKG" "$LOG_FILE" >/dev/null

assert_eq "event after kick" "KICKED" "$(session_get_latest_event "$PKG")"
assert_eq "disconnected true" "true" "$([ "$(session_is_disconnected "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"
assert_eq "game_ready false after disconnect" "false" "$([ "$(session_is_game_ready "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"


echo "=== Test Scenario 4: Log File Rotation / Reset on New Session ==="
# Start new session
new_session_id="$(session_begin "$PKG" "123456789")"
[[ "$new_session_id" =~ ^com\.roblox\.client_[0-9]+_2$ ]] || assert_eq "new session gen 2" "valid" "$new_session_id"
assert_eq "new session reset event" "LAUNCH_STARTED" "$(session_get_latest_event "$PKG")"
assert_eq "new session reset disconnected" "false" "$([ "$(session_is_disconnected "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"

# Create a brand new log file
LOG_FILE_2="${TEST_LOG_DIR}/roblox_session_2.log"
cat "${FIXTURES_DIR}/join_success.log" > "$LOG_FILE_2"

session_poll_incremental "$PKG" "$LOG_FILE_2" >/dev/null
assert_eq "new log file game_ready" "true" "$([ "$(session_is_game_ready "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"


# Cleanup
rm -rf "$SESSION_RUNTIME_BASE" "$TEST_LOG_DIR"

echo "=================================================="
echo "Roblox Session Tests: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
echo "=================================================="
[ "$FAIL_COUNT" -eq 0 ]
