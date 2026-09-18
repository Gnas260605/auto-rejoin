# Real Device Test Checklist — Phase 5B Validation Protocol

This checklist contains the exact manual test procedures for physical Android / Termux / UGPhone devices.

> [!IMPORTANT]
> - Do **NOT** mark items as `[x] PASS` unless they have been physically executed and observed on actual hardware.
> - Current automated status in CI/Dev: `PASS_AUTOMATED`.
> - Physical hardware test status: `REAL_DEVICE_VALIDATION_PENDING`.

---

## 1. Environment & Bootstrap Testing

### Case 1.1: Clean Termux Installation from Scratch
**Objective**: Ensure a buyer can install dependencies and run the tool without editing code.
```bash
# 1. Update Termux package list
pkg update -y

# 2. Install essential dependencies
pkg install -y git nodejs bash curl jq tmux tsu openssl

# 3. Download setup script
curl -sSL https://raw.githubusercontent.com/Gnas260605/auto-rejoin/main/setup.sh -o setup.sh
bash setup.sh 2753915549

# 4. Verify doctor output
bin/roblox-manager doctor
```
- [ ] NOT TESTED - Fresh Termux install runs without source code modifications.
- [ ] NOT TESTED - Root (su / tsu) detection succeeds when SuperUser is enabled.
- [ ] NOT TESTED - ADB detection succeeds in non-root environment (`adb connect localhost:5555`).
- [ ] NOT TESTED - Direct environment falls back gracefully with clear warnings.

---

## 2. Licensing & Multi-Device Enforcement

### Case 2.1: Production License Activation
```bash
# Set production license API
export AUTO_REJOIN_LICENSE_MODE=required
export AUTO_REJOIN_LICENSE_API=https://license.yourdomain.com

# 1. Check initial status
bin/roblox-manager license status

# 2. Activate with test license key generated from Admin Dashboard
bin/roblox-manager license activate "AR-XXXX-XXXX-XXXX-XXXX"

# 3. Verify status, plan, maxInstances, and cached token
bin/roblox-manager license status
```
- [ ] NOT TESTED - License activation succeeds and caches token in `~/.auto-rejoin/`.
- [ ] NOT TESTED - Raw license key is NOT stored in local files.
- [ ] NOT TESTED - Admin Dashboard displays device with masked installation ID (e.g. `4444****4444`).

### Case 2.2: Device Limit & Admin Reset Lifecycle
1. Create a test license with `maxDevices = 2`.
2. Activate on Device A (`bin/roblox-manager license activate <KEY>`) ➔ Success.
3. Activate on Device B ➔ Success.
4. Attempt activation on Device C ➔ Expected: `DEVICE_LIMIT` error (HTTP 403).
5. In Admin Dashboard, navigate to License Details ➔ Devices ➔ Click **Reset Device** on Device A.
6. Re-run activation on Device C ➔ Expected: Success!
7. Run `bin/roblox-manager license validate` on Device A ➔ Expected: `REVOKED` error.
- [ ] NOT TESTED - Device limit strictly enforced on 3rd device.
- [ ] NOT TESTED - Admin device reset invalidates Device A tokens immediately.
- [ ] NOT TESTED - Device C activates into freed slot successfully.

### Case 2.3: Admin Suspend, Reactivate, and Revoke
1. Run monitor on active device: `bin/roblox-manager start`.
2. In Admin Dashboard, click **Suspend License**.
3. Force license validation: `bin/roblox-manager license validate` ➔ Expected: `SUSPENDED` (HTTP 403).
4. Attempt starting a new monitor ➔ Expected: Blocked by entitlement gate.
5. In Admin Dashboard, click **Reactivate License**.
6. Run `bin/roblox-manager license validate` ➔ Expected: Valid (`200 OK`).
7. In Admin Dashboard, click **Revoke License Permanently**.
8. Validate ➔ Expected: `REVOKED` (HTTP 403), irreversible.
- [ ] NOT TESTED - Suspend immediately blocks license validation.
- [ ] NOT TESTED - Reactivate restores validation without key re-entry.
- [ ] NOT TESTED - Revoke permanently invalidates all tokens.

---

## 3. Installer & APK Safety Testing

### Case 3.1: Roblox Missing Flow
```bash
# On device with Roblox uninstalled
bin/roblox-manager setup
# Wizard should detect missing Roblox and prompt for APK URL
```
- [ ] NOT TESTED - Setup wizard detects missing Roblox and offers installer.
- [ ] NOT TESTED - Wizard downloads official APK from HTTPS URL, parses `com.roblox.client` metadata, and installs cleanly.

### Case 3.2: Malformed / Untrusted APK Rejection
```bash
# Test with corrupted file disguised as APK
bin/roblox-manager install-roblox "https://example.com/fake.apk" --dry-run
```
- [ ] NOT TESTED - Invalid archive / wrong package name is rejected before `pm install`.
- [ ] NOT TESTED - Download workspace under `tmp/install/` is automatically cleaned up.

---

## 4. Runtime Monitoring & Recovery Testing

### Case 4.1: Crash Detection & Auto Rejoin
```bash
# Start monitor in tmux
tmux new -s roblox-test
./auto_rejoin.sh
```
1. Verify Roblox opens and joins the configured Place ID.
2. Simulate crash by killing Roblox process:
   ```bash
   su -c "am force-stop com.roblox.client"
   # or: adb shell am force-stop com.roblox.client
   ```
3. Observe monitor log output.
- [ ] NOT TESTED - Monitor detects process death within check interval (e.g. 5s).
- [ ] NOT TESTED - State transitions: `CRASHED` ➔ `RECOVERING` ➔ `LAUNCHING` ➔ `LOADING` ➔ `IN_GAME`.
- [ ] NOT TESTED - Roblox relaunched and rejoins place automatically.

### Case 4.2: Network Outage Simulation
1. While monitor is `IN_GAME`, disable WiFi / mobile data for 30 seconds.
2. Observe monitor log output ➔ Expected: `OFFLINE` state, no restart storm.
3. Re-enable WiFi.
4. Observe monitor log output ➔ Expected: Automatically transitions to `RECOVERING` and rejoins.
- [ ] NOT TESTED - Network disconnect transitions cleanly to `OFFLINE` without CPU/launch storm.
- [ ] NOT TESTED - Network restore resumes normal monitoring.

### Case 4.3: Multi-Instance & maxInstances Entitlement
1. Start monitor instance 1: `CONFIG_FILE="config_acc1.cfg" ./auto_rejoin.sh`
2. Start monitor instance 2: `CONFIG_FILE="config_acc2.cfg" ./auto_rejoin.sh`
3. With `maxInstances = 2`, attempt starting instance 3: `CONFIG_FILE="config_acc3.cfg" ./auto_rejoin.sh`
- [ ] NOT TESTED - Third instance is rejected with clear entitlement limit message.
- [ ] NOT TESTED - First two instances continue running without interruption.

---

## 5. Signed Release Auto-Update Testing

### Case 5.1: Valid Production Release Update
```bash
export AUTO_REJOIN_UPDATE_MANIFEST_URL="https://updates.yourdomain.com/release-manifest.json"

# Check for updates
bin/roblox-manager update check

# Apply update
bin/roblox-manager update --yes
```
- [ ] NOT TESTED - Signature verification against `keys/update-public.pem` passes.
- [ ] NOT TESTED - Artifact SHA256 matches manifest.
- [ ] NOT TESTED - Staging self-test executes cleanly before applying.
- [ ] NOT TESTED - Version updated in `VERSION` and verified.

### Case 5.2: Tampered Manifest Rejection
1. Host a manifest where signature does not match or content has been altered.
2. Run `bin/roblox-manager update check`.
- [ ] NOT TESTED - Updater fails signature verification and aborts update before download.

### Case 5.3: Active Monitor Protection
1. Keep `./auto_rejoin.sh` running in background.
2. Run `bin/roblox-manager update --yes`.
- [ ] NOT TESTED - Update is refused while active monitor lock is held, preventing session disruption.

---

## 6. Logs & Storage Hygiene

- [ ] NOT TESTED - Logs in `logs/` do not contain raw license keys, admin secrets, or Discord webhook URLs.
- [ ] NOT TESTED - `tmp/` directory does not grow unboundedly after multiple days of continuous runtime.
- [ ] NOT TESTED - Device reboot preserves installation ID, profiles, and configuration files.

---

## 7. Diagnostics & Support Bundle Testing

### Case 7.1: Support Bundle Exporter & Secret Redaction
```bash
bin/roblox-manager support-bundle
```
- [ ] NOT TESTED - Generates valid `.tar.gz` archive under `tmp/`.
- [ ] NOT TESTED - `doctor.txt`, `environment.txt`, `config_redacted.txt`, and `recent_logs.txt` are included.
- [ ] NOT TESTED - Discord webhook tokens, passwords, and JWT tokens are fully redacted.
- [ ] NOT TESTED - License key is masked as `AR-XXXX-XXXX-XXXX-XXXX` and installation ID is masked.

---

## 8. Real-Device Window & Lobby Recovery Validation (Bug 1 & Bug 2)

### Case 8.1: Freeform Window Close & Auto-Reopen (Bug 1)
**Objective**: Verify that closing the freeform/tab/window of Roblox (while the background process remains alive) is detected and automatically relaunched with the configured Place ID and window bounds.

```bash
# 1. Start the bot on UGPhone
./auto_rejoin.sh monitor "com.roblox.client"

# 2. Wait until bot launches Roblox and status shows IN_GAME
# 3. Manually click the 'X' button to close only the Roblox Freeform window
#    (Do NOT kill the background process).
# 4. Observe the bot log:
#    - Ticks 1 to 2: logs [WINDOW] Không thấy cửa sổ Roblox (1/3)...
#    - Tick 3: logs [WINDOW] Cửa sổ Roblox bị đóng! Tự động mở lại game...
#    - Event: window_closed_detected
#    - Bot executes force-stop on stale background process and relaunches Roblox deep-link.
```
- [ ] NOT TESTED - Closing Freeform window while process stays alive is detected within `WINDOW_MISSING_THRESHOLD` ticks (default: 3).
- [ ] NOT TESTED - Stale background Roblox process is cleanly terminated.
- [ ] NOT TESTED - Bot automatically relaunches the EXACT configured package (`ROBLOX_PACKAGE`).
- [ ] NOT TESTED - Bot enters the configured `PLACE_ID` (and restores freeform layout bounds if configured).
- [ ] NOT TESTED - State transitions: `IN_GAME` ➔ `RECOVERING (window_closed)` ➔ `LOADING` ➔ `IN_GAME`.

---

### Case 8.2: Roblox Stuck in Home/Lobby Auto-Rejoin (Bug 2)
**Objective**: Verify that when Roblox opens into the Home/Lobby screen instead of directly joining the game, the bot recognizes it is NOT in gameplay and re-triggers the deep-link.

```bash
# 1. Configure a test experience
# 2. Start monitor
./auto_rejoin.sh monitor "com.roblox.client"

# 3. While Roblox is loading or in-game, click the Roblox TopBar Home icon or 'Leave' to return to Home/Lobby.
# 4. Observe the bot log:
#    - Bot recognizes Home screen (MainActivity / no GameActivity / no game session log)
#    - State remains in LOADING (not falsely classified as IN_GAME)
#    - Log shows: [LOBBY] Đang ở sảnh/loading, chờ vào map...
#    - When time_stuck >= IN_GAME_TIMEOUT (or 120s):
#      * [LOBBY] Kẹt ở sảnh/loading 120s! Force-stop rồi chọn lại server... (Lần thử 1/3)
#      * Event: lobby_timeout, lobby_retry (retry=1)
#      * Bot triggers deep-link rejoin.
# 5. Verify LOBBY_RETRY_COUNT increments (1 -> 2 -> 3) across retries without resetting prematurely.
# 6. Once account successfully enters game, verify LOBBY_RETRY_COUNT resets to 0.
```
- [ ] NOT TESTED - Roblox Home/Lobby screen is never classified as `IN_GAME`.
- [ ] NOT TESTED - `time_stuck` is accurately tracked from `LOADING_STARTED_AT`.
- [ ] NOT TESTED - After `IN_GAME_TIMEOUT`, bot automatically deep-links back into the target game.
- [ ] NOT TESTED - `LOBBY_RETRY_COUNT` and `LOW_SERVER_RETRY_OFFSET` are preserved across recoveries until confirmed gameplay.
- [ ] NOT TESTED - Upon confirmed gameplay (`GameActivity` + session evidence), retry counters reset to 0.

---

### Case 8.3: Multiple Roblox Clones Simultaneous Isolation
**Objective**: Verify that closing or disconnecting one clone does not affect or reopen other running clones.

```bash
# Setup: 2 clones installed: com.roblox.client and com.roblox.client_clone1
# 1. Start monitor for Clone 1 in tmux window 1:
CONFIG_FILE="configs/acc1.cfg" ./auto_rejoin.sh monitor "com.roblox.client"

# 2. Start monitor for Clone 2 in tmux window 2:
CONFIG_FILE="configs/acc2.cfg" ./auto_rejoin.sh monitor "com.roblox.client_clone1"

# 3. Both clones reach IN_GAME.
# 4. Manually close the window of Clone 1 only.
# 5. Observe:
#    - Clone 1 detects missing window and relaunches com.roblox.client.
#    - Clone 2 remains completely untouched and stays IN_GAME.
```
- [ ] NOT TESTED - Closing Clone 1 window only triggers recovery for Clone 1 (`com.roblox.client`).
- [ ] NOT TESTED - Clone 2 (`com.roblox.client_clone1`) continues undisturbed in `IN_GAME`.
- [ ] NOT TESTED - Each clone's lock file and PID file operate independently without conflict.

---

### Case 8.4: Low Server Job ID Rotation on Lobby Stuck
**Objective**: Verify that if `JOIN_LOW_SERVER=true` and lobby recovery occurs, the bot rotates to the next low-player server offset.

```bash
# 1. Enable JOIN_LOW_SERVER=true in config
# 2. Run bot and simulate lobby stuck
# 3. Verify retry 1 uses offset 1 (next smallest server Job ID)
# 4. Verify retry 2 uses offset 2
```
- [ ] NOT TESTED - `LOW_SERVER_RETRY_OFFSET` increments with each lobby retry.
- [ ] NOT TESTED - Different server Job ID is targeted on each retry attempt.
- [ ] NOT TESTED - Offset resets to 0 upon entering `GAME_ACTIVE`.


