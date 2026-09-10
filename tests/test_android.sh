#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/android.sh
source "${REPO_DIR}/lib/android.sh"

TEST_TMP="$(mktemp -d)"
FAKE_BIN="${TEST_TMP}/bin"
LOG_FILE="${TEST_TMP}/calls.log"
MARKER="${TEST_TMP}/android-pwned"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() {
    rm -rf "$TEST_TMP"
}
trap cleanup EXIT

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

assert_no_marker() {
    local name="$1"
    if [ ! -e "$MARKER" ]; then
        pass "$name"
    else
        fail "$name: marker was created"
    fi
}

reset_log() {
    : > "$LOG_FILE"
    rm -f "$MARKER"
}

write_fake() {
    local name="$1"
    shift
    printf '%s\n' "$@" > "${FAKE_BIN}/${name}"
    chmod +x "${FAKE_BIN}/${name}"
}

setup_fakes() {
    mkdir -p "$FAKE_BIN"
    write_fake am \
        '#!/usr/bin/env bash' \
        'printf "am argc=%s\n" "$#" >> "$ANDROID_TEST_LOG"' \
        'i=1; for arg in "$@"; do printf "am arg%s=%s\n" "$i" "$arg" >> "$ANDROID_TEST_LOG"; i=$((i+1)); done'
    write_fake input \
        '#!/usr/bin/env bash' \
        'printf "input argc=%s\n" "$#" >> "$ANDROID_TEST_LOG"' \
        'i=1; for arg in "$@"; do printf "input arg%s=%s\n" "$i" "$arg" >> "$ANDROID_TEST_LOG"; i=$((i+1)); done'
    write_fake adb \
        '#!/usr/bin/env bash' \
        'printf "adb argc=%s\n" "$#" >> "$ANDROID_TEST_LOG"' \
        'i=1; for arg in "$@"; do printf "adb arg%s=%s\n" "$i" "$arg" >> "$ANDROID_TEST_LOG"; i=$((i+1)); done'
    write_fake su \
        '#!/usr/bin/env bash' \
        'printf "su argc=%s\n" "$#" >> "$ANDROID_TEST_LOG"' \
        'i=1; for arg in "$@"; do printf "su arg%s=%s\n" "$i" "$arg" >> "$ANDROID_TEST_LOG"; i=$((i+1)); done'
    write_fake pm \
        '#!/usr/bin/env bash' \
        'printf "pm argc=%s\n" "$#" >> "$ANDROID_TEST_LOG"' \
        'i=1; for arg in "$@"; do printf "pm arg%s=%s\n" "$i" "$arg" >> "$ANDROID_TEST_LOG"; i=$((i+1)); done'
    write_fake dumpsys \
        '#!/usr/bin/env bash' \
        'printf "  versionCode=123 minSdk=23 targetSdk=35\n"' \
        'printf "  versionName=2.999\n"'
    export PATH="${FAKE_BIN}:${PATH}"
    export ANDROID_TEST_LOG="$LOG_FILE"
}

direct_force_stop() {
    reset_log
    ANDROID_EXECUTOR=direct android_force_stop "com.roblox.client"
    assert_status "direct force-stop status" 0 "$?"
    assert_eq "direct force-stop args" "$(printf 'am argc=2\nam arg1=force-stop\nam arg2=com.roblox.client')" "$(cat "$LOG_FILE")"
}

direct_start_uri_keeps_ampersand_argument() {
    local uri="roblox://navigation/share_links?code=ABC&type=Server"
    reset_log
    ANDROID_EXECUTOR=direct android_start_uri "com.roblox.client" "$uri"
    assert_status "direct start uri status" 0 "$?"
    assert_eq "direct uri is one argument" "$uri" "$(grep '^am arg5=' "$LOG_FILE" | cut -d= -f2-)"
    assert_eq "direct start uri argc" "am argc=7" "$(head -n 1 "$LOG_FILE")"
}

direct_input_tap() {
    reset_log
    ANDROID_EXECUTOR=direct android_input_tap 540 960
    assert_status "direct input tap status" 0 "$?"
    assert_eq "direct input tap args" "$(printf 'input argc=3\ninput arg1=tap\ninput arg2=540\ninput arg3=960')" "$(cat "$LOG_FILE")"
}

adb_force_stop_preserves_args() {
    reset_log
    ANDROID_EXECUTOR=adb android_force_stop "com.roblox.client"
    assert_status "adb force-stop status" 0 "$?"
    assert_eq "adb command" "$(printf 'adb argc=4\nadb arg1=shell\nadb arg2=am\nadb arg3=force-stop\nadb arg4=com.roblox.client')" "$(cat "$LOG_FILE")"
}

root_quotes_uri_with_ampersand() {
    local uri="roblox://navigation/share_links?code=ABC&type=Server"
    local command_line
    reset_log
    ANDROID_EXECUTOR=su android_start_uri "com.roblox.client" "$uri"
    assert_status "root start uri status" 0 "$?"
    command_line="$(grep '^su arg2=' "$LOG_FILE" | cut -d= -f2-)"
    case "$command_line" in
        *'code=ABC\&type=Server'*|*"'roblox://navigation/share_links?code=ABC&type=Server'"*)
            pass "root uri ampersand quoted"
            ;;
        *)
            fail "root uri ampersand not visibly quoted: $command_line"
            ;;
    esac
}

malicious_package_rejected() {
    reset_log
    ANDROID_EXECUTOR=direct android_force_stop "com.roblox.client;touch ${MARKER}"
    assert_status "malicious package rejected" 2 "$?"
    assert_eq "malicious package did not call command" "" "$(cat "$LOG_FILE")"
    assert_no_marker "malicious package marker absent"
}

command_substitution_uri_not_executed() {
    reset_log
    ANDROID_EXECUTOR=direct android_start_uri "com.roblox.client" "roblox://navigation/share_links?code=\$(touch ${MARKER})&type=Server"
    assert_status "command substitution uri status" 0 "$?"
    assert_no_marker "command substitution uri not executed"
}

backticks_uri_not_executed() {
    reset_log
    ANDROID_EXECUTOR=direct android_start_uri "com.roblox.client" "roblox://navigation/share_links?code=\`touch ${MARKER}\`&type=Server"
    assert_status "backticks uri status" 0 "$?"
    assert_no_marker "backticks uri not executed"
}

spaces_metacharacters_stay_in_uri_argument() {
    local uri="roblox://navigation/share_links?code=ABC DEF;still-data&type=Server"
    reset_log
    ANDROID_EXECUTOR=direct android_start_uri "com.roblox.client" "$uri"
    assert_status "spaces metacharacters uri status" 0 "$?"
    assert_eq "spaces metacharacters one arg" "$uri" "$(grep '^am arg5=' "$LOG_FILE" | cut -d= -f2-)"
    assert_no_marker "spaces metacharacters not executed"
}

package_version_read() {
    local output
    reset_log
    ANDROID_EXECUTOR=direct
    output="$(android_get_package_version com.roblox.client)"
    assert_status "package version status" 0 "$?"
    assert_eq "package version code" "VERSION_CODE=123" "$(printf '%s\n' "$output" | head -1)"
    assert_eq "package version name" "VERSION_NAME=2.999" "$(printf '%s\n' "$output" | tail -1)"
}

direct_install_downgrade_flag() {
    local apk="${TEST_TMP}/Roblox.apk"
    printf 'PKfake' > "$apk"
    reset_log
    ANDROID_EXECUTOR=direct android_install_apk "$apk" true
    assert_status "direct install downgrade status" 0 "$?"
    assert_eq "direct install downgrade args" "$(printf 'pm argc=4\npm arg1=install\npm arg2=-r\npm arg3=-d\npm arg4=%s' "$apk")" "$(cat "$LOG_FILE")"
}

setup_fakes
direct_force_stop
direct_start_uri_keeps_ampersand_argument
direct_input_tap
adb_force_stop_preserves_args
root_quotes_uri_with_ampersand
malicious_package_rejected
command_substitution_uri_not_executed
backticks_uri_not_executed
spaces_metacharacters_stay_in_uri_argument
package_version_read
direct_install_downgrade_flag

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
