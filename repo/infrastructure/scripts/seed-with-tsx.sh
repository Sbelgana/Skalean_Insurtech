#!/usr/bin/env bash
# seed-with-tsx.sh -- Sprint 7.5b Tache 7.5b.0 (recommandation Pause #5 Bug #3).
#
# Wrapper pour executer un seed script TS avec experimental decorators actives.
# Resout le bug "Parameter decorators only work when experimental decorators
# are enabled" decouvert Pause #5 lors de l'execution de seed-rbac-users.ts.
#
# Sans ce wrapper, `tsx infrastructure/scripts/seed-rbac-users.ts` echoue car
# tsx ne charge pas automatiquement les decorators experimental TS quand le
# script importe @insurtech/auth (qui contient des services NestJS avec
# @Injectable() / @Inject()).
#
# Solution : utiliser ts-node avec experimentalDecorators=true compile option.
#
# Usage :
#   bash infrastructure/scripts/seed-with-tsx.sh path/to/seed-script.ts
#
# Exemples (Sprint 8+) :
#   bash infrastructure/scripts/seed-with-tsx.sh infrastructure/scripts/seed-rbac-users.ts
#   bash infrastructure/scripts/seed-with-tsx.sh infrastructure/scripts/seed-tenants.ts
#
# Reference : pause-5-validation-runtime.md Bug #3.

set -euo pipefail

SCRIPT_PATH="${1:-}"
if [[ -z "${SCRIPT_PATH}" ]]; then
  echo "[seed-with-tsx] Usage : seed-with-tsx.sh <script.ts>" >&2
  exit 1
fi

if [[ ! -f "${SCRIPT_PATH}" ]]; then
  echo "[seed-with-tsx] File not found : ${SCRIPT_PATH}" >&2
  exit 1
fi

# Charger .env.test si present (DATABASE_URL + autres vars)
if [[ -f .env.test ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.test
  set +a
fi

# Executer le seed avec ts-node + experimentalDecorators (option NestJS compatible)
echo "[seed-with-tsx] Running ${SCRIPT_PATH} with experimental decorators enabled" >&2

pnpm exec ts-node \
  --transpile-only \
  --compiler-options '{"experimentalDecorators":true,"emitDecoratorMetadata":true,"module":"esnext","target":"ES2022","moduleResolution":"node"}' \
  "${SCRIPT_PATH}"
