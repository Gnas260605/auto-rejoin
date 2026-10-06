# CLAUDE.md — Auto Rejoin Pro

Tool Bash chạy trên Android (Termux / UGPhone) tự động rejoin Roblox khi bị văng,
kèm license server (Node/Express/MySQL) và admin dashboard (React/Vite).
Phiên bản hiện tại: xem `VERSION`. Chưa được xác nhận trên thiết bị thật
(`REAL_DEVICE_TEST_CHECKLIST.md` vẫn `NOT TESTED`).

Trả lời người dùng bằng tiếng Việt. Giữ nguyên tên hàm, biến, đường dẫn.

## Cấu trúc

| Đường dẫn | Vai trò |
|---|---|
| `auto_rejoin.sh` | Entry point: menu tương tác + `--run` (gọi `monitor_run`). Source toàn bộ `lib/`. |
| `lib/monitor.sh` | **Lõi**: state machine (`monitor_tick`, `monitor_run`) và recovery gate. |
| `lib/android.sh` | Mọi lệnh `am`/`pm`/`input`/`dumpsys` đi qua `android_exec` (root / adb / direct). |
| `lib/session_evidence.sh`, `lib/roblox_session.sh` | Đọc log Roblox, phân loại phiên (`APP_HOME`, `GAME_ACTIVE`, disconnect...). |
| `lib/runtime.sh` | Lock theo package, backoff, cooldown khi lỗi liên tiếp. |
| `lib/roblox.sh`, `lib/roblox_api.sh` | Deep-link, chọn server ít người (low-server). |
| `lib/license.sh`, `lib/entitlement.sh` | License client, giới hạn tính năng theo gói. |
| `lib/worker.sh` | Kết nối ShopRoblox cày thuê: heartbeat, `check_order_status`, dừng + đăng xuất khi đơn xong. |
| `lib/updater.sh` | Update có ký số (manifest + SHA256 + rollback). |
| `bin/roblox-manager` | CLI: `doctor`, `setup`, `update`, `license`, `self-test`... |
| `setup.sh` | Script cài đặt cho khách (tải file từ GitHub). |
| `server/` | License API. `admin/` | Dashboard quản trị. |
| `tests/` | Test Bash, mỗi file một suite, chạy được trên Git Bash/Windows. |

## Lệnh

```bash
bash tests/run_all.sh                 # toàn bộ test Bash (~vài phút)
bash tests/test_monitor.sh            # một suite
bin/roblox-manager self-test
cd server && npm run check && npm test
cd admin && npm run build             # admin/dist được track trong git và được Express phục vụ
npx --yes shellcheck@latest -x -S error auto_rejoin.sh setup.sh bin/roblox-manager lib/*.sh
```

CI (`.github/workflows/ci.yml`) chạy đủ các bước trên cho mỗi push/PR.

Luôn chạy `bash tests/run_all.sh` trước khi báo xong một thay đổi trong `lib/` hoặc `auto_rejoin.sh`.

## Bất biến an toàn (KHÔNG được phá)

Nguyên tắc: **không đủ bằng chứng thì giữ nguyên process Roblox.** Chi tiết: `CODEX_FIX_AUTO_REJOIN_SAFETY.md`.

- Mọi force-stop phải đi qua `monitor_force_stop_package` → `monitor_recovery_is_authorized`.
  Gate chỉ cho phép khi: process đã chết, có disconnect/kick **mới** trong log phiên hiện tại,
  phiên ở `APP_HOME`, sai place đã xác nhận khác universe (`wrong_place`), hoặc `stalled_active`
  thỏa `monitor_stall_detected`.
- Không gọi `android_force_stop` / `am force-stop` trực tiếp ở chỗ mới. Ngoại lệ duy nhất:
  mode `"manual"` do người vận hành chủ động (ví dụ menu "dừng tất cả").
- Không restart định kỳ khi đang `IN_GAME` (`AUTO_RESTART_PERIOD` chỉ được log, không được kill).
- Mất mạng, mất focus cửa sổ, Roblox API 429, timeout → chuyển `UNKNOWN_ACTIVE` và quan sát, không kill.
- Kiểm tra sau khi sửa: `grep -rn "android_force_stop\|force-stop" lib auto_rejoin.sh bin`.

Kết nối ShopRoblox (`lib/worker.sh`, hướng dẫn: `HUONG_DAN_KET_NOI_SHOP.md`):

- Đơn xong → `worker_finish_order`: state `ORDER_DONE` (không rejoin; `monitor_tick` không làm gì) →
  `monitor_force_stop_package ... "manual"` (lệnh chủ động từ Shop/thợ) → `worker_clear_app_data` (`pm clear`).
- `pm clear` chỉ được gọi qua `worker_clear_app_data`: validate package + bắt buộc tên có `roblox`.
- Chỉ thoát `ORDER_DONE` bằng lệnh `RESUME` từ Shop (thợ gán đơn mới).
- Sau khi trả acc phải xoá `ORDER_ID` khỏi config (`worker_forget_order_in_config`); Shop cũng bỏ qua mã đơn đã xong
  bot tự báo. Nếu không, restart bot sau khi đăng nhập acc khách mới sẽ đăng xuất nhầm acc mới.
- Lỗi mạng / Shop không trả lời → không làm gì (cày tiếp). Không bao giờ dừng game vì không liên lạc được Shop.
- Token Shop chỉ đi qua stdin của curl (`-H @-`), không trên dòng lệnh, không vào log/Discord.

Tính năng **cố ý tắt**, không được bật lại: inject cookie đăng nhập, export `.ROBLOSECURITY`,
giải/bypass reCAPTCHA, bypass key Delta/X. Không lưu raw license key, mật khẩu hay cookie.

## Bất biến bảo mật license server (KHÔNG được phá)

Test: `server/tests/security.test.js`.

- Mọi endpoint làm đơn thành "đã thanh toán" phải xác thực nguồn: `/payments/webhook` qua
  `createWebhookAuthMiddleware` (`PAYMENT_WEBHOOK_SECRET`), PayOS qua chữ ký `checksumKey`.
- Token admin và khách hàng tách loại bằng claim `type` (`admin_access` / `customer_access`), kể cả khi secret trùng.
  Token mới thêm loại nào cũng phải có `type` và bên verify phải kiểm tra.
- License key thô chỉ trả cho người tạo đơn (`X-Payment-Token` = `payment_secret_token`) hoặc admin.
- So sánh secret bằng `safeEqualSecret` (`src/utils/crypto.js`), không dùng `===`.
- `payments.issued_raw_key` luôn ghi qua `PaymentService.sealIssuedKey` và đọc qua `revealIssuedKey`. Không đưa key
  đầy đủ vào log, Discord, Telegram.
- Rate limit là in-memory (express-rate-limit): server phải chạy **1 process** (`ecosystem.config.cjs`).
  Muốn scale ngang thì chuyển sang Redis store trước.
- Biến env bắt buộc mới phải thêm vào `.env.production.example`, `loadEnv()` (nếu bắt buộc ở production)
  và `scripts/verify-production-readiness.js`.

## Quy ước code

- Bash, `set -u` ở test; **không** dùng `set -e` trong lib (state machine dựa vào mã trả về).
- Hàm public có prefix theo module: `monitor_*`, `android_*`, `runtime_*`, `session_*`, `log_*`.
- Handler `monitor_handle_*` phải `return 0` tường minh ở cuối. Mã trả về ≠ 0 sẽ đẩy monitor sang `ERROR`.
- Log máy đọc: `log_event LEVEL event_name "$LOG_FILE" key value ...` (một dòng key="value").
  Log người đọc: `log_msg` (có màu, tiếng Việt). Mọi chuyển trạng thái dùng `monitor_transition`.
- Package name phải qua `android_validate_package` trước khi đưa vào lệnh shell.
- Giờ và sleep lấy qua `monitor_now` / `monitor_sleep` để test giả lập được (`MONITOR_NOW`, `MONITOR_SLEEP_FN`).
- Chuỗi hiển thị cho khách bằng tiếng Việt; event name và key log bằng tiếng Anh snake_case.

## Cách viết test

Mẫu: `tests/test_monitor.sh`. Source thẳng `lib/*.sh`, sau đó **định nghĩa lại** các hàm chạm thiết bị
(`is_roblox_running`, `android_force_stop`, `launch_roblox`, `check_internet`, ...) thành stub điều khiển
bằng biến (`RUNNING`, `DISCONNECT`, `APP_HOME`...). Đếm số lần gọi (`FORCE_STOP_COUNT`) và assert.
Mỗi bug sửa trong monitor phải có test chứng minh: trước khi sửa fail, sau khi sửa pass.

## Hành vi đáng chú ý

- `ERROR` không phải trạng thái cuối: `monitor_tick` đưa về `UNKNOWN_ACTIVE` (chỉ quan sát). Khi thêm
  state mới phải thêm nhánh vào `case` của `monitor_tick`, nếu không sẽ rơi vào `*)` → `ERROR`.
- Sai Place ID (`monitor_track_wrong_place`): chỉ rejoin khi thấy ở `WRONG_PLACE_CONFIRM_TICKS` tick liên tiếp
  **và** `monitor_place_universe_relation` xác nhận khác universe. Cùng universe = teleport hợp lệ.
  Không tra được universe = giữ nguyên. `check_roblox_log_for_wrong_place` chỉ phát hiện + đặt
  `WRONG_PLACE_OBSERVED`, không log/Discord.
- `setup.sh` cài nguyên khối: `resolve_install_ref` ghim ref → commit SHA, `install_snapshot` tải hết vào
  `tmp/setup-stage.*`, `bash -n` từng file, đủ mới thay. Thêm file vào bộ cài = sửa `SETUP_LIB_FILES`.
  Đừng ghi đè `setup.sh` đang chạy.
- Máy dev Windows có `core.autocrlf=true`: working copy có thể mang CRLF. `.gitattributes` ép LF cho script,
  `tests/test_script_hygiene.sh` và `scripts/build-release.sh` chặn CRLF. Kiểm tra CR bằng `tr -cd '\r'`,
  **không** dùng `grep $'\r'` (Git Bash bỏ qua `\r`).
- `tests/test_script_hygiene.sh` fail nếu `auto_rejoin.sh` định nghĩa trùng hàm hoặc ghi đè hàm của `lib/`,
  hoặc có lời gọi force-stop ngoài `lib/android.sh`/`lib/monitor.sh`.
- Repo chưa có tag/GitHub Release. `cloudflared.exe` đã bị gỡ khỏi git và nằm trong `.gitignore`
  (file vẫn ở máy dev). Tarball của commit mới không còn file này, nhưng `git clone` vẫn nặng vì lịch sử cũ còn giữ nó.
- `server/.env` có trên máy nhưng đã gitignore. Không đọc/in nội dung, không commit.

## Release

Theo `RELEASE_PROCESS.md`: bump `VERSION`, cập nhật `CHANGELOG.md`, `scripts/build-release.sh`,
ký manifest bằng private key **ngoài repo**. Không commit `*.private.pem`, `keys/private/`, `release/`.
