#!/usr/bin/env bash

# Auto Rejoin Pro - MySQL backup script.
#
# Usage:
#   chmod +x server/scripts/backup-db.sh
#   BACKUP_DIR=/var/backups/mysql/auto_rejoin \
#   DB_NAME=auto_rejoin_license \
#   DB_USER=auto_rejoin_backup \
#   DB_PASSWORD=... \
#   server/scripts/backup-db.sh

set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/var/backups/mysql/auto_rejoin}"
DB_NAME="${DB_NAME:-auto_rejoin_license}"
DB_USER="${DB_USER:-auto_rejoin_app}"
DB_PASS="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql.gz"
PARTIAL_FILE="${BACKUP_FILE}.part"

mkdir -p "$BACKUP_DIR"
rm -f "$PARTIAL_FILE"

echo "[$(date)] Starting backup for database: ${DB_NAME}..."

dump_args=(
  --host="$DB_HOST"
  --port="$DB_PORT"
  --user="$DB_USER"
  --single-transaction
  --quick
  --routines
  --triggers
  "$DB_NAME"
)

if [ -n "$DB_PASS" ]; then
  MYSQL_PWD="$DB_PASS" mysqldump "${dump_args[@]}" | gzip > "$PARTIAL_FILE"
else
  mysqldump "${dump_args[@]}" | gzip > "$PARTIAL_FILE"
fi

gzip -t "$PARTIAL_FILE"
mv "$PARTIAL_FILE" "$BACKUP_FILE"

echo "[$(date)] Backup completed successfully: ${BACKUP_FILE} ($(du -h "$BACKUP_FILE" | cut -f1))"

find "$BACKUP_DIR" -name "${DB_NAME}_backup_*.sql.gz" -mtime +"$BACKUP_RETENTION_DAYS" -delete
echo "[$(date)] Cleaned up backups older than ${BACKUP_RETENTION_DAYS} days."
