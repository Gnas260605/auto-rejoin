#!/usr/bin/env bash
# ==============================================================================
# Auto Rejoin Pro — Automated MySQL Database Backup Script
# Usage:
#   1. Thêm quyền thực thi: chmod +x backup-db.sh
#   2. Thêm vào crontab: 0 2 * * * /opt/auto-rejoin/server/scripts/backup-db.sh
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/mysql/auto_rejoin}"
DB_NAME="${DB_NAME:-auto_rejoin_license}"
DB_USER="${DB_USER:-auto_rejoin_app}"
DB_PASS="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"

# Tạo thư mục backup nếu chưa tồn tại
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup for database: ${DB_NAME}..."

# Dump database với gzip
if [ -n "$DB_PASS" ]; then
  mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" --password="$DB_PASS" \
    --single-transaction --quick --routines --triggers "$DB_NAME" | gzip > "$BACKUP_FILE"
else
  mysqldump --host="$DB_HOST" --port="$DB_PORT" --user="$DB_USER" \
    --single-transaction --quick --routines --triggers "$DB_NAME" | gzip > "$BACKUP_FILE"
fi

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

# Tự động dọn dẹp các file backup cũ hơn 30 ngày
find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -mtime +30 -delete
echo "[$(date)] Cleaned up backups older than 30 days."
