#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/network.sh
source "${REPO_DIR}/lib/network.sh"
# shellcheck source=../lib/logger.sh
source "${REPO_DIR}/lib/logger.sh"
# shellcheck source=../lib/notification.sh
source "${REPO_DIR}/lib/notification.sh"

TEST_TMP="$(mktemp -d)"
FAKE_BIN="${TEST_TMP}/bin"
CURL_LOG="${TEST_TMP}/curl.log"
PAYLOAD_FILE="${TEST_TMP}/payload.json"
MARKER="${TEST_TMP}/notify-pwned"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -rf "$TEST_TMP"; }
trap cleanup EXIT

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_status() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" -eq "$actual" ]; then pass "$name"; else fail "$name expected $expected got $actual"; fi
}

assert_no_marker() {
    local name="$1"
    if [ ! -e "$MARKER" ]; then pass "$name"; else fail "$name marker created"; fi
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
        ': > "$NOTIFY_CURL_LOG"' \
        'while [ "$#" -gt 0 ]; do' \
        '  printf "%s\n" "$1" >> "$NOTIFY_CURL_LOG"' \
        '  if [ "$1" = "--data-binary" ]; then shift; printf "%s" "$1" > "$NOTIFY_PAYLOAD_FILE"; fi' \
        '  shift' \
        'done' \
        'exit 0'
    export PATH="${FAKE_BIN}:${PATH}"
    export NOTIFY_CURL_LOG="$CURL_LOG"
    export NOTIFY_PAYLOAD_FILE="$PAYLOAD_FILE"
}

reset_case() {
    : > "$CURL_LOG"
    : > "$PAYLOAD_FILE"
    rm -f "$MARKER"
}

send_message_case() {
    local label="$1"
    local message="$2"
    reset_case
    notification_send_discord "https://discord.com/api/webhooks/123/token" "$message"
    assert_status "$label status" 0 "$?"
    grep -q -- "--data-binary" "$CURL_LOG" && pass "$label used json post" || fail "$label missing json post"
    assert_no_marker "$label did not execute"
}

payload_json_shape() {
    local payload
    reset_case
    notification_send_discord "https://discord.com/api/webhooks/123/token" 'He said "test"\path'
    payload="$(cat "$PAYLOAD_FILE")"
    case "$payload" in
        *content*) pass "payload has content key" ;;
        *) fail "payload missing content key" ;;
    esac
    case "$payload" in
        *test*) pass "payload preserves quote content" ;;
        *) fail "payload quote content missing" ;;
    esac
}

redacts_webhook() {
    local redacted
    redacted="$(notification_redact_webhook "https://discord.com/api/webhooks/123/token")"
    if [ "$redacted" = "https://discord.com/api/webhooks/***" ]; then
        pass "webhook redacted"
    else
        fail "webhook redacted got $redacted"
    fi
}

setup_fakes
send_message_case "normal text" "Hello"
send_message_case "double quote" 'He said "test"'
send_message_case "backslash" 'C:\path\file'
send_message_case "newline" $'line1\nline2'
send_message_case "tab" $'col1\tcol2'
send_message_case "emoji unicode" "✅ Xin chào"
send_message_case "json-like" '{"fake":"json"}'
send_message_case "command substitution" "\$(touch '$MARKER')"
send_message_case "backticks" "\`touch '$MARKER'\`"
send_message_case "semicolon ampersand" "hello; touch '$MARKER' & still text"
payload_json_shape
redacts_webhook

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
