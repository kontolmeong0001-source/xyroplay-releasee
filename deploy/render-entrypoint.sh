#!/bin/sh
set -eu
DATA_DIR="$(dirname "${XYROPLAY_DB:-/var/lib/xyroplay/xyroplay.sqlite3}")"
mkdir -p "$DATA_DIR"
chown xyroplay:xyroplay "$DATA_DIR"
chmod 700 "$DATA_DIR"
PORT="${PORT:-5000}"
case "$PORT" in
  ''|*[!0-9]*) echo "Invalid PORT: $PORT" >&2; exit 2 ;;
esac
exec su -s /bin/sh xyroplay -c "exec gunicorn --bind=0.0.0.0:${PORT} --workers=2 --timeout=30 app:app"
