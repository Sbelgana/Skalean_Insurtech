# META-PROMPT B-15 -- SPRINT 15 INSURE LIFECYCLE POLICE AVANCE

**Version** : v2.2 (Option B -- post decision-010 cascade renumerotation)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 15 / 35 (cumul) -- Phase 4 Sprint 2
**Position** : Apres Insure Foundation, avant Web Broker App
**Numerotation taches** : 4.2.1 a 4.2.13
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (lifecycle avance critical pour V1 production)

---

## Objectif Global du Sprint

Etendre le lifecycle police Sprint 14 avec **operations avancees** : transferts (changement souscripteur), fractionnement primes en cours d'annee, suspensions temporaires + reprises, resiliations anticipees avec remboursement pro-rata, polices flottes (multi-objets), endossements specifiques par branche, **workflow validation courtier** pour souscriptions venant de web-customer-portal (Sprint 17), **document provisoire** post-KYC.

A la sortie de ce sprint :
- Transferts polices (changement souscripteur entre contacts) avec workflow signature double
- Fractionnement primes en cours d'annee (annual -> monthly conversion)
- Suspensions temporaires + reprises (vehicule en panne, voyage longue duree)
- Resiliations anticipees avec computation remboursement pro-rata
- Polices flottes (1 police, N objets : vehicules, employes, biens)
- Endossements specifiques (changement vehicule sur police auto, ajout conducteur, etc.)
- BrokerValidationQueueService : file d'attente dossiers web-customer-portal SLA 24h
- ProvisionalPolicyService : doc provisoire 7 jours TTL post-pre-approbation
- Audit trail enrichi tous workflows
- Tests E2E exhaustifs cas avances

---

## Frontiere du Sprint

**INCLUS** :
- Transferts polices entre souscripteurs
- Fractionnement primes runtime
- Suspensions + reprises
- Resiliations anticipees
- Polices flottes (multi-objets)
- Endossements specifiques par branche
- BrokerValidationQueueService (workflow validation manual)
- ProvisionalPolicyService (provisoire 7 jours)
- Endpoints REST avances
- Tests E2E

**EXCLU** (sera ajoute aux sprints suivants) :
- UI broker pour ces operations -- Sprint 16 Web Broker App
- UI client pour suivre transferts -- Sprint 17/18
- Connecteurs assureurs : push transferts/endossements -- Sprint 32 (Phase 7)
- IA-suggested decisions transferts/endossements -- Sprint 30+ defere

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 14 : 7 entites Insure + tarification + lifecycle basique
2. Sortie Sprint 10 : Barid eSign + ANRT timestamp + archive
3. Sortie Sprint 11 : Pay refunds (resiliation = refund pro-rata)
4. Sortie Sprint 12 : Books journal entries (impacts comptables operations)

---

## Stack Imposee (Sprint 15)

| Composant | Version | Notes |
|-----------|---------|-------|
| decimal.js | 10.4.3 | precision computations pro-rata + frais |
| date-fns | 4.1.0 | manipulation periodes police |
| zod | 3.24.1 | validation operations workflows |

Pas de nouvelle dep externe.

---

## Vue d'Ensemble des 13 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 4.2.1 | Transfer entity + service (changement souscripteur, workflow signature double) | 6h | P0 | Sprint 14 |
| 4.2.2 | Fractionnement primes runtime (annual -> monthly mid-year) | 5h | P0 | 4.2.1 |
| 4.2.3 | Suspension service (suspension temporaire + reprise) | 6h | P0 | 4.2.2 |
| 4.2.4 | Resiliation anticipee + remboursement pro-rata | 6h | P0 | 4.2.3 |
| 4.2.5 | Polices flottes : entity + service (1 police, N objets) | 7h | P0 | 4.2.4 |
| 4.2.6 | Endossements auto : changement vehicule, ajout conducteur | 6h | P0 | 4.2.5 |
| 4.2.7 | Endossements sante : ajout/retrait beneficiaires | 5h | P0 | 4.2.6 |
| 4.2.8 | Endossements habitation/RC pro/voyage : modifications biens declares | 5h | P0 | 4.2.7 |
| 4.2.9 | BrokerValidationQueueService (file d'attente web-customer-portal SLA 24h) | 6h | P0 | 4.2.8 |
| 4.2.10 | ProvisionalPolicyService (doc provisoire post-pre-approbation, TTL 7j) | 6h | P0 | 4.2.9 |
| 4.2.11 | Endpoints REST avances + permissions enrichies | 5h | P0 | 4.2.10 |
| 4.2.12 | Audit trail enrichi + Kafka events workflows | 4h | P0 | 4.2.11 |
| 4.2.13 | Tests E2E (50+) + fixtures cas complexes | 8h | P0 | 4.2.12 |

**Total** : 75 heures.

---

# DETAIL DES 13 TACHES

---

## Tache 4.2.1 -- Transfer Entity + Workflow Signature Double

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 6h / Depend de Sprint 14

**But** : Permettre transfert police d'un souscripteur a un autre (vente vehicule, succession, mutation entreprise) avec workflow signature double (cedant + cessionnaire).

**Contexte** : Cas frequent : assure vend vehicule -> nouveau proprietaire reprend police restante. Implique transfert juridique police (consentement deux parties) + impacts comptables (commissions deja perc ues OK, mais attribution change).

**Livrables checkables** :
- [ ] Migration : table `insure_transfers` :
  - id, tenant_id, policy_id (FK), from_contact_id, to_contact_id, transfer_date, status (enum 'pending_signatures' | 'completed' | 'cancelled' | 'rejected'), signing_workflow_id (FK Sprint 10), reason, transfer_doc_id, completed_at, cancelled_at, cancelled_reason, created_by
- [ ] Service `transfers.service.ts` :
  - `initiateTransfer(policyId, toContactId, reason, transferDate)` -- creates pending row + generate transfer doc PDF + signing workflow Barid avec 2 signers
  - `markCompleted(transferId)` -- consumer signature workflow_completed
  - `cancel(transferId, reason)` -- avant completion
- [ ] Conditions transfert :
  - Police status='active' uniquement
  - Pas de transfer pending sur meme police
  - to_contact existe + meme tenant
  - transfer_date >= today
- [ ] Workflow signature : 2 signers (cedant order=1, cessionnaire order=2) sequential
- [ ] Apres signature complete :
  - Update `policy.contact_id = to_contact_id`
  - Snapshot history dans audit_log (qui etait souscripteur avant)
  - Generate transfer certificate PDF + archive (ANRT timestamp)
  - Notification Comm aux 2 contacts (Sprint 9)
- [ ] Endpoints :
  - `POST /api/v1/insure/policies/:id/transfer` (initiate)
  - `GET /api/v1/insure/transfers/:id`
  - `POST /api/v1/insure/transfers/:id/cancel`
- [ ] Permissions : `insure.policies.transfer`
- [ ] Audit + Kafka events `insure.transfer_initiated/completed/cancelled`
- [ ] Tests : full workflow + cancel + signature decline

**Pattern critique : workflow transfer double signature**

```typescript
// repo/packages/insure/src/services/transfers.service.ts
async initiateTransfer(
  policyId: string,
  toContactId: string,
  reason: string,
  transferDate: Date,
): Promise<Transfer> {
  // 1. Validation
  const policy = await this.policiesService.findById(policyId);
  if (policy.status !== 'active') {
    throw new BadRequestException({ code: 'POLICY_NOT_ACTIVE' });
  }

  const existing = await this.transfersRepo.findOne({
    where: { policy_id: policyId, status: 'pending_signatures' },
  });
  if (existing) {
    throw new BadRequestException({ code: 'TRANSFER_PENDING_EXISTS' });
  }

  const fromContact = await this.contactsService.findById(policy.contact_id);
  const toContact = await this.contactsService.findById(toContactId);

  // 2. Generate transfer document PDF
  const pdfBuffer = await this.pdfGenerator.generate('transfer-cession', fromContact.preferred_language, {
    policy, fromContact, toContact, transferDate, reason,
  });
  const pdfDoc = await this.documentService.create({
    type: 'contrat', title: `Transfert ${policy.policy_number}`, file: pdfBuffer,
    related_resource_type: 'insure_transfer', related_resource_id: null,
  });

  // 3. Create transfer row
  const transfer = await this.transfersRepo.save({
    tenant_id: getCurrentTenantId(),
    policy_id: policyId,
    from_contact_id: policy.contact_id,
    to_contact_id: toContactId,
    transfer_date: transferDate,
    status: 'pending_signatures',
    transfer_doc_id: pdfDoc.id,
    reason,
    created_by: getCurrentUserId(),
  });

  // 4. Create signing workflow with 2 signers SEQUENTIAL
  const signingWorkflow = await this.signingWorkflowService.createWorkflow(pdfDoc.id, [
    {
      name: `${fromContact.first_name} ${fromContact.last_name}`,
      email: fromContact.email, phone: fromContact.phone,
      role: 'signer', order: 1,  // cedant signe en premier
    },
    {
      name: `${toContact.first_name} ${toContact.last_name}`,
      email: toContact.email, phone: toContact.phone,
      role: 'signer', order: 2,  // cessionnaire signe apres
    },
  ], { signature_type: 'qualified', expires_in_days: 14 });

  await this.signingWorkflowService.sendForSignature(signingWorkflow.id);

  await this.transfersRepo.update(transfer.id, { signing_workflow_id: signingWorkflow.id });
  await this.kafkaPublisher.publish(Topics.INSURE_TRANSFER_INITIATED, { /* ... */ });

  return transfer;
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsureTransfers.ts                 # ~50 lignes
repo/packages/insure/src/entities/insure-transfer.entity.ts                      # ~50 lignes
repo/packages/insure/src/services/transfers.service.ts                           # ~250 lignes
repo/packages/docs/src/templates/{fr,ar-MA,ar}/transfer-cession.hbs                # 3 templates
repo/apps/api/src/modules/insure/controllers/transfers.controller.ts            # ~120 lignes
```

**Notes implementation** :
- Workflow sequential : cedant signe d'abord, cessionnaire ensuite (Barid eSign sequential mode)
- Si cessionnaire decline : transfer cancelled + police reste a from_contact
- Commission deja percue : pas reattribution (payee a moment souscription origine)
- Transfer date future : police passe au nouveau proprio a cette date (cron check)

**Criteres validation** :
- V1 (P0) : Initiate transfer cree row + PDF + signing workflow 2 signers
- V2 (P0) : Police pas active rejete
- V3 (P0) : Pending existant rejete
- V4 (P0) : Apres 2 signatures : policy.contact_id update + audit
- V5 (P0) : Notification Comm aux 2 parties
- V6 (P0) : Cancel avant completion OK
- V7 (P0) : Signature decline 1 signer : transfer cancelled
- V8 (P0) : Tests 12+ scenarios

---

## Tache 4.2.2 -- Fractionnement Primes Runtime

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 5h / Depend de 4.2.1

**But** : Permettre conversion mid-year d'un fractionnement (e.g. annuel -> mensuel) avec recalcul echeancier + frais conversion.

**Livrables checkables** :
- [ ] Service `fractionnement.service.ts`
- [ ] Method `changeFrequency(policyId, newFrequency: 'monthly' | 'quarterly' | 'annual', effectiveDate)`:
  1. Validation : police active
  2. Cancel premiums futurs status='pending'
  3. Recompute prime restante (proportionnelle jours restants)
  4. Apply frais conversion (3% par defaut)
  5. Generate new echeancier mensuel/trimestriel/annuel
  6. Audit + Kafka event
- [ ] Frais conversion : configurable per tenant (default 3%)
- [ ] Endpoint `POST /api/v1/insure/policies/:id/change-frequency`
- [ ] Permissions : `insure.premiums.change_frequency`
- [ ] Tests : conversion all combos + frais correct

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/fractionnement.service.ts                    # ~200 lignes
repo/apps/api/src/modules/insure/controllers/fractionnement.controller.ts      # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : Change annual -> monthly recompute echeancier
- V2 (P0) : Frais 3% applique
- V3 (P0) : Premiums futurs cancelled
- V4 (P0) : Tests 8+ scenarios

---

## Tache 4.2.3 -- Suspension Temporaire + Reprise

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 6h / Depend de 4.2.2

**But** : Permettre suspension temporaire police (vehicule en panne, voyage long) + reprise ulterieure avec ajustements pro-rata.

**Livrables checkables** :
- [ ] Migration : ajouter colonnes `insure_policies.suspended_at`, `suspended_until`, `suspension_reason`, `resumed_at`
- [ ] Service `suspension.service.ts` :
  - `suspend(policyId, fromDate, untilDate, reason)` -- transition status -> 'suspended'
  - `resume(policyId, resumeDate)` -- transition status -> 'active' + recompute end_date (extension pro-rata)
- [ ] Conditions :
  - Suspension max 6 mois (configurable per tenant)
  - Pas de claim possible pendant suspension
  - Pendant suspension : pas de premium dus (auto-cancel premiums futurs sur range)
- [ ] Endpoints :
  - `POST /api/v1/insure/policies/:id/suspend`
  - `POST /api/v1/insure/policies/:id/resume`
- [ ] Status workflow : active -> suspended -> active (avec extension end_date)
- [ ] Notifications Comm aux assures
- [ ] Tests : suspend + resume + impacts premiums + extension end_date

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-AddSuspensionColumns.ts            # ~30 lignes
repo/packages/insure/src/services/suspension.service.ts                          # ~200 lignes
repo/apps/api/src/modules/insure/controllers/suspension.controller.ts            # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : Suspend transition status + cancel premiums futurs
- V2 (P0) : Resume restore status + extension end_date
- V3 (P0) : Suspension > 6 mois rejetee
- V4 (P0) : Tests 8+ scenarios

---

## Tache 4.2.4 -- Resiliation Anticipee + Remboursement Pro-Rata

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 6h / Depend de 4.2.3

**But** : Resiliation police avant end_date avec computation remboursement pro-rata + frais resiliation + integration Pay refund.

**Livrables checkables** :
- [ ] Service `resiliation.service.ts`
- [ ] Method `cancel(policyId, reason, effectiveDate): { refundAmount, breakdown }`:
  1. Validation : police active, pas de claim en cours
  2. Compute days_remaining = (end_date - effectiveDate)
  3. Compute prime_unused_pro_rata = prime_annuelle * (days_remaining / 365)
  4. Apply frais resiliation : 5% de prime_unused (configurable)
  5. refund_amount = prime_unused - frais
  6. Si refund > 0 : initiate Pay refund (Sprint 11)
  7. Update policy status = 'cancelled', set cancelled_at, cancelled_reason
  8. Audit + Kafka events
- [ ] Cas particuliers (conformite legale MA) :
  - **Loi 17-99 article 9 -- droit retractation 30 jours** : Resiliation < 30 jours apres souscription -> **remboursement integral** (no penalty, no frais)
    - Source legale : [Loi n 17-99 portant Code des Assurances MA](https://acaps.ma/sites/default/files/textes/loi-17-99.pdf) -- article 9 droit assure de revoquer
    - Applicable : assures particuliers (B2C uniquement, pas B2B selon decret application)
    - Test : `daysFromStart <= 30` -> refund = prime integrale
  - Resiliation suite sinistre majeur : pas de penalty (reglementaire ACAPS)
  - Resiliation par assureur (non-paiement) : pas remboursement (article 17-99 article 13)
  - Resiliation a echeance par assure : preavis 30j obligatoire (article 17-99 article 11)
- [ ] **Tracking conformite 17-99** :
  - Field `policies.is_b2c` flag (boolean) -- determine si droit retract applicable
  - Field `policies.cancellation_legal_basis` (enum : 'droit_retract_17_99' | 'pro_rata' | 'sinistre_major' | 'unpaid' | 'echeance_preavis')
  - Audit log conformite : tracage cas + montants pour audit ACAPS Sprint 28
- [ ] Endpoint `POST /api/v1/insure/policies/:id/cancel`
- [ ] Notifications Comm + email confirmation refund
- [ ] Tests : pro-rata correct, frais 5%, droit retract, decimal.js precision

**Pattern critique : computation pro-rata avec edge cases**

```typescript
// repo/packages/insure/src/services/resiliation.service.ts
async cancel(
  policyId: string,
  reason: string,
  effectiveDate: Date,
): Promise<{ refundAmount: Decimal; breakdown: any }> {
  const policy = await this.policiesService.findById(policyId);

  if (policy.status !== 'active') {
    throw new BadRequestException({ code: 'POLICY_NOT_ACTIVE' });
  }

  const daysFromStart = differenceInDays(effectiveDate, policy.start_date);
  const totalDuration = differenceInDays(policy.end_date, policy.start_date);
  const daysRemaining = totalDuration - daysFromStart;

  if (daysRemaining < 0) {
    throw new BadRequestException({ code: 'EFFECTIVE_DATE_AFTER_END' });
  }

  const prime = new Decimal(policy.prime_annuelle);
  let refund = new Decimal(0);
  let fees = new Decimal(0);

  // Cas droit retract MA (loi assurance) : 30 jours apres souscription
  if (daysFromStart <= 30) {
    refund = prime;  // remboursement integral
    fees = new Decimal(0);
  } else {
    const proRataUnused = prime.mul(daysRemaining).div(totalDuration);
    fees = proRataUnused.mul('0.05');  // 5% frais resiliation
    refund = proRataUnused.minus(fees);
  }

  return await this.dataSource.transaction(async (em) => {
    // Update policy
    await em.update(InsurePolicy, policyId, {
      status: 'cancelled',
      cancelled_at: new Date(),
      cancelled_reason: reason,
      end_date: effectiveDate,
    });

    // Cancel future premiums
    await em.update(InsurePremium, { policy_id: policyId, status: 'pending' }, { status: 'cancelled' });

    // Initiate refund via Pay (Sprint 11)
    if (refund.gt(0)) {
      const lastTxn = await em.findOne(PayTransaction, {
        where: { related_resource_type: 'insure_policy', related_resource_id: policyId },
        order: { initiated_at: 'DESC' },
      });
      if (lastTxn) {
        await this.refundService.requestRefund(lastTxn.id, refund.toNumber(), `Resiliation police ${policy.policy_number}: ${reason}`);
      }
    }

    await this.kafkaPublisher.publish(Topics.INSURE_POLICY_CANCELLED, { /* ... */ });

    return {
      refundAmount: refund,
      breakdown: {
        prime_annuelle: prime, days_total: totalDuration, days_remaining: daysRemaining,
        pro_rata_unused: prime.mul(daysRemaining).div(totalDuration), fees, refund,
        is_retract: daysFromStart <= 30,
      },
    };
  });
}
```

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/resiliation.service.ts                       # ~250 lignes
repo/packages/insure/src/services/resiliation.service.spec.ts                  # ~200 lignes
repo/apps/api/src/modules/insure/controllers/resiliation.controller.ts         # ~80 lignes
```

**Criteres validation** :
- V1 (P0) : Pro-rata calcul correct (decimal.js)
- V2 (P0) : Frais 5% applique
- V3 (P0) : Droit retract 30 jours integral
- V4 (P0) : Refund initiate via Pay Sprint 11
- V5 (P0) : Premiums futurs cancelled
- V6 (P0) : Status workflow respect
- V7 (P0) : Tests 12+ scenarios edge cases

---

## Tache 4.2.5 -- Polices Flottes (1 Police, N Objets)

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 7h / Depend de 4.2.4

**But** : Polices flottes pour entreprises : 1 police = N objets assures (vehicules entreprise, employes assurance groupe, biens immobiliers multiples).

**Livrables checkables** :
- [ ] Migration : table `insure_policy_objects` :
  - id, policy_id (FK), object_type (enum 'vehicle' | 'employee' | 'property' | 'equipment'), object_data (jsonb : details specifiques par type), prime_share (numeric : part de la prime totale), garanties_specifiques (jsonb), added_at, removed_at, removed_reason
- [ ] Service `flotte.service.ts` :
  - `addObject(policyId, objectType, objectData)` -- ajout objet a flotte (recalcul prime + complement pro-rata)
  - `removeObject(objectId, reason)` -- retrait (refund pro-rata)
  - `listObjects(policyId)` -- liste objets actifs
  - `findById(objectId)`
- [ ] Compute prime totale = sum(objects.prime_share)
- [ ] Endossement signature requis pour ajout/retrait objet (workflow Sprint 10)
- [ ] Endpoints :
  - `POST /api/v1/insure/policies/:id/objects`
  - `GET /api/v1/insure/policies/:id/objects`
  - `DELETE /api/v1/insure/policies/:id/objects/:objectId`
- [ ] Pour Sprint 14 lifecycle "single object" : auto-cree 1 objet flotte size=1 (compatible API)
- [ ] Tests : add + remove + recompute prime

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsurePolicyObjects.ts            # ~50 lignes
repo/packages/insure/src/entities/insure-policy-object.entity.ts                # ~40 lignes
repo/packages/insure/src/services/flotte.service.ts                              # ~250 lignes
repo/apps/api/src/modules/insure/controllers/flotte.controller.ts               # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Add object recompute prime totale
- V2 (P0) : Remove object refund pro-rata
- V3 (P0) : Endossement signature trigger
- V4 (P0) : 4 object types supportes
- V5 (P0) : Tests 10+ scenarios

---

## Tache 4.2.6 -- Endossements Auto

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 6h / Depend de 4.2.5

**But** : Endossements specifiques branche auto : changement vehicule, ajout/retrait conducteur, changement usage (perso/pro).

**Livrables checkables** :
- [ ] Service `endossements-auto.service.ts` :
  - `changeVehicle(policyId, oldVehicleData, newVehicleData)` -- transfer garanties + recalcul prime
  - `addDriver(policyId, driverData)` -- ajout conducteur (impact tarif si jeune)
  - `removeDriver(policyId, driverId)`
  - `changeUsage(policyId, newUsage: 'private' | 'professional' | 'mixed')`
- [ ] Pattern : utilise avenants Sprint 14 + service flotte Sprint 4.2.5
- [ ] Recalcul prime via TarificationService (chaque changement impact tarif)
- [ ] Workflow signature avenant
- [ ] Endpoints :
  - `POST /api/v1/insure/policies/:id/auto/change-vehicle`
  - `POST /api/v1/insure/policies/:id/auto/drivers` (add)
  - `DELETE /api/v1/insure/policies/:id/auto/drivers/:driverId`
  - `POST /api/v1/insure/policies/:id/auto/change-usage`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/endossements/auto-endossements.service.ts    # ~250 lignes
repo/apps/api/src/modules/insure/controllers/auto-endossements.controller.ts   # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Change vehicle recompute prime
- V2 (P0) : Add driver impact tarif si jeune
- V3 (P0) : Change usage perso -> pro recompute (tarif pro souvent +)
- V4 (P0) : Workflow signature avenant
- V5 (P0) : Tests 10+ scenarios

---

## Tache 4.2.7 -- Endossements Sante

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 5h / Depend de 4.2.6

**But** : Endossements sante : ajout/retrait beneficiaires (conjoint, enfants, ascendants).

**Livrables checkables** :
- [ ] Service `endossements-sante.service.ts` :
  - `addBeneficiaire(policyId, beneficiaireData, relation: 'spouse' | 'child' | 'parent')` -- ajout couvert
  - `removeBeneficiaire(policyId, beneficiaireId)` -- retrait
  - `updateBeneficiaireData(policyId, beneficiaireId, data)` -- update donnees medicales declarees
- [ ] Recalcul prime via TarificationService (chaque beneficiaire ajoute prime)
- [ ] Limites : max 5 beneficiaires (configurable), enfants jusqu'a 25 ans
- [ ] Workflow signature avenant
- [ ] Endpoints similaires Tache 4.2.6
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/endossements/sante-endossements.service.ts   # ~200 lignes
repo/apps/api/src/modules/insure/controllers/sante-endossements.controller.ts   # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Add beneficiaire recompute prime
- V2 (P0) : Limit max 5 beneficiaires
- V3 (P0) : Enfants > 25 ans rejete (sauf certificat scolarite/handicap)
- V4 (P0) : Tests 8+ scenarios

---

## Tache 4.2.8 -- Endossements Habitation/RC Pro/Voyage

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 5h / Depend de 4.2.7

**But** : Endossements specifiques branches restantes : habitation (modification biens declares), RC pro (changement activite), voyage (extension destination).

**Livrables checkables** :
- [ ] Service `endossements-habitation.service.ts` :
  - `updateBiensDeclares(policyId, newBiensList)` -- recalcul prime selon valeur biens
  - `changeAdresse(policyId, newAddress)` -- impact tarif zone
- [ ] Service `endossements-rc-pro.service.ts` :
  - `changeActivite(policyId, newActivity)` -- recalcul tarif risque
- [ ] Service `endossements-voyage.service.ts` :
  - `extendDestination(policyId, newDestinations)` -- recalcul prime
  - `extendDuration(policyId, newEndDate)` -- prolongement
- [ ] Workflow signature avenant pour tous
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/insure/src/services/endossements/{3 services}.ts                 # ~600 lignes total
repo/apps/api/src/modules/insure/controllers/{3 controllers}.ts                 # ~300 lignes total
```

**Criteres validation** :
- V1 (P0) : Habitation update biens recompute
- V2 (P0) : RC pro change activite recompute
- V3 (P0) : Voyage extend destination + duration
- V4 (P0) : Tests 12+ scenarios

---

## Tache 4.2.9 -- BrokerValidationQueueService (File Web-Customer-Portal)

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 6h / Depend de 4.2.8

**But** : Workflow validation manual broker pour souscriptions arrivant du flux web-customer-portal (Sprint 17 client-side). File d'attente, SLA 24h, validation/rejet.

**Contexte** : Sprint 17 web-customer-portal permettra a client de souscrire en ligne (vente directe). Souscription va dans queue broker pour validation manuelle (KYC + risque + completeness data) avant push assureur. SLA 24h ouvrables : si broker pas valide -> escalade super admin tenant.

**Livrables checkables** :
- [ ] Migration : table `insure_broker_validation_queue` :
  - id, tenant_id, quote_id (FK insure_quotes), source (enum 'web_portal' | 'manual_creation' | 'partner_api'), customer_data (jsonb), priority (int 1-5), status (enum 'pending' | 'in_review' | 'validated' | 'rejected' | 'escalated' | 'expired'), assigned_to (FK auth_users), assigned_at, validated_at, rejected_at, rejected_reason, escalated_at, sla_due_at (timestamp), created_at
- [ ] Service `broker-validation-queue.service.ts` :
  - `enqueue(quoteId, source, customerData, priority)` -- INSERT row pending
  - `assign(queueId, brokerId)` -- transition pending -> in_review
  - `validate(queueId)` -- transition -> validated + trigger souscription Sprint 14
  - `reject(queueId, reason)` -- transition -> rejected + notify customer
  - `escalate(queueId)` -- cron auto-escalate si > SLA 24h
- [ ] SLA 24h ouvrables : compute working days only (exclu weekend, holidays MA Tache 3.1.11)
- [ ] Cron job hourly : check pending > SLA -> escalate
- [ ] Notifications :
  - Broker recoit email/WA quand nouveau dossier assigne
  - Customer recoit email confirmation submitted + delais 24h
  - Super admin alerte sur escalation
- [ ] Endpoints :
  - `GET /api/v1/insure/broker/queue` (list per broker)
  - `POST /api/v1/insure/broker/queue/:id/assign` (auto-assignment ou manual)
  - `POST /api/v1/insure/broker/queue/:id/validate`
  - `POST /api/v1/insure/broker/queue/:id/reject`
- [ ] Permissions : `insure.broker_queue.read/validate/reject`
- [ ] Tests : workflow + SLA + escalation

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-BrokerValidationQueue.ts          # ~50 lignes
repo/packages/insure/src/entities/insure-broker-validation-queue.entity.ts      # ~50 lignes
repo/packages/insure/src/services/broker-validation-queue.service.ts             # ~280 lignes
repo/packages/insure/src/jobs/sla-escalation-cron.ts                              # ~80 lignes
repo/apps/api/src/modules/insure/controllers/broker-queue.controller.ts          # ~150 lignes
```

**Notes implementation** :
- Auto-assignment round-robin entre brokers actifs
- Priority : KYC complet + customer connu existing -> priority 1 (rapid validation)
- KYC missing : priority 5 (defer)
- SLA 24h ouvrables : eviter escalation weekend
- Sprint 17 web-customer-portal connectera ce service en upstream

**Criteres validation** :
- V1 (P0) : Enqueue cree row + notify broker
- V2 (P0) : Assign transition + email broker
- V3 (P0) : Validate -> trigger souscription Sprint 14
- V4 (P0) : Reject -> notify customer
- V5 (P0) : Cron escalation > 24h
- V6 (P0) : SLA working days only (exclu weekend MA)
- V7 (P0) : Tests 10+ scenarios

---

## Tache 4.2.10 -- ProvisionalPolicyService (Doc Provisoire 7 Jours)

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 6h / Depend de 4.2.9

**But** : Apres pre-approbation KYC web-customer-portal Sprint 17, generer document provisoire (TTL 7 jours) permettant assure d'avoir preuve assurance temporaire pendant attente police definitive emise (post-validation broker + push assureur).

**Contexte** : Use case Sprint 17 client : "je veux mon attestation auto immediatement pour pouvoir conduire demain". Document provisoire genere en quelques secondes apres pre-approbation auto KYC + signature electronique. Si broker rejette ulterieurement, doc provisoire revoque.

**Livrables checkables** :
- [ ] Migration : table `insure_provisional_policies` :
  - id, tenant_id, queue_id (FK broker_validation_queue), provisional_number (UNIQUE), garanties_provisional (jsonb : minimum garanties RC obligatoire), valid_from, valid_until (TTL 7 jours), prime_provisional (numeric : prime estimee non engageant), status (enum 'active' | 'replaced' | 'revoked'), provisional_doc_id (FK), final_policy_id (FK insure_policies, nullable), revoked_at, revoked_reason
- [ ] Service `provisional-policy.service.ts` :
  - `generate(queueId): Promise<ProvisionalPolicy>` -- create row + generate PDF + sign Barid eSign + envoi customer
  - `replace(provisionalId, finalPolicyId)` -- une fois police definitive emise
  - `revoke(provisionalId, reason)` -- si broker rejette validation
- [ ] PDF provisoire : utilise PdfGenerator + template `attestation-provisoire.hbs`
- [ ] Signature : Barid eSign signature_type='simple' (vs qualified) -- doc provisoire pas valeur juridique permanente
- [ ] TTL 7 jours : cron daily revoque expired
- [ ] Document marque "PROVISIONAL" + watermark + QR code verification
- [ ] Conditions :
  - Pre-approbation KYC reussit (data customer complete + verification CIN basique)
  - Pas d'antecedents suspects (anti-fraude basique Sprint 11 fraud rules)
- [ ] Endpoints :
  - `POST /api/v1/insure/provisional/generate` (called by Sprint 17 web-customer-portal)
  - `GET /api/v1/insure/provisional/:id`
  - `POST /api/v1/insure/provisional/:id/revoke`
- [ ] Tests : generate + replace + revoke + expiry

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-InsureProvisionalPolicies.ts      # ~50 lignes
repo/packages/insure/src/entities/insure-provisional-policy.entity.ts            # ~50 lignes
repo/packages/insure/src/services/provisional-policy.service.ts                   # ~250 lignes
repo/packages/insure/src/jobs/provisional-expiry-cron.ts                          # ~60 lignes
repo/packages/docs/src/templates/{fr,ar-MA,ar}/attestation-provisoire.hbs        # 3 templates
repo/apps/api/src/modules/insure/controllers/provisional-policy.controller.ts    # ~100 lignes
```

**Notes implementation** :
- Watermark "DOCUMENT PROVISOIRE" : eviter usage frauduleux
- QR code -> verification publique Sprint 10 (verify-doc/:hash)
- Signature simple Barid : rapide (3min vs 24h pour qualified)
- Replace flow : final_policy_id set + status='replaced' (preserve audit trail)
- Sprint 17 web-customer-portal triggera generation post-pre-approval

**Criteres validation** :
- V1 (P0) : Generate cree provisional + PDF + signature
- V2 (P0) : TTL 7 jours respecte (cron expire)
- V3 (P0) : Replace lien final policy
- V4 (P0) : Revoke si broker reject
- V5 (P0) : Watermark "PROVISOIRE" present
- V6 (P0) : QR code verification fonctionne
- V7 (P0) : Tests 8+ scenarios

---

## Tache 4.2.11 -- Endpoints REST Avances + Permissions Enrichies

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 5h / Depend de 4.2.10

**But** : Consolidation endpoints REST + ajout permissions specifiques Sprint 15 dans matrice RBAC Sprint 7.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] Permissions ajoutees catalog Sprint 7 :
  - `insure.policies.transfer`
  - `insure.policies.suspend / resume`
  - `insure.policies.cancel_anticipated`
  - `insure.policies.endossement`
  - `insure.flotte.add_object / remove_object`
  - `insure.broker_queue.read / validate / reject`
  - `insure.provisional.generate / revoke`
- [ ] Update PermissionsMatrix : roles broker_admin/user/assistant enrichis
- [ ] Audit + Kafka events tous nouveaux operations
- [ ] Tests permissions

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permissions.enum.ts                               # update
repo/packages/auth/src/rbac/permissions-matrix.ts                              # update
repo/apps/api/test/insure/sprint-15-permissions.e2e-spec.ts                   # tests
```

**Criteres validation** :
- V1 (P0) : 12+ permissions Sprint 15 ajoutees
- V2 (P0) : Roles broker_* enrichis
- V3 (P0) : Tests RBAC 10+ scenarios

---

## Tache 4.2.12 -- Audit Trail Enrichi + Kafka Events

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 4h / Depend de 4.2.11

**But** : Audit trail complete tous workflows Sprint 15 + Kafka events publies pour chaque transition critique.

**Livrables checkables** :
- [ ] Tous events Kafka publies :
  - `insure.transfer_initiated/completed/cancelled`
  - `insure.fractionnement_changed`
  - `insure.policy_suspended/resumed`
  - `insure.policy_cancelled_anticipated`
  - `insure.flotte_object_added/removed`
  - `insure.endossement_*` (per branche)
  - `insure.broker_queue_*`
  - `insure.provisional_*`
- [ ] audit_log row pour chaque operation : action + resource + before/after diff
- [ ] Sprint 13 Analytics ETL : sync nouvelles tables vers ClickHouse (insure_transfers, etc.)
- [ ] Dashboards : nouveau dashboard "Insure Operations" (operations Sprint 15 metriques)
- [ ] Tests : verifier audit + Kafka pour chaque operation

**Fichiers crees / modifies** :
```
repo/packages/analytics/src/etl/postgres-to-clickhouse.etl.ts                  # update : add tables Sprint 15
repo/apps/api/src/modules/analytics/services/insure-operations-dashboard.service.ts # ~150 lignes
repo/apps/api/test/insure/sprint-15-audit.e2e-spec.ts                          # tests
```

**Criteres validation** :
- V1 (P0) : 15+ Kafka events specifiques
- V2 (P0) : audit_log enrichi
- V3 (P0) : ETL ClickHouse sync nouvelles tables
- V4 (P0) : Dashboard "Insure Operations"
- V5 (P0) : Tests 8+ scenarios

---

## Tache 4.2.13 -- Tests E2E (50+) + Fixtures Cas Complexes

**Metadonnees** : Phase 4 / Sprint 15 / P0 / 8h / Depend de 4.2.12

**But** : Suite tests E2E exhaustive cas complexes + fixtures realistes scenarios reels.

**Livrables checkables** :

**Tests E2E (50+)** :
- [ ] Transfers (5) : initiate + 2 signatures + completion + cancel + decline
- [ ] Fractionnement (4) : change frequency tous combos
- [ ] Suspension (4) : suspend + resume + > 6 mois reject + extension end_date
- [ ] Resiliation (8) : pro-rata correct + droit retract + frais 5% + refund Pay + premiums cancelled + edge cases
- [ ] Flotte (5) : add/remove objects + recompute prime + 4 types objects
- [ ] Endossements auto (5) : change vehicle + drivers + usage
- [ ] Endossements sante (4) : add/remove beneficiaires + limits
- [ ] Endossements habitation/RC/voyage (5)
- [ ] Broker Queue (6) : enqueue + assign + validate + reject + escalation + SLA working days
- [ ] Provisional (4) : generate + replace + revoke + expiry

**Fixtures complexes** :
- 100 polices avec mix scenarios : 20 transfers historiques, 15 suspensions, 10 cancellations, 30 endossements, 5 flottes
- 20 broker queue items mix statuses
- 10 provisional policies (5 active, 3 replaced, 2 revoked)

**Fichiers crees / modifies** :
```
repo/apps/api/test/insure/sprint-15/{50+ specs}.e2e-spec.ts
repo/infrastructure/scripts/seed-insure-sprint15-fixtures.ts                   # ~400 lignes
```

**Criteres validation** :
- V1 (P0) : 50+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Fixtures realistes
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 15

A la fin de l'execution des 13 taches :

```
Insure Lifecycle Avance operational :
  - Transferts polices avec workflow signature double Barid eSign
  - Fractionnement primes runtime + frais conversion 3%
  - Suspensions temporaires + reprises (max 6 mois) + extension end_date
  - Resiliations anticipees avec pro-rata + droit retract MA + refund Pay
  - Polices flottes (4 types objects : vehicle/employee/property/equipment)
  - Endossements specifiques 5 branches (auto/sante/habitation/RC pro/voyage)
  - BrokerValidationQueueService (workflow validation web-customer-portal SLA 24h)
  - ProvisionalPolicyService (doc provisoire 7 jours TTL)
  - 12+ permissions Sprint 15 enrichies matrice RBAC
  - 15+ Kafka events critical operations
  - Dashboard Insure Operations

50+ tests E2E exhaustifs cas complexes
```

**Sprint 16 (Web Broker App) demarre avec** :
- Lifecycle police complet operational
- BrokerValidationQueue ready a etre consume par UI broker
- Pattern Phase 4 valide : Foundation (Sprint 14) + Lifecycle Avance (Sprint 15)

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-4.2.X-*.md` dans `00-pilotage/prompts-taches/sprint-15-insure-lifecycle/`.

**Patterns code inline conserves** : workflow transfer double signature (cedant + cessionnaire sequential), computation pro-rata avec edge cases (droit retract MA + frais 5%).

**Reference** : `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` couvre tables insure_*.

---

**Fin du meta-prompt B-15 v2.2 format Option B.**
