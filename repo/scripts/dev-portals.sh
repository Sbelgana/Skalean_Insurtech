#!/usr/bin/env bash
set -euo pipefail

# Skalean InsurTech -- Lance les 3 apps assure (customer-portal + assure-portal + assure-mobile)
# Usage : pnpm dev:portals
# Compatible : Linux, macOS. Pour Windows : utiliser scripts/dev-portals.cmd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PORTS=(3004 3005 3006)
APPS=("@insurtech/web-customer-portal" "@insurtech/web-assure-portal" "@insurtech/web-assure-mobile")
LABELS=("customer" "assure-portal" "assure-mobile")

echo "Skalean InsurTech -- demarrage workflow assure (3 apps)"
echo "Ports : ${PORTS[*]}"

# Verification ports libres
for PORT in "${PORTS[@]}"; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t)"
    echo "ERREUR : port $PORT deja utilise (PID $PID). Tuer avec : kill $PID" >&2
    exit 1
  fi
done

# Detection tmux
if command -v tmux >/dev/null 2>&1 && [ -z "${SKALEAN_NO_TMUX:-}" ]; then
  SESSION="skalean-portals"
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Session tmux $SESSION existe deja. Attache : tmux attach -t $SESSION"
    exit 0
  fi
  tmux new-session -d -s "$SESSION" -n "${LABELS[0]}" "pnpm --filter ${APPS[0]} dev"
  tmux split-window -t "$SESSION" -h "pnpm --filter ${APPS[1]} dev"
  tmux split-window -t "$SESSION" -v "pnpm --filter ${APPS[2]} dev"
  tmux select-layout -t "$SESSION" tiled
  echo "Session tmux demarree : tmux attach -t $SESSION"
  exec tmux attach -t "$SESSION"
fi

# Fallback concurrently
exec pnpm exec concurrently \
  --names "${LABELS[0]},${LABELS[1]},${LABELS[2]}" \
  --prefix-colors "blue,green,magenta" \
  --kill-others-on-fail \
  --restart-tries 0 \
  "pnpm --filter ${APPS[0]} dev" \
  "pnpm --filter ${APPS[1]} dev" \
  "pnpm --filter ${APPS[2]} dev"
