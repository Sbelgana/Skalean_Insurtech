# TACHE 3.2.5 -- Template Manager + 80 Templates Seed (4 locales fr / ar-MA / ar / en)

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.5)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.6 Email SMTP DKIM/Mailgun, 3.2.7 Email template renderer RTL, 3.2.8 BullMQ wa-send + email-send workers, 3.2.9 message orchestrator, 3.2.13 tests E2E 40+, et tous les flows utilisateur communications transactionnelles WhatsApp + Email)
**Effort** : 6h
**Dependances** : 3.2.4 (WA webhook receiver + signature HMAC), 3.2.3 (WaTemplateRendererService + cache Redis 5min + fallback locale cascade), 3.2.2 (WhatsAppCloudApiClient Meta v21.0), 3.2.1 (comm_messages entity + Zod schemas), Sprint 2 (`comm_templates` table avec colonnes `id`, `tenant_id`, `name`, `language`, `body_template`, `header_template`, `footer_template`, `buttons`, `variables_schema` jsonb, `meta_template_id`, `meta_template_status`, `category`, `created_at`, `updated_at`, `submitted_at`, `approved_at`, `rejected_reason`, `is_active`), Sprint 3 (RedisService + KafkaProducer + KafkaConsumerBase), Sprint 5 (RBAC PermissionsGuard + RequirePermission decorator), Sprint 6 (TenantContextService getCurrentTenantId)
**Densite cible** : 125-145 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `TemplateManagerService` complet et operationnel du programme Skalean InsurTech v2.2 qui implemente l'integralite de la couche CRUD + workflow Meta approval des templates de communication (WhatsApp + Email) conforme aux exigences UX multi-locale Maroc (4 locales `fr` francophones marocains et diaspora, `ar-MA` arabophones darija familier, `ar` arabe classique formel pour institutions et autorites de tutelle ACAPS, `en` anglais international pour partenaires etrangers et courtiers expatries), conforme aux exigences strictes Meta Cloud API v21.0 qui impose des templates pre-approved avec validation longueur stricte (body 1024 chars max, header 60 chars max, footer sans variables, max 10 buttons, language_code mappe via `ar-MA -> ar` car Meta n'a pas de variant darija), conforme aux exigences workflow approval (`draft -> pending_review -> approved | rejected` avec submission via `POST /{whatsapp_business_account_id}/message_templates` Meta Graph API + reception status update via webhook `account_alerts` Tache 3.2.4), conforme aux exigences seed initial 80 templates pre-ecrits couvrant 20 cas d'usage critiques modules Auth (5), Booking (3), Insure (5), Repair (4), Tenant (3) = 20 templates x 4 locales = 80 templates au total dans le repository git pour boot rapide d'un nouveau tenant Sprint 27 admin onboarding, conforme aux exigences conformite marketing direct ANRT loi 24-09 (footer doit contenir lien opt-out obligatoire) et CNDP loi 09-08 (variables PII `user_name`, `montant`, `phone` loggees uniquement en hash SHA-256 pas en clair). Le perimetre couvre : un service NestJS `@Injectable() TemplateManagerService` qui expose 9 methods principales (`create(input)` insert un nouveau template draft avec validation Zod + check unicite `(tenant_id, name, locale)` + audit log, `findById(id)` lookup tenant-scoped avec exception NotFoundException si pas dans tenant courant, `findByName(tenantId, name, locale)` resolve avec fallback cascade `ar-MA -> ar -> fr -> en` via `LocaleFallbackHelper` Tache 3.2.3, `update(id, patch)` partial update avec re-validation Zod + re-set `meta_template_status = 'draft'` si content modifie + audit log + Kafka event `comm.template_updated` pour invalidation cache Redis Tache 3.2.3, `delete(id)` soft delete `is_active=false` avec check `template_locked` si template en production usage, `submitForApproval(id)` change status `draft -> pending_review` + appelle Meta Graph API `POST /{whatsapp_business_account_id}/message_templates` avec retry 3 fois exponential backoff + stocke `meta_template_id` retourne par Meta + audit log + Kafka event `comm.template_submitted`, `markApproved(metaTemplateId, approvedAt)` recoit webhook Meta `account_alerts` Tache 3.2.4 + update `meta_template_status='approved'` + audit + Kafka event `comm.template_approved`, `markRejected(metaTemplateId, reason, rejectedAt)` similaire avec `meta_template_status='rejected'` + reason + audit + Kafka event `comm.template_rejected`, `listAll(filters, pagination)` retourne page paginee avec filtres `status`, `category`, `locale`, `search` (full-text sur name + body), tri par `updated_at DESC`) ; un controller NestJS `TemplatesController` qui expose les endpoints REST `/api/v1/comm/templates` (CRUD complet GET LIST, GET BY ID, POST CREATE, PATCH UPDATE, DELETE), `POST /api/v1/comm/templates/:id/submit` (workflow Meta submit), `GET /api/v1/comm/templates/meta-status` (sync check Meta API status all templates pending) avec RBAC `@RequirePermission('comm.templates.manage')` strict pour write operations et `@RequirePermission('comm.templates.read')` pour read ; des DTOs Zod `CreateTemplateDto`, `UpdateTemplateDto`, `SubmitTemplateDto`, `TemplateFiltersDto` avec validation stricte longueur body 1024 / header 60 / max 10 buttons / footer no-variables ; un script idempotent `seed-comm-templates.ts` qui consume 6 fichiers JSON seed (`auth/email_verification.json`, `auth/password_reset.json`, `auth/password_changed_notification.json` etc... 20 fichiers) chacun contenant les 4 locales avec body, header, footer, buttons, variables_schema Zod, et `meta_template_status='approved'` par defaut (auto-pre-approved car les seeds ont deja passe le review interne avant commit), et upsert sur `(tenant_id, name, locale)` pour idempotency si re-run du seed ; un client `MetaTemplateApiClient` qui consume le client `WhatsAppCloudApiClient` Tache 3.2.2 + ajoute methods `submitTemplate(template)` -> `POST /{whatsapp_business_account_id}/message_templates` et `getTemplateStatus(metaTemplateId)` -> `GET /{whatsapp_business_account_id}/message_templates/{template_id}` pour resync nightly job ; et 6 fichiers JSON seed concrets exemples (`email_verification`, `password_reset`, `password_changed_notification`, `appointment_scheduled`, `police_signed_confirmation`, `sinistre_acknowledged`) chacun avec les 4 locales completes et un index registry exportant le tableau complet.

L'apport est multiple. Premierement, en centralisant la gestion CRUD des templates avec workflow approval Meta dans un service unique reutilisable, on evite que chaque module metier (Sprint 14+ Insure, Sprint 17 Comm, Sprint 20+ Repair) reimplemente la logique de validation longueur Meta + soumission workflow + ecoute webhook approval. Le service gere a la fois les templates WhatsApp (avec workflow Meta pre-approval obligatoire) ET les templates Email (sans workflow externe car SMTP n'a pas de pre-approval, juste DKIM/SPF/DMARC config Sprint 35), distinguishables via la column `category` (`'utility' | 'transactional' | 'marketing' | 'authentication'` Meta categories pour WA, ou `'email_only'` pour les templates Email Tache 3.2.7). Deuxiemement, en pre-ecrivant 80 templates seed couvrant les 20 cas d'usage critiques modules Auth + Booking + Insure + Repair + Tenant dans 4 locales, on permet a un nouveau tenant onboarding Sprint 27 admin de demarrer immediatement avec un catalog de communications pret-a-l-emploi sans devoir attendre 24-48h de Meta approval workflow. Les 80 templates seed sont pre-approuves par Meta au niveau de la WhatsApp Business Account globale Skalean (les templates seed sont submisses une fois pour le tenant root puis copies au upsert pour les nouveaux tenants avec `meta_template_id` partage et `meta_template_status='approved'` immediat). Cette strategie reduit le time-to-first-message de 48h (workflow Meta complet) a < 1 minute (just upsert seed + render + send). Troisiemement, en supportant le workflow Meta `draft -> pending_review -> approved | rejected` strictement, on respecte les exigences Meta Cloud API v21.0 qui rejette tout template non-approved avec error code 130 (template not found) ou 132 (template_param_count_mismatch), et on evite les erreurs runtime worker BullMQ wa-send (Tache 3.2.8). Le webhook `account_alerts` Tache 3.2.4 reception status update Meta declenche automatiquement update DB + Kafka event invalidation cache Redis WaTemplateCache Tache 3.2.3, garantissant coherence cross-instances. Quatriemement, en validant strictement les contraintes Meta longueur (body 1024 chars, header 60 chars), nombre buttons (max 10), absence de variables dans footer, et regex no-emoji decision-006, on previent les rejections Meta workflow review qui prennent 24-48h a etre detectees autrement, accelerant le cycle iteration template content. Cinquiemement, en respectant la conformite ANRT loi 24-09 (marketing direct) et CNDP loi 09-08 (donnees personnelles), on evite les sanctions reglementaires : footer obligatoire avec mention courtier OU compagnie OU SARL Skalean + lien opt-out conformite Sprint 9 Tache 3.2.11, variables PII (`user_name`, `phone`, `montant`) loggees en hash SHA-256 et jamais en clair dans les logs Pino structures.

A l'issue de cette tache, l'API `TemplateManagerService.create({ tenant_id, name, locale, body_template, variables_schema, category })` insere un nouveau template draft en moins de 50ms p99 avec validation Zod stricte, `findByName(tenantId, name, locale)` resolve via cache Redis 5min + fallback cascade en moins de 5ms p99 (cache hit) ou 50ms p99 (cache miss + DB query), `submitForApproval(id)` declenche le workflow Meta avec retry 3x exponential backoff sur 5xx errors + stocke `meta_template_id` retourne, le webhook `account_alerts` Tache 3.2.4 invoque `markApproved` ou `markRejected` selon la decision Meta + Kafka event invalidation cache, le script `seed-comm-templates.ts` execute idempotent (re-run = no duplicates, juste update si change detecte) installe 80 templates en moins de 30 secondes pour un nouveau tenant, le controller REST `/api/v1/comm/templates` expose les endpoints CRUD avec RBAC strict + multi-tenant isolation (un tenant ne voit que ses propres templates), la suite Vitest couvre 28+ tests avec coverage >= 88% sur le module TemplateManagerService incluant CRUD CRUD CRUD scenarios + workflow approval happy path + Meta API down retry + webhook approved/rejected + validation longueur + seeds idempotency + multi-tenant isolation + permissions denied + cache invalidation Kafka, et la documentation README detaille les 20 templates seed avec leurs variables_schema et exemples 4 locales pour faciliter l'onboarding developpeur Sprint 14+ Insure et Sprint 20+ Repair.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 utilise des communications transactionnelles multi-canal (WhatsApp + Email) pour notifier les utilisateurs (assures, courtiers, partenaires) de tous les evenements metier critiques : verification email signup (Tache 2.1.9 Sprint 5), reset password (Tache 2.1.11 Sprint 5), notification password changed post-reset, notification account locked (Tache 2.1.10 Sprint 5), notification MFA setup (Tache 2.1.8 Sprint 5), confirmation rendez-vous booking (Sprint 8 Booking), rappel rendez-vous J-1 (Sprint 8 Booking + Sprint 9 broadcast cron), notification annulation rendez-vous (Sprint 8 Booking), generation devis (Sprint 14+ Insure), signature police d'assurance (Sprint 14+ Insure), rappel renouvellement police J-30 (Sprint 14+ Insure broadcast cron), rappel paiement prime due (Sprint 18 Books), accuse de reception sinistre (Sprint 20+ Repair), notification devis reparation pret (Sprint 20+ Repair), notification debut reparation (Sprint 20+ Repair), notification fin reparation (Sprint 20+ Repair), invitation tenant onboarding (Sprint 6 Tenant), suspension tenant non-paiement (Sprint 6 Tenant), warning quota 80% (Sprint 6 Tenant). Sans un service Template Manager centralise avec catalog seed pre-ecrit dans 4 locales, chaque module metier devrait :
- Reimplementer la logique CRUD templates dans son propre code metier.
- Reimplementer le workflow Meta approval avec retry + webhook reception.
- Maintenir manuellement les variables_schema Zod et la validation longueur Meta.
- Ecrire 4 traductions par template metier (fr, ar-MA, ar, en) sans pattern partage.
- Gerer manuellement la sync entre `meta_template_status` DB et Meta API actuel.

Le pattern centralise + 80 templates seed reduit le time-to-market par module metier de ~3 jours (creation + traductions + Meta approval workflow + tests) a ~30 minutes (consume `TemplateManagerService.findByName` + provide variables runtime). Le seed 80 templates est dimensionne pour couvrir 100% des cas d'usage MVP Sprint 9-25 ; les modules Sprint 26+ (e.g., loyalty programs, surveys, NPS) ajouteront leurs propres templates via le service CRUD.

L'exigence multi-locale 4 langues est specifique au marche marocain. Selon les enquetes consommateurs Sprint 1 (~3000 courtiers et ~80000 assures interroges) :
- 45% preferent fr pour les communications professionnelles (courtiers educations francophone, urbains Casablanca / Rabat / Tanger / Marrakech).
- 35% preferent ar-MA (darija) pour leur lisibilite naturelle (assures regions interieures Atlas / Souss / Oriental, populations rurales, age 40+, faible niveau d'arabe classique).
- 15% preferent ar formel (institutions financieres, autorites tutelle ACAPS, communications legales obligatoires e.g., police signed confirmation, claim received acknowledgement).
- 5% preferent en (international, partenariats etrangers reassureurs Munich Re / Swiss Re, courtiers expatries diaspora).

Le distinguo `ar-MA` vs `ar` au niveau template DB (deux rows distinctes meme `name` mais `language='ar-MA'` vs `language='ar'`) est CRITIQUE et insufisamment couvert par les concurrents AssurMaroc et ClickAssure qui ne proposent que fr ou ar formel. Un template `appointment_reminder_24h` en darija (`"Salam Mohamed, kayna 3andek mawid ghadda f 15:00 m3a courtier Hassan. Llh y3awnek!"`) est tres different en ton, registre, et lexique d'un meme template en arabe classique formel (`"السيد محمد المحترم، يشرفنا اعلامكم بأن لديكم موعدا غدا في الساعة 15:00 مع السيد حسن"`). Le service Template Manager stocke les deux versions distinctement, le `LocaleFallbackHelper` Tache 3.2.3 cascade `ar-MA -> ar -> fr -> en` quand la version preferee n'est pas disponible.

L'exigence workflow Meta approval est imposee par WhatsApp Cloud API v21.0 strict policy : seuls les templates pre-approved par Meta Business Manager peuvent etre envoyes en mode `template` (hors la fenetre 24h de session window apres reception d'un message user inbound). Le workflow review prend 24-48h en moyenne (jusqu'a 72h durant les rush periods comme Black Friday). Sans workflow centralise dans `TemplateManagerService.submitForApproval`, chaque modification template par admin Sprint 27 declencherait un re-submit manuel via Meta Business Manager UI (web), processus error-prone et non-trace en audit log. Le pattern centralise garantit que chaque transition `draft -> pending_review -> approved | rejected` est :
- Tracee en audit log Sprint 5 AuditAuthService Tache 2.1.12 (extension Sprint 9 AuditCommService consume meme pattern).
- Publishee via Kafka event Sprint 2 (`comm.template_submitted`, `comm.template_approved`, `comm.template_rejected`).
- Refletee instantanement dans le cache Redis Tache 3.2.3 via invalidation Kafka driven.
- Visible dans Sprint 27 admin UI status board avec timeline events.

L'exigence seed 80 templates pre-ecrits est imposee par le scenario d'onboarding tenant Sprint 27 admin : un nouveau courtier qui souscrit a la plateforme Skalean InsurTech doit pouvoir envoyer son premier message transactionnel (e.g., email verification au moment signup user) en moins de 5 minutes apres creation du tenant, sinon l'experience d'onboarding est bloquante. Sans seed pre-rempli, le nouveau tenant devrait :
1. Creer ses 20 templates manuellement via Sprint 27 admin UI (~ 2h de travail x 4 locales = 8h total).
2. Submit chaque template au workflow Meta approval (24-48h chacun, en parallel).
3. Attendre les 4 locales x 20 templates = 80 approvals Meta avant pouvoir envoyer.

Le pattern seed pre-rempli reduit ce delay a ~30 secondes (script `seed-comm-templates.ts` upsert 80 templates avec `meta_template_status='approved'` car deja pre-approved au niveau Skalean Business Account globale). Strategiquement, Skalean InsurTech submet les 80 templates seed UNE FOIS au niveau de sa WhatsApp Business Account (WHATSAPP_BUSINESS_ACCOUNT_ID env), Meta approuve une fois, puis tous les nouveaux tenants beneficient instantanement du catalog. Si un tenant veut customiser un template (e.g., changer le ton), il fork le template seed -> creer un nouveau row DB avec son tenant_id + version customisee -> submit a Meta avec son propre `meta_template_id`. Le pattern fork / inheritance est documente Sprint 27 admin UI mais l'implementation de l'inheritance multi-tenant est defferee Sprint 35 (pour MVP Sprint 9-25, les 80 seeds sont partages tels quels).

L'exigence conformite ANRT loi 24-09 (marketing direct + telephonie) impose que tout message commercial direct contienne :
- Identification commerciale du donneur d'ordre (Skalean SARL OU le courtier / compagnie d'assurance partenaire).
- Lien opt-out gratuit, simple, immediat (Sprint 9 Tache 3.2.11 endpoint public `/api/v1/public/optout/:token`).

Le service Template Manager valide via Zod schema strict que chaque template `category='marketing'` contient les patterns `{{tenant_brand}}` (interpolation runtime du brand name tenant) et `{{optout_url}}` (interpolation runtime du token opt-out signe JWT). Les templates `category='transactional'` ou `category='utility'` sont exemptes du opt-out obligatoire selon ANRT (transactional-essentials non-marketing).

L'exigence conformite CNDP loi 09-08 (donnees personnelles) impose que les variables PII `user_name`, `phone`, `montant`, `email`, `police_number` ne soient JAMAIS loggees en clair dans les logs Pino structures (Sprint 33 observability ELK ingestion). Le service Template Manager hash SHA-256 ces variables avant logging via le helper `hashPiiVariable(value: string): string` qui retourne les 8 premiers chars hex du SHA-256, suffisants pour debug correlation sans exposer le PII reel.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Templates inline dans code metier (Sprint 14, 17, 20...) | Simple developpement initial | Pas multi-locale, pas reutilisable, mix code+presentation, pas workflow Meta | REJETE |
| Templates DB `comm_templates` + service CRUD (RETENU, deja Sprint 2) | Reutilisable, multi-locale, workflow Meta approval, admin UI editable Sprint 27 | Necessite seed initial pour onboarding rapide | RETENU |
| Templates fichiers `.hbs` dans le repository sans DB | Versionning git, code review templates | Pas multi-tenant customization, pas workflow Meta dynamic | REJETE pour WA, RETENU pour Email Tache 3.2.7 partie statique |
| Templates DB + fichiers `.hbs` hybride (RETENU) | Best of both | Complexite duale | RETENU -- WA en DB, Email layout statique + body dynamic DB |
| Seed 0 templates (full custom by tenant) | Flexibilite maximale | Onboarding lent (24-48h Meta workflow par template) | REJETE |
| Seed 20 templates x 3 locales (60 total) (initial meta-prompt) | Couverture standard | Pas de support partenaires anglophones | REJETE -- ajout `en` par user |
| Seed 20 templates x 4 locales (80 total) (RETENU) | Couverture complete, conformite internationale | 1 locale supplementaire = +25% templates a maintenir | RETENU |
| Seed 30 templates x 4 locales (120 total) | Couverture maximale | Effort traduction extensive Sprint 9, peu utilise MVP | REJETE -- Sprint 26+ ajoutera surveys/NPS |
| Seed 10 templates x 4 locales (40 total) | Effort minimal | Couverture insuffisante 5 modules | REJETE |
| Workflow Meta manuel via Business Manager UI | Pas de code workflow | Error-prone, pas trace audit, slow | REJETE |
| Workflow Meta via API + service centralise (RETENU) | Trace audit, retry exponential, webhook reception | Complexite implementation API client | RETENU |
| Templates inheritance multi-tenant (fork pattern) | Customization par tenant | Complexite querying + cache, surdimensionne MVP | DEFFERE Sprint 35 |
| Templates partages globaux Skalean uniquement (RETENU MVP) | Simple, rapide onboarding | Pas customization tenant | RETENU MVP, evolution Sprint 35 |
| Validation longueur Meta a runtime via service | Type-safe, errors explicites | Necessite mapping schema strict | RETENU -- decision-007 |
| Validation longueur Meta a save uniquement | Pas de runtime check | Risque rejection Meta workflow review tardif | REJETE |
| Cache invalidation Kafka driven (RETENU) | Coherence multi-instance, low-latency | Complexite Kafka consumer | RETENU -- coherence Tache 3.2.3 |
| Cache invalidation polling TTL only | Simple | Stale jusqu'a 5min apres update | REJETE -- combine TTL 5min + Kafka explicit |
| Categories Meta strict (`utility / transactional / marketing / authentication`) | Conforme Meta API | Necessite mapping vs categories metier | RETENU -- mapping documente |
| Categories metier libres | Flexibilite | Non-conforme Meta API rejection | REJETE |

### 2.3 Trade-offs

Choisir le pattern templates DB centralise + service CRUD implique d'accepter une complexite operationnelle (workflow approval + cache invalidation + multi-tenant isolation) qui peut paraitre overkill pour un MVP Sprint 9. En contrepartie, la reutilisabilite cross-modules (Auth, Booking, Insure, Repair, Tenant, et tous les modules Sprint 14-25 a venir) amortit cette complexite sur 30+ cas d'usage et evite N reimplementations couteuses. Le ROI break-even est atteint des le 3eme module consumer (typiquement Sprint 14 Insure ou Sprint 20 Repair).

Choisir 80 templates seed (vs 0 ou 40) implique d'accepter un effort initial de redaction de 80 textes (20 cas d'usage x 4 locales) requiring native speakers fr / ar-MA / ar / en (sourcing Sprint 1 onboarding equipe) plus le passage workflow Meta approval initial (24-48h une fois). En contrepartie, l'experience d'onboarding tenant Sprint 27 admin est instantanee (~30 secondes script seed) au lieu de bloquante (24-48h x 80 = inacceptable). Strategiquement, les 80 templates couvrent 100% des cas d'usage MVP Sprint 9-25, evitant 10+ submissions Meta separees ulterieures qui auraient chacune leur propre delay 24-48h.

Choisir le workflow Meta approval centralise via API (vs Business Manager UI manuel) implique d'accepter une complexite implementation client `MetaTemplateApiClient` avec retry exponential + reception webhook + sync nightly job (corrigeant les drift entre DB et Meta API status). En contrepartie, l'audit trail complet (chaque transition tracee via Sprint 5 AuditAuthService extension AuditCommService Sprint 9) garantit la conformite ACAPS (autorite reglementaire qui peut auditer tout template envoye) et la traceabilite developpeur (qui a soumis quoi et quand).

Choisir la categorisation Meta stricte (`utility / transactional / marketing / authentication`) implique d'accepter un mapping initial entre categories metier (e.g., `email_verification` est `authentication`, `appointment_scheduled` est `utility`, `quote_generated` est `marketing` ?) qui necessite une decision rigoureuse car Meta rejette les templates mal categorises (e.g., un template `marketing` sans opt-out lien). En contrepartie, la conformite Meta + ANRT 24-09 est garantie au niveau service.

Choisir l'invalidation cache Kafka driven (vs polling TTL only) implique d'accepter une complexite Kafka consumer qui ecoute `comm.template_updated` et purge le cache Redis Tache 3.2.3. En contrepartie, la coherence cross-instances est instantanee (delay sub-second) au lieu de 5min worst case (TTL natural expire), evitant les confusions admin Sprint 27 ("j'ai update le template mais les workers continuent a envoyer l'ancienne version").

Choisir le pattern templates partages globaux Skalean (vs per-tenant inheritance) pour MVP Sprint 9-25 implique d'accepter que tous les tenants utilisent les memes 80 templates seed, sans customization possible (sauf fork manuel par admin Sprint 27 qui creerait un nouveau row DB avec son tenant_id et son contenu propre). En contrepartie, la maintenabilite des seeds est simplifiee (1 source of truth Skalean root tenant) et les performances sont superieures (cache hit sharing cross-tenants). L'inheritance multi-tenant (templates `tenant_id IS NULL` herites par tous, override par tenant_id specifique) est defferee Sprint 35.

### 2.4 Decisions strategiques referenced

- **decision-006** (No-emoji) : totale -- aucun emoji dans le code, les templates DB, les logs, les comments, ni dans les seeds JSON. Le service Template Manager rejette via regex check `/[\u{1F300}-\u{1F9FF}]/u` au moment du save template. Conjugue avec Meta strict policy emoji-rejected pour categories `marketing` et `utility`.
- **decision-007** (Zod runtime validation) : totale -- les DTOs `CreateTemplateDto`, `UpdateTemplateDto`, `SubmitTemplateDto` sont des Zod schemas + le `variables_schema` jsonb stocke un schema Zod-compatible serialise valide a runtime via `z.object().parse()` sur les variables fournies.
- **decision-008** (Cloud souverain MA) : indirect -- DB Postgres et Redis cache deployes Sprint 35 sur Atlas Cloud Services Benguerir. Meta API call externe est inevitable (souverainete Meta US/IE) mais documentee comme exception pour le canal WhatsApp.
- **decision-009** (Multi-locale fr / ar-MA / ar / en) : totale -- exactement 4 locales supportees, mapping `ar-MA -> Meta language_code 'ar'` documente dans `LocaleFallbackHelper` Tache 3.2.3 reutilise.
- **decision-018** (Templates Handlebars pour email) : indirect -- le service Template Manager stocke `body_template` brut, le rendering Handlebars est dans Tache 3.2.7 (Email) et renderering Meta `{{N}}` dans Tache 3.2.3 (WA). Template Manager est agnostic au render engine.
- **decision-022** (Cache Redis Sprint 3) : indirect -- Tache 3.2.3 WaTemplateCacheService consume Tache 3.2.5 service via `findByName`. Invalidation Kafka driven Tache 3.2.5 publie l'event consume Tache 3.2.3.
- **decision-024** (Kafka events pattern Sprint 2) : totale -- producer events `comm.template_created`, `comm.template_updated`, `comm.template_deleted`, `comm.template_submitted`, `comm.template_approved`, `comm.template_rejected`. Consumer event `comm.template_approval_webhook` recu de Tache 3.2.4 WA webhook.
- **decision-031** (Audit log Sprint 5 extension) : totale -- toutes les operations CRUD + workflow tracees via AuditCommService (extension du AuditAuthService Tache 2.1.12 pattern).
- **decision-040** (Multi-tenant strict isolation) : totale -- `tenant_id` requis dans chaque query, scope `getCurrentTenantId()` Sprint 6 TenantContextService, exception NotFoundException pour cross-tenant access.

### 2.5 Pieges techniques connus

1. **Meta API rate limit 80/sec submission** : Meta limite a 80 templates submission par seconde par phone_number_id. Pour onboarding tenant initial (80 seeds), la submission sequentielle prend ~1 seconde mais en burst peut hit le rate limit. Pattern : queue BullMQ `template-submit-queue` avec concurrency 50 + retry exponential 1s/5s/30s sur error 4070 (rate limit hit).
2. **Meta template_id versioning** : Meta API retourne un `id` unique par template + langue + version. Si on update le `body_template` apres approval, Meta cree un nouveau `meta_template_id` (la vieille version reste accessible). Pattern : Template Manager stocke `meta_template_id` courant + history dans `meta_template_versions` jsonb array (Sprint 27 admin pourra rollback).
3. **Meta webhook `account_alerts` payload structure** : Meta envoie les status updates via webhook avec structure `{ entry: [{ id, time, changes: [{ field: 'message_template_status_update', value: { event: 'APPROVED' | 'REJECTED' | 'FLAGGED', message_template_id, message_template_name, message_template_language, reason } }] }] }`. Le consumer Sprint 9 Tache 3.2.4 parse cette structure et appelle `markApproved` ou `markRejected`.
4. **Workflow Meta status drift** : si webhook Meta perdu (3 retries echec, ou Meta indispo durant maintenance), le DB peut indiquer `pending_review` alors que Meta a deja `approved`. Pattern : nightly cron Sprint 9 `meta-status-resync.cron.ts` (defferee Sprint 18 cron orchestration) calls `GET /{whatsapp_business_account_id}/message_templates` paginated et reconcilie les statuses.
5. **Body length 1024 chars Meta limit avec variables interpolees** : la limite 1024 chars Meta s'applique au `body_template` STATIQUE (avant interpolation). Apres interpolation runtime avec variables longues (e.g., `user_name='Mohamed Ben Abdelmalek El Fassi'`), le body final peut depasser 1024. Meta accepte cette interpolation (la verification est statique). Le service Template Manager valide uniquement le `body_template` static.
6. **Header length 60 chars avec variables** : header `text` max 60 chars STATIQUE. Si le template a `header_template = "Bonjour {{user_name}}"`, et `user_name='Mohamed'` interpole donne 14 chars OK, mais `user_name='Mohamed Ben Abdelmalek El Fassi'` donne 38 chars + "Bonjour " = 46 chars OK. Pattern : valide statiquement le header_template + recommande dans la doc des variables courtes (e.g., `first_name` au lieu de `full_name`).
7. **Footer no-variables Meta restriction** : Meta REJETTE les templates dont le footer contient `{{...}}`. Le service Template Manager valide via regex `/\{\{.+\}\}/` sur `footer_template` + throw `FooterCannotHaveVariablesError` au save. Le footer est typiquement statique : "Skalean SARL, RC Casablanca XXXX".
8. **Buttons max 10 + structure type** : Meta accepte max 10 buttons par template (`type: 'quick_reply' | 'url' | 'phone_number' | 'copy_code'`). Pattern : validation Zod array max 10 + type discriminated union.
9. **Button URL avec variables** : Meta autorise 1 variable `{{1}}` dans button URL (e.g., `https://app.skalean.ma/police/{{1}}`). Pattern : validation specifique permettant cette unique variable.
10. **Meta categories obligatoire** : chaque template doit avoir `category` dans `'utility' | 'transactional' | 'marketing' | 'authentication'`. La categorisation impacte les regles compliance (e.g., `marketing` requiert opt-out, `transactional` exempte). Pattern : Zod enum strict + mapping documente metier->Meta.
11. **Idempotency seeds re-run** : si le script `seed-comm-templates.ts` est re-execute (e.g., new tenant onboarding), il doit etre idempotent (pas de duplicates). Pattern : `INSERT ... ON CONFLICT (tenant_id, name, locale) DO UPDATE SET body_template=EXCLUDED.body_template, ...` PostgreSQL UPSERT.
12. **Locked templates deletion forbidden** : un template en production usage (au moins 1 message envoye au cours des 30 derniers jours) ne doit pas etre delete physically (risque de break audit log replay Sprint 33). Pattern : soft delete `is_active=false` + check FK reverse `comm_messages.template_id` count > 0 -> reject DELETE avec `TemplateLockedError`.
13. **Variables PII logging** : `user_name`, `phone`, `montant`, `email` sont PII et CNDP loi 09-08 interdit le logging en clair. Pattern : `hashPiiVariable(value)` retourne `sha256(value).slice(0, 8)` pour correlation debug sans expose.
14. **Cache invalidation race condition** : si admin Sprint 27 update template a T=0 + Kafka event arrive a T=10ms + worker concurrent fetch cache a T=5ms (juste apres update DB mais avant Kafka invalidation). Tache 3.2.3 cache utilise `comm_templates.updated_at` comme version field, le worker compare et re-fetch si stale.
15. **Multi-tenant cross-leak** : si query oublie le `tenant_id`, un tenant pourrait voir les templates d'un autre tenant. Pattern : QueryBuilder TypeORM `.where('tenant_id = :tenantId', { tenantId: getCurrentTenantId() })` STRICT, lint check Sprint 27 verifie absence de queries sans tenant_id.
16. **Meta API down lors submit** : si Meta API indispo (5xx ou timeout) lors `submitForApproval`, le template reste en `draft` (pas `pending_review`). Pattern : retry queue BullMQ `template-submit-retry` avec attempts=5 + DLQ apres 5 echecs + alert Slack Sprint 33.
17. **Meta status incoherent rejected en DB mais approved Meta** : si webhook Meta perdu (3 retries echec). Pattern : nightly resync job + admin Sprint 27 manual force-resync button.
18. **Body avec emoji sanitize fail-fast** : decision-006 + Meta policy strict reject emoji body. Pattern : regex check `/[\u{1F300}-\u{1F9FF}]/u` au save + reject.
19. **Variables non utilisees declarees in schema** : si `variables_schema.required = ['user_name', 'extra_var']` mais `body_template` ne contient que `{{user_name}}`. Pattern : warn pas error (extras ignored at render Tache 3.2.3) + audit log warn pour cleanup.
20. **Reserved name conflict** : certains template names sont reserves system (e.g., `__system_health_check`, `__test_seed`). Pattern : enum reserve + reject CREATE.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.5 livre `TemplateManagerService` + 80 seeds + workflow Meta approval consomme par :
- **Tache 3.2.6** (Email SMTP DKIM/Mailgun) : non direct, mais utilisera le service via Tache 3.2.7 pour resolve les templates email.
- **Tache 3.2.7** (Email template renderer RTL) : utilise `findByName` pour resolve les templates email avec `category='email_only'` ou `category='transactional'`.
- **Tache 3.2.8** (BullMQ wa-send + email-send workers) : appelle `findByName` + `WaTemplateRendererService.render()` Tache 3.2.3 avant `WhatsAppCloudApiClient.sendTemplate()` Tache 3.2.2.
- **Tache 3.2.9** (Message orchestrator) : appelle `findByName` + `validateMetaApproved` pour decider routing WA vs fallback email.
- **Tache 3.2.13** (Tests E2E 40+) : couvre le pipeline complet template seed -> render -> send via mock Meta API.

### 3.2 Position dans le programme global

- **Sprint 5 Auth** : 5 templates seed Auth (`email_verification`, `password_reset`, `password_changed_notification`, `mfa_enabled_notification`, `account_locked_notification`). EmailService Sprint 5 Tache 2.1.13 utilise actuellement des templates Handlebars statiques fichiers ; Sprint 9 transition optionnelle vers DB-backed templates pour homogeneite (mais EmailService Sprint 5 reste actif).
- **Sprint 6 Tenant** : 3 templates seed Tenant (`tenant_invitation`, `tenant_suspended_notification`, `quota_warning_80percent`).
- **Sprint 8 Booking + CRM** : 3 templates seed Booking (`appointment_scheduled`, `appointment_reminder_24h`, `appointment_cancelled`). Sprint 8 publishe Kafka events qui Sprint 9 Comm consume + enqueue jobs send.
- **Sprint 14+ Insure** : 5 templates seed Insure (`quote_generated`, `police_signed_confirmation`, `police_renewal_reminder`, `payment_due_reminder`, `claim_received_acknowledgement`). Modules metier Sprint 14+ consume `TemplateManagerService.findByName` pour resolve.
- **Sprint 17 Comm vertical** : utilise broadcasts haute-frequence (cron jobs `appointment-reminders-j-1` 8h matin), `findByName` + cache Redis 5min Tache 3.2.3 critique pour perf.
- **Sprint 20+ Repair** : 4 templates seed Repair (`sinistre_acknowledged`, `devis_ready`, `reparation_started`, `reparation_completed`).
- **Sprint 26+ Loyalty / Surveys** : ajoute ses propres templates via service CRUD (out of scope MVP seeds Sprint 9).
- **Sprint 27 Admin UI** : workflow Meta approval (`submit_for_review` button -> `submitForApproval` -> Meta review -> `approved`/`rejected` reflete DB), edition templates avec preview rendering live via `WaTemplateRendererService.render()` Tache 3.2.3, lint coherence body/order, reset cache via Kafka event publish.
- **Sprint 33 Observability** : metrics OTEL `template_create_count`, `template_submit_meta_duration_ms`, `template_approve_duration_seconds` (time entre submit et approve Meta), `template_cache_invalidation_count`.
- **Sprint 35 Deployment Atlas Cloud Benguerir** : DB et Redis cache deployes sur infrastructure souveraine. Meta API call reste externe documente exception.
- **Sprint 35+ Multi-tenant inheritance** : evolution pattern fork tenant Sprint 35 si demand identifie.

### 3.3 Diagramme

```
                  +-----------------------------------+
                  | Tache 3.2.4 termine                |
                  | WA webhook receiver + signature HMAC|
                  | account_alerts -> markApproved     |
                  +-----------------+------------------+
                                    |
                                    v
              +---------------------+---------------------+
              | TACHE 3.2.5 (cette tache)                 |
              | TemplateManagerService                    |
              |                                           |
              | - create(input)                           |
              |     -> Promise<Template>                  |
              | - findById(id)                            |
              |     -> Promise<Template | null>           |
              | - findByName(tenantId, name, locale)      |
              |     -> Promise<Template | null>           |
              | - update(id, patch)                       |
              |     -> Promise<Template>                  |
              | - delete(id) [soft]                       |
              | - submitForApproval(id)                   |
              |     -> Meta API submit + Kafka            |
              | - markApproved(metaTemplateId, approvedAt)|
              |     <- webhook Tache 3.2.4 calls          |
              | - markRejected(metaTemplateId, reason)    |
              | - listAll(filters, pagination)            |
              |                                           |
              | + 80 templates seed JSON (4 locales)      |
              | + script seed-comm-templates.ts idempotent|
              | + MetaTemplateApiClient retry exp         |
              | + AuditCommService extension Sprint 5     |
              | + Kafka producer events                   |
              | + Controller REST /api/v1/comm/templates  |
              | + DTOs Zod create/update/submit/filters   |
              +---+---+---+---+---+---+---+---+---+---+---+
                  |   |   |   |   |   |   |   |   |   |
                  v   v   v   v   v   v   v   v   v   v
                3.2.6 3.2.7 3.2.8 3.2.9 3.2.13
                Sprint 14+ Insure / 17 Comm / 20+ Repair
                Sprint 27 admin UI / 33 OTEL / 35 Atlas
```

### 3.4 Flow de donnees `submitForApproval(id)`

```
Caller (Sprint 27 admin UI submit button)
  | POST /api/v1/comm/templates/:id/submit
  v
TemplatesController.submit(id)
  | RBAC check: comm.templates.manage
  | tenantId = getCurrentTenantId()
  v
TemplateManagerService.submitForApproval(id)
  |
  +-- 1. db.findById(id) WHERE tenant_id = $tenantId
  |     not found -> throw NotFoundException
  |     status != 'draft' -> throw InvalidStateError
  |
  +-- 2. validate body length <= 1024
  |     header length <= 60
  |     buttons count <= 10
  |     footer no variables
  |     no emoji body
  |     reject -> throw ValidationError
  |
  +-- 3. db.update SET status='pending_review', submitted_at=NOW() WHERE id=$id
  |
  +-- 4. metaClient.submitTemplate({
  |        name, language: mapLocaleToMeta(locale), category,
  |        components: [{ type: 'BODY', text: body_template }, ...]
  |      })
  |     retry 3x exponential backoff sur 5xx + rate limit 4070
  |     success -> { id: meta_template_id }
  |     fail apres 3x -> publish Kafka 'comm.template_submit_failed' + alert
  |
  +-- 5. db.update SET meta_template_id=$id WHERE id=$id
  |
  +-- 6. auditCommService.log({
  |        action: 'template_submitted', resource_id: id,
  |        details: { meta_template_id, name, locale, category }
  |      })
  |
  +-- 7. kafkaProducer.publish('comm.template_submitted', {
  |        template_id: id, meta_template_id, tenant_id, locale, name
  |      })
  |
  +-- 8. log info structured + emit OTEL metric template_submit_meta_duration_ms
  |
  +-- 9. return template (with meta_template_id)
  v
Caller -> 200 OK { template_id, meta_template_id, status: 'pending_review' }

Plus tard (24-48h apres) ...
Meta envoie webhook account_alerts a /api/v1/public/webhooks/whatsapp Tache 3.2.4
  | { entry: [{ changes: [{ field: 'message_template_status_update', value: { event: 'APPROVED', message_template_id, message_template_name, ... } }] }] }
  v
WaWebhookProcessor.consumer Tache 3.2.4
  v
TemplateManagerService.markApproved(meta_template_id, approved_at)
  |
  +-- db.update SET status='approved', approved_at=NOW() WHERE meta_template_id=$id
  +-- audit log template_approved
  +-- kafka publish comm.template_approved -> Tache 3.2.3 cache invalidation
  +-- OTEL metric template_approve_duration_seconds (now - submitted_at)
```

### 3.5 Flow seeds onboarding tenant

```
New tenant created (Sprint 6 TenantService.createTenant)
  | Kafka event 'tenant.created' { tenant_id, slug, brand_name }
  v
SeedCommTemplatesConsumer (Sprint 9)
  | OR
  | manual : pnpm seed:comm-templates --tenant-id=<id>
  v
script seed-comm-templates.ts
  |
  +-- 1. read all 20 JSON files in seed-data/{module}/{template}.json
  |       module in [auth, booking, insure, repair, tenant]
  |
  +-- 2. for each template + each locale (fr, ar-MA, ar, en) :
  |        upsertTemplate(tenant_id, name, locale, body, header, footer, buttons, variables_schema, meta_template_status='approved', meta_template_id=<root_skalean_meta_id>)
  |
  +-- 3. INSERT ... ON CONFLICT (tenant_id, name, locale) DO UPDATE
  |       SET body_template = EXCLUDED.body_template,
  |           header_template = EXCLUDED.header_template,
  |           footer_template = EXCLUDED.footer_template,
  |           buttons = EXCLUDED.buttons,
  |           variables_schema = EXCLUDED.variables_schema,
  |           updated_at = NOW()
  |
  +-- 4. log structured count_inserted + count_updated + count_skipped
  |
  +-- 5. publish Kafka 'comm.seeds_completed' { tenant_id, count: 80, duration_ms }
```

---

## 4. Livrables checkables (38 livrables)

- [ ] Service `repo/packages/comm/src/services/template-manager.service.ts` -- ~280 lignes
- [ ] Tests `repo/packages/comm/src/services/template-manager.service.spec.ts` -- ~320 lignes / 28+ tests
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/templates.controller.ts` -- ~180 lignes
- [ ] DTOs `repo/apps/api/src/modules/comm/dto/template.dto.ts` -- ~120 lignes (Zod)
- [ ] Client Meta `repo/packages/comm/src/clients/meta-template-api.client.ts` -- ~140 lignes (extends Tache 3.2.2 client)
- [ ] Service audit `repo/packages/comm/src/services/audit-comm.service.ts` -- ~80 lignes (extension Sprint 5 AuditAuthService pattern)
- [ ] Errors `repo/packages/comm/src/errors/template-manager-errors.ts` -- ~70 lignes (8 error classes)
- [ ] Helpers `repo/packages/comm/src/helpers/pii-hash.helper.ts` -- ~30 lignes (hashPiiVariable SHA-256)
- [ ] Script seed `repo/infrastructure/scripts/seed-comm-templates.ts` -- ~500 lignes (idempotent upsert 80 templates)
- [ ] Registry seeds `repo/packages/comm/src/templates/seed-data/index.ts` -- ~80 lignes (export array all templates)
- [ ] Seed Auth (5) :
  - `repo/packages/comm/src/templates/seed-data/auth/email_verification.json` -- ~80 lignes (4 locales)
  - `repo/packages/comm/src/templates/seed-data/auth/password_reset.json` -- ~80 lignes
  - `repo/packages/comm/src/templates/seed-data/auth/password_changed_notification.json` -- ~80 lignes
  - `repo/packages/comm/src/templates/seed-data/auth/mfa_enabled_notification.json` -- ~80 lignes
  - `repo/packages/comm/src/templates/seed-data/auth/account_locked_notification.json` -- ~80 lignes
- [ ] Seed Booking (3) :
  - `repo/packages/comm/src/templates/seed-data/booking/appointment_scheduled.json` -- ~80 lignes
  - `repo/packages/comm/src/templates/seed-data/booking/appointment_reminder_24h.json` -- ~80 lignes
  - `repo/packages/comm/src/templates/seed-data/booking/appointment_cancelled.json` -- ~80 lignes
- [ ] Seed Insure (5) :
  - `repo/packages/comm/src/templates/seed-data/insure/quote_generated.json`
  - `repo/packages/comm/src/templates/seed-data/insure/police_signed_confirmation.json`
  - `repo/packages/comm/src/templates/seed-data/insure/police_renewal_reminder.json`
  - `repo/packages/comm/src/templates/seed-data/insure/payment_due_reminder.json`
  - `repo/packages/comm/src/templates/seed-data/insure/claim_received_acknowledgement.json`
- [ ] Seed Repair (4) :
  - `repo/packages/comm/src/templates/seed-data/repair/sinistre_acknowledged.json`
  - `repo/packages/comm/src/templates/seed-data/repair/devis_ready.json`
  - `repo/packages/comm/src/templates/seed-data/repair/reparation_started.json`
  - `repo/packages/comm/src/templates/seed-data/repair/reparation_completed.json`
- [ ] Seed Tenant (3) :
  - `repo/packages/comm/src/templates/seed-data/tenant/tenant_invitation.json`
  - `repo/packages/comm/src/templates/seed-data/tenant/tenant_suspended_notification.json`
  - `repo/packages/comm/src/templates/seed-data/tenant/quota_warning_80percent.json`
- [ ] Tests integration `repo/packages/comm/src/__tests__/integration/template-manager-meta-workflow.integration.spec.ts` -- ~180 lignes
- [ ] Module `repo/apps/api/src/modules/comm/comm.module.ts` -- modifie register controller + service
- [ ] Index exports `repo/packages/comm/src/index.ts` -- modifie
- [ ] Variables env nouvelles : `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_API_BASE_URL`, `COMM_TEMPLATE_CACHE_TTL_S=300`
- [ ] No-emoji
- [ ] No-console
- [ ] No log de variables PII en clair (hash uniquement via hashPiiVariable)
- [ ] Coverage >= 88%
- [ ] Build TypeScript reussit
- [ ] Tous les 80 templates seed presents et valides
- [ ] Multi-tenant isolation strict (aucune query sans tenant_id)
- [ ] RBAC strict @RequirePermission('comm.templates.manage') sur write
- [ ] Workflow Meta approval pattern complet draft -> pending -> approved/rejected
- [ ] Validation longueur Meta strict (body 1024, header 60, buttons 10, footer no-vars, no emoji)
- [ ] Errors typees explicites (8 classes)
- [ ] Kafka producer events (6 events) + consumer cache invalidation
- [ ] Idempotency script seed (UPSERT ON CONFLICT)
- [ ] Documentation README package comm enrichie (section Template Manager + 20 templates seed registry)
- [ ] Bench create < 50ms p99 / submitForApproval < 500ms p99 incluant Meta API

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/services/template-manager.service.ts                                   (~280 lignes)
repo/packages/comm/src/services/template-manager.service.spec.ts                              (~320 lignes / 28 tests)
repo/packages/comm/src/services/audit-comm.service.ts                                         (~80 lignes)
repo/packages/comm/src/clients/meta-template-api.client.ts                                    (~140 lignes)
repo/packages/comm/src/errors/template-manager-errors.ts                                      (~70 lignes)
repo/packages/comm/src/helpers/pii-hash.helper.ts                                             (~30 lignes)
repo/packages/comm/src/templates/seed-data/index.ts                                           (~80 lignes)
repo/packages/comm/src/templates/seed-data/auth/email_verification.json                       (~80 lignes)
repo/packages/comm/src/templates/seed-data/auth/password_reset.json                           (~80 lignes)
repo/packages/comm/src/templates/seed-data/auth/password_changed_notification.json            (~80 lignes)
repo/packages/comm/src/templates/seed-data/auth/mfa_enabled_notification.json                 (~80 lignes)
repo/packages/comm/src/templates/seed-data/auth/account_locked_notification.json              (~80 lignes)
repo/packages/comm/src/templates/seed-data/booking/appointment_scheduled.json                  (~80 lignes)
repo/packages/comm/src/templates/seed-data/booking/appointment_reminder_24h.json               (~80 lignes)
repo/packages/comm/src/templates/seed-data/booking/appointment_cancelled.json                  (~80 lignes)
repo/packages/comm/src/templates/seed-data/insure/quote_generated.json                         (~80 lignes)
repo/packages/comm/src/templates/seed-data/insure/police_signed_confirmation.json              (~80 lignes)
repo/packages/comm/src/templates/seed-data/insure/police_renewal_reminder.json                 (~80 lignes)
repo/packages/comm/src/templates/seed-data/insure/payment_due_reminder.json                    (~80 lignes)
repo/packages/comm/src/templates/seed-data/insure/claim_received_acknowledgement.json          (~80 lignes)
repo/packages/comm/src/templates/seed-data/repair/sinistre_acknowledged.json                   (~80 lignes)
repo/packages/comm/src/templates/seed-data/repair/devis_ready.json                             (~80 lignes)
repo/packages/comm/src/templates/seed-data/repair/reparation_started.json                      (~80 lignes)
repo/packages/comm/src/templates/seed-data/repair/reparation_completed.json                    (~80 lignes)
repo/packages/comm/src/templates/seed-data/tenant/tenant_invitation.json                       (~80 lignes)
repo/packages/comm/src/templates/seed-data/tenant/tenant_suspended_notification.json           (~80 lignes)
repo/packages/comm/src/templates/seed-data/tenant/quota_warning_80percent.json                 (~80 lignes)
repo/apps/api/src/modules/comm/controllers/templates.controller.ts                            (~180 lignes)
repo/apps/api/src/modules/comm/dto/template.dto.ts                                            (~120 lignes)
repo/apps/api/src/modules/comm/comm.module.ts                                                 (modifie / +register)
repo/infrastructure/scripts/seed-comm-templates.ts                                             (~500 lignes)
repo/packages/comm/src/__tests__/integration/template-manager-meta-workflow.integration.spec.ts (~180 lignes)
repo/packages/comm/src/index.ts                                                               (modifie / +exports)
repo/packages/comm/README.md                                                                  (modifie / +section Template Manager + seeds)
.env.example                                                                                   (modifie / +WHATSAPP_BUSINESS_ACCOUNT_ID, +COMM_TEMPLATE_CACHE_TTL_S)
```

Total : 35 fichiers crees ou modifies, ~3000 lignes effectives + 1600 lignes JSON seeds + ~80 lignes README.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 12 : `template-manager.service.ts`

```typescript
/**
 * @insurtech/comm/services/template-manager.service
 *
 * CRUD templates + workflow Meta approval pour communications WhatsApp + Email.
 *
 * Reference :
 *   - decision-006 (No-emoji)
 *   - decision-007 (Zod runtime validation)
 *   - decision-009 (Multi-locale fr / ar-MA / ar / en)
 *   - decision-024 (Kafka events pattern)
 *   - decision-031 (Audit log Sprint 5 extension)
 *   - decision-040 (Multi-tenant strict isolation)
 *   - Sprint 9 Tache 3.2.5 (this task)
 *   - Sprint 27 admin UI consume (workflow approval)
 */

import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { CommTemplate } from '../entities/comm-template.entity.js';
import { CommMessage } from '../entities/comm-message.entity.js';
import { TenantContextService } from '@insurtech/tenant';
import { KafkaProducer, Topics } from '@insurtech/messaging';
import { MetaTemplateApiClient } from '../clients/meta-template-api.client.js';
import { AuditCommService } from './audit-comm.service.js';
import { LocaleFallbackHelper, type Locale, mapLocaleToMeta } from '../helpers/locale-fallback.helper.js';
import {
  TemplateNotFoundError,
  TemplateNameConflictError,
  TemplateNameReservedError,
  InvalidTemplateStateError,
  BodyTooLongError,
  HeaderTooLongError,
  TooManyButtonsError,
  FooterCannotHaveVariablesError,
  EmojiInBodyError,
  TemplateLockedError,
} from '../errors/template-manager-errors.js';

const META_BODY_MAX_LENGTH = 1024;
const META_HEADER_MAX_LENGTH = 60;
const META_BUTTONS_MAX_COUNT = 10;
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const VARIABLE_REGEX = /\{\{([a-z_][a-z0-9_]*)\}\}/gi;
const RESERVED_NAMES = new Set([
  '__system_health_check', '__test_seed', '__internal',
  'system_alert', 'test_template',
]);

export type TemplateCategory = 'utility' | 'transactional' | 'marketing' | 'authentication' | 'email_only';
export type TemplateStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface CreateTemplateInput {
  name: string;
  locale: Locale;
  category: TemplateCategory;
  body_template: string;
  header_template?: string;
  footer_template?: string;
  buttons?: TemplateButton[];
  variables_schema: VariablesSchema;
}

export interface UpdateTemplateInput {
  body_template?: string;
  header_template?: string;
  footer_template?: string;
  buttons?: TemplateButton[];
  variables_schema?: VariablesSchema;
  category?: TemplateCategory;
}

export interface TemplateButton {
  type: 'quick_reply' | 'url' | 'phone_number' | 'copy_code';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface VariablesSchema {
  order: string[];
  required: string[];
  schema: Record<string, 'string' | 'number' | 'date'>;
}

export interface ListFilters {
  status?: TemplateStatus;
  category?: TemplateCategory;
  locale?: Locale;
  search?: string;
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

@Injectable()
export class TemplateManagerService {
  private readonly logger = new Logger(TemplateManagerService.name);

  constructor(
    @InjectRepository(CommTemplate)
    private readonly templateRepo: Repository<CommTemplate>,
    @InjectRepository(CommMessage)
    private readonly messageRepo: Repository<CommMessage>,
    private readonly tenantContext: TenantContextService,
    private readonly kafkaProducer: KafkaProducer,
    private readonly metaClient: MetaTemplateApiClient,
    private readonly auditComm: AuditCommService,
    private readonly localeFallback: LocaleFallbackHelper,
    private readonly config: ConfigService,
  ) {}

  async create(input: CreateTemplateInput): Promise<CommTemplate> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) throw new BadRequestException('TENANT_CONTEXT_MISSING');

    if (RESERVED_NAMES.has(input.name)) {
      throw new TemplateNameReservedError(input.name);
    }

    this.validateMetaConstraints(input);

    const existing = await this.templateRepo.findOne({
      where: { tenant_id: tenantId, name: input.name, language: input.locale, is_active: true },
    });
    if (existing) {
      throw new TemplateNameConflictError(input.name, input.locale);
    }

    const template = this.templateRepo.create({
      tenant_id: tenantId,
      name: input.name,
      language: input.locale,
      category: input.category,
      body_template: input.body_template,
      header_template: input.header_template ?? null,
      footer_template: input.footer_template ?? null,
      buttons: input.buttons ?? [],
      variables_schema: input.variables_schema,
      meta_template_status: 'draft',
      meta_template_id: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    const saved = await this.templateRepo.save(template);

    await this.auditComm.log({
      action: 'template_created',
      resource_id: saved.id,
      tenant_id: tenantId,
      details: { name: input.name, locale: input.locale, category: input.category },
    });

    await this.kafkaProducer.publish(Topics.COMM_TEMPLATE_CREATED, {
      template_id: saved.id, tenant_id: tenantId, name: input.name, locale: input.locale,
    });

    this.logger.log({
      action: 'template_created',
      template_id: saved.id,
      tenant_id: tenantId,
      name: input.name,
      locale: input.locale,
    });

    return saved;
  }

  async findById(id: string): Promise<CommTemplate> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) throw new BadRequestException('TENANT_CONTEXT_MISSING');

    const template = await this.templateRepo.findOne({
      where: { id, tenant_id: tenantId, is_active: true },
    });
    if (!template) throw new TemplateNotFoundError(id);
    return template;
  }

  async findByName(tenantId: string, name: string, locale: Locale): Promise<CommTemplate | null> {
    const direct = await this.templateRepo.findOne({
      where: { tenant_id: tenantId, name, language: locale, is_active: true },
    });
    if (direct) return direct;

    const fallbackChain = this.localeFallback.getFallbackChain(locale);
    for (const fallbackLocale of fallbackChain) {
      const fallback = await this.templateRepo.findOne({
        where: { tenant_id: tenantId, name, language: fallbackLocale, is_active: true },
      });
      if (fallback) {
        this.logger.warn({
          action: 'template_locale_fallback',
          requested_locale: locale,
          fallback_locale: fallbackLocale,
          template_name: name,
          tenant_id: tenantId,
        });
        return fallback;
      }
    }

    return null;
  }

  async update(id: string, patch: UpdateTemplateInput): Promise<CommTemplate> {
    const existing = await this.findById(id);
    const tenantId = this.tenantContext.getCurrentTenantId()!;

    const merged = { ...existing, ...patch };
    this.validateMetaConstraints(merged as CreateTemplateInput);

    const contentChanged = (
      patch.body_template !== undefined && patch.body_template !== existing.body_template
    ) || (
      patch.header_template !== undefined && patch.header_template !== existing.header_template
    ) || (
      patch.footer_template !== undefined && patch.footer_template !== existing.footer_template
    );

    Object.assign(existing, patch, {
      updated_at: new Date(),
      meta_template_status: contentChanged ? 'draft' : existing.meta_template_status,
      meta_template_id: contentChanged ? null : existing.meta_template_id,
    });

    const saved = await this.templateRepo.save(existing);

    await this.auditComm.log({
      action: 'template_updated',
      resource_id: id,
      tenant_id: tenantId,
      details: { content_changed: contentChanged, fields: Object.keys(patch) },
    });

    await this.kafkaProducer.publish(Topics.COMM_TEMPLATE_UPDATED, {
      template_id: id, tenant_id: tenantId, name: saved.name, locale: saved.language,
      content_changed: contentChanged,
    });

    return saved;
  }

  async delete(id: string): Promise<void> {
    const existing = await this.findById(id);
    const tenantId = this.tenantContext.getCurrentTenantId()!;

    const usageCount = await this.messageRepo.count({
      where: { template_id: id },
    });
    if (usageCount > 0) {
      throw new TemplateLockedError(id, usageCount);
    }

    existing.is_active = false;
    existing.updated_at = new Date();
    await this.templateRepo.save(existing);

    await this.auditComm.log({
      action: 'template_deleted',
      resource_id: id,
      tenant_id: tenantId,
      details: { name: existing.name, locale: existing.language },
    });

    await this.kafkaProducer.publish(Topics.COMM_TEMPLATE_DELETED, {
      template_id: id, tenant_id: tenantId, name: existing.name, locale: existing.language,
    });
  }

  async submitForApproval(id: string): Promise<CommTemplate> {
    const existing = await this.findById(id);
    const tenantId = this.tenantContext.getCurrentTenantId()!;

    if (existing.meta_template_status !== 'draft' && existing.meta_template_status !== 'rejected') {
      throw new InvalidTemplateStateError(id, existing.meta_template_status);
    }

    this.validateMetaConstraints(existing as unknown as CreateTemplateInput);

    if (existing.category === 'email_only') {
      // Email templates do not require Meta approval
      existing.meta_template_status = 'approved';
      existing.approved_at = new Date();
      const saved = await this.templateRepo.save(existing);
      await this.auditComm.log({
        action: 'template_email_auto_approved',
        resource_id: id, tenant_id: tenantId,
        details: { name: existing.name, locale: existing.language },
      });
      return saved;
    }

    existing.meta_template_status = 'pending_review';
    existing.submitted_at = new Date();
    await this.templateRepo.save(existing);

    const startMs = Date.now();
    try {
      const metaResponse = await this.metaClient.submitTemplate({
        name: existing.name,
        language: mapLocaleToMeta(existing.language as Locale),
        category: this.mapCategoryToMeta(existing.category as TemplateCategory),
        components: this.buildMetaComponents(existing),
      });

      existing.meta_template_id = metaResponse.id;
      await this.templateRepo.save(existing);

      await this.auditComm.log({
        action: 'template_submitted',
        resource_id: id, tenant_id: tenantId,
        details: {
          meta_template_id: metaResponse.id,
          name: existing.name,
          locale: existing.language,
          duration_ms: Date.now() - startMs,
        },
      });

      await this.kafkaProducer.publish(Topics.COMM_TEMPLATE_SUBMITTED, {
        template_id: id, tenant_id: tenantId, meta_template_id: metaResponse.id,
        name: existing.name, locale: existing.language,
      });

      return existing;
    } catch (err) {
      this.logger.error({
        action: 'template_submit_meta_failed',
        template_id: id,
        err: err instanceof Error ? err.message : err,
      });
      existing.meta_template_status = 'draft';
      existing.submitted_at = null;
      await this.templateRepo.save(existing);
      await this.kafkaProducer.publish(Topics.COMM_TEMPLATE_SUBMIT_FAILED, {
        template_id: id, tenant_id: tenantId,
        error: err instanceof Error ? err.message : 'unknown',
      });
      throw err;
    }
  }

  async markApproved(metaTemplateId: string, approvedAt: Date): Promise<void> {
    const template = await this.templateRepo.findOne({
      where: { meta_template_id: metaTemplateId, is_active: true },
    });
    if (!template) {
      this.logger.warn({
        action: 'mark_approved_template_not_found',
        meta_template_id: metaTemplateId,
      });
      return;
    }

    template.meta_template_status = 'approved';
    template.approved_at = approvedAt;
    template.rejected_reason = null;
    await this.templateRepo.save(template);

    await this.auditComm.log({
      action: 'template_approved',
      resource_id: template.id, tenant_id: template.tenant_id,
      details: { meta_template_id: metaTemplateId, approved_at: approvedAt.toISOString() },
    });

    await this.kafkaProducer.publish(Topics.COMM_TEMPLATE_APPROVED, {
      template_id: template.id, tenant_id: template.tenant_id,
      meta_template_id: metaTemplateId, name: template.name, locale: template.language,
    });
  }

  async markRejected(metaTemplateId: string, reason: string, rejectedAt: Date): Promise<void> {
    const template = await this.templateRepo.findOne({
      where: { meta_template_id: metaTemplateId, is_active: true },
    });
    if (!template) {
      this.logger.warn({
        action: 'mark_rejected_template_not_found',
        meta_template_id: metaTemplateId,
      });
      return;
    }

    template.meta_template_status = 'rejected';
    template.rejected_reason = reason;
    template.rejected_at = rejectedAt;
    await this.templateRepo.save(template);

    await this.auditComm.log({
      action: 'template_rejected',
      resource_id: template.id, tenant_id: template.tenant_id,
      details: { meta_template_id: metaTemplateId, reason, rejected_at: rejectedAt.toISOString() },
    });

    await this.kafkaProducer.publish(Topics.COMM_TEMPLATE_REJECTED, {
      template_id: template.id, tenant_id: template.tenant_id,
      meta_template_id: metaTemplateId, reason,
      name: template.name, locale: template.language,
    });
  }

  async listAll(
    filters: ListFilters,
    pagination: PaginationInput,
  ): Promise<{ items: CommTemplate[]; total: number; page: number; pageSize: number }> {
    const tenantId = this.tenantContext.getCurrentTenantId();
    if (!tenantId) throw new BadRequestException('TENANT_CONTEXT_MISSING');

    const page = Math.max(pagination.page ?? 1, 1);
    const pageSize = Math.min(Math.max(pagination.pageSize ?? 20, 1), 100);

    const where: FindOptionsWhere<CommTemplate> = {
      tenant_id: tenantId,
      is_active: true,
    };
    if (filters.status) where.meta_template_status = filters.status;
    if (filters.category) where.category = filters.category;
    if (filters.locale) where.language = filters.locale;
    if (filters.search) where.name = ILike(`%${filters.search}%`);

    const [items, total] = await this.templateRepo.findAndCount({
      where,
      order: { updated_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total, page, pageSize };
  }

  private validateMetaConstraints(input: Partial<CreateTemplateInput>): void {
    if (input.body_template !== undefined) {
      if (input.body_template.length > META_BODY_MAX_LENGTH) {
        throw new BodyTooLongError(input.body_template.length, META_BODY_MAX_LENGTH);
      }
      if (EMOJI_REGEX.test(input.body_template)) {
        throw new EmojiInBodyError();
      }
    }

    if (input.header_template && input.header_template.length > META_HEADER_MAX_LENGTH) {
      throw new HeaderTooLongError(input.header_template.length, META_HEADER_MAX_LENGTH);
    }

    if (input.footer_template && VARIABLE_REGEX.test(input.footer_template)) {
      throw new FooterCannotHaveVariablesError();
    }

    if (input.buttons && input.buttons.length > META_BUTTONS_MAX_COUNT) {
      throw new TooManyButtonsError(input.buttons.length, META_BUTTONS_MAX_COUNT);
    }
  }

  private mapCategoryToMeta(category: TemplateCategory): 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' {
    if (category === 'authentication') return 'AUTHENTICATION';
    if (category === 'marketing') return 'MARKETING';
    return 'UTILITY';
  }

  private buildMetaComponents(template: CommTemplate): unknown[] {
    const components: unknown[] = [];
    if (template.header_template) {
      components.push({ type: 'HEADER', format: 'TEXT', text: template.header_template });
    }
    components.push({ type: 'BODY', text: template.body_template });
    if (template.footer_template) {
      components.push({ type: 'FOOTER', text: template.footer_template });
    }
    if (template.buttons && template.buttons.length > 0) {
      components.push({
        type: 'BUTTONS',
        buttons: template.buttons.map((b) => ({
          type: b.type.toUpperCase(),
          text: b.text,
          ...(b.url ? { url: b.url } : {}),
          ...(b.phone_number ? { phone_number: b.phone_number } : {}),
        })),
      });
    }
    return components;
  }
}
```

### 6.2 Fichier 2 / 12 : `template-manager-errors.ts`

```typescript
/**
 * Errors typees pour TemplateManagerService.
 */

export class TemplateManagerError extends Error {
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class TemplateNotFoundError extends TemplateManagerError {
  constructor(id: string) {
    super(`Template not found: ${id}`, 'TEMPLATE_NOT_FOUND');
  }
}

export class TemplateNameConflictError extends TemplateManagerError {
  constructor(name: string, locale: string) {
    super(`Template ${name} already exists for locale ${locale}`, 'TEMPLATE_NAME_CONFLICT');
  }
}

export class TemplateNameReservedError extends TemplateManagerError {
  constructor(name: string) {
    super(`Template name '${name}' is reserved system-only`, 'TEMPLATE_NAME_RESERVED');
  }
}

export class InvalidTemplateStateError extends TemplateManagerError {
  constructor(id: string, currentState: string) {
    super(`Template ${id} is in invalid state ${currentState} for this operation`, 'TEMPLATE_INVALID_STATE');
  }
}

export class BodyTooLongError extends TemplateManagerError {
  constructor(actual: number, max: number) {
    super(`Body length ${actual} exceeds Meta limit ${max}`, 'TEMPLATE_BODY_TOO_LONG');
  }
}

export class HeaderTooLongError extends TemplateManagerError {
  constructor(actual: number, max: number) {
    super(`Header length ${actual} exceeds Meta limit ${max}`, 'TEMPLATE_HEADER_TOO_LONG');
  }
}

export class TooManyButtonsError extends TemplateManagerError {
  constructor(actual: number, max: number) {
    super(`Buttons count ${actual} exceeds Meta limit ${max}`, 'TEMPLATE_TOO_MANY_BUTTONS');
  }
}

export class FooterCannotHaveVariablesError extends TemplateManagerError {
  constructor() {
    super('Meta does not allow variables in footer', 'TEMPLATE_FOOTER_NO_VARIABLES');
  }
}

export class EmojiInBodyError extends TemplateManagerError {
  constructor() {
    super('Emoji in body rejected (decision-006 + Meta policy)', 'TEMPLATE_EMOJI_IN_BODY');
  }
}

export class TemplateLockedError extends TemplateManagerError {
  constructor(id: string, usageCount: number) {
    super(`Template ${id} locked: ${usageCount} messages reference it`, 'TEMPLATE_LOCKED');
  }
}

export function isTemplateManagerError(err: unknown): err is TemplateManagerError {
  return err instanceof TemplateManagerError;
}
```

### 6.3 Fichier 3 / 12 : `meta-template-api.client.ts`

```typescript
/**
 * @insurtech/comm/clients/meta-template-api.client
 *
 * Client Meta Graph API pour soumission templates WhatsApp + check status.
 * Etend le pattern WhatsAppCloudApiClient Tache 3.2.2 avec retry exponential.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request } from 'undici';

interface MetaSubmitTemplateInput {
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  components: unknown[];
}

interface MetaSubmitTemplateResponse {
  id: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: string;
}

interface MetaTemplateStatusResponse {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED' | 'FLAGGED';
  language: string;
  category: string;
  rejected_reason?: string;
}

@Injectable()
export class MetaTemplateApiClient {
  private readonly logger = new Logger(MetaTemplateApiClient.name);
  private readonly baseUrl: string;
  private readonly accessToken: string;
  private readonly businessAccountId: string;
  private readonly maxRetries = 3;
  private readonly backoffMs = [1000, 5000, 30000];

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('WHATSAPP_API_BASE_URL') ?? 'https://graph.facebook.com/v21.0';
    this.accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN') ?? '';
    this.businessAccountId = this.config.get<string>('WHATSAPP_BUSINESS_ACCOUNT_ID') ?? '';
  }

  async submitTemplate(input: MetaSubmitTemplateInput): Promise<MetaSubmitTemplateResponse> {
    const url = `${this.baseUrl}/${this.businessAccountId}/message_templates`;
    return this.requestWithRetry<MetaSubmitTemplateResponse>('POST', url, input);
  }

  async getTemplateStatus(metaTemplateId: string): Promise<MetaTemplateStatusResponse> {
    const url = `${this.baseUrl}/${metaTemplateId}`;
    return this.requestWithRetry<MetaTemplateStatusResponse>('GET', url);
  }

  async listAllTemplates(limit = 100): Promise<MetaTemplateStatusResponse[]> {
    const url = `${this.baseUrl}/${this.businessAccountId}/message_templates?limit=${limit}`;
    const response = await this.requestWithRetry<{ data: MetaTemplateStatusResponse[] }>('GET', url);
    return response.data;
  }

  private async requestWithRetry<T>(method: 'GET' | 'POST', url: string, body?: unknown): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      try {
        const response = await request(url, {
          method,
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (response.statusCode >= 500 || response.statusCode === 429) {
          throw new Error(`Meta API ${response.statusCode}`);
        }
        if (response.statusCode >= 400) {
          const errBody = await response.body.json();
          throw new Error(`Meta API ${response.statusCode}: ${JSON.stringify(errBody)}`);
        }
        return await response.body.json() as T;
      } catch (err) {
        lastErr = err;
        if (attempt < this.maxRetries - 1) {
          this.logger.warn({
            action: 'meta_api_retry', attempt: attempt + 1, url, method,
            err: err instanceof Error ? err.message : err,
          });
          await new Promise((r) => setTimeout(r, this.backoffMs[attempt]));
        }
      }
    }
    throw lastErr;
  }
}
```

### 6.4 Fichier 4 / 12 : `audit-comm.service.ts`

```typescript
/**
 * @insurtech/comm/services/audit-comm.service
 * Extension du pattern AuditAuthService Sprint 5 Tache 2.1.12.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommAuditLog } from '../entities/comm-audit-log.entity.js';
import { hashPiiVariable } from '../helpers/pii-hash.helper.js';

interface AuditLogInput {
  action: string;
  resource_id: string;
  tenant_id: string;
  details?: Record<string, unknown>;
}

@Injectable()
export class AuditCommService {
  private readonly logger = new Logger(AuditCommService.name);

  constructor(
    @InjectRepository(CommAuditLog)
    private readonly auditRepo: Repository<CommAuditLog>,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    const sanitized = this.sanitizePiiInDetails(input.details ?? {});
    const entry = this.auditRepo.create({
      tenant_id: input.tenant_id,
      action: input.action,
      resource_id: input.resource_id,
      details: sanitized,
      created_at: new Date(),
    });
    await this.auditRepo.save(entry);

    this.logger.log({
      action: input.action,
      resource_id: input.resource_id,
      tenant_id: input.tenant_id,
      details_keys: Object.keys(sanitized),
    });
  }

  private sanitizePiiInDetails(details: Record<string, unknown>): Record<string, unknown> {
    const piiFields = new Set(['user_name', 'phone', 'email', 'montant', 'amount', 'police_number']);
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(details)) {
      if (piiFields.has(key) && typeof value === 'string') {
        sanitized[`${key}_hash`] = hashPiiVariable(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }
}
```

### 6.5 Fichier 5 / 12 : `pii-hash.helper.ts`

```typescript
/**
 * Helper pour hash PII variables avant logging.
 * Conformite CNDP loi 09-08 : pas de PII en clair dans logs.
 */

import { createHash } from 'node:crypto';

export function hashPiiVariable(value: string): string {
  if (!value || typeof value !== 'string') return '';
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

export function isPiiField(fieldName: string): boolean {
  const piiFields = new Set([
    'user_name', 'first_name', 'last_name', 'full_name',
    'phone', 'email', 'address',
    'montant', 'amount', 'price', 'prime_amount',
    'police_number', 'contract_number', 'cin', 'rib', 'iban',
  ]);
  return piiFields.has(fieldName);
}
```

### 6.6 Fichier 6 / 12 : `templates.controller.ts`

```typescript
/**
 * @apps/api/modules/comm/controllers/templates.controller
 *
 * REST endpoints CRUD templates + workflow Meta approval.
 */

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  HttpCode, HttpStatus, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ZodValidationPipe } from '@insurtech/validation';
import { JwtAuthGuard, RequirePermission, PermissionsGuard } from '@insurtech/auth';
import { TemplateManagerService } from '@insurtech/comm';
import {
  CreateTemplateDto, UpdateTemplateDto, SubmitTemplateDto, TemplateFiltersDto,
  CreateTemplateSchema, UpdateTemplateSchema, TemplateFiltersSchema,
} from '../dto/template.dto.js';

@ApiTags('Comm Templates')
@Controller({ path: 'comm/templates', version: '1' })
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TemplatesController {
  constructor(private readonly manager: TemplateManagerService) {}

  @Get()
  @RequirePermission('comm.templates.read')
  @ApiOperation({ summary: 'List templates with filters + pagination' })
  async list(
    @Query(new ZodValidationPipe(TemplateFiltersSchema)) query: TemplateFiltersDto,
  ) {
    const { page, pageSize, ...filters } = query;
    return this.manager.listAll(filters, { page, pageSize });
  }

  @Get(':id')
  @RequirePermission('comm.templates.read')
  @ApiOperation({ summary: 'Get template by ID' })
  async findById(@Param('id') id: string) {
    return this.manager.findById(id);
  }

  @Post()
  @RequirePermission('comm.templates.manage')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new template (draft)' })
  @ApiResponse({ status: 201, description: 'Template created' })
  async create(
    @Body(new ZodValidationPipe(CreateTemplateSchema)) dto: CreateTemplateDto,
  ) {
    return this.manager.create(dto);
  }

  @Patch(':id')
  @RequirePermission('comm.templates.manage')
  @ApiOperation({ summary: 'Update template (resets to draft if content changed)' })
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTemplateSchema)) dto: UpdateTemplateDto,
  ) {
    return this.manager.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('comm.templates.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete template (rejected if in production usage)' })
  async delete(@Param('id') id: string) {
    await this.manager.delete(id);
  }

  @Post(':id/submit')
  @RequirePermission('comm.templates.manage')
  @ApiOperation({ summary: 'Submit template to Meta for approval workflow' })
  @ApiResponse({ status: 200, description: 'Template submitted to Meta' })
  async submit(@Param('id') id: string) {
    return this.manager.submitForApproval(id);
  }

  @Get('meta-status/sync')
  @RequirePermission('comm.templates.manage')
  @ApiOperation({ summary: 'Resync all template statuses from Meta API (nightly job manual trigger)' })
  async syncMetaStatus() {
    // Sprint 18 cron will automate this; manual trigger for admin Sprint 27
    return { status: 'sync_initiated', message: 'Sync deferred to Sprint 18 cron orchestration' };
  }
}
```

### 6.7 Fichier 7 / 12 : `template.dto.ts`

```typescript
/**
 * DTOs Zod pour Template CRUD + workflow.
 */

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

const LocaleSchema = z.enum(['fr', 'ar-MA', 'ar', 'en']);
const CategorySchema = z.enum(['utility', 'transactional', 'marketing', 'authentication', 'email_only']);
const StatusSchema = z.enum(['draft', 'pending_review', 'approved', 'rejected']);

const ButtonSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('quick_reply'),
    text: z.string().min(1).max(25),
  }),
  z.object({
    type: z.literal('url'),
    text: z.string().min(1).max(25),
    url: z.string().url().max(2000),
  }),
  z.object({
    type: z.literal('phone_number'),
    text: z.string().min(1).max(25),
    phone_number: z.string().regex(/^\+\d{10,15}$/),
  }),
  z.object({
    type: z.literal('copy_code'),
    text: z.string().min(1).max(25),
  }),
]);

const VariablesSchemaSchema = z.object({
  order: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).max(20),
  required: z.array(z.string()).max(20),
  schema: z.record(z.string(), z.enum(['string', 'number', 'date'])),
});

const NameSchema = z.string()
  .min(3).max(100)
  .regex(/^[a-z][a-z0-9_]*$/, 'Template name must be snake_case lowercase');

const BodyTemplateSchema = z.string()
  .min(1).max(1024, 'Body exceeds Meta 1024 chars limit')
  .refine((v) => !/[\u{1F300}-\u{1F9FF}]/u.test(v), {
    message: 'Emoji not allowed in body (decision-006 + Meta policy)',
  });

const HeaderTemplateSchema = z.string().min(1).max(60).optional();
const FooterTemplateSchema = z.string()
  .min(1).max(60)
  .refine((v) => !/\{\{.+\}\}/.test(v), {
    message: 'Footer cannot contain variables (Meta restriction)',
  })
  .optional();

export const CreateTemplateSchema = z.object({
  name: NameSchema,
  locale: LocaleSchema,
  category: CategorySchema,
  body_template: BodyTemplateSchema,
  header_template: HeaderTemplateSchema,
  footer_template: FooterTemplateSchema,
  buttons: z.array(ButtonSchema).max(10).optional(),
  variables_schema: VariablesSchemaSchema,
});
export class CreateTemplateDto extends createZodDto(CreateTemplateSchema) {}

export const UpdateTemplateSchema = z.object({
  body_template: BodyTemplateSchema.optional(),
  header_template: HeaderTemplateSchema,
  footer_template: FooterTemplateSchema,
  buttons: z.array(ButtonSchema).max(10).optional(),
  variables_schema: VariablesSchemaSchema.optional(),
  category: CategorySchema.optional(),
});
export class UpdateTemplateDto extends createZodDto(UpdateTemplateSchema) {}

export const SubmitTemplateSchema = z.object({});
export class SubmitTemplateDto extends createZodDto(SubmitTemplateSchema) {}

export const TemplateFiltersSchema = z.object({
  status: StatusSchema.optional(),
  category: CategorySchema.optional(),
  locale: LocaleSchema.optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export class TemplateFiltersDto extends createZodDto(TemplateFiltersSchema) {}
```

### 6.8 Fichier 8 / 12 : `seed-comm-templates.ts`

```typescript
/**
 * @infrastructure/scripts/seed-comm-templates
 *
 * Seeds idempotents 80 templates (20 cas d'usage x 4 locales fr / ar-MA / ar / en).
 * Pattern UPSERT par cle composite (tenant_id, name, language).
 * Run command : pnpm --filter @insurtech/api seed:comm-templates --tenant=<id>
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.5
 *   - Sprint 6 onboarding tenant pipeline (auto-seed tier_starter)
 *   - decision-006 (No-emoji)
 *   - decision-009 (Multi-locale 4 locales)
 */

import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { CommTemplate } from '../../packages/comm/src/entities/comm-template.entity.js';
import { dataSourceOptions } from '../../apps/api/src/config/data-source.js';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const logger = new Logger('SeedCommTemplates');

interface SeedTemplate {
  name: string;
  category: 'utility' | 'transactional' | 'marketing' | 'authentication' | 'email_only';
  locales: {
    fr: LocaleData;
    'ar-MA': LocaleData;
    ar: LocaleData;
    en: LocaleData;
  };
  variables_schema: {
    order: string[];
    required: string[];
    schema: Record<string, 'string' | 'number' | 'date'>;
  };
  buttons?: Array<Record<string, unknown>>;
}

interface LocaleData {
  body_template: string;
  header_template?: string;
  footer_template?: string;
}

const TEMPLATES_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'packages',
  'comm',
  'src',
  'templates',
  'seed-data',
);

const MODULES = ['auth', 'booking', 'insure', 'repair', 'tenant'] as const;

function loadAllSeeds(): SeedTemplate[] {
  const seeds: SeedTemplate[] = [];
  for (const moduleName of MODULES) {
    const moduleDir = join(TEMPLATES_ROOT, moduleName);
    if (!existsSync(moduleDir)) {
      logger.warn(`Module dir missing: ${moduleDir}`);
      continue;
    }
    const files = readdirSync(moduleDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const path = join(moduleDir, file);
      const raw = readFileSync(path, 'utf-8');
      const seed = JSON.parse(raw) as SeedTemplate;
      seeds.push(seed);
    }
  }
  return seeds;
}

async function seedTemplatesForTenant(dataSource: DataSource, tenantId: string): Promise<{ inserted: number; updated: number; skipped: number }> {
  const repo = dataSource.getRepository(CommTemplate);
  const seeds = loadAllSeeds();
  if (seeds.length !== 20) {
    throw new Error(`Expected 20 unique seeds, got ${seeds.length}. Check seed-data dir.`);
  }
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const locales: Array<keyof SeedTemplate['locales']> = ['fr', 'ar-MA', 'ar', 'en'];

  for (const seed of seeds) {
    for (const locale of locales) {
      const localeData = seed.locales[locale];
      if (!localeData || !localeData.body_template) {
        logger.warn({ name: seed.name, locale }, 'Locale data missing -- skip');
        skipped += 1;
        continue;
      }

      // Validate Meta constraints
      if (localeData.body_template.length > 1024) {
        throw new Error(`Body exceeds 1024 chars : ${seed.name}/${locale}`);
      }
      if (localeData.header_template && localeData.header_template.length > 60) {
        throw new Error(`Header exceeds 60 chars : ${seed.name}/${locale}`);
      }
      if (localeData.footer_template && /\{\{.+\}\}/.test(localeData.footer_template)) {
        throw new Error(`Footer contains variable : ${seed.name}/${locale}`);
      }
      if (/[\u{1F300}-\u{1F9FF}]/u.test(localeData.body_template)) {
        throw new Error(`Emoji detected (decision-006) : ${seed.name}/${locale}`);
      }

      const existing = await repo.findOne({
        where: { tenant_id: tenantId, name: seed.name, language: locale },
      });

      if (existing) {
        // Skip if already approved by Meta -- do not overwrite production-grade content
        if (existing.meta_template_status === 'approved' || existing.meta_template_status === 'pending_review') {
          logger.log({ name: seed.name, locale, status: existing.meta_template_status }, 'Skip approved/pending');
          skipped += 1;
          continue;
        }
        // Update draft / rejected
        existing.body_template = localeData.body_template;
        existing.header_template = localeData.header_template ?? null;
        existing.footer_template = localeData.footer_template ?? null;
        existing.buttons = (seed.buttons ?? []) as never;
        existing.variables_schema = seed.variables_schema as never;
        existing.category = seed.category;
        existing.updated_at = new Date();
        await repo.save(existing);
        updated += 1;
      } else {
        const created = repo.create({
          tenant_id: tenantId,
          name: seed.name,
          language: locale,
          category: seed.category,
          body_template: localeData.body_template,
          header_template: localeData.header_template ?? null,
          footer_template: localeData.footer_template ?? null,
          buttons: (seed.buttons ?? []) as never,
          variables_schema: seed.variables_schema as never,
          meta_template_status: 'draft',
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        });
        await repo.save(created);
        inserted += 1;
      }
    }
  }

  logger.log({
    tenantId,
    inserted,
    updated,
    skipped,
    total_processed: inserted + updated + skipped,
  });

  return { inserted, updated, skipped };
}

async function main() {
  const tenantArg = process.argv.find((a) => a.startsWith('--tenant='));
  if (!tenantArg) {
    logger.error('Missing --tenant=<id> argument');
    process.exit(1);
  }
  const tenantId = tenantArg.split('=')[1];

  const dataSource = new DataSource(dataSourceOptions);
  await dataSource.initialize();

  try {
    const result = await seedTemplatesForTenant(dataSource, tenantId);
    if (result.inserted + result.updated + result.skipped !== 80) {
      logger.warn({ result }, 'Total processed != 80 (20 templates x 4 locales)');
    }
    logger.log('Seed completed');
    process.exit(0);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : err }, 'Seed failed');
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}

export { seedTemplatesForTenant, loadAllSeeds };
```

### 6.9 Fichier 9 / 12 : `seed-data/auth/email_verification.json`

```json
{
  "name": "email_verification",
  "category": "authentication",
  "variables_schema": {
    "order": ["user_name", "verify_url", "ttl_hours"],
    "required": ["user_name", "verify_url", "ttl_hours"],
    "schema": {
      "user_name": "string",
      "verify_url": "string",
      "ttl_hours": "number"
    }
  },
  "locales": {
    "fr": {
      "body_template": "Bonjour {{user_name}}, bienvenue sur Skalean InsurTech. Pour activer votre compte, confirmez votre email en cliquant ce lien : {{verify_url}}. Le lien est valide {{ttl_hours}} heures.",
      "header_template": "Verification email Skalean",
      "footer_template": "Skalean SARL RC Casablanca"
    },
    "ar-MA": {
      "body_template": "Salam {{user_name}}, mer7ba bik f Skalean InsurTech. Bach tfa3l l7isab dyalek, wakad email dyalek men hna : {{verify_url}}. Lina 9adira {{ttl_hours}} sa3a.",
      "header_template": "Wakad email Skalean",
      "footer_template": "Skalean SARL RC Casablanca"
    },
    "ar": {
      "body_template": "السلام عليكم {{user_name}}، مرحبا بكم في Skalean InsurTech. لتفعيل حسابكم، يرجى تأكيد البريد الإلكتروني عبر الرابط التالي : {{verify_url}}. الرابط صالح لمدة {{ttl_hours}} ساعة.",
      "header_template": "تأكيد البريد الإلكتروني",
      "footer_template": "Skalean SARL RC Casablanca"
    },
    "en": {
      "body_template": "Hello {{user_name}}, welcome to Skalean InsurTech. To activate your account, please confirm your email by clicking this link : {{verify_url}}. The link is valid for {{ttl_hours}} hours.",
      "header_template": "Skalean email verification",
      "footer_template": "Skalean SARL RC Casablanca"
    }
  },
  "buttons": [
    { "type": "url", "text": "Verifier", "url": "{{verify_url}}" }
  ]
}
```

### 6.10 Fichier 10 / 12 : `seed-data/auth/password_reset.json`

```json
{
  "name": "password_reset",
  "category": "authentication",
  "variables_schema": {
    "order": ["user_name", "reset_url", "ttl_hours"],
    "required": ["user_name", "reset_url", "ttl_hours"],
    "schema": {
      "user_name": "string",
      "reset_url": "string",
      "ttl_hours": "number"
    }
  },
  "locales": {
    "fr": {
      "body_template": "Bonjour {{user_name}}, vous avez demande la reinitialisation de votre mot de passe Skalean. Cliquez ici pour creer un nouveau mot de passe : {{reset_url}}. Le lien expire dans {{ttl_hours}} heure(s). Si vous n'avez pas fait cette demande, ignorez cet email.",
      "header_template": "Reinitialisation mot de passe",
      "footer_template": "Securite Skalean InsurTech"
    },
    "ar-MA": {
      "body_template": "Salam {{user_name}}, tlabti tjdid kalimat sir dyalek f Skalean. Dorok hna bach tdir kalima jdida : {{reset_url}}. Lina ghadi tsali f {{ttl_hours}} sa3a. Ila ma drtsh ntiya hadi, tjahel had email.",
      "header_template": "Tjdid kalimat sir",
      "footer_template": "Aman Skalean InsurTech"
    },
    "ar": {
      "body_template": "السلام عليكم {{user_name}}، لقد طلبتم إعادة تعيين كلمة السر الخاصة بكم في Skalean. اضغطوا هنا لإنشاء كلمة سر جديدة : {{reset_url}}. الرابط ينتهي خلال {{ttl_hours}} ساعة. إذا لم تقوموا بهذا الطلب، تجاهلوا هذا البريد.",
      "header_template": "إعادة تعيين كلمة السر",
      "footer_template": "أمان Skalean InsurTech"
    },
    "en": {
      "body_template": "Hello {{user_name}}, you have requested a password reset for your Skalean account. Click here to create a new password : {{reset_url}}. The link expires in {{ttl_hours}} hour(s). If you did not request this, please ignore this email.",
      "header_template": "Password reset",
      "footer_template": "Skalean InsurTech security"
    }
  },
  "buttons": [
    { "type": "url", "text": "Reinitialiser", "url": "{{reset_url}}" }
  ]
}
```

### 6.11 Fichier 11 / 12 : `seed-data/booking/appointment_scheduled.json`

```json
{
  "name": "appointment_scheduled",
  "category": "transactional",
  "variables_schema": {
    "order": ["user_name", "date", "time", "broker_name", "address"],
    "required": ["user_name", "date", "time", "broker_name", "address"],
    "schema": {
      "user_name": "string",
      "date": "string",
      "time": "string",
      "broker_name": "string",
      "address": "string"
    }
  },
  "locales": {
    "fr": {
      "body_template": "Bonjour {{user_name}}, votre rendez-vous du {{date}} a {{time}} avec {{broker_name}} est confirme. Adresse : {{address}}. Pour reprogrammer ou annuler, contactez votre courtier.",
      "header_template": "Confirmation rendez-vous",
      "footer_template": "Skalean Booking"
    },
    "ar-MA": {
      "body_template": "Salam {{user_name}}, mawidek f {{date}} f {{time}} m3a {{broker_name}} mwakad. L3onwan : {{address}}. Bach tbdel wla tlgha, kalim courtier dyalek.",
      "header_template": "Tawkid mawid",
      "footer_template": "Skalean Booking"
    },
    "ar": {
      "body_template": "السلام عليكم {{user_name}}، تم تأكيد موعدكم بتاريخ {{date}} على الساعة {{time}} مع {{broker_name}}. العنوان : {{address}}. لإعادة الجدولة أو الإلغاء، يرجى التواصل مع وسيطكم.",
      "header_template": "تأكيد الموعد",
      "footer_template": "Skalean Booking"
    },
    "en": {
      "body_template": "Hello {{user_name}}, your appointment on {{date}} at {{time}} with {{broker_name}} is confirmed. Address : {{address}}. To reschedule or cancel, please contact your broker.",
      "header_template": "Appointment confirmation",
      "footer_template": "Skalean Booking"
    }
  },
  "buttons": [
    { "type": "quick_reply", "text": "Confirmer" },
    { "type": "quick_reply", "text": "Reprogrammer" }
  ]
}
```

### 6.12 Fichier 12 / 12 : `seed-data/index.ts` (registry + descriptifs 20 templates)

```typescript
/**
 * Registry des 20 templates seed avec descriptifs.
 * Ce fichier sert de catalogue de reference pour la documentation Sprint 27 admin UI.
 */

export interface TemplateDescriptor {
  name: string;
  module: 'auth' | 'booking' | 'insure' | 'repair' | 'tenant';
  category: 'utility' | 'transactional' | 'marketing' | 'authentication' | 'email_only';
  description_fr: string;
  trigger_event: string;
  variables: string[];
  consumed_by_sprint: number[];
}

export const TEMPLATE_REGISTRY: TemplateDescriptor[] = [
  // ===== AUTH (5) =====
  {
    name: 'email_verification',
    module: 'auth',
    category: 'authentication',
    description_fr: 'Email verification a la creation de compte (signup Sprint 5).',
    trigger_event: 'auth.user_signed_up',
    variables: ['user_name', 'verify_url', 'ttl_hours'],
    consumed_by_sprint: [5],
  },
  {
    name: 'password_reset',
    module: 'auth',
    category: 'authentication',
    description_fr: 'Reinitialisation mot de passe sur demande user (Sprint 5 recovery).',
    trigger_event: 'auth.password_reset_requested',
    variables: ['user_name', 'reset_url', 'ttl_hours'],
    consumed_by_sprint: [5],
  },
  {
    name: 'password_changed_notification',
    module: 'auth',
    category: 'authentication',
    description_fr: 'Confirmation post-changement password (alerte securite Sprint 5).',
    trigger_event: 'auth.password_changed',
    variables: ['user_name', 'changed_at', 'ip', 'support_url'],
    consumed_by_sprint: [5],
  },
  {
    name: 'mfa_enabled_notification',
    module: 'auth',
    category: 'authentication',
    description_fr: 'Confirmation MFA active (Sprint 5 Tache 2.1.8).',
    trigger_event: 'auth.mfa_enabled',
    variables: ['user_name', 'recovery_codes_count', 'manage_mfa_url'],
    consumed_by_sprint: [5],
  },
  {
    name: 'account_locked_notification',
    module: 'auth',
    category: 'authentication',
    description_fr: 'Notification compte verrouille apres N echecs auth (Sprint 5 Tache 2.1.10).',
    trigger_event: 'auth.account_locked',
    variables: ['user_name', 'tier', 'locked_until', 'recovery_url'],
    consumed_by_sprint: [5],
  },
  // ===== BOOKING (3) =====
  {
    name: 'appointment_scheduled',
    module: 'booking',
    category: 'transactional',
    description_fr: 'Confirmation rendez-vous courtier-assure programme (Sprint 8).',
    trigger_event: 'booking.appointment_scheduled',
    variables: ['user_name', 'date', 'time', 'broker_name', 'address'],
    consumed_by_sprint: [8],
  },
  {
    name: 'appointment_reminder_24h',
    module: 'booking',
    category: 'transactional',
    description_fr: 'Rappel rendez-vous J-1 (cron Sprint 8 BullMQ scheduled).',
    trigger_event: 'booking.appointment_reminder_24h',
    variables: ['user_name', 'date', 'time', 'broker_name'],
    consumed_by_sprint: [8],
  },
  {
    name: 'appointment_cancelled',
    module: 'booking',
    category: 'transactional',
    description_fr: 'Notification annulation rendez-vous (Sprint 8).',
    trigger_event: 'booking.appointment_cancelled',
    variables: ['user_name', 'date', 'time', 'cancellation_reason'],
    consumed_by_sprint: [8],
  },
  // ===== INSURE (5) =====
  {
    name: 'quote_generated',
    module: 'insure',
    category: 'transactional',
    description_fr: 'Devis assurance genere et disponible pour signature (Sprint 14).',
    trigger_event: 'insure.quote_generated',
    variables: ['user_name', 'quote_id', 'amount', 'view_url', 'expires_at'],
    consumed_by_sprint: [14],
  },
  {
    name: 'police_signed_confirmation',
    module: 'insure',
    category: 'transactional',
    description_fr: 'Confirmation signature police d''assurance (Sprint 14 + Sprint 11 signature).',
    trigger_event: 'insure.police_signed',
    variables: ['user_name', 'police_number', 'effective_date', 'amount'],
    consumed_by_sprint: [14],
  },
  {
    name: 'police_renewal_reminder',
    module: 'insure',
    category: 'transactional',
    description_fr: 'Rappel renouvellement police J-30 avant expiration (Sprint 14 cron).',
    trigger_event: 'insure.police_renewal_reminder',
    variables: ['user_name', 'police_number', 'expiry_date', 'renew_url'],
    consumed_by_sprint: [14],
  },
  {
    name: 'payment_due_reminder',
    module: 'insure',
    category: 'transactional',
    description_fr: 'Rappel paiement prime due (Sprint 18 Books).',
    trigger_event: 'insure.payment_due',
    variables: ['user_name', 'amount', 'due_date', 'pay_url'],
    consumed_by_sprint: [18],
  },
  {
    name: 'claim_received_acknowledgement',
    module: 'insure',
    category: 'transactional',
    description_fr: 'Accuse reception declaration sinistre (Sprint 14).',
    trigger_event: 'insure.claim_received',
    variables: ['user_name', 'claim_id', 'received_at', 'next_steps_url'],
    consumed_by_sprint: [14],
  },
  // ===== REPAIR (4) =====
  {
    name: 'sinistre_acknowledged',
    module: 'repair',
    category: 'transactional',
    description_fr: 'Accuse reception declaration sinistre cote reparateur (Sprint 20).',
    trigger_event: 'repair.sinistre_acknowledged',
    variables: ['user_name', 'sinistre_id', 'garage_name', 'estimated_arrival'],
    consumed_by_sprint: [20],
  },
  {
    name: 'devis_ready',
    module: 'repair',
    category: 'transactional',
    description_fr: 'Devis reparation pret pour validation (Sprint 20).',
    trigger_event: 'repair.devis_ready',
    variables: ['user_name', 'devis_id', 'amount', 'view_url'],
    consumed_by_sprint: [20],
  },
  {
    name: 'reparation_started',
    module: 'repair',
    category: 'transactional',
    description_fr: 'Reparation demarree garage (Sprint 20 + tracking).',
    trigger_event: 'repair.started',
    variables: ['user_name', 'sinistre_id', 'estimated_completion'],
    consumed_by_sprint: [20],
  },
  {
    name: 'reparation_completed',
    module: 'repair',
    category: 'transactional',
    description_fr: 'Reparation terminee, vehicule pret (Sprint 20).',
    trigger_event: 'repair.completed',
    variables: ['user_name', 'sinistre_id', 'pickup_url'],
    consumed_by_sprint: [20],
  },
  // ===== TENANT (3) =====
  {
    name: 'tenant_invitation',
    module: 'tenant',
    category: 'transactional',
    description_fr: 'Invitation utilisateur a rejoindre tenant (Sprint 6).',
    trigger_event: 'tenant.user_invited',
    variables: ['inviter_name', 'tenant_name', 'invite_url', 'role', 'expires_at'],
    consumed_by_sprint: [6],
  },
  {
    name: 'tenant_suspended_notification',
    module: 'tenant',
    category: 'transactional',
    description_fr: 'Notification suspension tenant pour non-paiement (Sprint 6).',
    trigger_event: 'tenant.suspended',
    variables: ['admin_name', 'tenant_name', 'reason', 'reactivate_url'],
    consumed_by_sprint: [6],
  },
  {
    name: 'quota_warning_80percent',
    module: 'tenant',
    category: 'utility',
    description_fr: 'Alerte quota tenant atteint 80 percent (Sprint 6 + Sprint 33 monitoring).',
    trigger_event: 'tenant.quota_warning_80',
    variables: ['admin_name', 'tenant_name', 'quota_type', 'usage_percent', 'upgrade_url'],
    consumed_by_sprint: [6, 33],
  },
];

export const TEMPLATE_NAMES = TEMPLATE_REGISTRY.map((t) => t.name);
export const TEMPLATE_BY_MODULE = MODULES_GROUP();

function MODULES_GROUP() {
  const grouped: Record<string, string[]> = {};
  for (const t of TEMPLATE_REGISTRY) {
    grouped[t.module] = grouped[t.module] ?? [];
    grouped[t.module].push(t.name);
  }
  return grouped;
}

if (TEMPLATE_REGISTRY.length !== 20) {
  throw new Error(`Registry must have exactly 20 templates (got ${TEMPLATE_REGISTRY.length}).`);
}
```

### 6.13 Fichier supplementaire : `seed-data/insure/police_signed_confirmation.json`

```json
{
  "name": "police_signed_confirmation",
  "category": "transactional",
  "variables_schema": {
    "order": ["user_name", "police_number", "effective_date", "amount"],
    "required": ["user_name", "police_number", "effective_date", "amount"],
    "schema": {
      "user_name": "string",
      "police_number": "string",
      "effective_date": "string",
      "amount": "number"
    }
  },
  "locales": {
    "fr": {
      "body_template": "Bonjour {{user_name}}, votre police d'assurance numero {{police_number}} a ete signee avec succes. Date d'effet : {{effective_date}}. Montant prime : {{amount}} MAD. Vous recevrez votre attestation digitale sous 24h.",
      "header_template": "Police signee",
      "footer_template": "Skalean Assurance"
    },
    "ar-MA": {
      "body_template": "Salam {{user_name}}, police dyalek ra9m {{police_number}} mwa9a3 b najah. Tarikh dakhal f l3amal : {{effective_date}}. Mablagh prime : {{amount}} MAD. Ghadi tweslek attestation digital f 24 sa3a.",
      "header_template": "Police mwa9a3",
      "footer_template": "Skalean Assurance"
    },
    "ar": {
      "body_template": "السلام عليكم {{user_name}}، تم توقيع وثيقة التأمين رقم {{police_number}} بنجاح. تاريخ السريان : {{effective_date}}. مبلغ القسط : {{amount}} درهم. ستصلكم شهادة التأمين الرقمية خلال 24 ساعة.",
      "header_template": "وثيقة موقعة",
      "footer_template": "Skalean Assurance"
    },
    "en": {
      "body_template": "Hello {{user_name}}, your insurance policy number {{police_number}} has been signed successfully. Effective date : {{effective_date}}. Premium amount : {{amount}} MAD. You will receive your digital certificate within 24h.",
      "header_template": "Policy signed",
      "footer_template": "Skalean Assurance"
    }
  }
}
```

### 6.14 Fichier supplementaire : `seed-data/repair/sinistre_acknowledged.json`

```json
{
  "name": "sinistre_acknowledged",
  "category": "transactional",
  "variables_schema": {
    "order": ["user_name", "sinistre_id", "garage_name", "estimated_arrival"],
    "required": ["user_name", "sinistre_id", "garage_name"],
    "schema": {
      "user_name": "string",
      "sinistre_id": "string",
      "garage_name": "string",
      "estimated_arrival": "string"
    }
  },
  "locales": {
    "fr": {
      "body_template": "Bonjour {{user_name}}, votre declaration de sinistre numero {{sinistre_id}} a ete prise en charge par {{garage_name}}. Arrivee estimee : {{estimated_arrival}}. Vous serez notifie a chaque etape.",
      "header_template": "Sinistre pris en charge",
      "footer_template": "Skalean Repair"
    },
    "ar-MA": {
      "body_template": "Salam {{user_name}}, declaration sinistre dyalek ra9m {{sinistre_id}} t9bel men taraf {{garage_name}}. Wsoul mt9adar : {{estimated_arrival}}. Ghadi nbalghoukom f kol marhala.",
      "header_template": "Sinistre mt9bal",
      "footer_template": "Skalean Repair"
    },
    "ar": {
      "body_template": "السلام عليكم {{user_name}}، تم استلام تصريح الحادث رقم {{sinistre_id}} من طرف {{garage_name}}. الوصول المقدر : {{estimated_arrival}}. سيتم إعلامكم في كل مرحلة.",
      "header_template": "حادث تم استلامه",
      "footer_template": "Skalean Repair"
    },
    "en": {
      "body_template": "Hello {{user_name}}, your claim declaration number {{sinistre_id}} has been taken in charge by {{garage_name}}. Estimated arrival : {{estimated_arrival}}. You will be notified at each step.",
      "header_template": "Claim acknowledged",
      "footer_template": "Skalean Repair"
    }
  }
}
```

---

## 7. Tests complets

### 7.1 Tests `template-manager.service.spec.ts` (25+ tests unitaires)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TemplateManagerService } from '../../src/services/template-manager.service.js';
import { CommTemplate } from '../../src/entities/comm-template.entity.js';
import { TenantContextService } from '../../../core/src/tenant/tenant-context.service.js';
import { RedisService } from '../../../infra/src/redis/redis.service.js';
import { KafkaProducer } from '../../../infra/src/kafka/kafka-producer.service.js';
import { MetaTemplateApiClient } from '../../src/services/meta-template-api.client.js';
import { AuditCommService } from '../../src/services/audit-comm.service.js';
import {
  TemplateNameConflictError, TemplateNotFoundError, TemplateInvalidStatusTransitionError,
  TemplateBodyTooLongError, TemplateForbiddenLocaleError,
} from '../../src/errors/template-manager-errors.js';

const mockRepo = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
  findAndCount: vi.fn(),
  create: vi.fn((d) => ({ ...d, id: 'tpl-uuid-1' })),
  save: vi.fn((e) => Promise.resolve({ ...e, id: e.id ?? 'tpl-uuid-1' })),
  update: vi.fn(),
  delete: vi.fn(),
});

describe('TemplateManagerService', () => {
  let service: TemplateManagerService;
  let repo: ReturnType<typeof mockRepo>;
  let kafka: { publish: ReturnType<typeof vi.fn> };
  let metaClient: { submitTemplate: ReturnType<typeof vi.fn> };
  let redis: { del: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; setex: ReturnType<typeof vi.fn> };
  let audit: { log: ReturnType<typeof vi.fn> };
  let tenant: { getCurrentTenantId: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    repo = mockRepo();
    kafka = { publish: vi.fn().mockResolvedValue(undefined) };
    metaClient = { submitTemplate: vi.fn().mockResolvedValue({ id: 'meta-tpl-1' }) };
    redis = {
      del: vi.fn().mockResolvedValue(1),
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
    };
    audit = { log: vi.fn().mockResolvedValue(undefined) };
    tenant = { getCurrentTenantId: vi.fn().mockReturnValue('tenant-1') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TemplateManagerService,
        { provide: getRepositoryToken(CommTemplate), useValue: repo },
        { provide: KafkaProducer, useValue: kafka },
        { provide: MetaTemplateApiClient, useValue: metaClient },
        { provide: RedisService, useValue: redis },
        { provide: AuditCommService, useValue: audit },
        { provide: TenantContextService, useValue: tenant },
      ],
    }).compile();
    service = moduleRef.get(TemplateManagerService);
  });

  // ===== CRUD =====
  describe('create', () => {
    it('creates template with status=draft', async () => {
      repo.findOne.mockResolvedValue(null);
      const r = await service.create({
        name: 'test_template',
        locale: 'fr',
        category: 'transactional',
        body_template: 'Hello {{user_name}}',
        variables_schema: { order: ['user_name'], required: ['user_name'], schema: { user_name: 'string' } },
      });
      expect(r.id).toBe('tpl-uuid-1');
      expect(repo.save).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalled();
      expect(kafka.publish).toHaveBeenCalledWith(expect.stringMatching(/template_created/), expect.any(Object));
    });

    it('rejects duplicate (name, locale, tenant)', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' });
      await expect(service.create({
        name: 'existing_one',
        locale: 'fr',
        category: 'transactional',
        body_template: 'Hi',
        variables_schema: { order: [], required: [], schema: {} },
      })).rejects.toBeInstanceOf(TemplateNameConflictError);
    });

    it('rejects body > 1024 chars (Meta limit)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.create({
        name: 'long_one',
        locale: 'fr',
        category: 'transactional',
        body_template: 'x'.repeat(1025),
        variables_schema: { order: [], required: [], schema: {} },
      })).rejects.toBeInstanceOf(TemplateBodyTooLongError);
    });

    it('rejects emoji in body (decision-006)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.create({
        name: 'emoji_one',
        locale: 'fr',
        category: 'transactional',
        body_template: 'Hello 😀',
        variables_schema: { order: [], required: [], schema: {} },
      })).rejects.toThrow();
    });

    it('rejects header > 60 chars', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.create({
        name: 'long_header',
        locale: 'fr',
        category: 'transactional',
        body_template: 'OK',
        header_template: 'x'.repeat(61),
        variables_schema: { order: [], required: [], schema: {} },
      })).rejects.toThrow();
    });

    it('rejects footer with variables', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.create({
        name: 'var_footer',
        locale: 'fr',
        category: 'transactional',
        body_template: 'OK',
        footer_template: 'Hello {{user_name}}',
        variables_schema: { order: [], required: [], schema: {} },
      })).rejects.toThrow();
    });

    it('rejects invalid locale (Zod strict)', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.create({
        name: 'bad_locale',
        locale: 'es' as never,
        category: 'transactional',
        body_template: 'OK',
        variables_schema: { order: [], required: [], schema: {} },
      })).rejects.toBeInstanceOf(TemplateForbiddenLocaleError);
    });
  });

  describe('findById + findByName', () => {
    it('findById returns template scoped to tenant', async () => {
      const tpl = { id: 'tpl-1', tenant_id: 'tenant-1', name: 'x', language: 'fr' };
      repo.findOne.mockResolvedValue(tpl);
      const r = await service.findById('tpl-1');
      expect(r).toEqual(tpl);
      expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'tpl-1', tenant_id: 'tenant-1' },
      }));
    });

    it('findById returns null if cross-tenant', async () => {
      repo.findOne.mockResolvedValue(null);
      const r = await service.findById('tpl-other-tenant');
      expect(r).toBeNull();
    });

    it('findByName uses cache hit', async () => {
      const cached = { id: 'tpl-cached', name: 'x', language: 'fr' };
      redis.get.mockResolvedValue(JSON.stringify(cached));
      const r = await service.findByName('x', 'fr');
      expect(r).toEqual(cached);
      expect(repo.findOne).not.toHaveBeenCalled();
    });

    it('findByName falls back to ar if ar-MA missing', async () => {
      redis.get.mockResolvedValue(null);
      repo.findOne
        .mockResolvedValueOnce(null) // ar-MA
        .mockResolvedValueOnce({ id: 'tpl-ar', name: 'x', language: 'ar' });
      const r = await service.findByName('x', 'ar-MA');
      expect(r?.language).toBe('ar');
    });

    it('findByName returns null if no fallback found', async () => {
      redis.get.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);
      const r = await service.findByName('nonexistent', 'fr');
      expect(r).toBeNull();
    });
  });

  describe('update', () => {
    it('updates draft template + invalidates cache', async () => {
      const existing = { id: 'tpl-1', tenant_id: 'tenant-1', name: 'x', language: 'fr', meta_template_status: 'draft', body_template: 'old' };
      repo.findOne.mockResolvedValue(existing);
      await service.update('tpl-1', { body_template: 'new body' });
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ body_template: 'new body' }));
      expect(redis.del).toHaveBeenCalledWith(expect.stringContaining('template:tenant-1:x:fr'));
      expect(kafka.publish).toHaveBeenCalledWith(expect.stringMatching(/template_updated/), expect.any(Object));
    });

    it('rejects update if status=approved (locked)', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', meta_template_status: 'approved' });
      await expect(service.update('tpl-1', { body_template: 'changed' })).rejects.toBeInstanceOf(TemplateInvalidStatusTransitionError);
    });
  });

  describe('delete', () => {
    it('soft-deletes draft', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', meta_template_status: 'draft', is_active: true });
      await service.delete('tpl-1');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
    });

    it('rejects delete if approved', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', meta_template_status: 'approved' });
      await expect(service.delete('tpl-1')).rejects.toThrow();
    });
  });

  // ===== Workflow Meta =====
  describe('submitForApproval', () => {
    it('transitions draft -> pending_review + calls Meta', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', name: 'x', language: 'fr', meta_template_status: 'draft', body_template: 'Hi', tenant_id: 'tenant-1' });
      await service.submitForApproval('tpl-1');
      expect(metaClient.submitTemplate).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
        meta_template_status: 'pending_review',
        meta_template_id: 'meta-tpl-1',
      }));
      expect(kafka.publish).toHaveBeenCalledWith(expect.stringMatching(/template_submitted/), expect.any(Object));
    });

    it('rejects submit if status=pending_review (already submitted)', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', meta_template_status: 'pending_review' });
      await expect(service.submitForApproval('tpl-1')).rejects.toBeInstanceOf(TemplateInvalidStatusTransitionError);
    });

    it('rejects submit if status=approved', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', meta_template_status: 'approved' });
      await expect(service.submitForApproval('tpl-1')).rejects.toBeInstanceOf(TemplateInvalidStatusTransitionError);
    });

    it('handles Meta API down with retry queue', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', name: 'x', language: 'fr', meta_template_status: 'draft', body_template: 'Hi' });
      metaClient.submitTemplate.mockRejectedValueOnce(new Error('Meta API timeout'));
      await expect(service.submitForApproval('tpl-1')).rejects.toThrow('Meta API timeout');
      // Status reste 'draft' (rollback)
      expect(repo.save).not.toHaveBeenCalledWith(expect.objectContaining({ meta_template_status: 'pending_review' }));
    });
  });

  describe('markApproved', () => {
    it('transitions pending_review -> approved (webhook account_alerts)', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', meta_template_status: 'pending_review' });
      await service.markApproved('meta-tpl-1');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
        meta_template_status: 'approved',
        approved_at: expect.any(Date),
      }));
      expect(kafka.publish).toHaveBeenCalledWith(expect.stringMatching(/template_approved/), expect.any(Object));
    });
  });

  describe('markRejected', () => {
    it('transitions pending_review -> rejected with reason', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', meta_template_status: 'pending_review' });
      await service.markRejected('meta-tpl-1', 'POLICY_VIOLATION');
      expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({
        meta_template_status: 'rejected',
        rejected_reason: 'POLICY_VIOLATION',
      }));
    });
  });

  // ===== Multi-tenant =====
  describe('multi-tenant scope', () => {
    it('list scoped to tenant', async () => {
      repo.findAndCount.mockResolvedValue([[{ id: 'tpl-1' }], 1]);
      await service.list({ page: 1, pageSize: 20 });
      expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ tenant_id: 'tenant-1' }),
      }));
    });
  });

  // ===== Cache =====
  describe('cache invalidation', () => {
    it('invalidates cache on update', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', tenant_id: 'tenant-1', name: 'x', language: 'fr', meta_template_status: 'draft' });
      await service.update('tpl-1', { body_template: 'new' });
      expect(redis.del).toHaveBeenCalled();
    });
  });

  // ===== Language code mapping =====
  describe('language code mapping Meta', () => {
    it('maps ar-MA to ar for Meta API', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', name: 'x', language: 'ar-MA', meta_template_status: 'draft', body_template: 'Hi' });
      await service.submitForApproval('tpl-1');
      expect(metaClient.submitTemplate).toHaveBeenCalledWith(expect.objectContaining({
        language: 'ar',
      }));
    });

    it('keeps fr as fr for Meta API', async () => {
      repo.findOne.mockResolvedValue({ id: 'tpl-1', name: 'x', language: 'fr', meta_template_status: 'draft', body_template: 'Hi' });
      await service.submitForApproval('tpl-1');
      expect(metaClient.submitTemplate).toHaveBeenCalledWith(expect.objectContaining({
        language: 'fr',
      }));
    });
  });

  // ===== Validation =====
  describe('variables warnings', () => {
    it('warns on unused variables in body', async () => {
      repo.findOne.mockResolvedValue(null);
      const result = await service.create({
        name: 'unused_var',
        locale: 'fr',
        category: 'transactional',
        body_template: 'Hello {{user_name}}',
        variables_schema: { order: ['user_name', 'unused_field'], required: ['user_name', 'unused_field'], schema: { user_name: 'string', unused_field: 'string' } },
      });
      expect(result.warnings).toContain('unused_var:unused_field');
    });
  });
});
```

### 7.2 Tests integration `seed-comm-templates.integration.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { DataSource } from 'typeorm';
import { seedTemplatesForTenant, loadAllSeeds } from '../../../infrastructure/scripts/seed-comm-templates.js';
import { dataSourceOptions } from '../../src/config/data-source.js';
import { CommTemplate } from '../../../packages/comm/src/entities/comm-template.entity.js';

const SKIP_DB = process.env.SKIP_DB === '1';

describe.skipIf(SKIP_DB)('seed-comm-templates integration', () => {
  let dataSource: DataSource;
  const TEST_TENANT = 'test-tenant-seed';

  beforeAll(async () => {
    dataSource = new DataSource(dataSourceOptions);
    await dataSource.initialize();
    // Clean
    await dataSource.getRepository(CommTemplate).delete({ tenant_id: TEST_TENANT });
  });

  afterAll(async () => {
    await dataSource.getRepository(CommTemplate).delete({ tenant_id: TEST_TENANT });
    await dataSource.destroy();
  });

  it('inserts 80 templates on first run (20 x 4 locales)', async () => {
    const result = await seedTemplatesForTenant(dataSource, TEST_TENANT);
    expect(result.inserted).toBe(80);
    expect(result.updated).toBe(0);

    const count = await dataSource.getRepository(CommTemplate).count({
      where: { tenant_id: TEST_TENANT },
    });
    expect(count).toBe(80);
  }, 30000);

  it('is idempotent : second run inserts 0, updates 0 if approved', async () => {
    // Mark all as approved
    await dataSource.getRepository(CommTemplate).update(
      { tenant_id: TEST_TENANT },
      { meta_template_status: 'approved' },
    );

    const result = await seedTemplatesForTenant(dataSource, TEST_TENANT);
    expect(result.inserted).toBe(0);
    expect(result.skipped).toBe(80);
  });

  it('updates draft templates if body changed', async () => {
    // Reset to draft
    await dataSource.getRepository(CommTemplate).update(
      { tenant_id: TEST_TENANT },
      { meta_template_status: 'draft' },
    );
    const result = await seedTemplatesForTenant(dataSource, TEST_TENANT);
    expect(result.updated).toBe(80);
  });

  it('loads exactly 20 unique seeds', () => {
    const seeds = loadAllSeeds();
    expect(seeds.length).toBe(20);
    const names = new Set(seeds.map((s) => s.name));
    expect(names.size).toBe(20);
  });

  it('all seeds have 4 locales', () => {
    const seeds = loadAllSeeds();
    for (const seed of seeds) {
      expect(seed.locales.fr?.body_template).toBeDefined();
      expect(seed.locales['ar-MA']?.body_template).toBeDefined();
      expect(seed.locales.ar?.body_template).toBeDefined();
      expect(seed.locales.en?.body_template).toBeDefined();
    }
  });

  it('all seed bodies <= 1024 chars (Meta limit)', () => {
    const seeds = loadAllSeeds();
    for (const seed of seeds) {
      for (const locale of ['fr', 'ar-MA', 'ar', 'en'] as const) {
        const body = seed.locales[locale].body_template;
        expect(body.length).toBeLessThanOrEqual(1024);
      }
    }
  });

  it('no emoji in any seed body (decision-006)', () => {
    const seeds = loadAllSeeds();
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    for (const seed of seeds) {
      for (const locale of ['fr', 'ar-MA', 'ar', 'en'] as const) {
        expect(emojiRegex.test(seed.locales[locale].body_template)).toBe(false);
      }
    }
  });
});
```

### 7.3 Tests E2E `templates.controller.e2e-spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module.js';
import request from 'supertest';

describe('Templates Controller E2E (Sprint 9 Tache 3.2.5)', () => {
  let app: INestApplication;
  let tokenAdmin: string;
  let tokenUser: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    // Setup tokens via auth helpers Sprint 5
    tokenAdmin = process.env.TEST_TOKEN_ADMIN ?? '';
    tokenUser = process.env.TEST_TOKEN_USER ?? '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/v1/comm/templates creates draft', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: 'e2e_test_template',
        locale: 'fr',
        category: 'transactional',
        body_template: 'Hello {{user_name}}',
        variables_schema: { order: ['user_name'], required: ['user_name'], schema: { user_name: 'string' } },
      });
    expect(r.status).toBe(201);
    expect(r.body.id).toBeDefined();
    expect(r.body.meta_template_status).toBe('draft');
  });

  it('GET /api/v1/comm/templates lists templates', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/comm/templates?page=1&pageSize=20')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(r.status).toBe(200);
    expect(r.body.items).toBeDefined();
    expect(Array.isArray(r.body.items)).toBe(true);
  });

  it('POST /:id/submit transitions draft -> pending_review', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: 'e2e_submit',
        locale: 'fr',
        category: 'transactional',
        body_template: 'Test',
        variables_schema: { order: [], required: [], schema: {} },
      });
    const r = await request(app.getHttpServer())
      .post(`/api/v1/comm/templates/${created.body.id}/submit`)
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(r.status).toBe(200);
    expect(r.body.meta_template_status).toBe('pending_review');
  });

  it('returns 403 for user without comm.templates.manage', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set('Authorization', `Bearer ${tokenUser}`)
      .send({
        name: 'forbidden_test',
        locale: 'fr',
        category: 'transactional',
        body_template: 'X',
        variables_schema: { order: [], required: [], schema: {} },
      });
    expect(r.status).toBe(403);
  });

  it('returns 400 on duplicate (name, locale, tenant)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: 'dup_test',
        locale: 'fr',
        category: 'transactional',
        body_template: 'X',
        variables_schema: { order: [], required: [], schema: {} },
      });
    const r = await request(app.getHttpServer())
      .post('/api/v1/comm/templates')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        name: 'dup_test',
        locale: 'fr',
        category: 'transactional',
        body_template: 'X',
        variables_schema: { order: [], required: [], schema: {} },
      });
    expect(r.status).toBe(409);
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 9 Tache 3.2.5 -- Template Manager + Meta workflow
WHATSAPP_BUSINESS_ACCOUNT_ID=                   # Meta WABA ID (UI Business Manager)
WHATSAPP_API_BASE_URL=https://graph.facebook.com/v21.0
COMM_TEMPLATE_CACHE_TTL_S=300                   # 5 minutes Redis cache
COMM_TEMPLATE_SEED_AUTO=true                    # Sprint 6 onboarding tenant auto-seed
COMM_TEMPLATE_META_LANGUAGE_FALLBACK=fr         # Si locale absente cote Meta
COMM_TEMPLATE_MAX_BODY_CHARS=1024               # Meta hard limit
COMM_TEMPLATE_MAX_HEADER_CHARS=60               # Meta hard limit
COMM_TEMPLATE_MAX_BUTTONS=10                    # Meta hard limit
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/api test:integration -- seed-comm-templates
pnpm --filter @insurtech/api test:e2e -- templates.controller

# Run seed manually for a tenant
pnpm --filter @insurtech/api exec tsx infrastructure/scripts/seed-comm-templates.ts --tenant=tenant-test-1

# Verify all 20 seed JSONs present
ls -la packages/comm/src/templates/seed-data/auth/*.json | wc -l   # expect 5
ls -la packages/comm/src/templates/seed-data/booking/*.json | wc -l # expect 3
ls -la packages/comm/src/templates/seed-data/insure/*.json | wc -l  # expect 5
ls -la packages/comm/src/templates/seed-data/repair/*.json | wc -l  # expect 4
ls -la packages/comm/src/templates/seed-data/tenant/*.json | wc -l  # expect 3
# Total = 20

pnpm --filter @insurtech/comm build
```

---

## 10. Criteres validation V1-V30

### P0 (18+)

- V1 (P0) : `pnpm --filter @insurtech/comm typecheck` -> exit 0.
- V2 (P0) : `pnpm --filter @insurtech/comm lint:check` -> exit 0.
- V3 (P0) : `pnpm --filter @insurtech/comm test` -> 25+ tests passent, coverage >= 88 percent.
- V4 (P0) : Service `TemplateManagerService` expose 8 methods : `create`, `findById`, `findByName`, `update`, `delete`, `list`, `submitForApproval`, `markApproved`, `markRejected`.
- V5 (P0) : 20 fichiers JSON seed presents : `find packages/comm/src/templates/seed-data -name "*.json" | wc -l` -> 20.
- V6 (P0) : Chaque JSON seed contient les 4 locales (fr, ar-MA, ar, en) : `cat packages/comm/src/templates/seed-data/auth/email_verification.json | jq '.locales | keys | length'` -> 4.
- V7 (P0) : Body templates <= 1024 chars (Meta limit) : `node -e "..."` script verifie.
- V8 (P0) : Header templates <= 60 chars : verifie en script de seed (throw si depasse).
- V9 (P0) : Footer pas de variables : regex `/\{\{.+\}\}/` rejected.
- V10 (P0) : Seeds idempotents : 2eme run inserted=0, updated/skipped=80.
- V11 (P0) : Workflow Meta : draft -> pending_review (POST /:id/submit) -> approved | rejected (webhook account_alerts).
- V12 (P0) : Endpoint `POST /api/v1/comm/templates/:id/submit` retourne 200 + `meta_template_status='pending_review'`.
- V13 (P0) : Multi-tenant strict : `findById` retourne null si template appartient autre tenant.
- V14 (P0) : Locale fallback cascade : ar-MA -> ar -> fr (configurable).
- V15 (P0) : Validation Zod stricte : locale enum reject 'es', body 1024 reject, header 60 reject.
- V16 (P0) : RBAC : permission `comm.templates.manage` requise sur create/update/delete/submit. 403 sinon.
- V17 (P0) : Cache Redis invalide sur update : `redis.del('template:tenant-1:name:locale')`.
- V18 (P0) : Kafka events : `template_created`, `template_updated`, `template_submitted`, `template_approved`, `template_rejected`, `template_deleted`.
- V19 (P0) : Meta API down : status reste `draft` (rollback transactional).
- V20 (P0) : Templates approved -> updates rejected (locked).

### P1 (8+)

- V21 (P1) : Seed script exit 1 si validation echoue (body > 1024, emoji, etc.).
- V22 (P1) : Logs structures Pino (no PII, hash via `pii-hash.helper`).
- V23 (P1) : Audit trail : `comm_audit_logs` insert sur create/submit/approve/reject.
- V24 (P1) : Test integration seeds avec DB reelle Postgres : `pnpm test:integration` passe.
- V25 (P1) : Test E2E controller : POST/GET/PATCH/DELETE/SUBMIT -> 200/201/204/400/403/404/409.
- V26 (P1) : Sub-tenant inheritance Sprint 27 : documente (commentaire TODO).
- V27 (P1) : Versioning templates Sprint 35 : documente.
- V28 (P1) : Bench `findByName` cache hit < 5ms (p99) ; cache miss < 50ms.

### P2 (4+)

- V29 (P2) : No-emoji : `grep -rP "[\\x{1F300}-\\x{1F9FF}]" packages/comm/src/templates/seed-data/` -> aucun match.
- V30 (P2) : No-console : `grep -rn "console\\.log" packages/comm/src --include="*.ts"` -> 0.
- V31 (P2) : Documentation README package comm decrit registry 20 templates.
- V32 (P2) : Sprint 27 admin UI integration plan documente (Annexe A).

---

## 11. Edge cases (12+)

1. **Conflict (tenant_id, name, locale)** : INSERT echoue avec `TemplateNameConflictError` (409). Test V3.
2. **Name reserved** : ex `meta_*`, `system_*` pre-reserves rejets a la creation.
3. **Locale enum strict Zod fail** : `'es'`, `'de'`, `'pt'` rejected -> 400 BAD_REQUEST.
4. **Variables_schema corrompu JSON** : chargement seed file echoue avec parse error -> seed script exit 1.
5. **Meta API down submit retry queue** : status reste `draft` ; Sprint 18 cron retry hourly. BullMQ deferred.
6. **Status incoherent resync nightly** : Sprint 18 cron `comm.template_status_resync` interroge Meta API et corrige discrepancies.
7. **Body avec emoji decision-006** : `sanitize` step throw `TemplateEmojiNotAllowedError`. Verifie a la creation + seed time.
8. **PII hardcoded warning** : si body contient string non-variabilisee qui ressemble a PII (ex `mohamed.alaoui@`), warning log mais pas reject (heuristique, faux-positifs possibles).
9. **Variables non utilisees warn** : `variables_schema.order` declare `unused_var` mais pas dans `body_template` -> warning, pas reject.
10. **Templates locked deletion forbidden** : si `meta_template_status='approved'`, `delete` throw `TemplateLockedError`. Sprint 35 versioning permettra archive.
11. **Sub-tenant inheritance Sprint 27** : tenant child herite des templates parent (read-only) ; override possible avec creation locale ; documente Annexe B.
12. **Versioning templates Sprint 35** : `template_versions` table -> garder historique body_template + audit qui a modifie. Hors scope Sprint 9.
13. **Cache stampede** : si 100 requests simultanees `findByName` cache miss, 100 queries DB. Mitigation : Redis SETNX lock 1s -> 1 query, autres attendent.
14. **Race condition update simultane** : optimistic lock via `updated_at` column -> 409 sur conflict.

---

## 12. Conformite Maroc

- **Loi 09-08 (CNDP) article 5** : PII variables (user_name, phone, email, montant) non logguees en clair. Hash via `pii-hash.helper.ts` (SHA-256 truncated 8 chars). `AuditCommService.sanitizePiiInDetails` applique.
- **Loi 09-08 article 28** : audit trail `comm_audit_logs` permet justification CNDP audit (qui a cree/modifie quel template).
- **Loi marketing direct 24-09 (ANRT)** : footer opt-out automatique injecte par `email-template-renderer` Sprint Tache 3.2.7 ; les templates seed `category='marketing'` doivent contenir `{{unsubscribe_url}}` (verifie a la creation).
- **Identification commerciale Skalean SARL** : footer obligatoire mentionne `Skalean SARL RC Casablanca XXXX` (verifie dans tous les seeds, validateur seed time).
- **Souverainete cloud (decision-008)** : templates stockes Postgres on-prem Atlas Casablanca ; pas de stockage Meta cote (Meta a juste les approuved templates, pas les drafts).
- **ACAPS confidentialite police d'assurance** : variables `police_number` ne sont pas dans logs Pino directement, hashees.

---

## 13. Conventions absolues

1. Multi-tenant : `tenant_id` via TenantContextService, jamais via param URL.
2. Validation : Zod runtime sur tous DTOs (decision-007).
3. Logger Pino structured, no PII en clair.
4. pnpm pour install (pas npm/yarn).
5. TypeScript strict (`strict: true`).
6. Tests Vitest 25+ unitaires + 6 integration + 5 E2E.
7. Skalean AI : aucun usage Sprint 9 (defere Sprint 30+).
8. No-emoji (decision-006).
9. Idempotency : seed script + create avec UPSERT pattern.
10. Cloud souverain MA : Postgres Atlas Casablanca.
11. Crypto : aucune crypto custom (HMAC pour Meta API uniquement Tache 3.2.4).
12. JSDoc sur methods publiques + types exports.
13. Performance : `findByName` cache hit < 5ms p99.
14. Audit log obligatoire sur tous changements state.
15. RBAC : `comm.templates.manage` requise.
16. Kafka events declenches sur tous changements (DDD).

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:coverage

# No-emoji check
grep -rP "[\x{1F300}-\x{1F9FF}]" packages/comm/src && exit 1 || echo OK_no_emoji

# No-console check
grep -rn "console\.log" packages/comm/src --include="*.ts" && exit 1 || echo OK_no_console

# 20 seeds count check
SEED_COUNT=$(find packages/comm/src/templates/seed-data -name "*.json" | wc -l)
[ "$SEED_COUNT" -eq 20 ] || (echo "MISSING SEEDS expected 20 got $SEED_COUNT" && exit 1)
echo "OK 20 seeds present"

# 4 locales check per seed
for seed in packages/comm/src/templates/seed-data/**/*.json; do
  LOCALES=$(jq -r '.locales | keys | length' "$seed")
  [ "$LOCALES" -eq 4 ] || (echo "BAD LOCALES $seed got $LOCALES" && exit 1)
done
echo "OK 4 locales per seed"

# Body length check (1024 max)
for seed in packages/comm/src/templates/seed-data/**/*.json; do
  for locale in fr ar-MA ar en; do
    LEN=$(jq -r ".locales[\"$locale\"].body_template | length" "$seed")
    [ "$LEN" -le 1024 ] || (echo "BODY TOO LONG $seed/$locale = $LEN" && exit 1)
  done
done
echo "OK body lengths"
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): implement TemplateManagerService + 80 seed templates 4 locales (3.2.5)

Implements CRUD service for WhatsApp/Email templates with Meta approval
workflow (draft -> pending_review -> approved/rejected) + idempotent seed
script that loads 20 use-case templates across 4 locales (fr / ar-MA Darija
/ ar formel / en) = 80 templates total per tenant onboarding.

Cas d'usage couverts (20) :
- Auth (5) : email_verification, password_reset, password_changed,
  mfa_enabled, account_locked
- Booking (3) : appointment_scheduled, appointment_reminder_24h,
  appointment_cancelled
- Insure (5) : quote_generated, police_signed_confirmation,
  police_renewal_reminder, payment_due_reminder, claim_received
- Repair (4) : sinistre_acknowledged, devis_ready, reparation_started,
  reparation_completed
- Tenant (3) : tenant_invitation, tenant_suspended, quota_warning_80

Livrables :
- TemplateManagerService (~280 lines, 9 methods CRUD + workflow)
- MetaTemplateApiClient (submit + sync status with WABA)
- AuditCommService (PII hash via SHA-256 truncated)
- TemplatesController (REST CRUD + RBAC + Zod DTOs)
- Seed script (~500 lines, idempotent UPSERT)
- 20 JSON seed files (5 modules x N templates)
- Registry index.ts (descriptors 20 templates)
- 25+ unit tests + 6 integration + 5 E2E (coverage >= 88 percent)

Workflow Meta :
- POST /:id/submit -> Meta /{whatsapp_business_account_id}/message_templates
- Webhook account_alerts -> markApproved / markRejected
- Language code mapping ar-MA -> ar (Meta no Darija variant)

Conformite :
- Loi 09-08 CNDP : PII hashed in audit logs
- Loi 24-09 ANRT : footer Skalean SARL RC Casablanca obligatoire
- decision-006 : no-emoji enforced via Zod refine
- decision-008 : Postgres on-prem (templates not stored on Meta drafts)

Tests : 25 service + 6 integration + 5 E2E = 36 tests
Coverage : >= 88 percent

Task: 3.2.5
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.5"
```

---

## 16. Workflow next step

Apres commit :

1. Mettre a jour le tracker dans `00-pilotage/sprints/sprint-09-state.json` :
```json
{
  "task_id": "3.2.5",
  "status": "completed",
  "completed_at": "2026-05-08T00:00:00Z",
  "tests_passed": 36,
  "coverage_percent": 88
}
```

2. Passer a `task-3.2.6-email-smtp-dkim-spf-mailgun.md` qui implementera :
- Email service production (Nodemailer + Mailgun)
- DKIM signing config + SPF + DMARC docs DNS
- Multi-env switch (Mailhog dev / Mailgun staging / prod)
- List-Unsubscribe RFC 8058
- Webhook Mailgun bounces (Tache 3.2.10)

3. Sprint 6 onboarding tenant pipeline integrera `seed-comm-templates.ts` automatiquement a la creation tenant (ne pas oublier hook Sprint 6 Tache 1.4.X).

4. Sprint 27 admin UI consume `templates.controller` pour preview + workflow approval (review humaine + soumission Meta).

5. Sprint 18 cron `comm.template_status_resync` interrogera Meta API hourly pour corriger discrepancies.

---

## Annexe A. Sprint 27 admin UI integration plan

Sprint 27 introduira un module admin UI dedicated avec :

- Preview template render avec mock variables (live preview).
- Editeur side-by-side fr / ar-MA / ar / en (RTL preview pour ar-MA et ar).
- Workflow review : queue de templates `pending_review` avec assignation reviewer.
- Bouton "Submit to Meta" (=> appelle `POST /:id/submit`).
- Webhook handler `account_alerts` (Meta) -> badge "approved" / "rejected" temps reel.
- Diff visualizer entre versions (Sprint 35 versioning prerequis).
- Bulk seed reload (admin trigger pour re-seed si modification template seed code-side).

Architecture :

```
admin-ui (React)
    -> POST /api/v1/comm/templates                  -- create draft
    -> PATCH /api/v1/comm/templates/:id             -- edit draft
    -> POST /api/v1/comm/templates/:id/submit       -- to Meta
    -> GET /api/v1/comm/templates?status=pending    -- review queue
    -> websocket /ws/comm/template-status           -- live updates Meta webhook (Sprint 27)
```

---

## Annexe B. Sub-tenant inheritance (Sprint 27)

Sprint 27 introduira pattern sub-tenants (e.g. brokers under a master organization). Templates inheritance :

- Parent tenant cree templates "global" (`is_inheritable=true`).
- Child tenant herite read-only.
- Child tenant peut override en creant template avec meme `name`+`locale` -> precedence local.
- Sync flag : si parent met a jour, child override perd overlap (notification CNDP loi 24-09 : information user).

Schema migration :
```sql
ALTER TABLE comm_templates ADD COLUMN parent_template_id UUID REFERENCES comm_templates(id);
ALTER TABLE comm_templates ADD COLUMN is_inheritable BOOLEAN DEFAULT false;
```

---

## Annexe C. Sprint 35 versioning templates

Sprint 35 introduira versioning :

- Table `comm_template_versions` (1-to-many comm_templates).
- Chaque update sauve version old en `versions` ; current version pointer.
- Permet rollback rapide en cas de regression Meta.
- Audit trail completet "qui a change quoi quand".

```sql
CREATE TABLE comm_template_versions (
  id UUID PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES comm_templates(id) ON DELETE CASCADE,
  version INT NOT NULL,
  body_template TEXT NOT NULL,
  header_template TEXT,
  footer_template TEXT,
  buttons JSONB,
  variables_schema JSONB,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version)
);
```

---

## Annexe D. Performance benchmarks attendus

```
TemplateManagerService.create:                    median 25 ms   (p99: 80 ms)  -- DB INSERT + Kafka
TemplateManagerService.findByName (cache hit):    median 1.5 ms  (p99: 5 ms)  -- Redis get
TemplateManagerService.findByName (cache miss):   median 15 ms   (p99: 50 ms) -- DB SELECT + Redis setex
TemplateManagerService.update:                    median 30 ms   (p99: 100 ms) -- DB UPDATE + cache invalidate
TemplateManagerService.submitForApproval:         median 250 ms  (p99: 800 ms) -- Meta API HTTPS RTT
seed-comm-templates (80 templates):               median 8 s     (p99: 15 s)  -- 80 INSERT/UPSERT
```

Sprint 14+ optimisations possibles :
- Bulk INSERT seeds via `pg_copy` (vs N INSERTs).
- Cache local LRU L1 + Redis L2 pour findByName (< 0.1ms hit local).
- Connection pooling Meta API (HTTP keep-alive undici Sprint Tache 3.2.2).

---

## Annexe E. Catalogue complet 20 templates avec descriptifs detailles

### E.1 Auth (5 templates)

**1. email_verification** -- Email a la creation de compte (signup Sprint 5 Tache 2.1.9). Variables : `user_name`, `verify_url`, `ttl_hours`. Trigger : `auth.user_signed_up`. Channel : email + WhatsApp si phone fourni.

**2. password_reset** -- Demande reset password (Sprint 5 recovery 2.1.11). Variables : `user_name`, `reset_url`, `ttl_hours=1`. Trigger : `auth.password_reset_requested`. Channel : email.

**3. password_changed_notification** -- Confirmation post-change. Variables : `user_name`, `changed_at`, `ip`, `support_url`. Trigger : `auth.password_changed`. Channel : email + WA.

**4. mfa_enabled_notification** -- Confirmation MFA active (Sprint 5 Tache 2.1.8). Variables : `user_name`, `recovery_codes_count`, `manage_mfa_url`. Trigger : `auth.mfa_enabled`. Channel : email.

**5. account_locked_notification** -- Compte verrouille apres N echecs (Sprint 5 Tache 2.1.10). Variables : `user_name`, `tier`, `locked_until`, `recovery_url`. Trigger : `auth.account_locked`. Channel : email + WA.

### E.2 Booking (3 templates)

**6. appointment_scheduled** -- Confirmation rdv programme (Sprint 8). Variables : `user_name`, `date`, `time`, `broker_name`, `address`. Trigger : `booking.appointment_scheduled`. Channel : preferred (WA + email).

**7. appointment_reminder_24h** -- Rappel J-1 (cron Sprint 8 BullMQ scheduled). Variables : `user_name`, `date`, `time`, `broker_name`. Trigger : `booking.appointment_reminder_24h`. Channel : WA priorite (engagement plus haut).

**8. appointment_cancelled** -- Notification annulation. Variables : `user_name`, `date`, `time`, `cancellation_reason`. Trigger : `booking.appointment_cancelled`. Channel : preferred.

### E.3 Insure (5 templates - utilises Sprint 14+)

**9. quote_generated** -- Devis assurance pret (Sprint 14). Variables : `user_name`, `quote_id`, `amount`, `view_url`, `expires_at`. Trigger : `insure.quote_generated`. Channel : email (avec PDF attache Sprint 11).

**10. police_signed_confirmation** -- Police signee + active (Sprint 11 + Sprint 14). Variables : `user_name`, `police_number`, `effective_date`, `amount`. Trigger : `insure.police_signed`. Channel : email + WA + SMS Sprint 25.

**11. police_renewal_reminder** -- Rappel renouvellement J-30 (Sprint 14 cron). Variables : `user_name`, `police_number`, `expiry_date`, `renew_url`. Trigger : `insure.police_renewal_reminder`. Channel : preferred.

**12. payment_due_reminder** -- Rappel paiement prime (Sprint 18 Books). Variables : `user_name`, `amount`, `due_date`, `pay_url`. Trigger : `insure.payment_due`. Channel : email + WA + SMS Sprint 25.

**13. claim_received_acknowledgement** -- Accuse reception sinistre cote insure (Sprint 14). Variables : `user_name`, `claim_id`, `received_at`, `next_steps_url`. Trigger : `insure.claim_received`. Channel : email + WA.

### E.4 Repair (4 templates - utilises Sprint 20+)

**14. sinistre_acknowledged** -- Accuse reception cote reparateur (Sprint 20). Variables : `user_name`, `sinistre_id`, `garage_name`, `estimated_arrival`. Trigger : `repair.sinistre_acknowledged`. Channel : preferred.

**15. devis_ready** -- Devis reparation pret (Sprint 20). Variables : `user_name`, `devis_id`, `amount`, `view_url`. Trigger : `repair.devis_ready`. Channel : email + WA.

**16. reparation_started** -- Reparation demarree (Sprint 20). Variables : `user_name`, `sinistre_id`, `estimated_completion`. Trigger : `repair.started`. Channel : preferred.

**17. reparation_completed** -- Reparation terminee, vehicule pret (Sprint 20). Variables : `user_name`, `sinistre_id`, `pickup_url`. Trigger : `repair.completed`. Channel : preferred priorite WA (engagement immediate).

### E.5 Tenant (3 templates)

**18. tenant_invitation** -- Invitation user a rejoindre tenant (Sprint 6). Variables : `inviter_name`, `tenant_name`, `invite_url`, `role`, `expires_at`. Trigger : `tenant.user_invited`. Channel : email.

**19. tenant_suspended_notification** -- Suspension non-paiement (Sprint 6 + Sprint 18 Books). Variables : `admin_name`, `tenant_name`, `reason`, `reactivate_url`. Trigger : `tenant.suspended`. Channel : email priorite.

**20. quota_warning_80percent** -- Alerte quota 80% (Sprint 6 + Sprint 33 monitoring). Variables : `admin_name`, `tenant_name`, `quota_type`, `usage_percent`, `upgrade_url`. Trigger : `tenant.quota_warning_80`. Channel : email + dashboard alert.

---

## Annexe F. Validation conformite Loi 09-08 PII hashing

Liste exhaustive variables PII reconnues + traitement :

| Variable | Type | Hashing | Logged in clair | Notes |
|----------|------|---------|------------------|-------|
| `user_name` | string | SHA-256[8] | NON | Hash dans audit_logs.details |
| `first_name` | string | SHA-256[8] | NON | idem |
| `last_name` | string | SHA-256[8] | NON | idem |
| `phone` | E.164 | SHA-256[8] | NON | idem |
| `email` | RFC5322 | SHA-256[8] | NON | idem masque format `f***@domain.tld` autorise |
| `address` | string | SHA-256[8] | NON | idem |
| `montant` / `amount` | number | SHA-256[8] | NON | precision financiere protegee |
| `prime_amount` | number | SHA-256[8] | NON | idem |
| `police_number` | string | SHA-256[8] | NON | identifiant ACAPS protege |
| `contract_number` | string | SHA-256[8] | NON | idem |
| `cin` | string | SHA-256[8] | NON | identifiant national obligatoire CNDP |
| `rib` / `iban` | string | SHA-256[8] | NON | bancaire confidentiel |
| `quote_id` | UUID | NO | OUI | UUID non PII |
| `claim_id` | UUID | NO | OUI | idem |
| `sinistre_id` | UUID | NO | OUI | idem |
| `template_name` | snake_case | NO | OUI | metadonnee technique |
| `locale` | enum | NO | OUI | metadonnee technique |
| `tenant_id` | UUID | NO | OUI | metadonnee technique |
| `category` | enum | NO | OUI | metadonnee technique |

Conformite verifiee par test `audit-comm.service.spec.ts > sanitizePiiInDetails > hashes all PII fields`.

---

## Annexe G. Structure complete repository post-tache

```
repo/
├── packages/comm/src/
│   ├── services/
│   │   ├── template-manager.service.ts                ~280 lignes
│   │   ├── template-manager.service.spec.ts           ~280 lignes
│   │   ├── meta-template-api.client.ts                ~150 lignes
│   │   ├── audit-comm.service.ts                       ~80 lignes
│   │   └── audit-comm.service.spec.ts                  ~120 lignes
│   ├── helpers/
│   │   └── pii-hash.helper.ts                          ~30 lignes
│   ├── errors/
│   │   └── template-manager-errors.ts                  ~80 lignes
│   ├── entities/
│   │   ├── comm-template.entity.ts                    (Sprint 2)
│   │   └── comm-audit-log.entity.ts                   (Sprint 2)
│   └── templates/seed-data/
│       ├── auth/
│       │   ├── email_verification.json
│       │   ├── password_reset.json
│       │   ├── password_changed_notification.json
│       │   ├── mfa_enabled_notification.json
│       │   └── account_locked_notification.json
│       ├── booking/
│       │   ├── appointment_scheduled.json
│       │   ├── appointment_reminder_24h.json
│       │   └── appointment_cancelled.json
│       ├── insure/
│       │   ├── quote_generated.json
│       │   ├── police_signed_confirmation.json
│       │   ├── police_renewal_reminder.json
│       │   ├── payment_due_reminder.json
│       │   └── claim_received_acknowledgement.json
│       ├── repair/
│       │   ├── sinistre_acknowledged.json
│       │   ├── devis_ready.json
│       │   ├── reparation_started.json
│       │   └── reparation_completed.json
│       ├── tenant/
│       │   ├── tenant_invitation.json
│       │   ├── tenant_suspended_notification.json
│       │   └── quota_warning_80percent.json
│       └── index.ts                                    ~250 lignes registry
├── apps/api/src/modules/comm/
│   ├── controllers/
│   │   ├── templates.controller.ts                     ~180 lignes
│   │   └── templates.controller.e2e-spec.ts           ~250 lignes
│   └── dto/
│       └── template.dto.ts                             ~100 lignes
└── infrastructure/scripts/
    ├── seed-comm-templates.ts                          ~500 lignes
    └── seed-comm-templates.integration.spec.ts        ~150 lignes
```

Total : 11 fichiers code + 20 JSON + 4 specs = 35 fichiers / ~3200 lignes effectives.

---

## 17. Resume execution

Tache 3.2.5 livre :

1. **TemplateManagerService** (~280 lignes) avec 9 methods : `create`, `findById`, `findByName` (cache + fallback locale), `update`, `delete` (soft), `list`, `submitForApproval` (Meta API call), `markApproved`, `markRejected`.

2. **MetaTemplateApiClient** (~150 lignes) wrapper Meta WhatsApp Business Account API : POST `/{whatsapp_business_account_id}/message_templates` avec retry exponential 3 tentatives 1s/5s/30s sur 5xx.

3. **AuditCommService + pii-hash.helper** (~110 lignes) : audit log avec hash PII SHA-256 truncated 8 chars (conformite CNDP loi 09-08 article 5).

4. **TemplatesController** (~180 lignes) : 7 endpoints REST CRUD + workflow + RBAC `comm.templates.manage`.

5. **Zod DTOs** (~100 lignes) : `CreateTemplateDto`, `UpdateTemplateDto`, `SubmitTemplateDto`, `TemplateFiltersDto` avec validation stricte (locale enum, body 1024, header 60, footer no var, buttons max 10, no emoji refine).

6. **Seed script idempotent** (~500 lignes) : UPSERT 80 templates (20 use-cases x 4 locales) avec validation Meta constraints + skip approuved + update drafts.

7. **20 fichiers JSON seed** : 5 modules (auth/booking/insure/repair/tenant) avec 4 locales chacun (fr / ar-MA / ar / en).

8. **Registry index.ts** (~250 lignes) : descripteurs 20 templates avec module, category, description fr, trigger event Kafka, variables, sprints consumers.

9. **Tests** : 25 unitaires + 6 integration (DB Postgres + 80 seeds) + 5 E2E (controller + RBAC + workflow). Coverage >= 88%.

10. **Workflow Meta** : draft -> pending_review -> approved | rejected. Endpoint `POST /:id/submit` declenche call Meta. Webhook `account_alerts` (Tache 3.2.4) declenche `markApproved` / `markRejected`. Sprint 18 cron resync nightly pour corriger discrepancies.

Conformite : Loi 09-08 (PII hash), Loi 24-09 (footer Skalean SARL), decision-006 (no-emoji), decision-008 (cloud souverain), decision-009 (multi-locale 4).

Workflow next : `task-3.2.6-email-smtp-dkim-spf-mailgun.md`.
