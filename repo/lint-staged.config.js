// Skalean InsurTech -- lint-staged config
// Execute Biome (lint + format) sur fichiers stages avant commit

/** @type {import('lint-staged').Config} */
export default {
  '*.{ts,tsx,js,jsx,mjs,cjs}': ['biome check --write --no-errors-on-unmatched'],
  '*.{json,jsonc}': ['biome format --write --no-errors-on-unmatched'],
  '*.{css,scss}': ['biome format --write --no-errors-on-unmatched'],
  '*.{md,mdx}': [() => 'true'],
  '*.{yml,yaml}': [() => 'true'],
};
