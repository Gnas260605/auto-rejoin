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

test_cookie_clean
test_cookie_validate_empty

echo "test_cookie.sh: PASS=${TEST_PASS} FAIL=${TEST_FAIL}"
[ "$TEST_FAIL" -eq 0 ] || exit 1
