/**
 * request.spec.ts -- web-garage-mobile i18n
 * Reference : task-1.4.3 Sprint 4 Phase 1
 *
 * Teste buildRequestConfig() (logique metier) en isolation du wrapper next-intl/server
 * qui n'est pas disponible hors contexte Next.js (jsdom environment).
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

  it('fr messages include mobile vocabulary -- taskToday', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('fr'));
    const messages = cfg.messages as Record<string, Record<string, string>>;
    expect(messages.mobile?.taskToday).toBe('Tache du jour');
  });

  it('fr messages include mobile vocabulary -- scanVin', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('fr'));
    const messages = cfg.messages as Record<string, Record<string, string>>;
    expect(messages.mobile?.scanVin).toBe('Scanner VIN');
  });

  it('fr messages include mobile vocabulary -- offlineModeActive', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('fr'));
    const messages = cfg.messages as Record<string, Record<string, string>>;
    expect(messages.mobile?.offlineModeActive).toBe('Mode hors ligne actif');
  });

  it('ar-MA messages include Darija mobile vocabulary', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('ar-MA'));
    const messages = cfg.messages as Record<string, Record<string, string>>;
    expect(messages.mobile?.offline).toBe('بلا انترنت');
  });

  it('ar messages include classical mobile vocabulary', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('ar'));
    const messages = cfg.messages as Record<string, Record<string, string>>;
    expect(messages.mobile?.offline).toBe('غير متصل');
  });

  it('garage vocabulary preserved -- workOrder fr', async () => {
    const cfg = await buildRequestConfig(Promise.resolve('fr'));
    const messages = cfg.messages as Record<string, Record<string, string>>;
    expect(messages.garage?.workOrder).toBe('Ordre de travail');
  });
});
