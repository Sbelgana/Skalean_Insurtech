/**
 * request.spec.ts -- web-insurtech-admin i18n
 * Reference : task-1.4.4 Sprint 4 Phase 1
 *
 * Teste buildRequestConfig() en isolation du wrapper next-intl/server.
 */
import { describe, it, expect } from 'vitest';
import { buildRequestConfig } from '@/i18n/request';

describe('i18n/request', () => {
  it('loads fr messages by default', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('fr'));
    expect(cfg.locale).toBe('fr');
    expect((cfg.messages as Record<string, Record<string, string>>).common?.save).toBe('Enregistrer');
  });

  it('loads ar-MA Darija messages', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('ar-MA'));
    expect(cfg.locale).toBe('ar-MA');
    expect((cfg.messages as Record<string, Record<string, string>>).common?.save).toBe('حفظ');
  });

  it('loads ar classique messages', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('ar'));
    expect(cfg.locale).toBe('ar');
    expect((cfg.messages as Record<string, Record<string, string>>).errors?.notFound).toBe('العنصر غير موجود');
  });

  it('falls back to fr if locale unknown', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('de-DE'));
    expect(cfg.locale).toBe('fr');
  });

  it('uses Africa/Casablanca timezone', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('fr'));
    expect(cfg.timeZone).toBe('Africa/Casablanca');
  });

  it('exposes MAD currency format', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('fr'));
    expect(cfg.formats.number.currency).toMatchObject({ style: 'currency', currency: 'MAD' });
  });
});
