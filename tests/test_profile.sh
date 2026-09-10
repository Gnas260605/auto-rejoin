#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_TEST_DIR="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() {
    rm -rf "$PROFILE_TEST_DIR"
}
trap cleanup EXIT

# shellcheck source=../lib/config.sh
source "${ROOT_DIR}/lib/config.sh"
# shellcheck source=../lib/roblox.sh
source "${ROOT_DIR}/lib/roblox.sh"
# shellcheck source=../lib/ui.sh
source "${ROOT_DIR}/lib/ui.sh"
# shellcheck source=../lib/profile.sh
source "${ROOT_DIR}/lib/profile.sh"

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    printf 'PASS %s\n' "$1"
}

fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf 'FAIL %s\n' "$1"
}

assert_status() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" -eq "$actual" ]; then
        pass "$name"
    else
        fail "$name: expected status $expected, got $actual"
    fi
}

assert_contains() {
    local name="$1"
    local haystack="$2"
    local needle="$3"
    if [[ "$haystack" == *"$needle"* ]]; then
        pass "$name"
    else
        fail "$name: expected to find [$needle]"
    fi
}

assert_file_contains() {
    local name="$1"
    local file="$2"
    local needle="$3"
    if grep -Fq -- "$needle" "$file"; then
        pass "$name"
    else
        fail "$name: expected $file to contain [$needle]"
    fi
}

DISCORD_WEBHOOK="https://discord.com/api/webhooks/123/secret-token"
ANTI_AFK="false"
export DISCORD_WEBHOOK ANTI_AFK

profile_create "$PROFILE_TEST_DIR" BloxFruits 'https://www.roblox.com/games/2753915549/Blox-Fruits' com.roblox.client
assert_status "profile create status" 0 "$?"

profile_path="${PROFILE_TEST_DIR}/config/profiles/BloxFruits.conf"
assert_file_contains "profile file place" "$profile_path" 'PLACE_ID="2753915549"'
assert_file_contains "profile file name" "$profile_path" 'PROFILE="BloxFruits"'
assert_file_contains "profile file package" "$profile_path" 'ROBLOX_PACKAGE="com.roblox.client"'
assert_file_contains "profile file anti afk" "$profile_path" 'ANTI_AFK=false'

list_output="$(profile_list "$PROFILE_TEST_DIR")"
assert_contains "profile list output" "$list_output" "BloxFruits"

show_output="$(profile_show "$PROFILE_TEST_DIR" BloxFruits)"
assert_status "profile show status" 0 "$?"
assert_contains "profile show redacts webhook" "$show_output" 'DISCORD_WEBHOOK="***"'

profile_apply "$PROFILE_TEST_DIR" BloxFruits Acc01 com.roblox.client_clone1
assert_status "profile apply alias status" 0 "$?"
target_path="${PROFILE_TEST_DIR}/config_Acc01.cfg"
assert_file_contains "profile apply target profile" "$target_path" 'PROFILE="BloxFruits"'
assert_file_contains "profile apply target package override" "$target_path" 'ROBLOX_PACKAGE="com.roblox.client_clone1"'

profile_apply "$PROFILE_TEST_DIR" BloxFruits com.roblox.client_clone2
assert_status "profile apply package target status" 0 "$?"
target_pkg_path="${PROFILE_TEST_DIR}/config_com.roblox.client_clone2.cfg"
assert_file_contains "profile apply package target" "$target_pkg_path" 'ROBLOX_PACKAGE="com.roblox.client_clone2"'

profile_create "$PROFILE_TEST_DIR" '../bad' 123 com.roblox.client >/dev/null 2>&1
assert_status "profile invalid create status" 2 "$?"

profile_apply "$PROFILE_TEST_DIR" BloxFruits '../bad' >/dev/null 2>&1
assert_status "profile invalid target status" 2 "$?"

profile_show "$PROFILE_TEST_DIR" Missing >/dev/null 2>&1
assert_status "profile missing show status" 1 "$?"

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
