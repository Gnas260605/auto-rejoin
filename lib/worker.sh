#!/usr/bin/env bash

# Kết nối ShopRoblox cho cày thuê: mỗi tab (package) báo heartbeat, nhận lệnh từ Shop
# và tự dừng + đăng xuất khi đơn hàng của tab đó hoàn thành.
#
# Bật khi có SHOP_API_URL + SHOP_WORKER_TOKEN trong config_<package>.cfg. Tắt thì tool chạy như cũ.
# Trigger cục bộ (không cần mạng): tạo file tmp/order_done_<package> (nội dung "logout" hoặc "stop").
#
# Lệnh Shop trả về (field "action"):
#   NONE             tiếp tục
#   COMPLETE_LOGOUT  đơn xong: dừng game + xoá dữ liệu app (đăng xuất acc khách)
#   STOP             dừng khẩn cấp: dừng game, giữ đăng nhập
#   RESUME           tab đã được gán đơn mới: mở game lại

MONITOR_STATE_ORDER_DONE="${MONITOR_STATE_ORDER_DONE:-ORDER_DONE}"
WORKER_LAST_POLL_AT="${WORKER_LAST_POLL_AT:-0}"
WORKER_ACTION="${WORKER_ACTION:-}"
WORKER_SERVER_ORDER_ID="${WORKER_SERVER_ORDER_ID:-}"
WORKER_LAST_RESULT="${WORKER_LAST_RESULT:-}"
WORKER_LAST_ORDER_ID="${WORKER_LAST_ORDER_ID:-}"

# Đọc shop_worker.cfg (dùng chung cho mọi tab trên máy): SHOP_API_URL, SHOP_WORKER_TOKEN, WORKER_ID,
# WORKER_HEARTBEAT_INTERVAL, ORDER_DONE_ACTION. Giá trị đặt riêng trong config_<package>.cfg được ưu tiên.
# Không đọc ORDER_ID (đơn là của từng tab). File chỉ được đọc như KEY=value, không thực thi.
worker_load_shared_config() {
    local file="${1:-${WORKER_SHARED_CONFIG:-${SCRIPT_DIR:-.}/shop_worker.cfg}}"
    [ -f "$file" ] || return 0
    local key line value
    local -A own=()
    for key in SHOP_API_URL SHOP_WORKER_TOKEN WORKER_ID WORKER_HEARTBEAT_INTERVAL ORDER_DONE_ACTION; do
        own[$key]="${!key:-}"
    done
    while IFS= read -r line || [ -n "$line" ]; do
        line="${line%$'\r'}"
        case "$line" in
            SHOP_API_URL=*|SHOP_WORKER_TOKEN=*|WORKER_ID=*|WORKER_HEARTBEAT_INTERVAL=*|ORDER_DONE_ACTION=*)
                key="${line%%=*}"
                value="$(config_unquote "$(config_trim "${line#*=}")")"
                # Giữ giá trị riêng của tab; mặc định (30 / logout) coi như chưa đặt riêng.
                case "$key" in
                    WORKER_HEARTBEAT_INTERVAL) [ "${own[$key]}" != "30" ] && [ -n "${own[$key]}" ] && continue ;;
                    ORDER_DONE_ACTION) [ "${own[$key]}" != "logout" ] && [ -n "${own[$key]}" ] && continue ;;
                    *) [ -n "${own[$key]}" ] && continue ;;
                esac
                printf -v "$key" '%s' "$value"
                ;;
        esac
    done < "$file"
    config_validate_shop_worker >/dev/null 2>&1 || log_event WARN shop_worker_config_invalid "$LOG_FILE" file "$file"
    config_validate_uint WORKER_HEARTBEAT_INTERVAL 30 10 3600 >/dev/null 2>&1
    return 0
}

worker_is_enabled() {
    [ -n "${SHOP_API_URL:-}" ] && [ -n "${SHOP_WORKER_TOKEN:-}" ]
}

worker_device_id() {
    if [ -n "${WORKER_ID:-}" ]; then
        printf '%s\n' "$WORKER_ID"
        return 0
    fi
    local host
    host="$(uname -n 2>/dev/null | tr -cd 'A-Za-z0-9_.-' | cut -c1-64)"
    printf '%s\n' "${host:-device}"
}

# INTL = Roblox Quốc Tế gốc, VNG = bản VNG (kể cả clone của VNG), CLONE = clone của bản Quốc Tế.
worker_package_edition() {
    local package="${1:-$ROBLOX_PACKAGE}"
    case "$package" in
        *[Vv][Nn][Gg]*) printf 'VNG\n' ;;
        com.roblox.client) printf 'INTL\n' ;;
        *) printf 'CLONE\n' ;;
    esac
}

# In "free_mb total_mb" từ /proc/meminfo (Termux đọc được, không cần root).
worker_ram_mb() {
    local file="${WORKER_MEMINFO_FILE:-/proc/meminfo}"
    [ -r "$file" ] || { printf '0 0\n'; return 0; }
    awk '/^MemAvailable:/ {free=int($2/1024)} /^MemTotal:/ {total=int($2/1024)} END {printf "%d %d\n", free, total}' "$file"
}

worker_safe_package() {
    local package="${1:-$ROBLOX_PACKAGE}"
    printf '%s\n' "${package//[^A-Za-z0-9_.-]/_}"
}

worker_trigger_file() {
    printf '%s/order_done_%s\n' "${TMP_DIR:-tmp}" "$(worker_safe_package "${1:-$ROBLOX_PACKAGE}")"
}

worker_json_string() {
    if declare -F notification_json_escape >/dev/null 2>&1; then
        printf '"%s"' "$(notification_json_escape "$1")"
    else
        local value="${1//\\/\\\\}"
        value="${value//\"/\\\"}"
        printf '"%s"' "$value"
    fi
}

# Lấy giá trị field đơn giản (chuỗi hoặc số) từ JSON phẳng, không phụ thuộc jq.
worker_json_field() {
    local json="$1" key="$2" value
    value="$(printf '%s' "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" | head -n 1 | sed 's/.*:[[:space:]]*"\(.*\)"/\1/')"
    if [ -z "$value" ]; then
        value="$(printf '%s' "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*[0-9]\+" | head -n 1 | grep -o '[0-9]\+$')"
    fi
    printf '%s\n' "$value"
}

# worker_http METHOD PATH [JSON]: in body phản hồi. Header Authorization đọc từ stdin (-H @-),
# token không nằm trên dòng lệnh (không lộ qua ps). Test thay bằng WORKER_HTTP_FN.
worker_http() {
    local method="$1" path="$2" body="${3:-}"
    if [ -n "${WORKER_HTTP_FN:-}" ] && declare -F "$WORKER_HTTP_FN" >/dev/null 2>&1; then
        "$WORKER_HTTP_FN" "$method" "$path" "$body"
        return $?
    fi
    command -v curl >/dev/null 2>&1 || return 1
    local args=(-fsS --connect-timeout 5 --max-time 10 -X "$method" -H @- -H 'Accept: application/json')
    if [ -n "$body" ]; then
        args+=(-H 'Content-Type: application/json' --data-binary "$body")
    fi
    printf 'Authorization: Bearer %s\n' "$SHOP_WORKER_TOKEN" | curl "${args[@]}" "${SHOP_API_URL}${path}"
}

# ── Tên acc Roblox đang đăng nhập trong tab ─────────────────────────────────
# Nguồn tin cậy, theo thứ tự: appStorage.json của app (cần root) → userId trong log Roblox + API
# users.roblox.com. Chỉ nhận tên đúng chuẩn Roblox. Cache theo package (tmp/username_<pkg>) để không
# gọi API mỗi heartbeat; xoá cache khi tab trả acc (worker_forget_username).
WORKER_USERNAME_REFRESH="${WORKER_USERNAME_REFRESH:-600}"
WORKER_USERNAME_RETRY="${WORKER_USERNAME_RETRY:-120}"

worker_valid_username() {
    [[ "${1:-}" =~ ^[A-Za-z0-9_]{3,20}$ ]]
}

worker_username_cache_file() {
    printf '%s/username_%s\n' "${TMP_DIR:-tmp}" "$(worker_safe_package "${1:-$ROBLOX_PACKAGE}")"
}

worker_forget_username() {
    rm -f "$(worker_username_cache_file "${1:-$ROBLOX_PACKAGE}")"
}

# In "userId|username" đọc từ appStorage.json (Roblox lưu acc đang đăng nhập ở đây).
worker_username_from_app_storage() {
    local package="$1" dir out name uid
    for dir in "/data/data/${package}/files/appData/LocalStorage" "/sdcard/Android/data/${package}/files/appData/LocalStorage"; do
        out="$(android_exec grep -oE '"(Username|UserId)":"?[^",}]*' "${dir}/appStorage.json" 2>/dev/null | tr -d '\r')"
        [ -n "$out" ] || continue
        name="$(printf '%s\n' "$out" | sed -n 's/^"Username":"\{0,1\}//p' | head -n 1 | tr -d '"')"
        uid="$(printf '%s\n' "$out" | sed -n 's/^"UserId":"\{0,1\}//p' | head -n 1)"
        if worker_valid_username "$name"; then
            printf '%s|%s\n' "${uid//[^0-9]/}" "$name"
            return 0
        fi
    done
    return 1
}

# userId gần nhất trong log phiên Roblox hiện tại.
worker_user_id_from_log() {
    local package="$1" dir latest
    for dir in "/sdcard/Android/data/${package}/files/logs" "/data/data/${package}/files/logs"; do
        latest="$(android_latest_log_file "$dir" 2>/dev/null | head -n 1 | tr -d '\r\n')"
        [ -n "$latest" ] || continue
        android_tail_lines 400 "${dir}/${latest}" 2>/dev/null \
            | grep -Eio 'user_?id["=: ]{1,4}[0-9]{3,12}' \
            | grep -Eo '[0-9]{3,12}$' \
            | tail -n 1
        return 0
    done
    return 1
}

# Tên chính thức từ userId qua API công khai của Roblox.
worker_username_from_user_id() {
    local user_id="$1" json name
    [[ "$user_id" =~ ^[0-9]{3,12}$ ]] || return 1
    declare -F roblox_http_get >/dev/null 2>&1 || return 1
    json="$(roblox_http_get "https://users.roblox.com/v1/users/${user_id}" "users" 2>/dev/null)" || return 1
    name="$(worker_json_field "$json" name)"
    worker_valid_username "$name" || return 1
    printf '%s\n' "$name"
}

# In tên acc (có thể rỗng). Không bao giờ trả giá trị không đúng chuẩn Roblox.
worker_detect_username() {
    local package="${1:-$ROBLOX_PACKAGE}" cache now at name info uid
    cache="$(worker_username_cache_file "$package")"
    now="$(monitor_now)"
    if [ -f "$cache" ]; then
        IFS='|' read -r at name < "$cache"
        if [[ "${at:-}" =~ ^[0-9]+$ ]]; then
            if worker_valid_username "$name" && [ $((now - at)) -lt "$WORKER_USERNAME_REFRESH" ]; then
                printf '%s\n' "$name"; return 0
            fi
            if [ -z "$name" ] && [ $((now - at)) -lt "$WORKER_USERNAME_RETRY" ]; then
                return 0
            fi
        fi
    fi

    name=""
    if info="$(worker_username_from_app_storage "$package")"; then
        name="${info#*|}"
    else
        uid="$(worker_user_id_from_log "$package")"
        [ -n "$uid" ] && name="$(worker_username_from_user_id "$uid")"
    fi
    worker_valid_username "$name" || name=""
    mkdir -p "${TMP_DIR:-tmp}" 2>/dev/null
    printf '%s|%s\n' "$now" "$name" > "$cache" 2>/dev/null
    [ -n "$name" ] && printf '%s\n' "$name"
    return 0
}

# Tên gửi lên Shop: tên nhận diện được từ app/log; không có thì ROBLOX_USERNAME trong config (nếu đúng chuẩn).
worker_account_username() {
    local name
    name="$(worker_detect_username "$ROBLOX_PACKAGE")"
    if [ -z "$name" ] && worker_valid_username "${ROBLOX_USERNAME:-}"; then
        name="$ROBLOX_USERNAME"
    fi
    printf '%s\n' "$name"
}

worker_current_order_id() {
    printf '%s\n' "${ORDER_ID:-${WORKER_SERVER_ORDER_ID:-}}"
}

worker_build_heartbeat() {
    local ram free total status order_id
    ram="$(worker_ram_mb)"
    free="${ram%% *}"
    total="${ram##* }"
    status="${MONITOR_STATE:-UNKNOWN}"
    order_id="$(worker_current_order_id)"
    printf '{"worker_id":%s,"tab_id":%s,"package_name":%s,"edition":%s,"account_username":%s,"order_id":%s,"status":%s,"ram_free":%s,"ram_total":%s,"place_id":%s,"last_result":%s}\n' \
        "$(worker_json_string "$(worker_device_id)")" \
        "$(worker_json_string "$(worker_safe_package)")" \
        "$(worker_json_string "$ROBLOX_PACKAGE")" \
        "$(worker_json_string "$(worker_package_edition)")" \
        "$(worker_json_string "$(worker_account_username)")" \
        "${order_id:-null}" \
        "$(worker_json_string "$status")" \
        "${free:-0}" "${total:-0}" \
        "$(worker_json_string "${PLACE_ID:-}")" \
        "$(worker_json_string "${WORKER_LAST_RESULT:-}")"
}

# Gửi heartbeat; đặt WORKER_ACTION và WORKER_SERVER_ORDER_ID theo phản hồi.
worker_heartbeat() {
    local response
    response="$(worker_http POST /api/worker/heartbeat "$(worker_build_heartbeat)" 2>/dev/null)" || return 1
    WORKER_ACTION="$(worker_json_field "$response" action)"
    WORKER_SERVER_ORDER_ID="$(worker_json_field "$response" order_id)"
    return 0
}

# Fallback khi heartbeat lỗi: hỏi riêng trạng thái đơn.
worker_fetch_order_status() {
    local order_id="$1" response
    [[ "$order_id" =~ ^[0-9]+$ ]] || return 1
    response="$(worker_http GET "/api/worker/order-status/${order_id}" 2>/dev/null)" || return 1
    WORKER_ACTION="$(worker_json_field "$response" action)"
    return 0
}

# Đặt WORKER_ACTION. Thứ tự: file trigger cục bộ → heartbeat → hỏi trạng thái đơn.
check_order_status() {
    local trigger content
    WORKER_ACTION=""

    trigger="$(worker_trigger_file)"
    if [ -f "$trigger" ]; then
        content="$(head -c 16 "$trigger" 2>/dev/null | tr -cd 'a-z')"
        rm -f "$trigger"
        case "${content:-$ORDER_DONE_ACTION}" in
            stop) WORKER_ACTION="STOP" ;;
            *) WORKER_ACTION="COMPLETE_LOGOUT" ;;
        esac
        log_event INFO order_trigger_file "$LOG_FILE" package "$ROBLOX_PACKAGE" action "$WORKER_ACTION"
        return 0
    fi

    worker_is_enabled || return 1
    if worker_heartbeat; then
        return 0
    fi
    log_event WARN worker_heartbeat_failed "$LOG_FILE" package "$ROBLOX_PACKAGE"
    local order_id
    order_id="$(worker_current_order_id)"
    [ -n "$order_id" ] && worker_fetch_order_status "$order_id" && return 0
    return 1
}

# Chỉ xoá dữ liệu package Roblox (gốc, VNG, clone). Trả 0 khi Android báo Success.
worker_clear_app_data() {
    local package="${1:-$ROBLOX_PACKAGE}" output
    android_validate_package "$package" || return 2
    case "$package" in
        *[Rr][Oo][Bb][Ll][Oo][Xx]*) ;;
        *)
            log_event ERROR app_clear_refused "$LOG_FILE" package "$package" reason "not_roblox_package"
            return 2
            ;;
    esac
    output="$(android_pm clear "$package" 2>&1)"
    case "$output" in
        *Success*) return 0 ;;
    esac
    log_event ERROR app_clear_failed "$LOG_FILE" package "$package" output "$(printf '%s' "$output" | tr -d '\r\n' | cut -c1-120)"
    return 1
}

worker_ack() {
    local command="$1" result="$2" order_id="$3"
    worker_is_enabled || return 0
    worker_http POST /api/worker/ack "$(printf '{"worker_id":%s,"package_name":%s,"command":%s,"result":%s,"order_id":%s}' \
        "$(worker_json_string "$(worker_device_id)")" \
        "$(worker_json_string "$ROBLOX_PACKAGE")" \
        "$(worker_json_string "$command")" \
        "$(worker_json_string "$result")" \
        "${order_id:-null}")" >/dev/null 2>&1 || \
        log_event WARN worker_ack_failed "$LOG_FILE" package "$ROBLOX_PACKAGE" command "$command"
}

# Kết thúc đơn của tab: hết rejoin (state ORDER_DONE), dừng game, đăng xuất nếu được yêu cầu.
# Force-stop đi qua monitor_force_stop_package mode "manual": lệnh chủ động của người vận hành/Shop.
worker_finish_order() {
    local command="$1"
    local order_id result
    order_id="$(worker_current_order_id)"

    monitor_transition "$MONITOR_STATE_ORDER_DONE" "order_${command,,}"
    monitor_force_stop_package "$ROBLOX_PACKAGE" "order_${command,,}" "manual"

    result="stopped"
    if [ "$command" = "COMPLETE_LOGOUT" ]; then
        if worker_clear_app_data "$ROBLOX_PACKAGE"; then
            result="logged_out"
        else
            result="logout_failed"
        fi
    fi
    WORKER_LAST_RESULT="$result"
    WORKER_LAST_ORDER_ID="$order_id"
    # Acc đã trả (hoặc sắp đổi acc): nhận diện lại tên ở heartbeat sau.
    worker_forget_username "$ROBLOX_PACKAGE"
    log_event WARN order_finished "$LOG_FILE" package "$ROBLOX_PACKAGE" order_id "${order_id:-none}" command "$command" result "$result"

    local label
    case "$result" in
        logged_out) label="đã dừng và đăng xuất acc" ;;
        logout_failed) label="đã dừng game nhưng KHÔNG xoá được dữ liệu app (cần root/ADB) — đăng xuất tay" ;;
        *) label="đã dừng (giữ đăng nhập)" ;;
    esac
    if declare -F send_discord >/dev/null 2>&1; then
        send_discord "✅ **[${ROBLOX_PACKAGE}]** Đơn #${order_id:-?} (${ROBLOX_USERNAME:-acc}): ${label}."
    fi
    log_msg "${GRN:-}[ĐƠN XONG]${NC:-} Đơn #${order_id:-?}: ${label}. Tab chờ đơn mới."

    worker_ack "$command" "$result" "$order_id"
    ORDER_ID=""
    WORKER_SERVER_ORDER_ID=""
    worker_forget_order_in_config
    return 0
}

# Xoá ORDER_ID khỏi config_<package>.cfg: restart bot sau khi đã đăng nhập acc khách mới
# không được mang theo mã đơn cũ (đơn cũ đã xong → Shop sẽ ra lệnh đăng xuất nhầm acc mới).
worker_forget_order_in_config() {
    local file="${CONFIG_FILE:-}"
    [ -n "$file" ] && [ -f "$file" ] || return 0
    grep -q '^ORDER_ID=' "$file" 2>/dev/null || return 0
    local tmp="${file}.tmp.$$"
    sed 's/^ORDER_ID=.*/ORDER_ID=""/' "$file" > "$tmp" && mv "$tmp" "$file"
}

worker_handle_action() {
    case "${WORKER_ACTION:-}" in
        COMPLETE_LOGOUT|STOP)
            if [ "$MONITOR_STATE" = "$MONITOR_STATE_ORDER_DONE" ]; then
                # Đã dừng trước đó. Đăng xuất bổ sung nếu lần trước chỉ dừng; còn lại chỉ xác nhận để Shop xoá lệnh chờ.
                if [ "$WORKER_ACTION" = "COMPLETE_LOGOUT" ] && [ "${WORKER_LAST_RESULT:-}" != "logged_out" ]; then
                    worker_finish_order "$WORKER_ACTION"
                else
                    worker_ack "$WORKER_ACTION" "${WORKER_LAST_RESULT:-stopped}" "${WORKER_LAST_ORDER_ID:-}"
                fi
                return 0
            fi
            worker_finish_order "$WORKER_ACTION"
            ;;
        RESUME)
            [ "$MONITOR_STATE" = "$MONITOR_STATE_ORDER_DONE" ] || return 0
            if [[ "${WORKER_SERVER_ORDER_ID:-}" =~ ^[0-9]+$ ]]; then
                ORDER_ID="$WORKER_SERVER_ORDER_ID"
            fi
            WORKER_LAST_RESULT=""
            worker_forget_username "$ROBLOX_PACKAGE"
            log_event INFO order_resume "$LOG_FILE" package "$ROBLOX_PACKAGE" order_id "${ORDER_ID:-none}"
            monitor_transition "$MONITOR_STATE_LAUNCHING" "order_assigned"
            ;;
        *)
            # Shop gán đơn cho tab đang chạy mà config chưa ghi ORDER_ID: nhận theo Shop.
            if [ -z "${ORDER_ID:-}" ] && [[ "${WORKER_SERVER_ORDER_ID:-}" =~ ^[0-9]+$ ]] \
                && [ "$MONITOR_STATE" != "$MONITOR_STATE_ORDER_DONE" ]; then
                ORDER_ID="$WORKER_SERVER_ORDER_ID"
            fi
            ;;
    esac
    return 0
}

# Gọi mỗi vòng lặp monitor. File trigger được xem mỗi vòng (rẻ); mạng chỉ theo WORKER_HEARTBEAT_INTERVAL.
worker_tick() {
    local now
    if [ ! -f "$(worker_trigger_file)" ]; then
        worker_is_enabled || return 0
        now="$(monitor_now)"
        [ $((now - ${WORKER_LAST_POLL_AT:-0})) -lt "${WORKER_HEARTBEAT_INTERVAL:-30}" ] && return 0
        WORKER_LAST_POLL_AT="$now"
    fi
    check_order_status || return 0
    worker_handle_action
    return 0
}
