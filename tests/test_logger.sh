#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/logger.sh
source "${REPO_DIR}/lib/logger.sh"

TEST_TMP="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -rf "$TEST_TMP"; }
trap cleanup EXIT

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_contains() {
    local name="$1" pattern="$2" file="$3"
    if grep -q -- "$pattern" "$file"; then pass "$name"; else fail "$name"; fi
}

info_warn_error_lines() {
    local file="${TEST_TMP}/logs/app.log"
    log_info "hello" "$file"
    log_warn "careful" "$file"
    log_error "broken" "$file"
    assert_contains "INFO line written" " INFO event=message " "$file"
    assert_contains "WARN line written" " WARN event=message " "$file"
    assert_contains "ERROR line written" " ERROR event=message " "$file"
}

secret_redaction() {
    local file="${TEST_TMP}/secret.log"
    log_info "webhook https://discord.com/api/webhooks/123/token" "$file"
    assert_contains "secret redacted" "https://discord.com/api/webhooks/\\*\\*\\*" "$file"
    if grep -q "123/token" "$file"; then
        fail "secret leaked"
    else
        pass "secret not leaked"
    fi
}

directory_auto_create() {
    local file="${TEST_TMP}/nested/path/app.log"
    log_info "created" "$file"
    [ -f "$file" ] && pass "directory auto-create" || fail "directory auto-create"
}

rotation_threshold() {
    local file="${TEST_TMP}/rotate.log"
    LOG_MAX_BYTES=20
    LOG_KEEP_FILES=3
    printf '012345678901234567890123456789\n' > "$file"
    log_info "rotated" "$file"
    [ -f "${file}.1" ] && pass "rotation file naming" || fail "rotation file naming"
    assert_contains "rotation new file written" "rotated" "$file"
}

write_failure_nonfatal() {
    local dir="${TEST_TMP}/as-file"
    local status
    mkdir -p "$dir"
    log_info "cannot append to directory" "$dir"
    status=$?
    [ "$status" -eq 0 ] && pass "write failure does not kill caller" || fail "write failure returned $status"
}

info_warn_error_lines
secret_redaction
directory_auto_create
rotation_threshold
write_failure_nonfatal

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
