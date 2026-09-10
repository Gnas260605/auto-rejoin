# Auto Rejoin Pro License Architecture

Phase 4A added the local client foundation. Phase 4B adds the Node.js,
Express, and MySQL backend authority. Payment, dashboard, production deployment,
obfuscation, and anti-tamper layers are intentionally pending.

## Goals

- Keep license enforcement optional until a real backend exists.
- Never collect or store Roblox passwords, cookies, or `.ROBLOSECURITY`.
- Never inject, patch, hook, or bypass Roblox anti-cheat.
- Store a random installation identity and an opaque license token only.
- Use Node.js / Express / MySQL as the authoritative source for plans,
  entitlements, expiry, device slots, and revocation.

## Trust Model

The client is not a security boundary. It can provide honest UX, local caching,
and early validation, but the backend must remain authoritative for:

- license key validity;
- subscription/payment status;
- plan and feature entitlements;
- expiry;
- device slot accounting;
- revocation;
- update eligibility.

The local cache is a convenience layer for offline operation. It must not be
treated as proof of purchase by future hosted services.

## Installation Identity

`lib/license.sh` creates a random UUID installation id at:

```text
${AUTO_REJOIN_APP_DIR:-$HOME/.auto-rejoin}/installation_id
```

The file is created with best-effort `0600` permissions. If the file exists but
does not look like a UUID, the client backs it up as
`installation_id.corrupt.<timestamp>` and creates a new id.

The id is deliberately not derived from Android hardware identifiers. This keeps
Phase 4A privacy-preserving and portable across Termux-like environments.

## API Contract

The current client expects these backend endpoints:

```text
POST /api/v1/licenses/activate
POST /api/v1/licenses/validate
POST /api/v1/licenses/deactivate
```

Activation request:

```json
{
  "licenseKey": "AR-XXXX-XXXX-XXXX-XXXX",
  "installationId": "uuid",
  "clientVersion": "4.0.0-dev",
  "device": {
    "platform": "android-termux",
    "executor": "root|adb|unknown"
  }
}
```

Validation request:

```json
{
  "installationId": "uuid",
  "clientVersion": "4.0.0-dev",
  "token": "opaque-server-token"
}
```

Successful responses should include:

```json
{
  "valid": true,
  "licenseId": "lic_xxx",
  "plan": "pro",
  "expiresAt": "2026-12-31T23:59:59Z",
  "maxInstances": 20,
  "features": ["monitor", "profiles", "installer"],
  "revalidateAfter": 3600,
  "serverTime": "2026-09-10T00:00:00Z",
  "token": "opaque-server-token"
}
```

Failure responses return `valid: false`, a canonical nested `error`, and
top-level `code/message` fields for Phase 4A shell-client compatibility:

```json
{
  "valid": false,
  "code": "DEVICE_LIMIT",
  "message": "Device limit reached",
  "error": {
    "code": "DEVICE_LIMIT",
    "message": "Device limit reached"
  },
  "serverTime": "2026-09-10T00:00:00.000Z"
}
```

Stable codes include:

```text
INVALID_KEY
EXPIRED
REVOKED
DEVICE_LIMIT
SERVER_ERROR
NETWORK_ERROR
MALFORMED_RESPONSE
```

## Transport Policy

Production license API URLs must use HTTPS. Plain HTTP is rejected unless
`AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV=true` is explicitly set for local mock
server testing.

All license network calls go through `lib/network.sh`, which provides timeout
and retry behavior.

## Token And Cache

The local cache is stored at:

```text
${AUTO_REJOIN_APP_DIR:-$HOME/.auto-rejoin}/license_cache.json
```

It stores:

- status;
- license id;
- plan;
- expiry;
- max instances;
- feature list;
- server time;
- last validation epoch;
- revalidation interval;
- opaque token.

It does not store the raw license key. CLI output masks license keys and never
prints the opaque token.

## Offline Grace

`LICENSE_OFFLINE_GRACE_SECONDS` defaults to 86400 seconds. A cached valid
license can report offline grace as available while the last validation timestamp
is still inside that window.

If the local clock appears to move backward, the client chooses to revalidate
instead of extending cache freshness.

## Feature Entitlements

Feature checks are string-based in Phase 4A:

```bash
license_has_feature installer
license_has_feature profiles
```

Future phases can map these feature names to paid plan limits, dashboard
permissions, profile limits, update channels, and support tiers.

## Production Enforcement

Phase 4C.2 adds central client-side gates in `lib/entitlement.sh`.

License modes:

- `disabled`: no license checks.
- `optional`: activated licenses provide entitlements, but missing licenses keep
  legacy development behavior.
- `required`: protected actions require a valid license, a valid cache inside
  offline grace, or a maintenance policy that allows cached entitlements.

Protected actions include monitor start, installer, profiles, Discord sending,
and maxInstances admission. Diagnostic and recovery commands remain accessible:
`help`, `version`, `doctor`, `parse-link`, and `license`.

maxInstances is enforced against active runtime locks, not installed Roblox
packages, saved profiles, or config files. A short-lived admission lock prevents
concurrent starts from bypassing the limit.

If an entitlement reduction leaves more monitors running than the new limit,
existing processes continue. New starts are blocked until active count falls
below the limit.

Fresh server responses for `REVOKED`, `EXPIRED`, `SUSPENDED`, invalid token, or
installation mismatch override stale valid cache for new protected operations.
Network/server outages can use offline grace when available.

## CLI Commands

```bash
bin/roblox-manager license status
bin/roblox-manager license activate <KEY>
bin/roblox-manager license validate
bin/roblox-manager license deactivate [--local-only]
```

`--local-only` clears the local cache without contacting the server and warns
that the server device slot is not released.

## Doctor Integration

`roblox-manager doctor` reports license mode, API configuration, `jq`
availability, installation id availability, local cache status, and activation
state. License mode is optional by default, so a missing backend is a warning,
not a hard failure.

## Future Backend Notes

Phase 4B implements the authoritative backend with Node.js, Express, and MySQL.
Current tables:

- licenses;
- license_devices;
- license_tokens;
- license_events;

The backend hashes license keys with HMAC-SHA256 and `LICENSE_KEY_PEPPER`,
stores only token hashes, rate-limits license endpoints, audits device changes,
and avoids logging secrets. Future dashboard phases may add normalized plans,
feature entitlement tables, update channels, and admin APIs.
