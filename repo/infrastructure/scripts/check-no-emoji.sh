#!/usr/bin/env bash
# Skalean InsurTech v2.2 -- check-no-emoji.sh
# Reference: B-01 Tache 1.1.10 (placeholder) + Tache 1.1.14 (script complet)
# Ce stub permet a CI Tache 1.1.10 de fonctionner avant Tache 1.1.14
# decision-006 (no-emoji)
set -euo pipefail

if grep -rPI "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]|[\x{1F1E6}-\x{1F1FF}]" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist \
  --exclude-dir=.turbo --exclude-dir=.next --exclude-dir=coverage \
  --exclude-dir=playwright-report \
  . 2>/dev/null; then
  echo "FAIL: emoji detected"
  exit 1
fi
echo "OK: no emoji detected"
exit 0
