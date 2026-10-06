# Kết nối Auto Rejoin với ShopRoblox (cày thuê)

Khi một đơn cày thuê được chốt trên ShopRoblox, tab đang cày acc đó tự **dừng rejoin, tắt game và đăng xuất acc khách**.
Trang **Admin › Tab cày thuê** (staff: **Tab cày thuê** trong menu staff) cho thấy máy nào, tab nào đang chạy acc nào, đơn nào.

Không cấu hình gì thì tool chạy y như cũ.

## Cách hoạt động

```
 Máy cày (Termux / UGPhone)                        ShopRoblox (taphoasandg.com)
 ┌──────────────────────────────┐                  ┌───────────────────────────────────┐
 │ tmux: 1 cửa sổ = 1 package   │  heartbeat 30s   │ POST /api/worker/heartbeat        │
 │  com.roblox.client      ─────┼─────────────────▶│  lưu worker_tabs, trả "action"    │
 │  com.roblox.client.vnggames  │◀─────────────────┼─ NONE / COMPLETE_LOGOUT / STOP /  │
 │  com.roblox.client.clone1    │    action        │   RESUME                          │
 │                              │                  │                                   │
 │ đơn xong:                    │  POST /ack       │ đơn completed/cancelled ở BẤT KỲ  │
 │  dừng game → pm clear        ├─────────────────▶│ đâu (trang Đơn hàng, Staff, Tab   │
 │  → Discord → ack             │                  │ cày) → tab nhận COMPLETE_LOGOUT   │
 └──────────────────────────────┘                  └───────────────────────────────────┘
```

- **Trạng thái đơn trên Shop là nguồn sự thật.** Thợ chốt đơn ở đâu cũng được; tab gắn đơn đó tự trả acc ở lần heartbeat kế tiếp (tối đa ~30 giây).
- Heartbeat lỗi (mất mạng) → bot hỏi riêng `GET /api/worker/order-status/<mã đơn>`. Cả hai đều lỗi → **bot không làm gì**, cày tiếp.
- Sau khi trả acc, tab đứng ở trạng thái `ORDER_DONE`: không mở lại game, không rejoin.
  Thợ đăng nhập acc khách mới trên tab đó rồi **gán mã đơn mới** ở trang Tab cày → bot tự mở game (`RESUME`).
- Đơn bị **huỷ** cũng trả acc như đơn hoàn thành.

### Ba lệnh trên dashboard

| Nút | Bot làm gì |
|---|---|
| **Hoàn thành & đăng xuất** | Chốt đơn trên Shop (khách nhận email hoàn thành), bot dừng game và xoá dữ liệu app |
| **Dừng khẩn cấp** | Dừng game, ngừng rejoin. **Giữ** đăng nhập (dùng khi cần kiểm tra acc) |
| **Đăng xuất** (tab không gắn đơn) | Dừng game và xoá dữ liệu app |

## Cài đặt

### Cách nhanh: một lệnh (khuyên dùng)

Admin › **Tab cày thuê** › **Lệnh cài máy cày** → chọn key, đặt tên máy, dán token bot → **Copy lệnh** → dán vào Termux.
Lệnh tự cài tool, kích hoạt key và tạo `shop_worker.cfg`. Sau đó mở menu tool, chọn **[1] Khởi động**.

Lệnh có dạng:

```bash
cd ~; rm -rf auto-rejoin; mkdir -p auto-rejoin; cd auto-rejoin; curl -fSL https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/setup.sh -o setup.sh; \
AUTO_REJOIN_REF="main" AUTO_REJOIN_LICENSE_API="..." AUTO_REJOIN_LICENSE_MODE=required LICENSE_KEY="AR-XXXX-XXXX-XXXX-XXXX" \
SHOP_API_URL="https://taphoasandg.com" SHOP_WORKER_TOKEN="..." WORKER_ID="ugphone-01" bash setup.sh <PLACE_ID>
```

Lệnh **xoá thư mục `auto-rejoin` cũ** trên máy rồi cài mới. Các bước 1–2 dưới đây là cách làm tay, tương đương.

### 1. Lấy token cho bot (một lần)

Admin › **Tab cày thuê** › **Tạo token bot**. Token chỉ hiện một lần; bấm lại = tạo token mới, token cũ hết hiệu lực.

### 2. File dùng chung cho cả máy: `shop_worker.cfg`

Đặt cạnh `auto_rejoin.sh` (thư mục cài tool):

```ini
# shop_worker.cfg — áp dụng cho mọi tab trên máy này
SHOP_API_URL="https://taphoasandg.com"
SHOP_WORKER_TOKEN="dán-token-từ-dashboard"
WORKER_ID="ugphone-01"          # tên máy hiển thị trên dashboard (chữ, số, . _ -)
WORKER_HEARTBEAT_INTERVAL=30    # giây, 10-3600
ORDER_DONE_ACTION="logout"      # khi dùng file trigger trống: logout (mặc định) hoặc stop
```

```bash
chmod 600 shop_worker.cfg       # chỉ chủ máy đọc được token
```

### 3. File của từng tab: `config_<package>.cfg`

Tool tạo sẵn mỗi file khi bấm **[1] Khởi động** (vd. `config_com.roblox.client.cfg`). Chỉ cần thêm **mã đơn** của acc đang đăng nhập trong tab đó:

**Roblox Quốc Tế** — `config_com.roblox.client.cfg`
```ini
PLACE_ID="2753915549"
ROBLOX_PACKAGE="com.roblox.client"
ROBLOX_USERNAME="khach_quocte_01"
ORDER_ID="1287"
```

**Roblox VNG** — `config_com.roblox.client.vnggames.cfg`
```ini
PLACE_ID="2753915549"
ROBLOX_PACKAGE="com.roblox.client.vnggames"
ROBLOX_USERNAME="khach_vng_07"
ORDER_ID="1290"
```

**Clone** — `config_com.roblox.client.clone1.cfg`
```ini
PLACE_ID="2753915549"
ROBLOX_PACKAGE="com.roblox.client.clone1"
ROBLOX_USERNAME="khach_clone_02"
ORDER_ID="1291"
```

- `ORDER_ID` có thể bỏ trống rồi **gán đơn trên dashboard** — bot nhận theo Shop.
- Chạy lại **[1] Khởi động** không xoá `ORDER_ID` hay các khoá `SHOP_*` đã thêm vào file tab.
- Muốn một tab dùng token/tên máy khác: đặt `SHOP_WORKER_TOKEN` / `WORKER_ID` ngay trong file tab đó (ưu tiên hơn `shop_worker.cfg`).
- Phiên bản hiển thị tự nhận theo package: `com.roblox.client` = Quốc tế, tên có `vng` = VNG, còn lại = Clone.

### 4. Khởi động lại bot

Menu **[0] Dừng tất cả** → **[1] Khởi động**. Sau ~30 giây các tab hiện trên dashboard.

## Đăng xuất bằng tay trên máy (không cần mạng)

```bash
cd <thư mục chứa auto_rejoin.sh>
echo logout > tmp/order_done_com.roblox.client.vnggames   # dừng + xoá dữ liệu app
echo stop   > tmp/order_done_com.roblox.client            # chỉ dừng, giữ đăng nhập
```

Bot đọc file ở vòng kiểm tra kế tiếp (`CHECK_INTERVAL`), làm xong thì xoá file.

## Lưu ý quan trọng

- **Đăng xuất = `pm clear <package>`**: xoá toàn bộ dữ liệu app Roblox của tab đó (đăng nhập, cài đặt đồ hoạ, cache).
  Cần **root hoặc ADB** (UGPhone có). Không có quyền → dashboard báo *"không xoá được dữ liệu app — đăng xuất tay"* và Discord nhắc.
- Bot chỉ xoá package có chữ `roblox` trong tên; package khác bị từ chối.
- Tool **không tự đăng nhập** acc khách mới (cố ý không hỗ trợ inject cookie/mật khẩu). Thợ đăng nhập tay rồi gán đơn.
- Lệnh có hiệu lực trong khoảng `WORKER_HEARTBEAT_INTERVAL` (mặc định 30 giây), không tức thì.
- Token nằm trong `shop_worker.cfg` / `config_*.cfg` trên máy cày; các file này đã nằm trong `.gitignore`. Lộ token: tạo token mới trên dashboard.

## Kiểm tra nhanh

```bash
tail -n 20 roblox_com.roblox.client.vnggames.log | grep -E "order_|worker_"
```

| Log | Nghĩa |
|---|---|
| `worker_heartbeat_failed` | Không gọi được Shop: kiểm tra mạng, `SHOP_API_URL`, token |
| `order_finished ... result="logged_out"` | Đã dừng + đăng xuất |
| `order_finished ... result="logout_failed"` | Dừng được nhưng không xoá được dữ liệu app (thiếu root/ADB) |
| `order_resume` | Đã nhận đơn mới, đang mở game |
| `app_clear_refused` | Package không phải Roblox, bot từ chối xoá |
