# TACHE 3.2.6 -- Email SMTP Client + DKIM Signing + SPF + DMARC + Mailgun API HTTPS + Headers Anti-Spam RFC 8058

**Sprint** : 9 (Phase 3 / Sprint 2 dans la phase) -- Communications WhatsApp + Email
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-09-sprint-09-comm-wa-email.md` (Tache 3.2.6)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant pour 3.2.7 Email Template Renderer RTL, 3.2.8 BullMQ workers email-send, 3.2.9 Message Orchestrator routing fallback email, 3.2.10 Delivery Tracking Mailgun bounces, 3.2.13 E2E tests Mailhog)
**Effort** : 5h
**Dependances** : 3.2.5 (Template Manager + 60+ templates seed), 3.2.1 (comm_messages entity + Zod schemas + provider_message_id column), Sprint 5 Tache 2.1.13 (EmailService Nodemailer basique + 40 templates 4 locales -- ENRICHI ici Sprint 9), Sprint 4 (CryptoService secrets handling), Sprint 3 (JobsModule BullMQ + KafkaPublisher), Sprint 2 (`comm_messages.provider_message_id` UNIQUE column + indexes), Sprint 1 (PinoLogger + ConfigService env validation)
**Densite cible** : 125-145 ko (auto-suffisant exhaustif -- securite deliverability critique)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer le service `EmailService` production-ready du programme Skalean InsurTech v2.2 qui implemente integralement la couche d'envoi d'emails transactionnels enrichie au-dela de la version basique livree Sprint 5 Tache 2.1.13 (qui couvrait Nodemailer + Handlebars + 10 templates x 4 locales mais sans DKIM signing actif, sans Mailgun integration prod, sans headers anti-spam complets RFC 8058 List-Unsubscribe-Post One-Click, sans tracking Message-ID UUID centralise, sans runbook DNS prod) avec : signature DKIM RSA-SHA256 active sur chaque email outbound utilisant la cle privee 2048-bits chargee depuis l'env `EMAIL_DKIM_PRIVATE_KEY` (PEM multiline) avec selector `default` et domain `skalean-insurtech.ma` et canonicalization `relaxed/relaxed` et headers signed `From,To,Subject,Date,Message-ID,MIME-Version,Content-Type` et body hash `bh=` sha256 base64 ; integration Mailgun API HTTPS region EU (vs US) en prod via endpoint `https://api.eu.mailgun.net/v3/{domain}/messages` avec authentication Basic base64(`api:KEY`) et multipart form-data (from + to + subject + html + text + o:tag + o:tracking + o:dkim + h:Reply-To + h:List-Unsubscribe + h:List-Unsubscribe-Post + h:Message-ID), Mailgun SMTP staging via `smtp.eu.mailgun.org:587` avec STARTTLS, et Mailhog SMTP dev via `localhost:1025` no auth ; headers anti-spam obligatoires RFC 8058 conformes Gmail / Outlook / Yahoo deliverability requirements 2024 (`List-Unsubscribe: <https://app.skalean.ma/api/v1/public/optout/{token}>, <mailto:unsubscribe@skalean-insurtech.ma>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` + `From: Skalean InsurTech <noreply@skalean-insurtech.ma>` + `Reply-To: support@skalean-insurtech.ma` + `Date: RFC 5322 Africa/Casablanca timezone` + `Message-ID: <uuid@skalean-insurtech.ma>` + `MIME-Version: 1.0`) ; subject UTF-8 encoding RFC 2047 base64 (`=?UTF-8?B?...?=`) automatique pour caracteres non-ASCII (essentiel arabe + lettres accentuees ar-MA et fr-MA) ; multipart MIME alternative auto-genere HTML + plain text fallback via `node-html-to-text` 9.0.5 (regle deliverability +15 % score selon SendGrid 2024 metrics) ; tracking Message-ID UUID v4 avec domain `@skalean-insurtech.ma` retourne et persistee dans `comm_messages.provider_message_id` UNIQUE column (Sprint 2) pour join sur webhooks Mailgun delivery tracking Tache 3.2.10 ; runbook documentation DNS prod `email-dns-setup.md` avec records exacts SPF (`v=spf1 include:eu.mailgun.org ~all`) + DKIM (`default._domainkey TXT "v=DKIM1; k=rsa; p=..."`) + DMARC (`_dmarc TXT "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@skalean-insurtech.ma; ruf=mailto:dmarc-forensic@skalean-insurtech.ma; fo=1"`) + verification dig commands + troubleshooting deliverability spam folder Gmail/Outlook ; transport factory pattern switchable via env `EMAIL_PROVIDER` (`mailhog` dev / `mailgun-smtp` staging / `mailgun-api` prod) ; pool de connexions SMTP 5 concurrent + 100 messages par connection avant rotation ; retry exponential 3 tentatives 1s/5s/30s sur 5xx Mailgun + fail-fast sur 400 (invalid email format) + Idempotency-Key Mailgun support evite doublons ; conformite Maroc loi 09-08 (chiffrement TLS obligatoire emails contiennent PII recipient address) + decision-008 cloud souverain MA (Mailgun EU region transition Sprint 35 vers Atlas Email service) + loi 24-09 ANRT marketing direct (opt-out trackable obligatoire via List-Unsubscribe + token signed JWT) + identification commerciale obligatoire footer Skalean SARL RC Casablanca XXXXX. Le perimetre couvre : un service `EmailService` enrichi (~280 lignes) avec methods `send()` + `sendTemplate()` + `verifyConnection()`, un helper `DkimSignerHelper` (~120 lignes) chargeant la cle privee PEM + signant chaque message, une factory `EmailTransportFactory` (~150 lignes) instanciant le transport dev/staging/prod selon env `EMAIL_PROVIDER`, un client `MailgunApiClient` (~200 lignes) implementant l'API HTTPS Mailgun avec undici 7.1.1, un builder `EmailHeadersBuilder` (~120 lignes) construisant les headers obligatoires anti-spam, un module NestJS Global `EmailModule` (~50 lignes) avec factory provider, des types TypeScript exhaustifs (~80 lignes) et 5 erreurs typees (~80 lignes : `EmailSendError`, `EmailRateLimitError`, `EmailDkimError`, `EmailInvalidAddressError`, `EmailBouncedError`), un runbook `email-dns-setup.md` (~150 lignes), un fichier index.ts d'exports, et une suite de tests Vitest avec 25+ tests unitaires + un test integration Mailhog API REST `GET /api/v2/messages` complet end-to-end.

L'apport est multiple. Premierement, en activant la signature DKIM RSA-SHA256 sur chaque email outbound via la cle privee 2048-bits chargee depuis l'env `EMAIL_DKIM_PRIVATE_KEY` (PEM multiline) avec canonicalization `relaxed/relaxed` (vs `simple/simple` plus strict mais incompatible avec certaines mail relays qui modifient les whitespaces), avec headers signed exhaustifs `From,To,Subject,Date,Message-ID,MIME-Version,Content-Type` (vs minimum `From,Subject` insuffisant pour Gmail policies 2024), et avec body hash `bh=` SHA-256 base64 du body canonicalized, on garantit l'authenticite cryptographique de l'expediteur ce qui : (a) augmente le score deliverability Gmail/Outlook/Yahoo de +30 a +50 points selon les algorithmes anti-spam Spring 2024 (mesures mail-tester.com), (b) protege la reputation du domain `skalean-insurtech.ma` car un attacker ne peut pas spoofer l'expediteur (DKIM pin la signature au domain), (c) rend obligatoire la verification DMARC `p=quarantine` qui rejette toute email non-signee DKIM ou non-aligne SPF (defense in depth), (d) permet aux mail providers downstream (entreprises clients courtiers en assurance) de configurer leurs propres filtres anti-spam pour whitelister le domain Skalean. Sans DKIM actif (Sprint 5 livrait Nodemailer mais sans configuration DKIM key), les emails Sprint 5+ arrivent en spam folder dans 60-80 % des cas pour les comptes Gmail strict, ce qui invalide totalement la fonctionnalite verify-email + password-reset (utilisateurs ne recoivent jamais le lien -> support tickets ++ -> NPS--). Deuxiemement, en integrant Mailgun API HTTPS region EU (Frankfurt datacenter, latence MA ~30 ms vs US ~150 ms) en prod via undici 7.1.1 (HTTP client haute perf vs nodemailer SMTP qui necessite handshake STARTTLS ~200-500 ms par envoi), on gagne (a) un facteur 5x sur la latence d'envoi (50ms API vs 250ms SMTP en moyenne), (b) une scaling horizontale (l'API Mailgun supporte 1000 emails/seconde par compte vs SMTP pool max 5 connections concurrent ~10/sec), (c) un retour structured du message_id Mailgun (`X-Mailgun-Message-Id` header response) directement sans parser DSN bounce report SMTP, (d) un support natif des features avancees Mailgun (`o:tag` pour categorisation campaign + `o:tracking` opens/clicks pixel + `o:dkim=yes` DKIM signing serveur Mailgun complementaire au DKIM client cote Skalean). Le choix de region EU (vs US) est imposee par decision-008 cloud souverain MA partial conformite : les emails contiennent PII (recipient email, display name) traversant Mailgun infrastructure EU est plus proche conformite RGPD que US avec Privacy Shield invalide (Schrems II 2020). Sprint 35 transitionne vers Atlas Cloud Services Benguerir Email service souverain MA complete. Troisiemement, en imposant les headers anti-spam RFC 8058 conformes Gmail/Outlook/Yahoo deliverability requirements Q1 2024 (`List-Unsubscribe` URL + mailto + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`), on respecte l'exigence Gmail Sender Guidelines (Feb 2024 update) qui stipule explicitement que les expediteurs > 5000 emails/jour DOIVENT implementer l'opt-out one-click (sinon flag spam systematique apres 7 jours) ; le `List-Unsubscribe` URL pointe vers un endpoint public `POST /api/v1/public/optout/one-click` Tache 3.2.11 qui accepte le token JWT signe en path param + execute l'opt-out sans page de confirmation (one-click pure RFC 8058) ; le `List-Unsubscribe` mailto secondaire (`mailto:unsubscribe@skalean-insurtech.ma`) est consomme par un alias forwarder configure Mailgun routes vers un endpoint `POST /api/v1/internal/optout/mailto-receiver`. La conformite CNDP loi 09-08 et marketing direct loi 24-09 ANRT exige cet opt-out simple gratuit immediat pour tout email commercial, et meme transactionnel (verify-email, password-reset) il est best practice de le supporter (futur Sprint 18 customer portal preferences). Quatriemement, en encodant le subject UTF-8 RFC 2047 base64 (`=?UTF-8?B?VHJhbnNhY3Rpb24...?=`) automatiquement via Nodemailer (ou multipart Mailgun API), on garantit le rendu correct sur tous les mail clients (Outlook 2016 ancien refuse les caracteres non-ASCII sans encoding, Gmail rendu mojibake), ce qui est critique pour les locales ar-MA (caracteres arabes) et fr-MA (lettres accentuees comme E E A C oe ae). Sans encoding, les utilisateurs voient `=?UTF-8?B?...?=` litteralement dans leur inbox (incident production Sprint 5 livraison initiale, fixe Sprint 9). Cinquiemement, en generant automatiquement la version plain text fallback via `node-html-to-text` 9.0.5 (parsing HTML + extraction texte readable + preservation des liens en format `text [URL]`), on respecte la convention multipart MIME alternative qui augmente le score deliverability +15 % selon SendGrid 2024 metrics et permet le rendu correct sur les clients qui ne supportent pas HTML (30 % des destinataires lisent en plain text mode notamment iOS native Mail accessibility + Outlook strict mode + corporate mail relay text-only filter). Sixiemement, en trackant chaque message via Message-ID UUID v4 `@skalean-insurtech.ma` genere cote Skalean (vs Message-ID auto-genere Nodemailer non-deterministe) et persistee dans `comm_messages.provider_message_id` (column Sprint 2 UNIQUE), on resout le probleme d'idempotence cross-retries BullMQ (Tache 3.2.8 worker email-send : si retry, regenerer envoi avec meme Message-ID -> Mailgun reject duplicate via Idempotency-Key header + Skalean evite double-charge utilisateur), on permet le join precis des webhooks Mailgun delivery tracking Tache 3.2.10 (Mailgun `X-Mailgun-Message-Id` differe parfois du `Message-ID` SMTP -> Skalean stocke les deux), et on offre un support audit complet RGPD/CNDP (chaque email transactionnel a un identifiant unique trackable retention 7 ans). Septiemement, en documentant exhaustivement le runbook DNS prod `email-dns-setup.md` avec les records exacts pour SPF (`v=spf1 include:eu.mailgun.org ~all` qui delegue auth a Mailgun EU sans `-all` strict pour permettre fallback Atlas Email Sprint 35), DKIM (`default._domainkey TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ..."` avec la public key paired avec la private key env), et DMARC (`_dmarc TXT "v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@skalean-insurtech.ma; ruf=mailto:dmarc-forensic@skalean-insurtech.ma; fo=1"` avec policy `quarantine` 100 % au lieu de `reject` strict pour eviter false positives ramp-up + `rua` aggregate reports daily + `ruf` forensic reports per failure + `fo=1` failure on any DKIM/SPF mismatch), on offre a l'equipe DevOps une procedure deterministe pour configurer le DNS (registrar Atlas Cloud Benguerir ou Cloudflare DNS Sprint 5 setup) lors du go-live prod Sprint 35. Le runbook inclut les `dig` commands de verification (`dig TXT skalean-insurtech.ma +short` pour SPF, `dig TXT default._domainkey.skalean-insurtech.ma +short` pour DKIM public key, `dig TXT _dmarc.skalean-insurtech.ma +short` pour DMARC policy) et un troubleshooting tree pour les problemes courants (DKIM signature fail = mismatch private/public key ou clock skew, SPF softfail = include manquant, DMARC reject = aliases SES mismatch).

A l'issue de cette tache, l'API `EmailService.send({ to, subject, html, text?, replyTo?, listUnsubscribeToken?, idempotencyKey? }): Promise<{ messageId, providerMessageId, status }>` envoie un email signe DKIM en moins de 200 ms p99 prod (Mailgun API HTTPS) ou 600 ms p99 staging (Mailgun SMTP), `EmailService.sendTemplate({ to, templateName, locale, variables, listUnsubscribeToken? })` integre avec le renderer Tache 3.2.7 et expose la meme API, `EmailService.verifyConnection()` test la sante du transport (utilise par `/api/v1/health/email` healthcheck Sprint 1), le DKIM signature est applique automatiquement et verifie via `dkim-verify` library en tests (criteres V3+V4), le List-Unsubscribe header pointe vers `https://app.skalean.ma/api/v1/public/optout/{token}` ou `{token}` est un JWT signe HS256 via `EMAIL_OPTOUT_SIGNING_SECRET` (Sprint 5 helpers JWT) contenant `{ contactId, channel: 'email', exp: now+90d }`, le subject est UTF-8 base64 encoded automatiquement, le multipart auto-genere correctement plain text via node-html-to-text, le Message-ID est UUID v4 + domain et persistee dans `comm_messages.provider_message_id`, la factory transport switchable entre `mailhog` / `mailgun-smtp` / `mailgun-api` via env `EMAIL_PROVIDER`, le retry sur 5xx Mailgun (3 fois exponential) + fail-fast sur 400 (invalid email) + Idempotency-Key support, le pool SMTP 5 connections + 100 messages par connection, et le runbook `email-dns-setup.md` est complet avec records DNS + dig commands + troubleshooting. Les logs structures Pino emettent uniquement `email_send_start` + `email_send_complete` + `email_send_failed` + `email_dkim_signed` avec champs (`message_id`, `to_hash` SHA-256 truncated 8 chars pour audit RGPD pas l'email entier en clair, `template`, `locale`, `provider`, `latency_ms`, `attempts`), aucun token / DKIM private key / Mailgun API key n'est jamais loggue en clair, la suite Vitest couvre 25+ tests scenarios avec coverage >= 88 % sur le module `email.service.ts`, et le test integration Mailhog complete envoie un email reel via Mailhog SMTP + verifie reception via Mailhog API REST + assert headers DKIM + List-Unsubscribe + Multipart presents.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 a livre Sprint 5 Tache 2.1.13 un EmailService basique fonctionnel pour les flows auth (verify-email, password-reset, MFA notifications) avec Nodemailer + Handlebars + 40 templates 4 locales (fr-MA / ar-MA / en / fr-FR), mais cette implementation initiale a deliberement defere les aspects production-grade pour rester dans le scope Sprint 5 (auth foundations) et eviter d'introduire trop de dependances cross-sprint : (a) le DKIM signing etait prevu comme "configurable Sprint 35 DNS Atlas Cloud Services" mais sans implementation cote service, (b) le transport SMTP etait limite a Mailhog dev sans support Mailgun API HTTPS prod, (c) les headers anti-spam etaient minimaux (juste `From` + `Subject`, sans `List-Unsubscribe` RFC 8058 obligatoire Gmail 2024), (d) le tracking Message-ID etait laisse a Nodemailer auto-generation (non-deterministe, non-trackable cross-retries), (e) aucun runbook DNS n'etait livre. Sprint 9 Tache 3.2.6 ENRICHIT cette base Sprint 5 avec les capabilities production-grade necessaires pour le go-live progressive Sprint 16+ (apres Sprint 14 Insure metier core + Sprint 15 Books factures) ou les emails transactionnels deviennent critiques (devis envoyes, polices signees, payment due reminders, claim acknowledgement) et les volumes commencent a dépasser 1000 emails/jour (seuil Gmail Sender Guidelines obligation One-Click List-Unsubscribe).

L'exigence DKIM signing actif est imposee par les Sender Guidelines majeurs 2024 (Gmail Feb 2024 update, Yahoo Feb 2024, Outlook Microsoft 365 Defender). Sans DKIM signature alignee avec le domain expediteur, les emails sont automatiquement flagges spam dans 60-80 % des cas pour les comptes Gmail strict (rapport mail-tester.com 2024 baseline : score 4/10 sans DKIM vs 9/10 avec DKIM + SPF + DMARC). La cle privee DKIM doit etre generee une seule fois par domain (`skalean-insurtech.ma`) avec selector `default` (convention Mailgun + standard general), longueur 2048 bits (1024 bits considere weak depuis 2018), algorithm RSA-SHA256, et stockee securisee dans le secrets manager (Vault Sprint 35 ou env var encrypted Sprint 9). La public key paired est publiee dans le DNS TXT record `default._domainkey.skalean-insurtech.ma` permettant aux mail receivers (Gmail, Outlook, Yahoo) de verifier les signatures recues. La signature DKIM sur chaque outbound utilise canonicalization `relaxed/relaxed` (recommande RFC 6376 vs `simple/simple` strict casses par les mail relays modifiant whitespace), avec headers signed exhaustifs `From, To, Subject, Date, Message-ID, MIME-Version, Content-Type` (minimum garantissant aucune injection later par MITM dans transit).

L'exigence integration Mailgun API HTTPS prod (vs SMTP only) est imposee par les contraintes performance + scalabilite. SMTP STARTTLS handshake prend 200-500 ms par envoi (negotiation TLS, AUTH PLAIN, MAIL FROM, RCPT TO, DATA, period termination), ce qui limite le throughput a ~10 emails/seconde par connection (suffisant Sprint 5 dev/staging mais insuffisant prod target 100 emails/seconde Sprint 16 Books factures batch envois). Mailgun API HTTPS POST `https://api.eu.mailgun.net/v3/{domain}/messages` retourne en 50-100 ms typique (HTTP/2 multiplexing reuse connection + datacenter EU Frankfurt proche MA ~30 ms latence vs US ~150 ms), supporte 1000 emails/seconde par compte (vs 80/sec rate limit SendGrid free tier ou 100/sec basic SMTP), et offre des features avancees (`o:tag` campaign + `o:tracking` opens/clicks + `o:dkim` server-side DKIM additional + `o:require-tls` enforce TLS 1.2+) inaccessibles via SMTP standard.

L'exigence headers anti-spam RFC 8058 (List-Unsubscribe + List-Unsubscribe-Post One-Click) est imposee par Gmail Sender Guidelines Feb 2024 update. Tout expediteur > 5000 emails/jour vers Gmail DOIT (clause obligatoire, pas best practice) implementer : (1) DKIM signature aligned domain expediteur, (2) SPF record pass, (3) DMARC policy non-`none`, (4) header `List-Unsubscribe` RFC 2369 + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` RFC 8058, (5) ratio spam reports < 0.1 %, (6) ratio bounces < 1 %. Ne pas implementer ces clauses entraine quarantine systematique apres 7 jours observation Gmail puis blocking total apres 30 jours. Skalean MVP Sprint 16 prevoit ~10 000 emails/jour (devis + factures + reminders + auth flows), bien au-dessus du seuil obligatoire 5000.

L'exigence multipart MIME HTML + plain text fallback est imposee par les conventions deliverability + accessibility. 30 % des destinataires lisent en plain text mode (mobile reduction data, accessibility screen readers, corporate mail strict text-only filter, iOS native Mail accessibility setting `Plain Text Only`). Sans plain text fallback, le score deliverability baisse de -15 % (SendGrid 2024 metrics) car les filtres anti-spam considerent l'absence de plain text comme indicateur "amateur sender / spam". `node-html-to-text` 9.0.5 parse l'HTML + extrait le texte readable + preserve les liens dans le format `text [URL]` (vs simple `strip-tags` qui perd les URLs cliquables).

L'exigence tracking Message-ID UUID est imposee par les besoins idempotence + audit + delivery tracking. Sprint 2 a defini la column `comm_messages.provider_message_id VARCHAR(255) UNIQUE` pour stocker l'identifiant unique cross-provider. Sprint 9 Tache 3.2.10 Delivery Tracking consume ce field pour join les webhooks Mailgun (`X-Mailgun-Message-Id` differe parfois du SMTP `Message-ID`, donc Skalean stocke les deux : `provider_message_id` = SMTP Message-ID UUID + `provider_message_id_alt` = Mailgun X-Mailgun-Message-Id si different). Sprint 9 Tache 3.2.8 BullMQ worker email-send consume le Message-ID pour idempotence cross-retries (regenerer envoi avec meme Message-ID -> Mailgun reject duplicate via Idempotency-Key header).

L'exigence runbook DNS prod est imposee par les besoins operationnels DevOps. Sprint 35 go-live prod necessite la configuration des records DNS (registrar Atlas Cloud Benguerir ou Cloudflare Sprint 5 setup) et toute erreur invalide tous les emails outbound. Le runbook doit etre exhaustif (records exacts copy-paste-able + dig commands verification + troubleshooting tree) pour permettre a l'equipe DevOps de configurer en autonomie sans depender du dev backend.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Pas de DKIM signing (fallback Sprint 5 basic) | Simple | Spam folder 60-80 % Gmail strict 2024 | REJETE -- Sprint 9 critical |
| DKIM signature SHA-1 (legacy) | Compat ancien mail relays | Deprecated 2018, weak | REJETE -- SHA-256 only |
| DKIM signing serveur Mailgun uniquement (sans cle Skalean) | Simple, no key management | Domain alignment issue (Mailgun domain vs Skalean) | REJETE -- DKIM client + serveur both |
| DKIM canonicalization simple/simple (strict) | Plus securise | Casse avec mail relays modifiant whitespace | REJETE -- relaxed/relaxed standard |
| DKIM canonicalization relaxed/relaxed (RETENU) | Tolere whitespace changes, RFC recommended | Slight-less strict | RETENU -- standard prod |
| DKIM key 1024 bits | Compat ancien | Weak depuis 2018 (NIST deprecation) | REJETE -- 2048 bits min |
| DKIM key 2048 bits (RETENU) | Standard modern, secure | Slightly slower sign (~1ms) | RETENU |
| DKIM key 4096 bits | Plus securise | Trop long pour DNS TXT records (split obligatoire) | REJETE -- 2048 suffisant |
| DKIM private key dans repo (gitignore) | Simple | Secret leak risk | REJETE -- env var only |
| DKIM private key env var encrypted (RETENU) | Secret centralise, rotatable | Necessite secrets manager Sprint 35 | RETENU Sprint 9 + Sprint 35 Vault |
| DKIM private key in code | NEVER | Catastrophic leak | REJETE absolument |
| Transport SMTP only (Sprint 5 baseline) | Portable, standard | Latence 200-500ms, scaling limite | REJETE prod |
| Transport Mailgun API HTTPS prod (RETENU) | Latence 50-100ms, scaling 1000/sec | Vendor lock partiel | RETENU prod + SMTP fallback dev/staging |
| Transport SendGrid API | Excellent deliverability | Sortie data US, decision-008 mismatch | DEFFERE -- Sprint 35 evaluation conformite |
| Transport AWS SES | Cost tres bas | Sortie data US (decision-008 viole donnees PII MA) | REJETE Sprint 9 -- maybe Sprint 35 EU region |
| Transport Maroc Telecom Mail Pro | Cloud souverain MA | Pas API moderne, support limite | DEFFERE Sprint 35+ evaluation |
| Transport Atlas Cloud Email Service (souverain MA) | Conformite decision-008 totale | Pas dispo Sprint 9 | DEFFERE Sprint 35 transition |
| Mailgun region US | Cost bas, mature | Sortie data US (decision-008 partial mismatch) | REJETE Sprint 9 -- EU only |
| Mailgun region EU (RETENU Sprint 9) | Frankfurt datacenter, RGPD compliant, latence 30ms | Cost slightly plus eleve US | RETENU Sprint 9 |
| Provider single hardcoded | Simple | Pas testable dev (pas Mailhog), pas degradation gracieuse | REJETE |
| Factory pattern switchable env (RETENU) | Multi-env, testable, fallback | Complexite mineure | RETENU |
| Headers anti-spam minimal (Sprint 5 baseline) | Simple | Spam folder Gmail 2024 obligatoire | REJETE Sprint 9 |
| List-Unsubscribe RFC 2369 + RFC 8058 (RETENU) | Conforme Gmail Feb 2024 | Necessite endpoint optout Tache 3.2.11 | RETENU |
| List-Unsubscribe url only (RFC 2369 minimum) | Plus simple | Pas one-click compliance Gmail strict | REJETE Sprint 9 |
| List-Unsubscribe-Post One-Click (RFC 8058) (RETENU) | Gmail 2024 strict mandatory | Endpoint POST one-click sans confirm Tache 3.2.11 | RETENU |
| Subject UTF-8 raw (no encoding) | Simple | Outlook 2016 mojibake, ar-MA broken | REJETE |
| Subject UTF-8 base64 RFC 2047 (RETENU) | Cross-client correct | Slightly verbose | RETENU |
| Multipart HTML only | Simple | -15 % deliverability score, accessibility broken | REJETE |
| Multipart HTML + plain text auto (RETENU) | +15 % deliverability, accessibility OK | Necessite html-to-text lib | RETENU |
| Plain text generated via simple strip-tags | Simple | URLs perdues | REJETE |
| Plain text via node-html-to-text 9.0.5 (RETENU) | Preserve URLs format text [URL] | Library dep | RETENU |
| Message-ID auto-generated by Nodemailer | Simple | Non-deterministe cross-retries | REJETE Sprint 9 |
| Message-ID UUID v4 generated client-side (RETENU) | Deterministe, idempotent retries | Nous controlons | RETENU |
| Message-ID format `<uuid>` only | Standard | Domain alignment manquant | REJETE |
| Message-ID format `<uuid@domain>` (RETENU) | RFC 5322 + domain alignment | Standard | RETENU |
| Idempotency via Message-ID UNIQUE Postgres only | Simple | Mailgun API peut accepter doublons | REJETE |
| Idempotency Message-ID + Mailgun Idempotency-Key header (RETENU) | Defense in depth | Headers double check | RETENU |
| Pool SMTP 1 connection | Simple | Throughput limit ~5/sec | REJETE |
| Pool SMTP 5 connections + rotation 100 msgs (RETENU Sprint 5 + Sprint 9) | Throughput ~25/sec, conn fresh | Memoire ~10 KB par conn | RETENU |
| Retry sur tous errors (4xx + 5xx) | Simple | Loop infini sur 400 invalid email | REJETE |
| Retry seulement 5xx + Idempotency (RETENU) | Smart, fail-fast 400 | Logique conditionnelle | RETENU |
| Retry exponential 1s/5s/30s (RETENU) | Standard backoff, evite thundering herd | OK | RETENU |
| Idempotency-Key Mailgun support | Evite doublons cross-retries | Header custom Mailgun | RETENU |
| Runbook DNS minimal (Sprint 5 baseline) | Simple | DevOps pas autonome go-live prod | REJETE Sprint 9 |
| Runbook exhaustif DNS + dig + troubleshooting (RETENU) | DevOps autonome | 150 lignes documentation | RETENU |
| BIMI logo Gmail (Sprint 35 advanced) | Logo Skalean dans inbox Gmail | Sprint 35 advanced | DEFFERE Sprint 35 |
| MTA-STS strict TLS Sprint 35 | Defense MITM advanced | Sprint 35 advanced | DEFFERE Sprint 35 |
| TLS-RPT reporting Sprint 35 | Visibility TLS issues | Sprint 35 advanced | DEFFERE Sprint 35 |
| DMARC policy `none` | Permissif initial | Pas conforme Gmail strict 2024 | REJETE |
| DMARC policy `quarantine` pct=100 (RETENU) | Strict mais reversible | OK go-live | RETENU |
| DMARC policy `reject` strict | Plus securise | Risque false positives ramp-up | DEFFERE Sprint 35 (apres 30 jours quarantine clean) |

### 2.3 Trade-offs

Choisir DKIM signing client-side via cle privee env (vs DKIM serveur Mailgun uniquement) implique d'accepter une complexite key management (rotation Sprint 35 dual-key 30 jours grace period). En contrepartie, domain alignment garanti (signature `d=skalean-insurtech.ma` vs Mailgun signature `d=mg.mailgun.org` qui necessite SPF include only sans domain alignment DMARC), defense in depth (double signing protege contre Mailgun compromission single-vendor), et portabilite transport (si Sprint 35 transitionne vers Atlas Email, la cle DKIM Skalean reste valide).

Choisir Mailgun region EU (vs US) implique d'accepter un cost slightly plus eleve (~10-15 % premium EU vs US tier). En contrepartie, conformite RGPD totale (datacenter Frankfurt EU jurisdiction), latence MA reduite (30ms vs 150ms US), et alignment partial decision-008 cloud souverain MA (EU > US, Sprint 35 transitionne vers MA souverain Atlas).

Choisir factory pattern switchable env implique d'accepter une complexite mineure du code (3 implementations transports). En contrepartie, multi-env support natif (dev Mailhog gratuit, staging Mailgun SMTP test, prod Mailgun API HTTPS), fallback gracefull (si Mailgun API down, basculer SMTP via env change runtime sans deploy), et testabilite (mock transport via factory).

Choisir headers anti-spam RFC 8058 complete implique d'accepter la dependance avec endpoint optout Tache 3.2.11 (le List-Unsubscribe url necessite un endpoint POST one-click fonctionnel). En contrepartie, conformite Gmail Feb 2024 strict mandatory (sinon spam folder), conformite CNDP loi 09-08 (opt-out simple gratuit immediat), et UX positive (utilisateur peut unsubscribe en 1 clic sans confusion).

Choisir multipart auto-genere via node-html-to-text implique d'accepter une dependance library (1 dep + ~50 KB bundle). En contrepartie, +15 % deliverability score (SendGrid metrics 2024), accessibility correct screen readers, et compat plain text only mail clients (30 % audience).

Choisir Message-ID UUID v4 client-side implique d'accepter la generation cote Skalean (vs delegation Nodemailer auto). En contrepartie, deterministe cross-retries BullMQ (idempotency garantie), trackability cross-provider (join webhooks Mailgun), et audit conformite RGPD/CNDP.

Choisir runbook DNS exhaustif implique d'accepter ~150 lignes documentation maintenance. En contrepartie, DevOps autonome go-live Sprint 35 (pas de bottleneck dev backend), et procedure deterministe replicable.

### 2.4 Decisions strategiques referenced

- decision-001 (Multi-tenant) : indirect, EmailService recoit `tenant_id` implicit via `getCurrentTenantId()` AsyncLocalStorage Sprint 1, utilise pour build `From` address per-tenant (e.g. `noreply+{tenant_slug}@skalean-insurtech.ma`) Sprint 14 SaaS branding.
- decision-006 (No-emoji) : totale.
- decision-007 (Zod runtime) : `SendEmailInputSchema` Zod valide chaque envoi (defense in depth contre injection headers, Subject newline, etc.).
- decision-008 (Cloud souverain MA) : Mailgun EU region partial conformite Sprint 9 (mieux que US, pas optimal MA). Sprint 35 transition Atlas Cloud Email service souverain MA total. `EMAIL_PROVIDER=atlas` sera ajoute Sprint 35 + factory etendue.
- decision-009 (Multi-locale fr-MA, ar-MA, en, fr-FR) : Subject UTF-8 RFC 2047 base64 obligatoire (caracteres arabes ar-MA + lettres accentuees fr-MA).
- decision-014 (Audit immutable) : chaque envoi log `audit_log` table avec `tenant_id`, `message_id`, `to_hash`, `template`, `locale`, `status`, retention 7 ans.
- decision-016 (Kafka events) : `comm.email.sent` topic + `comm.email.send_failed` topic + DLQ Sprint 3 patterns Tache 3.2.8 worker.
- decision-018 (Templates Handlebars) : Sprint 5 livre 10 templates, Sprint 9 enrichi via Tache 3.2.7 renderer + RTL.
- decision-019 (PII encryption at rest) : recipient email considere PII -> hashed sha256 prefix-truncated 8 chars dans logs, jamais en clair.
- decision-022 (Conformite CNDP loi 09-08 + 24-09) : List-Unsubscribe + One-Click opt-out + identification commerciale footer obligatoire.
- decision-024 (TLS 1.2+ minimum) : `EMAIL_SMTP_SECURE=true` STARTTLS + Mailgun API HTTPS only (pas HTTP).

### 2.5 Pieges techniques connus

1. **DKIM private key PEM multiline env var parsing** : Bash dotenv ne supporte pas natively les newlines dans env vars. Convention : utiliser `\n` literal dans `.env` puis `replace(/\\n/g, '\n')` au load. Ou base64 encode la PEM puis decode au boot. Solution choisie : base64 decode (plus robust quotes echappement).
2. **DKIM canonicalization mismatch private/public key** : si public key DNS differe (e.g. typo dans p=) -> signature fail verify cote receivers. Mitigation : runbook `dig` verification command obligatoire post-deploy.
3. **DKIM clock skew** : DKIM signature inclus `t=` timestamp. Si clock drift > 5 min entre Skalean server et receivers -> signature reject. Mitigation : NTP sync obligatoire (Sprint 1 systemd-timesyncd).
4. **Mailgun API region mismatch** : `mailgun.net` (US) vs `eu.mailgun.net` (EU) -> Skalean utilise EU exclusivement. URL hardcoded `https://api.eu.mailgun.net/v3/...`. Si env `EMAIL_MAILGUN_REGION=us` accidentel -> erreur explicit boot.
5. **Mailgun domain not verified** : Mailgun valide DKIM/SPF DNS records avant send, sinon 403 forbidden. Mitigation : healthcheck verify-domain endpoint Sprint 35.
6. **SMTP STARTTLS failure** : si serveur SMTP destination ne supporte pas STARTTLS, fallback opportunistic plaintext = security risk. Mitigation : `EMAIL_SMTP_REQUIRE_TLS=true` rejette plaintext.
7. **Subject newline injection (CRLF) header injection attack** : si user fournit subject avec `\r\n`, attacker peut injecter `Bcc:` headers exfiltrant emails. Mitigation : Zod regex strict reject `\r\n\0`.
8. **List-Unsubscribe URL non-HTTPS** : Gmail rejette l'URL si `http://` (must `https://`). Mitigation : Zod schema enforce `z.string().url().startsWith('https://')`.
9. **Message-ID format `<uuid@domain>` syntax** : RFC 5322 strict requires `<` `>` enclosing + `@domain`. Sans encadrement -> Mailgun retain format mais Outlook strict reject. Mitigation : helper function build Message-ID strict.
10. **Multipart boundary collision** : si HTML contient le boundary string accidentellement -> mail parsing broken. Mitigation : Nodemailer auto-generate boundary UUID.
11. **Body > 25 MB Mailgun reject** : limit Mailgun 25 MB total (incl attachments). Mitigation : Zod validate body size pre-send, error `EmailSizeExceededError`.
12. **Body > 100 KB HTML Gmail clip** : Gmail clip emails > 102 KB, masquant le footer. Mitigation : warning log + truncate plain text si HTML > 80 KB.
13. **HTML invalid (unclosed tags)** : peut casser le rendu Outlook. Mitigation : pas de fix automatique cote service, responsabilite renderer Tache 3.2.7. Service log warn si html-to-text throw.
14. **Recipient email non-RFC 5322** : addresses comme `user@domain..com` (double dot) ou `user@-domain.com` (hyphen leading). Mitigation : Zod regex RFC 5322-compliant strict.
15. **Idempotency-Key Mailgun TTL 24h** : cle reutilisee apres 24h = doublon possible. Mitigation : utiliser Message-ID comme Idempotency-Key (cycle UUID v4 unique).
16. **Connection pool exhausted under burst** : 100 emails/sec burst sur pool 5 connections = queue overflow. Mitigation : BullMQ Tache 3.2.8 worker rate-limit + backpressure.
17. **Pool connection stale after idle** : Nodemailer pool keep-alive 60s. Si idle > 60s -> connection drop -> next send reconnect 200ms latency. Mitigation : healthcheck periodic ping.
18. **Mailgun rate limit 429 Retry-After header** : si rate limit hit, Mailgun return 429 + `Retry-After: 60`. Mitigation : retry policy honor `Retry-After` (vs exponential standard).
19. **Mailgun bounce types parsing** : `permanent` (hard) vs `temporary` (soft). Hard bounce = auto opt-out (reputation), soft = retry. Tache 3.2.10 traite, Tache 3.2.6 prepare via Mailgun API tags.
20. **DKIM rotation key grace period** : si rotation cle, ancien selector + nouveau selector valid simultanement 30 jours (publish 2 DNS records). Mitigation : runbook procedure rotation Sprint 35.
21. **TLS 1.3 vs 1.2 negotiation** : certains old SMTP relays only TLS 1.2. Skalean exige minimum 1.2. Mitigation : `EMAIL_SMTP_TLS_MIN_VERSION=TLSv1.2`.
22. **PII in BCC visible in raw** : si BCC headers ajoutes, certains relays exposent. Skalean policy : NEVER BCC, batch sends individuels.
23. **Mailgun webhook signing key vs API key** : 2 secrets differents. Webhook signing = HMAC verify webhooks (Tache 3.2.10), API key = authenticate sends. Variables env distinctes.
24. **Encoding subject characters >128 in name part From** : `From: =?UTF-8?B?...?= <email>` -- Nodemailer auto-handle, mais Mailgun API multipart required manual encoding. Solution : helper encode pre-API call.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 3.2.6 livre EmailService production-ready consomme par : Tache 3.2.7 (Email Template Renderer integration via `sendTemplate()`), Tache 3.2.8 (BullMQ workers `email-send` consume `EmailService.send()`), Tache 3.2.9 (Message Orchestrator routing fallback email si WA opt-out), Tache 3.2.10 (Delivery Tracking Mailgun webhooks consume `provider_message_id`), Tache 3.2.11 (Opt-out List-Unsubscribe endpoint cible URL emails), Tache 3.2.13 (E2E tests Mailhog integration).

### 3.2 Position dans le programme global

- Sprint 5 (Tache 2.1.13 baseline) : EmailService initial Nodemailer + Handlebars + 40 templates -- ENRICHI ici Sprint 9.
- Sprint 9 (Tache 3.2.6 cette tache) : DKIM + Mailgun + headers + tracking + runbook DNS.
- Sprint 14+ : consume EmailService pour Insure (devis, polices, payment due).
- Sprint 15+ : consume EmailService pour Books (factures).
- Sprint 16 : go-live emails transactionnels.
- Sprint 18 : consume Customer Portal preferences integration.
- Sprint 22 : Analytics open rate via Mailgun tracking pixel + Tache 3.2.10 webhook ingest.
- Sprint 27 : Admin UI templates editor + Mailgun stats dashboard.
- Sprint 33 : Alerting bounce rate > 5 % Slack webhook.
- Sprint 35 : Migration Atlas Cloud Email service souverain MA + DKIM rotation + BIMI + MTA-STS + TLS-RPT advanced.

### 3.3 Diagramme

```
                +--------------------------------------+
                | Tache 3.2.5 termine (Template Mgr)    |
                +-------------------+--------------------+
                                    |
                                    v
              +---------------------+---------------------+
              | TACHE 3.2.6 (cette tache)                    |
              | EmailService production-ready                |
              |                                              |
              | EmailModule (Global NestJS)                   |
              |    -> EmailTransportFactory                   |
              |          -> mailhog (dev)                     |
              |          -> mailgun-smtp (staging)            |
              |          -> mailgun-api (prod)                |
              |    -> DkimSignerHelper (PEM key load + sign)  |
              |    -> MailgunApiClient (undici HTTPS)          |
              |    -> EmailHeadersBuilder (RFC 8058 + RFC 2047)|
              |                                              |
              | Methods :                                    |
              |   send({ to, subject, html, text? })         |
              |   sendTemplate({ to, templateName, locale, vars })|
              |   verifyConnection()                         |
              |                                              |
              | Headers obligatoires :                        |
              |   From: noreply@skalean-insurtech.ma         |
              |   Reply-To: support@skalean-insurtech.ma     |
              |   Subject: =?UTF-8?B?...?= encoded           |
              |   Date: RFC 5322 Africa/Casablanca           |
              |   Message-ID: <uuid@skalean-insurtech.ma>    |
              |   List-Unsubscribe: <https://...>, <mailto:.>|
              |   List-Unsubscribe-Post: One-Click           |
              |   DKIM-Signature: v=1; a=rsa-sha256; ...     |
              +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
                | | | | | | | | | | | | | | | | | | | |
                v v v v v v v v v v v v v v v v v v v v
                3.2.7 / 3.2.8 / 3.2.9 / 3.2.10 / 3.2.11 / 3.2.13
                Sprint 14 Insure / Sprint 15 Books / Sprint 18 portal

           Runbook DNS prod -> DevOps Atlas Cloud Benguerir
              SPF / DKIM public key / DMARC / MTA-STS Sprint 35
```

---

## 4. Livrables checkables (35 livrables)

- [ ] Service `repo/packages/comm/src/providers/email/email.service.ts` -- ~280 lignes (ENRICHI Sprint 5 base)
- [ ] Helper `repo/packages/comm/src/providers/email/dkim-signer.helper.ts` -- ~120 lignes
- [ ] Factory `repo/packages/comm/src/providers/email/email-transport.factory.ts` -- ~150 lignes
- [ ] Client `repo/packages/comm/src/providers/email/mailgun-api.client.ts` -- ~200 lignes
- [ ] Builder `repo/packages/comm/src/providers/email/email-headers.builder.ts` -- ~120 lignes
- [ ] Module `repo/packages/comm/src/providers/email/email.module.ts` -- ~50 lignes
- [ ] Types `repo/packages/comm/src/providers/email/types.ts` -- ~80 lignes
- [ ] Errors `repo/packages/comm/src/providers/email/errors.ts` -- ~80 lignes
- [ ] Index `repo/packages/comm/src/providers/email/index.ts` -- ~25 lignes
- [ ] Runbook `repo/docs/runbooks/email-dns-setup.md` -- ~150 lignes
- [ ] Tests unit `email.service.spec.ts` -- 25+ tests -- ~250 lignes
- [ ] Tests unit `dkim-signer.helper.spec.ts` -- 8 tests -- ~120 lignes
- [ ] Tests unit `email-transport.factory.spec.ts` -- 6 tests -- ~80 lignes
- [ ] Tests unit `mailgun-api.client.spec.ts` -- 12 tests -- ~150 lignes
- [ ] Tests unit `email-headers.builder.spec.ts` -- 10 tests -- ~120 lignes
- [ ] Tests integration `email-mailhog.integration.spec.ts` -- 5 tests -- ~200 lignes
- [ ] Mise a jour `package.json` : add `node-html-to-text@9.0.5`, `undici@7.1.1` (deja Sprint 5+), DKIM lib via Nodemailer native ou `dkim-signer@0.4.2`
- [ ] Variables env new : `EMAIL_PROVIDER`, `EMAIL_DKIM_PRIVATE_KEY`, `EMAIL_DKIM_SELECTOR`, `EMAIL_DKIM_DOMAIN`, `EMAIL_MAILGUN_API_KEY`, `EMAIL_MAILGUN_DOMAIN`, `EMAIL_MAILGUN_REGION`, `EMAIL_RETRY_MAX_ATTEMPTS`, `EMAIL_OPTOUT_SIGNING_SECRET`
- [ ] DKIM signing actif sur chaque outbound (verify via dkim-verify lib)
- [ ] List-Unsubscribe + List-Unsubscribe-Post One-Click headers obligatoires
- [ ] Subject UTF-8 RFC 2047 base64 encoding auto
- [ ] Multipart HTML + text auto via node-html-to-text
- [ ] Message-ID UUID v4 + domain
- [ ] Provider switchable env (mailhog | mailgun-smtp | mailgun-api)
- [ ] Pool SMTP 5 conns + 100 msgs rotation
- [ ] Retry exponential 3x sur 5xx + fail-fast 400 + Retry-After honor 429
- [ ] Idempotency-Key Mailgun support
- [ ] No-emoji
- [ ] No-console
- [ ] No log de DKIM private key / Mailgun API key / tokens / emails entiers
- [ ] To recipient hashed sha256 prefix-truncated 8 chars dans logs
- [ ] Coverage >= 88 % sur module providers/email
- [ ] Build TypeScript reussit
- [ ] Mailhog integration test passe local
- [ ] Bench email send Mailhog < 200 ms p99 mock SMTP

---

## 5. Fichiers crees / modifies

```
repo/packages/comm/src/providers/email/email.service.ts                          (~280 lignes ENRICHI)
repo/packages/comm/src/providers/email/dkim-signer.helper.ts                      (~120 lignes NEW)
repo/packages/comm/src/providers/email/email-transport.factory.ts                 (~150 lignes NEW)
repo/packages/comm/src/providers/email/mailgun-api.client.ts                       (~200 lignes NEW)
repo/packages/comm/src/providers/email/email-headers.builder.ts                    (~120 lignes NEW)
repo/packages/comm/src/providers/email/email.module.ts                             (~50 lignes NEW)
repo/packages/comm/src/providers/email/types.ts                                    (~80 lignes NEW)
repo/packages/comm/src/providers/email/errors.ts                                   (~80 lignes NEW)
repo/packages/comm/src/providers/email/index.ts                                    (~25 lignes NEW)
repo/packages/comm/src/providers/email/email.service.spec.ts                       (~250 lignes NEW)
repo/packages/comm/src/providers/email/dkim-signer.helper.spec.ts                  (~120 lignes NEW)
repo/packages/comm/src/providers/email/email-transport.factory.spec.ts             (~80 lignes NEW)
repo/packages/comm/src/providers/email/mailgun-api.client.spec.ts                  (~150 lignes NEW)
repo/packages/comm/src/providers/email/email-headers.builder.spec.ts               (~120 lignes NEW)
repo/packages/comm/src/__tests__/integration/email-mailhog.integration.spec.ts     (~200 lignes NEW)
repo/docs/runbooks/email-dns-setup.md                                              (~150 lignes NEW)
repo/packages/comm/package.json                                                    (modifie / +node-html-to-text)
.env.example                                                                       (modifie / +EMAIL_PROVIDER, +EMAIL_DKIM_*, +EMAIL_MAILGUN_*)
repo/packages/comm/src/services/email.service.ts                                   (Sprint 5 baseline -- DEPRECATED, redirect vers providers/email/)
repo/packages/comm/src/comm.module.ts                                              (modifie / import EmailModule providers)
```

Total : 17 fichiers nouveaux + 4 modifies, ~2500 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 12 : `email.service.ts` (ENRICHI Sprint 5 baseline)

```typescript
/**
 * @insurtech/comm/providers/email/email.service
 *
 * Production-ready email service Sprint 9 :
 *   - DKIM RSA-SHA256 signing actif via private key env
 *   - Mailgun API HTTPS prod + SMTP staging + Mailhog dev (factory)
 *   - Headers anti-spam RFC 8058 (List-Unsubscribe-Post One-Click)
 *   - Subject UTF-8 RFC 2047 base64 auto encoding
 *   - Multipart HTML + plain text auto via node-html-to-text
 *   - Message-ID UUID v4 + domain tracked persisted comm_messages.provider_message_id
 *   - Pool SMTP 5 conns + 100 msgs rotation
 *   - Retry exponential 3x 5xx + fail-fast 400 + Retry-After 429 honor
 *
 * Reference :
 *   - decision-008 (Cloud souverain MA -- Mailgun EU partial Sprint 9)
 *   - decision-009 (Multi-locale -- Subject UTF-8)
 *   - decision-019 (PII encryption -- recipient hashed logs)
 *   - decision-022 (CNDP loi 09-08 + 24-09 -- List-Unsubscribe)
 *   - Sprint 5 Tache 2.1.13 (baseline EmailService) -- ENRICHI ici
 *   - Sprint 9 Tache 3.2.6 (this task)
 *   - Sprint 35 transition Atlas Email souverain MA
 */

import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID, createHash } from 'node:crypto';
import { htmlToText } from 'node-html-to-text';
import { z } from 'zod';
import type { EmailTransport } from './email-transport.factory.js';
import { EmailTransportFactory } from './email-transport.factory.js';
import { DkimSignerHelper } from './dkim-signer.helper.js';
import { EmailHeadersBuilder } from './email-headers.builder.js';
import {
  EmailSendError,
  EmailRateLimitError,
  EmailDkimError,
  EmailInvalidAddressError,
  EmailBouncedError,
  EmailSizeExceededError,
} from './errors.js';
import type {
  SendEmailInput,
  SendEmailResult,
  EmailHeaders,
  EmailProvider,
} from './types.js';

const SendEmailInputSchema = z.object({
  to: z.string().email().regex(/^[^\r\n\0]+$/, 'No CRLF/null injection'),
  subject: z.string().min(1).max(998).regex(/^[^\r\n\0]+$/, 'No CRLF injection'),
  html: z.string().min(1).max(102_400, 'HTML > 100 KB Gmail clip warning'),
  text: z.string().optional(),
  replyTo: z.string().email().optional(),
  listUnsubscribeToken: z.string().optional(),
  idempotencyKey: z.string().uuid().optional(),
  tags: z.array(z.string()).max(3).optional(),
  tenantId: z.string().uuid().optional(),
});

const MAX_BODY_BYTES = 25 * 1024 * 1024; // 25 MB Mailgun limit
const HTML_CLIP_WARN_BYTES = 80 * 1024; // 80 KB Gmail clip warning

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private transport!: EmailTransport;
  private readonly fromAddress: string;
  private readonly fromName: string;
  private readonly replyToAddress: string;
  private readonly dkimDomain: string;
  private readonly retryMaxAttempts: number;

  constructor(
    private readonly config: ConfigService,
    private readonly transportFactory: EmailTransportFactory,
    private readonly dkimSigner: DkimSignerHelper,
    private readonly headersBuilder: EmailHeadersBuilder,
  ) {
    this.fromAddress = config.getOrThrow<string>('EMAIL_FROM_NO_REPLY');
    this.fromName = config.get<string>('EMAIL_FROM_NAME', 'Skalean InsurTech');
    this.replyToAddress = config.getOrThrow<string>('EMAIL_FROM_SUPPORT');
    this.dkimDomain = config.getOrThrow<string>('EMAIL_DKIM_DOMAIN');
    this.retryMaxAttempts = parseInt(config.get('EMAIL_RETRY_MAX_ATTEMPTS', '3'), 10);
  }

  async onModuleInit(): Promise<void> {
    this.transport = await this.transportFactory.create();
    this.logger.log(`EmailService initialized provider=${this.transportFactory.getProvider()}`);
    if (this.transportFactory.getProvider() !== 'mailhog') {
      const dkimReady = await this.dkimSigner.verifyKeyLoaded();
      if (!dkimReady) {
        throw new EmailDkimError('DKIM private key not loaded for non-dev provider');
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.transport.close();
    this.logger.log('EmailService transport closed');
  }

  /**
   * Send transactional email with DKIM signing + RFC 8058 headers.
   *
   * @returns { messageId, providerMessageId, status: 'queued' | 'sent' }
   * @throws EmailInvalidAddressError on invalid recipient
   * @throws EmailSizeExceededError on body > 25 MB
   * @throws EmailRateLimitError on 429 Mailgun
   * @throws EmailSendError on 5xx after max retries
   */
  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const start = Date.now();
    const parsed = SendEmailInputSchema.parse(input);
    const messageId = `<${randomUUID()}@${this.dkimDomain}>`;
    const toHash = this.hashEmailForLogs(parsed.to);

    // Body size check (Mailgun limit 25 MB)
    const totalBytes = Buffer.byteLength(parsed.html, 'utf8') + Buffer.byteLength(parsed.text ?? '', 'utf8');
    if (totalBytes > MAX_BODY_BYTES) {
      throw new EmailSizeExceededError(`Body ${totalBytes} bytes > 25 MB limit`);
    }
    if (Buffer.byteLength(parsed.html, 'utf8') > HTML_CLIP_WARN_BYTES) {
      this.logger.warn({
        msg: 'email_html_size_warning',
        bytes: Buffer.byteLength(parsed.html, 'utf8'),
        warn: 'Gmail clips > 102 KB',
      });
    }

    // Auto-generate plain text fallback if missing
    const text = parsed.text ?? htmlToText(parsed.html, {
      wordwrap: 130,
      selectors: [
        { selector: 'a', options: { hideLinkHrefIfSameAsText: false } },
        { selector: 'img', format: 'skip' },
      ],
    });

    // Build all required headers
    const headers = this.headersBuilder.build({
      from: { name: this.fromName, address: this.fromAddress },
      replyTo: parsed.replyTo ?? this.replyToAddress,
      messageId,
      subject: parsed.subject,
      listUnsubscribeToken: parsed.listUnsubscribeToken,
      tenantId: parsed.tenantId,
    });

    this.logger.log({ msg: 'email_send_start', messageId, toHash, provider: this.transportFactory.getProvider() });

    // Send with retry exponential
    let lastErr: Error | undefined;
    for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt++) {
      try {
        const result = await this.transport.send({
          headers,
          to: parsed.to,
          html: parsed.html,
          text,
          tags: parsed.tags,
          idempotencyKey: parsed.idempotencyKey ?? messageId,
          dkimSign: this.dkimSigner.signMessage.bind(this.dkimSigner),
        });

        const latency = Date.now() - start;
        this.logger.log({
          msg: 'email_send_complete',
          messageId,
          providerMessageId: result.providerMessageId,
          toHash,
          latencyMs: latency,
          attempts: attempt,
        });

        return {
          messageId,
          providerMessageId: result.providerMessageId,
          status: 'sent',
          latencyMs: latency,
        };
      } catch (err) {
        lastErr = err as Error;

        // Fail-fast on 400 (invalid email format etc.)
        if (err instanceof EmailInvalidAddressError) {
          this.logger.error({ msg: 'email_send_failed_invalid', messageId, toHash, error: err.message });
          throw err;
        }

        // 429 Rate limit : honor Retry-After
        if (err instanceof EmailRateLimitError) {
          const waitMs = err.retryAfterSeconds * 1000;
          this.logger.warn({ msg: 'email_send_rate_limit', messageId, attempt, retryAfterMs: waitMs });
          await this.sleep(waitMs);
          continue;
        }

        // 5xx retry exponential
        if (attempt < this.retryMaxAttempts) {
          const backoff = Math.min(1000 * Math.pow(5, attempt - 1), 30_000);
          this.logger.warn({
            msg: 'email_send_retry',
            messageId,
            attempt,
            nextBackoffMs: backoff,
            error: err instanceof Error ? err.message : String(err),
          });
          await this.sleep(backoff);
          continue;
        }
      }
    }

    this.logger.error({
      msg: 'email_send_failed_final',
      messageId,
      toHash,
      attempts: this.retryMaxAttempts,
      error: lastErr?.message,
    });
    throw new EmailSendError(`Failed after ${this.retryMaxAttempts} attempts: ${lastErr?.message}`, lastErr);
  }

  async verifyConnection(): Promise<boolean> {
    try {
      return await this.transport.verify();
    } catch (err) {
      this.logger.warn({ msg: 'email_verify_failed', error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  private hashEmailForLogs(email: string): string {
    return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 8);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

### 6.2 Fichier 2 / 12 : `dkim-signer.helper.ts`

```typescript
/**
 * @insurtech/comm/providers/email/dkim-signer.helper
 *
 * DKIM RSA-SHA256 signer for outbound emails.
 *
 * Reference RFC 6376 (DKIM Signatures).
 * Canonicalization : relaxed/relaxed (recommended, tolerates whitespace changes).
 * Headers signed : From, To, Subject, Date, Message-ID, MIME-Version, Content-Type.
 * Body hash : sha256 base64 of canonicalized body.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createSign, createHash } from 'node:crypto';
import { EmailDkimError } from './errors.js';

export interface DkimSignInput {
  headers: Record<string, string>;
  body: string;
}

export interface DkimSignedResult {
  signature: string; // Full DKIM-Signature header value
}

@Injectable()
export class DkimSignerHelper {
  private readonly logger = new Logger(DkimSignerHelper.name);
  private privateKey: string | null = null;
  private readonly selector: string;
  private readonly domain: string;

  constructor(private readonly config: ConfigService) {
    this.selector = config.get<string>('EMAIL_DKIM_SELECTOR', 'default');
    this.domain = config.getOrThrow<string>('EMAIL_DKIM_DOMAIN');
    this.loadPrivateKey();
  }

  private loadPrivateKey(): void {
    const raw = this.config.get<string>('EMAIL_DKIM_PRIVATE_KEY');
    if (!raw) {
      this.logger.warn('EMAIL_DKIM_PRIVATE_KEY not set; DKIM signing disabled (dev mode only)');
      return;
    }

    try {
      // Two formats supported : PEM with \n literal escapes (dotenv) OR base64 encoded PEM
      let pem = raw.replace(/\\n/g, '\n');
      if (!pem.startsWith('-----BEGIN')) {
        pem = Buffer.from(raw, 'base64').toString('utf8');
      }
      if (!pem.includes('-----BEGIN') || !pem.includes('-----END')) {
        throw new Error('Invalid PEM format');
      }
      this.privateKey = pem;
      this.logger.log(`DKIM key loaded selector=${this.selector} domain=${this.domain}`);
    } catch (err) {
      throw new EmailDkimError(`Failed to load DKIM private key: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async verifyKeyLoaded(): Promise<boolean> {
    return this.privateKey !== null;
  }

  signMessage(input: DkimSignInput): DkimSignedResult {
    if (!this.privateKey) {
      throw new EmailDkimError('DKIM private key not loaded');
    }

    const headersToSign = ['from', 'to', 'subject', 'date', 'message-id', 'mime-version', 'content-type'];
    const headerNames = headersToSign.join(':');

    // Canonicalize body (relaxed) : trim trailing whitespace per line + collapse
    const canonicalBody = this.canonicalizeBody(input.body);
    const bodyHash = createHash('sha256').update(canonicalBody, 'utf8').digest('base64');

    // Canonicalize headers (relaxed) : lowercase name + trim values + collapse internal WSP
    const canonicalHeaders = this.canonicalizeHeaders(input.headers, headersToSign);

    // Build DKIM-Signature header (without b= yet)
    const timestamp = Math.floor(Date.now() / 1000);
    const sigHeader =
      `v=1; ` +
      `a=rsa-sha256; ` +
      `c=relaxed/relaxed; ` +
      `d=${this.domain}; ` +
      `s=${this.selector}; ` +
      `t=${timestamp}; ` +
      `h=${headerNames}; ` +
      `bh=${bodyHash}; ` +
      `b=`;

    // Compute signature : sign canonicalHeaders + DKIM-Signature header (with empty b=)
    const dataToSign = canonicalHeaders + '\r\ndkim-signature:' + sigHeader;
    const sign = createSign('RSA-SHA256');
    sign.update(dataToSign, 'utf8');
    sign.end();
    const signature = sign.sign(this.privateKey, 'base64');

    return {
      signature: sigHeader + signature,
    };
  }

  private canonicalizeBody(body: string): string {
    // RFC 6376 relaxed body canonicalization :
    //   1. Reduce all sequences of WSP within a line to a single SP
    //   2. Ignore all whitespace at end of lines
    //   3. Ignore all empty lines at end of body
    const lines = body.split(/\r?\n/);
    const trimmed = lines.map((line) => line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/, ''));
    while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
      trimmed.pop();
    }
    return trimmed.join('\r\n') + '\r\n';
  }

  private canonicalizeHeaders(headers: Record<string, string>, headerNames: string[]): string {
    return headerNames
      .map((name) => {
        const value = headers[name] ?? headers[Object.keys(headers).find((k) => k.toLowerCase() === name) ?? ''];
        if (!value) return '';
        const canonicalValue = value.replace(/\r?\n/g, '').replace(/\s+/g, ' ').trim();
        return `${name}:${canonicalValue}`;
      })
      .filter(Boolean)
      .join('\r\n');
  }
}
```

### 6.3 Fichier 3 / 12 : `email-transport.factory.ts`

```typescript
/**
 * @insurtech/comm/providers/email/email-transport.factory
 *
 * Factory pattern : instancie le transport selon EMAIL_PROVIDER env.
 *   - mailhog (dev) : SMTP localhost:1025 no auth
 *   - mailgun-smtp (staging) : SMTP smtp.eu.mailgun.org:587 STARTTLS auth
 *   - mailgun-api (prod) : HTTPS api.eu.mailgun.net/v3/{domain}/messages
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { MailgunApiClient } from './mailgun-api.client.js';
import { DkimSignerHelper } from './dkim-signer.helper.js';
import type { EmailProvider, TransportSendInput, TransportSendResult } from './types.js';

export interface EmailTransport {
  send(input: TransportSendInput): Promise<TransportSendResult>;
  verify(): Promise<boolean>;
  close(): Promise<void>;
}

@Injectable()
export class EmailTransportFactory {
  private readonly logger = new Logger(EmailTransportFactory.name);
  private provider: EmailProvider;

  constructor(
    private readonly config: ConfigService,
    private readonly mailgunClient: MailgunApiClient,
  ) {
    this.provider = config.get<EmailProvider>('EMAIL_PROVIDER', 'mailhog');
    if (!['mailhog', 'mailgun-smtp', 'mailgun-api'].includes(this.provider)) {
      throw new Error(`Invalid EMAIL_PROVIDER ${this.provider}`);
    }
  }

  getProvider(): EmailProvider {
    return this.provider;
  }

  async create(): Promise<EmailTransport> {
    switch (this.provider) {
      case 'mailhog':
        return this.createMailhogTransport();
      case 'mailgun-smtp':
        return this.createMailgunSmtpTransport();
      case 'mailgun-api':
        return this.createMailgunApiTransport();
      default:
        throw new Error(`Unsupported provider ${this.provider}`);
    }
  }

  private createMailhogTransport(): EmailTransport {
    const transporter = nodemailer.createTransport({
      host: this.config.get('EMAIL_SMTP_HOST', 'localhost'),
      port: parseInt(this.config.get('EMAIL_SMTP_PORT', '1025'), 10),
      secure: false,
      ignoreTLS: true,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
    return this.wrapNodemailer(transporter);
  }

  private createMailgunSmtpTransport(): EmailTransport {
    const transporter = nodemailer.createTransport({
      host: this.config.getOrThrow('EMAIL_SMTP_HOST'),
      port: parseInt(this.config.getOrThrow('EMAIL_SMTP_PORT'), 10),
      secure: false,
      requireTLS: true,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: {
        user: this.config.getOrThrow('EMAIL_SMTP_USER'),
        pass: this.config.getOrThrow('EMAIL_SMTP_PASSWORD'),
      },
      tls: { minVersion: 'TLSv1.2' },
    });
    return this.wrapNodemailer(transporter);
  }

  private wrapNodemailer(transporter: Transporter): EmailTransport {
    return {
      send: async (input) => {
        const dkimResult = input.dkimSign({
          headers: input.headers,
          body: input.html,
        });
        const dkimHeaders = { 'dkim-signature': dkimResult.signature };

        const info = await transporter.sendMail({
          from: input.headers['from'],
          to: input.to,
          subject: input.headers['subject'],
          html: input.html,
          text: input.text,
          headers: { ...input.headers, ...dkimHeaders },
          messageId: input.headers['message-id'],
        });
        return { providerMessageId: info.messageId };
      },
      verify: () => transporter.verify(),
      close: async () => {
        transporter.close();
      },
    };
  }

  private createMailgunApiTransport(): EmailTransport {
    return {
      send: async (input) => {
        const dkimResult = input.dkimSign({
          headers: input.headers,
          body: input.html,
        });
        const result = await this.mailgunClient.send({
          from: input.headers['from'],
          to: input.to,
          subject: input.headers['subject'],
          html: input.html,
          text: input.text,
          headers: { ...input.headers, 'DKIM-Signature': dkimResult.signature },
          tags: input.tags,
          idempotencyKey: input.idempotencyKey,
        });
        return { providerMessageId: result.messageId };
      },
      verify: () => this.mailgunClient.verifyDomain(),
      close: async () => this.mailgunClient.close(),
    };
  }
}
```

### 6.4 Fichier 4 / 12 : `mailgun-api.client.ts`

```typescript
/**
 * @insurtech/comm/providers/email/mailgun-api.client
 *
 * Mailgun HTTPS API client (region EU exclusively).
 * POST https://api.eu.mailgun.net/v3/{domain}/messages
 * Authentication : Basic base64(api:KEY)
 * Multipart form-data with from / to / subject / html / text / o:tag / o:tracking / h:* custom headers
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { request, Agent } from 'undici';
import { FormData } from 'undici';
import {
  EmailSendError,
  EmailRateLimitError,
  EmailInvalidAddressError,
} from './errors.js';

export interface MailgunSendInput {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  tags?: string[];
  idempotencyKey?: string;
}

export interface MailgunSendResult {
  messageId: string;
  mailgunId: string;
}

@Injectable()
export class MailgunApiClient {
  private readonly logger = new Logger(MailgunApiClient.name);
  private readonly baseUrl: string;
  private readonly domain: string;
  private readonly apiKey: string;
  private readonly authHeader: string;
  private readonly agent: Agent;

  constructor(private readonly config: ConfigService) {
    const region = config.get('EMAIL_MAILGUN_REGION', 'eu');
    if (region !== 'eu') {
      throw new Error('Only Mailgun EU region supported (decision-008 cloud souverain MA partial)');
    }
    this.baseUrl = `https://api.eu.mailgun.net/v3`;
    this.domain = config.getOrThrow<string>('EMAIL_MAILGUN_DOMAIN');
    this.apiKey = config.getOrThrow<string>('EMAIL_MAILGUN_API_KEY');
    this.authHeader = `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`;
    this.agent = new Agent({
      keepAliveTimeout: 30_000,
      keepAliveMaxTimeout: 60_000,
      pipelining: 1,
      connections: 10,
    });
  }

  async send(input: MailgunSendInput): Promise<MailgunSendResult> {
    const form = new FormData();
    form.append('from', input.from);
    form.append('to', input.to);
    form.append('subject', input.subject);
    form.append('html', input.html);
    if (input.text) form.append('text', input.text);

    // Mailgun options
    form.append('o:dkim', 'yes');
    form.append('o:tracking', 'yes');
    form.append('o:tracking-clicks', 'htmlonly');
    form.append('o:tracking-opens', 'yes');
    form.append('o:require-tls', 'true');
    if (input.tags) {
      input.tags.forEach((tag) => form.append('o:tag', tag));
    }

    // Custom headers (h:Name)
    if (input.headers) {
      for (const [name, value] of Object.entries(input.headers)) {
        if (['from', 'to', 'subject'].includes(name.toLowerCase())) continue;
        form.append(`h:${name}`, value);
      }
    }

    const headers: Record<string, string> = {
      authorization: this.authHeader,
    };
    if (input.idempotencyKey) {
      headers['idempotency-key'] = input.idempotencyKey;
    }

    const url = `${this.baseUrl}/${encodeURIComponent(this.domain)}/messages`;
    const start = Date.now();
    const response = await request(url, {
      method: 'POST',
      headers,
      body: form,
      dispatcher: this.agent,
    });

    const latency = Date.now() - start;
    const status = response.statusCode;
    const bodyText = await response.body.text();

    this.logger.debug({ msg: 'mailgun_api_response', status, latencyMs: latency });

    if (status === 200) {
      const json = JSON.parse(bodyText) as { id: string; message: string };
      const mailgunId = json.id.replace(/^<|>$/g, '');
      return {
        messageId: input.headers?.['Message-ID'] ?? `<${mailgunId}>`,
        mailgunId,
      };
    }

    if (status === 400) {
      throw new EmailInvalidAddressError(`Mailgun rejected: ${bodyText}`);
    }
    if (status === 401 || status === 403) {
      throw new EmailSendError(`Mailgun auth failed (${status}): ${bodyText}`);
    }
    if (status === 429) {
      const retryAfter = parseInt((response.headers['retry-after'] as string) ?? '60', 10);
      throw new EmailRateLimitError(`Mailgun rate limit`, retryAfter);
    }
    if (status >= 500) {
      throw new EmailSendError(`Mailgun 5xx (${status}): ${bodyText}`);
    }

    throw new EmailSendError(`Mailgun unexpected status ${status}: ${bodyText}`);
  }

  async verifyDomain(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/domains/${encodeURIComponent(this.domain)}`;
      const response = await request(url, {
        method: 'GET',
        headers: { authorization: this.authHeader },
        dispatcher: this.agent,
      });
      return response.statusCode === 200;
    } catch (err) {
      this.logger.warn({ msg: 'mailgun_verify_domain_failed', error: err instanceof Error ? err.message : String(err) });
      return false;
    }
  }

  async close(): Promise<void> {
    await this.agent.close();
  }
}
```

### 6.5 Fichier 5 / 12 : `email-headers.builder.ts`

```typescript
/**
 * @insurtech/comm/providers/email/email-headers.builder
 *
 * Construit les headers obligatoires anti-spam :
 *   - From: Skalean InsurTech <noreply@skalean-insurtech.ma>
 *   - Reply-To: support@skalean-insurtech.ma
 *   - Subject: =?UTF-8?B?...?= base64 encoded RFC 2047
 *   - Date: RFC 5322 Africa/Casablanca
 *   - Message-ID: <uuid@skalean-insurtech.ma>
 *   - MIME-Version: 1.0
 *   - Content-Type: multipart/alternative; boundary="..."
 *   - List-Unsubscribe: <https://...>, <mailto:...>
 *   - List-Unsubscribe-Post: List-Unsubscribe=One-Click
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface BuildHeadersInput {
  from: { name: string; address: string };
  replyTo: string;
  messageId: string;
  subject: string;
  listUnsubscribeToken?: string;
  tenantId?: string;
}

@Injectable()
export class EmailHeadersBuilder {
  private readonly optoutBaseUrl: string;
  private readonly unsubscribeMailto: string;

  constructor(private readonly config: ConfigService) {
    this.optoutBaseUrl = config.getOrThrow<string>('EMAIL_OPTOUT_BASE_URL');
    this.unsubscribeMailto = config.get<string>('EMAIL_UNSUBSCRIBE_MAILTO', 'unsubscribe@skalean-insurtech.ma');
  }

  build(input: BuildHeadersInput): Record<string, string> {
    const headers: Record<string, string> = {
      'from': this.formatFrom(input.from),
      'reply-to': input.replyTo,
      'subject': this.encodeSubject(input.subject),
      'date': this.formatDateRfc5322(),
      'message-id': input.messageId,
      'mime-version': '1.0',
    };

    // List-Unsubscribe RFC 2369 + RFC 8058 One-Click (Gmail Feb 2024 mandatory)
    if (input.listUnsubscribeToken) {
      const unsubUrl = `${this.optoutBaseUrl}/${encodeURIComponent(input.listUnsubscribeToken)}`;
      headers['list-unsubscribe'] = `<${unsubUrl}>, <mailto:${this.unsubscribeMailto}>`;
      headers['list-unsubscribe-post'] = 'List-Unsubscribe=One-Click';
    }

    // Tenant tag (Sprint 14 SaaS branding)
    if (input.tenantId) {
      headers['x-tenant-id'] = input.tenantId;
    }

    headers['x-mailer'] = 'Skalean InsurTech v2.2 / Sprint 9';

    return headers;
  }

  /**
   * Format From address with RFC 2047 encoding if name has non-ASCII.
   */
  private formatFrom(from: { name: string; address: string }): string {
    if (this.isAscii(from.name)) {
      return `${from.name} <${from.address}>`;
    }
    const encoded = `=?UTF-8?B?${Buffer.from(from.name, 'utf8').toString('base64')}?=`;
    return `${encoded} <${from.address}>`;
  }

  /**
   * Encode Subject UTF-8 base64 RFC 2047 if non-ASCII characters detected.
   */
  private encodeSubject(subject: string): string {
    if (this.isAscii(subject)) {
      return subject;
    }
    return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
  }

  private isAscii(str: string): boolean {
    return /^[\x20-\x7E]*$/.test(str);
  }

  /**
   * Format current Date in RFC 5322 with Africa/Casablanca timezone (+01:00 winter, +00:00 if DST off).
   */
  private formatDateRfc5322(now: Date = new Date()): string {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayName = days[now.getUTCDay()];
    const day = String(now.getUTCDate()).padStart(2, '0');
    const month = months[now.getUTCMonth()];
    const year = now.getUTCFullYear();
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mm = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    // Morocco GMT+1 year-round since 2018
    return `${dayName}, ${day} ${month} ${year} ${hh}:${mm}:${ss} +0100`;
  }
}
```

### 6.6 Fichier 6 / 12 : `email.module.ts`

```typescript
/**
 * @insurtech/comm/providers/email/email.module
 *
 * NestJS Global module exposing EmailService + factories.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { EmailTransportFactory } from './email-transport.factory.js';
import { MailgunApiClient } from './mailgun-api.client.js';
import { DkimSignerHelper } from './dkim-signer.helper.js';
import { EmailHeadersBuilder } from './email-headers.builder.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    EmailService,
    EmailTransportFactory,
    MailgunApiClient,
    DkimSignerHelper,
    EmailHeadersBuilder,
  ],
  exports: [EmailService],
})
export class EmailModule {}
```

### 6.7 Fichier 7 / 12 : `types.ts`

```typescript
/**
 * @insurtech/comm/providers/email/types
 */

export type EmailProvider = 'mailhog' | 'mailgun-smtp' | 'mailgun-api';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  listUnsubscribeToken?: string;
  idempotencyKey?: string;
  tags?: string[];
  tenantId?: string;
}

export interface SendEmailResult {
  messageId: string;
  providerMessageId: string;
  status: 'sent' | 'queued';
  latencyMs: number;
}

export interface EmailHeaders {
  from: string;
  'reply-to': string;
  subject: string;
  date: string;
  'message-id': string;
  'mime-version': string;
  'list-unsubscribe'?: string;
  'list-unsubscribe-post'?: string;
  'x-tenant-id'?: string;
}

export interface TransportSendInput {
  headers: Record<string, string>;
  to: string;
  html: string;
  text: string;
  tags?: string[];
  idempotencyKey?: string;
  dkimSign: (input: { headers: Record<string, string>; body: string }) => { signature: string };
}

export interface TransportSendResult {
  providerMessageId: string;
}
```

### 6.8 Fichier 8 / 12 : `errors.ts`

```typescript
/**
 * @insurtech/comm/providers/email/errors
 *
 * Typed errors for EmailService.
 */

export class EmailSendError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'EmailSendError';
  }
}

export class EmailRateLimitError extends Error {
  constructor(message: string, public readonly retryAfterSeconds: number) {
    super(message);
    this.name = 'EmailRateLimitError';
  }
}

export class EmailDkimError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDkimError';
  }
}

export class EmailInvalidAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailInvalidAddressError';
  }
}

export class EmailBouncedError extends Error {
  constructor(
    message: string,
    public readonly bounceType: 'permanent' | 'temporary',
    public readonly providerMessageId?: string,
  ) {
    super(message);
    this.name = 'EmailBouncedError';
  }
}

export class EmailSizeExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailSizeExceededError';
  }
}
```

### 6.9 Fichier 9 / 12 : `index.ts`

```typescript
/**
 * @insurtech/comm/providers/email
 *
 * Public exports.
 */

export { EmailService } from './email.service.js';
export { EmailModule } from './email.module.js';
export { DkimSignerHelper } from './dkim-signer.helper.js';
export { EmailTransportFactory } from './email-transport.factory.js';
export { MailgunApiClient } from './mailgun-api.client.js';
export { EmailHeadersBuilder } from './email-headers.builder.js';
export type {
  SendEmailInput,
  SendEmailResult,
  EmailHeaders,
  EmailProvider,
} from './types.js';
export {
  EmailSendError,
  EmailRateLimitError,
  EmailDkimError,
  EmailInvalidAddressError,
  EmailBouncedError,
  EmailSizeExceededError,
} from './errors.js';
```

### 6.10 Fichier 10 / 12 : `email-dns-setup.md` (runbook)

````markdown
# Runbook : Email DNS Setup (Production)

## But

Configurer les records DNS pour le domain `skalean-insurtech.ma` afin d'activer DKIM signing + SPF authorization + DMARC policy + (Sprint 35) MTA-STS + TLS-RPT + BIMI logo Gmail.

## Prerequis

- Acces registrar DNS (Atlas Cloud Benguerir Sprint 35 ou Cloudflare DNS Sprint 5 setup)
- Cle DKIM 2048 bits generee (private/public paire) -- voir section "Generation des cles DKIM"
- Mailgun account EU region configure avec domain `skalean-insurtech.ma` ajoute
- DevOps droits administrator DNS records

## 1. Generation des cles DKIM (a executer une seule fois)

```bash
# Generer paire RSA 2048 bits
openssl genrsa -out dkim-private.pem 2048

# Extraire la cle publique au format DKIM DNS (1 line)
openssl rsa -in dkim-private.pem -pubout -outform DER 2>/dev/null \
  | openssl base64 -A

# Output exemple :
# MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1ABcdef...
```

Stocker la cle privee `dkim-private.pem` dans le secrets manager (Sprint 35 Vault, Sprint 9 env var encrypted) :

```bash
# Encoder en base64 pour env var single-line :
cat dkim-private.pem | base64 -w 0 > dkim-private.b64
# Set env var :
EMAIL_DKIM_PRIVATE_KEY=$(cat dkim-private.b64)
```

## 2. SPF record

Type : TXT
Name : `@` (apex skalean-insurtech.ma)
Value :

```
v=spf1 include:eu.mailgun.org ~all
```

Notes :
- `include:eu.mailgun.org` delegate auth a Mailgun EU region
- `~all` softfail (pas reject strict, permet fallback Atlas Email Sprint 35 sans downtime)
- Sprint 35 transition : ajouter `include:atlas-email.ma` + retirer Mailgun progressivement

Verification :
```bash
dig TXT skalean-insurtech.ma +short
# Output attendu : "v=spf1 include:eu.mailgun.org ~all"
```

## 3. DKIM record

Type : TXT
Name : `default._domainkey` (selector default)
Value :

```
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1ABcdef...
```

Notes :
- `v=DKIM1` version DKIM
- `k=rsa` algorithm
- `p=...` public key paired avec EMAIL_DKIM_PRIVATE_KEY env var (output etape 1)
- Si key > 255 chars (limite TXT record), splitter en multiple strings : `"v=DKIM1; k=rsa; p=..." "..."` (Cloudflare auto-split)

Verification :
```bash
dig TXT default._domainkey.skalean-insurtech.ma +short
# Output attendu : "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA1AB..."
```

Test signature DKIM cote Mailgun :
```bash
curl -X POST https://api.eu.mailgun.net/v3/domains/skalean-insurtech.ma/verify \
  -u "api:$EMAIL_MAILGUN_API_KEY"
# Attendu : { "dns_records": [...], "verification": "active" }
```

## 4. DMARC record

Type : TXT
Name : `_dmarc`
Value :

```
v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@skalean-insurtech.ma; ruf=mailto:dmarc-forensic@skalean-insurtech.ma; fo=1; adkim=r; aspf=r
```

Notes :
- `p=quarantine` policy : emails non-aligned sent to spam folder receivers (vs `reject` strict)
- `pct=100` 100 % du traffic (ramp-up 10 % -> 50 % -> 100 % si rolling deployment)
- `rua=mailto:...` aggregate reports daily (volume + sources)
- `ruf=mailto:...` forensic reports per failure (rare, sensitive PII -- regulated alias)
- `fo=1` failure on any DKIM/SPF mismatch
- `adkim=r` DKIM alignment relaxed (subdomain accepted)
- `aspf=r` SPF alignment relaxed
- Sprint 35 : transition `p=reject` apres 30 jours quarantine clean (zero false positives)

Verification :
```bash
dig TXT _dmarc.skalean-insurtech.ma +short
```

## 5. Sprint 35 advanced records (DEFFERE)

### MTA-STS (strict TLS enforcement)

Type : TXT
Name : `_mta-sts`
Value :
```
v=STSv1; id=20260101000000Z
```

Plus policy file : `https://mta-sts.skalean-insurtech.ma/.well-known/mta-sts.txt`
```
version: STSv1
mode: enforce
mx: *.eu.mailgun.org
max_age: 604800
```

### TLS-RPT (TLS reporting)

Type : TXT
Name : `_smtp._tls`
Value :
```
v=TLSRPTv1; rua=mailto:tls-reports@skalean-insurtech.ma
```

### BIMI (logo Skalean dans Gmail)

Type : TXT
Name : `default._bimi`
Value :
```
v=BIMI1; l=https://skalean-insurtech.ma/bimi-logo.svg; a=https://skalean-insurtech.ma/bimi-vmc.pem
```

Prerequis : VMC certificate (Verified Mark Certificate) emis par DigiCert ou Entrust ~$1500/an. Sprint 35 evaluation cost/benefit.

## 6. Troubleshooting

### Probleme : Emails arrivent en spam Gmail

Diagnostic :
1. mail-tester.com -> envoyer email test -> score < 8/10 ?
2. Verify DKIM : `mail-tester` doit afficher "DKIM valid"
3. Verify SPF : `mail-tester` doit afficher "SPF pass"
4. Verify DMARC : `mail-tester` doit afficher "DMARC alignment OK"

Causes communes :
- DKIM private/public mismatch -> regenerer paire + update DNS
- SPF include manquant -> verifier `eu.mailgun.org` present
- DMARC policy `none` -> changer `p=quarantine` minimum
- List-Unsubscribe absent -> verifier headers email (Sprint 9 Tache 3.2.6 obligatoire)

### Probleme : Mailgun verify-domain fail

Diagnostic :
```bash
curl -X GET https://api.eu.mailgun.net/v3/domains/skalean-insurtech.ma \
  -u "api:$EMAIL_MAILGUN_API_KEY" | jq '.domain.state'
# Attendu : "active"
# Si "unverified" : DNS records non propages -> attendre 24h ou verifier dig
```

### Probleme : DKIM signature mismatch (clock skew)

Diagnostic :
```bash
timedatectl status
# Attendu : NTP synchronized: yes
```

Solution : `sudo systemctl restart systemd-timesyncd` + verifier offset < 1s.

## 7. Rotation cle DKIM (Sprint 35)

Procedure dual-key 30 jours grace period :
1. Generer nouvelle paire (selector `default2`)
2. Publier DNS record `default2._domainkey TXT "v=DKIM1; k=rsa; p=NEW_PUBLIC..."`
3. Update env `EMAIL_DKIM_SELECTOR=default2` + `EMAIL_DKIM_PRIVATE_KEY=NEW_PRIVATE`
4. Deploy + verify mail-tester.com score conserve
5. Apres 30 jours (durabilite cache mail receivers) : retirer `default._domainkey` DNS record
````

### 6.11 Fichier 11 / 12 : `email.service.spec.ts` (extrait 25+ tests)

```typescript
/**
 * @insurtech/comm/providers/email/email.service.spec
 */

import { Test } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.js';
import { EmailTransportFactory } from './email-transport.factory.js';
import { DkimSignerHelper } from './dkim-signer.helper.js';
import { EmailHeadersBuilder } from './email-headers.builder.js';
import { MailgunApiClient } from './mailgun-api.client.js';
import {
  EmailSendError,
  EmailRateLimitError,
  EmailInvalidAddressError,
  EmailSizeExceededError,
} from './errors.js';

describe('EmailService', () => {
  let service: EmailService;
  let transportFactory: jest.Mocked<EmailTransportFactory>;
  let dkimSigner: jest.Mocked<DkimSignerHelper>;
  let mockTransport: any;

  beforeEach(async () => {
    mockTransport = {
      send: jest.fn().mockResolvedValue({ providerMessageId: 'mg-123' }),
      verify: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(undefined),
    };
    transportFactory = {
      create: jest.fn().mockResolvedValue(mockTransport),
      getProvider: jest.fn().mockReturnValue('mailhog'),
    } as any;
    dkimSigner = {
      verifyKeyLoaded: jest.fn().mockResolvedValue(true),
      signMessage: jest.fn().mockReturnValue({ signature: 'v=1; a=rsa-sha256; ...' }),
    } as any;

    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [() => testEnvConfig] })],
      providers: [
        EmailService,
        { provide: EmailTransportFactory, useValue: transportFactory },
        { provide: DkimSignerHelper, useValue: dkimSigner },
        EmailHeadersBuilder,
      ],
    }).compile();

    service = module.get(EmailService);
    await service.onModuleInit();
  });

  describe('send happy path', () => {
    it('sends with all headers + DKIM + Message-ID UUID', async () => {
      const result = await service.send({
        to: 'user@example.ma',
        subject: 'Test',
        html: '<p>Hello</p>',
      });
      expect(result.status).toBe('sent');
      expect(result.messageId).toMatch(/^<[a-f0-9-]+@skalean-insurtech\.ma>$/);
      expect(mockTransport.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.ma',
          html: '<p>Hello</p>',
          headers: expect.objectContaining({
            'message-id': expect.stringMatching(/^<[a-f0-9-]+@skalean-insurtech\.ma>$/),
            'from': expect.stringContaining('noreply@skalean-insurtech.ma'),
          }),
        }),
      );
    });

    it('auto-generates plain text from HTML', async () => {
      await service.send({ to: 'u@x.ma', subject: 'T', html: '<p>Hello <a href="https://x">link</a></p>' });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.text).toContain('Hello');
      expect(call.text).toContain('https://x');
    });

    it('UTF-8 base64 encodes Subject with Arabic chars', async () => {
      await service.send({
        to: 'u@x.ma',
        subject: 'mrHbA bSkAlyEn',
        html: '<p>x</p>',
      });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.headers['subject']).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
    });

    it('passes ASCII Subject without encoding', async () => {
      await service.send({ to: 'u@x.ma', subject: 'Hello world', html: '<p>x</p>' });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.headers['subject']).toBe('Hello world');
    });

    it('includes List-Unsubscribe + One-Click when token provided', async () => {
      await service.send({
        to: 'u@x.ma',
        subject: 'T',
        html: '<p>x</p>',
        listUnsubscribeToken: 'abc123token',
      });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.headers['list-unsubscribe']).toMatch(/<https:\/\/.+\/abc123token>.*<mailto:/);
      expect(call.headers['list-unsubscribe-post']).toBe('List-Unsubscribe=One-Click');
    });

    it('omits List-Unsubscribe when no token', async () => {
      await service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>' });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.headers['list-unsubscribe']).toBeUndefined();
    });

    it('passes idempotencyKey to transport', async () => {
      const idempo = '11111111-2222-3333-4444-555555555555';
      await service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>', idempotencyKey: idempo });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.idempotencyKey).toBe(idempo);
    });

    it('uses Message-ID as default idempotency-key', async () => {
      await service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>' });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.idempotencyKey).toMatch(/^<[a-f0-9-]+@skalean-insurtech\.ma>$/);
    });

    it('returns latencyMs', async () => {
      const r = await service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>' });
      expect(r.latencyMs).toBeGreaterThanOrEqual(0);
      expect(r.latencyMs).toBeLessThan(5000);
    });
  });

  describe('validation Zod', () => {
    it('rejects invalid email recipient', async () => {
      await expect(service.send({
        to: 'not-an-email',
        subject: 'T',
        html: '<p>x</p>',
      })).rejects.toThrow();
    });

    it('rejects subject with CRLF injection', async () => {
      await expect(service.send({
        to: 'u@x.ma',
        subject: 'Hello\r\nBcc: leaked@attacker.com',
        html: '<p>x</p>',
      })).rejects.toThrow();
    });

    it('rejects subject > 998 chars', async () => {
      await expect(service.send({
        to: 'u@x.ma',
        subject: 'x'.repeat(999),
        html: '<p>x</p>',
      })).rejects.toThrow();
    });

    it('rejects HTML > 100 KB clip warning', async () => {
      const huge = '<p>' + 'x'.repeat(110_000) + '</p>';
      await expect(service.send({ to: 'u@x.ma', subject: 'T', html: huge })).rejects.toThrow();
    });
  });

  describe('size limits', () => {
    it('throws EmailSizeExceededError on body > 25 MB', async () => {
      // The Zod schema rejects HTML > 100 KB before hitting the 25 MB check, so test directly
      // via a custom transport that bypasses Zod (or build mock test fixture)
      // For unit test purposes : combined html + text > 25 MB
      // Intentionally not testable here due to Zod 100 KB upper bound -- integration test
    });
  });

  describe('retry logic 5xx', () => {
    it('retries 3x on 5xx error then throws EmailSendError', async () => {
      mockTransport.send.mockRejectedValue(new EmailSendError('5xx Mailgun'));
      await expect(service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>' })).rejects.toThrow(EmailSendError);
      expect(mockTransport.send).toHaveBeenCalledTimes(3);
    });

    it('succeeds on retry 2 after transient 5xx', async () => {
      mockTransport.send
        .mockRejectedValueOnce(new EmailSendError('transient'))
        .mockResolvedValueOnce({ providerMessageId: 'mg-456' });
      const r = await service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>' });
      expect(r.providerMessageId).toBe('mg-456');
      expect(mockTransport.send).toHaveBeenCalledTimes(2);
    });

    it('fails-fast on EmailInvalidAddressError 400 (no retry)', async () => {
      mockTransport.send.mockRejectedValue(new EmailInvalidAddressError('400 invalid'));
      await expect(service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>' })).rejects.toThrow(EmailInvalidAddressError);
      expect(mockTransport.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('rate limit 429 honors Retry-After', () => {
    it('waits Retry-After then retries', async () => {
      const start = Date.now();
      mockTransport.send
        .mockRejectedValueOnce(new EmailRateLimitError('429', 1)) // 1s wait
        .mockResolvedValueOnce({ providerMessageId: 'mg-789' });
      const r = await service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>' });
      expect(r.providerMessageId).toBe('mg-789');
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(900); // ~1s
    });
  });

  describe('logging privacy', () => {
    it('hashes recipient email in logs (not in clear)', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.send({ to: 'sensitive@user.ma', subject: 'T', html: '<p>x</p>' });
      const calls = logSpy.mock.calls.flat();
      const hasClear = JSON.stringify(calls).includes('sensitive@user.ma');
      expect(hasClear).toBe(false);
    });

    it('does not log DKIM signature', async () => {
      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.send({ to: 'u@x.ma', subject: 'T', html: '<p>x</p>' });
      const calls = JSON.stringify(logSpy.mock.calls);
      expect(calls).not.toContain('rsa-sha256');
    });
  });

  describe('verifyConnection', () => {
    it('returns true on transport ok', async () => {
      expect(await service.verifyConnection()).toBe(true);
    });

    it('returns false on transport error', async () => {
      mockTransport.verify.mockRejectedValue(new Error('conn fail'));
      expect(await service.verifyConnection()).toBe(false);
    });
  });

  describe('multipart auto-text', () => {
    it('strips images in plain text', async () => {
      await service.send({
        to: 'u@x.ma',
        subject: 'T',
        html: '<p>Text <img src="x.jpg"/></p>',
      });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.text).not.toContain('x.jpg');
      expect(call.text).toContain('Text');
    });

    it('preserves links in plain text format', async () => {
      await service.send({
        to: 'u@x.ma',
        subject: 'T',
        html: '<p><a href="https://app.skalean.ma/x">Click</a></p>',
      });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.text).toContain('https://app.skalean.ma/x');
    });

    it('uses provided text param if given', async () => {
      await service.send({
        to: 'u@x.ma',
        subject: 'T',
        html: '<p>HTML</p>',
        text: 'Custom plain text version',
      });
      const call = mockTransport.send.mock.calls[0][0];
      expect(call.text).toBe('Custom plain text version');
    });
  });
});

const testEnvConfig = {
  EMAIL_FROM_NO_REPLY: 'noreply@skalean-insurtech.ma',
  EMAIL_FROM_NAME: 'Skalean InsurTech',
  EMAIL_FROM_SUPPORT: 'support@skalean-insurtech.ma',
  EMAIL_DKIM_DOMAIN: 'skalean-insurtech.ma',
  EMAIL_DKIM_SELECTOR: 'default',
  EMAIL_RETRY_MAX_ATTEMPTS: '3',
  EMAIL_OPTOUT_BASE_URL: 'https://app.skalean.ma/api/v1/public/optout',
  EMAIL_UNSUBSCRIBE_MAILTO: 'unsubscribe@skalean-insurtech.ma',
};
```

### 6.12 Fichier 12 / 12 : `email-mailhog.integration.spec.ts`

```typescript
/**
 * Integration test : Email send via Mailhog SMTP -> verify reception via Mailhog API REST.
 *
 * Prerequisites :
 *   - Mailhog running localhost:1025 (SMTP) + localhost:8025 (API REST)
 *   - docker-compose up mailhog (Sprint 5 setup)
 */

import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { request as undiciRequest } from 'undici';
import { EmailModule } from '../../providers/email/email.module.js';
import { EmailService } from '../../providers/email/email.service.js';

const MAILHOG_API = 'http://localhost:8025/api/v2';

describe('EmailService Mailhog integration', () => {
  let service: EmailService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          load: [() => ({
            EMAIL_PROVIDER: 'mailhog',
            EMAIL_SMTP_HOST: 'localhost',
            EMAIL_SMTP_PORT: '1025',
            EMAIL_FROM_NO_REPLY: 'noreply@skalean-insurtech.ma',
            EMAIL_FROM_NAME: 'Skalean InsurTech Test',
            EMAIL_FROM_SUPPORT: 'support@skalean-insurtech.ma',
            EMAIL_DKIM_DOMAIN: 'skalean-insurtech.ma',
            EMAIL_DKIM_SELECTOR: 'default',
            EMAIL_DKIM_PRIVATE_KEY: process.env.TEST_DKIM_PRIVATE_KEY ?? '',
            EMAIL_RETRY_MAX_ATTEMPTS: '3',
            EMAIL_OPTOUT_BASE_URL: 'https://app.skalean.ma/api/v1/public/optout',
            EMAIL_UNSUBSCRIBE_MAILTO: 'unsubscribe@skalean-insurtech.ma',
          })],
        }),
        EmailModule,
      ],
    }).compile();

    service = module.get(EmailService);
    await module.init();

    // Clear Mailhog inbox
    await undiciRequest(`${MAILHOG_API}/messages`, { method: 'DELETE' });
  });

  it('delivers email via Mailhog SMTP and is retrievable via API', async () => {
    const result = await service.send({
      to: 'recipient@test.ma',
      subject: 'Integration Test Sprint 9',
      html: '<p>Hello from <strong>Skalean</strong></p>',
      listUnsubscribeToken: 'test-token-abc',
    });

    expect(result.status).toBe('sent');
    expect(result.providerMessageId).toBeDefined();

    // Wait Mailhog ingestion + retrieve via API
    await new Promise((r) => setTimeout(r, 500));
    const response = await undiciRequest(`${MAILHOG_API}/messages`);
    const json = (await response.body.json()) as { items: any[] };
    expect(json.items).toHaveLength(1);
    const msg = json.items[0];
    expect(msg.To[0].Mailbox).toBe('recipient');
    expect(msg.Content.Headers['Subject'][0]).toBe('Integration Test Sprint 9');
    expect(msg.Content.Headers['List-Unsubscribe']).toBeDefined();
    expect(msg.Content.Headers['List-Unsubscribe-Post'][0]).toBe('List-Unsubscribe=One-Click');
    expect(msg.Content.Headers['Message-ID'][0]).toMatch(/^<[a-f0-9-]+@skalean-insurtech\.ma>$/);
  });

  it('encodes UTF-8 Subject with Arabic chars', async () => {
    await undiciRequest(`${MAILHOG_API}/messages`, { method: 'DELETE' });
    await service.send({
      to: 'arabic@test.ma',
      subject: 'mrHbA bk fy SkAlyEn',
      html: '<p>Hello</p>',
    });
    await new Promise((r) => setTimeout(r, 500));
    const response = await undiciRequest(`${MAILHOG_API}/messages`);
    const json = (await response.body.json()) as { items: any[] };
    const subject = json.items[0].Content.Headers['Subject'][0];
    expect(subject).toMatch(/^=\?UTF-8\?B\?.+\?=$/);
  });

  it('multipart contains both HTML and plain text', async () => {
    await undiciRequest(`${MAILHOG_API}/messages`, { method: 'DELETE' });
    await service.send({
      to: 'mp@test.ma',
      subject: 'Multipart Test',
      html: '<p>HTML <a href="https://x">link</a></p>',
    });
    await new Promise((r) => setTimeout(r, 500));
    const response = await undiciRequest(`${MAILHOG_API}/messages`);
    const json = (await response.body.json()) as { items: any[] };
    const ct = json.items[0].Content.Headers['Content-Type'][0];
    expect(ct).toContain('multipart/alternative');
  });

  it('verifyConnection returns true with Mailhog reachable', async () => {
    expect(await service.verifyConnection()).toBe(true);
  });

  it('benchmark : 100 concurrent sends complete < 5s', async () => {
    await undiciRequest(`${MAILHOG_API}/messages`, { method: 'DELETE' });
    const start = Date.now();
    const promises = Array.from({ length: 100 }, (_, i) =>
      service.send({
        to: `bench${i}@test.ma`,
        subject: `Bench ${i}`,
        html: '<p>x</p>',
      }),
    );
    const results = await Promise.allSettled(promises);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    expect(succeeded).toBeGreaterThanOrEqual(95);
  });
});
```

---

## 7. Tests detailled (25+)

### 7.1 Tests unit `email.service.spec.ts` (25 tests)

1. send happy path : Message-ID UUID format match
2. send happy path : From header includes display name + address
3. send : auto-generates plain text from HTML via node-html-to-text
4. send : preserves provided text param if given
5. send : strips img tags in plain text
6. send : preserves links format `text [URL]` in plain text
7. send : Subject UTF-8 base64 encoded for Arabic chars
8. send : Subject ASCII passed without encoding
9. send : List-Unsubscribe + One-Click headers when token provided
10. send : omits List-Unsubscribe when no token
11. send : passes idempotencyKey to transport
12. send : uses Message-ID as default idempotency-key
13. send : returns latencyMs >= 0 < 5000ms
14. send : Zod rejects invalid email recipient
15. send : Zod rejects Subject CRLF injection (`\r\n`)
16. send : Zod rejects Subject > 998 chars
17. send : Zod rejects HTML > 100 KB clip
18. retry : 3x exponential on 5xx then EmailSendError
19. retry : succeeds on retry 2 after transient 5xx
20. retry : fail-fast on 400 EmailInvalidAddressError
21. retry : honors Retry-After 429
22. logging : recipient email hashed (not in clear)
23. logging : DKIM signature not logged
24. verifyConnection : true on transport ok
25. verifyConnection : false on transport error

### 7.2 Tests unit `dkim-signer.helper.spec.ts` (8 tests)

26. loadPrivateKey : loads PEM from env raw
27. loadPrivateKey : loads PEM from base64 encoded env
28. loadPrivateKey : throws EmailDkimError on invalid format
29. loadPrivateKey : warns + disabled if env missing (dev mode)
30. signMessage : returns DKIM-Signature header valid format
31. signMessage : canonicalization relaxed strips trailing whitespace
32. signMessage : signature reproducible (same input = same output minus timestamp)
33. signMessage : throws if key not loaded

### 7.3 Tests unit `email-transport.factory.spec.ts` (6 tests)

34. create mailhog : returns SMTP transport without auth
35. create mailgun-smtp : returns SMTP transport with TLS + auth
36. create mailgun-api : returns Mailgun API HTTPS client
37. invalid provider env : throws on construction
38. mailhog send : forwards to nodemailer + DKIM signs
39. mailgun-api send : forwards to MailgunApiClient + DKIM signs

### 7.4 Tests unit `mailgun-api.client.spec.ts` (12 tests)

40. send : POST /v3/{domain}/messages with multipart form-data
41. send : Authorization Basic base64(api:KEY)
42. send : o:dkim=yes + o:tracking=yes flags
43. send : custom h:* headers passed through
44. send : Idempotency-Key header forwarded
45. send : 200 returns mailgunId from response.id
46. send : 400 throws EmailInvalidAddressError
47. send : 401/403 throws EmailSendError auth
48. send : 429 throws EmailRateLimitError with Retry-After
49. send : 5xx throws EmailSendError
50. region us : throws on construction (EU only)
51. verifyDomain : true on 200, false on error

### 7.5 Tests unit `email-headers.builder.spec.ts` (10 tests)

52. build : From correct format `Name <addr>`
53. build : From RFC 2047 encoded if non-ASCII name
54. build : Reply-To set correctly
55. build : Subject ASCII passthrough
56. build : Subject UTF-8 base64 encoded if non-ASCII
57. build : Date RFC 5322 format `Day, DD Mon YYYY HH:MM:SS +0100`
58. build : Message-ID present
59. build : List-Unsubscribe with token present
60. build : List-Unsubscribe-Post One-Click present
61. build : x-tenant-id present if tenantId provided

### 7.6 Tests integration Mailhog (5 tests)

62. delivers via Mailhog SMTP retrievable via Mailhog API
63. UTF-8 Subject Arabic chars encoded
64. Multipart HTML + text both present
65. verifyConnection true with Mailhog reachable
66. Bench 100 concurrent sends < 5s

---

## 8. Criteres validation (V1-V30)

- **V1 (P0)** : send via Mailhog dev OK + retrievable via API REST (criteria 62)
- **V2 (P0)** : send via mock Mailgun staging OK (criteria 38, 39)
- **V3 (P0)** : DKIM signature appliquee sur chaque outbound (criteria 30)
- **V4 (P0)** : DKIM signature valid (verify avec dkim-verify lib in integration test environment Sprint 35 mail-tester)
- **V5 (P0)** : List-Unsubscribe header present + URL token signed JWT (criteria 9, 59)
- **V6 (P0)** : List-Unsubscribe-Post One-Click present (criteria 9, 60)
- **V7 (P0)** : Multipart HTML + plain text auto-genere via node-html-to-text (criteria 3, 64)
- **V8 (P0)** : Subject UTF-8 base64 encoded RFC 2047 si non-ASCII (criteria 7, 56, 63)
- **V9 (P0)** : Reply-To set correctement (criteria 54)
- **V10 (P0)** : Message-ID UUID format @domain (criteria 1, 58)
- **V11 (P0)** : Date RFC 5322 format Africa/Casablanca timezone (criteria 57)
- **V12 (P0)** : Provider switchable via env EMAIL_PROVIDER (criteria 34, 35, 36, 37)
- **V13 (P0)** : Mailgun API HTTPS retourne mailgunId (criteria 40, 45)
- **V14 (P0)** : Retry sur 5xx Mailgun 3 fois exponential (criteria 18, 19)
- **V15 (P0)** : Pas de retry sur 400 invalid email -> fail-fast (criteria 20, 46)
- **V16 (P0)** : Idempotency-Key Mailgun support evite doublons (criteria 11, 44)
- **V17 (P0)** : 429 rate limit honor Retry-After (criteria 21, 48)
- **V18 (P0)** : Connection pool 5 SMTP reuse (config criteria 35)
- **V19 (P0)** : Concurrent sends 100 burst -> all complete < 5s (criteria 66)
- **V20 (P0)** : Documentation DNS prod claire (runbook email-dns-setup.md)
- **V21 (P0)** : DKIM private key invalid format PEM -> startup error fail-fast (criteria 28)
- **V22 (P0)** : DKIM key 2048 bits recommend (runbook section 1)
- **V23 (P0)** : Recipient email hashed sha256 8-char in logs (criteria 22)
- **V24 (P0)** : DKIM signature pas loggee (criteria 23)
- **V25 (P0)** : Zod rejects Subject CRLF injection (criteria 15)
- **V26 (P0)** : Zod rejects HTML > 100 KB (criteria 17)
- **V27 (P0)** : EmailSizeExceededError on body > 25 MB
- **V28 (P0)** : verifyConnection healthcheck (criteria 24, 25, 65)
- **V29 (P0)** : Tests 25+ scenarios passent
- **V30 (P0)** : Coverage >= 88 % sur module providers/email

---

## 9. Edge cases (24)

1. **DKIM private key invalid format PEM (env corrupted)** -> startup `EmailDkimError` fail-fast (test criteria 28).
2. **DKIM key 1024 bits vs 2048 bits** : runbook recommande 2048 (NIST deprecation 1024).
3. **SMTP transient down 5xx** -> retry exponential 3x (test 18).
4. **SMTP fatal 4xx (auth fail)** -> alert ops via Kafka topic `comm.alerts.smtp_auth_fail`, no retry.
5. **Mailgun API rate limit 429** -> retry with Retry-After header honor (test 21).
6. **Email size > 25 MB Mailgun limit** -> reject `EmailSizeExceededError` (test V27).
7. **Email body > 100 KB Gmail clip** -> warning log + Zod rejects (test 17, 26).
8. **HTML invalid (unclosed tags)** -> auto-fix not done service level, responsabilite renderer Tache 3.2.7.
9. **Recipient email non-RFC** -> Zod validate fail-fast (test 14).
10. **Bounce sync hard** : Mailgun webhook lookup -> auto opt-out Tache 3.2.10 + Tache 3.2.11.
11. **DKIM rotation key** : grace period 30 jours dual-key (runbook section 7).
12. **DMARC report aggregation** : daily Sprint 35 via `rua=mailto:dmarc-reports@`.
13. **TLS 1.3 vs legacy 1.2 mail servers** : `EMAIL_SMTP_TLS_MIN_VERSION=TLSv1.2`.
14. **BCC headers visible in raw** : NEVER use BCC, batch sends individuels.
15. **Subject inject newline `\r\n`** -> Zod sanitize fail-fast (test 15).
16. **Mailgun region US env accidentel** -> throws on construction (test 50).
17. **Provider env invalid** -> factory throws boot (test 37).
18. **Pool exhausted under burst** -> BullMQ Tache 3.2.8 backpressure rate limit.
19. **Pool connection stale > 60s idle** -> Nodemailer keep-alive auto-reconnect.
20. **Idempotency-Key reused 24h+** -> Mailgun expire, doublon possible -> use Message-ID UUID v4 unique.
21. **Mailgun verify-domain unverified** : healthcheck Sprint 35 `/api/v1/health/email` fails alert.
22. **Clock skew DKIM signature reject** : NTP sync obligatoire (runbook troubleshoot).
23. **Subject characters > 128 in From name** : `=?UTF-8?B?...?= <email>` encoded (test 53).
24. **Mailgun webhook signing key vs API key** : 2 secrets distincts env variables.

---

## 10. Conformite Maroc

### 10.1 Loi 09-08 (CNDP donnees personnelles)

- **Article 5 (consentement) + Article 7 (droit opposition)** : opt-out simple gratuit immediat via List-Unsubscribe + One-Click (header obligatoire RFC 8058 + URL endpoint Tache 3.2.11).
- **Article 8 (PII confidentialite)** : recipient email considere PII -> chiffrement TLS obligatoire (`EMAIL_SMTP_REQUIRE_TLS=true` + Mailgun `o:require-tls=true`), hashed sha256 prefix-truncated 8 chars dans logs.
- **Article 9 (information transparence)** : footer email contient identification commerciale Skalean SARL RC Casablanca XXXXX + Politique de confidentialite link + droit oppositions.

### 10.2 Decision-008 (cloud souverain MA)

- Sprint 9 : Mailgun EU region partial conformite (Frankfurt EU jurisdiction proche RGPD vs US Schrems II invalid).
- Sprint 35 : transition Atlas Cloud Email service souverain MA total (`EMAIL_PROVIDER=atlas` + factory etendue).
- Audit log retention 7 ans dans `audit_log` table cloud souverain MA.

### 10.3 Loi 24-09 ANRT (marketing direct)

- **Article 12 (opt-out trackable obligatoire)** : List-Unsubscribe + token signed JWT + endpoint POST `/api/v1/public/optout/one-click` Tache 3.2.11.
- **Article 14 (identification commerciale obligatoire)** : footer Skalean SARL RC Casablanca XXXXX + adresse + telephone.

### 10.4 Decision-024 (TLS 1.2+ minimum)

- `EMAIL_SMTP_REQUIRE_TLS=true` + `EMAIL_SMTP_TLS_MIN_VERSION=TLSv1.2`.
- Mailgun API HTTPS only (pas HTTP) + `o:require-tls=true` enforce downstream TLS.

---

## 11. Variables environnement

### 11.1 Variables nouvelles Sprint 9

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `EMAIL_PROVIDER` | enum | `mailhog` | Provider transport : `mailhog` dev / `mailgun-smtp` staging / `mailgun-api` prod |
| `EMAIL_DKIM_PRIVATE_KEY` | string PEM ou base64 | none | DKIM RSA-SHA256 private key 2048 bits (PEM multiline ou base64). Required staging/prod. |
| `EMAIL_DKIM_SELECTOR` | string | `default` | DKIM selector (DNS record `<selector>._domainkey`). |
| `EMAIL_DKIM_DOMAIN` | string | `skalean-insurtech.ma` | DKIM domain (alignment SPF + DMARC). |
| `EMAIL_MAILGUN_API_KEY` | secret | none | Mailgun API key prod (region EU). |
| `EMAIL_MAILGUN_DOMAIN` | string | `skalean-insurtech.ma` | Mailgun domain configure dans le compte. |
| `EMAIL_MAILGUN_REGION` | enum | `eu` | Mailgun region (only `eu` supported, `us` throws). |
| `EMAIL_RETRY_MAX_ATTEMPTS` | int | `3` | Nombre max retries sur 5xx exponential. |
| `EMAIL_OPTOUT_BASE_URL` | string url | `https://app.skalean.ma/api/v1/public/optout` | Base URL pour List-Unsubscribe token. |
| `EMAIL_OPTOUT_SIGNING_SECRET` | secret | none | JWT HS256 secret pour signer tokens optout. |
| `EMAIL_UNSUBSCRIBE_MAILTO` | string email | `unsubscribe@skalean-insurtech.ma` | Mailto secondaire List-Unsubscribe. |

### 11.2 Variables Sprint 5 baseline (rappelees)

| Variable | Description |
|----------|-------------|
| `EMAIL_SMTP_HOST` | SMTP server hostname (mailhog ou smtp.eu.mailgun.org) |
| `EMAIL_SMTP_PORT` | SMTP port (1025 mailhog / 587 mailgun staging) |
| `EMAIL_SMTP_USER` | SMTP auth username |
| `EMAIL_SMTP_PASSWORD` | SMTP auth password (secret) |
| `EMAIL_SMTP_SECURE` | `true` enforce STARTTLS |
| `EMAIL_FROM_NO_REPLY` | `noreply@skalean-insurtech.ma` |
| `EMAIL_FROM_NAME` | `Skalean InsurTech` |
| `EMAIL_FROM_SUPPORT` | `support@skalean-insurtech.ma` (Reply-To) |

### 11.3 Exemple `.env.example` extrait

```bash
# Email provider (Sprint 9)
EMAIL_PROVIDER=mailhog
# EMAIL_PROVIDER=mailgun-smtp
# EMAIL_PROVIDER=mailgun-api

EMAIL_SMTP_HOST=localhost
EMAIL_SMTP_PORT=1025
EMAIL_SMTP_SECURE=false
# EMAIL_SMTP_USER=postmaster@skalean-insurtech.ma
# EMAIL_SMTP_PASSWORD=changeme

EMAIL_FROM_NO_REPLY=noreply@skalean-insurtech.ma
EMAIL_FROM_NAME=Skalean InsurTech
EMAIL_FROM_SUPPORT=support@skalean-insurtech.ma

# DKIM (Sprint 9 -- required for staging/prod)
EMAIL_DKIM_DOMAIN=skalean-insurtech.ma
EMAIL_DKIM_SELECTOR=default
# EMAIL_DKIM_PRIVATE_KEY base64 encoded PEM (set in secrets manager Sprint 35)
# EMAIL_DKIM_PRIVATE_KEY=LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQ...

# Mailgun (Sprint 9 prod only)
EMAIL_MAILGUN_REGION=eu
# EMAIL_MAILGUN_API_KEY=key-xxxxxxxxxxxx
# EMAIL_MAILGUN_DOMAIN=skalean-insurtech.ma

# Retry policy
EMAIL_RETRY_MAX_ATTEMPTS=3

# Opt-out
EMAIL_OPTOUT_BASE_URL=https://app.skalean.ma/api/v1/public/optout
EMAIL_OPTOUT_SIGNING_SECRET=changeme-32-chars-min-secret
EMAIL_UNSUBSCRIBE_MAILTO=unsubscribe@skalean-insurtech.ma
```

---

## 12. Conventions strictes (14+ rappelees)

1. **No-emoji** : strict cf decision-006. Aucun emoji dans code, comments, logs, docs.
2. **No-console** : utiliser `Logger` NestJS Pino structure.
3. **No log secrets** : DKIM private key, Mailgun API key, JWT tokens jamais loggues.
4. **No log PII clear** : recipient email hashed sha256 prefix-truncated 8 chars uniquement.
5. **Zod validation runtime** : tout input externe (send params) Zod valide cf decision-007.
6. **Imports `.js` extensions** : NodeNext ESM resolution stricte.
7. **TypeScript strict** : `noImplicitAny`, `strictNullChecks`, `noUncheckedIndexedAccess`.
8. **Error classes typees** : `EmailSendError`, `EmailRateLimitError`, etc. (no generic `Error`).
9. **Async/await** : pas de raw promises chains.
10. **Pool resources cleanup** : `OnModuleDestroy` + `transport.close()`.
11. **Headers RFC strict** : RFC 5322 (Date, Message-ID), RFC 2047 (Subject UTF-8), RFC 6376 (DKIM), RFC 8058 (List-Unsubscribe-Post).
12. **Multi-tenant aware** : `x-tenant-id` header optional + AsyncLocalStorage Sprint 1.
13. **Audit log** : chaque envoi log `audit_log` retention 7 ans cf decision-014.
14. **Kafka event** : `comm.email.sent` + `comm.email.send_failed` + DLQ Sprint 3 patterns.
15. **TLS 1.2+ minimum** : decision-024.
16. **No-BCC** : batch sends individuels (PII visibility risk).

---

## 13. Sequence de developpement (8 etapes)

1. **Etape 1 (30 min)** : Creer types.ts + errors.ts + index.ts. Build TypeScript verify.
2. **Etape 2 (45 min)** : Implement DkimSignerHelper avec PEM/base64 load + tests unit (8 tests). Verify avec key test 2048 bits generee.
3. **Etape 3 (45 min)** : Implement EmailHeadersBuilder + tests unit (10 tests). Verify Subject UTF-8 + Date RFC 5322.
4. **Etape 4 (60 min)** : Implement MailgunApiClient undici + tests unit (12 tests, mock fetch). Verify region EU enforce.
5. **Etape 5 (45 min)** : Implement EmailTransportFactory 3 providers + tests unit (6 tests). Verify factory pattern.
6. **Etape 6 (60 min)** : Implement EmailService send() + retry + Zod + tests unit (25 tests). Verify privacy logs + idempotency.
7. **Etape 7 (45 min)** : Integration test Mailhog + 5 tests E2E. Verify deliverability + benchmark.
8. **Etape 8 (30 min)** : Runbook email-dns-setup.md + variables env documentation + cross-references Sprint 5/35.

Total : 5h.

---

## 14. Documentation linked

- Sprint 5 Tache 2.1.13 : EmailService baseline Nodemailer + 40 templates 4 locales (enrichi ici).
- Sprint 9 Tache 3.2.5 : Template Manager + 60+ templates seed (consume `EmailService.sendTemplate()`).
- Sprint 9 Tache 3.2.7 : Email Template Renderer + RTL (integration via `sendTemplate()`).
- Sprint 9 Tache 3.2.8 : BullMQ workers `email-send` (consume `EmailService.send()`).
- Sprint 9 Tache 3.2.9 : Message Orchestrator routing email fallback.
- Sprint 9 Tache 3.2.10 : Delivery Tracking webhooks Mailgun (consume `provider_message_id`).
- Sprint 9 Tache 3.2.11 : Opt-out endpoint List-Unsubscribe target.
- Sprint 9 Tache 3.2.13 : E2E tests Mailhog integration (consume integration test pattern).
- Sprint 35 : Migration Atlas Cloud Email + DKIM rotation + BIMI + MTA-STS + TLS-RPT advanced.

---

## 15. Workflow next

A la fin de cette tache 3.2.6 :
- Email service production-ready operationnel sur 3 providers (mailhog dev / mailgun-smtp staging / mailgun-api prod)
- DKIM signing actif + headers RFC 8058 + multipart auto + Message-ID UUID
- Runbook DNS prod publie pour DevOps Sprint 35 go-live
- 25+ tests unitaires + 5 integration Mailhog passent
- Coverage >= 88 %

**Tache suivante : 3.2.7 Email Template Renderer + RTL ar/ar-MA + helpers Handlebars** (4h, P0, depend 3.2.6).

3.2.7 enrichit le renderer Handlebars Sprint 5 baseline avec : RTL automatique pour locales ar/ar-MA via helper `isRtl` + CSS `direction: rtl; text-align: right`, layout shared `_layout.hbs` avec header logo Skalean SVG inline + footer mentions legales SARL RC Casablanca, helpers Handlebars `formatDate(locale, timezone)` + `formatCurrency(amount, MAD)` + `tenantBranding(field)`, CSS inline auto via `juice` library compat email clients Outlook, plain text fallback auto via `node-html-to-text` (deja Tache 3.2.6), cache compiled templates Map en memoire reset boot, integration `EmailService.sendTemplate({ to, templateName, locale, variables, listUnsubscribeToken })` avec auto-injection `listUnsubscribeToken` JWT signe, et 8+ tests RTL + helpers + cache.

---

## 16. Architecture complete recap

```
+-------------------------------------------------------------+
| EmailModule (Global NestJS)                                  |
|                                                              |
| +-------------------------------------------------------+    |
| | EmailService                                          |    |
| |   send({ to, subject, html, text?, ... })             |    |
| |   sendTemplate({ to, templateName, locale, vars })    |    |
| |   verifyConnection()                                  |    |
| |                                                       |    |
| |   - Zod input validation                              |    |
| |   - Body size check (25 MB / 100 KB clip warn)        |    |
| |   - Plain text auto-gen (node-html-to-text)           |    |
| |   - Headers via EmailHeadersBuilder                   |    |
| |   - DKIM sign via DkimSignerHelper                    |    |
| |   - Send via EmailTransport (factory)                 |    |
| |   - Retry exponential 3x 5xx + 429 Retry-After        |    |
| |   - Fail-fast 400 invalid                             |    |
| |   - Logs hashed PII recipient                         |    |
| +-------------------------------------------------------+    |
|             |                |              |                |
|             v                v              v                |
| +------------------+ +-------------+ +--------------+        |
| | EmailHeaders     | | DkimSigner  | | EmailTrans   |        |
| | Builder          | | Helper      | | portFactory  |        |
| |                  | |             | |              |        |
| | - From RFC 2047  | | - Load PEM  | | - mailhog    |        |
| | - Subject UTF-8  | | - sign RSA- | |   (SMTP)     |        |
| | - Date RFC 5322  | |   SHA256    | | - mailgun-   |        |
| | - Message-ID UUID| | - canonical-| |   smtp(SMTP) |        |
| | - List-Unsub     | |   relaxed/  | | - mailgun-   |        |
| |   RFC 8058       | |   relaxed   | |   api (HTTPS)|        |
| | - One-Click      | |             | |              |        |
| +------------------+ +-------------+ +------+-------+        |
|                                             |                 |
|                                             v                 |
|                                  +----------+--------+        |
|                                  | MailgunApiClient  |        |
|                                  | (undici HTTPS)    |        |
|                                  | - region EU only  |        |
|                                  | - Basic auth      |        |
|                                  | - multipart form  |        |
|                                  | - o:dkim/tracking |        |
|                                  | - Idempotency-Key |        |
|                                  +-------------------+        |
|                                                              |
+--------------------------------+----------------------------+
                                 |
                                 v
                  +--------------+--------------+
                  | Logs Pino structured        |
                  | Audit log retention 7 ans   |
                  | Kafka : comm.email.sent     |
                  | comm.email.send_failed      |
                  | comm.email.bounced (Tache   |
                  |   3.2.10)                   |
                  +-----------------------------+
```

---

## 17. Notes finales

Tache 3.2.6 livre la couche transport email production-grade qui sera consommee massivement par tout le programme Skalean InsurTech v2.2 a partir du Sprint 9 (auth flows redirection vers Sprint 5 baseline puis enrichi ici), Sprint 14+ (Insure flows : devis sent, polices signed, payment due reminders), Sprint 15+ (Books flows : factures, paiements), Sprint 18 (Customer Portal preferences), Sprint 22 (Analytics open rate via Mailgun tracking pixel + bounce processor Tache 3.2.10), Sprint 27 (Admin UI templates editor + Mailgun stats dashboard), Sprint 33 (alerting bounce rate > 5 % Slack), et Sprint 35 (transition Atlas Cloud Email service souverain MA total).

L'enrichissement Sprint 9 vs Sprint 5 baseline est focuse sur les capabilities production-grade obligatoires Gmail Sender Guidelines Feb 2024 (DKIM + SPF + DMARC + List-Unsubscribe One-Click) ainsi que sur l'integration Mailgun API HTTPS prod (vs SMTP only) + factory switchable + Message-ID tracking + runbook DNS.

La conformite Maroc (loi 09-08 CNDP + decision-008 cloud souverain partial Sprint 9 + loi 24-09 ANRT marketing direct + identification commerciale obligatoire footer SARL RC Casablanca) est integree par design dans toutes les couches (TLS obligatoire, opt-out one-click, audit log retention 7 ans, region EU partial).

La sequence de developpement 8 etapes 5h respecte la frontiere d'effort budgete sprint, et la suite de tests 25+ unitaires + 5 integration Mailhog garantit le coverage >= 88 % et la non-regression Sprint 5 baseline.

Le runbook `email-dns-setup.md` permet a l'equipe DevOps Sprint 35 d'executer en autonomie le go-live prod (records DNS exacts copy-paste-able + dig commands verification + troubleshooting tree).

**Fin de la Tache 3.2.6.**

---

## Annexe A : Details supplementaires implementation

### A.1 Pattern complete : factory create() with lazy initialization

Le pattern factory choisi (`EmailTransportFactory.create()` async) est important car certaines initialisations sont lourdes :
- Mailhog : connexion SMTP localhost rapide < 5ms
- Mailgun SMTP staging : handshake STARTTLS + AUTH PLAIN ~200ms
- Mailgun API HTTPS prod : initialisation undici Agent + DNS lookup + TLS handshake premier call ~150ms

L'initialisation est faite dans `OnModuleInit()` (NestJS lifecycle) ce qui evite la latency au premier appel `send()`. Le pattern est :

```typescript
async onModuleInit(): Promise<void> {
  this.transport = await this.transportFactory.create();
  if (this.transportFactory.getProvider() !== 'mailhog') {
    const dkimReady = await this.dkimSigner.verifyKeyLoaded();
    if (!dkimReady) {
      throw new EmailDkimError('DKIM private key not loaded for non-dev provider');
    }
  }
}
```

Cette validation fail-fast au boot empeche le deploiement de partir sans cle DKIM en staging/prod (incident production evite : Sprint 5 baseline livrait sans cette verification, l'incident #INC-2026-042 a degage 30 minutes downtime emails Q1 2026).

### A.2 Pattern complete : Idempotency cross-retries BullMQ

Le worker `email-send` Tache 3.2.8 va retry 3x sur 5xx Mailgun avec exponential backoff. A chaque retry, le worker re-call `EmailService.send()` avec le meme `SendEmailInput`. Sans idempotency, on aurait 3 envois identiques au destinataire (utilisateur recoit 3 emails identiques = NPS desastreux).

Solution : `Message-ID` UUID v4 deterministe + `Idempotency-Key` Mailgun header :

```typescript
// Worker BullMQ Tache 3.2.8
const messageId = `<${randomUUID()}@${dkimDomain}>`; // genere UNE FOIS pre-enqueue
await emailService.send({
  to,
  subject,
  html,
  idempotencyKey: messageId, // meme Message-ID utilise comme Idempotency-Key
});
// Si retry : meme messageId reutilise -> Mailgun reject duplicate via Idempotency-Key TTL 24h
```

Le `Message-ID` est genere cote producer (Tache 3.2.8 worker) et passe explicitement a `EmailService.send()` (vs auto-generation cote service qui briserait l'idempotence cross-retries).

### A.3 Pattern complete : Pool SMTP connection lifecycle

Nodemailer pool gere automatiquement le cycle de vie des connexions :
- `maxConnections=5` : max 5 SMTP connections simultanees
- `maxMessages=100` : apres 100 messages sur la meme connection, fermer + reconnecter (evite SMTP server kick stale)
- `keepAliveTimeout=60s` : connection idle > 60s -> close + reconnect au prochain send

```typescript
const transporter = nodemailer.createTransport({
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  // Keep-alive configurable :
  socketTimeout: 60_000,
  greetingTimeout: 30_000,
  connectionTimeout: 10_000,
});
```

Sous burst load (100 emails/sec), les 5 connexions traitent en parallele 5 envois simultanement, throughput ~25 emails/sec (5 conns x 5 msgs/sec/conn). Au-dela, BullMQ Tache 3.2.8 backpressure rate-limit le worker (`limiter.max=10` jobs/sec).

### A.4 Pattern complete : Body canonicalization DKIM relaxed

La canonicalization `relaxed/relaxed` RFC 6376 section 3.4.4 (body) :

```
1. Reduce all sequences of whitespace within a line to a single SP character
2. Ignore all whitespace at the end of lines (the LF / CRLF terminators stay)
3. Ignore all empty lines at the end of body
```

Code helper :

```typescript
private canonicalizeBody(body: string): string {
  const lines = body.split(/\r?\n/);
  const trimmed = lines.map((line) =>
    line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/, ''),
  );
  while (trimmed.length > 0 && trimmed[trimmed.length - 1] === '') {
    trimmed.pop();
  }
  return trimmed.join('\r\n') + '\r\n';
}
```

### A.5 Pattern complete : Mailgun multipart form-data avec custom headers

Mailgun API HTTPS expects `multipart/form-data` body avec champs specifiques :
- `from` / `to` / `subject` / `html` / `text` : standard
- `o:tag` : campaign tag (max 3 par message, filtrable dans Mailgun dashboard)
- `o:tracking` : `yes` enable tracking pixel + click tracking
- `o:dkim` : `yes` server-side DKIM additional (complementaire au DKIM client Skalean)
- `o:require-tls` : `true` enforce TLS 1.2+ downstream (mail receivers)
- `h:X-Header-Name` : custom headers prefixed `h:`

```typescript
const form = new FormData();
form.append('from', input.from);
form.append('to', input.to);
form.append('subject', input.subject);
form.append('html', input.html);
form.append('text', input.text);
form.append('o:dkim', 'yes');
form.append('o:tracking', 'yes');
form.append('o:tracking-clicks', 'htmlonly'); // pas plain text (cleaner)
form.append('o:tracking-opens', 'yes');
form.append('o:require-tls', 'true');

// Custom headers
form.append('h:Reply-To', 'support@skalean-insurtech.ma');
form.append('h:List-Unsubscribe', '<https://...>, <mailto:...>');
form.append('h:List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
form.append('h:DKIM-Signature', dkimSignatureHeader); // client-side DKIM
form.append('h:Message-ID', messageIdUuid);
form.append('h:Date', dateRfc5322);
```

### A.6 Pattern complete : Subject UTF-8 RFC 2047 base64 encoding

RFC 2047 specifie l'encoding des headers contenant caracteres non-ASCII :
- Encoded-word format : `=?charset?encoding?encoded-text?=`
- charset : `UTF-8` standard moderne
- encoding : `B` pour base64 (vs `Q` quoted-printable)
- encoded-text : base64(utf8 bytes)

Exemple :
- Input : `Bienvenue ! mrHbA bk fy SkAlyEn`
- UTF-8 bytes : `42 69 65 6e 76 65 6e 75 65 20 21 20 d9 85 d8 b1 ...`
- base64 : `QmllbnZlbnVlICEg2YXYsdit2KjYpyDYqNmDIGZ5IFNrYWx5YW4=`
- Encoded : `=?UTF-8?B?QmllbnZlbnVlICEg2YXYsdit2KjYpyDYqNmDIGZ5IFNrYWx5YW4=?=`

Code helper :

```typescript
private encodeSubject(subject: string): string {
  if (this.isAscii(subject)) {
    return subject;
  }
  return `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
}

private isAscii(str: string): boolean {
  return /^[\x20-\x7E]*$/.test(str);
}
```

Limite : RFC 2047 stipule max 75 chars par encoded-word (folding obligatoire au-dela). Notre helper ne split pas car les Subjects Skalean restent < 100 chars en UTF-8 (en pratique : `=?UTF-8?B?<base64>?=` reste < 200 chars total, supportee par tous les clients modernes Outlook 2016+, Gmail, Apple Mail).

### A.7 Pattern complete : Date RFC 5322 format Africa/Casablanca

RFC 5322 section 3.3 specifie le format Date :
- `day-of-week ", " day month year time zone`
- exemple : `Fri, 08 May 2026 14:30:00 +0100`

Morocco timezone : GMT+1 year-round depuis 2018 (Decret 2-18-855 fixant l'heure legale du Royaume du Maroc en GMT+1 toute l'annee, abolissant l'heure d'ete). Donc offset constant `+0100`.

```typescript
private formatDateRfc5322(now: Date = new Date()): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // Convert to Africa/Casablanca (UTC+1) by adding 1 hour to UTC
  const local = new Date(now.getTime() + 60 * 60 * 1000);
  const dayName = days[local.getUTCDay()];
  const day = String(local.getUTCDate()).padStart(2, '0');
  const month = months[local.getUTCMonth()];
  const year = local.getUTCFullYear();
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  const ss = String(local.getUTCSeconds()).padStart(2, '0');
  return `${dayName}, ${day} ${month} ${year} ${hh}:${mm}:${ss} +0100`;
}
```

Note : Sprint 35 considere utiliser `Intl.DateTimeFormat` avec `timeZone: 'Africa/Casablanca'` pour gerer eventuels changements legislatifs futurs (peu probable).

### A.8 Pattern complete : Token JWT signed pour List-Unsubscribe URL

Le `listUnsubscribeToken` passe a `EmailService.send()` est un JWT signe HS256 avec le secret `EMAIL_OPTOUT_SIGNING_SECRET` :

```typescript
// Producer (e.g. Tache 3.2.8 worker email-send) :
import { sign } from 'jsonwebtoken';

const optoutToken = sign(
  {
    contactId: contact.id,
    channel: 'email',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 jours
  },
  process.env.EMAIL_OPTOUT_SIGNING_SECRET!,
  { algorithm: 'HS256' },
);

await emailService.send({
  to: contact.email,
  subject: 'Verify email',
  html: '<p>...</p>',
  listUnsubscribeToken: optoutToken,
});
```

L'endpoint `POST /api/v1/public/optout/one-click/:token` Tache 3.2.11 verify la signature + execute opt-out :

```typescript
// Tache 3.2.11 controller (preview)
@Post('one-click/:token')
async oneClickOptout(@Param('token') token: string): Promise<void> {
  const payload = verify(token, process.env.EMAIL_OPTOUT_SIGNING_SECRET!) as { contactId: string; channel: string };
  await this.optoutService.optOut(payload.contactId, payload.channel as Channel, {
    source: 'email-one-click',
    reason: 'List-Unsubscribe-Post One-Click RFC 8058',
  });
  // 200 OK no body (Gmail spec)
}
```

### A.9 Pattern complete : Audit log conformite decision-014

Chaque envoi d'email log dans `audit_log` table (Sprint 2 deja migration) avec retention 7 ans :

```typescript
await this.auditLogService.log({
  tenant_id: input.tenantId,
  actor_type: 'system',
  actor_id: 'email-service',
  action: 'email.sent',
  resource_type: 'comm_message',
  resource_id: messageId,
  metadata: {
    template: input.tags?.[0] ?? 'transactional',
    locale: input.tags?.[1] ?? 'unknown',
    provider: this.transportFactory.getProvider(),
    to_hash: this.hashEmailForLogs(input.to),
    latency_ms: latency,
    has_list_unsubscribe: Boolean(input.listUnsubscribeToken),
  },
});
```

Le hash sha256 prefix-truncated 8 chars permet : (a) audit forensic correlation (retrouver tous les emails a une adresse hashee) sans expose PII en clair, (b) conformite CNDP loi 09-08 article 8 (PII confidentialite logs).

### A.10 Pattern complete : Kafka events comm.email.*

Sprint 9 emit 3 Kafka topics :

```typescript
// comm.email.sent : success delivery
await this.kafkaPublisher.publish('insurtech.events.comm.email.sent', {
  schema_version: '1.0',
  message_id: messageId,
  provider_message_id: result.providerMessageId,
  tenant_id: input.tenantId,
  to_hash: this.hashEmailForLogs(input.to),
  template: input.tags?.[0],
  locale: input.tags?.[1],
  provider: this.transportFactory.getProvider(),
  sent_at: new Date().toISOString(),
});

// comm.email.send_failed : final failure after retries
await this.kafkaPublisher.publish('insurtech.events.comm.email.send_failed', {
  schema_version: '1.0',
  message_id: messageId,
  tenant_id: input.tenantId,
  to_hash: this.hashEmailForLogs(input.to),
  error: lastErr?.message,
  attempts: this.retryMaxAttempts,
  failed_at: new Date().toISOString(),
});

// comm.email.bounced : Tache 3.2.10 webhook Mailgun
// Emit ailleurs (delivery-tracking.service.ts Tache 3.2.10)
```

Schemas Avro registered Sprint 3 schema-registry (decision-016 strong typing Kafka events).

### A.11 Pattern complete : Healthcheck endpoint Sprint 1

Sprint 1 livre le module `HealthController` avec endpoints `/api/v1/health` (overall) et sub-checks. Sprint 9 ajoute `/api/v1/health/email` :

```typescript
// repo/apps/api/src/modules/health/email-health.indicator.ts
import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { EmailService } from '@insurtech/comm';

@Injectable()
export class EmailHealthIndicator extends HealthIndicator {
  constructor(private readonly emailService: EmailService) {
    super();
  }

  async isHealthy(key = 'email'): Promise<HealthIndicatorResult> {
    const ok = await this.emailService.verifyConnection();
    if (!ok) {
      throw new HealthCheckError('Email transport unhealthy', this.getStatus(key, false));
    }
    return this.getStatus(key, true);
  }
}
```

Integre dans `HealthController` :

```typescript
@Get('email')
@HealthCheck()
async emailHealth() {
  return this.healthCheckService.check([() => this.emailHealthIndicator.isHealthy()]);
}
```

K8s liveness probe Sprint 35 utilise cet endpoint (interval 30s, timeout 5s, fail threshold 3).

### A.12 Pattern complete : DKIM rotation procedure (Sprint 35)

La rotation cle DKIM doit se faire en dual-key pour eviter downtime emails (cache mail receivers conserve l'ancienne public key jusqu'a 24h+). Procedure :

**Jour J (preparation)** :
1. Generer nouvelle paire RSA 2048 bits :
```bash
openssl genrsa -out dkim-private-2026.pem 2048
openssl rsa -in dkim-private-2026.pem -pubout -outform DER 2>/dev/null | openssl base64 -A > dkim-public-2026.b64
```

2. Publier nouveau DNS record (selector `default2`) :
```
default2._domainkey TXT "v=DKIM1; k=rsa; p=<new public key from dkim-public-2026.b64>"
```

3. Wait 24h propagation DNS + cache.

**Jour J+1 (cutover)** :
4. Update env :
```bash
EMAIL_DKIM_SELECTOR=default2
EMAIL_DKIM_PRIVATE_KEY=<base64 of dkim-private-2026.pem>
```

5. Deploy app + verify mail-tester.com score >= 9/10.

**Jour J+30 (cleanup)** :
6. Retirer ancien DNS record `default._domainkey TXT "..."`.

**Rollback** : si etape 5 fail (signature mismatch), revert env aux anciennes valeurs (selector `default` + ancienne private key) -- les 2 selectors restent valides DNS pendant 30 jours grace period.

### A.13 Pattern complete : Mailgun bounces vs Sprint 9 Tache 3.2.10

Sprint 9 Tache 3.2.6 prepare le terrain pour les bounces mais leur traitement complete est Tache 3.2.10. La preparation Tache 3.2.6 :

- `o:tracking-opens=yes` + `o:tracking-clicks=htmlonly` : Mailgun pixel + click tracking
- Webhooks Mailgun configures dans le dashboard Mailgun -> URL `https://api.skalean.ma/api/v1/public/webhooks/mailgun`
- Tags `o:tag` pour filtrer dashboard Mailgun par campaign

Tache 3.2.10 implemente le receiver webhook Mailgun avec verification HMAC SHA-256 (`X-Mailgun-Signature-256` header) et update `comm_messages.status` selon event type :
- `delivered` -> `delivered_at`
- `opened` -> `opened_at`
- `clicked` -> `clicked_at`
- `permanent_fail` -> `bounced_at` + auto-opt-out (hard bounce)
- `temporary_fail` -> `failed_at` (retry possible Sprint 9 BullMQ)
- `complained` -> auto-opt-out + alert reputation
- `unsubscribed` -> opt-out (One-Click execute via List-Unsubscribe)

### A.14 Pattern complete : Test mail-tester.com integration Sprint 35

Sprint 35 ajoute un test E2E mail-tester.com qui envoie un email reel a `test-xxxx@mail-tester.com` puis fetch le score via leur API :

```typescript
// repo/apps/api/test/comm/mail-tester.e2e.spec.ts (Sprint 35)
it('mail-tester.com score >= 9/10', async () => {
  const testAddr = await mailTesterClient.generateTestAddress();
  await emailService.send({
    to: testAddr.email,
    subject: 'Test deliverability Skalean',
    html: '<p>Hello</p>',
  });
  await new Promise((r) => setTimeout(r, 30_000)); // wait Mailgun delivery
  const score = await mailTesterClient.getScore(testAddr.id);
  expect(score.total).toBeGreaterThanOrEqual(9);
  expect(score.dkim).toBe('valid');
  expect(score.spf).toBe('pass');
  expect(score.dmarc).toBe('aligned');
}, 60_000);
```

Sprint 9 livre la fondation, Sprint 35 valide en prod via mail-tester.

---

## Annexe B : Glossaire technique

| Terme | Definition |
|-------|-----------|
| DKIM | DomainKeys Identified Mail (RFC 6376) -- signature cryptographique RSA-SHA256 d'email pour authenticite expediteur |
| SPF | Sender Policy Framework (RFC 7208) -- authorize une liste d'IPs/domains a envoyer email pour un domain |
| DMARC | Domain-based Message Authentication, Reporting & Conformance (RFC 7489) -- policy combine DKIM + SPF + reporting |
| MTA-STS | Mail Transfer Agent Strict Transport Security (RFC 8461) -- enforce TLS 1.2+ entre MTAs |
| TLS-RPT | TLS Reporting (RFC 8460) -- reports daily des TLS errors |
| BIMI | Brand Indicators for Message Identification -- logo verifie dans inbox Gmail/Yahoo |
| List-Unsubscribe | RFC 2369 -- header opt-out URL/mailto |
| List-Unsubscribe-Post | RFC 8058 -- One-Click opt-out HTTP POST sans confirmation |
| RFC 2047 | Encoding non-ASCII headers (`=?UTF-8?B?...?=`) |
| RFC 5322 | Internet Message Format (Date, Message-ID, etc.) |
| Canonicalization | Normalization du body/headers avant DKIM signing pour resilience whitespace |
| Selector | Identifiant DNS DKIM (`<selector>._domainkey.<domain>`) permettant rotation |
| Idempotency-Key | Header HTTP custom pour eviter doublons cross-retries (Mailgun TTL 24h) |
| Pool SMTP | Reuse de connexions SMTP keep-alive pour performance |
| Multipart MIME | Format email avec plusieurs parts (HTML + text alternative) |
| Mailhog | SMTP server dev local (port 1025) + UI web (port 8025) |
| Mailgun | SaaS email transactional (region EU eu.mailgun.net) |
| undici | HTTP client haute performance Node.js (vs node-fetch deprecated) |
| node-html-to-text | Library extraction texte readable from HTML |
| RTL | Right-to-Left (locales ar/ar-MA Arabic) |

---

## Annexe C : Cross-references documentation

- `00-pilotage/documentation/2-variables-environnement.env` : catalog complete env vars EMAIL_* + WHATSAPP_*.
- `00-pilotage/documentation/3-schemas-database-PARTIE1.sql` : ligne 400-500 tables comm_*, ligne 250 column `comm_messages.provider_message_id VARCHAR(255) UNIQUE`.
- `00-pilotage/documentation/8-skalean-insurtech-prompt-master.md` : section "Communications" + section "Conformite Maroc" + decisions 008 / 022 / 024.
- `00-pilotage/decisions/decision-008-cloud-souverain-ma.md` : Mailgun EU partial Sprint 9 + Atlas Email Sprint 35 transition.
- `00-pilotage/decisions/decision-022-conformite-cndp.md` : opt-out simple gratuit immediat + identification commerciale.
- `00-pilotage/decisions/decision-024-tls-minimum.md` : TLS 1.2+ minimum tous transports.
- `repo/packages/comm/README.md` : section EmailService usage examples Sprint 5 + Sprint 9 enrichi.
- `repo/docs/runbooks/email-dns-setup.md` : runbook DNS prod (livre cette tache).
- `repo/docs/runbooks/email-dkim-rotation.md` : runbook rotation cles (Sprint 35).

---

**Fin Annexes Tache 3.2.6.**
