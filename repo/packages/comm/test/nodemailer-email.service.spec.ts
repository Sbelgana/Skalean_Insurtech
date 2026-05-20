/**
 * Tests for @insurtech/comm/nodemailer-email.service (log-only mode).
 * Sprint 5 Tache 2.1.13
 *
 * Real SMTP delivery requires Mailhog (skalean-test stack port 1025);
 * this spec only verifies the log-only fallback when SMTP_HOST is missing.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NodemailerEmailService } from '../src/nodemailer-email.service.js';

describe('NodemailerEmailService (log-only mode)', () => {
  const SAVED = process.env['SMTP_HOST'];

  beforeEach(() => {
    delete process.env['SMTP_HOST'];
  });

  afterEach(() => {
    if (SAVED !== undefined) process.env['SMTP_HOST'] = SAVED;
    else delete process.env['SMTP_HOST'];
  });

  it('initializes without SMTP_HOST -- falls back to log-only', () => {
    const svc = new NodemailerEmailService();
    expect(() => svc.onModuleInit()).not.toThrow();
  });

  it('sendVerification succeeds in log-only mode', async () => {
    const svc = new NodemailerEmailService();
    svc.onModuleInit();
    await expect(
      svc.sendVerification({
        to: 'a@b.co',
        locale: 'en',
        token: 'tok',
        display_name: 'Alice',
      }),
    ).resolves.toBeUndefined();
  });

  it('sendRecovery + sendPasswordChanged also succeed', async () => {
    const svc = new NodemailerEmailService();
    svc.onModuleInit();
    await expect(
      svc.sendRecovery({ to: 'a@b.co', locale: 'fr-MA', token: 'tok' }),
    ).resolves.toBeUndefined();
    await expect(
      svc.sendPasswordChanged({ to: 'a@b.co', locale: 'en', display_name: 'Alice' }),
    ).resolves.toBeUndefined();
  });
});
