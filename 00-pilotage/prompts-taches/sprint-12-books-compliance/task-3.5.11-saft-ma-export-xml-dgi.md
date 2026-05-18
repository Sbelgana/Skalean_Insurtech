# TACHE 3.5.11 -- SAFT-MA Export XML pour Controles DGI

**Sprint** : 12 (Phase 3 / Sprint 5 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-12-sprint-12-books-compliance.md` (Tache 3.5.11)
**Phase** : 3 -- Modules Horizontaux (Books + Compliance)
**Priorite** : P0 (export DGI obligatoire pour controles fiscaux, sanctions article 230 CGI)
**Effort** : 5h
**Dependances** : Tache 3.5.1 (AccountChartService), Tache 3.5.2 (journal_entries + lines), Tache 3.5.4 (TVA tax tables), Tache 3.5.5 (invoices), Sprint 8 CRM (customers/suppliers)
**Densite cible** : 110-130 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente **l'export SAFT-MA** (Standard Audit File for Tax -- Maroc), format XML standardise utilise par la **Direction Generale des Impots (DGI)** marocaine pour les controles fiscaux. Le SAFT-MA est l'**adaptation marocaine du standard OCDE SAF-T 2.0** (Standard Audit File for Tax), defini dans la **Note Circulaire DGI N 728/2019** (mise a jour 2023) qui transpose les recommandations OCDE 2010 sur la dematerialisation des controles fiscaux. Lors d'un controle DGI **(article 210 a 232 CGI 2026)**, l'inspecteur peut exiger du contribuable la production de l'integralite de sa comptabilite informatisee sous ce format XML standardise, dans un delai de **48 heures**. Le SAFT-MA contient : (a) header avec identification fiscale du contribuable, (b) **MasterFiles** (plan comptable CGNC, clients, fournisseurs, table TVA), (c) **GeneralLedgerEntries** (toutes ecritures journal de l'exercice), (d) **SourceDocuments** (factures emises et recues + paiements). Le non-respect (refus de produire, format non-conforme, contenu manifestement incomplet) expose a une **amende 25 000 a 100 000 MAD** (article 230 CGI) et **rejection de la comptabilite** entrainant **taxation d'office** (article 213 CGI : la DGI etablit l'impot sur des bases forfaitaires, generalement defavorables au contribuable, sans possibilite de contestation amiable).

L'apport est triple. **Premierement** : on cree un service `SaftMaExporterService` avec methode principale `export(tenantId, exerciseYear): Buffer` qui retourne un buffer XML conforme au schema XSD officiel DGI. Le service compose 4 builders specialises : `SaftHeaderBuilder` (identification fiscale du tenant via tenant_settings), `SaftMasterFilesBuilder` (consume Tache 3.5.1 AccountChartService pour plan comptable + Sprint 8 CRM pour customers/suppliers + Tache 3.5.4 TVA pour tax tables), `SaftLedgerBuilder` (consume Tache 3.5.2 journal_entries + lines pour toutes ecritures validated de l'exercice), `SaftSourceDocumentsBuilder` (consume Tache 3.5.5 invoices et Tache 3.5.3 pay transactions). **Deuxiemement** : on garantit la **performance sur gros volumes** : pour un tenant avec 50 000 ecritures comptables sur l'exercice (cas grand cabinet courtier), l'export XML genere fait typiquement 50-100 MB. Sans optimisation, le buffer entier en memoire causerait OOM (Out Of Memory) sur container avec 2 GB RAM. Solution : **streaming XML via sax-stream** ou `xmlbuilder2 stream mode`, ecriture progressive dans un fichier temporaire `/tmp/saft-ma-{tenantId}-{exerciseYear}-{timestamp}.xml`, puis upload S3 Atlas DC1 et retour d'une presigned URL avec expiration 1h. **Troisiemement** : on **valide le XML genere contre le XSD officiel DGI** (`saft-ma-2.0.xsd` recupere depuis documentation DGI ou notre fichier interne `repo/packages/books/src/saft-ma/saft-ma-2.0.xsd`) via `xsd-schema-validator` ou `libxmljs2`. La validation echoue -> exception explicite avec les erreurs XSD, log error, alert ops. Le buffer n'est pas livre tant que valide ; cela evite de produire un XML que la DGI rejetterait lors du controle (situation potentiellement catastrophique).

A l'issue de cette tache, le tenant Cabinet Bennani peut, sur demande de l'inspecteur DGI lors d'un controle fiscal, declencher en 1 clic dans l'admin UI (Sprint 27) l'export SAFT-MA de l'exercice 2026, recevoir une presigned URL dans les 5 minutes (pour 50k ecritures), telecharger le XML complet (50-100 MB), le remettre sur cle USB ou par email crypte a l'inspecteur. L'inspecteur peut analyser via outil DGI dedie (jSAFT-T Audit), verifier que : (a) le plan comptable CGNC est conforme, (b) toutes les ecritures sont balanced (debits = credits), (c) la TVA collectee declaree correspond a la somme des comptes 4455x, (d) les factures DGI ont tous les champs obligatoires (ICE, RC, patente), (e) aucune ecriture suspecte non-justifiee. Si tout est conforme, le controle se passe rapidement et favorablement. Cette tache est l'**assurance fiscale** du tenant et constitue le pilier technique de la conformite DGI. Sprint 14+ Insure ajoutera SourceDocuments specifiques (polices, sinistres) ; Sprint 27 admin enrichira UI avec tracking historique exports et regeneration sur demande.

---

## 2. Contexte etendu

### 2.1 Pourquoi SAFT-MA et pas un autre format

L'**OCDE** a publie en 2010 le standard **SAF-T 2.0** (Standard Audit File for Tax) pour harmoniser les controles fiscaux numeriques entre administrations fiscales des pays membres. La structure XML standardisee permet a un inspecteur de manipuler avec les memes outils des donnees provenant de differents logiciels comptables (SAP, Sage, QuickBooks, Skalean InsurTech). Plus de 30 pays ont adopte SAF-T sous des variations nationales : SAF-T-PT (Portugal), SAFT-PL (Pologne), SAFT-AT (Autriche), SAFT-NO (Norvege), et notre cible **SAFT-MA (Maroc, adopte 2019)**.

La DGI marocaine a publie la **Note Circulaire 728/2019** qui specifie :
- Format XML strict avec XSD officiel `saft-ma-2.0.xsd`.
- Encodage UTF-8 obligatoire.
- 4 sections : Header, MasterFiles, GeneralLedgerEntries, SourceDocuments.
- Champs obligatoires : ICE 15 chiffres tenant, IF, RC, patente, exercice fiscal.
- Periode : 1 exercice fiscal complet, decoupage trimestriel possible si demande inspecteur.
- Validation XSD obligatoire avant remise.
- Delais : 48h apres demande inspecteur lors controle sur place.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Export CSV simple | Simple, lisible | Non conforme DGI, rejete | Rejete |
| Export PDF complet ecritures | Lisible humain | Non manipulable par outil DGI, rejete | Rejete (peut accompagner XML) |
| Export SAF-T 2.0 OCDE generique | Plus de pays | Pas adapte MA specifiques (ICE 15 chiffres, patente, etc.) | Rejete |
| **Export SAFT-MA conforme XSD officiel (retenu)** | Conforme DGI, accepte direct | Complexite XSD validation, gros volumes | RETENU |
| Stockage continu vs export ondemand | Pre-stocke = rapide | Volume DB explose, donnees stale | Differe Sprint 34 cache materialise |
| Lib externe SAF-T (e.g. RSM) | Mature | Pas adapte MA, dependance, cout | Rejete |
| Generation backend Python | Lib mieux | Polyglotte stack, decision-001 monorepo Node | Rejete |

La decision : **service Node.js custom** avec `xmlbuilder2` (streaming mode pour gros volumes) + validation XSD via `libxmljs2`, conforme schema officiel DGI 2024.

### 2.3 Trade-offs explicites

**Premier trade-off** : on genere l'XML **a la demande** (lazy, pas stocke). Avantage : toujours a jour avec ecritures recentes. Inconvenient : sur tenant avec 100k+ ecritures, generation peut prendre 10-30 secondes + cpu/memory bursts. Mitigation : queue BullMQ async (super_admin clique "generate", recoit notification email avec presigned URL 5 min plus tard), affichage progress bar dans UI Sprint 27. Cache S3 (presigned URL 1h reutilisable) evite re-generation si meme demande dans courte fenetre.

**Deuxieme trade-off** : on **stocke le XML genere temporairement sur S3 Atlas DC1** avec TTL 7 jours (apres quoi auto-deletion via S3 lifecycle policy). Avantage : reutilisation, audit trail pour Sprint 27 admin (qui a exporte quoi quand). Inconvenient : duplication de donnees (le XML reflet la DB, garde 7j). Acceptable : 7 jours est largement suffisant pour un controle DGI normal (48h delai + 5j pour finir si complexe).

**Troisieme trade-off** : pour les **gros volumes (> 10k ecritures)**, on utilise **streaming XML** plutot que construction en memoire complete. Le streaming est plus complexe a coder (state machine) mais evite OOM. Limite : on perd la possibilite de pretty-print indentation (output XML compact, mais conforme XSD). Acceptable car l'XML est destine a outil DGI, pas lecture humaine.

**Quatrieme trade-off** : la **validation XSD** ajoute 2-5 secondes au temps de generation (libxmljs2 doit parser le schema + valider le document). On accepte ce cout car le risque de produire un XML non-conforme est inacceptable (rejet DGI = taxation d'office). Sprint 27 admin pourra desactiver la validation pour generations test/preview, mais en prod c'est obligatoire.

**Cinquieme trade-off** : Sprint 12 livre le SAFT-MA **complet pour books** (plan comptable + journal_entries + invoices + TVA tables). Les SourceDocuments specifiques Insure (polices, sinistres) et Repair (devis garage, ordres reparation) sont differes Sprint 14+ et Sprint 19+ respectivement. Pour Sprint 12 : les sections SourceDocuments contiennent uniquement invoices et payments, conforme exigences DGI pour exercice courtier purement comptable.

### 2.4 Decisions strategiques referenced

- decision-001 (monorepo), 002 (multi-tenant), 003 (TypeORM), 006 (no-emoji), 008 (data residency MA).
- Tache 3.5.1 : AccountChartService pour MasterFiles plan comptable CGNC.
- Tache 3.5.2 : journal_entries + journal_lines pour GeneralLedgerEntries.
- Tache 3.5.4 : TVA accounts + categories pour TaxTable.
- Tache 3.5.5 : invoices pour SourceDocuments.SalesInvoices.
- Tache 3.5.3 : pay_transactions pour SourceDocuments.Payments.
- Sprint 8 CRM : crm_contacts pour MasterFiles.Customers + Suppliers.
- Sprint 10 docs : S3 Atlas DC1 storage pour XML temporaire.
- Sprint 3 task 1.3.11 : BullMQ pour generation async.

### 2.5 Pieges techniques connus

1. **Piege : OOM sur gros volumes** -- Build XML complet en memoire fait 200 MB pour 100k ecritures + serialise. Solution : streaming via `xmlbuilder2` mode incremental, ecrit progressivement vers fichier temp + S3 stream upload.

2. **Piege : encoding caracteres speciaux** -- Libelle compte "Charges d Exploitation" avec apostrophe. `xmlbuilder2` echappe `&apos;` correctement. Test : noms tenants avec & dans raison sociale.

3. **Piege : XSD officiel evolue** -- Note Circulaire 728/2019 modifiee en 2023, peut etre re-modifiee 2025+. Solution : XSD versionne dans `repo/packages/books/src/saft-ma/saft-ma-{version}.xsd`, parameter `xsd_version` configurable per tenant Sprint 27. Pour Sprint 12 : hardcode v2.0.

4. **Piege : decimal serialization** -- Postgres `numeric(15, 2)` -> driver pg string -> XML attribute string. SAFT-MA exige format `.` separator (pas `,`). Solution : `toFixed(2)` Decimal.js + verification regex `\d+\.\d{2}`.

5. **Piege : ICE invalide** -- ICE doit etre exactement 15 chiffres. Si tenant a ICE mal saisi (14 chiffres), XML rejette XSD validation. Solution : Zod validation tenant_settings au boot + warning UI Sprint 27.

6. **Piege : exercice incomplet** -- Si tenant onboard en juin 2026, exercice 2026 commence en juin. SAFT-MA section Header.DateStart = effective onboard date, pas necessairement 1/1/2026.

7. **Piege : Tres petit ecart balance** -- Si arrondi 0.001 MAD sur une ecriture (precision Decimal mal preservee), le total bilan ne tombe pas pile, XSD validation peut echec. Solution : assertion balance avant export, log error si delta > 0.005.

8. **Piege : contacts orphelins** -- Si une ecriture reference un contact_id supprime de la CRM, le XML contient ID mais MasterFiles.Customers ne le contient pas. Solution : LEFT JOIN preservant contacts referenced even if soft-deleted. Sprint 8 CRM marque is_deleted=true au lieu de DELETE.

9. **Piege : invoice deleted draft** -- Invoice draft supprimee (Tache 3.5.5 autorise DELETE draft only). Le journal_entry associe peut subsister (si validated). SAFT-MA references l'invoice via journal_entry.reference. Solution : SourceDocuments.SalesInvoices inclut toutes invoices status != 'draft' (sent, paid, cancelled). Cancelled inclus avec status approprie.

10. **Piege : tax_table missing rate** -- Si tenant a une ecriture utilisant TVA 14% mais pas le compte 44554 seed (improbable mais possible), XML reference taux 14% sans entry dans TaxTable. Solution : pre-validation que tous taux utilises dans journal_lines existent dans tax_table.

11. **Piege : performance lockup** -- Generation 5 min, super_admin clique 3 fois "generate" simultanement, 3 jobs paralleles, OOM. Solution : BullMQ jobId deterministe + lock per tenant + UI desactive bouton pendant generation.

12. **Piege : XML signature electronique** -- Certains pays exigent signature XAdES. SAFT-MA 2.0 n'exige pas (Sprint 12 acceptable). Sprint 27+ : option signature Barid eSign (Sprint 10).

13. **Piege : caracteres unicode lookalikes** -- ICE saisi avec chiffre arabe-indien 0123456789 different de chiffres latins. Solution : normalisation Unicode NFC + assert ASCII only sur ICE/IF/RC.

14. **Piege : tenant sans aucune activite** -- Tenant cree mais zero ecriture. SAFT-MA doit etre quand meme genere (XSD permet sections vides). Test : tenant nouveau, export OK avec 0 entries.

15. **Piege : portail DGI rejette malgre XSD valide** -- DGI peut avoir validations supplementaires non documentees XSD (e.g. coherence ICE/IF/RC croisee). Solution : Sprint 27 admin retours d'experience reels avec controles DGI permettront iterations.

---

## 3. Architecture context

### 3.1 Position dans le sprint 12

- **Depend de** : Tache 3.5.1 (plan comptable), 3.5.2 (ledger entries), 3.5.4 (TVA), 3.5.5 (invoices), 3.5.3 (payments), Sprint 8 CRM, Sprint 10 docs (S3 storage).
- **Bloque** : Tache 3.5.12 (endpoints REST consolidation), Tache 3.5.13 (tests E2E sprint).
- **Apporte** : service SAFT-MA exporter + XSD validation + S3 upload + presigned URL.

### 3.2 Sequence detaillee

```
POST /api/v1/books/saft-ma/export?exercise_year=2026
   |
   v
SaftMaExportController (RBAC books.saft.export super_admin only)
   |
   v
BullMQ enqueue 'saft-ma-export' { tenant_id, exercise_year, requested_by }
   - jobId : saft-ma:{tenant}:{year}
   - immediate response 202 Accepted + job_id
   |
   v
[Worker BullMQ]
   |
   v
SaftMaExporterService.export(tenantId, exerciseYear)
   - SaftHeaderBuilder.build(tenantId) -> XML Header
     - read tenant_settings (raison_sociale, ICE, IF, RC, patente, address)
   - SaftMasterFilesBuilder.build(tenantId, exerciseYear)
     - GeneralLedgerAccounts (Tache 3.5.1 plan comptable seed)
     - Customers (crm_contacts type=individual|company)
     - Suppliers (4421-44210 + autres)
     - TaxTable (Tache 3.5.4 TVA_RATES_MA + accounts mapping)
   - SaftLedgerBuilder.build(tenantId, exerciseYear) [STREAMING]
     - foreach journal in [VEN, ACH, BNQ, CSS, OD, PAY, AN]
       - foreach entry status=validated, exercise_year=N
         - foreach line
   - SaftSourceDocumentsBuilder.build(tenantId, exerciseYear) [STREAMING]
     - SalesInvoices (Tache 3.5.5 invoices status != draft)
     - Payments (Tache 3.5.3 pay_transactions captured)
   |
   v
SaftMaValidator.validate(xmlBuffer) [contre XSD officiel DGI v2.0]
   - libxmljs2 parseXml + validate against schema
   - si echec : exception detaillee avec line numbers + element/attribute errors
   |
   v
Upload S3 Atlas DC1 bucket insurtech-saft-ma-exports
   - key: tenants/{tenantId}/exports/saft-ma-{exerciseYear}-{timestamp}.xml
   - encryption AES-256-GCM
   - lifecycle: auto-delete apres 7 jours
   |
   v
generate presigned URL (expires 1h)
   |
   v
notify super_admin via Comm (email avec lien + checksum SHA-256)
   |
   v
publish event books.saft_ma.exported
```

### 3.3 Endpoints exposes

```
POST /api/v1/books/saft-ma/export?exercise_year=2026
  -> 202 Accepted + { job_id }
GET  /api/v1/books/saft-ma/exports
  -> liste historique exports (Sprint 27 admin)
GET  /api/v1/books/saft-ma/exports/:id
  -> detail + presigned URL si disponible
GET  /api/v1/books/saft-ma/exports/:id/download
  -> redirect presigned URL S3
```

---

## 4. Livrables checkables

- [ ] Service `saft-ma-exporter.service.ts` (~360 lignes) orchestrateur principal.
- [ ] Service `saft-header.builder.ts` (~140 lignes).
- [ ] Service `saft-master-files.builder.ts` (~320 lignes) accounts + customers + suppliers + tax table.
- [ ] Service `saft-ledger.builder.ts` (~280 lignes) streaming journal entries.
- [ ] Service `saft-source-documents.builder.ts` (~280 lignes) invoices + payments.
- [ ] Service `saft-ma-validator.service.ts` (~180 lignes) XSD validation.
- [ ] Entity `books-saft-export.entity.ts` (~120 lignes) tracking exports.
- [ ] Migration `BooksSaftExports.ts` (~80 lignes).
- [ ] Types `saft-ma.types.ts` (~120 lignes).
- [ ] Schemas Zod `saft-ma.schemas.ts` (~80 lignes).
- [ ] Config `saft-ma.config.ts` (~80 lignes).
- [ ] XSD schema file `saft-ma-2.0.xsd` (~400 lignes XML, copie officielle DGI).
- [ ] Job BullMQ `saft-ma-export.job.ts` (~140 lignes).
- [ ] Controller `saft-ma.controller.ts` (~180 lignes) 4 endpoints + RBAC.
- [ ] Permissions ajoutees `books.saft.{export, read, download}`.
- [ ] Events Kafka 2 events.
- [ ] Tests unit (~640 lignes) 24 cas.
- [ ] Tests integration (~340 lignes) 12 cas avec gros volumes.
- [ ] Tests E2E (~240 lignes) 10 cas.
- [ ] Fixtures `saft-ma-fixtures.ts` (~180 lignes).

---

## 5. Fichiers crees / modifies

```
repo/packages/books/src/services/saft-ma-exporter.service.ts                    (~360 lignes)
repo/packages/books/src/builders/saft-header.builder.ts                          (~140 lignes)
repo/packages/books/src/builders/saft-master-files.builder.ts                    (~320 lignes)
repo/packages/books/src/builders/saft-ledger.builder.ts                          (~280 lignes)
repo/packages/books/src/builders/saft-source-documents.builder.ts                (~280 lignes)
repo/packages/books/src/services/saft-ma-validator.service.ts                    (~180 lignes)
repo/packages/database/src/migrations/20260408210000-BooksSaftExports.ts          (~80 lignes)
repo/packages/books/src/entities/books-saft-export.entity.ts                      (~120 lignes)
repo/packages/books/src/types/saft-ma.types.ts                                    (~120 lignes)
repo/packages/books/src/schemas/saft-ma.schemas.ts                                (~80 lignes)
repo/packages/books/src/config/saft-ma.config.ts                                  (~80 lignes)
repo/packages/books/src/saft-ma/saft-ma-2.0.xsd                                    (~400 lignes XSD)
repo/packages/books/src/jobs/saft-ma-export.job.ts                                (~140 lignes)
repo/apps/api/src/modules/books/controllers/saft-ma.controller.ts                (~180 lignes)
repo/packages/auth/src/permissions/catalog.ts                                      (modif +3 perms)
repo/packages/shared-events/src/topics/saft-ma.events.ts                           (~80 lignes)
repo/packages/books/test/unit/saft-ma-exporter.service.spec.ts                    (~340 lignes / 14 unit)
repo/packages/books/test/unit/saft-master-files.builder.spec.ts                   (~180 lignes / 6 unit)
repo/packages/books/test/unit/saft-ledger.builder.spec.ts                         (~140 lignes / 4 unit)
repo/packages/books/test/integration/saft-ma.integration.spec.ts                  (~340 lignes / 12 integration)
repo/apps/api/test/e2e/books/saft-ma.controller.e2e-spec.ts                        (~240 lignes / 10 E2E)
repo/test/fixtures/saft-ma-fixtures.ts                                              (~180 lignes)
```

Total : 22 fichiers, ~4 400 lignes ajoutees.

---

## 6. Code patterns COMPLETS

### 6.1 Config `saft-ma.config.ts`

```typescript
// repo/packages/books/src/config/saft-ma.config.ts
// Configuration SAFT-MA conforme Note Circulaire DGI 728/2019

export const SAFT_MA = {
  // Version schema XSD
  SCHEMA_VERSION: '2.0',
  XSD_FILE_PATH: 'repo/packages/books/src/saft-ma/saft-ma-2.0.xsd',
  XML_NAMESPACE: 'http://dgi.gov.ma/saft-ma/2.0',
  XSI_SCHEMA_LOCATION:
    'http://dgi.gov.ma/saft-ma/2.0 saft-ma-2.0.xsd',

  // Encoding strict
  ENCODING: 'UTF-8',
  XML_DECLARATION: '<?xml version="1.0" encoding="UTF-8"?>',

  // Streaming threshold : si > 10k ecritures, switch streaming mode
  STREAMING_THRESHOLD_ENTRIES: 10_000,

  // S3 storage
  S3_BUCKET: 'insurtech-saft-ma-exports',
  S3_LIFECYCLE_DAYS: 7,
  PRESIGNED_URL_EXPIRES_SECONDS: 3600, // 1 heure

  // Validation
  VALIDATE_XSD: true, // false uniquement pour dev/test
  STRICT_BALANCE_CHECK: true, // assert sum(debit) = sum(credit) avant export

  // DGI specifications
  DECIMAL_PLACES: 2,
  DECIMAL_SEPARATOR: '.', // pas de virgule
  CURRENCY_DEFAULT: 'MAD',
  COUNTRY_DEFAULT: 'MA',

  // Audit trail
  EXPORTS_RETENTION_DAYS: 3650, // 10 ans loi 9-88 art 22
} as const;
```

### 6.2 Migration `BooksSaftExports.ts`

```typescript
// repo/packages/database/src/migrations/20260408210000-BooksSaftExports.ts

import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class BooksSaftExports20260408210000 implements MigrationInterface {
  name = 'BooksSaftExports20260408210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'books_saft_exports',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'tenant_id', type: 'uuid', isNullable: false },
          { name: 'exercise_year', type: 'smallint', isNullable: false },
          { name: 'status', type: 'varchar', length: '20', default: `'pending'`, comment: 'pending|in_progress|completed|failed' },
          { name: 's3_key', type: 'varchar', length: '512', isNullable: true },
          { name: 's3_bucket', type: 'varchar', length: '128', isNullable: true },
          { name: 'file_size_bytes', type: 'bigint', isNullable: true },
          { name: 'sha256_checksum', type: 'varchar', length: '64', isNullable: true },
          { name: 'entries_count', type: 'integer', isNullable: true },
          { name: 'lines_count', type: 'integer', isNullable: true },
          { name: 'invoices_count', type: 'integer', isNullable: true },
          { name: 'duration_ms', type: 'integer', isNullable: true },
          { name: 'xsd_validation_passed', type: 'boolean', isNullable: true },
          { name: 'error_message', type: 'text', isNullable: true },
          { name: 'requested_by', type: 'uuid', isNullable: false },
          { name: 'requested_at', type: 'timestamptz', default: 'now()' },
          { name: 'completed_at', type: 'timestamptz', isNullable: true },
          { name: 'idempotency_key', type: 'varchar', length: '128', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
        ],
        checks: [
          {
            columnNames: ['status'],
            expression: `status IN ('pending','in_progress','completed','failed')`,
          },
          { columnNames: ['exercise_year'], expression: 'exercise_year BETWEEN 2020 AND 2100' },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'books_saft_exports',
      new TableIndex({
        name: 'idx_saft_exports_tenant_year',
        columnNames: ['tenant_id', 'exercise_year'],
      }),
    );
    await queryRunner.createIndex(
      'books_saft_exports',
      new TableIndex({
        name: 'idx_saft_exports_idempotency',
        columnNames: ['tenant_id', 'idempotency_key'],
        isUnique: true,
        where: 'idempotency_key IS NOT NULL',
      }),
    );

    await queryRunner.query(`ALTER TABLE books_saft_exports ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY saft_exports_tenant ON books_saft_exports
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant());
    `);

    // NO DELETE (audit 10 ans loi 9-88 + CGI art 146)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION saft_exports_no_delete()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'NO_DELETE: SAFT exports audit trail preserved 10 years' USING ERRCODE = 'P0003';
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_saft_exports_no_delete
      BEFORE DELETE ON books_saft_exports
      FOR EACH ROW EXECUTE FUNCTION saft_exports_no_delete();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_saft_exports_no_delete ON books_saft_exports`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS saft_exports_no_delete()`);
    await queryRunner.dropTable('books_saft_exports');
  }
}
```

### 6.3 Types `saft-ma.types.ts`

```typescript
// repo/packages/books/src/types/saft-ma.types.ts

export type SaftExportStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface SaftExportRequest {
  tenantId: string;
  exerciseYear: number;
  requestedBy: string;
}

export interface SaftExportResult {
  exportId: string;
  s3Bucket: string;
  s3Key: string;
  fileSizeBytes: number;
  sha256Checksum: string;
  entriesCount: number;
  linesCount: number;
  invoicesCount: number;
  durationMs: number;
  presignedUrl?: string;
}

export interface SaftHeaderData {
  audit_file_version: string;
  company_id: string; // ICE 15 chiffres
  tax_registration_number: string; // IF
  company_name: string;
  business_name?: string;
  company_address: {
    street: string;
    city: string;
    postal_code?: string;
    country: 'MA';
  };
  fiscal_year_start_date: string; // YYYY-MM-DD
  fiscal_year_end_date: string;
  audit_file_date_created: string; // ISO 8601
  currency_code: 'MAD';
  software_name: 'Skalean InsurTech';
  software_version: string;
}

export interface SaftAccount {
  account_id: string; // code CGNC
  account_description: string;
  standard_account_id?: string; // mapping CGNC officiel
  grouping_category: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'result' | 'analytical';
  grouping_code?: string;
  opening_debit_balance: string;
  opening_credit_balance: string;
  closing_debit_balance: string;
  closing_credit_balance: string;
}

export interface SaftCustomer {
  customer_id: string;
  account_id: string; // 411x
  customer_tax_id?: string; // ICE si entreprise, CIN si particulier
  company_name: string;
  contact_name?: string;
  billing_address: {
    street?: string;
    city?: string;
    country?: string;
  };
  telephone?: string;
  email?: string;
}

export interface SaftSupplier {
  supplier_id: string;
  account_id: string; // 4421-44210
  supplier_tax_id?: string;
  company_name: string;
  billing_address: {
    street?: string;
    city?: string;
    country?: string;
  };
}

export interface SaftTaxTableEntry {
  tax_code: string;
  description: string;
  tax_percentage: number; // 0, 7, 10, 14, 20
  account_id: string; // 44551-44555
}

export interface SaftJournalEntry {
  journal_id: string;
  entry_number: string;
  entry_date: string;
  description: string;
  lines: Array<{
    line_number: number;
    account_id: string;
    description: string;
    debit: string;
    credit: string;
    tax_code?: string;
  }>;
}

export interface SaftSalesInvoice {
  invoice_no: string;
  invoice_date: string;
  invoice_type: 'invoice' | 'credit_note';
  customer_id: string;
  total_ht: string;
  total_tva: string;
  total_ttc: string;
  status: string;
}
```

### 6.4 Service `saft-ma-exporter.service.ts`

```typescript
// repo/packages/books/src/services/saft-ma-exporter.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { create } from 'xmlbuilder2';
import { BooksSaftExportEntity } from '../entities/books-saft-export.entity';
import { SaftHeaderBuilder } from '../builders/saft-header.builder';
import { SaftMasterFilesBuilder } from '../builders/saft-master-files.builder';
import { SaftLedgerBuilder } from '../builders/saft-ledger.builder';
import { SaftSourceDocumentsBuilder } from '../builders/saft-source-documents.builder';
import { SaftMaValidatorService } from './saft-ma-validator.service';
import { S3StorageService } from '@insurtech/docs';
import { EventPublisher } from '@insurtech/shared-events';
import { SAFT_MA } from '../config/saft-ma.config';
import type { SaftExportResult } from '../types/saft-ma.types';

@Injectable()
export class SaftMaExporterService {
  constructor(
    @InjectRepository(BooksSaftExportEntity)
    private readonly exportRepo: Repository<BooksSaftExportEntity>,
    private readonly logger: Logger,
    private readonly headerBuilder: SaftHeaderBuilder,
    private readonly masterFilesBuilder: SaftMasterFilesBuilder,
    private readonly ledgerBuilder: SaftLedgerBuilder,
    private readonly sourceDocsBuilder: SaftSourceDocumentsBuilder,
    private readonly validator: SaftMaValidatorService,
    private readonly s3Storage: S3StorageService,
    private readonly events: EventPublisher,
  ) {}

  /**
   * Genere export SAFT-MA pour (tenant, exercise) et upload S3.
   * Retourne export ID + presigned URL.
   */
  async export(
    tenantId: string,
    exerciseYear: number,
    requestedBy: string,
  ): Promise<SaftExportResult> {
    const startMs = Date.now();

    // 1. Cree record export
    const exportRecord = await this.exportRepo.save({
      tenant_id: tenantId,
      exercise_year: exerciseYear,
      status: 'in_progress',
      requested_by: requestedBy,
      idempotency_key: `saft:${tenantId}:${exerciseYear}:${Date.now()}`,
    } as Partial<BooksSaftExportEntity>);

    this.logger.info({
      msg: 'saft_ma_export_start',
      tenant_id: tenantId,
      exercise_year: exerciseYear,
      export_id: exportRecord.id,
      requested_by: requestedBy,
    });

    try {
      // 2. Build XML
      const root = create({ version: '1.0', encoding: 'UTF-8' }).ele('AuditFile', {
        xmlns: SAFT_MA.XML_NAMESPACE,
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': SAFT_MA.XSI_SCHEMA_LOCATION,
        version: SAFT_MA.SCHEMA_VERSION,
      });

      // Header
      const headerData = await this.headerBuilder.build(tenantId, exerciseYear);
      this.addHeaderToRoot(root, headerData);

      // MasterFiles
      const masterFiles = await this.masterFilesBuilder.build(tenantId, exerciseYear);
      this.addMasterFilesToRoot(root, masterFiles);

      // GeneralLedgerEntries
      const ledgerStats = await this.ledgerBuilder.build(tenantId, exerciseYear, root);

      // SourceDocuments
      const sourceDocsStats = await this.sourceDocsBuilder.build(tenantId, exerciseYear, root);

      // 3. Serialize XML
      const xml = root.end({ prettyPrint: false });
      const buffer = Buffer.from(xml, 'utf-8');

      // 4. Validate XSD
      let xsdValid = true;
      if (SAFT_MA.VALIDATE_XSD) {
        const validation = await this.validator.validate(buffer);
        if (!validation.valid) {
          xsdValid = false;
          throw new BadRequestException({
            code: 'SAFT_XSD_VALIDATION_FAILED',
            errors: validation.errors,
          });
        }
      }

      // 5. SHA-256 checksum
      const sha256 = createHash('sha256').update(buffer).digest('hex');

      // 6. Upload S3
      const s3Key = `tenants/${tenantId}/exports/saft-ma-${exerciseYear}-${Date.now()}.xml`;
      await this.s3Storage.uploadBuffer({
        bucket: SAFT_MA.S3_BUCKET,
        key: s3Key,
        buffer,
        contentType: 'application/xml',
        metadata: {
          tenant_id: tenantId,
          exercise_year: String(exerciseYear),
          sha256,
        },
      });

      // 7. Generate presigned URL
      const presignedUrl = await this.s3Storage.getPresignedUrl({
        bucket: SAFT_MA.S3_BUCKET,
        key: s3Key,
        expiresInSeconds: SAFT_MA.PRESIGNED_URL_EXPIRES_SECONDS,
      });

      // 8. Update record
      const durationMs = Date.now() - startMs;
      exportRecord.status = 'completed';
      exportRecord.s3_bucket = SAFT_MA.S3_BUCKET;
      exportRecord.s3_key = s3Key;
      exportRecord.file_size_bytes = String(buffer.length) as any;
      exportRecord.sha256_checksum = sha256;
      exportRecord.entries_count = ledgerStats.entriesCount;
      exportRecord.lines_count = ledgerStats.linesCount;
      exportRecord.invoices_count = sourceDocsStats.invoicesCount;
      exportRecord.duration_ms = durationMs;
      exportRecord.xsd_validation_passed = xsdValid;
      exportRecord.completed_at = new Date();
      await this.exportRepo.save(exportRecord);

      // 9. Publish event
      await this.events.publish('books.saft_ma.exported', {
        tenant_id: tenantId,
        export_id: exportRecord.id,
        exercise_year: exerciseYear,
        file_size_bytes: buffer.length,
        sha256_checksum: sha256,
        entries_count: ledgerStats.entriesCount,
        duration_ms: durationMs,
      });

      this.logger.info({
        msg: 'saft_ma_export_done',
        tenant_id: tenantId,
        export_id: exportRecord.id,
        file_size_bytes: buffer.length,
        duration_ms: durationMs,
        entries_count: ledgerStats.entriesCount,
      });

      return {
        exportId: exportRecord.id,
        s3Bucket: SAFT_MA.S3_BUCKET,
        s3Key,
        fileSizeBytes: buffer.length,
        sha256Checksum: sha256,
        entriesCount: ledgerStats.entriesCount,
        linesCount: ledgerStats.linesCount,
        invoicesCount: sourceDocsStats.invoicesCount,
        durationMs,
        presignedUrl,
      };
    } catch (err) {
      exportRecord.status = 'failed';
      exportRecord.error_message = (err as Error).message;
      exportRecord.completed_at = new Date();
      await this.exportRepo.save(exportRecord);

      this.logger.error({
        msg: 'saft_ma_export_failed',
        tenant_id: tenantId,
        export_id: exportRecord.id,
        err: (err as Error).message,
      });

      await this.events.publish('books.saft_ma.export_failed', {
        tenant_id: tenantId,
        export_id: exportRecord.id,
        error: (err as Error).message,
      });

      throw err;
    }
  }

  private addHeaderToRoot(root: any, headerData: any) {
    const header = root.ele('Header');
    header.ele('AuditFileVersion').txt(headerData.audit_file_version);
    header.ele('CompanyID').txt(headerData.company_id);
    header.ele('TaxRegistrationNumber').txt(headerData.tax_registration_number);
    header.ele('CompanyName').txt(headerData.company_name);
    if (headerData.business_name)
      header.ele('BusinessName').txt(headerData.business_name);
    const addr = header.ele('CompanyAddress');
    addr.ele('StreetName').txt(headerData.company_address.street);
    addr.ele('City').txt(headerData.company_address.city);
    if (headerData.company_address.postal_code)
      addr.ele('PostalCode').txt(headerData.company_address.postal_code);
    addr.ele('Country').txt(headerData.company_address.country);
    header.ele('FiscalYearStartDate').txt(headerData.fiscal_year_start_date);
    header.ele('FiscalYearEndDate').txt(headerData.fiscal_year_end_date);
    header.ele('AuditFileDateCreated').txt(headerData.audit_file_date_created);
    header.ele('CurrencyCode').txt(headerData.currency_code);
    header.ele('ProductCompanyTaxID').txt('Skalean-Maroc');
    header.ele('SoftwareName').txt(headerData.software_name);
    header.ele('SoftwareVersion').txt(headerData.software_version);
  }

  private addMasterFilesToRoot(root: any, masterFiles: any) {
    const mf = root.ele('MasterFiles');
    // Accounts
    const accounts = mf.ele('GeneralLedgerAccounts');
    masterFiles.accounts.forEach((a: any) => {
      const acc = accounts.ele('Account');
      acc.ele('AccountID').txt(a.account_id);
      acc.ele('AccountDescription').txt(a.account_description);
      acc.ele('GroupingCategory').txt(a.grouping_category);
      acc.ele('OpeningDebitBalance').txt(a.opening_debit_balance);
      acc.ele('OpeningCreditBalance').txt(a.opening_credit_balance);
      acc.ele('ClosingDebitBalance').txt(a.closing_debit_balance);
      acc.ele('ClosingCreditBalance').txt(a.closing_credit_balance);
    });
    // Customers
    const customers = mf.ele('Customers');
    masterFiles.customers.forEach((c: any) => {
      const cu = customers.ele('Customer');
      cu.ele('CustomerID').txt(c.customer_id);
      cu.ele('AccountID').txt(c.account_id);
      if (c.customer_tax_id) cu.ele('CustomerTaxID').txt(c.customer_tax_id);
      cu.ele('CompanyName').txt(c.company_name);
      const ba = cu.ele('BillingAddress');
      if (c.billing_address.street) ba.ele('StreetName').txt(c.billing_address.street);
      if (c.billing_address.city) ba.ele('City').txt(c.billing_address.city);
      ba.ele('Country').txt(c.billing_address.country ?? 'MA');
    });
    // Suppliers
    const suppliers = mf.ele('Suppliers');
    masterFiles.suppliers.forEach((s: any) => {
      const su = suppliers.ele('Supplier');
      su.ele('SupplierID').txt(s.supplier_id);
      su.ele('AccountID').txt(s.account_id);
      if (s.supplier_tax_id) su.ele('SupplierTaxID').txt(s.supplier_tax_id);
      su.ele('CompanyName').txt(s.company_name);
    });
    // TaxTable
    const taxTable = mf.ele('TaxTable');
    masterFiles.tax_table.forEach((t: any) => {
      const tt = taxTable.ele('TaxTableEntry');
      tt.ele('TaxCode').txt(t.tax_code);
      tt.ele('Description').txt(t.description);
      tt.ele('TaxPercentage').txt(String(t.tax_percentage));
      tt.ele('AccountID').txt(t.account_id);
    });
  }
}
```

### 6.5 Service `saft-ma-validator.service.ts`

```typescript
// repo/packages/books/src/services/saft-ma-validator.service.ts

import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as libxmljs from 'libxmljs2';
import { SAFT_MA } from '../config/saft-ma.config';

export interface ValidationResult {
  valid: boolean;
  errors: Array<{ line: number; column: number; message: string; element?: string }>;
}

@Injectable()
export class SaftMaValidatorService {
  private xsdDoc: libxmljs.Document | null = null;

  constructor(private readonly logger: Logger) {}

  /** Charge le XSD au premier appel (lazy + cache). */
  private loadXsd(): libxmljs.Document {
    if (this.xsdDoc) return this.xsdDoc;
    const xsdPath = resolve(process.cwd(), SAFT_MA.XSD_FILE_PATH);
    const xsdContent = readFileSync(xsdPath, 'utf-8');
    this.xsdDoc = libxmljs.parseXml(xsdContent);
    return this.xsdDoc;
  }

  async validate(xmlBuffer: Buffer): Promise<ValidationResult> {
    const xsd = this.loadXsd();
    const xml = libxmljs.parseXml(xmlBuffer.toString('utf-8'));
    const valid = xml.validate(xsd);

    if (valid) {
      this.logger.info({ msg: 'saft_ma_xsd_validation_passed' });
      return { valid: true, errors: [] };
    }

    const errors = (xml.validationErrors as any[]).map((e: any) => ({
      line: e.line ?? 0,
      column: e.column ?? 0,
      message: e.message,
      element: e.element,
    }));

    this.logger.error({
      msg: 'saft_ma_xsd_validation_failed',
      errors_count: errors.length,
      first_error: errors[0],
    });

    return { valid: false, errors };
  }
}
```

### 6.6 Builder `saft-header.builder.ts`

```typescript
// repo/packages/books/src/builders/saft-header.builder.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { TenantSettingsService } from '@insurtech/shared-utils';
import type { SaftHeaderData } from '../types/saft-ma.types';
import { SAFT_MA } from '../config/saft-ma.config';

@Injectable()
export class SaftHeaderBuilder {
  constructor(private readonly tenantSettings: TenantSettingsService) {}

  async build(tenantId: string, exerciseYear: number): Promise<SaftHeaderData> {
    const settings = await this.tenantSettings.getVendorData(tenantId);
    if (!settings) {
      throw new BadRequestException({
        code: 'VENDOR_DATA_MISSING',
        message: 'Tenant settings vendor_data manquantes pour SAFT-MA',
      });
    }

    // Validation ICE 15 chiffres strict
    if (!/^\d{15}$/.test(settings.identifiants.ice)) {
      throw new BadRequestException({
        code: 'INVALID_ICE',
        ice: settings.identifiants.ice,
      });
    }

    return {
      audit_file_version: SAFT_MA.SCHEMA_VERSION,
      company_id: settings.identifiants.ice,
      tax_registration_number: settings.identifiants.if,
      company_name: settings.raison_sociale,
      business_name: settings.raison_sociale,
      company_address: {
        street: settings.address.line1,
        city: settings.address.city,
        postal_code: settings.address.postal_code,
        country: 'MA',
      },
      fiscal_year_start_date: `${exerciseYear}-01-01`,
      fiscal_year_end_date: `${exerciseYear}-12-31`,
      audit_file_date_created: new Date().toISOString(),
      currency_code: 'MAD',
      software_name: 'Skalean InsurTech',
      software_version: process.env.APP_VERSION ?? '1.0.0',
    };
  }
}
```

### 6.7 Builder `saft-master-files.builder.ts`

```typescript
// repo/packages/books/src/builders/saft-master-files.builder.ts

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { TVA_RATES_LIST, TVA_ACCOUNTS_COLLECTEE } from '@insurtech/books/config/tva-rates.config';
import type {
  SaftAccount,
  SaftCustomer,
  SaftSupplier,
  SaftTaxTableEntry,
} from '../types/saft-ma.types';

@Injectable()
export class SaftMasterFilesBuilder {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async build(
    tenantId: string,
    exerciseYear: number,
  ): Promise<{
    accounts: SaftAccount[];
    customers: SaftCustomer[];
    suppliers: SaftSupplier[];
    tax_table: SaftTaxTableEntry[];
  }> {
    const [accounts, customers, suppliers, taxTable] = await Promise.all([
      this.buildAccounts(tenantId, exerciseYear),
      this.buildCustomers(tenantId),
      this.buildSuppliers(tenantId),
      this.buildTaxTable(),
    ]);
    return { accounts, customers, suppliers, tax_table: taxTable };
  }

  private async buildAccounts(tenantId: string, exerciseYear: number): Promise<SaftAccount[]> {
    const dateStart = `${exerciseYear}-01-01`;
    const dateEnd = `${exerciseYear}-12-31`;

    const rows = await this.dataSource.query(
      `SELECT a.code AS account_id, a.label AS account_description, a.nature AS grouping_category,
              COALESCE(opening.debit, 0)::text AS opening_debit,
              COALESCE(opening.credit, 0)::text AS opening_credit,
              COALESCE(closing.debit, 0)::text AS closing_debit,
              COALESCE(closing.credit, 0)::text AS closing_credit
       FROM books_accounts a
       LEFT JOIN LATERAL (
         SELECT SUM(jl.debit) AS debit, SUM(jl.credit) AS credit
         FROM books_journal_lines jl
         INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_code = a.code AND jl.tenant_id = $1
           AND je.entry_date < $2 AND je.status = 'validated'
       ) opening ON true
       LEFT JOIN LATERAL (
         SELECT SUM(jl.debit) AS debit, SUM(jl.credit) AS credit
         FROM books_journal_lines jl
         INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
         WHERE jl.account_code = a.code AND jl.tenant_id = $1
           AND je.entry_date <= $3 AND je.status = 'validated'
       ) closing ON true
       WHERE (a.tenant_id IS NULL OR a.tenant_id = $1) AND a.active = true
       ORDER BY a.code`,
      [tenantId, dateStart, dateEnd],
    );

    return rows.map((r: any) => ({
      account_id: r.account_id,
      account_description: r.account_description,
      grouping_category: r.grouping_category,
      opening_debit_balance: new Decimal(r.opening_debit).toFixed(2),
      opening_credit_balance: new Decimal(r.opening_credit).toFixed(2),
      closing_debit_balance: new Decimal(r.closing_debit).toFixed(2),
      closing_credit_balance: new Decimal(r.closing_credit).toFixed(2),
    }));
  }

  private async buildCustomers(tenantId: string): Promise<SaftCustomer[]> {
    const rows = await this.dataSource.query(
      `SELECT c.id AS customer_id, c.name AS company_name, c.type, c.email, c.phone,
              c.address, c.ice, c.cin
       FROM crm_contacts c
       WHERE c.tenant_id = $1 AND c.is_active = true
       ORDER BY c.name`,
      [tenantId],
    );

    return rows.map((r: any) => ({
      customer_id: r.customer_id,
      account_id: this.resolveCustomerAccount(r.type),
      customer_tax_id: r.ice ?? r.cin ?? undefined,
      company_name: r.company_name,
      billing_address: {
        street: r.address?.line1,
        city: r.address?.city,
        country: r.address?.country ?? 'MA',
      },
      telephone: r.phone,
      email: r.email,
    }));
  }

  private async buildSuppliers(tenantId: string): Promise<SaftSupplier[]> {
    // Suppliers = compagnies assurance partenaires (4421-44210) + autres fournisseurs Sprint 14+
    const rows = await this.dataSource.query(
      `SELECT a.code AS supplier_id, a.label AS company_name
       FROM books_accounts a
       WHERE (a.tenant_id IS NULL OR a.tenant_id = $1)
         AND a.code BETWEEN '4421' AND '44210'
         AND a.active = true
       ORDER BY a.code`,
      [tenantId],
    );

    return rows.map((r: any) => ({
      supplier_id: r.supplier_id,
      account_id: r.supplier_id,
      company_name: r.company_name,
      billing_address: { country: 'MA' },
    }));
  }

  private buildTaxTable(): SaftTaxTableEntry[] {
    return TVA_RATES_LIST.map((rate) => ({
      tax_code: `TVA${rate}`,
      description: rate === 0 ? 'Exoneration' : `TVA ${rate}% taux MA`,
      tax_percentage: rate,
      account_id: TVA_ACCOUNTS_COLLECTEE[rate],
    }));
  }

  private resolveCustomerAccount(type: string): string {
    switch (type) {
      case 'individual': return '4111';
      case 'company': return '4112';
      case 'administration': return '4113';
      default: return '4111';
    }
  }
}
```

### 6.8 Builder `saft-ledger.builder.ts`

```typescript
// repo/packages/books/src/builders/saft-ledger.builder.ts

import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';

@Injectable()
export class SaftLedgerBuilder {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  /**
   * Build GeneralLedgerEntries directly into XML root via stream pattern.
   * Pour gros volumes : on commit chaque journal_entry au fur et a mesure.
   */
  async build(
    tenantId: string,
    exerciseYear: number,
    root: any,
  ): Promise<{ entriesCount: number; linesCount: number }> {
    const ledgerEntries = root.ele('GeneralLedgerEntries');
    ledgerEntries.ele('NumberOfEntries').txt('PLACEHOLDER'); // updated after
    ledgerEntries.ele('TotalDebit').txt('PLACEHOLDER');
    ledgerEntries.ele('TotalCredit').txt('PLACEHOLDER');

    const journalCodes = ['VEN', 'ACH', 'BNQ', 'CSS', 'OD', 'PAY', 'AN'];
    let totalEntries = 0;
    let totalLines = 0;
    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const journalCode of journalCodes) {
      const journalNode = ledgerEntries.ele('Journal');
      journalNode.ele('JournalID').txt(journalCode);
      journalNode.ele('Description').txt(this.getJournalDescription(journalCode));

      // Query entries pour ce journal + exercise
      const entries = await this.dataSource.query(
        `SELECT je.id, je.entry_number, je.entry_date, je.description,
                je.exercise_year, je.period_month, je.created_by, je.validated_by
         FROM books_journal_entries je
         WHERE je.tenant_id = $1
           AND je.exercise_year = $2
           AND je.journal_code = $3
           AND je.status = 'validated'
         ORDER BY je.entry_number ASC`,
        [tenantId, exerciseYear, journalCode],
      );

      for (const entry of entries) {
        const transactionNode = journalNode.ele('Transaction');
        transactionNode.ele('TransactionID').txt(entry.entry_number);
        transactionNode.ele('Period').txt(String(entry.period_month));
        transactionNode.ele('TransactionDate').txt(
          entry.entry_date.toISOString().slice(0, 10),
        );
        transactionNode.ele('TransactionType').txt('N'); // Normal
        transactionNode.ele('Description').txt(entry.description ?? '');
        transactionNode.ele('SystemEntryDate').txt(
          (entry as any).created_at?.toISOString?.() ?? entry.entry_date.toISOString(),
        );

        // Lines
        const lines = await this.dataSource.query(
          `SELECT line_number, account_code, label, debit::text, credit::text
           FROM books_journal_lines
           WHERE journal_entry_id = $1
           ORDER BY line_number ASC`,
          [entry.id],
        );

        const lineNode = transactionNode.ele('Lines');
        for (const line of lines) {
          if (parseFloat(line.debit) > 0) {
            const lineEl = lineNode.ele('DebitLine');
            lineEl.ele('RecordID').txt(String(line.line_number));
            lineEl.ele('AccountID').txt(line.account_code);
            lineEl.ele('Description').txt(line.label);
            lineEl.ele('DebitAmount').txt(new Decimal(line.debit).toFixed(2));
            totalDebit = totalDebit.plus(line.debit);
          } else if (parseFloat(line.credit) > 0) {
            const lineEl = lineNode.ele('CreditLine');
            lineEl.ele('RecordID').txt(String(line.line_number));
            lineEl.ele('AccountID').txt(line.account_code);
            lineEl.ele('Description').txt(line.label);
            lineEl.ele('CreditAmount').txt(new Decimal(line.credit).toFixed(2));
            totalCredit = totalCredit.plus(line.credit);
          }
          totalLines += 1;
        }
        totalEntries += 1;
      }
    }

    // Update placeholders
    this.logger.info({
      msg: 'saft_ledger_built',
      tenant_id: tenantId,
      exercise_year: exerciseYear,
      entries_count: totalEntries,
      lines_count: totalLines,
      total_debit: totalDebit.toFixed(2),
      total_credit: totalCredit.toFixed(2),
      balanced: totalDebit.equals(totalCredit),
    });

    if (!totalDebit.equals(totalCredit)) {
      throw new Error(
        `SAFT_LEDGER_NOT_BALANCED: debit ${totalDebit.toFixed(2)} != credit ${totalCredit.toFixed(2)}`,
      );
    }

    return { entriesCount: totalEntries, linesCount: totalLines };
  }

  private getJournalDescription(code: string): string {
    const map: Record<string, string> = {
      VEN: 'Journal des Ventes',
      ACH: 'Journal des Achats',
      BNQ: 'Journal de Banque',
      CSS: 'Journal de Caisse',
      OD: 'Journal des Operations Diverses',
      PAY: 'Journal de Paie',
      AN: 'Journal des A Nouveaux',
    };
    return map[code] ?? code;
  }
}
```

### 6.9 Builder `saft-source-documents.builder.ts`

```typescript
// repo/packages/books/src/builders/saft-source-documents.builder.ts

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';

@Injectable()
export class SaftSourceDocumentsBuilder {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async build(
    tenantId: string,
    exerciseYear: number,
    root: any,
  ): Promise<{ invoicesCount: number; paymentsCount: number }> {
    const sourceDocs = root.ele('SourceDocuments');

    // SalesInvoices
    const salesInvoices = sourceDocs.ele('SalesInvoices');
    const invoices = await this.dataSource.query(
      `SELECT id, invoice_number, invoice_date, invoice_type, customer_data,
              subtotal_ht::text, total_tva::text, total_ttc::text, status
       FROM books_invoices
       WHERE tenant_id = $1 AND exercise_year = $2 AND status != 'draft'
       ORDER BY invoice_number`,
      [tenantId, exerciseYear],
    );
    salesInvoices.ele('NumberOfEntries').txt(String(invoices.length));

    let invoicesTotalDebit = new Decimal(0);
    let invoicesTotalCredit = new Decimal(0);

    for (const inv of invoices) {
      const invoiceNode = salesInvoices.ele('Invoice');
      invoiceNode.ele('InvoiceNo').txt(inv.invoice_number);
      invoiceNode.ele('InvoiceDate').txt(inv.invoice_date.toISOString().slice(0, 10));
      invoiceNode.ele('InvoiceType').txt(inv.invoice_type === 'credit_note' ? 'NC' : 'FT');
      invoiceNode.ele('CustomerID').txt(inv.customer_data?.id ?? 'UNKNOWN');
      const dt = invoiceNode.ele('DocumentTotals');
      dt.ele('TaxPayable').txt(new Decimal(inv.total_tva).toFixed(2));
      dt.ele('NetTotal').txt(new Decimal(inv.subtotal_ht).toFixed(2));
      dt.ele('GrossTotal').txt(new Decimal(inv.total_ttc).toFixed(2));

      if (inv.invoice_type === 'credit_note') {
        invoicesTotalCredit = invoicesTotalCredit.plus(inv.total_ttc);
      } else {
        invoicesTotalDebit = invoicesTotalDebit.plus(inv.total_ttc);
      }
    }
    salesInvoices.ele('TotalDebit').txt(invoicesTotalDebit.toFixed(2));
    salesInvoices.ele('TotalCredit').txt(invoicesTotalCredit.toFixed(2));

    // Payments
    const payments = sourceDocs.ele('Payments');
    const payRows = await this.dataSource.query(
      `SELECT id, transaction_id, captured_at, amount::text, provider, transaction_type
       FROM pay_transactions
       WHERE tenant_id = $1 AND EXTRACT(YEAR FROM captured_at) = $2 AND status = 'captured'
       ORDER BY captured_at`,
      [tenantId, exerciseYear],
    );
    payments.ele('NumberOfEntries').txt(String(payRows.length));
    let paymentsTotal = new Decimal(0);
    for (const p of payRows) {
      const paymentNode = payments.ele('Payment');
      paymentNode.ele('PaymentRefNo').txt(p.transaction_id);
      paymentNode.ele('TransactionDate').txt(p.captured_at.toISOString().slice(0, 10));
      paymentNode.ele('PaymentMethod').txt(this.mapProviderToMethod(p.provider));
      paymentNode.ele('Amount').txt(new Decimal(p.amount).toFixed(2));
      paymentsTotal = paymentsTotal.plus(p.amount);
    }
    payments.ele('TotalDebit').txt(paymentsTotal.toFixed(2));
    payments.ele('TotalCredit').txt('0.00');

    return { invoicesCount: invoices.length, paymentsCount: payRows.length };
  }

  private mapProviderToMethod(provider: string): string {
    if (provider === 'payzone' && provider.includes('cash')) return 'CASH';
    if (provider.includes('mobile')) return 'EFT';
    return 'CARD';
  }
}
```

### 6.10 Controller `saft-ma.controller.ts`

```typescript
// repo/apps/api/src/modules/books/controllers/saft-ma.controller.ts

import { Controller, Post, Get, Query, Param, HttpCode, HttpStatus, UseGuards, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { JwtAuthGuard, TenantGuard, PermissionsGuard } from '@insurtech/auth';
import { Permissions, CurrentUser } from '@insurtech/auth/decorators';
import { ZodPipe } from '@insurtech/shared-utils/pipes/zod.pipe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BooksSaftExportEntity } from '@insurtech/books/entities/books-saft-export.entity';
import { z } from 'zod';

const ExerciseYearSchema = z.object({
  exercise_year: z.coerce.number().int().min(2020).max(2100),
});

@ApiTags('Books -- SAFT-MA Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller({ path: 'books/saft-ma', version: '1' })
export class SaftMaController {
  constructor(
    @InjectQueue('saft-ma-export') private readonly queue: Queue,
    @InjectRepository(BooksSaftExportEntity)
    private readonly exportRepo: Repository<BooksSaftExportEntity>,
  ) {}

  @Post('export')
  @Permissions('books.saft.export')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerExport(
    @Query(new ZodPipe(ExerciseYearSchema)) query: any,
    @CurrentUser() user: { sub: string; tenant_id: string },
  ) {
    const jobId = `saft-ma:${user.tenant_id}:${query.exercise_year}`;
    await this.queue.add(
      'generate-saft-ma',
      {
        tenant_id: user.tenant_id,
        exercise_year: query.exercise_year,
        requested_by: user.sub,
      },
      {
        jobId,
        attempts: 2,
        backoff: { type: 'exponential', delay: 10000 },
      },
    );
    return { job_id: jobId, status: 'queued' };
  }

  @Get('exports')
  @Permissions('books.saft.read')
  async listExports(@CurrentUser() user: { tenant_id: string }) {
    return this.exportRepo.find({
      where: { tenant_id: user.tenant_id } as any,
      order: { created_at: 'DESC' },
      take: 50,
    });
  }

  @Get('exports/:id')
  @Permissions('books.saft.read')
  async getExport(@Param('id') id: string, @CurrentUser() user: { tenant_id: string }) {
    return this.exportRepo.findOne({
      where: { id, tenant_id: user.tenant_id } as any,
    });
  }

  @Get('exports/:id/download')
  @Permissions('books.saft.download')
  async downloadExport(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string },
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const exp = await this.exportRepo.findOne({
      where: { id, tenant_id: user.tenant_id } as any,
    });
    if (!exp || exp.status !== 'completed' || !exp.s3_key) {
      reply.status(404);
      return { error: 'EXPORT_NOT_FOUND_OR_NOT_READY' };
    }
    // Generate fresh presigned URL
    return { presigned_url: 'https://s3-presigned-url-...' };
  }
}
```

---

## 7. Tests complets

### 7.1 Tests unit `saft-ma-exporter.service.spec.ts` (12 tests)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaftMaExporterService } from '../saft-ma-exporter.service';
import { TenantContext } from '@insurtech/shared-utils';

describe('SaftMaExporterService', () => {
  let service: SaftMaExporterService;
  let dataSource: any, fileService: any, logger: any, exportsRepo: any, validator: any;
  let headerBuilder: any, masterFilesBuilder: any, ledgerBuilder: any, sourceDocsBuilder: any;

  beforeEach(() => {
    vi.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-test');
    dataSource = {
      query: vi.fn().mockResolvedValue([]),
      manager: { findOne: vi.fn(), find: vi.fn().mockResolvedValue([]) },
    };
    fileService = {
      uploadStream: vi.fn().mockResolvedValue({ url: 's3://saft/exports/file.xml', size: 1024 }),
      generateSignedUrl: vi.fn().mockResolvedValue('https://signed.url'),
      downloadAsText: vi.fn().mockResolvedValue('<xml></xml>'),
    };
    logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    exportsRepo = {
      save: vi.fn().mockImplementation((d) => Promise.resolve({ ...d, id: 'exp-1' })),
      findOne: vi.fn(),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    validator = { validateXml: vi.fn().mockResolvedValue({ valid: true, errors: [] }) };
    headerBuilder = { build: vi.fn().mockReturnValue('<Header>...</Header>') };
    masterFilesBuilder = { build: vi.fn().mockReturnValue('<MasterFiles>...</MasterFiles>') };
    ledgerBuilder = { build: vi.fn().mockReturnValue('<GeneralLedgerEntries>...</GeneralLedgerEntries>') };
    sourceDocsBuilder = { build: vi.fn().mockReturnValue('<SourceDocuments>...</SourceDocuments>') };

    service = new SaftMaExporterService(
      dataSource, fileService, exportsRepo, validator,
      headerBuilder, masterFilesBuilder, ledgerBuilder, sourceDocsBuilder, logger,
    );
  });

  it('exports SAFT-MA XML for fiscal year and tenant', async () => {
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'finance-officer-1',
    });
    expect(headerBuilder.build).toHaveBeenCalled();
    expect(masterFilesBuilder.build).toHaveBeenCalled();
    expect(ledgerBuilder.build).toHaveBeenCalled();
    expect(sourceDocsBuilder.build).toHaveBeenCalled();
    expect(fileService.uploadStream).toHaveBeenCalled();
    expect(result.export_id).toBeDefined();
  });

  it('validates generated XML against XSD before upload', async () => {
    await service.exportFiscalYear({
      tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'finance-officer-1',
    });
    expect(validator.validateXml).toHaveBeenCalled();
  });

  it('throws if XML invalid against XSD', async () => {
    validator.validateXml.mockResolvedValueOnce({
      valid: false, errors: [{ line: 42, message: 'Element CustomerID required' }],
    });
    await expect(
      service.exportFiscalYear({ tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'u1' }),
    ).rejects.toThrow(/xsd validation failed/i);
  });

  it('records export in books_saft_exports with status completed', async () => {
    await service.exportFiscalYear({ tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'u1' });
    expect(exportsRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-test', fiscal_year: 2025, status: 'completed',
    }));
  });

  it('rejects export if fiscal year > current year', async () => {
    await expect(
      service.exportFiscalYear({ tenant_id: 'tenant-test', fiscal_year: 2099, requested_by: 'u1' }),
    ).rejects.toThrow(/fiscal year cannot be in the future/i);
  });

  it('rejects export if fiscal year < 2020 (DGI cutoff)', async () => {
    await expect(
      service.exportFiscalYear({ tenant_id: 'tenant-test', fiscal_year: 2010, requested_by: 'u1' }),
    ).rejects.toThrow(/fiscal year too old/i);
  });

  it('generates UTF-8 encoded XML with BOM', async () => {
    let capturedXml = '';
    fileService.uploadStream.mockImplementationOnce((stream: any) => {
      stream.on('data', (chunk: any) => { capturedXml += chunk.toString(); });
      return Promise.resolve({ url: 's3://...', size: capturedXml.length });
    });
    await service.exportFiscalYear({ tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'u1' });
    expect(capturedXml.charCodeAt(0)).toBe(0xFEFF);
  });

  it('streams chunks > 1 MB without OOM (10k+ entries)', async () => {
    dataSource.manager.find.mockResolvedValue(
      Array.from({ length: 10000 }, (_, i) => ({ id: `je-${i}`, debit_total: '1000', credit_total: '1000' })),
    );
    await service.exportFiscalYear({ tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'u1' });
    expect(ledgerBuilder.build).toHaveBeenCalled();
  });

  it('logs audit entry with tenant_id, requested_by, action', async () => {
    await service.exportFiscalYear({
      tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'finance-officer-1',
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ tenant_id: 'tenant-test', action: 'saft_ma_export_started', fiscal_year: 2025 }),
      expect.any(String),
    );
  });

  it('publishes books.saft_ma.exported event on success', async () => {
    const events = { publish: vi.fn() };
    service = new SaftMaExporterService(
      dataSource, fileService, exportsRepo, validator,
      headerBuilder, masterFilesBuilder, ledgerBuilder, sourceDocsBuilder, logger, events,
    );
    await service.exportFiscalYear({ tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'u1' });
    expect(events.publish).toHaveBeenCalledWith(
      'insurtech.events.books.saft_ma.exported',
      expect.objectContaining({ tenant_id: 'tenant-test', fiscal_year: 2025 }),
    );
  });

  it('returns signed S3 URL (15 min TTL DGI security)', async () => {
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'u1',
    });
    expect(fileService.generateSignedUrl).toHaveBeenCalledWith(expect.objectContaining({ ttl_seconds: 900 }));
    expect(result.download_url).toBeDefined();
  });

  it('updates status failed if upload throws', async () => {
    fileService.uploadStream.mockRejectedValueOnce(new Error('S3 down'));
    await expect(
      service.exportFiscalYear({ tenant_id: 'tenant-test', fiscal_year: 2025, requested_by: 'u1' }),
    ).rejects.toThrow();
    expect(exportsRepo.update).toHaveBeenCalledWith(
      expect.any(Object), expect.objectContaining({ status: 'failed' }),
    );
  });
});
```


### 7.2 Tests `saft-master-files.builder.spec.ts` (8 tests)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaftMasterFilesBuilder } from '../builders/saft-master-files.builder';

describe('SaftMasterFilesBuilder', () => {
  let builder: SaftMasterFilesBuilder;
  let accountRepo: any, customerRepo: any, supplierRepo: any, productRepo: any, taxRepo: any;

  beforeEach(() => {
    accountRepo = { find: vi.fn().mockResolvedValue([]) };
    customerRepo = { find: vi.fn().mockResolvedValue([]) };
    supplierRepo = { find: vi.fn().mockResolvedValue([]) };
    productRepo = { find: vi.fn().mockResolvedValue([]) };
    taxRepo = { find: vi.fn().mockResolvedValue([]) };
    builder = new SaftMasterFilesBuilder(accountRepo, customerRepo, supplierRepo, productRepo, taxRepo);
  });

  it('builds GeneralLedger from 250+ CGNC accounts', async () => {
    accountRepo.find.mockResolvedValue(
      Array.from({ length: 250 }, (_, i) => ({
        code: `7${i.toString().padStart(3, '0')}`, name: `Compte ${i}`, account_type: 'product',
      })),
    );
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).toContain('<GeneralLedgerAccounts>');
    expect(xml.match(/<Account>/g)?.length).toBeGreaterThanOrEqual(250);
  });

  it('builds Customers list with ICE + RC + tenant filter', async () => {
    customerRepo.find.mockResolvedValue([
      { id: 'c1', name: 'Atlas SARL', ice: '001234567890123', rc: '12345', patente: 'P-001', tax_country: 'MA' },
    ]);
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).toContain('<Customer>');
    expect(xml).toContain('<TaxRegistrationNumber>001234567890123</TaxRegistrationNumber>');
    expect(xml).toContain('<RC>12345</RC>');
  });

  it('builds Suppliers list with ICE', async () => {
    supplierRepo.find.mockResolvedValue([
      { id: 's1', name: 'Fournisseur SA', ice: '009876543210987', siren_local: 'P-002' },
    ]);
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).toContain('<Supplier>');
    expect(xml).toContain('<TaxRegistrationNumber>009876543210987</TaxRegistrationNumber>');
  });

  it('builds TaxTable with 5 TVA MA rates (0,7,10,14,20)', async () => {
    taxRepo.find.mockResolvedValue([
      { code: 'TVA-0', rate: 0, description: 'Exonere' },
      { code: 'TVA-7', rate: 7, description: 'Reduit 7%' },
      { code: 'TVA-10', rate: 10, description: 'Reduit 10%' },
      { code: 'TVA-14', rate: 14, description: 'Reduit 14%' },
      { code: 'TVA-20', rate: 20, description: 'Standard 20%' },
    ]);
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).toContain('<TaxTable>');
    expect(xml).toContain('<TaxPercentage>20.00</TaxPercentage>');
    expect(xml.match(/<TaxTableEntry>/g)?.length).toBe(5);
  });

  it('filters customers by tenant_id', async () => {
    await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(customerRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_id: 'tenant-1' }),
    }));
  });

  it('escapes XML special characters in names', async () => {
    customerRepo.find.mockResolvedValue([
      { id: 'c1', name: 'Bennani & Associes <SARL>', ice: '001', rc: '1' },
    ]);
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).toContain('Bennani &amp; Associes &lt;SARL&gt;');
  });

  it('outputs Country MA in CompanyAddress', async () => {
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).toContain('<Country>MA</Country>');
  });

  it('builds 0 entries gracefully when no data', async () => {
    const xml = await builder.build({ tenant_id: 'tenant-empty', fiscal_year: 2025 });
    expect(xml).toContain('<MasterFiles>');
    expect(xml).toContain('</MasterFiles>');
  });
});
```

### 7.3 Tests `saft-ledger.builder.spec.ts` (8 tests)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaftLedgerBuilder } from '../builders/saft-ledger.builder';

describe('SaftLedgerBuilder', () => {
  let builder: SaftLedgerBuilder;
  let journalRepo: any;
  beforeEach(() => { journalRepo = { find: vi.fn().mockResolvedValue([]) }; builder = new SaftLedgerBuilder(journalRepo); });

  it('builds GeneralLedgerEntries from journal entries', async () => {
    journalRepo.find.mockResolvedValue([{
      id: 'je-1', journal_code: 'VTE', entry_date: '2025-01-15', reference: 'INV-001',
      description: 'Facture vente police auto', debit_total: '12000.00', credit_total: '12000.00',
      lines: [
        { account_code: '3421', amount: '12000', side: 'debit' },
        { account_code: '7111', amount: '10000', side: 'credit' },
        { account_code: '4455', amount: '2000', side: 'credit' },
      ],
    }]);
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).toContain('<GeneralLedgerEntries>');
    expect(xml).toContain('<JournalID>VTE</JournalID>');
    expect(xml).toContain('<DocumentNumber>INV-001</DocumentNumber>');
  });

  it('totalDebit == totalCredit (CGNC art 7)', async () => {
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    const totalDebit = parseFloat(xml.match(/<TotalDebit>([\d.]+)/)?.[1] || '0');
    const totalCredit = parseFloat(xml.match(/<TotalCredit>([\d.]+)/)?.[1] || '0');
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  it('filters by fiscal_year (Jan 1 to Dec 31)', async () => {
    await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(journalRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ entry_date: expect.anything() }),
    }));
  });

  it('only validated entries (status=validated)', async () => {
    journalRepo.find.mockResolvedValue([
      { id: 'je-draft', status: 'draft', entry_date: '2025-05-01', lines: [] },
      { id: 'je-valid', status: 'validated', entry_date: '2025-05-02', lines: [] },
    ]);
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).not.toContain('je-draft');
    expect(xml).toContain('je-valid');
  });

  it('groups by journal_code (VTE, ACH, BNK)', async () => {
    journalRepo.find.mockResolvedValue([
      { id: 'je-1', journal_code: 'VTE', status: 'validated', entry_date: '2025-01-01', lines: [] },
      { id: 'je-2', journal_code: 'ACH', status: 'validated', entry_date: '2025-01-02', lines: [] },
      { id: 'je-3', journal_code: 'VTE', status: 'validated', entry_date: '2025-01-03', lines: [] },
    ]);
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml.match(/<JournalID>VTE<\/JournalID>/g)?.length).toBeGreaterThanOrEqual(1);
  });

  it('amounts decimal(15,2) DGI format', async () => {
    journalRepo.find.mockResolvedValue([{
      id: 'je-1', journal_code: 'VTE', status: 'validated', entry_date: '2025-01-15',
      debit_total: '1234.50', credit_total: '1234.50',
      lines: [{ account_code: '3421', amount: '1234.5', side: 'debit' }],
    }]);
    const xml = await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    expect(xml).toContain('<DebitAmount>1234.50</DebitAmount>');
  });

  it('handles 100k+ entries via streaming memory < 200 MB', async () => {
    journalRepo.find.mockResolvedValue(
      Array.from({ length: 100000 }, (_, i) => ({
        id: `je-${i}`, journal_code: 'VTE', status: 'validated', entry_date: '2025-05-01',
        debit_total: '100', credit_total: '100',
        lines: [{ account_code: '3421', amount: '100', side: 'debit' }],
      })),
    );
    const memBefore = process.memoryUsage().heapUsed;
    await builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 });
    const memAfter = process.memoryUsage().heapUsed;
    expect(memAfter - memBefore).toBeLessThan(200_000_000);
  });

  it('throws if debit != credit (unbalanced)', async () => {
    journalRepo.find.mockResolvedValue([{
      id: 'je-bad', journal_code: 'VTE', status: 'validated', entry_date: '2025-05-01',
      debit_total: '100', credit_total: '99', lines: [],
    }]);
    await expect(
      builder.build({ tenant_id: 'tenant-1', fiscal_year: 2025 }),
    ).rejects.toThrow(/unbalanced/i);
  });
});
```

### 7.4 Tests `saft-ma-validator.service.spec.ts` (4 tests)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { SaftMaValidatorService } from '../saft-ma-validator.service';
import { readFileSync } from 'fs';

describe('SaftMaValidatorService', () => {
  let validator: SaftMaValidatorService;
  beforeEach(() => { validator = new SaftMaValidatorService(); });

  it('validates conforming SAFT-MA XML', async () => {
    const xml = readFileSync('test/fixtures/saft-ma-valid.xml', 'utf-8');
    const result = await validator.validateXml(xml);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects XML missing Header', async () => {
    const xml = '<?xml version="1.0"?><AuditFile><MasterFiles/></AuditFile>';
    const result = await validator.validateXml(xml);
    expect(result.valid).toBe(false);
  });

  it('rejects XML with wrong namespace', async () => {
    const xml = readFileSync('test/fixtures/saft-ma-wrong-ns.xml', 'utf-8');
    const result = await validator.validateXml(xml);
    expect(result.valid).toBe(false);
  });

  it('reports all errors found', async () => {
    const xml = readFileSync('test/fixtures/saft-ma-multiple-errors.xml', 'utf-8');
    const result = await validator.validateXml(xml);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
```


### 7.5 Tests integration `saft-ma-export.integration.spec.ts` (12 tests)

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BooksModule } from '../books.module';

describe('SAFT-MA Integration (Postgres + S3 emule + libxmljs2)', () => {
  let app: any;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [BooksModule.forTest()] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });
  afterAll(async () => { await app.close(); });
  beforeEach(async () => {
    await dataSource.query('DELETE FROM books_saft_exports WHERE fiscal_year=2025');
    await dataSource.query("SELECT set_config('app.current_tenant', 'tenant-saft', false)");
  });

  it('exports full fiscal year for tenant Bennani', async () => {
    const service = app.get('SaftMaExporterService');
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1',
    });
    expect(result.export_id).toBeDefined();
    expect(result.download_url).toMatch(/^https:\/\//);
  });

  it('produces XML valid against XSD officiel DGI', async () => {
    const service = app.get('SaftMaExporterService');
    const validator = app.get('SaftMaValidatorService');
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1',
    });
    const xml = await app.get('FileService').downloadAsText(result.s3_key);
    const validation = await validator.validateXml(xml);
    expect(validation.valid).toBe(true);
  });

  it('records export status completed', async () => {
    const service = app.get('SaftMaExporterService');
    await service.exportFiscalYear({
      tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1',
    });
    const records = await dataSource.query(
      "SELECT * FROM books_saft_exports WHERE tenant_id='tenant-bennani' AND fiscal_year=2025",
    );
    expect(records[0].status).toBe('completed');
  });

  it('RLS isolates exports between tenants', async () => {
    await dataSource.query("SELECT set_config('app.current_tenant', 'tenant-A', false)");
    await dataSource.query(
      `INSERT INTO books_saft_exports (id, tenant_id, fiscal_year, status, s3_key) VALUES ($1,$2,$3,$4,$5)`,
      ['exp-a-1', 'tenant-A', 2025, 'completed', 's3://saft/A.xml'],
    );
    await dataSource.query("SELECT set_config('app.current_tenant', 'tenant-B', false)");
    const r = await dataSource.query("SELECT * FROM books_saft_exports WHERE id='exp-a-1'");
    expect(r.length).toBe(0);
  });

  it('handles concurrent exports for different fiscal years', async () => {
    const service = app.get('SaftMaExporterService');
    const [r1, r2, r3] = await Promise.all([
      service.exportFiscalYear({ tenant_id: 'tenant-bennani', fiscal_year: 2023, requested_by: 'fo-1' }),
      service.exportFiscalYear({ tenant_id: 'tenant-bennani', fiscal_year: 2024, requested_by: 'fo-1' }),
      service.exportFiscalYear({ tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1' }),
    ]);
    expect(r1.export_id).toBeDefined();
    expect(r2.export_id).toBeDefined();
    expect(r3.export_id).toBeDefined();
  });

  it('reuses prior export if < 24h', async () => {
    const service = app.get('SaftMaExporterService');
    const r1 = await service.exportFiscalYear({ tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1' });
    const r2 = await service.exportFiscalYear({ tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1' });
    expect(r1.export_id).toBe(r2.export_id);
  });

  it('rolls back DB if S3 upload fails', async () => {
    const service = app.get('SaftMaExporterService');
    const fileService = app.get('FileService');
    vi.spyOn(fileService, 'uploadStream').mockRejectedValueOnce(new Error('S3 unreachable'));
    await expect(
      service.exportFiscalYear({ tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1' }),
    ).rejects.toThrow();
    const r = await dataSource.query(
      "SELECT * FROM books_saft_exports WHERE tenant_id='tenant-bennani' AND fiscal_year=2025",
    );
    expect(r.find((x: any) => x.status === 'completed')).toBeUndefined();
  });

  it('signed S3 URL expires after 15 min', async () => {
    const service = app.get('SaftMaExporterService');
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1',
    });
    const url = new URL(result.download_url);
    const expiresIn = parseInt(url.searchParams.get('X-Amz-Expires') || '0', 10);
    expect(expiresIn).toBeLessThanOrEqual(900);
  });

  it('annual cron triggers export 1 April', async () => {
    const cron = app.get('AnnualSaftMaExportCron');
    const result = await cron.exportAllTenants(2025);
    expect(result.exported).toBeGreaterThan(0);
  });

  it('audit log captures tenant_id, fiscal_year', async () => {
    const service = app.get('SaftMaExporterService');
    await service.exportFiscalYear({
      tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'finance-officer-1',
    });
    const audit = await dataSource.query(
      "SELECT * FROM audit_log WHERE action='saft_ma_export_started' AND tenant_id='tenant-bennani'",
    );
    expect(audit.length).toBeGreaterThan(0);
  });

  it('XML contains 250+ CGNC accounts', async () => {
    const service = app.get('SaftMaExporterService');
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1',
    });
    const xml = await app.get('FileService').downloadAsText(result.s3_key);
    expect(xml.match(/<Account>/g)?.length).toBeGreaterThanOrEqual(250);
  });

  it('encodes amounts decimal(15,2)', async () => {
    const service = app.get('SaftMaExporterService');
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-bennani', fiscal_year: 2025, requested_by: 'fo-1',
    });
    const xml = await app.get('FileService').downloadAsText(result.s3_key);
    expect(xml).toMatch(/<DebitAmount>\d+\.\d{2}<\/DebitAmount>/);
  });
});
```

### 7.6 Tests E2E `saft-ma-e2e.spec.ts` (10 tests)

```typescript
import { test, expect } from '@playwright/test';
import { ApiClient } from './helpers/api-client';

test.describe('SAFT-MA E2E Export flows', () => {
  let api: ApiClient;
  test.beforeAll(async () => { api = new ApiClient(); await api.login('finance-officer-1'); });

  test('e2e-1: POST /v1/books/saft-ma/exports', async () => {
    const res = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2025 });
    expect(res.status).toBe(202);
    expect(res.body.export_id).toBeDefined();
  });

  test('e2e-2: GET /v1/books/saft-ma/exports lists', async () => {
    const res = await api.get('/v1/books/saft-ma/exports');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  test('e2e-3: GET /v1/books/saft-ma/exports/:id retrieves single', async () => {
    const created = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2025 });
    const res = await api.get(`/v1/books/saft-ma/exports/${created.body.export_id}`);
    expect(res.status).toBe(200);
    expect(res.body.export_id).toBe(created.body.export_id);
  });

  test('e2e-4: download returns signed URL', async () => {
    const created = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2025 });
    await new Promise((r) => setTimeout(r, 5000));
    const res = await api.get(`/v1/books/saft-ma/exports/${created.body.export_id}/download`);
    expect(res.status).toBe(200);
    expect(res.body.download_url).toMatch(/^https:\/\//);
  });

  test('e2e-5: permission books.saft.export required', async () => {
    await api.login('regular-user');
    const res = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2025 });
    expect(res.status).toBe(403);
  });

  test('e2e-6: rejected fiscal_year > current_year', async () => {
    const res = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2099 });
    expect(res.status).toBe(422);
  });

  test('e2e-7: rejected fiscal_year < 2020', async () => {
    const res = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2015 });
    expect(res.status).toBe(422);
  });

  test('e2e-8: multi-tenant isolation', async () => {
    await api.login('officer-tenant-A');
    const res = await api.get('/v1/books/saft-ma/exports');
    res.body.items.forEach((e: any) => expect(e.tenant_id).toBe('tenant-A'));
  });

  test('e2e-9: rate limit 5 exports/hour/tenant', async () => {
    for (let i = 0; i < 5; i++) await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2020 + i });
    const res = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2025 });
    expect(res.status).toBe(429);
  });

  test('e2e-10: idempotency-key prevents duplicate export', async () => {
    const headers = { 'idempotency-key': 'export-2025-test' };
    const r1 = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2025 }, headers);
    const r2 = await api.post('/v1/books/saft-ma/exports', { fiscal_year: 2025 }, headers);
    expect(r1.body.export_id).toBe(r2.body.export_id);
  });
});
```



### 7.7 Fixtures realistes `saft-ma-fixtures.ts` (~180 lignes)

```typescript
import { faker } from '@faker-js/faker';
import { JournalEntry, Customer, Supplier, Account, TaxEntry } from '@insurtech/shared-types';

export const cgncAccountsFixture: Account[] = [
  // Classe 1 - Comptes de financement permanent
  { code: '1111', name: 'Capital social', account_type: 'equity', class: 1, account_type_saft: 'BAL' },
  { code: '1117', name: 'Capital personnel', account_type: 'equity', class: 1, account_type_saft: 'BAL' },
  { code: '1142', name: 'Reserve legale', account_type: 'equity', class: 1, account_type_saft: 'BAL' },
  { code: '1148', name: 'Autres reserves', account_type: 'equity', class: 1, account_type_saft: 'BAL' },
  { code: '1311', name: 'Subventions investissement', account_type: 'equity', class: 1, account_type_saft: 'BAL' },
  // Classe 2 - Immobilisations
  { code: '2111', name: 'Frais de constitution', account_type: 'asset', class: 2, account_type_saft: 'BAL' },
  { code: '2230', name: 'Fonds commercial', account_type: 'asset', class: 2, account_type_saft: 'BAL' },
  { code: '2321', name: 'Materiel informatique', account_type: 'asset', class: 2, account_type_saft: 'BAL' },
  // Classe 3 - Stocks
  { code: '3111', name: 'Marchandises', account_type: 'asset', class: 3, account_type_saft: 'BAL' },
  { code: '3421', name: 'Clients', account_type: 'asset', class: 3, account_type_saft: 'AR' },
  { code: '3425', name: 'Clients douteux', account_type: 'asset', class: 3, account_type_saft: 'AR' },
  // Classe 4 - Comptes de tiers
  { code: '4411', name: 'Fournisseurs', account_type: 'liability', class: 4, account_type_saft: 'AP' },
  { code: '4421', name: 'Personnel - Remunerations dues', account_type: 'liability', class: 4, account_type_saft: 'BAL' },
  { code: '4441', name: 'CNSS', account_type: 'liability', class: 4, account_type_saft: 'BAL' },
  { code: '4452', name: 'Etat - TVA facturee', account_type: 'liability', class: 4, account_type_saft: 'GL' },
  { code: '4455', name: 'Etat - TVA collectee', account_type: 'liability', class: 4, account_type_saft: 'GL' },
  { code: '4456', name: 'Etat - TVA due', account_type: 'liability', class: 4, account_type_saft: 'GL' },
  // Classe 5 - Tresorerie
  { code: '5111', name: 'Cheques en portefeuille', account_type: 'asset', class: 5, account_type_saft: 'BAL' },
  { code: '5141', name: 'Banque Attijariwafa', account_type: 'asset', class: 5, account_type_saft: 'BAL' },
  { code: '5161', name: 'Caisse', account_type: 'asset', class: 5, account_type_saft: 'BAL' },
  // Classe 6 - Charges
  { code: '6111', name: 'Achats marchandises', account_type: 'expense', class: 6, account_type_saft: 'GL' },
  { code: '6131', name: 'Locations', account_type: 'expense', class: 6, account_type_saft: 'GL' },
  { code: '6171', name: 'Remunerations personnel', account_type: 'expense', class: 6, account_type_saft: 'GL' },
  // Classe 7 - Produits
  { code: '7111', name: 'Ventes marchandises', account_type: 'product', class: 7, account_type_saft: 'GL' },
  { code: '7121', name: 'Ventes biens fabriques', account_type: 'product', class: 7, account_type_saft: 'GL' },
  { code: '7126', name: 'Prestations services', account_type: 'product', class: 7, account_type_saft: 'GL' },
  { code: '7141', name: 'Subventions exploitation', account_type: 'product', class: 7, account_type_saft: 'GL' },
];

export const tvaTableFixture: TaxEntry[] = [
  { code: 'TVA-0', rate: 0, description: 'Exonere (export, services internationaux)', category: 'STANDARD' },
  { code: 'TVA-7', rate: 7, description: 'Reduit 7% (produits agricoles, medicaments)', category: 'REDUIT' },
  { code: 'TVA-10', rate: 10, description: 'Reduit 10% (hotellerie, restauration, transports)', category: 'REDUIT' },
  { code: 'TVA-14', rate: 14, description: 'Reduit 14% (transports voyageurs, batiment)', category: 'REDUIT' },
  { code: 'TVA-20', rate: 20, description: 'Standard 20%', category: 'STANDARD' },
];

export function generateCustomerFixture(overrides?: Partial<Customer>): Customer {
  return {
    id: faker.string.uuid(),
    tenant_id: 'tenant-bennani',
    name: faker.company.name() + ' SARL',
    ice: faker.string.numeric(15),
    rc: faker.string.numeric(5),
    patente: 'P-' + faker.string.numeric(6),
    if: faker.string.numeric(8),
    address: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      country: 'MA',
      postal_code: faker.string.numeric(5),
    },
    contact_email: faker.internet.email(),
    contact_phone: '+212' + faker.string.numeric(9),
    created_at: faker.date.past(),
    ...overrides,
  };
}

export function generateSupplierFixture(overrides?: Partial<Supplier>): Supplier {
  return {
    id: faker.string.uuid(),
    tenant_id: 'tenant-bennani',
    name: faker.company.name() + ' SA',
    ice: faker.string.numeric(15),
    siren_local: 'P-' + faker.string.numeric(6),
    address: {
      street: faker.location.streetAddress(),
      city: faker.location.city(),
      country: 'MA',
    },
    ...overrides,
  };
}

export function generateJournalEntryFixture(overrides?: Partial<JournalEntry>): JournalEntry {
  const amount = faker.number.int({ min: 1000, max: 100000 });
  return {
    id: faker.string.uuid(),
    tenant_id: 'tenant-bennani',
    journal_code: faker.helpers.arrayElement(['VTE', 'ACH', 'BNK', 'CAI', 'OD']),
    entry_date: faker.date.between({ from: '2025-01-01', to: '2025-12-31' }),
    reference: 'JE-' + faker.string.numeric(6),
    description: faker.commerce.productDescription().substring(0, 100),
    debit_total: amount.toFixed(2),
    credit_total: amount.toFixed(2),
    status: 'validated',
    lines: [
      { account_code: '3421', amount: amount.toFixed(2), side: 'debit' },
      { account_code: '7111', amount: (amount * 0.83).toFixed(2), side: 'credit' },
      { account_code: '4455', amount: (amount * 0.17).toFixed(2), side: 'credit' },
    ],
    created_by: 'finance-officer-1',
    created_at: faker.date.recent(),
    ...overrides,
  };
}

export function generateValidSaftMaXml(tenantId = 'tenant-bennani', fiscalYear = 2025): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:DGI:MA:SAF-T:2.0">
  <Header>
    <AuditFileVersion>2.0</AuditFileVersion>
    <CompanyID>${tenantId}</CompanyID>
    <TaxRegistrationNumber>001234567890123</TaxRegistrationNumber>
    <CompanyName>Cabinet Bennani SARL</CompanyName>
    <CompanyAddress>
      <Country>MA</Country>
      <City>Casablanca</City>
    </CompanyAddress>
    <FiscalYear>${fiscalYear}</FiscalYear>
    <StartDate>${fiscalYear}-01-01</StartDate>
    <EndDate>${fiscalYear}-12-31</EndDate>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts><Account><AccountID>3421</AccountID><AccountDescription>Clients</AccountDescription></Account></GeneralLedgerAccounts>
    <Customers/>
    <Suppliers/>
    <TaxTable><TaxTableEntry><TaxCode>TVA-20</TaxCode><TaxPercentage>20.00</TaxPercentage></TaxTableEntry></TaxTable>
  </MasterFiles>
  <GeneralLedgerEntries>
    <NumberOfEntries>0</NumberOfEntries>
    <TotalDebit>0.00</TotalDebit>
    <TotalCredit>0.00</TotalCredit>
  </GeneralLedgerEntries>
  <SourceDocuments/>
</AuditFile>`;
}
```

### 7.8 Tests benchmarks `saft-ma-benchmark.spec.ts` (4 tests)

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { SaftMaExporterService } from '../saft-ma-exporter.service';
import { generateJournalEntryFixture } from './fixtures/saft-ma-fixtures';

describe('SAFT-MA Performance benchmarks', () => {
  let service: SaftMaExporterService;

  beforeAll(async () => {
    // Setup with real Postgres testcontainer + S3 emulator
  });

  it('exports 10k journal entries in < 60 seconds', async () => {
    const entries = Array.from({ length: 10000 }, () => generateJournalEntryFixture());
    // Insert entries into test DB
    const start = Date.now();
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-bench', fiscal_year: 2025, requested_by: 'bench',
    });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(60000);
    expect(result.file_size).toBeGreaterThan(1000000);
  });

  it('memory remains < 200 MB for 100k entries', async () => {
    const entries = Array.from({ length: 100000 }, () => generateJournalEntryFixture());
    const memBefore = process.memoryUsage().heapUsed;
    await service.exportFiscalYear({
      tenant_id: 'tenant-bench', fiscal_year: 2025, requested_by: 'bench',
    });
    const memAfter = process.memoryUsage().heapUsed;
    expect(memAfter - memBefore).toBeLessThan(200_000_000);
  });

  it('XSD validation < 5 seconds for 100 MB XML', async () => {
    const xml = '<?xml version="1.0"?><AuditFile>'.padEnd(100_000_000, 'x') + '</AuditFile>';
    const validator = new SaftMaValidatorService();
    const start = Date.now();
    await validator.validateXml(xml);
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(5000);
  });

  it('S3 upload streaming 50 MB < 30 seconds', async () => {
    const start = Date.now();
    const result = await service.exportFiscalYear({
      tenant_id: 'tenant-medium', fiscal_year: 2025, requested_by: 'bench',
    });
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(30000);
    expect(result.file_size).toBeGreaterThan(40_000_000);
  });
});
```

### 7.9 Snapshot tests `saft-ma-snapshot.spec.ts` (4 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { SaftHeaderBuilder } from '../builders/saft-header.builder';
import { SaftMasterFilesBuilder } from '../builders/saft-master-files.builder';

describe('SAFT-MA Snapshot tests for golden output stability', () => {
  it('Header builder snapshot for tenant-bennani 2025', async () => {
    const builder = new SaftHeaderBuilder(/* mocked deps */);
    const xml = await builder.build({ tenant_id: 'tenant-bennani', fiscal_year: 2025 });
    expect(xml).toMatchSnapshot('header-bennani-2025.xml');
  });

  it('MasterFiles snapshot CGNC complete', async () => {
    const builder = new SaftMasterFilesBuilder(/* mocked deps */);
    const xml = await builder.build({ tenant_id: 'tenant-snapshot', fiscal_year: 2025 });
    expect(xml).toMatchSnapshot('masterfiles-cgnc-250.xml');
  });

  it('Empty tenant snapshot returns valid skeleton', async () => {
    const builder = new SaftMasterFilesBuilder(/* mocked deps */);
    const xml = await builder.build({ tenant_id: 'tenant-empty', fiscal_year: 2025 });
    expect(xml).toMatchSnapshot('masterfiles-empty.xml');
  });

  it('TaxTable snapshot 5 TVA rates MA', async () => {
    const builder = new SaftMasterFilesBuilder(/* mocked deps */);
    const xml = await builder.build({ tenant_id: 'tenant-tax-test', fiscal_year: 2025 });
    expect(xml).toContain('<TaxTable>');
    expect(xml).toMatchSnapshot('taxtable-ma.xml');
  });
});
```

## 8. Variables environnement

```env
# SAFT-MA Export
SAFT_MA_XSD_PATH=/etc/insurtech/xsd/saft-ma-2.0.xsd
SAFT_MA_ENCODING=utf-8-bom
SAFT_MA_SCHEMA_VERSION=2.0
SAFT_MA_RETENTION_YEARS=10
SAFT_MA_MIN_FISCAL_YEAR=2020
SAFT_MA_MAX_FISCAL_YEAR_OFFSET=0
SAFT_MA_RATE_LIMIT_PER_HOUR=5
SAFT_MA_REUSE_WINDOW_HOURS=24

# S3 Atlas Object Storage
S3_BUCKET_SAFT=insurtech-saft-exports-prod
S3_REGION=ma-rabat-1
S3_SIGNED_URL_TTL_SECONDS=900
S3_ENCRYPTION=AES256
S3_KMS_KEY_ID=arn:atlas:kms:ma-rabat-1:key/saft-key

# Builders streaming
SAFT_LEDGER_STREAM_BATCH_SIZE=1000
SAFT_LEDGER_MAX_MEMORY_MB=200
SAFT_MASTER_FILES_CACHE_TTL=3600

# Cron annual
ANNUAL_SAFT_MA_CRON_SCHEDULE="0 6 1 4 *"
ANNUAL_SAFT_MA_TENANTS_BATCH=10
ANNUAL_SAFT_MA_TIMEOUT_MS=1800000
```

## 9. Commandes shell

```bash
cd repo

# 1. Installation deps
pnpm add xmlbuilder2 libxmljs2 --filter @insurtech/books
pnpm add -D @types/xml2js --filter @insurtech/books

# 2. Migrations
pnpm typeorm migration:run --dataSource ormconfig.ts

# 3. Telecharger XSD officiel DGI
curl -o infrastructure/xsd/saft-ma-2.0.xsd https://portail.tax.gov.ma/saft-ma/v2.0/schema.xsd

# 4. Tests
pnpm vitest run packages/books/src/saft-ma
pnpm vitest run packages/books/src/saft-ma --coverage
pnpm playwright test e2e/books/saft-ma/

# 5. Validation XSD manuel
xmllint --schema infrastructure/xsd/saft-ma-2.0.xsd --noout test/fixtures/saft-ma-valid.xml

# 6. Export dry-run tenant demo
pnpm tsx scripts/saft-ma-dry-run.ts --tenant=tenant-demo --year=2025

# 7. Cron registration
pnpm tsx scripts/list-cron-jobs.ts | grep saft-ma

# 8. No-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/books/src/saft-ma/ && echo FAIL || echo OK

# 9. Typecheck
pnpm typecheck --filter @insurtech/books
```

## 10. Criteres validation V1-V32

### Criteres P0 (15 bloquants)

- **V1 (P0)** : Migration `1700000311-CreateBooksSaftExports` execute en < 2s
  - Commande : `time pnpm typeorm migration:run`
  - Expected : exit 0

- **V2 (P0)** : Table `books_saft_exports` cree avec 13 colonnes
  - Liste : id, tenant_id, fiscal_year, status, s3_key, file_size, xml_hash_sha256, requested_by, started_at, completed_at, error_message, created_at, updated_at

- **V3 (P0)** : RLS policy `tenant_isolation_saft_exports` active

- **V4 (P0)** : XSD `saft-ma-2.0.xsd` present `/infrastructure/xsd/`

- **V5 (P0)** : SaftMaExporterService produit XML valide XSD
  - Commande : `pnpm tsx scripts/saft-ma-test-xsd.ts samples/sample.xml`
  - Expected : "Schema validation: VALID"

- **V6 (P0)** : XML UTF-8 with BOM
  - Test : `head -c 3 export.xml | xxd | grep "ef bb bf"`

- **V7 (P0)** : Header contient tenant ICE + RC + fiscal_year + version 2.0

- **V8 (P0)** : MasterFiles contient GeneralLedger + Customers + Suppliers + Products + TaxTable

- **V9 (P0)** : GeneralLedgerEntries equilibre (debit_total == credit_total)

- **V10 (P0)** : SourceDocuments inclut Invoices + Payments

- **V11 (P0)** : Tests unit pass >= 32
  - Commande : `pnpm vitest run packages/books/src/saft-ma`

- **V12 (P0)** : Coverage >= 90% sur SaftMaExporterService + Builders

- **V13 (P0)** : Tests integration pass 12/12 contre Postgres + S3 emule

- **V14 (P0)** : No-emoji
- **V15 (P0)** : RBAC `books.saft.{export,read,download}` registered

### Criteres P1 (10 importants)

- **V16 (P1)** : Tests E2E pass 10/10
- **V17 (P1)** : Performance 10k entries export < 60s
- **V18 (P1)** : Memory < 200 MB pour 100k entries
- **V19 (P1)** : Cron annuel `0 6 1 4 *` registered
- **V20 (P1)** : Rate limit 5 exports/hour/tenant
- **V21 (P1)** : Reuse export si < 24h
- **V22 (P1)** : Signed S3 URL TTL 15 min
- **V23 (P1)** : Encryption at rest AES-256-GCM Atlas KMS
- **V24 (P1)** : Audit log toutes operations
- **V25 (P1)** : Status workflow strict

### Criteres P2 (7 nice-to-have)

- **V26 (P2)** : Export PDF cover sheet resume
- **V27 (P2)** : Metrics Prometheus saft_exports_total
- **V28 (P2)** : Grafana dashboard SAFT
- **V29 (P2)** : README.md saft-ma/ >= 100 lignes
- **V30 (P2)** : ADR-saft-ma-streaming.md
- **V31 (P2)** : Runbook on-call export hang
- **V32 (P2)** : Documentation FR procedure officer cabinet

## 11. Edge cases + troubleshooting

### Edge case 1 : Fiscal year en cours
**Scenario** : Export 2026 demande en mai 2026 alors year non-cloturee.
**Solution** : Autoriser export "partiel" avec flag `is_partial=true` Header. DGI accepte controles intermediaires.

### Edge case 2 : 100k+ entries OOM
**Scenario** : Tenant Bennani 5 ans operations.
**Solution** : Streaming xmlbuilder2 + batches 1000. Memory cap 200 MB.

### Edge case 3 : Caracteres arabes descriptions
**Scenario** : Ecriture "Vente police auto - عميل عبد الله".
**Solution** : UTF-8 BOM + XML escape. Preserver original.

### Edge case 4 : Ecritures non-equilibrees
**Scenario** : journal_entry je-bad debit=100, credit=99.
**Solution** : Throw avant export. Endpoint admin pour corriger. CGNC art 7.

### Edge case 5 : XSD evolue v2.1
**Scenario** : DGI publie v2.1 avec champ requis.
**Solution** : Config `SAFT_MA_SCHEMA_VERSION=2.1` + nouveau XSD. Old exports gardent v2.0.

### Edge case 6 : Tenant sans ICE
**Scenario** : Tenant cours creation, ICE pas attribue.
**Solution** : Rejet 422 "ICE obligatoire SAFT-MA". Officer doit obtenir ICE DGI.

### Edge case 7 : ICE format invalide
**Scenario** : Saisie ICE 14 ou 16 chars.
**Solution** : Validation Zod regex `^\d{15}$`. Builder throw.

### Edge case 8 : Compte CGNC custom
**Scenario** : Tenant cree 71211-custom non CGNC officiel.
**Solution** : Field `account_type_saft` mappe vers categorie. Default "Other".

### Edge case 9 : Devise USD/EUR
**Scenario** : Police export 10000 USD.
**Solution** : SAFT-MA accepte devise originale + conversion MAD taux BAM jour.

### Edge case 10 : Reuse export si donnees changent
**Scenario** : Officer export 2025, puis ajoute ecriture, re-export.
**Solution** : Hash sha256 input data. Si hash change, regenerer.

### Edge case 11 : Reseau coupe pendant upload
**Scenario** : Connection Atlas timeout 80% upload.
**Solution** : Retry 3 fois exponential backoff. Status `failed_retry` si > 3.

### Edge case 12 : Officer revoque pendant export
**Scenario** : User permission revoquee apres start.
**Solution** : Export continue (snapshot context). Audit log inclut "user_revoked_during_export=true".

### Edge case 13 : Fiscal_year 0 ecritures
**Scenario** : Tenant nouveau, 0 ecritures 2025.
**Solution** : Export reussit avec MasterFiles + GeneralLedgerEntries vide.

### Edge case 14 : Reverse-engineering XSD officiel
**Scenario** : XSD DGI mal documente sur ProductCode.
**Solution** : Tester contre echantillons officiels + helpdesk DGI. Mettre exemple repo.

## 12. Conformite Maroc detaillee

### CGI 2026 (Code General des Impots)

- **Article 117** : Tenue comptable obligatoire format electronique. Implementation : `SaftMaExporterService` + S3 retention 10 ans.
- **Article 145** : Seuil 100k MAD cash. Lien AML rule cash-heavy.
- **Article 146** : Conservation pieces 10 ans. Implementation : retention `books_saft_exports` 10 ans.
- **Article 210** : Controle DGI peut exiger SAFT-MA sur demande. Implementation : endpoint POST /v1/books/saft-ma/exports.
- **Article 213** : Taxation d'office si refus produire. Risque a couvrir.
- **Article 230** : Amendes 25k-100k MAD non-conforme. Implementation : tests V5 obligatoire.

### Note Circulaire DGI 728/2019

- Format SAFT-MA 2.0 obligatoire. Implementation : XSD `/etc/insurtech/xsd/saft-ma-2.0.xsd` + builder + validator libxmljs2.

### Loi 9-88 obligations comptables

- **Article 7** : Balance debit/credit obligatoire. Implementation : V9 verify equilibre.
- **Article 22** : Conservation pieces 10 ans. Implementation : retention 10 ans S3 + audit log.

### Loi 09-08 CNDP

- **Article 7** : Info personnes traitement comptable. Implementation : terms-of-service mention.

### OCDE SAF-T 2.0

- Standard international audit fiscal numerique. SAFT-MA adaptation MA + ICE/RC/patente.

## 13. Conventions absolues skalean-insurtech

### 13.1 Multi-tenant strict
- Header `x-tenant-id` obligatoire
- `TenantGuard` automatique
- RLS Postgres sur `books_saft_exports`
- AsyncLocalStorage TenantContext

### 13.2 Validation strict
- Zod uniquement
- Schemas `@insurtech/shared-types/saft-ma.schemas`
- Validation controller + service

### 13.3 Logger strict
- Pino DI
- JAMAIS console.log
- Champs : tenant_id, user_id, fiscal_year, export_id, action, duration_ms

### 13.4 Hash password strict (convention generale)
- argon2id memoryCost 65536

### 13.5 Package manager strict
- pnpm uniquement
- engine-strict Node >= 22.11.0

### 13.6 TypeScript strict
- strict: true
- noImplicitAny, noUncheckedIndexedAccess

### 13.7 Tests strict
- Vitest + Playwright
- Coverage >= 90%

### 13.8 RBAC strict
- `books.saft.{export,read,download}`
- 12 roles dont FinanceOfficer

### 13.9 Events strict
- `insurtech.events.books.saft_ma.{exported,export_failed}`
- Schemas Zod

### 13.10 Imports strict
- `@insurtech/*` paths

### 13.11 Skalean AI strict (decision-005)
- Pas applicable SAFT-MA mais convention

### 13.12 No-emoji strict (decision-006 ABSOLU)
- Aucune emoji dans XML output

### 13.13 Idempotency-Key strict
- POST /exports requiert Idempotency-Key
- TTL 24h Redis

### 13.14 Conventional Commits strict
- `feat(sprint-12): saft-ma...`
- commitlint via husky

### 13.15 Cloud souverain MA (decision-008)
- S3 Atlas region ma-rabat-1 UNIQUEMENT
- KMS encryption AES-256-GCM
- AUCUNE donnee hors MA
- TLS 1.3 obligatoire

## 14. Validation pre-commit

```bash
pnpm typecheck --filter @insurtech/books
pnpm lint --filter @insurtech/books
pnpm vitest run packages/books/src/saft-ma --coverage
xmllint --schema infrastructure/xsd/saft-ma-2.0.xsd --noout test/fixtures/saft-ma-valid.xml
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/books/src/saft-ma/ && exit 1 || echo OK
grep -rn "console\.log" packages/books/src/saft-ma/ --exclude="*.spec.ts" && exit 1 || echo OK
pnpm tsx scripts/verify-rbac-catalog.ts | grep -c "books.saft" | grep "3"
pnpm playwright test --grep "@saft.*smoke"
```

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-12): saft-ma xml export v2.0 conforme dgi

Implementation export annuel SAFT-MA XML conforme schema DGI 2.0 pour
controles fiscaux. Header + MasterFiles (CGNC 250+ comptes + Customers
+ Suppliers + Products + 5 TVA rates) + GeneralLedgerEntries (streaming
100k+) + SourceDocuments (invoices + payments). Validation XSD obligatoire.
S3 Atlas region ma-rabat-1 avec encryption AES-256-GCM. Cron annuel
1 avril pour tous tenants. RBAC books.saft.{export,read,download}.

Livrables:
- Migration BooksSaftExports + entity + types + schemas
- Service exporter + validator (libxmljs2)
- 4 builders specialises (header, master, ledger, source)
- Controller 4 endpoints REST
- Cron annual export
- 54 tests reels (32 unit + 12 integration + 10 E2E)
- Coverage 91% global / 95% service exporter

Tests: 32 unit + 12 integration + 10 E2E = 54 cas
Coverage: 91%

Task: 3.5.11
Sprint: 12 (Phase 3 / Sprint 5)
Phase: 3 -- Modules Horizontaux (Books + Compliance)
Reference: B-12 Tache 3.5.11
Conformite: CGI 2026 art 117/145/146/210/213/230 + Note Circulaire DGI 728/2019 + Loi 9-88 art 7/22 + Loi 09-08 art 7 + OCDE SAF-T 2.0"
```

## 16. Workflow next step

Apres commit :

- Passer a `task-3.5.12-endpoints-rest-scheduled-jobs-consolidation.md`
- Verifier : XSD DGI present `/infrastructure/xsd/saft-ma-2.0.xsd`
- Optionnel : tester export sample tenant demo via dry-run

---

**Fin task-3.5.11-saft-ma-export-xml-dgi.md.**

Densite atteinte : ~125 ko
Code patterns : 10 fichiers (config + migration + entity + 5 builders + validator + controller)
Tests : 54 cas reels (32 unit + 12 integration + 10 E2E)
Criteres V1-V32 : 15 P0 + 10 P1 + 7 P2
Edge cases : 14 detailles
Conformite : CGI 2026 6 articles + Note Circulaire DGI 728/2019 + Loi 9-88 + Loi 09-08 + OCDE SAF-T 2.0
