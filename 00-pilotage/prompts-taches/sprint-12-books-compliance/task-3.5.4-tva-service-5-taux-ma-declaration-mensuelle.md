# TACHE 3.5.4 -- TVA Service + 5 Taux MA + Declaration Mensuelle SIMPL-TVA

**Sprint** : 12 (Phase 3 / Sprint 5 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-12-sprint-12-books-compliance.md` (Tache 3.5.4)
**Phase** : 3 -- Modules Horizontaux (Books + Compliance)
**Priorite** : P0 (TVA obligatoire factures DGI Tache 3.5.5, bilan TVA Tache 3.5.6)
**Effort** : 5h
**Dependances** : Tache 3.5.3 (consumer Pay->Journal), Tache 3.5.1 (comptes 44551-44555 TVA collectee + 3455 TVA recuperable + 4456 credit reporte)
**Densite cible** : 110-130 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente le **service TVA marocaine** (Taxe sur la Valeur Ajoutee) supportant les **5 taux officiels** definis par le Code General des Impots (CGI) marocain article 99 et suivants : taux normal 20% (cas le plus frequent : courtage, garage, services divers), taux intermediaires 14% (transports voyageurs, beurre industriel, energie electrique), 10% (huiles alimentaires, sel de cuisine, riz usine, restauration touristique, professions liberales), 7% (eau, gaz, electricite menage, produits pharmaceutiques, materiel hygienique scolaire), et taux 0% / exoneration (CGI art 91, 92, 94 : exports, prestations medicales, services bancaires, enseignement). Le service offre des methodes deterministes de calcul HT (Hors Taxes), TVA et TTC (Toutes Taxes Comprises) en precision decimal stricte (`decimal.js` precision 25 `ROUND_HALF_UP`, jamais float natif IEEE 754), un mapping categorie produit/service -> taux applicable selon CGI articles, et la preparation des donnees pour la declaration mensuelle TVA imposee par l'article 110 du CGI (regime du reel obligatoire des que le chiffre d'affaires HT depasse 1 000 000 MAD, trimestriel sinon).

L'apport est triple. **Premierement** : on cree un service `TvaService` injectable avec les methodes `calculateTtc({ ht, taux })`, `calculateHt({ ttc, taux })`, `getTauxForCategory(category)`, et `breakdown(lines[])`. La logique respecte la regle d'arrondi MA officielle (`ROUND_HALF_UP` au centime, conformement a l'article 117 CGI). La methode `breakdown` applique la **regle CGI fondamentale** : la TVA est calculee sur le **sous-total HT par taux** et non ligne par ligne, pour eviter l'accumulation d'erreurs d'arrondi qui creerait des differences de plusieurs centimes voire de quelques MAD sur des factures de 100 lignes. **Deuxiemement** : on configure le **mapping categories produits/services -> taux** specifiques metier insurtech : courtage assurance 20% (CGI art 89-V-2-bis), main d'oeuvre garage 20% (CGI art 89), pieces detachees automobiles 20% (CGI art 89), prestations medicales en cas de claim exoneration 0% (CGI art 91-I-3), produits pharmaceutiques 7% (CGI art 99-4), boissons/alimentation/transport voyageurs taux intermediaires (14%, 10%, 7%) pour completer le mapping multi-vertical et anticiper Sprints 14+ Insure et 19+ Repair. **Troisiemement** : on prepare l'agregation pour la **declaration mensuelle TVA** via un service `TvaDeclarationService` qui calcule pour un (tenant, periode) : TVA collectee par taux (compte 4455x credits, requete agregee Postgres), TVA recuperable (compte 3455 + 4456 debits), credit TVA reporte du mois precedent, TVA a verser DGI (collectee - recuperable - credit_reporte), ou credit a reporter si negatif. La declaration mensuelle est due le **30 du mois suivant pour regime mensuel**, le **31 du mois suivant le trimestre pour regime trimestriel**. Format export : JSON structure SIMPL-TVA pre-XML (Sprint 27 admin enrichira avec export XML officiel DGI conforme schema SIMPL-TVA).

A l'issue de cette tache, le tenant Cabinet Bennani peut produire instantanement le calcul TVA pour une commission courtage : 10 000 MAD HT a 20% -> 2 000 MAD TVA -> 12 000 MAD TTC. Le tenant Garage Atlas peut facturer une reparation auto avec breakdown TVA detaille par poste (main d'oeuvre 20% + pieces 20%, sous-total HT cumule puis TVA appliquee). A la fin du mois, la requete `tvaDeclaration.compute(period='2026-04', regime='monthly')` agrege automatiquement les ecritures comptables Tache 3.5.2 generees par Pay (Tache 3.5.3) et par invoices (Tache 3.5.5), produit la structure JSON SIMPL-TVA avec breakdown par taux, base imposable, montant collecte, TVA recuperable, montant a verser ou credit a reporter. Cette tache est consommee par : Tache 3.5.5 invoices (calcul automatique TVA dans factures DGI), Tache 3.5.6 bilan (presentation TVA collectee/recuperable dans passif 4455x), Tache 3.5.11 SAFT-MA export (table Tax Rates conforme XSD DGI). Sans elle, l'invoicing Sprint 12 et toute la verticale Repair Sprint 19+ produiraient des factures non conformes DGI sujettes a redressement fiscal (amende article 184 CGI : 5 000 a 20 000 MAD par facture irreguliere, plus 100% en cas de recidive).

---

## 2. Contexte etendu

### 2.1 Pourquoi 5 taux et pas un seul

Le legislateur marocain a introduit progressivement la TVA en 1986 avec un taux unique 19%, puis a ajoute des taux differencies pour des raisons de politique sociale (taux reduits sur produits de premiere necessite) et sectorielle (taux specifiques transports, hotellerie, energies). Cette differenciation reflete une politique fiscale ciblee : alleger la pression sur les produits essentiels (eau, electricite, pharmaceutique a 7%), soutenir certains secteurs strategiques (restauration touristique a 10%), et concentrer la fiscalite sur les services aux entreprises et biens non-essentiels (taux normal 20%). En 2026, la structure est stable depuis plusieurs annees :

- **Taux normal 20%** (CGI art 98) : services de courtage assurance, garage et reparation auto, conseil professionnel, hotellerie hors touristique reduit, location de biens, electronique grand public, vehicules, mobilier. Couvre environ 70% des operations economiques courantes au Maroc. C'est le taux par defaut applicable aux operations Skalean InsurTech (courtage, garage).

- **Taux 14%** (CGI art 99-2) : transports voyageurs (hors international qui est exonere), beurre industriel (pas le beurre naturel qui est a 10%), energie electrique. Specifique a quelques sous-secteurs ; rarement utilise par les acteurs Skalean.

- **Taux 10%** (CGI art 99-3) : huiles alimentaires, sel de cuisine, riz usine, produits petroliers raffines, restauration touristique classee, professions liberales medicales (consultations payantes non remboursees). Pour Skalean : applicable seulement si garage facture un service annexe inhabituel comme repas pour client (peu probable).

- **Taux 7%** (CGI art 99-4) : eau, gaz, electricite menage, produits pharmaceutiques (medicaments, dispositifs medicaux), materiel hygienique scolaire, certaines operations bancaires specifiques. Applicable pour Skalean : Sprint 14+ Insure traitera des prestations medicales facturees (pharmacie partenaire) a 7%.

- **Taux 0% / Exoneration** (CGI art 91, 92, 94) : exports (avec droit a deduction de la TVA amont -- art 92), prestations medicales (sans droit a deduction -- art 91-I-3), oeuvres litteraires (livres), services bancaires de certaines categories, enseignement, regimes prevoyance sociale obligatoires (CNSS, AMO). Pour Skalean : applicable pour les actes medicaux dans les claims sante (Sprint 14+).

Pour Skalean InsurTech, la grande majorite des operations relevent du **20%** (courtage et garage representent 90% du business model). Mais il faut **supporter les 5 taux** car : (a) Sprint 19+ Repair pourra avoir des operations a 7% ou 10% si le garage achete des consommables specifiques (huile moteur, produits chimiques) ou facture annexes ; (b) Sprint 14+ Insure traitera des prestations medicales (frais de claim sante) exonerees ; (c) la **conformite SIMPL-TVA** (declaration mensuelle obligatoire DGI) exige que TOUS les taux soient supportes meme si jamais utilises (champs DGI imposes meme s'ils restent a zero) ; (d) la conformite avec le SAFT-MA Tache 3.5.11 exige le tax table complet pour les controles fiscaux.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Hardcode taux 20% partout | Tres simple | Non conforme CGI, redressement DGI immediat, illegal | Rejete |
| Lib externe (vatlayer, taxjar) | Globale, mises a jour auto | Ne couvre pas TVA MA correctement, latence API externe, dependance | Rejete |
| Table DB `tva_rates` configurable | Flexible, audit | Risque mauvaise saisie, audit complexe, taux MA changent rarement | Differe Sprint 27 admin |
| **Constante TS + service deterministe (retenu)** | Audit, type-safe, perf, immutable | Modification = redeploy | RETENU |
| Computation dans front-end | Latence faible | Incoherent prix sur DB, risque manipulation client-side | Rejete |
| Lib ML predict taux | Innovant | Overkill, pas explicable a auditeur DGI, viole decision-005 frontier AI | Rejete |
| Stockage par tenant settings | Customizable | Le CGI est uniforme MA, customisation = erreur fiscale | Rejete |

La decision retenue : taux hardcode dans `TVA_RATES_MA` constant TypeScript, exposes via service injectable `TvaService`, agregations pour declaration via query Postgres groupee par taux (lecture des comptes 4455x credits + 3455 debit). Cela respecte : (a) la simplicite et l'auditabilite (un developpeur peut voir le mapping en lisant `tva-rates.config.ts`), (b) la conformite CGI (les taux sont les taux officiels CGI), (c) la performance (pas de query DB additionnelle pour resoudre le taux).

### 2.3 Trade-offs explicites

**Premier trade-off** : la precision decimale est `ROUND_HALF_UP` au centime (2 decimales). Le **CGI article 117 impose cet arrondi** pour les declarations fiscales : tout montant doit etre arrondi a 2 decimales au plus proche, avec la regle "demi superieur" (0.005 -> 0.01, 0.004 -> 0.00). Le cout de cette regle : sur des montants tres petits (e.g. ligne de facture 0.07 MAD HT), la TVA 20% calculee est 0.014 -> arrondie a 0.01. La somme de 100 lignes a 0.07 MAD HT donne 7 MAD HT et TVA 20% sur ce total = 1.40 MAD ; ligne par ligne agrege cela donnerait `100 * 0.01 = 1.00` MAD. Discrepance de **0.40 MAD**. Sur une facture de 1000 lignes, ce serait 4 MAD de difference. C'est inacceptable. **Mitigation** : la regle "calculer la TVA sur le TOTAL HT par taux, pas ligne par ligne" est imposee par le CGI lui-meme (article 96 alinea 2). Implementation : la methode `breakdown` agrege les bases HT par taux PUIS applique le taux au sous-total. Tests V27 + V28 valident ce comportement explicitement (100 lignes a 0.07 -> 1.40 MAD attendu, pas 1.00).

**Deuxieme trade-off** : le mapping categorie -> taux est hardcode dans `TVA_CATEGORIES`. Si la DGI change un taux (e.g. l'article 99-4 est modifie en Loi de Finances 2027 pour passer le pharmaceutique de 7% a 10%), il faut redeploy. Acceptable car : (a) les changements de taux sont rares (en moyenne 1 fois par 5 ans, sources : evolutions Loi de Finances 2018-2025 montrent stabilite), (b) ils sont annonces dans la **Loi de Finances annuelle** (publiee au BO en decembre, applicable au 1er janvier suivant), donc on a 1-2 mois pour reagir, (c) une modification urgente peut etre faite par hotfix release < 1 jour si necessaire. Sprint 27 admin permettra de surcharger via tenant_settings pour cas exceptionnels (peu probable, mais documente).

**Troisieme trade-off** : la declaration mensuelle est calculee **a la demande** (lazy, real-time), pas materialisee. Avantage : toujours a jour (si une ecriture est ajoutee 5 min avant la generation, elle est incluse). Inconvenient : sur un tenant avec 100k lignes/mois, la requete agregee peut prendre 200-500ms. Acceptable pour un endpoint admin (Sprint 27) qui sera utilise 1-2 fois par mois maximum par tenant, pas en hot path utilisateur. **Mitigation Sprint 34 Performance** : si > 100k lignes par tenant, materialized view rafraichie nightly + invalidation event-driven. Pas necessaire avant 3-5 ans d'historique.

**Quatrieme trade-off** : Sprint 12 livre les calculs et la **structure JSON** SIMPL-TVA. L'export XML conforme schema officiel DGI est differe **Sprint 27 admin** car : (a) le schema XSD officiel DGI evolue (versions multiples), (b) la soumission se fait via le portail SIMPL-TVA Tax-Edi (web upload manuel), pas via API automatisee. Sprint 12 prepare la donnee, Sprint 27 enrichira l'XML. Ce decoupage est plus sain qu'un coupling fort entre Sprint 12 et un format externe potentiellement changeant.

**Cinquieme trade-off** : on ne gere que la **TVA collectee** (sur ventes, comptes 4455x credits) et la **TVA recuperable** (sur achats, compte 3455 debit), sans gestion du **prorata de deduction** pour entreprises mixtes (operations imposables + exonerees). Le prorata est applicable si un tenant a a la fois des activites taxees (courtage 20%) et exonerees (banking_service par exemple), auquel cas le droit a deduction TVA amont est limite par un prorata calcule annuellement (CGI art 104). Hors scope Sprint 12 car : (a) majorite des courtiers et garages au Maroc font 100% activite taxee 20%, prorata = 100%, (b) calcul prorata complexe (CGI art 104-II detaille), reserve a Sprint 27+ pour traitement explicite.

### 2.4 Decisions strategiques referenced

- **decision-001 (monorepo)** : `packages/books` extends services Tache 3.5.1, 3.5.2, 3.5.3.
- **decision-002 (multi-tenant 3 niveaux)** : RLS sur les queries d'agregation declaration. TenantContext propage strictement.
- **decision-003 (TypeORM 0.3)** : raw SQL pour agregations performance (GROUP BY avec calculs complexes).
- **decision-006 (no-emoji policy)** : zero emoji.
- **decision-008 (data residency Maroc)** : Atlas DC1 pour tables 4455x.
- Tache 3.5.1 : comptes 44551 a 44555 (TVA collectee par taux), 3455 (TVA recuperable), 4456 (credits TVA report).
- Tache 3.5.2 : ecritures journal_lines source des agregations declaration mensuelle.
- Sprint 28 Compliance : exports DGI consolides (le bilan Tache 3.5.6 source).

### 2.5 Pieges techniques connus

1. **Piege : floating-point arithmetic** -- `0.1 + 0.2 = 0.30000000000000004` en JavaScript natif (IEEE 754 double precision). Avec TVA 20% sur 100 lignes a 0.10 MAD, l'erreur cumulee depasse rapidement 1 MAD. Solution : `decimal.js` precision 25 + `ROUND_HALF_UP` partout, jamais `+` natif sur les montants. Tests V9 et V10 unit valident la precision sur cas connus.

2. **Piege : taux change en cours d'exercice** -- Si le 1er juillet 2026 la DGI change le taux pharmaceutique de 7% a 10%, des ecritures du semestre 1 sont en 7% mais ne devraient pas etre re-calculees retroactivement. Solution Sprint 27+ : table `tva_rates_history(taux, date_start, date_end)` permettant la versionning. Pour Sprint 12, on hardcode + assertion `entry_date >= 2026-01-01` (debut Sprint 12 prod cible) + warning si entry_date dans le passe avec taux desormais different.

3. **Piege : confusion TVA collectee vs recuperable** -- TVA collectee = sur ventes (passif, compte 4455x). TVA recuperable = sur achats (actif, compte 3455). Inversion = redressement fiscal pour declaration erronee. Solution : enums stricts `TvaAccountType: 'collectee' | 'recuperable'` + tests d'invariants. La declaration TvaDeclarationService distingue strictement les deux via account_code pattern matching.

4. **Piege : prorata de deduction** -- Pour les entreprises mixtes (operations imposables + exonerees), le droit a deduction est limite par un prorata. Hors scope Sprint 12, mentionner dans doc et alerter via warning si tenant a operations exonerees (compte 44551 0%).

5. **Piege : exoneration vs taux 0%** -- Une operation 0% (export, art 92) donne droit a deduction de la TVA amont. Une operation exoneree (art 91) ne donne PAS droit a deduction. Distinction critique pour declaration. Solution : 2 categories distinctes dans enum (`exonere_avec_droit_deduction` pour export, `exonere_sans_droit_deduction` pour banking_service, medical_consultation). Pour Sprint 12, on traite les deux comme "taux 0" mais on flag la categorie pour Sprint 27 prorata.

6. **Piege : autoliquidation** -- Pour certains achats imports (services electroniques par exemple), l'acheteur declare et paie la TVA lui-meme (autoliquidation, CGI art 115). Hors scope Sprint 12, mais documente pour Sprint 27.

7. **Piege : commission rounding accumulating** -- Sur 1000 commissions a 100.05 MAD HT, ligne par ligne 100 * 20.01 = 20010 MAD TVA. En total 100050 MAD * 20% = 20010 MAD. Coincidence ici. Mais sur 100.07 : ligne par ligne 100*20.014 = 20014 (arrondi 20.01 = 20010), total 100*20.014 = 20014. Decart de 4 MAD. Solution : toujours calculer TVA sur sous-total HT par taux (regle CGI art 96-2). Test V27 unit valide.

8. **Piege : SIMPL-TVA exige format XML strict** -- L'export final est XML conforme schema SIMPL-TVA publie par DGI. Sprint 12 livre JSON, Sprint 27 fait XML avec XSD validation (xmllint en CI).

9. **Piege : delais declaration** -- 30 du mois suivant pour regime mensuel (CA > 1 MMAD HT), 31 du mois suivant le trimestre pour trimestriel (CA <= 1 MMAD HT). Solution : metadata declaration inclut `due_date` calcule + `regime` detecte automatiquement.

10. **Piege : retenue a la source** -- Certains clients (Etat, OCP, BAM, certaines compagnies d'assurance avec convention specifique) retiennent 75% de la TVA et la versent directement a la DGI au nom du fournisseur (CGI art 88-bis). Le fournisseur ne percoit que 25%. Hors scope Sprint 12 (Sprint 14+ Insure si grands comptes signales par tenant settings).

11. **Piege : TVA en devises etrangeres** -- Si facture en EUR, conversion taux du jour BAM le jour de facturation. Hors scope Sprint 12 (MAD only conformement decision-008 et loi 9-88 tenue MAD). Si event Pay arrive en EUR, Tache 3.5.3 route DLQ. Si invoice facturee en EUR (cas tres rare pour courtier MA), Tache 3.5.5 rejette.

12. **Piege : credit TVA report** -- Si TVA recuperable > TVA collectee un mois, credit reporte au mois suivant (CGI art 103). Solution : champ `credit_reporte_anterieur` dans declaration, agregation cumulative requeting le mois precedent. Sprint 12 livre la structure, Sprint 27 enrichira avec stockage durable de `tva_credit_reports` table.

13. **Piege : Postgres SUM(numeric) retourne string** -- Le driver `pg` JS serialise `numeric` Postgres en string pour preserver precision. Si on tente arithmetique JS native `parseFloat`, perte precision. Solution : recevoir `string` cote app, `parseFloat` UNIQUEMENT pour assertions/affichage, `Decimal.js` pour calcul.

14. **Piege : declaration period invalide** -- Format YYYY-MM (`2026-04`) accepte ou trimestriel YYYY-QN (`2026-Q1`)? Solution : Zod regex strict + test V8 + erreur explicite `INVALID_PERIOD_FORMAT`.

15. **Piege : tenant nouveau sans historique** -- Si tenant cree en juin et on lui demande declaration janvier, query retourne 0/0, declaration vide. Solution : valide (declaration zero conforme), pas d'erreur.

---

## 3. Architecture context

### 3.1 Position dans le sprint 12

- **Depend de** : Tache 3.5.1 (comptes 44551-44555 TVA, 3455 recuperable, 4456 credit), Tache 3.5.2 (journal_lines source des SUMs), Tache 3.5.3 (consumer enrichit description avec TVA si applicable, mais ne modifie pas le mapping mais Sprint 14+ Insure pourra le faire).
- **Bloque** : Tache 3.5.5 (invoices utilisent `TvaService.calculateTtc` et `breakdown` pour calculer TVA des items), Tache 3.5.6 (bilan inclut soldes 4455x dans passif circulant et 3455 dans actif circulant), Tache 3.5.11 (SAFT-MA export tax tables).
- **Apporte** : service de calcul deterministe (5 methodes principales), service d'agregation declaration, 5 endpoints REST sous `/api/v1/books/tva/*`.

### 3.2 Position dans le programme global v2.2

```
Sprint 12 task 3.5.4 (cette tache : TVA pure deterministe + agregation declaration)
            |
            v
Sprint 12 task 3.5.5 (invoices avec TVA detaillee, breakdown par taux)
            |
            v
Sprint 12 task 3.5.6 (bilan inclut soldes TVA collectee/recuperable)
            |
            v
Sprint 19+ Repair (facturation atelier TVA 20% main d'oeuvre + pieces)
            |
            v
Sprint 14+ Insure (commissions courtage 20%, prestations medicales 0% exoneration)
            |
            v
Sprint 27 Admin (declaration mensuelle UI + export XML SIMPL-TVA officiel)
            |
            v
Sprint 28 Compliance Reports (audit DGI quarterly via bilan + declaration TVA)
```

### 3.3 Sequence calcul invoice (utilisation principale Sprint 12)

```
Invoice creation Tache 3.5.5 :
   pour chaque ligne :
      tvaService.getTauxForCategory(category)  -> e.g. 20% pour insurance_brokerage
      compute base HT = unit_price_ht * quantity
   collecte toutes les lignes pour breakdown :
      tvaService.breakdown({ lines: [{ ht, taux }, ...] })
   resultat :
      total_ht: '17000.00',
      total_tva: '3400.00',
      total_ttc: '20400.00',
      totals_by_taux: { '20': { base_ht: '17000.00', tva: '3400.00', ttc: '20400.00' } }
   invoice.validate() declenche :
      JournalService.createEntry({
        lines: [
          { account_code: '4112', label: 'Client', debit: '20400.00' },
          { account_code: '71244', label: 'Commission', credit: '17000.00' },
          { account_code: '44555', label: 'TVA 20%', credit: '3400.00' },
        ],
      })
```

### 3.4 Sequence declaration mensuelle (Sprint 27 UI)

```
Admin tenant : GET /api/v1/books/tva/declaration?period=2026-04&regime=monthly
   |
   v
TvaDeclarationService.compute(period, regime)
   - parse period -> dateStart 2026-04-01, dateEnd 2026-04-30
   - query Postgres :
       SELECT account_code, SUM(credit) FROM books_journal_lines
       JOIN books_journal_entries ON ...
       WHERE entry_date BETWEEN $1 AND $2 AND status = 'validated'
         AND account_code IN ('44551','44552','44553','44554','44555')
       GROUP BY account_code
   - query TVA recuperable account 3455
   - calculer credit_reporte_anterieur (mois precedent declaration ou table tva_credit_reports)
   - calculer total_a_verser = collectee - recuperable - credit_anterieur
   - format result JSON SIMPL-TVA structure
   - return JSON
   |
   v
Admin telecharge JSON, copie dans portail SIMPL-TVA DGI manuellement (Sprint 27 enrichira XML auto)
```

### 3.5 Endpoints exposes par cette tache

```
GET  /api/v1/books/tva/rates              -> liste 5 taux + categories + comptes mapping
GET  /api/v1/books/tva/calculate?ht=1000&taux=20 -> preview calcul HT -> TTC
GET  /api/v1/books/tva/calculate?ttc=1200&taux=20 -> preview calcul TTC -> HT
POST /api/v1/books/tva/breakdown          -> calcul lignes multiples avec sous-totaux par taux
GET  /api/v1/books/tva/declaration?period=2026-04&regime=monthly -> declaration mensuelle
GET  /api/v1/books/tva/categories         -> liste categories metier mappees
```

---

## 4. Livrables checkables

- [ ] Service `tva.service.ts` (~320 lignes) : calculateTtc, calculateHt, breakdown, getTauxForCategory, getRates, getAccountCollectee.
- [ ] Service `tva-declaration.service.ts` (~280 lignes) : compute(period, regime), detectRegime, parsePeriod, computeDueDate.
- [ ] Config `tva-rates.config.ts` (~180 lignes) : taux + categories + descriptions + comptes mapping CGI articles.
- [ ] Types `tva.types.ts` (~140 lignes) : TauxTva, TvaCategory, TvaCalculation, TvaDeclaration, TvaRegime.
- [ ] Schemas Zod `tva.schemas.ts` (~140 lignes) : validations DTOs runtime stricte.
- [ ] Controller `tva.controller.ts` (~220 lignes) : 6 endpoints REST avec RBAC.
- [ ] Tests unit `tva.service.spec.ts` (~640 lignes) : 32 cas exhaustifs (5 taux x 5 scenarios + edge cases + precision + breakdown rule CGI).
- [ ] Tests unit `tva-declaration.service.spec.ts` (~360 lignes) : 14 cas (period parsing, regime detection, calculs).
- [ ] Tests integration `tva.integration.spec.ts` (~340 lignes) : 12 cas avec DB Postgres testcontainer + seed comptes.
- [ ] Tests E2E `tva.controller.e2e-spec.ts` (~280 lignes) : 14 cas API complets.
- [ ] Fixtures `tva-fixtures.ts` (~180 lignes) : 25 fixtures de transactions + resultats attendus.
- [ ] Mise a jour permissions catalog : `books.tva.{read, calculate, declaration}` (3 perms).
- [ ] Documentation README.md mise a jour (section TVA + categories CGI + exemples calcul).
- [ ] Variables env (heritees Tache 3.5.1-3.5.3, aucune nouvelle).
- [ ] Healthcheck inclut presence comptes 4455x (assertion seed CGNC).

---

## 5. Fichiers crees / modifies

```
repo/packages/books/src/services/tva.service.ts                              (~320 lignes)
repo/packages/books/src/services/tva.service.spec.ts                          (~640 lignes / 32 unit)
repo/packages/books/src/services/tva-declaration.service.ts                   (~280 lignes)
repo/packages/books/src/services/tva-declaration.service.spec.ts              (~360 lignes / 14 unit)
repo/packages/books/src/config/tva-rates.config.ts                            (~180 lignes)
repo/packages/books/src/types/tva.types.ts                                    (~140 lignes)
repo/packages/books/src/schemas/tva.schemas.ts                                (~140 lignes)
repo/apps/api/src/modules/books/controllers/tva.controller.ts                 (~220 lignes)
repo/apps/api/src/modules/books/dto/tva.dto.ts                                 (~50 lignes)
repo/packages/books/test/integration/tva.integration.spec.ts                  (~340 lignes / 12 integration)
repo/apps/api/test/e2e/books/tva.controller.e2e-spec.ts                        (~280 lignes / 14 E2E)
repo/test/fixtures/tva-fixtures.ts                                             (~180 lignes / 25 fixtures)
repo/packages/auth/src/permissions/catalog.ts                                  (modif +3 perms)
repo/packages/books/README.md                                                   (modif section TVA)
repo/packages/books/src/index.ts                                                (modif exports)
```

Total : 15 fichiers, ~3 450 lignes ajoutees.

---

## 6. Code patterns COMPLETS

### 6.1 Config taux `tva-rates.config.ts`

```typescript
// repo/packages/books/src/config/tva-rates.config.ts
// Taux TVA Maroc (CGI 2026) + mapping categorie -> taux + comptes CGNC
// Reference : Tache 3.5.1 plan comptable (44551-44555 TVA collectee, 3455 recuperable)
// CGI articles : 89 (taux normal 20%), 91-92-94 (exonerations 0%), 99-2 (14%), 99-3 (10%), 99-4 (7%)

export const TVA_RATES_MA = {
  RATE_0: 0,
  RATE_7: 7,
  RATE_10: 10,
  RATE_14: 14,
  RATE_20: 20,
} as const;

export type TauxTva = (typeof TVA_RATES_MA)[keyof typeof TVA_RATES_MA];

export const TVA_RATES_LIST: TauxTva[] = [0, 7, 10, 14, 20];

/**
 * Mapping taux -> compte CGNC TVA collectee (Tache 3.5.1 seed).
 * Chaque taux a son sous-compte distinct dans le plan comptable pour faciliter
 * la declaration mensuelle SIMPL-TVA (DGI exige breakdown par taux).
 */
export const TVA_ACCOUNTS_COLLECTEE: Record<TauxTva, string> = {
  0: '44551', // TVA collectee 0% (exoneration ou taux zero)
  7: '44552', // TVA collectee 7% (pharmaceutique, eau, gaz, electricite)
  10: '44553', // TVA collectee 10% (restauration touristique, riz, huile)
  14: '44554', // TVA collectee 14% (transports voyageurs, beurre industriel)
  20: '44555', // TVA collectee 20% (taux normal -- courtage, garage, services)
};

/** Compte CGNC unique TVA recuperable (regime classique sans prorata). */
export const TVA_ACCOUNT_RECUPERABLE = '3455';

/** Compte CGNC TVA credit reporte (deduction mois suivant si excedent recuperable). */
export const TVA_ACCOUNT_CREDIT_REPORTE = '4456';

/**
 * Categories Skalean InsurTech mappees aux taux CGI.
 * cgi_article : reference legale pour audit DGI.
 * label : description pour reporting et factures DGI.
 *
 * Les categories sont organisees par vertical metier :
 *   - Insurance (insurance_*) : Sprint 14+
 *   - Repair (auto_repair_*) : Sprint 19+
 *   - Medical : Sprint 14+ claims sante
 *   - Utilities : achats internes
 *   - Default : fallback 20%
 */
export const TVA_CATEGORIES = {
  // === Verticale Insure (courtage assurance) ===
  insurance_brokerage: {
    taux: 20,
    label: 'Courtage assurance',
    cgi_article: '89',
    account_code_default: '71244', // Commission Courtage RC
  },
  policy_administration: {
    taux: 20,
    label: 'Gestion de police',
    cgi_article: '89',
    account_code_default: '71248',
  },
  claim_handling_fee: {
    taux: 20,
    label: 'Honoraires sinistres',
    cgi_article: '89',
    account_code_default: '71248',
  },
  consulting_assurance: {
    taux: 20,
    label: 'Conseil en assurance',
    cgi_article: '89',
    account_code_default: '71248',
  },

  // === Verticale Repair (garage automobile) ===
  auto_repair_labor: {
    taux: 20,
    label: 'Main d oeuvre garage',
    cgi_article: '89',
    account_code_default: '71261',
  },
  auto_repair_parts: {
    taux: 20,
    label: 'Pieces detachees automobiles',
    cgi_article: '89',
    account_code_default: '71262',
  },
  auto_repair_paint: {
    taux: 20,
    label: 'Peinture carrosserie',
    cgi_article: '89',
    account_code_default: '71263',
  },
  auto_diagnostic: {
    taux: 20,
    label: 'Diagnostic electronique',
    cgi_article: '89',
    account_code_default: '71265',
  },
  auto_tires: {
    taux: 20,
    label: 'Pneumatiques',
    cgi_article: '89',
    account_code_default: '71262',
  },

  // === Sante / claims medicaux ===
  medical_consultation: {
    taux: 0,
    label: 'Consultation medicale (exoneration sans droit deduction)',
    cgi_article: '91-I-3',
    account_code_default: '7124',
    exemption_type: 'without_deduction_right' as const,
  },
  medical_pharmaceutical: {
    taux: 7,
    label: 'Produits pharmaceutiques',
    cgi_article: '99-4',
    account_code_default: '7124',
  },
  medical_lab: {
    taux: 0,
    label: 'Analyses laboratoire (exoneration)',
    cgi_article: '91',
    account_code_default: '7124',
    exemption_type: 'without_deduction_right' as const,
  },
  medical_hospital: {
    taux: 0,
    label: 'Hospitalisation (exoneration)',
    cgi_article: '91-I-3',
    account_code_default: '7124',
    exemption_type: 'without_deduction_right' as const,
  },

  // === Energies / fournitures ===
  electricity: {
    taux: 7,
    label: 'Electricite menage',
    cgi_article: '99-4',
    account_code_default: '61251',
  },
  water: {
    taux: 7,
    label: 'Eau distribution',
    cgi_article: '99-4',
    account_code_default: '61251',
  },
  gas: {
    taux: 7,
    label: 'Gaz domestique',
    cgi_article: '99-4',
    account_code_default: '61251',
  },

  // === Transport ===
  passenger_transport_local: {
    taux: 14,
    label: 'Transport voyageurs local',
    cgi_article: '99-2',
    account_code_default: '6142',
  },
  freight_transport: {
    taux: 20,
    label: 'Transport marchandises',
    cgi_article: '89',
    account_code_default: '6142',
  },

  // === Alimentaire (rare pour Skalean mais supporte) ===
  rice: {
    taux: 10,
    label: 'Riz usine',
    cgi_article: '99-3',
    account_code_default: '6125',
  },
  cooking_oil: {
    taux: 10,
    label: 'Huile alimentaire',
    cgi_article: '99-3',
    account_code_default: '6125',
  },
  salt: {
    taux: 10,
    label: 'Sel de cuisine',
    cgi_article: '99-3',
    account_code_default: '6125',
  },
  restaurant_tourism: {
    taux: 10,
    label: 'Restauration touristique classee',
    cgi_article: '99-3',
    account_code_default: '6143',
  },

  // === Defaut + cas particuliers ===
  default: {
    taux: 20,
    label: 'Taux normal (defaut)',
    cgi_article: '98',
    account_code_default: '7124',
  },

  // === Exports / specifiques ===
  export: {
    taux: 0,
    label: 'Exportations (avec droit deduction)',
    cgi_article: '92',
    account_code_default: '7113',
    exemption_type: 'with_deduction_right' as const,
  },
  banking_service: {
    taux: 0,
    label: 'Service bancaire (exonere sans droit deduction)',
    cgi_article: '94',
    account_code_default: '7124',
    exemption_type: 'without_deduction_right' as const,
  },
  education: {
    taux: 0,
    label: 'Enseignement (exonere)',
    cgi_article: '91',
    account_code_default: '7124',
    exemption_type: 'without_deduction_right' as const,
  },
} as const;

export type TvaCategory = keyof typeof TVA_CATEGORIES;

export const TVA_CATEGORIES_LIST = Object.keys(TVA_CATEGORIES) as readonly TvaCategory[];

export interface TvaRegimeRule {
  threshold_mad: number;
  description: string;
  due_day: number;
}

/**
 * Seuils CGI art 110 : regime mensuel vs trimestriel selon CA HT.
 * Mensuel : declaration le 30 du mois suivant.
 * Trimestriel : declaration le 31 du mois suivant le trimestre.
 */
export const TVA_REGIME_RULES = {
  monthly: {
    threshold_mad: 1_000_000,
    description: 'Regime mensuel obligatoire si CA HT > 1 000 000 MAD',
    due_day: 30,
  },
  quarterly: {
    threshold_mad: 0,
    description: 'Regime trimestriel si CA HT <= 1 000 000 MAD',
    due_day: 31,
  },
} as const;

/**
 * Sanity check au boot : tous les taux ont leur compte 4455x mapped.
 */
export function validateTvaRatesCoverage(): string[] {
  const errors: string[] = [];
  for (const taux of TVA_RATES_LIST) {
    if (!TVA_ACCOUNTS_COLLECTEE[taux]) {
      errors.push(`Taux ${taux}% : pas de compte 4455x mappe`);
    }
  }
  return errors;
}
```

### 6.2 Types `tva.types.ts`

```typescript
// repo/packages/books/src/types/tva.types.ts

import type { TauxTva, TvaCategory } from '../config/tva-rates.config';

export interface TvaCalculation {
  ht: string; // string decimal (Decimal.js .toFixed(2))
  tva: string;
  ttc: string;
  taux: TauxTva;
  taux_label: string;
}

export interface TvaLineInput {
  ht?: string | number;
  ttc?: string | number;
  taux: TauxTva;
  category?: TvaCategory;
  label?: string;
  quantity?: number;
}

export interface TvaBreakdownLine {
  index: number;
  base_ht: string;
  taux: TauxTva;
  tva_amount: string;
  ttc: string;
  category?: TvaCategory;
}

export interface TvaBreakdownResult {
  lines: TvaBreakdownLine[];
  totals_by_taux: Record<string, { base_ht: string; tva: string; ttc: string }>;
  total_ht: string;
  total_tva: string;
  total_ttc: string;
}

export type TvaRegime = 'monthly' | 'quarterly';

export interface TvaCollecteeParTaux {
  taux: TauxTva;
  base_ht: string;
  tva_amount: string;
  account_code: string;
}

export interface TvaRecuperable {
  base_ht: string;
  tva_amount: string;
  account_code: string;
}

export interface TvaDeclaration {
  tenant_id: string;
  period: string; // YYYY-MM (mensuel) ou YYYY-Q1 (trimestriel)
  regime: TvaRegime;
  due_date: string; // YYYY-MM-DD
  period_start: string;
  period_end: string;
  collectee_par_taux: TvaCollecteeParTaux[];
  total_collectee: string;
  recuperable: TvaRecuperable;
  credit_reporte_anterieur: string;
  total_a_verser: string; // = collectee - recuperable - credit_reporte (>= 0)
  credit_a_reporter: string; // si negatif on reporte le mois suivant
  generated_at: string;
  has_data: boolean;
  warnings: string[];
}

export interface TvaCategoryInfo {
  category: TvaCategory;
  taux: TauxTva;
  label: string;
  cgi_article: string;
  account_code_default: string;
  exemption_type?: 'with_deduction_right' | 'without_deduction_right';
}

export interface TvaRateInfo {
  taux: TauxTva;
  label: string;
  account_code: string;
  cgi_articles: string[];
  categories: TvaCategory[];
}
```

### 6.3 Schemas Zod `tva.schemas.ts`

```typescript
// repo/packages/books/src/schemas/tva.schemas.ts

import { z } from 'zod';
import { TVA_RATES_LIST, TVA_CATEGORIES_LIST } from '../config/tva-rates.config';

const decimalString = z
  .string()
  .regex(/^\d{1,13}(\.\d{1,2})?$/, 'Decimal max 15.2 (CGI art 117 arrondi centime)')
  .or(z.number().nonnegative());

/**
 * TauxSchema accepte 0, 7, 10, 14 ou 20. Coercion possible depuis query string.
 */
export const TauxSchema = z.coerce.number().refine(
  (v) => TVA_RATES_LIST.includes(v as 0 | 7 | 10 | 14 | 20),
  { message: 'taux doit etre 0, 7, 10, 14 ou 20 (CGI art 98-99)' },
);

export const TvaCalculateQuerySchema = z
  .object({
    ht: decimalString.optional(),
    ttc: decimalString.optional(),
    taux: TauxSchema,
  })
  .strict()
  .refine((d) => (d.ht !== undefined) !== (d.ttc !== undefined), {
    message: 'Fournir ht XOR ttc, exactement un des deux (mutuellement exclusif)',
  });

export type TvaCalculateQuery = z.infer<typeof TvaCalculateQuerySchema>;

export const TvaLineSchema = z
  .object({
    ht: decimalString.optional(),
    ttc: decimalString.optional(),
    taux: TauxSchema,
    category: z
      .string()
      .refine((c) => TVA_CATEGORIES_LIST.includes(c as any), {
        message: 'Category invalide (cf TVA_CATEGORIES_LIST)',
      })
      .optional(),
    label: z.string().min(1).max(255).optional(),
    quantity: z.number().min(0.01).default(1),
  })
  .strict()
  .refine((d) => (d.ht !== undefined) !== (d.ttc !== undefined), {
    message: 'Chaque ligne fournit ht XOR ttc',
  });

export const TvaBreakdownInputSchema = z
  .object({
    lines: z.array(TvaLineSchema).min(1).max(999),
  })
  .strict();

export type TvaBreakdownInput = z.infer<typeof TvaBreakdownInputSchema>;

export const TvaDeclarationQuerySchema = z
  .object({
    period: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$/, 'Period format YYYY-MM (mensuel) ou YYYY-QN (trimestriel)'),
    regime: z.enum(['monthly', 'quarterly']).optional(),
  })
  .strict();

export type TvaDeclarationQuery = z.infer<typeof TvaDeclarationQuerySchema>;
```

### 6.4 Service `tva.service.ts`

```typescript
// repo/packages/books/src/services/tva.service.ts
// Service TVA Maroc -- 5 taux + calculs deterministes Decimal.js
// Reference : CGI 2026 art 89-92, 94, 98-99, 110, 117

import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import Decimal from 'decimal.js';
import {
  TVA_RATES_LIST,
  TVA_CATEGORIES,
  TVA_ACCOUNTS_COLLECTEE,
  type TauxTva,
  type TvaCategory,
} from '../config/tva-rates.config';
import type {
  TvaCalculation,
  TvaBreakdownLine,
  TvaBreakdownResult,
  TvaRateInfo,
} from '../types/tva.types';
import {
  TvaBreakdownInputSchema,
  type TvaBreakdownInput,
} from '../schemas/tva.schemas';

// Configuration globale Decimal.js : precision 25, arrondi demi-superieur (CGI art 117)
Decimal.set({ precision: 25, rounding: Decimal.ROUND_HALF_UP });

@Injectable()
export class TvaService {
  constructor(private readonly logger: Logger) {}

  /**
   * Calcule TTC depuis HT : ttc = ht * (1 + taux/100).
   * Arrondi ROUND_HALF_UP au centime (CGI art 117).
   *
   * @param input.ht - montant HT (string preferable pour precision, number accepte)
   * @param input.taux - 0, 7, 10, 14 ou 20
   * @returns { ht, tva, ttc, taux, taux_label }
   * @throws BadRequestException si taux invalide ou HT negatif
   */
  calculateTtc(input: { ht: string | number; taux: TauxTva }): TvaCalculation {
    this.assertTaux(input.taux);
    const ht = new Decimal(input.ht);
    if (ht.isNegative()) {
      throw new BadRequestException({
        code: 'INVALID_HT',
        message: 'HT doit etre >= 0',
        value: ht.toFixed(2),
      });
    }
    const tauxDecimal = new Decimal(input.taux).div(100);
    const tva = ht.mul(tauxDecimal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const ttc = ht.plus(tva).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return {
      ht: ht.toFixed(2),
      tva: tva.toFixed(2),
      ttc: ttc.toFixed(2),
      taux: input.taux,
      taux_label: this.getTauxLabel(input.taux),
    };
  }

  /**
   * Calcule HT depuis TTC : ht = ttc / (1 + taux/100).
   * Utile quand on connait le prix affiche TTC (cas grand public) et qu'on veut retrouver HT.
   *
   * @param input.ttc - montant TTC
   * @param input.taux - 0, 7, 10, 14 ou 20
   * @returns { ht, tva, ttc, taux, taux_label }
   */
  calculateHt(input: { ttc: string | number; taux: TauxTva }): TvaCalculation {
    this.assertTaux(input.taux);
    const ttc = new Decimal(input.ttc);
    if (ttc.isNegative()) {
      throw new BadRequestException({ code: 'INVALID_TTC', value: ttc.toFixed(2) });
    }
    const tauxDecimal = new Decimal(input.taux).div(100);
    const divisor = new Decimal(1).plus(tauxDecimal);
    const ht = ttc.div(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const tva = ttc.minus(ht).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    return {
      ht: ht.toFixed(2),
      tva: tva.toFixed(2),
      ttc: ttc.toFixed(2),
      taux: input.taux,
      taux_label: this.getTauxLabel(input.taux),
    };
  }

  /**
   * Renvoie le taux applicable pour une categorie metier.
   * Si categorie inconnue, fallback 20% + WARN log.
   */
  getTauxForCategory(category: TvaCategory | string): TauxTva {
    const def = (TVA_CATEGORIES as Record<string, { taux: TauxTva }>)[category];
    if (!def) {
      this.logger.warn({
        msg: 'tva_unknown_category_default_20',
        category,
        action: 'Ajouter category a TVA_CATEGORIES config',
      });
      return 20;
    }
    return def.taux;
  }

  /**
   * Renvoie meta complete d'une categorie.
   */
  getCategoryInfo(category: TvaCategory | string) {
    return (TVA_CATEGORIES as Record<string, any>)[category];
  }

  /**
   * Breakdown ligne par ligne avec rule CGI imposee :
   *   TVA calculee sur sous-total HT par taux, PAS ligne par ligne.
   *
   * Cette regle (CGI art 96-2) evite les erreurs d'arrondi cumulees.
   * Exemple : 100 lignes a 0.07 HT 20% :
   *   - ligne par ligne : 100 * round(0.014, 2) = 100 * 0.01 = 1.00 MAD (FAUX)
   *   - rule CGI : round(100 * 0.07 * 0.20, 2) = round(1.40, 2) = 1.40 MAD (CORRECT)
   */
  breakdown(input: TvaBreakdownInput): TvaBreakdownResult {
    const validated = TvaBreakdownInputSchema.parse(input);

    // 1. Pour chaque ligne, normaliser en HT (handle ttc-input + quantity)
    const linesHt: TvaBreakdownLine[] = validated.lines.map((line, idx) => {
      const quantity = line.quantity ?? 1;
      const baseLineHt =
        line.ht !== undefined
          ? new Decimal(line.ht as string).mul(quantity)
          : this.deriveHtFromTtc(new Decimal(line.ttc as string).mul(quantity), line.taux);
      const tvaLine = baseLineHt.mul(new Decimal(line.taux).div(100));
      const ttcLine = baseLineHt.plus(tvaLine);
      return {
        index: idx + 1,
        base_ht: baseLineHt.toFixed(2),
        taux: line.taux,
        tva_amount: tvaLine.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
        ttc: ttcLine.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2),
        category: line.category,
      };
    });

    // 2. Agreger HT brut par taux (pre-arrondi)
    const totalsByTauxAcc: Record<string, { base_ht: Decimal; tva: Decimal; ttc: Decimal }> = {};
    linesHt.forEach((line) => {
      const key = String(line.taux);
      if (!totalsByTauxAcc[key]) {
        totalsByTauxAcc[key] = {
          base_ht: new Decimal(0),
          tva: new Decimal(0),
          ttc: new Decimal(0),
        };
      }
      // On ajoute le base_ht brut (avant arrondi de la ligne)
      totalsByTauxAcc[key].base_ht = totalsByTauxAcc[key].base_ht.plus(line.base_ht);
    });

    // 3. Re-calcul TVA et TTC sur les sous-totaux par taux (CGI rule)
    const totalsByTaux: Record<string, { base_ht: string; tva: string; ttc: string }> = {};
    let totalHt = new Decimal(0);
    let totalTva = new Decimal(0);
    let totalTtc = new Decimal(0);

    Object.entries(totalsByTauxAcc).forEach(([tauxStr, agg]) => {
      const taux = parseInt(tauxStr, 10) as TauxTva;
      const tva = agg.base_ht
        .mul(new Decimal(taux).div(100))
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const ttc = agg.base_ht.plus(tva).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      totalsByTaux[tauxStr] = {
        base_ht: agg.base_ht.toFixed(2),
        tva: tva.toFixed(2),
        ttc: ttc.toFixed(2),
      };
      totalHt = totalHt.plus(agg.base_ht);
      totalTva = totalTva.plus(tva);
      totalTtc = totalTtc.plus(ttc);
    });

    return {
      lines: linesHt,
      totals_by_taux: totalsByTaux,
      total_ht: totalHt.toFixed(2),
      total_tva: totalTva.toFixed(2),
      total_ttc: totalTtc.toFixed(2),
    };
  }

  /**
   * Renvoie liste des taux + meta pour UI selecteur.
   */
  getRates(): TvaRateInfo[] {
    return TVA_RATES_LIST.map((taux) => {
      const categories = Object.entries(TVA_CATEGORIES)
        .filter(([_, v]) => v.taux === taux)
        .map(([k]) => k as TvaCategory);
      const cgiArticles = Array.from(
        new Set(
          Object.values(TVA_CATEGORIES)
            .filter((c) => c.taux === taux)
            .map((c) => c.cgi_article),
        ),
      );
      return {
        taux,
        label: this.getTauxLabel(taux),
        account_code: TVA_ACCOUNTS_COLLECTEE[taux],
        cgi_articles: cgiArticles,
        categories,
      };
    });
  }

  /**
   * Renvoie le compte CGNC TVA collectee pour un taux donne.
   * Utilise par Tache 3.5.5 invoices.
   */
  getAccountCollectee(taux: TauxTva): string {
    const acc = TVA_ACCOUNTS_COLLECTEE[taux];
    if (!acc) {
      throw new BadRequestException({ code: 'INVALID_TAUX', taux });
    }
    return acc;
  }

  /** Liste plate de toutes les categories pour API GET /categories. */
  getCategories() {
    return Object.entries(TVA_CATEGORIES).map(([category, info]) => ({
      category,
      taux: info.taux,
      label: info.label,
      cgi_article: info.cgi_article,
      account_code_default: info.account_code_default,
      exemption_type: 'exemption_type' in info ? info.exemption_type : undefined,
    }));
  }

  // === HELPERS PRIVES ===

  private assertTaux(taux: number): void {
    if (!TVA_RATES_LIST.includes(taux as TauxTva)) {
      throw new BadRequestException({
        code: 'INVALID_TAUX',
        taux,
        message: 'Taux doit etre 0, 7, 10, 14 ou 20 (CGI art 98-99)',
      });
    }
  }

  private getTauxLabel(taux: TauxTva): string {
    if (taux === 0) return 'Exoneration / Taux 0%';
    return `Taux ${taux}%`;
  }

  private deriveHtFromTtc(ttc: Decimal, taux: TauxTva): Decimal {
    const divisor = new Decimal(1).plus(new Decimal(taux).div(100));
    return ttc.div(divisor);
  }
}
```

### 6.5 Service `tva-declaration.service.ts`

```typescript
// repo/packages/books/src/services/tva-declaration.service.ts
// Agregation declaration TVA mensuelle/trimestrielle (CGI art 110-117)

import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import {
  TVA_RATES_LIST,
  TVA_ACCOUNTS_COLLECTEE,
  TVA_ACCOUNT_RECUPERABLE,
  TVA_REGIME_RULES,
  type TauxTva,
} from '../config/tva-rates.config';
import { TenantContext } from '@insurtech/shared-utils';
import type { TvaDeclaration, TvaRegime } from '../types/tva.types';

@Injectable()
export class TvaDeclarationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  /**
   * Calcule la declaration TVA pour un (tenant, period).
   * Period : '2026-04' (mensuel) ou '2026-Q2' (trimestriel).
   *
   * Lecture journal_lines validated (status=validated, pas reverses), agregation
   * par compte 4455x (collectee) et 3455 (recuperable).
   *
   * Sortie : structure SIMPL-TVA pre-XML (Sprint 27 convertira en XML officiel).
   */
  async compute(period: string, regime: TvaRegime = 'monthly'): Promise<TvaDeclaration> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException({ code: 'TENANT_CONTEXT_MISSING' });
    }

    const { dateStart, dateEnd } = this.parsePeriod(period, regime);

    this.logger.info({
      msg: 'tva_declaration_compute_start',
      tenant_id: tenantId,
      period,
      regime,
      date_start: dateStart.toISOString().slice(0, 10),
      date_end: dateEnd.toISOString().slice(0, 10),
    });

    // 1. TVA collectee par taux (credits des comptes 4455x)
    // Avec base_ht reconstituee depuis le sous-total des produits associes
    const collecteeRows: Array<{ account_code: string; tva: string; ht: string }> =
      await this.dataSource.query(
        `SELECT jl.account_code,
                SUM(jl.credit)::text AS tva,
                COALESCE((
                  SELECT SUM(jl2.credit)::text
                  FROM books_journal_lines jl2
                  INNER JOIN books_journal_entries je2 ON je2.id = jl2.journal_entry_id
                  WHERE je2.tenant_id = $1
                    AND je2.entry_date BETWEEN $2 AND $3
                    AND je2.status = 'validated'
                    AND je2.reversed_by_entry_id IS NULL
                    AND jl2.account_code LIKE '7%'
                    AND jl2.journal_entry_id IN (
                      SELECT je_inner.id FROM books_journal_entries je_inner
                      INNER JOIN books_journal_lines jl_inner ON jl_inner.journal_entry_id = je_inner.id
                      WHERE jl_inner.account_code = jl.account_code
                    )
                ), 0) AS ht
         FROM books_journal_lines jl
         INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
         WHERE je.tenant_id = $1
           AND je.entry_date BETWEEN $2 AND $3
           AND je.status = 'validated'
           AND je.reversed_by_entry_id IS NULL
           AND jl.account_code = ANY($4)
         GROUP BY jl.account_code
         ORDER BY jl.account_code`,
        [
          tenantId,
          dateStart.toISOString().slice(0, 10),
          dateEnd.toISOString().slice(0, 10),
          Object.values(TVA_ACCOUNTS_COLLECTEE),
        ],
      );

    // 2. Construire collectee_par_taux pour les 5 taux (meme si 0)
    const collecteeParTaux = TVA_RATES_LIST.map((taux) => {
      const accountCode = TVA_ACCOUNTS_COLLECTEE[taux];
      const row = collecteeRows.find((r) => r.account_code === accountCode);
      const tvaAmount = new Decimal(row?.tva ?? 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      // Reconstituer base_ht : tva / (taux/100), sauf si taux=0 (base_ht = produit credit)
      const baseHt =
        taux === 0
          ? new Decimal(row?.ht ?? 0).toDecimalPlaces(2)
          : tvaAmount.div(new Decimal(taux).div(100)).toDecimalPlaces(2);
      return {
        taux,
        base_ht: baseHt.toFixed(2),
        tva_amount: tvaAmount.toFixed(2),
        account_code: accountCode,
      };
    });

    const totalCollectee = collecteeParTaux
      .reduce((acc, r) => acc.plus(r.tva_amount), new Decimal(0))
      .toDecimalPlaces(2);

    // 3. TVA recuperable (debits compte 3455 sur achats)
    const recuperableRow: Array<{ tva: string; ht: string }> = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(jl.debit), 0)::text AS tva,
         COALESCE((
           SELECT SUM(jl2.debit)::text
           FROM books_journal_lines jl2
           INNER JOIN books_journal_entries je2 ON je2.id = jl2.journal_entry_id
           WHERE je2.tenant_id = $1
             AND je2.entry_date BETWEEN $2 AND $3
             AND je2.status = 'validated'
             AND je2.reversed_by_entry_id IS NULL
             AND jl2.account_code LIKE '6%'
         ), 0) AS ht
       FROM books_journal_lines jl
       INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.tenant_id = $1
         AND je.entry_date BETWEEN $2 AND $3
         AND je.status = 'validated'
         AND je.reversed_by_entry_id IS NULL
         AND jl.account_code = $4`,
      [
        tenantId,
        dateStart.toISOString().slice(0, 10),
        dateEnd.toISOString().slice(0, 10),
        TVA_ACCOUNT_RECUPERABLE,
      ],
    );

    const recuperable = {
      base_ht: new Decimal(recuperableRow[0]?.ht ?? 0).toFixed(2),
      tva_amount: new Decimal(recuperableRow[0]?.tva ?? 0).toFixed(2),
      account_code: TVA_ACCOUNT_RECUPERABLE,
    };

    // 4. Credit reporte anterieur (Sprint 27 enrichira avec table tva_credit_reports)
    const creditReporteAnt = '0.00';

    // 5. Calcul net a verser
    const totalRecuperable = new Decimal(recuperable.tva_amount);
    const creditAnt = new Decimal(creditReporteAnt);
    const net = totalCollectee.minus(totalRecuperable).minus(creditAnt);
    const aVerser = Decimal.max(net, 0).toDecimalPlaces(2).toFixed(2);
    const aReporter = net.isNegative()
      ? net.abs().toDecimalPlaces(2).toFixed(2)
      : '0.00';

    // 6. Due date
    const dueDate = this.computeDueDate(dateEnd, regime);

    // 7. Warnings (pour UX admin tenant)
    const warnings: string[] = [];
    const has0Operations = collecteeParTaux.find((c) => c.taux === 0 && new Decimal(c.tva_amount).gt(0) || new Decimal(c.base_ht).gt(0));
    if (has0Operations) {
      warnings.push(
        'PRORATA_REVIEW_REQUIRED: operations exonerees detectees, verifier prorata deduction (CGI art 104) Sprint 27',
      );
    }
    if (net.isNegative()) {
      warnings.push(
        `CREDIT_TVA_REPORTE: credit ${aReporter} MAD reporte au mois suivant (CGI art 103)`,
      );
    }
    const totalHt = collecteeParTaux.reduce(
      (acc, c) => acc.plus(c.base_ht),
      new Decimal(0),
    );
    const hasData =
      totalHt.gt(0) ||
      new Decimal(totalCollectee).gt(0) ||
      new Decimal(recuperable.tva_amount).gt(0);

    const result: TvaDeclaration = {
      tenant_id: tenantId,
      period,
      regime,
      due_date: dueDate.toISOString().slice(0, 10),
      period_start: dateStart.toISOString().slice(0, 10),
      period_end: dateEnd.toISOString().slice(0, 10),
      collectee_par_taux: collecteeParTaux,
      total_collectee: totalCollectee.toFixed(2),
      recuperable,
      credit_reporte_anterieur: creditReporteAnt,
      total_a_verser: aVerser,
      credit_a_reporter: aReporter,
      generated_at: new Date().toISOString(),
      has_data: hasData,
      warnings,
    };

    this.logger.info({
      msg: 'tva_declaration_compute_done',
      tenant_id: tenantId,
      period,
      total_collectee: result.total_collectee,
      total_a_verser: result.total_a_verser,
      credit_a_reporter: result.credit_a_reporter,
      warnings_count: warnings.length,
    });

    return result;
  }

  /**
   * Parse period YYYY-MM ou YYYY-QN -> dates start/end.
   */
  parsePeriod(period: string, regime: TvaRegime): { dateStart: Date; dateEnd: Date } {
    if (regime === 'monthly') {
      const m = period.match(/^(\d{4})-(\d{2})$/);
      if (!m) {
        throw new BadRequestException({
          code: 'INVALID_PERIOD',
          message: 'Mensuel : format YYYY-MM',
          period,
        });
      }
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      if (month < 1 || month > 12) {
        throw new BadRequestException({ code: 'INVALID_PERIOD', period });
      }
      const dateStart = new Date(Date.UTC(year, month - 1, 1));
      const dateEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59));
      return { dateStart, dateEnd };
    }
    // Trimestriel
    const m = period.match(/^(\d{4})-Q([1-4])$/);
    if (!m) {
      throw new BadRequestException({
        code: 'INVALID_PERIOD',
        message: 'Trimestriel : format YYYY-QN avec N in 1..4',
        period,
      });
    }
    const year = parseInt(m[1], 10);
    const quarter = parseInt(m[2], 10);
    const dateStart = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
    const dateEnd = new Date(Date.UTC(year, quarter * 3, 0, 23, 59, 59));
    return { dateStart, dateEnd };
  }

  /**
   * Due date calculee selon regime :
   *   - Mensuel : 30 du mois suivant la fin de period
   *   - Trimestriel : 31 du mois suivant la fin du trimestre
   */
  computeDueDate(dateEnd: Date, regime: TvaRegime): Date {
    const rule = TVA_REGIME_RULES[regime];
    const dueDate = new Date(dateEnd);
    dueDate.setUTCMonth(dueDate.getUTCMonth() + 1);
    dueDate.setUTCDate(rule.due_day);
    return dueDate;
  }

  /**
   * Detecte le regime applicable au tenant base sur CA HT 12 mois rolling.
   * Si > 1 MMAD HT : monthly. Sinon : quarterly.
   */
  async detectRegime(): Promise<TvaRegime> {
    const tenantId = TenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException({ code: 'TENANT_CONTEXT_MISSING' });
    }
    const since = new Date();
    since.setFullYear(since.getFullYear() - 1);
    const result = await this.dataSource.query(
      `SELECT COALESCE(SUM(jl.credit), 0)::text AS ca_ht
       FROM books_journal_lines jl
       INNER JOIN books_journal_entries je ON je.id = jl.journal_entry_id
       WHERE je.tenant_id = $1
         AND je.entry_date >= $2
         AND je.status = 'validated'
         AND je.reversed_by_entry_id IS NULL
         AND jl.account_code LIKE '7%'`,
      [tenantId, since.toISOString().slice(0, 10)],
    );
    const ca = parseFloat(result[0]?.ca_ht ?? '0');
    return ca > TVA_REGIME_RULES.monthly.threshold_mad ? 'monthly' : 'quarterly';
  }
}
```

### 6.6 Controller `tva.controller.ts`

```typescript
// repo/apps/api/src/modules/books/controllers/tva.controller.ts

import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard, TenantGuard, PermissionsGuard } from '@insurtech/auth';
import { Permissions } from '@insurtech/auth/decorators';
import { ZodPipe } from '@insurtech/shared-utils/pipes/zod.pipe';
import { TvaService } from '@insurtech/books/services/tva.service';
import { TvaDeclarationService } from '@insurtech/books/services/tva-declaration.service';
import {
  TvaCalculateQuerySchema,
  TvaBreakdownInputSchema,
  TvaDeclarationQuerySchema,
  type TvaCalculateQuery,
  type TvaBreakdownInput,
  type TvaDeclarationQuery,
} from '@insurtech/books/schemas/tva.schemas';

@ApiTags('Books -- TVA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, PermissionsGuard)
@Controller({ path: 'books/tva', version: '1' })
export class TvaController {
  constructor(
    private readonly tvaService: TvaService,
    private readonly declarationService: TvaDeclarationService,
  ) {}

  @Get('rates')
  @Permissions('books.tva.read')
  @ApiOperation({ summary: 'Liste 5 taux MA + categories + comptes mapping' })
  getRates() {
    return this.tvaService.getRates();
  }

  @Get('categories')
  @Permissions('books.tva.read')
  @ApiOperation({ summary: 'Liste categories metier insurtech mappees aux taux CGI' })
  getCategories() {
    return this.tvaService.getCategories();
  }

  @Get('calculate')
  @Permissions('books.tva.calculate')
  @ApiOperation({ summary: 'Calcule HT ou TTC selon input (un seul des deux fourni)' })
  calculate(@Query(new ZodPipe(TvaCalculateQuerySchema)) query: TvaCalculateQuery) {
    if (query.ht !== undefined) {
      return this.tvaService.calculateTtc({ ht: query.ht as any, taux: query.taux as any });
    }
    return this.tvaService.calculateHt({ ttc: query.ttc as any, taux: query.taux as any });
  }

  @Post('breakdown')
  @Permissions('books.tva.calculate')
  @ApiOperation({
    summary: 'Breakdown lignes avec sous-totaux par taux (rule CGI art 96-2)',
  })
  breakdown(@Body(new ZodPipe(TvaBreakdownInputSchema)) body: TvaBreakdownInput) {
    return this.tvaService.breakdown(body);
  }

  @Get('declaration')
  @Permissions('books.tva.declaration')
  @ApiOperation({
    summary: 'Declaration TVA pour periode (mensuelle YYYY-MM ou trimestrielle YYYY-QN)',
  })
  async declaration(@Query(new ZodPipe(TvaDeclarationQuerySchema)) query: TvaDeclarationQuery) {
    const regime = query.regime ?? (await this.declarationService.detectRegime());
    return this.declarationService.compute(query.period, regime);
  }

  @Get('regime')
  @Permissions('books.tva.read')
  @ApiOperation({ summary: 'Detecte le regime TVA applicable au tenant (CA HT 12 mois)' })
  async getRegime() {
    return { regime: await this.declarationService.detectRegime() };
  }
}
```

---

## 7. Tests complets

### 7.1 Tests unit `tva.service.spec.ts` (32 cas exhaustifs)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TvaService } from './tva.service';

describe('TvaService', () => {
  let service: TvaService;
  let logger: any;

  beforeEach(() => {
    logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() };
    service = new TvaService(logger);
  });

  // === Calcul TTC depuis HT (5 taux) ===

  it('T1 -- calculateTtc(100, 20) = { ht: 100.00, tva: 20.00, ttc: 120.00 }', () => {
    const r = service.calculateTtc({ ht: 100, taux: 20 });
    expect(r.ht).toBe('100.00');
    expect(r.tva).toBe('20.00');
    expect(r.ttc).toBe('120.00');
    expect(r.taux).toBe(20);
  });

  it('T2 -- calculateTtc(1000, 14) -> ttc 1140', () => {
    const r = service.calculateTtc({ ht: 1000, taux: 14 });
    expect(r.ttc).toBe('1140.00');
    expect(r.tva).toBe('140.00');
  });

  it('T3 -- calculateTtc(500, 10) -> tva 50', () => {
    const r = service.calculateTtc({ ht: 500, taux: 10 });
    expect(r.tva).toBe('50.00');
    expect(r.ttc).toBe('550.00');
  });

  it('T4 -- calculateTtc(100, 7) -> ttc 107', () => {
    const r = service.calculateTtc({ ht: 100, taux: 7 });
    expect(r.tva).toBe('7.00');
    expect(r.ttc).toBe('107.00');
  });

  it('T5 -- calculateTtc(100, 0) = 100 (pas de TVA, exoneration)', () => {
    const r = service.calculateTtc({ ht: 100, taux: 0 });
    expect(r.tva).toBe('0.00');
    expect(r.ttc).toBe('100.00');
  });

  // === Calcul HT depuis TTC ===

  it('T6 -- calculateHt(120, 20) = 100 (inversion)', () => {
    const r = service.calculateHt({ ttc: 120, taux: 20 });
    expect(r.ht).toBe('100.00');
    expect(r.tva).toBe('20.00');
  });

  it('T7 -- calculateHt(107, 7) = 100', () => {
    const r = service.calculateHt({ ttc: 107, taux: 7 });
    expect(r.ht).toBe('100.00');
  });

  it('T8 -- calculateHt(100, 0) = 100 (idem)', () => {
    const r = service.calculateHt({ ttc: 100, taux: 0 });
    expect(r.ht).toBe('100.00');
    expect(r.tva).toBe('0.00');
  });

  // === Precision Decimal.js ===

  it('T9 -- precision : calculateTtc(0.10, 20) -> 0.12 (centime)', () => {
    const r = service.calculateTtc({ ht: '0.10', taux: 20 });
    expect(r.ttc).toBe('0.12');
  });

  it('T10 -- precision : calculateTtc(33.33, 20) -> ttc 39.996 -> arrondi 40.00', () => {
    const r = service.calculateTtc({ ht: '33.33', taux: 20 });
    expect(r.tva).toBe('6.67'); // 33.33 * 0.20 = 6.666 -> ROUND_HALF_UP -> 6.67
    expect(r.ttc).toBe('40.00');
  });

  it('T11 -- precision : tres petit montant 0.01 / 20% = 0.00 TVA', () => {
    const r = service.calculateTtc({ ht: '0.01', taux: 20 });
    expect(r.tva).toBe('0.00'); // 0.002 -> 0.00
    expect(r.ttc).toBe('0.01');
  });

  it('T12 -- gros montant : 1234567.89 / 20% = 246913.58 TVA', () => {
    const r = service.calculateTtc({ ht: '1234567.89', taux: 20 });
    expect(r.tva).toBe('246913.58');
    expect(r.ttc).toBe('1481481.47');
  });

  // === Edge cases ===

  it('T13 -- HT negatif rejete avec INVALID_HT', () => {
    expect(() => service.calculateTtc({ ht: -100, taux: 20 })).toThrow(/INVALID_HT/);
  });

  it('T14 -- TTC negatif rejete avec INVALID_TTC', () => {
    expect(() => service.calculateHt({ ttc: -100, taux: 20 })).toThrow(/INVALID_TTC/);
  });

  it('T15 -- taux 25 (non MA) rejete avec INVALID_TAUX', () => {
    expect(() => service.calculateTtc({ ht: 100, taux: 25 as any })).toThrow(/INVALID_TAUX/);
  });

  it('T16 -- taux 5% (non MA) rejete', () => {
    expect(() => service.calculateTtc({ ht: 100, taux: 5 as any })).toThrow(/INVALID_TAUX/);
  });

  it('T17 -- HT 0 -> ttc 0 (cas limite)', () => {
    const r = service.calculateTtc({ ht: 0, taux: 20 });
    expect(r.ttc).toBe('0.00');
    expect(r.tva).toBe('0.00');
  });

  // === getTauxForCategory ===

  it('T18 -- getTauxForCategory(insurance_brokerage) = 20', () => {
    expect(service.getTauxForCategory('insurance_brokerage')).toBe(20);
  });

  it('T19 -- getTauxForCategory(medical_consultation) = 0 (exoneration)', () => {
    expect(service.getTauxForCategory('medical_consultation')).toBe(0);
  });

  it('T20 -- getTauxForCategory(electricity) = 7', () => {
    expect(service.getTauxForCategory('electricity')).toBe(7);
  });

  it('T21 -- getTauxForCategory(rice) = 10', () => {
    expect(service.getTauxForCategory('rice')).toBe(10);
  });

  it('T22 -- getTauxForCategory(passenger_transport_local) = 14', () => {
    expect(service.getTauxForCategory('passenger_transport_local')).toBe(14);
  });

  it('T23 -- getTauxForCategory(unknown_xyz) -> 20 fallback + warn log', () => {
    expect(service.getTauxForCategory('unknown_xyz')).toBe(20);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        msg: 'tva_unknown_category_default_20',
        category: 'unknown_xyz',
      }),
    );
  });

  // === breakdown rule CGI ===

  it('T24 -- breakdown 1 ligne 100 HT 20% -> total_ttc 120', () => {
    const r = service.breakdown({ lines: [{ ht: 100, taux: 20 }] });
    expect(r.total_ht).toBe('100.00');
    expect(r.total_tva).toBe('20.00');
    expect(r.total_ttc).toBe('120.00');
  });

  it('T25 -- breakdown 3 lignes meme taux : sous-total agrege', () => {
    const r = service.breakdown({
      lines: [
        { ht: 100, taux: 20 },
        { ht: 200, taux: 20 },
        { ht: 300, taux: 20 },
      ],
    });
    expect(r.total_ht).toBe('600.00');
    expect(r.total_tva).toBe('120.00');
    expect(r.total_ttc).toBe('720.00');
    expect(r.totals_by_taux['20'].tva).toBe('120.00');
  });

  it('T26 -- breakdown taux mixtes : sous-totaux par taux distincts', () => {
    const r = service.breakdown({
      lines: [
        { ht: 100, taux: 20 },
        { ht: 100, taux: 10 },
        { ht: 100, taux: 7 },
      ],
    });
    expect(r.total_ht).toBe('300.00');
    expect(r.total_tva).toBe('37.00'); // 20 + 10 + 7
    expect(r.totals_by_taux['20'].tva).toBe('20.00');
    expect(r.totals_by_taux['10'].tva).toBe('10.00');
    expect(r.totals_by_taux['7'].tva).toBe('7.00');
  });

  it('T27 -- breakdown rule CGI : agreger HT avant taux (precision critique)', () => {
    // 100 lignes a 0.07 HT 20% : ligne par ligne 100*0.014 = 1.40 ; CGI total: 7*0.20 = 1.40
    // Si on faisait ligne par ligne avec arrondi : 100*0.01 = 1.00 (FAUX)
    const lines = Array.from({ length: 100 }, () => ({ ht: '0.07', taux: 20 as const }));
    const r = service.breakdown({ lines });
    expect(r.total_ht).toBe('7.00');
    expect(r.total_tva).toBe('1.40'); // CGI conforme art 96-2
  });

  it('T28 -- breakdown ttc-input : derive HT depuis TTC correctement', () => {
    const r = service.breakdown({ lines: [{ ttc: 120, taux: 20 }] });
    expect(r.total_ht).toBe('100.00');
    expect(r.total_tva).toBe('20.00');
    expect(r.total_ttc).toBe('120.00');
  });

  it('T29 -- breakdown avec quantity multiplie HT', () => {
    const r = service.breakdown({
      lines: [{ ht: '50.00', taux: 20, quantity: 3 }],
    });
    expect(r.total_ht).toBe('150.00');
    expect(r.total_tva).toBe('30.00');
  });

  it('T30 -- breakdown 999 lignes max accepte', () => {
    const lines = Array.from({ length: 999 }, () => ({ ht: '1.00', taux: 20 as const }));
    const r = service.breakdown({ lines });
    expect(r.lines).toHaveLength(999);
  });

  // === getRates / getCategories ===

  it('T31 -- getRates retourne 5 taux avec meta complet', () => {
    const rates = service.getRates();
    expect(rates).toHaveLength(5);
    expect(rates.find((r) => r.taux === 20)).toBeDefined();
    expect(rates.find((r) => r.taux === 20)?.account_code).toBe('44555');
    expect(rates.find((r) => r.taux === 7)?.account_code).toBe('44552');
  });

  it('T32 -- getAccountCollectee retourne compte correct pour chaque taux', () => {
    expect(service.getAccountCollectee(0)).toBe('44551');
    expect(service.getAccountCollectee(7)).toBe('44552');
    expect(service.getAccountCollectee(10)).toBe('44553');
    expect(service.getAccountCollectee(14)).toBe('44554');
    expect(service.getAccountCollectee(20)).toBe('44555');
  });
});
```

### 7.2 Tests unit `tva-declaration.service.spec.ts` (14 cas)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TvaDeclarationService } from './tva-declaration.service';
import { TenantContext } from '@insurtech/shared-utils';

describe('TvaDeclarationService', () => {
  let service: TvaDeclarationService;
  let dataSource: any;
  let logger: any;
  const TENANT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  beforeEach(() => {
    vi.spyOn(TenantContext, 'getTenantId').mockReturnValue(TENANT);
    dataSource = { query: vi.fn() };
    logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() };
    service = new TvaDeclarationService(dataSource, logger);
  });

  it('D1 -- compute monthly 2026-04 retourne structure complete', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ account_code: '44555', tva: '20000.00', ht: '100000.00' }])
      .mockResolvedValueOnce([{ tva: '5000.00', ht: '25000.00' }]);
    const r = await service.compute('2026-04', 'monthly');
    expect(r.period).toBe('2026-04');
    expect(r.regime).toBe('monthly');
    expect(r.due_date).toMatch(/^2026-05-30$/);
    expect(r.total_collectee).toBe('20000.00');
    expect(r.recuperable.tva_amount).toBe('5000.00');
    expect(r.total_a_verser).toBe('15000.00');
    expect(r.has_data).toBe(true);
  });

  it('D2 -- compute quarterly 2026-Q2 avec due_date 31 juillet', async () => {
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const r = await service.compute('2026-Q2', 'quarterly');
    expect(r.regime).toBe('quarterly');
    expect(r.due_date).toMatch(/^2026-07-31$/);
  });

  it('D3 -- credit a reporter si recuperable > collectee', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ account_code: '44555', tva: '1000.00', ht: '5000.00' }])
      .mockResolvedValueOnce([{ tva: '3000.00', ht: '15000.00' }]);
    const r = await service.compute('2026-04', 'monthly');
    expect(r.total_a_verser).toBe('0.00');
    expect(r.credit_a_reporter).toBe('2000.00');
    expect(r.warnings).toContain(expect.stringContaining('CREDIT_TVA_REPORTE'));
  });

  it('D4 -- aucune ecriture -> 0/0 has_data=false', async () => {
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const r = await service.compute('2026-04', 'monthly');
    expect(r.total_collectee).toBe('0.00');
    expect(r.recuperable.tva_amount).toBe('0.00');
    expect(r.total_a_verser).toBe('0.00');
    expect(r.has_data).toBe(false);
  });

  it('D5 -- 5 taux tous presents dans collectee_par_taux meme si 0', async () => {
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const r = await service.compute('2026-04', 'monthly');
    expect(r.collectee_par_taux).toHaveLength(5);
    expect(r.collectee_par_taux.map((c) => c.taux)).toEqual([0, 7, 10, 14, 20]);
    expect(r.collectee_par_taux.find((c) => c.taux === 0)?.account_code).toBe('44551');
    expect(r.collectee_par_taux.find((c) => c.taux === 20)?.account_code).toBe('44555');
  });

  it('D6 -- detectRegime > 1MMAD -> monthly', async () => {
    dataSource.query.mockResolvedValueOnce([{ ca_ht: '1500000.00' }]);
    const r = await service.detectRegime();
    expect(r).toBe('monthly');
  });

  it('D7 -- detectRegime <= 1MMAD -> quarterly', async () => {
    dataSource.query.mockResolvedValueOnce([{ ca_ht: '500000.00' }]);
    const r = await service.detectRegime();
    expect(r).toBe('quarterly');
  });

  it('D8 -- period format 2026-13 invalide leve INVALID_PERIOD', async () => {
    await expect(service.compute('2026-13', 'monthly')).rejects.toMatchObject({
      response: { code: 'INVALID_PERIOD' },
    });
  });

  it('D9 -- tenant context absent leve TENANT_CONTEXT_MISSING', async () => {
    vi.spyOn(TenantContext, 'getTenantId').mockReturnValue(undefined as unknown as string);
    await expect(service.compute('2026-04', 'monthly')).rejects.toMatchObject({
      response: { code: 'TENANT_CONTEXT_MISSING' },
    });
  });

  it('D10 -- query exclut entries reverses', async () => {
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await service.compute('2026-04', 'monthly');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('reversed_by_entry_id IS NULL'),
      expect.any(Array),
    );
  });

  it('D11 -- query filtre status validated', async () => {
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await service.compute('2026-04', 'monthly');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining(`status = 'validated'`),
      expect.any(Array),
    );
  });

  it('D12 -- generated_at en ISO 8601', async () => {
    dataSource.query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const r = await service.compute('2026-04', 'monthly');
    expect(r.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('D13 -- parsePeriod Q3 -> juillet-septembre', () => {
    const { dateStart, dateEnd } = service.parsePeriod('2026-Q3', 'quarterly');
    expect(dateStart.toISOString().slice(0, 7)).toBe('2026-07');
    expect(dateEnd.toISOString().slice(0, 7)).toBe('2026-09');
  });

  it('D14 -- computeDueDate monthly 2026-04 -> 30 mai', () => {
    const dueDate = service.computeDueDate(new Date('2026-04-30T23:59:59Z'), 'monthly');
    expect(dueDate.toISOString().slice(0, 10)).toBe('2026-05-30');
  });
});
```

### 7.3 Tests integration (12 cas avec Postgres testcontainer)

```typescript
// repo/packages/books/test/integration/tva.integration.spec.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { DataSource } from 'typeorm';
import { TenantContext } from '@insurtech/shared-utils';
import { TvaDeclarationService } from '../../src/services/tva-declaration.service';
import { vi } from 'vitest';

describe('TVA integration Postgres', () => {
  let pg: StartedTestContainer;
  let ds: DataSource;
  let service: TvaDeclarationService;
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
    });
    await ds.initialize();
    await ds.runMigrations();
    await ds.query(`SET app.current_tenant = '${TENANT}'`);

    // Seed comptes minimum pour test
    await ds.query(`INSERT INTO books_accounts(tenant_id, code, label, nature, is_standard, active) VALUES
      (NULL, '4111', 'Clients', 'asset', true, true),
      (NULL, '5141', 'Banque', 'asset', true, true),
      (NULL, '71244', 'Commission RC', 'revenue', true, true),
      (NULL, '44555', 'TVA Facturee 20%', 'liability', true, true),
      (NULL, '44552', 'TVA Facturee 7%', 'liability', true, true),
      (NULL, '44551', 'TVA Facturee 0%', 'liability', true, true),
      (NULL, '3455', 'TVA Recuperable', 'asset', true, true),
      (NULL, '6131', 'Locations', 'expense', true, true)`);

    const logger = { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() };
    service = new TvaDeclarationService(ds, logger as any);
    vi.spyOn(TenantContext, 'getTenantId').mockReturnValue(TENANT);
  }, 120_000);

  afterAll(async () => {
    await ds.destroy();
    await pg.stop();
  });

  beforeEach(async () => {
    await ds.query('TRUNCATE books_journal_entries CASCADE');
    await ds.query('TRUNCATE books_journal_sequences CASCADE');
  });

  it('IT1 -- declaration agrege TVA 20% collectee', async () => {
    // Inserer ecriture vente : Client 1200 / Commission 1000 + TVA 200
    const entryId = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00001', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'Client', 1200, 0),
       ($1, $2, 2, '71244', 'Commission', 0, 1000),
       ($1, $2, 3, '44555', 'TVA 20%', 0, 200)`,
      [TENANT, entryId],
    );

    const r = await service.compute('2026-04', 'monthly');
    const tva20 = r.collectee_par_taux.find((c) => c.taux === 20)!;
    expect(tva20.tva_amount).toBe('200.00');
    expect(r.total_collectee).toBe('200.00');
  });

  it('IT2 -- declaration exclut entries reverses', async () => {
    // Entry validated puis reverse
    const entryA = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00010', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    const entryB = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at, reverses_entry_id)
         VALUES ($1, 'VEN', 'VEN-2026-00011', '2026-04-16', 'validated', 2026, 4, $1, $1, now(), $2) RETURNING id`,
        [TENANT, entryA],
      )
    )[0].id;
    // Update A : reversed_by
    await ds.query(`UPDATE books_journal_entries SET reversed_by_entry_id = $1 WHERE id = $2`, [
      entryB,
      entryA,
    ]);

    const r = await service.compute('2026-04', 'monthly');
    // L'entry A est exclue (reversed_by_entry_id IS NOT NULL)
    expect(r.has_data).toBe(false);
  });

  it('IT3 -- TVA recuperable agrege debit 3455', async () => {
    const entryId = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'ACH', 'ACH-2026-00001', '2026-04-10', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '6131', 'Loyer', 5000, 0),
       ($1, $2, 2, '3455', 'TVA Recup', 1000, 0),
       ($1, $2, 3, '4111', 'Fournisseur', 0, 6000)`,
      [TENANT, entryId],
    );

    const r = await service.compute('2026-04', 'monthly');
    expect(r.recuperable.tva_amount).toBe('1000.00');
  });

  it('IT4 -- a_verser = collectee - recuperable - credit_anterieur', async () => {
    // Setup : 5000 collectee, 1000 recuperable -> 4000 a verser
    const entryV = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00020', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 30000, 0),
       ($1, $2, 2, '71244', 'P', 0, 25000),
       ($1, $2, 3, '44555', 'T', 0, 5000)`,
      [TENANT, entryV],
    );
    const entryA = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'ACH', 'ACH-2026-00020', '2026-04-10', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '6131', 'L', 5000, 0),
       ($1, $2, 2, '3455', 'T', 1000, 0),
       ($1, $2, 3, '4111', 'F', 0, 6000)`,
      [TENANT, entryA],
    );

    const r = await service.compute('2026-04', 'monthly');
    expect(r.total_collectee).toBe('5000.00');
    expect(r.recuperable.tva_amount).toBe('1000.00');
    expect(r.total_a_verser).toBe('4000.00');
    expect(r.credit_a_reporter).toBe('0.00');
  });

  it('IT5 -- credit reporte si recuperable > collectee', async () => {
    // Setup : 1000 collectee, 3000 recuperable -> 2000 credit
    const entryV = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00030', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 6000, 0),
       ($1, $2, 2, '71244', 'P', 0, 5000),
       ($1, $2, 3, '44555', 'T', 0, 1000)`,
      [TENANT, entryV],
    );
    const entryA = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'ACH', 'ACH-2026-00030', '2026-04-10', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '6131', 'L', 15000, 0),
       ($1, $2, 2, '3455', 'T', 3000, 0),
       ($1, $2, 3, '4111', 'F', 0, 18000)`,
      [TENANT, entryA],
    );

    const r = await service.compute('2026-04', 'monthly');
    expect(r.total_a_verser).toBe('0.00');
    expect(r.credit_a_reporter).toBe('2000.00');
    expect(r.warnings.some((w) => w.includes('CREDIT_TVA_REPORTE'))).toBe(true);
  });

  it('IT6 -- multi-tenant isole TVA via RLS', async () => {
    const TB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    // Insert pour tenant B
    await ds.query(`SET app.current_tenant = '${TB}'`);
    const entryB = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-99001', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TB],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 1200, 0),
       ($1, $2, 2, '71244', 'P', 0, 1000),
       ($1, $2, 3, '44555', 'T', 0, 200)`,
      [TB, entryB],
    );

    // Switch tenant A
    await ds.query(`SET app.current_tenant = '${TENANT}'`);
    vi.spyOn(TenantContext, 'getTenantId').mockReturnValue(TENANT);
    const r = await service.compute('2026-04', 'monthly');
    expect(r.total_collectee).toBe('0.00'); // RLS isole, tenant A ne voit pas tenant B
  });

  it('IT7 -- declaration trimestrielle 2026-Q2 agreg avril+mai+juin', async () => {
    // Entry avril
    const entryAvr = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00040', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 1200, 0),
       ($1, $2, 2, '71244', 'P', 0, 1000),
       ($1, $2, 3, '44555', 'T', 0, 200)`,
      [TENANT, entryAvr],
    );
    // Entry mai
    const entryMai = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00041', '2026-05-15', 'validated', 2026, 5, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 2400, 0),
       ($1, $2, 2, '71244', 'P', 0, 2000),
       ($1, $2, 3, '44555', 'T', 0, 400)`,
      [TENANT, entryMai],
    );

    const r = await service.compute('2026-Q2', 'quarterly');
    expect(r.total_collectee).toBe('600.00'); // 200 + 400
    expect(r.due_date).toMatch(/^2026-07-31$/);
  });

  it('IT8 -- detect regime ca_ht > 1MMAD -> monthly', async () => {
    // Inserer ecritures revenus 1.5M
    const entry = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00060', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 1500000, 0),
       ($1, $2, 2, '71244', 'P', 0, 1500000)`,
      [TENANT, entry],
    );

    const r = await service.detectRegime();
    expect(r).toBe('monthly');
  });

  it('IT9 -- detect regime ca_ht <= 1MMAD -> quarterly', async () => {
    const entry = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00061', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 500000, 0),
       ($1, $2, 2, '71244', 'P', 0, 500000)`,
      [TENANT, entry],
    );

    const r = await service.detectRegime();
    expect(r).toBe('quarterly');
  });

  it('IT10 -- mois sans operations -> declaration vide has_data=false', async () => {
    const r = await service.compute('2026-12', 'monthly');
    expect(r.total_collectee).toBe('0.00');
    expect(r.recuperable.tva_amount).toBe('0.00');
    expect(r.has_data).toBe(false);
  });

  it('IT11 -- TVA 7% pharmaceutique tracee separement', async () => {
    const entry = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00070', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 107, 0),
       ($1, $2, 2, '71244', 'P', 0, 100),
       ($1, $2, 3, '44552', 'TVA 7%', 0, 7)`,
      [TENANT, entry],
    );

    const r = await service.compute('2026-04', 'monthly');
    const tva7 = r.collectee_par_taux.find((c) => c.taux === 7)!;
    expect(tva7.tva_amount).toBe('7.00');
    expect(tva7.account_code).toBe('44552');
    const tva20 = r.collectee_par_taux.find((c) => c.taux === 20)!;
    expect(tva20.tva_amount).toBe('0.00');
  });

  it('IT12 -- operations exonerees 0% genere warning prorata', async () => {
    const entry = (
      await ds.query(
        `INSERT INTO books_journal_entries(tenant_id, journal_code, entry_number, entry_date, status, exercise_year, period_month, created_by, validated_by, validated_at)
         VALUES ($1, 'VEN', 'VEN-2026-00080', '2026-04-15', 'validated', 2026, 4, $1, $1, now()) RETURNING id`,
        [TENANT],
      )
    )[0].id;
    await ds.query(
      `INSERT INTO books_journal_lines(tenant_id, journal_entry_id, line_number, account_code, label, debit, credit) VALUES
       ($1, $2, 1, '4111', 'C', 500, 0),
       ($1, $2, 2, '71244', 'Med', 0, 500),
       ($1, $2, 3, '44551', 'TVA 0%', 0, 0)`,
      [TENANT, entry],
    );

    const r = await service.compute('2026-04', 'monthly');
    // Si has_data avec operations 0 -> warning prorata
    expect(r.has_data).toBe(true);
  });
});
```

### 7.4 Tests E2E (14 cas API complete)

```typescript
// repo/apps/api/test/e2e/books/tva.controller.e2e-spec.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../../src/app.module';
import { signTestJwt } from '../../helpers/jwt.helper';

describe('TVA Controller E2E', () => {
  let app: NestFastifyApplication;
  let token: string;
  let readOnlyToken: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    token = signTestJwt({ sub: 'u1', role: 'BrokerAdmin', tenant_id: 'tA' });
    readOnlyToken = signTestJwt({ sub: 'u2', role: 'ReadOnly', tenant_id: 'tA' });
  });
  afterAll(async () => app.close());

  it('E1 -- GET /rates renvoie 5 taux + meta', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/rates',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body).toHaveLength(5);
    const tauxValues = body.map((b: any) => b.taux).sort();
    expect(tauxValues).toEqual([0, 7, 10, 14, 20]);
  });

  it('E2 -- GET /categories renvoie liste categories metier', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/categories',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.length).toBeGreaterThan(15);
    expect(body.find((c: any) => c.category === 'insurance_brokerage')).toBeDefined();
    expect(body.find((c: any) => c.category === 'auto_repair_labor')).toBeDefined();
  });

  it('E3 -- GET /calculate ht=100 taux=20 -> ttc 120', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/calculate?ht=100&taux=20',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.ttc).toBe('120.00');
    expect(body.tva).toBe('20.00');
  });

  it('E4 -- GET /calculate ttc=120 taux=20 -> ht 100', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/calculate?ttc=120&taux=20',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(JSON.parse(r.body).ht).toBe('100.00');
  });

  it('E5 -- GET /calculate sans ht ni ttc -> 400', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/calculate?taux=20',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('E6 -- GET /calculate avec ht ET ttc fournis -> 400', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/calculate?ht=100&ttc=120&taux=20',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('E7 -- GET /calculate taux 25 (non MA) -> 400', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/calculate?ht=100&taux=25',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('E8 -- POST /breakdown 3 lignes mixtes', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/books/tva/breakdown',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
      payload: {
        lines: [
          { ht: 100, taux: 20 },
          { ht: 200, taux: 10 },
          { ht: 50, taux: 7 },
        ],
      },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.total_ht).toBe('350.00');
    expect(body.totals_by_taux['20'].tva).toBe('20.00');
    expect(body.totals_by_taux['10'].tva).toBe('20.00');
    expect(body.totals_by_taux['7'].tva).toBe('3.50');
  });

  it('E9 -- POST /breakdown lignes vides -> 400', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/books/tva/breakdown',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
      payload: { lines: [] },
    });
    expect(r.statusCode).toBe(400);
  });

  it('E10 -- POST /breakdown > 999 lignes -> 400', async () => {
    const lines = Array.from({ length: 1000 }, () => ({ ht: 1, taux: 20 }));
    const r = await app.inject({
      method: 'POST',
      url: '/api/v1/books/tva/breakdown',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
      payload: { lines },
    });
    expect(r.statusCode).toBe(400);
  });

  it('E11 -- GET /declaration period=2026-04 -> structure SIMPL-TVA', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/declaration?period=2026-04',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(body.period).toBe('2026-04');
    expect(body.collectee_par_taux).toHaveLength(5);
    expect(body.due_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('E12 -- GET /declaration period=2026-13 -> 400 INVALID_PERIOD', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/declaration?period=2026-13',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(400);
  });

  it('E13 -- GET /declaration sans permission books.tva.declaration -> 403', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/declaration?period=2026-04',
      headers: { authorization: `Bearer ${readOnlyToken}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(403);
  });

  it('E14 -- GET /regime detecte regime tenant', async () => {
    const r = await app.inject({
      method: 'GET',
      url: '/api/v1/books/tva/regime',
      headers: { authorization: `Bearer ${token}`, 'x-tenant-id': 'tA' },
    });
    expect(r.statusCode).toBe(200);
    const body = JSON.parse(r.body);
    expect(['monthly', 'quarterly']).toContain(body.regime);
  });
});
```

### 7.5 Fixtures `tva-fixtures.ts`

```typescript
// repo/test/fixtures/tva-fixtures.ts

export const TVA_FIXTURES = {
  // Cas standards par categorie
  COMMISSION_COURTAGE_RC: {
    category: 'insurance_brokerage',
    ht: '10000.00',
    taux: 20,
    expected_tva: '2000.00',
    expected_ttc: '12000.00',
  },
  REPARATION_AUTO_LABOR: {
    category: 'auto_repair_labor',
    ht: '1500.00',
    taux: 20,
    expected_tva: '300.00',
    expected_ttc: '1800.00',
  },
  REPARATION_AUTO_PARTS: {
    category: 'auto_repair_parts',
    ht: '4000.00',
    taux: 20,
    expected_tva: '800.00',
    expected_ttc: '4800.00',
  },
  CONSULTATION_MEDICALE: {
    category: 'medical_consultation',
    ht: '500.00',
    taux: 0,
    expected_tva: '0.00',
    expected_ttc: '500.00',
  },
  PRODUITS_PHARMA: {
    category: 'medical_pharmaceutical',
    ht: '120.00',
    taux: 7,
    expected_tva: '8.40',
    expected_ttc: '128.40',
  },
  RESTAURANT_TOURISTE: {
    category: 'restaurant_tourism',
    ht: '450.00',
    taux: 10,
    expected_tva: '45.00',
    expected_ttc: '495.00',
  },
  TRANSPORT_LOCAL: {
    category: 'passenger_transport_local',
    ht: '85.00',
    taux: 14,
    expected_tva: '11.90',
    expected_ttc: '96.90',
  },
  EXPORT_COURTAGE: {
    category: 'export',
    ht: '50000.00',
    taux: 0,
    expected_tva: '0.00',
    expected_ttc: '50000.00',
  },

  // Edge cases precision
  ZERO_AMOUNT: { ht: '0.00', taux: 20, expected_tva: '0.00', expected_ttc: '0.00' },
  TINY: { ht: '0.01', taux: 20, expected_tva: '0.00', expected_ttc: '0.01' },
  LARGE: {
    ht: '999999.99',
    taux: 20,
    expected_tva: '200000.00',
    expected_ttc: '1199999.99',
  },
  ROUND_HALF: { ht: '0.05', taux: 20, expected_tva: '0.01', expected_ttc: '0.06' },
  ROUND_HALF_UP: { ht: '2.50', taux: 20, expected_tva: '0.50', expected_ttc: '3.00' },
  PRECISION_3_3_3: { ht: '33.33', taux: 20, expected_tva: '6.67', expected_ttc: '40.00' },

  // Multi-lignes pour test breakdown CGI
  HUNDRED_LINES_007_20: {
    lines: Array.from({ length: 100 }, () => ({ ht: '0.07', taux: 20 })),
    expected_total_ht: '7.00',
    expected_total_tva: '1.40',
    expected_total_ttc: '8.40',
  },
};

export const DECLARATION_FIXTURE_MONTHLY = {
  period: '2026-04',
  regime: 'monthly' as const,
  collectee: { '20': { tva: '2000.00', ht: '10000.00' } },
  recuperable: { tva: '500.00', ht: '2500.00' },
  expected_a_verser: '1500.00',
  expected_due_date: '2026-05-30',
};

export const DECLARATION_FIXTURE_QUARTERLY = {
  period: '2026-Q2',
  regime: 'quarterly' as const,
  collectee: { '20': { tva: '6000.00', ht: '30000.00' } },
  recuperable: { tva: '1500.00', ht: '7500.00' },
  expected_a_verser: '4500.00',
  expected_due_date: '2026-07-31',
};

export const DECLARATION_FIXTURE_CREDIT_REPORT = {
  period: '2026-04',
  regime: 'monthly' as const,
  collectee: { '20': { tva: '1000.00', ht: '5000.00' } },
  recuperable: { tva: '3000.00', ht: '15000.00' },
  expected_a_verser: '0.00',
  expected_credit_a_reporter: '2000.00',
};
```

---

## 8. Variables environnement

```env
# Aucune variable specifique TVA (taux hardcode CGI)
# Heritees taches precedentes
DATABASE_URL=postgresql://insurtech:secret@localhost:5432/insurtech_dev
REDIS_URL=redis://localhost:6379/2
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Tests unit
pnpm --filter @insurtech/books test:unit -- tva

# 2. Tests integration Postgres
pnpm --filter @insurtech/books test:integration -- tva

# 3. Tests E2E
pnpm --filter api test:e2e -- tva

# 4. Lint + typecheck
pnpm typecheck && pnpm lint

# 5. Coverage
pnpm vitest run --coverage repo/packages/books

# 6. Test manuel calculate
JWT=$(./scripts/get-test-jwt.sh)
curl "http://localhost:4000/api/v1/books/tva/calculate?ht=100&taux=20" \
  -H "Authorization: Bearer $JWT" -H "x-tenant-id: tA" | jq

# 7. Test manuel declaration
curl "http://localhost:4000/api/v1/books/tva/declaration?period=2026-04" \
  -H "Authorization: Bearer $JWT" -H "x-tenant-id: tA" | jq

# 8. Test manuel breakdown
curl -X POST http://localhost:4000/api/v1/books/tva/breakdown \
  -H "Authorization: Bearer $JWT" -H "x-tenant-id: tA" -H "Content-Type: application/json" \
  -d '{"lines":[{"ht":1000,"taux":20},{"ht":500,"taux":7}]}' | jq

# 9. No-emoji + no-console
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/books
grep -rn "console\.log" repo/packages/books --include="*.ts" --exclude="*.spec.ts"
```

---

## 10. Criteres validation V1-V32

### Criteres P0 (15 bloquants)

- **V1 (P0)** : 5 taux supportes (0, 7, 10, 14, 20). Test T1-T5 + T17.
- **V2 (P0)** : Decimal precision (0.1+0.2=0.30 strict, pas float). Test T9-T11.
- **V3 (P0)** : ROUND_HALF_UP au centime conformement CGI art 117. Test T10.
- **V4 (P0)** : calculateTtc et calculateHt bidirectionnel coherent. Test T1+T6.
- **V5 (P0)** : taux invalide rejete avec INVALID_TAUX. Test T15-T16.
- **V6 (P0)** : HT/TTC negatif rejete. Test T13-T14.
- **V7 (P0)** : breakdown rule CGI art 96-2 (sous-total HT par taux). Test T27.
- **V8 (P0)** : Categories couvertes pour insurtech (insurance, auto, medical, etc.). Test T18-T22.
- **V9 (P0)** : declaration agrege par taux (5 entrees meme si 0). Test D1+D5 + IT1+IT2.
- **V10 (P0)** : credit reporte si recuperable > collectee. Test D3 + IT5.
- **V11 (P0)** : detect regime monthly/quarterly selon CA. Test D6-D7 + IT8-IT9.
- **V12 (P0)** : exclut entries reverses. Test D10 + IT2.
- **V13 (P0)** : exclut entries draft (status=validated only). Test D11.
- **V14 (P0)** : 32 unit + 14 declaration + 12 integration + 14 E2E = 72 tests PASS.
- **V15 (P0)** : Aucune emoji + Lint + Typecheck OK.

### Criteres P1 (10 importants)

- **V16 (P1)** : Coverage >= 90% services + 85% controller.
- **V17 (P1)** : Latence calculate < 5ms (in-memory pure).
- **V18 (P1)** : Latence declaration < 500ms (10k entries via query indexee).
- **V19 (P1)** : Permissions catalog 3 perms ajoutees.
- **V20 (P1)** : Multi-tenant isole via RLS sur journal_lines. Test IT6.
- **V21 (P1)** : Due date calcule correct (30 mois suivant mensuel, 31 trimestriel). Test D1+D2+D14.
- **V22 (P1)** : Categories CGI articles documentees dans config. Test E2.
- **V23 (P1)** : Breakdown ttc-input fonctionne. Test T28.
- **V24 (P1)** : 100 lignes 0.07 HT 20% -> 1.40 MAD TVA (CGI rule). Test T27.
- **V25 (P1)** : Quarterly regime supporte. Test D2 + IT7.

### Criteres P2 (7 nice-to-have)

- **V26 (P2)** : Documentation README explique 5 taux + 25 categories + exemples.
- **V27 (P2)** : Swagger documente 6 endpoints.
- **V28 (P2)** : Audit log declaration generated (Sprint 5 task 2.1.12).
- **V29 (P2)** : Export JSON conforme structure SIMPL-TVA pre-XML.
- **V30 (P2)** : Performance benchmark documente (10k entries < 500ms).
- **V31 (P2)** : Fixtures reutilisables Sprint 14+ Insure.
- **V32 (P2)** : Mapping TVA accounts coherent avec Tache 3.5.1 seed (44551-44555 presents).

---

## 11. Edge cases + troubleshooting (12 cas detailles)

### EC1 : Float natif accidentel dans code derive

**Scenario** : developpeur Sprint 14+ utilise `+` natif au lieu de Decimal.
**Probleme** : erreurs precision insidieuses, 0.1+0.2 != 0.3.
**Solution** : code review systematique + ESLint rule custom `no-restricted-syntax: BinaryExpression[operator="+"][...]` (avance, optionnel). Tests V9-V11 detectent regression.
**Commande verif** : `grep -rn "amount + " repo/packages/books/src --include="*.ts"`.

### EC2 : Taux 18% legacy (ancien systeme MA pre-2003)

**Scenario** : import donnees historiques d'un ancien systeme avec taux 18%.
**Probleme** : Zod schema rejette, plante import.
**Solution** : data legacy doit etre re-categorisee a la migration (Sprint 27 admin import tool). Le service refuse strictement les taux hors [0,7,10,14,20] pour garantir conformite courante.

### EC3 : Ligne avec quantity = 0

**Scenario** : breakdown avec `quantity: 0`.
**Probleme** : ligne calculee = 0, mais semantiquement pas significatif.
**Solution** : Zod `min(0.01)` sur quantity rejette quantity=0.
**Test** : Zod schema TvaLineSchema avec quantity:0 -> validation error.

### EC4 : Categorie typo (insurance_brokarage)

**Scenario** : developpeur Sprint 14+ tape `insurance_brokarage` au lieu de `insurance_brokerage`.
**Probleme** : getTauxForCategory retourne fallback 20% silencieusement, mauvais compte associe.
**Solution** : warn log + metric `tva_unknown_category_total{category="..."}`. UI doit valider categorie depuis enum exhaustif. Tests T23 valide le log.

### EC5 : Periode mois 13

**Scenario** : `2026-13` invalide.
**Probleme** : query SQL avec mois inexistant.
**Solution** : Zod regex `^\d{4}-(0[1-9]|1[0-2]|Q[1-4])$` rejette en amont. Test E12 valide.

### EC6 : Trimestre Q5

**Scenario** : `2026-Q5` invalide.
**Probleme** : pas de 5e trimestre.
**Solution** : Zod regex `Q[1-4]` strict. Test D8.

### EC7 : Tenant change regime en cours d'annee

**Scenario** : tenant trimestriel passe a mensuel en juin (CA franchit 1MMAD au Q2).
**Probleme** : declarations Q1 trimestriel ok, mais juin doit etre mensuel.
**Solution** : detectRegime calcule rolling 12 mois ; UI affiche regime suggere chaque mois. Sprint 27 admin permet override manuel.

### EC8 : TVA negative (impossible mais defense en profondeur)

**Scenario** : agregat retourne valeur negative (donnee corrompue, journal_entries mal-formee).
**Probleme** : declaration avec total_collectee negatif est aberrante.
**Solution** : assertion `>= 0` avant retour, log error si detecte. Trigger DB Tache 3.5.2 garantit deja debit/credit non-negatifs.

### EC9 : Multiple comptes 4455x dans meme ecriture

**Scenario** : facture mixte avec TVA 20% sur main d'oeuvre + 7% sur pieces pharmaceutiques (rare mais possible Sprint 19+).
**Probleme** : ecriture avec 2 lignes 4455x distinctes.
**Solution** : agregation par compte fonctionne (chaque compte 4455x distinct dans GROUP BY). Test IT11 valide.

### EC10 : Categorie absent en base seed

**Scenario** : enum TS contient categorie X mais Tache 3.5.1 seed CGNC oublie le compte 4455x associe.
**Probleme** : ecriture echoue avec ACCOUNT_NOT_FOUND.
**Solution** : test invariant `validateTvaRatesCoverage()` au boot + test integration verifie presence 44551-44555.

### EC11 : Conversion devise non MAD

**Scenario** : facture EUR convertie en MAD pour declaration.
**Probleme** : taux du jour BAM volatile.
**Solution** : hors scope Sprint 12. Si journal_entry currency != MAD, exclure de declaration + alerte. Sprint 13+ multi-devise.

### EC12 : Date frontiere mois (timezone)

**Scenario** : entry_date `2026-04-30 23:59:59 UTC` -> a Casablanca (UTC+1) c'est 1er mai 00:59:59.
**Probleme** : ambiguite timezone : appartient a avril ou mai?
**Solution** : `entry_date` est `date` (pas `timestamptz`), pas d'ambiguite timezone Postgres. Stocke comme date pure (2026-04-30), interprete dans la zone applicative.

---

## 12. Conformite Maroc detaillee

### CGI 2026 (Code General des Impots) -- articles cles

- **Article 89** : taux normal 20% pour services. Implementation : default + categories insurance/repair/consulting.
- **Article 91** : exonerations sans droit de deduction (medical_consultation, banking_service, education). Mapping `exemption_type: 'without_deduction_right'`.
- **Article 92** : exonerations avec droit de deduction (export). Mapping `exemption_type: 'with_deduction_right'`. Implication Sprint 27 : prorata applicable seulement aux operations art 91.
- **Article 94** : services bancaires exoneration specifique.
- **Article 98** : taux 20% (taux normal applique a defaut). Default.
- **Article 99-2** : taux 14% (transports voyageurs locaux, beurre industriel, energie). passenger_transport_local.
- **Article 99-3** : taux 10% (restauration touristique, riz, huile, sel). restaurant_tourism, rice, cooking_oil.
- **Article 99-4** : taux 7% (eau, gaz, electricite menage, pharmaceutique). electricity, water, gas, medical_pharmaceutical.
- **Article 96-2** : regle d'arrondi sur sous-total par taux (rule fondamentale breakdown).
- **Article 110** : declarations mensuelles si CA HT > 1MMAD, trimestriel sinon. Implementation : `detectRegime`.
- **Article 117** : arrondi au centime au plus proche (ROUND_HALF_UP). Implementation : Decimal.js partout.
- **Article 103** : credit TVA reporte si recuperable > collectee. Implementation : `credit_a_reporter`.
- **Article 104** : prorata de deduction (entreprises mixtes). Hors scope Sprint 12, warning genere si detecte.
- **Article 115** : autoliquidation. Hors scope Sprint 12.
- **Article 88-bis** : retenue a la source 75% sur certains clients. Hors scope Sprint 12.
- **Article 184** : sanctions factures irregulieres 5000-20000 MAD + 100% recidive. Mitigation : conformite via Tache 3.5.5 invoices.
- **Article 185** : sanctions defaut declaration TVA. Echeance respectee via `due_date` automatique.

### Loi 9-88 CGNC

- **Article 18** : pieces conservees 10 ans. La declaration est generee a la demande, source = ecritures preservees (NO-DELETE trigger Tache 3.5.2).

### Loi 09-08 CNDP

- Conformite RLS multi-tenant Tache 3.5.2 + 3.5.4.
- Article 7 : data residency Maroc (Atlas DC1).

### Format SIMPL-TVA officiel DGI

- Schema XSD officiel publie par DGI (versions multiples).
- Sprint 12 prepare JSON structure compatible (5 taux + breakdown + due_date).
- Sprint 27 admin convertit en XML conforme + soumission portail.

---

## 13. Conventions absolues skalean-insurtech (rappel complet en extenso)

### 13.1 Multi-tenant strict
TenantContext propage strictement. TvaDeclarationService.compute() leve TENANT_CONTEXT_MISSING si absent. RLS Postgres actif sur queries journal_lines (heritee Tache 3.5.2). Header `x-insurtech-tenant-id` valide par TenantGuard avant atteinte controller.

### 13.2 Validation strict (Zod uniquement)
Tous DTOs valides par Zod schemas exportes `@insurtech/books/schemas/tva.schemas`. JAMAIS class-validator, JAMAIS yup, JAMAIS joi. Pattern : `Schema = z.object({...}).strict(); type = z.infer<...>;`. ZodPipe global applique aux controllers.

### 13.3 Logger strict (Pino DI)
Logger injecte par DI nestjs-pino. JAMAIS console.log (pre-commit hook check). Format JSON structured. Champs obligatoires : `msg, tenant_id, period, regime, action, duration_ms`.

### 13.4 Hash password strict (argon2id)
N/A pour cette tache (pas d'auth specifique consumer).

### 13.5 Package manager strict (pnpm)
pnpm only. `engine-strict=true` Node >= 22.11.0. `save-exact=true`. `link-workspace-packages=deep`.

### 13.6 TypeScript strict
`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`. Imports explicites. Pas de `any`.

### 13.7 Tests strict
Vitest unit + integration + E2E. Coverage cible >= 90% services, 85% controller. Cette tache : 32 unit + 14 declaration + 12 integration + 14 E2E = 72 tests.

### 13.8 RBAC strict
Permissions `books.tva.{read, calculate, declaration}` ajoutees catalog Sprint 7. RolesGuard + PermissionsGuard sur controller. ReadOnly bloque sur declaration (test E13).

### 13.9 Events strict
Pas d'events Kafka publies par cette tache (pure compute service). Si Sprint 27 admin declenche une declaration submitted -> emit `compliance.tva.declaration.submitted`.

### 13.10 Imports strict
Imports via `@insurtech/{nom}`. Order : 1) Node natifs 2) Externes (decimal.js, typeorm) 3) `@insurtech/*` 4) Relatifs.

### 13.11 Skalean AI strict (decision-005)
N/A pour cette tache. Sprint 30+ pourrait enrichir avec auto-classification categorie depuis description ecriture.

### 13.12 No-emoji strict (decision-006 ABSOLU)
AUCUNE emoji. Pre-commit hook rejette. CI fail. Cette tache : zero emoji.

### 13.13 Idempotency-Key strict
N/A pour cette tache (lectures pures, pas de mutations comptables).

### 13.14 Conventional Commits strict
Format `feat(sprint-12): description`. commitlint via husky.

### 13.15 Cloud souverain MA strict (decision-008)
Atlas Cloud DC1. Encryption at rest AES-256-GCM. TLS 1.3.

---

## 14. Validation pre-commit

```bash
#!/usr/bin/env bash
set -e
cd repo

echo "[1/7] typecheck..."
pnpm typecheck

echo "[2/7] lint..."
pnpm lint

echo "[3/7] unit tests..."
pnpm --filter @insurtech/books test:unit -- tva

echo "[4/7] integration tests..."
pnpm --filter @insurtech/books test:integration -- tva

echo "[5/7] E2E tests..."
pnpm --filter api test:e2e -- tva

echo "[6/7] coverage..."
pnpm vitest run --coverage repo/packages/books/test repo/packages/books/src

echo "[7/7] no-emoji + no-console..."
EMOJIS=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/books --exclude-dir=node_modules || true)
[ -n "$EMOJIS" ] && echo "FAIL emoji" && exit 1
CL=$(grep -rn "console\.log\|console\.debug" repo/packages/books --include="*.ts" --exclude="*.spec.ts" || true)
[ -n "$CL" ] && echo "FAIL console" && exit 1

echo "OK pre-commit Tache 3.5.4"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-12): TVA service 5 taux MA + declaration mensuelle

TvaService implemente calculs deterministes Decimal.js pour les 5 taux
TVA marocains (CGI art 89-99) :
- 0% : exoneration (export art 92, medical art 91, banking art 94)
- 7% : pharmaceutique, eau, gaz, electricite menage (art 99-4)
- 10% : restauration, riz, huile, sel (art 99-3)
- 14% : transports voyageurs, beurre industriel (art 99-2)
- 20% : taux normal -- courtage, garage, services (art 98)

Mapping 25 categories metier -> taux pour insurance_brokerage,
auto_repair_*, medical_*, electricity, etc. avec reference CGI article.

Methode breakdown applique rule CGI art 96-2 : TVA calculee sur
sous-total HT par taux, pas ligne par ligne (evite erreurs arrondi
cumulees, test V27 valide 100 lignes 0.07 -> 1.40 MAD).

TvaDeclarationService agrege ecritures journal_lines validated par
periode (mensuelle YYYY-MM ou trimestrielle YYYY-QN), produit JSON
prepare pour export SIMPL-TVA Sprint 27. Inclut credit reporte
(art 103), detection regime auto (art 110), due_date calcule
(30 mois suivant mensuel, 31 trimestriel).

Livrables:
- TvaService (5 taux + categories + breakdown + getRates)
- TvaDeclarationService (agregat + due_date + regime detection)
- 6 endpoints REST (rates, categories, calculate, breakdown,
  declaration, regime)
- 3 permissions RBAC (books.tva.{read, calculate, declaration})
- Config tva-rates avec 25 categories + CGI articles
- 32 unit + 14 declaration + 12 integration + 14 E2E = 72 tests
- Coverage 92%

Conformite:
- CGI art 88-bis, 89, 91, 92, 94, 96-2, 98, 99-2/3/4, 103, 104, 110, 115, 117, 184, 185
- Loi 9-88 art 18 (conservation)
- Loi 09-08 art 7 (data residency)

Task: 3.5.4
Sprint: 12
Reference: B-12 Tache 3.5.4"
```

---

## 16. Workflow next step

Apres commit valide :
- Verifier CI verte.
- Suite : **Tache 3.5.5 -- Invoices Module DGI** (`task-3.5.5-invoices-module-dgi-ice-rc-patente.md`). Cette tache utilise `TvaService.calculateTtc` et `breakdown` pour calculer la TVA des items de facture.

Si regression detectee, rollback : la tache est isolee (pure compute), revert commit sans impact sur Pay/Journal existants.

---

**Fin du prompt task-3.5.4-tva-service-5-taux-ma-declaration-mensuelle.md.**

Densite atteinte : ~125 ko (tests complets sans placeholder, 32+14+12+14=72 tests reels, CGI articles in extenso, edge cases detailles)
Code patterns : 6 fichiers complets (service TVA, service declaration, config, types, schemas, controller)
Tests : 72 cas concrets
Criteres validation : V1-V32
Edge cases : 12 detailles
Conformite : CGI 17 articles cites + loi 9-88 + loi 09-08
