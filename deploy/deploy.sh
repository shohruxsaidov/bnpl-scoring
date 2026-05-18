#!/usr/bin/env bash
# Zero-downtime blue-green deploy (ADR 0006).
# Usage: ./deploy/deploy.sh <image-tag>
# Example: ./deploy/deploy.sh abc1234

set -euo pipefail

TAG=${1:?usage: deploy.sh <image-tag>}
COMPOSE="docker compose"
ACTIVE_SLOT_FILE="deploy/nginx/active-slot"
ENV_FILE=".env"

# ── 1. Determine current active slot ────────────────────────────────────────
if grep -q "app-blue" "$ACTIVE_SLOT_FILE"; then
    CURRENT_SLOT="app-blue"
    CURRENT_TAG_VAR="BLUE_TAG"
    NEXT_SLOT="app-green"
    NEXT_TAG_VAR="GREEN_TAG"
else
    CURRENT_SLOT="app-green"
    CURRENT_TAG_VAR="GREEN_TAG"
    NEXT_SLOT="app-blue"
    NEXT_TAG_VAR="BLUE_TAG"
fi

echo "→ current slot: $CURRENT_SLOT | next slot: $NEXT_SLOT | tag: $TAG"

# ── 2. Write new tag into .env for the idle slot ─────────────────────────────
sed -i.bak "s/^${NEXT_TAG_VAR}=.*/${NEXT_TAG_VAR}=${TAG}/" "$ENV_FILE"
rm -f "${ENV_FILE}.bak"

# ── 3. Start the idle slot (pull new image, start container) ─────────────────
echo "→ starting $NEXT_SLOT with tag $TAG ..."
$COMPOSE pull "$NEXT_SLOT" 2>/dev/null || true
$COMPOSE up -d --no-deps --remove-orphans "$NEXT_SLOT"

# ── 4. Wait for the new container to become healthy ──────────────────────────
echo -n "→ waiting for $NEXT_SLOT to be healthy ."
RETRIES=30
until [ "$($COMPOSE ps --format json "$NEXT_SLOT" | \
           docker inspect --format='{{.State.Health.Status}}' \
           "$(docker compose ps -q "$NEXT_SLOT")" 2>/dev/null)" = "healthy" ]; do
    RETRIES=$((RETRIES - 1))
    if [ "$RETRIES" -eq 0 ]; then
        echo ""
        echo "✗ $NEXT_SLOT did not become healthy — aborting. Current slot unchanged."
        $COMPOSE stop "$NEXT_SLOT"
        exit 1
    fi
    sleep 3
    echo -n "."
done
echo " healthy"

# ── 5. Flip nginx to the new slot (zero-downtime HUP) ────────────────────────
echo "→ flipping nginx to $NEXT_SLOT ..."
cat > "$ACTIVE_SLOT_FILE" <<EOF
# Active backend slot — managed by deploy.sh, do not edit manually.
# deploy.sh rewrites this file then sends: docker compose kill -s HUP nginx

upstream scoring_active {
    server ${NEXT_SLOT}:3000;
    keepalive 32;
}
EOF

docker compose kill -s HUP nginx
echo "→ nginx reloaded"

# ── 6. Stop the old slot ─────────────────────────────────────────────────────
echo "→ stopping old slot $CURRENT_SLOT ..."
$COMPOSE stop "$CURRENT_SLOT"

# Update old slot tag to match so state is clean on next run
sed -i.bak "s/^${CURRENT_TAG_VAR}=.*/${CURRENT_TAG_VAR}=${TAG}/" "$ENV_FILE"
rm -f "${ENV_FILE}.bak"

echo "✓ deployed $TAG → $NEXT_SLOT. Next deploy will use $CURRENT_SLOT."
