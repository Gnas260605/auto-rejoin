#!/bin/bash
# ╔══════════════════════════════════════════════════════╗
# ║      ROBLOX AUTO REJOIN - SETUP SCRIPT v3.1         ║
# ║      Cách dùng: bash setup.sh [PlaceID] [Code]      ║
# ╚══════════════════════════════════════════════════════╝

BGRN='\033[1;32m'
GRN='\033[0;32m'
RED='\033[0;31m'
YLW='\033[0;33m'
CYN='\033[0;36m'
WHT='\033[1;37m'
NC='\033[0m'

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

# ── BƯỚC 1: Cập nhật hệ thống ───────────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 1/5] Cập nhật hệ thống Termux            ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
for i in 1 2 3 4 5; do
    progress_bar $i 5 "Đang cập nhật..."
    sleep 0.2
done
pkg update -y -o Dpkg::Options::="--force-confold" > /dev/null 2>&1
pkg upgrade -y -o Dpkg::Options::="--force-confold" > /dev/null 2>&1
echo -e "  ${BGRN}✓ Hoàn tất cập nhật hệ thống${NC}"
echo ""

# ── BƯỚC 2: Cài đặt gói ─────────────────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 2/5] Cài đặt công cụ cần thiết           ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
PKGS=("tmux" "curl" "tsu" "procps" "android-tools")
total_p=${#PKGS[@]}
for idx in "${!PKGS[@]}"; do
    progress_bar $((idx+1)) $total_p "Cài ${PKGS[$idx]}..."
    pkg install -y "${PKGS[$idx]}" > /dev/null 2>&1
done
echo -e "  ${BGRN}✓ Hoàn tất cài đặt gói${NC}"
echo ""

# ── BƯỚC 3: Tải script mới nhất ─────────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 3/5] Tải script auto_rejoin.sh           ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
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
chmod +x auto_rejoin.sh setup.sh
echo ""

# ── BƯỚC 4: Phát hiện executor ──────────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 4/5] Phát hiện phương thức hệ thống      ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
progress_bar 1 3 "Kiểm tra Root (su)..."
sleep 0.3
EXECUTOR_TYPE="direct"
if command -v su > /dev/null 2>&1 && su -c "id" > /dev/null 2>&1; then
    EXECUTOR_TYPE="su"
    progress_bar 3 3 "Đã phát hiện!"
    echo -e "  ${BGRN}✓ Đã phát hiện quyền Root (su)${NC}"
else
    progress_bar 2 3 "Kiểm tra ADB..."
    sleep 0.3
    if command -v adb > /dev/null 2>&1 && adb shell "id" > /dev/null 2>&1; then
        EXECUTOR_TYPE="adb"
        progress_bar 3 3 "Đã phát hiện!"
        echo -e "  ${BGRN}✓ Đã phát hiện ADB shell${NC}"
    else
        progress_bar 3 3 "Chế độ direct"
        echo -e "  ${YLW}⚠ Không có root/adb, chạy chế độ direct (hạn chế)${NC}"
    fi
fi
echo ""

# ── BƯỚC 5: Quét clone & Khởi động ──────────────────────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║  [BƯỚC 5/5] Quét Roblox clone & Khởi động       ║${NC}"
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

# ── Hỏi username cho từng acc TRƯỚC khi khởi động ──────
echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║   NHẬP USERNAME ROBLOX CHO TỪNG TÀI KHOẢN       ║${NC}"
echo -e "${BGRN}║   (Bấm Enter để bỏ qua nếu chưa biết)           ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════════╝${NC}"
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
        echo -ne "  ${YLW}[$idx]${NC} Acc ${CYN}$SHORT_PKG${NC} (hiện tại: ${GRN}$OLD_UNAME${NC}): "
    else
        echo -ne "  ${YLW}[$idx]${NC} Acc ${CYN}$SHORT_PKG${NC} username: "
    fi

    read -r INPUT_UNAME
    INPUT_UNAME="${INPUT_UNAME//$'\r'/}"
    INPUT_UNAME="${INPUT_UNAME// /}"

    if [ -n "$INPUT_UNAME" ]; then
        USERNAME_MAP["$PKG"]="$INPUT_UNAME"
    elif [ -n "$OLD_UNAME" ]; then
        USERNAME_MAP["$PKG"]="$OLD_UNAME"   # Giữ username cũ
    else
        USERNAME_MAP["$PKG"]=""
    fi
    idx=$((idx+1))
done
echo ""

echo -e "${BGRN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║       KHỞI ĐỘNG BOT CHO TỪNG TÀI KHOẢN         ║${NC}"
echo -e "${BGRN}╠══════════════════════════════════════════════════╣${NC}"

for PKG in $PACKAGES; do
    CFG="config_${PKG}.cfg"
    LOG="roblox_${PKG}.log"
    WIN="${PKG//./_}"
    SAVED_USERNAME="${USERNAME_MAP[$PKG]:-}"

    cat > "$CFG" <<EOF
PLACE_ID="$PLACE_ID"
PRIVATE_CODE="$PRIVATE_CODE"
ROBLOX_PACKAGE="$PKG"
CHECK_INTERVAL=30
AUTO_RESTART_PERIOD=7200
ANTI_AFK=true
AFK_TAP_INTERVAL=180
TAP_X=540
TAP_Y=960
DISCORD_WEBHOOK=""
ROBLOX_USERNAME="${SAVED_USERNAME}"
EOF

    progress_bar $COUNT $TOTAL "Khởi động acc $COUNT/$TOTAL..."

    if [ $COUNT -eq 1 ]; then
        tmux new-session -d -s roblox-multi -n "$WIN" 2>/dev/null
    else
        tmux new-window -t roblox-multi -n "$WIN" 2>/dev/null
    fi
    tmux send-keys -t "roblox-multi:${WIN}" \
        "CONFIG_FILE=\"$CFG\" LOG_FILE=\"$LOG\" STATS_FILE=\"roblox_stats.dat\" bash auto_rejoin.sh --run" C-m 2>/dev/null

    UNAME_DISPLAY="${SAVED_USERNAME:-N/A}"
    printf "${BGRN}║${NC}  ${BGRN}✓${NC} Acc ${YLW}%2d${NC}: ${CYN}%-28s${NC} ${GRN}%-12s${NC}${BGRN}║${NC}\n" \
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
cat > /tmp/watchdog_roblox.sh << 'WDEOF'
#!/bin/bash
BGRN='\033[1;32m'; GRN='\033[0;32m'; RED='\033[0;31m'; YLW='\033[0;33m'; CYN='\033[0;36m'; NC='\033[0m'
ALL_CFGS="$1"   # Danh sách "cfg:pkg:log" cách nhau bằng space

echo -e "${BGRN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BGRN}║       WATCHDOG - GIÁM SÁT TẤT CẢ BOT        ║${NC}"
echo -e "${BGRN}║   Kiểm tra mỗi 30s, tự restart bot chết     ║${NC}"
echo -e "${BGRN}╚══════════════════════════════════════════════╝${NC}"
echo ""

while true; do
    TS=$(date '+%H:%M:%S')
    echo -e "${CYN}[$TS]${NC} Đang kiểm tra ${YLW}$(echo $ALL_CFGS | wc -w)${NC} bot..."

    for ENTRY in $ALL_CFGS; do
        CFG=$(echo "$ENTRY" | cut -d: -f1)
        PKG=$(echo "$ENTRY" | cut -d: -f2)
        LOG=$(echo "$ENTRY" | cut -d: -f3)
        WIN="${PKG//./_}"

        # Kiểm tra tmux window của acc này có còn chạy bot không
        # Dấu hiệu: pane của window không có tiến trình bash/auto_rejoin
        WIN_PANE=$(tmux list-panes -t "roblox-multi:${WIN}" -F "#{pane_current_command}" 2>/dev/null)

        if [ -z "$WIN_PANE" ] || [ "$WIN_PANE" = "bash" ] && ! tmux list-panes -t "roblox-multi:${WIN}" -F "#{pane_pid}" 2>/dev/null | xargs ps -p > /dev/null 2>&1; then
            # Window không tồn tại → tạo lại
            echo -e "  ${RED}[WATCHDOG]${NC} Window '${WIN}' đã chết! Đang khởi động lại..."
            tmux new-window -t roblox-multi -n "$WIN" 2>/dev/null
            tmux send-keys -t "roblox-multi:${WIN}" \
                "CONFIG_FILE=\"$CFG\" LOG_FILE=\"$LOG\" STATS_FILE=\"roblox_stats.dat\" bash auto_rejoin.sh --run" C-m 2>/dev/null
            echo -e "  ${GRN}[WATCHDOG]${NC} Đã restart bot cho: ${CYN}$PKG${NC}"
        else
            # Kiểm tra pane có còn chạy script không (không phải shell rảnh)
            PANE_CMD=$(tmux list-panes -t "roblox-multi:${WIN}" -F "#{pane_current_command}" 2>/dev/null | head -1)
            if [ "$PANE_CMD" = "bash" ] || [ -z "$PANE_CMD" ]; then
                # Pane có shell nhưng script đã thoát → restart
                echo -e "  ${YLW}[WATCHDOG]${NC} Bot '${WIN}' đã thoát. Đang restart..."
                tmux send-keys -t "roblox-multi:${WIN}" \
                    "CONFIG_FILE=\"$CFG\" LOG_FILE=\"$LOG\" STATS_FILE=\"roblox_stats.dat\" bash auto_rejoin.sh --run" C-m 2>/dev/null
                echo -e "  ${GRN}[WATCHDOG]${NC} Đã restart: ${CYN}$PKG${NC}"
            else
                echo -e "  ${GRN}  ✓${NC} $PKG → ${GRN}OK${NC}"
            fi
        fi
    done

    echo ""
    sleep 30
done
WDEOF
chmod +x /tmp/watchdog_roblox.sh

tmux send-keys -t "roblox-multi:WATCHDOG" \
    "bash /tmp/watchdog_roblox.sh '${ALL_CFGS_LINE}'" C-m 2>/dev/null

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

echo -ne "${WHT}Mở Menu điều khiển ngay? (y/N): ${NC}"
read -r run_now
if [ "$run_now" = "y" ] || [ "$run_now" = "Y" ]; then
    bash auto_rejoin.sh
fi
