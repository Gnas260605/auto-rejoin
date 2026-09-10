# Auto Rejoin Pro — Pilot Distribution Plan (Phase 5C)

## 1. Executive Summary & Pilot Goal
The objective of Phase 5C is a controlled pilot release of **Auto Rejoin Pro** (`v4.5.0-pilot.1`) to **3–5 real-world users** on cloud and physical Android devices (UGPhone / Termux). The goal is to observe 24–72 hours of real-world runtime, validate unattended crash recovery, test signed update delivery and license grace handling, collect operational friction points, fix critical blockers, and certify readiness for commercial launch.

---

## 2. Pilot Parameters & Scope Boundaries

| Parameter | Specification |
| :--- | :--- |
| **Release Version** | `v4.5.0-pilot.1` (Signed manifest channel: `pilot`) |
| **Cohort Size** | Strictly 3–5 vetted users |
| **Observation Window** | 24–72 hours continuous unattended runtime |
| **License Allocation** | `pilot` plan / 14-day validity / 1–3 device slots per user |
| **Supported Executors** | Root (`su`), ADB daemon (`adb shell`), Termux direct |
| **Excluded Features** | No automated payment gateways, no customer store, no binary obfuscation |
| **Security Guarantee** | **Zero credential collection** (No Roblox password, cookie, or 2FA requested) |

---

## 3. Target Environment Matrix (Pilot Cohort)

| User ID | Environment | Execution Mode | Roblox Setup | Primary Test Scenario |
| :--- | :--- | :--- | :--- | :--- |
| `PILOT-01` | UGPhone Android 10/11 | Root (`su`) | Official Roblox APK | 72h unattended AFK farming & crash recovery |
| `PILOT-02` | UGPhone Cloud VM | ADB Network Mode | Fresh install via `install-roblox` | APK installation pipeline & network toggle |
| `PILOT-03` | Physical Android + Termux | Root (`su`) | Multi-clone (2 instances) | Clone detection, instance limits & rejoin loop |
| `PILOT-04` | Physical Android + Termux | Non-root (Direct) | Pre-installed Roblox | Compatibility doctor, link parser & update cycle |
| `PILOT-05` (Opt) | Staging / Shadow VM | Root (`su`) | Edge cases (Crash loops) | Rapid crash backoff, license revocation & device reset |

---

## 4. Features Included in Pilot Release

1. **One-Command Setup & Wizard**:
   - `bash setup.sh` with interactive link parser, package selector, and doctor checks.
2. **Comprehensive Diagnostic Doctor**:
   - `roblox-manager doctor` verifying utilities (`bash`, `curl`, `jq`, `tmux`), execution engine, network status, storage permissions, and license cache.
3. **Cryptographic License Client**:
   - Machine fingerprinting (Installation ID), HTTPS token validation, and **72-hour offline grace period**.
4. **Autonomous Rejoin & Process Monitor**:
   - Crash detection, process recovery, backoff cooldown, and crash loop prevention.
5. **Signed Release Updater**:
   - Manifest check, SHA-256 verification, ECDSA signature validation, atomic staging, and self-test verification.
6. **Support Bundle Diagnostic Exporter**:
   - `roblox-manager support-bundle --output <file>` generating an audit tarball with **strict secret redaction** (webhooks, passwords, JWTs, license keys masked).

---

## 5. Issue Severity Classifications & SLAs

| Severity | Definition | Pilot Action | Resolution SLA |
| :--- | :--- | :--- | :--- |
| **P0 — Critical** | Data corruption, security vulnerability, secret leakage, or bootloop. | Immediate pilot pause, hotfix signed release immediately. | < 6 Hours |
| **P1 — High** | Core monitoring fails, rejoin loop fails completely, or false license lockouts. | Must fix and verify with new signed pilot build before commercial launch. | < 24 Hours |
| **P2 — Medium** | Secondary feature failure (e.g. multi-clone count issue, discord webhook formatting). | Fix in subsequent pilot patch. | < 48 Hours |
| **P3 — Low** | UI phrasing confusion, doctor cosmetic warning, minor documentation gap. | Track and polish in onboarding docs. | Next release |

---

## 6. Support Process & Incident Handling

```text
User encounters issue
       ↓
Runs: roblox-manager support-bundle
       ↓
Sends sanitized bundle to Operator
       ↓
Operator reproduces issue locally in testbed
       ↓
Regression test added to tests/
       ↓
Fix implemented & verified against full test suite
       ↓
New signed release built (e.g., 4.5.0-pilot.2)
       ↓
User updates via: roblox-manager update
       ↓
Resolved & logged in PILOT_ISSUES.md
```

---

## 7. Rollback Policy
If a pilot update introduces unexpected regressions:
1. **Automatic Rollback**: The updater automatically rolls back to backup if `roblox-manager self-test` fails during staging.
2. **Manual Rollback**: The previous signed release archive (`v4.5.0-pilot.1.tar.gz`) is preserved on the distribution CDN and can be manually re-applied in one command if needed.
3. **State Preservation**: Rollbacks preserve `config.env`, license tokens, and log history.

---

## 8. Pilot Exit & Readiness Criteria

The pilot is considered successful and ready for Phase 6A (Customer Portal & Launch) only when:
- [ ] 3–5 real devices complete at least 24h (and up to 72h) of unattended runtime.
- [ ] Zero **P0** and zero unresolved **P1** issues exist in `PILOT_ISSUES.md`.
- [ ] At least one full signed update cycle (`pilot.1` → `pilot.2`) is successfully applied in the field.
- [ ] Crash recovery and temporary network outage recovery are verified on physical hardware.
- [ ] Operator sign-off recorded in `PHASE_5C_PILOT_REPORT.md`.
