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

