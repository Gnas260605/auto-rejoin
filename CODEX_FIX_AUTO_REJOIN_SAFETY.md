# CODEX IMPLEMENTATION TASK — Fix Auto Rejoin Safety for Roblox Multi-Instance

Repository: `https://github.com/Gnas260605/auto-rejoin.git`

## Vai trò

Bạn là Senior DevOps Engineer, Android Systems Engineer và Bash Code Reviewer. Hãy sửa trực tiếp dự án Auto Rejoin Roblox Multi-Instance chạy trên Android, Termux và UGPhone. Không chỉ phân tích hoặc viết kế hoạch: phải chỉnh code, bổ sung test, chạy test và báo cáo kết quả.

## Mục tiêu tuyệt đối

Tool chỉ được phép force-stop, restart hoặc rejoin package Roblox khi có ít nhất một bằng chứng hợp lệ sau:

1. Process của đúng package đã chết hoàn toàn: `is_roblox_running = false` dựa trên `pidof`, `pgrep` hoặc `ps`.
2. Có disconnect/kick thật sự trong phần log mới của phiên hiện tại, gồm các mã như 260–288, 524, 529, 773 hoặc chuỗi kick/server shutdown tương đương.
3. Package được xác nhận đã quay về màn hình chính Roblox: `APP_HOME`/`MainActivity`, với process còn sống và bằng chứng activity đủ tin cậy.

Nếu process còn sống, không có disconnect mới và không có `APP_HOME`, tool **tuyệt đối không được** force-stop/restart/rejoin, kể cả khi:

- cửa sổ không được focus hoặc không phải top activity;
- `dumpsys window` không nhìn thấy một clone;
- `is_in_game()` tạm thời trả false;
- hết `IN_GAME_TIMEOUT`;
- mạng ngoài Internet mất tạm thời;
- Roblox API bị 429/rate-limit;
- đến chu kỳ `AUTO_RESTART_PERIOD`;
- log hoặc trạng thái không đủ chắc chắn.

Nguyên tắc bắt buộc: **không đủ bằng chứng thì giữ nguyên process**.

## Phạm vi cần sửa

Kiểm tra và chỉnh ít nhất các file:

- `auto_rejoin.sh`
- `lib/monitor.sh`
- `lib/android.sh`
- `lib/runtime.sh`
- `lib/roblox_session.sh`
- `lib/session_evidence.sh` nếu có
- `setup.sh`
- các test trong `tests/`

Không phá vỡ license, updater, low-server selection, anti-AFK, Discord notification hoặc cơ chế multi-package lock hiện có.

## P0.1 — Tạo destructive recovery gate duy nhất

Tạo một hàm trung tâm, ví dụ:

```bash
monitor_recovery_is_authorized() {
    # return 0: được phép destructive recovery
    # return 1: phải bảo vệ process hiện tại
}
```

Hàm chỉ trả `0` khi xác nhận một trong ba trường hợp: process chết, disconnect/kick mới của phiên hiện tại, hoặc `APP_HOME`.

Ngay trước mọi lời gọi `android_force_stop`, phải tái kiểm tra gate này. Đây là kiểm tra tại thời điểm thực thi, không được chỉ dựa vào reason đã ghi trước khi backoff.

Nếu gate từ chối:

```bash
log_event WARN recovery_cancelled ... reason "active_session_protected"
```

Sau đó:

- không force-stop;
- không tăng rejoin count;
- không launch deep-link mới;
- chuyển về `IN_GAME` nếu session latch đã tồn tại;
- nếu chưa xác định được trạng thái, chuyển sang trạng thái bảo toàn như `UNKNOWN_ACTIVE` hoặc tiếp tục quan sát mà không phá process.

Không được có đường gọi `android_force_stop` nào nằm ngoài gate, ngoại trừ lệnh thủ công có xác nhận rõ ràng của người vận hành. Dùng `rg` để kiểm tra toàn repo.

## P0.2 — Loại bỏ restart định kỳ khi đang chơi

Trong `monitor_handle_in_game()`, không được gọi recovery vì `AUTO_RESTART_PERIOD` khi game đang ổn định.

Yêu cầu:

- mặc định và cấu hình production phải là `AUTO_RESTART_PERIOD=0`;
- tốt nhất loại bỏ nhánh periodic restart khỏi monitor tự động;
- nếu giữ khả năng tương thích config, chỉ log cảnh báo rằng tính năng đã bị vô hiệu hóa bởi safety policy;
- không được force-stop một phiên `IN_GAME` vì thời gian chạy.

## P0.3 — Sửa timeout loading

`IN_GAME_TIMEOUT` không phải bằng chứng cho phép force-stop.

Khi timeout mà process vẫn sống:

- kiểm tra disconnect mới;
- kiểm tra `APP_HOME`;
- nếu không có hai bằng chứng này thì giữ nguyên process;
- ghi trạng thái `loading_timeout_unconfirmed` hoặc `unknown_active`;
- tiếp tục quan sát với tần suất hợp lý;
- không tăng failure/rejoin count.

Queue chỉ được phép đổi server nếu queue được xác nhận từ dữ liệu mới của phiên hiện tại. Không được xem việc không tìm thấy `GameActivity` là queue hay disconnect.

## P0.4 — Tích hợp session log parser incremental thật sự

`lib/roblox_session.sh` hiện phải được nối vào runtime chính:

1. Source library từ `auto_rejoin.sh` trước monitor.
2. `setup.sh` phải tải/cài:
   - `roblox_session.sh`
   - `session_evidence.sh` nếu runtime sử dụng
   - `roblox_api.sh` nếu thành phần khác phụ thuộc vào nó.
3. Khi chuẩn bị launch một phiên mới, gọi `session_begin "$ROBLOX_PACKAGE" "$PLACE_ID"`.
4. Trong mỗi monitor tick, poll phần log mới đúng một lần hoặc theo cơ chế đồng bộ an toàn.
5. `check_roblox_log_for_disconnect`, game-ready và wrong-place phải đọc evidence của session parser thay vì `tail -n` cố định.

### Snapshot offset tại launch

Không reset offset về `0` nếu file log hiện tại đã tồn tại. Tại `session_begin`, lưu:

- đường dẫn log hiện tại;
- inode hiện tại;
- size hiện tại làm offset ban đầu;
- thời điểm bắt đầu session.

Chỉ parse byte được append sau offset đó. Nếu file mới xuất hiện sau launch, bắt đầu từ byte 0 của file mới. Nếu inode đổi hoặc file bị truncate, xử lý rotation nhưng không được vô tình đọc lại file cũ.

Mỗi package phải có cursor/session directory riêng. Việc chạy tám clone đồng thời không được dùng chung offset.

### Disconnect evidence

Chỉ đánh dấu disconnect khi dòng mới của session hiện tại match tín hiệu chắc chắn, ví dụ:

- `lost connection to the game`
- `disconnected from server`
- `you have been kicked`
- `same account launched`
- `server was shut down`
- error code 260–288, 524, 529, 773 theo regex có boundary rõ ràng.

Không dùng các chuỗi quá rộng như `unknown status` hoặc `failed to connect` làm bằng chứng destructive độc lập, trừ khi có thêm context chứng minh đây là game-session disconnect.

## P0.5 — Giữ Session Continuity Latch an toàn

Giữ nguyên ý nghĩa bảo vệ của `LAST_IN_GAME`, nhưng chuẩn hóa thành latch theo từng process/session.

Latch chỉ bị xóa khi:

- PID/process identity của package đã chết hoặc thay đổi;
- disconnect/kick mới được xác nhận;
- `APP_HOME` được xác nhận;
- bắt đầu một launch transaction mới đã được recovery gate cho phép.

Không xóa latch chỉ vì:

- activity không được resumed;
- package không xuất hiện trong top window;
- freeform window nằm sau cửa sổ khác;
- executor overlay/hack menu đang được mở;
- một lần đọc dumpsys thất bại.

Sau khi latch tồn tại, `IN_GAME_TIMEOUT` không được kích hoạt cho phiên đó.

## P0.6 — Process detection phải độc lập với task/window

Sửa `is_roblox_running()` và Android wrappers để process liveness dựa trên process thật:

- `pidof <package>`;
- fallback `pgrep` với exact package/process pattern;
- fallback parse `ps` có boundary chính xác.

Không được coi các dữ liệu sau là bằng chứng process sống:

- `ActivityRecord` cũ;
- task trong recents;
- window record còn sót;
- package xuất hiện trong shared dumpsys snapshot.

Task/window chỉ dùng để phân loại UI, không dùng thay process detection.

## P0.7 — Multi-instance Freeform / UGPhone

Không dùng `dumpsys activity top` hoặc focused window để kết luận bảy clone còn lại đã đóng.

Quy tắc:

- `android_has_window_record` được dùng như evidence hỗ trợ, không phải điều kiện destructive;
- thiếu window record khi process sống chỉ tạo trạng thái `window_visibility_unknown`;
- nếu `LAST_IN_GAME > 0`, process sống và không có disconnect/Home thì luôn bảo vệ phiên;
- nếu muốn đưa UI trở lại, chỉ được thử non-destructive foreground/reopen không dùng `-S`, clear task hoặc force-stop;
- không được gọi recovery `window_closed` chỉ vì package không phải top/focused window.

## P0.8 — Backoff và circuit breaker

Giữ exponential backoff/cooldown hiện có nhưng sửa semantics:

- chỉ record recovery failure sau một recovery thực sự thất bại;
- các lần recovery bị safety gate hủy không tính là failure;
- mất mạng không force-stop process đang sống;
- Roblox API 429 không force-stop game; giữ phiên hiện tại và backoff API riêng;
- sau thời gian backoff, phải đánh giá lại recovery gate;
- cooldown state không được kết thúc bằng force-stop nếu bằng chứng ban đầu đã hết hiệu lực.

Đảm bảo state không lặp `RECOVERING -> force-stop -> launch -> fail` vô hạn.

## P1 — Launch verification

Không xem exit code `0` của `am start` là bằng chứng đã vào game. Phân biệt:

- intent accepted;
- process started;
- server connecting;
- `GAME_READY`.

Tuy nhiên, launch verification thất bại khi process cũ vẫn đang sống cũng không tự cấp quyền force-stop. Mọi destructive retry vẫn phải qua recovery gate.

## Tests bắt buộc

Bổ sung test bằng Bash mocks/fixtures. Test phải kiểm tra số lần gọi `android_force_stop`, `launch_roblox` và `inc_rejoin_count`.

### Nhóm bảo vệ IN_GAME

1. Process sống + `LAST_IN_GAME > 0` + không disconnect + không Home ⇒ force-stop = 0.
2. Process sống + không phải top activity ⇒ force-stop = 0.
3. Process sống + không có window record ⇒ force-stop = 0.
4. Process sống + executor overlay đang top ⇒ force-stop = 0.
5. Process sống + `IN_GAME_TIMEOUT` hết ⇒ force-stop = 0 nếu không có evidence khác.
6. Process sống + `AUTO_RESTART_PERIOD` hết ⇒ force-stop = 0.
7. Mất Internet nhưng process sống ⇒ force-stop = 0.
8. Roblox API trả 429 nhưng process sống ⇒ force-stop = 0.

### Nhóm recovery hợp lệ

9. Process chết ⇒ cho phép launch/rejoin.
10. Process sống + disconnect mới của current session ⇒ force-stop đúng một lần rồi launch.
11. Process sống + kick mới ⇒ force-stop đúng một lần.
12. Process sống + confirmed `APP_HOME` ⇒ force-stop/rejoin theo policy đã chọn.
13. Disconnect evidence biến mất trong thời gian backoff ⇒ recovery bị hủy, force-stop = 0.

### Nhóm stale log

14. File log có error 279 cũ trước launch, sau launch chỉ append heartbeat ⇒ không disconnect.
15. File log có error 279 append sau launch ⇒ disconnect.
16. Cùng file/inode giữa hai phiên ⇒ phiên mới không đọc lại lỗi phiên cũ.
17. Log rotate sang inode mới ⇒ chỉ xử lý file mới đúng một lần.
18. Log truncate ⇒ cursor phục hồi an toàn, không lặp event cũ.

### Nhóm multi-instance

19. Tám package có tám cursor riêng, event của clone A không ảnh hưởng clone B.
20. Chỉ clone A focused; B–H process sống và latched ⇒ không clone nào B–H bị recovery.
21. Hai monitor cùng package ⇒ package lock chỉ cho một monitor điều khiển.

### Nhóm state machine

22. `IN_GAME -> visibility unknown -> IN_GAME` không đi qua `RECOVERING`.
23. `IN_GAME -> DISCONNECTED -> RECOVERING` chỉ xảy ra với fresh evidence.
24. `LOADING -> timeout unconfirmed` không gọi force-stop.
25. Rejoin count chỉ tăng khi destructive recovery được gate cho phép.

## Kiểm tra chất lượng

Chạy tối thiểu:

```bash
bash -n auto_rejoin.sh setup.sh lib/*.sh tests/*.sh
shellcheck auto_rejoin.sh setup.sh lib/*.sh tests/*.sh
bash tests/test_runtime.sh
bash tests/test_monitor.sh
bash tests/test_android.sh
bash tests/test_android_visibility.sh
bash tests/test_roblox_session.sh
```

Nếu repo có test runner chung, chạy thêm toàn bộ test suite. Không được bỏ qua test lỗi; nếu thiết bị thật mới chạy được thì ghi rõ test nào đang `REAL_DEVICE_PENDING`.

Dùng lệnh sau để chứng minh không còn force-stop ngoài gate:

```bash
rg -n "android_force_stop|am[[:space:]]+force-stop|force-stop" . \
  -g '*.sh' -g '!tests/fixtures/**'
```

## Tiêu chí nghiệm thu

Chỉ báo hoàn thành khi tất cả điều kiện sau đúng:

- Không có automatic periodic restart khi đang IN_GAME.
- Timeout/visibility uncertainty không force-stop process đang sống.
- Mọi destructive recovery đi qua một gate duy nhất.
- Gate tái kiểm tra evidence ngay trước force-stop.
- Disconnect parser chỉ đọc dữ liệu mới của current session.
- Session offset tách riêng theo package.
- `setup.sh` cài đủ library runtime thực sự sử dụng.
- Toàn bộ automated tests pass.
- Có test bảo vệ tám clone freeform.
- Không làm hỏng các chức năng license, low-server, updater và anti-AFK.

## Báo cáo cuối cùng Codex phải trả về

1. Tóm tắt nguyên nhân gốc.
2. Danh sách file đã sửa.
3. Mô tả recovery gate và invariant bảo vệ IN_GAME.
4. Danh sách test đã thêm.
5. Kết quả từng lệnh test.
6. Kết quả tìm toàn repo đối với `force-stop`.
7. Những kiểm tra còn cần chạy trên UGPhone thật.
8. Commit hash hoặc diff summary.

Không tự tuyên bố “production ready” nếu chưa chạy kiểm thử real-device cho ít nhất các tình huống: tám freeform windows, đóng một clone, kill process, disconnect thật, kick thật, APP_HOME và stale log.
