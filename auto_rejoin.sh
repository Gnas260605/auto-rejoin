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

# Kiểm tra xem thiết bị có kết nối Internet không
check_internet() {
    # Thử ping tới Cloudflare DNS trong 2 giây
    if ping -c 1 -W 2 1.1.1.1 >/dev/null 2>&1; then
        return 0 # Có mạng
    else
        return 1 # Mất mạng
    fi
}

# Kiểm tra xem tiến trình Roblox có đang chạy (tiền cảnh hoặc chạy ngầm) hay không
is_roblox_running() {
    local ps_info
    ps_info=$(run_cmd "ps -A")
    # Nếu không hỗ trợ ps -A, thử ps thường
    if [ -z "$ps_info" ]; then
        ps_info=$(run_cmd "ps")
    fi
    
    if echo "$ps_info" | grep -q "$ROBLOX_PACKAGE"; then
        return 0 # Roblox vẫn đang chạy
    else
        return 1 # Roblox đã bị tắt hoàn toàn
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
        
        # 0. Kiểm tra kết nối mạng (Tránh spam mở game khi mất mạng)
        if ! check_internet; then
            log_msg "${RED}[!] Phát hiện mất kết nối Internet! Đang tạm dừng kiểm tra và chờ mạng...${NC}"
            send_discord "⚠️ **Roblox Auto Rejoin ($ROBLOX_PACKAGE):** Thiết bị mất kết nối mạng! Tạm dừng chờ mạng hồi phục..."
            
            while ! check_internet; do
                sleep 10
            done
            
            log_msg "${GREEN}[+] Đã có mạng trở lại! Tiến hành dọn dẹp và khởi động lại game...${NC}"
            send_discord "📶 **Roblox Auto Rejoin ($ROBLOX_PACKAGE):** Đã kết nối lại Internet! Đang vào lại game..."
            run_cmd "am force-stop $ROBLOX_PACKAGE"
            sleep 3
            launch_roblox
            continue
        fi

        # 1. Kiểm tra sự cố crash hoặc tắt app
        if ! is_roblox_running; then
            log_msg "${RED}[!] Cảnh báo: Phát hiện Roblox ($ROBLOX_PACKAGE) đã bị tắt hoặc crash!${NC}"
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

# Bảng theo dõi trạng thái trực quan các bản Clone
show_status_monitor() {
    clear
    echo -e "${CYAN}====================================================${NC}"
    echo -e "${GREEN}       BẢNG GIÁM SÁT TRẠNG THÁI ROBLOX CLONES       ${NC}"
    echo -e "${CYAN}====================================================${NC}"
    
    local config_files=$(ls config_com*.cfg 2>/dev/null)
    if [ -z "$config_files" ]; then
        config_files="config.cfg"
    fi
    
    local ps_info
    ps_info=$(run_cmd "ps -A")
    if [ -z "$ps_info" ]; then
        ps_info=$(run_cmd "ps")
    fi
    
    for cfg in $config_files; do
        if [ -f "$cfg" ]; then
            local tmp_pkg=""
            local tmp_place=""
            source "$cfg" >/dev/null 2>&1
            tmp_pkg="$ROBLOX_PACKAGE"
            tmp_place="$PLACE_ID"
            
            if [ -z "$tmp_pkg" ]; then
                continue
            fi
            
            local window_name="${tmp_pkg//./_}"
            local is_in_tmux="${RED}🔴 Tắt${NC}"
            if tmux list-windows -t roblox-multi 2>/dev/null | grep -q "$window_name"; then
                is_in_tmux="${GREEN}🟢 Chạy ngầm (tmux)${NC}"
            fi
            
            local run_status="${RED}[🔴 OFFLINE - Game đã đóng]${NC}"
            if echo "$ps_info" | grep -q "$tmp_pkg"; then
                run_status="${GREEN}[🟢 ONLINE - Đang mở]${NC}"
            fi
            
            local log_file="roblox_${tmp_pkg}.log"
            local last_log="Chưa có lịch sử hoạt động"
            if [ -f "$log_file" ]; then
                last_log=$(tail -n 1 "$log_file" 2>/dev/null | cut -c 1-60)
            fi
            
            echo -e "👉 Bản Clone: ${YELLOW}${window_name}${NC}"
            echo -e "   Trạng thái App: $run_status"
            echo -e "   Trình giám sát: $is_in_tmux"
            echo -e "   Log cuối: ${CYAN}${last_log}${NC}"
            echo -e "----------------------------------------------------"
        fi
    done
    echo ""
    echo -e "Bấm phím bất kỳ để ${YELLOW}TẢI LẠI TRẠNG THÁI${NC}, hoặc gõ '${RED}q${NC}' để quay lại Menu."
    read -n 1 -r key
    if [ "$key" != "q" ] && [ "$key" != "Q" ]; then
        show_status_monitor
    fi
}

# Giao diện MENU điều khiển rút gọn chống lỗi tràn dòng
menu() {
    load_config
    while true; do
        clear
        echo -e "${CYAN}==========================================${NC}"
        echo -e "${GREEN}      ROBLOX AUTO REJOIN CONTROL PANEL    ${NC}"
        echo -e "${CYAN}==========================================${NC}"
        echo -e " 1. ${GREEN}Xem trạng thái các bản Clone (MONITOR)${NC}"
        echo -e " 2. Khởi động lại tất cả Acc (Restart All)"
        echo -e " 3. ${RED}Dừng tất cả Acc chạy ngầm (Stop All)${NC}"
        echo -e " 4. Xem Log chi tiết của từng Acc"
        echo -e " 5. Đổi Place ID Game ${YELLOW}(Hiện tại: $PLACE_ID)${NC}"
        echo -e " 6. Đổi Code Server riêng ${YELLOW}(Hiện tại: $PRIVATE_CODE)${NC}"
        echo -e " 7. Thoát"
        echo -e "${CYAN}==========================================${NC}"
        echo -n "Chọn (1-7): "
        read opt
        
        case $opt in
            1)
                show_status_monitor
                ;;
            2)
                echo "[*] Đang khởi động lại toàn bộ bot..."
                ./setup.sh "$PLACE_ID" "$PRIVATE_CODE"
                sleep 2
                ;;
            3)
                echo -e "${RED}[*] Đang dừng tất cả tiến trình chạy ngầm...${NC}"
                tmux kill-session -t roblox-multi 2>/dev/null
                # Force close tất cả app roblox
                local config_files=$(ls config_com*.cfg 2>/dev/null)
                for cfg in $config_files; do
                    if [ -f "$cfg" ]; then
                        local tmp_pkg=""
                        source "$cfg" >/dev/null 2>&1
                        if [ -n "$ROBLOX_PACKAGE" ]; then
                            run_cmd "am force-stop $ROBLOX_PACKAGE"
                        fi
                    fi
                done
                echo "Đã dừng và tắt tất cả game."
                sleep 2
                ;;
            4)
                clear
                echo "---- CÁC FILE LOG HIỆN CÓ ----"
                ls roblox_*.log 2>/dev/null || echo "Không tìm thấy file log nào."
                echo -n "Nhập tên file log muốn xem (Ví dụ: roblox_com.roblox.client1.log): "
                read log_select
                if [ -f "$log_select" ]; then
                    clear
                    echo "---- LỊCH SỬ HOẠT ĐỘNG: $log_select (Bấm q để thoát) ----"
                    tail -n 50 "$log_select"
                    echo "Nhấn Enter để quay lại..."
                    read
                else
                    echo "File log không tồn tại!"
                    sleep 1.5
                fi
                ;;
            5)
                echo -n "Nhập Place ID Game mới: "
                read PLACE_ID
                save_config
                ;;
            6)
                echo -n "Nhập Code Private Server mới: "
                read PRIVATE_CODE
                save_config
                ;;
            7)
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

