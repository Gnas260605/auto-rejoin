#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/network.sh
source "${REPO_DIR}/lib/network.sh"

TEST_TMP="$(mktemp -d)"
FAKE_BIN="${TEST_TMP}/bin"
LOG_FILE="${TEST_TMP}/curl.log"
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

assert_status() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" -eq "$actual" ]; then pass "$name"; else fail "$name expected $expected got $actual"; fi
}

write_fake() {
    local name="$1"; shift
    printf '%s\n' "$@" > "${FAKE_BIN}/${name}"
    chmod +x "${FAKE_BIN}/${name}"
}

setup_fakes() {
    mkdir -p "$FAKE_BIN"
    write_fake curl \
        '#!/usr/bin/env bash' \
        'printf "curl argc=%s\n" "$#" >> "$NETWORK_TEST_LOG"' \
        'i=1; for arg in "$@"; do printf "curl arg%s=%s\n" "$i" "$arg" >> "$NETWORK_TEST_LOG"; i=$((i+1)); done' \
        '[ "${CURL_FAIL:-0}" = "1" ] && exit 22' \
        'printf "OK\n"'
    write_fake ping \
        '#!/usr/bin/env bash' \
        '[ "${PING_OK:-0}" = "1" ] && exit 0' \
        'exit 1'
    export PATH="${FAKE_BIN}:${PATH}"
    export NETWORK_TEST_LOG="$LOG_FILE"
}

reset_log() { : > "$LOG_FILE"; }

get_success() {
    reset_log
    CURL_FAIL=0 network_get "https://example.test/status" >/dev/null
    assert_status "GET success" 0 "$?"
    assert_contains "GET has fail" "--fail" "$LOG_FILE"
    assert_contains "GET has location" "--location" "$LOG_FILE"
    assert_contains "GET has connect timeout" "--connect-timeout" "$LOG_FILE"
    assert_contains "GET has max time" "--max-time" "$LOG_FILE"
    assert_contains "GET has retry" "--retry" "$LOG_FILE"
    assert_contains "GET has retry delay" "--retry-delay" "$LOG_FILE"
}

get_failure() {
    reset_log
    CURL_FAIL=1 network_get "https://example.test/fail" >/dev/null 2>&1
    assert_status "GET failure" 22 "$?"
}

download_success() {
    reset_log
    CURL_FAIL=0 network_download "https://example.test/file" "${TEST_TMP}/out.bin" >/dev/null
    assert_status "download success" 0 "$?"
    assert_contains "download has output" "-o" "$LOG_FILE"
}

download_failure() {
    reset_log
    CURL_FAIL=1 network_download "https://example.test/file" "${TEST_TMP}/out.bin" >/dev/null 2>&1
    assert_status "download failure" 22 "$?"
}

secure_download_success() {
    reset_log
    CURL_FAIL=0 network_download_secure_https "https://example.test/file" "${TEST_TMP}/secure.bin" 120 3 1048576 >/dev/null
    assert_status "secure download success" 0 "$?"
    assert_contains "secure download proto" "--proto" "$LOG_FILE"
    assert_contains "secure download proto redir" "--proto-redir" "$LOG_FILE"
    assert_contains "secure download max filesize" "--max-filesize" "$LOG_FILE"
}

online_true() {
    reset_log
    PING_OK=1 network_is_online
    assert_status "online true" 0 "$?"
}

online_false() {
    reset_log
    PING_OK=0 CURL_FAIL=1 network_is_online
    if [ "$?" -ne 0 ]; then
        pass "online false"
    else
        fail "online false expected non-zero"
    fi
}

setup_fakes
get_success
get_failure
download_success
download_failure
secure_download_success
online_true
online_false

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
