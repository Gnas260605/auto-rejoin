#!/bin/bash

# Đường dẫn file cấu hình (cho phép ghi đè qua biến môi trường để chạy multi-acc)
CONFIG_FILE="${CONFIG_FILE:-config.cfg}"
LOG_FILE="${LOG_FILE:-roblox_bot.log}"

# Màu sắc hiển thị CLI
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0;m' # No Color

# Hàm ghi Log
log_msg() {
    local msg="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${CYAN}[$timestamp]${NC} $msg"
    echo "[$timestamp] $msg" >> "$LOG_FILE"
}

# Hàm gửi Discord Webhook
send_discord() {
    local message="$1"
    if [ -n "$DISCORD_WEBHOOK" ]; then
        curl -H "Content-Type: application/json" \
             -X POST \
             -d "{\"content\": \"$message\"}" \
             "$DISCORD_WEBHOOK" >/dev/null 2>&1
    fi
}

# Tải cấu hình
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
        # Dự phòng nếu file cấu hình cũ chưa có ROBLOX_PACKAGE
        if [ -z "$ROBLOX_PACKAGE" ]; then
            ROBLOX_PACKAGE="com.roblox.client"
        fi
    else
        # Cấu hình mặc định
        PLACE_ID="2753915549"
        PRIVATE_CODE=""
        ROBLOX_PACKAGE="com.roblox.client"
        CHECK_INTERVAL=30
        AUTO_RESTART_PERIOD=7200
        ANTI_AFK=true
        AFK_TAP_INTERVAL=180
        TAP_X=500
        TAP_Y=500
        DISCORD_WEBHOOK=""
        save_config
    fi
}

# Lưu cấu hình
save_config() {
    cat <<EOF > "$CONFIG_FILE"
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

# Tự động phát hiện phương thức thực thi lệnh (su, adb hoặc direct)
detect_executor() {
    if command -v su >/dev/null 2>&1 && su -c "id" >/dev/null 2>&1; then
        echo "su -c"
    elif command -v adb >/dev/null 2>&1 && adb shell "id" >/dev/null 2>&1; then
        echo "adb shell"
    else
        echo "direct"
    fi
}

EXECUTOR=$(detect_executor)

run_cmd() {
    local cmd="$1"
    if [ "$EXECUTOR" = "su -c" ]; then
        su -c "$cmd"
    elif [ "$EXECUTOR" = "adb shell" ]; then
        adb shell "$cmd"
    else
        eval "$cmd"
    fi
}

# Hàm mở game Roblox
launch_roblox() {
    log_msg "${YELLOW}[*] Đang khởi động ứng dụng Roblox ($ROBLOX_PACKAGE)...${NC}"
    if [ -n "$PRIVATE_CODE" ]; then
        log_msg "[*] Vào Server riêng (Private Code: $PRIVATE_CODE)"
        # Một số Cloner sử dụng intent filter trực tiếp của package clone
        run_cmd "am start -p $ROBLOX_PACKAGE -a android.intent.action.VIEW -d \"roblox://navigation/share_links?code=${PRIVATE_CODE}&type=Server\""
        send_discord "🎮 **Roblox Auto Rejoin ($ROBLOX_PACKAGE):** Đang kết nối vào Server riêng mã \`$PRIVATE_CODE\`."
    else
        log_msg "[*] Vào Server thường (PlaceID: $PLACE_ID)"
        run_cmd "am start -p $ROBLOX_PACKAGE -a android.intent.action.VIEW -d \"roblox://experiences/start?placeId=${PLACE_ID}\""
        send_discord "🎮 **Roblox Auto Rejoin ($ROBLOX_PACKAGE):** Đang kết nối vào PlaceID: \`$PLACE_ID\`."
    fi
    LAST_RESTART=$(date +%s)
    LAST_AFK_TAP=$(date +%s)
}

# Kiểm tra xem Roblox có đang hoạt động ở màn hình trước không
is_roblox_in_foreground() {
    local focus_info
    focus_info=$(run_cmd "dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'")
    if echo "$focus_info" | grep -q "$ROBLOX_PACKAGE"; then
        return 0
    else
        return 1
    fi
}

# Hàm chạy tiến trình Auto Rejoin
start_bot() {
    load_config
    clear
    echo -e "${GREEN}====================================================${NC}"
    echo -e "${GREEN}        ROBLOX AUTO REJOIN BOT ĐANG HOẠT ĐỘNG         ${NC}"
    echo -e "${GREEN}====================================================${NC}"
    echo -e "${CYAN}Package Name: ${NC}$ROBLOX_PACKAGE"
    echo -e "${CYAN}Chế độ: ${NC}PlaceID: $PLACE_ID / Private: $PRIVATE_CODE"
    echo -e "${CYAN}Phương thức: ${NC}$EXECUTOR"
    echo -e "${CYAN}Anti-AFK: ${NC}$ANTI_AFK (Mỗi $AFK_TAP_INTERVAL giây tại tọa độ X:$TAP_X Y:$TAP_Y)"
    echo -e "${CYAN}Thời gian Check: ${NC}$CHECK_INTERVAL giây"
    echo -e "${CYAN}Log File: ${NC}$LOG_FILE"
    echo -e "${GREEN}====================================================${NC}"
    log_msg "[+] Bắt đầu giám sát Roblox..."
    
    # Khởi động game lần đầu
    launch_roblox

    while true; do
        sleep $CHECK_INTERVAL
        
        # 1. Kiểm tra sự cố crash hoặc tắt app
        if ! is_roblox_in_foreground; then
            log_msg "${RED}[!] Cảnh báo: Phát hiện Roblox ($ROBLOX_PACKAGE) bị crash hoặc tắt ngầm!${NC}"
            send_discord "⚠️ **Roblox Auto Rejoin ($ROBLOX_PACKAGE):** Phát hiện game bị crash/tắt! Đang khởi động lại..."
            run_cmd "am force-stop $ROBLOX_PACKAGE"
            sleep 3
            launch_roblox
            continue
        fi

        # 2. Xử lý click Anti-AFK chống bị kick treo máy
        if [ "$ANTI_AFK" = true ]; then
            NOW=$(date +%s)
            ELAPSED_AFK=$((NOW - LAST_AFK_TAP))
            if [ "$ELAPSED_AFK" -ge "$AFK_TAP_INTERVAL" ]; then
                log_msg "[*] Đang gửi click Anti-AFK giả lập chạm màn hình tại tọa độ ($TAP_X, $TAP_Y)..."
                run_cmd "input tap $TAP_X $TAP_Y"
                LAST_AFK_TAP=$NOW
            fi
        fi

        # 3. Tự động Restart tối ưu RAM định kỳ
        if [ "$AUTO_RESTART_PERIOD" -gt 0 ]; then
            NOW=$(date +%s)
            ELAPSED_RESTART=$((NOW - LAST_RESTART))
            if [ "$ELAPSED_RESTART" -ge "$AUTO_RESTART_PERIOD" ]; then
                log_msg "${YELLOW}[*] Khởi động lại định kỳ ($AUTO_RESTART_PERIOD giây) để tránh giật lag...${NC}"
                send_discord "🔄 **Roblox Auto Rejoin ($ROBLOX_PACKAGE):** Tự động khởi động lại định kỳ để làm mới bộ nhớ."
                run_cmd "am force-stop $ROBLOX_PACKAGE"
                sleep 3
                launch_roblox
            fi
        fi
    done
}

# Giao diện MENU điều khiển
menu() {
    load_config
    while true; do
        clear
        echo -e "${CYAN}====================================================${NC}"
        echo -e "${CYAN}       HỆ THỐNG ĐIỀU KHIỂN ROBLOX AUTO REJOIN       ${NC}"
        echo -e "${CYAN}====================================================${NC}"
        echo -e " 1. ${GREEN}KHỞI CHẠY BOT (START)${NC}"
        echo -e " 2. Cài đặt Place ID Game ${YELLOW}(Hiện tại: $PLACE_ID)${NC}"
        echo -e " 3. Cài đặt Code Server riêng (Private Server) ${YELLOW}(Hiện tại: $PRIVATE_CODE)${NC}"
        echo -e " 4. Cấu hình Package Name Roblox ${YELLOW}(Hiện tại: $ROBLOX_PACKAGE)${NC}"
        echo -e " 5. Cài đặt Discord Webhook ${YELLOW}(Hiện tại: $DISCORD_WEBHOOK)${NC}"
        echo -e " 6. Bật/Tắt Anti-AFK Tapping ${YELLOW}(Hiện tại: $ANTI_AFK)${NC}"
        echo -e " 7. Thay đổi tọa độ Anti-AFK ${YELLOW}(Hiện tại: X:$TAP_X, Y:$TAP_Y)${NC}"
        echo -e " 8. Đổi chu kỳ kiểm tra & Restart ${YELLOW}(Check: ${CHECK_INTERVAL}s, Restart: ${AUTO_RESTART_PERIOD}s)${NC}"
        echo -e " 9. Xem nhật ký hoạt động (Xem Log)"
        echo -e " 10. Thoát"
        echo -e "${CYAN}====================================================${NC}"
        echo -n "Chọn chức năng (1-10): "
        read opt
        
        case $opt in
            1)
                start_bot
                ;;
            2)
                echo -n "Nhập Place ID Game mới: "
                read PLACE_ID
                save_config
                ;;
            3)
                echo -n "Nhập Code Private Server mới (Để trống nếu không dùng): "
                read PRIVATE_CODE
                save_config
                ;;
            4)
                echo -e "Chọn hoặc nhập Package Name của bản Roblox clone:"
                echo "Gốc mặc định: com.roblox.client"
                echo -n "Nhập Package Name tùy chỉnh: "
                read ROBLOX_PACKAGE
                save_config
                ;;
            5)
                echo -n "Nhập Discord Webhook Link (Để trống nếu bỏ qua): "
                read DISCORD_WEBHOOK
                save_config
                ;;
            6)
                if [ "$ANTI_AFK" = true ]; then
                    ANTI_AFK=false
                else
                    ANTI_AFK=true
                fi
                save_config
                ;;
            7)
                echo -n "Nhập tọa độ X: "
                read TAP_X
                echo -n "Nhập tọa độ Y: "
                read TAP_Y
                save_config
                ;;
            8)
                echo -n "Nhập thời gian kiểm tra trạng thái game (giây): "
                read CHECK_INTERVAL
                echo -n "Nhập thời gian tự động Restart để giảm giật (giây, 0 để tắt): "
                read AUTO_RESTART_PERIOD
                save_config
                ;;
            9)
                clear
                echo "---- NHẬT KÝ HOẠT ĐỘNG (Bấm q để thoát xem) ----"
                tail -n 50 "$LOG_FILE" 2>/dev/null || echo "Chưa có log phát sinh."
                echo "Nhấn Enter để tiếp tục..."
                read
                ;;
            10)
                exit 0
                ;;
            *)
                echo -e "${RED}Lựa chọn không hợp lệ!${NC}"
                sleep 1
                ;;
        esac
    done
}

# Chạy menu chính
menu

