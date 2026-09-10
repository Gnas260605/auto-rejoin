# Auto Rejoin Pro License Server

License authority backend for Auto Rejoin Pro.

## Setup

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` with a dedicated MySQL database and a strong
`LICENSE_KEY_PEPPER`. Do not reuse production credentials for tests.

## Migrate

```bash
npm run migrate
```

The migration creates:

- `licenses`
- `license_devices`
- `license_tokens`
- `license_events`
- `schema_migrations`

## Start

```bash
npm start
```

Health:

```bash
curl http://127.0.0.1:3000/api/v1/health
```

## Create A Development License

```bash
node scripts/create-license.js --plan pro --devices 3 --days 30
```

The raw key is printed once and is not stored in the database.

## Client Configuration

Point the shell client at the backend:

```bash
export AUTO_REJOIN_LICENSE_API="https://license.example.com"
bin/roblox-manager license activate "AR-XXXX-XXXX-XXXX-XXXX"
bin/roblox-manager license validate
bin/roblox-manager license status
bin/roblox-manager license deactivate
```

For local HTTP-only development:

```bash
export AUTO_REJOIN_LICENSE_API="http://127.0.0.1:3000"
export AUTO_REJOIN_LICENSE_ALLOW_HTTP_DEV=true
```

Production enforcement mode:

```bash
export AUTO_REJOIN_LICENSE_MODE=required
export AUTO_REJOIN_LICENSE_API="https://license.example.com"
```

Maintenance response fields can be enabled with:

```env
LICENSE_MAINTENANCE_MODE=true
LICENSE_MAINTENANCE_ALLOW_CACHE=true
LICENSE_MAINTENANCE_MESSAGE=License service maintenance
```

## Testing

```bash
npm run check
npm test
npm run test:mysql
```

These tests cover service behavior and HTTP contract compatibility with the
Phase 4A shell client. `npm run test:mysql` uses the configured MySQL database
and refuses database names that do not end with `_test`.

## Security Notes

- No plaintext license keys are stored.
- License keys are HMAC-SHA256 hashed with `LICENSE_KEY_PEPPER`.
- Client tokens are random opaque values and only token hashes are stored.
- Request bodies are limited to 16kb.
- Activation, validation, and deactivation routes are rate limited by default.
- Logs must not contain raw keys, tokens, DB passwords, or pepper values.
