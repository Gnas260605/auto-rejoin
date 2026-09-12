#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/delta.sh
source "${PROJECT_DIR}/lib/delta.sh"

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

test_delta_empty_hwid() {
    if delta_resolve_key ""; then
        echo "FAIL: empty hwid should not resolve" >&2
        TEST_FAIL=$((TEST_FAIL + 1))
    else
        TEST_PASS=$((TEST_PASS + 1))
    fi
}

test_delta_empty_hwid

echo "test_delta.sh: PASS=${TEST_PASS} FAIL=${TEST_FAIL}"
[ "$TEST_FAIL" -eq 0 ] || exit 1
