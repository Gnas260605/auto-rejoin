# Server Deployment & Production Hardening Checklist — Phase 5B

This document defines the production server setup, security hardening, database least-privilege provisioning, HTTPS reverse proxy configuration, and operational recovery procedures.

---

## 1. Production MySQL Setup & Least Privilege

### Step 1: Create Dedicated Production Database
```sql
CREATE DATABASE IF NOT EXISTS auto_rejoin_license
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

### Step 2: Create Dedicated Runtime Application User (Least Privilege)
The runtime application user needs only `SELECT, INSERT, UPDATE, DELETE` permissions on the operational tables.
```sql
CREATE USER 'auto_rejoin_app'@'127.0.0.1' IDENTIFIED BY 'STRONG_GENERATED_PASSWORD_HERE';

GRANT SELECT, INSERT, UPDATE, DELETE ON auto_rejoin_license.* TO 'auto_rejoin_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

> [!NOTE]
> For running schema migrations (`001_create_license_tables.sql`, `002_create_admin_tables.sql`), the migration runner requires `CREATE, INDEX, ALTER, REFERENCES` permissions. You may either use a designated migration user or grant migration privileges during deployment windows:
> ```sql
> GRANT CREATE, INDEX, ALTER, REFERENCES ON auto_rejoin_license.* TO 'auto_rejoin_app'@'127.0.0.1';
> FLUSH PRIVILEGES;
> ```

### Step 3: MySQL Network Binding
Verify `/etc/mysql/mysql.conf.d/mysqld.cnf` (or `/etc/my.cnf`) contains:
```ini
bind-address = 127.0.0.1
```
Never expose port `3306` to public IP addresses.

---

## 2. Production Secret Generation

Generate all production cryptographic secrets using OpenSSL or Node.js native crypto:

```bash
# 1. Pepper for License Key HMAC-SHA256 (32 bytes base64)
openssl rand -base64 32

# 2. Secret for Admin Session JWT (32 bytes base64)
openssl rand -base64 32

# 3. Database Password (24+ characters)
openssl rand -base64 24
```

> [!CAUTION]
> Back up `LICENSE_KEY_PEPPER` securely in offline password vaults. If the pepper is lost or modified, all existing active licenses will fail validation because their HMAC hashes cannot be reproduced.

---

## 3. Reverse Proxy & HTTPS Architecture

### Option A: Subdomain Topology (Recommended)
- **API Domain**: `https://license.yourdomain.com`
- **Admin Dashboard Domain**: `https://admin.yourdomain.com`

#### Sample Nginx Configuration
```nginx
# 1. API Reverse Proxy
server {
    listen 443 ssl http2;
    server_name license.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/license.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/license.yourdomain.com/privkey.pem;

    # Security Headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. Admin Dashboard Static Files
server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem;

    root /var/www/auto-rejoin-admin/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

### Option B: Caddyfile Configuration (Automatic TLS)
```caddy
license.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}

admin.yourdomain.com {
    root * /var/www/auto-rejoin-admin/dist
    file_server
    try_files {path} /index.html
}
```

---

## 4. Process Management (Systemd)

Create `/etc/systemd/system/auto-rejoin-license.service`:

```ini
[Unit]
Description=Auto Rejoin Pro License Authority
After=network.target mysql.service

[Service]
Type=simple
User=nodeapp
WorkingDirectory=/opt/auto-rejoin/server
EnvironmentFile=/opt/auto-rejoin/server/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable auto-rejoin-license
sudo systemctl start auto-rejoin-license
```

---

## 5. Automated Database Backup & Recovery

### Daily Backup Script (`/opt/scripts/backup-db.sh`)
```bash
#!/usr/bin/env bash
set -euo pipefail
BACKUP_DIR="/var/backups/mysql/auto_rejoin"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

mysqldump --single-transaction --quick --routines --triggers \
  -u auto_rejoin_backup -p'BACKUP_USER_PASSWORD' auto_rejoin_license \
  | gzip > "${BACKUP_DIR}/license_db_${TIMESTAMP}.sql.gz"

# Retain backups for 30 days
find "$BACKUP_DIR" -name "license_db_*.sql.gz" -mtime +30 -delete
```

### Test Restore Procedure
```bash
gunzip < /var/backups/mysql/auto_rejoin/license_db_TIMESTAMP.sql.gz \
  | mysql -u root -p auto_rejoin_license_restore_test
```

---

## 6. Pre-Launch Verification Checklist

- [ ] `auto_rejoin_license` database created with `utf8mb4`.
- [ ] Dedicated DB user configured with least privilege.
- [ ] `001` and `002` migrations applied successfully.
- [ ] Re-running migrations is idempotent and causes zero duplicate errors.
- [ ] `ADMIN_JWT_SECRET` generated with 32+ random bytes.
- [ ] `LICENSE_KEY_PEPPER` generated with 32+ random bytes and backed up offline.
- [ ] Initial super admin created via `node scripts/create-admin.js`.
- [ ] HTTPS active on reverse proxy with valid TLS certificate.
- [ ] Admin Dashboard production bundle deployed to static host directory.
- [ ] `COOKIE_SECURE=true` and exact `ADMIN_ORIGIN` set in `.env`.
- [ ] `GET /api/v1/health` returns `200 OK` without leaking system internals.
- [ ] Daily database backup cron job active.
