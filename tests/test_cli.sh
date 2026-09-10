#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
CLI="${REPO_DIR}/bin/roblox-manager"
TEST_TMP="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -rf "$TEST_TMP"; }
trap cleanup EXIT

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_status() {
    local name="$1" expected="$2"
    shift 2
    "$@" > "${TEST_TMP}/out" 2> "${TEST_TMP}/err"
    local status=$?
    if [ "$status" -eq "$expected" ]; then pass "$name status"; else fail "$name status expected=$expected actual=$status"; fi
}

assert_contains() {
    local name="$1" pattern="$2" file="$3"
    if grep -q -- "$pattern" "$file"; then pass "$name"; else fail "$name"; fi
}

help_command() {
    assert_status "help" 0 "$CLI" help
    assert_contains "help output" "parse-link" "${TEST_TMP}/out"
    assert_contains "help license output" "license" "${TEST_TMP}/out"
}

version_command() {
    local expected_ver
    expected_ver="$(tr -d '\r\n' < "${REPO_DIR}/VERSION")"
    assert_status "version" 0 "$CLI" version
    assert_contains "version output" "$expected_ver" "${TEST_TMP}/out"
}

parse_link_human() {
    assert_status "parse-link valid" 0 "$CLI" parse-link "https://www.roblox.com/games/2753915549/Test"
    assert_contains "human type" "Type     : game" "${TEST_TMP}/out"
    assert_contains "human place" "Place ID : 2753915549" "${TEST_TMP}/out"
    assert_contains "human uri" "roblox://experiences/start?placeId=2753915549" "${TEST_TMP}/out"
}

parse_link_env() {
    assert_status "parse-link env" 0 "$CLI" parse-link --format env "https://www.roblox.com/share?type=Server&code=ABC123"
    assert_contains "env type" "TYPE=private_server" "${TEST_TMP}/out"
    assert_contains "env code" "PRIVATE_CODE=ABC123" "${TEST_TMP}/out"
}

parse_link_quiet() {
    assert_status "parse-link quiet" 0 "$CLI" parse-link --quiet "roblox://experiences/start?placeId=123"
    assert_contains "quiet env place" "PLACE_ID=123" "${TEST_TMP}/out"
}

parse_invalid() {
    assert_status "parse-link invalid" 1 "$CLI" parse-link "https://roblox.com.evil.example/games/123/Test"
    assert_contains "invalid error" "invalid Roblox link" "${TEST_TMP}/err"
}

missing_argument() {
    assert_status "parse-link missing arg" 2 "$CLI" parse-link
    assert_contains "missing arg error" "missing URL or Place ID" "${TEST_TMP}/err"
}

unknown_command() {
    assert_status "unknown command" 2 "$CLI" nope
    assert_contains "unknown command error" "unknown command" "${TEST_TMP}/err"
}

profile_help() {
    assert_status "profile help" 0 "$CLI" profile help
    assert_contains "profile help output" "roblox-manager profile create" "${TEST_TMP}/out"
}

profile_unknown() {
    assert_status "profile unknown" 2 "$CLI" profile wat
    assert_contains "profile unknown error" "unknown profile command" "${TEST_TMP}/err"
}

install_help() {
    assert_status "install-roblox help" 0 "$CLI" install-roblox --help
    assert_contains "install-roblox help output" "HTTPS_APK_URL" "${TEST_TMP}/out"
}

install_http_rejected() {
    assert_status "install-roblox http" 2 "$CLI" install-roblox --dry-run "http://example.com/Roblox.apk"
    assert_contains "install-roblox http error" "must use HTTPS" "${TEST_TMP}/err"
}

license_status_command() {
    AUTO_REJOIN_APP_DIR="${TEST_TMP}/license-app" assert_status "license status" 0 "$CLI" license status
    assert_contains "license status output" "License Status: NOT_ACTIVATED" "${TEST_TMP}/out"
}

license_help_command() {
    assert_status "license help" 0 "$CLI" license help
    assert_contains "license help output" "roblox-manager license activate" "${TEST_TMP}/out"
}

license_unknown_command() {
    assert_status "license unknown" 2 "$CLI" license wat
    assert_contains "license unknown error" "unknown license command" "${TEST_TMP}/err"
}

update_help_command() {
    assert_status "update help" 0 "$CLI" update help
    assert_contains "update help output" "roblox-manager update check" "${TEST_TMP}/out"
}

self_test_command() {
    assert_status "self-test" 0 "$CLI" self-test
    assert_contains "self-test output" "Self-test passed." "${TEST_TMP}/out"
}

support_bundle_command() {
    assert_status "help support-bundle" 0 "$CLI" help
    assert_contains "help support-bundle output" "support-bundle" "${TEST_TMP}/out"
}

outside_cwd() {
    (
        cd "$TEST_TMP" || exit 2
        "$CLI" parse-link --quiet "2753915549"
    ) > "${TEST_TMP}/out" 2> "${TEST_TMP}/err"
    local status=$?
    if [ "$status" -eq 0 ]; then pass "outside cwd status"; else fail "outside cwd status expected=0 actual=$status"; fi
    assert_contains "outside cwd output" "PLACE_ID=2753915549" "${TEST_TMP}/out"
}

help_command
version_command
parse_link_human
parse_link_env
parse_link_quiet
parse_invalid
missing_argument
unknown_command
profile_help
profile_unknown
install_help
install_http_rejected
license_status_command
license_help_command
license_unknown_command
update_help_command
support_bundle_command
self_test_command
outside_cwd

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
