# AUTO REJOIN PRO V2 — ROBLOX API INTEGRATION & SESSION WATCHDOG PLAN

**Repository:** `Gnas260605/auto-rejoin`  
**Baseline inspected:** `main` at commit `a22521256f4d4fbc2b642f35f607859b08480173`  
**Primary monitor fix commit:** `c6372b2fb1cf332e5d229e84f615b524dc210366`  
**Target environment:** Android / UGPhone / Termux / root (`su`) / ADB / nhiều Roblox clone  
**Document goal:** Nâng Auto Rejoin từ process watcher thành **Roblox Session Watchdog** có xác minh trạng thái bằng dữ liệu local + Roblox public APIs.

---

# 1. Mục tiêu

Tool phải xử lý ổn định các trường hợp:

1. Roblox process chết.
2. Freeform/tab/window bị đóng nhưng process vẫn còn nền.
3. Roblox mở nhưng đang ở Home.
4. Roblox đang ở lobby/loading quá lâu.
5. Roblox đang queue.
6. Roblox disconnect/kick/server shutdown.
7. Roblox vào sai Place ID.
8. Game có nhiều Place trong cùng Universe:
   - start place;
   - lobby;
   - matchmaking;
   - gameplay;
   - dungeon/sub-place.
9. Deep-link trả exit code `0` nhưng Roblox thực tế không mở.
10. Nhiều clone chạy đồng thời mà không restart nhầm package.
11. Roblox API lỗi, timeout hoặc rate-limit nhưng tool vẫn tiếp tục hoạt động bằng local signals.
12. Mạng mất rồi có lại.
13. Monitor process bị treo nhưng PID vẫn tồn tại.

Nguyên tắc:

> **Không có một tín hiệu đơn lẻ nào được phép đại diện cho toàn bộ trạng thái Roblox.**

Ví dụ tuyệt đối không dùng:

```text
process alive = IN_GAME
task exists = window visible
am start exit 0 = launch succeeded
Joining game log = GAME_ACTIVE
Presence API says InGame = local client healthy
```

---

# 2. Kiến trúc mục tiêu

```text
┌──────────────────────────────────────────────────────────────┐
│                     ROBLOX SESSION WATCHDOG                  │
└──────────────────────────────────────────────────────────────┘

             Android Local Signals
        ┌────────┬────────┬────────────┐
        │Process │ Task   │ Window/UI  │
        └───┬────┴───┬────┴─────┬──────┘
            │        │          │
            └────────┼──────────┘
                     ▼
              Session Log Parser
                     │
                     ▼
         Roblox Public API Providers
      ┌──────────┬───────────┬──────────┐
      │ Presence │ Universe  │ Servers  │
      │ Users    │ Game Info │ Job IDs  │
      └────┬─────┴────┬──────┴────┬─────┘
           └──────────┼───────────┘
                      ▼
             Session Evidence Engine
                      │
                      ▼
               Session State Machine
                      │
      ┌───────────────┼────────────────────┐
      ▼               ▼                    ▼
 GAME_ACTIVE       APP_HOME           WINDOW_CLOSED
 JOINING           LOBBY              PROCESS_DEAD
 QUEUE             TELEPORTING        DISCONNECTED
 LOADING           WRONG_PLACE        SESSION_STALLED
      └───────────────┼────────────────────┘
                      ▼
                Recovery Engine
                      │
                      ▼
              Verified Launch Flow
```

---

# 3. Nguyên tắc sử dụng Roblox API

## 3.1 API chỉ là nguồn evidence bổ sung

Roblox API **không được là nguồn duy nhất** quyết định trạng thái.

Thứ tự ưu tiên:

```text
1. Local Android process/task/window
2. Roblox log của đúng session hiện tại
3. Place ID / Job ID lấy từ local log
4. Roblox Presence API
5. Roblox Game/Universe API
6. Public server API
```

Nếu Roblox API lỗi:

```text
API_DOWN
    ↓
không crash monitor
    ↓
dùng local evidence
    ↓
cache dữ liệu cũ nếu còn TTL hợp lệ
```

---

# 4. Roblox APIs sử dụng

## 4.1 Place ID → Universe ID

Endpoint:

```text
GET https://apis.roblox.com/universes/v1/places/{PLACE_ID}/universe
```

Ví dụ response:

```json
{
  "universeId": 1234567890
}
```

### Dùng để

- xác minh Place thuộc Universe nào;
- lấy metadata game;
- xác định lobby/sub-place có cùng Universe hay không;
- cache Universe ID;
- phục vụ dashboard/log.

### Cache

```text
TTL: 24 giờ
```

Universe của một Place hầu như không thay đổi, nên không cần request liên tục.

---

## 4.2 Universe → Game metadata

Endpoint:

```text
GET https://games.roblox.com/v1/games?universeIds={UNIVERSE_ID}
```

Dữ liệu hữu ích có thể gồm:

```text
id
rootPlaceId
name
description
creator
playing
visits
maxPlayers
created
updated
```

### Dùng để

- game name;
- rootPlaceId;
- maxPlayers;
- dashboard;
- xác minh root place;
- cấu hình auto transit-place.

### Cache

```text
TTL: 10 phút
```

Không dùng endpoint này trong mỗi monitor tick.

---

## 4.3 Public Server List

Endpoint đã được tool hiện tại sử dụng:

```text
GET https://games.roblox.com/v1/games/{PLACE_ID}/servers/Public
    ?sortOrder=Asc
    &limit=100
    &excludeFullGames=true
```

Response quan trọng:

```json
{
  "previousPageCursor": null,
  "nextPageCursor": "...",
  "data": [
    {
      "id": "JOB_ID",
      "maxPlayers": 12,
      "playing": 3,
      "playerTokens": [],
      "players": [],
      "fps": 59.9,
      "ping": 90
    }
  ]
}
```

### Dùng để

- Low Server;
- rotate Job ID khi lobby/queue lỗi;
- tránh server vừa fail;
- ưu tiên server ít người;
- ưu tiên ping thấp khi dữ liệu có sẵn.

### Không được giả định

```text
API trả toàn bộ tất cả server của Place
```

Server API có pagination và có thể có giới hạn/thay đổi từ Roblox.

### Thuật toán chọn server

Score gợi ý:

```text
score =
    playing * 100
  + ping
  + recent_failure_penalty
  + same_job_penalty
```

Trong đó:

```text
recent_failure_penalty = 10000
same_job_penalty       = 50000
```

Server vừa fail không được chọn lại ngay.

---

## 4.4 User Presence

Endpoint:

```text
POST https://presence.roblox.com/v1/presence/users
Content-Type: application/json
```

Payload:

```json
{
  "userIds": [123456789]
}
```

Response thường có:

```json
{
  "userPresences": [
    {
      "userPresenceType": 2,
      "lastLocation": "Game Name",
      "placeId": 123456789,
      "rootPlaceId": 123456789,
      "gameId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "universeId": 987654321,
      "userId": 123456789,
      "lastOnline": "..."
    }
  ]
}
```

Presence type:

```text
0 = Offline
1 = Online
2 = InGame
3 = InStudio
```

Không hard-code trạng thái ngoài các giá trị Roblox thực tế trả về nếu chưa được kiểm chứng.

### Vai trò trong Auto Rejoin

Presence chỉ là **secondary evidence**.

Ví dụ:

```text
LOCAL:
process=true
window=true

PRESENCE:
userPresenceType=2
placeId=TARGET_PLACE_ID

=> confidence tăng mạnh
```

Nhưng:

```text
Presence placeId = null
```

không được kết luận chắc chắn user không trong game.

Privacy settings có thể khiến:

```text
placeId
rootPlaceId
gameId
universeId
```

bị `null`.

### Không được

- yêu cầu `.ROBLOSECURITY` để tool hoạt động;
- lưu Roblox cookie trong config;
- gửi cookie vào server license;
- log cookie;
- phụ thuộc cookie để rejoin.

Public/anonymous Presence chỉ được dùng khi dữ liệu Roblox cho phép hiển thị.

### Cache

```text
TTL: 15–30 giây
```

Không gọi Presence mỗi monitor tick nếu có nhiều clone.

---

# 4.5 Username → User ID

Endpoint:

```text
POST https://users.roblox.com/v1/usernames/users
Content-Type: application/json
```

Payload:

```json
{
  "usernames": ["builderman"],
  "excludeBannedUsers": false
}
```

Dùng để:

```text
ROBLOX_USERNAME
      ↓
ROBLOX_USER_ID
      ↓
Presence API
```

### Cache

```text
TTL: 24 giờ
```

Có thể lưu User ID vào config sau lần resolve thành công.

---

# 4.6 User IDs → User profile

Endpoint:

```text
POST https://users.roblox.com/v1/users
```

Dùng khi cần:

- canonical username;
- display name;
- validate user ID.

Không cần gọi thường xuyên.

---

# 4.7 Optional thumbnail API

Chỉ dùng cho dashboard/admin UI:

```text
GET https://thumbnails.roblox.com/v1/users/avatar-headshot
GET https://thumbnails.roblox.com/v1/games/icons
GET https://thumbnails.roblox.com/v1/places/gameicons
```

Không đưa thumbnail API vào monitor loop.

---

# 5. Không dùng API nào làm critical dependency

Các API sau chỉ là optional provider:

```text
presence.roblox.com
games.roblox.com
users.roblox.com
apis.roblox.com
thumbnails.roblox.com
```

Monitor phải tiếp tục hoạt động khi:

```text
HTTP 429
HTTP 500
HTTP 502
HTTP 503
DNS error
timeout
TLS/network failure
invalid JSON
empty body
schema changed
```

---

# 6. Module mới đề xuất

```text
lib/
├── android.sh
├── config.sh
├── monitor.sh
├── network.sh
├── roblox.sh
├── roblox_api.sh          NEW
├── roblox_session.sh      NEW
├── session_evidence.sh    NEW
├── runtime.sh
└── ...
```

---

# 7. `lib/roblox_api.sh`

Module này chịu trách nhiệm duy nhất:

```text
HTTP
JSON parsing
cache
rate-limit
schema validation
Roblox API fallback
```

Không chứa state machine.

## Public functions

```bash
roblox_api_place_to_universe PLACE_ID

roblox_api_get_game UNIVERSE_ID

roblox_api_get_public_servers PLACE_ID [CURSOR]

roblox_api_pick_server PLACE_ID SLOT_INDEX

roblox_api_resolve_username USERNAME

roblox_api_get_presence USER_ID

roblox_api_is_available PROVIDER
```

---

# 8. HTTP wrapper chung

Không gọi `curl` rải rác trong code.

Tạo:

```bash
roblox_http_get()
roblox_http_post_json()
```

Ví dụ thiết kế:

```bash
roblox_http_get() {
    local url="$1"
    local connect_timeout="${ROBLOX_API_CONNECT_TIMEOUT:-4}"
    local max_time="${ROBLOX_API_MAX_TIME:-8}"

    curl \
        --silent \
        --show-error \
        --location \
        --connect-timeout "$connect_timeout" \
        --max-time "$max_time" \
        --retry 1 \
        --retry-delay 1 \
        --header "Accept: application/json" \
        --header "User-Agent: Auto-Rejoin-Pro/2" \
        "$url"
}
```

Không retry vô hạn.

---

# 9. API Circuit Breaker

Mỗi provider có trạng thái riêng.

Ví dụ:

```text
games.roblox.com
failure_count=0
disabled_until=0

presence.roblox.com
failure_count=0
disabled_until=0
```

Nếu:

```text
3 failure liên tiếp
```

thì:

```text
disable provider trong 60 giây
```

Sau đó thử lại.

Không để Roblox API lỗi làm monitor tick chậm 30–60 giây.

---

# 10. Cache

Directory:

```text
tmp/api-cache/
```

Ví dụ:

```text
place_123_universe.json
universe_456_game.json
user_builderman.json
presence_789.json
servers_123_page1.json
```

Metadata:

```json
{
  "cachedAt": 1789690000,
  "expiresAt": 1789690060,
  "status": 200,
  "data": {}
}
```

### TTL đề xuất

| Data | TTL |
|---|---:|
| Place → Universe | 24h |
| Username → User ID | 24h |
| Game metadata | 10m |
| Presence | 20s |
| Public server list | 10–20s |
| Game icon | 1h |

---

# 11. `lib/roblox_session.sh`

Module quản lý **session hiện tại của từng clone**.

Không dùng global log cũ làm bằng chứng cho session mới.

## Session object logic

Bash có thể lưu các biến:

```bash
SESSION_ID=""
SESSION_GENERATION=0
SESSION_PID=""
SESSION_STARTED_AT=0

SESSION_LOG_FILE=""
SESSION_LOG_INODE=""
SESSION_LOG_OFFSET=0

SESSION_CURRENT_PLACE_ID=""
SESSION_CURRENT_JOB_ID=""
SESSION_CURRENT_UNIVERSE_ID=""

SESSION_LAST_EVENT=""
SESSION_LAST_EVENT_AT=0
```

Khi launch mới:

```bash
session_begin() {
    SESSION_GENERATION=$((SESSION_GENERATION + 1))
    SESSION_ID="${ROBLOX_PACKAGE}_$(date +%s)_${SESSION_GENERATION}"

    SESSION_PID=""
    SESSION_STARTED_AT="$(date +%s)"

    SESSION_LOG_FILE=""
    SESSION_LOG_INODE=""
    SESSION_LOG_OFFSET=0

    SESSION_CURRENT_PLACE_ID=""
    SESSION_CURRENT_JOB_ID=""
    SESSION_LAST_EVENT="LAUNCH_STARTED"
}
```

---

# 12. Incremental Roblox log parser

Không dùng:

```bash
tail -n 80 log
```

để quyết định toàn bộ session.

Thay bằng:

```text
log inode + byte offset
```

Flow:

```text
latest log
   ↓
inode changed?
   ├─ YES → new log → offset=0
   └─ NO
       ↓
read only bytes after SESSION_LOG_OFFSET
       ↓
parse events
       ↓
update offset
```

## Event cần parse

```text
JOIN_STARTED
SERVER_CONNECTING
SERVER_CONNECTED
REPLICATION_READY
GAME_READY

TELEPORT_STARTED
TELEPORT_SUCCEEDED
TELEPORT_FAILED

PLACE_OBSERVED
JOB_OBSERVED

DISCONNECTED
KICKED
SERVER_SHUTDOWN

CLIENT_CRASH_HINT
```

### Không được

```text
"Joining game" => GAME_ACTIVE
```

Đây chỉ là:

```text
JOIN_STARTED
```

---

# 13. Session Evidence Object

Mỗi monitor tick tạo evidence:

```text
process_alive
task_present
window_record_present
window_visible
window_focused
resumed_activity

local_place_id
local_job_id

log_join_started
log_game_ready
log_disconnect

api_presence_type
api_place_id
api_universe_id
api_game_id

expected_place_id
expected_universe_id

network_online
```

---

# 14. Session Confidence

Có thể dùng score nội bộ để tránh false positive.

Ví dụ:

```text
process alive                     +10
task exists                       +10
visible surface/window            +20
resumed gameplay activity         +20
session log GAME_READY            +30
local expected Place ID           +35
Presence InGame                   +10
Presence expected Place ID        +20

window missing                    -50
process dead                      -100
disconnect log                    -100
wrong universe                    -60
wrong Place ID                    -40
```

Rule quan trọng:

```text
GAME_ACTIVE không chỉ dựa vào score.
```

Vẫn phải có minimum requirements:

```text
process_alive=true

AND

(
    visible_window=true
    OR valid_background_mode=true
)

AND

(
    log_game_ready=true
    OR strong_gameplay_activity=true
)

AND

Place validation không fail
```

---

# 15. State machine mới

```text
STOPPED
   ↓
LAUNCHING
   ↓
WAIT_PROCESS
   ↓
WAIT_TASK
   ↓
WAIT_WINDOW
   ↓
JOINING
   ↓
LOADING
   ↓
VERIFY_PLACE
   ↓
GAME_ACTIVE
```

Error states:

```text
PROCESS_DEAD
WINDOW_CLOSED
APP_HOME
QUEUE
LOBBY
TELEPORTING
WRONG_PLACE
DISCONNECTED
SESSION_STALLED
API_DEGRADED
OFFLINE
```

Recovery:

```text
RECOVERING
    ↓
BACKOFF
    ↓
LAUNCHING
```

---

# 16. Window detection phải sửa

Hiện tại không được dùng:

```text
window missing
+
task exists
=
window visible
```

Phải tách:

```bash
android_has_window_record
android_is_window_surface_visible
android_is_window_focused
android_is_task_present
android_is_process_running
```

## `WINDOW_CLOSED`

Condition:

```text
process_alive=true
AND
window_visible=false
AND
window_focused=false
AND
window_missing_count >= threshold
```

`task_present=true` không được override kết luận này.

---

# 17. Shared Android Snapshot Collector

Không cho 10 clone gọi `dumpsys` riêng.

Watchdog/snapshot process:

```text
every 3–5 seconds:
    dumpsys activity activities
    dumpsys activity top
    dumpsys window windows
```

Lưu:

```text
tmp/android-snapshot/
├── activities.txt
├── activity_top.txt
├── windows.txt
└── timestamp
```

Monitor clone chỉ parse snapshot.

Nếu snapshot quá cũ:

```text
age > 15s
```

mới fallback gọi trực tiếp.

---

# 18. Verified Launch Transaction

`launch_roblox()` hiện không được coi `am start=0` là success cuối cùng.

Tách thành:

```bash
roblox_launch_send_intent
roblox_launch_wait_process
roblox_launch_wait_task
roblox_launch_wait_window
roblox_launch_wait_join
roblox_launch_verify_place
roblox_launch_verify_stable
```

Flow:

```text
SEND_INTENT
    ↓
PROCESS started?          timeout 10s
    ↓
TASK exists?              timeout 10s
    ↓
WINDOW visible?           timeout 15s
    ↓
JOIN event?               timeout 60s
    ↓
PLACE valid?              timeout 90s
    ↓
stable for 10–20s
    ↓
LAUNCH_CONFIRMED
```

Failure reason phải rõ:

```text
launch_intent_failed
launch_no_process
launch_no_task
launch_no_window
launch_no_join
launch_wrong_place
launch_session_stalled
```

---

# 19. Roblox Presence trong Verified Launch

Presence chỉ hỗ trợ xác nhận thêm:

```text
local log = GAME_READY
presence = InGame
presence.placeId = target

=> very strong confirmation
```

Nhưng nếu:

```text
presence.placeId = null
```

thì:

```text
UNKNOWN
```

không phải failure.

---

# 20. Place / Universe validation

## Config mới

```bash
TARGET_PLACE_ID="123"

EXPECTED_UNIVERSE_ID=""

TRANSIT_PLACE_IDS="111,222"
ALLOWED_GAME_PLACE_IDS="123,333,444"

AUTO_DISCOVER_UNIVERSE=true
STRICT_PLACE_VALIDATION=false
```

Nếu `EXPECTED_UNIVERSE_ID` trống:

```text
TARGET_PLACE_ID
    ↓
Place→Universe API
    ↓
cache universeId
```

---

# 21. Transit Place logic

Ví dụ:

```text
Universe 999
├── 111 Lobby
├── 222 Matchmaking
├── 333 Main Gameplay
└── 444 Dungeon
```

Config:

```bash
TARGET_PLACE_ID=333
TRANSIT_PLACE_IDS="111,222"
ALLOWED_GAME_PLACE_IDS="333,444"
```

Rules:

```text
111:
LOBBY

222:
TELEPORTING / MATCHMAKING

333:
GAME_ACTIVE

444:
GAME_ACTIVE
```

Không force-stop ngay khi thấy `111` hoặc `222`.

---

# 22. Auto-discover same-Universe Place

Optional feature:

Nếu observed Place ID khác target:

```text
observedPlace
    ↓
Place→Universe API
    ↓
same universe?
```

Nếu khác Universe:

```text
WRONG_PLACE
```

Nếu cùng Universe:

```text
POSSIBLE_TRANSIT_PLACE
```

Sau đó chờ:

```text
TRANSIT_TIMEOUT
```

trước khi recovery.

### Lợi ích

Không cần người dùng manually nhập toàn bộ sub-place ngay từ đầu.

---

# 23. Public Server Selector V2

File hiện tại đã có:

```bash
roblox_fetch_public_servers
roblox_pick_low_server
```

Giữ lại nhưng nâng cấp.

## Server Candidate

```json
{
  "jobId": "...",
  "playing": 2,
  "maxPlayers": 12,
  "ping": 80,
  "score": 280,
  "lastFailure": 0
}
```

## Recent failed jobs

Per clone:

```text
tmp/runtime/{package}/failed_jobs
```

Ví dụ:

```text
jobA|1789690000
jobB|1789690020
```

TTL:

```text
5 phút
```

Không chọn server vừa gây:

```text
queue
join timeout
disconnect < 30s
server shutdown
```

---

# 24. Pagination

Function:

```bash
roblox_api_get_public_servers_page PLACE_ID CURSOR
```

Low-server selector không nhất thiết quét toàn bộ server.

Giới hạn:

```text
MAX_SERVER_PAGES=3
```

Tức tối đa khoảng:

```text
300 candidates
```

để tránh:

```text
rate limit
latency
CPU
```

Nếu đủ candidate tốt thì dừng sớm.

---

# 25. Server selection strategy

Ưu tiên:

```text
1. not full
2. not recently failed
3. not current Job ID
4. playing >= LOW_SERVER_MIN_PLAYERS
5. playing <= LOW_SERVER_MAX_PLAYERS
6. thấp players
7. thấp ping
```

Không cần chọn server `0 player` nếu:

```bash
LOW_SERVER_MIN_PLAYERS=1
```

---

# 26. Recovery Engine V2

Không phải failure nào cũng force-stop ngay.

## Level 1 — Soft recovery

```text
APP_HOME
JOINING_STALLED
```

Action:

```text
resend scoped deep-link
```

Không kill app.

## Level 2 — Task recovery

```text
task background
window not focused
```

Action:

```text
bring task foreground
resend deep-link
```

## Level 3 — Fresh process

```text
WINDOW_CLOSED
DISCONNECTED
PROCESS_DEAD
```

Action:

```text
force-stop
wait
fresh launch
```

## Level 4 — Rotate server

```text
QUEUE
LOBBY_TIMEOUT
FAST_DISCONNECT
```

Action:

```text
mark Job ID failed
select another Job ID
fresh launch
```

## Level 5 — Cooldown

```text
too many failures
Roblox/API/network unstable
```

Action:

```text
exponential backoff
circuit breaker
```

---

# 27. Exponential backoff

Giữ runtime hiện tại:

```text
5
10
20
40
60
60
...
```

Thêm jitter:

```text
0–5 giây
```

để nhiều clone không restart cùng lúc.

---

# 28. Multi-clone stagger

Ví dụ package slot:

```text
clone 0 → +0s
clone 1 → +2s
clone 2 → +4s
clone 3 → +6s
clone 4 → +8s
```

Khi mạng vừa khôi phục:

```text
không launch tất cả clone cùng lúc
```

---

# 29. Network Gate

Trước recovery launch:

```text
network_online?
```

Nếu false:

```text
OFFLINE
```

Không gọi:

```text
Roblox API
server API
deep-link retry liên tục
```

Khi mạng có lại:

```text
NETWORK_RESTORED
    ↓
stagger
    ↓
API cache refresh
    ↓
launch
```

---

# 30. API concurrency

Nếu chạy 10 clone:

Không cho:

```text
10 clone
× Presence
× Game API
× Server API
```

cùng lúc.

Tạo API lock/shared cache.

Ví dụ:

```text
tmp/api-locks/
```

Và:

```bash
ROBLOX_API_MAX_CONCURRENCY=3
```

Bash có thể dùng:

```text
flock
```

hoặc lock directory fallback.

---

# 31. Presence batching

Presence API nhận nhiều user IDs.

Thay vì:

```text
10 clone = 10 requests
```

watchdog/API collector có thể:

```json
{
  "userIds": [
    111,
    222,
    333,
    444
  ]
}
```

Một request:

```text
→ cache presence từng user
```

Rất phù hợp multi-clone.

---

# 32. Username resolve chỉ chạy khi cần

Khi config có:

```bash
ROBLOX_USERNAME="SandG"
ROBLOX_USER_ID=""
```

startup:

```text
username
    ↓
users API
    ↓
user ID
    ↓
cache
```

Nếu có `ROBLOX_USER_ID` rồi:

```text
không resolve lại
```

---

# 33. Config đề xuất

```bash
# Core
PLACE_ID="123456789"
ROBLOX_PACKAGE="com.roblox.client"

# User
ROBLOX_USERNAME=""
ROBLOX_USER_ID=""

# API
ROBLOX_API_ENABLED=true
ROBLOX_API_CONNECT_TIMEOUT=4
ROBLOX_API_MAX_TIME=8
ROBLOX_API_CACHE_ENABLED=true
ROBLOX_API_MAX_CONCURRENCY=3

# Presence
PRESENCE_ENABLED=true
PRESENCE_INTERVAL=20

# Game validation
AUTO_DISCOVER_UNIVERSE=true
EXPECTED_UNIVERSE_ID=""
STRICT_PLACE_VALIDATION=false

TRANSIT_PLACE_IDS=""
ALLOWED_GAME_PLACE_IDS=""

TRANSIT_TIMEOUT=120
LOBBY_TIMEOUT=120
QUEUE_TIMEOUT=30

# Window
WINDOW_REOPEN_ENABLED=true
WINDOW_MISSING_THRESHOLD=3
ANDROID_SNAPSHOT_INTERVAL=5
ANDROID_SNAPSHOT_MAX_AGE=15

# Launch
LAUNCH_PROCESS_TIMEOUT=10
LAUNCH_TASK_TIMEOUT=10
LAUNCH_WINDOW_TIMEOUT=15
LAUNCH_JOIN_TIMEOUT=60
LAUNCH_PLACE_TIMEOUT=90
LAUNCH_STABLE_SECONDS=15

# Servers
JOIN_LOW_SERVER=false
LOW_SERVER_MIN_PLAYERS=1
LOW_SERVER_MAX_PLAYERS=0
LOW_SERVER_MAX_PAGES=3
FAILED_JOB_TTL=300

# Recovery
LOBBY_RETRY_LIMIT=3
QUEUE_RETRY_LIMIT=3
LOBBY_RETRY_DELAY=3

# Monitor
CHECK_INTERVAL=5

# API should never be required for basic recovery
ROBLOX_API_STRICT=false
```

---

# 34. Config compatibility

Existing config phải tiếp tục chạy.

Tất cả config mới có safe defaults.

`config_load()`:

```text
old config
   ↓
new defaults injected
   ↓
không bắt migration thủ công
```

`config_save()` phải serialize key mới.

---

# 35. Monitor tick mới

Pseudo:

```bash
monitor_tick_v2() {
    local evidence state

    evidence="$(session_collect_evidence)"
    state="$(session_classify "$evidence")"

    case "$state" in
        GAME_ACTIVE)
            monitor_game_active
            ;;

        APP_HOME)
            monitor_home
            ;;

        JOINING|LOADING|TELEPORTING)
            monitor_progress_wait
            ;;

        QUEUE|LOBBY)
            monitor_lobby_or_queue
            ;;

        WINDOW_CLOSED)
            monitor_recover_window
            ;;

        PROCESS_DEAD)
            monitor_recover_process
            ;;

        DISCONNECTED)
            monitor_recover_disconnect
            ;;

        WRONG_PLACE)
            monitor_recover_wrong_place
            ;;

        SESSION_STALLED)
            monitor_recover_stalled
            ;;

        *)
            monitor_unknown
            ;;
    esac
}
```

---

# 36. Không reset timer sai

Các timer phải độc lập:

```text
LAST_GAME_ACTIVE_AT
LOADING_STARTED_AT
JOIN_STARTED_AT
TELEPORT_STARTED_AT
WINDOW_MISSING_STARTED_AT
SESSION_STARTED_AT
LAST_API_SUCCESS_AT
```

Không dùng một timestamp cho nhiều nghĩa.

---

# 37. Heartbeat cho monitor

File:

```text
tmp/heartbeats/{package}.heartbeat
```

Mỗi monitor tick:

```bash
date +%s > "$heartbeat"
```

Watchdog:

```text
PID alive?
heartbeat age?
```

Rules:

```text
PID dead
→ restart

PID alive
heartbeat > 2 × CHECK_INTERVAL + 20s
→ monitor hung
→ restart
```

---

# 38. Structured logging

Mỗi event:

```text
event=
package=
session_id=
state=
place_id=
job_id=
universe_id=
reason=
api_source=
confidence=
```

Ví dụ:

```text
event=session_state
package=com.roblox.clone1
session_id=clone1_1789690000_4
state=GAME_ACTIVE
place_id=333
universe_id=999
job_id=abcd
confidence=95
```

---

# 39. API logging

Không log full response nếu không cần.

Log:

```text
event=roblox_api
provider=presence
status=200
latency_ms=153
cache=false
```

Error:

```text
event=roblox_api_error
provider=games
status=429
action=circuit_breaker
```

---

# 40. Security

## Tuyệt đối không lưu

```text
.ROBLOSECURITY
Roblox password
session cookie
CSRF token
```

để phục vụ feature API này.

Auto Rejoin phải hoạt động với public APIs + local device signals.

## HTTP

Chỉ:

```text
https://*.roblox.com
```

Không cho config tùy ý inject API URL trừ khi feature developer/debug explicit.

## JSON

Parse bằng:

```text
jq
```

ưu tiên.

Fallback:

```text
python3 json
node JSON.parse
```

Không parse JSON bằng grep/sed nếu field quan trọng.

---

# 41. Không dùng third-party Roblox API proxy

Không mặc định dùng:

```text
roproxy
unknown proxy
random API mirror
```

Lý do:

```text
privacy
availability
data integrity
security
dependency risk
```

Termux chạy ngoài Roblox game nên gọi trực tiếp Roblox domain được.

---

# 42. Files cần sửa

## `lib/roblox.sh`

Giữ:

```text
link parsing
URI building
place/job validation
```

Di chuyển HTTP API sang:

```text
lib/roblox_api.sh
```

`roblox.sh` không nên ngày càng phình to.

---

## `lib/roblox_api.sh` NEW

Implement:

```text
HTTP wrapper
API cache
API circuit breaker
Place→Universe
Game metadata
Server list
Username→UserID
Presence
```

---

## `lib/roblox_session.sh` NEW

Implement:

```text
session lifecycle
log cursor
session generation
Place/Job extraction
event parser
```

---

## `lib/session_evidence.sh` NEW

Implement:

```text
collect local evidence
merge API evidence
classify state
confidence
```

---

## `lib/android.sh`

Sửa window detection:

```text
window record != window visible
task != window
```

Add:

```bash
android_has_window_record
android_is_window_surface_visible
android_is_window_focused
android_get_top_resumed_activity
```

---

## `lib/monitor.sh`

Không tự đoán Roblox state từ nhiều function riêng.

Thay bằng:

```text
session_collect_evidence
session_classify
```

Monitor chỉ:

```text
transition
timeout
recovery
notification
```

---

## `lib/config.sh`

Add safe config keys ở section 33.

---

## `lib/runtime.sh`

Add:

```text
provider circuit breaker helpers
recovery jitter
failed Job TTL
```

hoặc tách API breaker vào `roblox_api.sh`.

---

## `setup.sh`

Snapshot collector:

```text
activity
top
windows
```

Heartbeat monitor.

Presence batch collector optional.

---

# 43. Tests mới

```text
tests/
├── test_roblox_api.sh
├── test_roblox_session.sh
├── test_session_evidence.sh
├── fixtures/
│   ├── android/
│   ├── roblox_logs/
│   └── api/
```

---

# 44. API fixtures

Không để unit tests gọi Roblox thật.

Lưu fixture:

```text
fixtures/api/
├── place_universe_ok.json
├── game_info_ok.json
├── servers_page_1.json
├── servers_page_2.json
├── presence_ingame.json
├── presence_private.json
├── presence_offline.json
├── users_resolve_ok.json
├── rate_limit.json
└── malformed.json
```

---

# 45. Android real fixtures

Lấy từ UGPhone thật:

```text
window_game_visible.txt
window_freeform_visible.txt
window_freeform_closed_process_alive.txt
window_minimized.txt

activity_game.txt
activity_home.txt
activity_loading.txt
activity_task_stale.txt
```

Đây là P0.

Unit test giả tự viết không đủ để đảm bảo parser đúng Android vendor build.

---

# 46. Roblox log fixtures

Cần ít nhất:

```text
join_success.log
join_stuck.log
lobby_then_game.log
disconnect.log
kick.log
server_shutdown.log
teleport_success.log
teleport_fail.log
old_join_event.log
new_session_after_old_disconnect.log
```

---

# 47. Required behavior tests

## T1 — Closed Freeform window

```text
process alive
task stale/present
window not visible
```

Expected:

```text
WINDOW_CLOSED
→ recovery
```

Không được:

```text
IN_GAME
```

---

## T2 — Home screen

```text
process=true
window=true
MainActivity
Presence=Online hoặc InGame/null fields
```

Expected:

```text
APP_HOME
```

---

## T3 — Joining log

Log:

```text
Joining game
```

Expected:

```text
JOINING
```

Không phải:

```text
GAME_ACTIVE
```

---

## T4 — Old GAME_READY event

Log cũ trước `SESSION_STARTED_AT`.

Expected:

```text
ignored
```

---

## T5 — Presence privacy

```json
{
  "userPresenceType": 2,
  "placeId": null,
  "gameId": null
}
```

Expected:

```text
Presence evidence = IN_GAME_UNKNOWN_PLACE
```

Không được classify sai thành target game.

---

## T6 — Place same Universe

```text
target=333
observed=111
both Universe=999
```

Expected:

```text
TRANSIT/LOBBY
```

Không immediately WRONG_PLACE.

---

## T7 — Different Universe

```text
target universe=999
observed universe=555
```

Expected:

```text
WRONG_PLACE
```

---

## T8 — `am start=0`, no process

Expected:

```text
launch_no_process
```

---

## T9 — process yes, no window

Expected:

```text
launch_no_window
```

---

## T10 — low server failed Job

```text
jobA failed recently
```

Expected:

```text
next selection != jobA
```

---

## T11 — API 429

Expected:

```text
monitor continues
API provider degraded
cache/local fallback
```

---

## T12 — API timeout

Expected:

```text
monitor tick remains bounded
```

---

## T13 — multiple clones

Two monitor subprocesses:

```text
cloneA
cloneB
```

Close A.

Expected:

```text
only A recovers
B unchanged
```

---

# 48. Integration tests

Dùng fake HTTP server local.

Ví dụ:

```text
ROBLOX_API_TEST_BASE=http://127.0.0.1:PORT
```

Chỉ được cho phép trong:

```text
TEST_MODE=true
```

Production vẫn hard-code Roblox HTTPS origins.

---

# 49. GitHub CI

Thêm:

```text
.github/workflows/test.yml
```

Run:

```bash
bash -n auto_rejoin.sh
bash -n lib/*.sh
bash -n tests/*.sh

./tests/test_android.sh
./tests/test_config.sh
./tests/test_roblox.sh
./tests/test_roblox_api.sh
./tests/test_roblox_session.sh
./tests/test_session_evidence.sh
./tests/test_monitor.sh
```

Optional:

```text
shellcheck
```

Merge/deploy không được PASS nếu tests fail.

---

# 50. Phase plan

## Phase P0.1 — Roblox API abstraction

Implement:

```text
lib/roblox_api.sh
cache
timeouts
circuit breaker
Place→Universe
Game info
Server API
Users API
Presence API
```

Acceptance:

```text
API failure never kills monitor
```

---

## Phase P0.2 — Correct Android visibility

Implement real visibility parser.

Remove:

```text
task present => window visible
```

Test bằng UGPhone dumpsys fixtures.

Acceptance:

```text
close Freeform X
process remains
tool detects WINDOW_CLOSED
```

---

## Phase P0.3 — Session log engine

Implement incremental parser.

Acceptance:

```text
old logs cannot confirm a new session
Joining != GAME_ACTIVE
```

---

## Phase P0.4 — Verified launch

Implement launch stages.

Acceptance:

```text
am start exit 0
but no UI
= launch failure
```

---

## Phase P1.1 — Unified Session Detector

Use one source of truth:

```text
session_classify
```

Acceptance:

```text
monitor.sh no longer duplicates detection logic
```

---

## Phase P1.2 — Place / Universe intelligence

Implement:

```text
same-universe transit detection
wrong universe
allowed game places
transit timeout
```

---

## Phase P1.3 — Server Selector V2

Implement:

```text
pagination
failed job memory
score
jitter
multi clone distribution
```

---

## Phase P1.4 — Recovery Ladder

Implement:

```text
soft
task
fresh
rotate server
cooldown
```

---

## Phase P2 — Supervisor & API batching

Implement:

```text
heartbeat
monitor hung detection
shared snapshots
presence batching
shared API cache
```

---

## Phase P3 — Real-device pilot

Matrix:

```text
official Roblox
Aya clones
multiple clone packages
Freeform
fullscreen
Wi-Fi disconnect
server shutdown
Home
lobby
queue
teleport
wrong place
process kill
window close
```

---

# 51. Real-device telemetry command

Thêm CLI:

```bash
./bin/roblox-manager session-debug com.roblox.client
```

Output:

```text
Package:
PID:
Task:
Window record:
Window visible:
Focused:
Resumed Activity:

Session ID:
Session Age:
Log File:
Log Offset:
Last Event:

Local Place ID:
Local Job ID:

API User ID:
Presence Type:
Presence Place:
Presence Universe:

Expected Place:
Expected Universe:

State:
Confidence:
Recovery Count:
```

Secret redaction bắt buộc.

---

# 52. API debug CLI

```bash
./bin/roblox-manager api doctor
```

Expected:

```text
[OK] users.roblox.com
[OK] presence.roblox.com
[OK] games.roblox.com
[OK] apis.roblox.com

Place 123 → Universe 999
Game: Example
Public servers: 74
```

Nếu presence private:

```text
[WARN] Presence returned hidden Place data
```

Không coi là failure.

---

# 53. Support bundle

Bổ sung:

```text
api health
API breaker states
cache metadata
session state
latest parsed events
Android snapshot summary
```

Không include:

```text
full private tokens
Roblox cookie
password
license secret
Discord webhook
```

---

# 54. Production metrics

Theo dõi:

```text
launch_attempts
launch_confirmed
launch_failed_no_process
launch_failed_no_window
lobby_retries
queue_retries
window_reopens
disconnects
wrong_place
api_errors
api_429
presence_hidden
server_rotations
monitor_hangs
```

---

# 55. Performance target

Với 5–10 clones:

```text
No per-clone dumpsys every 5s.
No per-clone Presence request every 5s.
No server scan every monitor tick.
```

Target:

```text
Android snapshot     1 shared call / 3–5s
Presence             1 batched call / 20–30s
Game metadata        cache 10m
Place→Universe       cache 24h
Server list          only when launch/recovery requires it
```

---

# 56. Data flow khi startup

```text
config
  ↓
validate package/place
  ↓
resolve username→userId if needed
  ↓
resolve Place→Universe
  ↓
load game metadata
  ↓
begin session
  ↓
launch
```

API metadata failure:

```text
warn
continue
```

---

# 57. Data flow trong monitor

```text
shared Android snapshot
       ↓
session log incremental parser
       ↓
cached Presence
       ↓
session evidence
       ↓
state classify
       ↓
monitor transition
```

---

# 58. Data flow khi lobby stuck

```text
LOBBY
   ↓
timeout
   ↓
current Job ID known?
   ↓ YES
mark failed Job
   ↓
server API
   ↓
pick next Job
   ↓
verified fresh launch
```

---

# 59. Data flow khi window closed

```text
process=true
window_visible=false
threshold reached
   ↓
WINDOW_CLOSED
   ↓
fresh launch
   ↓
verify process
   ↓
verify window
   ↓
verify join
   ↓
verify Place
   ↓
GAME_ACTIVE
```

---

# 60. Data flow khi wrong Place

```text
observed Place ID
      ↓
Place→Universe API/cache
      ↓
same expected Universe?
   ┌──┴──┐
  YES    NO
   │      │
TRANSIT  WRONG_PLACE
   │      │
timeout  recover
   │
GAME_ACTIVE / recover
```

---

# 61. Data flow khi Presence nói game khác

Presence không được override local evidence ngay.

```text
local Place=333
presence Place=111
```

Trong khoảng ngắn:

```text
PRESENCE_STALE
```

Nếu kéo dài nhiều poll:

```text
evidence conflict
```

Log warning.

Chỉ recovery khi local evidence cũng xác nhận sai state/place.

---

# 62. API schemas phải validate

Không dùng:

```bash
jq -r '.field'
```

rồi assume field tồn tại.

Ví dụ Place→Universe:

```text
HTTP 200
JSON object
universeId integer > 0
```

Nếu fail:

```text
API_SCHEMA_ERROR
```

---

# 63. Rate limit handling

HTTP:

```text
429
```

Rules:

```text
do not retry immediately
respect Retry-After if available
open provider circuit
use cache
```

Không:

```text
while curl fails; do curl...
```

---

# 64. Timeouts

Recommendation:

```text
connect timeout: 4s
request max:    8s
```

Server list:

```text
max 10–12s
```

Monitor không được block lâu hơn:

```text
one CHECK_INTERVAL
```

API refresh có thể được collector/background helper thực hiện.

---

# 65. Fail-open vs fail-closed

## Fail-open

Các API:

```text
Presence
game metadata
thumbnail
username metadata
```

Fail:

```text
continue local monitoring
```

## Server API

Nếu `JOIN_LOW_SERVER=false`:

```text
không cần
```

Nếu `JOIN_LOW_SERVER=true` nhưng API fail:

```text
fallback normal scoped Place deep-link
```

trừ khi:

```bash
LOW_SERVER_STRICT=true
```

Dù strict, không được spam requests.

---

# 66. API source priority

```text
Place ID:
local session log
> Presence
> config

Universe:
cache/API from observed Place
> Presence universeId

Job ID:
local log
> Presence gameId

Game name:
Games API
> cached
> "Place {id}"
```

---

# 67. Compatibility với private server

Private link:

```text
roblox://navigation/share_links?code=...&type=Server
```

Không dùng Public Server API để override khi:

```bash
PRIVATE_CODE != ""
```

Private mode:

```text
private server link has highest launch priority
```

Presence vẫn có thể dùng để verify Place/Universe nếu dữ liệu available.

---

# 68. Priority order launch

```text
1. PRIVATE_CODE
2. explicit JOB_ID
3. JOIN_LOW_SERVER server selection
4. normal Place deep-link
5. Home fallback only when explicitly enabled
```

Giữ:

```bash
ALLOW_UNSCOPED_DEEPLINK=false
ALLOW_HOME_FALLBACK=false
```

làm safe default.

---

# 69. Acceptance criteria toàn project

Không được báo `PRODUCTION_READY` nếu chưa đạt tất cả:

### Functional

- [ ] Close Freeform X → reopen same package.
- [ ] Background process không bị coi là visible window.
- [ ] Roblox Home không bị coi là `GAME_ACTIVE`.
- [ ] `Joining game` không bị coi là `GAME_ACTIVE`.
- [ ] Lobby timeout rejoin.
- [ ] Queue rotates server.
- [ ] Wrong Universe rejoin.
- [ ] Same-Universe transit place không bị restart sớm.
- [ ] `am start=0`, no window → launch failure.
- [ ] Presence privacy/null fields không gây false recovery.
- [ ] Roblox APIs offline → local monitoring vẫn chạy.
- [ ] 2+ clone isolation.
- [ ] Monitor hung → watchdog restart.

### Security

- [ ] No `.ROBLOSECURITY`.
- [ ] No secrets in logs.
- [ ] No unsafe shell eval.
- [ ] Package validation preserved.
- [ ] HTTPS Roblox domains only.

### Performance

- [ ] Shared dumpsys collector.
- [ ] Presence batching.
- [ ] API cache.
- [ ] Server API only on demand.
- [ ] No request storm.

### Testing

- [ ] Unit tests.
- [ ] Fixture tests.
- [ ] Integration tests.
- [ ] GitHub CI.
- [ ] UGPhone real-device tests.

---

# 70. AI implementation instruction

AI thực hiện plan này phải:

1. Đọc toàn repo trước.
2. Không rewrite license/payment/admin unrelated systems.
3. Giữ backward compatibility.
4. Viết tests trước/đồng thời với code.
5. Không tuyên bố device PASS dựa trên mock.
6. Không dùng `.ROBLOSECURITY`.
7. Không thêm third-party Roblox proxy.
8. Không biến Roblox API thành critical dependency.
9. Không dùng raw grep cho JSON quan trọng.
10. Không reset lobby/server retry trước khi gameplay thật được confirm.
11. Không dùng stale Roblox log để confirm session mới.
12. Không dùng `task exists` làm `window visible`.
13. Không dùng `am start exit 0` làm launch confirmation.
14. Chỉ reset recovery/backoff sau stable `GAME_ACTIVE`.
15. Update real-device checklist sau mỗi phase.

---

# 71. Recommended implementation order

```text
P0
│
├─ 1. roblox_api.sh
├─ 2. API cache + breaker
├─ 3. correct Android window parser
├─ 4. UGPhone dumpsys fixtures
├─ 5. roblox_session.sh incremental logs
├─ 6. verified launch transaction
└─ 7. realistic P0 tests

P1
│
├─ unified session classifier
├─ Universe/place intelligence
├─ transit places
├─ server selector v2
└─ recovery ladder

P2
│
├─ shared snapshot collector
├─ Presence batch collector
├─ monitor heartbeat
└─ support-bundle telemetry

P3
│
├─ CI
├─ long-running soak tests
└─ real UGPhone pilot
```

---

# 72. Definition of Done

Project chỉ được coi là đạt Rejoin Engine V2 khi:

```text
Roblox client state
được xác định bởi:
local runtime
+
current-session logs
+
optional Roblox API evidence
```

và recovery có thể tự xử lý:

```text
process crash
window close
home screen
lobby stuck
queue
disconnect
wrong game
wrong place
network outage
API outage
monitor hang
```

mà:

```text
không restart nhầm clone
không spam Roblox API
không dùng Roblox cookie
không phụ thuộc API để sống
không false-positive GAME_ACTIVE từ log cũ
```

---

# 73. Roblox API references

Các endpoint trong tài liệu này dựa trên Roblox Creator Hub / Roblox API domains và các endpoint công khai hiện có:

- Creator Hub Cloud API reference:
  - `https://create.roblox.com/docs/cloud`
- Games domain:
  - `https://create.roblox.com/docs/cloud/reference/domains/games`
- Presence domain:
  - `https://create.roblox.com/docs/cloud/reference/domains/presence`
- Users:
  - `https://create.roblox.com/docs/cloud/reference/features/users`
- Places:
  - `https://create.roblox.com/docs/cloud/reference/features/places`
- Thumbnails:
  - `https://create.roblox.com/docs/cloud/reference/features/thumbnails`

Production code phải coi các legacy/public web APIs là external dependencies có thể thay đổi và luôn có timeout/cache/fallback.

---

# 74. Final architecture target

```text
                     ┌─────────────────────┐
                     │ Shared Android Data │
                     └──────────┬──────────┘
                                │
                     ┌──────────▼──────────┐
                     │ Session Log Parser  │
                     └──────────┬──────────┘
                                │
       ┌────────────────────────┼─────────────────────────┐
       │                        │                         │
┌──────▼──────┐         ┌───────▼───────┐        ┌──────▼──────┐
│ Presence API │         │ Universe/Game │        │ Server API  │
└──────┬──────┘         └───────┬───────┘        └──────┬──────┘
       │                        │                         │
       └────────────────────────┼─────────────────────────┘
                                ▼
                     ┌─────────────────────┐
                     │ Session Evidence    │
                     └──────────┬──────────┘
                                ▼
                     ┌─────────────────────┐
                     │ State Classifier    │
                     └──────────┬──────────┘
                                ▼
                     ┌─────────────────────┐
                     │ Recovery Engine     │
                     └──────────┬──────────┘
                                ▼
                     ┌─────────────────────┐
                     │ Verified Launcher   │
                     └─────────────────────┘
```

**Primary design rule:**

> Roblox API giúp tool hiểu dữ liệu tốt hơn; local Android + current-session log mới là nền tảng giúp tool tự cứu client đáng tin cậy.
