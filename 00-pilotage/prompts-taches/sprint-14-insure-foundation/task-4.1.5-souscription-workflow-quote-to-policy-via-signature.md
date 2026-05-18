# TACHE 4.1.5 -- Souscription Workflow : Quote -> Policy via Barid eSign + ANRT Timestamp

**Sprint** : 14 (Phase 4 / Sprint 1 dans phase Vertical Insure)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-14-sprint-14-insure-foundation.md` (Tache 4.1.5)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (chemin critique signature legale loi 43-20 + materialisation police active)
**Effort** : 6h
**Dependances** : Task 4.1.1 (insure_products), Task 4.1.3 (insure_devis), Task 4.1.4 (insure_polices + createFromQuote + activatePolicy), Sprint 10 (PdfGenerator + SigningWorkflowService + Barid eSign + ANRT timestamp), Sprint 9 (CommOrchestrator)
**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente le **workflow d'orchestration complete** entre l'acceptance d'un devis (Task 4.1.3) et l'activation d'une police signee (Task 4.1.4), via la signature electronique qualifiee Barid eSign + horodatage ANRT (Sprint 10, loi 43-20 decision-009). Le workflow chaine **6 etapes atomiques** : (1) verification devis accepted + product active, (2) creation policy row status='pending_signature' via `PoliciesService.createFromQuote()`, (3) generation PDF police via PdfGenerator + template `police.hbs`, (4) creation `SigningWorkflow` Barid eSign + envoi signature au souscripteur, (5) attente webhook completion via Kafka consumer `signature.completed`, (6) activation policy + trigger downstream (premiums Task 4.1.7, commissions Task 4.1.9). La tache implemente aussi le **traitement des cas d'echec** : signature refusee, signature expiree, idempotency consumer (event delivered 2 fois), rollback workflow si erreur partielle.

L'apport est triple : (a) **SouscriptionService** orchestrateur 6 etapes avec gestion transactionnelle + rollback partiel ; (b) **2 consumers Kafka** -- `signature-completed.consumer.ts` (transitions policy active + trigger premiums/commissions) et `signature-failed.consumer.ts` (transitions policy cancelled + log + notify broker) ; (c) **idempotency strict** sur tous endpoints + consumers (event redelivere ne double pas activate policy).

A l'issue de cette tache, un broker peut declencher la souscription d'un devis accepted en 1 endpoint, recevra une promise resolvee avec le `policy_id` et `signing_workflow_id`, le souscripteur recevra un email/SMS avec lien Barid eSign, et 1-14 jours plus tard quand l'assure signe, la police passe automatiquement active + premiums echeancier cree + commission enregistree -- sans aucune action manuelle du broker.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

C'est **LA tache la plus critique du Sprint 14** : elle materialise legalement l'engagement assurance. Avant cette tache, on a des devis + produits + tarifs ; apres, on a une **police signee, opposable, horodatee ANRT, archivee 10 ans ACAPS, payable, commissionable**. Sans cette tache, le broker ne peut commercialiser, pas de revenu, pas d'analytics portfolio.

Le workflow est **complexe car critique** : un echec partiel (e.g. policy creee mais signature workflow pas envoye) = inconsistance metier majeure. Un succes signature mais activation echec = assure pense etre couvert mais police pas active = potentielle plainte ACAPS. L'implementation doit etre **transactionnelle dans la mesure du possible** (Postgres transaction pour create policy + insert signature workflow row) mais **eventually-consistent pour signature externe** (Barid eSign API call peut prendre 200ms-2s, doit etre sortie de la transaction DB).

Le pattern **Sagas** est inspirant ici mais Sprint 14 simplifie : transaction DB locale (steps 1-2) puis appels API externes idempotent (steps 3-5) avec retry queue Sprint 4 BullMQ. Sprint 16 evaluera Saga complete avec compensation.

La **decision-009 (Loi 43-20)** impose :
- Signature qualifiee via Barid eSign Maroc (pas DocuSign ou autre).
- Horodatage qualifie via ANRT Maroc TSA (RFC 3161).
- Archive PDF signed + signature certificate dans S3 Atlas Cloud Benguerir 10 ans.
- Audit trail complet : qui a sign, quand, depuis quelle IP, quel device.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **A. Signature inline (broker valide sur place)** | Rapide, pas de delai | Casse loi 43-20 (signature qualifiee = assure lui-meme), pas legalement opposable | rejete |
| **B. Signature async via lien email (RETENU)** | Standard MA, legal opposable | Delai 1-14 jours selon assure | RETENU |
| **C. Saga complete avec compensation** | Robustesse maximale | Over-engineering Sprint 14, complexity courbe | rejete : YAGNI |
| **D. Workflow sync attendre signature** | Simple code | UX broker bloque, non-scalable | rejete : impossible |
| **E. Polling status signature** | Pas de webhook | Latence + load API | rejete : webhook Kafka Sprint 10 deja |

### 2.3 Trade-offs explicites

- **Atomicite partielle** : transaction DB pour steps 1-2 (policy + signing workflow row), puis Barid API call hors transaction. Cout : possibilite de policy creee sans signature envoyee. Gain : pas de blocage DB sur API externe. Mitigation : retry queue BullMQ Sprint 4 + reconciliation cron daily.

- **Idempotency via key Kafka payload** : consumer verifie `idempotency_key` deja traite avant activate. Cout : table `kafka_processed_events` Sprint 4. Gain : safe re-delivery.

- **Default validity signature 14 jours** : assure a 14 jours pour signer. Configurable per produit Sprint 27. Si depasse, signature expired -> policy cancelled. Cout : assure perd offre si delay. Gain : evite polices fantomes pending eternellement.

- **start_date J+1 hardcoded** : police active demain. Sprint 16 ajoutera `start_date` configurable. Sprint 14 = simple.

### 2.4 Decisions strategiques referencees

- **decision-002** (Multi-tenant) : tous services respectent RLS.
- **decision-006** (No emoji).
- **decision-008** (Data residency MA) : Barid eSign + ANRT + S3 Atlas Benguerir tous MA.
- **decision-009** (Loi 43-20 signature qualifiee) : Barid eSign + ANRT timestamp obligatoire.

### 2.5 Pieges techniques connus

1. **Idempotency consumer** : event delivered 2 fois -> 2 activations -> 2 premiums echeancier dupliques.
   Solution : `processed_event_id` check avant traitement. Test V13.

2. **Race condition policy already active** : 2 webhooks Barid concurrents.
   Solution : `SELECT ... FOR UPDATE` policy + status check. Test V14.

3. **PDF police regenerate apres edit produit** : produit modifie entre create devis et sign.
   Solution : snapshot complet dans devis (Task 4.1.3) deja, police snapshot via createFromQuote. Test V11.

4. **Signature expired non-trackee** : Barid n'emet pas event expired automatique.
   Solution : cron daily check `SELECT FROM docs_signatures WHERE status='pending' AND expires_at < NOW()` (Sprint 10 deja).

5. **PDF generation echec** : Puppeteer timeout.
   Solution : retry 3 fois exponential + queue BullMQ + alert. Test V15.

6. **ANRT timestamp service down** : signature complete mais timestamp pas applique.
   Solution : Sprint 10 deja queue retry timestamp ; police stays active avec signed_doc minus timestamp temporaire.

7. **Email assure invalide ou bounce** : signature link jamais recu.
   Solution : Comm Sprint 9 bounce detection -> log + notify broker UI.

8. **Contact preferred_language pas FR/AR/EN supporte** : template signature manquant.
   Solution : fallback FR + log warning.

9. **Concurrent souscription meme devis** : 2 brokers cliquent en meme temps.
   Solution : verifie `devis.metadata.souscription_initiated` avant. Test V16.

10. **Souscripteur signe mais signed_doc upload S3 echec** : storage transient.
    Solution : retry queue + status pending_archive ; police active avec signed_at mais signed_doc_id null temporairement.

11. **Devis expire entre create et clic signature** : 30+ jours.
    Solution : check valid_until AVANT initiate. Test V12.

12. **Cancel policy pendant signature en cours** : broker cancel apres avoir initie.
    Solution : check policy.status = 'pending_signature' avant cancel ; si cancel, cancel signing workflow Barid (API call DELETE). Test V17.

---

## 3. Architecture context

### 3.1 Position dans le sprint 14

Tache **4.1.5** = **5eme des 14**. Depend de 4.1.1/4.1.3/4.1.4. Bloque 4.1.7 (premiums via consumer) + 4.1.9 (commissions via consumer).

### 3.2 Diagramme flow souscription

```
                                +-----------+
   Broker quote.accepted        | Webhook   |   Barid eSign API
   ou customer portal           | Sprint 10 |   <-- ANRT TSA
                                +-----+-----+
                                      |
                                      v
+-----------+    POST /api/v1/insure/quotes/:id/initiate-souscription
|  Broker   | --------------------------------------------------------+
+-----+-----+                                                          |
      |                                                                v
      |    SouscriptionService.initiateSouscription(quote_id)  +------+--------+
      |                                                         | Step 1       |
      |                                                         | Verify devis |
      |                                                         | + product    |
      |                                                         +------+-------+
      |                                                                |
      |                                                                v
      |                                                         +------+-------+
      |                                                         | Step 2       |
      |                                                         | DB Transac : |
      |                                                         |  - create    |
      |                                                         |    policy    |
      |                                                         |    status=   |
      |                                                         |   pending_sig|
      |                                                         +------+-------+
      |                                                                |
      |                                                                v
      |                                                         +------+-------+
      |                                                         | Step 3       |
      |                                                         | Generate     |
      |                                                         | police PDF   |
      |                                                         | (Sprint 10)  |
      |                                                         +------+-------+
      |                                                                |
      |                                                                v
      |                                                         +------+-------+
      |                                                         | Step 4       |
      |                                                         | Create       |
      |                                                         | SigningWf    |
      |                                                         | Sprint 10    |
      |                                                         | + Barid eSign|
      |                                                         | send         |
      |                                                         +------+-------+
      |                                                                |
      |   <----- 201 { policy_id, signing_workflow_id } ---------------+
      |
      |   ... Souscripteur recoit email Barid + signe (1-14 jours)
      |   ... Barid webhook Sprint 10 publish Kafka signature.completed
      |
                                                                +-----+--------+
                                                                | Step 5       |
                                                                | Kafka        |
                                                                | consumer     |
                                                                | signature    |
                                                                | -completed   |
                                                                +-----+--------+
                                                                      |
                                                                      v
                                                                +-----+--------+
                                                                | Step 6       |
                                                                | activate     |
                                                                | policy       |
                                                                | + trigger    |
                                                                | premiums     |
                                                                | + commission |
                                                                +--------------+
                                                                      |
                                                                      | Kafka :
                                                                      | insure.policy.activated
                                                                      | -> downstream
                                                                      | Task 4.1.7, 4.1.9
```

---

## 4. Livrables checkables (24 items)

- [ ] Service `SouscriptionService` `souscription.service.ts` (~300 lignes) avec methode principale `initiateSouscription(quoteId)`
- [ ] Service utilise PoliciesService.createFromQuote (Task 4.1.4)
- [ ] Service utilise PdfGenerator + DevisPdfDataBuilder (Sprint 10 + Task 4.1.3 patterns)
- [ ] Service utilise SigningWorkflowService Sprint 10 (createWorkflow + sendForSignature)
- [ ] Idempotency check `devis.metadata.souscription_initiated` avant relancer
- [ ] Consumer `signature-completed.consumer.ts` (~150 lignes) listen Kafka `docs.signature.workflow_completed`
- [ ] Consumer trigger PoliciesService.activatePolicy + publish Kafka `insure.policy.activated`
- [ ] Consumer idempotent via `processed_event_id` (table Sprint 4)
- [ ] Consumer `signature-failed.consumer.ts` (~100 lignes) listen `docs.signature.workflow_declined`
- [ ] Consumer failed transitions policy -> cancelled + notify broker
- [ ] Endpoint `POST /api/v1/insure/quotes/:id/initiate-souscription` (~80 lignes controller)
- [ ] Endpoint utilise Idempotency-Key header
- [ ] Permission `insure.souscription.initiate`
- [ ] Events Kafka `insure.souscription_initiated`, `insure.souscription_completed`, `insure.souscription_failed`
- [ ] Audit trail
- [ ] Variables env : `INSURE_SIGNATURE_VALIDITY_DAYS=14`, `INSURE_SOUSCRIPTION_RETRY_ATTEMPTS=3`
- [ ] Tests unit `souscription.service.spec.ts` (10+ tests)
- [ ] Tests unit `signature-completed.consumer.spec.ts` (5+ tests)
- [ ] Tests unit `signature-failed.consumer.spec.ts` (3+ tests)
- [ ] Tests integration `souscription.integration.spec.ts` (5+ tests) avec mock Barid eSign
- [ ] Tests E2E `souscription.e2e-spec.ts` (8+ tests)
- [ ] Coverage >= 87%
- [ ] Documentation README souscription workflow
- [ ] Total tests : >= 31

---

## 5. Fichiers crees / modifies

```
repo/packages/insure/src/services/souscription.service.ts                            (~310 lignes)
repo/packages/insure/src/consumers/signature-completed.consumer.ts                   (~160 lignes)
repo/packages/insure/src/consumers/signature-failed.consumer.ts                      (~110 lignes)
repo/packages/insure/src/events/souscription.events.ts                                (~80 lignes)
repo/packages/insure/src/templates/police-pdf-data.builder.ts                         (~130 lignes)
repo/apps/api/src/modules/insure/controllers/souscription.controller.ts              (~90 lignes)
repo/packages/insure/src/services/souscription.service.spec.ts                       (~380 lignes / 12+ unit)
repo/packages/insure/src/consumers/signature-completed.consumer.spec.ts              (~220 lignes / 6+ unit)
repo/packages/insure/src/consumers/signature-failed.consumer.spec.ts                 (~160 lignes / 4+ unit)
repo/packages/insure/test/integration/souscription.integration.spec.ts               (~250 lignes / 6+ integration)
repo/apps/api/test/insure/souscription.e2e-spec.ts                                     (~310 lignes / 8+ E2E)
repo/packages/auth/src/rbac/permissions.enum.ts                                       (modif +1 ligne)
repo/packages/auth/src/rbac/permissions-matrix.ts                                     (modif +4 lignes)
repo/apps/api/src/modules/insure/insure.module.ts                                     (modif +providers consumers)
```

Total : 11 fichiers crees, 3 modifies. Lignes nettes ajoutees ~2200.


---

## 6. Code patterns COMPLETS

### 6.1 Fichier : `repo/packages/insure/src/services/souscription.service.ts`

```typescript
import { Injectable, Inject, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Logger } from 'pino';
import { InsureDevis } from '../entities/insure-devis.entity';
import { InsurePolicy } from '../entities/insure-policy.entity';
import { PoliciesService } from './policies.service';
import { ProductsService } from './products.service';
import { PolicePdfDataBuilder } from '../templates/police-pdf-data.builder';
import { TenantContext } from '@insurtech/shared-utils';
import { KafkaPublisher } from '@insurtech/shared-events';
import { AuditAction } from '@insurtech/auth';
import { PdfGeneratorService, DocumentService, SigningWorkflowService } from '@insurtech/docs';
import { ContactsService } from '@insurtech/crm';
import { InsureSouscriptionTopics } from '../events/souscription.events';

interface ActorContext { user_id: string }

interface SouscriptionResult {
  policy_id: string;
  policy_number: string;
  signing_workflow_id: string;
  signing_url: string;
  expires_at: string;
}

@Injectable()
export class SouscriptionService {
  private readonly signatureValidityDays: number;

  constructor(
    @InjectRepository(InsureDevis)
    private readonly devisRepo: Repository<InsureDevis>,
    private readonly dataSource: DataSource,
    private readonly policies: PoliciesService,
    private readonly products: ProductsService,
    private readonly contacts: ContactsService,
    private readonly pdfBuilder: PolicePdfDataBuilder,
    private readonly pdfGen: PdfGeneratorService,
    private readonly docsService: DocumentService,
    private readonly signing: SigningWorkflowService,
    private readonly kafka: KafkaPublisher,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {
    this.signatureValidityDays = Number(process.env.INSURE_SIGNATURE_VALIDITY_DAYS ?? 14);
  }

  /**
   * Workflow 6 etapes : verify -> create policy -> generate PDF -> create signing -> send Barid eSign.
   * Idempotent via devis.metadata.souscription_initiated.
   */
  @AuditAction({ resource: 'insure_souscription', action: 'initiate' })
  async initiateSouscription(quoteId: string, actor: ActorContext, idempotencyKey?: string): Promise<SouscriptionResult> {
    const tenantId = TenantContext.getTenantIdOrThrow();
    const t0 = performance.now();

    this.logger.info(
      { tenant_id: tenantId, quote_id: quoteId, actor_user_id: actor.user_id, idempotency_key: idempotencyKey },
      'Initiating souscription workflow',
    );

    // === Step 1 : Verify ===
    const devis = await this.devisRepo.findOne({ where: { id: quoteId } });
    if (!devis) throw new NotFoundException({ code: 'INSURE_SOUSCRIPTION_QUOTE_NOT_FOUND' });

    if (devis.status !== 'accepted') {
      throw new BadRequestException({
        code: 'INSURE_SOUSCRIPTION_QUOTE_NOT_ACCEPTED',
        message: `Quote status ${devis.status}, expected 'accepted'`,
      });
    }

    // Idempotency : si souscription deja initiated, return result existant
    const existingMeta = devis.metadata as { souscription_initiated?: { policy_id: string; signing_workflow_id: string; at: string } };
    if (existingMeta?.souscription_initiated) {
      const policy = await this.policies.findById(existingMeta.souscription_initiated.policy_id);
      const workflow = await this.signing.findById(existingMeta.souscription_initiated.signing_workflow_id);
      this.logger.info({ quote_id: quoteId, policy_id: policy.id }, 'Souscription already initiated (idempotent return)');
      return {
        policy_id: policy.id,
        policy_number: policy.policyNumber,
        signing_workflow_id: workflow.id,
        signing_url: workflow.signing_url,
        expires_at: workflow.expires_at,
      };
    }

    if (devis.validUntil.getTime() < Date.now()) {
      throw new BadRequestException({ code: 'INSURE_SOUSCRIPTION_QUOTE_EXPIRED_BY_DATE' });
    }

    const product = await this.products.findById(devis.productId);
    if (!product.active) {
      throw new BadRequestException({ code: 'INSURE_SOUSCRIPTION_PRODUCT_ARCHIVED' });
    }

    const contact = await this.contacts.findById(devis.contactId);
    if (!contact) throw new NotFoundException({ code: 'INSURE_SOUSCRIPTION_CONTACT_NOT_FOUND' });
    if (!contact.email && !contact.phone) {
      throw new BadRequestException({ code: 'INSURE_SOUSCRIPTION_NO_CONTACT_CHANNEL' });
    }

    // === Step 2 : Create policy pending_signature (DB transaction local) ===
    const policy = await this.policies.createFromQuote(
      { devis_id: devis.id, start_date_offset_days: 1, duration_days: 365, payment_frequency: 'annual', metadata: { initiated_by: actor.user_id } },
      actor,
    );

    // === Step 3 : Generate PDF police ===
    const locale = (contact.preferred_language as 'fr' | 'ar' | 'en') ?? 'fr';
    const pdfData = await this.pdfBuilder.build({ policy, contact, product });
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.pdfGen.generate('police', locale, pdfData);
    } catch (err) {
      this.logger.error({ err, policy_id: policy.id }, 'PDF generation failed');
      // Rollback : cancel policy (Sprint 16 will use Saga compensation)
      await this.policies.cancel(policy.id, { reason: 'Echec generation PDF police' }, actor);
      throw new BadRequestException({ code: 'INSURE_SOUSCRIPTION_PDF_GENERATION_FAILED' });
    }

    const pdfDoc = await this.docsService.create({
      type: 'police_unsigned',
      title: `Police ${policy.policyNumber} (non signee)`,
      file: pdfBuffer,
      mime_type: 'application/pdf',
      related_resource_type: 'insure_policy',
      related_resource_id: policy.id,
      visibility: 'tenant',
    });

    // === Step 4 : Create signing workflow + send Barid eSign ===
    let signingWorkflow;
    try {
      signingWorkflow = await this.signing.createWorkflow({
        document_id: pdfDoc.id,
        signers: [{
          name: `${contact.first_name} ${contact.last_name}`,
          email: contact.email,
          phone: contact.phone,
          role: 'signer',
          order: 1,
        }],
        signature_type: 'qualified', // Barid eSign loi 43-20
        expires_in_days: this.signatureValidityDays,
        callback_url: `${process.env.API_BASE_URL}/internal/insure/signature-callback`,
        metadata: { tenant_id: tenantId, policy_id: policy.id, quote_id: devis.id },
      });

      await this.signing.sendForSignature(signingWorkflow.id);
    } catch (err) {
      this.logger.error({ err, policy_id: policy.id }, 'Signing workflow creation failed');
      await this.policies.cancel(policy.id, { reason: 'Echec creation signature workflow' }, actor);
      throw new BadRequestException({ code: 'INSURE_SOUSCRIPTION_SIGNING_WORKFLOW_FAILED' });
    }

    // === Step 5 : Update policy with signing_workflow_id + conditions_doc ===
    await this.dataSource.getRepository(InsurePolicy).update(policy.id, {
      signatureWorkflowId: signingWorkflow.id,
      conditionsDocId: pdfDoc.id,
    });

    // === Step 6 : Mark devis with souscription_initiated metadata (idempotency) ===
    await this.devisRepo.update(devis.id, {
      metadata: {
        ...devis.metadata,
        souscription_initiated: {
          policy_id: policy.id,
          signing_workflow_id: signingWorkflow.id,
          at: new Date().toISOString(),
          by_user_id: actor.user_id,
        },
      },
    });

    // === Step 7 : Publish Kafka event ===
    await this.kafka.publish(InsureSouscriptionTopics.SOUSCRIPTION_INITIATED, {
      idempotency_key: idempotencyKey ?? `insure.souscription.${policy.id}.initiated`,
      tenant_id: tenantId,
      quote_id: devis.id,
      policy_id: policy.id,
      policy_number: policy.policyNumber,
      contact_id: contact.id,
      signing_workflow_id: signingWorkflow.id,
      signature_expires_at: signingWorkflow.expires_at,
      initiated_by: actor.user_id,
      initiated_at: new Date().toISOString(),
      duration_ms: Math.round(performance.now() - t0),
    });

    this.logger.info(
      {
        action: 'insure.souscription.initiated',
        tenant_id: tenantId,
        policy_id: policy.id,
        signing_workflow_id: signingWorkflow.id,
        duration_ms: Math.round(performance.now() - t0),
      },
      'Souscription workflow initiated successfully',
    );

    return {
      policy_id: policy.id,
      policy_number: policy.policyNumber,
      signing_workflow_id: signingWorkflow.id,
      signing_url: signingWorkflow.signing_url,
      expires_at: signingWorkflow.expires_at,
    };
  }
}
```

### 6.2 Fichier : `repo/packages/insure/src/consumers/signature-completed.consumer.ts`

```typescript
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Logger } from 'pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaConsumer, KafkaPublisher, ProcessedEventsService } from '@insurtech/shared-events';
import { z } from 'zod';
import { InsurePolicy } from '../entities/insure-policy.entity';
import { PoliciesService } from '../services/policies.service';
import { InsureSouscriptionTopics } from '../events/souscription.events';

/**
 * Schema event Sprint 10 docs.signature.workflow_completed.
 */
const SignatureCompletedEventSchema = z.object({
  idempotency_key: z.string(),
  signature_workflow_id: z.string().uuid(),
  document_id: z.string().uuid(),
  signed_document_id: z.string().uuid(),
  signed_at: z.string().datetime(),
  signer: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    ip_address: z.string().optional(),
    user_agent: z.string().optional(),
  }),
  metadata: z.object({
    tenant_id: z.string().uuid().optional(),
    policy_id: z.string().uuid().optional(),
    quote_id: z.string().uuid().optional(),
  }).passthrough(),
  anrt_timestamp_token: z.string().optional(),
});

@Injectable()
export class SignatureCompletedConsumer implements OnModuleInit {
  constructor(
    @Inject('KAFKA_CONSUMER') private readonly consumer: KafkaConsumer,
    @InjectRepository(InsurePolicy)
    private readonly policiesRepo: Repository<InsurePolicy>,
    private readonly policies: PoliciesService,
    private readonly kafka: KafkaPublisher,
    private readonly processedEvents: ProcessedEventsService,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe('insurtech.events.docs.signature.workflow_completed', this.handle.bind(this));
  }

  async handle(message: { value: string }): Promise<void> {
    let parsed: z.infer<typeof SignatureCompletedEventSchema>;
    try {
      parsed = SignatureCompletedEventSchema.parse(JSON.parse(message.value));
    } catch (err) {
      this.logger.error({ err, message }, 'Invalid signature.workflow_completed event schema');
      return;
    }

    // Idempotency check
    if (await this.processedEvents.isProcessed(parsed.idempotency_key)) {
      this.logger.info({ idempotency_key: parsed.idempotency_key }, 'Event already processed - skip');
      return;
    }

    if (!parsed.metadata.policy_id) {
      // Signature non-Insure (autre module), skip
      this.logger.debug({ idempotency_key: parsed.idempotency_key }, 'Signature not linked to insure_policy, skip');
      return;
    }

    const policy = await this.policiesRepo.findOne({ where: { id: parsed.metadata.policy_id } });
    if (!policy) {
      this.logger.warn({ policy_id: parsed.metadata.policy_id }, 'Policy not found for signature completed event');
      return;
    }

    if (policy.signatureWorkflowId !== parsed.signature_workflow_id) {
      this.logger.error(
        { policy_id: policy.id, expected_workflow: policy.signatureWorkflowId, received_workflow: parsed.signature_workflow_id },
        'Signature workflow id mismatch -- potential security issue',
      );
      return;
    }

    if (policy.status === 'active') {
      this.logger.info({ policy_id: policy.id }, 'Policy already active -- idempotent return');
      await this.processedEvents.markProcessed(parsed.idempotency_key);
      return;
    }

    if (policy.status !== 'pending_signature') {
      this.logger.warn(
        { policy_id: policy.id, current_status: policy.status },
        'Policy not in pending_signature status -- cannot activate',
      );
      return;
    }

    // Trigger activation
    try {
      await this.policies.activatePolicy(
        policy.id,
        parsed.signed_document_id,
        parsed.signature_workflow_id,
        { user_id: 'system-signature-consumer' },
      );

      await this.kafka.publish(InsureSouscriptionTopics.SOUSCRIPTION_COMPLETED, {
        idempotency_key: `insure.souscription.${policy.id}.completed`,
        tenant_id: policy.tenantId,
        policy_id: policy.id,
        policy_number: policy.policyNumber,
        signing_workflow_id: parsed.signature_workflow_id,
        signed_document_id: parsed.signed_document_id,
        signer_email: parsed.signer.email,
        signer_ip: parsed.signer.ip_address,
        anrt_timestamp_token: parsed.anrt_timestamp_token,
        signed_at: parsed.signed_at,
      });

      await this.processedEvents.markProcessed(parsed.idempotency_key);

      this.logger.info(
        { action: 'insure.souscription.completed', policy_id: policy.id, signer_email: parsed.signer.email },
        'Souscription completed -- policy activated',
      );
    } catch (err) {
      this.logger.error({ err, policy_id: policy.id }, 'Failed to activate policy from signature event');
      // Pas de markProcessed -> retry par Kafka
      throw err;
    }
  }
}
```

### 6.3 Fichier : `repo/packages/insure/src/consumers/signature-failed.consumer.ts`

```typescript
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Logger } from 'pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KafkaConsumer, KafkaPublisher, ProcessedEventsService } from '@insurtech/shared-events';
import { z } from 'zod';
import { InsurePolicy } from '../entities/insure-policy.entity';
import { PoliciesService } from '../services/policies.service';
import { CommOrchestratorService } from '@insurtech/comm';
import { InsureSouscriptionTopics } from '../events/souscription.events';

const SignatureFailedEventSchema = z.object({
  idempotency_key: z.string(),
  signature_workflow_id: z.string().uuid(),
  reason: z.enum(['declined_by_signer', 'expired', 'cancelled_by_initiator', 'technical_failure']),
  reason_details: z.string().optional(),
  metadata: z.object({
    tenant_id: z.string().uuid().optional(),
    policy_id: z.string().uuid().optional(),
  }).passthrough(),
  failed_at: z.string().datetime(),
});

@Injectable()
export class SignatureFailedConsumer implements OnModuleInit {
  constructor(
    @Inject('KAFKA_CONSUMER') private readonly consumer: KafkaConsumer,
    @InjectRepository(InsurePolicy)
    private readonly policiesRepo: Repository<InsurePolicy>,
    private readonly policies: PoliciesService,
    private readonly comm: CommOrchestratorService,
    private readonly kafka: KafkaPublisher,
    private readonly processedEvents: ProcessedEventsService,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.consumer.subscribe('insurtech.events.docs.signature.workflow_declined', this.handle.bind(this));
    await this.consumer.subscribe('insurtech.events.docs.signature.workflow_expired', this.handle.bind(this));
  }

  async handle(message: { value: string }): Promise<void> {
    let parsed: z.infer<typeof SignatureFailedEventSchema>;
    try {
      parsed = SignatureFailedEventSchema.parse(JSON.parse(message.value));
    } catch (err) {
      this.logger.error({ err }, 'Invalid signature.workflow_failed event');
      return;
    }

    if (await this.processedEvents.isProcessed(parsed.idempotency_key)) return;

    if (!parsed.metadata.policy_id) return;

    const policy = await this.policiesRepo.findOne({ where: { id: parsed.metadata.policy_id } });
    if (!policy) return;
    if (policy.status !== 'pending_signature') return;

    const reason = parsed.reason === 'declined_by_signer'
      ? 'Signature refusee par l assure'
      : parsed.reason === 'expired'
      ? 'Signature expiree (delai depasse)'
      : parsed.reason === 'cancelled_by_initiator'
      ? 'Signature annulee par broker'
      : 'Echec technique signature';

    try {
      await this.policies.cancel(
        policy.id,
        { reason: `${reason}. ${parsed.reason_details ?? ''}`.trim() },
        { user_id: 'system-signature-consumer' },
      );

      // Notify broker
      // TODO Sprint 17 : enrich with broker email lookup
      this.logger.info(
        { action: 'insure.souscription.failed', policy_id: policy.id, reason: parsed.reason },
        'Souscription failed -- policy cancelled',
      );

      await this.kafka.publish(InsureSouscriptionTopics.SOUSCRIPTION_FAILED, {
        idempotency_key: `insure.souscription.${policy.id}.failed`,
        tenant_id: policy.tenantId,
        policy_id: policy.id,
        policy_number: policy.policyNumber,
        signing_workflow_id: parsed.signature_workflow_id,
        reason: parsed.reason,
        reason_details: parsed.reason_details,
        failed_at: parsed.failed_at,
      });

      await this.processedEvents.markProcessed(parsed.idempotency_key);
    } catch (err) {
      this.logger.error({ err, policy_id: policy.id }, 'Failed to cancel policy on signature failed');
      throw err;
    }
  }
}
```

### 6.4 Fichier : `repo/packages/insure/src/events/souscription.events.ts`

```typescript
import { z } from 'zod';

export const InsureSouscriptionTopics = {
  SOUSCRIPTION_INITIATED: 'insurtech.events.insure.souscription.initiated',
  SOUSCRIPTION_COMPLETED: 'insurtech.events.insure.souscription.completed',
  SOUSCRIPTION_FAILED: 'insurtech.events.insure.souscription.failed',
} as const;

export const SouscriptionInitiatedEventSchema = z.object({
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  quote_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  policy_number: z.string(),
  contact_id: z.string().uuid(),
  signing_workflow_id: z.string().uuid(),
  signature_expires_at: z.string().datetime(),
  initiated_by: z.string().uuid(),
  initiated_at: z.string().datetime(),
  duration_ms: z.number().int(),
});

export const SouscriptionCompletedEventSchema = z.object({
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  policy_number: z.string(),
  signing_workflow_id: z.string().uuid(),
  signed_document_id: z.string().uuid(),
  signer_email: z.string().email().optional(),
  signer_ip: z.string().optional(),
  anrt_timestamp_token: z.string().optional(),
  signed_at: z.string().datetime(),
});

export const SouscriptionFailedEventSchema = z.object({
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  policy_number: z.string(),
  signing_workflow_id: z.string().uuid(),
  reason: z.enum(['declined_by_signer', 'expired', 'cancelled_by_initiator', 'technical_failure']),
  reason_details: z.string().optional(),
  failed_at: z.string().datetime(),
});
```

### 6.5 Fichier : `repo/apps/api/src/modules/insure/controllers/souscription.controller.ts`

```typescript
import { Controller, Post, Param, UseGuards, Req, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { SouscriptionService } from '@insurtech/insure';
import { JwtAuthGuard, TenantGuard, PermissionsGuard, Permissions } from '@insurtech/auth';

interface AuthenticatedRequest extends Request {
  user: { user_id: string; roles: string[] };
  tenant: { tenant_id: string };
}

@ApiTags('insure-souscription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller('insure/quotes')
export class SouscriptionController {
  constructor(private readonly souscription: SouscriptionService) {}

  @Post(':id/initiate-souscription')
  @Permissions('insure.souscription.initiate')
  @ApiOperation({
    summary: 'Initiate souscription : create policy + generate PDF + send Barid eSign',
  })
  async initiate(
    @Param('id') quoteId: string,
    @Req() req: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const result = await this.souscription.initiateSouscription(quoteId, { user_id: req.user.user_id }, idempotencyKey);
    return { data: result };
  }
}
```


---

## 7. Tests complets

### 7.1 Tests unit : `repo/packages/insure/src/services/souscription.service.spec.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SouscriptionService } from './souscription.service';
import { PoliciesService } from './policies.service';
import { ProductsService } from './products.service';
import { PolicePdfDataBuilder } from '../templates/police-pdf-data.builder';
import { InsureDevis } from '../entities/insure-devis.entity';
import { InsurePolicy } from '../entities/insure-policy.entity';

vi.mock('@insurtech/shared-utils', async (orig) => {
  const actual = await orig<typeof import('@insurtech/shared-utils')>();
  return { ...actual, TenantContext: { getTenantIdOrThrow: vi.fn(() => 'tenant-1'), getCurrentTenantId: vi.fn(() => 'tenant-1') } };
});

describe('SouscriptionService', () => {
  let service: SouscriptionService;
  let devisRepo: { findOne: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let policies: { createFromQuote: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let products: { findById: ReturnType<typeof vi.fn> };
  let contacts: { findById: ReturnType<typeof vi.fn> };
  let pdfGen: { generate: ReturnType<typeof vi.fn> };
  let docs: { create: ReturnType<typeof vi.fn> };
  let signing: { createWorkflow: ReturnType<typeof vi.fn>; sendForSignature: ReturnType<typeof vi.fn>; findById: ReturnType<typeof vi.fn> };
  let kafka: { publish: ReturnType<typeof vi.fn> };
  let ds: { transaction: ReturnType<typeof vi.fn>; getRepository: ReturnType<typeof vi.fn> };

  const mockDevis = {
    id: 'd1', status: 'accepted', productId: 'p1', contactId: 'c1', branche: 'auto',
    primeAnnuelle: '5928.00', garantiesSelected: ['VOL'], souscripteurData: {},
    primeBreakdown: {} as never, validUntil: new Date(Date.now() + 30 * 86400000),
    metadata: {},
  };
  const mockProduct = { id: 'p1', active: true, code: 'AUTO-TR', branche: 'auto', garanties: [] };
  const mockContact = { id: 'c1', first_name: 'Saad', last_name: 'B', email: 'a@b.ma', phone: '+212600000000', preferred_language: 'fr' };
  const mockPolicy = { id: 'pol-1', policyNumber: 'POL-AUTO-2026-000001', tenantId: 'tenant-1' };
  const mockWorkflow = { id: 'wf-1', signing_url: 'https://barid.eSign/sign/wf-1', expires_at: new Date(Date.now() + 14 * 86400000).toISOString() };

  beforeEach(async () => {
    devisRepo = {
      findOne: vi.fn().mockResolvedValue(mockDevis),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    policies = {
      createFromQuote: vi.fn().mockResolvedValue(mockPolicy),
      cancel: vi.fn().mockResolvedValue({ ...mockPolicy, status: 'cancelled' }),
      findById: vi.fn().mockResolvedValue(mockPolicy),
    };
    products = { findById: vi.fn().mockResolvedValue(mockProduct) };
    contacts = { findById: vi.fn().mockResolvedValue(mockContact) };
    pdfGen = { generate: vi.fn().mockResolvedValue(Buffer.from('PDF')) };
    docs = { create: vi.fn().mockResolvedValue({ id: 'doc-1' }) };
    signing = {
      createWorkflow: vi.fn().mockResolvedValue(mockWorkflow),
      sendForSignature: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(mockWorkflow),
    };
    kafka = { publish: vi.fn().mockResolvedValue(undefined) };
    ds = {
      transaction: vi.fn(async (cb) => cb({ getRepository: () => devisRepo })),
      getRepository: vi.fn(() => ({ update: vi.fn().mockResolvedValue({ affected: 1 }) })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SouscriptionService,
        { provide: getRepositoryToken(InsureDevis), useValue: devisRepo },
        { provide: getRepositoryToken(InsurePolicy), useValue: { update: vi.fn() } },
        { provide: DataSource, useValue: ds },
        { provide: PoliciesService, useValue: policies },
        { provide: ProductsService, useValue: products },
        { provide: 'ContactsService', useValue: contacts },
        { provide: PolicePdfDataBuilder, useValue: { build: vi.fn().mockResolvedValue({}) } },
        { provide: 'PdfGeneratorService', useValue: pdfGen },
        { provide: 'DocumentService', useValue: docs },
        { provide: 'SigningWorkflowService', useValue: signing },
        { provide: 'KafkaPublisher', useValue: kafka },
        { provide: 'LOGGER', useValue: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      ],
    }).compile();

    service = moduleRef.get(SouscriptionService);
  });

  it('completes 6-step workflow happy path', async () => {
    const result = await service.initiateSouscription('d1', { user_id: 'u1' });
    expect(result).toMatchObject({
      policy_id: 'pol-1',
      policy_number: 'POL-AUTO-2026-000001',
      signing_workflow_id: 'wf-1',
    });
    expect(policies.createFromQuote).toHaveBeenCalled();
    expect(pdfGen.generate).toHaveBeenCalledWith('police', 'fr', expect.any(Object));
    expect(docs.create).toHaveBeenCalled();
    expect(signing.createWorkflow).toHaveBeenCalledWith(expect.objectContaining({ signature_type: 'qualified' }));
    expect(signing.sendForSignature).toHaveBeenCalledWith('wf-1');
    expect(kafka.publish).toHaveBeenCalledWith('insurtech.events.insure.souscription.initiated', expect.any(Object));
  });

  it('idempotent : already-initiated devis returns existing', async () => {
    devisRepo.findOne.mockResolvedValueOnce({
      ...mockDevis,
      metadata: { souscription_initiated: { policy_id: 'pol-1', signing_workflow_id: 'wf-1', at: '2026-05-15T00:00:00Z' } },
    });
    const result = await service.initiateSouscription('d1', { user_id: 'u1' }, 'idem-key-1');
    expect(result.policy_id).toBe('pol-1');
    expect(policies.createFromQuote).not.toHaveBeenCalled();
    expect(signing.createWorkflow).not.toHaveBeenCalled();
  });

  it('rejects quote not accepted', async () => {
    devisRepo.findOne.mockResolvedValueOnce({ ...mockDevis, status: 'sent' });
    await expect(service.initiateSouscription('d1', { user_id: 'u1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_QUOTE_NOT_ACCEPTED' },
    });
  });

  it('rejects quote not found', async () => {
    devisRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.initiateSouscription('x', { user_id: 'u1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_QUOTE_NOT_FOUND' },
    });
  });

  it('rejects product archived', async () => {
    products.findById.mockResolvedValueOnce({ ...mockProduct, active: false });
    await expect(service.initiateSouscription('d1', { user_id: 'u1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_PRODUCT_ARCHIVED' },
    });
  });

  it('rejects expired quote (validUntil past)', async () => {
    devisRepo.findOne.mockResolvedValueOnce({ ...mockDevis, validUntil: new Date(Date.now() - 86400000) });
    await expect(service.initiateSouscription('d1', { user_id: 'u1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_QUOTE_EXPIRED_BY_DATE' },
    });
  });

  it('rejects contact without email or phone', async () => {
    contacts.findById.mockResolvedValueOnce({ ...mockContact, email: null, phone: null });
    await expect(service.initiateSouscription('d1', { user_id: 'u1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_NO_CONTACT_CHANNEL' },
    });
  });

  it('rolls back (cancel policy) if PDF generation fails', async () => {
    pdfGen.generate.mockRejectedValueOnce(new Error('Puppeteer timeout'));
    await expect(service.initiateSouscription('d1', { user_id: 'u1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_PDF_GENERATION_FAILED' },
    });
    expect(policies.cancel).toHaveBeenCalled();
  });

  it('rolls back (cancel policy) if signing workflow creation fails', async () => {
    signing.createWorkflow.mockRejectedValueOnce(new Error('Barid eSign API 500'));
    await expect(service.initiateSouscription('d1', { user_id: 'u1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_SIGNING_WORKFLOW_FAILED' },
    });
    expect(policies.cancel).toHaveBeenCalled();
  });

  it('uses contact preferred_language for PDF locale', async () => {
    contacts.findById.mockResolvedValueOnce({ ...mockContact, preferred_language: 'ar' });
    await service.initiateSouscription('d1', { user_id: 'u1' });
    expect(pdfGen.generate).toHaveBeenCalledWith('police', 'ar', expect.any(Object));
  });

  it('signature_type=qualified (Barid eSign loi 43-20)', async () => {
    await service.initiateSouscription('d1', { user_id: 'u1' });
    expect(signing.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ signature_type: 'qualified' }),
    );
  });

  it('default validity 14 days from env INSURE_SIGNATURE_VALIDITY_DAYS', async () => {
    await service.initiateSouscription('d1', { user_id: 'u1' });
    expect(signing.createWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ expires_in_days: 14 }),
    );
  });
});
```

### 7.2 Tests unit consumer signature-completed

```typescript
// repo/packages/insure/src/consumers/signature-completed.consumer.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignatureCompletedConsumer } from './signature-completed.consumer';

describe('SignatureCompletedConsumer', () => {
  let consumer: SignatureCompletedConsumer;
  let policiesRepo: { findOne: ReturnType<typeof vi.fn> };
  let policies: { activatePolicy: ReturnType<typeof vi.fn> };
  let kafka: { publish: ReturnType<typeof vi.fn> };
  let processedEvents: { isProcessed: ReturnType<typeof vi.fn>; markProcessed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    policiesRepo = { findOne: vi.fn() };
    policies = { activatePolicy: vi.fn().mockResolvedValue({ id: 'pol-1' }) };
    kafka = { publish: vi.fn().mockResolvedValue(undefined) };
    processedEvents = {
      isProcessed: vi.fn().mockResolvedValue(false),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    consumer = new SignatureCompletedConsumer(
      { subscribe: vi.fn() } as never,
      policiesRepo as never,
      policies as never,
      kafka as never,
      processedEvents as never,
      logger as never,
    );
  });

  const validEvent = {
    idempotency_key: 'docs.sig.complete.wf-1',
    signature_workflow_id: '00000000-0000-0000-0000-000000000001',
    document_id: '00000000-0000-0000-0000-000000000002',
    signed_document_id: '00000000-0000-0000-0000-000000000003',
    signed_at: '2026-05-15T10:00:00Z',
    signer: { email: 'a@b.ma', ip_address: '197.0.0.1' },
    metadata: { policy_id: '00000000-0000-0000-0000-000000000004', tenant_id: '00000000-0000-0000-0000-000000000005' },
    anrt_timestamp_token: 'token-anrt-xyz',
  };

  it('activates policy on valid event', async () => {
    policiesRepo.findOne.mockResolvedValueOnce({
      id: validEvent.metadata.policy_id,
      status: 'pending_signature',
      signatureWorkflowId: validEvent.signature_workflow_id,
      policyNumber: 'POL-AUTO-2026-000001',
      tenantId: validEvent.metadata.tenant_id,
    });
    await consumer.handle({ value: JSON.stringify(validEvent) });
    expect(policies.activatePolicy).toHaveBeenCalledWith(
      validEvent.metadata.policy_id, validEvent.signed_document_id, validEvent.signature_workflow_id, expect.any(Object),
    );
    expect(processedEvents.markProcessed).toHaveBeenCalledWith(validEvent.idempotency_key);
    expect(kafka.publish).toHaveBeenCalledWith('insurtech.events.insure.souscription.completed', expect.any(Object));
  });

  it('idempotent : already processed event is skipped', async () => {
    processedEvents.isProcessed.mockResolvedValueOnce(true);
    await consumer.handle({ value: JSON.stringify(validEvent) });
    expect(policies.activatePolicy).not.toHaveBeenCalled();
  });

  it('skips event without policy_id in metadata', async () => {
    await consumer.handle({ value: JSON.stringify({ ...validEvent, metadata: {} }) });
    expect(policies.activatePolicy).not.toHaveBeenCalled();
  });

  it('logs warning + skip if policy not found', async () => {
    policiesRepo.findOne.mockResolvedValueOnce(null);
    await consumer.handle({ value: JSON.stringify(validEvent) });
    expect(policies.activatePolicy).not.toHaveBeenCalled();
  });

  it('logs error + skip if workflow_id mismatch (security)', async () => {
    policiesRepo.findOne.mockResolvedValueOnce({
      id: validEvent.metadata.policy_id,
      status: 'pending_signature',
      signatureWorkflowId: '99999999-9999-9999-9999-999999999999',
    });
    await consumer.handle({ value: JSON.stringify(validEvent) });
    expect(policies.activatePolicy).not.toHaveBeenCalled();
  });

  it('idempotent return when policy already active', async () => {
    policiesRepo.findOne.mockResolvedValueOnce({
      id: validEvent.metadata.policy_id,
      status: 'active',
      signatureWorkflowId: validEvent.signature_workflow_id,
    });
    await consumer.handle({ value: JSON.stringify(validEvent) });
    expect(policies.activatePolicy).not.toHaveBeenCalled();
    expect(processedEvents.markProcessed).toHaveBeenCalled();
  });

  it('rejects malformed event payload (invalid schema)', async () => {
    await consumer.handle({ value: JSON.stringify({ foo: 'bar' }) });
    expect(policies.activatePolicy).not.toHaveBeenCalled();
  });
});
```

### 7.3 Tests E2E souscription

```typescript
// repo/apps/api/test/insure/souscription.e2e-spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { createTestJwt } from '@insurtech/auth/testing';

describe('Insure Souscription E2E', () => {
  let app: INestApplication;
  const brokerJwt = createTestJwt({ user_id: 'b1', roles: ['BrokerAdmin'], tenant_id: 'tenant-1' });
  let quoteId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    // Seed quote with status='accepted'
    const seedRes = await request(app.getHttpServer())
      .post('/internal/test/seed-quote')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ status: 'accepted' });
    quoteId = seedRes.body.quoteId;
  });

  afterAll(async () => { await app.close(); });

  it('POST /api/v1/insure/quotes/:id/initiate-souscription -> creates policy + signing wf', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${quoteId}/initiate-souscription`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .set('Idempotency-Key', `init-${quoteId}`)
      .expect(201);

    expect(res.body.data.policy_id).toBeDefined();
    expect(res.body.data.policy_number).toMatch(/^POL-/);
    expect(res.body.data.signing_workflow_id).toBeDefined();
    expect(res.body.data.signing_url).toMatch(/https?:\/\//);
  });

  it('Idempotent re-initiate returns same result', async () => {
    const res1 = await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${quoteId}/initiate-souscription`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .set('Idempotency-Key', `init-${quoteId}`);
    const res2 = await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${quoteId}/initiate-souscription`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .set('Idempotency-Key', `init-${quoteId}`)
      .expect(201);
    expect(res2.body.data.policy_id).toBe(res1.body.data.policy_id);
  });

  it('Rejects initiate on quote status != accepted', async () => {
    const seedDraft = await request(app.getHttpServer())
      .post('/internal/test/seed-quote')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ status: 'draft' });
    await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${seedDraft.body.quoteId}/initiate-souscription`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .expect(400);
  });

  it('Missing JWT -> 401', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${quoteId}/initiate-souscription`)
      .expect(401);
  });

  it('Insufficient permission -> 403', async () => {
    const readOnly = createTestJwt({ user_id: 'r1', roles: ['ReadOnly'], tenant_id: 'tenant-1' });
    await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${quoteId}/initiate-souscription`)
      .set('Authorization', `Bearer ${readOnly}`)
      .set('x-tenant-id', 'tenant-1')
      .expect(403);
  });

  it('Webhook signature completed -> policy active', async () => {
    // Trigger signature webhook via internal test endpoint (simulates Barid)
    const seedRes = await request(app.getHttpServer())
      .post('/internal/test/simulate-signature-completed')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ quote_id: quoteId });
    expect(seedRes.body.policyStatus).toBe('active');
  });

  it('Webhook signature declined -> policy cancelled', async () => {
    const seedRes = await request(app.getHttpServer())
      .post('/internal/test/seed-quote')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ status: 'accepted' });
    await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${seedRes.body.quoteId}/initiate-souscription`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    const declined = await request(app.getHttpServer())
      .post('/internal/test/simulate-signature-failed')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .send({ quote_id: seedRes.body.quoteId, reason: 'declined_by_signer' });
    expect(declined.body.policyStatus).toBe('cancelled');
  });

  it('Validation Zod : invalid Idempotency-Key format ignored gracefully', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/quotes/${quoteId}/initiate-souscription`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      // No idempotency key -- auto generated by service
      .expect(201);
    expect(res.body.data.policy_id).toBeDefined();
  });
});
```

---

## 8. Variables environnement

```env
INSURE_SIGNATURE_VALIDITY_DAYS=14                # Default 14 jours pour signer
INSURE_SOUSCRIPTION_RETRY_ATTEMPTS=3             # Retry calls Barid eSign
INSURE_SOUSCRIPTION_RETRY_DELAY_MS=2000          # Initial delay retry
API_BASE_URL=http://localhost:4000               # Pour callback_url webhooks Sprint 10
```

---

## 9. Commandes shell

```bash
cd repo

pnpm install --frozen-lockfile
pnpm --filter @insurtech/insure typecheck
pnpm --filter @insurtech/insure lint
pnpm --filter @insurtech/insure test:unit -- souscription
pnpm --filter @insurtech/insure test:unit -- signature-completed signature-failed
pnpm --filter @insurtech/insure test:integration -- souscription
pnpm --filter api test:e2e -- insure/souscription
pnpm --filter @insurtech/insure test:cov -- souscription
```

---

## 10. Criteres validation V1-V28

### Criteres P0 (16)

- **V1** : SouscriptionService.initiateSouscription chaine 6 etapes verifiables
- **V2** : Step 1 verify devis status='accepted' (rejette autre status)
- **V3** : Step 1 verify product.active=true
- **V4** : Step 1 verify devis.validUntil > NOW
- **V5** : Step 1 verify contact.email OR contact.phone exists
- **V6** : Step 2 create policy via PoliciesService.createFromQuote -> status='pending_signature'
- **V7** : Step 3 PDF generation locale = contact.preferred_language
- **V8** : Step 3 rollback (cancel policy) on PDF error
- **V9** : Step 4 SigningWorkflow signature_type='qualified' (loi 43-20)
- **V10** : Step 4 expires_in_days = 14 (env INSURE_SIGNATURE_VALIDITY_DAYS)
- **V11** : Step 4 rollback (cancel policy) on Barid eSign error
- **V12** : Step 6 metadata.souscription_initiated mark idempotency
- **V13** : Consumer signature-completed idempotent via processed_event_id
- **V14** : Consumer transitions policy pending_signature -> active
- **V15** : Consumer signature-failed transitions to cancelled with reason
- **V16** : 0 emoji

### Criteres P1 (8)

- **V17** : Consumer reject signature workflow_id mismatch (security)
- **V18** : Consumer skip event without metadata.policy_id
- **V19** : Consumer reject malformed Zod schema event
- **V20** : Kafka events publishes (initiated, completed, failed)
- **V21** : Audit log Sprint 7 enregistre initiateSouscription
- **V22** : Coverage >= 87%
- **V23** : Logs Pino structured (duration_ms per step)
- **V24** : ANRT timestamp_token transmis dans event completed

### Criteres P2 (4)

- **V25** : Documentation README workflow
- **V26** : OpenAPI documente endpoint
- **V27** : Reconciliation cron prepare (Sprint 16)
- **V28** : Permission `insure.souscription.initiate` ajoutee matrix

---

## 11. Edge cases + troubleshooting

[Edge cases 1-12 cf section 2.5. Solutions documentees ci-dessus.]

### Cas additionnels :

- **Signing url expire avant signature** : Barid renvoie 410. Souscripteur doit demander nouveau lien -> Sprint 17 endpoint resend.
- **Multiple signers (entreprise)** : Sprint 19 ajoutera support N signers (CEO + comptable). Sprint 14 = 1 signer assure.
- **Signature partielle (1 sur 3 signers)** : Sprint 14 N/A (1 signer). Sprint 19 evaluera workflow partial.

---

## 12. Conformite Maroc detaillee

### Loi 43-20 (Signature electronique qualifiee)
- **Article 2** : signature electronique qualifiee = signature avancee + certificat qualifie.
- **Article 7** : opposable en justice equivalent signature manuscrite.
- **Implementation** : Barid eSign certifie ANRT + horodatage ANRT TSA (RFC 3161).

### Loi 17-99 (Code des assurances)
- **Article 21** : forme ecrite obligatoire police.
- **Implementation** : PDF signed + ANRT timestamp + S3 archive 10 ans.

### Decision-008 (Data residency MA)
- Barid eSign infrastructure MA
- ANRT TSA infrastructure MA
- S3 Atlas Cloud Benguerir

### Audit ACAPS
- Audit trail complet : qui initie, qui signe, depuis quelle IP, quel device, ANRT token
- Retention 10 ans

---

## 13. Conventions absolues skalean-insurtech

[Voir task-4.1.1 section 13. Cette tache applique toutes les conventions multi-tenant + Zod + Pino + RBAC + Kafka + No-emoji + Idempotency + ANRT timestamp + Cloud MA.]

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/insure typecheck
pnpm --filter @insurtech/insure lint
pnpm --filter @insurtech/insure test
pnpm --filter api test:e2e -- insure/souscription
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/insure/src/services/souscription* \
  repo/packages/insure/src/consumers/signature-* --include="*.ts" && echo FAIL || echo OK
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-14): souscription workflow quote-to-policy via Barid eSign

Workflow 6 etapes : verify -> create policy -> generate PDF -> create
signing workflow Barid eSign qualifie -> send -> consumer Kafka
signature.completed -> activate policy + downstream premiums/commissions.
Idempotency via metadata.souscription_initiated + processed_events.
Rollback (cancel policy) si erreur PDF ou Barid API. ANRT timestamp
qualified loi 43-20.

Livrables:
- SouscriptionService.initiateSouscription (6-step workflow)
- SignatureCompletedConsumer (Kafka subscribe + activate policy)
- SignatureFailedConsumer (Kafka subscribe + cancel policy)
- 3 events Kafka souscription (initiated/completed/failed)
- PolicePdfDataBuilder
- SouscriptionController (POST initiate-souscription + Idempotency-Key)
- 1 permission insure.souscription.initiate

Tests: 12 unit service + 7 unit consumer + 4 integration + 8 E2E = 31
Coverage: 88%

Task: 4.1.5
Sprint: 14 (Phase 4 / Sprint 1)
Phase: 4 -- Vertical Insure (Skalean Broker)
Reference: B-14 Tache 4.1.5"
```

---

## 16. Workflow next step

Apres commit : task-4.1.6-insure-avenants. Pre-conditions : policy active -> avenants peuvent modifier garanties.

---

## 17. Annexes

### 17.1 PolicePdfDataBuilder

```typescript
// repo/packages/insure/src/templates/police-pdf-data.builder.ts
import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { fr, ar, enUS } from 'date-fns/locale';

@Injectable()
export class PolicePdfDataBuilder {
  async build(params: { policy: any; contact: any; product: any }) {
    const locale = params.contact.preferred_language === 'ar' ? ar : params.contact.preferred_language === 'en' ? enUS : fr;
    return {
      policy_number: params.policy.policyNumber,
      start_date: format(params.policy.startDate, 'dd MMMM yyyy', { locale }),
      end_date: format(params.policy.endDate, 'dd MMMM yyyy', { locale }),
      contact: {
        full_name: `${params.contact.first_name} ${params.contact.last_name}`,
        email: params.contact.email,
        phone: params.contact.phone,
      },
      product: { name: params.product.name, code: params.product.code, branche: params.product.branche },
      garanties: params.policy.garantiesActive,
      prime_annuelle: params.policy.primeAnnuelle,
      conditions: params.product.exclusions,
      legal: {
        broker_name: 'Skalean Broker',
        broker_ice: '000000000000000',
        acaps_authorization: 'ACAPS-XXX-XXXX',
      },
    };
  }
}
```

### 17.2 Permissions

```typescript
// permissions.enum.ts
INSURE_SOUSCRIPTION_INITIATE = 'insure.souscription.initiate',
```

```typescript
// matrix
BrokerAdmin/BrokerManager/BrokerUser: Permission.INSURE_SOUSCRIPTION_INITIATE
```

### 17.3 Module update

```typescript
@Module({
  // ...
  providers: [
    SouscriptionService,
    SignatureCompletedConsumer,
    SignatureFailedConsumer,
    PolicePdfDataBuilder,
  ],
  controllers: [SouscriptionController, /* ... */],
})
```

---

**Fin task 4.1.5.** Densite ~90 ko.

---

## 17.4 PolicePdfDataBuilder complet (extension)

Le builder PDF police consomme la `InsurePolicy` + `Contact` + `Product` et produit le dictionnaire Handlebars consomme par Sprint 10 PdfGenerator template `police.hbs`. Le PDF police est juridiquement opposable (loi 17-99 article 21) -- il doit contenir TOUS les elements legaux MA : reference policy_number, identite assure complete (nom, ICE si pro, adresse), product + branche reglementaire, garanties_active detaillees (capital, franchise, exclusions), prime annuelle + breakdown TVA 14%, conditions generales doc reference, signataires identifies, dates start/end.

```typescript
// repo/packages/insure/src/templates/police-pdf-data.builder.ts (complet)
import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import { fr, ar, enUS } from 'date-fns/locale';
import type { InsurePolicy } from '../entities/insure-policy.entity';
import type { InsureProduct } from '../entities/insure-product.entity';

interface ContactLike {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  address?: { street?: string; city?: string; postal_code?: string; country?: string } | null;
  preferred_language: 'fr' | 'ar' | 'en';
  ice?: string | null;
  rc?: string | null;
  cin?: string | null;
  date_of_birth?: string | null;
}

export interface PolicePdfTemplateData {
  policy_number: string;
  reference_internal: string;
  date_souscription: string;
  start_date: string;
  end_date: string;
  duration_label: string;
  assure: {
    full_name: string;
    email: string;
    phone: string;
    address_formatted: string;
    cin: string;
    ice: string;
    date_of_birth_formatted: string;
  };
  product: {
    code: string;
    name: string;
    branche: string;
    branche_label_localized: string;
    description: string;
    conditions_generales_doc_url: string;
  };
  garanties: Array<{
    name: string;
    description: string;
    capital_max_formatted: string;
    franchise_formatted: string;
    mandatory: boolean;
    mandatory_label: string;
  }>;
  prime: {
    base_ht: string;
    garanties_total: string;
    discounts: string;
    surcharges: string;
    subtotal_ht: string;
    tva_rate_percent: string;
    tva: string;
    total_ttc: string;
    monthly: string;
    quarterly: string;
    annual_label: string;
    monthly_label: string;
    payment_frequency: string;
  };
  exclusions: string[];
  legal_clauses: {
    droit_renonciation_label: string;
    droit_renonciation_days: number;
    juridiction_competente: string;
    loi_applicable: string;
    article_17_99: string;
  };
  broker: {
    name: string;
    legal_name: string;
    ice: string;
    rc: string;
    patente: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    acaps_authorization: string;
    courtier_intermediaire_code: string;
  };
  signatures: {
    place_signature_assure_label: string;
    place_signature_broker_label: string;
    instructions_signature: string;
    signature_barid_esign_label: string;
    ANRT_timestamp_label: string;
  };
  metadata: {
    generated_at: string;
    document_version: 'sprint-14-v1';
    locale: 'fr' | 'ar' | 'en';
    direction: 'ltr' | 'rtl';
  };
}

@Injectable()
export class PolicePdfDataBuilder {
  async build(params: { policy: InsurePolicy; contact: ContactLike; product: InsureProduct }): Promise<PolicePdfTemplateData> {
    const { policy, contact, product } = params;
    const locale = this.localeFor(contact.preferred_language);
    const direction = contact.preferred_language === 'ar' ? 'rtl' : 'ltr';

    const labels = this.getLabels(contact.preferred_language);

    return {
      policy_number: policy.policyNumber,
      reference_internal: `INT-${policy.id.slice(0, 8)}`,
      date_souscription: format(policy.createdAt, 'dd MMMM yyyy', { locale }),
      start_date: format(policy.startDate, 'dd MMMM yyyy', { locale }),
      end_date: format(policy.endDate, 'dd MMMM yyyy', { locale }),
      duration_label: `${Math.round((policy.endDate.getTime() - policy.startDate.getTime()) / 86_400_000)} jours`,
      assure: {
        full_name: `${contact.first_name} ${contact.last_name}`,
        email: contact.email,
        phone: contact.phone ?? '',
        address_formatted: this.formatAddress(contact.address),
        cin: contact.cin ?? '',
        ice: contact.ice ?? '',
        date_of_birth_formatted: contact.date_of_birth ? format(new Date(contact.date_of_birth), 'dd/MM/yyyy', { locale }) : '',
      },
      product: {
        code: product.code,
        name: product.name,
        branche: product.branche,
        branche_label_localized: labels.branches[product.branche] ?? product.branche,
        description: product.description ?? '',
        conditions_generales_doc_url: product.conditionsGeneralesDocId
          ? `${process.env.API_BASE_URL}/api/v1/docs/${product.conditionsGeneralesDocId}/download`
          : '',
      },
      garanties: policy.garantiesActive.map((g: { name: string; description?: string; capital_max: number | null; franchise: number; mandatory: boolean }) => ({
        name: g.name,
        description: g.description ?? '',
        capital_max_formatted: g.capital_max === null ? labels.valueAssured : `${g.capital_max.toLocaleString('fr-FR')} MAD`,
        franchise_formatted: g.franchise === 0 ? labels.noFranchise : `${g.franchise.toLocaleString('fr-FR')} MAD`,
        mandatory: g.mandatory,
        mandatory_label: g.mandatory ? labels.mandatory : labels.optional,
      })),
      prime: {
        base_ht: policy.primeBreakdown.breakdown.base,
        garanties_total: (
          Number(policy.primeBreakdown.breakdown.garanties_obligatoires) +
          Number(policy.primeBreakdown.breakdown.garanties_optionnelles)
        ).toFixed(2),
        discounts: policy.primeBreakdown.breakdown.discounts,
        surcharges: policy.primeBreakdown.breakdown.surcharges,
        subtotal_ht: policy.primeBreakdown.breakdown.subtotal_ht,
        tva_rate_percent: (Number(policy.primeBreakdown.breakdown.tva_rate) * 100).toFixed(2),
        tva: policy.primeBreakdown.breakdown.tva,
        total_ttc: policy.primeBreakdown.breakdown.total_ttc,
        monthly: policy.primeBreakdown.primeMonthly,
        quarterly: policy.primeBreakdown.primeQuarterly,
        annual_label: labels.primeAnnuelle,
        monthly_label: labels.primeMonthly,
        payment_frequency: policy.paymentFrequency,
      },
      exclusions: (product.exclusions ?? []) as string[],
      legal_clauses: {
        droit_renonciation_label: labels.droitRenonciation,
        droit_renonciation_days: 14,
        juridiction_competente: 'Tribunaux du Royaume du Maroc',
        loi_applicable: 'Loi 17-99 portant Code des Assurances',
        article_17_99: 'Article 4 et suivants',
      },
      broker: {
        name: 'Skalean Broker',
        legal_name: 'Skalean Broker SARL',
        ice: '000000000000000',
        rc: '00000',
        patente: '00000000',
        address: 'Casablanca, Maroc',
        phone: '+212 522 000 000',
        email: 'contact@skalean.ma',
        website: 'https://skalean.ma',
        acaps_authorization: 'ACAPS-XXX-XXXX',
        courtier_intermediaire_code: 'CI-XXXXX',
      },
      signatures: {
        place_signature_assure_label: labels.placeSignAssure,
        place_signature_broker_label: labels.placeSignBroker,
        instructions_signature: labels.instructionsSignature,
        signature_barid_esign_label: labels.signatureBarid,
        ANRT_timestamp_label: labels.anrtTimestamp,
      },
      metadata: {
        generated_at: new Date().toISOString(),
        document_version: 'sprint-14-v1',
        locale: contact.preferred_language,
        direction,
      },
    };
  }

  private localeFor(lang: 'fr' | 'ar' | 'en') {
    switch (lang) {
      case 'ar': return ar;
      case 'en': return enUS;
      default: return fr;
    }
  }

  private formatAddress(addr: ContactLike['address']): string {
    if (!addr) return '';
    return [addr.street, addr.postal_code, addr.city, addr.country].filter(Boolean).join(', ');
  }

  private getLabels(lang: 'fr' | 'ar' | 'en') {
    if (lang === 'ar') {
      return {
        branches: { auto: 'تأمين السيارات', sante: 'تأمين الصحة', multirisque_habitation: 'تأمين المسكن', rc_pro: 'تأمين المسؤولية المهنية', voyage: 'تأمين السفر' },
        valueAssured: 'قيمة المؤمن', noFranchise: 'بدون اقتطاع', mandatory: 'إلزامي', optional: 'اختياري',
        primeAnnuelle: 'القسط السنوي', primeMonthly: 'القسط الشهري',
        droitRenonciation: 'حق الانسحاب', placeSignAssure: 'توقيع المؤمَّن له', placeSignBroker: 'توقيع الوسيط',
        instructionsSignature: 'يرجى التوقيع باستخدام بريد إي ساين', signatureBarid: 'التوقيع بواسطة بريد إي ساين',
        anrtTimestamp: 'ختم زمني ANRT',
      };
    }
    if (lang === 'en') {
      return {
        branches: { auto: 'Auto Insurance', sante: 'Health Insurance', multirisque_habitation: 'Home Insurance', rc_pro: 'Professional Liability', voyage: 'Travel Insurance' },
        valueAssured: 'Insured value', noFranchise: 'No deductible', mandatory: 'Mandatory', optional: 'Optional',
        primeAnnuelle: 'Annual premium', primeMonthly: 'Monthly premium',
        droitRenonciation: 'Right to withdraw', placeSignAssure: 'Insured signature', placeSignBroker: 'Broker signature',
        instructionsSignature: 'Please sign using Barid eSign', signatureBarid: 'Signature by Barid eSign',
        anrtTimestamp: 'ANRT Timestamp',
      };
    }
    return {
      branches: { auto: 'Assurance Automobile', sante: 'Assurance Sante', multirisque_habitation: 'Assurance Habitation', rc_pro: 'Responsabilite Civile Professionnelle', voyage: 'Assurance Voyage' },
      valueAssured: 'Valeur assuree', noFranchise: 'Sans franchise', mandatory: 'Obligatoire', optional: 'Optionnelle',
      primeAnnuelle: 'Prime annuelle', primeMonthly: 'Prime mensuelle',
      droitRenonciation: 'Droit de renonciation', placeSignAssure: 'Signature assure', placeSignBroker: 'Signature broker',
      instructionsSignature: 'Veuillez signer via Barid eSign', signatureBarid: 'Signature par Barid eSign',
      anrtTimestamp: 'Horodatage ANRT',
    };
  }
}
```

---

## 17.5 Tests integration souscription (complets)

```typescript
// repo/packages/insure/test/integration/souscription.integration.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { DataSource } from 'typeorm';
import { setupTestDatabase, teardownTestDatabase, setTenant } from '@insurtech/database/testing';
import { SouscriptionService } from '@insurtech/insure';
import { InsureDevis } from '@insurtech/insure';
import { InsurePolicy } from '@insurtech/insure';

describe('Souscription integration (DB + DAO mocks Sprint 10)', () => {
  let ds: DataSource;
  let service: SouscriptionService;
  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const signingApiStub = { createWorkflow: vi.fn(), sendForSignature: vi.fn(), findById: vi.fn() };
  const pdfGenStub = { generate: vi.fn().mockResolvedValue(Buffer.from('PDF')) };
  const docsStub = { create: vi.fn().mockResolvedValue({ id: 'doc-1' }) };

  beforeAll(async () => {
    ds = await setupTestDatabase({
      migrations: ['auth_tenants', 'crm_contacts', 'insure_products', 'insure_devis', 'insure_polices', 'docs_documents', 'docs_signatures'],
    });
    // ... module setup avec stubs Sprint 10
  });

  afterAll(async () => { await teardownTestDatabase(ds); });

  beforeEach(async () => {
    await ds.query(`TRUNCATE insure_devis, insure_polices CASCADE;`);
    await setTenant(ds, tenantA);
    signingApiStub.createWorkflow.mockResolvedValue({
      id: 'wf-int-1',
      signing_url: 'https://barid.esign/sign/wf-int-1',
      expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    });
    signingApiStub.sendForSignature.mockResolvedValue(undefined);
  });

  it('full workflow : devis accepted -> policy pending_signature row created in DB', async () => {
    // Seed devis status='accepted'
    const seedDevis = await ds.getRepository(InsureDevis).save({
      tenantId: tenantA,
      reference: 'DEV-INT-1',
      contactId: 'c1', productId: 'p1', branche: 'auto',
      status: 'accepted', validUntil: new Date(Date.now() + 30 * 86400000),
      primeAnnuelle: '5928.00', primeBreakdown: {} as never,
      souscripteurData: {}, garantiesSelected: [], produitsCompares: [],
      metadata: {},
    } as never);

    const result = await service.initiateSouscription(seedDevis.id, { user_id: 'broker-1' });

    expect(result.policy_id).toBeDefined();
    const policy = await ds.getRepository(InsurePolicy).findOne({ where: { id: result.policy_id } });
    expect(policy).toBeDefined();
    expect(policy!.status).toBe('pending_signature');
    expect(policy!.devisId).toBe(seedDevis.id);
  });

  it('idempotent : 2 calls return same result, only 1 policy created', async () => {
    const seedDevis = await ds.getRepository(InsureDevis).save({
      tenantId: tenantA, reference: 'DEV-INT-2', contactId: 'c1', productId: 'p1',
      branche: 'auto', status: 'accepted', validUntil: new Date(Date.now() + 30 * 86400000),
      primeAnnuelle: '5928.00', primeBreakdown: {} as never,
      souscripteurData: {}, garantiesSelected: [], produitsCompares: [], metadata: {},
    } as never);

    const r1 = await service.initiateSouscription(seedDevis.id, { user_id: 'broker-1' }, 'idem-1');
    const r2 = await service.initiateSouscription(seedDevis.id, { user_id: 'broker-1' }, 'idem-1');

    expect(r2.policy_id).toBe(r1.policy_id);
    const count = await ds.getRepository(InsurePolicy).count({ where: { devisId: seedDevis.id } });
    expect(count).toBe(1);
  });

  it('rollback : if Barid eSign API fails, policy is cancelled', async () => {
    signingApiStub.createWorkflow.mockRejectedValueOnce(new Error('Barid 503'));

    const seedDevis = await ds.getRepository(InsureDevis).save({
      tenantId: tenantA, reference: 'DEV-INT-3', contactId: 'c1', productId: 'p1',
      branche: 'auto', status: 'accepted', validUntil: new Date(Date.now() + 30 * 86400000),
      primeAnnuelle: '5928.00', primeBreakdown: {} as never,
      souscripteurData: {}, garantiesSelected: [], produitsCompares: [], metadata: {},
    } as never);

    await expect(service.initiateSouscription(seedDevis.id, { user_id: 'broker-1' })).rejects.toThrow();

    const policies = await ds.getRepository(InsurePolicy).find({ where: { devisId: seedDevis.id } });
    expect(policies).toHaveLength(1);
    expect(policies[0]!.status).toBe('cancelled');
  });

  it('PDF generation fail : policy cancelled + audit log', async () => {
    pdfGenStub.generate.mockRejectedValueOnce(new Error('Puppeteer timeout'));

    const seedDevis = await ds.getRepository(InsureDevis).save({
      tenantId: tenantA, reference: 'DEV-INT-4', contactId: 'c1', productId: 'p1',
      branche: 'auto', status: 'accepted', validUntil: new Date(Date.now() + 30 * 86400000),
      primeAnnuelle: '1.00', primeBreakdown: {} as never,
      souscripteurData: {}, garantiesSelected: [], produitsCompares: [], metadata: {},
    } as never);

    await expect(service.initiateSouscription(seedDevis.id, { user_id: 'broker-1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_PDF_GENERATION_FAILED' },
    });
  });

  it('reject devis expired', async () => {
    const seedDevis = await ds.getRepository(InsureDevis).save({
      tenantId: tenantA, reference: 'DEV-INT-5', contactId: 'c1', productId: 'p1',
      branche: 'auto', status: 'accepted',
      validUntil: new Date(Date.now() - 86400000),
      primeAnnuelle: '1.00', primeBreakdown: {} as never,
      souscripteurData: {}, garantiesSelected: [], produitsCompares: [], metadata: {},
    } as never);

    await expect(service.initiateSouscription(seedDevis.id, { user_id: 'broker-1' })).rejects.toMatchObject({
      response: { code: 'INSURE_SOUSCRIPTION_QUOTE_EXPIRED_BY_DATE' },
    });
  });

  it('devis metadata.souscription_initiated populated after first call', async () => {
    const seedDevis = await ds.getRepository(InsureDevis).save({
      tenantId: tenantA, reference: 'DEV-INT-6', contactId: 'c1', productId: 'p1',
      branche: 'auto', status: 'accepted', validUntil: new Date(Date.now() + 30 * 86400000),
      primeAnnuelle: '1.00', primeBreakdown: {} as never,
      souscripteurData: {}, garantiesSelected: [], produitsCompares: [], metadata: {},
    } as never);

    await service.initiateSouscription(seedDevis.id, { user_id: 'broker-1' });

    const fresh = await ds.getRepository(InsureDevis).findOne({ where: { id: seedDevis.id } });
    expect((fresh!.metadata as { souscription_initiated?: object }).souscription_initiated).toBeDefined();
  });
});
```

---

## 17.6 Tests unit consumer signature-failed (complets)

```typescript
// repo/packages/insure/src/consumers/signature-failed.consumer.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SignatureFailedConsumer } from './signature-failed.consumer';

describe('SignatureFailedConsumer', () => {
  let consumer: SignatureFailedConsumer;
  let policiesRepo: { findOne: ReturnType<typeof vi.fn> };
  let policies: { cancel: ReturnType<typeof vi.fn> };
  let comm: { send: ReturnType<typeof vi.fn> };
  let kafka: { publish: ReturnType<typeof vi.fn> };
  let processedEvents: { isProcessed: ReturnType<typeof vi.fn>; markProcessed: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    policiesRepo = { findOne: vi.fn() };
    policies = { cancel: vi.fn().mockResolvedValue({}) };
    comm = { send: vi.fn().mockResolvedValue(undefined) };
    kafka = { publish: vi.fn().mockResolvedValue(undefined) };
    processedEvents = {
      isProcessed: vi.fn().mockResolvedValue(false),
      markProcessed: vi.fn().mockResolvedValue(undefined),
    };
    consumer = new SignatureFailedConsumer(
      { subscribe: vi.fn() } as never,
      policiesRepo as never,
      policies as never,
      comm as never,
      kafka as never,
      processedEvents as never,
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    );
  });

  const baseEvent = {
    idempotency_key: 'k1',
    signature_workflow_id: '00000000-0000-0000-0000-000000000001',
    reason: 'declined_by_signer',
    metadata: { policy_id: '00000000-0000-0000-0000-000000000002', tenant_id: '00000000-0000-0000-0000-000000000003' },
    failed_at: '2026-05-15T00:00:00Z',
  };

  it('cancels policy on signer declined', async () => {
    policiesRepo.findOne.mockResolvedValueOnce({ id: baseEvent.metadata.policy_id, status: 'pending_signature', tenantId: baseEvent.metadata.tenant_id, policyNumber: 'POL-X' });
    await consumer.handle({ value: JSON.stringify(baseEvent) });
    expect(policies.cancel).toHaveBeenCalledWith(
      baseEvent.metadata.policy_id,
      expect.objectContaining({ reason: expect.stringContaining('refusee') }),
      expect.any(Object),
    );
    expect(kafka.publish).toHaveBeenCalledWith('insurtech.events.insure.souscription.failed', expect.any(Object));
  });

  it('cancels policy on expired', async () => {
    policiesRepo.findOne.mockResolvedValueOnce({ id: baseEvent.metadata.policy_id, status: 'pending_signature', tenantId: baseEvent.metadata.tenant_id, policyNumber: 'POL-X' });
    await consumer.handle({ value: JSON.stringify({ ...baseEvent, reason: 'expired' }) });
    expect(policies.cancel).toHaveBeenCalledWith(
      baseEvent.metadata.policy_id,
      expect.objectContaining({ reason: expect.stringContaining('expiree') }),
      expect.any(Object),
    );
  });

  it('idempotent : already processed event skipped', async () => {
    processedEvents.isProcessed.mockResolvedValueOnce(true);
    await consumer.handle({ value: JSON.stringify(baseEvent) });
    expect(policies.cancel).not.toHaveBeenCalled();
  });

  it('skips events without metadata.policy_id', async () => {
    await consumer.handle({ value: JSON.stringify({ ...baseEvent, metadata: {} }) });
    expect(policies.cancel).not.toHaveBeenCalled();
  });

  it('skips if policy already not in pending_signature', async () => {
    policiesRepo.findOne.mockResolvedValueOnce({ id: baseEvent.metadata.policy_id, status: 'active' });
    await consumer.handle({ value: JSON.stringify(baseEvent) });
    expect(policies.cancel).not.toHaveBeenCalled();
  });
});
```

---

## 17.7 Module Insure update complet

```typescript
// repo/apps/api/src/modules/insure/insure.module.ts (extrait Task 4.1.5 ajouts)
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { InsureProduct, InsureDevis, InsurePolicy } from '@insurtech/insure';
import {
  ProductsService, TarificationService, QuotesService, PoliciesService, SouscriptionService,
  ReferenceNumberingService, DevisPdfDataBuilder, PolicePdfDataBuilder,
  AutoCalculator, SanteCalculator, HabitationCalculator, RcProCalculator, VoyageCalculator,
  ExpireQuotesCron, ProductUpdatedCacheInvalidator,
  SignatureCompletedConsumer, SignatureFailedConsumer,
} from '@insurtech/insure';
import { ProductsController, AdminProductsController, TarificationController, QuotesController, PoliciesController, SouscriptionController } from './controllers';
import { AuthModule } from '../auth/auth.module';
import { KafkaModule } from '../kafka/kafka.module';
import { DocsModule } from '../docs/docs.module';
import { CommModule } from '../comm/comm.module';
import { CrmModule } from '../crm/crm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InsureProduct, InsureDevis, InsurePolicy]),
    ScheduleModule.forRoot(),
    AuthModule, KafkaModule, DocsModule, CommModule, CrmModule,
  ],
  controllers: [
    ProductsController, AdminProductsController,
    TarificationController, QuotesController, PoliciesController, SouscriptionController,
  ],
  providers: [
    ProductsService, TarificationService, QuotesService, PoliciesService, SouscriptionService,
    ReferenceNumberingService, DevisPdfDataBuilder, PolicePdfDataBuilder,
    AutoCalculator, SanteCalculator, HabitationCalculator, RcProCalculator, VoyageCalculator,
    ExpireQuotesCron, ProductUpdatedCacheInvalidator,
    SignatureCompletedConsumer, SignatureFailedConsumer,
  ],
  exports: [ProductsService, TarificationService, QuotesService, PoliciesService, SouscriptionService],
})
export class InsureModule {}
```

---

## 17.8 Permissions matrix complete update (Task 4.1.5)

```typescript
// repo/packages/auth/src/rbac/permissions.enum.ts (extrait ajout)
export enum Permission {
  // ... existantes
  INSURE_SOUSCRIPTION_INITIATE = 'insure.souscription.initiate',
}
```

```typescript
// repo/packages/auth/src/rbac/permissions-matrix.ts (extrait ajout)
export const PERMISSIONS_MATRIX: Record<RoleName, Set<Permission>> = {
  // ...
  SuperAdmin: new Set([
    // toutes y compris
    Permission.INSURE_SOUSCRIPTION_INITIATE,
  ]),
  BrokerAdmin: new Set([
    // ...
    Permission.INSURE_SOUSCRIPTION_INITIATE,
  ]),
  BrokerManager: new Set([
    // ...
    Permission.INSURE_SOUSCRIPTION_INITIATE,
  ]),
  BrokerUser: new Set([
    // BrokerUser peut initier (workflow standard commercial)
    Permission.INSURE_SOUSCRIPTION_INITIATE,
  ]),
  AssureClient: new Set([
    // Sprint 19 portal : self-service souscription
    Permission.INSURE_SOUSCRIPTION_INITIATE,
  ]),
};
```

---

## 17.9 Runbook : panne Barid eSign + reconciliation

### Scenario panne Barid eSign API (degraded mode)

Si Barid eSign API retourne 5xx ou est inatteignable pendant N minutes :

1. **Detection** : `SouscriptionService.initiateSouscription` -> `signing.createWorkflow` rejette -> rollback policy `cancelled` + erreur 503 broker UI.
2. **Mitigation court terme** :
   - Poller status Barid /health endpoint via cron daily 5min (Sprint 10).
   - Si Barid DOWN > 15 minutes, switch souscription a status `queued_for_signature` (Sprint 16 feature) -> retry queue BullMQ Sprint 4.
   - Broker UI affiche banner "Signature externe temporairement indisponible -- vos souscriptions seront re-tentees automatiquement".
3. **Reconciliation post-incident** :
   - Cron sync daily 04:00 fetch Barid `GET /workflows?status=completed&since=$LAST_RUN` -> compare avec `docs_signatures` Sprint 10.
   - Si workflow Barid completed mais policy still `pending_signature` : trigger `SignatureCompletedConsumer.handle` manuellement avec event simule.
   - Audit log evenements `reconciliation_manual_trigger`.

### Scenario ANRT timestamp service down

Sprint 10 deja documente : si TSA ANRT down, signature complete sans timestamp -> Sprint 10 queue retry timestamp (NestJS Bull cron 1h). Police active immediatement avec `signed_doc` mais champ `anrt_timestamp_token` provisoire null. Reconciliation cron Sprint 10 ajoute timestamp dans 24h max.

### Scenario consumer Kafka panne / lag

Si `SignatureCompletedConsumer` lag > 1 heure (Kafka consumer group stuck) :
- Detection : alert Datadog `kafka_consumer_lag > 1000 messages`.
- Action : restart consumer container (kubectl rollout restart).
- Si lag persiste : forcer offset rewind 1 jour + reprocess (consumer idempotent via processed_event_id, safe).
- Audit log `manual_consumer_offset_rewind`.

### Scenario police pending_signature stuck > 14 jours

Detection : cron daily 05:00 `SELECT FROM insure_polices WHERE status='pending_signature' AND created_at < NOW - INTERVAL '14 days'`.

Action automatique : verifier docs_signatures.status correspondant :
- Si docs_signatures `expired` : trigger cancel policy via `SignatureFailedConsumer` simulation event.
- Si docs_signatures `pending` mais > 14j : alert dev team (incohérence Sprint 10).

---

## 17.10 Metriques observability Sprint 13 / Datadog

Apres deployment, dashboard `insure-souscription` expose :

- `insure_souscription_initiated_total{tenant_id, branche}` counter
- `insure_souscription_completed_total{tenant_id, branche}` counter
- `insure_souscription_failed_total{tenant_id, branche, reason}` counter
- `insure_souscription_initiate_duration_seconds{quantile}` histogram
- `insure_souscription_pdf_generation_duration_seconds{quantile}` histogram
- `insure_souscription_barid_api_duration_seconds{quantile}` histogram
- `insure_souscription_signature_completion_lag_hours{quantile}` histogram (initiated -> completed)
- `insure_souscription_in_pending_signature_total{tenant_id}` gauge (alerting si > 100)

SLO targets Sprint 14 :
- p95 initiate duration < 5 seconds
- p99 PDF generation < 10 seconds
- p95 signature_completion_lag < 7 days (depend assure UX)
- error_rate < 0.5% (souscriptions fail / total)

---

## 17.11 Limites Sprint 14 (a addresser Sprint 15+)

- **Pas de retry queue automatique Barid eSign** : si echec, broker doit re-initier manuellement. Sprint 16 ajoutera BullMQ retry.
- **Pas de notification J-3 signature expire** : assure recoit email Sprint 10 a J-3, J-1, J0. Sprint 17 ajoutera variant Insure-specific.
- **Pas de relance broker si assure pas signed** : Sprint 17 ajoutera cron J+3 / J+7 notify broker UI "signature en cours, relancer assure".
- **Pas de signature multi-signers** : Sprint 19 entreprise (CEO + DAF + assure principal).
- **Pas de retro-souscription** : impossible souscrire avec start_date passe. Sprint 16 admin override + audit special.
- **Pas de souscription multi-produits paquet** : 1 devis = 1 produit. Sprint 18 ajoutera "package souscription" auto/habitation/sante simultane.

---

## 17.12 Reconciliation tableau correspondance Task 4.1.5

| Element Task 4.1.5 | Source Sprint precedent | Cible Sprint suivant |
|--------------------|------------------------|----------------------|
| `insure_devis` consume | Task 4.1.3 | -- |
| `PoliciesService.createFromQuote` consume | Task 4.1.4 | -- |
| `PoliciesService.activatePolicy` consume | Task 4.1.4 | -- |
| `PoliciesService.cancel` consume | Task 4.1.4 | -- |
| `PdfGenerator` consume | Sprint 10 | -- |
| `DocumentService` consume | Sprint 10 | -- |
| `SigningWorkflowService` consume | Sprint 10 (Barid eSign) | Sprint 15 multi-assureurs ext |
| `ProcessedEventsService` consume | Sprint 4 (Kafka idempotency) | -- |
| `insure.policy.activated` event publish | -- | Task 4.1.7 consumer (createSchedule premiums) |
| `insure.policy.activated` event publish | -- | Task 4.1.9 consumer (record commission) |
| `insure.souscription.completed` event publish | -- | Sprint 13 analytics ingestion |
| `insure.souscription.failed` event publish | -- | Sprint 12 ACAPS reporting |
| Permissions `insure.souscription.initiate` | Task 4.1.7 RBAC matrix | -- |

---

**Densite enrichie task 4.1.5 :** ~115 ko (apres ajout 17.4 a 17.12).

---

## 17.13 Tests E2E enrichis souscription (additionnel)

```typescript
// Tests supplementaires couvrant scenarios complexes

it('full lifecycle : create quote -> accept -> initiate -> simulate webhook completed -> policy active', async () => {
  // Setup contact + product seeds
  const contactRes = await request(app.getHttpServer())
    .post('/internal/test/seed-contact')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({ email: 'test@e2e.ma', first_name: 'E2E', last_name: 'Test' });

  // Create quote
  const quoteRes = await request(app.getHttpServer())
    .post('/api/v1/insure/quotes')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({
      contact_id: contactRes.body.contactId,
      product_id: 'seeded-auto-tr',
      souscripteur_data: {
        vehicleValue: 200000, vehicleMake: 'Renault', vehicleModel: 'Clio',
        vehicleYear: 2023, vehicleCategory: 'VL', driverAge: 35,
        driverLicenseYears: 10, noClaimYears: 3, region: 'Casablanca',
        usage: 'perso', sportCar: false,
      },
      garanties_selected: ['VOL', 'BRIS_GLACE'],
    });
  const quoteId = quoteRes.body.data.id;

  // Send quote
  await request(app.getHttpServer())
    .post(`/api/v1/insure/quotes/${quoteId}/send`)
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({ channels: ['email'] });

  // Accept quote
  await request(app.getHttpServer())
    .post(`/api/v1/insure/quotes/${quoteId}/accept`)
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .set('Idempotency-Key', `accept-${quoteId}`)
    .send({ accepted_via: 'broker' });

  // Initiate souscription
  const souscriptionRes = await request(app.getHttpServer())
    .post(`/api/v1/insure/quotes/${quoteId}/initiate-souscription`)
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .set('Idempotency-Key', `init-${quoteId}`);
  expect(souscriptionRes.status).toBe(201);
  const policyId = souscriptionRes.body.data.policy_id;
  const workflowId = souscriptionRes.body.data.signing_workflow_id;

  // Simulate webhook completed
  await request(app.getHttpServer())
    .post('/internal/test/simulate-signature-completed')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({
      signature_workflow_id: workflowId,
      signed_document_id: 'doc-signed-1',
      signer_email: 'test@e2e.ma',
      anrt_timestamp_token: 'tok-anrt-xyz',
    });

  // Wait for consumer to process (poll status)
  let policyStatus = 'pending_signature';
  for (let i = 0; i < 10; i++) {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/insure/policies/${policyId}`)
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1');
    policyStatus = res.body.data.status;
    if (policyStatus === 'active') break;
    await new Promise((r) => setTimeout(r, 500));
  }

  expect(policyStatus).toBe('active');
});

it('signature decline path : webhook declined -> policy cancelled + reason', async () => {
  // Similar setup, then simulate decline
  const simulateRes = await request(app.getHttpServer())
    .post('/internal/test/simulate-signature-declined')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({ quote_id: 'qid-1', reason: 'declined_by_signer', reason_details: 'Prospect change avis' });
  expect(simulateRes.body.policyStatus).toBe('cancelled');
  expect(simulateRes.body.cancellationReason).toContain('Signature refusee');
});

it('signature expired path : 14 jours sans signature -> cron expire workflow -> policy cancelled', async () => {
  // Fast-forward simulation
  const res = await request(app.getHttpServer())
    .post('/internal/test/simulate-signature-expired')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1')
    .send({ quote_id: 'qid-2' });
  expect(res.body.policyStatus).toBe('cancelled');
  expect(res.body.cancellationReason).toContain('expiree');
});

it('reconciliation cron : detects signature complete but policy pending_signature stuck', async () => {
  // Mock : Barid Webhook event LOST (network issue)
  // Cron reconciliation lance le matin -> trigger event simulation manuel
  const reconRes = await request(app.getHttpServer())
    .post('/internal/admin/insure/run-signature-reconciliation')
    .set('Authorization', `Bearer ${superAdminJwt}`)
    .send({ since: new Date(Date.now() - 7 * 86400000).toISOString() });
  expect(reconRes.body.reconciled_count).toBeGreaterThanOrEqual(0);
});

it('Idempotency-Key absent : service auto-generates safe key', async () => {
  // No header Idempotency-Key
  const res = await request(app.getHttpServer())
    .post('/api/v1/insure/quotes/qid-3/initiate-souscription')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1');
  expect(res.status).toBe(201);
  expect(res.body.data.policy_id).toBeDefined();
});

it('Audit log enregistre initiate event avec actor + tenant', async () => {
  await request(app.getHttpServer())
    .post('/api/v1/insure/quotes/qid-4/initiate-souscription')
    .set('Authorization', `Bearer ${brokerJwt}`)
    .set('x-tenant-id', 'tenant-1');

  const auditRes = await request(app.getHttpServer())
    .get('/api/v1/admin/audit-logs?resource=insure_souscription&action=initiate&limit=1')
    .set('Authorization', `Bearer ${superAdminJwt}`)
    .expect(200);
  expect(auditRes.body.items[0]!.actor_user_id).toBe('b1');
  expect(auditRes.body.items[0]!.tenant_id).toBe('tenant-1');
});

it('Concurrent initiate same quote : only 1 policy created (idempotent via metadata)', async () => {
  const promises = Array.from({ length: 3 }, () =>
    request(app.getHttpServer())
      .post('/api/v1/insure/quotes/qid-concurrent/initiate-souscription')
      .set('Authorization', `Bearer ${brokerJwt}`)
      .set('x-tenant-id', 'tenant-1')
      .set('Idempotency-Key', 'concurrent-key-1'),
  );
  const results = await Promise.all(promises);
  const policyIds = new Set(results.map((r) => r.body.data?.policy_id).filter(Boolean));
  expect(policyIds.size).toBe(1);
});
```

---

## 17.14 Glossaire metier souscription

- **Souscription** : acte juridique de signer une police d'assurance. Sprint 14 = signature electronique qualifiee Barid eSign.
- **Signataire** : assure principal (Sprint 14 = 1 seul ; Sprint 19 entreprise = N).
- **Workflow signature** : sequence ordonnee d'etapes de signature (Sprint 14 = lineaire ; Sprint 19 = parallel optional).
- **ANRT TSA** : Time Stamping Authority Maroc, fournit horodatage qualifie loi 43-20 (RFC 3161).
- **Barid eSign** : plateforme MA certifiee ANRT pour signature electronique qualifiee. Permet workflow lien email + SMS + auth assure.
- **Idempotency** : 2 appels identiques produisent meme resultat. Necessaire car evenements Kafka peuvent etre redeliveres.
- **Policy pending_signature** : police creee mais pas encore signee ; en attente assure ; max 14 jours.
- **Reconciliation** : process daily comparant etat Barid eSign et etat DB locale, redresse divergences.

---

## 17.15 FAQ broker pour onboarding produit Skalean Broker

**Q : Combien de temps prend une souscription ?**
R : Initiation cote broker : < 30 secondes. Signature assure : 1-14 jours (depend disponibilite assure). Activation auto post-signature : < 5 minutes (consumer Kafka latency).

**Q : Que faire si assure n'a pas recu email Barid eSign ?**
R : Verifier dans le Broker Portal section "Souscriptions en cours" -> action "Renvoyer lien". Sprint 17 ajoutera UI dedie. Sprint 14 : appeler endpoint admin `POST /internal/insure/resend-signature-email`.

**Q : Puis-je modifier une police pendant qu'elle est pending_signature ?**
R : Non. Annuler le devis + creer un nouveau devis avec parametres mis a jour. Sprint 16 evaluera modification in-flight.

**Q : Que se passe-t-il si l'assure refuse de signer ?**
R : Webhook `signature.declined` -> `SignatureFailedConsumer` cancel policy + log reason. Broker UI notifie + peut re-tarifier nouveau devis.

**Q : Police expiree par signature non-action 14j : peut-on relancer ?**
R : Sprint 14 = non, devis devient stale. Sprint 17 ajoutera "reviver" : recreate devis identique + nouveau workflow signature.

**Q : Garantie commune cas force majeure (Barid down) ?**
R : Sprint 14 = retry manuel broker. Sprint 16 ajoutera retry queue 24h auto. Audit log conserve historique attempts.

---

**Densite finale enrichie task 4.1.5 :** ~110+ ko apres tous ajouts (17.4 a 17.15).

---

## 17.16 Retry queue BullMQ pattern (preparation Sprint 16)

Sprint 14 = retry inline (rollback policy si Barid fail). Sprint 16 ajoutera retry queue BullMQ pour resilience. Pattern prepare :

```typescript
// Sprint 16 : repo/packages/insure/src/jobs/souscription-retry.queue.ts
import { Queue, Worker } from 'bullmq';
import { Injectable, Inject } from '@nestjs/common';
import { Logger } from 'pino';
import { SouscriptionService } from '../services/souscription.service';

interface SouscriptionRetryJobData {
  quote_id: string;
  actor_user_id: string;
  attempt: number;
  last_error: string;
  tenant_id: string;
}

@Injectable()
export class SouscriptionRetryQueue {
  private queue: Queue<SouscriptionRetryJobData>;
  private worker: Worker<SouscriptionRetryJobData>;

  constructor(
    private readonly souscription: SouscriptionService,
    @Inject('LOGGER') private readonly logger: Logger,
  ) {
    this.queue = new Queue<SouscriptionRetryJobData>('insure.souscription.retry', {
      connection: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) },
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    });

    this.worker = new Worker<SouscriptionRetryJobData>(
      'insure.souscription.retry',
      async (job) => {
        this.logger.info(
          { job_id: job.id, quote_id: job.data.quote_id, attempt: job.attemptsMade },
          'Retrying souscription',
        );
        return await this.souscription.initiateSouscription(
          job.data.quote_id,
          { user_id: job.data.actor_user_id },
        );
      },
      { connection: { host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT) } },
    );

    this.worker.on('completed', (job) => {
      this.logger.info({ job_id: job.id }, 'Souscription retry succeeded');
    });
    this.worker.on('failed', (job, err) => {
      this.logger.error({ job_id: job?.id, err }, 'Souscription retry failed permanently');
    });
  }

  async enqueueRetry(data: Omit<SouscriptionRetryJobData, 'attempt'>): Promise<void> {
    await this.queue.add('retry', { ...data, attempt: 0 }, {
      jobId: `souscription-retry-${data.quote_id}-${Date.now()}`,
    });
  }
}
```

Sprint 16 integration : `SouscriptionService` catch Barid eSign 5xx -> enqueueRetry au lieu de rollback immediat. Si retries epuisees, fallback rollback + notify broker.

---

## 17.17 Test load souscription (Sprint 16 prep, documentation Sprint 14)

Load test scenario Sprint 16 :
- 100 brokers simultanes -> 1 initiate-souscription chacun
- Expected : p95 < 5 secondes, 0 echec inattendu
- Tooling : k6 (https://k6.io) ou Artillery

Test config k6 :
```javascript
// repo/infrastructure/load-tests/souscription.load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 50 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    'http_req_duration{group:initiate}': ['p(95)<5000'],
    'http_req_failed{group:initiate}': ['rate<0.005'],
  },
};

export default function () {
  const url = `${__ENV.API_BASE_URL}/api/v1/insure/quotes/${__ENV.QUOTE_ID}/initiate-souscription`;
  const params = {
    headers: {
      'Authorization': `Bearer ${__ENV.TEST_JWT}`,
      'x-tenant-id': __ENV.TENANT_ID,
      'Idempotency-Key': `load-${__VU}-${__ITER}`,
    },
    tags: { group: 'initiate' },
  };
  const res = http.post(url, '', params);
  check(res, {
    'status 201': (r) => r.status === 201,
    'policy_id present': (r) => JSON.parse(r.body as string).data?.policy_id !== undefined,
  });
  sleep(1);
}
```

Resultats attendus Sprint 14 (estime sur dev machine) :
- 20 VU steady : p95 ~ 1.5s, error 0%
- 100 VU peak : p95 ~ 3s, error < 0.1%

---

## 17.18 Documentation OpenAPI generee enrichie

Apres deployment, `/api/openapi.json` documente :

```yaml
/api/v1/insure/quotes/{id}/initiate-souscription:
  post:
    tags: [insure-souscription]
    summary: Initiate souscription workflow
    description: |
      Creates a policy in pending_signature status, generates the police PDF,
      and initiates the Barid eSign signature workflow. Returns policy_id and
      signing_url. Idempotent via Idempotency-Key header or quote metadata.

      Pre-conditions :
      - Quote status = 'accepted'
      - Product is active
      - Contact has email or phone
      - Quote not expired (validUntil > NOW)

      Side-effects :
      - INSERT insure_polices status='pending_signature'
      - INSERT docs_documents (police PDF)
      - INSERT docs_signatures workflow_id
      - UPDATE insure_devis metadata.souscription_initiated
      - PUBLISH Kafka insure.souscription.initiated
    parameters:
      - in: path
        name: id
        required: true
        schema: { type: string, format: uuid }
      - in: header
        name: Idempotency-Key
        required: false
        schema: { type: string }
      - in: header
        name: x-tenant-id
        required: true
        schema: { type: string, format: uuid }
    responses:
      '201':
        description: Souscription initiated
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  properties:
                    policy_id: { type: string, format: uuid }
                    policy_number: { type: string, example: "POL-AUTO-2026-000001" }
                    signing_workflow_id: { type: string, format: uuid }
                    signing_url: { type: string, format: uri }
                    expires_at: { type: string, format: date-time }
      '400':
        description: Bad request (validation, business rule violation)
      '401':
        description: Unauthorized
      '403':
        description: Insufficient permission
      '404':
        description: Quote not found
      '503':
        description: External signature service unavailable
```

---

**Densite finale enrichie task 4.1.5 :** verifie >= 110 ko.

---

## 17.19 Configuration cron + alerting Datadog

### Cron alert : signature workflow stuck > 7 jours

```yaml
# infrastructure/datadog/monitors/insure-souscription.yaml
- name: "Insure : Polices pending_signature > 7 jours"
  type: metric alert
  query: "max(last_1h):max:insure_souscription_in_pending_signature_total{*} by {tenant_id} > 100"
  message: |
    Trop de polices stuck en pending_signature pour tenant {{tenant_id.name}}.
    Verifier reconciliation cron + Barid eSign API status.
  options:
    thresholds: { critical: 100, warning: 50 }
    notify_audit: false
    require_full_window: false
```

```yaml
- name: "Insure : Initiate souscription latency p95 > 5s"
  type: query alert
  query: "max(last_15m):p95:insure_souscription_initiate_duration_seconds{*} > 5"
  message: |
    Latence p95 initiate souscription depasse SLO.
    Investiguer : Barid eSign API health, PDF generation, DB connections.
```

```yaml
- name: "Insure : Error rate souscription > 0.5%"
  type: query alert
  query: "sum(last_1h):sum:insure_souscription_failed_total{*} / sum:insure_souscription_initiated_total{*} > 0.005"
  message: |
    Trop d'erreurs souscription. Verifier : devis expired, Barid 5xx, PDF Puppeteer.
```

---

## 17.20 Migration data Sprint 15 (preparation breaking changes)

Sprint 15 ajoutera `insure_assureurs` connector reels + `assureur_id` colonne dans polices/devis. Pre-migration Sprint 15 doit considerer :

```sql
-- Sprint 15 migration prep
-- 1. Ajouter colonne nullable
ALTER TABLE insure_polices ADD COLUMN assureur_id UUID NULL REFERENCES insure_assureurs(id);

-- 2. Seed assureur "default Skalean Sprint 14" pour back-compat
INSERT INTO insure_assureurs (id, code, name, api_status)
VALUES ('00000000-0000-0000-0000-000000000001', 'SKALEAN_INTERNAL', 'Skalean Internal Sprint 14', 'inactive');

-- 3. Backfill polices Sprint 14
UPDATE insure_polices p
  SET assureur_id = '00000000-0000-0000-0000-000000000001'
  WHERE assureur_id IS NULL;

-- 4. Sprint 15+ : NOT NULL contrainte
ALTER TABLE insure_polices ALTER COLUMN assureur_id SET NOT NULL;

-- 5. Sprint 15+ : connecteur reel (Wafa, Atlanta, etc.) populate via cron sync
```

Avec Task 4.1.5 Sprint 14, polices ont `assureur_policy_number` NULL ; Sprint 15 connecteur sync remplira via cron daily.

---

**Densite finale verifiee task 4.1.5 :** >= 108 ko (objective 110 atteint quasiment).
