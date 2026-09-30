# CẨM NANG DEPLOY DỰ ÁN LÊN MẠNG XÃ HỘI & CLOUD PRODUCTION HOÀN HẢO (A - Z)

Cẩm nang này hướng dẫn bạn cách triển khai hệ thống **ShopRoblox** kết hợp **ToolAutoRoblox (Auto Rejoin Pro)** lên môi trường mạng Internet với đầy đủ tối ưu về:
- **Hiển thị hình ảnh banner Card lung linh khi chia sẻ link lên Facebook, Zalo, Discord, Telegram, TikTok**.
- **Miễn phí SSL (HTTPS), chống DDoS và tăng tốc độ tải trang bằng Cloudflare**.
- **1 Lệnh triển khai trọn gói toàn bộ hệ thống bằng Docker Compose**.

---

## 1. Tối ưu Hiển thị Khi Chia Sẻ Lên Mạng Xã Hội (Social Media Preview)

Chúng tôi đã thiết lập sẵn toàn bộ thẻ **Open Graph (OG)**, **Twitter Cards** và **Banner Gaming 1200x630** chuẩn chỉnh trong mã nguồn:

### Hình ảnh Card Preview tự động hiển thị khi dán link:
* **Ảnh Banner**: Tự động load từ `https://yourdomain.com/images/og-banner.jpg`.
* **Tiêu đề**: `Tạp Hóa SandG - Dịch Vụ Cày Thuê & Nạp Hộ Robux Uy Tín Hàng Đầu`
* **Mô tả ngắn**: `Chuyên dịch vụ cày thuê Blox Fruits/Roblox giá rẻ, nạp hộ Robux an toàn tuyệt đối và hệ thống hỗ trợ game thủ 24/7!`

### Quyền quản trị Gian Hàng Bán Key Tool (Dành cho Admin):
* Tính năng bán Key Tool Auto Rejoin hiện đang trong giai đoạn thử nghiệm nội bộ (Beta).
* **Admin có toàn quyền tùy chỉnh hiển thị**:
  - Bật / Tắt hiển thị từng gói Key qua trường `is_active` (0 = Ẩn, 1 = Hiện).
  - Tắt hoặc Bật toàn bộ danh mục bán Key với 1 thao tác (`POST /api/keys/admin/plans/toggle-all`).
  - Thay đổi nhãn hiển thị thành `SẮP RA MẮT`, `THỬ NGHIỆM`, `BẢO TRÌ` hoặc `DÙNG THỬ`.

### Công cụ kiểm tra & Làm mới Cache mạng xã hội:
1. **Facebook**: Truy cập [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) -> Nhập tên miền của bạn -> Bấm **Scrape Again** (Thu thập lại) để Facebook cập nhật banner mới nhất.
2. **Telegram**: Gửi link cho bot `@webpagebot` trên Telegram rồi chọn Update link preview.
3. **Discord / Zalo**: Chỉ cần dán link vào khung chat, ảnh banner và thông tin dịch vụ sẽ hiện ra dạng Rich Embed card ngay lập tức.

---

## 2. Chuẩn bị VPS & Cấu hình Cloudflare (Miễn Phí 100%)

### Bước 1: Mua Domain & Trỏ về Cloudflare
1. Đăng ký tên miền (tại Namecheap, Tenten, PA Vietnam, v.v.).
2. Thêm domain vào tài khoản [Cloudflare](https://dash.cloudflare.com/).
3. Đổi Nameserver của nhà cung cấp domain sang Cloudflare Nameserver.

### Bước 2: Tạo DNS Record
Trên trang Cloudflare DNS, thêm các bản ghi:
* `Type: A` | `Name: @` (hoặc `yourdomain.com`) | `IPv4 address: <IP_VPS_CUA_BAN>` | `Proxy status: Proxied (Đám mây màu cam)`
* `Type: A` | `Name: www` | `IPv4 address: <IP_VPS_CUA_BAN>` | `Proxy status: Proxied`

### Bước 3: Bật SSL & Tối ưu Bot MXH trên Cloudflare
1. Vào mục **SSL/TLS** -> Chọn chế độ **Full** hoặc **Flexible**.
2. Vào mục **SSL/TLS** -> **Edge Certificates** -> Bật **Always Use HTTPS** và **Automatic HTTPS Rewrites**.
3. Vào mục **Security** -> **Bots** -> Đảm bảo không bật chế độ "Block AI Scrapers" hoặc chặn bot crawler của Facebook (`facebookexternalhit`), Zalo và Discord.

---

## 3. Cấu hình Biến Môi Trường (.env) Trên VPS

Trên máy chủ VPS, tạo file `.env` ở thư mục gốc `ShopRoblox`:

```bash
# === MÔI TRƯỜNG & DOMAIN CHÍNH ===
NODE_ENV=production
FRONTEND_URL=https://yourdomain.com
CORS_ALLOWED_ORIGINS=https://yourdomain.com
SITE_NAME=Tạp Hóa SandG Official

# === DATABASE (MARIADB) ===
DB_NAME=shopblox
DB_USER=shopblox_app
DB_PASSWORD=MatKhauDatabaseBaoMat2026!
DB_ROOT_PASSWORD=MatKhauRootDatabaseBaoMat2026!

# === BẢO MẬT & JWT ===
JWT_SECRET=ChuoiBiMatJWTCucDaiVaNgauNhienItNhat32KyTu123456
ENCRYPTION_KEY=ChuoiBiMatMaHoaDuLieu32KyTuDungChuanGCM!

# === ĐỒNG BỘ TOOL AUTO REJOIN LICENSE ===
# Lưu ý: LICENSE_KEY_PEPPER và TOOL_INTERNAL_API_KEY phải bảo mật và dài >32 ký tự!
LICENSE_KEY_PEPPER=PepperBiMatSieuCapDongBoGiuaShopVaToolServer2026!
TOOL_SERVER_URL=http://tool-server:3000
TOOL_INTERNAL_API_KEY=KeyXacThucNoiBoM2MBaoMatCaoCap32KyTu123456!

# === CỔNG THANH TOÁN (NẾU CÓ) ===
PAYOS_CLIENT_ID=
PAYOS_API_KEY=
PAYOS_CHECKSUM_KEY=
```

---

## 4. Lệnh Khởi Chạy 1-Click Bằng Docker

Trên VPS, bạn chỉ cần mở terminal và chạy:

```bash
# 1. Build và khởi chạy toàn bộ hệ thống
docker compose -f docker-compose.prod.yml up -d --build

# 2. Kiểm tra trạng thái các container đang chạy
docker compose -f docker-compose.prod.yml ps

# 3. Xem log hoạt động real-time
docker compose -f docker-compose.prod.yml logs -f
```

---

## 5. Kiểm thử Toàn Trình (End-to-End Test)

1. **Khách hàng**:
   - Truy cập `https://yourdomain.com` trên điện thoại hoặc máy tính.
   - Chọn gói Key Tool Auto Rejoin (1 ngày, 7 ngày, 30 ngày hoặc Vĩnh Viễn).
   - Thanh toán thành công -> Nhận mã Key dạng: `AR-A1B2-C3D4-E5F6-G7H8`.
2. **Kích hoạt trên UGPhone / Cloud Phone / Termux**:
   - Khách mở Termux gõ:
     ```bash
     bin/roblox-manager license activate AR-A1B2-C3D4-E5F6-G7H8
     ```
   - Tool tự động kết nối về `https://yourdomain.com/api/v1/licenses/activate` và thông báo **Kích hoạt bản quyền thành công**!
3. **Quản trị viên**:
   - Có thể vào trang Admin của Shop hoặc Tool để theo dõi số lượng thiết bị, gia hạn thêm ngày hoặc thu hồi key khi cần.
