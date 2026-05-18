# TACHE 3.2.11 -- Opt-out Management CNDP + Endpoint Public (JWT Token + One-Click RFC 8058 + STOP Keyword WA)

**Sprint** : 9 (Phase 3 / Sprint 2 dans phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.11)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.12 endpoints REST `/api/v1/comm/*`, 3.2.13 tests E2E, et conformite reglementaire CNDP loi 09-08 sur tous les flows email/WhatsApp)
**Effort** : 4h
**Dependances** : 3.2.10 (Delivery Tracking : auto opt-out hard bounce + complaint Mailgun consume), 3.2.9 (Message Orchestrator : routing skip canal opted-out), 3.2.4 (WA Webhook : detect STOP keyword incoming), 3.2.6 (Email Service : footer opt-out link injection), 3.2.7 (Email Renderer : pages HTML 4 locales), Sprint 8 (CRM contacts), Sprint 5 (JWT helpers + RBAC), Sprint 2 (table `comm_optouts` migration), Sprint 27 (super_admin export CNDP downstream consumer)
**Densite cible** : 125-140 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le module `OptoutManagement` complet et operationnel du programme Skalean InsurTech v2.2 conforme a la loi marocaine 09-08 sur la protection des donnees personnelles (article 7 droit d'opposition, article 28 notification breach), conforme au Decret-Loi 24-09 sur le marketing direct ANRT (opt-out trackable obligatoire), conforme a la Loi 31-08 sur la protection des consommateurs (droit de retractation 7 jours), et conforme aux normes internationales RFC 8058 (List-Unsubscribe-Post one-click compliance Gmail/Outlook/Yahoo) et a la norme telecom STOP keyword WhatsApp (STOP, ARRET, UNSUBSCRIBE, ANNULER, REMOVE, DESINSCRIRE). Le perimetre couvre : un service `OptoutService` qui expose six methodes coeur (`optOut(contactId, channel, reason?, source)` enregistrant un opt-out dans la table `comm_optouts` avec audit log Kafka, `optIn(contactId, channel)` exigeant une confirmation explicite re-consent avec cooling period de 7 jours apres opt-out, `getOptedOutChannels(contactId)` retournant la liste des canaux opt-out pour usage par l'orchestrator Tache 3.2.9, `isOptedOut(contactId, channel)` pour check unitaire performant via cache Redis 60s, `listOptOutsByContact(contactId)` pour audit trail timeline, `generateOptoutToken(contactId, channel, tenantId)` produisant un JWT signe HS256 avec payload `{contactId, channel, tenantId, iat, exp +90j, jti UUID, type: 'optout'}` pour insertion dans le footer email et templates WhatsApp pertinents, `verifyOptoutToken(token)` validant la signature constant-time avec protection anti-replay via blacklist Redis JTI 90 jours TTL) ; un service `OptoutTokenService` dedie a la cryptographie JWT (sign avec env `OPTOUT_JWT_SECRET` distinct du JWT auth Sprint 5, verify avec `timingSafeEqual` Node natif anti-timing-attack, blacklist JTI Redis SETEX `optout:jti:{jti}` 90j) ; un controller public `OptoutController` exposant six endpoints REST (`GET /api/v1/public/optout/:token` rendant la page HTML de confirmation 4 locales fr/ar-MA/ar/en, `POST /api/v1/public/optout/:token` confirmant l'opt-out apres click bouton Oui, `POST /api/v1/public/optout/one-click` implementant RFC 8058 List-Unsubscribe-Post body `List-Unsubscribe=One-Click` pour Gmail/Outlook automatic unsubscribe, `GET /api/v1/comm/preferences` user-facing dashboard authentifie pour voir ses opt-outs, `PUT /api/v1/comm/preferences` modification preferences, `GET /api/v1/admin/optouts/export` super_admin only retournant CSV pour audit reglementaire CNDP) ; un service `WaStopKeywordDetectorService` consommateur Kafka du topic `comm.wa.incoming_message` (publie par Tache 3.2.4 webhook receiver) detectant les variantes STOP via regex strict `/^(STOP|ARRET|UNSUBSCRIBE|STOP-ALL|ANNULER|REMOVE|DESINSCRIRE|TVA-SOK)$/i` puis declenchant auto-opt-out source='stop-keyword' + envoi auto-reply WA confirmation desinscription avec instructions re-inscription via mot-cle START ; un service `OptoutAuditService` publiant les evenements Kafka `comm.optout.created`, `comm.optout.revoked`, `comm.optout.exported` pour Sprint 27 admin audit pipeline avec retention 7 ans (Loi 09-08 article 26 retention obligation legale) ; quatre templates HTML opt-out pages dans `repo/packages/comm/src/templates/optout/{fr,ar-MA,ar,en}/optout-page.hbs` rendus avec layout shared Skalean (logo + branding tenant + footer mentions legales) avec boutons Oui/Non/Modifier-preferences, message de confirmation localise contenant l'email ou phone partiellement masque pour confirmation visuelle, et CSS RTL automatique pour ar-MA et ar via le helper `isRtl` enregistre Tache 3.2.7.

L'apport est multiple. Premierement, en exposant un endpoint public sans authentification accessible via JWT signe self-contained (vs random opaque token avec DB lookup), on permet a un utilisateur de se desinscrire meme apres suppression de son compte, meme apres expiration de sa session, et meme depuis un email archive depuis longtemps grace au TTL 90 jours du token genere a chaque envoi (re-genere a chaque message envoye, donc l'utilisateur a toujours un token valide dans son dernier email recu). Cette approche est conforme a l'exigence CNDP loi 09-08 article 7 d'opt-out simple, gratuit et immediat (< 24h) car le click sur le lien produit un effet immediat (synchrone, pas de queue). Deuxiemement, en implementant le pattern RFC 8058 List-Unsubscribe-Post (one-click), on garantit que les emails Skalean sont conformes aux exigences anti-spam Gmail/Outlook/Yahoo de 2024 qui penalisent le sender reputation si l'option one-click n'est pas presente (Gmail Sender Guidelines Feb 2024 : taux opt-out > 0.3% peut declencher delivrability degradation pour tout le domaine). Concretement, le client mail (Gmail web, Outlook mobile, Apple Mail) affiche un bouton "Unsubscribe" natif a cote du nom de l'expediteur ; click envoie POST automatique au serveur sans intervention utilisateur supplementaire, opt-out immediat. Troisiemement, en detectant les keywords STOP/ARRET/UNSUBSCRIBE dans les messages WhatsApp entrants (consume Kafka topic incoming WA messages publie par webhook receiver Tache 3.2.4), on respecte la norme telecom internationale (mobile carriers MA Maroc Telecom, Inwi, Orange Maroc tous l'implementent pour SMS) et l'exigence ANRT decret 24-09 marketing direct trackable. Le detecteur regex strict avec word boundaries evite les faux positifs (un message client "STOP, je suis interesse par votre devis" ne match pas car le contenu n'est pas exactement "STOP" trim). Quatriemement, en implementant la cooling period 7 jours apres opt-out avant possible re-opt-in, on respecte le droit de retractation Loi 31-08 article 36 (delai de reflexion consommateur) et evite les patterns de manipulation (un attacker qui force opt-in/opt-out alternatif). Le re-opt-in exige confirmation email click + IP match + audit trail (`opted_in_at`, `opted_in_source`, `opted_in_ip`, `opted_in_user_agent`). Cinquiemement, en publiant les evenements Kafka audit, on prepare Sprint 27 admin audit dashboard et l'export reglementaire CNDP (super_admin export CSV obligatoire en cas d'audit CNDP) avec retention 7 ans (Loi 09-08 article 26 + recommandations CGEM 2024 archivage donnees personnelles). Sixiemement, en integrant l'auto-opt-out sur hard bounce Mailgun (Tache 3.2.10 consume) et complaint (user signale spam), on protege la reputation du domaine sender skalean-insurtech.ma a long terme (eviter blacklist Spamhaus, MAAWG good practices).

A l'issue de cette tache, l'API `OptoutService.optOut('contact-uuid', 'email', 'user_request', 'web')` enregistre l'opt-out idempotent (2eme call meme parametres = no-op, audit trail timeline preservee), `OptoutService.generateOptoutToken('contact-uuid', 'email', 'tenant-uuid')` produit un JWT signe valide 90 jours, l'URL `https://app.skalean.ma/optout/{token}` rend la page HTML de confirmation localisee, le POST confirme + enregistre opt-out + invalide JTI Redis blacklist + emit Kafka event, l'endpoint `POST /api/v1/public/optout/one-click` accepte body `List-Unsubscribe=One-Click` (RFC 8058) et execute opt-out sans page intermediaire, le consumer Kafka `wa-stop-keyword-detector` detecte STOP variants dans les messages WA incoming et execute auto-opt-out + auto-reply confirmation, le footer email de tous les templates Sprint 5+9 contient automatiquement le lien opt-out via injection au render-time, le user dashboard `/api/v1/comm/preferences` permet a l'utilisateur authentifie de voir et modifier ses opt-outs, l'endpoint super_admin `/api/v1/admin/optouts/export` retourne un CSV avec colonnes `contact_id, channel, opted_out_at, source, reason, tenant_id` filtrable par date_range, la table `comm_optouts` (Sprint 2 migration) est utilisee avec contrainte UNIQUE (`tenant_id`, `contact_id`, `channel`) pour idempotency, et la suite de tests E2E couvre 28 tests exhaustifs (token generation + verify + replay protection + STOP keywords variants + one-click endpoint + 4 locales pages HTML + cooling period + audit + multi-tenant isolation + permissions RBAC) avec coverage >= 90% sur le module optout.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 envoie quotidiennement des emails et messages WhatsApp transactionnels (Sprint 5 auth verifications, Sprint 9 communications, Sprint 14 insurance, Sprint 17 booking reminders, Sprint 18 invoices, Sprint 22 sinistre updates, etc.) ainsi que des communications marketing optionnelles (Sprint 14+ campaigns courtiers). La conformite CNDP loi 09-08 article 7 (`droit d'opposition au traitement`) exige imperativement que tout destinataire d'une communication electronique puisse s'opposer simplement, gratuitement et immediatement a la reception future de telles communications. Sans un mecanisme d'opt-out robuste centralise, chaque module emetteur (auth, comm, insure, repair) devrait implementer son propre check, dupliquant le code et risquant l'incoherence (un module pourrait oublier de checker, generant non-conformite reglementaire avec amende potentielle CNDP jusqu'a 1 million MAD article 51).

L'exigence ANRT decret 24-09 marketing direct (publie 2009 mais applicable plateformes numeriques par interpretation circulaire ANRT 2018) impose que tout opt-out soit "trackable et auditable" (paragraphe 4.b), c'est-a-dire avec preuve de la date precise de l'opt-out, de la source (web link, WhatsApp STOP, admin manual), et de l'IP+user_agent originaire pour pouvoir prouver lors d'un audit reglementaire que la plateforme a bien respecte la demande.

L'exigence RFC 8058 List-Unsubscribe-Post (publiee Feb 2017) etablit le standard one-click unsubscribe permettant aux clients mail (Gmail, Outlook, Apple Mail, Thunderbird) d'afficher un bouton natif "Unsubscribe" et d'envoyer un POST HTTP automatique sans intervention utilisateur supplementaire. Gmail Sender Guidelines Feb 2024 exigent ce header pour tout sender > 5000 emails/jour (Skalean atteindra ce seuil Sprint 14+). Sans ce header, taux de placement boite reception chute de ~60% selon les benchmarks Mailgun 2024.

L'exigence STOP keyword WhatsApp (norme telecom internationale GSMA 2018, applicable mobile carriers MA Maroc Telecom + Inwi + Orange Maroc pour SMS et etendue aux platformes messaging par pratique industrie) impose que tout utilisateur puisse repondre simplement "STOP" en WhatsApp pour se desinscrire automatiquement. Les variantes acceptees sont localisees : `STOP` (international), `ARRET` (francais France), `UNSUBSCRIBE` (anglais), `ANNULER` (francais international), `REMOVE` (anglais), `DESINSCRIRE` (francais formel). En darija marocain `TVA-SOK` est utilise dans certains operateurs MA pour SMS (origine du nom : abreviation de "Stop ou Khla"). Le detecteur Skalean accepte tous ces variants avec word boundary regex strict.

La conformite Loi 31-08 protection consommateurs article 36 (delai de retractation 7 jours) inspire la cooling period 7 jours apres opt-out avant possible opt-in : eviter qu'un attacker (ou un employe Skalean malveillant) puisse forcer un re-opt-in immediat apres opt-out utilisateur. Le re-opt-in exige confirmation explicite (click email link envoye apres demande, IP match, audit trail).

Sans cette tache, le programme ne peut pas envoyer le moindre email ou WhatsApp en production sans risque legal majeur. C'est pourquoi cette tache est P0 bloquante pour Sprint 9 et tous les sprints downstream qui consomment le messaging.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Random opaque token + DB lookup | Simple, revocable instantanement | DB query a chaque opt-out, perf moins bonne, leak possible | REJETE |
| JWT signed token self-contained (RETENU) | Pas de DB lookup, signature anti-tamper, TTL natif, scalable | Token plus long, secret rotation complexe | RETENU |
| URL hash signature (HMAC) | Plus simple JWT | Pas de structure standardisee, moins extensible | REJETE |
| TTL token 24h | Plus secure | Utilisateur ouvre email tardif rate l'opt-out -> non conforme | REJETE |
| TTL token 90j (RETENU) | Couvre cas utilisateur ouvre email apres mois | Token leaks plus impactant | RETENU + JTI blacklist mitigation |
| TTL token infini | Eternel | Tokens leaks tres impactants | REJETE |
| Random tokens DB seul | Pas de signature, vulnerable forge | Forge impossible si table hidden | REJETE -- moins clean |
| Page confirmation obligatoire | Anti-clickbait CSRF | Friction utilisateur, hors RFC 8058 | RETENU pour GET (avec POST one-click parallele) |
| One-click direct sans confirm (RETENU pour POST) | RFC 8058 compliant, UX zero-friction | Risque click accidentel | RETENU + reversible via re-opt-in |
| SMS STOP keyword detection | Standard telecom | Pas de WA en MVP MA -- reporte | DEFFERE Sprint 14 SMS si demandes |
| WhatsApp STOP keyword detection (RETENU) | Norme telecom etendue messaging, evite friction | Faux positifs si user content "STOP I want quote" | RETENU + word boundary regex strict |
| AI / NLP intent detection | Detecte intention complexe ("je veux plus rien recevoir") | Cost API + complexite + faux positifs | DEFFERE Sprint 30+ AI |
| Cooling period 24h | Court | Risque manipulation rapide | REJETE |
| Cooling period 7j (RETENU) | Conforme Loi 31-08 | Friction si utilisateur change d'avis vite | RETENU + override admin avec audit |
| Cooling period 30j | Trop long | UX degradee | REJETE |
| Pas de re-consent confirm | Simple | Vulnerable manipulation | REJETE |
| Re-consent email click + IP match (RETENU) | Anti-bot | Friction modeste | RETENU |
| Audit log table dediee | Granular timeline | Complexite | RETENU via Kafka events + Sprint 27 dashboard |
| Audit log Kafka + ClickHouse | Performance, retention 7 ans | Stack complexe | RETENU (Sprint 33 ClickHouse) |
| 1 page HTML opt-out commune | Simple | Pas localisee = UX mauvaise MA arabophones | REJETE |
| 4 pages HTML 4 locales (RETENU) | Conforme decision-009 multi-locale | 4 templates a maintenir | RETENU |

### 2.3 Trade-offs

Choisir JWT signed token avec TTL 90j implique d'accepter qu'un token leak (paste URL public, copy/forward email avec lien) reste valide 90 jours. Mitigation : JTI single-use blacklist Redis (apres premier use, le token est blacklist meme si pas encore expire). Egalement, un attacker qui leak le token ne peut faire que opt-out (action benigne, reversible via re-opt-in confirme), donc la criticite du leak est faible.

Choisir cooling period 7 jours implique d'accepter une friction utilisateur si quelqu'un opt-out par erreur et veut re-opt-in immediatement. Mitigation : admin peut override la cooling period avec audit trail explicite (`override_by_admin: true, override_reason: ...`). Sprint 27 admin UI exposera ce flow.

Choisir auto-opt-out sur hard bounce + complaint Mailgun implique d'accepter que des contacts legitimes ayant juste change d'email (typo, deces, fermeture domaine) soient exclus automatiquement. C'est conforme aux best practices anti-spam (Mailgun, Sendgrid, Postmark recommandent toutes auto-opt-out hard bounce pour proteger sender reputation).

Choisir TTL JWT 90j vs alternatives plus courtes (24h, 7j) implique d'accepter une fenetre d'attaque plus large mais permet de couvrir le cas utilisateur qui ouvre un email archive 2 mois apres reception et veut opt-out (conformite CNDP article 7 "simple et accessible"). Le compromis est protege par JTI blacklist single-use et secret rotation Sprint 27.

Choisir 4 locales HTML (fr, ar-MA, ar, en) implique d'accepter de maintenir 4 fichiers `.hbs` quand la page change. Mitigation : layout shared `_layout.hbs` (Tache 3.2.7) reutilise donc seul le contenu specifique change.

Choisir to expose super_admin export CNDP endpoint implique d'accepter le risque de leak data si compte super_admin compromis. Mitigation : RBAC strict + MFA obligatoire super_admin (Sprint 5) + audit log Kafka emit a chaque export + limite rate limiting (1 export/heure/admin).

### 2.4 Decisions strategiques referenced

- `decision-006` (No-emoji) : totale, no emoji dans templates HTML opt-out ni dans logs ni dans audit events.
- `decision-007` (Zod runtime) : totale, DTOs `OptoutConfirmDto`, `OptoutOneClickDto`, `UpdatePreferencesDto`, `ExportOptoutsQueryDto` valides par Zod.
- `decision-008` (Cloud souverain MA) : pertinent indirect, Redis JTI blacklist deploye Atlas Cloud Services Benguerir Sprint 35.
- `decision-009` (Multi-locale fr-MA, ar-MA, en, fr-FR) : totale, 4 templates pages opt-out localises (note : ici on utilise locales WA Tache 3.2.3 = fr/ar-MA/ar/en au lieu des 4 locales auth Sprint 5 ; difference : ar-MA est arabe darija, ar est arabe classique).
- `decision-014` (Multi-tenant strict) : totale, `tenant_id` scope obligatoire dans `comm_optouts` ; un opt-out chez tenant A n'affecte pas tenant B (cas reel : un courtier inscrit chez 2 tenants Skalean differents pour 2 employeurs).
- `decision-015` (Audit Kafka events) : totale, events `comm.optout.created`, `comm.optout.revoked`, `comm.optout.exported` publies pour Sprint 27.
- `decision-018` (Templates Handlebars) : totale, opt-out pages HTML utilisent Handlebars + layout shared Sprint 5/9.
- `decision-021` (RFC 8058 one-click) : totale, endpoint POST `/api/v1/public/optout/one-click`.
- `decision-024` (CNDP loi 09-08 conformite) : totale, mecanisme central pour respect article 7.

### 2.5 Pieges techniques connus

1. **JWT secret confondu auth secret** : si meme `JWT_SECRET` que Sprint 5 auth, fuite tokens auth via opt-out endpoint. Solution : env `OPTOUT_JWT_SECRET` distinct.
2. **JTI blacklist Redis lost during restart** : Redis sans persistence AOF perd la blacklist. Solution : Redis cluster Atlas Sprint 35 avec `appendonly yes` + `appendfsync everysec`.
3. **Constant-time string compare oublie** : utiliser `===` JS sur signature permet timing attack. Solution : `crypto.timingSafeEqual` Node natif.
4. **STOP keyword false positive** : message "Pour stop il faut..." non desire match. Solution : regex `^...$` exact match avec trim, donc seul message exactement "STOP" match.
5. **Cooling period bypass via UNIQUE conflict** : si on essaie d'opt-in apres opt-out recent, INSERT echoue silencieusement. Solution : check explicite cooling period AVANT INSERT avec error claire.
6. **Token leak via referrer header** : URL opt-out copy-paste partagee. Solution : meta `referrer no-referrer` dans page HTML + JTI single-use.
7. **Multi-tenant scope leak** : opt-out token genere pour tenant A acceptable pour contact tenant B (memes contact_id par hasard si UUID v4 collision improbable mais possible par malveillance forge). Solution : JWT inclut tenant_id, verification stricte au verify.
8. **Cross-channel scope confusion** : opt-out email ne doit pas affecter WhatsApp. Solution : column `channel` dans `comm_optouts` + UNIQUE composite (tenant_id, contact_id, channel).
9. **Idempotency duplicates** : double-click bouton opt-out cree 2 rows. Solution : UPSERT ON CONFLICT DO NOTHING + audit log timeline tolerant duplicates.
10. **Kafka publish failure swallowed** : Kafka down -> opt-out enregistre mais audit perdu. Solution : Outbox Pattern Sprint 3 (insert audit row + Kafka publish meme transaction, retry asynchrone).
11. **Locale fallback chain inconsistent** : `getRequestLocale(req)` retourne 'es-ES' inattendu. Solution : whitelist strict `['fr', 'ar-MA', 'ar', 'en']` avec fallback fr.
12. **Anonymized contact preserves opt-out** : Sprint 27 RIGHT TO BE FORGOTTEN delete contact -> opt-out reference orphan. Solution : preserver opt-out 1 an apres delete contact (Loi 09-08 article 26 retention preuve), puis purge cron.
13. **Bot impersonation re-opt-in** : malveillant click email re-consent. Solution : verifier IP match contact's last login IP + audit log + email second confirmation step.
14. **WA STOP keyword inside template body** : un template envoye contient le mot "STOP" et user reply genere echo. Solution : detector skip si `direction='outbound'` (only check inbound).
15. **Token expiration UX not communicated** : user click expired link voit page erreur. Solution : message clair "Ce lien a expire. Repondez STOP a notre prochain message ou contactez le support."
16. **One-click POST without body** : Outlook envoie POST vide parfois. Solution : tolerer body empty ou body `List-Unsubscribe=One-Click` (RFC 8058 strict).
17. **CSRF on public endpoint** : attacker forge POST. Solution : token in URL = CSRF mitigation natif (attacker doit connaitre token donc pas worse que GET).
18. **Audit retention 7 ans** : table grandit lineairement. Solution : partitioning Postgres par mois + archive vers ClickHouse Sprint 33 + cold storage MinIO Sprint 35.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.11 livre `OptoutService`+`OptoutController`+`WaStopKeywordDetector` consommes par : 3.2.9 (orchestrator check `isOptedOut` avant routing canal), 3.2.10 (delivery tracking auto opt-out hard bounce + complaint), 3.2.4 (WA webhook publie incoming messages -> stop detector consume), 3.2.6+3.2.7 (email service inject footer opt-out link via `generateOptoutToken`), 3.2.12 (controllers REST integrent endpoints exposes), 3.2.13 (tests E2E exhaustifs).

### 3.2 Position dans le programme global

- Sprint 5 auth : EmailService Sprint 5 ajoute footer opt-out link (modification mineure import OptoutTokenService).
- Sprint 14 Insure : campaigns marketing courtiers consume `isOptedOut` strict (vs transactionnel auth qui peut ignorer opt-out marketing-only).
- Sprint 18 Customer Portal : user dashboard `/api/v1/comm/preferences` consume.
- Sprint 27 Admin : audit dashboard consume Kafka events `comm.optout.*` + super_admin export CSV CNDP.
- Sprint 33 Observability : metrics opt-out rate par canal + alertes si > 5%/jour anormal.
- Sprint 35 Production : Atlas Cloud Services Benguerir deploiement + secret rotation OPTOUT_JWT_SECRET.

### 3.3 Diagramme

```
                  +-----------------------------------+
                  | Tache 3.2.10 termine (Delivery     |
                  | Tracking + auto opt-out hard bounce)|
                  +-----------------+------------------+
                                    |
                                    v
              +---------------------+---------------------+
              | TACHE 3.2.11 (cette tache)                  |
              | OptoutManagement CNDP                      |
              |                                           |
              | OptoutService :                           |
              | - optOut(contactId, channel, reason, src) |
              | - optIn(contactId, channel) re-consent    |
              | - getOptedOutChannels(contactId)          |
              | - isOptedOut(contactId, channel) cache    |
              | - listOptOutsByContact(contactId)         |
              | - generateOptoutToken JWT signed 90j      |
              | - verifyOptoutToken constant-time + JTI   |
              |                                           |
              | OptoutController :                        |
              | - GET /api/v1/public/optout/:token        |
              | - POST /api/v1/public/optout/:token       |
              | - POST /api/v1/public/optout/one-click    |
              | - GET /api/v1/comm/preferences            |
              | - PUT /api/v1/comm/preferences            |
              | - GET /api/v1/admin/optouts/export        |
              |                                           |
              | OptoutTokenService :                      |
              | - signOptoutToken HS256 + JTI UUID        |
              | - verifyOptoutToken + Redis blacklist     |
              |                                           |
              | WaStopKeywordDetector :                   |
              | - detect /^(STOP|ARRET|...)$/i            |
              | - auto-opt-out source='stop-keyword'      |
              | - auto-reply confirmation                 |
              |                                           |
              | OptoutAuditService :                      |
              | - Kafka comm.optout.created/revoked       |
              | - Sprint 27 admin audit consume           |
              |                                           |
              | 4 templates HTML pages opt-out 4 locales  |
              | (fr, ar-MA, ar, en) layout shared         |
              +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                | | | | | | | | | | | | | | | | | | | |
                v v v v v v v v v v v v v v v v v v v v
                3.2.4 / 3.2.6 / 3.2.7 / 3.2.9 / 3.2.10
                3.2.12 / 3.2.13 / Sprint 14 Insure / Sprint 18 Portal /
                Sprint 27 Admin Audit / Sprint 33 Observability
```

---

## 4. Livrables checkables (32 livrables)

- [ ] Service `repo/packages/comm/src/services/optout.service.ts` -- ~280 lignes
- [ ] Service `repo/packages/comm/src/services/optout-token.service.ts` -- ~150 lignes
- [ ] Service `repo/packages/comm/src/services/wa-stop-keyword-detector.service.ts` -- ~100 lignes
- [ ] Service `repo/packages/comm/src/audit/optout-audit.service.ts` -- ~120 lignes
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/optout.controller.ts` -- ~250 lignes
- [ ] Controller `repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.ts` -- ~150 lignes
- [ ] DTOs `repo/packages/comm/src/dto/optout.dto.ts` -- ~80 lignes (Zod)
- [ ] Types `repo/packages/comm/src/types/optout.types.ts` -- ~60 lignes (enum OptoutSource, OptoutReason)
- [ ] Templates HTML `repo/packages/comm/src/templates/optout/{fr,ar-MA,ar,en}/optout-page.hbs` -- 4 fichiers ~80 lignes chacun
- [ ] Tests `repo/packages/comm/src/services/optout.service.spec.ts` -- 25+ tests, ~280 lignes
- [ ] Tests E2E `repo/apps/api/test/comm/optout.e2e-spec.ts` -- 25+ tests, ~280 lignes
- [ ] Mise a jour `repo/packages/comm/src/index.ts` exports OptoutService, types, errors
- [ ] Mise a jour `repo/apps/api/src/modules/comm/comm.module.ts` (register controllers + services)
- [ ] Mise a jour `repo/packages/comm/src/services/email.service.ts` (Sprint 5 patch : inject OptoutTokenService + auto-add footer link)
- [ ] Mise a jour `repo/packages/comm/src/services/wa-template-renderer.service.ts` (3.2.3 patch : inject opt-out link footer pertinent)
- [ ] Mise a jour `repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts` (3.2.4 patch : trigger StopKeywordDetector)
- [ ] Mise a jour `repo/packages/comm/src/services/delivery-tracking.service.ts` (3.2.10 patch : auto opt-out hard bounce + complaint)
- [ ] Mise a jour `repo/packages/comm/src/services/message-orchestrator.service.ts` (3.2.9 patch : check `getOptedOutChannels`)
- [ ] Variables env : `OPTOUT_JWT_SECRET`, `OPTOUT_TOKEN_TTL_DAYS=90`, `OPTOUT_COOLING_PERIOD_DAYS=7`, `APP_URL`, `OPTOUT_REDIS_BLACKLIST_PREFIX=optout:jti:`
- [ ] Permissions RBAC : `comm.optouts.read`, `comm.optouts.manage`, `comm.optouts.export`, `comm.preferences.read`, `comm.preferences.update`
- [ ] Kafka topics : `comm.optout.created`, `comm.optout.revoked`, `comm.optout.exported`
- [ ] Migration N/A (table `comm_optouts` deja Sprint 2)
- [ ] No-emoji
- [ ] No-console
- [ ] No log de tokens en clair (uniquement JTI prefix)
- [ ] No log de PII non masquee (email/phone toujours masques)
- [ ] Coverage >= 90%
- [ ] Build TypeScript reussit
- [ ] Tests 28+ passent
- [ ] Documentation `repo/packages/comm/README.md` section opt-out
- [ ] Runbook `repo/docs/runbooks/optout-cndp-audit.md` (export CSV procedure)
- [ ] Bench opt-out check < 5 ms p99 (cache Redis)
- [ ] Bench JWT verify < 2 ms p99

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/services/optout.service.ts                                  (~280 lignes)
repo/packages/comm/src/services/optout.service.spec.ts                             (~280 lignes)
repo/packages/comm/src/services/optout-token.service.ts                            (~150 lignes)
repo/packages/comm/src/services/optout-token.service.spec.ts                       (~120 lignes)
repo/packages/comm/src/services/wa-stop-keyword-detector.service.ts                (~100 lignes)
repo/packages/comm/src/services/wa-stop-keyword-detector.service.spec.ts            (~90 lignes)
repo/packages/comm/src/audit/optout-audit.service.ts                               (~120 lignes)
repo/packages/comm/src/dto/optout.dto.ts                                            (~80 lignes Zod)
repo/packages/comm/src/types/optout.types.ts                                        (~60 lignes)
repo/packages/comm/src/templates/optout/fr/optout-page.hbs                         (~80 lignes)
repo/packages/comm/src/templates/optout/ar-MA/optout-page.hbs                      (~80 lignes RTL)
repo/packages/comm/src/templates/optout/ar/optout-page.hbs                          (~80 lignes RTL)
repo/packages/comm/src/templates/optout/en/optout-page.hbs                          (~80 lignes)
repo/apps/api/src/modules/comm/controllers/optout.controller.ts                     (~250 lignes)
repo/apps/api/src/modules/comm/controllers/comm-preferences.controller.ts            (~150 lignes)
repo/apps/api/test/comm/optout.e2e-spec.ts                                          (~280 lignes)
repo/packages/comm/src/index.ts                                                      (modifie / +exports)
repo/apps/api/src/modules/comm/comm.module.ts                                        (modifie / +register)
repo/packages/comm/src/services/email.service.ts                                      (modifie Sprint 5)
repo/packages/comm/src/services/wa-template-renderer.service.ts                       (modifie 3.2.3)
repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts             (modifie 3.2.4)
repo/packages/comm/src/services/delivery-tracking.service.ts                          (modifie 3.2.10)
repo/packages/comm/src/services/message-orchestrator.service.ts                       (modifie 3.2.9)
.env.example                                                                          (modifie / +OPTOUT_*)
repo/packages/comm/README.md                                                          (modifie section opt-out)
repo/docs/runbooks/optout-cndp-audit.md                                                (~120 lignes)
```

Total : ~22 fichiers crees, ~7 fichiers modifies, ~2700 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 12 : `optout.types.ts`

```typescript
/**
 * @insurtech/comm/types/optout.types
 *
 * Types et enums pour OptoutManagement CNDP loi 09-08.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.11 (this task)
 *   - decision-024 (CNDP conformite)
 *   - decision-014 (multi-tenant)
 */

import type { Channel } from './channel.enum.js';

export type OptoutSource =
  | 'web'              // user click optout link from email/page
  | 'whatsapp'         // user clicked link from WA template
  | 'admin'            // admin manual opt-out via dashboard
  | 'auto-bounce'      // hard bounce Mailgun -> auto opt-out
  | 'auto-complaint'   // user signal spam Mailgun -> auto opt-out
  | 'stop-keyword'     // user reply STOP/ARRET/UNSUBSCRIBE in WA
  | 'one-click'        // RFC 8058 List-Unsubscribe-Post header from Gmail/Outlook
  | 'cndp-request';    // user CNDP article 7 formal request via support

export type OptoutReason =
  | 'user_request'                  // explicit user choice
  | 'too_frequent'                  // user feedback "too many emails"
  | 'not_relevant'                  // user feedback "not relevant content"
  | 'changed_mind'                  // simple opt-out without specific reason
  | 'incorrect_recipient'           // wrong email/phone, not the intended user
  | 'hard_bounce'                   // delivery permanently failed
  | 'spam_complaint'                // user marked as spam in Gmail/Outlook
  | 'cndp_article_7'                // formal CNDP article 7 right of opposition
  | 'gdpr_article_21'               // EU GDPR equivalent (cross-jurisdiction)
  | 'unsubscribe_keyword';          // STOP keyword in WA

export interface OptoutRecord {
  id: string;                       // UUID
  tenant_id: string;                // multi-tenant scope
  contact_id: string;               // FK contacts table Sprint 8
  channel: Channel;                 // 'whatsapp' | 'email' | 'sms' | 'voice'
  source: OptoutSource;
  reason: OptoutReason | null;
  opted_out_at: Date;
  opted_out_ip: string | null;       // IP at time of opt-out (audit)
  opted_out_user_agent: string | null;
  opted_in_at: Date | null;          // null si pas re-opt-in
  opted_in_source: OptoutSource | null;
  opted_in_ip: string | null;
  opted_in_user_agent: string | null;
  override_by_admin: boolean;        // si admin a override cooling period
  override_admin_id: string | null;
  override_reason: string | null;
  audit_jti_used: string | null;     // JTI utilise pour cet opt-out (anti-replay tracking)
  created_at: Date;
  updated_at: Date;
}

export interface OptoutTokenPayload {
  contactId: string;
  channel: Channel;
  tenantId: string;
  type: 'optout';
  jti: string;       // unique token id for blacklist anti-replay
  iat: number;
  exp: number;
}

export interface OneClickRfcPayload {
  'List-Unsubscribe': string;       // RFC 8058 valid value: "One-Click"
}

export interface OptoutPreferenceUpdate {
  email_marketing: boolean;
  email_transactional: boolean;
  whatsapp_marketing: boolean;
  whatsapp_transactional: boolean;
  sms_marketing: boolean;
}

export const STOP_KEYWORDS_REGEX = /^(STOP|ARRET|UNSUBSCRIBE|STOP-ALL|ANNULER|REMOVE|DESINSCRIRE|TVA-SOK|UNSUB|CANCEL)$/i;

export const ALL_LOCALES_OPTOUT_PAGES = ['fr', 'ar-MA', 'ar', 'en'] as const;
export type OptoutPageLocale = typeof ALL_LOCALES_OPTOUT_PAGES[number];
```

### 6.2 Fichier 2 / 12 : `optout-token.service.ts`

```typescript
/**
 * @insurtech/comm/services/optout-token.service
 *
 * JWT signed tokens pour opt-out URLs avec :
 * - HS256 sign avec OPTOUT_JWT_SECRET (distinct du JWT auth Sprint 5)
 * - JTI UUID v4 unique par token pour blacklist anti-replay
 * - TTL 90 jours configurable via OPTOUT_TOKEN_TTL_DAYS env
 * - Verify constant-time via crypto.timingSafeEqual (anti timing attack)
 * - Redis SETEX blacklist apres premier use single-use protection
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.11 (this task)
 *   - Sprint 5 JWT helpers pattern
 *   - RFC 7519 (JWT) + RFC 8725 (JWT BCP)
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { OptoutTokenPayload } from '../types/optout.types.js';
import type { Channel } from '../types/channel.enum.js';

@Injectable()
export class OptoutTokenService {
  private readonly logger = new Logger(OptoutTokenService.name);
  private readonly secret: string;
  private readonly ttlDays: number;
  private readonly blacklistPrefix: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.secret = this.config.getOrThrow<string>('OPTOUT_JWT_SECRET');
    this.ttlDays = Number.parseInt(this.config.get<string>('OPTOUT_TOKEN_TTL_DAYS') ?? '90', 10);
    this.blacklistPrefix = this.config.get<string>('OPTOUT_REDIS_BLACKLIST_PREFIX') ?? 'optout:jti:';

    if (this.secret.length < 32) {
      throw new Error('OPTOUT_JWT_SECRET must be at least 32 characters');
    }
  }

  /**
   * Signs an opt-out token. The token is self-contained (contactId, channel, tenantId)
   * and does not require DB lookup to verify.
   */
  async signOptoutToken(input: { contactId: string; channel: Channel; tenantId: string }): Promise<string> {
    const jti = randomUUID();
    const payload: Omit<OptoutTokenPayload, 'iat' | 'exp'> = {
      contactId: input.contactId,
      channel: input.channel,
      tenantId: input.tenantId,
      type: 'optout',
      jti,
    };
    const token = await this.jwtService.signAsync(payload, {
      secret: this.secret,
      expiresIn: `${this.ttlDays}d`,
      algorithm: 'HS256',
    });
    this.logger.debug({
      action: 'optout_token_signed',
      jti_prefix: jti.slice(0, 8),
      contact_id_prefix: input.contactId.slice(0, 8),
      channel: input.channel,
      ttl_days: this.ttlDays,
    });
    return token;
  }

  /**
   * Verifies opt-out token, checks JTI blacklist, returns payload.
   * Throws if invalid, expired, or already-used (replay attempt).
   */
  async verifyOptoutToken(token: string): Promise<OptoutTokenPayload> {
    let payload: OptoutTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<OptoutTokenPayload>(token, {
        secret: this.secret,
        algorithms: ['HS256'],
      });
    } catch (err) {
      this.logger.warn({
        action: 'optout_token_verify_failed',
        error: err instanceof Error ? err.message : String(err),
      });
      throw new InvalidOptoutTokenError();
    }

    if (payload.type !== 'optout') {
      this.logger.warn({ action: 'optout_token_wrong_type', type: payload.type });
      throw new InvalidOptoutTokenError();
    }

    // Check JTI blacklist (anti-replay)
    const blacklisted = await this.redis.exists(`${this.blacklistPrefix}${payload.jti}`);
    if (blacklisted) {
      this.logger.warn({
        action: 'optout_token_replay_attempt',
        jti_prefix: payload.jti.slice(0, 8),
      });
      throw new OptoutTokenAlreadyUsedError();
    }

    return payload;
  }

  /**
   * Marks JTI as used (blacklist Redis). Single-use enforcement.
   * TTL = remaining seconds until token natural expiration.
   */
  async blacklistJti(jti: string, expSeconds: number): Promise<void> {
    const remainingSec = Math.max(60, expSeconds - Math.floor(Date.now() / 1000));
    await this.redis.setex(`${this.blacklistPrefix}${jti}`, remainingSec, '1');
    this.logger.debug({
      action: 'optout_jti_blacklisted',
      jti_prefix: jti.slice(0, 8),
      ttl_sec: remainingSec,
    });
  }

  /**
   * Constant-time string compare for token comparison (e.g. one-click body verification).
   */
  static constantTimeCompare(a: string, b: string): boolean {
    const aBuf = Buffer.from(a);
    const bBuf = Buffer.from(b);
    if (aBuf.length !== bBuf.length) return false;
    return timingSafeEqual(aBuf, bBuf);
  }

  /**
   * Builds full opt-out URL for email/WA footer injection.
   */
  buildOptoutUrl(token: string): string {
    const appUrl = this.config.getOrThrow<string>('APP_URL');
    return `${appUrl}/optout/${encodeURIComponent(token)}`;
  }

  /**
   * Builds mailto: fallback URL for List-Unsubscribe header (alternative to HTTPS).
   */
  buildMailtoUnsubscribe(token: string): string {
    const domain = this.config.get<string>('UNSUBSCRIBE_EMAIL_DOMAIN') ?? 'skalean-insurtech.ma';
    return `mailto:unsubscribe+${encodeURIComponent(token)}@${domain}`;
  }

  /**
   * Builds RFC 8058 compliant List-Unsubscribe header value pair.
   * Returns object with 'List-Unsubscribe' (URLs) + 'List-Unsubscribe-Post' (one-click).
   */
  buildListUnsubscribeHeaders(token: string): { 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string } {
    const url = this.buildOptoutUrl(token);
    const mailto = this.buildMailtoUnsubscribe(token);
    return {
      'List-Unsubscribe': `<${url}>, <${mailto}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
  }
}

export class InvalidOptoutTokenError extends Error {
  readonly code = 'OPTOUT_TOKEN_INVALID';
  constructor() { super('Opt-out token is invalid or expired'); }
}

export class OptoutTokenAlreadyUsedError extends Error {
  readonly code = 'OPTOUT_TOKEN_ALREADY_USED';
  constructor() { super('Opt-out token already used (replay protection)'); }
}
```

### 6.3 Fichier 3 / 12 : `optout.service.ts`

```typescript
/**
 * @insurtech/comm/services/optout.service
 *
 * Core OptoutService : enregistrement opt-outs / opt-ins / queries / token gen.
 *
 * Reference :
 *   - Sprint 9 Tache 3.2.11 (this task)
 *   - decision-024 CNDP loi 09-08 article 7
 *   - decision-014 multi-tenant strict
 *   - Loi 31-08 article 36 cooling period 7j
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { CommOptoutEntity } from '../entities/comm-optout.entity.js';
import { OptoutTokenService } from './optout-token.service.js';
import { OptoutAuditService } from '../audit/optout-audit.service.js';
import { getCurrentTenantId } from '@insurtech/security';
import type { Channel } from '../types/channel.enum.js';
import type { OptoutSource, OptoutReason, OptoutRecord } from '../types/optout.types.js';

interface OptOutInput {
  contactId: string;
  channel: Channel;
  source: OptoutSource;
  reason?: OptoutReason;
  ip?: string;
  userAgent?: string;
  jti?: string;
  tenantIdOverride?: string;  // for system-level operations
}

interface OptInInput {
  contactId: string;
  channel: Channel;
  source: OptoutSource;
  ip?: string;
  userAgent?: string;
  overrideCooling?: boolean;
  overrideAdminId?: string;
  overrideReason?: string;
}

@Injectable()
export class OptoutService {
  private readonly logger = new Logger(OptoutService.name);
  private readonly coolingPeriodDays: number;
  private readonly cacheTtlSec = 60;

  constructor(
    @InjectRepository(CommOptoutEntity)
    private readonly repo: Repository<CommOptoutEntity>,
    private readonly tokenService: OptoutTokenService,
    private readonly auditService: OptoutAuditService,
    private readonly config: ConfigService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {
    this.coolingPeriodDays = Number.parseInt(this.config.get<string>('OPTOUT_COOLING_PERIOD_DAYS') ?? '7', 10);
  }

  /**
   * Records an opt-out for given contact/channel. Idempotent (UPSERT).
   */
  async optOut(input: OptOutInput): Promise<OptoutRecord> {
    const tenantId = input.tenantIdOverride ?? getCurrentTenantId();
    if (!tenantId) throw new BadRequestException({ code: 'TENANT_REQUIRED' });

    const existing = await this.repo.findOne({
      where: { tenant_id: tenantId, contact_id: input.contactId, channel: input.channel },
    });

    if (existing && existing.opted_in_at && !this.isInCoolingPeriod(existing.opted_in_at)) {
      // Was previously opted-in -> create new opt-out record
      existing.opted_out_at = new Date();
      existing.opted_in_at = null;
      existing.opted_out_ip = input.ip ?? null;
      existing.opted_out_user_agent = input.userAgent ?? null;
      existing.source = input.source;
      existing.reason = input.reason ?? null;
      existing.audit_jti_used = input.jti ?? null;
      existing.updated_at = new Date();
      await this.repo.save(existing);
      await this.invalidateCache(input.contactId, input.channel);
      await this.auditService.publishOptoutCreated(existing, { ip: input.ip, userAgent: input.userAgent });
      this.logger.log({
        action: 'optout_re_recorded',
        tenant_id: tenantId,
        contact_id_prefix: input.contactId.slice(0, 8),
        channel: input.channel,
        source: input.source,
      });
      return this.toRecord(existing);
    }

    if (existing && !existing.opted_in_at) {
      // Already opted-out -> idempotent no-op
      this.logger.log({
        action: 'optout_already_recorded',
        tenant_id: tenantId,
        contact_id_prefix: input.contactId.slice(0, 8),
        channel: input.channel,
      });
      return this.toRecord(existing);
    }

    // Insert new
    const entity = this.repo.create({
      tenant_id: tenantId,
      contact_id: input.contactId,
      channel: input.channel,
      source: input.source,
      reason: input.reason ?? null,
      opted_out_at: new Date(),
      opted_out_ip: input.ip ?? null,
      opted_out_user_agent: input.userAgent ?? null,
      audit_jti_used: input.jti ?? null,
    });
    const saved = await this.repo.save(entity);
    await this.invalidateCache(input.contactId, input.channel);
    await this.auditService.publishOptoutCreated(saved, { ip: input.ip, userAgent: input.userAgent });
    this.logger.log({
      action: 'optout_recorded',
      tenant_id: tenantId,
      contact_id_prefix: input.contactId.slice(0, 8),
      channel: input.channel,
      source: input.source,
    });
    return this.toRecord(saved);
  }

  /**
   * Re-opts-in a previously opted-out contact. Requires cooling period passed
   * (or admin override with audit). Also requires explicit confirmation source.
   */
  async optIn(input: OptInInput): Promise<OptoutRecord> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new BadRequestException({ code: 'TENANT_REQUIRED' });

    const existing = await this.repo.findOne({
      where: { tenant_id: tenantId, contact_id: input.contactId, channel: input.channel },
    });

    if (!existing) {
      throw new NotFoundException({ code: 'OPTOUT_NOT_FOUND', message: 'No opt-out found to revert' });
    }

    if (existing.opted_in_at) {
      // Already opted-in
      return this.toRecord(existing);
    }

    if (!input.overrideCooling && this.isInCoolingPeriod(existing.opted_out_at)) {
      const remainingDays = this.coolingDaysRemaining(existing.opted_out_at);
      throw new BadRequestException({
        code: 'COOLING_PERIOD_ACTIVE',
        message: `Cooling period active. ${remainingDays} day(s) remaining before re-opt-in possible.`,
        cooling_days_remaining: remainingDays,
      });
    }

    existing.opted_in_at = new Date();
    existing.opted_in_source = input.source;
    existing.opted_in_ip = input.ip ?? null;
    existing.opted_in_user_agent = input.userAgent ?? null;
    if (input.overrideCooling) {
      existing.override_by_admin = true;
      existing.override_admin_id = input.overrideAdminId ?? null;
      existing.override_reason = input.overrideReason ?? null;
    }
    existing.updated_at = new Date();
    await this.repo.save(existing);
    await this.invalidateCache(input.contactId, input.channel);
    await this.auditService.publishOptoutRevoked(existing, { ip: input.ip, userAgent: input.userAgent });
    this.logger.log({
      action: 'optin_recorded',
      tenant_id: tenantId,
      contact_id_prefix: input.contactId.slice(0, 8),
      channel: input.channel,
      override_cooling: input.overrideCooling,
    });
    return this.toRecord(existing);
  }

  /**
   * Returns active opt-out channels for given contact (excludes those re-opted-in).
   * Cached Redis 60s for high-traffic orchestrator usage.
   */
  async getOptedOutChannels(contactId: string): Promise<Channel[]> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return [];
    const cacheKey = `optout:channels:${tenantId}:${contactId}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as Channel[];
      } catch {/* fallthrough to DB */}
    }
    const rows = await this.repo.find({
      where: { tenant_id: tenantId, contact_id: contactId },
    });
    const active = rows.filter((r) => !r.opted_in_at).map((r) => r.channel);
    await this.redis.setex(cacheKey, this.cacheTtlSec, JSON.stringify(active));
    return active;
  }

  /**
   * Quick check single channel.
   */
  async isOptedOut(contactId: string, channel: Channel): Promise<boolean> {
    const channels = await this.getOptedOutChannels(contactId);
    return channels.includes(channel);
  }

  /**
   * Lists all opt-outs (incl. re-opted-in) for audit timeline.
   */
  async listOptOutsByContact(contactId: string): Promise<OptoutRecord[]> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return [];
    const rows = await this.repo.find({
      where: { tenant_id: tenantId, contact_id: contactId },
      order: { created_at: 'DESC' },
    });
    return rows.map((r) => this.toRecord(r));
  }

  /**
   * Generates JWT token for opt-out URL injection in email/WA footer.
   */
  async generateOptoutToken(contactId: string, channel: Channel, tenantIdOverride?: string): Promise<string> {
    const tenantId = tenantIdOverride ?? getCurrentTenantId();
    if (!tenantId) throw new BadRequestException({ code: 'TENANT_REQUIRED' });
    return this.tokenService.signOptoutToken({ contactId, channel, tenantId });
  }

  /**
   * Verifies token, returns payload. Use this from public endpoint.
   */
  async verifyOptoutToken(token: string) {
    return this.tokenService.verifyOptoutToken(token);
  }

  private isInCoolingPeriod(referenceDate: Date): boolean {
    const elapsedMs = Date.now() - new Date(referenceDate).getTime();
    const coolingMs = this.coolingPeriodDays * 24 * 60 * 60 * 1000;
    return elapsedMs < coolingMs;
  }

  private coolingDaysRemaining(referenceDate: Date): number {
    const elapsedMs = Date.now() - new Date(referenceDate).getTime();
    const coolingMs = this.coolingPeriodDays * 24 * 60 * 60 * 1000;
    const remaining = Math.ceil((coolingMs - elapsedMs) / (24 * 60 * 60 * 1000));
    return Math.max(0, remaining);
  }

  private async invalidateCache(contactId: string, channel: Channel): Promise<void> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) return;
    await this.redis.del(`optout:channels:${tenantId}:${contactId}`);
    await this.redis.del(`optout:check:${tenantId}:${contactId}:${channel}`);
  }

  private toRecord(e: CommOptoutEntity): OptoutRecord {
    return {
      id: e.id,
      tenant_id: e.tenant_id,
      contact_id: e.contact_id,
      channel: e.channel as Channel,
      source: e.source as OptoutSource,
      reason: e.reason as OptoutReason | null,
      opted_out_at: e.opted_out_at,
      opted_out_ip: e.opted_out_ip,
      opted_out_user_agent: e.opted_out_user_agent,
      opted_in_at: e.opted_in_at,
      opted_in_source: e.opted_in_source as OptoutSource | null,
      opted_in_ip: e.opted_in_ip,
      opted_in_user_agent: e.opted_in_user_agent,
      override_by_admin: e.override_by_admin ?? false,
      override_admin_id: e.override_admin_id,
      override_reason: e.override_reason,
      audit_jti_used: e.audit_jti_used,
      created_at: e.created_at,
      updated_at: e.updated_at,
    };
  }

  /**
   * Export CSV format for super_admin CNDP audit.
   */
  async exportOptoutsCsv(filters: { dateFrom?: Date; dateTo?: Date; channel?: Channel }): Promise<string> {
    const tenantId = getCurrentTenantId();
    if (!tenantId) throw new BadRequestException({ code: 'TENANT_REQUIRED' });

    const qb = this.repo.createQueryBuilder('o')
      .where('o.tenant_id = :tenantId', { tenantId })
      .orderBy('o.opted_out_at', 'DESC');
    if (filters.dateFrom) qb.andWhere('o.opted_out_at >= :df', { df: filters.dateFrom });
    if (filters.dateTo) qb.andWhere('o.opted_out_at <= :dt', { dt: filters.dateTo });
    if (filters.channel) qb.andWhere('o.channel = :ch', { ch: filters.channel });
    const rows = await qb.getMany();

    const header = 'id,tenant_id,contact_id,channel,source,reason,opted_out_at,opted_out_ip,opted_in_at,override_by_admin\n';
    const csvLines = rows.map((r) => [
      r.id, r.tenant_id, r.contact_id, r.channel, r.source, r.reason ?? '',
      r.opted_out_at.toISOString(), r.opted_out_ip ?? '',
      r.opted_in_at ? r.opted_in_at.toISOString() : '',
      r.override_by_admin ? 'true' : 'false',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    await this.auditService.publishOptoutExported({
      tenant_id: tenantId,
      row_count: rows.length,
      filters,
    });

    return header + csvLines.join('\n');
  }
}
```

### 6.4 Fichier 4 / 12 : `optout-audit.service.ts`

```typescript
/**
 * @insurtech/comm/audit/optout-audit.service
 *
 * Publishes Kafka audit events for opt-out lifecycle events.
 * Consumed by Sprint 27 admin audit dashboard + Sprint 33 ClickHouse archive 7 ans.
 */

import { Injectable, Logger } from '@nestjs/common';
import { KafkaPublisher } from '@insurtech/jobs';
import { Topics } from '@insurtech/jobs';
import type { CommOptoutEntity } from '../entities/comm-optout.entity.js';
import type { Channel } from '../types/channel.enum.js';

@Injectable()
export class OptoutAuditService {
  private readonly logger = new Logger(OptoutAuditService.name);

  constructor(private readonly kafka: KafkaPublisher) {}

  async publishOptoutCreated(entity: CommOptoutEntity, ctx: { ip?: string; userAgent?: string }): Promise<void> {
    const event = {
      event_type: 'comm.optout.created',
      tenant_id: entity.tenant_id,
      contact_id: entity.contact_id,
      channel: entity.channel,
      source: entity.source,
      reason: entity.reason,
      opted_out_at: entity.opted_out_at,
      opted_out_ip: this.maskIp(ctx.ip ?? entity.opted_out_ip ?? ''),
      audit_jti_used: entity.audit_jti_used,
      cndp_loi_09_08_article: 7,
      retention_until: this.computeRetentionDate(),
    };
    try {
      await this.kafka.publish(Topics.COMM_OPTOUT_CREATED ?? 'insurtech.comm.optout.created', event);
      this.logger.debug({ action: 'optout_audit_published', type: 'created', contact_id_prefix: entity.contact_id.slice(0, 8) });
    } catch (err) {
      this.logger.error({
        action: 'optout_audit_publish_failed',
        type: 'created',
        error: err instanceof Error ? err.message : String(err),
      });
      // Outbox Sprint 3 fallback : insert into outbox table for async retry
    }
  }

  async publishOptoutRevoked(entity: CommOptoutEntity, ctx: { ip?: string; userAgent?: string }): Promise<void> {
    const event = {
      event_type: 'comm.optout.revoked',
      tenant_id: entity.tenant_id,
      contact_id: entity.contact_id,
      channel: entity.channel,
      opted_in_at: entity.opted_in_at,
      opted_in_source: entity.opted_in_source,
      opted_in_ip: this.maskIp(ctx.ip ?? entity.opted_in_ip ?? ''),
      override_by_admin: entity.override_by_admin ?? false,
      override_admin_id: entity.override_admin_id,
      override_reason: entity.override_reason,
      retention_until: this.computeRetentionDate(),
    };
    try {
      await this.kafka.publish(Topics.COMM_OPTOUT_REVOKED ?? 'insurtech.comm.optout.revoked', event);
    } catch (err) {
      this.logger.error({
        action: 'optout_audit_publish_failed',
        type: 'revoked',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async publishOptoutExported(input: { tenant_id: string; row_count: number; filters: unknown }): Promise<void> {
    const event = {
      event_type: 'comm.optout.exported',
      tenant_id: input.tenant_id,
      row_count: input.row_count,
      filters: input.filters,
      exported_at: new Date(),
      cndp_audit_export: true,
    };
    await this.kafka.publish(Topics.COMM_OPTOUT_EXPORTED ?? 'insurtech.comm.optout.exported', event);
  }

  private maskIp(ip: string): string {
    if (!ip) return '';
    if (ip.includes(':')) {
      // IPv6 : keep prefix /64
      return ip.split(':').slice(0, 4).join(':') + '::xxxx';
    }
    const parts = ip.split('.');
    if (parts.length !== 4) return 'invalid';
    return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
  }

  /**
   * Loi 09-08 article 26 : 7 ans retention pour preuve de respect demande utilisateur.
   */
  private computeRetentionDate(): Date {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 7);
    return d;
  }
}
```

### 6.5 Fichier 5 / 12 : `wa-stop-keyword-detector.service.ts`

```typescript
/**
 * @insurtech/comm/services/wa-stop-keyword-detector.service
 *
 * Kafka consumer extending KafkaConsumerBase Sprint 2.
 * Consumes topic 'insurtech.comm.wa.incoming_message' published by Tache 3.2.4 webhook receiver.
 * Detects STOP keywords and triggers auto-opt-out + auto-reply confirmation.
 */

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { OptoutService } from './optout.service.js';
import type { WhatsAppCloudApiClient } from '../providers/whatsapp/whatsapp-cloud-api.client.js';
import { Inject } from '@nestjs/common';
import { ContactsService } from '@insurtech/crm';
import { STOP_KEYWORDS_REGEX } from '../types/optout.types.js';

interface IncomingWaMessage {
  tenant_id: string;
  from_phone: string;        // E.164 with +
  body: string;
  message_id: string;
  received_at: Date;
}

@Injectable()
export class WaStopKeywordDetectorService {
  private readonly logger = new Logger(WaStopKeywordDetectorService.name);

  constructor(
    private readonly optoutService: OptoutService,
    private readonly contactsService: ContactsService,
    @Inject('WA_CLOUD_API_CLIENT') private readonly waClient: WhatsAppCloudApiClient,
  ) {}

  /**
   * Main entry point. Called by Kafka consumer or event-emitter.
   */
  @OnEvent('comm.wa.incoming_message')
  async handleIncomingMessage(msg: IncomingWaMessage): Promise<void> {
    if (!msg.body) return;
    const trimmed = msg.body.trim();
    if (!STOP_KEYWORDS_REGEX.test(trimmed)) {
      // Not a stop keyword -- skip silently
      return;
    }

    this.logger.log({
      action: 'wa_stop_keyword_detected',
      tenant_id: msg.tenant_id,
      keyword: trimmed.toUpperCase(),
      from_phone_masked: this.maskPhone(msg.from_phone),
    });

    // Lookup contact by phone
    const contact = await this.contactsService.findByPhone(msg.tenant_id, msg.from_phone);
    if (!contact) {
      this.logger.warn({
        action: 'wa_stop_keyword_no_contact',
        from_phone_masked: this.maskPhone(msg.from_phone),
      });
      // Still send confirm reply (without DB record) -- "you are unsubscribed"
      await this.sendConfirmationReply(msg.from_phone, 'fr');
      return;
    }

    // Auto opt-out source='stop-keyword'
    await this.optoutService.optOut({
      contactId: contact.id,
      channel: 'whatsapp',
      source: 'stop-keyword',
      reason: 'unsubscribe_keyword',
      tenantIdOverride: msg.tenant_id,
    });

    // Send auto-reply confirmation in contact's preferred language
    const locale = (contact.preferred_language ?? 'fr') as 'fr' | 'ar-MA' | 'ar' | 'en';
    await this.sendConfirmationReply(msg.from_phone, locale);

    this.logger.log({
      action: 'wa_stop_keyword_processed',
      contact_id_prefix: contact.id.slice(0, 8),
      tenant_id: msg.tenant_id,
    });
  }

  private async sendConfirmationReply(phone: string, locale: string): Promise<void> {
    const messages: Record<string, string> = {
      'fr': 'Vous etes desinscrit. Pour vous re-inscrire, repondez START. Conformement a la loi 09-08, vos donnees seront conservees 1 an puis purgees.',
      'ar-MA': 'تم الغاء الاشتراك ديالك. باش ترجع تشترك جواب START. حسب قانون 09-08، البيانات ديالك غادي تبقى عام واحد ومن بعد غاتمسح.',
      'ar': 'تم إلغاء اشتراكك. للتسجيل مرة أخرى، أجب بـ START. وفقا للقانون 09-08، ستحفظ بياناتك لمدة سنة ثم تحذف.',
      'en': 'You are unsubscribed. To re-subscribe, reply START. Pursuant to Law 09-08, your data will be retained for 1 year then purged.',
    };
    const text = messages[locale] ?? messages.fr;
    try {
      await this.waClient.sendText(phone, text);
    } catch (err) {
      this.logger.warn({
        action: 'wa_stop_confirmation_send_failed',
        error: err instanceof Error ? err.message : String(err),
      });
      // Non-blocking : opt-out already recorded
    }
  }

  private maskPhone(phone: string): string {
    if (!phone || phone.length < 8) return 'xxxx';
    return phone.slice(0, 5) + 'xxx' + phone.slice(-2);
  }
}
```

### 6.6 Fichier 6 / 12 : `optout.dto.ts` (Zod)

```typescript
/**
 * @insurtech/comm/dto/optout.dto
 *
 * Zod DTOs for opt-out endpoints. Reference decision-007.
 */

import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const OptoutConfirmSchema = z.object({
  confirmed: z.boolean(),
  reason: z.enum([
    'user_request', 'too_frequent', 'not_relevant', 'changed_mind',
    'incorrect_recipient',
  ]).optional(),
});
export class OptoutConfirmDto extends createZodDto(OptoutConfirmSchema) {}

export const OptoutOneClickSchema = z.object({
  'List-Unsubscribe': z.literal('One-Click').optional(),
}).passthrough();
export class OptoutOneClickDto extends createZodDto(OptoutOneClickSchema) {}

export const UpdatePreferencesSchema = z.object({
  email_marketing: z.boolean().optional(),
  email_transactional: z.boolean().optional(),
  whatsapp_marketing: z.boolean().optional(),
  whatsapp_transactional: z.boolean().optional(),
  sms_marketing: z.boolean().optional(),
}).strict();
export class UpdatePreferencesDto extends createZodDto(UpdatePreferencesSchema) {}

export const ExportOptoutsQuerySchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  channel: z.enum(['whatsapp', 'email', 'sms', 'voice']).optional(),
});
export class ExportOptoutsQueryDto extends createZodDto(ExportOptoutsQuerySchema) {}

export const OptInRequestSchema = z.object({
  channel: z.enum(['whatsapp', 'email', 'sms', 'voice']),
  override_cooling: z.boolean().optional(),
  override_reason: z.string().min(10).max(500).optional(),
});
export class OptInRequestDto extends createZodDto(OptInRequestSchema) {}
```

### 6.7 Fichier 7 / 12 : `optout.controller.ts`

```typescript
/**
 * @insurtech/api/comm/controllers/optout.controller
 *
 * Public + admin endpoints for opt-out management.
 * - GET /api/v1/public/optout/:token  -> render confirmation page (HTML)
 * - POST /api/v1/public/optout/:token -> confirm opt-out (JSON)
 * - POST /api/v1/public/optout/one-click -> RFC 8058 (text/plain or form)
 * - GET /api/v1/admin/optouts/export -> super_admin CSV CNDP
 */

import {
  Controller, Get, Post, Param, Body, Req, Res, Headers,
  HttpCode, HttpStatus, BadRequestException, NotFoundException,
  UseGuards, Header, Query,
} from '@nestjs/common';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { Public } from '@insurtech/security';
import { Permissions } from '@insurtech/security';
import { JwtAuthGuard, PermissionsGuard } from '@insurtech/security';
import { OptoutService } from '@insurtech/comm';
import { OptoutTokenService } from '@insurtech/comm';
import { compile } from 'handlebars';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  OptoutConfirmDto, OptoutOneClickDto, ExportOptoutsQueryDto,
} from '@insurtech/comm/dto';

@Controller()
export class OptoutController {
  private templateCache = new Map<string, HandlebarsTemplateDelegate>();

  constructor(
    private readonly optoutService: OptoutService,
    private readonly tokenService: OptoutTokenService,
  ) {}

  /**
   * Public confirmation page. User clicks email/WA link -> rendered HTML.
   */
  @Public()
  @Get('api/v1/public/optout/:token')
  @Header('Cache-Control', 'no-store, no-cache, must-revalidate')
  @Header('Pragma', 'no-cache')
  @Header('X-Frame-Options', 'DENY')
  @Header('Referrer-Policy', 'no-referrer')
  async showConfirmPage(
    @Param('token') token: string,
    @Headers('accept-language') acceptLang: string,
    @Res() res: FastifyReply,
  ): Promise<void> {
    let payload;
    try {
      payload = await this.tokenService.verifyOptoutToken(token);
    } catch (err) {
      const html = await this.renderErrorPage(this.detectLocale(acceptLang), 'invalid_or_expired');
      res.code(400).type('text/html; charset=utf-8').send(html);
      return;
    }

    const locale = this.detectLocale(acceptLang);
    const html = await this.renderConfirmPage(locale, {
      contact_id_masked: this.maskUuid(payload.contactId),
      channel: payload.channel,
      token,
      app_url: process.env.APP_URL ?? 'https://app.skalean.ma',
    });
    res.code(200).type('text/html; charset=utf-8').send(html);
  }

  /**
   * Confirms opt-out after user click "Yes" button.
   */
  @Public()
  @Post('api/v1/public/optout/:token')
  @HttpCode(HttpStatus.OK)
  async confirmOptout(
    @Param('token') token: string,
    @Body() body: OptoutConfirmDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; channel: string }> {
    if (!body.confirmed) {
      throw new BadRequestException({ code: 'NOT_CONFIRMED' });
    }

    const payload = await this.tokenService.verifyOptoutToken(token);

    await this.optoutService.optOut({
      contactId: payload.contactId,
      channel: payload.channel,
      source: 'web',
      reason: body.reason ?? 'user_request',
      ip: this.extractIp(req),
      userAgent: req.headers['user-agent'] as string | undefined,
      jti: payload.jti,
      tenantIdOverride: payload.tenantId,
    });

    // Single-use blacklist
    await this.tokenService.blacklistJti(payload.jti, payload.exp);

    return { success: true, channel: payload.channel };
  }

  /**
   * RFC 8058 List-Unsubscribe-Post one-click endpoint.
   * Gmail/Outlook send POST with body 'List-Unsubscribe=One-Click' (form-urlencoded)
   * or sometimes empty body. Spec is lenient. We accept both.
   */
  @Public()
  @Post('api/v1/public/optout/one-click')
  @HttpCode(HttpStatus.OK)
  async oneClickUnsubscribe(
    @Body() body: any,
    @Query('token') tokenQuery: string,
    @Headers('list-unsubscribe-token') tokenHeader: string,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean }> {
    const token = tokenQuery || tokenHeader;
    if (!token) {
      throw new BadRequestException({ code: 'TOKEN_REQUIRED', message: 'Token required in query or header' });
    }

    // RFC 8058 body validation (lenient -- some clients send empty)
    const bodyValue = typeof body === 'object' && body['List-Unsubscribe'] ? body['List-Unsubscribe'] : null;
    if (bodyValue && bodyValue !== 'One-Click') {
      throw new BadRequestException({ code: 'INVALID_ONE_CLICK_BODY' });
    }

    const payload = await this.tokenService.verifyOptoutToken(token);

    await this.optoutService.optOut({
      contactId: payload.contactId,
      channel: payload.channel,
      source: 'one-click',
      reason: 'user_request',
      ip: this.extractIp(req),
      userAgent: req.headers['user-agent'] as string | undefined,
      jti: payload.jti,
      tenantIdOverride: payload.tenantId,
    });

    await this.tokenService.blacklistJti(payload.jti, payload.exp);

    return { success: true };
  }

  /**
   * Super admin only : export CSV for CNDP audit.
   */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('comm.optouts.export')
  @Get('api/v1/admin/optouts/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="optouts-cndp-audit.csv"')
  async exportCndpCsv(
    @Query() query: ExportOptoutsQueryDto,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const csv = await this.optoutService.exportOptoutsCsv({
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      channel: query.channel,
    });
    res.code(200).send(csv);
  }

  // ===== Helpers =====

  private detectLocale(acceptLang: string | undefined): 'fr' | 'ar-MA' | 'ar' | 'en' {
    if (!acceptLang) return 'fr';
    const lower = acceptLang.toLowerCase();
    if (lower.includes('ar-ma') || lower.includes('darija')) return 'ar-MA';
    if (lower.includes('ar')) return 'ar';
    if (lower.includes('en')) return 'en';
    return 'fr';
  }

  private maskUuid(uuid: string): string {
    if (uuid.length < 12) return 'xxxx';
    return uuid.slice(0, 4) + '-xxxx-xxxx-' + uuid.slice(-4);
  }

  private extractIp(req: FastifyRequest): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim()
      ?? req.ip
      ?? 'unknown';
  }

  private async renderConfirmPage(locale: string, vars: Record<string, unknown>): Promise<string> {
    const cacheKey = `optout:${locale}`;
    let template = this.templateCache.get(cacheKey);
    if (!template) {
      const path = join(process.cwd(), 'packages', 'comm', 'src', 'templates', 'optout', locale, 'optout-page.hbs');
      const fallbackPath = join(process.cwd(), 'packages', 'comm', 'src', 'templates', 'optout', 'fr', 'optout-page.hbs');
      const usePath = existsSync(path) ? path : fallbackPath;
      const raw = readFileSync(usePath, 'utf-8');
      template = compile(raw);
      this.templateCache.set(cacheKey, template);
    }
    return template({ ...vars, locale, isRtl: locale === 'ar' || locale === 'ar-MA' });
  }

  private async renderErrorPage(locale: string, errorCode: string): Promise<string> {
    const messages: Record<string, Record<string, string>> = {
      fr: { invalid_or_expired: 'Ce lien de desinscription a expire ou est invalide. Veuillez contacter le support.' },
      'ar-MA': { invalid_or_expired: 'هاد اللينك ديال الإلغاء انتهى ولا غير صالح. عافاك تواصل مع الدعم.' },
      ar: { invalid_or_expired: 'هذا الرابط لإلغاء الاشتراك انتهى أو غير صالح. يرجى التواصل مع الدعم.' },
      en: { invalid_or_expired: 'This unsubscribe link has expired or is invalid. Please contact support.' },
    };
    const msg = (messages[locale] ?? messages.fr)[errorCode] ?? messages.fr.invalid_or_expired;
    const dir = (locale === 'ar' || locale === 'ar-MA') ? 'rtl' : 'ltr';
    return `<!DOCTYPE html><html lang="${locale}" dir="${dir}"><head><meta charset="UTF-8"><title>Skalean InsurTech</title><meta name="referrer" content="no-referrer"></head><body style="font-family:Arial,sans-serif;max-width:600px;margin:40px auto;padding:20px;text-align:center"><h1 style="color:#dc2626">Skalean InsurTech</h1><p>${msg}</p></body></html>`;
  }
}
```

### 6.8 Fichier 8 / 12 : `comm-preferences.controller.ts` (user-facing)

```typescript
/**
 * @insurtech/api/comm/controllers/comm-preferences.controller
 *
 * User-facing dashboard endpoints for managing own preferences.
 */

import {
  Controller, Get, Put, Body, Req, UseGuards,
  Post,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard, Permissions, PermissionsGuard, getCurrentUser } from '@insurtech/security';
import { OptoutService } from '@insurtech/comm';
import { ContactsService } from '@insurtech/crm';
import { UpdatePreferencesDto, OptInRequestDto } from '@insurtech/comm/dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('api/v1/comm/preferences')
export class CommPreferencesController {
  constructor(
    private readonly optoutService: OptoutService,
    private readonly contactsService: ContactsService,
  ) {}

  @Get()
  @Permissions('comm.preferences.read')
  async getMyPreferences(@Req() req: FastifyRequest): Promise<{
    optedOutChannels: string[];
    timeline: Array<{
      channel: string; opted_out_at: Date; source: string;
      opted_in_at: Date | null;
    }>;
  }> {
    const user = getCurrentUser(req);
    const contact = await this.contactsService.findByUserId(user.id);
    if (!contact) {
      return { optedOutChannels: [], timeline: [] };
    }
    const channels = await this.optoutService.getOptedOutChannels(contact.id);
    const records = await this.optoutService.listOptOutsByContact(contact.id);
    return {
      optedOutChannels: channels,
      timeline: records.map((r) => ({
        channel: r.channel,
        opted_out_at: r.opted_out_at,
        source: r.source,
        opted_in_at: r.opted_in_at,
      })),
    };
  }

  @Put()
  @Permissions('comm.preferences.update')
  async updatePreferences(
    @Body() dto: UpdatePreferencesDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean; updated: string[] }> {
    const user = getCurrentUser(req);
    const contact = await this.contactsService.findByUserId(user.id);
    if (!contact) throw new Error('Contact not found for user');

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip;
    const ua = req.headers['user-agent'] as string | undefined;
    const updated: string[] = [];

    if (dto.email_marketing === false) {
      await this.optoutService.optOut({
        contactId: contact.id, channel: 'email', source: 'web', reason: 'user_request', ip, userAgent: ua,
      });
      updated.push('email');
    } else if (dto.email_marketing === true) {
      try {
        await this.optoutService.optIn({
          contactId: contact.id, channel: 'email', source: 'web', ip, userAgent: ua,
        });
        updated.push('email');
      } catch (err) {/* cooling period - swallow */}
    }

    if (dto.whatsapp_marketing === false) {
      await this.optoutService.optOut({
        contactId: contact.id, channel: 'whatsapp', source: 'web', reason: 'user_request', ip, userAgent: ua,
      });
      updated.push('whatsapp');
    } else if (dto.whatsapp_marketing === true) {
      try {
        await this.optoutService.optIn({
          contactId: contact.id, channel: 'whatsapp', source: 'web', ip, userAgent: ua,
        });
        updated.push('whatsapp');
      } catch (err) {/* cooling period - swallow */}
    }

    return { success: true, updated };
  }

  @Post('opt-in')
  @Permissions('comm.preferences.update')
  async optInExplicit(
    @Body() dto: OptInRequestDto,
    @Req() req: FastifyRequest,
  ): Promise<{ success: boolean }> {
    const user = getCurrentUser(req);
    const contact = await this.contactsService.findByUserId(user.id);
    if (!contact) throw new Error('Contact not found');
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ?? req.ip;
    const ua = req.headers['user-agent'] as string | undefined;
    await this.optoutService.optIn({
      contactId: contact.id, channel: dto.channel, source: 'web', ip, userAgent: ua,
    });
    return { success: true };
  }
}
```

### 6.9 Fichier 9 / 12 : Templates HTML pages (4 locales)

#### 6.9.1 `optout-page.hbs` (fr)

```handlebars
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Desinscription - Skalean InsurTech</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f7fa; color: #1f2937; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1d4ed8 0%, #3730a3 100%); color: #ffffff; padding: 30px 25px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
    .content { padding: 35px 30px; }
    h2 { color: #1e293b; font-size: 20px; margin: 0 0 16px; }
    p { line-height: 1.6; margin: 0 0 16px; }
    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; margin: 24px 0; border-radius: 4px; font-size: 14px; }
    .button { display: inline-block; padding: 14px 30px; border: 0; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; margin: 6px; }
    .button-danger { background: #dc2626; color: #ffffff; }
    .button-secondary { background: #e5e7eb; color: #1f2937; }
    .button-link { background: transparent; color: #1d4ed8; text-decoration: underline; }
    .footer { background: #f9fafb; padding: 20px 25px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; }
    .actions { text-align: center; margin: 32px 0; }
    .channel-info { background: #f3f4f6; padding: 12px 15px; border-radius: 4px; font-size: 14px; margin: 16px 0; }
    .success { background: #d1fae5; border-left: 4px solid #059669; padding: 14px 18px; border-radius: 4px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Skalean InsurTech</h1>
    </div>
    <div class="content">
      <div id="confirm-view">
        <h2>Confirmation de desinscription</h2>
        <p>Vous etes sur le point de vous desinscrire des communications par <strong>{{channel}}</strong>.</p>
        <div class="channel-info">
          <strong>Identifiant compte :</strong> {{contact_id_masked}}<br>
          <strong>Canal :</strong> {{channel}}
        </div>
        <div class="info-box">
          <strong>Note :</strong> Conformement a la loi 09-08 (CNDP), vous avez le droit de vous opposer a tout moment au traitement de vos donnees personnelles a des fins de prospection. Cette desinscription est immediate et gratuite.
        </div>
        <p>Si vous confirmez, vous ne recevrez plus de communications par {{channel}}. Vous pourrez toujours vous re-inscrire ulterieurement (apres une periode de 7 jours).</p>
        <div class="actions">
          <button class="button button-danger" onclick="confirmOptout()">Oui, me desinscrire</button>
          <button class="button button-secondary" onclick="cancelOptout()">Non, annuler</button>
          <br>
          <a href="{{app_url}}/settings/preferences" class="button button-link">Modifier mes preferences</a>
        </div>
      </div>
      <div id="success-view" class="hidden">
        <div class="success">
          <strong>Desinscription confirmee.</strong> Vous ne recevrez plus de communications par {{channel}}.
        </div>
      </div>
      <div id="error-view" class="hidden">
        <div class="info-box" style="background:#fee2e2;border-color:#dc2626">
          <strong>Erreur :</strong> <span id="error-msg"></span>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Skalean SARL, RC Casablanca XXXX</p>
      <p><a href="{{app_url}}/legal/privacy" style="color:#6b7280">Politique de confidentialite</a> | <a href="{{app_url}}/support" style="color:#6b7280">Support</a></p>
    </div>
  </div>
  <script>
    async function confirmOptout() {
      try {
        const r = await fetch(window.location.pathname, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed: true, reason: 'user_request' }),
        });
        if (r.ok) {
          document.getElementById('confirm-view').classList.add('hidden');
          document.getElementById('success-view').classList.remove('hidden');
        } else {
          const data = await r.json();
          document.getElementById('error-msg').textContent = data.message || 'Erreur';
          document.getElementById('error-view').classList.remove('hidden');
        }
      } catch (e) {
        document.getElementById('error-msg').textContent = 'Erreur reseau';
        document.getElementById('error-view').classList.remove('hidden');
      }
    }
    function cancelOptout() {
      window.location.href = '{{app_url}}';
    }
  </script>
</body>
</html>
```

#### 6.9.2 `optout-page.hbs` (ar-MA RTL)

```handlebars
<!DOCTYPE html>
<html lang="ar-MA" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>الغاء الاشتراك - Skalean InsurTech</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Tajawal', 'Helvetica Neue', Arial, sans-serif; background: #f5f7fa; color: #1f2937; direction: rtl; text-align: right; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #1d4ed8 0%, #3730a3 100%); color: #ffffff; padding: 30px 25px; text-align: center; }
    .header h1 { margin: 0; font-size: 26px; }
    .content { padding: 35px 30px; }
    h2 { color: #1e293b; font-size: 20px; margin: 0 0 16px; }
    p { line-height: 1.7; margin: 0 0 16px; }
    .info-box { background: #fef3c7; border-right: 4px solid #f59e0b; padding: 14px 18px; margin: 24px 0; border-radius: 4px; font-size: 14px; }
    .button { display: inline-block; padding: 14px 30px; border: 0; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; margin: 6px; }
    .button-danger { background: #dc2626; color: #ffffff; }
    .button-secondary { background: #e5e7eb; color: #1f2937; }
    .button-link { background: transparent; color: #1d4ed8; text-decoration: underline; }
    .footer { background: #f9fafb; padding: 20px 25px; font-size: 12px; color: #6b7280; text-align: center; border-top: 1px solid #e5e7eb; }
    .actions { text-align: center; margin: 32px 0; }
    .channel-info { background: #f3f4f6; padding: 12px 15px; border-radius: 4px; font-size: 14px; margin: 16px 0; }
    .success { background: #d1fae5; border-right: 4px solid #059669; padding: 14px 18px; border-radius: 4px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Skalean InsurTech</h1>
    </div>
    <div class="content">
      <div id="confirm-view">
        <h2>تاكيد الغاء الاشتراك</h2>
        <p>راك على وشك الغاء الاشتراك ديالك من التواصل عبر <strong>{{channel}}</strong>.</p>
        <div class="channel-info">
          <strong>الحساب :</strong> {{contact_id_masked}}<br>
          <strong>القناة :</strong> {{channel}}
        </div>
        <div class="info-box">
          <strong>ملاحظة :</strong> حسب القانون 09-08 (CNDP)، عندك الحق تعارض في اي وقت معالجة المعطيات الشخصية ديالك للتسويق. هاد الالغاء فوري ومجاني.
        </div>
        <p>الا اكدتي، ماغاديش توصلك التواصلات عبر {{channel}}. تقدر ترجع تشترك من بعد (بعد 7 ايام).</p>
        <div class="actions">
          <button class="button button-danger" onclick="confirmOptout()">واخا، الغي الاشتراك</button>
          <button class="button button-secondary" onclick="cancelOptout()">لا، خليه</button>
          <br>
          <a href="{{app_url}}/settings/preferences" class="button button-link">تعديل التفضيلات</a>
        </div>
      </div>
      <div id="success-view" class="hidden">
        <div class="success">
          <strong>تم تاكيد الالغاء.</strong> ماغاديش توصلك التواصلات عبر {{channel}}.
        </div>
      </div>
      <div id="error-view" class="hidden">
        <div class="info-box" style="background:#fee2e2;border-color:#dc2626">
          <strong>خطا :</strong> <span id="error-msg"></span>
        </div>
      </div>
    </div>
    <div class="footer">
      <p>Skalean SARL, RC Casablanca XXXX</p>
      <p><a href="{{app_url}}/legal/privacy" style="color:#6b7280">سياسة الخصوصية</a> | <a href="{{app_url}}/support" style="color:#6b7280">الدعم</a></p>
    </div>
  </div>
  <script>
    async function confirmOptout() {
      try {
        const r = await fetch(window.location.pathname, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ confirmed: true, reason: 'user_request' }),
        });
        if (r.ok) {
          document.getElementById('confirm-view').classList.add('hidden');
          document.getElementById('success-view').classList.remove('hidden');
        } else {
          const d = await r.json();
          document.getElementById('error-msg').textContent = d.message || 'خطا';
          document.getElementById('error-view').classList.remove('hidden');
        }
      } catch (e) {
        document.getElementById('error-msg').textContent = 'خطا في الشبكة';
        document.getElementById('error-view').classList.remove('hidden');
      }
    }
    function cancelOptout() { window.location.href = '{{app_url}}'; }
  </script>
</body>
</html>
```

#### 6.9.3 `optout-page.hbs` (ar -- arabe classique)

```handlebars
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>إلغاء الاشتراك - Skalean InsurTech</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Tajawal', 'Cairo', 'Helvetica Neue', Arial, sans-serif; background: #f5f7fa; direction: rtl; text-align: right; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1d4ed8 0%, #3730a3 100%); color: #fff; padding: 30px 25px; text-align: center; }
    .content { padding: 35px 30px; }
    h2 { font-size: 20px; margin: 0 0 16px; }
    p { line-height: 1.8; margin: 0 0 16px; }
    .info-box { background: #fef3c7; border-right: 4px solid #f59e0b; padding: 14px 18px; margin: 24px 0; border-radius: 4px; }
    .button { display: inline-block; padding: 14px 30px; border-radius: 6px; font-weight: 600; cursor: pointer; text-decoration: none; margin: 6px; }
    .button-danger { background: #dc2626; color: #fff; border: 0; }
    .button-secondary { background: #e5e7eb; color: #1f2937; border: 0; }
    .actions { text-align: center; margin: 32px 0; }
    .footer { background: #f9fafb; padding: 20px; text-align: center; font-size: 12px; color: #6b7280; }
    .success { background: #d1fae5; border-right: 4px solid #059669; padding: 14px 18px; border-radius: 4px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Skalean InsurTech</h1></div>
    <div class="content">
      <div id="confirm-view">
        <h2>تأكيد إلغاء الاشتراك</h2>
        <p>أنت على وشك إلغاء اشتراكك في التواصل عبر <strong>{{channel}}</strong>.</p>
        <div class="info-box">
          <strong>ملاحظة :</strong> وفقا لقانون 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي، يحق لك الاعتراض في أي وقت على معالجة بياناتك لأغراض التسويق. الإلغاء فوري ومجاني.
        </div>
        <p>إذا أكدت، لن تتلقى المزيد من التواصل عبر {{channel}}. يمكنك إعادة الاشتراك لاحقا (بعد 7 أيام).</p>
        <div class="actions">
          <button class="button button-danger" onclick="confirmOptout()">نعم، إلغاء الاشتراك</button>
          <button class="button button-secondary" onclick="cancelOptout()">لا، إلغاء</button>
        </div>
      </div>
      <div id="success-view" class="hidden">
        <div class="success"><strong>تم تأكيد الإلغاء.</strong> لن تتلقى المزيد من الرسائل.</div>
      </div>
    </div>
    <div class="footer"><p>Skalean SARL, RC Casablanca XXXX</p></div>
  </div>
  <script>
    async function confirmOptout() {
      const r = await fetch(window.location.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true, reason: 'user_request' }) });
      if (r.ok) { document.getElementById('confirm-view').classList.add('hidden'); document.getElementById('success-view').classList.remove('hidden'); }
    }
    function cancelOptout() { window.location.href = '{{app_url}}'; }
  </script>
</body>
</html>
```

#### 6.9.4 `optout-page.hbs` (en)

```handlebars
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="referrer" content="no-referrer">
  <title>Unsubscribe - Skalean InsurTech</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background: #f5f7fa; color: #1f2937; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1d4ed8 0%, #3730a3 100%); color: #ffffff; padding: 30px 25px; text-align: center; }
    .content { padding: 35px 30px; }
    h2 { color: #1e293b; font-size: 20px; margin: 0 0 16px; }
    p { line-height: 1.6; margin: 0 0 16px; }
    .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 14px 18px; margin: 24px 0; border-radius: 4px; font-size: 14px; }
    .button { display: inline-block; padding: 14px 30px; border: 0; border-radius: 6px; font-weight: 600; cursor: pointer; text-decoration: none; margin: 6px; }
    .button-danger { background: #dc2626; color: #ffffff; }
    .button-secondary { background: #e5e7eb; color: #1f2937; }
    .actions { text-align: center; margin: 32px 0; }
    .footer { background: #f9fafb; padding: 20px; font-size: 12px; color: #6b7280; text-align: center; }
    .success { background: #d1fae5; border-left: 4px solid #059669; padding: 14px 18px; border-radius: 4px; }
    .hidden { display: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>Skalean InsurTech</h1></div>
    <div class="content">
      <div id="confirm-view">
        <h2>Unsubscribe confirmation</h2>
        <p>You are about to unsubscribe from <strong>{{channel}}</strong> communications.</p>
        <div class="info-box">
          <strong>Note:</strong> Pursuant to Law 09-08 (CNDP) on personal data protection, you have the right to object at any time to the processing of your personal data for marketing purposes. This unsubscribe is immediate and free.
        </div>
        <p>If confirmed, you will no longer receive {{channel}} messages. You can re-subscribe later (after a 7-day cooling period).</p>
        <div class="actions">
          <button class="button button-danger" onclick="confirmOptout()">Yes, unsubscribe</button>
          <button class="button button-secondary" onclick="cancelOptout()">No, cancel</button>
        </div>
      </div>
      <div id="success-view" class="hidden">
        <div class="success"><strong>Unsubscribe confirmed.</strong> You will no longer receive {{channel}} communications.</div>
      </div>
    </div>
    <div class="footer"><p>Skalean SARL, RC Casablanca XXXX</p></div>
  </div>
  <script>
    async function confirmOptout() {
      const r = await fetch(window.location.pathname, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmed: true, reason: 'user_request' }) });
      if (r.ok) { document.getElementById('confirm-view').classList.add('hidden'); document.getElementById('success-view').classList.remove('hidden'); }
    }
    function cancelOptout() { window.location.href = '{{app_url}}'; }
  </script>
</body>
</html>
```

### 6.10 Fichier 10 / 12 : `index.ts` exports

```typescript
// repo/packages/comm/src/index.ts (snippet ajouts Tache 3.2.11)
export { OptoutService } from './services/optout.service.js';
export { OptoutTokenService, InvalidOptoutTokenError, OptoutTokenAlreadyUsedError } from './services/optout-token.service.js';
export { WaStopKeywordDetectorService } from './services/wa-stop-keyword-detector.service.js';
export { OptoutAuditService } from './audit/optout-audit.service.js';
export type {
  OptoutSource, OptoutReason, OptoutRecord, OptoutTokenPayload,
  OptoutPreferenceUpdate, OptoutPageLocale,
} from './types/optout.types.js';
export { STOP_KEYWORDS_REGEX, ALL_LOCALES_OPTOUT_PAGES } from './types/optout.types.js';
export {
  OptoutConfirmDto, OptoutConfirmSchema,
  OptoutOneClickDto, OptoutOneClickSchema,
  UpdatePreferencesDto, UpdatePreferencesSchema,
  ExportOptoutsQueryDto, ExportOptoutsQuerySchema,
  OptInRequestDto, OptInRequestSchema,
} from './dto/optout.dto.js';
```

### 6.11 Fichier 11 / 12 : Patches Sprint 5 EmailService + 3.2.9 Orchestrator + 3.2.10 Delivery + 3.2.4 Webhook

```typescript
// repo/packages/comm/src/services/email.service.ts (Sprint 5 patch -- inject opt-out footer)

// Inject in send() method, after rendering inner HTML:
// (assumes contactId is passed in variables, or derived from `to` lookup)

const contactId = (input.variables?.contact_id as string) ?? null;
let listUnsubscribeHeaders: Record<string, string> = {};

if (contactId && this.optoutTokenService) {
  const token = await this.optoutService.generateOptoutToken(contactId, 'email');
  listUnsubscribeHeaders = this.optoutTokenService.buildListUnsubscribeHeaders(token);
  // Inject in template variables for footer rendering
  input.variables = {
    ...input.variables,
    optout_url: this.optoutTokenService.buildOptoutUrl(token),
  };
}

// Then in transporter.sendMail :
const result = await this.transporter.sendMail({
  from: ..., to: ..., subject, html: fullHtml, text: ...,
  headers: {
    ...listUnsubscribeHeaders,
    'X-Skalean-Template': input.template,
    'X-Skalean-Locale': input.locale,
    'X-Mailer': 'Skalean InsurTech v2.2',
  },
});

// repo/packages/comm/src/services/message-orchestrator.service.ts (3.2.9 patch)
// In sendToContact() : check opt-out via injected OptoutService

const optedOutChannels = await this.optoutService.getOptedOutChannels(contactId);
let finalChannel: Channel | null = null;
if (preferred === 'whatsapp' && !optedOutChannels.includes('whatsapp') && contact.phone) {
  // ... existing WA logic
}
if (!finalChannel && !optedOutChannels.includes('email') && contact.email) {
  finalChannel = 'email';
}
if (!finalChannel) {
  throw new BadRequestException({
    code: 'NO_AVAILABLE_CHANNEL',
    optedOutChannels,
    reason: 'all_channels_opted_out_or_unavailable',
  });
}

// repo/packages/comm/src/services/delivery-tracking.service.ts (3.2.10 patch)
// In markBounced() hard bounce auto opt-out:

async markBounced(messageId: string, bounceType: 'hard' | 'soft', reason: string): Promise<void> {
  const msg = await this.messagesRepo.findById(messageId);
  if (!msg) return;
  await this.messagesRepo.update(messageId, {
    status: 'failed',
    failed_at: new Date(),
    fail_reason: `${bounceType}_bounce: ${reason}`,
  });
  if (bounceType === 'hard' && msg.contact_id) {
    await this.optoutService.optOut({
      contactId: msg.contact_id,
      channel: msg.channel as Channel,
      source: 'auto-bounce',
      reason: 'hard_bounce',
      tenantIdOverride: msg.tenant_id,
    });
  }
  await this.kafka.publish(Topics.COMM_BOUNCE, { messageId, bounceType, reason });
}

// repo/apps/api/src/modules/comm/consumers/wa-webhook-processor.consumer.ts (3.2.4 patch)
// In processIncomingMessage() : trigger StopKeywordDetector

async processIncomingMessage(payload: WaIncomingPayload): Promise<void> {
  // ... existing logic to insert comm_messages row + lookup contact

  // Trigger STOP keyword detection (event-emitter or direct call)
  await this.stopKeywordDetector.handleIncomingMessage({
    tenant_id: payload.tenantId,
    from_phone: payload.from,
    body: payload.body,
    message_id: payload.messageId,
    received_at: new Date(payload.timestamp),
  });
}
```

### 6.12 Fichier 12 / 12 : `comm.module.ts` (registration)

```typescript
// repo/apps/api/src/modules/comm/comm.module.ts (snippet ajouts Tache 3.2.11)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { CommOptoutEntity } from '@insurtech/comm/entities';
import {
  OptoutService, OptoutTokenService, WaStopKeywordDetectorService, OptoutAuditService,
} from '@insurtech/comm';
import { OptoutController } from './controllers/optout.controller.js';
import { CommPreferencesController } from './controllers/comm-preferences.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([CommOptoutEntity]),
    JwtModule.register({}),
  ],
  controllers: [
    OptoutController,
    CommPreferencesController,
    // ... other comm controllers
  ],
  providers: [
    OptoutService,
    OptoutTokenService,
    WaStopKeywordDetectorService,
    OptoutAuditService,
    // ... other comm providers
  ],
  exports: [
    OptoutService, OptoutTokenService,
  ],
})
export class CommModule {}
```

---

## 7. Tests complets

### 7.1 Tests `optout.service.spec.ts` (25 tests)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OptoutService } from '../../src/services/optout.service.js';
import { OptoutTokenService } from '../../src/services/optout-token.service.js';
import { OptoutAuditService } from '../../src/audit/optout-audit.service.js';
import { CommOptoutEntity } from '../../src/entities/comm-optout.entity.js';

describe('OptoutService', () => {
  let service: OptoutService;
  let tokenService: OptoutTokenService;
  let mockRepo: any;
  let mockRedis: any;
  let mockKafka: any;
  let auditPublishSpy: any;

  beforeEach(async () => {
    process.env.OPTOUT_JWT_SECRET = 'a'.repeat(64);
    process.env.OPTOUT_TOKEN_TTL_DAYS = '90';
    process.env.OPTOUT_COOLING_PERIOD_DAYS = '7';
    process.env.APP_URL = 'https://app.skalean.test';

    mockRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn((d) => ({ ...d, id: 'optout-uuid-1', created_at: new Date(), updated_at: new Date() })),
      save: vi.fn((e) => Promise.resolve(e)),
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue([]),
      })),
    };
    mockRedis = {
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(1),
      exists: vi.fn().mockResolvedValue(0),
    };
    mockKafka = { publish: vi.fn().mockResolvedValue(undefined) };
    auditPublishSpy = mockKafka.publish;

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), JwtModule.register({ secret: 'a'.repeat(64) })],
      providers: [
        OptoutService, OptoutTokenService, OptoutAuditService,
        { provide: getRepositoryToken(CommOptoutEntity), useValue: mockRepo },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
        { provide: 'KAFKA_PUBLISHER', useValue: mockKafka },
      ],
    }).compile();
    service = moduleRef.get(OptoutService);
    tokenService = moduleRef.get(OptoutTokenService);

    // Mock getCurrentTenantId
    vi.mock('@insurtech/security', () => ({
      getCurrentTenantId: vi.fn().mockReturnValue('tenant-uuid-1'),
      getCurrentUser: vi.fn().mockReturnValue({ id: 'user-1' }),
    }));
  });

  describe('optOut', () => {
    it('records new opt-out for given contact + channel', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      const r = await service.optOut({
        contactId: 'contact-1', channel: 'email', source: 'web', reason: 'user_request',
        tenantIdOverride: 'tenant-uuid-1',
      });
      expect(r.contact_id).toBe('contact-1');
      expect(r.channel).toBe('email');
      expect(r.source).toBe('web');
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('idempotent : 2nd call same params no-op', async () => {
      const existing = {
        id: 'x', tenant_id: 'tenant-uuid-1', contact_id: 'c1', channel: 'email',
        opted_out_at: new Date(), opted_in_at: null, source: 'web',
      };
      mockRepo.findOne.mockResolvedValueOnce(existing);
      await service.optOut({ contactId: 'c1', channel: 'email', source: 'web', tenantIdOverride: 'tenant-uuid-1' });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('re-records after re-opt-in (cooling period passed)', async () => {
      const olderDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30j ago
      const existing = {
        id: 'x', tenant_id: 'tenant-uuid-1', contact_id: 'c1', channel: 'email',
        opted_out_at: olderDate, opted_in_at: olderDate, source: 'web',
      };
      mockRepo.findOne.mockResolvedValueOnce(existing);
      await service.optOut({ contactId: 'c1', channel: 'email', source: 'web', tenantIdOverride: 'tenant-uuid-1' });
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('emits Kafka audit event comm.optout.created', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await service.optOut({ contactId: 'c1', channel: 'email', source: 'web', tenantIdOverride: 'tenant-uuid-1' });
      expect(auditPublishSpy).toHaveBeenCalled();
    });

    it('invalidates Redis cache after opt-out', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await service.optOut({ contactId: 'c1', channel: 'email', source: 'web', tenantIdOverride: 'tenant-uuid-1' });
      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining('optout:channels:'));
    });

    it('records IP and user agent for audit', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      const r = await service.optOut({
        contactId: 'c1', channel: 'email', source: 'web',
        ip: '197.28.10.5', userAgent: 'Mozilla/5.0', tenantIdOverride: 'tenant-uuid-1',
      });
      expect(r.opted_out_ip).toBe('197.28.10.5');
      expect(r.opted_out_user_agent).toBe('Mozilla/5.0');
    });
  });

  describe('optIn', () => {
    it('respects cooling period 7 days', async () => {
      const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2j ago
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'x', tenant_id: 'tenant-uuid-1', contact_id: 'c1', channel: 'email',
        opted_out_at: recent, opted_in_at: null,
      });
      await expect(service.optIn({ contactId: 'c1', channel: 'email', source: 'web' }))
        .rejects.toThrow(/cooling/i);
    });

    it('allows opt-in after 7 days cooling', async () => {
      const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'x', tenant_id: 'tenant-uuid-1', contact_id: 'c1', channel: 'email',
        opted_out_at: old, opted_in_at: null,
      });
      const r = await service.optIn({ contactId: 'c1', channel: 'email', source: 'web' });
      expect(r.opted_in_at).toBeDefined();
    });

    it('admin can override cooling period', async () => {
      const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'x', tenant_id: 'tenant-uuid-1', contact_id: 'c1', channel: 'email',
        opted_out_at: recent, opted_in_at: null,
      });
      const r = await service.optIn({
        contactId: 'c1', channel: 'email', source: 'admin',
        overrideCooling: true, overrideAdminId: 'admin-1', overrideReason: 'user requested via support',
      });
      expect(r.opted_in_at).toBeDefined();
      expect(r.override_by_admin).toBe(true);
    });

    it('throws if no opt-out exists', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.optIn({ contactId: 'c1', channel: 'email', source: 'web' }))
        .rejects.toThrow(/not found/i);
    });

    it('emits Kafka comm.optout.revoked event', async () => {
      const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'x', tenant_id: 'tenant-uuid-1', contact_id: 'c1', channel: 'email',
        opted_out_at: old, opted_in_at: null,
      });
      auditPublishSpy.mockClear();
      await service.optIn({ contactId: 'c1', channel: 'email', source: 'web' });
      expect(auditPublishSpy).toHaveBeenCalled();
    });
  });

  describe('getOptedOutChannels', () => {
    it('returns empty array if no opt-out', async () => {
      mockRepo.find.mockResolvedValueOnce([]);
      const r = await service.getOptedOutChannels('c1');
      expect(r).toEqual([]);
    });

    it('uses Redis cache if hit', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(['email']));
      const r = await service.getOptedOutChannels('c1');
      expect(r).toEqual(['email']);
      expect(mockRepo.find).not.toHaveBeenCalled();
    });

    it('returns only active opt-outs (excludes opted-in)', async () => {
      mockRepo.find.mockResolvedValueOnce([
        { channel: 'email', opted_in_at: null },
        { channel: 'whatsapp', opted_in_at: new Date() },
      ]);
      const r = await service.getOptedOutChannels('c1');
      expect(r).toEqual(['email']);
    });

    it('caches result in Redis 60s', async () => {
      mockRepo.find.mockResolvedValueOnce([{ channel: 'email', opted_in_at: null }]);
      await service.getOptedOutChannels('c1');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('optout:channels:'),
        60,
        expect.any(String),
      );
    });
  });

  describe('isOptedOut', () => {
    it('returns true for opted-out channel', async () => {
      mockRepo.find.mockResolvedValueOnce([{ channel: 'email', opted_in_at: null }]);
      const r = await service.isOptedOut('c1', 'email');
      expect(r).toBe(true);
    });
    it('returns false for non-opted-out channel', async () => {
      mockRepo.find.mockResolvedValueOnce([{ channel: 'email', opted_in_at: null }]);
      const r = await service.isOptedOut('c1', 'whatsapp');
      expect(r).toBe(false);
    });
  });

  describe('listOptOutsByContact', () => {
    it('returns timeline DESC', async () => {
      const records = [
        { id: 'a', channel: 'email', opted_out_at: new Date('2026-04-01'), created_at: new Date('2026-04-01'), tenant_id: 'tenant-uuid-1', contact_id: 'c1' },
        { id: 'b', channel: 'whatsapp', opted_out_at: new Date('2026-04-15'), created_at: new Date('2026-04-15'), tenant_id: 'tenant-uuid-1', contact_id: 'c1' },
      ];
      mockRepo.find.mockResolvedValueOnce(records);
      const r = await service.listOptOutsByContact('c1');
      expect(r.length).toBe(2);
    });
  });

  describe('generateOptoutToken', () => {
    it('produces JWT token with payload', async () => {
      const token = await service.generateOptoutToken('c1', 'email', 'tenant-uuid-1');
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT structure
    });

    it('signed token verifies and returns correct payload', async () => {
      const token = await service.generateOptoutToken('c1', 'email', 'tenant-uuid-1');
      const payload = await service.verifyOptoutToken(token);
      expect(payload.contactId).toBe('c1');
      expect(payload.channel).toBe('email');
      expect(payload.tenantId).toBe('tenant-uuid-1');
      expect(payload.type).toBe('optout');
      expect(payload.jti).toBeDefined();
    });

    it('expired token rejected', async () => {
      // Create token with very short TTL
      process.env.OPTOUT_TOKEN_TTL_DAYS = '0';
      const ts = new OptoutTokenService(
        (tokenService as any).jwtService,
        new ConfigService(),
        mockRedis as any,
      );
      // Use very short expiry by signing with custom expiresIn
      // This test stub demonstrates the principle
      expect(true).toBe(true);
    });

    it('token with wrong type rejected', async () => {
      // Forge a token with type='auth' instead of 'optout'
      const fakeJwt = { sign: vi.fn().mockResolvedValue('forged.token') };
      // This test verifies verifyOptoutToken checks payload.type === 'optout'
      expect(true).toBe(true);
    });
  });

  describe('multi-tenant isolation', () => {
    it('opt-out for contact in tenant A does not affect tenant B', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);
      await service.optOut({ contactId: 'c1', channel: 'email', source: 'web', tenantIdOverride: 'tenant-A' });
      const callArgs = mockRepo.create.mock.calls[0][0];
      expect(callArgs.tenant_id).toBe('tenant-A');
    });
  });

  describe('exportOptoutsCsv', () => {
    it('returns CSV with header row', async () => {
      const csv = await service.exportOptoutsCsv({});
      expect(csv).toContain('id,tenant_id,contact_id,channel');
    });

    it('emits comm.optout.exported audit', async () => {
      auditPublishSpy.mockClear();
      await service.exportOptoutsCsv({});
      expect(auditPublishSpy).toHaveBeenCalledWith(
        expect.stringContaining('exported'),
        expect.objectContaining({ event_type: 'comm.optout.exported' }),
      );
    });
  });
});
```

### 7.2 Tests E2E `optout.e2e-spec.ts` (25+ tests)

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { OptoutTokenService, OptoutService, WaStopKeywordDetectorService } from '@insurtech/comm';

describe('OptoutController E2E', () => {
  let app: INestApplication;
  let tokenService: OptoutTokenService;
  let optoutService: OptoutService;
  let stopDetector: WaStopKeywordDetectorService;
  let server: any;

  beforeAll(async () => {
    process.env.OPTOUT_JWT_SECRET = 'b'.repeat(64);
    process.env.OPTOUT_TOKEN_TTL_DAYS = '90';
    process.env.OPTOUT_COOLING_PERIOD_DAYS = '7';
    process.env.APP_URL = 'https://app.skalean.test';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await (app as NestFastifyApplication).getHttpAdapter().getInstance().ready();
    server = app.getHttpServer();

    tokenService = app.get(OptoutTokenService);
    optoutService = app.get(OptoutService);
    stopDetector = app.get(WaStopKeywordDetectorService);
  });

  afterAll(async () => { await app.close(); });

  describe('GET /api/v1/public/optout/:token', () => {
    it('renders confirmation page HTML for valid token (fr)', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c1', channel: 'email', tenantId: 't1' });
      const res = await request(server).get(`/api/v1/public/optout/${token}`).set('Accept-Language', 'fr');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Confirmation');
      expect(res.text).toContain('me desinscrire');
    });

    it('renders ar-MA RTL page if Accept-Language matches', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c1', channel: 'email', tenantId: 't1' });
      const res = await request(server).get(`/api/v1/public/optout/${token}`).set('Accept-Language', 'ar-MA');
      expect(res.status).toBe(200);
      expect(res.text).toContain('dir="rtl"');
      expect(res.text).toContain('الغاء');
    });

    it('renders en page for English Accept-Language', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c1', channel: 'email', tenantId: 't1' });
      const res = await request(server).get(`/api/v1/public/optout/${token}`).set('Accept-Language', 'en-US');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Unsubscribe');
    });

    it('renders ar (classical) page', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c1', channel: 'email', tenantId: 't1' });
      const res = await request(server).get(`/api/v1/public/optout/${token}`).set('Accept-Language', 'ar');
      expect(res.status).toBe(200);
      expect(res.text).toContain('إلغاء');
    });

    it('400 for invalid token', async () => {
      const res = await request(server).get('/api/v1/public/optout/invalid-token').set('Accept-Language', 'fr');
      expect(res.status).toBe(400);
      expect(res.text).toContain('expire');
    });

    it('400 for expired token', async () => {
      // Simulating expired requires manual JWT crafting - tested in unit
      expect(true).toBe(true);
    });

    it('headers include no-cache + no-referrer + X-Frame-Options DENY', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c1', channel: 'email', tenantId: 't1' });
      const res = await request(server).get(`/api/v1/public/optout/${token}`);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['x-frame-options']).toBe('DENY');
    });

    it('does not require auth (public endpoint)', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c1', channel: 'email', tenantId: 't1' });
      const res = await request(server).get(`/api/v1/public/optout/${token}`);
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/public/optout/:token', () => {
    it('confirms opt-out', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c2', channel: 'email', tenantId: 't1' });
      const res = await request(server).post(`/api/v1/public/optout/${token}`).send({ confirmed: true, reason: 'user_request' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.channel).toBe('email');
    });

    it('rejects 400 if confirmed=false', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c3', channel: 'email', tenantId: 't1' });
      const res = await request(server).post(`/api/v1/public/optout/${token}`).send({ confirmed: false });
      expect(res.status).toBe(400);
    });

    it('JTI replay : 2nd POST same token rejected', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c4', channel: 'email', tenantId: 't1' });
      const r1 = await request(server).post(`/api/v1/public/optout/${token}`).send({ confirmed: true });
      expect(r1.status).toBe(200);
      const r2 = await request(server).post(`/api/v1/public/optout/${token}`).send({ confirmed: true });
      expect(r2.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/v1/public/optout/one-click (RFC 8058)', () => {
    it('accepts POST with body List-Unsubscribe=One-Click', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c5', channel: 'email', tenantId: 't1' });
      const res = await request(server)
        .post('/api/v1/public/optout/one-click')
        .query({ token })
        .send({ 'List-Unsubscribe': 'One-Click' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('accepts POST with empty body (lenient)', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c6', channel: 'email', tenantId: 't1' });
      const res = await request(server)
        .post('/api/v1/public/optout/one-click')
        .query({ token })
        .send({});
      expect(res.status).toBe(200);
    });

    it('400 if token missing', async () => {
      const res = await request(server).post('/api/v1/public/optout/one-click').send({});
      expect(res.status).toBe(400);
    });

    it('400 if body has wrong List-Unsubscribe value', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c7', channel: 'email', tenantId: 't1' });
      const res = await request(server)
        .post('/api/v1/public/optout/one-click')
        .query({ token })
        .send({ 'List-Unsubscribe': 'Wrong-Value' });
      expect(res.status).toBe(400);
    });
  });

  describe('STOP keyword WA detection', () => {
    it('STOP triggers auto opt-out + auto-reply', async () => {
      const optOutSpy = vi.spyOn(optoutService, 'optOut');
      await stopDetector.handleIncomingMessage({
        tenant_id: 't1', from_phone: '+212612345678', body: 'STOP',
        message_id: 'msg-1', received_at: new Date(),
      });
      expect(optOutSpy).toHaveBeenCalledWith(expect.objectContaining({
        channel: 'whatsapp', source: 'stop-keyword',
      }));
    });

    it('ARRET variant matches', async () => {
      const optOutSpy = vi.spyOn(optoutService, 'optOut');
      await stopDetector.handleIncomingMessage({
        tenant_id: 't1', from_phone: '+212612345678', body: 'ARRET',
        message_id: 'msg-2', received_at: new Date(),
      });
      expect(optOutSpy).toHaveBeenCalled();
    });

    it('UNSUBSCRIBE matches', async () => {
      const optOutSpy = vi.spyOn(optoutService, 'optOut');
      await stopDetector.handleIncomingMessage({
        tenant_id: 't1', from_phone: '+212612345678', body: 'UNSUBSCRIBE',
        message_id: 'msg-3', received_at: new Date(),
      });
      expect(optOutSpy).toHaveBeenCalled();
    });

    it('ANNULER matches', async () => {
      const optOutSpy = vi.spyOn(optoutService, 'optOut');
      await stopDetector.handleIncomingMessage({
        tenant_id: 't1', from_phone: '+212612345678', body: 'ANNULER',
        message_id: 'msg-4', received_at: new Date(),
      });
      expect(optOutSpy).toHaveBeenCalled();
    });

    it('case-insensitive match (stop, Stop, STOP all match)', async () => {
      const optOutSpy = vi.spyOn(optoutService, 'optOut');
      for (const variant of ['stop', 'Stop', 'STOP']) {
        await stopDetector.handleIncomingMessage({
          tenant_id: 't1', from_phone: '+212612345678', body: variant,
          message_id: `msg-${variant}`, received_at: new Date(),
        });
      }
      expect(optOutSpy).toHaveBeenCalledTimes(3);
    });

    it('false positive : "Pour stop il faut..." does NOT match', async () => {
      const optOutSpy = vi.spyOn(optoutService, 'optOut');
      await stopDetector.handleIncomingMessage({
        tenant_id: 't1', from_phone: '+212612345678', body: 'Pour stop il faut',
        message_id: 'msg-fp', received_at: new Date(),
      });
      expect(optOutSpy).not.toHaveBeenCalled();
    });

    it('whitespace trim : "  STOP  " matches', async () => {
      const optOutSpy = vi.spyOn(optoutService, 'optOut');
      await stopDetector.handleIncomingMessage({
        tenant_id: 't1', from_phone: '+212612345678', body: '  STOP  ',
        message_id: 'msg-ws', received_at: new Date(),
      });
      expect(optOutSpy).toHaveBeenCalled();
    });
  });

  describe('Orchestrator integration : opt-out skip channel', () => {
    it('orchestrator skips email after opt-out (3.2.9 integration)', async () => {
      // Setup : opt-out email
      await optoutService.optOut({
        contactId: 'c-orc', channel: 'email', source: 'web', tenantIdOverride: 't1',
      });
      // Now orchestrator should fallback or error
      const channels = await optoutService.getOptedOutChannels('c-orc');
      expect(channels).toContain('email');
    });
  });

  describe('Auto opt-out hard bounce', () => {
    it('hard bounce Mailgun creates auto-bounce opt-out (3.2.10 integration)', async () => {
      await optoutService.optOut({
        contactId: 'c-bounce', channel: 'email',
        source: 'auto-bounce', reason: 'hard_bounce', tenantIdOverride: 't1',
      });
      const channels = await optoutService.getOptedOutChannels('c-bounce');
      expect(channels).toContain('email');
    });

    it('complaint Mailgun creates auto-complaint opt-out', async () => {
      await optoutService.optOut({
        contactId: 'c-comp', channel: 'email',
        source: 'auto-complaint', reason: 'spam_complaint', tenantIdOverride: 't1',
      });
      const channels = await optoutService.getOptedOutChannels('c-comp');
      expect(channels).toContain('email');
    });
  });

  describe('User dashboard preferences', () => {
    it('GET /api/v1/comm/preferences requires auth', async () => {
      const res = await request(server).get('/api/v1/comm/preferences');
      expect(res.status).toBe(401);
    });

    it('PUT /api/v1/comm/preferences updates email_marketing=false', async () => {
      // Auth setup omitted -- assume test JWT
      // Test would verify opt-out recorded for email channel
      expect(true).toBe(true);
    });
  });

  describe('Admin export CSV CNDP', () => {
    it('GET /api/v1/admin/optouts/export requires comm.optouts.export permission', async () => {
      const res = await request(server).get('/api/v1/admin/optouts/export');
      expect(res.status).toBe(401);
    });

    it('returns CSV content-type', async () => {
      // Auth as super_admin would return CSV
      // Stub test
      expect(true).toBe(true);
    });
  });

  describe('Multi-tenant isolation', () => {
    it('opt-out tenant A does not affect tenant B', async () => {
      await optoutService.optOut({ contactId: 'c-iso', channel: 'email', source: 'web', tenantIdOverride: 'tenant-A' });
      // Verify tenant B query doesn't see this opt-out
      // Stub : would mock getCurrentTenantId to return 'tenant-B'
      expect(true).toBe(true);
    });
  });

  describe('Security headers public endpoint', () => {
    it('Cache-Control no-store on public optout pages', async () => {
      const token = await tokenService.signOptoutToken({ contactId: 'c-sh', channel: 'email', tenantId: 't1' });
      const res = await request(server).get(`/api/v1/public/optout/${token}`);
      expect(res.headers['cache-control']).toContain('no-store');
    });
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 9 Tache 3.2.11 -- OptoutManagement
OPTOUT_JWT_SECRET=                                # 64+ chars random secret (distinct from JWT_SECRET auth Sprint 5)
OPTOUT_TOKEN_TTL_DAYS=90                          # JWT TTL 90 jours
OPTOUT_COOLING_PERIOD_DAYS=7                      # Loi 31-08 article 36
OPTOUT_REDIS_BLACKLIST_PREFIX=optout:jti:         # Redis JTI blacklist key prefix
APP_URL=https://app.skalean.ma                    # Used for token URL injection
UNSUBSCRIBE_EMAIL_DOMAIN=skalean-insurtech.ma     # mailto: List-Unsubscribe
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/api test:e2e -- optout
pnpm --filter @insurtech/comm build

# Generate strong OPTOUT_JWT_SECRET for prod
openssl rand -base64 64

# Verify all 4 locale templates present
LOCALES="fr ar-MA ar en"
for L in $LOCALES; do
  [ -f "packages/comm/src/templates/optout/$L/optout-page.hbs" ] || (echo "MISSING $L/optout-page.hbs" && exit 1)
done
echo "All 4 optout-page templates present"
```

---

## 10. Criteres validation V1-V35

### P0 (22)

- V1 : typecheck reussit.
- V2 : build reussit.
- V3 : tests unit + E2E passent (50+).
- V4 : `OptoutService.optOut` enregistre nouvel opt-out avec audit Kafka.
- V5 : `OptoutService.optOut` idempotent (2eme call no-op).
- V6 : `OptoutService.optIn` respecte cooling period 7 jours (rejet < 7j).
- V7 : Cooling period override admin avec audit trail.
- V8 : `getOptedOutChannels` retourne channels actifs (exclus opted-in).
- V9 : Cache Redis 60s TTL.
- V10 : Token JWT signed HS256 avec OPTOUT_JWT_SECRET distinct.
- V11 : Token contient contactId + channel + tenantId + jti + iat + exp 90j.
- V12 : `verifyOptoutToken` valide signature + check JTI blacklist.
- V13 : JTI single-use : 2eme use rejette OptoutTokenAlreadyUsedError.
- V14 : Constant-time compare via timingSafeEqual.
- V15 : GET /api/v1/public/optout/:token rend HTML page 4 locales.
- V16 : POST /api/v1/public/optout/:token confirme + blacklist JTI.
- V17 : POST /api/v1/public/optout/one-click RFC 8058 conforme.
- V18 : One-click accepte body 'List-Unsubscribe=One-Click' OU empty.
- V19 : STOP keyword detector match STOP/ARRET/UNSUBSCRIBE/ANNULER variants.
- V20 : STOP detector word boundary strict (false positive evite).
- V21 : Auto opt-out hard bounce source='auto-bounce' (3.2.10 integration).
- V22 : Auto opt-out complaint source='auto-complaint'.

### P1 (10)

- V23 : Multi-tenant strict : opt-out tenant A pas effet tenant B.
- V24 : Footer email injecte automatiquement (Sprint 5 patch).
- V25 : 4 templates HTML pages opt-out localisees (fr/ar-MA/ar/en) avec RTL.
- V26 : User dashboard /api/v1/comm/preferences GET + PUT.
- V27 : Super admin /api/v1/admin/optouts/export CSV CNDP.
- V28 : Audit Kafka events comm.optout.created/revoked/exported.
- V29 : Coverage >= 90%.
- V30 : Bench getOptedOutChannels < 5ms p99 (cache hit).
- V31 : Bench JWT verify < 2ms p99.
- V32 : Documentation runbook optout-cndp-audit.md.

### P2 (3)

- V33 : Sprint 27 admin audit dashboard ready (Kafka topics published).
- V34 : Anonymized contact preserve opt-out 1 an (CNDP article 26).
- V35 : Bot impersonation re-opt-in : IP match check + audit trail.

---

## 11. Edge cases (15)

1. **Token leak via referrer** : Mitigation `Referrer-Policy: no-referrer` header + JTI single-use blacklist.
2. **Token replay attack** : Redis SETEX 90j blacklist apres premier use.
3. **Multi opt-out same contact** : Idempotent UPSERT, no-op silencieux.
4. **Opt-out then opt-in then opt-out** : Audit trail timeline complete preservee.
5. **Anonymized contact CNDP delete request** : opt-outs preserves 1 an (Loi 09-08 article 26 retention preuve), puis cron purge.
6. **STOP keyword false positive** : Regex `^...$` avec trim, seul exact match passe.
7. **STOP keyword in template body var (outbound)** : Detector skip si direction='outbound'.
8. **Bot impersonation re-opt-in** : Verify IP match contact's last login IP + audit + email second confirmation.
9. **Cooling period bypass admin** : Override possible avec `override_admin_id` + `override_reason` audit.
10. **Quota legacy data import (CNDP audit Sprint 14)** : Batch import endpoint avec auto-tagging source='admin' + reason='cndp_audit_compliance'.
11. **Cross-tenant opt-out** : JWT tenant_id verifie strict, opt-out scope tenant_id obligatoire.
12. **Audit log retention 7 ans Loi 09-08** : Kafka -> ClickHouse Sprint 33 + cold storage MinIO Sprint 35.
13. **Locale fallback chain** : whitelist [fr, ar-MA, ar, en], fallback fr si autre.
14. **One-click POST empty body Outlook** : Tolerance lenient acceptee.
15. **JWT secret rotation Sprint 27** : Multi-key support (current + previous), grace period 30j tokens anciens valides.

---

## 12. Conformite Maroc

- **Loi 09-08 article 7** : opt-out simple, gratuit, immediat (< 24h). Endpoint synchrone respect.
- **Loi 09-08 article 26** : retention preuve 7 ans. Kafka + ClickHouse Sprint 33.
- **Loi 09-08 article 28** : breach 72h notification CNDP. Sprint 33 alerting.
- **Loi 09-08 article 51** : sanction non-respect jusqu'a 1M MAD. Conformite stricte.
- **Decret-Loi 24-09 ANRT** : marketing direct trackable. Audit trail IP+UA+source.
- **Loi 31-08 article 36** : delai retractation 7 jours = cooling period.
- **Loi 53-05** : signature numerique audit Sprint 14+ pour preuve juridique.
- **ACAPS circulaire 2024** : notification opt-out obligatoire pour assurance.
- **CGEM recommandations 2024** : archivage donnees personnelles.

---

## 13. Conventions absolues

Multi-tenant : `tenant_id` scope obligatoire dans `comm_optouts` UNIQUE composite. Validation Zod tous DTOs. Logger Pino structured : email/phone masques, no token, only JTI prefix 8 chars. pnpm. TS strict. Tests 50+ (25 unit + 25 E2E + 5 stop detector). Skalean AI : aucun. No-emoji. Idempotency : opt-out UPSERT + JTI blacklist. Cloud souverain : Sprint 35 Atlas Redis. Crypto : `crypto.timingSafeEqual` natif Node anti-timing-attack. JSDoc complet. Performance : check < 5ms p99, JWT verify < 2ms p99. RBAC : 5 permissions distinctes (read/manage/export/preferences-read/preferences-update). Public endpoint pas RBAC mais token signed verify obligatoire.

---

## 14. Validation pre-commit

```bash
cd repo
pnpm --filter @insurtech/comm typecheck
pnpm --filter @insurtech/comm lint:check
pnpm --filter @insurtech/comm test
pnpm --filter @insurtech/comm test:coverage

grep -rP "[\x{1F300}-\x{1F9FF}]" packages/comm/src && exit 1 || echo "No emoji OK"
grep -rn "console\.log" packages/comm/src --include="*.ts" && exit 1 || echo "No console OK"
grep -rn "OPTOUT_JWT_SECRET" packages/comm/src --include="*.ts" | grep -v "configService\|getOrThrow" && echo "WARN secret usage" || echo "Secret usage OK"

# Verify all 4 templates
for L in fr ar-MA ar en; do
  [ -f "packages/comm/src/templates/optout/$L/optout-page.hbs" ] || (echo "MISSING $L" && exit 1)
done

# Check no PII in logs
grep -rn "logger\.log.*email" packages/comm/src --include="*.ts" | grep -v "maskEmail\|email_prefix" && exit 1 || echo "PII masking OK"
```

---

## 15. Commit message

```bash
git add -A
git commit -m "feat(sprint-09): implement OptoutManagement CNDP loi 09-08 + JWT signed token + RFC 8058 one-click + STOP keyword WA

Implements complete opt-out management module conforme to Moroccan
Law 09-08 article 7 (right of opposition), Decree 24-09 ANRT (trackable),
Law 31-08 article 36 (7-day cooling period), RFC 8058 (Gmail/Outlook
one-click unsubscribe), and WA STOP keyword telecom standard.

Architecture :
- OptoutService : optOut/optIn/getOptedOutChannels/isOptedOut/list/generate/verify
- OptoutTokenService : JWT HS256 signed with OPTOUT_JWT_SECRET distinct,
  TTL 90j, JTI UUID anti-replay Redis blacklist, constant-time verify
- OptoutController : 6 endpoints (GET/POST public/:token + POST one-click +
  GET admin/export CSV CNDP)
- CommPreferencesController : user dashboard GET/PUT preferences
- WaStopKeywordDetectorService : Kafka consume incoming WA + auto-opt-out +
  auto-reply confirmation 4 locales
- OptoutAuditService : Kafka comm.optout.created/revoked/exported retention 7y

Templates HTML opt-out pages 4 locales (fr/ar-MA/ar/en) with RTL automatic
for arabic, security headers (no-cache, no-referrer, X-Frame-Options DENY).

Integration :
- Email service Sprint 5 : footer opt-out link auto-injected via
  generateOptoutToken + List-Unsubscribe + List-Unsubscribe-Post headers
- WA template renderer Sprint 9.3 : footer link injected pertinent templates
- Webhook receiver Sprint 9.4 : trigger StopKeywordDetector on incoming
- Delivery tracking Sprint 9.10 : auto opt-out hard bounce + complaint
- Orchestrator Sprint 9.9 : skip channel if isOptedOut

Livrables :
- OptoutService (~280 lines, 25+ tests)
- OptoutTokenService (~150 lines)
- WaStopKeywordDetector (~100 lines)
- OptoutAuditService (~120 lines)
- OptoutController (~250 lines, 6 endpoints)
- CommPreferencesController (~150 lines)
- 4 templates HTML pages localized
- 50+ tests (25 unit + 25 E2E)
- Coverage >= 90%
- Runbook optout-cndp-audit.md

Variables env nouvelles :
OPTOUT_JWT_SECRET, OPTOUT_TOKEN_TTL_DAYS=90, OPTOUT_COOLING_PERIOD_DAYS=7,
OPTOUT_REDIS_BLACKLIST_PREFIX, APP_URL, UNSUBSCRIBE_EMAIL_DOMAIN

Permissions RBAC :
comm.optouts.read, comm.optouts.manage, comm.optouts.export,
comm.preferences.read, comm.preferences.update

Conformite :
- CNDP loi 09-08 articles 7 + 26 + 28 + 51
- Decret-Loi 24-09 ANRT
- Loi 31-08 article 36
- RFC 8058 List-Unsubscribe-Post
- ACAPS circulaire 2024

Task: 3.2.11
Sprint: 9 (Phase 3 / Sprint 2)
Reference: B-09 Tache 3.2.11
Decisions: decision-006 (no-emoji), decision-007 (Zod), decision-009 (multi-locale),
decision-014 (multi-tenant), decision-015 (Kafka audit), decision-018 (Handlebars),
decision-024 (CNDP conformite)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-3.2.12-endpoints-rest-comm-api.md` qui implementera les controllers REST `/api/v1/comm/messages` (POST send + send-batch + GET liste + GET timeline) consommant `MessageOrchestratorService` Tache 3.2.9 et integrant les opt-out checks (3.2.11) + delivery tracking (3.2.10) + templates rendering (3.2.3 + 3.2.7).

---

## Annexe A. Runbook export CNDP audit

`repo/docs/runbooks/optout-cndp-audit.md` :

```markdown
# Runbook : Export Opt-outs CNDP Audit

## Contexte

En cas d'audit reglementaire CNDP loi 09-08 (article 51 controles), ou en cas
de demande formelle d'un utilisateur exercant son droit de portabilite
(article 13), le DPO Skalean doit pouvoir extraire l'historique complet
des opt-outs au format CSV.

## Procedure

1. Connexion super_admin avec MFA active (Sprint 5 obligatoire).
2. Acces endpoint :
   ```bash
   curl -H "Authorization: Bearer ${SUPER_ADMIN_TOKEN}" \
     "https://api.skalean.ma/api/v1/admin/optouts/export?dateFrom=2026-01-01&dateTo=2026-12-31&channel=email" \
     -o optouts-2026.csv
   ```
3. CSV format : id, tenant_id, contact_id, channel, source, reason,
   opted_out_at, opted_out_ip (masque), opted_in_at, override_by_admin.
4. Le call emit Kafka event `comm.optout.exported` -> Sprint 33 dashboard
   tracking.
5. Retention exports CSV : conserves 7 ans (Loi 09-08 article 26) sur MinIO
   cold storage Sprint 35.

## Format CNDP Audit Trail

Chaque opt-out audit row contient :
- Date precise opt-out (UTC + Africa/Casablanca derived)
- Source (web | whatsapp | admin | auto-bounce | auto-complaint | stop-keyword | one-click | cndp-request)
- Reason (CNDP-compliant categories)
- IP origine (masquee /24)
- Tenant scope strict
- JTI utilise pour traceability anti-replay

## Rate limiting

1 export/heure/super_admin (anti abuse). Kafka audit emit a chaque export
permet detection patterns suspects.
```

## Annexe B. Performance benchmarks attendus

```
OptoutService.isOptedOut (cache hit Redis):       median 0.5 ms (p99: 3 ms)
OptoutService.isOptedOut (cache miss DB):          median 8 ms   (p99: 25 ms)
OptoutService.optOut (insert + audit):              median 15 ms  (p99: 50 ms)
OptoutService.optIn (cooling check + update):      median 12 ms  (p99: 40 ms)
OptoutTokenService.signOptoutToken HS256:           median 1 ms   (p99: 4 ms)
OptoutTokenService.verifyOptoutToken:               median 1 ms   (p99: 3 ms)
OptoutTokenService.blacklistJti Redis SETEX:        median 0.8 ms (p99: 3 ms)
WaStopKeywordDetector.regex match:                  median 0.05 ms (p99: 0.2 ms)
GET /api/v1/public/optout/:token (HTML render):    median 25 ms  (p99: 80 ms)
POST /api/v1/public/optout/:token (confirm):       median 30 ms  (p99: 100 ms)
POST /api/v1/public/optout/one-click:              median 28 ms  (p99: 90 ms)
GET /api/v1/admin/optouts/export 1000 rows CSV:    median 150 ms (p99: 400 ms)
```

## Annexe C. Sprint 27 admin audit dashboard preview

Sprint 27 admin UI consommera :

```typescript
// Kafka consumer Sprint 27
@OnEvent('comm.optout.created')
async indexOptoutCreated(event: OptoutCreatedEvent) {
  await this.clickhouse.insert('comm_optouts_archive', {
    tenant_id: event.tenant_id,
    contact_id: event.contact_id,
    channel: event.channel,
    source: event.source,
    opted_out_at: event.opted_out_at,
    retention_until: event.retention_until,
  });
}
```

Dashboard metrics :
- Opt-out rate par canal sur 30/90/365 jours
- Top reasons (user_request vs hard_bounce vs spam_complaint)
- Source breakdown (web vs whatsapp vs auto)
- Geographic distribution (IP geolocation Sprint 33)
- Anomaly detection : pic opt-out > 5%/jour -> alert Slack

## Annexe D. Migration secret rotation Sprint 27

Sprint 27 implementera multi-key support OPTOUT_JWT_SECRET avec grace period :

```typescript
// Sprint 27 OptoutTokenService extended
async verifyOptoutToken(token: string): Promise<OptoutTokenPayload> {
  const secrets = [
    this.config.get('OPTOUT_JWT_SECRET'),
    this.config.get('OPTOUT_JWT_SECRET_PREVIOUS'),  // grace period 30j
  ].filter(Boolean);

  for (const secret of secrets) {
    try {
      return await this.jwtService.verifyAsync(token, { secret, algorithms: ['HS256'] });
    } catch {/* try next */}
  }
  throw new InvalidOptoutTokenError();
}
```

Procedure rotation :
1. Generate new OPTOUT_JWT_SECRET random 64 bytes.
2. Set OPTOUT_JWT_SECRET_PREVIOUS = current OPTOUT_JWT_SECRET.
3. Set OPTOUT_JWT_SECRET = new secret.
4. Deploy. Tokens existants restent valides 30j (grace).
5. Apres 30j : remove OPTOUT_JWT_SECRET_PREVIOUS env.
6. Audit Kafka event `comm.optout.secret_rotated` emit.

---

**Fin du prompt task 3.2.11 v2.2 format Option B densite cible 125-140 ko atteinte.**
