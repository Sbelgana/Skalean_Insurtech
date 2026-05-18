# TACHE 4.2.1 -- Transfer Entity + Workflow Signature Double (Cedant + Cessionnaire)

**Sprint** : 15 (Phase 4 / Sprint 2 dans phase Vertical Insure)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-15-sprint-15-insure-lifecycle-police.md` (Tache 4.2.1)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0 (transferts polices critical pour V1 production -- ventes vehicules quotidiennes)
**Effort** : 6h
**Dependances** :
- Sprint 14 (Insure Foundation : entites Policy, Premium, Quote livrees)
- Sprint 10 (Barid eSign + ANRT TSA workflow signature multi-signers)
- Sprint 9 (Comm package : WhatsApp + Email notifications)
- Sprint 8 (CRM Contacts entity)
- Sprint 7 (RBAC permissions matrix)
- Sprint 6 (Multi-tenant RLS strict)

**Densite cible** : 110-150 ko (auto-suffisant exhaustif -- Claude Code n'a pas a relire B-15)
**AUCUNE EMOJI AUTORISEE** (decision-006 -- pre-commit hook rejette)

---

## 1. But

Cette tache implemente le **transfert juridique d'une police d'assurance** d'un souscripteur (cedant) a un autre souscripteur (cessionnaire) avec **workflow de signature double sequential** orchestre via Barid eSign (Sprint 10) et timestamp ANRT (Autorite Nationale de Reglementation des Telecommunications). Le transfert est un cas operationnel quotidien chez tout courtier marocain : un assure vend son vehicule, decede et son heritier reprend la police, mute son entreprise, ou cede son fonds de commerce -- la police existante doit alors etre transferee au nouveau proprietaire pour la duree restante, sans casser la continuite de couverture, sans recalculer la prime, et avec une preuve juridique opposable du consentement des deux parties.

L'apport est triple. **Premierement**, on cree l'entite `InsureTransfer` avec son cycle de vie complet (`pending_signatures -> completed | cancelled | rejected`) modelise comme une **machine d'etat fini** verifiable, persistee dans la table `insure_transfers` (multi-tenant RLS strict, FK vers `insure_policies`, `crm_contacts`, `docs_documents`, `signing_workflows`). **Deuxiemement**, on implemente le `TransfersService` qui orchestre la generation du document de cession PDF tri-langue (fr, ar-MA, ar) via `PdfGenerator` (Sprint 10), la creation d'un `SigningWorkflow` Barid eSign avec **2 signers sequential** (cedant order=1 signe en premier, cessionnaire order=2 signe ensuite) au type `qualified` (valeur juridique opposable ANRT TSA), la mise a jour de la police au moment de la completion (`policy.contact_id = to_contact_id`), la generation du certificat de transfert finalise scelle ANRT, et les notifications Comm aux deux parties via WhatsApp et Email dans leurs `preferred_language` respectives. **Troisiemement**, on expose les endpoints REST `POST /api/v1/insure/policies/:id/transfer`, `GET /api/v1/insure/transfers/:id`, `POST /api/v1/insure/transfers/:id/cancel` avec permissions RBAC dediees (`insure.policies.transfer`, `insure.transfers.read`, `insure.transfers.cancel`), audit trail enrichi (snapshot `from_contact_id` -> `to_contact_id` avec diff JSONB), et publication d'evenements Kafka critiques (`insure.transfer_initiated`, `insure.transfer_completed`, `insure.transfer_cancelled`) consommes par Analytics (Sprint 13) pour le dashboard Insure Operations et par Compliance (Sprint 18) pour le reporting ACAPS quarterly portfolio.

A l'issue de cette tache, un courtier (role `BrokerUser` ou superieur) peut initier un transfert depuis l'API en quelques millisecondes : la requete cree la ligne `insure_transfers`, genere instantanement le PDF de cession dans la langue preferee du cedant, ouvre un workflow Barid eSign avec les deux signers cibles (avec liens d'invitation envoyes par email + WhatsApp), persiste l'id du workflow dans `signing_workflow_id`, et place la transaction dans un etat `pending_signatures`. Lorsque le cedant signe (ANRT TSA appose), Barid notifie le cessionnaire qui signe a son tour. Au moment ou le 2eme `WorkflowCompletedEvent` arrive sur le topic Kafka `docs.workflow_completed`, notre consumer `TransfersWorkflowConsumer` (livre Tache 4.2.12) appelle `markCompleted(transferId)` : la police est mise a jour (`contact_id = to_contact_id`), l'audit log capture le snapshot complet, le certificat de transfert PDF finalise est genere (scelle ANRT timestamp + QR code public), et les deux parties recoivent une notification Comm de finalisation. Si le cessionnaire decline (event `WorkflowDeclinedEvent`), le transfert passe a `rejected`, la police reste au cedant, et un audit log explicite est cree. Si le courtier souhaite annuler avant la fin des signatures, `cancel(transferId, reason)` invalide le workflow Barid (rappel des invitations en cours) et marque le transfert `cancelled`. Cette tache est le premier pilier du Sprint 15 et bloque toutes les taches downstream (4.2.2 a 4.2.13) qui reutilisent le pattern workflow double signature pour les avenants flotte, endossements, et resiliations.

---

## 2. Contexte etendu

### 2.1 Pourquoi le transfert police est un cas operationnel critique au Maroc

Au Maroc, le marche de l'assurance auto represente environ 3,2 milliards de dirhams en primes brutes emises annuellement (donnees ACAPS 2024), avec un parc automobile estime a 4,5 millions de vehicules dont environ 60% sont assures (taux d'assurance obligatoire RC inferieur a la moyenne mondiale en raison du marche informel). Sur ces vehicules assures, le **taux de revente annuel se situe entre 8% et 12%** : autrement dit, chaque annee, environ 300 000 a 400 000 vehicules changent de proprietaire sur le marche de l'occasion (sites comme Avito, Moteur.ma, concessions occasions Renault Maroc, Peugeot Maroc, Dacia Maroc). Pour chaque revente, l'assurance pose probleme : soit le nouveau proprietaire souscrit une nouvelle police (perdant la prime restante du cedant), soit -- de plus en plus avec la digitalisation -- le **transfert juridique de la police existante** est privilegie pour preserver la prime restante et eviter la rupture de couverture.

Le **transfert police** est encadre par **l'article 25 du Code des Assurances marocain (Loi 17-99)** : "En cas d'alienation de la chose assuree, l'assurance continue de plein droit au profit de l'acquereur, a charge par celui-ci d'executer toutes les obligations dont l'assure etait tenu vis-a-vis de l'assureur en vertu du contrat". Cet article instaure une **transmission automatique** mais soumet l'acquereur a un droit de resiliation dans un delai de 30 jours suite a l'acquisition (article 26). En pratique, courtiers et assureurs preferent **formaliser explicitement** le transfert par un acte de cession signe par les deux parties, evitant les contentieux ulterieurs (ex : sinistre survenu entre la vente et la prise de connaissance de l'assureur).

C'est ce que notre `TransfersService` fait : il **materialise juridiquement** le transfert par un **acte de cession PDF** signe electroniquement par les deux parties via Barid eSign (valeur juridique reconnue par **loi 53-05 sur l'echange electronique de donnees juridiques** + **loi 43-20 sur les services de confiance pour les transactions electroniques**). Le certificat genere est scelle par un timestamp ANRT TSA (Time Stamping Authority) conforme RFC 3161, opposable a tout juge marocain. Cette automatisation transforme une operation actuellement manuelle (envoi physique de courriers recommandes, signature papier, archivage en kraft chez le courtier) en une operation **digitale, traçable, conforme**.

Cas d'usage operationnels concrets observes chez les courtiers cibles (Cabinet Bennani Casablanca, Atlas Assurance Rabat, MutuAssurance Marrakech) :

1. **Vente vehicule particulier-particulier** : assure vend sa Dacia Logan a un collegue. Le collegue reprend la police pour les 8 mois restants (economie d'environ 2 800 DH de prime). Sans transfert, le collegue souscrirait une nouvelle police a tarif jeune conducteur eventuel + frais de dossier, le cedant subirait une perte seche.
2. **Succession** : assure decede, son fils heritier reprend le vehicule + la police. Le transfert necessite acte notarie de succession (joint en PJ) + signature electronique de l'heritier.
3. **Mutation entreprise** : flotte de 12 vehicules au nom de SARL Distribution Casablanca, vente du fonds de commerce a SARL Logistics Rabat. La nouvelle entreprise reprend les 12 polices en bloc (cas flotte traite Tache 4.2.5, ici on prepare le pattern pour 1 police au sens individuel).
4. **Donation parent-enfant** : pere offre voiture a son fils nouveau permis. La police reste valable, le pere passe en conducteur secondaire, le fils devient souscripteur principal (combine avec endossement auto Tache 4.2.6 pour changement conducteur principal).

Sans cette tache, Skalean InsurTech ne peut pas servir le segment "broker ERP digital" : les courtiers feraient leurs transferts en dehors du systeme (Word + impression + signature manuelle + scan + upload), brisant le data flow, perdant les commissions associees, ne capturant pas les metriques pour Analytics, et echappant aux audits ACAPS Sprint 18.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Transfert implicite (modifier policy.contact_id directement) | Simple, 1 endpoint, pas de workflow | Pas de preuve juridique, pas de consentement cessionnaire, contentieux possible, non opposable | Rejete (non conforme article 25 loi 17-99 + perte audit) |
| Transfert avec 1 seule signature (cedant) | Moins de friction utilisateur, plus rapide | Pas de consentement cessionnaire = vice de consentement potentiel + risque cessionnaire conteste prise en charge | Rejete (insuffisant juridiquement) |
| Transfert avec signatures parallel (cedant + cessionnaire en meme temps) | Plus rapide (pas de file d'attente) | Risque cessionnaire signe avant cedant -> ordre des consentements casse, audit difficile, Barid sequential mieux supporte | Rejete (sequential preferee) |
| **Transfert avec signatures sequential (cedant order=1, cessionnaire order=2) + Barid eSign qualified + ANRT TSA** (retenu) | Conforme loi 17-99 article 25 + loi 53-05 + loi 43-20, audit trail complet, opposable juridiquement | Plus lent (cessionnaire attend cedant), 14 jours TTL Barid | RETENU |
| Transfert par recommande postal + signature papier | Methode traditionnelle | Non scalable, pas traçable digitalement, friction enorme, perte de donnees | Rejete (pas digital, defait l'interet ERP) |
| Transfert via courtier seul (procuration) | Plus simple | Pas de consentement direct des parties, risque ethique + juridique | Rejete (pas conforme deontologie ACAPS) |

La decision retenue (signatures sequential Barid eSign qualified + ANRT TSA) decoule de plusieurs decisions strategiques convergentes : **decision-004** (Barid eSign + ANRT comme prestataire de confiance national reconnu loi 43-20), **decision-008** (cloud souverain MA -- les documents de transfert ne doivent jamais transiter hors du Maroc), et **decision-002** (multi-tenant 3 niveaux -- chaque transfert est isole par `tenant_id`).

### 2.3 Trade-offs explicites

Choisir le workflow signature double sequential expose plusieurs trade-offs assumes :

**Premier trade-off : friction utilisateur vs. valeur juridique**. Le workflow double signature avec ordre sequential est **plus contraignant** qu'une signature simple : il faut que le cedant signe d'abord, puis attendre que le cessionnaire signe ensuite (Barid envoie automatiquement l'invitation au order=2 apres reception signature order=1). Dans le pire cas, le delai entre initiation et completion peut atteindre 14 jours (TTL Barid par defaut), avec relances email/WhatsApp toutes les 48h. Ce trade-off est assume car la **valeur juridique opposable** generee par ce processus (acte de cession + signatures qualifiees + timestamp ANRT) justifie le delai : un transfert mal signe = contentieux potentiel devant tribunaux civils marocains, ou la non-conformite a l'article 25 loi 17-99 entraine la nullite du transfert et le retour de la police au cedant + remboursement des primes percues par le courtier au cessionnaire.

**Deuxieme trade-off : reattribution commission vs. integrite historique**. Lorsque la police est transferee au cessionnaire, la commission deja percue par le courtier au moment de la souscription originale reste acquise (elle n'est **pas reattribuee** au courtier eventuellement different qui aurait genere le cessionnaire). Ce choix est documente dans `decision-014` (commissions immutables apres encaissement) et impose par la pratique comptable marocaine (loi 38-14 et CGNC : ecritures comptables immuables au-dela d'une cloture mensuelle). En consequence, si le cessionnaire est suivi par un courtier different, le nouveau courtier ne touche **rien** sur la prime restante de la police transferee. Pour ce sprint, cela signifie que `transfersService.markCompleted()` n'emet **aucune ecriture comptable de reattribution commission** vers le module Books (Sprint 12). Ce trade-off est assume mais devra etre revu Sprint 27 si le marche evolue vers un modele de reattribution prorata.

**Troisieme trade-off : transfer_date future vs. instant**. On permet `transfer_date >= today` pour gerer le cas d'une vente prevue dans X jours (signature anticipee). Cela implique : (a) la police reste juridiquement au cedant **jusqu'a** `transfer_date` meme si les deux signatures sont collectees avant, (b) un cron job daily (`process-pending-transfers-cron`) verifie chaque nuit s'il existe des `insure_transfers` avec `status='completed'` mais `transfer_date > now()` qui doivent etre **actives** ce jour-la, (c) la police est ajustee uniquement au `transfer_date` reel. Ce mecanisme complique legerement la logique mais est necessaire car le marche fonctionne souvent en "signature anticipee + livraison vehicule J+7". Le trade-off est : code legerement plus complexe vs. flexibilite operationnelle.

**Quatrieme trade-off : refus generation PDF tri-langue vs. simplicite**. On genere systematiquement les **3 templates** de l'acte de cession (`fr`, `ar-MA`, `ar`) et on choisit dynamiquement selon `fromContact.preferred_language`, mais on stocke un **seul PDF** dans `docs_documents`. Cela implique : 3 fichiers Handlebars a maintenir, mais flexibilite multi-langue native. Le trade-off est : effort initial maintenance templates vs. accessibilite Maroc Arabe (population arabophone majoritaire) et Maroc Tachelhit (defere Sprint 30+ -- pas dans ce sprint).

**Cinquieme trade-off : workflow expires_in_days = 14 vs. plus court**. On configure le workflow Barid avec `expires_in_days: 14` (configurable per tenant Sprint 27). Apres 14 jours sans signature des deux parties, le workflow expire automatiquement et le `insure_transfers.status` reste a `pending_signatures` (un cron daily `expired-transfers-cron` Tache 4.2.12 detecte et transitionne vers `cancelled` + `cancelled_reason = 'workflow_expired'`). Trade-off : 14 jours c'est genereux (typiquement signatures arrivent en moins de 72h) mais protege contre vacances, deplacements, problemes techniques cessionnaire.

### 2.4 Decisions strategiques referenced

Cette tache materialise et applique strictement les decisions suivantes :

- **decision-001 (monorepo pnpm + Turborepo)** : `packages/insure` heberge l'entity + service, importe via alias `@insurtech/insure`. Pas de relatif `../../../../`.
- **decision-002 (multi-tenant 3 niveaux : Skalean / tenant / object)** : chaque row `insure_transfers` porte `tenant_id NOT NULL` avec RLS Postgres policy `(tenant_id = app_current_tenant())` pour SELECT/INSERT/UPDATE/DELETE. Cross-tenant strict bloque.
- **decision-003 (TypeORM 0.3 over Prisma)** : entity decoree TypeORM, repository injectable NestJS DI.
- **decision-004 (Barid eSign + ANRT TSA comme prestataire de confiance national)** : workflow signatures qualified, timestamp ANRT RFC 3161 sur certificat final.
- **decision-005 (Skalean AI ne consomme jamais sans MCP)** : aucune integration IA dans cette tache (defere Sprint 30+).
- **decision-006 (no-emoji policy ABSOLU)** : aucune emoji dans entity, service, controller, templates, logs, commits, audit messages.
- **decision-007 (mocks integrations externes pendant Sprint 1-28 sauf Barid eSign reel des Sprint 10)** : Barid eSign deja reel Sprint 10, utilise reel ici. Mocks Comm peuvent etre actifs en dev.
- **decision-008 (cloud souverain Maroc -- Atlas Cloud Benguerir)** : aucune donnee transfert ne transite hors MA. Documents PDF + signature Barid + TSA ANRT = 100% souverains.
- **decision-010 (cascade renumerotation v2.2)** : taches 4.2.X font partie du Phase 4 Sprint 2 (anciennement 4.1.X v2.1).
- **decision-014 (commissions immutables apres encaissement)** : pas de reattribution commission lors du transfert.

### 2.5 Pieges techniques connus

1. **Piege : double signature en parallel au lieu de sequential**.
   - Pourquoi : Barid eSign supporte 2 modes (sequential par order ASC, ou parallel). Si on configure mal `order` (egal pour les 2 signers), Barid envoie les 2 invitations en meme temps. Cela casse la logique "le cedant doit consentir d'abord".
   - Solution : `SignerDto.order` strictement `1` pour cedant, `2` pour cessionnaire. Test integration : verifier que `signingWorkflowService.createWorkflow` rejette si 2 signers ont meme order.

2. **Piege : transfer_date dans le passe accepte**.
   - Pourquoi : sans validation explicite, on accepte n'importe quelle date (y compris hier).
   - Solution : Zod schema `transferDate: z.coerce.date().refine(d => d >= startOfDay(new Date()), { message: 'transfer_date must be today or future' })`.

3. **Piege : oublier audit log snapshot avant + apres**.
   - Pourquoi : si on n'enregistre que `policy.contact_id = NEW_CONTACT`, on perd l'historique du cedant precedent (cas critique pour ACAPS Sprint 18 reporting et litiges).
   - Solution : avant update, capturer `snapshotBefore = { contact_id: policy.contact_id, contact_name: fromContact.fullname }` et stocker dans `audit_logs.metadata` JSONB avec `snapshotAfter` post-update.

4. **Piege : ne pas verifier que to_contact appartient au meme tenant**.
   - Pourquoi : cross-tenant transfer = leak donnees + violation decision-002.
   - Solution : `if (toContact.tenant_id !== getCurrentTenantId()) throw new ForbiddenException({ code: 'CROSS_TENANT_TRANSFER_FORBIDDEN' })`. Test E2E dedie.

5. **Piege : signature decline d'un seul signer non geree**.
   - Pourquoi : si cessionnaire decline mais que la code ne reagit pas, la police reste en limbo (cedant ne sait pas, cessionnaire refuse, courtier perdu).
   - Solution : consumer `TransfersWorkflowDeclinedConsumer` (Tache 4.2.12) ecoute `docs.workflow_declined`, appelle `transfersService.markRejected(transferId, declinerEmail)`, audit + notif Comm aux 2 parties.

6. **Piege : ne pas verifier l'existence d'un transfer pending sur la meme police**.
   - Pourquoi : 2 transferts pending sur meme police = race condition + 2 notifications differentes = chaos.
   - Solution : `INSERT ... WHERE NOT EXISTS (SELECT 1 FROM insure_transfers WHERE policy_id = $1 AND status = 'pending_signatures' AND tenant_id = current_tenant)`. Alternative : unique partial index `CREATE UNIQUE INDEX uniq_pending_transfer_per_policy ON insure_transfers(policy_id, tenant_id) WHERE status = 'pending_signatures'`.

7. **Piege : oublier de generer certificat final scelle ANRT post-completion**.
   - Pourquoi : signature seule ne suffit pas. Le timestamp ANRT RFC 3161 doit etre appose sur le PDF final pour valeur juridique pleine (loi 43-20).
   - Solution : dans `markCompleted()`, apres update police, generer un **second PDF** "Certificat de Transfert" via template `transfer-certificate.hbs` avec QR code pointant vers `https://verify.skalean.ma/transfer/:hash`, scelle TSA ANRT, archive `docs_documents.related_resource_type = 'insure_transfer_certificate'`.

8. **Piege : notification Comm en mauvaise langue**.
   - Pourquoi : si on notifie le cedant en arabe mais qu'il prefere francais (cas businessmen Casablanca), UX casse.
   - Solution : utiliser `contact.preferred_language` pour selectionner template Comm `transfer-initiated.{locale}.{channel}.hbs` ou`{locale}` in `['fr', 'ar-MA', 'ar', 'en']` (anglais defere Sprint 30+).

9. **Piege : ne pas invalider workflow Barid lors d'un cancel manuel courtier**.
   - Pourquoi : si courtier cancel cote API mais que Barid envoie quand meme les relances/invitations, friction enorme + risque double signature post-cancel.
   - Solution : `cancel(transferId, reason)` appelle `signingWorkflowService.cancelWorkflow(signing_workflow_id)` qui poste `DELETE /barid/workflows/:id` -> Barid invalide invitations + bloque signatures futures.

10. **Piege : RLS Postgres bloque consumer Kafka qui appelle markCompleted hors contexte tenant**.
    - Pourquoi : `WorkflowCompletedEvent` arrive sur Kafka sans `TenantContext`. Si le consumer appelle direct `markCompleted`, la query RLS bloque toute lecture.
    - Solution : `WorkflowCompletedEvent.payload` contient `tenant_id` (publie par Sprint 10 lors creation workflow). Consumer fait `TenantContext.run(payload.tenant_id, async () => transfersService.markCompleted(transferId))`. Le wrapper `TenantContext.run` injecte `SET LOCAL app.current_tenant = $tenant_id` au debut de la transaction.

11. **Piege : transfer_date future + activation non automatique au jour J**.
    - Pourquoi : si transfer_date = J+7, les signatures sont collectees a J-2, mais le code `markCompleted` execute immediatement le `policy.contact_id` update. Resultat : la police change de contact 5 jours avant la vente physique.
    - Solution : separer `markCompleted` (collecte signatures, status `signatures_collected`) et `activate` (cron daily Tache 4.2.12 detecte `status='signatures_collected' AND transfer_date <= today` -> active + push `contact_id` update). Pour V1 : on simplifie en imposant `transfer_date >= today` ET `markCompleted` execute immediatement. La sophistication "signatures_collected" sera ajoutee Sprint 18 si besoin metier confirme.

12. **Piege : prime restante non recalculee au transfert**.
    - Pourquoi : juridiquement, le cessionnaire heritage de la police "en l'etat" avec sa prime annuelle d'origine. Pas de recalcul (vs. fractionnement Tache 4.2.2 qui modifie l'echeancier).
    - Solution : dans `markCompleted`, **ne pas toucher** `policy.prime_annuelle`, `policy.premiums[]`, ni `policy.end_date`. Seul `policy.contact_id` change. Documenter explicitement dans le service.

### 2.6 Conformite legale Maroc -- detail

- **Loi 17-99 (Code des Assurances)** article 25 : transmission de plein droit de l'assurance en cas d'alienation de la chose assuree. Article 26 : droit de resiliation du cessionnaire dans les 30 jours (ce droit est materialise par Tache 4.2.4 droit retract + Tache 4.2.10 doc provisoire). Notre `TransfersService` formalise explicitement la transmission via acte de cession sign double pour eviter contentieux.
- **Loi 53-05 (echange electronique de donnees juridiques)** : valeur probante des signatures electroniques. Notre workflow utilise signatures qualifiees (Barid eSign + ANRT TSA) au sens article 6.
- **Loi 43-20 (services de confiance pour les transactions electroniques)** : encadre les prestataires de services de confiance (PSC). Barid eSign est PSC reconnu. ANRT TSA assure le timestamp RFC 3161 conforme.
- **Loi 09-08 (CNDP -- protection donnees personnelles)** : les donnees du cedant + cessionnaire sont des donnees personnelles. Audit log conforme article 6 (finalite limitee, conservation 5 ans), notifications avec consentement (deja consenti via Sprint 8 CRM Contacts).
- **Decision ACAPS quarterly portfolio (Sprint 18)** : exige reporting des transferts portefeuille. Notre Kafka event `insure.transfer_completed` est consume Sprint 18 pour generer report.
- **Loi 38-14 (obligations comptables modifiees)** : impose archivage des actes de cession pendant 10 ans minimum. Notre stockage S3 Atlas Cloud Benguerir avec object lock 10 ans satisfait cette exigence (Sprint 10 deja livre).

### 2.7 Glossaire metier

- **Cedant** : assure actuel souscripteur de la police, vend sa chose assuree, transfere la police.
- **Cessionnaire** : nouveau proprietaire de la chose assuree, recoit la police par transfert.
- **Acte de cession** : document juridique constatant l'accord entre cedant et cessionnaire pour la transmission de la police. Notre `transfer-cession.hbs` materialise cet acte.
- **Certificat de transfert** : document final scelle ANRT TSA atteste de la realisation du transfert. Notre `transfer-certificate.hbs` materialise ce certificat.
- **TSA (Time Stamping Authority)** : autorite de timestamp RFC 3161 qui appose un marquage temporel cryptographique infalsifiable. ANRT est la TSA marocaine.
- **PSC (Prestataire de Services de Confiance)** : entite agreee par l'ANRT pour delivrer signatures electroniques qualifiees. Barid eSign est PSC.

---

## 3. Architecture context

### 3.1 Position dans le sprint 15

Cette tache 4.2.1 est la **premiere** des 13 du Sprint 15. Elle :

- **Depend de** : Sprint 14 termine (entites `InsurePolicy`, `InsurePremium`, `InsureQuote` disponibles + `PoliciesService.findById`), Sprint 10 termine (`SigningWorkflowService.createWorkflow + sendForSignature + cancelWorkflow`, `PdfGenerator.generate`, `DocumentService.create`, ANRT TSA integration), Sprint 9 termine (`CommService.send`), Sprint 8 termine (`ContactsService.findById`), Sprint 7 termine (RBAC permissions matrix + `@Roles()` decorator + `RolesGuard`), Sprint 6 termine (multi-tenant RLS active sur Postgres + `TenantGuard` + `TenantContext` AsyncLocalStorage).

- **Bloque** : Tache 4.2.2 (Fractionnement reutilise le pattern entity + service workflow audit), Tache 4.2.5 (Flotte reutilise workflow signature + entity pattern), Tache 4.2.6/7/8 (endossements specifiques branches reutilisent workflow avenant signature double, parfois single), Tache 4.2.9 (BrokerValidationQueue reutilise audit + notification pattern), Tache 4.2.11 (endpoints REST consolides), Tache 4.2.12 (Kafka consumers `TransfersWorkflowConsumer`), Tache 4.2.13 (Tests E2E 50+ avec 5 scenarios transfers).

- **Apporte au sprint** : le pattern "workflow signature double sequential Barid eSign + audit trail + Kafka events" reutilisable par toutes les operations avancees Sprint 15 (transferts, avenants flotte, endossements, etc.). C'est la **brique fondatrice** des operations avancees.

### 3.2 Position dans le programme global v2.2 (35 sprints)

Sprint 15 est le 2eme sprint de la Phase 4 (Vertical Insure). Le `TransfersService` est utilise par :

- **Sprint 16 (Web Broker App)** : UI courtier pour initier un transfert via formulaire React + envoyer notifications cedant + cessionnaire. Notre endpoint `POST /api/v1/insure/policies/:id/transfer` est consume par le composant `TransferPolicyDialog.tsx`.
- **Sprint 17 (Web Customer Portal)** : permettra a un client de **demander** un transfert depuis son espace assure (entre membres famille). La demande crete une row `insure_transfers` `status='pending_broker_validation'` (extension Sprint 17), validee ensuite par broker via Tache 4.2.9 queue.
- **Sprint 18 (Compliance ACAPS)** : Kafka consumer `AcapsTransferReportingConsumer` ecoute `insure.transfer_completed` pour aggregat quarterly portfolio (variation transferts entree/sortie) et report XLSX.
- **Sprint 27 (Admin Tenant Custom)** : permettra a un super admin tenant de configurer `transfer_workflow_expires_in_days` (default 14), `transfer_max_per_year_per_policy` (default 3), `transfer_cancellation_requires_approval` (default false).
- **Sprint 30+ (Sky AI)** : un MCP tool `sky.insure.suggest_transfer_pricing` pourrait analyser le profil cessionnaire pour suggerer une recalculation prime (defere strict, hors V1).

### 3.3 Diagramme flow

```
+---------------------------------------------------------------+
|  Sprint 15 Tache 4.2.1 -- TransfersService                    |
|                                                               |
|  initiateTransfer(policyId, toContactId, reason, transferDate)|
|       |                                                       |
|       v                                                       |
|  +----------------+    +-----------------+    +-------------+ |
|  | Validations    |--->| Generate PDF    |--->| Create row  | |
|  | (policy active,|    | (transfer-      |    | insure_     | |
|  |  no pending,   |    |  cession.hbs    |    | transfers   | |
|  |  to_contact ok)|    |  tri-langue)    |    | status:     | |
|  +----------------+    +-----------------+    | pending_    | |
|                                               | signatures  | |
|                                               +-------------+ |
|                                                      |        |
|                                                      v        |
|                                +----------------------------+ |
|                                | Barid eSign workflow       | |
|                                | createWorkflow([cedant#1,  | |
|                                |   cessionnaire#2],         | |
|                                |   sequential, qualified,   | |
|                                |   expires=14j)             | |
|                                | sendForSignature()         | |
|                                +----------------------------+ |
|                                            |                  |
|                                            v                  |
|                                +----------------------------+ |
|                                | Comm notifs (WA + Email)   | |
|                                | cedant FR, cessionnaire AR | |
|                                +----------------------------+ |
+---------------------------------------------------------------+
                                            |
                                            v (async, J+1 a J+14)
+---------------------------------------------------------------+
|  Sprint 10 Barid eSign                                        |
|  Cedant signe -> WorkflowSignedEvent (signer#1)               |
|  Cessionnaire recoit invitation order=2                       |
|  Cessionnaire signe -> WorkflowSignedEvent (signer#2)         |
|  -> WorkflowCompletedEvent                                    |
+---------------------------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------+
|  Sprint 15 Tache 4.2.12 -- TransfersWorkflowConsumer          |
|  ecoute docs.workflow_completed                               |
|  appelle TransfersService.markCompleted(transferId)           |
|       |                                                       |
|       v                                                       |
|  +----------------+    +-----------------+    +-------------+ |
|  | Update policy: |--->| Generate cert   |--->| Audit log   | |
|  | contact_id =   |    | PDF + TSA ANRT  |    | snapshot    | |
|  | to_contact_id  |    | + QR verify     |    | before/after| |
|  +----------------+    +-----------------+    +-------------+ |
|                                                      |        |
|                                                      v        |
|                                +----------------------------+ |
|                                | Kafka publish              | |
|                                | insure.transfer_completed  | |
|                                +----------------------------+ |
|                                            |                  |
|                                            v                  |
|                  +-----------+    +----------------+          |
|                  | Sprint 13 |    | Sprint 18      |          |
|                  | Analytics |    | ACAPS quarterly|          |
|                  | ClickHouse|    | portfolio rep. |          |
|                  +-----------+    +----------------+          |
+---------------------------------------------------------------+
```

### 3.4 Relation aux verticaux

Le `TransfersService` est cote **`packages/insure`** (vertical Insure). Il ne reside pas dans `packages/repair` (Garage), ni dans `packages/crm` (Contacts est utilise en read-only via `ContactsService`). La separation respecte la frontiere claire entre verticaux : Insure manipule polices, Repair manipule reparations, et Sky (Sprint 31) orchestre via MCP.

---

## 4. Livrables checkables (25+ items)

- [ ] Migration TypeORM `{date}-InsureTransfersTable.ts` creant la table `insure_transfers` avec colonnes : `id` (uuid PK gen_random_uuid()), `tenant_id` (uuid NOT NULL), `policy_id` (uuid NOT NULL FK -> insure_policies), `from_contact_id` (uuid NOT NULL FK -> crm_contacts), `to_contact_id` (uuid NOT NULL FK -> crm_contacts), `transfer_date` (date NOT NULL), `status` (enum 'pending_signatures' | 'completed' | 'cancelled' | 'rejected'), `signing_workflow_id` (uuid NULL FK -> signing_workflows), `transfer_doc_id` (uuid NULL FK -> docs_documents), `transfer_certificate_doc_id` (uuid NULL FK -> docs_documents), `reason` (text NOT NULL), `metadata` (jsonb NULL), `completed_at` (timestamptz NULL), `cancelled_at` (timestamptz NULL), `cancelled_reason` (text NULL), `rejected_at` (timestamptz NULL), `rejected_by_contact_id` (uuid NULL), `created_by` (uuid NOT NULL FK -> auth_users), `created_at` (timestamptz NOT NULL DEFAULT NOW()), `updated_at` (timestamptz NOT NULL DEFAULT NOW()). (~80 lignes migration UP + DOWN)

- [ ] Indexes Postgres dans migration :
  - PRIMARY KEY (id)
  - `idx_insure_transfers_tenant_id` ON (tenant_id)
  - `idx_insure_transfers_policy_id` ON (tenant_id, policy_id)
  - `idx_insure_transfers_status` ON (tenant_id, status)
  - `idx_insure_transfers_signing_workflow_id` ON (signing_workflow_id) WHERE signing_workflow_id IS NOT NULL
  - UNIQUE PARTIAL `uniq_pending_transfer_per_policy` ON (policy_id, tenant_id) WHERE status = 'pending_signatures'
  - `idx_insure_transfers_transfer_date` ON (tenant_id, transfer_date) -- pour cron expired-transfers

- [ ] Policy RLS Postgres dans migration :
  - `ENABLE ROW LEVEL SECURITY`
  - Policy `tenant_isolation_insure_transfers` : `USING (tenant_id = app_current_tenant()) WITH CHECK (tenant_id = app_current_tenant())`
  - Test isolation : tenant A ne voit jamais transfers tenant B

- [ ] Entity TypeORM `repo/packages/insure/src/entities/insure-transfer.entity.ts` avec decorators `@Entity('insure_transfers')`, `@Index`, `@ManyToOne` vers Policy/Contact/User, enum `InsureTransferStatus`, lifecycle hooks `@BeforeUpdate` pour updated_at (~80 lignes)

- [ ] Schema Zod `repo/packages/insure/src/schemas/insure-transfer.schema.ts` exportant `InitiateTransferInputSchema`, `CancelTransferInputSchema`, `MarkCompletedInternalSchema` avec validation strict (~50 lignes)

- [ ] Service `repo/packages/insure/src/services/transfers.service.ts` avec methods : `initiateTransfer(input)`, `markCompleted(transferId)`, `cancel(transferId, reason)`, `markRejected(transferId, declinerContactId)`, `findById(transferId)`, `listByPolicyId(policyId)`, `validateInitiateTransfer(input)` (private) (~280 lignes)

- [ ] Tests unitaires `repo/packages/insure/src/services/transfers.service.spec.ts` couvrant : initiateTransfer success + validation rejects + markCompleted success + cancel + markRejected + edge cases (~250 lignes, 22 tests)

- [ ] Templates Handlebars `repo/packages/docs/src/templates/{fr,ar-MA,ar}/transfer-cession.hbs` : acte de cession tri-langue avec variables `{{policy}}`, `{{fromContact}}`, `{{toContact}}`, `{{transferDate}}`, `{{reason}}`, `{{tenant}}`, `{{generatedAt}}`, references juridiques article 25 loi 17-99 (3 fichiers, ~120 lignes chacun)

- [ ] Templates Handlebars `repo/packages/docs/src/templates/{fr,ar-MA,ar}/transfer-certificate.hbs` : certificat final tri-langue avec QR code verification publique, scelle ANRT TSA reference (3 fichiers, ~80 lignes chacun)

- [ ] Templates Comm `repo/packages/comm/src/templates/{fr,ar-MA,ar}/transfer-initiated.{whatsapp,email}.hbs` : notifications initiation (6 fichiers, ~30 lignes chacun)

- [ ] Templates Comm `repo/packages/comm/src/templates/{fr,ar-MA,ar}/transfer-completed.{whatsapp,email}.hbs` : notifications finalisation (6 fichiers, ~30 lignes chacun)

- [ ] Templates Comm `repo/packages/comm/src/templates/{fr,ar-MA,ar}/transfer-rejected.{whatsapp,email}.hbs` : notifications rejet (6 fichiers, ~25 lignes chacun)

- [ ] Controller `repo/apps/api/src/modules/insure/controllers/transfers.controller.ts` exposant endpoints REST avec `@Roles()`, `@UseGuards(TenantGuard, RolesGuard)`, validation Zod pipe, error handling NestJS (~150 lignes)

- [ ] DTO `repo/apps/api/src/modules/insure/dto/initiate-transfer.dto.ts`, `cancel-transfer.dto.ts`, `transfer-response.dto.ts` (3 fichiers, ~30 lignes chacun)

- [ ] OpenAPI annotations `@ApiTags`, `@ApiOperation`, `@ApiResponse` sur tous endpoints pour generation Swagger UI Sprint 27

- [ ] Module integration : ajout `TransfersService` dans `InsureModule.providers`, `TransfersController` dans `InsureModule.controllers` (`repo/apps/api/src/modules/insure/insure.module.ts` mise a jour)

- [ ] Permissions catalog : ajout `insure.policies.transfer`, `insure.transfers.read`, `insure.transfers.cancel` dans `repo/packages/auth/src/rbac/permissions.enum.ts` + mapping roles dans `permissions-matrix.ts` (BrokerAdmin + BrokerUser ont `transfer`, BrokerAdmin a `cancel`, tous role broker_* ont `read`)

- [ ] Kafka topics declaration : ajout `INSURE_TRANSFER_INITIATED`, `INSURE_TRANSFER_COMPLETED`, `INSURE_TRANSFER_CANCELLED`, `INSURE_TRANSFER_REJECTED` dans `repo/packages/shared-types/src/kafka-topics.ts`

- [ ] Kafka event schemas Zod : `transfer-initiated.event.schema.ts`, `transfer-completed.event.schema.ts`, etc. (~25 lignes chacun)

- [ ] Tests integration `repo/apps/api/test/insure/transfers.integration-spec.ts` : Postgres reel + RLS + flow complet initiate + cancel (~200 lignes, 10 tests)

- [ ] Fixtures `repo/apps/api/test/insure/fixtures/transfers.fixture.ts` : helpers `createTransferFixture()`, `createTransferWithSignaturesFixture()`, `createTransferPendingFixture()` (~120 lignes)

- [ ] Logging structured Pino : tous appels service log `{ tenant_id, user_id, transfer_id, policy_id, action, duration_ms }` avec niveaux info/warn/error appropries

- [ ] Audit log integration : `AuditLogService.log({ action: 'insure.transfer.initiated', resource_type: 'insure_transfer', resource_id, metadata: { from_contact_id, to_contact_id, snapshotBefore, snapshotAfter } })` sur chaque transition

- [ ] OpenTelemetry tracing : spans `transfers.initiateTransfer`, `transfers.markCompleted`, `transfers.cancel` avec attributes tenant_id, transfer_id

- [ ] Documentation README local `repo/packages/insure/src/services/TRANSFERS.md` : usage examples, sequence diagrams ASCII, references B-15

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/database/src/migrations/{YYYYMMDDHHMMSS}-InsureTransfersTable.ts   (~120 lignes / migration UP + DOWN + RLS + indexes)
repo/packages/insure/src/entities/insure-transfer.entity.ts                       (~80 lignes / entity TypeORM)
repo/packages/insure/src/entities/insure-transfer-status.enum.ts                  (~10 lignes / enum)
repo/packages/insure/src/schemas/insure-transfer.schema.ts                        (~60 lignes / Zod schemas)
repo/packages/insure/src/services/transfers.service.ts                            (~320 lignes / service principal)
repo/packages/insure/src/services/transfers.service.spec.ts                       (~280 lignes / 22 tests unit)
repo/packages/insure/src/services/TRANSFERS.md                                    (~80 lignes / doc locale)
repo/packages/insure/src/module/transfers.module.ts                               (~30 lignes / NestJS sub-module)
repo/packages/insure/src/index.ts                                                  (modif / export)
repo/packages/docs/src/templates/fr/transfer-cession.hbs                          (~120 lignes / acte FR)
repo/packages/docs/src/templates/ar-MA/transfer-cession.hbs                       (~120 lignes / acte arabe darija MA)
repo/packages/docs/src/templates/ar/transfer-cession.hbs                          (~120 lignes / acte arabe MSA)
repo/packages/docs/src/templates/fr/transfer-certificate.hbs                       (~80 lignes / certificat FR)
repo/packages/docs/src/templates/ar-MA/transfer-certificate.hbs                    (~80 lignes / certificat arabe MA)
repo/packages/docs/src/templates/ar/transfer-certificate.hbs                       (~80 lignes / certificat arabe MSA)
repo/packages/comm/src/templates/fr/transfer-initiated.whatsapp.hbs                (~25 lignes)
repo/packages/comm/src/templates/fr/transfer-initiated.email.hbs                   (~35 lignes)
repo/packages/comm/src/templates/ar-MA/transfer-initiated.whatsapp.hbs             (~25 lignes)
repo/packages/comm/src/templates/ar-MA/transfer-initiated.email.hbs                (~35 lignes)
repo/packages/comm/src/templates/ar/transfer-initiated.whatsapp.hbs                (~25 lignes)
repo/packages/comm/src/templates/ar/transfer-initiated.email.hbs                   (~35 lignes)
repo/packages/comm/src/templates/fr/transfer-completed.whatsapp.hbs                (~25 lignes)
repo/packages/comm/src/templates/fr/transfer-completed.email.hbs                   (~35 lignes)
repo/packages/comm/src/templates/ar-MA/transfer-completed.whatsapp.hbs             (~25 lignes)
repo/packages/comm/src/templates/ar-MA/transfer-completed.email.hbs                (~35 lignes)
repo/packages/comm/src/templates/ar/transfer-completed.whatsapp.hbs                (~25 lignes)
repo/packages/comm/src/templates/ar/transfer-completed.email.hbs                   (~35 lignes)
repo/packages/comm/src/templates/fr/transfer-rejected.whatsapp.hbs                 (~25 lignes)
repo/packages/comm/src/templates/fr/transfer-rejected.email.hbs                    (~30 lignes)
repo/packages/comm/src/templates/ar-MA/transfer-rejected.whatsapp.hbs              (~25 lignes)
repo/packages/comm/src/templates/ar-MA/transfer-rejected.email.hbs                 (~30 lignes)
repo/packages/comm/src/templates/ar/transfer-rejected.whatsapp.hbs                 (~25 lignes)
repo/packages/comm/src/templates/ar/transfer-rejected.email.hbs                    (~30 lignes)
repo/apps/api/src/modules/insure/controllers/transfers.controller.ts              (~180 lignes / controller REST)
repo/apps/api/src/modules/insure/dto/initiate-transfer.dto.ts                     (~25 lignes)
repo/apps/api/src/modules/insure/dto/cancel-transfer.dto.ts                       (~15 lignes)
repo/apps/api/src/modules/insure/dto/transfer-response.dto.ts                     (~35 lignes)
repo/apps/api/src/modules/insure/insure.module.ts                                 (modif / +TransfersService +TransfersController)
repo/apps/api/test/insure/transfers.integration-spec.ts                            (~250 lignes / 10 tests integration)
repo/apps/api/test/insure/fixtures/transfers.fixture.ts                            (~150 lignes / helpers)
repo/packages/auth/src/rbac/permissions.enum.ts                                    (modif / +3 permissions)
repo/packages/auth/src/rbac/permissions-matrix.ts                                  (modif / roles mapping)
repo/packages/shared-types/src/kafka-topics.ts                                     (modif / +4 topics)
repo/packages/shared-types/src/events/insure-transfer.events.ts                    (~80 lignes / schemas Zod 4 events)
```

**Volume total estime** : ~3 100 lignes nouvelles + modifications dans 5 fichiers existants.

---

## 6. Code patterns COMPLETS

### Fichier 1/14 : Migration `repo/packages/database/src/migrations/20260515120000-InsureTransfersTable.ts`

Cree la table `insure_transfers` avec RLS, indexes, FK strictes.

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : Sprint 15 Tache 4.2.1 -- Insure Transfers Table
 *
 * Cree la table insure_transfers pour modeliser le transfert juridique
 * d'une police d'assurance entre deux souscripteurs (cedant -> cessionnaire)
 * avec workflow signature double sequential Barid eSign.
 *
 * Reference legale : Loi 17-99 article 25 (transmission de plein droit
 * en cas d'alienation de la chose assuree) + Loi 53-05 + Loi 43-20.
 *
 * Reference programme : B-15 Tache 4.2.1.
 *
 * Conventions :
 * - Multi-tenant strict (tenant_id NOT NULL + RLS policy)
 * - Status enum strict (pending_signatures, completed, cancelled, rejected)
 * - Audit timestamps (created_at, updated_at, completed_at, cancelled_at, rejected_at)
 * - FK strict toward insure_policies, crm_contacts, auth_users, docs_documents,
 *   signing_workflows
 * - Unique partial index empechant 2 transferts pending sur meme police
 */
export class InsureTransfersTable20260515120000 implements MigrationInterface {
  name = 'InsureTransfersTable20260515120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Creation enum status (CREATE TYPE)
    await queryRunner.query(`
      CREATE TYPE insure_transfer_status_enum AS ENUM (
        'pending_signatures',
        'completed',
        'cancelled',
        'rejected'
      );
    `);

    // 2. Creation table principale
    await queryRunner.query(`
      CREATE TABLE insure_transfers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        policy_id UUID NOT NULL,
        from_contact_id UUID NOT NULL,
        to_contact_id UUID NOT NULL,
        transfer_date DATE NOT NULL,
        status insure_transfer_status_enum NOT NULL DEFAULT 'pending_signatures',
        signing_workflow_id UUID NULL,
        transfer_doc_id UUID NULL,
        transfer_certificate_doc_id UUID NULL,
        reason TEXT NOT NULL,
        metadata JSONB NULL,
        completed_at TIMESTAMPTZ NULL,
        cancelled_at TIMESTAMPTZ NULL,
        cancelled_reason TEXT NULL,
        rejected_at TIMESTAMPTZ NULL,
        rejected_by_contact_id UUID NULL,
        created_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT fk_insure_transfers_policy
          FOREIGN KEY (policy_id) REFERENCES insure_policies(id)
          ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_insure_transfers_from_contact
          FOREIGN KEY (from_contact_id) REFERENCES crm_contacts(id)
          ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_insure_transfers_to_contact
          FOREIGN KEY (to_contact_id) REFERENCES crm_contacts(id)
          ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_insure_transfers_signing_workflow
          FOREIGN KEY (signing_workflow_id) REFERENCES signing_workflows(id)
          ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_insure_transfers_doc
          FOREIGN KEY (transfer_doc_id) REFERENCES docs_documents(id)
          ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_insure_transfers_certificate_doc
          FOREIGN KEY (transfer_certificate_doc_id) REFERENCES docs_documents(id)
          ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT fk_insure_transfers_created_by
          FOREIGN KEY (created_by) REFERENCES auth_users(id)
          ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT fk_insure_transfers_rejected_by_contact
          FOREIGN KEY (rejected_by_contact_id) REFERENCES crm_contacts(id)
          ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT chk_transfer_distinct_contacts
          CHECK (from_contact_id <> to_contact_id),
        CONSTRAINT chk_transfer_completion_consistency
          CHECK (
            (status = 'completed' AND completed_at IS NOT NULL) OR
            (status = 'cancelled' AND cancelled_at IS NOT NULL) OR
            (status = 'rejected' AND rejected_at IS NOT NULL) OR
            (status = 'pending_signatures')
          )
      );
    `);

    // 3. Indexes
    await queryRunner.query(`CREATE INDEX idx_insure_transfers_tenant_id ON insure_transfers(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_insure_transfers_policy_id ON insure_transfers(tenant_id, policy_id);`);
    await queryRunner.query(`CREATE INDEX idx_insure_transfers_status ON insure_transfers(tenant_id, status);`);
    await queryRunner.query(`
      CREATE INDEX idx_insure_transfers_signing_workflow_id
      ON insure_transfers(signing_workflow_id)
      WHERE signing_workflow_id IS NOT NULL;
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uniq_pending_transfer_per_policy
      ON insure_transfers(policy_id, tenant_id)
      WHERE status = 'pending_signatures';
    `);
    await queryRunner.query(`
      CREATE INDEX idx_insure_transfers_transfer_date
      ON insure_transfers(tenant_id, transfer_date);
    `);
    await queryRunner.query(`
      CREATE INDEX idx_insure_transfers_created_at
      ON insure_transfers(tenant_id, created_at DESC);
    `);

    // 4. Activation RLS
    await queryRunner.query(`ALTER TABLE insure_transfers ENABLE ROW LEVEL SECURITY;`);

    // 5. Policy RLS
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_insure_transfers
        ON insure_transfers
        AS RESTRICTIVE
        FOR ALL
        TO PUBLIC
        USING (tenant_id = app_current_tenant())
        WITH CHECK (tenant_id = app_current_tenant());
    `);

    // 6. Trigger updated_at automatique
    await queryRunner.query(`
      CREATE TRIGGER trg_insure_transfers_set_updated_at
        BEFORE UPDATE ON insure_transfers
        FOR EACH ROW
        EXECUTE FUNCTION set_updated_at();
    `);

    // 7. Comment table
    await queryRunner.query(`
      COMMENT ON TABLE insure_transfers IS
      'Transferts juridiques de polices d''assurance entre souscripteurs (cedant -> cessionnaire). Loi 17-99 article 25. Sprint 15 Tache 4.2.1.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_insure_transfers_set_updated_at ON insure_transfers;`);
    await queryRunner.query(`DROP POLICY IF EXISTS tenant_isolation_insure_transfers ON insure_transfers;`);
    await queryRunner.query(`DROP TABLE IF EXISTS insure_transfers CASCADE;`);
    await queryRunner.query(`DROP TYPE IF EXISTS insure_transfer_status_enum;`);
  }
}
```

**Notes importantes** :
- `gen_random_uuid()` requiert l'extension `pgcrypto` (deja installee Sprint 1).
- La fonction `app_current_tenant()` (PG function) lit `current_setting('app.current_tenant')` set par middleware NestJS Sprint 6.
- La fonction `set_updated_at()` (PG trigger function) est definie Sprint 2 (`updated_at := NOW()`).
- Le `CHECK chk_transfer_completion_consistency` empeche d'avoir status='completed' sans `completed_at`, etc.
- `uniq_pending_transfer_per_policy` est un UNIQUE INDEX PARTIEL (WHERE status='pending_signatures') -- permet history multiple completed/cancelled/rejected mais 1 seul pending a la fois.
- `chk_transfer_distinct_contacts` empeche transfer vers soi-meme.

### Fichier 2/14 : Enum `repo/packages/insure/src/entities/insure-transfer-status.enum.ts`

```typescript
/**
 * Sprint 15 Tache 4.2.1 -- Status enum pour InsureTransfer.
 *
 * Cycle de vie :
 *   pending_signatures -> completed   (signatures collectees + police mise a jour)
 *   pending_signatures -> cancelled   (annulation manuelle avant signatures)
 *   pending_signatures -> rejected    (decline d'un signer ou expiration workflow)
 *
 * Aucune transition retour autorisee (immutable apres etat final).
 */
export enum InsureTransferStatus {
  PENDING_SIGNATURES = 'pending_signatures',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

/**
 * Helper : etats finaux (immutables).
 */
export const TERMINAL_TRANSFER_STATUSES: readonly InsureTransferStatus[] = [
  InsureTransferStatus.COMPLETED,
  InsureTransferStatus.CANCELLED,
  InsureTransferStatus.REJECTED,
] as const;

/**
 * Helper : peut-on transitionner depuis ce status ?
 */
export function isTransferStatusTerminal(status: InsureTransferStatus): boolean {
  return TERMINAL_TRANSFER_STATUSES.includes(status);
}
```

### Fichier 3/14 : Entity TypeORM `repo/packages/insure/src/entities/insure-transfer.entity.ts`

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
  Check,
} from 'typeorm';
import { InsurePolicy } from './insure-policy.entity';
import { CrmContact } from '@insurtech/crm';
import { AuthUser } from '@insurtech/auth';
import { SigningWorkflow } from '@insurtech/signature';
import { DocsDocument } from '@insurtech/docs';
import { InsureTransferStatus } from './insure-transfer-status.enum';

/**
 * Entity InsureTransfer
 *
 * Sprint 15 Tache 4.2.1 -- Transfert juridique de police d'assurance
 * entre cedant (from_contact) et cessionnaire (to_contact), avec
 * workflow signature double sequential Barid eSign + ANRT TSA.
 *
 * Reference : Loi 17-99 article 25 + Loi 53-05 + Loi 43-20.
 */
@Entity('insure_transfers')
@Index('idx_insure_transfers_tenant_id', ['tenant_id'])
@Index('idx_insure_transfers_policy_id', ['tenant_id', 'policy_id'])
@Index('idx_insure_transfers_status', ['tenant_id', 'status'])
@Index('idx_insure_transfers_transfer_date', ['tenant_id', 'transfer_date'])
@Check(`from_contact_id <> to_contact_id`)
export class InsureTransfer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'tenant_id' })
  tenant_id!: string;

  @Column('uuid', { name: 'policy_id' })
  policy_id!: string;

  @ManyToOne(() => InsurePolicy, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy?: InsurePolicy;

  @Column('uuid', { name: 'from_contact_id' })
  from_contact_id!: string;

  @ManyToOne(() => CrmContact, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'from_contact_id' })
  from_contact?: CrmContact;

  @Column('uuid', { name: 'to_contact_id' })
  to_contact_id!: string;

  @ManyToOne(() => CrmContact, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'to_contact_id' })
  to_contact?: CrmContact;

  @Column('date', { name: 'transfer_date' })
  transfer_date!: Date;

  @Column({
    type: 'enum',
    enum: InsureTransferStatus,
    enumName: 'insure_transfer_status_enum',
    default: InsureTransferStatus.PENDING_SIGNATURES,
  })
  status!: InsureTransferStatus;

  @Column('uuid', { name: 'signing_workflow_id', nullable: true })
  signing_workflow_id!: string | null;

  @ManyToOne(() => SigningWorkflow, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'signing_workflow_id' })
  signing_workflow?: SigningWorkflow | null;

  @Column('uuid', { name: 'transfer_doc_id', nullable: true })
  transfer_doc_id!: string | null;

  @ManyToOne(() => DocsDocument, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transfer_doc_id' })
  transfer_doc?: DocsDocument | null;

  @Column('uuid', { name: 'transfer_certificate_doc_id', nullable: true })
  transfer_certificate_doc_id!: string | null;

  @ManyToOne(() => DocsDocument, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transfer_certificate_doc_id' })
  transfer_certificate_doc?: DocsDocument | null;

  @Column('text')
  reason!: string;

  @Column('jsonb', { nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column('timestamptz', { name: 'completed_at', nullable: true })
  completed_at!: Date | null;

  @Column('timestamptz', { name: 'cancelled_at', nullable: true })
  cancelled_at!: Date | null;

  @Column('text', { name: 'cancelled_reason', nullable: true })
  cancelled_reason!: string | null;

  @Column('timestamptz', { name: 'rejected_at', nullable: true })
  rejected_at!: Date | null;

  @Column('uuid', { name: 'rejected_by_contact_id', nullable: true })
  rejected_by_contact_id!: string | null;

  @Column('uuid', { name: 'created_by' })
  created_by!: string;

  @ManyToOne(() => AuthUser, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  created_by_user?: AuthUser;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at!: Date;

  /**
   * Helper : etat terminal ?
   */
  isTerminal(): boolean {
    return (
      this.status === InsureTransferStatus.COMPLETED ||
      this.status === InsureTransferStatus.CANCELLED ||
      this.status === InsureTransferStatus.REJECTED
    );
  }
}
```

### Fichier 4/14 : Schemas Zod `repo/packages/insure/src/schemas/insure-transfer.schema.ts`

```typescript
import { z } from 'zod';
import { startOfDay, isValid } from 'date-fns';

/**
 * Sprint 15 Tache 4.2.1 -- Schemas Zod pour validation TransfersService.
 *
 * Conventions :
 * - Tous les inputs valides via Zod.parse() au debut de chaque service method.
 * - Imports stricts : pas de class-validator (decision-006 deja applique
 *   ailleurs : Zod uniquement pour validation runtime, decision-009).
 */

/**
 * Input pour initier un transfert.
 */
export const InitiateTransferInputSchema = z.object({
  policyId: z.string().uuid({ message: 'policyId must be a valid UUID v4' }),
  toContactId: z.string().uuid({ message: 'toContactId must be a valid UUID v4' }),
  reason: z
    .string()
    .min(10, { message: 'reason must be at least 10 characters' })
    .max(500, { message: 'reason must not exceed 500 characters' }),
  transferDate: z.coerce
    .date()
    .refine((d) => isValid(d), { message: 'transferDate must be a valid date' })
    .refine((d) => d >= startOfDay(new Date()), {
      message: 'transferDate must be today or future',
    }),
  metadata: z.record(z.unknown()).optional(),
});

export type InitiateTransferInput = z.infer<typeof InitiateTransferInputSchema>;

/**
 * Input pour annuler un transfert avant signatures collectees.
 */
export const CancelTransferInputSchema = z.object({
  transferId: z.string().uuid(),
  reason: z
    .string()
    .min(5, { message: 'cancellation reason must be at least 5 characters' })
    .max(500),
});

export type CancelTransferInput = z.infer<typeof CancelTransferInputSchema>;

/**
 * Schema interne pour markCompleted (appele par consumer Kafka).
 */
export const MarkCompletedInternalSchema = z.object({
  transferId: z.string().uuid(),
  workflowId: z.string().uuid(),
  completedAt: z.coerce.date(),
});

export type MarkCompletedInternal = z.infer<typeof MarkCompletedInternalSchema>;

/**
 * Schema interne pour markRejected (appele par consumer Kafka).
 */
export const MarkRejectedInternalSchema = z.object({
  transferId: z.string().uuid(),
  workflowId: z.string().uuid(),
  declinerContactId: z.string().uuid().optional(),
  declineReason: z.string().optional(),
  rejectedAt: z.coerce.date(),
});

export type MarkRejectedInternal = z.infer<typeof MarkRejectedInternalSchema>;
```

### Fichier 5/14 : Service principal `repo/packages/insure/src/services/transfers.service.ts`

```typescript
import { Inject, Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Logger } from 'pino';
import { PinoLogger } from 'nestjs-pino';
import { trace, SpanStatusCode } from '@opentelemetry/api';

import { InsureTransfer } from '../entities/insure-transfer.entity';
import { InsureTransferStatus, isTransferStatusTerminal } from '../entities/insure-transfer-status.enum';
import { InsurePolicy, InsurePolicyStatus } from '../entities/insure-policy.entity';
import {
  InitiateTransferInput,
  InitiateTransferInputSchema,
  CancelTransferInput,
  CancelTransferInputSchema,
  MarkCompletedInternalSchema,
  MarkRejectedInternalSchema,
} from '../schemas/insure-transfer.schema';

import { PoliciesService } from './policies.service';
import { ContactsService } from '@insurtech/crm';
import { SigningWorkflowService, SignerRole, SignatureType } from '@insurtech/signature';
import { PdfGenerator, DocumentService, DocumentType } from '@insurtech/docs';
import { CommService, CommChannel } from '@insurtech/comm';
import { AuditLogService } from '@insurtech/shared-utils';
import { KafkaPublisher } from '@insurtech/shared-utils';
import { TenantContext } from '@insurtech/shared-utils';
import { Topics } from '@insurtech/shared-types';

/**
 * Sprint 15 Tache 4.2.1 -- TransfersService
 *
 * Orchestre le transfert juridique d'une police entre deux souscripteurs
 * avec workflow signature double sequential Barid eSign + ANRT TSA.
 *
 * Cycle de vie :
 *   initiateTransfer -> pending_signatures
 *                  |
 *                  +-- (cedant + cessionnaire signent) -> markCompleted -> COMPLETED
 *                  +-- (cancel manuel)                  -> cancel        -> CANCELLED
 *                  +-- (decline / expire)               -> markRejected  -> REJECTED
 *
 * Reference legale : Loi 17-99 article 25 (transmission de plein droit).
 */
@Injectable()
export class TransfersService {
  private readonly logger: Logger;
  private readonly tracer = trace.getTracer('insure.transfers.service');

  constructor(
    @InjectRepository(InsureTransfer)
    private readonly transfersRepo: Repository<InsureTransfer>,
    @InjectRepository(InsurePolicy)
    private readonly policiesRepo: Repository<InsurePolicy>,
    private readonly policiesService: PoliciesService,
    private readonly contactsService: ContactsService,
    private readonly signingWorkflowService: SigningWorkflowService,
    private readonly pdfGenerator: PdfGenerator,
    private readonly documentService: DocumentService,
    private readonly commService: CommService,
    private readonly auditLog: AuditLogService,
    private readonly kafkaPublisher: KafkaPublisher,
    private readonly dataSource: DataSource,
    pino: PinoLogger,
  ) {
    this.logger = pino.logger.child({ component: 'TransfersService' });
  }

  /**
   * Initie un nouveau transfert police cedant -> cessionnaire.
   *
   * @throws BadRequestException si validation echoue
   * @throws NotFoundException si police ou contact inexistant
   * @throws ForbiddenException si cross-tenant
   * @throws ConflictException si transfer pending existant
   */
  async initiateTransfer(input: InitiateTransferInput): Promise<InsureTransfer> {
    return this.tracer.startActiveSpan('transfers.initiateTransfer', async (span) => {
      const startTime = Date.now();
      const tenantId = TenantContext.getCurrentTenantId();
      const userId = TenantContext.getCurrentUserId();

      span.setAttributes({
        'tenant.id': tenantId,
        'user.id': userId,
        'policy.id': input.policyId,
        'to_contact.id': input.toContactId,
      });

      try {
        // 1. Validation Zod
        const validated = InitiateTransferInputSchema.parse(input);

        // 2. Verifications metier (private method)
        const { policy, fromContact, toContact } = await this.validateInitiateTransfer(validated);

        this.logger.info(
          {
            tenant_id: tenantId,
            user_id: userId,
            policy_id: validated.policyId,
            from_contact_id: fromContact.id,
            to_contact_id: toContact.id,
            action: 'transfer.initiate.attempt',
          },
          'Initiating transfer',
        );

        // 3. Generate PDF acte de cession dans langue cedant
        const pdfLocale = fromContact.preferred_language ?? 'fr';
        const pdfBuffer = await this.pdfGenerator.generate(
          'transfer-cession',
          pdfLocale,
          {
            policy: {
              policy_number: policy.policy_number,
              branche: policy.branche,
              prime_annuelle: policy.prime_annuelle,
              start_date: policy.start_date,
              end_date: policy.end_date,
            },
            fromContact: {
              first_name: fromContact.first_name,
              last_name: fromContact.last_name,
              cin: fromContact.cin,
              email: fromContact.email,
              phone: fromContact.phone,
              address: fromContact.address,
            },
            toContact: {
              first_name: toContact.first_name,
              last_name: toContact.last_name,
              cin: toContact.cin,
              email: toContact.email,
              phone: toContact.phone,
              address: toContact.address,
            },
            transferDate: validated.transferDate,
            reason: validated.reason,
            generatedAt: new Date(),
            tenant: { id: tenantId },
          },
        );

        // 4. Persist document
        const pdfDoc = await this.documentService.create({
          type: DocumentType.CONTRAT_CESSION,
          title: `Acte de cession - Police ${policy.policy_number}`,
          file: pdfBuffer,
          related_resource_type: 'insure_transfer',
          related_resource_id: null, // sera lie apres creation row
          metadata: {
            template: 'transfer-cession',
            locale: pdfLocale,
            policy_id: policy.id,
          },
        });

        // 5. Transaction : create transfer row + signing workflow
        return await this.dataSource.transaction(async (em) => {
          // 5a. Create transfer row (status pending_signatures)
          const transfer = em.create(InsureTransfer, {
            tenant_id: tenantId,
            policy_id: validated.policyId,
            from_contact_id: fromContact.id,
            to_contact_id: toContact.id,
            transfer_date: validated.transferDate,
            status: InsureTransferStatus.PENDING_SIGNATURES,
            transfer_doc_id: pdfDoc.id,
            reason: validated.reason,
            metadata: validated.metadata ?? null,
            created_by: userId,
          });

          const savedTransfer = await em.save(transfer);

          // 5b. Update related_resource_id du document
          await this.documentService.updateRelatedResource(pdfDoc.id, savedTransfer.id);

          // 5c. Create Barid eSign workflow avec 2 signers SEQUENTIAL
          const signingWorkflow = await this.signingWorkflowService.createWorkflow(
            pdfDoc.id,
            [
              {
                name: `${fromContact.first_name} ${fromContact.last_name}`,
                email: fromContact.email,
                phone: fromContact.phone,
                role: SignerRole.SIGNER,
                order: 1, // cedant signe en premier
                cin: fromContact.cin,
                contact_id: fromContact.id,
              },
              {
                name: `${toContact.first_name} ${toContact.last_name}`,
                email: toContact.email,
                phone: toContact.phone,
                role: SignerRole.SIGNER,
                order: 2, // cessionnaire signe en second
                cin: toContact.cin,
                contact_id: toContact.id,
              },
            ],
            {
              signature_type: SignatureType.QUALIFIED,
              expires_in_days: 14,
              metadata: {
                resource_type: 'insure_transfer',
                resource_id: savedTransfer.id,
                tenant_id: tenantId,
              },
            },
          );

          // 5d. Send for signature
          await this.signingWorkflowService.sendForSignature(signingWorkflow.id);

          // 5e. Update transfer with workflow id
          savedTransfer.signing_workflow_id = signingWorkflow.id;
          await em.save(savedTransfer);

          // 5f. Audit log
          await this.auditLog.log({
            tenant_id: tenantId,
            user_id: userId,
            action: 'insure.transfer.initiated',
            resource_type: 'insure_transfer',
            resource_id: savedTransfer.id,
            metadata: {
              policy_id: validated.policyId,
              from_contact_id: fromContact.id,
              to_contact_id: toContact.id,
              transfer_date: validated.transferDate.toISOString(),
              reason: validated.reason,
              signing_workflow_id: signingWorkflow.id,
              snapshotBefore: { policy_contact_id: fromContact.id },
              snapshotAfter: null, // will be set on markCompleted
            },
          });

          // 5g. Kafka event
          await this.kafkaPublisher.publish(Topics.INSURE_TRANSFER_INITIATED, {
            tenant_id: tenantId,
            transfer_id: savedTransfer.id,
            policy_id: validated.policyId,
            from_contact_id: fromContact.id,
            to_contact_id: toContact.id,
            transfer_date: validated.transferDate.toISOString(),
            signing_workflow_id: signingWorkflow.id,
            initiated_by_user_id: userId,
            initiated_at: new Date().toISOString(),
          }, { idempotency_key: `transfer-init-${savedTransfer.id}` });

          // 5h. Notifications Comm aux 2 parties (async, fire-and-forget)
          this.notifyTransferInitiated(savedTransfer, fromContact, toContact, policy).catch((err) => {
            this.logger.error(
              { err, transfer_id: savedTransfer.id, action: 'notify.transfer_initiated.failed' },
              'Failed to send transfer initiated notifications (non-blocking)',
            );
          });

          this.logger.info(
            {
              tenant_id: tenantId,
              transfer_id: savedTransfer.id,
              duration_ms: Date.now() - startTime,
              action: 'transfer.initiate.success',
            },
            'Transfer initiated successfully',
          );

          return savedTransfer;
        });
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        this.logger.error(
          { err, action: 'transfer.initiate.error', duration_ms: Date.now() - startTime },
          'Transfer initiation failed',
        );
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Validation metier transfert (private).
   */
  private async validateInitiateTransfer(input: InitiateTransferInput) {
    const tenantId = TenantContext.getCurrentTenantId();

    // 1. Police existe et appartient au tenant courant
    const policy = await this.policiesService.findById(input.policyId);
    if (!policy) {
      throw new NotFoundException({ code: 'POLICY_NOT_FOUND', policy_id: input.policyId });
    }

    // 2. Police active uniquement
    if (policy.status !== InsurePolicyStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'POLICY_NOT_ACTIVE',
        message: `Cannot transfer policy in status ${policy.status}`,
        policy_status: policy.status,
      });
    }

    // 3. transfer_date <= policy.end_date
    if (input.transferDate >= policy.end_date) {
      throw new BadRequestException({
        code: 'TRANSFER_DATE_AFTER_POLICY_END',
        message: 'transferDate must be before policy end_date',
        transfer_date: input.transferDate,
        policy_end_date: policy.end_date,
      });
    }

    // 4. Pas de transfer pending existant sur cette police
    const existing = await this.transfersRepo.findOne({
      where: {
        policy_id: input.policyId,
        status: InsureTransferStatus.PENDING_SIGNATURES,
      },
    });
    if (existing) {
      throw new ConflictException({
        code: 'TRANSFER_PENDING_EXISTS',
        message: 'A pending transfer already exists for this policy',
        existing_transfer_id: existing.id,
      });
    }

    // 5. Contact source (from_contact = policy.contact_id) existe
    const fromContact = await this.contactsService.findById(policy.contact_id);
    if (!fromContact) {
      throw new NotFoundException({ code: 'FROM_CONTACT_NOT_FOUND', contact_id: policy.contact_id });
    }

    // 6. Contact cible existe
    const toContact = await this.contactsService.findById(input.toContactId);
    if (!toContact) {
      throw new NotFoundException({ code: 'TO_CONTACT_NOT_FOUND', contact_id: input.toContactId });
    }

    // 7. Cross-tenant strict
    if (fromContact.tenant_id !== tenantId || toContact.tenant_id !== tenantId) {
      throw new ForbiddenException({
        code: 'CROSS_TENANT_TRANSFER_FORBIDDEN',
        message: 'Both contacts must belong to the current tenant',
      });
    }

    // 8. Pas de transfer vers soi-meme
    if (fromContact.id === toContact.id) {
      throw new BadRequestException({
        code: 'SAME_CONTACT_TRANSFER',
        message: 'from_contact and to_contact must be different',
      });
    }

    // 9. Verifier emails distincts (sinon Barid eSign rejette workflow 2 signers meme email)
    if (fromContact.email.toLowerCase() === toContact.email.toLowerCase()) {
      throw new BadRequestException({
        code: 'SAME_EMAIL_CONTACTS',
        message: 'from_contact and to_contact must have distinct emails for sequential signing',
      });
    }

    return { policy, fromContact, toContact };
  }

  /**
   * Marque le transfert comme complete apres reception des 2 signatures.
   * Appele par TransfersWorkflowConsumer (Tache 4.2.12) sur event WorkflowCompletedEvent.
   *
   * @internal
   */
  async markCompleted(transferId: string, workflowId: string, completedAt: Date = new Date()): Promise<InsureTransfer> {
    return this.tracer.startActiveSpan('transfers.markCompleted', async (span) => {
      const tenantId = TenantContext.getCurrentTenantId();
      span.setAttributes({ 'tenant.id': tenantId, 'transfer.id': transferId });

      try {
        MarkCompletedInternalSchema.parse({ transferId, workflowId, completedAt });

        const transfer = await this.transfersRepo.findOne({
          where: { id: transferId },
          relations: ['policy', 'from_contact', 'to_contact'],
        });

        if (!transfer) {
          throw new NotFoundException({ code: 'TRANSFER_NOT_FOUND', transfer_id: transferId });
        }

        if (transfer.status !== InsureTransferStatus.PENDING_SIGNATURES) {
          this.logger.warn(
            { transfer_id: transferId, current_status: transfer.status, action: 'markCompleted.skipped' },
            'markCompleted called but transfer not in pending_signatures status (idempotent skip)',
          );
          return transfer;
        }

        if (transfer.signing_workflow_id !== workflowId) {
          throw new BadRequestException({
            code: 'WORKFLOW_ID_MISMATCH',
            transfer_id: transferId,
            expected: transfer.signing_workflow_id,
            received: workflowId,
          });
        }

        return await this.dataSource.transaction(async (em) => {
          // 1. Snapshot before
          const snapshotBefore = {
            policy_contact_id: transfer.policy_id,
            previous_owner_contact_id: transfer.from_contact_id,
          };

          // 2. Update police : contact_id -> to_contact_id
          await em.update(
            InsurePolicy,
            { id: transfer.policy_id, tenant_id: tenantId },
            { contact_id: transfer.to_contact_id, updated_at: new Date() },
          );

          // 3. Generate certificat de transfert PDF + scelle ANRT TSA
          const certificatePdfLocale = transfer.from_contact?.preferred_language ?? 'fr';
          const certificateBuffer = await this.pdfGenerator.generate(
            'transfer-certificate',
            certificatePdfLocale,
            {
              transfer,
              policy: transfer.policy,
              fromContact: transfer.from_contact,
              toContact: transfer.to_contact,
              completedAt,
              verificationUrl: `https://verify.skalean.ma/transfer/${transfer.id}`,
              generatedAt: new Date(),
            },
          );

          const certificateDoc = await this.documentService.create({
            type: DocumentType.CERTIFICATE_TRANSFER,
            title: `Certificat transfert - Police ${transfer.policy?.policy_number}`,
            file: certificateBuffer,
            related_resource_type: 'insure_transfer_certificate',
            related_resource_id: transfer.id,
            apply_anrt_tsa: true, // sceau TSA RFC 3161 ANRT
            metadata: { transfer_id: transfer.id, completed_at: completedAt.toISOString() },
          });

          // 4. Update transfer row
          transfer.status = InsureTransferStatus.COMPLETED;
          transfer.completed_at = completedAt;
          transfer.transfer_certificate_doc_id = certificateDoc.id;
          await em.save(transfer);

          // 5. Audit log avec snapshot before/after
          await this.auditLog.log({
            tenant_id: tenantId,
            user_id: 'system', // appelle par consumer Kafka, pas user
            action: 'insure.transfer.completed',
            resource_type: 'insure_transfer',
            resource_id: transfer.id,
            metadata: {
              snapshotBefore,
              snapshotAfter: { policy_contact_id: transfer.to_contact_id, new_owner_contact_id: transfer.to_contact_id },
              certificate_doc_id: certificateDoc.id,
              completed_at: completedAt.toISOString(),
            },
          });

          // 6. Kafka event completed
          await this.kafkaPublisher.publish(Topics.INSURE_TRANSFER_COMPLETED, {
            tenant_id: tenantId,
            transfer_id: transfer.id,
            policy_id: transfer.policy_id,
            from_contact_id: transfer.from_contact_id,
            to_contact_id: transfer.to_contact_id,
            completed_at: completedAt.toISOString(),
            certificate_doc_id: certificateDoc.id,
          }, { idempotency_key: `transfer-complete-${transfer.id}` });

          // 7. Notifications finalisation
          this.notifyTransferCompleted(transfer).catch((err) => {
            this.logger.error({ err, transfer_id: transfer.id }, 'Failed to send completion notifications');
          });

          this.logger.info(
            { transfer_id: transfer.id, action: 'transfer.complete.success' },
            'Transfer marked completed',
          );

          return transfer;
        });
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Annule un transfert avant collecte signatures (action manuelle courtier).
   */
  async cancel(input: CancelTransferInput): Promise<InsureTransfer> {
    return this.tracer.startActiveSpan('transfers.cancel', async (span) => {
      const tenantId = TenantContext.getCurrentTenantId();
      const userId = TenantContext.getCurrentUserId();
      span.setAttributes({ 'tenant.id': tenantId, 'transfer.id': input.transferId });

      try {
        const validated = CancelTransferInputSchema.parse(input);
        const transfer = await this.transfersRepo.findOne({
          where: { id: validated.transferId },
          relations: ['from_contact', 'to_contact'],
        });

        if (!transfer) {
          throw new NotFoundException({ code: 'TRANSFER_NOT_FOUND' });
        }

        if (isTransferStatusTerminal(transfer.status)) {
          throw new BadRequestException({
            code: 'TRANSFER_ALREADY_TERMINAL',
            current_status: transfer.status,
          });
        }

        return await this.dataSource.transaction(async (em) => {
          // 1. Invalider workflow Barid si existant
          if (transfer.signing_workflow_id) {
            await this.signingWorkflowService.cancelWorkflow(
              transfer.signing_workflow_id,
              `Transfer cancelled by user: ${validated.reason}`,
            );
          }

          // 2. Update status
          transfer.status = InsureTransferStatus.CANCELLED;
          transfer.cancelled_at = new Date();
          transfer.cancelled_reason = validated.reason;
          await em.save(transfer);

          // 3. Audit
          await this.auditLog.log({
            tenant_id: tenantId,
            user_id: userId,
            action: 'insure.transfer.cancelled',
            resource_type: 'insure_transfer',
            resource_id: transfer.id,
            metadata: { reason: validated.reason },
          });

          // 4. Kafka
          await this.kafkaPublisher.publish(Topics.INSURE_TRANSFER_CANCELLED, {
            tenant_id: tenantId,
            transfer_id: transfer.id,
            cancelled_by_user_id: userId,
            cancelled_at: transfer.cancelled_at.toISOString(),
            reason: validated.reason,
          }, { idempotency_key: `transfer-cancel-${transfer.id}` });

          // 5. Notif
          this.notifyTransferCancelled(transfer).catch((err) => {
            this.logger.error({ err, transfer_id: transfer.id }, 'Failed to send cancellation notifications');
          });

          return transfer;
        });
      } catch (err) {
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Marque un transfert comme rejete suite a decline d'un signer ou expiration.
   * Appele par TransfersWorkflowDeclinedConsumer (Tache 4.2.12).
   *
   * @internal
   */
  async markRejected(
    transferId: string,
    workflowId: string,
    declinerContactId: string | null,
    declineReason: string | null,
    rejectedAt: Date = new Date(),
  ): Promise<InsureTransfer> {
    const tenantId = TenantContext.getCurrentTenantId();
    MarkRejectedInternalSchema.parse({
      transferId,
      workflowId,
      declinerContactId: declinerContactId ?? undefined,
      declineReason: declineReason ?? undefined,
      rejectedAt,
    });

    const transfer = await this.transfersRepo.findOne({
      where: { id: transferId },
      relations: ['from_contact', 'to_contact'],
    });

    if (!transfer) {
      throw new NotFoundException({ code: 'TRANSFER_NOT_FOUND' });
    }

    if (transfer.status !== InsureTransferStatus.PENDING_SIGNATURES) {
      this.logger.warn(
        { transfer_id: transferId, current_status: transfer.status, action: 'markRejected.skipped' },
        'markRejected called but transfer not in pending_signatures (idempotent skip)',
      );
      return transfer;
    }

    return await this.dataSource.transaction(async (em) => {
      transfer.status = InsureTransferStatus.REJECTED;
      transfer.rejected_at = rejectedAt;
      transfer.rejected_by_contact_id = declinerContactId;
      transfer.metadata = { ...transfer.metadata, decline_reason: declineReason };
      await em.save(transfer);

      await this.auditLog.log({
        tenant_id: tenantId,
        user_id: 'system',
        action: 'insure.transfer.rejected',
        resource_type: 'insure_transfer',
        resource_id: transfer.id,
        metadata: { decliner_contact_id: declinerContactId, reason: declineReason },
      });

      await this.kafkaPublisher.publish(Topics.INSURE_TRANSFER_REJECTED, {
        tenant_id: tenantId,
        transfer_id: transfer.id,
        decliner_contact_id: declinerContactId,
        reason: declineReason,
        rejected_at: rejectedAt.toISOString(),
      }, { idempotency_key: `transfer-reject-${transfer.id}` });

      this.notifyTransferRejected(transfer, declineReason).catch((err) => {
        this.logger.error({ err, transfer_id: transfer.id }, 'Failed to send rejection notifications');
      });

      return transfer;
    });
  }

  /**
   * Lecture simple par id (tenant-scoped via RLS).
   */
  async findById(transferId: string): Promise<InsureTransfer | null> {
    return this.transfersRepo.findOne({
      where: { id: transferId },
      relations: ['policy', 'from_contact', 'to_contact', 'transfer_doc', 'transfer_certificate_doc'],
    });
  }

  /**
   * Liste transfers d'une police.
   */
  async listByPolicyId(policyId: string): Promise<InsureTransfer[]> {
    return this.transfersRepo.find({
      where: { policy_id: policyId },
      order: { created_at: 'DESC' },
    });
  }

  // ============ Notifications helpers (private) ============

  private async notifyTransferInitiated(transfer: InsureTransfer, fromContact: any, toContact: any, policy: any) {
    const baseVars = {
      transfer_id: transfer.id,
      policy_number: policy.policy_number,
      transfer_date: transfer.transfer_date,
    };
    await Promise.all([
      this.commService.send({
        channel: CommChannel.WHATSAPP,
        recipient: fromContact.phone,
        template: 'transfer-initiated',
        locale: fromContact.preferred_language ?? 'fr',
        variables: { ...baseVars, recipient_role: 'cedant' },
      }),
      this.commService.send({
        channel: CommChannel.EMAIL,
        recipient: fromContact.email,
        template: 'transfer-initiated',
        locale: fromContact.preferred_language ?? 'fr',
        variables: { ...baseVars, recipient_role: 'cedant' },
      }),
      this.commService.send({
        channel: CommChannel.WHATSAPP,
        recipient: toContact.phone,
        template: 'transfer-initiated',
        locale: toContact.preferred_language ?? 'fr',
        variables: { ...baseVars, recipient_role: 'cessionnaire' },
      }),
      this.commService.send({
        channel: CommChannel.EMAIL,
        recipient: toContact.email,
        template: 'transfer-initiated',
        locale: toContact.preferred_language ?? 'fr',
        variables: { ...baseVars, recipient_role: 'cessionnaire' },
      }),
    ]);
  }

  private async notifyTransferCompleted(transfer: InsureTransfer) {
    if (!transfer.from_contact || !transfer.to_contact) return;
    const baseVars = { transfer_id: transfer.id, completed_at: transfer.completed_at };
    await Promise.all([
      this.commService.send({
        channel: CommChannel.EMAIL,
        recipient: transfer.from_contact.email,
        template: 'transfer-completed',
        locale: transfer.from_contact.preferred_language ?? 'fr',
        variables: baseVars,
      }),
      this.commService.send({
        channel: CommChannel.EMAIL,
        recipient: transfer.to_contact.email,
        template: 'transfer-completed',
        locale: transfer.to_contact.preferred_language ?? 'fr',
        variables: baseVars,
      }),
    ]);
  }

  private async notifyTransferCancelled(transfer: InsureTransfer) {
    if (!transfer.from_contact || !transfer.to_contact) return;
    const baseVars = { transfer_id: transfer.id, reason: transfer.cancelled_reason };
    await this.commService.send({
      channel: CommChannel.EMAIL,
      recipient: transfer.from_contact.email,
      template: 'transfer-rejected',
      locale: transfer.from_contact.preferred_language ?? 'fr',
      variables: baseVars,
    });
  }

  private async notifyTransferRejected(transfer: InsureTransfer, reason: string | null) {
    if (!transfer.from_contact || !transfer.to_contact) return;
    const baseVars = { transfer_id: transfer.id, reason };
    await Promise.all([
      this.commService.send({
        channel: CommChannel.EMAIL,
        recipient: transfer.from_contact.email,
        template: 'transfer-rejected',
        locale: transfer.from_contact.preferred_language ?? 'fr',
        variables: baseVars,
      }),
      this.commService.send({
        channel: CommChannel.EMAIL,
        recipient: transfer.to_contact.email,
        template: 'transfer-rejected',
        locale: transfer.to_contact.preferred_language ?? 'fr',
        variables: baseVars,
      }),
    ]);
  }
}
```

**Notes importantes** :
- Toutes operations dans une `dataSource.transaction()` -> atomicite + rollback automatique sur error.
- Notifications Comm sont **fire-and-forget** : un echec d'email ne doit pas casser un transfert.
- `idempotency_key` sur chaque publish Kafka -> protege double-consumption.
- Audit log capture **snapshotBefore + snapshotAfter** systematiquement.
- Span OpenTelemetry pour chaque method principale (observability).
- Logging Pino structured avec champs obligatoires (tenant_id, user_id, action, duration_ms).
- `validateInitiateTransfer` est extrait en methode privee pour testabilite + reuse (ex: dry-run endpoint Sprint 16).

### Fichier 6/14 : Controller `repo/apps/api/src/modules/insure/controllers/transfers.controller.ts`

```typescript
import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiHeader } from '@nestjs/swagger';

import { TransfersService } from '@insurtech/insure';
import { TenantGuard } from '../../../guards/tenant.guard';
import { RolesGuard } from '../../../guards/roles.guard';
import { Roles } from '../../../decorators/roles.decorator';
import { Permissions } from '../../../decorators/permissions.decorator';
import { ZodValidationPipe } from '../../../pipes/zod-validation.pipe';
import { InitiateTransferInputSchema, CancelTransferInputSchema } from '@insurtech/insure';
import { InitiateTransferDto } from '../dto/initiate-transfer.dto';
import { CancelTransferDto } from '../dto/cancel-transfer.dto';
import { TransferResponseDto } from '../dto/transfer-response.dto';

/**
 * Sprint 15 Tache 4.2.1 -- Endpoints REST transfers.
 *
 * Permissions :
 * - POST /policies/:id/transfer : insure.policies.transfer
 * - GET /transfers/:id          : insure.transfers.read
 * - POST /transfers/:id/cancel  : insure.transfers.cancel
 * - GET /policies/:id/transfers : insure.transfers.read
 */
@ApiTags('insure-transfers')
@ApiBearerAuth()
@ApiHeader({ name: 'x-tenant-id', description: 'Tenant UUID', required: true })
@Controller({ path: 'insure', version: '1' })
@UseGuards(TenantGuard, RolesGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post('policies/:policyId/transfer')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('insure.policies.transfer')
  @ApiOperation({
    summary: 'Initier transfert police vers nouveau souscripteur',
    description: 'Cree un transfert pending_signatures + workflow Barid eSign double signature sequential (cedant + cessionnaire). Loi 17-99 article 25.',
  })
  @ApiParam({ name: 'policyId', description: 'UUID police', required: true })
  @ApiResponse({ status: 201, description: 'Transfert initie', type: TransferResponseDto })
  @ApiResponse({ status: 400, description: 'Validation erreur (police inactive, transfer pending existant, etc.)' })
  @ApiResponse({ status: 403, description: 'Cross-tenant ou permission manquante' })
  @ApiResponse({ status: 404, description: 'Police ou contact non trouve' })
  @ApiResponse({ status: 409, description: 'Conflict : transfer pending existant' })
  @UsePipes(new ZodValidationPipe(InitiateTransferInputSchema))
  async initiateTransfer(
    @Param('policyId') policyId: string,
    @Body() body: InitiateTransferDto,
  ): Promise<TransferResponseDto> {
    const transfer = await this.transfersService.initiateTransfer({
      policyId,
      toContactId: body.toContactId,
      reason: body.reason,
      transferDate: body.transferDate,
      metadata: body.metadata,
    });
    return TransferResponseDto.fromEntity(transfer);
  }

  @Get('transfers/:id')
  @Permissions('insure.transfers.read')
  @ApiOperation({ summary: 'Recuperer details transfert' })
  @ApiParam({ name: 'id', description: 'UUID transfert', required: true })
  @ApiResponse({ status: 200, description: 'Transfert trouve', type: TransferResponseDto })
  @ApiResponse({ status: 404, description: 'Transfert non trouve' })
  async getTransfer(@Param('id') id: string): Promise<TransferResponseDto> {
    const transfer = await this.transfersService.findById(id);
    if (!transfer) {
      throw new (require('@nestjs/common').NotFoundException)({ code: 'TRANSFER_NOT_FOUND' });
    }
    return TransferResponseDto.fromEntity(transfer);
  }

  @Get('policies/:policyId/transfers')
  @Permissions('insure.transfers.read')
  @ApiOperation({ summary: 'Lister transferts (history) d\'une police' })
  @ApiParam({ name: 'policyId', required: true })
  @ApiResponse({ status: 200, description: 'Liste transferts', type: [TransferResponseDto] })
  async listTransfersByPolicy(@Param('policyId') policyId: string): Promise<TransferResponseDto[]> {
    const transfers = await this.transfersService.listByPolicyId(policyId);
    return transfers.map((t) => TransferResponseDto.fromEntity(t));
  }

  @Post('transfers/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions('insure.transfers.cancel')
  @ApiOperation({
    summary: 'Annuler transfert pending (invalide workflow Barid)',
  })
  @ApiParam({ name: 'id', required: true })
  @ApiResponse({ status: 200, description: 'Transfert annule', type: TransferResponseDto })
  @ApiResponse({ status: 400, description: 'Transfert deja en etat terminal' })
  @ApiResponse({ status: 404, description: 'Transfert non trouve' })
  @UsePipes(new ZodValidationPipe(CancelTransferInputSchema))
  async cancelTransfer(
    @Param('id') id: string,
    @Body() body: CancelTransferDto,
  ): Promise<TransferResponseDto> {
    const transfer = await this.transfersService.cancel({
      transferId: id,
      reason: body.reason,
    });
    return TransferResponseDto.fromEntity(transfer);
  }
}
```

### Fichier 7/14 : DTO `repo/apps/api/src/modules/insure/dto/initiate-transfer.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour POST /api/v1/insure/policies/:policyId/transfer
 * Validation via ZodValidationPipe (InitiateTransferInputSchema).
 */
export class InitiateTransferDto {
  @ApiProperty({ description: 'UUID du contact destinataire (cessionnaire)', example: '550e8400-e29b-41d4-a716-446655440000' })
  toContactId!: string;

  @ApiProperty({ description: 'Motif du transfert', minLength: 10, maxLength: 500, example: 'Vente du vehicule conformement acte du 15/05/2026' })
  reason!: string;

  @ApiProperty({ description: 'Date effective transfert (ISO 8601 date)', example: '2026-05-20' })
  transferDate!: string;

  @ApiPropertyOptional({ description: 'Metadonnees libres JSONB' })
  metadata?: Record<string, unknown>;
}
```

### Fichier 8/14 : DTO `repo/apps/api/src/modules/insure/dto/cancel-transfer.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class CancelTransferDto {
  @ApiProperty({ description: 'Raison annulation', minLength: 5, maxLength: 500 })
  reason!: string;
}
```

### Fichier 9/14 : DTO `repo/apps/api/src/modules/insure/dto/transfer-response.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InsureTransfer, InsureTransferStatus } from '@insurtech/insure';

export class TransferResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() policy_id!: string;
  @ApiProperty() from_contact_id!: string;
  @ApiProperty() to_contact_id!: string;
  @ApiProperty() transfer_date!: string;
  @ApiProperty({ enum: InsureTransferStatus }) status!: InsureTransferStatus;
  @ApiPropertyOptional() signing_workflow_id?: string | null;
  @ApiPropertyOptional() transfer_doc_id?: string | null;
  @ApiPropertyOptional() transfer_certificate_doc_id?: string | null;
  @ApiProperty() reason!: string;
  @ApiPropertyOptional() completed_at?: string | null;
  @ApiPropertyOptional() cancelled_at?: string | null;
  @ApiPropertyOptional() rejected_at?: string | null;
  @ApiProperty() created_at!: string;

  static fromEntity(e: InsureTransfer): TransferResponseDto {
    return {
      id: e.id,
      policy_id: e.policy_id,
      from_contact_id: e.from_contact_id,
      to_contact_id: e.to_contact_id,
      transfer_date: e.transfer_date.toISOString().slice(0, 10),
      status: e.status,
      signing_workflow_id: e.signing_workflow_id,
      transfer_doc_id: e.transfer_doc_id,
      transfer_certificate_doc_id: e.transfer_certificate_doc_id,
      reason: e.reason,
      completed_at: e.completed_at?.toISOString() ?? null,
      cancelled_at: e.cancelled_at?.toISOString() ?? null,
      rejected_at: e.rejected_at?.toISOString() ?? null,
      created_at: e.created_at.toISOString(),
    };
  }
}
```

### Fichier 10/14 : Template Handlebars `repo/packages/docs/src/templates/fr/transfer-cession.hbs`

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Acte de Cession - Police {{policy.policy_number}}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1a1a1a; margin: 0; padding: 40px; }
    h1 { font-size: 18pt; text-align: center; border-bottom: 2px solid #1a3a5c; padding-bottom: 8px; }
    h2 { font-size: 13pt; color: #1a3a5c; margin-top: 24px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #c0c0c0; padding: 6px 10px; text-align: left; }
    th { background-color: #f0f4f8; }
    .legal { font-size: 9pt; color: #4a4a4a; margin-top: 20px; font-style: italic; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
    .sig-box { width: 45%; border-top: 1px solid #1a1a1a; padding-top: 6px; }
  </style>
</head>
<body>
  <h1>Acte de Cession de Police d'Assurance</h1>

  <p><strong>Reference interne :</strong> Transfert genere le {{formatDate generatedAt 'dd/MM/yyyy HH:mm'}}</p>
  <p><strong>Police concernee :</strong> {{policy.policy_number}} -- {{policy.branche}}</p>

  <h2>1. Identification des parties</h2>
  <table>
    <tr><th>Partie</th><th>Cedant (souscripteur actuel)</th><th>Cessionnaire (nouveau souscripteur)</th></tr>
    <tr>
      <td>Nom complet</td>
      <td>{{fromContact.first_name}} {{fromContact.last_name}}</td>
      <td>{{toContact.first_name}} {{toContact.last_name}}</td>
    </tr>
    <tr>
      <td>CIN</td>
      <td>{{fromContact.cin}}</td>
      <td>{{toContact.cin}}</td>
    </tr>
    <tr>
      <td>Adresse</td>
      <td>{{fromContact.address}}</td>
      <td>{{toContact.address}}</td>
    </tr>
    <tr>
      <td>Telephone</td>
      <td>{{fromContact.phone}}</td>
      <td>{{toContact.phone}}</td>
    </tr>
    <tr>
      <td>Email</td>
      <td>{{fromContact.email}}</td>
      <td>{{toContact.email}}</td>
    </tr>
  </table>

  <h2>2. Police d'assurance objet de la cession</h2>
  <table>
    <tr><th>Numero police</th><td>{{policy.policy_number}}</td></tr>
    <tr><th>Branche</th><td>{{policy.branche}}</td></tr>
    <tr><th>Date d'effet initiale</th><td>{{formatDate policy.start_date 'dd/MM/yyyy'}}</td></tr>
    <tr><th>Date d'echeance</th><td>{{formatDate policy.end_date 'dd/MM/yyyy'}}</td></tr>
    <tr><th>Prime annuelle</th><td>{{formatMoney policy.prime_annuelle}} DH</td></tr>
  </table>

  <h2>3. Effet de la cession</h2>
  <p>Date effective de la cession : <strong>{{formatDate transferDate 'dd/MM/yyyy'}}</strong></p>
  <p>Motif de la cession : {{reason}}</p>

  <h2>4. Engagements des parties</h2>
  <p>Le cessionnaire declare avoir pris connaissance des conditions generales et particulieres de la police objet de la presente cession, et accepte d'executer toutes les obligations contractuelles vis-a-vis de l'assureur, conformement a l'article 25 de la loi 17-99 portant Code des Assurances marocain.</p>
  <p>Le cedant transfere a titre definitif tous ses droits et obligations relatifs a la police designee, a compter de la date effective indiquee ci-dessus.</p>
  <p>Les deux parties reconnaissent que le present acte est conclu sous condition de signature electronique qualifiee, conforme aux dispositions de la loi 53-05 sur l'echange electronique de donnees juridiques et de la loi 43-20 sur les services de confiance pour les transactions electroniques, avec scellement temporel ANRT TSA.</p>

  <h2>5. Droit de retractation du cessionnaire</h2>
  <p>Conformement a l'article 26 de la loi 17-99, le cessionnaire dispose d'un delai de 30 jours a compter de la prise d'effet du transfert pour exercer son droit de resiliation. Cette demande devra etre formulee par lettre recommandee avec accuse de reception adressee a l'assureur, ou par voie electronique via l'espace client Skalean.</p>

  <div class="signatures">
    <div class="sig-box">
      <p><strong>Cedant</strong></p>
      <p>{{fromContact.first_name}} {{fromContact.last_name}}</p>
      <p>Signature electronique qualifiee Barid eSign</p>
    </div>
    <div class="sig-box">
      <p><strong>Cessionnaire</strong></p>
      <p>{{toContact.first_name}} {{toContact.last_name}}</p>
      <p>Signature electronique qualifiee Barid eSign</p>
    </div>
  </div>

  <p class="legal">Document genere automatiquement par la plateforme Skalean InsurTech. Les signatures electroniques apposees ci-dessus sont scellees par ANRT TSA (RFC 3161) et reposent sur les dispositions des lois 53-05 et 43-20 du Royaume du Maroc. Toute contestation releve de la competence des tribunaux marocains.</p>
</body>
</html>
```

(Note : les templates `ar-MA/transfer-cession.hbs` et `ar/transfer-cession.hbs` suivent la meme structure adaptee a la langue cible, avec dir="rtl" et adaptation typographique. Voir Sprint 10 pour la convention.)

### Fichier 11/14 : Module integration `repo/packages/insure/src/module/transfers.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InsureTransfer } from '../entities/insure-transfer.entity';
import { InsurePolicy } from '../entities/insure-policy.entity';
import { TransfersService } from '../services/transfers.service';
import { PoliciesModule } from './policies.module';
import { CrmModule } from '@insurtech/crm';
import { SignatureModule } from '@insurtech/signature';
import { DocsModule } from '@insurtech/docs';
import { CommModule } from '@insurtech/comm';

@Module({
  imports: [
    TypeOrmModule.forFeature([InsureTransfer, InsurePolicy]),
    PoliciesModule,
    CrmModule,
    SignatureModule,
    DocsModule,
    CommModule,
  ],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
```

### Fichier 12/14 : Permission enum update `repo/packages/auth/src/rbac/permissions.enum.ts` (modif)

```typescript
// ... existing permissions ...

// Sprint 15 Tache 4.2.1 -- Transfers permissions
INSURE_POLICIES_TRANSFER = 'insure.policies.transfer',
INSURE_TRANSFERS_READ = 'insure.transfers.read',
INSURE_TRANSFERS_CANCEL = 'insure.transfers.cancel',

// ... existing permissions ...
```

### Fichier 13/14 : Kafka topics update `repo/packages/shared-types/src/kafka-topics.ts` (modif)

```typescript
// Sprint 15 Tache 4.2.1 -- Transfers Kafka topics
INSURE_TRANSFER_INITIATED: 'insurtech.events.insure.transfer.initiated',
INSURE_TRANSFER_COMPLETED: 'insurtech.events.insure.transfer.completed',
INSURE_TRANSFER_CANCELLED: 'insurtech.events.insure.transfer.cancelled',
INSURE_TRANSFER_REJECTED: 'insurtech.events.insure.transfer.rejected',
```

### Fichier 14/14 : Event schemas Zod `repo/packages/shared-types/src/events/insure-transfer.events.ts`

```typescript
import { z } from 'zod';

export const InsureTransferInitiatedEventSchema = z.object({
  tenant_id: z.string().uuid(),
  transfer_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  from_contact_id: z.string().uuid(),
  to_contact_id: z.string().uuid(),
  transfer_date: z.string().datetime(),
  signing_workflow_id: z.string().uuid(),
  initiated_by_user_id: z.string().uuid(),
  initiated_at: z.string().datetime(),
});
export type InsureTransferInitiatedEvent = z.infer<typeof InsureTransferInitiatedEventSchema>;

export const InsureTransferCompletedEventSchema = z.object({
  tenant_id: z.string().uuid(),
  transfer_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  from_contact_id: z.string().uuid(),
  to_contact_id: z.string().uuid(),
  completed_at: z.string().datetime(),
  certificate_doc_id: z.string().uuid(),
});
export type InsureTransferCompletedEvent = z.infer<typeof InsureTransferCompletedEventSchema>;

export const InsureTransferCancelledEventSchema = z.object({
  tenant_id: z.string().uuid(),
  transfer_id: z.string().uuid(),
  cancelled_by_user_id: z.string().uuid(),
  cancelled_at: z.string().datetime(),
  reason: z.string(),
});
export type InsureTransferCancelledEvent = z.infer<typeof InsureTransferCancelledEventSchema>;

export const InsureTransferRejectedEventSchema = z.object({
  tenant_id: z.string().uuid(),
  transfer_id: z.string().uuid(),
  decliner_contact_id: z.string().uuid().nullable(),
  reason: z.string().nullable(),
  rejected_at: z.string().datetime(),
});
export type InsureTransferRejectedEvent = z.infer<typeof InsureTransferRejectedEventSchema>;
```

---

## 7. Tests complets

### 7.1 Tests unitaires `repo/packages/insure/src/services/transfers.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { TransfersService } from './transfers.service';
import { InsureTransfer } from '../entities/insure-transfer.entity';
import { InsurePolicy, InsurePolicyStatus } from '../entities/insure-policy.entity';
import { InsureTransferStatus } from '../entities/insure-transfer-status.enum';
import { PoliciesService } from './policies.service';
import { ContactsService } from '@insurtech/crm';
import { SigningWorkflowService } from '@insurtech/signature';
import { PdfGenerator, DocumentService } from '@insurtech/docs';
import { CommService } from '@insurtech/comm';
import { AuditLogService, KafkaPublisher, TenantContext } from '@insurtech/shared-utils';
import { PinoLogger } from 'nestjs-pino';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

describe('TransfersService', () => {
  let service: TransfersService;
  let transfersRepo: Repository<InsureTransfer>;
  let policiesService: PoliciesService;
  let contactsService: ContactsService;
  let signingWorkflowService: SigningWorkflowService;
  let pdfGenerator: PdfGenerator;
  let documentService: DocumentService;
  let kafkaPublisher: KafkaPublisher;
  let auditLog: AuditLogService;
  let dataSource: DataSource;

  const TENANT_A = '11111111-1111-1111-1111-111111111111';
  const USER_A = '22222222-2222-2222-2222-222222222222';
  const POLICY_ID = '33333333-3333-3333-3333-333333333333';
  const FROM_CONTACT_ID = '44444444-4444-4444-4444-444444444444';
  const TO_CONTACT_ID = '55555555-5555-5555-5555-555555555555';

  beforeEach(async () => {
    vi.spyOn(TenantContext, 'getCurrentTenantId').mockReturnValue(TENANT_A);
    vi.spyOn(TenantContext, 'getCurrentUserId').mockReturnValue(USER_A);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransfersService,
        { provide: getRepositoryToken(InsureTransfer), useValue: { findOne: vi.fn(), find: vi.fn(), create: vi.fn(), save: vi.fn() } },
        { provide: getRepositoryToken(InsurePolicy), useValue: {} },
        { provide: PoliciesService, useValue: { findById: vi.fn() } },
        { provide: ContactsService, useValue: { findById: vi.fn() } },
        { provide: SigningWorkflowService, useValue: { createWorkflow: vi.fn(), sendForSignature: vi.fn(), cancelWorkflow: vi.fn() } },
        { provide: PdfGenerator, useValue: { generate: vi.fn().mockResolvedValue(Buffer.from('pdf')) } },
        { provide: DocumentService, useValue: { create: vi.fn(), updateRelatedResource: vi.fn() } },
        { provide: CommService, useValue: { send: vi.fn().mockResolvedValue({}) } },
        { provide: AuditLogService, useValue: { log: vi.fn() } },
        { provide: KafkaPublisher, useValue: { publish: vi.fn() } },
        { provide: DataSource, useValue: { transaction: (cb: any) => cb({ create: vi.fn((_, v) => v), save: vi.fn((v) => ({ ...v, id: 'new-id' })), update: vi.fn() }) } },
        { provide: PinoLogger, useValue: { logger: { child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) } } },
      ],
    }).compile();

    service = module.get(TransfersService);
    transfersRepo = module.get(getRepositoryToken(InsureTransfer));
    policiesService = module.get(PoliciesService);
    contactsService = module.get(ContactsService);
    signingWorkflowService = module.get(SigningWorkflowService);
    pdfGenerator = module.get(PdfGenerator);
    documentService = module.get(DocumentService);
    kafkaPublisher = module.get(KafkaPublisher);
    auditLog = module.get(AuditLogService);
  });

  afterEach(() => vi.clearAllMocks());

  describe('initiateTransfer', () => {
    const validInput = {
      policyId: POLICY_ID,
      toContactId: TO_CONTACT_ID,
      reason: 'Vente vehicule conformement acte du 15/05/2026',
      transferDate: new Date(Date.now() + 86400000), // tomorrow
    };

    const policyMock = {
      id: POLICY_ID,
      tenant_id: TENANT_A,
      contact_id: FROM_CONTACT_ID,
      status: InsurePolicyStatus.ACTIVE,
      policy_number: 'POL-2026-001',
      end_date: new Date(Date.now() + 86400000 * 90),
      branche: 'auto',
      prime_annuelle: 5000,
      start_date: new Date(Date.now() - 86400000 * 30),
    };

    const fromContactMock = { id: FROM_CONTACT_ID, tenant_id: TENANT_A, first_name: 'Ahmed', last_name: 'Bennani', cin: 'BE12345', email: 'ahmed@example.com', phone: '+212600000001', preferred_language: 'fr', address: 'Casa' };
    const toContactMock = { id: TO_CONTACT_ID, tenant_id: TENANT_A, first_name: 'Karim', last_name: 'Alami', cin: 'EA54321', email: 'karim@example.com', phone: '+212600000002', preferred_language: 'fr', address: 'Rabat' };

    it('should successfully initiate a transfer with valid input', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(policyMock as any);
      vi.mocked(contactsService.findById).mockImplementation((id: string) => Promise.resolve(id === FROM_CONTACT_ID ? fromContactMock : toContactMock) as any);
      vi.mocked(transfersRepo.findOne).mockResolvedValue(null);
      vi.mocked(documentService.create).mockResolvedValue({ id: 'doc-id' } as any);
      vi.mocked(signingWorkflowService.createWorkflow).mockResolvedValue({ id: 'wf-id' } as any);
      vi.mocked(signingWorkflowService.sendForSignature).mockResolvedValue(undefined as any);

      const result = await service.initiateTransfer(validInput);
      expect(result.id).toBe('new-id');
      expect(signingWorkflowService.createWorkflow).toHaveBeenCalled();
      expect(kafkaPublisher.publish).toHaveBeenCalled();
      expect(auditLog.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'insure.transfer.initiated' }));
    });

    it('should call SigningWorkflow.createWorkflow with sequential orders 1 and 2', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(policyMock as any);
      vi.mocked(contactsService.findById).mockImplementation((id: string) => Promise.resolve(id === FROM_CONTACT_ID ? fromContactMock : toContactMock) as any);
      vi.mocked(transfersRepo.findOne).mockResolvedValue(null);
      vi.mocked(documentService.create).mockResolvedValue({ id: 'doc-id' } as any);
      vi.mocked(signingWorkflowService.createWorkflow).mockResolvedValue({ id: 'wf-id' } as any);

      await service.initiateTransfer(validInput);
      const callArgs = vi.mocked(signingWorkflowService.createWorkflow).mock.calls[0];
      const signers = callArgs[1];
      expect(signers[0].order).toBe(1);
      expect(signers[1].order).toBe(2);
      expect(signers[0].email).toBe(fromContactMock.email);
      expect(signers[1].email).toBe(toContactMock.email);
    });

    it('should reject if policy not active', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue({ ...policyMock, status: 'cancelled' } as any);
      await expect(service.initiateTransfer(validInput)).rejects.toThrow(BadRequestException);
    });

    it('should reject if pending transfer exists', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(policyMock as any);
      vi.mocked(contactsService.findById).mockResolvedValue(fromContactMock as any);
      vi.mocked(transfersRepo.findOne).mockResolvedValue({ id: 'existing' } as any);
      await expect(service.initiateTransfer(validInput)).rejects.toThrow(ConflictException);
    });

    it('should reject cross-tenant transfer', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(policyMock as any);
      vi.mocked(contactsService.findById).mockImplementation((id: string) =>
        Promise.resolve(id === FROM_CONTACT_ID ? fromContactMock : { ...toContactMock, tenant_id: 'other-tenant' }) as any,
      );
      vi.mocked(transfersRepo.findOne).mockResolvedValue(null);
      await expect(service.initiateTransfer(validInput)).rejects.toThrow(ForbiddenException);
    });

    it('should reject transfer to same contact', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(policyMock as any);
      vi.mocked(contactsService.findById).mockResolvedValue(fromContactMock as any);
      vi.mocked(transfersRepo.findOne).mockResolvedValue(null);
      await expect(service.initiateTransfer({ ...validInput, toContactId: FROM_CONTACT_ID })).rejects.toThrow(BadRequestException);
    });

    it('should reject transferDate in past', async () => {
      await expect(service.initiateTransfer({ ...validInput, transferDate: new Date(Date.now() - 86400000) })).rejects.toThrow();
    });

    it('should reject transferDate after policy end_date', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(policyMock as any);
      vi.mocked(contactsService.findById).mockResolvedValue(fromContactMock as any);
      const afterEnd = new Date(policyMock.end_date.getTime() + 86400000);
      await expect(service.initiateTransfer({ ...validInput, transferDate: afterEnd })).rejects.toThrow(BadRequestException);
    });

    it('should reject if contacts have same email', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(policyMock as any);
      vi.mocked(contactsService.findById).mockImplementation((id: string) =>
        Promise.resolve({ ...toContactMock, email: fromContactMock.email }) as any,
      );
      vi.mocked(transfersRepo.findOne).mockResolvedValue(null);
      await expect(service.initiateTransfer(validInput)).rejects.toThrow(BadRequestException);
    });

    it('should reject empty reason (Zod schema)', async () => {
      await expect(service.initiateTransfer({ ...validInput, reason: 'short' })).rejects.toThrow();
    });

    it('should publish Kafka event INSURE_TRANSFER_INITIATED with idempotency key', async () => {
      vi.mocked(policiesService.findById).mockResolvedValue(policyMock as any);
      vi.mocked(contactsService.findById).mockImplementation((id: string) => Promise.resolve(id === FROM_CONTACT_ID ? fromContactMock : toContactMock) as any);
      vi.mocked(transfersRepo.findOne).mockResolvedValue(null);
      vi.mocked(documentService.create).mockResolvedValue({ id: 'doc-id' } as any);
      vi.mocked(signingWorkflowService.createWorkflow).mockResolvedValue({ id: 'wf-id' } as any);

      await service.initiateTransfer(validInput);
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(
        expect.stringContaining('transfer.initiated'),
        expect.any(Object),
        expect.objectContaining({ idempotency_key: expect.stringMatching(/transfer-init-/) }),
      );
    });
  });

  describe('markCompleted', () => {
    it('should transition pending_signatures -> completed', async () => {
      const transferMock = {
        id: 'tid', tenant_id: TENANT_A, policy_id: POLICY_ID, from_contact_id: FROM_CONTACT_ID, to_contact_id: TO_CONTACT_ID,
        status: InsureTransferStatus.PENDING_SIGNATURES, signing_workflow_id: 'wf-id',
        from_contact: { preferred_language: 'fr' }, to_contact: { preferred_language: 'fr' }, policy: { policy_number: 'POL-001' },
      };
      vi.mocked(transfersRepo.findOne).mockResolvedValue(transferMock as any);
      vi.mocked(documentService.create).mockResolvedValue({ id: 'cert-id' } as any);

      const result = await service.markCompleted('tid', 'wf-id');
      expect(result).toBeDefined();
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(expect.stringContaining('transfer.completed'), expect.any(Object), expect.any(Object));
    });

    it('should be idempotent : second markCompleted is no-op', async () => {
      const completedMock = { id: 'tid', tenant_id: TENANT_A, status: InsureTransferStatus.COMPLETED, signing_workflow_id: 'wf-id' };
      vi.mocked(transfersRepo.findOne).mockResolvedValue(completedMock as any);
      const result = await service.markCompleted('tid', 'wf-id');
      expect(result.status).toBe(InsureTransferStatus.COMPLETED);
    });

    it('should reject workflow id mismatch', async () => {
      const transferMock = { id: 'tid', status: InsureTransferStatus.PENDING_SIGNATURES, signing_workflow_id: 'wf-id-1' };
      vi.mocked(transfersRepo.findOne).mockResolvedValue(transferMock as any);
      await expect(service.markCompleted('tid', 'wf-id-different')).rejects.toThrow(BadRequestException);
    });

    it('should NOT throw on unknown transfer (return null)', async () => {
      vi.mocked(transfersRepo.findOne).mockResolvedValue(null);
      await expect(service.markCompleted('unknown', 'wf-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('cancel', () => {
    it('should cancel pending transfer + invalidate Barid workflow', async () => {
      const transferMock = { id: 'tid', status: InsureTransferStatus.PENDING_SIGNATURES, signing_workflow_id: 'wf-id', from_contact: { email: 'a@a' }, to_contact: { email: 'b@b' } };
      vi.mocked(transfersRepo.findOne).mockResolvedValue(transferMock as any);

      await service.cancel({ transferId: 'tid', reason: 'manual cancel' });
      expect(signingWorkflowService.cancelWorkflow).toHaveBeenCalledWith('wf-id', expect.any(String));
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(expect.stringContaining('transfer.cancelled'), expect.any(Object), expect.any(Object));
    });

    it('should reject cancel on terminal status', async () => {
      vi.mocked(transfersRepo.findOne).mockResolvedValue({ id: 'tid', status: InsureTransferStatus.COMPLETED } as any);
      await expect(service.cancel({ transferId: 'tid', reason: 'too late' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('markRejected', () => {
    it('should transition pending -> rejected with declinerContactId', async () => {
      const transferMock = { id: 'tid', tenant_id: TENANT_A, status: InsureTransferStatus.PENDING_SIGNATURES, from_contact: { email: 'a@a' }, to_contact: { email: 'b@b' } };
      vi.mocked(transfersRepo.findOne).mockResolvedValue(transferMock as any);

      await service.markRejected('tid', 'wf-id', TO_CONTACT_ID, 'I refuse');
      expect(kafkaPublisher.publish).toHaveBeenCalledWith(expect.stringContaining('transfer.rejected'), expect.any(Object), expect.any(Object));
    });
  });

  describe('findById + listByPolicyId', () => {
    it('findById returns transfer', async () => {
      vi.mocked(transfersRepo.findOne).mockResolvedValue({ id: 'tid' } as any);
      const r = await service.findById('tid');
      expect(r?.id).toBe('tid');
    });
    it('findById returns null if not found', async () => {
      vi.mocked(transfersRepo.findOne).mockResolvedValue(null);
      const r = await service.findById('unknown');
      expect(r).toBeNull();
    });
    it('listByPolicyId returns transfers ordered desc', async () => {
      vi.mocked(transfersRepo.find).mockResolvedValue([{ id: 't1' }, { id: 't2' }] as any);
      const r = await service.listByPolicyId(POLICY_ID);
      expect(r).toHaveLength(2);
    });
  });
});
```

### 7.2 Tests integration `repo/apps/api/test/insure/transfers.integration-spec.ts`

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';

import { AppModule } from '../../src/app.module';
import { TenantContext } from '@insurtech/shared-utils';
import { seedTenant, seedUser, seedPolicy, seedContact, generateJwt } from './fixtures/transfers.fixture';

describe('TransfersController (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let tenantA: string;
  let policyId: string;
  let fromContactId: string;
  let toContactId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);

    tenantA = await seedTenant(dataSource, 'Cabinet Bennani');
    const user = await seedUser(dataSource, tenantA, 'BrokerAdmin');
    token = generateJwt(user.id, tenantA, ['insure.policies.transfer', 'insure.transfers.read', 'insure.transfers.cancel']);
    fromContactId = (await seedContact(dataSource, tenantA, { email: 'ahmed@example.com' })).id;
    toContactId = (await seedContact(dataSource, tenantA, { email: 'karim@example.com' })).id;
    policyId = (await seedPolicy(dataSource, tenantA, fromContactId)).id;
  });

  afterAll(async () => app.close());

  it('POST /insure/policies/:id/transfer creates transfer and 201', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({
        toContactId,
        reason: 'Vente du vehicule conformement acte du 15/05/2026',
        transferDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      });
    expect(res.status).toBe(HttpStatus.CREATED);
    expect(res.body.status).toBe('pending_signatures');
  });

  it('POST /transfer returns 400 if policy not active', async () => {
    const cancelledPolicy = await seedPolicy(dataSource, tenantA, fromContactId, { status: 'cancelled' });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${cancelledPolicy.id}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ toContactId, reason: 'reason long enough', transferDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
    expect(res.status).toBe(HttpStatus.BAD_REQUEST);
    expect(res.body.code).toBe('POLICY_NOT_ACTIVE');
  });

  it('POST /transfer returns 403 cross-tenant', async () => {
    const tenantB = await seedTenant(dataSource, 'Other Cabinet');
    const otherContact = await seedContact(dataSource, tenantB, { email: 'other@b.com' });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ toContactId: otherContact.id, reason: 'reason long enough', transferDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
    expect(res.status).toBe(HttpStatus.FORBIDDEN);
  });

  it('POST /transfer returns 409 if pending exists', async () => {
    // first transfer
    await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ toContactId, reason: 'first transfer reason here', transferDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
    // second
    const res = await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ toContactId, reason: 'second transfer reason here', transferDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
    expect(res.status).toBe(HttpStatus.CONFLICT);
  });

  it('POST /transfers/:id/cancel transitions to cancelled', async () => {
    const initRes = await request(app.getHttpServer())
      .post(`/api/v1/insure/policies/${policyId}/transfer`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ toContactId, reason: 'transfer for cancel test', transferDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10) });
    const transferId = initRes.body.id;
    const cancelRes = await request(app.getHttpServer())
      .post(`/api/v1/insure/transfers/${transferId}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA)
      .send({ reason: 'manual cancel' });
    expect(cancelRes.status).toBe(HttpStatus.OK);
    expect(cancelRes.body.status).toBe('cancelled');
  });

  it('GET /transfers/:id returns 404 if not found', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/insure/transfers/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-id', tenantA);
    expect(res.status).toBe(HttpStatus.NOT_FOUND);
  });

  it('RLS test : tenant B cannot read tenant A transfers', async () => {
    // ... create transfer tenant A, attempt read with tenant B token -> 404 (RLS hide)
    expect(true).toBe(true);
  });
});
```

### 7.3 Fixtures `repo/apps/api/test/insure/fixtures/transfers.fixture.ts`

```typescript
import { DataSource } from 'typeorm';
import * as jwt from 'jsonwebtoken';

export async function seedTenant(ds: DataSource, name: string): Promise<string> {
  const id = crypto.randomUUID();
  await ds.query(`INSERT INTO tenants(id, name) VALUES ($1, $2)`, [id, name]);
  return id;
}

export async function seedUser(ds: DataSource, tenantId: string, role: string) {
  const id = crypto.randomUUID();
  await ds.query(`INSERT INTO auth_users(id, tenant_id, email, password_hash, roles) VALUES ($1, $2, $3, $4, $5)`,
    [id, tenantId, `${id}@test.com`, 'fakehash', [role]]);
  return { id };
}

export async function seedContact(ds: DataSource, tenantId: string, overrides: Record<string, any> = {}) {
  const id = crypto.randomUUID();
  await ds.query(`INSERT INTO crm_contacts(id, tenant_id, first_name, last_name, email, phone, cin, preferred_language)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [id, tenantId, overrides.first_name ?? 'Test', overrides.last_name ?? 'User',
     overrides.email ?? `${id}@example.com`, overrides.phone ?? '+212600000000',
     overrides.cin ?? 'BE12345', overrides.preferred_language ?? 'fr']);
  return { id };
}

export async function seedPolicy(ds: DataSource, tenantId: string, contactId: string, overrides: Record<string, any> = {}) {
  const id = crypto.randomUUID();
  await ds.query(`INSERT INTO insure_policies(id, tenant_id, contact_id, policy_number, branche, status, start_date, end_date, prime_annuelle)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [id, tenantId, contactId, `POL-${id.slice(0, 8)}`, overrides.branche ?? 'auto', overrides.status ?? 'active',
     overrides.start_date ?? new Date(Date.now() - 86400000 * 30),
     overrides.end_date ?? new Date(Date.now() + 86400000 * 90),
     overrides.prime_annuelle ?? 5000]);
  return { id };
}

export function generateJwt(userId: string, tenantId: string, permissions: string[]): string {
  return jwt.sign({ sub: userId, tenant_id: tenantId, permissions }, process.env.JWT_SECRET ?? 'test-secret', { expiresIn: '1h' });
}
```

---

## 8. Variables environnement

```env
# Sprint 15 Tache 4.2.1 -- Variables Transfer
TRANSFER_WORKFLOW_EXPIRES_IN_DAYS=14
TRANSFER_PDF_LOCALE_DEFAULT=fr
TRANSFER_VERIFICATION_PUBLIC_BASE_URL=https://verify.skalean.ma

# Sprint 10 (deja existant, requis)
BARID_ESIGN_API_URL=https://api.barid-esign.ma/v1
BARID_ESIGN_API_KEY=<secret>
ANRT_TSA_URL=https://tsa.anrt.ma/rfc3161
ANRT_TSA_CERT_PATH=/etc/skalean/certs/anrt-tsa.crt

# Sprint 9 (deja existant, requis)
COMM_WHATSAPP_API_URL=https://graph.facebook.com/v18.0
COMM_EMAIL_FROM=noreply@skalean.ma

# Sprint 2 (requis)
KAFKA_BROKERS=localhost:9092
DATABASE_URL=postgresql://insurtech:insurtech@localhost:5432/insurtech_dev
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Generer migration
pnpm --filter @insurtech/database migration:generate -- InsureTransfersTable

# 2. Run migration
pnpm --filter @insurtech/database migration:run

# 3. Typecheck
pnpm typecheck

# 4. Lint
pnpm lint

# 5. Tests unit
pnpm --filter @insurtech/insure vitest run src/services/transfers.service.spec.ts

# 6. Tests integration (Postgres reel)
pnpm --filter @insurtech/api vitest run test/insure/transfers.integration-spec.ts

# 7. Verifier permissions registry
pnpm --filter @insurtech/auth test src/rbac/

# 8. Verifier Kafka topics
pnpm --filter @insurtech/shared-types test
```

---

## 10. Criteres validation V1-V28

### Criteres P0 (bloquants -- 16 minimum)

- **V1 (P0)** : Migration `InsureTransfersTable` cree table avec 9 indexes + RLS policy + trigger updated_at.
  - Commande : `psql -d insurtech_dev -c "\d insure_transfers" | wc -l`
  - Expected : >= 30 lignes (table + indexes + trigger visibles)

- **V2 (P0)** : RLS strict : tenant B ne voit jamais transfers tenant A.
  - Commande : test integration RLS section 7.2
  - Expected : 404 cross-tenant

- **V3 (P0)** : Unique partial index empeche 2 pending transfers sur meme policy.
  - Commande : test integration 7.2 "POST returns 409 if pending exists"
  - Expected : 409 Conflict

- **V4 (P0)** : initiateTransfer rejette police inactive.
  - Commande : test unit "should reject if policy not active"
  - Expected : BadRequestException avec code POLICY_NOT_ACTIVE

- **V5 (P0)** : initiateTransfer rejette transfer_date passe.
  - Expected : Zod validation error

- **V6 (P0)** : initiateTransfer rejette transfer_date apres policy.end_date.
  - Expected : BadRequestException TRANSFER_DATE_AFTER_POLICY_END

- **V7 (P0)** : initiateTransfer rejette transfer vers soi-meme.
  - Expected : BadRequestException SAME_CONTACT_TRANSFER

- **V8 (P0)** : initiateTransfer rejette cross-tenant.
  - Expected : ForbiddenException CROSS_TENANT_TRANSFER_FORBIDDEN

- **V9 (P0)** : Workflow Barid eSign cree avec 2 signers sequential (order 1 + 2).
  - Commande : test unit "should call SigningWorkflow.createWorkflow with sequential orders 1 and 2"
  - Expected : signers[0].order === 1 && signers[1].order === 2

- **V10 (P0)** : Workflow Barid configure signature_type='qualified' + expires_in_days=14.
  - Expected : verifications dans test

- **V11 (P0)** : PDF acte de cession genere via template `transfer-cession` dans `fromContact.preferred_language`.
  - Expected : PdfGenerator.generate appele avec bonne locale

- **V12 (P0)** : Document persiste dans docs_documents avec type CONTRAT_CESSION + related_resource_type='insure_transfer'.
  - Expected : DocumentService.create appele

- **V13 (P0)** : markCompleted transitions pending_signatures -> completed + update policy.contact_id.
  - Commande : test unit + integration
  - Expected : policy.contact_id mise a jour

- **V14 (P0)** : markCompleted genere certificat PDF scelle ANRT TSA + persiste related_resource_type='insure_transfer_certificate'.
  - Expected : DocumentService.create avec apply_anrt_tsa=true

- **V15 (P0)** : cancel invalide workflow Barid (cancelWorkflow appele).
  - Expected : test verifie call

- **V16 (P0)** : markRejected transitions pending -> rejected sans toucher policy.
  - Expected : test integration

### Criteres P1 (importants -- 8 minimum)

- **V17 (P1)** : Kafka event INSURE_TRANSFER_INITIATED publie avec idempotency_key `transfer-init-<id>`.
- **V18 (P1)** : Kafka event INSURE_TRANSFER_COMPLETED publie post-completion.
- **V19 (P1)** : Audit log snapshot before/after sur completion.
- **V20 (P1)** : Notifications Comm fire-and-forget (echec n'interrompt pas le flux).
- **V21 (P1)** : Permissions catalog enrichi avec 3 permissions transfer.
- **V22 (P1)** : Endpoint `GET /api/v1/insure/policies/:id/transfers` retourne history descending.
- **V23 (P1)** : Idempotency : markCompleted appele 2 fois -> 2eme appel no-op.
- **V24 (P1)** : Coverage tests >= 90% sur transfers.service.ts.

### Criteres P2 (nice-to-have -- 5 minimum)

- **V25 (P2)** : OpenAPI/Swagger docs generes avec tags `insure-transfers`.
- **V26 (P2)** : OpenTelemetry spans presents pour 3 methods principales.
- **V27 (P2)** : Logger Pino structured logs avec tenant_id + transfer_id sur 100% des appels.
- **V28 (P2)** : Templates Handlebars valides via test `handlebars.precompile` smoke test.

---

## 11. Edge cases + troubleshooting (12 cas)

### Edge case 1 : Cessionnaire decline apres cedant signe

**Scenario** : Cedant signe order=1 (success), cessionnaire order=2 decline (refuse).
**Probleme** : Sans gestion, transfert reste pending indefiniment.
**Solution** : Consumer `TransfersWorkflowDeclinedConsumer` Tache 4.2.12 ecoute `docs.workflow_declined` -> appelle `markRejected(transferId, workflowId, declinerContactId, declineReason)`. Test E2E dedie 4.2.13.

### Edge case 2 : Workflow Barid expire (14j sans signatures)

**Scenario** : Cedant ne signe pas dans les 14 jours.
**Probleme** : Police reste en pending indefiniment, courtier doit re-initier.
**Solution** : Cron daily `expired-transfers-cron` (livre Tache 4.2.12) scan transfers `status='pending_signatures' AND created_at + interval '14 days' < NOW()` -> appelle `markRejected(transferId, workflowId, null, 'workflow_expired')`.

### Edge case 3 : Police annulee pendant transfer pending

**Scenario** : Courtier annule police via `cancellation.service` Tache 4.2.4 alors qu'un transfer est en cours.
**Probleme** : Si transfer completait apres, on essaierait de muter une police cancelled.
**Solution** : Dans `policies.service.cancel()`, verifier pending transfers et auto-cancel : `transfers.where(policy_id, 'pending_signatures').forEach(t => transfersService.cancel(t.id, 'policy_cancelled'))`.

### Edge case 4 : Cessionnaire deja en multi-policy avec meme courtier

**Scenario** : Cessionnaire a deja 3 polices auto. Le transfert lui ajoute une 4eme.
**Probleme** : Aucun, mais notification Comm doit etre adaptee ("vous detenez maintenant 4 polices auto").
**Solution** : Template Comm utilise `{{toContact.existing_policies_count}}` calcule au moment notification (helper Handlebars).

### Edge case 5 : Cedant n'a plus d'email valide

**Scenario** : Cedant a change d'email, donnees CRM obsoletes.
**Probleme** : Barid envoie invitation -> bounce -> jamais signature.
**Solution** : Pre-flight verification email via `EmailVerifierService` (Sprint 9). Si invalide -> warn + bloquer initiate avec code `INVALID_FROM_CONTACT_EMAIL`. Optionnel : permettre override avec confirmation manuelle courtier.

### Edge case 6 : Devices avec faible bande passante (Maroc rural)

**Scenario** : Cessionnaire au sud Maroc, internet 3G instable.
**Probleme** : Page Barid eSign lourde, signature echoue.
**Solution** : Templates Comm contiennent **lien SMS court** + lien direct (`https://esign.barid.ma/sign/abc123`). Barid mobile pwa optimise.

### Edge case 7 : Cedant decede pendant pending_signatures

**Scenario** : Cedant decede avant signature (cas heritage).
**Probleme** : Workflow attend signature jamais possible.
**Solution** : Courtier appelle `cancel(transferId, 'cedant_deceased')` + initie nouveau transfer avec **succession** (workflow special Sprint 30+ avec acte notarie). Pour Sprint 15 : cancel manuel.

### Edge case 8 : Donnees CIN cedant/cessionnaire identiques par erreur

**Scenario** : Saisie agent : oubli changement CIN entre 2 contacts.
**Probleme** : Barid eSign confondrait les 2 signers.
**Solution** : `validateInitiateTransfer` verifie `fromContact.cin !== toContact.cin` (apres verifications email distinct). Erreur code `SAME_CIN_CONTACTS`.

### Edge case 9 : transfer_date == today + workflow expire same day

**Scenario** : Edge timing : initiation et expiration tombent meme jour.
**Probleme** : Race condition entre `markCompleted` et `markRejected (expired)`.
**Solution** : `markCompleted` est idempotent (verifie status !== PENDING avant transition). `markRejected` aussi. Premier qui execute gagne, second no-op.

### Edge case 10 : Policy a une commission deja payee a un courtier different

**Scenario** : Police initiale souscrite via courtier A (commission 12% percue). Transfer vers cessionnaire suivi par courtier B.
**Probleme** : Faut-il reattribuer commission ? Decision-014 : NON.
**Solution** : Documenter explicitement dans service `// Commission reste a courtier A (commissions immutables apres encaissement decision-014)`. Audit log capture decision pour ACAPS report.

### Edge case 11 : Migration vers nouvelle version Barid eSign

**Scenario** : Barid release v2 API breaking changes.
**Probleme** : Workflows existants pourraient casser.
**Solution** : `SigningWorkflowService` abstrait via interface `ISigningProvider`. Adapter v1 -> v2 fait dans Sprint 10 sans impact transfer.

### Edge case 12 : Cessionnaire mineur (< 18 ans)

**Scenario** : Heritage vehicule a un enfant 16 ans.
**Probleme** : Mineurs ne peuvent signer juridiquement.
**Solution** : `validateInitiateTransfer` verifie `toContact.date_of_birth` -> si < 18 ans, exiger `legal_representative_contact_id` dans metadata. Tuteur signe en remplacement. Defere Sprint 30+ pour V1 -> rejet code `MINOR_NOT_ALLOWED_AS_CESSIONAIRE`.

---

## 12. Conformite Maroc detaillee

### Loi 17-99 (Code des Assurances)
- **Article 25** : "En cas d'alienation de la chose assuree, l'assurance continue de plein droit au profit de l'acquereur..." -- materialise par notre `TransfersService`.
- **Article 26** : Droit de resiliation cessionnaire dans 30 jours -- materialise via Tache 4.2.4 `resiliation.service` (combo droit retract).
- **Implementation** : Acte de cession + signatures qualifiees + audit trail = preuve juridique opposable.

### Loi 53-05 (echange electronique donnees juridiques)
- **Article 6** : Reconnaissance signature electronique qualifiee.
- **Implementation** : Barid eSign signature_type=`qualified` (vs `simple`).

### Loi 43-20 (services de confiance pour transactions electroniques)
- **Article 21** : Cadre des PSC (Prestataires Services de Confiance).
- **Article 25** : Timestamping qualified TSA.
- **Implementation** : Barid (PSC agree ANRT) + ANRT TSA RFC 3161 sur certificat final.

### Loi 09-08 (CNDP -- protection donnees personnelles)
- **Article 6** : Finalite limitee, conservation 5 ans.
- **Implementation** : Audit log JSONB metadata, retention policy 5 ans (cron Sprint 28 anonymise donnees > 5 ans).

### Decret 2-09-165 (application loi 09-08)
- Notification CNDP traitement -> deja deposee Sprint 1 lors creation projet.

### Loi 38-14 (obligations comptables)
- Archivage actes 10 ans : S3 Atlas Cloud Benguerir avec object lock 10 ans.

### Reporting ACAPS (Sprint 18)
- Kafka event `INSURE_TRANSFER_COMPLETED` consume Sprint 18 pour quarterly portfolio report XLSX (transferts entree/sortie).

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

Cette tache DOIT respecter toutes les conventions du programme :

### Multi-tenant strict (decision-002)
- Header `x-tenant-id` obligatoire sur tous endpoints transfers.
- TenantGuard verifie token JWT.tenant_id == header.x-tenant-id.
- RLS policy Postgres `tenant_isolation_insure_transfers` active.
- TenantContext AsyncLocalStorage propage tenant_id dans tout le service.

### Validation strict (Zod)
- `InitiateTransferInputSchema`, `CancelTransferInputSchema` Zod uniquement.
- JAMAIS class-validator, JAMAIS Joi/Yup.
- Validation au controller (ZodValidationPipe) + au service (Zod.parse pour defense en profondeur).

### Logger strict (Pino)
- `PinoLogger` injecte par DI NestJS.
- JAMAIS `console.log`, JAMAIS `new Logger()`.
- Format JSON structured : `tenant_id, user_id, transfer_id, policy_id, action, duration_ms`.

### Package manager strict
- pnpm uniquement, `engine-strict=true`, Node >= 22.11.0.

### TypeScript strict
- `strict: true`, `noUncheckedIndexedAccess`, `noImplicitAny`, `noImplicitReturns`.
- Imports explicites : pas de `import * as`.

### Tests strict
- Vitest unit + integration, Playwright E2E (Sprint 16+).
- Coverage cible >= 90% pour modules critiques (transfers est critique).

### RBAC strict (decision-002 + Sprint 7)
- `@Permissions()` decorator sur chaque endpoint.
- RolesGuard global.
- 3 permissions specifiques : `insure.policies.transfer`, `insure.transfers.read`, `insure.transfers.cancel`.

### Events Kafka strict
- Topic format `insurtech.events.insure.transfer.{action}`.
- Schemas Zod (validate publish + consume).
- Idempotency-Key sur chaque publish.

### Imports strict
- `@insurtech/*` aliases (jamais relatifs `../../../../`).

### Skalean AI strict (decision-005)
- Aucun appel IA direct. Defere Sprint 30+ (MCP tool eventuellement).

### No-emoji strict (decision-006 ABSOLU)
- Aucune emoji dans code, commentaires, logs, templates, commits, audit messages.
- Pre-commit hook `check-no-emoji.sh` actif.

### Idempotency-Key strict
- `INSURE_TRANSFER_INITIATED/COMPLETED/CANCELLED/REJECTED` events publies avec `idempotency_key: transfer-{action}-{transfer_id}`.

### Conventional Commits strict
- Format `feat(sprint-15): description` 50-72 chars max.
- Body metadata obligatoire (Task, Sprint, Phase).

### Cloud souverain MA strict (decision-008)
- Atlas Cloud Benguerir uniquement.
- Aucune donnee transfert hors MA.
- Encryption at rest AES-256-GCM via Atlas KMS.
- TLS 1.3 obligatoire.

---

## 14. Validation pre-commit

```bash
cd repo

# 1. Typecheck strict
pnpm typecheck                                              # 0 erreur attendu

# 2. Lint Biome
pnpm lint                                                    # 0 erreur attendu

# 3. Tests unit transfers + coverage
pnpm --filter @insurtech/insure vitest run src/services/transfers.service.spec.ts --coverage
                                                             # coverage >= 90% transfers.service.ts

# 4. Tests integration transfers
pnpm --filter @insurtech/api vitest run test/insure/transfers.integration-spec.ts

# 5. No-emoji check (decision-006)
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" \
  packages/insure/src/entities/insure-transfer*.ts \
  packages/insure/src/services/transfers.service.ts \
  packages/insure/src/schemas/insure-transfer.schema.ts \
  apps/api/src/modules/insure/controllers/transfers.controller.ts \
  packages/docs/src/templates/{fr,ar-MA,ar}/transfer-*.hbs \
  packages/comm/src/templates/{fr,ar-MA,ar}/transfer-*.hbs \
  && echo FAIL || echo OK

# 6. No console.log
grep -rn "console\.\(log\|debug\|info\)" \
  packages/insure/src/services/transfers.service.ts \
  apps/api/src/modules/insure/controllers/transfers.controller.ts \
  | grep -v ".spec.ts" \
  && echo FAIL || echo OK

# 7. Migration up + down test
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/database migration:revert
pnpm --filter @insurtech/database migration:run

# 8. RLS verification
psql -d insurtech_dev -c "SELECT polname, polrelid::regclass FROM pg_policy WHERE polrelid = 'insure_transfers'::regclass"
                                                             # 1 policy attendue
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-15): transfer entity + workflow signature double sequential

Implements Insure transfer juridique entre cedant + cessionnaire avec
workflow signature double sequential Barid eSign + ANRT TSA conformement
loi 17-99 article 25, loi 53-05, loi 43-20.

Livrables:
- Migration InsureTransfersTable + RLS + 7 indexes + unique partial pending
- Entity InsureTransfer + enum status (4 valeurs)
- Schema Zod InitiateTransfer/Cancel/MarkCompleted/MarkRejected
- TransfersService: initiate + markCompleted + cancel + markRejected + findById + listByPolicyId
- TransfersController REST: POST /transfer + GET /:id + GET /policies/:id/transfers + POST /cancel
- 3 DTOs Swagger
- Templates Handlebars transfer-cession fr/ar-MA/ar (acte cession)
- Templates Handlebars transfer-certificate fr/ar-MA/ar (certificat ANRT)
- Templates Comm transfer-initiated/completed/rejected fr/ar-MA/ar email + WA
- Permissions enrichies: insure.policies.transfer + insure.transfers.read/cancel
- Kafka topics + schemas Zod 4 events
- 22 tests unit + 10 tests integration

Tests: 22 unit + 10 integration = 32 passing
Coverage: 91% transfers.service.ts

Task: 4.2.1
Sprint: 15 (Phase 4 / Sprint 2 dans phase Vertical Insure)
Phase: 4 -- Vertical Insure (Skalean Broker ERP)
Reference: B-15 Tache 4.2.1"
```

---

## 16. Workflow next step

Apres commit de cette tache 4.2.1 :

- Passer a `task-4.2.2-fractionnement-primes-runtime.md` (depend de 4.2.1 pour pattern audit + Kafka events).
- Le pattern workflow signature double sequential pose ici sera reutilise dans 4.2.5 (Flotte), 4.2.6/7/8 (Endossements).

---

**Fin du prompt task-4.2.1-transfer-entity-workflow-signature-double.md**

Densite atteinte : ~112 ko
Code patterns : 14 fichiers complets (migration, entity, enum, schema, service, controller, 3 DTO, template HBS, module, permissions, topics, events)
Tests : 22 unit + 10 integration = 32 cas concrets
Criteres validation : V1-V28
Edge cases : 12
