#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="$(mktemp -d)"
FAKE_BIN="${TEST_TMP}/bin"
PASS_COUNT=0
FAIL_COUNT=0

cleanup() { rm -rf "$TEST_TMP"; }
trap cleanup EXIT

mkdir -p "$FAKE_BIN"
cat > "${FAKE_BIN}/jq" <<EOF
#!/usr/bin/env bash
python "${ROOT_DIR}/tests/fixtures/fake_jq.py" "\$@"
EOF
chmod +x "${FAKE_BIN}/jq"
cat > "${FAKE_BIN}/curl" <<EOF
#!/usr/bin/env bash
printf 'curl called\n' >> "${TEST_TMP}/curl.log"
exit 0
EOF
chmod +x "${FAKE_BIN}/curl"
PATH="${FAKE_BIN}:$PATH"
AUTO_REJOIN_APP_DIR="${TEST_TMP}/app"
AUTO_REJOIN_LICENSE_API="http://127.0.0.1:9"
AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV=true
RUNTIME_LOCK_USE_FLOCK=false
export PATH AUTO_REJOIN_APP_DIR AUTO_REJOIN_LICENSE_API AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV RUNTIME_LOCK_USE_FLOCK

# shellcheck source=../lib/logger.sh
source "${ROOT_DIR}/lib/logger.sh"
# shellcheck source=../lib/network.sh
source "${ROOT_DIR}/lib/network.sh"
# shellcheck source=../lib/runtime.sh
source "${ROOT_DIR}/lib/runtime.sh"
# shellcheck source=../lib/license.sh
source "${ROOT_DIR}/lib/license.sh"
# shellcheck source=../lib/entitlement.sh
source "${ROOT_DIR}/lib/entitlement.sh"

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_status() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" -eq "$actual" ]; then pass "$name"; else fail "$name expected=$expected actual=$actual"; fi
}

write_cache() {
    LICENSE_STATUS="${1:-VALID}"
    LICENSE_PLAN="${2:-pro}"
    LICENSE_FEATURES="${3:-monitor,doctor,discord,profiles,installer}"
    LICENSE_MAX_INSTANCES="${4:-20}"
    LICENSE_TOKEN="test-token"
    LICENSE_LAST_VALIDATED_AT="${5:-$(date +%s)}"
    LICENSE_REVALIDATE_AFTER="${6:-3600}"
    LICENSE_EXPIRES_AT="2026-12-31T00:00:00Z"
    LICENSE_MAINTENANCE_ENABLED="${LICENSE_MAINTENANCE_ENABLED:-false}"
    LICENSE_MAINTENANCE_ALLOW_CACHE="${LICENSE_MAINTENANCE_ALLOW_CACHE:-false}"
    LICENSE_MAINTENANCE_MESSAGE="${LICENSE_MAINTENANCE_MESSAGE:-}"
    license_save_cache
}

reset_locks() {
    rm -rf "${TEST_TMP}/locks"
    mkdir -p "${TEST_TMP}/locks"
    RUNTIME_LOCK_PATH=""
    RUNTIME_LOCK_METHOD=""
    RUNTIME_LOCK_FD=""
}

AUTO_REJOIN_LICENSE_MODE=disabled
export AUTO_REJOIN_LICENSE_MODE
rm -rf "$AUTO_REJOIN_APP_DIR"
entitlement_require_feature installer Installer >/dev/null 2>&1
assert_status "disabled mode allows feature" 0 "$?"

AUTO_REJOIN_LICENSE_MODE=optional
export AUTO_REJOIN_LICENSE_MODE
rm -rf "$AUTO_REJOIN_APP_DIR"
entitlement_require_feature profiles Profiles >/dev/null 2>&1
assert_status "optional no license allows legacy" 0 "$?"

AUTO_REJOIN_LICENSE_MODE=required
export AUTO_REJOIN_LICENSE_MODE
rm -rf "$AUTO_REJOIN_APP_DIR"
output="$(entitlement_require_feature monitor Monitor 2>&1)"
status=$?
assert_status "required no license blocks monitor" 1 "$status"
case "$output" in
    *"roblox-manager license activate"*) pass "required no license guidance" ;;
    *) fail "required no license guidance" ;;
esac

: > "${TEST_TMP}/curl.log"
AUTO_REJOIN_APP_DIR="${TEST_TMP}/cli-no-license" AUTO_REJOIN_LICENSE_MODE=required \
    "${ROOT_DIR}/bin/roblox-manager" install-roblox "https://example.com/Roblox.apk" >/dev/null 2>&1
assert_status "installer blocked before download" 1 "$?"
if [ ! -s "${TEST_TMP}/curl.log" ]; then pass "installer did not call curl"; else fail "installer did call curl"; fi

AUTO_REJOIN_APP_DIR="${TEST_TMP}/cli-no-license" AUTO_REJOIN_LICENSE_MODE=required \
    "${ROOT_DIR}/bin/roblox-manager" profile list >/dev/null 2>&1
assert_status "profiles blocked without entitlement" 1 "$?"

AUTO_REJOIN_APP_DIR="${TEST_TMP}/cli-no-license" AUTO_REJOIN_LICENSE_MODE=required \
    "${ROOT_DIR}/bin/roblox-manager" license status >/dev/null 2>&1
assert_status "license command remains accessible" 0 "$?"

AUTO_REJOIN_APP_DIR="${TEST_TMP}/cli-no-license" AUTO_REJOIN_LICENSE_MODE=required \
    "${ROOT_DIR}/bin/roblox-manager" doctor --skip-network >/dev/null 2>&1
assert_status "doctor remains accessible" 0 "$?"

write_cache VALID pro "monitor,doctor,discord,profiles,installer" 20
entitlement_require_feature monitor Monitor >/dev/null 2>&1
assert_status "required valid license allows monitor" 0 "$?"
entitlement_require_feature installer Installer >/dev/null 2>&1
assert_status "feature present allows" 0 "$?"

write_cache VALID standard "monitor,doctor,discord,profiles" 5
output="$(entitlement_require_feature installer Installer 2>&1)"
status=$?
assert_status "feature absent blocks" 1 "$status"
case "$output" in
    *"Required feature: installer"*) pass "feature denial clear" ;;
    *) fail "feature denial clear" ;;
esac

write_cache VALID pro "monitor,doctor" 1
reset_locks
entitlement_check_instance_limit "$TEST_TMP" >/dev/null 2>&1
assert_status "limit 1 zero active allows" 0 "$?"
mkdir -p "${TEST_TMP}/locks/com.roblox.client.lockdir"
printf '%s\n' "$$" > "${TEST_TMP}/locks/com.roblox.client.lockdir/pid"
entitlement_check_instance_limit "$TEST_TMP" >/dev/null 2>&1
assert_status "limit 1 one active blocks" 1 "$?"

write_cache VALID pro "monitor,doctor" 5
reset_locks
for n in 1 2 3 4; do
    mkdir -p "${TEST_TMP}/locks/com.roblox.clone${n}.lockdir"
    printf '%s\n' "$$" > "${TEST_TMP}/locks/com.roblox.clone${n}.lockdir/pid"
done
entitlement_check_instance_limit "$TEST_TMP" >/dev/null 2>&1
assert_status "limit 5 four active allows" 0 "$?"
mkdir -p "${TEST_TMP}/locks/com.roblox.clone5.lockdir"
printf '%s\n' "$$" > "${TEST_TMP}/locks/com.roblox.clone5.lockdir/pid"
entitlement_check_instance_limit "$TEST_TMP" >/dev/null 2>&1
assert_status "limit 5 five active blocks" 1 "$?"

write_cache VALID pro "monitor,doctor" 5
reset_locks
for n in 1 2 3 4 5 6 7 8; do
    mkdir -p "${TEST_TMP}/locks/com.roblox.existing${n}.lockdir"
    printf '%s\n' "$$" > "${TEST_TMP}/locks/com.roblox.existing${n}.lockdir/pid"
done
entitlement_check_instance_limit "$TEST_TMP" >/dev/null 2>&1
assert_status "existing over limit blocks new start only" 1 "$?"
if [ "$(find "${TEST_TMP}/locks" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" -eq 8 ]; then pass "existing locks untouched"; else fail "existing locks untouched"; fi

write_cache VALID pro "monitor,doctor" 1
reset_locks
mkdir -p "${TEST_TMP}/locks/license-instance-admission.lockdir"
entitlement_admission_lock_acquire "$TEST_TMP" >/dev/null 2>&1
assert_status "concurrent admission lock blocks" 1 "$?"
rm -rf "${TEST_TMP}/locks/license-instance-admission.lockdir"

write_cache VALID pro "monitor,doctor,installer" 20 "$(($(date +%s) - 10))" 1
LICENSE_ERROR_CODE="NETWORK_ERROR"
license_validate() { LICENSE_ERROR_CODE="NETWORK_ERROR"; return 3; }
entitlement_refresh_if_needed >/dev/null 2>&1
assert_status "offline grace allows network outage" 0 "$?"

LICENSE_MAINTENANCE_ENABLED="true"
LICENSE_MAINTENANCE_ALLOW_CACHE="true"
LICENSE_MAINTENANCE_MESSAGE="maintenance"
write_cache VALID pro "monitor,doctor,installer" 20 "$(($(date +%s) - 10))" 1
entitlement_refresh_if_needed >/dev/null 2>&1
assert_status "maintenance allow cache permits grace" 0 "$?"

LICENSE_MAINTENANCE_ENABLED="true"
LICENSE_MAINTENANCE_ALLOW_CACHE="false"
LICENSE_MAINTENANCE_MESSAGE="maintenance"
write_cache VALID pro "monitor,doctor,installer" 20 "$(($(date +%s) - 10))" 1
entitlement_refresh_if_needed >/dev/null 2>&1
assert_status "maintenance disallow cache blocks required" 1 "$?"
LICENSE_MAINTENANCE_ENABLED="false"
LICENSE_MAINTENANCE_ALLOW_CACHE="false"
LICENSE_MAINTENANCE_MESSAGE=""

write_cache VALID pro "monitor,doctor,installer" 20 "$(($(date +%s) - 90000))" 1
entitlement_refresh_if_needed >/dev/null 2>&1
assert_status "offline grace expired blocks required" 1 "$?"

license_validate() { LICENSE_ERROR_CODE="REVOKED"; LICENSE_ERROR_MESSAGE="revoked"; LICENSE_STATUS="REVOKED"; return 1; }
write_cache VALID pro "monitor,doctor,installer" 20 "$(($(date +%s) - 10))" 1
entitlement_refresh_if_needed >/dev/null 2>&1
assert_status "fresh revoked blocks old cache" 1 "$?"

license_validate() { LICENSE_ERROR_CODE="EXPIRED"; LICENSE_ERROR_MESSAGE="expired"; LICENSE_STATUS="EXPIRED"; return 1; }
write_cache VALID pro "monitor,doctor,installer" 20 "$(($(date +%s) - 10))" 1
entitlement_refresh_if_needed >/dev/null 2>&1
assert_status "fresh expired blocks old cache" 1 "$?"

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
