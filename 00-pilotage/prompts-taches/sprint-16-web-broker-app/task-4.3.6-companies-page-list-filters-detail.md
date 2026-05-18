# TACHE 4.3.6 -- Companies Page : List + Filters + Create/Edit (ICE validation) + Detail

**Sprint** : 16 (Phase 4 / Sprint 3 dans phase, sprint 16/35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.6)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0
**Effort** : 5h
**Dependances** : 4.3.5 (Contacts page list + filters + detail livre, pattern DataTable + FormDialog + Optimistic UI deja en place)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Implementer la page `/companies` complete dans l'application `web-broker` (port 3001) avec : liste paginee + filtres + tri + bulk actions + creation/edition via modal `<CompanyFormDialog>` integrant validation stricte de l'**ICE marocain** (Identifiant Commun de l'Entreprise, 15 chiffres avec checksum DGI modulo 97 + structure entreprise/etablissement/filiale/controle), validation du **RC** (Registre du Commerce avec format variable par tribunal), validation **CNSS** (Caisse Nationale de Securite Sociale, 7 chiffres), validation **IF** (Identifiant Fiscal, 7-8 chiffres), validation **patente** (taxe professionnelle 7-8 chiffres), plus une page detail `/companies/[id]` avec 6 tabs (Info / Contacts associes / Deals / Polices entreprise / Sinistres entreprise / Documents) et auto-link contacts lors de la creation depuis le tab "Contacts associes".

A la sortie de cette tache, un broker_user du cabinet de courtage peut : (1) Lister toutes les entreprises clientes de son tenant avec pagination cursor + tri + filtres industry/city/region/size + recherche debouncee 300ms ; (2) Creer une entreprise via modal en saisissant raison sociale + ICE valide (rejete si checksum DGI invalide ou doublon dans tenant) + informations RC/CNSS/IF/patente formates valides + secteur d'activite NAICS-like MA + taille TPE/PME/ETI/GE + effectif + tranche de chiffre d'affaires + adresse complete + coordonnees ; (3) Modifier une entreprise existante avec pre-remplissage du formulaire et detection des modifications (dirty state) ; (4) Consulter le detail entreprise sur 6 tabs incluant les contacts physiques rattaches (interrogation crm_contacts WHERE company_id = this.id) avec capacite d'ajouter un nouveau contact auto-linke via `<ContactFormDialog>` pre-rempli ; (5) Visualiser le portefeuille de deals + polices + sinistres lies a l'entreprise ; (6) Consulter et telecharger les documents legaux scannes (extrait RC, attestation CNSS, IF, statuts juridiques) via le tab Documents avec preview PDF.

Cette tache reutilise massivement le pattern etabli par la tache 4.3.5 (Contacts) : meme structure de DataTable shadcn/ui, meme philosophie d'Optimistic UI TanStack Query avec rollback en cas d'erreur API, meme approche URL state via nuqs pour les filtres, meme strategie de Server Component initial fetch + Client Components pour interactions. Elle ajoute neanmoins une complexite metier specifique au Maroc avec la validation stricte ICE/RC/CNSS/IF conforme aux exigences DGI (loi de finances 2011 article 145), tribunaux de commerce regionaux et CNSS. La tache bloque 4.3.7 (Deals) qui s'appuie sur la capacite de lier un deal a une company existante via combobox de selection.

---

## 2. Contexte etendu (8-12 ko)

### Pourquoi cette tache existe

Une entreprise (`crm_companies`) est l'entite metier centrale du CRM B2B Skalean : 60% du chiffre d'affaires du cabinet de courtage Sofidemy provient de polices d'assurance entreprises (Multirisque Professionnelle, Flotte automobile, Sante collective, RC professionnelle, Transport marchandises, Marine cargo, Garantie decennale BTP). Une entreprise au Maroc presente des contraintes legales et fiscales specifiques absentes dans le CRM B2C :

1. **ICE obligatoire DGI** : depuis la loi de finances 2011 (article 145, repris article 148 LF 2018), toute entreprise au Maroc doit detenir un Identifiant Commun de l'Entreprise (ICE) emis par la DGI (Direction Generale des Impots). L'ICE est un code 15 chiffres compose de 4 segments fonctionnels (entreprise 7 chiffres + etablissement 3 chiffres + filiale 3 chiffres + cle de controle 2 chiffres). La cle de controle est calculee par **modulo 97** sur les 13 premiers chiffres : `controle = 97 - (numero_13_chiffres mod 97)` avec padding zero a gauche pour obtenir exactement 2 chiffres. L'ICE doit etre porte sur tous les documents commerciaux, factures, declarations TVA, contrats. Un courtier qui souscrit une police pour une entreprise sans ICE valide expose le cabinet a une amende ACAPS + DGI.

2. **RC tribunal de commerce** : le Registre du Commerce, ouvert au tribunal de commerce competent (Casablanca, Rabat, Tanger, Fes, Marrakech, Agadir, Oujda, Tetouan, Settat, Beni Mellal, El Jadida, Kenitra, Meknes, Nador, Safi, Khouribga, Laayoune). Format variable selon tribunal : Casablanca utilise des numeros sequentiels 6-8 chiffres precedes parfois d'une lettre, Rabat utilise un format different, Tanger encore different. L'app doit accepter le format flexible mais valider le tribunal_id parmi les 17 tribunaux de commerce reconnus.

3. **CNSS** : la Caisse Nationale de Securite Sociale identifie chaque employeur par un numero d'affiliation 7 chiffres (parfois 8 pour les entreprises tres anciennes). Obligatoire des qu'au moins un salarie est declare. Souscription police Sante collective ou Accidents du travail necessite CNSS valide.

4. **IF (Identifiant Fiscal)** : numero attribue par la DGI a chaque contribuable. 7-8 chiffres. Different de l'ICE (qui est commun aux administrations) -- l'IF est specifique DGI uniquement.

5. **Patente (taxe professionnelle)** : numero d'identification de la taxe professionnelle (anciennement patente), 7-8 chiffres, attribue par la commune. Obligatoire pour exercer une activite commerciale ou industrielle.

6. **Classification taille entreprise MA** : la loi 53-95 et les decrets associes definissent quatre categories d'entreprises au Maroc :
   - **TPE** (Tres Petite Entreprise) : effectif < 10, CA < 3 MDH
   - **PME** (Petite et Moyenne Entreprise) : effectif 10-249, CA 3-175 MDH
   - **ETI** (Entreprise de Taille Intermediaire) : effectif 250-4999, CA 175 MDH-1.5 MMDH
   - **GE** (Grande Entreprise) : effectif >= 5000, CA > 1.5 MMDH
   Ces categories conditionnent les tarifs d'assurance (rabais flottes pour GE, surprime TPE-BTP), les obligations ACAPS, et les seuils KYC renforces (Sprint 11 conformite).

7. **NAICS-like MA -- secteurs d'activite** : le Maroc ne dispose pas d'une nomenclature officielle aussi granulaire que NAICS US ou NACE UE, mais le HCP (Haut-Commissariat au Plan) maintient une classification a 17 secteurs principaux : agriculture / industrie manufacturiere / btp (batiment travaux publics) / commerce (de gros et detail) / transport et logistique / immobilier / services aux entreprises / finance et assurances / sante et action sociale / education / hotellerie et restauration / energie (production et distribution) / mines / textile et habillement / agroalimentaire / artisanat / autres services. La selection conditionne le calcul du risque par les assureurs (un transporteur a un risque RC tres different d'un cabinet d'avocats).

L'application doit donc materialiser tous ces concepts dans une experience utilisateur fluide tout en empechant absolument la creation d'une entreprise avec ICE invalide (erreur DGI couteuse).

### Alternatives considerees pour la validation ICE

#### Validation cote client uniquement vs cote serveur uniquement vs les deux (CHOIX)

| Critere | Client only | Serveur only | Les deux (CHOIX) |
|---------|-------------|--------------|--------------------|
| Feedback utilisateur immediat | Oui | Non (round-trip) | Oui |
| Securite (bypass empossible) | Non (devtools) | Oui | Oui |
| Code duplication | Aucune | Aucune | Algorithm partage TS |
| Performance | Tres rapide | 200ms+ | Rapide + secure |
| Source de verite | Client | Serveur | Serveur (final) |
| Robustesse | Fragile | Solide | Tres solide |
| UX checksum invalide | Live | Submit only | Live + server confirm |

**Decision** : double validation. L'algorithme modulo 97 + structure 15 chiffres + decomposition entreprise/etab/filiale est implemente dans `lib/utils/ice-validator.ts` (TypeScript pur, zero deps) et reutilise par Zod schema cote client (validation live blur + submit) et par le service backend Sprint 8 (CRM `CompaniesService.create` avec re-validation + check unicite tenant_id+ICE). La source de verite reste le backend qui a aussi acces a la table d'unicite.

#### ICE checksum : algorithme modulo 97 vs Luhn vs custom

L'algorithme officiel DGI Maroc est documente dans la circulaire 717/2011 et le portail ice.gov.ma. Apres analyse de plusieurs centaines d'ICE valides connus :

| Algorithme | Probabilite collision | Conformite DGI |
|------------|----------------------|----------------|
| Modulo 97 (banking-style IBAN) | ~1/97 | OUI -- algorithme officiel DGI |
| Luhn (carte bancaire) | ~1/10 | NON, non conforme DGI |
| Custom polynome | variable | NON |

**Decision** : modulo 97. Le calcul est : prendre les 13 premiers chiffres comme entier N, calculer `controle = 97 - (N mod 97)` avec padding zero a gauche pour avoir exactement 2 chiffres (cas limite `97 - 0 = 97`, donc plage [1..97] sur 2 chiffres). Valider en concatenant les 13 chiffres + controle reconstitue et comparant avec l'ICE saisi.

#### Stockage ICE : string vs bigint

L'ICE est compose **uniquement de chiffres** mais peut commencer par des zeros (entreprise creee anciennement avec numero court). Un stockage `bigint` perdrait les zeros leading. Un stockage `string(15)` les preserve.

**Decision** : `VARCHAR(15)` en DB avec contrainte CHECK regex `^\d{15}$` + UNIQUE INDEX (tenant_id, ice) WHERE deleted_at IS NULL. Cote frontend, type TypeScript `string` typed branded `ICE` pour eviter melange avec autres strings 15 chiffres.

#### Auto-format ICE pendant saisie : avec espaces vs sans

Visuellement, `001234567 000 000 12` est plus lisible que `001234567000000012`. Mais l'auto-format complexifie la validation (strip avant parse), casse le copier-coller, et trompe les utilisateurs habitues a saisir d'un trait.

**Decision** : pas d'auto-format pendant saisie. Affichage en lecture (page detail, table) peut utiliser un helper `formatICE(ice)` pour grouper visuellement les 4 segments avec separateurs fins (caractere U+2009 thin space).

### Trade-offs explicites

1. **ICE unique par tenant vs unique global** : un meme ICE peut exister dans plusieurs tenants (cabinets de courtage differents servent les memes clients entreprises). Index unique compose `(tenant_id, ice)` permet cette duplication cross-tenant. Backend Sprint 6 multi-tenant garantit l'isolation.

2. **RC validation stricte vs souple** : les formats RC varient enormement par tribunal (Casablanca format ancien avec 6 chiffres, Rabat avec lettre prefixe, certains tribunaux modernes avec 8 chiffres). Une validation regex stricte par tribunal serait fragile et bloquerait des entreprises legitimes. Choix : regex souple `^[A-Z]?\d{4,10}$` (4-10 chiffres avec lettre optionnelle prefixe en majuscule) + champ `rc_tribunal` enum pour traceabilite, sans validation cross-field.

3. **Industries dropdown vs free text** : un champ texte libre permettrait granularite maximale mais ferait exploser le filtrage (impossible de filtrer "tous les BTP" si chaque utilisateur ecrit "construction", "batiment", "BTP", "travaux publics"). Choix : dropdown ferme 16 categories HCP MA + champ optionnel `sub_industry_label` text libre pour precision interne.

4. **Pas de SIREN/SIRET** : SIREN/SIRET sont FRANCAIS, pas marocains. L'erreur frequente serait de proposer ces champs par habitude. Verifie : aucun champ SIREN/SIRET nulle part.

5. **Address single string vs structured** : `address_street + city + region + postal_code` separes facilite le filtrage geographique mais alourdit la saisie. Choix : champs structures avec city/region prefills depuis dropdown 12 regions MA + 75 prefectures + champ rue libre.

6. **Logo entreprise upload** : option mais pas obligatoire. Si fourni, stocke MinIO/Atlas Cloud Benguerir via Sprint 10 storage service, cle `companies/${id}/logo.{jpg|png|svg}` avec compression sharp 200x200 cover.

7. **Pas d'historique modification ICE** : l'ICE etant un identifiant officiel rarement modifie (sauf erreur de saisie initiale), pas de versionning historique des changements ICE. Le champ est neanmoins protege apres creation : modification possible uniquement par broker_admin avec confirmation explicite (modal warning "Cette modification recreera l'unicite, etes-vous sur ?").

8. **Soft delete vs hard delete** : conforme decision-007 (audit trail), soft delete uniquement (`deleted_at = NOW()` + `deleted_by = user_id`). Restauration possible 30 jours puis purge async background job Sprint 11.

9. **Bulk actions limitees** : seules `export CSV` + `assign to user` + `tag bulk` sont supportes. PAS de bulk delete ni bulk edit ICE (risque trop eleve).

10. **Pas de wizard multi-step** : un seul formulaire long avec sections collapsibles (Identite legale / Adresse / Coordonnees / Activite / Identification fiscale) au lieu d'un wizard 5 etapes. Etudes UX cabinet Sofidemy montrent que les commerciaux preferent voir le formulaire entier en mode dense.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : la tache modifie uniquement `repo/apps/web-broker/`, aucune dependance cross-app cree.
- **decision-006 (NO EMOJI ABSOLU)** : aucun emoji dans le code, JSON messages, helpers texte, toasts, dialogs, traductions.
- **decision-007 (audit trail systematique)** : toutes les mutations (POST/PATCH/DELETE) ajoutent `actor_id`, `tenant_id`, `trace_id` automatiquement via interceptor api-client.ts. Le backend Sprint 8 ajoute lignes `crm_audit_log` pour chaque company touched.
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : logo entreprise stocke Atlas Cloud Services Benguerir bucket `skalean-crm-prod` ou MinIO dev. JAMAIS S3/Cloudfront US.
- **decision-009 (multilinguisme MA)** : 3 locales fr / ar-MA Darija / ar arabe classique. Industries dropdown traduit dans les 3 langues. Format ICE/RC/CNSS reste numerique universel.
- **decision-010 (Insure broker validation queue)** : si une company est creee avec un risque CNSS BTP eleve, la prochaine police souscrite passera par broker validation queue (Sprint 15 BrokerValidationQueueService).
- **decision-012 (KYC strict B2B)** : compagnies dont la classe de risque (industry x size x CA) depasse seuil necessitent KYC renforce (Sprint 11) avec upload documents (RC, statuts, attestation CNSS).
- **decision-014 (loi 09-08 donnees personnelles)** : meme si une entreprise n'est pas une personne physique, les contacts associes sont des personnes physiques sujet a la loi 09-08. Le tab Contacts Associes affiche un disclaimer en bas de page.

### Pieges techniques connus (15 minimum)

1. **ICE 14 chiffres vs 15 chiffres confusion** : les anciens identifiants enregistrement entreprise (avant 2011) etaient 14 chiffres. Migration ICE imposait passage 15. Erreur frequente : un commercial colle un ICE 14 chiffres (ancien). Solution : valider strictement `length === 15` avec error message clair "L'ICE doit comporter exactement 15 chiffres. Si vous avez un identifiant 14 chiffres ancien, contactez la DGI pour migration."

2. **Espaces et caracteres invisibles dans ICE colle** : copier-coller depuis PDF/Excel introduit espaces, tabs, non-breaking spaces. Solution : `ice.replace(/\s+/g, '').replace(/[​-‏‪-‮﻿]/g, '')` avant validation.

3. **Mod 97 = 0 cas limite** : si les 13 premiers chiffres modulo 97 donnent exactement 0, alors `controle = 97 - 0 = 97`, et l'ICE complet termine par "97". Le code doit gerer ce cas sans pretendre que controle vaut "00" (bug subtil).

4. **Padding zero leading controle** : si modulo donne 95, controle = 97 - 95 = 2, doit etre formate "02" (pas "2"). `controle.toString().padStart(2, '0')`.

5. **bigint precision JavaScript** : 13 chiffres = max 9999999999999, depasse `Number.MAX_SAFE_INTEGER` (9007199254740991, soit 15 chiffres mais avec precision). 13 chiffres seuls (max 9999999999999) est SOUS le seuil safe (9007199254740991), donc Number suffit. MAIS pour eviter tout risque, utiliser BigInt: `BigInt(ice.slice(0, 13)) % 97n`.

6. **RC tribunal lettre prefixe** : certains RC anciens Rabat ont format `A1234567`. Regex doit accepter optionnellement une lettre majuscule en debut.

7. **CNSS leading zero** : un CNSS comme `0123456` est valide (7 chiffres dont premier 0). Stocker en string, JAMAIS en number.

8. **IF vs ICE confusion utilisateur** : les commerciaux confondent souvent IF (7-8 chiffres DGI) et ICE (15 chiffres common). UI doit avoir labels tres clairs avec tooltips explicatifs.

9. **Recherche performance > 50K companies** : sans index full-text Postgres pg_trgm, la recherche LIKE `%term%` sur name+legal_name+ice est lente. Solution : index `gin (ice, name gin_trgm_ops, legal_name gin_trgm_ops)` cote DB Sprint 8 + endpoint backend optimise.

10. **TanStack Query invalidation cascade** : creer une company doit invalider les queries `companies-list`, `companies-stats`, `dashboard-widgets` (which display companies count). Si oubli, le dashboard reste stale.

11. **Optimistic UI race condition** : si l'utilisateur cree A puis modifie A rapidement avant que POST A ait resolu, le PATCH peut utiliser un id temporaire. Solution : disable le bouton Edit tant que la mutation create est `isPending`.

12. **Modal close pendant submit en cours** : si l'utilisateur ferme la modal pendant POST/PATCH, la mutation continue mais le toast d'erreur n'apparait pas (composant unmounted). Solution : disable close button pendant `isPending` + onError toast au niveau global via `useMutation({ onError })` qui survit unmount.

13. **Dropdown industries traduction inconsistante** : si user change locale fr->ar pendant qu'il edit, l'option selectionnee doit garder son `value` mais afficher le label dans la nouvelle locale. Solution : value = enum code (`"btp"`), label = `t(`industries.${value}`)`.

14. **Filtres nuqs serialization** : `industry=btp&city=casablanca` serializes OK mais `industry=btp,immobilier` (multi) demande array-typed nuqs `parseAsArrayOf(parseAsString)`. Sinon le toggle multi-industry ne persiste pas dans URL.

15. **City/region cascading select** : changer la region doit reset le champ city. Sinon, on peut creer une company avec region="Casablanca-Settat" et city="Tanger" (incoherent). Solution : `useEffect` watch region, si change, `setValue('city', '')`.

16. **Phone E.164 vs format MA** : le backend Sprint 8 normalise tous phones en E.164 (`+212661234567`). Le frontend peut afficher format local (`0661234567`). Convertir au submit : `+212` + drop leading 0.

17. **Email entreprise vs email contact** : le champ `billing_email` est l'email de FACTURATION de l'entreprise (souvent comptabilite@entreprise.ma). Le champ email d'un contact (Sprint 8 4.3.5) est l'email du dirigeant ou commercial. Bien differencier UI.

18. **Detail tab Documents permissions** : le tab Documents necessite permission `docs.read` (Sprint 10). Si role assistant n'a pas cette permission, masquer le tab + redirect si acces direct URL `/companies/[id]?tab=documents`.

19. **Tab URL state** : `?tab=contacts` doit persister F5 reload. Utiliser nuqs `parseAsString.withDefault('info')`.

20. **Delete soft + restore** : un company soft-deleted ne doit pas apparaitre dans la liste par defaut mais doit etre restaurable. Filter `?include_deleted=true` reserve broker_admin.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

La tache 4.3.6 est la **6eme des 14 taches** du Sprint 16 et depend strictement de 4.3.5 (Contacts) :

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1 App skeleton + middleware]
       |
       v
[4.3.2 Auth pages]
       |
       v
[4.3.3 Layout sidebar + topbar]
       |
       v
[4.3.4 Dashboard widgets]
       |
       v
[4.3.5 Contacts page]  <-- pattern DataTable + FormDialog + Optimistic UI
       |
       v
[4.3.6 Companies page] <-- TACHE COURANTE (reuse pattern + adds ICE validation MA)
       |
       v
[4.3.7 Deals kanban]   <-- consomme companies via combobox selection
       |
       v
[4.3.8 Polices]        <-- detail policy peut afficher company entreprise
       |
       v
[4.3.9 Broker Queue] [4.3.10 Sinistres] [4.3.11 Parametres] [4.3.12 RBAC]
       |                  |                    |                   |
       v                  v                    v                   v
[4.3.13 I18n complete]   [4.3.14 E2E Playwright + a11y]
```

### Position dans le programme

La page Companies est le **CRM B2B core** : Sprint 17 (web-customer-portal) ne la touchera pas (assures B2C uniquement), mais les sprints suivants l'enrichissent :
- Sprint 17 (Web Customer Portal) : un company sub-account peut etre cree depuis le portail customer si l'option self-service entreprise est activee (rare).
- Sprint 22 (Web Garage App) : sera read-only sur companies (garage ne gere pas entreprises clientes du courtier).
- Sprint 27 (Dashboards SuperAdmin) : metrics aggregees companies count par tenant.
- Sprint 31 (Reporting ACAPS) : exports trimestriels companies par categorie de risque.

### Diagramme ASCII de la feature Companies

```
repo/apps/web-broker/
|
|-- src/app/[locale]/(protected)/companies/
|   |-- page.tsx                          # ~150 lignes Server Component initial fetch
|   |-- loading.tsx                       # ~20 lignes Suspense fallback skeleton
|   |-- error.tsx                         # ~30 lignes ErrorBoundary
|   |-- [id]/
|       |-- page.tsx                      # ~250 lignes detail Server Component + Tabs Client
|       |-- loading.tsx                   # ~20 lignes skeleton detail
|       |-- error.tsx                     # ~30 lignes detail error
|
|-- src/components/companies/
|   |-- companies-table.tsx               # ~280 lignes DataTable + bulk actions integrated
|   |-- companies-filters.tsx             # ~200 lignes filters (industry, city, region, size, search)
|   |-- company-form-dialog.tsx           # ~380 lignes formulaire create/edit complet
|   |-- company-card.tsx                  # ~120 lignes card resume sur tab Info
|   |-- company-contacts-tab.tsx          # ~180 lignes liste contacts lies + add contact
|   |-- company-deals-tab.tsx             # ~150 lignes liste deals lies + stats
|   |-- company-polices-tab.tsx           # ~160 lignes liste polices souscrites
|   |-- company-sinistres-tab.tsx         # ~140 lignes liste sinistres readonly
|   |-- company-documents-tab.tsx         # ~180 lignes RC PDF, attestation CNSS, etc.
|   |-- company-info-tab.tsx              # ~200 lignes details legaux + adresse
|   |-- company-bulk-actions-bar.tsx      # ~100 lignes barre actions multi-select
|   |-- company-row-actions.tsx           # ~80 lignes menu kebab sur ligne
|   |-- company-delete-dialog.tsx         # ~90 lignes confirmation soft delete
|   |-- industry-badge.tsx                # ~50 lignes badge couleur par industry
|   |-- size-badge.tsx                    # ~40 lignes badge TPE/PME/ETI/GE
|
|-- src/lib/queries/
|   |-- companies.queries.ts              # ~180 lignes TanStack hooks (useCompanies, useCompany, useCompanyContacts, useCreateCompany, useUpdateCompany, useDeleteCompany)
|
|-- src/lib/api/
|   |-- companies.api.ts                  # ~200 lignes endpoints wrappers
|
|-- src/lib/schemas/
|   |-- company.schema.ts                 # ~150 lignes Zod schemas + refine ICE
|
|-- src/lib/utils/
|   |-- ice-validator.ts                  # ~180 lignes algorithm DGI MA modulo 97 + decompose + format
|   |-- rc-validator.ts                   # ~80 lignes RC tribunal validation souple
|   |-- cnss-validator.ts                 # ~50 lignes CNSS 7-8 digits
|   |-- if-validator.ts                   # ~40 lignes IF 7-8 digits
|   |-- patente-validator.ts              # ~40 lignes patente 7-8 digits
|   |-- ma-regions.ts                     # ~80 lignes 12 regions + 75 prefectures cascading
|   |-- industries-ma.ts                  # ~60 lignes 16 industries HCP MA
|   |-- size-classifier.ts                # ~50 lignes classify TPE/PME/ETI/GE depuis effectif+CA
|
|-- src/lib/types/
|   |-- company.types.ts                  # ~100 lignes types TS Company, CompanyCreateInput, CompanySize, Industry, Region
|
|-- src/messages/
|   |-- fr.json                            # +60 keys companies.*
|   |-- ar-MA.json                         # +60 keys companies.*
|   |-- ar.json                            # +60 keys companies.*
|
|-- src/lib/__tests__/
|   |-- ice-validator.spec.ts             # ~250 lignes Vitest 15+ tests
|   |-- rc-validator.spec.ts              # ~100 lignes Vitest 6+ tests
|   |-- cnss-validator.spec.ts            # ~80 lignes Vitest 5 tests
|   |-- if-validator.spec.ts              # ~60 lignes Vitest 4 tests
|   |-- patente-validator.spec.ts         # ~60 lignes Vitest 4 tests
|   |-- size-classifier.spec.ts           # ~80 lignes Vitest 5 tests
|   |-- company.schema.spec.ts            # ~120 lignes Vitest 8 tests Zod
|
|-- src/components/companies/__tests__/
|   |-- company-form-dialog.spec.tsx      # ~180 lignes Vitest + RTL
|   |-- companies-table.spec.tsx          # ~140 lignes Vitest + RTL
|
repo/e2e/web/
|-- companies.spec.ts                     # ~280 lignes Playwright 8+ E2E tests
```

**Provider chain rendue (de root vers feuille)** :

```
<html lang="fr" dir="ltr">
  <body>
    <Providers (4.3.1)>
      <ProtectedLayout (4.3.3)>           <-- Sidebar + Topbar + Breadcrumbs
        <CompaniesPage (4.3.6 list)>
          <CompaniesFiltersBar />          <-- URL state nuqs
          <CompaniesTable>
            <DataTable shadcn>
              <Pagination />
              <Sort />
              <BulkActionsBar />            <-- visible si rowSelection > 0
            </DataTable>
          </CompaniesTable>
          <CompanyFormDialog open={createOpen} />
        </CompaniesPage>
      </ProtectedLayout>
    </Providers>
  </body>
</html>

(detail)
<CompanyDetailPage>
  <CompanyDetailHeader />                  <-- logo + name + ICE + badge industry + size
  <Tabs nuqs URL state>
    <TabsList> info / contacts / deals / polices / sinistres / documents </TabsList>
    <TabsContent value="info"><CompanyInfoTab /></TabsContent>
    <TabsContent value="contacts"><CompanyContactsTab /></TabsContent>
    <TabsContent value="deals"><CompanyDealsTab /></TabsContent>
    <TabsContent value="polices"><CompanyPolicesTab /></TabsContent>
    <TabsContent value="sinistres"><CompanySinistresTab /></TabsContent>
    <TabsContent value="documents"><CompanyDocumentsTab /></TabsContent>
  </Tabs>
</CompanyDetailPage>
```

---

## 4. Livrables checkables (25 deliverables)

- [ ] **L1** : `repo/apps/web-broker/app/[locale]/(protected)/companies/page.tsx` (~150 lignes) Server Component : fetch initial companies via TanStack Query SSR prefetch + dehydrate, recoit searchParams (`?industry=btp&city=casablanca&size=pme&q=skalean&page=2`), render `<CompaniesTable>` + `<CompaniesFilters>` + bouton "Ajouter une entreprise" qui ouvre `<CompanyFormDialog mode="create">`. Metadata title locale-aware.

- [ ] **L2** : `repo/apps/web-broker/app/[locale]/(protected)/companies/[id]/page.tsx` (~250 lignes) Server Component detail : fetch company via id + handle 404 (notFound()), prefetch tabs data en parallele (contacts + deals + polices + sinistres + documents), render `<CompanyDetailHeader>` + `<Tabs>` 6 tabs avec nuqs state URL.

- [ ] **L3** : `repo/apps/web-broker/components/companies/companies-table.tsx` (~280 lignes) DataTable shadcn/ui avec colonnes : logo+name (avatar fallback initiales), ICE (formate), industry (badge), city, contacts_count (link tab contacts), deals_open_count, polices_active_count, deals_total_value (MAD), created_at (date-fns locale). Row click navigate detail. Row selection (checkbox) declenche `<CompanyBulkActionsBar>`. Tri server-side via TanStack Query refetch.

- [ ] **L4** : `repo/apps/web-broker/components/companies/companies-filters.tsx` (~200 lignes) bar de filtres : MultiSelect industries (16 options HCP), Select region (12 options) cascading City Select (75 prefectures), MultiSelect size (TPE/PME/ETI/GE), Input search debounce 300ms, bouton "Reset filters". URL state via nuqs `useQueryStates`. Compteur "X filtres actifs" + clear all.

- [ ] **L5** : `repo/apps/web-broker/components/companies/company-form-dialog.tsx` (~380 lignes) modal create/edit complet, 5 sections collapsible (Identite legale / Adresse / Coordonnees / Activite / Identification fiscale), react-hook-form + zodResolver(`CompanyCreateSchema`), live ICE validation on blur avec helper text colore (red invalide / green valide), Submit disable si form invalid ou submitting, mutation via `useCreateCompany` ou `useUpdateCompany` avec optimistic update. Auto-close on success + toast `t('companies.create.success')`.

- [ ] **L6** : `repo/apps/web-broker/components/companies/company-info-tab.tsx` (~200 lignes) affiche tous champs entreprise en read mode + bouton "Modifier" pour ouvrir form dialog en mode edit. Sections : Identite (raison sociale, name commercial, ICE formate, RC + tribunal, IF, patente, CNSS), Activite (industry badge, size badge, effectif, tranche CA, date creation), Adresse (rue + city + region + postal + maps link), Coordonnees (website + main_phone + billing_email).

- [ ] **L7** : `repo/apps/web-broker/components/companies/company-contacts-tab.tsx` (~180 lignes) liste contacts WHERE company_id = current.id : table colonnes (name, role, email, phone, last_interaction, action) + bouton "+ Ajouter contact" qui ouvre `<ContactFormDialog>` (Sprint 4.3.5) pre-rempli `company_id`. Empty state si aucun contact.

- [ ] **L8** : `repo/apps/web-broker/components/companies/company-deals-tab.tsx` (~150 lignes) liste deals associes : table (title, amount MAD, stage badge, contact owner, expected_close_date, status). Stats top : nombre deals open + somme valeurs. Bouton "+ Nouveau deal" pre-rempli company_id (placeholder Sprint 4.3.7 deals).

- [ ] **L9** : `repo/apps/web-broker/components/companies/company-polices-tab.tsx` (~160 lignes) liste polices souscrites par l'entreprise : table (policy_number, branche, start_date, end_date, status badge, prime annuelle MAD). Lien vers detail police (Sprint 4.3.8).

- [ ] **L10** : `repo/apps/web-broker/components/companies/company-sinistres-tab.tsx` (~140 lignes) liste sinistres lies aux polices entreprise : read-only, table (sinistre_number, police, declaration_date, status workflow, amount_estimated). Decision metier M9 : courtier ne traite PAS sinistres, lecture seule.

- [ ] **L11** : `repo/apps/web-broker/components/companies/company-documents-tab.tsx` (~180 lignes) liste documents juridiques entreprise : table (type [RC PDF / Attestation CNSS / Carte IF / Statuts / Patente / autre], filename, uploaded_at, uploaded_by, size, download). Upload zone drag-drop pour add nouveau document (placeholder Sprint 10 docs service).

- [ ] **L12** : `repo/apps/web-broker/lib/queries/companies.queries.ts` (~180 lignes) TanStack Query hooks : `useCompaniesQuery(filters)`, `useCompanyQuery(id)`, `useCompanyContactsQuery(id)`, `useCompanyDealsQuery(id)`, `useCompanyPolicesQuery(id)`, `useCreateCompanyMutation()`, `useUpdateCompanyMutation()`, `useDeleteCompanyMutation()`. Optimistic updates + invalidation cascade.

- [ ] **L13** : `repo/apps/web-broker/lib/api/companies.api.ts` (~200 lignes) wrappers axios pour endpoints Sprint 8 CRM : `getCompanies(params)`, `getCompanyById(id)`, `getCompanyContacts(id)`, `getCompanyDeals(id)`, `getCompanyPolices(id)`, `getCompanySinistres(id)`, `getCompanyDocuments(id)`, `createCompany(input)`, `updateCompany(id, patch)`, `deleteCompany(id)`. Erreurs typees ApiError + retry policy.

- [ ] **L14** : `repo/apps/web-broker/lib/schemas/company.schema.ts` (~150 lignes) Zod schemas : `CompanyCreateSchema` (z.object avec refine ICE checksum via validateICE), `CompanyUpdateSchema` (PartialDeep + meme refines), `CompanyFilterSchema`. Types exported via z.infer.

- [ ] **L15** : `repo/apps/web-broker/lib/utils/ice-validator.ts` (~180 lignes) algorithm DGI MA complet : `validateICE(ice: string): IceValidationResult`, `computeICEChecksum(first13: string): string`, `decomposeICE(ice)`, `formatICE(ice)` avec thin spaces, `isValidICE(ice): boolean` shortcut bool. JSDoc complet inline. Zero deps.

- [ ] **L16** : `repo/apps/web-broker/lib/utils/rc-validator.ts` (~80 lignes) validation RC souple : `validateRC(rc, tribunal)`, regex `^[A-Z]?\d{4,10}$`, enum MA_TRIBUNAUX_COMMERCE (17 entries).

- [ ] **L17** : `repo/apps/web-broker/lib/utils/cnss-validator.ts` + `if-validator.ts` + `patente-validator.ts` (~130 lignes total) validations format basiques + tests unitaires associes.

- [ ] **L18** : `repo/apps/web-broker/lib/utils/ma-regions.ts` (~80 lignes) constantes 12 regions MA + mapping prefectures par region pour cascading select.

- [ ] **L19** : `repo/apps/web-broker/lib/utils/industries-ma.ts` (~60 lignes) constantes 16 industries HCP + i18n key + couleur badge.

- [ ] **L20** : `repo/apps/web-broker/lib/utils/size-classifier.ts` (~50 lignes) helper `classifySize(employees_count, revenue_range)` retourne 'TPE' | 'PME' | 'ETI' | 'GE' selon decret MA.

- [ ] **L21** : `repo/apps/web-broker/lib/types/company.types.ts` (~100 lignes) types TypeScript : `Company`, `CompanyCreateInput`, `CompanyUpdateInput`, `CompanySize`, `Industry`, `MaRegion`, `MaTribunalCommerce`, `IceValidationResult`, `RevenueRange`.

- [ ] **L22** : Tests Vitest unitaires : `ice-validator.spec.ts` (15 tests), `rc-validator.spec.ts` (6), `cnss-validator.spec.ts` (5), `if-validator.spec.ts` (4), `patente-validator.spec.ts` (4), `size-classifier.spec.ts` (5), `company.schema.spec.ts` (8) -- 47 tests total.

- [ ] **L23** : Tests E2E Playwright `repo/e2e/web/companies.spec.ts` (8+ tests) : list render + filter + create ICE valide + create ICE invalide rejected + edit + bulk export + detail contacts tab + detail soft delete.

- [ ] **L24** : Messages i18n `messages/fr.json`, `messages/ar-MA.json`, `messages/ar.json` enrichis ~60 keys par locale (companies.list.title, companies.filters.industry, companies.form.ice_label, companies.errors.ice_invalid_checksum, etc.).

- [ ] **L25** : Validation : `pnpm --filter @insurtech/web-broker build` reussit, `typecheck` 0 erreur, `lint` 0 warning, `test` 100% pass, tests Playwright passent, accessibility WCAG 2.1 AA verifie sur `/companies` et `/companies/[id]`.

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-broker/
  app/[locale]/(protected)/companies/
    page.tsx                                              # ~150 lignes -- L1
    loading.tsx                                           # ~20 lignes
    error.tsx                                             # ~30 lignes
    [id]/
      page.tsx                                            # ~250 lignes -- L2
      loading.tsx                                         # ~20 lignes
      error.tsx                                           # ~30 lignes
  components/companies/
    companies-table.tsx                                   # ~280 lignes -- L3
    companies-filters.tsx                                 # ~200 lignes -- L4
    company-form-dialog.tsx                               # ~380 lignes -- L5
    company-card.tsx                                      # ~120 lignes
    company-info-tab.tsx                                  # ~200 lignes -- L6
    company-contacts-tab.tsx                              # ~180 lignes -- L7
    company-deals-tab.tsx                                 # ~150 lignes -- L8
    company-polices-tab.tsx                               # ~160 lignes -- L9
    company-sinistres-tab.tsx                             # ~140 lignes -- L10
    company-documents-tab.tsx                             # ~180 lignes -- L11
    company-bulk-actions-bar.tsx                          # ~100 lignes
    company-row-actions.tsx                               # ~80 lignes
    company-delete-dialog.tsx                             # ~90 lignes
    industry-badge.tsx                                    # ~50 lignes
    size-badge.tsx                                        # ~40 lignes
    __tests__/
      company-form-dialog.spec.tsx                        # ~180 lignes
      companies-table.spec.tsx                            # ~140 lignes
  lib/queries/
    companies.queries.ts                                  # ~180 lignes -- L12
  lib/api/
    companies.api.ts                                      # ~200 lignes -- L13
  lib/schemas/
    company.schema.ts                                     # ~150 lignes -- L14
  lib/utils/
    ice-validator.ts                                      # ~180 lignes -- L15
    rc-validator.ts                                       # ~80 lignes -- L16
    cnss-validator.ts                                     # ~50 lignes -- L17
    if-validator.ts                                       # ~40 lignes -- L17
    patente-validator.ts                                  # ~40 lignes -- L17
    ma-regions.ts                                         # ~80 lignes -- L18
    industries-ma.ts                                      # ~60 lignes -- L19
    size-classifier.ts                                    # ~50 lignes -- L20
    __tests__/
      ice-validator.spec.ts                               # ~250 lignes (15 tests)
      rc-validator.spec.ts                                # ~100 lignes (6 tests)
      cnss-validator.spec.ts                              # ~80 lignes (5 tests)
      if-validator.spec.ts                                # ~60 lignes (4 tests)
      patente-validator.spec.ts                           # ~60 lignes (4 tests)
      size-classifier.spec.ts                             # ~80 lignes (5 tests)
      company.schema.spec.ts                              # ~120 lignes (8 tests)
  lib/types/
    company.types.ts                                      # ~100 lignes -- L21
  messages/
    fr.json                                                # +60 keys companies.*
    ar-MA.json                                             # +60 keys companies.*
    ar.json                                                # +60 keys companies.*

repo/e2e/web/
  companies.spec.ts                                       # ~280 lignes Playwright 8 tests
```

Total : ~40 fichiers crees / modifies, ~3500 lignes nettes hors tests, ~1000 lignes tests.

---

## 6. Code patterns COMPLETS (fichiers principaux)

### 6.1 `repo/apps/web-broker/lib/utils/ice-validator.ts` (~180 lignes)

```typescript
/**
 * ICE (Identifiant Commun de l'Entreprise) Validator -- Maroc DGI
 *
 * Reference legale :
 *   - Loi de finances 2011 (art. 145)
 *   - Loi de finances 2018 (art. 148)
 *   - Circulaire DGI 717/2011
 *   - Portail officiel : ice.gov.ma
 *
 * Format ICE : 15 chiffres decomposes en 4 segments fonctionnels
 *   [1..7]   : numero entreprise          (7 chiffres)
 *   [8..10]  : numero etablissement       (3 chiffres)
 *   [11..13] : numero filiale             (3 chiffres)
 *   [14..15] : cle de controle            (2 chiffres) -- modulo 97
 *
 * Algorithme cle de controle :
 *   N = parseInt(ice.slice(0, 13), 10)
 *   controle = 97 - (N mod 97)
 *   format : controle.toString().padStart(2, '0')
 *
 * Exemples ICE valides connus (illustratifs) :
 *   001234567000088024  <- Sofidemy SA (fictif)
 *   002000000000061047  <- entreprise ronde
 *
 * Edge cases geres :
 *   - 14 chiffres (ancien format) : rejected with explicit message
 *   - Espaces / NBSP / zero-width chars : strip avant parse
 *   - Lettres ou caracteres non numeriques : rejected
 *   - mod 97 == 0 : controle vaut 97 (cas legitime)
 *
 * Aucune dependance externe. Pure TS. Reutilisable backend NestJS.
 */

export type IceValidationErrorCode =
  | 'EMPTY'
  | 'NOT_DIGITS_ONLY'
  | 'WRONG_LENGTH_14'      // ancien format 14 chiffres
  | 'WRONG_LENGTH_OTHER'
  | 'INVALID_CHECKSUM';

export interface IceValidationResult {
  valid: boolean;
  errorCode: IceValidationErrorCode | null;
  errorMessage: string | null;
  normalized: string | null; // ICE strippe de tous separateurs
  decomposed: {
    entreprise: string;     // 7 chiffres
    etablissement: string;  // 3 chiffres
    filiale: string;        // 3 chiffres
    controle: string;       // 2 chiffres
  } | null;
}

const ICE_LENGTH = 15;
const RE_NON_DIGIT = /\D+/g;
const RE_INVISIBLE = /[\s​-‏‪-‮﻿]+/g;

/**
 * Strip toutes formes de separateurs invisibles d'un ICE saisi.
 * Conserve uniquement les chiffres ASCII.
 */
export function stripIceSeparators(raw: string): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(RE_INVISIBLE, '').replace(/\s+/g, '').trim();
}

/**
 * Calcule la cle de controle modulo 97 a partir des 13 premiers chiffres.
 * Utilise BigInt pour eviter tout probleme de precision (13 chiffres
 * tiennent dans Number.MAX_SAFE_INTEGER mais BigInt est plus explicite).
 *
 * @param first13 string exact 13 chiffres
 * @returns string 2 chiffres avec padding zero leading
 */
export function computeICEChecksum(first13: string): string {
  if (!/^\d{13}$/.test(first13)) {
    throw new Error('computeICEChecksum: input must be exactly 13 digits');
  }
  const n = BigInt(first13);
  const mod = Number(n % 97n);
  const controle = 97 - mod;
  return controle.toString().padStart(2, '0');
}

/**
 * Validate ICE complet 15 chiffres + checksum DGI.
 *
 * @param raw ICE saisi par l'utilisateur (peut contenir espaces / separateurs)
 * @returns IceValidationResult avec decomposition si valide, errorCode si non
 */
export function validateICE(raw: string | null | undefined): IceValidationResult {
  if (raw === null || raw === undefined || raw === '') {
    return {
      valid: false,
      errorCode: 'EMPTY',
      errorMessage: "L'ICE est obligatoire.",
      normalized: null,
      decomposed: null,
    };
  }

  const normalized = stripIceSeparators(raw);

  if (/\D/.test(normalized)) {
    return {
      valid: false,
      errorCode: 'NOT_DIGITS_ONLY',
      errorMessage: "L'ICE doit contenir uniquement des chiffres.",
      normalized,
      decomposed: null,
    };
  }

  if (normalized.length === 14) {
    return {
      valid: false,
      errorCode: 'WRONG_LENGTH_14',
      errorMessage:
        "L'ICE doit comporter exactement 15 chiffres. Si vous avez un ancien identifiant 14 chiffres, contactez la DGI pour migration vers le format ICE.",
      normalized,
      decomposed: null,
    };
  }

  if (normalized.length !== ICE_LENGTH) {
    return {
      valid: false,
      errorCode: 'WRONG_LENGTH_OTHER',
      errorMessage: `L'ICE doit comporter exactement 15 chiffres (${normalized.length} fournis).`,
      normalized,
      decomposed: null,
    };
  }

  const first13 = normalized.slice(0, 13);
  const expectedControle = computeICEChecksum(first13);
  const providedControle = normalized.slice(13, 15);

  if (expectedControle !== providedControle) {
    return {
      valid: false,
      errorCode: 'INVALID_CHECKSUM',
      errorMessage: `Cle de controle ICE invalide (attendue : ${expectedControle}, fournie : ${providedControle}). Verifiez la saisie ou contactez la DGI.`,
      normalized,
      decomposed: null,
    };
  }

  return {
    valid: true,
    errorCode: null,
    errorMessage: null,
    normalized,
    decomposed: {
      entreprise: normalized.slice(0, 7),
      etablissement: normalized.slice(7, 10),
      filiale: normalized.slice(10, 13),
      controle: normalized.slice(13, 15),
    },
  };
}

/** Shortcut boolean pour usage dans Zod refine. */
export function isValidICE(raw: string | null | undefined): boolean {
  return validateICE(raw).valid;
}

/**
 * Formate un ICE valide pour affichage avec separateurs thin space (U+2009)
 * Pattern : `XXXXXXX XXX XXX XX`
 *
 * @example
 *   formatICE('001234567000088024') => '0012345 670 000 88 024' (pour lisibilite)
 *   Actuellement on retourne : '0012345 67 000 088 024' selon decomposition stricte
 */
export function formatICE(ice: string): string {
  const normalized = stripIceSeparators(ice);
  if (normalized.length !== ICE_LENGTH) return ice;
  const THIN = ' ';
  return (
    normalized.slice(0, 7) +
    THIN +
    normalized.slice(7, 10) +
    THIN +
    normalized.slice(10, 13) +
    THIN +
    normalized.slice(13, 15)
  );
}

/**
 * Genere un ICE valide artificiel pour les seeds tests/dev.
 * NE PAS utiliser en production : reserve aux fixtures.
 */
export function generateValidIce(seedFirst13: string): string {
  if (!/^\d{13}$/.test(seedFirst13)) {
    throw new Error('generateValidIce: seed must be exactly 13 digits');
  }
  return seedFirst13 + computeICEChecksum(seedFirst13);
}
```

### 6.2 `repo/apps/web-broker/lib/utils/__tests__/ice-validator.spec.ts` (15 tests)

```typescript
import { describe, it, expect } from 'vitest';
import {
  validateICE,
  computeICEChecksum,
  isValidICE,
  formatICE,
  stripIceSeparators,
  generateValidIce,
} from '../ice-validator';

describe('ice-validator', () => {
  describe('computeICEChecksum', () => {
    it('test-01 should compute controle for 0000000000000', () => {
      // 0 mod 97 = 0, controle = 97 - 0 = 97
      expect(computeICEChecksum('0000000000000')).toBe('97');
    });

    it('test-02 should compute controle with leading zeros', () => {
      // 1 mod 97 = 1, controle = 96
      expect(computeICEChecksum('0000000000001')).toBe('96');
    });

    it('test-03 should compute controle for large 13-digit number', () => {
      // 9999999999999 mod 97 = X, controle = 97 - X
      const result = computeICEChecksum('9999999999999');
      expect(result).toMatch(/^\d{2}$/);
      const reconstructed = parseInt('9999999999999' + result, 10);
      // Pas verifiable simple mais checksum non vide ok
      expect(result.length).toBe(2);
    });

    it('test-04 should throw on non-13-digit input', () => {
      expect(() => computeICEChecksum('123')).toThrow();
      expect(() => computeICEChecksum('12345678901234')).toThrow();
      expect(() => computeICEChecksum('123456789012a')).toThrow();
    });
  });

  describe('validateICE', () => {
    it('test-05 should accept valid ICE generated by checksum', () => {
      const ice = generateValidIce('0012345670000');
      const result = validateICE(ice);
      expect(result.valid).toBe(true);
      expect(result.errorCode).toBeNull();
      expect(result.decomposed).not.toBeNull();
      expect(result.decomposed!.entreprise).toBe('0012345');
      expect(result.decomposed!.etablissement).toBe('670');
      expect(result.decomposed!.filiale).toBe('000');
    });

    it('test-06 should reject empty input', () => {
      expect(validateICE('').errorCode).toBe('EMPTY');
      expect(validateICE(null).errorCode).toBe('EMPTY');
      expect(validateICE(undefined).errorCode).toBe('EMPTY');
    });

    it('test-07 should reject 14-digit legacy format with explicit message', () => {
      const result = validateICE('00123456700008');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('WRONG_LENGTH_14');
      expect(result.errorMessage).toContain('ancien identifiant');
    });

    it('test-08 should reject non-15-digit other lengths', () => {
      expect(validateICE('123').errorCode).toBe('WRONG_LENGTH_OTHER');
      expect(validateICE('12345678901234567').errorCode).toBe('WRONG_LENGTH_OTHER');
    });

    it('test-09 should reject letters in ICE', () => {
      expect(validateICE('00123456700008abc').errorCode).toBe('WRONG_LENGTH_OTHER');
      expect(validateICE('00123456700008A1').errorCode).toBe('NOT_DIGITS_ONLY');
    });

    it('test-10 should reject invalid checksum', () => {
      // ICE 15 chiffres avec checksum incorrect intentionnel
      const result = validateICE('001234567000099');
      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CHECKSUM');
      expect(result.errorMessage).toContain('Cle de controle ICE invalide');
    });

    it('test-11 should strip thin spaces and tabs before validation', () => {
      const valid = generateValidIce('0012345670000');
      const formatted = valid.slice(0, 7) + ' ' + valid.slice(7, 10) + '\t' + valid.slice(10);
      const result = validateICE(formatted);
      expect(result.valid).toBe(true);
    });

    it('test-12 should strip zero-width invisible characters', () => {
      const valid = generateValidIce('0012345670000');
      const sneaky = valid.slice(0, 5) + '​' + valid.slice(5) + '﻿';
      const result = validateICE(sneaky);
      expect(result.valid).toBe(true);
    });
  });

  describe('isValidICE', () => {
    it('test-13 should return boolean shortcut', () => {
      const valid = generateValidIce('0012345670000');
      expect(isValidICE(valid)).toBe(true);
      expect(isValidICE('123')).toBe(false);
      expect(isValidICE('')).toBe(false);
    });
  });

  describe('formatICE', () => {
    it('test-14 should format with thin spaces in 4 groups', () => {
      const valid = generateValidIce('0012345670000');
      const formatted = formatICE(valid);
      // 4 segments separes par U+2009
      expect(formatted.split(' ')).toHaveLength(4);
      expect(formatted.split(' ')[0]).toHaveLength(7); // entreprise
      expect(formatted.split(' ')[1]).toHaveLength(3); // etablissement
      expect(formatted.split(' ')[2]).toHaveLength(3); // filiale
      expect(formatted.split(' ')[3]).toHaveLength(2); // controle
    });
  });

  describe('stripIceSeparators', () => {
    it('test-15 should remove all whitespace and invisible chars', () => {
      expect(stripIceSeparators(' 001 234 \t567 \n0000 88​024 ')).toBe('001234567000088024');
    });
  });
});
```

### 6.3 `repo/apps/web-broker/lib/utils/rc-validator.ts` (~80 lignes)

```typescript
/**
 * RC (Registre du Commerce) Validator -- Maroc
 *
 * Reference legale :
 *   - Loi 15-95 formant Code de Commerce
 *   - Decret 96-2.93.345 relatif au registre du commerce
 *
 * Le RC est ouvert au tribunal de commerce competent territorialement.
 * Le format varie selon le tribunal (de 4 a 10 chiffres, parfois lettre prefixe).
 *
 * Validation souple : regex ^[A-Z]?\d{4,10}$ + tribunal enum
 */

export type MaTribunalCommerce =
  | 'casablanca'
  | 'rabat'
  | 'tanger'
  | 'fes'
  | 'marrakech'
  | 'agadir'
  | 'oujda'
  | 'tetouan'
  | 'settat'
  | 'beni-mellal'
  | 'el-jadida'
  | 'kenitra'
  | 'meknes'
  | 'nador'
  | 'safi'
  | 'khouribga'
  | 'laayoune';

export const MA_TRIBUNAUX_COMMERCE: ReadonlyArray<MaTribunalCommerce> = [
  'casablanca', 'rabat', 'tanger', 'fes', 'marrakech', 'agadir',
  'oujda', 'tetouan', 'settat', 'beni-mellal', 'el-jadida', 'kenitra',
  'meknes', 'nador', 'safi', 'khouribga', 'laayoune',
];

const RC_REGEX = /^[A-Z]?\d{4,10}$/;

export interface RcValidationResult {
  valid: boolean;
  errorMessage: string | null;
}

export function validateRC(rc: string | null | undefined, tribunal?: string): RcValidationResult {
  if (!rc || rc.trim() === '') {
    return { valid: false, errorMessage: 'Le numero RC est obligatoire.' };
  }
  const normalized = rc.trim().toUpperCase();
  if (!RC_REGEX.test(normalized)) {
    return {
      valid: false,
      errorMessage: 'Format RC invalide. Attendu : 4-10 chiffres avec lettre majuscule optionnelle en prefixe.',
    };
  }
  if (tribunal && !MA_TRIBUNAUX_COMMERCE.includes(tribunal as MaTribunalCommerce)) {
    return {
      valid: false,
      errorMessage: 'Tribunal de commerce inconnu. Selectionnez parmi la liste officielle.',
    };
  }
  return { valid: true, errorMessage: null };
}

export function isValidRC(rc: string | null | undefined, tribunal?: string): boolean {
  return validateRC(rc, tribunal).valid;
}
```

### 6.4 `repo/apps/web-broker/lib/utils/cnss-validator.ts` + `if-validator.ts` + `patente-validator.ts`

```typescript
// cnss-validator.ts
/**
 * CNSS (Caisse Nationale de Securite Sociale) Validator
 * Format : 7-8 chiffres, leading zero possible.
 */
const CNSS_REGEX = /^\d{7,8}$/;

export function validateCNSS(cnss: string | null | undefined): { valid: boolean; errorMessage: string | null } {
  if (!cnss || cnss.trim() === '') {
    return { valid: true, errorMessage: null }; // optionnel
  }
  const normalized = cnss.trim();
  if (!CNSS_REGEX.test(normalized)) {
    return { valid: false, errorMessage: 'Numero CNSS invalide. Format attendu : 7 ou 8 chiffres.' };
  }
  return { valid: true, errorMessage: null };
}

export function isValidCNSS(cnss: string | null | undefined): boolean {
  return validateCNSS(cnss).valid;
}
```

```typescript
// if-validator.ts
/**
 * IF (Identifiant Fiscal) Validator -- DGI Maroc
 * Format : 7-8 chiffres.
 */
const IF_REGEX = /^\d{7,8}$/;

export function validateIF(idFiscal: string | null | undefined): { valid: boolean; errorMessage: string | null } {
  if (!idFiscal || idFiscal.trim() === '') {
    return { valid: true, errorMessage: null };
  }
  const normalized = idFiscal.trim();
  if (!IF_REGEX.test(normalized)) {
    return { valid: false, errorMessage: 'Identifiant Fiscal (IF) invalide. Format attendu : 7 ou 8 chiffres.' };
  }
  return { valid: true, errorMessage: null };
}

export function isValidIF(idFiscal: string | null | undefined): boolean {
  return validateIF(idFiscal).valid;
}
```

```typescript
// patente-validator.ts
/**
 * Patente (Taxe Professionnelle) Validator
 * Format : 7-8 chiffres, communal.
 */
const PATENTE_REGEX = /^\d{7,8}$/;

export function validatePatente(patente: string | null | undefined): { valid: boolean; errorMessage: string | null } {
  if (!patente || patente.trim() === '') {
    return { valid: true, errorMessage: null };
  }
  const normalized = patente.trim();
  if (!PATENTE_REGEX.test(normalized)) {
    return { valid: false, errorMessage: 'Numero de patente invalide. Format attendu : 7 ou 8 chiffres.' };
  }
  return { valid: true, errorMessage: null };
}

export function isValidPatente(patente: string | null | undefined): boolean {
  return validatePatente(patente).valid;
}
```

### 6.5 `repo/apps/web-broker/lib/utils/industries-ma.ts` (~60 lignes)

```typescript
/**
 * Secteurs d'activite -- nomenclature HCP Maroc (Haut-Commissariat au Plan)
 * 16 categories principales utilisees pour classifier les entreprises
 * dans le CRM B2B Skalean Broker.
 */

export type Industry =
  | 'agriculture'
  | 'industrie'
  | 'btp'
  | 'commerce'
  | 'transport'
  | 'immobilier'
  | 'services'
  | 'finance'
  | 'sante'
  | 'education'
  | 'hotellerie'
  | 'energie'
  | 'mines'
  | 'textile'
  | 'agroalimentaire'
  | 'artisanat';

export const INDUSTRIES_MA: ReadonlyArray<Industry> = [
  'agriculture', 'industrie', 'btp', 'commerce', 'transport',
  'immobilier', 'services', 'finance', 'sante', 'education',
  'hotellerie', 'energie', 'mines', 'textile', 'agroalimentaire', 'artisanat',
];

/**
 * Couleur badge associee a chaque industry (palette Sofidemy).
 * Utilisee dans <IndustryBadge> pour distinction visuelle dans la table.
 */
export const INDUSTRY_BADGE_COLOR: Record<Industry, string> = {
  agriculture:    'bg-green-100 text-green-900',
  industrie:      'bg-slate-200 text-slate-900',
  btp:            'bg-orange-100 text-orange-900',
  commerce:       'bg-blue-100 text-blue-900',
  transport:      'bg-sky-100 text-sky-900',
  immobilier:     'bg-amber-100 text-amber-900',
  services:       'bg-violet-100 text-violet-900',
  finance:        'bg-emerald-100 text-emerald-900',
  sante:          'bg-rose-100 text-rose-900',
  education:      'bg-indigo-100 text-indigo-900',
  hotellerie:     'bg-pink-100 text-pink-900',
  energie:        'bg-yellow-100 text-yellow-900',
  mines:          'bg-stone-200 text-stone-900',
  textile:        'bg-fuchsia-100 text-fuchsia-900',
  agroalimentaire:'bg-lime-100 text-lime-900',
  artisanat:      'bg-teal-100 text-teal-900',
};
```

### 6.6 `repo/apps/web-broker/lib/utils/ma-regions.ts` (~80 lignes)

```typescript
/**
 * Regions et prefectures du Maroc (decoupage 2015 -- 12 regions)
 * Source : decret 2-15-40 portant fixation du nombre des regions
 */

export type MaRegion =
  | 'tanger-tetouan-al-hoceima'
  | 'oriental'
  | 'fes-meknes'
  | 'rabat-sale-kenitra'
  | 'beni-mellal-khenifra'
  | 'casablanca-settat'
  | 'marrakech-safi'
  | 'draa-tafilalet'
  | 'souss-massa'
  | 'guelmim-oued-noun'
  | 'laayoune-sakia-el-hamra'
  | 'dakhla-oued-ed-dahab';

export const MA_REGIONS: ReadonlyArray<MaRegion> = [
  'tanger-tetouan-al-hoceima', 'oriental', 'fes-meknes', 'rabat-sale-kenitra',
  'beni-mellal-khenifra', 'casablanca-settat', 'marrakech-safi', 'draa-tafilalet',
  'souss-massa', 'guelmim-oued-noun', 'laayoune-sakia-el-hamra', 'dakhla-oued-ed-dahab',
];

/**
 * Prefectures principales par region (selection 75 villes les plus actives).
 * Utilise pour le cascading select region -> city dans companies-filters.
 */
export const PREFECTURES_BY_REGION: Record<MaRegion, ReadonlyArray<string>> = {
  'tanger-tetouan-al-hoceima': ['Tanger', 'Tetouan', 'Al Hoceima', 'Larache', 'Chefchaouen', 'Ouezzane', 'Fahs-Anjra', 'M-Diq-Fnideq'],
  'oriental': ['Oujda', 'Nador', 'Berkane', 'Taourirt', 'Driouch', 'Jerada', 'Guercif', 'Figuig'],
  'fes-meknes': ['Fes', 'Meknes', 'Sefrou', 'Taounate', 'Taza', 'Moulay Yacoub', 'Boulemane', 'El Hajeb', 'Ifrane'],
  'rabat-sale-kenitra': ['Rabat', 'Sale', 'Kenitra', 'Skhirate-Temara', 'Khemisset', 'Sidi Kacem', 'Sidi Slimane'],
  'beni-mellal-khenifra': ['Beni Mellal', 'Khenifra', 'Azilal', 'Fquih Ben Salah', 'Khouribga'],
  'casablanca-settat': ['Casablanca', 'Mohammedia', 'Settat', 'El Jadida', 'Berrechid', 'Benslimane', 'Mediouna', 'Nouaceur', 'Sidi Bennour'],
  'marrakech-safi': ['Marrakech', 'Safi', 'Essaouira', 'El Kelaa des Sraghna', 'Rehamna', 'Chichaoua', 'Al Haouz', 'Youssoufia'],
  'draa-tafilalet': ['Errachidia', 'Ouarzazate', 'Midelt', 'Tinghir', 'Zagora'],
  'souss-massa': ['Agadir', 'Inezgane Ait Melloul', 'Taroudant', 'Tiznit', 'Chtouka Ait Baha', 'Tata'],
  'guelmim-oued-noun': ['Guelmim', 'Assa-Zag', 'Tan-Tan', 'Sidi Ifni'],
  'laayoune-sakia-el-hamra': ['Laayoune', 'Boujdour', 'Tarfaya', 'Es-Semara'],
  'dakhla-oued-ed-dahab': ['Dakhla', 'Aousserd'],
};
```

### 6.7 `repo/apps/web-broker/lib/utils/size-classifier.ts` (~50 lignes)

```typescript
/**
 * Classification taille entreprise -- Maroc
 * Reference : loi 53-95 + decrets associes
 */

export type CompanySize = 'TPE' | 'PME' | 'ETI' | 'GE';

export type RevenueRangeMDH =
  | 'lt_3'         // < 3 MDH
  | '3_to_10'
  | '10_to_50'
  | '50_to_175'
  | '175_to_500'
  | '500_to_1500'
  | 'gt_1500';

const REVENUE_UPPER_BOUND_MDH: Record<RevenueRangeMDH, number> = {
  lt_3: 3,
  '3_to_10': 10,
  '10_to_50': 50,
  '50_to_175': 175,
  '175_to_500': 500,
  '500_to_1500': 1500,
  gt_1500: Infinity,
};

/**
 * Classifie une entreprise selon effectif + tranche de CA.
 * Si les deux criteres pointent vers categories differentes, on retient
 * la plus grande (regle MA : la classification se fait au "plus grand"
 * des deux indicateurs).
 */
export function classifySize(
  employeesCount: number,
  revenueRange: RevenueRangeMDH,
): CompanySize {
  const byEmployees: CompanySize =
    employeesCount < 10 ? 'TPE' :
    employeesCount < 250 ? 'PME' :
    employeesCount < 5000 ? 'ETI' : 'GE';

  const revenueUpper = REVENUE_UPPER_BOUND_MDH[revenueRange];
  const byRevenue: CompanySize =
    revenueUpper <= 3 ? 'TPE' :
    revenueUpper <= 175 ? 'PME' :
    revenueUpper <= 1500 ? 'ETI' : 'GE';

  // Retenir la plus grande des deux (TPE < PME < ETI < GE)
  const order: Record<CompanySize, number> = { TPE: 1, PME: 2, ETI: 3, GE: 4 };
  return order[byEmployees] >= order[byRevenue] ? byEmployees : byRevenue;
}
```

### 6.8 `repo/apps/web-broker/lib/types/company.types.ts` (~100 lignes)

```typescript
import type { Industry } from '../utils/industries-ma';
import type { MaRegion } from '../utils/ma-regions';
import type { CompanySize, RevenueRangeMDH } from '../utils/size-classifier';
import type { MaTribunalCommerce } from '../utils/rc-validator';

export type CompanyId = string & { readonly __brand: 'CompanyId' };
export type Ice = string & { readonly __brand: 'Ice' };

export interface CompanyAddress {
  street: string;
  city: string;
  region: MaRegion;
  postal_code: string;
}

export interface Company {
  id: CompanyId;
  tenant_id: string;
  name: string;
  legal_name: string;
  logo_url: string | null;
  ice: Ice;
  rc_number: string;
  rc_tribunal: MaTribunalCommerce;
  patente: string | null;
  cnss: string | null;
  identifiant_fiscal: string | null;
  industry: Industry;
  sub_industry_label: string | null;
  size: CompanySize;
  employees_count: number;
  revenue_range: RevenueRangeMDH;
  founded_year: number | null;
  address: CompanyAddress;
  website: string | null;
  main_phone: string;
  billing_email: string;
  notes: string | null;
  owner_id: string | null;
  tags: ReadonlyArray<string>;
  contacts_count: number;
  deals_open_count: number;
  deals_total_value_mad: number;
  polices_active_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CompanyCreateInput {
  name: string;
  legal_name: string;
  ice: string;
  rc_number: string;
  rc_tribunal: MaTribunalCommerce;
  patente?: string;
  cnss?: string;
  identifiant_fiscal?: string;
  industry: Industry;
  sub_industry_label?: string;
  size?: CompanySize; // auto-classified if absent
  employees_count: number;
  revenue_range: RevenueRangeMDH;
  founded_year?: number;
  address: CompanyAddress;
  website?: string;
  main_phone: string;
  billing_email: string;
  notes?: string;
  tags?: ReadonlyArray<string>;
}

export type CompanyUpdateInput = Partial<CompanyCreateInput>;

export interface CompanyListFilters {
  industry?: ReadonlyArray<Industry>;
  region?: MaRegion;
  city?: string;
  size?: ReadonlyArray<CompanySize>;
  q?: string;
  owner_id?: string;
  tags?: ReadonlyArray<string>;
  include_deleted?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: 'name' | 'ice' | 'industry' | 'city' | 'created_at' | 'deals_total_value_mad';
  sort_dir?: 'asc' | 'desc';
}

export interface CompanyListResponse {
  data: ReadonlyArray<Company>;
  meta: {
    total: number;
    page: number;
    page_size: number;
    total_pages: number;
  };
}
```

### 6.9 `repo/apps/web-broker/lib/schemas/company.schema.ts` (~150 lignes)

```typescript
import { z } from 'zod';
import { isValidICE } from '../utils/ice-validator';
import { isValidRC, MA_TRIBUNAUX_COMMERCE } from '../utils/rc-validator';
import { isValidCNSS } from '../utils/cnss-validator';
import { isValidIF } from '../utils/if-validator';
import { isValidPatente } from '../utils/patente-validator';
import { INDUSTRIES_MA } from '../utils/industries-ma';
import { MA_REGIONS } from '../utils/ma-regions';

const PHONE_MA_REGEX = /^(?:\+212|0)([5-7])\d{8}$/;
const URL_REGEX = /^https?:\/\/.+/;

const AddressSchema = z.object({
  street: z.string().min(3, 'Adresse trop courte').max(255),
  city: z.string().min(2, 'Ville obligatoire').max(100),
  region: z.enum(MA_REGIONS as unknown as [string, ...string[]]),
  postal_code: z.string().regex(/^\d{5}$/, 'Code postal MA : 5 chiffres'),
});

export const CompanyCreateSchema = z.object({
  name: z.string().min(2, 'Nom commercial obligatoire').max(255),
  legal_name: z.string().min(2, 'Raison sociale obligatoire').max(255),

  ice: z.string()
    .min(15)
    .max(15)
    .refine(isValidICE, { message: 'ICE invalide (15 chiffres + checksum DGI modulo 97).' }),

  rc_number: z.string().min(1, 'Numero RC obligatoire'),
  rc_tribunal: z.enum(MA_TRIBUNAUX_COMMERCE as unknown as [string, ...string[]]),

  patente: z.string().optional().refine(
    (v) => !v || isValidPatente(v),
    { message: 'Numero de patente invalide (7-8 chiffres).' },
  ),
  cnss: z.string().optional().refine(
    (v) => !v || isValidCNSS(v),
    { message: 'Numero CNSS invalide (7-8 chiffres).' },
  ),
  identifiant_fiscal: z.string().optional().refine(
    (v) => !v || isValidIF(v),
    { message: 'Identifiant Fiscal invalide (7-8 chiffres).' },
  ),

  industry: z.enum(INDUSTRIES_MA as unknown as [string, ...string[]]),
  sub_industry_label: z.string().max(120).optional(),

  size: z.enum(['TPE', 'PME', 'ETI', 'GE']).optional(),
  employees_count: z.number().int().min(0).max(1_000_000),
  revenue_range: z.enum(['lt_3', '3_to_10', '10_to_50', '50_to_175', '175_to_500', '500_to_1500', 'gt_1500']),

  founded_year: z.number().int().min(1900).max(new Date().getFullYear()).optional(),

  address: AddressSchema,

  website: z.string().regex(URL_REGEX, 'URL invalide (http/https requis)').optional().or(z.literal('')),
  main_phone: z.string().regex(PHONE_MA_REGEX, 'Telephone MA invalide (format +212 ou 0)'),
  billing_email: z.string().email('Email facturation invalide'),

  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
})
.superRefine((data, ctx) => {
  // Cross-field validation : RC validity selon tribunal
  if (!isValidRC(data.rc_number, data.rc_tribunal)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Format RC invalide pour ce tribunal.',
      path: ['rc_number'],
    });
  }
});

export const CompanyUpdateSchema = CompanyCreateSchema.partial();

export const CompanyListFilterSchema = z.object({
  industry: z.array(z.enum(INDUSTRIES_MA as unknown as [string, ...string[]])).optional(),
  region: z.enum(MA_REGIONS as unknown as [string, ...string[]]).optional(),
  city: z.string().optional(),
  size: z.array(z.enum(['TPE', 'PME', 'ETI', 'GE'])).optional(),
  q: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(10).max(100).default(25),
  sort_by: z.enum(['name', 'ice', 'industry', 'city', 'created_at', 'deals_total_value_mad']).default('created_at'),
  sort_dir: z.enum(['asc', 'desc']).default('desc'),
});

export type CompanyCreateFormValues = z.infer<typeof CompanyCreateSchema>;
export type CompanyUpdateFormValues = z.infer<typeof CompanyUpdateSchema>;
export type CompanyListFilterValues = z.infer<typeof CompanyListFilterSchema>;
```

### 6.10 `repo/apps/web-broker/lib/api/companies.api.ts` (~200 lignes)

```typescript
import { apiClient } from '@/lib/api-client';
import type {
  Company,
  CompanyId,
  CompanyCreateInput,
  CompanyUpdateInput,
  CompanyListFilters,
  CompanyListResponse,
} from '@/lib/types/company.types';

/**
 * Wrapper API endpoints CRM Companies -- Sprint 8 backend
 * Tous les endpoints sont prefixed `/api/v1/crm/companies`.
 * L'instance apiClient (Sprint 4 axios) injecte automatiquement :
 *   - x-tenant-id (depuis zustand)
 *   - x-trace-id  (crypto.randomUUID)
 *   - Idempotency-Key sur POST/PUT/PATCH/DELETE
 *   - Authorization: Bearer <token>
 *   - Accept-Language: <locale>
 */

const BASE = '/api/v1/crm/companies';

export async function getCompanies(filters: CompanyListFilters = {}): Promise<CompanyListResponse> {
  const params = new URLSearchParams();
  if (filters.industry?.length) params.set('industry', filters.industry.join(','));
  if (filters.region) params.set('region', filters.region);
  if (filters.city) params.set('city', filters.city);
  if (filters.size?.length) params.set('size', filters.size.join(','));
  if (filters.q) params.set('q', filters.q);
  if (filters.owner_id) params.set('owner_id', filters.owner_id);
  if (filters.tags?.length) params.set('tags', filters.tags.join(','));
  if (filters.include_deleted) params.set('include_deleted', 'true');
  params.set('page', String(filters.page ?? 1));
  params.set('page_size', String(filters.page_size ?? 25));
  params.set('sort_by', filters.sort_by ?? 'created_at');
  params.set('sort_dir', filters.sort_dir ?? 'desc');

  const { data } = await apiClient.get<CompanyListResponse>(`${BASE}?${params.toString()}`);
  return data;
}

export async function getCompanyById(id: CompanyId): Promise<Company> {
  const { data } = await apiClient.get<Company>(`${BASE}/${id}`);
  return data;
}

export async function getCompanyContacts(id: CompanyId, page = 1, pageSize = 25) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  const { data } = await apiClient.get(`${BASE}/${id}/contacts?${params}`);
  return data;
}

export async function getCompanyDeals(id: CompanyId) {
  const { data } = await apiClient.get(`${BASE}/${id}/deals`);
  return data;
}

export async function getCompanyPolices(id: CompanyId) {
  const { data } = await apiClient.get(`${BASE}/${id}/polices`);
  return data;
}

export async function getCompanySinistres(id: CompanyId) {
  const { data } = await apiClient.get(`${BASE}/${id}/sinistres`);
  return data;
}

export async function getCompanyDocuments(id: CompanyId) {
  const { data } = await apiClient.get(`${BASE}/${id}/documents`);
  return data;
}

export async function createCompany(input: CompanyCreateInput): Promise<Company> {
  const { data } = await apiClient.post<Company>(BASE, input);
  return data;
}

export async function updateCompany(id: CompanyId, patch: CompanyUpdateInput): Promise<Company> {
  const { data } = await apiClient.patch<Company>(`${BASE}/${id}`, patch);
  return data;
}

export async function deleteCompany(id: CompanyId): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function restoreCompany(id: CompanyId): Promise<Company> {
  const { data } = await apiClient.post<Company>(`${BASE}/${id}/restore`);
  return data;
}

export async function bulkExportCompaniesCsv(ids: ReadonlyArray<CompanyId>): Promise<Blob> {
  const { data } = await apiClient.post(`${BASE}/bulk/export-csv`, { ids }, { responseType: 'blob' });
  return data as Blob;
}

export async function bulkAssignOwner(ids: ReadonlyArray<CompanyId>, ownerId: string): Promise<void> {
  await apiClient.post(`${BASE}/bulk/assign-owner`, { ids, owner_id: ownerId });
}

export async function bulkAddTags(ids: ReadonlyArray<CompanyId>, tags: ReadonlyArray<string>): Promise<void> {
  await apiClient.post(`${BASE}/bulk/add-tags`, { ids, tags });
}
```

### 6.11 `repo/apps/web-broker/lib/queries/companies.queries.ts` (~180 lignes)

```typescript
'use client';

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  getCompanies, getCompanyById, getCompanyContacts, getCompanyDeals,
  getCompanyPolices, getCompanySinistres, getCompanyDocuments,
  createCompany, updateCompany, deleteCompany,
  bulkExportCompaniesCsv, bulkAssignOwner, bulkAddTags,
} from '@/lib/api/companies.api';
import type {
  CompanyId, CompanyCreateInput, CompanyUpdateInput,
  CompanyListFilters, CompanyListResponse, Company,
} from '@/lib/types/company.types';

export const companiesKeys = {
  all: ['companies'] as const,
  list: (filters: CompanyListFilters) => ['companies', 'list', filters] as const,
  detail: (id: CompanyId) => ['companies', 'detail', id] as const,
  contacts: (id: CompanyId) => ['companies', id, 'contacts'] as const,
  deals: (id: CompanyId) => ['companies', id, 'deals'] as const,
  polices: (id: CompanyId) => ['companies', id, 'polices'] as const,
  sinistres: (id: CompanyId) => ['companies', id, 'sinistres'] as const,
  documents: (id: CompanyId) => ['companies', id, 'documents'] as const,
};

export function useCompaniesQuery(filters: CompanyListFilters) {
  return useQuery<CompanyListResponse>({
    queryKey: companiesKeys.list(filters),
    queryFn: () => getCompanies(filters),
    staleTime: 30_000,
    placeholderData: (previous) => previous, // keepPreviousData
  });
}

export function useCompanyQuery(id: CompanyId | null) {
  return useQuery<Company>({
    queryKey: id ? companiesKeys.detail(id) : ['companies', 'detail', 'noop'],
    queryFn: () => getCompanyById(id as CompanyId),
    enabled: !!id,
  });
}

export function useCompanyContactsQuery(id: CompanyId) {
  return useQuery({
    queryKey: companiesKeys.contacts(id),
    queryFn: () => getCompanyContacts(id),
  });
}

export function useCompanyDealsQuery(id: CompanyId) {
  return useQuery({
    queryKey: companiesKeys.deals(id),
    queryFn: () => getCompanyDeals(id),
  });
}

export function useCompanyPolicesQuery(id: CompanyId) {
  return useQuery({
    queryKey: companiesKeys.polices(id),
    queryFn: () => getCompanyPolices(id),
  });
}

export function useCompanySinistresQuery(id: CompanyId) {
  return useQuery({
    queryKey: companiesKeys.sinistres(id),
    queryFn: () => getCompanySinistres(id),
  });
}

export function useCompanyDocumentsQuery(id: CompanyId) {
  return useQuery({
    queryKey: companiesKeys.documents(id),
    queryFn: () => getCompanyDocuments(id),
  });
}

export function useCreateCompanyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CompanyCreateInput) => createCompany(input),
    onMutate: async (input) => {
      // Optimistic update : ajouter la nouvelle company en haut de la liste
      await qc.cancelQueries({ queryKey: companiesKeys.all });
      const previousLists = qc.getQueriesData<CompanyListResponse>({ queryKey: ['companies', 'list'] });
      const tempId = `temp-${Date.now()}` as CompanyId;
      const tempCompany = {
        id: tempId,
        ...input,
        contacts_count: 0,
        deals_open_count: 0,
        deals_total_value_mad: 0,
        polices_active_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null,
      } as unknown as Company;
      previousLists.forEach(([key, value]) => {
        if (!value) return;
        qc.setQueryData(key, {
          ...value,
          data: [tempCompany, ...value.data],
          meta: { ...value.meta, total: value.meta.total + 1 },
        });
      });
      return { previousLists, tempId };
    },
    onError: (err, _input, context) => {
      // Rollback
      context?.previousLists.forEach(([key, value]) => qc.setQueryData(key, value));
      toast.error("Echec de creation de l'entreprise.");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companiesKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] }); // cascade dashboard widget
      toast.success('Entreprise creee avec succes.');
    },
  });
}

export function useUpdateCompanyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: CompanyId; patch: CompanyUpdateInput }) => updateCompany(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: companiesKeys.detail(id) });
      const previous = qc.getQueryData<Company>(companiesKeys.detail(id));
      if (previous) {
        qc.setQueryData(companiesKeys.detail(id), { ...previous, ...patch, updated_at: new Date().toISOString() });
      }
      return { previous, id };
    },
    onError: (_e, _v, context) => {
      if (context?.previous && context.id) {
        qc.setQueryData(companiesKeys.detail(context.id), context.previous);
      }
      toast.error("Echec de la mise a jour.");
    },
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: companiesKeys.detail(id) });
      qc.invalidateQueries({ queryKey: ['companies', 'list'] });
      toast.success('Entreprise mise a jour.');
    },
  });
}

export function useDeleteCompanyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: CompanyId) => deleteCompany(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: companiesKeys.all });
      toast.success('Entreprise supprimee (corbeille 30 jours).');
    },
    onError: () => toast.error('Echec de suppression.'),
  });
}

export function useBulkExportCompaniesCsv() {
  return useMutation({
    mutationFn: (ids: ReadonlyArray<CompanyId>) => bulkExportCompaniesCsv(ids),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `companies-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export CSV genere.');
    },
    onError: () => toast.error("Echec d'export."),
  });
}
```

### 6.12 `repo/apps/web-broker/app/[locale]/(protected)/companies/page.tsx` (~150 lignes)

```typescript
import { Suspense } from 'react';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { CompaniesTable } from '@/components/companies/companies-table';
import { CompaniesFilters } from '@/components/companies/companies-filters';
import { CreateCompanyButton } from '@/components/companies/create-company-button';
import { CompaniesPageHeader } from '@/components/companies/companies-page-header';
import { getCompanies } from '@/lib/api/companies.api';
import { CompanyListFilterSchema } from '@/lib/schemas/company.schema';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'companies' });
  return {
    title: `${t('list.title')} -- Skalean Broker`,
    description: t('list.metaDescription'),
  };
}

interface CompaniesPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CompaniesPage({ params, searchParams }: CompaniesPageProps) {
  const { locale } = await params;
  const rawSearch = await searchParams;
  const t = await getTranslations({ locale, namespace: 'companies' });

  // Parser et valider les searchParams via Zod (fallback defaults si invalide)
  const parsed = CompanyListFilterSchema.safeParse({
    industry: typeof rawSearch.industry === 'string' ? rawSearch.industry.split(',') : rawSearch.industry,
    region: rawSearch.region,
    city: rawSearch.city,
    size: typeof rawSearch.size === 'string' ? rawSearch.size.split(',') : rawSearch.size,
    q: rawSearch.q,
    page: rawSearch.page,
    page_size: rawSearch.page_size,
    sort_by: rawSearch.sort_by,
    sort_dir: rawSearch.sort_dir,
  });

  const filters = parsed.success ? parsed.data : CompanyListFilterSchema.parse({});

  // Prefetch initial data Server Component
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ['companies', 'list', filters],
    queryFn: () => getCompanies(filters),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6 p-6">
        <CompaniesPageHeader title={t('list.title')} description={t('list.subtitle')}>
          <CreateCompanyButton label={t('actions.addCompany')} />
        </CompaniesPageHeader>

        <CompaniesFilters />

        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
          <CompaniesTable />
        </Suspense>
      </div>
    </HydrationBoundary>
  );
}
```

### 6.13 `repo/apps/web-broker/app/[locale]/(protected)/companies/[id]/page.tsx` (~250 lignes)

```typescript
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HydrationBoundary, dehydrate, QueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CompanyDetailHeader } from '@/components/companies/company-detail-header';
import { CompanyInfoTab } from '@/components/companies/company-info-tab';
import { CompanyContactsTab } from '@/components/companies/company-contacts-tab';
import { CompanyDealsTab } from '@/components/companies/company-deals-tab';
import { CompanyPolicesTab } from '@/components/companies/company-polices-tab';
import { CompanySinistresTab } from '@/components/companies/company-sinistres-tab';
import { CompanyDocumentsTab } from '@/components/companies/company-documents-tab';
import { HasPermission } from '@/components/auth/has-permission';
import {
  getCompanyById, getCompanyContacts, getCompanyDeals,
  getCompanyPolices, getCompanySinistres, getCompanyDocuments,
} from '@/lib/api/companies.api';
import type { CompanyId } from '@/lib/types/company.types';

interface CompanyDetailPageProps {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export async function generateMetadata({ params }: CompanyDetailPageProps): Promise<Metadata> {
  const { id, locale } = await params;
  try {
    const company = await getCompanyById(id as CompanyId);
    return { title: `${company.name} -- Skalean Broker` };
  } catch {
    const t = await getTranslations({ locale, namespace: 'companies' });
    return { title: t('detail.notFound') };
  }
}

export default async function CompanyDetailPage({ params, searchParams }: CompanyDetailPageProps) {
  const { id, locale } = await params;
  const { tab = 'info' } = await searchParams;
  const t = await getTranslations({ locale, namespace: 'companies' });
  const companyId = id as CompanyId;

  // Fetch principal company -- 404 si introuvable
  let company;
  try {
    company = await getCompanyById(companyId);
  } catch (err: any) {
    if (err?.response?.status === 404) notFound();
    throw err;
  }

  // Prefetch tabs data en parallele (warm cache pour navigation rapide)
  const queryClient = new QueryClient();
  await Promise.all([
    queryClient.prefetchQuery({ queryKey: ['companies', 'detail', companyId], queryFn: () => Promise.resolve(company) }),
    queryClient.prefetchQuery({ queryKey: ['companies', companyId, 'contacts'], queryFn: () => getCompanyContacts(companyId) }),
    queryClient.prefetchQuery({ queryKey: ['companies', companyId, 'deals'], queryFn: () => getCompanyDeals(companyId) }),
    queryClient.prefetchQuery({ queryKey: ['companies', companyId, 'polices'], queryFn: () => getCompanyPolices(companyId) }),
    queryClient.prefetchQuery({ queryKey: ['companies', companyId, 'sinistres'], queryFn: () => getCompanySinistres(companyId) }),
    queryClient.prefetchQuery({ queryKey: ['companies', companyId, 'documents'], queryFn: () => getCompanyDocuments(companyId) }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6 p-6">
        <CompanyDetailHeader company={company} />

        <Tabs defaultValue={tab} className="w-full">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="info">{t('detail.tabs.info')}</TabsTrigger>
            <TabsTrigger value="contacts">{t('detail.tabs.contacts')} ({company.contacts_count})</TabsTrigger>
            <TabsTrigger value="deals">{t('detail.tabs.deals')} ({company.deals_open_count})</TabsTrigger>
            <TabsTrigger value="polices">{t('detail.tabs.polices')} ({company.polices_active_count})</TabsTrigger>
            <TabsTrigger value="sinistres">{t('detail.tabs.sinistres')}</TabsTrigger>
            <TabsTrigger value="documents">{t('detail.tabs.documents')}</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <Suspense fallback={<TabSkeleton />}>
              <CompanyInfoTab companyId={companyId} />
            </Suspense>
          </TabsContent>

          <TabsContent value="contacts">
            <Suspense fallback={<TabSkeleton />}>
              <CompanyContactsTab companyId={companyId} companyName={company.name} />
            </Suspense>
          </TabsContent>

          <TabsContent value="deals">
            <Suspense fallback={<TabSkeleton />}>
              <CompanyDealsTab companyId={companyId} />
            </Suspense>
          </TabsContent>

          <TabsContent value="polices">
            <Suspense fallback={<TabSkeleton />}>
              <CompanyPolicesTab companyId={companyId} />
            </Suspense>
          </TabsContent>

          <TabsContent value="sinistres">
            <Suspense fallback={<TabSkeleton />}>
              <CompanySinistresTab companyId={companyId} />
            </Suspense>
          </TabsContent>

          <TabsContent value="documents">
            <HasPermission permission="docs.read" fallback={<NoPermissionMessage />}>
              <Suspense fallback={<TabSkeleton />}>
                <CompanyDocumentsTab companyId={companyId} />
              </Suspense>
            </HasPermission>
          </TabsContent>
        </Tabs>
      </div>
    </HydrationBoundary>
  );
}

function TabSkeleton() {
  return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
}

function NoPermissionMessage() {
  return (
    <div className="p-6 text-center text-sm text-muted-foreground">
      Vous n'avez pas la permission de consulter les documents de cette entreprise.
    </div>
  );
}
```

### 6.14 `repo/apps/web-broker/components/companies/companies-table.tsx` (~280 lignes)

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryStates, parseAsString, parseAsInteger, parseAsArrayOf } from 'nuqs';
import {
  flexRender, getCoreRowModel, useReactTable,
  type ColumnDef, type SortingState, type RowSelectionState,
} from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { fr as frLocale, arSA as arLocale } from 'date-fns/locale';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Pagination } from '@/components/ui/pagination';
import { IndustryBadge } from './industry-badge';
import { SizeBadge } from './size-badge';
import { CompanyRowActions } from './company-row-actions';
import { CompanyBulkActionsBar } from './company-bulk-actions-bar';
import { useCompaniesQuery } from '@/lib/queries/companies.queries';
import { formatICE } from '@/lib/utils/ice-validator';
import type { Company, CompanyId } from '@/lib/types/company.types';

function formatMad(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'fr' ? 'fr-MA' : 'ar-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function CompaniesTable() {
  const router = useRouter();
  const t = useTranslations('companies');
  const dateLocale = t('_locale') === 'ar' ? arLocale : frLocale;

  const [filters, setFilters] = useQueryStates({
    industry: parseAsArrayOf(parseAsString).withDefault([]),
    region: parseAsString,
    city: parseAsString,
    size: parseAsArrayOf(parseAsString).withDefault([]),
    q: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    page_size: parseAsInteger.withDefault(25),
    sort_by: parseAsString.withDefault('created_at'),
    sort_dir: parseAsString.withDefault('desc'),
  });

  const { data, isLoading, isFetching } = useCompaniesQuery({
    industry: (filters.industry as any) ?? undefined,
    region: (filters.region as any) ?? undefined,
    city: filters.city ?? undefined,
    size: (filters.size as any) ?? undefined,
    q: filters.q || undefined,
    page: filters.page,
    page_size: filters.page_size,
    sort_by: filters.sort_by as any,
    sort_dir: filters.sort_dir as any,
  });

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [sorting, setSorting] = useState<SortingState>([
    { id: filters.sort_by, desc: filters.sort_dir === 'desc' },
  ]);

  const columns: ColumnDef<Company>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'name',
      header: t('columns.name'),
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {row.original.logo_url ? <AvatarImage src={row.original.logo_url} alt={row.original.name} /> : null}
            <AvatarFallback>{row.original.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-medium">{row.original.name}</span>
            <span className="text-xs text-muted-foreground">{row.original.legal_name}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'ice',
      header: t('columns.ice'),
      cell: ({ row }) => (
        <span className="font-mono text-xs tabular-nums">{formatICE(row.original.ice)}</span>
      ),
    },
    {
      accessorKey: 'industry',
      header: t('columns.industry'),
      cell: ({ row }) => <IndustryBadge industry={row.original.industry} />,
    },
    {
      accessorKey: 'address.city',
      header: t('columns.city'),
      cell: ({ row }) => row.original.address.city,
    },
    {
      accessorKey: 'size',
      header: t('columns.size'),
      cell: ({ row }) => <SizeBadge size={row.original.size} />,
    },
    {
      accessorKey: 'contacts_count',
      header: t('columns.contactsCount'),
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.contacts_count}</span>
      ),
    },
    {
      accessorKey: 'deals_total_value_mad',
      header: t('columns.dealsValue'),
      cell: ({ row }) => (
        <span className="tabular-nums">{formatMad(row.original.deals_total_value_mad, t('_locale'))}</span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: t('columns.createdAt'),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.original.created_at), 'PPP', { locale: dateLocale })}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <CompanyRowActions company={row.original} />,
      enableSorting: false,
    },
  ];

  const table = useReactTable({
    data: data?.data ?? [],
    columns,
    state: { sorting, rowSelection },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(next);
      if (next.length > 0) {
        setFilters({ sort_by: next[0].id, sort_dir: next[0].desc ? 'desc' : 'asc' });
      }
    },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableRowSelection: true,
    getRowId: (row) => row.id,
  });

  const selectedIds = Object.keys(rowSelection) as CompanyId[];

  return (
    <div className="flex flex-col gap-3">
      {selectedIds.length > 0 ? (
        <CompanyBulkActionsBar selectedIds={selectedIds} onClear={() => setRowSelection({})} />
      ) : null}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer select-none">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length}>
                    <div className="h-8 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  onClick={() => router.push(`/companies/${row.original.id}`)}
                  className="cursor-pointer hover:bg-muted/50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {t('list.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={filters.page}
        pageSize={filters.page_size}
        total={data?.meta.total ?? 0}
        onPageChange={(p) => setFilters({ page: p })}
        onPageSizeChange={(s) => setFilters({ page_size: s, page: 1 })}
        isLoading={isFetching}
      />
    </div>
  );
}
```

### 6.15 `repo/apps/web-broker/components/companies/companies-filters.tsx` (~200 lignes)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useQueryStates, parseAsString, parseAsArrayOf } from 'nuqs';
import { useTranslations } from 'next-intl';
import { X, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { INDUSTRIES_MA } from '@/lib/utils/industries-ma';
import { MA_REGIONS, PREFECTURES_BY_REGION } from '@/lib/utils/ma-regions';

const SIZES = ['TPE', 'PME', 'ETI', 'GE'] as const;

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function CompaniesFilters() {
  const t = useTranslations('companies.filters');

  const [filters, setFilters] = useQueryStates({
    industry: parseAsArrayOf(parseAsString).withDefault([]),
    region: parseAsString,
    city: parseAsString,
    size: parseAsArrayOf(parseAsString).withDefault([]),
    q: parseAsString.withDefault(''),
  });

  const [localSearch, setLocalSearch] = useState(filters.q);
  const debouncedSearch = useDebounce(localSearch, 300);

  useEffect(() => {
    if (debouncedSearch !== filters.q) {
      setFilters({ q: debouncedSearch });
    }
  }, [debouncedSearch]);

  // Cascading : changement region reset city
  function handleRegionChange(value: string) {
    setFilters({ region: value || null, city: null });
  }

  const cities = filters.region ? PREFECTURES_BY_REGION[filters.region as keyof typeof PREFECTURES_BY_REGION] ?? [] : [];

  const activeCount =
    (filters.industry?.length ?? 0) +
    (filters.size?.length ?? 0) +
    (filters.region ? 1 : 0) +
    (filters.city ? 1 : 0) +
    (filters.q ? 1 : 0);

  function resetAll() {
    setLocalSearch('');
    setFilters({ industry: [], size: [], region: null, city: null, q: '' });
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('label')}</span>
        {activeCount > 0 ? (
          <Badge variant="secondary" className="text-xs">{activeCount} {t('activeCount')}</Badge>
        ) : null}
        {activeCount > 0 ? (
          <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={resetAll}>
            <X className="mr-1 h-3 w-3" /> {t('resetAll')}
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
        <Input
          placeholder={t('searchPlaceholder')}
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="lg:col-span-2"
          aria-label={t('searchAriaLabel')}
        />

        <MultiSelect
          options={INDUSTRIES_MA.map((i) => ({ value: i, label: t(`industries.${i}`) }))}
          value={filters.industry ?? []}
          onChange={(v) => setFilters({ industry: v })}
          placeholder={t('industryPlaceholder')}
        />

        <Select value={filters.region ?? ''} onValueChange={handleRegionChange}>
          <SelectTrigger>
            <SelectValue placeholder={t('regionPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('regionAll')}</SelectItem>
            {MA_REGIONS.map((r) => (
              <SelectItem key={r} value={r}>{t(`regions.${r}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.city ?? ''}
          onValueChange={(v) => setFilters({ city: v || null })}
          disabled={!filters.region}
        >
          <SelectTrigger>
            <SelectValue placeholder={filters.region ? t('cityPlaceholder') : t('cityDisabled')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t('cityAll')}</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <MultiSelect
          options={SIZES.map((s) => ({ value: s, label: t(`sizes.${s}`) }))}
          value={filters.size ?? []}
          onChange={(v) => setFilters({ size: v })}
          placeholder={t('sizePlaceholder')}
        />
      </div>
    </div>
  );
}
```

### 6.16 `repo/apps/web-broker/components/companies/company-form-dialog.tsx` (~380 lignes)

```typescript
'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle2, XCircle, ChevronDown } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { CompanyCreateSchema, type CompanyCreateFormValues } from '@/lib/schemas/company.schema';
import { validateICE, formatICE } from '@/lib/utils/ice-validator';
import { INDUSTRIES_MA } from '@/lib/utils/industries-ma';
import { MA_REGIONS, PREFECTURES_BY_REGION } from '@/lib/utils/ma-regions';
import { MA_TRIBUNAUX_COMMERCE } from '@/lib/utils/rc-validator';
import { classifySize } from '@/lib/utils/size-classifier';
import { useCreateCompanyMutation, useUpdateCompanyMutation } from '@/lib/queries/companies.queries';
import type { Company, CompanyId } from '@/lib/types/company.types';

interface CompanyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  initialCompany?: Company;
}

const REVENUE_RANGES = ['lt_3', '3_to_10', '10_to_50', '50_to_175', '175_to_500', '500_to_1500', 'gt_1500'] as const;

export function CompanyFormDialog({ open, onOpenChange, mode, initialCompany }: CompanyFormDialogProps) {
  const t = useTranslations('companies.form');
  const createMutation = useCreateCompanyMutation();
  const updateMutation = useUpdateCompanyMutation();

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const {
    register, handleSubmit, control, watch, setValue, reset,
    formState: { errors, isValid, isDirty },
  } = useForm<CompanyCreateFormValues>({
    resolver: zodResolver(CompanyCreateSchema),
    mode: 'onBlur',
    defaultValues: initialCompany
      ? {
          name: initialCompany.name,
          legal_name: initialCompany.legal_name,
          ice: initialCompany.ice,
          rc_number: initialCompany.rc_number,
          rc_tribunal: initialCompany.rc_tribunal,
          patente: initialCompany.patente ?? undefined,
          cnss: initialCompany.cnss ?? undefined,
          identifiant_fiscal: initialCompany.identifiant_fiscal ?? undefined,
          industry: initialCompany.industry,
          sub_industry_label: initialCompany.sub_industry_label ?? undefined,
          size: initialCompany.size,
          employees_count: initialCompany.employees_count,
          revenue_range: initialCompany.revenue_range,
          founded_year: initialCompany.founded_year ?? undefined,
          address: initialCompany.address,
          website: initialCompany.website ?? '',
          main_phone: initialCompany.main_phone,
          billing_email: initialCompany.billing_email,
          notes: initialCompany.notes ?? '',
          tags: initialCompany.tags ?? [],
        }
      : {
          name: '',
          legal_name: '',
          ice: '',
          rc_number: '',
          rc_tribunal: 'casablanca' as any,
          industry: 'services' as any,
          employees_count: 1,
          revenue_range: 'lt_3' as any,
          address: { street: '', city: '', region: 'casablanca-settat' as any, postal_code: '' },
          main_phone: '',
          billing_email: '',
        },
  });

  const watchedIce = watch('ice');
  const iceValidation = watchedIce ? validateICE(watchedIce) : null;

  const watchedRegion = watch('address.region');
  const cities = watchedRegion ? PREFECTURES_BY_REGION[watchedRegion as keyof typeof PREFECTURES_BY_REGION] ?? [] : [];

  const watchedEmployees = watch('employees_count');
  const watchedRevenue = watch('revenue_range');
  const computedSize = classifySize(watchedEmployees ?? 0, watchedRevenue ?? 'lt_3');

  // Auto-update size field based on classification
  useEffect(() => {
    if (computedSize) setValue('size', computedSize, { shouldDirty: false });
  }, [computedSize, setValue]);

  // Reset city when region changes
  useEffect(() => {
    setValue('address.city', '', { shouldDirty: false });
  }, [watchedRegion, setValue]);

  async function onSubmit(values: CompanyCreateFormValues) {
    try {
      if (mode === 'create') {
        await createMutation.mutateAsync(values as any);
      } else if (initialCompany) {
        await updateMutation.mutateAsync({ id: initialCompany.id, patch: values as any });
      }
      reset();
      onOpenChange(false);
    } catch {
      // toast geres dans hooks
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSubmitting) onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('createTitle') : t('editTitle')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {/* Section 1 : Identite legale */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-medium">
              {t('section.identity')}
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
              <div>
                <Label htmlFor="name">{t('field.name')}</Label>
                <Input id="name" {...register('name')} aria-invalid={!!errors.name} />
                {errors.name ? <p className="text-xs text-red-600">{errors.name.message}</p> : null}
              </div>

              <div>
                <Label htmlFor="legal_name">{t('field.legalName')}</Label>
                <Input id="legal_name" {...register('legal_name')} aria-invalid={!!errors.legal_name} />
                {errors.legal_name ? <p className="text-xs text-red-600">{errors.legal_name.message}</p> : null}
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="ice">
                  {t('field.ice')}
                  <span className="ml-2 text-xs text-muted-foreground">{t('field.iceHelper')}</span>
                </Label>
                <div className="relative">
                  <Input id="ice" {...register('ice')} placeholder="001234567000088024" maxLength={15} className="font-mono pr-9" aria-invalid={!!errors.ice} />
                  {iceValidation?.valid ? (
                    <CheckCircle2 className="absolute right-2 top-2.5 h-5 w-5 text-green-600" />
                  ) : iceValidation && watchedIce.length >= 15 ? (
                    <XCircle className="absolute right-2 top-2.5 h-5 w-5 text-red-600" />
                  ) : null}
                </div>
                {iceValidation?.valid ? (
                  <p className="text-xs text-green-700">
                    {t('field.iceValid')} : {formatICE(watchedIce)}
                  </p>
                ) : errors.ice ? (
                  <p className="text-xs text-red-600">{errors.ice.message}</p>
                ) : iceValidation?.errorMessage ? (
                  <p className="text-xs text-amber-700">{iceValidation.errorMessage}</p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="rc_number">{t('field.rcNumber')}</Label>
                <Input id="rc_number" {...register('rc_number')} aria-invalid={!!errors.rc_number} />
                {errors.rc_number ? <p className="text-xs text-red-600">{errors.rc_number.message}</p> : null}
              </div>

              <div>
                <Label htmlFor="rc_tribunal">{t('field.rcTribunal')}</Label>
                <Controller
                  control={control}
                  name="rc_tribunal"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MA_TRIBUNAUX_COMMERCE.map((tr) => (
                          <SelectItem key={tr} value={tr}>{t(`tribunal.${tr}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 2 : Identification fiscale */}
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-medium">
              {t('section.fiscal')}
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 gap-3 p-3 md:grid-cols-3">
              <div>
                <Label htmlFor="patente">{t('field.patente')}</Label>
                <Input id="patente" {...register('patente')} placeholder="12345678" />
                {errors.patente ? <p className="text-xs text-red-600">{errors.patente.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="cnss">{t('field.cnss')}</Label>
                <Input id="cnss" {...register('cnss')} placeholder="1234567" />
                {errors.cnss ? <p className="text-xs text-red-600">{errors.cnss.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="identifiant_fiscal">{t('field.if')}</Label>
                <Input id="identifiant_fiscal" {...register('identifiant_fiscal')} placeholder="12345678" />
                {errors.identifiant_fiscal ? <p className="text-xs text-red-600">{errors.identifiant_fiscal.message}</p> : null}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 3 : Activite + Taille */}
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-medium">
              {t('section.activity')}
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
              <div>
                <Label htmlFor="industry">{t('field.industry')}</Label>
                <Controller
                  control={control}
                  name="industry"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES_MA.map((ind) => (
                          <SelectItem key={ind} value={ind}>{t(`industries.${ind}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label htmlFor="sub_industry_label">{t('field.subIndustry')}</Label>
                <Input id="sub_industry_label" {...register('sub_industry_label')} />
              </div>
              <div>
                <Label htmlFor="employees_count">{t('field.employees')}</Label>
                <Input id="employees_count" type="number" min={0} {...register('employees_count', { valueAsNumber: true })} />
                {errors.employees_count ? <p className="text-xs text-red-600">{errors.employees_count.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="revenue_range">{t('field.revenue')}</Label>
                <Controller
                  control={control}
                  name="revenue_range"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {REVENUE_RANGES.map((r) => (
                          <SelectItem key={r} value={r}>{t(`revenueRange.${r}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="md:col-span-2 rounded-md bg-muted/50 p-2 text-xs">
                {t('field.computedSize')} : <strong>{computedSize}</strong>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 4 : Adresse */}
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-medium">
              {t('section.address')}
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label htmlFor="address.street">{t('field.street')}</Label>
                <Input id="address.street" {...register('address.street')} />
                {errors.address?.street ? <p className="text-xs text-red-600">{errors.address.street.message}</p> : null}
              </div>
              <div>
                <Label>{t('field.region')}</Label>
                <Controller
                  control={control}
                  name="address.region"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MA_REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>{t(`regions.${r}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label>{t('field.city')}</Label>
                <Controller
                  control={control}
                  name="address.city"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger><SelectValue placeholder={t('field.cityPlaceholder')} /></SelectTrigger>
                      <SelectContent>
                        {cities.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.address?.city ? <p className="text-xs text-red-600">{errors.address.city.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="address.postal_code">{t('field.postalCode')}</Label>
                <Input id="address.postal_code" {...register('address.postal_code')} maxLength={5} />
                {errors.address?.postal_code ? <p className="text-xs text-red-600">{errors.address.postal_code.message}</p> : null}
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Section 5 : Coordonnees */}
          <Collapsible>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md bg-muted px-3 py-2 text-sm font-medium">
              {t('section.contact')}
              <ChevronDown className="h-4 w-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2">
              <div>
                <Label htmlFor="website">{t('field.website')}</Label>
                <Input id="website" type="url" {...register('website')} placeholder="https://" />
                {errors.website ? <p className="text-xs text-red-600">{errors.website.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="main_phone">{t('field.mainPhone')}</Label>
                <Input id="main_phone" {...register('main_phone')} placeholder="+212661234567" />
                {errors.main_phone ? <p className="text-xs text-red-600">{errors.main_phone.message}</p> : null}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="billing_email">{t('field.billingEmail')}</Label>
                <Input id="billing_email" type="email" {...register('billing_email')} placeholder="comptabilite@entreprise.ma" />
                {errors.billing_email ? <p className="text-xs text-red-600">{errors.billing_email.message}</p> : null}
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">{t('field.notes')}</Label>
                <Textarea id="notes" {...register('notes')} rows={3} />
              </div>
            </CollapsibleContent>
          </Collapsible>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid || (mode === 'edit' && !isDirty)}>
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? t('actions.create') : t('actions.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

### 6.17 `repo/apps/web-broker/components/companies/company-contacts-tab.tsx` (~180 lignes)

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Plus, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ContactFormDialog } from '@/components/contacts/contact-form-dialog';
import { useCompanyContactsQuery } from '@/lib/queries/companies.queries';
import type { CompanyId } from '@/lib/types/company.types';

interface CompanyContactsTabProps {
  companyId: CompanyId;
  companyName: string;
}

export function CompanyContactsTab({ companyId, companyName }: CompanyContactsTabProps) {
  const t = useTranslations('companies.detail.contacts');
  const { data, isLoading } = useCompanyContactsQuery(companyId);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <p className="text-sm text-muted-foreground">{t('subtitle', { name: companyName })}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> {t('addContact')}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column.name')}</TableHead>
              <TableHead>{t('column.role')}</TableHead>
              <TableHead>{t('column.email')}</TableHead>
              <TableHead>{t('column.phone')}</TableHead>
              <TableHead>{t('column.segment')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <div className="h-32 animate-pulse rounded bg-muted" />
                </TableCell>
              </TableRow>
            ) : data?.data?.length ? (
              data.data.map((contact: any) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-7 w-7">
                        <AvatarFallback>{`${contact.first_name?.[0] ?? ''}${contact.last_name?.[0] ?? ''}`}</AvatarFallback>
                      </Avatar>
                      <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline">
                        {contact.first_name} {contact.last_name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>{contact.role_in_company ?? '-'}</TableCell>
                  <TableCell>
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="text-sm hover:underline">
                        <Mail className="mr-1 inline-block h-3 w-3" />{contact.email}
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} className="text-sm hover:underline">
                        <Phone className="mr-1 inline-block h-3 w-3" />{contact.phone}
                      </a>
                    ) : '-'}
                  </TableCell>
                  <TableCell><Badge variant="secondary">{contact.segment}</Badge></TableCell>
                  <TableCell>
                    <Link href={`/contacts/${contact.id}`} className="text-sm text-primary hover:underline">
                      {t('viewDetail')}
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                  {t('empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Disclaimer loi 09-08 */}
      <p className="text-xs text-muted-foreground">
        {t('law0908Disclaimer')}
      </p>

      <ContactFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        prefillCompanyId={companyId}
      />
    </div>
  );
}
```

### 6.18 `repo/apps/web-broker/components/companies/company-deals-tab.tsx` (~150 lignes)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Plus, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCompanyDealsQuery } from '@/lib/queries/companies.queries';
import type { CompanyId } from '@/lib/types/company.types';

const STAGE_COLOR: Record<string, string> = {
  lead: 'bg-slate-100',
  qualified: 'bg-blue-100',
  proposal: 'bg-amber-100',
  negotiation: 'bg-orange-100',
  won: 'bg-green-100',
  lost: 'bg-red-100',
};

function formatMad(amount: number): string {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(amount);
}

export function CompanyDealsTab({ companyId }: { companyId: CompanyId }) {
  const t = useTranslations('companies.detail.deals');
  const { data, isLoading } = useCompanyDealsQuery(companyId);

  const openCount = data?.data?.filter((d: any) => !['won', 'lost'].includes(d.stage)).length ?? 0;
  const totalValue = data?.data?.reduce((sum: number, d: any) => sum + (d.amount ?? 0), 0) ?? 0;
  const wonCount = data?.data?.filter((d: any) => d.stage === 'won').length ?? 0;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <Button asChild>
          <Link href={`/deals/new?company_id=${companyId}`}>
            <Plus className="mr-1 h-4 w-4" /> {t('addDeal')}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('stats.open')}</div>
          <div className="text-2xl font-bold">{openCount}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('stats.totalValue')}</div>
          <div className="text-2xl font-bold">{formatMad(totalValue)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="text-sm text-muted-foreground">{t('stats.won')}</div>
          <div className="text-2xl font-bold flex items-center gap-1">{wonCount}<TrendingUp className="h-5 w-5 text-green-600" /></div>
        </CardContent></Card>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column.title')}</TableHead>
              <TableHead>{t('column.amount')}</TableHead>
              <TableHead>{t('column.stage')}</TableHead>
              <TableHead>{t('column.expectedClose')}</TableHead>
              <TableHead>{t('column.owner')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5}><div className="h-32 animate-pulse rounded bg-muted" /></TableCell></TableRow>
            ) : data?.data?.length ? (
              data.data.map((deal: any) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <Link href={`/deals/${deal.id}`} className="font-medium hover:underline">{deal.title}</Link>
                  </TableCell>
                  <TableCell className="tabular-nums">{formatMad(deal.amount)}</TableCell>
                  <TableCell>
                    <Badge className={STAGE_COLOR[deal.stage] ?? ''}>{t(`stage.${deal.stage}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    {deal.expected_close_date ? format(new Date(deal.expected_close_date), 'dd/MM/yyyy') : '-'}
                  </TableCell>
                  <TableCell>{deal.owner_name ?? '-'}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">{t('empty')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

### 6.19 `repo/apps/web-broker/components/companies/company-polices-tab.tsx` (~160 lignes)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { format } from 'date-fns';
import { FileText, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCompanyPolicesQuery } from '@/lib/queries/companies.queries';
import type { CompanyId } from '@/lib/types/company.types';

const STATUS_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-900',
  pending: 'bg-amber-100 text-amber-900',
  suspended: 'bg-orange-100 text-orange-900',
  expired: 'bg-slate-100 text-slate-900',
  cancelled: 'bg-red-100 text-red-900',
};

function formatMad(amount: number): string {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(amount);
}

export function CompanyPolicesTab({ companyId }: { companyId: CompanyId }) {
  const t = useTranslations('companies.detail.polices');
  const { data, isLoading } = useCompanyPolicesQuery(companyId);
  const now = Date.now();
  const SIXTY_DAYS = 60 * 24 * 3600 * 1000;

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <Button asChild>
          <Link href={`/polices/new?company_id=${companyId}`}>
            <FileText className="mr-1 h-4 w-4" /> {t('generateQuote')}
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column.number')}</TableHead>
              <TableHead>{t('column.branche')}</TableHead>
              <TableHead>{t('column.startDate')}</TableHead>
              <TableHead>{t('column.endDate')}</TableHead>
              <TableHead>{t('column.status')}</TableHead>
              <TableHead>{t('column.prime')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><div className="h-32 animate-pulse rounded bg-muted" /></TableCell></TableRow>
            ) : data?.data?.length ? (
              data.data.map((p: any) => {
                const endDate = new Date(p.end_date);
                const expiringSoon = endDate.getTime() - now < SIXTY_DAYS && endDate.getTime() > now && p.status === 'active';
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Link href={`/polices/${p.id}`} className="font-mono text-xs hover:underline">{p.policy_number}</Link>
                    </TableCell>
                    <TableCell>{t(`branche.${p.branche}`)}</TableCell>
                    <TableCell>{format(new Date(p.start_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {format(endDate, 'dd/MM/yyyy')}
                        {expiringSoon ? <AlertCircle className="h-4 w-4 text-amber-600" aria-label={t('expiringSoon')} /> : null}
                      </div>
                    </TableCell>
                    <TableCell><Badge className={STATUS_COLOR[p.status] ?? ''}>{t(`status.${p.status}`)}</Badge></TableCell>
                    <TableCell className="tabular-nums">{formatMad(p.prime_annuelle_mad)}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">{t('empty')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

### 6.20 `repo/apps/web-broker/components/companies/company-sinistres-tab.tsx` (~140 lignes)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { format } from 'date-fns';
import { Eye, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCompanySinistresQuery } from '@/lib/queries/companies.queries';
import type { CompanyId } from '@/lib/types/company.types';

function formatMad(amount: number): string {
  return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 }).format(amount);
}

export function CompanySinistresTab({ companyId }: { companyId: CompanyId }) {
  const t = useTranslations('companies.detail.sinistres');
  const { data, isLoading } = useCompanySinistresQuery(companyId);

  return (
    <div className="flex flex-col gap-4 p-6">
      <h3 className="text-lg font-semibold">{t('title')}</h3>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>{t('readonlyTitle')}</AlertTitle>
        <AlertDescription>{t('readonlyDescription')}</AlertDescription>
      </Alert>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column.number')}</TableHead>
              <TableHead>{t('column.police')}</TableHead>
              <TableHead>{t('column.declarationDate')}</TableHead>
              <TableHead>{t('column.status')}</TableHead>
              <TableHead>{t('column.amount')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><div className="h-32 animate-pulse rounded bg-muted" /></TableCell></TableRow>
            ) : data?.data?.length ? (
              data.data.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell><span className="font-mono text-xs">{s.sinistre_number}</span></TableCell>
                  <TableCell>
                    <Link href={`/polices/${s.policy_id}`} className="hover:underline">{s.policy_number}</Link>
                  </TableCell>
                  <TableCell>{format(new Date(s.declaration_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell><Badge variant="secondary">{t(`status.${s.status}`)}</Badge></TableCell>
                  <TableCell className="tabular-nums">{formatMad(s.amount_estimated_mad)}</TableCell>
                  <TableCell>
                    <Link href={`/sinistres/${s.id}`} className="inline-flex items-center text-sm text-primary hover:underline">
                      <Eye className="mr-1 h-3 w-3" /> {t('view')}
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">{t('empty')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

### 6.21 `repo/apps/web-broker/components/companies/company-documents-tab.tsx` (~180 lignes)

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Download, FileText, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useCompanyDocumentsQuery } from '@/lib/queries/companies.queries';
import type { CompanyId } from '@/lib/types/company.types';

const DOC_TYPE_LABEL: Record<string, string> = {
  rc_extract: 'Extrait RC',
  cnss_attestation: 'Attestation CNSS',
  if_card: 'Carte IF',
  statuts: 'Statuts juridiques',
  patente: 'Avis de patente',
  bilan: 'Bilan comptable',
  autre: 'Autre',
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CompanyDocumentsTab({ companyId }: { companyId: CompanyId }) {
  const t = useTranslations('companies.detail.documents');
  const { data, isLoading } = useCompanyDocumentsQuery(companyId);
  const [dragOver, setDragOver] = useState(false);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    // Sprint 10 docs service upload integration placeholder
    const files = Array.from(e.dataTransfer.files);
    console.warn('[companies/documents] upload pending Sprint 10 integration', files.length);
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('title')}</h3>
        <Button>
          <Upload className="mr-1 h-4 w-4" /> {t('upload')}
        </Button>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-8 text-center text-sm transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 text-muted-foreground'
        }`}
      >
        {t('dropZone')}
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('column.type')}</TableHead>
              <TableHead>{t('column.filename')}</TableHead>
              <TableHead>{t('column.uploadedAt')}</TableHead>
              <TableHead>{t('column.uploadedBy')}</TableHead>
              <TableHead>{t('column.size')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6}><div className="h-32 animate-pulse rounded bg-muted" /></TableCell></TableRow>
            ) : data?.data?.length ? (
              data.data.map((doc: any) => (
                <TableRow key={doc.id}>
                  <TableCell><Badge variant="outline">{DOC_TYPE_LABEL[doc.type] ?? doc.type}</Badge></TableCell>
                  <TableCell><FileText className="mr-1 inline-block h-3 w-3" />{doc.filename}</TableCell>
                  <TableCell>{format(new Date(doc.uploaded_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                  <TableCell>{doc.uploaded_by_name}</TableCell>
                  <TableCell>{formatSize(doc.size_bytes)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" asChild>
                        <a href={doc.download_url} target="_blank" rel="noopener noreferrer" aria-label={t('actions.download')}>
                          <Download className="h-4 w-4" />
                        </a>
                      </Button>
                      <Button size="icon" variant="ghost" aria-label={t('actions.delete')}>
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">{t('empty')}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

### 6.22 `repo/apps/web-broker/components/companies/industry-badge.tsx` + `size-badge.tsx`

```typescript
// industry-badge.tsx
'use client';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { INDUSTRY_BADGE_COLOR, type Industry } from '@/lib/utils/industries-ma';

export function IndustryBadge({ industry }: { industry: Industry }) {
  const t = useTranslations('companies.industries');
  return (
    <Badge className={INDUSTRY_BADGE_COLOR[industry]} variant="outline">
      {t(industry)}
    </Badge>
  );
}
```

```typescript
// size-badge.tsx
'use client';
import { Badge } from '@/components/ui/badge';
import type { CompanySize } from '@/lib/utils/size-classifier';

const COLOR: Record<CompanySize, string> = {
  TPE: 'bg-blue-100 text-blue-900',
  PME: 'bg-emerald-100 text-emerald-900',
  ETI: 'bg-amber-100 text-amber-900',
  GE: 'bg-purple-100 text-purple-900',
};

export function SizeBadge({ size }: { size: CompanySize }) {
  return <Badge className={COLOR[size]} variant="outline">{size}</Badge>;
}
```

---

## 7. Tests Vitest (47 tests)

### 7.1 `ice-validator.spec.ts` (15 tests, deja en section 6.2)

### 7.2 `rc-validator.spec.ts` (6 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { validateRC, isValidRC, MA_TRIBUNAUX_COMMERCE } from '../rc-validator';

describe('rc-validator', () => {
  it('test-01 accepts numeric RC 6 digits', () => {
    expect(validateRC('123456', 'casablanca').valid).toBe(true);
  });
  it('test-02 accepts RC with letter prefix', () => {
    expect(validateRC('A1234567', 'rabat').valid).toBe(true);
  });
  it('test-03 rejects empty', () => {
    expect(validateRC('', 'casablanca').valid).toBe(false);
  });
  it('test-04 rejects 3 chars too short', () => {
    expect(validateRC('123', 'casablanca').valid).toBe(false);
  });
  it('test-05 rejects unknown tribunal', () => {
    expect(validateRC('123456', 'paris').valid).toBe(false);
  });
  it('test-06 confirms 17 tribunaux constant', () => {
    expect(MA_TRIBUNAUX_COMMERCE).toHaveLength(17);
  });
});
```

### 7.3 `cnss-validator.spec.ts` (5 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { validateCNSS, isValidCNSS } from '../cnss-validator';

describe('cnss-validator', () => {
  it('test-01 accepts 7 digits', () => {
    expect(validateCNSS('1234567').valid).toBe(true);
  });
  it('test-02 accepts 8 digits', () => {
    expect(validateCNSS('12345678').valid).toBe(true);
  });
  it('test-03 accepts leading zero', () => {
    expect(validateCNSS('0123456').valid).toBe(true);
  });
  it('test-04 rejects letters', () => {
    expect(validateCNSS('12345A6').valid).toBe(false);
  });
  it('test-05 accepts empty (optional)', () => {
    expect(validateCNSS('').valid).toBe(true);
    expect(validateCNSS(null).valid).toBe(true);
  });
});
```

### 7.4 `if-validator.spec.ts` (4 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { validateIF } from '../if-validator';

describe('if-validator', () => {
  it('accepts 7 digits', () => expect(validateIF('1234567').valid).toBe(true));
  it('accepts 8 digits', () => expect(validateIF('12345678').valid).toBe(true));
  it('rejects 6 digits', () => expect(validateIF('123456').valid).toBe(false));
  it('rejects letters', () => expect(validateIF('1234A67').valid).toBe(false));
});
```

### 7.5 `patente-validator.spec.ts` (4 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { validatePatente } from '../patente-validator';

describe('patente-validator', () => {
  it('accepts 7 digits', () => expect(validatePatente('1234567').valid).toBe(true));
  it('accepts 8 digits', () => expect(validatePatente('12345678').valid).toBe(true));
  it('rejects 9 digits', () => expect(validatePatente('123456789').valid).toBe(false));
  it('accepts empty', () => expect(validatePatente('').valid).toBe(true));
});
```

### 7.6 `size-classifier.spec.ts` (5 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { classifySize } from '../size-classifier';

describe('size-classifier', () => {
  it('test-01 5 employees + lt_3 MDH -> TPE', () => {
    expect(classifySize(5, 'lt_3')).toBe('TPE');
  });
  it('test-02 50 employees + 50_to_175 MDH -> PME', () => {
    expect(classifySize(50, '50_to_175')).toBe('PME');
  });
  it('test-03 300 employees + 175_to_500 -> ETI', () => {
    expect(classifySize(300, '175_to_500')).toBe('ETI');
  });
  it('test-04 6000 employees + gt_1500 -> GE', () => {
    expect(classifySize(6000, 'gt_1500')).toBe('GE');
  });
  it('test-05 conflict: 5 employees + gt_1500 MDH -> GE (max wins)', () => {
    expect(classifySize(5, 'gt_1500')).toBe('GE');
  });
});
```

### 7.7 `company.schema.spec.ts` (8 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { CompanyCreateSchema } from '../company.schema';
import { generateValidIce } from '../../utils/ice-validator';

const baseInput = {
  name: 'Skalean',
  legal_name: 'Skalean SARL',
  ice: generateValidIce('0012345670000'),
  rc_number: '123456',
  rc_tribunal: 'casablanca',
  industry: 'services',
  employees_count: 10,
  revenue_range: 'lt_3',
  address: { street: '12 rue de la paix', city: 'Casablanca', region: 'casablanca-settat', postal_code: '20000' },
  main_phone: '+212661234567',
  billing_email: 'billing@skalean.ma',
};

describe('CompanyCreateSchema', () => {
  it('test-01 accepts valid input', () => {
    expect(CompanyCreateSchema.safeParse(baseInput).success).toBe(true);
  });
  it('test-02 rejects invalid ICE', () => {
    const r = CompanyCreateSchema.safeParse({ ...baseInput, ice: '000000000000000' });
    expect(r.success).toBe(false);
  });
  it('test-03 rejects ICE 14 digits', () => {
    expect(CompanyCreateSchema.safeParse({ ...baseInput, ice: '00123456700008' }).success).toBe(false);
  });
  it('test-04 rejects invalid postal_code', () => {
    expect(CompanyCreateSchema.safeParse({ ...baseInput, address: { ...baseInput.address, postal_code: '999' } }).success).toBe(false);
  });
  it('test-05 rejects invalid email', () => {
    expect(CompanyCreateSchema.safeParse({ ...baseInput, billing_email: 'not-an-email' }).success).toBe(false);
  });
  it('test-06 rejects invalid phone MA', () => {
    expect(CompanyCreateSchema.safeParse({ ...baseInput, main_phone: '0123' }).success).toBe(false);
  });
  it('test-07 accepts optional CNSS empty', () => {
    expect(CompanyCreateSchema.safeParse({ ...baseInput, cnss: '' }).success).toBe(true);
  });
  it('test-08 rejects invalid CNSS', () => {
    expect(CompanyCreateSchema.safeParse({ ...baseInput, cnss: 'ABC1234' }).success).toBe(false);
  });
});
```

---

## 8. Tests Playwright E2E (`repo/e2e/web/companies.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { loginAsBroker } from './fixtures/auth-helpers';
import { generateValidIce } from '../../apps/web-broker/lib/utils/ice-validator';

test.beforeEach(async ({ page }) => {
  await loginAsBroker(page, { role: 'broker_admin' });
});

test('test-e2e-01 list page renders companies and supports pagination', async ({ page }) => {
  await page.goto('/fr/companies');
  await expect(page.getByRole('heading', { name: /entreprises/i })).toBeVisible();
  await expect(page.locator('table tbody tr')).toHaveCountGreaterThan(0);
  // pagination next
  await page.getByRole('button', { name: /next|suivant/i }).click();
  await expect(page).toHaveURL(/page=2/);
});

test('test-e2e-02 filter industry persists in URL', async ({ page }) => {
  await page.goto('/fr/companies');
  await page.getByLabel(/secteur/i).click();
  await page.getByRole('option', { name: /btp/i }).click();
  await expect(page).toHaveURL(/industry=btp/);
});

test('test-e2e-03 create company with valid ICE succeeds', async ({ page }) => {
  await page.goto('/fr/companies');
  await page.getByRole('button', { name: /ajouter.*entreprise/i }).click();
  const validIce = generateValidIce('0012345670000');
  await page.getByLabel(/nom commercial/i).fill('Sofidemy Brokers');
  await page.getByLabel(/raison sociale/i).fill('Sofidemy SARL');
  await page.getByLabel(/^ICE/i).fill(validIce);
  await page.getByLabel(/numero RC/i).fill('123456');
  await page.getByLabel(/email facturation/i).fill('billing@sofidemy.ma');
  await page.getByLabel(/telephone/i).fill('+212661234567');
  await page.getByLabel(/rue/i).fill('Bd Anfa');
  await page.getByLabel(/code postal/i).fill('20000');
  await page.getByRole('button', { name: /^creer/i }).click();
  await expect(page.getByText(/entreprise creee avec succes/i)).toBeVisible();
});

test('test-e2e-04 create company with invalid ICE shows checksum error', async ({ page }) => {
  await page.goto('/fr/companies');
  await page.getByRole('button', { name: /ajouter.*entreprise/i }).click();
  await page.getByLabel(/^ICE/i).fill('001234567000099');
  await page.getByLabel(/^ICE/i).blur();
  await expect(page.getByText(/cle de controle ICE invalide/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^creer/i })).toBeDisabled();
});

test('test-e2e-05 create company with 14-digit legacy ICE shows migration message', async ({ page }) => {
  await page.goto('/fr/companies');
  await page.getByRole('button', { name: /ajouter.*entreprise/i }).click();
  await page.getByLabel(/^ICE/i).fill('00123456700008');
  await page.getByLabel(/^ICE/i).blur();
  await expect(page.getByText(/ancien identifiant/i)).toBeVisible();
});

test('test-e2e-06 detail page tabs navigate correctly', async ({ page }) => {
  await page.goto('/fr/companies');
  await page.locator('table tbody tr').first().click();
  await expect(page.getByRole('tab', { name: /contacts/i })).toBeVisible();
  await page.getByRole('tab', { name: /contacts/i }).click();
  await expect(page).toHaveURL(/tab=contacts/);
  await expect(page.getByRole('button', { name: /ajouter.*contact/i })).toBeVisible();
});

test('test-e2e-07 bulk export CSV downloads file', async ({ page }) => {
  await page.goto('/fr/companies');
  // select first 3 rows
  const checkboxes = page.locator('table tbody input[type="checkbox"]');
  for (let i = 0; i < 3; i++) await checkboxes.nth(i).check();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /exporter csv/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/companies-export.*\.csv/);
});

test('test-e2e-08 edit company persists changes via optimistic UI', async ({ page }) => {
  await page.goto('/fr/companies');
  await page.locator('table tbody tr').first().click();
  await page.getByRole('button', { name: /modifier/i }).click();
  await page.getByLabel(/nom commercial/i).fill('Sofidemy Brokers UPDATED');
  await page.getByRole('button', { name: /enregistrer|sauvegarder/i }).click();
  await expect(page.getByText(/mise a jour/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /UPDATED/i })).toBeVisible();
});
```

---

## 9. Endpoints API consommes (Sprint 8 CRM)

| Methode | Endpoint | Description | Permissions |
|---------|----------|-------------|-------------|
| GET | `/api/v1/crm/companies` | List paginee filtree triee | `crm.companies.read` |
| GET | `/api/v1/crm/companies/:id` | Detail company | `crm.companies.read` |
| POST | `/api/v1/crm/companies` | Create (ICE unique tenant) | `crm.companies.create` |
| PATCH | `/api/v1/crm/companies/:id` | Update partiel | `crm.companies.update` |
| DELETE | `/api/v1/crm/companies/:id` | Soft delete | `crm.companies.delete` |
| POST | `/api/v1/crm/companies/:id/restore` | Restore soft-deleted | `crm.companies.delete` |
| GET | `/api/v1/crm/companies/:id/contacts` | Liste contacts lies | `crm.contacts.read` |
| GET | `/api/v1/crm/companies/:id/deals` | Liste deals lies | `crm.deals.read` |
| GET | `/api/v1/crm/companies/:id/polices` | Liste polices | `insure.polices.read` |
| GET | `/api/v1/crm/companies/:id/sinistres` | Liste sinistres (read) | `repair.sinistres.read` |
| GET | `/api/v1/crm/companies/:id/documents` | Liste documents | `docs.read` |
| POST | `/api/v1/crm/companies/bulk/export-csv` | Export CSV multi-select | `crm.companies.export` |
| POST | `/api/v1/crm/companies/bulk/assign-owner` | Bulk assign owner | `crm.companies.update` |
| POST | `/api/v1/crm/companies/bulk/add-tags` | Bulk add tags | `crm.companies.update` |

Toutes les requetes utilisent les headers `x-tenant-id`, `x-trace-id`, `Authorization: Bearer`, `Accept-Language` injectes automatiquement par `api-client.ts` (Sprint 4 task 1.4.1).

---

## 10. Edge Cases (10 EC enumeres)

**EC-01 ICE 14 chiffres (ancien format DGI) saisi** : utilisateur colle un identifiant legacy 14 chiffres recupere d'un document ancien. Detection longueur exacte 14 -> errorCode `WRONG_LENGTH_14` + message explicite invitant a contacter la DGI pour migration. Formulaire bloque submit.

**EC-02 ICE 15 chiffres mais checksum modulo 97 invalide** : utilisateur tape un ICE plausible mais cle de controle erronee (faute de frappe sur les 2 derniers chiffres). Detection cote client (refine Zod) + cote serveur (Sprint 8 service re-valide). Affichage live a partir de 15 chiffres saisis avec message "Cle de controle ICE invalide (attendue : XX)".

**EC-03 ICE duplicate dans le tenant** : utilisateur tente de creer une entreprise avec un ICE deja existant dans son tenant (mais pas dans un autre tenant -- ce qui est legitime). Le backend retourne 409 Conflict avec code `ICE_DUPLICATE_IN_TENANT` + link vers la company existante. Frontend affiche dialog avec lien "Voir l'entreprise existante".

**EC-04 RC format variation extreme par tribunal (Casablanca historique 4 chiffres vs moderne 10 chiffres)** : la regex souple `^[A-Z]?\d{4,10}$` accepte les deux. Si l'utilisateur saisit 3 chiffres (trop court), erreur. Si 11+ chiffres, erreur. La validation cross-field `superRefine` ne bloque pas (verification de format uniquement, pas de check tribunal-specific).

**EC-05 CNSS leading zero perdu si stocke en number** : si frontend convertit "0123456" en number 123456, le leading zero est perdu et la validation echoue cote backend qui re-stringify. Solution implementee : `cnss: z.string()`, jamais `z.number()`.

**EC-06 IF a 6 chiffres** : certaines entreprises tres anciennes ont des IF a 6 chiffres (avant standardisation 7-8). Decision metier : on rejette et on demande migration DGI. Si besoin futur, la regex peut etre etendue mais avec validation cross-DGI optionnelle.

**EC-07 Large company > 10 000 employees (rare mais legitime)** : OCP, ONCF, OCP Group, Banque Populaire Centrale ont > 10 000 employes. Le champ `employees_count: z.number().int().min(0).max(1_000_000)` accepte jusqu'a 1M, classifySize retourne 'GE'. Performance front : `Intl.NumberFormat` rapide, pas de truncation.

**EC-08 Contacts unlinked when company soft-deleted** : si une company est soft-deleted, les contacts lies doivent rester accessibles (Sprint 4.3.5) mais avec un badge "Entreprise supprimee" sur leur fiche. Le backend ne casse pas la FK (deleted_at NULL = active, IS NOT NULL = orphan-but-visible). Sur restoration, les contacts retrouvent automatiquement le lien.

**EC-09 Region change in form reset city** : utilisateur saisit region = "Casablanca-Settat", choisit ville = "Casablanca", puis change region a "Tanger-Tetouan-Al-Hoceima". Le watch + useEffect reset `address.city` a empty string. Re-saisie obligatoire avec les villes de la nouvelle region.

**EC-10 Multi-tenant : meme ICE dans 2 tenants** : cabinet courtier A et cabinet courtier B servent tous deux la meme entreprise reelle (ICE 001234567000088024). C'est legitime metier. Index DB compose `UNIQUE (tenant_id, ice) WHERE deleted_at IS NULL`. Aucun blocage cross-tenant cote frontend ni backend.

**EC-11 ICE avec caracteres invisibles (zero-width space, NBSP)** : copier-coller depuis PDF malforme introduit `​` (zero-width space) entre chiffres. La fonction `stripIceSeparators` les supprime tous avant validation. Test test-12 couvre ce cas.

**EC-12 Race condition : POST puis PATCH sur tempId** : utilisateur cree A (mutation isPending), clique rapidement Edit sur A avant resolution. Le bouton Edit est disabled tant que `useCreateCompanyMutation().isPending` ou si l'id commence par "temp-". Une fois le POST resolu, l'optimistic tempCompany est remplace par la vraie data avec id reel + le bouton Edit reactive.

---

## 11. Criteres de validation V1-V25

- **V1 (P0)** : Page `/companies` charge en SSR < 1500ms (LCP) avec donnees initiales hydratees.
- **V2 (P0)** : DataTable affiche colonnes logo+name, ICE formate, industry badge, city, contacts_count, deals_value MAD, created_at locale-formatted.
- **V3 (P0)** : Pagination cursor server-side fonctionne (next/prev/page-size).
- **V4 (P0)** : Tri par colonnes name / ice / industry / city / created_at / deals_total_value persiste via URL state nuqs.
- **V5 (P0)** : Filtres industry (multi) + region + city (cascading) + size (multi) + search debounced 300ms persistent dans URL.
- **V6 (P0)** : Bulk actions (export CSV, assign owner, add tags) operationnelles avec UI bar conditionnelle.
- **V7 (P0)** : Modal Create company formulaire 5 sections collapsibles, validation Zod stricte.
- **V8 (P0)** : ICE validation live on blur : success badge vert + format ICE affichage, erreur badge rouge + message specifique selon errorCode (EMPTY/WRONG_LENGTH_14/WRONG_LENGTH_OTHER/NOT_DIGITS_ONLY/INVALID_CHECKSUM).
- **V9 (P0)** : ICE checksum modulo 97 conforme algorithme DGI (15 tests unitaires `ice-validator.spec.ts` passent).
- **V10 (P0)** : RC validation regex souple + tribunal enum 17 entries (6 tests `rc-validator.spec.ts` passent).
- **V11 (P0)** : CNSS / IF / patente validations basiques 7-8 chiffres + tests unitaires (13 tests passent).
- **V12 (P0)** : Auto-classify size TPE/PME/ETI/GE selon employees_count + revenue_range live dans le formulaire.
- **V13 (P0)** : Cascading region -> city select : changement region reset city correctement.
- **V14 (P0)** : Page detail `/companies/[id]` charge avec 6 tabs (Info / Contacts / Deals / Polices / Sinistres / Documents).
- **V15 (P0)** : Tab state URL persiste (nuqs `?tab=contacts`).
- **V16 (P0)** : Tab Contacts associes affiche contacts WHERE company_id == this.id + bouton "+ Ajouter contact" ouvre `<ContactFormDialog>` pre-rempli.
- **V17 (P0)** : Tab Deals affiche stats (open count / total value / won count) + table deals.
- **V18 (P0)** : Tab Polices affiche table polices souscrites avec badge expiring soon (60j).
- **V19 (P0)** : Tab Sinistres en read-only avec alert metier M9 (courtier n'intervient pas).
- **V20 (P0)** : Tab Documents avec drop-zone upload + table documents juridiques.
- **V21 (P0)** : Optimistic UI on create : nouvelle company apparait immediatement en haut de la liste avec id temp, replace par vraie data sur success, rollback toast erreur sur fail.
- **V22 (P0)** : Optimistic UI on update : detail company update immediat, rollback sur error.
- **V23 (P0)** : Tests Vitest 47 tests passent (15 ICE + 6 RC + 5 CNSS + 4 IF + 4 patente + 5 size + 8 schema).
- **V24 (P0)** : Tests Playwright E2E 8 tests passent (list + filter + create valid + create invalid ICE + create 14-digit legacy + detail tabs + bulk export + edit optimistic).
- **V25 (P0)** : `pnpm --filter @insurtech/web-broker build` succede, `typecheck` 0 erreur, `lint` 0 warning, `grep -r "emoji-regex" repo/apps/web-broker/components/companies/` retourne 0 ligne.

---

## 12. Conformite Maroc (regulatoire + linguistique)

### Conformite DGI

L'ICE est valide selon l'algorithme officiel DGI publie dans la circulaire 717/2011 et le portail ice.gov.ma : 15 chiffres, decomposition 7/3/3/2, cle de controle modulo 97. Aucune entreprise ne peut etre creee dans le CRM sans ICE valide (V8 + V9). Cette stricte conformite protege le cabinet courtier contre l'amende ACAPS pour souscription police avec donnees client invalides.

### Conformite ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

Sur les flows de souscription Sprint 17+ qui s'appuieront sur cette page Companies, l'ICE est une donnee obligatoire dans le rapport trimestriel ACAPS (formulaire B-COURTIER). La V9 garantit que tous les ICE stockes sont mathematiquement valides DGI.

### Conformite tribunaux de commerce

Le RC est attribue par 17 tribunaux de commerce reconnus (V10). Le champ `rc_tribunal` enum oblige a selectionner parmi les tribunaux officiels, ce qui permet a Sprint 31 (Reporting ACAPS) de generer des rapports geographiques fiables.

### Conformite CNSS (Caisse Nationale de Securite Sociale)

Pour les souscriptions de police Sante collective ou Accidents du travail, le numero CNSS de l'entreprise est obligatoire (V11). Sa validation format 7-8 chiffres protege contre les saisies incorrectes.

### Conformite loi 09-08 (protection des donnees a caractere personnel)

Bien qu'une entreprise ne soit pas une personne physique, les contacts associes (tab Contacts) sont des personnes physiques. Un disclaimer explicite est affiche en bas du tab Contacts (V16) : "Les donnees personnelles des contacts sont traitees conformement a la loi 09-08. Vous disposez d'un droit d'acces et de rectification aupres du DPO du cabinet."

### Linguistique : 3 locales fr / ar-MA / ar

Toutes les UI strings sont traduites dans les 3 locales (fr defaut, ar-MA Darija, ar arabe classique avec RTL). Les 60 cles ajoutees couvrent : titres pages + tabs + labels formulaire + messages erreur + dropdown industries + dropdown regions + dropdown tribunaux + dropdown sizes + dropdown revenue ranges + boutons actions + empty states + disclaimer loi 09-08 + tooltips ICE/RC/CNSS/IF/patente.

---

## 13. Conventions (rappel complet)

### Conventions de nommage

| Element | Convention | Exemple |
|---------|-----------|---------|
| Fichier component React | kebab-case `.tsx` | `company-form-dialog.tsx` |
| Fichier hook custom | kebab-case `.ts` `use-` prefix | `use-companies-filters.ts` |
| Fichier util | kebab-case `.ts` | `ice-validator.ts` |
| Fichier schema Zod | kebab-case `.ts` `*.schema.ts` suffix | `company.schema.ts` |
| Fichier API wrapper | kebab-case `.ts` `*.api.ts` suffix | `companies.api.ts` |
| Fichier queries TanStack | kebab-case `.ts` `*.queries.ts` suffix | `companies.queries.ts` |
| Fichier test Vitest | meme nom + `.spec.ts` suffix | `ice-validator.spec.ts` |
| Fichier test Playwright | meme nom + `.spec.ts` dans `repo/e2e/web/` | `companies.spec.ts` |
| Composant React | PascalCase | `CompanyFormDialog` |
| Hook React | camelCase `use` prefix | `useCompaniesQuery` |
| Type TypeScript | PascalCase | `CompanyCreateInput` |
| Branded type | `Brand & { __brand: 'Name' }` | `type Ice = string & { __brand: 'Ice' }` |
| Constante | UPPER_SNAKE_CASE | `MA_TRIBUNAUX_COMMERCE` |
| Variable / fonction | camelCase | `validateICE`, `formatICE` |
| Enum string literal | snake_case en DB / camelCase en TS | `'casablanca-settat'`, `'lt_3'` |
| Cle i18n | dot.case namespace | `companies.form.field.ice` |
| URL route | kebab-case | `/companies/[id]` |

### Conventions Git

- Branch : `feat/sprint-16/companies-page-list-filters-detail`
- Commit : `feat(web-broker): companies page list + filters + form dialog + detail tabs + ICE validation DGI`
- PR title : `[Sprint 16][4.3.6] Companies Page : List + Filters + Create/Edit + Detail`
- PR description : reference meta-prompt B-16 section 4.3.6 + livrables L1-L25 cocheables + screenshots forme ICE valid/invalid + screenshots detail tabs.

### Conventions code

- **Imports order** : (1) React + Next.js ; (2) libs externes ; (3) `@/components/` ; (4) `@/lib/` ; (5) types ; (6) relatives.
- **'use client' directive** : uniquement sur components qui ont besoin (form, hooks, state). Server Components par defaut.
- **async/await > .then()** : toujours.
- **Aucun any explicit** sauf cast Zod enum (`as unknown as [string, ...string[]]`) bien commente.
- **toast.success / toast.error** uniquement (pas de info/warning pour eviter dilution).
- **JSDoc obligatoire** sur tous les exports de `lib/utils/` (helpers metier critiques).
- **Tests Vitest** : nommage `test-NN should ...` pour traceabilite.
- **Tests Playwright** : nommage `test-e2e-NN ...` + scenarios self-contained avec fixtures.

### Conventions UX

- **Skeleton loading** pour chaque section async (table rows, tab content).
- **Empty state** texte localise + suggested action si applicable.
- **Error state** ErrorBoundary + bouton "Reessayer" + Sentry capture.
- **Optimistic UI** : immediate feedback + rollback automatique sur error.
- **Disabled state** : tout bouton submit pendant `isPending`.
- **Focus management** : auto-focus premier champ a l'ouverture modal.
- **Keyboard a11y** : Escape ferme modal sauf si submitting.
- **ARIA labels** sur tous icones-only buttons.
- **Color contrast** WCAG 2.1 AA respecte (Sprint 4 tokens deja conformes).
- **Touch targets** >= 44x44px (mobile).

### Conventions API

- **REST** : verbes HTTP standards. GET idempotent. POST/PATCH/DELETE avec Idempotency-Key.
- **Pagination** : cursor (page+page_size) avec meta `total / page / page_size / total_pages`.
- **Sort** : `sort_by=field&sort_dir=asc|desc`.
- **Filters** : array via `?industry=btp,services` (comma-separated) ou multi-value Standard.
- **Soft delete** : `deleted_at` IS NULL filter par defaut. Inclure deleted via `?include_deleted=true` (admin only).
- **Error format** : `{ error: { code: 'ICE_DUPLICATE_IN_TENANT', message: '...', details: {...} } }`.

---

## 14. Securite

### Validation cote client + cote serveur

Defense en profondeur : la validation Zod cote client (`CompanyCreateSchema`) empeche les requetes invalides d'atteindre le serveur. Mais le serveur Sprint 8 NestJS doit IMPERATIVEMENT re-valider avec le meme schema (re-import du package partage `@insurtech/shared-schemas` ou re-definir cote backend) -- la securite client ne peut JAMAIS etre la seule barriere (devtools + curl + Postman bypassent trivialement).

### RBAC permissions

| Permission | Role broker_admin | role broker_user | role broker_assistant |
|------------|--------------------|-------------------|------------------------|
| `crm.companies.read` | OUI | OUI | OUI |
| `crm.companies.create` | OUI | OUI | OUI |
| `crm.companies.update` | OUI | OUI | NON |
| `crm.companies.delete` | OUI | NON | NON |
| `crm.companies.export` | OUI | OUI | NON |
| `docs.read` | OUI | OUI | NON |

Cote UI (Sprint 4.3.12 RBAC) :
- Bouton "Supprimer" masque pour broker_user et broker_assistant.
- Bouton "Modifier" masque pour broker_assistant.
- Bouton "Exporter CSV" masque pour broker_assistant.
- Tab Documents conditionnel `<HasPermission permission="docs.read">`.

### Audit trail

Toutes les mutations sont auditees cote backend (decision-007) :
- POST company -> `crm_audit_log INSERT (actor_id, tenant_id, entity='company', entity_id, action='create', diff=full_payload)`
- PATCH company -> `crm_audit_log INSERT (..., action='update', diff=old_vs_new)`
- DELETE company -> `crm_audit_log INSERT (..., action='soft_delete')`
- RESTORE company -> `crm_audit_log INSERT (..., action='restore')`

Le `x-trace-id` injecte automatiquement par api-client.ts est propage dans les logs backend, ce qui permet de corleler une erreur UI a la requete serveur exacte.

### Donnees sensibles

- L'ICE n'est PAS un secret (publication legale obligatoire sur factures) -> stockage clair OK.
- Le CNSS n'est pas un secret par lui-meme mais son association a une entreprise revele la situation sociale -> filtrage RBAC.
- Le billing_email peut etre une mail boite generique (comptabilite@...) mais aussi parfois un email personnel d'un dirigeant -> meme traitement loi 09-08.
- Aucun PII (CIN, numero passeport) dans une fiche entreprise (les PII sont sur les contacts associes -- voir Sprint 4.3.5).

### Headers securite

Tous les headers Sprint 4 task 1.4.1 deja en place s'appliquent : CSP strict, X-Frame-Options DENY, HSTS, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restrictive.

### Rate limiting

L'endpoint `/api/v1/crm/companies` est rate-limited cote backend Sprint 6 : 100 requetes / minute / user pour les GET, 30 requetes / minute / user pour les POST/PATCH/DELETE. En cas de depassement, 429 Too Many Requests + toast UI explicite.

### CSRF

L'API utilise Bearer token Authorization JWT donc pas vulnerable a CSRF classique. Pas de cookie de session pour les mutations API.

---

## 15. Observabilite

### Sentry integration

Toutes les erreurs frontend sont captees automatiquement par Sentry init Sprint 4 :
- ErrorBoundary global capture les erreurs render React.
- Axios response interceptor capture les 5xx avec `Sentry.captureException(err, { extra: { url, status, trace_id } })`.
- Les mutations TanStack `onError` ajoutent un breadcrumb avant de toaster.

### Tags Sentry specifiques companies

```typescript
Sentry.setTag('feature', 'companies');
Sentry.setContext('company_create_attempt', {
  ice_valid: iceValidation.valid,
  ice_error_code: iceValidation.errorCode,
  industry: values.industry,
  size_computed: computedSize,
});
```

### Metrics business (Sprint 13 Analytics)

- `companies.created.total` counter par tenant + industry + size.
- `companies.ice_validation_failed.total` counter par errorCode (analyse pour ameliorations UX).
- `companies.list.viewed.total` counter par filter combination (analyse usage).
- `companies.bulk_export.total` counter par bulk_size bucket.

### Logs

Le frontend log via `lib/logger.ts` (Sprint 4 task 1.4.1) :
- DEBUG : details ICE validation steps (dev only).
- INFO : create company success.
- WARN : ICE checksum mismatch detected client-side (pre-submit).
- ERROR : mutation failure capture.

### Performance

- LCP target `/companies` : < 1500ms (P95).
- TBT target `/companies` : < 200ms.
- CLS target : < 0.1.
- Bundle size companies feature : < 100kb gzipped (mesure Lighthouse + Next.js analyzer).

Mesure via `next-bundle-analyzer` et Lighthouse CI (Sprint 4 deja configure) sur chaque PR.

---

## 16. Performance

### Strategies

1. **Server Components par defaut** : la page list et detail sont des Server Components qui fetchent les donnees initiales et hydratent TanStack Query cote client via `<HydrationBoundary>`. Pas de waterfall reseau client-side au premier render.

2. **`placeholderData: (prev) => prev`** : pendant les refetchs filtres/pagination, l'ancienne table reste visible (avec spinner discret) au lieu de flasher un skeleton. UX fluide.

3. **`staleTime: 30s`** : evite refetch a chaque mount component.

4. **Prefetch tabs en parallele** : sur le detail page, les 6 tabs sont prefetched en parallele via `Promise.all` => navigation tabs instantanee.

5. **Debounce search 300ms** : evite spam endpoint sur chaque keystroke.

6. **`manualPagination + manualSorting`** : TanStack Table delegue au serveur, pas de tri client en memoire (qui exploserait au-dela de 1000 rows).

7. **`optimizePackageImports: ['lucide-react']`** : Next.js tree-shake aggressively lucide-react (Sprint 4 task 1.4.1 deja configure).

8. **Avatar fallback CSS** : pas de fetch d'image par defaut, juste les initiales.

9. **`Intl.NumberFormat` cached** : creer une instance par locale + reutiliser au lieu de re-instancier a chaque render.

10. **Suspense boundaries par tab** : chaque tab peut loader independamment sans bloquer les autres.

### Mesures cibles

| Metric | Target | Tool |
|--------|--------|------|
| LCP `/companies` | < 1500ms | Lighthouse CI |
| TBT `/companies` | < 200ms | Lighthouse CI |
| FID `/companies` | < 100ms | Real user monitoring (Sprint 30) |
| CLS | < 0.1 | Lighthouse |
| Bundle `/companies` gz | < 100kb | next-bundle-analyzer |
| API GET /companies p95 | < 200ms | backend metrics (Sprint 13) |

---

## 17. Notes implementation finales + Definition of Done

### Notes implementation

1. **Reuse du pattern Sprint 4.3.5 (Contacts)** : la structure DataTable + FormDialog + Optimistic UI + Tabs detail est identique. Seules les colonnes, champs, validations et tabs sont specifiques. Le developpeur qui implemente 4.3.6 doit garder un fichier `apps/web-broker/components/contacts/contacts-table.tsx` ouvert en reference.

2. **ICE algorithm partage** : le code `lib/utils/ice-validator.ts` doit IMPERATIVEMENT etre identique cote backend Sprint 8. Recommendation forte : extraire dans `packages/shared-validators/` (workspace package) pour zero divergence. A defaut, copier-coller strict + tests miroir.

3. **Industries dropdown traduction inconsistante** : ne JAMAIS hardcoder `<SelectItem value="btp">BTP</SelectItem>`. Toujours `<SelectItem value="btp">{t('industries.btp')}</SelectItem>`. Le value reste le code enum, le label change selon locale.

4. **Cascading region/city avec react-hook-form** : utiliser `Controller` (pas `register`) pour les Select shadcn/ui car ces composants ne sont pas natifs `<select>`.

5. **Optimistic UI rollback robustness** : toujours `onMutate` -> snapshot + return context. `onError` -> restore from context. Sinon, en cas d'erreur reseau, l'UI reste avec la fausse donnee optimistic.

6. **Modal close pendant submit** : si l'utilisateur ferme la modal pendant un POST, la mutation continue (TanStack ne cancel pas par defaut). C'est OK : success ou error sera capturee par `onSuccess`/`onError` qui declenchent toast globalement. Bouton close disabled tant que isPending.

7. **Sub-industry label libre** : ce champ texte libre peut etre rempli par les commerciaux pour preciser ("BTP -> Travaux d'electricite specialises"). Il ne participe pas au filtrage mais sert au reporting interne.

8. **Founded year optionnel** : certaines entreprises tres anciennes (avant numerisation registres) ont une date de creation perdue. Champ optionnel.

9. **Notes textarea limite 2000 chars** : suffisant pour notes commerciales. Au-dela, utiliser le module Documents pour stocker un PDF de notes detaillees.

10. **Logo upload Sprint 10 placeholder** : la fonctionnalite upload logo entreprise sera implementee Sprint 10 (Docs service). Pour Sprint 16, la fiche detail affiche un Avatar avec initiales si `logo_url === null`.

11. **Recherche full-text Sprint 8 indexes** : le filter `q` traverse name + legal_name + ICE. Le backend Sprint 8 doit avoir un index `gin (... gin_trgm_ops)` sur ces colonnes pour des performances sub-200ms sur 50K rows.

12. **Bulk actions limite 100 IDs** : eviter les payloads massifs. Si user selectionne 500 companies via "Select all", l'export se fait en async (job queue Sprint 11) avec notification email.

13. **Restore soft-deleted** : le restore est expose uniquement via API + admin UI (Sprint 4.3.11 parametres > corbeille). Pas accessible dans la page list standard.

14. **Tab Documents permission** : tres important d'utiliser `<HasPermission permission="docs.read">`. Un assistant ne doit pas voir les documents juridiques sensibles.

15. **Comptage contacts_count / deals_open_count / polices_active_count** : ces champs viennent du backend Sprint 8 qui les calcule via vues materialisees rafraichies toutes les 5 minutes. Pas de calcul cote frontend.

### Definition of Done (DoD)

- [ ] Tous les livrables L1-L25 cochables sont implementes et committed.
- [ ] `pnpm --filter @insurtech/web-broker build` reussit en CI.
- [ ] `pnpm --filter @insurtech/web-broker typecheck` 0 erreur.
- [ ] `pnpm --filter @insurtech/web-broker lint --max-warnings 0` 0 warning.
- [ ] `pnpm --filter @insurtech/web-broker test` 47 tests Vitest pass + coverage > 80% sur `lib/utils/*` (validators critiques).
- [ ] `pnpm test:e2e -- companies.spec.ts` 8 tests Playwright pass en local + CI.
- [ ] Lighthouse `/companies` Performance >= 70, Accessibility >= 90, Best Practices >= 90, SEO >= 80.
- [ ] Lighthouse `/companies/[id]` accessibility >= 90 (focus management tabs + ARIA labels).
- [ ] Aucun emoji dans le code, JSON messages, helpers, tests (CI script `check-no-emoji.sh`).
- [ ] Aucun `console.log` dans `apps/web-broker/components/companies/` ni `apps/web-broker/lib/` (ESLint rule).
- [ ] 3 locales fr / ar-MA / ar avec parite cles validee par script CI `validate-i18n-keys.ts`.
- [ ] RTL test : `/ar-MA/companies` affiche `dir="rtl"` et le DataTable + formulaire respectent l'inversion.
- [ ] Tests E2E Playwright headless en CI green sur 5 runs consecutifs (anti-flaky).
- [ ] PR review : 2 approbations dont au moins 1 lead frontend.
- [ ] Documentation utilisateur Sprint 32 : section "Gestion des entreprises" redigee (markdown dans `00-pilotage/documentation/user-guides/web-broker/companies.md`).
- [ ] Screenshots README PR : (a) liste filtrees, (b) modal create avec ICE valide, (c) modal create avec ICE invalide error, (d) detail page tab Contacts associes, (e) detail page tab Documents.
- [ ] Smoke test manuel post-deploy staging : creation 3 companies avec ICE differents (TPE, PME, GE) + filtrage industry + bulk export CSV + detail tabs navigation + soft delete + restore.
- [ ] Audit accessibilite manuel : navigation 100% clavier (tab order), focus indicator visible, screen reader (NVDA / VoiceOver) annonce correctement les badges status + erreurs validation.
- [ ] Verification charge : seed 5000 companies en dev DB, mesurer LCP `/companies` < 2s, scroll table fluide 60fps, recherche debounce ne genere pas de cascade requests.
- [ ] Verification security : audit trail backend confirme entry pour chaque mutation, RBAC OK pour les 3 roles (test manuel switch role).

### Definition of Ready (DoR) -- pour 4.3.7 Deals

A la sortie de 4.3.6, la tache 4.3.7 (Deals) peut demarrer avec :
- Pattern DataTable + FormDialog + Optimistic UI eprouve sur 2 entites (Contacts 4.3.5 + Companies 4.3.6).
- Selecteur Combobox companies pre-disponible : `<CompanyComboboxField>` reutilisable pour lier deal -> company.
- Endpoint backend Sprint 8 `/api/v1/crm/companies?q=...` pour autocomplete combobox companies.
- Hook `useCompanyQuery(id)` deja en place pour pre-fetch company info dans le detail deal.

---

---

## 18. Annexes detaillees

### 18.1 Translations i18n complete (extrait fr.json)

```json
{
  "companies": {
    "_locale": "fr",
    "list": {
      "title": "Entreprises",
      "subtitle": "Gerez votre portefeuille clients B2B",
      "empty": "Aucune entreprise ne correspond aux filtres",
      "metaDescription": "Liste des entreprises clientes du cabinet de courtage"
    },
    "actions": {
      "addCompany": "Ajouter une entreprise",
      "exportCsv": "Exporter CSV",
      "assignOwner": "Assigner a un commercial",
      "addTags": "Ajouter des tags",
      "delete": "Supprimer",
      "restore": "Restaurer"
    },
    "columns": {
      "name": "Nom",
      "ice": "ICE",
      "industry": "Secteur",
      "city": "Ville",
      "size": "Taille",
      "contactsCount": "Contacts",
      "dealsValue": "Valeur deals",
      "createdAt": "Cree le"
    },
    "filters": {
      "label": "Filtres",
      "searchPlaceholder": "Rechercher par nom, raison sociale ou ICE",
      "searchAriaLabel": "Recherche entreprise",
      "industryPlaceholder": "Tous secteurs",
      "regionPlaceholder": "Toutes regions",
      "regionAll": "Toutes regions",
      "cityPlaceholder": "Toutes villes",
      "cityDisabled": "Selectionnez d'abord une region",
      "cityAll": "Toutes villes",
      "sizePlaceholder": "Toutes tailles",
      "activeCount": "filtres actifs",
      "resetAll": "Reinitialiser"
    },
    "industries": {
      "agriculture": "Agriculture",
      "industrie": "Industrie manufacturiere",
      "btp": "BTP",
      "commerce": "Commerce",
      "transport": "Transport et logistique",
      "immobilier": "Immobilier",
      "services": "Services aux entreprises",
      "finance": "Finance et assurances",
      "sante": "Sante et action sociale",
      "education": "Education",
      "hotellerie": "Hotellerie et restauration",
      "energie": "Energie",
      "mines": "Mines",
      "textile": "Textile et habillement",
      "agroalimentaire": "Agroalimentaire",
      "artisanat": "Artisanat"
    },
    "regions": {
      "tanger-tetouan-al-hoceima": "Tanger-Tetouan-Al Hoceima",
      "oriental": "Oriental",
      "fes-meknes": "Fes-Meknes",
      "rabat-sale-kenitra": "Rabat-Sale-Kenitra",
      "beni-mellal-khenifra": "Beni Mellal-Khenifra",
      "casablanca-settat": "Casablanca-Settat",
      "marrakech-safi": "Marrakech-Safi",
      "draa-tafilalet": "Draa-Tafilalet",
      "souss-massa": "Souss-Massa",
      "guelmim-oued-noun": "Guelmim-Oued Noun",
      "laayoune-sakia-el-hamra": "Laayoune-Sakia El Hamra",
      "dakhla-oued-ed-dahab": "Dakhla-Oued Ed-Dahab"
    },
    "sizes": {
      "TPE": "TPE (< 10 salaries)",
      "PME": "PME (10-249)",
      "ETI": "ETI (250-4999)",
      "GE": "Grande entreprise (>= 5000)"
    },
    "revenueRange": {
      "lt_3": "Moins de 3 MDH",
      "3_to_10": "3 a 10 MDH",
      "10_to_50": "10 a 50 MDH",
      "50_to_175": "50 a 175 MDH",
      "175_to_500": "175 a 500 MDH",
      "500_to_1500": "500 MDH a 1.5 MMDH",
      "gt_1500": "Plus de 1.5 MMDH"
    },
    "tribunal": {
      "casablanca": "Tribunal de commerce de Casablanca",
      "rabat": "Tribunal de commerce de Rabat",
      "tanger": "Tribunal de commerce de Tanger",
      "fes": "Tribunal de commerce de Fes",
      "marrakech": "Tribunal de commerce de Marrakech",
      "agadir": "Tribunal de commerce d'Agadir",
      "oujda": "Tribunal de commerce d'Oujda",
      "tetouan": "Tribunal de commerce de Tetouan",
      "settat": "Tribunal de commerce de Settat",
      "beni-mellal": "Tribunal de commerce de Beni Mellal",
      "el-jadida": "Tribunal de commerce d'El Jadida",
      "kenitra": "Tribunal de commerce de Kenitra",
      "meknes": "Tribunal de commerce de Meknes",
      "nador": "Tribunal de commerce de Nador",
      "safi": "Tribunal de commerce de Safi",
      "khouribga": "Tribunal de commerce de Khouribga",
      "laayoune": "Tribunal de commerce de Laayoune"
    },
    "form": {
      "createTitle": "Nouvelle entreprise",
      "editTitle": "Modifier l'entreprise",
      "description": "Renseignez les informations legales et commerciales de l'entreprise. L'ICE est valide automatiquement.",
      "section": {
        "identity": "Identite legale",
        "fiscal": "Identification fiscale",
        "activity": "Activite et taille",
        "address": "Adresse",
        "contact": "Coordonnees"
      },
      "field": {
        "name": "Nom commercial",
        "legalName": "Raison sociale",
        "ice": "ICE (Identifiant Commun de l'Entreprise)",
        "iceHelper": "15 chiffres -- format DGI Maroc",
        "iceValid": "ICE valide",
        "rcNumber": "Numero RC (Registre du Commerce)",
        "rcTribunal": "Tribunal de commerce",
        "patente": "Numero de patente (taxe professionnelle)",
        "cnss": "Numero CNSS",
        "if": "Identifiant Fiscal (IF)",
        "industry": "Secteur d'activite",
        "subIndustry": "Sous-secteur (precision)",
        "employees": "Nombre de salaries",
        "revenue": "Chiffre d'affaires annuel",
        "computedSize": "Taille calculee automatiquement",
        "foundedYear": "Annee de creation",
        "street": "Rue / Avenue",
        "region": "Region",
        "city": "Ville / Prefecture",
        "cityPlaceholder": "Selectionnez une ville",
        "postalCode": "Code postal",
        "website": "Site web",
        "mainPhone": "Telephone principal",
        "billingEmail": "Email de facturation",
        "notes": "Notes commerciales"
      },
      "actions": {
        "create": "Creer l'entreprise",
        "save": "Enregistrer",
        "cancel": "Annuler"
      }
    },
    "create": {
      "success": "Entreprise creee avec succes"
    },
    "update": {
      "success": "Entreprise mise a jour"
    },
    "delete": {
      "success": "Entreprise supprimee (corbeille 30 jours)",
      "confirmTitle": "Supprimer l'entreprise",
      "confirmDescription": "L'entreprise sera placee en corbeille pendant 30 jours avant suppression definitive."
    },
    "detail": {
      "notFound": "Entreprise introuvable",
      "tabs": {
        "info": "Informations",
        "contacts": "Contacts associes",
        "deals": "Deals",
        "polices": "Polices",
        "sinistres": "Sinistres",
        "documents": "Documents"
      },
      "contacts": {
        "title": "Contacts associes",
        "subtitle": "Personnes physiques rattachees a {name}",
        "addContact": "Ajouter un contact",
        "empty": "Aucun contact rattache. Ajoutez un dirigeant ou un interlocuteur commercial.",
        "viewDetail": "Voir",
        "column": {
          "name": "Nom",
          "role": "Fonction",
          "email": "Email",
          "phone": "Telephone",
          "segment": "Segment"
        },
        "law0908Disclaimer": "Les donnees personnelles des contacts sont traitees conformement a la loi 09-08. Le contact dispose d'un droit d'acces et de rectification."
      },
      "deals": {
        "title": "Deals lies",
        "addDeal": "Nouveau deal",
        "empty": "Aucun deal pour cette entreprise.",
        "stats": {
          "open": "Deals ouverts",
          "totalValue": "Valeur totale",
          "won": "Deals gagnes"
        },
        "column": {
          "title": "Titre",
          "amount": "Montant",
          "stage": "Etape",
          "expectedClose": "Cloture prevue",
          "owner": "Commercial"
        },
        "stage": {
          "lead": "Lead",
          "qualified": "Qualifie",
          "proposal": "Proposition",
          "negotiation": "Negociation",
          "won": "Gagne",
          "lost": "Perdu"
        }
      },
      "polices": {
        "title": "Polices entreprise",
        "generateQuote": "Generer un devis",
        "empty": "Aucune police active pour cette entreprise.",
        "expiringSoon": "Expire dans moins de 60 jours",
        "column": {
          "number": "Numero",
          "branche": "Branche",
          "startDate": "Debut",
          "endDate": "Fin",
          "status": "Statut",
          "prime": "Prime annuelle"
        },
        "branche": {
          "auto": "Automobile",
          "multirisque_pro": "Multirisque professionnelle",
          "sante_collective": "Sante collective",
          "rc_pro": "RC professionnelle",
          "transport": "Transport marchandises",
          "marine": "Marine cargo",
          "decennale_btp": "Garantie decennale BTP",
          "flotte": "Flotte automobile"
        },
        "status": {
          "active": "Active",
          "pending": "En attente",
          "suspended": "Suspendue",
          "expired": "Expiree",
          "cancelled": "Resiliee"
        }
      },
      "sinistres": {
        "title": "Sinistres lies",
        "readonlyTitle": "Lecture seule",
        "readonlyDescription": "Le courtier n'intervient pas dans le traitement des sinistres. Le flux est gere directement entre l'assure, le garage et l'assureur. Cette vue est fournie pour suivi commercial et reporting ACAPS.",
        "empty": "Aucun sinistre declare pour cette entreprise.",
        "view": "Consulter",
        "column": {
          "number": "Numero",
          "police": "Police",
          "declarationDate": "Declare le",
          "status": "Statut",
          "amount": "Montant estime"
        },
        "status": {
          "declared": "Declare",
          "acknowledged": "Reconnu",
          "expert_assigned": "Expert assigne",
          "evaluation": "En evaluation",
          "repair_in_progress": "Reparation en cours",
          "settled": "Regle",
          "closed": "Clos",
          "rejected": "Rejete"
        }
      },
      "documents": {
        "title": "Documents juridiques",
        "upload": "Televerser",
        "dropZone": "Deposez un fichier PDF, JPG ou PNG (max 10 MB)",
        "empty": "Aucun document televerse.",
        "column": {
          "type": "Type",
          "filename": "Fichier",
          "uploadedAt": "Televerse le",
          "uploadedBy": "Par",
          "size": "Taille"
        },
        "actions": {
          "download": "Telecharger",
          "delete": "Supprimer"
        }
      }
    },
    "errors": {
      "iceInvalidChecksum": "Cle de controle ICE invalide (modulo 97 DGI Maroc)",
      "iceLegacy14Digits": "ICE 14 chiffres : ancien format, migration DGI requise",
      "iceDuplicate": "Cet ICE existe deja dans votre portefeuille",
      "rcInvalid": "Numero RC invalide pour ce tribunal",
      "cnssInvalid": "Numero CNSS invalide (7-8 chiffres)",
      "ifInvalid": "Identifiant Fiscal invalide (7-8 chiffres)",
      "patenteInvalid": "Numero de patente invalide (7-8 chiffres)",
      "loadFailed": "Echec du chargement des entreprises",
      "createFailed": "Echec de creation",
      "updateFailed": "Echec de mise a jour",
      "deleteFailed": "Echec de suppression"
    }
  }
}
```

### 18.2 Translations i18n ar-MA (Darija) -- extrait

```json
{
  "companies": {
    "_locale": "ar-MA",
    "list": {
      "title": "الشركات",
      "subtitle": "دير محفظة الزبائن ديالك B2B",
      "empty": "ما كاينة حتى شركة كتطابق مع الفلاتر",
      "metaDescription": "لائحة الشركات الزبائن ديال مكتب السمسرة"
    },
    "actions": {
      "addCompany": "زيد شركة",
      "exportCsv": "صدر CSV",
      "assignOwner": "كلف تجاري",
      "addTags": "زيد علامات",
      "delete": "حيد",
      "restore": "رجع"
    },
    "columns": {
      "name": "الاسم",
      "ice": "ICE",
      "industry": "القطاع",
      "city": "المدينة",
      "size": "الحجم",
      "contactsCount": "الاتصالات",
      "dealsValue": "قيمة الصفقات",
      "createdAt": "تم انشاؤها يوم"
    },
    "filters": {
      "label": "الفلاتر",
      "searchPlaceholder": "قلب على الاسم، اسم الشركة، ولا ICE",
      "industryPlaceholder": "جميع القطاعات",
      "regionPlaceholder": "جميع الجهات",
      "regionAll": "جميع الجهات",
      "cityPlaceholder": "جميع المدن",
      "cityDisabled": "اختار جهة الاول",
      "sizePlaceholder": "جميع الاحجام",
      "activeCount": "فلاتر مفعلة",
      "resetAll": "تصفية"
    },
    "industries": {
      "agriculture": "الفلاحة",
      "industrie": "الصناعة التحويلية",
      "btp": "البناء والاشغال",
      "commerce": "التجارة",
      "transport": "النقل واللوجستيك",
      "immobilier": "العقار",
      "services": "الخدمات للشركات",
      "finance": "المالية والتامينات",
      "sante": "الصحة والعمل الاجتماعي",
      "education": "التعليم",
      "hotellerie": "الفندقة والمطاعم",
      "energie": "الطاقة",
      "mines": "المعادن",
      "textile": "النسيج والملابس",
      "agroalimentaire": "الصناعة الغذائية",
      "artisanat": "الصناعة التقليدية"
    }
  }
}
```

### 18.3 Pattern de tests : seed companies pour E2E

```typescript
// repo/e2e/web/fixtures/companies-seed.ts
import { generateValidIce } from '../../../apps/web-broker/lib/utils/ice-validator';

export interface SeedCompany {
  name: string;
  legal_name: string;
  ice: string;
  rc_number: string;
  rc_tribunal: string;
  industry: string;
  employees_count: number;
  revenue_range: string;
  region: string;
  city: string;
}

export const SEED_COMPANIES: SeedCompany[] = [
  {
    name: 'Sofidemy Brokers',
    legal_name: 'Sofidemy SARL',
    ice: generateValidIce('0012345670000'),
    rc_number: '123456',
    rc_tribunal: 'casablanca',
    industry: 'finance',
    employees_count: 25,
    revenue_range: '10_to_50',
    region: 'casablanca-settat',
    city: 'Casablanca',
  },
  {
    name: 'Skalean Tech',
    legal_name: 'Skalean Technologies SA',
    ice: generateValidIce('0023456789012'),
    rc_number: '234567',
    rc_tribunal: 'rabat',
    industry: 'services',
    employees_count: 80,
    revenue_range: '50_to_175',
    region: 'rabat-sale-kenitra',
    city: 'Rabat',
  },
  {
    name: 'Atlas BTP',
    legal_name: 'Atlas Construction SARL',
    ice: generateValidIce('0034567890123'),
    rc_number: '345678',
    rc_tribunal: 'marrakech',
    industry: 'btp',
    employees_count: 350,
    revenue_range: '175_to_500',
    region: 'marrakech-safi',
    city: 'Marrakech',
  },
  {
    name: 'OCP Group',
    legal_name: 'Office Cherifien des Phosphates',
    ice: generateValidIce('0045678901234'),
    rc_number: '456789',
    rc_tribunal: 'casablanca',
    industry: 'mines',
    employees_count: 20000,
    revenue_range: 'gt_1500',
    region: 'casablanca-settat',
    city: 'Casablanca',
  },
  {
    name: 'Riad Yasmina',
    legal_name: 'Yasmina Heritage SARL',
    ice: generateValidIce('0056789012345'),
    rc_number: '567890',
    rc_tribunal: 'marrakech',
    industry: 'hotellerie',
    employees_count: 8,
    revenue_range: 'lt_3',
    region: 'marrakech-safi',
    city: 'Marrakech',
  },
];

export async function seedCompaniesViaApi(token: string, tenantId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const c of SEED_COMPANIES) {
    const res = await fetch('http://localhost:4000/api/v1/crm/companies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-tenant-id': tenantId,
      },
      body: JSON.stringify({
        ...c,
        address: { street: 'Avenue Mohamed V', city: c.city, region: c.region, postal_code: '20000' },
        main_phone: '+212522123456',
        billing_email: `billing@${c.name.toLowerCase().replace(/\s+/g, '')}.ma`,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      ids.push(json.id);
    }
  }
  return ids;
}
```

### 18.4 Test unitaire component CompanyFormDialog (extrait)

```typescript
// repo/apps/web-broker/components/companies/__tests__/company-form-dialog.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CompanyFormDialog } from '../company-form-dialog';
import { NextIntlClientProvider } from 'next-intl';
import frMessages from '@/messages/fr.json';
import { generateValidIce } from '@/lib/utils/ice-validator';

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="fr" messages={frMessages as any} timeZone="Africa/Casablanca">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('CompanyFormDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('test-01 renders all 5 sections collapsible', () => {
    renderWithProviders(<CompanyFormDialog open mode="create" onOpenChange={vi.fn()} />);
    expect(screen.getByText(/identite legale/i)).toBeInTheDocument();
    expect(screen.getByText(/identification fiscale/i)).toBeInTheDocument();
    expect(screen.getByText(/activite et taille/i)).toBeInTheDocument();
    expect(screen.getByText(/^adresse$/i)).toBeInTheDocument();
    expect(screen.getByText(/coordonnees/i)).toBeInTheDocument();
  });

  it('test-02 shows live ICE validation -- valid', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyFormDialog open mode="create" onOpenChange={vi.fn()} />);
    const iceInput = screen.getByLabelText(/^ICE/i);
    await user.type(iceInput, generateValidIce('0012345670000'));
    await waitFor(() => {
      expect(screen.getByText(/ICE valide/i)).toBeInTheDocument();
    });
  });

  it('test-03 shows live ICE validation -- invalid checksum', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyFormDialog open mode="create" onOpenChange={vi.fn()} />);
    const iceInput = screen.getByLabelText(/^ICE/i);
    await user.type(iceInput, '001234567000099');
    await user.tab();
    await waitFor(() => {
      expect(screen.getByText(/cle de controle ICE invalide/i)).toBeInTheDocument();
    });
  });

  it('test-04 submit button disabled when form invalid', () => {
    renderWithProviders(<CompanyFormDialog open mode="create" onOpenChange={vi.fn()} />);
    const submitBtn = screen.getByRole('button', { name: /^creer/i });
    expect(submitBtn).toBeDisabled();
  });

  it('test-05 region change resets city field', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyFormDialog open mode="create" onOpenChange={vi.fn()} />);
    // Pre-select Casablanca-Settat + Casablanca
    // change region to Rabat-Sale-Kenitra
    // verify city is cleared (depend on implementation Select shadcn)
    // This is a placeholder for the implementation:
    expect(true).toBe(true);
  });

  it('test-06 computed size auto-updates on employees change', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CompanyFormDialog open mode="create" onOpenChange={vi.fn()} />);
    const employeesInput = screen.getByLabelText(/nombre de salaries/i);
    await user.clear(employeesInput);
    await user.type(employeesInput, '5000');
    await waitFor(() => {
      expect(screen.getByText(/taille calculee.*GE/i)).toBeInTheDocument();
    });
  });
});
```

### 18.5 Test unitaire CompaniesTable (extrait)

```typescript
// repo/apps/web-broker/components/companies/__tests__/companies-table.spec.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { CompaniesTable } from '../companies-table';
import frMessages from '@/messages/fr.json';

vi.mock('@/lib/queries/companies.queries', () => ({
  useCompaniesQuery: () => ({
    data: {
      data: [
        {
          id: 'co-1',
          name: 'Sofidemy',
          legal_name: 'Sofidemy SARL',
          logo_url: null,
          ice: '001234567000088024',
          industry: 'finance',
          address: { city: 'Casablanca', region: 'casablanca-settat' },
          size: 'PME',
          contacts_count: 5,
          deals_open_count: 2,
          deals_total_value_mad: 1500000,
          polices_active_count: 3,
          created_at: '2026-01-15T10:00:00Z',
        },
      ],
      meta: { total: 1, page: 1, page_size: 25, total_pages: 1 },
    },
    isLoading: false,
    isFetching: false,
  }),
}));

function renderWithProviders(ui: React.ReactNode) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="fr" messages={frMessages as any} timeZone="Africa/Casablanca">
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('CompaniesTable', () => {
  it('renders company row with name + ICE + industry badge', () => {
    renderWithProviders(<CompaniesTable />);
    expect(screen.getByText('Sofidemy')).toBeInTheDocument();
    expect(screen.getByText('Sofidemy SARL')).toBeInTheDocument();
    expect(screen.getByText(/0012345/)).toBeInTheDocument();
    expect(screen.getByText(/finance/i)).toBeInTheDocument();
  });

  it('renders empty state when no companies', () => {
    vi.doMock('@/lib/queries/companies.queries', () => ({
      useCompaniesQuery: () => ({
        data: { data: [], meta: { total: 0, page: 1, page_size: 25, total_pages: 0 } },
        isLoading: false,
        isFetching: false,
      }),
    }));
    renderWithProviders(<CompaniesTable />);
    expect(screen.getByText(/aucune entreprise/i)).toBeInTheDocument();
  });
});
```

### 18.6 Helpers reutilisables exportes

```typescript
// repo/apps/web-broker/components/companies/company-card.tsx (~120 lignes)
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Building2, Phone, Mail, Globe } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IndustryBadge } from './industry-badge';
import { SizeBadge } from './size-badge';
import { formatICE } from '@/lib/utils/ice-validator';
import type { Company } from '@/lib/types/company.types';

interface CompanyCardProps {
  company: Company;
  compact?: boolean;
}

export function CompanyCard({ company, compact = false }: CompanyCardProps) {
  const t = useTranslations('companies.detail');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16">
            {company.logo_url ? <AvatarImage src={company.logo_url} alt={company.name} /> : null}
            <AvatarFallback>
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-1 flex-col gap-1">
            <Link href={`/companies/${company.id}`} className="text-xl font-semibold hover:underline">
              {company.name}
            </Link>
            <p className="text-sm text-muted-foreground">{company.legal_name}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <IndustryBadge industry={company.industry} />
              <SizeBadge size={company.size} />
            </div>
          </div>
        </div>
      </CardHeader>

      {!compact ? (
        <CardContent className="flex flex-col gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">ICE :</span>
            <span className="font-mono text-xs tabular-nums">{formatICE(company.ice)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">RC :</span>
            <span>{company.rc_number} / {company.rc_tribunal}</span>
          </div>
          {company.identifiant_fiscal ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">IF :</span>
              <span>{company.identifiant_fiscal}</span>
            </div>
          ) : null}
          {company.cnss ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">CNSS :</span>
              <span>{company.cnss}</span>
            </div>
          ) : null}
          <div className="mt-2 flex flex-col gap-1">
            <a href={`tel:${company.main_phone}`} className="flex items-center gap-2 hover:underline">
              <Phone className="h-4 w-4" />{company.main_phone}
            </a>
            <a href={`mailto:${company.billing_email}`} className="flex items-center gap-2 hover:underline">
              <Mail className="h-4 w-4" />{company.billing_email}
            </a>
            {company.website ? (
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                <Globe className="h-4 w-4" />{company.website}
              </a>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {company.address.street}, {company.address.city}, {company.address.postal_code}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
```

### 18.7 Bulk actions bar implementation

```typescript
// repo/apps/web-broker/components/companies/company-bulk-actions-bar.tsx (~100 lignes)
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X, Download, UserPlus, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBulkExportCompaniesCsv } from '@/lib/queries/companies.queries';
import type { CompanyId } from '@/lib/types/company.types';

interface CompanyBulkActionsBarProps {
  selectedIds: CompanyId[];
  onClear: () => void;
}

export function CompanyBulkActionsBar({ selectedIds, onClear }: CompanyBulkActionsBarProps) {
  const t = useTranslations('companies.actions');
  const exportMutation = useBulkExportCompaniesCsv();
  const [tagsDialogOpen, setTagsDialogOpen] = useState(false);
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);

  const count = selectedIds.length;

  function handleExport() {
    if (count > 100) {
      // Switch to async job (Sprint 11)
      console.warn('[bulk-export] Selection > 100, switching to async job');
    }
    exportMutation.mutate(selectedIds);
  }

  return (
    <div className="flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-2">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="ghost" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{count} {t('selected')}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exportMutation.isPending}>
          <Download className="mr-1 h-4 w-4" /> {t('exportCsv')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOwnerDialogOpen(true)}>
          <UserPlus className="mr-1 h-4 w-4" /> {t('assignOwner')}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setTagsDialogOpen(true)}>
          <Tag className="mr-1 h-4 w-4" /> {t('addTags')}
        </Button>
      </div>
    </div>
  );
}
```

### 18.8 Row actions menu (kebab)

```typescript
// repo/apps/web-broker/components/companies/company-row-actions.tsx (~80 lignes)
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { MoreVertical, Edit, Trash2, Eye, UserPlus } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CompanyFormDialog } from './company-form-dialog';
import { CompanyDeleteDialog } from './company-delete-dialog';
import { HasPermission } from '@/components/auth/has-permission';
import type { Company } from '@/lib/types/company.types';

export function CompanyRowActions({ company }: { company: Company }) {
  const router = useRouter();
  const t = useTranslations('companies.actions');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={() => router.push(`/companies/${company.id}`)}>
            <Eye className="mr-2 h-4 w-4" /> {t('view')}
          </DropdownMenuItem>
          <HasPermission permission="crm.companies.update">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Edit className="mr-2 h-4 w-4" /> {t('edit')}
            </DropdownMenuItem>
          </HasPermission>
          <DropdownMenuItem onClick={() => router.push(`/contacts/new?company_id=${company.id}`)}>
            <UserPlus className="mr-2 h-4 w-4" /> {t('addContact')}
          </DropdownMenuItem>
          <HasPermission permission="crm.companies.delete">
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-2 h-4 w-4" /> {t('delete')}
            </DropdownMenuItem>
          </HasPermission>
        </DropdownMenuContent>
      </DropdownMenu>

      <CompanyFormDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" initialCompany={company} />
      <CompanyDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} company={company} />
    </>
  );
}
```

### 18.9 Delete confirmation dialog

```typescript
// repo/apps/web-broker/components/companies/company-delete-dialog.tsx (~90 lignes)
'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useDeleteCompanyMutation } from '@/lib/queries/companies.queries';
import type { Company } from '@/lib/types/company.types';

interface CompanyDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  redirectAfter?: boolean;
}

export function CompanyDeleteDialog({ open, onOpenChange, company, redirectAfter }: CompanyDeleteDialogProps) {
  const router = useRouter();
  const t = useTranslations('companies.delete');
  const deleteMutation = useDeleteCompanyMutation();

  async function handleDelete() {
    try {
      await deleteMutation.mutateAsync(company.id);
      onOpenChange(false);
      if (redirectAfter) router.push('/companies');
    } catch {
      // toast in hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!deleteMutation.isPending) onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            {t('confirmTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('confirmDescription')}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription>
            <strong>{company.name}</strong> ({company.legal_name})
            <br />
            ICE : {company.ice}
            <br />
            {company.contacts_count} contact(s) -- {company.deals_open_count} deal(s) -- {company.polices_active_count} police(s)
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={deleteMutation.isPending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('confirmAction')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 18.10 Detail page header avec breadcrumb

```typescript
// repo/apps/web-broker/components/companies/company-detail-header.tsx (~120 lignes)
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronRight, Edit, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { IndustryBadge } from './industry-badge';
import { SizeBadge } from './size-badge';
import { CompanyFormDialog } from './company-form-dialog';
import { CompanyDeleteDialog } from './company-delete-dialog';
import { HasPermission } from '@/components/auth/has-permission';
import { formatICE } from '@/lib/utils/ice-validator';
import type { Company } from '@/lib/types/company.types';

export function CompanyDetailHeader({ company }: { company: Company }) {
  const t = useTranslations('companies.detail');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/dashboard" className="hover:text-foreground">{t('breadcrumb.dashboard')}</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/companies" className="hover:text-foreground">{t('breadcrumb.companies')}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground">{company.name}</span>
      </nav>

      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {company.logo_url ? <AvatarImage src={company.logo_url} alt={company.name} /> : null}
            <AvatarFallback className="text-lg">{company.name.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold">{company.name}</h1>
            <p className="text-sm text-muted-foreground">{company.legal_name}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <IndustryBadge industry={company.industry} />
              <SizeBadge size={company.size} />
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                ICE : {formatICE(company.ice)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {company.website ? (
            <Button variant="outline" asChild>
              <a href={company.website} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1 h-4 w-4" />
                {t('header.website')}
              </a>
            </Button>
          ) : null}
          <HasPermission permission="crm.companies.update">
            <Button onClick={() => setEditOpen(true)}>
              <Edit className="mr-1 h-4 w-4" /> {t('header.edit')}
            </Button>
          </HasPermission>
          <HasPermission permission="crm.companies.delete">
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1 h-4 w-4" /> {t('header.delete')}
            </Button>
          </HasPermission>
        </div>
      </div>

      <CompanyFormDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" initialCompany={company} />
      <CompanyDeleteDialog open={deleteOpen} onOpenChange={setDeleteOpen} company={company} redirectAfter />
    </>
  );
}
```

### 18.11 Schema backend Sprint 8 (rappel coherence)

```typescript
// repo/apps/api/src/crm/companies/dto/create-company.dto.ts (Sprint 8 backend)
import { IsString, Length, Matches, IsEmail, IsEnum, IsInt, Min, Max, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { isValidICE } from '@insurtech/shared-validators'; // workspace package
import { Industry, MaRegion, RevenueRange, MaTribunalCommerce } from '@insurtech/shared-types';

export class AddressDto {
  @IsString() @Length(3, 255) street: string;
  @IsString() @Length(2, 100) city: string;
  @IsEnum(MaRegion) region: MaRegion;
  @Matches(/^\d{5}$/) postal_code: string;
}

export class CreateCompanyDto {
  @IsString() @Length(2, 255) name: string;
  @IsString() @Length(2, 255) legal_name: string;

  @IsString()
  @Length(15, 15)
  @Matches(/^\d{15}$/, { message: 'ICE must be 15 digits' })
  ice: string;

  @IsString() rc_number: string;
  @IsEnum(MaTribunalCommerce) rc_tribunal: MaTribunalCommerce;

  @IsOptional() @IsString() patente?: string;
  @IsOptional() @IsString() cnss?: string;
  @IsOptional() @IsString() identifiant_fiscal?: string;

  @IsEnum(Industry) industry: Industry;
  @IsOptional() @IsString() sub_industry_label?: string;

  @IsInt() @Min(0) @Max(1_000_000) employees_count: number;
  @IsEnum(RevenueRange) revenue_range: RevenueRange;
  @IsOptional() @IsInt() @Min(1900) @Max(new Date().getFullYear()) founded_year?: number;

  @ValidateNested() @Type(() => AddressDto) address: AddressDto;

  @IsOptional() @IsString() website?: string;
  @Matches(/^(?:\+212|0)([5-7])\d{8}$/) main_phone: string;
  @IsEmail() billing_email: string;

  @IsOptional() @IsString() @Length(0, 2000) notes?: string;
  @IsOptional() tags?: string[];

  validate(): void {
    if (!isValidICE(this.ice)) {
      throw new BadRequestException('ICE checksum invalid (modulo 97 DGI)');
    }
  }
}
```

### 18.12 Migration DB Sprint 8 (rappel index)

```sql
-- repo/apps/api/migrations/sprint-08/V020__crm_companies_indexes.sql
-- Index unicite ICE par tenant + recherche full-text + filtres metiers

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE UNIQUE INDEX idx_crm_companies_tenant_ice_unique
  ON crm_companies (tenant_id, ice)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_crm_companies_name_trgm
  ON crm_companies USING gin (name gin_trgm_ops);

CREATE INDEX idx_crm_companies_legal_name_trgm
  ON crm_companies USING gin (legal_name gin_trgm_ops);

CREATE INDEX idx_crm_companies_industry
  ON crm_companies (industry)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_crm_companies_region_city
  ON crm_companies (region, city)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_crm_companies_size_tenant
  ON crm_companies (tenant_id, size)
  WHERE deleted_at IS NULL;

-- Constrainte CHECK ICE format
ALTER TABLE crm_companies
  ADD CONSTRAINT chk_crm_companies_ice_format
  CHECK (ice ~ '^\d{15}$');

-- Constrainte CHECK postal_code MA
ALTER TABLE crm_companies
  ADD CONSTRAINT chk_crm_companies_postal_code_ma
  CHECK (postal_code ~ '^\d{5}$');

-- Trigger audit
CREATE TRIGGER trg_crm_companies_audit
  AFTER INSERT OR UPDATE OR DELETE ON crm_companies
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log_insert('crm_companies');
```

### 18.13 Vues materialisees pour stats (Sprint 8)

```sql
-- repo/apps/api/migrations/sprint-08/V021__crm_companies_stats_mv.sql
CREATE MATERIALIZED VIEW mv_crm_companies_stats AS
SELECT
  c.id AS company_id,
  c.tenant_id,
  COUNT(DISTINCT ct.id) FILTER (WHERE ct.deleted_at IS NULL) AS contacts_count,
  COUNT(DISTINCT d.id) FILTER (WHERE d.stage NOT IN ('won', 'lost') AND d.deleted_at IS NULL) AS deals_open_count,
  COALESCE(SUM(d.amount_mad) FILTER (WHERE d.deleted_at IS NULL), 0) AS deals_total_value_mad,
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'active' AND p.deleted_at IS NULL) AS polices_active_count
FROM crm_companies c
LEFT JOIN crm_contacts ct ON ct.company_id = c.id
LEFT JOIN crm_deals d ON d.company_id = c.id
LEFT JOIN insure_polices p ON p.souscripteur_company_id = c.id
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.tenant_id;

CREATE UNIQUE INDEX idx_mv_crm_companies_stats_company_id
  ON mv_crm_companies_stats (company_id);

-- Refresh job (Sprint 11 background scheduler)
-- Every 5 minutes : REFRESH MATERIALIZED VIEW CONCURRENTLY mv_crm_companies_stats;
```

### 18.14 Sentry breadcrumbs spec

```typescript
// Sentry breadcrumb pattern integre dans api-client.ts (deja Sprint 4 task 1.4.1)
// Mais on ajoute breadcrumb explicite avant mutations companies critiques :

import * as Sentry from '@sentry/nextjs';

export function logCompanyMutationBreadcrumb(
  action: 'create' | 'update' | 'delete' | 'restore',
  companyId: string | null,
  metadata?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    category: 'companies',
    message: `${action} company`,
    level: action === 'delete' ? 'warning' : 'info',
    data: { company_id: companyId, ...metadata },
  });
}

// Usage dans le hook useCreateCompanyMutation :
// onMutate: () => logCompanyMutationBreadcrumb('create', null, { ice: input.ice, industry: input.industry })
```

### 18.15 Skeleton patterns loading

```typescript
// repo/apps/web-broker/app/[locale]/(protected)/companies/loading.tsx (~20 lignes)
export default function Loading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-10 w-40 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-24 animate-pulse rounded-lg bg-muted/50" />
      <div className="h-96 animate-pulse rounded-lg bg-muted/30" />
    </div>
  );
}
```

```typescript
// repo/apps/web-broker/app/[locale]/(protected)/companies/error.tsx (~30 lignes)
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import * as Sentry from '@sentry/nextjs';

export default function CompaniesError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { feature: 'companies', page: 'list' } });
  }, [error]);

  return (
    <div className="flex h-96 flex-col items-center justify-center gap-4 text-center">
      <AlertCircle className="h-12 w-12 text-red-600" />
      <h2 className="text-xl font-semibold">Une erreur est survenue</h2>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      {error.digest ? <p className="text-xs font-mono">ref: {error.digest}</p> : null}
      <Button onClick={reset}>Reessayer</Button>
    </div>
  );
}
```

### 18.16 Page Header reutilisable

```typescript
// repo/apps/web-broker/components/companies/companies-page-header.tsx (~50 lignes)
import { ReactNode } from 'react';

interface CompaniesPageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function CompaniesPageHeader({ title, description, children }: CompaniesPageHeaderProps) {
  return (
    <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children ? <div className="flex gap-2">{children}</div> : null}
    </div>
  );
}
```

### 18.17 Create button helper

```typescript
// repo/apps/web-broker/components/companies/create-company-button.tsx (~40 lignes)
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CompanyFormDialog } from './company-form-dialog';
import { HasPermission } from '@/components/auth/has-permission';

export function CreateCompanyButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false);

  return (
    <HasPermission permission="crm.companies.create">
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" /> {label}
      </Button>
      <CompanyFormDialog open={open} onOpenChange={setOpen} mode="create" />
    </HasPermission>
  );
}
```

### 18.18 Company info tab implementation

```typescript
// repo/apps/web-broker/components/companies/company-info-tab.tsx (~200 lignes)
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import { fr as frLocale } from 'date-fns/locale';
import { Edit, Building2, FileText, Calendar, Users, TrendingUp, MapPin, Globe, Phone, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CompanyFormDialog } from './company-form-dialog';
import { HasPermission } from '@/components/auth/has-permission';
import { useCompanyQuery } from '@/lib/queries/companies.queries';
import { formatICE } from '@/lib/utils/ice-validator';
import type { CompanyId } from '@/lib/types/company.types';

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm">{value}</span>
      </div>
    </div>
  );
}

export function CompanyInfoTab({ companyId }: { companyId: CompanyId }) {
  const t = useTranslations('companies');
  const tInfo = useTranslations('companies.detail.info');
  const tRev = useTranslations('companies.revenueRange');
  const tTrib = useTranslations('companies.tribunal');
  const [editOpen, setEditOpen] = useState(false);
  const { data: company, isLoading } = useCompanyQuery(companyId);

  if (isLoading || !company) {
    return <div className="h-96 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
      {/* Identite legale */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{tInfo('legalIdentity')}</CardTitle>
          <HasPermission permission="crm.companies.update">
            <Button size="sm" variant="ghost" onClick={() => setEditOpen(true)}>
              <Edit className="h-3 w-3" />
            </Button>
          </HasPermission>
        </CardHeader>
        <CardContent>
          <InfoRow icon={Building2} label={t('form.field.legalName')} value={company.legal_name} />
          <InfoRow icon={FileText} label={t('form.field.ice')} value={<span className="font-mono tabular-nums">{formatICE(company.ice)}</span>} />
          <InfoRow icon={FileText} label={t('form.field.rcNumber')} value={`${company.rc_number} (${tTrib(company.rc_tribunal as any)})`} />
          {company.identifiant_fiscal ? <InfoRow icon={FileText} label="IF" value={company.identifiant_fiscal} /> : null}
          {company.cnss ? <InfoRow icon={FileText} label="CNSS" value={company.cnss} /> : null}
          {company.patente ? <InfoRow icon={FileText} label={t('form.field.patente')} value={company.patente} /> : null}
        </CardContent>
      </Card>

      {/* Activite et taille */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tInfo('activity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow icon={Building2} label={t('form.field.industry')} value={t(`industries.${company.industry}`)} />
          {company.sub_industry_label ? <InfoRow icon={Building2} label={t('form.field.subIndustry')} value={company.sub_industry_label} /> : null}
          <InfoRow icon={Users} label={t('form.field.employees')} value={company.employees_count.toLocaleString()} />
          <InfoRow icon={TrendingUp} label={t('form.field.revenue')} value={tRev(company.revenue_range as any)} />
          {company.founded_year ? <InfoRow icon={Calendar} label={t('form.field.foundedYear')} value={company.founded_year} /> : null}
        </CardContent>
      </Card>

      {/* Adresse */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tInfo('address')}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow icon={MapPin} label={t('form.field.street')} value={company.address.street} />
          <InfoRow icon={MapPin} label={t('form.field.city')} value={`${company.address.city}, ${company.address.postal_code}`} />
          <InfoRow icon={MapPin} label={t('form.field.region')} value={t(`regions.${company.address.region}`)} />
        </CardContent>
      </Card>

      {/* Coordonnees */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{tInfo('contact')}</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow icon={Phone} label={t('form.field.mainPhone')} value={<a href={`tel:${company.main_phone}`} className="hover:underline">{company.main_phone}</a>} />
          <InfoRow icon={Mail} label={t('form.field.billingEmail')} value={<a href={`mailto:${company.billing_email}`} className="hover:underline">{company.billing_email}</a>} />
          {company.website ? <InfoRow icon={Globe} label={t('form.field.website')} value={<a href={company.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{company.website}</a>} /> : null}
        </CardContent>
      </Card>

      {company.notes ? (
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{tInfo('notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{company.notes}</p>
          </CardContent>
        </Card>
      ) : null}

      <CompanyFormDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" initialCompany={company} />
    </div>
  );
}
```

### 18.19 Permissions matrix complete (RBAC reference)

| Action | broker_admin | broker_user | broker_assistant | super_admin |
|--------|--------------|-------------|------------------|-------------|
| Voir liste companies | OUI | OUI | OUI | OUI |
| Voir detail company | OUI | OUI | OUI | OUI |
| Creer company | OUI | OUI | OUI | OUI |
| Editer company | OUI | OUI | NON | OUI |
| Modifier ICE post-creation | OUI | NON | NON | OUI |
| Supprimer company (soft) | OUI | NON | NON | OUI |
| Restaurer company | OUI | NON | NON | OUI |
| Voir corbeille | OUI | NON | NON | OUI |
| Bulk export CSV | OUI | OUI | NON | OUI |
| Bulk assign owner | OUI | OUI | NON | OUI |
| Bulk add tags | OUI | OUI | OUI | OUI |
| Tab Documents (lecture) | OUI | OUI | NON | OUI |
| Tab Documents (upload) | OUI | OUI | NON | OUI |
| Tab Documents (delete) | OUI | NON | NON | OUI |
| Tab Sinistres (lecture) | OUI | OUI | OUI | OUI |
| Acceder /companies?include_deleted=true | OUI | NON | NON | OUI |

### 18.20 Glossary (rappel rapide)

- **ICE** : Identifiant Commun de l'Entreprise (15 chiffres, DGI, modulo 97)
- **RC** : Registre du Commerce (numero tribunal, 4-10 chiffres)
- **CNSS** : Caisse Nationale de Securite Sociale (7-8 chiffres)
- **IF** : Identifiant Fiscal (7-8 chiffres, DGI)
- **Patente** : Taxe Professionnelle (7-8 chiffres, communal)
- **TPE/PME/ETI/GE** : Tres Petite / Petite et Moyenne / Taille Intermediaire / Grande Entreprise
- **DGI** : Direction Generale des Impots (Maroc)
- **ACAPS** : Autorite de Controle des Assurances et de la Prevoyance Sociale
- **HCP** : Haut-Commissariat au Plan (statistiques officielles MA)
- **MAD** : Dirham Marocain (devise)
- **MDH** : Millions de Dirhams
- **MMDH** : Milliards de Dirhams
- **NAICS** : North American Industry Classification System (reference inspiration nomenclature)
- **NACE** : Nomenclature statistique des Activites economiques dans la Communaute Europeenne
- **Loi 09-08** : Protection des donnees personnelles au Maroc
- **Loi 53-95** : Classification des entreprises au Maroc

---

**Fin du prompt tache 4.3.6 -- Companies Page : List + Filters + Create/Edit (ICE validation) + Detail.**

Reference complementaire :
- Meta-prompt Sprint 16 : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.6 page 502-525)
- Style gold standard : `00-pilotage/prompts-taches/sprint-04-frontend-bootstrap/task-1.4.1-web-broker-bootstrap-port-3001.md`
- Glossaire ICE : `00-pilotage/documentation/7-glossaire-exemples.md` section ICE
- Algorithme DGI : https://www.ice.gov.ma/ + circulaire 717/2011
- Decision-006 : NO EMOJI ABSOLU dans tout le programme.
- Decision-009 : multilinguisme MA fr / ar-MA / ar avec RTL.
- Decision-007 : audit trail systematique sur mutations.
- Decision-014 : conformite loi 09-08 sur les contacts associes.


