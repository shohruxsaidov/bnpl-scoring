#!/usr/bin/env bash
# Zero-downtime frontend deploy (ADR 0006).
# Builds Vue 3 app, writes to a versioned directory inside the Docker volume,
# then does an atomic symlink swap. nginx picks it up immediately — no reload.
#
# Usage: ./deploy/deploy-frontend.sh <tag>
# Example: ./deploy/deploy-frontend.sh abc1234

set -euo pipefail

TAG=${1:?usage: deploy-frontend.sh <tag>}

# Path inside the frontend-assets Docker volume on the host.
# Adjust if your volume mount point differs.
VOLUME_PATH=$(docker volume inspect scoring_frontend-assets \
    --format '{{ .Mountpoint }}' 2>/dev/null || true)

if [ -z "$VOLUME_PATH" ]; then
    echo "✗ Docker volume 'scoring_frontend-assets' not found. Run 'docker compose up -d nginx' first."
    exit 1
fi

VERSIONED_DIR="$VOLUME_PATH/app-$TAG"
SYMLINK="$VOLUME_PATH/app"

# ── 1. Build the frontend ────────────────────────────────────────────────────
echo "→ building frontend (tag: $TAG) ..."
npm run build --workspace=apps/portal 2>/dev/null \
    || npm run build  # fallback if not in a workspace

# ── 2. Copy build output to versioned directory ──────────────────────────────
echo "→ copying dist to $VERSIONED_DIR ..."
rm -rf "$VERSIONED_DIR"
cp -r dist "$VERSIONED_DIR"

# ── 3. Atomic symlink swap ────────────────────────────────────────────────────
# ln -sfn is atomic on Linux (single rename() syscall). nginx follows the new
# symlink on the next request — open_file_cache off in nginx.conf ensures this.
echo "→ swapping symlink: $SYMLINK → app-$TAG ..."
ln -sfn "$VERSIONED_DIR" "$SYMLINK"

# ── 4. Remove old versioned builds (keep last 3) ────────────────────────────
echo "→ pruning old builds ..."
ls -dt "$VOLUME_PATH"/app-* 2>/dev/null | tail -n +4 | xargs rm -rf || true

echo "✓ frontend deployed (tag: $TAG). No nginx reload needed."
