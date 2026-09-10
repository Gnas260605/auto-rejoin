# Auto Rejoin Pro Server Architecture

Phase 4B adds the license authority backend. It does not add payment, a React
dashboard, production deployment automation, obfuscation, or anti-tamper.

## Runtime

- Node.js
- Express
- MySQL via `mysql2/promise`
- dotenv configuration
- helmet security headers
- express-rate-limit
- zod request validation

## Directory Layout

```text
server/
  src/app.js
  src/server.js
  src/config/env.js
  src/db/pool.js
  src/db/migrate.js
  src/db/migrations/001_create_license_tables.sql
  src/routes/license.routes.js
  src/controllers/license.controller.js
  src/services/license.service.js
  src/repositories/license.repository.js
  src/middleware/error.middleware.js
  src/middleware/rate-limit.middleware.js
  src/utils/token.js
  src/utils/time.js
  src/utils/response.js
  src/utils/logger.js
  src/constants/license.js
  scripts/create-license.js
  tests/
```

## Request Flow

```text
Express route
-> zod request validation
-> license controller
-> license service
-> repository prepared statements
-> MySQL tables
```

Activation runs inside a repository transaction. The MySQL repository uses
`SELECT ... FOR UPDATE` on the license row before checking active device count,
creating/updating a device, and issuing a token. This prevents two new devices
from consuming the same last slot at the same time.

## Tables

- `licenses`: HMAC-SHA256 license key hash, key display prefix/last4, plan,
  status, max device slots, expiry.
- `license_devices`: installation id, platform, executor, client version, first
  activation, last seen, revocation timestamp.
- `license_tokens`: SHA-256 token hash, token expiry, revocation timestamp, last
  used timestamp.
- `license_events`: audit events without raw license keys or raw tokens.

## Key And Token Security

License keys are normalized and hashed with:

```text
HMAC-SHA256(LICENSE_KEY_PEPPER, normalizedKey)
```

The pepper is read from environment config and is never stored in the database.

Client tokens are generated with `crypto.randomBytes(48).toString("base64url")`.
Only `SHA-256(token)` is stored because the token is high entropy.

## Entitlements

Plan features are centralized in `server/src/constants/license.js`.

`max_devices` controls license device slots. `maxInstances` is a product
entitlement returned by plan mapping. These are intentionally separate.

## API Contract

The backend matches Phase 4A client endpoints:

```text
GET  /api/v1/health
POST /api/v1/licenses/activate
POST /api/v1/licenses/validate
POST /api/v1/licenses/deactivate
```

Errors return canonical nested shape and legacy top-level fields:

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

The top-level `code/message` fields keep `lib/license.sh` compatible without a
larger client redesign.

## Maintenance Mode

Validation and activation responses can include:

```json
{
  "maintenance": {
    "enabled": true,
    "allowCachedEntitlements": true,
    "message": "License service maintenance"
  }
}
```

Environment controls:

```text
LICENSE_MAINTENANCE_MODE
LICENSE_MAINTENANCE_ALLOW_CACHE
LICENSE_MAINTENANCE_MESSAGE
```

Phase 4C.2 clients can use this to avoid locking customers out during planned
license backend maintenance when cached entitlements are explicitly allowed.

## Logging

Backend logs are JSON lines from `utils/logger.js`. Secret-like fields such as
`licenseKey`, `token`, `pepper`, and `password` are redacted before logging.

## MySQL Integration Status

Automated service and HTTP contract tests use repository mocks by default.
`npm run test:mysql` runs the real MySQL integration path and refuses database
names that do not end with `_test`. Do not run migrations against a production
database.
