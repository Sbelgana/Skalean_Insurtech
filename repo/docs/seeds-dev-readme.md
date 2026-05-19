# Seeds dev exhaustifs -- Guide utilisation

Sprint 2 / Tache 1.2.14 -- Skalean InsurTech MA ecosystem

## Vue d'ensemble

Le script `seed-dev.ts` peuple la base de donnees de developpement avec un jeu de donnees realiste reproduisant un mini-ecosysteme InsurTech Marocain :

- 3 tenants : Skalean Platform (mixed) + Cabinet Bennani Assurance (broker, Casablanca) + Garage Atlas Auto (garage, Marrakech)
- 5 utilisateurs avec passwords argon2id (DEV ONLY)
- 50 contacts CRM avec noms marocains, ICE 15 chiffres, CIN, telephones E.164
- 20 deals pipeline (lead/qualified/proposal/won)
- 5 assureurs MA reels (Wafa, Atlanta Sanad, Saham, RMA, AXA)
- 25 produits assurance (5 par assureur : auto TR/TP, habitation, vie, sante)
- 20 polices format POL-2026-NNNN liees aux contacts Bennani
- 10 RDV booking dates futures (evitant jours feries BAM 2026)
- 30 messages communication (WhatsApp + Email)
- 50 entrees audit_log
- 200 analytics_events

## Prerequis

- PostgreSQL 16 accessible (docker-compose dev ou instance Benguerir)
- User `seed_admin` avec `BYPASSRLS` ou permission `SET LOCAL row_security = off`
- Node.js >= 22 + pnpm >= 9.15

## Variables d'environnement

Copier `.env.example` vers `.env` et configurer la section Seeds :

```ini
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=skalean_dev
DATABASE_USER=seed_admin
DATABASE_PASSWORD=change-me-locally
SEED_PASSWORD_DEFAULT=Demo!2026Skalean
SEED_RANDOM_SEED=42
SEED_TIMEZONE=Africa/Casablanca
```

Variables optionnelles pour ajuster les volumes (valeurs par defaut entre parentheses) :

| Variable | Defaut | Description |
|----------|--------|-------------|
| SEED_CONTACTS_COUNT | 50 | Nombre total de contacts (30 Bennani + 20 Atlas) |
| SEED_DEALS_COUNT | 20 | Nombre de deals CRM |
| SEED_POLICES_COUNT | 20 | Nombre de polices assurance |
| SEED_RDV_COUNT | 10 | Nombre de RDV booking |
| SEED_MESSAGES_COUNT | 30 | Nombre de messages comm |
| SEED_AUDIT_COUNT | 50 | Nombre d'entrees audit_log |
| SEED_ANALYTICS_COUNT | 200 | Nombre d'analytics_events |
| SEED_RANDOM_SEED | 42 | Seed random pour reproductibilite |
| SEED_BATCH_SIZE | 50 | Taille des batches INSERT |

## Commandes

### Reset propre + run (demos + tests E2E)

```bash
pnpm seeds:dev
```

Equivalant a : `pnpm seeds:reset && pnpm seeds:run`

### Run idempotent (ajoute sans detruire)

```bash
pnpm seeds:run
```

Re-run sans erreur grace aux `ON CONFLICT DO NOTHING`. Utile quand le developpeur a deja cree des donnees manuelles.

### Reset uniquement (TRUNCATE CASCADE)

```bash
pnpm seeds:reset
```

Vide toutes les tables dans l'ordre inverse des FK. INTERDIT en production.

### Tests seeds

```bash
pnpm seeds:test
```

Lance les 4 suites de tests :
- `generators.spec.ts` (9 tests purs -- toujours executables)
- `faker-locale.spec.ts` (7 tests -- 4 purs, 3 DB-dependent)
- `seeds.spec.ts` (8 tests integration -- requiert DATABASE_HOST)
- `data-coherence.spec.ts` (6 tests integration -- requiert DATABASE_HOST)

## Performances target

- `pnpm seeds:run` : moins de 30 secondes
- `pnpm seeds:dev` : moins de 35 secondes

## Conformite

- Timezone : Africa/Casablanca (decision-002)
- Currency : MAD ISO 4217 (decision-002)
- Locale : fr-MA primaire (decision-002)
- Aucune emoji (decision-006)
- Donnees fictives conformes Loi 09-08 CNDP
- Cluster Benguerir on-prem (decision-008)
- Argon2id parametres OWASP (memoryCost 65536, timeCost 3, parallelism 4)

## Arborescence fichiers seeds

```
apps/platform/
  scripts/
    seed-dev.ts          Orchestration sequentielle 13 seeds
    seed-reset.ts        TRUNCATE CASCADE toutes tables
    seed-helpers.ts      Generateurs ICE/CIN/phone/police/ULID
    seed-data/
      assureurs-ma.json  5 assureurs MA avec ACAPS codes
      produits-assurance.json  25 produits (5 par assureur)
      villes-ma.json     20 villes principales MA
      noms-fr-ma.json    100 prenoms + 100 noms typiques MA
  test/seeds/
    generators.spec.ts   8 tests unitaires purs
    faker-locale.spec.ts 7 tests (4 purs + 3 DB)
    seeds.spec.ts        8 tests integration DB
    data-coherence.spec.ts  6 tests coherence FK/unicite
```

## Ordre d'insertion FK

```
1. tenants (skalean, bennani, atlas)
2. users (5 utilisateurs cross-tenants)
3. contacts (50 : 30 Bennani + 20 Atlas)
4. deals (20 Bennani : lead/qualified/proposal/won)
5. insure_assureurs (5 MA)
6. insure_produits (25)
7. insure_polices (20 Bennani)
8. booking_rdv (10 : 5 Bennani + 5 Atlas)
9. comm_messages (30 : 20 Bennani + 10 Atlas)
10. audit_log (50 : 30 Bennani + 20 Atlas)
11. analytics_events (200 : 120 Bennani + 80 Atlas)
```

## Utilisateurs seeds (DEV ONLY)

| Email | Role | Tenant | Password |
|-------|------|--------|----------|
| admin@skalean.ma | super_admin_platform | Skalean | Demo!2026Skalean |
| admin@bennani.ma | broker_admin | Bennani | Demo!2026Skalean |
| agent@bennani.ma | broker_user | Bennani | Demo!2026Skalean |
| chef@atlas.ma | garage_chef | Atlas | Demo!2026Skalean |
| tech@atlas.ma | garage_technicien | Atlas | Demo!2026Skalean |

ATTENTION : Ces identifiants sont publics et uniquement pour developpement local. Ne jamais utiliser ces mots de passe en production.

## Verification psql

```sql
-- Compter contacts par tenant
SELECT t.slug, COUNT(c.id) AS contacts_count
FROM tenants t LEFT JOIN contacts c ON c.tenant_id = t.id
GROUP BY t.slug;

-- Verifier stages deals
SELECT stage, COUNT(*) FROM deals GROUP BY stage ORDER BY stage;

-- Verifier statuts polices
SELECT status, COUNT(*) FROM insure_polices GROUP BY status;

-- Assureurs inseres
SELECT name, acaps_code FROM insure_assureurs ORDER BY name;

-- Analytics events
SELECT COUNT(*) AS total, COUNT(DISTINCT event_name) AS types FROM analytics_events;
```
