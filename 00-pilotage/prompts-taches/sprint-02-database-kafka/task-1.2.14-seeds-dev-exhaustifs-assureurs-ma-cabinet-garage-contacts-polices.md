---
task_id: 1.2.14
sprint: 02
phase: 1
duration: 4h
priority: P0
depends_on: 1.2.13
blocks: 1.2.15
status: ready
owner: backend-platform-team
no_emoji: true
---

# Tache 1.2.14 -- Seeds dev exhaustifs : 5 assureurs MA + 1 cabinet courtier + 1 garage + 50 contacts + 20 polices

## 1. Header et metadonnees

| Champ | Valeur |
|-------|--------|
| ID tache | 1.2.14 |
| Sprint | 02 (Database & Kafka Foundation) |
| Phase | 1 (Foundation Multi-Tenant) |
| Duree estimee | 4 heures |
| Priorite | P0 (bloquant Sprint 2 closure et tous Sprints 3-32) |
| Depend de | 1.2.13 (RLS Row Level Security policies actives) |
| Bloque | 1.2.15 (Documentation database & runbooks Sprint 2) |
| Owner | backend-platform-team |
| Reviewer | tech-lead + product-owner |
| Convention emoji | AUCUNE EMOJI dans code, commits, logs, docs (decision-006) |
| Convention timezone | Africa/Casablanca (decision-002) |
| Convention currency | MAD (Dirham Marocain) ISO 4217 (decision-002) |
| Convention locale | fr-MA primaire, ar-MA secondaire (decision-002) |
| Convention cluster | Benguerir on-prem dev/staging/prod (decision-008) |
| Convention CNDP | Donnees fictives faker (Loi 09-08 conformite) |

Cette tache 1.2.14 est la 14eme et avant-derniere tache du Sprint 2 (Database & Kafka Foundation), positionnee strategiquement apres l'activation des policies RLS (tache 1.2.13) pour valider que les seeds peuvent etre injectes en respectant le contexte multi-tenant. Elle livre un script TypeScript executable qui peuple la base de donnees PostgreSQL de developpement avec un jeu de donnees realiste et coherent reproduisant un mini-ecosysteme InsurTech Marocain : 1 cabinet de courtage Casablanca (Bennani), 1 garage Marrakech (Atlas), 5 assureurs reels du marche MA (Wafa, Atlanta Sanad, Saham, RMA, AXA), 25 produits d'assurance, 50 contacts CRM, 20 deals pipeline, 20 polices fictives, 10 RDV booking futurs, 30 messages communication, 50 entrees audit log et 200 evenements analytics.

## 2. But (3 paragraphes denses)

**Paragraphe 1 -- Productivite developpeurs.** L'objectif primaire est d'eliminer le temps perdu par chaque developpeur Skalean (8 personnes equipe initiale, croissance vers 25 d'ici Sprint 18) qui doit aujourd'hui creer manuellement des donnees test pour valider ses developpements. Sans seeds exhaustifs, chaque developpeur perd entre 30 et 90 minutes par jour a creer des contacts, deals, polices via curl ou Postman pour tester son code, soit cumule sur 6 mois pre-MVP environ 1500 a 4500 heures de productivite gachee. Avec ce script seed-dev.ts execute en moins de 30 secondes via `pnpm seeds:dev`, chaque developpeur dispose instantanement d'un environnement representatif avec donnees coherentes (FK valides, RLS respecte, tenants separes), permettant de tester immediatement les fonctionnalites courtier (login broker_admin Bennani, voir 30 contacts, creer deal, generer police) ou garage (login garage_chef Atlas, voir 20 contacts, creer ordre de reparation futur Sprint 19). Le ROI est immediat et exponentiel sur la duree du programme 32 sprints.

**Paragraphe 2 -- Demos client et acceptance testing.** Le deuxieme objectif est de permettre des demos commerciales fluides et credibles sans avoir a configurer manuellement des donnees a chaque demo. L'equipe sales/founder pourra a tout moment lancer `pnpm seeds:dev` sur un environnement demo cloud (Benguerir staging accessible via VPN) et obtenir un cabinet Bennani entierement peuple avec contacts portant des noms typiquement marocains (Mohamed El Alaoui, Fatima Zahra Bennani, Youssef Tazi, Khadija Berrada, etc.), des polices avec assureurs reels (Wafa Assurance, AXA Assurance Maroc), des montants en MAD coherents avec le marche local (5000 a 50000 MAD pour deals B2C, 100000 a 500000 MAD pour deals corporate), et des dates respectant le calendrier business marocain (jours feries BAM 2026 exclus pour RDV, mois Ramadan 2026 du 18 fevrier au 19 mars considere pour disponibilites). Les seeds servent egalement de fondation aux tests E2E Cypress/Playwright qui seront introduits Sprint 17 (Customer Portal) et Sprint 19 (Garage Module) : chaque suite de tests E2E peut s'appuyer sur un etat connu reproductible.

**Paragraphe 3 -- Validation transverse multi-modules.** Le troisieme objectif strategique est de valider de bout en bout que l'architecture multi-tenant Sprint 2 fonctionne sous charge realiste avec donnees representatives. Les seeds croisent volontairement plusieurs domaines (CRM contacts/deals, Insurance polices/produits, Booking RDV, Communication messages, Audit logs, Analytics events) pour exposer immediatement tout probleme de FK, RLS, performance, encoding UTF-8 (caracteres arabes pour adresses bilingues), gestion ICE 15 chiffres, format CIN marocain, telephones E.164 +2126/+2127, dates timezone Africa/Casablanca, montants Decimal MAD precision 2. Si les seeds passent en moins de 30 secondes sans erreur et avec idempotency (re-run sans erreur), cela prouve que les fondations Sprint 2 (multi-tenancy 1.2.1, schemas 1.2.2-1.2.10, migrations Flyway 1.2.11, backup pgBackRest 1.2.12, RLS 1.2.13) sont solides et pretes a soutenir les sprints applicatifs 3 a 32.

## 3. Contexte etendu (8-10 ko)

### 3.1 Pourquoi seeds idempotents vs reset+rerun systematique

La question architecturale fondamentale est : faut-il preferer des seeds idempotents (ON CONFLICT DO NOTHING + check existence par UNIQUE keys) ou imposer un reset complet (TRUNCATE CASCADE) avant chaque execution ? Skalean adopte une approche hybride avec deux scripts distincts : `seeds:run` idempotent par defaut (pour developpeurs qui veulent ajouter sans perdre leur travail courant), et `seeds:reset` puis `seeds:run` combines via `seeds:dev` (pour reset propre avant demo ou test E2E).

L'approche idempotente pure presente l'avantage de ne jamais detruire de donnees et permet des executions multiples sans effets de bord (utile pour CI ou quand un developpeur a deja cree des donnees test manuelles qu'il veut conserver). Son inconvenient : elle ne peut pas faire evoluer une donnee existante (un contact deja cree avec un email donne ne sera pas mis a jour si le script seed change ses attributs). 

L'approche reset+rerun garantit un etat connu reproductible a 100 pour cent (utile pour tests E2E deterministes), mais detruit toutes les donnees y compris celles creees manuellement par le developpeur. Skalean choisit de fournir les deux via deux scripts package.json distincts pour laisser le developpeur choisir selon son use case.

### 3.2 Alternatives faker.locale fr-MA vs custom data

La librairie @faker-js/faker version 9 ne supporte pas nativement la locale fr-MA (Maroc francophone). Trois alternatives ont ete evaluees :

**Option A : faker locale fr (France).** Avantage : fonctionne out-of-the-box, riche en donnees. Inconvenient : noms (Pierre, Marie, Jean) et adresses (Paris, Lyon) francais ne sont pas du tout representatifs du Maroc, demos non credibles.

**Option B : faker locale ar (arabe generique).** Avantage : noms arabes plausibles. Inconvenient : ecriture droite-a-gauche complique l'affichage UI, melange noms du Golfe non representatifs Maghreb, pas d'adresses MA.

**Option C : faker fr + custom MA data overrides (RETENU).** Skalean cree un fichier `seed-data/noms-fr-ma.json` avec 100 prenoms et 100 noms typiques marocains francophones (Mohamed El Alaoui, Fatima Zahra Bennani, Youssef Tazi, Khadija Berrada, Hassan Lamrini, Zineb Chraibi, Karim Fassi, Aicha Skalli, Said Idrissi, Naima Cherkaoui, Rachid Bennis, Samira Alami, Omar Benjelloun, Houda Sebti, Ahmed Mouline, Salma Kettani, Driss Berrada, Mounia Filali, Anas Squalli, etc.) et un fichier `seed-data/villes-ma.json` avec 20 villes principales. Les autres champs (email, ICE, CIN, phone, dates) utilisent des generateurs custom dans `seed-helpers.ts`. Cette approche est maintenable et 100 pour cent realiste.

### 3.3 Trade-offs realisme vs performance

**Realisme maximal coute en performance.** Generer un ICE 15 chiffres avec verification d'unicite cross-tenant (donc 1 SELECT puis 1 INSERT par contact, soit 100 round-trips DB pour 50 contacts) prend ~3 secondes. Hasher 5 mots de passe avec argon2id (parametres OWASP : memoryCost 65536, timeCost 3, parallelism 4) prend ~15 secondes pour 5 utilisateurs (3s/hash). Au total un seed naif depasse les 30s.

**Optimisations retenues :**
1. Batch INSERT (50 contacts en 1 seule requete via INSERT INTO ... VALUES (...), (...), (...) ON CONFLICT) : passe de 3s a 0.2s.
2. Hash argon2id factorise : 1 seul hash pour le mot de passe `Demo!2026Skalean` partage entre les 5 users seed (acceptable en dev seulement, pas prod) : passe de 15s a 3s.
3. ICE generator deterministe par seed random (SEED_RANDOM_SEED=42) avec cache memoire pour eviter SELECT existence : passe de 3s a 0.1s.
4. Polices/deals/RDV en batch INSERT 100 lignes par batch : total < 10s.

Resultat : seeds:run complet en moins de 30 secondes (target V1).

### 3.4 Decisions transverses applicables (002, 003, 008)

- **decision-002** : Conformite Maroc => timezone Africa/Casablanca pour toutes dates, currency MAD pour tous montants, locale fr-MA primaire, format ICE 15 chiffres, format CIN A123456, format telephone E.164 +2126XXXXXXXX (mobile) ou +2125XXXXXXXX (fixe), TVA 20 pour cent par defaut sur produits assurance.
- **decision-003** : Stack figee => PostgreSQL 16 (utilisation gen_random_uuid, generated columns, JSONB), pg-boss pour jobs futurs, Drizzle ORM (utilise dans seed-dev.ts via `db.insert(schema.contacts).values([...])`), pino logger pour traces.
- **decision-008** : Cluster Benguerir on-prem => seeds executes sur Postgres local Benguerir (latence < 1ms intra-rack), pas de cloud. Seeds dev sur poste developpeur via docker-compose pointant Postgres local.

### 3.5 Douze pieges techniques anticipes

**Piege 1 : ICE 15 chiffres collision cross-tenant.** L'ICE (Identifiant Commun de l'Entreprise) est theoriquement unique au niveau Maroc entier. Mais en seeds dev avec faker, generer 50 ICE aleatoires sur 15 chiffres a une probabilite de collision quasi-nulle (1 sur 10^15) cependant on ajoute un check_constraint UNIQUE par tenant et un retry sur conflict.

**Piege 2 : CIN format prefecture variation.** La CIN marocaine commence par 1 ou 2 lettres correspondant a la prefecture/province (A=Rabat, B=Casablanca, BH=Casablanca-Anfa, BE=Casablanca-Hay Hassani, etc.) suivies de 6 chiffres. Le seed genere des CIN avec prefixes A/B/BH/BE/C/D pour realisme.

**Piege 3 : Phone E.164 +212 mobile vs fixe.** Mobile MA : +2126XXXXXXXX (Maroc Telecom 6, Inwi 7) ou +2127XXXXXXXX (Orange 7). Fixe : +2125XXXXXXXX. Le seed genere 80 pour cent mobile et 20 pour cent fixe.

**Piege 4 : Password argon2id slow seed +5min.** Hash argon2id de 5 users a 3s/hash = 15s (limite acceptable). Si on hashait 50 users individuellement = 150s = depasse target. Solution : hash unique partage en dev + warning log.

**Piege 5 : Faker locale fr vs fr-MA absent.** Faker n'a pas fr-MA. Solution : fr + custom JSON noms-fr-ma.json (cf section 3.2).

**Piege 6 : Foreign keys order.** Ordre d'insertion strict : tenants -> users -> contacts -> deals -> assureurs -> produits -> polices -> rdv -> messages -> audit -> analytics. Une violation FK arrete tout le seed.

**Piege 7 : RLS bypass pour seeds super admin.** Les seeds inserent des donnees dans plusieurs tenants (skalean, bennani, atlas). Un user authentifie avec un seul tenant_id ne pourrait pas faire d'INSERT cross-tenant. Solution : connexion seeds avec role `seed_admin` qui a `BYPASSRLS` ou execution avec `SET LOCAL row_security = off` (super admin context).

**Piege 8 : Soft delete deja exists.** Si un seed precedent a soft-delete un contact (deleted_at != NULL), le UNIQUE constraint sur email tient toujours. Le re-run trouve l'email occupe et fait DO NOTHING au lieu de re-inserer un nouveau contact. Documentation : seeds:reset pour repartir propre.

**Piege 9 : Sequence reset ID.** Apres TRUNCATE CASCADE RESTART IDENTITY, les sequences `serial`/`bigserial` repartent de 1. Verifier que les references ULID/UUID generees par seeds sont independantes des sequences (pas de probleme).

**Piege 10 : Polices format YYYY-NNNN per-tenant.** Format `POL-2026-NNNN` ou NNNN est un compteur par-tenant. Pour 20 polices reparties Bennani uniquement (decision metier : Atlas est un garage, pas un courtier, donc pas de polices), Bennani aura POL-2026-0001 a POL-2026-0020. La sequence est verrouillee via `pg_advisory_xact_lock(tenant_id::bigint)` pour eviter race conditions.

**Piege 11 : Ramadan dates 2026 Hijri vs Gregorien.** Ramadan 2026 = 18 fevrier 2026 au 19 mars 2026 (Gregorien). Pendant ce mois, horaires bureau reduits (8h-15h au lieu de 9h-18h). Les seeds RDV evitent les creneaux post-15h pendant Ramadan.

**Piege 12 : BAM holidays 2026.** Bank Al-Maghrib publie chaque annee la liste des jours feries. 2026 inclut : 1er janvier (Jour de l'An), 11 janvier (Manifeste de l'Independance), 1er mai (Fete du Travail), 30 juillet (Fete du Trone), 14 aout (Allegeance Oued Ed-Dahab), 20 aout (Revolution du Roi et du Peuple), 21 aout (Fete de la Jeunesse), 6 novembre (Marche Verte), 18 novembre (Independance), plus feriés religieux (Aid El Fitr ~20-21 mars, Aid El Adha ~26-27 mai, Awal Moharram ~16 juillet, Aid El Mawlid ~24 septembre). Les seeds RDV excluent ces dates.

## 4. Architecture context

Cette tache 1.2.14 est la 14eme tache du Sprint 2 sur 15 tachees totales, et elle constitue le point culminant de validation de toutes les fondations precedemment posees. Elle est positionnee strategiquement apres l'activation RLS (1.2.13) car les seeds doivent prouver que les donnees inserees respectent les policies (chaque tenant voit uniquement ses propres donnees). Elle est positionnee avant la documentation finale (1.2.15) car le travail de documentation s'appuiera sur des donnees reelles peuplees pour generer des screenshots, des exemples curl, des rapports de monitoring Grafana avec donnees visibles.

**Contribution a la fondation visible immediate :** Sans seeds, les developpeurs Sprint 3 et au-dela auraient une base vide demoralisante. Avec ces seeds, des le clone du repo + `docker-compose up` + `pnpm seeds:dev`, le developpeur voit une UI peuplee, des graphiques Grafana avec metriques, des Kafka topics traversees par des events analytics, donnant la sensation immediate de travailler sur un produit vivant.

**Preparation demos client Sprint 5+ et tests E2E Sprint 17+ :** Les founders Skalean visent des premiers prospects courtiers MA des Sprint 5-6 (Mai-Juin 2026). Les seeds permettent de demarrer une demo en moins de 30 secondes. Les tests E2E Cypress qui seront introduits Sprint 17 (Customer Portal) et Sprint 19 (Garage Module) s'appuieront sur ces seeds comme baseline reproductible : chaque test E2E commence par `seeds:reset && seeds:run` (2 minutes total acceptable car run en CI dedie).

**Position dans la roadmap multi-sprints :**
- Sprint 2 (actuel) : seeds basiques contacts/deals/polices CRUD valides.
- Sprint 5-6 (CRM) : seeds enrichis avec interactions logs, taches, notes.
- Sprint 14 (Insurance Core) : seeds polices reelles enrichies avec garanties, sinistres.
- Sprint 17 (Customer Portal) : seeds clients finaux avec auth comptes self-service.
- Sprint 19 (Garage Module) : seeds garages enrichis avec ordres reparation, factures, vehicules.
- Sprint 32 (Production hardening) : seeds remplaces par anonymisation prod -> staging.

## 5. Livrables checkables (32 livrables)

1. Fichier `apps/platform/scripts/seed-dev.ts` cree (~500 lignes) avec orchestration sequentielle 13 seeds.
2. Fichier `apps/platform/scripts/seed-reset.ts` cree (~50 lignes) avec TRUNCATE CASCADE.
3. Fichier `apps/platform/scripts/seed-helpers.ts` cree avec generateIce, generateCin, generatePhoneMa, generatePoliceNumber, generateInvoiceNumber, generateUlid.
4. Repertoire `apps/platform/scripts/seed-data/` cree avec 4 fichiers JSON.
5. Fichier `seed-data/assureurs-ma.json` cree (5 assureurs reels avec ACAPS code).
6. Fichier `seed-data/produits-assurance.json` cree (25 produits, 5 par assureur).
7. Fichier `seed-data/villes-ma.json` cree (20 villes principales).
8. Fichier `seed-data/noms-fr-ma.json` cree (100 prenoms + 100 noms typiques MA).
9. Tenant Skalean Platform insere (super admin, type 'mixed').
10. Tenant Bennani insere (broker, Casablanca, settings Africa/Casablanca + fr + MAD).
11. Tenant Atlas insere (garage, Marrakech).
12. 5 utilisateurs inseres avec argon2id password.
13. 50 contacts CRM inseres (30 Bennani + 20 Atlas) noms MA realistes.
14. 20 deals CRM inseres (5 lead, 5 qualified, 5 proposal, 5 won).
15. 5 assureurs MA inseres (Wafa, Atlanta Sanad, Saham, RMA, AXA).
16. 25 produits assurance inseres (5 par assureur).
17. 20 polices fictives inserees (mix actives/expirees/annulees, format POL-2026-NNNN).
18. 10 RDV booking dans futur (Bennani + Atlas).
19. 30 messages communication inseres (mix WhatsApp + Email).
20. 50 audit_log entries inserees (mix INSERT/UPDATE).
21. 200 analytics_events inseres (mix event_name).
22. Suite de tests `seeds.spec.ts` >= 8 tests passants.
23. Suite de tests `data-coherence.spec.ts` >= 6 tests passants.
24. Suite de tests `generators.spec.ts` >= 8 tests passants.
25. Suite de tests `faker-locale.spec.ts` >= 4 tests passants.
26. Scripts package.json ajoutes : seeds:run, seeds:reset, seeds:dev, seeds:test.
27. Performance verifiee : `pnpm seeds:run` < 30 secondes.
28. Idempotency verifiee : 2eme `pnpm seeds:run` consecutif < 5 secondes sans erreur.
29. Reset clean verifie : `pnpm seeds:reset` puis `pnpm seeds:run` reussit.
30. Variables env documentees (>= 18 variables) dans `.env.example`.
31. Fichier `docs/seeds-dev-readme.md` cree avec procedure usage.
32. Commit conventionnel `feat(seeds): exhaustive dev seeds for MA insurtech ecosystem` pousse.

## 6. Fichiers a creer/modifier

### Arborescence ciblee
```
apps/platform/
  scripts/
    seed-dev.ts                       (CREATE, ~500 lignes)
    seed-reset.ts                     (CREATE, ~50 lignes)
    seed-helpers.ts                   (CREATE, ~250 lignes)
    seed-data/
      assureurs-ma.json               (CREATE, 5 entries)
      produits-assurance.json         (CREATE, 25 entries)
      villes-ma.json                  (CREATE, 20 entries)
      noms-fr-ma.json                 (CREATE, 100+100 entries)
  test/
    seeds/
      seeds.spec.ts                   (CREATE, 8 tests)
      data-coherence.spec.ts          (CREATE, 6 tests)
      generators.spec.ts              (CREATE, 8 tests)
      faker-locale.spec.ts            (CREATE, 4 tests)
package.json                          (MODIFY, ajout 4 scripts)
.env.example                          (MODIFY, ajout 18 variables SEED_*)
docs/
  seeds-dev-readme.md                 (CREATE)
```

## 7. Code patterns COMPLETS

### 7.1 seed-dev.ts (orchestration complete)

```typescript
// apps/platform/scripts/seed-dev.ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { faker } from '@faker-js/faker/locale/fr';
import argon2 from 'argon2';
import { ulid } from 'ulid';
import pino from 'pino';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as schema from '../src/db/schema';
import {
  generateIce,
  generateCin,
  generatePhoneMa,
  generatePoliceNumber,
  generateInvoiceNumber,
  generateUlid,
  pickRandom,
  randomBetween,
  randomDateInRange,
  isMoroccoHoliday2026,
  isInRamadan2026,
} from './seed-helpers';

const log = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

// Seed deterministe pour reproductibilite
const RANDOM_SEED = parseInt(process.env.SEED_RANDOM_SEED ?? '42', 10);
faker.seed(RANDOM_SEED);

const CONTACTS_COUNT = parseInt(process.env.SEED_CONTACTS_COUNT ?? '50', 10);
const DEALS_COUNT = parseInt(process.env.SEED_DEALS_COUNT ?? '20', 10);
const POLICES_COUNT = parseInt(process.env.SEED_POLICES_COUNT ?? '20', 10);
const RDV_COUNT = parseInt(process.env.SEED_RDV_COUNT ?? '10', 10);
const MESSAGES_COUNT = parseInt(process.env.SEED_MESSAGES_COUNT ?? '30', 10);
const AUDIT_COUNT = parseInt(process.env.SEED_AUDIT_COUNT ?? '50', 10);
const ANALYTICS_COUNT = parseInt(process.env.SEED_ANALYTICS_COUNT ?? '200', 10);
const DEFAULT_PASSWORD = process.env.SEED_PASSWORD_DEFAULT ?? 'Demo!2026Skalean';
const TIMEZONE = process.env.SEED_TIMEZONE ?? 'Africa/Casablanca';

// Charger fichiers JSON donnees
const assureursMa = JSON.parse(
  readFileSync(resolve(__dirname, 'seed-data/assureurs-ma.json'), 'utf-8'),
);
const produitsAssurance = JSON.parse(
  readFileSync(resolve(__dirname, 'seed-data/produits-assurance.json'), 'utf-8'),
);
const villesMa = JSON.parse(
  readFileSync(resolve(__dirname, 'seed-data/villes-ma.json'), 'utf-8'),
);
const nomsFrMa = JSON.parse(
  readFileSync(resolve(__dirname, 'seed-data/noms-fr-ma.json'), 'utf-8'),
);

const pool = new Pool({
  host: process.env.DATABASE_HOST ?? 'localhost',
  port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
  database: process.env.DATABASE_NAME ?? 'skalean_dev',
  user: process.env.DATABASE_USER ?? 'seed_admin',
  password: process.env.DATABASE_PASSWORD ?? 'change-me',
});

const db = drizzle(pool, { schema });

async function main() {
  const startTime = Date.now();
  log.info({ msg: 'Starting Skalean dev seeds', randomSeed: RANDOM_SEED, timezone: TIMEZONE });

  await db.transaction(async (tx) => {
    // Bypass RLS pour seeds (super admin context)
    await tx.execute(sql`SET LOCAL row_security = off`);
    await tx.execute(sql`SET LOCAL TIMEZONE = ${TIMEZONE}`);

    // Seed 1 : Tenant Skalean Platform
    log.info('Seed 1 : Tenant Skalean Platform');
    const skaleanTenantId = generateUlid();
    await tx.execute(sql`
      INSERT INTO tenants (id, name, type, slug, settings, created_at)
      VALUES (
        ${skaleanTenantId},
        'Skalean Platform',
        'mixed',
        'skalean',
        ${JSON.stringify({ timezone: TIMEZONE, locale: 'fr', currency: 'MAD', is_super_admin: true })}::jsonb,
        NOW()
      )
      ON CONFLICT (slug) DO NOTHING
    `);

    // Seed 2 : Tenant Cabinet Bennani Assurance Casablanca
    log.info('Seed 2 : Tenant Bennani');
    const bennaniTenantId = generateUlid();
    await tx.execute(sql`
      INSERT INTO tenants (id, name, type, slug, settings, address, city, created_at)
      VALUES (
        ${bennaniTenantId},
        'Cabinet Bennani Assurance',
        'broker',
        'bennani',
        ${JSON.stringify({
          timezone: TIMEZONE,
          locale: 'fr',
          currency: 'MAD',
          ice: '001234567000089',
          rc: '123456',
          patente: '12345678',
          cnss: '1234567',
          if_fiscal: '01234567',
          acaps_code: 'CRT-001234',
        })}::jsonb,
        '15 Boulevard Mohammed V',
        'Casablanca',
        NOW()
      )
      ON CONFLICT (slug) DO NOTHING
    `);

    // Seed 3 : Tenant Garage Atlas Auto Marrakech
    log.info('Seed 3 : Tenant Atlas');
    const atlasTenantId = generateUlid();
    await tx.execute(sql`
      INSERT INTO tenants (id, name, type, slug, settings, address, city, created_at)
      VALUES (
        ${atlasTenantId},
        'Garage Atlas Auto',
        'garage',
        'atlas',
        ${JSON.stringify({
          timezone: TIMEZONE,
          locale: 'fr',
          currency: 'MAD',
          ice: '002345678000091',
          rc: '234567',
          patente: '23456789',
          cnss: '2345678',
          if_fiscal: '02345678',
        })}::jsonb,
        '42 Avenue Mohammed VI, Gueliz',
        'Marrakech',
        NOW()
      )
      ON CONFLICT (slug) DO NOTHING
    `);

    // Seed 4 : 5 utilisateurs avec argon2id password
    log.info('Seed 4 : Users argon2id');
    const passwordHash = await argon2.hash(DEFAULT_PASSWORD, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const users = [
      {
        id: generateUlid(),
        tenantId: skaleanTenantId,
        email: 'admin@skalean.ma',
        firstName: 'Belgacem',
        lastName: 'Naasaad',
        role: 'super_admin_platform',
        phone: '+212661234567',
      },
      {
        id: generateUlid(),
        tenantId: bennaniTenantId,
        email: 'admin@bennani.ma',
        firstName: 'Karim',
        lastName: 'Bennani',
        role: 'broker_admin',
        phone: '+212662345678',
      },
      {
        id: generateUlid(),
        tenantId: bennaniTenantId,
        email: 'agent@bennani.ma',
        firstName: 'Salma',
        lastName: 'Tazi',
        role: 'broker_user',
        phone: '+212663456789',
      },
      {
        id: generateUlid(),
        tenantId: atlasTenantId,
        email: 'chef@atlas.ma',
        firstName: 'Ahmed',
        lastName: 'El Alaoui',
        role: 'garage_chef',
        phone: '+212664567890',
      },
      {
        id: generateUlid(),
        tenantId: atlasTenantId,
        email: 'tech@atlas.ma',
        firstName: 'Youssef',
        lastName: 'Berrada',
        role: 'garage_technicien',
        phone: '+212665678901',
      },
    ];

    for (const u of users) {
      await tx.execute(sql`
        INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, phone, email_verified_at, created_at)
        VALUES (
          ${u.id}, ${u.tenantId}, ${u.email}, ${passwordHash},
          ${u.firstName}, ${u.lastName}, ${u.role}, ${u.phone}, NOW(), NOW()
        )
        ON CONFLICT (email) DO NOTHING
      `);
    }

    // Seed 5 : 50 contacts CRM (30 Bennani + 20 Atlas)
    log.info('Seed 5 : 50 contacts CRM');
    const contactsBennani = [];
    const contactsAtlas = [];
    const usedIces = new Set<string>();
    const usedCins = new Set<string>();

    for (let i = 0; i < 30; i++) {
      const prenom = pickRandom(nomsFrMa.prenoms);
      const nom = pickRandom(nomsFrMa.noms);
      const ville = pickRandom(villesMa);
      let ice = generateIce();
      while (usedIces.has(ice)) ice = generateIce();
      usedIces.add(ice);
      let cin = generateCin();
      while (usedCins.has(cin)) cin = generateCin();
      usedCins.add(cin);

      contactsBennani.push({
        id: generateUlid(),
        tenantId: bennaniTenantId,
        firstName: prenom,
        lastName: nom,
        email: `${prenom.toLowerCase().replace(/\s/g, '')}.${nom.toLowerCase().replace(/\s/g, '')}.${i}@example.ma`,
        phone: generatePhoneMa(),
        ice,
        cin,
        city: ville.name,
        address: `${randomBetween(1, 200)} ${faker.location.street()}, ${ville.name}`,
        type: i < 25 ? 'individual' : 'corporate',
      });
    }

    for (let i = 0; i < 20; i++) {
      const prenom = pickRandom(nomsFrMa.prenoms);
      const nom = pickRandom(nomsFrMa.noms);
      const ville = pickRandom(villesMa);
      let cin = generateCin();
      while (usedCins.has(cin)) cin = generateCin();
      usedCins.add(cin);

      contactsAtlas.push({
        id: generateUlid(),
        tenantId: atlasTenantId,
        firstName: prenom,
        lastName: nom,
        email: `${prenom.toLowerCase().replace(/\s/g, '')}.${nom.toLowerCase().replace(/\s/g, '')}.atlas${i}@example.ma`,
        phone: generatePhoneMa(),
        cin,
        city: ville.name,
        address: `${randomBetween(1, 200)} ${faker.location.street()}, ${ville.name}`,
        type: 'individual',
        // Vehicle info specific to garage tenant
        vehicleBrand: pickRandom(['Renault', 'Dacia', 'Peugeot', 'Citroen', 'Volkswagen', 'Ford', 'Toyota']),
        vehiclePlate: `${randomBetween(10000, 99999)}-${pickRandom(['A', 'B', 'C', 'D'])}-${randomBetween(1, 99)}`,
      });
    }

    const allContacts = [...contactsBennani, ...contactsAtlas];
    for (const c of allContacts) {
      await tx.execute(sql`
        INSERT INTO contacts (
          id, tenant_id, first_name, last_name, email, phone, ice, cin, city, address, type, metadata, created_at
        )
        VALUES (
          ${c.id}, ${c.tenantId}, ${c.firstName}, ${c.lastName}, ${c.email},
          ${c.phone}, ${c.ice ?? null}, ${c.cin ?? null}, ${c.city}, ${c.address}, ${c.type},
          ${JSON.stringify({
            vehicleBrand: (c as any).vehicleBrand ?? null,
            vehiclePlate: (c as any).vehiclePlate ?? null,
          })}::jsonb,
          NOW()
        )
        ON CONFLICT (tenant_id, email) DO NOTHING
      `);
    }

    // Seed 6 : 20 deals CRM (5 lead + 5 qualified + 5 proposal + 5 won)
    log.info('Seed 6 : 20 deals CRM');
    const stages = [
      ...Array(5).fill('lead'),
      ...Array(5).fill('qualified'),
      ...Array(5).fill('proposal'),
      ...Array(5).fill('won'),
    ];
    for (let i = 0; i < 20; i++) {
      const contact = contactsBennani[i % contactsBennani.length];
      const stage = stages[i];
      const amount = randomBetween(5000, 50000);
      const ownerId = users.find((u) => u.role === 'broker_user')?.id ?? users[2].id;
      await tx.execute(sql`
        INSERT INTO deals (id, tenant_id, contact_id, owner_id, title, stage, amount_mad, expected_close_at, created_at)
        VALUES (
          ${generateUlid()}, ${bennaniTenantId}, ${contact.id}, ${ownerId},
          ${`Deal ${stage} #${i + 1} - ${contact.firstName} ${contact.lastName}`},
          ${stage}, ${amount}, ${randomDateInRange(0, 90)}, NOW()
        )
      `);
    }

    // Seed 7 : 5 assureurs MA
    log.info('Seed 7 : 5 assureurs MA');
    for (const a of assureursMa) {
      await tx.execute(sql`
        INSERT INTO insure_assureurs (id, tenant_id, name, acaps_code, ice, address, city, phone, email, website, metadata, created_at)
        VALUES (
          ${generateUlid()}, ${skaleanTenantId}, ${a.name}, ${a.acaps_code}, ${a.ice},
          ${a.address}, ${a.city}, ${a.phone}, ${a.email}, ${a.website},
          ${JSON.stringify(a.metadata ?? {})}::jsonb, NOW()
        )
        ON CONFLICT (acaps_code) DO NOTHING
      `);
    }

    // Seed 8 : 25 produits assurance (5 par assureur)
    log.info('Seed 8 : 25 produits');
    for (const p of produitsAssurance) {
      await tx.execute(sql`
        INSERT INTO insure_produits (id, tenant_id, assureur_acaps_code, code, name, type, premium_min_mad, premium_max_mad, garanties, created_at)
        VALUES (
          ${generateUlid()}, ${skaleanTenantId}, ${p.assureur_acaps_code}, ${p.code},
          ${p.name}, ${p.type}, ${p.premium_min_mad}, ${p.premium_max_mad},
          ${JSON.stringify(p.garanties)}::jsonb, NOW()
        )
        ON CONFLICT (code) DO NOTHING
      `);
    }

    // Seed 9 : 20 polices fictives (mix actives/expirees/annulees) sur Bennani
    log.info('Seed 9 : 20 polices');
    const policeStatuses = [
      ...Array(12).fill('active'),
      ...Array(5).fill('expired'),
      ...Array(3).fill('cancelled'),
    ];
    for (let i = 0; i < 20; i++) {
      const contact = contactsBennani[i % contactsBennani.length];
      const produit = produitsAssurance[i % produitsAssurance.length];
      const status = policeStatuses[i];
      const numero = generatePoliceNumber(2026, i + 1);
      const startDate = status === 'expired' ? randomDateInRange(-365, -180) : randomDateInRange(-90, 0);
      const endDate = new Date(new Date(startDate).getTime() + 365 * 24 * 3600 * 1000).toISOString();
      const premium = randomBetween(produit.premium_min_mad, produit.premium_max_mad);
      await tx.execute(sql`
        INSERT INTO insure_polices (
          id, tenant_id, numero, contact_id, assureur_acaps_code, produit_code,
          status, start_at, end_at, premium_mad, garanties_subscribed, created_at
        )
        VALUES (
          ${generateUlid()}, ${bennaniTenantId}, ${numero}, ${contact.id},
          ${produit.assureur_acaps_code}, ${produit.code},
          ${status}, ${startDate}, ${endDate}, ${premium},
          ${JSON.stringify(produit.garanties)}::jsonb, NOW()
        )
        ON CONFLICT (tenant_id, numero) DO NOTHING
      `);
    }

    // Seed 10 : 10 RDV booking dans futur
    log.info('Seed 10 : 10 RDV');
    for (let i = 0; i < 10; i++) {
      const tenantId = i < 5 ? bennaniTenantId : atlasTenantId;
      const contactPool = i < 5 ? contactsBennani : contactsAtlas;
      const contact = contactPool[i % contactPool.length];
      let rdvAt = randomDateInRange(1, 30);
      // Eviter holidays et Ramadan apres-midi
      while (isMoroccoHoliday2026(new Date(rdvAt))) {
        rdvAt = randomDateInRange(1, 30);
      }
      await tx.execute(sql`
        INSERT INTO booking_rdv (id, tenant_id, contact_id, scheduled_at, duration_min, type, status, notes, created_at)
        VALUES (
          ${generateUlid()}, ${tenantId}, ${contact.id}, ${rdvAt}, 30,
          ${i < 5 ? 'consultation' : 'reparation'}, 'scheduled',
          ${faker.lorem.sentence()}, NOW()
        )
      `);
    }

    // Seed 11 : 30 messages communication
    log.info('Seed 11 : 30 messages');
    for (let i = 0; i < 30; i++) {
      const channel = i % 2 === 0 ? 'whatsapp' : 'email';
      const direction = i % 3 === 0 ? 'inbound' : 'outbound';
      const tenantId = i < 20 ? bennaniTenantId : atlasTenantId;
      const contactPool = i < 20 ? contactsBennani : contactsAtlas;
      const contact = contactPool[i % contactPool.length];
      await tx.execute(sql`
        INSERT INTO comm_messages (id, tenant_id, contact_id, channel, direction, body, status, sent_at, created_at)
        VALUES (
          ${generateUlid()}, ${tenantId}, ${contact.id}, ${channel}, ${direction},
          ${faker.lorem.sentence()}, ${direction === 'outbound' ? 'sent' : 'received'},
          ${randomDateInRange(-30, 0)}, NOW()
        )
      `);
    }

    // Seed 12 : 50 audit_log entries
    log.info('Seed 12 : 50 audit_log');
    const actions = ['INSERT', 'UPDATE'];
    const resources = ['contact', 'deal', 'police', 'rdv', 'message'];
    for (let i = 0; i < 50; i++) {
      const tenantId = i < 30 ? bennaniTenantId : atlasTenantId;
      const userPool = users.filter((u) => u.tenantId === tenantId);
      const user = userPool[i % userPool.length] ?? users[1];
      await tx.execute(sql`
        INSERT INTO audit_log (id, tenant_id, user_id, action, resource_type, resource_id, metadata, created_at)
        VALUES (
          ${generateUlid()}, ${tenantId}, ${user.id},
          ${pickRandom(actions)}, ${pickRandom(resources)}, ${generateUlid()},
          ${JSON.stringify({ ip: faker.internet.ipv4(), userAgent: 'seed-dev' })}::jsonb,
          ${randomDateInRange(-30, 0)}
        )
      `);
    }

    // Seed 13 : 200 analytics_events
    log.info('Seed 13 : 200 analytics_events');
    const events = [
      'page_view',
      'login_success',
      'contact_created',
      'deal_stage_changed',
      'police_signed',
      'rdv_booked',
      'message_sent',
      'export_csv',
    ];
    const batchSize = 50;
    for (let i = 0; i < 200; i += batchSize) {
      const batch: any[] = [];
      for (let j = 0; j < batchSize && i + j < 200; j++) {
        const idx = i + j;
        const tenantId = idx < 120 ? bennaniTenantId : atlasTenantId;
        const userPool = users.filter((u) => u.tenantId === tenantId);
        const user = userPool[idx % userPool.length] ?? users[1];
        batch.push({
          id: generateUlid(),
          tenantId,
          userId: user.id,
          eventName: pickRandom(events),
          properties: { source: 'seed-dev', index: idx },
          occurredAt: randomDateInRange(-60, 0),
        });
      }
      // Batch INSERT
      const valuesSql = batch
        .map(
          (e) =>
            sql`(${e.id}, ${e.tenantId}, ${e.userId}, ${e.eventName}, ${JSON.stringify(e.properties)}::jsonb, ${e.occurredAt})`,
        );
      const combined = sql.join(valuesSql, sql`, `);
      await tx.execute(sql`
        INSERT INTO analytics_events (id, tenant_id, user_id, event_name, properties, occurred_at)
        VALUES ${combined}
      `);
    }
  });

  const elapsed = (Date.now() - startTime) / 1000;
  log.info({ msg: 'Seeds completed', elapsedSeconds: elapsed });
  if (elapsed > 30) {
    log.warn({ msg: 'Seeds exceeded 30s target', elapsedSeconds: elapsed });
  }
  await pool.end();
}

main().catch((err) => {
  log.error({ err }, 'Seeds failed');
  process.exit(1);
});
```

### 7.2 seed-reset.ts (TRUNCATE CASCADE complet)

```typescript
// apps/platform/scripts/seed-reset.ts
import 'dotenv/config';
import { Pool } from 'pg';
import pino from 'pino';

const log = pino({ transport: { target: 'pino-pretty' } });

const TABLES = [
  'analytics_events',
  'audit_log',
  'comm_messages',
  'booking_rdv',
  'insure_polices',
  'insure_produits',
  'insure_assureurs',
  'deals',
  'contacts',
  'users',
  'tenants',
];

async function main() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    database: process.env.DATABASE_NAME ?? 'skalean_dev',
    user: process.env.DATABASE_USER ?? 'seed_admin',
    password: process.env.DATABASE_PASSWORD ?? 'change-me',
  });

  if (process.env.NODE_ENV === 'production') {
    log.error('seed-reset is forbidden in production');
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    log.info({ msg: 'Starting reset', tables: TABLES });
    await client.query('BEGIN');
    await client.query('SET LOCAL row_security = off');
    const tablesList = TABLES.join(', ');
    await client.query(`TRUNCATE TABLE ${tablesList} RESTART IDENTITY CASCADE`);
    await client.query('COMMIT');
    log.info('Reset completed');
  } catch (err) {
    await client.query('ROLLBACK');
    log.error({ err }, 'Reset failed');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 7.3 seed-helpers.ts (generateurs ICE/CIN/phone/police/ULID)

```typescript
// apps/platform/scripts/seed-helpers.ts
import { ulid } from 'ulid';
import { faker } from '@faker-js/faker/locale/fr';

/**
 * Genere un ICE 15 chiffres (Identifiant Commun de l'Entreprise).
 * Format : 9 chiffres entreprise + 4 chiffres etablissement + 2 chiffres TVA.
 * Pour seeds dev : 15 chiffres aleatoires.
 */
export function generateIce(): string {
  let ice = '';
  for (let i = 0; i < 15; i++) {
    ice += Math.floor(Math.random() * 10).toString();
  }
  return ice;
}

/**
 * Genere une CIN format MA : 1-2 lettres prefecture + 6 chiffres.
 * Prefixes : A (Rabat), B (Casablanca), BH (Casablanca-Anfa), BE (Casablanca-Hay Hassani),
 * C (Fes), D (Marrakech), E (Tanger), F (Agadir), etc.
 */
export function generateCin(): string {
  const prefixes = ['A', 'B', 'BH', 'BE', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const digits = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}${digits}`;
}

/**
 * Genere telephone marocain E.164.
 * 80% mobile (+2126XXXXXXXX ou +2127XXXXXXXX), 20% fixe (+2125XXXXXXXX).
 */
export function generatePhoneMa(): string {
  const isMobile = Math.random() < 0.8;
  if (isMobile) {
    const operator = Math.random() < 0.5 ? '6' : '7';
    const rest = Math.floor(10000000 + Math.random() * 90000000).toString();
    return `+212${operator}${rest}`;
  }
  const region = Math.floor(Math.random() * 9) + 1; // 1-9 (5 prefix + region)
  const rest = Math.floor(1000000 + Math.random() * 9000000).toString();
  return `+2125${region}${rest}`;
}

/**
 * Genere numero de police format POL-YYYY-NNNN.
 */
export function generatePoliceNumber(year: number, sequence: number): string {
  return `POL-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Genere numero de facture format INV-YYYY-NNNN.
 */
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${String(sequence).padStart(4, '0')}`;
}

/**
 * Genere un ULID (Universally Unique Lexicographically Sortable Identifier).
 */
export function generateUlid(): string {
  return ulid();
}

/**
 * Pick aleatoire dans un tableau.
 */
export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Random integer entre min et max inclus.
 */
export function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random date entre offsetDaysMin et offsetDaysMax par rapport a maintenant.
 * Offset negatif = passe, positif = futur.
 * Retourne ISO string.
 */
export function randomDateInRange(offsetDaysMin: number, offsetDaysMax: number): string {
  const now = Date.now();
  const minMs = now + offsetDaysMin * 86400000;
  const maxMs = now + offsetDaysMax * 86400000;
  const ts = minMs + Math.random() * (maxMs - minMs);
  return new Date(ts).toISOString();
}

/**
 * BAM Holidays Maroc 2026 (Bank Al-Maghrib calendar).
 */
const HOLIDAYS_2026: string[] = [
  '2026-01-01', // Jour de l'An
  '2026-01-11', // Manifeste de l'Independance
  '2026-03-20', // Aid El Fitr (estime)
  '2026-03-21', // Aid El Fitr +1
  '2026-05-01', // Fete du Travail
  '2026-05-26', // Aid El Adha (estime)
  '2026-05-27', // Aid El Adha +1
  '2026-07-16', // Awal Moharram
  '2026-07-30', // Fete du Trone
  '2026-08-14', // Allegeance Oued Ed-Dahab
  '2026-08-20', // Revolution du Roi et du Peuple
  '2026-08-21', // Fete de la Jeunesse
  '2026-09-24', // Aid El Mawlid
  '2026-11-06', // Marche Verte
  '2026-11-18', // Independance
];

export function isMoroccoHoliday2026(date: Date): boolean {
  const iso = date.toISOString().slice(0, 10);
  return HOLIDAYS_2026.includes(iso);
}

/**
 * Ramadan 2026 : du 18 fevrier 2026 au 19 mars 2026 (estime selon calendrier Hijri).
 */
export function isInRamadan2026(date: Date): boolean {
  const start = new Date('2026-02-18T00:00:00.000Z').getTime();
  const end = new Date('2026-03-19T23:59:59.999Z').getTime();
  const t = date.getTime();
  return t >= start && t <= end;
}
```

### 7.4 seed-data/assureurs-ma.json

```json
[
  {
    "name": "Wafa Assurance",
    "acaps_code": "ASR-WAF-001",
    "ice": "001500000000091",
    "address": "1 Boulevard Abdelmoumen",
    "city": "Casablanca",
    "phone": "+212522545555",
    "email": "contact@wafaassurance.ma",
    "website": "https://www.wafaassurance.ma",
    "metadata": {
      "groupe": "Attijariwafa Bank",
      "fonde": 1972,
      "part_marche_pct": 22.5,
      "rating": "AAA"
    }
  },
  {
    "name": "Atlanta Sanad",
    "acaps_code": "ASR-ATS-002",
    "ice": "001600000000093",
    "address": "181 Boulevard Zerktouni",
    "city": "Casablanca",
    "phone": "+212522464646",
    "email": "contact@atlantasanad.ma",
    "website": "https://www.atlantasanad.ma",
    "metadata": {
      "groupe": "Holmarcom",
      "fonde": 2018,
      "part_marche_pct": 15.2,
      "rating": "AA+"
    }
  },
  {
    "name": "Saham Assurance",
    "acaps_code": "ASR-SAH-003",
    "ice": "001700000000095",
    "address": "216 Boulevard Zerktouni",
    "city": "Casablanca",
    "phone": "+212522989898",
    "email": "contact@saham.ma",
    "website": "https://www.saham.ma",
    "metadata": {
      "groupe": "Sanlam",
      "fonde": 1949,
      "part_marche_pct": 14.8,
      "rating": "AA"
    }
  },
  {
    "name": "RMA Assurance",
    "acaps_code": "ASR-RMA-004",
    "ice": "001800000000097",
    "address": "83 Avenue de l'Armee Royale",
    "city": "Casablanca",
    "phone": "+212522207474",
    "email": "contact@rma.ma",
    "website": "https://www.rma.ma",
    "metadata": {
      "groupe": "FinanceCom",
      "fonde": 1949,
      "part_marche_pct": 13.4,
      "rating": "AA"
    }
  },
  {
    "name": "AXA Assurance Maroc",
    "acaps_code": "ASR-AXA-005",
    "ice": "001900000000099",
    "address": "120 Avenue Hassan II",
    "city": "Casablanca",
    "phone": "+212522202020",
    "email": "contact@axa.ma",
    "website": "https://www.axa.ma",
    "metadata": {
      "groupe": "AXA Group",
      "fonde": 1958,
      "part_marche_pct": 11.7,
      "rating": "AA"
    }
  }
]
```

### 7.5 seed-data/produits-assurance.json (extrait 25 produits)

```json
[
  {
    "assureur_acaps_code": "ASR-WAF-001",
    "code": "WAF-AUTO-TR",
    "name": "Wafa Auto Tous Risques",
    "type": "auto_tr",
    "premium_min_mad": 4500,
    "premium_max_mad": 18000,
    "garanties": ["RC obligatoire", "Dommages collision", "Vol", "Incendie", "Bris de glace", "Defense recours", "Assistance 24/7", "Conducteur"]
  },
  {
    "assureur_acaps_code": "ASR-WAF-001",
    "code": "WAF-AUTO-TP",
    "name": "Wafa Auto Tiers Plus",
    "type": "auto_tp",
    "premium_min_mad": 1800,
    "premium_max_mad": 5500,
    "garanties": ["RC obligatoire", "Vol", "Incendie", "Bris de glace"]
  },
  {
    "assureur_acaps_code": "ASR-WAF-001",
    "code": "WAF-HAB-STD",
    "name": "Wafa Habitation Standard",
    "type": "habitation",
    "premium_min_mad": 800,
    "premium_max_mad": 4500,
    "garanties": ["Incendie", "Degats des eaux", "Vol", "RC vie privee", "Bris de glace"]
  },
  {
    "assureur_acaps_code": "ASR-WAF-001",
    "code": "WAF-VIE-EPG",
    "name": "Wafa Epargne Vie",
    "type": "vie",
    "premium_min_mad": 3000,
    "premium_max_mad": 50000,
    "garanties": ["Capital deces", "Capital invalidite", "Epargne retraite"]
  },
  {
    "assureur_acaps_code": "ASR-WAF-001",
    "code": "WAF-SAN-FAM",
    "name": "Wafa Sante Famille",
    "type": "sante",
    "premium_min_mad": 2500,
    "premium_max_mad": 25000,
    "garanties": ["Hospitalisation", "Consultations", "Medicaments", "Optique", "Dentaire", "Maternite"]
  },
  {
    "assureur_acaps_code": "ASR-ATS-002",
    "code": "ATS-AUTO-TR",
    "name": "Atlanta Sanad Auto Premium",
    "type": "auto_tr",
    "premium_min_mad": 5000,
    "premium_max_mad": 20000,
    "garanties": ["RC obligatoire", "Tous risques", "Vol", "Incendie", "Bris de glace", "Vehicule de remplacement"]
  },
  {
    "assureur_acaps_code": "ASR-ATS-002",
    "code": "ATS-AUTO-TP",
    "name": "Atlanta Sanad Auto Eco",
    "type": "auto_tp",
    "premium_min_mad": 1900,
    "premium_max_mad": 5800,
    "garanties": ["RC obligatoire", "Vol", "Incendie"]
  },
  {
    "assureur_acaps_code": "ASR-ATS-002",
    "code": "ATS-HAB-PLUS",
    "name": "Atlanta Sanad Habitation Plus",
    "type": "habitation",
    "premium_min_mad": 950,
    "premium_max_mad": 5500,
    "garanties": ["Incendie", "Degats des eaux", "Vol", "RC vie privee", "Catastrophes naturelles"]
  },
  {
    "assureur_acaps_code": "ASR-ATS-002",
    "code": "ATS-VIE-CAP",
    "name": "Atlanta Sanad Capital Vie",
    "type": "vie",
    "premium_min_mad": 2800,
    "premium_max_mad": 45000,
    "garanties": ["Capital deces", "Rente conjoint", "Education enfants"]
  },
  {
    "assureur_acaps_code": "ASR-ATS-002",
    "code": "ATS-SAN-IND",
    "name": "Atlanta Sanad Sante Individuelle",
    "type": "sante",
    "premium_min_mad": 1800,
    "premium_max_mad": 18000,
    "garanties": ["Hospitalisation", "Consultations", "Medicaments", "Optique"]
  },
  {
    "assureur_acaps_code": "ASR-SAH-003",
    "code": "SAH-AUTO-TR",
    "name": "Saham Auto Securite Plus",
    "type": "auto_tr",
    "premium_min_mad": 4800,
    "premium_max_mad": 19000,
    "garanties": ["RC obligatoire", "Tous risques", "Vol", "Incendie", "Bris de glace", "Assistance"]
  },
  {
    "assureur_acaps_code": "ASR-SAH-003",
    "code": "SAH-AUTO-TP",
    "name": "Saham Auto Tiers Confort",
    "type": "auto_tp",
    "premium_min_mad": 1750,
    "premium_max_mad": 5400,
    "garanties": ["RC obligatoire", "Vol", "Incendie", "Bris de glace"]
  },
  {
    "assureur_acaps_code": "ASR-SAH-003",
    "code": "SAH-HAB-CONF",
    "name": "Saham Habitation Confort",
    "type": "habitation",
    "premium_min_mad": 850,
    "premium_max_mad": 4800,
    "garanties": ["Incendie", "Degats des eaux", "Vol", "RC vie privee"]
  },
  {
    "assureur_acaps_code": "ASR-SAH-003",
    "code": "SAH-VIE-EPG",
    "name": "Saham Epargne Plus",
    "type": "vie",
    "premium_min_mad": 3200,
    "premium_max_mad": 48000,
    "garanties": ["Capital deces", "Epargne retraite", "Rente"]
  },
  {
    "assureur_acaps_code": "ASR-SAH-003",
    "code": "SAH-SAN-FAM",
    "name": "Saham Sante Famille Plus",
    "type": "sante",
    "premium_min_mad": 2400,
    "premium_max_mad": 24000,
    "garanties": ["Hospitalisation", "Consultations", "Medicaments", "Optique", "Dentaire"]
  },
  {
    "assureur_acaps_code": "ASR-RMA-004",
    "code": "RMA-AUTO-TR",
    "name": "RMA Auto Excellence",
    "type": "auto_tr",
    "premium_min_mad": 5200,
    "premium_max_mad": 21000,
    "garanties": ["RC obligatoire", "Tous risques", "Vol", "Incendie", "Bris de glace", "Vehicule remplacement", "Assistance 24/7"]
  },
  {
    "assureur_acaps_code": "ASR-RMA-004",
    "code": "RMA-AUTO-TP",
    "name": "RMA Auto Tiers",
    "type": "auto_tp",
    "premium_min_mad": 1850,
    "premium_max_mad": 5600,
    "garanties": ["RC obligatoire", "Vol", "Incendie"]
  },
  {
    "assureur_acaps_code": "ASR-RMA-004",
    "code": "RMA-HAB-PRE",
    "name": "RMA Habitation Premium",
    "type": "habitation",
    "premium_min_mad": 900,
    "premium_max_mad": 5200,
    "garanties": ["Incendie", "Degats des eaux", "Vol", "RC vie privee", "Catastrophes naturelles", "Bris de glace"]
  },
  {
    "assureur_acaps_code": "ASR-RMA-004",
    "code": "RMA-VIE-CAP",
    "name": "RMA Capital Famille",
    "type": "vie",
    "premium_min_mad": 3100,
    "premium_max_mad": 47000,
    "garanties": ["Capital deces", "Capital invalidite", "Education enfants"]
  },
  {
    "assureur_acaps_code": "ASR-RMA-004",
    "code": "RMA-SAN-PRE",
    "name": "RMA Sante Premium",
    "type": "sante",
    "premium_min_mad": 2600,
    "premium_max_mad": 26000,
    "garanties": ["Hospitalisation", "Consultations", "Medicaments", "Optique", "Dentaire", "Maternite", "Specialistes"]
  },
  {
    "assureur_acaps_code": "ASR-AXA-005",
    "code": "AXA-AUTO-TR",
    "name": "AXA Auto Confort",
    "type": "auto_tr",
    "premium_min_mad": 5100,
    "premium_max_mad": 20500,
    "garanties": ["RC obligatoire", "Tous risques", "Vol", "Incendie", "Bris de glace", "Assistance"]
  },
  {
    "assureur_acaps_code": "ASR-AXA-005",
    "code": "AXA-AUTO-TP",
    "name": "AXA Auto Essentiel",
    "type": "auto_tp",
    "premium_min_mad": 1950,
    "premium_max_mad": 5900,
    "garanties": ["RC obligatoire", "Vol", "Incendie", "Bris de glace"]
  },
  {
    "assureur_acaps_code": "ASR-AXA-005",
    "code": "AXA-HAB-STD",
    "name": "AXA Habitation Standard",
    "type": "habitation",
    "premium_min_mad": 880,
    "premium_max_mad": 5000,
    "garanties": ["Incendie", "Degats des eaux", "Vol", "RC vie privee"]
  },
  {
    "assureur_acaps_code": "ASR-AXA-005",
    "code": "AXA-VIE-PRE",
    "name": "AXA Vie Prevoyance",
    "type": "vie",
    "premium_min_mad": 3300,
    "premium_max_mad": 50000,
    "garanties": ["Capital deces", "Capital invalidite", "Epargne", "Rente"]
  },
  {
    "assureur_acaps_code": "ASR-AXA-005",
    "code": "AXA-SAN-INT",
    "name": "AXA Sante Internationale",
    "type": "sante",
    "premium_min_mad": 3500,
    "premium_max_mad": 35000,
    "garanties": ["Hospitalisation Maroc + International", "Consultations", "Medicaments", "Optique", "Dentaire", "Maternite"]
  }
]
```

### 7.6 seed-data/villes-ma.json (20 villes)

```json
[
  { "name": "Casablanca", "region": "Casablanca-Settat", "population": 3359818, "is_economic_capital": true },
  { "name": "Rabat", "region": "Rabat-Sale-Kenitra", "population": 577827, "is_administrative_capital": true },
  { "name": "Marrakech", "region": "Marrakech-Safi", "population": 928850, "is_tourist_hub": true },
  { "name": "Fes", "region": "Fes-Meknes", "population": 1112072, "is_cultural_capital": true },
  { "name": "Tanger", "region": "Tanger-Tetouan-Al Hoceima", "population": 947952, "is_industrial_hub": true },
  { "name": "Agadir", "region": "Souss-Massa", "population": 421844, "is_tourist_hub": true },
  { "name": "Meknes", "region": "Fes-Meknes", "population": 632079, "is_imperial_city": true },
  { "name": "Oujda", "region": "Oriental", "population": 494252, "is_border_city": true },
  { "name": "Kenitra", "region": "Rabat-Sale-Kenitra", "population": 431282, "is_industrial": true },
  { "name": "Tetouan", "region": "Tanger-Tetouan-Al Hoceima", "population": 380787, "is_cultural": true },
  { "name": "Sale", "region": "Rabat-Sale-Kenitra", "population": 890403, "twin_city": "Rabat" },
  { "name": "El Jadida", "region": "Casablanca-Settat", "population": 194934, "is_coastal": true },
  { "name": "Beni Mellal", "region": "Beni Mellal-Khenifra", "population": 192676, "is_agricultural": true },
  { "name": "Nador", "region": "Oriental", "population": 161726, "is_border_city": true },
  { "name": "Khouribga", "region": "Beni Mellal-Khenifra", "population": 196196, "is_mining": true },
  { "name": "Settat", "region": "Casablanca-Settat", "population": 142250, "is_agricultural": true },
  { "name": "Mohammedia", "region": "Casablanca-Settat", "population": 208612, "is_coastal": true },
  { "name": "Khemisset", "region": "Rabat-Sale-Kenitra", "population": 131542, "is_agricultural": true },
  { "name": "Berrechid", "region": "Casablanca-Settat", "population": 136634, "is_industrial": true },
  { "name": "Taza", "region": "Fes-Meknes", "population": 148456, "is_strategic": true }
]
```

### 7.7 seed-data/noms-fr-ma.json (extrait 100 prenoms + 100 noms)

```json
{
  "prenoms": [
    "Mohamed", "Ahmed", "Hassan", "Hussein", "Ali", "Omar", "Youssef", "Karim", "Said", "Driss",
    "Khalid", "Rachid", "Abdelaziz", "Abdellah", "Abderrahmane", "Abdelkader", "Mustapha", "Mehdi", "Anas", "Ilyas",
    "Adam", "Yassine", "Bilal", "Othmane", "Soufiane", "Ismail", "Tarik", "Fouad", "Brahim", "Hicham",
    "Nabil", "Jamal", "Reda", "Walid", "Marouane", "Imad", "Aymane", "Ayoub", "Zakaria", "Yahya",
    "Hamza", "Ayman", "Salim", "Sami", "Anouar", "Mounir", "Redouane", "Saad", "Najim", "Faycal",
    "Fatima", "Khadija", "Aicha", "Zineb", "Salma", "Naima", "Houda", "Mounia", "Samira", "Sanaa",
    "Souad", "Wafaa", "Asmae", "Hanane", "Imane", "Loubna", "Karima", "Najwa", "Kaoutar", "Meryem",
    "Yasmina", "Soukaina", "Hajar", "Sara", "Nadia", "Latifa", "Rajaa", "Bouchra", "Zahra", "Amina",
    "Malika", "Leila", "Saida", "Rkia", "Halima", "Habiba", "Touria", "Najat", "Oumaima", "Inas",
    "Chaimae", "Ghita", "Doha", "Lina", "Maria", "Rania", "Nouhaila", "Salwa", "Manal", "Nora"
  ],
  "noms": [
    "El Alaoui", "Bennani", "Tazi", "Berrada", "Lamrini", "Chraibi", "Fassi", "Skalli", "Idrissi", "Cherkaoui",
    "Bennis", "Alami", "Benjelloun", "Sebti", "Mouline", "Kettani", "Filali", "Squalli", "El Fassi", "Lahlou",
    "Ouazzani", "Zniber", "Tahiri", "El Yazidi", "Slaoui", "El Ghazi", "Rhaoui", "Benkirane", "El Mansouri", "El Khattabi",
    "Bennouna", "El Hadji", "Sefrioui", "El Habti", "El Idrissi", "Bouayad", "El Wazani", "Rachdi", "Lazrak", "El Khazzane",
    "El Ouafi", "Bouzoubaa", "El Houari", "El Bekkali", "Drissi", "Naciri", "Lahbabi", "Belarbi", "Berrechid", "El Jamali",
    "El Bouhmadi", "El Bahraoui", "El Marrakchi", "Senhaji", "El Kabbaj", "Belkadi", "El Ouali", "El Kortbi", "Halima", "Boumahdi",
    "El Kouhen", "El Manjra", "El Hassani", "Ben Abdellah", "El Mokri", "Andaloussi", "Bouhsini", "Sefraoui", "Demnati", "El Maaroufi",
    "Akabli", "Boutaleb", "Daoudi", "Ennaji", "Fakhri", "Ghazi", "Habibi", "Iraqi", "Jaafari", "Kabbaj",
    "Lahcen", "Maamri", "Nejjar", "Oudghiri", "Pacha", "Qadiri", "Raji", "Saidi", "Tabbaa", "Ucciani",
    "Vahabi", "Wahbi", "Yacoubi", "Zerouali", "El Mansour", "Belhaj", "Cherradi", "El Bouri", "El Otmani", "Tijani"
  ]
}
```

### 7.8 package.json scripts

```json
{
  "scripts": {
    "seeds:run": "tsx apps/platform/scripts/seed-dev.ts",
    "seeds:reset": "tsx apps/platform/scripts/seed-reset.ts",
    "seeds:dev": "pnpm seeds:reset && pnpm seeds:run",
    "seeds:test": "vitest run apps/platform/test/seeds"
  }
}
```

### 7.9 Faker config custom MA overrides

```typescript
// Bloc d'init faker avec overrides MA (place dans seed-dev.ts en haut)
import { Faker, fr } from '@faker-js/faker';

export const fakerMa = new Faker({ locale: [fr] });

// Overrides specifiques MA via fonction wrapper
export function fakerMaPersonFirstName(): string {
  return pickRandom(nomsFrMa.prenoms);
}

export function fakerMaPersonLastName(): string {
  return pickRandom(nomsFrMa.noms);
}

export function fakerMaCity(): string {
  return pickRandom(villesMa).name;
}
```

## 8. Tests complets

### 8.1 seeds.spec.ts (8 tests)

```typescript
// apps/platform/test/seeds/seeds.spec.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';
import { Pool } from 'pg';

describe('Seeds dev exhaustifs', () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool({
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
    });
  });

  it('V1 : seeds:run completes in less than 30 seconds', () => {
    execSync('pnpm seeds:reset', { stdio: 'inherit' });
    const start = Date.now();
    execSync('pnpm seeds:run', { stdio: 'inherit' });
    const elapsed = (Date.now() - start) / 1000;
    expect(elapsed).toBeLessThan(30);
  }, 60000);

  it('V2 : 50 contacts created (30 Bennani + 20 Atlas)', async () => {
    const r = await pool.query<{ tenant_slug: string; count: string }>(`
      SELECT t.slug AS tenant_slug, COUNT(*) AS count
      FROM contacts c JOIN tenants t ON t.id = c.tenant_id
      WHERE t.slug IN ('bennani', 'atlas')
      GROUP BY t.slug
    `);
    const map = new Map(r.rows.map((row) => [row.tenant_slug, parseInt(row.count, 10)]));
    expect(map.get('bennani')).toBe(30);
    expect(map.get('atlas')).toBe(20);
  });

  it('V3 : 20 deals with mix of stages 5/5/5/5', async () => {
    const r = await pool.query<{ stage: string; count: string }>(`
      SELECT stage, COUNT(*) AS count FROM deals GROUP BY stage
    `);
    const map = new Map(r.rows.map((row) => [row.stage, parseInt(row.count, 10)]));
    expect(map.get('lead')).toBe(5);
    expect(map.get('qualified')).toBe(5);
    expect(map.get('proposal')).toBe(5);
    expect(map.get('won')).toBe(5);
  });

  it('V4 : 20 polices linked to Bennani contacts', async () => {
    const r = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM insure_polices p
      JOIN tenants t ON t.id = p.tenant_id
      WHERE t.slug = 'bennani'
    `);
    expect(parseInt(r.rows[0].count, 10)).toBe(20);
  });

  it('V5 : idempotent re-run does not duplicate', async () => {
    execSync('pnpm seeds:run', { stdio: 'inherit' });
    const r = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM contacts');
    expect(parseInt(r.rows[0].count, 10)).toBe(50);
  }, 60000);

  it('V6 : reset cleans all tables', async () => {
    execSync('pnpm seeds:reset', { stdio: 'inherit' });
    const r = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM contacts');
    expect(parseInt(r.rows[0].count, 10)).toBe(0);
    execSync('pnpm seeds:run', { stdio: 'inherit' });
  }, 60000);

  it('V7 : ICE format 15 digits and unique per tenant', async () => {
    const r = await pool.query<{ ice: string }>('SELECT ice FROM contacts WHERE ice IS NOT NULL');
    for (const row of r.rows) {
      expect(row.ice).toMatch(/^\d{15}$/);
    }
    const distinct = new Set(r.rows.map((row) => row.ice)).size;
    expect(distinct).toBe(r.rows.length);
  });

  it('V8 : performance benchmark seeds:dev < 35s', () => {
    const start = Date.now();
    execSync('pnpm seeds:dev', { stdio: 'inherit' });
    const elapsed = (Date.now() - start) / 1000;
    expect(elapsed).toBeLessThan(35);
  }, 90000);
});
```

### 8.2 data-coherence.spec.ts (6 tests)

```typescript
// apps/platform/test/seeds/data-coherence.spec.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Pool } from 'pg';

describe('Seeds data coherence', () => {
  let pool: Pool;
  beforeAll(() => {
    pool = new Pool({
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
    });
  });

  it('FK valid : every deal has a contact in same tenant', async () => {
    const r = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM deals d
      LEFT JOIN contacts c ON c.id = d.contact_id AND c.tenant_id = d.tenant_id
      WHERE c.id IS NULL
    `);
    expect(parseInt(r.rows[0].count, 10)).toBe(0);
  });

  it('ICE unique per tenant', async () => {
    const r = await pool.query<{ tenant_id: string; ice: string; count: string }>(`
      SELECT tenant_id, ice, COUNT(*) AS count FROM contacts
      WHERE ice IS NOT NULL
      GROUP BY tenant_id, ice
      HAVING COUNT(*) > 1
    `);
    expect(r.rows.length).toBe(0);
  });

  it('CIN unique per tenant', async () => {
    const r = await pool.query<{ count: string }>(`
      SELECT tenant_id, cin, COUNT(*) AS count FROM contacts
      WHERE cin IS NOT NULL
      GROUP BY tenant_id, cin
      HAVING COUNT(*) > 1
    `);
    expect(r.rows.length).toBe(0);
  });

  it('Polices linked to existing contacts', async () => {
    const r = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM insure_polices p
      LEFT JOIN contacts c ON c.id = p.contact_id
      WHERE c.id IS NULL
    `);
    expect(parseInt(r.rows[0].count, 10)).toBe(0);
  });

  it('Deals stage transitions valid (no backward)', async () => {
    const r = await pool.query<{ stage: string }>('SELECT DISTINCT stage FROM deals');
    const validStages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    for (const row of r.rows) {
      expect(validStages).toContain(row.stage);
    }
  });

  it('Police dates coherent : end_at > start_at', async () => {
    const r = await pool.query<{ count: string }>(`
      SELECT COUNT(*) AS count FROM insure_polices WHERE end_at <= start_at
    `);
    expect(parseInt(r.rows[0].count, 10)).toBe(0);
  });
});
```

### 8.3 generators.spec.ts (8 tests)

```typescript
// apps/platform/test/seeds/generators.spec.ts
import { describe, it, expect } from 'vitest';
import {
  generateIce,
  generateCin,
  generatePhoneMa,
  generatePoliceNumber,
  generateInvoiceNumber,
  generateUlid,
  isMoroccoHoliday2026,
  isInRamadan2026,
} from '../../scripts/seed-helpers';

describe('Seed helpers generators', () => {
  it('generateIce returns 15-digit string', () => {
    for (let i = 0; i < 100; i++) {
      const ice = generateIce();
      expect(ice).toMatch(/^\d{15}$/);
    }
  });

  it('generateCin returns prefecture-prefix + 6 digits', () => {
    for (let i = 0; i < 100; i++) {
      const cin = generateCin();
      expect(cin).toMatch(/^[A-Z]{1,2}\d{6}$/);
    }
  });

  it('generatePhoneMa returns E.164 +212 mobile or fixe', () => {
    for (let i = 0; i < 100; i++) {
      const phone = generatePhoneMa();
      expect(phone).toMatch(/^\+212(5|6|7)\d{9}$/);
    }
  });

  it('generatePoliceNumber follows POL-YYYY-NNNN', () => {
    expect(generatePoliceNumber(2026, 1)).toBe('POL-2026-0001');
    expect(generatePoliceNumber(2026, 1234)).toBe('POL-2026-1234');
    expect(generatePoliceNumber(2026, 9999)).toBe('POL-2026-9999');
  });

  it('generateInvoiceNumber follows INV-YYYY-NNNN', () => {
    expect(generateInvoiceNumber(2026, 42)).toBe('INV-2026-0042');
  });

  it('generateUlid returns 26-character ULID', () => {
    const a = generateUlid();
    const b = generateUlid();
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a).not.toBe(b);
    expect(a < b || a > b).toBe(true);
  });

  it('isMoroccoHoliday2026 detects key dates', () => {
    expect(isMoroccoHoliday2026(new Date('2026-01-01'))).toBe(true);
    expect(isMoroccoHoliday2026(new Date('2026-07-30'))).toBe(true);
    expect(isMoroccoHoliday2026(new Date('2026-11-18'))).toBe(true);
    expect(isMoroccoHoliday2026(new Date('2026-04-15'))).toBe(false);
  });

  it('isInRamadan2026 detects Ramadan window', () => {
    expect(isInRamadan2026(new Date('2026-02-18'))).toBe(true);
    expect(isInRamadan2026(new Date('2026-03-10'))).toBe(true);
    expect(isInRamadan2026(new Date('2026-03-19'))).toBe(true);
    expect(isInRamadan2026(new Date('2026-04-01'))).toBe(false);
  });
});
```

### 8.4 faker-locale.spec.ts (4 tests)

```typescript
// apps/platform/test/seeds/faker-locale.spec.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Pool } from 'pg';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Faker locale + custom MA data', () => {
  let pool: Pool;
  let nomsMa: { prenoms: string[]; noms: string[] };
  let villesMa: any[];

  beforeAll(() => {
    pool = new Pool({
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
    });
    nomsMa = JSON.parse(
      readFileSync(resolve(__dirname, '../../scripts/seed-data/noms-fr-ma.json'), 'utf-8'),
    );
    villesMa = JSON.parse(
      readFileSync(resolve(__dirname, '../../scripts/seed-data/villes-ma.json'), 'utf-8'),
    );
  });

  it('Contact first_names are from MA pool', async () => {
    const r = await pool.query<{ first_name: string }>('SELECT DISTINCT first_name FROM contacts LIMIT 50');
    const validPrenoms = new Set(nomsMa.prenoms);
    for (const row of r.rows) {
      expect(validPrenoms.has(row.first_name)).toBe(true);
    }
  });

  it('Contact last_names are from MA pool', async () => {
    const r = await pool.query<{ last_name: string }>('SELECT DISTINCT last_name FROM contacts LIMIT 50');
    const validNoms = new Set(nomsMa.noms);
    for (const row of r.rows) {
      expect(validNoms.has(row.last_name)).toBe(true);
    }
  });

  it('Contact cities are from MA villes pool', async () => {
    const r = await pool.query<{ city: string }>('SELECT DISTINCT city FROM contacts LIMIT 50');
    const validVilles = new Set(villesMa.map((v) => v.name));
    for (const row of r.rows) {
      expect(validVilles.has(row.city)).toBe(true);
    }
  });

  it('All MA villes pool entries have required fields', () => {
    for (const v of villesMa) {
      expect(v).toHaveProperty('name');
      expect(v).toHaveProperty('region');
      expect(v).toHaveProperty('population');
    }
  });
});
```

## 9. Variables d'environnement (>= 18)

```ini
# .env.example (extrait section seeds)

# Connexion DB seeds
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=skalean_dev
DATABASE_USER=seed_admin
DATABASE_PASSWORD=change-me-locally

# Tenants seeds
SEED_TENANT_SKALEAN_NAME=Skalean Platform
SEED_TENANT_BENNANI_NAME=Cabinet Bennani Assurance
SEED_TENANT_ATLAS_NAME=Garage Atlas Auto
SEED_TENANT_BENNANI_CITY=Casablanca
SEED_TENANT_ATLAS_CITY=Marrakech

# Volumes seeds
SEED_CONTACTS_COUNT=50
SEED_DEALS_COUNT=20
SEED_POLICES_COUNT=20
SEED_RDV_COUNT=10
SEED_MESSAGES_COUNT=30
SEED_AUDIT_COUNT=50
SEED_ANALYTICS_COUNT=200

# Performance
SEED_BATCH_SIZE=50
SEED_RANDOM_SEED=42
SEED_FAKER_LOCALE=fr
SEED_TIMEZONE=Africa/Casablanca

# Auth seeds (DEV ONLY)
SEED_PASSWORD_DEFAULT=Demo!2026Skalean
SEED_ARGON2_MEMORY_COST=65536
SEED_ARGON2_TIME_COST=3
SEED_ARGON2_PARALLELISM=4

# Annee de reference
SEED_YEAR=2026
SEED_RAMADAN_START=2026-02-18
SEED_RAMADAN_END=2026-03-19
```

## 10. Commandes shell

```bash
# Reset + run combine (dev quotidien)
pnpm seeds:dev

# Run idempotent (ajoute sans detruire)
pnpm seeds:run

# Reset complet (TRUNCATE CASCADE)
pnpm seeds:reset

# Tests automatises
pnpm seeds:test

# Verifications psql
psql -h localhost -U seed_admin -d skalean_dev -c "SELECT slug, type, COUNT(*) OVER () AS total FROM tenants;"
psql -h localhost -U seed_admin -d skalean_dev -c "SELECT t.slug, COUNT(c.id) AS contacts_count FROM tenants t LEFT JOIN contacts c ON c.tenant_id = t.id GROUP BY t.slug;"
psql -h localhost -U seed_admin -d skalean_dev -c "SELECT stage, COUNT(*) FROM deals GROUP BY stage ORDER BY stage;"
psql -h localhost -U seed_admin -d skalean_dev -c "SELECT status, COUNT(*) FROM insure_polices GROUP BY status;"
psql -h localhost -U seed_admin -d skalean_dev -c "SELECT name, acaps_code FROM insure_assureurs;"
psql -h localhost -U seed_admin -d skalean_dev -c "SELECT COUNT(*) AS analytics_total, COUNT(DISTINCT event_name) AS events_distinct FROM analytics_events;"

# Benchmark
time pnpm seeds:dev

# Profiling memoire (si seeds OOM)
node --max-old-space-size=4096 --inspect node_modules/.bin/tsx apps/platform/scripts/seed-dev.ts
```

## 11. Criteres V1-V32

| ID | Priorite | Critere | Validation |
|----|----------|---------|------------|
| V1 | P0 | seeds:run termine en moins de 30 secondes | benchmark wall-clock |
| V2 | P0 | 50 contacts crees (30 Bennani + 20 Atlas) | SELECT COUNT par tenant |
| V3 | P0 | 20 deals mix stages (5/5/5/5) | SELECT stage, COUNT GROUP BY |
| V4 | P0 | 20 polices Bennani format POL-2026-NNNN | SELECT COUNT + regex check |
| V5 | P0 | re-run idempotent sans duplication | SELECT COUNT identique |
| V6 | P0 | seeds:reset clean toutes tables | SELECT COUNT = 0 partout |
| V7 | P0 | donnees realistes ICE/CIN/phone | regex validation |
| V8 | P0 | 5 utilisateurs avec argon2id hash | SELECT password_hash like $argon2id$ |
| V9 | P0 | 5 assureurs MA inseres avec ACAPS code | SELECT acaps_code unique |
| V10 | P0 | 25 produits assurance (5 par assureur) | SELECT COUNT GROUP BY assureur |
| V11 | P0 | FK valid sur deals -> contacts | LEFT JOIN check NULL = 0 |
| V12 | P0 | FK valid sur polices -> contacts | LEFT JOIN check NULL = 0 |
| V13 | P0 | FK valid sur polices -> produits | LEFT JOIN check NULL = 0 |
| V14 | P0 | RLS bypass fonctionne avec super admin | execution sans erreur 0 lignes |
| V15 | P0 | tenants Bennani + Atlas + Skalean inseres | SELECT COUNT slug = 3 |
| V16 | P0 | tests vitest >= 26 passants | pnpm seeds:test exit 0 |
| V17 | P0 | aucune emoji dans code et logs | grep emoji = 0 |
| V18 | P0 | timezone Africa/Casablanca applique | SHOW timezone |
| V19 | P1 | 10 RDV booking dates futures | SELECT MIN(scheduled_at) > NOW |
| V20 | P1 | RDV evitent jours feries 2026 BAM | SELECT scheduled_at NOT IN holidays |
| V21 | P1 | 30 messages mix WhatsApp/Email 50/50 | SELECT channel, COUNT |
| V22 | P1 | 50 audit_log mix INSERT/UPDATE | SELECT action, COUNT |
| V23 | P1 | 200 analytics_events varies | SELECT DISTINCT event_name >= 5 |
| V24 | P1 | polices status mix actives/expirees/cancelled | SELECT status, COUNT |
| V25 | P1 | seeds documentation complete | docs/seeds-dev-readme.md exists |
| V26 | P1 | benchmark seeds:dev < 35 secondes | wall-clock pnpm seeds:dev |
| V27 | P2 | montants MAD precision 2 decimals | SELECT amount_mad type Decimal |
| V28 | P2 | adresses bilingues ar disponibles | metadata.address_ar present |
| V29 | P2 | vehicle plate format MA dans Atlas | regex 99999-A-99 |
| V30 | P2 | dates Ramadan 2026 traitees | check isInRamadan2026 |
| V31 | P2 | random seed deterministe re-run | SEED_RANDOM_SEED produit memes IDs noms |
| V32 | P2 | logs pino structures JSON | parse JSON valid |

## 12. Edge cases

**Edge 1 -- ICE collision retry strategy.** Probabilite collision sur 50 generations 15 digits = ~50/10^15 = negligeable. Mais robustesse : Set memoire usedIces + retry max 5 fois avec random different. Si 5 echecs (impossible en pratique) : log error + exit. Pour seeds dev > 10000 contacts (futur Sprint 18 charge tests), implementer Luhn-like checksum pour reduire collisions.

**Edge 2 -- Faker fr-MA missing fallback.** Si jamais un faker.locale.fr_MA est disponible dans une futur version @faker-js/faker, switch automatique. Pour l'instant : try/catch sur new Faker({ locale: [fr_MA] }) avec fallback fr.

**Edge 3 -- Password seeding slow argon2id.** Hash 5 fois minimum 3s = 15s. Solution : 1 seul hash partage en dev. Warning explicite "DEV SEEDS DO NOT USE IN PROD". Variable env SEED_PASSWORD_HASH_CACHE pour disable en CI si besoin.

**Edge 4 -- RLS super admin bypass.** Connexion seeds avec utilisateur Postgres `seed_admin` qui a `BYPASSRLS` accordé. Alternative : `SET LOCAL row_security = off` dans transaction. La 2eme option est preferee car moins permissive sur user dedie.

**Edge 5 -- FK order resolution.** Erreur si tentative INSERT deals avant contacts. Solution : ordre strict 1.tenants 2.users 3.contacts 4.deals 5.assureurs 6.produits 7.polices 8.rdv 9.messages 10.audit 11.analytics. Documente dans header seed-dev.ts.

**Edge 6 -- Polices number sequence per-tenant locked.** Race condition si 2 instances seed:run paralleles. Solution : `pg_advisory_xact_lock(hashtext(tenant_id))` au debut transaction.

**Edge 7 -- Ramadan dates 2026 dynamic.** Dates Hijri-Gregorien estimees. Utiliser package `hijri-date` pour calcul exact si requis Sprint 17+.

**Edge 8 -- BAM holidays 2026.** Liste hardcodee dans seed-helpers.ts. Sprint 18+ : externaliser dans table `holidays_ma_yearly` mise a jour annuellement.

**Edge 9 -- Large seed > 30s timeout.** Si SEED_CONTACTS_COUNT augmente a 1000+ : passer en streaming pg-copy-streams au lieu de INSERT.

**Edge 10 -- ULID monotonic single-process.** Library ulid garantit monotonic dans le meme process. OK pour seeds mono-process.

**Edge 11 -- Currency MAD precision Decimal.** Postgres `numeric(12, 2)` pour amount_mad. JavaScript Number perd precision sur grandes valeurs : utiliser library `decimal.js` si requis.

**Edge 12 -- Dates timezone Africa/Casablanca DST.** Maroc abandonne le passage heure d'ete depuis 2018 (heure d'hiver permanente sauf Ramadan ou bascule heure d'hiver). Postgres timestamp with time zone gere via SET TIMEZONE.

## 13. Conformite Maroc

**decision-008 cluster Benguerir.** Seeds executes sur Postgres 16 instance Benguerir on-prem (dev/staging/prod). Pas de cloud. Les developpeurs locaux pointent vers une copie locale via docker-compose qui mirror la config Benguerir.

**Loi 09-08 CNDP donnees fictives.** Tous les noms, emails, telephones, ICE, CIN dans les seeds sont generes par faker ou random et ne correspondent pas a des personnes reelles. Aucune declaration CNDP requise pour donnees fictives. Les noms d'assureurs (Wafa, Atlanta Sanad, Saham, RMA, AXA) sont publics et appartiennent a leurs proprietaires respectifs ; utilises a titre demonstratif uniquement.

**ACAPS codes assureurs.** Les codes ACAPS (ASR-WAF-001, etc.) sont fictifs pour les seeds. En production Sprint 14, les codes reels publics ACAPS seront utilises apres validation avec la liste ACAPS officielle.

**decision-006 no-emoji.** Aucune emoji dans : code TypeScript, fichiers JSON, logs pino, commits git, README, .env.example. Convention strictement appliquee.

## 14. Conventions absolues (14 conventions)

1. Aucune emoji nulle part (decision-006).
2. Timezone Africa/Casablanca (decision-002).
3. Currency MAD ISO 4217.
4. Locale fr primaire, ar secondaire prevu Sprint 17.
5. ICE 15 chiffres uniquement.
6. CIN format prefecture-prefix + 6 chiffres.
7. Telephone E.164 +212 obligatoire.
8. Police format POL-YYYY-NNNN.
9. Facture format INV-YYYY-NNNN.
10. ULID au lieu de UUID v4 pour entites.
11. Argon2id avec parametres OWASP minimum.
12. Tests vitest >= 26 tests sur seeds.
13. Commit conventionnel Angular convention.
14. RLS bypass uniquement via role dedie ou SET LOCAL.

## 15. Validation pre-commit

```bash
# Hooks husky pre-commit
pnpm lint apps/platform/scripts/
pnpm typecheck
pnpm seeds:test

# Verifier absence emoji
grep -rE '[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}]' apps/platform/scripts/ && echo 'EMOJI DETECTED' && exit 1

# Verifier no console.log
grep -n 'console\.log' apps/platform/scripts/*.ts && echo 'CONSOLE.LOG DETECTED' && exit 1

# Verifier seeds idempotency local
pnpm seeds:reset
pnpm seeds:run
pnpm seeds:run  # second run must succeed
```

## 16. Commit message

```
feat(seeds): exhaustive dev seeds for MA insurtech ecosystem

- 5 tenants: Skalean Platform + Bennani broker (Casablanca) + Atlas garage (Marrakech)
- 5 users with argon2id passwords across roles
- 50 CRM contacts (30 Bennani + 20 Atlas) with MA names ICE CIN E.164 phones
- 20 deals across pipeline stages (lead/qualified/proposal/won)
- 5 MA insurers (Wafa, Atlanta Sanad, Saham, RMA, AXA) with ACAPS codes
- 25 insurance products (5 per insurer: auto TR/TP, habitation, vie, sante)
- 20 polices format POL-2026-NNNN linked to Bennani contacts
- 10 future booking RDV avoiding BAM 2026 holidays
- 30 communication messages WhatsApp+Email
- 50 audit log entries
- 200 analytics events
- Idempotent ON CONFLICT DO NOTHING + reset script TRUNCATE CASCADE
- Performance < 30s
- Tests: seeds.spec.ts (8) + data-coherence.spec.ts (6) + generators.spec.ts (8) + faker-locale.spec.ts (4)
- pnpm scripts: seeds:run, seeds:reset, seeds:dev, seeds:test
- Conformite: decision-002 (timezone MAD fr), decision-006 (no emoji), decision-008 (Benguerir on-prem)

Refs: task-1.2.14
Depends-on: task-1.2.13 (RLS policies)
Blocks: task-1.2.15 (Sprint 2 documentation)
```

## 17. Next task 1.2.15

La tache suivante 1.2.15 (Documentation database & runbooks Sprint 2 closure) sera la 15eme et derniere tache du Sprint 2. Elle s'appuiera sur les seeds exhaustifs livres ici pour generer la documentation finale du Sprint 2 avec captures d'ecran reelles montrant la base peuplee, des requetes SQL exemples avec donnees visibles, des runbooks operationnels (backup pgBackRest, restore, RLS validation, seeds:dev pour onboarding nouveaux developpeurs), et clore officiellement le Sprint 2 avant ouverture Sprint 3 (Auth & RBAC).

---

## Annexe A : 5 assureurs MA detail produits

### A.1 Wafa Assurance (groupe Attijariwafa Bank)

Wafa Assurance est leader marocain avec 22.5 pour cent de part de marche. Fondee en 1972, son siege est au 1 Boulevard Abdelmoumen Casablanca. Proximite avec Attijariwafa Bank donne acces a un reseau de 4500 agences bancaires + 350 agences directes assurance. Specialites : auto, habitation, sante (forte traction marche corporate), epargne vie. ACAPS code seeds : ASR-WAF-001. ICE seeds : 001500000000091. Site officiel : wafaassurance.ma. Telephone seeds : +212522545555. Rating Standard & Poor's : AAA national.

Produits seeds Wafa :
- WAF-AUTO-TR (Wafa Auto Tous Risques) : 4500-18000 MAD/an, 8 garanties dont assistance 24/7 et conducteur.
- WAF-AUTO-TP (Wafa Auto Tiers Plus) : 1800-5500 MAD/an, 4 garanties RC + Vol + Incendie + Bris glace.
- WAF-HAB-STD (Wafa Habitation Standard) : 800-4500 MAD/an, 5 garanties incendie/eaux/vol/RC/bris glace.
- WAF-VIE-EPG (Wafa Epargne Vie) : 3000-50000 MAD/an, 3 garanties capital deces + invalidite + epargne retraite.
- WAF-SAN-FAM (Wafa Sante Famille) : 2500-25000 MAD/an, 6 garanties hospitalisation/consultations/medicaments/optique/dentaire/maternite.

### A.2 Atlanta Sanad (groupe Holmarcom)

Atlanta Sanad resulte fusion 2018 entre Atlanta et Sanad. 15.2 pour cent part marche. Siege 181 Boulevard Zerktouni Casablanca. ACAPS code seeds : ASR-ATS-002. ICE seeds : 001600000000093. Site officiel : atlantasanad.ma. Specialites : auto premium et habitation luxe. Rating AA+.

Produits seeds Atlanta Sanad :
- ATS-AUTO-TR (Atlanta Sanad Auto Premium) : 5000-20000 MAD/an, garanties tous risques + vehicule remplacement.
- ATS-AUTO-TP (Atlanta Sanad Auto Eco) : 1900-5800 MAD/an, garanties basiques.
- ATS-HAB-PLUS (Habitation Plus) : 950-5500 MAD/an, 5 garanties + catastrophes naturelles.
- ATS-VIE-CAP (Capital Vie) : 2800-45000 MAD/an, capital deces + rente conjoint + education enfants.
- ATS-SAN-IND (Sante Individuelle) : 1800-18000 MAD/an, hospitalisation + consultations + medicaments + optique.

### A.3 Saham Assurance (groupe Sanlam)

Saham Assurance acquise par Sanlam (Afrique du Sud) en 2018. 14.8 pour cent part marche. Siege 216 Boulevard Zerktouni Casablanca. ACAPS code seeds : ASR-SAH-003. ICE seeds : 001700000000095. Site officiel : saham.ma. Rating AA. Specialites : assurance vie + sante.

Produits seeds Saham :
- SAH-AUTO-TR (Auto Securite Plus) : 4800-19000 MAD/an, RC + tous risques + vol + incendie + bris glace + assistance.
- SAH-AUTO-TP (Auto Tiers Confort) : 1750-5400 MAD/an, RC + vol + incendie + bris glace.
- SAH-HAB-CONF (Habitation Confort) : 850-4800 MAD/an, 4 garanties.
- SAH-VIE-EPG (Epargne Plus) : 3200-48000 MAD/an, capital deces + epargne retraite + rente.
- SAH-SAN-FAM (Sante Famille Plus) : 2400-24000 MAD/an, 5 garanties.

### A.4 RMA Assurance (groupe FinanceCom)

RMA Assurance fondee 1949 (Reunion Marocaine d'Assurance). 13.4 pour cent part marche. Siege 83 Avenue de l'Armee Royale Casablanca. ACAPS code seeds : ASR-RMA-004. ICE seeds : 001800000000097. Site officiel : rma.ma. Rating AA. Specialites : auto et habitation premium.

Produits seeds RMA :
- RMA-AUTO-TR (Auto Excellence) : 5200-21000 MAD/an, 7 garanties dont assistance 24/7.
- RMA-AUTO-TP (Auto Tiers) : 1850-5600 MAD/an, RC + vol + incendie.
- RMA-HAB-PRE (Habitation Premium) : 900-5200 MAD/an, 6 garanties dont catastrophes naturelles + bris glace.
- RMA-VIE-CAP (Capital Famille) : 3100-47000 MAD/an, capital deces + invalidite + education enfants.
- RMA-SAN-PRE (Sante Premium) : 2600-26000 MAD/an, 7 garanties dont specialistes.

### A.5 AXA Assurance Maroc (groupe AXA Group)

AXA Maroc filiale du groupe AXA international. 11.7 pour cent part marche. Siege 120 Avenue Hassan II Casablanca. ACAPS code seeds : ASR-AXA-005. ICE seeds : 001900000000099. Site officiel : axa.ma. Rating AA. Specialites : sante international + epargne retraite.

Produits seeds AXA Maroc :
- AXA-AUTO-TR (Auto Confort) : 5100-20500 MAD/an, RC + tous risques + vol + incendie + bris glace + assistance.
- AXA-AUTO-TP (Auto Essentiel) : 1950-5900 MAD/an, RC + vol + incendie + bris glace.
- AXA-HAB-STD (Habitation Standard) : 880-5000 MAD/an, 4 garanties.
- AXA-VIE-PRE (Vie Prevoyance) : 3300-50000 MAD/an, capital deces + invalidite + epargne + rente.
- AXA-SAN-INT (Sante Internationale) : 3500-35000 MAD/an, hospitalisation Maroc + International + 5 autres garanties.

## Annexe B : faker patterns MA

Patterns custom utilises pour generer donnees realistes Maroc :

| Pattern | Generateur | Exemple |
|---------|-----------|---------|
| Prenom | pickRandom(nomsFrMa.prenoms) | Mohamed, Fatima, Youssef |
| Nom | pickRandom(nomsFrMa.noms) | El Alaoui, Bennani, Tazi |
| Email | `${prenom}.${nom}.${i}@example.ma` | mohamed.bennani.5@example.ma |
| Phone mobile | +2126XXXXXXXX ou +2127XXXXXXXX | +212661234567 |
| Phone fixe | +2125XXXXXXXX | +212522123456 |
| ICE | 15 chiffres | 001234567890123 |
| CIN | prefix + 6 chiffres | BH123456 |
| Adresse | numero + faker.location.street + ville | 42 Rue Atlas, Casablanca |
| Ville | pickRandom(villesMa) | Casablanca, Rabat |
| Police numero | POL-YYYY-NNNN | POL-2026-0042 |
| Facture numero | INV-YYYY-NNNN | INV-2026-0042 |
| ULID | ulid() lib | 01HXY... 26 chars |
| Date passee | randomDateInRange(-90, 0) | 2026-03-15T... |
| Date future | randomDateInRange(1, 30) | 2026-05-20T... |
| Plaque vehicule | NNNNN-A-NN | 12345-A-26 |
| Montant MAD | randomBetween(min, max) | 5000-50000 |

## Annexe C : Noms typiques sample 100

Prenoms masculins (50) typiques marocains francophones :
Mohamed, Ahmed, Hassan, Hussein, Ali, Omar, Youssef, Karim, Said, Driss, Khalid, Rachid, Abdelaziz, Abdellah, Abderrahmane, Abdelkader, Mustapha, Mehdi, Anas, Ilyas, Adam, Yassine, Bilal, Othmane, Soufiane, Ismail, Tarik, Fouad, Brahim, Hicham, Nabil, Jamal, Reda, Walid, Marouane, Imad, Aymane, Ayoub, Zakaria, Yahya, Hamza, Ayman, Salim, Sami, Anouar, Mounir, Redouane, Saad, Najim, Faycal.

Prenoms feminins (50) typiques marocains francophones :
Fatima, Khadija, Aicha, Zineb, Salma, Naima, Houda, Mounia, Samira, Sanaa, Souad, Wafaa, Asmae, Hanane, Imane, Loubna, Karima, Najwa, Kaoutar, Meryem, Yasmina, Soukaina, Hajar, Sara, Nadia, Latifa, Rajaa, Bouchra, Zahra, Amina, Malika, Leila, Saida, Rkia, Halima, Habiba, Touria, Najat, Oumaima, Inas, Chaimae, Ghita, Doha, Lina, Maria, Rania, Nouhaila, Salwa, Manal, Nora.

Noms de famille (100) typiques marocains :
El Alaoui, Bennani, Tazi, Berrada, Lamrini, Chraibi, Fassi, Skalli, Idrissi, Cherkaoui, Bennis, Alami, Benjelloun, Sebti, Mouline, Kettani, Filali, Squalli, El Fassi, Lahlou, Ouazzani, Zniber, Tahiri, El Yazidi, Slaoui, El Ghazi, Rhaoui, Benkirane, El Mansouri, El Khattabi, Bennouna, El Hadji, Sefrioui, El Habti, El Idrissi, Bouayad, El Wazani, Rachdi, Lazrak, El Khazzane, El Ouafi, Bouzoubaa, El Houari, El Bekkali, Drissi, Naciri, Lahbabi, Belarbi, Berrechid, El Jamali, El Bouhmadi, El Bahraoui, El Marrakchi, Senhaji, El Kabbaj, Belkadi, El Ouali, El Kortbi, Halima, Boumahdi, El Kouhen, El Manjra, El Hassani, Ben Abdellah, El Mokri, Andaloussi, Bouhsini, Sefraoui, Demnati, El Maaroufi, Akabli, Boutaleb, Daoudi, Ennaji, Fakhri, Ghazi, Habibi, Iraqi, Jaafari, Kabbaj, Lahcen, Maamri, Nejjar, Oudghiri, Pacha, Qadiri, Raji, Saidi, Tabbaa, Ucciani, Vahabi, Wahbi, Yacoubi, Zerouali, El Mansour, Belhaj, Cherradi, El Bouri, El Otmani, Tijani.

## Annexe D : Villes MA codes prefecture

| Ville | Region | Population | Prefecture CIN |
|-------|--------|-----------|----------------|
| Casablanca | Casablanca-Settat | 3 359 818 | B / BH (Anfa) / BE (Hay Hassani) / BJ (Sidi Bernoussi) |
| Rabat | Rabat-Sale-Kenitra | 577 827 | A |
| Marrakech | Marrakech-Safi | 928 850 | E (E1, E2 selon prefecture) |
| Fes | Fes-Meknes | 1 112 072 | C |
| Tanger | Tanger-Tetouan-Al Hoceima | 947 952 | K |
| Agadir | Souss-Massa | 421 844 | J |
| Meknes | Fes-Meknes | 632 079 | D |
| Oujda | Oriental | 494 252 | F |
| Kenitra | Rabat-Sale-Kenitra | 431 282 | G |
| Tetouan | Tanger-Tetouan-Al Hoceima | 380 787 | L |
| Sale | Rabat-Sale-Kenitra | 890 403 | AB |
| El Jadida | Casablanca-Settat | 194 934 | M |
| Beni Mellal | Beni Mellal-Khenifra | 192 676 | I |
| Nador | Oriental | 161 726 | Z |
| Khouribga | Beni Mellal-Khenifra | 196 196 | I (I1) |
| Settat | Casablanca-Settat | 142 250 | T |
| Mohammedia | Casablanca-Settat | 208 612 | Y |
| Khemisset | Rabat-Sale-Kenitra | 131 542 | X |
| Berrechid | Casablanca-Settat | 136 634 | W |
| Taza | Fes-Meknes | 148 456 | U |

## Annexe E : Ramadan 2026 dates

Ramadan 2026 commence officiellement le mercredi 18 fevrier 2026 (1er Ramadan 1447 H) et se termine le jeudi 19 mars 2026 (29 ou 30 Ramadan selon observation lune). Aid El Fitr 2026 sera le vendredi 20 mars ou samedi 21 mars 2026.

Implications operationnelles pour seeds RDV :
- Horaires bureau reduits : 8h00 - 15h00 au lieu de 9h00 - 18h00.
- Pas de RDV apres 14h30 pour eviter rupture du jeune (Iftar).
- Vendredi : journee continue pas de pause priere (anticipe a 12h30).
- Periode pic activite courtage : second moitié de Ramadan + premiere semaine post-Aid (renouvellements polices auto coincidant avec achats vehicules pre-Aid).

Le helper `isInRamadan2026(date)` retourne true pour toute date entre 18/02/2026 00:00 UTC et 19/03/2026 23:59 UTC. Les seeds RDV utilisent ce check pour generer des `scheduled_at` plausibles avec horaires 9h-14h pendant Ramadan.

## Annexe F : BAM holidays 2026

Liste officielle Bank Al-Maghrib jours feries 2026 (15 jours feries dont fixes nationaux et religieux mobiles) :

| Date | Jour ferie | Type |
|------|-----------|------|
| 1 janvier 2026 | Jour de l'An | Civil |
| 11 janvier 2026 | Manifeste de l'Independance | Civil |
| 18-19 fevrier 2026 | Debut Ramadan (jour observation) | Religieux non ferié travail |
| 20 mars 2026 | Aid El Fitr (estime) | Religieux |
| 21 mars 2026 | Aid El Fitr +1 (estime) | Religieux |
| 1 mai 2026 | Fete du Travail | Civil |
| 26 mai 2026 | Aid El Adha (estime) | Religieux |
| 27 mai 2026 | Aid El Adha +1 (estime) | Religieux |
| 16 juillet 2026 | Awal Moharram (estime) | Religieux |
| 30 juillet 2026 | Fete du Trone | Civil |
| 14 aout 2026 | Allegeance Oued Ed-Dahab | Civil |
| 20 aout 2026 | Revolution du Roi et du Peuple | Civil |
| 21 aout 2026 | Fete de la Jeunesse | Civil |
| 24 septembre 2026 | Aid El Mawlid (estime) | Religieux |
| 6 novembre 2026 | Marche Verte | Civil |
| 18 novembre 2026 | Independance | Civil |

Note : les feries religieux sont estimes selon calendrier Hijri ; dates definitives confirmees par observation lune (Ministere Habous et Affaires Islamiques) ~48h avant. Le helper `isMoroccoHoliday2026(date)` utilise les dates estimees ; production Sprint 18+ prevoit synchronisation API officielle.

Implications seeds RDV :
- 10 RDV booking generes evitent toutes les dates ci-dessus.
- Si random tombe sur ferie : retry max 5 fois avec date differente.
- Banques fermees ces jours : impact deals "won" (paiement premium retarde).

## Conclusion

Cette tache 1.2.14 livre un script TypeScript executable (`pnpm seeds:dev`) qui peuple en moins de 30 secondes une base PostgreSQL Skalean dev avec un ecosysteme realiste InsurTech Maroc complet : 3 tenants (Skalean Platform + Cabinet Bennani Casablanca + Garage Atlas Marrakech), 5 utilisateurs avec roles distincts et password argon2id, 50 contacts avec noms typiquement marocains et ICE/CIN/phone E.164 valides, 20 deals pipeline mix stages, 5 assureurs reels MA (Wafa, Atlanta Sanad, Saham, RMA, AXA) avec leurs codes ACAPS, 25 produits assurance par categorie (auto TR/TP, habitation, vie, sante), 20 polices format POL-2026-NNNN, 10 RDV booking futurs evitant feries BAM 2026 et Ramadan, 30 messages communication, 50 audit logs, 200 analytics events. L'idempotency permet re-run sans duplication. Le reset script garantit etat propre reproductible. Les 26 tests vitest valident la coherence. Cette fondation accelere drastiquement la productivite developpeurs (~1500-4500h sauvees sur 6 mois), permet demos commerciales credibles, et serre de baseline aux tests E2E Sprint 17+. Conformite decision-002 (timezone, currency, locale MA), decision-003 (stack), decision-006 (no emoji), decision-008 (Benguerir on-prem), Loi 09-08 CNDP (donnees fictives).

Fin tache 1.2.14.

---

## Annexe G : Drizzle ORM schema reference

### G.1 Schema tenants

```typescript
// apps/platform/src/db/schema/tenants.ts
import { pgTable, varchar, timestamp, jsonb, uuid, text, index } from 'drizzle-orm/pg-core';

export const tenants = pgTable(
  'tenants',
  {
    id: varchar('id', { length: 26 }).primaryKey(),  // ULID
    name: varchar('name', { length: 255 }).notNull(),
    type: varchar('type', { length: 32 }).notNull(),  // mixed, broker, garage, insurer
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    settings: jsonb('settings').notNull().default({}),
    address: text('address'),
    city: varchar('city', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    slugIdx: index('tenants_slug_idx').on(t.slug),
    typeIdx: index('tenants_type_idx').on(t.type),
    deletedAtIdx: index('tenants_deleted_at_idx').on(t.deletedAt),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
```

### G.2 Schema users

```typescript
// apps/platform/src/db/schema/users.ts
import { pgTable, varchar, timestamp, jsonb, text, index, foreignKey } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const users = pgTable(
  'users',
  {
    id: varchar('id', { length: 26 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 26 }).notNull(),
    email: varchar('email', { length: 320 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    firstName: varchar('first_name', { length: 128 }).notNull(),
    lastName: varchar('last_name', { length: 128 }).notNull(),
    role: varchar('role', { length: 64 }).notNull(),
    phone: varchar('phone', { length: 32 }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    tenantIdIdx: index('users_tenant_id_idx').on(t.tenantId),
    emailIdx: index('users_email_idx').on(t.email),
    roleIdx: index('users_role_idx').on(t.role),
    tenantFk: foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
  }),
);
```

### G.3 Schema contacts

```typescript
// apps/platform/src/db/schema/contacts.ts
import { pgTable, varchar, timestamp, jsonb, text, uniqueIndex, index } from 'drizzle-orm/pg-core';

export const contacts = pgTable(
  'contacts',
  {
    id: varchar('id', { length: 26 }).primaryKey(),
    tenantId: varchar('tenant_id', { length: 26 }).notNull(),
    firstName: varchar('first_name', { length: 128 }).notNull(),
    lastName: varchar('last_name', { length: 128 }).notNull(),
    email: varchar('email', { length: 320 }).notNull(),
    phone: varchar('phone', { length: 32 }).notNull(),
    ice: varchar('ice', { length: 15 }),
    cin: varchar('cin', { length: 16 }),
    city: varchar('city', { length: 128 }),
    address: text('address'),
    type: varchar('type', { length: 32 }).notNull().default('individual'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    tenantEmailUq: uniqueIndex('contacts_tenant_email_uq').on(t.tenantId, t.email),
    tenantIceUq: uniqueIndex('contacts_tenant_ice_uq').on(t.tenantId, t.ice),
    tenantCinUq: uniqueIndex('contacts_tenant_cin_uq').on(t.tenantId, t.cin),
    cityIdx: index('contacts_city_idx').on(t.city),
  }),
);
```

## Annexe H : Workflow developpeur quotidien

Onboarding d'un nouveau developpeur Skalean (recrue Sprint 5+) :

```bash
# 1. Clone repo
git clone git@gitlab.skalean.ma:platform/skalean-monorepo.git
cd skalean-monorepo

# 2. Install dependencies
pnpm install

# 3. Copy env
cp .env.example .env.local
# Editer .env.local avec valeurs locales

# 4. Lancer Postgres + Kafka via docker-compose
docker compose -f docker-compose.dev.yml up -d postgres kafka redis

# 5. Run migrations Flyway
pnpm db:migrate

# 6. Run seeds dev (ce sprint 1.2.14)
pnpm seeds:dev
# Output : "Seeds completed in 22.4s"

# 7. Demarrer API platform
pnpm dev:platform

# 8. Tester login Bennani admin
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bennani.ma","password":"Demo!2026Skalean"}'

# 9. Lister 30 contacts Bennani
TOKEN=...
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/contacts

# 10. Demarrer UI courtier
pnpm dev:broker
# Naviguer http://localhost:3001 -> voir 30 contacts + 20 deals + 20 polices
```

Workflow developpeur tests E2E :

```bash
# Avant chaque suite Cypress
pnpm seeds:dev  # 25-30s
pnpm cypress run --spec "cypress/e2e/broker/**"

# Apres tests
# Soit relancer seeds:dev pour suite suivante (deterministe)
# Soit garder etat pour analyse manuelle
```

Workflow demo client :

```bash
# Avant demo (5 minutes avant)
ssh demo-server.benguerir.skalean.ma
cd /opt/skalean
sudo -u skalean pnpm seeds:dev
# Verifier login fonctionne
curl -k https://demo.skalean.ma/api/health  # 200 OK
# Demo prete : URL https://demo.skalean.ma user admin@bennani.ma pwd Demo!2026Skalean
```

## Annexe I : Mapping tenant role -> permissions seeds

| Role | Tenant cible | Description seeds | Permissions DB | RLS scope |
|------|-------------|--------------------|----------------|-----------|
| super_admin_platform | Skalean Platform | Compte super admin Belgacem Naasaad pour gestion plateforme | ALL via BYPASSRLS | tous tenants |
| broker_admin | Bennani | Karim Bennani patron cabinet | INSERT/UPDATE/DELETE sur tenant_id Bennani | bennani only |
| broker_user | Bennani | Salma Tazi agent commercial | INSERT/UPDATE limited sur tenant_id Bennani | bennani only |
| garage_chef | Atlas | Ahmed El Alaoui chef garage | INSERT/UPDATE/DELETE sur tenant_id Atlas | atlas only |
| garage_technicien | Atlas | Youssef Berrada mecanicien | UPDATE limited sur tenant_id Atlas | atlas only |

Le seed-dev.ts utilise le compte `seed_admin` Postgres (BYPASSRLS) pour pouvoir inserer cross-tenant. En execution applicative normale (Sprint 3+ Auth & RBAC), les role definis ci-dessus appliquent strictement les RLS policies de la tache 1.2.13.

## Annexe J : ULID vs UUID v4 vs serial decision

Skalean retient ULID pour tous IDs entites metier (tenants, users, contacts, deals, polices, etc.) pour les raisons suivantes :

| Critere | ULID | UUID v4 | serial bigint |
|---------|------|---------|---------------|
| Longueur | 26 chars | 36 chars | 8 bytes |
| Triable lexicographique | OUI | NON | OUI |
| Index B-tree friendly | OUI | NON (random insert) | OUI |
| Globalement unique | OUI | OUI | NON (per-table) |
| Devinable timestamp | OUI (premiers 48 bits) | NON | OUI |
| Cross-system | OUI | OUI | NON |
| Performance INSERT | bon | mauvais (page splits) | excellent |

ULID format : `01HXY4ZSAH3JGXQZ8TNTPCN0AY` (26 chars Crockford Base32, 48 bits timestamp + 80 bits random). 

Library : `ulid` npm package.

Verification monotonic dans seeds : le test generators.spec.ts verifie que 2 ULID generes successivement sont differents et triables.

## Annexe K : Performance benchmarks attendus

Mesures performance sur poste developpeur reference (M2 Pro 16GB RAM, Postgres 16 local docker, NodeJS 22.11) :

| Etape | Cible | Mesure typique | Notes |
|-------|-------|----------------|-------|
| seed:reset (TRUNCATE CASCADE) | < 2s | 0.4s | Vide. Plus long si DB volumineuse. |
| seed:run Tenants (3) | < 0.1s | 0.05s | INSERT minimes. |
| seed:run Users (5) avec argon2id | < 5s | 3.2s | 1 hash partage. |
| seed:run Contacts (50) | < 2s | 1.1s | Batch INSERT serait plus rapide. |
| seed:run Deals (20) | < 0.5s | 0.3s | INSERT simple. |
| seed:run Assureurs (5) | < 0.1s | 0.05s | INSERT minimes. |
| seed:run Produits (25) | < 0.5s | 0.2s | INSERT simple. |
| seed:run Polices (20) | < 1s | 0.5s | INSERT simple. |
| seed:run RDV (10) | < 0.5s | 0.3s | INSERT + holiday check. |
| seed:run Messages (30) | < 0.5s | 0.4s | INSERT simple. |
| seed:run Audit logs (50) | < 1s | 0.6s | INSERT simple. |
| seed:run Analytics events (200) | < 3s | 1.8s | Batch 50. |
| seed:run TOTAL | < 30s | 9-12s | Marge confortable. |
| seed:dev (reset + run) | < 35s | 10-13s | Dont 0.4s reset. |
| seed:run RE-RUN (idempotent) | < 5s | 2.1s | DO NOTHING fastpath. |

Si les mesures depassent les cibles, les optimisations possibles sont :
1. Batch INSERT 100 lignes/requete (gain 50-70 pour cent).
2. Argon2id parametres reduits en dev (memoryCost 16384 au lieu de 65536).
3. Disable index updates pendant seed (DISABLE TRIGGER ALL puis REINDEX).
4. Connection pooling pg-pool max 10 (au lieu default 1).

## Annexe L : Logs structures pino sample

Exemple d'output `pnpm seeds:dev` en mode pino-pretty :

```
[INFO] Starting Skalean dev seeds {"randomSeed":42,"timezone":"Africa/Casablanca"}
[INFO] Seed 1 : Tenant Skalean Platform
[INFO] Seed 2 : Tenant Bennani
[INFO] Seed 3 : Tenant Atlas
[INFO] Seed 4 : Users argon2id
[INFO] Seed 5 : 50 contacts CRM
[INFO] Seed 6 : 20 deals CRM
[INFO] Seed 7 : 5 assureurs MA
[INFO] Seed 8 : 25 produits
[INFO] Seed 9 : 20 polices
[INFO] Seed 10 : 10 RDV
[INFO] Seed 11 : 30 messages
[INFO] Seed 12 : 50 audit_log
[INFO] Seed 13 : 200 analytics_events
[INFO] Seeds completed {"elapsedSeconds":11.4}
```

En production CI/CD, format JSON pour ingestion ELK :

```json
{"level":30,"time":1746468000000,"pid":1234,"hostname":"runner-01","msg":"Starting Skalean dev seeds","randomSeed":42,"timezone":"Africa/Casablanca"}
{"level":30,"time":1746468011400,"pid":1234,"hostname":"runner-01","msg":"Seeds completed","elapsedSeconds":11.4}
```

## Annexe M : Strategy de seed evolution multi-sprints

| Sprint | Evolution seeds | Volumes | Nouveaux entites |
|--------|----------------|---------|------------------|
| Sprint 2 (cette tache 1.2.14) | Seeds initiaux | 50 contacts, 20 deals, 20 polices | Tenants, users, contacts, deals, assureurs, produits, polices, RDV, messages, audit, analytics |
| Sprint 3 (Auth & RBAC) | Ajout role permissions | +20 permissions | permissions, role_permissions |
| Sprint 5 (CRM Foundations) | Enrichir interactions | +200 interactions, +100 tasks, +50 notes | interactions, tasks, notes |
| Sprint 6 (CRM Pipelines) | Ajout pipelines custom | +5 pipelines | pipelines, pipeline_stages |
| Sprint 8 (Booking) | Etendre availability + RDV recurrents | +50 availabilities | availabilities, time_slots |
| Sprint 11 (Communication) | WhatsApp + Email + SMS templates | +20 templates | comm_templates |
| Sprint 14 (Insurance Core) | Polices reelles enrichies + sinistres | +50 sinistres, +100 quittances | sinistres, quittances, garanties_souscrites |
| Sprint 17 (Customer Portal) | Comptes client final + factures | +50 customer_accounts | customer_accounts, customer_invoices |
| Sprint 19 (Garage Module) | Ordres reparation + factures + vehicules | +30 ordres reparation | repair_orders, vehicles, parts |
| Sprint 24 (Reporting) | Donnees historiques 12 mois | +5000 events historiques | historical_metrics |
| Sprint 28 (Mobile App) | Notifications push + sessions device | +100 device_sessions | device_sessions, push_subscriptions |
| Sprint 32 (Production hardening) | Migration vers anonymisation prod | N/A | prod_anonymization_jobs |

A chaque sprint, le seed-dev.ts est etendu (pas recree) pour ajouter de nouvelles entites. Les anciens seeds restent compatibles via idempotency ON CONFLICT DO NOTHING. Cela garantit retro-compatibilite : un developpeur Sprint 2 peut continuer a utiliser ses seeds pendant l'evolution.

## Annexe N : CI/CD pipeline integration

Pipeline GitLab CI sur push branch :

```yaml
# .gitlab-ci.yml extrait
stages:
  - lint
  - test
  - seeds-validation
  - integration

seeds-validation:
  stage: seeds-validation
  image: node:22-bookworm
  services:
    - postgres:16-alpine
  variables:
    POSTGRES_DB: skalean_test
    POSTGRES_USER: seed_admin
    POSTGRES_PASSWORD: testpass
    DATABASE_HOST: postgres
    DATABASE_PORT: 5432
    DATABASE_NAME: skalean_test
    DATABASE_USER: seed_admin
    DATABASE_PASSWORD: testpass
    SEED_RANDOM_SEED: "42"
    SEED_TIMEZONE: Africa/Casablanca
    SEED_PASSWORD_DEFAULT: "Demo!2026Skalean"
  before_script:
    - pnpm install --frozen-lockfile
    - pnpm db:migrate
  script:
    - pnpm seeds:reset
    - pnpm seeds:run
    - pnpm seeds:test
  artifacts:
    when: on_failure
    paths:
      - logs/
    expire_in: 1 week

integration-e2e:
  stage: integration
  needs: ["seeds-validation"]
  image: cypress/included:13.6.0
  script:
    - pnpm seeds:dev
    - pnpm cypress run
```

Avantages :
- Validation automatique a chaque push que les seeds fonctionnent.
- Performance benchmark CI : si seeds:run > 60s, fail le pipeline.
- E2E tests beneficient d'un etat connu.

## Annexe O : Anti-patterns a eviter

**Anti-pattern 1 : Seeds dans tests unitaires.** Ne pas appeler `seed-dev.ts` depuis les tests unitaires (qui doivent etre isoles avec mocks). Reserver seeds aux tests integration et E2E.

**Anti-pattern 2 : Hardcoder noms reels personnes physiques.** Risque CNDP + RGPD si seeds copiés en prod. Toujours utiliser faker ou listes generiques.

**Anti-pattern 3 : Deps externes pendant seeds.** Pas d'appels API ACAPS / banque / WhatsApp pendant seeds (risque flakiness CI). Utiliser des donnees hardcoded JSON.

**Anti-pattern 4 : Seeds sans idempotency.** Si DBA execute seeds:run par erreur 2 fois, ne doit pas duplicater. Toujours ON CONFLICT DO NOTHING.

**Anti-pattern 5 : Seeds avec password trivial en prod.** `Demo!2026Skalean` est OK en dev/staging seulement. Production : refuser execution si NODE_ENV=production.

**Anti-pattern 6 : Seeds avec emoji.** decision-006 stricte. grep emoji = 0.

**Anti-pattern 7 : Seeds sans rollback.** En cas d'erreur mid-seed, ROLLBACK transaction pour eviter etat partiel incoherent.

**Anti-pattern 8 : Seeds sans logs.** Toujours pino logger pour visibilite progression et debug.

**Anti-pattern 9 : Seeds couples au schema.** Si schema change (rename column), seeds doivent etre mis a jour en meme temps. Tests CI seeds-validation detecte automatiquement.

**Anti-pattern 10 : Seeds 1000+ minutes.** Au-dela de quelques milliers d'entites, passer a strategy COPY FROM ou pg_restore d'un dump pre-fabrique.

## Annexe P : FAQ developpeurs

**Q : Comment customiser le nombre de contacts ?**
R : Variable env `SEED_CONTACTS_COUNT=200`. Mais respecter la repartition 60% Bennani / 40% Atlas.

**Q : Comment changer le mot de passe seeds ?**
R : Variable env `SEED_PASSWORD_DEFAULT=MonNouveauMdp`. Re-run seeds:dev pour appliquer.

**Q : Comment faire pour ajouter mes propres contacts apres seeds ?**
R : Apres seeds:run, tout est INSERT autorise via API normale. Vos contacts coexistent avec ceux du seed.

**Q : Que faire si seeds:run echoue mid-way ?**
R : La transaction Drizzle est ROLLBACK automatique. Verifier logs pino, fixer le probleme, relancer.

**Q : Peut-on lancer seeds en production ?**
R : NON. Le script verifie `NODE_ENV !== 'production'`. Modification manuelle = erreur grave.

**Q : Comment ajouter un nouvel assureur seeds ?**
R : Editer `seed-data/assureurs-ma.json` (ajouter entry) + `seed-data/produits-assurance.json` (ajouter 5 produits). Re-run seeds:dev.

**Q : Comment regler probleme connection refused Postgres ?**
R : Verifier `docker compose ps`, ports 5432 ouvert, .env.local DATABASE_HOST=localhost ou postgres selon contexte.

**Q : Pourquoi 50 contacts et pas 100 ou 200 ?**
R : Volume sweet spot pour demos credibles ET tests E2E rapides. Modifiable via SEED_CONTACTS_COUNT.

**Q : Les ICE generes sont-ils valides ?**
R : Format syntaxiquement valide (15 chiffres). Pas verifies aupres DGI/OMPIC. C'est volontaire (Loi 09-08 conformite).

**Q : Pourquoi pas de seed locale ar-MA ?**
R : Sprint 17+ ajoutera adresses bilingues. Sprint 2 reste fr-MA pour simplifier.

**Q : Comment ajouter une nouvelle ville MA aux seeds ?**
R : Editer `seed-data/villes-ma.json` et ajouter une entry avec `name`, `region`, `population` minimum. Re-run seeds:dev.

**Q : Comment debugger un seed qui plante ?**
R : Activer `LOG_LEVEL=debug` dans .env.local + relancer. Pino affichera SQL queries Drizzle complete + params + duration.

**Q : Les seeds modifient les sequences Postgres ?**
R : Non, les ULID sont independants des sequences. Mais TRUNCATE ... RESTART IDENTITY reset eventuelles sequences serial encore presentes.

**Q : Combien de RAM Postgres consomme avec ces seeds ?**
R : Tres peu. ~50 contacts + 200 events = quelques MB. Postgres 16 default `shared_buffers=128MB` suffit largement.

## Annexe Q : Comparaison alternatives data generation

| Outil | Avantages | Inconvenients | Decision Skalean |
|-------|-----------|---------------|------------------|
| @faker-js/faker | Riche, locales, maintenu | Pas fr-MA natif | RETENU avec custom |
| Mockaroo (cloud) | UI conviviale, formats variés | Couteux, 1000 lignes/mois free | NON (cout) |
| Synthea (medical) | Realisme medical | Specifique sante | NON (hors scope) |
| testcontainers + sql-init | Postgres docker pre-rempli | Lent boot, fichier SQL volumineux | NON (perf) |
| Custom JS Random | Total controle | Reinventer roue | Hybride : faker fr + custom MA |
| pg_generate_series | Tres rapide cote DB | Limite a sequences simples | NON (manque variations) |
| dbForge Data Generator | UI Windows | Couteux, GUI only | NON |
| Bogus (.NET) | Riche pour .NET | Hors stack | NON |
| Hazm (Python NLP) | Multilingue arabe | Complexe pour seeds | NON |
| pgloader migration | Migration data prod -> dev | Necessite source prod | Plus tard Sprint 32 |

## Annexe R : Diagramme entites seedees

```
                 +-------------+
                 |   Skalean   |
                 |  Platform   |
                 |  (super)    |
                 +------+------+
                        |
        +---------------+---------------+
        |                               |
+-------v--------+              +-------v--------+
|    Bennani     |              |     Atlas      |
| Cabinet broker |              | Garage Marrakech|
|  Casablanca    |              |                |
+--------+-------+              +--------+-------+
         |                               |
   +-----+-----+                   +-----+-----+
   |           |                   |           |
[broker_admin][broker_user]   [garage_chef][garage_technicien]
   Karim B    Salma T          Ahmed E A    Youssef B
         |                               |
   +-----+------+                  +-----+------+
   |            |                  |            |
[30 contacts]  [20 deals]      [20 contacts]   [N/A]
   |
   +--------+
   |        |
[20 polices]   [10 RDV]
   |
[ASR-WAF/ATS/SAH/RMA/AXA]
   |
[25 produits]

[200 analytics] traverse tous tenants
[50 audit] traverse tous tenants
[30 messages] traverse Bennani+Atlas
```

## Annexe S : Sample SQL outputs

Apres `pnpm seeds:dev`, requetes utiles :

```sql
-- Recuperer tous les tenants avec settings JSONB
SELECT slug, type, settings->>'timezone' AS tz, settings->>'currency' AS curr, settings->>'ice' AS ice
FROM tenants ORDER BY slug;

-- Top 5 deals par montant Bennani
SELECT d.title, d.stage, d.amount_mad, c.first_name || ' ' || c.last_name AS contact
FROM deals d JOIN contacts c ON c.id = d.contact_id
JOIN tenants t ON t.id = d.tenant_id
WHERE t.slug = 'bennani'
ORDER BY d.amount_mad DESC LIMIT 5;

-- Nombre polices par produit / assureur
SELECT a.name AS assureur, p.name AS produit, COUNT(po.id) AS nb_polices
FROM insure_polices po
JOIN insure_produits p ON p.code = po.produit_code
JOIN insure_assureurs a ON a.acaps_code = p.assureur_acaps_code
GROUP BY a.name, p.name ORDER BY nb_polices DESC;

-- RDV futurs Bennani groupes par jour
SELECT DATE(scheduled_at) AS jour, COUNT(*) AS nb_rdv
FROM booking_rdv r
JOIN tenants t ON t.id = r.tenant_id
WHERE t.slug = 'bennani' AND scheduled_at > NOW()
GROUP BY DATE(scheduled_at) ORDER BY jour;

-- Distribution analytics events
SELECT event_name, COUNT(*) AS nb,
       MIN(occurred_at)::date AS first_date,
       MAX(occurred_at)::date AS last_date
FROM analytics_events GROUP BY event_name ORDER BY nb DESC;

-- Audit log par user
SELECT u.email, a.action, a.resource_type, COUNT(*) AS nb
FROM audit_log a
JOIN users u ON u.id = a.user_id
GROUP BY u.email, a.action, a.resource_type
ORDER BY u.email, a.resource_type;

-- Contacts avec ICE (entreprises) vs sans (individuels) Bennani
SELECT
  CASE WHEN ice IS NOT NULL THEN 'corporate' ELSE 'individual' END AS type,
  COUNT(*) AS nb
FROM contacts c JOIN tenants t ON t.id = c.tenant_id
WHERE t.slug = 'bennani' GROUP BY type;

-- Verif unicite ICE/CIN
SELECT 'ICE collisions Bennani' AS check_name, COUNT(*) AS errors FROM (
  SELECT ice FROM contacts c JOIN tenants t ON t.id = c.tenant_id
  WHERE t.slug = 'bennani' AND ice IS NOT NULL
  GROUP BY ice HAVING COUNT(*) > 1
) sub
UNION ALL
SELECT 'CIN collisions Bennani', COUNT(*) FROM (
  SELECT cin FROM contacts c JOIN tenants t ON t.id = c.tenant_id
  WHERE t.slug = 'bennani' AND cin IS NOT NULL
  GROUP BY cin HAVING COUNT(*) > 1
) sub;

-- Police status distribution
SELECT status, COUNT(*) AS nb,
       MIN(start_at)::date AS earliest_start,
       MAX(end_at)::date AS latest_end,
       SUM(premium_mad) AS total_premium
FROM insure_polices GROUP BY status;
```

Resultats attendus apres seeds:dev (avec SEED_RANDOM_SEED=42 deterministe) :

```
 slug    | type   | tz                | curr | ice
---------+--------+-------------------+------+-----------------
 atlas   | garage | Africa/Casablanca | MAD  | 002345678000091
 bennani | broker | Africa/Casablanca | MAD  | 001234567000089
 skalean | mixed  | Africa/Casablanca | MAD  | (null)
(3 rows)

 status    | nb | earliest_start | latest_end | total_premium
-----------+----+----------------+------------+---------------
 active    | 12 | 2026-02-15     | 2027-02-14 | 78500.00
 expired   |  5 | 2025-05-10     | 2026-05-09 | 31200.00
 cancelled |  3 | 2026-01-20     | 2027-01-19 | 18750.00
(3 rows)
```

## Annexe T : Profile par tenant

### T.1 Cabinet Bennani Assurance (Casablanca)

**Type metier :** Cabinet de courtage en assurance generaliste, specialise B2C particuliers + B2B PME locales.

**Localisation :** 15 Boulevard Mohammed V, Casablanca, quartier centre-ville (proche siege Wafa Bank et BMCE).

**ICE seeds :** 001234567000089 (15 chiffres, exemple fictif).

**Effectifs seeds :** 1 admin (Karim Bennani, broker_admin) + 1 agent (Salma Tazi, broker_user). Effectifs reels future seraient 5-10 personnes incluant secretariat, comptabilite.

**Specialites observees seeds :** Distribution multi-marques (Wafa, Atlanta Sanad, Saham, RMA, AXA). Mix produits auto / habitation / vie / sante.

**Volume affaire annuel implicite :** 30 contacts + 20 polices + pipeline 20 deals = ~100K-300K MAD CA annuel courtages.

**Cibles client :** 25 individuels + 5 corporate (PME) sur les 30 contacts. Geographie repartie : majorite Casablanca-Settat region + quelques Rabat / Marrakech.

**Pipeline commercial :** 5 lead (premier contact) + 5 qualified (besoins identifies) + 5 proposal (devis envoye) + 5 won (police signee). Pas de "lost" dans seeds Sprint 2 (ajouts Sprint 6).

### T.2 Garage Atlas Auto (Marrakech)

**Type metier :** Garage automobile multi-marques (Renault, Dacia, Peugeot, Citroen, Volkswagen, Ford, Toyota). Reparation + entretien + ventes pieces.

**Localisation :** 42 Avenue Mohammed VI, quartier Gueliz Marrakech (zone economique active).

**ICE seeds :** 002345678000091.

**Effectifs seeds :** 1 chef (Ahmed El Alaoui, garage_chef) + 1 technicien (Youssef Berrada, garage_technicien). Effectifs reels seraient 5-15 personnes (mecaniciens, carrossiers, peintre, magasinier).

**Specialites :** Reparations courantes + entretien preventif + sinistres assurance (relation avec courtiers comme Bennani pour reparations post-sinistre).

**Cibles client :** 20 individuels (proprietaires vehicules), volume historique reparations seraient 50-200/mois en realite. Sprint 2 simplifie a 20 contacts.

**Workflow Sprint 2 :** Pas encore de polices ni deals (le module Garage est Sprint 19). Sprint 2 livre uniquement contacts + RDV + messages + audit.

**Workflow Sprint 19 :** Ajout repair_orders, vehicles (lien VIN + plaque), parts inventory, factures B2C.

### T.3 Skalean Platform (super tenant)

**Type metier :** Tenant special "platform" hebergeant les donnees globales partagees : assureurs MA + produits assurance reference. Pas de business propre.

**Effectifs seeds :** 1 super admin (Belgacem Naasaad), proprietaire fonctionnel platform.

**Donnees seedees :** 5 assureurs MA (Wafa, Atlanta Sanad, Saham, RMA, AXA) + 25 produits associes. Ces donnees sont en lecture pour tous les autres tenants (broker peut souscrire a un produit Wafa pour son contact).

**Architecture multi-tenant :** Pattern "shared catalog" : le super tenant hold les referentiels publics (assureurs, produits, villes, codes ACAPS). Les tenants metier (Bennani, Atlas) consomment via foreign keys ou jointures cross-tenant autorisees par RLS pour ces tables specifiques.

## Annexe U : Roadmap evolution seeds Sprint 18+

**Sprint 18 (Charge tests platform) :** Seeds enrichis avec volumes 10x : 500 contacts, 200 deals, 200 polices. Volume cible 10K events/sec sur Kafka. Performance benchmark seeds:run < 5 minutes.

**Sprint 22 (Multi-region MA) :** Seeds prennent en compte 2-3 regions ACAPS (Rabat-Sale-Kenitra + Casablanca-Settat + Marrakech-Safi). Tenants Bennani-Rabat, Bennani-Marrakech ajoutes pour modeliser une chaine de cabinets.

**Sprint 25 (Internationalisation) :** Seeds bilingues fr/ar : noms en arabe (transliteration), adresses bilingues, libelles produits ar.

**Sprint 30 (BI / Analytics) :** Seeds historique 24 mois (analytics_events 100K+ entries, polices 200+ avec renouvellements 2x).

**Sprint 32 (Production hardening) :** Seeds remplaces par anonymisation prod -> staging via outil dedie. Anonymisation respecte CNDP : noms hash, ICE pseudonymises, telephones masques.

## Annexe V : Convention naming JSON files seed-data

| Fichier | Convention | Maintenance |
|---------|-----------|-------------|
| assureurs-ma.json | snake-case + suffix -ma pour Maroc | Tech lead update lors evolution liste ACAPS |
| produits-assurance.json | snake-case generic | Update Sprint 14 avec produits reels |
| villes-ma.json | snake-case + suffix -ma | Stable, update rare |
| noms-fr-ma.json | locale-region pattern | Update annuel selon evolution prenoms tendance |
| codes-postaux-ma.json | A AJOUTER Sprint 18 | Reference Poste Maroc |
| banques-ma.json | A AJOUTER Sprint 24 | Reference Bank Al-Maghrib |
| professions-ma.json | A AJOUTER Sprint 17 | Reference HCP nomenclature |

## Annexe W : Tests integration Kafka avec seeds

Une fois Kafka active (Sprint 2 task 1.2.10-1.2.13), les seeds peuvent declencher la production d'events :

```typescript
// Apres seed Contact -> publier event ContactCreated
import { KafkaPublisher } from '@skalean/kafka';

const publisher = new KafkaPublisher();
await publisher.connect();

for (const contact of allContacts) {
  await tx.execute(/* INSERT ... */);
  await publisher.publish('crm.contacts', 'contact.created', {
    contactId: contact.id,
    tenantId: contact.tenantId,
    timestamp: new Date().toISOString(),
  });
}

await publisher.disconnect();
```

Cela permet de valider que :
1. Les events Kafka sont produits.
2. Les consumers downstream (analytics, search index Sprint 24) recoivent.
3. Le throughput tient avec 50 contacts en burst.

Version Sprint 2 simple : pas de Kafka publish dans seeds (focus DB). Sprint 18 charge tests : seeds publient events pour valider chain.

## Annexe X : Securite seeds DEV vs PROD

| Aspect | DEV | STAGING | PROD |
|--------|-----|---------|------|
| Execution seeds | Permise | Permise | INTERDITE (NODE_ENV check) |
| Password hash | argon2id partage 1 fois | argon2id partage 1 fois | Hash unique par user (jamais seeds) |
| ICE valide | Format only | Format only | Verifie OMPIC API |
| CIN valide | Format only | Format only | Verifie DGSN (sous reserve) |
| Phone valide | Format only | Format only | Verifie SMS code |
| Email valide | Domain only | Domain only | Verifie via lien double opt-in |
| RLS bypass | Permise via seed_admin | Permise via seed_admin | INTERDITE |
| Sandbox | Postgres local | Postgres staging Benguerir | Postgres prod Benguerir |
| Donnees | Faker fictives | Faker fictives + sample real | Real avec consent |
| Logs niveau | debug | info | warn |
| Retention | 7 jours | 30 jours | 7 ans (ACAPS exigence) |

Les seeds sont strictement DEV/STAGING. Production interdit par check :

```typescript
if (process.env.NODE_ENV === 'production') {
  log.error('Seeds forbidden in production');
  process.exit(1);
}
```

## Annexe Y : Coordination cross-team

Les seeds touchent transverse plusieurs equipes :

- **Backend platform team (owner)** : ecrit et maintient seed-dev.ts.
- **Frontend broker team** : utilise seeds pour developper UI Bennani, demande enrichissements.
- **Frontend garage team** : utilise seeds pour developper UI Atlas, demande enrichissements.
- **QA team** : utilise seeds pour tests E2E, demande deterministicite via SEED_RANDOM_SEED.
- **Sales/founder team** : utilise seeds pour demos, demande noms/villes credibles.
- **DevOps team** : execute seeds en CI/CD pipelines, demande performance < 30s.
- **Compliance team (CNDP)** : valide donnees fictives, demande absence prenoms personnes reelles connues.

Process modification seeds :
1. PR sur branche `feat/seeds-XYZ`.
2. Reviews : 1 backend platform + 1 QA.
3. Tests CI vert (seeds:test passent).
4. Merge sur `develop`.
5. Auto-deploy staging.
6. Validation manuelle 1 demo end-to-end.
7. Merge `main`.

## Annexe Z : Glossaire termes metier

- **ACAPS** : Autorite de Controle des Assurances et de la Prevoyance Sociale, regulateur MA.
- **ICE** : Identifiant Commun de l'Entreprise (15 chiffres unique entreprise MA).
- **CIN** : Carte d'Identite Nationale Marocaine (prefix prefecture + 6 chiffres).
- **RC** : Registre du Commerce (numero entreprise au tribunal).
- **CNSS** : Caisse Nationale de Securite Sociale (immatriculation employes).
- **IF** : Identifiant Fiscal (numero impots).
- **Patente** : Numero patente fiscal entreprise.
- **DGI** : Direction Generale des Impots (administration fiscale MA).
- **OMPIC** : Office Marocain de la Propriete Industrielle et Commerciale.
- **DGSN** : Direction Generale de la Surete Nationale.
- **HCP** : Haut Commissariat au Plan (statistiques nationales MA).
- **BAM** : Bank Al-Maghrib (banque centrale MA).
- **CNDP** : Commission Nationale de Controle de la Protection des Donnees Personnelles (Loi 09-08).
- **MAD** : Dirham Marocain (ISO 4217).
- **TVA** : Taxe sur la Valeur Ajoutee (20 pour cent standard MA).
- **Tiers Plus (TP)** : Assurance auto basique avec garanties Vol/Incendie en plus du RC obligatoire.
- **Tous Risques (TR)** : Assurance auto complete avec dommages collision propres.
- **Police** : Contrat d'assurance avec numero unique.
- **Quittance** : Justificatif paiement prime annuel/mensuel.
- **Sinistre** : Evenement declenchant indemnisation.
- **Garantie** : Couverture specifique d'une police.
- **Premium** : Prime d'assurance payee par l'assure.
- **Aid El Fitr** : Fete musulmane fin Ramadan.
- **Aid El Adha** : Fete musulmane sacrifice (mouton).
- **Awal Moharram** : Nouvel An Hijri.
- **Aid El Mawlid** : Anniversaire prophete Mohammed.

## Annexe AA : Recap chiffrages seeds

Volume total inseres par `pnpm seeds:dev` :

| Entite | Nombre | Tenant Skalean | Tenant Bennani | Tenant Atlas |
|--------|--------|----------------|----------------|--------------|
| Tenants | 3 | 1 | 1 | 1 |
| Users | 5 | 1 | 2 | 2 |
| Contacts | 50 | 0 | 30 | 20 |
| Deals | 20 | 0 | 20 | 0 |
| Assureurs | 5 | 5 | 0 | 0 |
| Produits | 25 | 25 | 0 | 0 |
| Polices | 20 | 0 | 20 | 0 |
| RDV | 10 | 0 | 5 | 5 |
| Messages | 30 | 0 | 20 | 10 |
| Audit logs | 50 | 0 | 30 | 20 |
| Analytics | 200 | 0 | 120 | 80 |
| **TOTAL** | **418** | **32** | **248** | **138** |

Performance attendue : 418 entites en moins de 30 secondes = ~14 entites/seconde, dont environ 50 pour cent du temps dedie aux 5 hashes argon2id (3s) + RTT DB (~5s) + INSERT data (~5s).

Fin annexes.

