import { beforeEach, describe, expect, it } from 'vitest';

import { EmailTemplateRenderer } from '../../src/providers/email/template-renderer.js';

interface FakeRow {
  id: string;
  tenantId: string;
  name: string;
  channel: string;
  language: string;
  subjectTemplate: string | null;
  bodyTemplate: string;
  active: boolean;
}

function makeRepo(rows: FakeRow[]): { rows: FakeRow[]; findOne: (q: { where: Partial<FakeRow> }) => Promise<FakeRow | null> } {
  const fake = {
    rows,
    findOne: async ({ where }: { where: Partial<FakeRow> }) =>
      fake.rows.find((r) =>
        Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v),
      ) ?? null,
  };
  return fake;
}

describe('EmailTemplateRenderer', () => {
  let renderer: EmailTemplateRenderer;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    repo = makeRepo([
      {
        id: 'tpl-fr',
        tenantId: 'tenant-1',
        name: 'welcome',
        channel: 'email',
        language: 'fr',
        subjectTemplate: 'Bienvenue {{user_name}}',
        bodyTemplate: 'Bonjour {{user_name}},\n\nMerci pour votre inscription a Assurflow.',
        active: true,
      },
      {
        id: 'tpl-ar',
        tenantId: 'tenant-1',
        name: 'welcome',
        channel: 'email',
        language: 'ar',
        subjectTemplate: 'مرحبا {{user_name}}',
        bodyTemplate: 'مرحبا {{user_name}}،\n\nشكرا لتسجيلك في Assurflow.',
        active: true,
      },
    ]);
    renderer = new EmailTemplateRenderer(repo as never);
  });

  it('renders fr email with subject and html wrapper', async () => {
    const out = await renderer.render('tenant-1', 'welcome', 'fr', { user_name: 'Mohamed' });
    expect(out.subject).toBe('Bienvenue Mohamed');
    expect(out.html).toContain('<p>Bonjour Mohamed,</p>');
    expect(out.html).toContain('<p>Merci pour votre inscription a Assurflow.</p>');
    expect(out.html).toMatch(/lang="fr"/);
    expect(out.dirAttr).toBe('ltr');
  });

  it('renders ar email with RTL direction', async () => {
    const out = await renderer.render('tenant-1', 'welcome', 'ar', { user_name: 'محمد' });
    expect(out.dirAttr).toBe('rtl');
    expect(out.html).toMatch(/dir="rtl"/);
    expect(out.html).toMatch(/lang="ar"/);
  });

  it('falls back ar-MA -> ar when darija missing', async () => {
    const out = await renderer.render('tenant-1', 'welcome', 'ar-MA', { user_name: 'Hamza' });
    expect(out.resolvedLocale).toBe('ar');
    expect(out.dirAttr).toBe('rtl');
  });

  it('falls back ar-MA -> ar -> fr -> en chain when only en available', async () => {
    repo.rows = [
      {
        id: 'tpl-en',
        tenantId: 'tenant-1',
        name: 'welcome',
        channel: 'email',
        language: 'en',
        subjectTemplate: 'Welcome {{user_name}}',
        bodyTemplate: 'Hello {{user_name}}',
        active: true,
      },
    ];
    const out = await renderer.render('tenant-1', 'welcome', 'ar-MA', { user_name: 'Sara' });
    expect(out.resolvedLocale).toBe('en');
    expect(out.dirAttr).toBe('ltr');
  });

  it('produces a non-empty text fallback', async () => {
    const out = await renderer.render('tenant-1', 'welcome', 'fr', { user_name: 'Yasmine' });
    expect(out.text.length).toBeGreaterThan(0);
    expect(out.text).toContain('Yasmine');
    expect(out.text).not.toContain('<');
  });

  it('throws when template not found in any locale', async () => {
    repo.rows = [];
    await expect(renderer.render('tenant-1', 'missing', 'fr', {})).rejects.toThrow(
      /EMAIL_TEMPLATE_NOT_FOUND/,
    );
  });
});
