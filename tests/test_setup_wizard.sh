#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SETUP_TEST_DIR="${ROOT_DIR}/tmp/test_setup_wizard"
CONFIG_FILE="${SETUP_TEST_DIR}/config.env"
PASS_COUNT=0
FAIL_COUNT=0

rm -rf "$SETUP_TEST_DIR"
mkdir -p "$SETUP_TEST_DIR"

cleanup() {
    rm -rf "$SETUP_TEST_DIR"
}
trap cleanup EXIT

assert_status() {
    local name="$1"
    local actual="$2"
    local expected="$3"
    if [ "$actual" -eq "$expected" ]; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name expected $expected got $actual"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

assert_file_contains() {
    local name="$1"
    local file="$2"
    local needle="$3"
    if grep -Fq -- "$needle" "$file"; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name"
        echo "Expected file to contain: $needle"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

assert_file_not_contains() {
    local name="$1"
    local file="$2"
    local needle="$3"
    if ! grep -Fq -- "$needle" "$file"; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name"
        echo "Expected file not to contain: $needle"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

cmd_output="$("${ROOT_DIR}/bin/roblox-manager" setup --non-interactive --config-file "$CONFIG_FILE" --link 'https://www.roblox.com/games/123456/Test' --package com.roblox.client --anti-afk false)"
status=$?
assert_status "setup game status" "$status" 0
assert_file_contains "setup game place" "$CONFIG_FILE" 'PLACE_ID="123456"'
assert_file_contains "setup game private empty" "$CONFIG_FILE" 'PRIVATE_CODE=""'
assert_file_contains "setup game package" "$CONFIG_FILE" 'ROBLOX_PACKAGE="com.roblox.client"'
assert_file_contains "setup game anti afk" "$CONFIG_FILE" 'ANTI_AFK=false'
assert_file_contains "setup output" <(printf '%s' "$cmd_output") 'Config saved:'

cmd_output="$("${ROOT_DIR}/bin/roblox-manager" setup --non-interactive --config-file "$CONFIG_FILE" --link 'https://www.roblox.com/share?type=Server&code=AbC_123' --package com.roblox.client)"
status=$?
assert_status "setup private status" "$status" 0
assert_file_contains "setup private code" "$CONFIG_FILE" 'PRIVATE_CODE="AbC_123"'
assert_file_contains "setup backup created" <(find "$SETUP_TEST_DIR" -name 'config.env.backup.*' -print) 'config.env.backup.'

marker="${SETUP_TEST_DIR}/marker"
bad_output="$("${ROOT_DIR}/bin/roblox-manager" setup --non-interactive --config-file "$CONFIG_FILE" --link 'https://evil.com/games/1/$(touch tmp/test_setup_wizard/marker)' --package com.roblox.client 2>&1)"
status=$?
assert_status "setup invalid status" "$status" 1
assert_file_contains "setup invalid error" <(printf '%s' "$bad_output") 'invalid Roblox link'
if [ ! -e "$marker" ]; then
    echo "PASS setup malicious not executed"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo "FAIL setup malicious not executed"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi
assert_file_not_contains "setup no command substitution persisted" "$CONFIG_FILE" '$(touch'

missing_output="$("${ROOT_DIR}/bin/roblox-manager" setup --non-interactive --config-file "$CONFIG_FILE" 2>&1)"
status=$?
assert_status "setup missing link status" "$status" 2
assert_file_contains "setup missing link error" <(printf '%s' "$missing_output") '--non-interactive requires --link'

# shellcheck source=../lib/config.sh
source "${ROOT_DIR}/lib/config.sh"
# shellcheck source=../lib/roblox.sh
source "${ROOT_DIR}/lib/roblox.sh"
# shellcheck source=../lib/ui.sh
source "${ROOT_DIR}/lib/ui.sh"

ui_detect_roblox_packages() {
    return 0
}

installer_install_roblox() {
    printf '%s\n' "$1" > "${SETUP_TEST_DIR}/installer-called"
    return 0
}

wizard_config="${SETUP_TEST_DIR}/wizard.env"
wizard_output="$(printf '%s\n%s\n%s\n%s\n%s\n' \
    'https://www.roblox.com/games/987654/Test' \
    'https://example.com/Roblox.apk' \
    '' \
    '' \
    'true' | ui_setup_wizard "$ROOT_DIR" "$wizard_config" 2>&1)"
status=$?
assert_status "setup wizard install offer status" "$status" 0
assert_file_contains "setup wizard called installer" "${SETUP_TEST_DIR}/installer-called" 'https://example.com/Roblox.apk'
assert_file_contains "setup wizard config place" "$wizard_config" 'PLACE_ID="987654"'
assert_file_contains "setup wizard config package" "$wizard_config" 'ROBLOX_PACKAGE="com.roblox.client"'

echo
echo "${PASS_COUNT} passed, ${FAIL_COUNT} failed"
[ "$FAIL_COUNT" -eq 0 ]
