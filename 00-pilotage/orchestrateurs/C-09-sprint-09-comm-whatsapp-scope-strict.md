# ORCHESTRATEUR SPRINT 9 v3.0 -- Phase 2 / Sprint 7 : Comm WhatsApp Scope Strict + Email Data Sensible
# 10 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (REFONTE critique v2.2 -- correction Saad terrain #7 CNDP)
**Phase** : 2 -- Securite + Infrastructure
**Sprint** : 9 / 40 (cumul v3.0) -- Phase 2 Sprint 7
**Reference meta-prompt** : `B-09-sprint-09-comm-whatsapp-scope-strict-v3.md`
**Reference verification** : `V-09-sprint-09-verification.md`
**Numerotation taches** : 2.7.1 a 2.7.10
**Effort total** : ~45 heures developpement / 1 semaine
**Priorite** : P0 CRITIQUE LEGAL (correction Saad terrain #7 -- conformite CNDP loi 09-08)
**Apport metier** : Module Comm avec scope strict canal (correction Saad #7 absolue)

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer **TOUTES les 10 taches** du Sprint 9 v3.0 **UNE PAR UNE** dans l'ordre defini ci-dessous, puis lancer la verification automatique du sprint.

**Cet orchestrateur extrait le contenu detaille de chaque tache depuis B-09 v3.0** -- pour code complet, patterns critiques whitelist/blacklist enforcement et tests exhaustifs, lire le meta-prompt B-09 reference dans chaque tache.

**REFONTE CRITIQUE v3.0** par rapport a v2.2 :
- WhatsApp = **STATUS ONLY absolument** (whitelist 45 templates + blacklist 15 patterns server-side)
- Email = primary canal data sensible (DKIM/SPF/DMARC + multilingue 4 langues)
- Push = milestones courts mobile (pas data sensible lockscreen)
- SMS = **OTP only** (2FA authentication uniquement)
- Audit ACAPS 10 ans + phone hash SHA256 (no plain phone)
- Coverage Sprint 9 >= 90% (vs 85% standard) car critique correction Saad #7

---

## OBJECTIF DU SPRINT 9 v3.0

Sprint 9 (2.7) -- Comm WhatsApp Scope Strict + Email Data Sensible. Voir B-09 v3.0 pour contexte detaille.

Module package `@insurtech/comm` (NOUVEAU v3.0) qui orchestre 4 canaux avec **scope strict canal** -- correction critique Saad #7 (CNDP loi 09-08 protection donnees personnelles + risque social engineering Maroc).

**Architecture 4 canaux** :
1. **WhatsApp** (Meta Cloud API) -- STATUS ONLY + whitelist 45 templates + blacklist 15 patterns server-side
2. **Email** (SendGrid + Mailjet fallback) -- data sensible OK + DKIM/SPF/DMARC + multilingue 4 langues
3. **Push** (Expo + FCM + APNs) -- milestones courts mobile, pas data sensible
4. **SMS** (Twilio + Orange Maroc fallback) -- OTP only (2FA authentication)

---

## STRUCTURE DES FICHIERS

**Prompts des taches** (a executer en sequence) :
```
skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/
  task-2.7.1-prompt.md   # Package @insurtech/comm + types + schemas + constants whitelist/blacklist
  task-2.7.2-prompt.md   # CRITIQUE WhatsApp service scope strict 7 etapes enforcement
  task-2.7.3-prompt.md   # Templates WhatsApp Handlebars 45 + sync Meta Business Manager (180 variantes)
  task-2.7.4-prompt.md   # Email service data sensible + DKIM/SPF/DMARC + fallback Mailjet
  task-2.7.5-prompt.md   # Push notifications mobile Expo + FCM + APNs
  task-2.7.6-prompt.md   # SMS OTP only service (Twilio + Orange Maroc fallback)
  task-2.7.7-prompt.md   # Notification Router multi-canal content_type logic
  task-2.7.8-prompt.md   # Audit ACAPS notifications + traceability 10 ans + phone_hash
  task-2.7.9-prompt.md   # Endpoints REST + permissions customer.notifications.manage
  task-2.7.10-prompt.md  # Tests E2E 30+ + 8+ blacklist CRITIQUES + benchmarks
```

**Verification du sprint** (a lancer APRES toutes les taches) :
```
skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-09-sprint-09-verification.md
```

**Code source modifie** : `skalean-insurtech/repo/` (jamais 00-pilotage/)

**Decisions strategiques applicables** : voir `00-pilotage/decisions/` -- decision-006 (no-emoji), decision-008 (data residency + multilingue), correction-saad-terrain-#7 (CNDP)

---

## REGLES D'EXECUTION CRITIQUES

### Execution sequentielle obligatoire

Tu DOIS attendre qu'une tache soit COMPLETEMENT TERMINEE avant de demarrer la suivante :
1. **Lire** le fichier prompt de la tache
2. **Implementer** TOUT le code demande dans `repo/packages/comm/` et `repo/apps/api/`
3. **Compiler** (`pnpm tsc --noEmit` -- 0 erreur)
4. **Tester** (`pnpm vitest run packages/comm` -- tous tests PASS)
5. **Linter** (`pnpm lint` -- 0 erreur)
6. **Commit** Conventional Commits (`git add -A && git commit`)
7. **SEULEMENT APRES** le commit, passer a la tache suivante

Raison : les taches ont des **dependances** entre elles. La tache N peut importer du code cree par la tache N-1 (notamment Tache 2.7.2 WhatsApp service depend des constants Tache 2.7.1). Executer en parallele creerait des conflits irreconciliables.

### Si une tache echoue

1. Tente de **reparer l'erreur** (3 tentatives maximum)
2. Si impossible, **note l'erreur** dans le rapport et **passe** a la tache suivante
3. **N'arrete JAMAIS** l'execution du sprint entier -- continue les taches restantes
4. La verification finale V-09 identifiera taches FAIL pour reprise ciblee

### Verification finale automatique

Apres la 10eme tache, lancer **automatiquement** :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-09-sprint-09-verification.md
```

Le script bash auto-reparation V-09 verifie 61+ criteres (10 taches + 7 transversaux + 4 CNDP) et produit `sprint09-verify-report.md`.

**Jalon critique** : sans GO V-09 (>= 95%), tous downstream (Sprints 14/17/18/21/22.5/22.7/24/26.5) restent v2.2 non-conforme CNDP -- risque legal absolu Demo Day 30 juin 2026.

---

## REGLES ABSOLUES skalean-insurtech v3.0 (a appliquer dans CHAQUE tache)

### Conventions techniques

- **TypeScript strict** + pnpm + monorepo workspace
- **Package @insurtech/*** : utiliser uniquement les imports `@insurtech/auth`, `@insurtech/database`, `@insurtech/comm` (workspace protocol)
- **AUCUNE EMOJI** absolument -- decision-006 (templates Handlebars + code TS + commits)
- **Conventional Commits lowercase** + body <= 200 chars + footer obligatoire (`Task:` + `Sprint:` + `Phase:` + `Decisions:`)
- **Pino logs structures** uniquement (pas de console.log/error)
- **Zod validation** pour tous les DTO/inputs
- **Vitest tests** par service (.spec.ts) + coverage >= 90% Sprint 9
- **Multi-tenant strict** : tous les services prennent `tenantId` parametre
- **RLS PostgreSQL FORCE** : verifier dans migrations

### Specifique Sprint 9 v3.0

- **BLACKLIST server-side enforced** : `sendWhatsAppStatus()` THROW BadRequestException si data contient amount/cin/total_mad/token/password/iban/cvv/devis_total/franchise/honoraire (15 patterns)
- **WHITELIST 45 templates** : STATUS_ONLY_TEMPLATES enforced dans `isTemplateWhitelisted()`
- **Email = data sensible primary** : tous montants/CIN/IBAN passent par Email (jamais WhatsApp)
- **Multilingue 4 langues** : fr + ar classique + ar-MA darija + en (auto-detect user.preferred_language + fallback fr)
- **Rate limiting** : 10 WhatsApp/heure/user + 100 emails/heure/user (Redis-based)
- **Audit ACAPS chaque envoi** : channel + template + recipient_hash + tenant_id + message_id + correlation_id + duration_ms -- 10 ans retention
- **Phone hash SHA256 16 chars** : `crypto.createHmac('sha256', PHONE_HASH_SECRET).update(phone).digest('hex').substring(0, 16)` -- jamais plain phone dans audits/logs
- **Permissions Sprint 7.5a** : `customer.notifications.manage` enforce sur endpoints management
- **Style code** : `export const Permission = {...} as const` -- jamais `enum` (heritage 7.5a)

### Conformite InsurTech Maroc (8 lois critique Sprint 9)

- **Loi 09-08 CNDP** : protection donnees personnelles (article 12-14 traitement loyaux + finalite definie) -- correction Saad #7 absolu
- **Loi ACAPS** : retention 10 ans toute communication assurance + audit logs
- **Loi 43-20 signature electronique** : indirectement Sprint 10
- **ANRT (Telecoms)** : SMS via providers homologues Maroc (Orange + Twilio)
- **Meta WhatsApp Business Policy** : compliance templates UTILITY + AUTHENTICATION (pas MARKETING en v3.0)
- **Decret 2-09-165** : centralisation registre traitement donnees CNDP -- audit ACAPS suffit
- **Bank Al-Maghrib (BAM)** : pas Sprint 9 specifiquement (Sprint 11 Pay)
- **DGI fiscalite** : pas Sprint 9 (Sprint 12 Books)

---

## CONTEXTE PHASE 2 -- Securite + Infrastructure

### Position du Sprint 7 dans la Phase 2

Sprint 9 (2.7) -- **Comm WhatsApp Scope Strict + Email Data Sensible** -- suit Sprint 8 (CRM + Booking) et precede Sprint 10 (Docs + Signature Barid eSign).

C'est le **6eme sprint critique de Phase 2 Securite** apres Sprints 5 (Auth), 6 (Multi-tenant), 7 (RBAC), 7.5a (Foundation Decision Pack), 7.5b (Decision Engine), 8 (CRM + Booking).

### Modules concernes par cette Phase

`@insurtech/comm` (NOUVEAU package v3.0), `apps/api/src/modules/comm/`, `infrastructure/email-templates/`, `infrastructure/whatsapp-templates/` (Handlebars 180 variantes).

### Apport metier de ce sprint

Communication multi-canal robuste avec **conformite CNDP absolue** (correction Saad terrain #7). Reduit le risque interception data sensible via WhatsApp (serveurs Meta USA viole loi 09-08) + risque social engineering escrocs Maroc qui manipulent montants visibles sur ecrans messagerie.

**Impact downstream** : Sprint 9 v3.0 GO conditionne tous Sprints 14+17+18+21+22.5+22.7+24+26.5 (10 sprints downstream dependent du module Comm scope strict pour notifications carrier/customer/assure/tow/expert).

### Decisions strategiques applicables

- **decision-006** : NO emoji policy (templates Handlebars + code)
- **decision-008** : Data residency Maroc + multilingue 4 langues (fr/ar/ar-MA/en)
- **correction Saad terrain #7** : WhatsApp scope strict CNDP -- documentation conformite obligatoire
- **decision-015** : Demo Day 30 juin 2026 -- jalon Phase Pilote (Sprint 9 GO = pre-requis)

---

## EXECUTION SEQUENTIELLE DES 10 TACHES

---

### Tache 1 / 10 : Package @insurtech/comm + types + schemas + constants whitelist/blacklist

**Metadonnees** : P0 | 4h | Depend de : Sprint 8

**But** : Bootstrap package `@insurtech/comm` avec types pour 4 canaux + schemas Zod validation + constants STATUS_ONLY_TEMPLATES (45 templates whitelist) + BLACKLISTED_FIELD_PATTERNS (15 patterns server-side enforcement).

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.1-prompt.md
```

**Actions principales attendues** :

- Creer dossier `repo/packages/comm/` (workspace package monorepo pnpm)
- `package.json` avec name `@insurtech/comm` + dependencies (zod + handlebars + pino + node-fetch + axios + nodemailer + expo-server-sdk + firebase-admin + @parse/node-apn + twilio)
- `tsconfig.json` aligne workspace (extends `../../tsconfig.base.json`)
- `src/types/` 4 fichiers types : `whatsapp.types.ts` + `email.types.ts` + `push.types.ts` + `sms.types.ts`
- `src/schemas/` 4 fichiers Zod : `send-whatsapp.schema.ts` + `send-email.schema.ts` + `send-push.schema.ts` + `send-otp.schema.ts`
- `src/constants/status-only-templates.ts` exportant STATUS_ONLY_TEMPLATES const avec 6 categories (repair=9 + insure=6 + customer=12 + assure=8 + tow=6 + expert=4 = 45 total)
- `src/constants/blacklisted-fields.ts` exportant BLACKLISTED_FIELD_PATTERNS const array avec 15 patterns minimum (money: amount/price/total_mad/total/devis_total/franchise/honoraire/reimbursement + identity: cin/passport/national_id + banking: iban/cvv + auth: token/password)
- Helper `isBlacklistedField(fieldName: string): boolean` exportant verification recursive deep-scan
- Helper `ALL_STATUS_TEMPLATES` qui aplatit STATUS_ONLY_TEMPLATES (verify length === 45 compile-time)
- `src/index.ts` exportant tous symboles publics
- `vitest.config.ts` + 4 tests bootstrap (`bootstrap.spec.ts`) : verify package builds + STATUS_ONLY_TEMPLATES.length === 45 + BLACKLISTED_FIELD_PATTERNS.length >= 15 + isBlacklistedField('amount') === true

**Fichiers cibles principaux** :
- `repo/packages/comm/package.json`
- `repo/packages/comm/tsconfig.json`
- `repo/packages/comm/src/types/whatsapp.types.ts`
- `repo/packages/comm/src/types/email.types.ts`
- `repo/packages/comm/src/types/push.types.ts`
- `repo/packages/comm/src/types/sms.types.ts`
- `repo/packages/comm/src/schemas/send-whatsapp.schema.ts`
- `repo/packages/comm/src/schemas/send-email.schema.ts`
- `repo/packages/comm/src/schemas/send-push.schema.ts`
- `repo/packages/comm/src/schemas/send-otp.schema.ts`
- `repo/packages/comm/src/constants/status-only-templates.ts`
- `repo/packages/comm/src/constants/blacklisted-fields.ts`
- `repo/packages/comm/src/index.ts`
- `repo/packages/comm/vitest.config.ts`
- `repo/packages/comm/src/__tests__/bootstrap.spec.ts`

**Criteres P0 cles** (verifies par V-09 Tache 1) :
- V1 (P0) : Package @insurtech/comm structure complete + build OK
- V2 (P0) : STATUS_ONLY_TEMPLATES exporte avec ALL_STATUS_TEMPLATES.length === 45 (verify runtime)
- V3 (P0) : BLACKLISTED_FIELD_PATTERNS exporte avec length >= 15 minimum
- V4 (P0) : Helper isBlacklistedField('amount') returns true (recursive deep-scan)
- V5 (P0) : Zod schemas validation SendWhatsAppStatus + SendEmail + SendPush + SendOtp
- V6 (P0) : TypeScript strict zero erreur (`pnpm tsc --noEmit`)
- V7 (P0) : Tests bootstrap 4+ PASS (verify counts + exports)

**Validation** :
```bash
cd repo/packages/comm
pnpm install
pnpm tsc --noEmit
pnpm build
pnpm vitest run
# Verification runtime
node -e "
const c = require('./dist/index.js');
console.log('Templates total:', c.ALL_STATUS_TEMPLATES.length);
console.log('Blacklist patterns:', c.BLACKLISTED_FIELD_PATTERNS.length);
console.log('isBlacklisted amount:', c.isBlacklistedField('amount'));
console.log('isBlacklisted safe field:', c.isBlacklistedField('first_name'));
"
# Attendu:
# Templates total: 45
# Blacklist patterns: 15
# isBlacklisted amount: true
# isBlacklisted safe field: false
cd ../../..
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): package @insurtech/comm + types + schemas + constants

- 4 canaux (WhatsApp + Email + Push + SMS) types/schemas Zod
- STATUS_ONLY_TEMPLATES whitelist 45 templates (6 categories)
- BLACKLISTED_FIELD_PATTERNS 15 patterns server-side
- Helper isBlacklistedField() recursive deep-scan
- Tests bootstrap 4+ PASS

Task: 2.7.1
Sprint: 9 (Phase 2 / Sprint 7)
Phase: 2 -- Securite + Infrastructure
Decisions: correction saad #7 + decision-008 cndp"
```

---

### Tache 2 / 10 : CRITIQUE WhatsApp service scope strict 7 etapes enforcement

**Metadonnees** : P0 CRITIQUE LEGAL | 8h | Depend de : 2.7.1

**But CRITIQUE** : Service WhatsApp avec enforcement strict 7 etapes -- aucune fuite data sensible possible. Correction Saad terrain #7 absolue. Throw BadRequestException si whitelist OR blacklist violation, ForbiddenException si rate limit.

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.2-prompt.md
```

**Actions principales attendues** :

- Service `whatsapp.service.ts` (~250 lignes) implementant `sendWhatsAppStatus(input)` avec 7 etapes :
  - **ETAPE 1 Whitelist check** : `isTemplateWhitelisted(templateName)` -> reject BadRequestException si not in ALL_STATUS_TEMPLATES (45)
  - **ETAPE 2 Blacklist check** : `detectBlacklistedFields(data)` recursive deep-scan -> reject BadRequestException si match 15 patterns (CRITIQUE LEGAL)
  - **ETAPE 3 Rate limiting** : Redis `wa:user:${userId}:hourly` consume 1 token, capacity 10/heure -> reject ForbiddenException si depasse
  - **ETAPE 4 Language fallback** : query `whatsapp_templates_registry` pour `(templateName, language)`, fallback fr si manquant
  - **ETAPE 5 Meta API call** : POST `https://graph.facebook.com/v18.0/{PHONE_ID}/messages` avec template+language+params, retry 3x exponential backoff
  - **ETAPE 6 Audit ACAPS log** : `notificationAuditService.logNotificationSent()` avec channel + templateName + recipientHash + tenantId + messageId + correlationId + durationMs
  - **ETAPE 7 Phone hash SHA256** : `hashPhone(phone)` -> `crypto.createHmac('sha256', PHONE_HASH_SECRET).update(phone).digest('hex').substring(0, 16)` -- jamais plain phone dans audit
- Service `rate-limiter.service.ts` Redis-based (`@insurtech/database/redis`) + sliding window
- Service `template-renderer.service.ts` Handlebars compile + render avec data context
- Entity `whatsapp-templates-registry.entity.ts` TypeORM (template_name + language + meta_template_id + status + synced_at)
- 20+ tests spec.ts : whitelist reject + blacklist 8+ scenarios + rate limit + language fallback + phone hash + audit log + Meta API mock

**Fichiers cibles principaux** :
- `repo/packages/comm/src/services/whatsapp.service.ts` (~250 lignes)
- `repo/packages/comm/src/services/whatsapp.service.spec.ts` (20+ tests CRITIQUES)
- `repo/packages/comm/src/services/rate-limiter.service.ts` (~80 lignes Redis-based)
- `repo/packages/comm/src/services/template-renderer.service.ts` (~120 lignes Handlebars)
- `repo/packages/comm/src/entities/whatsapp-templates-registry.entity.ts`
- `repo/packages/comm/src/__mocks__/meta-api.mock.ts` (pour tests)

**Criteres P0 cles** :
- V1 (P0 CRITIQUE LEGAL) : Whitelist enforcement actif -- `sendWhatsAppStatus({templateName:'unknown'})` throws "not in whitelist STATUS_ONLY_TEMPLATES"
- V2 (P0 CRITIQUE LEGAL) : Blacklist enforcement actif -- `sendWhatsAppStatus({data:{amount:'5000'}})` throws "Blacklist violation"
- V3 (P0 CRITIQUE LEGAL) : Blacklist scan recursive -- nested `{data:{payment:{amount:'5000'}}}` aussi rejected
- V4 (P0) : Rate limiting 10/heure -- 11eme appel throws ForbiddenException
- V5 (P0) : Audit ACAPS log obligatoire -- chaque envoi enregistre row dans `compliance_acaps_audits`
- V6 (P0) : Phone hash SHA256 16 chars -- jamais plain phone dans audit row
- V7 (P0) : Multilingue 4 langues + fallback fr si lang manquante
- V8 (P0) : Tests 20+ scenarios PASS dont **8+ blacklist** CRITIQUES (amount/cin/total_mad/iban/token/password/devis_total/nested)

**Validation** :
```bash
cd repo/packages/comm
pnpm vitest run src/services/whatsapp.service.spec.ts --reporter=verbose
# Verifier sortie: "20+ passed" + "blacklist violation" appara dans test names

# Verification manuelle CNDP penetration test
node -e "
const { WhatsAppService } = require('./dist');
const svc = new WhatsAppService(...);
svc.sendWhatsAppStatus({
  to: '+212600000000',
  templateName: 'customer_premium_due_j15',
  data: { amount: '5000' },
  language: 'fr',
  tenantId: 'test', userId: 'test'
}).catch(e => console.log('REJECTED OK:', e.message));
"
# Attendu: REJECTED OK: Blacklist violation: WhatsApp NEVER carries sensitive data...
cd ../../..
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): CRITIQUE whatsapp service scope strict 7 etapes enforcement

- Whitelist 45 templates STATUS_ONLY_TEMPLATES
- Blacklist 15 patterns server-side (amount/cin/total_mad/iban/...)
- Recursive deep-scan nested objects
- Rate limiting 10/heure/user Redis sliding window
- Multilingue 4 langues + fallback fr
- Audit ACAPS log every call (10 ans retention)
- Phone hash SHA256 16 chars (no plain phone)
- 20+ tests dont 8+ blacklist CRITIQUES

Task: 2.7.2
Sprint: 9 (Phase 2 / Sprint 7)
Phase: 2 -- Securite + Infrastructure
Decisions: correction saad terrain #7 cndp loi 09-08"
```

---

### Tache 3 / 10 : Templates WhatsApp Handlebars 45 + sync Meta Business Manager (180 variantes)

**Metadonnees** : P0 | 6h | Depend de : 2.7.2

**But** : Creation 45 templates Handlebars whitelist + sync Meta Business Manager (creation templates remote + recuperation templateId + status PENDING_APPROVAL) + 4 langues = 180 variantes total. Script CI verifie 0 variable dangereuse.

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.3-prompt.md
```

**Actions principales attendues** :

- Creer dossier `repo/packages/comm/src/templates/whatsapp/` avec 6 sous-dossiers (`repair/`, `insure/`, `customer/`, `assure/`, `tow/`, `expert/`)
- Pour chaque template (45 total), creer 4 fichiers `.{lang}.hbs` (180 fichiers) : `customer_fnol_received.fr.hbs` + `customer_fnol_received.ar.hbs` + `customer_fnol_received.ar-MA.hbs` + `customer_fnol_received.en.hbs`
- Templates : status updates uniquement, **aucune variable money/cin/token** (verifie par script CI)
- Variables autorisees : `{{customer_first_name}}`, `{{declaration_date}}`, `{{sinistre_id_short}}`, `{{sinistre_type_label}}`, `{{broker_company_name}}`, `{{policy_number_masked}}` (4 derniers chars only), `{{tow_eta_minutes}}`, `{{milestone_label}}`, etc.
- Pour darija (`ar-MA.hbs`), utiliser registre informel : "Salam {{customer_first_name}}" au lieu de "Bonjour" formel
- Service `template-manager.service.ts.syncWithMetaBusinessManager()` :
  - Lire tous fichiers `.hbs` recursive
  - Pour chaque template, check registry table (skip si deja sync)
  - POST `https://graph.facebook.com/v18.0/{WABA_ID}/message_templates` avec category=UTILITY + components
  - Save registry row (template_name + language + meta_template_id + status=PENDING_APPROVAL + synced_at)
  - Return `{ created: N, skipped: M }`
- Migration TypeORM `1735000000014-CreateWhatsappTemplatesRegistry.ts` :
```sql
CREATE TABLE whatsapp_templates_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name VARCHAR(100) NOT NULL,
  language VARCHAR(10) NOT NULL,
  meta_template_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  category VARCHAR(20) DEFAULT 'UTILITY',
  synced_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(template_name, language)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON whatsapp_templates_registry
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_column();
```
- Script CI `scripts/check-whatsapp-templates-safety.sh` :
```bash
#!/bin/bash
VIOLATIONS=$(grep -rE "\{\{\s*(amount|price|total_mad|cin|token|password|iban|cvv|devis_total|franchise|honoraire)" \
  repo/packages/comm/src/templates/whatsapp/ | wc -l)
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "CRITICAL: $VIOLATIONS dangerous variables found in WhatsApp templates"
  echo "Correction Saad #7 violation - aborting"
  exit 1
fi
```
- Ajouter script CI dans GitHub Actions workflow `whatsapp-templates-safety.yml`
- Endpoint admin `POST /api/v1/comm/templates/sync` (permission `customer.notifications.manage`) pour declencher sync manuel

**Fichiers cibles principaux** :
- `repo/packages/comm/src/templates/whatsapp/repair/repair_vehicle_received.{fr,ar,ar-MA,en}.hbs` (9 templates x 4 langues = 36 fichiers)
- `repo/packages/comm/src/templates/whatsapp/insure/insure_fnol_acknowledged.{fr,ar,ar-MA,en}.hbs` (6 x 4 = 24 fichiers)
- `repo/packages/comm/src/templates/whatsapp/customer/customer_fnol_received.{fr,ar,ar-MA,en}.hbs` (12 x 4 = 48 fichiers)
- `repo/packages/comm/src/templates/whatsapp/assure/assure_fnol_received.{fr,ar,ar-MA,en}.hbs` (8 x 4 = 32 fichiers)
- `repo/packages/comm/src/templates/whatsapp/tow/tow_mission_assigned.{fr,ar,ar-MA,en}.hbs` (6 x 4 = 24 fichiers)
- `repo/packages/comm/src/templates/whatsapp/expert/expert_mission_assigned.{fr,ar,ar-MA,en}.hbs` (4 x 4 = 16 fichiers)
- `repo/packages/comm/src/services/template-manager.service.ts` (sync logic)
- `repo/apps/api/src/migrations/1735000000014-CreateWhatsappTemplatesRegistry.ts`
- `scripts/check-whatsapp-templates-safety.sh` (CI check)
- `.github/workflows/whatsapp-templates-safety.yml`
- Total : 180 fichiers Handlebars + 1 service + 1 migration + 1 script CI

**Criteres P0 cles** :
- V1 (P0) : 45 templates Handlebars uniques (verify file count par dossier)
- V2 (P0) : 4 langues par template = 180 variantes minimum
- V3 (P0) : Sync Meta Business Manager OK (registry rows creees avec meta_template_id)
- V4 (P0 CRITIQUE LEGAL) : Script CI 0 variable dangereuse -- `grep -rE "(amount|cin|total_mad|...)" templates/` returns 0
- V5 (P0) : Migration whatsapp_templates_registry deployee
- V6 (P0) : Endpoint POST /sync fonctionnel + permission enforce

**Validation** :
```bash
# Compter templates
find repo/packages/comm/src/templates/whatsapp -name "*.hbs" | wc -l
# Attendu: 180

# Verifier 0 variable dangereuse (CI critical)
bash scripts/check-whatsapp-templates-safety.sh
# Attendu: exit code 0 + aucun message CRITICAL

# Test sync manuel (dev)
curl -X POST http://localhost:3000/api/v1/comm/templates/sync \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Attendu: { created: N, skipped: M }

# Verifier registry
psql -d insurtech -c "SELECT COUNT(*) FROM whatsapp_templates_registry WHERE meta_template_id IS NOT NULL;"
# Attendu: >= 45 (au moins 45 templates synces, langues + nombreuses)
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): templates whatsapp whitelist 45 + meta business manager sync

- 6 categories x 4 langues = 180 fichiers Handlebars
- Sync Meta Business Manager + registry tracking
- Migration whatsapp_templates_registry + trigger updated_at
- Script CI verifie 0 variable dangereuse (CRITICAL LEGAL)
- GitHub Action workflow whatsapp-templates-safety
- Endpoint POST /sync admin

Task: 2.7.3
Sprint: 9 (Phase 2 / Sprint 7)"
```

---

### Tache 4 / 10 : Email service data sensible + DKIM/SPF/DMARC + fallback Mailjet

**Metadonnees** : P0 | 5h | Depend de : 2.7.3

**But** : Service Email avec **data sensible OK** (montants + CIN + IBAN) + DKIM/SPF/DMARC + multilingue 4 langues + attachments PDF + fallback Mailjet si SendGrid down.

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.4-prompt.md
```

**Actions principales attendues** :

- Service `email.service.ts` implementant `sendEmail(input)` :
  - Try-catch SendGrid primary -> fallback Mailjet si error 5xx
  - Configuration `from: noreply@assurflow.ma` (DKIM signed)
  - Template rendering Handlebars avec data sensible OK (montants/CIN/IBAN visibles)
  - Attachments PDF (base64) + click/open tracking
  - Audit ACAPS log channel='email' + recipientHash (SHA256 email)
- Templates email HTML data sensible OK (~30 templates) :
  - `customer_premium_invoice.{fr,ar,ar-MA,en}.html` -- contient `{{amount_formatted}} MAD` + `{{broker_iban}}`
  - `customer_payment_receipt.{fr,ar,ar-MA,en}.html` -- contient montant + numero police
  - `customer_devis_attached.{fr,ar,ar-MA,en}.html` -- contient `{{devis_total}}` + lien PDF
  - `carrier_sinistre_summary.{fr,ar,ar-MA,en}.html` -- contient `{{cin}}` + `{{policy_number}}`
  - 30+ templates au total avec attachments PDF support
- Configuration DKIM/SPF/DMARC production :
  - DKIM record TXT : `assurflow._domainkey.assurflow.ma` -> `v=DKIM1; k=rsa; p=MIGfMA0...`
  - SPF record TXT : `assurflow.ma` -> `v=spf1 include:sendgrid.net include:mailjet.com -all`
  - DMARC record TXT : `_dmarc.assurflow.ma` -> `v=DMARC1; p=reject; rua=mailto:dmarc@assurflow.ma; pct=100`
  - Documenter dans `repo/docs/infrastructure/email-dns-config.md`
- Multilingue RTL pour ar + ar-MA : `dir="rtl"` attribute HTML + `lang="ar"` ou `lang="ar-MA"`
- Provider config secrets vault (Vercel + Docker) :
  - `SENDGRID_API_KEY` (primary)
  - `MAILJET_API_KEY` + `MAILJET_SECRET_KEY` (fallback)
  - `EMAIL_DOMAIN_PRIMARY=assurflow.ma`
- Tests 15+ : send happy path + fallback Mailjet + RTL rendering + attachments PDF + multilingue + deliverability

**Fichiers cibles principaux** :
- `repo/packages/comm/src/services/email.service.ts` (~200 lignes)
- `repo/packages/comm/src/services/email.service.spec.ts` (15+ tests)
- `repo/packages/comm/src/services/sendgrid-client.service.ts` (~80 lignes)
- `repo/packages/comm/src/services/mailjet-client.service.ts` (~80 lignes, fallback)
- `repo/packages/comm/src/templates/email/customer/*.html` (12 templates x 4 langues = 48 fichiers)
- `repo/packages/comm/src/templates/email/carrier/*.html` (8 x 4 = 32 fichiers)
- `repo/packages/comm/src/templates/email/internal/*.html` (10 x 4 = 40 fichiers)
- `repo/docs/infrastructure/email-dns-config.md` (DNS records production)
- Total : ~120 fichiers email HTML + 4 services TS

**Criteres P0 cles** :
- V1 (P0) : DKIM/SPF/DMARC records DNS prod configures
- V2 (P0) : Email delivery rate > 95% (verify MailTester score > 9/10)
- V3 (P0) : Fallback Mailjet automatic si SendGrid 5xx
- V4 (P0) : 30+ templates HTML 4 langues = 120+ variantes
- V5 (P0) : RTL rendering correct pour ar + ar-MA
- V6 (P0) : Attachments PDF support (max 10 MB)
- V7 (P0) : Tests 15+ PASS

**Validation** :
```bash
cd repo/packages/comm
pnpm vitest run src/services/email.service.spec.ts

# Verify DNS records prod
dig +short TXT assurflow._domainkey.assurflow.ma | grep "v=DKIM1"
dig +short TXT assurflow.ma | grep "v=spf1"
dig +short TXT _dmarc.assurflow.ma | grep "p=reject"

# Test deliverability MailTester
# Send to test@mailtester.net -> verify score > 9/10
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): email service data sensible + dkim/spf/dmarc + fallback mailjet

- SendGrid primary + Mailjet fallback automatic
- 120+ templates HTML (30 templates x 4 langues) data sensible OK
- DKIM/SPF/DMARC DNS records prod configures
- RTL rendering ar + ar-MA
- Attachments PDF max 10 MB
- Audit ACAPS log email recipient hashed

Task: 2.7.4
Sprint: 9 (Phase 2 / Sprint 7)"
```

---

### Tache 5 / 10 : Push notifications mobile Expo + FCM + APNs

**Metadonnees** : P0 | 5h | Depend de : 2.7.4

**But** : Service Push notifications via Expo SDK + FCM (Android) + APNs (iOS) pour milestones courts mobile. Pas de data sensible (visible lockscreen).

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.5-prompt.md
```

**Actions principales attendues** :

- Service `push.service.ts` implementant `sendPush(input)` :
  - Validate title <= 50 chars + body <= 100 chars (sinon BadRequestException)
  - Validate body NO sensitive data (regex `/\d{4,}|MAD|amount|CIN/i` -- reject si match)
  - Compose Expo push message avec sound + priority + deepLink
  - Send via Expo SDK `expo.sendPushNotificationsAsync(messages)`
  - Fallback direct FCM (Android) ou APNs (iOS) si Expo down
  - Audit ACAPS log channel='push' + recipientHash (SHA256 push_token)
- Service `expo-client.service.ts` Expo SDK wrapper
- Service `fcm-client.service.ts` Firebase Admin SDK (Android fallback)
- Service `apns-client.service.ts` @parse/node-apn (iOS fallback)
- Templates push notifications (~20 messages courts) :
  - `assure_tow_dispatched` : "Depanneuse en route" + body "Arrivee dans X min"
  - `customer_sinistre_milestone` : "Avancement sinistre" + body "{{milestone_label}}"
  - `assure_emergency_acknowledged` : "Urgence prise en compte" + body "Aide arrive"
  - 17+ autres templates courts
- Deep links iOS + Android : `assurflow://sinistre/{id}` + `assurflow://policy/{id}`
- Service Worker registration mobile (Tache Sprint 18 ProfileScreen)
- Tests 10+ : send happy path + title/body validation + sensitive data reject + deep link + Expo fallback FCM/APNs

**Fichiers cibles principaux** :
- `repo/packages/comm/src/services/push.service.ts` (~150 lignes)
- `repo/packages/comm/src/services/push.service.spec.ts` (10+ tests)
- `repo/packages/comm/src/services/expo-client.service.ts`
- `repo/packages/comm/src/services/fcm-client.service.ts`
- `repo/packages/comm/src/services/apns-client.service.ts`
- `repo/packages/comm/src/constants/push-templates.ts` (~20 templates)

**Criteres P0 cles** :
- V1 (P0) : Expo SDK integration + FCM + APNs fallback
- V2 (P0) : Templates courts validation (title <= 50, body <= 100)
- V3 (P0) : NO sensitive data regex check (reject `amount|MAD|CIN|\d{4,}`)
- V4 (P0) : Deep links iOS + Android configures
- V5 (P0) : Tests 10+ scenarios PASS

**Validation** :
```bash
cd repo/packages/comm
pnpm vitest run src/services/push.service.spec.ts

# Test sensitive data reject
node -e "
const svc = new PushService(...);
svc.sendPush({
  expoPushToken: 'ExponentPushToken[xxx]',
  title: 'Paiement', body: 'Vous devez payer 5000 MAD',
  templateName: 'test'
}).catch(e => console.log('REJECTED:', e.message));
"
# Attendu: REJECTED: Push body contains sensitive data
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): push notifications fcm + apns via expo + sensitive data reject

- Expo SDK primary + FCM + APNs fallback
- Templates courts validation (title<=50, body<=100)
- Regex check sensitive data (amount|MAD|CIN|\\d{4,})
- Deep links iOS + Android (assurflow://...)
- 20 templates push courts
- 10+ tests scenarios

Task: 2.7.5
Sprint: 9 (Phase 2 / Sprint 7)"
```

---

### Tache 6 / 10 : SMS OTP only service (Twilio + Orange Maroc fallback)

**Metadonnees** : P0 | 4h | Depend de : 2.7.5

**But** : SMS **reserve OTP only** (2FA authentication uniquement). Pas de sendSms() general method. Twilio primary + Orange Maroc API fallback (rates competitifs Maroc).

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.6-prompt.md
```

**Actions principales attendues** :

- Service `sms.service.ts` implementant **uniquement** `sendOtp(input)` :
  - Validate OTP format `/^\d{6}$/` (6 digits exactement)
  - Validate TTL === 5 minutes (hardcoded, pas configurable)
  - Body fixe : `"Skalean Assurflow: votre code de verification est ${otp}. Valide 5 min."`
  - Try Twilio primary -> fallback Orange Maroc B2B API si Twilio error
  - Audit ACAPS log channel='sms' + templateName='otp_login' + recipientHash (SHA256 phone)
- **PAS de sendSms() public method** -- SMS reserve OTP only par design (cout + ANRT compliance)
- Service `twilio-client.service.ts` Twilio SDK wrapper
- Service `orange-maroc-client.service.ts` Orange Maroc B2B API client (fallback)
- Provider config :
  - `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE_FROM` (Twilio)
  - `ORANGE_MAROC_API_KEY` + `ORANGE_MAROC_SENDER_ID` (fallback)
- Tests 8+ : send OTP happy path + format validation + TTL validation + Twilio fallback Orange + audit log

**Fichiers cibles principaux** :
- `repo/packages/comm/src/services/sms.service.ts` (~100 lignes, sendOtp uniquement)
- `repo/packages/comm/src/services/sms.service.spec.ts` (8+ tests)
- `repo/packages/comm/src/services/twilio-client.service.ts`
- `repo/packages/comm/src/services/orange-maroc-client.service.ts`

**Criteres P0 cles** :
- V1 (P0 CRITIQUE) : **NO public sendSms() method** -- SMS reserve OTP only (verify code grep)
- V2 (P0) : OTP format 6 digits + TTL 5 min validation enforce
- V3 (P0) : Twilio primary + Orange Maroc fallback
- V4 (P0) : Audit ACAPS log obligatoire
- V5 (P0) : Tests 8+ scenarios PASS

**Validation** :
```bash
cd repo/packages/comm
pnpm vitest run src/services/sms.service.spec.ts

# Verify NO general sendSms method exists (CRITICAL)
grep -E "sendSms\(|sendSMS\(" src/services/sms.service.ts | grep -v "sendOtp"
# Attendu: aucun resultat (vide)

# Test OTP validation
node -e "
const svc = new SmsService(...);
svc.sendOtp({phone: '+212600000000', otp: '12345', ttlMinutes: 5})
  .catch(e => console.log('REJECTED:', e.message));
"
# Attendu: REJECTED: OTP must be 6 digits
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): sms otp only service (twilio + orange maroc fallback)

- sendOtp() unique method (NO sendSms general)
- OTP format /^\\d{6}\$/ + TTL 5 min hardcoded
- Twilio primary + Orange Maroc B2B fallback
- Audit ACAPS log channel=sms recipient hashed
- 8+ tests scenarios

Task: 2.7.6
Sprint: 9 (Phase 2 / Sprint 7)
Decisions: sms cout + anrt compliance"
```

---

### Tache 7 / 10 : Notification Router multi-canal content_type logic

**Metadonnees** : P0 | 5h | Depend de : 2.7.6

**But** : Router central qui decide canal(x) selon `content_type` (status_only / data_sensible / urgent) + user prefs. Logic CRITIQUE : `data_sensible` NE PASSE JAMAIS par WhatsApp.

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.7-prompt.md
```

**Actions principales attendues** :

- Service `notification-router.service.ts` implementant `routeNotification(input)` :
  - Lire user prefs via `userPrefsService.getPreferences(userId)` (Sprint 5)
  - Switch case sur `input.contentType` :
    - **`status_only`** : envoyer WhatsApp (si prefs.whatsappEnabled) + Push (si prefs.pushEnabled) -- via `whatsapp.service.ts.sendWhatsAppStatus()` + `push.service.ts.sendPush()`
    - **`data_sensible`** : envoyer Email ONLY -- via `email.service.ts.sendEmail()` + optionnellement Push "notification only" (sans details, juste "consulter email")
    - **`urgent`** : multi-canal -- Push + SMS (si auth-related) + Email simultanement
  - Return `{ channels: ['whatsapp', 'push', ...] }` avec liste canaux envoyes
- Enum `ContentTypeEnum` : `STATUS_ONLY | DATA_SENSIBLE | URGENT` (style `as const`)
- Schema Zod `RouteNotificationInput`
- Service `user-prefs.service.ts` (Sprint 5 reuse) : `getPreferences(userId)` -> `{ whatsappEnabled, pushEnabled, emailEnabled, smsEnabled, language }`
- Tests 12+ : status_only -> WA+Push / data_sensible -> Email only (NEVER WhatsApp meme si user prefs) / urgent -> multi-canal / user prefs disabled / language fallback

**Fichiers cibles principaux** :
- `repo/packages/comm/src/services/notification-router.service.ts` (~180 lignes)
- `repo/packages/comm/src/services/notification-router.service.spec.ts` (12+ tests)
- `repo/packages/comm/src/types/content-type.types.ts` (enum + types)
- `repo/packages/comm/src/schemas/route-notification.schema.ts` (Zod)

**Criteres P0 cles** :
- V1 (P0 CRITIQUE LEGAL) : `data_sensible` NE PASSE JAMAIS par WhatsApp -- verify test "data_sensible content type route to email ONLY"
- V2 (P0) : `status_only` -> WhatsApp + Push selon user prefs
- V3 (P0) : `urgent` -> multi-canal (Push + SMS + Email)
- V4 (P0) : User prefs respectes (whatsappEnabled=false -> skip)
- V5 (P0) : Tests 12+ scenarios PASS

**Validation** :
```bash
cd repo/packages/comm
pnpm vitest run src/services/notification-router.service.spec.ts

# CRITIQUE: verifier test data_sensible never WhatsApp
pnpm vitest run src/services/notification-router.service.spec.ts -t "data_sensible.*never.*whatsapp"
# Attendu: PASS
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): notification router multi-canal content_type logic

- ContentType enum (status_only / data_sensible / urgent)
- data_sensible -> Email ONLY (jamais WhatsApp meme prefs)
- status_only -> WhatsApp + Push selon prefs
- urgent -> multi-canal (Push + SMS + Email)
- User prefs respectes via UserPrefsService
- 12+ tests dont data_sensible never WhatsApp

Task: 2.7.7
Sprint: 9 (Phase 2 / Sprint 7)
Decisions: correction saad #7 enforcement central"
```

---

### Tache 8 / 10 : Audit ACAPS notifications + traceability 10 ans + phone_hash

**Metadonnees** : P0 | 4h | Depend de : 2.7.7

**But** : Audit ACAPS log chaque notification envoyee (channel + template + recipient_hash + tenant_id + timestamp + message_id + correlation_id + duration_ms) -- 10 ans retention obligatoire loi ACAPS.

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.8-prompt.md
```

**Actions principales attendues** :

- Migration TypeORM `1735000000015-ExtendAcapsAuditsForComm.ts` :
```sql
ALTER TABLE compliance_acaps_audits
  ADD COLUMN IF NOT EXISTS channel VARCHAR(20),
  ADD COLUMN IF NOT EXISTS template_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS recipient_hash VARCHAR(32),
  ADD COLUMN IF NOT EXISTS message_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS correlation_id UUID,
  ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
  ADD COLUMN IF NOT EXISTS status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS retention_until DATE GENERATED ALWAYS AS (created_at + INTERVAL '10 years') STORED;

CREATE INDEX IF NOT EXISTS idx_acaps_audits_channel ON compliance_acaps_audits(channel);
CREATE INDEX IF NOT EXISTS idx_acaps_audits_template ON compliance_acaps_audits(template_name);
CREATE INDEX IF NOT EXISTS idx_acaps_audits_recipient_hash ON compliance_acaps_audits(recipient_hash);
CREATE INDEX IF NOT EXISTS idx_acaps_audits_retention ON compliance_acaps_audits(retention_until);
```
- Service `notification-audit.service.ts` implementant `logNotificationSent(input)` :
  - Save row dans `compliance_acaps_audits` avec event_type='notification_sent'
  - Calcul automatique retention_until = created_at + 10 years (GENERATED column)
  - Hashes obligatoires : phone -> SHA256 16 chars / email -> SHA256 16 chars
  - Pino log structure pour observability
- Endpoint admin `GET /api/v1/comm/audits/search` (permission `customer.notifications.manage`) :
  - Filtres : channel + template_name + tenant_id + recipient_hash + date range
  - Pagination + sort par created_at DESC
  - Response hashed (jamais plain phone/email)
- Cron archivage cold storage S3 : audits > 1 an warm DB -> S3 Glacier (cron NestJS `@Cron('0 3 * * 0')` dimanche 03:00)
- Tests 8+ : log notification + retention 10 ans + hash phone/email + search filters + pagination

**Fichiers cibles principaux** :
- `repo/apps/api/src/migrations/1735000000015-ExtendAcapsAuditsForComm.ts`
- `repo/packages/comm/src/services/notification-audit.service.ts` (~120 lignes)
- `repo/packages/comm/src/services/notification-audit.service.spec.ts` (8+ tests)
- `repo/apps/api/src/modules/comm/audit.controller.ts` (endpoint search)
- `repo/apps/api/src/modules/comm/audit-archival.cron.ts` (cron S3 Glacier)

**Criteres P0 cles** :
- V1 (P0) : Migration colonnes channel + template_name + recipient_hash + message_id + correlation_id + duration_ms + status + retention_until
- V2 (P0) : Service logNotificationSent appele par 4 services canaux (WhatsApp + Email + Push + SMS)
- V3 (P0) : Endpoint GET /audits/search avec permission `customer.notifications.manage`
- V4 (P0) : Cron archivage S3 Glacier > 1 an
- V5 (P0) : Tests 8+ PASS

**Validation** :
```bash
# Verifier migration colonnes
psql -d insurtech -c "\d compliance_acaps_audits" | grep -E "(channel|template_name|recipient_hash|retention_until)"
# Attendu: 7 colonnes nouvelles

# Test endpoint search
curl -X GET "http://localhost:3000/api/v1/comm/audits/search?channel=whatsapp&limit=10" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): audit acaps notifications + traceability 10 ans + phone_hash

- Migration extension 7 colonnes + retention_until generee 10 ans
- Service logNotificationSent appele par 4 services
- Endpoint GET /audits/search permission notifications.manage
- Cron archivage S3 Glacier > 1 an
- Indexes performance (channel + template + recipient_hash + retention)

Task: 2.7.8
Sprint: 9 (Phase 2 / Sprint 7)
Decisions: loi acaps 10 ans retention"
```

---

### Tache 9 / 10 : Endpoints REST + permissions customer.notifications.manage

**Metadonnees** : P0 | 3h | Depend de : 2.7.8

**But** : Endpoints REST module Comm + permissions Sprint 7.5a enforced + DTO + OpenAPI Swagger.

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.9-prompt.md
```

**Actions principales attendues** :

- Controller `comm.controller.ts` exposant 5 endpoints :
  - `POST /api/v1/comm/notifications/send` -- envoyer notification (Permission `customer.notifications.manage`)
  - `GET /api/v1/comm/notifications/history` -- historique user (Permission `customer.notifications.manage`)
  - `GET /api/v1/comm/templates/list` -- liste templates whitelist (Permission `customer.notifications.manage`)
  - `POST /api/v1/comm/templates/sync` -- sync Meta Business Manager (Permission admin)
  - `POST /api/v1/comm/preferences/update` -- update user notification prefs (Permission `customer.profile.update`)
- DTO Zod validation + OpenAPI Swagger documentation
- Guards `@RequirePermissions('customer.notifications.manage')` via Sprint 7.5a
- Tenant isolation : header `x-tenant-id` automatique via Sprint 6 middleware
- Tests E2E 6+ : send + history + templates list + preferences update + permission denied (403) + tenant isolation

**Fichiers cibles principaux** :
- `repo/apps/api/src/modules/comm/comm.controller.ts` (~200 lignes)
- `repo/apps/api/src/modules/comm/comm.controller.spec.ts` (6+ tests E2E)
- `repo/apps/api/src/modules/comm/dto/send-notification.dto.ts`
- `repo/apps/api/src/modules/comm/dto/history-query.dto.ts`
- `repo/apps/api/src/modules/comm/comm.module.ts` (NestJS module)

**Criteres P0 cles** :
- V1 (P0) : 5 endpoints REST minimum
- V2 (P0) : Permission `customer.notifications.manage` enforce sur send + history + templates
- V3 (P0) : Tenant isolation header `x-tenant-id`
- V4 (P0) : OpenAPI Swagger documentation
- V5 (P0) : Tests E2E 6+ PASS

**Validation** :
```bash
# Test permission denied
curl -X POST http://localhost:3000/api/v1/comm/notifications/send \
  -H "Authorization: Bearer $USER_TOKEN_NO_PERM" \
  -d '{"contentType":"status_only", ...}'
# Attendu: 403 Forbidden

# Verifier Swagger docs
curl http://localhost:3000/api/docs/json | jq '.paths."/api/v1/comm/notifications/send"'
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "feat(sprint-09): endpoints rest + permissions customer.notifications.manage

- 5 endpoints REST (send + history + templates + sync + preferences)
- Permission customer.notifications.manage enforce
- Tenant isolation x-tenant-id middleware
- OpenAPI Swagger documentation
- 6+ tests E2E

Task: 2.7.9
Sprint: 9 (Phase 2 / Sprint 7)"
```

---

### Tache 10 / 10 : Tests E2E 30+ + 8+ blacklist CRITIQUES + benchmarks

**Metadonnees** : P0 | 5h | Depend de : 2.7.9

**But** : Tests E2E exhaustifs (30+ scenarios) + verification stricte BLACKLIST (8+ scenarios CRITIQUES end-to-end) + benchmarks performance + documentation policy CNDP (150+ lignes).

**Commande de lecture du prompt** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-09-comm-whatsapp-scope-strict/task-2.7.10-prompt.md
```

**Actions principales attendues** :

- Tests E2E categories (Vitest E2E + Supertest) :
  - **Happy path** (8+ scenarios) : WhatsApp send + Email send + Push send + SMS OTP send + multilingue 4 langues + audit log verifie
  - **CRITIQUE Blacklist** (8+ scenarios) : data.amount rejected + data.cin rejected + data.total_mad rejected + data.iban rejected + data.token rejected + data.password rejected + nested data.payment.amount rejected + data.devis_total rejected
  - **Whitelist** (3+ scenarios) : template inconnu rejected + template valid accepted + template typo rejected
  - **Multilingue** (4+ scenarios) : fr / ar / ar-MA / en + fallback fr si lang manquante
  - **Rate limiting** (2+ scenarios) : 10 messages OK + 11eme rejected + Redis reset apres 1h
  - **Audit ACAPS** (5+ scenarios) : log every channel + retention 10 ans + hash phone + search endpoint
- Benchmarks performance (`benchmarks/whatsapp-latency.json`) :
```json
{
  "p50_ms": 800,
  "p95_ms": 1900,
  "p99_ms": 2400,
  "samples": 1000,
  "target_p95_ms": 2000,
  "passes": true
}
```
- Target P95 < 2000ms (sinon WARN dans V-09)
- Coverage cible Sprint 9 : **>= 90%** (vs 85% standard) -- vitest --coverage report
- Tests pre-prod manuel CNDP penetration :
```bash
# Test CNDP manuel pre-deploiement prod
curl -X POST localhost:3000/api/v1/comm/notifications/send \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "contentType":"status_only",
    "templateName":"customer_otp_login",
    "data":{"amount":"5000"}
  }'
# Attendu: 400 BadRequestException "Blacklist violation"
```
- Documentation policy `repo/docs/architecture/whatsapp-scope-strict-policy.md` (~200 lignes) :
  - Contexte correction Saad #7
  - Loi 09-08 CNDP applicable
  - Architecture multi-canal scope strict
  - 15 patterns blacklist + 45 templates whitelist
  - Procedure ajout nouveau template (review + Meta approval + tests)
  - Procedure incident detection (alerte + rollback + audit)
  - Conformite verifie : tests + script CI + manual penetration

**Fichiers cibles principaux** :
- `repo/packages/comm/src/__tests__/e2e/whatsapp-scope-strict.e2e.spec.ts` (8+ blacklist CRITIQUES)
- `repo/packages/comm/src/__tests__/e2e/email-data-sensible.e2e.spec.ts` (15+ tests)
- `repo/packages/comm/src/__tests__/e2e/notification-router.e2e.spec.ts` (12+ tests)
- `repo/packages/comm/src/__tests__/e2e/audit-acaps.e2e.spec.ts` (5+ tests)
- `repo/benchmarks/whatsapp-latency.json` (results benchmarks)
- `repo/benchmarks/scripts/run-whatsapp-benchmark.ts` (script benchmark)
- `repo/docs/architecture/whatsapp-scope-strict-policy.md` (~200 lignes documentation)
- `repo/docs/architecture/cndp-conformity-verification.md` (procedure verification)

**Criteres P0 cles** :
- V1 (P0 CRITIQUE LEGAL) : Tests blacklist 8+ scenarios PASS dont nested data
- V2 (P0) : Coverage Sprint 9 >= 90% (vs 85% standard)
- V3 (P0) : Benchmark WhatsApp P95 < 2000ms (target)
- V4 (P0) : Documentation policy >= 150 lignes
- V5 (P0) : Tests E2E total >= 30 scenarios
- V6 (P0) : Manual penetration test pre-prod documente

**Validation** :
```bash
cd repo/packages/comm
# Tests E2E
pnpm vitest run src/__tests__/e2e --reporter=verbose

# Coverage
pnpm vitest run --coverage src/
# Attendu: lines.pct >= 90%

# Benchmark
pnpm tsx benchmarks/scripts/run-whatsapp-benchmark.ts
cat benchmarks/whatsapp-latency.json | jq '.passes'
# Attendu: true (p95_ms < 2000)

# Doc policy
wc -l repo/docs/architecture/whatsapp-scope-strict-policy.md
# Attendu: >= 150
```

**Commit Conventional Commits** :
```bash
git add -A
git commit -m "test(sprint-09): tests e2e 30+ + 8+ blacklist CRITIQUES + benchmarks

- 30+ scenarios E2E (8+ blacklist CRITIQUES nested)
- Coverage >= 90% (vs 85% standard correction saad)
- Benchmark WhatsApp P95 < 2000ms verifie
- Documentation policy whatsapp-scope-strict 200+ lignes
- Manual penetration test pre-prod CNDP

Task: 2.7.10
Sprint: 9 (Phase 2 / Sprint 7)
Decisions: correction saad #7 verification stricte"
```

---

## VERIFICATION DU SPRINT 9

Apres execution des 10 taches, lancer **automatiquement** :
```bash
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-09-sprint-09-verification.md
```

Le script bash auto-reparation V-09 :
- Verifie **61+ criteres** : 10 taches (~50 criteres) + 7 transversaux + 4 CNDP critiques
- Production rapport `sprint09-verify-report.md` avec score % + jalon GO/CONDITIONNEL/NO-GO
- 4 verifications **CNDP CRITIQUES** end-to-end : blacklist amount rejected / blacklist cin rejected / whitelist template inconnu rejected / documentation policy >= 150 lignes

**Decision matrix** :
- **Score >= 95%** -> GO : tag `sprint-09-complete-v3-comm-scope-strict` + deploiement prod
- **Score 85-95%** -> GO CONDITIONNEL : doc dette `dette-technique-sprint-09.md` + Sprint 10 demarre parallele
- **Score < 85%** -> NO-GO : escalation Saad + Abla (CRITIQUE LEGAL CNDP) + NE PAS deployer prod

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 9 v3.0]
   |
   v
[Tache 2.7.1 : Package @insurtech/comm + types + constants whitelist/blacklist]
   |  4h
   v
[Tache 2.7.2 : CRITIQUE WhatsApp scope strict 7 etapes enforcement]
   |  8h
   v
[Tache 2.7.3 : Templates Handlebars 45 + sync Meta Business Manager]
   |  6h
   v
[Tache 2.7.4 : Email DKIM/SPF/DMARC + fallback Mailjet]
   |  5h
   v
[Tache 2.7.5 : Push Expo + FCM + APNs + sensitive data reject]
   |  5h
   v
[Tache 2.7.6 : SMS OTP only (Twilio + Orange Maroc)]
   |  4h
   v
[Tache 2.7.7 : Notification Router multi-canal]
   |  5h
   v
[Tache 2.7.8 : Audit ACAPS 10 ans + phone_hash]
   |  4h
   v
[Tache 2.7.9 : Endpoints REST + permissions]
   |  3h
   v
[Tache 2.7.10 : Tests E2E 30+ + benchmarks + doc policy]
   |  5h
   v
[V-09 verification automatique]
   |
   v
[Score >= 95%] -> GO -> tag sprint-09-complete-v3-comm-scope-strict
                 -> deploiement production WhatsApp + Email
                 -> Sprint 10 (Docs + Signature) demarre
```

**Duree totale** : 45 heures / 1 semaine
**Coverage cible** : >= 90% (vs 85% standard car critique CNDP)
**Modules livres** : `@insurtech/comm` (NOUVEAU package), `apps/api/src/modules/comm`, infrastructure templates 180 WhatsApp + 120 Email

**Apport principal** : conformite CNDP loi 09-08 correction Saad #7 absolue + multi-canal robuste (4 canaux scope strict) + audit ACAPS 10 ans + multilingue 4 langues

**Sprint suivant** : Sprint 10 Docs + Signature electronique Barid eSign (loi 43-20).

---

## COMMANDES DE LANCEMENT

### Prerequis Sprint 8 (verification GO)
```bash
# Verifier Sprint 8 GO avant Sprint 9
ls skalean-insurtech/sprint08-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint08-verify-report.md
# Si pas GO Sprint 8, NE PAS demarrer Sprint 9 (deps CRM + Booking)

# Verifier Sprint 7.5a GO (permissions customer.notifications.manage)
grep "customer.notifications.manage" repo/packages/auth/src/permissions/customer.permissions.ts
# Attendu: presence permission as const
```

### Lancement Sprint 9 (Cowork lit cet orchestrateur)
```bash
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-09-sprint-09-comm-whatsapp-scope-strict.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-09-sprint-09-comm-whatsapp-scope-strict-v3.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-09-sprint-09-verification.md \
  --branch sprint-09-comm-whatsapp-scope-strict
```

### Suivi temps reel execution
```bash
# Logs API module Comm
cd repo/apps/api && pnpm dev

# Progress commits Sprint 9
git log --oneline --since="1 week ago" -- repo/packages/comm | grep "Sprint: 9"
# Attendu: 10 commits (1 par tache)

# Test manuel WhatsApp dev environment
curl -X POST http://localhost:3000/api/v1/comm/notifications/send \
  -H "Authorization: Bearer $DEV_TOKEN" \
  -d '{
    "contentType": "status_only",
    "templateName": "customer_fnol_received",
    "userId": "test-user-uuid",
    "tenantId": "test-tenant-uuid",
    "safeData": {
      "customer_first_name": "Mohamed",
      "sinistre_id_short": "AB12CD"
    }
  }'
```

### Apres completion -- verifier rapport
```bash
# Cat rapport verification
cat skalean-insurtech/sprint09-verify-report.md

# Si GO, tag + push
git tag -a "sprint-09-complete-v3-comm-scope-strict" -m "Sprint 9 v3.0 Comm scope strict complete

- WhatsApp whitelist 45 templates + blacklist 15 patterns server-side
- Email DKIM/SPF/DMARC + fallback Mailjet (data sensible OK)
- Push FCM + APNs + sensitive data reject
- SMS OTP only (Twilio + Orange Maroc)
- Notification Router multi-canal (status_only / data_sensible / urgent)
- Audit ACAPS log 10 ans + phone_hash SHA256
- Multilingue 4 langues (fr / ar / ar-MA / en)
- Endpoints REST + permission customer.notifications.manage
- 30+ tests E2E PASS dont 8+ blacklist CRITIQUES
- Coverage >= 90% (critique correction saad #7)
- Documentation policy CNDP 200+ lignes"

git push origin sprint-09-complete-v3-comm-scope-strict
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire B-09 v3.0 complet (1464 lignes)** AVANT generation prompts -- patterns code complets WhatsApp service 7 etapes + blacklist enforcement + audit ACAPS sont detailles dedans
2. **Correction Saad #7 ABSOLUE** : WhatsApp = status only. JAMAIS de derogation, meme sur demande utilisateur. Si Cowork detecte requirement contradictoire, **escalation Saad** obligatoire avant code
3. **BLACKLIST server-side** Tache 2.7.2 = enforcement OBLIGATOIRE dans `sendWhatsAppStatus()` AVANT envoi Meta API -- pas optionnel
4. **Whitelist 45 templates** Tache 2.7.3 = sync Meta Business Manager obligatoire avant test prod (status PENDING_APPROVAL chez Meta)
5. **Email = primary data sensible** : tous montants/CIN/IBAN passent par Email Tache 2.7.4 (DKIM/SPF/DMARC critical)
6. **Audit ACAPS 10 ans** Tache 2.7.8 : compliance loi non-negociable. Retention auto via GENERATED column
7. **Coverage >= 90%** Tache 2.7.10 (vs 85% standard) car critique correction Saad. Si < 90%, NO-GO V-09
8. **Documentation policy** 150+ lignes Tache 2.7.10 : audit externe CNDP possible, doc obligatoire
9. **Tests CNDP manuel pre-prod** : avant deploiement, executer 3 penetration tests (blacklist amount + cin + token) -- documenter resultats
10. **NE JAMAIS modifier 00-pilotage/** -- uniquement repo/
11. **Tenant isolation** : tous services prennent `tenantId` parametre (multi-tenant Sprint 6)
12. **Phone hash SHA256 16 chars** : jamais plain phone dans audits/logs. Verifier `PHONE_HASH_SECRET` env var set en prod

---

**Fin orchestrateur C-09 v3.0 -- Sprint 9 (2.7) Comm WhatsApp Scope Strict + Email Data Sensible.**

**Total taches** : 10 | **Effort** : ~45h | **Apport** : Correction Saad #7 CNDP absolu + multi-canal robuste 4 canaux + audit 10 ans
