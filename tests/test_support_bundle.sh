#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUNDLE_TEST_DIR="${ROOT_DIR}/tmp/test_bundle"
TEST_PROJECT="${BUNDLE_TEST_DIR}/project"
EXTRACT_DIR="${BUNDLE_TEST_DIR}/extracted"
PASS_COUNT=0
FAIL_COUNT=0

rm -rf "$BUNDLE_TEST_DIR"
mkdir -p "$TEST_PROJECT/lib" "$TEST_PROJECT/bin" "$TEST_PROJECT/logs" "$EXTRACT_DIR"

cleanup() {
    rm -rf "$BUNDLE_TEST_DIR"
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

assert_not_contains() {
    local name="$1"
    local haystack="$2"
    local needle="$3"
    if [[ "$haystack" != *"$needle"* ]]; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name"
        echo "Did NOT expect to find: $needle"
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

# Setup test project files
cp -r "${ROOT_DIR}/lib"/* "${TEST_PROJECT}/lib/"
cp "${ROOT_DIR}/bin/roblox-manager" "${TEST_PROJECT}/bin/"
chmod +x "${TEST_PROJECT}/bin/roblox-manager"
echo "4.5.0-pilot.1" > "${TEST_PROJECT}/VERSION"

# Populate sensitive config
cat << 'EOF' > "${TEST_PROJECT}/config.env"
PACKAGE_NAME="com.roblox.client"
GAME_URL="https://www.roblox.com/games/189707/Natural-Disaster-Survival"
DISCORD_WEBHOOK="https://discord.com/api/webhooks/9876543210/SuperSecretWebhookToken123456"
ADMIN_PASSWORD="super_secret_db_password"
API_SECRET="jwt_signing_secret_key"
LICENSE_KEY="AR-ABCD-EFGH-1234-5678"
EOF

# Populate log file with secrets
cat << 'EOF' > "${TEST_PROJECT}/logs/roblox.log"
[2026-09-10 12:00:00] [INFO] Starting monitor for com.roblox.client
[2026-09-10 12:00:01] [DEBUG] Sending webhook to https://discord.com/api/webhooks/9876543210/SuperSecretWebhookToken123456
[2026-09-10 12:00:02] [DEBUG] License key validated: AR-ABCD-EFGH-1234-5678
[2026-09-10 12:00:03] [DEBUG] Received token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature
[2026-09-10 12:00:04] [INFO] Roblox process running pid=1234
EOF

# Test 1: Generate bundle using roblox-manager CLI
BUNDLE_OUT="${BUNDLE_TEST_DIR}/my_support_bundle.tar.gz"
"${TEST_PROJECT}/bin/roblox-manager" support-bundle --output "$BUNDLE_OUT" >/dev/null 2>&1
status=$?
assert_status "CLI support-bundle exit code" "$status" 0

if [ -f "$BUNDLE_OUT" ]; then
    echo "PASS bundle file generated"
    PASS_COUNT=$((PASS_COUNT + 1))
else
    echo "FAIL bundle file missing"
    FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Test 2: Extract bundle and verify structure
tar -xzf "$BUNDLE_OUT" -C "$EXTRACT_DIR"
status=$?
assert_status "tar extract status" "$status" 0

assert_contains "VERSION file content" "$(<"${EXTRACT_DIR}/VERSION.txt")" "4.5.0-pilot.1"
assert_contains "environment.txt exists" "$(<"${EXTRACT_DIR}/environment.txt")" "Bash Version:"
assert_contains "doctor.txt exists" "$(<"${EXTRACT_DIR}/doctor.txt")" "AUTO REJOIN PRO - DOCTOR"

# Test 3: Redaction in config_redacted.txt
CONFIG_DUMP="$(<"${EXTRACT_DIR}/config_redacted.txt")"
assert_not_contains "Config redacts Discord webhook token" "$CONFIG_DUMP" "SuperSecretWebhookToken123456"
assert_contains "Config masks Discord webhook" "$CONFIG_DUMP" "DISCORD_WEBHOOK=\"https://discord.com/api/webhooks/[REDACTED]\""
assert_not_contains "Config redacts password" "$CONFIG_DUMP" "super_secret_db_password"
assert_not_contains "Config redacts secret" "$CONFIG_DUMP" "jwt_signing_secret_key"
assert_not_contains "Config redacts license key" "$CONFIG_DUMP" "AR-ABCD-EFGH-1234-5678"

# Test 4: Redaction in recent_logs.txt
LOG_DUMP="$(<"${EXTRACT_DIR}/recent_logs.txt")"
assert_not_contains "Logs redact Discord webhook" "$LOG_DUMP" "SuperSecretWebhookToken123456"
assert_contains "Logs mask Discord webhook" "$LOG_DUMP" "https://discord.com/api/webhooks/[REDACTED_WEBHOOK]"
assert_not_contains "Logs redact raw license key" "$LOG_DUMP" "AR-ABCD-EFGH-1234-5678"
assert_contains "Logs mask license key" "$LOG_DUMP" "AR-XXXX-XXXX-XXXX-XXXX"
assert_not_contains "Logs redact JWT token signature" "$LOG_DUMP" "doNotLeakThisSignature"
assert_contains "Logs mask JWT token" "$LOG_DUMP" "[REDACTED_JWT]"

# Test 5: CLI option error handling
bad_out="$("${TEST_PROJECT}/bin/roblox-manager" support-bundle --invalid-opt 2>&1 || true)"
assert_contains "CLI rejects invalid option" "$bad_out" "unsupported option"

echo "Support Bundle Tests: PASS=$PASS_COUNT FAIL=$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
