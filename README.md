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
# Auto Rejoin Pro - Phase 3B Notes

This repository is being hardened from a Termux shell script into a safer local
tool for Roblox auto-rejoin workflows on Termux / UGPhone-like environments.
Real-device validation is still pending; do not treat this build as fully
production certified until `REAL_DEVICE_TEST_CHECKLIST.md` has been completed on
actual devices.

## Current Commands

```bash
bin/roblox-manager help
bin/roblox-manager version
bin/roblox-manager doctor
bin/roblox-manager parse-link "https://www.roblox.com/games/2753915549/Game"
bin/roblox-manager setup
bin/roblox-manager profile list
bin/roblox-manager install-roblox "https://example.com/Roblox.apk"
bin/roblox-manager update check
bin/roblox-manager update --yes
bin/roblox-manager self-test
```

`roblox-manager version` prints `Auto Rejoin Pro <VERSION>` and marks dev builds
as development builds.

## Signed Updates

Phase 4D adds a signed release updater:

```bash
AUTO_REJOIN_UPDATE_MANIFEST_URL="https://your-cdn.example.com/release-manifest.json" \
bin/roblox-manager update check
```

To install after all verification passes:

```bash
AUTO_REJOIN_UPDATE_MANIFEST_URL="https://your-cdn.example.com/release-manifest.json" \
bin/roblox-manager update --yes
```

The updater verifies the manifest signature with the public key in
`keys/update-public.pem`, checks manifest schema with `jq`, requires HTTPS in
production, verifies artifact size and SHA256, rejects unsafe archive paths,
runs staging self-tests, backs up current code, applies the release, verifies the
new `VERSION`, and rolls back on apply/post-check failure.

`--yes` only skips the confirmation prompt. It never skips signature, SHA256,
size, archive, or self-test checks. Updates are refused while monitor locks are
active so the tool does not kill running Roblox sessions.

Release hosting should use immutable versioned artifacts from GitHub Releases,
object storage, or a CDN. Do not use mutable `main` branch files for production
auto-update. See `UPDATE_ARCHITECTURE.md` and `RELEASE_PROCESS.md`.

## Install Roblox

Use:

```bash
bin/roblox-manager install-roblox "https://example.com/Roblox.apk"
```

Useful options:

```bash
--sha256 HASH              Abort unless downloaded APK hash matches.
--expected-package PACKAGE Abort unless APK package matches.
--max-size-mb MB           Override the default APK size cap.
--yes                      Confirm deterministic reinstall of the same version.
--allow-downgrade          Allow explicit downgrade attempts.
--keep-apk                 Keep downloaded APK and print its path.
--dry-run                  Validate only; do not install.
```

## Installer Security Model

The installer does not blindly run `curl URL -o roblox.apk && pm install`.
It performs:

- HTTPS-only URL validation with empty-host and unsafe-character rejection.
- curl download through the network wrapper with timeout, retries, and HTTPS-only redirect policy when supported by curl.
- Unique temp workspace under `tmp/install/job.*`.
- `.part` partial download file, renamed only after curl success.
- Disk-space check before download when `df` is available.
- Max APK size enforcement and APK/ZIP magic check.
- Package metadata read through `aapt` or `aapt2`.
- Default official package policy: `com.roblox.client`.
- SHA256 calculation, with optional expected hash enforcement.
- APK signature verification via `apksigner` or `jarsigner` when available.
- Existing install version check and NEW_INSTALL / UPGRADE / SAME_VERSION / DOWNGRADE classification.
- Post-install package and version verification.
- Cleanup on success/failure/interrupt unless `--keep-apk` is used.

If signature tooling is unavailable, the installer prints that signature
verification is unavailable. It does not claim the APK is signed/verified.

## Upgrade Behavior

- `NEW_INSTALL`: allowed after validation.
- `UPGRADE`: allowed after validation.
- `SAME_VERSION`: blocked unless `--yes` is provided.
- `DOWNGRADE`: blocked unless `--allow-downgrade` is provided.

The tool never auto-runs `pm uninstall` to fix install errors. Existing Roblox
data is not removed by the installer.

## Doctor

Run:

```bash
bin/roblox-manager doctor
```

Doctor checks bash, curl, jq, sha256 tools, APK metadata tools, signature tools,
pm, adb, root command availability, tmux, flock, writable temp storage, disk
space, Roblox packages, network, config, and required project files.

Missing optional tools are reported as WARN. Required project files or core
dependencies are FAIL.

## Setup Wizard

Run:

```bash
bin/roblox-manager setup
```

The wizard detects Roblox packages. If Roblox is missing, it offers to install
from a user-provided HTTPS APK URL or skip. The wizard reuses `lib/installer.sh`;
it does not duplicate installer logic.

## Troubleshooting

- `APK URL must use HTTPS`: use an `https://` APK URL.
- `aapt or aapt2 is required`: install Android build tools or run on an environment where APK metadata can be read.
- `Signature verification unavailable`: install `apksigner` or `jarsigner` if you need local signature verification.
- `same version detected`: rerun with `--yes` only if reinstalling the same APK is intentional.
- `downgrade detected`: rerun with `--allow-downgrade` only if an older APK is intentional and your Android install mode supports it.
- `INSTALL_FAILED_UPDATE_INCOMPATIBLE`: the existing package signature differs. The tool will not uninstall Roblox automatically.

# Auto Rejoin Pro - Phase 4A License Client

Phase 4A adds the local license client foundation only. License enforcement is
optional by default while the production backend is still pending.

```bash
bin/roblox-manager license status
bin/roblox-manager license activate "AR-XXXX-XXXX-XXXX-XXXX"
bin/roblox-manager license validate
bin/roblox-manager license deactivate --local-only
```

Production license API URLs must use HTTPS. Local mock-server tests can enable
HTTP only with:

```bash
AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV=true
```

The client stores a random installation id and an opaque server token/cache under
`${AUTO_REJOIN_APP_DIR:-$HOME/.auto-rejoin}`. It does not store raw license keys,
Roblox passwords, Roblox cookies, or `.ROBLOSECURITY`.

See `LICENSE_ARCHITECTURE.md` for the API contract, offline grace model,
entitlement strategy, and Phase 4B backend notes.

# Auto Rejoin Pro - Phase 4B License Backend

Phase 4B adds the Node.js / Express / MySQL license authority under `server/`.
It keeps client license mode optional by default and does not add payment or a
React dashboard.

```bash
cd server
npm install
npm run migrate
npm start
```

Development license creation:

```bash
cd server
node scripts/create-license.js --plan pro --devices 3 --days 30
```

# Auto Rejoin Pro - Phase 5A Admin License API & Dashboard

Phase 5A adds the administrative management subsystem for license authority operations:

```text
Admin Browser
    ↓ HTTPS
React + Vite Admin Dashboard (admin/)
    ↓ /api/v1/admin/*
Admin Auth Middleware (JWT / HttpOnly SameSite Cookie)
    ↓
Admin Service & Repository
    ↓
MySQL Tables (admin_users, admin_audit_events, licenses, license_devices, license_tokens)
```

### 1. Admin Features
- **Admin Authentication**: Passwords securely hashed with `bcryptjs` (min 12 characters). JWT sessions via HttpOnly SameSite cookie and Bearer auth.
- **Key Invariant**: Cryptographic raw license keys are returned **exactly once** on creation. The server stores only HMAC-SHA256 hashes and display prefixes/last4.
- **License Lifecycle**: Create, filter, search, extend, suspend, reactivate, and revoke licenses.
- **Device Management**: View registered Android devices with masked installation IDs (`4444****4444`), reset/revoke devices and invalidate tokens to release slots.
- **Audit Logging**: Immutable tracking of admin logins, license changes, and device revocations.
- **React Admin Dashboard (`admin/`)**: Fast, dark-mode, responsive Vite + React + Tailwind dashboard with confirmation modals for destructive actions.

### 2. Admin Quickstart

1. **Migrate database**:
   ```bash
   cd server
   npm run migrate
   ```

2. **Create first Administrator**:
   ```bash
   cd server
   node scripts/create-admin.js --username admin --role super_admin
   ```

3. **Start backend**:
   ```bash
   cd server
   npm start
   ```

4. **Start or build Admin Dashboard**:
   ```bash
   cd admin
   npm run dev    # Development on http://localhost:5173
   npm run build  # Production build to admin/dist/
   ```

See `ADMIN_ARCHITECTURE.md` and `ADMIN_DEPLOYMENT_CHECKLIST.md` for complete architecture and deployment instructions.

