import { describe, expect, it } from 'vitest';

import { EmailSmtpClient } from '../../src/providers/email/email-smtp.client.js';

describe('EmailSmtpClient (log-only mode)', () => {
  it('falls back to log-only when host missing', () => {
    const client = new EmailSmtpClient({
      provider: 'log-only',
      fromAddress: 'noreply@skalean-insurtech.ma',
      fromName: 'Assurflow',
    });
    expect(client.isLogOnly()).toBe(true);
  });

  it('disables DKIM when private key is PLACEHOLDER_*', () => {
    const client = new EmailSmtpClient({
      provider: 'mailhog',
      host: 'localhost',
      port: 1025,
      fromAddress: 'noreply@skalean-insurtech.ma',
      fromName: 'Assurflow',
      dkimDomain: 'skalean-insurtech.ma',
      dkimSelector: 'default',
      dkimPrivateKey: 'PLACEHOLDER_DKIM_KEY',
    });
    expect(client.hasDkim()).toBe(false);
  });

  it('enables DKIM when real private key supplied', () => {
    const client = new EmailSmtpClient({
      provider: 'smtp',
      host: 'smtp.example.com',
      port: 587,
      fromAddress: 'noreply@skalean-insurtech.ma',
      fromName: 'Assurflow',
      dkimDomain: 'skalean-insurtech.ma',
      dkimSelector: 'default',
      dkimPrivateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIB...\n-----END RSA PRIVATE KEY-----',
    });
    expect(client.hasDkim()).toBe(true);
  });

  it('log-only send returns log-only result with masked email', async () => {
    const client = new EmailSmtpClient({
      provider: 'log-only',
      fromAddress: 'noreply@skalean-insurtech.ma',
      fromName: 'Assurflow',
    });
    const res = await client.send({
      to: 'jane.doe@example.com',
      subject: 'Test',
      html: '<p>Hello</p>',
    });
    expect(res.provider).toBe('log-only');
    expect(res.accepted).toBe(1);
  });

  it('builds List-Unsubscribe + One-click headers when optoutUrl provided', async () => {
    const client = new EmailSmtpClient({
      provider: 'log-only',
      fromAddress: 'noreply@skalean-insurtech.ma',
      fromName: 'Assurflow',
    });
    const res = await client.send({
      to: 'a@b.co',
      subject: 'Newsletter',
      html: '<p>News</p>',
      optoutUrl: 'https://api.skalean-insurtech.ma/api/v1/public/optout/tok',
      optoutMailto: 'unsubscribe@skalean-insurtech.ma',
    });
    expect(res.messageId).toContain('log-only-');
  });
});
