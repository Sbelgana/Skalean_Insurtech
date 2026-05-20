#!/usr/bin/env bash
set -euo pipefail

# Skalean InsurTech -- Lance les 3 apps dashboards (admin + broker + garage)
# Usage : pnpm dev:dashboards

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

PORTS=(3000 3001 3002)
APPS=("@insurtech/web-insurtech-admin" "@insurtech/web-broker" "@insurtech/web-garage")
LABELS=("admin" "broker" "garage")

echo "Skalean InsurTech -- demarrage dashboards (admin + broker + garage)"
echo "Ports : ${PORTS[*]}"

# Ports check
for PORT in "${PORTS[@]}"; do
  if lsof -iTCP:"$PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
    PID="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -t)"
    echo "ERREUR : port $PORT deja utilise (PID $PID)" >&2
    exit 1
  fi
done

# tmux preferred
if command -v tmux >/dev/null 2>&1 && [ -z "${SKALEAN_NO_TMUX:-}" ]; then
  SESSION="skalean-dashboards"
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    echo "Session tmux $SESSION existe. Attache : tmux attach -t $SESSION"
    exit 0
  fi
  tmux new-session -d -s "$SESSION" -n "${LABELS[0]}" "pnpm --filter ${APPS[0]} dev"
  tmux split-window -t "$SESSION" -h "pnpm --filter ${APPS[1]} dev"
  tmux split-window -t "$SESSION" -v -t "$SESSION:0.1" "pnpm --filter ${APPS[2]} dev"
  tmux select-layout -t "$SESSION" tiled
  echo "Session tmux demarree : tmux attach -t $SESSION"
  exec tmux attach -t "$SESSION"
fi

# Fallback concurrently
exec pnpm exec concurrently \
  --names "${LABELS[0]},${LABELS[1]},${LABELS[2]}" \
  --prefix-colors "red,blue,yellow" \
  --kill-others-on-fail \
  --restart-tries 0 \
  "pnpm --filter ${APPS[0]} dev" \
  "pnpm --filter ${APPS[1]} dev" \
  "pnpm --filter ${APPS[2]} dev"
