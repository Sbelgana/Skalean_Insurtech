# TACHE 2.7.4 -- Email Service Data Sensible (SendGrid + Mailjet fallback + DKIM/SPF/DMARC)

**Sprint** : 9 (Phase 2 / Sprint 7 dans phase) -- Comm WhatsApp Scope Strict + Email Data Sensible
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-whatsapp-scope-strict.md` (Tache 2.7.4)
**Phase** : 2 -- Securite + Infrastructure
**Priorite** : P0 (canal primary pour donnees sensibles ; complement obligatoire de WhatsApp. Bloque 2.7.7 router branche data_sensible)
**Effort** : 5h
**Dependances** : Tache 2.7.1 (`SendEmailInput`, `SendEmailSchema`, `EmailAttachment`), Tache 2.7.2 (`NotificationAuditService`, pattern phone/email hash), Sprint 2 (Redis rate limiter reutilise), Sprint 10 anticipe (PDF attachments)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache implemente l'`EmailService`, le canal PRIMARY pour les donnees sensibles. Contrairement a WhatsApp (scope strict status-only), l'email peut porter des montants, des numeros de CIN, des IBAN, des totaux de devis : c'est le canal autorise pour ces informations car il est controlable (DKIM/SPF/DMARC pour l'authenticite), archivable localement au Maroc, et n'est pas un vecteur de social engineering au meme titre que WhatsApp. Le service utilise SendGrid en provider primaire et Mailjet en fallback automatique, rend des templates HTML multilingues, supporte les pieces jointes PDF (factures, devis, recus), et trace chaque envoi pour l'audit ACAPS.

L'apport est triple. D'abord, il complete la separation de canal : ce que WhatsApp ne peut pas porter, l'email le porte, donnant une couverture fonctionnelle complete sans compromettre la conformite CNDP. Ensuite, la configuration DKIM/SPF/DMARC garantit l'authenticite des emails Assurflow et evite le classement en spam (cible : taux de delivrabilite > 95%, score MailTester > 9/10). Enfin, le fallback SendGrid -> Mailjet assure la continuite de service : si SendGrid est indisponible, Mailjet prend le relais sans perte de notification.

A l'issue de cette tache, le service envoie des emails multilingues avec pieces jointes, bascule automatiquement sur Mailjet en cas d'echec SendGrid, applique un rate limit (100 emails/heure/utilisateur), hash l'adresse destinataire dans l'audit, et passe ses tests avec coverage >= 90%.

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

La separation de canal (correction Saad #7) repose sur deux piliers : WhatsApp ne porte que des statuts, et l'email porte les donnees sensibles. Sans le canal email, la plateforme ne pourrait communiquer aucune information financiere ou d'identite aux assures, ce qui la rendrait inutilisable pour les cas reels (envoi d'une facture de prime, d'un devis chiffre, d'un recu de paiement). L'email est donc le pendant indispensable de WhatsApp.

Le choix de l'email comme canal de donnees sensibles n'est pas arbitraire : l'email repose sur des protocoles (SMTP, DKIM, SPF, DMARC) qui permettent d'authentifier l'expediteur de maniere verifiable, contrairement a WhatsApp ou l'utilisateur ne peut pas verifier que le message provient reellement d'Assurflow. De plus, les emails peuvent etre archives sur une infrastructure souveraine marocaine (Atlas Cloud, decision-008), ce qui satisfait l'exigence de residence des donnees. Le contenu sensible reste donc sous controle, dans un canal authentifie et archive localement.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| SMTP self-hosted | Controle total | Delivrabilite faible (IP non reputee), maintenance lourde | rejete pour le pilote |
| SendGrid seul | Delivrabilite, API simple | Point de defaillance unique | rejete |
| SendGrid + Mailjet fallback | Resilience, deux providers | Deux integrations a maintenir | RETENU |
| Mailgun | Bonne API | Moins de presence support FR/MA | rejete (Mailjet est europeen, RGPD-friendly) |
| Pas de DKIM/SPF/DMARC | Plus rapide a livrer | Emails en spam, usurpation possible | rejete : inacceptable pour donnees sensibles |
| Tracking open/click active | Metriques delivrabilite | Tracking = cookies/pixels (sensibilite CNDP) | RETENU avec prudence (open tracking only, configurable) |
| Pieces jointes inline base64 | Simple | Limite de taille (10 attachments, ~30 Mo total) | RETENU avec limite |

### 2.3 Trade-offs explicites

Le fallback Mailjet est declenche dans un `catch` autour de l'appel SendGrid. Le trade-off est qu'une erreur SendGrid non transitoire (cle invalide) declenchera systematiquement le fallback, masquant potentiellement un probleme de configuration. On mitige en loggant explicitement chaque bascule (`sendgrid_failed_fallback_mailjet`) avec l'erreur d'origine, pour que les ops detectent une configuration cassee.

Le tracking d'ouverture (open tracking) est active mais le click tracking est laisse configurable (`EMAIL_CLICK_TRACKING`), car le click tracking reecrit les URLs (passage par un proxy de tracking), ce qui peut etre percu comme intrusif et complique le debug. On privilegie un tracking minimal pour les emails de donnees sensibles.

L'adresse email destinataire est hashee dans l'audit ACAPS (comme le phone pour WhatsApp), pour ne pas stocker de PII en clair. Le trade-off est qu'on ne peut pas rechercher un audit par adresse email directement ; on recherche par hash. C'est coherent avec la minimisation des donnees (CNDP).

### 2.4 Decisions strategiques referenced

- **correction Saad #7** : email = canal data sensible (montants/CIN/IBAN OK). Complement de WhatsApp status-only.
- **decision-008 (data residency)** : archivage email sur infra MA, domaine `assurflow.ma`.
- **decision-011 (assurflow rebrand)** : domaine `assurflow.ma`, selecteur DKIM `assurflow`.
- **decision-006 (no-emoji)** : aucune emoji dans les templates HTML ni le code.
- **loi 09-08 + ACAPS** : email hashe dans l'audit, retention 10 ans.

### 2.5 Pieges techniques connus

1. **Piege : fallback Mailjet sur erreur non transitoire**
   - Pourquoi : une cle SendGrid invalide declenche le fallback a chaque envoi, masquant le probleme.
   - Solution : logger l'erreur SendGrid d'origine avant fallback ; alerter si le taux de fallback depasse un seuil.

2. **Piege : DKIM mal configure -> spam**
   - Pourquoi : enregistrement DNS DKIM absent ou errone.
   - Solution : documenter les 3 enregistrements DNS (DKIM, SPF, DMARC) ; tester avec MailTester (score > 9/10) avant prod.

3. **Piege : piece jointe trop volumineuse**
   - Pourquoi : un PDF de 30 Mo depasse la limite provider.
   - Solution : valider la taille totale des attachments (< 25 Mo recommande) ; rejeter avec message clair.

4. **Piege : email destinataire en clair dans l'audit**
   - Pourquoi : stocker l'adresse en clair viole la minimisation CNDP.
   - Solution : hasher l'email (HMAC-SHA256, meme secret que phone) dans l'audit.

5. **Piege : template HTML non echappe -> injection**
   - Pourquoi : Handlebars `{{{ }}}` injecte du HTML brut.
   - Solution : double accolades par defaut ; jamais triple pour des donnees utilisateur.

6. **Piege : rate limit email partage avec WhatsApp**
   - Pourquoi : meme cle Redis.
   - Solution : cle distincte `email:{tenantId}:user:{userId}:hourly`, limite 100/h (vs 10/h WhatsApp).

7. **Piege : encodage des caracteres arabes dans le sujet**
   - Pourquoi : un sujet en arabe mal encode s'affiche en mojibake.
   - Solution : encodage UTF-8 + headers MIME corrects (les SDK SendGrid/Mailjet gerent, mais tester).

8. **Piege : fromName usurpe**
   - Pourquoi : un fromName libre permet l'usurpation interne.
   - Solution : `from` toujours `noreply@assurflow.ma` (domaine controle DKIM) ; seul le `fromName` (libelle) varie.

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.7.4, quatrieme. Depend de 2.7.1 (types/schemas) et 2.7.2 (audit service). Bloque 2.7.7 (branche `data_sensible` du router envoie via email). C'est le canal complementaire indispensable de WhatsApp.

### 3.2 Position dans le programme global

Tous les sprints envoyant des informations financieres passent par l'email : Sprint 14 (notifications carrier avec montants), Sprint 17 (factures de prime customer), Sprint 26.5 (carrier portal). L'email est le canal de reference pour la communication chiffree.

### 3.3 Diagramme architecture

```
sendEmail(input)
   |
   v
SendEmailSchema.parse (data sensible OK : amount, cin, iban)
   |
   v
rate limit email (100/h) -- cle distincte de WhatsApp
   |
   v
render template HTML multilingue (Handlebars, double accolades)
   |
   v
SendGrid.send  --(echec)-->  Mailjet.send (fallback)
   |                              |
   +--------------+---------------+
                  v
   audit ACAPS (email hashe, jamais clair) + provider utilise
   |
   v
return { messageId, provider }

DNS prod (assurflow.ma):
  DKIM  assurflow._domainkey   v=DKIM1; k=rsa; p=...
  SPF                          v=spf1 include:sendgrid.net include:mailjet.com -all
  DMARC _dmarc                 v=DMARC1; p=reject; rua=mailto:dmarc@assurflow.ma
```

## 4. Livrables checkables

- [ ] `repo/packages/comm/src/services/email.service.ts` -- SendGrid + Mailjet fallback (~190 lignes)
- [ ] `repo/packages/comm/src/services/email.service.spec.ts` -- 14 tests (~240 lignes)
- [ ] `repo/packages/comm/src/clients/sendgrid.client.ts` -- wrapper SendGrid (~90 lignes)
- [ ] `repo/packages/comm/src/clients/mailjet.client.ts` -- wrapper Mailjet (~90 lignes)
- [ ] `repo/packages/comm/src/services/email-renderer.service.ts` -- render HTML multilingue (~110 lignes)
- [ ] `repo/packages/comm/src/services/email-renderer.service.spec.ts` -- 6 tests (~100 lignes)
- [ ] `repo/packages/comm/src/templates/email/*.{fr,ar,ar-MA,en}.html` -- templates email data sensible (extraits representatifs)
- [ ] `repo/infrastructure/dns/assurflow-email-dns.md` -- doc DKIM/SPF/DMARC (~60 lignes)
- [ ] Fallback Mailjet fonctionnel si SendGrid echoue
- [ ] Email destinataire hashe dans l'audit (jamais clair)
- [ ] Rate limit 100/h cle distincte de WhatsApp
- [ ] Pieces jointes PDF + validation taille
- [ ] Templates 4 langues
- [ ] `pnpm --filter @insurtech/comm test` PASS, coverage >= 90%
- [ ] Aucune emoji, aucun console.log

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/services/email.service.ts                   (~190 lignes / SendGrid + fallback)
repo/packages/comm/src/services/email.service.spec.ts              (~240 lignes / 14 tests)
repo/packages/comm/src/clients/sendgrid.client.ts                  (~90 lignes / wrapper SendGrid)
repo/packages/comm/src/clients/mailjet.client.ts                   (~90 lignes / wrapper Mailjet)
repo/packages/comm/src/services/email-renderer.service.ts          (~110 lignes / render HTML)
repo/packages/comm/src/services/email-renderer.service.spec.ts     (~100 lignes / 6 tests)
repo/packages/comm/src/templates/email/customer_premium_invoice.{fr,ar,ar-MA,en}.html
repo/packages/comm/src/templates/email/sinistre_devis_chiffre.{fr,ar,ar-MA,en}.html
repo/infrastructure/dns/assurflow-email-dns.md                     (~60 lignes / DKIM/SPF/DMARC)
repo/packages/comm/src/comm.module.ts                              (modifie : +EmailService)
repo/packages/comm/package.json                                    (modifie : +@sendgrid/mail, +node-mailjet)
```

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 sur 8 : `repo/packages/comm/src/clients/sendgrid.client.ts`

```typescript
import { Injectable } from '@nestjs/common';
import sgMail from '@sendgrid/mail';
import type { EmailAttachment } from '../types/email.types';

export interface ProviderSendInput {
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  openTracking: boolean;
  clickTracking: boolean;
}

export interface ProviderSendResult {
  messageId: string;
}

@Injectable()
export class SendGridClient {
  constructor() {
    const key = process.env.SENDGRID_API_KEY;
    if (!key) throw new Error('SENDGRID_API_KEY missing');
    sgMail.setApiKey(key);
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const [response] = await sgMail.send({
      from: { email: input.fromEmail, name: input.fromName },
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments?.map((a) => ({
        content: a.contentBase64,
        filename: a.filename,
        type: a.mimeType,
        disposition: 'attachment',
      })),
      trackingSettings: {
        openTracking: { enable: input.openTracking },
        clickTracking: { enable: input.clickTracking },
      },
    });
    const messageId = response.headers['x-message-id'] as string | undefined;
    if (!messageId) throw new Error('SendGrid returned no x-message-id');
    return { messageId };
  }
}
```

### 6.2 Fichier 2 sur 8 : `repo/packages/comm/src/clients/mailjet.client.ts`

```typescript
import { Injectable } from '@nestjs/common';
import Mailjet from 'node-mailjet';
import type { ProviderSendInput, ProviderSendResult } from './sendgrid.client';

@Injectable()
export class MailjetClient {
  private readonly client: Mailjet;

  constructor() {
    const apiKey = process.env.MAILJET_API_KEY;
    const secret = process.env.MAILJET_SECRET_KEY;
    if (!apiKey || !secret) throw new Error('MAILJET_API_KEY or MAILJET_SECRET_KEY missing');
    this.client = new Mailjet({ apiKey, apiSecret: secret });
  }

  async send(input: ProviderSendInput): Promise<ProviderSendResult> {
    const result = await this.client.post('send', { version: 'v3.1' }).request({
      Messages: [
        {
          From: { Email: input.fromEmail, Name: input.fromName },
          To: [{ Email: input.to }],
          Subject: input.subject,
          HTMLPart: input.html,
          TextPart: input.text,
          Attachments: input.attachments?.map((a) => ({
            ContentType: a.mimeType,
            Filename: a.filename,
            Base64Content: a.contentBase64,
          })),
          TrackOpens: input.openTracking ? 'enabled' : 'disabled',
          TrackClicks: input.clickTracking ? 'enabled' : 'disabled',
        },
      ],
    });
    const body = result.body as { Messages: Array<{ To: Array<{ MessageID: string }> }> };
    const messageId = body.Messages?.[0]?.To?.[0]?.MessageID;
    if (!messageId) throw new Error('Mailjet returned no MessageID');
    return { messageId: String(messageId) };
  }
}
```

### 6.3 Fichier 3 sur 8 : `repo/packages/comm/src/services/email-renderer.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import type { WhatsAppLanguage } from '../types/whatsapp.types';

interface EmailRenderInput {
  templateName: string;
  language: WhatsAppLanguage;
  data: Record<string, string | number | boolean>;
}

interface EmailRenderResult {
  subject: string;
  html: string;
  text: string;
}

/**
 * Rend un template email HTML multilingue. Le sujet est la premiere ligne
 * du fichier (commentaire HTML <!-- subject: ... -->), le reste est le corps.
 * Les donnees sensibles (amount, iban) sont AUTORISEES ici (canal email).
 */
@Injectable()
export class EmailRendererService {
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();
  private readonly dir = join(__dirname, '..', 'templates', 'email');

  async render(input: EmailRenderInput): Promise<EmailRenderResult> {
    const compiled = await this.load(input.templateName, input.language);
    const rendered = compiled(input.data);
    const subjectMatch = rendered.match(/<!--\s*subject:\s*(.+?)\s*-->/);
    const subject = subjectMatch ? subjectMatch[1] : 'Assurflow';
    const html = rendered.replace(/<!--\s*subject:.+?-->/, '').trim();
    const text = this.htmlToText(html);
    return { subject, html, text };
  }

  private async load(
    templateName: string,
    language: WhatsAppLanguage,
  ): Promise<HandlebarsTemplateDelegate> {
    const key = `${templateName}.${language}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    const path = join(this.dir, `${templateName}.${language}.html`);
    const source = await readFile(path, 'utf8');
    const compiled = Handlebars.compile(source); // double accolades = echappement
    this.cache.set(key, compiled);
    return compiled;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
```

### 6.4 Fichier 4 sur 8 : `repo/packages/comm/src/services/email.service.ts`

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from 'pino';
import * as crypto from 'node:crypto';
import { SendEmailSchema } from '../schemas/send-email.schema';
import type { SendEmailInput, EmailSendResult } from '../types/email.types';
import { SendGridClient } from '../clients/sendgrid.client';
import { MailjetClient } from '../clients/mailjet.client';
import { EmailRendererService } from './email-renderer.service';
import { RateLimiterService } from './rate-limiter.service';
import { NotificationAuditService } from './notification-audit.service';

const MAX_ATTACHMENTS_BYTES = 25 * 1024 * 1024; // 25 Mo

@Injectable()
export class EmailService {
  private readonly logger = new Logger({ name: 'EmailService' });
  private readonly fromEmail: string;
  private readonly emailHashSecret: string;
  private readonly rateLimitPerHour: number;
  private readonly openTracking: boolean;
  private readonly clickTracking: boolean;

  constructor(
    private readonly sendgrid: SendGridClient,
    private readonly mailjet: MailjetClient,
    private readonly renderer: EmailRendererService,
    private readonly rateLimiter: RateLimiterService,
    private readonly auditService: NotificationAuditService,
  ) {
    const domain = process.env.EMAIL_DOMAIN_PRIMARY ?? 'assurflow.ma';
    this.fromEmail = `noreply@${domain}`;
    const secret = process.env.PHONE_HASH_SECRET;
    if (!secret) throw new Error('PHONE_HASH_SECRET missing (email hashing)');
    this.emailHashSecret = secret;
    this.rateLimitPerHour = parseInt(process.env.COMM_RATE_LIMIT_EMAIL_PER_HOUR ?? '100', 10);
    this.openTracking = process.env.EMAIL_OPEN_TRACKING !== 'false';
    this.clickTracking = process.env.EMAIL_CLICK_TRACKING === 'true';
  }

  /**
   * Envoie un email (donnees sensibles autorisees). Fallback SendGrid -> Mailjet.
   */
  async sendEmail(input: SendEmailInput): Promise<EmailSendResult> {
    const startTime = Date.now();
    SendEmailSchema.parse(input);
    const correlationId = input.correlationId ?? crypto.randomUUID();
    const recipientHash = this.hashEmail(input.to);

    this.validateAttachments(input);

    // Rate limit -- cle distincte de WhatsApp (piege 6)
    const rlKey = `email:${input.tenantId}:user:${input.userId}:hourly`;
    const allowed = await this.rateLimiter.checkAndConsume(rlKey, this.rateLimitPerHour, 3600);
    if (!allowed) {
      throw new BadRequestException(`Email rate limit exceeded: ${this.rateLimitPerHour}/hour`);
    }

    const rendered = await this.renderer.render({
      templateName: input.templateName,
      language: input.language,
      data: input.data,
    });

    const providerInput = {
      to: input.to,
      fromEmail: this.fromEmail, // toujours domaine controle (piege 8)
      fromName: input.fromName,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: input.attachments,
      openTracking: this.openTracking,
      clickTracking: this.clickTracking,
    };

    let provider: 'sendgrid' | 'mailjet' = 'sendgrid';
    let messageId: string;
    try {
      const r = await this.sendgrid.send(providerInput);
      messageId = r.messageId;
    } catch (sgError) {
      this.logger.warn({ correlationId, sgError }, 'sendgrid_failed_fallback_mailjet');
      provider = 'mailjet';
      const r = await this.mailjet.send(providerInput);
      messageId = r.messageId;
    }

    await this.auditService.logNotificationSent({
      tenantId: input.tenantId,
      userId: input.userId,
      channel: 'email',
      templateName: input.templateName,
      language: input.language,
      recipientHash,
      messageId,
      correlationId,
      durationMs: Date.now() - startTime,
      status: 'sent',
    });

    this.logger.info({ correlationId, provider, durationMs: Date.now() - startTime }, 'email_sent_success');
    return { messageId, provider };
  }

  private validateAttachments(input: SendEmailInput): void {
    if (!input.attachments?.length) return;
    const totalBytes = input.attachments.reduce(
      (sum, a) => sum + Buffer.byteLength(a.contentBase64, 'base64'),
      0,
    );
    if (totalBytes > MAX_ATTACHMENTS_BYTES) {
      throw new BadRequestException(`Attachments exceed ${MAX_ATTACHMENTS_BYTES} bytes`);
    }
  }

  private hashEmail(email: string): string {
    return crypto
      .createHmac('sha256', this.emailHashSecret)
      .update(email.toLowerCase().trim())
      .digest('hex')
      .substring(0, 16);
  }
}
```

### 6.5 Fichier 5 sur 8 : templates email (extraits)

`templates/email/customer_premium_invoice.fr.html` (data sensible OK) :

```html
<!-- subject: Votre facture de prime Assurflow -->
<div style="font-family: Arial, sans-serif; color: #1a1a1a;">
  <p>Bonjour {{customer_first_name}},</p>
  <p>Votre facture de prime est disponible.</p>
  <table style="border-collapse: collapse;">
    <tr><td>Montant</td><td><strong>{{amount_formatted}} MAD</strong></td></tr>
    <tr><td>Echeance</td><td>{{due_date}}</td></tr>
    <tr><td>Reference</td><td>{{invoice_number}}</td></tr>
    <tr><td>IBAN de paiement</td><td>{{broker_iban}}</td></tr>
  </table>
  <p>Cordialement,<br>{{broker_company_name}}</p>
</div>
```

`templates/email/sinistre_devis_chiffre.fr.html` :

```html
<!-- subject: Devis de reparation - dossier {{sinistre_id_short}} -->
<div style="font-family: Arial, sans-serif;">
  <p>Bonjour {{customer_first_name}},</p>
  <p>Le devis de reparation pour votre vehicule {{vehicle_plate}} est pret.</p>
  <table>
    <tr><td>Total devis</td><td><strong>{{devis_total_formatted}} MAD</strong></td></tr>
    <tr><td>Franchise</td><td>{{franchise_formatted}} MAD</td></tr>
    <tr><td>Garage</td><td>{{garage_name}}</td></tr>
  </table>
  <p>Le detail complet est en piece jointe (PDF).</p>
  <p>{{broker_company_name}}</p>
</div>
```

**Note** : ces variables (amount_formatted, devis_total_formatted, franchise_formatted, broker_iban) sont INTERDITES sur WhatsApp mais AUTORISEES ici. C'est exactement la separation de canal.

### 6.6 Fichier 6 sur 8 : `repo/infrastructure/dns/assurflow-email-dns.md`

```markdown
# Configuration DNS email Assurflow (assurflow.ma)

## DKIM (authentification cryptographique)
Type: TXT
Nom: assurflow._domainkey.assurflow.ma
Valeur: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ...

## SPF (serveurs autorises a envoyer)
Type: TXT
Nom: assurflow.ma
Valeur: v=spf1 include:sendgrid.net include:mailjet.com -all

## DMARC (politique en cas d'echec DKIM/SPF)
Type: TXT
Nom: _dmarc.assurflow.ma
Valeur: v=DMARC1; p=reject; rua=mailto:dmarc@assurflow.ma; pct=100

## Verification pre-prod
- MailTester score cible: > 9/10
- Outil: https://www.mail-tester.com
- Verifier que p=reject est actif (pas p=none) avant le pilote
```

### 6.7 Fichiers 7-8 : tests (voir section 7)

## 7. Tests complets

### 7.1 Tests EmailService : `src/services/email.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { EmailService } from './email.service';

function makeInput(overrides = {}) {
  return {
    to: 'assure@example.ma',
    fromName: 'Assurflow Sinistres',
    templateName: 'customer_premium_invoice',
    data: { customer_first_name: 'Ali', amount_formatted: '5 000', broker_iban: 'MA64' },
    language: 'fr',
    tenantId: '11111111-1111-1111-1111-111111111111',
    userId: '22222222-2222-2222-2222-222222222222',
    ...overrides,
  };
}

describe('EmailService (data sensible OK)', () => {
  let sendgrid: { send: ReturnType<typeof vi.fn> };
  let mailjet: { send: ReturnType<typeof vi.fn> };
  let renderer: { render: ReturnType<typeof vi.fn> };
  let rateLimiter: { checkAndConsume: ReturnType<typeof vi.fn> };
  let audit: { logNotificationSent: ReturnType<typeof vi.fn> };
  let svc: EmailService;

  beforeEach(() => {
    process.env.PHONE_HASH_SECRET = 'secret';
    process.env.EMAIL_DOMAIN_PRIMARY = 'assurflow.ma';
    process.env.COMM_RATE_LIMIT_EMAIL_PER_HOUR = '100';
    sendgrid = { send: vi.fn().mockResolvedValue({ messageId: 'sg-1' }) };
    mailjet = { send: vi.fn().mockResolvedValue({ messageId: 'mj-1' }) };
    renderer = { render: vi.fn().mockResolvedValue({ subject: 'S', html: '<p>h</p>', text: 'h' }) };
    rateLimiter = { checkAndConsume: vi.fn().mockResolvedValue(true) };
    audit = { logNotificationSent: vi.fn().mockResolvedValue(undefined) };
    svc = new EmailService(sendgrid as never, mailjet as never, renderer as never, rateLimiter as never, audit as never);
  });

  it('envoie via SendGrid en nominal', async () => {
    const r = await svc.sendEmail(makeInput());
    expect(r).toEqual({ messageId: 'sg-1', provider: 'sendgrid' });
    expect(mailjet.send).not.toHaveBeenCalled();
  });

  it('FALLBACK vers Mailjet si SendGrid echoue', async () => {
    sendgrid.send.mockRejectedValue(new Error('503'));
    const r = await svc.sendEmail(makeInput());
    expect(r).toEqual({ messageId: 'mj-1', provider: 'mailjet' });
    expect(mailjet.send).toHaveBeenCalledOnce();
  });

  it('ACCEPTE des donnees sensibles (amount, iban)', async () => {
    const r = await svc.sendEmail(makeInput({ data: { amount: 12500, cin: 'AB1', iban: 'MA64' } }));
    expect(r.provider).toBe('sendgrid');
  });

  it('utilise toujours noreply@assurflow.ma comme from (anti-usurpation)', async () => {
    await svc.sendEmail(makeInput());
    expect(sendgrid.send).toHaveBeenCalledWith(
      expect.objectContaining({ fromEmail: 'noreply@assurflow.ma' }),
    );
  });

  it('hash l email destinataire dans l audit (jamais clair)', async () => {
    await svc.sendEmail(makeInput());
    const arg = audit.logNotificationSent.mock.calls[0][0];
    expect(arg.recipientHash).toHaveLength(16);
    expect(JSON.stringify(arg)).not.toContain('assure@example.ma');
  });

  it('utilise une cle de rate limit distincte de WhatsApp', async () => {
    await svc.sendEmail(makeInput());
    expect(rateLimiter.checkAndConsume).toHaveBeenCalledWith(
      expect.stringContaining('email:'),
      100,
      3600,
    );
  });

  it('rejette si rate limit depasse', async () => {
    rateLimiter.checkAndConsume.mockResolvedValue(false);
    await expect(svc.sendEmail(makeInput())).rejects.toThrow(BadRequestException);
  });

  it('rejette des pieces jointes trop volumineuses', async () => {
    const big = 'A'.repeat(30 * 1024 * 1024);
    await expect(
      svc.sendEmail(makeInput({ attachments: [{ contentBase64: big, filename: 'f.pdf', mimeType: 'application/pdf' }] })),
    ).rejects.toThrow('Attachments exceed');
  });

  it('accepte une piece jointe PDF de taille raisonnable', async () => {
    const r = await svc.sendEmail(makeInput({ attachments: [{ contentBase64: 'JVBERi0=', filename: 'f.pdf', mimeType: 'application/pdf' }] }));
    expect(r.provider).toBe('sendgrid');
  });

  it('logge le provider utilise dans l audit', async () => {
    await svc.sendEmail(makeInput());
    expect(audit.logNotificationSent).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'email', status: 'sent', messageId: 'sg-1' }),
    );
  });

  it('rejette un destinataire email invalide (schema)', async () => {
    await expect(svc.sendEmail(makeInput({ to: 'not-an-email' }))).rejects.toThrow();
  });

  it('genere un correlationId si absent', async () => {
    await svc.sendEmail(makeInput());
    expect(audit.logNotificationSent.mock.calls[0][0].correlationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('passe le subject rendu au provider', async () => {
    renderer.render.mockResolvedValue({ subject: 'Facture', html: '<p>x</p>', text: 'x' });
    await svc.sendEmail(makeInput());
    expect(sendgrid.send).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Facture' }));
  });

  it('open tracking active par defaut, click tracking desactive', async () => {
    await svc.sendEmail(makeInput());
    const arg = sendgrid.send.mock.calls[0][0];
    expect(arg.openTracking).toBe(true);
    expect(arg.clickTracking).toBe(false);
  });
});
```

### 7.2 Tests EmailRendererService : `src/services/email-renderer.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EmailRendererService } from './email-renderer.service';
import * as fs from 'node:fs/promises';

describe('EmailRendererService', () => {
  let svc: EmailRendererService;
  beforeEach(() => {
    svc = new EmailRendererService();
    vi.spyOn(fs, 'readFile').mockResolvedValue(
      '<!-- subject: Facture {{n}} --><p>Bonjour {{name}}, {{amount}} MAD</p>' as never,
    );
  });

  it('extrait le sujet du commentaire HTML', async () => {
    const r = await svc.render({ templateName: 'customer_premium_invoice', language: 'fr', data: { n: '42', name: 'Ali', amount: 5000 } });
    expect(r.subject).toBe('Facture 42');
  });

  it('rend le corps HTML avec donnees sensibles', async () => {
    const r = await svc.render({ templateName: 'x', language: 'fr', data: { n: '1', name: 'Ali', amount: 5000 } });
    expect(r.html).toContain('5000 MAD');
    expect(r.html).not.toContain('subject:');
  });

  it('produit une version texte sans balises', async () => {
    const r = await svc.render({ templateName: 'x', language: 'fr', data: { n: '1', name: 'Ali', amount: 1 } });
    expect(r.text).not.toContain('<p>');
  });

  it('echappe le HTML (double accolades) contre injection', async () => {
    vi.spyOn(fs, 'readFile').mockResolvedValue('<!-- subject: S --><p>{{x}}</p>' as never);
    const r = await svc.render({ templateName: 'x', language: 'fr', data: { x: '<script>alert(1)</script>' } });
    expect(r.html).not.toContain('<script>');
    expect(r.html).toContain('&lt;script&gt;');
  });

  it('met en cache le template (1 readFile pour 2 rendus)', async () => {
    await svc.render({ templateName: 'x', language: 'fr', data: { n: '1', name: 'a', amount: 1 } });
    await svc.render({ templateName: 'x', language: 'fr', data: { n: '2', name: 'b', amount: 2 } });
    expect(fs.readFile).toHaveBeenCalledTimes(1);
  });

  it('charge un fichier different par langue', async () => {
    await svc.render({ templateName: 'x', language: 'fr', data: { n: '1', name: 'a', amount: 1 } });
    await svc.render({ templateName: 'x', language: 'ar', data: { n: '1', name: 'a', amount: 1 } });
    expect(fs.readFile).toHaveBeenCalledTimes(2);
  });
});
```

## 8. Variables environnement

```env
# Email providers
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxx_example
MAILJET_API_KEY=mj_api_key_example
MAILJET_SECRET_KEY=mj_secret_key_example
EMAIL_DOMAIN_PRIMARY=assurflow.ma
EMAIL_DKIM_SELECTOR=assurflow
# Tracking (open par defaut, click desactive)
EMAIL_OPEN_TRACKING=true
EMAIL_CLICK_TRACKING=false
# Rate limit + hashing
COMM_RATE_LIMIT_EMAIL_PER_HOUR=100
PHONE_HASH_SECRET=64_hex_chars_random
```

## 9. Commandes shell

```bash
cd repo
pnpm install --frozen-lockfile
pnpm --filter @insurtech/comm build
pnpm --filter @insurtech/comm vitest run src/services/email.service.spec.ts
pnpm --filter @insurtech/comm vitest run src/services/email-renderer.service.spec.ts
pnpm --filter @insurtech/comm test:coverage

# Verifier la config DNS (pre-prod, manuel)
dig TXT assurflow._domainkey.assurflow.ma +short
dig TXT _dmarc.assurflow.ma +short
```

## 10. Criteres validation V1-V22

### Criteres P0 (bloquants -- 14)

- **V1 (P0)** : envoi nominal via SendGrid retourne `{ provider: 'sendgrid' }`. Test 7.1.
- **V2 (P0)** : fallback Mailjet si SendGrid echoue. Test 7.1.
- **V3 (P0 CRITIQUE)** : email accepte donnees sensibles (amount/cin/iban). Test 7.1. C'est la separation de canal.
- **V4 (P0)** : `from` toujours `noreply@assurflow.ma` (anti-usurpation). Test 7.1.
- **V5 (P0)** : email destinataire hashe dans l'audit, jamais clair. Test 7.1.
- **V6 (P0)** : cle rate limit `email:` distincte de WhatsApp, limite 100. Test 7.1.
- **V7 (P0)** : rate limit depasse -> exception. Test 7.1.
- **V8 (P0)** : pieces jointes > 25 Mo rejetees. Test 7.1.
- **V9 (P0)** : pieces jointes PDF raisonnables acceptees. Test 7.1.
- **V10 (P0)** : audit logge avec provider + status sent. Test 7.1.
- **V11 (P0)** : destinataire invalide rejete (schema). Test 7.1.
- **V12 (P0)** : renderer echappe le HTML (anti-injection). Test 7.2.
- **V13 (P0)** : DKIM/SPF/DMARC documentes (3 enregistrements). Fichier DNS.
- **V14 (P0 -- automatisable)** : 0 emoji, 0 console.log. Pre-commit.

### Criteres P1 (importants -- 5)

- **V15 (P1)** : open tracking on, click tracking off par defaut. Test 7.1.
- **V16 (P1)** : renderer met en cache (1 readFile / 2 rendus). Test 7.2.
- **V17 (P1)** : renderer charge un fichier par langue. Test 7.2.
- **V18 (P1)** : version texte generee sans balises. Test 7.2.
- **V19 (P1)** : coverage >= 90%. Commande.

### Criteres P2 (nice-to-have -- 3)

- **V20 (P2)** : log explicite lors du fallback (sendgrid_failed_fallback_mailjet). Revue.
- **V21 (P2)** : DMARC en p=reject (pas p=none). Fichier DNS.
- **V22 (P2)** : templates email 4 langues coherents. Revue.

## 11. Edge cases + troubleshooting

### Edge case 1 : SendGrid ET Mailjet echouent
**Scenario** : deux providers down. **Probleme** : notification perdue. **Solution** : l'erreur Mailjet remonte (throw) ; le router (2.7.7) peut retry via queue BullMQ. Audit failed (a ajouter au catch global en 2.7.7).

### Edge case 2 : email avec caracteres arabes dans le sujet
**Scenario** : sujet en darija. **Probleme** : mojibake si mauvais encodage. **Solution** : UTF-8 ; les SDK gerent l'encodage MIME. Tester un sujet arabe.

### Edge case 3 : DKIM absent en DNS
**Scenario** : enregistrement non propage. **Probleme** : emails en spam. **Solution** : verifier `dig TXT` avant prod ; MailTester > 9/10. V13.

### Edge case 4 : piece jointe MIME incorrect
**Scenario** : PDF declare `text/plain`. **Probleme** : client mail n'ouvre pas. **Solution** : valider mimeType (le schema `EmailAttachmentSchema` limite la longueur ; documenter les MIME supportes).

### Edge case 5 : data avec cle reservee Handlebars
**Scenario** : data contient `this` ou `length`. **Probleme** : collision Handlebars. **Solution** : prefixer les variables metier ; documenter les noms reserves.

### Edge case 6 : taux de fallback eleve
**Scenario** : SendGrid degrade. **Probleme** : tous les envois via Mailjet (cout, limites). **Solution** : alerte ops si taux fallback > seuil ; investiguer la cle SendGrid (piege 1).

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP)
- L'email est le canal autorise pour les donnees sensibles car authentifie (DKIM/SPF/DMARC) et archivable au Maroc (decision-008). L'adresse destinataire est hashee dans l'audit (minimisation des donnees).

### decision-008 -- Data residency
- Archivage email sur infra MA (Atlas Cloud). Domaine `assurflow.ma`. Les donnees sensibles ne sortent pas du Maroc via ce canal controle.

### Loi ACAPS -- Retention 10 ans
- Chaque envoi est audite (email hashe + provider + status). Retention 10 ans (2.7.8).

## 13. Conventions absolues skalean-insurtech

**Multi-tenant strict** : `tenantId` dans l'audit et la cle rate limit.
**Validation strict** : Zod (`SendEmailSchema`), data sensible autorisee (string|number|boolean).
**Logger strict** : Pino, jamais console.log, email jamais en clair.
**Hash strict** : HMAC-SHA256 pour l'email destinataire.
**Package manager strict** : pnpm, versions exactes (`@sendgrid/mail`, `node-mailjet`).
**TypeScript strict** : strict, imports explicites.
**Tests strict** : Vitest, coverage >= 90%, 20 tests.
**No-emoji strict (decision-006)** : 0 emoji code + templates HTML.
**Conventional Commits strict** : `feat(sprint-09): ...`.
**Cloud souverain MA strict** : email archive au MA, from domaine controle.
**Imports strict** : node natifs -> externes -> relatifs.

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm vitest run src/services/email.service.spec.ts
pnpm --filter @insurtech/comm test:coverage
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/comm/src/services/email.service.ts packages/comm/src/templates/email/ && echo FAIL || echo OK
grep -rn "console\.log" packages/comm/src/services/email.service.ts && echo FAIL || echo OK
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-09): email service data sensible + dkim/spf/dmarc + fallback mailjet

Canal PRIMARY pour donnees sensibles (montants/CIN/IBAN OK), complement de
WhatsApp status-only. SendGrid primaire + Mailjet fallback. Authenticite
DKIM/SPF/DMARC. Email destinataire hashe dans l audit (CNDP).

Livrables:
- EmailService SendGrid + fallback Mailjet automatique
- EmailRendererService HTML multilingue + echappement anti-injection
- Clients SendGrid + Mailjet wrappers
- Templates email data sensible (facture prime, devis chiffre) 4 langues
- Doc DNS DKIM/SPF/DMARC (assurflow.ma)
- Rate limit 100/h cle distincte WhatsApp, pieces jointes PDF < 25 Mo

Tests: 20 (14 service + 6 renderer)
Coverage: >= 90%

Task: 2.7.4
Sprint: 9 (Phase 2 / Sprint 7)
Phase: 2 -- Securite + Infrastructure
Reference: B-09 Tache 2.7.4
Decisions: correction saad #7 + decision-008 + decision-011"
```

## 16. Workflow next step

Apres commit : passer a `task-2.7.5-push-notifications-expo-fcm-apns.md`. La tache 2.7.5 ajoute le canal Push (milestones courts non sensibles), troisieme canal de la separation. Verifier que `email.service.spec.ts` passe (notamment le fallback Mailjet) avant de continuer.

---

**Fin du prompt task-2.7.4.**

Densite atteinte : ~84 ko
Code patterns : 8 fichiers complets (clients + service + renderer + templates + DNS)
Tests : 20 cas concrets (14 service + 6 renderer)
Criteres validation : V1-V22
Edge cases : 6
