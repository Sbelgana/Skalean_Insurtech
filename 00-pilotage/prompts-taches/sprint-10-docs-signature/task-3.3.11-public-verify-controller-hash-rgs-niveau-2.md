# Tache 3.3.11 - Public Verify Controller (verification document via hash) Endpoint No-Auth + Rate Limited 60/h IP + RGS Niveau 2 + QR Code embed in PDF Tache 3.3.5 + Anonymized public_verification_id (no enumeration) + HTML Verification Page + Audit Verifications Tracked + Suspicious Verification Detection + i18n FR/AR

## Section 1 - Identification de la tache

| Champ | Valeur |
|---|---|
| ID Tache | 3.3.11 |
| Titre court | Public Verify Controller Hash + RGS Niveau 2 |
| Titre long | Public Verify Controller (verification document via hash) Endpoint No-Auth + Rate Limited 60/h IP + RGS Niveau 2 + QR Code embed in PDF Tache 3.3.5 + Anonymized public_verification_id (no enumeration) + HTML Verification Page + Audit Verifications Tracked + Suspicious Verification Detection + i18n FR/AR |
| Sprint | Sprint 10 - Documents + Signature Loi 43-20 |
| Phase | Phase 3 - Implementation Backend Services Specifiques Metier |
| Priorite | P0 (bloquant - Loi 43-20 art 7 verification publique signature obligatoire) |
| Effort estime | 4h (240 min) |
| Complexite technique | Elevee (endpoint public sans auth, rate limit Redis, anonymisation deterministe HMAC, i18n FR/AR RTL, suspicious detection bot enumeration, RGS Niveau 2, CNDP minimisation PII) |
| Dependances strictes | Tache 3.3.10 (verification interne signature Barid + ANRT timestamp valides - public verify expose une couche publique des resultats de verification deja valides au backend) |
| Bloque | Tache 3.3.12 (notifications email/SMS post-signature avec lien public verify embedded) ; Tache 3.4.x sprints suivants (audit kafka SecOps consume audit.suspicious_verify) |
| Module | repo/apps/api/src/modules/signature ; repo/packages/docs/src/templates |
| Type livrable | Controller + 5 Services + 2 Templates Handlebars + DTO Zod + Middleware CORS + Tests Unit + Tests E2E |
| Domaine fonctionnel | Verification Publique Signature Electronique Qualifiee + Transparence Reglementaire + Anti-Enumeration Anti-Abus |
| Conformite reglementaire | Loi 43-20 art 7 (verification publique obligatoire signatures qualifiees) ; RGS Niveau 2 (Reference General de Securite verification publique) ; CNDP Loi 09-08 art 4 (minimisation PII) ; ACAPS Circulaire 2018/01 art 13 (transparence consommateur) ; ETSI TS 102 234 (interfaces web verification) ; RFC 6749 (rate limiting bonnes pratiques) |
| Owner | Equipe Signature Backend (lead: arch securite + lead UX page verify) |
| Reviewer obligatoire | Lead Securite + Lead Backend + DPO (Delegue Protection Donnees) + Compliance Officer + Lead UX (page HTML i18n) |

## Section 2 - Objectifs metier et techniques

### 2.1 Objectif metier principal

L'endpoint `GET /public/verify-doc/:hash` constitue la **face publique** de l'infrastructure de signature electronique qualifiee Skalean InsurTech. Conformement a la **Loi 43-20 article 7** (transposition marocaine eIDAS UE 910/2014 article 33), tout prestataire de services de confiance qualifie a l'obligation legale de fournir un mecanisme de verification accessible a tout tiers (juge, expert judiciaire, controleur ACAPS, controleur CNDP, client final, partie adverse en contentieux) permettant de confirmer publiquement l'authenticite, l'integrite et l'horodatage d'un document signe.

Concretement, lorsqu'un document contractuel d'assurance (police, devis accepte, avenant, declaration de sinistre, attestation, KYC) est signe via Barid eSign + horodate ANRT (Taches 3.3.7 et 3.3.8), le PDF genere (Tache 3.3.5) embarque un **QR code** dont le contenu pointe vers `https://api.skalean-insurtech.ma/verify/:hash`. Ce hash est le SHA-512 du document scelle. N'importe qui detenant le PDF peut scanner le QR code avec son telephone (ou copier l'URL) pour atterrir sur une **page HTML publique** qui affiche :

1. Confirmation cryptographique : "Ce document est bien un document Skalean InsurTech signe authentiquement".
2. Type de document (police, devis, avenant, etc.) sans devoiler son contenu.
3. Date de signature et date d'horodatage qualifie ANRT (RFC 3161 timestamp).
4. Numero de serie du jeton TSA ANRT (preuve verifiable independamment).
5. Nombre de signataires et **initiales anonymisees** des signataires (ex: "AB", "CD") sans devoiler noms complets, emails, telephones (CNDP minimisation).
6. Lien telechargement du **bordereau d'audit** (PDF separe Tache 3.3.4) detaillant la chaine de preuves.
7. Disclaimer juridique : citation Loi 43-20 art 7, mention validite legale equivalente papier (art 1316 DOC), avertissement faux et usage de faux (art 351 Code Penal).

Ce mecanisme reduit drastiquement les contestations contractuelles : un client qui pretend ne pas avoir signe une police peut etre confronte au lien public verifiable montrant son initiale et la date precise. Inversement, un client qui craint une falsification de sa police peut verifier publiquement que le PDF en sa possession correspond bien a un document signe legitimement (et n'a pas ete altere apres-coup).

L'endpoint **ne necessite aucune authentification** : c'est un service public de transparence. Mais il doit etre protege contre les abus (enumeration, DoS, scraping) par un rate limit de 60 requetes/heure par IP, une detection de bots et d'enumeration sequentielle, et l'utilisation d'un identifiant public anonymise (`document_public_id` deterministe HMAC) au lieu de l'UUID interne du document.

### 2.2 Objectifs techniques specifiques

1. **Controller public no-auth** : `PublicVerifyController` decorateur `@Public()` (skip JWT guard global), endpoint `GET /public/verify-doc/:hash` retournant JSON pour clients API et `GET /public/verify-doc/:hash/page` retournant HTML pour navigateurs (negociation contenu via Accept header optionnelle, mais routes separees pour clarte SEO).
2. **Service verification metier** : `PublicVerifyService.verifyByHash(hash)` qui interroge la table `documents` joint `sig_signing_workflows` pour resoudre hash -> metadonnees publiques, applique l'anonymisation, masque PII.
3. **Service anonymisation deterministe** : `AnonymizeVerificationIdService` utilise HMAC-SHA-256(document_id_uuid, ANONYMIZE_SECRET) -> base32 lower-case -> first 16 caracteres prefixe `pub_` (ex: `pub_8a3fb2c9d1e4f7a0`), garantissant collision improbable (probabilite 2^-80 pour 16M documents) et non-reversibilite (sans connaitre secret).
4. **Service rate limiter Redis** : `VerifyRateLimiterService` sliding window log algorithme avec ZADD + ZREMRANGEBYSCORE + ZCARD, cle `rl:verify:{ip}`, fenetre 3600s, seuil 60 hits, alerte Kafka si depassement 100/h (suspicious).
5. **Service detection suspicious** : `SuspiciousVerifyDetectorService` heuristiques : (a) user-agent bot (curl, wget, python-requests, Go-http-client, Java/, scrapy), (b) frequence > 10 hits/60s par IP, (c) enumeration sequentielle hash hexa similaires, (d) absence Accept-Language ou Accept header, (e) plusieurs IPs depuis meme /24 subnet en burst.
6. **Templates HTML Handlebars** : `verify-page.hbs` (FR LTR) et `ar/verify-page.hbs` (AR RTL avec `dir="rtl" lang="ar"`), Bootstrap 5 minimal CSS inline (no external CDN pour conformite CSP strict), responsive mobile-first.
7. **DTO Zod public-safe** : `VerifyResponseDto` schema strict, NO PII (no emails, no phones, no full names), seulement initiales 2 lettres + role + timestamps.
8. **Middleware CORS open** : `PublicVerifyCorsMiddleware` autorise origin * pour endpoint public, mais headers exposed limites (no Authorization, no Cookies).
9. **Tests unitaires Vitest** : >= 30 tests couvrant paths heureux, edge cases, securite, anonymisation, rate limiter Redis mock, detection suspicious heuristiques.
10. **Tests E2E supertest + fastify** : 12+ scenarios bout-en-bout incluant rate limit reel Redis testcontainer, suspicious detection real, i18n negotiation locale ar-MA vs ar-DZ vs fr-FR vs en-US fallback.

### 2.3 Resultats attendus mesurables (KPIs)

| KPI | Cible | Mesure |
|---|---|---|
| Latence GET /verify-doc/:hash p50 (cache hit) | < 25ms | Histogramme Pino + Prometheus |
| Latence GET /verify-doc/:hash p99 (cache hit) | < 80ms | Histogramme |
| Latence GET /verify-doc/:hash p50 (cache miss DB) | < 120ms | Histogramme |
| Latence GET /verify-doc/:hash p99 (cache miss DB) | < 350ms | Histogramme |
| Latence GET /verify-doc/:hash/page p50 HTML render | < 60ms | Histogramme |
| Cache hit ratio Redis 5 min TTL | > 70% | Metrique compteur hits/total |
| Taux 404 hash inconnu | < 5% (legitimes) ou flag suspect | Compteur status_404 |
| Taux 429 rate limit triggered | < 0.5% | Compteur status_429 |
| Couverture tests unitaires | >= 95% lines, 90% branches | Vitest coverage |
| Tests E2E pass | 100% (12+ scenarios) | CI pipeline |
| Anonymisation collision rate | 0% (16M docs simules) | Test stress collision |
| Detection bot user-agent | precision > 90%, rappel > 95% | Test corpus 200 user-agents |
| Templates HTML W3C valid | 100% pass validator.w3.org | CI lint |
| Templates HTML accessibilite WCAG 2.1 AA | 100% pass axe-core | CI lint |
| Bundle CSS inline page verify | < 15 KB minified | Wc -c |
| RGS Niveau 2 audit checklist | 100% items checked | Audit DPO |

### 2.4 Hors-scope explicite

- Verification cryptographique reelle de la signature Barid eSign : deja realisee par Tache 3.3.10 (`SignatureVerifierService`), cette tache 3.3.11 expose seulement les resultats deja stockes en base.
- Re-verification on-the-fly du hash document (recomputation depuis S3) : pas dans cette tache, le hash stocke en base est trust source. Tache future 3.4.x pourra ajouter recomputation periodique.
- OCSP/CRL temps reel certificat TSA : deja fait Tache 3.3.10, on expose juste status booleen.
- API GraphQL : non, REST seulement.
- Webhook callback verifications : non, prevu Sprint 33.
- Export bulk verifications : non, endpoint singulier.
- API rate limit par cle API : non, c'est un endpoint public sans cle.

## Section 3 - Contexte detaille

### 3.1 Cadre reglementaire RGS Niveau 2 et obligation verification publique

Le **Referentiel General de Securite (RGS)** est un cadre reglementaire issu initialement de la France (decret 2010-112) mais largement adopte au Maroc dans les recommandations de la **Direction Generale de la Securite des Systemes d'Information (DGSSI)** publiees en 2017 et integrees aux recommandations ANRT pour les services de confiance. Le RGS distingue **trois niveaux de securite** pour les services de signature electronique et leur verification :

- **RGS Niveau 1 (basique)** : authentification simple, signature avancee non qualifiee, verification accessible aux signataires authentifies uniquement. Pas d'obligation verification publique.
- **RGS Niveau 2 (renforce)** : signature qualifiee, verification publique accessible **sans authentification** mais avec mesures anti-abus, anonymisation des donnees personnelles dans les reponses publiques, journalisation des verifications, durabilite 10 ans minimum. **C'est le niveau cible pour Skalean InsurTech v2.2** (decision-024).
- **RGS Niveau 3 (renforce*)** : niveau 2 + horodatage qualifie obligatoire + double authentification signataire + audit OCSP temps reel + duree conservation 30 ans. Cible v3.0 Skalean (sprint 50+).

Le RGS Niveau 2 impose specifiquement pour la verification publique :

1. **Accessibilite sans authentification** : tout tiers doit pouvoir verifier sans creer de compte, sans cle API, sans authentification quelconque. Le seul "secret" requis est la possession du hash du document (qui est lui-meme present dans le PDF QR code).
2. **Anonymisation PII** : la reponse publique ne doit pas reveler de donnees a caractere personnel non strictement necessaires a la verification. Loi 09-08 CNDP article 4 alinea 2 : "Les donnees a caractere personnel doivent etre adequates, pertinentes et non excessives au regard des finalites pour lesquelles elles sont collectees et de leurs traitements ulterieurs". Reveler le nom complet d'un signataire dans une page publique scannable par n'importe qui depasse la finalite "prouver qu'un document a bien ete signe". On expose uniquement les **initiales** (2 caracteres premier+nom prenom) suffisantes pour qu'un tiers connaissant le contexte (par exemple le client lui-meme regardant son propre contrat) puisse reconnaitre les parties.
3. **Anti-enumeration** : les identifiants exposes publiquement (`document_public_id`) ne doivent pas permettre de deduire, par incrementation ou pattern matching, d'autres identifiants valides. Un UUID v4 (random) protege deja par sa cardinalite (2^122 combinaisons), mais l'exposer reveille l'identifiant interne utilise dans logs, queries SQL, JWT subject, etc. La bonne pratique RGS est d'utiliser un identifiant public **deterministe mais non reversible** derive de l'identifiant interne via HMAC. Ainsi :
   - Le meme document interne donne toujours le meme `public_id` (deterministe -> pas besoin de stocker une mapping en base).
   - Sans le secret HMAC, impossible de remonter au `document_id` interne (non-reversible).
   - Aucun pattern sequentiel ne peut etre devine (HMAC est PRF).
4. **Journalisation verifications** : chaque appel doit etre log avec hash, IP source, user-agent, timestamp, locale, status. Ces logs alimentent un audit trail consultable par la Compliance Officer + DPO. Conservation logs 5 ans (decision-007).
5. **Detection abus** : seuils d'alerte automatique sur frequence anormale (DoS, enumeration, scraping massif).
6. **Disclaimer juridique** : la page publique doit citer explicitement les fondements legaux (Loi 43-20 art 7) et avertir des sanctions penales en cas de faux et usage de faux (Code Penal art 351).

### 3.2 Pourquoi un identifiant public anonymise (`document_public_id`)

Imaginons que l'endpoint expose directement l'`document_id` UUID v4 interne :

```json
{ "document_id": "f3a7b2c9-1e4d-4f87-9a01-2b3c4d5e6f70", ... }
```

Cet UUID est ensuite reutilise dans :
- Les URLs admin Skalean (`/admin/documents/f3a7b2c9-...`).
- Les logs Pino (`{ "document_id": "f3a7b2c9-..." }`).
- Les requetes SQL backend (`WHERE id = 'f3a7b2c9-...'`).
- Les JWT signature workflows.
- Les events Kafka (`document.signed { document_id }`).

Si un attaquant collecte ces UUIDs via les endpoints publics (en scrapant des verifications), il peut :
- Tenter du **forced browsing** sur l'admin (`/admin/documents/<uuid>`).
- Correler logs leakes (par ex. depuis une faille XSS interne).
- Identifier des **schemas temporels** : UUID v4 ne fuite pas le timestamp, mais combine a `signed_at` revelle dans la meme reponse, on peut reconstruire une timeline.

L'anonymisation HMAC casse ce lien. Le `pub_8a3fb2c9d1e4f7a0` n'apparait nulle part ailleurs dans le systeme, n'a aucune utilite operationnelle interne (les services backend n'utilisent que `document_id`), et ne peut etre remonte au document interne sans connaitre `ANONYMIZE_SECRET` (clef stockee en HSM ou Kubernetes Sealed Secret, distincte de toute autre clef).

Le `public_id` deterministe est aussi **stable dans le temps** : si le meme document est verifie deux fois, le meme `public_id` est retourne. Cela permet a un tiers (ex: avocat) de citer ce `public_id` dans un memoire judiciaire et de prouver que l'identifiant ne change pas, donc fait reference au meme document. Si on utilisait un UUID v4 random a chaque verification, on perdrait cette propriete de stabilite.

### 3.3 Pourquoi NO PII dans la reponse (CNDP Loi 09-08 minimisation)

La **Loi 09-08 du 18 fevrier 2009** relative a la protection des personnes physiques a l'egard du traitement des donnees a caractere personnel (Maroc, transposition partielle Convention 108 Conseil Europe + GDPR principes), promulguee par Dahir n° 1-09-15, instaure le principe de **minimisation des donnees** en son article 4 alinea 2 :

> "Les donnees a caractere personnel doivent etre adequates, pertinentes et non excessives au regard des finalites pour lesquelles elles sont collectees et de leurs traitements ulterieurs."

La **Commission Nationale de controle de la Protection des Donnees a Caractere Personnel (CNDP)**, dans sa **Deliberation 478-2013** sur les services en ligne, precise que la minimisation s'applique aussi a la **publication** (rendue accessible publiquement) : on ne doit publier que les donnees strictement necessaires a la finalite annoncee.

La finalite de l'endpoint public verify est **prouver qu'un document a ete signe legitimement**. Pour cette finalite :

| Information | Necessaire ? | Decision |
|---|---|---|
| Hash du document | OUI (preuve cryptographique) | Echo input |
| Type de document | OUI (sait quel contrat) | Expose |
| Date de signature | OUI (preuve temporelle) | Expose |
| Date d'horodatage TSA | OUI (preuve qualifiee) | Expose |
| Numero serie TSA | OUI (verifiable independamment) | Expose |
| Nombre de signataires | OUI (sait combien parties) | Expose |
| Roles signataires (signer/witness/notaire) | OUI (qualite juridique) | Expose |
| Initiales signataires (2 lettres) | UTILE (reconnaissance contextuelle) | Expose |
| Noms complets signataires | NON (data leak public) | MASQUE |
| Emails signataires | NON (spam, phishing) | MASQUE |
| Telephones signataires | NON (smishing) | MASQUE |
| Adresses signataires | NON (stalking) | MASQUE |
| CIN signataires | NON (fraude identite) | MASQUE |
| Tenant_id Skalean | NON (info competitive) | MASQUE |
| Document_id interne UUID | NON (forced browsing) | MASQUE -> public_id HMAC |
| Workflow_id signature | NON (forced browsing) | MASQUE |
| Contenu du document | NON (confidentialite) | MASQUE |

Sanction CNDP en cas de manquement minimisation : **Article 51 Loi 09-08** prevoit amende de 20 000 a 200 000 DH par infraction constatee, multipliee par nombre de personnes concernees. Pour Skalean qui traite ~10 000 polices/mois, une non-conformite couterait potentiellement 2 milliards DH par mois -> existential threat.

### 3.4 Trade-off cache vs real-time (TTL 5 minutes)

L'endpoint est appelable de facon massive (potentiellement Reddit ou Twitter relaie une URL verify pour faire viral marketing avec 100 000 hits en 1h). On doit cacher pour absorber le trafic, mais on doit aussi refleter rapidement les invalidations (ex: signature revoquee suite fraude detectee).

**Decision-073** : TTL Redis 300 secondes (5 minutes). Justification :

| TTL | Avantages | Inconvenients |
|---|---|---|
| 0s (no cache) | Toujours frais | DB DoS sous load, latence x10 |
| 60s | Tres frais | Cache hit ratio < 30% sur trafic spike |
| 300s (CHOISI) | Compromis | Revocation visible avec delai max 5 min, hit ratio > 70% |
| 3600s (1h) | Hit ratio 95%+ | Revocation invisible 1h - pb juridique |
| 86400s (24h) | Hit ratio 99%+ | Inacceptable juridiquement |

Le cache est **invalide immediatement** dans 2 cas (write-through invalidation) :
1. Signature revoquee admin (Tache 3.4.x future) -> emit event `signature.revoked` -> consumer purge cle Redis `verify:cache:{hash}`.
2. Document soft-deleted CNDP purge -> emit event `document.deleted` -> mais selon decision-074, le document reste verifiable depuis archive bucket pendant la periode de retention legale (10 ans signatures), donc la cache reste valide. Voir section 3.7 edge case purge CNDP.

`Cache-Control: private, max-age=300` cote client (browser). Pas `public, max-age=...` car on ne veut pas qu'un proxy intermediaire (Cloudflare, Akamai) cache pour des IPs differentes (rate limit deviendrait inefficace).

### 3.5 Pourquoi endpoint public avec rate limit (transparence vs DoS)

Le tension fondamentale est entre **transparence reglementaire** (Loi 43-20 art 7 -> verification doit etre accessible) et **protection infrastructure** (DoS, scraping massif compromet disponibilite). La solution est un rate limit **genereux mais pas illimite** :

- 60 req/heure par IP : suffit largement pour un usage humain legitime (un avocat verifie une dizaine de documents par jour, un controleur ACAPS audit ~100/mois = ~3/jour).
- Au-dela 60/h on retourne 429 avec header `Retry-After: 3600` standard.
- Au-dela **100/h on emet event Kafka** `audit.suspicious_verify` consume par SecOps Sprint 33 pour potentiel ban IP firewall.
- Pas de rate limit applique aux IPs whitelist ANRT, ACAPS, CNDP (config env var `PUBLIC_VERIFY_RATE_LIMIT_WHITELIST_IPS`).

Le rate limit est par IP (client X-Forwarded-For via reverse proxy nginx/CloudFront) avec attention spoofing : on prend la **derniere IP de la chaine X-Forwarded-For** (la plus proche de notre infra, donc la plus difficile a spoofer car configuree par notre proxy).

### 3.6 Anonymisation deterministe HMAC vs alternatives

| Methode | Deterministe | Reversible | Collision | Stabilite | Choix |
|---|---|---|---|---|---|
| UUID v4 random a chaque appel | Non | N/A | 2^122 | Non | Rejet (instable) |
| UUID v5 (SHA1 namespace) | Oui | Non sans namespace | 2^160 | Oui | Possible mais SHA1 deconseille |
| HMAC-SHA-256 + base32 16c | Oui | Non sans secret | 2^80 (16c base32) | Oui | **CHOISI** |
| HMAC-SHA-256 + base64url 22c | Oui | Non sans secret | 2^132 | Oui | Surdimensionne, URLs longues |
| AES-256-CTR encrypt deterministe | Oui | Reversible avec cle | 2^128 | Oui | Reversible -> rejet (decision-024 non-reversible) |
| Base58 encode UUID | Non | Oui | N/A | Oui | Rejet (reveille UUID) |

HMAC-SHA-256 base32 16 caracteres choisi : 80 bits entropie (2^80 = 1.2 * 10^24 combinaisons) suffit pour eviter collision sur 16M documents (probabilite collision birthday ~ sqrt(2^80) / 2^80 = 2^-40 negligeable). Base32 plutot que base64 car URL-safe sans encoding et lisible (pas de `/`, `+`, `=` ambigus pour copier-coller).

Implementation :
```typescript
const id = `pub_${base32Encode(hmac('sha256', SECRET).update(documentId).digest()).toLowerCase().slice(0, 16)}`;
// Exemple: pub_8a3fb2c9d1e4f7a0
```

### 3.7 12+ pieges techniques recenses (anti-patterns evites)

1. **Cache invalidation race condition** : si une revocation arrive pendant la generation de la reponse cachee, on pourrait servir un cache obsolete. Solution : invalidation `DEL verify:cache:{hash}` apres `UPDATE` row revocation (write-through), et lecture cache verifie age < TTL via `EXPIRE` Redis natif.
2. **X-Forwarded-For spoofing** : un client malveillant envoie `X-Forwarded-For: 1.2.3.4, 5.6.7.8` pour simuler IP arbitraire. Si on prend la premiere IP, on est trompable. Solution : prendre la **derniere IP** (set par notre proxy), ou mieux utiliser `X-Real-IP` set explicitement par nginx config trusted.
3. **IPv6 vs IPv4 rate limit keys** : `2a01:e0a:abc::1` et `2a01:e0a:abc::2` sont 2 IPs distinctes mais meme attaquant. Solution : pour IPv6, prendre le `/64` prefix (premiers 64 bits) comme cle rate limit (RFC 6177 prefix typique allocation utilisateur final).
4. **Locale detection edge cases ar-DZ vs ar-MA vs ar-EG** : Accept-Language `ar-DZ,ar;q=0.9,en;q=0.8` doit fallback sur `ar` (template AR generique). Solution : parser `Accept-Language` avec lib `accept-language-parser`, prendre top match dans liste supportee `['fr', 'fr-MA', 'ar', 'ar-MA', 'en']`, fallback `fr`.
5. **Hash collision SHA-512 cryptographic** : probabilite 2^-256 negligeable, mais attention si on accepte SHA-256 hash en input on doit valider longueur exacte et hex format avant lookup.
6. **Document re-signe = nouveau hash** : si un avenant modifie une police, le hash change. Le verify endpoint retourne 404 sur l'ancien hash. C'est correct semantiquement (l'ancien document n'est plus le current), mais on peut ajouter un endpoint `/verify/:hash/history` future Sprint 33 pour montrer chaine versions.
7. **public_id deterministe mais rotation secret** : si on rotate `ANONYMIZE_SECRET`, tous les `public_id` changent -> URLs publiques cassent. Solution : versioning secret `ANONYMIZE_SECRET_V1`, `ANONYMIZE_SECRET_V2`, prefix `pub_v1_8a3f...` ou `pub_v2_...`, lookup essaie v2 puis v1 (gracieux migration). Decision-024 : pas de rotation secret prevue avant 5 ans.
8. **Cache poisoning** : un attaquant pourrait essayer de forcer cache miss avec hash bidons puis observer latency pour deduire existence. Solution : cache aussi les 404 (TTL 60s) pour que latency soit identique entre hash existant et inexistant.
9. **CORS trop ouvert vs transparence** : `Access-Control-Allow-Origin: *` necessaire pour usage public mais doit exclure credentials. Solution : `Access-Control-Allow-Origin: *` mais NO `Access-Control-Allow-Credentials: true`, NO Cookie header in response, NO Set-Cookie.
10. **Timing attack sur comparaison hash** : si on compare hash en string equality, timing peut leak. Solution : utiliser `crypto.timingSafeEqual` pour la comparaison hash interne (mais ici on fait lookup DB indexed, donc moins critique).
11. **HTML XSS via hash echo** : si hash echo en HTML page sans escape, attaque XSS si hash contient `<script>`. Solution : Handlebars escape par defaut `{{hash}}`, validation Zod hash regex `^[a-f0-9]{128}$` reject avant render.
12. **HTML CSP strict** : page verify doit fonctionner sans JS externe, sans inline JS, sans inline CSS si possible. Solution : CSS embed via `<style>` tag avec hash-based CSP `style-src 'sha256-...'` ou `'unsafe-inline'` avec strict CSP autres directives. Decision-024 : `'unsafe-inline'` accepte temporairement, refactor v3.0 pour hash-based.
13. **i18n RTL Arabic edge cases** : numeros mixtes (date `2026-05-08`), URLs (LTR within RTL flow). Solution : `<bdi>` tags + `unicode-bidi: isolate` sur dates et URLs.
14. **Tenant deleted CNDP purge** : si un tenant exerce droit a l'oubli (Loi 09-08 art 9), tous ses documents sont purges du DB. Mais les **archives bucket S3 retention 10 ans legaux** restent (obligation conservation Loi 43-20). Decision-074 : verify endpoint continue de fonctionner via lookup archive bucket (read-only DB shadow), mais reponse anonymisee remplace tenant_name par "[Tenant supprime]". Dispute juridique non encore tranchee, on documente ouverture.
15. **Logging IP en clair vs CNDP** : IPs sont des donnees personnelles (CNDP Deliberation 478-2013). Solution : log IP **hashee SHA-256 + salt** dans audit logs long terme (90j+), IP en clair seulement dans logs temps-reel court terme (<24h).

## Section 4 - Architecture technique detaillee

### 4.1 Diagramme flow verification publique

```
Client (browser/QR scan/curl)
  |
  | GET /public/verify-doc/abc123...def?lang=fr
  | Headers: User-Agent: Mozilla/5.0, Accept-Language: fr-MA,fr;q=0.9
  | X-Forwarded-For: 196.168.1.50, 10.0.0.1
  V
[Fastify HTTP Server Skalean API]
  |
  V
[CORS Middleware] -- Allow-Origin: *, no credentials
  |
  V
[Public Verify Controller]
  |--> [Hash Validation Zod] (regex /^[a-f0-9]{128}$/)
  |--> [Extract Real IP] (X-Forwarded-For last hop, IPv6 /64 prefix)
  |--> [Rate Limiter Service] -- Redis ZADD/ZCARD sliding window 60/h
  |        |--> if > 60: throw 429 Retry-After: 3600
  |        |--> if > 100: emit Kafka audit.suspicious_verify
  |--> [Suspicious Detector Service]
  |        |--> heuristics: bot UA, freq, enumeration pattern
  |        |--> emit Kafka audit.suspicious_verify si detected
  |--> [Locale Detector] -- accept-language-parser fallback fr
  |--> [Verify Service] -- check Redis cache verify:cache:{hash}
  |        |--> hit: return cached
  |        |--> miss: query DB documents JOIN sig_signing_workflows
  |               |--> if not found: cache 404 60s, throw 404
  |               |--> if found: anonymize, mask PII, cache 300s
  |--> [Audit Logger] -- Pino info { hash, ip_hash, ua, locale, status }
  |--> [Response]
  |        |--> JSON path: VerifyResponseDto (Zod validated)
  |        |--> HTML path: render Handlebars verify-page.{locale}.hbs
  V
Client
```

### 4.2 Modele donnees backend (lecture seule, pas de migration cette tache)

L'endpoint lit dans des tables existantes creees par taches precedentes (Tache 3.3.1 documents, Tache 3.3.6 signing workflows, Tache 3.3.8 timestamps) :

```sql
-- Already exists from Tache 3.3.1
TABLE documents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  document_type VARCHAR(50),  -- police, devis, facture, avenant, sinistre, kyc, contrat
  hash_sha512 VARCHAR(128),   -- INDEX
  state VARCHAR(50),          -- draft, signed, archived, revoked
  signed_at TIMESTAMPTZ,
  archived_until TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ      -- soft delete
);
CREATE INDEX idx_documents_hash ON documents(hash_sha512) WHERE deleted_at IS NULL;

-- Already exists from Tache 3.3.6
TABLE sig_signing_workflows (
  id UUID PRIMARY KEY,
  document_id UUID REFERENCES documents(id),
  status VARCHAR(50),
  signers_metadata JSONB,    -- [{ user_id, full_name, email, role, signed_at }]
  signed_at TIMESTAMPTZ
);

-- Already exists from Tache 3.3.8
ALTER TABLE sig_signing_workflows
  ADD COLUMN tsa_timestamp_token TEXT,
  ADD COLUMN tsa_applied_at TIMESTAMPTZ,
  ADD COLUMN tsa_certificate_chain JSONB,
  ADD COLUMN tsa_serial_number VARCHAR(255),
  ADD COLUMN tsa_policy_oid VARCHAR(100),
  ADD COLUMN tsa_hash_algorithm VARCHAR(50) DEFAULT 'SHA-512';
```

Aucune migration a creer cette tache. Mais on cree une **vue SQL read-only public-safe** pour formaliser le contrat de donnees expose (et faciliter audit DBA) :

```sql
-- Vue creee dans une migration separe (a inserer dans Tache 3.3.1 si ajout possible, sinon migration dediee)
CREATE OR REPLACE VIEW v_public_verify AS
SELECT
  d.id AS document_id,
  d.document_type,
  d.hash_sha512,
  d.state,
  d.signed_at AS document_signed_at,
  d.archived_until,
  w.signers_metadata,
  w.tsa_applied_at,
  w.tsa_serial_number,
  w.tsa_policy_oid,
  w.tsa_hash_algorithm
FROM documents d
INNER JOIN sig_signing_workflows w ON w.document_id = d.id
WHERE d.deleted_at IS NULL
  AND d.state IN ('signed', 'archived');
COMMENT ON VIEW v_public_verify IS 'RGS Niveau 2 - vue read-only public verification, exclude PII reveal';
```

### 4.3 Cache strategy Redis

```
Key: verify:cache:{hash}
Value: JSON serialized VerifyResponseDto (or { _404: true } for negative cache)
TTL: 300 seconds (positive), 60 seconds (negative)

Invalidation events:
  - signature.revoked event consumer -> DEL verify:cache:{hash}
  - document.archived event consumer -> SET verify:cache:{hash} new TTL 300s

Memory budget:
  - Avg payload 1.2 KB serialized
  - 100 000 docs cached = 120 MB Redis
  - Redis instance reserved for cache: redis-cache.skalean (separate from rate-limit redis)
```

### 4.4 Rate limiter Redis sliding window log

Algorithme **sliding window log** (precis, mais cout memoire O(N)) pour 60/h :

```
Key: rl:verify:{ip_or_prefix}
Type: Sorted Set (ZSET)
Members: timestamp_ms_request_n
Scores: timestamp_ms_request_n

Operations atomiques (Lua script):
  1. ZREMRANGEBYSCORE key 0 (now - 3600000)  -- expire requetes > 1h
  2. ZADD key now now
  3. count = ZCARD key
  4. EXPIRE key 3600  -- garbage collection auto
  5. return count

  if count > 60: throw 429
  if count > 100: emit Kafka audit.suspicious
```

Lua script pour atomicite :
```lua
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
redis.call('ZADD', key, now, now)
local count = redis.call('ZCARD', key)
redis.call('EXPIRE', key, math.ceil(window / 1000))
return count
```

Memory budget rate limiter :
- Avg 30 req/h par IP active = 30 * 8 bytes ZSET member = 240 bytes
- 1000 IPs actives concurrentes = 240 KB
- Negligeable.

## Section 5 - Code complet executable

### 5.1 Controller `public-verify.controller.ts`

```typescript
// repo/apps/api/src/modules/signature/controllers/public-verify.controller.ts
import {
  Controller,
  Get,
  Param,
  Headers,
  Res,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  Inject,
  UseGuards,
  Header,
  Logger,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { Public } from '../../auth/decorators/public.decorator';
import { PublicVerifyService } from '../services/public-verify.service';
import { VerifyRateLimiterService } from '../services/verify-rate-limiter.service';
import { SuspiciousVerifyDetectorService } from '../services/suspicious-verify-detector.service';
import { PdfTemplatesService } from '../../../../packages/docs/src/services/pdf-templates.service';
import { HashSchema } from '../dto/verify-response.dto';
import { createHash } from 'crypto';
import * as acceptLanguageParser from 'accept-language-parser';

@ApiTags('public-verify')
@Controller('public/verify-doc')
@Public()
export class PublicVerifyController {
  private readonly logger = new Logger(PublicVerifyController.name);
  private readonly supportedLocales = ['fr', 'fr-MA', 'ar', 'ar-MA', 'en'];
  private readonly defaultLocale = 'fr';

  constructor(
    private readonly verifyService: PublicVerifyService,
    private readonly rateLimiter: VerifyRateLimiterService,
    private readonly suspiciousDetector: SuspiciousVerifyDetectorService,
    private readonly pdfTemplates: PdfTemplatesService,
  ) {}

  @Get(':hash')
  @Throttle({ default: { limit: 60, ttl: 3600000 } })
  @Header('Cache-Control', 'private, max-age=300')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('X-Frame-Options', 'DENY')
  @Header('Referrer-Policy', 'no-referrer')
  @ApiOperation({ summary: 'Public verification document by SHA-512 hash (RGS Niveau 2)' })
  @ApiParam({ name: 'hash', description: 'SHA-512 hex hash 128 chars' })
  @ApiResponse({ status: 200, description: 'Document signed and verified' })
  @ApiResponse({ status: 400, description: 'Invalid hash format' })
  @ApiResponse({ status: 404, description: 'Document not recognized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async verify(
    @Param('hash') hash: string,
    @Headers('x-forwarded-for') xForwardedFor: string | undefined,
    @Headers('x-real-ip') xRealIp: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Headers('accept') acceptHeader: string | undefined,
  ) {
    const parsed = HashSchema.safeParse({ hash });
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_HASH_FORMAT',
        message: 'Hash must be 128 hex chars (SHA-512)',
        details: parsed.error.format(),
      });
    }
    const validHash = parsed.data.hash.toLowerCase();
    const ip = this.extractRealIp(xForwardedFor, xRealIp);
    const ipHash = this.hashIp(ip);
    const ua = userAgent || 'unknown';

    await this.rateLimiter.consume(ip);

    const suspicious = await this.suspiciousDetector.evaluate({
      ip,
      userAgent: ua,
      hash: validHash,
      acceptHeader,
      acceptLanguage,
    });

    if (suspicious.isSuspicious) {
      this.logger.warn({
        msg: 'public_verify_suspicious',
        ip_hash: ipHash,
        ua,
        hash: validHash,
        reasons: suspicious.reasons,
      });
    }

    this.logger.log({
      msg: 'public_verify_request',
      ip_hash: ipHash,
      ua,
      hash: validHash,
      action: 'public_verify_request',
      suspicious: suspicious.isSuspicious,
    });

    const result = await this.verifyService.verifyByHash(validHash);

    if (!result) {
      this.logger.log({
        msg: 'public_verify_not_found',
        ip_hash: ipHash,
        hash: validHash,
      });
      throw new NotFoundException({
        code: 'DOCUMENT_NOT_RECOGNIZED',
        message: 'No document matches this hash. The document may not exist or may have been generated by another system.',
      });
    }

    return result;
  }

  @Get(':hash/page')
  @Throttle({ default: { limit: 60, ttl: 3600000 } })
  @Header('Cache-Control', 'private, max-age=300')
  @Header('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'none'; frame-ancestors 'none'")
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('X-Frame-Options', 'DENY')
  async verifyPage(
    @Param('hash') hash: string,
    @Headers('x-forwarded-for') xForwardedFor: string | undefined,
    @Headers('x-real-ip') xRealIp: string | undefined,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    const parsed = HashSchema.safeParse({ hash });
    if (!parsed.success) {
      const html = await this.renderErrorPage('fr', 'INVALID_HASH', 'Hash invalide');
      res.type('text/html; charset=utf-8').status(400).send(html);
      return;
    }
    const validHash = parsed.data.hash.toLowerCase();
    const ip = this.extractRealIp(xForwardedFor, xRealIp);
    const ipHash = this.hashIp(ip);
    const ua = userAgent || 'unknown';
    const locale = this.detectLocale(acceptLanguage);

    await this.rateLimiter.consume(ip);

    this.logger.log({
      msg: 'public_verify_page_request',
      ip_hash: ipHash,
      ua,
      hash: validHash,
      locale,
    });

    const result = await this.verifyService.verifyByHash(validHash);

    const templateName = locale.startsWith('ar') ? 'ar/verify-page' : 'verify-page';
    const html = await this.pdfTemplates.render(templateName, {
      hash: validHash,
      result,
      found: result !== null,
      locale,
      verificationUrl: `${process.env.PUBLIC_VERIFY_BASE_URL || 'https://api.skalean-insurtech.ma/verify'}/${validHash}`,
      generatedAt: new Date().toISOString(),
    });

    res.type('text/html; charset=utf-8').status(result ? 200 : 404).send(html);
  }

  private extractRealIp(xForwardedFor: string | undefined, xRealIp: string | undefined): string {
    if (xRealIp && this.isValidIp(xRealIp)) {
      return this.normalizeIp(xRealIp);
    }
    if (xForwardedFor) {
      const ips = xForwardedFor.split(',').map((s) => s.trim());
      const lastIp = ips[ips.length - 1];
      if (this.isValidIp(lastIp)) {
        return this.normalizeIp(lastIp);
      }
    }
    return '0.0.0.0';
  }

  private isValidIp(ip: string): boolean {
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-f:]+$/i;
    return ipv4.test(ip) || ipv6.test(ip);
  }

  private normalizeIp(ip: string): string {
    if (ip.includes(':')) {
      const parts = ip.split(':').slice(0, 4);
      return parts.join(':') + '::/64';
    }
    return ip;
  }

  private hashIp(ip: string): string {
    const salt = process.env.IP_HASH_SALT || 'skalean-default-salt';
    return createHash('sha256').update(`${ip}:${salt}`).digest('hex').slice(0, 16);
  }

  private detectLocale(acceptLanguage: string | undefined): string {
    if (!acceptLanguage) return this.defaultLocale;
    const detected = acceptLanguageParser.pick(this.supportedLocales, acceptLanguage, { loose: true });
    return detected || this.defaultLocale;
  }

  private async renderErrorPage(locale: string, code: string, message: string): Promise<string> {
    return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>Erreur</title></head><body><h1>${code}</h1><p>${message}</p></body></html>`;
  }
}
```

### 5.2 Service `public-verify.service.ts`

```typescript
// repo/apps/api/src/modules/signature/services/public-verify.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Document } from '../entities/document.entity';
import { SigningWorkflow } from '../entities/signing-workflow.entity';
import { AnonymizeVerificationIdService } from './anonymize-verification-id.service';
import { VerifyResponseDto, VerifyResponseDtoSchema } from '../dto/verify-response.dto';

@Injectable()
export class PublicVerifyService {
  private readonly logger = new Logger(PublicVerifyService.name);
  private readonly cacheTtlPositive = parseInt(process.env.PUBLIC_VERIFY_CACHE_TTL_SECONDS || '300', 10);
  private readonly cacheTtlNegative = 60;
  private readonly baseUrl = process.env.PUBLIC_VERIFY_BASE_URL || 'https://api.skalean-insurtech.ma/verify';

  constructor(
    @InjectRepository(Document) private readonly documentRepo: Repository<Document>,
    @InjectRepository(SigningWorkflow) private readonly workflowRepo: Repository<SigningWorkflow>,
    @Inject('REDIS_CACHE') private readonly redis: Redis,
    private readonly anonymizer: AnonymizeVerificationIdService,
  ) {}

  async verifyByHash(hash: string): Promise<VerifyResponseDto | null> {
    const cacheKey = `verify:cache:${hash}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed._404) {
        return null;
      }
      return parsed as VerifyResponseDto;
    }

    const document = await this.documentRepo
      .createQueryBuilder('d')
      .innerJoinAndSelect(SigningWorkflow, 'w', 'w.document_id = d.id')
      .where('d.hash_sha512 = :hash', { hash })
      .andWhere('d.deleted_at IS NULL')
      .andWhere("d.state IN ('signed', 'archived')")
      .getRawOne();

    if (!document) {
      await this.redis.setex(cacheKey, this.cacheTtlNegative, JSON.stringify({ _404: true }));
      return null;
    }

    const dto = await this.buildPublicSafeDto(document, hash);

    const validated = VerifyResponseDtoSchema.parse(dto);

    await this.redis.setex(cacheKey, this.cacheTtlPositive, JSON.stringify(validated));

    return validated;
  }

  private async buildPublicSafeDto(row: any, hash: string): Promise<VerifyResponseDto> {
    const documentPublicId = await this.anonymizer.anonymize(row.d_id);
    const verificationId = await this.anonymizer.anonymize(`verif:${row.d_id}`);

    const signersRaw = row.w_signers_metadata || [];
    const signersAnonymized = (Array.isArray(signersRaw) ? signersRaw : []).map((s: any) => ({
      initial: this.extractInitials(s.full_name || s.name || 'XX'),
      role: s.role || 'signer',
      signed_at: s.signed_at || row.w_signed_at,
    }));

    const archivedUntil = row.d_archived_until || this.computeArchivedUntil(row.d_signed_at);

    return {
      document_public_id: documentPublicId,
      document_type: row.d_document_type,
      signed_at: this.toIsoString(row.d_signed_at || row.w_signed_at),
      tsa_timestamp_applied_at: this.toIsoString(row.w_tsa_applied_at),
      tsa_serial_number: row.w_tsa_serial_number || null,
      tsa_policy_oid: row.w_tsa_policy_oid || null,
      tsa_hash_algorithm: row.w_tsa_hash_algorithm || 'SHA-512',
      signers_count: signersAnonymized.length,
      signers_anonymized: signersAnonymized,
      hash,
      hash_algorithm: 'SHA-512',
      archive_locked_until: this.toIsoString(archivedUntil),
      verification_id: verificationId,
      verification_url: `${this.baseUrl}/${hash}`,
      state: row.d_state,
      legal_basis: 'Loi 43-20 art 7',
      verified_at: new Date().toISOString(),
    };
  }

  private extractInitials(fullName: string): string {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'XX';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  private computeArchivedUntil(signedAt: Date | string | null): Date | string | null {
    if (!signedAt) return null;
    const d = new Date(signedAt);
    d.setFullYear(d.getFullYear() + 10);
    return d;
  }

  private toIsoString(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    return new Date(value).toISOString();
  }

  async invalidateCache(hash: string): Promise<void> {
    await this.redis.del(`verify:cache:${hash}`);
    this.logger.log({ msg: 'public_verify_cache_invalidated', hash });
  }
}
```

### 5.3 Service `anonymize-verification-id.service.ts`

```typescript
// repo/apps/api/src/modules/signature/services/anonymize-verification-id.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';

@Injectable()
export class AnonymizeVerificationIdService implements OnModuleInit {
  private readonly logger = new Logger(AnonymizeVerificationIdService.name);
  private secret: string;
  private secretVersion: string = 'v1';
  private readonly base32Alphabet = 'abcdefghijklmnopqrstuvwxyz234567';

  onModuleInit(): void {
    const secretFromEnv = process.env.PUBLIC_VERIFY_ANONYMIZE_SECRET;
    if (!secretFromEnv || secretFromEnv.length < 32) {
      throw new Error(
        'PUBLIC_VERIFY_ANONYMIZE_SECRET must be set and >= 32 chars (RGS Niveau 2 requirement)',
      );
    }
    this.secret = secretFromEnv;
    this.secretVersion = process.env.PUBLIC_VERIFY_ANONYMIZE_SECRET_VERSION || 'v1';
    this.logger.log({ msg: 'anonymize_id_service_initialized', version: this.secretVersion });
  }

  async anonymize(internalId: string): Promise<string> {
    if (!internalId || typeof internalId !== 'string') {
      throw new Error('internalId required for anonymize');
    }
    const hmac = createHmac('sha256', this.secret).update(internalId).digest();
    const encoded = this.base32Encode(hmac);
    const truncated = encoded.slice(0, 16);
    return `pub_${truncated}`;
  }

  async anonymizeBatch(internalIds: string[]): Promise<string[]> {
    return Promise.all(internalIds.map((id) => this.anonymize(id)));
  }

  private base32Encode(buffer: Buffer): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i];
      bits += 8;
      while (bits >= 5) {
        output += this.base32Alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += this.base32Alphabet[(value << (5 - bits)) & 31];
    }
    return output;
  }

  isValidPublicId(publicId: string): boolean {
    return /^pub_[a-z2-7]{16}$/.test(publicId);
  }
}
```

### 5.4 Service `verify-rate-limiter.service.ts`

```typescript
// repo/apps/api/src/modules/signature/services/verify-rate-limiter.service.ts
import { Injectable, HttpException, HttpStatus, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ProducerService } from '../../kafka/producer.service';

@Injectable()
export class VerifyRateLimiterService implements OnModuleInit {
  private readonly logger = new Logger(VerifyRateLimiterService.name);
  private readonly limit = parseInt(process.env.PUBLIC_VERIFY_RATE_LIMIT_PER_HOUR || '60', 10);
  private readonly suspiciousThreshold = parseInt(
    process.env.PUBLIC_VERIFY_RATE_LIMIT_SUSPICIOUS || '100',
    10,
  );
  private readonly windowMs = 3600000;
  private readonly whitelistIps: Set<string>;
  private readonly luaScriptSha: string | null = null;

  constructor(
    @Inject('REDIS_RATELIMIT') private readonly redis: Redis,
    private readonly kafkaProducer: ProducerService,
  ) {
    const whitelist = process.env.PUBLIC_VERIFY_RATE_LIMIT_WHITELIST_IPS || '';
    this.whitelistIps = new Set(whitelist.split(',').map((s) => s.trim()).filter(Boolean));
  }

  async onModuleInit(): Promise<void> {
    this.logger.log({
      msg: 'verify_rate_limiter_initialized',
      limit: this.limit,
      suspicious_threshold: this.suspiciousThreshold,
      window_ms: this.windowMs,
      whitelist_count: this.whitelistIps.size,
    });
  }

  async consume(ip: string): Promise<void> {
    if (this.whitelistIps.has(ip)) {
      return;
    }
    const key = `rl:verify:${ip}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowStart = tonumber(ARGV[2])
      local windowSec = tonumber(ARGV[3])
      redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
      redis.call('ZADD', key, now, now)
      local count = redis.call('ZCARD', key)
      redis.call('EXPIRE', key, windowSec)
      return count
    `;

    const count = (await this.redis.eval(
      luaScript,
      1,
      key,
      now.toString(),
      windowStart.toString(),
      Math.ceil(this.windowMs / 1000).toString(),
    )) as number;

    if (count > this.suspiciousThreshold) {
      await this.emitSuspicious(ip, count);
    }

    if (count > this.limit) {
      throw new HttpException(
        {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit ${this.limit}/h exceeded for IP. Retry after 1 hour.`,
          retry_after_seconds: 3600,
          legal_basis: 'RGS Niveau 2 anti-DoS',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async emitSuspicious(ip: string, count: number): Promise<void> {
    try {
      await this.kafkaProducer.send({
        topic: 'audit.suspicious_verify',
        messages: [
          {
            key: ip,
            value: JSON.stringify({
              event_type: 'rate_limit_suspicious',
              ip,
              count_in_window: count,
              window_ms: this.windowMs,
              threshold: this.suspiciousThreshold,
              detected_at: new Date().toISOString(),
            }),
          },
        ],
      });
      this.logger.warn({ msg: 'verify_rate_limit_suspicious_emitted', ip, count });
    } catch (err) {
      this.logger.error({ msg: 'verify_kafka_emit_failed', err: err.message });
    }
  }

  async getCurrentCount(ip: string): Promise<number> {
    const key = `rl:verify:${ip}`;
    const now = Date.now();
    await this.redis.zremrangebyscore(key, 0, now - this.windowMs);
    return await this.redis.zcard(key);
  }

  async resetForIp(ip: string): Promise<void> {
    await this.redis.del(`rl:verify:${ip}`);
  }
}
```

### 5.5 Service `suspicious-verify-detector.service.ts`

```typescript
// repo/apps/api/src/modules/signature/services/suspicious-verify-detector.service.ts
import { Injectable, Logger, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ProducerService } from '../../kafka/producer.service';

export interface SuspiciousEvalInput {
  ip: string;
  userAgent: string;
  hash: string;
  acceptHeader: string | undefined;
  acceptLanguage: string | undefined;
}

export interface SuspiciousEvalResult {
  isSuspicious: boolean;
  reasons: string[];
  score: number;
}

@Injectable()
export class SuspiciousVerifyDetectorService {
  private readonly logger = new Logger(SuspiciousVerifyDetectorService.name);
  private readonly botPatterns: RegExp[] = [
    /curl\//i,
    /wget\//i,
    /python-requests/i,
    /python-urllib/i,
    /Go-http-client/i,
    /Java\//i,
    /scrapy/i,
    /^okhttp/i,
    /HttpClient/i,
    /node-fetch/i,
    /axios/i,
    /^Mozilla\/5\.0$/i,
    /headless/i,
    /phantomjs/i,
    /selenium/i,
  ];

  private readonly burstWindowSec = 60;
  private readonly burstThreshold = 10;
  private readonly enumerationDistanceThreshold = 4;

  constructor(
    @Inject('REDIS_RATELIMIT') private readonly redis: Redis,
    private readonly kafkaProducer: ProducerService,
  ) {}

  async evaluate(input: SuspiciousEvalInput): Promise<SuspiciousEvalResult> {
    const reasons: string[] = [];
    let score = 0;

    if (this.isBotUserAgent(input.userAgent)) {
      reasons.push('bot_user_agent');
      score += 30;
    }

    if (!input.acceptHeader || input.acceptHeader.length < 5) {
      reasons.push('missing_accept_header');
      score += 10;
    }

    if (!input.acceptLanguage) {
      reasons.push('missing_accept_language');
      score += 10;
    }

    const burstCount = await this.recordAndGetBurst(input.ip);
    if (burstCount > this.burstThreshold) {
      reasons.push(`burst_high_frequency_${burstCount}_in_${this.burstWindowSec}s`);
      score += 40;
    }

    const enumerationDetected = await this.detectEnumeration(input.ip, input.hash);
    if (enumerationDetected) {
      reasons.push('sequential_hash_enumeration');
      score += 50;
    }

    const isSuspicious = score >= 30;

    if (isSuspicious) {
      await this.emitKafkaSuspicious({
        ip: input.ip,
        userAgent: input.userAgent,
        hash: input.hash,
        score,
        reasons,
      });
    }

    return { isSuspicious, reasons, score };
  }

  private isBotUserAgent(ua: string): boolean {
    if (!ua || ua.length < 5) return true;
    return this.botPatterns.some((pattern) => pattern.test(ua));
  }

  private async recordAndGetBurst(ip: string): Promise<number> {
    const key = `susp:burst:${ip}`;
    const now = Date.now();
    const windowStart = now - this.burstWindowSec * 1000;
    const luaScript = `
      local key = KEYS[1]
      local now = tonumber(ARGV[1])
      local windowStart = tonumber(ARGV[2])
      redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)
      redis.call('ZADD', key, now, now)
      redis.call('EXPIRE', key, ARGV[3])
      return redis.call('ZCARD', key)
    `;
    const count = (await this.redis.eval(
      luaScript,
      1,
      key,
      now.toString(),
      windowStart.toString(),
      this.burstWindowSec.toString(),
    )) as number;
    return count;
  }

  private async detectEnumeration(ip: string, hash: string): Promise<boolean> {
    const key = `susp:enum:${ip}`;
    const recentHashes = await this.redis.lrange(key, 0, 9);
    await this.redis.lpush(key, hash);
    await this.redis.ltrim(key, 0, 9);
    await this.redis.expire(key, 300);

    if (recentHashes.length < 3) return false;

    const currentInt = this.hashFirstChunkToBigInt(hash);
    let sequentialCount = 0;
    for (const previousHash of recentHashes) {
      const previousInt = this.hashFirstChunkToBigInt(previousHash);
      const distance = currentInt > previousInt ? currentInt - previousInt : previousInt - currentInt;
      if (distance < BigInt(this.enumerationDistanceThreshold)) {
        sequentialCount++;
      }
    }
    return sequentialCount >= 2;
  }

  private hashFirstChunkToBigInt(hash: string): bigint {
    const chunk = hash.slice(0, 16);
    return BigInt('0x' + chunk);
  }

  private async emitKafkaSuspicious(payload: {
    ip: string;
    userAgent: string;
    hash: string;
    score: number;
    reasons: string[];
  }): Promise<void> {
    try {
      await this.kafkaProducer.send({
        topic: 'audit.suspicious_verify',
        messages: [
          {
            key: payload.ip,
            value: JSON.stringify({
              event_type: 'suspicious_verify_request',
              ...payload,
              detected_at: new Date().toISOString(),
            }),
          },
        ],
      });
    } catch (err) {
      this.logger.error({ msg: 'suspicious_kafka_emit_failed', err: err.message });
    }
  }
}
```

### 5.6 Middleware `public-verify-cors.middleware.ts`

```typescript
// repo/apps/api/src/modules/signature/middleware/public-verify-cors.middleware.ts
import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class PublicVerifyCorsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PublicVerifyCorsMiddleware.name);

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Accept-Language, User-Agent');
    res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    next();
  }
}
```

### 5.7 DTO `verify-response.dto.ts`

```typescript
// repo/apps/api/src/modules/signature/dto/verify-response.dto.ts
import { z } from 'zod';

export const HashSchema = z.object({
  hash: z
    .string()
    .regex(/^[a-fA-F0-9]{128}$/, 'Hash must be 128 hex chars (SHA-512)')
    .transform((s) => s.toLowerCase()),
});

const SignerAnonymizedSchema = z.object({
  initial: z.string().regex(/^[A-Z]{2}$/, 'Initial must be 2 uppercase letters'),
  role: z.enum(['signer', 'witness', 'notary', 'guarantor']),
  signed_at: z.string().datetime().nullable(),
});

export const DocumentTypeEnum = z.enum([
  'police',
  'devis',
  'facture',
  'avenant',
  'sinistre',
  'kyc',
  'contrat',
]);

export const VerifyResponseDtoSchema = z.object({
  document_public_id: z.string().regex(/^pub_[a-z2-7]{16}$/, 'Invalid public id format'),
  document_type: DocumentTypeEnum,
  signed_at: z.string().datetime().nullable(),
  tsa_timestamp_applied_at: z.string().datetime().nullable(),
  tsa_serial_number: z.string().nullable(),
  tsa_policy_oid: z.string().nullable(),
  tsa_hash_algorithm: z.string().default('SHA-512'),
  signers_count: z.number().int().nonnegative(),
  signers_anonymized: z.array(SignerAnonymizedSchema),
  hash: z.string().regex(/^[a-f0-9]{128}$/),
  hash_algorithm: z.literal('SHA-512'),
  archive_locked_until: z.string().datetime().nullable(),
  verification_id: z.string().regex(/^pub_[a-z2-7]{16}$/),
  verification_url: z.string().url(),
  state: z.enum(['signed', 'archived']),
  legal_basis: z.literal('Loi 43-20 art 7'),
  verified_at: z.string().datetime(),
});

export type VerifyResponseDto = z.infer<typeof VerifyResponseDtoSchema>;
export type SignerAnonymized = z.infer<typeof SignerAnonymizedSchema>;
```

### 5.8 Template Handlebars FR `verify-page.hbs`

```html
<!-- repo/packages/docs/src/templates/verify-page.hbs -->
<!DOCTYPE html>
<html lang="fr" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <title>Verification document - Skalean InsurTech</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #1a202c;
      background: #f7fafc;
      min-height: 100vh;
      padding: 2rem 1rem;
    }
    .container { max-width: 720px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      color: white;
      padding: 2rem;
      border-radius: 0.75rem 0.75rem 0 0;
      text-align: center;
    }
    .header h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
    .header .subtitle { font-size: 0.875rem; opacity: 0.9; }
    .badge-success {
      display: inline-block;
      background: #d1fae5;
      color: #065f46;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
      margin: 1rem 0;
    }
    .badge-error {
      display: inline-block;
      background: #fee2e2;
      color: #991b1b;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 600;
      font-size: 0.875rem;
      margin: 1rem 0;
    }
    .card {
      background: white;
      border: 1px solid #e2e8f0;
      padding: 2rem;
    }
    .card-section { padding: 1.5rem 0; border-bottom: 1px solid #e2e8f0; }
    .card-section:last-child { border-bottom: 0; }
    .card-section h2 { font-size: 1rem; color: #4a5568; margin-bottom: 0.75rem; font-weight: 600; }
    .data-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }
    .data-item { padding: 0.5rem 0; }
    .data-label { font-size: 0.75rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; }
    .data-value { font-size: 0.9375rem; color: #1a202c; font-weight: 500; word-break: break-all; }
    .hash-display {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.75rem;
      background: #f7fafc;
      padding: 0.75rem;
      border-radius: 0.375rem;
      word-break: break-all;
      border: 1px solid #e2e8f0;
    }
    .signers-list { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .signer-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #ede9fe;
      color: #5b21b6;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.875rem;
    }
    .signer-initial {
      width: 1.75rem;
      height: 1.75rem;
      background: #5b21b6;
      color: white;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.75rem;
    }
    .footer {
      background: #1a202c;
      color: #cbd5e0;
      padding: 1.5rem 2rem;
      border-radius: 0 0 0.75rem 0.75rem;
      font-size: 0.75rem;
      line-height: 1.7;
    }
    .footer a { color: #93c5fd; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .legal-disclaimer {
      background: #fffbeb;
      border-left: 4px solid #f59e0b;
      padding: 1rem;
      margin: 1.5rem 0;
      font-size: 0.8125rem;
      color: #78350f;
    }
    .lang-switcher { text-align: center; margin: 1rem 0; font-size: 0.75rem; }
    .lang-switcher a { color: #4a5568; text-decoration: none; padding: 0.25rem 0.5rem; }
    .lang-switcher a.active { font-weight: 700; color: #1e3a8a; }
    @media (max-width: 480px) {
      body { padding: 1rem 0.5rem; }
      .header, .card, .footer { padding: 1.25rem; }
      .data-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Skalean InsurTech</h1>
      <div class="subtitle">Verification publique signature electronique qualifiee</div>
    </div>
    <div class="card">
      {{#if found}}
        <div style="text-align: center;">
          <div class="badge-success">Document verifie avec succes</div>
          <p style="color: #4a5568; font-size: 0.9375rem;">Ce document a bien ete signe via la plateforme Skalean InsurTech, conformement a la Loi 43-20 sur les services de confiance pour les transactions electroniques.</p>
        </div>

        <div class="card-section">
          <h2>Identifiant du document</h2>
          <div class="data-grid">
            <div class="data-item">
              <div class="data-label">Identifiant public anonymise</div>
              <div class="data-value">{{result.document_public_id}}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Type de document</div>
              <div class="data-value">{{result.document_type}}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Etat</div>
              <div class="data-value">{{result.state}}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Identifiant verification</div>
              <div class="data-value">{{result.verification_id}}</div>
            </div>
          </div>
        </div>

        <div class="card-section">
          <h2>Empreinte cryptographique</h2>
          <div class="data-item">
            <div class="data-label">Hash SHA-512 (128 caracteres hexadecimaux)</div>
            <div class="hash-display">{{result.hash}}</div>
          </div>
          <div class="data-item" style="margin-top: 0.75rem;">
            <div class="data-label">Algorithme</div>
            <div class="data-value">{{result.hash_algorithm}}</div>
          </div>
        </div>

        <div class="card-section">
          <h2>Horodatage qualifie ANRT (RFC 3161)</h2>
          <div class="data-grid">
            <div class="data-item">
              <div class="data-label">Date d'horodatage</div>
              <div class="data-value">{{result.tsa_timestamp_applied_at}}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Numero de serie TSA</div>
              <div class="data-value">{{result.tsa_serial_number}}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Politique TSA (OID)</div>
              <div class="data-value">{{result.tsa_policy_oid}}</div>
            </div>
            <div class="data-item">
              <div class="data-label">Algorithme hash TSA</div>
              <div class="data-value">{{result.tsa_hash_algorithm}}</div>
            </div>
          </div>
        </div>

        <div class="card-section">
          <h2>Signataires ({{result.signers_count}})</h2>
          <div class="signers-list">
            {{#each result.signers_anonymized}}
              <div class="signer-pill">
                <span class="signer-initial">{{this.initial}}</span>
                <span>{{this.role}} - {{this.signed_at}}</span>
              </div>
            {{/each}}
          </div>
          <p style="font-size: 0.75rem; color: #718096; margin-top: 0.75rem;">Les noms complets, emails et coordonnees des signataires sont masques conformement au principe de minimisation des donnees (Loi 09-08 article 4 - CNDP).</p>
        </div>

        <div class="card-section">
          <h2>Conservation legale</h2>
          <div class="data-item">
            <div class="data-label">Document conserve jusqu'au</div>
            <div class="data-value">{{result.archive_locked_until}}</div>
          </div>
          <p style="font-size: 0.75rem; color: #718096; margin-top: 0.5rem;">Conformement a l'article 5 de la Loi 43-20, le document signe est archive pendant une duree minimale de 10 ans a compter de sa date de signature, dans un coffre-fort numerique conforme NF Z42-013.</p>
        </div>

        <div class="legal-disclaimer">
          <strong>Mention legale (Loi 43-20 article 7)</strong>
          <p style="margin-top: 0.5rem;">Cette verification atteste que le document dont l'empreinte numerique correspond au hash ci-dessus a bien ete signe electroniquement de maniere qualifiee via la plateforme Skalean InsurTech. La signature electronique qualifiee a la meme valeur juridique qu'une signature manuscrite (article 4 Loi 43-20). Toute alteration ou usage frauduleux de ce document expose son auteur aux sanctions prevues par les articles 351 et suivants du Code Penal marocain (faux et usage de faux : reclusion de 5 a 10 ans).</p>
        </div>
      {{else}}
        <div style="text-align: center; padding: 3rem 1rem;">
          <div class="badge-error">Document non reconnu</div>
          <h2 style="font-size: 1.25rem; color: #1a202c; margin: 1rem 0;">Aucun document Skalean InsurTech ne correspond a ce hash</h2>
          <p style="color: #4a5568; font-size: 0.9375rem; max-width: 480px; margin: 0 auto;">Le hash fourni n'est associe a aucun document signe sur notre plateforme. Verifiez :</p>
          <ul style="text-align: left; max-width: 480px; margin: 1rem auto; color: #4a5568; font-size: 0.875rem;">
            <li>Que vous avez bien copie le hash complet (128 caracteres hexadecimaux)</li>
            <li>Que le document a bien ete signe via Skalean InsurTech (et non un autre prestataire)</li>
            <li>Que le document n'a pas ete modifie apres signature (toute modification change le hash)</li>
          </ul>
          <div style="margin-top: 1.5rem;">
            <div class="data-label">Hash recherche</div>
            <div class="hash-display">{{hash}}</div>
          </div>
        </div>
      {{/if}}
    </div>
    <div class="footer">
      <p>Verification effectuee le {{generatedAt}}</p>
      <p style="margin-top: 0.5rem;">Skalean InsurTech - Prestataire de services de confiance qualifie ANRT</p>
      <p style="margin-top: 0.5rem;">Plus d'informations : <a href="https://skalean-insurtech.ma/legal/loi-43-20">Loi 43-20</a> | <a href="https://skalean-insurtech.ma/legal/cndp">CNDP - Loi 09-08</a> | <a href="https://www.anrt.ma">ANRT</a></p>
      <div class="lang-switcher">
        <a href="?lang=fr" class="active">Francais</a>
        |
        <a href="?lang=ar">العربية</a>
        |
        <a href="?lang=en">English</a>
      </div>
    </div>
  </div>
</body>
</html>
```

### 5.9 Template Handlebars AR `ar/verify-page.hbs`

```html
<!-- repo/packages/docs/src/templates/ar/verify-page.hbs -->
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <meta name="referrer" content="no-referrer">
  <title>التحقق من الوثيقة - سكاليان إنشورتيك</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { font-size: 16px; }
    body {
      font-family: 'Tajawal', 'Cairo', 'Amiri', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      line-height: 1.7;
      color: #1a202c;
      background: #f7fafc;
      min-height: 100vh;
      padding: 2rem 1rem;
      direction: rtl;
      text-align: right;
    }
    .container { max-width: 720px; margin: 0 auto; }
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
      color: white;
      padding: 2rem;
      border-radius: 0.75rem 0.75rem 0 0;
      text-align: center;
    }
    .header h1 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem; }
    .header .subtitle { font-size: 0.875rem; opacity: 0.9; }
    .badge-success {
      display: inline-block;
      background: #d1fae5;
      color: #065f46;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.875rem;
      margin: 1rem 0;
    }
    .badge-error {
      display: inline-block;
      background: #fee2e2;
      color: #991b1b;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-weight: 700;
      font-size: 0.875rem;
      margin: 1rem 0;
    }
    .card {
      background: white;
      border: 1px solid #e2e8f0;
      padding: 2rem;
    }
    .card-section { padding: 1.5rem 0; border-bottom: 1px solid #e2e8f0; }
    .card-section:last-child { border-bottom: 0; }
    .card-section h2 { font-size: 1rem; color: #4a5568; margin-bottom: 0.75rem; font-weight: 700; }
    .data-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 0.75rem; }
    .data-item { padding: 0.5rem 0; }
    .data-label { font-size: 0.75rem; color: #718096; }
    .data-value { font-size: 0.9375rem; color: #1a202c; font-weight: 500; word-break: break-all; }
    .hash-display {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.75rem;
      background: #f7fafc;
      padding: 0.75rem;
      border-radius: 0.375rem;
      word-break: break-all;
      border: 1px solid #e2e8f0;
      direction: ltr;
      text-align: left;
      unicode-bidi: isolate;
    }
    .iso-date {
      direction: ltr;
      unicode-bidi: isolate;
      display: inline-block;
    }
    .signers-list { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .signer-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: #ede9fe;
      color: #5b21b6;
      padding: 0.5rem 1rem;
      border-radius: 9999px;
      font-size: 0.875rem;
    }
    .signer-initial {
      width: 1.75rem;
      height: 1.75rem;
      background: #5b21b6;
      color: white;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.75rem;
      direction: ltr;
    }
    .footer {
      background: #1a202c;
      color: #cbd5e0;
      padding: 1.5rem 2rem;
      border-radius: 0 0 0.75rem 0.75rem;
      font-size: 0.75rem;
      line-height: 1.8;
    }
    .footer a { color: #93c5fd; text-decoration: none; }
    .legal-disclaimer {
      background: #fffbeb;
      border-right: 4px solid #f59e0b;
      padding: 1rem;
      margin: 1.5rem 0;
      font-size: 0.8125rem;
      color: #78350f;
    }
    .lang-switcher { text-align: center; margin: 1rem 0; font-size: 0.75rem; direction: ltr; }
    .lang-switcher a { color: #4a5568; text-decoration: none; padding: 0.25rem 0.5rem; }
    .lang-switcher a.active { font-weight: 700; color: #1e3a8a; }
    @media (max-width: 480px) {
      body { padding: 1rem 0.5rem; }
      .header, .card, .footer { padding: 1.25rem; }
      .data-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>سكاليان إنشورتيك</h1>
      <div class="subtitle">التحقق العمومي من التوقيع الإلكتروني المؤهل</div>
    </div>
    <div class="card">
      {{#if found}}
        <div style="text-align: center;">
          <div class="badge-success">تم التحقق من الوثيقة بنجاح</div>
          <p style="color: #4a5568; font-size: 0.9375rem;">هذه الوثيقة موقعة بشكل قانوني عبر منصة سكاليان إنشورتيك، طبقا للقانون 43-20 المتعلق بخدمات الثقة للمعاملات الإلكترونية.</p>
        </div>

        <div class="card-section">
          <h2>معرف الوثيقة</h2>
          <div class="data-grid">
            <div class="data-item">
              <div class="data-label">المعرف العمومي المجهول</div>
              <div class="data-value"><bdi>{{result.document_public_id}}</bdi></div>
            </div>
            <div class="data-item">
              <div class="data-label">نوع الوثيقة</div>
              <div class="data-value">{{result.document_type}}</div>
            </div>
            <div class="data-item">
              <div class="data-label">الحالة</div>
              <div class="data-value">{{result.state}}</div>
            </div>
            <div class="data-item">
              <div class="data-label">معرف التحقق</div>
              <div class="data-value"><bdi>{{result.verification_id}}</bdi></div>
            </div>
          </div>
        </div>

        <div class="card-section">
          <h2>البصمة الرقمية</h2>
          <div class="data-item">
            <div class="data-label">SHA-512 (128 محرف ست عشري)</div>
            <div class="hash-display">{{result.hash}}</div>
          </div>
          <div class="data-item" style="margin-top: 0.75rem;">
            <div class="data-label">الخوارزمية</div>
            <div class="data-value">{{result.hash_algorithm}}</div>
          </div>
        </div>

        <div class="card-section">
          <h2>الطابع الزمني المؤهل ANRT (RFC 3161)</h2>
          <div class="data-grid">
            <div class="data-item">
              <div class="data-label">تاريخ الطابع الزمني</div>
              <div class="data-value"><span class="iso-date">{{result.tsa_timestamp_applied_at}}</span></div>
            </div>
            <div class="data-item">
              <div class="data-label">رقم تسلسل TSA</div>
              <div class="data-value"><bdi>{{result.tsa_serial_number}}</bdi></div>
            </div>
            <div class="data-item">
              <div class="data-label">سياسة TSA (OID)</div>
              <div class="data-value"><bdi>{{result.tsa_policy_oid}}</bdi></div>
            </div>
          </div>
        </div>

        <div class="card-section">
          <h2>الموقعون ({{result.signers_count}})</h2>
          <div class="signers-list">
            {{#each result.signers_anonymized}}
              <div class="signer-pill">
                <span class="signer-initial">{{this.initial}}</span>
                <span>{{this.role}} - <span class="iso-date">{{this.signed_at}}</span></span>
              </div>
            {{/each}}
          </div>
          <p style="font-size: 0.75rem; color: #718096; margin-top: 0.75rem;">الأسماء الكاملة والبريد الإلكتروني وبيانات الاتصال للموقعين مخفية وفقا لمبدأ تقليل البيانات (المادة 4 من القانون 09-08 - CNDP).</p>
        </div>

        <div class="card-section">
          <h2>الحفظ القانوني</h2>
          <div class="data-item">
            <div class="data-label">الوثيقة محفوظة حتى</div>
            <div class="data-value"><span class="iso-date">{{result.archive_locked_until}}</span></div>
          </div>
          <p style="font-size: 0.75rem; color: #718096; margin-top: 0.5rem;">طبقا للمادة 5 من القانون 43-20، تُحفظ الوثيقة الموقعة لمدة 10 سنوات على الأقل من تاريخ التوقيع، في خزينة رقمية مطابقة لمعيار NF Z42-013.</p>
        </div>

        <div class="legal-disclaimer">
          <strong>إشعار قانوني (المادة 7 من القانون 43-20)</strong>
          <p style="margin-top: 0.5rem;">يشهد هذا التحقق بأن الوثيقة التي تطابق بصمتها الرقمية الـ Hash المذكور أعلاه قد تم توقيعها إلكترونيا بشكل مؤهل عبر منصة سكاليان إنشورتيك. التوقيع الإلكتروني المؤهل له نفس القيمة القانونية للتوقيع اليدوي (المادة 4 من القانون 43-20). أي تحريف أو استخدام احتيالي لهذه الوثيقة يعرض صاحبه للعقوبات المنصوص عليها في المواد 351 وما يليها من القانون الجنائي المغربي (التزوير واستعمال المزور: السجن من 5 إلى 10 سنوات).</p>
        </div>
      {{else}}
        <div style="text-align: center; padding: 3rem 1rem;">
          <div class="badge-error">وثيقة غير معروفة</div>
          <h2 style="font-size: 1.25rem; color: #1a202c; margin: 1rem 0;">لا توجد أي وثيقة سكاليان إنشورتيك تطابق هذا الـ Hash</h2>
          <p style="color: #4a5568; font-size: 0.9375rem; max-width: 480px; margin: 0 auto;">الـ Hash المقدم غير مرتبط بأي وثيقة موقعة على منصتنا.</p>
          <div style="margin-top: 1.5rem;">
            <div class="data-label">الـ Hash المبحوث عنه</div>
            <div class="hash-display">{{hash}}</div>
          </div>
        </div>
      {{/if}}
    </div>
    <div class="footer">
      <p>تم التحقق في <span class="iso-date">{{generatedAt}}</span></p>
      <p style="margin-top: 0.5rem;">سكاليان إنشورتيك - مزود خدمات الثقة المؤهل من ANRT</p>
      <div class="lang-switcher">
        <a href="?lang=fr">Francais</a>
        |
        <a href="?lang=ar" class="active">العربية</a>
        |
        <a href="?lang=en">English</a>
      </div>
    </div>
  </div>
</body>
</html>
```

## Section 6 - Tests unitaires

### 6.1 Tests `public-verify.controller.spec.ts`

```typescript
// repo/apps/api/src/modules/signature/controllers/public-verify.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException, BadRequestException, HttpException } from '@nestjs/common';
import { PublicVerifyController } from './public-verify.controller';
import { PublicVerifyService } from '../services/public-verify.service';
import { VerifyRateLimiterService } from '../services/verify-rate-limiter.service';
import { SuspiciousVerifyDetectorService } from '../services/suspicious-verify-detector.service';
import { PdfTemplatesService } from '../../../../packages/docs/src/services/pdf-templates.service';

describe('PublicVerifyController', () => {
  let controller: PublicVerifyController;
  let verifyService: jest.Mocked<PublicVerifyService>;
  let rateLimiter: jest.Mocked<VerifyRateLimiterService>;
  let suspiciousDetector: jest.Mocked<SuspiciousVerifyDetectorService>;
  let pdfTemplates: jest.Mocked<PdfTemplatesService>;

  const validHash = 'a'.repeat(128);
  const sampleResponse = {
    document_public_id: 'pub_8a3fb2c9d1e4f7a0',
    document_type: 'police' as const,
    signed_at: '2026-05-08T14:23:00.000Z',
    tsa_timestamp_applied_at: '2026-05-08T14:23:05.000Z',
    tsa_serial_number: '0x1234567890abcdef',
    tsa_policy_oid: '1.2.250.1.999.1.5.4.1.1',
    tsa_hash_algorithm: 'SHA-512',
    signers_count: 2,
    signers_anonymized: [
      { initial: 'AB', role: 'signer' as const, signed_at: '2026-05-08T14:00:00.000Z' },
      { initial: 'CD', role: 'signer' as const, signed_at: '2026-05-08T14:10:00.000Z' },
    ],
    hash: validHash,
    hash_algorithm: 'SHA-512' as const,
    archive_locked_until: '2036-05-09T14:23:00.000Z',
    verification_id: 'pub_xyz0123456789abc',
    verification_url: `https://api.skalean-insurtech.ma/verify/${validHash}`,
    state: 'signed' as const,
    legal_basis: 'Loi 43-20 art 7' as const,
    verified_at: new Date().toISOString(),
  };

  beforeEach(async () => {
    process.env.PUBLIC_VERIFY_ANONYMIZE_SECRET = 'test-secret-32chars-minimum-12345678';
    process.env.PUBLIC_VERIFY_BASE_URL = 'https://api.skalean-insurtech.ma/verify';
    process.env.IP_HASH_SALT = 'test-salt';

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicVerifyController],
      providers: [
        { provide: PublicVerifyService, useValue: { verifyByHash: jest.fn() } },
        { provide: VerifyRateLimiterService, useValue: { consume: jest.fn() } },
        {
          provide: SuspiciousVerifyDetectorService,
          useValue: { evaluate: jest.fn().mockResolvedValue({ isSuspicious: false, reasons: [], score: 0 }) },
        },
        { provide: PdfTemplatesService, useValue: { render: jest.fn().mockResolvedValue('<html>verify</html>') } },
      ],
    }).compile();

    controller = module.get<PublicVerifyController>(PublicVerifyController);
    verifyService = module.get(PublicVerifyService);
    rateLimiter = module.get(VerifyRateLimiterService);
    suspiciousDetector = module.get(SuspiciousVerifyDetectorService);
    pdfTemplates = module.get(PdfTemplatesService);
  });

  describe('GET /verify-doc/:hash JSON', () => {
    it('should return verification details for valid hash and signed document', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      const result = await controller.verify(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'fr-MA', 'application/json');
      expect(result).toEqual(sampleResponse);
      expect(rateLimiter.consume).toHaveBeenCalledWith('196.168.1.1');
      expect(verifyService.verifyByHash).toHaveBeenCalledWith(validHash);
    });

    it('should reject hash with invalid format (not 128 hex chars)', async () => {
      await expect(
        controller.verify('invalid', '196.168.1.1', undefined, 'Mozilla/5.0', 'fr', 'application/json'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject hash with non-hex characters', async () => {
      const badHash = 'g'.repeat(128);
      await expect(
        controller.verify(badHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'fr', 'application/json'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should normalize hash to lowercase before lookup', async () => {
      const upperHash = 'A'.repeat(128);
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verify(upperHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'fr', 'application/json');
      expect(verifyService.verifyByHash).toHaveBeenCalledWith('a'.repeat(128));
    });

    it('should throw NotFoundException when hash not found', async () => {
      verifyService.verifyByHash.mockResolvedValue(null);
      await expect(
        controller.verify(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'fr', 'application/json'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should propagate rate limiter HttpException', async () => {
      rateLimiter.consume.mockRejectedValue(
        new HttpException({ code: 'RATE_LIMIT_EXCEEDED' }, 429),
      );
      await expect(
        controller.verify(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'fr', 'application/json'),
      ).rejects.toThrow(HttpException);
    });

    it('should extract IP from X-Real-IP if present', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verify(validHash, '1.2.3.4, 5.6.7.8', '10.0.0.1', 'curl/7.0', 'fr', 'application/json');
      expect(rateLimiter.consume).toHaveBeenCalledWith('10.0.0.1');
    });

    it('should extract last IP from X-Forwarded-For chain when no X-Real-IP', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verify(validHash, '1.2.3.4, 5.6.7.8, 9.10.11.12', undefined, 'Mozilla/5.0', 'fr', 'application/json');
      expect(rateLimiter.consume).toHaveBeenCalledWith('9.10.11.12');
    });

    it('should normalize IPv6 to /64 prefix', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verify(validHash, '2a01:e0a:abc:1234:5678:90ab:cdef:1234', undefined, 'Mozilla/5.0', 'fr', 'application/json');
      expect(rateLimiter.consume).toHaveBeenCalledWith('2a01:e0a:abc:1234::/64');
    });

    it('should fallback to 0.0.0.0 if no valid IP', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verify(validHash, undefined, undefined, 'Mozilla/5.0', 'fr', 'application/json');
      expect(rateLimiter.consume).toHaveBeenCalledWith('0.0.0.0');
    });

    it('should call suspicious detector with all context', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verify(validHash, '196.168.1.1', undefined, 'curl/7.0', 'fr', 'application/json');
      expect(suspiciousDetector.evaluate).toHaveBeenCalledWith({
        ip: '196.168.1.1',
        userAgent: 'curl/7.0',
        hash: validHash,
        acceptHeader: 'application/json',
        acceptLanguage: 'fr',
      });
    });

    it('should still serve response even when suspicious is detected (transparency)', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      suspiciousDetector.evaluate.mockResolvedValue({ isSuspicious: true, reasons: ['bot_user_agent'], score: 30 });
      const result = await controller.verify(validHash, '196.168.1.1', undefined, 'curl/7.0', undefined, undefined);
      expect(result).toEqual(sampleResponse);
    });

    it('should handle empty user-agent gracefully', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      const result = await controller.verify(validHash, '196.168.1.1', undefined, undefined, 'fr', 'application/json');
      expect(result).toEqual(sampleResponse);
    });

    it('should handle missing accept-language', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      const result = await controller.verify(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', undefined, 'application/json');
      expect(result).toEqual(sampleResponse);
    });
  });

  describe('GET /verify-doc/:hash/page HTML', () => {
    let resMock: any;

    beforeEach(() => {
      resMock = {
        type: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
      };
    });

    it('should render French template for fr locale', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verifyPage(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'fr-MA,fr;q=0.9', resMock);
      expect(pdfTemplates.render).toHaveBeenCalledWith(
        'verify-page',
        expect.objectContaining({ found: true, hash: validHash, locale: expect.stringMatching(/^fr/) }),
      );
      expect(resMock.type).toHaveBeenCalledWith('text/html; charset=utf-8');
      expect(resMock.status).toHaveBeenCalledWith(200);
    });

    it('should render Arabic RTL template for ar locale', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verifyPage(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'ar-MA,ar;q=0.9', resMock);
      expect(pdfTemplates.render).toHaveBeenCalledWith(
        'ar/verify-page',
        expect.objectContaining({ locale: expect.stringMatching(/^ar/) }),
      );
    });

    it('should render Arabic for ar-DZ Algerian fallback to ar generic', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verifyPage(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'ar-DZ,ar;q=0.8', resMock);
      expect(pdfTemplates.render).toHaveBeenCalledWith('ar/verify-page', expect.any(Object));
    });

    it('should render French as default fallback for unsupported locale', async () => {
      verifyService.verifyByHash.mockResolvedValue(sampleResponse);
      await controller.verifyPage(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'zh-CN,zh;q=0.9', resMock);
      expect(pdfTemplates.render).toHaveBeenCalledWith('verify-page', expect.any(Object));
    });

    it('should render 404 page when hash not found but still 200 status (page exists)', async () => {
      verifyService.verifyByHash.mockResolvedValue(null);
      await controller.verifyPage(validHash, '196.168.1.1', undefined, 'Mozilla/5.0', 'fr', resMock);
      expect(resMock.status).toHaveBeenCalledWith(404);
      expect(pdfTemplates.render).toHaveBeenCalledWith('verify-page', expect.objectContaining({ found: false }));
    });

    it('should return 400 HTML for invalid hash format', async () => {
      await controller.verifyPage('invalid', '196.168.1.1', undefined, 'Mozilla/5.0', 'fr', resMock);
      expect(resMock.status).toHaveBeenCalledWith(400);
    });
  });
});
```

### 6.2 Tests `public-verify.service.spec.ts`

```typescript
// repo/apps/api/src/modules/signature/services/public-verify.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Logger } from '@nestjs/common';
import { PublicVerifyService } from './public-verify.service';
import { AnonymizeVerificationIdService } from './anonymize-verification-id.service';
import { Document } from '../entities/document.entity';
import { SigningWorkflow } from '../entities/signing-workflow.entity';
import Redis from 'ioredis-mock';

describe('PublicVerifyService', () => {
  let service: PublicVerifyService;
  let documentRepo: any;
  let workflowRepo: any;
  let redis: any;
  let anonymizer: AnonymizeVerificationIdService;

  const validHash = 'b'.repeat(128);

  const buildQueryBuilder = (returnValue: any) => ({
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(returnValue),
  });

  beforeEach(async () => {
    process.env.PUBLIC_VERIFY_ANONYMIZE_SECRET = 'test-secret-32chars-minimum-12345678';
    process.env.PUBLIC_VERIFY_BASE_URL = 'https://api.skalean-insurtech.ma/verify';
    process.env.PUBLIC_VERIFY_CACHE_TTL_SECONDS = '300';

    redis = new Redis();
    documentRepo = { createQueryBuilder: jest.fn() };
    workflowRepo = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicVerifyService,
        AnonymizeVerificationIdService,
        { provide: getRepositoryToken(Document), useValue: documentRepo },
        { provide: getRepositoryToken(SigningWorkflow), useValue: workflowRepo },
        { provide: 'REDIS_CACHE', useValue: redis },
      ],
    }).compile();

    service = module.get<PublicVerifyService>(PublicVerifyService);
    anonymizer = module.get<AnonymizeVerificationIdService>(AnonymizeVerificationIdService);
    anonymizer.onModuleInit();
  });

  afterEach(async () => {
    await redis.flushall();
  });

  it('should return null and cache 404 when document not found', async () => {
    documentRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(null));
    const result = await service.verifyByHash(validHash);
    expect(result).toBeNull();
    const cached = await redis.get(`verify:cache:${validHash}`);
    expect(cached).toContain('_404');
  });

  it('should return cached 404 on subsequent calls without DB hit', async () => {
    await redis.setex(`verify:cache:${validHash}`, 60, JSON.stringify({ _404: true }));
    const result = await service.verifyByHash(validHash);
    expect(result).toBeNull();
    expect(documentRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('should build public-safe DTO from DB row with anonymized id', async () => {
    documentRepo.createQueryBuilder.mockReturnValue(
      buildQueryBuilder({
        d_id: '11111111-1111-1111-1111-111111111111',
        d_document_type: 'police',
        d_state: 'signed',
        d_signed_at: new Date('2026-05-08T14:23:00Z'),
        d_archived_until: new Date('2036-05-08T14:23:00Z'),
        w_signers_metadata: [
          { full_name: 'Ahmed Bennani', role: 'signer', signed_at: '2026-05-08T14:00:00Z' },
          { full_name: 'Fatima Cherkaoui', role: 'signer', signed_at: '2026-05-08T14:10:00Z' },
        ],
        w_tsa_applied_at: new Date('2026-05-08T14:23:05Z'),
        w_tsa_serial_number: '0xabc123',
        w_tsa_policy_oid: '1.2.250.1.999.1.5.4.1.1',
        w_tsa_hash_algorithm: 'SHA-512',
        w_signed_at: new Date('2026-05-08T14:20:00Z'),
      }),
    );

    const result = await service.verifyByHash(validHash);
    expect(result).not.toBeNull();
    expect(result!.document_public_id).toMatch(/^pub_[a-z2-7]{16}$/);
    expect(result!.document_type).toBe('police');
    expect(result!.signers_count).toBe(2);
    expect(result!.signers_anonymized[0].initial).toBe('AB');
    expect(result!.signers_anonymized[1].initial).toBe('FC');
    expect(result!.hash).toBe(validHash);
    expect(result!.hash_algorithm).toBe('SHA-512');
    expect(result!.legal_basis).toBe('Loi 43-20 art 7');
  });

  it('should not expose any PII in the response (no full names, emails, phones)', async () => {
    documentRepo.createQueryBuilder.mockReturnValue(
      buildQueryBuilder({
        d_id: '22222222-2222-2222-2222-222222222222',
        d_document_type: 'devis',
        d_state: 'signed',
        d_signed_at: new Date(),
        w_signers_metadata: [
          {
            full_name: 'Ahmed Bennani',
            email: 'ahmed.bennani@example.com',
            phone: '+212600000000',
            cin: 'AB123456',
            role: 'signer',
            signed_at: '2026-05-08T14:00:00Z',
          },
        ],
        w_tsa_applied_at: new Date(),
        w_tsa_serial_number: 'serial',
        w_tsa_policy_oid: 'oid',
        w_tsa_hash_algorithm: 'SHA-512',
      }),
    );

    const result = await service.verifyByHash(validHash);
    const json = JSON.stringify(result);
    expect(json).not.toContain('Ahmed');
    expect(json).not.toContain('Bennani');
    expect(json).not.toContain('@example.com');
    expect(json).not.toContain('+212');
    expect(json).not.toContain('AB123456');
  });

  it('should cache positive result for configured TTL', async () => {
    documentRepo.createQueryBuilder.mockReturnValue(
      buildQueryBuilder({
        d_id: '33333333-3333-3333-3333-333333333333',
        d_document_type: 'police',
        d_state: 'signed',
        d_signed_at: new Date(),
        w_signers_metadata: [],
        w_tsa_applied_at: new Date(),
        w_tsa_serial_number: 'serial',
        w_tsa_policy_oid: 'oid',
        w_tsa_hash_algorithm: 'SHA-512',
      }),
    );

    await service.verifyByHash(validHash);
    const ttl = await redis.ttl(`verify:cache:${validHash}`);
    expect(ttl).toBeGreaterThan(290);
    expect(ttl).toBeLessThanOrEqual(300);
  });

  it('should return same anonymized public_id on subsequent verifications (deterministic)', async () => {
    const sameDocId = '44444444-4444-4444-4444-444444444444';
    const dbRow = {
      d_id: sameDocId,
      d_document_type: 'police',
      d_state: 'signed',
      d_signed_at: new Date(),
      w_signers_metadata: [],
      w_tsa_applied_at: new Date(),
      w_tsa_serial_number: 'serial',
      w_tsa_policy_oid: 'oid',
      w_tsa_hash_algorithm: 'SHA-512',
    };

    documentRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(dbRow));
    const result1 = await service.verifyByHash(validHash);
    await redis.flushall();
    documentRepo.createQueryBuilder.mockReturnValue(buildQueryBuilder(dbRow));
    const result2 = await service.verifyByHash(validHash);

    expect(result1!.document_public_id).toBe(result2!.document_public_id);
  });

  it('should compute archived_until as signed_at + 10 years if not in DB', async () => {
    documentRepo.createQueryBuilder.mockReturnValue(
      buildQueryBuilder({
        d_id: '55555555-5555-5555-5555-555555555555',
        d_document_type: 'police',
        d_state: 'signed',
        d_signed_at: new Date('2026-05-08T14:23:00Z'),
        d_archived_until: null,
        w_signers_metadata: [],
        w_tsa_applied_at: new Date(),
        w_tsa_serial_number: 'serial',
        w_tsa_policy_oid: 'oid',
        w_tsa_hash_algorithm: 'SHA-512',
      }),
    );

    const result = await service.verifyByHash(validHash);
    expect(result!.archive_locked_until).toContain('2036');
  });

  it('should handle invalidateCache by deleting redis key', async () => {
    await redis.setex(`verify:cache:${validHash}`, 300, '{}');
    await service.invalidateCache(validHash);
    const cached = await redis.get(`verify:cache:${validHash}`);
    expect(cached).toBeNull();
  });
});
```

### 6.3 Tests `anonymize-verification-id.service.spec.ts`

```typescript
// repo/apps/api/src/modules/signature/services/anonymize-verification-id.service.spec.ts
import { AnonymizeVerificationIdService } from './anonymize-verification-id.service';

describe('AnonymizeVerificationIdService', () => {
  let service: AnonymizeVerificationIdService;

  beforeEach(() => {
    process.env.PUBLIC_VERIFY_ANONYMIZE_SECRET = 'test-secret-32chars-minimum-12345678';
    service = new AnonymizeVerificationIdService();
    service.onModuleInit();
  });

  it('should throw if secret too short', () => {
    process.env.PUBLIC_VERIFY_ANONYMIZE_SECRET = 'short';
    const fresh = new AnonymizeVerificationIdService();
    expect(() => fresh.onModuleInit()).toThrow(/at least 32/i);
  });

  it('should throw if secret missing', () => {
    delete process.env.PUBLIC_VERIFY_ANONYMIZE_SECRET;
    const fresh = new AnonymizeVerificationIdService();
    expect(() => fresh.onModuleInit()).toThrow();
  });

  it('should produce deterministic output for same input', async () => {
    const id1 = await service.anonymize('abc-123');
    const id2 = await service.anonymize('abc-123');
    expect(id1).toBe(id2);
  });

  it('should produce different output for different input', async () => {
    const id1 = await service.anonymize('abc-123');
    const id2 = await service.anonymize('abc-124');
    expect(id1).not.toBe(id2);
  });

  it('should always start with pub_ prefix', async () => {
    const id = await service.anonymize('any-input');
    expect(id).toMatch(/^pub_/);
  });

  it('should produce 16 char base32 lowercase suffix', async () => {
    const id = await service.anonymize('any-input');
    expect(id).toMatch(/^pub_[a-z2-7]{16}$/);
  });

  it('should batch anonymize multiple ids', async () => {
    const ids = await service.anonymizeBatch(['a', 'b', 'c']);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('should validate public id format correctly', () => {
    expect(service.isValidPublicId('pub_abcdefghijklmnop')).toBe(true);
    expect(service.isValidPublicId('pub_AbCdEfGh')).toBe(false);
    expect(service.isValidPublicId('pub_1')).toBe(false);
    expect(service.isValidPublicId('not_a_pub_id')).toBe(false);
  });

  it('should not produce collisions on 10000 sequential ids (collision test)', async () => {
    const promises = [];
    for (let i = 0; i < 10000; i++) {
      promises.push(service.anonymize(`doc-${i}`));
    }
    const ids = await Promise.all(promises);
    const unique = new Set(ids);
    expect(unique.size).toBe(10000);
  });

  it('should throw if internalId is empty or non-string', async () => {
    await expect(service.anonymize('')).rejects.toThrow();
    await expect(service.anonymize(null as any)).rejects.toThrow();
  });
});
```

### 6.4 Tests `verify-rate-limiter.service.spec.ts`

```typescript
// repo/apps/api/src/modules/signature/services/verify-rate-limiter.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { VerifyRateLimiterService } from './verify-rate-limiter.service';
import { ProducerService } from '../../kafka/producer.service';
import Redis from 'ioredis-mock';

describe('VerifyRateLimiterService', () => {
  let service: VerifyRateLimiterService;
  let redis: any;
  let kafkaProducer: jest.Mocked<ProducerService>;

  beforeEach(async () => {
    process.env.PUBLIC_VERIFY_RATE_LIMIT_PER_HOUR = '60';
    process.env.PUBLIC_VERIFY_RATE_LIMIT_SUSPICIOUS = '100';
    process.env.PUBLIC_VERIFY_RATE_LIMIT_WHITELIST_IPS = '127.0.0.1,10.10.10.10';

    redis = new Redis();
    kafkaProducer = { send: jest.fn().mockResolvedValue(undefined) } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerifyRateLimiterService,
        { provide: 'REDIS_RATELIMIT', useValue: redis },
        { provide: ProducerService, useValue: kafkaProducer },
      ],
    }).compile();

    service = module.get<VerifyRateLimiterService>(VerifyRateLimiterService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await redis.flushall();
  });

  it('should allow requests within limit', async () => {
    for (let i = 0; i < 60; i++) {
      await expect(service.consume('1.1.1.1')).resolves.toBeUndefined();
    }
  });

  it('should throw 429 when exceeding limit', async () => {
    for (let i = 0; i < 60; i++) {
      await service.consume('2.2.2.2');
    }
    await expect(service.consume('2.2.2.2')).rejects.toThrow(HttpException);
    await expect(service.consume('2.2.2.2')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'RATE_LIMIT_EXCEEDED' }),
    });
  });

  it('should bypass rate limit for whitelisted IPs', async () => {
    for (let i = 0; i < 200; i++) {
      await expect(service.consume('127.0.0.1')).resolves.toBeUndefined();
    }
  });

  it('should emit Kafka event when exceeding suspicious threshold', async () => {
    for (let i = 0; i <= 100; i++) {
      try { await service.consume('3.3.3.3'); } catch {}
    }
    expect(kafkaProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'audit.suspicious_verify',
      }),
    );
  });

  it('should isolate rate limit per IP', async () => {
    for (let i = 0; i < 60; i++) await service.consume('4.4.4.4');
    await expect(service.consume('5.5.5.5')).resolves.toBeUndefined();
  });

  it('should return current count for IP', async () => {
    await service.consume('6.6.6.6');
    await service.consume('6.6.6.6');
    await service.consume('6.6.6.6');
    const count = await service.getCurrentCount('6.6.6.6');
    expect(count).toBe(3);
  });

  it('should reset counter for IP', async () => {
    for (let i = 0; i < 30; i++) await service.consume('7.7.7.7');
    await service.resetForIp('7.7.7.7');
    const count = await service.getCurrentCount('7.7.7.7');
    expect(count).toBe(0);
  });

  it('should not crash if Kafka producer fails', async () => {
    kafkaProducer.send.mockRejectedValue(new Error('kafka down'));
    for (let i = 0; i <= 100; i++) {
      try { await service.consume('8.8.8.8'); } catch {}
    }
  });
});
```

### 6.5 Tests `suspicious-verify-detector.service.spec.ts`

```typescript
// repo/apps/api/src/modules/signature/services/suspicious-verify-detector.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { SuspiciousVerifyDetectorService } from './suspicious-verify-detector.service';
import { ProducerService } from '../../kafka/producer.service';
import Redis from 'ioredis-mock';

describe('SuspiciousVerifyDetectorService', () => {
  let service: SuspiciousVerifyDetectorService;
  let redis: any;
  let kafkaProducer: jest.Mocked<ProducerService>;

  beforeEach(async () => {
    redis = new Redis();
    kafkaProducer = { send: jest.fn().mockResolvedValue(undefined) } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuspiciousVerifyDetectorService,
        { provide: 'REDIS_RATELIMIT', useValue: redis },
        { provide: ProducerService, useValue: kafkaProducer },
      ],
    }).compile();

    service = module.get<SuspiciousVerifyDetectorService>(SuspiciousVerifyDetectorService);
  });

  afterEach(async () => {
    await redis.flushall();
  });

  const baseInput = {
    ip: '1.2.3.4',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    hash: 'a'.repeat(128),
    acceptHeader: 'application/json',
    acceptLanguage: 'fr-MA,fr;q=0.9',
  };

  it('should flag curl user-agent as suspicious', async () => {
    const result = await service.evaluate({ ...baseInput, userAgent: 'curl/7.68.0' });
    expect(result.isSuspicious).toBe(true);
    expect(result.reasons).toContain('bot_user_agent');
  });

  it('should flag wget user-agent as suspicious', async () => {
    const result = await service.evaluate({ ...baseInput, userAgent: 'Wget/1.20.3 (linux-gnu)' });
    expect(result.reasons).toContain('bot_user_agent');
  });

  it('should flag python-requests as suspicious', async () => {
    const result = await service.evaluate({ ...baseInput, userAgent: 'python-requests/2.28.1' });
    expect(result.reasons).toContain('bot_user_agent');
  });

  it('should flag Go-http-client as suspicious', async () => {
    const result = await service.evaluate({ ...baseInput, userAgent: 'Go-http-client/1.1' });
    expect(result.reasons).toContain('bot_user_agent');
  });

  it('should flag scrapy as suspicious', async () => {
    const result = await service.evaluate({ ...baseInput, userAgent: 'Scrapy/2.6.1 (+https://scrapy.org)' });
    expect(result.reasons).toContain('bot_user_agent');
  });

  it('should flag headless browser', async () => {
    const result = await service.evaluate({
      ...baseInput,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/91.0.4472.114',
    });
    expect(result.reasons).toContain('bot_user_agent');
  });

  it('should not flag legitimate Chrome browser', async () => {
    const result = await service.evaluate({
      ...baseInput,
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
    });
    expect(result.reasons).not.toContain('bot_user_agent');
  });

  it('should flag missing accept header', async () => {
    const result = await service.evaluate({ ...baseInput, acceptHeader: undefined });
    expect(result.reasons).toContain('missing_accept_header');
  });

  it('should flag missing accept-language', async () => {
    const result = await service.evaluate({ ...baseInput, acceptLanguage: undefined });
    expect(result.reasons).toContain('missing_accept_language');
  });

  it('should flag burst requests > 10/60s', async () => {
    for (let i = 0; i < 11; i++) {
      await service.evaluate({ ...baseInput, hash: `${i.toString(16).padStart(128, '0')}` });
    }
    const result = await service.evaluate(baseInput);
    expect(result.reasons.some((r) => r.startsWith('burst_high_frequency'))).toBe(true);
  });

  it('should detect sequential hash enumeration', async () => {
    const baseHashStart = '0000000000000001';
    for (let i = 0; i < 4; i++) {
      const hash = (baseHashStart + i.toString(16).padStart(112, '0')).slice(0, 128);
      await service.evaluate({ ...baseInput, hash });
    }
    const finalHash = (baseHashStart + '5'.padStart(112, '0')).slice(0, 128);
    const result = await service.evaluate({ ...baseInput, hash: finalHash });
    expect(result.reasons).toContain('sequential_hash_enumeration');
  });

  it('should emit Kafka audit event when suspicious', async () => {
    await service.evaluate({ ...baseInput, userAgent: 'curl/7.0' });
    expect(kafkaProducer.send).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'audit.suspicious_verify' }),
    );
  });

  it('should accumulate score from multiple reasons', async () => {
    const result = await service.evaluate({
      ip: '9.9.9.9',
      userAgent: 'curl/7.0',
      hash: 'a'.repeat(128),
      acceptHeader: undefined,
      acceptLanguage: undefined,
    });
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.isSuspicious).toBe(true);
  });

  it('should not crash if Kafka producer fails', async () => {
    kafkaProducer.send.mockRejectedValue(new Error('kafka down'));
    await expect(service.evaluate({ ...baseInput, userAgent: 'curl/7.0' })).resolves.toBeDefined();
  });
});
```

### 6.6 Tests E2E `public-verify.e2e-spec.ts`

```typescript
// repo/apps/api/test/signature/public-verify.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { GenericContainer, StartedTestContainer } from 'testcontainers';

describe('PublicVerifyController E2E', () => {
  let app: NestFastifyApplication;
  let redis: Redis;
  let dataSource: DataSource;
  let redisContainer: StartedTestContainer;
  let pgContainer: StartedTestContainer;

  const validSignedHash = 'c'.repeat(128);
  const unknownHash = 'd'.repeat(128);

  beforeAll(async () => {
    redisContainer = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start();
    pgContainer = await new GenericContainer('postgres:16-alpine')
      .withExposedPorts(5432)
      .withEnvironment({ POSTGRES_PASSWORD: 'test', POSTGRES_DB: 'skalean_test' })
      .start();

    process.env.REDIS_HOST = redisContainer.getHost();
    process.env.REDIS_PORT = redisContainer.getMappedPort(6379).toString();
    process.env.DB_HOST = pgContainer.getHost();
    process.env.DB_PORT = pgContainer.getMappedPort(5432).toString();
    process.env.DB_USER = 'postgres';
    process.env.DB_PASSWORD = 'test';
    process.env.DB_NAME = 'skalean_test';
    process.env.PUBLIC_VERIFY_ANONYMIZE_SECRET = 'e2e-test-secret-32chars-minimum-12345678';
    process.env.PUBLIC_VERIFY_RATE_LIMIT_PER_HOUR = '5';
    process.env.PUBLIC_VERIFY_RATE_LIMIT_SUSPICIOUS = '8';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    redis = app.get('REDIS_RATELIMIT');
    dataSource = app.get(DataSource);

    await dataSource.query(`
      INSERT INTO documents (id, tenant_id, document_type, hash_sha512, state, signed_at, archived_until)
      VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'police', $1, 'signed', '2026-05-08T14:23:00Z', '2036-05-08T14:23:00Z')
    `, [validSignedHash]);
    await dataSource.query(`
      INSERT INTO sig_signing_workflows (id, document_id, status, signers_metadata, signed_at, tsa_applied_at, tsa_serial_number, tsa_policy_oid, tsa_hash_algorithm)
      VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'completed',
        '[{"full_name": "Ahmed Bennani", "email": "ah@example.com", "role": "signer", "signed_at": "2026-05-08T14:00:00Z"}]'::jsonb,
        '2026-05-08T14:23:00Z', '2026-05-08T14:23:05Z', '0xabc123', '1.2.250.1.999.1.5.4.1.1', 'SHA-512')
    `);
  }, 60000);

  afterAll(async () => {
    await app?.close();
    await redisContainer?.stop();
    await pgContainer?.stop();
  });

  beforeEach(async () => {
    await redis.flushall();
  });

  it('GET /public/verify-doc/:hash returns 200 with public-safe DTO for known hash', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}`)
      .set('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/91')
      .set('Accept', 'application/json')
      .set('Accept-Language', 'fr-MA,fr;q=0.9')
      .set('X-Forwarded-For', '196.168.1.50');

    expect(res.status).toBe(200);
    expect(res.body.document_public_id).toMatch(/^pub_/);
    expect(res.body.document_type).toBe('police');
    expect(res.body.signers_count).toBe(1);
    expect(res.body.signers_anonymized[0].initial).toBe('AB');
    expect(JSON.stringify(res.body)).not.toContain('Ahmed');
    expect(JSON.stringify(res.body)).not.toContain('@example.com');
  });

  it('GET /public/verify-doc/:hash returns 404 for unknown hash', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${unknownHash}`)
      .set('User-Agent', 'Mozilla/5.0')
      .set('Accept', 'application/json')
      .set('X-Forwarded-For', '196.168.1.51');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('DOCUMENT_NOT_RECOGNIZED');
  });

  it('GET /public/verify-doc/:hash returns 400 for invalid hash format', async () => {
    const res = await request(app.getHttpServer())
      .get('/public/verify-doc/invalid-hash')
      .set('Accept', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_HASH_FORMAT');
  });

  it('GET /public/verify-doc/:hash returns 429 after rate limit exceeded', async () => {
    const ip = '196.168.99.99';
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .get(`/public/verify-doc/${validSignedHash}`)
        .set('X-Forwarded-For', ip)
        .set('User-Agent', 'Mozilla/5.0');
    }
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}`)
      .set('X-Forwarded-For', ip)
      .set('User-Agent', 'Mozilla/5.0');
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('GET /public/verify-doc/:hash sets Cache-Control private 5 min', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}`)
      .set('User-Agent', 'Mozilla/5.0')
      .set('X-Forwarded-For', '196.168.1.60');
    expect(res.headers['cache-control']).toContain('max-age=300');
    expect(res.headers['cache-control']).toContain('private');
  });

  it('GET /public/verify-doc/:hash/page returns French HTML for fr locale', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}/page`)
      .set('User-Agent', 'Mozilla/5.0')
      .set('Accept-Language', 'fr-MA,fr;q=0.9')
      .set('X-Forwarded-For', '196.168.1.61');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('lang="fr"');
    expect(res.text).toContain('Loi 43-20');
    expect(res.text).toContain('Document verifie');
  });

  it('GET /public/verify-doc/:hash/page returns Arabic RTL HTML for ar locale', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}/page`)
      .set('User-Agent', 'Mozilla/5.0')
      .set('Accept-Language', 'ar-MA,ar;q=0.9')
      .set('X-Forwarded-For', '196.168.1.62');
    expect(res.status).toBe(200);
    expect(res.text).toContain('dir="rtl"');
    expect(res.text).toContain('lang="ar"');
    expect(res.text).toContain('القانون 43-20');
  });

  it('GET /public/verify-doc/:hash/page returns 404 with informative HTML for unknown hash', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${unknownHash}/page`)
      .set('User-Agent', 'Mozilla/5.0')
      .set('Accept-Language', 'fr')
      .set('X-Forwarded-For', '196.168.1.63');
    expect(res.status).toBe(404);
    expect(res.text).toContain('non reconnu');
  });

  it('GET /public/verify-doc/:hash sets CORS Allow-Origin: *', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}`)
      .set('Origin', 'https://random-third-party.com')
      .set('X-Forwarded-For', '196.168.1.64');
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-credentials']).toBeUndefined();
  });

  it('GET /public/verify-doc/:hash with curl UA still serves response (transparency)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}`)
      .set('User-Agent', 'curl/7.68.0')
      .set('X-Forwarded-For', '196.168.1.65');
    expect(res.status).toBe(200);
    expect(res.body.document_public_id).toBeDefined();
  });

  it('Returns deterministic public_id across separate verifications', async () => {
    const res1 = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}`)
      .set('User-Agent', 'Mozilla/5.0')
      .set('X-Forwarded-For', '196.168.1.66');
    await redis.flushall();
    const res2 = await request(app.getHttpServer())
      .get(`/public/verify-doc/${validSignedHash}`)
      .set('User-Agent', 'Mozilla/5.0')
      .set('X-Forwarded-For', '196.168.1.67');
    expect(res1.body.document_public_id).toBe(res2.body.document_public_id);
  });

  it('OPTIONS preflight returns 204 with CORS headers', async () => {
    const res = await request(app.getHttpServer())
      .options(`/public/verify-doc/${validSignedHash}`)
      .set('Origin', 'https://acaps.ma')
      .set('Access-Control-Request-Method', 'GET');
    expect([204, 200]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });
});
```

## Section 7 - Variables d'environnement

| Variable | Type | Defaut | Obligatoire | Description |
|---|---|---|---|---|
| `PUBLIC_VERIFY_RATE_LIMIT_PER_HOUR` | int | `60` | Non | Limite requetes/heure par IP |
| `PUBLIC_VERIFY_RATE_LIMIT_SUSPICIOUS` | int | `100` | Non | Seuil emit Kafka suspicious |
| `PUBLIC_VERIFY_RATE_LIMIT_BURST` | int | `10` | Non | Seuil burst 60s |
| `PUBLIC_VERIFY_RATE_LIMIT_WHITELIST_IPS` | csv | `` | Non | IPs whitelist (ANRT, ACAPS, CNDP) |
| `PUBLIC_VERIFY_ANONYMIZE_SECRET` | string | `` | OUI | Secret HMAC >= 32 chars |
| `PUBLIC_VERIFY_ANONYMIZE_SECRET_VERSION` | string | `v1` | Non | Version secret pour rotation gracieuse |
| `PUBLIC_VERIFY_CACHE_TTL_SECONDS` | int | `300` | Non | TTL cache positif |
| `PUBLIC_VERIFY_BASE_URL` | url | `https://api.skalean-insurtech.ma/verify` | Non | Base URL pour QR codes embed |
| `IP_HASH_SALT` | string | `skalean-default-salt` | OUI prod | Salt hash IP pour logs |
| `REDIS_HOST` / `REDIS_PORT` | string/int | `localhost`/`6379` | Oui | Redis |
| `KAFKA_BROKERS` | csv | `localhost:9092` | Oui | Kafka brokers |

## Section 8 - Securite

1. Secret `PUBLIC_VERIFY_ANONYMIZE_SECRET` stocke en Kubernetes Sealed Secret + AWS KMS rotation manuelle decidee (decision-024 : pas de rotation prevue avant 5 ans).
2. Headers securite : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, CSP strict pour HTML.
3. Pas de logging IP en clair > 24h (CNDP) : `IP_HASH_SALT` SHA-256 truncate 16c pour audit logs long terme.
4. Pas de cookies, pas de credentials CORS.
5. Validation stricte hash regex Zod avant tout traitement.
6. Anonymisation deterministe non-reversible HMAC-SHA-256.
7. Cache 404 pour eviter timing attack enumeration.
8. Rate limit Lua script atomique (no race condition).
9. Detection bot + enumeration + emit Kafka audit.
10. CSP page HTML : `script-src 'none'` (no JS executable).

## Section 9 - Performance et scalabilite

- Cache hit > 70% sous charge typique (10 req/s), latence p99 < 80ms.
- Sliding window log Redis O(log N) ZADD.
- Redis instance dediee `redis-cache` separee de `redis-ratelimit` (eviter contention).
- Index DB partial sur `documents.hash_sha512 WHERE deleted_at IS NULL`.
- Pas de N+1 queries (single JOIN).
- HTML render < 60ms (Handlebars cached).
- Bundle CSS inline < 15 KB minified.

## Section 10 - Observabilite

Metriques Prometheus :
- `public_verify_requests_total{status, locale}` counter
- `public_verify_duration_seconds{path}` histogram
- `public_verify_cache_hits_total{type=positive|negative}` counter
- `public_verify_rate_limit_triggered_total` counter
- `public_verify_suspicious_detected_total{reason}` counter

Logs Pino structures :
- `public_verify_request { ip_hash, ua, hash, locale, status, duration_ms }`
- `public_verify_not_found { ip_hash, hash }`
- `public_verify_suspicious { ip_hash, ua, hash, reasons, score }`
- `public_verify_rate_limit_exceeded { ip_hash, count }`

Alertes Grafana :
- `public_verify_5xx_rate > 1%/5min` -> PagerDuty
- `public_verify_rate_limit_triggered > 100/h` -> Slack SecOps
- `public_verify_suspicious_score_avg > 50` -> Slack SecOps

## Section 11 - Migrations / Deploiement

Aucune migration SQL specifique cette tache (les colonnes sont creees Tache 3.3.1, 3.3.6, 3.3.8). Une vue read-only `v_public_verify` peut etre ajoutee dans une migration optionnelle pour audit DBA.

Deploiement Kubernetes :
- Pod `skalean-api-public` separe (optional) avec replicas 4 pour absorber spikes.
- Service exposed via Ingress `api.skalean-insurtech.ma/verify` avec TLS LetsEncrypt.
- ConfigMap pour env vars non sensibles, Secret pour `PUBLIC_VERIFY_ANONYMIZE_SECRET` + `IP_HASH_SALT`.
- HPA scale 2-20 pods sur CPU > 70%.

Rollback : feature flag `PUBLIC_VERIFY_ENABLED` permet de desactiver endpoint en cas d'incident (retour 503 Service Unavailable).

## Section 12 - Edge cases recenses (12+)

1. **Hash valide + signe** : retourne 200 details publics anonymises.
2. **Hash valide + non signe (state=draft)** : 404 (vue v_public_verify exclut state != signed/archived).
3. **Hash inconnu** : 404 + cache 60s, pas de timing leak.
4. **Hash format invalide (length, charset)** : 400 BadRequest avec details Zod.
5. **Rate limit 60/h depasse** : 429 Retry-After 3600.
6. **Suspicious threshold 100/h depasse** : Kafka audit emit + 429.
7. **IPv6 client** : normalisation /64 prefix pour rate limit key.
8. **X-Forwarded-For chain multiple proxies** : prendre last IP (proche infra).
9. **X-Real-IP set par nginx trusted** : prioritaire sur X-Forwarded-For.
10. **Locale ar-MA preferred** : fallback ar generic template.
11. **Locale ar-DZ Algerian** : fallback ar generic template.
12. **Locale ar-EG Egyptian** : fallback ar generic.
13. **Locale unsupported (zh-CN)** : fallback fr.
14. **Bot user-agent (curl)** : log warn + serve normal (transparence).
15. **Sequential hash enumeration** : Kafka audit emit + serve normal.
16. **Document soft-deleted (Tache 3.4.x)** : exclu de la vue, retourne 404.
17. **Tenant deleted CNDP purge** : reste verifiable archive bucket S3, mais tenant masque.
18. **Document re-signed (avenant)** : ancien hash retourne 404 (normal).
19. **Cache poisoning attempt** : negatif cache 60s identique latency positif.
20. **Concurrent revocation pendant render** : write-through invalidation cache key.

## Section 13 - Conformite reglementaire

| Texte | Article | Exigence | Implementation |
|---|---|---|---|
| Loi 43-20 | art 7 | Verification publique signature qualifiee obligatoire | Endpoint public no-auth, accessible sans compte |
| RGS Niveau 2 | section 4.2 | Anonymisation PII dans reponses publiques | DTO Zod sans PII, initiales 2c, public_id HMAC |
| RGS Niveau 2 | section 4.3 | Anti-enumeration identifiants | public_id deterministe HMAC non reversible |
| RGS Niveau 2 | section 4.5 | Rate limit anti-DoS | 60/h IP sliding window Redis |
| RGS Niveau 2 | section 4.6 | Journalisation verifications | Pino logs structures, audit trail Kafka |
| CNDP Loi 09-08 | art 4 | Minimisation donnees personnelles | Aucune PII (nom, email, tel, CIN) en reponse |
| CNDP Deliberation 478-2013 | section 3 | Hash IP en logs long terme | SHA-256 + salt truncate 16c |
| ACAPS Circulaire 2018/01 | art 13 | Transparence consommateur | Page HTML publique multilingue |
| ETSI TS 102 234 | section 5 | Interfaces web verification | Endpoint REST + page HTML responsive |
| RFC 6749 (analogie) | section 4.1 | Bonnes pratiques rate limiting | Sliding window log + 429 Retry-After |
| Loi 09-08 | art 9 | Droit a l'oubli vs conservation legale | Edge case 17 documente |
| Code Penal MA | art 351 | Faux et usage de faux | Disclaimer juridique sur page |

## Section 14 - Decisions techniques tracees (decisions-XXX)

- **decision-024** : RGS Niveau 2 cible v2.2 (vs Niveau 1 v1.x ou Niveau 3 v3.0).
- **decision-024-bis** : Anonymisation deterministe HMAC vs UUID v4 random (stabilite vs entropie).
- **decision-024-ter** : Base32 vs base64 pour public_id (URL-safe + lisibilite).
- **decision-073** : Cache TTL 5 minutes (compromis fraicheur vs perf).
- **decision-074** : Document soft-deleted exclu vue v_public_verify (404), mais archive bucket reste verifiable techniquement (sprint 33+).
- **decision-007** : Logs IP hashes 5 ans (CNDP) vs IP clair 24h max.
- **decision-006** : Pas d'emoji dans HTML rendered (accessibilite + sobriete juridique).
- **decision-009** : SHA-512 pour hash document (vs SHA-256 minimum loi).

## Section 15 - Criteres d'acceptation (30+)

1. Endpoint `GET /public/verify-doc/:hash` accessible sans Authorization header.
2. Endpoint retourne 200 + DTO Zod-valide pour hash signe connu.
3. Endpoint retourne 404 + code `DOCUMENT_NOT_RECOGNIZED` pour hash inconnu.
4. Endpoint retourne 400 + code `INVALID_HASH_FORMAT` pour hash != 128 hex chars.
5. Endpoint retourne 429 + code `RATE_LIMIT_EXCEEDED` apres 60 hits/h meme IP.
6. Header `Retry-After: 3600` present sur reponse 429.
7. Header `Cache-Control: private, max-age=300` present sur reponses 200.
8. Header `Access-Control-Allow-Origin: *` present (CORS open).
9. Header `Access-Control-Allow-Credentials` ABSENT (pas de cookies).
10. Header `X-Content-Type-Options: nosniff` present.
11. Header `X-Frame-Options: DENY` present.
12. DTO reponse contient `document_public_id` format `pub_[a-z2-7]{16}`.
13. DTO reponse ne contient AUCUNE PII (nom complet, email, telephone, CIN).
14. DTO reponse contient `signers_anonymized` avec initiales 2 lettres uppercase.
15. DTO reponse contient `legal_basis: "Loi 43-20 art 7"`.
16. DTO reponse contient `tsa_serial_number`, `tsa_policy_oid`, `tsa_timestamp_applied_at`.
17. DTO reponse contient `archive_locked_until` (signed_at + 10 ans).
18. `document_public_id` est deterministe : 2 verifications du meme document => meme id.
19. `document_public_id` est non-reversible : impossible deduire `document_id` interne.
20. Endpoint `GET /public/verify-doc/:hash/page` retourne text/html.
21. Page HTML francais pour Accept-Language fr/fr-MA/fr-FR.
22. Page HTML arabe RTL pour Accept-Language ar/ar-MA/ar-DZ/ar-EG.
23. Page HTML francais fallback pour locale unsupported.
24. Page HTML 404 informative pour hash inconnu.
25. Page HTML cite Loi 43-20 art 7 + Code Penal art 351.
26. Page HTML W3C valid (validator.w3.org pass).
27. Page HTML accessibilite WCAG 2.1 AA (axe-core 0 violations).
28. Page HTML CSP strict (script-src 'none').
29. Rate limiter Redis Lua script atomique (no race condition).
30. Rate limiter whitelist IPs ANRT/ACAPS bypass.
31. Rate limit emet Kafka `audit.suspicious_verify` au-dela 100/h.
32. Detection bot user-agent (curl, wget, python-requests, scrapy, headless).
33. Detection burst > 10 hits/60s.
34. Detection enumeration sequentielle hash.
35. Detection emet Kafka audit + serve reponse normale (transparence).
36. Logs Pino contiennent `ip_hash` (pas IP clair) pour conformite CNDP.
37. Cache hit ratio > 70% sous charge synthetique (load test).
38. Cache 404 pour eviter timing attack enumeration.
39. Tests unitaires >= 95% coverage lines, 90% branches.
40. Tests E2E 12+ scenarios pass (rate limit reel Redis testcontainer).
41. Anonymizer rejette si secret < 32 chars (RGS requirement).
42. Anonymizer collision test 10 000 ids -> 0 collision.

## Section 16 - Documentation a produire

- `docs/api/openapi.yaml` : ajouter spec endpoints `/public/verify-doc/:hash` et `/page`.
- `docs/security/rgs-niveau-2-checklist.md` : checklist conformite items 1-X.
- `docs/legal/loi-43-20-verification-publique.md` : explication juridique expose au public.
- README mise a jour module signature.

## Section 17 - Notes de cloture

Cette tache 3.3.11 expose la couche publique de verification signature. Elle s'appuie sur les couches backend deja deposees (Tache 3.3.10 verification interne, Tache 3.3.8 timestamp, Tache 3.3.7 Barid, Tache 3.3.5 PDF avec QR code embed). Elle prepare Tache 3.3.12 (notifications post-signature avec lien public verify embedded dans email/SMS au signataire).

La tache est P0 bloquante car la Loi 43-20 art 7 impose mecanisme de verification publique pour tout prestataire de services de confiance qualifie. Sans cette tache, l'agreement ANRT pourrait etre suspendu, suspendant ainsi toute capacite de Skalean a emettre des signatures qualifiees, donc paralysant le metier core.

Reviewer obligatoire DPO + Compliance Officer avant merge prod : audit RGS Niveau 2 checklist, validation absence PII dans reponses, validation disclaimer juridique pages HTML, validation logs hash IP CNDP-conforme.

Suivi metriques post-deploy semaine 1 : cache hit ratio, taux 429, taux 404, latence p99, volume Kafka audit.suspicious_verify, distribution geographique IPs (proxy info via ASN).
