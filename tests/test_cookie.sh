#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/cookie.sh
source "${PROJECT_DIR}/lib/cookie.sh"

TEST_PASS=0
TEST_FAIL=0

assert_eq() {
    local desc="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" = "$actual" ]; then
        TEST_PASS=$((TEST_PASS + 1))
    else
        echo "FAIL: $desc (expected '$expected', got '$actual')" >&2
        TEST_FAIL=$((TEST_FAIL + 1))
    fi
}

test_cookie_clean() {
    local cleaned
    cleaned="$(cookie_clean_token "  _ |WARNING:-DO-NOT-SHARE-THIS  ")"
    assert_eq "cookie clean whitespace" "_ |WARNING:-DO-NOT-SHARE-THIS" "$cleaned"
}

test_cookie_validate_empty() {
    if cookie_validate ""; then
        echo "FAIL: empty cookie should not validate" >&2
        TEST_FAIL=$((TEST_FAIL + 1))
    else
        TEST_PASS=$((TEST_PASS + 1))
    fi
}

test_cookie_export_blocked() {
    if cookie_export_all "/tmp/roblox-cookie-export.txt"; then
        echo "FAIL: cookie export should be blocked" >&2
        TEST_FAIL=$((TEST_FAIL + 1))
    else
        assert_eq "cookie export blocked reason" "Raw Roblox cookie export is disabled because cookies are login credentials. Use the official Roblox login flow in the app." "$COOKIE_LAST_ERROR"
    fi
}

test_cookie_import_blocked() {
    if cookie_import_package "com.roblox.client" "secret-cookie"; then
        echo "FAIL: cookie import should be blocked" >&2
        TEST_FAIL=$((TEST_FAIL + 1))
    else
        assert_eq "cookie import blocked reason" "Raw Roblox cookie import into com.roblox.client is disabled because it injects login credentials. Use the official Roblox login flow in the app." "$COOKIE_LAST_ERROR"
    fi
}

test_cookie_clean
test_cookie_validate_empty
test_cookie_export_blocked
test_cookie_import_blocked

echo "test_cookie.sh: PASS=${TEST_PASS} FAIL=${TEST_FAIL}"
[ "$TEST_FAIL" -eq 0 ] || exit 1
