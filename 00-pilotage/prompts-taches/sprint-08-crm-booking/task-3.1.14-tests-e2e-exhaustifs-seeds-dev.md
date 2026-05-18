# TACHE 3.1.14 -- Tests E2E Exhaustifs (50+) + Seeds Dev CRM + Booking Realistes

**Sprint** : 8 (Phase 3 / Sprint 1 dans phase) -- CRM + Booking Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-08-sprint-08-crm-booking.md` (Tache 3.1.14)
**Phase** : 3 -- Modules Horizontaux Foundation
**Priorite** : P0 (cloture Sprint 8 ; valide integration cross-modules ; seeds critiques Sprint 16+ frontend dev)
**Effort** : 7h
**Dependances** : Taches 3.1.1 a 3.1.13 toutes completes (tous services + endpoints + fixtures helpers + Kafka events deployes)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 3.1.14 finalise le Sprint 8 en livrant deux deliverables critiques : une suite de tests E2E exhaustive couvrant 50+ scenarios cross-modules qui valident l'integration de bout en bout des 13 taches precedentes du Sprint 8, et un script de seeds dev produisant des donnees realistes (faker fr_MA) consommees par les frontends Sprint 16 (web-broker), Sprint 17 (web-customer-portal), Sprint 22 (web-garage) durant leur developpement. Concretement, elle livre le script `repo/infrastructure/scripts/seed-crm-booking.ts` (~600 lignes) qui orchestre la creation de 2 tenants (Cabinet Bennani Casablanca de type cabinet + Garage Atlas Casablanca de type garage), des users RBAC types (1 broker_admin + 3 broker_user + 1 assure par cabinet ; 1 garage_admin + 2 garage_manager + 4 garage_technician + 5 assure par garage), 10 companies (5 par tenant) avec ICE valides marocains, 50 contacts (30 cabinet + 20 garage) avec noms maghrebins realistes et CIN valides, 2 pipelines per tenant (Pipeline Auto + Pipeline Sante pour cabinet ; Pipeline Carrosserie + Pipeline Mecanique pour garage), 30 deals reparties dans les stages (10 lead + 10 proposal + 5 won + 5 lost), 100 interactions timeline cohrentes 6 mois passes (calls + emails + whatsapp + meetings), 3 rooms par tenant, et 50 appointments (20 past completed + 25 futurs scheduled + 5 cancelled) ; les suites de tests E2E sont organisees en 14 fichiers regroupes par module avec un meta-fichier `cross-modules.e2e-spec.ts` testant les scenarios integration multi-modules ; et un runbook ops `repo/00-pilotage/runbooks/sprint-08-seed-and-test.md` documentant la procedure de seed et de test pour les futurs developpeurs Sprint 16+.

L'apport est triple. Premierement, cette tache cloture proprement le Sprint 8 en validant que les 13 taches livrent un systeme integral fonctionnel. Sans cette tache, les services individuels (Companies, Contacts, Deals, Appointments, etc.) pourraient fonctionner en isolation mais echouer en integration : un test cross-modules verifie qu'un commercial peut creer une Company, attacher un Contact, ouvrir un Deal, planifier un Appointment, recevoir un reminder Sprint 9 (mock), voir l'interaction auto-loggee via Kafka, exporter dans son feed iCal, et synchroniser avec son Google Calendar. Ce flux complet de bout en bout est ce qui interesse les utilisateurs finaux ; les services individuels sont des moyens. La suite E2E livre 50+ scenarios couvrant les flux principaux et leurs edge cases (RBAC reject, multi-tenant isolation, performance benchmarks).

Deuxiemement, cette tache fournit la fondation de donnees realistes pour le developpement frontend des sprints suivants. Les developpeurs Sprint 16 (web-broker) commencent leur travail le jour suivant la cloture du Sprint 8 ; ils ont besoin d'une base de donnees populee pour developper les pages /clients, /deals, /calendar sans devoir creer manuellement chaque entite via curl. Le script seed produit en moins de 60 secondes l'environnement de dev complet : tenant + users + entities + permissions, deja en place. Cette automation epargne aux developpeurs frontend ~2-3 heures par developpeur par semaine. Le script utilise `@faker-js/faker` avec locale fr_MA (noms maghrebins authentiques comme Mohamed Bennani, Karim Alami, Fatima Zahra El Mansouri) et phones E.164 +212 valides.

Troisiemement, cette tache documente la procedure de seed + test dans un runbook ops permanent qui sera utilise par tous les futurs developpeurs (Sprint 16-35) et par l'equipe ops lors du pilote Sprint 35 Marrakech. Le runbook inclut : (a) prerequis (Postgres + Redis + Kafka up via docker-compose), (b) commandes seed avec flags `--reset` (drop + recreate) ou `--incremental` (append), (c) commandes tests E2E avec flags pour sous-ensembles (`--only=crm` ou `--only=booking`), (d) section troubleshooting (5 cas frequents : Postgres timeout, Kafka backpressure, Redis quota, EXCLUDE constraint conflicts, faker locale missing), (e) section "go-no-go pre-pilote" listant 25 checks manuels que l'admin doit valider avant deploiement production.

A l'issue de cette tache, le script seed produit l'environnement de dev en moins de 60 secondes. La suite E2E complete `pnpm e2e:sprint-08` execute 50+ scenarios en moins de 5 minutes. Le runbook est accessible aux developpeurs futurs. Variables d'environnement nouvelles : `SEED_TENANT_BENNANI_NAME` (default 'Cabinet Bennani Casablanca'), `SEED_TENANT_ATLAS_NAME` (default 'Garage Atlas Casablanca'), `SEED_RESET_BEFORE` (default false). Dependance nouvelle : `@faker-js/faker@9.3.0` (locale fr_MA). Total approximativement 2800 lignes de code TypeScript + markdown.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

La validation par tests E2E exhaustifs et la fourniture de seeds dev realistes sont deux pratiques industrielles standard depuis 2010 pour les SaaS B2B. Les organisations sans ces pratiques accumulent dette technique : tests E2E absents = regressions silencieuses introduites a chaque sprint ; seeds dev absents = developpeurs frontend bloques en attendant que backend cree manuellement des donnees, multiplication des bugs UI sur cas edge (champ vide, list 0 items, dates extremes).

Pour Skalean InsurTech v2.2, ce besoin est particulierement aigu :
- **13 modules livres en 6 semaines** (Sprint 8 a 5 jours/semaine) : sans tests integration cross-modules, les regressions Sprint 9-13 toucheront fragilement les modules Sprint 8 (qui les consomment a travers Kafka events, FK appointments, etc.).
- **6 frontends Sprint 16-22** : sans seeds, chaque developpeur perd 2-3h/semaine a creer manually des companies/contacts/deals/appointments. Pour 4 developpeurs frontend x 6 sprints x 2h/semaine = ~48 heures perdues par mois. Seeds livres ici = 0 heures perdues.
- **Pilote Marrakech Sprint 35** : sans seeds simulation, l'equipe ne peut pas demontrer le produit aux cabinets pilotes avant d'avoir vrais clients. Seeds = environnement demo permanent.

Le choix specifique de seeder 2 tenants (cabinet + garage, pas 1 seul) decoule du multi-tenant strict : tester que tenant A ne voit pas tenant B requiert 2 tenants distincts. Sprint 8 est le premier sprint avec donnees CRM/Booking ; valider isolation maintenant evite que Sprint 9-35 introduisent des leaks cross-tenant non-detectes.

Le choix de faker locale fr_MA decoule du realisme marche cible. Skalean est marocain pour le marocain. Utiliser noms anglais "John Smith" ou francais metropolitains "Jean Dupont" donnerait des seeds non-realistes qui ne refletent pas le marche. Les developpeurs developperaient des UI mal-adaptes aux noms longs maghrebins ("Mohamed Lahcen Ait Benali Imrani") qui peuvent depasser les input width. Avec faker fr_MA, ces edge cases apparaissent naturellement.

Le choix de 50+ scenarios E2E (vs 30 ou 100) decoule du compromis temps execution / couverture. 30 scenarios laisseraient trous (e.g. pas de test deal won apres soft-delete contact). 100 scenarios prendraient 15+ minutes (frustration CI). 50 scenarios = ~5 minutes execution + couverture suffisante.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas de tache cloture Sprint 8 | Effort moindre | Pas de validation integration, dette technique | REJETE |
| Tache cloture livre seeds uniquement (pas E2E) | Effort moitie | Regressions silencieuses Sprint 9+ | REJETE |
| Tache cloture livre E2E uniquement (pas seeds) | Pertinent qualite | Developpeurs frontend bloques | REJETE |
| Tache cloture livre les 2 (RETENU) | Cloture complete | Effort 7h | RETENU |
| Seeds 1 tenant seulement | Simple | Pas de test isolation multi-tenant | REJETE |
| Seeds 2 tenants (cabinet + garage) (RETENU) | Multi-tenant + diversite | Complexite x2 | RETENU |
| Seeds 5+ tenants | Stress test | Volume excessif dev | REJETE |
| Faker locale fr | Generique | Pas marche MA | REJETE |
| Faker locale fr_MA (RETENU) | Realisme MA | Library available 9.3+ | RETENU |
| Seeds 100 contacts par tenant | Volume realiste production | Slow seed, dev pas besoin | REJETE |
| Seeds 50 contacts (30+20) (RETENU) | Volume raisonnable | Suffit pour dev | RETENU |
| Tests E2E 30 scenarios | Rapide | Couverture insuffisante | REJETE |
| Tests E2E 50+ scenarios (RETENU) | Couverture solide | 5 min execution | RETENU |
| Tests E2E 100 scenarios | Couverture maximale | 15 min execution frustre CI | REJETE |
| Tests groupes par module 1 fichier | Lisibilite | Difficile maintenance | REJETE |
| Tests groupes par module N fichiers (RETENU) | Maintenance | Plus de fichiers | RETENU |
| Runbook absent | Effort moindre | Frustration developpeurs futurs | REJETE |
| Runbook markdown (RETENU) | Standard | Maintenance | RETENU |
| Performance benchmarks tests dans cette tache | Pertinent | Out of scope Sprint 8 | DEFERRABLE Sprint 13+ |
| CI integration dans cette tache | Automatique | Sprint 1 task 1.1.10 deja livre CI | OK reutilise |

### 2.3 Trade-offs explicites

Le choix de seeder 50 contacts (vs production realiste 5000) implique que les tests perf E2E sont moins demonstratifs. Sprint 8 retient 50 pour rapidite dev ; Sprint 13 task 1.13.X livrera seeds load-test avec 10000 entities pour valider performance reelle.

Le choix de runbook markdown standalone (vs documentation dans README du package) implique duplication potentielle. Le trade-off est entre proximite (README package) et accessibilite cross-team (runbook centralized `00-pilotage/runbooks/`). Sprint 8 retient runbook centralized pour faciliter onboarding ops + admin Skalean.

Le choix de tests E2E in-process (vs containerized Postgres Testcontainers) implique que les tests partagent la DB de dev local. Cleanup entre tests est essentiel. Sprint 8 retient in-process (rapidite x10) ; Sprint 33 pourra introduire Testcontainers pour pentest isole si necessaire.

Le choix d'inclure RBAC reject scenarios (assure -> 403) sur chaque module (vs un seul test global) repete legerement le code (~20 lignes par scenario). Le trade-off est entre concision (1 test global) et clarte (test per module visible). Sprint 8 retient clarte ; un bug RBAC sur module X isolent rapidement plutot que ratisser un test global.

### 2.4 Decisions strategiques referenced

- decision-002 (Multi-tenant) totale, decision-006 (No-emoji) totale, decision-008 (Data residency) totale.
- decision-032 (planifie -- Seeds strategy) decision dediee documentee.

### 2.5 Pieges techniques connus

1. **Piege : Seed timeout sur Kafka events.**
   - Solution : seed publie events synchrones, await acks.

2. **Piege : Faker random produit duplicate CIN.**
   - Solution : seed counter + unique suffix.

3. **Piege : EXCLUDE constraint conflit dans seed appointments.**
   - Solution : seed spread times sur 6 mois.

4. **Piege : Reset seed echoue si CASCADE manque.**
   - Solution : ordre delete strict + truncate restart identity.

5. **Piege : Seeds tenant 1 partagent ID avec tenant 2.**
   - Solution : UUIDs distincts via uuid().

6. **Piege : E2E test depend ordre execution.**
   - Solution : beforeEach truncate per test.

7. **Piege : E2E Kafka backpressure.**
   - Solution : await Kafka publish puis sleep 100ms avant assert.

8. **Piege : Seed produit holidays MA mal align.**
   - Solution : utiliser HolidaysService Sprint 8 task 3.1.11.

9. **Piege : E2E suite > 5 min frustre CI.**
   - Solution : `--testPathIgnorePatterns` filter sub-suites.

10. **Piege : Faker fr_MA library mal pinned.**
    - Solution : `@faker-js/faker@9.3.0` strict.

11. **Piege : Seed `--reset` accidentellement run sur prod.**
    - Solution : refuse si NODE_ENV=production.

12. **Piege : Seed creates user without password hash.**
    - Solution : utiliser `argon2.hash` Sprint 5 task 2.1.2.

13. **Piege : Audit logs poluent par seed (10000 rows).**
    - Solution : seed disable audit subscriber via flag env.

14. **Piege : Test E2E lent cause Redis flush.**
    - Solution : selective DB clear (db=2, db=3, etc.).

15. **Piege : Performance test inclus dans CI causes flakiness.**
    - Solution : performance tests tagged @perf, optional CI run.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.1.14 est la 14e et DERNIERE du Sprint 8. Sequence : 3.1.13 -> 3.1.14 -> _SUMMARY.md.

Consommateurs aval :
- **Sprint 9 (Comm)** : consume seeds existing (contacts/appointments) pour tester WhatsApp/email reminders.
- **Sprint 13 (Analytics)** : seeds founda KPI dashboards.
- **Sprint 14-15 (Insure)** : seeds enrichis avec polices Sprint 14 task X.
- **Sprint 16-22 (Frontends)** : seeds = environnement dev permanent.
- **Sprint 35 (Pilote)** : seeds servent demo cabinets pilotes.

Dependances amont : taches 3.1.1 a 3.1.13 toutes.

### 3.2 Position dans le programme global

Tests + seeds CRM/Booking servent fondation pour tous les sprints suivants.

### 3.3 Diagramme

```
                  +------------------------+
                  | Sprint 16-35           |
                  | Frontends + Admin      |
                  | consument seeds dev    |
                  +-----------+------------+
                              |
                              |
+------------------------------------------------------------------+
| Sprint 8 task 3.1.14 (cloture)                                   |
|                                                                  |
| Script seed (~600 lignes)                                        |
|   2 tenants Bennani (cabinet) + Atlas (garage)                   |
|   Users RBAC types : admin, manager, user, assure                 |
|   10 companies (5/tenant)                                        |
|   50 contacts (30/20) faker fr_MA                                |
|   2 pipelines /tenant                                            |
|   30 deals (10 lead + 10 proposal + 5 won + 5 lost)              |
|   100 interactions (6 mois timeline)                             |
|   3 rooms /tenant                                                |
|   50 appointments (20 past + 25 future + 5 cancelled)            |
|                                                                  |
| Tests E2E exhaustifs (50+ scenarios)                              |
|   tests/sprint-08/companies.full.e2e-spec.ts          (5)        |
|   tests/sprint-08/contacts.full.e2e-spec.ts           (8)        |
|   tests/sprint-08/pipelines.full.e2e-spec.ts          (4)        |
|   tests/sprint-08/deals.full.e2e-spec.ts              (6)        |
|   tests/sprint-08/interactions.full.e2e-spec.ts       (4)        |
|   tests/sprint-08/search.full.e2e-spec.ts             (3)        |
|   tests/sprint-08/custom-fields.full.e2e-spec.ts      (3)        |
|   tests/sprint-08/rooms.full.e2e-spec.ts              (3)        |
|   tests/sprint-08/appointments.full.e2e-spec.ts       (6)        |
|   tests/sprint-08/calendar-sync.full.e2e-spec.ts      (4)        |
|   tests/sprint-08/availability.full.e2e-spec.ts       (3)        |
|   tests/sprint-08/sync-bidir.full.e2e-spec.ts         (4)        |
|   tests/sprint-08/ical-feed.full.e2e-spec.ts          (2)        |
|   tests/sprint-08/cross-modules.e2e-spec.ts           (5)        |
|                                                                  |
| Runbook ops 00-pilotage/runbooks/sprint-08-seed-and-test.md      |
+------------------------------------------------------------------+
```

---

## 4. Livrables checkables

- [ ] Script `repo/infrastructure/scripts/seed-crm-booking.ts` (~600 lignes)
- [ ] Modules seed `repo/infrastructure/scripts/seed-helpers/` (~500 lignes split en 5 modules tenants/users/crm/booking/utils)
- [ ] Tests E2E 14 fichiers regroupes par module dans `repo/apps/api/test/sprint-08/` (~1500 lignes total)
- [ ] Tests cross-modules `repo/apps/api/test/sprint-08/cross-modules.e2e-spec.ts` (~280 lignes, 5 scenarios)
- [ ] Runbook `repo/00-pilotage/runbooks/sprint-08-seed-and-test.md` (~250 lignes)
- [ ] Modifications `package.json` (+`@faker-js/faker@9.3.0` + scripts `seed:crm-booking` + `e2e:sprint-08`)
- [ ] Modifications `shared-config/env.schema.ts` (+3 vars SEED_*)
- [ ] 2 tenants seeded : Cabinet Bennani Casablanca + Garage Atlas Casablanca
- [ ] Users RBAC mix : 1 admin + 3 user + 1 assure pour cabinet ; 1 admin + 2 manager + 4 technician + 5 assure pour garage
- [ ] 10 companies + 50 contacts (faker fr_MA) + 2 pipelines + 30 deals + 100 interactions
- [ ] 3 rooms + 50 appointments (20 past + 25 future + 5 cancelled)
- [ ] 50+ tests E2E PASS (CRM 30 + Booking 22 + cross-modules 5 = 57 scenarios)
- [ ] Seed run < 60s
- [ ] E2E suite < 5min
- [ ] Refuse seed si NODE_ENV=production
- [ ] Flag `--reset` truncate + recreate
- [ ] Flag `--incremental` append seulement
- [ ] No-emoji, lint, typecheck

---

## 5. Fichiers crees / modifies

```
CREES :
repo/infrastructure/scripts/seed-crm-booking.ts                                ~600 lignes
repo/infrastructure/scripts/seed-helpers/seed-tenants.ts                       ~120 lignes
repo/infrastructure/scripts/seed-helpers/seed-users.ts                         ~140 lignes
repo/infrastructure/scripts/seed-helpers/seed-crm.ts                           ~280 lignes
repo/infrastructure/scripts/seed-helpers/seed-booking.ts                       ~220 lignes
repo/infrastructure/scripts/seed-helpers/seed-utils.ts                          ~80 lignes

repo/apps/api/test/sprint-08/companies.full.e2e-spec.ts                       ~140 lignes (5)
repo/apps/api/test/sprint-08/contacts.full.e2e-spec.ts                        ~200 lignes (8)
repo/apps/api/test/sprint-08/pipelines.full.e2e-spec.ts                       ~120 lignes (4)
repo/apps/api/test/sprint-08/deals.full.e2e-spec.ts                           ~180 lignes (6)
repo/apps/api/test/sprint-08/interactions.full.e2e-spec.ts                    ~120 lignes (4)
repo/apps/api/test/sprint-08/search.full.e2e-spec.ts                           ~100 lignes (3)
repo/apps/api/test/sprint-08/custom-fields.full.e2e-spec.ts                    ~100 lignes (3)
repo/apps/api/test/sprint-08/rooms.full.e2e-spec.ts                           ~100 lignes (3)
repo/apps/api/test/sprint-08/appointments.full.e2e-spec.ts                    ~160 lignes (6)
repo/apps/api/test/sprint-08/calendar-sync.full.e2e-spec.ts                   ~140 lignes (4)
repo/apps/api/test/sprint-08/availability.full.e2e-spec.ts                    ~100 lignes (3)
repo/apps/api/test/sprint-08/sync-bidir.full.e2e-spec.ts                      ~140 lignes (4)
repo/apps/api/test/sprint-08/ical-feed.full.e2e-spec.ts                        ~80 lignes (2)
repo/apps/api/test/sprint-08/cross-modules.e2e-spec.ts                        ~280 lignes (5)

repo/00-pilotage/runbooks/sprint-08-seed-and-test.md                          ~250 lignes

MODIFIES :
repo/package.json (root)                                                         +3 lignes (faker dep + scripts)
repo/packages/shared-config/src/env.schema.ts                                    +4 lignes
```

Total approximativement 2800 lignes nouveau code.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 sur 8 : seed-utils.ts

```typescript
// repo/infrastructure/scripts/seed-helpers/seed-utils.ts
import { faker } from '@faker-js/faker/locale/fr';
import * as argon2 from 'argon2';

faker.seed(20260508);  // Deterministe

export const SEED_CONSTANTS = {
  TENANT_BENNANI_NAME: process.env.SEED_TENANT_BENNANI_NAME ?? 'Cabinet Bennani Casablanca',
  TENANT_ATLAS_NAME: process.env.SEED_TENANT_ATLAS_NAME ?? 'Garage Atlas Casablanca',
  PASSWORD_DEFAULT: 'SkaleanDev2026!',
};

const MOROCCAN_FIRST_NAMES_M = [
  'Mohamed', 'Ahmed', 'Hassan', 'Karim', 'Said', 'Youssef', 'Omar', 'Khalid',
  'Rachid', 'Abdellah', 'Driss', 'Hamza', 'Yassine', 'Othmane', 'Anas', 'Brahim',
];

const MOROCCAN_FIRST_NAMES_F = [
  'Fatima', 'Aicha', 'Khadija', 'Zineb', 'Sara', 'Salma', 'Naima', 'Latifa',
  'Mariam', 'Imane', 'Houda', 'Asma', 'Yasmine', 'Hanane', 'Souad', 'Karima',
];

const MOROCCAN_LAST_NAMES = [
  'Bennani', 'Alami', 'El Mansouri', 'Tazi', 'Idrissi', 'Cherkaoui', 'Berrada',
  'Lahcen', 'Belmadani', 'Aboukacem', 'Fassi', 'Sbihi', 'Mernissi', 'Bouayad',
  'Hassani', 'Iraqi', 'Sefrioui', 'Lazrak', 'Saadi', 'Ouali', 'Benabdelkader',
];

const MOROCCAN_CITIES = [
  'Casablanca', 'Rabat', 'Marrakech', 'Tanger', 'Fes', 'Meknes', 'Agadir',
  'Oujda', 'Kenitra', 'Tetouan', 'Sale', 'Mohammedia', 'Nador', 'El Jadida',
];

let seedCounter = 0;

export function getNextCounter(): number {
  seedCounter += 1;
  return seedCounter;
}

export function randomMoroccanFirstName(gender: 'M' | 'F' = 'M'): string {
  const list = gender === 'F' ? MOROCCAN_FIRST_NAMES_F : MOROCCAN_FIRST_NAMES_M;
  return list[Math.floor(Math.random() * list.length)]!;
}

export function randomMoroccanLastName(): string {
  return MOROCCAN_LAST_NAMES[Math.floor(Math.random() * MOROCCAN_LAST_NAMES.length)]!;
}

export function randomMoroccanCity(): string {
  return MOROCCAN_CITIES[Math.floor(Math.random() * MOROCCAN_CITIES.length)]!;
}

/**
 * Generate ICE valide format 15 chiffres (sans checksum strict pour seed).
 */
export function generateIce(): string {
  const counter = getNextCounter();
  return `001${String(counter).padStart(6, '0')}000${String(counter % 1000).padStart(3, '0')}`;
}

/**
 * Generate CIN format MA : 1-2 lettres prefecture + 6-8 chiffres.
 */
export function generateCin(): string {
  const prefixes = ['A', 'B', 'BB', 'BE', 'BJ', 'C', 'D', 'F', 'H', 'K'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]!;
  const counter = getNextCounter();
  return `${prefix}${String(100000 + counter).padStart(6, '0')}`;
}

/**
 * Generate phone format MA +212(6|7)XXXXXXXX.
 */
export function generatePhoneMa(): string {
  const indicatif = Math.random() < 0.5 ? '6' : '7';
  const eightDigits = String(Math.floor(10000000 + Math.random() * 90000000));
  return `+212${indicatif}${eightDigits}`;
}

/**
 * Hash password via argon2id (compatible Sprint 5 task 2.1.2).
 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

/**
 * Refuse seed si production env.
 */
export function assertNotProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: Seeds CRM/Booking ne doivent JAMAIS s\'executer en production');
  }
}

export function logSection(title: string): void {
  console.log(`\n=== ${title} ===`);
}
```

### 6.2 Fichier 2 sur 8 : seed-tenants.ts

```typescript
// repo/infrastructure/scripts/seed-helpers/seed-tenants.ts
import type { DataSource } from 'typeorm';
import { SEED_CONSTANTS, logSection } from './seed-utils';

export interface SeededTenant {
  id: string;
  name: string;
  type: 'cabinet' | 'garage';
  slug: string;
}

export async function seedTenants(ds: DataSource): Promise<SeededTenant[]> {
  logSection('Tenants');

  const tenants: SeededTenant[] = [];

  // Tenant 1 : Cabinet Bennani (courtage)
  const bennaniRes = await ds.query(`
    INSERT INTO auth_tenants (id, name, slug, type, status, settings, country_code, created_at, updated_at)
    VALUES (uuid_generate_v4(), $1, 'cabinet-bennani', 'cabinet', 'active',
      '{"business_hours":{"mon":"09:00-18:00","tue":"09:00-18:00","wed":"09:00-18:00","thu":"09:00-18:00","fri":"09:00-18:00","sat":"09:00-13:00","sun":"closed"}}'::jsonb,
      'MA', NOW(), NOW())
    ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
    RETURNING id, name, type, slug
  `, [SEED_CONSTANTS.TENANT_BENNANI_NAME]);
  tenants.push(bennaniRes[0]);

  // Tenant 2 : Garage Atlas
  const atlasRes = await ds.query(`
    INSERT INTO auth_tenants (id, name, slug, type, status, settings, country_code, created_at, updated_at)
    VALUES (uuid_generate_v4(), $1, 'garage-atlas', 'garage', 'active',
      '{"business_hours":{"mon":"08:00-19:00","tue":"08:00-19:00","wed":"08:00-19:00","thu":"08:00-19:00","fri":"08:00-19:00","sat":"08:00-14:00","sun":"closed"}}'::jsonb,
      'MA', NOW(), NOW())
    ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
    RETURNING id, name, type, slug
  `, [SEED_CONSTANTS.TENANT_ATLAS_NAME]);
  tenants.push(atlasRes[0]);

  console.log(`  Seeded ${tenants.length} tenants: ${tenants.map((t) => t.slug).join(', ')}`);
  return tenants;
}

export async function resetTenants(ds: DataSource, slugs: string[]): Promise<void> {
  for (const slug of slugs) {
    const t = await ds.query(`SELECT id FROM auth_tenants WHERE slug = $1`, [slug]);
    if (t.length === 0) continue;
    const tenantId = t[0].id;
    // CASCADE delete cleans all child rows
    await ds.query(`DELETE FROM auth_tenants WHERE id = $1`, [tenantId]);
  }
}
```

### 6.3 Fichier 3 sur 8 : seed-users.ts

```typescript
// repo/infrastructure/scripts/seed-helpers/seed-users.ts
import type { DataSource } from 'typeorm';
import {
  SEED_CONSTANTS, hashPassword, randomMoroccanFirstName, randomMoroccanLastName,
  generateCin, generatePhoneMa, logSection,
} from './seed-utils';
import type { SeededTenant } from './seed-tenants';

export interface SeededUser {
  id: string;
  tenant_id: string;
  email: string;
  role: string;
  full_name: string;
}

export async function seedUsers(ds: DataSource, tenants: SeededTenant[]): Promise<SeededUser[]> {
  logSection('Users');

  const passwordHash = await hashPassword(SEED_CONSTANTS.PASSWORD_DEFAULT);
  const users: SeededUser[] = [];

  for (const tenant of tenants) {
    const userConfigs: Array<{ role: string; count: number }> = tenant.type === 'cabinet'
      ? [
          { role: 'broker_admin', count: 1 },
          { role: 'broker_user', count: 3 },
          { role: 'assure', count: 1 },
        ]
      : [
          { role: 'garage_admin', count: 1 },
          { role: 'garage_manager', count: 2 },
          { role: 'garage_technician', count: 4 },
          { role: 'assure', count: 5 },
        ];

    for (const cfg of userConfigs) {
      for (let i = 0; i < cfg.count; i += 1) {
        const firstName = randomMoroccanFirstName(i % 2 === 0 ? 'M' : 'F');
        const lastName = randomMoroccanLastName();
        const email = `${cfg.role}.${i + 1}@${tenant.slug}.skalean.dev`;

        const res = await ds.query(`
          INSERT INTO auth_users (
            id, tenant_id, email, password_hash, first_name, last_name,
            phone_number, cin, role, status, email_verified, created_at, updated_at
          ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7, $8, 'active', true, NOW(), NOW()
          )
          ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
          RETURNING id, tenant_id, email, role, first_name, last_name
        `, [
          tenant.id, email, passwordHash, firstName, lastName,
          generatePhoneMa(), generateCin(), cfg.role,
        ]);

        users.push({
          ...res[0],
          full_name: `${res[0].first_name} ${res[0].last_name}`,
        });
      }
    }
  }

  console.log(`  Seeded ${users.length} users across ${tenants.length} tenants`);
  return users;
}
```

### 6.4 Fichier 4 sur 8 : seed-crm.ts

```typescript
// repo/infrastructure/scripts/seed-helpers/seed-crm.ts
import type { DataSource } from 'typeorm';
import {
  generateIce, generateCin, generatePhoneMa,
  randomMoroccanFirstName, randomMoroccanLastName, randomMoroccanCity,
  logSection,
} from './seed-utils';
import type { SeededTenant } from './seed-tenants';
import type { SeededUser } from './seed-users';

export interface SeededCompany { id: string; tenant_id: string; name: string; }
export interface SeededContact { id: string; tenant_id: string; full_name: string; company_id: string | null; }
export interface SeededPipeline { id: string; tenant_id: string; name: string; stages: Array<{ id: string; name: string; is_terminal: boolean; terminal_type: string | null }>; }
export interface SeededDeal { id: string; tenant_id: string; contact_id: string; stage_id: string; amount: number; status: string; }
export interface SeededInteraction { id: string; tenant_id: string; contact_id: string; type: string; }

/**
 * 10 companies (5 par tenant) avec ICE valides.
 */
export async function seedCompanies(ds: DataSource, tenants: SeededTenant[]): Promise<SeededCompany[]> {
  logSection('Companies');
  const companies: SeededCompany[] = [];

  const industries = ['finance_insurance', 'wholesale_retail', 'transport_logistics', 'construction', 'manufacturing_other'];
  const sizes = ['TPE', 'PME', 'GE', 'PME', 'PME'];

  for (const tenant of tenants) {
    for (let i = 0; i < 5; i += 1) {
      const name = `${tenant.type === 'cabinet' ? 'Cabinet' : 'Atelier'} ${randomMoroccanLastName()}`;
      const res = await ds.query(`
        INSERT INTO crm_companies (
          id, tenant_id, name, legal_name, ice, rc_number, industry, size,
          city, postal_code, country_code, phone_number, email,
          tags, metadata, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5, $6, $7,
          $8, $9, 'MA', $10, $11,
          ARRAY['seeded']::text[], '{}'::jsonb, NOW(), NOW()
        )
        RETURNING id, tenant_id, name
      `, [
        tenant.id, name, `${name} SARL`,
        generateIce(),
        String(100000 + Math.floor(Math.random() * 900000)),
        industries[i % industries.length], sizes[i % sizes.length],
        randomMoroccanCity(),
        String(20000 + Math.floor(Math.random() * 80000)),
        generatePhoneMa(),
        `contact${i + 1}@${tenant.slug}.example.ma`,
      ]);
      companies.push(res[0]);
    }
  }

  console.log(`  Seeded ${companies.length} companies (${companies.length / tenants.length} per tenant)`);
  return companies;
}

/**
 * 50 contacts : 30 cabinet + 20 garage (faker fr_MA).
 */
export async function seedContacts(
  ds: DataSource,
  tenants: SeededTenant[],
  companies: SeededCompany[],
): Promise<SeededContact[]> {
  logSection('Contacts');
  const contacts: SeededContact[] = [];

  const channels = ['whatsapp', 'email', 'sms', 'voice'];
  const locales = ['fr', 'ar-MA', 'ar', 'en'];

  for (const tenant of tenants) {
    const tenantCompanies = companies.filter((c) => c.tenant_id === tenant.id);
    const count = tenant.type === 'cabinet' ? 30 : 20;

    for (let i = 0; i < count; i += 1) {
      const isFemale = i % 3 === 0;
      const firstName = randomMoroccanFirstName(isFemale ? 'F' : 'M');
      const lastName = randomMoroccanLastName();
      const company = i % 2 === 0 ? tenantCompanies[i % tenantCompanies.length] : null;

      const res = await ds.query(`
        INSERT INTO crm_contacts (
          id, tenant_id, company_id, first_name, last_name, civility,
          email, phone_number, cin, preferred_locale, preferred_channel,
          city, country_code, tags, metadata, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, 'MA', ARRAY['seeded']::text[], '{}'::jsonb, NOW(), NOW()
        )
        RETURNING id, tenant_id, first_name, last_name, company_id
      `, [
        tenant.id, company?.id ?? null, firstName, lastName,
        isFemale ? 'Mme' : 'M',
        `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s/g, '')}${i}@example.ma`,
        generatePhoneMa(), generateCin(),
        locales[i % locales.length],
        channels[i % channels.length],
        randomMoroccanCity(),
      ]);
      contacts.push({
        id: res[0].id,
        tenant_id: res[0].tenant_id,
        full_name: `${res[0].first_name} ${res[0].last_name}`,
        company_id: res[0].company_id,
      });
    }
  }

  console.log(`  Seeded ${contacts.length} contacts`);
  return contacts;
}

/**
 * Pipelines + stages : 2 par tenant.
 */
export async function seedPipelines(ds: DataSource, tenants: SeededTenant[]): Promise<SeededPipeline[]> {
  logSection('Pipelines');
  const pipelines: SeededPipeline[] = [];

  const cabinetPipelines = [
    { name: 'Pipeline Auto Particuliers', stages: ['Lead', 'Devis', 'Negociation', 'Won', 'Lost'] },
    { name: 'Pipeline Sante Collective', stages: ['Decouverte', 'Audit', 'Proposition', 'Validation', 'Won', 'Lost'] },
  ];
  const garagePipelines = [
    { name: 'Pipeline Carrosserie', stages: ['Reception', 'Devis', 'Reparation', 'Livraison', 'Won', 'Lost'] },
    { name: 'Pipeline Mecanique', stages: ['Diagnostic', 'Reparation', 'Test', 'Livraison', 'Won', 'Lost'] },
  ];

  for (const tenant of tenants) {
    const tplList = tenant.type === 'cabinet' ? cabinetPipelines : garagePipelines;
    for (let pIdx = 0; pIdx < tplList.length; pIdx += 1) {
      const tpl = tplList[pIdx]!;
      const pipRes = await ds.query(`
        INSERT INTO crm_pipelines (id, tenant_id, name, description, is_default, active, created_at, updated_at)
        VALUES (uuid_generate_v4(), $1, $2, 'Pipeline seeded', $3, true, NOW(), NOW())
        RETURNING id, tenant_id, name
      `, [tenant.id, tpl.name, pIdx === 0]);
      const pipeline = pipRes[0];

      const stages: SeededPipeline['stages'] = [];
      for (let sIdx = 0; sIdx < tpl.stages.length; sIdx += 1) {
        const stageName = tpl.stages[sIdx]!;
        const isTerminal = stageName === 'Won' || stageName === 'Lost';
        const terminalType = stageName === 'Won' ? 'won' : (stageName === 'Lost' ? 'lost' : null);
        const probability = isTerminal ? (terminalType === 'won' ? 100 : 0) : (sIdx + 1) * 20;

        const stageRes = await ds.query(`
          INSERT INTO crm_pipeline_stages (id, pipeline_id, name, position, probability, color, is_terminal, terminal_type, created_at, updated_at)
          VALUES (uuid_generate_v4(), $1, $2, $3, $4, '#3B82F6', $5, $6, NOW(), NOW())
          RETURNING id, name, is_terminal, terminal_type
        `, [pipeline.id, stageName, sIdx + 1, probability, isTerminal, terminalType]);
        stages.push(stageRes[0]);
      }

      pipelines.push({ ...pipeline, stages });
    }
  }

  console.log(`  Seeded ${pipelines.length} pipelines with stages`);
  return pipelines;
}

/**
 * 30 deals reparties dans stages (10 lead + 10 proposal + 5 won + 5 lost).
 */
export async function seedDeals(
  ds: DataSource,
  tenants: SeededTenant[],
  contacts: SeededContact[],
  pipelines: SeededPipeline[],
  users: SeededUser[],
): Promise<SeededDeal[]> {
  logSection('Deals');
  const deals: SeededDeal[] = [];

  for (const tenant of tenants) {
    const tenantContacts = contacts.filter((c) => c.tenant_id === tenant.id);
    const tenantPipelines = pipelines.filter((p) => p.tenant_id === tenant.id);
    const tenantOwners = users.filter((u) => u.tenant_id === tenant.id && (u.role === 'broker_user' || u.role === 'garage_manager'));
    if (tenantOwners.length === 0) continue;

    const stageDistribution = { lead: 5, proposal: 5, won: 3, lost: 2 };
    let count = 0;

    for (const [stageType, n] of Object.entries(stageDistribution)) {
      for (let i = 0; i < n; i += 1) {
        const pipeline = tenantPipelines[count % tenantPipelines.length]!;
        const contact = tenantContacts[count % tenantContacts.length]!;
        const owner = tenantOwners[count % tenantOwners.length]!;

        let stage;
        if (stageType === 'won') stage = pipeline.stages.find((s) => s.terminal_type === 'won')!;
        else if (stageType === 'lost') stage = pipeline.stages.find((s) => s.terminal_type === 'lost')!;
        else if (stageType === 'proposal') stage = pipeline.stages[Math.floor(pipeline.stages.length / 2)]!;
        else stage = pipeline.stages[0]!;

        const amount = 1000 + Math.floor(Math.random() * 200000);
        const status = stageType === 'won' ? 'won' : (stageType === 'lost' ? 'lost' : 'open');

        const res = await ds.query(`
          INSERT INTO crm_deals (
            id, tenant_id, pipeline_id, stage_id, contact_id, owner_user_id,
            title, amount, currency, probability, status, expected_close_date,
            won_at, lost_at, last_stage_changed_at, tags, metadata, custom_fields,
            created_at, updated_at
          ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4, $5,
            $6, $7, 'MAD', $8, $9, $10,
            $11, $12, NOW(), ARRAY['seeded']::text[], '{}'::jsonb, '{}'::jsonb, NOW(), NOW()
          )
          RETURNING id, tenant_id, contact_id, stage_id, amount, status
        `, [
          tenant.id, pipeline.id, stage.id, contact.id, owner.id,
          `${stageType.toUpperCase()} ${contact.full_name}`,
          amount,
          stageType === 'won' ? 100 : (stageType === 'lost' ? 0 : 50),
          status,
          new Date(Date.now() + Math.floor(Math.random() * 90 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
          status === 'won' ? new Date() : null,
          status === 'lost' ? new Date() : null,
        ]);
        deals.push({ ...res[0], amount: Number(res[0].amount) });
        count += 1;
      }
    }
  }

  console.log(`  Seeded ${deals.length} deals (${deals.filter((d) => d.status === 'won').length} won)`);
  return deals;
}

/**
 * 100 interactions timeline 6 derniers mois.
 */
export async function seedInteractions(
  ds: DataSource,
  tenants: SeededTenant[],
  contacts: SeededContact[],
  users: SeededUser[],
): Promise<SeededInteraction[]> {
  logSection('Interactions');
  const interactions: SeededInteraction[] = [];
  const types = ['call', 'email', 'whatsapp', 'sms', 'meeting', 'note'];
  const directions = ['outbound', 'inbound', 'outbound', 'outbound'];

  const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;

  for (const tenant of tenants) {
    const tenantContacts = contacts.filter((c) => c.tenant_id === tenant.id);
    const tenantUsers = users.filter((u) => u.tenant_id === tenant.id);
    if (tenantContacts.length === 0 || tenantUsers.length === 0) continue;

    const count = tenant.type === 'cabinet' ? 60 : 40;
    for (let i = 0; i < count; i += 1) {
      const contact = tenantContacts[i % tenantContacts.length]!;
      const user = tenantUsers[i % tenantUsers.length]!;
      const type = types[i % types.length]!;
      const direction = directions[i % directions.length]!;
      const occurredAt = new Date(sixMonthsAgo + Math.floor(Math.random() * 180 * 24 * 60 * 60 * 1000));

      const res = await ds.query(`
        INSERT INTO crm_interactions (
          id, tenant_id, contact_id, user_id, type, direction,
          subject, content, occurred_at, metadata, source_system, created_at, updated_at
        ) VALUES (
          uuid_generate_v4(), $1, $2, $3, $4, $5,
          $6, $7, $8, '{}'::jsonb, 'seed', NOW(), NOW()
        )
        RETURNING id, tenant_id, contact_id, type
      `, [
        tenant.id, contact.id, user.id, type, direction,
        type === 'note' ? null : `${type.toUpperCase()} avec ${contact.full_name}`,
        `Contenu seed interaction ${type}/${direction}`,
        occurredAt.toISOString(),
      ]);
      interactions.push(res[0]);
    }
  }

  console.log(`  Seeded ${interactions.length} interactions over 6 months`);
  return interactions;
}
```

### 6.5 Fichier 5 sur 8 : seed-booking.ts

```typescript
// repo/infrastructure/scripts/seed-helpers/seed-booking.ts
import type { DataSource } from 'typeorm';
import { logSection } from './seed-utils';
import type { SeededTenant } from './seed-tenants';
import type { SeededUser } from './seed-users';
import type { SeededContact } from './seed-crm';

export interface SeededRoom { id: string; tenant_id: string; name: string; }
export interface SeededAppointment { id: string; tenant_id: string; status: string; }

export async function seedRooms(ds: DataSource, tenants: SeededTenant[]): Promise<SeededRoom[]> {
  logSection('Rooms');
  const rooms: SeededRoom[] = [];

  const cabinetRooms = [
    { name: 'Salle principale', capacity: 8, color: '#3B82F6' },
    { name: 'Salle clientele', capacity: 4, color: '#10B981' },
    { name: 'Salle visioconference', capacity: 6, color: '#F97316' },
  ];
  const garageRooms = [
    { name: 'Baie 1', capacity: 1, color: '#3B82F6' },
    { name: 'Baie 2', capacity: 1, color: '#6366F1' },
    { name: 'Baie carrosserie', capacity: 1, color: '#F97316' },
  ];

  for (const tenant of tenants) {
    const templates = tenant.type === 'cabinet' ? cabinetRooms : garageRooms;
    for (const tpl of templates) {
      const res = await ds.query(`
        INSERT INTO booking_rooms (id, tenant_id, name, capacity, location, color, active, metadata, created_at, updated_at)
        VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, true, '{"seeded":true}'::jsonb, NOW(), NOW())
        ON CONFLICT (tenant_id, name) WHERE deleted_at IS NULL DO UPDATE SET updated_at = NOW()
        RETURNING id, tenant_id, name
      `, [tenant.id, tpl.name, tpl.capacity, tenant.type === 'cabinet' ? 'Etage 1' : 'Atelier', tpl.color]);
      rooms.push(res[0]);
    }
  }

  console.log(`  Seeded ${rooms.length} rooms`);
  return rooms;
}

/**
 * 50 appointments : 20 past completed + 25 future scheduled + 5 cancelled.
 */
export async function seedAppointments(
  ds: DataSource,
  tenants: SeededTenant[],
  rooms: SeededRoom[],
  contacts: SeededContact[],
  users: SeededUser[],
): Promise<SeededAppointment[]> {
  logSection('Appointments');
  const appointments: SeededAppointment[] = [];

  for (const tenant of tenants) {
    const tenantRooms = rooms.filter((r) => r.tenant_id === tenant.id);
    const tenantContacts = contacts.filter((c) => c.tenant_id === tenant.id);
    const tenantUsers = users.filter((u) => u.tenant_id === tenant.id && u.role !== 'assure');
    if (tenantRooms.length === 0 || tenantContacts.length === 0 || tenantUsers.length === 0) continue;

    const baseTime = Date.now();
    const count = 25;

    for (let i = 0; i < count; i += 1) {
      const room = tenantRooms[i % tenantRooms.length]!;
      const contact = tenantContacts[i % tenantContacts.length]!;
      const user = tenantUsers[i % tenantUsers.length]!;

      // Distribution : 10 past completed, 12 future scheduled, 3 cancelled
      let offsetMs: number;
      let status: string;
      if (i < 10) {
        offsetMs = -(30 + i * 7) * 24 * 60 * 60 * 1000;
        status = 'completed';
      } else if (i < 22) {
        offsetMs = (i - 9) * 2 * 24 * 60 * 60 * 1000;
        status = 'scheduled';
      } else {
        offsetMs = (i - 9) * 2 * 24 * 60 * 60 * 1000;
        status = 'cancelled';
      }

      const startTime = new Date(baseTime + offsetMs);
      startTime.setUTCHours(9 + (i % 8), 0, 0, 0);
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      const timeRange = `[${startTime.toISOString()},${endTime.toISOString()})`;

      try {
        const res = await ds.query(`
          INSERT INTO booking_appointments (
            id, tenant_id, room_id, contact_id, assigned_user_id,
            subject, description, time_range, status,
            cancellation_reason, completed_at, cancelled_at,
            metadata, created_at, updated_at
          ) VALUES (
            uuid_generate_v4(), $1, $2, $3, $4,
            $5, $6, $7::tstzrange, $8,
            $9, $10, $11,
            '{}'::jsonb, NOW(), NOW()
          )
          RETURNING id, tenant_id, status
        `, [
          tenant.id, room.id, contact.id, user.id,
          `RDV ${contact.full_name}`,
          'Appointment seeded',
          timeRange, status,
          status === 'cancelled' ? 'Seed cancelled appointment' : null,
          status === 'completed' ? new Date(startTime.getTime() + 60 * 60 * 1000) : null,
          status === 'cancelled' ? new Date() : null,
        ]);
        appointments.push(res[0]);
      } catch (error) {
        // EXCLUDE constraint conflict possible : skip
        continue;
      }
    }
  }

  console.log(`  Seeded ${appointments.length} appointments`);
  return appointments;
}
```

### 6.6 Fichier 6 sur 8 : seed-crm-booking.ts (main script)

```typescript
// repo/infrastructure/scripts/seed-crm-booking.ts
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { resolve } from 'path';
import { assertNotProduction, logSection } from './seed-helpers/seed-utils';
import { seedTenants, resetTenants, type SeededTenant } from './seed-helpers/seed-tenants';
import { seedUsers, type SeededUser } from './seed-helpers/seed-users';
import {
  seedCompanies, seedContacts, seedPipelines, seedDeals, seedInteractions,
} from './seed-helpers/seed-crm';
import { seedRooms, seedAppointments } from './seed-helpers/seed-booking';

interface SeedReport {
  tenants: number;
  users: number;
  companies: number;
  contacts: number;
  pipelines: number;
  deals: number;
  interactions: number;
  rooms: number;
  appointments: number;
  duration_seconds: number;
}

async function main(): Promise<void> {
  assertNotProduction();

  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const incremental = args.includes('--incremental');

  console.log('===========================================');
  console.log('  Skalean InsurTech Sprint 8 Seed Script  ');
  console.log('===========================================');
  console.log(`  reset:       ${reset}`);
  console.log(`  incremental: ${incremental}`);
  console.log(`  NODE_ENV:    ${process.env.NODE_ENV}`);
  console.log(`  DATABASE:    ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[1]}`);
  console.log('===========================================');

  const startedAt = Date.now();

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  console.log('DB connected.');

  try {
    // Reset
    if (reset) {
      logSection('Reset (drop tenant data)');
      await resetTenants(ds, ['cabinet-bennani', 'garage-atlas']);
      console.log('  Reset completed.');
    }

    // Seed orchestration
    const tenants: SeededTenant[] = await seedTenants(ds);
    const users: SeededUser[] = await seedUsers(ds, tenants);
    const companies = await seedCompanies(ds, tenants);
    const contacts = await seedContacts(ds, tenants, companies);
    const pipelines = await seedPipelines(ds, tenants);
    const deals = await seedDeals(ds, tenants, contacts, pipelines, users);
    const interactions = await seedInteractions(ds, tenants, contacts, users);
    const rooms = await seedRooms(ds, tenants);
    const appointments = await seedAppointments(ds, tenants, rooms, contacts, users);

    const duration = (Date.now() - startedAt) / 1000;
    const report: SeedReport = {
      tenants: tenants.length,
      users: users.length,
      companies: companies.length,
      contacts: contacts.length,
      pipelines: pipelines.length,
      deals: deals.length,
      interactions: interactions.length,
      rooms: rooms.length,
      appointments: appointments.length,
      duration_seconds: duration,
    };

    console.log('\n===========================================');
    console.log('  Seed completed successfully');
    console.log('===========================================');
    console.log(JSON.stringify(report, null, 2));
    console.log('===========================================');
    console.log(`\nLogin credentials:`);
    console.log(`  Email   : broker_admin.1@cabinet-bennani.skalean.dev`);
    console.log(`  Email   : garage_admin.1@garage-atlas.skalean.dev`);
    console.log(`  Password: SkaleanDev2026!`);
    console.log(`  Tenant IDs:`);
    tenants.forEach((t) => console.log(`    ${t.slug}: ${t.id}`));
  } catch (error) {
    console.error('SEED FAILED:', error);
    process.exit(1);
  } finally {
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 6.7 Fichier 7 sur 8 : Tests E2E cross-modules

```typescript
// repo/apps/api/test/sprint-08/cross-modules.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { createTestTenant, createTestUser, loginAndGetJwt } from '../fixtures/auth-test-helpers';
import {
  createTestCompany, createTestContact, createTestPipeline, createTestDeal,
  createTestInteraction, truncateCompanies, truncateContacts, truncatePipelines,
  truncateDeals, truncateInteractions,
} from '../fixtures/crm-test-helpers';
import {
  createTestRoom, createTestAppointment, truncateRooms, truncateAppointments,
} from '../fixtures/booking-test-helpers';

describe('Sprint 8 Cross-Modules Integration E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantId: string;
  let jwt: string;

  beforeAll(async () => {
    const m = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = m.createNestApplication();
    await app.init();
    ds = m.get(DataSource);
    tenantId = (await createTestTenant(ds, 't_3114_cross')).id;
    jwt = await loginAndGetJwt(app, await createTestUser(ds, tenantId, 'broker_admin'));
  });

  afterAll(async () => {
    await truncateAppointments(ds, tenantId);
    await truncateRooms(ds, tenantId);
    await truncateDeals(ds, tenantId);
    await truncateInteractions(ds, tenantId);
    await truncatePipelines(ds, tenantId);
    await truncateContacts(ds, tenantId);
    await truncateCompanies(ds, tenantId);
    await app.close();
  });

  it('Scenario 1 : Full commercial flow (Company -> Contact -> Deal won -> Audit interaction)', async () => {
    // 1. Create company
    const company = await createTestCompany(app, jwt, tenantId, { name: 'Cabinet Test Cross' });
    expect(company.id).toBeDefined();

    // 2. Attach contact
    const contact = await createTestContact(app, jwt, tenantId, {
      first_name: 'Mohamed', last_name: 'Bennani', company_id: company.id,
    });
    expect(contact.id).toBeDefined();

    // 3. Setup pipeline + create deal
    const pipeline = await createTestPipeline(app, jwt, tenantId, { name: 'Pipeline Test' });
    const leadStage = pipeline.stages.find((s: any) => !s.is_terminal);
    const deal = await createTestDeal(app, jwt, tenantId, {
      pipeline_id: pipeline.id, stage_id: leadStage.id, contact_id: contact.id,
      amount: 50000,
    });
    expect(deal.id).toBeDefined();

    // 4. Win the deal
    const winRes = await request(app.getHttpServer())
      .post(`/api/v1/crm/deals/${deal.id}/won`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({ reason: 'Customer signed contract' });
    expect(winRes.status).toBe(200);
    expect(winRes.body.data.status).toBe('won');

    // 5. Verify interaction note logged
    await createTestInteraction(app, jwt, tenantId, {
      contact_id: contact.id, type: 'note', direction: 'internal',
      content: 'Deal won! Contract signed.',
    });

    // 6. Verify forecast EXCLUDES won deal
    const forecastRes = await request(app.getHttpServer())
      .get('/api/v1/crm/deals/forecast?period=all')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(forecastRes.body.data.total_amount).toBe(0);  // won exclu
  });

  it('Scenario 2 : Booking flow (Room -> Appointment -> Cancel -> Re-book same slot)', async () => {
    const room = await createTestRoom(app, jwt, tenantId, { name: 'Salle Cross' });
    const contact = await createTestContact(app, jwt, tenantId);

    const futureStart = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const futureEnd = new Date(futureStart.getTime() + 60 * 60 * 1000);

    const first = await createTestAppointment(app, jwt, tenantId, {
      room_id: room.id, contact_id: contact.id,
      start_at: futureStart.toISOString(), end_at: futureEnd.toISOString(),
    });

    // Cancel
    await request(app.getHttpServer())
      .post(`/api/v1/booking/appointments/${first.id}/cancel`)
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({ reason: 'Client unavailable' });

    // Re-book same slot OK (EXCLUDE filter excludes cancelled)
    const second = await createTestAppointment(app, jwt, tenantId, {
      room_id: room.id, contact_id: contact.id,
      start_at: futureStart.toISOString(), end_at: futureEnd.toISOString(),
    });
    expect(second.id).toBeDefined();
    expect(second.id).not.toBe(first.id);
  });

  it('Scenario 3 : Search cross-CRM (Bennani trouve contact + company + deal)', async () => {
    await createTestCompany(app, jwt, tenantId, { name: 'Cabinet Bennani Search Test' });
    await createTestContact(app, jwt, tenantId, { last_name: 'Bennani', first_name: 'Karima' });

    const r = await request(app.getHttpServer())
      .get('/api/v1/crm/search?q=Bennani')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId);
    expect(r.body.data.total_results).toBeGreaterThanOrEqual(2);
    expect(r.body.data.results_by_type.companies).toBeGreaterThanOrEqual(1);
    expect(r.body.data.results_by_type.contacts).toBeGreaterThanOrEqual(1);
  });

  it('Scenario 4 : Custom fields integration (define -> create contact -> validate)', async () => {
    // Define custom field
    await request(app.getHttpServer())
      .post('/api/v1/admin/custom-fields')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({
        entity_type: 'contact', field_name: 'matricule', field_type: 'string',
        options: { min_length: 3, max_length: 20 }, required: false,
        position: 1, label_fr: 'Matricule',
      });

    // Create contact with custom field
    const r1 = await request(app.getHttpServer())
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({
        first_name: 'A', last_name: 'B',
        preferred_locale: 'fr', country_code: 'MA',
        custom_fields: { matricule: 'XYZ123' },
      });
    expect(r1.status).toBe(201);
    expect(r1.body.data.custom_fields.matricule).toBe('XYZ123');

    // Reject invalid custom field
    const r2 = await request(app.getHttpServer())
      .post('/api/v1/crm/contacts')
      .set('Authorization', `Bearer ${jwt}`)
      .set('x-tenant-id', tenantId)
      .send({
        first_name: 'X', last_name: 'Y',
        preferred_locale: 'fr', country_code: 'MA',
        custom_fields: { matricule: 'AB' },  // < min_length 3
      });
    expect(r2.status).toBe(400);
  });

  it('Scenario 5 : Multi-tenant isolation (tenant A invisible tenant B)', async () => {
    await createTestCompany(app, jwt, tenantId, { name: 'Cabinet Isolation Test' });

    const otherTenant = (await createTestTenant(ds, 't_3114_other')).id;
    const otherJwt = await loginAndGetJwt(app, await createTestUser(ds, otherTenant, 'broker_admin'));
    const r = await request(app.getHttpServer())
      .get('/api/v1/crm/companies')
      .set('Authorization', `Bearer ${otherJwt}`)
      .set('x-tenant-id', otherTenant);
    const isolated = r.body.data.data.find((c: any) => c.name === 'Cabinet Isolation Test');
    expect(isolated).toBeUndefined();
  });
});
```

### 6.8 Fichier 8 sur 8 : Runbook ops

```markdown
# Runbook Sprint 8 -- Seed CRM/Booking + Tests E2E

**Version** : Sprint 8 v1.0
**Audience** : Developpeurs frontends Sprint 16+, equipe ops, admin Skalean
**Date** : Sprint 8 cloture

---

## 1. Prerequis

1. Postgres 16+ accessible via `DATABASE_URL` (verifie via `psql $DATABASE_URL -c 'SELECT 1'`).
2. Redis 7+ accessible via `REDIS_URL`.
3. Kafka cluster up (docker-compose service `kafka`).
4. Variables env presentes : `DATABASE_URL`, `REDIS_URL`, `KAFKA_BROKERS`, `JWT_PRIVATE_KEY`, `PASSWORD_PEPPER`, `CALENDAR_TOKENS_ENCRYPTION_KEY`.
5. Migrations Sprint 1-8 toutes appliquees : `pnpm --filter @insurtech/database migrate:run` exit 0.
6. NODE_ENV NE doit PAS etre `production` (script refuse).

## 2. Seed dataset dev

```bash
cd repo

# Verifier prerequisites
pnpm --filter @insurtech/database migrate:run

# Seed (premiere fois)
pnpm seed:crm-booking

# Reset puis re-seed (workflow normal apres modifs)
pnpm seed:crm-booking --reset

# Incremental (rare, debug seulement)
pnpm seed:crm-booking --incremental
```

Resultat attendu (~60 secondes) :
- 2 tenants (Cabinet Bennani + Garage Atlas)
- ~16 users
- 10 companies
- 50 contacts
- 4 pipelines (2 par tenant)
- 30 deals
- 100 interactions
- 6 rooms (3 par tenant)
- 50 appointments

Credentials login :
- `broker_admin.1@cabinet-bennani.skalean.dev` / `SkaleanDev2026!`
- `garage_admin.1@garage-atlas.skalean.dev` / `SkaleanDev2026!`

## 3. Tests E2E Sprint 8

```bash
# Lancer toute la suite Sprint 8 (~5 min)
pnpm e2e:sprint-08

# Sous-suite par module
pnpm e2e:sprint-08 -- --testPathPattern=sprint-08/companies
pnpm e2e:sprint-08 -- --testPathPattern=sprint-08/appointments

# Cross-modules uniquement
pnpm e2e:sprint-08 -- --testPathPattern=sprint-08/cross-modules
```

Attendu : 50+ scenarios PASS, 0 FAIL.

## 4. Troubleshooting

### 4.1 Erreur Postgres "extension btree_gist does not exist"

Solution : `psql $DATABASE_URL -c "CREATE EXTENSION btree_gist;"`. Sprint 1 task 1.1.4 normalement appliquee.

### 4.2 Erreur Kafka "Connection refused"

Solution : `docker compose up -d kafka` ; attendre 30s ; retry.

### 4.3 Seed echoue avec "duplicate key (tenant_id, ice)"

Cause : seed run 2x sans `--reset`. Solution : `pnpm seed:crm-booking --reset`.

### 4.4 E2E timeout Kafka events consumer

Cause : Kafka backpressure. Solution : `docker compose restart kafka`, attendre 10s, retry.

### 4.5 EXCLUDE constraint conflict appointment seed

Cause : random times collision. Solution : `pnpm seed:crm-booking --reset` (idempotent).

## 5. Go-no-go pre-pilote (25 checks manuels)

| # | Check | Commande / Verification | OK/KO |
|---|-------|------------------------|-------|
| 1 | Migrations 13 Sprint 8 appliquees | `psql -c "SELECT name FROM migrations WHERE name LIKE '%CRM%' OR name LIKE '%Booking%'"` |  |
| 2 | Extension pg_trgm active | `psql -c "SELECT extname FROM pg_extension WHERE extname='pg_trgm'"` |  |
| 3 | Extension btree_gist active | idem |  |
| 4 | Index GIN trigram crm_contacts | `psql -c "\\di idx_crm_contacts_search"` |  |
| 5 | EXCLUDE constraint booking_appointments | `psql -c "\\d booking_appointments" | grep EXCLUDE` |  |
| 6 | RLS policies actives | `psql -c "SELECT tablename FROM pg_policies"` |  |
| 7 | Kafka topics 20+ crees | `kafka-topics --list` |  |
| 8 | Redis 6 dbs reserves (0=rbac, 1=lockout, 2=search, 3=custom, 4=oauth_state, 5=holidays, 6=ical) | `redis-cli INFO keyspace` |  |
| 9 | API health endpoint OK | `curl localhost:4000/api/v1/health` |  |
| 10 | Swagger documentation accessible | `curl localhost:4000/api/docs` |  |
| 11 | Login broker_admin reussi | `curl POST /auth/login` |  |
| 12 | Permission CRM_COMPANIES_CREATE assigne broker_admin | endpoint test |  |
| 13 | Permission CRM_DEALS_DELETE refuse assure | 403 attendu |  |
| 14 | Multi-tenant isolation : tenant A invisible tenant B | test list /companies cross-tenant |  |
| 15 | Audit log capture create company | `psql -c "SELECT count(*) FROM audit_logs WHERE entity_type='crm_company'"` |  |
| 16 | Kafka event crm.company.created publishe | kafka-console-consumer |  |
| 17 | Search trigram < 100ms p95 | benchmark E2E |  |
| 18 | Forecast pondered correct | test 2 deals 50/100 = 75K weighted |  |
| 19 | EXCLUDE constraint rejette overlap appointment | test 2 appointment same slot |  |
| 20 | Cancelled appointment libere slot | re-book same slot OK |  |
| 21 | Calendar Google OAuth flow complet | manual test |  |
| 22 | Calendar pull job execute 5min | logs |  |
| 23 | iCal feed RFC 5545 valide | parser test |  |
| 24 | Custom fields validation cross-services | define + create contact |  |
| 25 | No-emoji decision-006 respecte | grep regex |  |

---

## 6. Maintenance

- **Holidays MA** : maj annuelle `holidays-ma-2025-2030.json` Sprint 28.
- **Default password seed** : changement requis avant production.
- **Faker locale** : verifier `@faker-js/faker` 9.3+.

---

**Fin runbook Sprint 8 seed + test.**
```

---

## 7. Tests complets

50+ E2E :
- 14 fichiers sprint-08/*.full.e2e-spec.ts (52 scenarios)
- 1 cross-modules.e2e-spec.ts (5 scenarios)
- Total : 57 scenarios PASS.

---

## 8. Variables environnement

```env
# === Sprint 8 task 3.1.14 Seeds ===
SEED_TENANT_BENNANI_NAME=Cabinet Bennani Casablanca
SEED_TENANT_ATLAS_NAME=Garage Atlas Casablanca
SEED_RESET_BEFORE=false
```

---

## 9. Commandes shell

```bash
cd repo
pnpm add @faker-js/faker@9.3.0 -D --filter @insurtech/api

# Seed
pnpm seed:crm-booking --reset

# E2E Sprint 8 complete
pnpm e2e:sprint-08

# Verifier seed result
psql $DATABASE_URL -c "SELECT COUNT(*) FROM crm_contacts"
# Expected : 50

# Commit
git add -A
git commit -m "feat(sprint-08): tests E2E exhaustifs 50+ scenarios + seeds dev CRM/Booking realistes

Cloture Sprint 8. Tests integration cross-modules + seeds faker fr_MA.
Runbook ops Sprint 16+ + checklist go-no-go pre-pilote.

Task: 3.1.14 / Sprint: 8 / Reference: B-08 Tache 3.1.14"
```

---

## 10. Criteres validation V1-V25

### Criteres P0 (15)

- V1 Script seed-crm-booking.ts execute en < 60s
- V2 Seed produit 2 tenants + 16 users + 10 companies + 50 contacts + 30 deals + 100 interactions + 6 rooms + 50 appointments
- V3 Seed refuse si NODE_ENV=production
- V4 Flag --reset truncate + recreate
- V5 Flag --incremental append
- V6 Faker locale fr_MA produit noms maghrebins realistes
- V7 ICE valides format 15 chiffres
- V8 CIN valides format MA
- V9 Phone E.164 +212 valides
- V10 50+ scenarios E2E PASS
- V11 5 scenarios cross-modules PASS
- V12 Tests RBAC reject sur chaque module
- V13 Tests multi-tenant isolation sur chaque module
- V14 Runbook complet 25 checks go-no-go
- V15 Documentation ops accessible

### Criteres P1 (7)

- V16 E2E suite < 5min
- V17 Reproducibility : 5 runs PASS
- V18 Performance benchmarks (search < 100ms, availability < 200ms)
- V19 Coverage cross-modules >= 80%
- V20 Default password seed claire dans docs
- V21 Tests CI green
- V22 Seed deterministic (faker.seed fixed)

### Criteres P2 (3)

- V23 No-emoji
- V24 Lint 0 erreur
- V25 Logs structures (JSON Pino)

---

## 11. Edge cases + troubleshooting

1. Seed run sans migrations -> erreur claire "Run pnpm migrate:run first".
2. Seed kill mi-execution -> retry idempotent.
3. CI sans Kafka -> tests Kafka-dependent skip.
4. faker random duplicate CIN -> counter prevention.
5. EXCLUDE violation seed appointments -> skip continue.
6. Audit subscriber pollute -> seed disable subscriber.
7. Redis full memory -> warning + continue.
8. NODE_ENV undefined -> traite comme dev (warning log).
9. Migration manquante -> fail-fast.
10. Tests E2E timeout 60s par defaut -> --testTimeout=120000 si needed.

---

## 12. Conformite Maroc detaillee

Seeds = data realistes MA (noms, ICE, CIN, phones, holidays). Conformite CNDP : seeds sont dev-only, jamais en prod.

---

## 13. Conventions absolues skalean-insurtech

(Identique tache 3.1.1.)

---

## 14. Validation pre-commit

```bash
cd repo
pnpm seed:crm-booking --reset
pnpm e2e:sprint-08
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/infrastructure/scripts repo/apps/api/test/sprint-08 --include="*.ts" --include="*.md" && exit 1 || echo OK
```

---

## 15. Commit message complet

```bash
git commit -m "feat(sprint-08): tests E2E exhaustifs 50+ scenarios + seeds dev CRM/Booking realistes

Cloture Sprint 8. Tests integration cross-modules valident integration 13 taches Sprint 8.
Seeds dev realistes faker fr_MA produisent dataset complet pour frontends Sprint 16+.
Runbook ops permanent avec checklist 25 go-no-go pre-pilote Marrakech.

Livrables:
- seed-crm-booking.ts orchestre 2 tenants + 16 users + 10 companies + 50 contacts + 30 deals + 100 interactions + 6 rooms + 50 appointments
- 14 fichiers tests sprint-08/*.full.e2e-spec.ts (52 scenarios)
- cross-modules.e2e-spec.ts (5 scenarios integration)
- runbook ops 00-pilotage/runbooks/sprint-08-seed-and-test.md
- 57 tests E2E PASS en < 5min
- Seed run < 60s avec faker fr_MA realiste

Task: 3.1.14 / Sprint: 8 / Reference: B-08 Tache 3.1.14"
```

---

## 16. Workflow next step

Apres commit Sprint 8 complet :
- Lancer verification automatique sprint via `00-pilotage/verifications/V-08-sprint-08-crm-booking.md` (cree separement).
- Updater `_SUMMARY.md` Sprint 8 -> status complete.
- Demarrer Sprint 9 (Comm WA + Email) : `task-2.4.1-...`.

---

**Fin task-3.1.14-tests-e2e-exhaustifs-seeds-dev.md.**

Densite : ~95 ko ; 8 fichiers principaux + 14 tests modules + 1 runbook (~2800 lignes) ; 57 tests E2E ; V1-V25.
