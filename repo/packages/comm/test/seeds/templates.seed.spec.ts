import { describe, expect, it } from 'vitest';

import { SPRINT9_TEMPLATE_SEEDS, countSeedVariants } from '../../src/seeds/templates.seed.js';
import { LOCALES, type Locale } from '../../src/types/channel.enum.js';

describe('SPRINT9_TEMPLATE_SEEDS', () => {
  it('has 20 distinct templates', () => {
    expect(SPRINT9_TEMPLATE_SEEDS).toHaveLength(20);
    const names = SPRINT9_TEMPLATE_SEEDS.map((s) => s.name);
    expect(new Set(names).size).toBe(20);
  });

  it('totals 80 variants (20 templates x 4 locales)', () => {
    expect(countSeedVariants()).toBe(80);
  });

  it('each template defines all 4 locales (fr, ar-MA, ar, en)', () => {
    for (const seed of SPRINT9_TEMPLATE_SEEDS) {
      const provided = Object.keys(seed.localizations) as Locale[];
      for (const locale of LOCALES) {
        expect(provided, `${seed.name} missing ${locale}`).toContain(locale);
      }
    }
  });

  it('whatsapp templates have approved meta_template_name', () => {
    for (const seed of SPRINT9_TEMPLATE_SEEDS) {
      if (seed.channel === 'whatsapp') {
        expect(seed.metaTemplateName, `${seed.name} missing metaTemplateName`).toBeDefined();
        expect(seed.metaTemplateStatus, `${seed.name} status`).toBe('approved');
      }
    }
  });

  it('email templates declare subject for each locale', () => {
    for (const seed of SPRINT9_TEMPLATE_SEEDS) {
      if (seed.channel !== 'email') continue;
      for (const [locale, content] of Object.entries(seed.localizations)) {
        expect(content.subject, `${seed.name}/${locale} missing subject`).toBeDefined();
      }
    }
  });

  it('whatsapp template bodies use ordered placeholders {{N}}', () => {
    for (const seed of SPRINT9_TEMPLATE_SEEDS) {
      if (seed.channel !== 'whatsapp') continue;
      const fr = seed.localizations.fr;
      expect(fr).toBeDefined();
      expect(fr?.body).toMatch(/\{\{1\}\}/);
    }
  });

  it('no emoji in seeds (decision-006 sanity)', () => {
    const json = JSON.stringify(SPRINT9_TEMPLATE_SEEDS);
    // Range U+1F300 .. U+1FAFF (emoji blocks)
    const emojiPattern = /[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F900}-\u{1F9FF}]/u;
    expect(emojiPattern.test(json)).toBe(false);
  });
});
