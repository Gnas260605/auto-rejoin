#!/bin/bash
# ╔══════════════════════════════════════════════════════╗
# ║      ROBLOX AUTO REJOIN MULTI-CLONE BOT v3.1        ║
# ║      GitHub: Gnas260605/auto-rejoin                 ║
# ╚══════════════════════════════════════════════════════╝

# ── Đường dẫn (có thể ghi đè qua biến môi trường) ──────
CONFIG_FILE="${CONFIG_FILE:-config.cfg}"
LOG_FILE="${LOG_FILE:-roblox_bot.log}"
STATS_FILE="${STATS_FILE:-roblox_stats.dat}"   # lưu số lần rejoin

# ── Biến toàn cục cho bot loop ──────────────────────────
LAST_RESTART=0
LAST_AFK_TAP=0
LAST_LAUNCH=0
LAUNCH_GRACE=60   # Giây chờ sau khi mở game trước khi kiểm tra crash

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
    echo -e "${CYN}[$ts]${NC} $1"
    # Lưu plain text vào file log (bỏ mã ANSI)
    echo "[$ts] $(echo "$1" | sed 's/\x1b\[[0-9;]*m//g')" >> "$LOG_FILE"
}

# ── Gửi Discord Webhook ──────────────────────────────────
send_discord() {
    [ -z "$DISCORD_WEBHOOK" ] && return
    curl -s -H "Content-Type: application/json" \
         -X POST \
         -d "{\"content\": \"$1\"}" \
         "$DISCORD_WEBHOOK" > /dev/null 2>&1
}

# ── Thống kê rejoin ──────────────────────────────────────
inc_rejoin_count() {
    local pkg="${1:-$ROBLOX_PACKAGE}"
    local key="rejoin_${pkg//[^a-zA-Z0-9]/_}"
    local count=0
    [ -f "$STATS_FILE" ] && count=$(grep "^${key}=" "$STATS_FILE" 2>/dev/null | cut -d= -f2)
    count=$(( ${count:-0} + 1 ))
    if [ -f "$STATS_FILE" ] && grep -q "^${key}=" "$STATS_FILE" 2>/dev/null; then
        # key đã tồn tại → cập nhật
        sed -i "s/^${key}=.*/${key}=${count}/" "$STATS_FILE" 2>/dev/null
    else
        # key chưa có → thêm mới
        echo "${key}=${count}" >> "$STATS_FILE"
    fi
}

get_rejoin_count() {
    local pkg="${1:-$ROBLOX_PACKAGE}"
    local key="rejoin_${pkg//[^a-zA-Z0-9]/_}"
    [ -f "$STATS_FILE" ] && grep "^${key}=" "$STATS_FILE" 2>/dev/null | cut -d= -f2 || echo "0"
}

# ── Tải/Lưu cấu hình ─────────────────────────────────────
load_config() {
    # shellcheck source=/dev/null
    [ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"
    PLACE_ID="${PLACE_ID:-97598239454123}"
    PRIVATE_CODE="${PRIVATE_CODE:-}"
    ROBLOX_PACKAGE="${ROBLOX_PACKAGE:-com.roblox.client}"
    CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
    AUTO_RESTART_PERIOD="${AUTO_RESTART_PERIOD:-7200}"
    ANTI_AFK="${ANTI_AFK:-true}"
    AFK_TAP_INTERVAL="${AFK_TAP_INTERVAL:-180}"
    TAP_X="${TAP_X:-540}"
    TAP_Y="${TAP_Y:-960}"
    DISCORD_WEBHOOK="${DISCORD_WEBHOOK:-}"
}

save_config() {
    cat > "$CONFIG_FILE" <<EOF
PLACE_ID="$PLACE_ID"
PRIVATE_CODE="$PRIVATE_CODE"
ROBLOX_PACKAGE="$ROBLOX_PACKAGE"
CHECK_INTERVAL=$CHECK_INTERVAL
AUTO_RESTART_PERIOD=$AUTO_RESTART_PERIOD
ANTI_AFK=$ANTI_AFK
AFK_TAP_INTERVAL=$AFK_TAP_INTERVAL
TAP_X=$TAP_X
TAP_Y=$TAP_Y
DISCORD_WEBHOOK="$DISCORD_WEBHOOK"
EOF
}

# ── Phát hiện executor ───────────────────────────────────
detect_executor() {
    if command -v su > /dev/null 2>&1 && su -c "id" > /dev/null 2>&1; then
        echo "su"
    elif command -v adb > /dev/null 2>&1 && adb shell "id" > /dev/null 2>&1; then
        echo "adb"
    else
        echo "direct"
    fi
}

EXECUTOR=""
init_executor() { EXECUTOR=$(detect_executor); }

run_cmd() {
    case "$EXECUTOR" in
        su)     su -c "$1" ;;
        adb)    adb shell "$1" ;;
        *)      eval "$1" ;;
    esac
}

# ── Tự động quét username Roblox ─────────────────────────
# Thử nhiều phương thức: root SharedPrefs → DB → files → config
get_roblox_username() {
    local pkg="${1:-$ROBLOX_PACKAGE}"
    local uname=""

    # ── Nếu có Root: thử đọc trực tiếp từ data app ──────
    local has_root=false
    command -v su > /dev/null 2>&1 && su -c "id" > /dev/null 2>&1 && has_root=true

    if $has_root; then
        local data_dir="/data/data/${pkg}"

        # Cách 1: Đọc SharedPreferences XML (thường lưu tên acc ở đây)
        uname=$(su -c "grep -rh 'username\|displayName\|display_name\|playerName\|userName\|name' \
            ${data_dir}/shared_prefs/ 2>/dev/null" \
            | grep -oP '(?<=value=")[^"]{3,40}' \
            | grep -v '^[0-9]*$' \
            | grep -v 'true\|false\|null' \
            | head -1 2>/dev/null)

        # Cách 2: Thử SQLite database Roblox
        if [ -z "$uname" ]; then
            local db_file
            db_file=$(su -c "ls ${data_dir}/databases/*.db 2>/dev/null" | head -1)
            if [ -n "$db_file" ]; then
                uname=$(su -c "sqlite3 '$db_file' \
                    \"SELECT value FROM settings WHERE key LIKE '%username%' OR key LIKE '%name%' LIMIT 1;\" \
                    2>/dev/null" | head -1)
            fi
        fi

        # Cách 3: Tìm trong tất cả file text của app
        if [ -z "$uname" ]; then
            uname=$(su -c "grep -rh '\"username\"' ${data_dir}/files/ 2>/dev/null" \
                | grep -oP '(?<="username":")[^"]{3,40}' \
                | head -1 2>/dev/null)
        fi

        # Cách 4: Đọc account cache JSON nếu có
        if [ -z "$uname" ]; then
            uname=$(su -c "find ${data_dir} -name '*.json' -o -name '*account*' -o -name '*cache*' \
                2>/dev/null | xargs grep -lh 'username' 2>/dev/null | head -1 \
                | xargs grep -oh '\"username\":\"[^\"]*\"' 2>/dev/null" \
                | grep -oP '(?<="username":")[^"]+' | head -1)
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
launch_roblox() {
    local pkg="${ROBLOX_PACKAGE}"
    log_msg "${YLW}[LAUNCH]${NC} Khởi động Roblox ${CYN}($pkg)${NC}..."
    local link
    if [ -n "$PRIVATE_CODE" ]; then
        link="roblox://navigation/share_links?code=${PRIVATE_CODE}&type=Server"
    else
        link="roblox://experiences/start?placeId=${PLACE_ID}"
    fi

    # Cách 1: am start với deep link (chỉ định package)
    run_cmd "am start -a android.intent.action.VIEW -d \"$link\" -p $pkg" > /dev/null 2>&1
    local ret=$?
    # Cách 2: am start không chỉ định package
    [ $ret -ne 0 ] && run_cmd "am start -a android.intent.action.VIEW -d \"$link\"" > /dev/null 2>&1 && ret=$?
    # Cách 3: Mở thẳng MainActivity
    if [ $ret -ne 0 ]; then
        run_cmd "am start -n $pkg/.MainActivity" > /dev/null 2>&1 ||
        run_cmd "monkey -p $pkg 1" > /dev/null 2>&1
    fi

    LAST_RESTART=$(date +%s)
    LAST_AFK_TAP=$(date +%s)
    LAST_LAUNCH=$(date +%s)
    log_msg "${GRN}[LAUNCH]${NC} Đã gửi lệnh mở game. Chờ ${LAUNCH_GRACE}s trước khi giám sát..."
}


# ── Kiểm tra mạng ────────────────────────────────────────
check_internet() {
    ping -c 1 -W 2 1.1.1.1 > /dev/null 2>&1 ||
    ping -c 1 -W 2 8.8.8.8 > /dev/null 2>&1
}

# ── Kiểm tra Roblox đang chạy (đa phương thức) ───────────
# ps -A KHÔNG thấy process khác user trên UGPhone không root.
# Dùng dumpsys activity / dumpsys window thay thế.
is_roblox_running() {
    local pkg="$ROBLOX_PACKAGE"

    # Phương thức 1: dumpsys activity (không cần root, chuẩn nhất)
    local act_out
    act_out=$(run_cmd "dumpsys activity activities" 2>/dev/null)
    if [ -n "$act_out" ]; then
        echo "$act_out" | grep -q "$pkg" && return 0
    fi

    # Phương thức 2: dumpsys window (kiểm tra cửa sổ đang hiển thị)
    local win_out
    win_out=$(run_cmd "dumpsys window windows" 2>/dev/null)
    if [ -n "$win_out" ]; then
        echo "$win_out" | grep -q "$pkg" && return 0
    fi

    # Phương thức 3: dumpsys package (kiểm tra process state)
    local pkg_out
    pkg_out=$(run_cmd "dumpsys package $pkg" 2>/dev/null | grep -i 'proc\|pid')
    if echo "$pkg_out" | grep -qi 'foreground\|perceptible\|visible'; then
        return 0
    fi

    # Phương thức 4: ps thông thường (fallback)
    local ps_out
    ps_out=$(run_cmd "ps -A" 2>/dev/null)
    [ -z "$ps_out" ] && ps_out=$(run_cmd "ps" 2>/dev/null)
    echo "$ps_out" | grep -q "$pkg" && return 0

    # Phương thức 5: pgrep
    run_cmd "pgrep -f $pkg" > /dev/null 2>&1 && return 0

    return 1  # Không tìm thấy = game đã tắt
}

# ══════════════════════════════════════════════════════════
#  CHẾ ĐỘ --run : VÒNG LẶP GIÁM SÁT (chạy trong tmux)
# ══════════════════════════════════════════════════════════
start_bot() {
    load_config
    init_executor
    clear
    echo -e "${BGRN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║   ROBLOX AUTO REJOIN - ĐANG CHẠY NGẦM  ║${NC}"
    echo -e "${BGRN}╚══════════════════════════════════════════╝${NC}"
    echo -e " ${GRN}Package :${NC} $ROBLOX_PACKAGE"
    echo -e " ${GRN}PlaceID :${NC} $PLACE_ID  ${GRN}Private:${NC} ${PRIVATE_CODE:-Không}"
    echo -e " ${GRN}Executor:${NC} $EXECUTOR  ${GRN}Anti-AFK:${NC} $ANTI_AFK"
    echo -e "${BGRN}══════════════════════════════════════════${NC}"
    log_msg "${GRN}[START]${NC} Bot khởi động, bắt đầu giám sát..."
    beep_ok

    launch_roblox

    while true; do
        sleep "$CHECK_INTERVAL"

        # [0] Kiểm tra mạng
        if ! check_internet; then
            log_msg "${RED}[NET]${NC} Mất kết nối Internet! Chờ mạng..."
            beep_warn
            send_discord "⚠️ **[$ROBLOX_PACKAGE]** Mất kết nối Internet!"
            while ! check_internet; do sleep 10; done
            log_msg "${GRN}[NET]${NC} Có mạng lại! Khởi động game..."
            beep_ok
            send_discord "📶 **[$ROBLOX_PACKAGE]** Có mạng, đang vào game!"
            run_cmd "am force-stop $ROBLOX_PACKAGE" > /dev/null 2>&1
            sleep 3
            inc_rejoin_count "$ROBLOX_PACKAGE"
            launch_roblox
            continue
        fi

        # [1] Kiểm tra crash — Bỏ qua nếu game vừa mới được mở (grace period)
        local NOW_CHK; NOW_CHK=$(date +%s)
        if [ $(( NOW_CHK - LAST_LAUNCH )) -lt "$LAUNCH_GRACE" ]; then
            local remaining=$(( LAUNCH_GRACE - NOW_CHK + LAST_LAUNCH ))
            log_msg "${CYN}[WAIT]${NC} Đang chờ game tải... (${remaining}s còn lại)"
            continue
        fi

        if ! is_roblox_running; then
            local cnt; cnt=$(get_rejoin_count "$ROBLOX_PACKAGE")
            log_msg "${RED}[CRASH]${NC} Game bị tắt/crash! Rejoin lần #$((cnt+1))..."
            beep_warn
            send_discord "💥 **[$ROBLOX_PACKAGE]** Crash! Rejoin lần #$((cnt+1))..."
            run_cmd "am force-stop $ROBLOX_PACKAGE" > /dev/null 2>&1
            sleep 3
            inc_rejoin_count "$ROBLOX_PACKAGE"
            launch_roblox
            continue
        fi

        # [2] Anti-AFK
        if [ "$ANTI_AFK" = "true" ]; then
            local NOW_AFK; NOW_AFK=$(date +%s)
            if [ $(( NOW_AFK - LAST_AFK_TAP )) -ge "$AFK_TAP_INTERVAL" ]; then
                log_msg "${CYN}[AFK]${NC} Gửi tap tại ($TAP_X, $TAP_Y)"
                run_cmd "input tap $TAP_X $TAP_Y" > /dev/null 2>&1
                LAST_AFK_TAP=$NOW_AFK
            fi
        fi

        # [3] Auto Restart định kỳ
        if [ "${AUTO_RESTART_PERIOD:-0}" -gt 0 ]; then
            local NOW_RST; NOW_RST=$(date +%s)
            if [ $(( NOW_RST - LAST_RESTART )) -ge "$AUTO_RESTART_PERIOD" ]; then
                log_msg "${YLW}[RESTART]${NC} Restart định kỳ (${AUTO_RESTART_PERIOD}s)..."
                send_discord "🔄 **[$ROBLOX_PACKAGE]** Auto restart định kỳ."
                run_cmd "am force-stop $ROBLOX_PACKAGE" > /dev/null 2>&1
                sleep 3
                launch_roblox
            fi
        fi
    done
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
    init_executor
    local cfgs; cfgs=$(get_all_configs)
    local tmux_wins
    tmux_wins=$(tmux list-windows -t roblox-multi -F "#{window_name}" 2>/dev/null)

    # Goi dumpsys MOT LAN duy nhat cho tat ca acc (tranh lag)
    local dump_act=""
    dump_act=$(run_cmd "dumpsys activity activities" 2>/dev/null < /dev/null)

    local total_online=0 total_acc=0

    echo -e "${BGRN}+---+---------------------------+-----------+-----------+----------+----------+${NC}"
    echo -e "${BGRN}|${NC} # ${BGRN}|${NC} Package Name               ${BGRN}|${NC} USERNAME  ${BGRN}|${NC} GAME      ${BGRN}|${NC} BOT      ${BGRN}|${NC} REJOIN   ${BGRN}|${NC}"
    echo -e "${BGRN}+---+---------------------------+-----------+-----------+----------+----------+${NC}"

    if [ -z "$cfgs" ]; then
        echo -e "${BGRN}|${NC}  ${RED}Chua co acc nao! Chay [1] Setup truoc.${NC}                              ${BGRN}|${NC}"
    else
        local idx=1
        for cfg in $cfgs; do
            [ -f "$cfg" ] || continue
            local pkg; pkg=$(grep '^ROBLOX_PACKAGE=' "$cfg" | cut -d'"' -f2)
            [ -z "$pkg" ] && continue
            total_acc=$((total_acc+1))

            # Username tu config
            local uname; uname=$(grep '^ROBLOX_USERNAME=' "$cfg" 2>/dev/null | cut -d'"' -f2)
            uname="${uname:0:10}"
            uname="${uname:-N/A}"

            # Trang thai game: dung ket qua dumpsys da lay 1 lan o tren
            local game_s="${RED}OFFLINE   ${NC}"
            if echo "$dump_act" | grep -q "$pkg"; then
                game_s="${BGRN}* ONLINE  ${NC}"
                total_online=$((total_online+1))
            fi

            # Trang thai bot tmux
            local win_name="${pkg//./_}"
            local bot_s="${RED}STOPPED ${NC}"
            echo "$tmux_wins" | grep -q "^${win_name}$" && bot_s="${GRN}RUNNING ${NC}"

            # So lan rejoin
            local rj_cnt; rj_cnt=$(get_rejoin_count "$pkg")

            local short_pkg="${pkg:0:27}"

            printf "${BGRN}|${NC} %-2s${BGRN}|${NC} %-27s ${BGRN}|${NC} %-9s ${BGRN}|${NC} " \
                "$idx" "$short_pkg" "$uname"
            echo -en "$game_s"
            printf "${BGRN}|${NC} "
            echo -en "$bot_s"
            printf "${BGRN}|${NC} %-8s ${BGRN}|${NC}\n" "$rj_cnt lan"
            idx=$((idx+1))
        done
    fi

    echo -e "${BGRN}+---+---------------------------+-----------+-----------+----------+----------+${NC}"
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
    echo -e "  ${GRN}Executor: ${WHT}$([ -n "$EXECUTOR" ] && echo "$EXECUTOR" || detect_executor)${NC}   ${GRN}PlaceID: ${WHT}$PLACE_ID${NC}   ${GRN}Private: ${WHT}${PRIVATE_CODE:-Không}${NC}"
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

    local ps_out; ps_out=$(run_cmd "dumpsys activity activities" 2>/dev/null)
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
            run_cmd "am force-stop $pkg" > /dev/null 2>&1
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
        bash ./setup.sh "$PLACE_ID" "$PRIVATE_CODE"
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
    echo -e "${BGRN}╚═══════════════════════════════════════════════╝${NC}"
    echo ""
    echo -ne "  Bật Anti-AFK? (true/false) [${ANTI_AFK}]: "; read -r v; [ -n "$v" ] && ANTI_AFK="$v"
    echo -ne "  Tap mỗi bao nhiêu giây? [${AFK_TAP_INTERVAL}]: "; read -r v; [ -n "$v" ] && AFK_TAP_INTERVAL="$v"
    echo -ne "  Tọa độ X của tap? [${TAP_X}]: "; read -r v; [ -n "$v" ] && TAP_X="$v"
    echo -ne "  Tọa độ Y của tap? [${TAP_Y}]: "; read -r v; [ -n "$v" ] && TAP_Y="$v"
    echo -ne "  Auto-Restart (giây, 0=tắt)? [${AUTO_RESTART_PERIOD}]: "; read -r v; [ -n "$v" ] && AUTO_RESTART_PERIOD="$v"
    echo -ne "  Check interval (giây)? [${CHECK_INTERVAL}]: "; read -r v; [ -n "$v" ] && CHECK_INTERVAL="$v"
    save_config
    echo -e "${GRN}  ✓ Đã lưu!${NC}"; sleep 1
}

# ── Action: Đổi Discord Webhook ───────────────────────────
action_discord() {
    clear
    echo -e "${BGRN}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BGRN}║          DISCORD WEBHOOK                     ║${NC}"
    echo -e "${BGRN}╠══════════════════════════════════════════════╣${NC}"
    printf  "${BGRN}║${NC}  Webhook: ${YLW}%-36s${NC}${BGRN}║${NC}\n" "${DISCORD_WEBHOOK:-Chưa cài đặt}"
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
        rm -f "$STATS_FILE"
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
        run_cmd "am force-stop $pkg" > /dev/null 2>&1
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

