#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALLER_TEST_DIR="$(mktemp -d)"
FAKE_BIN="${INSTALLER_TEST_DIR}/bin"
VALID_APK="${INSTALLER_TEST_DIR}/valid.apk"
INVALID_APK="${INSTALLER_TEST_DIR}/invalid.apk"
PASS_COUNT=0
FAIL_COUNT=0
NETWORK_CALLS=0

cleanup() {
    rm -rf "$INSTALLER_TEST_DIR"
    rm -rf "${ROOT_DIR}/tmp/install" 2>/dev/null || true
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN"
printf 'PKfake-apk-content\n' > "$VALID_APK"
printf 'not-an-apk\n' > "$INVALID_APK"

write_fake() {
    local name="$1"
    shift
    {
        printf '#!/usr/bin/env bash\n'
        printf '%s\n' "$@"
    } > "${FAKE_BIN}/${name}"
    chmod +x "${FAKE_BIN}/${name}"
}

write_fake aapt \
    'pkg="${AAPT_PACKAGE:-com.roblox.client}"' \
    'code="${AAPT_VERSION_CODE:-1}"' \
    'name="${AAPT_VERSION_NAME:-1.0}"' \
    'printf "package: name='\''%s'\'' versionCode='\''%s'\'' versionName='\''%s'\''\n" "$pkg" "$code" "$name"' \
    'printf "sdkVersion:'\''23'\''\n"'
write_fake apksigner 'exit 0'
write_fake pm \
    'if [ "$1" = "install" ]; then echo "Success"; exit 0; fi' \
    'if [ "$1" = "path" ]; then echo "package:/data/app/$2/base.apk"; exit 0; fi' \
    'exit 1'
write_fake dumpsys \
    'pkg="${DUMPSYS_PACKAGE:-com.roblox.client}"' \
    'code="${INSTALLED_VERSION_CODE:-}"' \
    'name="${INSTALLED_VERSION_NAME:-}"' \
    'if [ -n "$code$name" ]; then echo "Package [$pkg]"; echo "  versionCode=$code minSdk=23 targetSdk=35"; echo "  versionName=$name"; exit 0; fi' \
    'exit 1'

PATH="${FAKE_BIN}:$PATH"
export PATH

# shellcheck source=../lib/android.sh
source "${ROOT_DIR}/lib/android.sh"
# shellcheck source=../lib/network.sh
source "${ROOT_DIR}/lib/network.sh"
# shellcheck source=../lib/installer.sh
source "${ROOT_DIR}/lib/installer.sh"

network_download_secure_https() {
    local url="$1"
    local output="$2"
    NETWORK_CALLS=$((NETWORK_CALLS + 1))
    case "$url" in
        https://example.com/valid.apk|https://example.com/file) cp "$VALID_APK" "$output" ;;
        https://example.com/invalid.apk) cp "$INVALID_APK" "$output" ;;
        *) return 1 ;;
    esac
}

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_status() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" -eq "$actual" ]; then pass "$name"; else fail "$name expected=$expected actual=$actual"; fi
}

assert_contains() {
    local name="$1"
    local haystack="$2"
    local needle="$3"
    if [[ "$haystack" == *"$needle"* ]]; then pass "$name"; else fail "$name expected to find [$needle]"; fi
}

expected_sha="$(sha256sum "$VALID_APK" | awk '{print $1}')"

output="$(installer_install_roblox 'https://example.com/file' com.roblox.client "$expected_sha" true 10 "$ROOT_DIR")"
status=$?
assert_status "installer dry-run status" 0 "$status"
assert_contains "installer progress url" "$output" "VALIDATING_URL"
assert_contains "installer package output" "$output" "package=com.roblox.client"
assert_contains "installer sha output" "$output" "$expected_sha"
assert_contains "installer signature output" "$output" "signature=verified:apksigner"
assert_contains "installer dry-run output" "$output" "dry-run completed"

INSTALLED_VERSION_CODE=1
AAPT_VERSION_CODE=1
export INSTALLED_VERSION_CODE AAPT_VERSION_CODE
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client "$expected_sha" false 10 "$ROOT_DIR" false false true false)"
status=$?
assert_status "installer install status" 0 "$status"
assert_contains "installer verify output" "$output" "Roblox installed successfully"
unset INSTALLED_VERSION_CODE AAPT_VERSION_CODE

before_calls="$NETWORK_CALLS"
output="$(installer_install_roblox 'http://example.com/valid.apk' '' '' true 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer http status" 2 "$status"
assert_contains "installer http error" "$output" "must use HTTPS"
assert_status "installer http no download" "$before_calls" "$NETWORK_CALLS"

for bad_url in 'file:///tmp/Roblox.apk' 'ftp://example.com/Roblox.apk' 'javascript:alert(1)' 'data:text/plain,nope' 'https:///Roblox.apk' 'https://example.com/$(touch /tmp/installer-pwned)' 'https://example.com/`touch /tmp/installer-pwned`' 'https://example.com/file;touch' 'https://example.com/file&touch'; do
    before_calls="$NETWORK_CALLS"
    output="$(installer_install_roblox "$bad_url" '' '' true 10 "$ROOT_DIR" 2>&1)"
    status=$?
    assert_status "installer rejects bad url $bad_url" 2 "$status"
    assert_status "installer bad url no download $bad_url" "$before_calls" "$NETWORK_CALLS"
done

AAPT_PACKAGE="com.evil.client"
export AAPT_PACKAGE
output="$(installer_install_roblox 'https://example.com/valid.apk' '' '' true 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer wrong package status" 1 "$status"
assert_contains "installer wrong package error" "$output" "official Roblox install requires package"
unset AAPT_PACKAGE

output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.other '' true 10 "$ROOT_DIR" false false false true 2>&1)"
status=$?
assert_status "installer expected package mismatch status" 1 "$status"
assert_contains "installer expected package mismatch error" "$output" "package mismatch"

output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client 0000 true 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer sha mismatch status" 1 "$status"
assert_contains "installer sha mismatch error" "$output" "SHA256 mismatch"

output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' true 0 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer bad max status" 2 "$status"
assert_contains "installer bad max error" "$output" "invalid max APK size"

output="$(installer_install_roblox 'https://example.com/invalid.apk' com.roblox.client '' true 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer invalid apk status" 1 "$status"
assert_contains "installer invalid apk error" "$output" "not an APK/ZIP"

mv "${FAKE_BIN}/apksigner" "${FAKE_BIN}/apksigner.off"
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' true 10 "$ROOT_DIR")"
status=$?
assert_status "installer signature unavailable status" 0 "$status"
assert_contains "installer signature unavailable output" "$output" "Signature verification unavailable"
mv "${FAKE_BIN}/apksigner.off" "${FAKE_BIN}/apksigner"

write_fake apksigner 'exit 1'
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' true 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer signature fail status" 1 "$status"
assert_contains "installer signature fail error" "$output" "signature verification failed"
write_fake apksigner 'exit 0'

INSTALLED_VERSION_CODE=""
AAPT_VERSION_CODE=5
export INSTALLED_VERSION_CODE AAPT_VERSION_CODE
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' true 10 "$ROOT_DIR")"
status=$?
assert_status "installer new install status" 0 "$status"
assert_contains "installer new install action" "$output" "action=NEW_INSTALL"

INSTALLED_VERSION_CODE=4
AAPT_VERSION_CODE=5
export INSTALLED_VERSION_CODE AAPT_VERSION_CODE
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' true 10 "$ROOT_DIR")"
status=$?
assert_status "installer upgrade status" 0 "$status"
assert_contains "installer upgrade action" "$output" "action=UPGRADE"

INSTALLED_VERSION_CODE=5
AAPT_VERSION_CODE=5
export INSTALLED_VERSION_CODE AAPT_VERSION_CODE
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' false 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer same version needs yes status" 1 "$status"
assert_contains "installer same version needs yes error" "$output" "same version detected"
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' false 10 "$ROOT_DIR" false false true false)"
status=$?
assert_status "installer same version yes status" 0 "$status"

INSTALLED_VERSION_CODE=6
AAPT_VERSION_CODE=5
export INSTALLED_VERSION_CODE AAPT_VERSION_CODE
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' false 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer downgrade rejected status" 1 "$status"
assert_contains "installer downgrade rejected error" "$output" "downgrade detected"
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' true 10 "$ROOT_DIR" true false true false)"
status=$?
assert_status "installer downgrade explicit status" 0 "$status"

write_fake pm \
    'if [ "$1" = "install" ]; then echo "Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]"; exit 1; fi' \
    'if [ "$1" = "path" ]; then echo "package:/data/app/$2/base.apk"; exit 0; fi' \
    'exit 1'
INSTALLED_VERSION_CODE=4
AAPT_VERSION_CODE=5
export INSTALLED_VERSION_CODE AAPT_VERSION_CODE
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' false 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer install failure status" 1 "$status"
assert_contains "installer install failure message" "$output" "insufficient storage"

write_fake pm \
    'if [ "$1" = "install" ]; then echo "Success"; exit 0; fi' \
    'if [ "$1" = "path" ]; then exit 1; fi' \
    'exit 1'
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' false 10 "$ROOT_DIR" 2>&1)"
status=$?
assert_status "installer post install missing status" 1 "$status"
assert_contains "installer post install missing error" "$output" "install verification failed"

write_fake pm \
    'if [ "$1" = "install" ]; then echo "Success"; exit 0; fi' \
    'if [ "$1" = "path" ]; then echo "package:/data/app/$2/base.apk"; exit 0; fi' \
    'exit 1'
INSTALLED_VERSION_CODE=9
AAPT_VERSION_CODE=5
export INSTALLED_VERSION_CODE AAPT_VERSION_CODE
output="$(installer_install_roblox 'https://example.com/valid.apk' com.roblox.client '' false 10 "$ROOT_DIR" true false true false 2>&1)"
status=$?
assert_status "installer post install mismatch status" 1 "$status"
assert_contains "installer post install mismatch error" "$output" "post-install version mismatch"

leftover="$(find "${ROOT_DIR}/tmp/install" -maxdepth 1 -type d -name 'job.*' -print 2>/dev/null)"
if [ -z "$leftover" ]; then
    pass "installer tmp cleanup"
else
    fail "installer tmp cleanup"
fi

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
