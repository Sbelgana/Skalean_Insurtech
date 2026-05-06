# META-PROMPT B-12 -- SPRINT 12 BOOKS + COMPLIANCE ACAPS

**Version** : v2.2 (Option B)
**Phase** : 3 -- Modules Horizontaux
**Sprint** : 12 / 35 (cumul) -- Phase 3 Sprint 5
**Position** : Apres Pay multi-MA, avant Analytics+Stock+HR
**Numerotation taches** : 3.5.1 a 3.5.13
**Effort total** : ~75 heures developpement / 2 semaines
**Priorite** : P0 (compliance ACAPS bloquant pour vertical Insure Phase 4)

---

## Objectif Global du Sprint

Implementer **comptabilite + compliance** : Plan comptable marocain CGNC (Code General Normalisation Comptable), generation auto ecritures depuis transactions Pay (Sprint 11), TVA marocaine (20% standard + 14%/10%/7%/0%), factures conformes DGI (Direction Generale Impots), reports ACAPS pour Vertical Insure (trimestriel + annuel), anti-blanchiment AMC (Autorite Marocaine du Capital), export SAFT-MA pour audits fiscaux.

A la sortie de ce sprint :
- Plan comptable CGNC complete (classes 1-9) charge en DB
- 4 entites operationnelles : `books_journal_entries`, `books_invoices`, `compliance_acaps_reports`, `compliance_aml_alerts`
- Auto-creation ecritures depuis events Pay (consumer Kafka)
- Factures fiscales conformes : ICE + RC + patente + TVA + montants HT/TTC + signature electronique
- Reports ACAPS trimestriel : portefeuille polices + sinistres + solvabilite
- Reports annuels : bilan + compte resultat + annexes ACAPS-specific
- AML monitoring : detection patterns suspects + declaration soupçon AMC
- Audit trail comptable preserve 10 ans (loi fiscale MA)
- Export SAFT-MA : XML standardise pour controles DGI
- 30+ tests E2E avec fixtures realistes

---

## Frontiere du Sprint

**INCLUS** :
- Plan comptable CGNC (chart of accounts marocain)
- Journal entries CRUD + auto-generation depuis Pay events
- Factures conformes DGI + numerotation legale
- TVA management (5 taux MA)
- Reports ACAPS framework + 2 reports initiaux
- AML rules engine basique
- SAFT-MA export
- Audit trail 10 ans

**EXCLU** (sera ajoute aux sprints suivants) :
- Reports ACAPS exhaustifs (Sprint 14+ Insure Foundation enrichira selon polices)
- Bilan consolide multi-tenants (Phase 7+)
- Liaisons banques API (Phase 7+)
- IA-powered anomaly detection (Sprint 30+)
- Reports CIH (Centre Informatique Hospitalier) sante -- Phase 4+

---

## Lectures Prealables Obligatoires

1. `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` -- tables books_*, compliance_*
2. `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` -- regles compliance ACAPS
3. Sortie Sprint 10 : Docs (PDF factures + signature)
4. Sortie Sprint 11 : Pay events captured -> generate ecritures
5. CGNC Plan Comptable General Marocain (document officiel)

---

## Stack Imposee (Sprint 12)

| Composant | Version | Notes |
|-----------|---------|-------|
| decimal.js | 10.4.3 | precision arithmetique comptable (vs float) |
| date-fns | 4.1.0 | periode comptable / exercice |
| xml2js | 0.6.2 | SAFT-MA XML generation |
| zod | 3.24.1 | validation reports ACAPS |

---

## Vue d'Ensemble des 13 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 3.5.1 | Plan Comptable CGNC seed + entity AccountChart | 5h | P0 | Sprint 11 |
| 3.5.2 | books_journal_entries entity + JournalService | 6h | P0 | 3.5.1 |
| 3.5.3 | Auto-generation ecritures depuis Pay events (consumer Kafka) | 6h | P0 | 3.5.2 |
| 3.5.4 | TVA Service + 5 taux MA + calcul HT/TTC | 5h | P0 | 3.5.3 |
| 3.5.5 | Invoices module : numerotation legale + ICE/RC/patente + format DGI | 7h | P0 | 3.5.4 |
| 3.5.6 | Bilan + compte resultat generation | 5h | P0 | 3.5.5 |
| 3.5.7 | ACAPS Report framework + entity compliance_acaps_reports | 5h | P0 | 3.5.6 |
| 3.5.8 | Report trimestriel : Portefeuille polices + sinistres | 6h | P0 | 3.5.7 |
| 3.5.9 | Report annuel : Solvabilite + reserves techniques | 6h | P0 | 3.5.8 |
| 3.5.10 | AML monitoring + rules + alertes AMC declaration | 5h | P0 | 3.5.9 |
| 3.5.11 | SAFT-MA export XML pour controles DGI | 5h | P0 | 3.5.10 |
| 3.5.12 | Endpoints REST `/api/v1/books/*` + `/compliance/*` + scheduled jobs reports | 5h | P0 | 3.5.11 |
| 3.5.13 | Tests E2E (30+) + fixtures realistes + seeds plan comptable | 7h | P0 | 3.5.12 |

**Total** : 73 heures.

---

# DETAIL DES 13 TACHES

---

## Tache 3.5.1 -- Plan Comptable CGNC Seed + AccountChart Entity

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 5h / Depend de Sprint 11

**But** : Charger le **Plan Comptable General Marocain (CGNC)** complet : classes 1-9 + sous-comptes standards + comptes specifiques metier insurtech.

**Contexte** : CGNC = norme comptable obligatoire MA (loi 9-88 modifiee). 9 classes : 1-Financement permanent, 2-Actif immobilise, 3-Stocks, 4-Tiers (clients/fournisseurs), 5-Tresorerie, 6-Charges, 7-Produits, 8-Resultats, 9-Comptes analytiques. Chaque tenant herite plan standard + peut creer sous-comptes customs (Sprint 27 admin).

**Livrables checkables** :
- [ ] Entity `repo/packages/books/src/entities/books-account.entity.ts` :
  - id, tenant_id (NULL = compte standard CGNC, sinon custom tenant), code (e.g. '411' clients), label, parent_account_id (FK self), level (int), class_number (1-9), nature (enum 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'), is_standard (bool), active (bool)
- [ ] Migration TypeORM table `books_accounts`
- [ ] Seed `seed-cgnc-plan.ts` : ~250 comptes standards CGNC (classes 1-9 hierarchique)
- [ ] Seed comptes specifiques insurtech :
  - 411 Clients
  - 4111 Clients - Particuliers
  - 4112 Clients - Entreprises
  - 442 Fournisseurs (assureurs partenaires)
  - 4421 Wafa Assurance
  - 4422 Atlanta Assurance
  - 4423 Saham
  - 4424 RMA
  - 4425 AXA
  - 706 Prestations services (commissions courtier)
  - 7061 Commissions auto
  - 7062 Commissions sante
  - etc.
- [ ] Service `repo/packages/books/src/services/account-chart.service.ts` :
  - `findByCode(code, tenantId)` -- standard ou custom
  - `getHierarchy()` -- arbre complet
  - `createCustomAccount(parentCode, code, label)` -- creer sous-compte
- [ ] Endpoint `GET /api/v1/books/accounts` (liste avec hierarchy)
- [ ] Endpoint `POST /api/v1/books/accounts` (custom)
- [ ] Tests : seed reussit, lookup par code OK, hierarchy correct

**Pattern critique : structure CGNC classes**

```typescript
// repo/packages/books/src/seeds/cgnc-classes.ts
export const CGNC_CLASSES = [
  // Classe 1 - Financement permanent
  { code: '1', label: 'Financement Permanent', nature: 'liability' },
  { code: '11', label: 'Capitaux Propres', parent: '1' },
  { code: '111', label: 'Capital Social', parent: '11' },
  { code: '116', label: 'Resultat Net en instance', parent: '11' },

  // Classe 2 - Actif immobilise
  { code: '2', label: 'Actif Immobilise', nature: 'asset' },
  { code: '21', label: 'Immobilisations en non-valeurs', parent: '2' },
  { code: '22', label: 'Immobilisations Incorporelles', parent: '2' },
  { code: '23', label: 'Immobilisations Corporelles', parent: '2' },

  // Classe 3 - Stocks
  { code: '3', label: 'Stocks', nature: 'asset' },

  // Classe 4 - Comptes de tiers
  { code: '4', label: 'Comptes de Tiers', nature: 'asset' },
  { code: '41', label: 'Clients et comptes rattaches', parent: '4' },
  { code: '411', label: 'Clients', parent: '41' },
  { code: '4411', label: 'Fournisseurs', parent: '4' },

  // Classe 5 - Tresorerie
  { code: '5', label: 'Tresorerie', nature: 'asset' },
  { code: '51', label: 'Tresorerie - Actif', parent: '5' },
  { code: '514', label: 'Banques', parent: '51' },
  { code: '5141', label: 'Banques (Compte courant)', parent: '514' },
  { code: '516', label: 'Caisses, Regies d\'avances et accreditifs', parent: '51' },

  // Classe 6 - Charges
  { code: '6', label: 'Charges', nature: 'expense' },
  { code: '61', label: 'Charges d\'exploitation', parent: '6' },
  { code: '6111', label: 'Achats de marchandises', parent: '61' },
  { code: '6125', label: 'Achats consommes de matieres et fournitures', parent: '61' },

  // Classe 7 - Produits
  { code: '7', label: 'Produits', nature: 'revenue' },
  { code: '71', label: 'Produits d\'exploitation', parent: '7' },
  { code: '711', label: 'Ventes de marchandises', parent: '71' },
  { code: '7111', label: 'Ventes au Maroc', parent: '711' },

  // Classe 8 - Resultats
  { code: '8', label: 'Resultats' },

  // Classe 9 - Comptabilite analytique (optional, courtage rarely uses)
  { code: '9', label: 'Comptabilite Analytique' },
];
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-BooksAccounts.ts                # ~50 lignes
repo/packages/books/src/entities/books-account.entity.ts                      # ~50 lignes
repo/packages/books/src/seeds/cgnc-classes.ts                                  # ~250 comptes standards
repo/packages/books/src/seeds/insurtech-accounts.ts                            # ~30 comptes insurtech-specific
repo/packages/books/src/services/account-chart.service.ts                      # ~200 lignes
repo/infrastructure/scripts/seed-cgnc-plan.ts                                  # ~80 lignes
repo/apps/api/src/modules/books/controllers/accounts.controller.ts            # ~100 lignes
```

**Notes implementation** :
- Plan standard `tenant_id IS NULL` : visible tous tenants (lecture)
- Custom accounts par tenant : herite standard + add sous-comptes
- Hierarchy : `level` calcule auto (longueur code), `parent_account_id` FK
- Comptes 4421-4425 (assureurs) : insurtech-specific permettent suivi commissions per partner
- Sprint 14+ Insure ajoutera comptes specifiques lifecycle police (provisions techniques, etc.)

**Criteres validation** :
- V1 (P0) : Seed CGNC reussi (250+ comptes)
- V2 (P0) : Hierarchy correct (parent/child)
- V3 (P0) : Comptes insurtech presents (4421-4425, 706x)
- V4 (P0) : Custom account creation par tenant OK
- V5 (P0) : findByCode OK avec lookup standard + custom
- V6 (P0) : Tests 8+ scenarios

---

## Tache 3.5.2 -- books_journal_entries Entity + JournalService

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 6h / Depend de 3.5.1

**But** : Implementer ecritures comptables : double-entry bookkeeping (debit/credit), journal entries balanced, validation rules.

**Livrables checkables** :
- [ ] Entity `repo/packages/books/src/entities/books-journal-entry.entity.ts` :
  - id, tenant_id, journal_code (e.g. 'VEN' ventes, 'ACH' achats, 'BNQ' banque, 'OD' operations diverses), entry_number (unique sequentiel par tenant + exercise), entry_date (date comptable), reference (lien doc source : invoice_id, transaction_id), description, status (enum 'draft' | 'validated' | 'reversed'), created_by, validated_by, validated_at, exercise_year (int), period_month (1-12)
- [ ] Entity `repo/packages/books/src/entities/books-journal-line.entity.ts` :
  - id, journal_entry_id (FK), line_number, account_code (FK books_accounts.code), label, debit (numeric 15,2 default 0), credit (numeric 15,2 default 0), CHECK (debit > 0 OR credit > 0)
- [ ] Migrations TypeORM
- [ ] Service `journal.service.ts` :
  - `createEntry(data, lines): Promise<JournalEntry>` -- valide balanced (sum debits = sum credits), set entry_number sequentiel
  - `validateEntry(id)` -- transition draft -> validated (immutable apres)
  - `reverseEntry(id, reason)` -- cree contre-ecriture (audit + new entry status='validated')
  - `findAll(filters, pagination)`
  - `findById(id)` (avec lines)
- [ ] Validation : double-entry balanced (sum debits = sum credits) sinon BadRequestException
- [ ] Validation : tous accounts existent (FK + active)
- [ ] Validation : entry_date dans exercice fiscal courant ou precedent (pas dans futur, pas trop ancien)
- [ ] Status transitions strictes : draft -> validated terminal (pas de retour, sauf reverse)
- [ ] Endpoints :
  - `POST /api/v1/books/journal-entries` (create draft)
  - `GET /api/v1/books/journal-entries` (filters : journal_code, date_range, account_code, status)
  - `GET /api/v1/books/journal-entries/:id`
  - `POST /api/v1/books/journal-entries/:id/validate`
  - `POST /api/v1/books/journal-entries/:id/reverse`
- [ ] Permissions : `books.journal_entries.create/validate/reverse`
- [ ] Audit + Kafka events
- [ ] Tests : double-entry validation, balanced check, reverse flow

**Pattern critique : double-entry validation**

```typescript
// repo/packages/books/src/services/journal.service.ts
async createEntry(data: CreateJournalEntryDto): Promise<JournalEntry> {
  // 1. Validate double-entry balanced
  const totalDebit = data.lines.reduce((sum, l) => sum.plus(l.debit ?? 0), new Decimal(0));
  const totalCredit = data.lines.reduce((sum, l) => sum.plus(l.credit ?? 0), new Decimal(0));

  if (!totalDebit.equals(totalCredit)) {
    throw new BadRequestException({
      code: 'JOURNAL_NOT_BALANCED',
      message: `Debits (${totalDebit.toFixed(2)}) != Credits (${totalCredit.toFixed(2)})`,
    });
  }

  if (totalDebit.isZero()) {
    throw new BadRequestException({ code: 'JOURNAL_EMPTY' });
  }

  // 2. Validate accounts exist + active
  const accountCodes = data.lines.map(l => l.accountCode);
  const accounts = await this.accountService.findByCodes(accountCodes);
  const missing = accountCodes.filter(c => !accounts.find(a => a.code === c));
  if (missing.length > 0) {
    throw new BadRequestException({ code: 'ACCOUNT_NOT_FOUND', missing });
  }

  // 3. Generate entry_number sequentiel par tenant + exercice + journal
  const entryNumber = await this.getNextEntryNumber(getCurrentTenantId()!, data.exerciseYear, data.journalCode);

  // 4. Insert dans transaction
  return await this.dataSource.transaction(async (em) => {
    const entry = await em.save(JournalEntry, {
      tenant_id: getCurrentTenantId(),
      journal_code: data.journalCode,
      entry_number: entryNumber,
      entry_date: data.entryDate,
      reference: data.reference,
      description: data.description,
      status: 'draft',
      created_by: getCurrentUserId(),
      exercise_year: data.exerciseYear,
      period_month: data.entryDate.getMonth() + 1,
    });

    for (let i = 0; i < data.lines.length; i++) {
      const line = data.lines[i];
      await em.save(JournalLine, {
        journal_entry_id: entry.id,
        line_number: i + 1,
        account_code: line.accountCode,
        label: line.label,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
      });
    }

    return entry;
  });
}
```

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-BooksJournalEntries.ts          # ~80 lignes
repo/packages/books/src/entities/books-journal-entry.entity.ts                # ~50 lignes
repo/packages/books/src/entities/books-journal-line.entity.ts                  # ~30 lignes
repo/packages/books/src/services/journal.service.ts                            # ~280 lignes
repo/packages/books/src/services/journal-numbering.service.ts                  # ~80 lignes (sequentiel)
repo/apps/api/src/modules/books/controllers/journal-entries.controller.ts     # ~150 lignes
```

**Notes implementation** :
- decimal.js critical : `0.1 + 0.2 = 0.30000000000000004` en float = catastrophe comptable
- entry_number sequentiel : `JournalCode-Year-Sequence` (e.g. `VEN-2026-00001`) -- audit DGI
- Status validated immutable : reverse cree contre-ecriture (preserve audit trail)
- Validation entry_date : pas dans futur, range exercice courant + precedent
- Indexes critique : `(tenant_id, journal_code, entry_number) UNIQUE` pour numerotation, `(tenant_id, entry_date)` pour reports

**Criteres validation** :
- V1 (P0) : Entry balanced (debits = credits) accepte
- V2 (P0) : Entry imbalanced rejete avec details
- V3 (P0) : Entry vide rejete
- V4 (P0) : Account inconnu rejete
- V5 (P0) : entry_number sequentiel par tenant+exercice+journal
- V6 (P0) : Validate transition draft -> validated immutable
- V7 (P0) : Reverse cree contre-ecriture
- V8 (P0) : Multi-tenant + RBAC
- V9 (P0) : Tests 12+ scenarios

---

## Tache 3.5.3 -- Auto-Generation Ecritures depuis Pay Events

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 6h / Depend de 3.5.2

**But** : Consumer Kafka qui ecoute events `pay.transaction_captured` (Sprint 11) + auto-genere ecriture comptable correspondante.

**Contexte** : Chaque encaissement client doit avoir son ecriture comptable. Manuelle = erreur humaine + retard. Auto = real-time + impossible d'oublier.

**Livrables checkables** :
- [ ] Consumer `repo/packages/books/src/consumers/pay-to-journal.consumer.ts` extends KafkaConsumerBase
- [ ] Topic : `insurtech.events.pay.transaction_captured`
- [ ] Pattern ecriture standard (encaissement client) :
  - Debit : 5141 Banques OU 5161 Caisse (selon provider) -> montant TTC
  - Credit : 411 Clients (compte general) OU sous-compte specifique -> montant TTC
- [ ] Si transaction liee a invoice : reverse la creance precedente
- [ ] Mapping providers -> comptes :
  - cmi/youcan_pay/payzone : 5141 (banque)
  - inwi_money/orange_money/mwallet_bam : 5141 (mobile money = compte banque associee tenant)
  - cash kiosque payzone : 5161 (caisse)
- [ ] Auto-validation ecriture (status='validated' direct car automatique + traceable)
- [ ] Reference : transaction_id Pay
- [ ] Description : "Encaissement transaction {provider} {provider_transaction_id}"
- [ ] Idempotency : `(tenant_id, reference, type='auto_pay_capture')` UNIQUE evite double-creation
- [ ] Logs : ecriture cree
- [ ] Tests : Pay event -> ecriture cree avec bon comptes + balanced

**Pattern critique : consumer auto-generation ecriture**

```typescript
// repo/packages/books/src/consumers/pay-to-journal.consumer.ts
@Injectable()
export class PayToJournalConsumer extends KafkaConsumerBase<PayCapturedEvent> {
  topic = Topics.PAY_TRANSACTION_CAPTURED;
  groupId = 'books-pay-to-journal';

  async handle(event: KafkaEnvelope<PayCapturedEvent>): Promise<void> {
    const { transactionId, tenantId, provider, amount, customerEmail } = event.data;

    // Idempotency check
    const existing = await this.journalRepo.findOne({
      where: { tenant_id: tenantId, reference: `pay:${transactionId}` },
    });
    if (existing) {
      logger.info({ msg: 'pay_journal_already_exists', transactionId });
      return;
    }

    // Determine accounts
    const debitAccount = ['cmi', 'youcan_pay', 'inwi_money', 'orange_money', 'mwallet_bam'].includes(provider)
      ? '5141' : '5161';
    const creditAccount = '411'; // Client generique (sous-compte si client identifie)

    // Run dans tenant context
    await this.tenantContext.runWithContext(
      { tenantId, isSuperAdmin: false, traceId: event.headers.trace_id, /* ... */ },
      async () => {
        await this.journalService.createEntry({
          journalCode: 'BNQ',
          entryDate: new Date(event.data.capturedAt),
          reference: `pay:${transactionId}`,
          description: `Encaissement ${provider} - ${customerEmail}`,
          exerciseYear: new Date(event.data.capturedAt).getFullYear(),
          autoValidate: true, // status validated direct
          lines: [
            { accountCode: debitAccount, label: 'Banque encaissement', debit: amount, credit: 0 },
            { accountCode: creditAccount, label: `Client ${customerEmail}`, debit: 0, credit: amount },
          ],
        });
      },
    );
  }
}
```

**Fichiers crees / modifies** :
```
repo/packages/books/src/consumers/pay-to-journal.consumer.ts                  # ~200 lignes
repo/packages/books/src/consumers/pay-to-journal.consumer.spec.ts             # ~150 lignes
repo/packages/books/src/services/journal-templates.service.ts                  # ~150 lignes (templates standards)
repo/packages/books/src/types/journal-templates.ts                              # types
```

**Notes implementation** :
- Idempotency via reference UNIQUE : event Kafka redelivered ne double pas
- Running tenant context in consumer : critical (consumers async sans request context)
- Auto-validate : status='validated' direct (audit trail = consumer DI sans modification humaine)
- Sprint 14+ Insure enrichira : event `insure.policy_signed` -> ecriture commission, etc.

**Criteres validation** :
- V1 (P0) : Pay captured event -> ecriture creee
- V2 (P0) : Comptes corrects (debit banque, credit client)
- V3 (P0) : Idempotency : 2 events meme transactionId -> 1 ecriture
- V4 (P0) : Multi-tenant context propage
- V5 (P0) : Mapping provider -> compte correct
- V6 (P0) : Cash kiosque -> 5161 caisse
- V7 (P0) : Tests 8+ scenarios

---

## Tache 3.5.4 -- TVA Service + 5 Taux MA

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 5h / Depend de 3.5.3

**But** : Service TVA marocaine : 5 taux (0%, 7%, 10%, 14%, 20%) + calcul HT/TVA/TTC + declaration mensuelle TVA preparation.

**Livrables checkables** :
- [ ] Service `repo/packages/books/src/services/tva.service.ts`
- [ ] Methods :
  - `calculateTtc(montantHt, taux): { ht, tva, ttc }` -- decimal.js precision
  - `calculateHt(montantTtc, taux): { ht, tva, ttc }`
  - `getTaux(productCategory): TauxTva` -- mapping categorie -> taux
- [ ] Taux MA :
  - 0% : exoneration (export, prestations medicales)
  - 7% : eau, gaz, electricite, produits pharmaceutiques
  - 10% : huile alimentaire, sel, riz
  - 14% : transports voyageurs, beurre, energie
  - 20% : taux normal (services courtage assurance, garage repair, default)
- [ ] Categories produits insurtech :
  - `insurance_brokerage` : 20% (services courtage)
  - `auto_repair_labor` : 20% (main d'oeuvre garage)
  - `auto_repair_parts` : 20% (pieces detachees)
  - `medical_consultation` : exoneration 0%
- [ ] Stockage : settings tenant pour taux par defaut + categories activated
- [ ] Endpoint `GET /api/v1/books/tva/calculate` (preview calcul)
- [ ] Endpoint `GET /api/v1/books/tva/declaration?period=YYYY-MM` (preparation declaration mensuelle)
- [ ] Tests : 5 taux + edge cases (0.005 rounding, gros montants)

**Fichiers crees / modifies** :
```
repo/packages/books/src/services/tva.service.ts                              # ~150 lignes
repo/packages/books/src/services/tva.service.spec.ts                          # ~120 lignes
repo/packages/books/src/types/tva.ts                                          # types
```

**Notes implementation** :
- decimal.js precision : 0.1 + 0.2 != 0.3 en float (erreurs comptables)
- Rounding rule MA : arrondi 2 decimals au plus proche centime (ROUND_HALF_UP)
- TVA collectee comptes : 4456 TVA collectee, 3455 TVA recuperable
- Declaration mensuelle DGI : XML format SIMPL-TVA (Sprint 12 prepare, Sprint 27 admin export)

**Criteres validation** :
- V1 (P0) : `calculateTtc(100, 20)` retourne `{ ht: 100, tva: 20, ttc: 120 }`
- V2 (P0) : 5 taux supportes
- V3 (P0) : Rounding precision (decimal.js)
- V4 (P0) : Categories mapping correct
- V5 (P0) : Tests 10+ scenarios edge cases

---

## Tache 3.5.5 -- Invoices Module : Numerotation Legale + Format DGI

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 7h / Depend de 3.5.4

**But** : Module factures : numerotation legale sequentielle + champs obligatoires DGI (ICE, RC, patente, TVA breakdown) + generation PDF (Sprint 10) + envoi email (Sprint 9).

**Livrables checkables** :
- [ ] Entity `repo/packages/books/src/entities/books-invoice.entity.ts` :
  - id, tenant_id, invoice_number (text UNIQUE par tenant), invoice_date, due_date, customer_data (jsonb : name + ICE + address), items (jsonb : array), subtotal_ht, total_tva, total_ttc, paid_amount, status (enum 'draft' | 'sent' | 'partial_paid' | 'paid' | 'cancelled'), payment_terms, notes, related_resource_type/id, journal_entry_id (FK ecriture comptable associee), pdf_document_id (FK Sprint 10), created_at, updated_at
- [ ] Service `invoices.service.ts` :
  - `create(data): Promise<Invoice>` -- numerotation auto + create draft
  - `validate(id)` -- transition draft -> sent + cree ecriture comptable + genere PDF + envoie email
  - `markPaid(id, amount, paymentMethod)` -- partial ou full
  - `cancel(id, reason)` -- annulation (avoir credit)
  - `findAll(filters, pagination)`
- [ ] Numerotation : pattern `FACT-{YEAR}-{SEQUENCE}` ou customizable per tenant settings
- [ ] Champs obligatoires DGI :
  - Nom + adresse vendeur (tenant)
  - ICE vendeur (15 chiffres)
  - RC + patente vendeur
  - Numero facture
  - Date facture
  - Nom + adresse + ICE acheteur
  - Designation precise
  - Quantite + prix unitaire HT
  - Taux TVA + montant TVA
  - Total HT, Total TVA, Total TTC
  - Modalites paiement
- [ ] Generation PDF : utilise PdfGeneratorService Sprint 10 + template `facture.hbs`
- [ ] Envoi email : Sprint 9 Comm orchestrator + template `invoice_sent`
- [ ] Endpoints :
  - `POST /api/v1/books/invoices` (create draft)
  - `POST /api/v1/books/invoices/:id/validate` (send + create journal + PDF + email)
  - `GET /api/v1/books/invoices` (filters + pagination)
  - `POST /api/v1/books/invoices/:id/mark-paid`
  - `POST /api/v1/books/invoices/:id/cancel`
  - `GET /api/v1/books/invoices/:id/pdf` (presigned URL)
- [ ] Permissions : `books.invoices.create/validate/cancel`
- [ ] Audit + Kafka events
- [ ] Tests : create + validate flow + PDF + email + payment + cancel

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-BooksInvoices.ts                # ~70 lignes
repo/packages/books/src/entities/books-invoice.entity.ts                      # ~70 lignes
repo/packages/books/src/services/invoices.service.ts                          # ~350 lignes
repo/packages/books/src/services/invoice-numbering.service.ts                  # ~80 lignes
repo/apps/api/src/modules/books/controllers/invoices.controller.ts            # ~180 lignes
repo/packages/docs/src/templates/{fr,ar-MA,ar}/facture.hbs                     # update : enrichi DGI fields
```

**Notes implementation** :
- Numerotation sequentiel UNIQUE per tenant : DGI exige (continuite, no gaps, pas de reset annuel)
- Customizable pattern per tenant : `FACT-2026-00042` ou `FA/2026/0042` (tenant settings)
- ICE acheteur facultatif : si particulier (CIN suffit), si entreprise mandatoire
- DGI requirements strict : factures non-conformes = redressement fiscal
- Sprint 14 Insure ajoutera : factures specifiques police signed (commission)

**Criteres validation** :
- V1 (P0) : Invoice cree avec numerotation auto
- V2 (P0) : Numerotation sequentielle UNIQUE per tenant
- V3 (P0) : Champs DGI presents dans PDF
- V4 (P0) : Validate cree journal + PDF + email
- V5 (P0) : Mark paid cree ecriture encaissement
- V6 (P0) : Cancel cree avoir
- V7 (P0) : ICE 15 chiffres validation
- V8 (P0) : Tests 12+ scenarios

---

## Tache 3.5.6 -- Bilan + Compte Resultat Generation

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 5h / Depend de 3.5.5

**But** : Generation bilan (snapshot patrimoine) + compte de resultat (revenus/charges periode) selon format CGNC standard.

**Livrables checkables** :
- [ ] Service `repo/packages/books/src/services/financial-statements.service.ts`
- [ ] Methods :
  - `generateBilan(date): Promise<BilanReport>` -- snapshot actif/passif a date donnee
  - `generateCompteResultat(dateStart, dateEnd): Promise<CompteResultatReport>` -- revenus/charges periode
  - `generateGrandLivre(accountCode, dateRange): Promise<GrandLivre>` -- detail mouvements compte
  - `generateBalance(date): Promise<BalanceComptable>` -- soldes tous comptes a date
- [ ] Bilan structure :
  - Actif : Immobilisations + Stocks + Creances + Tresorerie
  - Passif : Capitaux Propres + Dettes
- [ ] Compte resultat structure :
  - Produits exploitation - Charges exploitation = Resultat exploitation
  - Produits financiers - Charges financieres = Resultat financier
  - Resultat avant impots - IS = Resultat net
- [ ] Endpoints :
  - `GET /api/v1/books/reports/bilan?date=...`
  - `GET /api/v1/books/reports/compte-resultat?date_start=...&date_end=...`
  - `GET /api/v1/books/reports/grand-livre?account_code=...&date_start=...&date_end=...`
  - `GET /api/v1/books/reports/balance?date=...`
- [ ] Format response : JSON detaille + PDF export
- [ ] Permissions : `books.reports.generate`
- [ ] Tests : bilan agrege correctement, compte resultat correct

**Fichiers crees / modifies** :
```
repo/packages/books/src/services/financial-statements.service.ts             # ~300 lignes
repo/packages/books/src/services/financial-statements.service.spec.ts        # ~200 lignes
repo/apps/api/src/modules/books/controllers/financial-reports.controller.ts  # ~150 lignes
repo/packages/docs/src/templates/{fr}/bilan.hbs                                # template PDF
repo/packages/docs/src/templates/{fr}/compte-resultat.hbs                      # template PDF
```

**Notes implementation** :
- Aggregation queries Postgres : SUM debits/credits per account + nature
- Performance : > 100k journal entries -> queries optimizees + indexes
- Bilan equilibrium : Actif = Passif (test invariant)
- PDF templates : format CGNC standard reconnaissable comptables MA

**Criteres validation** :
- V1 (P0) : generateBilan retourne actif + passif balanced
- V2 (P0) : generateCompteResultat retourne resultat net
- V3 (P0) : grandLivre detail correct
- V4 (P0) : Performance < 5s sur 10k entries
- V5 (P0) : PDF export OK
- V6 (P0) : Tests 8+ scenarios

---

## Tache 3.5.7 -- ACAPS Report Framework + compliance_acaps_reports Entity

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 5h / Depend de 3.5.6

**But** : Framework reports ACAPS : entity tracking generation + soumission + scheduled jobs cron + workflow validation.

**Contexte** : ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale) supervise insurtech MA. Reports trimestriels obligatoires + annuel. Format precis avec champs imposes ACAPS (XML ou XSD specifique).

**Livrables checkables** :
- [ ] Migration : table `compliance_acaps_reports` :
  - id, tenant_id, report_type (enum 'quarterly_portfolio' | 'quarterly_claims' | 'annual_solvency' | 'annual_balance'), period (text 'YYYY-Q1' ou 'YYYY'), status (enum 'draft' | 'pending_review' | 'submitted' | 'accepted' | 'rejected'), report_data (jsonb : contenu structure), generated_at, submitted_at, acaps_reference, rejection_reason, generated_by, validated_by
- [ ] Entity correspondante
- [ ] Service `acaps-reporting.service.ts` :
  - `generateReport(reportType, period): Promise<AcapsReport>` -- compute data + INSERT draft
  - `validateReport(id, validatedBy)` -- transition draft -> pending_review (super admin tenant)
  - `submitToAcaps(id)` -- send via API ACAPS (ou export XML pour upload manuel)
  - `markAcceptedByAcaps(id, reference)` ou `markRejected(id, reason)` (webhook ou admin manual)
- [ ] Workflow report : draft -> pending_review -> submitted -> accepted/rejected
- [ ] Cron jobs :
  - Trimestriel : 1er du mois suivant trimestre (auto-generate draft, notify super admin)
  - Annuel : 31 mars suivant exercice (deadline ACAPS)
- [ ] Endpoints :
  - `GET /api/v1/compliance/acaps/reports`
  - `GET /api/v1/compliance/acaps/reports/:id`
  - `POST /api/v1/compliance/acaps/reports/:id/validate`
  - `POST /api/v1/compliance/acaps/reports/:id/submit`
  - `GET /api/v1/compliance/acaps/reports/:id/export` (XML ou PDF)
- [ ] Permissions : `compliance.acaps.generate`, `compliance.acaps.submit` (super admin tenant)
- [ ] Audit + Kafka events
- [ ] Tests : framework + workflow

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-ComplianceAcapsReports.ts        # ~50 lignes
repo/packages/compliance/src/entities/compliance-acaps-report.entity.ts        # ~50 lignes
repo/packages/compliance/src/services/acaps-reporting.service.ts                # ~250 lignes
repo/packages/compliance/src/jobs/quarterly-acaps-cron.job.ts                    # ~80 lignes
repo/packages/compliance/src/jobs/annual-acaps-cron.job.ts                       # ~80 lignes
repo/apps/api/src/modules/compliance/controllers/acaps-reports.controller.ts    # ~150 lignes
```

**Notes implementation** :
- Framework Sprint 12 prepare structure ; reports specifiques Tache 3.5.8 + 3.5.9
- API ACAPS : si pas dispo, export XML pour upload manuel via portail ACAPS
- Cron auto-generate drafts : evite oubli deadline
- super admin tenant valide avant submit (responsabilite legale)

**Criteres validation** :
- V1 (P0) : Migration creee
- V2 (P0) : generateReport cree draft
- V3 (P0) : Workflow transitions valides
- V4 (P0) : Cron trimestriel + annuel actifs
- V5 (P0) : Export XML/PDF fonctionne
- V6 (P0) : Tests 6+ scenarios

---

## Tache 3.5.8 -- Report Trimestriel : Portefeuille Polices + Sinistres

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 6h / Depend de 3.5.7

**But** : Generation report trimestriel ACAPS : agregats portefeuille polices (souscrites, encours, resiliees) + sinistres (declares, regles, en cours).

**Livrables checkables** :
- [ ] Service `quarterly-portfolio-report.service.ts`
- [ ] Method `generate(tenantId, quarter): AcapsQuarterlyReport`
- [ ] Sections report :
  1. **Polices souscrites** : count + montant primes par branche (auto, sante, vie, etc.)
  2. **Polices en cours** : count actives a fin trimestre
  3. **Polices resiliees** : count + raisons agregees
  4. **Renouvellements** : count + taux conversion
  5. **Sinistres declares** : count par branche + montant cumule
  6. **Sinistres regles** : count + montant payes
  7. **Sinistres en cours** : count + provision constituee
  8. **Indicateurs cles** : ratio sinistre/prime, taux retention
- [ ] Source data : Sprint 14+ Insure entities (lecture seule). Sprint 12 fournit framework, donnees reelles Sprint 14
- [ ] Format export : XML structure ACAPS schema
- [ ] PDF export : tables + graphiques (utilise `chart.js` server-side ou simple HTML tables)
- [ ] Validation : tous champs obligatoires presents
- [ ] Tests : avec fixtures mock data Sprint 14

**Fichiers crees / modifies** :
```
repo/packages/compliance/src/services/quarterly-portfolio-report.service.ts    # ~300 lignes
repo/packages/compliance/src/services/quarterly-portfolio-report.service.spec.ts  # ~200 lignes
repo/packages/compliance/src/templates/acaps-quarterly.xsl                       # XSL transform XML
repo/packages/docs/src/templates/{fr}/acaps-quarterly.hbs                          # PDF template
```

**Notes implementation** :
- Sprint 14 Insure complementera : polices entities + sinistres entities
- Sprint 12 livre framework + structure reports ; data integration apres Insure
- XSL ou Schema XSD ACAPS officiel : recuperer documentation ACAPS
- Couverture : 1ere version functional avec fixtures, enrichi a chaque sprint Insure

**Criteres validation** :
- V1 (P0) : generate retourne structure complete
- V2 (P0) : 8 sections presentes
- V3 (P0) : Format XML respecte schema ACAPS
- V4 (P0) : Validation champs obligatoires
- V5 (P0) : PDF lisible
- V6 (P0) : Tests fixtures 6+ scenarios

---

## Tache 3.5.9 -- Report Annuel : Solvabilite + Reserves Techniques

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 6h / Depend de 3.5.8

**But** : Report annuel ACAPS : marge solvabilite + provisions techniques + bilan + compte resultat detaille branche.

**Contexte** : Equivalent MA Solvabilite II (UE). Marge solvabilite = (capitaux propres + plus-values latentes) - exigence reglementaire. Reserves techniques = engagements assureurs envers assures.

**Livrables checkables** :
- [ ] Service `annual-solvency-report.service.ts`
- [ ] Sections :
  1. Bilan annuel CGNC (utilise Tache 3.5.6)
  2. Compte resultat (utilise Tache 3.5.6)
  3. Marge solvabilite (capitaux propres + reserves vs exigence)
  4. Provisions techniques par branche
  5. Sinistres en suspens + provisions correspondantes
  6. Reassurance (cessions / acceptations) -- Phase 7+ enrichi
  7. Plus/moins values latentes investissements
  8. Annexes ACAPS-specific
- [ ] Format export XML schema annuel ACAPS
- [ ] PDF reformat lisible humain
- [ ] Tests fixtures

**Fichiers crees / modifies** :
```
repo/packages/compliance/src/services/annual-solvency-report.service.ts        # ~350 lignes
repo/packages/compliance/src/services/annual-solvency-report.service.spec.ts   # ~200 lignes
repo/packages/docs/src/templates/{fr}/acaps-annual.hbs                          # PDF
```

**Notes implementation** :
- Marge solvabilite calcul : exigence selon volume primes + sinistres
- Provisions techniques : assureurs courtiers != assureurs primaire (Sprint 14 distinguera)
- Sprint 12 fournit framework, Sprint 14+ enrichira avec donnees reelles polices
- ACAPS exige format XML strict avec XSD validation

**Criteres validation** :
- V1 (P0) : Report annuel structure complete
- V2 (P0) : Marge solvabilite calcul correct
- V3 (P0) : Bilan + compte resultat integres
- V4 (P0) : XML valide schema
- V5 (P0) : Tests 5+ scenarios

---

## Tache 3.5.10 -- AML Monitoring + Alertes AMC

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 5h / Depend de 3.5.9

**But** : Anti-Money Laundering monitoring : rules engine detect transactions suspectes + declaration soupcon AMC (Autorite Marocaine du Capital) + audit trail.

**Contexte** : Loi 43-05 anti-blanchiment MA + recommendations GAFI. Insurtech assujettis (loi 43-05) : detection patterns + declarations TRACFIN equivalent (UTF AMC).

**Livrables checkables** :
- [ ] Migration : table `compliance_aml_alerts` (Sprint 2 partial) :
  - id, tenant_id, contact_id, transaction_id, alert_type (enum patterns), risk_score (0-100), status (enum 'pending_review' | 'cleared' | 'escalated' | 'reported_to_amc'), evidence (jsonb), reported_at, amc_reference
- [ ] Service `aml-monitoring.service.ts`
- [ ] Rules :
  1. **Structuring** : 10+ transactions petites < 50k MAD meme client en 30 jours = potentiel structuring (eviter declaration > 50k)
  2. **Velocity** : > 5 transactions same client > 100k MAD cumule en 7 jours
  3. **Cash heavy** : > 80% transactions client en cash kiosque
  4. **PEP exposure** : client est Politically Exposed Person (registre tenu separement)
  5. **High-risk country** : transaction beneficiary dans liste pays haut risque GAFI
- [ ] Risk score : weighted sum rules triggered
- [ ] Alertes status workflow : pending_review -> cleared OR escalated -> reported_to_amc
- [ ] Endpoint `GET /api/v1/compliance/aml/alerts` (super admin)
- [ ] Endpoint `POST /api/v1/compliance/aml/alerts/:id/clear` (false positive)
- [ ] Endpoint `POST /api/v1/compliance/aml/alerts/:id/escalate` (declaration AMC required)
- [ ] Endpoint `POST /api/v1/compliance/aml/alerts/:id/report-to-amc` (export DOC declaration soupcon)
- [ ] Permissions : `compliance.aml.review` (super admin tenant + analyst)
- [ ] Audit + Kafka events
- [ ] Tests : rules trigger correct + workflow

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-ComplianceAmlAlerts.ts            # ~40 lignes
repo/packages/compliance/src/services/aml-monitoring.service.ts                  # ~250 lignes
repo/packages/compliance/src/services/aml-rules/{5 rules}.ts                     # ~50 lignes chacune
repo/apps/api/src/modules/compliance/controllers/aml-alerts.controller.ts       # ~120 lignes
repo/packages/docs/src/templates/{fr}/aml-declaration-soupcon.hbs                # template DOC AMC
```

**Notes implementation** :
- AMC accept declaration via portail web (export PDF/Word -- pas API encore)
- PEP list : open-source (UN, OFAC) + maintenance manuelle MA-specific
- Sprint 30+ : enrichir avec IA (defere strategy)
- Confidentiality : alerts AML readable par small subset users (super admin + analyst_support)

**Criteres validation** :
- V1 (P0) : 5 rules engines fonctionnent
- V2 (P0) : Alert cree avec risk_score
- V3 (P0) : Workflow status transitions
- V4 (P0) : Export declaration soupcon DOC
- V5 (P0) : RBAC strict (super admin + analyst)
- V6 (P0) : Tests 10+ scenarios

---

## Tache 3.5.11 -- SAFT-MA Export XML

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 5h / Depend de 3.5.10

**But** : Export SAFT-MA (Standard Audit File for Tax-Maroc) : format XML standardise pour controles fiscaux DGI.

**Contexte** : SAFT-MA = adaptation marocaine du standard OCDE SAF-T. DGI peut demander ce format pour controles. Inclut : plan comptable + journal entries + factures + clients + fournisseurs sur exercice.

**Livrables checkables** :
- [ ] Service `repo/packages/books/src/services/saft-ma-exporter.service.ts`
- [ ] Method `export(tenantId, exerciseYear): Buffer` -- retourne XML SAFT-MA
- [ ] Structure XML SAFT-MA :
  - Header : tenant info + exercice
  - MasterFiles : accounts + customers + suppliers + tax tables
  - GeneralLedgerEntries : tous journal entries periode
  - SourceDocuments : invoices + payments
- [ ] Validation contre XSD officiel DGI (si dispo)
- [ ] Performance : > 100k entries -> stream XML (vs full memory)
- [ ] Endpoint `POST /api/v1/books/saft-ma/export?exercise_year=2026` -> retourne XML download
- [ ] Permissions : `books.saft.export` (super admin tenant)
- [ ] Audit log
- [ ] Tests : XML valide schema + content correct

**Fichiers crees / modifies** :
```
repo/packages/books/src/services/saft-ma-exporter.service.ts                  # ~300 lignes
repo/packages/books/src/services/saft-ma-exporter.service.spec.ts             # ~200 lignes
repo/packages/books/src/saft-ma/saft-ma.xsd                                    # XSD reference (si dispo)
repo/apps/api/src/modules/books/controllers/saft-ma.controller.ts             # ~80 lignes
```

**Notes implementation** :
- xml2js library pour build (alternative : streaming si gros volumes)
- XSD officiel DGI : recuperer source officielle (si pas dispo, structure de base + iterer)
- Streaming : gros tenants (10+ ans data) -> file write streaming
- Tests : valider XML parsable + content correct

**Criteres validation** :
- V1 (P0) : Export retourne XML valide
- V2 (P0) : Structure SAFT-MA respecte
- V3 (P0) : 100% data exercice incluse
- V4 (P0) : Performance OK gros volumes
- V5 (P0) : Tests 6+ scenarios

---

## Tache 3.5.12 -- Endpoints REST + Scheduled Jobs

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 5h / Depend de 3.5.11

**But** : Controllers exposant API books + compliance + scheduled cron jobs reports + integration avec autres modules.

**Livrables checkables** :
- [ ] Controllers livres dans taches precedentes (consolidation)
- [ ] Cron jobs BullMQ scheduled :
  - Quarterly ACAPS report draft generation : 1er du mois suivant trimestre
  - Annual ACAPS report draft : 1er fevrier (60j avant deadline 31 mars)
  - Monthly TVA declaration draft : 5 du mois suivant
  - SAFT-MA full export : annuel post-cloture
- [ ] Notification super admin tenant : email envoie quand draft genere (need review)
- [ ] Integration cross-module :
  - Pay events -> Books journal entries (Tache 3.5.3)
  - Books invoice paid -> Pay verify capture
  - Compliance alerts -> notification super admin via Comm
- [ ] Tests integration

**Fichiers crees / modifies** :
```
repo/packages/books/src/jobs/{several cron}.ts                              # ~300 lignes total
repo/packages/compliance/src/jobs/{several cron}.ts                         # ~200 lignes total
repo/packages/comm/src/templates/{fr,ar-MA,ar}/acaps-draft-ready.hbs         # template notification
```

**Criteres validation** :
- V1 (P0) : Cron jobs declenches selon schedule
- V2 (P0) : Notification super admin recue
- V3 (P0) : Cross-module events fonctionnent
- V4 (P0) : Tests integration 6+ scenarios

---

## Tache 3.5.13 -- Tests E2E (30+) + Fixtures + Seeds

**Metadonnees** : Phase 3 / Sprint 12 / P0 / 7h / Depend de 3.5.12

**But** : Suite tests E2E exhaustifs + fixtures comptables realistes + seed plan comptable complete.

**Livrables checkables** :

**Tests E2E (30+)** :
- [ ] Plan comptable : seed reussit + lookup + custom accounts (4)
- [ ] Journal entries : create balanced + reverse + numerotation + RBAC (8)
- [ ] Pay -> Journal auto : event triggers ecriture + idempotency (3)
- [ ] TVA : 5 taux + calcul precision + declaration mensuelle (4)
- [ ] Invoices : create + validate + PDF + email + payment + cancel (6)
- [ ] Bilan + Compte resultat : aggregations correct (3)
- [ ] ACAPS reports : framework + workflow + cron (3)
- [ ] AML : 5 rules trigger + workflow alertes (5)
- [ ] SAFT-MA : export + valid XML (2)

**Fixtures** :
- 6 mois data realiste : 100+ journal entries + 50+ invoices + 20+ AML alerts test
- Multi-tenant : Cabinet Bennani + Garage Atlas

**Seeds** :
- `seed-cgnc-plan.ts` : 250+ comptes standards (Tache 3.5.1 deja)
- `seed-books-fixtures.ts` : data realiste pour demo

**Fichiers crees / modifies** :
```
repo/apps/api/test/books/{20 specs}.e2e-spec.ts
repo/apps/api/test/compliance/{10 specs}.e2e-spec.ts
repo/infrastructure/scripts/seed-books-fixtures.ts                         # ~300 lignes
```

**Criteres validation** :
- V1 (P0) : 30+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Fixtures realistes 6 mois
- V4 (P0) : Reproducibility 5x
- V5 (P0) : Coverage all flows

---

## Sortie du Sprint 12

A la fin de l'execution des 13 taches :

```
Books + Compliance operational :
  - Plan comptable CGNC complete (250+ comptes standards + insurtech-specific)
  - Journal entries double-entry bookkeeping + numerotation legale
  - Auto-generation ecritures depuis Pay events (Sprint 11)
  - TVA marocaine 5 taux + declaration mensuelle preparation
  - Invoices conformes DGI (ICE/RC/patente/TVA)
  - Bilan + Compte resultat CGNC standard
  - ACAPS framework + 2 reports (trimestriel portefeuille + annuel solvabilite)
  - AML monitoring 5 rules + declaration AMC
  - SAFT-MA export XML pour controles DGI
  - Cron jobs auto-generation drafts reports

Conformite legale :
  - CGNC (loi 9-88 modifiee)
  - DGI invoicing requirements
  - ACAPS quarterly + annual
  - Loi 43-05 anti-blanchiment
  - SAFT-MA export

30+ tests E2E avec fixtures
```

**Sprint 13 (Analytics + Stock + HR) demarre avec** :
- Donnees comptables disponibles -> dashboards revenue/cost
- Stock (garage parts) entity + flows
- HR (employees garage) entity + workflows simples

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-3.5.X-*.md` dans `00-pilotage/prompts-taches/sprint-12-books-compliance/`.

**Patterns code inline conserves** : structure CGNC classes, double-entry validation avec decimal.js, consumer auto-generation ecriture.

**Reference** : `00-pilotage/documentation/3-schemas-database-PARTIE2.sql` couvre tables books_* + compliance_*.

---

**Fin du meta-prompt B-12 v2.2 format Option B.**
