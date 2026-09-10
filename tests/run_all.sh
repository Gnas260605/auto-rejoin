#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

total_passed=0
total_failed=0

cd "$ROOT_DIR" || exit 1

for test_file in tests/test_*.sh; do
    [ -f "$test_file" ] || continue
    echo "=================================================="
    echo "Running: $test_file"
    echo "=================================================="
    if bash "$test_file"; then
        echo "--> SUCCESS: $test_file"
        total_passed=$((total_passed + 1))
    else
        echo "--> FAILED: $test_file"
        total_failed=$((total_failed + 1))
    fi
done

echo ""
echo "=================================================="
echo "ALL TEST SUITES SUMMARY"
echo "Passed Suites: $total_passed"
echo "Failed Suites: $total_failed"
echo "=================================================="

[ "$total_failed" -eq 0 ]
