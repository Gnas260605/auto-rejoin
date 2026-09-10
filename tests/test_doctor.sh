#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCTOR_TEST_DIR="${ROOT_DIR}/tmp/test_doctor"
FAKE_BIN="${DOCTOR_TEST_DIR}/bin"
CONFIG_FILE="${DOCTOR_TEST_DIR}/config.env"
LOG_FILE="${DOCTOR_TEST_DIR}/results.log"
PASS_COUNT=0
FAIL_COUNT=0

rm -rf "$DOCTOR_TEST_DIR"
mkdir -p "$FAKE_BIN"
: > "$LOG_FILE"

cleanup() {
    rm -rf "$DOCTOR_TEST_DIR"
}
trap cleanup EXIT

assert_contains() {
    local name="$1"
    local haystack="$2"
    local needle="$3"
    if [[ "$haystack" == *"$needle"* ]]; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name"
        echo "Expected to find: $needle"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

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

write_fake() {
    local name="$1"
    shift
    {
        printf '#!/usr/bin/env bash\n'
        printf '%s\n' "$@"
    } > "${FAKE_BIN}/${name}"
    chmod +x "${FAKE_BIN}/${name}"
}

write_fake curl 'exit 0'
write_fake jq 'exit 0'
write_fake ping 'exit 0'
write_fake pm 'if [ "$1" = "list" ] && [ "$2" = "packages" ]; then echo "package:com.roblox.client"; echo "package:com.roblox.beta"; exit 0; fi; exit 1'
PATH="${FAKE_BIN}:$PATH"
DOCTOR_SKIP_NETWORK=true
export PATH DOCTOR_SKIP_NETWORK

# shellcheck source=../lib/config.sh
source "${ROOT_DIR}/lib/config.sh"
# shellcheck source=../lib/android.sh
source "${ROOT_DIR}/lib/android.sh"
# shellcheck source=../lib/network.sh
source "${ROOT_DIR}/lib/network.sh"
# shellcheck source=../lib/license.sh
source "${ROOT_DIR}/lib/license.sh"
# shellcheck source=../lib/doctor.sh
source "${ROOT_DIR}/lib/doctor.sh"

cat > "$CONFIG_FILE" <<'EOF'
PLACE_ID="12345"
ROBLOX_PACKAGE="com.roblox.client"
EOF

output="$(doctor_run "$ROOT_DIR" "$CONFIG_FILE" env)"
status=$?
assert_status "doctor env status" "$status" 0
assert_contains "doctor env pass count" "$output" "DOCTOR_PASS="
assert_contains "doctor env fail zero" "$output" "DOCTOR_FAIL=0"
assert_contains "doctor sees config" "$output" "DOCTOR_CONFIG_STATUS=PASS"
assert_contains "doctor skips network" "$output" "DOCTOR_NETWORK_STATUS=WARN"
assert_contains "doctor android packages" "$output" "DOCTOR_ANDROID_ROBLOX_PACKAGES_STATUS=PASS"
assert_contains "doctor license optional" "$output" "DOCTOR_LICENSE_MODE_STATUS=PASS"
assert_contains "doctor license not configured" "$output" "DOCTOR_LICENSE_API_STATUS=WARN"
assert_contains "doctor license cache optional" "$output" "DOCTOR_LICENSE_CACHE_STATUS=WARN"

text_output="$(doctor_run "$ROOT_DIR" "$CONFIG_FILE" text)"
status=$?
assert_status "doctor text status" "$status" 0
assert_contains "doctor text header" "$text_output" "AUTO REJOIN PRO - DOCTOR"
assert_contains "doctor text config" "$text_output" "[PASS] config - parsed successfully"

missing_output="$(doctor_run "${DOCTOR_TEST_DIR}/missing-project" "$CONFIG_FILE" env)"
status=$?
assert_status "doctor missing project status" "$status" 1
assert_contains "doctor missing project fail" "$missing_output" "DOCTOR_FILE_AUTO_REJOIN_SH_STATUS=FAIL"

echo
echo "${PASS_COUNT} passed, ${FAIL_COUNT} failed"
[ "$FAIL_COUNT" -eq 0 ]
