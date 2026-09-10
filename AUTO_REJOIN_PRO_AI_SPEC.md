# AUTO-REJOIN PRO — AI IMPLEMENTATION SPEC

## 1. Mục tiêu dự án

Nâng cấp repo hiện tại:

```text
https://github.com/Gnas260605/auto-rejoin.git
```

từ một script auto-rejoin Roblox chạy bằng Shell/Termux thành một công cụ có thể đóng gói và bán cho người dùng cuối.

Mục tiêu chính:

- Ổn định hơn khi chạy lâu.
- Dễ cài đặt.
- Dễ cấu hình.
- Không yêu cầu người dùng chỉnh file thủ công nhiều.
- Hỗ trợ nhiều Roblox clone/package.
- Tự nhận diện link Roblox.
- Hỗ trợ tải và cài Roblox APK từ URL do người dùng cung cấp.
- Có hệ thống profile.
- Có license.
- Có auto update.
- Có log/diagnostics.
- Chuẩn bị kiến trúc để sau này kết nối Node.js API + React Dashboard.

---

# 2. Nguyên tắc bắt buộc

AI phải ưu tiên:

1. Độ ổn định.
2. Bảo mật.
3. Khả năng bảo trì.
4. Không phá chức năng cũ.
5. Không yêu cầu người dùng biết nhiều lệnh Linux.
6. Mỗi chức năng phải tách module rõ ràng.
7. Không nhồi toàn bộ logic vào một file shell duy nhất.
8. Không lưu Roblox password hoặc cookie.
9. Không inject, patch hoặc sửa Roblox client.
10. Không bypass anti-cheat.
11. Không sử dụng `eval` cho dữ liệu người dùng nhập.
12. Không sử dụng `source config.cfg` để đọc file cấu hình không đáng tin cậy.

---

# 3. Kiến trúc mục tiêu

Cấu trúc dự kiến:

```text
auto-rejoin/
│
├── bin/
│   └── roblox-manager
│
├── lib/
│   ├── config.sh
│   ├── android.sh
│   ├── roblox.sh
│   ├── monitor.sh
│   ├── installer.sh
│   ├── updater.sh
│   ├── notification.sh
│   ├── license.sh
│   ├── profile.sh
│   ├── logger.sh
│   └── ui.sh
│
├── config/
│   ├── global.conf
│   ├── profiles/
│   │   └── default.conf
│   └── accounts/
│       └── example.conf
│
├── logs/
│
├── tmp/
│
├── VERSION
├── install.sh
├── uninstall.sh
├── README.md
└── CHANGELOG.md
```

---

# 4. Refactor repo hiện tại

## 4.1. Tách file shell lớn

Nếu logic hiện đang nằm chủ yếu trong `auto_rejoin.sh`, phải tách thành các module.

### config.sh

Chịu trách nhiệm:

- đọc config;
- validate config;
- ghi config;
- default values;
- migrate config version cũ.

Không dùng:

```bash
source "$CONFIG_FILE"
```

Không cho phép file config thực thi shell code.

Nên parse theo whitelist:

```text
KEY=value
```

Các key cho phép ví dụ:

```text
ACCOUNT_NAME
ROBLOX_PACKAGE
GAME_URL
PLACE_ID
PRIVATE_CODE
CHECK_INTERVAL
RESTART_INTERVAL
DISCORD_WEBHOOK
ANTI_AFK
PROFILE
```

---

## 4.2. Loại bỏ eval

Không được dùng:

```bash
eval "$COMMAND"
```

Thay bằng command + arguments an toàn.

Ví dụ:

```bash
run_pm() {
    pm "$@"
}
```

hoặc:

```bash
adb shell pm "$@"
```

Tất cả input từ user phải được coi là untrusted.

---

# 5. Android abstraction layer

File:

```text
lib/android.sh
```

Phải tự phát hiện môi trường:

```text
ROOT
ADB
TERMUX
UNKNOWN
```

Expose các function:

```text
android_exec
android_pm
android_am
android_input
android_getprop
android_pidof
android_force_stop
android_start_uri
android_package_exists
android_get_package_version
```

Phần còn lại của app không được tự gọi trực tiếp `su`, `adb shell`, `pm`, `am` ở nhiều nơi.

---

# 6. Roblox module

File:

```text
lib/roblox.sh
```

Cần có:

```text
roblox_is_running
roblox_launch
roblox_force_stop
roblox_rejoin
roblox_parse_url
roblox_get_place_id
roblox_get_private_code
roblox_detect_packages
roblox_validate_package
```

---

# 7. Roblox Link Parser

Tool phải hỗ trợ các dạng link:

## Game URL

Ví dụ:

```text
https://www.roblox.com/games/2753915549/Game-Name
```

Kết quả:

```text
TYPE=game
PLACE_ID=2753915549
```

## Private Server / Share Link

Ví dụ:

```text
https://www.roblox.com/share?code=ABC123&type=Server
```

Kết quả:

```text
TYPE=private_server
PRIVATE_CODE=ABC123
```

## Roblox URI

Ví dụ:

```text
roblox://experiences/start?placeId=2753915549
```

Kết quả:

```text
TYPE=game
PLACE_ID=2753915549
```

## APK URL

Ví dụ:

```text
https://example.com/Roblox.apk
```

Kết quả:

```text
TYPE=apk
URL=https://example.com/Roblox.apk
```

Tạo một function chung:

```text
detect_link_type
```

---

# 8. Smart Roblox Installer

File:

```text
lib/installer.sh
```

Đây là tính năng quan trọng.

Người dùng có thể nhập:

```text
https://domain.com/Roblox.apk
```

Tool phải:

```text
URL
 ↓
Validate URL
 ↓
Require HTTPS
 ↓
Download
 ↓
Check file size
 ↓
Check APK
 ↓
Read package
 ↓
Verify expected package
 ↓
Calculate SHA256
 ↓
Verify signature if possible
 ↓
Install
 ↓
Verify installed
 ↓
Show result
```

---

# 9. Không được cài APK mù

Không làm:

```bash
curl "$URL" -o roblox.apk
pm install roblox.apk
```

Phải validate trước.

---

# 10. APK Validation

Sau khi tải APK:

## Kiểm tra tồn tại

```text
file exists
size > 0
```

## Giới hạn dung lượng

Có configurable maximum:

```text
MAX_APK_SIZE_MB
```

Ví dụ default:

```text
500 MB
```

## Package validation

Nếu có `aapt`:

```bash
aapt dump badging file.apk
```

Đọc:

```text
package name
versionCode
versionName
```

Allowed package mặc định:

```text
com.roblox.client
```

Nếu là clone:

Cho phép admin/user cấu hình whitelist package.

Nếu package không hợp lệ:

```text
ABORT INSTALL
```

---

# 11. SHA256

Sau khi download:

```bash
sha256sum file.apk
```

Hiển thị hash.

Nếu URL/config có expected SHA256:

```text
expected == actual
```

Nếu mismatch:

```text
ABORT INSTALL
```

---

# 12. APK Installation

Installer phải support:

```text
ROOT MODE
ADB MODE
```

Ví dụ:

```text
pm install -r file.apk
```

hoặc:

```text
adb install -r file.apk
```

Sau khi cài:

```text
verify package exists
read installed version
```

---

# 13. Tự phát hiện Roblox đã cài

Khi setup:

```text
roblox_detect_packages
```

Dùng:

```bash
pm list packages
```

hoặc:

```bash
adb shell pm list packages
```

Tìm package liên quan Roblox.

UI:

```text
Detected Roblox packages:

[1] com.roblox.client
[2] com.roblox.clone1
[3] com.roblox.clone2
```

Cho user chọn.

---

# 14. Setup Wizard

Tạo command:

```bash
roblox-manager setup
```

Flow:

```text
AUTO REJOIN PRO SETUP

1. Detect environment
2. Detect ROOT / ADB
3. Detect Roblox packages
4. Ask user to select package
5. If Roblox missing:
   - Install from APK URL
   - Skip
6. Ask account display name
7. Ask Roblox game/private-server URL
8. Parse URL automatically
9. Configure monitor
10. Configure Discord
11. Save profile
12. Start manager
```

Không yêu cầu user tự sửa config bằng `nano`.

---

# 15. Account Config

Ví dụ:

```ini
ACCOUNT_NAME=Acc01
ROBLOX_PACKAGE=com.roblox.client
GAME_TYPE=game
PLACE_ID=2753915549
PRIVATE_CODE=
CHECK_INTERVAL=20
RESTART_INTERVAL=10800
PROFILE=default
```

Không lưu:

```text
password
cookie
security token
Roblox session
```

---

# 16. Profile System

Folder:

```text
config/profiles/
```

Ví dụ:

```ini
PROFILE_NAME=BloxFruits
CHECK_INTERVAL=20
RESTART_INTERVAL=10800
ANTI_AFK=false
REJOIN_BACKOFF=true
DISCORD_NOTIFY=true
```

Cho phép:

```bash
roblox-manager profile list
roblox-manager profile create
roblox-manager profile apply BloxFruits Acc01
```

Một profile có thể apply nhiều clone.

---

# 17. State Machine

Không dùng monitor loop quá nhiều `if continue`.

Thiết kế state:

```text
STOPPED
LAUNCHING
LOADING
IN_GAME
DISCONNECTED
CRASHED
RECOVERING
COOLDOWN
ERROR
```

Transition ví dụ:

```text
STOPPED
  ↓
LAUNCHING
  ↓
LOADING
  ↓
IN_GAME
```

Nếu process chết:

```text
IN_GAME
 ↓
CRASHED
 ↓
RECOVERING
```

Nếu lỗi nhiều:

```text
RECOVERING
 ↓
COOLDOWN
```

---

# 18. Exponential Backoff

Không spam rejoin.

Ví dụ:

```text
Fail 1 → 5 seconds
Fail 2 → 10 seconds
Fail 3 → 20 seconds
Fail 4 → 30 seconds
Fail 5 → 60 seconds
```

Config:

```text
MAX_BACKOFF=300
```

Nếu:

```text
10 crashes / 10 minutes
```

thì:

```text
COOLDOWN
```

ví dụ 5 phút.

---

# 19. Lock chống chạy trùng

Mỗi Roblox package chỉ được có một manager instance.

Ví dụ lock:

```text
/tmp/auto-rejoin-com.roblox.client.lock
```

Nếu process khác đang chạy:

```text
ERROR:
Instance already running
```

Không chạy bot chồng nhau.

---

# 20. Structured Logging

Không chỉ echo text.

Log format:

```text
2026-09-09T09:30:00+07:00 INFO account=Acc01 event=launch package=com.roblox.client
```

Các level:

```text
DEBUG
INFO
WARN
ERROR
```

Log file:

```text
logs/manager.log
logs/accounts/Acc01.log
```

Có log rotation.

Ví dụ:

```text
max 10 MB
keep 5 files
```

---

# 21. Diagnostics

Command:

```bash
roblox-manager doctor
```

Kiểm tra:

```text
OS
Termux
Root
ADB
curl
jq
aapt
sha256sum
Roblox package
storage permission
network
config
license
update server
```

Output:

```text
[✓] curl
[✓] jq
[✓] root
[✓] Roblox
[!] aapt missing
[✓] Network
```

---

# 22. Discord Notification

Không build JSON thủ công.

Không làm:

```bash
-d "{\"content\":\"$message\"}"
```

Dùng:

```bash
jq -n --arg content "$message" '{content:$content}'
```

Notification events:

```text
manager_started
manager_stopped
roblox_crashed
rejoin_success
rejoin_failed
cooldown_started
update_available
license_expiring
```

---

# 23. Health Score

Mỗi account có:

```text
0-100
```

Ví dụ tính từ:

```text
uptime
crash count
disconnect count
rejoin success rate
recent failures
```

Status:

```text
90-100 HEALTHY
70-89 WARNING
0-69 UNSTABLE
```

---

# 24. CLI Commands

Mục tiêu:

```bash
roblox-manager setup

roblox-manager start
roblox-manager stop
roblox-manager restart
roblox-manager status

roblox-manager account list
roblox-manager account add
roblox-manager account remove
roblox-manager account start Acc01
roblox-manager account stop Acc01
roblox-manager account rejoin Acc01

roblox-manager profile list
roblox-manager profile create
roblox-manager profile apply

roblox-manager install-roblox URL

roblox-manager update
roblox-manager doctor

roblox-manager license activate KEY
roblox-manager license status
```

---

# 25. Interactive UI

Nếu chạy:

```bash
roblox-manager
```

thì hiển thị menu:

```text
╔══════════ AUTO REJOIN PRO ══════════╗
║ Version: 4.x                        ║
║ License: PRO                        ║
╚═════════════════════════════════════╝

1. Dashboard
2. Start All
3. Stop All
4. Rejoin Account
5. Add Account
6. Roblox Installer
7. Profiles
8. Logs
9. Diagnostics
10. Update
11. License
0. Exit
```

---

# 26. Dashboard CLI

Ví dụ:

```text
AUTO REJOIN PRO

#  Account      Package                State        Health  Rejoin
1  Acc01        com.roblox.client      IN_GAME      100%    0
2  Acc02        com.roblox.clone1      RECOVERING    81%    3
3  Acc03        com.roblox.clone2      OFFLINE       65%    7

ONLINE: 2/3
UPTIME: 5h 42m
```

---

# 27. Auto Update

File:

```text
lib/updater.sh
```

Server trả:

```json
{
  "version": "4.1.0",
  "downloadUrl": "https://...",
  "sha256": "...",
  "mandatory": false
}
```

Client:

```text
GET VERSION
 ↓
compare
 ↓
download
 ↓
verify SHA256
 ↓
backup
 ↓
install
 ↓
rollback if failed
```

Không update nếu hash sai.

---

# 28. Versioning

File:

```text
VERSION
```

Ví dụ:

```text
4.0.0
```

Dùng Semantic Versioning:

```text
MAJOR.MINOR.PATCH
```

---

# 29. License System

Client module:

```text
lib/license.sh
```

Backend tương lai:

```text
Node.js
Express
MySQL
```

Endpoints:

```text
POST /api/license/activate
POST /api/license/validate
POST /api/license/deactivate
GET  /api/version
```

Activate request:

```json
{
  "licenseKey": "AR-XXXX-XXXX",
  "installationId": "...",
  "version": "4.0.0"
}
```

Response:

```json
{
  "valid": true,
  "plan": "pro",
  "expiresAt": "2026-12-31T00:00:00Z",
  "maxDevices": 5
}
```

---

# 30. Installation ID

Không phụ thuộc duy nhất:

```text
IMEI
Android ID
MAC
```

Tạo random UUID lần đầu.

Ví dụ:

```text
~/.auto-rejoin/installation_id
```

Nếu chưa có:

```text
generate UUID
save locally
```

Dùng ID này activate license.

---

# 31. License Cache

Nếu mất mạng tạm thời, không khóa tool ngay.

Cache signed license state.

Ví dụ:

```text
offline grace period = 24 hours
```

Không được cho client tự quyết ngày hết hạn hoàn toàn nếu có thể giả mạo.

---

# 32. Các plan

Thiết kế sẵn:

```text
BASIC
STANDARD
PRO
BUSINESS
```

Ví dụ:

```text
BASIC
1 instance

STANDARD
5 instances

PRO
20 instances

BUSINESS
50+
```

Không hard-code rải rác.

Tạo:

```text
feature flags
```

Ví dụ:

```text
max_instances
discord
profiles
auto_update
remote_control
dashboard
```

---

# 33. Backend tương lai

Không cần làm ngay nếu đang ở giai đoạn refactor.

Kiến trúc:

```text
UGPhone Client
    │
    │ HTTPS
    ▼
Node.js API
    │
    ├── MySQL
    ├── Socket.IO
    └── License Service
          │
          ▼
React Dashboard
```

---

# 34. Roadmap triển khai

## Phase 1 — Stabilize

Phải làm trước:

```text
[ ] split modules
[ ] remove eval
[ ] remove source config
[ ] safe command execution
[ ] safe JSON
[ ] state machine
[ ] exponential backoff
[ ] process locks
[ ] structured logs
[ ] diagnostics
```

---

## Phase 2 — Smart Setup

```text
[ ] setup wizard
[ ] auto package detection
[ ] game URL parser
[ ] private server parser
[ ] account configs
[ ] profiles
```

---

## Phase 3 — Roblox Installer

```text
[ ] APK URL detection
[ ] HTTPS-only download
[ ] timeout
[ ] retries
[ ] maximum file size
[ ] APK validation
[ ] package validation
[ ] SHA256
[ ] signature validation if possible
[ ] root install
[ ] ADB install
[ ] post-install verification
```

---

## Phase 4 — Commercial

```text
[ ] version system
[ ] auto update
[ ] installation ID
[ ] license activation
[ ] license validation
[ ] plan limits
[ ] feature flags
```

---

## Phase 5 — SaaS

```text
[ ] Node.js API
[ ] MySQL
[ ] React dashboard
[ ] customer management
[ ] device management
[ ] remote status
[ ] remote restart
[ ] log upload
[ ] metrics
```

---

# 35. Coding Rules

AI khi chỉnh code phải tuân thủ:

## Shell

Dùng:

```bash
set -u
```

Có thể dùng:

```bash
set -o pipefail
```

Không bật `set -e` một cách mù quáng nếu monitor cần recovery.

Luôn quote variable:

```bash
"$VAR"
```

Không:

```bash
$VAR
```

khi có thể chứa space.

---

# 36. Network Rules

Tất cả curl phải có:

```text
--fail
--location
--connect-timeout
--max-time
--retry
```

Không để request treo vô hạn.

---

# 37. File Rules

Temporary files:

```text
tmp/
```

Phải cleanup.

Không ghi đè file quan trọng trước khi verify.

Update flow:

```text
download
verify
backup
replace
```

---

# 38. Error Handling

Mỗi function trả exit code rõ ràng.

Ví dụ:

```text
0 = success
1 = generic error
2 = invalid input
3 = network error
4 = validation error
5 = permission error
```

Nếu hợp lý, constants hóa error codes.

---

# 39. Security

Không log:

```text
license full key
webhook full URL
auth token
cookie
password
```

Log masked:

```text
AR-XXXX-****-1234
```

Discord webhook:

```text
https://discord.com/api/webhooks/***
```

---

# 40. Không lưu Roblox Credential

Tool tuyệt đối không yêu cầu:

```text
Roblox password
Roblox cookie
.ROBLOSECURITY
2FA token
```

Account name chỉ là label quản lý.

Ví dụ:

```text
Acc01
Main
Farm02
```

---

# 41. Không can thiệp Roblox Client

Không:

```text
inject
hook
modify memory
patch binary
modify APK
bypass anti-cheat
disable security
```

Tool chỉ:

```text
launch app
stop app
monitor app process
open supported URI/deep-link
install legitimate APK from supplied source
```

---

# 42. Acceptance Criteria

Bản đầu tiên được coi là hoàn thành khi:

## Setup

User mới clone repo và chạy:

```bash
bash install.sh
```

sau đó:

```bash
roblox-manager setup
```

không cần sửa code.

---

## Installer

User chạy:

```bash
roblox-manager install-roblox https://example.com/Roblox.apk
```

Tool:

```text
download
validate
verify package
install
verify
```

---

## Roblox URL

User paste:

```text
https://www.roblox.com/games/2753915549/...
```

Tool tự lấy:

```text
PLACE_ID=2753915549
```

---

## Private server

User paste share link.

Tool tự lấy private code.

---

## Monitor

Nếu Roblox crash:

```text
detect
wait according to backoff
launch again
confirm running
```

---

## Multiple clones

Tool detect được nhiều package.

Mỗi package có config riêng.

---

## Duplicate process

Không cho start hai monitor cho cùng package.

---

## Logs

Có log account riêng.

---

## Diagnostics

Có:

```bash
roblox-manager doctor
```

---

# 43. Yêu cầu AI trước khi code

AI phải làm theo thứ tự:

1. Đọc toàn bộ repo.
2. Liệt kê file hiện tại.
3. Xác định function đang dùng.
4. Xác định dependency.
5. Xác định những logic phải giữ nguyên.
6. Tạo kế hoạch refactor.
7. Refactor từng module nhỏ.
8. Không rewrite toàn bộ project một lần nếu không cần.
9. Sau mỗi phần phải kiểm tra syntax.
10. Giữ compatibility với config cũ khi có thể.

---

# 44. Test bắt buộc

Shell syntax:

```bash
bash -n
```

Nếu có shellcheck:

```bash
shellcheck
```

Test các case:

```text
Roblox installed
Roblox not installed
Root available
Root unavailable
ADB available
Network offline
Invalid URL
HTTP URL
Broken HTTPS URL
Invalid APK
Wrong package APK
Valid Roblox APK
Game URL
Private server URL
Roblox URI
Crash loop
Two manager instances
Discord disabled
Discord enabled
```

---

# 45. Không phá backward compatibility

Nếu user cũ có:

```text
config.cfg
```

hãy tạo migration.

Ví dụ:

```text
Old config detected.
Migrating to v4 format...
```

Backup:

```text
config.cfg.backup
```

---

# 46. README mới

README phải có:

```text
Overview
Features
Requirements
Install
Quick Start
Roblox Installer
Game URL
Private Server
Multiple Clones
Profiles
Discord
Diagnostics
Update
License
Troubleshooting
Uninstall
```

---

# 47. Changelog

Ví dụ:

```text
## 4.0.0

Added:
- modular architecture
- installer
- profile support

Changed:
- safe config parser

Removed:
- eval execution
```

---

# 48. UX mục tiêu

Người dùng không cần hiểu:

```text
PLACE_ID
package manager
ADB command
deep-link syntax
shell config
```

Họ chỉ cần:

```text
Paste Roblox link
Select Roblox app
Start
```

---

# 49. Product Positioning

Tên tạm:

```text
Auto Rejoin Pro
```

hoặc:

```text
Roblox Cloud Phone Manager
```

Chức năng chính:

```text
Roblox Process Monitor
Crash Recovery
Instance Manager
Smart Launcher
Roblox Installer
Profile Manager
Diagnostics
```

---

# 50. Command tổng thể mong muốn

Ví dụ sử dụng cuối cùng:

```bash
roblox-manager setup
```

hoặc:

```bash
roblox-manager add-link "https://www.roblox.com/games/2753915549/..."
```

hoặc:

```bash
roblox-manager install-roblox "https://example.com/Roblox.apk"
```

hoặc:

```bash
roblox-manager start all
```

hoặc:

```bash
roblox-manager status
```

---

# 51. Chỉ dẫn trực tiếp cho AI Agent

Bạn là AI developer phụ trách nâng cấp repo này.

Không chỉ đưa hướng dẫn hoặc pseudocode.

Bạn phải:

```text
READ
ANALYZE
EDIT
TEST
FIX
DOCUMENT
```

project thực tế.

Khi làm:

- đọc code hiện tại trước;
- ưu tiên giữ chức năng đang hoạt động;
- refactor có kiểm soát;
- tránh thay đổi lớn không cần thiết;
- tạo file/module thật;
- update README;
- chạy syntax checks;
- sửa lỗi phát sinh;
- báo rõ file nào đã thay đổi;
- báo tính năng nào đã hoàn thành;
- báo phần nào còn TODO.

Nếu có quyết định kỹ thuật chưa rõ, chọn phương án:

```text
secure
maintainable
simple
backward-compatible
```

thay vì giải pháp nhanh nhưng khó bảo trì.

---

# 52. Mục tiêu cuối

Người mua tool cần có trải nghiệm:

```text
Install
   ↓
Activate
   ↓
Detect Roblox
   ↓
Paste Link
   ↓
Start
```

và hệ thống tự lo:

```text
monitor
rejoin
recover
log
notify
update
```

Không yêu cầu khách hàng phải sửa source code hoặc hiểu shell internals.
