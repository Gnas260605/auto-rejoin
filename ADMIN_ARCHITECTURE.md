# Auto Rejoin Pro — Admin Architecture

Phase 5A implements the administrative licensing subsystem, providing a complete `/api/v1/admin/*` API namespace and a responsive React Admin Dashboard in `admin/`.

---

## 1. Architectural Topology

```text
┌─────────────────────────────────────────────────────────────┐
│                    Admin Web Browser                        │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / SameSite Cookies
                               ▼
┌─────────────────────────────────────────────────────────────┐
│             React + Vite Admin Dashboard (admin/)           │
│  - Dark-mode responsive UI (Tailwind CSS)                   │
│  - License lifecycle management (Create / Extend / Suspend) │
│  - Device slot allocation & token revocation                │
│  - Audit log observer                                       │
└──────────────────────────────┬──────────────────────────────┘
                               │ /api/v1/admin/*
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Express Admin Router                     │
│  - Helmet security headers & CORS allowlist                 │
│  - Strict admin rate limiters (Login: 10/15m)               │
│  - Admin JWT / Cookie verification middleware               │
│  - Zod request validation                                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Admin Service & Repository                  │
│  - Decoupled from client license token auth                 │
│  - Cryptographic raw key generation (never stored plaintext)│
│  - Immutable audit logging in admin_audit_events            │
└──────────────────────────────┬──────────────────────────────┘
                               │ Prepared SQL Statements
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       MySQL Database                        │
│  - admin_users & admin_audit_events                         │
│  - licenses, license_devices, license_tokens, license_events│
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Credential Security

### Password Storage
- Passwords are encrypted using **bcrypt** with a work factor of 10 (`bcryptjs`).
- Minimum password length is strictly enforced to **12 characters**.
- Plaintext passwords are never persisted to disk or logged to files or console.

### Admin Session Tokens
- Short-lived JSON Web Tokens (JWT) signed with `HMAC-SHA256` using `ADMIN_JWT_SECRET`.
- Transported via **HttpOnly, SameSite (Lax/Strict), Secure** cookie `admin_token`, with fallback Bearer header support for API tooling.
- Admin auth is **100% decoupled** from client license token authentication.

### Admin Bootstrapping
- `server/scripts/create-admin.js` allows interactive password prompting or via `ADMIN_PASSWORD` env var:
```bash
node scripts/create-admin.js --username admin --role super_admin
```

---

## 3. Key Invariant & Privacy Model

1. **One-Time Key Display**: Raw license keys (`AR-XXXX-XXXX-XXXX-XXXX`) are generated with `crypto.randomBytes(16)` and returned to the administrator **only once** upon creation.
2. **Server-Side Hash Storage**: The server stores only `HMAC-SHA256(LICENSE_KEY_PEPPER, normalizedKey)` and safe display fragments (`license_key_prefix` e.g. `AR-ABCD` and `license_key_last4` e.g. `WXYZ`).
3. **Privacy Masking**: Installation IDs are masked across all UI views (e.g. `4444****4444`) to protect client privacy.

---

## 4. Administrative API Namespace (`/api/v1/admin/*`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/admin/auth/login` | Authenticate admin, issue cookie & token | No (Rate Limited) |
| `POST` | `/api/v1/admin/auth/logout` | Clear auth cookie and record audit event | Yes |
| `GET` | `/api/v1/admin/auth/me` | Retrieve current authenticated admin profile | Yes |
| `GET` | `/api/v1/admin/meta/plans` | Retrieve plan tiers & entitlement limits | Yes |
| `GET` | `/api/v1/admin/stats` | Retrieve aggregate licensing statistics | Yes |
| `GET` | `/api/v1/admin/licenses` | List licenses (paginated, searchable, filterable) | Yes |
| `POST` | `/api/v1/admin/licenses` | Create license & receive one-time raw key | Yes |
| `GET` | `/api/v1/admin/licenses/:id` | Get license details, entitlements, and stats | Yes |
| `PATCH` | `/api/v1/admin/licenses/:id` | Update plan, maxDevices, or expiresAt | Yes |
| `POST` | `/api/v1/admin/licenses/:id/extend` | Extend license duration by *N* days | Yes |
| `POST` | `/api/v1/admin/licenses/:id/suspend` | Temporarily suspend license | Yes |
| `POST` | `/api/v1/admin/licenses/:id/reactivate` | Reactivate suspended license | Yes |
| `POST` | `/api/v1/admin/licenses/:id/revoke` | Revoke license & invalidate all tokens | Yes |
| `GET` | `/api/v1/admin/licenses/:id/devices` | List registered devices for license | Yes |
| `POST` | `/api/v1/admin/licenses/:id/devices/:deviceId/revoke` | Reset device (revokes token & frees slot) | Yes |
| `GET` | `/api/v1/admin/licenses/:id/events` | List client runtime events for license | Yes |
| `GET` | `/api/v1/admin/audit-logs` | List immutable admin audit trail | Yes |

---

## 5. License & Device Lifecycle Semantics

```text
           ┌──────────────────────┐
           │        ACTIVE        │
           └───┬──────────────┬───┘
               │              │
      Suspend  │              │ Revoke (Permanent)
               ▼              ▼
      ┌─────────────┐   ┌─────────────┐
      │  SUSPENDED  │   │   REVOKED   │ (Tokens Invalidated)
      └────────┬────┘   └─────────────┘
               │
    Reactivate │
               ▼
      ┌─────────────┐
      │   ACTIVE    │
      └─────────────┘
```

- **Suspend vs Revoke**:
  - `Suspend`: Reversible. Client validation returns `SUSPENDED` error (HTTP 403).
  - `Revoke`: Permanent & irreversible. Immediately revokes all active tokens under the license.
- **Device Reset**:
  - Sets `revoked_at = UTC_TIMESTAMP()` on `license_devices` and revokes associated tokens in `license_tokens`.
  - Frees up the device slot for that license so a new device can activate.
