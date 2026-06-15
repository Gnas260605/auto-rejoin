# Hướng Dẫn Cài Đặt Tool Tự Động Vào Lại Game Roblox trên UGPhone (Dùng Termux)

Công cụ này giúp bạn tự động kết nối lại (Auto Rejoin) khi game bị crash/văng, chống treo máy (Anti-AFK), ghi log nhật ký hoạt động, gửi thông báo qua Discord Webhook và tự động khởi động lại game định kỳ để giảm lag RAM trên máy đám mây **UGPhone**.

---

Mở **Termux** trên điện thoại đám mây và chạy dòng lệnh sau (Thay thế `2753915549` bằng Place ID của bạn):

```bash
curl -sSL https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/setup.sh -o setup.sh && bash setup.sh 2753915549
```

*Nếu bạn sử dụng **Server riêng (Private Server)**, hãy truyền thêm mã Share Code ở phía sau. Ví dụ:*
```bash
curl -sSL https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/setup.sh -o setup.sh && bash setup.sh 2753915549 abc123xyz
```

*(Nếu bạn đã tải file `setup.sh` về máy, bạn có thể chạy trực tiếp bằng lệnh: `chmod +x setup.sh && ./setup.sh <PLACE_ID> [PRIVATE_CODE]`)*

---

## 🛠️ Các tính năng nổi bật
* **Menu điều khiển trực quan (Interactive CLI):** Giúp bạn sửa Place ID, mã code Server riêng, cấu hình Discord hay tọa độ Anti-AFK mà không cần sửa file code trực tiếp.
* **Auto Reconnect (Tự động kết nối lại):** Tự động phát hiện khi Roblox bị đóng/văng ra màn hình chính để mở lại ngay lập tức.
* **Anti-AFK (Chống Kick):** Tự động giả lập các lượt chạm (Tap) màn hình theo thời gian định sẵn tại tọa độ tùy chỉnh để Roblox không kick bạn ra vì treo máy quá 20 phút.
* **Discord Webhook Alert:** Nhận thông báo trực tiếp trên điện thoại của bạn qua Discord mỗi khi game gặp sự cố hoặc bắt đầu chạy lại.
* **Restart định kỳ:** Tự khởi động lại Roblox sau một khoảng thời gian thiết lập (ví dụ: 2 tiếng) giúp thiết bị Cloud Phone luôn mượt mà và không bị tràn RAM.

---

## 📌 Chuẩn bị trước khi chạy trên UGPhone

### 1. Bật Quyền Root (Khuyên dùng)
UGPhone hỗ trợ kích hoạt quyền Root cực nhanh:
1. Vào cài đặt của thiết bị UGPhone.
2. Bật tính năng **Root** (hoặc SuperUser).
3. Khi chạy tool lần đầu, hãy bấm **Cho phép (Allow)** khi Termux yêu cầu quyền SuperUser.

### 2. Sử dụng ADB nếu không có Root
Nếu không muốn Root:
1. Bật **Developer Options** (Tùy chọn nhà phát triển) -> **Wireless Debugging** (Gỡ lỗi không dây) trong cài đặt Android.
2. Thực hiện kết nối nội bộ bằng lệnh trong Termux trước khi chạy tool: `adb connect localhost:5555`

---

## 🚀 Cách chạy ngầm 24/7 không sợ tắt Termux

Để tool hoạt động ổn định khi bạn thoát ứng dụng UGPhone, hãy sử dụng `tmux` (được cài đặt tự động qua `setup.sh`):

1. **Tạo phiên chạy ngầm mới:**
   ```bash
   tmux new -s roblox
   ```
2. **Khởi chạy bot:**
   ```bash
   ./auto_rejoin.sh
   ```
3. **Thoát tạm thời ra ngoài (Để bot chạy ngầm):**
   Nhấn tổ hợp phím `Ctrl + B` rồi nhả ra và bấm tiếp phím `D`. Giờ bạn có thể tắt app UGPhone thoải mái.
4. **Vào lại giao diện xem trạng thái bot:**
   ```bash
   tmux attach -t roblox
   ```

---

## 👥 Hướng dẫn cho Trường hợp 2: Chạy nhiều bản Clone trên CÙNG 1 UGPhone

Nếu bạn nhân bản ứng dụng Roblox thành nhiều bản khác nhau (bằng App Cloner, Dual Space, v.v.) trên cùng 1 điện thoại đám mây, hãy cấu hình theo các bước sau để tránh bị đè lệnh:

### Bước 1: Tìm Package Name của từng bản Clone
Mỗi bản Roblox clone sẽ có một tên gói (Package Name) riêng.
1. Mở bản Roblox Clone số 1 lên màn hình trước.
2. Vào Termux gõ lệnh kiểm tra app đang mở:
   ```bash
   su -c "dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'"
   ```
3. Bạn sẽ thấy dòng chứa tên dạng như: `com.roblox.client.clone1` hoặc `com.roblox.client_dual`. Đó chính là **Package Name** của bản clone đó. Làm tương tự để lấy tên gói cho cả 5 bản.

### Bước 2: Tạo các file cấu hình riêng biệt cho từng Clone
Thay vì dùng chung 1 file cấu hình `config.cfg`, bạn hãy tạo các file riêng cho từng acc để quản lý dễ dàng:
1. Sao chép file cấu hình mặc định ra thành các file mới:
   ```bash
   cp config.cfg config_acc1.cfg
   cp config.cfg config_acc2.cfg
   cp config.cfg config_acc3.cfg
   ```
2. Mở từng file cấu hình lên chỉnh sửa bằng `nano` (ví dụ: `nano config_acc1.cfg`) và điền thông tin tương ứng:
   * Sửa `ROBLOX_PACKAGE="com.roblox.client.clone1"`
   * Sửa các thông số tọa độ AFK, Place ID hoặc Discord Webhook cho tài khoản đó.
   * Ấn `Ctrl + O` để lưu, `Ctrl + X` để thoát.

### Bước 3: Chạy song song bằng Tmux
Bạn sẽ dùng `tmux` để mở 5 cửa sổ Termux chạy ngầm độc lập cho 5 acc:
1. Tạo một phiên tmux chính:
   ```bash
   tmux new -s multi-roblox
   ```
2. Để chạy Acc 1:
   ```bash
   CONFIG_FILE="config_acc1.cfg" LOG_FILE="roblox_acc1.log" ./auto_rejoin.sh
   ```
3. Tạo tiếp một cửa sổ tmux mới cho Acc 2 bằng cách nhấn tổ hợp phím: `Ctrl + B` rồi nhấn phím `C`. Sau đó chạy:
   ```bash
   CONFIG_FILE="config_acc2.cfg" LOG_FILE="roblox_acc2.log" ./auto_rejoin.sh
   ```
4. Tiếp tục lặp lại thao tác tạo cửa sổ (`Ctrl + B` -> `C`) cho các tài khoản tiếp theo.
5. Để ẩn tất cả và thoát ra màn hình ngoài Termux: Nhấn `Ctrl + B` rồi nhả ra và bấm `D`.
6. Để chuyển đổi qua lại giữa các cửa sổ quản lý tài khoản trong tmux, nhấn: `Ctrl + B` sau đó nhấn phím `W` để mở menu danh sách chọn.
