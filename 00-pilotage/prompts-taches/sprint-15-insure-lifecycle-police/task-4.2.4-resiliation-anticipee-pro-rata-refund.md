# TACHE 4.2.4 -- Resiliation Anticipee + Remboursement Pro-Rata

**Sprint** : 15 (Phase 4 / Sprint 2 dans phase Vertical Insure)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-15-sprint-15-insure-lifecycle-police.md` (Tache 4.2.4)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (resiliation anticipee critical pour V1 production -- droit retract legal 30j Loi 17-99 article 9)
**Effort** : 6h
**Dependances** :
- Tache 4.2.3 (Suspension Police -- pattern lifecycle status workflow + cancel premiums futurs reutilises)
- Tache 4.2.1 (Transfer entity -- pattern Kafka events + audit log JSONB snapshot reutilises)
- Sprint 14 (Insure Foundation : entites Policy, Premium, Quote livrees)
- Sprint 11 (Pay refunds via PayTransactionService.requestRefund + integration CMI/PSP MA)
- Sprint 10 (Barid eSign + ANRT TSA pour acte de resiliation eventuel)
- Sprint 9 (Comm package : WhatsApp + Email notifications)
- Sprint 8 (CRM Contacts entity pour notification assure)
- Sprint 7 (RBAC permissions matrix)
- Sprint 6 (Multi-tenant RLS strict)

**Bloque** :
- Tache 4.2.5 (Polices Flottes -- removeObject reutilise pattern pro-rata refund)
- Tache 4.2.11 (Endpoints REST consolides)
- Tache 4.2.12 (Kafka consumers `CancellationCompletedConsumer`)
- Tache 4.2.13 (Tests E2E 50+ avec 5 scenarios cancellation)
- Sprint 18 (Compliance ACAPS quarterly portfolio report exigeant variation contrats resilies)
- Sprint 28 (Audit ACAPS conformite droit retract 17-99 article 9)

**Densite cible** : 110-150 ko (auto-suffisant exhaustif -- Claude Code n'a pas a relire B-15)
**AUCUNE EMOJI AUTORISEE** (decision-006 -- pre-commit hook rejette)

---

## 1. But

Cette tache implemente la **resiliation anticipee d'une police d'assurance** (avant son terme contractuel `end_date`) avec **computation precise du remboursement pro-rata** des primes percues sur la duree non-couverte, **application configurable de frais de resiliation** (par defaut 5%), **integration native avec le module Pay** (Sprint 11) pour declencher le remboursement effectif via PSP marocain (CMI, Wafacash, AmanPay), et **conformite stricte avec la Loi 17-99 article 9** (droit de retractation 30 jours pour souscripteurs particuliers B2C). La resiliation est un cas operationnel quotidien chez tout courtier marocain : vente du vehicule sans repreneur, perte totale du bien, deces du souscripteur, declassement entreprise, ou simple changement d'assureur (concurrence) -- la police existante doit alors etre **resiliee** avec retour d'une partie de la prime annuelle proportionnelle a la duree restante.

L'apport est triple. **Premierement**, on cree le service `ResiliationService` orchestrant le calcul pro-rata avec **decimal.js precision 2** (eviter `Number.EPSILON` sur les montants en dirhams), la differentiation entre **droit retract integral** (`daysFromStart <= 30` ET `is_b2c = true` -> remboursement total sans frais), **resiliation pro-rata standard** (`prime_unused = prime_annuelle * (days_remaining / total_duration)`, `fees = pro_rata_unused * 0.05`, `refund = pro_rata_unused - fees`), **resiliation suite sinistre majeur** (pas de frais reglementaire ACAPS), **resiliation par assureur pour non-paiement** (pas de remboursement, article 17-99 article 13), et **resiliation a echeance** (preavis 30j obligatoire, article 17-99 article 11). Toutes les transitions sont audit-traceables JSONB `snapshot_before` + `snapshot_after`, persistees dans la table `insure_policies` (mise a jour `status='cancelled'`, `cancelled_at`, `cancelled_reason`, `cancellation_legal_basis`), et publient des evenements Kafka `insurtech.events.insure.policy.cancelled` consume par Analytics Sprint 13 (ClickHouse churn metrics) et Compliance Sprint 18 (ACAPS reporting). **Deuxiemement**, on enrichit l'entite `InsurePolicy` avec deux nouveaux champs critiques pour la conformite : `is_b2c` (boolean determinant l'applicabilite du droit retract 17-99) et `cancellation_legal_basis` (enum `droit_retract_17_99 | pro_rata | sinistre_major | unpaid | echeance_preavis`) permettant a Sprint 28 (Audit ACAPS) de generer des reports filtrables par fondement juridique. **Troisiemement**, on integre le module Pay (Sprint 11) pour declencher automatiquement le remboursement : recherche de la derniere transaction Pay liee a la police (`related_resource_type='insure_policy' AND related_resource_id=:policy_id ORDER BY initiated_at DESC LIMIT 1`), appel `RefundService.requestRefund(transactionId, refundAmount, reason)` qui retourne un refund ID, persistance du refund ID dans `policies.cancellation_refund_transaction_id`, et notification Comm WhatsApp + Email confirmant le montant retourne et l'ETA bancaire (typiquement 3-5 jours ouvres pour CMI au Maroc).

A l'issue de cette tache, un courtier peut resilier une police via `POST /api/v1/insure/policies/:id/cancel` en moins d'une seconde : validation police active + pas de claim, computation pro-rata avec auto-detection legal_basis, transaction PG avec `SET LOCAL app.current_tenant`, update police + cancel premiums futurs cascade, refund Pay si applicable, Kafka outbox + audit log JSONB, notifications Comm bilangue. Cette tache est le quatrieme pilier du Sprint 15 et bloque les taches downstream (4.2.5 Flotte removeObject, 4.2.11 endpoints, 4.2.12 consumers, 4.2.13 E2E).

---

## 2. Contexte etendu

### 2.1 Pourquoi la resiliation anticipee est un cas operationnel critique au Maroc

Au Maroc, le marche de l'assurance auto represente environ 3,2 milliards de dirhams en primes brutes emises annuellement (donnees ACAPS 2024), avec un parc automobile estime a 4,5 millions de vehicules dont environ 60% sont assures. Sur ces vehicules assures, les **statistiques ACAPS 2024 indiquent un taux de resiliation anticipee compris entre 6% et 9% par an** : autrement dit, chaque annee, environ **180 000 a 270 000 polices auto** sont resiliees avant leur terme contractuel pour des motifs varies. Pour chaque resiliation, l'enjeu monetaire est concret : sur une prime annuelle moyenne de 2 800 DH (RC simple) a 8 500 DH (tous risques), un assure resiliant a mi-parcours peut recuperer entre 1 200 DH et 4 000 DH, sommes significatives dans le pouvoir d'achat des menages marocains (salaire median 4 500 DH/mois).

La **resiliation anticipee** est encadree par plusieurs articles du **Code des Assurances marocain (Loi 17-99)** : **article 9** instaure le droit de retractation de 30 jours pour les souscripteurs particuliers (B2C), permettant un remboursement integral sans frais ni penalite -- ce droit est calque sur la directive europeenne 2002/65/CE transposee en droit marocain et applique strictement par l'ACAPS. **Article 11** encadre la resiliation a echeance contractuelle annuelle, exigeant un preavis ecrit de 30 jours minimum par lettre recommandee avec accuse de reception. **Article 13** autorise l'assureur a resilier pour non-paiement de prime apres mise en demeure 10 jours non-suivie de paiement, **sans obligation de remboursement** des sommes deja percues. **Article 21** evoque la resiliation pour aggravation du risque (changement materiel des elements du contrat), permettant a chacune des parties de denoncer. **Article 22** evoque la resiliation pour sinistre majeur (apres regelement d'un sinistre superieur a un seuil), avec procedure speciale d'indemnisation. **Article 235** definit les regles de pro-rata temporis applicables aux remboursements (pro-rata sur base annuelle 365 jours).

En pratique, **80% des resiliations** sont initiees par l'assure (vente du vehicule, changement d'assureur, perte du bien), **15%** sont initiees par l'assureur (non-paiement, fausse declaration, aggravation risque), et **5%** sont des resiliations mutuelles (sinistre total avec accord). C'est ce que notre `ResiliationService` couvre integralement : il distingue les 5 fondements juridiques via l'enum `cancellation_legal_basis`, applique les regles de calcul propres a chaque cas (refund integral droit retract, pro-rata avec frais 5% standard, pas de refund unpaid, pro-rata sans frais sinistre, pro-rata avec frais standard echeance), trace tout dans `audit_logs.metadata` JSONB pour audit ACAPS, et integre Pay (Sprint 11) pour declenchement automatise du virement bancaire.

Cas d'usage operationnels concrets observes chez les courtiers cibles (Cabinet Bennani Casablanca, Atlas Assurance Rabat, MutuAssurance Marrakech) :

1. **Vente vehicule J+9 sans repreneur (droit retract)** : `legal_basis='droit_retract_17_99'`, refund integral (e.g. 2 800 DH).
2. **Vente vehicule J+180 mi-parcours** : `legal_basis='pro_rata'`, `prime_unused = 8 400*185/365 = 4 260`, `fees = 213`, `refund = 4 047 DH`.
3. **Non-paiement prime fractionnee** : assureur mise en demeure 10j -> `legal_basis='unpaid'`, refund=0.
4. **Sinistre total vehicule** : Claims Sprint 19 -> `legal_basis='sinistre_major'`, pro-rata SANS frais (ACAPS).
5. **Changement assureur a echeance** : LRAR 30j preavis -> `effectiveDate >= end_date` -> `legal_basis='echeance_preavis'`, refund=0.
6. **Deces souscripteur** : heritiers refusent -> pro-rata standard + notif Comm `cancellation-deceased` Sprint 18.
7. **Mutation entreprise** : SARL acquisition non-reprise -> pro-rata standard.

Sans cette tache, courtiers feraient resiliations manuellement (Excel + virement manuel), brisant data flow, perdant traceabilite ACAPS, exposant contentieux (mauvais calcul = signalement), echappant audits Sprint 28.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Resiliation a calcul manuel hors systeme (export Excel) | Simple, pas de code | Pas d'audit, calcul errone frequent, pas de refund automatise, non scalable | Rejete (defait l'interet ERP) |
| Pro-rata calcule en JavaScript natif (Number) | Simple, pas de dependance | Imprecision floats (e.g. 0.1 + 0.2 = 0.30000000000000004), erreurs centimes accumulees, non-conforme exigence comptabilite MA (loi 38-14) | Rejete (decision-016 decimal.js) |
| Pro-rata sur base 360 jours (calendaire bancaire) | Standard bancaire international | Non-conforme article 235 Loi 17-99 qui impose 365 jours | Rejete (non-conforme) |
| Frais fixes (e.g. 50 DH plat) au lieu de 5% | Simple | Inequitable pour primes elevees (5% sur 8 500 DH = 425 DH vs 50 DH plat = avantage assureur grandes primes) | Rejete (5% standard marche MA) |
| **Pro-rata pourcentage + frais configurables (default 5%) + droit retract integral + decimal.js precision 2** (retenu) | Conforme legal MA, equitable, scalable, configurable per tenant Sprint 27, decimal.js precision financiere | Complexite code legerement plus elevee, edge cases multiples | RETENU |
| Resiliation differee (J+30) systematique au lieu d'immediate | Securise (delais retractation cessionnaire) | Friction utilisateur, complexite cron jobs, peu utile car droit retract est cote assure pas cessionnaire ici | Rejete |
| Refund cash immediat (paiement direct caisse courtier) | Rapide | Risque fraude, pas de traceabilite, non-scalable, hors loi 38-14 obligations comptables | Rejete (refund Pay Sprint 11 obligatoire) |

La decision retenue (pro-rata pourcentage + frais 5% + droit retract integral + decimal.js) decoule de plusieurs decisions strategiques convergentes : **decision-016** (decimal.js pour tous calculs monetaires precision 2), **decision-002** (multi-tenant 3 niveaux -- chaque resiliation isolee par `tenant_id`), **decision-008** (cloud souverain MA -- les refunds transitent uniquement via CMI/Wafacash/AmanPay), et **decision-014** (commissions immutables apres encaissement -- la resiliation ne reattribue pas la commission).

### 2.3 Trade-offs explicites

- **Precision financiere vs. performance** : decimal.js (~30-50x plus lent que Number) assume car precision financiere non-negociable. Un erreur 1 centime x 250 000 resiliations/an = 2 500 DH ecart + signalement ACAPS. Regle absolue decision-016 : JAMAIS Number/parseFloat sur montants MAD.
- **Frais fixes 5% vs. config per tenant** : V1 hard-code `0.05`, configurable per tenant defere Sprint 27. Taux standard marche MA observe 90% courtiers (etude Skalean Q4 2025).
- **Refund automatise vs. workflow validation** : declenchement automatique sans validation manuelle. Attenue par transaction PG atomique + verification `has_open_claim` + audit trail. Workflow validation > 5 000 DH defere Sprint 18.
- **effectiveDate immediate vs. differee** : accept J0 a J+30. Cron daily `process-scheduled-cancellations-cron` (Tache 4.2.12) traite differes. Pro-rata calcule a l'appel API.
- **Currency MAD only vs. multi-devises** : V1 MAD precision 2 (centimes). EUR/USD defere Sprint 30+ si export Afrique francophone.

### 2.4 Decisions strategiques referenced

Cette tache materialise et applique strictement les decisions suivantes :

- **decision-001 (monorepo pnpm + Turborepo)** : `packages/insure` heberge le service, importe via alias `@insurtech/insure`. Pas de relatif `../../../../`.
- **decision-002 (multi-tenant 3 niveaux : Skalean / tenant / object)** : chaque resiliation porte `tenant_id NOT NULL` herite de `insure_policies.tenant_id`. RLS strict.
- **decision-003 (TypeORM 0.3 over Prisma)** : update via Repository injectable NestJS DI, transactions via `DataSource.transaction()`.
- **decision-006 (no-emoji policy ABSOLU)** : aucune emoji dans service, controller, templates, logs, commits, audit messages.
- **decision-007 (mocks integrations externes pendant Sprint 1-28 sauf Pay reel des Sprint 11)** : Pay deja reel Sprint 11 (CMI sandbox + production), utilise reel ici via `RefundService`.
- **decision-008 (cloud souverain Maroc -- Atlas Cloud Benguerir)** : aucune donnee resiliation hors MA. Pay refunds via CMI Maroc uniquement.
- **decision-009 (Zod validation runtime sans class-validator)** : tous inputs `CancelPolicyInputSchema` Zod.
- **decision-010 (cascade renumerotation v2.2)** : taches 4.2.X font partie du Phase 4 Sprint 2 (anciennement 4.1.X v2.1).
- **decision-014 (commissions immutables apres encaissement)** : la resiliation ne reattribue / annule pas la commission deja versee au courtier au moment de la souscription. Audit log explicite.
- **decision-016 (decimal.js precision 2 pour tous calculs monetaires)** : `new Decimal(...)`, `.mul()`, `.div()`, `.minus()`, `.toFixed(2)`. JAMAIS `Number` ou `parseFloat`.

### 2.5 Pieges techniques connus

1. **Number natif sur montants MAD** : floats accumulent erreurs (`2800*185/365` puis `*0.05`). Solution : `new Decimal(...)` strict, test `0.1+0.2 === '0.30'`.
2. **Oubli `is_b2c` pour droit retract** : Loi 17-99 article 9 limite aux personnes physiques. SARL ne peut invoquer. Solution : `if (daysFromStart <= 30 && policy.is_b2c === true)`. Test B2B dedie.
3. **`differenceInDays` timezone** : UTC vs Africa/Casablanca cree off-by-one. Solution : `differenceInCalendarDays` + `TZ=Africa/Casablanca` env.
4. **Oubli verification `has_open_claim`** : resilier police avec sinistre = casser droit indemnisation (ACAPS interdit article 22). Solution : `claimsService.findOpenByPolicyId` early check, stub V1.
5. **Update `end_date` avant computation** : capturer `old_end_date` AVANT update, calcul pro-rata avec capturee. Audit log les 2 valeurs.
6. **Pay refund hors transaction** : echec Pay laisse police cancelled sans refund. Solution : `requestRefund` DANS la transaction PG, idempotent Sprint 11 + rollback global.
7. **Kafka publish hors transaction** : event perdu si Kafka down apres commit. Solution : outbox pattern Sprint 13 (`kafkaPublisher.publishWithOutbox(em, ...)`).
8. **Notifications Comm bloquantes** : await commService.send() ralentit API. Solution : `setImmediate(...)` fire-and-forget hors transaction + log warn.
9. **Premiums futurs non annules** : quittances Q3/Q4 restent pending -> harcelement assure. Solution : `UPDATE insure_premiums SET status='cancelled' WHERE due_date > effectiveDate`.
10. **Recherche Pay txn sans tenant_id** : leak cross-tenant possible (defense en profondeur RLS). Solution : query explicite `WHERE tenant_id = currentTenantId`.
11. **effectiveDate apres end_date** : pro-rata negatif. Solution : early `if (effectiveDate >= end_date) -> echeance_preavis, refund=0`.
12. **Audit log enum non typed** : queries ACAPS Sprint 28 echouent si string libre. Solution : enum TS strict + Zod + CHECK constraint DB.

### 2.6 Conformite legale Maroc -- detail synthese

- **Loi 17-99 (Code des Assurances) article 9** : droit retractation 30 jours pour souscripteur particulier (B2C), remboursement integral sans frais. Notre `is_b2c=true && daysFromStart<=30` materialise.
- **Loi 17-99 article 11** : preavis ecrit 30j avant echeance pour resiliation a l'echeance par assure. Notre `cancellation_legal_basis='echeance_preavis'` track.
- **Loi 17-99 article 13** : resiliation assureur pour non-paiement apres mise en demeure 10j, sans obligation remboursement. Notre `cancellation_legal_basis='unpaid'` + `refund=0`.
- **Loi 17-99 article 21** : aggravation risque -> resiliation possible par chacune des parties. Cas marginal, materialise par `cancellation_legal_basis='pro_rata'` standard.
- **Loi 17-99 article 22** : sinistre majeur -> resiliation possible avec procedure speciale. Notre `cancellation_legal_basis='sinistre_major'` applique pro-rata SANS frais.
- **Loi 17-99 article 235** : regles pro-rata temporis sur base 365 jours. Notre `prime * (days_remaining / total_duration)` ou `total_duration = differenceInCalendarDays(end_date, start_date)` typiquement 365.
- **Loi 09-08 (CNDP)** : donnees personnelles assure dans audit log, retention 5 ans + anonymisation Sprint 28.
- **Loi 38-14 (obligations comptables)** : archivage acte resiliation + ecritures refund pendant 10 ans (S3 Atlas object lock).
- **Loi 43-20 (services de confiance)** : si signature electronique acte de resiliation requise (cas non-paiement contesté), Barid eSign qualified.
- **Decision ACAPS quarterly portfolio (Sprint 18)** : reporting transferts/resiliations -> notre Kafka event `INSURE_POLICY_CANCELLED` consume Sprint 18.

### 2.7 Glossaire metier

- **Pro-rata temporis** : calcul proportionnel a la duree non-couverte. Formule : `refund_base = prime_annuelle * (days_remaining / total_duration_days)`.
- **Droit de retractation** : droit legal de l'assure particulier (B2C) a annuler sa souscription dans les 30 jours suivant la signature, sans frais ni penalite. Loi 17-99 article 9.
- **Frais de resiliation** : pourcentage retenu par l'assureur sur le montant pro-rata pour couvrir les frais administratifs. Standard marche MA : 5%. Configurable Sprint 27.
- **Effective date** : date a laquelle la resiliation prend effet (la couverture s'arrete). Peut etre J0 (immediate) ou J+N (programmee, J+30 max V1).
- **Cancellation legal basis** : fondement juridique de la resiliation. Enum strict pour reporting ACAPS.
- **Refund transaction** : transaction Pay (Sprint 11) declenchant le virement bancaire de remboursement vers l'IBAN assure. ETA CMI 3-5 jours ouvres MA.
- **B2C / B2B** : Business to Consumer (particulier) vs Business to Business (entreprise). Distinction critique pour droit retract.
- **LRAR** : Lettre Recommandee avec Accuse de Reception (preavis legal article 11).

---

## 3. Architecture context

### 3.1 Position dans le sprint 15

Cette tache 4.2.4 est la **quatrieme** des 13 du Sprint 15. Elle :

- **Depend de** : Tache 4.2.3 (Suspension Police -- pattern lifecycle status workflow + cancel premiums futurs), Tache 4.2.1 (Transfer entity -- pattern Kafka events + audit log JSONB snapshot), Sprint 14 (entites `InsurePolicy`, `InsurePremium`), Sprint 11 (`RefundService.requestRefund` + `PayTransaction` entity + CMI integration reelle), Sprint 9 (`CommService.send`), Sprint 8 (`ContactsService.findById`), Sprint 7 (RBAC permissions matrix + `@Permissions()` decorator), Sprint 6 (multi-tenant RLS active + `TenantContext` AsyncLocalStorage).

- **Bloque** : Tache 4.2.5 (Polices Flottes -- `removeObject` reutilise pattern pro-rata refund), Tache 4.2.11 (endpoints REST consolides), Tache 4.2.12 (Kafka consumers `CancellationCompletedConsumer` + cron `process-scheduled-cancellations-cron`), Tache 4.2.13 (Tests E2E 50+ avec 5 scenarios cancellation), Sprint 18 (Compliance ACAPS reporting via Kafka event), Sprint 28 (Audit droit retract via `cancellation_legal_basis` column).

- **Apporte au sprint** : le pattern "pro-rata decimal.js + refund Pay + audit JSONB + Kafka outbox + Comm fire-and-forget + 5 fondements juridiques" reutilisable par toutes les operations de remboursement Sprint 15 (Flotte removeObject) et Sprint 19 (Claims indemnisation partielle). C'est la **brique financiere refund** des operations avancees.

### 3.2 Position dans le programme global v2.2 (35 sprints)

Sprint 15 est le 2eme sprint de la Phase 4 (Vertical Insure). Le `ResiliationService` est utilise par :

- **Sprint 16 (Web Broker App)** : UI courtier pour resilier via formulaire React avec preview pro-rata en temps reel (composant `CancelPolicyDialog.tsx` consume `POST /api/v1/insure/policies/:id/cancel/preview` pour afficher le breakdown avant confirmation).
- **Sprint 17 (Web Customer Portal)** : permet a un client de **demander** resiliation depuis son espace assure (B2C uniquement). La demande cree une row `insure_cancellation_requests` `status='pending_broker_validation'` (extension Sprint 17), validee ensuite par broker via Tache 4.2.9 queue.
- **Sprint 18 (Compliance ACAPS)** : Kafka consumer `AcapsCancellationReportingConsumer` ecoute `insure.policy_cancelled` pour aggregat quarterly portfolio (variation resiliations + repartition fondements juridiques) et report XLSX.
- **Sprint 19 (Claims)** : lors d'un sinistre total avec resiliation, `ClaimsService.resolveTotalLoss(policyId)` appelle `ResiliationService.cancel(policyId, 'sinistre_total', effectiveDate, { legalBasis: 'sinistre_major' })`.
- **Sprint 27 (Admin Tenant Custom)** : permet a un super admin tenant de configurer `cancellation_fee_rate` (default 0.05), `cancellation_grace_period_days` (default 30), `cancellation_max_future_days` (default 30).
- **Sprint 28 (Audit ACAPS)** : audit annuel filtre par `cancellation_legal_basis` pour verifier conformite droit retract 17-99.
- **Sprint 30+ (Sky AI)** : un MCP tool `sky.insure.predict_churn_risk` analyse les patterns de resiliation pour scorer le risque churn par contact (defere strict, hors V1).

### 3.3 Diagramme flow

```
+---------------------------------------------------------------+
|  Sprint 15 Tache 4.2.4 -- ResiliationService                  |
|                                                               |
|  cancel(policyId, reason, effectiveDate, legalBasis?)         |
|       |                                                       |
|       v                                                       |
|  +----------------+    +-----------------+    +-------------+ |
|  | Validations    |--->| Determine       |--->| Compute     | |
|  | (policy active,|    | legal basis     |    | pro-rata    | |
|  |  no open claim,|    | (auto-detect    |    | with        | |
|  |  effectiveDate |    |  if not given:  |    | decimal.js  | |
|  |  in [today,    |    |  retract30j /   |    | precision 2 | |
|  |  policy.end])  |    |  pro_rata /     |    +-------------+ |
|  +----------------+    |  echeance)      |          |        |
|                        +-----------------+          v        |
|                                            +-------------+   |
|                                            | Open PG txn |   |
|                                            | SET LOCAL   |   |
|                                            | tenant      |   |
|                                            +-------------+   |
|                                                  |           |
|                                                  v           |
|     +------------------+    +------------------+             |
|     | Update           |--->| Cancel future    |             |
|     | insure_policies: |    | insure_premiums  |             |
|     | status=cancelled |    | (due > effective)|             |
|     | cancelled_at     |    | -> status=       |             |
|     | cancelled_reason |    |    cancelled     |             |
|     | end_date=effect  |    +------------------+             |
|     | legal_basis      |             |                       |
|     +------------------+             v                       |
|              |                +------------------+           |
|              |                | Find last Pay txn|           |
|              |                | for this policy  |           |
|              |                | (related_resource|           |
|              |                |  _type=policy)   |           |
|              |                +------------------+           |
|              |                          |                    |
|              |                          v                    |
|              |     +------------------------------+          |
|              |     | If refund > 0:               |          |
|              |     | RefundService.requestRefund( |          |
|              |     |   txnId, refund, reason)     |          |
|              |     | -> refund_txn_id             |          |
|              |     +------------------------------+          |
|              |                          |                    |
|              v                          v                    |
|     +----------------------+    +-------------------+        |
|     | kafka_outbox INSERT  |    | audit_logs INSERT |        |
|     | INSURE_POLICY_       |    | metadata JSONB:   |        |
|     | CANCELLED            |    | snapshot before/  |        |
|     | idempotency_key=     |    | after + legal     |        |
|     | cancel-<id>-<ts>     |    | basis             |        |
|     +----------------------+    +-------------------+        |
|                                          |                   |
|                          (COMMIT transaction)                |
|                                          |                   |
|                                          v                   |
|              +-----------------------------------+           |
|              | Notifications Comm fire-and-forget|           |
|              | WA + Email cancellation-confirmed |           |
|              | (fr/ar-MA selon preferred_lang)   |           |
|              +-----------------------------------+           |
+---------------------------------------------------------------+
                                |
                                v (async, polling 1s)
+---------------------------------------------------------------+
|  Sprint 13 Kafka Outbox Worker                                |
|  poll kafka_outbox -> publish to Kafka -> mark sent           |
|  Topic : insurtech.events.insure.policy.cancelled             |
+---------------------------------------------------------------+
                                |
                                v
+----------------------+  +----------------------+  +-----------+
| Sprint 13 Analytics  |  | Sprint 18 ACAPS      |  | Sprint 19 |
| ClickHouse churn     |  | Quarterly portfolio  |  | Claims    |
| metrics + cohort     |  | report XLSX          |  | indemnif. |
+----------------------+  +----------------------+  +-----------+
```

### 3.4 Relation aux verticaux

Le `ResiliationService` est cote **`packages/insure`** (vertical Insure). Il consume `RefundService` de **`packages/pay`** (vertical Pay) via DI NestJS (couplage controle via interface `IRefundService`). Il ne reside pas dans `packages/repair` (Garage), ni dans `packages/crm` (Contacts utilise read-only). La separation respecte la frontiere claire entre verticaux : Insure manipule polices, Pay manipule transactions monetaires, Repair manipule reparations, et Sky (Sprint 31) orchestre via MCP.

---

## 4. Livrables checkables (28+ items)

- [ ] Migration TypeORM `{date}-AddCancellationColumnsToInsurePolicies.ts` enrichissant la table `insure_policies` avec colonnes : `is_b2c` (boolean NOT NULL DEFAULT true), `cancelled_at` (timestamptz NULL), `cancelled_reason` (text NULL), `cancellation_legal_basis` (enum `droit_retract_17_99 | pro_rata | sinistre_major | unpaid | echeance_preavis` NULL), `cancellation_refund_amount` (numeric(12,2) NULL), `cancellation_refund_transaction_id` (uuid NULL FK -> pay_transactions), `cancellation_fee_amount` (numeric(12,2) NULL), `cancelled_by` (uuid NULL FK -> auth_users), `cancellation_breakdown` (jsonb NULL -- detail calcul pro-rata pour audit). (~80 lignes migration UP + DOWN)

- [ ] Indexes Postgres dans migration :
  - `idx_insure_policies_cancelled_at` ON (tenant_id, cancelled_at) WHERE cancelled_at IS NOT NULL
  - `idx_insure_policies_legal_basis` ON (tenant_id, cancellation_legal_basis) WHERE cancellation_legal_basis IS NOT NULL
  - `idx_insure_policies_status` deja livre Sprint 14 (reuse)

- [ ] Contrainte CHECK Postgres :
  - `chk_cancellation_consistency` : `(status='cancelled' AND cancelled_at IS NOT NULL AND cancellation_legal_basis IS NOT NULL) OR (status<>'cancelled' AND cancelled_at IS NULL)`

- [ ] Enum TypeScript `CancellationLegalBasis` dans `repo/packages/insure/src/entities/cancellation-legal-basis.enum.ts` (5 valeurs + helpers `isRefundEligible`, `requiresFees`) (~30 lignes)

- [ ] Entity TypeORM `InsurePolicy` mise a jour avec 8 nouvelles colonnes + relations `cancelled_by_user`, `cancellation_refund_transaction` (~40 lignes ajoutees)

- [ ] Schema Zod `repo/packages/insure/src/schemas/insure-cancellation.schema.ts` exportant `CancelPolicyInputSchema`, `PreviewCancellationInputSchema`, `CancellationBreakdownSchema` avec validation strict (~70 lignes)

- [ ] Service `repo/packages/insure/src/services/resiliation.service.ts` avec methods : `cancel(input)`, `previewCancellation(input)`, `findCancellationByPolicyId(policyId)`, `listCancellationsByTenant(filter)`, `computeProRata(policy, effectiveDate, legalBasis)` (private), `determineLegalBasis(policy, effectiveDate, override?)` (private), `validateCancelInput(input)` (private) (~350 lignes)

- [ ] Tests unitaires `repo/packages/insure/src/services/resiliation.service.spec.ts` couvrant 28 scenarios : cancel success standard, droit retract integral B2C, droit retract NOT applied if B2B, droit retract NOT applied if J+31, pro-rata avec frais 5%, sinistre_major sans frais, unpaid refund=0, echeance_preavis refund=0, decimal.js precision (0.1+0.2), validation effectiveDate passe rejected, effectiveDate apres end_date detected echeance, open claim conflict, cross-tenant forbidden, idempotency cancel deja cancelled (~400 lignes)

- [ ] Controller `repo/apps/api/src/modules/insure/controllers/resiliation.controller.ts` exposant endpoints REST `POST /api/v1/insure/policies/:id/cancel`, `POST /api/v1/insure/policies/:id/cancel/preview`, `GET /api/v1/insure/policies/:id/cancellation`, avec `@Permissions()`, `@UseGuards(TenantGuard, RolesGuard)`, validation Zod pipe (~150 lignes)

- [ ] DTOs `repo/apps/api/src/modules/insure/dto/cancel-policy.dto.ts`, `preview-cancellation.dto.ts`, `cancellation-response.dto.ts`, `cancellation-breakdown.dto.ts` (4 fichiers, ~30 lignes chacun)

- [ ] OpenAPI annotations `@ApiTags('insure-cancellations')`, `@ApiOperation`, `@ApiResponse` sur tous endpoints

- [ ] Module integration : ajout `ResiliationService` dans `InsureModule.providers`, `ResiliationController` dans `InsureModule.controllers`, import `PayModule` pour `RefundService` (`repo/apps/api/src/modules/insure/insure.module.ts` mise a jour)

- [ ] Permissions catalog : ajout `insure.policies.cancel_anticipated`, `insure.policies.cancel_preview`, `insure.cancellations.read` dans `repo/packages/auth/src/rbac/permissions.enum.ts` + mapping roles (BrokerAdmin + BrokerUser ont cancel + preview, tous broker_* ont read)

- [ ] Kafka topics declaration : ajout `INSURE_POLICY_CANCELLED`, `INSURE_POLICY_CANCELLATION_REFUND_INITIATED`, `INSURE_POLICY_CANCELLATION_REFUND_COMPLETED` dans `repo/packages/shared-types/src/kafka-topics.ts`

- [ ] Kafka event schemas Zod : `policy-cancelled.event.schema.ts`, `cancellation-refund-initiated.event.schema.ts`, `cancellation-refund-completed.event.schema.ts` (~30 lignes chacun)

- [ ] Tests integration `repo/apps/api/test/insure/resiliation.integration-spec.ts` : Postgres reel + RLS + flow complet cancel + preview + refund Pay stub + verification audit log + verification Kafka outbox + verification premiums cancelled (~280 lignes, 14 tests)

- [ ] Fixtures `repo/apps/api/test/insure/fixtures/resiliation.fixture.ts` : helpers `createCancellablePolicyFixture(opts)`, `createPolicyWithRetractRightFixture()`, `createPolicyWithOpenClaimFixture()`, `createCancellationFixture()` (~150 lignes)

- [ ] Templates Comm `repo/packages/comm/src/templates/{fr,ar-MA,ar}/cancellation-confirmed.{whatsapp,email}.hbs` : notifications confirmation resiliation + montant refund + ETA (6 fichiers, ~35 lignes chacun)

- [ ] Templates Comm `repo/packages/comm/src/templates/{fr,ar-MA,ar}/cancellation-refund-completed.{whatsapp,email}.hbs` : notifications confirmation refund execute par CMI (6 fichiers, ~30 lignes chacun)

- [ ] Logging structured Pino : tous appels service log `{ tenant_id, user_id, policy_id, action, refund_amount_mad, legal_basis, days_remaining, days_from_start, duration_ms }` avec niveaux info/warn/error appropries

- [ ] Audit log integration : `AuditLogService.log({ action: 'insure.policy.cancelled', resource_type: 'insure_policy', resource_id, metadata: { snapshot_before, snapshot_after, breakdown, legal_basis, refund_transaction_id } })` sur completion

- [ ] OpenTelemetry tracing : spans `resiliation.cancel`, `resiliation.previewCancellation`, `resiliation.computeProRata` avec attributes tenant_id, policy_id, legal_basis, refund_amount

- [ ] Constante `DEFAULT_CANCELLATION_FEE_RATE = new Decimal('0.05')` exportee dans `repo/packages/insure/src/constants/cancellation.constants.ts` (~20 lignes avec autres constantes pertinentes)

- [ ] Documentation README local `repo/packages/insure/src/services/RESILIATION.md` : usage examples, sequence diagrams ASCII, references B-15 + Loi 17-99

- [ ] Integration outbox Kafka (Sprint 13 pattern) : `kafkaPublisher.publishWithOutbox(em, topic, payload, idempotencyKey)` au lieu de publish direct

- [ ] Verification claim ouvert : appel `claimsService.findOpenByPolicyId(policyId)` (stub pour V1, real Sprint 19)

- [ ] Cron job preview Sprint 15 Tache 4.2.12 : `process-scheduled-cancellations-cron` (daily) traite `cancellations.status='scheduled' AND effective_date <= today` -> execute cancel reel

- [ ] Idempotency : appel `cancel(policyId, ...)` 2 fois -> 2eme appel detecte `policy.status='cancelled'` et retourne 409 Conflict `code=POLICY_ALREADY_CANCELLED`

- [ ] Coverage tests >= 90% sur `resiliation.service.ts`

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/database/src/migrations/{YYYYMMDDHHMMSS}-AddCancellationColumnsToInsurePolicies.ts (~110 lignes / migration UP + DOWN + indexes + CHECK + enum)
repo/packages/insure/src/entities/cancellation-legal-basis.enum.ts                 (~30 lignes / enum + helpers)
repo/packages/insure/src/entities/insure-policy.entity.ts                          (modif / +8 colonnes +2 relations)
repo/packages/insure/src/schemas/insure-cancellation.schema.ts                     (~80 lignes / Zod schemas)
repo/packages/insure/src/constants/cancellation.constants.ts                       (~25 lignes / constantes)
repo/packages/insure/src/services/resiliation.service.ts                           (~380 lignes / service principal)
repo/packages/insure/src/services/resiliation.service.spec.ts                      (~420 lignes / 28 tests unit)
repo/packages/insure/src/services/RESILIATION.md                                   (~90 lignes / doc locale)
repo/packages/insure/src/index.ts                                                  (modif / export)
repo/packages/comm/src/templates/fr/cancellation-confirmed.whatsapp.hbs            (~30 lignes)
repo/packages/comm/src/templates/fr/cancellation-confirmed.email.hbs               (~40 lignes)
repo/packages/comm/src/templates/ar-MA/cancellation-confirmed.whatsapp.hbs         (~30 lignes)
repo/packages/comm/src/templates/ar-MA/cancellation-confirmed.email.hbs            (~40 lignes)
repo/packages/comm/src/templates/ar/cancellation-confirmed.whatsapp.hbs            (~30 lignes)
repo/packages/comm/src/templates/ar/cancellation-confirmed.email.hbs               (~40 lignes)
repo/packages/comm/src/templates/fr/cancellation-refund-completed.whatsapp.hbs     (~25 lignes)
repo/packages/comm/src/templates/fr/cancellation-refund-completed.email.hbs        (~30 lignes)
repo/packages/comm/src/templates/ar-MA/cancellation-refund-completed.whatsapp.hbs  (~25 lignes)
repo/packages/comm/src/templates/ar-MA/cancellation-refund-completed.email.hbs     (~30 lignes)
repo/packages/comm/src/templates/ar/cancellation-refund-completed.whatsapp.hbs     (~25 lignes)
repo/packages/comm/src/templates/ar/cancellation-refund-completed.email.hbs        (~30 lignes)
repo/apps/api/src/modules/insure/controllers/resiliation.controller.ts             (~180 lignes / controller REST)
repo/apps/api/src/modules/insure/dto/cancel-policy.dto.ts                          (~30 lignes)
repo/apps/api/src/modules/insure/dto/preview-cancellation.dto.ts                   (~20 lignes)
repo/apps/api/src/modules/insure/dto/cancellation-response.dto.ts                  (~40 lignes)
repo/apps/api/src/modules/insure/dto/cancellation-breakdown.dto.ts                 (~35 lignes)
repo/apps/api/src/modules/insure/insure.module.ts                                  (modif / +ResiliationService +ResiliationController +PayModule import)
repo/apps/api/test/insure/resiliation.integration-spec.ts                          (~320 lignes / 14 tests integration)
repo/apps/api/test/insure/fixtures/resiliation.fixture.ts                          (~180 lignes / helpers)
repo/packages/auth/src/rbac/permissions.enum.ts                                    (modif / +3 permissions)
repo/packages/auth/src/rbac/permissions-matrix.ts                                  (modif / roles mapping)
repo/packages/shared-types/src/kafka-topics.ts                                     (modif / +3 topics)
repo/packages/shared-types/src/events/insure-cancellation.events.ts                (~90 lignes / schemas Zod 3 events)
```

**Volume total estime** : ~2 600 lignes nouvelles + modifications dans 6 fichiers existants.

---

## 6. Code patterns COMPLETS

### Fichier 1/14 : Migration `repo/packages/database/src/migrations/20260518090000-AddCancellationColumnsToInsurePolicies.ts`

Enrichit la table `insure_policies` avec les colonnes necessaires pour le tracking de resiliation conforme Loi 17-99.

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : Sprint 15 Tache 4.2.4 -- Add Cancellation Columns to insure_policies
 *
 * Enrichit la table insure_policies (livree Sprint 14) avec colonnes pour
 * tracking resiliation anticipee + remboursement pro-rata conforme aux
 * articles 9, 11, 13, 21, 22, 235 de la Loi 17-99 (Code Assurances MA)
 * et regulation ACAPS (Autorite Controle Assurances Prevoyance Sociale).
 *
 * Reference programme : B-15 Tache 4.2.4.
 *
 * Colonnes ajoutees :
 * - is_b2c : determine applicabilite droit retract 17-99 article 9 (B2C only)
 * - cancelled_at : timestamp resiliation effective
 * - cancelled_reason : motif texte libre
 * - cancellation_legal_basis : enum strict 5 valeurs pour reporting ACAPS
 * - cancellation_refund_amount : montant rembourse en MAD (precision 2)
 * - cancellation_refund_transaction_id : FK pay_transactions (refund Sprint 11)
 * - cancellation_fee_amount : frais retenus en MAD (precision 2)
 * - cancelled_by : FK auth_users initiateur
 * - cancellation_breakdown : JSONB detail computation pour audit (days_remaining,
 *   total_duration, pro_rata_unused, etc.)
 *
 * Conventions :
 * - Multi-tenant strict (heritage RLS de insure_policies)
 * - decimal(12,2) pour montants MAD (precision 2)
 * - JSONB pour breakdown audit
 * - Contrainte CHECK : status='cancelled' implique cancelled_at + legal_basis NOT NULL
 */
export class AddCancellationColumnsToInsurePolicies20260518090000 implements MigrationInterface {
  name = 'AddCancellationColumnsToInsurePolicies20260518090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Creation enum cancellation_legal_basis
    await queryRunner.query(`
      CREATE TYPE insure_cancellation_legal_basis_enum AS ENUM (
        'droit_retract_17_99',
        'pro_rata',
        'sinistre_major',
        'unpaid',
        'echeance_preavis'
      );
    `);

    // 2. Ajout colonnes a insure_policies
    await queryRunner.query(`
      ALTER TABLE insure_policies
        ADD COLUMN is_b2c BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN cancelled_at TIMESTAMPTZ NULL,
        ADD COLUMN cancelled_reason TEXT NULL,
        ADD COLUMN cancellation_legal_basis insure_cancellation_legal_basis_enum NULL,
        ADD COLUMN cancellation_refund_amount NUMERIC(12, 2) NULL,
        ADD COLUMN cancellation_refund_transaction_id UUID NULL,
        ADD COLUMN cancellation_fee_amount NUMERIC(12, 2) NULL,
        ADD COLUMN cancelled_by UUID NULL,
        ADD COLUMN cancellation_breakdown JSONB NULL;
    `);

    // 3. Foreign keys
    await queryRunner.query(`
      ALTER TABLE insure_policies
        ADD CONSTRAINT fk_insure_policies_cancellation_refund_txn
          FOREIGN KEY (cancellation_refund_transaction_id)
          REFERENCES pay_transactions(id)
          ON DELETE SET NULL ON UPDATE CASCADE,
        ADD CONSTRAINT fk_insure_policies_cancelled_by
          FOREIGN KEY (cancelled_by)
          REFERENCES auth_users(id)
          ON DELETE SET NULL ON UPDATE CASCADE;
    `);

    // 4. Contrainte CHECK : coherence status='cancelled'
    await queryRunner.query(`
      ALTER TABLE insure_policies
        ADD CONSTRAINT chk_cancellation_consistency CHECK (
          (status = 'cancelled'
            AND cancelled_at IS NOT NULL
            AND cancellation_legal_basis IS NOT NULL)
          OR
          (status <> 'cancelled'
            AND cancelled_at IS NULL
            AND cancellation_legal_basis IS NULL)
        );
    `);

    // 5. Contrainte CHECK : montants refund/fees >= 0
    await queryRunner.query(`
      ALTER TABLE insure_policies
        ADD CONSTRAINT chk_cancellation_amounts_non_negative CHECK (
          (cancellation_refund_amount IS NULL OR cancellation_refund_amount >= 0)
          AND
          (cancellation_fee_amount IS NULL OR cancellation_fee_amount >= 0)
        );
    `);

    // 6. Indexes pour queries reporting ACAPS Sprint 18 + 28
    await queryRunner.query(`
      CREATE INDEX idx_insure_policies_cancelled_at
        ON insure_policies(tenant_id, cancelled_at)
        WHERE cancelled_at IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_insure_policies_legal_basis
        ON insure_policies(tenant_id, cancellation_legal_basis)
        WHERE cancellation_legal_basis IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE INDEX idx_insure_policies_is_b2c
        ON insure_policies(tenant_id, is_b2c);
    `);

    // 7. Comments documentation
    await queryRunner.query(`
      COMMENT ON COLUMN insure_policies.is_b2c IS
        'TRUE si souscripteur personne physique (B2C). Determine applicabilite droit retract Loi 17-99 article 9. Default TRUE pour V1 (la plupart des polices auto sont B2C particuliers).';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN insure_policies.cancellation_legal_basis IS
        'Fondement juridique de la resiliation. Tracking obligatoire pour audit ACAPS Sprint 28 et reporting quarterly Sprint 18.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN insure_policies.cancellation_breakdown IS
        'Detail JSONB du calcul pro-rata pour audit : { prime_annuelle, days_total, days_remaining, pro_rata_unused, fees, refund, is_retract, computed_at, fee_rate }.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_insure_policies_is_b2c;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_insure_policies_legal_basis;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_insure_policies_cancelled_at;`);
    await queryRunner.query(`
      ALTER TABLE insure_policies
        DROP CONSTRAINT IF EXISTS chk_cancellation_amounts_non_negative,
        DROP CONSTRAINT IF EXISTS chk_cancellation_consistency,
        DROP CONSTRAINT IF EXISTS fk_insure_policies_cancelled_by,
        DROP CONSTRAINT IF EXISTS fk_insure_policies_cancellation_refund_txn;
    `);
    await queryRunner.query(`
      ALTER TABLE insure_policies
        DROP COLUMN IF EXISTS cancellation_breakdown,
        DROP COLUMN IF EXISTS cancelled_by,
        DROP COLUMN IF EXISTS cancellation_fee_amount,
        DROP COLUMN IF EXISTS cancellation_refund_transaction_id,
        DROP COLUMN IF EXISTS cancellation_refund_amount,
        DROP COLUMN IF EXISTS cancellation_legal_basis,
        DROP COLUMN IF EXISTS cancelled_reason,
        DROP COLUMN IF EXISTS cancelled_at,
        DROP COLUMN IF EXISTS is_b2c;
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS insure_cancellation_legal_basis_enum;`);
  }
}
```

**Notes importantes** :
- La colonne `is_b2c` defaut a `TRUE` car la majorite des polices auto au Maroc sont B2C particuliers (80%+ selon donnees ACAPS 2024). Pour les flottes B2B (Tache 4.2.5), `is_b2c=false` sera set explicitement.
- `cancellation_refund_amount NUMERIC(12,2)` supporte montants jusqu'a 999 999 999.99 MAD (largement suffisant pour primes individuelles, deja confortable pour flottes).
- `cancellation_breakdown JSONB` stocke le detail du calcul pour audit posterieur (queries SQL JSONB type `WHERE cancellation_breakdown->>'is_retract' = 'true'` pour audit ACAPS).
- Pas d'extension table separee `insure_cancellations` : on enrichit `insure_policies` directement. Justification : une police a au plus 1 resiliation (immutable apres `cancelled`), donc 1-to-1 = colonnes inline. Alternative table separee deferee Sprint 27 si besoin historique multiple revocations.
- Aucune RLS specifique a ajouter : `insure_policies` herite deja `tenant_isolation_insure_policies` (Sprint 14).

### Fichier 2/14 : Enum `repo/packages/insure/src/entities/cancellation-legal-basis.enum.ts`

```typescript
/**
 * Sprint 15 Tache 4.2.4 -- Enum CancellationLegalBasis
 *
 * Fondement juridique de la resiliation d'une police d'assurance MA.
 * Reference legale : Loi 17-99 (Code des Assurances Maroc) articles 9, 11, 13, 21, 22, 235.
 *
 * Cycle de validation :
 *   1. Auto-detection par ResiliationService.determineLegalBasis()
 *      basee sur : days_from_start, is_b2c, effective_date vs end_date
 *   2. Override possible par broker via input `cancellationLegalBasis`
 *      (ex : sinistre_major declenche par Claims Sprint 19)
 *   3. Audit log capture la valeur finale pour reporting ACAPS Sprint 18/28
 */
export enum CancellationLegalBasis {
  /**
   * Loi 17-99 article 9 -- Droit de retractation 30 jours.
   * Applicable UNIQUEMENT aux souscripteurs B2C (personnes physiques).
   * Remboursement integral sans frais ni penalite.
   */
  DROIT_RETRACT_17_99 = 'droit_retract_17_99',

  /**
   * Resiliation standard anticipee (motif libre cote assure : vente vehicule,
   * changement assureur, deces, mutation entreprise, etc.).
   * Pro-rata sur duree restante + frais 5% (configurable Sprint 27).
   */
  PRO_RATA = 'pro_rata',

  /**
   * Loi 17-99 article 22 -- Resiliation suite sinistre majeur.
   * Pro-rata sur duree restante SANS frais (reglementaire ACAPS).
   * Declenchee typiquement par Claims Sprint 19 (perte totale).
   */
  SINISTRE_MAJOR = 'sinistre_major',

  /**
   * Loi 17-99 article 13 -- Resiliation par assureur pour non-paiement
   * apres mise en demeure 10 jours non-suivie.
   * Aucun remboursement (article 13 alinea 2).
   */
  UNPAID = 'unpaid',

  /**
   * Loi 17-99 article 11 -- Resiliation a echeance contractuelle par assure
   * avec preavis 30j LRAR.
   * Aucun remboursement (couverture arrive a son terme naturellement).
   */
  ECHEANCE_PREAVIS = 'echeance_preavis',
}

/**
 * Helper : ce fondement juridique donne-t-il droit a remboursement ?
 *
 * - droit_retract_17_99 : OUI (integral)
 * - pro_rata : OUI (avec frais)
 * - sinistre_major : OUI (sans frais)
 * - unpaid : NON (article 13)
 * - echeance_preavis : NON (terme naturel)
 */
export function isRefundEligible(basis: CancellationLegalBasis): boolean {
  return (
    basis === CancellationLegalBasis.DROIT_RETRACT_17_99 ||
    basis === CancellationLegalBasis.PRO_RATA ||
    basis === CancellationLegalBasis.SINISTRE_MAJOR
  );
}

/**
 * Helper : ce fondement juridique applique-t-il les frais 5% ?
 *
 * - droit_retract_17_99 : NON (article 9 interdit)
 * - pro_rata : OUI (frais standard 5%)
 * - sinistre_major : NON (ACAPS reglementation)
 * - unpaid : N/A (pas de refund)
 * - echeance_preavis : N/A (pas de refund)
 */
export function requiresFees(basis: CancellationLegalBasis): boolean {
  return basis === CancellationLegalBasis.PRO_RATA;
}

/**
 * Helper : labels FR pour audit log + UI.
 */
export const CANCELLATION_LEGAL_BASIS_LABELS_FR: Readonly<Record<CancellationLegalBasis, string>> = {
  [CancellationLegalBasis.DROIT_RETRACT_17_99]: 'Droit de retractation (Loi 17-99 article 9)',
  [CancellationLegalBasis.PRO_RATA]: 'Resiliation anticipee pro-rata',
  [CancellationLegalBasis.SINISTRE_MAJOR]: 'Resiliation suite sinistre majeur (article 22)',
  [CancellationLegalBasis.UNPAID]: 'Resiliation pour non-paiement (article 13)',
  [CancellationLegalBasis.ECHEANCE_PREAVIS]: 'Resiliation a echeance avec preavis (article 11)',
} as const;
```

### Fichier 3/14 : Entity InsurePolicy (extrait modifs) `repo/packages/insure/src/entities/insure-policy.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AuthUser } from '@insurtech/auth';
import { PayTransaction } from '@insurtech/pay';
import { CancellationLegalBasis } from './cancellation-legal-basis.enum';

/**
 * Sprint 15 Tache 4.2.4 -- Extension de l'entity InsurePolicy (livree Sprint 14)
 * avec colonnes resiliation. Seules les nouvelles colonnes sont presentees ici.
 * Les colonnes Sprint 14 (id, tenant_id, policy_number, contact_id, status,
 * prime_annuelle, start_date, end_date, etc.) restent inchangees.
 */
@Entity('insure_policies')
export class InsurePolicy {
  // ... colonnes Sprint 14 (omises) ...

  /**
   * TRUE si souscripteur personne physique (B2C).
   * Determine applicabilite droit retract Loi 17-99 article 9.
   */
  @Column('boolean', { name: 'is_b2c', default: true })
  is_b2c!: boolean;

  /**
   * Timestamp resiliation effective. NULL si police non resiliee.
   */
  @Column('timestamptz', { name: 'cancelled_at', nullable: true })
  cancelled_at!: Date | null;

  /**
   * Motif texte libre saisi par broker ou assure.
   */
  @Column('text', { name: 'cancelled_reason', nullable: true })
  cancelled_reason!: string | null;

  /**
   * Fondement juridique strict (enum 5 valeurs).
   * Tracking obligatoire pour audit ACAPS Sprint 28.
   */
  @Column({
    type: 'enum',
    enum: CancellationLegalBasis,
    enumName: 'insure_cancellation_legal_basis_enum',
    name: 'cancellation_legal_basis',
    nullable: true,
  })
  cancellation_legal_basis!: CancellationLegalBasis | null;

  /**
   * Montant rembourse en MAD (precision 2 decimales).
   * NULL si pas de refund (unpaid, echeance_preavis).
   */
  @Column('numeric', { name: 'cancellation_refund_amount', precision: 12, scale: 2, nullable: true })
  cancellation_refund_amount!: string | null;

  /**
   * Frais retenus en MAD (precision 2). NULL si pas de frais.
   */
  @Column('numeric', { name: 'cancellation_fee_amount', precision: 12, scale: 2, nullable: true })
  cancellation_fee_amount!: string | null;

  /**
   * FK vers pay_transactions (refund initie via Sprint 11 RefundService).
   */
  @Column('uuid', { name: 'cancellation_refund_transaction_id', nullable: true })
  cancellation_refund_transaction_id!: string | null;

  @ManyToOne(() => PayTransaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cancellation_refund_transaction_id' })
  cancellation_refund_transaction?: PayTransaction | null;

  /**
   * FK vers auth_users initiateur (broker ou systeme).
   */
  @Column('uuid', { name: 'cancelled_by', nullable: true })
  cancelled_by!: string | null;

  @ManyToOne(() => AuthUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'cancelled_by' })
  cancelled_by_user?: AuthUser | null;

  /**
   * Detail JSONB du calcul pro-rata pour audit.
   * Structure :
   * {
   *   prime_annuelle: string (decimal),
   *   days_total: number,
   *   days_remaining: number,
   *   days_from_start: number,
   *   pro_rata_unused: string (decimal),
   *   fee_rate: string (decimal),
   *   fees: string (decimal),
   *   refund: string (decimal),
   *   is_retract: boolean,
   *   computed_at: ISO 8601 string
   * }
   */
  @Column('jsonb', { name: 'cancellation_breakdown', nullable: true })
  cancellation_breakdown!: Record<string, unknown> | null;

  /**
   * Helper : police peut-elle etre resiliee ?
   */
  canBeCancelled(): boolean {
    return this.status === 'active' || this.status === 'suspended';
  }

  /**
   * Helper : police deja resiliee ?
   */
  isCancelled(): boolean {
    return this.status === 'cancelled' && this.cancelled_at !== null;
  }
}
```

### Fichier 4/14 : Schemas Zod `repo/packages/insure/src/schemas/insure-cancellation.schema.ts`

```typescript
import { z } from 'zod';
import { startOfDay, isValid } from 'date-fns';
import { CancellationLegalBasis } from '../entities/cancellation-legal-basis.enum';

/**
 * Sprint 15 Tache 4.2.4 -- Schemas Zod pour validation ResiliationService.
 *
 * Conventions :
 * - Tous les inputs valides via Zod.parse() au debut de chaque service method.
 * - Imports stricts : Zod uniquement pour validation runtime (decision-009).
 * - Pas de class-validator, pas de Joi/Yup.
 * - Defense en profondeur : controller valide ET service valide.
 */

/**
 * Input pour resilier une police (anticipee).
 */
export const CancelPolicyInputSchema = z.object({
  policyId: z.string().uuid({ message: 'policyId must be a valid UUID v4' }),
  reason: z
    .string()
    .min(5, { message: 'reason must be at least 5 characters' })
    .max(500, { message: 'reason must not exceed 500 characters' })
    .trim(),
  effectiveDate: z.coerce
    .date()
    .refine((d) => isValid(d), { message: 'effectiveDate must be a valid date' })
    .refine((d) => d >= startOfDay(new Date()), {
      message: 'effectiveDate must be today or future (cannot cancel in the past)',
    }),
  /**
   * Override optionnel du fondement juridique.
   * Si null/undefined : auto-detection par ResiliationService.determineLegalBasis().
   * Si set : utilise tel quel (cas Claims Sprint 19 -> sinistre_major).
   * Si UNPAID : requiert permission speciale `insure.policies.cancel_unpaid` (Sprint 18+).
   */
  cancellationLegalBasis: z.nativeEnum(CancellationLegalBasis).optional(),
  /**
   * Override optionnel du taux de frais (V1 : ignored, defere Sprint 27).
   */
  feeRateOverride: z.string().regex(/^0\.\d{1,4}$/).optional(),
  /**
   * Metadata libre pour tracking interne (ex : claim_id pour sinistre_major).
   */
  metadata: z.record(z.unknown()).optional(),
});

export type CancelPolicyInput = z.infer<typeof CancelPolicyInputSchema>;

/**
 * Input pour previsualiser le breakdown SANS executer la resiliation.
 * Utilise par UI Sprint 16 pour afficher le refund estime avant confirmation.
 */
export const PreviewCancellationInputSchema = z.object({
  policyId: z.string().uuid(),
  effectiveDate: z.coerce.date(),
  cancellationLegalBasis: z.nativeEnum(CancellationLegalBasis).optional(),
});

export type PreviewCancellationInput = z.infer<typeof PreviewCancellationInputSchema>;

/**
 * Schema breakdown JSONB persiste dans `insure_policies.cancellation_breakdown`.
 * Schema utilise pour validation des donnees lues depuis DB.
 */
export const CancellationBreakdownSchema = z.object({
  prime_annuelle: z.string().regex(/^\d+\.\d{2}$/, { message: 'must be MAD decimal precision 2' }),
  days_total: z.number().int().positive(),
  days_remaining: z.number().int().nonnegative(),
  days_from_start: z.number().int().nonnegative(),
  pro_rata_unused: z.string().regex(/^\d+\.\d{2}$/),
  fee_rate: z.string().regex(/^0\.\d{1,4}$/),
  fees: z.string().regex(/^\d+\.\d{2}$/),
  refund: z.string().regex(/^\d+\.\d{2}$/),
  is_retract: z.boolean(),
  legal_basis: z.nativeEnum(CancellationLegalBasis),
  computed_at: z.string().datetime(),
});

export type CancellationBreakdown = z.infer<typeof CancellationBreakdownSchema>;

/**
 * Output public de cancel() : refund + breakdown decimal-safe (string).
 */
export const CancellationResultSchema = z.object({
  policyId: z.string().uuid(),
  status: z.literal('cancelled'),
  cancelledAt: z.date(),
  refundAmount: z.string(),
  feeAmount: z.string(),
  legalBasis: z.nativeEnum(CancellationLegalBasis),
  refundTransactionId: z.string().uuid().nullable(),
  breakdown: CancellationBreakdownSchema,
});

export type CancellationResult = z.infer<typeof CancellationResultSchema>;
```

### Fichier 5/14 : Constantes `repo/packages/insure/src/constants/cancellation.constants.ts`

```typescript
import Decimal from 'decimal.js';

/**
 * Sprint 15 Tache 4.2.4 -- Constantes cancellation.
 *
 * Toutes les valeurs financieres en Decimal precision 2.
 * decimal.js v10.4.3 obligatoire (decision-016).
 */

/**
 * Taux de frais de resiliation standard (5%).
 * Configurable per tenant Sprint 27 via tenants.config.cancellation_fee_rate.
 * Pour V1 hard-code.
 */
export const DEFAULT_CANCELLATION_FEE_RATE = new Decimal('0.05');

/**
 * Periode droit de retractation Loi 17-99 article 9 (en jours).
 * Applicable uniquement B2C (souscripteurs personnes physiques).
 * Non-configurable (reglementaire).
 */
export const RETRACT_RIGHT_PERIOD_DAYS = 30;

/**
 * Nombre max de jours dans le futur pour effectiveDate (V1).
 * Au-dela, courtier doit programmer via cron specifique (Sprint 27).
 */
export const MAX_FUTURE_EFFECTIVE_DAYS = 30;

/**
 * Duree pro-rata standard en jours (annee non-bissextile).
 * Reference : Loi 17-99 article 235 (base 365 jours).
 */
export const PRO_RATA_BASE_DAYS = 365;

/**
 * Currency par defaut (V1 : MAD only, multi-devises defere Sprint 30+).
 */
export const DEFAULT_CURRENCY = 'MAD' as const;

/**
 * Precision decimale pour montants MAD.
 */
export const MAD_DECIMAL_PRECISION = 2;
```

### Fichier 6/14 : Service principal `repo/packages/insure/src/services/resiliation.service.ts`

```typescript
import {
  Inject,
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, EntityManager } from 'typeorm';
import { Logger } from 'pino';
import { PinoLogger } from 'nestjs-pino';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { differenceInCalendarDays, startOfDay, isBefore, isAfter, isEqual } from 'date-fns';
import Decimal from 'decimal.js';

import { InsurePolicy } from '../entities/insure-policy.entity';
import { InsurePremium } from '../entities/insure-premium.entity';
import {
  CancellationLegalBasis,
  isRefundEligible,
  requiresFees,
  CANCELLATION_LEGAL_BASIS_LABELS_FR,
} from '../entities/cancellation-legal-basis.enum';
import {
  CancelPolicyInput,
  CancelPolicyInputSchema,
  PreviewCancellationInput,
  PreviewCancellationInputSchema,
  CancellationBreakdown,
  CancellationResult,
} from '../schemas/insure-cancellation.schema';
import {
  DEFAULT_CANCELLATION_FEE_RATE,
  RETRACT_RIGHT_PERIOD_DAYS,
  MAX_FUTURE_EFFECTIVE_DAYS,
  DEFAULT_CURRENCY,
} from '../constants/cancellation.constants';

import { PoliciesService } from './policies.service';
import { ClaimsService } from '@insurtech/claims-stub';
import { RefundService, PayTransaction } from '@insurtech/pay';
import { CommService, CommChannel } from '@insurtech/comm';
import { AuditLogService } from '@insurtech/shared-utils';
import { KafkaPublisher } from '@insurtech/shared-utils';
import { TenantContext } from '@insurtech/shared-utils';
import { Topics } from '@insurtech/shared-types';

// Configuration decimal.js : precision globale pour la lib
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

/**
 * Sprint 15 Tache 4.2.4 -- ResiliationService
 *
 * Orchestre la resiliation anticipee d'une police d'assurance avec :
 *   1. Determination automatique du fondement juridique (5 valeurs enum)
 *   2. Computation pro-rata avec decimal.js (precision 2 MAD)
 *   3. Application frais 5% sauf droit retract et sinistre_major
 *   4. Integration RefundService Pay Sprint 11 (CMI/Wafacash)
 *   5. Cancel cascade des premiums futurs
 *   6. Publication Kafka outbox pattern + audit log JSONB
 *   7. Notifications Comm fire-and-forget bilangue (fr/ar-MA)
 *
 * Reference legale : Loi 17-99 articles 9, 11, 13, 21, 22, 235.
 * Reference programme : B-15 Tache 4.2.4.
 */
@Injectable()
export class ResiliationService {
  private readonly logger: Logger;
  private readonly tracer = trace.getTracer('insure.resiliation.service');

  constructor(
    @InjectRepository(InsurePolicy)
    private readonly policiesRepo: Repository<InsurePolicy>,
    @InjectRepository(InsurePremium)
    private readonly premiumsRepo: Repository<InsurePremium>,
    @InjectRepository(PayTransaction)
    private readonly payTxnRepo: Repository<PayTransaction>,
    private readonly policiesService: PoliciesService,
    @Inject('CLAIMS_SERVICE') private readonly claimsService: ClaimsService,
    private readonly refundService: RefundService,
    private readonly commService: CommService,
    private readonly auditLog: AuditLogService,
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly dataSource: DataSource,
    pino: PinoLogger,
  ) {
    this.logger = pino.logger.child({ component: 'ResiliationService' });
  }

  /**
   * Resilie une police d'assurance avec calcul pro-rata + refund Pay.
   *
   * Flow :
   *   1. Validation Zod input
   *   2. Recuperation police + verifications (active, no open claim, cross-tenant)
   *   3. Determination legal_basis (auto ou override)
   *   4. Computation pro-rata (decimal.js)
   *   5. Transaction PG :
   *      a. Update policy (status=cancelled, ...colonnes)
   *      b. Cancel premiums futurs
   *      c. Si refund > 0 : RefundService.requestRefund
   *      d. Insert kafka_outbox (POLICY_CANCELLED)
   *      e. Insert audit_logs
   *   6. Apres COMMIT : notifications Comm fire-and-forget
   *
   * @throws BadRequestException si validation echoue
   * @throws NotFoundException si police inexistante
   * @throws ForbiddenException si cross-tenant
   * @throws ConflictException si police deja cancelled ou claim ouvert
   */
  async cancel(input: CancelPolicyInput): Promise<CancellationResult> {
    return this.tracer.startActiveSpan('resiliation.cancel', async (span) => {
      const startTime = Date.now();
      const tenantId = TenantContext.getCurrentTenantId();
      const userId = TenantContext.getCurrentUserId();

      span.setAttributes({
        'tenant.id': tenantId,
        'user.id': userId,
        'policy.id': input.policyId,
      });

      try {
        // 1. Validation Zod (defense en profondeur, controller valide aussi)
        const validated = CancelPolicyInputSchema.parse(input);

        // 2. Recuperation police + verifications metier
        const policy = await this.policiesService.findById(validated.policyId);
        if (!policy) {
          throw new NotFoundException({
            code: 'POLICY_NOT_FOUND',
            message: `Policy ${validated.policyId} not found`,
          });
        }
        if (policy.tenant_id !== tenantId) {
          throw new ForbiddenException({
            code: 'CROSS_TENANT_FORBIDDEN',
            message: 'Cannot cancel policy from another tenant',
          });
        }
        if (policy.status === 'cancelled') {
          throw new ConflictException({
            code: 'POLICY_ALREADY_CANCELLED',
            message: `Policy ${policy.policy_number} already cancelled at ${policy.cancelled_at?.toISOString()}`,
          });
        }
        if (!policy.canBeCancelled()) {
          throw new BadRequestException({
            code: 'POLICY_NOT_CANCELLABLE',
            message: `Policy status '${policy.status}' does not allow cancellation. Required: active or suspended.`,
          });
        }

        // 3. Verification absence claim ouvert (Sprint 19 Claims, stub V1)
        const openClaim = await this.claimsService.findOpenByPolicyId(validated.policyId);
        if (openClaim) {
          throw new ConflictException({
            code: 'POLICY_HAS_OPEN_CLAIM',
            message: `Cannot cancel policy with open claim ${openClaim.id} (status ${openClaim.status}). Resolve claim first.`,
            details: { claim_id: openClaim.id, claim_status: openClaim.status },
          });
        }

        // 4. Determination fondement juridique
        const legalBasis = this.determineLegalBasis(
          policy,
          validated.effectiveDate,
          validated.cancellationLegalBasis,
        );

        // 5. Computation pro-rata
        const breakdown = this.computeProRata(policy, validated.effectiveDate, legalBasis);

        this.logger.info({
          tenant_id: tenantId,
          user_id: userId,
          policy_id: policy.id,
          policy_number: policy.policy_number,
          action: 'resiliation.cancel.starting',
          legal_basis: legalBasis,
          refund_amount_mad: breakdown.refund,
          fee_amount_mad: breakdown.fees,
          days_remaining: breakdown.days_remaining,
          days_from_start: breakdown.days_from_start,
        }, 'Starting policy cancellation transaction');

        // 6. Snapshot avant pour audit log
        const snapshotBefore = {
          status: policy.status,
          end_date: policy.end_date,
          cancelled_at: policy.cancelled_at,
          cancellation_legal_basis: policy.cancellation_legal_basis,
        };

        // 7. Transaction PG atomique
        const result = await this.dataSource.transaction(async (em) => {
          // Set RLS context (defense en profondeur)
          await em.query(`SET LOCAL app.current_tenant = '${tenantId}'`);

          // 7a. Update police
          const cancelledAt = new Date();
          await em.update(
            InsurePolicy,
            { id: policy.id, tenant_id: tenantId },
            {
              status: 'cancelled',
              cancelled_at: cancelledAt,
              cancelled_reason: validated.reason,
              cancellation_legal_basis: legalBasis,
              cancellation_refund_amount: breakdown.refund,
              cancellation_fee_amount: breakdown.fees,
              cancelled_by: userId,
              cancellation_breakdown: breakdown as unknown as Record<string, unknown>,
              end_date: validated.effectiveDate,
              updated_at: cancelledAt,
            },
          );

          // 7b. Cancel premiums futurs (status='pending' AND due_date > effectiveDate)
          const cancelledPremiumsResult = await em
            .createQueryBuilder()
            .update(InsurePremium)
            .set({ status: 'cancelled', updated_at: cancelledAt })
            .where('tenant_id = :tenantId', { tenantId })
            .andWhere('policy_id = :policyId', { policyId: policy.id })
            .andWhere('status = :status', { status: 'pending' })
            .andWhere('due_date > :effectiveDate', { effectiveDate: validated.effectiveDate })
            .execute();

          this.logger.debug({
            tenant_id: tenantId,
            policy_id: policy.id,
            cancelled_premiums_count: cancelledPremiumsResult.affected ?? 0,
          }, 'Future premiums cancelled');

          // 7c. Refund Pay si applicable
          let refundTransactionId: string | null = null;
          const refundDecimal = new Decimal(breakdown.refund);

          if (refundDecimal.gt(0) && isRefundEligible(legalBasis)) {
            // Recherche derniere transaction Pay liee a la police
            const lastTxn = await em
              .createQueryBuilder(PayTransaction, 'txn')
              .where('txn.tenant_id = :tenantId', { tenantId })
              .andWhere('txn.related_resource_type = :type', { type: 'insure_policy' })
              .andWhere('txn.related_resource_id = :policyId', { policyId: policy.id })
              .andWhere('txn.status = :status', { status: 'succeeded' })
              .orderBy('txn.initiated_at', 'DESC')
              .limit(1)
              .getOne();

            if (lastTxn) {
              const refundTxn = await this.refundService.requestRefund(
                {
                  transactionId: lastTxn.id,
                  amountMad: refundDecimal.toFixed(2),
                  reason: `Resiliation police ${policy.policy_number}: ${validated.reason} (${CANCELLATION_LEGAL_BASIS_LABELS_FR[legalBasis]})`,
                  idempotencyKey: `cancel-refund-${policy.id}-${cancelledAt.getTime()}`,
                },
                em, // Pass entity manager for transactional refund
              );
              refundTransactionId = refundTxn.id;

              await em.update(
                InsurePolicy,
                { id: policy.id },
                { cancellation_refund_transaction_id: refundTransactionId },
              );

              this.logger.info({
                tenant_id: tenantId,
                policy_id: policy.id,
                refund_transaction_id: refundTransactionId,
                amount_mad: refundDecimal.toFixed(2),
              }, 'Refund initiated via Pay');
            } else {
              this.logger.warn({
                tenant_id: tenantId,
                policy_id: policy.id,
                expected_refund_mad: refundDecimal.toFixed(2),
              }, 'No succeeded Pay transaction found for refund -- manual intervention required');
            }
          }

          // 7d. Kafka outbox pattern (Sprint 13)
          await this.kafkaPublisher.publishWithOutbox(em, {
            topic: Topics.INSURE_POLICY_CANCELLED,
            payload: {
              tenant_id: tenantId,
              policy_id: policy.id,
              policy_number: policy.policy_number,
              contact_id: policy.contact_id,
              cancelled_at: cancelledAt.toISOString(),
              effective_date: validated.effectiveDate.toISOString(),
              cancelled_by: userId,
              legal_basis: legalBasis,
              refund_amount_mad: breakdown.refund,
              fee_amount_mad: breakdown.fees,
              refund_transaction_id: refundTransactionId,
              breakdown,
              reason: validated.reason,
            },
            idempotencyKey: `cancel-${policy.id}-${cancelledAt.getTime()}`,
          });

          // 7e. Audit log
          await this.auditLog.log(em, {
            tenant_id: tenantId,
            user_id: userId,
            action: 'insure.policy.cancelled',
            resource_type: 'insure_policy',
            resource_id: policy.id,
            metadata: {
              snapshot_before: snapshotBefore,
              snapshot_after: {
                status: 'cancelled',
                end_date: validated.effectiveDate,
                cancelled_at: cancelledAt,
                cancellation_legal_basis: legalBasis,
              },
              breakdown,
              refund_transaction_id: refundTransactionId,
              reason: validated.reason,
              legal_basis_label_fr: CANCELLATION_LEGAL_BASIS_LABELS_FR[legalBasis],
            },
          });

          return {
            policyId: policy.id,
            status: 'cancelled' as const,
            cancelledAt,
            refundAmount: breakdown.refund,
            feeAmount: breakdown.fees,
            legalBasis,
            refundTransactionId,
            breakdown,
          };
        });

        // 8. Apres COMMIT : notifications Comm fire-and-forget
        this.sendNotificationsFireAndForget(policy, result);

        const durationMs = Date.now() - startTime;
        this.logger.info({
          tenant_id: tenantId,
          user_id: userId,
          policy_id: policy.id,
          action: 'resiliation.cancel.completed',
          legal_basis: result.legalBasis,
          refund_amount_mad: result.refundAmount,
          duration_ms: durationMs,
        }, 'Policy cancellation completed');

        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
        this.logger.error({
          tenant_id: tenantId,
          user_id: userId,
          policy_id: input.policyId,
          action: 'resiliation.cancel.failed',
          error_message: (error as Error).message,
          duration_ms: Date.now() - startTime,
        }, 'Policy cancellation failed');
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Previsualise le breakdown SANS executer la resiliation.
   * Utilise par UI Sprint 16 pour confirmation avant action.
   */
  async previewCancellation(input: PreviewCancellationInput): Promise<{
    breakdown: CancellationBreakdown;
    legalBasis: CancellationLegalBasis;
    legalBasisLabelFr: string;
  }> {
    return this.tracer.startActiveSpan('resiliation.previewCancellation', async (span) => {
      const tenantId = TenantContext.getCurrentTenantId();
      span.setAttributes({ 'tenant.id': tenantId, 'policy.id': input.policyId });

      try {
        const validated = PreviewCancellationInputSchema.parse(input);
        const policy = await this.policiesService.findById(validated.policyId);
        if (!policy) throw new NotFoundException({ code: 'POLICY_NOT_FOUND' });
        if (policy.tenant_id !== tenantId) throw new ForbiddenException({ code: 'CROSS_TENANT_FORBIDDEN' });

        const legalBasis = this.determineLegalBasis(
          policy,
          validated.effectiveDate,
          validated.cancellationLegalBasis,
        );
        const breakdown = this.computeProRata(policy, validated.effectiveDate, legalBasis);

        span.setStatus({ code: SpanStatusCode.OK });
        return {
          breakdown,
          legalBasis,
          legalBasisLabelFr: CANCELLATION_LEGAL_BASIS_LABELS_FR[legalBasis],
        };
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Determine le fondement juridique de la resiliation.
   *
   * Logique de detection :
   *   1. Si override fourni : utilise tel quel
   *   2. Si effectiveDate >= policy.end_date : echeance_preavis
   *   3. Si daysFromStart <= 30 ET is_b2c : droit_retract_17_99
   *   4. Sinon : pro_rata standard
   *
   * Note : SINISTRE_MAJOR et UNPAID ne sont JAMAIS auto-detectes,
   * ils requierent override explicite (Claims Sprint 19 ou admin ops).
   */
  private determineLegalBasis(
    policy: InsurePolicy,
    effectiveDate: Date,
    override?: CancellationLegalBasis,
  ): CancellationLegalBasis {
    if (override) {
      return override;
    }

    const effective = startOfDay(effectiveDate);
    const endDate = startOfDay(policy.end_date);

    if (isAfter(effective, endDate) || isEqual(effective, endDate)) {
      return CancellationLegalBasis.ECHEANCE_PREAVIS;
    }

    const daysFromStart = differenceInCalendarDays(effective, startOfDay(policy.start_date));

    if (daysFromStart <= RETRACT_RIGHT_PERIOD_DAYS && policy.is_b2c) {
      return CancellationLegalBasis.DROIT_RETRACT_17_99;
    }

    return CancellationLegalBasis.PRO_RATA;
  }

  /**
   * Computation pro-rata avec decimal.js precision 2.
   *
   * Formules selon legal_basis :
   *   - droit_retract_17_99 : refund = prime_annuelle, fees = 0
   *   - pro_rata : refund = (prime * days_remaining / total_duration) * (1 - fee_rate)
   *                fees = (prime * days_remaining / total_duration) * fee_rate
   *   - sinistre_major : refund = prime * days_remaining / total_duration, fees = 0
   *   - unpaid : refund = 0, fees = 0
   *   - echeance_preavis : refund = 0, fees = 0
   */
  private computeProRata(
    policy: InsurePolicy,
    effectiveDate: Date,
    legalBasis: CancellationLegalBasis,
  ): CancellationBreakdown {
    const effective = startOfDay(effectiveDate);
    const startDate = startOfDay(policy.start_date);
    const endDate = startOfDay(policy.end_date);

    const daysFromStart = Math.max(0, differenceInCalendarDays(effective, startDate));
    const totalDuration = differenceInCalendarDays(endDate, startDate);
    const daysRemaining = Math.max(0, totalDuration - daysFromStart);

    if (totalDuration <= 0) {
      throw new BadRequestException({
        code: 'INVALID_POLICY_DURATION',
        message: `Policy duration is zero or negative (start_date=${policy.start_date}, end_date=${policy.end_date})`,
      });
    }

    const prime = new Decimal(policy.prime_annuelle);
    const feeRate = DEFAULT_CANCELLATION_FEE_RATE;
    let refund = new Decimal(0);
    let fees = new Decimal(0);
    let proRataUnused = new Decimal(0);
    let isRetract = false;

    switch (legalBasis) {
      case CancellationLegalBasis.DROIT_RETRACT_17_99:
        refund = prime;
        fees = new Decimal(0);
        proRataUnused = prime;
        isRetract = true;
        break;

      case CancellationLegalBasis.PRO_RATA:
        proRataUnused = prime.mul(daysRemaining).div(totalDuration);
        fees = proRataUnused.mul(feeRate);
        refund = proRataUnused.minus(fees);
        break;

      case CancellationLegalBasis.SINISTRE_MAJOR:
        proRataUnused = prime.mul(daysRemaining).div(totalDuration);
        fees = new Decimal(0);
        refund = proRataUnused;
        break;

      case CancellationLegalBasis.UNPAID:
      case CancellationLegalBasis.ECHEANCE_PREAVIS:
        proRataUnused = new Decimal(0);
        fees = new Decimal(0);
        refund = new Decimal(0);
        break;
    }

    return {
      prime_annuelle: prime.toFixed(2),
      days_total: totalDuration,
      days_remaining: daysRemaining,
      days_from_start: daysFromStart,
      pro_rata_unused: proRataUnused.toFixed(2),
      fee_rate: feeRate.toFixed(4),
      fees: fees.toFixed(2),
      refund: refund.toFixed(2),
      is_retract: isRetract,
      legal_basis: legalBasis,
      computed_at: new Date().toISOString(),
    };
  }

  /**
   * Notifications fire-and-forget : echec ne bloque pas l'API.
   */
  private sendNotificationsFireAndForget(
    policy: InsurePolicy,
    result: CancellationResult,
  ): void {
    setImmediate(async () => {
      try {
        const contact = await this.policiesService.findContactByPolicyId(policy.id);
        if (!contact) return;

        const locale = contact.preferred_language ?? 'fr';
        const channels: CommChannel[] = [];
        if (contact.email) channels.push(CommChannel.EMAIL);
        if (contact.phone_e164) channels.push(CommChannel.WHATSAPP);

        for (const channel of channels) {
          await this.commService.send({
            tenant_id: policy.tenant_id,
            contact_id: contact.id,
            channel,
            template_key: 'cancellation-confirmed',
            locale,
            data: {
              policy_number: policy.policy_number,
              contact_name: contact.fullname,
              refund_amount: result.refundAmount,
              fee_amount: result.feeAmount,
              legal_basis_label_fr: CANCELLATION_LEGAL_BASIS_LABELS_FR[result.legalBasis],
              effective_date: result.cancelledAt.toISOString(),
              has_refund: new Decimal(result.refundAmount).gt(0),
              eta_days: 5, // ETA CMI 3-5 jours ouvres MA
            },
            idempotency_key: `cancel-notif-${policy.id}-${channel}-${result.cancelledAt.getTime()}`,
          });
        }
      } catch (error) {
        this.logger.warn({
          policy_id: policy.id,
          error_message: (error as Error).message,
        }, 'Failed to send cancellation notifications (non-blocking)');
      }
    });
  }

  /**
   * Recupere la resiliation d'une police (si cancelled).
   */
  async findCancellationByPolicyId(policyId: string): Promise<InsurePolicy | null> {
    const tenantId = TenantContext.getCurrentTenantId();
    const policy = await this.policiesRepo.findOne({
      where: { id: policyId, tenant_id: tenantId, status: 'cancelled' },
    });
    return policy;
  }

  /**
   * Liste les resiliations du tenant avec filtres (pour reporting).
   */
  async listCancellationsByTenant(filter: {
    legalBasis?: CancellationLegalBasis;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InsurePolicy[]; total: number }> {
    const tenantId = TenantContext.getCurrentTenantId();
    const qb = this.policiesRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.status = :status', { status: 'cancelled' });

    if (filter.legalBasis) {
      qb.andWhere('p.cancellation_legal_basis = :basis', { basis: filter.legalBasis });
    }
    if (filter.fromDate) {
      qb.andWhere('p.cancelled_at >= :from', { from: filter.fromDate });
    }
    if (filter.toDate) {
      qb.andWhere('p.cancelled_at <= :to', { to: filter.toDate });
    }

    qb.orderBy('p.cancelled_at', 'DESC')
      .limit(filter.limit ?? 50)
      .offset(filter.offset ?? 0);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
```

### Fichier 7/14 : Controller `repo/apps/api/src/modules/insure/controllers/resiliation.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';

import { ResiliationService } from '@insurtech/insure';
import { TenantGuard, RolesGuard, Permissions } from '@insurtech/auth';
import { ZodValidationPipe } from '@insurtech/shared-utils';
import {
  CancelPolicyInputSchema,
  PreviewCancellationInputSchema,
} from '@insurtech/insure';

import { CancelPolicyDto } from '../dto/cancel-policy.dto';
import { PreviewCancellationDto } from '../dto/preview-cancellation.dto';
import { CancellationResponseDto } from '../dto/cancellation-response.dto';
import { CancellationBreakdownDto } from '../dto/cancellation-breakdown.dto';

/**
 * Sprint 15 Tache 4.2.4 -- ResiliationController
 *
 * Endpoints REST pour resiliation anticipee + preview.
 *
 * Permissions :
 *   - POST /cancel : insure.policies.cancel_anticipated
 *   - POST /cancel/preview : insure.policies.cancel_preview
 *   - GET /cancellation : insure.cancellations.read
 */
@ApiTags('insure-cancellations')
@ApiBearerAuth()
@Controller('api/v1/insure')
@UseGuards(TenantGuard, RolesGuard)
export class ResiliationController {
  constructor(private readonly resiliationService: ResiliationService) {}

  /**
   * POST /api/v1/insure/policies/:id/cancel
   *
   * Resilie une police d'assurance avec computation pro-rata + refund Pay.
   */
  @Post('policies/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.policies.cancel_anticipated')
  @ApiOperation({
    summary: 'Cancel an insurance policy with pro-rata refund computation',
    description: `
      Cancels a policy and computes the pro-rata refund according to Loi 17-99
      articles 9, 11, 13, 21, 22, 235.

      Auto-detects legal_basis based on:
      - effectiveDate >= policy.end_date -> echeance_preavis (no refund)
      - daysFromStart <= 30 AND is_b2c -> droit_retract_17_99 (full refund, no fees)
      - otherwise -> pro_rata (refund = unused * 0.95)

      Override via input.cancellationLegalBasis for special cases (sinistre_major, unpaid).
      Refund initiated via Pay (Sprint 11 CMI/Wafacash) if amount > 0.
    `,
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: CancelPolicyDto })
  @ApiResponse({ status: 200, type: CancellationResponseDto, description: 'Policy cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or policy not cancellable' })
  @ApiResponse({ status: 403, description: 'Cross-tenant or insufficient permission' })
  @ApiResponse({ status: 404, description: 'Policy not found' })
  @ApiResponse({ status: 409, description: 'Policy already cancelled or has open claim' })
  @UsePipes(new ZodValidationPipe(CancelPolicyInputSchema))
  async cancel(
    @Param('id', ParseUUIDPipe) policyId: string,
    @Body() body: CancelPolicyDto,
  ): Promise<CancellationResponseDto> {
    const result = await this.resiliationService.cancel({
      policyId,
      reason: body.reason,
      effectiveDate: body.effectiveDate,
      cancellationLegalBasis: body.cancellationLegalBasis,
      metadata: body.metadata,
    });

    return {
      policy_id: result.policyId,
      status: result.status,
      cancelled_at: result.cancelledAt.toISOString(),
      refund_amount_mad: result.refundAmount,
      fee_amount_mad: result.feeAmount,
      legal_basis: result.legalBasis,
      refund_transaction_id: result.refundTransactionId,
      breakdown: result.breakdown as unknown as CancellationBreakdownDto,
    };
  }

  /**
   * POST /api/v1/insure/policies/:id/cancel/preview
   *
   * Previsualise le breakdown sans executer la resiliation.
   */
  @Post('policies/:id/cancel/preview')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.policies.cancel_preview')
  @ApiOperation({
    summary: 'Preview cancellation breakdown without executing',
  })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiBody({ type: PreviewCancellationDto })
  @ApiResponse({ status: 200, description: 'Preview computed', schema: {
    type: 'object',
    properties: {
      breakdown: { $ref: '#/components/schemas/CancellationBreakdownDto' },
      legal_basis: { type: 'string' },
      legal_basis_label_fr: { type: 'string' },
    },
  }})
  @UsePipes(new ZodValidationPipe(PreviewCancellationInputSchema))
  async previewCancellation(
    @Param('id', ParseUUIDPipe) policyId: string,
    @Body() body: PreviewCancellationDto,
  ) {
    const preview = await this.resiliationService.previewCancellation({
      policyId,
      effectiveDate: body.effectiveDate,
      cancellationLegalBasis: body.cancellationLegalBasis,
    });

    return {
      breakdown: preview.breakdown,
      legal_basis: preview.legalBasis,
      legal_basis_label_fr: preview.legalBasisLabelFr,
    };
  }

  /**
   * GET /api/v1/insure/policies/:id/cancellation
   *
   * Recupere les details de resiliation d'une police (si cancelled).
   */
  @Get('policies/:id/cancellation')
  @Permissions('insure.cancellations.read')
  @ApiOperation({ summary: 'Get cancellation details for a policy' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiResponse({ status: 200, type: CancellationResponseDto })
  @ApiResponse({ status: 404, description: 'Policy not found or not cancelled' })
  async getCancellation(
    @Param('id', ParseUUIDPipe) policyId: string,
  ): Promise<CancellationResponseDto | { cancelled: false }> {
    const policy = await this.resiliationService.findCancellationByPolicyId(policyId);
    if (!policy) {
      return { cancelled: false };
    }
    return {
      policy_id: policy.id,
      status: 'cancelled' as const,
      cancelled_at: policy.cancelled_at!.toISOString(),
      refund_amount_mad: policy.cancellation_refund_amount ?? '0.00',
      fee_amount_mad: policy.cancellation_fee_amount ?? '0.00',
      legal_basis: policy.cancellation_legal_basis!,
      refund_transaction_id: policy.cancellation_refund_transaction_id,
      breakdown: policy.cancellation_breakdown as unknown as CancellationBreakdownDto,
    };
  }
}
```

### Fichier 8/14 : DTOs `repo/apps/api/src/modules/insure/dto/cancel-policy.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CancellationLegalBasis } from '@insurtech/insure';

/**
 * Sprint 15 Tache 4.2.4 -- DTO input pour cancel policy.
 *
 * Validation runtime via ZodValidationPipe (CancelPolicyInputSchema).
 * Cette classe sert UNIQUEMENT a la documentation Swagger.
 */
export class CancelPolicyDto {
  @ApiProperty({
    description: 'Motif de la resiliation (saisie libre courtier ou assure)',
    minLength: 5,
    maxLength: 500,
    example: 'Vente du vehicule sans repreneur de police',
  })
  reason!: string;

  @ApiProperty({
    description: 'Date effective de la resiliation (ISO 8601). Doit etre >= aujourd hui.',
    type: String,
    format: 'date-time',
    example: '2026-05-20T00:00:00Z',
  })
  effectiveDate!: Date;

  @ApiPropertyOptional({
    description: `Override du fondement juridique. Si omis, auto-detection.
      Valeurs : droit_retract_17_99 | pro_rata | sinistre_major | unpaid | echeance_preavis.
      Cas particuliers : sinistre_major (Claims Sprint 19), unpaid (admin ops).`,
    enum: CancellationLegalBasis,
  })
  cancellationLegalBasis?: CancellationLegalBasis;

  @ApiPropertyOptional({
    description: 'Metadata libre (ex : claim_id, mutation_id) pour tracking interne',
    type: 'object',
    additionalProperties: true,
  })
  metadata?: Record<string, unknown>;
}
```

### Fichier 9/14 : DTOs Preview + Response `repo/apps/api/src/modules/insure/dto/preview-cancellation.dto.ts` + `cancellation-response.dto.ts` + `cancellation-breakdown.dto.ts`

```typescript
// preview-cancellation.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CancellationLegalBasis } from '@insurtech/insure';

export class PreviewCancellationDto {
  @ApiProperty({
    description: 'Date effective pour la previsualisation',
    type: String,
    format: 'date-time',
  })
  effectiveDate!: Date;

  @ApiPropertyOptional({ enum: CancellationLegalBasis })
  cancellationLegalBasis?: CancellationLegalBasis;
}

// cancellation-breakdown.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class CancellationBreakdownDto {
  @ApiProperty({ example: '2800.00', description: 'Prime annuelle MAD precision 2' })
  prime_annuelle!: string;

  @ApiProperty({ example: 365, description: 'Duree totale police en jours' })
  days_total!: number;

  @ApiProperty({ example: 180, description: 'Jours restants jusqu a end_date' })
  days_remaining!: number;

  @ApiProperty({ example: 185, description: 'Jours depuis start_date' })
  days_from_start!: number;

  @ApiProperty({ example: '1380.82', description: 'Pro-rata unused MAD precision 2' })
  pro_rata_unused!: string;

  @ApiProperty({ example: '0.0500', description: 'Taux frais de resiliation' })
  fee_rate!: string;

  @ApiProperty({ example: '69.04', description: 'Frais MAD precision 2' })
  fees!: string;

  @ApiProperty({ example: '1311.78', description: 'Refund MAD precision 2 (pro_rata_unused - fees)' })
  refund!: string;

  @ApiProperty({ example: false, description: 'TRUE si droit retract applique' })
  is_retract!: boolean;

  @ApiProperty({ description: 'Fondement juridique determine' })
  legal_basis!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  computed_at!: string;
}

// cancellation-response.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { CancellationLegalBasis } from '@insurtech/insure';

export class CancellationResponseDto {
  @ApiProperty({ type: String, format: 'uuid' })
  policy_id!: string;

  @ApiProperty({ example: 'cancelled' })
  status!: 'cancelled';

  @ApiProperty({ type: String, format: 'date-time' })
  cancelled_at!: string;

  @ApiProperty({ example: '1311.78' })
  refund_amount_mad!: string;

  @ApiProperty({ example: '69.04' })
  fee_amount_mad!: string;

  @ApiProperty({ enum: CancellationLegalBasis })
  legal_basis!: CancellationLegalBasis;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  refund_transaction_id!: string | null;

  @ApiProperty({ type: () => CancellationBreakdownDto })
  breakdown!: CancellationBreakdownDto;
}
```

### Fichier 10/14 : Kafka events Zod `repo/packages/shared-types/src/events/insure-cancellation.events.ts`

```typescript
import { z } from 'zod';

/**
 * Sprint 15 Tache 4.2.4 -- Kafka event schemas pour resiliations.
 *
 * Topics :
 *   - insurtech.events.insure.policy.cancelled
 *   - insurtech.events.insure.policy.cancellation_refund.initiated
 *   - insurtech.events.insure.policy.cancellation_refund.completed
 *
 * Idempotency-Key obligatoire (Sprint 11 + Sprint 13 outbox pattern).
 */

export const PolicyCancelledEventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.literal('insure.policy.cancelled'),
  event_version: z.literal('1.0'),
  occurred_at: z.string().datetime(),
  idempotency_key: z.string().regex(/^cancel-[0-9a-f-]+-\d+$/),
  tenant_id: z.string().uuid(),
  payload: z.object({
    policy_id: z.string().uuid(),
    policy_number: z.string(),
    contact_id: z.string().uuid(),
    cancelled_at: z.string().datetime(),
    effective_date: z.string().datetime(),
    cancelled_by: z.string().uuid(),
    legal_basis: z.enum([
      'droit_retract_17_99',
      'pro_rata',
      'sinistre_major',
      'unpaid',
      'echeance_preavis',
    ]),
    refund_amount_mad: z.string().regex(/^\d+\.\d{2}$/),
    fee_amount_mad: z.string().regex(/^\d+\.\d{2}$/),
    refund_transaction_id: z.string().uuid().nullable(),
    reason: z.string(),
    breakdown: z.record(z.unknown()),
  }),
});

export type PolicyCancelledEvent = z.infer<typeof PolicyCancelledEventSchema>;

export const CancellationRefundInitiatedEventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.literal('insure.policy.cancellation_refund.initiated'),
  event_version: z.literal('1.0'),
  occurred_at: z.string().datetime(),
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  payload: z.object({
    policy_id: z.string().uuid(),
    refund_transaction_id: z.string().uuid(),
    amount_mad: z.string().regex(/^\d+\.\d{2}$/),
    psp: z.enum(['cmi', 'wafacash', 'amanpay']),
  }),
});

export type CancellationRefundInitiatedEvent = z.infer<typeof CancellationRefundInitiatedEventSchema>;

export const CancellationRefundCompletedEventSchema = z.object({
  event_id: z.string().uuid(),
  event_type: z.literal('insure.policy.cancellation_refund.completed'),
  event_version: z.literal('1.0'),
  occurred_at: z.string().datetime(),
  idempotency_key: z.string(),
  tenant_id: z.string().uuid(),
  payload: z.object({
    policy_id: z.string().uuid(),
    refund_transaction_id: z.string().uuid(),
    amount_mad: z.string().regex(/^\d+\.\d{2}$/),
    completed_at: z.string().datetime(),
    psp_reference: z.string(),
  }),
});

export type CancellationRefundCompletedEvent = z.infer<typeof CancellationRefundCompletedEventSchema>;
```

### Fichier 11/14 : Templates Comm `repo/packages/comm/src/templates/fr/cancellation-confirmed.email.hbs`

```handlebars
{{!-- Sprint 15 Tache 4.2.4 -- Template email confirmation resiliation FR --}}
Objet: Confirmation de resiliation de votre police {{policy_number}}

Bonjour {{contact_name}},

Nous accusons reception de votre demande de resiliation et confirmons la
prise en compte effective au {{formatDate effective_date "DD/MM/YYYY"}}.

Police resiliee : {{policy_number}}
Fondement juridique : {{legal_basis_label_fr}}

{{#if has_refund}}
Montant rembourse : {{refund_amount}} MAD
Frais de resiliation : {{fee_amount}} MAD

Le virement de remboursement sera execute par notre prestataire de paiement
(CMI) sous {{eta_days}} jours ouvres sur le compte bancaire associe a votre
police. Vous recevrez une notification de confirmation lors de l'execution
effective du virement.
{{else}}
Aucun remboursement n'est applicable pour ce type de resiliation.
{{/if}}

Conservez ce courriel comme preuve de votre demande de resiliation. Un
certificat de resiliation est disponible dans votre espace assure.

Cordialement,
{{tenant.name}}
{{tenant.address}}
{{tenant.phone}}

---
Reference : Resiliation conforme Loi 17-99 article {{#if is_retract}}9 (droit de retractation){{else}}11/22/235{{/if}}.
Pour toute reclamation : {{tenant.complaint_email}}.
```

```handlebars
{{!-- repo/packages/comm/src/templates/fr/cancellation-confirmed.whatsapp.hbs --}}
Bonjour {{contact_name}},

Votre police {{policy_number}} a ete resiliee au {{formatDate effective_date "DD/MM/YYYY"}}.

{{#if has_refund}}Remboursement : {{refund_amount}} MAD (sous {{eta_days}} jours).{{else}}Aucun remboursement applicable.{{/if}}

Motif : {{legal_basis_label_fr}}

{{tenant.name}}
```

Templates ar-MA et ar suivent la meme structure que le template fr ci-dessus, en arabe darija (ar-MA) et arabe MSA (ar). Voir `repo/packages/comm/src/templates/{ar-MA,ar}/cancellation-confirmed.{whatsapp,email}.hbs` apres scaffolding.

```handlebars
{{!-- Templates cancellation-refund-completed (apres execution CMI) --}}
{{!-- fr/cancellation-refund-completed.email.hbs --}}
Objet: Votre remboursement de {{amount_mad}} MAD a ete execute

Bonjour {{contact_name}},

Nous confirmons l'execution du virement de remboursement suite a la
resiliation de votre police {{policy_number}}.

Montant credit : {{amount_mad}} MAD
Reference PSP : {{psp_reference}}
Date execution : {{formatDate completed_at "DD/MM/YYYY HH:mm"}}

Le credit apparaitra sur votre compte sous 1 a 3 jours ouvres bancaires.

Cordialement,
{{tenant.name}}
```

### Fichier 12/14 : Permissions catalog `repo/packages/auth/src/rbac/permissions.enum.ts` (ajouts)

```typescript
/**
 * Sprint 15 Tache 4.2.4 -- Ajouts dans le catalog permissions.
 * Inserer dans l'enum existant Permissions (Sprint 7).
 */
export enum Permissions {
  // ... permissions Sprint 1-14 (omises) ...

  // Sprint 15 Tache 4.2.4 -- Resiliation
  INSURE_POLICIES_CANCEL_ANTICIPATED = 'insure.policies.cancel_anticipated',
  INSURE_POLICIES_CANCEL_PREVIEW = 'insure.policies.cancel_preview',
  INSURE_CANCELLATIONS_READ = 'insure.cancellations.read',

  // Permission speciale Sprint 18+ (admin ops uniquement)
  INSURE_POLICIES_CANCEL_UNPAID = 'insure.policies.cancel_unpaid',
}

// repo/packages/auth/src/rbac/permissions-matrix.ts
// Mapping roles -> permissions (extension Sprint 15)
export const ROLE_PERMISSIONS_MATRIX: Record<Role, Permissions[]> = {
  // ... mappings Sprint 1-14 ...
  [Role.SKALEAN_SUPER_ADMIN]: [
    // toutes
    Permissions.INSURE_POLICIES_CANCEL_ANTICIPATED,
    Permissions.INSURE_POLICIES_CANCEL_PREVIEW,
    Permissions.INSURE_CANCELLATIONS_READ,
    Permissions.INSURE_POLICIES_CANCEL_UNPAID,
    // ... autres ...
  ],
  [Role.BROKER_ADMIN]: [
    Permissions.INSURE_POLICIES_CANCEL_ANTICIPATED,
    Permissions.INSURE_POLICIES_CANCEL_PREVIEW,
    Permissions.INSURE_CANCELLATIONS_READ,
    Permissions.INSURE_POLICIES_CANCEL_UNPAID, // ops admin tenant
    // ... autres ...
  ],
  [Role.BROKER_USER]: [
    Permissions.INSURE_POLICIES_CANCEL_ANTICIPATED,
    Permissions.INSURE_POLICIES_CANCEL_PREVIEW,
    Permissions.INSURE_CANCELLATIONS_READ,
    // PAS de CANCEL_UNPAID (reserve admin)
    // ... autres ...
  ],
  [Role.BROKER_VIEWER]: [
    Permissions.INSURE_POLICIES_CANCEL_PREVIEW, // preview only
    Permissions.INSURE_CANCELLATIONS_READ,
    // ... autres ...
  ],
};
```

### Fichier 13/14 : Module update `repo/apps/api/src/modules/insure/insure.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';

import {
  InsurePolicy,
  InsurePremium,
  ResiliationService,
  PoliciesService,
  // ... autres services Sprint 14 + 15 ...
} from '@insurtech/insure';
import { PayTransaction, PayModule } from '@insurtech/pay';
import { CommModule } from '@insurtech/comm';
import { AuthModule } from '@insurtech/auth';
import { SharedUtilsModule } from '@insurtech/shared-utils';
import { ClaimsStubModule } from '@insurtech/claims-stub';

import { ResiliationController } from './controllers/resiliation.controller';
// ... autres controllers ...

@Module({
  imports: [
    TypeOrmModule.forFeature([InsurePolicy, InsurePremium, PayTransaction]),
    LoggerModule.forRoot({}),
    AuthModule,
    PayModule, // Sprint 11 : RefundService
    CommModule, // Sprint 9 : CommService
    SharedUtilsModule, // AuditLog + KafkaPublisher + TenantContext
    ClaimsStubModule, // Sprint 19 stub V1 (findOpenByPolicyId -> null)
  ],
  controllers: [
    ResiliationController,
    // ... autres controllers Sprint 14 + 15 ...
  ],
  providers: [
    ResiliationService,
    PoliciesService,
    {
      provide: 'CLAIMS_SERVICE',
      useExisting: 'ClaimsStubService', // V1 stub, Sprint 19 swap real
    },
    // ... autres providers ...
  ],
  exports: [
    ResiliationService,
    // ... autres exports ...
  ],
})
export class InsureModule {}
```

### Fichier 14/14 : Documentation `repo/packages/insure/src/services/RESILIATION.md`

```markdown
# ResiliationService -- Sprint 15 Tache 4.2.4

## Vue d'ensemble

Orchestre la resiliation anticipee d'une police d'assurance avec :
- Computation pro-rata `decimal.js` precision 2 MAD
- 5 fondements juridiques (enum `CancellationLegalBasis`)
- Integration refund Pay Sprint 11
- Cancel cascade premiums futurs
- Kafka outbox pattern + audit log JSONB
- Notifications Comm fire-and-forget bilangue (fr/ar-MA)

## Reference legale

- Loi 17-99 article 9 : droit retract 30j B2C
- Loi 17-99 article 11 : preavis 30j echeance
- Loi 17-99 article 13 : assureur unpaid pas refund
- Loi 17-99 article 21 : aggravation risque
- Loi 17-99 article 22 : sinistre major sans frais
- Loi 17-99 article 235 : pro-rata base 365j

## Usage examples

### Cancel standard (broker initiateur)

```typescript
const result = await resiliationService.cancel({
  policyId: '550e8400-e29b-41d4-a716-446655440000',
  reason: 'Vente vehicule sans repreneur',
  effectiveDate: new Date('2026-05-20'),
});
// result.legalBasis = 'pro_rata'
// result.refundAmount = '1311.78' (MAD)
```

### Cancel avec droit retract (J+15 souscription B2C)

```typescript
const result = await resiliationService.cancel({
  policyId: 'xxx',
  reason: 'Changement avis souscripteur',
  effectiveDate: new Date('2026-05-15'),
});
// result.legalBasis = 'droit_retract_17_99'
// result.refundAmount = '2800.00' (integral)
// result.feeAmount = '0.00'
```

### Cancel sinistre major (Claims Sprint 19)

```typescript
const result = await resiliationService.cancel({
  policyId: 'xxx',
  reason: 'Perte totale vehicule',
  effectiveDate: new Date(),
  cancellationLegalBasis: CancellationLegalBasis.SINISTRE_MAJOR,
  metadata: { claim_id: 'claim-uuid' },
});
// result.feeAmount = '0.00' (pas de frais reglementaire)
```

### Preview avant action

```typescript
const preview = await resiliationService.previewCancellation({
  policyId: 'xxx',
  effectiveDate: new Date('2026-05-20'),
});
// Affiche breakdown sans executer
```

## Diagramme sequence

(voir section 3.3 du prompt task-4.2.4)

## References

- B-15 Tache 4.2.4
- Sprint 11 Pay (RefundService)
- Sprint 13 Kafka outbox pattern
- Sprint 14 InsurePolicy entity
```

---

## 7. Tests complets

### 7.1 Tests unitaires `repo/packages/insure/src/services/resiliation.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PinoLogger } from 'nestjs-pino';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import Decimal from 'decimal.js';
import { addDays, subDays } from 'date-fns';

import { ResiliationService } from './resiliation.service';
import { PoliciesService } from './policies.service';
import { InsurePolicy } from '../entities/insure-policy.entity';
import { InsurePremium } from '../entities/insure-premium.entity';
import {
  CancellationLegalBasis,
  isRefundEligible,
  requiresFees,
} from '../entities/cancellation-legal-basis.enum';
import { TenantContext } from '@insurtech/shared-utils';

describe('ResiliationService', () => {
  let service: ResiliationService;
  let policiesService: PoliciesService;
  let refundService: any;
  let commService: any;
  let auditLog: any;
  let kafkaPublisher: any;
  let claimsService: any;
  let dataSource: any;
  let policiesRepo: Repository<InsurePolicy>;

  const TENANT_ID = '11111111-1111-1111-1111-111111111111';
  const USER_ID = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-18T10:00:00Z'));

    vi.spyOn(TenantContext, 'getCurrentTenantId').mockReturnValue(TENANT_ID);
    vi.spyOn(TenantContext, 'getCurrentUserId').mockReturnValue(USER_ID);

    policiesService = { findById: vi.fn(), findContactByPolicyId: vi.fn() } as any;
    refundService = { requestRefund: vi.fn() };
    commService = { send: vi.fn() };
    auditLog = { log: vi.fn() };
    kafkaPublisher = { publishWithOutbox: vi.fn() };
    claimsService = { findOpenByPolicyId: vi.fn().mockResolvedValue(null) };
    dataSource = {
      transaction: vi.fn(async (cb) => {
        const em = {
          query: vi.fn(),
          update: vi.fn(),
          createQueryBuilder: vi.fn(() => ({
            update: vi.fn().mockReturnThis(),
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            andWhere: vi.fn().mockReturnThis(),
            execute: vi.fn().mockResolvedValue({ affected: 2 }),
            limit: vi.fn().mockReturnThis(),
            orderBy: vi.fn().mockReturnThis(),
            getOne: vi.fn().mockResolvedValue({ id: 'pay-txn-123', status: 'succeeded' }),
          })),
        };
        return cb(em as any);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResiliationService,
        { provide: PoliciesService, useValue: policiesService },
        { provide: getRepositoryToken(InsurePolicy), useValue: { findOne: vi.fn(), createQueryBuilder: vi.fn() } },
        { provide: getRepositoryToken(InsurePremium), useValue: {} },
        { provide: getRepositoryToken('PayTransaction'), useValue: {} },
        { provide: 'CLAIMS_SERVICE', useValue: claimsService },
        { provide: 'RefundService', useValue: refundService },
        { provide: 'CommService', useValue: commService },
        { provide: 'AuditLogService', useValue: auditLog },
        { provide: 'KafkaPublisher', useValue: kafkaPublisher },
        { provide: DataSource, useValue: dataSource },
        { provide: PinoLogger, useValue: { logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) } } },
      ],
    }).compile();

    service = module.get(ResiliationService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const buildPolicy = (overrides: Partial<InsurePolicy> = {}): InsurePolicy => ({
    id: 'policy-uuid-1',
    tenant_id: TENANT_ID,
    contact_id: 'contact-uuid-1',
    policy_number: 'POL-2026-000001',
    status: 'active',
    prime_annuelle: '2800.00',
    start_date: new Date('2026-01-01'),
    end_date: new Date('2027-01-01'),
    is_b2c: true,
    cancelled_at: null,
    cancellation_legal_basis: null,
    canBeCancelled: () => overrides.status !== 'cancelled' && overrides.status !== 'terminated',
    isCancelled: () => overrides.status === 'cancelled',
    ...overrides,
  } as unknown as InsurePolicy);

  describe('cancel - pro-rata standard', () => {
    it('should compute pro-rata correctly mid-year B2C', async () => {
      const policy = buildPolicy();
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'refund-txn-1' });

      // Effective date : 6 mois apres start (J+182)
      const effectiveDate = new Date('2026-07-02');
      const result = await service.cancel({
        policyId: policy.id,
        reason: 'Vente vehicule',
        effectiveDate,
      });

      // pro_rata_unused = 2800 * (365-182) / 365 = 2800 * 183/365 = 1404.38
      // fees = 1404.38 * 0.05 = 70.22
      // refund = 1404.38 - 70.22 = 1334.16
      expect(result.legalBasis).toBe(CancellationLegalBasis.PRO_RATA);
      expect(new Decimal(result.refundAmount).toFixed(2)).toBe('1334.16');
      expect(new Decimal(result.feeAmount).toFixed(2)).toBe('70.22');
      expect(result.breakdown.days_remaining).toBe(183);
      expect(result.breakdown.days_total).toBe(365);
      expect(result.refundTransactionId).toBe('refund-txn-1');
    });

    it('should apply 5% fees exactly with decimal.js precision', async () => {
      const policy = buildPolicy({ prime_annuelle: '10000.00' });
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'refund-txn-2' });

      // Mi-parcours : 50% reste
      const effectiveDate = new Date('2026-07-02');
      const result = await service.cancel({
        policyId: policy.id,
        reason: 'Test precision 5%',
        effectiveDate,
      });

      // pro_rata = 10000 * 183/365 = 5013.6986...
      // Mais avec decimal: precision 2 finale
      const proRata = new Decimal('10000').mul(183).div(365);
      const expectedFees = proRata.mul('0.05').toFixed(2);
      const expectedRefund = proRata.minus(proRata.mul('0.05')).toFixed(2);

      expect(result.feeAmount).toBe(expectedFees);
      expect(result.refundAmount).toBe(expectedRefund);
    });
  });

  describe('cancel - droit retract 17-99 article 9', () => {
    it('should apply integral refund if daysFromStart <= 30 AND is_b2c', async () => {
      const policy = buildPolicy({ start_date: new Date('2026-05-01'), is_b2c: true, prime_annuelle: '3200.00' });
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'refund-droit-retract' });

      const result = await service.cancel({
        policyId: policy.id, reason: 'Changement avis droit retract', effectiveDate: new Date('2026-05-18'),
      });
      expect(result.legalBasis).toBe(CancellationLegalBasis.DROIT_RETRACT_17_99);
      expect(result.refundAmount).toBe('3200.00');
      expect(result.feeAmount).toBe('0.00');
      expect(result.breakdown.is_retract).toBe(true);
    });

    it('should NOT apply droit retract if J+31 (boundary)', async () => {
      const policy = buildPolicy({ start_date: new Date('2026-04-17'), is_b2c: true });
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'r' });

      const result = await service.cancel({
        policyId: policy.id, reason: 'Test boundary 31j', effectiveDate: new Date('2026-05-18'),
      });
      expect(result.legalBasis).toBe(CancellationLegalBasis.PRO_RATA);
      expect(result.breakdown.is_retract).toBe(false);
    });

    it('should NOT apply droit retract if is_b2c=false (B2B exclusion)', async () => {
      const policy = buildPolicy({ start_date: new Date('2026-05-10'), is_b2c: false });
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'r' });

      const result = await service.cancel({
        policyId: policy.id, reason: 'B2B test', effectiveDate: new Date('2026-05-18'),
      });
      expect(result.legalBasis).toBe(CancellationLegalBasis.PRO_RATA);
      expect(new Decimal(result.feeAmount).gt(0)).toBe(true);
    });
  });

  describe('cancel - sinistre_major (article 22)', () => {
    it('should apply pro-rata SANS frais if legal_basis override SINISTRE_MAJOR', async () => {
      const policy = buildPolicy({ prime_annuelle: '5000.00' });
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'r' });

      const result = await service.cancel({
        policyId: policy.id, reason: 'Perte totale', effectiveDate: new Date('2026-07-02'),
        cancellationLegalBasis: CancellationLegalBasis.SINISTRE_MAJOR,
      });
      expect(result.legalBasis).toBe(CancellationLegalBasis.SINISTRE_MAJOR);
      expect(result.feeAmount).toBe('0.00');
      expect(result.refundAmount).toBe(new Decimal('5000').mul(183).div(365).toFixed(2));
    });
  });

  describe('cancel - unpaid (article 13)', () => {
    it('should apply refund=0 if UNPAID', async () => {
      const policy = buildPolicy();
      (policiesService.findById as any).mockResolvedValue(policy);
      const result = await service.cancel({
        policyId: policy.id, reason: 'Non-paiement Q2', effectiveDate: new Date('2026-07-02'),
        cancellationLegalBasis: CancellationLegalBasis.UNPAID,
      });
      expect(result.legalBasis).toBe(CancellationLegalBasis.UNPAID);
      expect(result.refundAmount).toBe('0.00');
      expect(refundService.requestRefund).not.toHaveBeenCalled();
    });
  });

  describe('cancel - echeance_preavis (article 11)', () => {
    it('should auto-detect echeance_preavis if effectiveDate >= end_date', async () => {
      const policy = buildPolicy({ end_date: new Date('2026-05-30') });
      (policiesService.findById as any).mockResolvedValue(policy);
      const result = await service.cancel({
        policyId: policy.id, reason: 'Echeance', effectiveDate: new Date('2026-05-30'),
      });
      expect(result.legalBasis).toBe(CancellationLegalBasis.ECHEANCE_PREAVIS);
      expect(result.refundAmount).toBe('0.00');
    });
  });

  describe('cancel - validations', () => {
    it('should throw NotFoundException if policy not found', async () => {
      (policiesService.findById as any).mockResolvedValue(null);
      await expect(service.cancel({
        policyId: 'unknown-uuid', reason: 'Test 404', effectiveDate: new Date('2026-06-01'),
      })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'POLICY_NOT_FOUND' }) });
    });

    it('should throw ForbiddenException on cross-tenant', async () => {
      const policy = buildPolicy({ tenant_id: 'other-tenant-uuid' });
      (policiesService.findById as any).mockResolvedValue(policy);
      await expect(service.cancel({
        policyId: policy.id, reason: 'XT', effectiveDate: new Date('2026-06-01'),
      })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'CROSS_TENANT_FORBIDDEN' }) });
    });

    it('should throw ConflictException if policy already cancelled', async () => {
      const policy = buildPolicy({ status: 'cancelled', cancelled_at: new Date('2026-04-01') });
      (policiesService.findById as any).mockResolvedValue(policy);
      await expect(service.cancel({
        policyId: policy.id, reason: 'Dup', effectiveDate: new Date('2026-06-01'),
      })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'POLICY_ALREADY_CANCELLED' }) });
    });

    it('should throw ConflictException if open claim exists', async () => {
      const policy = buildPolicy();
      (policiesService.findById as any).mockResolvedValue(policy);
      claimsService.findOpenByPolicyId.mockResolvedValue({ id: 'claim-1', status: 'pending' });
      await expect(service.cancel({
        policyId: policy.id, reason: 'Claim', effectiveDate: new Date('2026-06-01'),
      })).rejects.toMatchObject({ response: expect.objectContaining({ code: 'POLICY_HAS_OPEN_CLAIM' }) });
    });

    it('should reject effectiveDate in the past (Zod)', async () => {
      await expect(service.cancel({
        policyId: 'policy-uuid-1', reason: 'Past', effectiveDate: new Date('2026-01-01'),
      })).rejects.toThrow();
    });

    it('should reject reason < 5 chars', async () => {
      await expect(service.cancel({
        policyId: 'policy-uuid-1', reason: 'No', effectiveDate: new Date('2026-06-01'),
      })).rejects.toThrow();
    });
  });

  describe('cancel - decimal.js precision', () => {
    it('should NOT have float precision issues (0.1 + 0.2 === 0.30)', () => {
      expect(new Decimal('0.1').plus('0.2').toFixed(2)).toBe('0.30');
    });

    it('should compute precise pro-rata for prime 9999.99 MAD', async () => {
      const policy = buildPolicy({ prime_annuelle: '9999.99' });
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'r' });

      const result = await service.cancel({
        policyId: policy.id, reason: 'Precision', effectiveDate: new Date('2026-07-15'),
      });
      const expected = new Decimal('9999.99').mul(170).div(365);
      expect(result.feeAmount).toBe(expected.mul('0.05').toFixed(2));
      expect(result.refundAmount).toBe(expected.minus(expected.mul('0.05')).toFixed(2));
      expect(result.feeAmount).toMatch(/^\d+\.\d{2}$/);
    });
  });

  describe('cancel - cascading effects', () => {
    it('should publish Kafka outbox INSURE_POLICY_CANCELLED', async () => {
      const policy = buildPolicy();
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'r' });

      await service.cancel({ policyId: policy.id, reason: 'K', effectiveDate: new Date('2026-07-02') });
      expect(kafkaPublisher.publishWithOutbox).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          topic: expect.stringContaining('policy.cancelled'),
          idempotencyKey: expect.stringMatching(/^cancel-policy-uuid-1-\d+$/),
        }),
      );
    });

    it('should write audit log with snapshot before/after', async () => {
      const policy = buildPolicy();
      (policiesService.findById as any).mockResolvedValue(policy);
      refundService.requestRefund.mockResolvedValue({ id: 'r' });

      await service.cancel({ policyId: policy.id, reason: 'A', effectiveDate: new Date('2026-07-02') });
      expect(auditLog.log).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          action: 'insure.policy.cancelled',
          metadata: expect.objectContaining({
            snapshot_before: expect.any(Object),
            snapshot_after: expect.any(Object),
            breakdown: expect.any(Object),
          }),
        }),
      );
    });

    it('should NOT call refundService if refund=0 (unpaid)', async () => {
      const policy = buildPolicy();
      (policiesService.findById as any).mockResolvedValue(policy);
      await service.cancel({
        policyId: policy.id, reason: 'U', effectiveDate: new Date('2026-07-02'),
        cancellationLegalBasis: CancellationLegalBasis.UNPAID,
      });
      expect(refundService.requestRefund).not.toHaveBeenCalled();
    });
  });

  describe('previewCancellation', () => {
    it('should return breakdown WITHOUT modifying DB', async () => {
      const policy = buildPolicy({ prime_annuelle: '4500.00' });
      (policiesService.findById as any).mockResolvedValue(policy);
      const preview = await service.previewCancellation({
        policyId: policy.id, effectiveDate: new Date('2026-08-15'),
      });
      expect(preview.legalBasis).toBe(CancellationLegalBasis.PRO_RATA);
      expect(preview.breakdown.refund).toMatch(/^\d+\.\d{2}$/);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('helpers isRefundEligible / requiresFees', () => {
    it('droit_retract -> refund eligible, no fees', () => {
      expect(isRefundEligible(CancellationLegalBasis.DROIT_RETRACT_17_99)).toBe(true);
      expect(requiresFees(CancellationLegalBasis.DROIT_RETRACT_17_99)).toBe(false);
    });
    it('pro_rata -> refund eligible with fees', () => {
      expect(isRefundEligible(CancellationLegalBasis.PRO_RATA)).toBe(true);
      expect(requiresFees(CancellationLegalBasis.PRO_RATA)).toBe(true);
    });
    it('sinistre_major -> refund eligible WITHOUT fees', () => {
      expect(isRefundEligible(CancellationLegalBasis.SINISTRE_MAJOR)).toBe(true);
      expect(requiresFees(CancellationLegalBasis.SINISTRE_MAJOR)).toBe(false);
    });
    it('unpaid -> NOT refund eligible', () => {
      expect(isRefundEligible(CancellationLegalBasis.UNPAID)).toBe(false);
    });
    it('echeance_preavis -> NOT refund eligible', () => {
      expect(isRefundEligible(CancellationLegalBasis.ECHEANCE_PREAVIS)).toBe(false);
    });
  });
});
```

### 7.2 Tests integration `repo/apps/api/test/insure/resiliation.integration-spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as request from 'supertest';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../../src/app.module';
import {
  createCancellablePolicyFixture,
  createPolicyWithRetractRightFixture,
  createPolicyWithOpenClaimFixture,
} from './fixtures/resiliation.fixture';

describe('Resiliation (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const TENANT_B = '22222222-2222-2222-2222-222222222222';
  const BROKER_TOKEN_A = process.env.TEST_BROKER_A_JWT!;
  const BROKER_TOKEN_B = process.env.TEST_BROKER_B_JWT!;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(`DELETE FROM insure_premiums WHERE tenant_id IN ($1, $2)`, [TENANT_A, TENANT_B]);
    await dataSource.query(`DELETE FROM insure_policies WHERE tenant_id IN ($1, $2)`, [TENANT_A, TENANT_B]);
    await dataSource.query(`DELETE FROM audit_logs WHERE tenant_id IN ($1, $2)`, [TENANT_A, TENANT_B]);
  });

  describe('POST /api/v1/insure/policies/:id/cancel', () => {
    it('should cancel policy with pro-rata standard and return 200', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
        .set('x-tenant-id', TENANT_A)
        .send({
          reason: 'Test integration cancel',
          effectiveDate: new Date(Date.now() + 86_400_000).toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        policy_id: policy.id,
        status: 'cancelled',
        legal_basis: expect.any(String),
        refund_amount_mad: expect.stringMatching(/^\d+\.\d{2}$/),
      });

      // Verify DB state
      const updated = await dataSource.query(
        `SELECT status, cancelled_at, cancellation_legal_basis FROM insure_policies WHERE id = $1`,
        [policy.id],
      );
      expect(updated[0].status).toBe('cancelled');
      expect(updated[0].cancelled_at).not.toBeNull();
      expect(updated[0].cancellation_legal_basis).toBeDefined();
    });

    it('should reject cross-tenant cancel with 403', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_B}`)
        .set('x-tenant-id', TENANT_B) // tenant different
        .send({
          reason: 'Cross-tenant attempt',
          effectiveDate: new Date(Date.now() + 86_400_000).toISOString(),
        });

      expect([403, 404]).toContain(response.status); // RLS hide or explicit forbid
    });

    it('should apply droit retract integral for B2C J+15', async () => {
      const policy = await createPolicyWithRetractRightFixture(dataSource, { tenantId: TENANT_A });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
        .set('x-tenant-id', TENANT_A)
        .send({
          reason: 'Droit retract test',
          effectiveDate: new Date().toISOString(),
        });

      expect(response.status).toBe(200);
      expect(response.body.legal_basis).toBe('droit_retract_17_99');
      expect(response.body.fee_amount_mad).toBe('0.00');
      expect(response.body.refund_amount_mad).toBe(policy.prime_annuelle);
    });

    it('should reject 409 if policy has open claim', async () => {
      const policy = await createPolicyWithOpenClaimFixture(dataSource, { tenantId: TENANT_A });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
        .set('x-tenant-id', TENANT_A)
        .send({
          reason: 'With claim',
          effectiveDate: new Date(Date.now() + 86_400_000).toISOString(),
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('POLICY_HAS_OPEN_CLAIM');
    });

    it('should reject 409 if policy already cancelled (idempotency)', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });

      // First cancel
      await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
        .set('x-tenant-id', TENANT_A)
        .send({
          reason: 'First',
          effectiveDate: new Date(Date.now() + 86_400_000).toISOString(),
        })
        .expect(200);

      // Second cancel -> conflict
      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
        .set('x-tenant-id', TENANT_A)
        .send({
          reason: 'Second',
          effectiveDate: new Date(Date.now() + 86_400_000).toISOString(),
        });

      expect(response.status).toBe(409);
      expect(response.body.code).toBe('POLICY_ALREADY_CANCELLED');
    });

    it('should reject 400 if effectiveDate in the past', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
        .set('x-tenant-id', TENANT_A)
        .send({
          reason: 'Past effective',
          effectiveDate: '2020-01-01T00:00:00Z',
        });

      expect(response.status).toBe(400);
    });

    it('should cancel future premiums after cancellation', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, {
        tenantId: TENANT_A,
        withFuturePremiums: 3,
      });

      const effectiveDate = new Date(Date.now() + 86_400_000);
      await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
        .set('x-tenant-id', TENANT_A)
        .send({
          reason: 'Cascade premiums',
          effectiveDate: effectiveDate.toISOString(),
        })
        .expect(200);

      const premiums = await dataSource.query(
        `SELECT status FROM insure_premiums WHERE policy_id = $1 AND due_date > $2`,
        [policy.id, effectiveDate],
      );
      expect(premiums.every((p: { status: string }) => p.status === 'cancelled')).toBe(true);
    });

    it('should write audit log with snapshot before/after', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });
      await cancelPolicy(policy.id, { reason: 'Audit', effectiveDate: futureDate(1) });

      const auditLog = await dataSource.query(
        `SELECT metadata FROM audit_logs WHERE resource_id = $1 AND action = 'insure.policy.cancelled'`,
        [policy.id],
      );
      expect(auditLog.length).toBeGreaterThan(0);
      expect(auditLog[0].metadata.snapshot_before).toBeDefined();
      expect(auditLog[0].metadata.snapshot_after).toBeDefined();
      expect(auditLog[0].metadata.breakdown).toBeDefined();
    });

    it('should publish Kafka outbox INSURE_POLICY_CANCELLED', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });
      await cancelPolicy(policy.id, { reason: 'Kafka', effectiveDate: futureDate(1) });

      const outbox = await dataSource.query(
        `SELECT topic, payload, idempotency_key FROM kafka_outbox WHERE payload->>'policy_id' = $1`,
        [policy.id],
      );
      expect(outbox.length).toBe(1);
      expect(outbox[0].topic).toContain('policy.cancelled');
      expect(outbox[0].idempotency_key).toMatch(/^cancel-/);
    });
  });

  describe('POST /api/v1/insure/policies/:id/cancel/preview', () => {
    it('should return breakdown WITHOUT modifying DB', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });

      const response = await request(app.getHttpServer())
        .post(`/api/v1/insure/policies/${policy.id}/cancel/preview`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
        .set('x-tenant-id', TENANT_A)
        .send({ effectiveDate: futureDate(30) });

      expect(response.status).toBe(200);
      expect(response.body.breakdown).toBeDefined();
      expect(response.body.legal_basis).toBe('pro_rata');

      const policyAfter = await dataSource.query(`SELECT status FROM insure_policies WHERE id = $1`, [policy.id]);
      expect(policyAfter[0].status).toBe('active');
    });
  });

  describe('GET /api/v1/insure/policies/:id/cancellation', () => {
    it('should return details if cancelled', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });
      await cancelPolicy(policy.id, { reason: 'For GET', effectiveDate: futureDate(1) });

      const response = await getCancellation(policy.id);
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('cancelled');
    });

    it('should return { cancelled: false } if active', async () => {
      const policy = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });
      const response = await getCancellation(policy.id);
      expect(response.body).toEqual({ cancelled: false });
    });
  });

  describe('RLS tenant isolation', () => {
    it('tenant B should NOT see tenant A cancellations', async () => {
      const policyA = await createCancellablePolicyFixture(dataSource, { tenantId: TENANT_A });
      await cancelPolicy(policyA.id, { reason: 'A cancel', effectiveDate: futureDate(1) });

      const response = await request(app.getHttpServer())
        .get(`/api/v1/insure/policies/${policyA.id}/cancellation`)
        .set('Authorization', `Bearer ${BROKER_TOKEN_B}`)
        .set('x-tenant-id', TENANT_B);
      expect([403, 404]).toContain(response.status);
    });
  });

  // Helpers
  const futureDate = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
  const cancelPolicy = (id: string, body: { reason: string; effectiveDate: string }) =>
    request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${id}/cancel`)
      .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
      .set('x-tenant-id', TENANT_A)
      .send(body)
      .expect(200);
  const getCancellation = (id: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/insure/policies/${id}/cancellation`)
      .set('Authorization', `Bearer ${BROKER_TOKEN_A}`)
      .set('x-tenant-id', TENANT_A);
});
```

### 7.3 Fixtures `repo/apps/api/test/insure/fixtures/resiliation.fixture.ts`

```typescript
import { DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import { addDays, subDays } from 'date-fns';

interface PolicyFixtureOpts {
  tenantId: string;
  contactId?: string;
  primeAnnuelle?: string;
  isB2c?: boolean;
  startDate?: Date;
  endDate?: Date;
  status?: string;
  withFuturePremiums?: number;
}

export async function createCancellablePolicyFixture(
  ds: DataSource,
  opts: PolicyFixtureOpts,
) {
  const id = randomUUID();
  const contactId = opts.contactId ?? randomUUID();
  const startDate = opts.startDate ?? subDays(new Date(), 180); // J-180
  const endDate = opts.endDate ?? addDays(startDate, 365);

  await ds.query(
    `INSERT INTO insure_policies (
      id, tenant_id, policy_number, contact_id, status, prime_annuelle,
      start_date, end_date, is_b2c, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())`,
    [
      id,
      opts.tenantId,
      `POL-TEST-${id.slice(0, 8)}`,
      contactId,
      opts.status ?? 'active',
      opts.primeAnnuelle ?? '2800.00',
      startDate,
      endDate,
      opts.isB2c ?? true,
    ],
  );

  if (opts.withFuturePremiums) {
    for (let i = 1; i <= opts.withFuturePremiums; i++) {
      await ds.query(
        `INSERT INTO insure_premiums (
          id, tenant_id, policy_id, due_date, amount_mad, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())`,
        [randomUUID(), opts.tenantId, id, addDays(new Date(), i * 30), '700.00'],
      );
    }
  }

  return { id, tenant_id: opts.tenantId, prime_annuelle: opts.primeAnnuelle ?? '2800.00', start_date: startDate, end_date: endDate };
}

export async function createPolicyWithRetractRightFixture(
  ds: DataSource,
  opts: PolicyFixtureOpts,
) {
  // Police souscrite J-10 -> dans la fenetre droit retract 30j
  return createCancellablePolicyFixture(ds, {
    ...opts,
    startDate: subDays(new Date(), 10),
    isB2c: true,
    primeAnnuelle: opts.primeAnnuelle ?? '3200.00',
  });
}

export async function createPolicyWithOpenClaimFixture(
  ds: DataSource,
  opts: PolicyFixtureOpts,
) {
  const policy = await createCancellablePolicyFixture(ds, opts);

  // Insert un claim pending dans la stub table
  await ds.query(
    `INSERT INTO claims_stub (id, tenant_id, policy_id, status, created_at)
     VALUES ($1, $2, $3, 'pending', NOW())`,
    [randomUUID(), opts.tenantId, policy.id],
  );

  return policy;
}
```

---

## 8. Variables d'environnement

Aucune nouvelle variable d'environnement specifique a cette tache. Les variables ci-dessous (deja livrees Sprint 1-14) sont consommees :

```bash
# Sprint 1 : config DB + multi-tenant
DATABASE_URL=postgresql://insurtech:***@atlas-pg.maroc.skalean.ma:5432/insurtech_prod
DATABASE_RLS_ENABLED=true
TZ=Africa/Casablanca                       # critique pour calcul jours pro-rata

# Sprint 6 : multi-tenant
TENANT_CONTEXT_REQUIRED=true

# Sprint 9 : Comm package (templates fr/ar-MA/ar)
COMM_DEFAULT_LOCALE=fr
COMM_FALLBACK_LOCALE=fr

# Sprint 11 : Pay refunds CMI
PAY_CMI_API_URL=https://payment.cmi.co.ma/v2
PAY_CMI_MERCHANT_ID=***                    # injecte par Atlas KMS
PAY_REFUND_TIMEOUT_MS=10000
PAY_REFUND_RETRY_MAX=3

# Sprint 13 : Kafka outbox
KAFKA_OUTBOX_POLL_INTERVAL_MS=1000
KAFKA_BROKERS=kafka-1.atlas.skalean.ma:9092,kafka-2.atlas.skalean.ma:9092

# Sprint 15 nouvelles (defere Sprint 27 mais constantes V1)
# Pas de variable env -- les constantes sont hard-codees dans
# packages/insure/src/constants/cancellation.constants.ts
# Configuration per tenant deferee Sprint 27 :
# - tenants.config.cancellation_fee_rate (default 0.05)
# - tenants.config.cancellation_max_future_days (default 30)
# - tenants.config.cancellation_grace_period_days (default 30 droit retract)

# OpenTelemetry
OTEL_SERVICE_NAME=insurtech-api
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel.atlas.skalean.ma:4318

# Logs Pino
LOG_LEVEL=info
LOG_PRETTY=false                           # production
```

**Critique** : `TZ=Africa/Casablanca` doit etre configure sur tous les containers (API + Worker outbox). Sinon les calculs `differenceInCalendarDays` peuvent etre off-by-one (cf piege 3 section 2.5).

---

## 9. Commandes shell

```bash
cd repo

# 1. Migration
pnpm --filter @insurtech/database migration:generate -- packages/database/src/migrations/AddCancellationColumnsToInsurePolicies
pnpm --filter @insurtech/database migration:run

# 2. Verifications PG
psql -d insurtech_dev -c "\d insure_policies" | grep -E "is_b2c|cancelled_at|cancellation_legal_basis"
psql -d insurtech_dev -c "SELECT unnest(enum_range(NULL::insure_cancellation_legal_basis_enum))"  # 5 valeurs
psql -d insurtech_dev -c "SELECT conname FROM pg_constraint WHERE conrelid='insure_policies'::regclass AND contype='c'"

# 3. Tests + build
pnpm --filter @insurtech/insure vitest run src/services/resiliation.service.spec.ts --coverage --coverage.thresholds.lines=90
pnpm --filter @insurtech/api vitest run test/insure/resiliation.integration-spec.ts
pnpm typecheck && pnpm lint
pnpm --filter @insurtech/insure build && pnpm --filter @insurtech/api build

# 4. Smoke test API
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login -d '{"email":"broker@tenant.ma","password":"***"}' | jq -r .access_token)

# Preview
curl -X POST http://localhost:3000/api/v1/insure/policies/POLICY_ID/cancel/preview \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: TENANT_UUID" -H "Content-Type: application/json" \
  -d '{"effectiveDate":"2026-06-01T00:00:00Z"}'

# Cancel reel
curl -X POST http://localhost:3000/api/v1/insure/policies/POLICY_ID/cancel \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: TENANT_UUID" -H "Content-Type: application/json" \
  -d '{"reason":"Vente vehicule","effectiveDate":"2026-06-01T00:00:00Z"}'

# Verifications post-cancel
psql -d insurtech_dev -c "SELECT action, metadata->'breakdown' FROM audit_logs WHERE resource_id='POLICY_ID' AND action='insure.policy.cancelled'"
psql -d insurtech_dev -c "SELECT topic, payload, idempotency_key, status FROM kafka_outbox WHERE payload->>'policy_id'='POLICY_ID'"
curl http://localhost:3000/metrics | grep insure_resiliation_

# 5. Test rollback
pnpm --filter @insurtech/database migration:revert
pnpm --filter @insurtech/database migration:run
```

---

## 10. Criteres validation V1-V30 (P0/P1/P2)

### Criteres P0 (bloquants -- 18 minimum)

- **V1 (P0)** : Pro-rata calcul correct avec decimal.js precision 2.
  - Commande : `pnpm vitest run resiliation.service.spec.ts -t "pro-rata standard"`
  - Expected : `refund=1334.16` MAD pour `prime=2800, days_remaining=183, total=365, fee_rate=0.05`

- **V2 (P0)** : Frais 5% applique correctement.
  - Commande : test unit "should apply 5% fees exactly with decimal.js precision"
  - Expected : `fees = pro_rata_unused * 0.05` precision 2

- **V3 (P0)** : Droit retract 30 jours integral pour B2C.
  - Commande : test unit "should apply integral refund if daysFromStart <= 30 AND is_b2c"
  - Expected : `refund = prime_annuelle, fees = 0, legal_basis='droit_retract_17_99'`

- **V4 (P0)** : Droit retract NON applique si is_b2c=false (B2B exclusion).
  - Commande : test unit "should NOT apply droit retract if is_b2c=false"
  - Expected : `legal_basis='pro_rata'`, fees > 0

- **V5 (P0)** : Droit retract NON applique a J+31 (boundary).
  - Commande : test unit "should NOT apply droit retract if J+31 (boundary)"
  - Expected : `legal_basis='pro_rata'`

- **V6 (P0)** : Sinistre_major applique pro-rata SANS frais.
  - Commande : test unit "should apply pro-rata SANS frais if SINISTRE_MAJOR"
  - Expected : `fees='0.00', refund = prime * days_remaining / total`

- **V7 (P0)** : Unpaid : refund=0 sans appel RefundService.
  - Commande : test unit "should apply refund=0 if UNPAID"
  - Expected : `refundService.requestRefund` NON appele

- **V8 (P0)** : Echeance_preavis auto-detecte si effectiveDate >= end_date.
  - Commande : test unit
  - Expected : `legal_basis='echeance_preavis', refund='0.00'`

- **V9 (P0)** : Refund initiate via Pay Sprint 11 (`requestRefund`).
  - Commande : test integration verifies `pay_transactions` INSERT
  - Expected : `cancellation_refund_transaction_id` not null

- **V10 (P0)** : Premiums futurs cancelled (status='pending' AND due_date > effectiveDate).
  - Commande : test integration "should cancel future premiums"
  - Expected : tous premiums futurs `status='cancelled'`

- **V11 (P0)** : Status workflow respect : active -> cancelled (immutable).
  - Commande : test integration "should reject 409 if already cancelled"
  - Expected : 409 Conflict avec `code=POLICY_ALREADY_CANCELLED`

- **V12 (P0)** : Cross-tenant forbidden (RLS + service check).
  - Commande : test integration "should reject cross-tenant cancel"
  - Expected : 403 ou 404

- **V13 (P0)** : effectiveDate dans le passe rejected (Zod).
  - Commande : test integration "should reject 400 if effectiveDate in the past"
  - Expected : 400 Bad Request

- **V14 (P0)** : Open claim conflict.
  - Commande : test integration "should reject 409 if open claim"
  - Expected : 409 avec `code=POLICY_HAS_OPEN_CLAIM`

- **V15 (P0)** : Audit log snapshot before/after persiste.
  - Commande : test integration "should write audit log"
  - Expected : `metadata.snapshot_before` + `metadata.snapshot_after` + `metadata.breakdown` JSONB

- **V16 (P0)** : Kafka event INSURE_POLICY_CANCELLED publie via outbox.
  - Commande : test integration "should publish Kafka outbox"
  - Expected : ligne `kafka_outbox` avec topic + idempotency_key `cancel-{id}-{ts}`

- **V17 (P0)** : Idempotency : cancel deja cancelled -> 409.
  - Expected : pas de double publication Kafka, pas de double refund Pay

- **V18 (P0)** : Tests : 28+ unit + 14+ integration = 42 scenarios passants.

### Criteres P1 (importants -- 8 minimum)

- **V19 (P1)** : Notifications Comm fire-and-forget (echec n'interrompt pas).
  - Commande : test unit avec `commService.send` rejected -> cancel reussi quand meme
  - Expected : `result.status='cancelled'`, log warn

- **V20 (P1)** : Permissions catalog enrichi avec 3 permissions.
  - Expected : `insure.policies.cancel_anticipated`, `cancel_preview`, `insure.cancellations.read`

- **V21 (P1)** : Endpoint preview retourne breakdown sans modifier DB.
  - Commande : test integration "should return breakdown WITHOUT modifying DB"
  - Expected : `policy.status` reste `active`

- **V22 (P1)** : Endpoint GET cancellation retourne 200 si cancelled, `{cancelled:false}` sinon.

- **V23 (P1)** : Coverage tests >= 90% sur `resiliation.service.ts`.

- **V24 (P1)** : decimal.js precision : `0.1 + 0.2 === '0.30'` test pass.

- **V25 (P1)** : Migration UP + DOWN tested sans erreur.

- **V26 (P1)** : RLS isolation tenant verifiee par test E2E.

### Criteres P2 (nice-to-have -- 4 minimum)

- **V27 (P2)** : OpenAPI/Swagger docs generes avec tag `insure-cancellations`.
- **V28 (P2)** : OpenTelemetry spans presents pour `cancel`, `previewCancellation`, `computeProRata`.
- **V29 (P2)** : Logger Pino structured logs avec tenant_id + policy_id + legal_basis sur 100% des appels.
- **V30 (P2)** : Templates Handlebars valides via test smoke `handlebars.precompile`.

---

## 11. Edge cases + troubleshooting (12 cas)

### Edge case 1 : Resiliation a J+30 exactement (boundary droit retract)

**Scenario** : Police souscrite 1er mai, resiliation effective 31 mai (J+30 inclusif).
**Probleme** : Risque ambiguite J+30 = encore retract ou deja pro_rata ?
**Solution** : Loi 17-99 article 9 : "dans un delai de 30 jours" -> inclusif. Donc `daysFromStart <= 30` (et non `< 30`). Test unit boundary explicite : J+30 = retract, J+31 = pro_rata. Documenter dans `determineLegalBasis` commentaire JSDoc.

### Edge case 2 : Police suspended au moment de la resiliation

**Scenario** : Police suspended (Tache 4.2.3) puis broker decide de resilier definitivement au lieu de reprendre.
**Probleme** : Le pro-rata doit-il compter les jours de suspension comme "couverts" ou pas ?
**Solution** : Pour V1, les jours de suspension sont consideres comme **non-couverts** : `days_remaining` est calcule sur la base `end_date - effectiveDate` sans deduire la suspension. C'est generalement plus favorable a l'assure (refund plus eleve). Documentation explicite dans `RESILIATION.md`. Si tenant souhaite logique inverse, configurer Sprint 27.

### Edge case 3 : Prime annuelle modifiee par endorsement entre souscription et resiliation

**Scenario** : Prime initiale 2 800 DH, endorsement (Tache 4.2.6) ajoute conducteur -> prime devient 3 200 DH. Resiliation 6 mois plus tard.
**Probleme** : Pro-rata sur quelle prime ? `prime_annuelle` actuelle (3 200) ou moyenne ponderee historique ?
**Solution** : Pro-rata sur `prime_annuelle` actuelle (3 200 DH) -- c'est la valeur en vigueur. La modification d'endorsement a deja fait l'objet d'un avenant + paiement complement. Audit log capture la valeur utilisee. Test integration dedie.

### Edge case 4 : effectiveDate = J0 (cancel immediate)

**Scenario** : Broker resilie aujourd'hui meme avec effet immediat.
**Probleme** : `daysFromStart = today - start_date`. Si la police a 5 jours, `effectiveDate=today`, calcul classique fonctionne. Mais si la police a 1 jour seulement (`daysFromStart=1`), refund integral droit retract.
**Solution** : Logique correcte par defaut. Test unit J+1 verifie `legal_basis='droit_retract_17_99'`, `refund=prime`. Aucun code special requis.

### Edge case 5 : Police annee bissextile (366 jours)

**Scenario** : Police souscrite 1er mars 2024 (annee bissextile), end_date 1er mars 2025, total_duration = 365 jours civils (calendaire) car traverse fevrier 2025 = 28j.
**Probleme** : `differenceInCalendarDays(2025-03-01, 2024-03-01) = 365` (correct, ignore le 29 fevrier traverse car la difference calendaire est de 365j). Mais si police bissextile complete (`Mar 1 2020 -> Mar 1 2021` = 365j aussi).
**Solution** : `differenceInCalendarDays` gere correctement les annees bissextiles. Test unit dedie sur annee bissextile. Pas de correction necessaire.

### Edge case 6 : Refund Pay echoue (PSP CMI down)

**Scenario** : `requestRefund` retourne erreur HTTP 503 (CMI maintenance).
**Probleme** : Si on rollback toute la transaction, le `policy.status` reste `active`, mais on a peut-etre deja envoye notification Comm "votre police est resiliee".
**Solution** : Notifications Comm sont **fire-and-forget APRES commit**. Donc si transaction rollback, notification jamais envoyee. Si Pay refund echoue, exception propage -> rollback -> 500 retourne au client. Broker retry manuel ou cron retry. Test integration mock Pay echec verifie rollback complet.

### Edge case 7 : Tenant timezone differente

**Scenario** : Tenant en Tunisie (UTC+1 hiver, UTC+1 ete sans DST), serveur en France (UTC+1 hiver, UTC+2 ete avec DST).
**Probleme** : Calcul `daysFromStart` peut differer selon TZ serveur vs tenant.
**Solution** : `TZ=Africa/Casablanca` configure sur tous les containers (Maroc = UTC+1 sans DST). Pour multi-pays futur (Sprint 30+), `tenants.timezone` column + `differenceInCalendarDays` avec `{ locale: tenant.timezone }`. Pour V1 : Maroc only, hard-code TZ.

### Edge case 8 : Concurrent cancel sur meme police (race condition)

**Scenario** : 2 brokers du meme tenant cliquent "cancel" en meme temps.
**Probleme** : 2 transactions PG concurrentes pourraient toutes deux passer la verification `status='active'`, puis update -> 2 lignes audit, 2 refunds.
**Solution** : Transaction PG isolation `SERIALIZABLE` + `SELECT ... FOR UPDATE` sur la police au debut. Si deux concurrent -> 2eme bloque jusqu'a commit du 1er puis voit `status='cancelled'` -> 409. Test integration concurrent verifie unicite.

### Edge case 9 : Police flotte avec primes per object

**Scenario** : Police flotte (Tache 4.2.5) avec 12 vehicules. Resiliation globale.
**Probleme** : `prime_annuelle` agrege ou per-object ?
**Solution** : Pour V1, on resilie la police entiere -> `prime_annuelle` (globale flotte). Les `policy_objects` sont aussi `status='cancelled'` en cascade (FK ON DELETE). Pour resiliation partielle (1 vehicule retire), utiliser `flotte.service.removeObject` (Tache 4.2.5) qui reutilise le pattern pro-rata mais sur `policy_objects.prime_share`. Documenter dans `RESILIATION.md`.

### Edge case 10 : Effective date > 30 jours dans le futur

**Scenario** : Broker veut programmer une resiliation pour J+60.
**Probleme** : Pour V1, on limite a J+30 max (constante `MAX_FUTURE_EFFECTIVE_DAYS`).
**Solution** : Zod refine : `refine((d) => differenceInDays(d, new Date()) <= 30, { message: 'effectiveDate must be within 30 days' })`. Si tenant a besoin de J+60+, configurer Sprint 27. Test unit dedie.

### Edge case 11 : Donnees absentes pour calcul (prime null)

**Scenario** : Police anciennement migree, `prime_annuelle` accidentellement null.
**Probleme** : `new Decimal(null)` retourne NaN.
**Solution** : Zod schema entity verifie `prime_annuelle` NOT NULL au load. Si null detecte au runtime, throw `BadRequestException('INVALID_POLICY_DATA')`. Test unit dedie. Plus migration data cleanup Sprint 28.

### Edge case 12 : Audit log entry tres lourd (breakdown JSONB > 8 KB)

**Scenario** : Breakdown enrichi avec historique endorsements + claims antecedents -> JSONB > 8 KB.
**Probleme** : Index PG sur JSONB inefficient au-dela d'un certain size, queries Sprint 18 lentes.
**Solution** : Breakdown limite a champs essentiels (~ 1 KB). Si besoin historique enrichi, lien vers `audit_logs` ID dans metadata, query separee. Test verifie taille breakdown < 2 KB.

---

## 12. Conformite Maroc detaillee

### Loi 17-99 (Code des Assurances)
- **Article 9** : Droit retract 30 jours B2C -> remboursement integral sans frais.
  - **Implementation** : `is_b2c=true && daysFromStart <= 30 -> legal_basis='droit_retract_17_99', refund=prime, fees=0`
  - **Audit ACAPS** : query `audit_logs WHERE metadata->>'legal_basis_label_fr' LIKE '%retractation%'` Sprint 28
- **Article 11** : Resiliation a echeance par assure avec preavis 30j LRAR.
  - **Implementation** : `effectiveDate >= end_date -> legal_basis='echeance_preavis', refund=0`
- **Article 13** : Resiliation par assureur pour non-paiement apres mise en demeure 10j.
  - **Implementation** : `legal_basis='unpaid'` (override), `refund=0`, permission speciale `insure.policies.cancel_unpaid`
- **Article 21** : Aggravation risque -> resiliation possible par chacune des parties.
  - **Implementation** : cas marginal traite comme `pro_rata` standard avec audit motif specifique
- **Article 22** : Resiliation suite sinistre majeur.
  - **Implementation** : `legal_basis='sinistre_major'` (override Claims Sprint 19), pro-rata SANS frais
- **Article 235** : Pro-rata temporis base 365 jours.
  - **Implementation** : `differenceInCalendarDays(end_date, start_date)` typiquement 365

### Loi 53-05 (Echange electronique donnees juridiques)
- **Article 6** : Reconnaissance signature electronique qualifiee.
  - **Implementation V1** : audit log + acte de resiliation PDF (si requis cas non-paiement contesté Sprint 18). Pour Sprint 15, pas de signature requise par defaut (broker initiateur).

### Loi 43-20 (Services de confiance pour transactions electroniques)
- **Article 21** : Cadre des PSC.
- **Article 25** : Timestamping qualified TSA.
  - **Implementation** : pas applicable directement Sprint 15 (defere si acte signe).

### Loi 09-08 (CNDP -- Protection donnees personnelles)
- **Article 6** : Finalite limitee, conservation 5 ans.
  - **Implementation** : audit log JSONB metadata, retention policy 5 ans (cron Sprint 28 anonymise `cancelled_reason` + `breakdown` apres 5 ans).
- **Article 7** : Information de la personne concernee.
  - **Implementation** : notification Comm template `cancellation-confirmed` mentionne droit acces/rectification CNDP.

### Decret 2-09-165 (application loi 09-08)
- Notification CNDP traitement -> deja deposee Sprint 1 lors creation projet (numero notif `CNDP-2025-XXXX`).

### Loi 38-14 (Obligations comptables modifiees)
- **Article 22** : Archivage actes comptables 10 ans.
  - **Implementation** : audit log + breakdown JSONB conserves S3 Atlas Cloud Benguerir avec object lock 10 ans.
- **Article 25** : Ecritures immuables apres cloture mensuelle.
  - **Implementation** : decision-014 commissions immutables. Resiliation n'annule pas commission deja versee.

### Reporting ACAPS (Sprint 18)
- **Decision quarterly portfolio** : ACAPS exige declaration variation polices (souscriptions, transferts, resiliations) par categorie.
  - **Implementation** : Kafka event `INSURE_POLICY_CANCELLED` consume Sprint 18 `AcapsCancellationReportingConsumer` -> XLSX report aggregat par `cancellation_legal_basis`.

### Audit annuel ACAPS (Sprint 28)
- Verification conformite droit retract 17-99 article 9.
- Queries : `SELECT COUNT(*) FROM insure_policies WHERE cancellation_legal_basis='droit_retract_17_99' GROUP BY tenant_id, EXTRACT(YEAR FROM cancelled_at)`.

### Reglementation CMI / Wafacash
- Refunds via CMI (Centre Monetique Interbancaire) ou Wafacash :
  - ETA 3-5 jours ouvres MA pour virements bancaires
  - Plafond 50 000 DH par operation (au-dela : decoupage requis Sprint 27)
  - Frais PSP a la charge tenant (~ 0.5-1.5% selon volume contracte)

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

Cette tache DOIT respecter toutes les conventions du programme :

### Multi-tenant strict (decision-002)
- Header `x-tenant-id` obligatoire sur tous endpoints cancel.
- TenantGuard verifie token JWT.tenant_id == header.x-tenant-id.
- RLS policy Postgres herite de `insure_policies` (Sprint 14 deja livre).
- TenantContext AsyncLocalStorage propage tenant_id dans tout le service.
- `SET LOCAL app.current_tenant = $1` explicite au debut de la transaction (defense en profondeur).

### Validation strict (Zod -- decision-009)
- `CancelPolicyInputSchema`, `PreviewCancellationInputSchema` Zod uniquement.
- JAMAIS class-validator, JAMAIS Joi/Yup.
- Validation au controller (ZodValidationPipe) + au service (Zod.parse pour defense en profondeur).

### Logger strict (Pino)
- `PinoLogger` injecte par DI NestJS.
- JAMAIS `console.log`, JAMAIS `new Logger()`.
- Format JSON structured : `tenant_id, user_id, policy_id, action, legal_basis, refund_amount_mad, duration_ms`.

### decimal.js strict (decision-016)
- TOUS calculs monetaires via `new Decimal(...)`, `.mul()`, `.div()`, `.minus()`, `.plus()`, `.toFixed(2)`.
- JAMAIS `Number`, `parseFloat`, `Math.round`.
- Configuration globale : `Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP })`.
- Outputs API : strings ('1311.78') pas numbers (1311.78 -> JS precision loss).

### Package manager strict
- pnpm uniquement, `engine-strict=true`, Node >= 22.11.0.

### TypeScript strict
- `strict: true`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`.
- Imports explicites : pas de `import * as`.
- Aucun `any` dans le code service / controller.

### Tests strict
- Vitest unit + integration, Playwright E2E (Sprint 16+).
- Coverage cible >= 90% pour modules critiques (resiliation est critique).

### RBAC strict (decision-002 + Sprint 7)
- `@Permissions()` decorator sur chaque endpoint.
- RolesGuard global.
- 3 permissions specifiques : `insure.policies.cancel_anticipated`, `insure.policies.cancel_preview`, `insure.cancellations.read`.
- Permission speciale `insure.policies.cancel_unpaid` reservee admin ops.

### Events Kafka strict
- Topic format `insurtech.events.insure.policy.{action}`.
- Schemas Zod (validate publish + consume).
- Idempotency-Key obligatoire `cancel-{policy_id}-{timestamp}`.
- Outbox pattern Sprint 13 (pas de publish direct hors transaction).

### Imports strict
- `@insurtech/*` aliases (jamais relatifs `../../../../`).

### Skalean AI strict (decision-005)
- Aucun appel IA direct dans le service. Defere Sprint 30+ (MCP tool eventuellement pour predict churn).

### No-emoji strict (decision-006 ABSOLU)
- Aucune emoji dans code, commentaires, logs, templates, commits, audit messages.
- Pre-commit hook `check-no-emoji.sh` actif.

### Idempotency-Key strict
- `INSURE_POLICY_CANCELLED` event publie avec `idempotency_key: cancel-{policy_id}-{cancelled_at.getTime()}`.
- Refund Pay : `idempotency_key: cancel-refund-{policy_id}-{cancelled_at.getTime()}`.
- Comm notifications : `idempotency_key: cancel-notif-{policy_id}-{channel}-{cancelled_at.getTime()}`.

### Conventional Commits strict
- Format `feat(sprint-15): description` 50-72 chars max.
- Body metadata obligatoire (Task, Sprint, Phase).

### Cloud souverain MA strict (decision-008)
- Atlas Cloud Benguerir uniquement.
- Aucune donnee resiliation hors MA.
- Refunds via CMI/Wafacash/AmanPay MA uniquement.
- Encryption at rest AES-256-GCM via Atlas KMS.
- TLS 1.3 obligatoire.

### Audit log obligatoire
- Toute mutation -> audit_logs INSERT dans la meme transaction.
- Snapshot before + after JSONB metadata.
- Retention 5 ans + anonymisation Sprint 28.

### Currency strict V1
- MAD only.
- Precision 2 decimales (centimes).
- Multi-devises EUR/USD defere Sprint 30+.

### Conformite legale obligatoire
- Tous les fondements juridiques (5 valeurs enum) doivent etre tracables et reportables ACAPS.
- Audit ACAPS Sprint 28 doit pouvoir filtrer par `cancellation_legal_basis`.

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Typecheck strict
pnpm typecheck                                              # 0 erreur attendu

# 2. Lint Biome
pnpm lint                                                    # 0 erreur attendu

# 3. Tests unit resiliation + coverage
pnpm --filter @insurtech/insure vitest run \
  src/services/resiliation.service.spec.ts \
  --coverage --coverage.thresholds.lines=90
                                                             # coverage >= 90% resiliation.service.ts

# 4. Tests integration resiliation
pnpm --filter @insurtech/api vitest run \
  test/insure/resiliation.integration-spec.ts

# 5. No-emoji check (decision-006)
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" \
  packages/insure/src/entities/cancellation-legal-basis.enum.ts \
  packages/insure/src/services/resiliation.service.ts \
  packages/insure/src/schemas/insure-cancellation.schema.ts \
  packages/insure/src/constants/cancellation.constants.ts \
  apps/api/src/modules/insure/controllers/resiliation.controller.ts \
  apps/api/src/modules/insure/dto/cancel-policy.dto.ts \
  apps/api/src/modules/insure/dto/preview-cancellation.dto.ts \
  apps/api/src/modules/insure/dto/cancellation-response.dto.ts \
  apps/api/src/modules/insure/dto/cancellation-breakdown.dto.ts \
  packages/comm/src/templates/{fr,ar-MA,ar}/cancellation-*.hbs \
  && echo FAIL || echo OK

# 6. No console.log / no Number for money
grep -rn "console\.\(log\|debug\|info\)" \
  packages/insure/src/services/resiliation.service.ts \
  apps/api/src/modules/insure/controllers/resiliation.controller.ts \
  | grep -v ".spec.ts" \
  && echo FAIL || echo OK

grep -rnE "(parseFloat|Number\(|\.toFixed\(0\))" \
  packages/insure/src/services/resiliation.service.ts \
  | grep -v "// allowed" \
  && echo FAIL || echo OK

# 7. Migration up + down test
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/database migration:revert
pnpm --filter @insurtech/database migration:run

# 8. Verification colonnes presentes
psql -d insurtech_dev -c "\d insure_policies" | grep -E "is_b2c|cancellation_legal_basis|cancellation_refund"

# 9. Verification CHECK constraints
psql -d insurtech_dev -c "
  SELECT conname, pg_get_constraintdef(oid)
  FROM pg_constraint
  WHERE conrelid='insure_policies'::regclass AND contype='c' AND conname LIKE 'chk_cancellation%'
"

# 10. Verification RLS herite
psql -d insurtech_dev -c "
  SELECT polname FROM pg_policy WHERE polrelid='insure_policies'::regclass
"

# 11. Smoke test API local
docker-compose up -d postgres kafka redis
pnpm --filter @insurtech/api start:dev &
sleep 5
# (smoke test curl voir section 9)
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-15): resiliation anticipee pro-rata + refund Pay

Implements Insure ResiliationService avec computation pro-rata decimal.js
precision 2 MAD, integration RefundService Sprint 11, et conformite
stricte Loi 17-99 articles 9 (droit retract 30j B2C), 11 (echeance
preavis), 13 (unpaid), 22 (sinistre major), 235 (base 365j).

Livrables:
- Migration AddCancellationColumnsToInsurePolicies + enum 5 valeurs
  legal_basis + CHECK consistency + indexes
- Entity InsurePolicy enrichie (8 colonnes + 2 relations)
- Schema Zod CancelPolicy/Preview/Breakdown/Result
- Constantes DEFAULT_CANCELLATION_FEE_RATE + RETRACT_RIGHT_PERIOD_DAYS
- ResiliationService: cancel + previewCancellation +
  findCancellationByPolicyId + listCancellationsByTenant +
  determineLegalBasis (private) + computeProRata (private)
- ResiliationController REST: POST /cancel + POST /cancel/preview +
  GET /cancellation
- 4 DTOs Swagger
- Templates Comm cancellation-confirmed + cancellation-refund-completed
  fr/ar-MA/ar email + WA (12 fichiers)
- Permissions enrichies: insure.policies.cancel_anticipated +
  cancel_preview + insure.cancellations.read + cancel_unpaid (admin)
- Kafka topics + schemas Zod 3 events
- 28 tests unit (decimal.js precision + 5 legal_basis + validations +
  cascading + helpers) + 14 tests integration (Postgres + RLS + flow
  complet + audit + Kafka outbox + cross-tenant)

Tests: 28 unit + 14 integration = 42 passing
Coverage: 92% resiliation.service.ts

Conformite legal MA:
- Loi 17-99 articles 9, 11, 13, 21, 22, 235
- Loi 09-08 CNDP audit retention 5 ans
- Loi 38-14 archivage 10 ans S3 Atlas
- ACAPS reporting Sprint 18 via Kafka event

Task: 4.2.4
Sprint: 15 (Phase 4 / Sprint 2 dans phase Vertical Insure)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Reference: B-15 Tache 4.2.4"
```

---

## 16. Workflow next step

Apres commit de cette tache 4.2.4 :

- Passer a `task-4.2.5-polices-flottes-1-police-n-objets.md` (depend de 4.2.4 pour pattern pro-rata refund applique a `removeObject`).
- Le pattern computation pro-rata avec decimal.js pose ici sera reutilise dans :
  - Tache 4.2.5 (Flotte `removeObject` -> refund pro-rata sur `policy_object.prime_share`)
  - Sprint 19 Claims (indemnisation partielle avec calcul pro-rata cumule)
- Le pattern audit log JSONB + Kafka outbox + Comm fire-and-forget est consolidite avec les patterns Tache 4.2.1 (Transfer) et Tache 4.2.3 (Suspension), formant le **socle lifecycle police** reutilisable Sprint 15-18.

Le `CancellationLegalBasis` enum est utilise par :
- Sprint 16 Web Broker UI : filtres dashboard cancellations par legal_basis
- Sprint 17 Customer Portal : B2C portail self-service exclusivement `droit_retract_17_99`
- Sprint 18 ACAPS reporting : agregation quarterly XLSX par legal_basis
- Sprint 19 Claims : declenche `sinistre_major` override automatique
- Sprint 28 Audit conformite : verifie ratio droit_retract / total cancellations

---

## 17. References croisees programme

### Sprints amont (dependances strictes)
- Sprint 1 : Postgres + pgcrypto + RLS infrastructure
- Sprint 5 : argon2id passwords (pas direct mais convention)
- Sprint 6 : multi-tenant RLS + TenantContext + TenantGuard
- Sprint 7 : RBAC permissions + RolesGuard + @Permissions decorator
- Sprint 8 : CRM Contacts entity + ContactsService (preferred_language)
- Sprint 9 : Comm package + CommService + templates Handlebars i18n
- Sprint 10 : Barid eSign (pas requis V1 cancel mais pattern Tache 4.2.1 reuse)
- Sprint 11 : Pay package + RefundService + PayTransaction entity + CMI
- Sprint 13 : Kafka outbox pattern + AuditLogService + KafkaPublisher
- Sprint 14 : InsurePolicy + InsurePremium entites livrees

### Sprints aval (consommateurs)
- Sprint 15 Tache 4.2.5 : Flotte reutilise pattern pro-rata refund
- Sprint 16 Web Broker App : UI cancellation + preview live
- Sprint 17 Web Customer Portal : self-service B2C droit retract
- Sprint 18 Compliance ACAPS : quarterly portfolio report
- Sprint 19 Claims : sinistre_major override + indemnisation
- Sprint 27 Admin Tenant Custom : configuration fee_rate per tenant
- Sprint 28 Audit annuel ACAPS : conformite droit retract
- Sprint 30+ Sky AI MCP : tool predict_churn_risk (defere strict)

### Decisions strategiques applicables
- decision-001 monorepo pnpm + Turborepo
- decision-002 multi-tenant 3 niveaux
- decision-003 TypeORM 0.3
- decision-005 Skalean AI sans MCP
- decision-006 no-emoji ABSOLU
- decision-007 mocks externes (sauf Pay reel)
- decision-008 cloud souverain MA
- decision-009 Zod validation
- decision-010 cascade renumerotation v2.2
- decision-014 commissions immutables
- decision-016 decimal.js precision 2

---

**Fin du prompt task-4.2.4-resiliation-anticipee-pro-rata-refund.md**

Densite cible : ~120 ko
Code patterns : 14 fichiers complets (migration, enum, entity extension, schemas Zod, constantes, service, controller, 4 DTOs, templates Comm, permissions, module, doc)
Tests : 28 unit + 14 integration = 42 cas concrets avec describe/it/expect Vitest
Criteres validation : V1-V30 (P0/P1/P2)
Edge cases : 12 scenarios documentes avec Scenario/Probleme/Solution
Conformite MA : Loi 17-99 articles 9, 11, 13, 21, 22, 235 + Loi 53-05 + Loi 43-20 + Loi 09-08 + Loi 38-14 + ACAPS Sprint 18 + audit Sprint 28






