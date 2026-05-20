/**
 * E2E helpers -- Lighthouse single-app runner
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Lightweight wrapper used by scripts/lighthouse-baseline.ts.
 * Not intended for direct use in Playwright specs.
 */
export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa: number | null;
}

/**
 * Parse Lighthouse result categories into a simple score object.
 * Scores are 0-100 integers (Lighthouse returns 0-1 floats).
 */
export function parseLighthouseScores(lhr: {
  categories: Record<string, { score: number | null } | undefined>;
}): LighthouseScores {
  const score = (key: string): number =>
    Math.round(((lhr.categories[key]?.score) ?? 0) * 100);

  return {
    performance: score('performance'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    seo: score('seo'),
    pwa: lhr.categories['pwa'] != null ? score('pwa') : null,
  };
}

/**
 * Check scores against thresholds.
 * Returns array of failure strings (empty = all pass).
 */
export function checkThresholds(
  scores: LighthouseScores,
  thresholds: { performance: number; accessibility: number; bestPractices: number; seo: number; pwa?: number },
): string[] {
  const failures: string[] = [];
  if (scores.performance < thresholds.performance)
    failures.push(`perf ${scores.performance}<${thresholds.performance}`);
  if (scores.accessibility < thresholds.accessibility)
    failures.push(`a11y ${scores.accessibility}<${thresholds.accessibility}`);
  if (scores.bestPractices < thresholds.bestPractices)
    failures.push(`bp ${scores.bestPractices}<${thresholds.bestPractices}`);
  if (scores.seo < thresholds.seo)
    failures.push(`seo ${scores.seo}<${thresholds.seo}`);
  if (thresholds.pwa !== undefined && (scores.pwa ?? 0) < thresholds.pwa)
    failures.push(`pwa ${scores.pwa ?? 0}<${thresholds.pwa}`);
  return failures;
}
