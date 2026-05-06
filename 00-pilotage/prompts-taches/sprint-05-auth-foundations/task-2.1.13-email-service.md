# TACHE 2.1.13 -- EmailService : Nodemailer + Handlebars + 10 Templates x 4 Locales (fr-MA, ar-MA, en, fr-FR)

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.13)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.14 RateLimit auth-specifique, 2.1.15 E2E tests, et tous les emails operationnels Sprint 6+)
**Effort** : 6h
**Dependances** : 2.1.12 (AuditAuthService publish events), 2.1.9 (signup consume sendVerification), 2.1.11 (recovery consume sendPasswordReset + sendPasswordChangedNotification), 2.1.10 (lockout consume sendAccountLockedNotification), 2.1.8 (MFA consume sendMfaEnabled)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `EmailService` complet et operationnel du programme Skalean InsurTech v2.2 qui implemente l'integralite de la couche d'envoi d'emails transactionnels conforme aux exigences UX multi-locale Maroc (fr-MA pour les francophones marocains, ar-MA pour les arabophones darija, fr-FR pour la diaspora francophone, en pour les anglophones), conforme aux exigences anti-spam DKIM + SPF + DMARC qui seront configures Sprint 35 au niveau DNS Atlas Cloud Services Benguerir, et conforme aux exigences accessibilite (multipart HTML + plain text fallback, RTL pour ar-MA, alt text images, contraste WCAG AA). Le perimetre couvre : un service NestJS `@Injectable() EmailService` qui expose 10 methods principales (send generique, sendVerification pour signup Tache 2.1.9, sendPasswordReset pour recovery Tache 2.1.11, sendPasswordChangedNotification post-reset, sendAccountLockedNotification pour lockout Tier 2+ Tache 2.1.10, sendAccountUnlockedNotification pour admin unlock Sprint 27, sendMfaEnabledNotification post-MFA setup Tache 2.1.8, sendMfaDisabledNotification post-MFA disable, sendSecurityAlert pour suspicious_login events Sprint 18, sendRecoveryCompletedNotification pour confirmation recovery) ; un transport Nodemailer 6.9.16 configure avec pool de connexions SMTP (5 connections concurrent, 100 messages par connection avant rotation) supportant Mailhog en dev, SendGrid Transactional API en prod Sprint 35 (envoi via API HTTPS au lieu de SMTP pour scaling) ; un moteur de rendu Handlebars 4.7.8 avec templates pre-compiles a la demande puis caches dans une Map en memoire pour eviter le re-parsing a chaque envoi (perf optimization), un layout shared `_layout.hbs` qui contient le header Skalean InsurTech (logo SVG inline, gradient bleu primaire #1d4ed8 vers #3730a3) et le footer (mentions legales SARL RC Casablanca XXXX, liens Politique de confidentialite + CGU + Support, opt-out unsubscribe pour les emails marketing Sprint 14), une structure de dossier `repo/packages/comm/src/templates/{locale}/{template}.hbs` ou les 10 templates sont dupliques dans 4 locales (40 templates au total), et des helpers Handlebars custom (`formatDate` avec timezone Africa/Casablanca via Intl.DateTimeFormat, `isRtl` pour conditional CSS direction, `shortenUserAgent` pour readable display).

L'apport est multiple. Premierement, en supportant nativement 4 locales (fr-MA, ar-MA, en, fr-FR) au lieu d'une seule langue, on respecte l'exigence UX du marche marocain ou les utilisateurs s'attendent a recevoir des communications dans leur langue preferee : un courtier de Casablanca prefere fr-MA avec expressions familieres (vs fr-FR plus formel), un assure des regions de l'Atlas prefere ar-MA en darija (vs ar classique trop formel), un courtier de la diaspora a Paris prefere fr-FR, un partenaire international anglophone prefere en. Cette diversite linguistique est un differenciateur competitif vis-a-vis des concurrents AssurMaroc et ClickAssure qui ne proposent que fr ou en. Deuxiemement, en utilisant Nodemailer + Handlebars (vs un service SaaS exclusif comme Mandrill ou Mailgun), on garde le controle complet sur les templates HTML, on evite le vendor lock-in, on peut basculer le transport (Mailhog dev / Sendgrid Sprint 35 / Maroc Telecom Mail Sprint 35+) sans toucher aux templates. Le pattern templates compiles caches en memoire produit ~200 ms gain par envoi (vs re-compile chaque fois). Troisiemement, en respectant strictement le multipart MIME (HTML + plain text fallback genere via `htmlToText`), on garantit la deliverability cross-clients : Outlook 2016 ancien rendu HTML differemment que Gmail web, mais le plain text reste accessible. Le pattern multipart augmente le score deliverability +15% selon les guides SendGrid 2024. Quatriemement, en supportant RTL natif pour ar-MA via le helper `isRtl` qui injecte `dir="rtl"` dans le DOM HTML et le CSS `text-align: right`, on assure une experience UX correcte pour les utilisateurs arabophones (sans cela, le texte arabe s'affiche techniquement mais est moins lisible dans la mauvaise direction).

A l'issue de cette tache, l'API `EmailService.send({ to, locale, template, variables })` envoie un email transactionnel en moins de 500 ms p99 (latency dominee par SMTP handshake), `EmailService.sendVerification({ to, locale, token, display_name })` envoie l'email de verification de Tache 2.1.9 avec lien `https://app.skalean.ma/auth/email-verified?token=xxx` valide 24h, `EmailService.sendPasswordReset` envoie celui de Tache 2.1.11 avec TTL 1h, les 10 templates sont presents dans 4 locales (40 fichiers `.hbs`), un test integration via Mailhog API REST (`GET http://localhost:8025/api/v2/messages?kind=containing&query=<message_id>`) verifie que les emails sont effectivement delivres, le rendu HTML est valide W3C HTML 5, le rendu plain text est genere automatiquement via stripping HTML, les emails RTL pour ar-MA s'affichent correctement, les variables Handlebars sont interpolees (display_name, verify_url, etc.), aucun token ou data sensible n'est loggue (logs uniquement message_id + to + template + locale), et la suite Vitest couvre 30+ tests avec coverage >= 88% sur le module EmailService.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 declenche des emails transactionnels lors de nombreuses operations : verification email signup (Tache 2.1.9), reset password (Tache 2.1.11), notification password changed (Tache 2.1.11), notification account locked (Tache 2.1.10), notification MFA setup confirmed (Tache 2.1.8), alertes securite sur suspicious_login (Sprint 18), notification appointments booking (Sprint 17 Comm vertical), notification factures (Sprint 18 Books), notification sinistre status update (Sprint 22 Repair), etc. Sans un service EmailService centralise et reutilisable, chaque consommateur metier devrait integrer Nodemailer + Handlebars individuellement, dupliquant le code et risquant l'incoherence des emails (templates differents, branding incoherent, locale ignoree).

L'exigence multi-locale est specifique au marche marocain. Selon les enquetes consommateurs Sprint 1 (~3000 courtiers et ~80000 assures interroges) :
- 65% preferent fr-MA pour les communications professionnelles.
- 25% preferent ar-MA (darija) pour leur lisibilite naturelle.
- 8% preferent fr-FR (diaspora ou education a la francaise classique).
- 2% preferent en (international, partenariats etrangers).

Sans support RTL pour ar-MA, l'experience utilisateur arabophone est degradee, ce qui se traduit par baisse engagement (~30% taux de clic moins dans tests A/B Sprint 1).

L'exigence anti-spam DKIM/SPF/DMARC est imposee par les providers majeurs (Gmail, Outlook, Yahoo). Sans ces enregistrements DNS, les emails arrivent en spam folder dans 60-80% des cas. Sprint 35 configurera DNS Atlas Cloud Services Benguerir avec ces enregistrements. Cette tache prepare le terrain en utilisant un transport SMTP standard supportant ces signatures.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Mandrill / Mailchimp Transactional | UI dashboard, deliverability garantie | Vendor lock-in, cost ~0.001 EUR / email = 100 EUR / 100k emails | REJETE -- preferer self-hosted Sprint 5 |
| AWS SES | Cost tres bas, scalable | Sortie data US (decision-008 viole pour donnees personnelles MA) | REJETE -- non conforme cloud souverain |
| SendGrid Transactional | Excellent deliverability, support DKIM | Sortie data US/EU | DEFFERE Sprint 35 -- evaluation conformite |
| Maroc Telecom Mail Pro | Cloud souverain MA | Pas d'API moderne, support limite | DEFFERE Sprint 35+ |
| Atlas Cloud Email Service | Souverain MA (preference future) | Pas dispo Sprint 5 | DEFFERE Sprint 35 |
| Nodemailer + SMTP self-hosted (RETENU Sprint 5) | Controle complet, flexible, supporte tous transports | Necessite serveur SMTP outbound (Sprint 35 deploiera) | RETENU Sprint 5 dev/staging |
| Nodemailer + SendGrid API (RETENU Sprint 35) | API HTTPS scalable | Cost ~0.0008 EUR / email | RETENU Sprint 35 prod |
| Templates inline dans code | Simple | Pas de localisation, refactor difficile, mix code+presentation | REJETE |
| Handlebars (RETENU) | Ecosysteme mature, helpers, layouts | Apprentissage syntaxe | RETENU |
| EJS | Plus simple Handlebars | Moins de features, moins de support entreprise | REJETE |
| MJML | Email-specific, responsive automatique | Apprentissage langage propre, build step | DEFFERE Sprint 14 evaluation |
| 1 locale uniquement (fr) | Simple | Pas conforme exigences UX MA | REJETE |
| 4 locales (fr-MA, ar-MA, en, fr-FR) (RETENU) | Couverture complete marche | 40 templates a maintenir | RETENU |

### 2.3 Trade-offs

Choisir Nodemailer + Handlebars implique d'accepter de maintenir 40 fichiers `.hbs` (10 templates x 4 locales). C'est du travail mais reste gerable. Sprint 14 considera l'utilisation d'un editeur visuel comme Stripo ou Mailjet UI pour faciliter la mise a jour par les non-developpeurs.

Choisir SMTP plutot qu'API HTTP (SendGrid Transactional API) implique d'accepter une latency plus elevee (SMTP handshake 200-500ms vs API ~50ms) et la dependance a un serveur SMTP outbound. En contrepartie, la portabilite est totale : on peut basculer entre Mailhog, Postfix self-hosted, SendGrid, AWS SES sans changer le code, juste les env vars.

Choisir 4 locales implique d'accepter qu'a chaque ajout d'un nouveau template, on doit creer 4 fichiers. En contrepartie, la coherence UX est garantie. Sprint 14 ajoutera potentiellement gp (Greenlandic-Persian) ou autres locales tres specifiques (peu probable mais structure le permet).

Choisir de cacher les templates compiles en memoire implique d'accepter une consommation memoire ~50 KB (10 templates x 4 locales x ~1 KB compile each). En contrepartie, perf gain x10 (compile 5ms vs cached lookup 0.5ms). Reset cache au deploiement (boot).

### 2.4 Decisions strategiques referenced

- decision-006 (No-emoji) : totale.
- decision-007 (Zod runtime) : indirect, EmailService recoit input typed (interface TypeScript).
- decision-008 (Cloud souverain MA) : Sprint 35 transition vers Atlas Email ou SendGrid avec SLA conformite MA.
- decision-009 (Multi-locale fr-MA, ar-MA, en, fr-FR) : totale.
- decision-018 (Templates Handlebars) : pertinence totale.

### 2.5 Pieges techniques connus

1. **Templates Handlebars avec script HTML mal echappe** : `{{user_input}}` est auto-escape par Handlebars. `{{{raw_html}}}` n'est PAS escape -- a reserver aux variables connues (jamais user input).
2. **Email size > 100 KB** : Gmail clip les emails > 102 KB, masquant le footer. Templates doivent rester < 80 KB HTML compresse.
3. **Inline CSS vs external CSS** : inline obligatoire (mail clients ignorent `<link>` et `<style>` blocks parfois). Sprint 13 utilise inline tags CSS dans HTML.
4. **Images data URL vs URL externes** : URLs externes peuvent etre bloquees par Outlook par defaut (request preview). Solution : data URL pour logo critique, URL externes pour visuels secondaires.
5. **RTL CSS direction conflict** : layout shared CSS doit basculer entre `text-align: left` et `right` selon `isRtl` helper.
6. **Encoding subject UTF-8** : utiliser `=?utf-8?B?...?=` (Base64 encoding) automatique via Nodemailer.
7. **Reply-To vs From** : convention Skalean -- From = noreply@skalean.ma, Reply-To = support@skalean.ma uniquement pour emails ou reply justifie.
8. **Connection pool exhausted** : Nodemailer pool max 5 connections. Sprint 14 augmentera a 20 si load plus grand.
9. **Rate limiting SMTP** : SendGrid Sprint 35 limite a 100 emails/seconde. Tache 2.1.13 prepare queue Sprint 14 BullMQ.
10. **Bounce handling** : SMTP bounce notifications via callback. Sprint 14 implementera consumer Bounce processor.
11. **Token leak via referrer URL email** : token dans URL peut leak. Mitigation : TTL court (deja Tache 2.1.9 24h, 2.1.11 1h).
12. **Caractere ZWJ (zero-width joiner) pour darija** : ar-MA peut utiliser ZWJ pour lettres jointes. Verifier rendering cross-clients.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.13 livre EmailService consomme par : 2.1.9 (sendVerification), 2.1.11 (sendPasswordReset + sendPasswordChangedNotification + sendRecoveryCompletedNotification), 2.1.10 (sendAccountLockedNotification), 2.1.8 (sendMfaEnabledNotification + sendMfaDisabledNotification), 2.1.12 (sendSecurityAlert sur consume `auth.suspicious_login`), 2.1.15 (E2E tests via Mailhog).

### 3.2 Position dans le programme global

- Sprint 14 : retry queue BullMQ, bounce handler, MJML migration eventuelle.
- Sprint 17 (Comm vertical) : consumes EmailService pour appointments, devis, factures.
- Sprint 18 (Notifications) : consumes pour notifications transverses.
- Sprint 22 (Analytics) : track open rate via pixel beacon Sprint 22.
- Sprint 35 : migration vers SendGrid Sprint 35 ou Atlas Email Sprint 35+ pour conformite cloud souverain MA.

### 3.3 Diagramme

```
                  +-----------------------------------+
                  | Tache 2.1.12 termine               |
                  +-----------------+------------------+
                                    |
                                    v
              +---------------------+---------------------+
              | TACHE 2.1.13 (cette tache)                  |
              | EmailService                              |
              | - send(to, locale, template, vars)        |
              | - sendVerification (2.1.9)                |
              | - sendPasswordReset (2.1.11)              |
              | - sendPasswordChangedNotification (2.1.11)|
              | - sendAccountLockedNotification (2.1.10)  |
              | - sendAccountUnlockedNotification         |
              | - sendMfaEnabledNotification (2.1.8)      |
              | - sendMfaDisabledNotification             |
              | - sendSecurityAlert (Sprint 18)           |
              | - sendRecoveryCompletedNotification       |
              |                                           |
              | 40 templates Handlebars (10 x 4 locales)  |
              | Layout shared _layout.hbs                 |
              | Helpers : formatDate, isRtl, shortenUA    |
              +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                | | | | | | | | | | | | | | | | | | | |
                v v v v v v v v v v v v v v v v v v v v
                2.1.8 / 2.1.9 / 2.1.10 / 2.1.11 / 2.1.12
                Sprint 14 retry queue / Sprint 17 Comm / etc.
```

---

## 4. Livrables checkables (28 livrables)

- [ ] Service `repo/packages/comm/src/services/email.service.ts` -- ~450 lignes
- [ ] Helper `repo/packages/comm/src/services/email.helpers.ts` -- ~80 lignes (htmlToText, shortenUserAgent, getSubject)
- [ ] Errors `repo/packages/comm/src/errors/email-errors.ts` -- ~60 lignes
- [ ] Layout `repo/packages/comm/src/templates/_layout.hbs` -- ~150 lignes
- [ ] 40 templates dans `repo/packages/comm/src/templates/{fr-MA,ar-MA,en,fr-FR}/{10 templates}.hbs` -- ~50 lignes chacun
- [ ] Mise a jour `package.json` : ajouter `nodemailer@6.9.16`, `@types/nodemailer@6.4.17`, `handlebars@4.7.8`
- [ ] Variables env : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME`, `SMTP_SECURE`, `MAILHOG_API_URL` (dev)
- [ ] Tests `email.service.spec.ts` -- 25+ tests -- ~450 lignes
- [ ] Tests `email.helpers.spec.ts` -- 8 tests -- ~120 lignes
- [ ] Tests integration `email.integration.spec.ts` Mailhog -- 6 tests -- ~150 lignes
- [ ] Module `comm.module.ts` exporting EmailService
- [ ] Mise a jour `repo/packages/auth/src/auth.module.ts` -- import CommModule (ou direct EmailService injection)
- [ ] Documentation README `repo/packages/comm/README.md`
- [ ] No-emoji
- [ ] No-console
- [ ] No log de tokens en clair
- [ ] No log de emails entiers (uniquement message_id + to + template)
- [ ] Coverage >= 88%
- [ ] Build TypeScript reussit
- [ ] Tous les 10 templates presents dans 4 locales
- [ ] Layout RTL applique pour ar-MA
- [ ] Multipart HTML + plain text fallback
- [ ] Subject localized par template
- [ ] Variables Handlebars interpolees correctement
- [ ] Pool SMTP configure
- [ ] Cache templates compiles
- [ ] Mailhog integration test passe en dev
- [ ] Bench email send < 500 ms p99 (sans SMTP latency reel, mock)

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/services/email.service.ts                                  (~450 lignes)
repo/packages/comm/src/services/email.helpers.ts                                  (~80 lignes)
repo/packages/comm/src/errors/email-errors.ts                                      (~60 lignes)
repo/packages/comm/src/comm.module.ts                                              (~30 lignes)
repo/packages/comm/src/index.ts                                                    (~25 lignes)
repo/packages/comm/src/templates/_layout.hbs                                        (~150 lignes)
repo/packages/comm/src/templates/fr-MA/verify-email.hbs                            (~50 lignes)
repo/packages/comm/src/templates/fr-MA/password-reset.hbs                          (~50 lignes)
repo/packages/comm/src/templates/fr-MA/password-changed.hbs                        (~50 lignes)
repo/packages/comm/src/templates/fr-MA/account-locked.hbs                          (~50 lignes)
repo/packages/comm/src/templates/fr-MA/account-unlocked.hbs                        (~50 lignes)
repo/packages/comm/src/templates/fr-MA/mfa-enabled.hbs                             (~50 lignes)
repo/packages/comm/src/templates/fr-MA/mfa-disabled.hbs                            (~50 lignes)
repo/packages/comm/src/templates/fr-MA/security-alert.hbs                          (~50 lignes)
repo/packages/comm/src/templates/fr-MA/recovery-completed.hbs                      (~50 lignes)
repo/packages/comm/src/templates/fr-MA/suspicious-login.hbs                        (~50 lignes)
repo/packages/comm/src/templates/ar-MA/{10 templates}.hbs                          (10 x ~50 lignes)
repo/packages/comm/src/templates/en/{10 templates}.hbs                             (10 x ~50 lignes)
repo/packages/comm/src/templates/fr-FR/{10 templates}.hbs                          (10 x ~50 lignes)
repo/packages/comm/test/services/email.service.spec.ts                              (~450 lignes)
repo/packages/comm/test/services/email.helpers.spec.ts                              (~120 lignes)
repo/packages/comm/test/integration/email.integration.spec.ts                       (~150 lignes)
repo/packages/comm/package.json                                                     (modifie / +deps)
.env.example                                                                         (modifie / +SMTP vars)
repo/packages/auth/src/auth.module.ts                                                (modifie / consume EmailService)
```

Total : 47 fichiers crees (40 templates + 7 code), ~3500 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 14 : `email.service.ts`

```typescript
/**
 * @insurtech/comm/services/email.service
 *
 * Transactional email service via Nodemailer + Handlebars 4 locales.
 *
 * Reference :
 *   - decision-009 (Multi-locale)
 *   - decision-018 (Templates Handlebars)
 *   - Sprint 5 Tache 2.1.13 (this task)
 *   - Sprint 14 retry queue BullMQ
 *   - Sprint 35 migration SendGrid Transactional
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import handlebars from 'handlebars';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlToText, shortenUserAgent } from './email.helpers.js';

export type EmailLocale = 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';

export type EmailTemplate =
  | 'verify-email'
  | 'password-reset'
  | 'password-changed'
  | 'account-locked'
  | 'account-unlocked'
  | 'mfa-enabled'
  | 'mfa-disabled'
  | 'security-alert'
  | 'recovery-completed'
  | 'suspicious-login';

export interface SendEmailInput {
  to: string;
  locale: EmailLocale;
  template: EmailTemplate;
  variables: Record<string, unknown>;
  reply_to?: string;
}

export interface SendVerificationInput {
  to: string;
  locale: EmailLocale;
  token: string;
  display_name: string;
}

export interface SendPasswordResetInput {
  to: string;
  locale: EmailLocale;
  token: string;
  display_name: string;
}

export interface SendPasswordChangedNotificationInput {
  to: string;
  locale: EmailLocale;
  display_name: string;
  ip?: string;
  user_agent?: string;
  geo_country?: string;
  changed_at?: Date;
}

export interface SendAccountLockedInput {
  to: string;
  locale: EmailLocale;
  display_name: string;
  tier: 1 | 2 | 3 | 4;
  locked_until: Date;
  last_failure_ip: string;
}

export interface SendAccountUnlockedInput {
  to: string;
  locale: EmailLocale;
  display_name: string;
  unlocked_by: string;
  reason: string;
  ticket_id?: string;
}

export interface SendMfaEnabledInput {
  to: string;
  locale: EmailLocale;
  display_name: string;
  recovery_codes_count: number;
}

export interface SendSecurityAlertInput {
  to: string;
  locale: EmailLocale;
  signal: string;
  action_required: string;
  display_name?: string;
}

interface SendResult {
  message_id: string;
  accepted: number;
  rejected: number;
}

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;
  private templateCache = new Map<string, HandlebarsTemplateDelegate>();
  private layoutTemplate: HandlebarsTemplateDelegate | null = null;
  private fromAddress = 'noreply@skalean.ma';
  private fromName = 'Skalean InsurTech';
  private replyTo = 'support@skalean.ma';
  private frontendBaseUrl = 'https://app.skalean.ma';
  private templatesRoot = '';

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST') ?? 'localhost',
      port: Number.parseInt(this.config.get<string>('SMTP_PORT') ?? '1025', 10),
      secure: this.config.get<string>('SMTP_SECURE') === 'true',
      auth: this.config.get<string>('SMTP_USER')
        ? {
            user: this.config.get<string>('SMTP_USER'),
            pass: this.config.get<string>('SMTP_PASSWORD'),
          }
        : undefined,
      pool: true,
      maxConnections: Number.parseInt(this.config.get<string>('SMTP_MAX_CONNECTIONS') ?? '5', 10),
      maxMessages: Number.parseInt(this.config.get<string>('SMTP_MAX_MESSAGES') ?? '100', 10),
      tls: { rejectUnauthorized: this.config.get<string>('NODE_ENV') === 'production' },
    });

    this.fromAddress = this.config.get<string>('SMTP_FROM_ADDRESS') ?? this.fromAddress;
    this.fromName = this.config.get<string>('SMTP_FROM_NAME') ?? this.fromName;
    this.replyTo = this.config.get<string>('SMTP_REPLY_TO') ?? this.replyTo;
    this.frontendBaseUrl = this.config.get<string>('FRONTEND_BASE_URL') ?? this.frontendBaseUrl;

    const here = dirname(fileURLToPath(import.meta.url));
    this.templatesRoot = join(here, '..', 'templates');
    const layoutPath = join(this.templatesRoot, '_layout.hbs');
    if (!existsSync(layoutPath)) {
      throw new Error(`EmailService: layout template not found at ${layoutPath}`);
    }
    const layoutRaw = readFileSync(layoutPath, 'utf-8');
    this.layoutTemplate = handlebars.compile(layoutRaw);

    this.registerHelpers();
    await this.verifyConnection();
    await this.warmTemplateCache();

    this.logger.log({
      action: 'email_service_initialized',
      from: this.fromAddress,
      transport_host: this.config.get<string>('SMTP_HOST'),
      cached_templates: this.templateCache.size,
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
    }
  }

  private registerHelpers(): void {
    handlebars.registerHelper('formatDate', (date: Date | string | number) => {
      const d = date instanceof Date ? date : new Date(date);
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Africa/Casablanca',
      }).format(d);
    });

    handlebars.registerHelper('formatDateAr', (date: Date | string | number) => {
      const d = date instanceof Date ? date : new Date(date);
      return new Intl.DateTimeFormat('ar-MA', {
        dateStyle: 'long',
        timeStyle: 'short',
        timeZone: 'Africa/Casablanca',
      }).format(d);
    });

    handlebars.registerHelper('isRtl', (locale: string) => locale === 'ar-MA' || locale === 'ar');

    handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    handlebars.registerHelper('shortenUA', (ua: string) => shortenUserAgent(ua));

    handlebars.registerHelper('frontendUrl', (path: string) => `${this.frontendBaseUrl}${path}`);
  }

  private async verifyConnection(): Promise<void> {
    if (!this.transporter) return;
    try {
      await this.transporter.verify();
      this.logger.log('SMTP transporter verified');
    } catch (err) {
      this.logger.warn({
        err: err instanceof Error ? err.message : err,
      }, 'SMTP transporter verify failed -- emails may not be delivered');
      // Do NOT throw -- allow service to start even if SMTP is temporarily unavailable
    }
  }

  private async warmTemplateCache(): Promise<void> {
    const locales: EmailLocale[] = ['fr-MA', 'ar-MA', 'en', 'fr-FR'];
    const templates: EmailTemplate[] = [
      'verify-email', 'password-reset', 'password-changed',
      'account-locked', 'account-unlocked',
      'mfa-enabled', 'mfa-disabled',
      'security-alert', 'recovery-completed', 'suspicious-login',
    ];
    let loaded = 0;
    let missing = 0;
    for (const locale of locales) {
      for (const template of templates) {
        const path = join(this.templatesRoot, locale, `${template}.hbs`);
        if (!existsSync(path)) {
          missing += 1;
          this.logger.warn({ locale, template, path }, 'Email template missing -- will fallback to fr-MA');
          continue;
        }
        const raw = readFileSync(path, 'utf-8');
        this.templateCache.set(`${locale}:${template}`, handlebars.compile(raw));
        loaded += 1;
      }
    }
    this.logger.log({
      action: 'template_cache_warmed',
      loaded,
      missing,
      total_expected: locales.length * templates.length,
    });
  }

  /**
   * Generic send. Use this when you need to send a custom template not covered by helpers.
   */
  async send(input: SendEmailInput): Promise<SendResult> {
    if (!this.transporter) throw new Error('EmailService not initialized');

    const compiled = this.getCompiledTemplate(input.locale, input.template);
    const innerHtml = compiled(input.variables);
    const fullHtml = this.layoutTemplate
      ? this.layoutTemplate({
          ...input.variables,
          locale: input.locale,
          content: innerHtml,
          frontend_base_url: this.frontendBaseUrl,
        })
      : innerHtml;

    const subject = this.getSubject(input.locale, input.template);

    const result = await this.transporter.sendMail({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: input.to,
      replyTo: input.reply_to ?? this.replyTo,
      subject,
      html: fullHtml,
      text: htmlToText(fullHtml),
      headers: {
        'X-Skalean-Template': input.template,
        'X-Skalean-Locale': input.locale,
        'X-Mailer': 'Skalean InsurTech v2.2',
      },
    });

    this.logger.log({
      action: 'email_sent',
      message_id: result.messageId,
      to: this.maskEmail(input.to),
      template: input.template,
      locale: input.locale,
      accepted_count: result.accepted?.length ?? 0,
      rejected_count: result.rejected?.length ?? 0,
    });

    return {
      message_id: result.messageId,
      accepted: result.accepted?.length ?? 0,
      rejected: result.rejected?.length ?? 0,
    };
  }

  async sendVerification(input: SendVerificationInput): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'verify-email',
      variables: {
        display_name: input.display_name,
        verify_url: `${this.frontendBaseUrl}/auth/email-verified?token=${encodeURIComponent(input.token)}`,
        ttl_hours: 24,
      },
    });
  }

  async sendPasswordReset(input: SendPasswordResetInput): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'password-reset',
      variables: {
        display_name: input.display_name,
        reset_url: `${this.frontendBaseUrl}/auth/reset-password?token=${encodeURIComponent(input.token)}`,
        ttl_hours: 1,
      },
    });
  }

  async sendPasswordChangedNotification(input: SendPasswordChangedNotificationInput): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'password-changed',
      variables: {
        display_name: input.display_name,
        ip: input.ip ?? 'unknown',
        user_agent: input.user_agent ?? '',
        geo_country: input.geo_country ?? 'unknown',
        changed_at: input.changed_at ?? new Date(),
        support_url: `${this.frontendBaseUrl}/support/security-incident`,
      },
    });
  }

  async sendAccountLockedNotification(input: SendAccountLockedInput): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'account-locked',
      variables: {
        display_name: input.display_name,
        tier: input.tier,
        locked_until: input.locked_until,
        last_failure_ip: input.last_failure_ip,
        recovery_url: `${this.frontendBaseUrl}/auth/forgot-password`,
        support_url: `${this.frontendBaseUrl}/support`,
      },
    });
  }

  async sendAccountUnlockedNotification(input: SendAccountUnlockedInput): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'account-unlocked',
      variables: {
        display_name: input.display_name,
        unlocked_by: input.unlocked_by,
        reason: input.reason,
        ticket_id: input.ticket_id ?? null,
        signin_url: `${this.frontendBaseUrl}/auth/signin`,
      },
    });
  }

  async sendMfaEnabledNotification(input: SendMfaEnabledInput): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'mfa-enabled',
      variables: {
        display_name: input.display_name,
        recovery_codes_count: input.recovery_codes_count,
        manage_mfa_url: `${this.frontendBaseUrl}/settings/mfa`,
      },
    });
  }

  async sendMfaDisabledNotification(input: { to: string; locale: EmailLocale; display_name: string }): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'mfa-disabled',
      variables: {
        display_name: input.display_name,
        re_enable_url: `${this.frontendBaseUrl}/settings/mfa`,
        support_url: `${this.frontendBaseUrl}/support`,
      },
    });
  }

  async sendSecurityAlert(input: SendSecurityAlertInput): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'security-alert',
      variables: {
        display_name: input.display_name ?? 'utilisateur',
        signal: input.signal,
        action_required: input.action_required,
        support_url: `${this.frontendBaseUrl}/support/security-incident`,
        change_password_url: `${this.frontendBaseUrl}/auth/forgot-password`,
      },
    });
  }

  async sendRecoveryCompletedNotification(input: { to: string; locale: EmailLocale; display_name: string }): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'recovery-completed',
      variables: {
        display_name: input.display_name,
        signin_url: `${this.frontendBaseUrl}/auth/signin`,
      },
    });
  }

  async sendSuspiciousLoginNotification(input: { to: string; locale: EmailLocale; display_name: string; ip: string; geo_country?: string }): Promise<SendResult> {
    return this.send({
      to: input.to,
      locale: input.locale,
      template: 'suspicious-login',
      variables: {
        display_name: input.display_name,
        ip: input.ip,
        geo_country: input.geo_country ?? 'unknown',
        review_url: `${this.frontendBaseUrl}/security/recent-activity`,
        change_password_url: `${this.frontendBaseUrl}/auth/forgot-password`,
      },
    });
  }

  /**
   * Verify delivery via Mailhog API in development.
   */
  async verifyDelivery(messageId: string): Promise<boolean> {
    const isDev = this.config.get<string>('NODE_ENV') === 'development';
    if (!isDev) return true;
    const mailhogUrl = this.config.get<string>('MAILHOG_API_URL') ?? 'http://localhost:8025';
    try {
      const response = await fetch(`${mailhogUrl}/api/v2/search?kind=containing&query=${encodeURIComponent(messageId)}`);
      const data = await response.json() as { count?: number };
      return (data.count ?? 0) > 0;
    } catch (err) {
      this.logger.warn({
        err: err instanceof Error ? err.message : err,
      }, 'Mailhog delivery verification failed');
      return false;
    }
  }

  /**
   * Returns the compiled template, falling back to fr-MA if locale-specific not found.
   */
  private getCompiledTemplate(locale: EmailLocale, template: EmailTemplate): HandlebarsTemplateDelegate {
    const cacheKey = `${locale}:${template}`;
    const cached = this.templateCache.get(cacheKey);
    if (cached) return cached;

    // Fallback to fr-MA
    const fallbackKey = `fr-MA:${template}`;
    const fallback = this.templateCache.get(fallbackKey);
    if (fallback) {
      this.logger.warn({
        locale, template,
      }, 'Locale template missing -- using fr-MA fallback');
      return fallback;
    }

    throw new Error(`EmailService: no template found for ${locale}/${template} or fr-MA fallback`);
  }

  private getSubject(locale: EmailLocale, template: EmailTemplate): string {
    const subjects: Record<EmailLocale, Record<EmailTemplate, string>> = {
      'fr-MA': {
        'verify-email': 'Verifiez votre email Skalean InsurTech',
        'password-reset': 'Reinitialisation de votre mot de passe',
        'password-changed': 'Votre mot de passe a ete modifie',
        'account-locked': 'Compte temporairement bloque',
        'account-unlocked': 'Compte debloque',
        'mfa-enabled': 'Authentification a deux facteurs activee',
        'mfa-disabled': 'Authentification a deux facteurs desactivee',
        'security-alert': 'Alerte securite Skalean',
        'recovery-completed': 'Mot de passe reinitialise',
        'suspicious-login': 'Activite de connexion suspecte',
      },
      'ar-MA': {
        'verify-email': 'وكد ايميلك ديال Skalean InsurTech',
        'password-reset': 'تجديد كلمة السر ديالك',
        'password-changed': 'كلمة السر ديالك تبدلات',
        'account-locked': 'الحساب ديالك تسد مؤقتا',
        'account-unlocked': 'الحساب ديالك تحلل',
        'mfa-enabled': 'تفعيل التحقق بخطوتين',
        'mfa-disabled': 'تعطيل التحقق بخطوتين',
        'security-alert': 'تنبيه أمني Skalean',
        'recovery-completed': 'تم تجديد كلمة السر',
        'suspicious-login': 'نشاط دخول مشبوه',
      },
      'en': {
        'verify-email': 'Verify your Skalean InsurTech email',
        'password-reset': 'Reset your password',
        'password-changed': 'Your password was changed',
        'account-locked': 'Account temporarily locked',
        'account-unlocked': 'Account unlocked',
        'mfa-enabled': 'Two-factor authentication enabled',
        'mfa-disabled': 'Two-factor authentication disabled',
        'security-alert': 'Skalean security alert',
        'recovery-completed': 'Password reset successfully',
        'suspicious-login': 'Suspicious login activity',
      },
      'fr-FR': {
        'verify-email': 'Verifiez votre email Skalean InsurTech',
        'password-reset': 'Reinitialisation de votre mot de passe',
        'password-changed': 'Votre mot de passe a ete modifie',
        'account-locked': 'Compte temporairement bloque',
        'account-unlocked': 'Compte debloque',
        'mfa-enabled': 'Authentification a deux facteurs activee',
        'mfa-disabled': 'Authentification a deux facteurs desactivee',
        'security-alert': 'Alerte securite Skalean',
        'recovery-completed': 'Mot de passe reinitialise',
        'suspicious-login': 'Activite de connexion suspecte',
      },
    };
    return subjects[locale]?.[template] ?? subjects['fr-MA'][template];
  }

  /**
   * Masks email for log : user@example.com -> u***@example.com
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return 'invalid';
    if (local.length <= 1) return `${local}***@${domain}`;
    return `${local[0]}***@${domain}`;
  }
}
```

### 6.2 Fichier 2 / 14 : `email.helpers.ts`

```typescript
/**
 * @insurtech/comm/services/email.helpers
 */

export function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function shortenUserAgent(ua: string): string {
  if (!ua || ua.length < 50) return ua;
  const browserMatch = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/([\d.]+)/);
  const osMatch = ua.match(/(iPhone|iPad|Android|Macintosh|Windows NT|Linux)/);
  const parts: string[] = [];
  if (browserMatch) parts.push(`${browserMatch[1]} ${browserMatch[2].split('.')[0]}`);
  if (osMatch) parts.push(osMatch[1]);
  return parts.length > 0 ? parts.join(' / ') : ua.slice(0, 50);
}

export function isValidEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

export function buildVerificationUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/auth/email-verified?token=${encodeURIComponent(token)}`;
}

export function buildResetPasswordUrl(baseUrl: string, token: string): string {
  return `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;
}
```

### 6.3 Fichier 3 / 14 : `email-errors.ts`

```typescript
export class EmailError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class EmailTemplateNotFoundError extends EmailError {
  constructor(locale: string, template: string) {
    super(`Template not found: ${locale}/${template}`, 'EMAIL_TEMPLATE_NOT_FOUND');
  }
}

export class EmailDeliveryError extends EmailError {
  constructor(reason: string) {
    super(`Email delivery failed: ${reason}`, 'EMAIL_DELIVERY_FAILED');
  }
}

export class EmailConfigError extends EmailError {
  constructor(missing: string) {
    super(`Email config missing: ${missing}`, 'EMAIL_CONFIG_MISSING');
  }
}

export function isEmailError(err: unknown): err is EmailError {
  return err instanceof EmailError;
}
```

### 6.4 Fichier 4 / 14 : `_layout.hbs`

```handlebars
<!DOCTYPE html>
<html lang="{{locale}}" {{#if (isRtl locale)}}dir="rtl"{{else}}dir="ltr"{{/if}}>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no">
  <title>Skalean InsurTech</title>
  <style type="text/css">
    body { margin: 0 !important; padding: 0 !important; -webkit-text-size-adjust: 100% !important; -ms-text-size-adjust: 100% !important; -webkit-font-smoothing: antialiased !important; }
    body, table, td { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1f2937; }
    table { border-spacing: 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    table td { border-collapse: collapse; }
    img { border: 0 !important; outline: none !important; }
    a { color: #1d4ed8; text-decoration: underline; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); }
    .header { background: linear-gradient(135deg, #1d4ed8 0%, #3730a3 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 700; color: #ffffff; }
    .content { padding: 30px 25px; line-height: 1.6; }
    .content h2 { color: #1e293b; font-size: 20px; margin-top: 0; margin-bottom: 16px; }
    .content p { margin: 0 0 16px; }
    .button { display: inline-block; padding: 14px 32px; background: #1d4ed8; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; }
    .button-danger { display: inline-block; padding: 14px 32px; background: #dc2626; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .button-success { display: inline-block; padding: 14px 32px; background: #059669; color: #ffffff !important; text-decoration: none; border-radius: 6px; font-weight: 600; }
    .footer { background: #f9fafb; padding: 20px 25px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    .footer a { color: #6b7280; }
    .alert-box { background: #fef3c7; border-{{#if (isRtl locale)}}right{{else}}left{{/if}}: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .info-box { background: #e0f2fe; border-{{#if (isRtl locale)}}right{{else}}left{{/if}}: 4px solid #0284c7; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .danger-box { background: #fee2e2; border-{{#if (isRtl locale)}}right{{else}}left{{/if}}: 4px solid #dc2626; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .success-box { background: #d1fae5; border-{{#if (isRtl locale)}}right{{else}}left{{/if}}: 4px solid #059669; padding: 15px; margin: 20px 0; border-radius: 4px; }
    .meta-info { background: #f3f4f6; padding: 12px 15px; border-radius: 4px; font-size: 13px; color: #4b5563; margin: 20px 0; }
    .meta-info strong { color: #1f2937; }
    .url-fallback { word-break: break-all; font-size: 12px; color: #6b7280; padding: 10px; background: #f9fafb; border-radius: 4px; margin-top: 16px; border: 1px solid #e5e7eb; }
    {{#if (isRtl locale)}}
    body { direction: rtl; text-align: right; font-family: 'Tajawal', 'Helvetica Neue', Arial, sans-serif; }
    .content { text-align: right; }
    .footer { text-align: center; }
    {{/if}}
    @media only screen and (max-width: 620px) {
      .container { margin: 10px !important; max-width: 100% !important; }
      .content { padding: 20px 15px !important; }
      .button, .button-danger, .button-success { padding: 12px 24px !important; font-size: 14px !important; display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #f5f7fa;">
    <tr>
      <td align="center" style="padding: 0;">
        <div class="container">
          <div class="header">
            <h1>Skalean InsurTech</h1>
          </div>
          <div class="content">
            {{{content}}}
          </div>
          <div class="footer">
            <p style="margin: 0 0 8px;">Skalean SARL, RC Casablanca XXXX</p>
            <p style="margin: 0 0 8px;">{{#if (isRtl locale)}}هاد الايميل تصيفط اوتوماتيكيا، ما تجاوبش عليه{{else}}{{#if (eq locale "en")}}This email was sent automatically, please do not reply{{else}}Cet email a ete envoye automatiquement, ne pas repondre{{/if}}{{/if}}</p>
            <p style="margin: 0;">
              <a href="{{frontend_base_url}}/legal/privacy">{{#if (isRtl locale)}}الخصوصية{{else}}{{#if (eq locale "en")}}Privacy{{else}}Confidentialite{{/if}}{{/if}}</a> |
              <a href="{{frontend_base_url}}/legal/cgu">{{#if (isRtl locale)}}الشروط{{else}}{{#if (eq locale "en")}}Terms{{else}}CGU{{/if}}{{/if}}</a> |
              <a href="{{frontend_base_url}}/support">{{#if (isRtl locale)}}الدعم{{else}}{{#if (eq locale "en")}}Support{{else}}Support{{/if}}{{/if}}</a>
            </p>
          </div>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
```

### 6.5 Fichier 5 / 14 : `verify-email.hbs` (fr-MA)

```handlebars
<h2>Bonjour {{display_name}},</h2>

<p>Bienvenue sur Skalean InsurTech, la plateforme integree de gestion d'assurance et de reparations automobiles au Maroc.</p>

<p><strong>Pour activer votre compte, veuillez confirmer votre adresse email :</strong></p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{verify_url}}" class="button">Verifier mon email</a>
</p>

<div class="info-box">
  <p style="margin: 0;"><strong>Important :</strong> Le lien est valide pendant <strong>{{ttl_hours}} heures</strong>. Apres cela, vous devrez demander un nouveau lien depuis la page de connexion.</p>
</div>

<div class="url-fallback">
  Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
  <a href="{{verify_url}}">{{verify_url}}</a>
</div>

<p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
  Si vous n'etes pas a l'origine de cette inscription, ignorez cet email. Aucun compte ne sera cree sans verification.
</p>
```

### 6.6 Fichier 6 / 14 : `verify-email.hbs` (ar-MA)

```handlebars
<h2>السلام {{display_name}},</h2>

<p>مرحبا بيك في Skalean InsurTech، المنصة المتكاملة لتدبير التامين وتصليح السيارات في المغرب.</p>

<p><strong>باش تفعل الحساب ديالك، عافاك وكد عنوان الايميل :</strong></p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{verify_url}}" class="button">وكد الايميل</a>
</p>

<div class="info-box">
  <p style="margin: 0;"><strong>مهم :</strong> اللينك صالح <strong>{{ttl_hours}} ساعة</strong>. من بعد، خاصك تطلب لينك جديد من صفحة الدخول.</p>
</div>

<div class="url-fallback">
  الا ما خدماتش الزر، نسخ هاد اللينك في المتصفح ديالك :<br>
  <a href="{{verify_url}}">{{verify_url}}</a>
</div>

<p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
  الا ما درتيش هاد التسجيل، عافاك تجاهل هاد الايميل. الحساب ما غايتفعل حتى يتم التحقق.
</p>
```

### 6.7 Fichier 7 / 14 : `verify-email.hbs` (en)

```handlebars
<h2>Hello {{display_name}},</h2>

<p>Welcome to Skalean InsurTech, the integrated platform for insurance management and automobile repair in Morocco.</p>

<p><strong>To activate your account, please confirm your email address :</strong></p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{verify_url}}" class="button">Verify my email</a>
</p>

<div class="info-box">
  <p style="margin: 0;"><strong>Important :</strong> The link is valid for <strong>{{ttl_hours}} hours</strong>. After that, you will need to request a new link from the login page.</p>
</div>

<div class="url-fallback">
  If the button does not work, copy this link into your browser :<br>
  <a href="{{verify_url}}">{{verify_url}}</a>
</div>

<p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
  If you did not initiate this signup, ignore this email. No account will be created without verification.
</p>
```

### 6.8 Fichier 8 / 14 : `password-reset.hbs` (fr-MA)

```handlebars
<h2>Bonjour {{display_name}},</h2>

<p>Vous avez demande la reinitialisation de votre mot de passe Skalean InsurTech.</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{reset_url}}" class="button">Reinitialiser mon mot de passe</a>
</p>

<div class="alert-box">
  <p style="margin: 0;"><strong>Important :</strong> Le lien est valide pendant <strong>{{ttl_hours}} heure</strong> seulement. Apres cela, demandez un nouveau lien.</p>
</div>

<div class="url-fallback">
  Si le bouton ne fonctionne pas, copiez ce lien :<br>
  <a href="{{reset_url}}">{{reset_url}}</a>
</div>

<p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
  Si vous n'avez pas demande cette reinitialisation, ignorez cet email. Votre mot de passe actuel reste valide.
</p>

<p style="color: #6b7280; font-size: 13px;">
  Si vous recevez plusieurs emails de reinitialisation que vous n'avez pas demandes, contactez le <a href="{{support_url}}">support securite</a>.
</p>
```

### 6.9 Fichier 9 / 14 : `password-changed.hbs` (fr-MA)

```handlebars
<h2>Bonjour {{display_name}},</h2>

<p>Votre mot de passe Skalean InsurTech vient d'etre modifie.</p>

<div class="alert-box">
  <p style="margin: 0 0 10px;"><strong>Etiez-vous a l'origine de ce changement ?</strong></p>
  <p style="margin: 0;"><strong>Si OUI :</strong> aucune action requise. Vous pouvez vous connecter avec votre nouveau mot de passe.</p>
  <p style="margin: 10px 0 0;"><strong>Si NON :</strong> votre compte est potentiellement compromis. Agissez immediatement.</p>
</div>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{support_url}}" class="button-danger">Contacter le support securite</a>
</p>

<div class="meta-info">
  <p style="margin: 0 0 8px;"><strong>Details du changement :</strong></p>
  <p style="margin: 0 0 4px;">Date : {{formatDate changed_at}}</p>
  <p style="margin: 0 0 4px;">Adresse IP : {{ip}}</p>
  <p style="margin: 0 0 4px;">Localisation : {{geo_country}}</p>
  <p style="margin: 0;">Navigateur : {{shortenUA user_agent}}</p>
</div>
```

### 6.10 Fichier 10 / 14 : `account-locked.hbs` (fr-MA)

```handlebars
<h2>Bonjour {{display_name}},</h2>

<p>Pour des raisons de securite, votre compte Skalean InsurTech a ete temporairement bloque suite a plusieurs tentatives de connexion infructueuses.</p>

<div class="alert-box">
  <p style="margin: 0;"><strong>Niveau de blocage :</strong> Tier {{tier}}</p>
  <p style="margin: 8px 0 0;"><strong>Deblocage automatique :</strong> {{formatDate locked_until}}</p>
</div>

<p>Vous pouvez egalement reinitialiser votre mot de passe pour debloquer immediatement votre compte :</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{recovery_url}}" class="button">Reinitialiser mon mot de passe</a>
</p>

<div class="meta-info">
  <p style="margin: 0;"><strong>Derniere tentative depuis :</strong> {{last_failure_ip}}</p>
</div>

<p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
  Si ces tentatives ne proviennent pas de vous, votre compte est cible. Contactez le <a href="{{support_url}}">support</a>.
</p>
```

### 6.11 Fichier 11 / 14 : `mfa-enabled.hbs` (fr-MA)

```handlebars
<h2>Bonjour {{display_name}},</h2>

<p>L'authentification a deux facteurs (MFA) vient d'etre activee sur votre compte Skalean InsurTech.</p>

<div class="success-box">
  <p style="margin: 0;"><strong>Securite renforcee :</strong> votre compte est maintenant protege par un second facteur d'authentification.</p>
</div>

<p>Vous avez recu <strong>{{recovery_codes_count}} codes de recuperation</strong> lors de la configuration. Ces codes vous permettent de vous connecter en cas de perte de votre appareil authenticator.</p>

<div class="alert-box">
  <p style="margin: 0;"><strong>Important :</strong> Conservez ces codes dans un endroit sur (gestionnaire de mots de passe, coffre-fort numerique). Chaque code ne peut etre utilise qu'une seule fois.</p>
</div>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{manage_mfa_url}}" class="button">Gerer mes parametres MFA</a>
</p>

<p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
  Si vous n'avez pas active MFA, votre compte est potentiellement compromis. Contactez immediatement le support.
</p>
```

### 6.12 Fichier 12 / 14 : `security-alert.hbs` (fr-MA)

```handlebars
<h2>Alerte securite -- {{display_name}}</h2>

<div class="danger-box">
  <p style="margin: 0;"><strong>Activite suspecte detectee sur votre compte.</strong></p>
</div>

<p><strong>Signal detecte :</strong> {{signal}}</p>

<p><strong>Action recommandee :</strong> {{action_required}}</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{change_password_url}}" class="button-danger">Changer mon mot de passe</a>
</p>

<p>Si vous reconnaissez cette activite (par exemple voyage, nouveau device), aucune action n'est requise. Sinon, agissez rapidement :</p>

<ol>
  <li>Changez votre mot de passe immediatement.</li>
  <li>Verifiez vos sessions actives et revoquez les sessions inconnues.</li>
  <li>Activez l'authentification a deux facteurs si ce n'est pas deja fait.</li>
  <li>Contactez le <a href="{{support_url}}">support securite</a> si necessaire.</li>
</ol>
```

### 6.13 Fichier 13 / 14 : `comm.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './services/email.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class CommModule {}
```

### 6.14 Fichier 14 / 14 : `index.ts`

```typescript
export { EmailService } from './services/email.service.js';
export type {
  EmailLocale, EmailTemplate,
  SendEmailInput, SendVerificationInput, SendPasswordResetInput,
  SendPasswordChangedNotificationInput, SendAccountLockedInput,
  SendAccountUnlockedInput, SendMfaEnabledInput, SendSecurityAlertInput,
} from './services/email.service.js';
export {
  EmailError, EmailTemplateNotFoundError, EmailDeliveryError, EmailConfigError, isEmailError,
} from './errors/email-errors.js';
export { CommModule } from './comm.module.js';
```

---

## 7. Tests complets

### 7.1 Tests `email.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import nodemailer from 'nodemailer';
import { EmailService } from '../../src/services/email.service.js';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

describe('EmailService', () => {
  let service: EmailService;
  let mockTransporter: any;
  let sendMailMock: any;

  beforeEach(async () => {
    sendMailMock = vi.fn().mockResolvedValue({
      messageId: '<test-message-id@skalean.test>',
      accepted: ['user@example.com'],
      rejected: [],
    });
    mockTransporter = {
      verify: vi.fn().mockResolvedValue(true),
      sendMail: sendMailMock,
      close: vi.fn(),
    };
    (nodemailer.createTransport as any).mockReturnValue(mockTransporter);

    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '1025';
    process.env.SMTP_FROM_ADDRESS = 'noreply@skalean.test';
    process.env.SMTP_FROM_NAME = 'Skalean Test';
    process.env.FRONTEND_BASE_URL = 'https://app.skalean.test';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [EmailService],
    }).compile();
    service = moduleRef.get(EmailService);
    await service.onModuleInit();
  });

  describe('sendVerification', () => {
    it('sends verify-email template with token URL', async () => {
      const result = await service.sendVerification({
        to: 'user@example.com',
        locale: 'fr-MA',
        token: 'abc123token',
        display_name: 'Test User',
      });
      expect(result.message_id).toBeDefined();
      expect(sendMailMock).toHaveBeenCalled();
      const call = sendMailMock.mock.calls[0][0];
      expect(call.to).toBe('user@example.com');
      expect(call.subject).toContain('Verifiez');
      expect(call.html).toContain('abc123token');
      expect(call.html).toContain('Test User');
    });

    it('encodes token in URL safely', async () => {
      await service.sendVerification({
        to: 'user@example.com',
        locale: 'fr-MA',
        token: 'a+b/c=d',
        display_name: 'Test',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('a%2Bb%2Fc%3Dd');
    });

    it('uses ar-MA template with RTL', async () => {
      await service.sendVerification({
        to: 'user@example.com',
        locale: 'ar-MA',
        token: 'abc',
        display_name: 'احمد',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.subject).toContain('وكد');
      expect(call.html).toContain('dir="rtl"');
    });

    it('uses en template', async () => {
      await service.sendVerification({
        to: 'user@example.com',
        locale: 'en',
        token: 'abc',
        display_name: 'John',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.subject).toContain('Verify');
    });
  });

  describe('sendPasswordReset', () => {
    it('uses TTL 1 hour in template', async () => {
      await service.sendPasswordReset({
        to: 'user@example.com',
        locale: 'fr-MA',
        token: 'reset-tok',
        display_name: 'Test',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('1 heure');
    });
  });

  describe('sendPasswordChangedNotification', () => {
    it('includes IP and user agent', async () => {
      await service.sendPasswordChangedNotification({
        to: 'user@example.com',
        locale: 'fr-MA',
        display_name: 'Test',
        ip: '1.2.3.4',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0)',
        geo_country: 'MA',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('1.2.3.4');
      expect(call.html).toContain('MA');
    });
  });

  describe('sendAccountLockedNotification', () => {
    it('includes tier number and recovery URL', async () => {
      await service.sendAccountLockedNotification({
        to: 'user@example.com',
        locale: 'fr-MA',
        display_name: 'Test',
        tier: 2,
        locked_until: new Date('2026-05-06T12:00:00Z'),
        last_failure_ip: '99.99.99.99',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toContain('Tier 2');
      expect(call.html).toContain('99.99.99.99');
      expect(call.html).toContain('forgot-password');
    });
  });

  describe('multipart HTML + plain text', () => {
    it('generates plain text fallback', async () => {
      await service.sendVerification({
        to: 'user@example.com',
        locale: 'fr-MA',
        token: 'abc',
        display_name: 'Test',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.html).toBeDefined();
      expect(call.text).toBeDefined();
      expect(call.text).not.toContain('<html');
      expect(call.text).not.toContain('<style');
    });
  });

  describe('headers', () => {
    it('sets X-Skalean-Template and X-Skalean-Locale', async () => {
      await service.sendVerification({
        to: 'user@example.com',
        locale: 'fr-MA',
        token: 'abc',
        display_name: 'Test',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.headers['X-Skalean-Template']).toBe('verify-email');
      expect(call.headers['X-Skalean-Locale']).toBe('fr-MA');
      expect(call.headers['X-Mailer']).toContain('Skalean');
    });
  });

  describe('From address', () => {
    it('uses configured from name + address', async () => {
      await service.sendVerification({
        to: 'user@example.com',
        locale: 'fr-MA',
        token: 'abc',
        display_name: 'Test',
      });
      const call = sendMailMock.mock.calls[0][0];
      expect(call.from).toBe('"Skalean Test" <noreply@skalean.test>');
    });
  });

  describe('email masking in logs', () => {
    it('masks recipient in log output', async () => {
      const logSpy = vi.spyOn(service['logger'], 'log');
      await service.sendVerification({
        to: 'longuser@example.com',
        locale: 'fr-MA',
        token: 'abc',
        display_name: 'Test',
      });
      const call = logSpy.mock.calls[0][0] as any;
      expect(call.to).toMatch(/^l\*\*\*@example\.com$/);
    });
  });

  describe('Locale fallback', () => {
    it('falls back to fr-MA for missing locale-specific template', async () => {
      // Force locale not in cache by deleting
      service['templateCache'].delete('en:verify-email');
      const r = await service.sendVerification({
        to: 'user@example.com',
        locale: 'en',
        token: 'abc',
        display_name: 'Test',
      });
      expect(r.message_id).toBeDefined();
    });
  });

  describe('SMTP transporter pool config', () => {
    it('configures pool=true with maxConnections=5', () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          pool: true,
          maxConnections: 5,
          maxMessages: 100,
        }),
      );
    });
  });

  describe('SMTP delivery error', () => {
    it('rejects when sendMail fails', async () => {
      sendMailMock.mockRejectedValue(new Error('SMTP connection refused'));
      await expect(service.sendVerification({
        to: 'user@example.com',
        locale: 'fr-MA',
        token: 'abc',
        display_name: 'Test',
      })).rejects.toThrow();
    });
  });

  describe('all methods exposed', () => {
    it('exposes 10+ helper methods', () => {
      const methods = [
        'send', 'sendVerification', 'sendPasswordReset', 'sendPasswordChangedNotification',
        'sendAccountLockedNotification', 'sendAccountUnlockedNotification',
        'sendMfaEnabledNotification', 'sendMfaDisabledNotification',
        'sendSecurityAlert', 'sendRecoveryCompletedNotification', 'sendSuspiciousLoginNotification',
        'verifyDelivery',
      ];
      for (const m of methods) {
        expect(typeof (service as any)[m]).toBe('function');
      }
    });
  });
});
```

### 7.2 Tests `email.helpers.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { htmlToText, shortenUserAgent, isValidEmail, buildVerificationUrl, buildResetPasswordUrl } from '../../src/services/email.helpers.js';

describe('htmlToText', () => {
  it('strips HTML tags', () => {
    expect(htmlToText('<h1>Hello</h1><p>World</p>')).toBe('Hello\n\nWorld');
  });

  it('strips style and script', () => {
    expect(htmlToText('<style>.x{color:red}</style><p>Hello</p>')).toBe('Hello');
    expect(htmlToText('<script>alert(1)</script><p>X</p>')).toBe('X');
  });

  it('decodes HTML entities', () => {
    expect(htmlToText('<p>&amp; &lt; &gt; &quot;</p>')).toBe('& < > "');
  });

  it('preserves line breaks from <br> and <p>', () => {
    expect(htmlToText('Line 1<br>Line 2<p>Para 2</p>')).toContain('Line 1');
    expect(htmlToText('Line 1<br>Line 2<p>Para 2</p>')).toContain('Line 2');
  });

  it('returns empty for empty input', () => {
    expect(htmlToText('')).toBe('');
  });
});

describe('shortenUserAgent', () => {
  it('returns short UA unchanged', () => {
    expect(shortenUserAgent('curl/7.68')).toBe('curl/7.68');
  });

  it('extracts browser + OS from long UA', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const result = shortenUserAgent(ua);
    expect(result).toContain('Chrome');
    expect(result).toContain('Windows');
  });

  it('handles iPhone UA', () => {
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const result = shortenUserAgent(ua);
    expect(result).toContain('iPhone');
  });
});

describe('isValidEmail', () => {
  it('accepts standard email', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
  });

  it('rejects malformed', () => {
    expect(isValidEmail('not-email')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
  });
});

describe('buildVerificationUrl + buildResetPasswordUrl', () => {
  it('URL-encodes token', () => {
    expect(buildVerificationUrl('https://app.test', 'a+b/c'))
      .toBe('https://app.test/auth/email-verified?token=a%2Bb%2Fc');
    expect(buildResetPasswordUrl('https://app.test', 'r=t'))
      .toBe('https://app.test/auth/reset-password?token=r%3Dt');
  });
});
```

### 7.3 Tests integration `email.integration.spec.ts` (Mailhog)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from '../../src/services/email.service.js';

const SKIP_MAILHOG = process.env.SKIP_MAILHOG === '1';
const MAILHOG_URL = process.env.MAILHOG_API_URL ?? 'http://localhost:8025';

describe.skipIf(SKIP_MAILHOG)('EmailService integration with Mailhog', () => {
  let service: EmailService;

  beforeAll(async () => {
    process.env.SMTP_HOST = 'localhost';
    process.env.SMTP_PORT = '1025';
    process.env.SMTP_FROM_ADDRESS = 'noreply@skalean.test';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [EmailService],
    }).compile();
    service = moduleRef.get(EmailService);
    await service.onModuleInit();
  });

  afterAll(async () => {
    // Clean Mailhog
    try {
      await fetch(`${MAILHOG_URL}/api/v1/messages`, { method: 'DELETE' });
    } catch {/* ignore */}
  });

  it('sends verification email and Mailhog receives it', async () => {
    const result = await service.sendVerification({
      to: 'integration-test@example.com',
      locale: 'fr-MA',
      token: 'integration-token-abc',
      display_name: 'Integration Test',
    });
    expect(result.accepted).toBeGreaterThan(0);

    // Wait Mailhog
    await new Promise((r) => setTimeout(r, 500));

    const search = await fetch(`${MAILHOG_URL}/api/v2/search?kind=to&query=integration-test@example.com`);
    const data = await search.json() as { count: number; items: any[] };
    expect(data.count).toBeGreaterThan(0);
    const message = data.items[0];
    expect(message.Content.Headers.Subject?.[0]).toContain('Verifiez');
    expect(message.Content.Body).toContain('integration-token-abc');
  }, 10000);

  it('sends ar-MA email with RTL', async () => {
    await service.sendVerification({
      to: 'arabic-test@example.com',
      locale: 'ar-MA',
      token: 'tok',
      display_name: 'احمد',
    });
    await new Promise((r) => setTimeout(r, 500));
    const search = await fetch(`${MAILHOG_URL}/api/v2/search?kind=to&query=arabic-test@example.com`);
    const data = await search.json() as { count: number; items: any[] };
    expect(data.count).toBeGreaterThan(0);
    const body = data.items[0].Content.Body;
    expect(body).toContain('dir="rtl"');
    expect(body).toContain('احمد');
  });

  it('sends 5 templates rapidly without connection exhaustion', async () => {
    const templates = ['verify-email', 'password-reset', 'password-changed', 'account-locked', 'mfa-enabled'] as const;
    for (const template of templates) {
      await service.send({
        to: `pool-${template}@example.com`,
        locale: 'fr-MA',
        template,
        variables: { display_name: 'Pool Test', verify_url: 'https://app.test', reset_url: 'https://app.test', changed_at: new Date(), tier: 1, locked_until: new Date(), last_failure_ip: '1.1.1.1', recovery_codes_count: 6, manage_mfa_url: 'https://app.test', recovery_url: 'https://app.test', support_url: 'https://app.test' },
      });
    }
    await new Promise((r) => setTimeout(r, 1500));
    const search = await fetch(`${MAILHOG_URL}/api/v2/search?kind=containing&query=pool`);
    const data = await search.json() as { count: number };
    expect(data.count).toBeGreaterThanOrEqual(5);
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 5 Tache 2.1.13 -- EmailService
SMTP_HOST=localhost                              # Mailhog dev / SendGrid prod Sprint 35
SMTP_PORT=1025                                   # 1025 dev / 587 STARTTLS prod
SMTP_SECURE=false                                # false dev / true prod (TLS)
SMTP_USER=                                       # empty dev / SendGrid API key prod
SMTP_PASSWORD=
SMTP_FROM_ADDRESS=noreply@skalean.ma
SMTP_FROM_NAME=Skalean InsurTech
SMTP_REPLY_TO=support@skalean.ma
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
MAILHOG_API_URL=http://localhost:8025            # dev only
FRONTEND_BASE_URL=https://app.skalean.ma
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/comm add nodemailer@6.9.16 handlebars@4.7.8
pnpm --filter @insurtech/comm add -D @types/nodemailer@6.4.17
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:integration   # requires Mailhog running
pnpm --filter @insurtech/comm build
```

---

## 10. Criteres validation V1-V32

### P0 (22)

- V1-V3 : typecheck, build, tests pass.
- V4 : EmailService expose 10+ methods.
- V5 : sendVerification appelle sendMail avec subject "Verifiez votre email".
- V6 : sendVerification URL-encode le token.
- V7 : sendPasswordReset utilise TTL 1h dans template.
- V8 : sendPasswordChangedNotification inclut IP et user_agent.
- V9 : sendAccountLockedNotification inclut tier et recovery URL.
- V10 : Layout RTL applique pour ar-MA.
- V11 : Layout LTR applique pour fr-MA, en, fr-FR.
- V12 : Multipart HTML + plain text via htmlToText.
- V13 : Plain text strip styles et scripts.
- V14 : Headers X-Skalean-Template + X-Skalean-Locale set.
- V15 : From = "Skalean InsurTech <noreply@skalean.ma>".
- V16 : Logger masque l'email dans les logs.
- V17 : Aucun log de token en clair.
- V18 : Fallback fr-MA pour locale missing.
- V19 : 40 templates presents (10 x 4 locales).
- V20 : Subject localized par locale.
- V21 : Pool SMTP config maxConnections=5.
- V22 : Helpers Handlebars formatDate, isRtl, shortenUA, frontendUrl enregistres.

### P1 (7)

- V23 : Coverage >= 88%.
- V24 : No-emoji.
- V25 : No-console.
- V26 : Mailhog integration test passe.
- V27 : Documentation README package comm.
- V28 : Templates < 80 KB HTML pour eviter Gmail clip.
- V29 : Bench send < 500 ms p99 (mock SMTP).

### P2 (3)

- V30 : Tests verify HTML rendering W3C valid.
- V31 : Templates accessibility WCAG AA (contraste, alt text).
- V32 : Sprint 35 SendGrid migration plan documente.

---

## 11. Edge cases (12)

1. **SMTP host down** : sendMail throw, propage. Sprint 14 retry queue.
2. **Template locale missing** : fallback fr-MA + warning log.
3. **Variable Handlebars manquante** : Handlebars rendre vide. Test verifie tous les vars passees.
4. **Email size > 102 KB Gmail clip** : monitoring template size.
5. **RTL caractere ZWJ ar-MA** : test rendering Mailhog.
6. **HTML invalide dans variable** : Handlebars auto-escape, defense XSS.
7. **Connection pool exhausted** : Sprint 14 augmente.
8. **Bounce hard / soft** : Sprint 14 bounce handler.
9. **DKIM signature missing** : Sprint 35 DNS config.
10. **Reply-To different From** : Convention Skalean configure.
11. **Charset UTF-8 misconfigured** : Nodemailer auto Base64 encode subject.
12. **Locale 'es-ES' or other** : fallback fr-MA ou error explicit.

---

## 12. Conformite Maroc

- Loi 09-08 article 28 : breach 72h notification email envoye via sendSecurityAlert.
- Loi 53-05 article 6 : signature numerique email pour preuve juridique Sprint 14+.
- ACAPS circulaire 2024 : notification compte locked obligatoire (sendAccountLockedNotification).
- DKIM/SPF/DMARC : Sprint 35 DNS config Atlas Cloud Services Benguerir.

---

## 13. Conventions absolues

Multi-tenant : tenant_id pas necessaire dans EmailService (recipient = email user). Validation : indirecte via TypeScript types. Logger Pino : email masque, no token. pnpm. TS strict. Tests 30+. Skalean AI : aucun. No-emoji. Idempotency : non applicable (envois). Cloud souverain : Sprint 35 Atlas/SendGrid. Crypto : aucun (HTTPS pour SMTP). JSDoc. Performance : send < 500ms.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:coverage

grep -rP "[\x{1F300}-\x{1F9FF}]" packages/comm/src && exit 1 || echo OK
grep -rn "console\.log" packages/comm/src --include="*.ts" && exit 1 || echo OK

# Verify all 40 templates present
LOCALES="fr-MA ar-MA en fr-FR"
TEMPLATES="verify-email password-reset password-changed account-locked account-unlocked mfa-enabled mfa-disabled security-alert recovery-completed suspicious-login"
for L in $LOCALES; do
  for T in $TEMPLATES; do
    [ -f "packages/comm/src/templates/$L/$T.hbs" ] || (echo "MISSING $L/$T.hbs" && exit 1)
  done
done
echo "All 40 templates present"
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-05): implement EmailService Nodemailer + Handlebars 40 templates 4 locales

Implements transactional email service via Nodemailer SMTP transport with
connection pool + Handlebars templating. 10 templates (verify-email,
password-reset, password-changed, account-locked, account-unlocked,
mfa-enabled, mfa-disabled, security-alert, recovery-completed,
suspicious-login) localized in 4 languages (fr-MA, ar-MA RTL, en, fr-FR).
Shared layout _layout.hbs with Skalean branding, helpers (formatDate,
isRtl, shortenUA), multipart HTML + plain text fallback, email masking
in logs, Mailhog dev integration. 12+ public methods covering all auth
notifications.

Livrables :
- EmailService (12 methods, ~450 lines)
- email.helpers (htmlToText, shortenUserAgent, isValidEmail, URL builders)
- 40 templates Handlebars (10 templates x 4 locales)
- Layout shared with RTL support
- 30+ tests (unit + Mailhog integration)
- CommModule (NestJS Global)

Tests : 25 service + 8 helpers + 6 integration = 39 tests
Coverage : >= 88%

Task: 2.1.13
Sprint: 5 (Phase 2 / Sprint 1)
Reference: B-05 Tache 2.1.13
Decisions: decision-009 (multi-locale), decision-018 (Handlebars)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.14-rate-limiting-auth.md` qui implementera @Throttle decorators sur endpoints auth-sensibles avec custom tracker IP+email pour signin.

---

## Annexe A. Production migration plan SendGrid Sprint 35

Sprint 35 migrera de SMTP self-hosted vers SendGrid Transactional API pour scaling :

```typescript
// Sprint 35 : SendGrid integration
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// Replace transporter.sendMail with sgMail.send
const result = await sgMail.send({
  to: input.to,
  from: { email: this.fromAddress, name: this.fromName },
  subject,
  html: fullHtml,
  text: htmlToText(fullHtml),
  customArgs: {
    template: input.template,
    locale: input.locale,
    user_id: input.user_id,
  },
  trackingSettings: {
    clickTracking: { enable: true },
    openTracking: { enable: true },
  },
});
```

Avantages SendGrid Sprint 35 :
- API HTTPS (pas SMTP) -- 50ms latency vs 200-500ms.
- Tracking open / click natif.
- Bounce / spam complaint webhooks.
- DKIM/SPF auto-configure.
- Volume scaling jusqu'a 1M emails/mois.

Cost estime production : ~500 EUR/mois pour 100k emails (vs cost SMTP self-hosted infrastructure ~200 EUR/mois mais sans tracking).

## Annexe B. Bounce handling Sprint 14

```typescript
// Sprint 14 BounceWebhookController
@Post('webhook/sendgrid/bounce')
async handleBounce(@Body() events: SendGridEvent[]) {
  for (const event of events) {
    if (event.event === 'bounce' || event.event === 'dropped') {
      await this.userRepo.markEmailUndeliverable(event.email);
      await this.auditAuth.logEmailBounce({
        email: event.email,
        reason: event.reason,
        type: event.bounce_type,
      });
    }
  }
  return { status: 'ok' };
}
```

## Annexe C. Performance benchmarks attendus

```
EmailService.send (mock SMTP):       median 5 ms    (p99: 15 ms)  -- template render dominate
EmailService.send (Mailhog SMTP):    median 50 ms   (p99: 150 ms)
EmailService.send (SendGrid API):    median 80 ms   (p99: 200 ms) -- HTTPS round-trip
htmlToText (5 KB HTML):              median 2 ms    (p99: 8 ms)
shortenUserAgent:                    median 0.05 ms (p99: 0.2 ms)
Template cache hit:                  median 0.1 ms  (p99: 0.5 ms)
Template cache miss + compile:       median 5 ms    (p99: 15 ms)
```

---

## Annexe D. Templates supplementaires complete (en + fr-FR + ar-MA)

### D.1 password-changed.hbs (en)

```handlebars
<h2>Hello {{display_name}},</h2>

<p>Your Skalean InsurTech password has just been changed.</p>

<div class="alert-box">
  <p style="margin: 0 0 10px;"><strong>Did you initiate this change?</strong></p>
  <p style="margin: 0;"><strong>If YES:</strong> no action required. You can now sign in with your new password.</p>
  <p style="margin: 10px 0 0;"><strong>If NO:</strong> your account may be compromised. Take action immediately.</p>
</div>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{support_url}}" class="button-danger">Contact security support</a>
</p>

<div class="meta-info">
  <p style="margin: 0 0 8px;"><strong>Change details:</strong></p>
  <p style="margin: 0 0 4px;">Date : {{formatDate changed_at}}</p>
  <p style="margin: 0 0 4px;">IP address : {{ip}}</p>
  <p style="margin: 0 0 4px;">Location : {{geo_country}}</p>
  <p style="margin: 0;">Browser : {{shortenUA user_agent}}</p>
</div>
```

### D.2 password-changed.hbs (ar-MA RTL)

```handlebars
<h2>السلام {{display_name}},</h2>

<p>كلمة السر ديالك في Skalean InsurTech تبدلات.</p>

<div class="alert-box">
  <p style="margin: 0 0 10px;"><strong>واش انت لي بدلتي ؟</strong></p>
  <p style="margin: 0;"><strong>إذا واخا :</strong> ما عندك ما دير. تقدر تدخل بالكلمة الجديدة.</p>
  <p style="margin: 10px 0 0;"><strong>إذا لا :</strong> الحساب ديالك ممكن يكون متعرض. درك:</p>
</div>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{support_url}}" class="button-danger">كلم الدعم الأمني</a>
</p>

<div class="meta-info">
  <p style="margin: 0 0 8px;"><strong>تفاصيل التغيير :</strong></p>
  <p style="margin: 0 0 4px;">التاريخ : {{formatDateAr changed_at}}</p>
  <p style="margin: 0 0 4px;">عنوان IP : {{ip}}</p>
  <p style="margin: 0 0 4px;">الموقع : {{geo_country}}</p>
  <p style="margin: 0;">المتصفح : {{shortenUA user_agent}}</p>
</div>
```

### D.3 account-locked.hbs (ar-MA)

```handlebars
<h2>السلام {{display_name}},</h2>

<p>لأسباب أمنية، الحساب ديالك في Skalean InsurTech تسد مؤقتا بعد عدة محاولات دخول فاشلة.</p>

<div class="alert-box">
  <p style="margin: 0;"><strong>مستوى السد :</strong> Tier {{tier}}</p>
  <p style="margin: 8px 0 0;"><strong>الفتح التلقائي :</strong> {{formatDateAr locked_until}}</p>
</div>

<p>تقدر تجدد كلمة السر ديالك باش تفتح الحساب في الحين :</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{recovery_url}}" class="button">جدد كلمة السر</a>
</p>

<div class="meta-info">
  <p style="margin: 0;"><strong>آخر محاولة من :</strong> {{last_failure_ip}}</p>
</div>

<p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
  إذا هاد المحاولات ما جاتش منك، الحساب ديالك مستهدف. كلم <a href="{{support_url}}">الدعم</a>.
</p>
```

### D.4 mfa-enabled.hbs (en)

```handlebars
<h2>Hello {{display_name}},</h2>

<p>Two-factor authentication (MFA) has just been enabled on your Skalean InsurTech account.</p>

<div class="success-box">
  <p style="margin: 0;"><strong>Enhanced security:</strong> your account is now protected by a second authentication factor.</p>
</div>

<p>You received <strong>{{recovery_codes_count}} recovery codes</strong> during setup. These codes allow you to sign in if you lose your authenticator device.</p>

<div class="alert-box">
  <p style="margin: 0;"><strong>Important:</strong> Store these codes in a safe place (password manager, secure vault). Each code can only be used once.</p>
</div>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{manage_mfa_url}}" class="button">Manage my MFA settings</a>
</p>

<p style="color: #6b7280; font-size: 13px; margin-top: 30px;">
  If you did not enable MFA, your account may be compromised. Contact support immediately.
</p>
```

### D.5 security-alert.hbs (ar-MA)

```handlebars
<h2>تنبيه أمني -- {{display_name}}</h2>

<div class="danger-box">
  <p style="margin: 0;"><strong>نشاط مشبوه تكتشف على الحساب ديالك.</strong></p>
</div>

<p><strong>الإشارة المكتشفة :</strong> {{signal}}</p>

<p><strong>الإجراء الموصى :</strong> {{action_required}}</p>

<p style="text-align: center; margin: 30px 0;">
  <a href="{{change_password_url}}" class="button-danger">بدل كلمة السر</a>
</p>

<p>إذا كنتي عارف هاد النشاط (مثلا سفر، جهاز جديد)، ما عندك ما دير. واخا، درك بسرعة :</p>

<ol>
  <li>بدل كلمة السر ديالك في الحين.</li>
  <li>شيك الجلسات النشطة وعطل الجلسات المجهولة.</li>
  <li>فعل التحقق بخطوتين إذا ما فعلتيهش بعد.</li>
  <li>كلم <a href="{{support_url}}">الدعم الأمني</a> إذا لزم.</li>
</ol>
```

## Annexe E. Validation HTML email cross-clients

Les templates Skalean InsurTech sont testes contre les principaux clients email pour garantir un rendu coherent :

| Client | Inline CSS | Media queries | Custom fonts | Web fonts |
|--------|------------|---------------|---------------|-----------|
| Gmail web | OK | Limited support | Sometimes | Sometimes |
| Gmail mobile (iOS/Android) | OK | OK | OK | OK |
| Outlook 2016 desktop | Required | Limited | Fallback | No |
| Outlook 2019/365 desktop | Required | Limited | Fallback | No |
| Outlook web | OK | OK | OK | OK |
| Apple Mail iOS | OK | OK | OK | OK |
| Apple Mail macOS | OK | OK | OK | OK |
| Yahoo Mail | OK | OK | OK | OK |
| Thunderbird | OK | OK | OK | OK |

Patterns appliques :
- Inline CSS via Premailer-equivalent (Sprint 13 considera juice ou inline-css npm pkg).
- Tables HTML pour layout (compat Outlook).
- Web-safe fonts en fallback.
- No JavaScript, no embedded video.
- Images hosted on CDN avec alt text.
- Max width 600px.
- Dark mode prefers-color-scheme media query.

Sprint 14 ajoutera tests automatises Litmus / Email on Acid pour rendering cross-clients.

## Annexe F. Localizations supplementaires (templates 4 locales summary)

Pour eviter la duplication, voici les sujets et phrases cles dans les 4 locales pour chaque template :

| Template | fr-MA | ar-MA | en | fr-FR |
|----------|-------|-------|-----|--------|
| verify-email.subject | Verifiez votre email Skalean InsurTech | وكد ايميلك ديال Skalean InsurTech | Verify your Skalean InsurTech email | Verifiez votre email Skalean InsurTech |
| password-reset.subject | Reinitialisation de votre mot de passe | تجديد كلمة السر ديالك | Reset your password | Reinitialisation de votre mot de passe |
| password-changed.subject | Votre mot de passe a ete modifie | كلمة السر ديالك تبدلات | Your password was changed | Votre mot de passe a ete modifie |
| account-locked.subject | Compte temporairement bloque | الحساب ديالك تسد مؤقتا | Account temporarily locked | Compte temporairement bloque |
| account-unlocked.subject | Compte debloque | الحساب ديالك تحلل | Account unlocked | Compte debloque |
| mfa-enabled.subject | Authentification a deux facteurs activee | تفعيل التحقق بخطوتين | Two-factor authentication enabled | Authentification a deux facteurs activee |
| mfa-disabled.subject | Authentification a deux facteurs desactivee | تعطيل التحقق بخطوتين | Two-factor authentication disabled | Authentification a deux facteurs desactivee |
| security-alert.subject | Alerte securite Skalean | تنبيه أمني Skalean | Skalean security alert | Alerte securite Skalean |
| recovery-completed.subject | Mot de passe reinitialise | تم تجديد كلمة السر | Password reset successfully | Mot de passe reinitialise |
| suspicious-login.subject | Activite de connexion suspecte | نشاط دخول مشبوه | Suspicious login activity | Activite de connexion suspecte |

## Annexe G. Pre-warm cache strategy at deployment

Pour eviter le cold-start de la premiere requete email apres deploiement :

```typescript
// Sprint 13 : EmailService.onModuleInit warm cache
async warmTemplateCache(): Promise<void> {
  const locales = ['fr-MA', 'ar-MA', 'en', 'fr-FR'] as const;
  const templates = [
    'verify-email', 'password-reset', 'password-changed',
    'account-locked', 'account-unlocked',
    'mfa-enabled', 'mfa-disabled',
    'security-alert', 'recovery-completed', 'suspicious-login',
  ] as const;

  // Compile all 40 templates at startup
  for (const locale of locales) {
    for (const template of templates) {
      const key = `${locale}:${template}`;
      try {
        const compiled = this.loadAndCompile(locale, template);
        this.templateCache.set(key, compiled);
      } catch (err) {
        this.logger.warn({ locale, template, err: err instanceof Error ? err.message : err }, 'Template compile failed at warm');
      }
    }
  }
  this.logger.log({
    action: 'template_cache_warmed',
    cached_templates: this.templateCache.size,
  });
}
```

Pre-warm reduit la premiere latency email send de ~50ms (compile cache miss) a ~5ms (cache hit). Critique en production Sprint 35 ou les emails sont sends en burst (e.g., 100 signins en parallel apres deployment).

## Annexe H. Bounce handling Sprint 14 SendGrid webhook

Sprint 14 ajoutera un controleur webhook pour les bounces SendGrid :

```typescript
// Sprint 14 : repo/apps/api/src/modules/email/sendgrid-webhook.controller.ts
import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator.js';
import { EmailService } from '@insurtech/comm';
import { UserRepository } from '../user/user.repository.js';
import { AuditAuthService } from '../auth/services/audit-auth.service.js';

interface SendGridEvent {
  email: string;
  timestamp: number;
  event: 'delivered' | 'bounce' | 'dropped' | 'spamreport' | 'unsubscribe';
  reason?: string;
  type?: string;
  sg_message_id: string;
  category?: string[];
}

@Controller({ path: 'webhook/sendgrid', version: '1' })
export class SendGridWebhookController {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly auditAuth: AuditAuthService,
  ) {}

  @Public()
  @Post('events')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'SendGrid event webhook (Sprint 14)' })
  async handleEvents(
    @Body() events: SendGridEvent[],
    @Headers('x-twilio-email-event-webhook-signature') signature: string,
  ) {
    // Sprint 14 : verify signature via HMAC
    // for now, basic processing

    for (const event of events) {
      if (event.event === 'bounce' || event.event === 'dropped') {
        await this.handleBounce(event);
      } else if (event.event === 'spamreport') {
        await this.handleSpamReport(event);
      }
    }

    return { status: 'ok', processed: events.length };
  }

  private async handleBounce(event: SendGridEvent): Promise<void> {
    const user = await this.userRepo.findByEmail(event.email);
    if (!user) return;

    await this.userRepo.markEmailUndeliverable(user.id, {
      bounce_type: event.type ?? 'unknown',
      bounce_reason: event.reason ?? '',
      bounced_at: new Date(event.timestamp * 1000),
    });

    await this.auditAuth.logEmailBounce({
      tenant_id: user.tenant_id,
      user_id: user.id,
      user_email: user.email,
      bounce_type: event.type ?? 'unknown',
      reason: event.reason ?? '',
    });
  }

  private async handleSpamReport(event: SendGridEvent): Promise<void> {
    const user = await this.userRepo.findByEmail(event.email);
    if (!user) return;

    // Flag user pour spam report -- ne plus envoyer marketing
    await this.userRepo.flagSpamReport(user.id);
  }
}
```

## Annexe I. Email tracking pixel Sprint 22

Sprint 22 (Analytics) ajoutera un pixel de tracking optionnel pour mesurer open rate :

```handlebars
{{!-- Sprint 22 : tracking pixel injected before footer --}}
<img src="{{tracking_pixel_url}}" width="1" height="1" style="display:none;" alt="" />
```

```typescript
// Sprint 22 : compute tracking pixel URL with HMAC signature
private buildTrackingPixelUrl(messageId: string, recipient: string): string {
  const hash = this.hashing.hmacSha256(`${messageId}:${recipient}`, this.config.get('TRACKING_HMAC_KEY')!);
  return `${this.config.get('FRONTEND_BASE_URL')}/track/email/open?mid=${encodeURIComponent(messageId)}&sig=${hash}`;
}
```

L'endpoint `/track/email/open` enregistre l'open et retourne un PNG 1x1 transparent.

---

**Fin du prompt task-2.1.13-email-service.md.**
