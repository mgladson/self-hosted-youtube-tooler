#!/bin/sh
set -eu

# ---- PostgreSQL Backup Script ----
# Runs pg_dump against the postgres container and stores compressed .sql.gz files.
# Retention: keeps last 30 daily backups, deletes older ones.
#
# Usage:
#   ./docker/backup.sh                  # manual run
#   crontab -e → 0 3 * * * cd /path/to/project && ./docker/backup.sh  # daily at 3am

BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
RETAIN_DAYS=30

mkdir -p "$BACKUP_DIR"

# Load env vars from .env if present
ENV_FILE="$(cd "$(dirname "$0")/.." && pwd)/.env"
if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

DB_NAME="${POSTGRES_DB:-shopify_stack}"
DB_USER="${POSTGRES_USER:-postgres}"
CONTAINER_NAME="$(docker compose ps -q postgres 2>/dev/null || true)"

if [ -z "$CONTAINER_NAME" ]; then
  echo "ERROR: postgres container is not running. Start it with: docker compose up -d postgres"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Backing up database '$DB_NAME' ..."

docker compose exec -T postgres pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "$BACKUP_FILE"

FILE_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "Backup saved: $BACKUP_FILE ($FILE_SIZE)"

# Prune old backups
DELETED=0
find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETAIN_DAYS | while read -r old_file; do
  rm -f "$old_file"
  DELETED=$((DELETED + 1))
  echo "Pruned old backup: $old_file"
done

echo "Done. Backups older than $RETAIN_DAYS days pruned."
