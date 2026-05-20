/**
 * E2E helpers -- axe-playwright accessibility wrapper
 * Reference: task-1.4.16 Sprint 4 Phase 1
 *
 * Usage:
 *   import { checkPageA11y } from '../helpers/a11y';
 *   await checkPageA11y(page);
 */
import { checkA11y, injectAxe } from 'axe-playwright';
import type { Page } from '@playwright/test';

export interface A11yOptions {
  /** CSS selector to scope the audit (default: whole page) */
  selector?: string;
  /** axe-core rules to configure */
  rules?: { id: string; enabled: boolean }[];
}

/**
 * Inject axe-core and run accessibility audit on a page.
 * Throws if any violations are found.
 */
export async function checkPageA11y(page: Page, options: A11yOptions = {}): Promise<void> {
  await injectAxe(page);
  await checkA11y(
    page,
    options.selector,
    {
      axeOptions: options.rules ? { rules: Object.fromEntries(options.rules.map((r) => [r.id, { enabled: r.enabled }])) } : undefined,
      detailedReport: true,
      detailedReportOptions: { html: false },
    },
  );
}
