import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MetaAccessTokenExpiredError,
  MetaApiError,
  MetaDisabledError,
  MetaInvalidTemplateError,
  MetaRateLimitError,
  MetaTemplateNotApprovedError,
  MockWhatsAppCloudApiClient,
  WhatsAppCloudApiClient,
  mapMetaError,
} from '../../src/providers/whatsapp/index.js';

describe('mapMetaError', () => {
  it('maps code 130 to invalid template', () => {
    const err = mapMetaError(400, { error: { code: 130, message: 'Invalid template' } });
    expect(err).toBeInstanceOf(MetaInvalidTemplateError);
    expect(err.retryable).toBe(false);
  });

  it('maps code 132 to template not approved', () => {
    const err = mapMetaError(400, { error: { code: 132, message: 'Not approved' } });
    expect(err).toBeInstanceOf(MetaTemplateNotApprovedError);
  });

  it('maps code 190 to access token expired', () => {
    const err = mapMetaError(401, { error: { code: 190, message: 'Token expired' } });
    expect(err).toBeInstanceOf(MetaAccessTokenExpiredError);
  });

  it('maps code 130429 to rate limit + retryable', () => {
    const err = mapMetaError(429, { error: { code: 130429, message: 'Too many messages' } });
    expect(err).toBeInstanceOf(MetaRateLimitError);
    expect(err.retryable).toBe(true);
  });

  it('maps 5xx generic to retryable', () => {
    const err = mapMetaError(503, { error: { code: 0, message: 'CDN error' } });
    expect(err.retryable).toBe(true);
  });

  it('maps 4xx unknown to non-retryable', () => {
    const err = mapMetaError(400, { error: { code: 9999, message: 'Unknown' } });
    expect(err).toBeInstanceOf(MetaApiError);
    expect(err.retryable).toBe(false);
  });
});

describe('WhatsAppCloudApiClient (disabled mode)', () => {
  it('disables on PLACEHOLDER_ access token', () => {
    const client = new WhatsAppCloudApiClient({
      phoneNumberId: 'PLACEHOLDER_WA_PHONE_ID',
      accessToken: 'PLACEHOLDER_WA_TOKEN',
    });
    expect(client.isDisabled()).toBe(true);
  });

  it('throws MetaDisabledError on sendTemplate when disabled', async () => {
    const client = new WhatsAppCloudApiClient({
      phoneNumberId: 'PLACEHOLDER_WA_PHONE_ID',
      accessToken: 'PLACEHOLDER_WA_TOKEN',
    });
    await expect(
      client.sendTemplate({
        to: '212612345678',
        templateName: 'test',
        languageCode: 'fr',
        components: [],
      }),
    ).rejects.toBeInstanceOf(MetaDisabledError);
  });

  it('enabled on real-looking creds', () => {
    const client = new WhatsAppCloudApiClient({
      phoneNumberId: '123456789',
      accessToken: 'EAA-real-token-abcdef',
    });
    expect(client.isDisabled()).toBe(false);
  });
});

describe('WhatsAppCloudApiClient (with fetch mock)', () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sendTemplate happy path posts correct body', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [{ id: 'wamid.HBgM-test' }],
          contacts: [{ wa_id: '212612345678' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const client = new WhatsAppCloudApiClient({
      phoneNumberId: '987654321',
      accessToken: 'EAA-test-token',
      retryAttempts: 0,
    });
    const out = await client.sendTemplate({
      to: '212612345678',
      templateName: 'police_signed_confirmation',
      languageCode: 'fr',
      components: [],
    });
    expect(out.messageId).toBe('wamid.HBgM-test');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] ?? [];
    expect(String(url)).toMatch(/\/v21\.0\/987654321\/messages/);
    expect((init as RequestInit).method).toBe('POST');
  });

  it('throws MetaInvalidTemplateError on 400 code 130 fail-fast', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 130, message: 'Invalid' } }), { status: 400 }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;

    const client = new WhatsAppCloudApiClient({
      phoneNumberId: 'pn-1',
      accessToken: 'EAA-test',
      retryAttempts: 3,
    });
    await expect(
      client.sendTemplate({
        to: '212612345678',
        templateName: 'bad',
        languageCode: 'fr',
        components: [],
      }),
    ).rejects.toBeInstanceOf(MetaInvalidTemplateError);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // fail-fast
  });
});

describe('MockWhatsAppCloudApiClient', () => {
  let mock: MockWhatsAppCloudApiClient;
  beforeEach(() => {
    mock = new MockWhatsAppCloudApiClient();
  });

  it('records sent template', async () => {
    const out = await mock.sendTemplate({
      to: '212612345678',
      templateName: 'reminder',
      languageCode: 'ar',
      components: [],
    });
    expect(out.messageId).toMatch(/^wamid\.MOCK_/);
    expect(mock.sent).toHaveLength(1);
    expect(mock.sent[0]?.templateName).toBe('reminder');
  });

  it('simulates rate limit on flag', async () => {
    mock.setFlags({ simulateRateLimit: true });
    await expect(
      mock.sendTemplate({
        to: '212612345678',
        templateName: 'x',
        languageCode: 'fr',
        components: [],
      }),
    ).rejects.toBeInstanceOf(MetaRateLimitError);
  });

  it('simulates invalid template on flag', async () => {
    mock.setFlags({ simulateInvalidTemplate: true });
    await expect(
      mock.sendTemplate({
        to: '212612345678',
        templateName: 'x',
        languageCode: 'fr',
        components: [],
      }),
    ).rejects.toBeInstanceOf(MetaInvalidTemplateError);
  });

  it('markAsRead records messageId', async () => {
    await mock.markAsRead('wamid.abc');
    expect(mock.marksRead).toEqual(['wamid.abc']);
  });

  it('reset clears state', async () => {
    await mock.sendTemplate({ to: '1', templateName: 't', languageCode: 'fr', components: [] });
    mock.reset();
    expect(mock.sent).toHaveLength(0);
  });
});
