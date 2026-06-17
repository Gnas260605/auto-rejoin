#!/bin/bash
# ╔══════════════════════════════════════════════════════╗
# ║      ROBLOX AUTO REJOIN - SETUP SCRIPT v3.1         ║
# ║      Cách dùng: bash setup.sh [PlaceID] [Code]      ║
# ╚══════════════════════════════════════════════════════╝

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TMP_DIR="${SCRIPT_DIR}/tmp"
mkdir -p "$TMP_DIR"

BGRN='\033[1;32m'
GRN='\033[0;32m'
RED='\033[0;31m'
YLW='\033[0;33m'
CYN='\033[0;36m'
WHT='\033[1;37m'
NC='\033[0m'

# ── Chạy lệnh với timeout để tránh treo vĩnh viễn ───────
run_with_timeout() {
    local secs="$1"; shift
    if command -v timeout > /dev/null 2>&1; then
        timeout "$secs" "$@"
    else
        "$@" &
        local pid=$!
        local i=0
        while kill -0 "$pid" 2>/dev/null && [ $i -lt "$secs" ]; do
            sleep 1; i=$((i+1))
        done
        if kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null; return 124
        fi
        wait "$pid" 2>/dev/null
    fi
}

# ── Progress bar ─────────────────────────────────────────
progress_bar() {
    local current=$1 total=$2 label="${3:-}"
    local width=40
    local filled=$(( current * width / total ))
    local empty=$(( width - filled ))
    local bar=""
    local i
    for (( i=0; i<filled; i++ )); do bar+="█"; done
    for (( i=0; i<empty; i++ )); do bar+="░"; done
    printf "\r  ${BGRN}[${bar}]${NC} ${YLW}%3d%%${NC} %s" $(( current * 100 / total )) "$label"
    [ "$current" -eq "$total" ] && echo ""
}

clear
echo -e "${BGRN}"
echo "  ████████╗ ██████╗  ██████╗ ██╗        "
echo "  ╚══██╔══╝██╔═══██╗██╔═══██╗██║        "
echo "     ██║   ██║   ██║██║   ██║██║        "
echo "     ██║   ██║   ██║██║   ██║██║        "
echo "     ██║   ╚██████╔╝╚██████╔╝███████╗   "
echo "     ╚═╝    ╚═════╝  ╚═════╝ ╚══════╝   "
echo -e "${NC}"
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║      ROBLOX AUTO REJOIN - TRÌNH CÀI ĐẶT        ║${NC}"
echo -e "${BGRN}╠══════════════════════════════════════════════════╣${NC}"

PLACE_ID="${1:-97598239454123}"
PRIVATE_CODE="${2:-}"

printf "${BGRN}║${NC}  Place ID    : ${YLW}%-36s${NC}${BGRN}║${NC}\n" "$PLACE_ID"
if [ -n "$PRIVATE_CODE" ]; then
    printf "${BGRN}║${NC}  Private Code: ${YLW}%-36s${NC}${BGRN}║${NC}\n" "$PRIVATE_CODE"
else
    printf "${BGRN}║${NC}  Chế độ      : ${YLW}%-36s${NC}${BGRN}║${NC}\n" "Public Server"
fi
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# ── BƯỚC 1 & 2: Kiểm tra và cài đặt gói thông minh ────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 1/4] Kiểm tra & Cài đặt gói cần thiết   ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"

PKGS=("tmux" "curl" "tsu" "procps" "android-tools")
MISSING_PKGS=()

# Kiểm tra từng gói bằng dpkg -s (nhanh, không cần mạng)
for p in "${PKGS[@]}"; do
    if dpkg -s "$p" > /dev/null 2>&1; then
        printf "  ${GRN}✓${NC} %-20s ${GRN}[Đã cài]${NC}\n" "$p"
    else
        printf "  ${YLW}✗${NC} %-20s ${YLW}[Cần cài]${NC}\n" "$p"
        MISSING_PKGS+=("$p")
    fi
done
echo ""

if [ ${#MISSING_PKGS[@]} -eq 0 ]; then
    echo -e "  ${BGRN}✓ Tất cả gói đã sẵn sàng — bỏ qua bước cài đặt${NC}"
else
    echo -e "  ${YLW}Đang cập nhật danh sách repo...${NC}"
    pkg update -y -o Dpkg::Options::="--force-confold" 2>&1 | tail -3
    echo ""
    local mp_total=${#MISSING_PKGS[@]}
    local mp_idx=0
    for p in "${MISSING_PKGS[@]}"; do
        mp_idx=$((mp_idx+1))
        echo -ne "  ${CYN}[$mp_idx/$mp_total]${NC} Đang cài ${YLW}$p${NC}... "
        if pkg install -y "$p" > /dev/null 2>&1; then
            echo -e "${BGRN}✓ OK${NC}"
        else
            echo -e "${RED}✗ Lỗi! (thử thủ công: pkg install $p)${NC}"
        fi
    done
    echo -e "  ${BGRN}✓ Hoàn tất cài đặt gói${NC}"
fi
echo ""

# ── BƯỚC 2/4: Tải script mới nhất ─────────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 2/4] Tải script auto_rejoin.sh           ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
if [ -f "auto_rejoin.sh" ]; then
    progress_bar 4 4 "Dùng bản local..."
    echo -e "  ${BGRN}✓ Phát hiện bản local, bỏ qua tải từ GitHub để tránh ghi đè tùy chỉnh${NC}"
else
    SCRIPT_URL="https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/auto_rejoin.sh"
    progress_bar 1 4 "Đang kết nối GitHub..."
    sleep 0.3
    progress_bar 2 4 "Đang tải file..."
    if curl -fsSL -o auto_rejoin.sh.tmp "$SCRIPT_URL" 2>/dev/null && [ -s auto_rejoin.sh.tmp ]; then
        mv auto_rejoin.sh.tmp auto_rejoin.sh
        progress_bar 3 4 "Đang xác thực..."
        sleep 0.2
        progress_bar 4 4 "Hoàn tất!"
        echo -e "  ${BGRN}✓ Tải thành công từ GitHub${NC}"
    else
        rm -f auto_rejoin.sh.tmp
        progress_bar 4 4 "Dùng bản local..."
        echo -e "  ${YLW}⚠ Không thể tải từ GitHub, dùng bản local${NC}"
    fi
fi
chmod +x auto_rejoin.sh setup.sh
echo ""

# ── BƯỚC 3/4: Phát hiện executor ──────────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 3/4] Phát hiện phương thức hệ thống      ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
progress_bar 1 3 "Kiểm tra Root (su)..."
EXECUTOR_TYPE="direct"
if command -v su > /dev/null 2>&1 && run_with_timeout 2 su -c "id" > /dev/null 2>&1; then
    EXECUTOR_TYPE="su"
    progress_bar 3 3 "Đã phát hiện!"
    echo -e "  ${BGRN}✓ Đã phát hiện quyền Root (su)${NC}"
else
    progress_bar 2 3 "Kiểm tra ADB..."
    if command -v adb > /dev/null 2>&1 && run_with_timeout 2 adb shell "id" > /dev/null 2>&1; then
        EXECUTOR_TYPE="adb"
        progress_bar 3 3 "Đã phát hiện!"
        echo -e "  ${BGRN}✓ Đã phát hiện ADB shell${NC}"
    else
        progress_bar 3 3 "Che do direct"
        echo -e "  ${YLW}⚠ Không có root/adb, chạy chế độ direct (hạn chế)${NC}"
    fi
fi
echo ""

# ── BƯỚC 4/4: Quét clone & Khởi động ──────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 4/4] Quét Roblox clone & Khởi động       ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
progress_bar 1 3 "Đang quét gói Roblox..."
sleep 0.5

PACKAGES=""
case "$EXECUTOR_TYPE" in
    su)     PACKAGES=$(su -c "pm list packages" 2>/dev/null | grep -i "roblox" | cut -d: -f2 | tr -d '\r') ;;
    adb)    PACKAGES=$(adb shell "pm list packages" 2>/dev/null | grep -i "roblox" | cut -d: -f2 | tr -d '\r') ;;
    *)      PACKAGES=$(pm list packages 2>/dev/null | grep -i "roblox" | cut -d: -f2 | tr -d '\r') ;;
esac

progress_bar 2 3 "Phân tích danh sách..."
sleep 0.3

if [ -z "$PACKAGES" ]; then
    PACKAGES="com.roblox.client"
    echo -e "  ${YLW}⚠ Không quét được bản clone, dùng gói mặc định${NC}"
else
    echo -e "  ${BGRN}✓ Tìm thấy các gói Roblox:${NC}"
    for p in $PACKAGES; do
        echo -e "    ${CYN}→${NC} $p"
    done
fi

progress_bar 3 3 "Hoàn tất!"
echo ""

# Dừng phiên tmux cũ
tmux kill-session -t roblox-multi 2>/dev/null

echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║       KHỞI ĐỘNG BOT CHO TỪNG TÀI KHOẢN         ║${NC}"
echo -e "${BGRN}╠══════════════════════════════════════════════════╣${NC}"

COUNT=1
TOTAL=$(echo "$PACKAGES" | wc -w)

# -- KHONG HOI USERNAME NUA, TU DONG DOC TU CONFIG CU --
echo -e "${BGRN}+------------------------------------------------------+${NC}"
echo -e "${BGRN}|   DANG LAY USERNAME TU DONG / CONFIG CU...           |${NC}"
echo -e "${BGRN}+------------------------------------------------------+${NC}"
echo ""

declare -A USERNAME_MAP
idx=1
for PKG in $PACKAGES; do
    CFG="config_${PKG}.cfg"
    # Lấy username đã lưu trước đó nếu có
    OLD_UNAME=""
    [ -f "$CFG" ] && OLD_UNAME=$(grep '^ROBLOX_USERNAME=' "$CFG" 2>/dev/null | cut -d'"' -f2)

    SHORT_PKG="${PKG: -8}"   # Lấy 8 ký tự cuối để phân biệt (client, client1, ...)
    if [ -n "$OLD_UNAME" ]; then
        USERNAME_MAP["$PKG"]="$OLD_UNAME"
    else
        USERNAME_MAP["$PKG"]=""
    fi
    idx=$((idx+1))
done
echo ""

# Đọc cấu hình mặc định từ config.cfg nếu có để làm giá trị fallback
DEFAULT_WEBHOOK=""
DEFAULT_CHECK_INTERVAL=30
DEFAULT_AUTO_RESTART=7200
DEFAULT_ANTI_AFK=true
DEFAULT_TAP_INTERVAL=180
DEFAULT_TAP_X=540
DEFAULT_TAP_Y=960

if [ -f "config.cfg" ]; then
    DEFAULT_WEBHOOK=$(grep '^DISCORD_WEBHOOK=' config.cfg | cut -d'"' -f2 2>/dev/null)
    DEFAULT_CHECK_INTERVAL=$(grep '^CHECK_INTERVAL=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_AUTO_RESTART=$(grep '^AUTO_RESTART_PERIOD=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_ANTI_AFK=$(grep '^ANTI_AFK=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_TAP_INTERVAL=$(grep '^AFK_TAP_INTERVAL=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_TAP_X=$(grep '^TAP_X=' config.cfg | cut -d'=' -f2 2>/dev/null)
    DEFAULT_TAP_Y=$(grep '^TAP_Y=' config.cfg | cut -d'=' -f2 2>/dev/null)
fi

echo -e "${BGRN}+------------------------------------------------------+${NC}"
echo -e "${BGRN}|       KHOI DONG BOT CHO TUNG TAI KHOAN               |${NC}"
echo -e "${BGRN}+------------------------------------------------------+${NC}"

for PKG in $PACKAGES; do
    CFG="config_${PKG}.cfg"
    LOG="roblox_${PKG}.log"
    WIN="${PKG//./_}"
    SAVED_USERNAME="${USERNAME_MAP[$PKG]:-}"

    # Đọc và giữ lại cấu hình cũ của account này nếu đã tồn tại
    EXISTING_WEBHOOK=""
    EXISTING_CHECK_INTERVAL=""
    EXISTING_AUTO_RESTART=""
    EXISTING_ANTI_AFK=""
    EXISTING_TAP_INTERVAL=""
    EXISTING_TAP_X=""
    EXISTING_TAP_Y=""

    if [ -f "$CFG" ]; then
        EXISTING_WEBHOOK=$(grep '^DISCORD_WEBHOOK=' "$CFG" | cut -d'"' -f2 2>/dev/null)
        EXISTING_CHECK_INTERVAL=$(grep '^CHECK_INTERVAL=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_AUTO_RESTART=$(grep '^AUTO_RESTART_PERIOD=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_ANTI_AFK=$(grep '^ANTI_AFK=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_TAP_INTERVAL=$(grep '^AFK_TAP_INTERVAL=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_TAP_X=$(grep '^TAP_X=' "$CFG" | cut -d'=' -f2 2>/dev/null)
        EXISTING_TAP_Y=$(grep '^TAP_Y=' "$CFG" | cut -d'=' -f2 2>/dev/null)
    fi

    # Lấy giá trị hiện tại (ưu tiên của account -> mặc định chung -> mặc định mặc định)
    DISCORD_WEBHOOK="${EXISTING_WEBHOOK:-$DEFAULT_WEBHOOK}"
    CHECK_INTERVAL="${EXISTING_CHECK_INTERVAL:-${DEFAULT_CHECK_INTERVAL:-30}}"
    AUTO_RESTART_PERIOD="${EXISTING_AUTO_RESTART:-${DEFAULT_AUTO_RESTART:-7200}}"
    ANTI_AFK="${EXISTING_ANTI_AFK:-${DEFAULT_ANTI_AFK:-true}}"
    AFK_TAP_INTERVAL="${EXISTING_TAP_INTERVAL:-${DEFAULT_TAP_INTERVAL:-180}}"
    TAP_X="${EXISTING_TAP_X:-${DEFAULT_TAP_X:-540}}"
    TAP_Y="${EXISTING_TAP_Y:-${DEFAULT_TAP_Y:-960}}"

    cat > "$CFG" <<EOF
PLACE_ID="$PLACE_ID"
PRIVATE_CODE="$PRIVATE_CODE"
ROBLOX_PACKAGE="$PKG"
CHECK_INTERVAL=$CHECK_INTERVAL
AUTO_RESTART_PERIOD=$AUTO_RESTART_PERIOD
ANTI_AFK=$ANTI_AFK
AFK_TAP_INTERVAL=$AFK_TAP_INTERVAL
TAP_X=$TAP_X
TAP_Y=$TAP_Y
DISCORD_WEBHOOK="$DISCORD_WEBHOOK"
ROBLOX_USERNAME="${SAVED_USERNAME}"
EOF

    progress_bar $COUNT $TOTAL "Khởi động acc $COUNT/$TOTAL..."

    if [ $COUNT -eq 1 ]; then
        tmux new-session -d -s roblox-multi -n "$WIN" 2>/dev/null
    else
        tmux new-window -t roblox-multi -n "$WIN" 2>/dev/null
    fi
    tmux set-window-option -t "roblox-multi:${WIN}" automatic-rename off 2>/dev/null
    tmux set-window-option -t "roblox-multi:${WIN}" remain-on-exit on 2>/dev/null
    tmux respawn-pane -k -t "roblox-multi:${WIN}" -c "$PWD" \
        "CONFIG_FILE=\"$CFG\" LOG_FILE=\"$LOG\" STATS_FILE=\"roblox_stats_${PKG}.dat\" bash auto_rejoin.sh --run" 2>/dev/null

    UNAME_DISPLAY="${SAVED_USERNAME:-N/A}"
    printf "${BGRN}|${NC}  ${BGRN}*${NC} Acc ${YLW}%2d${NC}: ${CYN}%-28s${NC} ${GRN}%-12s${NC}${BGRN}|${NC}\n" \
        "$COUNT" "$PKG" "[$UNAME_DISPLAY]"
    COUNT=$((COUNT+1))

    # Chờ 10s trước khi mở tab tiếp theo (trừ tab cuối cùng)
    if [ $COUNT -le $TOTAL ]; then
        printf "  ${YLW}⏳ Chờ 10s trước khi mở acc tiếp theo:${NC} "
        for i in 10 9 8 7 6 5 4 3 2 1; do
            printf "${YLW}%d...${NC} " $i
            sleep 1
        done
        echo ""
    fi
done



# ── WATCHDOG: Tab riêng giám sát TẤT CẢ các bot ────────
# Nếu bản thân script bot bị crash trong tmux → watchdog restart nó
tmux new-window -t roblox-multi -n "WATCHDOG" 2>/dev/null

# Tạo danh sách tất cả package để watchdog theo dõi
ALL_PKGS_LINE="$PACKAGES"
ALL_CFGS_LINE=""
for PKG in $PACKAGES; do
    CFG="config_${PKG}.cfg"
    LOG="roblox_${PKG}.log"
    ALL_CFGS_LINE="$ALL_CFGS_LINE $CFG:$PKG:$LOG"
done

# Ghi script watchdog vào file tạm rồi chạy
cat > "${TMP_DIR}/watchdog_roblox.sh" << 'WDEOF'
#!/bin/bash
BGRN='\033[1;32m'; GRN='\033[0;32m'; RED='\033[0;31m'; YLW='\033[0;33m'; CYN='\033[0;36m'; NC='\033[0m'
ALL_CFGS="$1"   # Danh sách "cfg:pkg:log" cách nhau bằng space
EXECUTOR="$2"   # Kiểu thực thi (su, adb, direct)
PROJECT_DIR="$3" # Thư mục dự án
TMP_DIR="${PROJECT_DIR}/tmp"
mkdir -p "$TMP_DIR"

run_cmd() {
    case "$EXECUTOR" in
        su)     su -c "$1" ;;
        adb)    adb shell "$1" ;;
        *)      eval "$1" ;;
    esac
}

echo -e "${BGRN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║       WATCHDOG - GIÁM SÁT TẤT CẢ BOT        ║${NC}"
echo -e "${BGRN}║   Kiểm tra mỗi 15s, tự restart bot chết     ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════╝${NC}"
echo ""

while true; do
    TS=$(date '+%H:%M:%S')
    echo -e "${CYN}[$TS]${NC} Đang cập nhật status cache & kiểm tra ${YLW}$(echo $ALL_CFGS | wc -w)${NC} bot..."

    # 1. Cập nhật dumpsys dùng chung cho các bot (giảm tải tối đa cho CPU)
    run_cmd "dumpsys activity activities" > "${TMP_DIR}/roblox_activities.tmp" 2>/dev/null
    if [ -s "${TMP_DIR}/roblox_activities.tmp" ]; then
        mv "${TMP_DIR}/roblox_activities.tmp" "${TMP_DIR}/roblox_activities.txt"
    fi

    run_cmd "dumpsys window windows" > "${TMP_DIR}/roblox_windows.tmp" 2>/dev/null
    if [ -s "${TMP_DIR}/roblox_windows.tmp" ]; then
        mv "${TMP_DIR}/roblox_windows.tmp" "${TMP_DIR}/roblox_windows.txt"
    fi

    # 2. Kiểm tra sống chết của từng bot
    for ENTRY in $ALL_CFGS; do
        CFG=$(echo "$ENTRY" | cut -d: -f1)
        PKG=$(echo "$ENTRY" | cut -d: -f2)
        LOG=$(echo "$ENTRY" | cut -d: -f3)
        WIN="${PKG//./_}"

        # Kiểm tra tmux window của acc này có còn chạy bot không
        # Dấu hiệu: pane của window không có tiến trình bash/auto_rejoin
        WIN_PANE=$(tmux list-panes -t "roblox-multi:${WIN}" -F "#{pane_current_command}" 2>/dev/null)

        bot_running=false
        if [ -n "$WIN_PANE" ]; then
            pid=""
            [ -f "${TMP_DIR}/roblox_bot_${WIN}.pid" ] && pid=$(cat "${TMP_DIR}/roblox_bot_${WIN}.pid" 2>/dev/null)
            if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
                bot_running=true
            fi
        fi

        if [ "$bot_running" = "false" ]; then
            echo -e "  ${RED}[WATCHDOG]${NC} Bot '${WIN}' không chạy! Đang khởi động lại..."
            if [ -z "$WIN_PANE" ]; then
                tmux new-window -t roblox-multi -n "$WIN" 2>/dev/null
                tmux set-window-option -t "roblox-multi:${WIN}" automatic-rename off 2>/dev/null
                tmux set-window-option -t "roblox-multi:${WIN}" remain-on-exit on 2>/dev/null
            fi
            tmux respawn-pane -k -t "roblox-multi:${WIN}" -c "$PROJECT_DIR" \
                "CONFIG_FILE=\"$CFG\" LOG_FILE=\"$LOG\" STATS_FILE=\"roblox_stats_${PKG}.dat\" bash auto_rejoin.sh --run" 2>/dev/null
            echo -e "  ${GRN}[WATCHDOG]${NC} Đã restart bot cho: ${CYN}$PKG${NC}"
        else
            echo -e "  ${GRN}  ✓${NC} $PKG → ${GRN}OK${NC}"
        fi
    done

    echo ""
    sleep 15
done
WDEOF
chmod +x "${TMP_DIR}/watchdog_roblox.sh"

tmux send-keys -t "roblox-multi:WATCHDOG" \
    "bash \"${TMP_DIR}/watchdog_roblox.sh\" '${ALL_CFGS_LINE}' '${EXECUTOR_TYPE}' '${PWD}'" C-m 2>/dev/null

printf "${BGRN}║${NC}  ${BGRN}✓${NC} ${YLW}WATCHDOG${NC}: Giám sát toàn bộ ${YLW}$((COUNT-1))${NC} acc          ${BGRN}║${NC}\n"


echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

# Beep thành công
printf '\a'

echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║   ✅  THIẾT LẬP HOÀN TẤT THÀNH CÔNG!            ║${NC}"
echo -e "${BGRN}╠══════════════════════════════════════════════════╣${NC}"
printf  "${BGRN}║${NC}  ${BGRN}✓${NC} Đã khởi động ${YLW}%-3s${NC} tài khoản đang chạy ngầm  ${BGRN}║${NC}\n" "$((COUNT-1))"
echo -e "${BGRN}╠══════════════════════════════════════════════════╣${NC}"
echo -e "${BGRN}║${NC}  ${WHT}Xem tab tmux:${NC}  ${YLW}tmux attach -t roblox-multi${NC}      ${BGRN}║${NC}"
echo -e "${BGRN}║${NC}  ${WHT}Mở menu:${NC}       ${YLW}bash auto_rejoin.sh${NC}               ${BGRN}║${NC}"
echo -e "${BGRN}║${NC}  ${WHT}Thoát tmux:${NC}    ${YLW}Ctrl+B rồi D${NC}                      ${BGRN}║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$AUTO_REJOIN_PARENT" != "true" ]; then
    echo -ne "${WHT}Mở Menu điều khiển ngay? (y/N): ${NC}"
    read -r run_now
    if [ "$run_now" = "y" ] || [ "$run_now" = "Y" ]; then
        bash auto_rejoin.sh
    fi
fi
