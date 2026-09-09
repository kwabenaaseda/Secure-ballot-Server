#!/usr/bin/env bash
# vendor-client.sh — build the React client and vendor it into client-dist/ so
# the server can serve the whole system (UI + API + docs) from one origin and
# be packaged as a self-contained, installable PWA (Docker, deploy platform).
#
# Usage:
#   ./vendor-client.sh [path/to/client/repo]   (default: ../Secure-ballot-Client)
set -euo pipefail

CLIENT_DIR="${1:-../Secure-ballot-Client}"
SERVER_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIST="$SERVER_ROOT/client-dist"

echo "▸ Building client at $CLIENT_DIR"
(
  cd "$CLIENT_DIR"
  # Reuse existing install if present; the frozen lockfile can 404 on stale
  # registry tarballs, so don't force a reinstall unless deps are missing.
  if [ ! -d node_modules ]; then
    bun install >/dev/null || bun install --no-frozen-lockfile >/dev/null
  fi
  bun run build
)

echo "▸ Vendoring client build into $CLIENT_DIST"
rm -rf "$CLIENT_DIST"
cp -r "$CLIENT_DIR/dist" "$CLIENT_DIST"

echo "▸ Done. client-dist/ now contains:"
find "$CLIENT_DIST" -maxdepth 2 -type f | sed "s#$SERVER_ROOT/##" | head -30
echo ""
echo "▸ To run the self-contained system locally:"
echo "    bun run build && bun dist/server.js"
echo "    # then open http://localhost:3000 (UI) and /api/docs (Swagger)"