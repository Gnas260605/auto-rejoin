#!/bin/bash
# ╔══════════════════════════════════════════════════════╗
# ║      ROBLOX AUTO REJOIN MULTI-CLONE BOT v3.1        ║
# ║      GitHub: Gnas260605/auto-rejoin                 ║
# ╚══════════════════════════════════════════════════════╝

# ── Đường dẫn (có thể ghi đè qua biến môi trường) ──────
CONFIG_FILE="${CONFIG_FILE:-config.cfg}"
LOG_FILE="${LOG_FILE:-roblox_bot.log}"
STATS_FILE="${STATS_FILE:-roblox_stats.dat}"   # lưu số lần rejoin

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TMP_DIR="${SCRIPT_DIR}/tmp"
mkdir -p "$TMP_DIR"

CONFIG_LIB="${SCRIPT_DIR}/lib/config.sh"
if [ ! -f "$CONFIG_LIB" ]; then
    echo "[ERROR] Missing config library: $CONFIG_LIB" >&2
    exit 1
fi
# shellcheck source=lib/config.sh
source "$CONFIG_LIB"

ANDROID_LIB="${SCRIPT_DIR}/lib/android.sh"
if [ ! -f "$ANDROID_LIB" ]; then
    echo "[ERROR] Missing Android command library: $ANDROID_LIB" >&2
    exit 1
fi
# shellcheck source=lib/android.sh
source "$ANDROID_LIB"

NETWORK_LIB="${SCRIPT_DIR}/lib/network.sh"
if [ ! -f "$NETWORK_LIB" ]; then
    echo "[ERROR] Missing network library: $NETWORK_LIB" >&2
    exit 1
fi
# shellcheck source=lib/network.sh
source "$NETWORK_LIB"

LOGGER_LIB="${SCRIPT_DIR}/lib/logger.sh"
if [ ! -f "$LOGGER_LIB" ]; then
    echo "[ERROR] Missing logger library: $LOGGER_LIB" >&2
    exit 1
fi
# shellcheck source=lib/logger.sh
source "$LOGGER_LIB"

RUNTIME_LIB="${SCRIPT_DIR}/lib/runtime.sh"
if [ ! -f "$RUNTIME_LIB" ]; then
    echo "[ERROR] Missing runtime library: $RUNTIME_LIB" >&2
    exit 1
fi
# shellcheck source=lib/runtime.sh
source "$RUNTIME_LIB"

LICENSE_LIB="${SCRIPT_DIR}/lib/license.sh"
if [ ! -f "$LICENSE_LIB" ]; then
    echo "[ERROR] Missing license library: $LICENSE_LIB" >&2
    exit 1
fi
# shellcheck source=lib/license.sh
source "$LICENSE_LIB"

ENTITLEMENT_LIB="${SCRIPT_DIR}/lib/entitlement.sh"
if [ ! -f "$ENTITLEMENT_LIB" ]; then
    echo "[ERROR] Missing entitlement library: $ENTITLEMENT_LIB" >&2
    exit 1
fi
# shellcheck source=lib/entitlement.sh
source "$ENTITLEMENT_LIB"

ROBLOX_LIB="${SCRIPT_DIR}/lib/roblox.sh"
if [ ! -f "$ROBLOX_LIB" ]; then
    echo "[ERROR] Missing Roblox library: $ROBLOX_LIB" >&2
    exit 1
fi
# shellcheck source=lib/roblox.sh
source "$ROBLOX_LIB"

NOTIFICATION_LIB="${SCRIPT_DIR}/lib/notification.sh"
if [ ! -f "$NOTIFICATION_LIB" ]; then
    echo "[ERROR] Missing notification library: $NOTIFICATION_LIB" >&2
    exit 1
fi
# shellcheck source=lib/notification.sh
source "$NOTIFICATION_LIB"

MONITOR_LIB="${SCRIPT_DIR}/lib/monitor.sh"
if [ ! -f "$MONITOR_LIB" ]; then
    echo "[ERROR] Missing monitor library: $MONITOR_LIB" >&2
    exit 1
fi
# shellcheck source=lib/monitor.sh
source "$MONITOR_LIB"

# ── Biến toàn cục cho bot loop ──────────────────────────
LAST_RESTART=0
LAST_AFK_TAP=0
LAST_LAUNCH=0
LAUNCH_GRACE=60   # Giây chờ sau khi mở game trước khi kiểm tra crash
LAST_IN_GAME=0
IN_GAME_TIMEOUT=120
LOBBY_RETRY_COUNT=0
TAP_ON_LOAD_DONE=false
STABLE_SINCE=0

# ── Màu sắc ─────────────────────────────────────────────
BLK='\033[0;30m'
RED='\033[0;31m'
GRN='\033[0;32m'
YLW='\033[0;33m'
BLU='\033[0;34m'
MGT='\033[0;35m'
CYN='\033[0;36m'
WHT='\033[1;37m'
BGRN='\033[1;32m'   # Bright Green
BYLN='\033[1;33m'   # Bright Yellow
NC='\033[0m'

# ── Âm thanh thông báo (beep qua /dev/tty nếu có) ───────
beep_ok()   { printf '\a' 2>/dev/null; }
beep_warn() { printf '\a\a' 2>/dev/null; }

# ── Ghi log ─────────────────────────────────────────────
log_msg() {
    local ts; ts=$(date '+%Y-%m-%d %H:%M:%S')
    local display
    display="$(log_redact_secret "$1")"
    echo -e "${CYN}[$ts]${NC} $display"
    log_info "$display" "$LOG_FILE"
}

# ── Gửi Discord Webhook ──────────────────────────────────
send_discord() {
    if declare -F entitlement_discord_allowed >/dev/null 2>&1 && ! entitlement_discord_allowed; then
        if [ "${ENTITLEMENT_DISCORD_WARNED:-false}" != "true" ]; then
            log_event WARN discord_entitlement_blocked "$LOG_FILE" package "${ROBLOX_PACKAGE:-unknown}" reason "missing_discord_entitlement"
            ENTITLEMENT_DISCORD_WARNED=true
        fi
        return 0
    fi
    notification_send_discord "${DISCORD_WEBHOOK:-}" "$1" || true
}

# ── Thống kê rejoin ──────────────────────────────────────
inc_rejoin_count() {
    local pkg="${1:-$ROBLOX_PACKAGE}"
    local stats_file="roblox_stats_${pkg}.dat"
    local count=0
    [ -f "$stats_file" ] && count=$(cat "$stats_file" 2>/dev/null)
    count=$(( ${count:-0} + 1 ))
    echo "$count" > "$stats_file"
}

get_rejoin_count() {
    local pkg="${1:-$ROBLOX_PACKAGE}"
    local stats_file="roblox_stats_${pkg}.dat"
    if [ -f "$stats_file" ]; then
        cat "$stats_file" 2>/dev/null
    else
        # Fallback đọc từ file stats cũ nếu có
        local key="rejoin_${pkg//[^a-zA-Z0-9]/_}"
        [ -f "roblox_stats.dat" ] && grep "^${key}=" "roblox_stats.dat" 2>/dev/null | cut -d= -f2 || echo "0"
    fi
}

# ── Tải/Lưu cấu hình ─────────────────────────────────────
load_config() {
    if ! config_load "$CONFIG_FILE"; then
        log_msg "${YLW}[CONFIG]${NC} Config có giá trị không hợp lệ; đã dùng default an toàn cho key lỗi."
    fi
    if [ -n "$CONFIG_WARNINGS" ]; then
        while IFS= read -r warning; do
            [ -n "$warning" ] && log_msg "${YLW}[CONFIG]${NC} $warning"
        done <<EOF
$CONFIG_WARNINGS
EOF
    fi
}

save_config() {
    if ! config_save "$CONFIG_FILE"; then
        log_msg "${RED}[CONFIG]${NC} Không thể lưu config: $CONFIG_FILE"
        return 1
    fi
}

# ── Chạy lệnh với timeout để tránh treo vĩnh viễn ───────
run_with_timeout() {
    local secs="$1"; shift
    if command -v timeout > /dev/null 2>&1; then
        timeout "$secs" "$@"
    else
        # Fallback: chạy nền + wait với giới hạn thời gian
        "$@" &
        local pid=$!
        local i=0
        while kill -0 "$pid" 2>/dev/null && [ $i -lt "$secs" ]; do
            sleep 1; i=$((i+1))
        done
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null
            return 124
        fi
        wait "$pid" 2>/dev/null
    fi
}

# ── Phát hiện executor ───────────────────────────────────
detect_executor() {
    android_detect_executor
}

EXECUTOR=""
# Chỉ quét executor 1 lần, cache lại để không quét lại mỗi lần vẽ menu
init_executor() {
    [ -n "$EXECUTOR" ] && return
    EXECUTOR=$(detect_executor)
    android_set_executor "$EXECUTOR"
}

run_cmd() {
    echo "run_cmd is deprecated; use lib/android.sh typed wrappers" >&2
    return 2
}

# ── Tự động quét username Roblox ─────────────────────────
# Thử nhiều phương thức: root SharedPrefs → DB → files → config
get_roblox_username() {
    local pkg="${1:-$ROBLOX_PACKAGE}"
    local uname=""

    # ── Nếu có Root: thử đọc trực tiếp từ data app ──────
    local has_root=false
    [ "$(android_detect_executor)" = "su" ] && has_root=true

    if $has_root; then
        # Cách 1: Đọc SharedPreferences XML (thường lưu tên acc ở đây)
        uname=$(android_app_grep_recursive "$pkg" shared_prefs 'username\|displayName\|display_name\|playerName\|userName\|name' 2>/dev/null \
            | grep -oP '(?<=value=")[^"]{3,40}' \
            | grep -v '^[0-9]*$' \
            | grep -v 'true\|false\|null' \
            | head -1 2>/dev/null)

        # Cách 2: Thử SQLite database Roblox
        if [ -z "$uname" ]; then
            local db_file
            db_file=$(android_app_list_databases "$pkg" 2>/dev/null | grep '\.db$' | head -1 | tr -d '\r')
            if [ -n "$db_file" ]; then
                uname=$(android_app_sqlite_query "$pkg" "$db_file" "SELECT value FROM settings WHERE key LIKE '%username%' OR key LIKE '%name%' LIMIT 1;" 2>/dev/null | head -1)
            fi
        fi

        # Cách 3: Tìm trong các file JSON ở cấp đầu của files/ (tránh đệ quy sâu vào thư mục cache)
        if [ -z "$uname" ]; then
            uname=$(android_app_grep_recursive "$pkg" files '"username"' 2>/dev/null \
                | grep -oP '(?<="username":")[^"]{3,40}' \
                | head -1 2>/dev/null)
        fi

        # Cách 4: Đọc account cache JSON nếu có (chỉ tìm trong thư mục files/ với maxdepth 2)
        if [ -z "$uname" ]; then
            local account_files account_file
            account_files=$(android_app_find_account_files "$pkg" 2>/dev/null)
            for account_file in $account_files; do
                uname=$(android_app_grep_file "$account_file" '"username"' 2>/dev/null \
                    | grep -oP '(?<="username":")[^"]+' | head -1 2>/dev/null)
                [ -n "$uname" ] && break
            done
        fi
    fi

    # ── Fallback: đọc từ file config (đã nhập tay trước đó) ─
    if [ -z "$uname" ]; then
        local cfg="config_${pkg}.cfg"
        uname=$(grep '^ROBLOX_USERNAME=' "$cfg" 2>/dev/null | cut -d'"' -f2)
    fi

    echo "${uname:-N/A}"
}

# ── Quét username cho tất cả acc và lưu vào config ───────
scan_all_usernames() {
    local cfgs; cfgs=$(ls config_com*.cfg 2>/dev/null)
    [ -z "$cfgs" ] && [ -f "config.cfg" ] && cfgs="config.cfg"
    [ -z "$cfgs" ] && return

    local found=0
    for cfg in $cfgs; do
        local pkg; pkg=$(grep '^ROBLOX_PACKAGE=' "$cfg" | cut -d'"' -f2)
        [ -z "$pkg" ] && continue
        local uname; uname=$(get_roblox_username "$pkg")
        if [ "$uname" != "N/A" ] && [ -n "$uname" ]; then
            # Cập nhật vào config
            if grep -q '^ROBLOX_USERNAME=' "$cfg" 2>/dev/null; then
                sed -i "s/^ROBLOX_USERNAME=.*/ROBLOX_USERNAME=\"$uname\"/" "$cfg"
            else
                echo "ROBLOX_USERNAME=\"$uname\"" >> "$cfg"
            fi
            found=$((found+1))
        fi
    done
    echo "$found"
}



# ── Mở Roblox vào game ───────────────────────────────────
get_package_index() {
    local target_pkg="$1"
    local all_pkgs=""
    local cfgs; cfgs=$(get_all_configs)
    
    if [ -n "$cfgs" ]; then
        for cfg in $cfgs; do
            if [ -f "$cfg" ]; then
                local p; p=$(grep '^ROBLOX_PACKAGE=' "$cfg" 2>/dev/null | cut -d'"' -f2)
                [ -n "$p" ] && all_pkgs="$all_pkgs $p"
            fi
        done
    fi
    
    # Sắp xếp và loại bỏ trùng lặp
    all_pkgs=$(echo $all_pkgs | xargs -n 1 | sort -u)
    
    # Nếu vẫn trống (ví dụ chưa chạy setup), quét hệ thống qua Executor (su/adb)
    if [ -z "$all_pkgs" ]; then
        init_executor
        all_pkgs=$(android_list_packages 2>/dev/null | grep -i "roblox" | cut -d: -f2 | tr -d '\r' | sort -u)
    fi
    if [ -z "$all_pkgs" ]; then
        all_pkgs=$(ANDROID_EXECUTOR=direct android_list_packages 2>/dev/null | grep -i "roblox" | cut -d: -f2 | tr -d '\r' | sort -u)
    fi
    [ -z "$all_pkgs" ] && all_pkgs="com.roblox.client"

    local idx=0
    for p in $all_pkgs; do
        if [ "$p" = "$target_pkg" ]; then
            echo "$idx"
            return
        fi
        idx=$((idx+1))
    done
    echo "0"
}

launch_roblox() {
    local pkg="${ROBLOX_PACKAGE}"
    log_msg "${YLW}[LAUNCH]${NC} Khởi động Roblox ${CYN}($pkg)${NC}..."
    local link=""
    local launch_success=false
    if [ -n "$PRIVATE_CODE" ]; then
        link="$(roblox_build_private_server_uri "$PRIVATE_CODE")" || {
            log_msg "${RED}[LAUNCH]${NC} Private server code không hợp lệ."
            return 1
        }
        if ! roblox_validate_place_id "$PLACE_ID"; then
            log_msg "${RED}[LAUNCH]${NC} Place ID không hợp lệ cho private server."
            return 1
        fi
    elif [ "${JOIN_LOW_SERVER:-false}" = "true" ]; then
        local idx; idx=$(get_package_index "$pkg")
        local retry_offset=$(( ${LOW_SERVER_RETRY_OFFSET:-0} + ${RUNTIME_BACKOFF_FAILURES:-0} + ${LOBBY_RETRY_COUNT:-0} ))
        idx=$((idx + retry_offset))
        local min_p="${LOW_SERVER_MIN_PLAYERS:-1}"
        local max_p="${LOW_SERVER_MAX_PLAYERS:-0}"
        log_msg "${CYN}[LOW_SERVER]${NC} Đang quét server ít người cho clone slot #$((idx + 1))..."
        local server_info
        server_info="$(roblox_pick_low_server "$PLACE_ID" "$idx" "$min_p" "$max_p" 2>/dev/null || true)"
        if [ -z "$server_info" ] && [ "${max_p:-0}" -gt 0 ]; then
            log_msg "${YLW}[LOW_SERVER]${NC} Không có server <=${max_p} người; thử chọn server thấp nhất còn trống..."
            server_info="$(roblox_pick_low_server "$PLACE_ID" "$idx" "$min_p" 0 2>/dev/null || true)"
        fi
        if [ -n "$server_info" ]; then
            local chosen_job="${server_info%%|*}"
            local rest="${server_info#*|}"
            local chosen_playing="${rest%%|*}"
            local chosen_max="${rest#*|}"
            log_msg "${BGRN}[LOW_SERVER]${NC} Đã chọn Server #$((idx + 1)): ${YLW}${chosen_playing}/${chosen_max} players${NC} (Job: ${chosen_job:0:8}...)"
            link="$(roblox_build_game_uri "$PLACE_ID" "$chosen_job")" || {
                log_msg "${RED}[LAUNCH]${NC} Place ID hoặc Job ID không hợp lệ."
                return 1
            }
        else
            if [ "${LOW_SERVER_STRICT:-false}" = "true" ]; then
                log_msg "${YLW}[LOW_SERVER]${NC} API server ít người không khả dụng/rate-limit; vẫn mở đúng Place ID thay vì đứng im."
                log_event WARN low_server_strict_fallback "$LOG_FILE" package "$pkg" place_id "$PLACE_ID" min_players "$min_p" max_players "$max_p"
                link="$(roblox_build_game_uri "$PLACE_ID")" || {
                    log_msg "${RED}[LAUNCH]${NC} Place ID không hợp lệ."
                    return 1
                }
            else
                log_msg "${YLW}[LOW_SERVER]${NC} Không quét được server ít người hoặc API bận; dùng matchmaking mặc định."
                link="$(roblox_build_game_uri "$PLACE_ID")" || {
                    log_msg "${RED}[LAUNCH]${NC} Place ID không hợp lệ."
                    return 1
                }
            fi
        fi
    else
        link="$(roblox_build_game_uri "$PLACE_ID")" || {
            log_msg "${RED}[LAUNCH]${NC} Place ID không hợp lệ."
            return 1
        }
    fi

    local freeform_args=""
    local bounds_args=()
    if [ "$FREEFORM_LAYOUT" = "true" ]; then
        # Đảm bảo bật freeform trong cài đặt hệ thống Android
        android_settings put global enable_freeform_support 1 >/dev/null 2>&1
        android_settings put secure force_resizable_activities 1 >/dev/null 2>&1
        
        local idx; idx=$(get_package_index "$pkg")
        
        # Đọc độ phân giải màn hình thực tế từ wm size
        local size_str
        size_str=$(android_wm size 2>/dev/null | grep -oE '[0-9]+x[0-9]+' | head -n 1)
        local screen_w=1080
        local screen_h=1920
        if [ -n "$size_str" ]; then
            screen_w=$(echo "$size_str" | cut -d'x' -f1)
            screen_h=$(echo "$size_str" | cut -d'x' -f2)
        fi
        
        local w_val="${FREEFORM_WIDTH:-auto}"
        local h_val="${FREEFORM_HEIGHT:-auto}"
        local dx_val="${FREEFORM_OFFSET_X:-auto}"
        local dy_val="${FREEFORM_OFFSET_Y:-auto}"
        
        local final_w final_h final_dx final_dy
        
        # Tự động tính toán dựa trên hướng màn hình (Ngang hay Dọc)
        if [ "$screen_w" -gt "$screen_h" ]; then
            # Màn hình Ngang (Landscape - máy tính bảng / UGPhone)
            if [ "$h_val" = "auto" ] || [ -z "$h_val" ]; then
                final_h=$(( screen_h * 75 / 100 ))
            else
                final_h=$h_val
            fi
            if [ "$w_val" = "auto" ] || [ -z "$w_val" ]; then
                final_w=$(( final_h * 9 / 16 ))
            else
                final_w=$w_val
            fi
            if [ "$dx_val" = "auto" ] || [ -z "$dx_val" ]; then
                final_dx=$(( screen_w * 3 / 100 ))
            else
                final_dx=$dx_val
            fi
            if [ "$dy_val" = "auto" ] || [ -z "$dy_val" ]; then
                final_dy=$(( screen_h * 6 / 100 ))
            else
                final_dy=$dy_val
            fi
        else
            # Màn hình Dọc (Portrait - điện thoại thông thường)
            if [ "$w_val" = "auto" ] || [ -z "$w_val" ]; then
                final_w=$(( screen_w * 70 / 100 ))
            else
                final_w=$w_val
            fi
            if [ "$h_val" = "auto" ] || [ -z "$h_val" ]; then
                final_h=$(( screen_h * 50 / 100 ))
            else
                final_h=$h_val
            fi
            if [ "$dx_val" = "auto" ] || [ -z "$dx_val" ]; then
                final_dx=0
            else
                final_dx=$dx_val
            fi
            if [ "$dy_val" = "auto" ] || [ -z "$dy_val" ]; then
                final_dy=$(( screen_h * 5 / 100 ))
            else
                final_dy=$dy_val
            fi
        fi
        
        local left=$(( idx * final_dx ))
        local top=$(( idx * final_dy ))
        local right=$(( left + final_w ))
        local bottom=$(( top + final_h ))
        freeform_args="--windowingMode 5 --launch-bounds $left $top $right $bottom"
        bounds_args=("$left" "$top" "$right" "$bottom")
    fi

    # 1. Thử chạy trực tiếp bằng quyền user Termux (không dùng su) để đảm bảo UI nổi lên màn hình chính
    ANDROID_EXECUTOR=direct android_start_uri_fresh "$pkg" "$link" "${bounds_args[@]}" > /dev/null 2>&1
    local ret=$?
    [ $ret -eq 0 ] && launch_success=true

    # 2. Nếu thất bại, thử chạy qua run_cmd (su/adb) kèm theo --user 0
    if [ $ret -ne 0 ]; then
        android_start_uri_for_user_fresh 0 "$pkg" "$link" "${bounds_args[@]}" > /dev/null 2>&1
        ret=$?
        [ $ret -eq 0 ] && launch_success=true
    fi

    # Some Android/emulator builds reject -S/clear-task on VIEW deep-links.
    # Keep the target package scoped so we do not open the last Roblox/home place.
    if [ $ret -ne 0 ]; then
        ANDROID_EXECUTOR=direct android_start_uri "$pkg" "$link" "${bounds_args[@]}" > /dev/null 2>&1
        ret=$?
        [ $ret -eq 0 ] && launch_success=true
    fi

    if [ $ret -ne 0 ]; then
        android_start_uri_for_user 0 "$pkg" "$link" "${bounds_args[@]}" > /dev/null 2>&1
        ret=$?
        [ $ret -eq 0 ] && launch_success=true
    fi

    # 3. Chỉ cho phép deep-link không chỉ định package khi người vận hành bật rõ ràng.
    # Fallback này có thể mở nhầm Roblox clone hoặc experience gần nhất trên thiết bị.
    if [ $ret -ne 0 ] && [ "${ALLOW_UNSCOPED_DEEPLINK:-false}" = "true" ]; then
        ANDROID_EXECUTOR=direct android_start_uri "" "$link" "${bounds_args[@]}" > /dev/null 2>&1
        ret=$?
        [ $ret -eq 0 ] && launch_success=true
    fi

    # 4. Cách 2 (su/adb): am start không chỉ định package kèm theo --user 0
    if [ $ret -ne 0 ] && [ "${ALLOW_UNSCOPED_DEEPLINK:-false}" = "true" ]; then
        android_start_uri_for_user 0 "" "$link" "${bounds_args[@]}" > /dev/null 2>&1
        ret=$?
        [ $ret -eq 0 ] && launch_success=true
    fi

    # 5. Mở thẳng MainActivity chỉ khi bật rõ ràng vì cách này không bảo đảm đúng Place ID.
    if [ $ret -ne 0 ] && [ "${ALLOW_HOME_FALLBACK:-false}" = "true" ]; then
        ANDROID_EXECUTOR=direct android_start_activity "$pkg/.MainActivity" "${bounds_args[@]}" > /dev/null 2>&1 ||
        android_start_activity_for_user 0 "$pkg/.MainActivity" "${bounds_args[@]}" > /dev/null 2>&1 ||
        android_monkey_package "$pkg" > /dev/null 2>&1
        ret=$?
        [ $ret -eq 0 ] && launch_success=true
    fi

    if [ "$launch_success" != "true" ]; then
        log_msg "${RED}[LAUNCH]${NC} Không gửi được deep-link đúng package/placeId cho $pkg. Sẽ retry qua recovery."
        log_event WARN launch_failed "$LOG_FILE" package "$pkg" place_id "$PLACE_ID" allow_unscoped "${ALLOW_UNSCOPED_DEEPLINK:-false}" allow_home "${ALLOW_HOME_FALLBACK:-false}"
        return 1
    fi

    LAST_RESTART=$(date +%s)
    LAST_AFK_TAP=$(date +%s)
    LAST_LAUNCH=$(date +%s)
    LAST_IN_GAME=$(date +%s)
    TAP_ON_LOAD_DONE=false
    log_msg "${GRN}[LAUNCH]${NC} Đã gửi lệnh mở game. Chờ ${LAUNCH_GRACE}s trước khi giám sát..."
}


# ── Kiểm tra mạng ────────────────────────────────────────
check_internet() {
    network_is_online
}

# ── Kiểm tra Roblox đang chạy (đa phương thức) ───────────
# ps -A KHÔNG thấy process khác user trên UGPhone không root.
# Dùng dumpsys activity / dumpsys window thay thế.
is_roblox_running() {
    local pkg="$ROBLOX_PACKAGE"

    # 1. Thử dùng file status dùng chung (nếu mới và tồn tại) để tránh gọi dumpsys trực tiếp
    local use_shared=false
    if [ -f "${TMP_DIR}/roblox_activities.txt" ]; then
        local mtime
        mtime=$(stat -c %Y "${TMP_DIR}/roblox_activities.txt" 2>/dev/null || stat -f %m "${TMP_DIR}/roblox_activities.txt" 2>/dev/null)
        local now; now=$(date +%s)
        if [ -n "$mtime" ] && [ $((now - mtime)) -lt 45 ]; then
            use_shared=true
        fi
    fi

    if [ "$use_shared" = "true" ]; then
        grep -q "$pkg" "${TMP_DIR}/roblox_activities.txt" && return 0
        if [ -f "${TMP_DIR}/roblox_windows.txt" ]; then
            grep -q "$pkg" "${TMP_DIR}/roblox_windows.txt" && return 0
        fi
        # Fallback check nhanh không cần dumpsys
        android_pgrep_package "$pkg" > /dev/null 2>&1 && return 0
        local ps_out
        ps_out=$(android_ps -A 2>/dev/null)
        [ -z "$ps_out" ] && ps_out=$(android_ps 2>/dev/null)
        echo "$ps_out" | grep -q "$pkg" && return 0
        return 1
    fi

    # 2. Phương thức trực tiếp (pgrep nhẹ nhất check trước)
    android_pgrep_package "$pkg" > /dev/null 2>&1 && return 0

    local act_out
    act_out=$(android_dumpsys activity activities 2>/dev/null)
    if [ -n "$act_out" ]; then
        echo "$act_out" | grep -q "$pkg" && return 0
    fi

    local win_out
    win_out=$(android_dumpsys window windows 2>/dev/null)
    if [ -n "$win_out" ]; then
        echo "$win_out" | grep -q "$pkg" && return 0
    fi

    local pkg_out
    pkg_out=$(android_dumpsys package "$pkg" 2>/dev/null | grep -i 'proc\|pid')
    if echo "$pkg_out" | grep -qi 'foreground\|perceptible\|visible'; then
        return 0
    fi

    local ps_out
    ps_out=$(android_ps -A 2>/dev/null)
    [ -z "$ps_out" ] && ps_out=$(android_ps 2>/dev/null)
    echo "$ps_out" | grep -q "$pkg" && return 0

    return 1
}

# ── Kiểm tra xem Roblox đã vào gameplay map chưa (GameActivity) ──
is_in_game() {
    local pkg="$ROBLOX_PACKAGE"

    # 1. Thử dùng file status dùng chung (nếu mới và tồn tại) để tránh gọi dumpsys trực tiếp
    local use_shared=false
    if [ -f "${TMP_DIR}/roblox_activities.txt" ]; then
        local mtime
        mtime=$(stat -c %Y "${TMP_DIR}/roblox_activities.txt" 2>/dev/null || stat -f %m "${TMP_DIR}/roblox_activities.txt" 2>/dev/null)
        local now; now=$(date +%s)
        if [ -n "$mtime" ] && [ $((now - mtime)) -lt 45 ]; then
            use_shared=true
        fi
    fi

    if [ "$use_shared" = "true" ]; then
        grep -i "$pkg" "${TMP_DIR}/roblox_activities.txt" | grep -qi "GameActivity" && return 0
        if [ -f "${TMP_DIR}/roblox_windows.txt" ]; then
            grep -i "$pkg" "${TMP_DIR}/roblox_windows.txt" | grep -qi "GameActivity" && return 0
        fi
        return 1
    fi

    # 2. Phương thức trực tiếp
    local act_out
    act_out=$(android_dumpsys activity activities 2>/dev/null)
    if [ -n "$act_out" ]; then
        echo "$act_out" | grep -i "$pkg" | grep -qi "GameActivity" && return 0
    fi

    local win_out
    win_out=$(android_dumpsys window windows 2>/dev/null)
    if [ -n "$win_out" ]; then
        echo "$win_out" | grep -i "$pkg" | grep -qi "GameActivity" && return 0
    fi

    return 1
}

# ── Đọc Log Roblox phát hiện mất kết nối / bị kick ────────
check_roblox_log_for_disconnect() {
    local pkg="$ROBLOX_PACKAGE"
    local log_dir=""

    # Sử dụng ls -d để kiểm tra sự tồn tại của thư mục (tránh lỗi mã thoát su -c trên một số dòng máy)
    if [ -n "$(android_log_dir_exists "/sdcard/Android/data/$pkg/files/logs" 2>/dev/null | tr -d '\r\n')" ]; then
        log_dir="/sdcard/Android/data/$pkg/files/logs"
    elif [ -n "$(android_log_dir_exists "/data/data/$pkg/files/logs" 2>/dev/null | tr -d '\r\n')" ]; then
        log_dir="/data/data/$pkg/files/logs"
    fi

    [ -z "$log_dir" ] && return 1

    local latest_log
    latest_log=$(android_latest_log_file "$log_dir" 2>/dev/null | head -n 1 | tr -d '\r\n')
    [ -z "$latest_log" ] && return 1

    # Kiểm tra thời gian sửa đổi của log file để tránh nhận nhầm log của phiên chơi cũ trước đó
    local mtime
    mtime=$(android_stat_mtime "$log_dir/$latest_log" 2>/dev/null | tr -d '\r\n')
    # Thêm sai số 30 giây để xử lý tình trạng trễ đồng bộ của hệ thống tệp tin Android
    if [ -n "$mtime" ] && [ "$((mtime + 30))" -lt "${LAST_LAUNCH:-0}" ]; then
        # File log chưa được cập nhật cho phiên chơi mới, bỏ qua
        return 1
    fi

    local log_tail
    log_tail=$(android_tail_lines 150 "$log_dir/$latest_log" 2>/dev/null)
    [ -z "$log_tail" ] && return 1

    # Sử dụng grep -E -i (Extended Regex) tương thích tuyệt đối với Toybox/Busybox của Android
    # Bổ sung các từ khóa quét lỗi kick và lỗi dữ liệu lưu trữ
    if echo "$log_tail" | grep -E -i -q "connection lost|lost connection|disconnect|disconnected|server has shut down|server shutdown|shut down|shutdown|kick|kicked|moderation message|error code[:= ]*267|error code[:= ]*288|error code|game closed|pingpong|httpsendrequest failed|teleport failed|same account|save data|save data did.?n.?t load|didn.?t load right|data did.?n.?t load|please rejoin|closed connection|connection closed|failed to connect"; then
        return 0
    fi

    return 1
}

# ══════════════════════════════════════════════════════════
#  CHẾ ĐỘ --run : VÒNG LẶP GIÁM SÁT (chạy trong tmux)
# ══════════════════════════════════════════════════════════
# Phat hien Roblox da vao nham experience/placeId tu log phien hien tai.
check_roblox_log_for_wrong_place() {
    local pkg="$ROBLOX_PACKAGE"
    local expected_place="$PLACE_ID"
    local log_dir=""

    roblox_validate_place_id "$expected_place" || return 1

    if [ -n "$(android_log_dir_exists "/sdcard/Android/data/$pkg/files/logs" 2>/dev/null | tr -d '\r\n')" ]; then
        log_dir="/sdcard/Android/data/$pkg/files/logs"
    elif [ -n "$(android_log_dir_exists "/data/data/$pkg/files/logs" 2>/dev/null | tr -d '\r\n')" ]; then
        log_dir="/data/data/$pkg/files/logs"
    fi

    [ -z "$log_dir" ] && return 1

    local latest_log
    latest_log=$(android_latest_log_file "$log_dir" 2>/dev/null | head -n 1 | tr -d '\r\n')
    [ -z "$latest_log" ] && return 1

    local mtime
    mtime=$(android_stat_mtime "$log_dir/$latest_log" 2>/dev/null | tr -d '\r\n')
    if [ -n "$mtime" ] && [ "$((mtime + 30))" -lt "${LAST_LAUNCH:-0}" ]; then
        return 1
    fi

    local observed_place
    observed_place=$(android_tail_lines 220 "$log_dir/$latest_log" 2>/dev/null \
        | grep -Eio 'placeId[^0-9]{0,12}[0-9]+' \
        | grep -Eo '[0-9]+' \
        | tail -n 1)

    [ -z "$observed_place" ] && return 1
    [ "$observed_place" = "$expected_place" ] && return 1

    log_msg "${RED}[PLACE]${NC} Roblox dang o sai Place ID ${observed_place}; can ${expected_place}. Rejoin lai dung deep-link..."
    log_event WARN wrong_place_detected "$LOG_FILE" package "$pkg" expected_place "$expected_place" observed_place "$observed_place"
    return 0
}

start_bot() {
    monitor_run
}

# ══════════════════════════════════════════════════════════
#  HELPER: Progress bar
# ══════════════════════════════════════════════════════════
progress_bar() {
    local current=$1 total=$2 label="${3:-Loading}"
    local width=36
    local filled=$(( current * width / total ))
    local empty=$(( width - filled ))
    local bar=""
    local i
    for (( i=0; i<filled; i++ )); do bar+="█"; done
    for (( i=0; i<empty; i++ )); do bar+="░"; done
    printf "\r ${GRN}[${bar}]${NC} ${YLW}%3d%%${NC} %s" $(( current * 100 / total )) "$label"
    [ "$current" -eq "$total" ] && echo ""
}

# ══════════════════════════════════════════════════════════
#  MENU: Lấy danh sách config của các acc
# ══════════════════════════════════════════════════════════
get_all_configs() {
    local cfgs
    cfgs=$(ls config_com*.cfg 2>/dev/null | sort)
    if [ -z "$cfgs" ] && [ -f "config.cfg" ]; then
        cfgs="config.cfg"
    fi
    echo "$cfgs"
}

# =====================================================
#  MENU: Bang trang thai tong quan
# =====================================================
draw_main_status() {
    # init_executor da duoc cache, khong ton thoi gian neu goi lai
    init_executor
    local cfgs; cfgs=$(get_all_configs)
    local tmux_wins
    tmux_wins=$(tmux list-windows -t roblox-multi -F "#{window_name}" 2>/dev/null)

    # Lay danh sach process 1 lan duy nhat bang ps (nhanh, khong treo)
    # Uu tien shared cache cua watchdog neu con moi (< 45s)
    local ps_snapshot=""
    local use_shared=false
    if [ -f "${TMP_DIR}/roblox_activities.txt" ]; then
        local mtime now
        mtime=$(stat -c %Y "${TMP_DIR}/roblox_activities.txt" 2>/dev/null \
             || stat -f %m "${TMP_DIR}/roblox_activities.txt" 2>/dev/null)
        now=$(date +%s)
        [ -n "$mtime" ] && [ $((now - mtime)) -lt 45 ] && use_shared=true
    fi

    if [ "$use_shared" = "true" ]; then
        ps_snapshot=$(cat "${TMP_DIR}/roblox_activities.txt" 2>/dev/null)
    else
        # Khong co shared cache -> dung ps, tuyet doi KHONG goi dumpsys o day
        ps_snapshot=$(android_ps -A 2>/dev/null)
        [ -z "$ps_snapshot" ] && ps_snapshot=$(android_ps 2>/dev/null)
    fi

    local total_online=0 total_acc=0

    # Chieu rong cot: #(3) | pkg(31) | user(10) | game(9) | bot(8) | rejoin(8)
    echo -e "${BGRN}+---+-------------------------------+------------+-----------+----------+----------+${NC}"
    echo -e "${BGRN}|${NC} # ${BGRN}|${NC} Package Name                  ${BGRN}|${NC} USERNAME   ${BGRN}|${NC} GAME      ${BGRN}|${NC} BOT      ${BGRN}|${NC} REJOIN   ${BGRN}|${NC}"
    echo -e "${BGRN}+---+-------------------------------+------------+-----------+----------+----------+${NC}"

    if [ -z "$cfgs" ]; then
        echo -e "${BGRN}|${NC}  ${RED}Chua co acc nao! Chay [1] Setup truoc.${NC}                                  ${BGRN}|${NC}"
    else
        local idx=1
        for cfg in $cfgs; do
            [ -f "$cfg" ] || continue
            local pkg; pkg=$(grep '^ROBLOX_PACKAGE=' "$cfg" | cut -d'"' -f2)
            [ -z "$pkg" ] && continue
            total_acc=$((total_acc+1))

            # Username tu config (toi da 10 ky tu)
            local uname; uname=$(grep '^ROBLOX_USERNAME=' "$cfg" 2>/dev/null | cut -d'"' -f2)
            uname="${uname:0:10}"
            uname="${uname:-N/A}"

            # Trang thai game - kiem tra trong snapshot da lay 1 lan
            local game_text game_color
            if echo "$ps_snapshot" | grep -q "$pkg"; then
                game_text="ONLINE"; game_color="$BGRN"
                total_online=$((total_online+1))
            else
                game_text="OFFLINE"; game_color="$RED"
            fi

            # Trang thai bot tmux
            local win_name="${pkg//./_}"
            local bot_text bot_color
            if echo "$tmux_wins" | grep -q "^${win_name}$"; then
                bot_text="RUNNING"; bot_color="$GRN"
            else
                bot_text="STOPPED"; bot_color="$RED"
            fi

            # So lan rejoin
            local rj_cnt; rj_cnt=$(get_rejoin_count "$pkg")
            local short_pkg="${pkg:0:29}"

            # In hang du lieu - tach ma ANSI ra khoi %-format de printf tinh dung chieu rong
            printf "${BGRN}|${NC} %-2s${BGRN}|${NC} %-29s ${BGRN}|${NC} %-10s ${BGRN}|${NC} " \
                "$idx" "$short_pkg" "$uname"
            printf "${game_color}%-9s${NC} ${BGRN}|${NC} ${bot_color}%-8s${NC} ${BGRN}|${NC} %-8s ${BGRN}|${NC}\n" \
                "$game_text" "$bot_text" "${rj_cnt} lan"

            idx=$((idx+1))
        done
    fi

    echo -e "${BGRN}+---+-------------------------------+------------+-----------+----------+----------+${NC}"
    echo -e " ${GRN}Tong:${NC} ${BGRN}$total_online${NC}/${total_acc} acc ONLINE"
}


# ══════════════════════════════════════════════════════════
#  MENU: Header
# ══════════════════════════════════════════════════════════
draw_header() {
    local time_now; time_now=$(date '+%H:%M:%S %d/%m/%Y')
    echo -e "${BGRN}"
    echo "  ██████╗  ██████╗ ██████╗ ██╗      ██████╗ ██╗  ██╗"
    echo "  ██╔══██╗██╔═══██╗██╔══██╗██║     ██╔═══██╗╚██╗██╔╝"
    echo "  ██████╔╝██║   ██║██████╔╝██║     ██║   ██║ ╚███╔╝ "
    echo "  ██╔══██╗██║   ██║██╔══██╗██║     ██║   ██║ ██╔██╗ "
    echo "  ██║  ██║╚██████╔╝██████╔╝███████╗╚██████╔╝██╔╝ ██╗"
    echo "  ╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝ ╚═════╝ ╚═╝  ╚═╝"
    echo -e "${NC}"
    echo -e "  ${BGRN}AUTO REJOIN MULTI-CLONE BOT v3.1${NC}  ${CYN}│${NC}  ${YLW}$time_now${NC}"
    echo -e "  ${GRN}Executor: ${WHT}${EXECUTOR:-?}${NC}   ${GRN}PlaceID: ${WHT}$PLACE_ID${NC}   ${GRN}Private: ${WHT}${PRIVATE_CODE:-Khong}${NC}"
}

# ══════════════════════════════════════════════════════════
#  MENU: Xem chi tiết từng acc clone
# ══════════════════════════════════════════════════════════
view_clone_detail() {
    local cfgs; cfgs=$(get_all_configs)
    local arr=()
    for cfg in $cfgs; do [ -f "$cfg" ] && arr+=("$cfg"); done

    clear
    echo -e "${BGRN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║          CHỌN ACC ĐỂ XEM CHI TIẾT          ║${NC}"
    echo -e "${BGRN}╠══════════════════════════════════════════════╣${NC}"

    if [ ${#arr[@]} -eq 0 ]; then
        echo -e "${BGRN}║${NC}  ${RED}Chưa có acc nào được cài đặt!${NC}                ${BGRN}║${NC}"
        echo -e "${BGRN}╚══════════════════════════════════════════════╝${NC}"
        echo -ne "\n${WHT}Nhấn Enter để quay lại...${NC}"; read -r; return
    fi

    local i=1
    for cfg in "${arr[@]}"; do
        local pkg; pkg=$(grep '^ROBLOX_PACKAGE=' "$cfg" | cut -d'"' -f2)
        local uname; uname=$(grep '^ROBLOX_USERNAME=' "$cfg" 2>/dev/null | cut -d'"' -f2)
        printf "${BGRN}║${NC} ${YLW}[%2d]${NC} %-38s ${BGRN}║${NC}\n" "$i" "${uname:-N/A} → ${pkg:0:25}"
        i=$((i+1))
    done
    echo -e "${BGRN}║${NC}  ${CYN}[0]${NC}  Quay lại Menu                           ${BGRN}║${NC}"
    echo -e "${BGRN}╚══════════════════════════════════════════════╝${NC}"
    echo -ne "\n${WHT}  ➤ Chọn số acc [0-$((i-1))]: ${NC}"
    read -r sel

    [ "$sel" = "0" ] || [ -z "$sel" ] && return
    local idx=$((sel - 1))
    local chosen="${arr[$idx]}"
    [ -z "$chosen" ] && { echo -e "${RED}Số không hợp lệ!${NC}"; sleep 1; return; }

    # Xem chi tiết acc đã chọn
    local pkg; pkg=$(grep '^ROBLOX_PACKAGE=' "$chosen" | cut -d'"' -f2)
    local uname; uname=$(grep '^ROBLOX_USERNAME=' "$chosen" 2>/dev/null | cut -d'"' -f2)
    local place; place=$(grep '^PLACE_ID=' "$chosen" | cut -d'"' -f2)
    local log_file="roblox_${pkg}.log"
    local rj_cnt; rj_cnt=$(get_rejoin_count "$pkg")

    local ps_out=""
    local use_shared=false
    if [ -f "${TMP_DIR}/roblox_activities.txt" ]; then
        local mtime
        mtime=$(stat -c %Y "${TMP_DIR}/roblox_activities.txt" 2>/dev/null || stat -f %m "${TMP_DIR}/roblox_activities.txt" 2>/dev/null)
        local now; now=$(date +%s)
        if [ -n "$mtime" ] && [ $((now - mtime)) -lt 45 ]; then
            use_shared=true
        fi
    fi
    if [ "$use_shared" = "true" ]; then
        ps_out=$(cat "${TMP_DIR}/roblox_activities.txt" 2>/dev/null)
    else
        # Fallback nhanh: pgrep hoac ps, khong dung dumpsys
        if android_pgrep_package "$pkg" > /dev/null 2>&1; then
            ps_out="$pkg"  # gia tri truoc cho kiem tra grep phia duoi
        else
            ps_out=$(android_ps -A 2>/dev/null)
            [ -z "$ps_out" ] && ps_out=$(android_ps 2>/dev/null)
        fi
    fi
    local game_s="${RED}OFFLINE${NC}"
    echo "$ps_out" | grep -q "$pkg" && game_s="${BGRN}● ONLINE${NC}"

    local win_name="${pkg//./_}"
    local bot_s="${RED}STOPPED${NC}"
    tmux list-windows -t roblox-multi 2>/dev/null | grep -q "$win_name" && bot_s="${GRN}RUNNING${NC}"

    clear
    echo -e "${BGRN}╔═══════════════════════════════════════════════════╗${NC}"
    printf  "${BGRN}║${NC}  ${WHT}CHI TIẾT ACC #%-2s                               ${BGRN}║${NC}\n" "$sel"
    echo -e "${BGRN}╠═══════════════════════════════════════════════════╣${NC}"
    printf  "${BGRN}║${NC}  Username  : ${YLW}%-38s${NC}${BGRN}║${NC}\n" "${uname:-Chưa đặt}"
    printf  "${BGRN}║${NC}  Package   : ${CYN}%-38s${NC}${BGRN}║${NC}\n" "$pkg"
    printf  "${BGRN}║${NC}  Place ID  : ${GRN}%-38s${NC}${BGRN}║${NC}\n" "$place"
    echo -e "${BGRN}╠═══════════════════════════════════════════════════╣${NC}"
    printf  "${BGRN}║${NC}  Game      : %-4b                                  ${BGRN}║${NC}\n" "$game_s"
    printf  "${BGRN}║${NC}  Bot       : %-4b                                  ${BGRN}║${NC}\n" "$bot_s"
    printf  "${BGRN}║${NC}  Rejoin    : ${YLW}%s lần${NC}                              ${BGRN}║${NC}\n" "$rj_cnt"
    echo -e "${BGRN}╠═══════════════════════════════════════════════════╣${NC}"
    echo -e "${BGRN}║${NC}  ${WHT}LOG GẦN ĐÂY (10 dòng):${NC}                         ${BGRN}║${NC}"
    if [ -f "$log_file" ]; then
        tail -n 10 "$log_file" | while IFS= read -r line; do
            printf "${BGRN}║${NC}  ${CYN}%-49s${NC}${BGRN}║${NC}\n" "${line:0:49}"
        done
    else
        echo -e "${BGRN}║${NC}  ${YLW}Chưa có log.${NC}                                   ${BGRN}║${NC}"
    fi
    echo -e "${BGRN}╠═══════════════════════════════════════════════════╣${NC}"
    echo -e "${BGRN}║${NC}  ${GRN}[1]${NC} Đặt username  ${GRN}[2]${NC} Dừng acc này  ${GRN}[0]${NC} Quay lại ${BGRN}║${NC}"
    echo -e "${BGRN}╚═══════════════════════════════════════════════════╝${NC}"
    echo -ne "\n${WHT}  ➤ Chọn [0-2]: ${NC}"
    read -r act
    case "$act" in
        1)
            echo -ne "${WHT}  Nhập username Roblox cho acc này: ${NC}"
            read -r new_uname
            if [ -n "$new_uname" ]; then
                if grep -q '^ROBLOX_USERNAME=' "$chosen" 2>/dev/null; then
                    sed -i "s/^ROBLOX_USERNAME=.*/ROBLOX_USERNAME=\"$new_uname\"/" "$chosen"
                else
                    echo "ROBLOX_USERNAME=\"$new_uname\"" >> "$chosen"
                fi
                echo -e "${GRN}  ✓ Đã lưu username!${NC}"
                sleep 1
            fi
            ;;
        2)
            android_force_stop "$pkg" > /dev/null 2>&1
            tmux send-keys -t "roblox-multi:${win_name}" "q" 2>/dev/null
            echo -e "${RED}  ✓ Đã dừng acc $pkg${NC}"
            beep_warn
            sleep 1.5
            ;;
    esac
}

# ══════════════════════════════════════════════════════════
#  MENU CHÍNH
# ══════════════════════════════════════════════════════════
show_menu() {
    load_config
    init_executor
    clear
    draw_header
    echo ""
    draw_main_status
    echo ""
    echo -e "${BGRN}+------------------------------------------------------+${NC}"
    echo -e "${BGRN}|              MENU DIEU KHIEN                         |${NC}"
    echo -e "${BGRN}+------------------------------------------------------+${NC}"
    echo -e "${BGRN}|${NC}  ${GRN}[1]${NC} Khoi dong / Setup tat ca Bot                 ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${GRN}[2]${NC} Xem cac tab dang chay (tmux)                 ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${GRN}[3]${NC} Xem chi tiet tung acc / Dat username         ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${YLW}[4]${NC} Doi Place ID / Private Server Code           ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${YLW}[5]${NC} Cai dat Anti-AFK & Auto Restart              ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${YLW}[6]${NC} Doi Discord Webhook                          ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${CYN}[7]${NC} Xem Log cua acc                              ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${CYN}[8]${NC} Reset thong ke so lan Rejoin                 ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${CYN}[9]${NC} Lam moi man hinh                             ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${GRN}[s]${NC} Quet lai Username tat ca acc                 ${BGRN}|${NC}"
    echo -e "${BGRN}|${NC}  ${RED}[0]${NC} Dung tat ca Bot & Thoat                      ${BGRN}|${NC}"
    echo -e "${BGRN}+------------------------------------------------------+${NC}"
    echo ""
    echo -ne "${WHT}  > Chon [0-9/s]: ${NC}"
}


# ── Action: Khởi động ─────────────────────────────────────
action_start_all() {
    clear
    echo -e "${BGRN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║          KHỞI ĐỘNG TẤT CẢ BOT               ║${NC}"
    echo -e "${BGRN}╚══════════════════════════════════════════════╝${NC}"
    if [ -f "./setup.sh" ]; then
        AUTO_REJOIN_PARENT=true bash ./setup.sh "$PLACE_ID" "$PRIVATE_CODE"
    else
        echo -e "${RED}[ERROR] Không tìm thấy setup.sh!${NC}"
        echo "Đảm bảo setup.sh nằm cùng thư mục với auto_rejoin.sh"
        sleep 2
    fi
    echo -ne "\n${WHT}Nhấn Enter để quay lại...${NC}"; read -r
}

# ── Action: Attach tmux ───────────────────────────────────
action_attach_tmux() {
    if tmux has-session -t roblox-multi 2>/dev/null; then
        echo -e "${GRN}Đang mở giao diện tmux...${NC}"
        echo -e "${YLW}[TIP] Ctrl+B → D: thoát, giữ bot chạy ngầm${NC}"
        echo -e "${YLW}[TIP] Ctrl+B → 0/1/2...: chuyển tab acc${NC}"
        sleep 1.5
        tmux attach-session -t roblox-multi
    else
        echo -e "${RED}Chưa có phiên tmux nào! Chọn [1] để khởi động trước.${NC}"
        sleep 2
    fi
}

# ── Action: Đổi game ──────────────────────────────────────
action_change_game() {
    clear
    echo -e "${BGRN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║         CÀI ĐẶT GAME                    ║${NC}"
    echo -e "${BGRN}╠══════════════════════════════════════════╣${NC}"
    printf  "${BGRN}║${NC}  Place ID hiện tại : ${YLW}%-20s${NC}${BGRN}║${NC}\n" "$PLACE_ID"
    printf  "${BGRN}║${NC}  Private Code      : ${YLW}%-20s${NC}${BGRN}║${NC}\n" "${PRIVATE_CODE:-Trống (Public)}"
    echo -e "${BGRN}╚══════════════════════════════════════════╝${NC}"
    echo ""
    echo -ne "${WHT}  Nhập Place ID mới (Enter giữ nguyên '$PLACE_ID'): ${NC}"
    read -r v; [ -n "$v" ] && PLACE_ID="$v"
    echo -ne "${WHT}  Nhập Private Code (Enter giữ, 'none' để xóa): ${NC}"
    read -r v
    [ "$v" = "none" ] && PRIVATE_CODE="" || { [ -n "$v" ] && PRIVATE_CODE="$v"; }
    save_config
    echo -e "${GRN}  ✓ Đã lưu!${NC}"; sleep 1
}

# ── Action: Cài đặt nâng cao ──────────────────────────────
action_advanced() {
    clear
    echo -e "${BGRN}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║          CÀI ĐẶT NÂNG CAO                    ║${NC}"
    echo -e "${BGRN}╠═══════════════════════════════════════════════╣${NC}"
    printf  "${BGRN}║${NC}  Anti-AFK       : ${YLW}%-28s${NC}${BGRN}║${NC}\n" "$ANTI_AFK"
    printf  "${BGRN}║${NC}  Tap interval   : ${YLW}%-28s${NC}${BGRN}║${NC}\n" "${AFK_TAP_INTERVAL}s"
    printf  "${BGRN}║${NC}  Tọa độ Tap     : ${YLW}X=${TAP_X} Y=${TAP_Y}                ${NC}${BGRN}║${NC}\n"
    printf  "${BGRN}║${NC}  Auto-Restart   : ${YLW}%-28s${NC}${BGRN}║${NC}\n" "${AUTO_RESTART_PERIOD}s (0=tắt)"
    printf  "${BGRN}║${NC}  Check interval : ${YLW}%-28s${NC}${BGRN}║${NC}\n" "${CHECK_INTERVAL}s"
    printf  "${BGRN}║${NC}  Freeform Layout: ${YLW}%-28s${NC}${BGRN}║${NC}\n" "$FREEFORM_LAYOUT"
    printf  "${BGRN}║${NC}  Kích thước     : ${YLW}W=${FREEFORM_WIDTH} H=${FREEFORM_HEIGHT}             ${NC}${BGRN}║${NC}\n"
    printf  "${BGRN}║${NC}  Lệch chồng (X,Y): ${YLW}dX=${FREEFORM_OFFSET_X} dY=${FREEFORM_OFFSET_Y}             ${NC}${BGRN}║${NC}\n"
    echo -e "${BGRN}╚═══════════════════════════════════════════════╝${NC}"
    echo ""
    echo -ne "  Bật Anti-AFK? (true/false) [${ANTI_AFK}]: "; read -r v; [ -n "$v" ] && ANTI_AFK="$v"
    echo -ne "  Tap mỗi bao nhiêu giây? [${AFK_TAP_INTERVAL}]: "; read -r v; [ -n "$v" ] && AFK_TAP_INTERVAL="$v"
    echo -ne "  Tọa độ X của tap? [${TAP_X}]: "; read -r v; [ -n "$v" ] && TAP_X="$v"
    echo -ne "  Tọa độ Y của tap? [${TAP_Y}]: "; read -r v; [ -n "$v" ] && TAP_Y="$v"
    echo -ne "  Auto-Restart (giây, 0=tắt)? [${AUTO_RESTART_PERIOD}]: "; read -r v; [ -n "$v" ] && AUTO_RESTART_PERIOD="$v"
    echo -ne "  Check interval (giây)? [${CHECK_INTERVAL}]: "; read -r v; [ -n "$v" ] && CHECK_INTERVAL="$v"
    echo -ne "  Bật Freeform xếp chồng? (true/false) [${FREEFORM_LAYOUT}]: "; read -r v; [ -n "$v" ] && FREEFORM_LAYOUT="$v"
    echo -ne "  Độ rộng cửa sổ (W) [${FREEFORM_WIDTH}]: "; read -r v; [ -n "$v" ] && FREEFORM_WIDTH="$v"
    echo -ne "  Chiều cao cửa sổ (H) [${FREEFORM_HEIGHT}]: "; read -r v; [ -n "$v" ] && FREEFORM_HEIGHT="$v"
    echo -ne "  Khoảng lệch X (dX) [${FREEFORM_OFFSET_X}]: "; read -r v; [ -n "$v" ] && FREEFORM_OFFSET_X="$v"
    echo -ne "  Khoảng lệch Y (dY) [${FREEFORM_OFFSET_Y}]: "; read -r v; [ -n "$v" ] && FREEFORM_OFFSET_Y="$v"
    save_config
    echo -e "${GRN}  ✓ Đã lưu!${NC}"; sleep 1
}

# ── Action: Đổi Discord Webhook ───────────────────────────
action_discord() {
    clear
    echo -e "${BGRN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║          DISCORD WEBHOOK                     ║${NC}"
    echo -e "${BGRN}╠══════════════════════════════════════════════╣${NC}"
    local webhook_display="${DISCORD_WEBHOOK:-Chưa cài đặt}"
    [ -n "$DISCORD_WEBHOOK" ] && webhook_display="$(notification_redact_webhook "$DISCORD_WEBHOOK")"
    printf  "${BGRN}║${NC}  Webhook: ${YLW}%-36s${NC}${BGRN}║${NC}\n" "$webhook_display"
    echo -e "${BGRN}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    echo -ne "${WHT}  URL mới (Enter giữ, 'none' xóa): ${NC}"
    read -r v
    [ "$v" = "none" ] && DISCORD_WEBHOOK="" || { [ -n "$v" ] && DISCORD_WEBHOOK="$v"; }
    save_config
    echo -e "${GRN}  ✓ Đã lưu!${NC}"; sleep 1
}

# ── Action: Xem log ───────────────────────────────────────
action_view_log() {
    clear
    echo -e "${BGRN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║          XEM LOG TÀI KHOẢN                   ║${NC}"
    echo -e "${BGRN}╚══════════════════════════════════════════════╝${NC}"
    local logs; logs=$(ls roblox_*.log 2>/dev/null)
    if [ -z "$logs" ]; then
        echo -e "${RED}  Chưa có file log nào.${NC}"
        echo -ne "\n${WHT}Nhấn Enter...${NC}"; read -r; return
    fi
    local arr=(); local i=1
    for f in $logs; do
        echo -e "  ${YLW}[$i]${NC} $f"
        arr+=("$f"); i=$((i+1))
    done
    echo ""
    echo -ne "${WHT}  Chọn số file (Enter = 1): ${NC}"
    read -r sel; sel="${sel:-1}"
    local chosen="${arr[$((sel-1))]}"
    [ -z "$chosen" ] || [ ! -f "$chosen" ] && { echo -e "${RED}Không hợp lệ!${NC}"; sleep 1; return; }
    clear
    echo -e "${BGRN}════ LOG: $chosen (50 dòng cuối) ════${NC}"
    tail -n 50 "$chosen"
    echo ""
    echo -ne "${WHT}Nhấn Enter để quay lại...${NC}"; read -r
}

# ── Action: Reset stats ───────────────────────────────────
action_reset_stats() {
    echo -ne "${YLW}  Xác nhận reset thống kê rejoin? (y/N): ${NC}"
    read -r c
    if [ "$c" = "y" ] || [ "$c" = "Y" ]; then
        rm -f "$STATS_FILE" roblox_stats_com*.dat
        echo -e "${GRN}  ✓ Đã reset thống kê!${NC}"
        beep_ok
        sleep 1
    fi
}

# ── Action: Dừng tất cả ───────────────────────────────────
action_stop_all() {
    clear
    echo -e "${RED}╔══════════════════════════════════════════╗${NC}"
    echo -e "${RED}║     DỪNG TẤT CẢ BOT VÀ GAME            ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════╝${NC}"
    tmux kill-session -t roblox-multi 2>/dev/null \
        && echo -e "${GRN}  ✓ Đã tắt tmux session${NC}" \
        || echo -e "${YLW}  ⚠ Không có session đang chạy${NC}"

    for cfg in $(get_all_configs); do
        [ -f "$cfg" ] || continue
        local pkg; pkg=$(grep '^ROBLOX_PACKAGE=' "$cfg" | cut -d'"' -f2)
        [ -z "$pkg" ] && continue
        android_force_stop "$pkg" > /dev/null 2>&1
        echo -e "${RED}  ✓ Dừng: $pkg${NC}"
    done

    beep_warn
    echo ""
    echo -e "${GRN}  Đã dừng toàn bộ hệ thống.${NC}"
    echo -ne "${WHT}Nhấn Enter để thoát...${NC}"; read -r
    exit 0
}

# ══════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════
if [ "$1" = "--run" ]; then
    start_bot
else
    load_config
    while true; do
        show_menu
        read -r choice
        # Xoá ký tự \r (carriage return từ bàn phím Android) và khoảng trắng
        choice="${choice//$'\r'/}"
        choice="${choice//$'\n'/}"
        choice="${choice// /}"
        # Nếu bấm Enter không nhập gì → tự refresh (không báo lỗi)
        [ -z "$choice" ] && continue
        case "$choice" in
            1) action_start_all ;;
            2) action_attach_tmux ;;
            3) view_clone_detail ;;
            4) action_change_game ;;
            5) action_advanced ;;
            6) action_discord ;;
            7) action_view_log ;;
            8) action_reset_stats ;;
            9) ;; # loop lại = refresh
            s|S)
                clear
                echo -e "${BGRN}[*] Đang quét username tất cả acc...${NC}"
                found=$(scan_all_usernames)
                if [ "${found:-0}" -gt 0 ]; then
                    echo -e "${GRN}✓ Tìm thấy và lưu ${found} username thành công!${NC}"
                else
                    echo -e "${YLW}⚠ Không quét được username tự động.${NC}"
                    echo -e "  Lý do có thể: thiết bị không có root."
                    echo -e "  → Dùng menu [3] để nhập username thủ công."
                fi
                echo -ne "\n${WHT}Nhấn Enter để quay lại...${NC}"; read -r
                ;;
            0) action_stop_all ;;
            *) echo -e "${RED}  Lựa chọn không hợp lệ! Nhập số từ 0-9${NC}"; sleep 0.7 ;;
        esac
    done
fi

