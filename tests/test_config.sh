#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/config.sh
source "${REPO_DIR}/lib/config.sh"

TEST_TMP="$(mktemp -d)"
MARKER="${TEST_TMP}/config-parser-pwned"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() {
    rm -rf "$TEST_TMP"
}
trap cleanup EXIT

reset_config_vars() {
    unset PLACE_ID PRIVATE_CODE ROBLOX_PACKAGE CHECK_INTERVAL AUTO_RESTART_PERIOD
    unset ANTI_AFK AFK_TAP_INTERVAL TAP_X TAP_Y DISCORD_WEBHOOK ROBLOX_USERNAME
    unset PROFILE
    unset FREEFORM_LAYOUT FREEFORM_WIDTH FREEFORM_HEIGHT FREEFORM_OFFSET_X FREEFORM_OFFSET_Y
    unset LICENSE_MODE AUTO_REJOIN_LICENSE_MODE
    unset JOIN_LOW_SERVER LOW_SERVER_MIN_PLAYERS LOW_SERVER_MAX_PLAYERS LOW_SERVER_STRICT
    unset ALLOW_UNSCOPED_DEEPLINK ALLOW_HOME_FALLBACK
    CONFIG_WARNINGS=""
}

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    printf 'PASS %s\n' "$1"
}

fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf 'FAIL %s\n' "$1"
}

assert_eq() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" = "$actual" ]; then
        pass "$name"
    else
        fail "$name: expected [$expected], got [$actual]"
    fi
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

write_config() {
    local file="$1"
    shift
    printf '%s\n' "$@" > "$file"
}

run_load() {
    local file="$1"
    reset_config_vars
    config_load "$file"
}

valid_config() {
    local cfg="${TEST_TMP}/valid.cfg"
    write_config "$cfg" \
        'PLACE_ID=2753915549' \
        'PRIVATE_CODE=abc123' \
        'ROBLOX_PACKAGE=com.roblox.client' \
        'CHECK_INTERVAL=30' \
        'AUTO_RESTART_PERIOD=7200' \
        'ANTI_AFK=true' \
        'AFK_TAP_INTERVAL=180' \
        'TAP_X=540' \
        'TAP_Y=960' \
        'DISCORD_WEBHOOK=https://discord.com/api/webhooks/example' \
        'ROBLOX_USERNAME=Acc01' \
        'PROFILE=BloxFruits' \
        'FREEFORM_LAYOUT=false' \
        'FREEFORM_WIDTH=auto' \
        'FREEFORM_HEIGHT=960' \
        'FREEFORM_OFFSET_X=60' \
        'FREEFORM_OFFSET_Y=80' \
        'LICENSE_MODE=required' \
        'LOW_SERVER_STRICT=true' \
        'ALLOW_UNSCOPED_DEEPLINK=false' \
        'ALLOW_HOME_FALLBACK=false'

    run_load "$cfg"
    assert_status "valid config status" 0 "$?"
    assert_eq "valid config PLACE_ID" "2753915549" "$PLACE_ID"
    assert_eq "valid config package" "com.roblox.client" "$ROBLOX_PACKAGE"
    assert_eq "valid config profile" "BloxFruits" "$PROFILE"
    assert_eq "valid config license mode" "required" "$LICENSE_MODE"
    assert_eq "valid config low strict" "true" "$LOW_SERVER_STRICT"
    assert_eq "valid config unscoped fallback" "false" "$ALLOW_UNSCOPED_DEEPLINK"
    assert_eq "valid config home fallback" "false" "$ALLOW_HOME_FALLBACK"
}

quoted_values() {
    local cfg="${TEST_TMP}/quoted.cfg"
    write_config "$cfg" \
        'PLACE_ID="12345"' \
        "PRIVATE_CODE='server-code'" \
        "ROBLOX_PACKAGE='com.roblox.client_clone1'" \
        'ANTI_AFK="FALSE"'

    run_load "$cfg"
    assert_status "quoted values status" 0 "$?"
    assert_eq "double quoted value" "12345" "$PLACE_ID"
    assert_eq "single quoted value" "server-code" "$PRIVATE_CODE"
    assert_eq "boolean normalize" "false" "$ANTI_AFK"
}

comments_empty_and_crlf() {
    local cfg="${TEST_TMP}/crlf.cfg"
    printf '# comment\r\n\r\nPLACE_ID=777\r\nROBLOX_PACKAGE=com.roblox.client\r\n' > "$cfg"

    run_load "$cfg"
    assert_status "comments empty crlf status" 0 "$?"
    assert_eq "crlf PLACE_ID" "777" "$PLACE_ID"
}

unknown_key_is_ignored() {
    local cfg="${TEST_TMP}/unknown.cfg"
    write_config "$cfg" \
        'PLACE_ID=123' \
        'EVIL_COMMAND=rm -rf /'

    run_load "$cfg"
    assert_status "unknown key status" 0 "$?"
    assert_eq "unknown key ignored" "123" "$PLACE_ID"
    case "$CONFIG_WARNINGS" in
        *EVIL_COMMAND*) pass "unknown key warning" ;;
        *) fail "unknown key warning missing" ;;
    esac
}

malicious_command_substitution_is_string() {
    local cfg="${TEST_TMP}/malicious-sub.cfg"
    rm -f "$MARKER"
    write_config "$cfg" \
        "PRIVATE_CODE=\$(touch '$MARKER')" \
        'PLACE_ID=123'

    run_load "$cfg"
    assert_status "malicious command substitution status" 0 "$?"
    assert_eq "malicious command substitution stored as string" "\$(touch '$MARKER')" "$PRIVATE_CODE"
    if [ ! -e "$MARKER" ]; then
        pass "malicious command substitution not executed"
    else
        fail "malicious command substitution executed"
    fi
}

semicolon_injection_fails_numeric_validation() {
    local cfg="${TEST_TMP}/semicolon.cfg"
    write_config "$cfg" 'PLACE_ID=123;rm -rf /'

    run_load "$cfg"
    assert_status "semicolon invalid numeric status" 1 "$?"
    assert_eq "semicolon invalid numeric default" "97598239454123" "$PLACE_ID"
}

invalid_boolean_fails_validation() {
    local cfg="${TEST_TMP}/bad-bool.cfg"
    write_config "$cfg" 'ANTI_AFK=maybe'

    run_load "$cfg"
    assert_status "invalid boolean status" 1 "$?"
    assert_eq "invalid boolean default" "true" "$ANTI_AFK"
}

invalid_license_mode_fails_validation() {
    local cfg="${TEST_TMP}/bad-license-mode.cfg"
    write_config "$cfg" 'LICENSE_MODE=enterprise'

    run_load "$cfg"
    assert_status "invalid license mode status" 1 "$?"
    assert_eq "invalid license mode default" "optional" "$LICENSE_MODE"
}

valid_clone_package() {
    local cfg="${TEST_TMP}/clone.cfg"
    write_config "$cfg" 'ROBLOX_PACKAGE=com.roblox.client_clone1'

    run_load "$cfg"
    assert_status "valid clone package status" 0 "$?"
    assert_eq "valid clone package value" "com.roblox.client_clone1" "$ROBLOX_PACKAGE"
}

missing_config_uses_defaults() {
    local cfg="${TEST_TMP}/missing.cfg"

    run_load "$cfg"
    assert_status "missing config status" 0 "$?"
    assert_eq "default PLACE_ID" "97598239454123" "$PLACE_ID"
    assert_eq "default package" "com.roblox.client" "$ROBLOX_PACKAGE"
    assert_eq "default check interval" "30" "$CHECK_INTERVAL"
    assert_eq "default profile" "default" "$PROFILE"
    assert_eq "default low strict" "false" "$LOW_SERVER_STRICT"
    assert_eq "default unscoped fallback" "false" "$ALLOW_UNSCOPED_DEEPLINK"
    assert_eq "default home fallback" "false" "$ALLOW_HOME_FALLBACK"
}

save_and_reload() {
    local cfg="${TEST_TMP}/saved.cfg"
    reset_config_vars
    config_init_defaults
    PLACE_ID=999
    PRIVATE_CODE=abc
    ROBLOX_PACKAGE=com.roblox.client_clone2
    ROBLOX_USERNAME=Acc02
    LOW_SERVER_STRICT=true
    ALLOW_UNSCOPED_DEEPLINK=true
    config_save "$cfg"
    assert_status "save config status" 0 "$?"

    run_load "$cfg"
    assert_status "reload saved config status" 0 "$?"
    assert_eq "reload saved PLACE_ID" "999" "$PLACE_ID"
    assert_eq "reload saved username" "Acc02" "$ROBLOX_USERNAME"
    assert_eq "reload saved low strict" "true" "$LOW_SERVER_STRICT"
    assert_eq "reload saved unscoped fallback" "true" "$ALLOW_UNSCOPED_DEEPLINK"
}

migration_idempotency() {
    local cfg="${TEST_TMP}/migrate.cfg"
    local first_hash second_hash backup_count
    write_config "$cfg" \
        'PLACE_ID="888"' \
        'UNKNOWN_KEY=ignored' \
        'ROBLOX_PACKAGE="com.roblox.client"'

    reset_config_vars
    config_migrate "$cfg"
    assert_status "migration first status" 0 "$?"
    first_hash="$(cksum "$cfg" | awk '{print $1 ":" $2}')"
    backup_count="$(find "$TEST_TMP" -name 'migrate.cfg.backup.*' | wc -l | tr -d ' ')"
    assert_eq "migration creates one backup" "1" "$backup_count"

    reset_config_vars
    config_migrate "$cfg"
    assert_status "migration second status" 0 "$?"
    second_hash="$(cksum "$cfg" | awk '{print $1 ":" $2}')"
    backup_count="$(find "$TEST_TMP" -name 'migrate.cfg.backup.*' | wc -l | tr -d ' ')"
    assert_eq "migration idempotent file" "$first_hash" "$second_hash"
    assert_eq "migration idempotent backup count" "1" "$backup_count"
}

valid_config
quoted_values
comments_empty_and_crlf
unknown_key_is_ignored
malicious_command_substitution_is_string
semicolon_injection_fails_numeric_validation
invalid_boolean_fails_validation
invalid_license_mode_fails_validation
valid_clone_package
missing_config_uses_defaults
save_and_reload
migration_idempotency

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
