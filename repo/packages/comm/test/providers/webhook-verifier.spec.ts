import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  WhatsAppWebhookVerifier,
  isStopKeyword,
} from '../../src/providers/whatsapp/webhook-verifier.js';

const APP_SECRET = 'super-secret-app-key';
const VERIFY_TOKEN = 'verify-token-sprint9';

function signBody(body: string): string {
  return 'sha256=' + createHmac('sha256', APP_SECRET).update(body, 'utf8').digest('hex');
}

describe('WhatsAppWebhookVerifier', () => {
  const verifier = new WhatsAppWebhookVerifier({
    appSecret: APP_SECRET,
    verifyToken: VERIFY_TOKEN,
  });

  describe('verifyHubChallenge', () => {
    it('returns challenge when verify_token matches and mode=subscribe', () => {
      const out = verifier.verifyHubChallenge({
        'hub.mode': 'subscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': '1234567890',
      });
      expect(out).toBe('1234567890');
    });

    it('returns null on wrong token', () => {
      const out = verifier.verifyHubChallenge({
        'hub.mode': 'subscribe',
        'hub.verify_token': 'wrong',
        'hub.challenge': 'x',
      });
      expect(out).toBeNull();
    });

    it('returns null when mode is not subscribe', () => {
      const out = verifier.verifyHubChallenge({
        'hub.mode': 'unsubscribe',
        'hub.verify_token': VERIFY_TOKEN,
        'hub.challenge': 'x',
      });
      expect(out).toBeNull();
    });
  });

  describe('verifySignature', () => {
    it('verifies correct signature', () => {
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      expect(verifier.verifySignature(body, signBody(body))).toBe(true);
    });

    it('rejects tampered body', () => {
      const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
      const sig = signBody(body);
      const tampered = body + ' ';
      expect(verifier.verifySignature(tampered, sig)).toBe(false);
    });

    it('rejects missing signature', () => {
      expect(verifier.verifySignature('body', undefined)).toBe(false);
      expect(verifier.verifySignature('body', '')).toBe(false);
    });

    it('rejects wrong-key signature', () => {
      const body = 'hello';
      const wrongSig =
        'sha256=' + createHmac('sha256', 'other-key').update(body, 'utf8').digest('hex');
      expect(verifier.verifySignature(body, wrongSig)).toBe(false);
    });
  });

  describe('computeIdempotencyKey', () => {
    it('produces stable hash for same body', () => {
      const a = verifier.computeIdempotencyKey('payload');
      const b = verifier.computeIdempotencyKey('payload');
      expect(a).toBe(b);
      expect(a).toHaveLength(64);
    });

    it('produces different hash for different body', () => {
      const a = verifier.computeIdempotencyKey('a');
      const b = verifier.computeIdempotencyKey('b');
      expect(a).not.toBe(b);
    });
  });
});

describe('isStopKeyword', () => {
  it('detects STOP', () => {
    expect(isStopKeyword('STOP')).toBe(true);
    expect(isStopKeyword('stop ')).toBe(true);
  });

  it('detects ARRET / ARRETER / DESINSCRIRE', () => {
    expect(isStopKeyword('ARRET')).toBe(true);
    expect(isStopKeyword('arreter')).toBe(true);
    expect(isStopKeyword('DESINSCRIRE')).toBe(true);
  });

  it('detects UNSUBSCRIBE', () => {
    expect(isStopKeyword('UNSUBSCRIBE')).toBe(true);
  });

  it('detects arabic stop tokens', () => {
    expect(isStopKeyword('الغاء')).toBe(true);
    expect(isStopKeyword('توقف')).toBe(true);
  });

  it('rejects normal messages', () => {
    expect(isStopKeyword('Hello stop sign')).toBe(false);
    expect(isStopKeyword('Bonjour')).toBe(false);
  });
});
