#!/bin/bash
# Deploy license server lên VPS (chạy TRÊN VPS, quyền root).
# Chuẩn bị: từ máy dev, đóng gói thư mục server/ (bỏ node_modules, .env, tests) thành
#   /var/www/shopblox-tool/tool_payload.tar.gz rồi chạy: bash deploy-vps.sh
# Container: tool-server trên mạng shopblox_app-network, DB riêng auto_rejoin_license trong shopblox-db.
# Secret sinh 1 lần ở /var/www/shopblox-tool/.env (600). Quay lại: docker rm -f tool-server.
set -euo pipefail

APP_DIR=/var/www/shopblox-tool
SECRETS_DIR=/var/www/shopblox-secrets
BACKUP_DIR=/root/backups
NET=shopblox_app-network
TS=$(date +%Y%m%d-%H%M%S)
IMAGE="auto-rejoin-tool:${TS}"

gen() { openssl rand -base64 64 | tr -dc 'A-Za-z0-9' | cut -c1-48; }
dbroot() { docker exec -i shopblox-db sh -c 'mariadb -u root -p"$MARIADB_ROOT_PASSWORD" "$@"' -- "$@"; }

echo "== 1. Sao luu DB shop"
mkdir -p "$BACKUP_DIR"
docker exec shopblox-db sh -c 'mariadb-dump -u root -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines shopblox' | gzip > "$BACKUP_DIR/shopblox-pre-tool-${TS}.sql.gz"
ls -lh "$BACKUP_DIR/shopblox-pre-tool-${TS}.sql.gz" | awk '{print "   backup:", $5, $9}'

echo "== 2. Giai nen code"
mkdir -p "$APP_DIR/src" "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"
rm -rf "$APP_DIR/src.new" && mkdir -p "$APP_DIR/src.new"
tar -xzf "$APP_DIR/tool_payload.tar.gz" -C "$APP_DIR/src.new"
rm -f "$APP_DIR/tool_payload.tar.gz"
[ -d "$APP_DIR/src.old" ] && rm -rf "$APP_DIR/src.old"
[ -d "$APP_DIR/src" ] && mv "$APP_DIR/src" "$APP_DIR/src.old"
mv "$APP_DIR/src.new" "$APP_DIR/src"

echo "== 3. Secret (chi sinh lan dau)"
ENV_FILE="$APP_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  umask 077
  cat > "$ENV_FILE" <<ENV
NODE_ENV=production
PORT=3000
# Cloudflare -> nginx host -> nginx frontend -> tool-server
TRUST_PROXY=3
DB_HOST=db
DB_PORT=3306
DB_USER=auto_rejoin_app
DB_PASSWORD=$(gen)
DB_NAME=auto_rejoin_license
# KHONG BAO GIO DOI: doi la toan bo license key khong kiem tra duoc nua
LICENSE_KEY_PEPPER=$(gen)
LICENSE_TOKEN_TTL_SECONDS=2592000
LICENSE_REVALIDATE_AFTER_SECONDS=3600
MIN_CLIENT_VERSION=4.0.0
ADMIN_JWT_SECRET=$(gen)
CUSTOMER_JWT_SECRET=$(gen)
INTERNAL_API_KEY=$(gen)
PAYMENT_WEBHOOK_SECRET=$(gen)
ADMIN_ORIGIN=https://taphoasandg.com,https://www.taphoasandg.com
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
RATE_LIMIT_ENABLED=true
ENV
  echo "   da tao $ENV_FILE (600)"
else
  echo "   giu nguyen $ENV_FILE"
fi
chmod 600 "$ENV_FILE"
envget() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }

echo "== 4. Database rieng cho license server"
APP_PW="$(envget DB_PASSWORD)"
dbroot -e "CREATE DATABASE IF NOT EXISTS auto_rejoin_license CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'auto_rejoin_app'@'%' IDENTIFIED BY '${APP_PW}';
ALTER USER 'auto_rejoin_app'@'%' IDENTIFIED BY '${APP_PW}';
GRANT ALL PRIVILEGES ON auto_rejoin_license.* TO 'auto_rejoin_app'@'%';
FLUSH PRIVILEGES;"
echo "   ok"

echo "== 5. Build image"
docker build -q -t "$IMAGE" "$APP_DIR/src" | sed 's/^/   /'

echo "== 6. Migration"
docker run --rm --network "$NET" --env-file "$ENV_FILE" "$IMAGE" node src/db/migrate.js | sed 's/^/   /'

echo "== 7. Chay container tool-server"
docker rm -f tool-server >/dev/null 2>&1 || true
docker run -d --name tool-server --network "$NET" --network-alias tool-server \
  --env-file "$ENV_FILE" --restart unless-stopped --memory 384m \
  --log-opt max-size=10m --log-opt max-file=3 "$IMAGE" >/dev/null
for i in $(seq 1 30); do
  if docker exec tool-server wget -qO- http://127.0.0.1:3000/api/v1/health >/dev/null 2>&1; then echo "   health ok sau ${i}s"; break; fi
  sleep 1
  [ "$i" = 30 ] && { echo "   HEALTH FAIL"; docker logs --tail 40 tool-server; exit 1; }
done

echo "== 8. Ma hoa key cu + kiem tra san sang production"
docker exec tool-server node scripts/encrypt-issued-keys.js | sed 's/^/   /'
docker exec tool-server node scripts/verify-production-readiness.js | grep -E "PASS|FAIL" | sed 's/\x1b\[[0-9;]*m//g; s/^/   /' || true

echo "== 9. Noi Shop backend -> tool-server"
SHOP_ENV="$SECRETS_DIR/shop-backend.env"
umask 077
cat > "$SHOP_ENV" <<ENV
# Bien bo sung cho shopblox-backend (dotenv chi dien bien compose chua co). Deploy script copy file nay vao /app/.env.
TOOL_SERVER_URL=http://tool-server:3000
TOOL_INTERNAL_API_KEY=$(envget INTERNAL_API_KEY)
ENV
chmod 600 "$SHOP_ENV"
docker cp "$SHOP_ENV" shopblox-backend:/app/.env
dbroot shopblox -e "INSERT INTO settings (\`key\`, \`value\`) VALUES ('auto_rejoin_license_api', 'https://taphoasandg.com') ON DUPLICATE KEY UPDATE \`value\` = VALUES(\`value\`);"
docker restart shopblox-backend >/dev/null
for i in $(seq 1 40); do
  if docker exec shopblox-backend node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then echo "   shop backend health ok sau ${i}s"; break; fi
  sleep 1
  [ "$i" = 40 ] && { echo "   SHOP HEALTH FAIL"; exit 1; }
done

echo "== 10. Dong bo key Shop da ban sang tool-server"
docker exec shopblox-backend node -e "
require('./src/config/env');
const pool = require('./src/config/db');
const sync = require('./src/services/licenseSyncService');
(async () => {
  const [rows] = await pool.query(\"SELECT key_code, plan_code, max_devices, duration_days, expires_at FROM license_keys WHERE status = 'active' AND key_code IS NOT NULL\");
  for (const r of rows) {
    await sync.syncCreateLicense({ rawKey: r.key_code, planCode: r.plan_code, maxDevices: r.max_devices, expiresAt: r.expires_at, durationDays: r.duration_days });
  }
  console.log('   da gui', rows.length, 'key');
  process.exit(0);
})().catch((e) => { console.error('   sync loi:', e.message); process.exit(1); });
" 2>&1 | grep -v "injected env" | sed 's/^\s*//; s/^/   /'
dbroot auto_rejoin_license -N -e "SELECT CONCAT('   tool-server co ', COUNT(*), ' license') FROM licenses;"

echo "== 11. Don image cu"
docker images auto-rejoin-tool --format '{{.Repository}}:{{.Tag}}' | grep -v "$TS" | tail -n +3 | xargs -r docker rmi >/dev/null 2>&1 || true
echo "DONE ${TS}"
