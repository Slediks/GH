#!/usr/bin/env bash
set -euo pipefail
target="${1:?Usage: bash scripts/backup.sh backups/DATE}"
if [ -e "$target" ]; then
  printf 'Backup target already exists: %s\n' "$target" >&2
  exit 1
fi
mkdir -p "$target"
chmod 700 "$target"
trap 'docker compose start backend simulation nginx >/dev/null' EXIT
docker compose stop nginx backend simulation
docker compose exec -T postgres pg_dump -U gamehub -d gamehub -Fc > "$target/database.dump"
docker compose run --rm --no-deps -T backend tar -C /data -czf - . > "$target/games.tar.gz"
(cd "$target" && sha256sum database.dump games.tar.gz > SHA256SUMS)
printf 'Backup completed: %s\n' "$target"
