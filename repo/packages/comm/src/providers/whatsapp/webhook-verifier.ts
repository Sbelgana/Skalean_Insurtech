/**
 * @insurtech/comm/providers/whatsapp/webhook-verifier
 *
 * Sprint 9 Tache 3.2.4 -- verification signatures Meta webhook + idempotency.
 *
 * Meta envoie un header X-Hub-Signature-256 contenant `sha256=<HMAC SHA-256 du raw body
 * cle = WHATSAPP_APP_SECRET>`. La verification utilise timingSafeEqual pour eviter timing attacks.
 *
 * Pour le hub verify GET (Meta envoie une challenge), on retourne hub.challenge si verify_token match.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export interface WebhookVerificationOptions {
  appSecret: string;
  verifyToken: string;
}

export interface HubChallengeQuery {
  'hub.mode'?: string;
  'hub.verify_token'?: string;
  'hub.challenge'?: string;
}

export class WhatsAppWebhookVerifier {
  private readonly appSecret: string;
  private readonly verifyToken: string;

  constructor(options: WebhookVerificationOptions) {
    this.appSecret = options.appSecret;
    this.verifyToken = options.verifyToken;
  }

  /**
   * Hub challenge: retourne hub.challenge si verify_token match, sinon null.
   * Si appSecret est placeholder, mode disabled : on accepte tout en dev (avec warning).
   */
  verifyHubChallenge(query: HubChallengeQuery): string | null {
    if (query['hub.mode'] !== 'subscribe') return null;
    if (query['hub.verify_token'] !== this.verifyToken) return null;
    return query['hub.challenge'] ?? null;
  }

  /**
   * Verifie la signature HMAC SHA-256 du raw body.
   * Reference : https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
   */
  verifySignature(rawBody: string | Buffer, signatureHeader: string | undefined): boolean {
    if (typeof signatureHeader !== 'string' || signatureHeader.length === 0) return false;

    const bodyBuf = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
    const expected = 'sha256=' + createHmac('sha256', this.appSecret).update(bodyBuf).digest('hex');

    const sigBuf = Buffer.from(signatureHeader);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Idempotency : SHA-256 du raw body sert de cle stable pour deduplication.
   * Meta retry les webhooks avec meme contenu si pas 200 sous 20s.
   */
  computeIdempotencyKey(rawBody: string | Buffer): string {
    const bodyBuf = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
    return createHash('sha256').update(bodyBuf).digest('hex');
  }
}

/**
 * Detection STOP keyword pour auto opt-out CNDP (Sprint 9 Tache 3.2.11).
 * Normes telecom internationales + arabe formel + darija.
 */
export const WA_STOP_KEYWORDS: ReadonlyArray<string> = [
  'STOP',
  'ARRET',
  'ARRETER',
  'STOP-ALL',
  'STOPALL',
  'UNSUBSCRIBE',
  'DESINSCRIRE',
  'الغاء',
  'توقف',
];

export function isStopKeyword(message: string): boolean {
  const normalized = message.trim().toUpperCase();
  return WA_STOP_KEYWORDS.some((k) => k.toUpperCase() === normalized);
}
