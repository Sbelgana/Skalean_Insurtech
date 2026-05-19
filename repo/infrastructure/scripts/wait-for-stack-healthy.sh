#!/usr/bin/env bash
# wait-for-stack-healthy.sh -- Skalean InsurTech v2.2
# Attend que tous les services Docker soient en etat healthy avec timeout
# Usage : bash wait-for-stack-healthy.sh [timeout_seconds]
# Reference: task-1.1.3 (Docker Compose dev stack)
set -euo pipefail

TIMEOUT="${1:-120}"
COMPOSE_FILE="${COMPOSE_FILE:-infrastructure/docker/docker-compose.dev.yaml}"
SERVICES=("postgres" "redis" "kafka" "minio")
START_TIME=$(date +%s)

echo "[wait-for-stack] Waiting for services to be healthy (timeout: ${TIMEOUT}s)..."

check_healthy() {
  local service="$1"
  local status
  status=$(docker compose -f "$COMPOSE_FILE" ps --format json "$service" 2>/dev/null | \
    python3 -c "import sys,json; data=sys.stdin.read(); parsed=json.loads(data) if data.strip() else {}; print(parsed.get('Health','') if isinstance(parsed,dict) else [x.get('Health','') for x in parsed if x.get('Service')=='$service'][0] if isinstance(parsed,list) else '')" 2>/dev/null || echo "unknown")
  [ "$status" = "healthy" ]
}

all_healthy() {
  for service in "${SERVICES[@]}"; do
    if ! check_healthy "$service"; then
      return 1
    fi
  done
  return 0
}

while true; do
  CURRENT_TIME=$(date +%s)
  ELAPSED=$((CURRENT_TIME - START_TIME))

  if all_healthy; then
    echo "[wait-for-stack] All services healthy after ${ELAPSED}s"
    exit 0
  fi

  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "[wait-for-stack] TIMEOUT after ${ELAPSED}s -- services not healthy:"
    docker compose -f "$COMPOSE_FILE" ps 2>/dev/null || true
    exit 1
  fi

  echo "[wait-for-stack] Waiting... (${ELAPSED}/${TIMEOUT}s)"
  sleep 5
done
