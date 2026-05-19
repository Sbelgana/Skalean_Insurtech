#!/usr/bin/env bash
# Skalean InsurTech v2.2 -- check-no-emoji
# Reference: B-01 Tache 1.1.14
# decision-006 (no-emoji policy ABSOLU)
#
# Detects emoji in staged or all files via Unicode ranges:
#   1F300-1F5FF : Misc Symbols & Pictographs
#   1F600-1F64F : Emoticons
#   1F680-1F6FF : Transport & Map
#   1F700-1F77F : Alchemical Symbols
#   1F780-1F7FF : Geometric Shapes Extended
#   1F800-1F8FF : Supplemental Arrows-C
#   1F900-1F9FF : Supplemental Symbols & Pictographs
#   1FA00-1FA6F : Chess Symbols
#   1FA70-1FAFF : Symbols & Pictographs Extended-A
#   2600-26FF   : Misc Symbols (sun, snowflake, etc.)
#   2700-27BF   : Dingbats
#   1F1E6-1F1FF : Regional Indicators (flags)
#
# Exit 0 if no emoji, exit 1 if emoji found.

set -euo pipefail

EXCLUDE_DIRS=(
  --exclude-dir=node_modules
  --exclude-dir=.git
  --exclude-dir=dist
  --exclude-dir=.turbo
  --exclude-dir=.next
  --exclude-dir=coverage
  --exclude-dir=playwright-report
  --exclude-dir=test-results
  --exclude-dir=.pnpm-store
)

EMOJI_REGEX="[\x{1F300}-\x{1F5FF}]|[\x{1F600}-\x{1F64F}]|[\x{1F680}-\x{1F6FF}]|[\x{1F700}-\x{1F77F}]|[\x{1F780}-\x{1F7FF}]|[\x{1F800}-\x{1F8FF}]|[\x{1F900}-\x{1F9FF}]|[\x{1FA00}-\x{1FA6F}]|[\x{1FA70}-\x{1FAFF}]|[\x{2600}-\x{26FF}]|[\x{2700}-\x{27BF}]|[\x{1F1E6}-\x{1F1FF}]"

# If run from git hook, scan only staged files
if [[ -n "${GIT_HOOK:-}" ]] || { [[ -d ".git" ]] && [[ -n "$(git diff --cached --name-only 2>/dev/null)" ]]; }; then
  STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR 2>/dev/null | grep -v -E "^(node_modules|dist|\.turbo|\.next|coverage)/" || true)

  if [[ -z "${STAGED_FILES}" ]]; then
    exit 0
  fi

  FOUND=0
  for file in ${STAGED_FILES}; do
    if [[ -f "${file}" ]] && grep -lP "${EMOJI_REGEX}" "${file}" >/dev/null 2>&1; then
      echo "FAIL: emoji detected in staged file: ${file}"
      grep -nP "${EMOJI_REGEX}" "${file}" || true
      echo ""
      FOUND=1
    fi
  done

  if [[ "${FOUND}" -eq 1 ]]; then
    echo "Skalean InsurTech v2.2 -- decision-006 ABSOLU"
    echo "No-emoji policy: aucune emoji n'est autorisee dans aucun output."
    echo ""
    exit 1
  fi
  exit 0
fi

# Otherwise scan whole repo
RESULT=$(grep -rPI "${EMOJI_REGEX}" "${EXCLUDE_DIRS[@]}" . 2>/dev/null || true)

if [[ -n "${RESULT}" ]]; then
  echo "${RESULT}"
  echo ""
  echo "FAIL: emoji detected in repository"
  echo "Skalean InsurTech v2.2 -- decision-006 ABSOLU no-emoji policy"
  exit 1
fi

echo "OK: no emoji detected"
exit 0
