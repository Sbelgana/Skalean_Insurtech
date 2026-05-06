# META-PROMPT B-18 -- SPRINT 18 WEB ASSURE PORTAL + MOBILE PWA

**Version** : v2.2 (Option B -- FIN Phase 4)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 18 / 35 (cumul) -- Phase 4 Sprint 5 (DERNIER)
**Position** : Apres Web Customer Portal, FIN Phase 4
**Numerotation taches** : 4.5.1 a 4.5.14
**Effort total** : ~85 heures developpement / 2 semaines
**Priorite** : P0 (boucle customer journey complete + PWA mobile critique 60%+ trafic MA)

---

## Objectif Global du Sprint

Construire **2 apps clientes pour assures (post-souscription self-service)** :
1. **web-assure-portal** (port 3005, desktop) -- gestion polices + paiements + sinistres
2. **web-assure-mobile** (port 3006, PWA installable) -- declaration sinistre instantanee + notifications push

Customer journey complete bouclee : decouverte (Sprint 17) -> souscription -> validation broker -> police active -> assure self-service (Sprint 18).

A la sortie de ce sprint :
- web-assure-portal Next.js 15 desktop avec auth client (login OTP par email/SMS, pas password classique)
- web-assure-mobile PWA installable (manifest + service worker + push notifications)
- Pages : mes polices + premiums history + paiement reglement + declarer sinistre + mes sinistres + documents + notifications
- Declaration sinistre flow M8 : choisir garage parmi liste Skalean Atlas + autres partenaires
- Auto-creation appointment Sprint 8 chez garage choisi
- Notifications push mobile : status sinistre + reminders premiums
- I18n fr/ar-MA/ar + RTL + mobile-first
- Offline support PWA (cache strategy)
- Tests E2E + Lighthouse PWA audit
- **Phase 4 COMPLETE** : 5/5 sprints livres

---

## Frontiere du Sprint

**INCLUS** :
- web-assure-portal desktop (port 3005)
- web-assure-mobile PWA (port 3006)
- Auth assure : OTP-based (email/SMS) + signup auto-link to existing contact
- Mes polices + detail
- Mes premiums + paiement reglement (consume Pay Sprint 11)
- Declarer sinistre flow M8 : garage selection
- Mes sinistres + suivi statut
- Mes documents + telechargement
- Push notifications PWA
- Service worker offline cache
- I18n + RTL + mobile-first

**EXCLU** (sera ajoute aux sprints suivants) :
- Workflow sinistre cote garage -- Sprint 21 (declaration -> reparation)
- Choix garage flux complet -- Sprint 24 (consommee par Sprint 18 mais developpee separement)
- IA chatbot assure -- Sprint 31 (defere)
- Apps natives iOS/Android -- post-MVP

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 17 : pattern Next.js 15 stable + i18n setup
2. Sortie Sprint 14 + 15 : entites Insure + lifecycle + transferts
3. Sortie Sprint 11 : Pay refunds (paiement premiums)
4. Sortie Sprint 9 : notifications email/WA + 3 templates
5. Sortie Sprint 8 : booking appointments (creation auto chez garage choisi)

---

## Stack Imposee (Sprint 18)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router |
| react | 19.0.0 | with React Compiler |
| @serwist/next | 9.x | service worker PWA + cache strategies |
| web-push | 3.6.x | push notifications backend |
| react-pdf | 9.x | PDF preview documents |
| html5-qrcode | 2.3.x | QR code scanner (verification documents) |
| @tanstack/react-query | 5.62.0 | client mutations |
| zod | 3.24.1 | validation schemas |

Variables env : `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_VAPID_KEY` (push), `VAPID_PRIVATE_KEY` (backend).

---

## Vue d'Ensemble des 14 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 4.5.1 | App skeleton web-assure-portal + PWA setup web-assure-mobile | 6h | P0 | Sprint 17 |
| 4.5.2 | Auth assure : OTP login (email/SMS) + signup auto-link contact | 7h | P0 | 4.5.1 |
| 4.5.3 | Layout assure : header + bottom nav mobile + tablet/desktop sidebar | 5h | P0 | 4.5.2 |
| 4.5.4 | Mes Polices page : list + detail (garanties + premiums + avenants) | 6h | P0 | 4.5.3 |
| 4.5.5 | Premiums Echeancier + Paiement reglement (integration Pay Sprint 11) | 6h | P0 | 4.5.4 |
| 4.5.6 | Declarer Sinistre wizard etape 1 : informations sinistre + photos | 6h | P0 | 4.5.5 |
| 4.5.7 | Declarer Sinistre etape 2 : choix garage M8 (Skalean Atlas + partenaires) | 6h | P0 | 4.5.6 |
| 4.5.8 | Declarer Sinistre etape 3 : appointment booking + confirmation | 5h | P0 | 4.5.7 |
| 4.5.9 | Mes Sinistres : list + detail timeline + suivi statut | 6h | P0 | 4.5.8 |
| 4.5.10 | Mes Documents + telechargement + QR code scanner verification | 5h | P0 | 4.5.9 |
| 4.5.11 | Notifications Center + push notifications PWA | 6h | P0 | 4.5.10 |
| 4.5.12 | Service worker + offline cache strategies | 5h | P0 | 4.5.11 |
| 4.5.13 | I18n fr/ar-MA/ar + RTL + mobile-first responsive | 4h | P0 | 4.5.12 |
| 4.5.14 | Tests E2E Playwright (15+) + Lighthouse PWA audit + Phase 4 closure | 12h | P0 | 4.5.13 |

**Total** : 85 heures.

---

# DETAIL DES 14 TACHES

---

## Tache 4.5.1 -- App Skeleton + PWA Setup

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 6h / Depend de Sprint 17

**But** : Initialiser 2 apps : web-assure-portal (desktop) et web-assure-mobile (PWA installable).

**Decision architecturale** : 1 codebase Next.js partage entre desktop et mobile, OU 2 apps separees ? Decision : **2 apps separees** (desktop port 3005, mobile port 3006) pour optimisations ciblees (mobile-first + PWA features). Code reuse via packages partages (`@insurtech/assure-shared`).

**Livrables checkables** :
- [ ] Folder `repo/apps/web-assure-portal/` (Next.js 15 desktop)
- [ ] Folder `repo/apps/web-assure-mobile/` (Next.js 15 PWA)
- [ ] Package partage `repo/packages/assure-shared/` :
  - Components communs (cards, forms)
  - Hooks (useAssureAuth, useMyPolicies, etc.)
  - API client wrapper
  - Types
- [ ] PWA setup web-assure-mobile :
  - `serwist.config.ts` (service worker config)
  - `manifest.json` (icons + theme + start_url + display: 'standalone')
  - `app/sw.ts` (custom service worker)
  - Icons multiples sizes (512x512, 192x192, etc.)
  - Splash screen iOS
- [ ] Web-assure-portal : layout desktop (sidebar)
- [ ] Web-assure-mobile : layout mobile (bottom nav + headers compacts)
- [ ] Variables env : `NEXT_PUBLIC_VAPID_KEY` (push)
- [ ] Tests : 2 apps demarrent + manifest valid + service worker registered

**Pattern critique : PWA manifest + service worker**

```json
// repo/apps/web-assure-mobile/public/manifest.json
{
  "name": "Skalean Mon Assurance",
  "short_name": "Skalean",
  "description": "Gerez vos polices et declarez vos sinistres en quelques clics",
  "start_url": "/fr",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#1A2730",
  "orientation": "portrait-primary",
  "lang": "fr-MA",
  "icons": [
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-180.png", "sizes": "180x180", "type": "image/png" }
  ],
  "shortcuts": [
    { "name": "Declarer un sinistre", "url": "/fr/sinistres/declarer", "icons": [{ "src": "/icons/sinistre.png", "sizes": "96x96" }] },
    { "name": "Mes polices", "url": "/fr/polices" }
  ],
  "screenshots": [
    { "src": "/screenshots/home.png", "sizes": "1080x1920", "type": "image/png", "form_factor": "narrow" }
  ],
  "categories": ["finance", "lifestyle"],
  "prefer_related_applications": false
}
```

```typescript
// repo/apps/web-assure-mobile/app/sw.ts
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  // Custom : push notifications handler
});

// Push notifications listener
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  const payload = event.data.json();

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/';
  event.waitUntil(self.clients.openWindow(url));
});

serwist.addEventListeners();
```

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/                                                  # full Next.js 15 app
repo/apps/web-assure-mobile/                                                  # full Next.js 15 PWA
repo/apps/web-assure-mobile/public/manifest.json                              # PWA manifest
repo/apps/web-assure-mobile/app/sw.ts                                          # service worker
repo/apps/web-assure-mobile/serwist.config.ts                                  # PWA config
repo/packages/assure-shared/                                                   # shared package
repo/packages/assure-shared/src/components/{several}.tsx                       # ~400 lignes
repo/packages/assure-shared/src/hooks/{several}.ts                              # hooks
repo/packages/assure-shared/src/api/client.ts                                  # API client
repo/packages/assure-shared/package.json
```

**Notes implementation** :
- Serwist : modern Workbox alternative pour Next.js 15
- VAPID keys : generer one-time pour push notifications (web-push lib backend)
- Apple touch icon 180x180 : iOS PWA install
- "share_target" manifest : autoriser apps partager photos vers Skalean (e.g. photos sinistre)

**Criteres validation** :
- V1 (P0) : 2 apps demarrent (3005 + 3006)
- V2 (P0) : Manifest.json valide
- V3 (P0) : Service worker registered + activated
- V4 (P0) : Lighthouse PWA score 100
- V5 (P0) : Installable mobile (Chrome / Safari)
- V6 (P0) : Package shared utilisable par 2 apps
- V7 (P0) : Tests setup 6+ scenarios

---

## Tache 4.5.2 -- Auth Assure : OTP Login + Signup Auto-Link

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 7h / Depend de 4.5.1

**But** : Authentification simplifiee assures via OTP (One-Time Password) email/SMS -- pas password traditionnel (UX mobile-first).

**Contexte** : Assures different brokers : moins de connexions frequentes, securite OTP suffit + meilleure UX. Pattern : entre email -> recoit OTP par email + SMS -> entre 6 chiffres -> connecte. Auto-link : si email match contact existant (Sprint 8) -> link a son dossier.

**Livrables checkables** :
- [ ] Backend (extension Sprint 5 auth) : nouveau endpoint OTP-based
  - `POST /api/v1/auth/assure/request-otp` : email + envoie OTP via Sprint 9 Comm
  - `POST /api/v1/auth/assure/verify-otp` : email + otp -> JWT + auto-link contact
- [ ] OTP : 6 digits aleatoires + TTL 10 min + max 3 tentatives
- [ ] Storage OTP : Redis avec TTL
- [ ] Auto-link logic :
  - Verifier email match `crm_contacts.email` existing
  - Si match : create assure_user link to contact + tenant
  - Si pas match : create new contact basique + assure_user
- [ ] Frontend pages :
  - `/login` : email input + bouton "Recevoir code"
  - `/verify-otp` : 6 chiffres input + auto-submit + bouton "Renvoyer code" (cooldown 60s)
- [ ] JWT assure : claims includes `user_type='assure'`, `linked_contact_id`, `tenants[]`
- [ ] Multi-tenant : si contact lie a plusieurs tenants (multi-broker), redirect select-tenant
- [ ] Tests : OTP flow + auto-link + multi-tenant

**Pattern critique : OTP backend service**

```typescript
// repo/packages/auth/src/services/otp-auth.service.ts
async requestOtp(email: string): Promise<{ otpId: string }> {
  const otp = generateOtp(6);  // 6 digits
  const otpId = uuid();

  // Store Redis TTL 10min
  await this.redis.set(`otp:${otpId}`, JSON.stringify({ email, otp, attempts: 0 }), 'EX', 600);

  // Send via Comm (Sprint 9) : email + SMS si phone available
  const contact = await this.contactService.findByEmail(email);
  await this.commOrchestrator.send({
    type: 'transactional',
    template: 'assure_login_otp',
    locale: contact?.preferred_language ?? 'fr',
    channels: ['email', contact?.phone ? 'whatsapp' : null].filter(Boolean),
    to: { email, phone: contact?.phone },
    variables: { otp, expires_in_minutes: 10 },
  });

  return { otpId };
}

async verifyOtp(otpId: string, otp: string): Promise<{ accessToken: string; refreshToken: string; user: AssureUser }> {
  const stored = await this.redis.get(`otp:${otpId}`);
  if (!stored) throw new BadRequestException({ code: 'OTP_EXPIRED' });

  const { email, otp: storedOtp, attempts } = JSON.parse(stored);

  if (attempts >= 3) {
    await this.redis.del(`otp:${otpId}`);
    throw new TooManyRequestsException({ code: 'OTP_MAX_ATTEMPTS' });
  }

  if (storedOtp !== otp) {
    await this.redis.set(`otp:${otpId}`, JSON.stringify({ email, otp: storedOtp, attempts: attempts + 1 }), 'EX', 600);
    throw new BadRequestException({ code: 'OTP_INVALID', remaining_attempts: 3 - attempts - 1 });
  }

  // OK : delete OTP + auto-link
  await this.redis.del(`otp:${otpId}`);

  let assureUser = await this.assureUsersRepo.findOne({ where: { email } });
  let contact = await this.contactsRepo.findOne({ where: { email } });

  if (!assureUser) {
    if (!contact) {
      // Create contact minimal
      contact = await this.contactsRepo.save({
        email, segment: 'assure', tenant_id: this.defaultTenantId,
        first_name: '', last_name: '',
      });
    }
    assureUser = await this.assureUsersRepo.save({
      email, linked_contact_id: contact.id, status: 'active', last_login_at: new Date(),
    });
  } else {
    await this.assureUsersRepo.update(assureUser.id, { last_login_at: new Date() });
  }

  // Generate JWT
  const accessToken = this.jwtService.sign({
    sub: assureUser.id, user_type: 'assure', linked_contact_id: contact.id,
    tenants: contact.tenant_ids,
  }, { expiresIn: '15m' });
  const refreshToken = this.jwtService.sign({ sub: assureUser.id }, { expiresIn: '30d' });

  return { accessToken, refreshToken, user: assureUser };
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AssureUsers.ts                     # ~40 lignes
repo/packages/auth/src/entities/assure-user.entity.ts                            # ~40 lignes
repo/packages/auth/src/services/otp-auth.service.ts                              # ~250 lignes
repo/apps/api/src/modules/auth/controllers/assure-auth.controller.ts             # ~100 lignes
repo/packages/comm/src/templates/{fr,ar-MA,ar}/assure-login-otp.hbs                # 3 templates
repo/apps/web-assure-portal/app/[locale]/login/page.tsx                          # ~120 lignes
repo/apps/web-assure-portal/app/[locale]/verify-otp/page.tsx                      # ~100 lignes
repo/apps/web-assure-mobile/app/[locale]/login/page.tsx                          # similar mobile
repo/apps/web-assure-mobile/app/[locale]/verify-otp/page.tsx
```

**Criteres validation** :
- V1 (P0) : OTP generation + Redis storage TTL 10min
- V2 (P0) : OTP envoyee email + SMS si phone
- V3 (P0) : Verify correct -> JWT
- V4 (P0) : Wrong OTP : remaining_attempts decremente
- V5 (P0) : Max attempts : OTP invalidated
- V6 (P0) : Auto-link contact existing
- V7 (P0) : Tests 10+ scenarios

---

## Tache 4.5.3 -- Layout Assure : Header + Bottom Nav + Sidebar

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 5h / Depend de 4.5.2

**But** : Layouts adaptes : web-assure-portal (sidebar desktop) et web-assure-mobile (bottom navigation mobile pattern).

**Livrables checkables** :
- [ ] Web-assure-portal layout :
  - Sidebar gauche : Mes polices / Mes sinistres / Mes documents / Notifications / Profil
  - Header top : logo + locale + avatar dropdown
  - Footer minimal
- [ ] Web-assure-mobile layout :
  - Bottom navigation : 5 tabs (Polices / Sinistres / Documents / Notifications / Profil)
  - Header sticky top : logo + back button context-aware + avatar
  - Pas de sidebar (mobile space)
  - Pull-to-refresh sur listes
- [ ] Bouton flottant FAB "Declarer sinistre" : visible toujours mobile (acces rapide critical use case)
- [ ] Notifications badge counter : sync avec service worker push events
- [ ] Tests : navigation + responsive

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/components/layout/sidebar.tsx                       # ~120 lignes
repo/apps/web-assure-portal/components/layout/header.tsx                         # ~100 lignes
repo/apps/web-assure-mobile/components/layout/bottom-nav.tsx                     # ~120 lignes
repo/apps/web-assure-mobile/components/layout/mobile-header.tsx                  # ~100 lignes
repo/apps/web-assure-mobile/components/layout/declare-sinistre-fab.tsx           # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : Desktop sidebar + navigation
- V2 (P0) : Mobile bottom nav 5 tabs
- V3 (P0) : FAB Declarer sinistre persistent
- V4 (P0) : Pull-to-refresh
- V5 (P0) : Tests 6+ scenarios

---

## Tache 4.5.4 -- Mes Polices Page : List + Detail

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 6h / Depend de 4.5.3

**But** : Page mes polices : list + detail riche (garanties + premiums + avenants + actions).

**Livrables checkables** :
- [ ] Page list `/polices` :
  - Cards visuelles per police (compact mobile)
  - Status badge (active / pending / expiring soon / cancelled)
  - Quick info : numero + branche + prime + dates
  - Click -> detail
- [ ] Page detail `/polices/:id` :
  - Header : numero + status + branche
  - Tabs : Info / Garanties / Premiums / Avenants / Documents / Sinistres lies
  - Info : dates + souscripteur + objets assures (si flotte)
  - Garanties : list + capital_max + franchise visibility
  - Actions visibles selon contexte :
    - "Declarer sinistre" si police active
    - "Voir attestation" download
    - "Demander avenant" -> form simple (broker validera)
    - "Renouveler" si expiring 60j
    - "Resilier" -> dialog confirmation
- [ ] Endpoints consume Sprint 14+ /api/v1/insure/policies (filtre par contact_id)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/app/[locale]/polices/page.tsx                       # ~120 lignes
repo/apps/web-assure-portal/app/[locale]/polices/[id]/page.tsx                  # ~250 lignes
repo/apps/web-assure-mobile/app/[locale]/polices/page.tsx                       # similar mobile
repo/apps/web-assure-mobile/app/[locale]/polices/[id]/page.tsx
repo/packages/assure-shared/src/components/policy-card.tsx                       # ~150 lignes (shared)
repo/packages/assure-shared/src/components/policy-detail-tabs.tsx                 # ~250 lignes (shared)
```

**Criteres validation** :
- V1 (P0) : List polices personnel
- V2 (P0) : Detail tabs all functional
- V3 (P0) : Actions selon contexte
- V4 (P0) : Mobile responsive
- V5 (P0) : Tests 8+ scenarios

---

## Tache 4.5.5 -- Premiums Echeancier + Paiement Reglement

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 6h / Depend de 4.5.4

**But** : Page mes premiums : echeancier complet + status paiements + bouton "Payer" qui declenche flow Pay Sprint 11.

**Livrables checkables** :
- [ ] Page `/polices/:id/premiums` :
  - Timeline echeances avec status couleur (paid/pending/overdue)
  - Total paid + pending + total annuel
  - Bouton "Payer" sur echeance pending
  - Click "Payer" -> dialog choix methode -> Pay Sprint 11 initiate -> redirect 3D Secure ou portail provider
  - Return handler : success -> toast + refresh + receipt PDF
- [ ] History payments : preuves paiement + receipts download
- [ ] Auto-payment setup (Phase 7+ : carte memorisee + auto-prelevement echeance)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/app/[locale]/polices/[id]/premiums/page.tsx          # ~150 lignes
repo/packages/assure-shared/src/components/premiums-timeline.tsx                  # ~200 lignes
repo/packages/assure-shared/src/components/payment-method-dialog.tsx              # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Timeline visible
- V2 (P0) : Pay flow complete
- V3 (P0) : Receipts download
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.5.6 -- Declarer Sinistre Etape 1 : Infos + Photos

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 6h / Depend de 4.5.5

**But** : Etape 1 wizard declaration sinistre : infos + photos (camera mobile direct OU upload).

**Livrables checkables** :
- [ ] Page `/sinistres/declarer/etape-1` (mobile prioritise)
- [ ] Selection police impactee (dropdown si multiple)
- [ ] Form :
  - Type sinistre : auto (collision/vol/incendie/...) selon branche
  - Date sinistre + heure
  - Lieu : ville + adresse + GPS coords (mobile geolocation API)
  - Description circonstances (textarea + voice-to-text si supporte)
  - Photos : multiple upload (camera direct mobile OR file picker)
  - Other parties : si tiers implique (radio yes/no + form si yes)
- [ ] Mobile camera integration : `<input type="file" accept="image/*" capture="environment">`
- [ ] Upload photos S3 multi-tenant (Sprint 10) avec compression client-side avant upload
- [ ] GPS auto-fill adresse via Google Maps API (Phase 7+ enrichi)
- [ ] Save draft sessionStorage
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-1/page.tsx     # ~200 lignes
repo/apps/web-assure-mobile/app/[locale]/sinistres/declarer/etape-1/page.tsx     # similar mobile
repo/packages/assure-shared/src/components/sinistre-photos-upload.tsx              # ~200 lignes
repo/packages/assure-shared/src/lib/gps-geolocation.ts                              # ~80 lignes
repo/packages/assure-shared/src/lib/image-compress.ts                                # ~100 lignes
```

**Notes implementation** :
- Camera capture mobile : `capture="environment"` -> back camera (user-friendly UX)
- Compression client : reduce bandwidth + S3 cost (1-2 MB max per photo)
- GPS API : `navigator.geolocation.getCurrentPosition()`
- Voice-to-text : Web Speech API (Chrome/Edge surtout)

**Criteres validation** :
- V1 (P0) : Form complet
- V2 (P0) : Photos upload + compression
- V3 (P0) : Camera mobile direct
- V4 (P0) : GPS geolocation
- V5 (P0) : Save draft
- V6 (P0) : Tests 8+ scenarios

---

## Tache 4.5.7 -- Declarer Sinistre Etape 2 : Choix Garage M8

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 6h / Depend de 4.5.6

**But** : Flux M8 -- assure choisit garage parmi liste garages disponibles : Skalean Atlas (priorite) + autres garages partenaires Cross-Tenant Sprint 25.

**Contexte** : **Decision metier critique** : assure choisit ou faire reparer. Skalean Atlas (filiale Skalean) preferentielle car traitement automatise. Sinon, garages partenaires inscrits cross-tenant Sprint 25. Liste filtree par geolocalisation + branche police.

**Livrables checkables** :
- [ ] Page `/sinistres/declarer/etape-2`
- [ ] List garages disponibles :
  - Skalean Atlas highlighted (premium choice + visual badge)
  - Autres garages partenaires (cross-tenant Sprint 25)
  - Filtre : distance (geolocation user) + ratings + specialite branche
  - Cards : photo garage + nom + adresse + distance + horaires + rating + specialites
- [ ] Selection garage + click "Continuer" -> etape 3
- [ ] Endpoint backend : `GET /api/v1/repair/garages/available?branche=auto&lat=...&lng=...&max_distance_km=20`
- [ ] Sprint 25 cross-tenant fournira liste garages partenaires
- [ ] Sprint 19 Repair Foundation aura entity Skalean Atlas comme premier garage default
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-2/page.tsx      # ~150 lignes
repo/apps/web-assure-mobile/app/[locale]/sinistres/declarer/etape-2/page.tsx       # similar
repo/packages/assure-shared/src/components/garage-card.tsx                          # ~150 lignes
repo/packages/assure-shared/src/components/garages-filters.tsx                       # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : List garages avec geolocalisation
- V2 (P0) : Skalean Atlas highlighted
- V3 (P0) : Filtres distance + rating + specialite
- V4 (P0) : Selection + continue
- V5 (P0) : Tests 6+ scenarios

---

## Tache 4.5.8 -- Declarer Sinistre Etape 3 : Appointment Booking + Confirmation

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 5h / Depend de 4.5.7

**But** : Etape 3 finale : choisir creneau RDV chez garage choisi + confirmation finale + create sinistre + notification garage.

**Livrables checkables** :
- [ ] Page `/sinistres/declarer/etape-3`
- [ ] Calendar widget : creneaux disponibles garage (consume Sprint 8 Booking endpoint)
- [ ] Selection date + heure
- [ ] Recap final visualization
- [ ] Submit "Confirmer declaration" :
  1. Create sinistre row (Sprint 21 entity preparation -- mock dans Sprint 18 si Sprint 21 pas livre, OR endpoint draft)
  2. Create appointment (Sprint 8) chez garage selectionne au creneau choisi
  3. Notify garage (Sprint 9 Comm) : email + WhatsApp
  4. Notify assure : confirmation email + SMS WhatsApp + push notification
- [ ] Page confirmation finale `/sinistres/declarer/confirmation` :
  - Big "Sinistre declare" message
  - Recap : numero sinistre + garage + RDV
  - Bouton "Voir mon sinistre" -> mes sinistres detail
  - Reminder : pieces a apporter au RDV (carte grise, attestation, etc.)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/etape-3/page.tsx       # ~150 lignes
repo/apps/web-assure-portal/app/[locale]/sinistres/declarer/confirmation/page.tsx  # ~120 lignes
repo/packages/assure-shared/src/components/calendar-widget.tsx                       # ~180 lignes
```

**Criteres validation** :
- V1 (P0) : Calendar widget creneaux
- V2 (P0) : Submit cree sinistre + appointment
- V3 (P0) : Notifications garage + assure
- V4 (P0) : Confirmation page
- V5 (P0) : Tests 6+ scenarios

---

## Tache 4.5.9 -- Mes Sinistres : List + Detail Timeline

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 6h / Depend de 4.5.8

**But** : Page mes sinistres : list + detail avec timeline statut + tracking en temps reel.

**Livrables checkables** :
- [ ] Page list `/sinistres` :
  - Cards per sinistre : numero + date + garage + status + amount
  - Status badge couleur (declared/acknowledged/expert_assigned/parts_ordered/in_repair/completed/closed)
- [ ] Page detail `/sinistres/:id` :
  - Header : numero + status big
  - Timeline visuelle : chaque transition statut avec date + responsable + commentaire
  - Photos sinistre + estimation devis + facture finale
  - Garage info + contact
  - Documents lies
  - Bouton "Contacter garage" : whatsapp/phone direct
  - Bouton "Annuler sinistre" : si pas encore demarre
- [ ] Real-time updates : poll /sinistres/:id toutes 30s OR Server-Sent Events (Phase 7+)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/app/[locale]/sinistres/page.tsx                        # ~120 lignes
repo/apps/web-assure-portal/app/[locale]/sinistres/[id]/page.tsx                   # ~200 lignes
repo/packages/assure-shared/src/components/sinistre-timeline.tsx                     # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : List + filtres
- V2 (P0) : Detail timeline visuelle
- V3 (P0) : Status updates polling
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.5.10 -- Mes Documents + QR Scanner

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 5h / Depend de 4.5.9

**But** : Page mes documents : list + telechargement + QR scanner verification documents (cas police lecture sur smartphone).

**Livrables checkables** :
- [ ] Page list `/documents` : tous documents lies a l'assure (polices PDF + factures + attestations + bulletins)
- [ ] Filters : type doc + date_range + police lien
- [ ] PDF preview inline (`react-pdf`)
- [ ] Download : signed URL S3
- [ ] QR Scanner page `/documents/scan-qr` :
  - Camera mobile interface (`html5-qrcode`)
  - Scan QR -> redirect /verify-doc/:hash (Sprint 10 verification publique)
  - Display verification result : valide / invalid / signature info
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/app/[locale]/documents/page.tsx                        # ~150 lignes
repo/apps/web-assure-mobile/app/[locale]/documents/scan-qr/page.tsx                # ~150 lignes (camera scanner)
repo/packages/assure-shared/src/components/qr-scanner.tsx                            # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : List documents
- V2 (P0) : PDF preview + download
- V3 (P0) : QR scanner camera
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.5.11 -- Notifications Center + Push PWA

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 6h / Depend de 4.5.10

**But** : Centre notifications in-app + push notifications PWA mobile (criticum sinistre updates + reminders premiums).

**Livrables checkables** :
- [ ] Page `/notifications` : list + filters + mark read/unread
- [ ] Backend : table `notifications` + endpoints
- [ ] Push notifications subscription PWA :
  - Lors premiere visite mobile : prompt user "Activer notifications ?"
  - Si accept : `Notification.requestPermission()` + `pushManager.subscribe(VAPID_PUBLIC_KEY)`
  - Save subscription dans DB (assure_users.push_subscription)
- [ ] Backend send push notification :
  - Sprint 9 Comm orchestrator etend channel='push'
  - Web-push lib backend send to subscription
  - Events : sinistre status change, premium reminder, police signed/cancelled
- [ ] Service worker handler : afficher notification + click -> open app page concernee
- [ ] Settings : opt-in/out per type notification
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-Notifications.ts                      # ~40 lignes
repo/packages/notifications/src/services/push-subscription.service.ts               # ~150 lignes
repo/packages/notifications/src/services/web-push-sender.service.ts                  # ~120 lignes
repo/apps/web-assure-mobile/components/push/permission-prompt.tsx                    # ~80 lignes
repo/apps/web-assure-portal/app/[locale]/notifications/page.tsx                       # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Subscription PWA fonctionne
- V2 (P0) : Backend send push
- V3 (P0) : Service worker handler
- V4 (P0) : Settings opt-in/out
- V5 (P0) : Tests 6+ scenarios

---

## Tache 4.5.12 -- Service Worker + Offline Cache

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 5h / Depend de 4.5.11

**But** : Service worker offline cache strategies (PWA-quality experience meme connexion intermittente).

**Livrables checkables** :
- [ ] Cache strategies Serwist :
  - **Static assets** : Cache First (JS/CSS/images)
  - **API requests** : Network First fallback Cache (donnees fraiches mais offline OK)
  - **Photos sinistres pending upload** : Background Sync (retry quand online)
- [ ] Offline page custom : "Vous etes hors ligne. Vos polices sont visibles. Pas de declaration sinistre possible offline."
- [ ] Background sync : photos sinistre pending stockes IndexedDB, sync quand online
- [ ] Tests offline mode

**Fichiers crees / modifies** :
```
repo/apps/web-assure-mobile/app/sw.ts                                               # update with cache strategies
repo/apps/web-assure-mobile/app/[locale]/offline/page.tsx                            # ~80 lignes
repo/packages/assure-shared/src/lib/background-sync.ts                                # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Cache static assets
- V2 (P0) : Network First API
- V3 (P0) : Background sync upload
- V4 (P0) : Offline page custom
- V5 (P0) : Tests offline 5+ scenarios

---

## Tache 4.5.13 -- I18n + RTL + Mobile-First Responsive

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 4h / Depend de 4.5.12

**But** : Internationalisation 3 locales + RTL + mobile-first responsive (critique 60%+ users mobile MA).

**Livrables checkables** :
- [ ] Messages 3 locales (fr / ar-MA / ar) -- ~500 keys per locale
- [ ] RTL CSS appliquee ar/ar-MA
- [ ] Mobile-first : breakpoints sm/md/lg/xl
- [ ] Touch-friendly : tap targets 44px+
- [ ] PWA : viewport-fit cover (notch iPhone)
- [ ] Tests responsive multiple viewports

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/messages/{fr,ar-MA,ar}.json
repo/apps/web-assure-mobile/messages/{fr,ar-MA,ar}.json
repo/packages/assure-shared/messages/{shared keys}.json
```

**Criteres validation** :
- V1 (P0) : 3 locales complete
- V2 (P0) : RTL fonctionne
- V3 (P0) : Mobile-first all viewports
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.5.14 -- Tests E2E + Lighthouse PWA + Phase 4 Closure

**Metadonnees** : Phase 4 / Sprint 18 / P0 / 12h / Depend de 4.5.13

**But** : Suite tests E2E exhaustive + Lighthouse PWA audit + closure officielle Phase 4.

**Livrables checkables** :

**Tests E2E (15+)** :
- [ ] Auth OTP : request + verify + auto-link contact (4)
- [ ] Polices : list + detail + actions (3)
- [ ] Premiums : timeline + payment flow (2)
- [ ] Declarer sinistre wizard 3 etapes (3)
- [ ] Mes sinistres : list + detail timeline (2)
- [ ] Notifications + push subscription (2)
- [ ] Documents + QR scanner (2)

**Lighthouse PWA audit** :
- [ ] Performance > 90
- [ ] PWA = 100
- [ ] Accessibility > 90
- [ ] Best Practices > 95
- [ ] SEO > 90

**Phase 4 Closure document `repo/docs/phase-4-completion.md`** :
- 5 sprints livres : Foundation / Lifecycle Avance / Web Broker / Web Customer Portal / Web Assure
- 67 taches detaillees Phase 4 (14+13+14+14+14)
- 7 entities Insure + 8 web apps + plus
- Customer journey complete operationnelle
- Skalean Broker ERP **production-ready** sans connecteurs assureurs (lookup tables)

**Fichiers crees / modifies** :
```
repo/apps/web-assure-portal/e2e/{15+ specs}.spec.ts
repo/apps/web-assure-mobile/e2e/{15+ specs}.spec.ts
repo/docs/phase-4-completion.md                                                  # closure
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent
- V2 (P0) : Lighthouse PWA 100
- V3 (P0) : Phase 4 closure document
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 18

A la fin de l'execution des 14 taches :

```
Web Assure Portal + Mobile PWA operational :
  - web-assure-portal Next.js 15 (port 3005)
  - web-assure-mobile PWA (port 3006) installable
  - Auth OTP email/SMS + auto-link contact
  - 7 pages : polices + premiums + declarer sinistre wizard 3 etapes + mes sinistres + documents + notifications + profil
  - PWA : manifest + service worker + push notifications + offline cache
  - Background sync upload photos sinistre
  - QR scanner documents verification
  - I18n fr/ar-MA/ar + RTL + mobile-first
  - 15+ tests Playwright E2E
  - Lighthouse PWA 100

PHASE 4 VERTICAL INSURE : COMPLETE (5/5 sprints)
```

**PHASE 4 RECAP** :

| Sprint | Module | Status |
|--------|--------|--------|
| B-14 | Insure Foundation (7 entities + tarification) | OK |
| B-15 | Insure Lifecycle Avance (transferts/suspensions/flottes/endossements/queue/provisional) | OK |
| B-16 | Web Broker App | OK |
| B-17 | Web Customer Portal (vente en ligne SEO) | OK |
| B-18 | Web Assure Portal + Mobile PWA | OK |

**Sprint 19 (Phase 5 Vertical Repair Foundation) demarre avec** :
- Skalean Broker ERP **production-ready** complete
- Customer journey complete bouclee
- Pattern Phase 4 valide pour Phase 5 (memes ingredients : entities + web apps)
- Skalean Atlas garage = premier repair tenant

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-4.5.X-*.md` dans `00-pilotage/prompts-taches/sprint-18-web-assure/`.

**Patterns code inline conserves** : PWA manifest + service worker push handler, OTP auth backend service avec auto-link contact.

**Reference** : Sprint 17 pattern Next.js 15 + i18n stable.

---

**Fin du meta-prompt B-18 v2.2 format Option B. PHASE 4 COMPLETE.**
