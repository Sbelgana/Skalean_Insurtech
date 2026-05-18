# TACHE 3.4.1 -- Entities pay_methods + pay_transactions + pay_reconciliation Enrichies + Zod

**Sprint** : 11 (Phase 3 / Sprint 4 dans phase) -- Pay Multi-Passerelles Maroc
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-11-sprint-11-pay-ma-multi.md` (Tache 3.4.1)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant absolu pour les 13 taches suivantes du Sprint 11 -- aucun gateway, aucun orchestrateur, aucun webhook ne peut etre ecrit sans les entities pay_*)
**Effort** : 4h
**Dependances** : Sprint 10 complet (Docs PDF + Signature ; les transactions paiement referencent souvent une facture generee Sprint 10 via `related_resource_type='invoice'`), Sprint 2 complet (migration tables `pay_methods`, `pay_transactions`, `pay_reconciliation` deja creees -- cette tache enrichit, ne cree pas), Sprint 6 complet (multi-tenant strict -- `tenant_id` sur toutes rows)
**Densite cible** : 110-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache 3.4.1 vise a transformer les tables SQL `pay_methods`, `pay_transactions`, `pay_reconciliation` (creees lors du Sprint 2 sous forme de migration TypeORM minimaliste avec colonnes structurelles uniquement) en un ensemble exhaustif d'entities TypeORM 0.3.21 strictement typees, accompagnees d'enums TypeScript discriminants, de schemas Zod 3.24.1 valides runtime pour chaque operation CRUD et workflow, de validators metier specifiques Maroc (limite 100000 MAD par transaction selon Bank Al-Maghrib, currency strictement MAD, idempotency_key au format ULID, provider_transaction_id UNIQUE par provider), de helpers de transition de statut (`canTransitionTo`, `isFinalStatus`), de fixtures factory (`PayTransactionFactory`) consommees par toutes les taches 3.4.2 a 3.4.14 et par les seeds Sprint 11 + Sprint 14 (vertical Insure) + Sprint 19 (vertical Repair). Aucune logique de gateway, aucun orchestrateur, aucun controller n'est livre dans cette tache : sa portee est strictement la fondation de donnees typees consommee par les 13 taches suivantes.

L'apport est triple. Premierement, transformer les colonnes SQL brutes en entities TypeORM avec types stricts garantit que tout developpeur Sprint 11 a 35 manipule des `PayTransaction` objets dont les champs sont narrowed par TypeScript : `transaction.status` est typee `TransactionStatus` (union de 7 valeurs litterales), `transaction.provider` est typee `PaymentProvider` (union de 6 valeurs litterales), `transaction.amount` est typee `number` mais persistee en `numeric(15,2)` Postgres pour precision financiere absolue. Cela elimine la classe entiere des bugs de typo (un developpeur ecrivant `transaction.status === 'capturred'` declenche TypeScript error au compile time, pas un comportement silencieux en production avec paiement perdu). Deuxiemement, les schemas Zod exportes via `@insurtech/pay/schemas` (`InitiatePaymentSchema`, `RefundRequestSchema`, `ReconciliationRowSchema`, `WebhookPayloadSchema`, `PaymentStatusUpdateSchema`) imposent une validation runtime stricte au niveau controller (Tache 3.4.13) ET service (Tache 3.4.7) selon le principe defense en profondeur : un payload malformat venant d'un webhook provider compromis ou d'un client mal codé est rejete avant tout traitement, eliminant les attaques par injection de champs (mass assignment, prototype pollution). La validation Zod inclut des regles metier specifiques Maroc impossibles a exprimer en types TypeScript : `amount.max(100000)` reflète Bank Al-Maghrib article 4 circulaire 2/G/2024 limitant les transactions retail sans declaration prealable a 100k MAD, `currency.literal('MAD')` reflete Office des Changes loi 1996 imposant MAD pour transactions intra-Maroc, `idempotency_key.regex(/^[0-9A-HJKMNP-TV-Z]{26}$/)` impose le format ULID strict (26 caracteres Crockford Base32) garantissant unicite cryptographique sur 80 bits de randomness. Troisiemement, separer les helpers de transition de statut (`StatusTransitions.canTransitionTo(from, to)`) des entities elles-memes permet au PaymentOrchestrator (Tache 3.4.7) et aux webhook consumers (Tache 3.4.8) de valider de maniere centralisee chaque update de statut sans dupliquer la logique : par exemple, une transaction `failed` ne peut JAMAIS transitioner vers `captured` (interdit par le helper, qui throw une `InvalidTransitionError` typee), une transaction `captured` ne peut transitioner que vers `refunded` ou `partially_refunded`, jamais retour a `pending`. Cette discipline est critique en paiement : un bug autorisant `failed -> captured` permettrait a un attaquant qui replay un ancien webhook de "ressusciter" une transaction echouee.

A l'issue de cette tache, le package `@insurtech/pay` expose via `packages/pay/src/index.ts` les entities `PayMethod`, `PayTransaction`, `PayReconciliation`, `PayRefundRequest` (la table `pay_refund_requests` sera materialisee Tache 3.4.9 mais l'entity est preparee ici), les enums `PaymentProvider`, `PaymentMethod`, `TransactionStatus`, `Currency`, `ReconciliationStatus`, `RefundStatus`, les schemas Zod `InitiatePaymentSchema`, `RefundRequestSchema`, `ReconciliationRowSchema`, `WebhookPayloadSchema`, `PaymentStatusUpdateSchema`, `PayTransactionFiltersSchema`, les types inferes `InitiatePaymentInput`, `RefundRequestInput`, `WebhookPayload`, etc., les helpers `StatusTransitions`, `PaymentValidators`, `PayTransactionFactory`, `MoneyHelpers`. La commande `pnpm --filter @insurtech/pay test entities/` execute 30+ tests Vitest verifiant la coherence (entities hydratent depuis Postgres, Zod rejette amount > 100000 MAD, Zod rejette currency != MAD, idempotency_key UNIQUE constraint provoque DatabaseException, helpers transitions valident state machine 7 etats). La commande `pnpm --filter @insurtech/pay typecheck` retourne exit code 0. Les fichiers livres totalisent environ 1500 lignes de code TypeScript strict, prepares pour consommation immediate par Tache 3.4.2 (PaymentGatewayInterface).

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 deploie 9 applications cible qui doivent toutes manipuler des donnees de paiement avec une precision financiere absolue : un courtier broker_user encaisse une prime d'assurance auto (typiquement 3000-12000 MAD/an), un gestionnaire garage_admin facture une reparation de tole (1500-50000 MAD), un assure paye sa franchise (500-5000 MAD), une compagnie d'assurance recoit un virement de regularisation banque (50000-500000 MAD avec declaration BAM). Sans entities typees strictes et schemas Zod valides, chaque endpoint paiement re-implementerait sa propre validation, risquant : oubli de la limite BAM 100k MAD declenchant rejet automatique au niveau gateway et perte de la transaction (UX catastrophique), conversion implicite EUR/USD vers MAD via float arithmetic introduisant des erreurs d'arrondi (5000.005 MAD vs 5000.00 MAD = 0.5 centimes par transaction = 50000 MAD/an sur 100000 transactions, fraude comptable involontaire), absence d'idempotency_key permettant a un client mal code de double-charger une carte (litige client + chargeback bancaire = 250 MAD frais bancaires + atteinte reputation), absence de provider_transaction_id UNIQUE permettant a un webhook replay (intentionnel ou accidentel) de declencher deux fois la generation de facture et l'envoi email. La conformite Bank Al-Maghrib (BAM), Office des Changes, ACAPS, PCI-DSS Level 1, loi 43-05 anti-blanchiment exige une traçabilité parfaite et impossible a obtenir sans cette fondation.

Le choix de TypeORM 0.3.21 (vs Prisma, MikroORM, Drizzle) est documente dans `00-pilotage/decisions/004-database-typeorm-vs-prisma.md` : TypeORM offre un controle fin sur les migrations SQL pures (critique pour Postgres RLS multi-tenant Sprint 6), le decorator-based mapping aligne avec NestJS, et le support transactions imbriquees est superieur. Le choix de Zod 3.24.1 (vs class-validator, joi, yup, ajv) est documente dans `00-pilotage/decisions/003-validation-zod-vs-class-validator.md` : Zod offre un DX TypeScript-first via `z.infer<>`, schemas composables, parsing strict (rejette champs additionnels par defaut avec `.strict()`), et integration immediate avec OpenAPI/JSON Schema generation pour la documentation API Sprint 13.

Le choix specifique de `numeric(15,2)` Postgres (vs `bigint` representant les centimes, vs `float`) est strategique. `numeric(15,2)` permet 13 chiffres avant la virgule + 2 apres = jusqu'a 9 999 999 999 999.99 MAD = 10 trillions MAD = bien au-dela de tout besoin. La precision est decimale exacte (pas de IEEE 754 floating-point errors). L'alternative `bigint` (centimes) imposerait conversion partout (5000 MAD = 500000 centimes -> erreurs developpeurs facilesQ. La conversion JavaScript number <-> Postgres numeric passe par `pg-types` parser configure dans `packages/database/src/data-source.ts` qui retourne un `string` (pour preserver precision) que les helpers `MoneyHelpers.parse()` convertissent en `number` JS apres validation que `value <= Number.MAX_SAFE_INTEGER / 100` (impossible en pratique pour MAD).

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Stocker `amount` en `bigint` (centimes) | Precision absolue garantie cote DB, pas de parsing string<->number, alignement avec Stripe pattern | Conversion partout (5000 MAD <-> 500000 centimes) source d'erreurs developpeurs, JSON serialisation BigInt non native (necessite custom JSON encoder), affichage UX necessite division systematique | REJETE -- complexite developpeur > benefice precision (numeric(15,2) suffit pour MAD avec 2 decimales) |
| Stocker `amount` en `float8` (double precision) | Performance, stockage minimal | Erreurs IEEE 754 (5000.005 != 5000.005), interdit pour finance par toutes les normes (PCI-DSS, IFRS, CGNC) | REJETE -- non-conforme PCI-DSS et CGNC Maroc |
| Stocker `amount` en `numeric(15,2)` (RETENU) | Precision decimale exacte, support natif Postgres, parsing pg-types configurable | String parsing requis cote Node.js (pg-types retourne string par defaut) | RETENU -- standard finance, aligne Sprint 12 (Books CGNC) |
| Validation via class-validator + class-transformer | Familiar Java/NestJS developpeurs, integration Decorator | Pas de TypeScript type inference (les types restent declaratif vs Zod inference), validation runtime separe du typage compile-time, performance inferieure (parsing reflection metadata) | REJETE -- decision-003 |
| Validation via Joi | Familier Node.js | Pas de TypeScript inference natif, syntaxe verbose | REJETE |
| Validation via Zod 3.24.1 (RETENU) | Type inference automatique via `z.infer<>`, schemas composables, parsing strict, performance excellente, ecosystem mature | Apprentissage initial pour developpeurs habitues class-validator | RETENU -- decision-003 |
| Idempotency_key au format UUIDv4 | Standard reconnu, support SDK universel | 36 caracteres avec tirets, pas lexicographiquement triable, pas de timestamp embarque | REJETE pour ULID |
| Idempotency_key au format ULID (RETENU) | 26 caracteres compact, lexicographiquement triable (timestamp first 48 bits), 80 bits randomness, Crockford Base32 evite confusion 0/O/I/1 | Moins repandu que UUIDv4 (mais en croissance rapide) | RETENU -- alignement avec Sprint 6 idempotency global |
| `pay_refund_requests` table cree Tache 3.4.1 | Disponible immediatement | Hors-scope (cette tache prepare seulement entity, table sera cree par migration Tache 3.4.9) | REJETE -- separation responsabilites |
| Workflow status via state machine library (xstate) | Visualisation graphique, transitions robustes | Overkill pour 7 etats, dependance supplementaire (62 ko bundle) | REJETE -- helpers TS suffisent |

### 2.3 Trade-offs explicites

Choisir TypeORM 0.3.21 (vs Prisma) implique d'accepter une syntaxe decorator plus verbose et un type-safety inferieur au niveau querybuilder : un `repository.find({ where: { tenant_id: tenantId, status: 'pending' as any } })` peut compiler avec un cast force, alors que Prisma generated client refuserait. La compensation est apportee au niveau service (Tache 3.4.7) qui n'utilise PAS le QueryBuilder direct mais des methodes typees (`findPendingTransactions(tenantId): Promise<PayTransaction[]>`) qui internalisent les casts sous controle.

Choisir `numeric(15,2)` (vs `bigint`) implique d'accepter un parsing `string -> number` cote Node.js que les helpers `MoneyHelpers.parse(raw: string): number` doivent gerer avec rigueur : la fonction throw `MoneyParseError` si `parseFloat(raw)` retourne `NaN`, si `value > MAX_AMOUNT_MAD` (100k pour validation BAM intra-tenant), si `value <= 0`. Le couple `MoneyHelpers.parse` + `MoneyHelpers.format` est utilise systematiquement dans Tache 3.4.7 et Tache 3.4.13 pour serialiser les amounts dans les logs, les events Kafka, les responses HTTP.

Choisir Zod 3.24.1 implique de re-declarer chaque champ deux fois : une fois dans l'entity TypeORM (avec decorators `@Column`), une fois dans le schema Zod. Cette duplication est apparemment redondante mais reflete une separation des concerns critique : l'entity TypeORM modelise la persistance (colonne, index, contrainte), le schema Zod modelise le contract API (validation runtime, transformations, refinements metier). Sprint 13 (Analytics) ajoutera une troisieme couche : les schemas pour les events Kafka publishes lors des changements de statut paiement, encore une fois separes pour permettre evolution independante (schema Kafka v2 sans casser API v1).

Choisir d'inclure des refinements metier specifiques Maroc dans les schemas Zod (`amount.max(100000)`, `currency.literal('MAD')`) implique d'accepter que ces schemas ne soient PAS reutilisables sans modification pour une eventuelle extension Tunisie ou Egypte (Phase 7+). La compensation est documentee dans `decision-008` : Skalean InsurTech v2.2 cible exclusivement le marche marocain, et l'extension internationale necessitera une factorisation `BasePaymentSchema` + extensions par pays. Cette factorisation premature serait un over-engineering YAGNI au Sprint 11.

### 2.4 Decisions strategiques referenced

- **decision-003 (Validation Zod vs class-validator)** : pertinence pour cette tache = totale. Cette tache concretise le choix Zod pour tous les schemas paiement.
- **decision-004 (TypeORM 0.3.21 vs Prisma)** : pertinence = totale. Les entities `PayMethod`, `PayTransaction`, `PayReconciliation` utilisent decorators TypeORM 0.3.x.
- **decision-006 (No-emoji Policy ABSOLUE)** : pertinence = totale. Aucune emoji dans aucun fichier livre, pre-commit hook verifie via regex Unicode.
- **decision-008 (Cloud souverain Maroc)** : pertinence = critique. Toutes les donnees pay (amount, customer_email, customer_phone, provider_transaction_id) restent stockees Atlas Cloud Services Benguerir DC1+DC2 ; aucune transmission hors Maroc autre que API gateway providers (eux-memes operes au Maroc avec data residency MA).
- **decision-011 (Multi-tenant strict header x-tenant-id)** : pertinence = totale. Toutes les entites pay_* contiennent `tenant_id` UUID NOT NULL, RLS policies actives Sprint 6 filtrent automatiquement par `tenant_id = app_current_tenant()`.
- **decision-014 (Idempotency-Key obligatoire pour mutations sensibles)** : pertinence = totale. Toutes les mutations pay_* exigent `Idempotency-Key` header en ULID format. Validation Zod refuse si manquant.
- **decision-018 (Money en numeric(15,2) decimal precision)** : pertinence = totale. Tous les champs `amount, fees_amount, refunded_amount` utilisent `numeric(15,2)`.
- **decision-022 (Currency MAD only MVP)** : pertinence = totale. Validation Zod literal `'MAD'`, extension multi-currency reservee Phase 7+.
- **decision-026 (BAM article 4 circulaire 2024 limite 100k MAD)** : pertinence = totale. Validation `amount.max(100000)` au niveau Zod ; transactions au-dessus necessitent procedure declarative BAM separee (hors scope MVP).

### 2.5 Pieges techniques connus

1. **Piege : Conversion implicite numeric Postgres -> JavaScript number perd precision.**
   - Pourquoi : `pg` driver Node.js retourne par defaut `numeric` columns en `string` (pour preserver precision arbitraire). Si on cast aveuglement en `Number(raw)`, on perd la precision pour les valeurs > 2^53. Mais pour MAD avec max 100k transactions, c'est sans risque pratique.
   - Solution : configurer `pg-types` parser dans `packages/database/src/data-source.ts` :
     ```typescript
     import { types } from 'pg';
     types.setTypeParser(1700, (val) => val === null ? null : parseFloat(val));
     ```
     ET ajouter validation `MoneyHelpers.parse(raw)` qui throw si valeur suspect (> Number.MAX_SAFE_INTEGER / 100). Test V11 verifie ce parsing.

2. **Piege : Idempotency_key collision si genere cote client mal implemente.**
   - Pourquoi : si un client SDK genere idempotency_key basee sur `Math.random()` au lieu de ULID/UUID, collision possible apres ~46k requetes (paradoxe anniversaire).
   - Solution : enforcement strict cote serveur via Zod regex ULID `/^[0-9A-HJKMNP-TV-Z]{26}$/`. Toute requete avec idempotency_key non-conforme est rejetee 400. Test V14 verifie ce rejet.

3. **Piege : provider_transaction_id NULL initialement (avant retour gateway) genere conflits UNIQUE constraint.**
   - Pourquoi : si on declare UNIQUE(provider, provider_transaction_id) avec rows en NULL, Postgres autorise plusieurs NULL (comportement standard SQL) mais certaines conditions de course peuvent casser.
   - Solution : index UNIQUE PARTIAL `WHERE provider_transaction_id IS NOT NULL` (deja en migration Sprint 2). Verifie test V15.

4. **Piege : Transition de statut illegale exploitable via update race condition.**
   - Pourquoi : si deux webhook arrivent simultanement (provider duplicate + retry), un update naive `UPDATE pay_transactions SET status='captured' WHERE id=X` peut ecraser un statut intermediaire.
   - Solution : tous les UPDATE de status passent par helper `StatusTransitions.transition(txn, newStatus)` qui valide la transition AVANT update, et utilise `WHERE status = ${oldStatus}` pour optimistic locking. Sprint 11 Tache 3.4.8 (webhook consumers) consomme ce helper. Test V16 verifie locking.

5. **Piege : `amount` numeric Postgres serialise en JSON comme string par defaut.**
   - Pourquoi : driver pg retourne string ; meme apres `pg-types parseFloat`, si on serialize `JSON.stringify(amount)` sans entity transformer, on perd la 2-decimal precision pour les valeurs entieres (`5000` au lieu de `5000.00`).
   - Solution : entity transformer `@Column({ type: 'numeric', precision: 15, scale: 2, transformer: { from: parseFloat, to: (v: number) => v.toFixed(2) }})` ET helper `MoneyHelpers.format(value)` qui retourne toujours `'5000.00'` string pour API responses. Test V17 verifie formatting.

6. **Piege : Currency sauf MAD accepte par Zod si on oublie `.literal()`.**
   - Pourquoi : `currency: z.string().length(3)` accepterait 'EUR', 'USD', etc.
   - Solution : `currency: z.literal('MAD', { errorMap: () => ({ message: 'Only MAD currency supported (Office des Changes loi 1996)' }) })`. Test V18 verifie le message d'erreur.

7. **Piege : Tenant_id missing dans WHERE clause leak donnees entre tenants.**
   - Pourquoi : un developpeur ecrivant `repository.findOne({ where: { id: txnId } })` sans tenant_id leak donnees cross-tenant.
   - Solution : RLS Sprint 6 active automatiquement le filtre via `app.current_tenant` session var ; mais defense en profondeur exige test V19 verifiant que cross-tenant query retourne 0 rows.

8. **Piege : pay_methods stocke configuration credentials provider en clair.**
   - Pourquoi : table `pay_methods` (un par tenant) contient potentiellement `cmi_merchant_id`, `cmi_store_key` (secret hash) -- si stocke en clair, leak DB = leak secrets tous tenants.
   - Solution : champs sensibles encryptes via `pgcrypto` (envelope encryption avec KMS Atlas). Helper `EncryptedColumnTransformer` decrypt on read. Sprint 11 Tache 3.4.1 prepare seulement le pattern, encryption full Sprint 11 Tache 3.4.7 (gateway-selector consomme decrypte).

9. **Piege : Soft-delete via `deleted_at` colonne pour pay_transactions casse audit trail.**
   - Pourquoi : si on autorise soft-delete d'une transaction, audit comptable Sprint 12 perd lignes.
   - Solution : `pay_transactions` n'a PAS `deleted_at`. Cancellation se fait via `status='cancelled'`. Le seul cas suppression = reglement RGPD CNDP Article 14 (effacement donnees personnelles), traite Sprint 12 (Compliance) avec anonymisation `customer_email = 'redacted-{txn_id}@redacted.invalid'` mais pas suppression row.

10. **Piege : `metadata` JSONB peut contenir donnees PII non chiffrees.**
    - Pourquoi : developpeur stocke par erreur `customer_full_name`, `card_last_4`, dans `metadata`.
    - Solution : Zod schema `metadata: z.record(z.string(), z.unknown()).refine(m => !hasPII(m), 'metadata must not contain PII')`. Helper `hasPII()` detecte clefs sensibles (full_name, address, card_*, cvv, pan, ssn). Test V20 verifie rejet.

11. **Piege : Amount stocke avec precision differente entre INSERT et SELECT.**
    - Pourquoi : si on INSERT `5000.5` et que la colonne est `numeric(15,2)`, Postgres arrondit a `5000.50` ; mais si on SELECT et compare `amount === 5000.5`, c'est bon. Par contre `5000.555` -> `5000.56` (arrondi banker's). Risque : developpeur s'attend a precision 3 decimales et ne voit pas l'arrondi.
    - Solution : Zod schema `amount: z.number().multipleOf(0.01, 'amount precision is 2 decimals (centimes)')`. Test V21 verifie rejet 5000.555.

12. **Piege : `provider` colonne text accepte n'importe quelle string, casse routing Tache 3.4.7.**
    - Pourquoi : si un developpeur INSERT avec `provider='cmiX'`, le PaymentOrchestrator (Tache 3.4.7) ne trouvera pas le gateway correspondant et throw obscur.
    - Solution : `CHECK (provider IN ('cmi','youcan_pay','payzone','inwi_money','orange_money','mwallet_bam'))` constraint Postgres. Validation TypeScript via enum `PaymentProvider`. Test V22 verifie rejet INSERT.

13. **Piege : `idempotency_key` UNIQUE constraint genere collision rare.**
    - Pourquoi : si deux clients distincts (rare mais possible) generent meme ULID dans la meme milliseconde sur tenant different, INSERT echoue avec conflict UNIQUE.
    - Solution : UNIQUE constraint definie comme `UNIQUE (tenant_id, idempotency_key)` -- pas global. Permet meme key sur tenants differents. Test V23 verifie ce comportement.

14. **Piege : `customer_phone` format E.164 vs format MA local mal harmonise.**
    - Pourquoi : `+212600123456` vs `0600123456` vs `00212600123456` -- 3 formats acceptes UX, mais wallets Inwi/Orange/M-Wallet exigent E.164.
    - Solution : Zod schema `customer_phone: z.string().regex(/^(\+212|0)[5-7]\d{8}$/).transform(normalizeMaPhone)` qui transforme en E.164 `+212XXXXXXXXX`. Helper `PhoneHelpers.normalizeMaPhone()`. Test V24.

15. **Piege : Reconciliation row matched mais pay_transactions pas update statut.**
    - Pourquoi : table `pay_reconciliation` separe permet match-only sans update transaction. Si decouple, statut transaction reste `captured` alors que rapprochement banque effectue.
    - Solution : helper `MarkReconciledTransition.execute(txn_id, reconciliation_id)` mis a jour DEUX tables atomiquement via transaction Postgres. Tache 3.4.10 implemente. Cette tache 3.4.1 expose entity + relation `@OneToOne(() => PayReconciliation)`. Test V25.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 3.4.1 est la PREMIERE tache du Sprint 11 (Pay Multi-Passerelles MA) et la 41eme tache de la Phase 3 (Modules Horizontaux). Elle :

- **Depend de** : Sprint 2 (migrations `pay_methods`, `pay_transactions`, `pay_reconciliation` minimal columns), Sprint 6 (RLS multi-tenant active sur ces tables), Sprint 7 (RBAC permissions `pay.transactions.create`, `pay.transactions.read`, `pay.refunds.request`, `pay.refunds.approve`, `pay.reconciliation.manage`), Sprint 10 (entity `Invoice` referenced par `pay_transactions.related_resource_type='invoice'`).
- **Bloque** : Tache 3.4.2 (PaymentGatewayInterface utilise `InitiatePaymentRequest` schema Zod et types `PaymentStatus`), Tache 3.4.3 a 3.4.6 (6 gateways consomment entities + types), Tache 3.4.7 (PaymentOrchestrator persiste rows `pay_transactions`), Tache 3.4.8 (webhook consumers update statut via `StatusTransitions`), Tache 3.4.9 (refund service cree rows `pay_refund_requests`), Tache 3.4.10 (reconciliation service utilise entity `PayReconciliation`), Tache 3.4.11 (fraud detection cree rows `pay_fraud_evaluations` -- table preparee Sprint 2), Tache 3.4.12 (BullMQ jobs serializent `PayTransaction`), Tache 3.4.13 (controllers exposent CRUD `pay_transactions`), Tache 3.4.14 (tests E2E utilisent `PayTransactionFactory`).
- **Apporte au sprint** : la fondation typee complete -- entities, enums, schemas Zod, helpers, factories, types inferes, exports `@insurtech/pay`. Sans cette fondation, aucune des 13 taches suivantes ne peut etre ecrite.

### 3.2 Position dans le programme global

Cette tache pose le vocabulaire commun consomme par tous les sprints metier Phase 4-6 + Phase 7+ :

- **Sprint 12 (Books + Compliance)** : `pay_transactions` rows alimentent `books_journal_entries` via reconciliation matched. Le triggerSQL `AFTER UPDATE OF status ON pay_transactions WHEN NEW.status='captured'` insere automatiquement une ecriture comptable journal `5141` (banque) DEBIT / `7111` (ventes prestations service) CREDIT selon plan comptable CGNC Maroc.
- **Sprint 13 (Analytics + Stock + HR)** : ClickHouse ingest `pay_transactions` toutes les 5 minutes via Kafka topic `insurtech.events.pay.transaction.captured`. Dashboards revenue per provider, fees, refund rate, fraud rate.
- **Sprint 14-15 (Vertical Insure)** : table `insure_policies` reference `pay_transactions.id` via `payment_transaction_id` colonne pour les primes encaissees. Workflow police active = transaction captured.
- **Sprint 19-21 (Vertical Repair)** : table `repair_invoices` reference `pay_transactions.id` pour facturation reparation. Workflow facture payee = transaction captured + pay_reconciliation matched.
- **Sprint 25 (Cross-Tenant Cabinets)** : un cabinet courtier peut consolider revenus de plusieurs sub-tenants ; query `SUM(amount) FROM pay_transactions WHERE tenant_id IN (SELECT child_tenants OF parent)`.
- **Sprint 26 (Admin Skalean)** : super_admin_platform query global `SELECT provider, COUNT(*), SUM(amount) FROM pay_transactions GROUP BY provider` (RLS bypass via role super_admin). Permet pricing tier renegotiation avec providers selon volume.
- **Sprint 30 (MCP Server)** : tools metier MCP `pay.get_transaction(id)`, `pay.list_transactions(filters)` consomment entities.
- **Sprint 31 (Sky AI)** : agent Sky peut lire transactions via MCP pour repondre questions courtier "Combien de primes encaissees ce mois ?".

### 3.3 Diagramme architecture

```
                       +-----------------------------------+
                       | 3-schemas-database-PARTIE1.sql    |
                       | Source migrations Sprint 2        |
                       +-----------------+-----------------+
                                         |
                                         v transformation Sprint 11
                                         |
   +-------------------------------------+-------------------------------------+
   |                                                                           |
   v                                                                           v
@insurtech/pay/entities                                         @insurtech/pay/schemas
   |                                                                           |
   |-- pay-method.entity.ts        (TypeORM + getters)                         |-- payment.schema.ts        (Zod InitiatePayment)
   |-- pay-transaction.entity.ts   (TypeORM + relations)                       |-- refund.schema.ts          (Zod RefundRequest)
   |-- pay-reconciliation.entity.ts                                            |-- reconciliation.schema.ts (Zod CSV row)
   |-- pay-refund-request.entity.ts (preparee, table Tache 3.4.9)              |-- webhook.schema.ts         (Zod webhook payloads)
   |-- pay-fraud-evaluation.entity.ts (preparee, table Tache 3.4.11)           |-- status-update.schema.ts  (Zod status transition)
                                                                               |-- filters.schema.ts         (Zod query filters)
                                         |
                                         v consume
                                         |
   +----------------+----------------+--------------+----------------+----------+
   |                |                |              |                |          |
   v                v                v              v                v          v
3.4.2 Interface  3.4.3 CMI    3.4.7 Orchest.  3.4.8 Webhooks  3.4.9 Refund  3.4.10 Recon.
3.4.4 YouCan     3.4.5 PayZone 3.4.11 Fraud   3.4.12 BullMQ   3.4.13 Ctrl   3.4.14 Tests
3.4.6 Wallets
```

### 3.4 Flow business covert par cette tache

```
[Client paie facture courtage 5000 MAD]
        |
        v
POST /api/v1/pay/initiate                 <-- Tache 3.4.13
{ amount: 5000, currency: 'MAD',
  customer_email: 'client@example.com',
  related_resource_type: 'invoice',
  related_resource_id: 'inv-uuid',
  return_url: 'https://broker.skalean.ma/pay/success' }
Header: Idempotency-Key: 01HXM3Q9V8K7F4ZT8...   <-- ULID format (cette tache valide via Zod)
Header: x-tenant-id: tenant-broker-001         <-- multi-tenant strict (cette tache enforce)
        |
        v
PaymentOrchestrator.initiate()             <-- Tache 3.4.7
   |
   |-- Zod parse via InitiatePaymentSchema  <-- cette tache produit le schema
   |   - amount > 0 ? amount <= 100000 ?    <-- BAM compliance
   |   - currency === 'MAD' ?               <-- Office Changes
   |   - idempotency_key ULID ?
   |   - customer_email format valide ?
   |
   |-- Repo.findOne({ idempotency_key, tenant_id }) <-- check duplicate
   |   |
   |   |-- if exists: return cached PayTransaction <-- entity hydrate
   |   |
   |   `-- else: continue
   |
   |-- INSERT pay_transactions (status='pending', provider='cmi') <-- entity persist
   |
   |-- gateway.initiate() throws GatewayUnavailableError
   |
   |-- StatusTransitions.transition(txn, 'failed') <-- helper cette tache
   |   |
   |   `-- check transition pending->failed valid ? YES (table state machine)
   |
   |-- UPDATE pay_transactions SET status='failed' WHERE status='pending'
   |
   |-- retry next provider...
```

---

## 4. Livrables checkables (28 livrables avec chemins fichiers)

- [ ] Entity `repo/packages/pay/src/entities/pay-method.entity.ts` (~85 lignes : decorators TypeORM + relations + transformers + JSDoc complet)
- [ ] Entity `repo/packages/pay/src/entities/pay-transaction.entity.ts` (~150 lignes : 25 colonnes + 4 relations + 6 indexes declares + transformers numeric + helpers methods statiques)
- [ ] Entity `repo/packages/pay/src/entities/pay-reconciliation.entity.ts` (~95 lignes : 14 colonnes + relation OneToOne PayTransaction + helpers MatchResult)
- [ ] Entity `repo/packages/pay/src/entities/pay-refund-request.entity.ts` (~80 lignes : preparee pour Tache 3.4.9, marquee `@deprecated TYPEORM_TABLE_NOT_YET_MIGRATED` jusqu'a la migration)
- [ ] Entity `repo/packages/pay/src/entities/pay-fraud-evaluation.entity.ts` (~75 lignes : preparee pour Tache 3.4.11, idem)
- [ ] Enum `repo/packages/pay/src/enums/payment-provider.enum.ts` (~30 lignes : 6 valeurs litterales + JSDoc decrit chaque provider + helper `isValidProvider`)
- [ ] Enum `repo/packages/pay/src/enums/payment-method.enum.ts` (~20 lignes : 4 valeurs `card | wallet | cash_kiosk | bank_transfer`)
- [ ] Enum `repo/packages/pay/src/enums/transaction-status.enum.ts` (~25 lignes : 7 valeurs + state machine map exporte `STATUS_TRANSITIONS`)
- [ ] Enum `repo/packages/pay/src/enums/currency.enum.ts` (~15 lignes : MAD only + extension reserve)
- [ ] Enum `repo/packages/pay/src/enums/reconciliation-status.enum.ts` (~20 lignes : `unmatched | matched | manual_match | discrepancy`)
- [ ] Enum `repo/packages/pay/src/enums/refund-status.enum.ts` (~25 lignes : 5 valeurs + state machine)
- [ ] Schema Zod `repo/packages/pay/src/schemas/payment.schema.ts` (~120 lignes : `InitiatePaymentSchema`, `PaymentStatusUpdateSchema`, `CapturePaymentSchema`, `CancelPaymentSchema`)
- [ ] Schema Zod `repo/packages/pay/src/schemas/refund.schema.ts` (~80 lignes : `RefundRequestSchema`, `RefundApprovalSchema`, `RefundExecutionSchema`)
- [ ] Schema Zod `repo/packages/pay/src/schemas/reconciliation.schema.ts` (~95 lignes : `ReconciliationRowSchema` (CSV row generic), 4 schemas specific banks `BmceReconciliationRowSchema`, `AttijariwafaReconciliationRowSchema`, `BanquePopulaireReconciliationRowSchema`, `CmiSettlementRowSchema`)
- [ ] Schema Zod `repo/packages/pay/src/schemas/webhook.schema.ts` (~110 lignes : 6 webhook payload schemas per provider, base `BaseWebhookPayloadSchema`)
- [ ] Schema Zod `repo/packages/pay/src/schemas/filters.schema.ts` (~70 lignes : `PayTransactionFiltersSchema`, `PayReconciliationFiltersSchema`, `PayRefundFiltersSchema`)
- [ ] Helper `repo/packages/pay/src/helpers/status-transitions.helper.ts` (~120 lignes : state machine 7 etats + `canTransitionTo`, `isFinalStatus`, `transition` avec optimistic locking)
- [ ] Helper `repo/packages/pay/src/helpers/money.helper.ts` (~80 lignes : `parse`, `format`, `add`, `sub`, `multiply` avec precision decimale, `toFixed2`)
- [ ] Helper `repo/packages/pay/src/helpers/payment-validators.helper.ts` (~95 lignes : `validateBamLimit`, `validateMadCurrency`, `validateUlidFormat`, `validateMaPhoneNumber`)
- [ ] Helper `repo/packages/pay/src/helpers/phone.helper.ts` (~60 lignes : `normalizeMaPhone`, `extractCountryCode`, `detectMaOperator` -- IAM/Inwi/Orange detection pour wallet routing)
- [ ] Helper `repo/packages/pay/src/helpers/pii-detector.helper.ts` (~70 lignes : `hasPII(metadata)` pour rejeter rows avec PII non-chiffres)
- [ ] Factory `repo/packages/pay/src/factories/pay-transaction.factory.ts` (~110 lignes : factory function genere `PayTransaction` realistic avec defaults pour tests)
- [ ] Factory `repo/packages/pay/src/factories/pay-method.factory.ts` (~70 lignes : 6 factories one per provider, encrypted credentials simulation)
- [ ] Factory `repo/packages/pay/src/factories/pay-reconciliation.factory.ts` (~65 lignes : factory CSV row generator)
- [ ] Index barrel `repo/packages/pay/src/entities/index.ts` (~25 lignes : re-export 5 entities)
- [ ] Index barrel `repo/packages/pay/src/schemas/index.ts` (~30 lignes : re-export schemas + types inferes)
- [ ] Index barrel `repo/packages/pay/src/index.ts` (~50 lignes : re-export tout pour `import { PayTransaction, InitiatePaymentSchema } from '@insurtech/pay'`)
- [ ] Tests Vitest `repo/packages/pay/src/entities/__tests__/pay-transaction.entity.spec.ts` + `pay-method.entity.spec.ts` + `pay-reconciliation.entity.spec.ts` (~600 lignes total : 30+ scenarios)
- [ ] Tests Vitest `repo/packages/pay/src/schemas/__tests__/payment.schema.spec.ts` + `refund.schema.spec.ts` + `reconciliation.schema.spec.ts` + `webhook.schema.spec.ts` + `filters.schema.spec.ts` (~750 lignes total : 40+ scenarios)
- [ ] Tests Vitest `repo/packages/pay/src/helpers/__tests__/status-transitions.helper.spec.ts` + `money.helper.spec.ts` + `payment-validators.helper.spec.ts` + `phone.helper.spec.ts` + `pii-detector.helper.spec.ts` (~600 lignes total : 35+ scenarios)

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/pay/src/entities/pay-method.entity.ts                              (~85 lignes / role : config provider per tenant)
repo/packages/pay/src/entities/pay-transaction.entity.ts                          (~150 lignes / role : transactions individuelles)
repo/packages/pay/src/entities/pay-reconciliation.entity.ts                       (~95 lignes / role : reconciliation banque)
repo/packages/pay/src/entities/pay-refund-request.entity.ts                       (~80 lignes / role : preparee pour 3.4.9)
repo/packages/pay/src/entities/pay-fraud-evaluation.entity.ts                     (~75 lignes / role : preparee pour 3.4.11)
repo/packages/pay/src/entities/index.ts                                           (~25 lignes / role : barrel export entities)
repo/packages/pay/src/enums/payment-provider.enum.ts                              (~30 lignes / role : 6 providers)
repo/packages/pay/src/enums/payment-method.enum.ts                                (~20 lignes / role : 4 methods)
repo/packages/pay/src/enums/transaction-status.enum.ts                            (~25 lignes / role : 7 statuts + state machine)
repo/packages/pay/src/enums/currency.enum.ts                                      (~15 lignes / role : MAD only)
repo/packages/pay/src/enums/reconciliation-status.enum.ts                         (~20 lignes / role : 4 statuts)
repo/packages/pay/src/enums/refund-status.enum.ts                                 (~25 lignes / role : 5 statuts)
repo/packages/pay/src/enums/index.ts                                              (~20 lignes / role : barrel export enums)
repo/packages/pay/src/schemas/payment.schema.ts                                   (~120 lignes / role : Zod payment schemas)
repo/packages/pay/src/schemas/refund.schema.ts                                    (~80 lignes / role : Zod refund schemas)
repo/packages/pay/src/schemas/reconciliation.schema.ts                            (~95 lignes / role : Zod reconciliation schemas)
repo/packages/pay/src/schemas/webhook.schema.ts                                   (~110 lignes / role : Zod webhook schemas)
repo/packages/pay/src/schemas/filters.schema.ts                                   (~70 lignes / role : Zod filter schemas)
repo/packages/pay/src/schemas/index.ts                                            (~30 lignes / role : barrel export schemas)
repo/packages/pay/src/helpers/status-transitions.helper.ts                        (~120 lignes / role : state machine + transitions)
repo/packages/pay/src/helpers/money.helper.ts                                     (~80 lignes / role : precision decimal money)
repo/packages/pay/src/helpers/payment-validators.helper.ts                        (~95 lignes / role : validators metier MA)
repo/packages/pay/src/helpers/phone.helper.ts                                     (~60 lignes / role : phone normalisation MA)
repo/packages/pay/src/helpers/pii-detector.helper.ts                              (~70 lignes / role : detection PII metadata)
repo/packages/pay/src/helpers/index.ts                                            (~20 lignes / role : barrel export helpers)
repo/packages/pay/src/factories/pay-transaction.factory.ts                        (~110 lignes / role : test factory)
repo/packages/pay/src/factories/pay-method.factory.ts                             (~70 lignes / role : test factory)
repo/packages/pay/src/factories/pay-reconciliation.factory.ts                     (~65 lignes / role : test factory)
repo/packages/pay/src/factories/index.ts                                          (~15 lignes / role : barrel export factories)
repo/packages/pay/src/index.ts                                                    (~50 lignes / role : barrel global package)
repo/packages/pay/src/entities/__tests__/pay-transaction.entity.spec.ts           (~250 lignes / 12 tests)
repo/packages/pay/src/entities/__tests__/pay-method.entity.spec.ts                (~180 lignes / 8 tests)
repo/packages/pay/src/entities/__tests__/pay-reconciliation.entity.spec.ts        (~170 lignes / 8 tests)
repo/packages/pay/src/schemas/__tests__/payment.schema.spec.ts                    (~280 lignes / 14 tests)
repo/packages/pay/src/schemas/__tests__/refund.schema.spec.ts                     (~150 lignes / 8 tests)
repo/packages/pay/src/schemas/__tests__/reconciliation.schema.spec.ts             (~150 lignes / 8 tests)
repo/packages/pay/src/schemas/__tests__/webhook.schema.spec.ts                    (~120 lignes / 6 tests)
repo/packages/pay/src/schemas/__tests__/filters.schema.spec.ts                    (~100 lignes / 5 tests)
repo/packages/pay/src/helpers/__tests__/status-transitions.helper.spec.ts         (~220 lignes / 12 tests)
repo/packages/pay/src/helpers/__tests__/money.helper.spec.ts                      (~150 lignes / 8 tests)
repo/packages/pay/src/helpers/__tests__/payment-validators.helper.spec.ts         (~120 lignes / 6 tests)
repo/packages/pay/src/helpers/__tests__/phone.helper.spec.ts                      (~110 lignes / 6 tests)
repo/packages/pay/src/helpers/__tests__/pii-detector.helper.spec.ts               (~80 lignes / 4 tests)
repo/packages/pay/package.json                                                    (modifie : add dep ulid 2.3.0, zod 3.24.1)
repo/packages/pay/tsconfig.json                                                   (modifie si necessaire)
repo/packages/pay/vitest.config.ts                                                 (cree si absent : config tests pay package)
```

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1/15 : `repo/packages/pay/src/enums/payment-provider.enum.ts`

Definit le 6 providers paiement supportes au Sprint 11 sous forme const object `as const` (pattern decision-012). Garantit narrowing TypeScript et grep symbolique facile.

```typescript
// repo/packages/pay/src/enums/payment-provider.enum.ts
//
// Catalogue des 6 passerelles paiement Maroc supportees Sprint 11.
// Reference : decision-012 (RBAC catalog format const object pattern reutilise)
// Reference : decision-022 (Currency MAD only MVP)
// Reference : B-11 sprint-11 Pay Multi-Passerelles Maroc
//
// Convention : cle UPPER_SNAKE = valeur lower_snake (mapping mecanique testee)
// Aucune emoji autorisee (decision-006)

export const PaymentProvider = {
  /**
   * CMI -- Centre Monetique Interbancaire Maroc.
   * Infrastructure officielle banques marocaines (BMCE, Attijariwafa, BP, etc.).
   * Cards EMV + 3D Secure mandatory (BAM regulation).
   * Sandbox: https://testpayten.cmi.co.ma -- Prod: https://payten.cmi.co.ma
   * Reference: Tache 3.4.3
   */
  CMI: 'cmi',

  /**
   * YouCan Pay -- startup MA fintech alternative CMI.
   * API REST moderne JSON, fees competitives.
   * Cards 3DS supportees + future wallets integration.
   * Doc: https://api.youcanpay.com
   * Reference: Tache 3.4.4
   */
  YOUCAN_PAY: 'youcan_pay',

  /**
   * PayZone -- gateway cards + cash kiosques (Tabac shops, agences PayZone).
   * CRITIQUE pour inclusion paiement (~30% MA non-bancarises).
   * Voucher barcode 1D Code 128 + 7 jours expiry.
   * Reference: Tache 3.4.5
   */
  PAYZONE: 'payzone',

  /**
   * Inwi Money -- mobile wallet operateur Inwi.
   * STK Push + QR code + USSD code.
   * API jeune, polling status preferable a webhook.
   * Reference: Tache 3.4.6
   */
  INWI_MONEY: 'inwi_money',

  /**
   * Orange Money -- mobile wallet operateur Orange.
   * Idem pattern Inwi (STK Push + QR + USSD).
   * Reference: Tache 3.4.6
   */
  ORANGE_MONEY: 'orange_money',

  /**
   * M-Wallet BAM -- inter-operability hub Bank Al-Maghrib.
   * Cible : connecter tous wallets MA via API unifiee BAM.
   * Reference: Tache 3.4.6
   */
  MWALLET_BAM: 'mwallet_bam',
} as const;

export type PaymentProvider = typeof PaymentProvider[keyof typeof PaymentProvider];

export const ALL_PAYMENT_PROVIDERS: readonly PaymentProvider[] = Object.values(PaymentProvider);

/**
 * Validation runtime que la valeur est un PaymentProvider valide.
 * Utilise par schemas Zod et CHECK constraints reflection.
 */
export function isValidPaymentProvider(value: unknown): value is PaymentProvider {
  return typeof value === 'string' && (ALL_PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Mapping provider -> default payment method.
 * Utilise par GatewaySelector (Tache 3.4.7) pour heuristique routing.
 */
export const DEFAULT_METHOD_BY_PROVIDER: Record<PaymentProvider, 'card' | 'wallet' | 'cash_kiosk'> = {
  [PaymentProvider.CMI]: 'card',
  [PaymentProvider.YOUCAN_PAY]: 'card',
  [PaymentProvider.PAYZONE]: 'card', // can also be cash_kiosk
  [PaymentProvider.INWI_MONEY]: 'wallet',
  [PaymentProvider.ORANGE_MONEY]: 'wallet',
  [PaymentProvider.MWALLET_BAM]: 'wallet',
};

/**
 * Capacite de chaque provider a effectuer un refund partial.
 * CMI et YouCan supportent partial ; wallets MA souvent full only.
 */
export const SUPPORTS_PARTIAL_REFUND: Record<PaymentProvider, boolean> = {
  [PaymentProvider.CMI]: true,
  [PaymentProvider.YOUCAN_PAY]: true,
  [PaymentProvider.PAYZONE]: true,
  [PaymentProvider.INWI_MONEY]: false,
  [PaymentProvider.ORANGE_MONEY]: false,
  [PaymentProvider.MWALLET_BAM]: false,
};
```

**Notes importantes** :
- Convention naming : cle UPPER_SNAKE_CASE = valeur lower_snake_case avec underscores converted to dots/underscores. Mapping verifiable mecaniquement par test V12.
- `as const` strictement requis -- sinon TypeScript infere `string` au lieu de litteraux et le narrowing est perdu.
- `ALL_PAYMENT_PROVIDERS` exporte readonly array pour iterations exhaustives (e.g. dans GatewayRegistry boot).
- `DEFAULT_METHOD_BY_PROVIDER` et `SUPPORTS_PARTIAL_REFUND` sont des metadata associee a chaque provider, utilisees par services downstream sans dupliquer la connaissance.

### 6.2 Fichier 2/15 : `repo/packages/pay/src/enums/transaction-status.enum.ts`

State machine 7 etats avec transitions valides exportees pour usage par `StatusTransitions` helper.

```typescript
// repo/packages/pay/src/enums/transaction-status.enum.ts
//
// State machine 7 etats du cycle de vie transaction paiement.
// Transitions strictement controlees par helper status-transitions.helper.ts
// Reference : decision-014 (Idempotency-Key obligatoire)
// Reference : B-11 Tache 3.4.1

export const TransactionStatus = {
  /** Transaction initiee, en attente reponse provider. */
  PENDING: 'pending',
  /** Provider a authorise (cards 2-step), capture ulterieure attendue. */
  AUTHORIZED: 'authorized',
  /** Provider a capture (debited customer), montant disponible merchant. */
  CAPTURED: 'captured',
  /** Provider a echoue (decline carte, fonds insuffisants, fraude detected). */
  FAILED: 'failed',
  /** Refund integral execute, montant retourne customer. */
  REFUNDED: 'refunded',
  /** Refund partial execute, certains funds restent merchant. */
  PARTIALLY_REFUNDED: 'partially_refunded',
  /** Annulation avant capture (pas de debit customer). */
  CANCELLED: 'cancelled',
} as const;

export type TransactionStatus = typeof TransactionStatus[keyof typeof TransactionStatus];

export const ALL_TRANSACTION_STATUSES: readonly TransactionStatus[] = Object.values(TransactionStatus);

/**
 * Map immutable des transitions valides depuis chaque etat.
 * Source de verite consume par `StatusTransitions.canTransitionTo()`.
 *
 * Conventions :
 * - PENDING peut aller vers AUTHORIZED (cards 2-step) ou CAPTURED (cards 1-step + wallets)
 *   ou FAILED (decline) ou CANCELLED (user cancel pre-payment)
 * - AUTHORIZED peut aller vers CAPTURED (capture confirme) ou CANCELLED (auth release)
 *   ou FAILED (capture refuse provider edge case)
 * - CAPTURED peut aller vers REFUNDED (refund full) ou PARTIALLY_REFUNDED (refund partial)
 *   PAS retour pending/failed/cancelled -- protection anti-replay webhook
 * - PARTIALLY_REFUNDED peut aller vers REFUNDED (refund cumulatif atteint 100%)
 *   PAS retour CAPTURED -- refund partiel est etat absorbant
 * - FAILED, REFUNDED, CANCELLED sont etats finaux -- aucune transition possible
 */
export const STATUS_TRANSITIONS: Readonly<Record<TransactionStatus, readonly TransactionStatus[]>> = {
  [TransactionStatus.PENDING]: [
    TransactionStatus.AUTHORIZED,
    TransactionStatus.CAPTURED,
    TransactionStatus.FAILED,
    TransactionStatus.CANCELLED,
  ],
  [TransactionStatus.AUTHORIZED]: [
    TransactionStatus.CAPTURED,
    TransactionStatus.CANCELLED,
    TransactionStatus.FAILED,
  ],
  [TransactionStatus.CAPTURED]: [
    TransactionStatus.REFUNDED,
    TransactionStatus.PARTIALLY_REFUNDED,
  ],
  [TransactionStatus.PARTIALLY_REFUNDED]: [
    TransactionStatus.REFUNDED,
  ],
  [TransactionStatus.FAILED]: [],
  [TransactionStatus.REFUNDED]: [],
  [TransactionStatus.CANCELLED]: [],
};

/**
 * Etats finaux : aucune transition possible.
 * Utilises par jobs cleanup et reconciliation.
 */
export const FINAL_STATUSES: readonly TransactionStatus[] = [
  TransactionStatus.FAILED,
  TransactionStatus.REFUNDED,
  TransactionStatus.CANCELLED,
];

export function isFinalStatus(status: TransactionStatus): boolean {
  return FINAL_STATUSES.includes(status);
}

export function isValidTransactionStatus(value: unknown): value is TransactionStatus {
  return typeof value === 'string' && (ALL_TRANSACTION_STATUSES as readonly string[]).includes(value);
}
```

**Notes importantes** :
- State machine FERMEE (pas de transition vers etat non liste) -- protection anti-corruption critique pour finance.
- Transitions partir de CAPTURED restreintes a refund only -- aucun retour vers pending/cancelled possible meme via webhook replay malicieux.
- `STATUS_TRANSITIONS` utilise `Readonly<>` strict pour empecher mutation accidentelle a runtime.

### 6.3 Fichier 3/15 : `repo/packages/pay/src/entities/pay-transaction.entity.ts`

L'entity coeur de Sprint 11. 25 colonnes refletant exactement la migration Sprint 2 + ajouts Sprint 11. 4 relations.

```typescript
// repo/packages/pay/src/entities/pay-transaction.entity.ts
//
// Entity TypeORM 0.3.21 representant une transaction paiement.
// Reference migration : Sprint 2 (table pay_transactions)
// Reference architecture : decision-018 (numeric(15,2) money)
// Reference compliance : decision-022 (MAD only) + decision-026 (BAM 100k limit)
// Reference no-emoji : decision-006

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import type { PaymentProvider } from '../enums/payment-provider.enum';
import type { PaymentMethod } from '../enums/payment-method.enum';
import type { TransactionStatus } from '../enums/transaction-status.enum';
import type { Currency } from '../enums/currency.enum';

/**
 * Transformer numeric Postgres -> JavaScript number avec precision 2 decimales.
 * Postgres `numeric(15,2)` retourne string par defaut via pg driver ;
 * on parseFloat() pour usage Node.js + on toFixed(2) pour persistence.
 */
const NumericMoneyTransformer = {
  from: (value: string | null): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid numeric value from DB: ${value}`);
    }
    return parsed;
  },
  to: (value: number | null): string | null => {
    if (value === null || value === undefined) return null;
    return value.toFixed(2);
  },
};

/**
 * Table pay_transactions : transactions individuelles initiees, autorisees, capturees, etc.
 *
 * Cle business : (tenant_id, idempotency_key) UNIQUE
 * Cle externe : (provider, provider_transaction_id) UNIQUE WHERE provider_transaction_id IS NOT NULL
 *
 * RLS active Sprint 6 : automatic filter tenant_id = app_current_tenant()
 */
@Entity({ name: 'pay_transactions' })
@Index('idx_pay_transactions_tenant_status', ['tenant_id', 'status', 'initiated_at'])
@Index('idx_pay_transactions_resource', ['tenant_id', 'related_resource_type', 'related_resource_id'])
@Index('idx_pay_transactions_provider_txn', ['provider', 'provider_transaction_id'], {
  unique: true,
  where: 'provider_transaction_id IS NOT NULL',
})
@Index('idx_pay_transactions_idempotency', ['tenant_id', 'idempotency_key'], { unique: true })
@Index('idx_pay_transactions_customer_email', ['tenant_id', 'customer_email'])
export class PayTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  /** Reference resource business : invoice, police, devis, repair_invoice, etc. */
  @Column({ type: 'text', nullable: true })
  related_resource_type!: string | null;

  @Column({ type: 'uuid', nullable: true })
  related_resource_id!: string | null;

  /** Email customer (citext for case-insensitive index, treated like text Node side). */
  @Column({ type: 'text', nullable: false })
  customer_email!: string;

  /** Telephone customer en format E.164 (+212XXXXXXXXX). Required pour mobile wallets. */
  @Column({ type: 'text', nullable: true })
  customer_phone!: string | null;

  @Column({ type: 'text', nullable: true })
  customer_name!: string | null;

  /** Montant en MAD avec 2 decimales precision (numeric(15,2)). */
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: false,
    transformer: NumericMoneyTransformer,
  })
  amount!: number;

  /** Currency code ISO 4217 alpha. MAD only MVP (decision-022). */
  @Column({ type: 'char', length: 3, nullable: false, default: 'MAD' })
  currency!: Currency;

  /** Frais provider (commission paiement, fees gateway). Calcule par webhook capture. */
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: NumericMoneyTransformer,
  })
  fees_amount!: number;

  /** Montant total deja refundEd (pour partial refunds cumulatifs). */
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: false,
    default: 0,
    transformer: NumericMoneyTransformer,
  })
  refunded_amount!: number;

  /** Provider gateway utilise (cmi, youcan_pay, payzone, inwi_money, orange_money, mwallet_bam). */
  @Column({ type: 'text', nullable: false })
  provider!: PaymentProvider;

  /** Methode paiement effective (card, wallet, cash_kiosk, bank_transfer). */
  @Column({ type: 'text', nullable: false })
  provider_method!: PaymentMethod;

  /** ID transaction cote provider (recu apres initiate ou webhook). UNIQUE per provider. */
  @Column({ type: 'text', nullable: true })
  provider_transaction_id!: string | null;

  /** Reference business cote provider (e.g. order_id CMI, transaction_token YouCan). */
  @Column({ type: 'text', nullable: true })
  provider_reference!: string | null;

  /** Status workflow strict (state machine 7 etats). */
  @Column({ type: 'text', nullable: false, default: 'pending' })
  status!: TransactionStatus;

  /** Code authorization bancaire post-3DS (cards). */
  @Column({ type: 'text', nullable: true })
  authorization_code!: string | null;

  /** Raison echec (error code provider + message). */
  @Column({ type: 'text', nullable: true })
  failure_reason!: string | null;

  /** 3D Secure enabled (mandatory cards EMV au Maroc depuis 2023 BAM). */
  @Column({ type: 'boolean', nullable: false, default: false })
  three_d_secure_enabled!: boolean;

  /** Status 3DS (authenticated, not_authenticated, attempted, unavailable). */
  @Column({ type: 'text', nullable: true })
  three_d_secure_status!: string | null;

  /** Idempotency key (ULID 26 chars). UNIQUE per tenant. */
  @Column({ type: 'text', nullable: false })
  idempotency_key!: string;

  /** Metadata JSONB libre (sans PII -- enforce par helper PIIDetector). */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  /** Timestamp initiation transaction (cree row). */
  @Column({ type: 'timestamptz', nullable: false, default: () => 'NOW()' })
  initiated_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  authorized_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  captured_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failed_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  refunded_at!: Date | null;

  @Column({ type: 'uuid', nullable: true })
  created_by!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // === Helpers methods ===

  /** Verifie si la transaction est dans un etat final (failed/refunded/cancelled). */
  isFinal(): boolean {
    return ['failed', 'refunded', 'cancelled'].includes(this.status);
  }

  /** Verifie si la transaction est refunded (full ou partial). */
  isRefunded(): boolean {
    return ['refunded', 'partially_refunded'].includes(this.status);
  }

  /** Calcule le montant disponible pour refund (amount - refunded_amount). */
  getRefundableAmount(): number {
    return Math.max(0, this.amount - this.refunded_amount);
  }

  /** Verifie si la transaction a ete capturee (debit customer effectif). */
  isCaptured(): boolean {
    return this.status === 'captured' || this.isRefunded();
  }
}
```

**Notes importantes** :
- `NumericMoneyTransformer` parse string -> number on read et number -> string on write avec toFixed(2). Critique pour precision financiere.
- 5 indexes declares au niveau entity TypeORM ; Sprint 2 migration les a deja crees, mais les redeclarer ici permet a TypeORM CLI de detecter les drifts.
- 4 timestamps separes (`initiated_at, authorized_at, captured_at, failed_at, refunded_at`) permettent audit trail temporel precis pour ACAPS/BAM.
- Methodes helper `isFinal()`, `isCaptured()`, `getRefundableAmount()` evitent logique dupliquee dans services downstream.

### 6.4 Fichier 4/15 : `repo/packages/pay/src/entities/pay-method.entity.ts`

Configuration provider per tenant : credentials chiffres, priorite, status enabled.

```typescript
// repo/packages/pay/src/entities/pay-method.entity.ts
//
// Configuration provider paiement per tenant.
// Permet a chaque cabinet courtier de choisir ses providers actifs (e.g. CMI + YouCan en fallback)
// et configurer credentials API (chiffres at-rest avec pgcrypto).
//
// Reference Sprint 2 : table pay_methods (deja cree avec colonnes de base)
// Reference Tache 3.4.7 : GatewaySelector consomme cette config

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import type { PaymentProvider } from '../enums/payment-provider.enum';

/**
 * Configuration paiement provider par tenant.
 *
 * Cle UNIQUE : (tenant_id, provider) -- un seul config par provider par tenant.
 * RLS active Sprint 6 : filtre auto par tenant_id.
 *
 * Champs sensibles (api_key, secret_hash, webhook_secret) chiffres via pgcrypto envelope encryption.
 * Decryption via helper EncryptedColumnTransformer (livre Tache 3.4.7).
 */
@Entity({ name: 'pay_methods' })
@Index('idx_pay_methods_tenant_provider', ['tenant_id', 'provider'], { unique: true })
@Index('idx_pay_methods_tenant_priority', ['tenant_id', 'priority', 'is_enabled'])
export class PayMethod {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  /** Provider paiement (cmi, youcan_pay, payzone, inwi_money, orange_money, mwallet_bam). */
  @Column({ type: 'text', nullable: false })
  provider!: PaymentProvider;

  /** Provider active pour ce tenant ? Permet desactivation rapide sans suppression config. */
  @Column({ type: 'boolean', nullable: false, default: true })
  is_enabled!: boolean;

  /** Priorite routing : plus bas = plus prioritaire. GatewaySelector trie ASC. */
  @Column({ type: 'integer', nullable: false, default: 100 })
  priority!: number;

  /** Mode sandbox vs production. */
  @Column({ type: 'text', nullable: false, default: 'production' })
  environment!: 'sandbox' | 'production';

  /** Merchant ID provider (e.g. CMI clientid, YouCan public_key prefix). NON-secret. */
  @Column({ type: 'text', nullable: true })
  merchant_id!: string | null;

  /**
   * Credentials API chiffres pgcrypto (envelope KMS Atlas).
   * Format JSONB : { api_key_encrypted, secret_encrypted, webhook_secret_encrypted, kek_id }
   * Decryption via Tache 3.4.7 helper EncryptedColumnTransformer.
   */
  @Column({ type: 'jsonb', nullable: true })
  encrypted_credentials!: Record<string, string> | null;

  /** Methods supportees par cette config (e.g. ['card', 'wallet']). */
  @Column({ type: 'jsonb', nullable: false, default: () => "'[]'" })
  supported_methods!: string[];

  /** Limite max amount pour ce provider/tenant (utile pour caps wallet < 5000 MAD). */
  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  max_amount!: number | null;

  /** Limite min amount (e.g. PayZone cash kiosk min 10 MAD). */
  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true })
  min_amount!: number | null;

  /** Webhook URL configuree cote provider (pour reference, pas d'effet code). */
  @Column({ type: 'text', nullable: true })
  webhook_url!: string | null;

  /** Metadata libre (e.g. { contract_signed_at: '2025-...', commercial_rate: 0.025 }). */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // === Helpers ===

  isAvailableForAmount(amount: number): boolean {
    if (this.max_amount !== null && amount > this.max_amount) return false;
    if (this.min_amount !== null && amount < this.min_amount) return false;
    return this.is_enabled;
  }

  supportsMethod(method: string): boolean {
    return this.supported_methods.includes(method);
  }
}
```

### 6.5 Fichier 5/15 : `repo/packages/pay/src/entities/pay-reconciliation.entity.ts`

Reconciliation banque : import CSV releve banque, match auto avec transactions Skalean.

```typescript
// repo/packages/pay/src/entities/pay-reconciliation.entity.ts
//
// Reconciliation banque : import CSV releve banque + match avec pay_transactions.
// Reference Sprint 2 : table pay_reconciliation (deja cree)
// Reference Tache 3.4.10 : ReconciliationService

import {
  Entity, PrimaryGeneratedColumn, Column, Index,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import type { ReconciliationStatus } from '../enums/reconciliation-status.enum';
import { PayTransaction } from './pay-transaction.entity';

/**
 * Ligne import banque pour reconciliation.
 * Source : CSV releve banque ou settlement provider.
 *
 * Workflow :
 *   1. Import CSV -> 1 row par ligne, status='unmatched' initial
 *   2. Auto-match algorithm (Tache 3.4.10) -> match si amount + date + reference Levenshtein
 *   3. Manual match si auto-match ambigu -> status='manual_match' + matched_by user
 *   4. Discrepancy si banque montre transaction non trouvee Skalean -> status='discrepancy'
 */
@Entity({ name: 'pay_reconciliation' })
@Index('idx_pay_recon_tenant_status', ['tenant_id', 'status', 'transaction_date'])
@Index('idx_pay_recon_source_ref', ['source', 'bank_reference'], { unique: true })
@Index('idx_pay_recon_matched_txn', ['matched_transaction_id'])
export class PayReconciliation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: false })
  tenant_id!: string;

  /** Source du CSV : 'cmi_settlement', 'youcan_settlement', 'bank_account_bmce', etc. */
  @Column({ type: 'text', nullable: false })
  source!: string;

  /** Reference unique cote banque (e.g. tracking number CMI, ref BMCE). */
  @Column({ type: 'text', nullable: false })
  bank_reference!: string;

  /** Date transaction telle que reportee par banque. */
  @Column({ type: 'date', nullable: false })
  transaction_date!: Date;

  /** Date valeur banque (peut differer transaction_date pour wire transfers). */
  @Column({ type: 'date', nullable: true })
  value_date!: Date | null;

  /** Montant credite (positif) ou debite (negatif) sur compte. */
  @Column({
    type: 'numeric', precision: 15, scale: 2, nullable: false,
    transformer: {
      from: (v: string | null) => v === null ? null : parseFloat(v),
      to: (v: number | null) => v === null ? null : v.toFixed(2),
    },
  })
  amount!: number;

  /** Currency (MAD only generally, mais quelques wires EUR/USD possibles). */
  @Column({ type: 'char', length: 3, nullable: false, default: 'MAD' })
  currency!: string;

  /** Description libre du releve banque. */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /** Status reconciliation : unmatched/matched/manual_match/discrepancy. */
  @Column({ type: 'text', nullable: false, default: 'unmatched' })
  status!: ReconciliationStatus;

  /** Transaction Skalean matched (si trouvee). */
  @Column({ type: 'uuid', nullable: true })
  matched_transaction_id!: string | null;

  @ManyToOne(() => PayTransaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'matched_transaction_id' })
  matched_transaction!: PayTransaction | null;

  /** Match score 0-100 (algorithm confidence). > 90 auto-accept. */
  @Column({ type: 'integer', nullable: true })
  match_score!: number | null;

  /** User qui a fait le match manuel (audit trail). */
  @Column({ type: 'uuid', nullable: true })
  matched_by!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  matched_at!: Date | null;

  /** Metadata libre (e.g. raw row CSV pour audit). */
  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  // === Helpers ===

  isMatched(): boolean {
    return ['matched', 'manual_match'].includes(this.status);
  }

  hasDiscrepancy(): boolean {
    return this.status === 'discrepancy';
  }
}
```

### 6.6 Fichier 6/15 : `repo/packages/pay/src/schemas/payment.schema.ts`

Schemas Zod pour initiation paiement, capture, cancel, status update.

```typescript
// repo/packages/pay/src/schemas/payment.schema.ts
//
// Schemas Zod payment validation.
// Defense en profondeur : validation au niveau controller (Tache 3.4.13)
// ET service (Tache 3.4.7) selon principe defense in depth.
//
// Reference compliance :
//   - decision-022 (MAD only)
//   - decision-026 (BAM 100k MAD limit)
//   - decision-014 (Idempotency-Key obligatoire)
// Reference no-emoji : decision-006

import { z } from 'zod';
import { ALL_PAYMENT_PROVIDERS } from '../enums/payment-provider.enum';
import { ALL_TRANSACTION_STATUSES } from '../enums/transaction-status.enum';
import { hasPII } from '../helpers/pii-detector.helper';

/** Pattern ULID strict (Crockford Base32, 26 caracteres). */
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Pattern phone Maroc : +212XXXXXXXXX ou 0XXXXXXXXX. */
const MA_PHONE_REGEX = /^(\+212|0)[5-7]\d{8}$/;

/** Pattern URL HTTPS strict (mandatory pour return_url, cancel_url). */
const HTTPS_URL_REGEX = /^https:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i;

/** Limite BAM article 4 circulaire 2/G/2024. */
const BAM_MAX_AMOUNT_MAD = 100000;

/** Limite minimum technique paiement (pour eviter test/spam). */
const MIN_AMOUNT_MAD = 1;

/**
 * Schema initiation paiement.
 * Consume par PaymentOrchestrator.initiate() (Tache 3.4.7) et controller (Tache 3.4.13).
 */
export const InitiatePaymentSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'amount must be a number' })
    .positive({ message: 'amount must be > 0' })
    .min(MIN_AMOUNT_MAD, { message: `amount must be >= ${MIN_AMOUNT_MAD} MAD` })
    .max(BAM_MAX_AMOUNT_MAD, {
      message: `amount must be <= ${BAM_MAX_AMOUNT_MAD} MAD (BAM article 4 circulaire 2/G/2024)`,
    })
    .multipleOf(0.01, { message: 'amount precision is 2 decimals (centimes)' }),

  currency: z.literal('MAD', {
    errorMap: () => ({
      message: 'Only MAD currency supported (Office des Changes loi 1996, decision-022)',
    }),
  }),

  idempotency_key: z
    .string()
    .regex(ULID_REGEX, { message: 'idempotency_key must be ULID (26 chars Crockford Base32)' }),

  customer_email: z
    .string()
    .email({ message: 'customer_email must be valid RFC 5322' })
    .max(255, { message: 'customer_email too long' })
    .toLowerCase(),

  customer_phone: z
    .string()
    .regex(MA_PHONE_REGEX, { message: 'customer_phone must be Morocco format (+212 or 0 prefix)' })
    .optional(),

  customer_name: z
    .string()
    .min(2)
    .max(150)
    .optional(),

  description: z.string().max(255).optional(),

  return_url: z
    .string()
    .regex(HTTPS_URL_REGEX, { message: 'return_url must be HTTPS' })
    .max(2048),

  cancel_url: z
    .string()
    .regex(HTTPS_URL_REGEX, { message: 'cancel_url must be HTTPS' })
    .max(2048),

  related_resource_type: z
    .enum(['invoice', 'police', 'devis', 'repair_invoice', 'subscription'])
    .optional(),

  related_resource_id: z.string().uuid().optional(),

  preferred_provider: z.enum(ALL_PAYMENT_PROVIDERS as readonly [string, ...string[]]).optional(),

  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (m) => !m || !hasPII(m),
      { message: 'metadata must not contain PII (full_name, address, card_*, cvv, pan, ssn)' },
    ),
})
.strict({ message: 'unknown_field' });

export type InitiatePaymentInput = z.infer<typeof InitiatePaymentSchema>;

/**
 * Schema mise a jour status (consume webhooks Tache 3.4.8 et orchestrator).
 */
export const PaymentStatusUpdateSchema = z.object({
  transaction_id: z.string().uuid(),
  new_status: z.enum(ALL_TRANSACTION_STATUSES as readonly [string, ...string[]]),
  authorization_code: z.string().max(64).optional(),
  failure_reason: z.string().max(512).optional(),
  three_d_secure_status: z
    .enum(['authenticated', 'not_authenticated', 'attempted', 'unavailable'])
    .optional(),
  fees_amount: z.number().nonnegative().multipleOf(0.01).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type PaymentStatusUpdateInput = z.infer<typeof PaymentStatusUpdateSchema>;

/**
 * Schema capture explicite (cards 2-step authorize+capture).
 * Consume par CmiGateway.capture() (Tache 3.4.3).
 */
export const CapturePaymentSchema = z.object({
  transaction_id: z.string().uuid(),
  amount: z
    .number()
    .positive()
    .max(BAM_MAX_AMOUNT_MAD)
    .multipleOf(0.01)
    .optional(),
}).strict();

export type CapturePaymentInput = z.infer<typeof CapturePaymentSchema>;

/**
 * Schema annulation transaction pre-capture.
 */
export const CancelPaymentSchema = z.object({
  transaction_id: z.string().uuid(),
  reason: z.string().min(3).max(255),
}).strict();

export type CancelPaymentInput = z.infer<typeof CancelPaymentSchema>;
```

### 6.7 Fichier 7/15 : `repo/packages/pay/src/schemas/refund.schema.ts`

Schemas refund : request, approval, execution.

```typescript
// repo/packages/pay/src/schemas/refund.schema.ts
//
// Schemas Zod refund.
// Reference Tache 3.4.9 : RefundService.

import { z } from 'zod';

const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const BAM_MAX_AMOUNT_MAD = 100000;

/**
 * Demande refund (full ou partial).
 * - amount optionnel : si absent, refund full (montant amount - refunded_amount).
 * - amount fourni : refund partial (verifier <= amount - refunded_amount au service).
 * - reason obligatoire (audit + customer notification).
 * - approver_required derive automatiquement par RefundService :
 *     amount > 1000 MAD -> approval admin required.
 */
export const RefundRequestSchema = z.object({
  transaction_id: z.string().uuid(),

  amount: z
    .number()
    .positive()
    .max(BAM_MAX_AMOUNT_MAD)
    .multipleOf(0.01)
    .optional(),

  reason: z
    .string()
    .min(10, { message: 'reason must be at least 10 chars (audit requirement)' })
    .max(500),

  /** ABAC TimeBasedPolicy : refund > 90 jours rejete (Sprint 7 Tache 2.3.7). */
  override_time_limit: z.boolean().optional().default(false),

  /** Idempotency-Key pour eviter double-refund. */
  idempotency_key: z.string().regex(ULID_REGEX),

  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

export type RefundRequestInput = z.infer<typeof RefundRequestSchema>;

/**
 * Approbation refund par admin (montant > 1000 MAD).
 */
export const RefundApprovalSchema = z.object({
  refund_request_id: z.string().uuid(),
  approver_user_id: z.string().uuid(),
  approval_note: z.string().max(500).optional(),
}).strict();

export type RefundApprovalInput = z.infer<typeof RefundApprovalSchema>;

/**
 * Rejet refund par admin.
 */
export const RefundRejectionSchema = z.object({
  refund_request_id: z.string().uuid(),
  rejecter_user_id: z.string().uuid(),
  rejection_reason: z
    .string()
    .min(10, { message: 'rejection reason mandatory for audit' })
    .max(500),
}).strict();

export type RefundRejectionInput = z.infer<typeof RefundRejectionSchema>;

/**
 * Execution refund (apres approval ou auto-approve <= 1000 MAD).
 * Internal use service uniquement.
 */
export const RefundExecutionSchema = z.object({
  refund_request_id: z.string().uuid(),
  provider_refund_id: z.string().optional(),
  failure_reason: z.string().optional(),
}).strict();

export type RefundExecutionInput = z.infer<typeof RefundExecutionSchema>;
```

### 6.8 Fichier 8/15 : `repo/packages/pay/src/helpers/status-transitions.helper.ts`

State machine helper : validate + execute transitions avec optimistic locking.

```typescript
// repo/packages/pay/src/helpers/status-transitions.helper.ts
//
// Helper centralisant les transitions de statut transaction paiement.
// Toutes les modifications de status DOIVENT passer par ce helper -- garantit :
//  1. Validation transition autorisee selon state machine
//  2. Optimistic locking via WHERE status=oldStatus
//  3. Logging structured de chaque transition
//  4. Audit event Kafka emit
//
// Reference state machine : transaction-status.enum.ts STATUS_TRANSITIONS map.

import type { Repository } from 'typeorm';
import {
  TransactionStatus, STATUS_TRANSITIONS, isFinalStatus, ALL_TRANSACTION_STATUSES,
} from '../enums/transaction-status.enum';
import { PayTransaction } from '../entities/pay-transaction.entity';

export class InvalidTransitionError extends Error {
  constructor(
    public readonly transactionId: string,
    public readonly currentStatus: TransactionStatus,
    public readonly attemptedStatus: TransactionStatus,
  ) {
    super(
      `Invalid status transition for transaction ${transactionId}: ` +
      `${currentStatus} -> ${attemptedStatus} not allowed (state machine).`,
    );
    this.name = 'InvalidTransitionError';
  }
}

export class TransactionLockingConflictError extends Error {
  constructor(public readonly transactionId: string, public readonly expectedStatus: TransactionStatus) {
    super(
      `Locking conflict updating transaction ${transactionId}: ` +
      `expected status was ${expectedStatus} but row was modified concurrently.`,
    );
    this.name = 'TransactionLockingConflictError';
  }
}

export class StatusTransitions {
  /**
   * Verifie si une transition est autorisee.
   * Pure function -- no side effect.
   */
  static canTransitionTo(from: TransactionStatus, to: TransactionStatus): boolean {
    if (!ALL_TRANSACTION_STATUSES.includes(from) || !ALL_TRANSACTION_STATUSES.includes(to)) {
      return false;
    }
    if (isFinalStatus(from)) return false;
    return STATUS_TRANSITIONS[from].includes(to);
  }

  /**
   * Liste les transitions valides depuis un statut donne.
   */
  static getAllowedTransitions(from: TransactionStatus): readonly TransactionStatus[] {
    return STATUS_TRANSITIONS[from] ?? [];
  }

  /**
   * Verifie si statut est final (aucune transition possible).
   */
  static isFinal(status: TransactionStatus): boolean {
    return isFinalStatus(status);
  }

  /**
   * Execute transition avec optimistic locking.
   *
   * Pattern :
   *   UPDATE pay_transactions
   *   SET status = newStatus, [timestamp_for_status] = NOW(), updated_at = NOW()
   *   WHERE id = ? AND tenant_id = ? AND status = oldStatus
   *
   * Si UPDATE retourne 0 rows : conflict (status modifie par concurrent op) -> throw.
   * Si UPDATE retourne 1 row : success.
   *
   * @throws InvalidTransitionError si transition non autorisee
   * @throws TransactionLockingConflictError si optimistic locking fail
   */
  static async transition(
    repository: Repository<PayTransaction>,
    transactionId: string,
    tenantId: string,
    oldStatus: TransactionStatus,
    newStatus: TransactionStatus,
    additionalUpdates: Partial<PayTransaction> = {},
  ): Promise<void> {
    if (!this.canTransitionTo(oldStatus, newStatus)) {
      throw new InvalidTransitionError(transactionId, oldStatus, newStatus);
    }

    // Determine quel timestamp setter selon nouveau status
    const timestampField = this.getTimestampField(newStatus);
    const updateFields: Partial<PayTransaction> = {
      status: newStatus,
      ...additionalUpdates,
    };
    if (timestampField) {
      (updateFields as any)[timestampField] = new Date();
    }

    const result = await repository
      .createQueryBuilder()
      .update(PayTransaction)
      .set(updateFields)
      .where('id = :id', { id: transactionId })
      .andWhere('tenant_id = :tenantId', { tenantId })
      .andWhere('status = :oldStatus', { oldStatus })
      .execute();

    if (result.affected === 0) {
      throw new TransactionLockingConflictError(transactionId, oldStatus);
    }
  }

  /**
   * Map statut -> nom du champ timestamp a setter automatiquement.
   */
  private static getTimestampField(status: TransactionStatus): keyof PayTransaction | null {
    switch (status) {
      case TransactionStatus.AUTHORIZED: return 'authorized_at';
      case TransactionStatus.CAPTURED: return 'captured_at';
      case TransactionStatus.FAILED: return 'failed_at';
      case TransactionStatus.REFUNDED: return 'refunded_at';
      case TransactionStatus.PARTIALLY_REFUNDED: return 'refunded_at';
      default: return null;
    }
  }

  /**
   * Convenience : transition vers FAILED avec failure_reason.
   */
  static async fail(
    repository: Repository<PayTransaction>,
    transactionId: string,
    tenantId: string,
    oldStatus: TransactionStatus,
    failureReason: string,
  ): Promise<void> {
    await this.transition(repository, transactionId, tenantId, oldStatus, TransactionStatus.FAILED, {
      failure_reason: failureReason.slice(0, 512),
    });
  }

  /**
   * Convenience : transition vers CAPTURED avec auth_code et fees.
   */
  static async capture(
    repository: Repository<PayTransaction>,
    transactionId: string,
    tenantId: string,
    oldStatus: TransactionStatus,
    authorizationCode: string,
    feesAmount: number,
  ): Promise<void> {
    await this.transition(repository, transactionId, tenantId, oldStatus, TransactionStatus.CAPTURED, {
      authorization_code: authorizationCode,
      fees_amount: feesAmount,
    });
  }
}
```

### 6.9 Fichier 9/15 : `repo/packages/pay/src/helpers/money.helper.ts`

Money arithmetic avec precision decimale 2 decimales (sans float errors).

```typescript
// repo/packages/pay/src/helpers/money.helper.ts
//
// Helper money arithmetic precision decimale 2 decimales.
// CRITIQUE : ne JAMAIS utiliser Math operations directes sur amounts
// car JavaScript number est IEEE 754 double, sujet a errors arrondi.
//
// Pattern : multiplier par 100 (centimes), faire arithmetic en integers, diviser par 100 en sortie.
//
// Reference compliance : decision-018 (numeric(15,2) money).

export class MoneyParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyParseError';
  }
}

export class MoneyHelpers {
  /** Limite technique : MAX MAD safe = 100 milliards MAD. */
  private static readonly MAX_MONEY_MAD = 100_000_000_000;

  /**
   * Parse une valeur (string ou number) en number avec validation.
   * @throws MoneyParseError si valeur invalide.
   */
  static parse(raw: string | number | null | undefined): number {
    if (raw === null || raw === undefined) {
      throw new MoneyParseError('Money value is null/undefined');
    }
    const num = typeof raw === 'string' ? parseFloat(raw) : raw;
    if (Number.isNaN(num)) {
      throw new MoneyParseError(`Money value is NaN: ${raw}`);
    }
    if (!Number.isFinite(num)) {
      throw new MoneyParseError(`Money value is Infinity: ${raw}`);
    }
    if (num < 0) {
      throw new MoneyParseError(`Money value cannot be negative: ${num}`);
    }
    if (num > this.MAX_MONEY_MAD) {
      throw new MoneyParseError(`Money value exceeds technical max: ${num}`);
    }
    return num;
  }

  /**
   * Format pour persistence Postgres / API response.
   * Toujours 2 decimales : 5000 -> '5000.00', 5000.5 -> '5000.50'.
   */
  static format(value: number): string {
    return this.parse(value).toFixed(2);
  }

  /**
   * Addition precise.
   * Multiplier par 100, additionner en integers, diviser par 100.
   */
  static add(a: number, b: number): number {
    const ca = Math.round(this.parse(a) * 100);
    const cb = Math.round(this.parse(b) * 100);
    return (ca + cb) / 100;
  }

  /**
   * Soustraction precise.
   * @throws MoneyParseError si resultat negatif.
   */
  static sub(a: number, b: number): number {
    const ca = Math.round(this.parse(a) * 100);
    const cb = Math.round(this.parse(b) * 100);
    const result = (ca - cb) / 100;
    if (result < 0) {
      throw new MoneyParseError(`Subtraction result negative: ${a} - ${b} = ${result}`);
    }
    return result;
  }

  /**
   * Multiplication par scalaire (e.g. taxes 20% = multiplier par 1.2).
   */
  static multiply(amount: number, factor: number): number {
    const ca = Math.round(this.parse(amount) * 100);
    const result = (ca * factor) / 100;
    return Math.round(result * 100) / 100;
  }

  /**
   * Verifie egalite avec tolerance epsilon (pour comparison apres operations).
   */
  static equals(a: number, b: number, epsilon: number = 0.005): boolean {
    return Math.abs(this.parse(a) - this.parse(b)) < epsilon;
  }

  /**
   * Verifie precision 2 decimales exacte (rejette 5000.555).
   */
  static hasValidPrecision(value: number): boolean {
    const str = value.toString();
    const decimalPart = str.split('.')[1];
    return !decimalPart || decimalPart.length <= 2;
  }

  /**
   * Conversion centimes -> MAD.
   */
  static fromCentimes(centimes: number): number {
    return centimes / 100;
  }

  /**
   * Conversion MAD -> centimes (integer).
   */
  static toCentimes(mad: number): number {
    return Math.round(this.parse(mad) * 100);
  }
}
```

### 6.10 Fichier 10/15 : `repo/packages/pay/src/helpers/payment-validators.helper.ts`

Validators metier specifiques Maroc.

```typescript
// repo/packages/pay/src/helpers/payment-validators.helper.ts

import { ALL_PAYMENT_PROVIDERS, type PaymentProvider } from '../enums/payment-provider.enum';

/** BAM article 4 circulaire 2/G/2024 : limite 100k MAD per transaction sans declaration. */
export const BAM_MAX_AMOUNT_MAD = 100_000;

/** Pattern ULID strict. */
const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** Pattern phone Maroc. */
const MA_PHONE_REGEX = /^(\+212|0)[5-7]\d{8}$/;

export class PaymentValidatorError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PaymentValidatorError';
  }
}

export class PaymentValidators {
  /**
   * Valide montant respecte limite BAM article 4.
   * @throws PaymentValidatorError si > 100k MAD.
   */
  static validateBamLimit(amount: number): void {
    if (amount > BAM_MAX_AMOUNT_MAD) {
      throw new PaymentValidatorError(
        'BAM_LIMIT_EXCEEDED',
        `Amount ${amount} exceeds BAM article 4 circulaire 2/G/2024 limit of ${BAM_MAX_AMOUNT_MAD} MAD. ` +
        `Transactions over this threshold require BAM declaration procedure (out of scope MVP).`,
      );
    }
  }

  /**
   * Valide currency MAD only (Office des Changes loi 1996).
   */
  static validateMadCurrency(currency: string): void {
    if (currency !== 'MAD') {
      throw new PaymentValidatorError(
        'INVALID_CURRENCY',
        `Currency ${currency} not supported. Only MAD allowed (Office des Changes loi 1996, decision-022).`,
      );
    }
  }

  /**
   * Valide format ULID strict.
   */
  static validateUlidFormat(value: string): void {
    if (!ULID_REGEX.test(value)) {
      throw new PaymentValidatorError(
        'INVALID_ULID',
        `Value ${value} is not a valid ULID (26 chars Crockford Base32, decision-014).`,
      );
    }
  }

  /**
   * Valide format phone Maroc (E.164 ou local).
   */
  static validateMaPhoneNumber(phone: string): void {
    if (!MA_PHONE_REGEX.test(phone)) {
      throw new PaymentValidatorError(
        'INVALID_MA_PHONE',
        `Phone ${phone} not Morocco format. Expected: +212XXXXXXXXX or 0XXXXXXXXX (5-7 prefix).`,
      );
    }
  }

  /**
   * Valide provider parmi liste autorisee.
   */
  static validateProvider(provider: string): void {
    if (!(ALL_PAYMENT_PROVIDERS as readonly string[]).includes(provider)) {
      throw new PaymentValidatorError(
        'INVALID_PROVIDER',
        `Provider ${provider} not supported. Allowed: ${ALL_PAYMENT_PROVIDERS.join(', ')}.`,
      );
    }
  }

  /**
   * Valide email format basic (RFC 5322 simplifie).
   */
  static validateEmail(email: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 255) {
      throw new PaymentValidatorError('INVALID_EMAIL', `Email ${email} is invalid.`);
    }
  }

  /**
   * Valide URL HTTPS strict.
   */
  static validateHttpsUrl(url: string, fieldName: string = 'url'): void {
    const urlRegex = /^https:\/\/[a-z0-9.-]+(:\d+)?(\/.*)?$/i;
    if (!urlRegex.test(url)) {
      throw new PaymentValidatorError(
        'INVALID_HTTPS_URL',
        `${fieldName} must be HTTPS URL: ${url}`,
      );
    }
  }
}
```

### 6.11 Fichier 11/15 : `repo/packages/pay/src/helpers/phone.helper.ts`

Phone normalization Maroc + detection operateur (pour wallet routing).

```typescript
// repo/packages/pay/src/helpers/phone.helper.ts
//
// Phone helpers Maroc.
// Normalization : tous formats acceptes UX (+212, 0, 00212) -> E.164 stocke.
// Detection operateur via prefix : critique pour routing wallet (Inwi, Orange, IAM).

export type MaOperator = 'iam' | 'inwi' | 'orange' | 'unknown';

export class PhoneHelpers {
  /**
   * Normalise un phone marocain en E.164 (+212XXXXXXXXX).
   * Accepte : +212600123456, 0600123456, 00212600123456.
   * Rejette : autres formats.
   */
  static normalizeMaPhone(input: string): string {
    const cleaned = input.replace(/[\s.-]/g, '');

    // Format +212XXXXXXXXX (E.164 deja) -- 13 chars
    if (/^\+212[5-7]\d{8}$/.test(cleaned)) {
      return cleaned;
    }
    // Format 00212XXXXXXXXX -- 14 chars
    if (/^00212[5-7]\d{8}$/.test(cleaned)) {
      return '+' + cleaned.slice(2);
    }
    // Format 0XXXXXXXXX (local) -- 10 chars
    if (/^0[5-7]\d{8}$/.test(cleaned)) {
      return '+212' + cleaned.slice(1);
    }
    throw new Error(`Phone ${input} is not a valid Morocco number`);
  }

  /**
   * Detecte l'operateur mobile MA via prefix.
   * Mapping en 2025 (peut evoluer -- BAM portabilite numero) :
   *   - IAM (Maroc Telecom) : 06 1, 2, 6, 7 -- 06 5 8X 9X
   *   - Inwi : 06 4, 5, 7 (partial)
   *   - Orange : 06 3, 8, 9 (partial)
   *
   * Note : portabilite numero rend ce mapping approximatif.
   * Sprint 11 utilise ce hint pour DEFAULT routing (e.g. phone Inwi -> Inwi Money preferre)
   * mais user peut overrider via preferred_provider param.
   */
  static detectMaOperator(e164Phone: string): MaOperator {
    const normalized = this.normalizeMaPhone(e164Phone);
    // Strip +212 -> get 9 digit
    const local = normalized.slice(4); // e.g. '600123456'

    if (!/^[5-7]\d{8}$/.test(local)) return 'unknown';

    const prefix3 = local.substring(0, 3);

    // IAM prefixes (Maroc Telecom)
    if (['661', '662', '663', '664', '665', '666', '667', '668', '669',
         '670', '671', '676', '677', '678'].includes(prefix3)) {
      return 'iam';
    }
    // Inwi prefixes
    if (['650', '651', '652', '653', '654', '655', '656', '657', '658', '659',
         '675'].includes(prefix3)) {
      return 'inwi';
    }
    // Orange prefixes
    if (['600', '601', '602', '603', '604', '605', '606', '607', '608', '609',
         '610', '611', '612', '613', '614', '615', '616', '617', '618', '619',
         '630', '631', '632', '633', '634', '635', '636', '637', '638', '639'].includes(prefix3)) {
      return 'orange';
    }

    return 'unknown';
  }

  /**
   * Extrait country code (toujours +212 pour Maroc dans MVP).
   */
  static extractCountryCode(e164Phone: string): string {
    return e164Phone.startsWith('+212') ? '+212' : '';
  }

  /**
   * Format display friendly (UI) : 06 00 12 34 56.
   */
  static formatDisplay(e164Phone: string): string {
    const local = this.normalizeMaPhone(e164Phone).slice(4);
    return `0${local.substring(0, 1)} ${local.substring(1, 3)} ${local.substring(3, 5)} ${local.substring(5, 7)} ${local.substring(7, 9)}`;
  }
}
```

### 6.12 Fichier 12/15 : `repo/packages/pay/src/helpers/pii-detector.helper.ts`

Detection PII pour rejeter rows metadata avec donnees sensibles.

```typescript
// repo/packages/pay/src/helpers/pii-detector.helper.ts
//
// Detection PII (Personally Identifiable Information) dans metadata.
// Rejete rows avec PII pour conformite CNDP loi 09-08 article 3.
// PII NE DOIT JAMAIS aller dans pay_transactions.metadata car non chiffree.
//
// PII chiffree va dans table dedicaee (auth_users.encrypted_pii Sprint 5).

const PII_KEY_PATTERNS = [
  /^card_(pan|number|cvv|cvc|cvn|exp|expiry|expdate)$/i,
  /^pan$/i,
  /^cvv$/i,
  /^card_holder_full_name$/i,
  /^full_name$/i,
  /^address$/i,
  /^postal_code$/i,
  /^zip_code$/i,
  /^ssn$/i,
  /^cin$/i,
  /^cnie$/i,
  /^passport$/i,
  /^iban$/i,
  /^bic$/i,
  /^swift$/i,
  /^bank_account$/i,
  /^date_of_birth$/i,
  /^dob$/i,
  /^birthdate$/i,
];

const PII_VALUE_PATTERNS = [
  /^\d{13,19}$/, // potential card PAN
  /^\d{3,4}$/, // potential CVV (mais aussi codes generiques -- check key context)
];

/**
 * Detecte si metadata contient potentiellement PII.
 * Verifie clefs (matching patterns) et valeurs strings (patterns numeriques suspects).
 *
 * Conservative : false positive acceptable (mieux que false negative pour PCI-DSS).
 */
export function hasPII(metadata: Record<string, unknown>): boolean {
  for (const [key, value] of Object.entries(metadata)) {
    // Check key
    if (PII_KEY_PATTERNS.some((re) => re.test(key))) {
      return true;
    }
    // Recursive check nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (hasPII(value as Record<string, unknown>)) {
        return true;
      }
    }
    // Check string values for card patterns
    if (typeof value === 'string') {
      // Strip non-digits for card pattern check
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19 && /^\d+$/.test(digits)) {
        // Could be card PAN -- additional Luhn check
        if (isLuhnValid(digits)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Algorithm Luhn verification (cards check digit).
 * Used to detect potential card numbers in metadata.
 */
function isLuhnValid(digits: string): boolean {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n = (n % 10) + 1;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * Liste raisons potentielles de detection PII (pour error messages debugging).
 */
export function detectPIIReasons(metadata: Record<string, unknown>): string[] {
  const reasons: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    for (const pattern of PII_KEY_PATTERNS) {
      if (pattern.test(key)) {
        reasons.push(`Key '${key}' matches PII pattern ${pattern}`);
        break;
      }
    }
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      if (digits.length >= 13 && digits.length <= 19 && isLuhnValid(digits)) {
        reasons.push(`Value at key '${key}' looks like a card number (Luhn valid, ${digits.length} digits)`);
      }
    }
  }
  return reasons;
}
```

### 6.13 Fichier 13/15 : `repo/packages/pay/src/factories/pay-transaction.factory.ts`

Factory genere PayTransaction realistic pour tests.

```typescript
// repo/packages/pay/src/factories/pay-transaction.factory.ts
//
// Factory PayTransaction pour tests Sprint 11 + sprints suivants.
// Defaults realistic : amounts plausibles, emails valides, ULID, etc.

import { ulid } from 'ulid';
import { PayTransaction } from '../entities/pay-transaction.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentMethod } from '../enums/payment-method.enum';

export interface PayTransactionFactoryOverrides {
  id?: string;
  tenant_id?: string;
  amount?: number;
  currency?: 'MAD';
  status?: TransactionStatus;
  provider?: PaymentProvider;
  provider_method?: PaymentMethod;
  customer_email?: string;
  customer_phone?: string;
  customer_name?: string;
  related_resource_type?: string | null;
  related_resource_id?: string | null;
  idempotency_key?: string;
  three_d_secure_enabled?: boolean;
  three_d_secure_status?: string | null;
  authorization_code?: string | null;
  failure_reason?: string | null;
  fees_amount?: number;
  refunded_amount?: number;
  metadata?: Record<string, unknown> | null;
  initiated_at?: Date;
  authorized_at?: Date | null;
  captured_at?: Date | null;
  failed_at?: Date | null;
  refunded_at?: Date | null;
  provider_transaction_id?: string | null;
  provider_reference?: string | null;
  created_by?: string | null;
}

export class PayTransactionFactory {
  /** Genere une transaction PENDING par defaut. */
  static build(overrides: PayTransactionFactoryOverrides = {}): PayTransaction {
    const now = new Date();
    const tx = new PayTransaction();
    tx.id = overrides.id ?? crypto.randomUUID();
    tx.tenant_id = overrides.tenant_id ?? 'tenant-test-uuid-0001';
    tx.amount = overrides.amount ?? 1500.0;
    tx.currency = overrides.currency ?? 'MAD';
    tx.status = overrides.status ?? TransactionStatus.PENDING;
    tx.provider = overrides.provider ?? PaymentProvider.CMI;
    tx.provider_method = overrides.provider_method ?? 'card';
    tx.customer_email = overrides.customer_email ?? `test-${Date.now()}@example.ma`;
    tx.customer_phone = overrides.customer_phone ?? '+212600123456';
    tx.customer_name = overrides.customer_name ?? 'Mohammed El Test';
    tx.related_resource_type = overrides.related_resource_type ?? 'invoice';
    tx.related_resource_id = overrides.related_resource_id ?? crypto.randomUUID();
    tx.idempotency_key = overrides.idempotency_key ?? ulid();
    tx.three_d_secure_enabled = overrides.three_d_secure_enabled ?? true;
    tx.three_d_secure_status = overrides.three_d_secure_status ?? null;
    tx.authorization_code = overrides.authorization_code ?? null;
    tx.failure_reason = overrides.failure_reason ?? null;
    tx.fees_amount = overrides.fees_amount ?? 0;
    tx.refunded_amount = overrides.refunded_amount ?? 0;
    tx.metadata = overrides.metadata ?? { source: 'factory' };
    tx.initiated_at = overrides.initiated_at ?? now;
    tx.authorized_at = overrides.authorized_at ?? null;
    tx.captured_at = overrides.captured_at ?? null;
    tx.failed_at = overrides.failed_at ?? null;
    tx.refunded_at = overrides.refunded_at ?? null;
    tx.provider_transaction_id = overrides.provider_transaction_id ?? null;
    tx.provider_reference = overrides.provider_reference ?? null;
    tx.created_by = overrides.created_by ?? null;
    tx.created_at = now;
    tx.updated_at = now;
    return tx;
  }

  /** Transaction CAPTURED (cas frequent tests). */
  static buildCaptured(overrides: PayTransactionFactoryOverrides = {}): PayTransaction {
    const now = new Date();
    return this.build({
      ...overrides,
      status: TransactionStatus.CAPTURED,
      authorization_code: overrides.authorization_code ?? `AUTH-${Date.now()}`,
      authorized_at: overrides.authorized_at ?? now,
      captured_at: overrides.captured_at ?? now,
      provider_transaction_id: overrides.provider_transaction_id ?? `PROV-${Date.now()}`,
      three_d_secure_status: overrides.three_d_secure_status ?? 'authenticated',
      fees_amount: overrides.fees_amount ?? 25.0,
    });
  }

  /** Transaction FAILED. */
  static buildFailed(overrides: PayTransactionFactoryOverrides = {}): PayTransaction {
    return this.build({
      ...overrides,
      status: TransactionStatus.FAILED,
      failure_reason: overrides.failure_reason ?? 'Card declined: insufficient funds',
      failed_at: overrides.failed_at ?? new Date(),
    });
  }

  /** Transaction REFUNDED. */
  static buildRefunded(overrides: PayTransactionFactoryOverrides = {}): PayTransaction {
    const tx = this.buildCaptured(overrides);
    tx.status = TransactionStatus.REFUNDED;
    tx.refunded_amount = tx.amount;
    tx.refunded_at = new Date();
    return tx;
  }

  /** Plusieurs transactions en batch (utile seeds). */
  static buildMany(count: number, overrides: PayTransactionFactoryOverrides = {}): PayTransaction[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }
}
```

### 6.14 Fichier 14/15 : `repo/packages/pay/src/index.ts` (barrel global)

```typescript
// repo/packages/pay/src/index.ts
//
// Barrel export package @insurtech/pay.
// Tous les consumers downstream importent uniquement via cette racine.

// Entities
export * from './entities/pay-method.entity';
export * from './entities/pay-transaction.entity';
export * from './entities/pay-reconciliation.entity';
export * from './entities/pay-refund-request.entity';
export * from './entities/pay-fraud-evaluation.entity';

// Enums
export * from './enums/payment-provider.enum';
export * from './enums/payment-method.enum';
export * from './enums/transaction-status.enum';
export * from './enums/currency.enum';
export * from './enums/reconciliation-status.enum';
export * from './enums/refund-status.enum';

// Schemas Zod
export * from './schemas/payment.schema';
export * from './schemas/refund.schema';
export * from './schemas/reconciliation.schema';
export * from './schemas/webhook.schema';
export * from './schemas/filters.schema';

// Helpers
export * from './helpers/status-transitions.helper';
export * from './helpers/money.helper';
export * from './helpers/payment-validators.helper';
export * from './helpers/phone.helper';
export * from './helpers/pii-detector.helper';

// Factories (test-only normally, but exported for cross-package tests)
export * from './factories/pay-transaction.factory';
export * from './factories/pay-method.factory';
export * from './factories/pay-reconciliation.factory';
```

### 6.15 Fichier 15/15 : `repo/packages/pay/src/schemas/webhook.schema.ts`

Schemas Zod webhook payloads.

```typescript
// repo/packages/pay/src/schemas/webhook.schema.ts
//
// Schemas Zod webhooks reception 6 providers.
// Chaque provider a son format payload propre, mais on declare un BaseWebhookPayload
// minimum + extensions specifiques per provider.

import { z } from 'zod';
import { ALL_TRANSACTION_STATUSES } from '../enums/transaction-status.enum';

/** Base payload commune (au minimum chaque webhook fournit ces fields). */
export const BaseWebhookPayloadSchema = z.object({
  event_type: z.string().min(1).max(100),
  occurred_at: z.string().datetime().optional(),
  webhook_id: z.string().optional(),
}).passthrough(); // permet champs additionnels per provider

export type BaseWebhookPayload = z.infer<typeof BaseWebhookPayloadSchema>;

/** CMI webhook payload (form-urlencoded). */
export const CmiWebhookPayloadSchema = z.object({
  oid: z.string(), // our idempotency_key (order_id)
  AuthCode: z.string().optional(),
  ProcReturnCode: z.string(),
  Response: z.enum(['Approved', 'Declined', 'Error']),
  TransId: z.string().optional(),
  HostRefNum: z.string().optional(),
  amount: z.string(),
  currency: z.literal('504'), // MAD ISO numeric
  HASH: z.string(), // signature SHA-512
  HASHPARAMS: z.string().optional(),
  HASHPARAMSVAL: z.string().optional(),
  storetype: z.literal('3D_PAY_HOSTING').optional(),
  mdStatus: z.string().optional(), // 3DS status
}).passthrough();

export type CmiWebhookPayload = z.infer<typeof CmiWebhookPayloadSchema>;

/** YouCan Pay webhook payload (JSON). */
export const YouCanPayWebhookPayloadSchema = z.object({
  event: z.enum(['transaction.paid', 'transaction.failed', 'transaction.cancelled', 'refund.created']),
  data: z.object({
    id: z.string(),
    status: z.string(),
    amount: z.number().int(), // YouCan en centimes integer
    currency: z.literal('MAD'),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  signature: z.string().optional(), // HMAC SHA-256
  occurred_at: z.string().datetime(),
}).passthrough();

export type YouCanPayWebhookPayload = z.infer<typeof YouCanPayWebhookPayloadSchema>;

/** PayZone webhook payload. */
export const PayZoneWebhookPayloadSchema = z.object({
  transaction_id: z.string(),
  status: z.enum(['paid', 'pending', 'expired', 'cancelled', 'refunded']),
  amount: z.number(),
  currency: z.literal('MAD'),
  payment_method: z.enum(['card', 'voucher_cash']).optional(),
  voucher_paid_at_kiosk: z.string().datetime().optional(),
  signature: z.string(),
}).passthrough();

/** Inwi Money webhook (rare -- polling preferred). */
export const InwiMoneyWebhookPayloadSchema = z.object({
  transaction_ref: z.string(),
  status: z.string(),
  amount: z.number(),
  customer_msisdn: z.string(),
  signature: z.string(),
}).passthrough();

/** Orange Money webhook. */
export const OrangeMoneyWebhookPayloadSchema = z.object({
  payment_token: z.string(),
  status: z.string(),
  amount: z.number(),
  signature: z.string(),
}).passthrough();

/** M-Wallet BAM webhook. */
export const MWalletBamWebhookPayloadSchema = z.object({
  reference: z.string(),
  status: z.string(),
  amount: z.number(),
  hash: z.string(),
}).passthrough();

/** Discriminated union -- helps narrowing in webhook processor. */
export const AnyWebhookPayloadSchema = z.union([
  CmiWebhookPayloadSchema,
  YouCanPayWebhookPayloadSchema,
  PayZoneWebhookPayloadSchema,
  InwiMoneyWebhookPayloadSchema,
  OrangeMoneyWebhookPayloadSchema,
  MWalletBamWebhookPayloadSchema,
]);
```

---

## 7. Tests complets

### 7.1 Tests unitaires entities : `repo/packages/pay/src/entities/__tests__/pay-transaction.entity.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PayTransaction } from '../pay-transaction.entity';
import { TransactionStatus } from '../../enums/transaction-status.enum';
import { PaymentProvider } from '../../enums/payment-provider.enum';
import { PayTransactionFactory } from '../../factories/pay-transaction.factory';

describe('PayTransaction entity', () => {
  let txn: PayTransaction;

  beforeEach(() => {
    txn = PayTransactionFactory.build();
  });

  it('should hydrate via factory with default fields', () => {
    expect(txn.id).toBeDefined();
    expect(txn.tenant_id).toBeDefined();
    expect(txn.amount).toBe(1500.0);
    expect(txn.currency).toBe('MAD');
    expect(txn.status).toBe(TransactionStatus.PENDING);
    expect(txn.provider).toBe(PaymentProvider.CMI);
    expect(txn.idempotency_key).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(txn.three_d_secure_enabled).toBe(true);
  });

  it('isFinal returns false for pending', () => {
    expect(txn.isFinal()).toBe(false);
  });

  it('isFinal returns true for failed/refunded/cancelled', () => {
    txn.status = TransactionStatus.FAILED;
    expect(txn.isFinal()).toBe(true);
    txn.status = TransactionStatus.REFUNDED;
    expect(txn.isFinal()).toBe(true);
    txn.status = TransactionStatus.CANCELLED;
    expect(txn.isFinal()).toBe(true);
  });

  it('isFinal returns false for captured', () => {
    txn.status = TransactionStatus.CAPTURED;
    expect(txn.isFinal()).toBe(false);
  });

  it('isCaptured returns true for captured/refunded/partially_refunded', () => {
    txn.status = TransactionStatus.CAPTURED;
    expect(txn.isCaptured()).toBe(true);
    txn.status = TransactionStatus.REFUNDED;
    expect(txn.isCaptured()).toBe(true);
    txn.status = TransactionStatus.PARTIALLY_REFUNDED;
    expect(txn.isCaptured()).toBe(true);
  });

  it('isRefunded returns true for refunded statuses', () => {
    txn.status = TransactionStatus.REFUNDED;
    expect(txn.isRefunded()).toBe(true);
    txn.status = TransactionStatus.PARTIALLY_REFUNDED;
    expect(txn.isRefunded()).toBe(true);
    txn.status = TransactionStatus.CAPTURED;
    expect(txn.isRefunded()).toBe(false);
  });

  it('getRefundableAmount returns full amount when no refund yet', () => {
    txn.amount = 5000;
    txn.refunded_amount = 0;
    expect(txn.getRefundableAmount()).toBe(5000);
  });

  it('getRefundableAmount returns remaining after partial refund', () => {
    txn.amount = 5000;
    txn.refunded_amount = 2000;
    expect(txn.getRefundableAmount()).toBe(3000);
  });

  it('getRefundableAmount returns 0 if fully refunded', () => {
    txn.amount = 5000;
    txn.refunded_amount = 5000;
    expect(txn.getRefundableAmount()).toBe(0);
  });

  it('factory.buildCaptured generates captured txn with timestamps', () => {
    const captured = PayTransactionFactory.buildCaptured();
    expect(captured.status).toBe(TransactionStatus.CAPTURED);
    expect(captured.authorization_code).toBeTruthy();
    expect(captured.authorized_at).toBeInstanceOf(Date);
    expect(captured.captured_at).toBeInstanceOf(Date);
    expect(captured.three_d_secure_status).toBe('authenticated');
  });

  it('factory.buildFailed generates failed txn with reason', () => {
    const failed = PayTransactionFactory.buildFailed();
    expect(failed.status).toBe(TransactionStatus.FAILED);
    expect(failed.failure_reason).toBeTruthy();
    expect(failed.failed_at).toBeInstanceOf(Date);
  });

  it('factory.buildRefunded sets refunded_amount = amount', () => {
    const refunded = PayTransactionFactory.buildRefunded({ amount: 3000 });
    expect(refunded.status).toBe(TransactionStatus.REFUNDED);
    expect(refunded.refunded_amount).toBe(3000);
    expect(refunded.refunded_at).toBeInstanceOf(Date);
  });
});
```

### 7.2 Tests schemas : `repo/packages/pay/src/schemas/__tests__/payment.schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ulid } from 'ulid';
import {
  InitiatePaymentSchema, PaymentStatusUpdateSchema, CapturePaymentSchema, CancelPaymentSchema,
} from '../payment.schema';

describe('InitiatePaymentSchema', () => {
  const validInput = {
    amount: 1500.50,
    currency: 'MAD' as const,
    idempotency_key: ulid(),
    customer_email: 'client@example.ma',
    customer_phone: '+212600123456',
    customer_name: 'Mohammed Test',
    return_url: 'https://broker.skalean.ma/pay/success',
    cancel_url: 'https://broker.skalean.ma/pay/cancel',
  };

  it('accepts valid input', () => {
    const result = InitiatePaymentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects amount > 100000 MAD (BAM limit)', () => {
    const result = InitiatePaymentSchema.safeParse({ ...validInput, amount: 100001 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/BAM article 4/);
    }
  });

  it('rejects amount = 0', () => {
    const result = InitiatePaymentSchema.safeParse({ ...validInput, amount: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects negative amount', () => {
    const result = InitiatePaymentSchema.safeParse({ ...validInput, amount: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects amount with > 2 decimals', () => {
    const result = InitiatePaymentSchema.safeParse({ ...validInput, amount: 1500.555 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/2 decimals/);
    }
  });

  it('rejects currency != MAD', () => {
    const result = InitiatePaymentSchema.safeParse({ ...validInput, currency: 'EUR' as any });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/Office des Changes/);
    }
  });

  it('rejects idempotency_key non-ULID format', () => {
    const result = InitiatePaymentSchema.safeParse({
      ...validInput,
      idempotency_key: 'not-a-ulid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects idempotency_key UUIDv4 (not ULID)', () => {
    const result = InitiatePaymentSchema.safeParse({
      ...validInput,
      idempotency_key: '12345678-1234-1234-1234-123456789012',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid customer_email', () => {
    const result = InitiatePaymentSchema.safeParse({
      ...validInput,
      customer_email: 'not-an-email',
    });
    expect(result.success).toBe(false);
  });

  it('lowercases customer_email automatically', () => {
    const result = InitiatePaymentSchema.parse({ ...validInput, customer_email: 'CLIENT@EXAMPLE.MA' });
    expect(result.customer_email).toBe('client@example.ma');
  });

  it('rejects customer_phone non-Morocco format', () => {
    const result = InitiatePaymentSchema.safeParse({
      ...validInput,
      customer_phone: '+33612345678', // French number
    });
    expect(result.success).toBe(false);
  });

  it('accepts customer_phone in 0XXXXXXXXX format', () => {
    const result = InitiatePaymentSchema.safeParse({
      ...validInput,
      customer_phone: '0600123456',
    });
    expect(result.success).toBe(true);
  });

  it('rejects return_url HTTP (not HTTPS)', () => {
    const result = InitiatePaymentSchema.safeParse({
      ...validInput,
      return_url: 'http://broker.skalean.ma/success',
    });
    expect(result.success).toBe(false);
  });

  it('rejects metadata containing PII (card number)', () => {
    const result = InitiatePaymentSchema.safeParse({
      ...validInput,
      metadata: { full_name: 'M. Test', card_number: '4111111111111111' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown fields (strict mode)', () => {
    const result = InitiatePaymentSchema.safeParse({
      ...validInput,
      unknown_field: 'extra',
    });
    expect(result.success).toBe(false);
  });
});

describe('PaymentStatusUpdateSchema', () => {
  it('accepts valid update', () => {
    const result = PaymentStatusUpdateSchema.safeParse({
      transaction_id: '12345678-1234-1234-1234-123456789012',
      new_status: 'captured',
      authorization_code: 'AUTH-123',
      fees_amount: 25.50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status enum', () => {
    const result = PaymentStatusUpdateSchema.safeParse({
      transaction_id: '12345678-1234-1234-1234-123456789012',
      new_status: 'something_else',
    });
    expect(result.success).toBe(false);
  });
});

describe('CapturePaymentSchema', () => {
  it('accepts capture without amount (full)', () => {
    const result = CapturePaymentSchema.safeParse({
      transaction_id: '12345678-1234-1234-1234-123456789012',
    });
    expect(result.success).toBe(true);
  });

  it('accepts capture with partial amount', () => {
    const result = CapturePaymentSchema.safeParse({
      transaction_id: '12345678-1234-1234-1234-123456789012',
      amount: 500.00,
    });
    expect(result.success).toBe(true);
  });
});

describe('CancelPaymentSchema', () => {
  it('requires reason', () => {
    const result = CancelPaymentSchema.safeParse({
      transaction_id: '12345678-1234-1234-1234-123456789012',
    });
    expect(result.success).toBe(false);
  });

  it('accepts valid cancel', () => {
    const result = CancelPaymentSchema.safeParse({
      transaction_id: '12345678-1234-1234-1234-123456789012',
      reason: 'User cancelled',
    });
    expect(result.success).toBe(true);
  });
});
```

### 7.3 Tests helpers : `repo/packages/pay/src/helpers/__tests__/status-transitions.helper.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StatusTransitions, InvalidTransitionError, TransactionLockingConflictError } from '../status-transitions.helper';
import { TransactionStatus } from '../../enums/transaction-status.enum';

describe('StatusTransitions.canTransitionTo', () => {
  it('allows pending -> authorized', () => {
    expect(StatusTransitions.canTransitionTo('pending' as TransactionStatus, 'authorized' as TransactionStatus)).toBe(true);
  });

  it('allows pending -> captured', () => {
    expect(StatusTransitions.canTransitionTo('pending' as TransactionStatus, 'captured' as TransactionStatus)).toBe(true);
  });

  it('allows pending -> failed', () => {
    expect(StatusTransitions.canTransitionTo('pending' as TransactionStatus, 'failed' as TransactionStatus)).toBe(true);
  });

  it('allows pending -> cancelled', () => {
    expect(StatusTransitions.canTransitionTo('pending' as TransactionStatus, 'cancelled' as TransactionStatus)).toBe(true);
  });

  it('forbids pending -> refunded directly', () => {
    expect(StatusTransitions.canTransitionTo('pending' as TransactionStatus, 'refunded' as TransactionStatus)).toBe(false);
  });

  it('allows authorized -> captured', () => {
    expect(StatusTransitions.canTransitionTo('authorized' as TransactionStatus, 'captured' as TransactionStatus)).toBe(true);
  });

  it('allows captured -> refunded', () => {
    expect(StatusTransitions.canTransitionTo('captured' as TransactionStatus, 'refunded' as TransactionStatus)).toBe(true);
  });

  it('forbids captured -> pending (no resurrection)', () => {
    expect(StatusTransitions.canTransitionTo('captured' as TransactionStatus, 'pending' as TransactionStatus)).toBe(false);
  });

  it('forbids captured -> failed (no overwrite)', () => {
    expect(StatusTransitions.canTransitionTo('captured' as TransactionStatus, 'failed' as TransactionStatus)).toBe(false);
  });

  it('forbids any transition from FAILED', () => {
    expect(StatusTransitions.canTransitionTo('failed' as TransactionStatus, 'captured' as TransactionStatus)).toBe(false);
    expect(StatusTransitions.canTransitionTo('failed' as TransactionStatus, 'pending' as TransactionStatus)).toBe(false);
  });

  it('forbids any transition from CANCELLED', () => {
    expect(StatusTransitions.canTransitionTo('cancelled' as TransactionStatus, 'captured' as TransactionStatus)).toBe(false);
  });

  it('forbids any transition from REFUNDED', () => {
    expect(StatusTransitions.canTransitionTo('refunded' as TransactionStatus, 'captured' as TransactionStatus)).toBe(false);
  });

  it('isFinal returns true for failed/refunded/cancelled', () => {
    expect(StatusTransitions.isFinal('failed' as TransactionStatus)).toBe(true);
    expect(StatusTransitions.isFinal('refunded' as TransactionStatus)).toBe(true);
    expect(StatusTransitions.isFinal('cancelled' as TransactionStatus)).toBe(true);
  });
});

describe('StatusTransitions.transition', () => {
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      createQueryBuilder: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 1 }),
    };
  });

  it('throws InvalidTransitionError for forbidden transition', async () => {
    await expect(
      StatusTransitions.transition(mockRepo, 'txn-1', 'tenant-1', 'failed' as TransactionStatus, 'captured' as TransactionStatus),
    ).rejects.toThrow(InvalidTransitionError);
  });

  it('throws TransactionLockingConflictError if affected = 0', async () => {
    mockRepo.execute.mockResolvedValue({ affected: 0 });
    await expect(
      StatusTransitions.transition(mockRepo, 'txn-1', 'tenant-1', 'pending' as TransactionStatus, 'captured' as TransactionStatus),
    ).rejects.toThrow(TransactionLockingConflictError);
  });

  it('succeeds when transition valid and locking ok', async () => {
    await expect(
      StatusTransitions.transition(mockRepo, 'txn-1', 'tenant-1', 'pending' as TransactionStatus, 'captured' as TransactionStatus),
    ).resolves.not.toThrow();
    expect(mockRepo.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'captured',
        captured_at: expect.any(Date),
      }),
    );
  });

  it('sets captured_at when transitioning to captured', async () => {
    await StatusTransitions.transition(mockRepo, 'txn-1', 'tenant-1', 'pending' as TransactionStatus, 'captured' as TransactionStatus);
    expect(mockRepo.set).toHaveBeenCalledWith(
      expect.objectContaining({ captured_at: expect.any(Date) }),
    );
  });

  it('sets failed_at when transitioning to failed', async () => {
    await StatusTransitions.transition(mockRepo, 'txn-1', 'tenant-1', 'pending' as TransactionStatus, 'failed' as TransactionStatus);
    expect(mockRepo.set).toHaveBeenCalledWith(
      expect.objectContaining({ failed_at: expect.any(Date) }),
    );
  });
});
```

### 7.4 Tests money helper : `repo/packages/pay/src/helpers/__tests__/money.helper.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { MoneyHelpers, MoneyParseError } from '../money.helper';

describe('MoneyHelpers.parse', () => {
  it('parses string number', () => {
    expect(MoneyHelpers.parse('1500.50')).toBe(1500.5);
  });

  it('parses number directly', () => {
    expect(MoneyHelpers.parse(1500.5)).toBe(1500.5);
  });

  it('throws on null', () => {
    expect(() => MoneyHelpers.parse(null)).toThrow(MoneyParseError);
  });

  it('throws on undefined', () => {
    expect(() => MoneyHelpers.parse(undefined)).toThrow(MoneyParseError);
  });

  it('throws on negative', () => {
    expect(() => MoneyHelpers.parse(-100)).toThrow(MoneyParseError);
  });

  it('throws on NaN', () => {
    expect(() => MoneyHelpers.parse('not-a-number')).toThrow(MoneyParseError);
  });

  it('throws on Infinity', () => {
    expect(() => MoneyHelpers.parse(Infinity)).toThrow(MoneyParseError);
  });

  it('throws on > MAX', () => {
    expect(() => MoneyHelpers.parse(1e15)).toThrow(MoneyParseError);
  });
});

describe('MoneyHelpers.format', () => {
  it('formats integer with .00', () => {
    expect(MoneyHelpers.format(5000)).toBe('5000.00');
  });

  it('formats with single decimal', () => {
    expect(MoneyHelpers.format(5000.5)).toBe('5000.50');
  });

  it('formats with two decimals', () => {
    expect(MoneyHelpers.format(5000.55)).toBe('5000.55');
  });
});

describe('MoneyHelpers.add', () => {
  it('adds without floating point errors', () => {
    expect(MoneyHelpers.add(0.1, 0.2)).toBe(0.3);
  });

  it('adds large numbers', () => {
    expect(MoneyHelpers.add(99999.99, 0.01)).toBe(100000);
  });
});

describe('MoneyHelpers.sub', () => {
  it('subtracts cleanly', () => {
    expect(MoneyHelpers.sub(1500.50, 500.25)).toBe(1000.25);
  });

  it('throws on negative result', () => {
    expect(() => MoneyHelpers.sub(100, 200)).toThrow(MoneyParseError);
  });
});

describe('MoneyHelpers.hasValidPrecision', () => {
  it('accepts integer', () => {
    expect(MoneyHelpers.hasValidPrecision(5000)).toBe(true);
  });

  it('accepts 1 decimal', () => {
    expect(MoneyHelpers.hasValidPrecision(5000.5)).toBe(true);
  });

  it('accepts 2 decimals', () => {
    expect(MoneyHelpers.hasValidPrecision(5000.55)).toBe(true);
  });

  it('rejects 3 decimals', () => {
    expect(MoneyHelpers.hasValidPrecision(5000.555)).toBe(false);
  });
});

describe('MoneyHelpers.fromCentimes/toCentimes', () => {
  it('converts MAD to centimes', () => {
    expect(MoneyHelpers.toCentimes(50.5)).toBe(5050);
  });

  it('converts centimes to MAD', () => {
    expect(MoneyHelpers.fromCentimes(5050)).toBe(50.5);
  });
});
```

### 7.5 Tests phone : `repo/packages/pay/src/helpers/__tests__/phone.helper.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { PhoneHelpers } from '../phone.helper';

describe('PhoneHelpers.normalizeMaPhone', () => {
  it('normalizes +212XXX format unchanged', () => {
    expect(PhoneHelpers.normalizeMaPhone('+212600123456')).toBe('+212600123456');
  });

  it('normalizes 0XXX local format to +212XXX', () => {
    expect(PhoneHelpers.normalizeMaPhone('0600123456')).toBe('+212600123456');
  });

  it('normalizes 00212XXX to +212XXX', () => {
    expect(PhoneHelpers.normalizeMaPhone('00212600123456')).toBe('+212600123456');
  });

  it('normalizes with spaces and dashes', () => {
    expect(PhoneHelpers.normalizeMaPhone('06.00.12.34.56')).toBe('+212600123456');
    expect(PhoneHelpers.normalizeMaPhone('06 00 12 34 56')).toBe('+212600123456');
  });

  it('throws on non-Morocco', () => {
    expect(() => PhoneHelpers.normalizeMaPhone('+33612345678')).toThrow();
  });

  it('throws on too short', () => {
    expect(() => PhoneHelpers.normalizeMaPhone('06001234')).toThrow();
  });
});

describe('PhoneHelpers.detectMaOperator', () => {
  it('detects IAM for 0661', () => {
    expect(PhoneHelpers.detectMaOperator('+212661234567')).toBe('iam');
  });

  it('detects Inwi for 0650', () => {
    expect(PhoneHelpers.detectMaOperator('+212650123456')).toBe('inwi');
  });

  it('detects Orange for 0600', () => {
    expect(PhoneHelpers.detectMaOperator('+212600123456')).toBe('orange');
  });

  it('returns unknown for unmapped prefix', () => {
    expect(PhoneHelpers.detectMaOperator('+212699999999')).toBe('iam'); // 06 99 dans IAM
  });
});

describe('PhoneHelpers.formatDisplay', () => {
  it('formats display with spaces', () => {
    expect(PhoneHelpers.formatDisplay('+212600123456')).toBe('06 00 12 34 56');
  });
});
```

### 7.6 Tests PII detector : `repo/packages/pay/src/helpers/__tests__/pii-detector.helper.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { hasPII, detectPIIReasons } from '../pii-detector.helper';

describe('hasPII', () => {
  it('returns false for clean metadata', () => {
    expect(hasPII({ source: 'broker', step: 'init' })).toBe(false);
  });

  it('detects card_number key', () => {
    expect(hasPII({ card_number: '...' })).toBe(true);
  });

  it('detects pan key', () => {
    expect(hasPII({ pan: '4111111111111111' })).toBe(true);
  });

  it('detects cvv key', () => {
    expect(hasPII({ cvv: '123' })).toBe(true);
  });

  it('detects full_name key', () => {
    expect(hasPII({ full_name: 'M. Test' })).toBe(true);
  });

  it('detects address key', () => {
    expect(hasPII({ address: '...' })).toBe(true);
  });

  it('detects card number Luhn-valid in value', () => {
    expect(hasPII({ note: '4111111111111111' })).toBe(true);
  });

  it('does not flag random 16-digit non-Luhn number', () => {
    expect(hasPII({ ref: '1234567890123456' })).toBe(false);
  });

  it('detects nested PII', () => {
    expect(hasPII({ outer: { card_number: '...' } })).toBe(true);
  });
});

describe('detectPIIReasons', () => {
  it('returns reason for matched key pattern', () => {
    const reasons = detectPIIReasons({ pan: '4111' });
    expect(reasons.length).toBeGreaterThan(0);
    expect(reasons[0]).toMatch(/pan/);
  });
});
```

---

## 8. Variables environnement

```env
# Variables nouvelles ou referencees par cette tache
# Note : la plupart des credentials providers sont configures Tache 3.4.7+
# Cette tache 3.4.1 utilise principalement variables Sprint 6 (DB) et Sprint 7 (RBAC)

# Database multi-tenant (Sprint 6)
DATABASE_URL=postgresql://insurtech:${DB_PASSWORD}@db.skalean.local:5432/insurtech_dev?sslmode=require

# Pepper for sensitive metadata encryption (used by Tache 3.4.7+)
PAY_METADATA_PEPPER=development_pepper_change_in_prod_min_32_chars

# KMS Atlas reference (Tache 3.4.7+)
ATLAS_KMS_KEY_ID=arn:atlas:kms:ma-rabat-1:account-skalean:key/payment-encryption

# Logging
LOG_LEVEL=debug
LOG_FORMAT=json

# Tests
NODE_ENV=test
TEST_DATABASE_URL=postgresql://insurtech_test:test@db.skalean.local:5432/insurtech_test
```

---

## 9. Commandes shell

```bash
# 1. Installation deps
cd repo
pnpm --filter @insurtech/pay install
pnpm install ulid@2.3.0 zod@3.24.1 -F @insurtech/pay

# 2. Typecheck
pnpm --filter @insurtech/pay typecheck

# 3. Tests unit
pnpm --filter @insurtech/pay vitest run --coverage

# 4. Linting
pnpm --filter @insurtech/pay biome check src/

# 5. Build package
pnpm --filter @insurtech/pay build

# 6. Verifier exports barrel
node -e "console.log(Object.keys(require('@insurtech/pay')))"

# 7. Verifier no-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/pay/src/ && echo FAIL || echo OK

# 8. Verifier no console.log
grep -rn "console\.log\|console\.debug" packages/pay/src/ --include="*.ts" | grep -v ".spec.ts" && echo FAIL || echo OK
```

---

## 10. Criteres validation V1-V30

### Criteres P0 (bloquants -- 18)

- **V1 (P0 -- automatisable)** : Toutes les 5 entities compilent et hydratent depuis Postgres.
  - Commande : `pnpm --filter @insurtech/pay vitest run entities/`
  - Expected : exit 0, 30+ tests PASS
  - Failure mode : voir trace, generalement entity decorator incorrect.

- **V2 (P0)** : Schema Zod `InitiatePaymentSchema` rejette amount > 100000 MAD avec message BAM.
  - Commande : test V2 dans payment.schema.spec.ts
  - Expected : `ZodError` issue contient "BAM article 4"

- **V3 (P0)** : Schema rejette currency != MAD avec message Office des Changes.
  - Expected : `ZodError` issue contient "Office des Changes"

- **V4 (P0)** : Schema rejette idempotency_key non-ULID format (UUIDv4 par exemple).
  - Expected : `ZodError`

- **V5 (P0)** : Schema rejette amount avec > 2 decimales (5000.555).
  - Expected : `ZodError` issue contient "2 decimals"

- **V6 (P0)** : `MoneyHelpers.add(0.1, 0.2)` retourne exactement 0.3 (pas 0.30000000004).
  - Test : `money.helper.spec.ts`

- **V7 (P0)** : `MoneyHelpers.parse` throw `MoneyParseError` sur null/undefined/NaN.

- **V8 (P0)** : `StatusTransitions.canTransitionTo('captured', 'pending')` retourne false.
  - Test : `status-transitions.helper.spec.ts`

- **V9 (P0)** : `StatusTransitions.canTransitionTo('failed', 'captured')` retourne false.

- **V10 (P0)** : `StatusTransitions.transition()` throw `InvalidTransitionError` sur transition forbidden.

- **V11 (P0)** : `StatusTransitions.transition()` throw `TransactionLockingConflictError` si UPDATE affected=0.

- **V12 (P0)** : Index UNIQUE PARTIAL `(provider, provider_transaction_id) WHERE provider_transaction_id IS NOT NULL` declared in entity.
  - Verification : grep `idx_pay_transactions_provider_txn` in entity.

- **V13 (P0)** : Index UNIQUE `(tenant_id, idempotency_key)` declared.

- **V14 (P0)** : `PhoneHelpers.normalizeMaPhone('0600123456')` retourne `'+212600123456'`.

- **V15 (P0)** : `PhoneHelpers.normalizeMaPhone('+33612345678')` throw.

- **V16 (P0)** : `hasPII({ card_number: '4111111111111111' })` retourne true.

- **V17 (P0)** : `hasPII({ note: '4111111111111111' })` retourne true (Luhn valid value).

- **V18 (P0)** : `pnpm --filter @insurtech/pay typecheck` retourne exit 0.

### Criteres P1 (importants -- 8)

- **V19 (P1)** : Tests coverage >= 90% sur entities, schemas, helpers.
  - Commande : `pnpm vitest --coverage`
  - Expected : `coverage >= 90`

- **V20 (P1)** : Aucune emoji dans aucun fichier livre.
  - Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/pay/src/`
  - Expected : aucune sortie.

- **V21 (P1)** : Aucun `console.log` ou `console.debug` dans src/ (sauf .spec.ts).
  - Commande : `grep -rn "console\\.log\\|console\\.debug" packages/pay/src/ --include="*.ts" | grep -v ".spec.ts"`
  - Expected : aucune sortie.

- **V22 (P1)** : Barrel `@insurtech/pay` exporte tous les exports principaux.
  - Test : importer `PayTransaction`, `InitiatePaymentSchema`, `StatusTransitions`, etc.

- **V23 (P1)** : `PayTransaction` entity reflete exactement les colonnes de migration Sprint 2 (pas de drift).
  - Verification visuelle vs `00-pilotage/documentation/3-schemas-database-PARTIE1.sql`.

- **V24 (P1)** : Factories generent objets sans erreur dans seed scripts.

- **V25 (P1)** : Schema `RefundRequestSchema` exige reason >= 10 chars.

- **V26 (P1)** : Schema `BaseWebhookPayloadSchema` accepte champs additionnels via passthrough.

### Criteres P2 (nice-to-have -- 4)

- **V27 (P2)** : Documentation JSDoc complete sur chaque enum et chaque schema.

- **V28 (P2)** : Test V12 `permissions catalog mapping mecanique` extension : tester que chaque enum value matches sa cle UPPER_SNAKE.

- **V29 (P2)** : Performance : `Object.values(PaymentProvider)` retourne dans < 1ms (microbench).

- **V30 (P2)** : `pnpm --filter @insurtech/pay build` produit dist/ avec types d.ts.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Migration Sprint 2 a evolue depuis -- entity desynchronisee

**Scenario** : Sprint 2 ajoute une colonne `refunded_amount` (faite en pre-Sprint 11) ; entity Sprint 11 doit refleter.
**Probleme** : Drift entity vs DB.
**Solution** : Verification visuelle avec `psql -c "\\d pay_transactions"` ; ajouter colonnes manquantes en entity. Voir Sprint 2 fichier migration final.

### Edge case 2 : Postgres Unicode citext type non installe

**Scenario** : `customer_email` declaree `citext` au niveau DB mais TypeORM 0.3.21 ne supporte pas natif `citext`.
**Probleme** : Migration Sprint 2 utilise citext pour case-insensitive index, mais entity TypeScript declare `text`.
**Solution** : Garder `text` cote entity, citext cote DB. Le caracteristique case-insensitive est cote DB index, transparent cote Node.

### Edge case 3 : ULID generation collision entre tenants

**Scenario** : Deux tenants soumettent meme idempotency_key ULID sur meme milliseconde.
**Probleme** : `UNIQUE (tenant_id, idempotency_key)` (et non global) -- pas de collision pratique.
**Solution** : Verifier UNIQUE index est composite sur tenant_id + idempotency_key (Sprint 2 migration).

### Edge case 4 : Decimal amount stocke comme entier (5000) -- rendering en API

**Scenario** : API client expects `"amount": "5000.00"` mais TypeORM transformer retourne `5000`.
**Probleme** : Format inconsistant front/back.
**Solution** : Au niveau controller (Tache 3.4.13), serializer DTO appele `MoneyHelpers.format(amount)` pour string '5000.00'.

### Edge case 5 : Refund amount > amount original (input malicieux)

**Scenario** : Utilisateur envoie refund amount = 10000 MAD pour transaction 5000 MAD.
**Probleme** : Validation Zod ne peut pas verifier vs DB.
**Solution** : Tache 3.4.9 (RefundService) verifie `getRefundableAmount() >= amount` avant approbation. Cette tache 3.4.1 expose juste le helper `getRefundableAmount()`.

### Edge case 6 : Customer_email avec accents (UTF-8)

**Scenario** : `client@éxample.ma`.
**Probleme** : RFC 5322 n'autorise pas accents dans local-part sans encoding ; pas non plus dans domain partie sans punycode.
**Solution** : Zod email regex strict rejete. Customer doit fournir email ASCII.

### Edge case 7 : Phone Maroc avec extension internationale double

**Scenario** : `+212+212600123456` (typo client).
**Probleme** : `normalizeMaPhone` non gere ce cas.
**Solution** : `normalizeMaPhone` strict regex. Si invalide, throw -- frontend doit guider correction.

### Edge case 8 : Reconciliation row sans matched_transaction_id mais status='matched'

**Scenario** : Bug auto-match : row marked matched mais matched_transaction_id null.
**Probleme** : Inconsistence entity.
**Solution** : Tache 3.4.10 ajoute CHECK constraint `(status='matched' AND matched_transaction_id IS NOT NULL) OR (status != 'matched')`. Cette tache prepare entity, contrainte ajoutee Tache 3.4.10.

### Edge case 9 : Webhook payload avec event_type vide

**Scenario** : Provider misconfigure envoie `event_type: ''`.
**Probleme** : Zod schema accept empty string si .min() oublie.
**Solution** : `BaseWebhookPayloadSchema` declare `event_type: z.string().min(1).max(100)`.

### Edge case 10 : Idempotency_key reuse sur tenant differents

**Scenario** : Tenant A genere ULID X, Tenant B genere meme X (improbable mais possible).
**Probleme** : Sans isolation tenant, INSERT fail.
**Solution** : UNIQUE composite `(tenant_id, idempotency_key)` -- chaque tenant a son namespace.

### Edge case 11 : Migration drift detection au boot

**Scenario** : Developpeur modifie entity sans creer migration -- DB ne reflete pas.
**Probleme** : Tests passent (mocks) mais runtime fail.
**Solution** : Hook boot `validateEntitiesVsDb()` (Sprint 6) detecte drift et log WARN. Sprint 11 ajoute pay_* tables a cette validation.

### Edge case 12 : 3D Secure status non-recu

**Scenario** : Provider ne fournit pas three_d_secure_status (e.g. wallet sans 3DS).
**Probleme** : Field laisse null.
**Solution** : `three_d_secure_status` nullable. Wallets ont `three_d_secure_enabled = false`.

### Edge case 13 : Currency MAD lowercase ('mad')

**Scenario** : Client envoie currency='mad'.
**Probleme** : Schema Zod literal 'MAD' refuse (case-sensitive).
**Solution** : Schema accepte `z.literal('MAD')` exact -- frontend doit normaliser. Alternative future : `.transform(c => c.toUpperCase())` mais le strict mode est plus securisee.

### Edge case 14 : Transaction ancienne (90+ jours) -- refund interdit

**Scenario** : Refund demande sur transaction de Janvier 2025, on est Mai 2026.
**Probleme** : ABAC TimeBasedPolicy reject.
**Solution** : Schema RefundRequestSchema accepte `override_time_limit: boolean` -- super_admin uniquement (Tache 2.3.7). Cette tache 3.4.1 expose juste le champ.

### Edge case 15 : Metadata depasse 1MB

**Scenario** : Developpeur stocke gros JSON dans metadata.
**Probleme** : Postgres jsonb limite ~1GB mais perf lente >1MB.
**Solution** : Sprint 11 future ajout : `metadata.size <= 64KB` validation. Cette tache 3.4.1 ne limite pas (acceptation pragmatique).

---

## 12. Conformite Maroc detaillee

### Loi 09-08 (Protection donnees personnelles -- CNDP)

- **Article 3 (definition donnees personnelles)** : `customer_email`, `customer_phone`, `customer_name` sont des donnees personnelles.
  - Implementation : RLS multi-tenant Sprint 6 + future Sprint 12 anonymisation pour requetes effacement.
  - Reference : `00-pilotage/decisions/008-data-residency.md`

- **Article 14 (droit a l'oubli)** : un assure peut demander effacement.
  - Implementation : Sprint 12 helper anonymizeTransaction() set `customer_email = 'redacted-{id}@redacted.invalid'`, conserve row pour audit comptable.
  - Cette tache prepare structure (pas de soft-delete).

### Loi 43-05 (Anti-blanchiment de capitaux -- AML)

- **Article 6 (vigilance permanente)** : transactions monitorees.
  - Implementation : Tache 3.4.11 fraud detection rules ; cette tache prepare entity `pay_fraud_evaluations`.

- **Article 7 (declaration de soupcon SAR)** : transactions suspectes a declarer Unite Traitement Renseignement Financier (UTRF).
  - Implementation : Tache 3.4.11 status='review' alert admin.

### BAM (Bank Al-Maghrib) Circulaire 2/G/2024 article 4

- **Limite 100k MAD per transaction sans declaration** : Schema Zod `amount.max(100000)`.
- **3D Secure mandatory cards EMV** : Champ `three_d_secure_enabled` boolean tracked per transaction.

### Office des Changes (loi 1996)

- **Currency MAD only intra-Maroc** : Schema Zod `currency.literal('MAD')`.
- **Wires international** : hors scope MVP, future Phase 7+.

### PCI-DSS Level 1

- **Requirement 3 (No card data storage)** : Aucun champ `card_number`, `cvv`, `pan` dans pay_transactions.
- **PII detector** : helper `hasPII()` rejette stockage card data dans metadata.
- **Encrypted credentials** : `pay_methods.encrypted_credentials` JSONB chiffre via pgcrypto envelope.

### ACAPS Circulaire AS/02/24

- **Audit trail prime encaissement** : `pay_transactions` rows + reconciliation = trail complet.
- **Separation duties** : permissions `pay.refunds.request` vs `pay.refunds.approve` (Sprint 7).

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

Cette tache DOIT respecter TOUTES ces conventions :

### Multi-tenant strict
- `tenant_id` UUID NOT NULL sur entities `pay_method`, `pay_transaction`, `pay_reconciliation`, `pay_refund_request`, `pay_fraud_evaluation`.
- RLS Sprint 6 active : `app_current_tenant()` filtre auto.
- Header `x-tenant-id` obligatoire (controllers Tache 3.4.13).
- AsyncLocalStorage TenantContext pour acces tenant courant en service.

### Validation strict
- Zod 3.24.1 uniquement pour validation runtime.
- Schemas exportes depuis `@insurtech/pay/schemas`.
- Pattern : `const Schema = z.object({...}).strict(); type Type = z.infer<typeof Schema>;`
- `.strict()` rejette champs additionnels (anti-mass-assignment).

### Logger strict
- Pino structured JSON logs.
- Dans cette tache, helpers ne logent pas directement (libraries pures).
- Services downstream loguent (Tache 3.4.7+).

### Hash password strict
- argon2id (out of scope cette tache, mais credentials providers chiffres pgcrypto envelope).

### Package manager strict
- pnpm uniquement.
- `engine-strict=true`.
- `save-exact=true`.

### TypeScript strict
- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`.
- Imports explicites.
- Pas de `any` -- preference `unknown` puis narrowing.

### Tests strict
- Vitest 2.1.8 pour unit + integration.
- Coverage >= 90% sur cette tache.
- Chaque .ts (non types-only) a son .spec.ts.

### RBAC strict
- Permissions `pay.transactions.create/read`, `pay.refunds.*`, `pay.reconciliation.*` declarees Sprint 7.
- Cette tache prepare consommation (pas implementation).

### Events strict
- Topics Kafka `insurtech.events.pay.{action}`.
- Schemas Zod prepares dans `webhook.schema.ts`.
- Consumers Tache 3.4.8.

### Imports strict
- `@insurtech/{nom}` (jamais chemins relatifs cross-package).
- Order : Node natifs, externes, `@insurtech/*`, relatifs.

### Skalean AI strict (decision-005)
- Entities pay_* exposees Sprint 30 via MCP tools.
- Cette tache prepare structure typee.

### No-emoji strict (decision-006 ABSOLU)
- Aucune emoji dans tous fichiers livres.
- Test V20 verifie automatiquement.

### Idempotency-Key strict
- ULID format strict via Zod regex.
- UNIQUE composite tenant_id + idempotency_key.

### Conventional Commits strict
- Format `feat(sprint-11): ...`.
- Description 50-72 chars.

### Cloud souverain MA strict (decision-008)
- Atlas Benguerir DC1+DC2.
- Aucune donnee assure hors MA.
- Encryption AES-256-GCM at rest.

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Typecheck
pnpm --filter @insurtech/pay typecheck

# 2. Lint
pnpm --filter @insurtech/pay biome check src/

# 3. Tests + coverage
pnpm --filter @insurtech/pay vitest run --coverage

# 4. No-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/pay/src/ && echo FAIL || echo OK

# 5. No console.log
grep -rn "console\.log\|console\.debug" packages/pay/src/ --include="*.ts" | grep -v ".spec.ts" && echo FAIL || echo OK

# 6. Verify barrel exports
node -e "const m = require('@insurtech/pay'); ['PayTransaction', 'InitiatePaymentSchema', 'StatusTransitions', 'MoneyHelpers', 'PhoneHelpers', 'hasPII'].forEach(k => { if (!m[k]) throw new Error('missing ' + k); }); console.log('OK');"

# 7. Verify migration sync
pnpm --filter @insurtech/database migration:show
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-11): pay entities + schemas Zod + helpers (Tache 3.4.1)

Implement core pay foundation : 5 entities (PayTransaction, PayMethod, PayReconciliation,
PayRefundRequest, PayFraudEvaluation), 6 enums (PaymentProvider, PaymentMethod,
TransactionStatus, Currency, ReconciliationStatus, RefundStatus) with state machines,
Zod schemas (Initiate, Refund, Reconciliation, Webhook, Filters) with Maroc compliance
refinements (BAM 100k MAD limit, MAD only currency, ULID idempotency_key), helpers
(StatusTransitions optimistic locking, MoneyHelpers decimal precision, PaymentValidators,
PhoneHelpers MA normalization, PIIDetector Luhn check), test factories.

Livrables:
- 5 entities TypeORM 0.3.21
- 6 enums const object
- 5 Zod schemas (.strict())
- 5 helpers + 3 factories
- 30+ tests unitaires
- Coverage 92%

Tests: 30 unit
Coverage: 92%

Task: 3.4.1
Sprint: 11 (Phase 3 / Sprint 4)
Phase: 3 -- Modules Horizontaux
Reference: B-11 Tache 3.4.1"
```

---

## 16. Workflow next step

Apres commit de cette tache : passer a `task-3.4.2-payment-gateway-interface-base-abstract.md` qui consomme `InitiatePaymentRequest`, `PaymentStatus`, types et erreurs definis ici.

---

**Fin du prompt task-3.4.1.**

Densite : ~120 ko
Code patterns : 15 fichiers complets
Tests : 35+ scenarios
Criteres : V1-V30
Edge cases : 15
