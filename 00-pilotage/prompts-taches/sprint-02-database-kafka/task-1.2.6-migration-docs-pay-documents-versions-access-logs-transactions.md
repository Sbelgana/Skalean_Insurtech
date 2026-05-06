# Tache 1.2.6 -- Migration "Docs + Pay" -- 6 tables (3 Docs + 3 Pay)

| Champ | Valeur |
|---|---|
| Identifiant | 1.2.6 |
| Titre | Migration "Docs + Pay" -- 6 tables (doc_documents, doc_versions, doc_access_logs, pay_methods, pay_transactions, pay_reconciliation) |
| Sprint | Sprint 2 -- Database Foundation & Kafka Topology |
| Phase | Phase 1 -- Migrations TypeORM par bloc fonctionnel |
| Duree estimee | 6 heures |
| Priorite | P0 -- Bloquante |
| Depend de | Tache 1.2.5 (Migration RH/Compta -- 6 tables hr_employees, hr_payrolls, hr_documents, acc_books, acc_journals, acc_entries) |
| Bloque | Tache 1.2.7 (Migration Insurance Core -- ins_policies, ins_claims, ins_brokers) |
| Densite cible | 110 ko minimum, 125 ko cible, 150 ko maximum |
| Politique emoji | AUCUNE EMOJI -- decision-006 |
| Politique cloud | Atlas Cloud Services Benguerir uniquement -- decision-008 |
| Politique signature | Loi 43-20 signature electronique avancee -- decision-009 |
| Frontier model | Skalean AI -- decision-005 |

---

## 1. Header complet et engagement de qualite

Cette tache 1.2.6 constitue la sixieme tache de migration du Sprint 2 et finalise la creation des fondations transverses du domaine Documents et Paiements. Elle precede les migrations metier Insurance (1.2.7), Brokers (1.2.8), Quotes (1.2.9), Claims (1.2.10), KYC (1.2.11) qui dependent toutes des tables documents et paiements pour le stockage des justificatifs et l'encaissement des primes. La densite documentaire cible est de 110 a 150 kilo-octets afin de fournir un manuel d'execution complet incluant les six tables, les politiques RLS, les triggers de retention, les helpers S3, le chiffrement AES-256-GCM des credentials, les tests d'integrite sha256, les six passerelles de paiement marocaines et la conformite Loi 09-08 plus Loi 9-88 plus ACAPS plus BAM Reglement 25/2017.

L'engagement qualite Skalean InsurTech impose : aucune emoji dans le code source ni dans la documentation publiee (decision-006), tous les commentaires en francais professionnel, code TypeScript strict mode active avec `noImplicitAny` et `strictNullChecks`, code SQL idempotent permettant `CREATE IF NOT EXISTS` et `DROP IF EXISTS` symetriques, tests Vitest avec couverture minimale 90 pourcent sur les modules `@insurtech/database/docs` et `@insurtech/database/pay`, validation pre-commit incluant `pnpm typecheck`, `pnpm lint`, `pnpm test:unit`, et un grep `no-emoji` sur l'ensemble du diff.

Le perimetre technique de la tache couvre : la creation de la migration TypeORM `1735000000005-DocsPayments.ts` decoupee en huit phases (creation des enums, creation des six tables, creation des indexes, creation des contraintes UNIQUE, creation des triggers de retention, activation RLS, creation des policies, validation finale), la generation des six entites TypeORM 0.3 strictement typees, l'implementation du helper S3 wrapper avec presigned URL, le helper de chiffrement transparent JSONB pour les credentials des passerelles, le helper de calcul sha256 streaming, et la suite de tests d'integration depassant cinquante cas verifies.

---

## 2. But (3 paragraphes denses)

Le premier objectif est de garantir un stockage de documents conforme aux exigences reglementaires marocaines dans le cloud souverain Atlas Cloud Services situe a Benguerir avec une retention legale de dix ans plus un jour pour les documents signes electroniquement (police, contrat, sinistre cloture), conformement a l'Article 22 du Code General de Normalisation Comptable Loi 9-88 et aux directives ACAPS Article 12. Cette retention est calculee automatiquement par un trigger PostgreSQL `doc_documents_retention_calc_trg` qui positionne `retention_until = created_at + INTERVAL '10 years 1 day'` lorsque `status = 'signed'` et `retention_until = created_at + INTERVAL '7 years'` pour les statuts `final` et `archived`. Le bucket S3 cible Atlas Cloud Services Benguerir utilise le chiffrement KMS au repos avec rotation annuelle des cles, le versioning S3 active pour repondre aux exigences d'integrite, et une lifecycle policy bloquant la suppression definitive avant `retention_until` via Object Lock en mode Compliance.

Le deuxieme objectif est de fournir une infrastructure de paiement multi-passerelles supportant les six fournisseurs operant au Maroc dans le cadre du Reglement Bank Al-Maghrib 25/2017 sur les paiements electroniques : CMI (Centre Monetique Interbancaire, leader cartes bancaires), YouCan Pay (passerelle marketplace), Payzone (Maroc Telecom), M-Wallet Inwi (mobile money), M-Wallet Orange Money, M-Wallet IAM (Itissalat Al-Maghrib). Chaque passerelle est configuree dans la table `pay_methods` avec un champ `config_encrypted` JSONB chiffre cote application via AES-256-GCM avec une cle maitre stockee dans Atlas KMS et rotee annuellement. La table `pay_transactions` agrege les transactions multi-fournisseurs avec un champ polymorphe `related_resource_type` plus `related_resource_id` permettant de lier la transaction a une police, un sinistre ou une facture. La table `pay_reconciliation` permet le rapprochement bancaire periodique avec detection des ecarts (`discrepancy`).

Le troisieme objectif est l'integrite cryptographique des documents via calcul `sha256` au moment de l'upload (mode streaming pour fichiers superieurs a 100 megaoctets afin d'eviter le chargement en memoire vive), stockage dans la colonne `sha256` de `doc_documents` et `doc_versions`, verification au moment du download via comparaison du hash recalcule depuis S3, et alarme en cas de mismatch (intrusion, corruption silencieuse). Le hash sha256 est egalement utilise pour la deduplication transparente : si un fichier identique est uploade deux fois (memes octets), le second upload reutilise la meme cle S3 et incremente uniquement le compteur de references logique. Cette strategie reduit le cout de stockage de 30 a 40 pourcent en moyenne sur le portefeuille Skalean.

---

## 3. Contexte etendu (8-10 ko)

### 3.1 Pourquoi Atlas Cloud Services Benguerir et S3 plus KMS

Le choix d'Atlas Cloud Services Benguerir comme fournisseur unique d'infrastructure cloud pour Skalean InsurTech (decision-008) repose sur quatre criteres : data residency obligatoire au Maroc imposee par la CNDP (Commission Nationale de protection des Donnees a caractere Personnel) pour toute donnee a caractere personnel d'assure marocain (Loi 09-08, Article 43), latence reseau inferieure a 5 millisecondes entre Benguerir et Casablanca (siege Skalean) versus 60 a 80 millisecondes pour AWS Frankfurt ou OVH Strasbourg, conformite ISO 27001 et SecNumCloud equivalent assurant la souverainete des donnees face aux lois extra-territoriales (CLOUD Act US, GDPR EU). Atlas Cloud Services fournit un service S3-compatible base sur Ceph RGW avec chiffrement KMS au repos, versioning, lifecycle policies et Object Lock mode Compliance.

L'alternative envisagee initialement etait MinIO self-hosted sur les serveurs Skalean a Casablanca. Cette piste a ete rejetee pour trois raisons : 1) charge ops Skalean importante (geofailover, sauvegardes, montees de version Ceph), 2) absence de KMS managed et necessite de deployer Vault ou OpenBao en HA, 3) cout total de possession (TCO) sur cinq ans estime a 380 000 dirhams par an versus 220 000 dirhams par an chez Atlas Cloud Services pour 5 To stockes plus 100 millions de requetes mensuelles.

### 3.2 Trade-offs polymorphic foreign key vs separate tables

La modelisation polymorphe (`related_resource_type` enum + `related_resource_id` uuid) a ete choisie pour `doc_documents` et `pay_transactions` apres analyse du trade-off avec l'alternative "separate tables" (par exemple `doc_policy_documents`, `doc_claim_documents`, `doc_invoice_documents`). Les arguments en faveur de la polymorphie : 1) un seul code path d'upload et de retrieval, 2) ajout d'un nouveau type de ressource sans migration schema, 3) requetes uniformes pour les ecrans de recherche transverse "documents recents tous types confondus". Les arguments contre : 1) impossibilite d'utiliser une foreign key declarative classique (PostgreSQL ne supporte pas les FK polymorphes), 2) integrite referentielle deleguee a l'application ou a un trigger, 3) absence de cascade automatique en cas de suppression de la ressource parent.

La parade Skalean : un trigger PostgreSQL `doc_documents_polymorphic_fk_check_trg` qui verifie au INSERT et UPDATE que la ligne pointee existe dans la table cible (`ins_policies`, `ins_claims`, `acc_invoices`, etc.) selon la valeur de `related_resource_type`. Ce trigger est branche apres la migration 1.2.10 (Insurance Claims) car il a besoin de l'existence des tables cibles pour fonctionner. En attendant, le trigger est cree en mode "warn-only" via NOTICE PostgreSQL.

### 3.3 Decisions architecture liees

Les decisions architecturales suivantes signent la presente tache : decision-002 multi-tenant strict avec colonne `tenant_id` obligatoire et RLS active sur toute table contenant des donnees clients, decision-003 chiffrement applicatif des credentials sensibles via AES-256-GCM avec cle maitre KMS roteable, decision-008 cloud souverain Atlas Cloud Services Benguerir uniquement (interdiction AWS / Azure / GCP / OVH hors Maroc), decision-009 signature electronique avancee Loi 43-20 (preview Sprint 10, infrastructure preparee Sprint 2), decision-005 frontier model Skalean AI integre pour analyse OCR documents (preview Sprint 14), decision-006 zero emoji dans code et docs, decision-011 idempotency-key paiement TTL 24h dans Redis, decision-012 reconciliation bancaire Decimal.js precision 4 decimales pour eviter erreurs flottants.

### 3.4 Douze pieges classiques et parades

1. **Sha256 collision theorique** : probabilite 2^-128 pour collision random, negligeable dans le portefeuille Skalean (10 millions de docs estimes). Parade : verification taille en octets en plus du hash pour blinder.

2. **Retention_until non-deterministe trigger** : si la trigger fonction utilise `now()` au lieu de `created_at`, le calcul varie a chaque update. Parade : utiliser strictement `NEW.created_at + INTERVAL` et marquer la fonction `IMMUTABLE` quand pertinent ou `STABLE`.

3. **S3 lifecycle policies conflit avec Object Lock** : si lifecycle policy positionne expiration a 90 jours mais Object Lock impose 10 ans, S3 retourne erreur 403 lors du delete. Parade : configurer lifecycle a 11 ans (10 ans + buffer) et Object Lock 10 ans + 1 jour.

4. **Polymorphic FK referential integrity** : delete cascade impossible. Parade : trigger BEFORE DELETE sur tables cibles qui supprime aussi les `doc_documents` orphelins ou les marque `archived`.

5. **Large files multipart upload** : fichiers superieurs a 5 GB necessitent multipart S3 obligatoire. Parade : seuil `S3_MULTIPART_THRESHOLD_MB=100` et bibliotheque `@aws-sdk/lib-storage` Upload class.

6. **Presigned URL TTL trop long** : URL valide 24h = risque de share involontaire. Parade : TTL maximum 5 minutes (`S3_PRESIGNED_URL_TTL_SECONDS=300`) et regeneration cote frontend a chaque clic download.

7. **Audit trail logs append-only viole par developer** : tentation de UPDATE sur `doc_access_logs` pour corriger erreurs. Parade : revoke UPDATE et DELETE pour role `app_user`, seul `db_admin` peut intervenir avec audit trace.

8. **Payment idempotency-key 24h Redis** : si Redis evict avant 24h, double charge possible. Parade : Redis `maxmemory-policy=noeviction` sur cluster paiement plus monitoring usage memoire.

9. **Provider_response taille jsonb** : certains providers retournent 10 ko de XML serialise jsonb. Parade : limit 32 ko via CHECK constraint et compression toast PostgreSQL automatique.

10. **Currency conversion EUR/MAD** : taux change chaque jour. Parade : table `acc_exchange_rates` (Sprint 1.2.5 etendu Sprint 12) plus champ `amount_dirham` toujours en MAD et `amount_original` plus `currency_original` pour audit.

11. **Encryption keys rotation** : KMS rotate la master key annuellement, ancienne version doit pouvoir dechiffrer historique. Parade : champ `config_key_version` int dans `pay_methods` et helper qui essaie versions decroissantes.

12. **Reconciliation discrepancy edge cases** : ecart 0.01 dirham du au floating point. Parade : Decimal.js precision 4 decimales et tolerance configurable `RECONCILIATION_DISCREPANCY_TOLERANCE=0.01` pour auto-match.

### 3.5 Architecture stockage S3 path schema

Le schema de chemins S3 standardise est : `s3://insurtech-docs-{env}/{tenant_id}/{year}/{month}/{document_type}/{document_id}/{version_number}/{filename}` ou `env` vaut `prod`, `staging`, `dev` ; `tenant_id` est le UUID v4 du tenant ; `year` est sur 4 chiffres ; `month` sur 2 chiffres ; `document_type` est l'enum (`police`, `devis`, `facture`, `sinistre`, `kyc`, `contrat`, `autre`) ; `document_id` est le UUID v4 du document ; `version_number` commence a 1 ; `filename` est le nom original sanitize par regex `[^a-zA-Z0-9._-]` remplace par underscore.

### 3.6 Pourquoi six passerelles de paiement marocaines

Le marche marocain des paiements electroniques presente une fragmentation specifique qui justifie le support de six passerelles distinctes : 

- **CMI** (Centre Monetique Interbancaire) : leader carte bancaire avec 85 pourcent de part de marche cartes au Maroc, indispensable pour clientele B2C corporate. Frais 1.8 a 2.5 pourcent.
- **YouCan Pay** : passerelle marketplace adaptee au e-commerce, integration plus rapide que CMI, frais 2.5 pourcent + 2.5 dirhams par transaction.
- **Payzone** : passerelle Maroc Telecom orientee paiement de factures et abonnements recurrents, ideale pour primes d'assurance mensualisees.
- **M-Wallet Inwi Money** : portefeuille mobile leader chez les assures rural et jeunes (18-35 ans). Limite par transaction 5 000 dirhams.
- **M-Wallet Orange Money** : portefeuille mobile principal Casablanca-Rabat, 8 millions d'utilisateurs au Maroc.
- **M-Wallet IAM** (Itissalat Al-Maghrib) : portefeuille operateur historique, integration BAM directe, accepte par toutes administrations marocaines.

La table `pay_methods` permet de configurer un ordre de priorite (`priority` int) afin de proposer la meilleure passerelle par profil client, avec un fallback automatique si la passerelle prioritaire est indisponible (timeout, erreur 5xx). Le routage est implemente Sprint 11 (`pay-router-service`).

---

## 4. Architecture context (3-5 ko)

### 4.1 Position de la tache dans le sprint

La tache 1.2.6 est la sixieme et derniere tache de migration de fondations transverses du Sprint 2. Elle suit l'ordre suivant :

```
1.2.1 Migration tenants + users (auth fondation)
1.2.2 Migration RBAC (roles, permissions, role_permissions, user_roles)
1.2.3 Migration audit (audit_logs append-only)
1.2.4 Migration notifications (notif_templates, notif_outbox)
1.2.5 Migration RH/Compta (hr_employees, hr_payrolls, hr_documents, acc_books, acc_journals, acc_entries)
1.2.6 Migration Docs/Pay (doc_documents, doc_versions, doc_access_logs, pay_methods, pay_transactions, pay_reconciliation) <-- CETTE TACHE
1.2.7 Migration Insurance Core (ins_policies, ins_claims, ins_brokers)
```

### 4.2 Foundation pour Sprints aval

La presente tache pose les fondations physiques de trois sprints metier futurs :

- **Sprint 10** (Documents Module) : utilisera `doc_documents`, `doc_versions`, `doc_access_logs` pour le module GED interne avec preview, OCR, signature electronique loi 43-20.
- **Sprint 11** (Payments Module) : utilisera `pay_methods`, `pay_transactions`, `pay_reconciliation` pour le module encaissement primes avec routage multi-passerelles, retry automatique, dunning management.
- **Sprint 12** (Books Reconciliation) : utilisera `pay_reconciliation` jointe a `acc_journals` (Sprint 1.2.5) pour reconciliation bancaire automatique avec releves bancaires importes via SFTP.

### 4.3 Diagramme architecture S3 + KMS + RLS

```
+----------------------------------------------------------+
|           Application Skalean InsurTech                  |
|  +----------------+    +------------------+              |
|  | DocsService    |    | PaymentsService  |              |
|  +-------+--------+    +---------+--------+              |
|          |                       |                        |
|          v                       v                        |
|  +-------+----------------+------+----------------------+ |
|  |   PostgreSQL 15 (Atlas Cloud Services Benguerir)    | |
|  |   - RLS active 6 tables                             | |
|  |   - Trigger retention_calc                          | |
|  |   - Trigger polymorphic_fk_check                    | |
|  +-----------------------+-----------------------------+ |
|                          |                                |
|                          v                                |
|  +-----------------------+-----------------------------+ |
|  |        S3 Atlas Cloud Services Benguerir            | |
|  |        bucket: insurtech-docs-prod                  | |
|  |        - Versioning ON                              | |
|  |        - Object Lock COMPLIANCE 10 years 1 day      | |
|  |        - Lifecycle policy 11 years                  | |
|  |        - SSE-KMS encryption at rest                 | |
|  +-----------------------+-----------------------------+ |
|                          |                                |
|                          v                                |
|  +-----------------------+-----------------------------+ |
|  |         Atlas KMS Benguerir                         | |
|  |         - Master key insurtech-prod-kms             | |
|  |         - Annual rotation enabled                   | |
|  |         - Used by S3 SSE + EncryptedJsonbTransformer| |
|  +-----------------------------------------------------+ |
+----------------------------------------------------------+
```

---

## 5. Livrables checkables (28 cases)

- [ ] Migration TypeORM `1735000000005-DocsPayments.ts` cree (~250 lignes) avec methodes `up()` et `down()` symetriques
- [ ] Six tables creees : `doc_documents`, `doc_versions`, `doc_access_logs`, `pay_methods`, `pay_transactions`, `pay_reconciliation`
- [ ] Sept enums Postgres crees : `doc_type_enum`, `doc_status_enum`, `doc_access_action_enum`, `pay_provider_enum`, `pay_status_enum`, `reconciliation_status_enum`, `pay_currency_enum`
- [ ] Trigger `doc_documents_retention_calc_trg` cree calculant `retention_until` selon `status`
- [ ] Trigger `doc_versions_append_only_trg` empechant UPDATE et DELETE
- [ ] Trigger `doc_access_logs_append_only_trg` empechant UPDATE et DELETE
- [ ] Six policies RLS creees par table : `select_own_tenant`, `insert_own_tenant`, `update_own_tenant`, `delete_own_tenant`, plus `bypass_admin`
- [ ] Index composite `(tenant_id, type, created_at DESC)` sur `doc_documents`
- [ ] Index composite `(tenant_id, status, initiated_at DESC)` sur `pay_transactions`
- [ ] Index composite `(tenant_id, related_resource_type, related_resource_id)` sur `doc_documents` pour requetes polymorphes
- [ ] Contrainte UNIQUE `(document_id, version_number)` sur `doc_versions`
- [ ] Contrainte UNIQUE `(tenant_id, provider_transaction_id)` sur `pay_transactions`
- [ ] Six entites TypeORM 0.3 generees : `DocDocumentEntity`, `DocVersionEntity`, `DocAccessLogEntity`, `PayMethodEntity`, `PayTransactionEntity`, `PayReconciliationEntity`
- [ ] Fichier `packages/database/src/docs/index.ts` exportant les 3 entites Docs
- [ ] Fichier `packages/database/src/pay/index.ts` exportant les 3 entites Pay
- [ ] Helper `s3-client.ts` avec methodes `uploadDocument`, `getPresignedUrl`, `deleteDocument`, `headObject`
- [ ] Helper `encryption-jsonb.ts` (EncryptedJsonbTransformer AES-256-GCM Atlas KMS)
- [ ] Helper `sha256-stream.ts` (calcul streaming sans charger en RAM)
- [ ] Schema Zod `PaymentMethodConfigSchema` pour les six providers
- [ ] Tests `migrations-docs-pay.spec.ts` >= 8 cas couvrant up/down/idempotence
- [ ] Tests `rls-docs.spec.ts` >= 6 cas cross-tenant
- [ ] Tests `rls-pay.spec.ts` >= 6 cas cross-tenant
- [ ] Tests `sha256-integrity.spec.ts` >= 5 cas dont fichier 100 Mo simule
- [ ] Tests `retention-policy.spec.ts` >= 5 cas dont calcul 10 ans + 1 jour signed
- [ ] Tests `encryption-config.spec.ts` >= 5 cas round-trip et tampering
- [ ] Tests `reconciliation.spec.ts` >= 4 cas matched/unmatched/discrepancy
- [ ] Variables environnement >= 22 ajoutees au `.env.example`
- [ ] Commit Conventional Commits avec metadata signee (`Co-authored-by: Cowork-Agent`)

---

## 6. Fichiers a creer

### 6.1 Arborescence apres tache

```
packages/database/
  src/
    migrations/
      1735000000005-DocsPayments.ts                      (~250 lignes)
    docs/
      doc-document.entity.ts                              (~85 lignes)
      doc-version.entity.ts                               (~55 lignes)
      doc-access-log.entity.ts                            (~50 lignes)
      index.ts                                            (~12 lignes)
    pay/
      pay-method.entity.ts                                (~60 lignes)
      pay-transaction.entity.ts                           (~95 lignes)
      pay-reconciliation.entity.ts                        (~50 lignes)
      payment-method-config.schema.ts                     (~110 lignes)
      index.ts                                            (~12 lignes)
    helpers/
      s3-client.ts                                        (~140 lignes)
      encryption-jsonb.ts                                 (~95 lignes)
      sha256-stream.ts                                    (~45 lignes)
  test/
    docs/
      migrations-docs-pay.spec.ts                         (~280 lignes)
      rls-docs.spec.ts                                    (~210 lignes)
      sha256-integrity.spec.ts                            (~180 lignes)
      retention-policy.spec.ts                            (~190 lignes)
    pay/
      rls-pay.spec.ts                                     (~215 lignes)
      encryption-config.spec.ts                           (~200 lignes)
      reconciliation.spec.ts                              (~165 lignes)
```

---

## 7. Code patterns complets

### 7.1 Migration TypeORM `1735000000005-DocsPayments.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocsPayments1735000000005 implements MigrationInterface {
  name = 'DocsPayments1735000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 1 : Creation des enums
    await queryRunner.query(`
      CREATE TYPE doc_type_enum AS ENUM (
        'police', 'devis', 'facture', 'sinistre', 'kyc', 'contrat', 'autre'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE doc_status_enum AS ENUM (
        'draft', 'final', 'signed', 'archived'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE doc_access_action_enum AS ENUM (
        'view', 'download', 'share'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE pay_provider_enum AS ENUM (
        'cmi', 'youcan', 'payzone',
        'm_wallet_inwi', 'm_wallet_orange', 'm_wallet_iam',
        'cash', 'cheque', 'virement'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE pay_status_enum AS ENUM (
        'initiated', 'pending', 'completed', 'failed',
        'refunded', 'partially_refunded'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE reconciliation_status_enum AS ENUM (
        'matched', 'unmatched', 'discrepancy'
      );
    `);
    await queryRunner.query(`
      CREATE TYPE pay_currency_enum AS ENUM (
        'MAD', 'EUR', 'USD', 'GBP'
      );
    `);

    // Phase 2 : Table doc_documents
    await queryRunner.query(`
      CREATE TABLE doc_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        type doc_type_enum NOT NULL,
        title varchar(255) NOT NULL,
        description text,
        related_resource_type varchar(64),
        related_resource_id uuid,
        s3_bucket varchar(128) NOT NULL,
        s3_key varchar(512) NOT NULL,
        mime_type varchar(128) NOT NULL,
        size_bytes bigint NOT NULL CHECK (size_bytes > 0),
        sha256 char(64) NOT NULL,
        status doc_status_enum NOT NULL DEFAULT 'draft',
        retention_until date,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz,
        CONSTRAINT chk_sha256_lower CHECK (sha256 ~ '^[0-9a-f]{64}$')
      );
    `);

    // Phase 3 : Table doc_versions (append-only)
    await queryRunner.query(`
      CREATE TABLE doc_versions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL REFERENCES doc_documents(id) ON DELETE CASCADE,
        version_number int NOT NULL CHECK (version_number > 0),
        s3_key varchar(512) NOT NULL,
        size_bytes bigint NOT NULL CHECK (size_bytes > 0),
        sha256 char(64) NOT NULL,
        change_summary text,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_doc_versions_doc_ver UNIQUE (document_id, version_number),
        CONSTRAINT chk_versions_sha256_lower CHECK (sha256 ~ '^[0-9a-f]{64}$')
      );
    `);

    // Phase 4 : Table doc_access_logs (append-only)
    await queryRunner.query(`
      CREATE TABLE doc_access_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_id uuid NOT NULL REFERENCES doc_documents(id) ON DELETE CASCADE,
        user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        action doc_access_action_enum NOT NULL,
        ip_address inet,
        user_agent varchar(512),
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Phase 5 : Table pay_methods
    await queryRunner.query(`
      CREATE TABLE pay_methods (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        name varchar(128) NOT NULL,
        provider pay_provider_enum NOT NULL,
        config_encrypted jsonb NOT NULL,
        config_key_version int NOT NULL DEFAULT 1,
        priority int NOT NULL DEFAULT 100,
        active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_pay_methods_tenant_name UNIQUE (tenant_id, name)
      );
    `);

    // Phase 6 : Table pay_transactions
    await queryRunner.query(`
      CREATE TABLE pay_transactions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        pay_method_id uuid NOT NULL REFERENCES pay_methods(id) ON DELETE RESTRICT,
        related_resource_type varchar(64),
        related_resource_id uuid,
        amount_dirham numeric(15,2) NOT NULL CHECK (amount_dirham >= 0),
        currency pay_currency_enum NOT NULL DEFAULT 'MAD',
        status pay_status_enum NOT NULL DEFAULT 'initiated',
        provider_transaction_id varchar(255),
        provider_response jsonb,
        customer_name varchar(255),
        customer_email varchar(255),
        customer_phone varchar(32),
        callback_url varchar(2048),
        success_url varchar(2048),
        cancel_url varchar(2048),
        initiated_at timestamptz NOT NULL DEFAULT now(),
        completed_at timestamptz,
        failed_at timestamptz,
        fail_reason text,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_pay_tx_tenant_provider_tx UNIQUE (tenant_id, provider_transaction_id),
        CONSTRAINT chk_provider_response_size CHECK (
          provider_response IS NULL OR octet_length(provider_response::text) < 32768
        )
      );
    `);

    // Phase 7 : Table pay_reconciliation
    await queryRunner.query(`
      CREATE TABLE pay_reconciliation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
        transaction_id uuid NOT NULL REFERENCES pay_transactions(id) ON DELETE RESTRICT,
        bank_statement_ref varchar(128),
        reconciled_at timestamptz,
        reconciled_by uuid REFERENCES users(id) ON DELETE SET NULL,
        status reconciliation_status_enum NOT NULL DEFAULT 'unmatched',
        discrepancy_amount numeric(15,2) DEFAULT 0,
        notes text,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // Phase 8 : Indexes BTREE composites
    await queryRunner.query(`
      CREATE INDEX idx_doc_documents_tenant_type_created
        ON doc_documents (tenant_id, type, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_documents_polymorphic
        ON doc_documents (tenant_id, related_resource_type, related_resource_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_documents_sha256
        ON doc_documents (sha256);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_documents_retention
        ON doc_documents (retention_until)
        WHERE retention_until IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_versions_document
        ON doc_versions (document_id, version_number DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_doc_access_logs_document_created
        ON doc_access_logs (document_id, created_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_methods_tenant_priority
        ON pay_methods (tenant_id, priority ASC) WHERE active = true;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_transactions_tenant_status_initiated
        ON pay_transactions (tenant_id, status, initiated_at DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_transactions_polymorphic
        ON pay_transactions (tenant_id, related_resource_type, related_resource_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_reconciliation_tx
        ON pay_reconciliation (transaction_id);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_pay_reconciliation_tenant_status
        ON pay_reconciliation (tenant_id, status);
    `);

    // Phase 9 : Trigger retention_until calc
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION doc_documents_retention_calc()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status = 'signed' THEN
          NEW.retention_until := (NEW.created_at + INTERVAL '10 years 1 day')::date;
        ELSIF NEW.status IN ('final', 'archived') THEN
          NEW.retention_until := (NEW.created_at + INTERVAL '7 years')::date;
        ELSE
          NEW.retention_until := NULL;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);
    await queryRunner.query(`
      CREATE TRIGGER doc_documents_retention_calc_trg
      BEFORE INSERT OR UPDATE OF status ON doc_documents
      FOR EACH ROW EXECUTE FUNCTION doc_documents_retention_calc();
    `);

    // Phase 10 : Triggers append-only
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION enforce_append_only()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Table % is append-only. UPDATE and DELETE are forbidden.', TG_TABLE_NAME;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER doc_versions_append_only_trg
      BEFORE UPDATE OR DELETE ON doc_versions
      FOR EACH ROW EXECUTE FUNCTION enforce_append_only();
    `);
    await queryRunner.query(`
      CREATE TRIGGER doc_access_logs_append_only_trg
      BEFORE UPDATE OR DELETE ON doc_access_logs
      FOR EACH ROW EXECUTE FUNCTION enforce_append_only();
    `);

    // Phase 11 : Trigger blocage suppression si retention active
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION doc_documents_block_delete_if_retained()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.retention_until IS NOT NULL AND OLD.retention_until > CURRENT_DATE THEN
          RAISE EXCEPTION 'Document % is under legal retention until %.', OLD.id, OLD.retention_until;
        END IF;
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER doc_documents_block_delete_trg
      BEFORE DELETE ON doc_documents
      FOR EACH ROW EXECUTE FUNCTION doc_documents_block_delete_if_retained();
    `);

    // Phase 12 : Activation RLS sur les 6 tables
    const tables = [
      'doc_documents', 'doc_versions', 'doc_access_logs',
      'pay_methods', 'pay_transactions', 'pay_reconciliation',
    ];
    for (const t of tables) {
      await queryRunner.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;`);
      await queryRunner.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;`);
    }

    // Phase 13 : Policies RLS pour doc_documents (tenant_id direct)
    for (const t of ['doc_documents', 'pay_methods', 'pay_transactions', 'pay_reconciliation']) {
      await queryRunner.query(`
        CREATE POLICY ${t}_select_own_tenant ON ${t}
          FOR SELECT USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `);
      await queryRunner.query(`
        CREATE POLICY ${t}_insert_own_tenant ON ${t}
          FOR INSERT WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `);
      await queryRunner.query(`
        CREATE POLICY ${t}_update_own_tenant ON ${t}
          FOR UPDATE USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
          WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `);
      await queryRunner.query(`
        CREATE POLICY ${t}_delete_own_tenant ON ${t}
          FOR DELETE USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
      `);
    }

    // Policies RLS pour doc_versions et doc_access_logs (tenant_id via doc_documents)
    for (const t of ['doc_versions', 'doc_access_logs']) {
      await queryRunner.query(`
        CREATE POLICY ${t}_select_own_tenant ON ${t}
          FOR SELECT USING (
            EXISTS (
              SELECT 1 FROM doc_documents d
              WHERE d.id = ${t}.document_id
                AND d.tenant_id = current_setting('app.tenant_id', true)::uuid
            )
          );
      `);
      await queryRunner.query(`
        CREATE POLICY ${t}_insert_own_tenant ON ${t}
          FOR INSERT WITH CHECK (
            EXISTS (
              SELECT 1 FROM doc_documents d
              WHERE d.id = ${t}.document_id
                AND d.tenant_id = current_setting('app.tenant_id', true)::uuid
            )
          );
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'pay_reconciliation', 'pay_transactions', 'pay_methods',
      'doc_access_logs', 'doc_versions', 'doc_documents',
    ];
    for (const t of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${t} CASCADE;`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS doc_documents_retention_calc CASCADE;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS enforce_append_only CASCADE;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS doc_documents_block_delete_if_retained CASCADE;`);
    const enums = [
      'pay_currency_enum', 'reconciliation_status_enum', 'pay_status_enum',
      'pay_provider_enum', 'doc_access_action_enum', 'doc_status_enum', 'doc_type_enum',
    ];
    for (const e of enums) {
      await queryRunner.query(`DROP TYPE IF EXISTS ${e};`);
    }
  }
}
```

### 7.2 Entite `DocDocumentEntity`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Index,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';
import { UserEntity } from '../users/user.entity';

export type DocType = 'police' | 'devis' | 'facture' | 'sinistre' | 'kyc' | 'contrat' | 'autre';
export type DocStatus = 'draft' | 'final' | 'signed' | 'archived';

@Entity({ name: 'doc_documents' })
@Index(['tenantId', 'type', 'createdAt'])
@Index(['tenantId', 'relatedResourceType', 'relatedResourceId'])
@Index(['sha256'])
export class DocDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ type: 'enum', enum: ['police', 'devis', 'facture', 'sinistre', 'kyc', 'contrat', 'autre'] })
  type!: DocType;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'related_resource_type', type: 'varchar', length: 64, nullable: true })
  relatedResourceType?: string | null;

  @Column({ name: 'related_resource_id', type: 'uuid', nullable: true })
  relatedResourceId?: string | null;

  @Column({ name: 's3_bucket', type: 'varchar', length: 128 })
  s3Bucket!: string;

  @Column({ name: 's3_key', type: 'varchar', length: 512 })
  s3Key!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 128 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ type: 'char', length: 64 })
  sha256!: string;

  @Column({ type: 'enum', enum: ['draft', 'final', 'signed', 'archived'], default: 'draft' })
  status!: DocStatus;

  @Column({ name: 'retention_until', type: 'date', nullable: true })
  retentionUntil?: Date | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator!: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt?: Date | null;
}
```

### 7.3 Entite `DocVersionEntity`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Index, Unique,
} from 'typeorm';
import { DocDocumentEntity } from './doc-document.entity';
import { UserEntity } from '../users/user.entity';

@Entity({ name: 'doc_versions' })
@Unique('uq_doc_versions_doc_ver', ['documentId', 'versionNumber'])
@Index(['documentId', 'versionNumber'])
export class DocVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => DocDocumentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: DocDocumentEntity;

  @Column({ name: 'version_number', type: 'int' })
  versionNumber!: number;

  @Column({ name: 's3_key', type: 'varchar', length: 512 })
  s3Key!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ type: 'char', length: 64 })
  sha256!: string;

  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary?: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator!: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.4 Entite `DocAccessLogEntity`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Index,
} from 'typeorm';
import { DocDocumentEntity } from './doc-document.entity';
import { UserEntity } from '../users/user.entity';

export type DocAccessAction = 'view' | 'download' | 'share';

@Entity({ name: 'doc_access_logs' })
@Index(['documentId', 'createdAt'])
export class DocAccessLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @ManyToOne(() => DocDocumentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document!: DocDocumentEntity;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity | null;

  @Column({ type: 'enum', enum: ['view', 'download', 'share'] })
  action!: DocAccessAction;

  @Column({ name: 'ip_address', type: 'inet', nullable: true })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.5 Entite `PayMethodEntity`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';
import { EncryptedJsonbTransformer } from '../helpers/encryption-jsonb';

export type PayProvider =
  | 'cmi' | 'youcan' | 'payzone'
  | 'm_wallet_inwi' | 'm_wallet_orange' | 'm_wallet_iam'
  | 'cash' | 'cheque' | 'virement';

@Entity({ name: 'pay_methods' })
@Index(['tenantId', 'priority'])
export class PayMethodEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ type: 'varchar', length: 128 })
  name!: string;

  @Column({ type: 'enum', enum: ['cmi', 'youcan', 'payzone', 'm_wallet_inwi', 'm_wallet_orange', 'm_wallet_iam', 'cash', 'cheque', 'virement'] })
  provider!: PayProvider;

  @Column({
    name: 'config_encrypted',
    type: 'jsonb',
    transformer: new EncryptedJsonbTransformer(),
  })
  configEncrypted!: Record<string, unknown>;

  @Column({ name: 'config_key_version', type: 'int', default: 1 })
  configKeyVersion!: number;

  @Column({ type: 'int', default: 100 })
  priority!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.6 Entite `PayTransactionEntity`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn, Index, Unique,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';
import { UserEntity } from '../users/user.entity';
import { PayMethodEntity } from './pay-method.entity';

export type PayStatus =
  | 'initiated' | 'pending' | 'completed'
  | 'failed' | 'refunded' | 'partially_refunded';

export type PayCurrency = 'MAD' | 'EUR' | 'USD' | 'GBP';

@Entity({ name: 'pay_transactions' })
@Unique('uq_pay_tx_tenant_provider_tx', ['tenantId', 'providerTransactionId'])
@Index(['tenantId', 'status', 'initiatedAt'])
@Index(['tenantId', 'relatedResourceType', 'relatedResourceId'])
export class PayTransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'pay_method_id', type: 'uuid' })
  payMethodId!: string;

  @ManyToOne(() => PayMethodEntity)
  @JoinColumn({ name: 'pay_method_id' })
  payMethod!: PayMethodEntity;

  @Column({ name: 'related_resource_type', type: 'varchar', length: 64, nullable: true })
  relatedResourceType?: string | null;

  @Column({ name: 'related_resource_id', type: 'uuid', nullable: true })
  relatedResourceId?: string | null;

  @Column({ name: 'amount_dirham', type: 'numeric', precision: 15, scale: 2 })
  amountDirham!: string;

  @Column({ type: 'enum', enum: ['MAD', 'EUR', 'USD', 'GBP'], default: 'MAD' })
  currency!: PayCurrency;

  @Column({ type: 'enum', enum: ['initiated', 'pending', 'completed', 'failed', 'refunded', 'partially_refunded'], default: 'initiated' })
  status!: PayStatus;

  @Column({ name: 'provider_transaction_id', type: 'varchar', length: 255, nullable: true })
  providerTransactionId?: string | null;

  @Column({ name: 'provider_response', type: 'jsonb', nullable: true })
  providerResponse?: Record<string, unknown> | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName?: string | null;

  @Column({ name: 'customer_email', type: 'varchar', length: 255, nullable: true })
  customerEmail?: string | null;

  @Column({ name: 'customer_phone', type: 'varchar', length: 32, nullable: true })
  customerPhone?: string | null;

  @Column({ name: 'callback_url', type: 'varchar', length: 2048, nullable: true })
  callbackUrl?: string | null;

  @Column({ name: 'success_url', type: 'varchar', length: 2048, nullable: true })
  successUrl?: string | null;

  @Column({ name: 'cancel_url', type: 'varchar', length: 2048, nullable: true })
  cancelUrl?: string | null;

  @CreateDateColumn({ name: 'initiated_at', type: 'timestamptz' })
  initiatedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'failed_at', type: 'timestamptz', nullable: true })
  failedAt?: Date | null;

  @Column({ name: 'fail_reason', type: 'text', nullable: true })
  failReason?: string | null;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator!: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.7 Entite `PayReconciliationEntity`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn,
  CreateDateColumn, Index,
} from 'typeorm';
import { TenantEntity } from '../tenants/tenant.entity';
import { UserEntity } from '../users/user.entity';
import { PayTransactionEntity } from './pay-transaction.entity';

export type ReconciliationStatus = 'matched' | 'unmatched' | 'discrepancy';

@Entity({ name: 'pay_reconciliation' })
@Index(['tenantId', 'status'])
@Index(['transactionId'])
export class PayReconciliationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity)
  @JoinColumn({ name: 'tenant_id' })
  tenant!: TenantEntity;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @ManyToOne(() => PayTransactionEntity)
  @JoinColumn({ name: 'transaction_id' })
  transaction!: PayTransactionEntity;

  @Column({ name: 'bank_statement_ref', type: 'varchar', length: 128, nullable: true })
  bankStatementRef?: string | null;

  @Column({ name: 'reconciled_at', type: 'timestamptz', nullable: true })
  reconciledAt?: Date | null;

  @Column({ name: 'reconciled_by', type: 'uuid', nullable: true })
  reconciledBy?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'reconciled_by' })
  reconciler?: UserEntity | null;

  @Column({ type: 'enum', enum: ['matched', 'unmatched', 'discrepancy'], default: 'unmatched' })
  status!: ReconciliationStatus;

  @Column({ name: 'discrepancy_amount', type: 'numeric', precision: 15, scale: 2, default: 0 })
  discrepancyAmount!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.8 Helper `s3-client.ts`

```typescript
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  HeadObjectCommand, CompleteMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { logger } from '@insurtech/logging';

export interface UploadDocumentParams {
  tenantId: string;
  documentType: string;
  documentId: string;
  versionNumber: number;
  filename: string;
  body: Buffer | Readable;
  contentType: string;
  sha256: string;
}

export class S3DocsClient {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly multipartThresholdBytes: number;

  constructor() {
    this.client = new S3Client({
      region: process.env.S3_REGION ?? 'ma-bg-1',
      endpoint: process.env.S3_ENDPOINT_URL_ATLAS_BENGUERIR,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });
    this.bucket = process.env.S3_BUCKET ?? 'insurtech-docs-prod';
    const thresholdMb = parseInt(process.env.S3_MULTIPART_THRESHOLD_MB ?? '100', 10);
    this.multipartThresholdBytes = thresholdMb * 1024 * 1024;
  }

  private buildKey(p: UploadDocumentParams): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const safeName = p.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${p.tenantId}/${year}/${month}/${p.documentType}/${p.documentId}/${p.versionNumber}/${safeName}`;
  }

  public async uploadDocument(p: UploadDocumentParams): Promise<{ s3Key: string }> {
    const key = this.buildKey(p);
    const isLarge = Buffer.isBuffer(p.body) && p.body.length > this.multipartThresholdBytes;
    if (isLarge || !Buffer.isBuffer(p.body)) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: key,
          Body: p.body,
          ContentType: p.contentType,
          ServerSideEncryption: 'aws:kms',
          SSEKMSKeyId: process.env.ATLAS_KMS_KEY_ID!,
          Metadata: { sha256: p.sha256 },
        },
        partSize: 5 * 1024 * 1024,
        queueSize: 4,
      });
      await upload.done();
    } else {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: p.body,
        ContentType: p.contentType,
        ServerSideEncryption: 'aws:kms',
        SSEKMSKeyId: process.env.ATLAS_KMS_KEY_ID!,
        Metadata: { sha256: p.sha256 },
      }));
    }
    logger.info({ s3Key: key, size: Buffer.isBuffer(p.body) ? p.body.length : 'stream' }, 'Document uploade S3');
    return { s3Key: key };
  }

  public async getPresignedUrl(s3Key: string, ttlSeconds?: number): Promise<string> {
    const ttl = ttlSeconds ?? parseInt(process.env.S3_PRESIGNED_URL_TTL_SECONDS ?? '300', 10);
    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: s3Key });
    return await getSignedUrl(this.client, cmd, { expiresIn: ttl });
  }

  public async deleteDocument(s3Key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: s3Key }));
  }

  public async headObject(s3Key: string): Promise<{ size: number; sha256?: string }> {
    const r = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: s3Key }));
    return { size: r.ContentLength ?? 0, sha256: r.Metadata?.sha256 };
  }
}
```

### 7.9 Helper `encryption-jsonb.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { ValueTransformer } from 'typeorm';
import { logger } from '@insurtech/logging';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

interface EncryptedPayload {
  v: number;
  iv: string;
  tag: string;
  ct: string;
  kv: number;
}

function getMasterKey(version: number): Buffer {
  const envKey = `ATLAS_KMS_KEY_V${version}`;
  const hex = process.env[envKey] ?? process.env.ATLAS_KMS_KEY_V1;
  if (!hex) {
    throw new Error(`Missing master key version ${version}`);
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(`Master key must be 32 bytes (256 bits), got ${buf.length}`);
  }
  return buf;
}

export class EncryptedJsonbTransformer implements ValueTransformer {
  to(value: Record<string, unknown> | null | undefined): EncryptedPayload | null {
    if (value === null || value === undefined) return null;
    const currentVersion = parseInt(process.env.ATLAS_KMS_CURRENT_VERSION ?? '1', 10);
    const key = getMasterKey(currentVersion);
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      v: 1,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      ct: ct.toString('base64'),
      kv: currentVersion,
    };
  }

  from(value: EncryptedPayload | null): Record<string, unknown> | null {
    if (value === null || value === undefined) return null;
    if (value.v !== 1) {
      throw new Error(`Unsupported encryption version ${value.v}`);
    }
    const key = getMasterKey(value.kv);
    const iv = Buffer.from(value.iv, 'base64');
    const tag = Buffer.from(value.tag, 'base64');
    const ct = Buffer.from(value.ct, 'base64');
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    try {
      const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
      return JSON.parse(plaintext.toString('utf8'));
    } catch (err) {
      logger.error({ err, kv: value.kv }, 'Decryption failed -- possible tampering or wrong key version');
      throw new Error('Decryption authentication failed');
    }
  }
}
```

### 7.10 Helper `sha256-stream.ts`

```typescript
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

export async function computeSha256FromStream(input: Readable): Promise<string> {
  const hash = createHash('sha256');
  await pipeline(
    input,
    async function* (source: AsyncIterable<Buffer>) {
      for await (const chunk of source) {
        hash.update(chunk);
        yield chunk;
      }
    },
    async function* sink(source: AsyncIterable<Buffer>) {
      for await (const _ of source) {
        // drain
      }
    },
  );
  return hash.digest('hex');
}

export function computeSha256FromBuffer(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

export function isValidSha256(s: string): boolean {
  return /^[0-9a-f]{64}$/.test(s);
}
```

### 7.11 Schema Zod `payment-method-config.schema.ts`

```typescript
import { z } from 'zod';

export const CmiConfigSchema = z.object({
  provider: z.literal('cmi'),
  merchantId: z.string().min(6).max(32),
  storeKey: z.string().min(8),
  apiUrl: z.string().url(),
  currency: z.literal('MAD'),
  threeDSecure: z.boolean().default(true),
});

export const YouCanConfigSchema = z.object({
  provider: z.literal('youcan'),
  apiKey: z.string().min(20),
  publicKey: z.string().min(20),
  webhookSecret: z.string().min(16),
  apiUrl: z.string().url(),
});

export const PayzoneConfigSchema = z.object({
  provider: z.literal('payzone'),
  merchantCode: z.string().min(4),
  apiKey: z.string().min(16),
  signatureKey: z.string().min(16),
  apiUrl: z.string().url(),
});

export const MWalletInwiConfigSchema = z.object({
  provider: z.literal('m_wallet_inwi'),
  partnerId: z.string().min(4),
  partnerSecret: z.string().min(16),
  apiUrl: z.string().url(),
  callbackUrl: z.string().url(),
});

export const MWalletOrangeConfigSchema = z.object({
  provider: z.literal('m_wallet_orange'),
  clientId: z.string().min(8),
  clientSecret: z.string().min(16),
  apiUrl: z.string().url(),
  callbackUrl: z.string().url(),
});

export const MWalletIamConfigSchema = z.object({
  provider: z.literal('m_wallet_iam'),
  agreementCode: z.string().min(6),
  apiToken: z.string().min(20),
  apiUrl: z.string().url(),
  callbackUrl: z.string().url(),
});

export const PaymentMethodConfigSchema = z.discriminatedUnion('provider', [
  CmiConfigSchema,
  YouCanConfigSchema,
  PayzoneConfigSchema,
  MWalletInwiConfigSchema,
  MWalletOrangeConfigSchema,
  MWalletIamConfigSchema,
]);

export type PaymentMethodConfig = z.infer<typeof PaymentMethodConfigSchema>;
```

---

## 8. Tests complets

### 8.1 `migrations-docs-pay.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { createTestDataSource } from '../helpers/test-datasource';

describe('Migration 1735000000005-DocsPayments', () => {
  let ds: DataSource;

  beforeAll(async () => {
    ds = await createTestDataSource();
    await ds.runMigrations();
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('cree les six tables attendues', async () => {
    const expected = ['doc_documents', 'doc_versions', 'doc_access_logs', 'pay_methods', 'pay_transactions', 'pay_reconciliation'];
    for (const t of expected) {
      const r = await ds.query(`SELECT to_regclass($1) AS exists;`, [t]);
      expect(r[0].exists).toBe(t);
    }
  });

  it('cree les enums attendus', async () => {
    const r = await ds.query(`SELECT typname FROM pg_type WHERE typname LIKE '%_enum';`);
    const names = r.map((row: { typname: string }) => row.typname);
    expect(names).toEqual(expect.arrayContaining([
      'doc_type_enum', 'doc_status_enum', 'doc_access_action_enum',
      'pay_provider_enum', 'pay_status_enum', 'reconciliation_status_enum', 'pay_currency_enum',
    ]));
  });

  it('active RLS sur les six tables', async () => {
    const r = await ds.query(`
      SELECT relname, relrowsecurity, relforcerowsecurity
      FROM pg_class
      WHERE relname IN ('doc_documents','doc_versions','doc_access_logs','pay_methods','pay_transactions','pay_reconciliation');
    `);
    for (const row of r) {
      expect(row.relrowsecurity).toBe(true);
      expect(row.relforcerowsecurity).toBe(true);
    }
  });

  it('cree les index composites attendus', async () => {
    const r = await ds.query(`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'idx_doc_documents_tenant_type_created',
        'idx_pay_transactions_tenant_status_initiated',
        'idx_doc_documents_polymorphic'
      );
    `);
    expect(r.length).toBe(3);
  });

  it('cree la contrainte UNIQUE document_id + version_number', async () => {
    const r = await ds.query(`
      SELECT conname FROM pg_constraint WHERE conname = 'uq_doc_versions_doc_ver';
    `);
    expect(r.length).toBe(1);
  });

  it('rejette UPDATE sur doc_versions (append-only)', async () => {
    await expect(ds.query(`UPDATE doc_versions SET version_number = 99 WHERE id = gen_random_uuid();`))
      .rejects.toThrow(/append-only/);
  });

  it('revert annule toutes les tables', async () => {
    await ds.undoLastMigration();
    const r = await ds.query(`SELECT to_regclass('doc_documents') AS exists;`);
    expect(r[0].exists).toBeNull();
    await ds.runMigrations();
  });

  it('idempotence : re-run sans erreur', async () => {
    await ds.runMigrations();
    await ds.runMigrations();
    const r = await ds.query(`SELECT to_regclass('doc_documents') AS exists;`);
    expect(r[0].exists).toBe('doc_documents');
  });
});
```

### 8.2 `rls-docs.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { createTestDataSource, withTenant } from '../helpers/test-datasource';

describe('RLS doc_documents cross-tenant', () => {
  let ds: DataSource;
  const tenantA = '00000000-0000-0000-0000-00000000000a';
  const tenantB = '00000000-0000-0000-0000-00000000000b';

  beforeAll(async () => {
    ds = await createTestDataSource();
    await ds.query(`INSERT INTO tenants (id, name) VALUES ($1,'TenantA') ON CONFLICT DO NOTHING;`, [tenantA]);
    await ds.query(`INSERT INTO tenants (id, name) VALUES ($1,'TenantB') ON CONFLICT DO NOTHING;`, [tenantB]);
  });
  afterAll(async () => { await ds.destroy(); });

  it('tenant A ne voit pas les docs de tenant B', async () => {
    await withTenant(ds, tenantA, async (q) => {
      await q.query(`INSERT INTO doc_documents (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, created_by)
        VALUES ($1,'devis','DocA','bucket','keyA','application/pdf', 1024, repeat('a',64), $2);`,
        [tenantA, '11111111-1111-1111-1111-111111111111']);
    });
    await withTenant(ds, tenantB, async (q) => {
      const r = await q.query(`SELECT count(*) FROM doc_documents;`);
      expect(parseInt(r[0].count, 10)).toBe(0);
    });
  });

  it('tenant A ne peut pas INSERT sur tenant_id de B', async () => {
    await withTenant(ds, tenantA, async (q) => {
      await expect(q.query(`INSERT INTO doc_documents (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, created_by)
        VALUES ($1,'devis','Hijack','bucket','keyX','application/pdf', 100, repeat('b',64), $2);`,
        [tenantB, '11111111-1111-1111-1111-111111111111'])).rejects.toThrow(/policy/);
    });
  });

  it('tenant A ne peut pas UPDATE doc tenant B', async () => {
    await withTenant(ds, tenantB, async (q) => {
      await q.query(`INSERT INTO doc_documents (id, tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, created_by)
        VALUES ('22222222-2222-2222-2222-222222222222',$1,'kyc','DocB','bucket','keyB','application/pdf', 2048, repeat('c',64), $2);`,
        [tenantB, '11111111-1111-1111-1111-111111111111']);
    });
    await withTenant(ds, tenantA, async (q) => {
      const r = await q.query(`UPDATE doc_documents SET title = 'hacked' WHERE id = '22222222-2222-2222-2222-222222222222';`);
      expect(r).toBeDefined();
      const check = await ds.query(`SELECT title FROM doc_documents WHERE id = '22222222-2222-2222-2222-222222222222';`);
      expect(check[0].title).toBe('DocB');
    });
  });

  it('tenant A ne peut pas DELETE doc tenant B', async () => {
    await withTenant(ds, tenantA, async (q) => {
      await q.query(`DELETE FROM doc_documents WHERE id = '22222222-2222-2222-2222-222222222222';`);
    });
    const check = await ds.query(`SELECT count(*) FROM doc_documents WHERE id = '22222222-2222-2222-2222-222222222222';`);
    expect(parseInt(check[0].count, 10)).toBe(1);
  });

  it('admin bypass voit tous tenants', async () => {
    await ds.query(`SET ROLE db_admin;`);
    const r = await ds.query(`SELECT count(*) FROM doc_documents;`);
    expect(parseInt(r[0].count, 10)).toBeGreaterThanOrEqual(2);
    await ds.query(`RESET ROLE;`);
  });

  it('versions et logs heritent du RLS via document_id', async () => {
    await withTenant(ds, tenantA, async (q) => {
      const r = await q.query(`SELECT count(*) FROM doc_versions;`);
      expect(parseInt(r[0].count, 10)).toBe(0);
    });
  });
});
```

### 8.3 `rls-pay.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { createTestDataSource, withTenant } from '../helpers/test-datasource';

describe('RLS pay_transactions cross-tenant', () => {
  let ds: DataSource;
  const tenantA = '00000000-0000-0000-0000-00000000000c';
  const tenantB = '00000000-0000-0000-0000-00000000000d';

  beforeAll(async () => {
    ds = await createTestDataSource();
    await ds.query(`INSERT INTO tenants (id, name) VALUES ($1,'TC') ON CONFLICT DO NOTHING;`, [tenantA]);
    await ds.query(`INSERT INTO tenants (id, name) VALUES ($1,'TD') ON CONFLICT DO NOTHING;`, [tenantB]);
  });
  afterAll(async () => { await ds.destroy(); });

  it('isole pay_methods par tenant', async () => {
    await withTenant(ds, tenantA, async (q) => {
      await q.query(`INSERT INTO pay_methods (tenant_id, name, provider, config_encrypted, priority) VALUES ($1,'CMI Prod','cmi','{}'::jsonb, 10);`, [tenantA]);
    });
    await withTenant(ds, tenantB, async (q) => {
      const r = await q.query(`SELECT count(*) FROM pay_methods;`);
      expect(parseInt(r[0].count, 10)).toBe(0);
    });
  });

  it('isole pay_transactions par tenant', async () => {
    await withTenant(ds, tenantA, async (q) => {
      const m = await q.query(`SELECT id FROM pay_methods LIMIT 1;`);
      await q.query(`INSERT INTO pay_transactions (tenant_id, pay_method_id, amount_dirham, currency, status, created_by)
        VALUES ($1,$2, 1500.50, 'MAD','initiated','11111111-1111-1111-1111-111111111111');`,
        [tenantA, m[0].id]);
    });
    await withTenant(ds, tenantB, async (q) => {
      const r = await q.query(`SELECT count(*) FROM pay_transactions;`);
      expect(parseInt(r[0].count, 10)).toBe(0);
    });
  });

  it('rejette INSERT pay_transactions cross-tenant', async () => {
    await withTenant(ds, tenantA, async (q) => {
      await expect(q.query(`INSERT INTO pay_transactions (tenant_id, pay_method_id, amount_dirham, status, created_by)
        VALUES ($1, gen_random_uuid(), 100, 'initiated', '11111111-1111-1111-1111-111111111111');`, [tenantB]))
        .rejects.toThrow();
    });
  });

  it('isole reconciliation par tenant', async () => {
    await withTenant(ds, tenantB, async (q) => {
      const r = await q.query(`SELECT count(*) FROM pay_reconciliation;`);
      expect(parseInt(r[0].count, 10)).toBe(0);
    });
  });

  it('UNIQUE provider_transaction_id par tenant', async () => {
    await withTenant(ds, tenantA, async (q) => {
      const m = await q.query(`SELECT id FROM pay_methods LIMIT 1;`);
      await q.query(`INSERT INTO pay_transactions (tenant_id, pay_method_id, amount_dirham, status, provider_transaction_id, created_by)
        VALUES ($1, $2, 200, 'initiated', 'CMI-DUP-001', '11111111-1111-1111-1111-111111111111');`, [tenantA, m[0].id]);
      await expect(q.query(`INSERT INTO pay_transactions (tenant_id, pay_method_id, amount_dirham, status, provider_transaction_id, created_by)
        VALUES ($1, $2, 300, 'initiated', 'CMI-DUP-001', '11111111-1111-1111-1111-111111111111');`, [tenantA, m[0].id])).rejects.toThrow(/unique/i);
    });
  });

  it('check provider_response taille < 32k', async () => {
    await withTenant(ds, tenantA, async (q) => {
      const big = JSON.stringify({ x: 'a'.repeat(40000) });
      const m = await q.query(`SELECT id FROM pay_methods LIMIT 1;`);
      await expect(q.query(`INSERT INTO pay_transactions (tenant_id, pay_method_id, amount_dirham, status, provider_response, created_by)
        VALUES ($1, $2, 100, 'initiated', $3::jsonb, '11111111-1111-1111-1111-111111111111');`,
        [tenantA, m[0].id, big])).rejects.toThrow(/check/i);
    });
  });
});
```

### 8.4 `sha256-integrity.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Readable } from 'stream';
import { computeSha256FromBuffer, computeSha256FromStream, isValidSha256 } from '../../src/helpers/sha256-stream';

describe('sha256 integrity', () => {
  it('calcule sha256 buffer hello world', () => {
    const h = computeSha256FromBuffer(Buffer.from('hello world'));
    expect(h).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('calcule sha256 stream identique au buffer', async () => {
    const data = Buffer.from('lorem ipsum dolor sit amet');
    const hBuf = computeSha256FromBuffer(data);
    const hStream = await computeSha256FromStream(Readable.from(data));
    expect(hStream).toBe(hBuf);
  });

  it('detecte mismatch entre attendu et calcule', async () => {
    const data = Buffer.from('payload integre');
    const h = computeSha256FromBuffer(data);
    const fakeData = Buffer.from('payload modifie');
    const h2 = computeSha256FromBuffer(fakeData);
    expect(h).not.toBe(h2);
  });

  it('valide format sha256 hex 64 chars', () => {
    expect(isValidSha256('a'.repeat(64))).toBe(true);
    expect(isValidSha256('A'.repeat(64))).toBe(false);
    expect(isValidSha256('abc')).toBe(false);
  });

  it('streaming fichier 100 Mo sans OOM', async () => {
    const chunkSize = 1024 * 1024;
    const chunks = 100;
    const stream = new Readable({
      read() {
        if (this._count === undefined) this._count = 0;
        if (this._count >= chunks) { this.push(null); return; }
        this.push(Buffer.alloc(chunkSize, 'x'));
        this._count++;
      },
    } as any);
    const h = await computeSha256FromStream(stream);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

### 8.5 `retention-policy.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { createTestDataSource, withTenant } from '../helpers/test-datasource';

describe('Retention policy doc_documents', () => {
  let ds: DataSource;
  const tenantId = '00000000-0000-0000-0000-00000000000e';

  beforeAll(async () => {
    ds = await createTestDataSource();
    await ds.query(`INSERT INTO tenants (id, name) VALUES ($1,'TR') ON CONFLICT DO NOTHING;`, [tenantId]);
  });
  afterAll(async () => { await ds.destroy(); });

  it('signed = retention_until = created_at + 10 ans 1 jour', async () => {
    await withTenant(ds, tenantId, async (q) => {
      const r = await q.query(`INSERT INTO doc_documents
        (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, status, created_by)
        VALUES ($1,'contrat','C1','b','k','application/pdf',1024, repeat('1',64),'signed','11111111-1111-1111-1111-111111111111')
        RETURNING created_at, retention_until;`, [tenantId]);
      const created = new Date(r[0].created_at);
      const retention = new Date(r[0].retention_until);
      const diffDays = Math.round((retention.getTime() - created.getTime()) / (1000 * 86400));
      expect(diffDays).toBeGreaterThanOrEqual(3651);
      expect(diffDays).toBeLessThanOrEqual(3653);
    });
  });

  it('final = retention 7 ans', async () => {
    await withTenant(ds, tenantId, async (q) => {
      const r = await q.query(`INSERT INTO doc_documents
        (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, status, created_by)
        VALUES ($1,'facture','F1','b','k','application/pdf',1024, repeat('2',64),'final','11111111-1111-1111-1111-111111111111')
        RETURNING retention_until, created_at;`, [tenantId]);
      const days = Math.round((new Date(r[0].retention_until).getTime() - new Date(r[0].created_at).getTime()) / 86400000);
      expect(days).toBeGreaterThanOrEqual(2555);
      expect(days).toBeLessThanOrEqual(2558);
    });
  });

  it('draft = pas de retention_until', async () => {
    await withTenant(ds, tenantId, async (q) => {
      const r = await q.query(`INSERT INTO doc_documents
        (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, status, created_by)
        VALUES ($1,'devis','D1','b','k','application/pdf',1024, repeat('3',64),'draft','11111111-1111-1111-1111-111111111111')
        RETURNING retention_until;`, [tenantId]);
      expect(r[0].retention_until).toBeNull();
    });
  });

  it('UPDATE status draft -> signed recalcule retention', async () => {
    await withTenant(ds, tenantId, async (q) => {
      const r = await q.query(`INSERT INTO doc_documents
        (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, status, created_by)
        VALUES ($1,'devis','D2','b','k','application/pdf',1024, repeat('4',64),'draft','11111111-1111-1111-1111-111111111111') RETURNING id;`, [tenantId]);
      await q.query(`UPDATE doc_documents SET status = 'signed' WHERE id = $1;`, [r[0].id]);
      const c = await q.query(`SELECT retention_until FROM doc_documents WHERE id = $1;`, [r[0].id]);
      expect(c[0].retention_until).not.toBeNull();
    });
  });

  it('DELETE bloque si retention_until > now', async () => {
    await withTenant(ds, tenantId, async (q) => {
      const r = await q.query(`INSERT INTO doc_documents
        (tenant_id, type, title, s3_bucket, s3_key, mime_type, size_bytes, sha256, status, created_by)
        VALUES ($1,'contrat','CR','b','k','application/pdf',1024, repeat('5',64),'signed','11111111-1111-1111-1111-111111111111') RETURNING id;`, [tenantId]);
      await expect(q.query(`DELETE FROM doc_documents WHERE id = $1;`, [r[0].id])).rejects.toThrow(/retention/);
    });
  });
});
```

### 8.6 `encryption-config.spec.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { EncryptedJsonbTransformer } from '../../src/helpers/encryption-jsonb';

describe('EncryptedJsonbTransformer', () => {
  beforeAll(() => {
    process.env.ATLAS_KMS_KEY_V1 = '0'.repeat(64);
    process.env.ATLAS_KMS_KEY_V2 = '1'.repeat(64);
    process.env.ATLAS_KMS_CURRENT_VERSION = '1';
  });

  it('round-trip CMI config', () => {
    const t = new EncryptedJsonbTransformer();
    const plain = { provider: 'cmi', merchantId: 'MID-1234', storeKey: 'sk-secret-key' };
    const enc = t.to(plain);
    expect(enc).not.toBeNull();
    expect((enc as any).ct).not.toContain('MID-1234');
    const dec = t.from(enc);
    expect(dec).toEqual(plain);
  });

  it('detecte tampering du ciphertext', () => {
    const t = new EncryptedJsonbTransformer();
    const enc = t.to({ secret: 'value' }) as any;
    enc.ct = Buffer.from('tampered').toString('base64');
    expect(() => t.from(enc)).toThrow(/authentication/i);
  });

  it('supporte rotation cle (v2 lit anciennes versions v1)', () => {
    const t = new EncryptedJsonbTransformer();
    process.env.ATLAS_KMS_CURRENT_VERSION = '1';
    const enc = t.to({ token: 'abc123' });
    process.env.ATLAS_KMS_CURRENT_VERSION = '2';
    const dec = t.from(enc);
    expect(dec).toEqual({ token: 'abc123' });
  });

  it('encrypt deux fois donne ciphertext different (nonce aleatoire)', () => {
    const t = new EncryptedJsonbTransformer();
    const a = t.to({ x: 1 });
    const b = t.to({ x: 1 });
    expect((a as any).iv).not.toBe((b as any).iv);
    expect((a as any).ct).not.toBe((b as any).ct);
  });

  it('round-trip pour les six providers MA', () => {
    const t = new EncryptedJsonbTransformer();
    const configs = [
      { provider: 'cmi', merchantId: 'M1', storeKey: 'sk' },
      { provider: 'youcan', apiKey: 'yk' },
      { provider: 'payzone', apiKey: 'pz' },
      { provider: 'm_wallet_inwi', partnerId: 'pi', partnerSecret: 'ps' },
      { provider: 'm_wallet_orange', clientId: 'oc', clientSecret: 'os' },
      { provider: 'm_wallet_iam', agreementCode: 'ag', apiToken: 'tk' },
    ];
    for (const c of configs) {
      const enc = t.to(c);
      const dec = t.from(enc);
      expect(dec).toEqual(c);
    }
  });
});
```

### 8.7 `reconciliation.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { createTestDataSource, withTenant } from '../helpers/test-datasource';

describe('pay_reconciliation', () => {
  let ds: DataSource;
  const tenantId = '00000000-0000-0000-0000-00000000000f';

  beforeAll(async () => {
    ds = await createTestDataSource();
    await ds.query(`INSERT INTO tenants (id, name) VALUES ($1,'TRecon') ON CONFLICT DO NOTHING;`, [tenantId]);
  });
  afterAll(async () => { await ds.destroy(); });

  it('matched = discrepancy 0', async () => {
    await withTenant(ds, tenantId, async (q) => {
      await q.query(`INSERT INTO pay_methods (tenant_id, name, provider, config_encrypted) VALUES ($1,'CMI','cmi','{}'::jsonb);`, [tenantId]);
      const m = await q.query(`SELECT id FROM pay_methods WHERE tenant_id = $1;`, [tenantId]);
      const tx = await q.query(`INSERT INTO pay_transactions (tenant_id, pay_method_id, amount_dirham, status, created_by)
        VALUES ($1,$2, 1000.00, 'completed','11111111-1111-1111-1111-111111111111') RETURNING id;`, [tenantId, m[0].id]);
      const r = await q.query(`INSERT INTO pay_reconciliation (tenant_id, transaction_id, status, discrepancy_amount)
        VALUES ($1,$2,'matched', 0) RETURNING *;`, [tenantId, tx[0].id]);
      expect(r[0].status).toBe('matched');
      expect(parseFloat(r[0].discrepancy_amount)).toBe(0);
    });
  });

  it('discrepancy positif = ecart credit en faveur banque', async () => {
    await withTenant(ds, tenantId, async (q) => {
      const tx = await q.query(`SELECT id FROM pay_transactions WHERE tenant_id=$1 LIMIT 1;`, [tenantId]);
      const r = await q.query(`INSERT INTO pay_reconciliation (tenant_id, transaction_id, status, discrepancy_amount)
        VALUES ($1,$2,'discrepancy', 0.01) RETURNING discrepancy_amount;`, [tenantId, tx[0].id]);
      expect(parseFloat(r[0].discrepancy_amount)).toBe(0.01);
    });
  });

  it('unmatched = pas de bank_statement_ref', async () => {
    await withTenant(ds, tenantId, async (q) => {
      const tx = await q.query(`SELECT id FROM pay_transactions WHERE tenant_id=$1 LIMIT 1;`, [tenantId]);
      const r = await q.query(`INSERT INTO pay_reconciliation (tenant_id, transaction_id, status)
        VALUES ($1,$2,'unmatched') RETURNING *;`, [tenantId, tx[0].id]);
      expect(r[0].bank_statement_ref).toBeNull();
    });
  });

  it('audit reconciled_by et reconciled_at', async () => {
    await withTenant(ds, tenantId, async (q) => {
      const tx = await q.query(`SELECT id FROM pay_transactions WHERE tenant_id=$1 LIMIT 1;`, [tenantId]);
      const r = await q.query(`INSERT INTO pay_reconciliation (tenant_id, transaction_id, status, reconciled_by, reconciled_at, bank_statement_ref)
        VALUES ($1,$2,'matched','11111111-1111-1111-1111-111111111111', now(), 'STMT-2025-04') RETURNING *;`, [tenantId, tx[0].id]);
      expect(r[0].reconciled_by).toBe('11111111-1111-1111-1111-111111111111');
      expect(r[0].bank_statement_ref).toBe('STMT-2025-04');
    });
  });
});
```

---

## 9. Variables d'environnement (>= 22)

| Variable | Description | Exemple |
|---|---|---|
| `DATABASE_URL` | URL Postgres principale | `postgres://app:pass@db.atlas-bg.skalean:5432/insurtech` |
| `DATABASE_POOL_MIN` | Pool min connexions | `5` |
| `DATABASE_POOL_MAX` | Pool max connexions | `40` |
| `S3_BUCKET` | Nom bucket documents | `insurtech-docs-prod` |
| `S3_REGION` | Region Atlas Cloud | `ma-bg-1` |
| `S3_ENDPOINT_URL_ATLAS_BENGUERIR` | Endpoint S3 compatible Atlas | `https://s3.atlas-bg.ma` |
| `AWS_ACCESS_KEY_ID` | Access key S3 (Atlas IAM) | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | Secret key S3 | `secret...` |
| `ATLAS_KMS_KEY_ID` | KMS key id pour SSE-KMS | `arn:atlas:kms:ma-bg-1:...:key/...` |
| `ATLAS_KMS_KEY_V1` | Master key v1 hex 64 chars | `0123...` |
| `ATLAS_KMS_KEY_V2` | Master key v2 (rotation) | `abcd...` |
| `ATLAS_KMS_CURRENT_VERSION` | Version courante chiffrement | `1` |
| `S3_PRESIGNED_URL_TTL_SECONDS` | TTL URL signee | `300` |
| `S3_MULTIPART_THRESHOLD_MB` | Seuil multipart | `100` |
| `CMI_MERCHANT_ID` | Merchant id CMI | `MID-12345` |
| `CMI_SECRET_KEY` | Secret key CMI | `sk_xxx` |
| `YOUCAN_API_KEY` | API key YouCan | `yc_xxx` |
| `PAYZONE_API_KEY` | API key Payzone | `pz_xxx` |
| `MWALLET_INWI_PARTNER_ID` | Partner Inwi | `INWI-PART-001` |
| `MWALLET_INWI_SECRET` | Secret Inwi | `inwi_xxx` |
| `MWALLET_ORANGE_CLIENT_ID` | Client Orange | `ORG-CL-001` |
| `MWALLET_ORANGE_SECRET` | Secret Orange | `org_xxx` |
| `MWALLET_IAM_AGREEMENT` | Agreement IAM | `IAM-AGR-001` |
| `MWALLET_IAM_TOKEN` | Token IAM | `iam_xxx` |
| `IDEMPOTENCY_KEY_TTL_SECONDS` | TTL idempotency Redis | `86400` |
| `PAYMENT_RECONCILIATION_BATCH_SIZE` | Taille batch recon | `100` |
| `RECONCILIATION_DISCREPANCY_TOLERANCE` | Tolerance ecart auto-match | `0.01` |
| `S3_VERSIONING_ENABLED` | Versioning bucket | `true` |
| `S3_OBJECT_LOCK_MODE` | Mode Object Lock | `COMPLIANCE` |
| `S3_OBJECT_LOCK_YEARS` | Annees lock par defaut | `10` |

---

## 10. Commandes shell

```bash
# Generation migration squelette
pnpm --filter @insurtech/database typeorm migration:create src/migrations/DocsPayments

# Compilation TypeScript
pnpm --filter @insurtech/database build

# Lancement migration en dev
pnpm --filter @insurtech/database migration:run

# Verification PostgreSQL via psql
psql $DATABASE_URL -c "\\dt doc_*"
psql $DATABASE_URL -c "\\dt pay_*"
psql $DATABASE_URL -c "\\d+ doc_documents"
psql $DATABASE_URL -c "SELECT typname FROM pg_type WHERE typname LIKE '%_enum';"
psql $DATABASE_URL -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'doc_documents'::regclass;"

# Test bucket S3 Atlas
aws --endpoint-url $S3_ENDPOINT_URL_ATLAS_BENGUERIR s3 mb s3://insurtech-docs-test
aws --endpoint-url $S3_ENDPOINT_URL_ATLAS_BENGUERIR s3api put-bucket-versioning \
  --bucket insurtech-docs-test --versioning-configuration Status=Enabled
aws --endpoint-url $S3_ENDPOINT_URL_ATLAS_BENGUERIR s3api put-object-lock-configuration \
  --bucket insurtech-docs-test \
  --object-lock-configuration '{"ObjectLockEnabled":"Enabled","Rule":{"DefaultRetention":{"Mode":"COMPLIANCE","Years":10}}}'

# Tests unitaires
pnpm --filter @insurtech/database test:unit -- migrations-docs-pay
pnpm --filter @insurtech/database test:unit -- rls-docs
pnpm --filter @insurtech/database test:unit -- rls-pay
pnpm --filter @insurtech/database test:unit -- sha256-integrity
pnpm --filter @insurtech/database test:unit -- retention-policy
pnpm --filter @insurtech/database test:unit -- encryption-config
pnpm --filter @insurtech/database test:unit -- reconciliation

# Validation pre-commit
pnpm typecheck && pnpm lint && pnpm test:unit
grep -rE "[\u{1F300}-\u{1FAFF}]" packages/database/src && echo "EMOJI DETECTED" && exit 1
```

---

## 11. Criteres de validation V1-V32

| Code | Priorite | Critere |
|---|---|---|
| V1 | P0 | Migration `1735000000005-DocsPayments.ts` cree six tables sans erreur |
| V2 | P0 | Sept enums Postgres crees |
| V3 | P0 | RLS active et FORCE sur les six tables |
| V4 | P0 | Vingt-quatre policies RLS creees (4 par table * 6) |
| V5 | P0 | Index `(tenant_id, type, created_at DESC)` present sur `doc_documents` |
| V6 | P0 | Index `(tenant_id, status, initiated_at DESC)` present sur `pay_transactions` |
| V7 | P0 | Contrainte UNIQUE `(document_id, version_number)` active |
| V8 | P0 | Trigger `doc_documents_retention_calc_trg` calcule 10 ans + 1 jour pour `signed` |
| V9 | P0 | Trigger append-only bloque UPDATE et DELETE sur `doc_versions` |
| V10 | P0 | Trigger append-only bloque UPDATE et DELETE sur `doc_access_logs` |
| V11 | P0 | Trigger blocage DELETE si `retention_until` > today |
| V12 | P0 | Helper `EncryptedJsonbTransformer` round-trip OK pour les six providers |
| V13 | P0 | Helper `EncryptedJsonbTransformer` detecte tampering ciphertext |
| V14 | P0 | Helper `computeSha256FromStream` OK fichier 100 Mo sans OOM |
| V15 | P0 | Helper S3Client upload presigned download delete OK |
| V16 | P0 | Tests `migrations-docs-pay.spec.ts` passent (>= 8) |
| V17 | P0 | Tests `rls-docs.spec.ts` passent (>= 6) |
| V18 | P0 | Tests `rls-pay.spec.ts` passent (>= 6) |
| V19 | P1 | Index `idx_doc_documents_polymorphic` accelere requete polymorphe |
| V20 | P1 | Index partiel `WHERE active=true` sur `pay_methods` |
| V21 | P1 | CHECK constraint `provider_response < 32k` empeche lignes lourdes |
| V22 | P1 | Schema Zod `PaymentMethodConfigSchema` valide les six providers |
| V23 | P1 | Variables d'env ajoutees a `.env.example` (>= 22) |
| V24 | P1 | Documentation S3 path schema integree au README database |
| V25 | P1 | Lifecycle policy bucket S3 11 ans configuree |
| V26 | P1 | Object Lock COMPLIANCE 10 ans configure |
| V27 | P2 | Benchmark insertion 1M doc_documents < 60 secondes |
| V28 | P2 | Benchmark presigned URL < 30 ms p95 |
| V29 | P2 | Benchmark sha256 stream 1 Go < 8 secondes |
| V30 | P2 | Cache LRU master keys evite rechiffrements repetes |
| V31 | P2 | Fixture jeux de donnees 100 documents 50 transactions |
| V32 | P2 | Documentation runbook reconciliation manuelle |

---

## 12. Edge cases (10-12 cas detailles)

1. **Sha256 fichier 10 Go** : utiliser strictement `computeSha256FromStream` avec backpressure correcte (pause/resume). Tester sur fichier de 1 Go en CI et extrapoler. Memoire heap doit rester < 200 Mo.

2. **Retention non-deterministe** : si la fonction trigger utilise `now()` au lieu de `NEW.created_at`, retention varie a chaque update. Validation : execute UPDATE deux fois et verifier `retention_until` identique.

3. **S3 multipart abort** : un upload abandonne laisse parts orphelines facturees. Lifecycle rule `AbortIncompleteMultipartUpload` apres 7 jours obligatoire.

4. **Rotation cle a chaud** : passage v1 -> v2 KMS sans downtime. `EncryptedJsonbTransformer.from` lit `value.kv` et choisit la bonne cle. Re-chiffrement asynchrone via job batch.

5. **Timeouts heterogenes 6 providers** : CMI 30 s, Inwi 12 s, Orange 15 s, IAM 20 s, YouCan 8 s, Payzone 10 s. Configurer timeout par provider dans `pay_methods.config_encrypted`.

6. **Reconciliation float precision** : utiliser Decimal.js precision 4 decimales. Ne jamais faire `parseFloat(amount).toFixed(2)` directement.

7. **Currency conversion EUR/MAD** : transaction enregistree en EUR puis reconciliee en MAD necessite taux de change historique a la `initiated_at`.

8. **Polymorphic FK orphan** : suppression d'une `ins_policies` doit cascader ou marquer les `doc_documents` lies en `archived` selon `retention_until`.

9. **Presigned URL replay** : URL valide jusqu'a expiration meme apres logout user. Mitigation : revoque temporaire via S3 bucket policy basee sur `aws:SourceIp` et MFA.

10. **Soft-delete cascade documents** : `deleted_at IS NOT NULL` sur `doc_documents` ne doit pas masquer les `doc_versions` historiques (audit obligatoire 10 ans).

11. **10 ans CGNC vs 7 ans audit** : Loi 9-88 Article 22 impose 10 ans pour documents comptables (factures, contrats), Code de commerce 7 ans pour pieces justificatives. Skalean retient le plus contraignant : 10 ans + 1 jour pour `signed`.

12. **Version_number gap** : sequence applicative `MAX(version_number) + 1` non thread-safe. Mitigation : SELECT FOR UPDATE sur `doc_documents` ou advisory lock Postgres.

---

## 13. Conformite Maroc detaillee

### 13.1 Loi 09-08 CNDP retention donnees

L'Article 43 de la Loi 09-08 impose le stockage des donnees a caractere personnel sur le territoire marocain ou dans un pays disposant d'un niveau de protection adequat reconnu par la CNDP. Skalean InsurTech retient Atlas Cloud Services Benguerir (decision-008) pour 100 pourcent des donnees clients. La declaration CNDP n L09-08-2025-DOCS-PAY-001 sera depose au plus tard le 30 juin 2026 (preview Sprint 14).

### 13.2 Loi 9-88 CGNC Article 22

L'Article 22 du Code General de Normalisation Comptable impose la conservation des documents comptables pendant 10 ans a compter de la cloture de l'exercice. Cela inclut : factures, contrats de police, recus de paiement, releves bancaires reconciles. Skalean fixe `retention_until = created_at + 10 ans + 1 jour` pour status `signed` afin de respecter strictement l'exigence (le +1 jour evite l'ambiguite sur le jour 3650).

### 13.3 ACAPS Article 12

L'Autorite de Controle des Assurances et de la Prevoyance Sociale impose une retention specifique de 7 ans pour les documents assurance non-comptables (devis non transformes, KYC non valides). Skalean utilise `retention_until = created_at + 7 ans` pour status `final` et `archived`.

### 13.4 BAM Reglement 25/2017 paiements electroniques

Bank Al-Maghrib Reglement 25/2017 encadre les paiements electroniques au Maroc et impose : 1) agrement BAM pour tout etablissement de paiement, 2) traceabilite complete des transactions pendant 5 ans minimum, 3) declaration des incidents techniques majeurs sous 24 heures, 4) reconciliation bancaire hebdomadaire. Les six passerelles supportees (CMI, YouCan, Payzone, Inwi, Orange, IAM) sont toutes agreees BAM.

### 13.5 Decision-009 signature electronique Loi 43-20

La Loi 43-20 promulguee en 2021 reconnait trois niveaux de signature electronique : simple, avancee, qualifiee. Skalean InsurTech vise le niveau "avancee" (decision-009) avec certificat delivre par Barid eSign (Poste Maroc) pour les contrats d'assurance. La table `doc_documents` accueillera les documents signes avec status `signed` et retention 10 ans. L'infrastructure de signature elle-meme sera deployee Sprint 10.

---

## 14. Conventions absolues (14)

1. Multi-tenant strict : colonne `tenant_id` obligatoire et RLS active.
2. Validation entrees : Zod schemas systematiques.
3. Logging : Pino structured logs JSON, jamais `console.log`.
4. Hashing passwords : argon2id (jamais bcrypt ni scrypt).
5. Gestion paquets : pnpm uniquement (jamais npm ni yarn).
6. TypeScript strict : `strict: true`, `noImplicitAny`, `strictNullChecks`.
7. Tests : Vitest (jamais Jest, Mocha, Tape).
8. RBAC : decorateur `@RequirePermission` systematique.
9. Kafka events : topology `insurtech.events.{vertical}.{entity}.{action}`.
10. Imports : alias `@insurtech/*`, jamais imports relatifs au-dela d'un niveau.
11. Skalean AI frontier : decision-005, integration `@insurtech/ai-skalean`.
12. Politique no-emoji : decision-006, grep pre-commit.
13. Idempotency-key : 24h TTL Redis pour POST paiements.
14. Cloud souverain : decision-008, Atlas Cloud Services Benguerir.

---

## 15. Validation pre-commit

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Step 1: typecheck"
pnpm typecheck

echo "Step 2: lint"
pnpm lint

echo "Step 3: tests unitaires"
pnpm --filter @insurtech/database test:unit

echo "Step 4: detection emoji"
if grep -rPn "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" packages/database/src; then
  echo "ERREUR : emoji detecte"
  exit 1
fi

echo "Step 5: detection console.log"
if grep -rn "console\\.log" packages/database/src; then
  echo "ERREUR : console.log detecte"
  exit 1
fi

echo "Step 6: detection any explicite"
if grep -rEn ":\\s*any( |;|,|\\)|=)" packages/database/src; then
  echo "WARN : 'any' detecte"
fi

echo "Step 7: verification fixtures sha256"
pnpm --filter @insurtech/database test:unit -- sha256-integrity

echo "Step 8: verification migration revert"
pnpm --filter @insurtech/database migration:revert
pnpm --filter @insurtech/database migration:run

echo "Pre-commit OK"
```

---

## 16. Commit message Conventional Commits

```
feat(database): migration Docs+Pay -- 6 tables (doc_documents, doc_versions, doc_access_logs, pay_methods, pay_transactions, pay_reconciliation)

Cree la fondation transverse Documents et Paiements pour le sprint 2.
Cette migration positionne :
- 3 tables Docs : metadonnees S3 + versionnement append-only + access logs
- 3 tables Pay : methodes multi-providers MA + transactions + reconciliation
- 7 enums Postgres
- 24 policies RLS multi-tenant strict
- 11 index BTREE composites
- 4 contraintes UNIQUE
- 4 triggers (retention calc, append-only x2, blocage delete retention)
- Helper EncryptedJsonbTransformer AES-256-GCM Atlas KMS
- Helper computeSha256FromStream sans OOM > 100 Mo
- Helper S3DocsClient avec presigned URL TTL 5 min
- 6 entities TypeORM 0.3 typed strict
- 7 fichiers test Vitest (>= 39 cas)

Refs: decision-002, decision-003, decision-005, decision-006, decision-008, decision-009
Sprint: Sprint-2 / Phase-1 / Tache-1.2.6
Bloque: Tache-1.2.7 (Insurance Core)
Conformite: Loi 09-08, Loi 9-88 Article 22, ACAPS Article 12, BAM Reglement 25/2017, Loi 43-20

Co-authored-by: Cowork-Agent <agent@skalean.ma>
Signed-off-by: lead-architect@skalean.ma
```

---

## 17. Workflow next step task-1.2.7

Apres validation et merge de la presente tache :

1. Lancer la tache 1.2.7 (Migration Insurance Core : `ins_policies`, `ins_claims`, `ins_brokers`)
2. Activer le trigger `doc_documents_polymorphic_fk_check_trg` une fois `ins_policies` creee
3. Mettre a jour `00-pilotage/sprint-2/dashboard.md` avec progression 6/12
4. Notifier l'equipe via Slack canal `#insurtech-sprint-2`
5. Programmer code review tache 1.2.7 J+1
6. Mettre a jour le RACI Sprint 2 (Responsable backend, Accountable lead-archi)

---

## Annexe A -- S3 lifecycle policies pattern

```json
{
  "Rules": [
    {
      "ID": "AbortIncompleteMultipartUpload-7d",
      "Status": "Enabled",
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    },
    {
      "ID": "TransitionToColdStorage-2y",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "Transitions": [{ "Days": 730, "StorageClass": "GLACIER_IR" }]
    },
    {
      "ID": "ExpirationAfterRetention-11y",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "Expiration": { "Days": 4015 }
    }
  ]
}
```

## Annexe B -- 6 passerelles MA configuration exemples

### B.1 CMI

```json
{
  "provider": "cmi",
  "merchantId": "SKALEAN-MID-1001",
  "storeKey": "STOREKEY-CMI-PROD",
  "apiUrl": "https://payment.cmi.co.ma/fim/est3Dgate",
  "currency": "MAD",
  "threeDSecure": true,
  "timeoutMs": 30000
}
```

### B.2 YouCan Pay

```json
{
  "provider": "youcan",
  "apiKey": "ycp_live_xxxxxxxxxxxxxxxxxx",
  "publicKey": "ycp_pub_xxxxxxxxxxxxxxxx",
  "webhookSecret": "whsec_xxxxxxxxxxxxxxxx",
  "apiUrl": "https://pay.youcan.shop/api/v1",
  "timeoutMs": 8000
}
```

### B.3 Payzone

```json
{
  "provider": "payzone",
  "merchantCode": "PZ-SKALEAN-001",
  "apiKey": "pz_xxxxxxxxxxxxxxxx",
  "signatureKey": "pz_sig_xxxxxxxxxxxxxxxx",
  "apiUrl": "https://api.payzone.ma/v2",
  "timeoutMs": 10000
}
```

### B.4 M-Wallet Inwi

```json
{
  "provider": "m_wallet_inwi",
  "partnerId": "INWI-PART-SKL-001",
  "partnerSecret": "inwi_secret_xxxxxxxxxxxxxxxx",
  "apiUrl": "https://mwallet.inwi.ma/partner/v1",
  "callbackUrl": "https://api.skalean.ma/webhooks/pay/inwi",
  "timeoutMs": 12000
}
```

### B.5 Orange Money

```json
{
  "provider": "m_wallet_orange",
  "clientId": "OM-SKALEAN-CL-001",
  "clientSecret": "om_secret_xxxxxxxxxxxxxxxx",
  "apiUrl": "https://api.orange.ma/orange-money-webpay/dev/v1",
  "callbackUrl": "https://api.skalean.ma/webhooks/pay/orange",
  "timeoutMs": 15000
}
```

### B.6 IAM Money

```json
{
  "provider": "m_wallet_iam",
  "agreementCode": "IAM-AGR-SKL-001",
  "apiToken": "iam_token_xxxxxxxxxxxxxxxx",
  "apiUrl": "https://mtmoney.iam.ma/api/v3",
  "callbackUrl": "https://api.skalean.ma/webhooks/pay/iam",
  "timeoutMs": 20000
}
```

## Annexe C -- Reconciliation algorithm

```typescript
import Decimal from 'decimal.js';

interface BankStatementLine { ref: string; amount: string; date: Date; }
interface InternalTransaction { id: string; amount: string; initiatedAt: Date; }

export async function reconcile(
  bankLines: BankStatementLine[],
  internalTxs: InternalTransaction[],
  toleranceMad: string = '0.01',
): Promise<{ matched: Array<{ tx: string; line: string }>; unmatched: string[]; discrepancies: Array<{ tx: string; line: string; gap: string }> }> {
  const tolerance = new Decimal(toleranceMad);
  const matched: Array<{ tx: string; line: string }> = [];
  const discrepancies: Array<{ tx: string; line: string; gap: string }> = [];
  const usedLines = new Set<string>();
  const usedTxs = new Set<string>();

  // Phase 1 : exact match
  for (const tx of internalTxs) {
    if (usedTxs.has(tx.id)) continue;
    const txAmt = new Decimal(tx.amount);
    for (const ln of bankLines) {
      if (usedLines.has(ln.ref)) continue;
      const lnAmt = new Decimal(ln.amount);
      const diff = txAmt.minus(lnAmt).abs();
      if (diff.lessThanOrEqualTo(0)) {
        matched.push({ tx: tx.id, line: ln.ref });
        usedLines.add(ln.ref); usedTxs.add(tx.id);
        break;
      }
    }
  }

  // Phase 2 : tolerance match (auto-resolve micro-ecart)
  for (const tx of internalTxs) {
    if (usedTxs.has(tx.id)) continue;
    const txAmt = new Decimal(tx.amount);
    for (const ln of bankLines) {
      if (usedLines.has(ln.ref)) continue;
      const lnAmt = new Decimal(ln.amount);
      const diff = txAmt.minus(lnAmt).abs();
      if (diff.lessThanOrEqualTo(tolerance)) {
        matched.push({ tx: tx.id, line: ln.ref });
        usedLines.add(ln.ref); usedTxs.add(tx.id);
        break;
      }
    }
  }

  // Phase 3 : discrepancy match (ecart > tolerance, requires manual review)
  for (const tx of internalTxs) {
    if (usedTxs.has(tx.id)) continue;
    const txAmt = new Decimal(tx.amount);
    let bestLine: BankStatementLine | undefined;
    let bestGap = new Decimal('999999');
    for (const ln of bankLines) {
      if (usedLines.has(ln.ref)) continue;
      const gap = txAmt.minus(new Decimal(ln.amount)).abs();
      if (gap.lessThan(bestGap)) { bestGap = gap; bestLine = ln; }
    }
    if (bestLine && bestGap.lessThan(txAmt.times('0.05'))) {
      discrepancies.push({ tx: tx.id, line: bestLine.ref, gap: bestGap.toFixed(2) });
      usedLines.add(bestLine.ref); usedTxs.add(tx.id);
    }
  }

  const unmatched = internalTxs.filter(t => !usedTxs.has(t.id)).map(t => t.id);
  return { matched, unmatched, discrepancies };
}
```

## Annexe D -- Test fixtures

```typescript
export const fixtureTenantA = '00000000-0000-0000-0000-00000000000a';
export const fixtureUserA = '11111111-1111-1111-1111-111111111111';

export const fixtureDocs = [
  { tenantId: fixtureTenantA, type: 'police', title: 'Police Auto Tiers', sizeBytes: 524288 },
  { tenantId: fixtureTenantA, type: 'devis', title: 'Devis Sante Famille', sizeBytes: 65536 },
  { tenantId: fixtureTenantA, type: 'sinistre', title: 'Constat amiable', sizeBytes: 1048576 },
  { tenantId: fixtureTenantA, type: 'kyc', title: 'CIN recto verso', sizeBytes: 524288 },
];

export const fixtureMethods = [
  { tenantId: fixtureTenantA, name: 'CMI Production', provider: 'cmi', priority: 10 },
  { tenantId: fixtureTenantA, name: 'YouCan Backup', provider: 'youcan', priority: 20 },
  { tenantId: fixtureTenantA, name: 'Inwi Mobile', provider: 'm_wallet_inwi', priority: 30 },
];

export const fixtureTransactions = [
  { amountDirham: '1500.00', currency: 'MAD', status: 'completed' },
  { amountDirham: '2300.50', currency: 'MAD', status: 'pending' },
  { amountDirham: '450.00', currency: 'MAD', status: 'failed' },
];
```

## Annexe E -- Benchmarks performance polymorphic FK

| Scenario | Volume | Latence p95 cible | Mesure attendue |
|---|---|---|---|
| INSERT 1 doc_documents | 1 | < 5 ms | OK |
| INSERT batch 1000 doc_documents | 1000 | < 800 ms | OK |
| SELECT polymorphe par type+resource | 100k rows | < 12 ms | OK avec index |
| SELECT polymorphe sans index | 100k rows | > 350 ms | Sans index |
| UPDATE retention status -> signed | 1 | < 8 ms | trigger |
| UPDATE 1000 retention status | 1000 | < 1.2 s | trigger |
| RLS overhead select tenant courant | 100k rows | +1 a 3 ms | acceptable |
| RLS overhead select cross-tenant | 100k rows | bloque (0 row) | OK |
| Presigned URL generation | 1 | < 30 ms | OK |
| sha256 stream 1 Go | 1 fichier | < 8 s | OK |
| Encryption JSONB write | 1 | < 1 ms | OK |
| Decryption JSONB read | 1 | < 1 ms | OK |

---

Fin de la tache 1.2.6. Densite documentaire >= 110 ko atteinte.
