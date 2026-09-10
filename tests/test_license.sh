#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="$(mktemp -d)"
FAKE_BIN="${TEST_TMP}/bin"
PASS_COUNT=0
FAIL_COUNT=0
SERVER_PID=""
PORT="18765"

cleanup() {
    if [ -n "$SERVER_PID" ]; then
        kill "$SERVER_PID" 2>/dev/null || true
        wait "$SERVER_PID" 2>/dev/null || true
    fi
    rm -rf "$TEST_TMP"
}
trap cleanup EXIT

mkdir -p "$FAKE_BIN"
cat > "${FAKE_BIN}/jq" <<EOF
#!/usr/bin/env bash
python "${ROOT_DIR}/tests/fixtures/fake_jq.py" "\$@"
EOF
chmod +x "${FAKE_BIN}/jq"

PATH="${FAKE_BIN}:$PATH"
AUTO_REJOIN_APP_DIR="${TEST_TMP}/app"
AUTO_REJOIN_LICENSE_API="http://127.0.0.1:${PORT}"
AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV=true
LICENSE_OFFLINE_GRACE_SECONDS=86400
export PATH AUTO_REJOIN_APP_DIR AUTO_REJOIN_LICENSE_API AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV LICENSE_OFFLINE_GRACE_SECONDS

# shellcheck source=../lib/network.sh
source "${ROOT_DIR}/lib/network.sh"
# shellcheck source=../lib/android.sh
source "${ROOT_DIR}/lib/android.sh"
# shellcheck source=../lib/license.sh
source "${ROOT_DIR}/lib/license.sh"

python "${ROOT_DIR}/tests/fixtures/mock_license_server.py" "$PORT" &
SERVER_PID=$!
sleep 1

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }

assert_status() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" -eq "$actual" ]; then pass "$name"; else fail "$name expected=$expected actual=$actual"; fi
}

assert_contains() {
    local name="$1" haystack="$2" needle="$3"
    if [[ "$haystack" == *"$needle"* ]]; then pass "$name"; else fail "$name expected to contain [$needle]"; fi
}

assert_not_contains() {
    local name="$1" haystack="$2" needle="$3"
    if [[ "$haystack" != *"$needle"* ]]; then pass "$name"; else fail "$name should not contain [$needle]"; fi
}

id1="$(license_get_installation_id)"
status=$?
assert_status "installation id create" 0 "$status"
id2="$(license_get_installation_id)"
assert_status "installation id persist call" 0 "$?"
if [ "$id1" = "$id2" ]; then pass "installation id persists"; else fail "installation id persists"; fi

printf 'corrupt\n' > "$LICENSE_INSTALLATION_ID_FILE"
id3="$(license_get_installation_id)"
assert_status "corrupt id recreate" 0 "$?"
if [ "$id3" != "corrupt" ] && [ "$id3" != "$id1" ]; then pass "corrupt id changed"; else fail "corrupt id changed"; fi
backup_count="$(find "$AUTO_REJOIN_APP_DIR" -name 'installation_id.corrupt.*' | wc -l | tr -d ' ')"
if [ "$backup_count" -ge 1 ]; then pass "corrupt id backup"; else fail "corrupt id backup"; fi

normalized="$(license_normalize_key ' ar-abcd-efgh-ijkl-1234 ')"
assert_contains "key normalized" "$normalized" "AR-ABCD-EFGH-IJKL-1234"
masked="$(license_mask_key "$normalized")"
assert_contains "key masked prefix" "$masked" "AR-ABCD"
assert_not_contains "key mask hides middle" "$masked" "EFGH-IJKL"

output="$(license_activate VALID "$ROOT_DIR" 2>&1)"
status=$?
assert_status "activate valid status" 0 "$status"
assert_contains "activate valid plan" "$output" "Plan    : pro"
assert_not_contains "activate hides token" "$output" "tok_test_secret"
assert_not_contains "activate hides raw valid token" "$output" "licenseKey"

license_load_cache
assert_status "cache load status" 0 "$?"
assert_contains "cache plan" "$LICENSE_PLAN" "pro"
assert_contains "cache features" "$LICENSE_FEATURES" "installer"
assert_contains "max instances" "$(license_get_max_instances)" "20"
if license_has_feature installer; then pass "feature present"; else fail "feature present"; fi
if ! license_has_feature dashboard; then pass "feature absent"; else fail "feature absent"; fi

output="$(license_validate "$ROOT_DIR" 2>&1)"
status=$?
assert_status "validate status" 0 "$status"
assert_contains "validate output" "$output" "successful"
assert_not_contains "validate hides token" "$output" "tok_test_secret"

LICENSE_TOKEN="keep-existing-token"
license_parse_success_response '{"valid":true,"licenseId":"lic_test_123","plan":"pro","expiresAt":"2026-12-31T23:59:59Z","maxInstances":20,"features":["monitor"],"revalidateAfter":3600,"serverTime":"2026-09-10T00:10:00Z"}'
assert_status "validate without rotated token parse" 0 "$?"
assert_contains "validate without rotated token keeps cache token" "$LICENSE_TOKEN" "keep-existing-token"
LICENSE_TOKEN="tok_test_secret"
license_save_cache

status_output="$(license_status)"
assert_contains "status valid" "$status_output" "License Status: VALID"
assert_contains "status offline grace" "$status_output" "Offline Grace : available"

LICENSE_LAST_VALIDATED_AT="$(($(date +%s) - 90000))"
license_save_cache
if ! license_offline_grace_valid; then pass "offline grace expired"; else fail "offline grace expired"; fi

LICENSE_LAST_VALIDATED_AT="0"
LICENSE_REVALIDATE_AFTER="1"
license_save_cache
if license_should_revalidate; then pass "should revalidate"; else fail "should revalidate"; fi

LICENSE_LAST_VALIDATED_AT="$(($(date +%s) + 3600))"
LICENSE_REVALIDATE_AFTER="3600"
license_save_cache
if license_should_revalidate; then pass "clock rollback revalidates"; else fail "clock rollback revalidates"; fi

output="$(license_deactivate false 2>&1)"
status=$?
assert_status "deactivate success status" 0 "$status"
assert_contains "deactivate success output" "$output" "deactivated"

output="$(license_deactivate false 2>&1)"
status=$?
assert_status "deactivate no cache status" 1 "$status"

for key in AR-FAIL-FAIL-FAIL-FAIL EXPIRED REVOKED DEVICE_LIMIT; do
    output="$(license_activate "$key" "$ROOT_DIR" 2>&1)"
    status=$?
    assert_status "activate $key status" 1 "$status"
    assert_not_contains "activate $key hides token" "$output" "tok_test_secret"
done

output="$(license_activate AR-MALF-MALF-MALF-MALF "$ROOT_DIR" 2>&1)"
status=$?
assert_status "malformed response status" 1 "$status"

AUTO_REJOIN_LICENSE_API="http://127.0.0.1:${PORT}"
AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV=false
LICENSE_API="$AUTO_REJOIN_LICENSE_API"
LICENSE_ALLOW_HTTP_DEV="$AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV"
output="$(license_activate VALID "$ROOT_DIR" 2>&1)"
status=$?
assert_status "http rejected status" 2 "$status"
assert_contains "http rejected message" "$output" "must use HTTPS"

AUTO_REJOIN_LICENSE_API="http://127.0.0.1:9"
AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV=true
LICENSE_API="$AUTO_REJOIN_LICENSE_API"
LICENSE_ALLOW_HTTP_DEV="$AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV"
output="$(license_activate VALID "$ROOT_DIR" 2>&1)"
status=$?
assert_status "network failure status" 3 "$status"

marker="${TEST_TMP}/license-pwned"
for bad in '$(touch '"$marker"')' '`touch '"$marker"'`' '; touch '"$marker"; do
    output="$(license_activate "$bad" "$ROOT_DIR" 2>&1)"
    status=$?
    assert_status "injection rejected $bad" 2 "$status"
done
if [ ! -e "$marker" ]; then pass "license injection not executed"; else fail "license injection not executed"; fi

printf '\n%d passed, %d failed\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
