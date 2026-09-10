# Auto Rejoin Pro — Pilot User Onboarding Guide

Welcome to the **Auto Rejoin Pro** Pilot Program (`v4.5.0-pilot.1`). This guide walks you through setting up, configuring, running, and updating Auto Rejoin Pro on your Android / UGPhone device.

> [!IMPORTANT]
> **Zero Credential Requirement**: Auto Rejoin Pro **NEVER** asks for your Roblox password, cookie (`.ROBLOSECURITY`), or 2-Factor Authentication tokens. All joins are performed securely via standard Android deep links.

---

## 📋 System Requirements

- **Device**: Android physical phone or UGPhone Cloud Phone (Android 7.0+).
- **Environment**: Termux app installed.
- **Permissions**: Root access (`su`) or ADB access enabled (standard on UGPhone).

---

## 🚀 Step 1: Install Termux Requirements

Open Termux on your device and paste this one-line command to install essential tools:

```bash
pkg update -y && pkg install -y git bash curl jq tmux tar gzip
```

---

## 📦 Step 2: Download & Install Auto Rejoin Pro

Run the automated installer:

```bash
git clone https://github.com/Gnas260605/auto-rejoin.git ~/auto-rejoin
cd ~/auto-rejoin
chmod +x setup.sh bin/roblox-manager
```

---

## 🩺 Step 3: Run System Diagnostics (Doctor)

Check your environment and verify that all dependencies and Android execution engines are ready:

```bash
./bin/roblox-manager doctor
```

**Expected output:**
- All checks should show `[PASS]` or `[WARN]` (e.g. `android:executor - su available` or `adb available`).
- Ensure `FAIL: 0`.

---

## 🔑 Step 4: Activate Your Pilot License

Activate the 14-day Pilot License Key provided by your operator:

```bash
./bin/roblox-manager license activate "AR-XXXX-XXXX-XXXX-XXXX"
```

Verify your active plan and device entitlement:

```bash
./bin/roblox-manager license status
```

---

## ⚙️ Step 5: Configure Game Link & Package

Run the interactive setup wizard:

```bash
./bin/roblox-manager setup
```

The wizard will:
1. Detect installed Roblox packages (Official or Dual/Clone apps).
2. Ask you to paste your Roblox Game URL, Private Server link, or Place ID.
3. Automatically configure `config.env`.

*(Optional) If you want to configure via one non-interactive command:*
```bash
./bin/roblox-manager setup --non-interactive --link "https://www.roblox.com/games/189707/Natural-Disaster-Survival" --package "com.roblox.client"
```

---

## ▶️ Step 6: Start Auto Rejoin Monitor

Start the monitoring engine inside a persistent `tmux` session (it will run 24/7 even if you close the Termux window):

```bash
./bin/roblox-manager start
```

To view or detach from the session:
- **Detach** (leave running in background): Press `Ctrl + B`, then press `D`.
- **Re-attach**: Run `tmux attach -t roblox`

---

## 📊 Step 7: Check Live Status

Check the current status and health of the monitor anytime:

```bash
./bin/roblox-manager status
```

---

## 🔄 Step 8: Update to Latest Pilot Builds

When an update or bugfix is released during the pilot, check and apply it with one command:

```bash
./bin/roblox-manager update
```

The updater validates cryptographic signatures, stages the new version atomically, runs a self-test, and automatically restarts the monitor.

---

## 🛠️ Step 9: Troubleshooting & Diagnostic Support Bundle

If you experience unexpected behavior or a crash loop:

1. Generate a privacy-sanitized diagnostic bundle:
   ```bash
   ./bin/roblox-manager support-bundle
   ```
2. The command will output the file location:
   ```text
   ~/auto-rejoin/tmp/support-bundle-20260910_120000.tar.gz
   ```
3. Send this `.tar.gz` file to your pilot operator.
   - **Privacy Guarantee**: All Discord webhooks, passwords, secrets, JWT tokens, and raw license keys are automatically stripped and masked before export.

---

## ❓ Frequently Asked Questions (FAQ)

**Q: Does Auto Rejoin Pro need my Roblox account login?**  
A: **No.** Auto Rejoin Pro operates strictly at the Android OS layer by launching deep links into the Roblox app. It never sees or interacts with your login credentials.

**Q: Can I use Auto Rejoin Pro without internet for a short time?**  
A: **Yes.** Once activated, Auto Rejoin Pro includes a **72-hour offline grace period**. If your internet temporarily drops, the monitor will pause joins and resume automatically once reconnected.

**Q: How do I stop the monitor completely?**  
A: Run `tmux kill-session -t roblox` or terminate the process from Termux.
