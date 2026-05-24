# META-PROMPT B-09 v3.0 -- SPRINT 9 COMM WHATSAPP SCOPE STRICT + EMAIL DATA SENSIBLE

**Version** : v3.0 (REFONTE critique v2.2 -- correction Saad terrain #7 CNDP)
**Phase** : 2 -- Securite + Infrastructure
**Sprint** : 9 / 40 (cumul v3.0) -- Phase 2 Sprint 7
**Position** : Apres CRM + Booking (Sprint 8), avant Docs + Signature (Sprint 10)
**Numerotation taches** : 2.7.1 a 2.7.10
**Effort total** : ~45 heures developpement / 1 semaine
**Priorite** : P0 CRITIQUE LEGAL (correction Saad terrain #7 -- conformite CNDP loi 09-08)

---

## Objectif Global du Sprint

Construire le **package @insurtech/comm** (NOUVEAU v3.0) qui orchestre 4 canaux de communication avec **scope strict canal** -- correction critique Saad #7 (CNDP loi 09-08 protection donnees personnelles + risque social engineering Maroc).

**Refonte critique v3.0** par rapport a v2.2 :
- WhatsApp = **STATUS ONLY** absolument (jamais data sensible) -- whitelist 45 templates + blacklist 15 patterns server-side
- Email = canal **primary data sensible** (montants + CIN + IBAN OK)
- Push = milestones courts mobile (pas data sensible visible lockscreen)
- SMS = **OTP only** (2FA authentication uniquement, pas notifications generales)
- Audit ACAPS 10 ans retention chaque notification envoyee
- Multilingue 4 langues (fr / ar / ar-MA darija / en) -- decision-008
- Phone hash SHA256 16 chars (jamais plain dans audits)

A la sortie de ce sprint :
- Package `@insurtech/comm` avec types + schemas Zod + 4 services canaux + Notification Router
- Service WhatsApp scope strict avec enforcement 7 etapes (whitelist + blacklist + rate limit + language + Meta API + audit + phone hash)
- 45 templates Handlebars WhatsApp (6 categories x 4 langues = 180 variantes) + sync Meta Business Manager
- Service Email avec DKIM/SPF/DMARC + attachments PDF + multilingue
- Service Push notifications Expo + FCM + APNs
- Service SMS reserve OTP only (Twilio Maroc / Orange Maroc)
- Notification Router multi-canal avec logic content_type (status_only / data_sensible / urgent)
- Audit ACAPS notifications loggees 10 ans retention
- Endpoints REST + permissions Sprint 7.5a (`customer.notifications.manage`)
- Tests E2E 30+ scenarios + 8+ tests blacklist CRITIQUES + benchmarks P95 < 2s
- Coverage Sprint 9 >= 90% (vs 85% standard) car critique correction Saad

---

## Frontiere du Sprint

**INCLUS** :
- Package @insurtech/comm (types + schemas + 4 services + router)
- WhatsApp service avec enforcement scope strict (whitelist 45 + blacklist 15 patterns)
- 45 templates Handlebars WhatsApp x 4 langues = 180 variantes
- Sync Meta Business Manager (creation templates remote + recuperation templateId)
- Email service avec DKIM/SPF/DMARC + multilingue
- Push notifications Expo SDK 51 + FCM + APNs
- SMS service OTP only
- Notification Router multi-canal
- Audit ACAPS log every notification (channel + template + recipient_hash + tenant_id)
- Migration `whatsapp_templates_registry` + extension `compliance_acaps_audits`
- Rate limiting per-user (10 WA/heure + 100 emails/heure)
- Permissions Sprint 7.5a `customer.notifications.manage` enforced
- Documentation policy WhatsApp scope strict (150+ lignes)
- Tests 30+ scenarios E2E + 8+ blacklist CRITIQUES end-to-end

**EXCLU** (sera ajoute aux sprints suivants) :
- Notifications carrier-specifiques (Sprint 14 Insure foundation)
- Notifications tow chauffeur GPS (Sprint 22.5 Tow App)
- Notifications expert assignments (Sprint 22.7 Expert App)
- Templates marketing (post-pilote -- Phase 7+)
- A/B testing notifications (post-pilote)
- Chatbot WhatsApp inbound (Sprint 31 Agent Sky)

---

## Lectures Prealables Obligatoires

1. **Decision-006** : NO emoji policy (templates Handlebars)
2. **Decision-008** : Data residency Maroc + multilingue 4 langues
3. **Correction Saad terrain #7** : WhatsApp scope strict CNDP -- documentation conformite
4. **Sortie Sprint 4** : Pattern audit ACAPS table `compliance_acaps_audits`
5. **Sortie Sprint 5** : Pattern @insurtech/auth + permissions Sprint 7.5a
6. **Sortie Sprint 7.5a** : 130 permissions `as const` + naming `customer.notifications.manage`
7. **Sortie Sprint 8** : Pattern Booking + CRM events Kafka
8. **Loi 09-08 CNDP Maroc** : protection donnees personnelles (article 12-14 traitement loyaux + finalite definie)
9. **Loi ACAPS** : retention 10 ans toute communication assurance

---

## Stack Imposee (Sprint 9)

| Composant | Version | Notes |
|-----------|---------|-------|
| @nestjs/common | 10.4.x | Module Comm |
| @nestjs/bullmq | 10.x | Queue notifications retry |
| handlebars | 4.7.x | Templates engine 45 WhatsApp |
| zod | 3.24.1 | Schemas validation SendWhatsAppStatus + SendEmail |
| pino | 9.6.x | Logs structures |
| node-fetch | 3.x | Meta WhatsApp Cloud API client |
| axios | 1.7.x | SendGrid + Mailjet REST |
| nodemailer | 6.9.x | Email fallback SMTP |
| expo-server-sdk | 3.10.x | Push notifications mobile |
| firebase-admin | 12.x | FCM Android |
| @parse/node-apn | 6.x | APNs iOS |
| twilio | 5.x | SMS Maroc |
| crypto (node:crypto) | builtin | SHA256 phone hash |
| @insurtech/auth | workspace | Permissions Sprint 7.5a |
| @insurtech/database | workspace | TypeORM repositories |

**Variables env requises** :
- `WHATSAPP_META_PHONE_NUMBER_ID` (Meta Business Manager phone ID)
- `WHATSAPP_META_ACCESS_TOKEN` (Meta Cloud API token long-lived)
- `WHATSAPP_META_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_META_APP_SECRET` (HMAC webhooks)
- `SENDGRID_API_KEY` (Email primary)
- `MAILJET_API_KEY` + `MAILJET_SECRET_KEY` (Email fallback)
- `EMAIL_DOMAIN_PRIMARY=assurflow.ma`
- `EMAIL_DKIM_SELECTOR=assurflow`
- `EXPO_ACCESS_TOKEN` (Push notifications)
- `FCM_SERVER_KEY` (Android push)
- `APNS_KEY_ID` + `APNS_TEAM_ID` + `APNS_KEY_FILE_PATH` (iOS push)
- `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE_FROM` (SMS)
- `ORANGE_MAROC_API_KEY` (SMS fallback Maroc-specific)
- `PHONE_HASH_SECRET` (SHA256 salt)
- `COMM_RATE_LIMIT_WA_PER_HOUR=10`
- `COMM_RATE_LIMIT_EMAIL_PER_HOUR=100`

---

## Vue d'Ensemble des 10 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 2.7.1 | Package @insurtech/comm + types + schemas + constants whitelist/blacklist | 4h | P0 | Sprint 8 |
| 2.7.2 | **CRITIQUE** WhatsApp service scope strict (7 etapes enforcement) | 8h | P0 CRITIQUE | 2.7.1 |
| 2.7.3 | Templates WhatsApp Handlebars 45 + sync Meta Business Manager (180 variantes) | 6h | P0 | 2.7.2 |
| 2.7.4 | Email service data sensible (DKIM/SPF/DMARC + multilingue) | 5h | P0 | 2.7.3 |
| 2.7.5 | Push notifications mobile (Expo + FCM + APNs) | 5h | P0 | 2.7.4 |
| 2.7.6 | SMS OTP only service (Twilio + Orange Maroc) | 4h | P0 | 2.7.5 |
| 2.7.7 | Notification Router multi-canal orchestration (content_type logic) | 5h | P0 | 2.7.6 |
| 2.7.8 | Audit ACAPS notifications + traceability 10 ans + phone_hash | 4h | P0 | 2.7.7 |
| 2.7.9 | Endpoints REST + permissions `customer.notifications.manage` | 3h | P0 | 2.7.8 |
| 2.7.10 | Tests E2E 30+ scenarios + 8+ blacklist CRITIQUES + benchmarks | 5h | P0 | 2.7.9 |
| | **TOTAL** | **45h** | | |

---

## Architecture Multi-Canal Scope Strict

### Distinction critique des canaux (correction Saad #7)

```
+--------------------------------------------------------------+
|                    NOTIFICATION ROUTER                       |
|         (decide canal selon content_type + user prefs)      |
+--------------------------------------------------------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
   content_type=        content_type=       content_type=
   'status_only'        'data_sensible'     'urgent'
        |                   |                   |
        v                   v                   v
   +---------+         +---------+        +-------------+
   | WhatsApp |        |  Email  |        | Push + SMS  |
   | (45 wht) |        |  (DKIM) |        |  + Email    |
   |  + Push  |        |   ONLY  |        | (multicanal)|
   +---------+         +---------+        +-------------+
        |                   |                   |
        v                   v                   v
   Status updates       Devis + recus      Emergency
   "votre sinistre"     "facture 12,500"   "tow arrive"
   "validation OK"      "CIN BK456789"     "police 19"
                                          
   JAMAIS:              OK:                MIXTE:
   - amount             - amount           - status sur WA
   - cin                - cin              - data sur Email
   - total_mad          - iban             - alert sur SMS
   - franchise          - total_mad
   - iban               - devis_total
```

**Pourquoi cette stricte separation** (correction Saad #7) :
1. **WhatsApp Meta = serveurs USA** -- transit data sensible viole loi 09-08 CNDP
2. **WhatsApp = vecteur social engineering Maroc** -- escrocs manipulent montants visibles
3. **Email = protocole SMTP/IMAP** controllable + DKIM/SPF/DMARC + archivage local Maroc OK
4. **Push notifications** = visible lockscreen mobile (jamais montants)
5. **SMS** = canal cher + caracteres limites -> reserve OTP critical seulement

---

## EXECUTION SEQUENTIELLE DES 10 TACHES

---

### Tache 2.7.1 : Package @insurtech/comm + types + schemas + constants

**Metadonnees** : P0 | 4h | Depend de : Sprint 8

**But** : Bootstrap package @insurtech/comm avec types Communication + Notification + Template + 4 canaux + exporter STATUS_ONLY_TEMPLATES (45) + BLACKLISTED_FIELD_PATTERNS (15).

**Structure du package** :
```
repo/packages/comm/
  package.json
  tsconfig.json
  src/
    types/
      whatsapp.types.ts        # WhatsAppTemplate + Category + Context types
      email.types.ts           # EmailMessage + Attachment types
      push.types.ts            # PushNotification + DeepLink types
      sms.types.ts             # SmsOtp + OtpStatus types
    schemas/
      send-whatsapp.schema.ts  # Zod SendWhatsAppStatus
      send-email.schema.ts     # Zod SendEmail (data sensible OK)
      send-push.schema.ts      # Zod SendPush
      send-otp.schema.ts       # Zod SendOtp
    constants/
      status-only-templates.ts # WHITELIST 45 templates (6 categories)
      blacklisted-fields.ts    # BLACKLIST 15 patterns server-side
      template-categories.ts   # 6 categories enum
    services/
      whatsapp.service.ts      # CRITIQUE Tache 2.7.2
      email.service.ts         # Tache 2.7.4
      push.service.ts          # Tache 2.7.5
      sms.service.ts           # Tache 2.7.6
      notification-router.service.ts  # Tache 2.7.7
      notification-audit.service.ts   # Tache 2.7.8
      template-manager.service.ts     # Tache 2.7.3
    templates/
      whatsapp/                # 45 templates x 4 langues = 180 .hbs files
        repair/                # 9 templates garage
        insure/                # 6 templates carrier
        customer/              # 12 templates B2C (Sprint 17)
        assure/                # 8 templates assure (Sprint 18)
        tow/                   # 6 templates tow
        expert/                # 4 templates expert
      email/                   # 30+ templates HTML (data sensible OK)
    index.ts
  vitest.config.ts
```

**Pattern types/whatsapp.types.ts** :
```typescript
export const WhatsAppTemplateCategoryEnum = {
  REPAIR: 'repair',
  INSURE: 'insure',
  CUSTOMER: 'customer',
  ASSURE: 'assure',
  TOW: 'tow',
  EXPERT: 'expert',
} as const;

export type WhatsAppTemplateCategory = typeof WhatsAppTemplateCategoryEnum[keyof typeof WhatsAppTemplateCategoryEnum];

export const WhatsAppLanguageEnum = {
  FR: 'fr',
  AR: 'ar',
  AR_MA: 'ar-MA', // darija
  EN: 'en',
} as const;

export type WhatsAppLanguage = typeof WhatsAppLanguageEnum[keyof typeof WhatsAppLanguageEnum];

export interface WhatsAppStatusMessage {
  to: string;                    // E.164 format +212XXXXXXXXX
  templateName: string;          // MUST be in STATUS_ONLY_TEMPLATES
  data: Record<string, string>;  // safe data only (NEVER amount/cin/token)
  language: WhatsAppLanguage;
  tenantId: string;
  userId: string;
  correlationId?: string;        // for tracking
}
```

**Pattern constants/status-only-templates.ts** :
```typescript
export const STATUS_ONLY_TEMPLATES = {
  // Garage repair statuses (9)
  repair: [
    'repair_vehicle_received',
    'repair_diagnostic_complete',
    'repair_devis_sent_expert',
    'repair_in_progress',
    'repair_qc_done',
    'repair_ready_for_delivery',
    'repair_completed',
    'repair_delayed',
    'repair_quality_check_failed',
  ],
  
  // Insurance carrier statuses (6)
  insure: [
    'insure_fnol_acknowledged',
    'insure_review_started',
    'insure_review_completed',
    'insure_devis_approved',
    'insure_payment_authorized',
    'insure_case_closed',
  ],
  
  // Customer (B2C) statuses (12) -- Sprint 17 reference
  customer: [
    'customer_otp_login',
    'customer_policy_subscribed',
    'customer_premium_due_j15',
    'customer_premium_due_j7',
    'customer_premium_due_j3',
    'customer_premium_overdue',
    'customer_fnol_received',
    'customer_fnol_carrier_reviewed',
    'customer_sinistre_progress_update',
    'customer_repair_ready_delivery',
    'customer_payment_received',
    'customer_feedback_request',
  ],
  
  // Assure (Sprint 18) statuses (8)
  assure: [
    'assure_fnol_received',
    'assure_tow_dispatched',
    'assure_tow_arriving_soon',
    'assure_repair_in_progress',
    'assure_repair_ready_delivery',
    'assure_milestone_update',
    'assure_emergency_acknowledged',
    'assure_policy_renewal_due',
  ],
  
  // Tow operator statuses (6)
  tow: [
    'tow_mission_assigned',
    'tow_pickup_confirmed',
    'tow_vehicle_loaded',
    'tow_in_transit',
    'tow_delivery_complete',
    'tow_payment_received',
  ],
  
  // Expert statuses (4)
  expert: [
    'expert_mission_assigned',
    'expert_inspection_complete',
    'expert_report_validated',
    'expert_payment_received',
  ],
} as const;

// Helper: aplatir + verifier total = 45
export const ALL_STATUS_TEMPLATES = Object.values(STATUS_ONLY_TEMPLATES).flat();
// ALL_STATUS_TEMPLATES.length === 45 verified compile-time
```

**Pattern constants/blacklisted-fields.ts** (CRITIQUE LEGAL) :
```typescript
/**
 * Blacklist server-side: ces patterns ne peuvent JAMAIS apparaitre
 * dans WhatsApp data object (correction Saad #7 CNDP loi 09-08).
 * 
 * Enforcement: detectBlacklistedFields() throw BadRequestException
 * AVANT envoi vers Meta API.
 */
export const BLACKLISTED_FIELD_PATTERNS: ReadonlyArray<string> = [
  // Money/amounts (montants)
  'amount',
  'price',
  'total_mad',
  'total',
  'devis_total',
  'franchise',
  'honoraire',
  'reimbursement',
  
  // Identity (donnees identite)
  'cin',
  'passport',
  'national_id',
  
  // Banking (donnees bancaires)
  'iban',
  'cvv',
  
  // Auth (donnees authentification -- sauf otp explicit dans templates auth)
  'token',
  'password',
] as const;

export function isBlacklistedField(fieldName: string): boolean {
  const normalized = fieldName.toLowerCase().trim();
  return BLACKLISTED_FIELD_PATTERNS.some(pattern => normalized.includes(pattern));
}
```

**Actions principales attendues** :
- Creer structure package complete
- Pattern types pour 4 canaux
- Constants STATUS_ONLY_TEMPLATES.length === 45 verified
- Constants BLACKLISTED_FIELD_PATTERNS.length === 15 minimum
- Zod schemas SendWhatsAppStatus + SendEmail + SendPush + SendOtp
- Index exporting all public symbols
- 4 tests bootstrap (verify exports + counts)

**Fichiers cibles** :
- `repo/packages/comm/package.json`
- `repo/packages/comm/src/types/*.types.ts` (4 files)
- `repo/packages/comm/src/schemas/*.schema.ts` (4 files)
- `repo/packages/comm/src/constants/status-only-templates.ts`
- `repo/packages/comm/src/constants/blacklisted-fields.ts`
- `repo/packages/comm/src/index.ts`

**Criteres P0 cles** :
- V1 (P0) : Package structure complete
- V2 (P0) : STATUS_ONLY_TEMPLATES.length === 45 (verify ALL_STATUS_TEMPLATES.length)
- V3 (P0) : BLACKLISTED_FIELD_PATTERNS.length >= 15
- V4 (P0) : isBlacklistedField helper exporte
- V5 (P0) : Zod schemas validation OK
- V6 (P0) : TypeScript strict + tests bootstrap PASS

**Validation** :
```bash
cd repo/packages/comm
pnpm build
pnpm vitest run
node -e "const c = require('./dist/index.js'); console.log('Templates:', c.ALL_STATUS_TEMPLATES.length, 'Blacklist:', c.BLACKLISTED_FIELD_PATTERNS.length);"
# Attendu: Templates: 45 Blacklist: 15
```

**Commit** :
```bash
git commit -m "feat(sprint-09): package @insurtech/comm + types + schemas + constants

- 4 canaux (WhatsApp + Email + Push + SMS) types/schemas
- STATUS_ONLY_TEMPLATES whitelist 45 templates (6 categories)
- BLACKLISTED_FIELD_PATTERNS 15 patterns server-side
- Helper isBlacklistedField() exporte

Task: 2.7.1
Sprint: 9 (Phase 2 / Sprint 7)
Phase: 2 -- Securite + Infrastructure
Decisions: correction saad #7 + decision-008 cndp"
```

---

### Tache 2.7.2 : CRITIQUE WhatsApp service scope strict (7 etapes enforcement)

**Metadonnees** : P0 CRITIQUE | 8h | Depend de : 2.7.1

**But CRITIQUE LEGAL** : Service WhatsApp avec enforcement strict 7 etapes -- aucune fuite data sensible possible. Correction Saad terrain #7 absolue.

**Pattern critique service complet** :
```typescript
import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Logger } from 'pino';
import * as crypto from 'crypto';
import {
  ALL_STATUS_TEMPLATES,
  BLACKLISTED_FIELD_PATTERNS,
  WhatsAppStatusMessage,
  WhatsAppLanguage,
} from '@insurtech/comm/dist';
import { WhatsAppTemplatesRegistry } from './entities/whatsapp-templates-registry.entity';
import { NotificationAuditService } from './notification-audit.service';
import { RateLimiterService } from './rate-limiter.service';
import { TemplateRendererService } from './template-renderer.service';

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger({ name: 'WhatsAppService' });
  private readonly metaApiUrl: string;
  private readonly metaPhoneNumberId: string;
  private readonly metaAccessToken: string;
  private readonly phoneHashSecret: string;
  private readonly rateLimitPerHour: number;

  constructor(
    @InjectRepository(WhatsAppTemplatesRegistry)
    private readonly templatesRepo: Repository<WhatsAppTemplatesRegistry>,
    private readonly auditService: NotificationAuditService,
    private readonly rateLimiter: RateLimiterService,
    private readonly templateRenderer: TemplateRendererService,
  ) {
    this.metaPhoneNumberId = process.env.WHATSAPP_META_PHONE_NUMBER_ID!;
    this.metaAccessToken = process.env.WHATSAPP_META_ACCESS_TOKEN!;
    this.phoneHashSecret = process.env.PHONE_HASH_SECRET!;
    this.rateLimitPerHour = parseInt(process.env.COMM_RATE_LIMIT_WA_PER_HOUR || '10', 10);
    this.metaApiUrl = `https://graph.facebook.com/v18.0/${this.metaPhoneNumberId}/messages`;
  }

  /**
   * Envoyer un statut WhatsApp avec enforcement 7 etapes.
   * 
   * Etapes :
   * 1. Whitelist check (template MUST be in STATUS_ONLY_TEMPLATES)
   * 2. Blacklist check (data fields MUST NOT contain amount/cin/token/etc)
   * 3. Rate limiting (max 10/heure/user)
   * 4. Language fallback (si template lang manquante, fallback fr)
   * 5. Meta API call (avec template render multilingue)
   * 6. Audit ACAPS (log every call -- 10 ans retention)
   * 7. Phone hash (jamais plain phone dans audits)
   * 
   * @throws BadRequestException si template inconnu (whitelist) ou blacklist violation
   * @throws ForbiddenException si rate limit exceeded
   */
  async sendWhatsAppStatus(input: WhatsAppStatusMessage): Promise<{ messageId: string; status: 'sent' }> {
    const startTime = Date.now();
    const correlationId = input.correlationId || crypto.randomUUID();
    
    // ETAPE 1: Whitelist enforcement
    if (!this.isTemplateWhitelisted(input.templateName)) {
      this.logger.warn({ correlationId, templateName: input.templateName }, 'whatsapp_whitelist_rejection');
      throw new BadRequestException(
        `Template '${input.templateName}' not in whitelist STATUS_ONLY_TEMPLATES (correction Saad #7 CNDP)`,
      );
    }

    // ETAPE 2: Blacklist enforcement (CRITIQUE LEGAL)
    const blacklistViolations = this.detectBlacklistedFields(input.data);
    if (blacklistViolations.length > 0) {
      this.logger.error({
        correlationId,
        templateName: input.templateName,
        violations: blacklistViolations,
      }, 'whatsapp_blacklist_violation');
      throw new BadRequestException(
        `Blacklist violation: WhatsApp NEVER carries sensitive data. Fields rejected: ${blacklistViolations.join(', ')} (correction Saad #7 CNDP loi 09-08)`,
      );
    }

    // ETAPE 3: Rate limiting per-user
    const rateLimitKey = `wa:user:${input.userId}:hourly`;
    const allowed = await this.rateLimiter.checkAndConsume(rateLimitKey, this.rateLimitPerHour, 3600);
    if (!allowed) {
      this.logger.warn({ correlationId, userId: input.userId }, 'whatsapp_rate_limit_exceeded');
      throw new ForbiddenException(
        `Rate limit exceeded: ${this.rateLimitPerHour} WhatsApp messages per hour per user`,
      );
    }

    // ETAPE 4: Language fallback
    let language = input.language;
    const templateMeta = await this.templatesRepo.findOne({
      where: { templateName: input.templateName, language },
    });
    if (!templateMeta) {
      this.logger.info({ correlationId, language }, 'whatsapp_language_fallback_to_fr');
      language = 'fr' as WhatsAppLanguage;
    }

    // ETAPE 5: Meta API call (avec template render)
    const renderedTemplate = await this.templateRenderer.render({
      templateName: input.templateName,
      language,
      data: input.data,
    });

    const metaResponse = await this.callMetaApi({
      to: input.to,
      templateName: input.templateName,
      templateLanguage: language,
      templateParams: renderedTemplate.params,
      correlationId,
    });

    // ETAPE 6: Audit ACAPS log (10 ans retention)
    // ETAPE 7: Phone hash (jamais plain)
    const recipientHash = this.hashPhone(input.to);
    
    await this.auditService.logNotificationSent({
      tenantId: input.tenantId,
      userId: input.userId,
      channel: 'whatsapp',
      templateName: input.templateName,
      language,
      recipientHash,
      messageId: metaResponse.messages[0].id,
      correlationId,
      durationMs: Date.now() - startTime,
      status: 'sent',
    });

    this.logger.info({
      correlationId,
      templateName: input.templateName,
      duration: Date.now() - startTime,
    }, 'whatsapp_sent_success');

    return {
      messageId: metaResponse.messages[0].id,
      status: 'sent',
    };
  }

  /**
   * ETAPE 1 helper: verifier template dans whitelist 45 templates.
   */
  private isTemplateWhitelisted(templateName: string): boolean {
    return (ALL_STATUS_TEMPLATES as readonly string[]).includes(templateName);
  }

  /**
   * ETAPE 2 helper: detecter fields blacklist dans data object.
   * Recursive deep scan (peut etre objet nested).
   */
  private detectBlacklistedFields(data: Record<string, unknown>): string[] {
    const violations: string[] = [];

    const scan = (obj: Record<string, unknown>, path = ''): void => {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        const normalized = key.toLowerCase().trim();

        // Check field name against blacklist
        if (BLACKLISTED_FIELD_PATTERNS.some(pattern => normalized.includes(pattern))) {
          violations.push(fullPath);
        }

        // Recurse into nested objects (eviter circular)
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          scan(value as Record<string, unknown>, fullPath);
        }
      }
    };

    scan(data);
    return violations;
  }

  /**
   * ETAPE 7 helper: SHA256 phone hash (16 chars).
   * Jamais plain phone dans audits/logs.
   */
  private hashPhone(phoneE164: string): string {
    return crypto
      .createHmac('sha256', this.phoneHashSecret)
      .update(phoneE164.replace(/\s+/g, ''))
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Meta WhatsApp Cloud API call.
   * Retry 3 fois avec exponential backoff.
   */
  private async callMetaApi(payload: {
    to: string;
    templateName: string;
    templateLanguage: WhatsAppLanguage;
    templateParams: Array<{ type: string; text: string }>;
    correlationId: string;
  }): Promise<{ messages: Array<{ id: string }> }> {
    const body = {
      messaging_product: 'whatsapp',
      to: payload.to,
      type: 'template',
      template: {
        name: payload.templateName,
        language: { code: payload.templateLanguage },
        components: [
          {
            type: 'body',
            parameters: payload.templateParams,
          },
        ],
      },
    };

    const response = await fetch(this.metaApiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.metaAccessToken}`,
        'Content-Type': 'application/json',
        'X-Correlation-Id': payload.correlationId,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Meta API error ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<{ messages: Array<{ id: string }> }>;
  }
}
```

**Tests CRITIQUES** (whatsapp.service.spec.ts) -- 20+ scenarios obligatoires :
```typescript
describe('WhatsAppService scope strict (correction Saad #7)', () => {
  // Tests whitelist
  it('REJECTS template inconnu non dans STATUS_ONLY_TEMPLATES', async () => {
    await expect(service.sendWhatsAppStatus({
      to: '+212600000000',
      templateName: 'malicious_template_xyz',
      data: {},
      language: 'fr',
      tenantId: 'test',
      userId: 'test',
    })).rejects.toThrow('not in whitelist STATUS_ONLY_TEMPLATES');
  });

  // Tests blacklist CRITIQUES (8+ scenarios)
  it('REJECTS data.amount field (CNDP violation)', async () => {
    await expect(service.sendWhatsAppStatus({
      to: '+212600000000',
      templateName: 'customer_premium_due_j15',
      data: { amount: '5000' }, // BLACKLIST
      language: 'fr',
      tenantId: 'test',
      userId: 'test',
    })).rejects.toThrow('Blacklist violation');
  });

  it('REJECTS data.cin field', async () => {
    await expect(service.sendWhatsAppStatus({
      to: '+212600000000',
      templateName: 'customer_otp_login',
      data: { cin: 'AB123456' }, // BLACKLIST
      language: 'fr',
      tenantId: 'test',
      userId: 'test',
    })).rejects.toThrow('Blacklist violation');
  });

  it('REJECTS data.total_mad field', async () => {/* ... */});
  it('REJECTS data.devis_total field', async () => {/* ... */});
  it('REJECTS data.iban field', async () => {/* ... */});
  it('REJECTS data.password field', async () => {/* ... */});
  it('REJECTS data.token field', async () => {/* ... */});
  it('REJECTS nested data.payment.amount field (deep scan)', async () => {/* ... */});

  // Tests rate limiting
  it('REJECTS after 10 messages per hour per user', async () => {/* ... */});

  // Tests language fallback
  it('FALLS BACK to fr if requested language template missing', async () => {/* ... */});

  // Tests phone hash
  it('NEVER logs plain phone in audit (hashed only)', async () => {/* ... */});

  // Tests success path
  it('SENDS valid status template with safe data successfully', async () => {/* ... */});
  // ... 7+ autres scenarios success
});
```

**Actions principales attendues** :
- Service `whatsapp.service.ts` complet ~250 lignes
- 7 etapes enforcement implementees
- 20+ tests scenarios (CRITIQUE blacklist 8+)
- BadRequestException si whitelist OR blacklist violation
- ForbiddenException si rate limit
- Audit ACAPS chaque envoi (channel + template + recipient_hash + tenant_id)

**Fichiers cibles** :
- `repo/packages/comm/src/services/whatsapp.service.ts`
- `repo/packages/comm/src/services/whatsapp.service.spec.ts` (20+ tests)
- `repo/packages/comm/src/services/rate-limiter.service.ts` (Redis-based)
- `repo/packages/comm/src/services/template-renderer.service.ts`

**Criteres P0 cles** :
- V1 (P0 CRITIQUE) : Whitelist enforcement actif (reject template inconnu)
- V2 (P0 CRITIQUE LEGAL) : Blacklist enforcement actif (8+ scenarios PASS)
- V3 (P0) : Rate limiting 10/heure fonctionnel
- V4 (P0) : Audit ACAPS log obligatoire chaque envoi
- V5 (P0) : Phone hash SHA256 16 chars (no plain phone)
- V6 (P0) : Multilingue 4 langues + fallback fr
- V7 (P0) : Tests 20+ PASS dont 8+ blacklist

**Commit** :
```bash
git commit -m "feat(sprint-09): CRITIQUE whatsapp service scope strict 7 etapes enforcement

- Whitelist 45 templates STATUS_ONLY_TEMPLATES
- Blacklist 15 patterns server-side (amount/cin/total_mad/iban/...)
- Rate limiting 10/heure/user
- Multilingue 4 langues + fallback fr
- Audit ACAPS log every call (10 ans retention)
- Phone hash SHA256 16 chars (no plain)
- 20+ tests dont 8+ blacklist CRITIQUES

Task: 2.7.2
Sprint: 9 (Phase 2 / Sprint 7)
Decisions: correction saad terrain #7 cndp loi 09-08"
```

---

### Tache 2.7.3 : Templates WhatsApp 45 + sync Meta Business Manager

**Metadonnees** : P0 | 6h | Depend de : 2.7.2

**But** : Creation 45 templates Handlebars whitelist + sync Meta Business Manager + 4 langues = 180 variantes total.

**Pattern fichier template** `templates/whatsapp/customer/customer_fnol_received.fr.hbs` :
```handlebars
Bonjour {{customer_first_name}},

Votre declaration de sinistre a bien ete recue le {{declaration_date}}.

Numero de dossier: {{sinistre_id_short}}
Type: {{sinistre_type_label}}

Notre equipe va l'examiner dans les 48h. Vous recevrez un email avec les details complets.

Cordialement,
{{broker_company_name}}
```

**Note importante** : aucune variable money/cin/token (verifie par script CI).

**Pattern darija** `templates/whatsapp/customer/customer_fnol_received.ar-MA.hbs` :
```handlebars
Salam {{customer_first_name}},

Tselmna declaration dyalk dyal sinistre f {{declaration_date}}.

Numero dyal dossier: {{sinistre_id_short}}
Type: {{sinistre_type_label}}

L'equipe ghadi tchoufha f 48 sa3a. Ghadi tdjik email b les details.

Salam,
{{broker_company_name}}
```

**Service template-manager** :
```typescript
async syncWithMetaBusinessManager(): Promise<{ created: number; skipped: number }> {
  const templates = await this.loadAllHandlebarsTemplates();
  let created = 0, skipped = 0;

  for (const template of templates) {
    // Check si deja sync (registry)
    const existing = await this.registryRepo.findOne({
      where: { templateName: template.name, language: template.language },
    });
    if (existing?.metaTemplateId) {
      skipped++;
      continue;
    }

    // Upload to Meta Business Manager API
    const metaResponse = await this.uploadToMeta({
      name: template.name,
      language: template.language,
      category: 'UTILITY', // Meta categorisation
      components: this.handlebarsToMetaComponents(template.content),
    });

    // Save to registry
    await this.registryRepo.save({
      templateName: template.name,
      language: template.language,
      metaTemplateId: metaResponse.id,
      status: 'PENDING_APPROVAL', // Meta peut refuser
      syncedAt: new Date(),
    });
    created++;
  }

  return { created, skipped };
}
```

**Migration** `1735000000NNN-CreateWhatsappTemplatesRegistry.ts` :
```sql
CREATE TABLE whatsapp_templates_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL,
  language VARCHAR(10) NOT NULL,
  meta_template_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  synced_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  category VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_name, language)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_templates_registry
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
```

**Script CI verifie** : aucune variable dangereuse dans templates
```bash
#!/bin/bash
# CI check: no money/cin variables in WhatsApp templates
VIOLATIONS=$(grep -rE "\{\{\s*(amount|price|total_mad|cin|token|password|iban|cvv|devis_total|franchise|honoraire)" \
  repo/packages/comm/src/templates/whatsapp/ | wc -l)
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "CRITICAL: $VIOLATIONS dangerous variables found in WhatsApp templates"
  echo "Correction Saad #7 violation - aborting"
  exit 1
fi
```

**Criteres P0** :
- V1 (P0) : 45 templates Handlebars crees (6 categories)
- V2 (P0) : 4 langues par template = 180 variantes
- V3 (P0) : Sync Meta Business Manager OK
- V4 (P0 CRITIQUE) : 0 variable money/cin/token (script CI verifie)

**Commit** :
```bash
git commit -m "feat(sprint-09): templates whatsapp whitelist 45 + meta business manager sync

- 6 categories x 4 langues = 180 variantes Handlebars
- Sync Meta Business Manager + registry tracking
- Migration whatsapp_templates_registry
- Script CI verifie 0 variable dangereuse

Task: 2.7.3"
```

---

### Tache 2.7.4 : Email service data sensible (DKIM/SPF/DMARC)

**Metadonnees** : P0 | 5h | Depend de : 2.7.3

**But** : Service Email avec **data sensible OK** + DKIM/SPF/DMARC + multilingue + attachments PDF.

**Pattern email.service.ts** :
```typescript
@Injectable()
export class EmailService {
  private readonly sgClient: SendGridClient;
  private readonly fallbackClient: MailjetClient;

  async sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
    // Email CAN carry sensitive data (montants OK)
    // DKIM/SPF/DMARC ensure authenticity

    const template = await this.renderTemplate({
      templateName: input.templateName,
      language: input.language,
      data: input.data, // sensible data OK ici
    });

    try {
      const result = await this.sgClient.send({
        from: { email: `noreply@${process.env.EMAIL_DOMAIN_PRIMARY}`, name: input.fromName },
        to: input.to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        attachments: input.attachments?.map(a => ({
          content: a.contentBase64,
          filename: a.filename,
          type: a.mimeType,
          disposition: 'attachment',
        })),
        trackingSettings: {
          clickTracking: { enable: true },
          openTracking: { enable: true },
        },
      });

      await this.auditService.logNotificationSent({
        channel: 'email',
        templateName: input.templateName,
        recipientHash: this.hashEmail(input.to),
        messageId: result.headers['x-message-id'],
        // ...
      });

      return { messageId: result.headers['x-message-id'] };
    } catch (sgError) {
      // Fallback Mailjet
      this.logger.warn({ sgError }, 'sendgrid_failed_fallback_mailjet');
      return this.fallbackClient.send(/* ... */);
    }
  }
}
```

**Configuration DNS production** :
```
# DKIM (assurflow._domainkey.assurflow.ma)
v=DKIM1; k=rsa; p=MIGfMA0GCSq...

# SPF (assurflow.ma)
v=spf1 include:sendgrid.net include:mailjet.com -all

# DMARC (_dmarc.assurflow.ma)
v=DMARC1; p=reject; rua=mailto:dmarc@assurflow.ma; pct=100
```

**Templates email** : data sensible OK
```html
<!-- templates/email/customer_premium_invoice.fr.html -->
<p>Bonjour {{customer_first_name}},</p>
<p>Votre facture prime : <strong>{{amount_formatted}} MAD</strong></p>
<p>Echeance : {{due_date}}</p>
<p>IBAN paiement : {{broker_iban}}</p> <!-- OK ici car Email -->
<p>Reference : {{invoice_number}}</p>
```

**Criteres P0** :
- V1 (P0) : DKIM/SPF/DMARC configures DNS prod
- V2 (P0) : Email delivery production verified (rate > 95%)
- V3 (P0) : Fallback Mailjet si SendGrid down
- V4 (P0) : Templates 4 langues fonctionnels
- V5 (P0) : Attachments PDF support

**Commit** :
```bash
git commit -m "feat(sprint-09): email service data sensible + dkim/spf/dmarc + fallback

Task: 2.7.4"
```

---

### Tache 2.7.5 : Push notifications mobile (Expo + FCM + APNs)

**Metadonnees** : P0 | 5h | Depend de : 2.7.4

**But** : Service Push via Expo SDK + FCM Android + APNs iOS pour milestones courts.

**Pattern push.service.ts** :
```typescript
@Injectable()
export class PushService {
  private readonly expo: Expo;

  async sendPush(input: SendPushInput): Promise<{ ticketId: string }> {
    // Validate template: courts (title <= 50, body <= 100)
    if (input.title.length > 50) throw new BadRequestException('title > 50 chars');
    if (input.body.length > 100) throw new BadRequestException('body > 100 chars');

    // Pas de data sensible (visible lockscreen)
    if (this.containsSensitiveData(input.body)) {
      throw new BadRequestException('Push body contains sensitive data (visible lockscreen)');
    }

    const messages = [{
      to: input.expoPushToken,
      sound: 'default',
      title: input.title,
      body: input.body,
      data: { deepLink: input.deepLink, sinistreId: input.sinistreId },
      priority: input.priority || 'normal',
    }];

    const tickets = await this.expo.sendPushNotificationsAsync(messages);
    
    await this.auditService.logNotificationSent({
      channel: 'push',
      templateName: input.templateName,
      // ...
    });

    return { ticketId: tickets[0].id || 'no-ticket' };
  }

  private containsSensitiveData(text: string): boolean {
    return /\d{4,}|MAD|amount|montant|CIN/i.test(text);
  }
}
```

**Criteres P0** :
- V1 (P0) : Expo + FCM + APNs integrations OK
- V2 (P0) : Templates courts validation (title 50 / body 100)
- V3 (P0) : Pas de data sensible (regex check)
- V4 (P0) : Tests 10+ scenarios

**Commit** :
```bash
git commit -m "feat(sprint-09): push notifications fcm + apns via expo

Task: 2.7.5"
```

---

### Tache 2.7.6 : SMS OTP only service

**Metadonnees** : P0 | 4h | Depend de : 2.7.5

**But** : SMS **reserve OTP only** (2FA authentication). Pas de notifications generales.

**Pattern sms.service.ts** :
```typescript
@Injectable()
export class SmsService {
  private readonly twilioClient: TwilioClient;

  /**
   * Send OTP via SMS. ONLY method exposed.
   * Pas de sendSms() general -- reserve a auth uniquement.
   */
  async sendOtp(input: { phone: string; otp: string; ttlMinutes: number }): Promise<{ sid: string }> {
    if (!/^\d{6}$/.test(input.otp)) {
      throw new BadRequestException('OTP must be 6 digits');
    }
    if (input.ttlMinutes !== 5) {
      throw new BadRequestException('TTL must be 5 minutes');
    }

    const body = `Skalean Assurflow: votre code de verification est ${input.otp}. Valide ${input.ttlMinutes} min.`;

    const result = await this.twilioClient.messages.create({
      from: process.env.TWILIO_PHONE_FROM,
      to: input.phone,
      body,
    });

    await this.auditService.logNotificationSent({
      channel: 'sms',
      templateName: 'otp_login',
      recipientHash: this.hashPhone(input.phone),
      messageId: result.sid,
      // ...
    });

    return { sid: result.sid };
  }

  // NO sendSms() public method. SMS reserve OTP only.
}
```

**Fallback Orange Maroc** si Twilio international rates trop chers : API Orange Maroc B2B SMS.

**Criteres P0** :
- V1 (P0 CRITIQUE) : SMS reserve OTP only (NO sendSms general method)
- V2 (P0) : OTP 6 digits + TTL 5 min validation
- V3 (P0) : Audit ACAPS log
- V4 (P0) : Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-09): sms otp only service (twilio + orange maroc fallback)

Task: 2.7.6"
```

---

### Tache 2.7.7 : Notification Router multi-canal

**Metadonnees** : P0 | 5h | Depend de : 2.7.6

**But** : Router central decide canal(x) selon content_type + user prefs.

**Pattern notification-router.service.ts** :
```typescript
export const ContentTypeEnum = {
  STATUS_ONLY: 'status_only',     // WhatsApp + Push OK
  DATA_SENSIBLE: 'data_sensible', // Email ONLY (never WhatsApp)
  URGENT: 'urgent',                // Push + SMS + Email (multi)
} as const;

@Injectable()
export class NotificationRouterService {
  /**
   * Route notification au(x) canal(x) approprie(s).
   * 
   * Logic:
   * - status_only -> WhatsApp + Push (si user prefs OK)
   * - data_sensible -> Email ONLY (jamais WhatsApp ni Push lockscreen)
   * - urgent -> Push + SMS + Email (multi-canal)
   */
  async routeNotification(input: RouteNotificationInput): Promise<{ channels: string[] }> {
    const channels: string[] = [];
    const userPrefs = await this.userPrefsService.getPreferences(input.userId);

    switch (input.contentType) {
      case 'status_only':
        // CRITIQUE: jamais data sensible via WhatsApp
        if (userPrefs.whatsappEnabled) {
          await this.whatsappService.sendWhatsAppStatus({
            to: input.recipient.phone,
            templateName: input.templateName,
            data: input.safeData, // safe only
            language: userPrefs.language,
            tenantId: input.tenantId,
            userId: input.userId,
          });
          channels.push('whatsapp');
        }
        if (userPrefs.pushEnabled && input.expoPushToken) {
          await this.pushService.sendPush(/* ... */);
          channels.push('push');
        }
        break;

      case 'data_sensible':
        // EMAIL ONLY -- jamais WhatsApp meme si user prefs
        await this.emailService.sendEmail({
          to: input.recipient.email,
          templateName: input.templateName,
          data: input.sensibleData, // OK ici
          language: userPrefs.language,
          // ...
        });
        channels.push('email');
        // Optionnellement: push notification "Email envoye" sans details
        if (userPrefs.pushEnabled) {
          await this.pushService.sendPush({
            title: 'Nouveau document',
            body: 'Consultez votre email pour les details',
            // no sensible data
          });
          channels.push('push_notification_only');
        }
        break;

      case 'urgent':
        // MULTI-CANAL: push + sms + email
        await Promise.all([
          this.pushService.sendPush(/* ... */),
          this.smsService.sendOtp(/* ... */), // si auth-related
          this.emailService.sendEmail(/* ... */),
        ]);
        channels.push('push', 'sms', 'email');
        break;
    }

    return { channels };
  }
}
```

**Criteres P0** :
- V1 (P0 CRITIQUE) : data_sensible NE PASSE JAMAIS par WhatsApp
- V2 (P0) : status_only -> WhatsApp + Push selon prefs
- V3 (P0) : urgent -> multi-canal
- V4 (P0) : Tests 12+ scenarios

**Commit** :
```bash
git commit -m "feat(sprint-09): notification router multi-canal content_type logic

Task: 2.7.7"
```

---

### Tache 2.7.8 : Audit ACAPS notifications + traceability

**Metadonnees** : P0 | 4h | Depend de : 2.7.7

**But** : Audit ACAPS chaque notification (channel + template + recipient_hash + tenant_id + timestamp) -- 10 ans retention.

**Migration extension `compliance_acaps_audits`** :
```sql
ALTER TABLE compliance_acaps_audits
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20),
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recipient_hash VARCHAR(32),
  ADD COLUMN IF NOT EXISTS message_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_acaps_audits_channel ON compliance_acaps_audits(channel);
CREATE INDEX IF NOT EXISTS idx_acaps_audits_template ON compliance_acaps_audits(template_name);
CREATE INDEX IF NOT EXISTS idx_acaps_audits_recipient_hash ON compliance_acaps_audits(recipient_hash);
```

**Service notification-audit** :
```typescript
@Injectable()
export class NotificationAuditService {
  async logNotificationSent(input: LogNotificationInput): Promise<void> {
    await this.auditRepo.save({
      tenantId: input.tenantId,
      userId: input.userId,
      eventType: 'notification_sent',
      channel: input.channel,
      templateName: input.templateName,
      recipientHash: input.recipientHash,
      messageId: input.messageId,
      correlationId: input.correlationId,
      durationMs: input.durationMs,
      status: input.status,
      retentionUntil: addYears(new Date(), 10), // ACAPS 10 ans
    });
  }
}
```

**Endpoint admin** :
```
GET /api/v1/comm/notifications/history?channel=whatsapp&from=2026-01-01
Permission: customer.notifications.manage
Response: list audits hashed
```

**Criteres P0** :
- V1 (P0) : Migration extension colonnes
- V2 (P0) : Service logNotificationSent appele par 4 services
- V3 (P0) : Endpoint history avec permission
- V4 (P0) : Retention 10 ans (cron archivage)

**Commit** :
```bash
git commit -m "feat(sprint-09): audit acaps notifications + traceability 10 ans retention

Task: 2.7.8
Decisions: loi acaps + decision-008"
```

---

### Tache 2.7.9 : Endpoints REST + permissions

**Metadonnees** : P0 | 3h | Depend de : 2.7.8

**But** : Endpoints REST + permissions Sprint 7.5a enforced.

**Endpoints** :
```typescript
@Controller('api/v1/comm')
export class CommController {
  @Post('notifications/send')
  @RequirePermissions('customer.notifications.manage')
  async sendNotification(@Body() input: SendNotificationDto) {
    return this.notificationRouter.routeNotification(input);
  }

  @Get('notifications/history')
  @RequirePermissions('customer.notifications.manage')
  async getHistory(@Query() filters: HistoryFiltersDto) {
    return this.auditService.searchNotifications(filters);
  }

  @Get('templates/list')
  @RequirePermissions('customer.notifications.manage')
  async listTemplates() {
    return { templates: ALL_STATUS_TEMPLATES };
  }
}
```

**Criteres P0** :
- V1 (P0) : 3 endpoints minimum
- V2 (P0) : Permission `customer.notifications.manage` enforce
- V3 (P0) : Tests 6+ scenarios

**Commit** :
```bash
git commit -m "feat(sprint-09): endpoints rest + permissions customer.notifications.manage

Task: 2.7.9"
```

---

### Tache 2.7.10 : Tests E2E 30+ + benchmarks + verification BLACKLIST

**Metadonnees** : P0 | 5h | Depend de : 2.7.9

**But** : Tests E2E exhaustifs + benchmarks + verification stricte BLACKLIST end-to-end.

**Tests E2E categories** :
1. Happy path : WhatsApp + Email + Push + SMS OTP (8+ scenarios)
2. **CRITIQUE blacklist** : amount + cin + total_mad + iban + token + password + nested + devis_total (8+ scenarios)
3. Whitelist : template inconnu rejet (3+ scenarios)
4. Multilingue : 4 langues + fallback fr (4+ scenarios)
5. Rate limiting : 11eme message rejet (2+ scenarios)
6. Audit ACAPS : log every channel (5+ scenarios)

**Benchmarks** (`benchmarks/whatsapp-latency.json`) :
```json
{
  "p50_ms": 800,
  "p95_ms": 1900,
  "p99_ms": 2400,
  "samples": 1000
}
```
Target : P95 < 2000ms

**Coverage cible Sprint 9** : **>= 90%** (vs 85% standard) car CRITIQUE correction Saad

**Tests pre-prod CNDP** :
```bash
# Manual penetration test pre-prod
curl -X POST localhost:3000/api/v1/comm/notifications/send \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"contentType":"status_only","templateName":"customer_otp_login","data":{"amount":"5000"}}'
# Expected: 400 BadRequestException "Blacklist violation"
```

**Criteres P0** :
- V1 (P0) : Tests blacklist 8+ scenarios PASS
- V2 (P0) : Coverage >= 90%
- V3 (P0) : Benchmark P95 < 2s
- V4 (P0) : Documentation policy 150+ lignes

**Commit** :
```bash
git commit -m "test(sprint-09): tests e2e 30+ + verification blacklist + benchmarks

- 30+ scenarios E2E (8+ blacklist CRITIQUES)
- Coverage >= 90% (vs 85% standard)
- Benchmark WhatsApp P95 < 2s
- Documentation policy correction saad #7

Task: 2.7.10
Sprint: 9 (Phase 2 / Sprint 7)
Decisions: correction saad #7 verification stricte"
```

---

## Risques + Mitigations

| Risque | Impact | Probabilite | Mitigation |
|--------|--------|-------------|------------|
| Meta Business Manager refuse templates | Bloque sprint | Moyenne | Soumission early + UTILITY category + iterations |
| WhatsApp blacklist false positive | Bloque envoi legitime | Faible | Tests exhaustifs + review whitelist 15 patterns |
| DKIM/SPF/DMARC config DNS | Email spam folder | Moyenne | Test deliverability MailTester score > 9/10 |
| Rate limit Twilio international | Couts SMS exploses | Faible | Fallback Orange Maroc API native |
| Audit ACAPS volume DB | Performance degraded | Moyenne | Partitioning par tenant_id + cron archivage 1 an warm + 9 ans cold |
| Conformite CNDP audit externe | Risque legal | Faible | Documentation policy + tests reproductibles |

---

## Conformite Maroc

- **CNDP loi 09-08** : protection donnees personnelles (article 12-14 traitement loyaux + finalite definie) -- correction Saad #7 conformite absolue
- **Loi ACAPS** : retention 10 ans toute communication assurance -- audit logs
- **Loi 43-20 signature electronique** : pas directement Sprint 9 mais Sprint 10
- **Meta WhatsApp Business Policy** : compliance templates UTILITY + AUTHENTICATION
- **Orange Maroc API B2B SMS** : conformite ANRT (Agence Nationale Reglementation Telecoms)

---

## Metriques de Validation

| Metrique | Cible | Mesure |
|----------|-------|--------|
| Whitelist enforcement | 100% rejet template inconnu | Tests V1 + CNDP-3 |
| Blacklist enforcement | 0 fuite data sensible | Tests V2 + CNDP-1 + CNDP-2 |
| Coverage Sprint 9 | >= 90% | vitest coverage |
| WhatsApp P95 latency | < 2000ms | benchmark |
| Email delivery rate | > 95% | SendGrid analytics |
| 0 emoji | 0 | grep CI |
| Conventional commits | 100% | git log analyzer |
| Documentation policy | >= 150 lignes | wc -l |

---

## Apport au Programme

Sprint 9 v3.0 est **fondation conformite CNDP** pour Sprints downstream :
- Sprint 14 Insure : notifications carrier via Email data sensible
- Sprint 17 Customer Portal : 12 templates customer whitelist
- Sprint 18 Assure Mobile : 8 templates assure whitelist
- Sprint 21 Sinistre Workflow : status updates WhatsApp via Sprint 9
- Sprint 22.5 Tow App : 6 templates tow whitelist
- Sprint 22.7 Expert App : 4 templates expert whitelist
- Sprint 24 Flux 5 acteurs : orchestration multi-canal via NotificationRouter
- Sprint 26.5 Carrier Portal : notifications carrier via Email + audit

**Sans GO Sprint 9 v3.0, tous downstream restent v2.2 non-conforme CNDP** -- risque legal absolu Demo Day 30 juin.

---

**Fin meta-prompt B-09 v3.0 -- Sprint 9 (2.7) Comm WhatsApp Scope Strict + Email Data Sensible.**

**Total taches** : 10 | **Effort** : ~45h | **Apport** : Conformite CNDP correction Saad #7 absolue + multi-canal robuste
