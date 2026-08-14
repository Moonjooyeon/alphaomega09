#!/bin/sh
set -eu

: "${POSTGRES_URL:?POSTGRES_URL is required}"

backup_dir="${BACKUP_DIR:-/backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="${backup_dir}/sentiguide-${timestamp}.dump"

mkdir -p "$backup_dir"
umask 077
pg_dump --format=custom --no-owner --no-acl --file="$backup_path" "$POSTGRES_URL"

echo "$backup_path"
