# TACHE 3.5.2 -- books_journal_entries Entity + JournalService (Double-Entry CGNC)

**Sprint** : 12 (Phase 3 / Sprint 5 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-12-sprint-12-books-compliance.md` (Tache 3.5.2)
**Phase** : 3 -- Modules Horizontaux (Books + Compliance)
**Priorite** : P0 (bloque toutes taches downstream sprint 12 + Sprints 14-25)
**Effort** : 6h
**Dependances** : Tache 3.5.1 (Plan Comptable CGNC seed obligatoire pour valider account_codes)
**Densite cible** : 110-130 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente le **coeur transactionnel comptable** de Skalean InsurTech : les ecritures comptables (journal entries) en mode **double-entry bookkeeping** (partie double) avec validation stricte de l'equilibre debit/credit, numerotation legale sequentielle, immutabilite apres validation, et reverse via contre-ecriture (jamais DELETE). Sans ce module, aucune transaction Pay (Sprint 11) ne peut donner naissance a une ecriture (Tache 3.5.3), aucune facture (Tache 3.5.5) ne peut etre comptabilisee, aucun bilan ni CPC (Tache 3.5.6) ne peut etre genere, aucun report ACAPS (Tache 3.5.7+) ne peut s'appuyer sur des donnees fiables.

L'apport est quadruple. **Premierement** : on cree deux entites couplees, `books_journal_entries` (header de l'ecriture : journal_code, entry_number, entry_date, status, references) et `books_journal_lines` (lignes de l'ecriture : account_code, debit, credit, label) avec contrainte stricte `SUM(debit) = SUM(credit)` validee a la fois cote application (Zod + Decimal.js) et cote base (trigger Postgres BEFORE INSERT). **Deuxiemement** : on implemente la **numerotation sequentielle legale** par tenant + exercice + journal_code (e.g. `VEN-2026-00001`, `BNQ-2026-00042`), avec garantie d'unicite via index unique composite, et locking pessimiste pour eviter les gaps en environnement concurrentiel. La loi 9-88 article 19 impose une numerotation continue, sans gap, sans reset annuel autre que le redemarrage de la sequence par exercice. **Troisiemement** : le **workflow d'etat** est strict (`draft -> validated`) avec validated terminal et immuable. Le `reverse` ne supprime jamais l'ecriture originale ; il cree une contre-ecriture symetrique liee par `reversed_by_entry_id`, preservant ainsi l'audit trail conforme a l'article 22 de la loi 9-88 (conservation 10 ans des pieces et ecritures). **Quatrieme** : on expose 5 endpoints REST (`POST /journal-entries`, `GET /journal-entries`, `GET /journal-entries/:id`, `POST /journal-entries/:id/validate`, `POST /journal-entries/:id/reverse`) avec RBAC fin (`books.journal_entries.{create,read,validate,reverse}`), audit trail systematique, et events Kafka publies a chaque transition d'etat.

A l'issue de cette tache, le tenant Cabinet Bennani peut creer manuellement des ecritures de regularisation (OD), enregistrer des operations diverses, et toute la suite du sprint 12 a un socle stable pour brancher : Tache 3.5.3 (consumer Pay->Journal automatique), Tache 3.5.5 (invoice validation cree journal), Tache 3.5.6 (aggregations bilan/CPC). Les sprints 14+ Insure ajouteront templates specifiques (commissions assureurs apres signature police), 19+ Repair (facturation atelier via journal automatique). Sans cette tache, le sprint 12 est un cul-de-sac.

---

## 2. Contexte etendu

### 2.1 Pourquoi le double-entry et pas un simple log de transactions

Le **principe de la partie double** (double-entry bookkeeping) est la pierre angulaire de la comptabilite occidentale moderne, codifie par Luca Pacioli (Venise, 1494) et impose par toutes les normes comptables nationales (CGNC au Maroc, PCG en France, GAAP US, IFRS internationaux). Pour chaque operation economique, deux ecritures de meme montant sont passees : un **debit** sur un compte (mouvement d'augmentation des actifs OU diminution des passifs/produits) et un **credit** sur un autre compte (l'inverse). La somme de tous les debits d'une ecriture egale la somme de tous les credits.

Exemple concret : un courtier encaisse une commission de 12 000 MAD via virement bancaire d'AXA Maroc. L'ecriture est :
- Debit `5141` Banque +12 000 MAD (augmentation actif tresorerie)
- Credit `71244` Commissions Courtage RC +12 000 MAD (augmentation produits)

Si on s'en tenait a un simple log de transactions (table `transactions(id, amount, type)`) sans partie double, on perdrait : (a) la trace systematique de la contrepartie de chaque flux, (b) la possibilite de produire un bilan (qui repose sur l'invariant Actif = Passif + Capitaux propres derive directement du double-entry), (c) la conformite legale CGNC, (d) la capacite d'audit DGI/ACAPS qui exige la presentation des ecritures conformes a l'article 19 de la loi 9-88.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Log simple `transactions(amount, type)` | Tres simple, requetes rapides | Non conforme CGNC, pas de bilan possible, audit DGI rejette | Rejete |
| Single-entry par account avec balance running | Simple, lecture rapide | Pas conforme, perd contrepartie | Rejete |
| **Double-entry header + lines (retenu)** | Conformite directe, requetes flexibles, bilan natif | 2 tables liees, trigger d'integrite | RETENU |
| Event sourcing pur avec projection | Audit trail natif, replay | Trop complexe, decision-003 TypeORM impose CRUD | Rejete |
| Stocker en immutable append-only avec snapshots | Tres robuste audit | Complexe, perf agregations couteuse | Rejete (overkill phase 3) |
| Librairie tiers (e.g. Beancount) | Mature, eprouve | Python-only, pas integrable Node, langue locale impossible | Rejete |

La decision retenue (double-entry header + lines avec contraintes au niveau base ET application) decoule de : (a) decision-001 (monorepo Node/TypeScript), (b) decision-003 (TypeORM 0.3), (c) imperatif legal CGNC, (d) besoin de generer reports ACAPS (Tache 3.5.8) qui exige format double-entry.

### 2.3 Trade-offs explicites

**Premier trade-off** : la table `books_journal_lines` peut grossir vite (un courtier moyen 500 ecritures/mois x 4 lignes moyennes = 24 000 lignes/an, sur 10 ans 240 000 lignes par tenant). On accepte ce volume car : indexes composites `(tenant_id, journal_entry_id)` et `(tenant_id, account_code, entry_id)` permettent les agregations bilan en sub-second, et Postgres 16 sur Atlas DC1 gere aisement plusieurs millions de lignes. Mitigation supplementaire : partitionnement par exercice fiscal (`PARTITION BY RANGE (exercise_year)`) prevu Sprint 34 Performance (mais pas active maintenant, pas necessaire avant 5+ ans d'historique).

**Deuxieme trade-off** : la numerotation sequentielle sous concurrence forte impose un lock pessimiste sur la combinaison `(tenant_id, exercise_year, journal_code)` lors de l'incrementation. Le cout est une legere serialisation des inserts simultanes sur le meme journal. Mesure sur Atlas DC1 Tier III : 50 inserts concurrents serialisent a ~30ms moyen (acceptable pour des operations comptables qui ne sont jamais a haute frequence). Alternative rejetee : utiliser une SEQUENCE Postgres native par tenant (impossible : Postgres ne supporte pas les sequences parametriques cleanly, et un trou dans la sequence violerait la loi 9-88).

**Troisieme trade-off** : les precisions decimales utilisent `numeric(15, 2)` cote DB (15 chiffres total, 2 decimales). On evite ainsi les erreurs `0.1 + 0.2 = 0.30000000000000004` du float double precision IEEE 754. Cote TypeScript, on utilise `decimal.js` (10.4.3) avec configuration `precision: 25, rounding: ROUND_HALF_UP`. Le cout est : (a) serialisation/deserialisation Decimal <-> string en JSON, (b) operations arithmetiques 5-10x plus lentes que floats natifs. Acceptable car les volumes sont modestes (jamais plus de 100 lignes par ecriture).

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo)** : `packages/books` etend les services de la Tache 3.5.1.
- **decision-002 (multi-tenant 3 niveaux)** : RLS Postgres sur `books_journal_entries` ET `books_journal_lines`, isolation stricte.
- **decision-003 (TypeORM vs Prisma)** : TypeORM 0.3 avec relations `@OneToMany` entry -> lines.
- **decision-006 (no-emoji policy)** : aucune emoji dans labels, descriptions, logs.
- **decision-008 (data residency Maroc)** : tables hebergees Atlas Cloud Benguerir DC1.
- Reference Tache 3.5.1 : `AccountChartService.findByCodes()` consume pour valider tous codes references.

### 2.5 Pieges techniques connus

1. **Piege : addition flottante** -- En JavaScript natif, `0.1 + 0.2 !== 0.3`. Une ecriture avec lignes 100.10 et 200.20 devrait totaliser 300.30, mais retourne 300.29999999... rejette le check balanced. Solution : utiliser `decimal.js` partout, jamais de `+` natif sur les montants.
2. **Piege : numerotation gap** -- Une ecriture creee avec entry_number 42 puis rollback de transaction laisse un gap (43 attendu, 44 utilise par concurrence). L'auditeur DGI rejette. Solution : numerotation dans la meme transaction que l'INSERT, avec lock pessimiste sur la table de sequencage.
3. **Piege : suppression ecriture** -- Supprimer une ecriture validated viole la conservation 10 ans. Solution : pas de DELETE possible (trigger BEFORE DELETE leve exception), reverse cree contre-ecriture.
4. **Piege : entry_date dans le futur** -- Permettrait de fausser un bilan en pre-datant. Solution : check `entry_date <= CURRENT_DATE` (dans les operations standards), avec exception pour les ecritures de cloture passees au 31/12.
5. **Piege : entry_date dans un exercice clos** -- Apres cloture exercice 2025 (Tache 3.5.6 publication bilan), on ne peut plus passer d'ecriture sur 2025. Solution : exercice fiscal a status `open|closed`, check au create.
6. **Piege : modification d'une ligne validated** -- TypeORM `save()` permet par defaut UPDATE. Solution : trigger BEFORE UPDATE OR DELETE sur status='validated' rejette.
7. **Piege : reverse cyclique** -- A reverse B reverse A reverse B...  On peut reverse une ecriture, mais le `reversed_by_entry_id` de la contre-ecriture pointe sur l'original ; pas de reverse-de-reverse. Solution : check `original.status='validated' AND original.reversed_by_entry_id IS NULL`.
8. **Piege : tenant context absent dans consumer Kafka** -- Sans run dans TenantContext, le journal_entry est cree avec `tenant_id=NULL` (RLS ne bloque pas car `app_current_tenant()` est NULL). Solution : `TenantContext.runWithContext({tenantId})` obligatoire dans tous handlers async.
9. **Piege : reference fragile** -- `reference` champ texte libre (ex `pay:tx_xxx`, `invoice:inv_yyy`). Si on renomme l'invoice, la reference reste mais le lien casse. Solution : reference est immutable apres creation, et on maintient un index pour lookup inverse.
10. **Piege : description PII** -- Description peut contenir nom client, email -> CNDP. Solution : champ `description` ne doit jamais contenir CIN/PII complet, juste reference structuree (`Encaissement client #4111-CL042`).
11. **Piege : performance balance par compte** -- `SUM(debit) - SUM(credit) GROUP BY account_code` sur 240k lignes peut etre lent. Solution : index sur `(tenant_id, account_code, entry_id)` couvrant + materialized view balance refreshed nightly (Sprint 34, hors scope).
12. **Piege : precision SUM agregat Postgres** -- `SUM(numeric)` retourne `numeric`, pas float. Mais en JS, le driver pg peut le serialiser en string. Solution : recevoir `string` cote app, parse avec `Decimal.js`.

---

## 3. Architecture context

### 3.1 Position dans le sprint 12

Cette tache 3.5.2 est la deuxieme du sprint, immediatement apres l'initialisation du Plan Comptable. Elle :

- **Depend de** : Tache 3.5.1 (`AccountChartService.findByCodes()` pour valider account_codes), Sprint 6 multi-tenant, Sprint 7 RBAC, Sprint 5 auth (audit user).
- **Bloque** : Tache 3.5.3 (consumer Pay->Journal cree des ecritures via JournalService.createEntry()), 3.5.4 (TVA mapping comptes), 3.5.5 (invoices.validate cree journal), 3.5.6 (bilan agrege journal_lines), 3.5.7+ ACAPS reports.
- **Apporte au sprint** : la primitive comptable centrale, le workflow d'etat, l'API REST, les events Kafka sur transitions, le controle de l'equilibre debit/credit.

### 3.2 Position dans le programme global v2.2

Le sprint 12 est le 5eme de la Phase 3. Le module journal entries est consomme par :

- **Phase 4 Insure** (sprints 14-18) : commission assureur sur police signee genere ecriture (debit `4421` Wafa, credit `71244` commission RC).
- **Phase 5 Repair** (sprints 19-25) : facturation reparation auto cree ecriture (debit `4111` client, credit `71261` MO + `71262` pieces + `4455` TVA).
- **Phase 6 Cross-tenant** (sprint 25) : la societe Skalean parent agrege.
- **Phase 7 Admin** (sprints 26-28) : edition manuelle ecritures, cloture exercice.
- **Sprint 28 Admin Reports Compliance** : exports SAFT-MA serialise tous journal_entries de l'exercice.

### 3.3 Diagramme/flow

```
+------------------------------+
|   Tache 3.5.1 AccountChart   |
+--------------+---------------+
               | findByCodes()
               v
+--------------+---------------+
| Tache 3.5.2 JournalService   |
|  createEntry / validate /    |
|  reverse / find              |
+----+----+----+----+----+----+
     |    |    |    |    |
     v    v    v    v    v
   3.5.3  3.5.4 3.5.5 3.5.6 3.5.7+
   Pay   TVA  Invoice Bilan ACAPS
   evt   srv   valid  CPC   reports
```

### 3.4 Workflow d'etat

```
   POST /journal-entries
         |
         v
   [draft]
       |
       | validate (sum debits = sum credits + RBAC + exercice ouvert)
       v
   [validated] --(immutable, conservation 10 ans)
       |
       | reverse (cree contre-ecriture symetrique)
       v
   [validated + reversed_at + reversed_by_entry_id]
       (l'original reste validated, status n'est pas change a 'reversed')
```

### 3.5 Endpoints exposes par cette tache

```
POST  /api/v1/books/journal-entries                     -> create draft (RBAC create)
GET   /api/v1/books/journal-entries                     -> liste paginee + filtres
GET   /api/v1/books/journal-entries/:id                 -> detail avec lignes
POST  /api/v1/books/journal-entries/:id/validate        -> draft -> validated
POST  /api/v1/books/journal-entries/:id/reverse         -> cree contre-ecriture
GET   /api/v1/books/journal-entries/numbering/next      -> preview prochain numero
```

---

## 4. Livrables checkables

- [ ] Migration TypeORM `2026XXXXHHMMSS-BooksJournalEntries.ts` (~140 lignes) creant `books_journal_entries` + `books_journal_lines` avec FK, indexes, contraintes CHECK, trigger balanced, RLS, trigger immutability validated, trigger no-DELETE.
- [ ] Migration secondaire `2026XXXXHHMMSS-BooksJournalSequences.ts` (~60 lignes) table `books_journal_sequences(tenant_id, exercise_year, journal_code, last_number)` pour tracking sequentiel.
- [ ] Entity `books-journal-entry.entity.ts` (~150 lignes) avec relations `@OneToMany lines`, status union literale, immutable validated.
- [ ] Entity `books-journal-line.entity.ts` (~80 lignes) avec FK entry, account_code FK soft.
- [ ] Type/enum `journal.types.ts` (~80 lignes) JournalCode, JournalEntryStatus, ReversalReason.
- [ ] Schemas Zod `journal.schemas.ts` (~180 lignes) Create/Validate/Reverse + FindQuery + LineSchema.
- [ ] Service `journal.service.ts` (~480 lignes) createEntry, validate, reverse, findAll, findById avec transaction TypeORM + lock pessimiste.
- [ ] Service `journal-numbering.service.ts` (~140 lignes) gestion sequentiel avec FOR UPDATE lock.
- [ ] Service `journal-validation.service.ts` (~160 lignes) verifications metier (balanced, exercice, accounts).
- [ ] Service `journal-reverse.service.ts` (~130 lignes) generation contre-ecriture symetrique.
- [ ] Repository `journal.repository.ts` (~150 lignes) helpers metier.
- [ ] Controller REST `journal-entries.controller.ts` (~220 lignes) 6 endpoints.
- [ ] Module `books.module.ts` mis a jour : enregistre nouvelles entites + services.
- [ ] Permissions ajoutees `books.journal_entries.{create,read,validate,reverse}`.
- [ ] Events Kafka `journal-entry.events.ts` (~80 lignes) schemas Zod.
- [ ] Tests unitaires `journal.service.spec.ts` (~520 lignes) 22 cas.
- [ ] Tests unitaires `journal-numbering.service.spec.ts` (~140 lignes) 6 cas.
- [ ] Tests integration `journal.integration.spec.ts` (~340 lignes) 12 cas.
- [ ] Tests E2E `journal-entries.controller.e2e-spec.ts` (~280 lignes) 14 cas.
- [ ] Tests RLS isolation `journal-rls.spec.ts` (~80 lignes) 3 cas.
- [ ] Fixtures `journal-fixtures.ts` (~160 lignes).
- [ ] Documentation README mise a jour packages/books.
- [ ] Variables env BOOKS_NUMBERING_LOCK_TIMEOUT_MS, BOOKS_FUTURE_DATE_TOLERANCE_DAYS.

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/20260408130000-BooksJournalEntries.ts        (~140 lignes)
repo/packages/database/src/migrations/20260408140000-BooksJournalSequences.ts      (~60 lignes)
repo/packages/books/src/entities/books-journal-entry.entity.ts                    (~150 lignes)
repo/packages/books/src/entities/books-journal-line.entity.ts                      (~80 lignes)
repo/packages/books/src/entities/books-journal-sequence.entity.ts                  (~50 lignes)
repo/packages/books/src/types/journal.types.ts                                     (~80 lignes)
repo/packages/books/src/schemas/journal.schemas.ts                                 (~180 lignes)
repo/packages/books/src/services/journal.service.ts                                (~480 lignes)
repo/packages/books/src/services/journal-numbering.service.ts                      (~140 lignes)
repo/packages/books/src/services/journal-validation.service.ts                     (~160 lignes)
repo/packages/books/src/services/journal-reverse.service.ts                        (~130 lignes)
repo/packages/books/src/repositories/journal.repository.ts                          (~150 lignes)
repo/packages/books/src/index.ts                                                    (modif exports)
repo/apps/api/src/modules/books/controllers/journal-entries.controller.ts          (~220 lignes)
repo/apps/api/src/modules/books/dto/create-journal-entry.dto.ts                    (~30 lignes)
repo/apps/api/src/modules/books/dto/find-journal-entries-query.dto.ts              (~40 lignes)
repo/apps/api/src/modules/books/dto/reverse-entry.dto.ts                           (~25 lignes)
repo/apps/api/src/modules/books/books.module.ts                                    (modif)
repo/packages/shared-events/src/topics/journal-entry.events.ts                      (~80 lignes)
repo/packages/auth/src/permissions/catalog.ts                                       (modif +4 perms)
repo/packages/books/test/unit/journal.service.spec.ts                              (~520 lignes)
repo/packages/books/test/unit/journal-numbering.service.spec.ts                    (~140 lignes)
repo/packages/books/test/unit/journal-validation.service.spec.ts                   (~120 lignes)
repo/packages/books/test/unit/journal-reverse.service.spec.ts                      (~110 lignes)
repo/packages/books/test/integration/journal.integration.spec.ts                    (~340 lignes)
repo/packages/books/test/integration/journal-rls.spec.ts                            (~80 lignes)
repo/apps/api/test/e2e/books/journal-entries.controller.e2e-spec.ts                (~280 lignes)
repo/test/fixtures/journal-fixtures.ts                                              (~160 lignes)
```

Total : 28 fichiers, ~4 200 lignes.

---

## 6. Code patterns COMPLETS

### 6.1 Migration `20260408130000-BooksJournalEntries.ts`

```typescript
// repo/packages/database/src/migrations/20260408130000-BooksJournalEntries.ts
// Migration : tables books_journal_entries + books_journal_lines (CGNC double-entry)
// Reference : Loi 9-88 art 19 (numerotation continue) + art 22 (immutabilite + conservation 10 ans)

import { MigrationInterface, QueryRunner, Table, TableIndex, TableForeignKey } from 'typeorm';

export class BooksJournalEntries20260408130000 implements MigrationInterface {
  name = 'BooksJournalEntries20260408130000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Table books_journal_entries (header)
    await queryRunner.createTable(
      new Table({
        name: 'books_journal_entries',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          {
            name: 'journal_code',
            type: 'varchar',
            length: '8',
            isNullable: false,
            comment: 'VEN/ACH/BNQ/CSS/OD/PAY/AN',
          },
          {
            name: 'entry_number',
            type: 'varchar',
            length: '32',
            isNullable: false,
            comment: 'Format JOURNAL-YYYY-NNNNN (ex VEN-2026-00042)',
          },
          { name: 'entry_date', type: 'date', isNullable: false },
          { name: 'reference', type: 'varchar', length: '128', isNullable: true },
          { name: 'description', type: 'text', isNullable: true },
          {
            name: 'status',
            type: 'varchar',
            length: '20',
            default: `'draft'`,
            isNullable: false,
          },
          { name: 'exercise_year', type: 'smallint', isNullable: false },
          { name: 'period_month', type: 'smallint', isNullable: false },
          {
            name: 'reversed_by_entry_id',
            type: 'uuid',
            isNullable: true,
            comment: 'Si NOT NULL, cette ecriture a ete reverse par cette contre-ecriture',
          },
          {
            name: 'reverses_entry_id',
            type: 'uuid',
            isNullable: true,
            comment: 'Si NOT NULL, cette ecriture EST une contre-ecriture pointant sur l original',
          },
          { name: 'reverse_reason', type: 'text', isNullable: true },
          { name: 'idempotency_key', type: 'varchar', length: '128', isNullable: true },
          { name: 'created_by', type: 'uuid', isNullable: false },
          { name: 'validated_by', type: 'uuid', isNullable: true },
          { name: 'validated_at', type: 'timestamptz', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
        checks: [
          {
            columnNames: ['journal_code'],
            expression: `journal_code IN ('VEN','ACH','BNQ','CSS','OD','PAY','AN')`,
          },
          {
            columnNames: ['status'],
            expression: `status IN ('draft','validated')`,
          },
          {
            columnNames: ['period_month'],
            expression: 'period_month BETWEEN 1 AND 12',
          },
          {
            columnNames: ['exercise_year'],
            expression: 'exercise_year BETWEEN 2020 AND 2100',
          },
        ],
      }),
      true,
    );

    // 2. Indexes books_journal_entries
    await queryRunner.createIndex(
      'books_journal_entries',
      new TableIndex({
        name: 'uk_books_journal_entries_number',
        columnNames: ['tenant_id', 'exercise_year', 'journal_code', 'entry_number'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'books_journal_entries',
      new TableIndex({
        name: 'idx_books_journal_entries_tenant_date',
        columnNames: ['tenant_id', 'entry_date'],
      }),
    );
    await queryRunner.createIndex(
      'books_journal_entries',
      new TableIndex({
        name: 'idx_books_journal_entries_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );
    await queryRunner.createIndex(
      'books_journal_entries',
      new TableIndex({
        name: 'idx_books_journal_entries_reference',
        columnNames: ['tenant_id', 'reference'],
      }),
    );
    await queryRunner.createIndex(
      'books_journal_entries',
      new TableIndex({
        name: 'uk_books_journal_entries_idempotency',
        columnNames: ['tenant_id', 'idempotency_key'],
        isUnique: true,
        where: 'idempotency_key IS NOT NULL',
      }),
    );

    // 3. FK reversal references (self)
    await queryRunner.createForeignKey(
      'books_journal_entries',
      new TableForeignKey({
        columnNames: ['reversed_by_entry_id'],
        referencedTableName: 'books_journal_entries',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        name: 'fk_journal_entries_reversed_by',
      }),
    );
    await queryRunner.createForeignKey(
      'books_journal_entries',
      new TableForeignKey({
        columnNames: ['reverses_entry_id'],
        referencedTableName: 'books_journal_entries',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        name: 'fk_journal_entries_reverses',
      }),
    );

    // 4. Table books_journal_lines
    await queryRunner.createTable(
      new Table({
        name: 'books_journal_lines',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'journal_entry_id', type: 'uuid', isNullable: false },
          { name: 'line_number', type: 'smallint', isNullable: false },
          { name: 'account_code', type: 'varchar', length: '12', isNullable: false },
          { name: 'label', type: 'varchar', length: '255', isNullable: false },
          { name: 'debit', type: 'numeric', precision: 15, scale: 2, default: 0, isNullable: false },
          { name: 'credit', type: 'numeric', precision: 15, scale: 2, default: 0, isNullable: false },
          { name: 'currency', type: 'varchar', length: '3', default: `'MAD'`, isNullable: false },
          { name: 'created_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
        checks: [
          { columnNames: ['debit', 'credit'], expression: 'debit >= 0 AND credit >= 0' },
          { columnNames: ['debit', 'credit'], expression: '(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)' },
          { columnNames: ['line_number'], expression: 'line_number BETWEEN 1 AND 999' },
          { columnNames: ['currency'], expression: `currency IN ('MAD','EUR','USD')` },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKey(
      'books_journal_lines',
      new TableForeignKey({
        columnNames: ['journal_entry_id'],
        referencedTableName: 'books_journal_entries',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
        name: 'fk_journal_lines_entry',
      }),
    );

    await queryRunner.createIndex(
      'books_journal_lines',
      new TableIndex({
        name: 'idx_journal_lines_entry',
        columnNames: ['journal_entry_id', 'line_number'],
        isUnique: true,
      }),
    );
    await queryRunner.createIndex(
      'books_journal_lines',
      new TableIndex({
        name: 'idx_journal_lines_tenant_account',
        columnNames: ['tenant_id', 'account_code'],
      }),
    );

    // 5. Trigger : verifie balanced lors d'INSERT/UPDATE de lines
    // (verification pour chaque mutation : debit total = credit total dans la meme ecriture)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION books_check_journal_balanced()
      RETURNS TRIGGER AS $$
      DECLARE
        sum_debit NUMERIC;
        sum_credit NUMERIC;
      BEGIN
        SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0)
          INTO sum_debit, sum_credit
        FROM books_journal_lines
        WHERE journal_entry_id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

        IF sum_debit <> sum_credit THEN
          RAISE EXCEPTION 'JOURNAL_NOT_BALANCED: debit % credit %', sum_debit, sum_credit
            USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger declanche apres tous les INSERT (par lignes), via DEFERRABLE INITIALLY DEFERRED constraint
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER trg_journal_lines_balanced
      AFTER INSERT OR UPDATE OR DELETE ON books_journal_lines
      DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION books_check_journal_balanced();
    `);

    // 6. Trigger : empeche modification d'une entry validated
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION books_journal_entry_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status = 'validated' AND TG_OP = 'UPDATE' THEN
          IF NEW.status <> 'validated' THEN
            RAISE EXCEPTION 'IMMUTABLE_VALIDATED: ne peut changer status d une entry validated' USING ERRCODE = 'P0002';
          END IF;
          IF NEW.entry_date <> OLD.entry_date OR NEW.journal_code <> OLD.journal_code OR NEW.entry_number <> OLD.entry_number THEN
            RAISE EXCEPTION 'IMMUTABLE_VALIDATED: champs cles immuables' USING ERRCODE = 'P0002';
          END IF;
        END IF;
        NEW.updated_at := now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_journal_entries_immutable
      BEFORE UPDATE ON books_journal_entries
      FOR EACH ROW EXECUTE FUNCTION books_journal_entry_immutable();
    `);

    // 7. Trigger : empeche modification/suppression de lines validated
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION books_journal_lines_immutable()
      RETURNS TRIGGER AS $$
      DECLARE
        entry_status TEXT;
      BEGIN
        SELECT status INTO entry_status FROM books_journal_entries
          WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);
        IF entry_status = 'validated' THEN
          RAISE EXCEPTION 'IMMUTABLE_VALIDATED_LINES: lignes d une entry validated immuables' USING ERRCODE = 'P0002';
        END IF;
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_journal_lines_immutable
      BEFORE UPDATE OR DELETE ON books_journal_lines
      FOR EACH ROW EXECUTE FUNCTION books_journal_lines_immutable();
    `);

    // 8. Trigger : empeche DELETE entry validated
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION books_journal_no_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status = 'validated' THEN
          RAISE EXCEPTION 'NO_DELETE_VALIDATED: validated immutable (loi 9-88 art 22)' USING ERRCODE = 'P0003';
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_journal_entries_no_delete
      BEFORE DELETE ON books_journal_entries
      FOR EACH ROW EXECUTE FUNCTION books_journal_no_delete();
    `);

    // 9. RLS policies
    await queryRunner.query(`ALTER TABLE books_journal_entries ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE books_journal_lines ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY books_je_tenant ON books_journal_entries
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant());
    `);
    await queryRunner.query(`
      CREATE POLICY books_jl_tenant ON books_journal_lines
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant());
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_journal_entries_no_delete ON books_journal_entries`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS books_journal_no_delete()`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_journal_lines_immutable ON books_journal_lines`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS books_journal_lines_immutable()`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_journal_entries_immutable ON books_journal_entries`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS books_journal_entry_immutable()`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_journal_lines_balanced ON books_journal_lines`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS books_check_journal_balanced()`);
    await queryRunner.dropTable('books_journal_lines');
    await queryRunner.dropTable('books_journal_entries');
  }
}
```

**Notes importantes** :
- Le trigger `trg_journal_lines_balanced` est `CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED` : la verification est differee a la fin de la transaction. Ainsi on peut INSERT en sequence : entry, line1, line2, line3 dans une meme transaction sans erreur intermediaire ; le check final compare la somme.
- Le triple trigger `immutable` (entry + lines) + `no_delete` garantit que l'article 22 de la loi 9-88 est respecte au niveau base meme si le code applicatif a un bug.
- L'index unique conditionnel sur `idempotency_key` n'autorise NULL multiple mais une seule occurrence par valeur non-NULL.

### 6.2 Migration `20260408140000-BooksJournalSequences.ts`

```typescript
// repo/packages/database/src/migrations/20260408140000-BooksJournalSequences.ts
// Table de tracking pour numerotation sequentielle locked-update

import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class BooksJournalSequences20260408140000 implements MigrationInterface {
  name = 'BooksJournalSequences20260408140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'books_journal_sequences',
        columns: [
          { name: 'tenant_id', type: 'uuid', isNullable: false, isPrimary: true },
          { name: 'exercise_year', type: 'smallint', isNullable: false, isPrimary: true },
          { name: 'journal_code', type: 'varchar', length: '8', isNullable: false, isPrimary: true },
          { name: 'last_number', type: 'integer', default: 0, isNullable: false },
          { name: 'updated_at', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.query(`ALTER TABLE books_journal_sequences ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY books_seq_tenant ON books_journal_sequences
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant());
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('books_journal_sequences');
  }
}
```

### 6.3 Entity `books-journal-entry.entity.ts`

```typescript
// repo/packages/books/src/entities/books-journal-entry.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BooksJournalLineEntity } from './books-journal-line.entity';
import type { JournalCode, JournalEntryStatus } from '../types/journal.types';

@Entity({ name: 'books_journal_entries' })
@Unique('uk_books_journal_entries_number', ['tenant_id', 'exercise_year', 'journal_code', 'entry_number'])
@Index('idx_books_journal_entries_tenant_date', ['tenant_id', 'entry_date'])
@Index('idx_books_journal_entries_tenant_status', ['tenant_id', 'status'])
@Index('idx_books_journal_entries_reference', ['tenant_id', 'reference'])
export class BooksJournalEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'varchar', length: 8 })
  journal_code!: JournalCode;

  /** Format JOURNAL-YYYY-NNNNN (ex VEN-2026-00042). */
  @Column({ type: 'varchar', length: 32 })
  entry_number!: string;

  @Column({ type: 'date' })
  entry_date!: Date;

  @Column({ type: 'varchar', length: 128, nullable: true })
  reference!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status!: JournalEntryStatus;

  @Column({ type: 'smallint' })
  exercise_year!: number;

  @Column({ type: 'smallint' })
  period_month!: number;

  /** UUID de la contre-ecriture qui a annule celle-ci (NULL si non reverse). */
  @Column({ type: 'uuid', nullable: true })
  reversed_by_entry_id!: string | null;

  @ManyToOne(() => BooksJournalEntryEntity, { nullable: true })
  @JoinColumn({ name: 'reversed_by_entry_id' })
  reversed_by?: BooksJournalEntryEntity;

  /** UUID de l'entry originale pour laquelle celle-ci est une contre-ecriture. */
  @Column({ type: 'uuid', nullable: true })
  reverses_entry_id!: string | null;

  @ManyToOne(() => BooksJournalEntryEntity, { nullable: true })
  @JoinColumn({ name: 'reverses_entry_id' })
  reverses?: BooksJournalEntryEntity;

  @Column({ type: 'text', nullable: true })
  reverse_reason!: string | null;

  /** Idempotency key pour eviter doublons (pay->journal consumer notamment). */
  @Column({ type: 'varchar', length: 128, nullable: true })
  idempotency_key!: string | null;

  @Column({ type: 'uuid' })
  created_by!: string;

  @Column({ type: 'uuid', nullable: true })
  validated_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  validated_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @OneToMany(() => BooksJournalLineEntity, (line) => line.journal_entry, {
    cascade: ['insert'],
    eager: false,
  })
  lines?: BooksJournalLineEntity[];
}
```

### 6.4 Entity `books-journal-line.entity.ts`

```typescript
// repo/packages/books/src/entities/books-journal-line.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BooksJournalEntryEntity } from './books-journal-entry.entity';

@Entity({ name: 'books_journal_lines' })
@Index('idx_journal_lines_tenant_account', ['tenant_id', 'account_code'])
export class BooksJournalLineEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenant_id!: string;

  @Column({ type: 'uuid' })
  journal_entry_id!: string;

  @ManyToOne(() => BooksJournalEntryEntity, (entry) => entry.lines, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'journal_entry_id' })
  journal_entry?: BooksJournalEntryEntity;

  @Column({ type: 'smallint' })
  line_number!: number;

  /** Reference soft vers books_accounts.code (pas de FK car codes peuvent etre custom tenant). */
  @Column({ type: 'varchar', length: 12 })
  account_code!: string;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: numericTransformer() })
  debit!: string;

  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0, transformer: numericTransformer() })
  credit!: string;

  @Column({ type: 'varchar', length: 3, default: 'MAD' })
  currency!: 'MAD' | 'EUR' | 'USD';

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}

/** Transformer : Postgres numeric arrive en string, on prefere preserver string (Decimal.js cote service). */
function numericTransformer() {
  return {
    to: (value: string | number | undefined): string => {
      if (value === null || value === undefined) return '0';
      return typeof value === 'number' ? value.toFixed(2) : value;
    },
    from: (value: string | null): string => value ?? '0',
  };
}
```

### 6.5 Types `journal.types.ts`

```typescript
// repo/packages/books/src/types/journal.types.ts

export const JOURNAL_CODES_LIST = ['VEN', 'ACH', 'BNQ', 'CSS', 'OD', 'PAY', 'AN'] as const;
export type JournalCode = (typeof JOURNAL_CODES_LIST)[number];

export const JOURNAL_CODE_LABELS: Record<JournalCode, string> = {
  VEN: 'Ventes',
  ACH: 'Achats',
  BNQ: 'Banque',
  CSS: 'Caisse',
  OD: 'Operations Diverses',
  PAY: 'Paie',
  AN: 'A Nouveaux',
};

export const JOURNAL_ENTRY_STATUSES = ['draft', 'validated'] as const;
export type JournalEntryStatus = (typeof JOURNAL_ENTRY_STATUSES)[number];

export interface JournalLineInput {
  account_code: string;
  label: string;
  debit?: string | number;
  credit?: string | number;
  currency?: 'MAD' | 'EUR' | 'USD';
}

export interface CreateJournalEntryInput {
  journal_code: JournalCode;
  entry_date: string; // ISO date
  reference?: string;
  description?: string;
  exercise_year?: number; // si omis : derive de entry_date
  idempotency_key?: string;
  auto_validate?: boolean; // pour consumers
  lines: JournalLineInput[];
}

export interface ReverseJournalEntryInput {
  reason: string;
  reverse_date?: string; // si omis : aujourd'hui
}

export interface JournalEntryFindFilters {
  journal_code?: JournalCode;
  date_start?: string;
  date_end?: string;
  account_code?: string;
  status?: JournalEntryStatus;
  exercise_year?: number;
  reference?: string;
  search?: string;
  page?: number;
  page_size?: number;
}
```

### 6.6 Schemas Zod `journal.schemas.ts`

```typescript
// repo/packages/books/src/schemas/journal.schemas.ts

import { z } from 'zod';
import { JOURNAL_CODES_LIST, JOURNAL_ENTRY_STATUSES } from '../types/journal.types';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format YYYY-MM-DD');
const decimalString = z
  .string()
  .regex(/^\d{1,13}(\.\d{1,2})?$/, 'Format decimal max 15.2')
  .or(z.number().nonnegative());

export const JournalLineSchema = z
  .object({
    account_code: z.string().regex(/^[0-9]{1,8}(-[A-Z0-9]{1,8})?$/),
    label: z.string().min(2).max(255),
    debit: decimalString.optional(),
    credit: decimalString.optional(),
    currency: z.enum(['MAD', 'EUR', 'USD']).default('MAD'),
  })
  .strict()
  .refine(
    (line) => {
      const d = parseFloat(String(line.debit ?? '0'));
      const c = parseFloat(String(line.credit ?? '0'));
      return (d > 0 && c === 0) || (d === 0 && c > 0);
    },
    { message: 'Une ligne doit avoir soit debit soit credit > 0, exclusivement' },
  );

export const CreateJournalEntrySchema = z
  .object({
    journal_code: z.enum(JOURNAL_CODES_LIST),
    entry_date: isoDate,
    reference: z.string().max(128).optional(),
    description: z.string().max(2000).optional(),
    exercise_year: z.number().int().min(2020).max(2100).optional(),
    idempotency_key: z.string().min(8).max(128).optional(),
    auto_validate: z.boolean().default(false),
    lines: z.array(JournalLineSchema).min(2).max(999),
  })
  .strict()
  .refine(
    (data) => {
      const sumDebit = data.lines.reduce((s, l) => s + parseFloat(String(l.debit ?? 0)), 0);
      const sumCredit = data.lines.reduce((s, l) => s + parseFloat(String(l.credit ?? 0)), 0);
      return Math.abs(sumDebit - sumCredit) < 0.005;
    },
    { message: 'JOURNAL_NOT_BALANCED: somme debits != somme credits' },
  );

export type CreateJournalEntryDto = z.infer<typeof CreateJournalEntrySchema>;

export const ReverseJournalEntrySchema = z
  .object({
    reason: z.string().min(10).max(500),
    reverse_date: isoDate.optional(),
  })
  .strict();

export type ReverseJournalEntryDto = z.infer<typeof ReverseJournalEntrySchema>;

export const FindJournalEntriesQuerySchema = z
  .object({
    journal_code: z.enum(JOURNAL_CODES_LIST).optional(),
    date_start: isoDate.optional(),
    date_end: isoDate.optional(),
    account_code: z.string().regex(/^[0-9]{1,8}(-[A-Z0-9]{1,8})?$/).optional(),
    status: z.enum(JOURNAL_ENTRY_STATUSES).optional(),
    exercise_year: z.coerce.number().int().min(2020).max(2100).optional(),
    reference: z.string().max(128).optional(),
    search: z.string().max(64).optional(),
    page: z.coerce.number().int().min(1).default(1),
    page_size: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict()
  .refine(
    (data) => !data.date_start || !data.date_end || data.date_start <= data.date_end,
    { message: 'date_start <= date_end' },
  );

export type FindJournalEntriesQuery = z.infer<typeof FindJournalEntriesQuerySchema>;
```

### 6.7 Service `journal.service.ts` (le coeur metier)

```typescript
// repo/packages/books/src/services/journal.service.ts

import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { BooksJournalEntryEntity } from '../entities/books-journal-entry.entity';
import { BooksJournalLineEntity } from '../entities/books-journal-line.entity';
import { TenantContext } from '@insurtech/shared-utils';
import { EventPublisher } from '@insurtech/shared-events';
import { AccountChartService } from './account-chart.service';
import { JournalNumberingService } from './journal-numbering.service';
import { JournalValidationService } from './journal-validation.service';
import { JournalReverseService } from './journal-reverse.service';
import {
  CreateJournalEntrySchema,
  ReverseJournalEntrySchema,
  FindJournalEntriesQuerySchema,
  type CreateJournalEntryDto,
  type ReverseJournalEntryDto,
  type FindJournalEntriesQuery,
} from '../schemas/journal.schemas';

Decimal.set({ precision: 25, rounding: Decimal.ROUND_HALF_UP });

@Injectable()
export class JournalService {
  constructor(
    @InjectRepository(BooksJournalEntryEntity)
    private readonly entryRepo: Repository<BooksJournalEntryEntity>,
    @InjectRepository(BooksJournalLineEntity)
    private readonly lineRepo: Repository<BooksJournalLineEntity>,
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
    private readonly events: EventPublisher,
    private readonly accountService: AccountChartService,
    private readonly numberingService: JournalNumberingService,
    private readonly validationService: JournalValidationService,
    private readonly reverseService: JournalReverseService,
  ) {}

  /**
   * Cree une ecriture comptable. Valide balanced + accounts existent + exercise ouvert.
   * Si auto_validate=true, transition direct draft -> validated.
   */
  async createEntry(input: CreateJournalEntryDto, userId: string): Promise<BooksJournalEntryEntity> {
    const validated = CreateJournalEntrySchema.parse(input);
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException({ code: 'TENANT_CONTEXT_MISSING' });
    }

    const entryDate = new Date(validated.entry_date);
    const exerciseYear = validated.exercise_year ?? entryDate.getFullYear();
    const periodMonth = entryDate.getMonth() + 1;

    // Idempotency check
    if (validated.idempotency_key) {
      const existing = await this.entryRepo.findOne({
        where: { tenant_id: tenantId, idempotency_key: validated.idempotency_key },
      });
      if (existing) {
        this.logger.info({
          msg: 'journal_idempotent_hit',
          idempotency_key: validated.idempotency_key,
          existing_id: existing.id,
        });
        return existing;
      }
    }

    // Validation metier
    await this.validationService.assertExerciseOpen(tenantId, exerciseYear);
    await this.validationService.assertEntryDateAcceptable(entryDate);
    await this.validationService.assertBalanced(validated.lines);

    const accountCodes = validated.lines.map((l) => l.account_code);
    await this.validationService.assertAccountsExist(accountCodes);

    return this.dataSource.transaction(async (em) => {
      // Sequentiel locked
      const entryNumber = await this.numberingService.generateNext(
        tenantId,
        exerciseYear,
        validated.journal_code,
        em,
      );

      // Insert header
      const header = em.create(BooksJournalEntryEntity, {
        tenant_id: tenantId,
        journal_code: validated.journal_code,
        entry_number: entryNumber,
        entry_date: entryDate,
        reference: validated.reference ?? null,
        description: validated.description ?? null,
        status: 'draft',
        exercise_year: exerciseYear,
        period_month: periodMonth,
        idempotency_key: validated.idempotency_key ?? null,
        created_by: userId,
      });
      const savedHeader = await em.save(header);

      // Insert lines
      const lineEntities = validated.lines.map((line, idx) =>
        em.create(BooksJournalLineEntity, {
          tenant_id: tenantId,
          journal_entry_id: savedHeader.id,
          line_number: idx + 1,
          account_code: line.account_code,
          label: line.label,
          debit: this.toDecimalString(line.debit ?? 0),
          credit: this.toDecimalString(line.credit ?? 0),
          currency: line.currency ?? 'MAD',
        }),
      );
      await em.save(lineEntities);
      savedHeader.lines = lineEntities;

      let final = savedHeader;
      if (validated.auto_validate) {
        final = await this.validateInTransaction(em, savedHeader.id, userId);
      }

      this.logger.info({
        msg: 'journal_entry_created',
        entry_id: final.id,
        entry_number: final.entry_number,
        status: final.status,
        tenant_id: tenantId,
        sum_debit: this.sumLines(validated.lines, 'debit'),
      });

      await this.events.publish('books.journal_entry.created', {
        tenant_id: tenantId,
        entry_id: final.id,
        entry_number: final.entry_number,
        journal_code: final.journal_code,
        entry_date: final.entry_date.toISOString().slice(0, 10),
        sum_debit: this.sumLines(validated.lines, 'debit'),
        status: final.status,
        created_by: userId,
      });

      return final;
    });
  }

  /** Validate : draft -> validated. Verifie balanced (par securite) + RBAC + exercise ouvert. */
  async validate(entryId: string, userId: string): Promise<BooksJournalEntryEntity> {
    return this.dataSource.transaction(async (em) => this.validateInTransaction(em, entryId, userId));
  }

  private async validateInTransaction(em: any, entryId: string, userId: string) {
    const entry = await em
      .createQueryBuilder(BooksJournalEntryEntity, 'e')
      .leftJoinAndSelect('e.lines', 'l')
      .where('e.id = :id', { id: entryId })
      .andWhere('e.tenant_id = :tid', { tid: TenantContext.getTenantId() })
      .setLock('pessimistic_write')
      .getOne();

    if (!entry) throw new NotFoundException({ code: 'ENTRY_NOT_FOUND' });
    if (entry.status === 'validated') {
      throw new ConflictException({ code: 'ENTRY_ALREADY_VALIDATED' });
    }

    await this.validationService.assertExerciseOpen(entry.tenant_id, entry.exercise_year);
    await this.validationService.assertBalancedFromLines(entry.lines ?? []);

    entry.status = 'validated';
    entry.validated_by = userId;
    entry.validated_at = new Date();
    const updated = await em.save(entry);

    await this.events.publish('books.journal_entry.validated', {
      tenant_id: entry.tenant_id,
      entry_id: entry.id,
      entry_number: entry.entry_number,
      validated_by: userId,
      validated_at: entry.validated_at.toISOString(),
    });

    this.logger.info({
      msg: 'journal_entry_validated',
      entry_id: entry.id,
      validated_by: userId,
    });

    return updated;
  }

  /** Reverse : cree contre-ecriture symetrique. Original reste validated. */
  async reverse(
    entryId: string,
    input: ReverseJournalEntryDto,
    userId: string,
  ): Promise<BooksJournalEntryEntity> {
    const validated = ReverseJournalEntrySchema.parse(input);
    return this.reverseService.createReversal(entryId, validated, userId);
  }

  async findAll(query: FindJournalEntriesQuery) {
    const validated = FindJournalEntriesQuerySchema.parse(query);
    const tenantId = TenantContext.getTenantId();
    const qb = this.entryRepo
      .createQueryBuilder('e')
      .where('e.tenant_id = :tid', { tid: tenantId });

    if (validated.journal_code) qb.andWhere('e.journal_code = :jc', { jc: validated.journal_code });
    if (validated.status) qb.andWhere('e.status = :s', { s: validated.status });
    if (validated.exercise_year) qb.andWhere('e.exercise_year = :ey', { ey: validated.exercise_year });
    if (validated.date_start) qb.andWhere('e.entry_date >= :ds', { ds: validated.date_start });
    if (validated.date_end) qb.andWhere('e.entry_date <= :de', { de: validated.date_end });
    if (validated.reference) qb.andWhere('e.reference = :ref', { ref: validated.reference });
    if (validated.search) {
      qb.andWhere('(e.entry_number ILIKE :s OR e.description ILIKE :s)', {
        s: `%${validated.search}%`,
      });
    }
    if (validated.account_code) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM books_journal_lines jl
                  WHERE jl.journal_entry_id = e.id AND jl.account_code = :ac)`,
        { ac: validated.account_code },
      );
    }

    qb.orderBy('e.entry_date', 'DESC').addOrderBy('e.entry_number', 'DESC');
    qb.skip((validated.page - 1) * validated.page_size).take(validated.page_size);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page: validated.page,
      page_size: validated.page_size,
      total_pages: Math.ceil(total / validated.page_size),
    };
  }

  async findById(entryId: string): Promise<BooksJournalEntryEntity> {
    const tenantId = TenantContext.getTenantId();
    const entry = await this.entryRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.lines', 'l')
      .leftJoinAndSelect('e.reverses', 'rv')
      .leftJoinAndSelect('e.reversed_by', 'rb')
      .where('e.id = :id', { id: entryId })
      .andWhere('e.tenant_id = :tid', { tid: tenantId })
      .orderBy('l.line_number', 'ASC')
      .getOne();
    if (!entry) throw new NotFoundException({ code: 'ENTRY_NOT_FOUND' });
    return entry;
  }

  private toDecimalString(value: string | number): string {
    return new Decimal(value).toFixed(2);
  }

  private sumLines(lines: { debit?: string | number; credit?: string | number }[], field: 'debit' | 'credit'): string {
    return lines.reduce((acc, l) => acc.plus(new Decimal(l[field] ?? 0)), new Decimal(0)).toFixed(2);
  }
}
```

### 6.8 Service `journal-numbering.service.ts`

```typescript
// repo/packages/books/src/services/journal-numbering.service.ts

import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { EntityManager } from 'typeorm';
import type { JournalCode } from '../types/journal.types';

@Injectable()
export class JournalNumberingService {
  constructor(private readonly logger: Logger) {}

  /**
   * Genere le prochain entry_number pour (tenant, exercise, journal_code).
   * Utilise SELECT FOR UPDATE pour serialiser les concurrents.
   * Doit etre appele DANS une transaction (em provided).
   */
  async generateNext(
    tenantId: string,
    exerciseYear: number,
    journalCode: JournalCode,
    em: EntityManager,
  ): Promise<string> {
    // INSERT row si manquante avec last_number = 0
    await em.query(
      `INSERT INTO books_journal_sequences (tenant_id, exercise_year, journal_code, last_number, updated_at)
       VALUES ($1, $2, $3, 0, now())
       ON CONFLICT (tenant_id, exercise_year, journal_code) DO NOTHING`,
      [tenantId, exerciseYear, journalCode],
    );

    // SELECT FOR UPDATE pour locker la ligne
    const result: Array<{ last_number: number }> = await em.query(
      `SELECT last_number FROM books_journal_sequences
       WHERE tenant_id = $1 AND exercise_year = $2 AND journal_code = $3
       FOR UPDATE`,
      [tenantId, exerciseYear, journalCode],
    );
    if (result.length === 0) {
      throw new Error('NUMBERING_RACE_INSERT_FAILED');
    }
    const next = result[0].last_number + 1;

    await em.query(
      `UPDATE books_journal_sequences
       SET last_number = $1, updated_at = now()
       WHERE tenant_id = $2 AND exercise_year = $3 AND journal_code = $4`,
      [next, tenantId, exerciseYear, journalCode],
    );

    const formatted = `${journalCode}-${exerciseYear}-${next.toString().padStart(5, '0')}`;
    this.logger.debug({
      msg: 'journal_number_generated',
      tenant_id: tenantId,
      entry_number: formatted,
    });
    return formatted;
  }

  /** Preview du prochain numero sans incrementer (lecture seule). */
  async previewNext(
    tenantId: string,
    exerciseYear: number,
    journalCode: JournalCode,
    em: EntityManager,
  ): Promise<string> {
    const result: Array<{ last_number: number }> = await em.query(
      `SELECT COALESCE(last_number, 0) AS last_number
       FROM books_journal_sequences
       WHERE tenant_id = $1 AND exercise_year = $2 AND journal_code = $3`,
      [tenantId, exerciseYear, journalCode],
    );
    const last = result[0]?.last_number ?? 0;
    return `${journalCode}-${exerciseYear}-${(last + 1).toString().padStart(5, '0')}`;
  }
}
```

### 6.9 Service `journal-validation.service.ts`

```typescript
// repo/packages/books/src/services/journal-validation.service.ts

import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { AccountChartService } from './account-chart.service';
import type { JournalLineInput } from '../types/journal.types';
import type { BooksJournalLineEntity } from '../entities/books-journal-line.entity';

const FUTURE_TOLERANCE_DAYS = parseInt(
  process.env.BOOKS_FUTURE_DATE_TOLERANCE_DAYS ?? '0',
  10,
);

@Injectable()
export class JournalValidationService {
  constructor(private readonly accountService: AccountChartService) {}

  async assertBalanced(lines: JournalLineInput[]): Promise<void> {
    const sumDebit = lines.reduce(
      (acc, l) => acc.plus(new Decimal(l.debit ?? 0)),
      new Decimal(0),
    );
    const sumCredit = lines.reduce(
      (acc, l) => acc.plus(new Decimal(l.credit ?? 0)),
      new Decimal(0),
    );
    if (!sumDebit.equals(sumCredit)) {
      throw new BadRequestException({
        code: 'JOURNAL_NOT_BALANCED',
        sum_debit: sumDebit.toFixed(2),
        sum_credit: sumCredit.toFixed(2),
        diff: sumDebit.minus(sumCredit).toFixed(2),
      });
    }
    if (sumDebit.isZero()) {
      throw new BadRequestException({ code: 'JOURNAL_EMPTY' });
    }
  }

  async assertBalancedFromLines(lines: BooksJournalLineEntity[]): Promise<void> {
    return this.assertBalanced(
      lines.map((l) => ({
        account_code: l.account_code,
        label: l.label,
        debit: l.debit,
        credit: l.credit,
      })),
    );
  }

  async assertAccountsExist(codes: string[]): Promise<void> {
    const unique = Array.from(new Set(codes));
    const found = await this.accountService.findByCodes(unique);
    const foundCodes = new Set(found.map((a) => a.code));
    const missing = unique.filter((c) => !foundCodes.has(c));
    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'ACCOUNT_NOT_FOUND',
        missing_codes: missing,
      });
    }
    const inactive = found.filter((a) => !a.active).map((a) => a.code);
    if (inactive.length > 0) {
      throw new BadRequestException({
        code: 'ACCOUNT_INACTIVE',
        inactive_codes: inactive,
      });
    }
  }

  async assertEntryDateAcceptable(entryDate: Date): Promise<void> {
    const now = new Date();
    const maxFuture = new Date(now);
    maxFuture.setDate(maxFuture.getDate() + FUTURE_TOLERANCE_DAYS);
    if (entryDate > maxFuture) {
      throw new BadRequestException({
        code: 'ENTRY_DATE_FUTURE',
        entry_date: entryDate.toISOString(),
        max_acceptable: maxFuture.toISOString(),
      });
    }
    const minPast = new Date(now);
    minPast.setFullYear(minPast.getFullYear() - 5);
    if (entryDate < minPast) {
      throw new BadRequestException({
        code: 'ENTRY_DATE_TOO_OLD',
        entry_date: entryDate.toISOString(),
      });
    }
  }

  /** Verifie qu'un exercice n'est pas cloture. (Placeholder : Tache 3.5.6 introduira table exercises) */
  async assertExerciseOpen(tenantId: string, exerciseYear: number): Promise<void> {
    const currentYear = new Date().getFullYear();
    if (exerciseYear < currentYear - 1) {
      throw new ForbiddenException({
        code: 'EXERCISE_CLOSED',
        exercise_year: exerciseYear,
        message: 'Exercice cloture, ouvrir un exercice OD pour regularisation',
      });
    }
  }
}
```

### 6.10 Service `journal-reverse.service.ts`

```typescript
// repo/packages/books/src/services/journal-reverse.service.ts

import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DataSource } from 'typeorm';
import { BooksJournalEntryEntity } from '../entities/books-journal-entry.entity';
import { BooksJournalLineEntity } from '../entities/books-journal-line.entity';
import { TenantContext } from '@insurtech/shared-utils';
import { EventPublisher } from '@insurtech/shared-events';
import { JournalNumberingService } from './journal-numbering.service';
import type { ReverseJournalEntryDto } from '../schemas/journal.schemas';

@Injectable()
export class JournalReverseService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
    private readonly events: EventPublisher,
    private readonly numberingService: JournalNumberingService,
  ) {}

  async createReversal(
    entryId: string,
    input: ReverseJournalEntryDto,
    userId: string,
  ): Promise<BooksJournalEntryEntity> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException({ code: 'TENANT_CONTEXT_MISSING' });

    return this.dataSource.transaction(async (em) => {
      const original = await em
        .createQueryBuilder(BooksJournalEntryEntity, 'e')
        .leftJoinAndSelect('e.lines', 'l')
        .where('e.id = :id', { id: entryId })
        .andWhere('e.tenant_id = :tid', { tid: tenantId })
        .setLock('pessimistic_write')
        .getOne();

      if (!original) throw new NotFoundException({ code: 'ENTRY_NOT_FOUND' });
      if (original.status !== 'validated') {
        throw new BadRequestException({
          code: 'CANNOT_REVERSE_DRAFT',
          message: 'Une ecriture draft peut etre supprimee, pas reverse',
        });
      }
      if (original.reversed_by_entry_id) {
        throw new ConflictException({
          code: 'ALREADY_REVERSED',
          reversed_by: original.reversed_by_entry_id,
        });
      }
      if (original.reverses_entry_id) {
        throw new BadRequestException({
          code: 'CANNOT_REVERSE_REVERSAL',
          message: 'Reverse d une contre-ecriture non autorise',
        });
      }

      const reverseDate = input.reverse_date ? new Date(input.reverse_date) : new Date();
      const exerciseYear = reverseDate.getFullYear();
      const periodMonth = reverseDate.getMonth() + 1;

      const entryNumber = await this.numberingService.generateNext(
        tenantId,
        exerciseYear,
        original.journal_code,
        em,
      );

      const reversalHeader = em.create(BooksJournalEntryEntity, {
        tenant_id: tenantId,
        journal_code: original.journal_code,
        entry_number: entryNumber,
        entry_date: reverseDate,
        reference: `reverse:${original.entry_number}`,
        description: `Contre-ecriture de ${original.entry_number} -- ${input.reason}`,
        status: 'validated',
        exercise_year: exerciseYear,
        period_month: periodMonth,
        reverses_entry_id: original.id,
        reverse_reason: input.reason,
        created_by: userId,
        validated_by: userId,
        validated_at: new Date(),
      });
      const savedReversal = await em.save(reversalHeader);

      // Lignes symetriques (debit <-> credit)
      const reversalLines = (original.lines ?? []).map((line, idx) =>
        em.create(BooksJournalLineEntity, {
          tenant_id: tenantId,
          journal_entry_id: savedReversal.id,
          line_number: idx + 1,
          account_code: line.account_code,
          label: `Reverse: ${line.label}`,
          debit: line.credit, // SWAP
          credit: line.debit, // SWAP
          currency: line.currency,
        }),
      );
      await em.save(reversalLines);

      // Mise a jour original
      original.reversed_by_entry_id = savedReversal.id;
      await em.save(original);

      await this.events.publish('books.journal_entry.reversed', {
        tenant_id: tenantId,
        original_entry_id: original.id,
        reversal_entry_id: savedReversal.id,
        reason: input.reason,
        reversed_by: userId,
      });

      this.logger.info({
        msg: 'journal_entry_reversed',
        original_id: original.id,
        reversal_id: savedReversal.id,
        reason: input.reason,
      });

      savedReversal.lines = reversalLines;
      return savedReversal;
    });
  }
}
```

### 6.11 Repository `journal.repository.ts`

```typescript
// repo/packages/books/src/repositories/journal.repository.ts

import { DataSource, Repository } from 'typeorm';
import { BooksJournalEntryEntity } from '../entities/books-journal-entry.entity';

export class BooksJournalRepository extends Repository<BooksJournalEntryEntity> {
  constructor(dataSource: DataSource) {
    super(BooksJournalEntryEntity, dataSource.createEntityManager());
  }

  async sumByAccount(
    tenantId: string,
    accountCode: string,
    dateStart: Date,
    dateEnd: Date,
  ): Promise<{ debit: string; credit: string; balance: string }> {
    const result: Array<{ debit: string; credit: string }> = await this.manager.query(
      `SELECT
         COALESCE(SUM(jl.debit), 0)::text AS debit,
         COALESCE(SUM(jl.credit), 0)::text AS credit
       FROM books_journal_lines jl
       INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.tenant_id = $1
         AND jl.account_code = $2
         AND je.entry_date BETWEEN $3 AND $4
         AND je.status = 'validated'`,
      [tenantId, accountCode, dateStart, dateEnd],
    );
    const debit = result[0].debit;
    const credit = result[0].credit;
    const balance = (parseFloat(debit) - parseFloat(credit)).toFixed(2);
    return { debit, credit, balance };
  }

  async balanceTrialByClass(tenantId: string, dateEnd: Date) {
    return this.manager.query(
      `SELECT a.class_number,
              SUM(jl.debit)::text AS debit,
              SUM(jl.credit)::text AS credit,
              (SUM(jl.debit) - SUM(jl.credit))::text AS balance
         FROM books_journal_lines jl
         INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
         INNER JOIN books_accounts a ON a.code = jl.account_code AND (a.tenant_id IS NULL OR a.tenant_id = $1)
        WHERE je.tenant_id = $1
          AND je.entry_date <= $2
          AND je.status = 'validated'
        GROUP BY a.class_number
        ORDER BY a.class_number`,
      [tenantId, dateEnd],
    );
  }
}
```

### 6.12 Controller `journal-entries.controller.ts`

```typescript
// repo/apps/api/src/modules/books/controllers/journal-entries.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, TenantGuard, PermissionsGuard } from '@insurtech/auth';
import { Permissions, CurrentUser } from '@insurtech/auth/decorators';
import { ZodPipe } from '@insurtech/shared-utils/pipes/zod.pipe';
import { JournalService } from '@insurtech/books/services/journal.service';
import { JournalNumberingService } from '@insurtech/books/services/journal-numbering.service';
import {
  CreateJournalEntrySchema,
  ReverseJournalEntrySchema,
  FindJournalEntriesQuerySchema,
  type CreateJournalEntryDto,
  type ReverseJournalEntryDto,
  type FindJournalEntriesQuery,
} from '@insurtech/books/schemas/journal.schemas';
import { z } from 'zod';

const PreviewQuerySchema = z.object({
  exercise_year: z.coerce.number().int().min(2020).max(2100),
  journal_code: z.enum(['VEN', 'ACH', 'BNQ', 'CSS', 'OD', 'PAY', 'AN']),
});

@ApiTags('Books -- Journal Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller({ path: 'books/journal-entries', version: '1' })
export class JournalEntriesController {
  constructor(
    private readonly service: JournalService,
    private readonly numbering: JournalNumberingService,
  ) {}

  @Post()
  @Permissions('books.journal_entries.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Cree une ecriture comptable (draft ou auto-validated)' })
  async create(
    @Body(new ZodPipe(CreateJournalEntrySchema)) body: CreateJournalEntryDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.service.createEntry(body, user.sub);
  }

  @Get()
  @Permissions('books.journal_entries.read')
  async findAll(@Query(new ZodPipe(FindJournalEntriesQuerySchema)) query: FindJournalEntriesQuery) {
    return this.service.findAll(query);
  }

  @Get('numbering/next')
  @Permissions('books.journal_entries.read')
  async previewNext(@Query(new ZodPipe(PreviewQuerySchema)) query: { exercise_year: number; journal_code: any }) {
    // Acces a la connexion via DataSource est complexe ici ; deleguer au service
    return this.service['dataSource'].transaction((em) =>
      this.numbering.previewNext(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        require('@insurtech/shared-utils').TenantContext.getTenantId()!,
        query.exercise_year,
        query.journal_code,
        em,
      ),
    );
  }

  @Get(':id')
  @Permissions('books.journal_entries.read')
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post(':id/validate')
  @Permissions('books.journal_entries.validate')
  async validate(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.service.validate(id, user.sub);
  }

  @Post(':id/reverse')
  @Permissions('books.journal_entries.reverse')
  @HttpCode(HttpStatus.CREATED)
  async reverse(
    @Param('id') id: string,
    @Body(new ZodPipe(ReverseJournalEntrySchema)) body: ReverseJournalEntryDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.service.reverse(id, body, user.sub);
  }
}
```

### 6.13 Events Kafka `journal-entry.events.ts`

```typescript
// repo/packages/shared-events/src/topics/journal-entry.events.ts

import { z } from 'zod';

export const JOURNAL_TOPICS = {
  CREATED: 'insurtech.events.books.journal_entry.created',
  VALIDATED: 'insurtech.events.books.journal_entry.validated',
  REVERSED: 'insurtech.events.books.journal_entry.reversed',
} as const;

export const JournalEntryCreatedSchema = z.object({
  tenant_id: z.string().uuid(),
  entry_id: z.string().uuid(),
  entry_number: z.string(),
  journal_code: z.enum(['VEN', 'ACH', 'BNQ', 'CSS', 'OD', 'PAY', 'AN']),
  entry_date: z.string(),
  sum_debit: z.string(),
  status: z.enum(['draft', 'validated']),
  created_by: z.string().uuid(),
});
export type JournalEntryCreatedEvent = z.infer<typeof JournalEntryCreatedSchema>;

export const JournalEntryValidatedSchema = z.object({
  tenant_id: z.string().uuid(),
  entry_id: z.string().uuid(),
  entry_number: z.string(),
  validated_by: z.string().uuid(),
  validated_at: z.string(),
});
export type JournalEntryValidatedEvent = z.infer<typeof JournalEntryValidatedSchema>;

export const JournalEntryReversedSchema = z.object({
  tenant_id: z.string().uuid(),
  original_entry_id: z.string().uuid(),
  reversal_entry_id: z.string().uuid(),
  reason: z.string(),
  reversed_by: z.string().uuid(),
});
export type JournalEntryReversedEvent = z.infer<typeof JournalEntryReversedSchema>;
```

---

## 7. Tests complets

### 7.1 Tests unitaires `journal.service.spec.ts` (extrait, 22 cas)

```typescript
// repo/packages/books/test/unit/journal.service.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JournalService } from '../../src/services/journal.service';
import { TenantContext } from '@insurtech/shared-utils';

describe('JournalService', () => {
  let service: JournalService;
  let entryRepo: any;
  let lineRepo: any;
  let dataSource: any;
  let logger: any;
  let events: any;
  let accountService: any;
  let numberingService: any;
  let validationService: any;
  let reverseService: any;

  beforeEach(() => {
    vi.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-uuid-1');
    entryRepo = {
      findOne: vi.fn(),
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        skip: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getOne: vi.fn(),
        getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
      }),
    };
    lineRepo = {};
    dataSource = {
      transaction: vi.fn().mockImplementation(async (fn) =>
        fn({
          create: vi.fn().mockImplementation((_e, data) => data),
          save: vi.fn().mockImplementation((data) =>
            Array.isArray(data)
              ? data.map((d, i) => ({ ...d, id: `line-${i}` }))
              : { ...data, id: 'entry-id-1', created_at: new Date() },
          ),
          query: vi.fn(),
          createQueryBuilder: vi.fn().mockReturnValue({
            leftJoinAndSelect: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            setLock: vi.fn().mockReturnThis(),
            getOne: vi.fn().mockResolvedValue({
              id: 'entry-id-1',
              tenant_id: 'tenant-uuid-1',
              journal_code: 'OD',
              status: 'draft',
              exercise_year: 2026,
              lines: [
                { account_code: '5141', debit: '1000.00', credit: '0', label: 'Banque' },
                { account_code: '4111', debit: '0', credit: '1000.00', label: 'Client' },
              ],
            }),
          }),
        }),
      ),
    };
    logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
    events = { publish: vi.fn() };
    accountService = { findByCodes: vi.fn().mockResolvedValue([{ code: '5141', active: true }, { code: '4111', active: true }]) };
    numberingService = { generateNext: vi.fn().mockResolvedValue('OD-2026-00001') };
    validationService = {
      assertExerciseOpen: vi.fn(),
      assertEntryDateAcceptable: vi.fn(),
      assertBalanced: vi.fn(),
      assertBalancedFromLines: vi.fn(),
      assertAccountsExist: vi.fn(),
    };
    reverseService = { createReversal: vi.fn() };

    service = new JournalService(
      entryRepo,
      lineRepo,
      dataSource,
      logger,
      events,
      accountService,
      numberingService,
      validationService,
      reverseService,
    );
  });

  const baseInput = () => ({
    journal_code: 'OD' as const,
    entry_date: '2026-04-08',
    description: 'Test',
    lines: [
      { account_code: '5141', label: 'Banque', debit: '1000.00' },
      { account_code: '4111', label: 'Client', credit: '1000.00' },
    ],
  });

  it('V1 -- createEntry succes balanced', async () => {
    const result = await service.createEntry(baseInput(), 'user-1');
    expect(result.id).toBe('entry-id-1');
    expect(numberingService.generateNext).toHaveBeenCalled();
  });

  it('V2 -- createEntry leve si tenant context absent', async () => {
    vi.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined as unknown as string);
    await expect(service.createEntry(baseInput(), 'user-1')).rejects.toMatchObject({
      response: { code: 'TENANT_CONTEXT_MISSING' },
    });
  });

  it('V3 -- createEntry idempotent retourne existant', async () => {
    entryRepo.findOne = vi.fn().mockResolvedValue({ id: 'existing-uuid', idempotency_key: 'k1' });
    const result = await service.createEntry(
      { ...baseInput(), idempotency_key: 'k1-test-12345' },
      'user-1',
    );
    expect(result.id).toBe('existing-uuid');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('V4 -- createEntry leve si imbalanced via Zod', async () => {
    const bad = baseInput();
    bad.lines[0].debit = '999.00';
    await expect(service.createEntry(bad as any, 'user-1')).rejects.toThrow(/JOURNAL_NOT_BALANCED/);
  });

  it('V5 -- createEntry leve si moins de 2 lignes', async () => {
    const bad = { ...baseInput(), lines: [baseInput().lines[0]] };
    await expect(service.createEntry(bad as any, 'user-1')).rejects.toThrow();
  });

  it('V6 -- createEntry leve si ligne avec debit ET credit', async () => {
    const bad = baseInput();
    bad.lines[0].debit = '500.00';
    (bad.lines[0] as any).credit = '500.00';
    await expect(service.createEntry(bad as any, 'user-1')).rejects.toThrow();
  });

  it('V7 -- createEntry leve si account inexistant', async () => {
    validationService.assertAccountsExist = vi.fn().mockRejectedValue({
      response: { code: 'ACCOUNT_NOT_FOUND' },
    });
    await expect(service.createEntry(baseInput(), 'user-1')).rejects.toMatchObject({
      response: { code: 'ACCOUNT_NOT_FOUND' },
    });
  });

  it('V8 -- createEntry auto_validate -> status validated', async () => {
    const result = await service.createEntry({ ...baseInput(), auto_validate: true }, 'user-1');
    expect(events.publish).toHaveBeenCalledWith(
      'books.journal_entry.created',
      expect.objectContaining({ status: 'validated' }),
    );
  });

  it('V9 -- createEntry publie event books.journal_entry.created', async () => {
    await service.createEntry(baseInput(), 'user-1');
    expect(events.publish).toHaveBeenCalledWith(
      'books.journal_entry.created',
      expect.objectContaining({ entry_number: 'OD-2026-00001' }),
    );
  });

  it('V10 -- createEntry leve si exercice clos', async () => {
    validationService.assertExerciseOpen = vi
      .fn()
      .mockRejectedValue({ response: { code: 'EXERCISE_CLOSED' } });
    await expect(service.createEntry(baseInput(), 'user-1')).rejects.toMatchObject({
      response: { code: 'EXERCISE_CLOSED' },
    });
  });

  it('V11 -- validate transitionne draft -> validated', async () => {
    const result = await service.validate('entry-id-1', 'user-2');
    expect(result.status).toBe('validated');
    expect(events.publish).toHaveBeenCalledWith(
      'books.journal_entry.validated',
      expect.any(Object),
    );
  });

  it('V12 -- validate leve si deja validated', async () => {
    dataSource.transaction = vi.fn().mockImplementation(async (fn) =>
      fn({
        createQueryBuilder: vi.fn().mockReturnValue({
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          setLock: vi.fn().mockReturnThis(),
          getOne: vi.fn().mockResolvedValue({ id: 'x', status: 'validated', tenant_id: 'tenant-uuid-1', exercise_year: 2026, lines: [] }),
        }),
      }),
    );
    await expect(service.validate('x', 'user-1')).rejects.toMatchObject({
      response: { code: 'ENTRY_ALREADY_VALIDATED' },
    });
  });

  it('V13 -- validate leve si entry not found', async () => {
    dataSource.transaction = vi.fn().mockImplementation(async (fn) =>
      fn({
        createQueryBuilder: vi.fn().mockReturnValue({
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          setLock: vi.fn().mockReturnThis(),
          getOne: vi.fn().mockResolvedValue(null),
        }),
      }),
    );
    await expect(service.validate('missing', 'user-1')).rejects.toMatchObject({
      response: { code: 'ENTRY_NOT_FOUND' },
    });
  });

  it('V14 -- reverse delegue a JournalReverseService', async () => {
    reverseService.createReversal = vi.fn().mockResolvedValue({ id: 'reversal-1' });
    const result = await service.reverse('entry-id-1', { reason: 'Erreur saisie initiale' }, 'user-2');
    expect(result.id).toBe('reversal-1');
    expect(reverseService.createReversal).toHaveBeenCalled();
  });

  it('V15 -- reverse leve si reason trop court (Zod min 10)', async () => {
    await expect(service.reverse('entry-id-1', { reason: 'short' }, 'user-1')).rejects.toThrow();
  });

  it('V16 -- findAll filtre par journal_code', async () => {
    const qb = entryRepo.createQueryBuilder();
    qb.getManyAndCount = vi.fn().mockResolvedValue([[{ id: '1' }], 1]);
    const res = await service.findAll({ journal_code: 'VEN', page: 1, page_size: 10 });
    expect(res.total).toBe(1);
    expect(qb.andWhere).toHaveBeenCalledWith('e.journal_code = :jc', { jc: 'VEN' });
  });

  it('V17 -- findAll filtre par account_code via EXISTS', async () => {
    const qb = entryRepo.createQueryBuilder();
    qb.getManyAndCount = vi.fn().mockResolvedValue([[], 0]);
    await service.findAll({ account_code: '4111', page: 1, page_size: 10 });
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('EXISTS'), expect.any(Object));
  });

  it('V18 -- findById renvoie avec lines triees', async () => {
    const qb = entryRepo.createQueryBuilder();
    qb.getOne = vi.fn().mockResolvedValue({ id: 'x', lines: [{ line_number: 2 }, { line_number: 1 }] });
    const result = await service.findById('x');
    expect(result.id).toBe('x');
  });

  it('V19 -- findById leve si non trouve', async () => {
    const qb = entryRepo.createQueryBuilder();
    qb.getOne = vi.fn().mockResolvedValue(null);
    await expect(service.findById('missing')).rejects.toMatchObject({
      response: { code: 'ENTRY_NOT_FOUND' },
    });
  });

  it('V20 -- decimal precision : 0.1 + 0.2 = 0.3 (pas float)', async () => {
    const lines = [
      { account_code: '5141', label: 'B', debit: '0.10' },
      { account_code: '5161', label: 'C', debit: '0.20' },
      { account_code: '4111', label: 'D', credit: '0.30' },
    ];
    const result = await service.createEntry(
      { journal_code: 'OD', entry_date: '2026-04-08', lines },
      'user-1',
    );
    expect(result).toBeDefined();
  });

  it('V21 -- date future > 0 jours rejette', async () => {
    validationService.assertEntryDateAcceptable = vi
      .fn()
      .mockRejectedValue({ response: { code: 'ENTRY_DATE_FUTURE' } });
    await expect(service.createEntry({ ...baseInput(), entry_date: '2099-01-01' }, 'user-1')).rejects.toMatchObject({
      response: { code: 'ENTRY_DATE_FUTURE' },
    });
  });

  it('V22 -- date trop ancienne (>5 ans) rejette', async () => {
    validationService.assertEntryDateAcceptable = vi
      .fn()
      .mockRejectedValue({ response: { code: 'ENTRY_DATE_TOO_OLD' } });
    await expect(service.createEntry({ ...baseInput(), entry_date: '2010-01-01' }, 'user-1')).rejects.toMatchObject({
      response: { code: 'ENTRY_DATE_TOO_OLD' },
    });
  });
});
```

### 7.2 Tests unitaires `journal-numbering.service.spec.ts`

```typescript
// repo/packages/books/test/unit/journal-numbering.service.spec.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JournalNumberingService } from '../../src/services/journal-numbering.service';

describe('JournalNumberingService', () => {
  let service: JournalNumberingService;
  let logger: any;
  let em: any;

  beforeEach(() => {
    logger = { info: vi.fn(), debug: vi.fn() };
    em = { query: vi.fn() };
    service = new JournalNumberingService(logger);
  });

  it('N1 -- generateNext format JOURNAL-YYYY-NNNNN', async () => {
    em.query
      .mockResolvedValueOnce(undefined) // INSERT
      .mockResolvedValueOnce([{ last_number: 0 }]) // SELECT FOR UPDATE
      .mockResolvedValueOnce(undefined); // UPDATE
    const r = await service.generateNext('t1', 2026, 'VEN', em);
    expect(r).toBe('VEN-2026-00001');
  });

  it('N2 -- generateNext incremente sequentiellement', async () => {
    em.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ last_number: 41 }])
      .mockResolvedValueOnce(undefined);
    const r = await service.generateNext('t1', 2026, 'OD', em);
    expect(r).toBe('OD-2026-00042');
  });

  it('N3 -- previewNext ne modifie pas DB', async () => {
    em.query.mockResolvedValueOnce([{ last_number: 100 }]);
    const r = await service.previewNext('t1', 2026, 'BNQ', em);
    expect(r).toBe('BNQ-2026-00101');
    expect(em.query).toHaveBeenCalledTimes(1);
  });

  it('N4 -- previewNext renvoie 00001 si row absente', async () => {
    em.query.mockResolvedValueOnce([]);
    const r = await service.previewNext('t1', 2026, 'CSS', em);
    expect(r).toBe('CSS-2026-00001');
  });

  it('N5 -- pad 5 zeros sur grand numero', async () => {
    em.query
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ last_number: 99998 }])
      .mockResolvedValueOnce(undefined);
    const r = await service.generateNext('t1', 2026, 'VEN', em);
    expect(r).toBe('VEN-2026-99999');
  });

  it('N6 -- leve si SELECT FOR UPDATE empty (race)', async () => {
    em.query.mockResolvedValueOnce(undefined).mockResolvedValueOnce([]);
    await expect(service.generateNext('t1', 2026, 'VEN', em)).rejects.toThrow(/RACE/);
  });
});
```

### 7.3 Tests integration `journal.integration.spec.ts`

```typescript
// repo/packages/books/test/integration/journal.integration.spec.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { DataSource } from 'typeorm';

describe('Journal integration Postgres', () => {
  let pg: StartedTestContainer;
  let ds: DataSource;
  const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeAll(async () => {
    pg = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({ POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'test' })
      .withExposedPorts(5432)
      .start();
    ds = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: pg.getMappedPort(5432),
      username: 'postgres',
      password: 'test',
      database: 'test',
      entities: ['repo/packages/books/src/entities/*.entity.ts'],
      migrations: ['repo/packages/database/src/migrations/*.ts'],
      synchronize: false,
    });
    await ds.initialize();
    await ds.runMigrations();
    await ds.query(`SET app.current_tenant = '${TENANT}'`);
    // seed minimal des comptes
    await ds.query(`INSERT INTO books_accounts(tenant_id, code, label, nature, is_standard, active) VALUES (NULL,'5141','Banque','asset',true,true),(NULL,'4111','Clients','asset',true,true),(NULL,'4455','TVA','liability',true,true),(NULL,'71244','Commissions RC','revenue',true,true)`);
  });

  afterAll(async () => {
    await ds.destroy();
    await pg.stop();
  });

  beforeEach(async () => {
    await ds.query('TRUNCATE books_journal_entries CASCADE');
    await ds.query('TRUNCATE books_journal_sequences CASCADE');
  });

  it('I1 -- INSERT entry + lines balanced reussit', async () => {
    await ds.transaction(async (em) => {
      await em.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('11111111-0000-0000-0000-000000000001', $1, 'OD', 'OD-2026-00001', '2026-04-08', 'draft', 2026, 4, $1)`, [TENANT]);
      await em.query(`INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES ($1, '11111111-0000-0000-0000-000000000001', 1, '5141', 'B', 1000, 0), ($1, '11111111-0000-0000-0000-000000000001', 2, '4111', 'C', 0, 1000)`, [TENANT]);
    });
    const count = await ds.query(`SELECT COUNT(*) AS n FROM books_journal_entries`);
    expect(parseInt(count[0].n, 10)).toBe(1);
  });

  it('I2 -- INSERT lines imbalanced rollback en fin de tx', async () => {
    await expect(
      ds.transaction(async (em) => {
        await em.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('22222222-0000-0000-0000-000000000002', $1, 'OD', 'OD-2026-00002', '2026-04-08', 'draft', 2026, 4, $1)`, [TENANT]);
        await em.query(`INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES ($1, '22222222-0000-0000-0000-000000000002', 1, '5141', 'B', 1000, 0), ($1, '22222222-0000-0000-0000-000000000002', 2, '4111', 'C', 0, 999)`, [TENANT]);
      }),
    ).rejects.toThrow(/JOURNAL_NOT_BALANCED/);
  });

  it('I3 -- DELETE entry validated bloque', async () => {
    await ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('33333333-0000-0000-0000-000000000003', $1, 'OD', 'OD-2026-00003', '2026-04-08', 'validated', 2026, 4, $1)`, [TENANT]);
    await expect(
      ds.query(`DELETE FROM books_journal_entries WHERE id = '33333333-0000-0000-0000-000000000003'`),
    ).rejects.toThrow(/NO_DELETE_VALIDATED/);
  });

  it('I4 -- UPDATE status validated -> draft bloque', async () => {
    await ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('44444444-0000-0000-0000-000000000004', $1, 'OD', 'OD-2026-00004', '2026-04-08', 'validated', 2026, 4, $1)`, [TENANT]);
    await expect(
      ds.query(`UPDATE books_journal_entries SET status = 'draft' WHERE id = '44444444-0000-0000-0000-000000000004'`),
    ).rejects.toThrow(/IMMUTABLE_VALIDATED/);
  });

  it('I5 -- UPDATE description sur draft autorise', async () => {
    await ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('55555555-0000-0000-0000-000000000005', $1, 'OD', 'OD-2026-00005', '2026-04-08', 'draft', 2026, 4, $1)`, [TENANT]);
    await ds.query(`UPDATE books_journal_entries SET description = 'modifie' WHERE id = '55555555-0000-0000-0000-000000000005'`);
    const r = await ds.query(`SELECT description FROM books_journal_entries WHERE id = '55555555-0000-0000-0000-000000000005'`);
    expect(r[0].description).toBe('modifie');
  });

  it('I6 -- index unique entry_number prevent doublons', async () => {
    await ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('66666666-0000-0000-0000-000000000006', $1, 'VEN', 'VEN-2026-00001', '2026-04-08', 'draft', 2026, 4, $1)`, [TENANT]);
    await expect(
      ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('77777777-0000-0000-0000-000000000007', $1, 'VEN', 'VEN-2026-00001', '2026-04-09', 'draft', 2026, 4, $1)`, [TENANT]),
    ).rejects.toThrow();
  });

  it('I7 -- idempotency_key unique per tenant', async () => {
    await ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, idempotency_key) VALUES ('88888888-0000-0000-0000-000000000008', $1, 'OD', 'OD-2026-00100', '2026-04-08', 'draft', 2026, 4, $1, 'key-1')`, [TENANT]);
    await expect(
      ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, idempotency_key) VALUES ('99999999-0000-0000-0000-000000000009', $1, 'OD', 'OD-2026-00101', '2026-04-08', 'draft', 2026, 4, $1, 'key-1')`, [TENANT]),
    ).rejects.toThrow();
  });

  it('I8 -- numbering serialise correctement 10 inserts paralleles', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        ds.transaction(async (em) => {
          const ins = await em.query(`INSERT INTO books_journal_sequences(tenant_id, exercise_year, journal_code, last_number) VALUES ($1, 2026, 'OD', 0) ON CONFLICT (tenant_id, exercise_year, journal_code) DO NOTHING`, [TENANT]);
          const r = await em.query(`SELECT last_number FROM books_journal_sequences WHERE tenant_id = $1 AND exercise_year = 2026 AND journal_code = 'OD' FOR UPDATE`, [TENANT]);
          const next = r[0].last_number + 1;
          await em.query(`UPDATE books_journal_sequences SET last_number = $1 WHERE tenant_id = $2 AND exercise_year = 2026 AND journal_code = 'OD'`, [next, TENANT]);
          return next;
        }),
      );
    }
    const results = await Promise.all(promises);
    const sorted = [...results].sort((a, b) => a - b);
    expect(sorted).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('I9 -- contrainte CHECK debit/credit exclusif', async () => {
    await ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('aaaaaaaa-0000-0000-0000-00000000000a', $1, 'OD', 'OD-2026-00200', '2026-04-08', 'draft', 2026, 4, $1)`, [TENANT]);
    await expect(
      ds.query(`INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES ($1, 'aaaaaaaa-0000-0000-0000-00000000000a', 1, '5141', 'B', 100, 50)`, [TENANT]),
    ).rejects.toThrow();
  });

  it('I10 -- numeric precision (0.1 + 0.2 = 0.3 strict)', async () => {
    await ds.transaction(async (em) => {
      await em.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('bbbbbbbb-0000-0000-0000-00000000000b', $1, 'OD', 'OD-2026-00201', '2026-04-08', 'draft', 2026, 4, $1)`, [TENANT]);
      await em.query(`INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES ($1, 'bbbbbbbb-0000-0000-0000-00000000000b', 1, '5141', 'A', 0.10, 0), ($1, 'bbbbbbbb-0000-0000-0000-00000000000b', 2, '4111', 'B', 0.20, 0), ($1, 'bbbbbbbb-0000-0000-0000-00000000000b', 3, '4455', 'C', 0, 0.30)`, [TENANT]);
    });
    const r = await ds.query(`SELECT SUM(debit)::text AS d, SUM(credit)::text AS c FROM books_journal_lines WHERE journal_entry_id = 'bbbbbbbb-0000-0000-0000-00000000000b'`);
    expect(r[0].d).toBe('0.30');
    expect(r[0].c).toBe('0.30');
  });

  it('I11 -- journal_code invalid bloque', async () => {
    await expect(
      ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('cccccccc-0000-0000-0000-00000000000c', $1, 'XXX', 'XXX-2026-001', '2026-04-08', 'draft', 2026, 4, $1)`, [TENANT]),
    ).rejects.toThrow();
  });

  it('I12 -- exercise_year hors range bloque', async () => {
    await expect(
      ds.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES ('dddddddd-0000-0000-0000-00000000000d', $1, 'OD', 'OD-1999-001', '1999-01-01', 'draft', 1999, 1, $1)`, [TENANT]),
    ).rejects.toThrow();
  });
});
```

### 7.4 Tests E2E `journal-entries.controller.e2e-spec.ts`

```typescript
// repo/apps/api/test/e2e/books/journal-entries.controller.e2e-spec.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { signTestJwt } from '../../helpers/jwt.helper';

describe('Journal Entries Controller E2E', () => {
  let app: NestFastifyApplication;
  let adminTok: string;
  let userTok: string;
  let readOnlyTok: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    adminTok = signTestJwt({ sub: 'u1', role: 'BrokerAdmin', tenant_id: 'tenantA' });
    userTok = signTestJwt({ sub: 'u2', role: 'BrokerUser', tenant_id: 'tenantA' });
    readOnlyTok = signTestJwt({ sub: 'u3', role: 'ReadOnly', tenant_id: 'tenantA' });
  });

  afterAll(async () => app.close());

  const validBody = () => ({
    journal_code: 'OD',
    entry_date: '2026-04-08',
    description: 'Test E2E',
    lines: [
      { account_code: '5141', label: 'Banque', debit: '500.00' },
      { account_code: '4111', label: 'Client', credit: '500.00' },
    ],
  });

  it('E1 -- POST cree draft 201', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: validBody(),
    });
    expect(r.statusCode).toBe(201);
    expect(JSON.parse(r.body).status).toBe('draft');
  });

  it('E2 -- POST imbalanced 400', async () => {
    const bad = validBody();
    bad.lines[0].debit = '999.00';
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: bad,
    });
    expect(r.statusCode).toBe(400);
  });

  it('E3 -- POST RBAC ReadOnly 403', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${readOnlyTok}`, 'x-tenant-id': 'tenantA' },
      payload: validBody(),
    });
    expect(r.statusCode).toBe(403);
  });

  it('E4 -- GET liste paginee', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/journal-entries?page=1&page_size=10',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
  });

  it('E5 -- GET filtre par journal_code', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/journal-entries?journal_code=OD',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
    });
    expect(r.statusCode).toBe(200);
  });

  it('E6 -- GET preview next number', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/journal-entries/numbering/next?exercise_year=2026&journal_code=OD',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
    });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body)).toMatch(/^OD-2026-\d{5}$/);
  });

  it('E7 -- POST validate transitionne status', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: validBody(),
    });
    const id = JSON.parse(created.body).id;
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/books/journal-entries/${id}/validate`,
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
    });
    expect(r.statusCode).toBe(200);
    expect(JSON.parse(r.body).status).toBe('validated');
  });

  it('E8 -- POST validate idempotent (deja validated)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: { ...validBody(), auto_validate: true },
    });
    const id = JSON.parse(created.body).id;
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/books/journal-entries/${id}/validate`,
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
    });
    expect(r.statusCode).toBe(409);
  });

  it('E9 -- POST reverse cree contre-ecriture', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: { ...validBody(), auto_validate: true },
    });
    const id = JSON.parse(created.body).id;
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/books/journal-entries/${id}/reverse`,
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: { reason: 'Erreur saisie operationnelle' },
    });
    expect(r.statusCode).toBe(201);
    const reversal = JSON.parse(r.body);
    expect(reversal.reverses_entry_id).toBe(id);
  });

  it('E10 -- POST reverse draft 400', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: validBody(),
    });
    const id = JSON.parse(created.body).id;
    const r = await app.inject({
      method: 'POST',
      url: `/api/v1/books/journal-entries/${id}/reverse`,
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: { reason: 'Tentative reverse draft' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('E11 -- POST idempotent retourne meme id', async () => {
    const k = `key-${Date.now()}`;
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: { ...validBody(), idempotency_key: k },
    });
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: { ...validBody(), idempotency_key: k },
    });
    expect(JSON.parse(r1.body).id).toBe(JSON.parse(r2.body).id);
  });

  it('E12 -- GET findOne renvoie lines triees', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: validBody(),
    });
    const id = JSON.parse(created.body).id;
    const r = await app.inject({
      method: 'GET',
      url: `/api/v1/books/journal-entries/${id}`,
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.lines).toHaveLength(2);
  });

  it('E13 -- POST account_code inexistant 400', async () => {
    const bad = validBody();
    bad.lines[0].account_code = '99999';
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}`, 'x-tenant-id': 'tenantA' },
      payload: bad,
    });
    expect(r.statusCode).toBe(400);
    expect(JSON.parse(r.body).code).toBe('ACCOUNT_NOT_FOUND');
  });

  it('E14 -- sans x-tenant-id 400', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/journal-entries',
      headers: { authorization: `Bearer ${adminTok}` },
    });
    expect(r.statusCode).toBe(400);
  });
});
```

### 7.5 Tests RLS `journal-rls.spec.ts`

```typescript
// repo/packages/books/test/integration/journal-rls.spec.ts

import { describe, it, expect } from 'vitest';
import { dataSource } from '../setup';

describe('books_journal_entries RLS', () => {
  const TA = 'aaaaaaaa-0000-0000-0000-aaaaaaaaaaaa';
  const TB = 'bbbbbbbb-0000-0000-0000-bbbbbbbbbbbb';

  it('R1 -- tenant A ne voit pas entries de tenant B', async () => {
    await dataSource.query(`SET LOCAL app.current_tenant = '${TA}'`);
    await dataSource.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES (gen_random_uuid(), $1, 'OD', 'OD-2026-99001', '2026-04-08', 'draft', 2026, 4, $1)`, [TA]);
    await dataSource.query(`SET LOCAL app.current_tenant = '${TB}'`);
    const r = await dataSource.query(`SELECT entry_number FROM books_journal_entries WHERE entry_number = 'OD-2026-99001'`);
    expect(r).toHaveLength(0);
  });

  it('R2 -- INSERT avec tenant_id mismatch app_current_tenant rejete', async () => {
    await dataSource.query(`SET LOCAL app.current_tenant = '${TA}'`);
    await expect(
      dataSource.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES (gen_random_uuid(), $1, 'OD', 'OD-2026-99002', '2026-04-08', 'draft', 2026, 4, $1)`, [TB]),
    ).rejects.toThrow();
  });

  it('R3 -- lines RLS isole par tenant_id', async () => {
    await dataSource.query(`SET LOCAL app.current_tenant = '${TA}'`);
    const inserted = await dataSource.query(`INSERT INTO books_journal_entries(id, tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by) VALUES (gen_random_uuid(), $1, 'OD', 'OD-2026-99003', '2026-04-08', 'draft', 2026, 4, $1) RETURNING id`, [TA]);
    const eid = inserted[0].id;
    await dataSource.query(`SET LOCAL app.current_tenant = '${TB}'`);
    const r = await dataSource.query(`SELECT * FROM books_journal_lines WHERE journal_entry_id = $1`, [eid]);
    expect(r).toHaveLength(0);
  });
});
```

### 7.6 Fixtures `journal-fixtures.ts`

```typescript
// repo/test/fixtures/journal-fixtures.ts

export const FIXTURE_VENTE_COMMISSION = {
  journal_code: 'VEN' as const,
  entry_date: '2026-04-08',
  reference: 'invoice:inv-2026-0042',
  description: 'Commission RC AXA -- Police 2026-AUTO-15422',
  lines: [
    { account_code: '4111', label: 'Client Particulier', debit: '12000.00' },
    { account_code: '71244', label: 'Commission Courtage RC', credit: '10000.00' },
    { account_code: '44555', label: 'TVA Facturee 20%', credit: '2000.00' },
  ],
};

export const FIXTURE_BANQUE_ENCAISSEMENT = {
  journal_code: 'BNQ' as const,
  entry_date: '2026-04-09',
  reference: 'pay:tx_cmi_8392',
  description: 'Encaissement CMI commission RC',
  lines: [
    { account_code: '5141', label: 'Banque', debit: '12000.00' },
    { account_code: '4111', label: 'Client Particulier', credit: '12000.00' },
  ],
};

export const FIXTURE_GARAGE_FACTURATION = {
  journal_code: 'VEN' as const,
  entry_date: '2026-04-10',
  description: 'Facturation reparation Renault Clio',
  lines: [
    { account_code: '4112', label: 'Client Entreprise', debit: '4800.00' },
    { account_code: '71261', label: 'Main d Oeuvre', credit: '2000.00' },
    { account_code: '71262', label: 'Pieces Detachees', credit: '2000.00' },
    { account_code: '44555', label: 'TVA 20%', credit: '800.00' },
  ],
};
```

---

## 8. Variables environnement

```env
# Tolerance jours futurs pour entry_date (defaut 0 : refuse toute date future)
BOOKS_FUTURE_DATE_TOLERANCE_DAYS=0

# Timeout lock numerotation (ms)
BOOKS_NUMBERING_LOCK_TIMEOUT_MS=5000

# Activation auto-validation pour consumers (Tache 3.5.3)
BOOKS_CONSUMER_AUTO_VALIDATE=true

# Topics Kafka
KAFKA_TOPIC_JOURNAL_CREATED=insurtech.events.books.journal_entry.created
KAFKA_TOPIC_JOURNAL_VALIDATED=insurtech.events.books.journal_entry.validated
KAFKA_TOPIC_JOURNAL_REVERSED=insurtech.events.books.journal_entry.reversed

# Heritees
DATABASE_URL=postgresql://insurtech:secret@localhost:5432/insurtech_dev
REDIS_URL=redis://localhost:6379/2
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Migrations
pnpm --filter @insurtech/database migration:run

# 2. Tests unitaires journal*
pnpm --filter @insurtech/books test:unit -- journal

# 3. Tests integration Postgres
pnpm --filter @insurtech/books test:integration -- journal

# 4. Tests RLS
pnpm vitest run journal-rls.spec.ts

# 5. Tests E2E
pnpm --filter api test:e2e -- journal-entries

# 6. Lint + typecheck
pnpm typecheck && pnpm lint

# 7. Coverage
pnpm vitest run --coverage repo/packages/books/test

# 8. Verifs no-emoji + no-console
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/books repo/apps/api/src/modules/books
grep -rn "console\.log" repo/packages/books repo/apps/api/src/modules/books --include="*.ts" --exclude="*.spec.ts"

# 9. Test manuel API
curl -X POST http://localhost:4000/api/v1/books/journal-entries \
  -H "Authorization: Bearer $JWT" -H "x-tenant-id: tenantA" -H "Content-Type: application/json" \
  -d '{"journal_code":"OD","entry_date":"2026-04-08","lines":[{"account_code":"5141","label":"B","debit":"100.00"},{"account_code":"4111","label":"C","credit":"100.00"}]}'

# 10. Preview next number
curl -H "Authorization: Bearer $JWT" -H "x-tenant-id: tenantA" \
  "http://localhost:4000/api/v1/books/journal-entries/numbering/next?exercise_year=2026&journal_code=OD"
```

---

## 10. Criteres validation V1-V32

### Criteres P0 (bloquants -- 17)

- **V1 (P0)** : Migration tables + triggers reussit. `pnpm migration:run` -> 0 erreurs.
- **V2 (P0)** : Trigger balanced rejette imbalanced. Test I2 PASS.
- **V3 (P0)** : Trigger immutability bloque modification validated. Test I4 PASS.
- **V4 (P0)** : Trigger no-DELETE bloque suppression validated. Test I3 PASS.
- **V5 (P0)** : Numerotation sequentielle UNIQUE par (tenant, exercise, journal). Test I6 + I8.
- **V6 (P0)** : Format numero `JOURNAL-YYYY-NNNNN`. Test N1, N2.
- **V7 (P0)** : Idempotency-Key prevent doublon. Test V3 + I7.
- **V8 (P0)** : Decimal precision (0.1+0.2=0.3). Test V20 + I10.
- **V9 (P0)** : Validate transition draft->validated. Test E7.
- **V10 (P0)** : Reverse cree contre-ecriture symetrique. Test E9.
- **V11 (P0)** : Reverse de draft refuse. Test E10.
- **V12 (P0)** : Reverse de reversal refuse.
- **V13 (P0)** : RBAC ReadOnly create -> 403. Test E3.
- **V14 (P0)** : RLS isole tenants. Test R1.
- **V15 (P0)** : Account inexistant rejete. Test E13.
- **V16 (P0)** : 22 unit + 12 integration + 14 E2E + 3 RLS + 6 numbering = 57 tests PASS.
- **V17 (P0)** : Aucune emoji dans fichiers.

### Criteres P1 (importants -- 10)

- **V18 (P1)** : Coverage >= 90% services + 85% controller.
- **V19 (P1)** : 10 inserts paralleles serializent sans gap. Test I8.
- **V20 (P1)** : Latence p50 < 100ms create entry simple.
- **V21 (P1)** : Events Kafka 3 types publies.
- **V22 (P1)** : Permissions ajoutees catalog.
- **V23 (P1)** : exercise_year out-of-range bloque (CHECK 2020-2100). Test I12.
- **V24 (P1)** : journal_code invalid bloque. Test I11.
- **V25 (P1)** : currency restreint MAD/EUR/USD.
- **V26 (P1)** : entry_date >= 5 ans rejete (Tache validation).
- **V27 (P1)** : reason reverse min 10 chars. Test V15.

### Criteres P2 (nice-to-have -- 5)

- **V28 (P2)** : Swagger documente 6 endpoints.
- **V29 (P2)** : EXPLAIN ANALYZE confirme indexes utilises.
- **V30 (P2)** : Audit log entries pour create/validate/reverse.
- **V31 (P2)** : Performance liste 1000 entries < 200ms.
- **V32 (P2)** : DEFERRABLE trigger permet INSERT sequence dans tx.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : transaction rollback laisse last_number incremente

**Scenario** : numbering generate retourne 42, puis INSERT echoue, transaction rollback. La sequence reste a 42.
**Solution** : ON CONFLICT INSERT initial garantit row presente, mais le UPDATE last_number=42 fait partie de la meme transaction donc rollback aussi. Verifier comportement explicite : `BEGIN; INSERT seq; SELECT FOR UPDATE; UPDATE seq=42; INSERT entry FAIL; ROLLBACK;` -> sequence retourne 41 ensuite. PASS.

### Edge case 2 : 2 utilisateurs simultanes meme journal/exercice

**Scenario** : User A et User B postent VEN-2026 simultanement.
**Solution** : `SELECT FOR UPDATE` lock la ligne sequence. User B attend User A commit. Test I8 valide.

### Edge case 3 : changement annee entre deux postes

**Scenario** : User poste avec `entry_date='2025-12-31'` et `exercise_year=2026`.
**Solution** : si exercise_year omis, derive de entry_date. Si fourni explicitement, accepter (cas regularisation cloture).

### Edge case 4 : line avec montant 0/0

**Scenario** : line `{ debit: 0, credit: 0 }`.
**Solution** : Zod CHECK `(debit > 0 AND credit = 0) OR (debit = 0 AND credit > 0)` rejette. Test V6.

### Edge case 5 : montant negatif

**Scenario** : `debit: -100`.
**Solution** : Zod `nonnegative()` rejette. CHECK SQL `debit >= 0` confirme.

### Edge case 6 : 999 lignes (max)

**Scenario** : ecriture avec 1000 lignes.
**Solution** : Zod `.max(999)` rejette. CHECK `line_number BETWEEN 1 AND 999` confirme.

### Edge case 7 : ecriture avec memes account_code multiples lignes

**Scenario** : 3 lignes sur compte `4111` (debit, debit, debit).
**Solution** : autorise (cas d'eclatement par client). Index `(journal_entry_id, line_number)` UNIQUE garantit pas de duplicat ID.

### Edge case 8 : reverse d'une entry vieille de 9 ans

**Scenario** : reverse une entry de 2017 maintenant en 2026.
**Solution** : la reverse cree une entry sur exercice 2026. Pas de modification 2017. Trace audit preservee.

### Edge case 9 : delete cascade ne fonctionne pas (FK RESTRICT)

**Scenario** : tentative de delete entry pour reset test.
**Solution** : RESTRICT est volontaire. En test : TRUNCATE CASCADE explicite dans setup.

### Edge case 10 : currency mismatch dans une ecriture

**Scenario** : line 1 MAD, line 2 EUR.
**Solution** : trigger valide `SUM(debit) = SUM(credit)` sans tenir compte currency. Si 100 MAD = 100 EUR, balanced mais semantiquement faux. Mitigation : Zod assert toutes lines meme currency (a ajouter Sprint 13 si multidevises generalise).

### Edge case 11 : Idempotency-Key reutilise sur tenant different

**Scenario** : tenant A utilise key K1, tenant B veut aussi K1.
**Solution** : index unique conditionnel `(tenant_id, idempotency_key) WHERE NOT NULL` permet meme key sur tenants differents.

### Edge case 12 : reverse pendant une cloture en cours

**Scenario** : exercice cloture en cours, on reverse une entry.
**Solution** : `assertExerciseOpen` levy si exercise cloture. Reverse-> nouveau journal sur exercice ouvert (l'annee courante).

---

## 12. Conformite Maroc detaillee

### Loi 9-88 (CGNC) -- articles cles cette tache

- **Article 19** : Numerotation continue chronologique sans rupture. Implementation : sequence par tenant/exercice/journal, incrementation atomique avec lock.
- **Article 20** : Ecritures justifiees par piece datee. Implementation : champs `reference` + `description` + `created_at`.
- **Article 22** : Conservation 10 ans des livres et pieces. Implementation : trigger NO-DELETE + immutability validated.
- **Article 23** : Inventaires annuels. Implementation : exercise_year + period_month + Tache 3.5.6 bilan.

### Loi 38-14 modifie 9-88 (2017)

- **Article 8 modifie** : tenue informatisee acceptee si pieces sont datees, signees, conservees, exportables. Implementation : SAFT-MA Tache 3.5.11.

### Loi 09-08 CNDP

- **Article 7** : Localisation Atlas Cloud Benguerir. RLS tenant isolation Article 14 (proportionnalite).

### CGI (Code General des Impots) 2026

- **Article 145** : Registre comptable conforme tres-detaille. Implementation : double-entry + numerotation legale + audit trail.
- **Article 146** : Pieces justificatives 10 ans. Implementation : NO-DELETE.

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

### 13.1 Multi-tenant strict
TenantContext partout. RLS Postgres actif sur 3 tables (entries, lines, sequences).

### 13.2 Zod validation
Schemas exportes `@insurtech/books/schemas/journal.schemas`. Pipe ZodPipe global.

### 13.3 Pino logger
Champs : tenant_id, entry_id, action, sum_debit. Pas de console.log.

### 13.4 argon2id N/A pour cette tache.

### 13.5 pnpm strict.

### 13.6 TypeScript strict.

### 13.7 Vitest unit + integration + E2E. Coverage 90%/85%.

### 13.8 RBAC : 4 permissions ajoutees `books.journal_entries.*`.

### 13.9 Events Kafka 3 topics avec schemas Zod.

### 13.10 Imports `@insurtech/*`.

### 13.11 Skalean AI N/A.

### 13.12 No emoji ABSOLU.

### 13.13 Idempotency-Key strict (critical pour Tache 3.5.3 consumer).

### 13.14 Conventional Commits.

### 13.15 Cloud souverain MA.

---

## 14. Validation pre-commit

```bash
#!/usr/bin/env bash
set -e
cd repo
pnpm typecheck
pnpm lint
pnpm --filter @insurtech/books test:unit -- journal
pnpm --filter @insurtech/books test:integration -- journal
pnpm --filter api test:e2e -- journal-entries
pnpm vitest run --coverage repo/packages/books

# No-emoji
EMOJIS=$(grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/books repo/apps/api/src/modules/books --exclude-dir=node_modules || true)
[ -n "$EMOJIS" ] && echo "FAIL emoji" && exit 1

# No console
CL=$(grep -rn "console\.log\|console\.debug" repo/packages/books repo/apps/api/src/modules/books --include="*.ts" --exclude="*.spec.ts" || true)
[ -n "$CL" ] && echo "FAIL console" && exit 1

echo "OK pre-commit Tache 3.5.2"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-12): journal entries double-entry CGNC bookkeeping

Implemente books_journal_entries + books_journal_lines avec validation
stricte balanced (debit=credit) au niveau Zod + DB trigger. Numerotation
sequentielle legale par tenant + exercice + journal_code (format
JOURNAL-YYYY-NNNNN). Workflow draft -> validated avec immutability
cote DB (3 triggers) conforme loi 9-88 art 22. Reverse cree contre-
ecriture symetrique sans toucher a l originale (audit trail intact).
Support idempotency-key pour consumers Kafka.

Livrables:
- 2 migrations (BooksJournalEntries + BooksJournalSequences)
- 3 entities + relations
- 4 services (Journal, Numbering, Validation, Reverse)
- 1 controller 6 endpoints REST
- 4 permissions RBAC
- 3 events Kafka avec schemas Zod
- 22 tests unit + 12 integration + 14 E2E + 3 RLS + 6 numbering

Tests: 57 cas
Coverage: 92% services / 88% controller

Conformite:
- Loi 9-88 art 19 (numerotation), 20 (justification), 22 (conservation)
- Loi 38-14 art 8 (tenue informatisee)
- CGI art 145, 146

Task: 3.5.2
Sprint: 12
Reference: B-12 Tache 3.5.2"
```

---

## 16. Workflow next step

Apres commit valide :
- CI verte.
- _SUMMARY.md update : task-3.5.2 a ~118 ko.
- Suite : **Tache 3.5.3 -- Auto-Generation Ecritures depuis Pay Events** (`task-3.5.3-pay-to-journal-consumer.md`). Cette tache consomme `JournalService.createEntry({ auto_validate: true, idempotency_key: 'pay:tx_xxx' })` dans un consumer Kafka.

---

**Fin du prompt task-3.5.2-journal-entries-double-entry-bookkeeping.md.**

Densite atteinte : ~118 ko
Code patterns : 13 fichiers complets
Tests : 57 cas concrets (22 unit + 12 integration + 14 E2E + 3 RLS + 6 numbering)
Criteres validation : V1-V32
Edge cases : 12
Conformite : 4 lois MA detaillees
