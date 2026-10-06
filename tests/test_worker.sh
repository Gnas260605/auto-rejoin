#!/usr/bin/env bash
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=../lib/logger.sh
source "${REPO_DIR}/lib/logger.sh"
# shellcheck source=../lib/config.sh
source "${REPO_DIR}/lib/config.sh"
# shellcheck source=../lib/android.sh
source "${REPO_DIR}/lib/android.sh"
# shellcheck source=../lib/notification.sh
source "${REPO_DIR}/lib/notification.sh"
# shellcheck source=../lib/runtime.sh
source "${REPO_DIR}/lib/runtime.sh"
# shellcheck source=../lib/monitor.sh
source "${REPO_DIR}/lib/monitor.sh"
# shellcheck source=../lib/worker.sh
source "${REPO_DIR}/lib/worker.sh"

TEST_TMP="$(mktemp -d)"
PASS_COUNT=0
FAIL_COUNT=0
cleanup() { rm -rf "$TEST_TMP"; }
trap cleanup EXIT

pass() { PASS_COUNT=$((PASS_COUNT + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); printf 'FAIL %s\n' "$1"; }
assert_eq() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then pass "$name"; else fail "$name expected=[$expected] actual=[$actual]"; fi
}
assert_contains() {
    local name="$1" needle="$2" haystack="$3"
    case "$haystack" in *"$needle"*) pass "$name" ;; *) fail "$name: [$needle] not in [$haystack]" ;; esac
}
assert_not_contains() {
    local name="$1" needle="$2" haystack="$3"
    case "$haystack" in *"$needle"*) fail "$name: [$needle] found" ;; *) pass "$name" ;; esac
}

BGRN=""; GRN=""; RED=""; YLW=""; CYN=""; NC=""
LOG_FILE="${TEST_TMP}/worker.log"
TMP_DIR="${TEST_TMP}/tmp"
mkdir -p "$TMP_DIR"
EXECUTOR="direct"

# ── Stub thiết bị / mạng ─────────────────────────────────
FORCE_STOP_COUNT=0
FORCE_STOP_MODE=""
PM_CLEAR_OUTPUT="Success"
DISCORD_LAST=""
HTTP_RESPONSE='{"action":"NONE"}'
HTTP_FAIL=false
LAUNCH_COUNT=0
# Stub chạy trong $(...) (subshell) nên đếm/ghi lại qua file.
PM_CLEAR_FILE="${TEST_TMP}/pm_clear"
HTTP_LOG_FILE="${TEST_TMP}/http_log"
pm_clear_count() { if [ -f "$PM_CLEAR_FILE" ]; then wc -c < "$PM_CLEAR_FILE" | tr -d ' '; else printf '0'; fi; }
http_log() { cat "$HTTP_LOG_FILE" 2>/dev/null; }

monitor_force_stop_package() { FORCE_STOP_COUNT=$((FORCE_STOP_COUNT + 1)); FORCE_STOP_MODE="$3"; return 0; }
android_pm() {
    if [ "$1" = "clear" ]; then printf 'x' >> "$PM_CLEAR_FILE"; printf '%s\n' "$PM_CLEAR_OUTPUT"; fi
}
send_discord() { DISCORD_LAST="$1"; }
log_msg() { :; }
fake_http() {
    printf '%s %s %s\n' "$1" "$2" "$3" >> "$HTTP_LOG_FILE"
    [ "$HTTP_FAIL" = "true" ] && return 1
    case "$2" in
        /api/worker/ack) printf '{"success":true}\n' ;;
        *) printf '%s\n' "$HTTP_RESPONSE" ;;
    esac
}
WORKER_HTTP_FN=fake_http
MEMINFO="${TEST_TMP}/meminfo"
printf 'MemTotal:        4096000 kB\nMemFree:          100000 kB\nMemAvailable:    1024000 kB\n' > "$MEMINFO"
WORKER_MEMINFO_FILE="$MEMINFO"

reset_case() {
    config_init_defaults
    ROBLOX_PACKAGE="${1:-com.roblox.client}"
    SHOP_API_URL="https://taphoasandg.com"
    SHOP_WORKER_TOKEN="test-token-1234567890abcdef"
    WORKER_ID="ugphone-01"
    ORDER_DONE_ACTION="logout"
    ROBLOX_USERNAME="khach_abc"
    ORDER_ID="42"
    MONITOR_STATE="$MONITOR_STATE_IN_GAME"
    MONITOR_NOW=1000
    WORKER_LAST_POLL_AT=0
    WORKER_SERVER_ORDER_ID=""
    WORKER_LAST_RESULT=""
    FORCE_STOP_COUNT=0; FORCE_STOP_MODE=""; PM_CLEAR_OUTPUT="Success"
    DISCORD_LAST=""; rm -f "$HTTP_LOG_FILE" "$PM_CLEAR_FILE"; HTTP_FAIL=false; HTTP_RESPONSE='{"action":"NONE"}'
    rm -f "$TMP_DIR"/order_done_*
}

# ── Nhận diện phiên bản ──────────────────────────────────
assert_eq "edition INTL" "INTL" "$(worker_package_edition com.roblox.client)"
assert_eq "edition VNG" "VNG" "$(worker_package_edition com.roblox.client.vnggames)"
assert_eq "edition VNG clone" "VNG" "$(worker_package_edition com.roblox.client.vnggames.clone2)"
assert_eq "edition INTL clone" "CLONE" "$(worker_package_edition com.roblox.client.clone1)"
assert_eq "ram from meminfo" "1000 4000" "$(worker_ram_mb)"

# ── Config ───────────────────────────────────────────────
reset_case
SHOP_API_URL="http://evil.example.com"; config_validate_shop_worker
assert_eq "plain http URL rejected" "" "$SHOP_API_URL"
SHOP_API_URL="https://taphoasandg.com/"; config_validate_shop_worker
assert_eq "https URL kept, trailing slash removed" "https://taphoasandg.com" "$SHOP_API_URL"
SHOP_API_URL="http://localhost:3000"; config_validate_shop_worker
assert_eq "localhost http allowed for testing" "http://localhost:3000" "$SHOP_API_URL"
SHOP_WORKER_TOKEN='abc;rm -rf /'; config_validate_shop_worker
assert_eq "token with shell chars rejected" "" "$SHOP_WORKER_TOKEN"
ORDER_DONE_ACTION="nuke"; config_validate_shop_worker
assert_eq "invalid done action -> logout" "logout" "$ORDER_DONE_ACTION"

reset_case
CFG="${TEST_TMP}/config_com.roblox.client.vnggames.cfg"
ROBLOX_PACKAGE="com.roblox.client.vnggames"; ORDER_ID="77"; ORDER_DONE_ACTION="stop"
config_save "$CFG"
config_load "$CFG"
assert_eq "config round-trip SHOP_API_URL" "https://taphoasandg.com" "$SHOP_API_URL"
assert_eq "config round-trip ORDER_ID" "77" "$ORDER_ID"
assert_eq "config round-trip ORDER_DONE_ACTION" "stop" "$ORDER_DONE_ACTION"

# ── Tắt kết nối Shop: không gọi mạng ────────────────────
reset_case
SHOP_API_URL=""
worker_tick
assert_eq "disabled: no http" "" "$(http_log)"
assert_eq "disabled: no stop" "0" "$FORCE_STOP_COUNT"

# ── Heartbeat ───────────────────────────────────────────
reset_case com.roblox.client.vnggames
worker_tick
assert_contains "heartbeat posted" "POST /api/worker/heartbeat" "$(http_log)"
assert_contains "heartbeat has edition VNG" '"edition":"VNG"' "$(http_log)"
assert_contains "heartbeat has order id" '"order_id":42' "$(http_log)"
assert_contains "heartbeat has ram" '"ram_free":1000' "$(http_log)"
assert_contains "heartbeat has worker id" '"worker_id":"ugphone-01"' "$(http_log)"
assert_not_contains "token never in payload" "test-token" "$(http_log)"
assert_eq "NONE keeps running" "$MONITOR_STATE_IN_GAME" "$MONITOR_STATE"

rm -f "$HTTP_LOG_FILE"
MONITOR_NOW=1010
worker_tick
assert_eq "heartbeat throttled by interval" "" "$(http_log)"
MONITOR_NOW=1031
worker_tick
assert_contains "heartbeat again after interval" "POST /api/worker/heartbeat" "$(http_log)"

# ── Đơn xong: dừng + đăng xuất ──────────────────────────
reset_case
HTTP_RESPONSE='{"success":true,"action":"COMPLETE_LOGOUT","order_id":42}'
worker_tick
assert_eq "complete: state ORDER_DONE" "$MONITOR_STATE_ORDER_DONE" "$MONITOR_STATE"
assert_eq "complete: force stop once" "1" "$FORCE_STOP_COUNT"
assert_eq "complete: force stop is manual (operator)" "manual" "$FORCE_STOP_MODE"
assert_eq "complete: pm clear once" "1" "$(pm_clear_count)"
assert_eq "complete: result logged_out" "logged_out" "$WORKER_LAST_RESULT"
assert_contains "complete: ack sent" '"result":"logged_out"' "$(http_log)"
assert_contains "complete: ack has order" '"order_id":42' "$(http_log)"
assert_contains "complete: discord" "Đơn #42" "$DISCORD_LAST"
assert_eq "complete: order cleared" "" "$ORDER_ID"

# Lệnh lặp lại khi đã ORDER_DONE: không dừng/xoá thêm lần nào
MONITOR_NOW=2000
worker_tick
assert_eq "complete twice: no extra stop" "1" "$FORCE_STOP_COUNT"
assert_eq "complete twice: no extra clear" "1" "$(pm_clear_count)"

# ORDER_DONE không rejoin
launch_roblox() { LAUNCH_COUNT=$((LAUNCH_COUNT + 1)); }
monitor_tick
assert_eq "order done tick: still ORDER_DONE" "$MONITOR_STATE_ORDER_DONE" "$MONITOR_STATE"
assert_eq "order done tick: no launch" "0" "$LAUNCH_COUNT"

# Gán đơn mới → RESUME
HTTP_RESPONSE='{"success":true,"action":"RESUME","order_id":43}'
MONITOR_NOW=3000
worker_tick
assert_eq "resume: launching" "$MONITOR_STATE_LAUNCHING" "$MONITOR_STATE"
assert_eq "resume: adopts new order" "43" "$ORDER_ID"

# ── Dừng khẩn cấp: không xoá dữ liệu ───────────────────
reset_case
HTTP_RESPONSE='{"success":true,"action":"STOP","order_id":42}'
worker_tick
assert_eq "stop: ORDER_DONE" "$MONITOR_STATE_ORDER_DONE" "$MONITOR_STATE"
assert_eq "stop: force stop" "1" "$FORCE_STOP_COUNT"
assert_eq "stop: no pm clear" "0" "$(pm_clear_count)"
assert_eq "stop: result stopped" "stopped" "$WORKER_LAST_RESULT"

# ── pm clear lỗi (không root/ADB) ───────────────────────
reset_case
PM_CLEAR_OUTPUT="java.lang.SecurityException: PID 123 does not have permission"
HTTP_RESPONSE='{"action":"COMPLETE_LOGOUT"}'
worker_tick
assert_eq "clear fail: result logout_failed" "logout_failed" "$WORKER_LAST_RESULT"
assert_contains "clear fail: discord warns manual logout" "đăng xuất tay" "$DISCORD_LAST"

# ── Chỉ xoá package Roblox ──────────────────────────────
reset_case
worker_clear_app_data com.android.settings
assert_eq "refuse clearing non-roblox package" "0" "$(pm_clear_count)"

# ── File trigger cục bộ, không cần mạng ────────────────
reset_case com.roblox.client.clone1
SHOP_API_URL=""
printf 'stop' > "$(worker_trigger_file)"
worker_tick
assert_eq "trigger stop: ORDER_DONE" "$MONITOR_STATE_ORDER_DONE" "$MONITOR_STATE"
assert_eq "trigger stop: no clear" "0" "$(pm_clear_count)"
assert_eq "trigger removed" "false" "$([ -f "$(worker_trigger_file)" ] && echo true || echo false)"
assert_eq "trigger: no http when disabled" "" "$(http_log)"

reset_case
: > "$(worker_trigger_file)"
worker_tick
assert_eq "empty trigger uses ORDER_DONE_ACTION=logout" "1" "$(pm_clear_count)"

# ── Heartbeat lỗi → hỏi trạng thái đơn ─────────────────
reset_case
fallback_http() {
    printf '%s %s\n' "$1" "$2" >> "$HTTP_LOG_FILE"
    case "$2" in
        /api/worker/heartbeat) return 1 ;;
        /api/worker/order-status/42) printf '{"order_id":42,"status":"completed","action":"COMPLETE_LOGOUT"}\n' ;;
        *) printf '{}\n' ;;
    esac
}
WORKER_HTTP_FN=fallback_http
worker_tick
assert_contains "fallback asks order status" "GET /api/worker/order-status/42" "$(http_log)"
assert_eq "fallback completes order" "$MONITOR_STATE_ORDER_DONE" "$MONITOR_STATE"
WORKER_HTTP_FN=fake_http

# ── Shop gán đơn cho tab chưa có ORDER_ID ──────────────
reset_case
ORDER_ID=""
HTTP_RESPONSE='{"action":"NONE","order_id":55}'
worker_tick
assert_eq "adopt server order id" "55" "$ORDER_ID"

# ── Dừng trước, đăng xuất sau ──────────────────────────
reset_case
HTTP_RESPONSE='{"action":"STOP"}'
worker_tick
assert_eq "stop first: no clear" "0" "$(pm_clear_count)"
HTTP_RESPONSE='{"action":"COMPLETE_LOGOUT"}'
MONITOR_NOW=2000
worker_tick
assert_eq "logout after stop: clears data" "1" "$(pm_clear_count)"
assert_eq "logout after stop: result logged_out" "logged_out" "$WORKER_LAST_RESULT"
rm -f "$HTTP_LOG_FILE"
MONITOR_NOW=3000
worker_tick
assert_eq "repeated logout: no extra clear" "1" "$(pm_clear_count)"
assert_contains "repeated logout: ack only (Shop xoá lệnh chờ)" "POST /api/worker/ack" "$(http_log)"

# ── Trả acc xong: xoá ORDER_ID trong config ────────────
reset_case
CONFIG_FILE="${TEST_TMP}/config_com.roblox.client.cfg"
config_save "$CONFIG_FILE"
assert_contains "config has order before" 'ORDER_ID="42"' "$(cat "$CONFIG_FILE")"
HTTP_RESPONSE='{"action":"COMPLETE_LOGOUT"}'
worker_tick
assert_contains "config order cleared after logout" 'ORDER_ID=""' "$(cat "$CONFIG_FILE")"
assert_contains "config keeps token" 'SHOP_WORKER_TOKEN="test-token' "$(cat "$CONFIG_FILE")"
CONFIG_FILE=""

# ── shop_worker.cfg dùng chung cho mọi tab ─────────────
SHARED="${TEST_TMP}/shop_worker.cfg"
printf 'SHOP_API_URL="https://taphoasandg.com"\nSHOP_WORKER_TOKEN="shared-token-1234567890"\nWORKER_ID="may-01"\nORDER_ID="999"\nPLACE_ID="1"\n' > "$SHARED"
config_init_defaults
SHOP_API_URL=""; SHOP_WORKER_TOKEN=""; WORKER_ID=""; ORDER_ID="7"; PLACE_ID="555"
worker_load_shared_config "$SHARED"
assert_eq "shared: url applied" "https://taphoasandg.com" "$SHOP_API_URL"
assert_eq "shared: token applied" "shared-token-1234567890" "$SHOP_WORKER_TOKEN"
assert_eq "shared: worker id applied" "may-01" "$WORKER_ID"
assert_eq "shared: ORDER_ID per tab not overridden" "7" "$ORDER_ID"
assert_eq "shared: other keys ignored" "555" "$PLACE_ID"
WORKER_ID="tab-rieng"
worker_load_shared_config "$SHARED"
assert_eq "shared: per-tab value wins" "tab-rieng" "$WORKER_ID"
printf 'SHOP_API_URL="http://evil.example.com"\n' > "$SHARED"
SHOP_API_URL=""
worker_load_shared_config "$SHARED"
assert_eq "shared: invalid url rejected" "" "$SHOP_API_URL"

# ── Jitter ──────────────────────────────────────────────
j="$(monitor_tick_jitter com.roblox.client.vnggames)"
if [ "$j" -ge 0 ] && [ "$j" -le 4 ]; then pass "jitter in 0..4"; else fail "jitter out of range: $j"; fi
assert_eq "jitter stable per package" "$j" "$(monitor_tick_jitter com.roblox.client.vnggames)"

printf '\nPassed: %s  Failed: %s\n' "$PASS_COUNT" "$FAIL_COUNT"
[ "$FAIL_COUNT" -eq 0 ]
