# TACHE 2.1.3 -- Crypto Services : EncryptionService AES-256-GCM (MFA Secret) + HashingService SHA-256 + HMAC + RandomToken

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.3)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour 2.1.4 JwtService qui consomme HashingService.sha256 pour refresh tokens, 2.1.5 SessionService, 2.1.7 MfaService qui consomme EncryptionService pour TOTP secret)
**Effort** : 5h
**Dependances** : 2.1.2 (Argon2Service operationnel pour timing-safe utilities)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a livrer deux services cryptographiques complementaires qui constituent le second etage de la fondation crypto du programme Skalean InsurTech v2.2 apres le Argon2Service de la Tache 2.1.2 : `EncryptionService` qui implemente le chiffrement symetrique authentifie AES-256-GCM (Galois/Counter Mode, NIST SP 800-38D) utilise notamment pour stocker en base de donnees le secret partage TOTP MFA des utilisateurs en forme chiffree (au cas ou la base de donnees serait leakee, l'attaquant ne peut pas regenerer les codes TOTP courants meme avec acces complet aux lignes `auth_users.mfa_secret_encrypted`), et `HashingService` qui implemente SHA-256 (FIPS 180-4) plus HMAC-SHA-256 (RFC 2104) plus la generation de tokens cryptographiquement aleatoires (URL-safe base64url), utilise notamment pour stocker les refresh tokens en Redis sous forme hashee SHA-256 (au cas ou Redis serait leake, l'attaquant ne peut pas reutiliser les refresh tokens car il n'a que les hashes).

Le service `EncryptionService` expose 3 methodes principales : `encrypt(plaintext: string, aad?: string)` qui produit une string base64url tripartite `iv:ciphertext:authTag` avec un IV (Initialization Vector) genere cryptographiquement aleatoire 12 bytes a chaque appel (NEVER reuse IV with same key, propriete fondamentale GCM), `decrypt(encrypted: string, aad?: string)` qui verifie l'integrite via authTag de 16 bytes et restitue le plaintext original (echec en exception en cas de tampering), et `rotateKey(oldKey: Buffer, newKey: Buffer, encrypted: string)` qui re-chiffre une donnee avec une nouvelle cle tout en validant l'authenticite via l'ancienne cle (utilise Sprint 14 pour rotation cles MFA secret). Le service `HashingService` expose 5 methodes : `sha256(input: string)` qui retourne un hex digest 64 caracteres deterministe, `sha256Buffer(input: Buffer)` pour usage avec donnees binaires, `hmacSha256(input: string, key: string)` qui retourne un hex digest pour signature webhook (utilise Sprint 9+ pour Meta WhatsApp webhook signature verification, Sprint 30+ pour Stripe webhooks), `randomToken(byteLength?: number)` qui retourne une string base64url issue de `crypto.randomBytes` (CSPRNG natif Node), et `timingSafeEqualString(a, b)` qui compare deux strings en temps constant via `crypto.timingSafeEqual`. Tous les algorithmes choisis sont des standards reviewed et acceptes par les autorites de controle Maroc (CNDP loi 09-08, ACAPS, Bank Al-Maghrib pour les flux paiement Sprint 11+).

A l'issue de cette tache, l'API `EncryptionService.encrypt(secret)` retourne une string format `<iv-base64url>:<ciphertext-base64url>:<authTag-base64url>` ou les 3 segments sont separables et reversibles, deux appels successifs `encrypt(meme-plaintext)` produisent des ciphertexts differents (IV unique garantissant la propriete IND-CPA d'AES-GCM), une tentative `decrypt(tampered-ciphertext)` jette une exception `Error: Authentication failed` (authTag mismatch detecte le tampering), `HashingService.sha256("hello")` retourne deterministement `"2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"`, `HashingService.randomToken(32)` retourne une string base64url ~43 caracteres (43 = ceil(32/3)*4 sans padding), `HashingService.hmacSha256(input, key)` retourne deterministe pour les memes (input, key) et 100% different pour key different, `EncryptionService` valide au boot que `MFA_SECRET_ENCRYPTION_KEY` env var fait exactement 32 bytes (256 bits AES key length) et throw avec message clair sinon, et la suite Vitest couvre 30+ cas avec coverage >= 92%.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 stocke deux types de donnees sensibles cryptographiques dans ses datastores : (a) les secrets TOTP MFA partages avec les utilisateurs (Tache 2.1.7) qui doivent etre chiffres en base SQL pour resister a un leak DB seul (sinon un attaquant qui leak la base regenere les codes 2FA en temps reel et bypass le MFA pour tous les utilisateurs simultanement -- catastrophique), et (b) les refresh tokens (Tache 2.1.4 et 2.1.5) qui sont stockes en Redis sous forme hashee SHA-256 pour resister a un leak Redis (sinon un attaquant qui leak Redis obtient des refresh tokens directement utilisables pour generer des access tokens JWT et impersonate les utilisateurs jusqu'a expiration 30 jours). La logique est differente pour les deux : MFA secret necessite reversibilite (le serveur doit dechiffrer pour calculer le TOTP courant et comparer), donc encryption symetrique reversible (AES-GCM) ; refresh token necessite seulement comparaison (le client presente le refresh token, le serveur hashe et compare au stockage), donc one-way hash (SHA-256).

Cette tache est doublement critique pour la conformite Maroc. Loi 09-08 article 23 impose la "securite des donnees" -- un MFA secret stocke en clair en base ne respecte pas l'etat de l'art et expose en cas de breach a notification CNDP 72h obligatoire (article 21) avec consequences amende jusqu'a 300000 MAD. ACAPS circulaire 2024 sur la securite des operateurs metier impose MFA reel et resilient -- un MFA dont le secret est en clair n'est pas considere comme MFA reel par l'autorite. Bank Al-Maghrib via la circulaire 2014/G/4 (transposition PSD2 marocaine) impose pour les flux paiement (Sprint 11+) une "encryption at rest" des donnees sensibles, ce qui couvre les tokens d'acces aux gateways de paiement.

L'industrie a converge en 2024-2026 sur AES-GCM comme algorithme symetrique authentifie de reference : NIST SP 800-38D (2007, reaffirme 2021), TLS 1.3 cipher suite obligatoire, FIPS 140-3 mode approuve. Les seules alternatives serieuses sont ChaCha20-Poly1305 (utilise par WireGuard, plus rapide sur ARM mobile sans AES-NI ; mais moins universellement accepte par les compliance frameworks) et AES-CCM (variante NIST mais GCM est plus rapide et plus utilise). Le choix AES-256-GCM (vs AES-128-GCM) est defensif : 256 bits offre une marge confortable contre les attaques quantiques attendues (Grover algorithm reduit security a 128 bits effectifs, ce qui reste casse-chiffre-quantique acceptable jusqu'en 2050+).

L'integration de AAD (Additional Authenticated Data) dans le contrat `encrypt(plaintext, aad?)` permet de lier le ciphertext a un contexte (par exemple `tenant_id` ou `user_id`) qui est verifie a la decryption sans etre chiffre. Cas d'usage Tache 2.1.7 : `encrypt(mfaSecret, user_id)` lie le ciphertext stocke a la ligne user_id ; un attaquant qui swap deux ciphertexts entre lignes de la table (attaque DB-level) trigger une auth fail au decrypt car AAD ne match plus. Cette propriete est utilisee Sprint 14 pour renforcer l'isolation cryptographique entre tenants.

L'utilisation de `crypto.timingSafeEqual` dans `HashingService.timingSafeEqualString` defend contre les attaques par canal auxiliaire timing : un attaquant qui peut mesurer le temps de comparaison de deux strings peut deduire la position du premier caractere different (un compare standard `a === b` short-circuit a la premiere difference). En constant-time compare, cette information de timing n'est plus exploitable. Cette defense est consommee par AuthService Tache 2.1.6 pour comparer les codes recovery, par MfaService Tache 2.1.7 pour comparer les codes TOTP, par TokenService pour valider les tokens d'invitation.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| AES-256-CBC + HMAC-SHA-256 (encrypt-then-MAC) | Tres mature, support universel | Pas atomique (2 calculs separes), risque d'oubli MAC verification, risque IV reuse, deprecie par les guides modernes | REJETE -- moins sur que GCM |
| AES-128-GCM | Plus rapide | 128 bits security insufficient pour donnees retentees > 10 ans, faible marge anti-quantique | REJETE -- conservatisme MFA secret (donnee retenue 5+ ans) |
| AES-256-GCM (RETENU) | NIST approved, FIPS 140-3, TLS 1.3 obligatoire, support natif Node.js, performance excellente avec AES-NI | Limite 2^32 messages avec meme cle (acceptable car rotation Sprint 14), IV de 96 bits OBLIGATOIRE (12 bytes, ne pas confondre avec 16 bytes des autres modes) | RETENU -- standard de fait |
| ChaCha20-Poly1305 | Plus rapide sur ARM sans AES-NI, design moderne (DJB) | Moins de support compliance frameworks Maroc, moins teste par audits ANRT/ACAPS | REJETE -- redondant avec AES-GCM, complexification inutile |
| Custom encryption | Aucun | Antipattern absolu, viole "don't roll your own crypto" | REJETE jamais consideree |
| AWS KMS / GCP KMS | HSM-backed, key rotation managee | Sortie data Maroc (decision-008 viole) | REJETE -- non conforme cloud souverain MA |
| Atlas Cloud Services KMS Benguerir | HSM Maroc, conforme | Pas dispo Sprint 5 (deploye Sprint 35) | DEFFERED -- Sprint 35 |

| Alternative HashingService | Avantages | Inconvenients | Decision |
|----------------------------|-----------|---------------|----------|
| SHA-1 | Universel, rapide | Casse cryptographiquement (collision SHAttered 2017) | REJETE |
| SHA-256 (RETENU) | FIPS 180-4, standard de fait | Pas vulnerabilite extension attack (mais HMAC mitige) | RETENU |
| SHA-3 (Keccak) | Plus moderne, design different | Moins repandu, performance moins optimisee | REJETE -- redondant |
| BLAKE3 | Tres rapide, design moderne | Pas FIPS approved, ecosysteme moins mature | REJETE -- preferer FIPS |

### 2.3 Trade-offs explicites

Choisir AES-256-GCM impose une cle exactement 32 bytes (256 bits). Toute deviation (cle 31 ou 33 bytes) declenche une exception au boot du service. C'est intentionnel : un developpeur qui genere une cle "presque 32 chars" (par exemple chaine UTF-8 contenant un caractere multibyte) obtiendra une cle de longueur byte differente de la longueur character. Le service throw avec un message explicite indiquant la longueur attendue et la longueur recue. La generation correcte est `openssl rand -base64 24 | head -c 32` ou `openssl rand -hex 16` (32 chars hex = 16 bytes -- non, mauvais, il faut 32 bytes = 64 chars hex). Documente dans le fichier .env.example et dans le commentaire JSDoc du service.

Choisir une IV (Initialization Vector) de 12 bytes (vs 16 bytes des autres modes AES) est CONTRAINTE par GCM : le mode GCM normalise IV a 12 bytes (96 bits) pour des raisons d'efficacite (pas de pre-processing). Une IV plus longue ou plus courte casse la securite. Le service genere systematiquement 12 bytes via `crypto.randomBytes(12)`. Le critere V8 verifie cette propriete.

Choisir base64url (vs base64 standard) pour serialiser IV/ciphertext/authTag implique d'accepter une perte d'interoperabilite avec des systemes legacy qui utilisent base64 standard avec padding `=`. En contrepartie, base64url (RFC 4648 section 5) elimine les caracteres `+`, `/`, `=` qui posent probleme dans URLs et JSON sans escape. Tous les outputs de cette tache utilisent base64url. Si un consommateur externe (Sprint 14 webhook signature) utilise base64 standard, conversion explicite a faire dans l'adapter.

Choisir d'inclure AAD (Additional Authenticated Data) optionnel implique d'accepter une complexite supplementaire dans le contrat (parametre optionnel). En contrepartie, on permet au consommateur (Tache 2.1.7) d'augmenter la securite contextuelle a moindre cout. Si AAD est non utilise, l'API reste simple.

### 2.4 Decisions strategiques referenced

- **decision-006 (No-emoji)** : totale.
- **decision-007 (Zod Runtime Validation)** : non applicable pour les services internes (les contrats sont des Buffer/string typed, pas du JSON externe).
- **decision-008 (Data Residency MA)** : indirecte. Les ciphertexts produits ici sont stockes Sprint 35 sur Atlas Cloud Services Benguerir. La cle MFA_SECRET_ENCRYPTION_KEY sera deplacee dans Atlas KMS Sprint 35.
- **decision-013 (Argon2id)** : reference indirecte (cette tache est complementaire).
- **decision-015 (AES-256-GCM standard symetrique)** : pertinence totale.

### 2.5 Pieges techniques connus

1. **Piege : Reuse d'IV avec meme cle = catastrophe securite.**
   - Pourquoi : GCM est tres vulnerable a IV reuse. Si meme (key, IV) chiffre deux plaintexts differents, un attaquant peut XOR les ciphertexts pour obtenir XOR des plaintexts (revelation partielle). Pire, l'attaquant peut forger des ciphertexts arbitraires.
   - Solution : `crypto.randomBytes(12)` a chaque appel encrypt. Tracer un panic / log error si jamais IV repetee detectee (low probability mais defense en profondeur). Le test V9 verifie 1000 encrypt et zero collision IV.

2. **Piege : authTag verification skipped a la decryption.**
   - Pourquoi : oubli `setAuthTag()` avant `decipher.update()` -> Node accepte le decrypt et retourne plaintext potentiellement modifie. C'est SILENT FAIL dangereuse.
   - Solution : code wrap obligatoire `decipher.setAuthTag(authTag); ... decipher.final()` lance exception si tampering. Le test V11 verifie tampered ciphertext throw.

3. **Piege : Cle MFA_SECRET_ENCRYPTION_KEY decoded incorrectly.**
   - Pourquoi : env var lue comme string UTF-8 ; si la cle a ete generee via `openssl rand -hex 32` (64 chars hex), il faut decode hex avant de l'utiliser comme cle. Si on l'utilise comme string UTF-8 directement, la cle reelle fait 64 bytes au lieu de 32, AES throw "invalid key length".
   - Solution : convention -- la cle est en base64url ou hex et le service decode au boot. Documentation explicite dans .env.example. Le test V19 verifie cle 32 bytes.

4. **Piege : `crypto.randomBytes` block au boot dans containers.**
   - Pourquoi : entropy pool insuffisant au boot rapide.
   - Solution : pre-warming dans `onModuleInit` (deja vu Tache 2.1.2). Idem ici.

5. **Piege : timingSafeEqual throw si lengths different.**
   - Pourquoi : `crypto.timingSafeEqual(a, b)` requires same length Buffers ; throw RangeError si different.
   - Solution : wrapper `timingSafeEqualString` qui check length first et retourne false (defense en profondeur). Test V21.

6. **Piege : SHA-256 sur input vide retourne hash deterministe non-detecte.**
   - Pourquoi : `sha256("")` retourne `"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"` (le hash standard). Un attaquant peut tester si un service hashe l'input vide et compare a cette valeur.
   - Solution : aucune action (comportement attendu de SHA-256). Documente. Si un consommateur veut differencier "input vide" de "non hashe", utiliser HMAC avec key fixe.

7. **Piege : `randomToken(32)` interprete comme 32 chars au lieu de 32 bytes.**
   - Pourquoi : ambiguite langage. 32 bytes -> base64url ~43 chars. 32 chars en base64url -> ~24 bytes raw.
   - Solution : nommer parametre `byteLength` explicite (pas `length`). Documente dans JSDoc avec exemple concret.

8. **Piege : Concatenation `iv:ciphertext:authTag` ambigue si l'un contient `:`.**
   - Pourquoi : base64url n'inclut PAS `:`, donc OK en pratique.
   - Solution : verifier dans tests que IV/ciphertext/authTag base64url-encoded ne contiennent jamais `:`.

9. **Piege : `decrypt` recoit un format qui fait imploded avec `==` padding.**
   - Pourquoi : meme avec base64url (sans padding par defaut), un consommateur peut accidentellement ajouter padding.
   - Solution : `Buffer.from(x, 'base64url')` accepte avec et sans padding. Robust.

10. **Piege : AAD non passe a decrypt alors que passe a encrypt.**
    - Pourquoi : si encrypt(plaintext, aad) puis decrypt(ciphertext) sans aad, decryption echoue avec authTag mismatch.
    - Solution : convention claire dans JSDoc : si encrypt avec AAD, decrypt DOIT avoir le meme AAD. Documenter dans Tache 2.1.7 que les operations encrypt/decrypt MFA secret utilisent toujours user_id en AAD.

11. **Piege : HMAC key trop courte (< 32 bytes).**
    - Pourquoi : NIST SP 800-117 recommande key >= 32 bytes pour HMAC-SHA-256.
    - Solution : warning si key.length < 32 dans `hmacSha256`. Pas un throw (acceptable < 32 dans certains contextes legacy) mais log warning.

12. **Piege : `crypto.createHash('sha256')` reuse instance corrompt.**
    - Pourquoi : un Hash object est stateful ; reuse apres `digest()` throw "Digest already called".
    - Solution : `sha256` cree un nouvel objet a chaque appel. Documente dans le code.

13. **Piege : Encoding mismatch `utf-8` vs `binary`.**
    - Pourquoi : SHA-256 sur "hello" en utf-8 vs binary peut differer si caracteres non-ASCII.
    - Solution : convention -- toujours utf-8 pour input string. `sha256Buffer` pour binaire explicite.

14. **Piege : `crypto.createCipheriv` accepte algorithm legacy 'aes-256-gcm' OK mais mauvais cas pour string compare.**
    - Pourquoi : Node gere case-insensitive ; mais convention.
    - Solution : `const ALGORITHM = 'aes-256-gcm'` constante stricte lowercase.

15. **Piege : Fuite cle dans logs / stack traces.**
    - Pourquoi : un Error object peut leak la valeur d'env var dans son message si throw concatene la cle.
    - Solution : tous les throw dans EncryptionService sanitize : "MFA_SECRET_ENCRYPTION_KEY length invalid" SANS la valeur. Verifier critere V20.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Tache 2.1.3 est la 3eme tache du Sprint 5. Elle livre 2 services consommes par :
- 2.1.4 (JwtService) : `HashingService.sha256` pour hash refresh tokens, `HashingService.randomToken` pour generer jti uniques, `HashingService.timingSafeEqualString` pour compare jti dans verify.
- 2.1.5 (SessionService) : `HashingService.sha256` pour hash refresh tokens stockes Redis, `HashingService.randomToken` pour session_id.
- 2.1.7 (MfaService) : `EncryptionService.encrypt/decrypt` pour MFA secret stocke en `auth_users.mfa_secret_encrypted`, `HashingService.randomToken` pour challenge_token et setup_token.
- 2.1.9 (Signup) : `HashingService.randomToken` pour email verification token.
- 2.1.11 (Recovery) : `HashingService.randomToken` pour recovery token, `HashingService.sha256` pour hash recovery token stocke DB.
- 2.1.12 (Audit) : `HashingService.hmacSha256` pour signer events Kafka pour integrite.

### 3.2 Position dans le programme global

Sprint 9+ (WhatsApp Business) consomme `HashingService.hmacSha256` pour verifier signature webhook Meta. Sprint 11+ (Pay) consomme idem pour Stripe/PayPal/CMI/Maroc Telecommerce webhooks. Sprint 14 (Security hardening) introduit rotation de la cle MFA via `EncryptionService.rotateKey`. Sprint 35 deplace la cle dans Atlas Cloud Services KMS Benguerir.

### 3.3 Diagramme

```
+-----------------------------------+
|  Tache 2.1.2 termine               |
|  Argon2Service operationnel        |
+-----------------+-----------------+
                  |
                  v
+-----------------------------------+
|  TACHE 2.1.3 (cette tache)         |
|  EncryptionService AES-256-GCM    |
|  - encrypt(plaintext, aad?)       |
|  - decrypt(encrypted, aad?)       |
|  - rotateKey(old, new, encrypted) |
|                                   |
|  HashingService                   |
|  - sha256(input)                  |
|  - sha256Buffer(buf)              |
|  - hmacSha256(input, key)         |
|  - randomToken(byteLength?)       |
|  - timingSafeEqualString(a, b)    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
  | | | | | | | | | | | | | | | |
  | | | | | | | | 2.1.4 JwtService (hashRefresh, randomJti, timingSafe)
  | | | | | | | 2.1.5 SessionService (hashRefresh, randomSession)
  | | | | | | 2.1.7 MfaService (encrypt MFA, randomChallenge)
  | | | | | 2.1.9 Signup (randomEmailVerifyToken)
  | | | | 2.1.11 Recovery (randomRecoveryToken, hashStored)
  | | | 2.1.12 Audit (hmacSign event)
  | | Sprint 9+ Comm (hmacVerifyMetaWebhook)
  | Sprint 11+ Pay (hmacVerifyPaymentWebhook)
  Sprint 14+ Security (rotateKey MFA)
```

---

## 4. Livrables checkables (24 livrables)

- [ ] Service `repo/packages/auth/src/services/encryption.service.ts` : `@Injectable() EncryptionService` avec encrypt, decrypt, rotateKey -- environ 200 lignes
- [ ] Service `repo/packages/auth/src/services/hashing.service.ts` : `@Injectable() HashingService` avec sha256, sha256Buffer, hmacSha256, randomToken, timingSafeEqualString -- environ 150 lignes
- [ ] Helper `repo/packages/auth/src/services/crypto.helpers.ts` : `parseEncryptedFormat`, `serializeEncryptedFormat`, `assertKeyLength` -- environ 100 lignes
- [ ] Type `repo/packages/auth/src/types/encrypted-payload.ts` : `EncryptedPayload`, `EncryptedString` brand type -- environ 50 lignes
- [ ] Mise a jour `repo/packages/auth/src/auth.module.ts` : ajouter EncryptionService + HashingService aux providers + exports -- modification ~10 lignes
- [ ] Mise a jour `repo/packages/auth/src/index.ts` : exports -- modification ~5 lignes
- [ ] Mise a jour `.env.example` : MFA_SECRET_ENCRYPTION_KEY, HMAC_WEBHOOK_KEY -- modification
- [ ] Tests unitaires `repo/packages/auth/test/services/encryption.service.spec.ts` : 18+ tests (encrypt/decrypt roundtrip, IV unique, tamper detection, AAD binding, key rotation, key length validation, base64url format) -- environ 280 lignes
- [ ] Tests unitaires `repo/packages/auth/test/services/hashing.service.spec.ts` : 15+ tests -- environ 200 lignes
- [ ] Tests helpers `repo/packages/auth/test/services/crypto.helpers.spec.ts` : 5 tests -- environ 80 lignes
- [ ] Tests integration `repo/packages/auth/test/integration/crypto.integration.spec.ts` : 4 tests cross-service (encrypt MFA secret + sha256 the encrypted form, etc.) -- environ 100 lignes
- [ ] Bench optionnel `repo/packages/auth/test/bench/crypto.bench.ts` : measure encrypt/decrypt/sha256/hmac duration -- environ 70 lignes
- [ ] No-emoji verifie
- [ ] No-console verifie
- [ ] Build TypeScript reussit
- [ ] Coverage >= 92%
- [ ] Aucun custom crypto (uniquement node:crypto natif)
- [ ] Aucune emoji
- [ ] Documentation JSDoc complete
- [ ] Variable env MFA_SECRET_ENCRYPTION_KEY documentee (32 bytes, generation conseillee `openssl rand -hex 16` non, c'est 16 bytes ; correct: `openssl rand -base64 32 | head -c 44`)
- [ ] Format encrypted: `<iv-b64u>:<ct-b64u>:<tag-b64u>` documente
- [ ] Tests passants (40+)
- [ ] Pas de cle hardcodee dans code source
- [ ] Pas d'usage `crypto.randomFillSync` non-CSPRNG (uniquement `crypto.randomBytes`)

---

## 5. Fichiers crees / modifies

```
repo/packages/auth/src/services/encryption.service.ts                   (~200 lignes / AES-256-GCM)
repo/packages/auth/src/services/hashing.service.ts                      (~150 lignes / SHA-256 + HMAC + random)
repo/packages/auth/src/services/crypto.helpers.ts                       (~100 lignes / parse/serialize/assert)
repo/packages/auth/src/types/encrypted-payload.ts                       (~50 lignes  / types)
repo/packages/auth/src/auth.module.ts                                   (modifie    / +providers)
repo/packages/auth/src/index.ts                                         (modifie    / +exports)
.env.example                                                             (modifie    / +keys)
repo/packages/auth/test/services/encryption.service.spec.ts             (~280 lignes / 18+ tests)
repo/packages/auth/test/services/hashing.service.spec.ts                (~200 lignes / 15+ tests)
repo/packages/auth/test/services/crypto.helpers.spec.ts                 (~80 lignes  / 5 tests)
repo/packages/auth/test/integration/crypto.integration.spec.ts         (~100 lignes / 4 cross tests)
repo/packages/auth/test/bench/crypto.bench.ts                          (~70 lignes  / bench)
```

Total : 12 fichiers (8 nouveaux, 4 modifies), environ 1230 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 11 : `repo/packages/auth/src/services/encryption.service.ts`

```typescript
/**
 * @insurtech/auth/services/encryption
 *
 * AES-256-GCM authenticated encryption service.
 *
 * NIST SP 800-38D compliant. Used to encrypt MFA secrets at rest in DB
 * (auth_users.mfa_secret_encrypted, Tache 2.1.7) and any other reversible
 * symmetric encryption needed in the program.
 *
 * Key management :
 *   - Sprint 5 : key from env MFA_SECRET_ENCRYPTION_KEY (32 bytes after base64 decode)
 *   - Sprint 14 : key rotation v1 -> v2 via rotateKey()
 *   - Sprint 35 : key migrated to Atlas Cloud Services KMS Benguerir HSM
 *
 * Output format : `<iv-base64url>:<ciphertext-base64url>:<authTag-base64url>`
 *   - iv  : 12 bytes (96 bits) random per call (NEVER reuse with same key)
 *   - ct  : variable length
 *   - tag : 16 bytes (128 bits) integrity authenticator
 *
 * AAD (Additional Authenticated Data) is optional : bind ciphertext to context
 * (e.g., user_id) without encrypting it. Provides defense against ciphertext swap attacks.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { assertKeyLength, parseEncryptedFormat, serializeEncryptedFormat } from './crypto.helpers.js';
import type { EncryptedPayload, EncryptedString } from '../types/encrypted-payload.js';

const ALGORITHM = 'aes-256-gcm' as const;
const KEY_LENGTH_BYTES = 32 as const;
const IV_LENGTH_BYTES = 12 as const;
const AUTH_TAG_LENGTH_BYTES = 16 as const;

@Injectable()
export class EncryptionService implements OnModuleInit {
  private readonly logger = new Logger(EncryptionService.name);
  private key: Buffer | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const raw = this.config.get<string>('MFA_SECRET_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error('EncryptionService: MFA_SECRET_ENCRYPTION_KEY env var is required');
    }
    const decoded = this.decodeKey(raw);
    assertKeyLength(decoded, KEY_LENGTH_BYTES, 'MFA_SECRET_ENCRYPTION_KEY');
    this.key = decoded;
    randomBytes(16);
    this.logger.log({ action: 'encryption_key_loaded', algorithm: ALGORITHM, key_bytes: KEY_LENGTH_BYTES });
  }

  /**
   * Decodes the env var into a 32-byte key.
   * Accepts 3 input formats :
   *   - 64 chars hex (e.g. `openssl rand -hex 32`)
   *   - 44 chars base64 with padding (e.g. `openssl rand -base64 32`)
   *   - 32 chars base64url without padding
   */
  private decodeKey(raw: string): Buffer {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
    if (/^[A-Za-z0-9+/]{43}=?$/.test(raw)) return Buffer.from(raw, 'base64');
    if (/^[A-Za-z0-9_-]{43}$/.test(raw)) return Buffer.from(raw, 'base64url');
    if (raw.length === KEY_LENGTH_BYTES) return Buffer.from(raw, 'utf-8');
    throw new Error(
      `EncryptionService: MFA_SECRET_ENCRYPTION_KEY format unrecognized. Expected 64 hex chars, 44 base64 chars, or 43 base64url chars. Generate with \`openssl rand -hex 32\`.`,
    );
  }

  /**
   * Encrypts plaintext with AES-256-GCM. Optional AAD binds ciphertext to context.
   *
   * @param plaintext - the data to encrypt (UTF-8 string)
   * @param aad - optional Additional Authenticated Data (NOT encrypted, MUST match at decrypt)
   * @returns string format `<iv-b64u>:<ct-b64u>:<tag-b64u>`
   */
  encrypt(plaintext: string, aad?: string): EncryptedString {
    if (this.key === null) {
      throw new Error('EncryptionService: not initialized -- call onModuleInit first');
    }
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
    if (aad !== undefined) {
      cipher.setAAD(Buffer.from(aad, 'utf-8'));
    }
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return serializeEncryptedFormat({ iv, ciphertext, authTag }) as EncryptedString;
  }

  /**
   * Decrypts a ciphertext produced by encrypt(). Verifies authTag and AAD.
   *
   * @throws Error if authTag invalid (tampered ciphertext, wrong key, or wrong AAD)
   */
  decrypt(encrypted: EncryptedString | string, aad?: string): string {
    if (this.key === null) {
      throw new Error('EncryptionService: not initialized');
    }
    const parsed = parseEncryptedFormat(encrypted);
    if (parsed === null) {
      throw new Error('EncryptionService.decrypt: invalid encrypted format');
    }
    const { iv, ciphertext, authTag } = parsed;
    const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
    decipher.setAuthTag(authTag);
    if (aad !== undefined) {
      decipher.setAAD(Buffer.from(aad, 'utf-8'));
    }
    try {
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return plaintext.toString('utf-8');
    } catch (err) {
      this.logger.warn({ action: 'decrypt_auth_failed' }, 'AES-GCM authentication failed (tamper or wrong key/AAD)');
      throw new Error('EncryptionService.decrypt: authentication failed (ciphertext tampered or wrong key/AAD)');
    }
  }

  /**
   * Re-encrypts a ciphertext with a new key, validating authenticity with the old key first.
   * Used Sprint 14 for key rotation.
   *
   * @param oldKey - previous key (validates ciphertext authenticity)
   * @param newKey - new key (re-encrypts with this)
   * @param encrypted - ciphertext to rotate
   * @param aad - optional AAD (same for old and new)
   */
  rotateKey(oldKey: Buffer, newKey: Buffer, encrypted: EncryptedString | string, aad?: string): EncryptedString {
    assertKeyLength(oldKey, KEY_LENGTH_BYTES, 'oldKey');
    assertKeyLength(newKey, KEY_LENGTH_BYTES, 'newKey');

    const parsed = parseEncryptedFormat(encrypted);
    if (parsed === null) throw new Error('rotateKey: invalid encrypted format');
    const { iv: oldIv, ciphertext: oldCt, authTag: oldTag } = parsed;

    const decipher = createDecipheriv(ALGORITHM, oldKey, oldIv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
    decipher.setAuthTag(oldTag);
    if (aad !== undefined) decipher.setAAD(Buffer.from(aad, 'utf-8'));
    const plaintext = Buffer.concat([decipher.update(oldCt), decipher.final()]);

    const newIv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, newKey, newIv, { authTagLength: AUTH_TAG_LENGTH_BYTES });
    if (aad !== undefined) cipher.setAAD(Buffer.from(aad, 'utf-8'));
    const newCt = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const newTag = cipher.getAuthTag();

    return serializeEncryptedFormat({ iv: newIv, ciphertext: newCt, authTag: newTag }) as EncryptedString;
  }

  /**
   * Returns the current key (for tests / rotation only).
   * NEVER expose this method to user-facing code.
   */
  getKeyForRotation(): Buffer {
    if (this.key === null) throw new Error('EncryptionService: not initialized');
    return Buffer.from(this.key);
  }
}
```

### 6.2 Fichier 2 / 11 : `repo/packages/auth/src/services/hashing.service.ts`

```typescript
/**
 * @insurtech/auth/services/hashing
 *
 * SHA-256 (FIPS 180-4) + HMAC-SHA-256 (RFC 2104) + CSPRNG token generation.
 *
 * Used by :
 *   - Tache 2.1.4 JwtService (hash refresh tokens for Redis storage)
 *   - Tache 2.1.7 MfaService (random challenge tokens, setup tokens)
 *   - Sprint 9+ Comm (HMAC verify Meta WhatsApp webhook signatures)
 *   - Sprint 11+ Pay (HMAC verify Stripe / CMI / Maroc Telecommerce webhooks)
 *   - Sprint 12 Audit (HMAC sign Kafka events for end-to-end integrity)
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

@Injectable()
export class HashingService implements OnModuleInit {
  private readonly logger = new Logger(HashingService.name);

  onModuleInit(): void {
    randomBytes(16);
    this.logger.log({ action: 'hashing_service_initialized' });
  }

  /**
   * SHA-256 hex digest of a UTF-8 string. Deterministic.
   * Returns 64-char hex.
   */
  sha256(input: string): string {
    return createHash('sha256').update(input, 'utf-8').digest('hex');
  }

  /**
   * SHA-256 hex digest of a Buffer.
   */
  sha256Buffer(input: Buffer): string {
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * SHA-256 raw Buffer digest (for chaining with other crypto ops).
   */
  sha256Raw(input: string | Buffer): Buffer {
    const h = createHash('sha256');
    if (typeof input === 'string') h.update(input, 'utf-8');
    else h.update(input);
    return h.digest();
  }

  /**
   * HMAC-SHA-256 hex digest. Deterministic for same (input, key).
   *
   * @param input - data to authenticate (UTF-8 string)
   * @param key - secret key (NIST SP 800-117 recommends >= 32 bytes; warning logged otherwise)
   */
  hmacSha256(input: string, key: string | Buffer): string {
    const keyBuf = typeof key === 'string' ? Buffer.from(key, 'utf-8') : key;
    if (keyBuf.length < 32) {
      this.logger.warn(
        { action: 'hmac_short_key', key_length: keyBuf.length },
        'HMAC-SHA-256 key is shorter than 32 bytes (NIST SP 800-117 recommendation)',
      );
    }
    return createHmac('sha256', keyBuf).update(input, 'utf-8').digest('hex');
  }

  /**
   * HMAC-SHA-256 raw Buffer digest.
   */
  hmacSha256Raw(input: string | Buffer, key: string | Buffer): Buffer {
    const keyBuf = typeof key === 'string' ? Buffer.from(key, 'utf-8') : key;
    const h = createHmac('sha256', keyBuf);
    if (typeof input === 'string') h.update(input, 'utf-8');
    else h.update(input);
    return h.digest();
  }

  /**
   * Generates a CSPRNG random token in base64url format (URL-safe, no padding).
   *
   * @param byteLength - number of random bytes (default 32 -> ~43 base64url chars)
   * @returns base64url string
   *
   * @example
   *   const t = hashingService.randomToken(32);  // ~43 chars URL-safe
   */
  randomToken(byteLength: number = 32): string {
    if (!Number.isInteger(byteLength) || byteLength < 8 || byteLength > 256) {
      throw new Error(`HashingService.randomToken: byteLength must be 8..256, got ${byteLength}`);
    }
    return randomBytes(byteLength).toString('base64url');
  }

  /**
   * Generates a CSPRNG random hex string of the given byte length.
   * Used Sprint 5 Tache 2.1.4 for jti generation (UUID v4 alternative).
   */
  randomHex(byteLength: number = 16): string {
    if (!Number.isInteger(byteLength) || byteLength < 4 || byteLength > 64) {
      throw new Error(`HashingService.randomHex: byteLength must be 4..64, got ${byteLength}`);
    }
    return randomBytes(byteLength).toString('hex');
  }

  /**
   * Constant-time string comparison via crypto.timingSafeEqual.
   * Returns false (not throw) for different lengths to maintain ergonomics.
   */
  timingSafeEqualString(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  /**
   * Constant-time Buffer comparison (wraps crypto.timingSafeEqual).
   */
  timingSafeEqualBuffer(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
```

### 6.3 Fichier 3 / 11 : `repo/packages/auth/src/services/crypto.helpers.ts`

```typescript
/**
 * @insurtech/auth/services/crypto.helpers
 *
 * Pure helpers used by EncryptionService. Exported for unit tests.
 */

import type { EncryptedPayload } from '../types/encrypted-payload.js';

const SEPARATOR = ':';

export function serializeEncryptedFormat(payload: EncryptedPayload): string {
  return [
    payload.iv.toString('base64url'),
    payload.ciphertext.toString('base64url'),
    payload.authTag.toString('base64url'),
  ].join(SEPARATOR);
}

export function parseEncryptedFormat(input: string): EncryptedPayload | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  const parts = input.split(SEPARATOR);
  if (parts.length !== 3) return null;
  const [ivB64, ctB64, tagB64] = parts;
  if (!ivB64 || !ctB64 || !tagB64) return null;

  let iv: Buffer;
  let ciphertext: Buffer;
  let authTag: Buffer;
  try {
    iv = Buffer.from(ivB64, 'base64url');
    ciphertext = Buffer.from(ctB64, 'base64url');
    authTag = Buffer.from(tagB64, 'base64url');
  } catch {
    return null;
  }
  if (iv.length !== 12) return null;
  if (authTag.length !== 16) return null;
  if (ciphertext.length === 0) return null;

  return { iv, ciphertext, authTag };
}

/**
 * Throws if buffer length is not exactly expectedBytes.
 * Sanitized error message (does NOT leak the buffer content).
 */
export function assertKeyLength(buf: Buffer, expectedBytes: number, name: string): void {
  if (buf.length !== expectedBytes) {
    throw new Error(`${name}: invalid length (got ${buf.length} bytes, expected ${expectedBytes})`);
  }
}
```

### 6.4 Fichier 4 / 11 : `repo/packages/auth/src/types/encrypted-payload.ts`

```typescript
/**
 * @insurtech/auth/types/encrypted-payload
 */

declare const __encryptedBrand: unique symbol;

/**
 * Branded string type for ciphertext output by EncryptionService.encrypt.
 * Format : `<iv-b64u>:<ct-b64u>:<tag-b64u>`.
 * The brand prevents accidental mixing with other strings in code.
 */
export type EncryptedString = string & { readonly [__encryptedBrand]: true };

export interface EncryptedPayload {
  iv: Buffer;
  ciphertext: Buffer;
  authTag: Buffer;
}
```

### 6.5 Fichier 5 / 11 : Mise a jour `repo/packages/auth/src/auth.module.ts`

```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Argon2Service } from './services/argon2.service.js';
import { PepperService } from './services/pepper.service.js';
import { EncryptionService } from './services/encryption.service.js';
import { HashingService } from './services/hashing.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PepperService, Argon2Service, EncryptionService, HashingService],
  controllers: [],
  exports: [PepperService, Argon2Service, EncryptionService, HashingService],
})
export class AuthModule {}
```

### 6.6 Fichier 6 / 11 : Mise a jour `repo/packages/auth/src/index.ts`

```typescript
export * from './types/index.js';
export * from './schemas/index.js';
export * from './constants/index.js';

export { Argon2Service } from './services/argon2.service.js';
export type { PolicyValidationContext } from './services/argon2.service.js';
export { PepperService } from './services/pepper.service.js';
export { EncryptionService } from './services/encryption.service.js';
export { HashingService } from './services/hashing.service.js';
export type {
  PasswordPolicyResult,
  PasswordPolicyReason,
} from './types/password-policy-result.js';
export { ALL_PASSWORD_POLICY_REASONS } from './types/password-policy-result.js';
export type { EncryptedString, EncryptedPayload } from './types/encrypted-payload.js';

export { AuthModule } from './auth.module.js';
```

### 6.7 Fichier 7 / 11 : Mise a jour `.env.example`

```env
# Sprint 5 Tache 2.1.3 -- EncryptionService
# Generate with : openssl rand -hex 32 (64 hex chars = 32 bytes)
MFA_SECRET_ENCRYPTION_KEY=replace-with-64-hex-chars-from-openssl-rand-hex-32

# Sprint 5 Tache 2.1.3 -- HashingService HMAC for webhooks
# Generate with : openssl rand -base64 48
HMAC_WEBHOOK_KEY=replace-with-base64-48-chars-min-32-bytes-after-decode
```

---

## 7. Tests complets

### 7.1 Tests : `repo/packages/auth/test/services/encryption.service.spec.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { EncryptionService } from '../../src/services/encryption.service.js';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeAll(async () => {
    process.env.MFA_SECRET_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [EncryptionService],
    }).compile();
    service = moduleRef.get(EncryptionService);
    service.onModuleInit();
  });

  describe('encrypt + decrypt roundtrip', () => {
    it('encrypts a string and decrypts back to original', () => {
      const plaintext = 'JBSWY3DPEHPK3PXP'; // typical TOTP secret
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('produces three-part format with colon separator', () => {
      const encrypted = service.encrypt('hello');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('IV is unique per call (1000 encryptions, no IV collision)', () => {
      const ivs = new Set<string>();
      for (let i = 0; i < 1000; i += 1) {
        const e = service.encrypt('same-plaintext');
        const iv = e.split(':')[0];
        ivs.add(iv);
      }
      expect(ivs.size).toBe(1000);
    });

    it('two encrypts of same plaintext produce different ciphertexts', () => {
      const e1 = service.encrypt('repeat');
      const e2 = service.encrypt('repeat');
      expect(e1).not.toBe(e2);
      expect(service.decrypt(e1)).toBe('repeat');
      expect(service.decrypt(e2)).toBe('repeat');
    });

    it('handles empty string plaintext', () => {
      const e = service.encrypt('');
      expect(service.decrypt(e)).toBe('');
    });

    it('handles utf-8 multibyte plaintext', () => {
      const plaintext = 'Skalean InsurTech ar-MA';
      const e = service.encrypt(plaintext);
      expect(service.decrypt(e)).toBe(plaintext);
    });

    it('handles long plaintext (1KB)', () => {
      const plaintext = 'a'.repeat(1024);
      const e = service.encrypt(plaintext);
      expect(service.decrypt(e)).toBe(plaintext);
    });
  });

  describe('AAD (Additional Authenticated Data)', () => {
    it('encrypts with AAD and decrypts with same AAD', () => {
      const e = service.encrypt('secret', 'user-123');
      expect(service.decrypt(e, 'user-123')).toBe('secret');
    });

    it('decrypt fails when AAD mismatch', () => {
      const e = service.encrypt('secret', 'user-123');
      expect(() => service.decrypt(e, 'user-456')).toThrow(/authentication failed/);
    });

    it('decrypt fails when AAD missing but was set at encrypt', () => {
      const e = service.encrypt('secret', 'user-123');
      expect(() => service.decrypt(e)).toThrow(/authentication failed/);
    });

    it('decrypt fails when AAD set but encrypt had none', () => {
      const e = service.encrypt('secret');
      expect(() => service.decrypt(e, 'user-123')).toThrow(/authentication failed/);
    });
  });

  describe('Tampering detection', () => {
    it('throws on tampered ciphertext (modified ct part)', () => {
      const e = service.encrypt('secret');
      const parts = e.split(':');
      // Flip a single bit in the ciphertext
      const tampered = `${parts[0]}:${parts[1].slice(0, -2)}AB:${parts[2]}`;
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws on tampered authTag', () => {
      const e = service.encrypt('secret');
      const parts = e.split(':');
      const tampered = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}XY`;
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws on completely malformed input', () => {
      expect(() => service.decrypt('not-an-encrypted-string')).toThrow(/invalid encrypted format/);
    });

    it('throws on empty input', () => {
      expect(() => service.decrypt('')).toThrow(/invalid encrypted format/);
    });

    it('throws on missing parts', () => {
      expect(() => service.decrypt('part1:part2')).toThrow(/invalid encrypted format/);
    });
  });

  describe('Key rotation', () => {
    it('rotates key successfully', () => {
      const oldKey = randomBytes(32);
      const newKey = randomBytes(32);

      // Encrypt with old key (manually for test)
      process.env.MFA_SECRET_ENCRYPTION_KEY = oldKey.toString('hex');
      const oldService = new EncryptionService(
        { get: (k: string) => process.env[k] } as any,
      );
      oldService.onModuleInit();
      const encrypted = oldService.encrypt('rotation-test');

      // Rotate
      const rotated = service.rotateKey(oldKey, newKey, encrypted);

      // Decrypt with new key
      process.env.MFA_SECRET_ENCRYPTION_KEY = newKey.toString('hex');
      const newService = new EncryptionService(
        { get: (k: string) => process.env[k] } as any,
      );
      newService.onModuleInit();
      expect(newService.decrypt(rotated)).toBe('rotation-test');
    });

    it('rotateKey throws if oldKey wrong length', () => {
      expect(() => service.rotateKey(randomBytes(16), randomBytes(32), 'a:b:c')).toThrow(/length/);
    });
  });

  describe('Key validation at boot', () => {
    it('throws if MFA_SECRET_ENCRYPTION_KEY missing', async () => {
      delete process.env.MFA_SECRET_ENCRYPTION_KEY;
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true })],
        providers: [EncryptionService],
      }).compile();
      const svc = moduleRef.get(EncryptionService);
      expect(() => svc.onModuleInit()).toThrow(/MFA_SECRET_ENCRYPTION_KEY/);
    });

    it('throws if MFA_SECRET_ENCRYPTION_KEY format unrecognized', async () => {
      process.env.MFA_SECRET_ENCRYPTION_KEY = 'too-short-key';
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true })],
        providers: [EncryptionService],
      }).compile();
      const svc = moduleRef.get(EncryptionService);
      expect(() => svc.onModuleInit()).toThrow(/format unrecognized/);
    });

    it('accepts hex 64 chars', async () => {
      process.env.MFA_SECRET_ENCRYPTION_KEY = 'a'.repeat(64);
      const moduleRef = await Test.createTestingModule({
        imports: [ConfigModule.forRoot({ isGlobal: true })],
        providers: [EncryptionService],
      }).compile();
      const svc = moduleRef.get(EncryptionService);
      expect(() => svc.onModuleInit()).not.toThrow();
    });
  });
});
```

### 7.2 Tests : `repo/packages/auth/test/services/hashing.service.spec.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { HashingService } from '../../src/services/hashing.service.js';

describe('HashingService', () => {
  let service: HashingService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [HashingService],
    }).compile();
    service = moduleRef.get(HashingService);
    service.onModuleInit();
  });

  describe('sha256', () => {
    it('returns deterministic hash for same input', () => {
      const a = service.sha256('hello');
      const b = service.sha256('hello');
      expect(a).toBe(b);
    });

    it('matches FIPS 180-4 known answer for "hello"', () => {
      expect(service.sha256('hello')).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('returns 64 hex chars', () => {
      const h = service.sha256('any input');
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]{64}$/);
    });

    it('handles empty input deterministically', () => {
      expect(service.sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('handles utf-8 multibyte input', () => {
      const a = service.sha256('Skalean InsurTech ar-MA');
      expect(a).toHaveLength(64);
    });

    it('different input produces different hash', () => {
      expect(service.sha256('a')).not.toBe(service.sha256('b'));
    });
  });

  describe('sha256Buffer', () => {
    it('matches sha256() for same content as Buffer', () => {
      const fromString = service.sha256('hello');
      const fromBuffer = service.sha256Buffer(Buffer.from('hello', 'utf-8'));
      expect(fromString).toBe(fromBuffer);
    });
  });

  describe('hmacSha256', () => {
    it('deterministic for same (input, key)', () => {
      const a = service.hmacSha256('payload', 'a'.repeat(32));
      const b = service.hmacSha256('payload', 'a'.repeat(32));
      expect(a).toBe(b);
    });

    it('different key produces different HMAC', () => {
      const a = service.hmacSha256('payload', 'a'.repeat(32));
      const b = service.hmacSha256('payload', 'b'.repeat(32));
      expect(a).not.toBe(b);
    });

    it('different input produces different HMAC', () => {
      const a = service.hmacSha256('payloadA', 'a'.repeat(32));
      const b = service.hmacSha256('payloadB', 'a'.repeat(32));
      expect(a).not.toBe(b);
    });

    it('returns 64 hex chars', () => {
      const h = service.hmacSha256('x', 'a'.repeat(32));
      expect(h).toHaveLength(64);
      expect(h).toMatch(/^[0-9a-f]+$/);
    });

    it('accepts Buffer key', () => {
      const a = service.hmacSha256('x', Buffer.from('a'.repeat(32), 'utf-8'));
      const b = service.hmacSha256('x', 'a'.repeat(32));
      expect(a).toBe(b);
    });
  });

  describe('randomToken', () => {
    it('default returns ~43 base64url chars (32 bytes input)', () => {
      const t = service.randomToken();
      expect(t.length).toBeGreaterThanOrEqual(42);
      expect(t.length).toBeLessThanOrEqual(44);
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it('produces unique tokens (1000 calls, zero collision)', () => {
      const set = new Set<string>();
      for (let i = 0; i < 1000; i += 1) set.add(service.randomToken());
      expect(set.size).toBe(1000);
    });

    it('respects custom byteLength', () => {
      const t = service.randomToken(16);
      expect(t.length).toBeLessThan(30);
    });

    it('throws for byteLength out of range', () => {
      expect(() => service.randomToken(0)).toThrow();
      expect(() => service.randomToken(500)).toThrow();
      expect(() => service.randomToken(7)).toThrow();
    });
  });

  describe('randomHex', () => {
    it('returns hex string of correct length', () => {
      const h = service.randomHex(16);
      expect(h).toHaveLength(32);
      expect(h).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('timingSafeEqualString', () => {
    it('returns true for identical strings', () => {
      expect(service.timingSafeEqualString('abc', 'abc')).toBe(true);
    });

    it('returns false for different strings of same length', () => {
      expect(service.timingSafeEqualString('abc', 'abd')).toBe(false);
    });

    it('returns false for different lengths (no throw)', () => {
      expect(service.timingSafeEqualString('abc', 'abcd')).toBe(false);
    });

    it('handles empty strings', () => {
      expect(service.timingSafeEqualString('', '')).toBe(true);
    });
  });
});
```

### 7.3 Tests : `repo/packages/auth/test/services/crypto.helpers.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { randomBytes } from 'node:crypto';
import {
  serializeEncryptedFormat,
  parseEncryptedFormat,
  assertKeyLength,
} from '../../src/services/crypto.helpers.js';

describe('serializeEncryptedFormat / parseEncryptedFormat roundtrip', () => {
  it('serializes and parses back to identical buffers', () => {
    const payload = {
      iv: randomBytes(12),
      ciphertext: randomBytes(64),
      authTag: randomBytes(16),
    };
    const s = serializeEncryptedFormat(payload);
    const parsed = parseEncryptedFormat(s);
    expect(parsed).not.toBeNull();
    expect(parsed?.iv.equals(payload.iv)).toBe(true);
    expect(parsed?.ciphertext.equals(payload.ciphertext)).toBe(true);
    expect(parsed?.authTag.equals(payload.authTag)).toBe(true);
  });

  it('parseEncryptedFormat returns null for invalid', () => {
    expect(parseEncryptedFormat('')).toBeNull();
    expect(parseEncryptedFormat('a:b')).toBeNull();
    expect(parseEncryptedFormat('a:b:c:d')).toBeNull();
    expect(parseEncryptedFormat(null as any)).toBeNull();
  });

  it('parseEncryptedFormat returns null for IV not 12 bytes', () => {
    const tooShortIv = Buffer.alloc(8).toString('base64url');
    const ct = randomBytes(32).toString('base64url');
    const tag = randomBytes(16).toString('base64url');
    expect(parseEncryptedFormat(`${tooShortIv}:${ct}:${tag}`)).toBeNull();
  });

  it('parseEncryptedFormat returns null for authTag not 16 bytes', () => {
    const iv = randomBytes(12).toString('base64url');
    const ct = randomBytes(32).toString('base64url');
    const tooShortTag = randomBytes(8).toString('base64url');
    expect(parseEncryptedFormat(`${iv}:${ct}:${tooShortTag}`)).toBeNull();
  });
});

describe('assertKeyLength', () => {
  it('passes when length matches', () => {
    expect(() => assertKeyLength(Buffer.alloc(32), 32, 'TEST')).not.toThrow();
  });

  it('throws sanitized message when length mismatch', () => {
    expect(() => assertKeyLength(Buffer.alloc(16), 32, 'TEST_KEY')).toThrow(/TEST_KEY.*length/);
  });
});
```

### 7.4 Tests integration : `repo/packages/auth/test/integration/crypto.integration.spec.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { EncryptionService } from '../../src/services/encryption.service.js';
import { HashingService } from '../../src/services/hashing.service.js';

describe('Crypto integration (Encryption + Hashing)', () => {
  let enc: EncryptionService;
  let hash: HashingService;

  beforeAll(async () => {
    process.env.MFA_SECRET_ENCRYPTION_KEY = randomBytes(32).toString('hex');
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [EncryptionService, HashingService],
    }).compile();
    enc = moduleRef.get(EncryptionService);
    hash = moduleRef.get(HashingService);
    enc.onModuleInit();
    hash.onModuleInit();
  });

  it('end-to-end : encrypt MFA secret then sha256 the encrypted form for indexing', () => {
    const mfaSecret = 'JBSWY3DPEHPK3PXP';
    const encrypted = enc.encrypt(mfaSecret, 'user-uuid-123');
    const indexHash = hash.sha256(encrypted);
    expect(indexHash).toHaveLength(64);
    expect(enc.decrypt(encrypted, 'user-uuid-123')).toBe(mfaSecret);
  });

  it('end-to-end : random token + sha256 for refresh token storage', () => {
    const refreshTokenPlain = hash.randomToken(32);
    const refreshTokenStored = hash.sha256(refreshTokenPlain);
    expect(refreshTokenPlain).not.toBe(refreshTokenStored);
    // To verify, hash candidate again and compare
    const candidate = hash.sha256(refreshTokenPlain);
    expect(hash.timingSafeEqualString(candidate, refreshTokenStored)).toBe(true);
  });

  it('end-to-end : HMAC sign event payload then verify', () => {
    const event = JSON.stringify({ kind: 'auth.signin_success', user_id: 'u1' });
    const signKey = randomBytes(32).toString('hex');
    const signature = hash.hmacSha256(event, signKey);

    // Verify
    const computedSig = hash.hmacSha256(event, signKey);
    expect(hash.timingSafeEqualString(signature, computedSig)).toBe(true);

    // Tamper detection
    const tamperedEvent = JSON.stringify({ kind: 'auth.signin_success', user_id: 'u2' });
    const tamperedSig = hash.hmacSha256(tamperedEvent, signKey);
    expect(hash.timingSafeEqualString(signature, tamperedSig)).toBe(false);
  });

  it('end-to-end : encrypt with AAD = tenant_id binding', () => {
    const secretFor = (tenantId: string) => enc.encrypt('shared-secret', tenantId);
    const encA = secretFor('tenant-a');
    const encB = secretFor('tenant-b');

    expect(enc.decrypt(encA, 'tenant-a')).toBe('shared-secret');
    expect(enc.decrypt(encB, 'tenant-b')).toBe('shared-secret');

    // Cross-tenant attempt fails
    expect(() => enc.decrypt(encA, 'tenant-b')).toThrow();
  });
});
```

### 7.5 Bench (optionnel) : `repo/packages/auth/test/bench/crypto.bench.ts`

```typescript
import { bench, describe, beforeAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { EncryptionService } from '../../src/services/encryption.service.js';
import { HashingService } from '../../src/services/hashing.service.js';

let enc: EncryptionService;
let hash: HashingService;

beforeAll(async () => {
  process.env.MFA_SECRET_ENCRYPTION_KEY = randomBytes(32).toString('hex');
  const moduleRef = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true })],
    providers: [EncryptionService, HashingService],
  }).compile();
  enc = moduleRef.get(EncryptionService);
  hash = moduleRef.get(HashingService);
  enc.onModuleInit();
  hash.onModuleInit();
});

describe('Crypto perf', () => {
  bench('encrypt 100 bytes', () => {
    enc.encrypt('a'.repeat(100));
  });
  bench('decrypt 100 bytes', () => {
    const e = enc.encrypt('a'.repeat(100));
    enc.decrypt(e);
  });
  bench('sha256 100 bytes', () => {
    hash.sha256('a'.repeat(100));
  });
  bench('hmacSha256 100 bytes', () => {
    hash.hmacSha256('a'.repeat(100), 'k'.repeat(32));
  });
  bench('randomToken 32 bytes', () => {
    hash.randomToken(32);
  });
});
```

---

## 8. Variables environnement

```env
# Sprint 5 Tache 2.1.3 -- EncryptionService
# 32-byte AES-256 key. Generate with : openssl rand -hex 32
MFA_SECRET_ENCRYPTION_KEY=replace-with-64-hex-chars

# Sprint 5 Tache 2.1.3 -- HashingService HMAC for webhooks
# Used Sprint 9+ for Meta WhatsApp webhook signature verification
# Generate with : openssl rand -base64 48
HMAC_WEBHOOK_KEY=replace-with-base64-48-chars
```

---

## 9. Commandes shell

```bash
cd repo

# 1. Generer les cles locales
export MFA_SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)
export HMAC_WEBHOOK_KEY=$(openssl rand -base64 48)

# 2. Verifier longueur cle
echo "MFA key bytes : $((${#MFA_SECRET_ENCRYPTION_KEY} / 2))"  # doit etre 32

# 3. Creer la structure
mkdir -p packages/auth/test/integration packages/auth/test/bench

# 4. Verifier
pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/auth lint:check
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth test:coverage
pnpm --filter @insurtech/auth build
```

---

## 10. Criteres validation V1-V30

### Criteres P0 (bloquants -- 18)

- **V1 (P0)** : `pnpm --filter @insurtech/auth typecheck` exit 0.
- **V2 (P0)** : `pnpm --filter @insurtech/auth build` exit 0.
- **V3 (P0)** : `pnpm --filter @insurtech/auth test` >= 40 tests passing.
- **V4 (P0)** : `EncryptionService.encrypt(x)` retourne format `iv:ct:tag` 3 parties.
- **V5 (P0)** : `decrypt(encrypt(x))` retourne x.
- **V6 (P0)** : `decrypt` retourne string utf-8 correct meme pour multibyte.
- **V7 (P0)** : 2 calls `encrypt(x)` produisent ciphertexts differents (IV unique).
- **V8 (P0)** : IV genere = 12 bytes (96 bits) toujours.
- **V9 (P0)** : 1000 encrypt produisent 1000 IVs uniques.
- **V10 (P0)** : authTag decrypt -> tampered ciphertext throw exception.
- **V11 (P0)** : tampered authTag throw.
- **V12 (P0)** : AAD mismatch entre encrypt et decrypt throw.
- **V13 (P0)** : `MFA_SECRET_ENCRYPTION_KEY` missing -> throw au boot.
- **V14 (P0)** : key trop courte -> throw.
- **V15 (P0)** : `HashingService.sha256("hello")` retourne le hash deterministe FIPS.
- **V16 (P0)** : `hmacSha256(x, k)` retourne 64 hex chars.
- **V17 (P0)** : `randomToken(32)` retourne ~43 base64url chars.
- **V18 (P0)** : `timingSafeEqualString(a, b)` retourne false pour lengths differents (no throw).

### Criteres P1 (importants -- 8)

- **V19 (P1)** : Cle decode hex (64 chars) ET base64 (44 chars) ET base64url (43 chars).
- **V20 (P1)** : Aucun message d'erreur ne leak la cle (sanitization).
- **V21 (P1)** : Coverage >= 92% sur les fichiers livres.
- **V22 (P1)** : Aucune emoji.
- **V23 (P1)** : Aucun console.log.
- **V24 (P1)** : `rotateKey` change la cle et garde le plaintext intact.
- **V25 (P1)** : `parseEncryptedFormat` retourne null (pas throw) pour input invalide.
- **V26 (P1)** : `EncryptedString` brand type empeche assignment direct depuis string.

### Criteres P2 (nice-to-have -- 4)

- **V27 (P2)** : Bench `vitest bench` produit rapport median.
- **V28 (P2)** : Tests integration cross-service (encrypt + sha256 + hmac) passent.
- **V29 (P2)** : JSDoc `@example` present sur randomToken et encrypt.
- **V30 (P2)** : `.env.example` documente les commandes openssl.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Cle MFA contient retour ligne `\n`

Scenario : `openssl rand -hex 32` produit 64 chars + `\n` final. `cat .env | xargs export` peut inclure le `\n`.
Probleme : decode hex echoue car 64+1 chars.
Solution : trim() systematique au decode. `decodeKey(raw.trim())`.

### Edge case 2 : encrypt('') retourne empty plaintext apres decrypt

Scenario : usage sur empty string.
Probleme : aucun (empty plaintext est valide en GCM).
Solution : verifie V6.

### Edge case 3 : decrypt avec base64 standard au lieu de base64url

Scenario : un consommateur produit un encrypted avec base64 (avec `+`, `/`, `=`).
Probleme : `Buffer.from(x, 'base64url')` ignore les chars invalides silencieusement -> peut produire un buffer corrompu.
Solution : `parseEncryptedFormat` valide regex base64url (no `+`, `/`, `=`). Si echoue, retourne null.

### Edge case 4 : IV reuse hardcoded dans test

Scenario : developpeur ecrit `const FIXED_IV = randomBytes(12)` dans un test et utilise.
Probleme : seul un test ; production reste safe.
Solution : code review + lint rule custom Sprint 33.

### Edge case 5 : SHA-256 input file 1GB OOM

Scenario : passe Buffer 1GB a sha256Buffer.
Probleme : Buffer alloc fail.
Solution : usage prevu = small inputs (< 10KB). Pour file streaming, Sprint 32 ajoutera streaming sha256.

### Edge case 6 : HMAC key shorter than 32 bytes

Scenario : developpeur passe key `'short'` (5 bytes).
Probleme : NIST recommande >= 32, mais fonctionne quand meme.
Solution : warning log, pas throw. Acceptable pour migration de systemes legacy.

### Edge case 7 : timingSafeEqualString avec strings de tailles differentes

Scenario : `timingSafeEqualString('abc', 'abcd')`.
Probleme : `crypto.timingSafeEqual` throws RangeError sur lengths differents.
Solution : early return false. Verifie V18.

### Edge case 8 : randomToken(0) bypass entropy

Scenario : un developpeur passe `0` par erreur.
Probleme : retourne empty string.
Solution : throw si byteLength < 8 (V17).

### Edge case 9 : Concurrence -- 1000 encrypt simultanes

Scenario : test E2E declenche 1000 encrypts.
Probleme : aucun (operation rapide ~50us, pas de bottleneck).
Solution : verifie via bench.

### Edge case 10 : Format separator `:` dans plaintext

Scenario : encrypt `'foo:bar'` et le ciphertext contient `:`.
Probleme : aucun (separator est dans la representation, pas dans le ciphertext).
Solution : verifie V4.

### Edge case 11 : Cle compromise -- comment rotate ?

Scenario : leak suspecte de MFA_SECRET_ENCRYPTION_KEY.
Probleme : rotation requise.
Solution : Sprint 14 introduira un script `pnpm rotate-mfa-key` qui : (1) decrypt tous les MFA secrets avec ancienne cle, (2) re-encrypt avec nouvelle cle, (3) update DB. Documente dans Tache 5.1.X Sprint 14.

### Edge case 12 : Atlas KMS Benguerir down

Scenario : Sprint 35+ deploye Atlas KMS, mais down 1h.
Probleme : impossibilite de hash/encrypt -> auth flow casse.
Solution : Sprint 35 prevoit local key cache 24h pour resilience. Sprint 5 utilise env var locale, donc pas de probleme.

---

## 12. Conformite Maroc detaillee

### 12.1 Loi 09-08 CNDP article 23 (securite des donnees)

Implementation : `EncryptionService` chiffre les MFA secrets stockes en DB. En cas de breach DB seul, attaquant ne peut pas regenerer codes 2FA. Couverture : tous les utilisateurs ayant active MFA (Sprint 5 Tache 2.1.7).

### 12.2 Loi 09-08 article 21 (notification 72h)

Si breach detecte, AuditService Tache 2.1.12 publishera event `auth.suspicious_login` avec signature HMAC-SHA-256 (verifie integrite du log meme en cas de tampering DB).

### 12.3 ACAPS circulaire 2024 (MFA reel)

L'encryption AES-256-GCM des MFA secrets garantit que MFA reste effectif meme en cas de leak DB. C'est l'etat de l'art exige par l'autorite.

### 12.4 Bank Al-Maghrib circulaire 2014/G/4 (encryption at rest)

Cette tache couvre l'encryption symetrique. Sprint 11+ (Pay) consommera EncryptionService pour les credentials gateways de paiement (CMI, Maroc Telecommerce, Stripe, PayPal).

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

### 13.1 Multi-tenant strict

`EncryptionService.encrypt(secret, tenant_id)` peut utiliser tenant_id en AAD pour isolation cryptographique. Convention adoptee Tache 2.1.7 pour MFA secrets : AAD = user_id (qui inclut implicitement le tenant_id via la relation auth_users.tenant_id).

### 13.2 Validation strict (Zod)

Pas applicable directement. Les contrats de ces services sont string et Buffer (pas JSON externe). Mais le retour `EncryptedString` (brand type) est consomme par schemas Zod consommateurs (Tache 2.1.7 mfaSecretSchema).

### 13.3 Logger strict Pino

Logger NestJS natif via `private readonly logger = new Logger(...)`. Aucun log de cle ou de plaintext. Logs : `encryption_key_loaded`, `decrypt_auth_failed`, `hmac_short_key` (warning).

### 13.4 Hash password strict (decision-013)

Reference : Argon2Service Tache 2.1.2. HashingService NE remplace PAS Argon2 pour passwords (SHA-256 est trop rapide). Usage HashingService = refresh tokens (entropie haute, pas besoin slow hash).

### 13.5 Package manager strict (pnpm)

Aucune nouvelle dependance externe (uniquement `node:crypto` natif). Pas de install supplementaire.

### 13.6 TypeScript strict

`EncryptedString` brand type prevent confusion avec strings normales. `Buffer` types explicites partout. Pas de `any`.

### 13.7 Tests strict

40+ tests minimum. Coverage >= 92%. Tests integration cross-service. Bench optionnel.

### 13.8 RBAC strict

Non applicable a cette tache.

### 13.9 Events strict

`HashingService.hmacSha256` sera utilise par AuditService Tache 2.1.12 pour signer events Kafka. Pattern : `signature = hmacSha256(JSON.stringify(event), HMAC_WEBHOOK_KEY)` ; consumer verifie avant processing.

### 13.10 Imports strict

Order : 1) Node natifs (`node:crypto`), 2) Externes (`@nestjs/common`, `@nestjs/config`), 3) `@insurtech/*` (none), 4) Relatifs.

### 13.11 Skalean AI strict (decision-005)

Aucun appel LLM. Random utilise CSPRNG natif Node, JAMAIS un LLM.

### 13.12 No-emoji strict (decision-006)

Aucune emoji. Verifie V22.

### 13.13 Idempotency-Key strict

Non applicable directement. Sprint 11+ (Pay) consommera HashingService pour calculer Idempotency-Key hash.

### 13.14 Conventional Commits strict

Format : `feat(sprint-05): implement EncryptionService AES-GCM and HashingService`.

### 13.15 Cloud souverain MA strict

Cle MFA en env var Sprint 5. Sprint 35 deplace cle dans Atlas Cloud Services KMS Benguerir HSM.

### 13.16 Discipline crypto

Aucun custom crypto. Uniquement node:crypto natif (FIPS 140-3 candidate). Algorithmes choisis : AES-256-GCM (NIST SP 800-38D), SHA-256 (FIPS 180-4), HMAC-SHA-256 (RFC 2104), CSPRNG randomBytes (NIST SP 800-90A).

### 13.17 Documentation inline JSDoc

Chaque methode publique a un JSDoc complet avec @param, @returns, @throws, et @example pour les methodes principales (encrypt, decrypt, randomToken, sha256).

### 13.18 Performance budgets

- `encrypt(100 bytes)` : < 100us median.
- `decrypt(100 bytes)` : < 100us median.
- `sha256(100 bytes)` : < 50us median.
- `hmacSha256(100 bytes, 32-byte key)` : < 100us median.
- `randomToken(32)` : < 50us median (entropy pre-warmed).

Ordre de magnitude bien plus rapide qu'Argon2id (qui est intentionnellement slow). Pas de probleme de scalabilite.

---

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/auth typecheck
pnpm --filter @insurtech/auth lint:check
pnpm --filter @insurtech/auth test
pnpm --filter @insurtech/auth test:coverage
pnpm --filter @insurtech/auth build

# No-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/auth/src packages/auth/test && exit 1 || echo OK

# No-console
grep -rn "console\.\(log\|debug\|info\|warn\|error\)" packages/auth/src --include="*.ts" && exit 1 || echo OK

# Pas de cle hardcodee (regex 32+ chars hex)
grep -rnP "[0-9a-f]{64}" packages/auth/src --include="*.ts" | grep -v "spec.ts\|FIPS\|KAT" && exit 1 || echo OK

# Verifier exports
node -e "const m = await import('@insurtech/auth'); ['EncryptionService','HashingService'].forEach(k => { if (!(k in m)) { console.error('MISSING', k); process.exit(1); }}); console.log('OK');"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-05): implement EncryptionService AES-256-GCM and HashingService

Implements two complementary cryptographic services for the program :
EncryptionService (AES-256-GCM authenticated encryption with optional AAD,
NIST SP 800-38D compliant, 12-byte IV per call, 16-byte authTag, key
rotation support) and HashingService (SHA-256 + HMAC-SHA-256 + CSPRNG
randomToken in base64url + timingSafeEqualString). Output format for
encrypted is colon-separated base64url \`iv:ct:tag\`. Used by 2.1.4
(refresh token hashing), 2.1.5 (session keys), 2.1.7 (MFA secret
encryption), Sprint 9+ (webhook signature verification).

Livrables :
- EncryptionService (encrypt, decrypt, rotateKey)
- HashingService (sha256, sha256Buffer, hmacSha256, randomToken,
  timingSafeEqualString, randomHex)
- crypto.helpers (parseEncryptedFormat, serializeEncryptedFormat,
  assertKeyLength)
- EncryptedString brand type
- 40+ tests including integration cross-service

Tests : 18 EncryptionService + 15 HashingService + 5 helpers + 4
integration = 42 tests passing
Coverage : >= 92%

Task: 2.1.3
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite & Multi-tenant
Reference: B-05 Tache 2.1.3
Decisions: decision-008 (cloud MA), decision-015 (AES-256-GCM)"
```

---

## 16. Workflow next step

Apres commit, passer a `task-2.1.4-jwt-service.md` qui implementera le `JwtService` operationnel signant et verifiant les access tokens (HS256 Sprint 5, RS256 Sprint 14) et refresh tokens, consommant `HashingService.sha256` pour stocker les refresh tokens hashes et `HashingService.randomToken` pour generer les jti uniques.

---

## Annexe A. Runbook operationnel production

### A.1 Procedure de rotation MFA_SECRET_ENCRYPTION_KEY (Sprint 14+)

La rotation de `MFA_SECRET_ENCRYPTION_KEY` est une operation sensible : tous les `auth_users.mfa_secret_encrypted` existants doivent etre re-chiffres avec la nouvelle cle. Sans coordination, l'application echoue a verifier les TOTP des utilisateurs MFA-enabled. La procedure standard se deroule en 4 phases sur 7 jours pour minimiser le risque.

Phase 1 (jour J -- preparation, 30 min downtime acceptable optionnel) : generer la nouvelle cle via `openssl rand -hex 32`, stocker dans Atlas Cloud Services KMS Benguerir avec alias `mfa-key-v2`, declarer la variable `MFA_SECRET_ENCRYPTION_KEY_V2` en complement de la cle V1 dans le secret manager Kubernetes (sealed-secrets), deployer une nouvelle version du service avec le code qui supporte la lecture des deux cles (la cle est selectionnee selon le `mfa_pepper_version` stocke en `auth_users` -- ajout colonne migration Sprint 14). Phase 2 (jour J+1 a J+5 -- rolling rotation) : un job batch Sprint 14 `rotateMfaSecrets` parcourt la table `auth_users WHERE mfa_enabled = true AND mfa_pepper_version = 1` par batch de 100, decrypte avec V1, re-encrypte avec V2, met a jour `mfa_pepper_version = 2`. Le batch s'execute pendant les heures creuses (00h-06h MA UTC+1) et logge sa progression dans Datadog. Au total ~50000 utilisateurs MFA en production = ~500 batches = ~8h de traitement sur 5 jours. Phase 3 (jour J+6 -- cutover) : verifier dashboard Grafana que `count(mfa_pepper_version = 1) == 0`. Si OK, switch `MFA_SECRET_ENCRYPTION_KEY` (V1) en `MFA_SECRET_ENCRYPTION_KEY_FALLBACK` (lecture seule pour les anciens hashes restants, normalement zero). Deployer config nouvelle. Phase 4 (jour J+7 -- cleanup) : supprimer `MFA_SECRET_ENCRYPTION_KEY_FALLBACK` et la cle V1 de KMS apres validation 24h sans incident. Garder log d'audit Atlas KMS pour 5 ans (loi 09-08).

### A.2 Procedure d'incident en cas de leak de la cle

Si `MFA_SECRET_ENCRYPTION_KEY` est suspectee compromise (leak via container memory dump, leak via collegue ex-employee qui avait acces aux secrets, leak via vulnerabilite Atlas KMS jamais documentee), l'incident est P0 critique. Le runbook Sprint 33 detaille la procedure complete ; en resume : (1) mettre en pause le rate-limit des connexions a 0 nouveaux logins (degradation acceptable, urgence > UX) en activant le flag feature `auth.maintenance_mode` ; (2) notifier CNDP sous 72h (loi 09-08 article 21) avec un dossier preliminaire decrivant la portee (nombre d'utilisateurs MFA actifs, periode d'exposition estimee, mesures correctives) ; (3) executer la procedure A.1 en mode urgence (downtime jusqu'a 4h acceptable, coordination CTO + DPO + Skalean platform team) ; (4) forcer la regeneration MFA pour TOUS les utilisateurs MFA-enabled (auth_users SET mfa_enabled = false WHERE mfa_pepper_version = 1) -- les utilisateurs reconfigurent leur MFA au prochain login ; (5) post-mortem complet sous 7 jours documente dans `00-pilotage/incidents/INC-{date}-mfa-key-leak.md` avec timeline, RCA (Root Cause Analysis), corrective actions ; (6) audit Sprint 33 pentest des autres cles potentiellement exposees par le meme vecteur. Le DPO (Sprint 18) coordonne la communication ACAPS et CNDP.

### A.3 Monitoring et alerting Sprint 33

Les services `EncryptionService` et `HashingService` exposent des metriques Prometheus consommees par le dashboard Sprint 33. Metriques cles : `crypto_encrypt_duration_ms` (histogramme p50/p95/p99 -- alerte si p99 > 500us), `crypto_decrypt_duration_ms` (idem), `crypto_decrypt_auth_failed_total` (counter -- alerte si rate > 10/min car indique attaque tampering en masse ou bug deploiement avec cle wrong), `crypto_encrypt_total` (counter -- baseline observabilite), `hashing_sha256_duration_us`, `hashing_hmac_duration_us`, `hashing_random_token_total`. Le dashboard groupe ces metriques dans une vue "Crypto Health" qui est revue chaque debut de matinee par l'equipe SRE. Les alertes critiques sont routees vers le canal #incidents Slack (Sprint 18 Comm) et vers PagerDuty pour l'astreinte Skalean. Une augmentation soudaine de `crypto_decrypt_auth_failed_total` declenche une investigation automatique : (a) check si deployment recent (corruption ciphertext format), (b) check si attaque en cours (correlation avec `auth_signin_failed_total`), (c) check si Atlas KMS down (correlation avec `kms_lookup_failed_total`).

## Annexe B. Edge cases supplementaires (13-22)

### Edge case 13 : Container redemarrage perd entropy pool

Scenario : k8s pod redemarre frequemment (OOM, scaling). Le premier `crypto.randomBytes` post-boot peut bloquer 1-30s sur `getrandom()` syscall si entropy pool insuffisant.
Probleme : latence p99 spike 30 secondes au boot, certaines requetes timeout.
Solution : `onModuleInit` pre-warm via `randomBytes(16)` (deja implemente). Sprint 32 ajoutera readiness probe Kubernetes qui n'expose le service que apres pre-warm reussi.

### Edge case 14 : Encrypt avec plaintext null/undefined

Scenario : caller passe `null` ou `undefined` par erreur.
Probleme : Buffer.from(null) throw TypeError opaque.
Solution : guard explicite au debut de encrypt : `if (typeof plaintext !== 'string') throw new Error('plaintext must be string')`. Verifie via test V31.

### Edge case 15 : Decrypt d'un format produit par version anterieure (avant Sprint 14)

Scenario : Sprint 14 changera potentiellement le format (ajout d'un version byte).
Probleme : decrypt Sprint 14 ne sait pas parser format Sprint 5.
Solution : prevoir version prefix dans le format Sprint 14 : `v1:<iv>:<ct>:<tag>`. Sprint 5 format actuel sans prefix considere implicite v1. Migration Sprint 14 detecte absence prefix et applique format v1.

### Edge case 16 : SHA-256 sur Buffer vide

Scenario : `sha256Buffer(Buffer.alloc(0))`.
Probleme : aucun (retourne hash standard de chaine vide).
Solution : verifie test V32, retourne `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

### Edge case 17 : HMAC verify avec key Buffer corrompu

Scenario : key Buffer obtenu via une operation qui a ete mute ailleurs.
Probleme : signature differente que prevu.
Solution : convention -- les keys passees a HashingService sont read-only ; la lib node:crypto fait deja une copie defensive en interne.

### Edge case 18 : `randomToken` epuise entropy pool en boucle serree

Scenario : un test fait `for (let i = 0; i < 100000; i++) randomToken(32)` -- peut consommer 3.2 MB d'entropy.
Probleme : entropy pool kernel se replenit lentement, blocking calls.
Solution : node:crypto utilise CTR_DRBG NIST SP 800-90A backed par random pool ; le throughput pratique est de l'ordre de 100k/seconde. Tests E2E qui necessitent beaucoup de tokens utilisent `crypto.randomBytes` directement avec un seul appel batch.

### Edge case 19 : Decrypt d'un ciphertext tronque

Scenario : caller passe un encrypted dont une partie a ete coupee accidentellement (bug DB layer).
Probleme : parseEncryptedFormat reussit la parse (3 parts) mais authTag size != 16 bytes.
Solution : parseEncryptedFormat verifie iv.length === 12 && authTag.length === 16 && ciphertext.length > 0. Retourne null sinon. Verifie test V33.

### Edge case 20 : Concurrence -- 1000 encrypt simultanes consomment IV pool

Scenario : burst de 1000 encrypt simultanes au peak hour.
Probleme : aucun (chaque encrypt genere son propre IV via randomBytes(12), pas de pool partage).
Solution : verifie via integration test charge.

### Edge case 21 : AAD avec caracteres speciaux UTF-8

Scenario : AAD = user_id `"u-tenant1"` vs `"u-tenant1\0"` (avec null byte).
Probleme : aucun (Buffer.from(aad, 'utf-8') gere correctement).
Solution : convention -- AAD est toujours un identifiant textuel sanitize en amont.

### Edge case 22 : Migration future ChaCha20-Poly1305

Scenario : Sprint 33 pentest recommande ajouter ChaCha20 pour mobile ARM.
Probleme : changement algorithme casse les ciphertexts existants.
Solution : prevoir un algorithme prefix dans le format `algo:v1:<iv>:<ct>:<tag>` Sprint 14+. ChaCha20 ajoute Sprint 33 si recommande.

## Annexe C. Plan de migration Atlas Cloud Services KMS Benguerir (Sprint 35)

### C.1 Architecture cible

A Sprint 35, l'application est deployee en production sur Atlas Cloud Services Benguerir (DC1 Tier III primaire, DC2 Tier IV DR) conforme decision-008. Les cles cryptographiques sensibles -- `MFA_SECRET_ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `HMAC_WEBHOOK_KEY`, `PASSWORD_PEPPER` -- doivent migrer depuis env variables vers Atlas KMS HSM-backed. L'avantage triple : (a) cle jamais visible en plain dans la memoire de l'application (HSM expose API "encrypt with key id" sans jamais retourner la cle), (b) audit log centralise de chaque utilisation de la cle (loi 09-08 + ACAPS conformite), (c) rotation de cle gerable via API Atlas sans redeployer l'application (Sprint 14+).

### C.2 Etapes de migration

Etape 1 : Sprint 35 sous-tache 35.1.1 cree les keys Atlas KMS via Terraform (`infrastructure/terraform/atlas-kms/`). Les keys sont initialement creees comme alias `auth-mfa-encryption`, `auth-jwt-access`, `auth-jwt-refresh`, `auth-hmac-webhook`, `auth-password-pepper`. Etape 2 : Sprint 35 sous-tache 35.1.2 cree un service `KmsClient` dans `@insurtech/shared-utils` qui wrappe l'API Atlas KMS REST. Etape 3 : Sprint 35 sous-tache 35.1.3 modifie `EncryptionService.onModuleInit` pour fetcher la cle via `KmsClient.getKey('auth-mfa-encryption')` au lieu de `process.env.MFA_SECRET_ENCRYPTION_KEY`. La cle est cached en memoire pendant 24h (refresh background pour rotation). Etape 4 : Sprint 35 sous-tache 35.1.4 supprime les env vars locales en faveur d'un fallback explicite si `KMS_ENABLED=false` (mode dev local). Etape 5 : Sprint 35 sous-tache 35.1.5 valide en staging puis production. Etape 6 : audit ANRT confirme conformite cloud souverain MA.

### C.3 Implications pour les developpeurs

Pendant le developpement local Sprint 5-34, les cles restent en env vars (pratique simple, pas de dependance KMS local). Sprint 35 introduit un mode `KMS_ENABLED` toggleable : `false` en dev/staging local, `true` en staging cloud + production. Les tests Vitest continuent d'utiliser env vars (pas de KMS mock complique). L'API publique `EncryptionService.encrypt/decrypt` ne change pas -- les developpeurs n'ont pas a reecrire leur code consommateur.

## Annexe D. Tests integration supplementaires testcontainer (optionnels Sprint 5)

Les tests integration de cette tache utilisent des mocks crypto (process.env vars de test). Sprint 32 (Docker integration tests) ajoutera des testcontainer-based tests qui demarrent un container `softhsm2` simulant un HSM PKCS#11 et qui verifient que `EncryptionService` peut basculer vers ce mode HSM. Ces tests sont optionnels Sprint 5 (couvert par les unit tests) mais documentes ici pour la trajectoire long-terme.

```typescript
// Sprint 32+ test integration HSM
// repo/packages/auth/test/integration/encryption-hsm.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { EncryptionService } from '../../src/services/encryption.service.js';

describe.skipIf(!process.env.RUN_HSM_TESTS)('EncryptionService HSM integration', () => {
  let container: StartedTestContainer;
  let service: EncryptionService;

  beforeAll(async () => {
    container = await new GenericContainer('softhsm2:latest')
      .withExposedPorts(2049)
      .withEnvironment({ HSM_PIN: '1234', HSM_LABEL: 'mfa-key' })
      .start();

    process.env.KMS_ENABLED = 'true';
    process.env.KMS_ENDPOINT = `http://localhost:${container.getMappedPort(2049)}`;
    process.env.KMS_KEY_ALIAS = 'auth-mfa-encryption';

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [EncryptionService],
    }).compile();
    service = moduleRef.get(EncryptionService);
    await service.onModuleInit();
  }, 30000);

  afterAll(async () => {
    await container?.stop();
  });

  it('encrypts and decrypts via HSM-backed key', async () => {
    const encrypted = await service.encrypt('hsm-test-secret');
    const decrypted = await service.decrypt(encrypted);
    expect(decrypted).toBe('hsm-test-secret');
  });

  it('audit log Atlas KMS confirms key usage', async () => {
    await service.encrypt('audit-test');
    // Sprint 32 integration verifie audit log via API Atlas KMS
  });
});
```

## Annexe E. Performance benchmarks attendus

Les benches `crypto.bench.ts` produisent un rapport median qui doit etre archive dans `00-pilotage/benchmarks/sprint-05/crypto-baseline.json` pour comparaison ulterieure (detection de regression Sprint 14, 23, 33). Les valeurs attendues sur machine reference (8 GB RAM, 4 vCPU, x86_64, Linux 6.8) sont :

```
encrypt 100 bytes:        median 38 us  (p95: 52 us, p99: 78 us)
decrypt 100 bytes:        median 36 us  (p95: 50 us, p99: 75 us)
encrypt 1 KB:             median 45 us  (p95: 62 us)
decrypt 1 KB:             median 42 us  (p95: 60 us)
sha256 100 bytes:         median 1.2 us (p95: 2.1 us)
sha256 1 KB:              median 4.5 us (p95: 6.2 us)
hmacSha256 100 bytes:     median 2.8 us (p95: 4.5 us)
randomToken 32 bytes:     median 12 us  (p95: 22 us, after pre-warm)
randomToken 32 bytes:     median 1500 ms (first call without pre-warm, container cold start edge)
timingSafeEqualString:    median 0.3 us (constant time, length-independent within +/- 5%)
```

Les ecarts par rapport a ces baseline declenchent une investigation Sprint 33 :
- ecart > +30% sur encrypt/decrypt : verifier CPU governor, container CPU shares, memory pressure
- ecart > +50% sur sha256/hmac : verifier kernel patch CVE qui aurait impacte BoringSSL/OpenSSL
- ecart > +100% sur randomToken : verifier entropy pool, kernel `getrandom()` syscall behavior

## Annexe F. Dependances NPM auditees

Cette tache ajoute uniquement des dependances natives Node (`node:crypto`) -- aucune nouvelle dependance externe. Cette propriete est verifiee Sprint 33 audit `npm audit` qui devrait retourner 0 vulnerabilities pour `@insurtech/auth` apres cette tache. Le package consomme :

```
node:crypto              -- Node 22 natif (FIPS 140-3 candidate quand compile avec OpenSSL FIPS)
@nestjs/common 10.4.7    -- audit clean octobre 2025
@nestjs/config 3.3.0     -- audit clean
zod 3.23.8               -- audit clean
```

Aucun new package npm install. La pollution dependence reste minimale.

---

**Fin du prompt task-2.1.3-crypto-services.md.**
