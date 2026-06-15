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
echo -e "${GREEN}    TRÌNH CÀI ĐẶT NHANH ROBLOX AUTO REJOIN BOT       ${NC}"
echo -e "${CYAN}====================================================${NC}"
echo -e "[*] Đang cập nhật gói hệ thống Termux..."
pkg update -y && pkg upgrade -y

echo -e "[*] Đang cài đặt các công cụ cần thiết (tmux, curl, tsu, procps)..."
pkg install tmux curl tsu procps -y

# Kiểm tra quyền thực thi lệnh trên điện thoại Cloud Phone
echo -e "[*] Đang kiểm tra môi trường hệ thống..."
if command -v su >/dev/null 2>&1 && su -c "id" >/dev/null 2>&1; then
    echo -e "${GREEN}[+] Thiết bị đã được ROOT! Tool sẽ hoạt động hoàn hảo.${NC}"
else
    echo -e "${YELLOW}[!] Thiết bị chưa ROOT hoặc chưa cấp quyền ROOT cho Termux.${NC}"
    echo -e "[*] Đang cài đặt bộ công cụ android-tools phòng trường hợp dùng kết nối ADB không dây..."
    pkg install android-tools -y
    echo -e "${CYAN}[ℹ] Lưu ý: Nếu không có Root, bạn cần bật Gỡ lỗi không dây và gõ 'adb connect localhost:5555' trước khi chạy tool.${NC}"
fi

# Tải hoặc cấu hình quyền cho file chạy chính
if [ -f "auto_rejoin.sh" ]; then
    chmod +x auto_rejoin.sh
    echo -e "${GREEN}[+] Đã cấp quyền chạy cho auto_rejoin.sh${NC}"
else
    echo -e "[*] Đang tải file script auto_rejoin.sh về máy..."
    # Trong trường hợp họ chạy trực tiếp qua lệnh internet curl setup.sh, ta sẽ tải auto_rejoin.sh về
    curl -o auto_rejoin.sh -L "https://raw.githubusercontent.com/username/ToolAutoRoblox/main/auto_rejoin.sh" 2>/dev/null || echo -e "${RED}[!] Không thể tải online. Hãy đảm bảo file auto_rejoin.sh có sẵn trong thư mục hiện tại.${NC}"
    chmod +x auto_rejoin.sh
fi

echo -e "${GREEN}====================================================${NC}"
echo -e "${GREEN}          CÀI ĐẶT THÀNH CÔNG VÀ SẴN SÀNG!            ${NC}"
echo -e "${GREEN}====================================================${NC}"
echo -e "Để khởi chạy hệ thống quản lý, bạn chỉ cần gõ lệnh:"
echo -e "👉 ${YELLOW}./auto_rejoin.sh${NC}"
echo -e ""
echo -n "Bạn có muốn khởi động menu điều khiển ngay bây giờ không? (y/n): "
read run_now
if [ "$run_now" = "y" ] || [ "$run_now" = "Y" ]; then
    ./auto_rejoin.sh
fi
