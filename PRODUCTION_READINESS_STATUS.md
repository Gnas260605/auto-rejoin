# Production Readiness Status

Updated: 2026-09-12

## Current Verdict

`STAGING_READY_WITH_BLOCKERS`

The repository has solid automated backend/admin coverage, but it is not yet
production-proven. Production readiness requires passing the local/staging gates
below plus external deployment and real-device validation.

## Phase Checklist

| Phase | Area | Status | Evidence / Blocker |
| :--- | :--- | :--- | :--- |
| 0 | Scope, feature boundary, status file | COMPLETE | This file is the production source of truth. |
| 1 | Production preflight gate | COMPLETE_LOCAL | `npm run verify:prod` now runs and fails closed on the current dev/test config. Needs real production env to pass. |
| 2 | Backend hardening | COMPLETE_LOCAL | Production env guards, `verify:prod`, and public health response were hardened locally. |
| 3 | Database production readiness | PARTIAL_LOCAL | Backup script hardened locally; needs staging/prod MySQL credentials and migration/backup restore drill. |
| 4 | Admin dashboard production build/deploy | COMPLETE_LOCAL | Local `npm run build` passes; HTTPS deployment is external. |
| 5 | Payment/storefront hardening | PARTIAL_LOCAL | PayOS webhook signature verification added locally; still needs PayOS staging/production replay tests. |
| 6 | Real-device validation | BLOCKED_EXTERNAL | Requires UGPhone/Android/Termux devices and 24-72h observation. |
| 7 | Signed update and rollback drill | BLOCKED_EXTERNAL | Needs HTTPS update manifest/artifact host. |
| 8 | Server deployment | BLOCKED_EXTERNAL | Needs VPS/domain/TLS/PM2 or systemd environment. |
| 9 | Security and abuse review | PARTIAL | Local npm audits pass; live rate-limit and webhook abuse tests need staging. |
| 10 | Go-live decision | NOT_READY | Only allowed after all required gates pass. |

## Required Local Gates

Latest local results:

- PASS: `cd server && npm run check`
- PASS: `cd server && npm test` (`36` passed, `2` MySQL integration tests skipped in unit mode)
- PASS: `cd server && npm audit --omit=dev --audit-level=moderate`
- PASS: `cd admin && npm run build`
- PASS: `cd admin && npm audit --omit=dev --audit-level=moderate`
- BLOCKED_ENV: `bash tests/run_all.sh` cannot run on this Windows host because WSL reports missing `/bin/bash`.

Still required:

- Shell regression suite in a real Bash/Termux environment.

## Required Staging / Production Gates

- `cd server && npm run verify:prod` with production `.env`.
- `cd server && npm run migrate` against staging/prod database.
- `cd server && npm run test:mysql` against `_test` database only.
- Admin browser smoke test over HTTPS.
- Payment webhook idempotency and signature tests.
- Backup creation and restore drill.
- Signed update valid/tampered/rollback drills.
- 24-72h real-device pilot with no P0/P1 issues.

Latest preflight result:

- EXPECTED_FAIL_ON_DEV: `cd server && npm run verify:prod` now executes and reports current blockers:
  `NODE_ENV=development`, `DB_NAME=auto_rejoin_license_test`, `COOKIE_SECURE=false`, and `RATE_LIMIT_ENABLED=false`.

Latest payment hardening result:

- PASS: PayOS webhook signature unit tests cover valid, missing, invalid, and disabled-config cases.

## Safety Boundary

Supported:

- Auto rejoin Roblox game sessions.
- License keys and device management through the admin web dashboard.
- Signed updates.
- Manual validation of a user-provided cookie token.

Disabled by design:

- Raw Roblox cookie injection.
- Raw Roblox cookie export from app storage.
- reCAPTCHA solving or bypass automation.
- Delta/X key bypass automation.
