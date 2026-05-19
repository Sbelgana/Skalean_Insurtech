/**
 * Skalean InsurTech v2.2 -- lint-staged config
 * Reference: B-01 Tache 1.1.14
 */
module.exports = {
  '*.{ts,tsx,js,jsx,mjs,cjs}': [
    'biome check --write --no-errors-on-unmatched',
    'biome format --write --no-errors-on-unmatched',
  ],
  '*.{json,jsonc}': [
    'biome format --write --no-errors-on-unmatched',
  ],
  '*.{md,yaml,yml}': [
    // Just format check, no lint (Biome does not lint these)
  ],
  '*.sh': [
    // Optional shellcheck if available
  ],
};
