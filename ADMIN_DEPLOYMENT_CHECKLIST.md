# Admin Deployment Checklist — Phase 5A

Use this checklist prior to exposing the admin backend or admin dashboard to staging/production environments.

---

## Pre-Deployment Verification

- [ ] **Database Migration**: Run `npm run migrate` in `server/` to ensure `002_create_admin_tables.sql` is applied.
- [ ] **Bootstrap Super Admin**: Run `node scripts/create-admin.js --username <admin_username> --role super_admin` and set a strong password (minimum 12 characters).
- [ ] **Admin Secret Invariant**: Configure `ADMIN_JWT_SECRET` with at least 32 high-entropy random bytes in production `.env`.
- [ ] **Pepper Invariant**: Ensure `LICENSE_KEY_PEPPER` is configured with at least 32 high-entropy random bytes.
- [ ] **HTTPS Enforcement**: Ensure TLS/HTTPS is terminated in front of the API (Nginx, Cloudflare, Caddy).
- [ ] **Cookie Security**: Set `COOKIE_SECURE=true` in production environment so `admin_token` cookies only transmit over HTTPS.
- [ ] **CORS Restriction**: Set `ADMIN_ORIGIN` to the exact domain(s) of the Admin Dashboard (e.g. `https://admin.example.com`). Do not use `*`.
- [ ] **Rate Limiting**: Verify `RATE_LIMIT_ENABLED=true` and confirm `RATE_LIMIT_ADMIN_LOGIN_MAX=10` is active.
- [ ] **Private Database**: Verify MySQL port `3306` is bound strictly to `127.0.0.1` or internal VPC, never exposed to public internet.
- [ ] **Automated Tests**: Run `npm test` and `npm run test:mysql` on the staging host.
- [ ] **Frontend Build**: Run `npm run build` in `admin/` to generate optimized production static assets in `admin/dist/`.

---

## Operational Verification

- [ ] **Admin Login**: Test login via dashboard, confirm HttpOnly cookie and Bearer session token are issued.
- [ ] **Key Creation**: Generate a test license, copy raw key, verify raw key is displayed only once.
- [ ] **Client Activation**: Activate a test client using the generated raw key.
- [ ] **Device Visibility**: Verify device appears in Admin Dashboard with masked installation ID.
- [ ] **Suspend & Reactivate**: Suspend the test license, confirm client validation fails with `SUSPENDED`, reactivate and confirm validation succeeds.
- [ ] **Device Reset**: Reset device from dashboard, verify token is invalidated and slot released.
- [ ] **Audit Trail**: Confirm audit entries appear under Admin Audit Logs.
