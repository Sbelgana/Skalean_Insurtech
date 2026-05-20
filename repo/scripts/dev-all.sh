#!/usr/bin/env bash
set -euo pipefail

# Skalean InsurTech -- Lance les 7 apps Next.js en parallele
# Usage : pnpm dev:all
# Pre-requis : machine 16+ GB RAM minimum (consommation ~3-5 GB)
# Compatible : Linux, macOS. Pour Windows : utiliser scripts/dev-all.cmd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PORTS=(3000 3001 3002 3003 3004 3005 3006)
APPS=(
  "@insurtech/web-insurtech-admin"
  "@insurtech/web-broker"
  "@insurtech/web-garage"
  "@insurtech/web-garage-mobile"
  "@insurtech/web-customer-portal"
  "@insurtech/web-assure-portal"
  "@insurtech/web-assure-mobile"
)
LABELS=("admin" "broker" "garage" "garage-mob" "customer" "assure-p" "assure-m")
COLORS="red,blue,yellow,cyan,green,magenta,white"

# Verification RAM (Linux/macOS)
echo "==============================================================================="
echo "  Skalean InsurTech -- demarrage de 7 apps Next.js (admin + 3 dashboards + 3 assure)"
echo "==============================================================================="
echo ""
echo "  ATTENTION : consommation RAM cumulee estimee 3-5 GB."
echo "  Recommande : machine avec 16 GB RAM minimum."
echo "  Si RAM < 16 GB, utiliser plutot : pnpm dev:portals (workflow assure 3 apps)"
echo "                            ou      pnpm dev:dashboards (broker + garage + admin)"
echo ""

if [ "$(uname)" = "Linux" ]; then
  TOTAL_KB="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
  TOTAL_GB=$((TOTAL_KB / 1024 / 1024))
  echo "  RAM totale detectee : ${TOTAL_GB} GB"
  if [ "$TOTAL_GB" -lt 16 ]; then
    echo "  WARN : moins de 16 GB de RAM disponible. Continuer ? [y/N]"
    read -r REPLY
    if [ "$REPLY" != "y" ] && [ "$REPLY" != "Y" ]; then
      echo "  Abandon."
      exit 0
    fi
  fi
elif [ "$(uname)" = "Darwin" ]; then
  TOTAL_BYTES="$(sysctl -n hw.memsize)"
  TOTAL_GB=$((TOTAL_BYTES / 1024 / 1024 / 1024))
  echo "  RAM totale detectee : ${TOTAL_GB} GB"
fi

# Verification ports
echo ""
echo "  Verification ports ${PORTS[*]} ..."
for PORT in "${PORTS[@]}"; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t)"
    echo "  ERREUR : port $PORT deja utilise (PID $PID)" >&2
    exit 1
  fi
done
echo "  Tous les ports sont libres."
echo ""
echo "  Demarrage en cours. Ctrl+C pour tout arreter."
echo "==============================================================================="
echo ""

# Trap pour cleanup
cleanup() {
  echo ""
  echo "  Arret en cours -- killing tous les sous-process..."
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup INT TERM EXIT

exec pnpm exec concurrently \
  --names "${LABELS[0]},${LABELS[1]},${LABELS[2]},${LABELS[3]},${LABELS[4]},${LABELS[5]},${LABELS[6]}" \
  --prefix-colors "$COLORS" \
  --kill-others-on-fail \
  --restart-tries 0 \
  --timestamp-format "HH:mm:ss" \
  "pnpm --filter ${APPS[0]} dev" \
  "pnpm --filter ${APPS[1]} dev" \
  "pnpm --filter ${APPS[2]} dev" \
  "pnpm --filter ${APPS[3]} dev" \
  "pnpm --filter ${APPS[4]} dev" \
  "pnpm --filter ${APPS[5]} dev" \
  "pnpm --filter ${APPS[6]} dev"
