import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MetaInvalidTemplateError,
  MetaTemplateNotApprovedError,
  WaTemplateRenderer,
} from '../../src/providers/whatsapp/index.js';

interface FakeRow {
  id: string;
  tenantId: string;
  name: string;
  channel: string;
  language: string;
  bodyTemplate: string;
  variablesSchema: { type: string; properties: Record<string, unknown>; required: string[]; ordered?: string[] };
  metaTemplateName: string | null;
  metaTemplateStatus: string;
  active: boolean;
}

function makeRow(over: Partial<FakeRow>): FakeRow {
  return {
    id: 'tpl-1',
    tenantId: 'tenant-1',
    name: 'appointment_reminder',
    channel: 'whatsapp',
    language: 'fr',
    bodyTemplate: 'Bonjour {{1}}, votre RDV est le {{2}}',
    variablesSchema: {
      type: 'object',
      properties: { user_name: { type: 'string' }, date: { type: 'string' } },
      required: ['user_name', 'date'],
      ordered: ['user_name', 'date'],
    },
    metaTemplateName: 'appointment_reminder_v1',
    metaTemplateStatus: 'approved',
    active: true,
    ...over,
  };
}

interface FakeRepo {
  rows: FakeRow[];
  findOne: (q: { where: Partial<FakeRow> }) => Promise<FakeRow | null>;
}

function makeFakeRepo(rows: FakeRow[]): FakeRepo {
  const fake: FakeRepo = {
    rows,
    findOne: async ({ where }: { where: Partial<FakeRow> }) => {
      return (
        fake.rows.find((r) =>
          Object.entries(where).every(([k, v]) => (r as Record<string, unknown>)[k] === v),
        ) ?? null
      );
    },
  };
  return fake;
}

describe('WaTemplateRenderer', () => {
  let renderer: WaTemplateRenderer;
  let repo: FakeRepo;

  beforeEach(() => {
    repo = makeFakeRepo([makeRow({})]);
    renderer = new WaTemplateRenderer(repo as never);
  });

  it('renders fr template with ordered params', async () => {
    const out = await renderer.render('tenant-1', 'appointment_reminder', 'fr', {
      user_name: 'Mohamed',
      date: '15 mai 2026',
    });
    expect(out.languageCode).toBe('fr');
    expect(out.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Mohamed' },
          { type: 'text', text: '15 mai 2026' },
        ],
      },
    ]);
    expect(out.bodyPreview).toBe('Bonjour Mohamed, votre RDV est le 15 mai 2026');
  });

  it('falls back ar-MA -> ar when darija absent', async () => {
    repo.rows = [
      makeRow({ id: 'tpl-ar', language: 'ar', metaTemplateName: 'appointment_reminder_ar' }),
    ];
    renderer = new WaTemplateRenderer(repo as never);
    const out = await renderer.render('tenant-1', 'appointment_reminder', 'ar-MA', {
      user_name: 'Mohamed',
      date: '15 mai 2026',
    });
    expect(out.resolvedLocale).toBe('ar');
    expect(out.languageCode).toBe('ar');
  });

  it('falls back ar-MA -> ar -> fr -> en chain', async () => {
    repo.rows = [makeRow({ id: 'tpl-en', language: 'en' })];
    renderer = new WaTemplateRenderer(repo as never);
    const out = await renderer.render('tenant-1', 'appointment_reminder', 'ar-MA', {
      user_name: 'Mohamed',
      date: '2026-05-15',
    });
    expect(out.resolvedLocale).toBe('en');
  });

  it('throws when template not found in any locale', async () => {
    repo.rows = [];
    renderer = new WaTemplateRenderer(repo as never);
    await expect(
      renderer.render('tenant-1', 'unknown', 'fr', {}),
    ).rejects.toBeInstanceOf(MetaInvalidTemplateError);
  });

  it('throws when status not approved', async () => {
    repo.rows = [makeRow({ metaTemplateStatus: 'pending_review' })];
    renderer = new WaTemplateRenderer(repo as never);
    await expect(
      renderer.render('tenant-1', 'appointment_reminder', 'fr', {
        user_name: 'X',
        date: 'Y',
      }),
    ).rejects.toBeInstanceOf(MetaTemplateNotApprovedError);
  });

  it('throws on missing variable', async () => {
    await expect(
      renderer.render('tenant-1', 'appointment_reminder', 'fr', { user_name: 'X' }),
    ).rejects.toBeInstanceOf(MetaInvalidTemplateError);
  });

  it('sanitizes tabs and excessive newlines', async () => {
    const out = await renderer.render('tenant-1', 'appointment_reminder', 'fr', {
      user_name: 'A\tB\n\n\n\nC',
      date: '2026',
    });
    expect(out.components[0]?.parameters?.[0]?.text).toBe('A B\n\n\nC');
  });

  it('validateMetaApproved returns true only when approved + has meta name', async () => {
    expect(await renderer.validateMetaApproved('tenant-1', 'appointment_reminder', 'fr')).toBe(true);
    repo.rows = [makeRow({ metaTemplateName: null })];
    renderer = new WaTemplateRenderer(repo as never);
    expect(await renderer.validateMetaApproved('tenant-1', 'appointment_reminder', 'fr')).toBe(false);
  });
});
