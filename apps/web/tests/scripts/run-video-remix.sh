#!/usr/bin/env bash
set -euo pipefail

# Run from any directory. The services and files belong exclusively to this run.
app_root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$app_root"
fixture_dir=$(mktemp -d)
containers=()
cleanup() {
  for container in "${containers[@]}"; do docker stop --time 2 "$container" >/dev/null || true; done
  rm -rf "$fixture_dir"
}
trap cleanup EXIT
seed="remix-qa-${fixture_dir##*.}"
db_password='remix-fixture-db-password'
minio_access='remix-fixture-access'
minio_secret='remix-fixture-minio-password'

containers+=("$(docker run --rm -d --name "$seed-pg" -p 127.0.0.1:46395:5432 \
  --tmpfs /var/lib/postgresql/data:rw,size=512m \
  -e POSTGRES_DB=memebank_remix_fixture -e POSTGRES_USER=memebank_remix_fixture \
  -e POSTGRES_PASSWORD="$db_password" timescale/timescaledb:latest-pg16)")
containers+=("$(docker run --rm -d --name "$seed-redis" -p 127.0.0.1:46396:6379 \
  redis:7-alpine redis-server --save "" --appendonly no)")
containers+=("$(docker run --rm -d --name "$seed-minio" -p 127.0.0.1:46397:9000 \
  --tmpfs /data:rw,size=256m -e MINIO_ROOT_USER="$minio_access" \
  -e MINIO_ROOT_PASSWORD="$minio_secret" minio/minio:latest server /data)")

ready=false
for attempt in {1..30}; do
  if docker exec "${containers[0]}" pg_isready -q -h 127.0.0.1 -U memebank_remix_fixture -d memebank_remix_fixture \
    && docker exec "${containers[1]}" redis-cli ping | grep -qx PONG \
    && curl -fsS http://127.0.0.1:46397/minio/health/live >/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
test "$ready" = true || { echo 'Disposable services did not become ready.' >&2; exit 1; }

# Two colors and tones in one GOP. The selected starts are deliberately between keyframes.
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i color=red:size=160x120:rate=25:duration=2 \
  -f lavfi -i sine=frequency=440:duration=2 \
  -f lavfi -i color=blue:size=160x120:rate=25:duration=2 \
  -f lavfi -i sine=frequency=880:duration=2 \
  -filter_complex '[0:v][1:a][2:v][3:a]concat=n=2:v=1:a=1[v][a]' \
  -map '[v]' -map '[a]' -c:v libx264 -g 250 -keyint_min 250 -sc_threshold 0 \
  -pix_fmt yuv420p -c:a aac -movflags +faststart "$fixture_dir/source.mp4"

env -i HOME="$HOME" PATH="$PATH" ENV_PATH="$fixture_dir" NODE_ENV=test \
  HOST=127.0.0.1 PORT=46398 APP_KEY=remix-fixture-key-0123456789abcdef LOG_LEVEL=warn \
  SESSION_DRIVER=cookie DB_HOST=127.0.0.1 DB_PORT=46395 DB_DATABASE=memebank_remix_fixture \
  DB_USER=memebank_remix_fixture DB_PASSWORD="$db_password" REDIS_HOST=127.0.0.1 REDIS_PORT=46396 \
  MINIO_ENDPOINT=http://127.0.0.1:46397 MINIO_ACCESS_KEY="$minio_access" \
  MINIO_SECRET_KEY="$minio_secret" MINIO_BUCKET=memebank-remix-fixture \
  MINIO_PRIVATE_BUCKET=memebank-remix-fixture-private MEMEBANK_REMIX_TESTS=1 \
  MEMEBANK_REMIX_TEST_FILE="$fixture_dir/source.mp4" node ace test functional --files=video_remix.spec.ts
