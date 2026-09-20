#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_TMP="${ROOT_DIR}/tmp/test_setup_low_server_defaults"

PASS_COUNT=0
FAIL_COUNT=0

assert_status() {
    local name="$1"
    local expected="$2"
    local actual="$3"
    if [ "$expected" -eq "$actual" ]; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name - expected exit: $expected, got: $actual"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

assert_file_contains() {
    local name="$1"
    local file="$2"
    local pattern="$3"
    if grep -Fq "$pattern" "$file"; then
        echo "PASS $name"
        PASS_COUNT=$((PASS_COUNT + 1))
    else
        echo "FAIL $name - missing: $pattern"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
}

rm -rf "$TEST_TMP"
mkdir -p "$TEST_TMP/lib" "$TEST_TMP/bin" "$TEST_TMP/fakebin"

cp "${ROOT_DIR}/setup.sh" "${TEST_TMP}/setup.sh"
printf '#!/usr/bin/env bash\nexit 0\n' > "${TEST_TMP}/auto_rejoin.sh"

cat > "${TEST_TMP}/lib/android.sh" <<'EOF'
android_detect_executor() { printf 'direct\n'; }
android_set_executor() { :; }
android_list_packages() {
    printf 'package:com.roblox.client\n'
    printf 'package:aya.clone.one\n'
}
EOF
printf '#!/usr/bin/env bash\n' > "${TEST_TMP}/lib/network.sh"
printf '#!/usr/bin/env bash\n' > "${TEST_TMP}/lib/license.sh"
for lib_file in config.sh logger.sh runtime.sh roblox_session.sh session_evidence.sh roblox_api.sh notification.sh monitor.sh roblox.sh doctor.sh ui.sh profile.sh installer.sh entitlement.sh updater.sh cookie.sh delta.sh; do
    printf '#!/usr/bin/env bash\n' > "${TEST_TMP}/lib/${lib_file}"
done
printf '#!/usr/bin/env bash\nexit 0\n' > "${TEST_TMP}/bin/roblox-manager"

cat > "${TEST_TMP}/fakebin/dpkg" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "${TEST_TMP}/fakebin/curl" <<'EOF'
#!/usr/bin/env bash
exit 22
EOF
cat > "${TEST_TMP}/fakebin/tmux" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "${TEST_TMP}/fakebin/sleep" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "${TEST_TMP}/fakebin/clear" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
chmod +x "${TEST_TMP}/fakebin/"*

(
    cd "$TEST_TMP" || exit 1
    PATH="./fakebin:${PATH}" AUTO_REJOIN_PARENT=true bash setup.sh 123456 >/dev/null 2>&1
)
status=$?
assert_status "setup multi public succeeds" 0 "$status"

assert_file_contains "primary clone low server enabled" "${TEST_TMP}/config_com.roblox.client.cfg" "JOIN_LOW_SERVER=true"
assert_file_contains "primary clone strict enabled" "${TEST_TMP}/config_com.roblox.client.cfg" "LOW_SERVER_STRICT=true"
assert_file_contains "primary clone check interval fast" "${TEST_TMP}/config_com.roblox.client.cfg" "CHECK_INTERVAL=5"
assert_file_contains "primary clone low retry count" "${TEST_TMP}/config_com.roblox.client.cfg" "LOW_SERVER_PICK_RETRIES=4"
assert_file_contains "primary clone low retry delay" "${TEST_TMP}/config_com.roblox.client.cfg" "LOW_SERVER_PICK_RETRY_DELAY=2"
assert_file_contains "second clone low server enabled" "${TEST_TMP}/config_aya.clone.one.cfg" "JOIN_LOW_SERVER=true"
assert_file_contains "second clone strict enabled" "${TEST_TMP}/config_aya.clone.one.cfg" "LOW_SERVER_STRICT=true"

(
    cd "$TEST_TMP" || exit 1
    rm -f config_*.cfg
    PATH="./fakebin:${PATH}" AUTO_REJOIN_MENU_PROMPT_TIMEOUT=0 AUTO_REJOIN_SETUP_LAUNCH_DELAY=0 bash setup.sh 123456 >/dev/null 2>&1
)
status=$?
assert_status "setup menu prompt timeout succeeds" 0 "$status"

(
    cd "$TEST_TMP" || exit 1
    rm -f config_*.cfg
    PATH="./fakebin:${PATH}" AUTO_REJOIN_PARENT=true AUTO_REJOIN_JOIN_LOW_SERVER=false bash setup.sh 123456 >/dev/null 2>&1
)
status=$?
assert_status "setup explicit low server override succeeds" 0 "$status"
assert_file_contains "explicit override keeps low server disabled" "${TEST_TMP}/config_com.roblox.client.cfg" "JOIN_LOW_SERVER=false"

(
    cd "$TEST_TMP" || exit 1
    rm -f config_*.cfg
    PATH="./fakebin:${PATH}" AUTO_REJOIN_PARENT=true AUTO_REJOIN_LOW_SERVER_STRICT=true bash setup.sh 123456 >/dev/null 2>&1
)
status=$?
assert_status "setup explicit strict override succeeds" 0 "$status"
assert_file_contains "explicit strict override respected" "${TEST_TMP}/config_com.roblox.client.cfg" "LOW_SERVER_STRICT=true"

echo ""
echo "Setup Low Server Default Tests: PASS=$PASS_COUNT, FAIL=$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
