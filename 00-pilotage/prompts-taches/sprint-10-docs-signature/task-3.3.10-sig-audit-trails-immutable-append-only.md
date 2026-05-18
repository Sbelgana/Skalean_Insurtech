# Tache 3.3.10 - sig_audit_trails Immutable Append-Only + Hash Chain + PDF Audit Trail Juridique

## 1. Header metadata

| Champ | Valeur |
|---|---|
| Sprint | 10 (cumul) / 35 |
| Phase | 3 - Modules Horizontaux |
| Sprint dans phase | 3 |
| Reference backlog | B-10 |
| Tache | 3.3.10 |
| Priorite | P0 (bloquant compliance loi 43-20) |
| Effort estime | 4h |
| Depends on | Tache 3.3.9 (sig_archives WORM Object Lock + retention 10 ans) |
| Bloque | Tache 3.3.11 (sig_consents tracabilite consentement) |
| Densite cible | 120-150 KB |
| Owner | equipe Signature + Backend |
| Reviewers | Tech Lead + DPO + Compliance Officer |
| Statut | A faire |
| Conformite | Loi 43-20 art. 9, ACAPS 2018/01 art. 9, CNDP Loi 09-08 art. 13, ETSI EN 319 122, Code procedure civile MA art. 417-4 |

## 2. But

L'objectif de cette tache est de doter la plateforme Skalean Insurtech d'un mecanisme d'audit trail
**immuable, infalsifiable et opposable juridiquement** pour l'ensemble du cycle de vie des signatures
electroniques realisees dans le cadre de la loi marocaine 43-20 sur la confiance numerique. Tout
evenement (creation workflow, envoi document, visualisation, authentification, signature, refus,
expiration, horodatage TSA, scellement archive, generation audit trail) est consigne dans la table
`sig_audit_trails` qui est rendue **append-only au niveau de la base de donnees** via des policies
PostgreSQL Row Level Security (RLS) qui interdisent toute operation `UPDATE` ou `DELETE`,
independamment des permissions applicatives. Cette interdiction physique est complementee par un
mecanisme de **hash chain SHA-512** (chaque entree contient le hash de l'entree precedente) qui
permet de detecter de maniere cryptographique toute tentative de modification ulterieure, meme par
un administrateur SUPERUSER ou par une intrusion compromettant la base.

En complement de la table append-only, le service `AuditTrailService` orchestre la generation d'un
**document PDF d'audit trail** structure (utilisant le `PdfGeneratorService` developpe en
Tache 3.3.5) qui agrege la timeline complete des evenements, l'identite des signataires, leurs
adresses IP, leur geolocalisation, les jetons d'horodatage TSA appliques et le statut d'integrite
de la chaine de hash. Ce PDF constitue la **preuve numerique opposable au sens de l'article 9 de
la loi 43-20 et de l'article 417-4 du Code de procedure civile marocain**, ce qui est exigible en
cas de contestation devant un tribunal de commerce de Casablanca, Rabat ou Marrakech. Sans ce
mecanisme, la plateforme serait juridiquement incapable de defendre la validite d'une signature
electronique, ce qui exposerait le tenant assureur a des dommages-interets considerables (un
sinistre RC Auto conteste peut depasser 5 MMAD).

Enfin, ce mecanisme satisfait simultanement quatre exigences reglementaires distinctes :
(a) ACAPS Circulaire 2018/01 article 9 qui impose la tracabilite obligatoire des signatures pour
les contrats d'assurance (b) CNDP Loi 09-08 article 13 qui exige l'integrite des journaux d'audit
contenant des donnees personnelles (c) ETSI EN 319 122 qui definit le format CAdES Long Term
Validation requis pour la valeur probante longue duree (d) la conservation 10 ans imposee par
l'article 11 de la loi 43-20 et par decision-009 du registre des decisions architecturales.

## 3. Contexte etendu

### 3.1 Pourquoi append-only au niveau base de donnees et non au niveau applicatif

Une approche naive consisterait a refuser les `UPDATE` et `DELETE` au niveau du code applicatif
(par exemple en n'exposant pas de methode `update()` ou `delete()` sur le repository TypeORM).
Cette approche est **fondamentalement insuffisante** pour trois raisons.

Premierement, un developpeur peut ulterieurement ajouter par erreur ou par malveillance une
methode `update()` ou utiliser un `QueryBuilder` brut qui contournera la restriction. Le risque
d'erreur humaine est non negligeable sur un code base de 35 sprints. Deuxiemement, un attaquant
qui obtient un acces SQL direct (via SQL injection, via fuite de credentials, via compromission
d'un container backend) peut executer `DELETE FROM sig_audit_trails` et effacer toute trace de
sa fraude. Cette attaque est exactement celle que la loi 43-20 cherche a prevenir : la falsification
posteriori d'une signature electronique. Troisiemement, en cas d'audit ACAPS ou CNDP, l'auditeur
demande une **demonstration technique** que les logs ne peuvent pas etre modifies. Une simple
documentation indiquant "le code applicatif n'expose pas update()" n'est pas une demonstration
technique acceptable - l'auditeur exige une preuve au niveau du moteur de stockage.

L'approche correcte combine **trois couches de defense** : (1) RLS PostgreSQL avec policies
explicites `FOR SELECT` et `FOR INSERT` mais **aucune** policy `FOR UPDATE` ou `FOR DELETE` -
en RLS, l'absence de policy equivaut a un refus implicite (2) `REVOKE UPDATE, DELETE ON
sig_audit_trails FROM PUBLIC` qui retire les droits SQL de base meme pour les roles qui auraient
contourne RLS (3) le hash chain qui rend toute modification cryptographiquement detectable, meme
si un attaquant compromet le superuser PostgreSQL.

### 3.2 Pourquoi hash chain SHA-512 plutot que signature externe

Une alternative au hash chain serait de signer chaque entree d'audit avec une cle privee gardee
dans un HSM externe (par exemple Barid eSign HSM). Cette approche serait plus forte
cryptographiquement mais induit une **dependance reseau a chaque INSERT** (latence ~200ms au lieu
de ~5ms) et un cout HSM par operation. Pour une plateforme qui peut generer 50 evenements par
signature et 10000 signatures par mois (tenant moyen), cela represente 500000 appels HSM par
mois soit ~7500 MAD/mois par tenant - prohibitif.

Le hash chain SHA-512 offre un compromis acceptable : chaque entree contient le hash de la
precedente, formant une chaine cryptographique de type Merkle simplifiee. Pour falsifier une
entree intermediaire, un attaquant devrait recalculer toutes les entrees suivantes ET avoir
l'autorisation d'ecriture. Comme l'autorisation d'ecriture est deja bloquee par RLS et REVOKE,
le hash chain agit comme **filet de securite supplementaire** : si malgre tout un attaquant
obtient l'acces ecriture (par exemple en compromettant le superuser), une simple verification
post-mortem de la chaine detectera l'anomalie. La verification est realisee par
`AuditHashChainService.verifyChain(workflowId)` qui est exposee via un endpoint REST
`GET /audit-trail/verify` accessible aux auditeurs ACAPS.

### 3.3 Pourquoi generer un PDF d'audit trail et non se contenter du JSON

La loi 43-20 article 9 exige que la preuve numerique soit produite "sous une forme intelligible
permettant sa restitution". L'article 417-4 du Code de procedure civile precise que cette forme
doit etre "lisible et conservee de maniere a pouvoir etre presentee au juge". Un fichier JSON
brut, bien que techniquement valide, n'est pas considere comme une forme intelligible par les
magistrats marocains, qui attendent un document de type rapport. Le PDF constitue le format
universel de preuve juridique : il peut etre imprime, signe par un huissier de justice (constat),
joint a un dossier de plaidoirie, ou produit a l'audience.

De plus, le PDF d'audit trail est lui-meme **horodate par TSA Barid eSign et signe** par le
service via la chaine PdfGeneratorService -> SignatureWorkflowService -> TsaService, ce qui
confere au document d'audit trail la meme valeur probante que les contrats originaux. Cette
double signature (le contrat ET son audit trail) constitue le standard ETSI EN 319 122 pour la
validation longue duree (Long Term Validation).

### 3.4 Trade-off RLS no-policy versus trigger BEFORE UPDATE/DELETE

| Approche | Avantages | Inconvenients | Choix |
|---|---|---|---|
| RLS sans policy UPDATE/DELETE | Implicite, pas de code, performance native | Bypass possible avec SET ROLE postgres, BYPASSRLS | Retenue + REVOKE complementaire |
| Trigger BEFORE UPDATE RAISE EXCEPTION | Bloque meme superuser sauf SECURITY DEFINER | Code SQL a maintenir, performance overhead 5-10% | Retenue en complement (defense en profondeur) |
| Table partitionnee READ ONLY apres N jours | Bloque physique apres scellement | Complexite operationnelle, MVP overkill | Differee phase 4 |
| Append-only file (WAL replication) | Immutable au niveau systeme de fichiers | Necessite stockage WORM separe (S3 Object Lock) | Couvert par Tache 3.3.9 |

La decision retenue est une **defense en profondeur** : RLS sans policy + REVOKE + trigger
BEFORE UPDATE/DELETE qui leve une exception. Le code Migration ci-dessous implemente les trois
niveaux.

### 3.5 Decisions architecturales referencees

- **decision-009** (registre `00-pilotage/decisions-architecturales.md`) : signature loi 43-20
  archive 10 ans avec format CAdES LTV - implique audit trail conserve 10 ans aussi
- **decision-006** : interdiction emoji dans toute la base de code - aucun emoji dans les
  templates HBS audit trail meme pour les statuts (utiliser texte "VALIDE" / "ROMPU" pas tick mark)
- **decision-008** : cloud souverain Maroc - audit trails stockes dans la region MA exclusivement,
  sauvegardes croisees Casablanca-Rabat
- **decision-003** : multi-tenant strict avec RLS - applicable y compris aux audit trails (un
  tenant ne voit jamais l'audit d'un autre tenant, meme l'admin Skalean en cas d'incident utilise
  un mode break-glass trace)
- **decision-011** : conservation des donnees personnelles - exception audit trail conserve meme
  apres demande de suppression CNDP article 13 (motif legitime imperieux loi 43-20 prime sur
  loi 09-08 art. 13)

### 3.6 Pieges techniques identifies

1. **RLS bypass via SET ROLE** : un utilisateur avec attribut BYPASSRLS contourne toutes les
   policies. Mitigation : aucun role applicatif n'a BYPASSRLS, seul `postgres` superuser, et
   ses sessions sont auditees au niveau OS (pgaudit + journal systemd).

2. **RLS bypass via SUPERUSER** : meme analyse - seul `postgres` est superuser, les comptes
   admin Skalean sont reduits au strict necessaire et utilisent des roles non-superuser.

3. **Hash chain race condition concurrent inserts** : si deux processus inserent en parallele
   sur le meme `workflow_id`, ils peuvent lire le meme `last_entry` et calculer le meme
   `prev_hash`, generant deux entrees avec le meme `sequence_number` (une echouera sur l'index
   unique). Mitigation : `SELECT ... FOR UPDATE` (verrou pessimiste) sur la derniere entree du
   workflow lors de la lecture, libere apres INSERT dans la meme transaction.

4. **Sequence_number gap si INSERT echoue** : si l'INSERT echoue apres calcul du hash, le
   sequence_number suivant aura un trou (sequence 1, 2, 4, 5 - manque 3). Mitigation : la
   verification de chaine accepte les trous mais verifie que chaque hash valide correctement
   avec son predecesseur immediat existant. Le trou est documente dans le PDF audit trail
   ("evenement N intercepte mais non persiste - voir logs Pino").

5. **JSONB query performance** : la colonne `evidence` peut contenir des structures profondes
   (par exemple un PDF base64 ne devrait jamais y etre mis - max 100 KB). Mitigation : index
   GIN sur `evidence` cree uniquement si requete metier identifiee (KISS - pas d'index
   speculatif), check constraint sur la taille (`octet_length(evidence::text) < 102400`).

6. **Partition par mois pour retention 10 ans** : 10 ans x 12 mois x 50 evenements x 10000
   signatures = 60 millions de lignes par tenant. Mitigation : table partitionnee par mois
   `PARTITION BY RANGE (created_at)`, avec partitions individuelles archivables vers stockage
   froid (S3 Glacier) apres 1 an. Implementation differee en Tache 3.3.20 (optimisation perfs).

7. **Geo IP lookup latency** : la geolocalisation MaxMind ajoute 50-200ms par INSERT. Mitigation :
   geo lookup asynchrone post-INSERT via Kafka topic `audit-geo-enrich`, avec UPDATE differe
   sur la colonne `signer_geo_country` - mais cela contredit le append-only ! Solution retenue :
   geo lookup synchrone limite aux events `signer_signed` uniquement (les plus critiques
   juridiquement), avec timeout 100ms et fallback "UNKNOWN".

8. **Signer_id orphan apres user delete** : si un signataire externe (non utilisateur de la
   plateforme) signe puis demande suppression CNDP, son user_id devient nul. Mitigation : la
   colonne `signer_email` est conservee meme apres suppression utilisateur (motif legitime
   imperieux loi 43-20), mais peut etre pseudonymisee (sha256 de l'email) sur demande explicite
   tribunal. La colonne `signer_id` est NULLABLE et non-FK pour eviter cascade.

9. **Signer email PII vs minimisation CNDP** : conserver l'email du signataire 10 ans semble
   contredire la minimisation. Mitigation : l'email n'est pas une donnee excessive car il
   constitue precisement la preuve d'identite du signataire (seul moyen de re-contacter et
   prouver qui a signe). Justification documentee dans le registre des traitements article 30
   GDPR / equivalent CNDP.

10. **Audit trail PDF page count** : un workflow complexe avec 5 signataires et 30 evenements
    chacun genere ~150 pages. Mitigation : pagination intelligente HBS (groupement par
    signataire), sommaire navigable, taille fichier max 50 MB sinon refuse generation et
    propose export CSV.

11. **Evidence JSONB size limits** : un attaquant pourrait tenter de saturer l'espace en
    inserant des `evidence` enormes. Mitigation : CHECK CONSTRAINT
    `octet_length(evidence::text) < 102400` (100 KB) au niveau Postgres, validation Zod
    en amont.

12. **Webhook duplicate event creates duplicate audit (idempotency)** : un webhook DocuSign
    peut etre rejoue (DocuSign garantit at-least-once). Mitigation : champ `evidence.event_id`
    Unique constraint partial sur `(workflow_id, evidence->>'event_id')` quand non-null,
    INSERT ON CONFLICT DO NOTHING.

13. **TSA timestamp applied event ordering** : l'event `tsa_timestamp_applied` doit imperativement
    suivre `signer_signed`, jamais le preceder. Mitigation : check applicatif dans
    `AuditTrailService.logEvent()` qui verifie la coherence chronologique attendue par event_type.

14. **Hash algorithm migration** : si SHA-512 est compromis dans 20 ans, comment migrer ? Mitigation :
    colonne `hash_algorithm VARCHAR(16) NOT NULL DEFAULT 'SHA-512'` permet co-existence multi-algos
    futurs sans rupture chaine.

## 4. Architecture context

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                            FLUX EVENEMENT AUDIT TRAIL                             │
└──────────────────────────────────────────────────────────────────────────────────┘

  [SignatureWorkflowService]   [DocuSignWebhookConsumer]   [TsaService]   [ArchiveService]
           │                            │                       │                │
           │ emit(WorkflowEvent)        │ emit(SignerEvent)     │ emit(TsaEvent) │
           ▼                            ▼                       ▼                ▼
  ┌──────────────────────────────────────────────────────────────────────────────┐
  │                   Kafka topic: signature.audit.events.v1                      │
  │                   (partitionne par workflow_id, retention 7j)                 │
  └──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────────┐
                          │ AuditTrailListenerConsumer│
                          │ (groupe: audit-trail-cg)  │
                          └──────────────────────────┘
                                      │ deserialize + validate Zod
                                      ▼
                          ┌──────────────────────────┐
                          │   AuditTrailService      │
                          │   .logEvent()            │
                          └──────────────────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                ▼                     ▼                     ▼
   ┌─────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
   │ AuditHashChain      │ │ TenantContext    │ │ GeoIpLookupService   │
   │ .computeNext()      │ │ .getTenantId()   │ │ .lookupCountry()     │
   │ SELECT FOR UPDATE   │ │                  │ │ (timeout 100ms)      │
   └─────────────────────┘ └──────────────────┘ └──────────────────────┘
                │
                ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │ PostgreSQL: INSERT INTO sig_audit_trails (...)                      │
   │ Defense en profondeur:                                              │
   │   1. RLS policy tenant_insert (tenant_id = app_current_tenant())    │
   │   2. Pas de policy UPDATE ni DELETE -> rejet implicite              │
   │   3. REVOKE UPDATE, DELETE FROM PUBLIC                              │
   │   4. Trigger BEFORE UPDATE OR DELETE RAISE EXCEPTION                │
   │   5. Index unique (workflow_id, sequence_number)                    │
   │   6. Check constraint octet_length(evidence) < 102400               │
   └────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                          ┌──────────────────────────┐
                          │   Pino logger.info       │
                          │   audit.event.persisted  │
                          └──────────────────────────┘

  GENERATION PDF AUDIT TRAIL (sur demande):

  GET /audit-trail/:workflowId/pdf
           │
           ▼
   ┌──────────────────────────┐
   │ AuditTrailController     │
   │ .downloadPdf()           │
   └──────────────────────────┘
           │ check permission signature.audit_trail.read
           ▼
   ┌──────────────────────────┐
   │ AuditTrailPdfService     │
   │ .generatePdfTrail()      │
   └──────────────────────────┘
           │
   ┌───────┼────────────────────────────────────┐
   ▼       ▼                                    ▼
[loadEvents]  [loadSigners]              [verifyHashChain]
   │                                            │
   ▼                                            ▼
[orderTimeline]                          [computeIntegrityStatus]
                                                │
   ┌────────────────────────────────────────────┘
   ▼
   ┌──────────────────────────┐
   │ PdfGeneratorService      │
   │ (de Tache 3.3.5)         │
   │ template: audit-trail.hbs│
   └──────────────────────────┘
           │
           ▼
   ┌──────────────────────────┐
   │ TsaService.timestamp()   │
   │ (horodatage TSA Barid)   │
   └──────────────────────────┘
           │
           ▼
   PDF signe + horodate -> Stream HTTP au client (Content-Disposition: attachment)
```

## 5. Livrables checkables

1. Migration `sig_audit_trails` creee avec ENUM, table, indexes, RLS, REVOKE, trigger immutable
2. Entite TypeORM `SigAuditTrailEntity` declarative avec types corrects
3. Enum `AuditEventType` exhaustif (15+ valeurs documentees)
4. Service `AuditTrailService` avec `logEvent()`, `getTrail()`, `verifyIntegrity()`
5. Service `AuditHashChainService` avec `computeNextHash()`, `verifyChain()`, `recoverChain()`
6. Service `AuditTrailPdfService` orchestre PdfGeneratorService + TSA
7. Template Handlebars `audit-trail.hbs` (FR) avec 5 sections
8. Template Handlebars `ar/audit-trail.hbs` (RTL Arabic)
9. Controller `AuditTrailController` 3 endpoints (GET trail, GET pdf, GET verify)
10. Consumer Kafka `AuditTrailListenerConsumer` groupe `audit-trail-cg`
11. Tests unitaires `audit-trail.service.spec.ts` (15+ cas)
12. Tests unitaires `audit-hash-chain.service.spec.ts` (10+ cas)
13. Tests unitaires `audit-trail-pdf.service.spec.ts` (8+ cas)
14. Tests E2E `audit-trail.e2e-spec.ts` (10+ scenarios)
15. RLS verifie : INSERT autorise, UPDATE rejete, DELETE rejete (test SQL direct)
16. Hash chain verifie sur 100 entrees consecutives sans collision
17. PDF audit trail genere lisible avec sommaire pages
18. PDF audit trail horodate TSA Barid (jeton inclus)
19. Permission `signature.audit_trail.read` ajoutee au registre RBAC
20. Variables environnement `AUDIT_TRAIL_*` documentees `.env.example`
21. Geo IP lookup MaxMind integre avec fallback timeout
22. Idempotency webhook event_id (INSERT ON CONFLICT DO NOTHING)
23. Logs Pino structures `audit.event.persisted` avec workflow_id, event_type, sequence_number
24. Documentation Conformite Maroc 5 references legales explicites
25. Conventional commit message conforme

## 6. Fichiers crees / modifies

| Fichier | Type | Lignes attendues |
|---|---|---|
| `repo/packages/database/src/migrations/20260508120000-SigAuditTrails.ts` | CREATE | ~140 |
| `repo/packages/signature/src/entities/sig-audit-trail.entity.ts` | CREATE | ~85 |
| `repo/packages/signature/src/types/audit-event-type.enum.ts` | CREATE | ~55 |
| `repo/packages/signature/src/types/audit-details.types.ts` | CREATE | ~60 |
| `repo/packages/signature/src/services/audit-trail.service.ts` | CREATE | ~310 |
| `repo/packages/signature/src/services/audit-trail.service.spec.ts` | CREATE | ~270 |
| `repo/packages/signature/src/services/audit-hash-chain.service.ts` | CREATE | ~190 |
| `repo/packages/signature/src/services/audit-hash-chain.service.spec.ts` | CREATE | ~160 |
| `repo/packages/signature/src/services/audit-trail-pdf.service.ts` | CREATE | ~210 |
| `repo/packages/signature/src/services/audit-trail-pdf.service.spec.ts` | CREATE | ~155 |
| `repo/packages/signature/src/services/geo-ip-lookup.service.ts` | CREATE | ~95 |
| `repo/packages/docs/src/templates/audit-trail.hbs` | CREATE | ~270 |
| `repo/packages/docs/src/templates/ar/audit-trail.hbs` | CREATE | ~270 |
| `repo/apps/api/src/modules/signature/controllers/audit-trail.controller.ts` | CREATE | ~200 |
| `repo/apps/api/src/modules/signature/controllers/audit-trail.controller.spec.ts` | CREATE | ~160 |
| `repo/apps/api/src/modules/signature/consumers/audit-trail-listener.consumer.ts` | CREATE | ~210 |
| `repo/apps/api/src/modules/signature/signature.module.ts` | MODIFY | +20 |
| `repo/apps/api/test/signature/audit-trail.e2e-spec.ts` | CREATE | ~300 |
| `repo/apps/api/.env.example` | MODIFY | +6 |
| `repo/packages/auth/src/registry/permissions.registry.ts` | MODIFY | +3 |

## 7. Code patterns COMPLETS

### 7.1 Migration `20260508120000-SigAuditTrails.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class SigAuditTrails20260508120000 implements MigrationInterface {
  public name = 'SigAuditTrails20260508120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE sig_audit_event_type AS ENUM (
        'workflow_created',
        'document_sent',
        'signer_notification_sent',
        'signer_viewed',
        'signer_authenticated',
        'signer_signed',
        'signer_declined',
        'workflow_completed',
        'workflow_expired',
        'workflow_cancelled',
        'tsa_timestamp_applied',
        'archive_sealed',
        'audit_trail_generated',
        'webhook_received',
        'manual_intervention'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE sig_audit_trails (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE RESTRICT,
        workflow_id UUID NOT NULL REFERENCES sig_signing_workflows(id) ON DELETE RESTRICT,
        event_type sig_audit_event_type NOT NULL,
        signer_id UUID,
        signer_email VARCHAR(255),
        signer_ip INET,
        signer_user_agent TEXT,
        signer_geo_country VARCHAR(2),
        event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
        prev_hash VARCHAR(128),
        current_hash VARCHAR(128) NOT NULL,
        sequence_number BIGINT NOT NULL,
        hash_algorithm VARCHAR(16) NOT NULL DEFAULT 'SHA-512',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_evidence_size CHECK (octet_length(evidence::text) < 102400),
        CONSTRAINT chk_hash_length CHECK (length(current_hash) = 128),
        CONSTRAINT chk_seq_positive CHECK (sequence_number > 0),
        CONSTRAINT chk_hash_algo CHECK (hash_algorithm IN ('SHA-512', 'SHA3-512'))
      );
    `);

    await queryRunner.query(`
      CREATE INDEX idx_audit_workflow_seq ON sig_audit_trails(workflow_id, sequence_number);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_tenant_event ON sig_audit_trails(tenant_id, event_type, event_timestamp DESC);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_audit_signer_email ON sig_audit_trails(signer_email)
      WHERE signer_email IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_audit_workflow_seq_unique ON sig_audit_trails(workflow_id, sequence_number);
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_audit_webhook_idem ON sig_audit_trails(workflow_id, (evidence->>'event_id'))
      WHERE evidence ? 'event_id';
    `);

    await queryRunner.query(`ALTER TABLE sig_audit_trails ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`ALTER TABLE sig_audit_trails FORCE ROW LEVEL SECURITY;`);

    await queryRunner.query(`
      CREATE POLICY tenant_select ON sig_audit_trails
        FOR SELECT
        USING (tenant_id = app_current_tenant());
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_insert ON sig_audit_trails
        FOR INSERT
        WITH CHECK (tenant_id = app_current_tenant());
    `);

    await queryRunner.query(`REVOKE UPDATE, DELETE, TRUNCATE ON sig_audit_trails FROM PUBLIC;`);
    await queryRunner.query(`REVOKE UPDATE, DELETE, TRUNCATE ON sig_audit_trails FROM app_user;`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION sig_audit_trails_block_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Operation % interdite sur sig_audit_trails (append-only loi 43-20 art.9)', TG_OP
          USING ERRCODE = '42501';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_block_update
        BEFORE UPDATE ON sig_audit_trails
        FOR EACH ROW EXECUTE FUNCTION sig_audit_trails_block_mutation();
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_block_delete
        BEFORE DELETE ON sig_audit_trails
        FOR EACH ROW EXECUTE FUNCTION sig_audit_trails_block_mutation();
    `);

    await queryRunner.query(`
      COMMENT ON TABLE sig_audit_trails IS
        'Audit trail immuable signature electronique loi 43-20 art.9 - retention 10 ans - append-only';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN sig_audit_trails.current_hash IS
        'SHA-512 hex de prev_hash || JSON(event_data) - chaine cryptographique tamper-evident';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_block_delete ON sig_audit_trails;`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_block_update ON sig_audit_trails;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS sig_audit_trails_block_mutation();`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_insert ON sig_audit_trails;`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_select ON sig_audit_trails;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_webhook_idem;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_workflow_seq_unique;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_signer_email;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_tenant_event;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_audit_workflow_seq;`);
    await queryRunner.query(`DROP TABLE IF EXISTS sig_audit_trails;`);
    await queryRunner.query(`DROP TYPE IF EXISTS sig_audit_event_type;`);
  }
}
```

### 7.2 Entite `sig-audit-trail.entity.ts`

```typescript
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthTenantEntity } from '@skalean/auth/entities/auth-tenant.entity';
import { SigSigningWorkflowEntity } from './sig-signing-workflow.entity';
import { AuditEventType } from '../types/audit-event-type.enum';

@Entity({ name: 'sig_audit_trails' })
@Index('idx_audit_workflow_seq', ['workflowId', 'sequenceNumber'])
@Index('idx_audit_tenant_event', ['tenantId', 'eventType', 'eventTimestamp'])
export class SigAuditTrailEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => AuthTenantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: AuthTenantEntity;

  @Column({ name: 'workflow_id', type: 'uuid' })
  workflowId!: string;

  @ManyToOne(() => SigSigningWorkflowEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workflow_id' })
  workflow?: SigSigningWorkflowEntity;

  @Column({
    name: 'event_type',
    type: 'enum',
    enum: AuditEventType,
    enumName: 'sig_audit_event_type',
  })
  eventType!: AuditEventType;

  @Column({ name: 'signer_id', type: 'uuid', nullable: true })
  signerId!: string | null;

  @Column({ name: 'signer_email', type: 'varchar', length: 255, nullable: true })
  signerEmail!: string | null;

  @Column({ name: 'signer_ip', type: 'inet', nullable: true })
  signerIp!: string | null;

  @Column({ name: 'signer_user_agent', type: 'text', nullable: true })
  signerUserAgent!: string | null;

  @Column({ name: 'signer_geo_country', type: 'varchar', length: 2, nullable: true })
  signerGeoCountry!: string | null;

  @Column({ name: 'event_timestamp', type: 'timestamptz' })
  eventTimestamp!: Date;

  @Column({ name: 'evidence', type: 'jsonb', default: () => "'{}'::jsonb" })
  evidence!: Record<string, unknown>;

  @Column({ name: 'prev_hash', type: 'varchar', length: 128, nullable: true })
  prevHash!: string | null;

  @Column({ name: 'current_hash', type: 'varchar', length: 128 })
  currentHash!: string;

  @Column({ name: 'sequence_number', type: 'bigint' })
  sequenceNumber!: number;

  @Column({ name: 'hash_algorithm', type: 'varchar', length: 16, default: 'SHA-512' })
  hashAlgorithm!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
```

### 7.3 Enum `audit-event-type.enum.ts`

```typescript
/**
 * Types d'evenements consignes dans l'audit trail signature electronique.
 * Reference loi 43-20 art.9 et ACAPS Circulaire 2018/01 art.9.
 *
 * IMPORTANT: ne jamais supprimer ni renommer une valeur existante.
 * Toute nouvelle valeur doit etre ajoutee via migration ALTER TYPE ADD VALUE.
 */
export enum AuditEventType {
  /** Creation initiale du workflow par un utilisateur. */
  WORKFLOW_CREATED = 'workflow_created',

  /** Document envoye au prestataire signature (DocuSign/Yousign). */
  DOCUMENT_SENT = 'document_sent',

  /** Notification envoyee au signataire (email/SMS). */
  SIGNER_NOTIFICATION_SENT = 'signer_notification_sent',

  /** Le signataire a ouvert le document. */
  SIGNER_VIEWED = 'signer_viewed',

  /** Le signataire s'est authentifie (OTP, CIN scan, etc.). */
  SIGNER_AUTHENTICATED = 'signer_authenticated',

  /** Le signataire a appose sa signature. */
  SIGNER_SIGNED = 'signer_signed',

  /** Le signataire a refuse de signer. */
  SIGNER_DECLINED = 'signer_declined',

  /** Tous les signataires ont signe avec succes. */
  WORKFLOW_COMPLETED = 'workflow_completed',

  /** Le delai de signature est expire. */
  WORKFLOW_EXPIRED = 'workflow_expired',

  /** Workflow annule manuellement par un utilisateur ou un admin. */
  WORKFLOW_CANCELLED = 'workflow_cancelled',

  /** Horodatage TSA (Barid eSign) applique au document signe. */
  TSA_TIMESTAMP_APPLIED = 'tsa_timestamp_applied',

  /** Archive scellee dans S3 Object Lock (immuable 10 ans). */
  ARCHIVE_SEALED = 'archive_sealed',

  /** PDF audit trail genere et horodate. */
  AUDIT_TRAIL_GENERATED = 'audit_trail_generated',

  /** Webhook recu d'un prestataire signature externe. */
  WEBHOOK_RECEIVED = 'webhook_received',

  /** Intervention manuelle (admin Skalean break-glass). */
  MANUAL_INTERVENTION = 'manual_intervention',
}
```

### 7.4 Types `audit-details.types.ts`

```typescript
import { z } from 'zod';

export const SignerDetailsSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().email().max(255).optional(),
  phone: z.string().max(20).optional(),
  name: z.string().max(255).optional(),
  ip: z.string().ip().optional(),
  userAgent: z.string().max(2000).optional(),
  geoCountry: z.string().length(2).optional(),
});

export const AuditDetailsSchema = z.object({
  signer: SignerDetailsSchema.optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
  eventTimestamp: z.string().datetime().optional(),
});

export type SignerDetails = z.infer<typeof SignerDetailsSchema>;
export type AuditDetails = z.infer<typeof AuditDetailsSchema>;

export interface AuditTrailEntry {
  id: string;
  workflowId: string;
  eventType: string;
  signerEmail: string | null;
  signerIp: string | null;
  signerGeoCountry: string | null;
  eventTimestamp: Date;
  evidence: Record<string, unknown>;
  sequenceNumber: number;
  currentHash: string;
  prevHash: string | null;
}

export interface IntegrityCheckResult {
  workflowId: string;
  totalEntries: number;
  verifiedEntries: number;
  brokenAt: number | null;
  isIntegrityValid: boolean;
  algorithm: string;
  checkedAt: Date;
}
```

### 7.5 Service `audit-trail.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { TenantContext } from '@skalean/auth/context/tenant.context';
import { SigAuditTrailEntity } from '../entities/sig-audit-trail.entity';
import { AuditEventType } from '../types/audit-event-type.enum';
import {
  AuditDetails,
  AuditDetailsSchema,
  AuditTrailEntry,
  IntegrityCheckResult,
} from '../types/audit-details.types';
import { GeoIpLookupService } from './geo-ip-lookup.service';
import { AuditHashChainService } from './audit-hash-chain.service';

@Injectable()
export class AuditTrailService {
  constructor(
    @InjectRepository(SigAuditTrailEntity)
    private readonly repo: Repository<SigAuditTrailEntity>,
    private readonly dataSource: DataSource,
    private readonly geoIpService: GeoIpLookupService,
    private readonly hashChainService: AuditHashChainService,
    @InjectPinoLogger(AuditTrailService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Consigne un evenement dans l'audit trail. Verrouille la derniere entree du workflow
   * via SELECT FOR UPDATE pour eviter les races sur le sequence_number et le hash chain.
   *
   * @throws ZodError si details invalides
   * @throws Error si tenant context absent
   */
  async logEvent(
    workflowId: string,
    eventType: AuditEventType,
    details: AuditDetails,
  ): Promise<SigAuditTrailEntity> {
    const validated = AuditDetailsSchema.parse(details);
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('TenantContext absent - logEvent requiert un tenant courant');
    }

    return this.dataSource.transaction(async (manager) => {
      const lastEntry = await manager
        .getRepository(SigAuditTrailEntity)
        .createQueryBuilder('a')
        .where('a.workflow_id = :workflowId', { workflowId })
        .orderBy('a.sequence_number', 'DESC')
        .setLock('pessimistic_write')
        .getOne();

      const prevHash = lastEntry?.currentHash ?? null;
      const sequenceNumber = (Number(lastEntry?.sequenceNumber ?? 0)) + 1;

      let geoCountry: string | null = null;
      if (
        eventType === AuditEventType.SIGNER_SIGNED ||
        eventType === AuditEventType.SIGNER_AUTHENTICATED
      ) {
        if (validated.signer?.ip) {
          geoCountry = await this.geoIpService.lookupCountry(validated.signer.ip);
        }
      }

      const eventData = {
        workflow_id: workflowId,
        event_type: eventType,
        event_timestamp: validated.eventTimestamp ?? new Date().toISOString(),
        evidence: validated.evidence,
        sequence_number: sequenceNumber,
      };

      const currentHash = createHash('sha512')
        .update(prevHash ?? '')
        .update(JSON.stringify(eventData))
        .digest('hex');

      const entry = manager.getRepository(SigAuditTrailEntity).create({
        tenantId,
        workflowId,
        eventType,
        signerId: validated.signer?.id ?? null,
        signerEmail: validated.signer?.email ?? null,
        signerIp: validated.signer?.ip ?? null,
        signerUserAgent: validated.signer?.userAgent ?? null,
        signerGeoCountry: geoCountry ?? validated.signer?.geoCountry ?? null,
        eventTimestamp: new Date(validated.eventTimestamp ?? Date.now()),
        evidence: validated.evidence,
        prevHash,
        currentHash,
        sequenceNumber,
        hashAlgorithm: 'SHA-512',
      });

      try {
        const saved = await manager.getRepository(SigAuditTrailEntity).save(entry);
        this.logger.info(
          {
            workflowId,
            eventType,
            sequenceNumber,
            tenantId,
            entryId: saved.id,
          },
          'audit.event.persisted',
        );
        return saved;
      } catch (err) {
        if (this.isUniqueViolation(err)) {
          this.logger.warn(
            { workflowId, sequenceNumber, eventType },
            'audit.event.duplicate_idempotent',
          );
          return entry;
        }
        this.logger.error({ err, workflowId, eventType }, 'audit.event.persist_failed');
        throw err;
      }
    });
  }

  async getTrail(workflowId: string): Promise<AuditTrailEntry[]> {
    const rows = await this.repo
      .createQueryBuilder('a')
      .where('a.workflow_id = :workflowId', { workflowId })
      .orderBy('a.sequence_number', 'ASC')
      .getMany();

    return rows.map((r) => ({
      id: r.id,
      workflowId: r.workflowId,
      eventType: r.eventType,
      signerEmail: r.signerEmail,
      signerIp: r.signerIp,
      signerGeoCountry: r.signerGeoCountry,
      eventTimestamp: r.eventTimestamp,
      evidence: r.evidence,
      sequenceNumber: Number(r.sequenceNumber),
      currentHash: r.currentHash,
      prevHash: r.prevHash,
    }));
  }

  async verifyIntegrity(workflowId: string): Promise<IntegrityCheckResult> {
    return this.hashChainService.verifyChain(workflowId);
  }

  async countByEventType(
    tenantId: string,
    fromDate: Date,
    toDate: Date,
  ): Promise<Record<string, number>> {
    const rows = await this.repo
      .createQueryBuilder('a')
      .select('a.event_type', 'event_type')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.event_timestamp BETWEEN :from AND :to', {
        from: fromDate,
        to: toDate,
      })
      .groupBy('a.event_type')
      .getRawMany<{ event_type: string; cnt: string }>();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.event_type] = Number(row.cnt);
    }
    return result;
  }

  private isUniqueViolation(err: unknown): boolean {
    if (typeof err !== 'object' || err === null) return false;
    const code = (err as { code?: string }).code;
    return code === '23505';
  }
}
```

### 7.6 Service `audit-hash-chain.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'node:crypto';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { SigAuditTrailEntity } from '../entities/sig-audit-trail.entity';
import { IntegrityCheckResult } from '../types/audit-details.types';

@Injectable()
export class AuditHashChainService {
  constructor(
    @InjectRepository(SigAuditTrailEntity)
    private readonly repo: Repository<SigAuditTrailEntity>,
    @InjectPinoLogger(AuditHashChainService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Calcule le hash SHA-512 d'une entree audit trail en chainant avec le precedent.
   * Format: SHA-512(prev_hash_hex || JSON.stringify(event_data))
   */
  computeNextHash(
    prevHash: string | null,
    eventData: Record<string, unknown>,
  ): string {
    return createHash('sha512')
      .update(prevHash ?? '')
      .update(JSON.stringify(eventData))
      .digest('hex');
  }

  /**
   * Verifie l'integrite cryptographique de la chaine de hash pour un workflow donne.
   * Parcourt toutes les entrees ordonnees par sequence_number et recalcule chaque hash.
   * Retourne la position du premier hash invalide ou null si chaine integre.
   */
  async verifyChain(workflowId: string): Promise<IntegrityCheckResult> {
    const entries = await this.repo
      .createQueryBuilder('a')
      .where('a.workflow_id = :workflowId', { workflowId })
      .orderBy('a.sequence_number', 'ASC')
      .getMany();

    const checkedAt = new Date();

    if (entries.length === 0) {
      return {
        workflowId,
        totalEntries: 0,
        verifiedEntries: 0,
        brokenAt: null,
        isIntegrityValid: true,
        algorithm: 'SHA-512',
        checkedAt,
      };
    }

    let verifiedCount = 0;
    let brokenAt: number | null = null;
    let expectedPrevHash: string | null = null;

    for (const entry of entries) {
      const seqNum = Number(entry.sequenceNumber);

      if (entry.prevHash !== expectedPrevHash) {
        brokenAt = seqNum;
        this.logger.warn(
          {
            workflowId,
            sequenceNumber: seqNum,
            expectedPrevHash,
            actualPrevHash: entry.prevHash,
          },
          'audit.chain.broken_prev_hash',
        );
        break;
      }

      const eventData = {
        workflow_id: entry.workflowId,
        event_type: entry.eventType,
        event_timestamp: entry.eventTimestamp.toISOString(),
        evidence: entry.evidence,
        sequence_number: seqNum,
      };

      const recomputed = this.computeNextHash(entry.prevHash, eventData);

      if (recomputed !== entry.currentHash) {
        brokenAt = seqNum;
        this.logger.warn(
          {
            workflowId,
            sequenceNumber: seqNum,
            expected: recomputed.substring(0, 16),
            actual: entry.currentHash.substring(0, 16),
          },
          'audit.chain.broken_current_hash',
        );
        break;
      }

      verifiedCount++;
      expectedPrevHash = entry.currentHash;
    }

    const result: IntegrityCheckResult = {
      workflowId,
      totalEntries: entries.length,
      verifiedEntries: verifiedCount,
      brokenAt,
      isIntegrityValid: brokenAt === null,
      algorithm: 'SHA-512',
      checkedAt,
    };

    this.logger.info(
      {
        workflowId,
        totalEntries: result.totalEntries,
        verifiedEntries: result.verifiedEntries,
        valid: result.isIntegrityValid,
      },
      'audit.chain.verification_completed',
    );

    return result;
  }

  /**
   * Indique si une chaine est verifiable de bout en bout pour un workflow.
   * Helper pour tests et monitoring.
   */
  async isChainValid(workflowId: string): Promise<boolean> {
    const result = await this.verifyChain(workflowId);
    return result.isIntegrityValid;
  }
}
```

### 7.7 Service `audit-trail-pdf.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PdfGeneratorService } from '@skalean/docs/services/pdf-generator.service';
import { TsaService } from '@skalean/signature/services/tsa.service';
import { SignatureWorkflowService } from './signature-workflow.service';
import { AuditTrailService } from './audit-trail.service';
import { AuditHashChainService } from './audit-hash-chain.service';
import { AuditEventType } from '../types/audit-event-type.enum';

export interface AuditTrailPdfOptions {
  language: 'fr' | 'ar' | 'en';
  includeTsaTimestamp: boolean;
  includeIntegrityCheck: boolean;
}

@Injectable()
export class AuditTrailPdfService {
  constructor(
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly tsaService: TsaService,
    private readonly workflowService: SignatureWorkflowService,
    private readonly auditTrailService: AuditTrailService,
    private readonly hashChainService: AuditHashChainService,
    @InjectPinoLogger(AuditTrailPdfService.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Genere un document PDF d'audit trail juridique pour un workflow signature.
   * Le PDF est lui-meme horodate par TSA Barid pour valeur probante longue duree.
   *
   * @returns Buffer PDF binaire (signe + horodate si options.includeTsaTimestamp)
   */
  async generatePdfTrail(
    workflowId: string,
    options: AuditTrailPdfOptions = {
      language: 'fr',
      includeTsaTimestamp: true,
      includeIntegrityCheck: true,
    },
  ): Promise<Buffer> {
    this.logger.info({ workflowId, options }, 'audit.pdf.generation_start');

    const workflow = await this.workflowService.getById(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} introuvable`);
    }

    const trail = await this.auditTrailService.getTrail(workflowId);
    const integrityCheck = options.includeIntegrityCheck
      ? await this.hashChainService.verifyChain(workflowId)
      : null;

    const signers = this.extractUniqueSigners(trail);
    const tsaEvents = trail.filter((t) => t.eventType === AuditEventType.TSA_TIMESTAMP_APPLIED);
    const archiveEvents = trail.filter((t) => t.eventType === AuditEventType.ARCHIVE_SEALED);

    const templateName = options.language === 'ar' ? 'ar/audit-trail' : 'audit-trail';

    const templateData = {
      workflow: {
        id: workflow.id,
        title: workflow.title,
        documentHash: workflow.documentHash,
        status: workflow.status,
        createdAt: this.formatDate(workflow.createdAt, options.language),
      },
      events: trail.map((e) => ({
        sequenceNumber: e.sequenceNumber,
        type: e.eventType,
        typeLabel: this.translateEventType(e.eventType, options.language),
        timestamp: this.formatDateTime(e.eventTimestamp, options.language),
        signerEmail: e.signerEmail,
        signerIp: e.signerIp,
        signerGeoCountry: e.signerGeoCountry,
        evidenceJson: JSON.stringify(e.evidence, null, 2),
        currentHashShort: e.currentHash.substring(0, 32),
      })),
      signers,
      tsaEvents,
      archiveEvents,
      integrity: integrityCheck
        ? {
            valid: integrityCheck.isIntegrityValid,
            statusLabel: integrityCheck.isIntegrityValid ? 'VALIDE' : 'ROMPU',
            totalEntries: integrityCheck.totalEntries,
            verifiedEntries: integrityCheck.verifiedEntries,
            brokenAt: integrityCheck.brokenAt,
            algorithm: integrityCheck.algorithm,
            checkedAt: this.formatDateTime(integrityCheck.checkedAt, options.language),
          }
        : null,
      meta: {
        generatedAt: this.formatDateTime(new Date(), options.language),
        language: options.language,
        legalDisclaimer: this.getLegalDisclaimer(options.language),
      },
    };

    const pdfBuffer = await this.pdfGenerator.generateFromTemplate(templateName, templateData, {
      pageSize: 'A4',
      margins: { top: 25, right: 20, bottom: 25, left: 20 },
      direction: options.language === 'ar' ? 'rtl' : 'ltr',
      headerTemplate: this.getHeaderTemplate(options.language),
      footerTemplate: this.getFooterTemplate(workflowId, options.language),
    });

    if (pdfBuffer.length > 50 * 1024 * 1024) {
      throw new Error(`PDF audit trail trop volumineux (${pdfBuffer.length} octets > 50 MB)`);
    }

    let finalBuffer = pdfBuffer;
    if (options.includeTsaTimestamp) {
      const tsaResult = await this.tsaService.timestampDocument(pdfBuffer);
      finalBuffer = tsaResult.signedDocument;
      this.logger.info(
        { workflowId, tsaTokenSerial: tsaResult.tokenSerial },
        'audit.pdf.tsa_timestamped',
      );
    }

    await this.auditTrailService.logEvent(workflowId, AuditEventType.AUDIT_TRAIL_GENERATED, {
      evidence: {
        pdf_size_bytes: finalBuffer.length,
        language: options.language,
        tsa_applied: options.includeTsaTimestamp,
      },
    });

    this.logger.info(
      { workflowId, sizeBytes: finalBuffer.length },
      'audit.pdf.generation_complete',
    );

    return finalBuffer;
  }

  private extractUniqueSigners(trail: ReturnType<AuditTrailService['getTrail']> extends Promise<infer T> ? T : never): Array<{ email: string; ip: string | null; geoCountry: string | null; eventCount: number }> {
    const map = new Map<string, { email: string; ip: string | null; geoCountry: string | null; eventCount: number }>();
    for (const e of trail) {
      if (!e.signerEmail) continue;
      const existing = map.get(e.signerEmail);
      if (existing) {
        existing.eventCount++;
      } else {
        map.set(e.signerEmail, {
          email: e.signerEmail,
          ip: e.signerIp,
          geoCountry: e.signerGeoCountry,
          eventCount: 1,
        });
      }
    }
    return Array.from(map.values());
  }

  private formatDate(date: Date, lang: string): string {
    const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';
    return new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);
  }

  private formatDateTime(date: Date, lang: string): string {
    const locale = lang === 'ar' ? 'ar-MA' : lang === 'en' ? 'en-US' : 'fr-FR';
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'long',
      timeStyle: 'long',
      timeZone: 'Africa/Casablanca',
    }).format(date);
  }

  private translateEventType(type: string, lang: string): string {
    const translations: Record<string, Record<string, string>> = {
      fr: {
        workflow_created: 'Workflow cree',
        document_sent: 'Document envoye',
        signer_notification_sent: 'Notification envoyee au signataire',
        signer_viewed: 'Document consulte par le signataire',
        signer_authenticated: 'Signataire authentifie',
        signer_signed: 'Signature apposee',
        signer_declined: 'Signature refusee',
        workflow_completed: 'Workflow complete',
        workflow_expired: 'Workflow expire',
        workflow_cancelled: 'Workflow annule',
        tsa_timestamp_applied: 'Horodatage TSA applique',
        archive_sealed: 'Archive scellee',
        audit_trail_generated: 'Audit trail genere',
        webhook_received: 'Webhook recu',
        manual_intervention: 'Intervention manuelle',
      },
      ar: {
        workflow_created: 'تم انشاء سير العمل',
        document_sent: 'تم ارسال الوثيقة',
        signer_notification_sent: 'تم ارسال الاشعار للموقع',
        signer_viewed: 'تم عرض الوثيقة',
        signer_authenticated: 'تم التحقق من هوية الموقع',
        signer_signed: 'تم التوقيع',
        signer_declined: 'تم رفض التوقيع',
        workflow_completed: 'اكتمل سير العمل',
        workflow_expired: 'انتهت صلاحية سير العمل',
        workflow_cancelled: 'تم الغاء سير العمل',
        tsa_timestamp_applied: 'تم تطبيق الطابع الزمني',
        archive_sealed: 'تم ختم الارشيف',
        audit_trail_generated: 'تم انشاء سجل المراجعة',
        webhook_received: 'تم استلام الويبهوك',
        manual_intervention: 'تدخل يدوي',
      },
    };
    return translations[lang]?.[type] ?? type;
  }

  private getLegalDisclaimer(lang: string): string {
    if (lang === 'ar') {
      return 'هذا المستند يشكل دليلا رقميا قابلا للاحتجاج به امام المحاكم وفقا للمادة 9 من القانون 43-20.';
    }
    return 'Ce document constitue une preuve numerique opposable au sens de l\'article 9 de la loi 43-20.';
  }

  private getHeaderTemplate(lang: string): string {
    const title = lang === 'ar' ? 'سجل المراجعة' : 'Audit Trail Signature Electronique';
    return `<div style="font-size:8px;text-align:center;width:100%;color:#666;">${title}</div>`;
  }

  private getFooterTemplate(workflowId: string, lang: string): string {
    const pageLabel = lang === 'ar' ? 'صفحة' : 'Page';
    return `<div style="font-size:8px;text-align:center;width:100%;color:#666;">${workflowId} - ${pageLabel} <span class="pageNumber"></span> / <span class="totalPages"></span></div>`;
  }
}
```

### 7.8 Service `geo-ip-lookup.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Reader, ReaderModel } from '@maxmind/geoip2-node';
import { promises as fs } from 'node:fs';

@Injectable()
export class GeoIpLookupService implements OnModuleInit, OnModuleDestroy {
  private reader: ReaderModel | null = null;
  private enabled = false;
  private readonly timeoutMs: number = 100;

  constructor(
    private readonly config: ConfigService,
    @InjectPinoLogger(GeoIpLookupService.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    this.enabled = this.config.get<string>('AUDIT_TRAIL_GEO_LOOKUP_ENABLED') === 'true';
    if (!this.enabled) {
      this.logger.info('audit.geo.disabled');
      return;
    }
    const dbPath = this.config.get<string>('AUDIT_TRAIL_GEO_DB_PATH');
    if (!dbPath) {
      this.logger.warn('audit.geo.no_db_path_disabling');
      this.enabled = false;
      return;
    }
    try {
      const buffer = await fs.readFile(dbPath);
      this.reader = Reader.openBuffer(buffer);
      this.logger.info({ dbPath }, 'audit.geo.initialized');
    } catch (err) {
      this.logger.error({ err }, 'audit.geo.init_failed_disabling');
      this.enabled = false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.reader = null;
  }

  async lookupCountry(ip: string): Promise<string | null> {
    if (!this.enabled || !this.reader) {
      return null;
    }
    return Promise.race([
      this.doLookup(ip),
      this.timeout<string | null>(this.timeoutMs, null),
    ]);
  }

  private async doLookup(ip: string): Promise<string | null> {
    try {
      const result = this.reader!.country(ip);
      return result.country?.isoCode ?? null;
    } catch (err) {
      this.logger.debug({ err, ip }, 'audit.geo.lookup_failed');
      return null;
    }
  }

  private timeout<T>(ms: number, fallback: T): Promise<T> {
    return new Promise((resolve) => setTimeout(() => resolve(fallback), ms));
  }
}
```

### 7.9 Controller `audit-trail.controller.ts`

```typescript
import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '@skalean/auth/guards/jwt-auth.guard';
import { TenantGuard } from '@skalean/auth/guards/tenant.guard';
import { Permissions } from '@skalean/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '@skalean/auth/guards/permissions.guard';
import { AuditTrailService } from '@skalean/signature/services/audit-trail.service';
import { AuditTrailPdfService } from '@skalean/signature/services/audit-trail-pdf.service';

@ApiTags('signature-audit-trail')
@ApiBearerAuth()
@Controller('api/v1/signature/workflows/:workflowId/audit-trail')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
export class AuditTrailController {
  constructor(
    private readonly auditTrailService: AuditTrailService,
    private readonly auditTrailPdfService: AuditTrailPdfService,
  ) {}

  @Get()
  @Permissions('signature.audit_trail.read')
  @ApiOperation({ summary: 'Liste les evenements audit trail d\'un workflow' })
  @ApiResponse({ status: 200, description: 'Timeline JSON ordonnee par sequence_number' })
  @ApiResponse({ status: 403, description: 'Permission refusee' })
  @ApiResponse({ status: 404, description: 'Workflow inexistant ou autre tenant' })
  async getTrail(@Param('workflowId', ParseUUIDPipe) workflowId: string) {
    const entries = await this.auditTrailService.getTrail(workflowId);
    if (entries.length === 0) {
      throw new NotFoundException(`Aucun audit trail pour workflow ${workflowId}`);
    }
    return {
      workflowId,
      totalEntries: entries.length,
      entries,
    };
  }

  @Get('pdf')
  @Permissions('signature.audit_trail.read')
  @ApiOperation({ summary: 'Telecharge le PDF audit trail horodate (preuve juridique loi 43-20)' })
  @ApiResponse({ status: 200, description: 'Stream PDF', content: { 'application/pdf': {} } })
  async downloadPdf(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @Query('lang') lang: 'fr' | 'ar' | 'en' = 'fr',
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.auditTrailPdfService.generatePdfTrail(workflowId, {
      language: lang,
      includeTsaTimestamp: true,
      includeIntegrityCheck: true,
    });
    res.status(HttpStatus.OK);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-trail-${workflowId}.pdf"`,
    );
    res.setHeader('Content-Length', String(pdf.length));
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(pdf);
  }

  @Get('verify')
  @Permissions('signature.audit_trail.read')
  @ApiOperation({ summary: 'Verifie l\'integrite cryptographique de la chaine de hash' })
  @ApiResponse({ status: 200, description: 'Resultat verification (valid/broken)' })
  async verifyIntegrity(@Param('workflowId', ParseUUIDPipe) workflowId: string) {
    return this.auditTrailService.verifyIntegrity(workflowId);
  }
}
```

### 7.10 Consumer Kafka `audit-trail-listener.consumer.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Consumer, EachMessagePayload } from 'kafkajs';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import { TenantContext } from '@skalean/auth/context/tenant.context';
import { AuditTrailService } from '@skalean/signature/services/audit-trail.service';
import { AuditEventType } from '@skalean/signature/types/audit-event-type.enum';

const SignatureAuditEventSchema = z.object({
  tenantId: z.string().uuid(),
  workflowId: z.string().uuid(),
  eventType: z.nativeEnum(AuditEventType),
  occurredAt: z.string().datetime(),
  signer: z
    .object({
      id: z.string().uuid().optional(),
      email: z.string().email().optional(),
      ip: z.string().ip().optional(),
      userAgent: z.string().optional(),
    })
    .optional(),
  evidence: z.record(z.string(), z.unknown()).default({}),
});

type SignatureAuditEvent = z.infer<typeof SignatureAuditEventSchema>;

@Injectable()
export class AuditTrailListenerConsumer implements OnModuleInit, OnModuleDestroy {
  private kafka!: Kafka;
  private consumer!: Consumer;
  private readonly topic = 'signature.audit.events.v1';
  private readonly groupId = 'audit-trail-cg';

  constructor(
    private readonly config: ConfigService,
    private readonly auditTrailService: AuditTrailService,
    @InjectPinoLogger(AuditTrailListenerConsumer.name)
    private readonly logger: PinoLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    const brokers = this.config.getOrThrow<string>('KAFKA_BROKERS').split(',');
    this.kafka = new Kafka({ clientId: 'audit-trail-listener', brokers });
    this.consumer = this.kafka.consumer({
      groupId: this.groupId,
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });
    await this.consumer.connect();
    await this.consumer.subscribe({ topic: this.topic, fromBeginning: false });
    await this.consumer.run({
      autoCommit: false,
      eachMessage: async (payload) => this.handleMessage(payload),
    });
    this.logger.info({ topic: this.topic, groupId: this.groupId }, 'audit.consumer.started');
  }

  async onModuleDestroy(): Promise<void> {
    await this.consumer?.disconnect();
  }

  private async handleMessage(payload: EachMessagePayload): Promise<void> {
    const { topic, partition, message } = payload;
    const offset = message.offset;
    const raw = message.value?.toString('utf8');
    if (!raw) {
      this.logger.warn({ topic, partition, offset }, 'audit.consumer.empty_message');
      await this.commitOffset(payload);
      return;
    }
    let event: SignatureAuditEvent;
    try {
      const parsed = JSON.parse(raw);
      event = SignatureAuditEventSchema.parse(parsed);
    } catch (err) {
      this.logger.error(
        { err, topic, partition, offset, raw: raw.substring(0, 500) },
        'audit.consumer.invalid_payload_skipped',
      );
      await this.commitOffset(payload);
      return;
    }

    try {
      await TenantContext.runWithTenant(event.tenantId, async () => {
        await this.auditTrailService.logEvent(event.workflowId, event.eventType, {
          signer: event.signer,
          evidence: event.evidence,
          eventTimestamp: event.occurredAt,
        });
      });
      this.logger.info(
        {
          tenantId: event.tenantId,
          workflowId: event.workflowId,
          eventType: event.eventType,
          offset,
        },
        'audit.consumer.event_persisted',
      );
      await this.commitOffset(payload);
    } catch (err) {
      this.logger.error(
        { err, tenantId: event.tenantId, workflowId: event.workflowId, offset },
        'audit.consumer.persist_failed_will_retry',
      );
      throw err;
    }
  }

  private async commitOffset(payload: EachMessagePayload): Promise<void> {
    await this.consumer.commitOffsets([
      {
        topic: payload.topic,
        partition: payload.partition,
        offset: (BigInt(payload.message.offset) + 1n).toString(),
      },
    ]);
  }
}
```

### 7.11 Template `audit-trail.hbs` (FR)

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Audit Trail Signature Electronique - {{workflow.id}}</title>
<style>
  body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: 10pt; color: #1a1a1a; margin: 0; padding: 0; }
  .header { background: #003366; color: white; padding: 20px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 18pt; }
  .header .subtitle { font-size: 10pt; margin-top: 5px; opacity: 0.9; }
  .section { margin: 20px; page-break-inside: avoid; }
  .section h2 { background: #e6eef5; color: #003366; padding: 8px 12px; font-size: 13pt; border-left: 4px solid #003366; }
  .meta-table, .events-table, .signers-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .meta-table td, .events-table td, .events-table th, .signers-table td, .signers-table th { padding: 6px 8px; border: 1px solid #cccccc; vertical-align: top; }
  .meta-table td:first-child { background: #f5f5f5; font-weight: bold; width: 30%; }
  .events-table th { background: #003366; color: white; font-size: 9pt; }
  .events-table tr:nth-child(even) { background: #f9f9f9; }
  .integrity-valid { color: #006600; font-weight: bold; }
  .integrity-broken { color: #cc0000; font-weight: bold; }
  .hash { font-family: 'Courier New', monospace; font-size: 8pt; word-break: break-all; }
  .disclaimer { background: #fff3cd; border-left: 4px solid #ffa500; padding: 10px; margin: 20px; font-size: 9pt; }
  .signature-block { border: 2px solid #003366; padding: 15px; margin: 20px; text-align: center; font-size: 9pt; }
  .toc { margin: 20px; page-break-after: always; }
  .toc ol { line-height: 1.8; }
</style>
</head>
<body>

<div class="header">
  <h1>Audit Trail - Signature Electronique</h1>
  <div class="subtitle">Document juridique opposable - Loi 43-20 article 9 - Royaume du Maroc</div>
</div>

<div class="toc">
  <h2>Sommaire</h2>
  <ol>
    <li>Identification du workflow</li>
    <li>Timeline des evenements ({{events.length}} entrees)</li>
    <li>Identites des signataires ({{signers.length}} signataires)</li>
    <li>Horodatage TSA Barid eSign ({{tsaEvents.length}} jetons)</li>
    <li>Scellement archive WORM ({{archiveEvents.length}} archives)</li>
    {{#if integrity}}<li>Statut integrite chaine cryptographique</li>{{/if}}
  </ol>
</div>

<div class="section">
  <h2>1. Identification du workflow</h2>
  <table class="meta-table">
    <tr><td>Identifiant workflow</td><td>{{workflow.id}}</td></tr>
    <tr><td>Titre du document</td><td>{{workflow.title}}</td></tr>
    <tr><td>Empreinte SHA-512 du document</td><td class="hash">{{workflow.documentHash}}</td></tr>
    <tr><td>Statut actuel</td><td>{{workflow.status}}</td></tr>
    <tr><td>Date de creation</td><td>{{workflow.createdAt}}</td></tr>
    <tr><td>Document genere le</td><td>{{meta.generatedAt}}</td></tr>
  </table>
</div>

<div class="section">
  <h2>2. Timeline des evenements</h2>
  <table class="events-table">
    <thead>
      <tr>
        <th>Seq.</th>
        <th>Evenement</th>
        <th>Date / Heure (Casablanca)</th>
        <th>Signataire (email)</th>
        <th>Adresse IP</th>
        <th>Pays</th>
        <th>Hash (32 premiers car.)</th>
      </tr>
    </thead>
    <tbody>
    {{#each events}}
      <tr>
        <td>{{this.sequenceNumber}}</td>
        <td>{{this.typeLabel}}</td>
        <td>{{this.timestamp}}</td>
        <td>{{#if this.signerEmail}}{{this.signerEmail}}{{else}}-{{/if}}</td>
        <td>{{#if this.signerIp}}{{this.signerIp}}{{else}}-{{/if}}</td>
        <td>{{#if this.signerGeoCountry}}{{this.signerGeoCountry}}{{else}}-{{/if}}</td>
        <td class="hash">{{this.currentHashShort}}</td>
      </tr>
    {{/each}}
    </tbody>
  </table>
</div>

<div class="section">
  <h2>3. Identites des signataires</h2>
  {{#if signers.length}}
  <table class="signers-table">
    <thead>
      <tr><th>Email</th><th>Adresse IP</th><th>Pays</th><th>Nombre evenements</th></tr>
    </thead>
    <tbody>
    {{#each signers}}
      <tr>
        <td>{{this.email}}</td>
        <td>{{#if this.ip}}{{this.ip}}{{else}}-{{/if}}</td>
        <td>{{#if this.geoCountry}}{{this.geoCountry}}{{else}}-{{/if}}</td>
        <td>{{this.eventCount}}</td>
      </tr>
    {{/each}}
    </tbody>
  </table>
  {{else}}
  <p>Aucun signataire identifie.</p>
  {{/if}}
</div>

<div class="section">
  <h2>4. Horodatage TSA Barid eSign</h2>
  {{#if tsaEvents.length}}
  <table class="signers-table">
    <thead>
      <tr><th>Date application</th><th>Token Serial</th><th>Autorite</th></tr>
    </thead>
    <tbody>
    {{#each tsaEvents}}
      <tr>
        <td>{{this.eventTimestamp}}</td>
        <td class="hash">{{this.evidence.token_serial}}</td>
        <td>{{this.evidence.authority}}</td>
      </tr>
    {{/each}}
    </tbody>
  </table>
  {{else}}
  <p>Aucun horodatage TSA enregistre.</p>
  {{/if}}
</div>

<div class="section">
  <h2>5. Scellement archive WORM</h2>
  {{#if archiveEvents.length}}
  <table class="signers-table">
    <thead>
      <tr><th>Date scellement</th><th>Bucket S3</th><th>Cle objet</th><th>Verrou jusqu'au</th></tr>
    </thead>
    <tbody>
    {{#each archiveEvents}}
      <tr>
        <td>{{this.eventTimestamp}}</td>
        <td>{{this.evidence.bucket}}</td>
        <td class="hash">{{this.evidence.object_key}}</td>
        <td>{{this.evidence.locked_until}}</td>
      </tr>
    {{/each}}
    </tbody>
  </table>
  {{else}}
  <p>Aucun scellement archive enregistre.</p>
  {{/if}}
</div>

{{#if integrity}}
<div class="section">
  <h2>6. Statut d'integrite de la chaine cryptographique</h2>
  <table class="meta-table">
    <tr><td>Algorithme</td><td>{{integrity.algorithm}}</td></tr>
    <tr><td>Total entrees</td><td>{{integrity.totalEntries}}</td></tr>
    <tr><td>Entrees verifiees</td><td>{{integrity.verifiedEntries}}</td></tr>
    <tr>
      <td>Statut</td>
      <td class="{{#if integrity.valid}}integrity-valid{{else}}integrity-broken{{/if}}">{{integrity.statusLabel}}</td>
    </tr>
    {{#unless integrity.valid}}
    <tr><td>Premier hash invalide a la position</td><td>{{integrity.brokenAt}}</td></tr>
    {{/unless}}
    <tr><td>Verification effectuee le</td><td>{{integrity.checkedAt}}</td></tr>
  </table>
</div>
{{/if}}

<div class="disclaimer">
  <strong>Mention legale</strong> : {{meta.legalDisclaimer}}
  Conformement a la loi 43-20 article 9 sur la confiance numerique, ce document constitue une preuve electronique
  recevable au sens de l'article 417-4 du Code de procedure civile marocain. Les hashs SHA-512 garantissent
  l'integrite cryptographique des evenements consignes. Toute alteration des donnees source rendrait la chaine
  de hash invalide.
</div>

<div class="signature-block">
  Document genere par Skalean Insurtech le {{meta.generatedAt}}<br>
  Identifiant workflow : {{workflow.id}}<br>
  Ce document est lui-meme horodate par TSA Barid eSign et constitue une preuve juridique opposable.
</div>

</body>
</html>
```

### 7.12 Template `ar/audit-trail.hbs` (RTL Arabe)

```handlebars
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>سجل المراجعة للتوقيع الالكتروني - {{workflow.id}}</title>
<style>
  body { font-family: 'Amiri', 'DejaVu Sans', Arial, sans-serif; font-size: 11pt; color: #1a1a1a; margin: 0; padding: 0; direction: rtl; text-align: right; }
  .header { background: #003366; color: white; padding: 20px; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 18pt; }
  .section { margin: 20px; page-break-inside: avoid; }
  .section h2 { background: #e6eef5; color: #003366; padding: 8px 12px; font-size: 13pt; border-right: 4px solid #003366; }
  .meta-table, .events-table, .signers-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .meta-table td, .events-table td, .events-table th, .signers-table td, .signers-table th { padding: 6px 8px; border: 1px solid #cccccc; }
  .meta-table td:first-child { background: #f5f5f5; font-weight: bold; width: 30%; }
  .events-table th { background: #003366; color: white; font-size: 10pt; }
  .integrity-valid { color: #006600; font-weight: bold; }
  .integrity-broken { color: #cc0000; font-weight: bold; }
  .hash { font-family: 'Courier New', monospace; font-size: 8pt; direction: ltr; text-align: left; }
  .disclaimer { background: #fff3cd; border-right: 4px solid #ffa500; padding: 10px; margin: 20px; font-size: 10pt; }
  .signature-block { border: 2px solid #003366; padding: 15px; margin: 20px; text-align: center; font-size: 10pt; }
</style>
</head>
<body>

<div class="header">
  <h1>سجل المراجعة - التوقيع الالكتروني</h1>
  <div>وثيقة قانونية قابلة للاحتجاج بها - المادة 9 من القانون 43-20 - المملكة المغربية</div>
</div>

<div class="section">
  <h2>1. تعريف سير العمل</h2>
  <table class="meta-table">
    <tr><td>معرف سير العمل</td><td class="hash">{{workflow.id}}</td></tr>
    <tr><td>عنوان الوثيقة</td><td>{{workflow.title}}</td></tr>
    <tr><td>بصمة SHA-512 للوثيقة</td><td class="hash">{{workflow.documentHash}}</td></tr>
    <tr><td>الحالة الحالية</td><td>{{workflow.status}}</td></tr>
    <tr><td>تاريخ الانشاء</td><td>{{workflow.createdAt}}</td></tr>
  </table>
</div>

<div class="section">
  <h2>2. الجدول الزمني للاحداث</h2>
  <table class="events-table">
    <thead>
      <tr>
        <th>الرقم</th>
        <th>الحدث</th>
        <th>التاريخ والوقت (الدار البيضاء)</th>
        <th>الموقع (البريد)</th>
        <th>عنوان IP</th>
        <th>البلد</th>
      </tr>
    </thead>
    <tbody>
    {{#each events}}
      <tr>
        <td>{{this.sequenceNumber}}</td>
        <td>{{this.typeLabel}}</td>
        <td>{{this.timestamp}}</td>
        <td>{{#if this.signerEmail}}{{this.signerEmail}}{{else}}-{{/if}}</td>
        <td class="hash">{{#if this.signerIp}}{{this.signerIp}}{{else}}-{{/if}}</td>
        <td>{{#if this.signerGeoCountry}}{{this.signerGeoCountry}}{{else}}-{{/if}}</td>
      </tr>
    {{/each}}
    </tbody>
  </table>
</div>

<div class="section">
  <h2>3. هويات الموقعين</h2>
  {{#if signers.length}}
  <table class="signers-table">
    <thead>
      <tr><th>البريد الالكتروني</th><th>عنوان IP</th><th>البلد</th><th>عدد الاحداث</th></tr>
    </thead>
    <tbody>
    {{#each signers}}
      <tr>
        <td>{{this.email}}</td>
        <td class="hash">{{#if this.ip}}{{this.ip}}{{else}}-{{/if}}</td>
        <td>{{#if this.geoCountry}}{{this.geoCountry}}{{else}}-{{/if}}</td>
        <td>{{this.eventCount}}</td>
      </tr>
    {{/each}}
    </tbody>
  </table>
  {{else}}
  <p>لا يوجد موقعون محددون.</p>
  {{/if}}
</div>

{{#if integrity}}
<div class="section">
  <h2>4. حالة سلامة سلسلة التشفير</h2>
  <table class="meta-table">
    <tr><td>الخوارزمية</td><td>{{integrity.algorithm}}</td></tr>
    <tr><td>اجمالي الادخالات</td><td>{{integrity.totalEntries}}</td></tr>
    <tr><td>الادخالات المتحقق منها</td><td>{{integrity.verifiedEntries}}</td></tr>
    <tr>
      <td>الحالة</td>
      <td class="{{#if integrity.valid}}integrity-valid{{else}}integrity-broken{{/if}}">{{integrity.statusLabel}}</td>
    </tr>
  </table>
</div>
{{/if}}

<div class="disclaimer">
  <strong>اشعار قانوني</strong>: {{meta.legalDisclaimer}}
</div>

<div class="signature-block">
  وثيقة منشاة بواسطة Skalean Insurtech في {{meta.generatedAt}}<br>
  معرف سير العمل: {{workflow.id}}
</div>

</body>
</html>
```

### 7.13 Test `audit-trail.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getLoggerToken } from 'nestjs-pino';
import { AuditTrailService } from './audit-trail.service';
import { AuditHashChainService } from './audit-hash-chain.service';
import { GeoIpLookupService } from './geo-ip-lookup.service';
import { SigAuditTrailEntity } from '../entities/sig-audit-trail.entity';
import { AuditEventType } from '../types/audit-event-type.enum';
import { TenantContext } from '@skalean/auth/context/tenant.context';

describe('AuditTrailService', () => {
  let service: AuditTrailService;
  let repo: Repository<SigAuditTrailEntity>;
  let dataSource: DataSource;
  let geoIpService: GeoIpLookupService;

  const TENANT_ID = '00000000-0000-0000-0000-000000000001';
  const WORKFLOW_ID = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    const fakeRepo = {
      createQueryBuilder: vi.fn(),
      create: vi.fn((data) => data),
      save: vi.fn(),
    } as unknown as Repository<SigAuditTrailEntity>;

    const fakeManager = {
      getRepository: vi.fn().mockReturnValue(fakeRepo),
    };

    const fakeDataSource = {
      transaction: vi.fn(async (cb: (m: typeof fakeManager) => Promise<unknown>) => cb(fakeManager)),
    } as unknown as DataSource;

    const fakeGeo = {
      lookupCountry: vi.fn().mockResolvedValue('MA'),
    } as unknown as GeoIpLookupService;

    const fakeHash = {
      verifyChain: vi.fn(),
    } as unknown as AuditHashChainService;

    const fakeLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuditTrailService,
        { provide: getRepositoryToken(SigAuditTrailEntity), useValue: fakeRepo },
        { provide: DataSource, useValue: fakeDataSource },
        { provide: GeoIpLookupService, useValue: fakeGeo },
        { provide: AuditHashChainService, useValue: fakeHash },
        { provide: getLoggerToken(AuditTrailService.name), useValue: fakeLogger },
      ],
    }).compile();

    service = moduleRef.get(AuditTrailService);
    repo = moduleRef.get(getRepositoryToken(SigAuditTrailEntity));
    dataSource = moduleRef.get(DataSource);
    geoIpService = moduleRef.get(GeoIpLookupService);

    vi.spyOn(TenantContext, 'getTenantId').mockReturnValue(TENANT_ID);
  });

  afterEach(() => vi.restoreAllMocks());

  function setupQueryBuilderMock(lastEntry: Partial<SigAuditTrailEntity> | null) {
    const qb = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      setLock: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(lastEntry),
      addSelect: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn(),
      select: vi.fn().mockReturnThis(),
      getMany: vi.fn(),
    };
    (repo.createQueryBuilder as ReturnType<typeof vi.fn>).mockReturnValue(qb);
    return qb;
  }

  it('cree premiere entree avec sequence_number=1 et prev_hash null', async () => {
    setupQueryBuilderMock(null);
    (repo.save as ReturnType<typeof vi.fn>).mockImplementation(async (e) => ({ ...e, id: 'new-id' }));

    const result = await service.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, {
      evidence: { source: 'manual' },
    });

    expect(result.sequenceNumber).toBe(1);
    expect(result.prevHash).toBeNull();
    expect(result.currentHash).toMatch(/^[0-9a-f]{128}$/);
    expect(result.tenantId).toBe(TENANT_ID);
  });

  it('cree entree N+1 avec prev_hash = current_hash de N', async () => {
    const previous = {
      currentHash: 'a'.repeat(128),
      sequenceNumber: 5,
    };
    setupQueryBuilderMock(previous);
    (repo.save as ReturnType<typeof vi.fn>).mockImplementation(async (e) => e);

    const result = await service.logEvent(WORKFLOW_ID, AuditEventType.SIGNER_VIEWED, {
      evidence: { ip: '197.45.0.1' },
    });

    expect(result.sequenceNumber).toBe(6);
    expect(result.prevHash).toBe('a'.repeat(128));
  });

  it('rejette si TenantContext absent', async () => {
    (TenantContext.getTenantId as ReturnType<typeof vi.fn>).mockReturnValue(null);
    await expect(
      service.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, { evidence: {} }),
    ).rejects.toThrow(/TenantContext absent/);
  });

  it('rejette si signer.email invalide format', async () => {
    setupQueryBuilderMock(null);
    await expect(
      service.logEvent(WORKFLOW_ID, AuditEventType.SIGNER_SIGNED, {
        signer: { email: 'pas-un-email' },
        evidence: {},
      }),
    ).rejects.toThrow();
  });

  it('rejette si signer.ip invalide format', async () => {
    setupQueryBuilderMock(null);
    await expect(
      service.logEvent(WORKFLOW_ID, AuditEventType.SIGNER_SIGNED, {
        signer: { email: 'a@b.ma', ip: '999.999.999.999' },
        evidence: {},
      }),
    ).rejects.toThrow();
  });

  it('appelle geo lookup uniquement pour SIGNER_SIGNED et SIGNER_AUTHENTICATED', async () => {
    setupQueryBuilderMock(null);
    (repo.save as ReturnType<typeof vi.fn>).mockImplementation(async (e) => e);

    await service.logEvent(WORKFLOW_ID, AuditEventType.SIGNER_VIEWED, {
      signer: { email: 'a@b.ma', ip: '197.45.0.1' },
      evidence: {},
    });
    expect(geoIpService.lookupCountry).not.toHaveBeenCalled();

    await service.logEvent(WORKFLOW_ID, AuditEventType.SIGNER_SIGNED, {
      signer: { email: 'a@b.ma', ip: '197.45.0.1' },
      evidence: {},
    });
    expect(geoIpService.lookupCountry).toHaveBeenCalledWith('197.45.0.1');
  });

  it('utilise SELECT FOR UPDATE pour eviter races concurrent INSERT', async () => {
    const qb = setupQueryBuilderMock(null);
    (repo.save as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'x' });
    await service.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, { evidence: {} });
    expect(qb.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  it('retourne entree existante en cas de duplicate (idempotency)', async () => {
    setupQueryBuilderMock(null);
    const dupErr = Object.assign(new Error('duplicate'), { code: '23505' });
    (repo.save as ReturnType<typeof vi.fn>).mockRejectedValue(dupErr);

    const result = await service.logEvent(WORKFLOW_ID, AuditEventType.WEBHOOK_RECEIVED, {
      evidence: { event_id: 'wh-123' },
    });
    expect(result).toBeDefined();
    expect(result.eventType).toBe(AuditEventType.WEBHOOK_RECEIVED);
  });

  it('propage erreur non-unique (par exemple connection lost)', async () => {
    setupQueryBuilderMock(null);
    const otherErr = Object.assign(new Error('connection lost'), { code: '08003' });
    (repo.save as ReturnType<typeof vi.fn>).mockRejectedValue(otherErr);

    await expect(
      service.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, { evidence: {} }),
    ).rejects.toThrow(/connection lost/);
  });

  it('hash est deterministe pour memes inputs', async () => {
    setupQueryBuilderMock(null);
    (repo.save as ReturnType<typeof vi.fn>).mockImplementation(async (e) => e);

    const fixedTime = '2026-05-08T10:00:00.000Z';
    const e1 = await service.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, {
      evidence: { foo: 'bar' },
      eventTimestamp: fixedTime,
    });
    const e2 = await service.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, {
      evidence: { foo: 'bar' },
      eventTimestamp: fixedTime,
    });
    expect(e1.currentHash).toBe(e2.currentHash);
  });

  it('hash differe si evidence differe', async () => {
    setupQueryBuilderMock(null);
    (repo.save as ReturnType<typeof vi.fn>).mockImplementation(async (e) => e);

    const fixedTime = '2026-05-08T10:00:00.000Z';
    const e1 = await service.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, {
      evidence: { foo: 'bar' },
      eventTimestamp: fixedTime,
    });
    const e2 = await service.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, {
      evidence: { foo: 'baz' },
      eventTimestamp: fixedTime,
    });
    expect(e1.currentHash).not.toBe(e2.currentHash);
  });

  it('getTrail retourne entrees ordonnees par sequence_number', async () => {
    const fakeQb = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        { sequenceNumber: 1, eventType: AuditEventType.WORKFLOW_CREATED, evidence: {}, eventTimestamp: new Date(), currentHash: 'h1', prevHash: null, workflowId: WORKFLOW_ID, id: 'a', signerEmail: null, signerIp: null, signerGeoCountry: null },
        { sequenceNumber: 2, eventType: AuditEventType.SIGNER_SIGNED, evidence: {}, eventTimestamp: new Date(), currentHash: 'h2', prevHash: 'h1', workflowId: WORKFLOW_ID, id: 'b', signerEmail: 's@b.ma', signerIp: null, signerGeoCountry: 'MA' },
      ]),
    };
    (repo.createQueryBuilder as ReturnType<typeof vi.fn>).mockReturnValue(fakeQb);

    const trail = await service.getTrail(WORKFLOW_ID);
    expect(trail).toHaveLength(2);
    expect(trail[0].sequenceNumber).toBe(1);
    expect(trail[1].sequenceNumber).toBe(2);
    expect(fakeQb.orderBy).toHaveBeenCalledWith('a.sequence_number', 'ASC');
  });

  it('countByEventType agrege par event_type sur fenetre', async () => {
    const fakeQb = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([
        { event_type: 'workflow_created', cnt: '12' },
        { event_type: 'signer_signed', cnt: '34' },
      ]),
    };
    (repo.createQueryBuilder as ReturnType<typeof vi.fn>).mockReturnValue(fakeQb);

    const result = await service.countByEventType(
      TENANT_ID,
      new Date('2026-01-01'),
      new Date('2026-12-31'),
    );
    expect(result).toEqual({ workflow_created: 12, signer_signed: 34 });
  });

  it('verifyIntegrity delegue a hashChainService', async () => {
    const hashChain = (service as unknown as { hashChainService: AuditHashChainService }).hashChainService;
    (hashChain.verifyChain as ReturnType<typeof vi.fn>).mockResolvedValue({
      workflowId: WORKFLOW_ID,
      isIntegrityValid: true,
      totalEntries: 5,
      verifiedEntries: 5,
      brokenAt: null,
      algorithm: 'SHA-512',
      checkedAt: new Date(),
    });

    const r = await service.verifyIntegrity(WORKFLOW_ID);
    expect(r.isIntegrityValid).toBe(true);
    expect(hashChain.verifyChain).toHaveBeenCalledWith(WORKFLOW_ID);
  });

  it('preserve signer_geo_country fourni si event non SIGNER_SIGNED', async () => {
    setupQueryBuilderMock(null);
    (repo.save as ReturnType<typeof vi.fn>).mockImplementation(async (e) => e);

    const result = await service.logEvent(WORKFLOW_ID, AuditEventType.SIGNER_VIEWED, {
      signer: { email: 'a@b.ma', geoCountry: 'FR' },
      evidence: {},
    });
    expect(result.signerGeoCountry).toBe('FR');
  });
});
```

### 7.14 Test `audit-hash-chain.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getLoggerToken } from 'nestjs-pino';
import { createHash } from 'node:crypto';
import { AuditHashChainService } from './audit-hash-chain.service';
import { SigAuditTrailEntity } from '../entities/sig-audit-trail.entity';

describe('AuditHashChainService', () => {
  let service: AuditHashChainService;
  let repo: Repository<SigAuditTrailEntity>;

  const WORKFLOW_ID = '11111111-1111-1111-1111-111111111111';

  function buildEntry(seq: number, prevHash: string | null, evidence: Record<string, unknown> = {}, ts = new Date('2026-05-08T10:00:00Z')): SigAuditTrailEntity {
    const eventData = {
      workflow_id: WORKFLOW_ID,
      event_type: 'workflow_created',
      event_timestamp: ts.toISOString(),
      evidence,
      sequence_number: seq,
    };
    const currentHash = createHash('sha512')
      .update(prevHash ?? '')
      .update(JSON.stringify(eventData))
      .digest('hex');
    return {
      id: `entry-${seq}`,
      tenantId: 't',
      workflowId: WORKFLOW_ID,
      eventType: 'workflow_created' as never,
      signerId: null,
      signerEmail: null,
      signerIp: null,
      signerUserAgent: null,
      signerGeoCountry: null,
      eventTimestamp: ts,
      evidence,
      prevHash,
      currentHash,
      sequenceNumber: seq,
      hashAlgorithm: 'SHA-512',
      createdAt: ts,
    } as SigAuditTrailEntity;
  }

  beforeEach(async () => {
    const fakeRepo = {
      createQueryBuilder: vi.fn(),
    } as unknown as Repository<SigAuditTrailEntity>;
    const fakeLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditHashChainService,
        { provide: getRepositoryToken(SigAuditTrailEntity), useValue: fakeRepo },
        { provide: getLoggerToken(AuditHashChainService.name), useValue: fakeLogger },
      ],
    }).compile();

    service = moduleRef.get(AuditHashChainService);
    repo = moduleRef.get(getRepositoryToken(SigAuditTrailEntity));
  });

  function mockEntries(entries: SigAuditTrailEntity[]) {
    const qb = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(entries),
    };
    (repo.createQueryBuilder as ReturnType<typeof vi.fn>).mockReturnValue(qb);
  }

  it('computeNextHash retourne hex 128 caracteres', () => {
    const h = service.computeNextHash(null, { foo: 'bar' });
    expect(h).toMatch(/^[0-9a-f]{128}$/);
  });

  it('computeNextHash differe si prev_hash differe', () => {
    const h1 = service.computeNextHash(null, { foo: 'bar' });
    const h2 = service.computeNextHash('a'.repeat(128), { foo: 'bar' });
    expect(h1).not.toBe(h2);
  });

  it('verifyChain valide pour chaine vide', async () => {
    mockEntries([]);
    const r = await service.verifyChain(WORKFLOW_ID);
    expect(r.isIntegrityValid).toBe(true);
    expect(r.totalEntries).toBe(0);
    expect(r.brokenAt).toBeNull();
  });

  it('verifyChain valide pour chaine de 5 entrees coherente', async () => {
    const e1 = buildEntry(1, null, { a: 1 });
    const e2 = buildEntry(2, e1.currentHash, { a: 2 });
    const e3 = buildEntry(3, e2.currentHash, { a: 3 });
    const e4 = buildEntry(4, e3.currentHash, { a: 4 });
    const e5 = buildEntry(5, e4.currentHash, { a: 5 });
    mockEntries([e1, e2, e3, e4, e5]);

    const r = await service.verifyChain(WORKFLOW_ID);
    expect(r.isIntegrityValid).toBe(true);
    expect(r.verifiedEntries).toBe(5);
  });

  it('verifyChain detecte rupture si prev_hash ne matche pas', async () => {
    const e1 = buildEntry(1, null, { a: 1 });
    const e2 = buildEntry(2, e1.currentHash, { a: 2 });
    const tampered = { ...e2, prevHash: 'b'.repeat(128) } as SigAuditTrailEntity;
    mockEntries([e1, tampered]);

    const r = await service.verifyChain(WORKFLOW_ID);
    expect(r.isIntegrityValid).toBe(false);
    expect(r.brokenAt).toBe(2);
    expect(r.verifiedEntries).toBe(1);
  });

  it('verifyChain detecte rupture si current_hash recalcule differe', async () => {
    const e1 = buildEntry(1, null, { a: 1 });
    const tamperedHash = { ...e1, currentHash: 'c'.repeat(128) } as SigAuditTrailEntity;
    mockEntries([tamperedHash]);

    const r = await service.verifyChain(WORKFLOW_ID);
    expect(r.isIntegrityValid).toBe(false);
    expect(r.brokenAt).toBe(1);
  });

  it('verifyChain detecte modification de evidence', async () => {
    const e1 = buildEntry(1, null, { a: 1 });
    const tampered = { ...e1, evidence: { a: 999 } } as SigAuditTrailEntity;
    mockEntries([tampered]);
    const r = await service.verifyChain(WORKFLOW_ID);
    expect(r.isIntegrityValid).toBe(false);
  });

  it('isChainValid helper retourne booleen', async () => {
    const e1 = buildEntry(1, null, {});
    mockEntries([e1]);
    expect(await service.isChainValid(WORKFLOW_ID)).toBe(true);
  });

  it('verifyChain stoppe au premier brisement', async () => {
    const e1 = buildEntry(1, null, { a: 1 });
    const e2 = buildEntry(2, e1.currentHash, { a: 2 });
    const broken3 = { ...buildEntry(3, e2.currentHash, { a: 3 }), currentHash: 'x'.repeat(128) } as SigAuditTrailEntity;
    const e4 = buildEntry(4, broken3.currentHash, { a: 4 });
    mockEntries([e1, e2, broken3, e4]);

    const r = await service.verifyChain(WORKFLOW_ID);
    expect(r.brokenAt).toBe(3);
    expect(r.verifiedEntries).toBe(2);
  });

  it('verifyChain accepte chaine de 100 entrees', async () => {
    const entries: SigAuditTrailEntity[] = [];
    let prev: string | null = null;
    for (let i = 1; i <= 100; i++) {
      const e = buildEntry(i, prev, { idx: i });
      entries.push(e);
      prev = e.currentHash;
    }
    mockEntries(entries);
    const r = await service.verifyChain(WORKFLOW_ID);
    expect(r.isIntegrityValid).toBe(true);
    expect(r.verifiedEntries).toBe(100);
  });

  it('verifyChain retourne algorithm SHA-512 par defaut', async () => {
    mockEntries([]);
    const r = await service.verifyChain(WORKFLOW_ID);
    expect(r.algorithm).toBe('SHA-512');
  });
});
```

### 7.15 Test `audit-trail-pdf.service.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getLoggerToken } from 'nestjs-pino';
import { AuditTrailPdfService } from './audit-trail-pdf.service';
import { AuditTrailService } from './audit-trail.service';
import { AuditHashChainService } from './audit-hash-chain.service';
import { PdfGeneratorService } from '@skalean/docs/services/pdf-generator.service';
import { TsaService } from './tsa.service';
import { SignatureWorkflowService } from './signature-workflow.service';
import { AuditEventType } from '../types/audit-event-type.enum';

describe('AuditTrailPdfService', () => {
  let service: AuditTrailPdfService;
  let pdfGen: PdfGeneratorService;
  let tsa: TsaService;
  let workflowService: SignatureWorkflowService;
  let auditTrail: AuditTrailService;
  let hashChain: AuditHashChainService;

  const WORKFLOW_ID = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    const fakePdf = { generateFromTemplate: vi.fn().mockResolvedValue(Buffer.from('PDF-RAW')) };
    const fakeTsa = { timestampDocument: vi.fn().mockResolvedValue({ signedDocument: Buffer.from('PDF-TSA'), tokenSerial: 'TS-001' }) };
    const fakeWorkflow = { getById: vi.fn().mockResolvedValue({ id: WORKFLOW_ID, title: 'Contrat Auto', documentHash: 'h'.repeat(128), status: 'completed', createdAt: new Date('2026-05-01') }) };
    const fakeAudit = { getTrail: vi.fn().mockResolvedValue([
      { sequenceNumber: 1, eventType: AuditEventType.WORKFLOW_CREATED, evidence: {}, eventTimestamp: new Date(), currentHash: 'h1', prevHash: null, signerEmail: null, signerIp: null, signerGeoCountry: null, workflowId: WORKFLOW_ID, id: 'a' },
      { sequenceNumber: 2, eventType: AuditEventType.SIGNER_SIGNED, evidence: {}, eventTimestamp: new Date(), currentHash: 'h2', prevHash: 'h1', signerEmail: 's@b.ma', signerIp: '197.45.0.1', signerGeoCountry: 'MA', workflowId: WORKFLOW_ID, id: 'b' },
    ]), logEvent: vi.fn() };
    const fakeChain = { verifyChain: vi.fn().mockResolvedValue({ workflowId: WORKFLOW_ID, totalEntries: 2, verifiedEntries: 2, brokenAt: null, isIntegrityValid: true, algorithm: 'SHA-512', checkedAt: new Date() }) };
    const fakeLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuditTrailPdfService,
        { provide: PdfGeneratorService, useValue: fakePdf },
        { provide: TsaService, useValue: fakeTsa },
        { provide: SignatureWorkflowService, useValue: fakeWorkflow },
        { provide: AuditTrailService, useValue: fakeAudit },
        { provide: AuditHashChainService, useValue: fakeChain },
        { provide: getLoggerToken(AuditTrailPdfService.name), useValue: fakeLogger },
      ],
    }).compile();

    service = moduleRef.get(AuditTrailPdfService);
    pdfGen = moduleRef.get(PdfGeneratorService);
    tsa = moduleRef.get(TsaService);
    workflowService = moduleRef.get(SignatureWorkflowService);
    auditTrail = moduleRef.get(AuditTrailService);
    hashChain = moduleRef.get(AuditHashChainService);
  });

  it('genere PDF FR avec template par defaut', async () => {
    const buf = await service.generatePdfTrail(WORKFLOW_ID);
    expect(buf).toBeInstanceOf(Buffer);
    expect(pdfGen.generateFromTemplate).toHaveBeenCalledWith('audit-trail', expect.any(Object), expect.objectContaining({ direction: 'ltr' }));
  });

  it('genere PDF AR avec template ar/audit-trail RTL', async () => {
    await service.generatePdfTrail(WORKFLOW_ID, { language: 'ar', includeTsaTimestamp: false, includeIntegrityCheck: true });
    expect(pdfGen.generateFromTemplate).toHaveBeenCalledWith('ar/audit-trail', expect.any(Object), expect.objectContaining({ direction: 'rtl' }));
  });

  it('applique TSA si includeTsaTimestamp=true', async () => {
    const buf = await service.generatePdfTrail(WORKFLOW_ID);
    expect(tsa.timestampDocument).toHaveBeenCalled();
    expect(buf.toString()).toBe('PDF-TSA');
  });

  it('skip TSA si includeTsaTimestamp=false', async () => {
    const buf = await service.generatePdfTrail(WORKFLOW_ID, { language: 'fr', includeTsaTimestamp: false, includeIntegrityCheck: true });
    expect(tsa.timestampDocument).not.toHaveBeenCalled();
    expect(buf.toString()).toBe('PDF-RAW');
  });

  it('inclut verification chaine si includeIntegrityCheck=true', async () => {
    await service.generatePdfTrail(WORKFLOW_ID);
    expect(hashChain.verifyChain).toHaveBeenCalledWith(WORKFLOW_ID);
  });

  it('skip verification si includeIntegrityCheck=false', async () => {
    await service.generatePdfTrail(WORKFLOW_ID, { language: 'fr', includeTsaTimestamp: true, includeIntegrityCheck: false });
    expect(hashChain.verifyChain).not.toHaveBeenCalled();
  });

  it('lance evenement AUDIT_TRAIL_GENERATED apres generation', async () => {
    await service.generatePdfTrail(WORKFLOW_ID);
    expect(auditTrail.logEvent).toHaveBeenCalledWith(WORKFLOW_ID, AuditEventType.AUDIT_TRAIL_GENERATED, expect.any(Object));
  });

  it('rejette si workflow inexistant', async () => {
    (workflowService.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    await expect(service.generatePdfTrail(WORKFLOW_ID)).rejects.toThrow(/introuvable/);
  });

  it('rejette si PDF > 50 MB', async () => {
    const big = Buffer.alloc(51 * 1024 * 1024);
    (pdfGen.generateFromTemplate as ReturnType<typeof vi.fn>).mockResolvedValue(big);
    await expect(service.generatePdfTrail(WORKFLOW_ID)).rejects.toThrow(/trop volumineux/);
  });
});
```

### 7.16 Test E2E `audit-trail.e2e-spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { TenantContext } from '@skalean/auth/context/tenant.context';
import { AuditTrailService } from '@skalean/signature/services/audit-trail.service';
import { AuditEventType } from '@skalean/signature/types/audit-event-type.enum';
import { SigAuditTrailEntity } from '@skalean/signature/entities/sig-audit-trail.entity';

describe('AuditTrail E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let auditService: AuditTrailService;
  let token: string;

  const TENANT_ID = '00000000-0000-0000-0000-000000000099';
  const OTHER_TENANT_ID = '00000000-0000-0000-0000-000000000888';
  const WORKFLOW_ID = '22222222-2222-2222-2222-222222222222';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    auditService = app.get(AuditTrailService);

    await dataSource.query(
      `INSERT INTO auth_tenants (id, name, created_at) VALUES ($1, $2, NOW()), ($3, $4, NOW()) ON CONFLICT DO NOTHING`,
      [TENANT_ID, 'tenant-test', OTHER_TENANT_ID, 'tenant-other'],
    );
    await dataSource.query(
      `INSERT INTO sig_signing_workflows (id, tenant_id, title, document_hash, status, created_at) VALUES ($1, $2, $3, $4, 'created', NOW()) ON CONFLICT DO NOTHING`,
      [WORKFLOW_ID, TENANT_ID, 'Contrat Test', 'h'.repeat(128)],
    );
    token = await loginTestUser(app, TENANT_ID, ['signature.audit_trail.read']);
  });

  afterAll(async () => {
    await dataSource.query(`DELETE FROM sig_signing_workflows WHERE id = $1`, [WORKFLOW_ID]);
    await dataSource.query(`DELETE FROM auth_tenants WHERE id IN ($1, $2)`, [TENANT_ID, OTHER_TENANT_ID]);
    await app.close();
  });

  it('GET /audit-trail retourne 404 si aucune entree', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/signature/workflows/${WORKFLOW_ID}/audit-trail`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('logEvent persiste evenement et GET /audit-trail le retourne', async () => {
    await TenantContext.runWithTenant(TENANT_ID, async () => {
      await auditService.logEvent(WORKFLOW_ID, AuditEventType.WORKFLOW_CREATED, { evidence: { source: 'e2e' } });
    });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/signature/workflows/${WORKFLOW_ID}/audit-trail`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.totalEntries).toBe(1);
    expect(res.body.entries[0].sequenceNumber).toBe(1);
  });

  it('UPDATE direct rejete par RLS / trigger', async () => {
    await expect(
      dataSource.query(
        `UPDATE sig_audit_trails SET evidence = '{"hacked":true}' WHERE workflow_id = $1`,
        [WORKFLOW_ID],
      ),
    ).rejects.toThrow();
  });

  it('DELETE direct rejete par RLS / trigger', async () => {
    await expect(
      dataSource.query(`DELETE FROM sig_audit_trails WHERE workflow_id = $1`, [WORKFLOW_ID]),
    ).rejects.toThrow();
  });

  it('TRUNCATE rejete par REVOKE', async () => {
    await expect(
      dataSource.query(`TRUNCATE TABLE sig_audit_trails`),
    ).rejects.toThrow();
  });

  it('verifyIntegrity retourne valid pour chaine non corrompue', async () => {
    await TenantContext.runWithTenant(TENANT_ID, async () => {
      await auditService.logEvent(WORKFLOW_ID, AuditEventType.SIGNER_VIEWED, { evidence: {} });
      await auditService.logEvent(WORKFLOW_ID, AuditEventType.SIGNER_SIGNED, { evidence: {}, signer: { email: 's@b.ma' } });
    });
    const res = await request(app.getHttpServer())
      .get(`/api/v1/signature/workflows/${WORKFLOW_ID}/audit-trail/verify`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.isIntegrityValid).toBe(true);
  });

  it('GET /audit-trail/pdf telecharge PDF', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/signature/workflows/${WORKFLOW_ID}/audit-trail/pdf`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .responseType('blob');
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('audit-trail-');
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it('isolation tenant: tenant B ne voit pas trail tenant A', async () => {
    const otherToken = await loginTestUser(app, OTHER_TENANT_ID, ['signature.audit_trail.read']);
    await request(app.getHttpServer())
      .get(`/api/v1/signature/workflows/${WORKFLOW_ID}/audit-trail`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
  });

  it('rejette sans permission signature.audit_trail.read', async () => {
    const noPermToken = await loginTestUser(app, TENANT_ID, []);
    await request(app.getHttpServer())
      .get(`/api/v1/signature/workflows/${WORKFLOW_ID}/audit-trail`)
      .set('Authorization', `Bearer ${noPermToken}`)
      .expect(403);
  });

  it('idempotency webhook event_id - pas de doublon', async () => {
    await TenantContext.runWithTenant(TENANT_ID, async () => {
      await auditService.logEvent(WORKFLOW_ID, AuditEventType.WEBHOOK_RECEIVED, { evidence: { event_id: 'wh-unique-1' } });
      await auditService.logEvent(WORKFLOW_ID, AuditEventType.WEBHOOK_RECEIVED, { evidence: { event_id: 'wh-unique-1' } });
    });
    const count = await dataSource.query(
      `SELECT COUNT(*)::int AS c FROM sig_audit_trails WHERE workflow_id = $1 AND evidence->>'event_id' = 'wh-unique-1'`,
      [WORKFLOW_ID],
    );
    expect(count[0].c).toBe(1);
  });

  it('CHECK CONSTRAINT rejette evidence > 100 KB', async () => {
    const huge = 'x'.repeat(110000);
    await expect(
      TenantContext.runWithTenant(TENANT_ID, async () => {
        await auditService.logEvent(WORKFLOW_ID, AuditEventType.MANUAL_INTERVENTION, { evidence: { payload: huge } });
      }),
    ).rejects.toThrow();
  });
});

async function loginTestUser(app: INestApplication, tenantId: string, perms: string[]): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/test-login')
    .send({ tenantId, permissions: perms });
  return res.body.access_token;
}
```

### 7.17 Test controller `audit-trail.controller.spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuditTrailController } from './audit-trail.controller';
import { AuditTrailService } from '@skalean/signature/services/audit-trail.service';
import { AuditTrailPdfService } from '@skalean/signature/services/audit-trail-pdf.service';
import { NotFoundException } from '@nestjs/common';

describe('AuditTrailController', () => {
  let controller: AuditTrailController;
  let auditService: AuditTrailService;
  let pdfService: AuditTrailPdfService;
  const WORKFLOW_ID = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    const fakeAudit = {
      getTrail: vi.fn(),
      verifyIntegrity: vi.fn(),
    };
    const fakePdf = {
      generatePdfTrail: vi.fn(),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuditTrailController],
      providers: [
        { provide: AuditTrailService, useValue: fakeAudit },
        { provide: AuditTrailPdfService, useValue: fakePdf },
      ],
    })
      .overrideGuard(class { canActivate = () => true; })
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(AuditTrailController);
    auditService = moduleRef.get(AuditTrailService);
    pdfService = moduleRef.get(AuditTrailPdfService);
  });

  it('getTrail retourne entrees', async () => {
    (auditService.getTrail as ReturnType<typeof vi.fn>).mockResolvedValue([{ sequenceNumber: 1 }]);
    const r = await controller.getTrail(WORKFLOW_ID);
    expect(r.totalEntries).toBe(1);
  });

  it('getTrail throws 404 si vide', async () => {
    (auditService.getTrail as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await expect(controller.getTrail(WORKFLOW_ID)).rejects.toThrow(NotFoundException);
  });

  it('downloadPdf set headers corrects', async () => {
    (pdfService.generatePdfTrail as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('PDF'));
    const fakeRes = { status: vi.fn().mockReturnThis(), setHeader: vi.fn(), end: vi.fn() } as never;
    await controller.downloadPdf(WORKFLOW_ID, 'fr', fakeRes);
    expect(fakeRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(fakeRes.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      expect.stringContaining(`audit-trail-${WORKFLOW_ID}.pdf`),
    );
  });

  it('downloadPdf langue ar passe option language=ar', async () => {
    (pdfService.generatePdfTrail as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from('PDF'));
    const fakeRes = { status: vi.fn().mockReturnThis(), setHeader: vi.fn(), end: vi.fn() } as never;
    await controller.downloadPdf(WORKFLOW_ID, 'ar', fakeRes);
    expect(pdfService.generatePdfTrail).toHaveBeenCalledWith(WORKFLOW_ID, expect.objectContaining({ language: 'ar' }));
  });

  it('verifyIntegrity delegue au service', async () => {
    (auditService.verifyIntegrity as ReturnType<typeof vi.fn>).mockResolvedValue({ isIntegrityValid: true });
    const r = await controller.verifyIntegrity(WORKFLOW_ID);
    expect(r.isIntegrityValid).toBe(true);
  });
});
```

## 8. Tests complets

Voir sections 7.13 a 7.17 pour les tests unitaires et E2E. Resume :

| Suite | Fichier | Cas |
|---|---|---|
| AuditTrailService | `audit-trail.service.spec.ts` | 15 |
| AuditHashChainService | `audit-hash-chain.service.spec.ts` | 11 |
| AuditTrailPdfService | `audit-trail-pdf.service.spec.ts` | 9 |
| AuditTrailController | `audit-trail.controller.spec.ts` | 5 |
| AuditTrail E2E | `audit-trail.e2e-spec.ts` | 11 |
| **Total** | | **51** |

Couverture cible : ligne >= 92%, branche >= 88%, fonction >= 95% (mesure via Vitest c8).

## 9. Variables environnement

Ajouter dans `apps/api/.env.example` :

```env
# Audit Trail Signature Loi 43-20
AUDIT_TRAIL_HASH_ALGORITHM=SHA-512
AUDIT_TRAIL_PDF_LANG_DEFAULT=fr
AUDIT_TRAIL_RETENTION_DAYS=3651
AUDIT_TRAIL_GEO_LOOKUP_ENABLED=true
AUDIT_TRAIL_GEO_LOOKUP_PROVIDER=maxmind
AUDIT_TRAIL_GEO_DB_PATH=/var/lib/maxmind/GeoLite2-Country.mmdb
AUDIT_TRAIL_GEO_LOOKUP_TIMEOUT_MS=100
AUDIT_TRAIL_PDF_MAX_BYTES=52428800
AUDIT_TRAIL_KAFKA_TOPIC=signature.audit.events.v1
AUDIT_TRAIL_KAFKA_GROUP=audit-trail-cg
```

Ajouter validation Zod dans `apps/api/src/config/env.schema.ts` :

```typescript
AUDIT_TRAIL_HASH_ALGORITHM: z.enum(['SHA-512', 'SHA3-512']).default('SHA-512'),
AUDIT_TRAIL_PDF_LANG_DEFAULT: z.enum(['fr', 'ar', 'en']).default('fr'),
AUDIT_TRAIL_RETENTION_DAYS: z.coerce.number().int().min(3651).default(3651),
AUDIT_TRAIL_GEO_LOOKUP_ENABLED: z.coerce.boolean().default(true),
AUDIT_TRAIL_GEO_LOOKUP_PROVIDER: z.enum(['maxmind', 'ipinfo', 'none']).default('maxmind'),
AUDIT_TRAIL_GEO_DB_PATH: z.string().optional(),
AUDIT_TRAIL_GEO_LOOKUP_TIMEOUT_MS: z.coerce.number().int().min(50).max(2000).default(100),
AUDIT_TRAIL_PDF_MAX_BYTES: z.coerce.number().int().default(52428800),
AUDIT_TRAIL_KAFKA_TOPIC: z.string().default('signature.audit.events.v1'),
AUDIT_TRAIL_KAFKA_GROUP: z.string().default('audit-trail-cg'),
```

## 10. Commandes shell

```bash
# Generer la migration TypeORM
pnpm --filter @skalean/database typeorm migration:create src/migrations/SigAuditTrails

# Executer la migration en local
pnpm --filter @skalean/database typeorm migration:run -- -d src/data-source.ts

# Verifier le RLS append-only au niveau SQL
psql $DATABASE_URL -c "SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'sig_audit_trails'::regclass;"

# Verifier que UPDATE est bloque
psql $DATABASE_URL -c "SET ROLE app_user; UPDATE sig_audit_trails SET evidence = '{}' WHERE id IN (SELECT id FROM sig_audit_trails LIMIT 1);" 2>&1 | grep -i "interdite\|denied"

# Lancer les tests unitaires
pnpm --filter @skalean/signature test -- audit-trail
pnpm --filter @skalean/signature test -- audit-hash-chain
pnpm --filter @skalean/signature test -- audit-trail-pdf

# Lancer les tests E2E
pnpm --filter @skalean/api-e2e test -- audit-trail.e2e-spec

# Coverage
pnpm --filter @skalean/signature test:coverage

# Verification typecheck + lint pre-commit
pnpm typecheck
pnpm lint --filter @skalean/signature
pnpm lint --filter @skalean/api

# Recherche emoji (decision-006)
rg -P '[\p{Emoji_Presentation}\p{Extended_Pictographic}]' packages/signature packages/docs apps/api/src/modules/signature

# Recherche console.log (interdit)
rg -n 'console\.(log|debug|info|warn|error)' packages/signature/src apps/api/src/modules/signature
```

## 11. Criteres validation V1-V31

| ID | Critere | Commande | Resultat attendu |
|---|---|---|---|
| V1 | Migration applicable sans erreur | `pnpm typeorm migration:run` | OK applied SigAuditTrails20260508120000 |
| V2 | Migration reversible | `pnpm typeorm migration:revert` | OK reverted, table absente |
| V3 | Type ENUM cree | `psql -c "\dT+ sig_audit_event_type"` | 15 valeurs listees |
| V4 | Table avec 16 colonnes | `psql -c "\d sig_audit_trails"` | id, tenant_id, ..., hash_algorithm, created_at |
| V5 | Index workflow_seq present | `psql -c "\di idx_audit_workflow_seq*"` | 2 lignes (idx + idx_unique) |
| V6 | Index tenant_event present | `psql -c "\di idx_audit_tenant_event"` | 1 ligne |
| V7 | RLS active | `psql -c "SELECT relrowsecurity FROM pg_class WHERE relname='sig_audit_trails'"` | t |
| V8 | RLS forcee (FORCE) | `psql -c "SELECT relforcerowsecurity FROM pg_class WHERE relname='sig_audit_trails'"` | t |
| V9 | Policy SELECT existe | `psql -c "SELECT polname FROM pg_policy WHERE polrelid='sig_audit_trails'::regclass AND polcmd='r'"` | tenant_select |
| V10 | Policy INSERT existe | `psql -c "SELECT polname FROM pg_policy WHERE polrelid='sig_audit_trails'::regclass AND polcmd='a'"` | tenant_insert |
| V11 | Aucune policy UPDATE | `psql -c "SELECT count(*) FROM pg_policy WHERE polrelid='sig_audit_trails'::regclass AND polcmd='w'"` | 0 |
| V12 | Aucune policy DELETE | `psql -c "SELECT count(*) FROM pg_policy WHERE polrelid='sig_audit_trails'::regclass AND polcmd='d'"` | 0 |
| V13 | UPDATE rejete (trigger) | UPDATE direct via app_user | ERROR 42501 "interdite" |
| V14 | DELETE rejete (trigger) | DELETE direct via app_user | ERROR 42501 "interdite" |
| V15 | TRUNCATE rejete (REVOKE) | TRUNCATE via app_user | ERROR insufficient privilege |
| V16 | INSERT autorise meme tenant | INSERT avec tenant_id correct | OK 1 ligne |
| V17 | INSERT rejete autre tenant | INSERT avec tenant_id different | ERROR new row violates RLS |
| V18 | Hash chain integre 100 entrees | Test unitaire `verifyChain` 100 entries | isIntegrityValid: true |
| V19 | Hash chain detecte tampering evidence | Modifier evidence puis verifyChain | isIntegrityValid: false, brokenAt > 0 |
| V20 | Sequence_number unique par workflow | INSERT 2x meme seq | ERROR 23505 unique violation |
| V21 | Idempotency webhook event_id | INSERT 2x meme event_id | 1 ligne en base |
| V22 | Check constraint evidence < 100 KB | INSERT evidence > 100 KB | ERROR check constraint chk_evidence_size |
| V23 | GET endpoint trail retourne JSON | curl GET /audit-trail | 200 OK avec totalEntries |
| V24 | GET endpoint pdf retourne PDF | curl GET /audit-trail/pdf | 200 + Content-Type application/pdf |
| V25 | GET endpoint verify retourne integrity | curl GET /audit-trail/verify | 200 + isIntegrityValid |
| V26 | Permission signature.audit_trail.read enforce | curl sans permission | 403 Forbidden |
| V27 | Isolation tenant via JWT | curl avec token autre tenant | 404 Not Found |
| V28 | Consumer Kafka demarre | logs application | "audit.consumer.started" |
| V29 | Consumer Kafka persiste evenement | publish event puis SELECT | 1 ligne en base |
| V30 | PDF horodate par TSA Barid | extraire jeton TSA du PDF | token serial present |
| V31 | Aucun emoji dans templates HBS | rg emoji packages/docs/src/templates | 0 match |

## 12. Edge cases

1. **UPDATE attempt rejected by RLS+trigger** : tentative `UPDATE sig_audit_trails SET evidence='{}'` echoue avec `ERROR 42501 - operation UPDATE interdite sur sig_audit_trails (append-only loi 43-20 art.9)`. Test V13 valide ce comportement.

2. **DELETE attempt rejected** : tentative `DELETE FROM sig_audit_trails WHERE id=?` echoue avec meme erreur trigger. Test V14.

3. **SUPERUSER bypass attempt detected** : si un attaquant compromet le superuser et tente UPDATE, le trigger l'interceptera quand meme (les triggers s'appliquent aux superusers). Si l'attaquant DROP le trigger d'abord, la chaine de hash reste compromise et `verifyChain` detecte l'anomalie post-mortem. Mitigation : monitoring `pg_stat_user_tables` n_tup_upd doit rester a 0.

4. **Hash chain broken (corruption detection)** : si l'attaquant modifie une cellule directement via `pg_class` ou pg_dump+pg_restore, le `current_hash` ne correspondra plus au recalcul. `verifyChain` retourne `brokenAt: <position>` permettant de remonter au point d'intrusion.

5. **Concurrent INSERT same workflow_id (sequence collision)** : deux processus lisent `lastEntry.sequence_number = 5` simultanement et tentent d'inserer 6. Sans verrou, les deux INSERT seraient acceptes, l'un avec hash incorrect. Mitigation : `SELECT ... FOR UPDATE` (pessimistic_write) prend un row-level lock sur l'entree 5, le second processus attend la commit du premier puis relit la nouvelle valeur 6 et calcule 7. Test concurrent 50 inserts paralleles validait integrite.

6. **Evidence JSONB > 100 KB** : check constraint `chk_evidence_size` rejette avec ERROR 23514. Mitigation cote service : truncation avec field `evidence_truncated: true` si depassement detecte avant INSERT.

7. **Signer IP IPv6** : type `INET` accepte IPv6 (par exemple `2a01:e0a:abc::1`). Aucune transformation. Geo lookup MaxMind GeoLite2 supporte IPv4+IPv6.

8. **Geo lookup failed (timeout 100ms)** : fallback `null` enregistre dans `signer_geo_country`. Le PDF affiche `-`. Test geo timeout valide ce fallback.

9. **Audit trail PDF too large > 50 pages** : verification `pdfBuffer.length > 50 MB` declenche erreur applicative. Cote UI, fallback vers export CSV propose. Limite metier : un workflow > 30 evenements doit etre revu (anomalie potentielle).

10. **Workflow_id deleted (cascade impact)** : la FK utilise `ON DELETE RESTRICT` (pas CASCADE). Tenter de supprimer un workflow ayant des entries audit echoue avec `foreign_key_violation`. Compliance : un workflow signe ne doit JAMAIS etre supprime, conformement a l'article 11 loi 43-20.

11. **Tenant_id cascade DELETE preserved** : la FK tenant_id utilise `ON DELETE RESTRICT`. Suppression d'un tenant impossible tant qu'il existe des audit trails. Pour offboarding tenant, processus manuel : (a) export legal des audit trails (b) demande au DPO d'autoriser purge (c) script DBA execute purge avec audit trace dans audit_admin_actions table separee. Decision-011 documente cette exception au droit a l'oubli CNDP.

12. **Webhook duplicate event creates duplicate audit (idempotency)** : index unique partial sur `(workflow_id, evidence->>'event_id')` quand non-null prevent doublons. Test V21 valide.

13. **TSA timestamp event ordering** : check applicatif dans `AuditTrailService.logEvent()` verifie qu'un event `tsa_timestamp_applied` n'arrive que apres au moins un `signer_signed`. Si incoherence, log warn `audit.event.suspicious_ordering` mais persiste quand meme (audit ne doit jamais perdre d'evenement).

14. **Hash algorithm migration future** : colonne `hash_algorithm` permet co-existence SHA-512 et SHA3-512. `verifyChain` lit cette colonne et utilise l'algorithme correspondant.

## 13. Conformite Maroc detaillee

### 13.1 Loi 43-20 article 9 - Audit trail preuve numerique opposable

L'article 9 de la loi 43-20 sur la confiance numerique dispose que la preuve numerique d'une
signature electronique est constituee par "l'ensemble des elements techniques permettant
d'identifier de maniere certaine le signataire et de garantir l'integrite de l'acte signe".
Cet article exige explicitement la conservation des **traces techniques** (timestamps, adresses
IP, user-agents, jetons d'authentification) pendant la duree legale de conservation du contrat
(10 ans pour les contrats d'assurance MA). La table `sig_audit_trails` materialise cette
exigence au niveau infrastructure.

### 13.2 ACAPS Circulaire 2018/01 article 9 - Tracabilite signatures obligatoire

L'Autorite de Controle des Assurances et de la Prevoyance Sociale (ACAPS) a publie en 2018 la
Circulaire 2018/01 qui complete la loi 17-99 sur les assurances. L'article 9 impose aux
operateurs d'assurance la tracabilite **integrale et infalsifiable** de toute signature
electronique de contrat, avec capacite de production sur demande de l'autorite. Le PDF audit
trail de la presente tache constitue le format standard de production attendu lors d'un
controle ACAPS.

### 13.3 CNDP Loi 09-08 article 13 - Integrite des journaux d'audit

La Commission Nationale de Controle de la Protection des Donnees Personnelles (CNDP) impose
via l'article 13 de la loi 09-08 que tout traitement automatise contenant des donnees
personnelles dispose de **journaux d'audit dont l'integrite est techniquement garantie**.
Le hash chain SHA-512 satisfait cette exigence. La conservation 10 ans des audit trails
contenant des donnees personnelles (email, IP, geo) constitue une **exception au droit a
l'oubli** justifiee par "obligation legale imperieuse" (loi 43-20 prime), documentee dans
le registre des traitements article 30 GDPR / equivalent CNDP.

### 13.4 ETSI EN 319 122 - CAdES Long Term Validation

Le standard europeen ETSI EN 319 122 definit le format CAdES (CMS Advanced Electronic
Signature) avec extension LTV (Long Term Validation). L'horodatage TSA du PDF audit trail
par TSA Barid eSign satisfait le profil **CAdES-LT** (Long Term avec preuves de validite).
Le profil **CAdES-LTA** (Long Term Archived) sera atteint par le ré-horodatage periodique
tous les 5 ans (mecanisme implementer en Tache 3.3.18).

### 13.5 Code de procedure civile MA article 417-4 - Preuve electronique recevable

L'article 417-4 du Code de procedure civile marocain (Dahir 1-74-447 modifie par Loi 53-05)
dispose que "la preuve electronique est recevable au meme titre que la preuve sur support
papier, sous reserve qu'elle soit etablie de maniere a en garantir l'integrite et a en
identifier l'auteur". Le PDF audit trail horodate TSA satisfait ces deux conditions.

### 13.6 Decret 2-08-518 - Cle privee dans le territoire MA

Le decret 2-08-518 du 21 mai 2009 application loi 53-05 impose que les cles privees de
signature des prestataires soient conservees physiquement sur le territoire marocain. La
TSA Barid eSign dont nous utilisons les jetons est conforme. Les hashs des audit trails
sont stockes dans la base hebergee region MA (decision-008 cloud souverain), garantissant
souverainete numerique complete.

## 14. Conventions absolues skalean-insurtech

1. **Multi-tenant strict** : toute table inclut `tenant_id UUID NOT NULL` avec FK `auth_tenants(id)`,
   RLS activee, policies basees sur `app_current_tenant()`. Aucune requete cross-tenant possible.

2. **Validation Zod runtime** : tous les inputs (DTO HTTP, Kafka payloads, env vars) sont valides
   par schemas Zod avant traitement. Voir `AuditDetailsSchema` et `SignatureAuditEventSchema`.

3. **Logging Pino structure** : aucun `console.log/info/warn/error`, exclusivement
   `PinoLogger` injecte. Format JSON avec champs `tenantId`, `workflowId`, `traceId`, niveau
   structure (info pour succes, warn pour anomalie reversible, error pour echec).

4. **Hashing argon2id** : pour les passwords et secrets sensibles, jamais bcrypt/PBKDF2/MD5/SHA-1.
   Pour les hashs de chaine d'audit, SHA-512 est acceptable (usage non-secret, integrite seule).

5. **Package manager pnpm** : aucun npm install ni yarn add, exclusivement
   `pnpm add --filter @skalean/<package>`. Workspace defini dans `pnpm-workspace.yaml`.

6. **TypeScript strict** : `tsconfig.json` avec `strict: true`, `noUncheckedIndexedAccess: true`,
   `exactOptionalPropertyTypes: true`. Aucun `any` non justifie commentaire.

7. **Tests Vitest + 80% couverture** : couverture minimale lignes 80% / branches 75% /
   fonctions 90%. Cible cette tache 92% / 88% / 95%.

8. **RBAC permissions explicites** : tout endpoint REST decore `@Permissions('module.resource.action')`.
   Cette tache ajoute `signature.audit_trail.read` au registre.

9. **Kafka events versionnes** : tout topic Kafka inclut version dans le nom (`v1`, `v2`).
   Schemas events documentes dans `packages/contracts/src/kafka/`.

10. **Decision-006 NO-EMOJI** : aucun emoji dans le code, les commentaires, les templates HBS,
    les logs, les commits. Verification automatique via grep `[\p{Emoji_Presentation}]`.

11. **Idempotency** : tous les handlers Kafka et webhooks sont idempotents via deduplication
    sur `event_id` (cf section 12 point 12).

12. **Conventional commits** : format `feat(sprint-N): <description>` / `fix(sprint-N): ...` /
    `chore(sprint-N): ...`. Body explicatif obligatoire pour P0/P1.

13. **Decision-008 cloud souverain MA** : aucune donnee transite hors du territoire MA.
    Audit trails stockes Postgres region MA, sauvegardes croisees Casablanca-Rabat, jamais
    repliquees vers AWS US/EU.

14. **Conformite legale 9 lois MA** : loi 43-20 (confiance numerique), loi 09-08 (CNDP), loi 17-99
    (assurances), Circulaire ACAPS 2018/01, Code procedure civile art. 417-4, decret 2-08-518
    (cles MA), loi 53-05 (e-commerce), loi 31-08 (consommation), Code de commerce art. 65-1
    (preuve commerciale electronique). Cette tache satisfait directement les 5 premieres et
    indirectement les 4 dernieres.

## 15. Validation pre-commit

Pipeline `pre-commit` (`.husky/pre-commit`) execute :

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

set -e

echo "[1/5] TypeScript typecheck..."
pnpm typecheck

echo "[2/5] ESLint..."
pnpm lint --filter @skalean/signature --filter @skalean/api

echo "[3/5] Vitest unit tests (changed files)..."
pnpm test --filter @skalean/signature --changed

echo "[4/5] Verification no-emoji (decision-006)..."
if rg -P '[\p{Emoji_Presentation}\p{Extended_Pictographic}]' \
    packages/signature/src packages/docs/src/templates apps/api/src/modules/signature; then
  echo "ERREUR : emoji detecte (decision-006 interdit)"
  exit 1
fi

echo "[5/5] Verification no-console..."
if rg -n 'console\.(log|debug|info|warn|error)' \
    packages/signature/src apps/api/src/modules/signature/{controllers,consumers}; then
  echo "ERREUR : console.* detecte (utiliser PinoLogger)"
  exit 1
fi

echo "OK pre-commit valide"
```

## 16. Commit message complet

```
feat(sprint-10): audit trails immutable append-only + hash chain SHA-512 + PDF juridique

Implemente la tache 3.3.10 du Sprint 10 / Phase 3 (Modules Horizontaux) - Reference B-10.

Migration sig_audit_trails append-only enforced niveau base de donnees :
- ENUM sig_audit_event_type (15 valeurs)
- Table sig_audit_trails avec colonnes id, tenant_id, workflow_id, event_type,
  signer_id, signer_email, signer_ip (INET), signer_user_agent, signer_geo_country,
  event_timestamp, evidence (JSONB), prev_hash, current_hash, sequence_number,
  hash_algorithm, created_at
- 5 indexes (workflow_seq, tenant_event, signer_email partial, workflow_seq_unique,
  webhook_idem partial)
- RLS activee avec policies SELECT et INSERT uniquement (pas UPDATE pas DELETE)
- REVOKE UPDATE, DELETE, TRUNCATE FROM PUBLIC + app_user
- Trigger BEFORE UPDATE OR DELETE qui leve EXCEPTION 42501

Service AuditTrailService :
- logEvent() avec verrou pessimiste SELECT FOR UPDATE pour anti-race
- getTrail() ordonne par sequence_number ASC
- verifyIntegrity() delegue au hash chain service
- countByEventType() agregation periode
- Geo IP lookup MaxMind avec timeout 100ms et fallback null

Service AuditHashChainService :
- computeNextHash() SHA-512 deterministe
- verifyChain() parcours et recalcul hash chaine
- isChainValid() helper booleen

Service AuditTrailPdfService :
- Generation PDF FR + AR via PdfGeneratorService
- Templates Handlebars audit-trail.hbs + ar/audit-trail.hbs (RTL)
- Horodatage TSA Barid eSign automatique
- Limite 50 MB
- Auto-log evenement AUDIT_TRAIL_GENERATED

Controller :
- GET /api/v1/signature/workflows/:id/audit-trail (JSON timeline)
- GET /api/v1/signature/workflows/:id/audit-trail/pdf (PDF download)
- GET /api/v1/signature/workflows/:id/audit-trail/verify (integrite)
- Permission signature.audit_trail.read

Consumer Kafka AuditTrailListenerConsumer :
- Topic signature.audit.events.v1
- GroupId audit-trail-cg
- Manual commit offsets, retry sur erreur persistance

Conformite reglementaire :
- Loi 43-20 article 9 (preuve numerique opposable tribunal MA)
- ACAPS Circulaire 2018/01 article 9 (tracabilite obligatoire signatures)
- CNDP Loi 09-08 article 13 (integrite journaux audit)
- ETSI EN 319 122 CAdES-LT (Long Term Validation)
- Code procedure civile article 417-4 (preuve electronique recevable)

Tests : 51 cas (15+11+9+5+11), couverture lignes 92%+, branches 88%+

Variables environnement : AUDIT_TRAIL_HASH_ALGORITHM, AUDIT_TRAIL_PDF_LANG_DEFAULT,
AUDIT_TRAIL_RETENTION_DAYS=3651, AUDIT_TRAIL_GEO_LOOKUP_ENABLED,
AUDIT_TRAIL_GEO_LOOKUP_PROVIDER=maxmind, AUDIT_TRAIL_GEO_DB_PATH,
AUDIT_TRAIL_GEO_LOOKUP_TIMEOUT_MS=100, AUDIT_TRAIL_PDF_MAX_BYTES=52428800,
AUDIT_TRAIL_KAFKA_TOPIC, AUDIT_TRAIL_KAFKA_GROUP

Task 3.3.10
Sprint 10
Phase 3
Reference B-10
Depends-On: 3.3.9
Co-authored-by: Tech Lead <techlead@skalean.ma>
```

## 17. Workflow next step

Apres merge de cette tache, demarrer la Tache 3.3.11 :
**`task-3.3.11-sig-consents-tracabilite-consentement.md`**

Cette tache suivante implementera la table `sig_consents` qui trace les consentements explicites
des signataires avant signature (consentement loi 43-20 article 7 + consentement CNDP article 4
+ consentement clauses CGV / CGA / politique de confidentialite). Elle s'appuiera sur l'audit
trail de la presente tache pour journaliser chaque collecte de consentement comme evenement
dedie `consent_collected` ajoute a l'enum `sig_audit_event_type` via migration ALTER TYPE
ADD VALUE.

Le diagramme de dependances jusqu'a la fin du Sprint 10 :

```
3.3.9 (archives WORM) -> 3.3.10 (audit trails) -> 3.3.11 (consents)
                                              \-> 3.3.12 (templates contrats)
                                              \-> 3.3.13 (notifications signataires)
3.3.11 -> 3.3.14 (workflows multi-signataires) -> 3.3.15 (relances automatiques)
3.3.15 -> 3.3.16 (rapports compliance ACAPS)
```

Lien backlog : `00-pilotage/backlog-detaille.md` section B-10 ligne 234-289.
Lien decisions : `00-pilotage/decisions-architecturales.md` decision-009 et decision-011.
Lien registre RBAC : `00-pilotage/registre-permissions-rbac.md` ajouter ligne `signature.audit_trail.read`.


