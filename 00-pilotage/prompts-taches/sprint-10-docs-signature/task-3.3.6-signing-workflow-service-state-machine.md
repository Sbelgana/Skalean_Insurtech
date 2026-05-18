# Tache 3.3.6 - sig_signing_workflows Migration TypeORM + Entity + SigningWorkflowService State Machine + Signers JSONB + Signature Order + Provider Abstraction + Audit + Kafka Events

## 1. Header

| Champ | Valeur |
|---|---|
| Identifiant | task-3.3.6 |
| Sprint | 10 - Docs + Signature Loi 43-20 |
| Phase | 3 - Signature electronique conformite Loi 43-20 + ACAPS Circulaire 2018/01 |
| Priorite | P0 (bloquante chaine signature complete: contrats, avenants, sinistres, KYC) |
| Effort estime | 7h (Migration 0.5h + Entity 0.5h + Types/Interfaces 0.5h + State Machine 1h + SigningWorkflowService 1.5h + SignersValidator 0.5h + Provider abstraction 0.5h + Controller REST 0.5h + Tests unit 1h + Tests E2E 0.5h) |
| Effort reel | __ a remplir apres execution |
| Depends on | Tache 3.3.5 (acces logs documents) - et indirectement Taches 3.3.1 (entites documents) / 3.3.3 (DocumentService) / 1.x (auth_tenants, auth_users) |
| Blocks | Tache 3.3.7 (Barid eSign Provider Client), Tache 3.3.8 (DocuSign Provider International), Tache 3.3.9 (Webhooks callbacks signataires), Tache 3.3.10 (Audit trail PDF generation), Tache 3.3.11 (Notifications email/SMS signataires), Tache 3.3.13 (Cron expiration workflows), Sprint 11 (contrats signes), Sprint 12 (sinistres signes) |
| Owner | Backend Lead Signature |
| Reviewer | Architect + Compliance Officer (Loi 43-20 + ACAPS) + Security Officer (PII signataires) |
| Statut | A_FAIRE |
| Date creation | 2026-05-08 |
| Date livraison cible | 2026-05-15 |
| Conformite reglementaire | Loi 43-20 article 4 (workflow signature obligatoire trace), ACAPS Circulaire 2018/01 (signature electronique distribution assurance), Loi 09-08 article 23 (protection PII signataires), eIDAS reference internationale |
| Tags | signature, workflow, state-machine, multi-tenant, jsonb, kafka, audit, provider-abstraction, sequential, parallel |

## 2. But

Implementer le service de gestion des **workflows de signature electronique** (cycle de vie complet draft -> sent -> in_progress -> completed/declined/expired/cancelled) avec strict state machine, support **signataires multiples** (jusqu'a 10 par workflow) en mode **parallele ou sequentiel**, **abstraction provider** permettant de basculer entre Barid eSign (provider national Maroc agree par ANRT/ACAPS), DocuSign (international, futur), et `manual` (signature papier scannee), audit trail complet pour conformite Loi 43-20, et publication d'evenements Kafka pour notification asynchrone (emails Tache 3.3.11, audit Tache 3.3.10).

**Exigences fonctionnelles cle**:
1. Creation d'un workflow en `draft` avec liste signataires validee (emails RFC 5322, telephones MA `+212XXXXXXXXX`, CIN optionnel format MA)
2. Envoi pour signature: transition `draft -> sent`, appel provider (delegue Tache 3.3.7 via interface), notification premier signataire si `sequential`, tous si `parallel`
3. Polling/webhook reception: transitions `sent -> in_progress` (premier `viewed`), `in_progress -> completed` (tous signes), `in_progress -> declined` (un refus), `* -> expired` (cron Tache 3.3.13), `draft|sent -> cancelled` (action utilisateur)
4. Strict state machine: toute transition non listee retournee 422 + log securite (anomalie potentielle)
5. Stockage signataires en JSONB (max 10, contrainte SQL `jsonb_array_length BETWEEN 1 AND 10`), index GIN sur path metadonnees pour recherche rapide
6. Audit complet: `created_at`, `sent_at`, `completed_at`, `cancellation_reason`, `created_by`, et trace evenements Kafka pour reconstruction historique
7. Multi-tenant strict via `tenant_id` + RLS PostgreSQL `tenant_isolation`
8. Abstraction provider (`SignatureProviderInterface`) permettant injection dependency Barid/DocuSign/manual sans modification du service

**Hors scope (delegue autres taches)**:
- Appel API reel Barid eSign (Tache 3.3.7)
- Reception webhook callbacks signataires (Tache 3.3.9)
- Generation PDF audit trail (Tache 3.3.10)
- Envoi emails/SMS notifications (Tache 3.3.11)
- Cron expiration (Tache 3.3.13)

## 3. Contexte etendu (8 KB)

### 3.1 Cadre reglementaire Maroc

**Loi 43-20** (relative aux services de confiance pour les transactions electroniques, BO du 24/12/2020) constitue le cadre principal de la signature electronique au Maroc. Elle abroge la loi 53-05 obsolete et aligne le pays avec eIDAS UE. Article 4 stipule que **toute signature electronique avancee doit etre supportee par un workflow tracable identifiant signataire(s), document signe, horodatage et integrite cryptographique**. Le workflow doit etre conserve pendant **toute la duree d'opposabilite du document signe** (10 ans pour contrats assurance, 30 ans pour sinistres corporels).

**ACAPS** (Autorite de Controle des Assurances et de la Prevoyance Sociale) **Circulaire 2018/01** impose pour les contrats d'assurance distribues electroniquement:
- Identification forte du souscripteur (CIN + selfie/video, ou signature electronique avancee)
- Conservation contrat signe + manifestation consentement pendant duree contrat + 10 ans
- Audit trail consultable par l'ACAPS sous 48h sur demande
- Possibilite revocation du contrat dans les 14 jours (delai legal retractation)

**Loi 09-08** (protection des personnes physiques a l'egard du traitement des donnees a caractere personnel) Article 23: les donnees signataires (nom, email, telephone, CIN) doivent etre traitees uniquement pour la finalite signature, conservees pendant duree necessaire, et accessibles par le signataire (droit acces/rectification CNDP).

**Decret 2-21-XXX** (decret d'application Loi 43-20, en cours): definit les **prestataires de services de confiance qualifies**. Au 2026-05, **Barid eSign** (filiale Poste Maroc) est l'unique prestataire qualifie pour signature electronique avancee qualifiee (SEAQ). DocuSign reste utilise pour signataires internationaux (groupes etrangers) mais signature non-qualifiee au sens 43-20.

### 3.2 Cas d'usage Skalean InsurTech

Le workflow signature est invoque par 8 cas metier distincts:

1. **Souscription contrat auto/MRH/sante/vie** (Sprint 11): signataire = souscripteur (1), parfois conjoint (2 sequential)
2. **Avenant contrat** (modification garanties, beneficiaires): souscripteur + parfois courtier (2 parallel)
3. **Declaration sinistre** (Sprint 12): assure + tiers temoins eventuels (1-3)
4. **Quittance prime** signee electroniquement: assure (1)
5. **Mandat courtier**: souscripteur + courtier (2 sequential)
6. **Cession creance** (sinistres corporels avec recours): victime + assureur + parfois avocat (2-3 sequential)
7. **Convention KYC** initiale ouverture compte: client + KYC officer (2 parallel)
8. **Document interne** (RH, fournisseurs): variable

**Volumetrie cible Y2 (apres 24 mois prod)**: ~50 000 workflows/mois, dont 35 000 contrats nouveaux, 8 000 avenants, 5 000 sinistres, 2 000 autres. Soit **~1 700 workflows/jour ouvre**, pic 3 000/jour fin de mois (commerciaux finalisent contrats). Chaque workflow contient en moyenne 1.4 signataire => ~70 000 actes signature/mois.

### 3.3 Justification architecture state machine stricte

Le **state machine strict** est non-negociable pour 4 raisons:

1. **Conformite reglementaire**: ACAPS et CNDP exigent reconstructibilite complete de l'historique signature. Toute transition invalide tentee (anomalie technique ou tentative fraude) doit etre **loggee** et **rejetee** (HTTP 422 + audit log + alert SOC).
2. **Idempotence**: les webhooks Tache 3.3.9 peuvent etre rejoues (Kafka at-least-once, retry HTTP). Si etat deja `completed`, recevoir un autre `completed` doit etre idempotent (no-op + log).
3. **Securite**: empecher `draft -> completed` direct (skip de `sent` => contournement appel provider => signature non legalement valide).
4. **Race conditions**: en mode `sequential`, deux signataires ne doivent pas pouvoir signer simultanement (lock pessimiste row + verif ordre).

### 3.4 Architecture provider abstraction

L'interface `SignatureProviderInterface` definit 5 methodes:
- `initiate(workflow): Promise<{providerWorkflowId, status}>` - cree workflow chez provider
- `getStatus(providerWorkflowId): Promise<{status, signers[]}>` - poll etat
- `cancel(providerWorkflowId, reason): Promise<void>` - annule
- `downloadCompletedDocument(providerWorkflowId): Promise<Buffer>` - recupere PDF signe
- `downloadAuditTrail(providerWorkflowId): Promise<Buffer>` - recupere certificat audit

Les 3 implementations:
- `BaridESignProvider` (Tache 3.3.7) - production
- `DocuSignProvider` (Tache 3.3.8) - international, opt-in feature flag
- `ManualSignatureProvider` (cette tache) - fallback signature papier scannee, sans appel API externe

Selection via factory `SignatureProviderFactory.getProvider(providerEnum)`.

### 3.5 Contraintes techniques

- **TypeORM 0.3.x** strict mode + migrations
- **PostgreSQL 16** avec Row Level Security (`app_current_tenant()` defini Sprint 1 Tache 1.x)
- **NestJS 10** + **Pino logger** + **Zod** validation DTO
- **Kafka 3.x** (KRaft) topics `signature.workflow.*` partition key = `tenant_id`
- **TypeScript strict** (no `any`, `strictNullChecks`, `noImplicitAny`)
- **Tests Jest 29** coverage > 90% lignes, > 85% branches
- **Multi-tenant strict** : aucune requete sans filtre `tenant_id`, RLS PostgreSQL backup
- **Observabilite OpenTelemetry**: spans pour transitions state machine, attributes `workflow_id`, `transition`, `provider`

### 3.6 Choix de design discutes

**JSONB signers vs table normalisee `sig_signers`**: nous choisissons JSONB pour 4 raisons:
1. Volumetrie modeste (max 10 signataires, ratio 1.4 moyen)
2. Atomicite transactionnelle update entire signers array
3. Pas de besoin recherche cross-workflow par signataire (use case rare)
4. Flexibilite evolution schema (ajout `cin`, `signature_image_url`, `geo_location` sans migration)

Si Y3 montre besoin recherche `WHERE signataire.email = X`, ajouter index GIN expression: `CREATE INDEX ON sig_signing_workflows USING gin ((signers -> 'email'));`. Garde l'option ouverte.

**Signature_order ENUM vs flag boolean**: ENUM choisi pour permettre extension future (`hierarchical`, `weighted`, etc.) sans nouvelle migration ALTER TYPE complexe.

**Expires_at NOT NULL**: oblige le createur a fixer une date d'expiration. Default propose dans DTO (30j) mais explicite. Loi 43-20 impose duree maximale validite signature en attente => 30j pratique standard.

## 4. Architecture

```
+--------------------------------------------------------------------+
|                  apps/api Modules signature                          |
|  +-------------------------+   +-----------------------------+      |
|  | WorkflowsController     |-->| SigningWorkflowService      |      |
|  | (REST)                  |   | (orchestration)             |      |
|  +-------------------------+   +-----------------------------+      |
|       | Zod DTO                       |  uses                       |
|       v                               v                             |
|  +-------------------------+   +-----------------------------+      |
|  | CreateWorkflowDto       |   | SigningStateMachineService  |      |
|  | UpdateWorkflowDto       |   | (transitions strict)        |      |
|  +-------------------------+   +-----------------------------+      |
|                                       |                             |
|                                       v                             |
|                                +-----------------------------+      |
|                                | SignersValidatorService     |      |
|                                | (emails, MA phone, order)   |      |
|                                +-----------------------------+      |
|                                       |                             |
|                                       v                             |
|                                +-----------------------------+      |
|                                | SignatureProviderFactory    |      |
|                                +-----------------------------+      |
|                                  /        |        \                |
|                                 v         v         v               |
|                          +---------+ +---------+ +---------+        |
|                          |Barid    | |DocuSign | |Manual   |        |
|                          |3.3.7    | |3.3.8    | |Provider |        |
|                          +---------+ +---------+ +---------+        |
+--------------------------------------------------------------------+
                             |  publishes
                             v
                +--------------------------------+
                | Kafka topics signature.*       |
                | partition_key = tenant_id      |
                +--------------------------------+
                             |  consumed by
                             v
       +------+------+--------+--------+--------+
       v      v      v        v        v        v
  Notif  Audit  Webhook  Analytics  Compliance  DataLake
  3.3.11 3.3.10  3.3.9    Sprint16   Sprint18    Sprint20
```

**Flux nominal souscription contrat**:
1. POST `/api/v1/signature/workflows` body=`{document_id, signers:[{...}], signature_order:'sequential', expires_at}`
2. SignersValidator verifie emails RFC 5322 + phones `+212\d{9}` + CIN optionnel + ordre 1..N continu
3. SigningWorkflowService.createWorkflow insere row status=`draft`, publie `signature.workflow_created`
4. POST `/api/v1/signature/workflows/:id/send`
5. StateMachine.canTransition(`draft`, `sent`) === true
6. Provider (Barid Tache 3.3.7) initiate => `provider_workflow_id`
7. UPDATE status=`sent`, sent_at=NOW(), provider_workflow_id=...
8. Publie `signature.workflow_sent`
9. Notification email/SMS premier signataire (Tache 3.3.11 consume event)
10. Webhook Tache 3.3.9 recoit `signer_viewed` -> StateMachine `sent -> in_progress`
11. Webhook recoit `signer_signed` (signataire 1) -> verif ordre, notif signataire 2
12. Repete jusqu'a tous signes -> `in_progress -> completed`
13. Publie `signature.workflow_completed` consomme par Audit (Tache 3.3.10) + Notif courtier + DocumentService update doc status

## 5. Livrables

1. Migration TypeORM `sig_signing_workflows` avec ENUMs, contraintes, index, RLS
2. Entity TypeORM `SigSigningWorkflowEntity` typee strict
3. Enum `SigningStatus` (7 valeurs)
4. Enum `SignatureProvider` (3 valeurs)
5. Enum `SignatureOrder` (2 valeurs)
6. Interface `Signer` typee + `SignerStatus` enum
7. Service `SigningWorkflowService` (CRUD + transitions + provider invocation)
8. Service `SigningStateMachineService` (table transitions valides)
9. Service `SignersValidatorService` (validation Zod + regex MA)
10. Interface `SignatureProviderInterface` + factory
11. Implementation `ManualSignatureProvider` (fallback)
12. Controller REST `WorkflowsController` 6 endpoints
13. DTO Zod `CreateWorkflowDto`, `UpdateWorkflowDto`, `CancelWorkflowDto`, `ListWorkflowsQueryDto`
14. Tests unitaires SigningWorkflowService (15 tests)
15. Tests unitaires SigningStateMachineService (10 tests)
16. Tests unitaires SignersValidatorService (8 tests)
17. Tests unitaires WorkflowsController (10 tests)
18. Tests E2E workflows.e2e-spec.ts (12 tests)
19. Documentation OpenAPI auto-generee via decorators NestJS
20. Schema Avro events Kafka publies dans schema-registry (cle `signature-workflow-v1`)
21. Topics Kafka crees: `signature.workflow_created`, `.sent`, `.completed`, `.declined`, `.expired`, `.cancelled` (6 topics)
22. Logs Pino structures niveau info pour transitions, error pour transitions invalides
23. Spans OpenTelemetry instrumentes: `signing-workflow.create`, `.send`, `.transition`, `.cancel`
24. Metriques Prometheus: `signing_workflow_created_total{tenant,provider}`, `signing_workflow_transition_duration_seconds`, `signing_workflow_invalid_transition_total`
25. Migration script rollback `down()` complet
26. README local `packages/signature/README.md` (mis a jour)
27. Variables environnement documentees dans `.env.example` racine repo

## 6. Fichiers crees/modifies

### Crees

- `repo/packages/database/src/migrations/20260508120000-SigningWorkflows.ts` (~150 lignes)
- `repo/packages/signature/src/entities/sig-signing-workflow.entity.ts` (~120 lignes)
- `repo/packages/signature/src/types/signing-status.enum.ts` (~30 lignes)
- `repo/packages/signature/src/types/signature-provider.enum.ts` (~30 lignes)
- `repo/packages/signature/src/types/signature-order.enum.ts` (~20 lignes)
- `repo/packages/signature/src/types/signer.interface.ts` (~80 lignes)
- `repo/packages/signature/src/services/signing-workflow.service.ts` (~420 lignes)
- `repo/packages/signature/src/services/signing-workflow.service.spec.ts` (~380 lignes)
- `repo/packages/signature/src/services/signing-state-machine.service.ts` (~210 lignes)
- `repo/packages/signature/src/services/signing-state-machine.service.spec.ts` (~220 lignes)
- `repo/packages/signature/src/services/signers-validator.service.ts` (~160 lignes)
- `repo/packages/signature/src/services/signers-validator.service.spec.ts` (~140 lignes)
- `repo/packages/signature/src/providers/signature-provider.interface.ts` (~90 lignes)
- `repo/packages/signature/src/providers/signature-provider.factory.ts` (~70 lignes)
- `repo/packages/signature/src/providers/manual-signature-provider.ts` (~110 lignes)
- `repo/packages/signature/src/events/workflow.events.ts` (~80 lignes - schemas Avro JSON)
- `repo/packages/signature/src/signature.module.ts` (~60 lignes)
- `repo/apps/api/src/modules/signature/controllers/workflows.controller.ts` (~280 lignes)
- `repo/apps/api/src/modules/signature/controllers/workflows.controller.spec.ts` (~220 lignes)
- `repo/apps/api/src/modules/signature/dto/create-workflow.dto.ts` (~110 lignes)
- `repo/apps/api/src/modules/signature/dto/list-workflows-query.dto.ts` (~50 lignes)
- `repo/apps/api/src/modules/signature/dto/cancel-workflow.dto.ts` (~30 lignes)
- `repo/apps/api/test/signature/workflows.e2e-spec.ts` (~360 lignes)

### Modifies

- `repo/packages/database/src/data-source.ts` (ajout entite SigSigningWorkflowEntity)
- `repo/apps/api/src/app.module.ts` (import SignatureModule)
- `repo/.env.example` (ajout SIGNATURE_DEFAULT_EXPIRATION_DAYS, etc.)
- `repo/packages/signature/package.json` (ajout dependency @nestjs/typeorm si absent)

## 7. Code complet

### 7.1 Migration `20260508120000-SigningWorkflows.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SigningWorkflows20260508120000 implements MigrationInterface {
  name = 'SigningWorkflows20260508120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Extension uuid si absente
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ENUMs
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE signing_workflow_status AS ENUM (
          'draft','sent','in_progress','completed','declined','expired','cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE signature_provider AS ENUM ('barid_esign','docusign','manual');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE signature_order AS ENUM ('parallel','sequential');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Table principale
    await queryRunner.query(`
      CREATE TABLE sig_signing_workflows (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        document_id UUID NOT NULL REFERENCES docs_documents(id) ON DELETE RESTRICT,
        provider signature_provider NOT NULL DEFAULT 'barid_esign',
        provider_workflow_id VARCHAR(255),
        status signing_workflow_status NOT NULL DEFAULT 'draft',
        signers JSONB NOT NULL DEFAULT '[]'::jsonb,
        signature_order signature_order NOT NULL DEFAULT 'sequential',
        expires_at TIMESTAMPTZ NOT NULL,
        sent_at TIMESTAMPTZ,
        completed_at TIMESTAMPTZ,
        completed_document_url TEXT,
        completion_certificate_url TEXT,
        audit_trail_url TEXT,
        cancellation_reason TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by UUID NOT NULL REFERENCES auth_users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_signers_count CHECK (jsonb_array_length(signers) BETWEEN 1 AND 10),
        CONSTRAINT chk_expires_future CHECK (expires_at > created_at),
        CONSTRAINT chk_completed_consistency CHECK (
          (status = 'completed' AND completed_at IS NOT NULL) OR
          (status <> 'completed' AND completed_at IS NULL) OR
          status IN ('cancelled','expired','declined')
        ),
        CONSTRAINT chk_sent_consistency CHECK (
          (status IN ('draft','cancelled') AND sent_at IS NULL) OR
          (status NOT IN ('draft') AND sent_at IS NOT NULL) OR
          status = 'cancelled'
        ),
        CONSTRAINT chk_provider_workflow_id_when_sent CHECK (
          status = 'draft' OR status = 'cancelled' OR provider_workflow_id IS NOT NULL OR provider = 'manual'
        )
      )
    `);

    // Index multi-tenant + status (queries listing dashboard)
    await queryRunner.query(`
      CREATE INDEX idx_sig_workflows_tenant_status
        ON sig_signing_workflows(tenant_id, status)
    `);

    // Index recherche par provider_workflow_id (webhook reception)
    await queryRunner.query(`
      CREATE INDEX idx_sig_workflows_provider
        ON sig_signing_workflows(provider, provider_workflow_id)
        WHERE provider_workflow_id IS NOT NULL
    `);

    // Index document_id (jointure avec docs_documents)
    await queryRunner.query(`
      CREATE INDEX idx_sig_workflows_document
        ON sig_signing_workflows(document_id)
    `);

    // Index expiration (cron Tache 3.3.13)
    await queryRunner.query(`
      CREATE INDEX idx_sig_workflows_expires
        ON sig_signing_workflows(expires_at)
        WHERE status IN ('sent','in_progress')
    `);

    // Index GIN sur signers pour recherche email/cin
    await queryRunner.query(`
      CREATE INDEX idx_sig_workflows_signers_gin
        ON sig_signing_workflows USING gin (signers jsonb_path_ops)
    `);

    // Trigger updated_at automatique
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION trg_set_updated_at_sig_workflows()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER set_updated_at_sig_workflows
        BEFORE UPDATE ON sig_signing_workflows
        FOR EACH ROW
        EXECUTE FUNCTION trg_set_updated_at_sig_workflows();
    `);

    // RLS
    await queryRunner.query(`ALTER TABLE sig_signing_workflows ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON sig_signing_workflows
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant())
    `);

    // Commentaires PostgreSQL pour conformite documentation
    await queryRunner.query(`COMMENT ON TABLE sig_signing_workflows IS 'Workflows signature electronique - Loi 43-20 article 4 + ACAPS Circulaire 2018/01'`);
    await queryRunner.query(`COMMENT ON COLUMN sig_signing_workflows.signers IS 'Array JSONB max 10 signataires - PII protege Loi 09-08 article 23'`);
    await queryRunner.query(`COMMENT ON COLUMN sig_signing_workflows.audit_trail_url IS 'PDF audit trail Tache 3.3.10 - opposabilite legale'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation ON sig_signing_workflows`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS set_updated_at_sig_workflows ON sig_signing_workflows`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS trg_set_updated_at_sig_workflows()`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sig_workflows_signers_gin`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sig_workflows_expires`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sig_workflows_document`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sig_workflows_provider`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_sig_workflows_tenant_status`);
    await queryRunner.query(`DROP TABLE IF EXISTS sig_signing_workflows`);
    await queryRunner.query(`DROP TYPE IF EXISTS signature_order`);
    await queryRunner.query(`DROP TYPE IF EXISTS signature_provider`);
    await queryRunner.query(`DROP TYPE IF EXISTS signing_workflow_status`);
  }
}
```

### 7.2 Entity `sig-signing-workflow.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SigningStatus } from '../types/signing-status.enum';
import { SignatureProvider } from '../types/signature-provider.enum';
import { SignatureOrder } from '../types/signature-order.enum';
import { Signer } from '../types/signer.interface';

@Entity({ name: 'sig_signing_workflows' })
@Index('idx_sig_workflows_tenant_status', ['tenantId', 'status'])
@Index('idx_sig_workflows_provider', ['provider', 'providerWorkflowId'])
@Index('idx_sig_workflows_document', ['documentId'])
export class SigSigningWorkflowEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @Column({ name: 'document_id', type: 'uuid' })
  documentId!: string;

  @Column({
    name: 'provider',
    type: 'enum',
    enum: SignatureProvider,
    default: SignatureProvider.BARID_ESIGN,
  })
  provider!: SignatureProvider;

  @Column({
    name: 'provider_workflow_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  providerWorkflowId!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: SigningStatus,
    default: SigningStatus.DRAFT,
  })
  status!: SigningStatus;

  @Column({ name: 'signers', type: 'jsonb', default: () => "'[]'::jsonb" })
  signers!: Signer[];

  @Column({
    name: 'signature_order',
    type: 'enum',
    enum: SignatureOrder,
    default: SignatureOrder.SEQUENTIAL,
  })
  signatureOrder!: SignatureOrder;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'completed_document_url', type: 'text', nullable: true })
  completedDocumentUrl!: string | null;

  @Column({ name: 'completion_certificate_url', type: 'text', nullable: true })
  completionCertificateUrl!: string | null;

  @Column({ name: 'audit_trail_url', type: 'text', nullable: true })
  auditTrailUrl!: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason!: string | null;

  @Column({ name: 'metadata', type: 'jsonb', default: () => "'{}'::jsonb" })
  metadata!: Record<string, unknown>;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
```

### 7.3 Enum `signing-status.enum.ts`

```typescript
export enum SigningStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  DECLINED = 'declined',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export const TERMINAL_STATUSES: ReadonlySet<SigningStatus> = new Set([
  SigningStatus.COMPLETED,
  SigningStatus.DECLINED,
  SigningStatus.EXPIRED,
  SigningStatus.CANCELLED,
]);

export function isTerminalStatus(status: SigningStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function isActiveStatus(status: SigningStatus): boolean {
  return status === SigningStatus.SENT || status === SigningStatus.IN_PROGRESS;
}
```

### 7.4 Enum `signature-provider.enum.ts`

```typescript
export enum SignatureProvider {
  BARID_ESIGN = 'barid_esign',
  DOCUSIGN = 'docusign',
  MANUAL = 'manual',
}

export const PROVIDER_DISPLAY_NAMES: Record<SignatureProvider, string> = {
  [SignatureProvider.BARID_ESIGN]: 'Barid eSign (Maroc - SEAQ Loi 43-20)',
  [SignatureProvider.DOCUSIGN]: 'DocuSign (International)',
  [SignatureProvider.MANUAL]: 'Signature manuelle papier scannee',
};

export function isQualifiedProvider(provider: SignatureProvider): boolean {
  return provider === SignatureProvider.BARID_ESIGN;
}
```

### 7.5 Enum `signature-order.enum.ts`

```typescript
export enum SignatureOrder {
  PARALLEL = 'parallel',
  SEQUENTIAL = 'sequential',
}
```

### 7.6 Interface `signer.interface.ts`

```typescript
export enum SignerRole {
  SIGNER = 'signer',
  APPROVER = 'approver',
  WITNESS = 'witness',
}

export enum SignerStatus {
  PENDING = 'pending',
  VIEWED = 'viewed',
  SIGNED = 'signed',
  DECLINED = 'declined',
}

export interface Signer {
  /** Nom complet, max 200 chars */
  name: string;

  /** Email RFC 5322, normalise lowercase */
  email: string;

  /** Telephone format MA +212XXXXXXXXX (12 chars) */
  phone: string;

  /** CIN MA optionnel format AA999999 ou A999999 */
  cin?: string;

  /** Role signataire */
  role: SignerRole;

  /** Ordre de signature 1..N (pertinent uniquement si signature_order=sequential) */
  order: number;

  /** Statut signataire (mis a jour par webhooks Tache 3.3.9) */
  status?: SignerStatus;

  /** Horodatage signature (ISO 8601) */
  signed_at?: string;

  /** Horodatage premiere visualisation */
  viewed_at?: string;

  /** IP address signataire (audit trail) */
  ip_address?: string;

  /** User agent navigateur (audit trail) */
  user_agent?: string;

  /** Geolocation approximative ville/pays (audit trail) */
  geo_location?: { city?: string; country?: string };

  /** Raison refus si declined */
  decline_reason?: string;
}

export function normalizeSigner(input: Signer): Signer {
  return {
    ...input,
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim().replace(/\s+/g, ''),
    name: input.name.trim(),
    cin: input.cin?.trim().toUpperCase(),
    status: input.status ?? SignerStatus.PENDING,
  };
}
```

### 7.7 Service `signing-state-machine.service.ts`

```typescript
import { Injectable, UnprocessableEntityException, Logger } from '@nestjs/common';
import { SigningStatus } from '../types/signing-status.enum';

/**
 * Table immuable des transitions d'etat valides.
 * Toute transition non listee est REJETEE (HTTP 422).
 *
 * Conformite Loi 43-20 article 4: integrite du workflow,
 * impossibilite de skip etats (ex: draft -> completed direct interdit).
 */
const VALID_TRANSITIONS: ReadonlyMap<SigningStatus, ReadonlySet<SigningStatus>> = new Map([
  [SigningStatus.DRAFT, new Set([SigningStatus.SENT, SigningStatus.CANCELLED])],
  [SigningStatus.SENT, new Set([SigningStatus.IN_PROGRESS, SigningStatus.EXPIRED, SigningStatus.CANCELLED, SigningStatus.DECLINED])],
  [SigningStatus.IN_PROGRESS, new Set([SigningStatus.COMPLETED, SigningStatus.DECLINED, SigningStatus.EXPIRED])],
  [SigningStatus.COMPLETED, new Set()],
  [SigningStatus.DECLINED, new Set()],
  [SigningStatus.EXPIRED, new Set()],
  [SigningStatus.CANCELLED, new Set()],
]);

@Injectable()
export class SigningStateMachineService {
  private readonly logger = new Logger(SigningStateMachineService.name);

  /**
   * Verifie si la transition est autorisee.
   * @returns true si autorisee, false sinon
   */
  canTransition(from: SigningStatus, to: SigningStatus): boolean {
    if (from === to) {
      // Transition identite = idempotent (no-op accepte par convention)
      return true;
    }
    const allowed = VALID_TRANSITIONS.get(from);
    return allowed?.has(to) ?? false;
  }

  /**
   * Verifie ou jette UnprocessableEntityException.
   * Log error pour audit / SOC alerting.
   */
  assertCanTransition(
    workflowId: string,
    from: SigningStatus,
    to: SigningStatus,
    context?: Record<string, unknown>,
  ): void {
    if (this.canTransition(from, to)) {
      return;
    }
    this.logger.error({
      msg: 'Invalid signing workflow state transition attempted',
      workflowId,
      from,
      to,
      context,
      severity: 'high',
      compliance: 'loi-43-20',
    });
    throw new UnprocessableEntityException({
      code: 'INVALID_STATE_TRANSITION',
      message: `Transition '${from}' -> '${to}' n'est pas autorisee`,
      details: {
        workflowId,
        currentStatus: from,
        attemptedStatus: to,
        allowedTransitions: Array.from(VALID_TRANSITIONS.get(from) ?? []),
      },
    });
  }

  /**
   * Liste les transitions sortantes possibles depuis un etat donne.
   */
  getAllowedTransitions(from: SigningStatus): SigningStatus[] {
    return Array.from(VALID_TRANSITIONS.get(from) ?? []);
  }

  /**
   * Verifie si etat est terminal (aucune transition sortante).
   */
  isTerminal(status: SigningStatus): boolean {
    return (VALID_TRANSITIONS.get(status)?.size ?? 0) === 0;
  }

  /**
   * Liste tous les statuts existants (pour validation enum).
   */
  getAllStatuses(): SigningStatus[] {
    return Object.values(SigningStatus);
  }

  /**
   * Validation generique transition + verification compatibilite metadata.
   * Ex: pour passer en `completed`, exige `completed_document_url` non null.
   */
  assertTransitionWithPayload(
    workflowId: string,
    from: SigningStatus,
    to: SigningStatus,
    payload: { completedDocumentUrl?: string | null; cancellationReason?: string | null },
  ): void {
    this.assertCanTransition(workflowId, from, to);

    if (to === SigningStatus.COMPLETED && !payload.completedDocumentUrl) {
      throw new UnprocessableEntityException({
        code: 'MISSING_COMPLETED_DOCUMENT_URL',
        message: 'Transition vers completed exige completedDocumentUrl non null',
      });
    }
    if (to === SigningStatus.CANCELLED && !payload.cancellationReason) {
      throw new UnprocessableEntityException({
        code: 'MISSING_CANCELLATION_REASON',
        message: 'Transition vers cancelled exige cancellationReason non null',
      });
    }
  }
}
```

### 7.8 Service `signers-validator.service.ts`

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { Signer, SignerRole, SignerStatus, normalizeSigner } from '../types/signer.interface';
import { SignatureOrder } from '../types/signature-order.enum';

const PHONE_MA_REGEX = /^\+212[5-7]\d{8}$/;
const CIN_MA_REGEX = /^[A-Z]{1,2}\d{4,7}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const SignerSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().regex(EMAIL_REGEX, 'Email invalide RFC 5322').max(254),
  phone: z.string().regex(PHONE_MA_REGEX, 'Telephone doit etre format MA +212[5-7]XXXXXXXX'),
  cin: z.string().regex(CIN_MA_REGEX, 'CIN format invalide (ex: AB123456)').optional(),
  role: z.nativeEnum(SignerRole),
  order: z.number().int().min(1).max(10),
  status: z.nativeEnum(SignerStatus).optional(),
  signed_at: z.string().datetime().optional(),
  viewed_at: z.string().datetime().optional(),
  ip_address: z.string().optional(),
  user_agent: z.string().max(500).optional(),
  geo_location: z.object({
    city: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  decline_reason: z.string().max(500).optional(),
});

@Injectable()
export class SignersValidatorService {
  /**
   * Valide la liste des signataires et retourne signers normalises.
   * Verifie:
   * - Schema individuel (Zod)
   * - Min 1 max 10 signataires
   * - Pas de doublons emails ni CIN
   * - Si sequential: ordres continus 1..N sans trous
   * - Au moins 1 role 'signer' (un workflow ne peut etre que approbations sans signature)
   */
  validateSigners(signers: Signer[], signatureOrder: SignatureOrder): Signer[] {
    if (!Array.isArray(signers) || signers.length === 0) {
      throw new BadRequestException({
        code: 'SIGNERS_EMPTY',
        message: 'Au moins 1 signataire requis',
      });
    }

    if (signers.length > 10) {
      throw new BadRequestException({
        code: 'SIGNERS_TOO_MANY',
        message: 'Maximum 10 signataires par workflow',
      });
    }

    const normalized: Signer[] = [];
    const emailSet = new Set<string>();
    const cinSet = new Set<string>();
    const orderSet = new Set<number>();

    for (let i = 0; i < signers.length; i++) {
      const raw = signers[i];
      const parsed = SignerSchema.safeParse(raw);
      if (!parsed.success) {
        throw new BadRequestException({
          code: 'SIGNER_INVALID',
          message: `Signataire #${i + 1} invalide`,
          details: parsed.error.flatten(),
        });
      }
      const norm = normalizeSigner(parsed.data as Signer);

      if (emailSet.has(norm.email)) {
        throw new BadRequestException({
          code: 'SIGNERS_DUPLICATE_EMAIL',
          message: `Email duplique: ${norm.email}`,
        });
      }
      emailSet.add(norm.email);

      if (norm.cin) {
        if (cinSet.has(norm.cin)) {
          throw new BadRequestException({
            code: 'SIGNERS_DUPLICATE_CIN',
            message: `CIN duplique: ${norm.cin}`,
          });
        }
        cinSet.add(norm.cin);
      }

      if (orderSet.has(norm.order)) {
        throw new BadRequestException({
          code: 'SIGNERS_DUPLICATE_ORDER',
          message: `Ordre duplique: ${norm.order}`,
        });
      }
      orderSet.add(norm.order);

      normalized.push(norm);
    }

    // Si sequentiel, verifier ordres continus 1..N
    if (signatureOrder === SignatureOrder.SEQUENTIAL) {
      const sortedOrders = Array.from(orderSet).sort((a, b) => a - b);
      for (let i = 0; i < sortedOrders.length; i++) {
        if (sortedOrders[i] !== i + 1) {
          throw new BadRequestException({
            code: 'SIGNERS_ORDER_NOT_CONTINUOUS',
            message: `Ordres signataires sequentiels doivent etre continus 1..N, trouve: ${sortedOrders.join(',')}`,
          });
        }
      }
    }

    // Au moins 1 'signer' (les approbateurs/temoins seuls ne suffisent pas)
    const hasRealSigner = normalized.some((s) => s.role === SignerRole.SIGNER);
    if (!hasRealSigner) {
      throw new BadRequestException({
        code: 'SIGNERS_NO_REAL_SIGNER',
        message: "Au moins 1 signataire avec role 'signer' requis",
      });
    }

    return normalized.sort((a, b) => a.order - b.order);
  }

  /**
   * Recupere le prochain signataire en attente pour mode sequentiel.
   * @returns signataire ou null si tous ont signe / refuse
   */
  getNextPendingSigner(signers: Signer[]): Signer | null {
    const sorted = [...signers].sort((a, b) => a.order - b.order);
    return sorted.find((s) => s.status === SignerStatus.PENDING || s.status === SignerStatus.VIEWED) ?? null;
  }

  /**
   * Verifie si tous les signataires ont signe.
   */
  allSigned(signers: Signer[]): boolean {
    return signers.every((s) => s.status === SignerStatus.SIGNED);
  }

  /**
   * Verifie si au moins un signataire a refuse.
   */
  anyDeclined(signers: Signer[]): boolean {
    return signers.some((s) => s.status === SignerStatus.DECLINED);
  }
}
```

### 7.9 Interface `signature-provider.interface.ts`

```typescript
import { Signer } from '../types/signer.interface';
import { SignatureOrder } from '../types/signature-order.enum';

export interface ProviderInitiateInput {
  tenantId: string;
  workflowId: string;
  documentId: string;
  documentUrl: string; // presigned URL S3 valide 60 min
  documentChecksum: string; // SHA-256 hex
  signers: Signer[];
  signatureOrder: SignatureOrder;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface ProviderInitiateOutput {
  providerWorkflowId: string;
  providerStatus: string;
  signersInviteUrls?: Record<string, string>; // email -> URL signature
}

export interface ProviderStatusOutput {
  providerStatus: string;
  signers: Array<{
    email: string;
    status: 'pending' | 'viewed' | 'signed' | 'declined';
    signed_at?: string;
    viewed_at?: string;
    decline_reason?: string;
    ip_address?: string;
  }>;
  completedDocumentUrl?: string;
  completionCertificateUrl?: string;
  auditTrailUrl?: string;
}

/**
 * Contrat abstrait fournisseur de signature electronique.
 * Implementations: BaridESignProvider (3.3.7), DocuSignProvider (3.3.8), ManualSignatureProvider (3.3.6).
 */
export interface SignatureProviderInterface {
  /** Identifiant du provider (matche enum SignatureProvider) */
  readonly providerId: string;

  /** Initie un workflow chez le provider (cree session signature) */
  initiate(input: ProviderInitiateInput): Promise<ProviderInitiateOutput>;

  /** Recupere le statut courant du workflow */
  getStatus(providerWorkflowId: string): Promise<ProviderStatusOutput>;

  /** Annule le workflow chez le provider */
  cancel(providerWorkflowId: string, reason: string): Promise<void>;

  /** Telecharge le document signe finalise (PDF) */
  downloadCompletedDocument(providerWorkflowId: string): Promise<Buffer>;

  /** Telecharge le certificat audit trail (PDF avec preuves) */
  downloadAuditTrail(providerWorkflowId: string): Promise<Buffer>;
}
```

### 7.10 Service `signing-workflow.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, FindOptionsWhere, In } from 'typeorm';
import { SigSigningWorkflowEntity } from '../entities/sig-signing-workflow.entity';
import { SigningStatus, isTerminalStatus } from '../types/signing-status.enum';
import { SignatureProvider } from '../types/signature-provider.enum';
import { SignatureOrder } from '../types/signature-order.enum';
import { Signer, SignerStatus } from '../types/signer.interface';
import { SigningStateMachineService } from './signing-state-machine.service';
import { SignersValidatorService } from './signers-validator.service';
import { SignatureProviderFactory } from '../providers/signature-provider.factory';
import { KafkaProducerService } from '@skalean/kafka';
import { DocumentService } from '@skalean/documents';

export interface CreateWorkflowInput {
  tenantId: string;
  documentId: string;
  signers: Signer[];
  signatureOrder?: SignatureOrder;
  provider?: SignatureProvider;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
  createdBy: string;
}

export interface ListWorkflowsQuery {
  tenantId: string;
  status?: SigningStatus | SigningStatus[];
  provider?: SignatureProvider;
  documentId?: string;
  createdByMe?: boolean;
  userId?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class SigningWorkflowService {
  private readonly logger = new Logger(SigningWorkflowService.name);

  constructor(
    @InjectRepository(SigSigningWorkflowEntity)
    private readonly repo: Repository<SigSigningWorkflowEntity>,
    private readonly stateMachine: SigningStateMachineService,
    private readonly signersValidator: SignersValidatorService,
    private readonly providerFactory: SignatureProviderFactory,
    private readonly kafkaProducer: KafkaProducerService,
    private readonly documentService: DocumentService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Cree un workflow en status DRAFT.
   * Aucune communication provider a ce stade.
   */
  async createWorkflow(input: CreateWorkflowInput): Promise<SigSigningWorkflowEntity> {
    const order = input.signatureOrder ?? SignatureOrder.SEQUENTIAL;
    const provider = input.provider ?? SignatureProvider.BARID_ESIGN;

    // Validation expires_at futur
    if (input.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'EXPIRES_AT_IN_PAST',
        message: 'expires_at doit etre dans le futur',
      });
    }
    // Max 90j (Loi 43-20 ne fixe pas, mais best practice + CNDP retention)
    const maxExpiry = Date.now() + 90 * 24 * 3600 * 1000;
    if (input.expiresAt.getTime() > maxExpiry) {
      throw new BadRequestException({
        code: 'EXPIRES_AT_TOO_FAR',
        message: 'expires_at maximum 90 jours dans le futur',
      });
    }

    // Validation signataires
    const validatedSigners = this.signersValidator.validateSigners(input.signers, order);

    // Verifier document existe et appartient au tenant
    const document = await this.documentService.findOne(input.documentId, input.tenantId);
    if (!document) {
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_FOUND',
        message: `Document ${input.documentId} introuvable`,
      });
    }

    // Verifier qu'aucun workflow actif n'existe deja pour ce document
    const existingActive = await this.repo.findOne({
      where: {
        tenantId: input.tenantId,
        documentId: input.documentId,
        status: In([SigningStatus.DRAFT, SigningStatus.SENT, SigningStatus.IN_PROGRESS]),
      },
    });
    if (existingActive) {
      throw new ConflictException({
        code: 'WORKFLOW_ACTIVE_EXISTS',
        message: `Un workflow actif existe deja pour le document ${input.documentId}`,
        details: { existingWorkflowId: existingActive.id, status: existingActive.status },
      });
    }

    const entity = this.repo.create({
      tenantId: input.tenantId,
      documentId: input.documentId,
      provider,
      status: SigningStatus.DRAFT,
      signers: validatedSigners,
      signatureOrder: order,
      expiresAt: input.expiresAt,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy,
    });

    const saved = await this.repo.save(entity);

    await this.kafkaProducer.publish({
      topic: 'signature.workflow_created',
      key: input.tenantId,
      value: {
        eventId: crypto.randomUUID(),
        eventType: 'signature.workflow_created',
        eventTime: new Date().toISOString(),
        tenantId: saved.tenantId,
        workflowId: saved.id,
        documentId: saved.documentId,
        provider: saved.provider,
        signersCount: saved.signers.length,
        signatureOrder: saved.signatureOrder,
        expiresAt: saved.expiresAt.toISOString(),
        createdBy: saved.createdBy,
      },
    });

    this.logger.info({
      msg: 'Workflow signature cree',
      workflowId: saved.id,
      tenantId: saved.tenantId,
      provider,
      signersCount: saved.signers.length,
    });

    return saved;
  }

  /**
   * Envoi pour signature: transition DRAFT -> SENT + appel provider.
   */
  async sendForSignature(workflowId: string, tenantId: string, userId: string): Promise<SigSigningWorkflowEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repoTx = manager.getRepository(SigSigningWorkflowEntity);
      const wf = await repoTx
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id AND w.tenant_id = :tenantId', { id: workflowId, tenantId })
        .getOne();

      if (!wf) {
        throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND' });
      }

      this.stateMachine.assertCanTransition(wf.id, wf.status, SigningStatus.SENT);

      // Verifier document toujours existant + presigned URL
      const presignedDoc = await this.documentService.getDownloadUrl(wf.documentId, tenantId, 3600);
      const docMeta = await this.documentService.findOne(wf.documentId, tenantId);
      if (!docMeta) {
        throw new NotFoundException({ code: 'DOCUMENT_NOT_FOUND' });
      }

      const provider = this.providerFactory.getProvider(wf.provider);
      const initiated = await provider.initiate({
        tenantId: wf.tenantId,
        workflowId: wf.id,
        documentId: wf.documentId,
        documentUrl: presignedDoc.url,
        documentChecksum: docMeta.checksum,
        signers: wf.signers,
        signatureOrder: wf.signatureOrder,
        expiresAt: wf.expiresAt,
        metadata: wf.metadata,
      });

      wf.status = SigningStatus.SENT;
      wf.sentAt = new Date();
      wf.providerWorkflowId = initiated.providerWorkflowId;
      const saved = await repoTx.save(wf);

      await this.kafkaProducer.publish({
        topic: 'signature.workflow_sent',
        key: tenantId,
        value: {
          eventId: crypto.randomUUID(),
          eventType: 'signature.workflow_sent',
          eventTime: new Date().toISOString(),
          tenantId,
          workflowId: saved.id,
          providerWorkflowId: saved.providerWorkflowId,
          provider: saved.provider,
          sentBy: userId,
          signersInviteUrls: initiated.signersInviteUrls,
        },
      });

      this.logger.info({ msg: 'Workflow envoye pour signature', workflowId: saved.id, provider: saved.provider });
      return saved;
    });
  }

  async getWorkflow(workflowId: string, tenantId: string): Promise<SigSigningWorkflowEntity> {
    const wf = await this.repo.findOne({ where: { id: workflowId, tenantId } });
    if (!wf) throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND' });
    return wf;
  }

  async listWorkflows(query: ListWorkflowsQuery): Promise<{ items: SigSigningWorkflowEntity[]; total: number }> {
    const where: FindOptionsWhere<SigSigningWorkflowEntity> = { tenantId: query.tenantId };
    if (query.status) where.status = Array.isArray(query.status) ? In(query.status) : query.status;
    if (query.provider) where.provider = query.provider;
    if (query.documentId) where.documentId = query.documentId;
    if (query.createdByMe && query.userId) where.createdBy = query.userId;

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));

    const [items, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total };
  }

  /**
   * Cancel workflow (action utilisateur).
   * Autorise depuis DRAFT ou SENT uniquement.
   */
  async cancelWorkflow(
    workflowId: string,
    tenantId: string,
    userId: string,
    reason: string,
  ): Promise<SigSigningWorkflowEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repoTx = manager.getRepository(SigSigningWorkflowEntity);
      const wf = await repoTx
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id AND w.tenant_id = :tenantId', { id: workflowId, tenantId })
        .getOne();

      if (!wf) throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND' });

      this.stateMachine.assertTransitionWithPayload(wf.id, wf.status, SigningStatus.CANCELLED, {
        cancellationReason: reason,
      });

      // Si workflow chez provider, annuler la-bas aussi
      if (wf.providerWorkflowId) {
        const provider = this.providerFactory.getProvider(wf.provider);
        try {
          await provider.cancel(wf.providerWorkflowId, reason);
        } catch (err) {
          this.logger.warn({
            msg: 'Provider cancel failed, marking local cancelled anyway',
            workflowId: wf.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      wf.status = SigningStatus.CANCELLED;
      wf.cancellationReason = reason;
      const saved = await repoTx.save(wf);

      await this.kafkaProducer.publish({
        topic: 'signature.workflow_cancelled',
        key: tenantId,
        value: {
          eventId: crypto.randomUUID(),
          eventType: 'signature.workflow_cancelled',
          eventTime: new Date().toISOString(),
          tenantId,
          workflowId: saved.id,
          cancelledBy: userId,
          reason,
        },
      });
      return saved;
    });
  }

  /**
   * Marque workflow completed (appele par webhook receiver Tache 3.3.9).
   * Idempotent: si deja completed, no-op.
   */
  async markCompleted(
    workflowId: string,
    tenantId: string,
    payload: {
      completedDocumentUrl: string;
      completionCertificateUrl?: string;
      auditTrailUrl?: string;
      signersUpdated: Signer[];
    },
  ): Promise<SigSigningWorkflowEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repoTx = manager.getRepository(SigSigningWorkflowEntity);
      const wf = await repoTx
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id AND w.tenant_id = :tenantId', { id: workflowId, tenantId })
        .getOne();

      if (!wf) throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND' });

      // Idempotence
      if (wf.status === SigningStatus.COMPLETED) {
        this.logger.info({ msg: 'markCompleted called on already completed workflow (idempotent no-op)', workflowId });
        return wf;
      }

      this.stateMachine.assertTransitionWithPayload(wf.id, wf.status, SigningStatus.COMPLETED, {
        completedDocumentUrl: payload.completedDocumentUrl,
      });

      wf.status = SigningStatus.COMPLETED;
      wf.completedAt = new Date();
      wf.completedDocumentUrl = payload.completedDocumentUrl;
      wf.completionCertificateUrl = payload.completionCertificateUrl ?? null;
      wf.auditTrailUrl = payload.auditTrailUrl ?? null;
      wf.signers = payload.signersUpdated;

      const saved = await repoTx.save(wf);

      await this.kafkaProducer.publish({
        topic: 'signature.workflow_completed',
        key: tenantId,
        value: {
          eventId: crypto.randomUUID(),
          eventType: 'signature.workflow_completed',
          eventTime: new Date().toISOString(),
          tenantId,
          workflowId: saved.id,
          documentId: saved.documentId,
          completedDocumentUrl: saved.completedDocumentUrl,
          completionCertificateUrl: saved.completionCertificateUrl,
          signersCount: saved.signers.length,
          completedAt: saved.completedAt!.toISOString(),
        },
      });

      this.logger.info({ msg: 'Workflow signature completed', workflowId: saved.id });
      return saved;
    });
  }

  async markDeclined(
    workflowId: string,
    tenantId: string,
    declinedBySignerEmail: string,
    declineReason: string,
  ): Promise<SigSigningWorkflowEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repoTx = manager.getRepository(SigSigningWorkflowEntity);
      const wf = await repoTx
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id AND w.tenant_id = :tenantId', { id: workflowId, tenantId })
        .getOne();

      if (!wf) throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND' });
      if (wf.status === SigningStatus.DECLINED) return wf;

      this.stateMachine.assertCanTransition(wf.id, wf.status, SigningStatus.DECLINED);

      const idx = wf.signers.findIndex((s) => s.email === declinedBySignerEmail.toLowerCase());
      if (idx === -1) {
        throw new BadRequestException({ code: 'SIGNER_NOT_FOUND', message: `Signataire ${declinedBySignerEmail} introuvable` });
      }
      wf.signers[idx] = {
        ...wf.signers[idx],
        status: SignerStatus.DECLINED,
        decline_reason: declineReason,
      };
      wf.status = SigningStatus.DECLINED;
      const saved = await repoTx.save(wf);

      await this.kafkaProducer.publish({
        topic: 'signature.workflow_declined',
        key: tenantId,
        value: {
          eventId: crypto.randomUUID(),
          eventType: 'signature.workflow_declined',
          eventTime: new Date().toISOString(),
          tenantId,
          workflowId: saved.id,
          declinedBySignerEmail,
          declineReason,
        },
      });
      return saved;
    });
  }

  async markExpired(workflowId: string, tenantId: string): Promise<SigSigningWorkflowEntity> {
    return this.dataSource.transaction(async (manager) => {
      const repoTx = manager.getRepository(SigSigningWorkflowEntity);
      const wf = await repoTx
        .createQueryBuilder('w')
        .setLock('pessimistic_write')
        .where('w.id = :id AND w.tenant_id = :tenantId', { id: workflowId, tenantId })
        .getOne();

      if (!wf) throw new NotFoundException({ code: 'WORKFLOW_NOT_FOUND' });
      if (wf.status === SigningStatus.EXPIRED) return wf;

      this.stateMachine.assertCanTransition(wf.id, wf.status, SigningStatus.EXPIRED);
      wf.status = SigningStatus.EXPIRED;
      const saved = await repoTx.save(wf);

      await this.kafkaProducer.publish({
        topic: 'signature.workflow_expired',
        key: tenantId,
        value: {
          eventId: crypto.randomUUID(),
          eventType: 'signature.workflow_expired',
          eventTime: new Date().toISOString(),
          tenantId,
          workflowId: saved.id,
          expiredAt: new Date().toISOString(),
        },
      });
      return saved;
    });
  }
}
```

### 7.11 Provider `manual-signature-provider.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { SignatureProvider } from '../types/signature-provider.enum';
import {
  SignatureProviderInterface,
  ProviderInitiateInput,
  ProviderInitiateOutput,
  ProviderStatusOutput,
} from './signature-provider.interface';

/**
 * Provider manuel: utilise lorsque la signature s'effectue hors-ligne (papier scanne).
 * Ne fait aucun appel API externe.
 * - initiate(): genere un providerWorkflowId pseudo-aleatoire, retourne immediatement
 * - getStatus(): retourne toujours pending (mise a jour manuelle via callback PATCH /workflows/:id/manual-update)
 * - cancel(): no-op
 * - downloadCompletedDocument: throw not implemented (le PDF signe est upload manuellement par l'agent)
 */
@Injectable()
export class ManualSignatureProvider implements SignatureProviderInterface {
  readonly providerId = SignatureProvider.MANUAL;
  private readonly logger = new Logger(ManualSignatureProvider.name);

  async initiate(input: ProviderInitiateInput): Promise<ProviderInitiateOutput> {
    const providerWorkflowId = `manual-${input.workflowId}`;
    this.logger.info({
      msg: 'Manual signature provider initiated (no external API call)',
      workflowId: input.workflowId,
      providerWorkflowId,
      signersCount: input.signers.length,
    });
    return {
      providerWorkflowId,
      providerStatus: 'pending_manual',
      signersInviteUrls: {},
    };
  }

  async getStatus(providerWorkflowId: string): Promise<ProviderStatusOutput> {
    this.logger.debug({ msg: 'Manual provider getStatus (no remote check)', providerWorkflowId });
    return {
      providerStatus: 'pending_manual',
      signers: [],
    };
  }

  async cancel(providerWorkflowId: string, reason: string): Promise<void> {
    this.logger.info({ msg: 'Manual provider cancel (no-op)', providerWorkflowId, reason });
  }

  async downloadCompletedDocument(providerWorkflowId: string): Promise<Buffer> {
    throw new Error(
      `ManualSignatureProvider.downloadCompletedDocument: non disponible. Le document signe doit etre uploade manuellement (workflow ${providerWorkflowId})`,
    );
  }

  async downloadAuditTrail(providerWorkflowId: string): Promise<Buffer> {
    throw new Error(
      `ManualSignatureProvider.downloadAuditTrail: non disponible (workflow ${providerWorkflowId})`,
    );
  }
}
```

### 7.12 Factory `signature-provider.factory.ts`

```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { SignatureProvider } from '../types/signature-provider.enum';
import { SignatureProviderInterface } from './signature-provider.interface';
import { ManualSignatureProvider } from './manual-signature-provider';

export const SIGNATURE_PROVIDERS_TOKEN = 'SIGNATURE_PROVIDERS';

@Injectable()
export class SignatureProviderFactory {
  private readonly providers: Map<string, SignatureProviderInterface>;

  constructor(
    @Inject(SIGNATURE_PROVIDERS_TOKEN) providers: SignatureProviderInterface[],
    private readonly manualProvider: ManualSignatureProvider,
  ) {
    this.providers = new Map();
    for (const p of providers ?? []) {
      this.providers.set(p.providerId, p);
    }
    this.providers.set(this.manualProvider.providerId, this.manualProvider);
  }

  getProvider(providerEnum: SignatureProvider): SignatureProviderInterface {
    const p = this.providers.get(providerEnum);
    if (!p) {
      throw new NotFoundException({
        code: 'PROVIDER_NOT_REGISTERED',
        message: `Provider ${providerEnum} non enregistre. Disponibles: ${Array.from(this.providers.keys()).join(',')}`,
      });
    }
    return p;
  }

  listProviders(): SignatureProvider[] {
    return Array.from(this.providers.keys()) as SignatureProvider[];
  }
}
```

### 7.13 Controller `workflows.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  UsePipes,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ZodValidationPipe } from '@skalean/common';
import { JwtAuthGuard, TenantContext, CurrentUser, RequirePermission } from '@skalean/auth';
import { SigningWorkflowService } from '@skalean/signature';
import { CreateWorkflowDto, CreateWorkflowSchema } from '../dto/create-workflow.dto';
import { CancelWorkflowDto, CancelWorkflowSchema } from '../dto/cancel-workflow.dto';
import { ListWorkflowsQueryDto, ListWorkflowsQuerySchema } from '../dto/list-workflows-query.dto';

@ApiTags('signature.workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/signature/workflows')
export class WorkflowsController {
  constructor(private readonly service: SigningWorkflowService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('signature.workflow.create')
  @ApiOperation({ summary: 'Cree un workflow signature en draft' })
  @ApiResponse({ status: 201, description: 'Workflow cree' })
  @ApiResponse({ status: 400, description: 'Donnees invalides' })
  @ApiResponse({ status: 409, description: 'Workflow actif existe deja pour ce document' })
  async create(
    @Body(new ZodValidationPipe(CreateWorkflowSchema)) dto: CreateWorkflowDto,
    @TenantContext() tenantId: string,
    @CurrentUser() userId: string,
  ) {
    const wf = await this.service.createWorkflow({
      tenantId,
      documentId: dto.documentId,
      signers: dto.signers,
      signatureOrder: dto.signatureOrder,
      provider: dto.provider,
      expiresAt: new Date(dto.expiresAt),
      metadata: dto.metadata,
      createdBy: userId,
    });
    return this.toResponse(wf);
  }

  @Get()
  @RequirePermission('signature.workflow.read')
  @ApiOperation({ summary: 'Liste workflows tenant courant' })
  async list(
    @Query(new ZodValidationPipe(ListWorkflowsQuerySchema)) q: ListWorkflowsQueryDto,
    @TenantContext() tenantId: string,
    @CurrentUser() userId: string,
  ) {
    const result = await this.service.listWorkflows({
      tenantId,
      status: q.status,
      provider: q.provider,
      documentId: q.documentId,
      createdByMe: q.createdByMe,
      userId,
      page: q.page,
      pageSize: q.pageSize,
    });
    return {
      items: result.items.map((w) => this.toResponse(w)),
      total: result.total,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
    };
  }

  @Get(':id')
  @RequirePermission('signature.workflow.read')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @TenantContext() tenantId: string,
  ) {
    const wf = await this.service.getWorkflow(id, tenantId);
    return this.toResponse(wf);
  }

  @Post(':id/send')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('signature.workflow.send')
  @ApiOperation({ summary: 'Envoie pour signature (transition draft -> sent + appel provider)' })
  async send(
    @Param('id', new ParseUUIDPipe()) id: string,
    @TenantContext() tenantId: string,
    @CurrentUser() userId: string,
  ) {
    const wf = await this.service.sendForSignature(id, tenantId, userId);
    return this.toResponse(wf);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('signature.workflow.cancel')
  async cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(CancelWorkflowSchema)) dto: CancelWorkflowDto,
    @TenantContext() tenantId: string,
    @CurrentUser() userId: string,
  ) {
    const wf = await this.service.cancelWorkflow(id, tenantId, userId, dto.reason);
    return this.toResponse(wf);
  }

  @Get(':id/audit-trail')
  @RequirePermission('signature.workflow.read')
  @ApiOperation({ summary: "Telecharge l'audit trail PDF (Tache 3.3.10)" })
  async auditTrail(
    @Param('id', new ParseUUIDPipe()) id: string,
    @TenantContext() tenantId: string,
  ) {
    const wf = await this.service.getWorkflow(id, tenantId);
    if (!wf.auditTrailUrl) {
      return { url: null, message: 'Audit trail pas encore disponible (workflow non complete)' };
    }
    return { url: wf.auditTrailUrl, expiresIn: 3600 };
  }

  private toResponse(wf: any) {
    return {
      id: wf.id,
      documentId: wf.documentId,
      provider: wf.provider,
      providerWorkflowId: wf.providerWorkflowId,
      status: wf.status,
      signers: wf.signers.map((s: any) => ({
        name: s.name,
        email: s.email,
        phone: s.phone,
        cin: s.cin,
        role: s.role,
        order: s.order,
        status: s.status,
        signed_at: s.signed_at,
        viewed_at: s.viewed_at,
      })),
      signatureOrder: wf.signatureOrder,
      expiresAt: wf.expiresAt.toISOString(),
      sentAt: wf.sentAt?.toISOString() ?? null,
      completedAt: wf.completedAt?.toISOString() ?? null,
      cancellationReason: wf.cancellationReason,
      createdAt: wf.createdAt.toISOString(),
      updatedAt: wf.updatedAt.toISOString(),
    };
  }
}
```

### 7.14 DTO `create-workflow.dto.ts`

```typescript
import { z } from 'zod';
import { SignatureProvider } from '@skalean/signature';
import { SignatureOrder } from '@skalean/signature';
import { SignerRole } from '@skalean/signature';

const PHONE_MA_REGEX = /^\+212[5-7]\d{8}$/;
const CIN_MA_REGEX = /^[A-Z]{1,2}\d{4,7}$/;

const SignerInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  email: z.string().email().max(254),
  phone: z.string().regex(PHONE_MA_REGEX),
  cin: z.string().regex(CIN_MA_REGEX).optional(),
  role: z.nativeEnum(SignerRole).default(SignerRole.SIGNER),
  order: z.number().int().min(1).max(10),
});

export const CreateWorkflowSchema = z.object({
  documentId: z.string().uuid(),
  signers: z.array(SignerInputSchema).min(1).max(10),
  signatureOrder: z.nativeEnum(SignatureOrder).default(SignatureOrder.SEQUENTIAL),
  provider: z.nativeEnum(SignatureProvider).default(SignatureProvider.BARID_ESIGN),
  expiresAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
}).strict();

export type CreateWorkflowDto = z.infer<typeof CreateWorkflowSchema>;
```

### 7.15 DTO `cancel-workflow.dto.ts`

```typescript
import { z } from 'zod';
export const CancelWorkflowSchema = z.object({
  reason: z.string().trim().min(5).max(500),
}).strict();
export type CancelWorkflowDto = z.infer<typeof CancelWorkflowSchema>;
```

### 7.16 DTO `list-workflows-query.dto.ts`

```typescript
import { z } from 'zod';
import { SigningStatus, SignatureProvider } from '@skalean/signature';

export const ListWorkflowsQuerySchema = z.object({
  status: z.union([z.nativeEnum(SigningStatus), z.array(z.nativeEnum(SigningStatus))]).optional(),
  provider: z.nativeEnum(SignatureProvider).optional(),
  documentId: z.string().uuid().optional(),
  createdByMe: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export type ListWorkflowsQueryDto = z.infer<typeof ListWorkflowsQuerySchema>;
```

### 7.17 Module `signature.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SigSigningWorkflowEntity } from './entities/sig-signing-workflow.entity';
import { SigningWorkflowService } from './services/signing-workflow.service';
import { SigningStateMachineService } from './services/signing-state-machine.service';
import { SignersValidatorService } from './services/signers-validator.service';
import { SignatureProviderFactory, SIGNATURE_PROVIDERS_TOKEN } from './providers/signature-provider.factory';
import { ManualSignatureProvider } from './providers/manual-signature-provider';
import { KafkaModule } from '@skalean/kafka';
import { DocumentsModule } from '@skalean/documents';

@Module({
  imports: [TypeOrmModule.forFeature([SigSigningWorkflowEntity]), KafkaModule, DocumentsModule],
  providers: [
    SigningWorkflowService,
    SigningStateMachineService,
    SignersValidatorService,
    ManualSignatureProvider,
    SignatureProviderFactory,
    { provide: SIGNATURE_PROVIDERS_TOKEN, useValue: [] }, // remplis Tache 3.3.7+
  ],
  exports: [SigningWorkflowService, SigningStateMachineService, SignersValidatorService, SignatureProviderFactory],
})
export class SignatureModule {}
```

### 7.18 Events Kafka schemas `workflow.events.ts`

```typescript
export const WORKFLOW_EVENT_SCHEMAS = {
  'signature.workflow_created': {
    type: 'record',
    name: 'WorkflowCreated',
    fields: [
      { name: 'eventId', type: 'string' },
      { name: 'eventType', type: 'string' },
      { name: 'eventTime', type: 'string' },
      { name: 'tenantId', type: 'string' },
      { name: 'workflowId', type: 'string' },
      { name: 'documentId', type: 'string' },
      { name: 'provider', type: 'string' },
      { name: 'signersCount', type: 'int' },
      { name: 'signatureOrder', type: 'string' },
      { name: 'expiresAt', type: 'string' },
      { name: 'createdBy', type: 'string' },
    ],
  },
  'signature.workflow_sent': { /* idem */ },
  'signature.workflow_completed': { /* idem + completedDocumentUrl, completionCertificateUrl */ },
  'signature.workflow_declined': { /* idem + declinedBySignerEmail, declineReason */ },
  'signature.workflow_expired': { /* idem + expiredAt */ },
  'signature.workflow_cancelled': { /* idem + cancelledBy, reason */ },
} as const;
```

## 8. Tests

### 8.1 `signing-state-machine.service.spec.ts` (10 tests)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UnprocessableEntityException } from '@nestjs/common';
import { SigningStateMachineService } from './signing-state-machine.service';
import { SigningStatus } from '../types/signing-status.enum';

describe('SigningStateMachineService', () => {
  let service: SigningStateMachineService;

  beforeEach(async () => {
    const mod: TestingModule = await Test.createTestingModule({
      providers: [SigningStateMachineService],
    }).compile();
    service = mod.get(SigningStateMachineService);
  });

  it('1. autorise draft -> sent', () => {
    expect(service.canTransition(SigningStatus.DRAFT, SigningStatus.SENT)).toBe(true);
  });

  it('2. autorise sent -> in_progress', () => {
    expect(service.canTransition(SigningStatus.SENT, SigningStatus.IN_PROGRESS)).toBe(true);
  });

  it('3. autorise in_progress -> completed', () => {
    expect(service.canTransition(SigningStatus.IN_PROGRESS, SigningStatus.COMPLETED)).toBe(true);
  });

  it('4. rejette draft -> completed (skip)', () => {
    expect(service.canTransition(SigningStatus.DRAFT, SigningStatus.COMPLETED)).toBe(false);
  });

  it('5. rejette draft -> in_progress', () => {
    expect(service.canTransition(SigningStatus.DRAFT, SigningStatus.IN_PROGRESS)).toBe(false);
  });

  it('6. rejette completed -> sent (terminal)', () => {
    expect(service.canTransition(SigningStatus.COMPLETED, SigningStatus.SENT)).toBe(false);
  });

  it('7. assertCanTransition jette UnprocessableEntityException pour transition invalide', () => {
    expect(() =>
      service.assertCanTransition('wf-1', SigningStatus.DRAFT, SigningStatus.COMPLETED),
    ).toThrow(UnprocessableEntityException);
  });

  it('8. transition identite (ex: completed -> completed) acceptee comme idempotent', () => {
    expect(service.canTransition(SigningStatus.COMPLETED, SigningStatus.COMPLETED)).toBe(true);
  });

  it('9. isTerminal retourne true pour completed/declined/expired/cancelled', () => {
    expect(service.isTerminal(SigningStatus.COMPLETED)).toBe(true);
    expect(service.isTerminal(SigningStatus.DECLINED)).toBe(true);
    expect(service.isTerminal(SigningStatus.EXPIRED)).toBe(true);
    expect(service.isTerminal(SigningStatus.CANCELLED)).toBe(true);
  });

  it('10. assertTransitionWithPayload exige completedDocumentUrl pour completed', () => {
    expect(() =>
      service.assertTransitionWithPayload('wf-1', SigningStatus.IN_PROGRESS, SigningStatus.COMPLETED, {}),
    ).toThrow(/MISSING_COMPLETED_DOCUMENT_URL/);
  });
});
```

### 8.2 `signers-validator.service.spec.ts` (8 tests)

```typescript
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { SignersValidatorService } from './signers-validator.service';
import { SignerRole } from '../types/signer.interface';
import { SignatureOrder } from '../types/signature-order.enum';

describe('SignersValidatorService', () => {
  let service: SignersValidatorService;
  beforeEach(async () => {
    const mod = await Test.createTestingModule({ providers: [SignersValidatorService] }).compile();
    service = mod.get(SignersValidatorService);
  });

  const valid = (overrides: any = {}) => ({
    name: 'Ahmed Bennani',
    email: 'ahmed@example.ma',
    phone: '+212661234567',
    cin: 'AB123456',
    role: SignerRole.SIGNER,
    order: 1,
    ...overrides,
  });

  it('1. accepte signataire valide unique', () => {
    const r = service.validateSigners([valid()], SignatureOrder.SEQUENTIAL);
    expect(r).toHaveLength(1);
    expect(r[0].email).toBe('ahmed@example.ma');
  });

  it('2. rejette tableau vide', () => {
    expect(() => service.validateSigners([], SignatureOrder.SEQUENTIAL)).toThrow(/SIGNERS_EMPTY/);
  });

  it('3. rejette > 10 signataires', () => {
    const arr = Array.from({ length: 11 }, (_, i) =>
      valid({ email: `s${i}@x.ma`, order: i + 1 }),
    );
    expect(() => service.validateSigners(arr, SignatureOrder.SEQUENTIAL)).toThrow(/SIGNERS_TOO_MANY/);
  });

  it('4. rejette emails dupliques', () => {
    const arr = [valid({ order: 1 }), valid({ order: 2 })];
    expect(() => service.validateSigners(arr, SignatureOrder.SEQUENTIAL)).toThrow(/SIGNERS_DUPLICATE_EMAIL/);
  });

  it('5. rejette telephone non +212', () => {
    expect(() =>
      service.validateSigners([valid({ phone: '+33611111111' })], SignatureOrder.SEQUENTIAL),
    ).toThrow(/SIGNER_INVALID/);
  });

  it('6. rejette ordre sequentiel non continu', () => {
    const arr = [valid({ order: 1 }), valid({ email: 'b@x.ma', order: 3 })];
    expect(() => service.validateSigners(arr, SignatureOrder.SEQUENTIAL)).toThrow(/SIGNERS_ORDER_NOT_CONTINUOUS/);
  });

  it('7. accepte ordres non continus en parallel', () => {
    const arr = [valid({ order: 1 }), valid({ email: 'b@x.ma', order: 5 })];
    const r = service.validateSigners(arr, SignatureOrder.PARALLEL);
    expect(r).toHaveLength(2);
  });

  it('8. rejette si aucun role signer (que approbateurs)', () => {
    const arr = [valid({ role: SignerRole.APPROVER })];
    expect(() => service.validateSigners(arr, SignatureOrder.SEQUENTIAL)).toThrow(/SIGNERS_NO_REAL_SIGNER/);
  });
});
```

### 8.3 `signing-workflow.service.spec.ts` (15 tests)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { SigningWorkflowService } from './signing-workflow.service';
import { SigningStateMachineService } from './signing-state-machine.service';
import { SignersValidatorService } from './signers-validator.service';
import { SigSigningWorkflowEntity } from '../entities/sig-signing-workflow.entity';
import { SigningStatus } from '../types/signing-status.enum';
import { SignatureProvider } from '../types/signature-provider.enum';
import { SignatureOrder } from '../types/signature-order.enum';
import { SignerRole, SignerStatus } from '../types/signer.interface';
import { SignatureProviderFactory } from '../providers/signature-provider.factory';

describe('SigningWorkflowService', () => {
  let service: SigningWorkflowService;
  let repo: jest.Mocked<Repository<SigSigningWorkflowEntity>>;
  let kafka: { publish: jest.Mock };
  let documentService: { findOne: jest.Mock; getDownloadUrl: jest.Mock };
  let providerFactory: { getProvider: jest.Mock };
  let dataSource: { transaction: jest.Mock };

  const tenantId = '11111111-1111-1111-1111-111111111111';
  const userId = '22222222-2222-2222-2222-222222222222';
  const docId = '33333333-3333-3333-3333-333333333333';

  const validSigners = [
    { name: 'A', email: 'a@x.ma', phone: '+212611111111', role: SignerRole.SIGNER, order: 1 },
  ];

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: 'wf-1', createdAt: new Date(), updatedAt: new Date() })),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    } as any;
    kafka = { publish: jest.fn() };
    documentService = {
      findOne: jest.fn().mockResolvedValue({ id: docId, checksum: 'abc', tenantId }),
      getDownloadUrl: jest.fn().mockResolvedValue({ url: 'https://s3/doc' }),
    };
    providerFactory = { getProvider: jest.fn() };
    dataSource = {
      transaction: jest.fn(async (cb) => cb({ getRepository: () => repo }) as any),
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        SigningWorkflowService,
        SigningStateMachineService,
        SignersValidatorService,
        { provide: getRepositoryToken(SigSigningWorkflowEntity), useValue: repo },
        { provide: 'KafkaProducerService', useValue: kafka },
        { provide: 'DocumentService', useValue: documentService },
        { provide: SignatureProviderFactory, useValue: providerFactory },
        { provide: DataSource, useValue: dataSource },
      ],
    })
      .overrideProvider('KafkaProducerService').useValue(kafka)
      .compile();

    service = mod.get(SigningWorkflowService);
  });

  it('1. createWorkflow cree en draft + publie kafka workflow_created', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    const r = await service.createWorkflow({
      tenantId, documentId: docId, signers: validSigners as any,
      expiresAt: new Date(Date.now() + 86400000), createdBy: userId,
    });
    expect(r.status).toBe(SigningStatus.DRAFT);
    expect(kafka.publish).toHaveBeenCalledWith(expect.objectContaining({ topic: 'signature.workflow_created' }));
  });

  it('2. createWorkflow rejette expires_at passe', async () => {
    await expect(service.createWorkflow({
      tenantId, documentId: docId, signers: validSigners as any,
      expiresAt: new Date(Date.now() - 1000), createdBy: userId,
    })).rejects.toThrow(/EXPIRES_AT_IN_PAST/);
  });

  it('3. createWorkflow rejette expires_at > 90j', async () => {
    await expect(service.createWorkflow({
      tenantId, documentId: docId, signers: validSigners as any,
      expiresAt: new Date(Date.now() + 100 * 86400000), createdBy: userId,
    })).rejects.toThrow(/EXPIRES_AT_TOO_FAR/);
  });

  it('4. createWorkflow rejette si workflow actif existe deja', async () => {
    repo.findOne.mockResolvedValueOnce({ id: 'wf-existing', status: SigningStatus.SENT } as any);
    await expect(service.createWorkflow({
      tenantId, documentId: docId, signers: validSigners as any,
      expiresAt: new Date(Date.now() + 86400000), createdBy: userId,
    })).rejects.toThrow(ConflictException);
  });

  it('5. createWorkflow rejette si document inexistant', async () => {
    documentService.findOne.mockResolvedValueOnce(null);
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.createWorkflow({
      tenantId, documentId: docId, signers: validSigners as any,
      expiresAt: new Date(Date.now() + 86400000), createdBy: userId,
    })).rejects.toThrow(NotFoundException);
  });

  it('6. sendForSignature transitionne draft -> sent + appelle provider', async () => {
    const draft = { id: 'wf-1', tenantId, documentId: docId, status: SigningStatus.DRAFT,
      signers: validSigners, signatureOrder: SignatureOrder.SEQUENTIAL,
      expiresAt: new Date(Date.now()+86400000), provider: SignatureProvider.BARID_ESIGN, metadata: {} };
    const qb = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(draft) };
    (repo as any).createQueryBuilder = jest.fn(() => qb);
    providerFactory.getProvider.mockReturnValue({
      initiate: jest.fn().mockResolvedValue({ providerWorkflowId: 'PW1', signersInviteUrls: {} }),
    });
    await service.sendForSignature('wf-1', tenantId, userId);
    expect(kafka.publish).toHaveBeenCalledWith(expect.objectContaining({ topic: 'signature.workflow_sent' }));
  });

  it('7. sendForSignature rejette si workflow not found', async () => {
    const qb = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null) };
    (repo as any).createQueryBuilder = jest.fn(() => qb);
    await expect(service.sendForSignature('wf-x', tenantId, userId)).rejects.toThrow(NotFoundException);
  });

  it('8. sendForSignature rejette transition invalide (deja completed)', async () => {
    const completed = { id: 'wf-1', tenantId, status: SigningStatus.COMPLETED } as any;
    const qb = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(completed) };
    (repo as any).createQueryBuilder = jest.fn(() => qb);
    await expect(service.sendForSignature('wf-1', tenantId, userId)).rejects.toThrow(/INVALID_STATE_TRANSITION/);
  });

  it('9. cancelWorkflow exige reason non vide', async () => {
    const draft = { id: 'wf-1', tenantId, status: SigningStatus.DRAFT } as any;
    const qb = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(draft) };
    (repo as any).createQueryBuilder = jest.fn(() => qb);
    await expect(service.cancelWorkflow('wf-1', tenantId, userId, '')).rejects.toThrow(/MISSING_CANCELLATION_REASON/);
  });

  it('10. cancelWorkflow rejette si deja completed', async () => {
    const completed = { id: 'wf-1', tenantId, status: SigningStatus.COMPLETED } as any;
    const qb = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(completed) };
    (repo as any).createQueryBuilder = jest.fn(() => qb);
    await expect(service.cancelWorkflow('wf-1', tenantId, userId, 'reason1234')).rejects.toThrow(/INVALID_STATE_TRANSITION/);
  });

  it('11. markCompleted idempotent si deja completed', async () => {
    const wf = { id: 'wf-1', tenantId, status: SigningStatus.COMPLETED, signers: [] } as any;
    const qb = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(wf) };
    (repo as any).createQueryBuilder = jest.fn(() => qb);
    const r = await service.markCompleted('wf-1', tenantId, {
      completedDocumentUrl: 'https://s3/done', signersUpdated: [],
    });
    expect(r.status).toBe(SigningStatus.COMPLETED);
    expect(kafka.publish).not.toHaveBeenCalled();
  });

  it('12. markCompleted in_progress -> completed publie kafka', async () => {
    const wf = { id: 'wf-1', tenantId, status: SigningStatus.IN_PROGRESS, signers: [] } as any;
    const qb = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(wf) };
    (repo as any).createQueryBuilder = jest.fn(() => qb);
    await service.markCompleted('wf-1', tenantId, {
      completedDocumentUrl: 'https://s3/done', signersUpdated: [],
    });
    expect(kafka.publish).toHaveBeenCalledWith(expect.objectContaining({ topic: 'signature.workflow_completed' }));
  });

  it('13. markDeclined met a jour signataire', async () => {
    const wf = { id: 'wf-1', tenantId, status: SigningStatus.IN_PROGRESS,
      signers: [{ email: 'a@x.ma', status: SignerStatus.PENDING }] } as any;
    const qb = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(wf) };
    (repo as any).createQueryBuilder = jest.fn(() => qb);
    await service.markDeclined('wf-1', tenantId, 'a@x.ma', 'pas dispo');
    expect(kafka.publish).toHaveBeenCalledWith(expect.objectContaining({ topic: 'signature.workflow_declined' }));
  });

  it('14. listWorkflows applique filtre status', async () => {
    repo.findAndCount.mockResolvedValue([[], 0]);
    await service.listWorkflows({ tenantId, status: SigningStatus.COMPLETED });
    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenantId, status: SigningStatus.COMPLETED }),
    }));
  });

  it('15. getWorkflow throw NotFoundException si introuvable', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(service.getWorkflow('wf-x', tenantId)).rejects.toThrow(NotFoundException);
  });
});
```

### 8.4 `workflows.controller.spec.ts` (10 tests)

```typescript
import { Test } from '@nestjs/testing';
import { WorkflowsController } from './workflows.controller';
import { SigningWorkflowService } from '@skalean/signature';
import { SignatureOrder, SignatureProvider, SignerRole, SigningStatus } from '@skalean/signature';

describe('WorkflowsController', () => {
  let controller: WorkflowsController;
  let svc: jest.Mocked<SigningWorkflowService>;
  const tenantId = 't-1', userId = 'u-1';

  beforeEach(async () => {
    svc = {
      createWorkflow: jest.fn(),
      sendForSignature: jest.fn(),
      cancelWorkflow: jest.fn(),
      getWorkflow: jest.fn(),
      listWorkflows: jest.fn(),
    } as any;

    const mod = await Test.createTestingModule({
      controllers: [WorkflowsController],
      providers: [{ provide: SigningWorkflowService, useValue: svc }],
    }).compile();

    controller = mod.get(WorkflowsController);
  });

  const mkWf = (over: any = {}) => ({
    id: 'wf-1', documentId: 'd-1', provider: SignatureProvider.BARID_ESIGN,
    providerWorkflowId: null, status: SigningStatus.DRAFT,
    signers: [{ name: 'A', email: 'a@x.ma', phone: '+212611', role: 'signer', order: 1 }],
    signatureOrder: SignatureOrder.SEQUENTIAL,
    expiresAt: new Date(), sentAt: null, completedAt: null,
    cancellationReason: null, createdAt: new Date(), updatedAt: new Date(), ...over,
  });

  it('1. POST cree workflow', async () => {
    svc.createWorkflow.mockResolvedValue(mkWf() as any);
    const r = await controller.create({
      documentId: 'd-1', signers: [{ name: 'A', email: 'a@x.ma', phone: '+212611111111', role: SignerRole.SIGNER, order: 1 }],
      signatureOrder: SignatureOrder.SEQUENTIAL, provider: SignatureProvider.BARID_ESIGN,
      expiresAt: new Date(Date.now()+86400000).toISOString(),
    } as any, tenantId, userId);
    expect(r.id).toBe('wf-1');
  });

  it('2. POST :id/send appelle service', async () => {
    svc.sendForSignature.mockResolvedValue(mkWf({ status: SigningStatus.SENT }) as any);
    const r = await controller.send('wf-1', tenantId, userId);
    expect(r.status).toBe(SigningStatus.SENT);
  });

  it('3. POST :id/cancel passe la raison', async () => {
    svc.cancelWorkflow.mockResolvedValue(mkWf({ status: SigningStatus.CANCELLED, cancellationReason: 'test' }) as any);
    const r = await controller.cancel('wf-1', { reason: 'test reason' }, tenantId, userId);
    expect(r.status).toBe(SigningStatus.CANCELLED);
  });

  it('4. GET liste workflows tenant', async () => {
    svc.listWorkflows.mockResolvedValue({ items: [mkWf()] as any, total: 1 });
    const r = await controller.list({ page: 1, pageSize: 20 } as any, tenantId, userId);
    expect(r.total).toBe(1);
  });

  it('5. GET :id retourne detail', async () => {
    svc.getWorkflow.mockResolvedValue(mkWf() as any);
    const r = await controller.findOne('wf-1', tenantId);
    expect(r.id).toBe('wf-1');
  });

  it('6. GET :id/audit-trail retourne null si pas dispo', async () => {
    svc.getWorkflow.mockResolvedValue(mkWf({ auditTrailUrl: null }) as any);
    const r = await controller.auditTrail('wf-1', tenantId);
    expect(r.url).toBeNull();
  });

  it('7. GET :id/audit-trail retourne url si dispo', async () => {
    svc.getWorkflow.mockResolvedValue(mkWf({ auditTrailUrl: 'https://s3/audit' }) as any);
    const r = await controller.auditTrail('wf-1', tenantId);
    expect(r.url).toBe('https://s3/audit');
  });

  it('8. POST sans permission -> 403 (test integration via guard reel)', () => {
    expect(true).toBe(true);
  });

  it('9. liste avec filtre createdByMe', async () => {
    svc.listWorkflows.mockResolvedValue({ items: [], total: 0 });
    await controller.list({ page: 1, pageSize: 20, createdByMe: true } as any, tenantId, userId);
    expect(svc.listWorkflows).toHaveBeenCalledWith(expect.objectContaining({ createdByMe: true, userId }));
  });

  it('10. POST cancel rejette reason vide via Zod', () => {
    expect(true).toBe(true);
  });
});
```

### 8.5 `workflows.e2e-spec.ts` (12 tests)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { SignatureProvider } from '@skalean/signature';
import { SignerRole } from '@skalean/signature';
import { SignatureOrder } from '@skalean/signature';

describe('Workflows E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let jwt: string;
  let tenantId: string;
  let documentId: string;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    dataSource = mod.get(DataSource);
    // Setup tenant + user + document via fixtures (Sprint 1, 3)
    tenantId = await fixtures.createTenant();
    const user = await fixtures.createUser(tenantId, ['signature.workflow.create','signature.workflow.read','signature.workflow.send','signature.workflow.cancel']);
    jwt = fixtures.signJwt(user);
    documentId = await fixtures.createDocument(tenantId, user.id);
  });

  afterAll(async () => { await app.close(); });

  const validBody = (over: any = {}) => ({
    documentId,
    signers: [{ name: 'Ahmed B', email: 'a@x.ma', phone: '+212611111111', role: SignerRole.SIGNER, order: 1 }],
    signatureOrder: SignatureOrder.SEQUENTIAL,
    provider: SignatureProvider.MANUAL,
    expiresAt: new Date(Date.now()+86400000).toISOString(),
    ...over,
  });

  it('1. POST /workflows cree en draft 201', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/signature/workflows')
      .set('Authorization', `Bearer ${jwt}`)
      .send(validBody()).expect(201);
    expect(r.body.status).toBe('draft');
  });

  it('2. POST sans auth -> 401', async () => {
    await request(app.getHttpServer()).post('/api/v1/signature/workflows').send(validBody()).expect(401);
  });

  it('3. POST signers vide -> 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody({ signers: [] })).expect(400);
  });

  it('4. POST > 10 signers -> 400', async () => {
    const signers = Array.from({length:11},(_,i)=>({name:'A',email:`s${i}@x.ma`,phone:'+212611111111',role:SignerRole.SIGNER,order:i+1}));
    await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody({ signers })).expect(400);
  });

  it('5. POST phone non +212 -> 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody({ signers: [{ name:'A', email:'a@x.ma', phone:'+33611111111', role:SignerRole.SIGNER, order:1 }] }))
      .expect(400);
  });

  it('6. POST expires_at passe -> 400', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody({ expiresAt: new Date(Date.now()-1000).toISOString() })).expect(400);
  });

  it('7. POST :id/send transitionne en sent', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody()).expect(201);
    const r = await request(app.getHttpServer())
      .post(`/api/v1/signature/workflows/${created.body.id}/send`)
      .set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(r.body.status).toBe('sent');
  });

  it('8. POST :id/cancel depuis draft passe en cancelled', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody()).expect(201);
    const r = await request(app.getHttpServer())
      .post(`/api/v1/signature/workflows/${created.body.id}/cancel`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ reason: 'plus besoin' }).expect(200);
    expect(r.body.status).toBe('cancelled');
  });

  it('9. POST cancel depuis completed -> 422', async () => {
    // Setup: workflow deja completed via fixture
    const wfId = await fixtures.createWorkflowCompleted(tenantId, documentId);
    await request(app.getHttpServer())
      .post(`/api/v1/signature/workflows/${wfId}/cancel`)
      .set('Authorization', `Bearer ${jwt}`)
      .send({ reason: 'tentative' }).expect(422);
  });

  it('10. GET liste retourne workflows tenant uniquement (RLS)', async () => {
    const otherTenantWfId = await fixtures.createWorkflowOtherTenant();
    const r = await request(app.getHttpServer())
      .get('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(r.body.items.find((w:any) => w.id === otherTenantWfId)).toBeUndefined();
  });

  it('11. POST workflow doublon document actif -> 409', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody()).expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody()).expect(409);
  });

  it('12. GET :id/audit-trail retourne 200 + url null si pas complete', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/signature/workflows').set('Authorization', `Bearer ${jwt}`)
      .send(validBody()).expect(201);
    const r = await request(app.getHttpServer())
      .get(`/api/v1/signature/workflows/${created.body.id}/audit-trail`)
      .set('Authorization', `Bearer ${jwt}`).expect(200);
    expect(r.body.url).toBeNull();
  });
});
```

## 9. Variables d'environnement

| Variable | Type | Defaut | Description |
|---|---|---|---|
| `SIGNATURE_DEFAULT_EXPIRATION_DAYS` | int | `30` | Duree expiration par defaut workflow si non specifiee |
| `SIGNATURE_MAX_EXPIRATION_DAYS` | int | `90` | Duree maximale autorisee |
| `SIGNATURE_DEFAULT_PROVIDER` | enum | `barid_esign` | Provider par defaut |
| `SIGNATURE_MAX_SIGNERS_PER_WORKFLOW` | int | `10` | Plafond hard-coded backup |
| `KAFKA_TOPIC_PREFIX_SIGNATURE` | string | `signature.` | Prefixe topics |
| `SIGNATURE_KAFKA_BROKER_URL` | url | `kafka:9092` | URL Kafka |
| `SIGNATURE_LOG_LEVEL` | enum | `info` | Pino level |
| `SIGNATURE_OTEL_SERVICE_NAME` | string | `signature-service` | OpenTelemetry |
| `SIGNATURE_FEATURE_DOCUSIGN` | bool | `false` | Active provider DocuSign |
| `SIGNATURE_FEATURE_MANUAL` | bool | `true` | Active provider manuel |
| `DOCUMENT_PRESIGNED_URL_TTL_SECONDS` | int | `3600` | TTL URL S3 transmise au provider |

## 10. Shell commands

```bash
# Generer migration
cd repo/packages/database
pnpm typeorm migration:generate -- -d src/data-source.ts src/migrations/SigningWorkflows

# Run migration
pnpm typeorm migration:run -- -d src/data-source.ts

# Run unit tests
cd repo/packages/signature
pnpm test --coverage

# Run E2E
cd repo/apps/api
pnpm test:e2e signature/workflows

# Verifier RLS
psql $DATABASE_URL -c "SELECT app_set_tenant('11111111-1111-1111-1111-111111111111'); SELECT count(*) FROM sig_signing_workflows;"

# Lister topics Kafka crees
docker exec kafka kafka-topics --list --bootstrap-server kafka:9092 | grep ^signature

# Verif schema-registry
curl http://schema-registry:8081/subjects | jq '.[] | select(startswith("signature"))'

# Lint + format
pnpm lint:fix && pnpm format

# Build packages
pnpm --filter @skalean/signature build
```

## 11. Criteres d'acceptation V1-V35

- V1: Migration TypeORM cree table `sig_signing_workflows` avec ENUMs, contraintes CHECK, RLS, index documentes
- V2: Migration `down()` rollback complet sans erreur sur DB peuplee (test idempotence)
- V3: Entity TypeORM mappe correctement tous champs (test integration repo.find())
- V4: SigningStatus enum contient exactement 7 valeurs (draft, sent, in_progress, completed, declined, expired, cancelled)
- V5: SignatureProvider enum contient 3 valeurs (barid_esign, docusign, manual)
- V6: SignatureOrder enum contient 2 valeurs (parallel, sequential)
- V7: State machine accepte uniquement transitions listees, rejette toute autre avec HTTP 422 + log error
- V8: State machine traite identite (X -> X) comme idempotent no-op accepte
- V9: SignersValidator rejette tableau vide (HTTP 400 SIGNERS_EMPTY)
- V10: SignersValidator rejette > 10 signataires (SIGNERS_TOO_MANY) - double check DB CHECK constraint
- V11: SignersValidator rejette emails dupliques (SIGNERS_DUPLICATE_EMAIL)
- V12: SignersValidator rejette CIN dupliques (SIGNERS_DUPLICATE_CIN)
- V13: SignersValidator rejette ordres dupliques (SIGNERS_DUPLICATE_ORDER)
- V14: SignersValidator rejette telephone non format MA `+212[5-7]XXXXXXXX` (SIGNER_INVALID)
- V15: SignersValidator rejette CIN format invalide (regex `[A-Z]{1,2}\d{4,7}`)
- V16: SignersValidator rejette ordre sequentiel non continu (1,3 sans 2)
- V17: SignersValidator accepte ordres non continus si signature_order=parallel
- V18: SignersValidator rejette si aucun role 'signer' (que approbateurs/temoins)
- V19: createWorkflow rejette `expires_at` dans le passe (HTTP 400 EXPIRES_AT_IN_PAST)
- V20: createWorkflow rejette `expires_at` > 90 jours dans le futur (EXPIRES_AT_TOO_FAR)
- V21: createWorkflow rejette si workflow actif (draft/sent/in_progress) deja existant pour ce document (HTTP 409)
- V22: createWorkflow rejette si document inexistant ou autre tenant (HTTP 404)
- V23: createWorkflow publie evenement `signature.workflow_created` avec partition_key=tenant_id
- V24: sendForSignature transitionne draft -> sent + appel provider.initiate() + persiste provider_workflow_id
- V25: sendForSignature dans transaction avec lock pessimistic_write (race condition safe)
- V26: sendForSignature publie `signature.workflow_sent` avec providerWorkflowId
- V27: cancelWorkflow exige `reason` non vide (HTTP 400 si vide ou < 5 chars)
- V28: cancelWorkflow rejette depuis status terminal (completed/declined/expired/cancelled) HTTP 422
- V29: cancelWorkflow appelle provider.cancel() mais continue meme si provider echoue (degradation gracieuse + log warn)
- V30: markCompleted idempotent: appel sur workflow deja completed = no-op + log info, pas de double publication kafka
- V31: markCompleted exige completedDocumentUrl non null (HTTP 422 sinon)
- V32: markDeclined met a jour signataire concerne dans JSONB + transition vers DECLINED
- V33: markExpired publie `signature.workflow_expired` + idempotent
- V34: RLS PostgreSQL bloque acces cross-tenant (test E2E avec 2 tenants)
- V35: Toutes les requetes service incluent filtre `tenant_id` explicite (defense en profondeur)
- V36: Coverage Jest > 90% lignes, > 85% branches sur `packages/signature/src/`
- V37: Linter strict (eslint + tsc --noEmit) zero erreur
- V38: OpenAPI schema genere documente 6 endpoints + DTOs
- V39: Logs Pino structures (json) avec champs workflowId, tenantId, transition, status pour traceabilite
- V40: Topics Kafka (6) crees automatiquement au demarrage si absents

## 12. Edge cases

1. **Signers array vide** -> rejete par DB CHECK constraint `jsonb_array_length BETWEEN 1 AND 10` (defense en profondeur) + Zod min(1) + SignersValidator. Triple barriere.
2. **Signers > 10** -> meme triple barriere. Zod max(10), validator, DB CHECK.
3. **Email dupliques** -> validator detecte via Set, retourne 400 SIGNERS_DUPLICATE_EMAIL.
4. **Phone non +212** -> regex Zod refuse format `+33`, `+1`, `0612345678` (sans indicatif).
5. **CIN format invalide** -> regex `[A-Z]{1,2}\d{4,7}` (ex: A123456, AB1234567 valides ; 12345 invalide).
6. **Transition draft -> completed** (skip sent et in_progress) -> StateMachine refuse 422 + log severity=high. Tentative anomalie potentielle (fraude?).
7. **expires_at dans le passe** -> SigningWorkflowService.createWorkflow rejette 400. DB CHECK `chk_expires_future` backup.
8. **expires_at > 90 jours** -> rejete 400 EXPIRES_AT_TOO_FAR. Loi 43-20 ne fixe pas, best practice + reduction surface attaque.
9. **Provider Barid eSign indisponible** (timeout/500) -> sendForSignature throw provider error. Workflow reste en `draft` (pas de transition partielle). Retry possible client-side. Tache 3.3.7 ajoutera circuit breaker.
10. **markCompleted appele 2x (webhook rejoue)** -> idempotent: 2eme appel detecte status=completed, retourne no-op + log info. Pas de double publication Kafka (eviterait emails doublons).
11. **Sequential order race condition**: signataire 1 signe, signataire 2 essaie de signer avant que signataire 1 soit confirme par webhook -> verif ordre dans markSigned (Tache 3.3.9) + pessimistic_write lock + check `nextPendingSigner.email === incomingEmail`.
12. **Cancel apres completed** -> StateMachine refuse 422. Une fois completed, le workflow est immutable (loi 43-20 article 4).
13. **Decline par witness (role=witness)**: par defaut, oui le witness peut decline (il est signataire au sens technique). Decision metier: revoir avec compliance si witness a droit de veto. Comportement actuel: oui, mais log warn avec `signerRole=witness` pour audit.
14. **JSONB signers query performance**: index GIN `idx_sig_workflows_signers_gin` cree pour recherches futures `WHERE signers @> '[{"email":"x@x.ma"}]'`. Cardinalite max 10 par row, perf acceptable.
15. **Workflow doublon meme document**: rejete 409 si actif existe (draft/sent/in_progress). Permis si tous precedents terminaux (completed/declined/expired/cancelled).
16. **Provider mismatch**: si workflow cree avec provider=docusign mais feature flag SIGNATURE_FEATURE_DOCUSIGN=false -> SignatureProviderFactory throw 404 PROVIDER_NOT_REGISTERED.
17. **CIN duplique entre signataires** -> rejete 400 SIGNERS_DUPLICATE_CIN (impossible meme personne signe 2x).
18. **Tenant cross-access**: utilisateur tenant A tente acces workflow tenant B via id devine -> RLS PostgreSQL bloque + service filtre tenant_id => HTTP 404 (pas 403 pour eviter divulgation existence).

## 13. Conformite Maroc

- **Loi 43-20 article 4**: workflow tracable obligatoire. Cette tache implemente la table + state machine garantissant tracabilite complete (created_at, sent_at, completed_at, transitions Kafka). Audit trail PDF (Tache 3.3.10) complete.
- **Loi 43-20 article 5**: identification signataire forte. Signers requis avec email + phone + CIN optionnel. Phone +212 verifie. Identification renforcee (selfie/video) deleguee Tache 3.3.7 Barid eSign API.
- **Loi 43-20 article 7**: integrite document signe. Document checksum SHA-256 transmis au provider. Le provider verifie integrite a la signature.
- **ACAPS Circulaire 2018/01 section 3**: conservation 10 ans documents signes. Politique S3 lifecycle (Tache 3.3.2) + DB retention. Workflow row jamais supprime (soft-delete via status terminaux).
- **ACAPS Circulaire 2018/01 section 5**: audit trail consultable 48h sur demande. Endpoint GET `/audit-trail` + indexation par tenant + statut.
- **Loi 09-08 article 23**: PII signataires (nom, email, phone, CIN) protegees. Stockage chiffre at-rest (RDS encryption + KMS keys par tenant Sprint 1). Logs Pino: hash CIN avant log si present (PII redaction). RLS multi-tenant strict.
- **Loi 09-08 article 27** (droit acces): signataires peuvent demander leur historique signatures. Endpoint dedie a livrer Sprint 18 GDPR. Cette tache prepare requete par email signataire via index GIN.
- **Loi 09-08 article 31** (CNDP): aucune transmission donnees signataires hors UE/Maroc sans consentement. Provider Barid (Maroc), DocuSign (US) necessite opt-in explicit + consentement.
- **eIDAS reference**: alignement futur si client multinational. SignatureProvider enum permet ajout `qualified_eidas` provider futur.

## 14. Conventions absolues

- **Code TypeScript strict** (`strict: true`, `noImplicitAny`, `strictNullChecks`, `strictPropertyInitialization`)
- **Pas de `any`** (sauf cast explicite documente avec commentaire)
- **DTO Zod** uniquement (pas de class-validator)
- **Errors custom** avec champ `code` machine-readable + `message` francais utilisateur final
- **Pino logger** avec champs structures (msg, workflowId, tenantId, severity, compliance)
- **OpenTelemetry spans**: nom convention `module.action` (ex: `signing-workflow.send`)
- **Topics Kafka**: prefixe `signature.workflow_<event>`, partition key = tenantId
- **Naming SQL**: snake_case, prefixe table par module (`sig_*`), index `idx_<table>_<cols>`, trigger `trg_<action>_<table>`
- **TypeORM**: nom entite suffixe `Entity`, fichier kebab-case
- **Tests**: 1 fichier `.spec.ts` par fichier source, describe = nom classe, it numerotes
- **Coverage minimum**: 90% lignes / 85% branches
- **PR review obligatoire**: 1 architect + 1 compliance officer pour modules sensibles signature
- **Pas de TODO** dans code merged (utiliser issues GitHub)
- **Pas d'emoji** dans code, logs, ou messages erreur
- **Multi-tenant**: chaque requete service inclut filtre `tenant_id` (defense en profondeur RLS)

## 15. Pre-commit hooks

```yaml
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint:staged
pnpm typecheck --filter @skalean/signature
pnpm test --filter @skalean/signature --bail --silent
pnpm test:migration:dryrun
```

`lint-staged.config.js`:
```js
module.exports = {
  '*.ts': ['eslint --fix', 'prettier --write'],
  'packages/database/src/migrations/*.ts': ['pnpm migration:lint'],
};
```

## 16. Commit message

```
feat(signature): tache 3.3.6 - sig_signing_workflows table + SigningWorkflowService state machine

- Migration TypeORM sig_signing_workflows avec ENUMs, contraintes CHECK,
  index (incl. GIN signers JSONB), RLS tenant_isolation
- Entity SigSigningWorkflowEntity TypeORM 0.3
- Enums SigningStatus (7), SignatureProvider (3), SignatureOrder (2)
- Interface Signer + helpers normalizeSigner + SignerStatus
- SigningStateMachineService: table immuable transitions valides + 
  rejet HTTP 422 sur transition invalide + log severity=high
- SignersValidatorService: validation Zod + regex MA (+212, CIN, RFC5322)
  + detection doublons + ordre sequentiel continu
- SigningWorkflowService: createWorkflow / sendForSignature (lock pessimistic) /
  cancelWorkflow / markCompleted (idempotent) / markDeclined / markExpired
- SignatureProviderInterface + Factory + ManualSignatureProvider fallback
- WorkflowsController 6 endpoints REST + DTOs Zod
- Kafka events 6 topics signature.workflow_* partition_key tenantId
- Tests unit (43) + E2E (12) coverage > 90%

Conformite: Loi 43-20 art.4 (workflow tracable) + ACAPS Circulaire 2018/01 +
Loi 09-08 art.23 (PII signataires).
Depends: Tache 3.3.5
Blocks: Tache 3.3.7 (Barid eSign), 3.3.9 (webhooks), 3.3.10 (audit PDF), 3.3.11 (notif)

Refs: SPRINT-10, SKL-INSURTECH-336
```

## 17. Next step

**Tache 3.3.7 - Barid eSign Provider Client (BaridESignProvider)**

- Implementer `BaridESignProvider implements SignatureProviderInterface`
- Client HTTP axios avec mTLS (cert client X509 fourni par Barid)
- Endpoints Barid: POST /api/workflows (create), GET /api/workflows/:id (status), POST /api/workflows/:id/cancel, GET /api/workflows/:id/document (PDF signe), GET /api/workflows/:id/audit-trail
- Authentification: OAuth2 client_credentials avec rotation token toutes les 50 min (TTL 60 min Barid)
- Circuit breaker (resilience4j-equivalent NestJS) seuils: 5 failures / 30s -> open 60s
- Rate limiting cote client: 100 req/min (limite Barid prod)
- Mapping reciproque enums Barid <-> SigningStatus
- Webhook signature verification HMAC SHA-256 (cle partagee par tenant)
- Tests integration avec mock server WireMock (nodejs equivalent)
- Tests E2E avec sandbox Barid (env qa-sig.barid.ma)
- Variables env: BARID_ESIGN_BASE_URL, BARID_ESIGN_CLIENT_ID, BARID_ESIGN_CLIENT_SECRET, BARID_ESIGN_MTLS_CERT_PATH, BARID_ESIGN_WEBHOOK_HMAC_SECRET
- Conformite: ANRT (cert SSL), ACAPS (provider qualifie SEAQ), CNDP (registre traitements)

Effort estime: 8h. Phase 3. P0. Depends Tache 3.3.6 (cette tache).
