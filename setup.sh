#!/bin/bash

# Màu sắc CLI
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0;m' # No Color

clear
echo -e "${CYAN}====================================================${NC}"
echo -e "${GREEN}    TRÌNH CÀI ĐẶT TỰ ĐỘNG ROBLOX MULTI-CLONE BOT     ${NC}"
echo -e "${CYAN}====================================================${NC}"

# Nhận đối số từ dòng lệnh (Place ID và Private Code)
PLACE_ID="${1:-2753915549}" # Mặc định là Blox Fruits nếu không nhập
PRIVATE_CODE="$2"            # Không nhập thì mặc định chơi server thường

echo -e "[*] Place ID được thiết lập: ${YELLOW}$PLACE_ID${NC}"
if [ -n "$PRIVATE_CODE" ]; then
    echo -e "[*] Mã Server riêng được thiết lập: ${YELLOW}$PRIVATE_CODE${NC}"
else
    echo -e "[*] Chế độ: ${YELLOW}Server thường (Public)${NC}"
fi

echo -e "[*] Đang cập nhật gói hệ thống Termux..."
pkg update -y && pkg upgrade -y -o Dpkg::Options::="--force-confold"

echo -e "[*] Đang cài đặt các công cụ cần thiết (tmux, curl, tsu, procps, android-tools)..."
pkg install tmux curl tsu procps android-tools -y

# Tải hoặc cập nhật bản mới nhất của file script auto_rejoin.sh từ GitHub
echo -e "[*] Đang tải/cập nhật file script auto_rejoin.sh..."
rm -f auto_rejoin.sh
curl -o auto_rejoin.sh -L "https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/auto_rejoin.sh" 2>/dev/null
chmod +x auto_rejoin.sh

# Phát hiện phương thức thực thi lệnh (Root hoặc ADB)
detect_system_executor() {
    if command -v su >/dev/null 2>&1 && su -c "id" >/dev/null 2>&1; then
        echo "su -c"
    elif command -v adb >/dev/null 2>&1 && adb shell "id" >/dev/null 2>&1; then
        echo "adb shell"
    else
        echo "direct"
    fi
}
SYS_EXECUTOR=$(detect_system_executor)
echo -e "[*] Phương thức hệ thống: ${YELLOW}$SYS_EXECUTOR${NC}"

# Quét tất cả các bản Roblox clone đã được cài đặt trên thiết bị
echo -e "[*] Đang quét các phiên bản Roblox đã cài đặt..."
packages=""
if [ "$SYS_EXECUTOR" = "su -c" ]; then
    packages=$(su -c "pm list packages" 2>/dev/null | grep -i "roblox" | cut -d ':' -f 2 | tr -d '\r')
elif [ "$SYS_EXECUTOR" = "adb shell" ]; then
    packages=$(adb shell "pm list packages" 2>/dev/null | grep -i "roblox" | cut -d ':' -f 2 | tr -d '\r')
else
    packages=$(pm list packages 2>/dev/null | grep -i "roblox" | cut -d ':' -f 2 | tr -d '\r')
fi

# Nếu không quét được, sử dụng gói mặc định của Roblox
if [ -z "$packages" ]; then
    echo -e "${YELLOW}[!] Không tìm thấy bản clone nào đang mở hoặc chưa cấp quyền. Sử dụng gói mặc định com.roblox.client${NC}"
    packages="com.roblox.client"
else
    echo -e "${GREEN}[+] Đã tìm thấy các gói Roblox sau:${NC}"
    echo "$packages"
fi

# Dọn dẹp phiên tmux cũ nếu có
tmux kill-session -t roblox-multi 2>/dev/null

count=1
for pkg in $packages; do
    cfg_file="config_${pkg}.cfg"
    log_file="roblox_${pkg}.log"
    
    # Thay thế dấu chấm bằng dấu gạch dưới để tránh lỗi phân tách window.pane của tmux
    window_name="${pkg//./_}"
    
    # Tạo file cấu hình riêng cho từng package
    cat <<EOF > "$cfg_file"
PLACE_ID="$PLACE_ID"
PRIVATE_CODE="$PRIVATE_CODE"
ROBLOX_PACKAGE="$pkg"
CHECK_INTERVAL=30
AUTO_RESTART_PERIOD=7200
ANTI_AFK=true
AFK_TAP_INTERVAL=180
TAP_X=500
TAP_Y=500
DISCORD_WEBHOOK=""
EOF

    # Đưa lệnh chạy bot vào các window riêng trong tmux
    if [ $count -eq 1 ]; then
        # Khởi tạo tmux session mới với window đầu tiên đặt theo tên package
        tmux new-session -d -s roblox-multi -n "$window_name"
        tmux send-keys -t roblox-multi:"$window_name" "CONFIG_FILE=\"$cfg_file\" LOG_FILE=\"$log_file\" ./auto_rejoin.sh --run" C-m
    else
        # Tạo thêm window mới cho các package tiếp theo
        tmux new-window -t roblox-multi -n "$window_name"
        tmux send-keys -t roblox-multi:"$window_name" "CONFIG_FILE=\"$cfg_file\" LOG_FILE=\"$log_file\" ./auto_rejoin.sh --run" C-m
    fi
    
    echo -e "${GREEN}[+] Đang chạy ngầm tài khoản cho: $pkg${NC}"
    count=$((count + 1))
done

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}         TỰ ĐỘNG THIẾT LẬP VÀ KHỞI CHẠY THÀNH CÔNG!  ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Tất cả các bản Roblox clone đang được giám sát ngầm."
echo -e "👉 Để xem giao diện theo dõi, hãy gõ lệnh: ${YELLOW}tmux a${NC}"
echo -e "👉 Để thoát giao diện theo dõi mà vẫn chạy ngầm: Nhấn ${YELLOW}Ctrl + B${NC} rồi bấm tiếp ${YELLOW}D${NC}"
echo -e "${GREEN}====================================================${NC}"
