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

echo "=== Test Scenario 5: Stale Disconnect Before Launch Is Ignored ==="
session_reset "$PKG"
STALE_LOG="${TEST_LOG_DIR}/stale_279.log"
cat > "$STALE_LOG" <<EOF
2026-09-18T08:00:00.000Z [Error] lost connection to the game, error code: 279
EOF
session_begin "$PKG" "123456789" >/dev/null
cat >> "$STALE_LOG" <<EOF
2026-09-18T09:00:00.000Z [Info] heartbeat after launch
EOF
session_poll_incremental "$PKG" "$STALE_LOG" >/dev/null
assert_eq "14 stale error before launch not disconnected" "false" "$([ "$(session_is_disconnected "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"

echo "=== Test Scenario 6: Fresh Disconnect After Launch Is Detected ==="
session_reset "$PKG"
FRESH_LOG="${TEST_LOG_DIR}/fresh_279.log"
printf '2026 old clean line\n' > "$FRESH_LOG"
session_begin "$PKG" "123456789" >/dev/null
cat >> "$FRESH_LOG" <<EOF
2026-09-18T09:10:00.000Z [Error] disconnected from server, error code: 279
EOF
session_poll_incremental "$PKG" "$FRESH_LOG" >/dev/null
assert_eq "15 fresh error after launch disconnected" "true" "$([ "$(session_is_disconnected "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"

echo "=== Test Scenario 7: Same Inode New Session Does Not Re-read Old Error ==="
session_reset "$PKG"
SAME_LOG="${TEST_LOG_DIR}/same_inode.log"
cat > "$SAME_LOG" <<EOF
2026-09-18T09:15:00.000Z [Error] you have been kicked from this game
EOF
session_begin "$PKG" "123456789" >/dev/null
cat >> "$SAME_LOG" <<EOF
2026-09-18T09:16:00.000Z [Info] clean append only
EOF
session_poll_incremental "$PKG" "$SAME_LOG" >/dev/null
assert_eq "16 same inode old error ignored" "false" "$([ "$(session_is_disconnected "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"

echo "=== Test Scenario 8: Log Rotation Reads New File From Zero ==="
session_reset "$PKG"
ROTATE_OLD="${TEST_LOG_DIR}/rotate_old.log"
ROTATE_NEW="${TEST_LOG_DIR}/rotate_new.log"
printf 'old clean line\n' > "$ROTATE_OLD"
session_begin "$PKG" "123456789" >/dev/null
session_poll_incremental "$PKG" "$ROTATE_OLD" >/dev/null
cat > "$ROTATE_NEW" <<EOF
2026-09-18T09:20:00.000Z [Error] server was shut down
EOF
session_poll_incremental "$PKG" "$ROTATE_NEW" >/dev/null
assert_eq "17 rotated new file disconnect detected" "true" "$([ "$(session_is_disconnected "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"
offset_after_rotate="$(cat "$(session_runtime_dir "$PKG")/log_offset")"
session_poll_incremental "$PKG" "$ROTATE_NEW" >/dev/null
assert_eq "17 rotated file not re-read" "$offset_after_rotate" "$(cat "$(session_runtime_dir "$PKG")/log_offset")"

echo "=== Test Scenario 9: Log Truncate Recovers Without Replaying Old Event ==="
session_reset "$PKG"
TRUNC_LOG="${TEST_LOG_DIR}/truncate.log"
cat > "$TRUNC_LOG" <<EOF
2026-09-18T09:25:00.000Z [Info] Game joined successfully
EOF
session_begin "$PKG" "123456789" >/dev/null
cat >> "$TRUNC_LOG" <<EOF
2026-09-18T09:26:00.000Z [Info] heartbeat
EOF
session_poll_incremental "$PKG" "$TRUNC_LOG" >/dev/null
printf 'short clean log\n' > "$TRUNC_LOG"
session_poll_incremental "$PKG" "$TRUNC_LOG" >/dev/null
assert_eq "18 truncate does not create disconnect" "false" "$([ "$(session_is_disconnected "$PKG" && echo true || echo false)" = "true" ] && echo true || echo false)"

echo "=== Test Scenario 10: Multi-Package Cursor Isolation ==="
PKG_A="com.roblox.cloneA"
PKG_B="com.roblox.cloneB"
session_reset "$PKG_A"
session_reset "$PKG_B"
LOG_A="${TEST_LOG_DIR}/cloneA.log"
LOG_B="${TEST_LOG_DIR}/cloneB.log"
printf 'clean A\n' > "$LOG_A"
printf 'clean B\n' > "$LOG_B"
session_begin "$PKG_A" "123456789" >/dev/null
session_begin "$PKG_B" "123456789" >/dev/null
printf '2026 [Error] same account launched from different device\n' >> "$LOG_A"
printf '2026 [Info] heartbeat B\n' >> "$LOG_B"
session_poll_incremental "$PKG_A" "$LOG_A" >/dev/null
session_poll_incremental "$PKG_B" "$LOG_B" >/dev/null
assert_eq "19 clone A disconnected" "true" "$([ "$(session_is_disconnected "$PKG_A" && echo true || echo false)" = "true" ] && echo true || echo false)"
assert_eq "19 clone B isolated" "false" "$([ "$(session_is_disconnected "$PKG_B" && echo true || echo false)" = "true" ] && echo true || echo false)"


# Cleanup
rm -rf "$SESSION_RUNTIME_BASE" "$TEST_LOG_DIR"

echo "=================================================="
echo "Roblox Session Tests: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT}"
echo "=================================================="
[ "$FAIL_COUNT" -eq 0 ]
