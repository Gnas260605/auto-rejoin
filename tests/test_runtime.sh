#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/logger.sh
source "${REPO_DIR}/lib/logger.sh"
# shellcheck source=../lib/runtime.sh
source "${REPO_DIR}/lib/runtime.sh"

TEST_TMP="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -rf "$TEST_TMP"; }
trap cleanup EXIT

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

reset_runtime_state() {
    RUNTIME_LOCK_PATH=""
    RUNTIME_LOCK_METHOD=""
    RUNTIME_LOCK_FD=""
    RUNTIME_BACKOFF_FAILURES=0
    RUNTIME_FAILURE_HISTORY=""
    RUNTIME_COOLDOWN_UNTIL=0
    RUNTIME_COOLDOWN_ACTIVE=0
    RUNTIME_LOCK_USE_FLOCK=false
}

assert_eq() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then pass "$name"; else fail "$name expected=[$expected] actual=[$actual]"; fi
}

lock_first_success() {
    reset_runtime_state
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client" "${TEST_TMP}/runtime.log"
    assert_eq "acquire first lock" "0" "$?"
    [ -d "${TEST_TMP}/locks/com.roblox.client.lockdir" ] && pass "lockdir created" || fail "lockdir created"
    runtime_lock_release "${TEST_TMP}/runtime.log" "com.roblox.client"
}

lock_second_same_package_fails() {
    reset_runtime_state
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client" "${TEST_TMP}/runtime.log"
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client" "${TEST_TMP}/runtime.log" >/dev/null 2>&1
    assert_eq "second same package denied" "1" "$?"
    runtime_lock_release "${TEST_TMP}/runtime.log" "com.roblox.client"
}

lock_different_packages_succeed() {
    reset_runtime_state
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client" "${TEST_TMP}/runtime.log"
    assert_eq "first package lock success" "0" "$?"
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client_clone1" "${TEST_TMP}/runtime.log"
    assert_eq "different package lock success" "0" "$?"
    rm -rf "${TEST_TMP}/locks/com.roblox.client.lockdir"
    runtime_lock_release "${TEST_TMP}/runtime.log" "com.roblox.client_clone1"
}

release_then_reacquire() {
    reset_runtime_state
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client" "${TEST_TMP}/runtime.log"
    runtime_lock_release "${TEST_TMP}/runtime.log" "com.roblox.client"
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client" "${TEST_TMP}/runtime.log"
    assert_eq "release then reacquire" "0" "$?"
    runtime_lock_release "${TEST_TMP}/runtime.log" "com.roblox.client"
}

stale_pid_recovers() {
    reset_runtime_state
    local lock_dir="${TEST_TMP}/locks/com.roblox.client.lockdir"
    mkdir -p "$lock_dir"
    printf '999999\n' > "${lock_dir}/pid"
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client" "${TEST_TMP}/runtime.log"
    assert_eq "stale pid recovered" "0" "$?"
    assert_eq "stale pid replaced" "$$" "$(cat "${lock_dir}/pid")"
    runtime_lock_release "${TEST_TMP}/runtime.log" "com.roblox.client"
}

malformed_lock_recovers() {
    reset_runtime_state
    local lock_dir="${TEST_TMP}/locks/com.roblox.client.lockdir"
    mkdir -p "$lock_dir"
    printf 'not-a-pid\n' > "${lock_dir}/pid"
    runtime_lock_acquire "$TEST_TMP" "com.roblox.client" "${TEST_TMP}/runtime.log"
    assert_eq "malformed lock recovered" "0" "$?"
    runtime_lock_release "${TEST_TMP}/runtime.log" "com.roblox.client"
}

path_traversal_rejected() {
    reset_runtime_state
    runtime_lock_acquire "$TEST_TMP" "../../abc" "${TEST_TMP}/runtime.log" >/dev/null 2>&1
    assert_eq "path traversal package rejected" "2" "$?"
    [ ! -e "${TEST_TMP}/abc.lockdir" ] && pass "path traversal did not create outside lock" || fail "path traversal did not create outside lock"
}

backoff_sequence() {
    reset_runtime_state
    assert_eq "backoff failure 1" "5" "$(runtime_backoff_next 1)"
    assert_eq "backoff failure 2" "10" "$(runtime_backoff_next 2)"
    assert_eq "backoff failure 3" "20" "$(runtime_backoff_next 3)"
    assert_eq "backoff failure 4" "40" "$(runtime_backoff_next 4)"
    assert_eq "backoff failure 5 cap" "60" "$(runtime_backoff_next 5)"
    assert_eq "backoff failure 6 cap" "60" "$(runtime_backoff_next 6)"
    runtime_failure_record 100
    runtime_backoff_reset
    assert_eq "backoff reset" "5" "$(runtime_backoff_next)"
}

cooldown_policy() {
    reset_runtime_state
    RUNTIME_FAILURE_LIMIT=3
    RUNTIME_FAILURE_WINDOW_SECONDS=10
    RUNTIME_COOLDOWN_SECONDS=30
    runtime_failure_record 100
    runtime_failure_record 105
    if runtime_should_cooldown 106; then fail "below threshold no cooldown"; else pass "below threshold no cooldown"; fi
    runtime_failure_record 106
    if runtime_should_cooldown 106; then pass "threshold reached cooldown"; else fail "threshold reached cooldown"; fi
    runtime_cooldown_start 106
    if runtime_cooldown_is_active 120; then pass "cooldown active"; else fail "cooldown active"; fi
    if runtime_cooldown_is_active 137; then fail "cooldown expiry"; else pass "cooldown expiry"; fi
    runtime_failure_reset
    runtime_failure_record 100
    runtime_failure_record 105
    runtime_failure_record 120
    assert_eq "old failures pruned" "1" "$(runtime_failure_count 120)"
    runtime_cooldown_reset
    if runtime_cooldown_is_active 120; then fail "cooldown reset"; else pass "cooldown reset"; fi
}

term_cleanup_removes_lock() {
    reset_runtime_state
    local script="${TEST_TMP}/hold_lock.sh"
    local lock_dir="${TEST_TMP}/locks/com.roblox.client.lockdir"
    cat > "$script" <<EOF
#!/usr/bin/env bash
source "${REPO_DIR}/lib/logger.sh"
source "${REPO_DIR}/lib/runtime.sh"
RUNTIME_LOCK_USE_FLOCK=false
trap 'runtime_lock_release "${TEST_TMP}/term.log" "com.roblox.client"' EXIT
trap 'runtime_lock_release "${TEST_TMP}/term.log" "com.roblox.client"; exit 0' TERM INT
runtime_lock_acquire "${TEST_TMP}" "com.roblox.client" "${TEST_TMP}/term.log" || exit 1
while true; do sleep 1; done
EOF
    chmod +x "$script"
    bash "$script" &
    local pid=$!
    local i=0
    while [ "$i" -lt 20 ] && [ ! -d "$lock_dir" ]; do
        sleep 0.1
        i=$((i + 1))
    done
    kill -TERM "$pid" 2>/dev/null || true
    wait "$pid" 2>/dev/null || true
    i=0
    while [ "$i" -lt 20 ] && [ -d "$lock_dir" ]; do
        sleep 0.1
        i=$((i + 1))
    done
    [ ! -d "$lock_dir" ] && pass "TERM cleanup releases lock" || fail "TERM cleanup releases lock"
}

lock_first_success
lock_second_same_package_fails
lock_different_packages_succeed
release_then_reacquire
stale_pid_recovers
malformed_lock_recovers
path_traversal_rejected
backoff_sequence
cooldown_policy
term_cleanup_removes_lock

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
