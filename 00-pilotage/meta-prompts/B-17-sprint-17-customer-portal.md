# META-PROMPT PHASE B SPRINT 17 v3.0 -- REFONTE Customer Portal (B2C Souscripteur)
# 14 taches detaillees Cowork avec patterns code + schemas + types complets
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (REFONTE complete v2.2 -- ecosystem 6 acteurs)
**Phase** : 4 -- Vertical Insure (Customer-facing)
**Sprint** : 17 / 40 (cumul v3.0)
**Reference orchestrateur** : `C-17-sprint-17-web-customer-portal.md`
**Reference verification** : `V-17-sprint-17-verification.md`
**Numerotation taches** : 4.4.1 a 4.4.14 (vs 4.4.1 a 4.4.10 v2.2)
**Effort total** : ~75 heures developpement / 1.5 semaines (vs 50h v2.2)
**Apport metier** : Portail Customer B2C complet (souscription + sinistres FNOL + tracking + paiement + multilingue fr/ar/darija)

---

## REFONTE v3.0 -- Differences majeures vs v2.2

| Element | v2.2 | v3.0 |
|---------|------|------|
| Acteur modele | Customer = Assure (unique) | Customer != Assure (decision-012 ecosystem) |
| FNOL declaration | Non present | Tache 4.4.5 NOUVELLE (Sprint 24 consume) |
| Tracking sinistre | Vue simple | Tache 4.4.7 REFONDU SSE real-time 12 milestones |
| Sky AI integration | Pas present | Tache 4.4.8 NOUVELLE (status humanise + confidence) |
| WhatsApp scope | Pas de regles | Tache 4.4.13 strict status only (correction Saad #7) |
| Brand Sofidemy | Theme Skalean | Theme Sofidemy (decision-011) |
| Multilingue | fr + en | fr + ar (classique) + ar-MA (darija) + en (decision-008) |
| PWA | Non | Oui (offline-capable) |

---

## POSITION DANS LA PHASE

Sprint 17 (4.4) suit Sprint 16 (Web Broker App) et precede Sprint 18 (Web Assure Portal Mobile).

**Sprints consommateurs** (downstream) :
- Sprint 24 Tache 5.6.1 (FNOL customer declaration) consume Customer Portal FNOL
- Sprint 24 Tache 5.6.10 (Customer realtime tracking) consume Customer Portal SSE
- Sprint 26.5 Tache 6.2.7 (carrier expert reports review) renvoie status aux customers

---

## DEPENDANCES

**Entrees consommees** :
- Sprint 14 (Insure Foundation) -- 7 entites Insure (policies + quotes + premiums + renewals)
- Sprint 15 (Insure Lifecycle Police) -- workflow souscription complet
- Sprint 16 (Web Broker App) -- patterns Next.js 14 + theme Sofidemy
- Sprint 7.5a -- 17 permissions customer.* (decision-012)
- Sprint 10 (Docs Signature) -- Barid eSign pour souscription
- Sprint 11 (Pay MA) -- CMI + Mobile Money pour primes

**Sorties produites** (consumed downstream) :
- Customer FNOL declarations -> Sprint 24 master orchestrator
- Customer real-time tracking subscriptions -> Sprint 24 SSE
- Customer paiement history -> Sprint 14 commissions Books
- Customer feedback + ratings -> analytics carrier

---

## DECISIONS STRATEGIQUES APPLICABLES

- **decision-011-assurflow-rebrand** : Theme Sofidemy + naming Assurflow Customer
- **decision-012-6-acteurs-ecosystem** : Customer = acteur B2C distinct (vs Assure)
- **decision-008-data-residency-maroc** : multilingue 4 langues + Atlas Cloud
- **decision-006-no-emoji** : 0 emoji absolu
- **Correction Saad terrain #7** : WhatsApp scope strict status only

---

## REGLES ABSOLUES skalean-insurtech v3.0

(Identique B-22.7 + specificites Customer Portal :)

**Specifique Sprint 17 v3.0** :
- **Next.js 14 App Router** + Server Actions + PWA-ready (next-pwa)
- **Theme Sofidemy** (decision-011 -- bleu marine #0E1B3D + gold #C8A465)
- **i18n** : next-intl 3.x -- 4 langues (fr / ar / ar-MA / en) avec auto-detect navigateur
- **Multitenant** : header `x-tenant-id` automatique (broker tenant assigne au customer)
- **Permissions Sprint 7.5a** : 17 perms customer.* enforces
- **decimal.js** pour toute somme MAD
- **SSE Server-Sent Events** pour tracking real-time
- **WhatsApp scope strict** : whitelist templates only
- **Audit ACAPS** : actions critiques (souscription + paiement + FNOL) loggees
- **Accessibility WCAG 2.1 AA** : pour majorite users Maroc

---

## EXECUTION SEQUENTIELLE DES 14 TACHES

---

### Tache 4.4.1 : Bootstrap Next.js 14 + apps/web-customer-portal + PWA

**Metadonnees** : P0 | 5h | Depend de : Sprint 16

**But** : Bootstrap Next.js 14 + apps/web-customer-portal + PWA config + theme Sofidemy + i18n 4 langues + structure routes.

**Actions principales attendues** :
- Dossier `repo/apps/web-customer-portal/` (Next.js 14 App Router)
- `next.config.mjs` + `next-pwa` config :
  ```typescript
  import withPWA from 'next-pwa';
  
  const config = withPWA({
    dest: 'public',
    register: true,
    skipWaiting: true,
    runtimeCaching: [{
      urlPattern: /^https:\/\/api\.assurflow\.ma\/api\/v1\/customer\//,
      handler: 'NetworkFirst',
      options: { cacheName: 'customer-api-cache', expiration: { maxAgeSeconds: 300 } }
    }]
  })({
    experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } }
  });
  
  export default config;
  ```
- Theme Sofidemy `lib/theme/sofidemy.ts` :
  ```typescript
  export const sofidemyColors = {
    primary: { 50: '#E8EAF1', 500: '#0E1B3D', 900: '#070D1C' }, // bleu marine
    accent: { 50: '#FAF5EC', 500: '#C8A465', 900: '#5B4A2C' }, // gold
    success: '#0F9D58',
    warning: '#F4B400',
    danger: '#DB4437'
  };
  ```
- i18n setup next-intl :
  - `middleware.ts` : detect langue + redirect `/fr`/`/ar`/`/darija`/`/en`
  - `messages/fr.json` + `messages/ar.json` + `messages/ar-MA.json` + `messages/en.json`
- Structure routes squelette :
  ```
  app/
    [locale]/
      layout.tsx
      page.tsx                          # Landing / login redirect
      (auth)/
        login/page.tsx
        register/page.tsx
        forgot-password/page.tsx
      (dashboard)/
        layout.tsx                       # Layout authentifie
        page.tsx                         # Dashboard customer
        policies/
          page.tsx                       # Mes polices
          [id]/page.tsx                  # Detail police
          renew/[id]/page.tsx            # Renouvellement
        sinistres/
          page.tsx                       # Mes sinistres
          new/page.tsx                   # FNOL declaration (NOUVEAU v3.0)
          [id]/page.tsx                  # Detail sinistre + tracking (REFONDU v3.0)
        payments/
          page.tsx                       # Historique paiements
          pay/[premiumId]/page.tsx       # Payer prime
        documents/
          page.tsx
        profile/
          page.tsx
        feedback/
          page.tsx                       # NOUVEAU v3.0
        support/
          page.tsx                       # NOUVEAU v3.0
  ```
- shadcn/ui + Tailwind v4 + lucide-react + framer-motion
- Tanstack Query 5 + Zustand state
- Tests Vitest + Playwright

**Fichiers cibles principaux** :
- `repo/apps/web-customer-portal/next.config.mjs`
- `repo/apps/web-customer-portal/middleware.ts`
- `repo/apps/web-customer-portal/lib/theme/sofidemy.ts`
- `repo/apps/web-customer-portal/messages/*.json` (4 langues)

**Criteres P0 cles** :
- V1 (P0) : Next.js 14 + PWA active
- V2 (P0) : Theme Sofidemy applique
- V3 (P0) : 4 langues i18n configurees
- V4 (P0) : Build production OK

**Commit** :
```bash
git commit -m "feat(sprint-17): REFONTE bootstrap nextjs 14 + customer portal + pwa + i18n 4 langues

Task: 4.4.1
Sprint: 17 (Phase 4 / Sprint 4)
Phase: 4 -- Vertical Insure
Decisions: decision-011 + decision-008 multilingue"
```

---

### Tache 4.4.2 : Auth customer + onboarding + KYC simplifie

**Metadonnees** : P0 | 6h | Depend de : 4.4.1

**But** : Auth customer email/phone + OTP SMS + onboarding KYC simplifie (CIN + selfie + adresse).

**Actions principales** :
- Pages LoginPage + RegisterPage + KycWizard (3 etapes)
- Integration @insurtech/auth Sprint 5 :
  - Login email OU phone + password
  - 2FA OTP SMS sur premier login + actions critiques (paiement + FNOL)
- KYC wizard :
  - Etape 1 : CIN front + back upload
  - Etape 2 : Selfie (verification visage)
  - Etape 3 : Adresse + zone Maroc + phone confirme
- Service `customer-onboarding.service.ts` :
  - `registerCustomer(input)` -- Zod validation + create user + send OTP
  - `verifyOtpAndActivate(userId, otp)` -- verify + activate
  - `submitKyc(userId, files)` -- upload S3 + status pending_kyc_review
  - `approveKyc(userId, reviewerId)` -- broker_admin approve
- Permissions Sprint 7.5a : `customer.profile.update`
- Tests 12+

**Pattern code `customer-onboarding.service.ts`** :
```typescript
@Injectable()
export class CustomerOnboardingService {
  async registerCustomer(input: RegisterCustomerInput): Promise<{ userId: string; otpSent: boolean }> {
    const validated = RegisterCustomerSchema.parse(input);

    // Check unicite email + phone
    const existing = await this.usersRepo.findOne({
      where: [{ email: validated.email }, { phone: validated.phone }]
    });
    if (existing) throw new ConflictException('Email ou phone deja utilise');

    // Hash password argon2id
    const passwordHash = await argon2.hash(validated.password, { type: argon2.argon2id });

    // Create user
    const user = await this.usersRepo.save({
      email: validated.email,
      phone: validated.phone,
      passwordHash,
      role: 'customer',
      status: 'pending_otp_verification',
      preferredLanguage: validated.preferredLanguage || 'fr',
      tenantId: validated.brokerTenantId
    });

    // Generate OTP + send SMS
    const otp = this.generateOtp();
    await this.cache.set(`otp:${user.id}`, otp, 300); // 5 min TTL
    await this.smsService.send(validated.phone, `Votre code Assurflow: ${otp}`);

    this.logger.info({ userId: user.id, action: 'register_customer' });
    return { userId: user.id, otpSent: true };
  }
}
```

**Commit** :
```bash
git commit -m "feat(sprint-17): REFONTE auth customer + onboarding kyc simplifie

Task: 4.4.2
Sprint: 17 (Phase 4 / Sprint 4)
Decisions: decision-012 customer acteur b2c"
```

---

### Tache 4.4.3 : Dashboard customer (vue centrale)

**Metadonnees** : P0 | 5h | Depend de : 4.4.2

**But** : Dashboard centralise customer avec cards principales (polices actives + sinistres en cours + paiements pending + alertes echeances).

**Actions principales** :
- Page `/(dashboard)/page.tsx` :
  - Section "Polices actives" : cards par police (vehicle/sante/habitation) + status + echeance prime
  - Section "Sinistres en cours" : cards avec status workflow + Sky AI estimated severity
  - Section "Paiements pending" : factures a payer + dates limites
  - Section "Alertes" : renewal proche / agrement expiry / payment overdue
  - Section "Actions rapides" : "Declarer un sinistre" (CTA principal) + "Voir mes polices" + "Payer une prime"
- Service `customer-dashboard.service.ts` :
  - `getDashboardData(customerUserId)` -> KPIs + alertes
- Real-time updates : SSE pour status changes
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-17): dashboard customer centralisé + actions rapides

Task: 4.4.3
Sprint: 17 (Phase 4 / Sprint 4)"
```

---

### Tache 4.4.4 : Polices visualisation + souscription + renewal

**Metadonnees** : P0 | 7h | Depend de : 4.4.3

**But** : Visualisation polices customer + workflow souscription nouvelle police + renouvellement.

**Actions principales** :
- Page `/policies/page.tsx` : Liste polices avec tabs (Actives / Expirees / Brouillons)
- Page `/policies/[id]/page.tsx` : Detail police complet (couvertures + primes + documents + sinistres lies)
- Page `/policies/new/page.tsx` : Workflow souscription 5 etapes :
  - Etape 1 : Selection branche (auto / sante / multirisque / RC pro / voyage)
  - Etape 2 : Selection produit + couvertures
  - Etape 3 : Devis avec tarification engine (Sprint 14 Tache 4.1.2)
  - Etape 4 : Validation devis + signature Barid eSign (Sprint 10)
  - Etape 5 : Paiement premier acompte (Sprint 11)
- Page `/policies/renew/[id]/page.tsx` : Workflow renewal (auto-fill data + ajustement couvertures + signature)
- Service `customer-policies.service.ts` :
  - `listMyPolicies(customerUserId, filters)`
  - `getPolicyDetails(policyId, customerUserId)` -- with permission check
  - `requestQuote(input)` -- delegate Sprint 14
  - `subscribePolicy(quoteId, signatureId)` -- delegate Sprint 14 + paiement
  - `renewPolicy(policyId, adjustments)` -- delegate Sprint 14 renewals
- Permissions Sprint 7.5a : `customer.policies.view` + `customer.policies.renew`
- Tests 12+

**Commit** :
```bash
git commit -m "feat(sprint-17): polices visualisation + workflow souscription + renewal

Task: 4.4.4
Sprint: 17 (Phase 4 / Sprint 4)"
```

---

### Tache 4.4.5 : NOUVEAU -- FNOL declaration (First Notice Of Loss)

**Metadonnees** : P0 | 7h | Depend de : 4.4.4

**But** : **NOUVEAU v3.0** -- Page FNOL declaration sinistre avec photos + documents + description vocale + Sprint 24 Tache 5.6.1 trigger.

**Actions principales attendues** :
- Page `/sinistres/new/page.tsx` -- workflow declaration 6 etapes :
  - Etape 1 : Selection police concernee (depuis polices customer)
  - Etape 2 : Type sinistre (collision / vol / incendie / weather / autre)
  - Etape 3 : Date + heure + lieu (geolocation auto + map)
  - Etape 4 : Description (text + audio recording optional -- transcription Sky AI)
  - Etape 5 : Photos sinistre (camera capture + upload S3)
  - Etape 6 : Documents (constat amiable PDF + temoignages + autres)
- Composant `<FnolWizard>` (~600 lignes) avec progress bar + save draft automatique chaque etape
- Service `customer-fnol-declaration.service.ts` :
  - `createDraft(input)` -- create row repair_sinistres status='fnol_draft'
  - `uploadPhotos(sinistreId, files)` -- S3 + AI quick analysis
  - `recordAudio(sinistreId, audioBlob)` -- transcription via Sky AI (Sprint 20b)
  - `submitFnol(sinistreId)` -- trigger Sprint 24 Tache 5.6.1 (auto-create + carrier review)
- Integration Sprint 24 cross-tenant `customer_to_carrier_fnol` (verifier type whitelist Sprint 7.5b)
- Notifications post-submit :
  - Email customer confirmation (data sensible OK)
  - WhatsApp customer status "FNOL recu, en revue carrier" (whitelist scope strict)
  - Email carrier (notification FNOL + lien direct)
- Permission Sprint 7.5a : `customer.sinistres.declare_fnol`
- Audit ACAPS log obligatoire
- Tests 15+

**Pattern code `customer-fnol-declaration.service.ts.submitFnol`** :
```typescript
async submitFnol(sinistreId: string, customerUserId: string): Promise<{ sinistreId: string; trackingUrl: string }> {
  const sinistre = await this.sinistresRepo.findOne({
    where: { id: sinistreId, fnolDeclaredByUserId: customerUserId }
  });
  if (!sinistre) throw new NotFoundException();
  if (sinistre.status !== 'fnol_draft') throw new ConflictException('Sinistre deja submitted');

  // Validate completeness
  const checks = await this.validateFnolCompleteness(sinistreId);
  if (!checks.isComplete) throw new BadRequestException(`Manquant: ${checks.missing.join(', ')}`);

  // Transition status
  await this.sinistresRepo.update(sinistreId, {
    status: 'declared',
    fnolDeclaredAt: new Date(),
    fnolSource: 'customer_app'
  });

  // Emit event Kafka (Sprint 24 master orchestrator consume)
  await this.kafkaProducer.send({
    topic: 'insurtech.events.repair.sinistre.fnol_declared',
    messages: [{ key: sinistreId, value: JSON.stringify({ sinistreId, customerUserId, declaredAt: new Date() }) }]
  });

  // Cross-tenant authorization (Sprint 7.5b)
  await this.crossTenantService.createAuthorization({
    type: 'customer_to_carrier_fnol',
    sourceTenantId: sinistre.tenantId,
    targetTenantId: sinistre.carrierTenantId,
    resourceId: sinistreId,
    expiresAt: addDays(new Date(), 30)
  });

  // Notifications
  await this.emailService.send({
    to: customerUserId,
    template: 'customer-fnol-confirmation',
    data: { sinistreId, trackingUrl: `https://customer.assurflow.ma/sinistres/${sinistreId}` }
  });

  await this.whatsappService.sendWhatsAppStatus({
    to: sinistre.customerPhone,
    template: 'fnol_received_carrier_review',  // whitelist template
    data: { tracking_url: `https://customer.assurflow.ma/sinistres/${sinistreId}` }
    // BLACKLIST: amount, price, total_mad, devis, cin
  });

  // Audit ACAPS
  await this.acapsAudit.log({
    entityType: 'sinistre',
    entityId: sinistreId,
    action: 'fnol_declared',
    userId: customerUserId,
    metadata: { source: 'customer_app', photosCount: sinistre.fnolAttachedPhotos.length }
  });

  return { sinistreId, trackingUrl: `https://customer.assurflow.ma/sinistres/${sinistreId}` };
}
```

**Criteres P0 cles** :
- V1 (P0) : Workflow 6 etapes complete
- V2 (P0) : Save draft automatique chaque etape (resilience offline)
- V3 (P0) : Trigger Sprint 24 Tache 5.6.1
- V4 (P0) : Cross-tenant customer_to_carrier_fnol auto-create
- V5 (P0) : Audit ACAPS log
- V6 (P0) : Permission customer.sinistres.declare_fnol enforce
- V7 (P0) : Tests 15+ PASS

**Commit** :
```bash
git commit -m "feat(sprint-17): NOUVEAU fnol declaration wizard + trigger sprint 24

Task: 4.4.5
Sprint: 17 (Phase 4 / Sprint 4)
Decisions: decision-012 customer acteur + sprint 24 master orchestrator"
```

---

### Tache 4.4.6 : Sinistres list + filters + status overview

**Metadonnees** : P0 | 4h | Depend de : 4.4.5

**But** : Page liste sinistres customer avec filtres + status overview.

**Actions** :
- Page `/sinistres/page.tsx` -- Liste avec tabs (En cours / Resolus / Annules) + filtres (type + date + police)
- Card sinistre : sinistre_id + type + date + status workflow + Sky AI severity + actions (voir details + tracking)
- Service `customer-sinistres-list.service.ts.listMySinistres(customerUserId, filters)`
- Permission `customer.sinistres.read_mine`
- Tests 6+

**Commit** :
```bash
git commit -m "feat(sprint-17): sinistres list + filters customer

Task: 4.4.6"
```

---

### Tache 4.4.7 : REFONDU -- Tracking sinistre real-time SSE (12 milestones)

**Metadonnees** : P0 | 7h | Depend de : 4.4.6

**But** : **REFONDU v3.0** -- Page tracking real-time sinistre avec SSE + visualisation 12 milestones + Sky AI status humanise.

**Actions principales** :
- Page `/sinistres/[id]/page.tsx` :
  - Section "Statut actuel" : milestone current + Sky AI explication humanisee
  - Section "Timeline" : 12 milestones visualises avec progress bar + dates + acteur (carrier/tow/expert/garage)
  - Section "Acteurs impliques" : carrier + tow + expert + garage avec contacts (sans data sensible)
  - Section "Documents" : devis + rapport expert (PDF download)
  - Section "Communications" : historique notifications + chat support
  - Section "Actions customer" : signer reception + donner feedback + contester
- 12 milestones (Sprint 24 Tache 5.6.10) :
  1. declared (FNOL recu)
  2. carrier_reviewed (carrier accepte le dossier)
  3. tow_dispatched (depanneur en route, si applicable)
  4. vehicle_received (vehicule au garage)
  5. diagnosed (diagnostic complete)
  6. devis_sent_expert (devis envoye expert pour validation)
  7. expert_validated (expert valide devis)
  8. carrier_approved (carrier approuve paiement)
  9. parts_ordered (pieces commandees)
  10. repair_in_progress (reparation en cours)
  11. qc_done (controle qualite complete)
  12. ready_for_delivery (pret pour livraison)
- Composant `<SinistreTrackingTimeline>` (~400 lignes) avec animations framer-motion
- Service `customer-realtime-tracking.service.ts` (front-side) :
  - SSE subscription `EventSource('/api/v1/customer/sinistres/${id}/stream')`
  - `useRealtimeTracking(sinistreId)` -- React hook
- Backend integration : Sprint 24 Tache 5.6.10 `subscribeToSinistreUpdates`
- Permission `customer.sinistres.track_progress`
- Tests 12+

**Pattern code hook `useRealtimeTracking`** :
```typescript
export function useRealtimeTracking(sinistreId: string) {
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [history, setHistory] = useState<Milestone[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/v1/customer/sinistres/${sinistreId}/stream`);
    
    eventSource.addEventListener('milestone', (event) => {
      const data = JSON.parse(event.data) as Milestone;
      setMilestone(data);
      setHistory(prev => [...prev, data]);
    });

    eventSource.addEventListener('sky_ai_status', (event) => {
      const data = JSON.parse(event.data) as { confidence: number; humanizedMessage: string };
      // Update UI with humanized Sky AI message
    });

    eventSource.onerror = () => {
      // Reconnect logic
      setTimeout(() => eventSource.close(), 5000);
    };

    return () => eventSource.close();
  }, [sinistreId]);

  return { currentMilestone: milestone, milestoneHistory: history };
}
```

**Criteres P0 cles** :
- V1 (P0) : 12 milestones definies + visualises
- V2 (P0) : SSE real-time updates fonctionnels
- V3 (P0) : Sky AI status humanise (Sprint 20b confidence + message)
- V4 (P0) : Animations framer-motion smooth
- V5 (P0) : Tests 12+ PASS

**Commit** :
```bash
git commit -m "feat(sprint-17): REFONDU tracking sinistre real-time sse 12 milestones

Task: 4.4.7
Sprint: 17 (Phase 4 / Sprint 4)
Decisions: sprint 24 master orchestrator + sky ai integration"
```

---

### Tache 4.4.8 : NOUVEAU -- Sky AI integration customer (status + estimation)

**Metadonnees** : P0 | 5h | Depend de : 4.4.7

**But** : **NOUVEAU v3.0** -- Integration Sky AI cote customer : humanisation status + estimation pre-traitement + confiance affichee.

**Actions** :
- Composant `<SkyAiHumanizedStatus>` : prend output Sprint 20b -> message clair customer
- Composant `<SkyAiSeverityEstimate>` : affiche severity estimee (minor/major/total_loss) + confidence color (green > 90% / yellow 70-90% / red < 70%)
- Service `customer-sky-ai-integration.service.ts.humanizeStatus(sinistreId)` :
  - Call Sprint 20b Sky AI Decision Engine
  - Transform output technique -> message customer (fr/ar/darija/en)
  - Show confidence indicator visible
- Cache 5 min (eviter spam API Sky AI)
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-17): NOUVEAU sky ai integration customer status humanise

Task: 4.4.8
Decisions: decision-013 sky ai recommande + customer transparency"
```

---

### Tache 4.4.9 : Paiements primes + factures + history

**Metadonnees** : P0 | 6h | Depend de : 4.4.8

**But** : Workflow paiement primes via Sprint 11 Pay MA (CMI + virement + Mobile Money) + history complet.

**Actions** :
- Page `/payments/page.tsx` -- Historique paiements (paid / pending / overdue / refunded)
- Page `/payments/pay/[premiumId]/page.tsx` -- Workflow paiement 4 etapes :
  - Etape 1 : Detail prime + montant + echeance
  - Etape 2 : Selection moyen paiement (CMI carte / virement / Mobile Money WafaCash/CashPlus)
  - Etape 3 : Validation + 3D Secure (CMI)
  - Etape 4 : Confirmation + recu
- Service `customer-payments.service.ts` :
  - `listMyPayments(customerUserId, filters)`
  - `initiatePayment(premiumId, method)` -- delegate Sprint 11
  - `getPaymentReceipt(paymentId)` -- PDF download
- Conformite BAM : limit 100k MAD + 3D Secure obligatoire (Sprint 11)
- decimal.js precision
- Permission `customer.payments.initiate` + `customer.payments.view`
- Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-17): paiements primes + factures + history customer

Task: 4.4.9"
```

---

### Tache 4.4.10 : Documents personnels (download + sharing)

**Metadonnees** : P0 | 4h | Depend de : 4.4.9

**But** : Page documents personnels customer (polices PDF + recus + rapports + attestations).

**Actions** :
- Page `/documents/page.tsx` -- Liste documents avec filtres (type + date + police)
- Service `customer-documents.service.ts.listMyDocuments(customerUserId)`
- Download S3 signed URLs (expiration 1h)
- Sharing : generate magic link 24h (sans auth) pour partage tiers (notaire / banque)
- Permission `customer.documents.read`
- Tests 6+

**Commit** :
```bash
git commit -m "feat(sprint-17): documents personnels + magic links sharing

Task: 4.4.10"
```

---

### Tache 4.4.11 : Profile + preferences + multilingue

**Metadonnees** : P0 | 4h | Depend de : 4.4.10

**But** : Page profile customer + preferences notifications + selection langue + parametres securite.

**Actions** :
- Page `/profile/page.tsx` :
  - Section "Informations personnelles" : nom + email + phone + CIN (read-only post-KYC)
  - Section "Adresse" : modifiable avec validation Sprint 14
  - Section "Langue preferee" : fr / ar / ar-MA (darija) / en
  - Section "Notifications" : checkboxes (email + SMS + WhatsApp + push)
  - Section "Securite" : change password + 2FA management + sessions actives
- Service `customer-profile.service.ts` :
  - `getProfile(customerUserId)`
  - `updateProfile(customerUserId, updates)` -- Zod validation
  - `updateLanguage(customerUserId, language)`
  - `updateNotificationPreferences(customerUserId, prefs)`
- Permission `customer.profile.update`
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-17): profile + preferences + multilingue customer

Task: 4.4.11"
```

---

### Tache 4.4.12 : NOUVEAU -- Feedback + ratings + support

**Metadonnees** : P0 | 5h | Depend de : 4.4.11

**But** : **NOUVEAU v3.0** -- Pages feedback + ratings sinistres + support customer (chat + tickets).

**Actions** :
- Page `/feedback/page.tsx` -- Soumission feedback (5 etoiles + commentaires + categorie)
- Page `/support/page.tsx` -- Centre d'aide + FAQ + creation ticket support + chat live (integration Sprint 9 Comm)
- Service `customer-feedback.service.ts` :
  - `submitFeedback(sinistreId, rating, comments)` -- visible carrier analytics
  - `submitSupportTicket(category, message, attachments)`
  - `listMyTickets(customerUserId)`
- Permission `customer.feedback.submit` + `customer.support.contact`
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-17): NOUVEAU feedback ratings + support customer

Task: 4.4.12
Decisions: decision-012 customer voice"
```

---

### Tache 4.4.13 : NOUVEAU -- WhatsApp scope strict customer

**Metadonnees** : P0 | 4h | Depend de : 4.4.12

**But** : **NOUVEAU v3.0** -- Integration WhatsApp notifications customer **scope strict status only** (correction Saad terrain #7).

**Actions** :
- Service customer side : appelle Sprint 9 `whatsapp.service.ts.sendWhatsAppStatus()` (refondu Sprint 9 v3.0)
- 12 templates customer status whitelist :
  1. `customer_otp_login` (login OTP)
  2. `customer_policy_subscribed` (police souscrite)
  3. `customer_premium_due_j15` (J-15 echeance prime)
  4. `customer_premium_due_j7` (J-7)
  5. `customer_premium_due_j3` (J-3)
  6. `customer_premium_overdue` (echeance depassee)
  7. `customer_fnol_received` (FNOL recu)
  8. `customer_fnol_carrier_reviewed` (carrier valide FNOL)
  9. `customer_sinistre_progress_update` (milestone update)
  10. `customer_repair_ready_delivery` (vehicule pret)
  11. `customer_payment_received` (paiement recu)
  12. `customer_feedback_request` (demande feedback post-sinistre)
- Blacklist fields enforced server-side : amount + price + total_mad + cin + devis_total + franchise + token + password
- Email = data sensible (montants OK)
- Tests 10+

**Commit** :
```bash
git commit -m "feat(sprint-17): NOUVEAU whatsapp scope strict customer 12 templates whitelist

Task: 4.4.13
Decisions: correction saad terrain #7"
```

---

### Tache 4.4.14 : Tests E2E 40+ + seeds 20 customers fixtures + accessibility WCAG 2.1 AA

**Metadonnees** : P0 | 11h | Depend de : 4.4.13

**But** : Tests E2E Playwright 40+ scenarios + seeds 20 customers realistic Maroc + accessibility audit WCAG 2.1 AA.

**Actions** :
- Tests E2E happy path : register + KYC + login + subscribe police + FNOL + tracking + paiement + feedback
- Tests multilingue (fr/ar/darija/en switching)
- Tests offline PWA (declare FNOL offline -> sync online)
- Tests WhatsApp scope strict (verify blacklist fields blocked)
- Seeds 20 customers fixtures :
  - 10 Casablanca (varies polices : auto + sante + multirisque)
  - 5 Rabat
  - 3 Marrakech
  - 2 Tanger
  - Profiles varies : 18-65 ans + revenus + sinistralite
- Audit accessibility axe-core CI : WCAG 2.1 AA compliant
- Coverage Sprint 17 >= 85%

**Commit** :
```bash
git commit -m "test(sprint-17): tests e2e 40+ + seeds 20 customers + audit wcag 2.1 aa

Task: 4.4.14
Sprint: 17 (Phase 4 / Sprint 4)"
```

---

## SYNTHESE -- Cloture Sprint 17 v3.0

```bash
# 14 commits Sprint 17
git log --since="1.5 weeks ago" --pretty=format:"%s" -- repo/apps/web-customer-portal | grep "Task: 4.4" | wc -l
# Attendu : 14

# 0 emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/apps/web-customer-portal --include="*.ts" --include="*.tsx" --include="*.md" | wc -l
# Attendu : 0

# Lancer V-17
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-17-sprint-17-verification.md

# Si V-17 GO (>= 95%)
git tag -a "sprint-17-complete-v3-customer-portal" -m "Sprint 17 v3.0 Customer Portal complete

- PWA Next.js 14 multilingue 4 langues
- FNOL declaration + trigger Sprint 24
- Tracking real-time SSE 12 milestones
- Sky AI integration humanise
- WhatsApp scope strict 12 templates
- Feedback + support + accessibility WCAG 2.1 AA
- 40+ tests E2E PASS"

git push origin sprint-17-complete-v3-customer-portal
```

---

## METRIQUES DE VALIDATION

| Metrique | Cible | Mesure |
|----------|-------|--------|
| 14 commits Sprint 17 | 14/14 | git log Task: 4.4.* |
| 4 langues i18n | fr/ar/ar-MA/en | messages/*.json |
| PWA active | Oui | next-pwa config + service worker |
| FNOL workflow 6 etapes | 6 | components/FnolWizard |
| Tracking milestones | 12 | Sprint 24 Tache 5.6.10 |
| WhatsApp templates whitelist | 12 | Sprint 9 STATUS_ONLY_TEMPLATES |
| Permissions customer | 17 | Sprint 7.5a permissions.enum.ts |
| Tests E2E | >= 40 | Playwright |
| Coverage @apps/web-customer-portal | >= 85% | Vitest coverage |
| Accessibility WCAG 2.1 AA | PASS | axe-core CI |

---

## CONFORMITE InsurTech Maroc v3.0

- **Loi 09-08 CNDP** : protection PII customer + consent management
- **Loi 43-20** : signature Barid eSign pour souscription policies
- **Audit ACAPS** : actions critiques loggees 10 ans (souscription / paiement / FNOL)
- **decision-008 multilingue** : 4 langues incluant darija ar-MA pour accessibility
- **WCAG 2.1 AA** : accessibility majority users Maroc

---

## RISQUES + MITIGATIONS

1. **Customer offline-first PWA cassant** -> mitigation : service worker + IndexedDB cache + retry queue Kafka
2. **Multilingue 4 langues maintenance** -> mitigation : auto-extract translation keys + i18n CI checks
3. **WhatsApp scope strict whitelist trop restrictive** -> mitigation : feedback users + ajustement liste templates
4. **Sky AI status humanise mal interprete par customer** -> mitigation : tests user 5 customers reels + A/B testing
5. **Accessibility WCAG 2.1 AA echec** -> mitigation : axe-core CI bloque merge + audit manuel handicap visuel

---

**Fin meta-prompt B-17 v3.0 -- Sprint 17 (4.4) REFONTE Customer Portal.**

**Total taches** : 14 (10 v2.2 + 4 v3.0 nouvelles) | **Effort** : ~75h | **Apport** : Portail Customer complet 6 acteurs + Sky AI + multilingue
