# VERIFICATION SPRINT 5 -- Phase 2 / Sprint 1 : Auth Foundations (argon2id + JWT + MFA)
# Version : Auto-reparation active + Rapport final MD detaille
# 15 taches, 132 criteres extraits B-05
# AUCUNE EMOJI AUTORISEE

**Version** : v2.2 (verification detaillee)
**Phase** : 2 -- Securite
**Sprint** : 5 / 35 (cumul) -- Sprint 1 dans Phase 2
**Reference meta-prompt** : `B-05-sprint-05-auth-foundations.md`
**Reference orchestrateur** : `C-05-sprint-05-auth-foundations.md`
**Total criteres** : 132 criteres taches + ~10 transversaux

---

Tu es **Claude Code (ou Cowork)**. Tu dois executer une **verification COMPLETE et EXHAUSTIVE** du Sprint 5 apres execution toutes les 15 taches.

---

## REGLES D'EXECUTION

1. Tu **executes CHAQUE verification dans l'ordre** (taches puis transversales)
2. Quand une verification echoue, tu **TENTES UNE REPARATION AUTOMATIQUE** avant de noter FAIL
3. Apres chaque tentative de reparation, tu **re-executes la verification**
4. Tu consignes dans `sprint05-verify-report.md` **TOUS les resultats** au fil de l'execution
5. A la fin, tu produis le **rapport consolide** + calcul score GO/GO CONDITIONNEL/NO-GO
6. Tu **n'interromps JAMAIS** l'execution -- meme si une tache echoue, tu passes a la suivante

---

## FORMAT DU RAPPORT

Chaque test produit une ligne dans le tableau :

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
| T01-V1 | Critere V1 Tache 1 | PASS | Details |

**Convention IDs** :
- `T{NN}-V{N}` : critere V{N} de Tache {NN} (ex : T01-V1, T15-V3)
- `T{NN}-F{N}` : critere fichier de Tache {NN} (ex : T01-F1)
- `TR-{TYPE}` : critere transversal sprint (ex : TR-BUILD, TR-TYPECHECK, TR-NO-EMOJI)

**Statuts** :
- `PASS` -- reussi au premier essai
- `PASS*` -- reussi apres reparation automatique
- `FAIL` -- echec, reparation impossible (P0 = bloquant)
- `SKIP` -- ignore (prerequis manquant)
- `WARN` -- partiellement reussi OU critere manuel non-automatisable

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint05-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 5 : Auth Foundations (argon2id + JWT + MFA)

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 2 -- Securite
**Sprint** : 5 (Phase 2 / Sprint 1)
**Reference B-05** : 15 taches, 132 criteres extraits
**Executeur** : Claude Code / Cowork (auto-verification + auto-reparation)

---

## Legende

- **PASS** : verification reussie au premier essai
- **PASS\*** : verification reussie apres reparation automatique
- **FAIL** : verification echouee, reparation impossible (P0 = bloquant)
- **SKIP** : verification ignoree (prerequis manquant)
- **WARN** : verification partiellement reussie / manuelle

---

EOF

echo "[PREP] Rapport initialise : $REPORT_FILE"

# Variables globales
PASS=0
PASS_REPAIRED=0
FAIL=0
SKIP=0
WARN=0
TABLE_ROWS=""

# Fonction d'ajout de ligne dans le rapport
add_row() {
  local id="$1" desc="$2" status="$3" details="$4"
  TABLE_ROWS="$TABLE_ROWS| $id | $desc | $status | $details |\n"
  case "$status" in
    PASS)    ((PASS++)) ;;
    "PASS*") ((PASS_REPAIRED++)) ;;
    FAIL)    ((FAIL++)) ;;
    SKIP)    ((SKIP++)) ;;
    WARN)    ((WARN++)) ;;
  esac
  echo "[$status] $id - $desc : $details"
}

# Variables connexion DB skalean-insurtech
DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
REDIS_HOST="${REDIS_HOST:-localhost}"
REDIS_PORT="${REDIS_PORT:-6379}"

# Variables Skalean AI (service externe)
SKALEAN_AI_BASE_URL="${SKALEAN_AI_BASE_URL:-https://api-mock.skalean.ai}"
SKALEAN_AI_API_KEY="${SKALEAN_AI_API_KEY:-test_api_key}"

# Helpers
pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }
pg_query_raw() { psql "$DB_URL" -c "$1" 2>/dev/null; }
```

---

## VERIFICATIONS PAR TACHE (15 taches)

## TACHE 1/7 -- 2.1.1 : Init @insurtech/auth Package

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.1 : Init @insurtech/auth Package"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T01-F1: Existence fichier repo/packages/auth/package.json
if [ -f "repo/packages/auth/package.json" ]; then
  add_row "T01-F1" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T01-F1" "Fichier package.json existe" "FAIL" "Manquant"
fi
# Test T01-F2: Existence fichier repo/packages/auth/tsconfig.json
if [ -f "repo/packages/auth/tsconfig.json" ]; then
  add_row "T01-F2" "Fichier tsconfig.json existe" "PASS" "Cree"
else
  add_row "T01-F2" "Fichier tsconfig.json existe" "FAIL" "Manquant"
fi
# Test T01-F3: Existence fichier repo/packages/auth/src/types/auth-context.ts
if [ -f "repo/packages/auth/src/types/auth-context.ts" ]; then
  add_row "T01-F3" "Fichier auth-context.ts existe" "PASS" "Cree"
else
  add_row "T01-F3" "Fichier auth-context.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T01-V1: Package build reussit (P0)
echo "  Verifying T01-V1 : Package build reussit..."
add_row "T01-V1" "Package build reussit" "WARN" "(P0) Voir B-05 Tache 2.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V2: 12 roles enum accessible (P0)
echo "  Verifying T01-V2 : 12 roles enum accessible..."
add_row "T01-V2" "12 roles enum accessible" "WARN" "(P0) Voir B-05 Tache 2.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V3: 5 schemas Zod presents et testes (P0)
echo "  Verifying T01-V3 : 5 schemas Zod presents et testes..."
add_row "T01-V3" "5 schemas Zod presents et testes" "WARN" "(P0) Voir B-05 Tache 2.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V4: Password policy regex match : 'MyP@ss12345' valide, 'weak' rejete (P0)
echo "  Verifying T01-V4 : Password policy regex match : 'MyP@ss12345' valide, 'weak' rejete..."
add_row "T01-V4" "Password policy regex match : 'MyP@ss12345' valide, 'weak' rejete" "WARN" "(P0) Voir B-05 Tache 2.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V5: Constants Argon2 params >= 65536/3/4 (P0)
echo "  Verifying T01-V5 : Constants Argon2 params >= 65536/3/4..."
add_row "T01-V5" "Constants Argon2 params >= 65536/3/4" "WARN" "(P0) Voir B-05 Tache 2.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V6: JWT TTL access 15min, refresh 30 jours (P0)
echo "  Verifying T01-V6 : JWT TTL access 15min, refresh 30 jours..."
add_row "T01-V6" "JWT TTL access 15min, refresh 30 jours" "WARN" "(P0) Voir B-05 Tache 2.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T01-V7: Tests Zod 5+ scenarios passent (P1)
echo "  Verifying T01-V7 : Tests Zod 5+ scenarios passent..."
add_row "T01-V7" "Tests Zod 5+ scenarios passent" "WARN" "(P1) Voir B-05 Tache 2.1.1 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 2/10 -- 2.1.2 : Argon2id Service : Hash + Verify + Password Policies

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.2 : Argon2id Service : Hash + Verify + Password Policies"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T02-F1: Existence fichier repo/packages/auth/src/services/argon2.service.ts
if [ -f "repo/packages/auth/src/services/argon2.service.ts" ]; then
  add_row "T02-F1" "Fichier argon2.service.ts existe" "PASS" "Cree"
else
  add_row "T02-F1" "Fichier argon2.service.ts existe" "FAIL" "Manquant"
fi
# Test T02-F2: Existence fichier repo/packages/auth/src/services/argon2.service.spec.ts
if [ -f "repo/packages/auth/src/services/argon2.service.spec.ts" ]; then
  add_row "T02-F2" "Fichier argon2.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T02-F2" "Fichier argon2.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T02-F3: Existence fichier repo/packages/auth/src/data/banned-passwords.json
if [ -f "repo/packages/auth/src/data/banned-passwords.json" ]; then
  add_row "T02-F3" "Fichier banned-passwords.json existe" "PASS" "Cree"
else
  add_row "T02-F3" "Fichier banned-passwords.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T02-V1: 'hash(password)' retourne string format Argon2 (P0)
echo "  Verifying T02-V1 : 'hash(password)' retourne string format Argon2..."
add_row "T02-V1" "'hash(password)' retourne string format Argon2" "WARN" "(P0) Voir B-05 Tache 2.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V2: 'verify(hash, password)' retourne true si match, false sinon (P0)
echo "  Verifying T02-V2 : 'verify(hash, password)' retourne true si match, false sinon..."
add_row "T02-V2" "'verify(hash, password)' retourne true si match, false sinon" "WARN" "(P0) Voir B-05 Tache 2.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V3: 'verify' constant-time (pas de timing attack) (P0)
echo "  Verifying T02-V3 : 'verify' constant-time (pas de timing attack)..."
add_row "T02-V3" "'verify' constant-time (pas de timing attack)" "WARN" "(P0) Voir B-05 Tache 2.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V4: 'validatePolicy('MyStrongP@ss123')' valide (P0)
echo "  Verifying T02-V4 : 'validatePolicy('MyStrongP@ss123')' valide..."
add_row "T02-V4" "'validatePolicy('MyStrongP@ss123')' valide" "WARN" "(P0) Voir B-05 Tache 2.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V5: 'validatePolicy('password123')' rejete (trop court, banlist) (P0)
echo "  Verifying T02-V5 : 'validatePolicy('password123')' rejete (trop court, banlist)..."
add_row "T02-V5" "'validatePolicy('password123')' rejete (trop court, banlist)" "WARN" "(P0) Voir B-05 Tache 2.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V6: 'validatePolicy('MyP@ss12345', { email: 'myp@ss.com' })' rejete (similar email) (P0)
echo "  Verifying T02-V6 : 'validatePolicy('MyP@ss12345', { email: 'myp@ss.com' })' rejete (simil..."
add_row "T02-V6" "'validatePolicy('MyP@ss12345', { email: 'myp@ss.com' })' rejete (similar email)" "WARN" "(P0) Voir B-05 Tache 2.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V7: 'needsRehash' detect old params (P0)
echo "  Verifying T02-V7 : 'needsRehash' detect old params..."
add_row "T02-V7" "'needsRehash' detect old params" "WARN" "(P0) Voir B-05 Tache 2.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T02-V8: Banlist 1000 password chargee (P0)
echo "  Verifying T02-V8 : Banlist 1000 password chargee..."
add_row "T02-V8" "Banlist 1000 password chargee" "WARN" "(P0) Voir B-05 Tache 2.1.2 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 3/10 -- 2.1.3 : Crypto Services : AES-GCM (MFA Secret) + SHA-256 (Refresh Tokens)

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.3 : Crypto Services : AES-GCM (MFA Secret) + SHA-256 (Refresh To"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T03-F1: Existence fichier repo/packages/auth/src/services/encryption.service.ts
if [ -f "repo/packages/auth/src/services/encryption.service.ts" ]; then
  add_row "T03-F1" "Fichier encryption.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F1" "Fichier encryption.service.ts existe" "FAIL" "Manquant"
fi
# Test T03-F2: Existence fichier repo/packages/auth/src/services/encryption.service.spec.ts
if [ -f "repo/packages/auth/src/services/encryption.service.spec.ts" ]; then
  add_row "T03-F2" "Fichier encryption.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T03-F2" "Fichier encryption.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T03-F3: Existence fichier repo/packages/auth/src/services/hashing.service.ts
if [ -f "repo/packages/auth/src/services/hashing.service.ts" ]; then
  add_row "T03-F3" "Fichier hashing.service.ts existe" "PASS" "Cree"
else
  add_row "T03-F3" "Fichier hashing.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T03-V1: 'encrypt(plaintext)' retourne string format 'iv:ct:tag' (P0)
echo "  Verifying T03-V1 : 'encrypt(plaintext)' retourne string format 'iv:ct:tag'..."
add_row "T03-V1" "'encrypt(plaintext)' retourne string format 'iv:ct:tag'" "WARN" "(P0) Voir B-05 Tache 2.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V2: 'decrypt(encrypt(x))' retourne x (P0)
echo "  Verifying T03-V2 : 'decrypt(encrypt(x))' retourne x..."
add_row "T03-V2" "'decrypt(encrypt(x))' retourne x" "WARN" "(P0) Voir B-05 Tache 2.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V3: 2 calls 'encrypt(same plaintext)' produisent 2 ciphertexts differents (IV unique) (P0)
echo "  Verifying T03-V3 : 2 calls 'encrypt(same plaintext)' produisent 2 ciphertexts differents ..."
add_row "T03-V3" "2 calls 'encrypt(same plaintext)' produisent 2 ciphertexts differents (IV unique)" "WARN" "(P0) Voir B-05 Tache 2.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V4: Tampered ciphertext fail decryption (authTag invalid) (P0)
echo "  Verifying T03-V4 : Tampered ciphertext fail decryption (authTag invalid)..."
add_row "T03-V4" "Tampered ciphertext fail decryption (authTag invalid)" "WARN" "(P0) Voir B-05 Tache 2.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V5: Throw si key < 32 chars (P0)
echo "  Verifying T03-V5 : Throw si key < 32 chars..."
add_row "T03-V5" "Throw si key < 32 chars" "WARN" "(P0) Voir B-05 Tache 2.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V6: 'sha256(input)' retourne hex 64 chars deterministe (P0)
echo "  Verifying T03-V6 : 'sha256(input)' retourne hex 64 chars deterministe..."
add_row "T03-V6" "'sha256(input)' retourne hex 64 chars deterministe" "WARN" "(P0) Voir B-05 Tache 2.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V7: 'hmacSha256(input, key)' retourne hex 64 chars (P0)
echo "  Verifying T03-V7 : 'hmacSha256(input, key)' retourne hex 64 chars..."
add_row "T03-V7" "'hmacSha256(input, key)' retourne hex 64 chars" "WARN" "(P0) Voir B-05 Tache 2.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T03-V8: 'randomToken(32)' retourne base64url string ~43 chars (P0)
echo "  Verifying T03-V8 : 'randomToken(32)' retourne base64url string ~43 chars..."
add_row "T03-V8" "'randomToken(32)' retourne base64url string ~43 chars" "WARN" "(P0) Voir B-05 Tache 2.1.3 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 4/10 -- 2.1.4 : JWT Service : Sign + Verify Access/Refresh + Rotation

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.4 : JWT Service : Sign + Verify Access/Refresh + Rotation"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T04-F1: Existence fichier repo/packages/auth/src/services/jwt.service.ts
if [ -f "repo/packages/auth/src/services/jwt.service.ts" ]; then
  add_row "T04-F1" "Fichier jwt.service.ts existe" "PASS" "Cree"
else
  add_row "T04-F1" "Fichier jwt.service.ts existe" "FAIL" "Manquant"
fi
# Test T04-F2: Existence fichier repo/packages/auth/src/services/jwt.service.spec.ts
if [ -f "repo/packages/auth/src/services/jwt.service.spec.ts" ]; then
  add_row "T04-F2" "Fichier jwt.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T04-F2" "Fichier jwt.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T04-F3: Existence fichier repo/packages/auth/src/errors/token-errors.ts
if [ -f "repo/packages/auth/src/errors/token-errors.ts" ]; then
  add_row "T04-F3" "Fichier token-errors.ts existe" "PASS" "Cree"
else
  add_row "T04-F3" "Fichier token-errors.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T04-V1: 'signAccessToken(payload)' retourne JWT 3 parties dot-separated (P0)
echo "  Verifying T04-V1 : 'signAccessToken(payload)' retourne JWT 3 parties dot-separated..."
add_row "T04-V1" "'signAccessToken(payload)' retourne JWT 3 parties dot-separated" "WARN" "(P0) Voir B-05 Tache 2.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V2: 'verifyAccessToken(signedToken)' retourne payload original (P0)
echo "  Verifying T04-V2 : 'verifyAccessToken(signedToken)' retourne payload original..."
add_row "T04-V2" "'verifyAccessToken(signedToken)' retourne payload original" "WARN" "(P0) Voir B-05 Tache 2.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V3: Token expired throw 'TokenExpiredError' (P0)
echo "  Verifying T04-V3 : Token expired throw 'TokenExpiredError'..."
add_row "T04-V3" "Token expired throw 'TokenExpiredError'" "WARN" "(P0) Voir B-05 Tache 2.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V4: Token tampered (signature) throw 'TokenInvalidError' (P0)
echo "  Verifying T04-V4 : Token tampered (signature) throw 'TokenInvalidError'..."
add_row "T04-V4" "Token tampered (signature) throw 'TokenInvalidError'" "WARN" "(P0) Voir B-05 Tache 2.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V5: Token wrong audience throw 'TokenAudienceError' (P0)
echo "  Verifying T04-V5 : Token wrong audience throw 'TokenAudienceError'..."
add_row "T04-V5" "Token wrong audience throw 'TokenAudienceError'" "WARN" "(P0) Voir B-05 Tache 2.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V6: Refresh token signe avec REFRESH_SECRET (different access) (P0)
echo "  Verifying T04-V6 : Refresh token signe avec REFRESH_SECRET (different access)..."
add_row "T04-V6" "Refresh token signe avec REFRESH_SECRET (different access)" "WARN" "(P0) Voir B-05 Tache 2.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V7: 'extractFromHeader('Bearer xxx')' retourne 'xxx' (P0)
echo "  Verifying T04-V7 : 'extractFromHeader('Bearer xxx')' retourne 'xxx'..."
add_row "T04-V7" "'extractFromHeader('Bearer xxx')' retourne 'xxx'" "WARN" "(P0) Voir B-05 Tache 2.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T04-V8: 'extractFromHeader('Basic xxx')' retourne null (P0)
echo "  Verifying T04-V8 : 'extractFromHeader('Basic xxx')' retourne null..."
add_row "T04-V8" "'extractFromHeader('Basic xxx')' retourne null" "WARN" "(P0) Voir B-05 Tache 2.1.4 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 5/10 -- 2.1.5 : Session Service : Redis Storage + Lookup + Revocation

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.5 : Session Service : Redis Storage + Lookup + Revocation"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T05-F1: Existence fichier repo/packages/auth/src/services/session.service.ts
if [ -f "repo/packages/auth/src/services/session.service.ts" ]; then
  add_row "T05-F1" "Fichier session.service.ts existe" "PASS" "Cree"
else
  add_row "T05-F1" "Fichier session.service.ts existe" "FAIL" "Manquant"
fi
# Test T05-F2: Existence fichier repo/packages/auth/src/services/session.service.spec.ts
if [ -f "repo/packages/auth/src/services/session.service.spec.ts" ]; then
  add_row "T05-F2" "Fichier session.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T05-F2" "Fichier session.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T05-F3: Existence fichier repo/packages/auth/src/types/session-record.ts
if [ -f "repo/packages/auth/src/types/session-record.ts" ]; then
  add_row "T05-F3" "Fichier session-record.ts existe" "PASS" "Cree"
else
  add_row "T05-F3" "Fichier session-record.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T05-V1: 'createSession' stocke en Redis + DB (P0)
echo "  Verifying T05-V1 : 'createSession' stocke en Redis + DB..."
add_row "T05-V1" "'createSession' stocke en Redis + DB" "WARN" "(P0) Voir B-05 Tache 2.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V2: 'getSession(jti)' retourne SessionRecord (P0)
echo "  Verifying T05-V2 : 'getSession(jti)' retourne SessionRecord..."
add_row "T05-V2" "'getSession(jti)' retourne SessionRecord" "WARN" "(P0) Voir B-05 Tache 2.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V3: 'revokeSession(jti)' : session inaccessible + blacklist set (P0)
echo "  Verifying T05-V3 : 'revokeSession(jti)' : session inaccessible + blacklist set..."
add_row "T05-V3" "'revokeSession(jti)' : session inaccessible + blacklist set" "WARN" "(P0) Voir B-05 Tache 2.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V4: 'isRevoked(jti)' retourne true apres revoke (P0)
echo "  Verifying T05-V4 : 'isRevoked(jti)' retourne true apres revoke..."
add_row "T05-V4" "'isRevoked(jti)' retourne true apres revoke" "WARN" "(P0) Voir B-05 Tache 2.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V5: 'revokeFamily' : tous tokens family inaccessibles (P0)
echo "  Verifying T05-V5 : 'revokeFamily' : tous tokens family inaccessibles..."
add_row "T05-V5" "'revokeFamily' : tous tokens family inaccessibles" "WARN" "(P0) Voir B-05 Tache 2.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V6: 'rotateSession' atomic (test : kill server in between fails clean) (P0)
echo "  Verifying T05-V6 : 'rotateSession' atomic (test : kill server in between fails clean)..."
add_row "T05-V6" "'rotateSession' atomic (test : kill server in between fails clean)" "WARN" "(P0) Voir B-05 Tache 2.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V7: TTL Redis = JWT_REFRESH_TTL (30 jours) (P0)
echo "  Verifying T05-V7 : TTL Redis = JWT_REFRESH_TTL (30 jours)..."
add_row "T05-V7" "TTL Redis = JWT_REFRESH_TTL (30 jours)" "WARN" "(P0) Voir B-05 Tache 2.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T05-V8: 'revokeUserSessions(userId)' revoke tous tokens user (P0)
echo "  Verifying T05-V8 : 'revokeUserSessions(userId)' revoke tous tokens user..."
add_row "T05-V8" "'revokeUserSessions(userId)' revoke tous tokens user" "WARN" "(P0) Voir B-05 Tache 2.1.5 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 6/12 -- 2.1.6 : AuthModule + AuthController + AuthService + JWT Strategy + JwtAuthGuard

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.6 : AuthModule + AuthController + AuthService + JWT Strategy + J"
echo "Priorite : P0 | Effort : 7h"
echo "Criteres a verifier : 12"
echo "================================================"

# === Verification fichiers crees ===
# Test T06-F1: Existence fichier repo/apps/api/src/modules/auth/auth.module.ts
if [ -f "repo/apps/api/src/modules/auth/auth.module.ts" ]; then
  add_row "T06-F1" "Fichier auth.module.ts existe" "PASS" "Cree"
else
  add_row "T06-F1" "Fichier auth.module.ts existe" "FAIL" "Manquant"
fi
# Test T06-F2: Existence fichier repo/apps/api/src/modules/auth/auth.controller.ts
if [ -f "repo/apps/api/src/modules/auth/auth.controller.ts" ]; then
  add_row "T06-F2" "Fichier auth.controller.ts existe" "PASS" "Cree"
else
  add_row "T06-F2" "Fichier auth.controller.ts existe" "FAIL" "Manquant"
fi
# Test T06-F3: Existence fichier repo/apps/api/src/modules/auth/auth.service.ts
if [ -f "repo/apps/api/src/modules/auth/auth.service.ts" ]; then
  add_row "T06-F3" "Fichier auth.service.ts existe" "PASS" "Cree"
else
  add_row "T06-F3" "Fichier auth.service.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T06-V1: POST /signin avec creds valides retourne tokens + user (P0)
echo "  Verifying T06-V1 : POST /signin avec creds valides retourne tokens + user..."
add_row "T06-V1" "POST /signin avec creds valides retourne tokens + user" "WARN" "(P0) Voir B-05 Tache 2.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V2: POST /signin avec mauvais password retourne 401 INVALID_CREDENTIALS (P0)
echo "  Verifying T06-V2 : POST /signin avec mauvais password retourne 401 INVALID_CREDENTIALS..."
add_row "T06-V2" "POST /signin avec mauvais password retourne 401 INVALID_CREDENTIALS" "WARN" "(P0) Voir B-05 Tache 2.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V3: POST /signin avec compte locke retourne 401 ACCOUNT_LOCKED (P0)
echo "  Verifying T06-V3 : POST /signin avec compte locke retourne 401 ACCOUNT_LOCKED..."
add_row "T06-V3" "POST /signin avec compte locke retourne 401 ACCOUNT_LOCKED" "WARN" "(P0) Voir B-05 Tache 2.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V4: POST /signin sans email verifie retourne 401 EMAIL_NOT_VERIFIED (P0)
echo "  Verifying T06-V4 : POST /signin sans email verifie retourne 401 EMAIL_NOT_VERIFIED..."
add_row "T06-V4" "POST /signin sans email verifie retourne 401 EMAIL_NOT_VERIFIED" "WARN" "(P0) Voir B-05 Tache 2.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V5: POST /signin avec MFA enabled retourne 'needs_mfa: true' (P0)
echo "  Verifying T06-V5 : POST /signin avec MFA enabled retourne 'needs_mfa: true'..."
add_row "T06-V5" "POST /signin avec MFA enabled retourne 'needs_mfa: true'" "WARN" "(P0) Voir B-05 Tache 2.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V6: GET /me avec valid token retourne user (P0)
echo "  Verifying T06-V6 : GET /me avec valid token retourne user..."
add_row "T06-V6" "GET /me avec valid token retourne user" "WARN" "(P0) Voir B-05 Tache 2.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V7: GET /me sans token retourne 401 (P0)
echo "  Verifying T06-V7 : GET /me sans token retourne 401..."
add_row "T06-V7" "GET /me sans token retourne 401" "WARN" "(P0) Voir B-05 Tache 2.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T06-V8: POST /refresh retourne nouveaux tokens + invalide ancien (P0)
echo "  Verifying T06-V8 : POST /refresh retourne nouveaux tokens + invalide ancien..."
add_row "T06-V8" "POST /refresh retourne nouveaux tokens + invalide ancien" "WARN" "(P0) Voir B-05 Tache 2.1.6 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 7/10 -- 2.1.7 : MFA Service : TOTP RFC 6238 + QR + Recovery Codes

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.7 : MFA Service : TOTP RFC 6238 + QR + Recovery Codes"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T07-F1: Existence fichier repo/packages/auth/src/services/mfa.service.ts
if [ -f "repo/packages/auth/src/services/mfa.service.ts" ]; then
  add_row "T07-F1" "Fichier mfa.service.ts existe" "PASS" "Cree"
else
  add_row "T07-F1" "Fichier mfa.service.ts existe" "FAIL" "Manquant"
fi
# Test T07-F2: Existence fichier repo/packages/auth/src/services/mfa.service.spec.ts
if [ -f "repo/packages/auth/src/services/mfa.service.spec.ts" ]; then
  add_row "T07-F2" "Fichier mfa.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T07-F2" "Fichier mfa.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T07-F3: Existence fichier repo/packages/auth/package.json
if [ -f "repo/packages/auth/package.json" ]; then
  add_row "T07-F3" "Fichier package.json existe" "PASS" "Cree"
else
  add_row "T07-F3" "Fichier package.json existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T07-V1: 'generateSecret(email)' retourne '{ secret, qrCode, otpauthUrl }' (P0)
echo "  Verifying T07-V1 : 'generateSecret(email)' retourne '{ secret, qrCode, otpauthUrl }'..."
add_row "T07-V1" "'generateSecret(email)' retourne '{ secret, qrCode, otpauthUrl }'" "WARN" "(P0) Voir B-05 Tache 2.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V2: 'verifyToken(secret, token)' retourne true si token valide (P0)
echo "  Verifying T07-V2 : 'verifyToken(secret, token)' retourne true si token valide..."
add_row "T07-V2" "'verifyToken(secret, token)' retourne true si token valide" "WARN" "(P0) Voir B-05 Tache 2.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V3: Token genere avec autre secret rejete (P0)
echo "  Verifying T07-V3 : Token genere avec autre secret rejete..."
add_row "T07-V3" "Token genere avec autre secret rejete" "WARN" "(P0) Voir B-05 Tache 2.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V4: Token expire (>30s+30s) rejete (P0)
echo "  Verifying T07-V4 : Token expire (>30s+30s) rejete..."
add_row "T07-V4" "Token expire (>30s+30s) rejete" "WARN" "(P0) Voir B-05 Tache 2.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V5: Window +/-1 accept token current ou previous step (P0)
echo "  Verifying T07-V5 : Window +/-1 accept token current ou previous step..."
add_row "T07-V5" "Window +/-1 accept token current ou previous step" "WARN" "(P0) Voir B-05 Tache 2.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V6: 'generateRecoveryCodes()' retourne 6 strings format 'XXXX-XXXX-XXXX' (P0)
echo "  Verifying T07-V6 : 'generateRecoveryCodes()' retourne 6 strings format 'XXXX-XXXX-XXXX'..."
add_row "T07-V6" "'generateRecoveryCodes()' retourne 6 strings format 'XXXX-XXXX-XXXX'" "WARN" "(P0) Voir B-05 Tache 2.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V7: Codes recovery hashes Argon2 (longueur ~95 chars) (P0)
echo "  Verifying T07-V7 : Codes recovery hashes Argon2 (longueur ~95 chars)..."
add_row "T07-V7" "Codes recovery hashes Argon2 (longueur ~95 chars)" "WARN" "(P0) Voir B-05 Tache 2.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T07-V8: 'verifyRecoveryCode(hashes, code)' retourne '{ valid, indexUsed }' (P0)
echo "  Verifying T07-V8 : 'verifyRecoveryCode(hashes, code)' retourne '{ valid, indexUsed }'..."
add_row "T07-V8" "'verifyRecoveryCode(hashes, code)' retourne '{ valid, indexUsed }'" "WARN" "(P0) Voir B-05 Tache 2.1.7 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 8/10 -- 2.1.8 : MFA Required Guard + Endpoints

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.8 : MFA Required Guard + Endpoints"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T08-F1: Existence fichier repo/apps/api/src/modules/auth/auth.controller.ts
if [ -f "repo/apps/api/src/modules/auth/auth.controller.ts" ]; then
  add_row "T08-F1" "Fichier auth.controller.ts existe" "PASS" "Cree"
else
  add_row "T08-F1" "Fichier auth.controller.ts existe" "FAIL" "Manquant"
fi
# Test T08-F2: Existence fichier repo/apps/api/src/modules/auth/auth.service.ts
if [ -f "repo/apps/api/src/modules/auth/auth.service.ts" ]; then
  add_row "T08-F2" "Fichier auth.service.ts existe" "PASS" "Cree"
else
  add_row "T08-F2" "Fichier auth.service.ts existe" "FAIL" "Manquant"
fi
# Test T08-F3: Existence fichier repo/apps/api/src/modules/auth/guards/mfa-required.guard.ts
if [ -f "repo/apps/api/src/modules/auth/guards/mfa-required.guard.ts" ]; then
  add_row "T08-F3" "Fichier mfa-required.guard.ts existe" "PASS" "Cree"
else
  add_row "T08-F3" "Fichier mfa-required.guard.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T08-V1: POST /setup-mfa retourne secret + QR + 6 recovery codes (P0)
echo "  Verifying T08-V1 : POST /setup-mfa retourne secret + QR + 6 recovery codes..."
add_row "T08-V1" "POST /setup-mfa retourne secret + QR + 6 recovery codes" "WARN" "(P0) Voir B-05 Tache 2.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V2: POST /confirm-mfa avec TOTP valide active mfa_enabled (P0)
echo "  Verifying T08-V2 : POST /confirm-mfa avec TOTP valide active mfa_enabled..."
add_row "T08-V2" "POST /confirm-mfa avec TOTP valide active mfa_enabled" "WARN" "(P0) Voir B-05 Tache 2.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V3: Apres confirm-mfa, force re-login (sessions revoked) (P0)
echo "  Verifying T08-V3 : Apres confirm-mfa, force re-login (sessions revoked)..."
add_row "T08-V3" "Apres confirm-mfa, force re-login (sessions revoked)" "WARN" "(P0) Voir B-05 Tache 2.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V4: POST /signin avec mfa_enabled retourne needs_mfa (P0)
echo "  Verifying T08-V4 : POST /signin avec mfa_enabled retourne needs_mfa..."
add_row "T08-V4" "POST /signin avec mfa_enabled retourne needs_mfa" "WARN" "(P0) Voir B-05 Tache 2.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V5: POST /verify-mfa avec TOTP valide retourne tokens (P0)
echo "  Verifying T08-V5 : POST /verify-mfa avec TOTP valide retourne tokens..."
add_row "T08-V5" "POST /verify-mfa avec TOTP valide retourne tokens" "WARN" "(P0) Voir B-05 Tache 2.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V6: POST /verify-mfa avec recovery code valide retourne tokens + invalide code (P0)
echo "  Verifying T08-V6 : POST /verify-mfa avec recovery code valide retourne tokens + invalide ..."
add_row "T08-V6" "POST /verify-mfa avec recovery code valide retourne tokens + invalide code" "WARN" "(P0) Voir B-05 Tache 2.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V7: Recovery code already used rejete (P0)
echo "  Verifying T08-V7 : Recovery code already used rejete..."
add_row "T08-V7" "Recovery code already used rejete" "WARN" "(P0) Voir B-05 Tache 2.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T08-V8: POST /disable-mfa sans password rejete (P0)
echo "  Verifying T08-V8 : POST /disable-mfa sans password rejete..."
add_row "T08-V8" "POST /disable-mfa sans password rejete" "WARN" "(P0) Voir B-05 Tache 2.1.8 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 9/10 -- 2.1.9 : Signup Flow + Email Verification

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.9 : Signup Flow + Email Verification"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 10"
echo "================================================"

# === Verification fichiers crees ===
# Test T09-F1: Existence fichier repo/apps/api/src/modules/auth/auth.controller.ts
if [ -f "repo/apps/api/src/modules/auth/auth.controller.ts" ]; then
  add_row "T09-F1" "Fichier auth.controller.ts existe" "PASS" "Cree"
else
  add_row "T09-F1" "Fichier auth.controller.ts existe" "FAIL" "Manquant"
fi
# Test T09-F2: Existence fichier repo/apps/api/src/modules/auth/auth.service.ts
if [ -f "repo/apps/api/src/modules/auth/auth.service.ts" ]; then
  add_row "T09-F2" "Fichier auth.service.ts existe" "PASS" "Cree"
else
  add_row "T09-F2" "Fichier auth.service.ts existe" "FAIL" "Manquant"
fi
# Test T09-F3: Existence fichier repo/packages/database/src/migrations/{date}-EmailVerifications.ts
if [ -f "repo/packages/database/src/migrations/{date}-EmailVerifications.ts" ]; then
  add_row "T09-F3" "Fichier {date}-EmailVerifications.ts existe" "PASS" "Cree"
else
  add_row "T09-F3" "Fichier {date}-EmailVerifications.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T09-V1: POST /signup avec data valide cree user (email_verified_at NULL) (P0)
echo "  Verifying T09-V1 : POST /signup avec data valide cree user (email_verified_at NULL)..."
add_row "T09-V1" "POST /signup avec data valide cree user (email_verified_at NULL)" "WARN" "(P0) Voir B-05 Tache 2.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V2: Email verification envoye (P0)
echo "  Verifying T09-V2 : Email verification envoye..."
add_row "T09-V2" "Email verification envoye" "WARN" "(P0) Voir B-05 Tache 2.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V3: POST /signup email duplique retourne meme reponse (anti-enumeration) (P0)
echo "  Verifying T09-V3 : POST /signup email duplique retourne meme reponse (anti-enumeration)..."
add_row "T09-V3" "POST /signup email duplique retourne meme reponse (anti-enumeration)" "WARN" "(P0) Voir B-05 Tache 2.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V4: POST /signup password faible rejete avec reasons (P0)
echo "  Verifying T09-V4 : POST /signup password faible rejete avec reasons..."
add_row "T09-V4" "POST /signup password faible rejete avec reasons" "WARN" "(P0) Voir B-05 Tache 2.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V5: GET /verify-email?token=valid mark verified + redirect (P0)
echo "  Verifying T09-V5 : GET /verify-email?token=valid mark verified + redirect..."
add_row "T09-V5" "GET /verify-email?token=valid mark verified + redirect" "WARN" "(P0) Voir B-05 Tache 2.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V6: GET /verify-email?token=expired rejete (P0)
echo "  Verifying T09-V6 : GET /verify-email?token=expired rejete..."
add_row "T09-V6" "GET /verify-email?token=expired rejete" "WARN" "(P0) Voir B-05 Tache 2.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V7: GET /verify-email?token=invalid rejete (P0)
echo "  Verifying T09-V7 : GET /verify-email?token=invalid rejete..."
add_row "T09-V7" "GET /verify-email?token=invalid rejete" "WARN" "(P0) Voir B-05 Tache 2.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T09-V8: POST /signin sans email verified retourne 401 EMAIL_NOT_VERIFIED (P0)
echo "  Verifying T09-V8 : POST /signin sans email verified retourne 401 EMAIL_NOT_VERIFIED..."
add_row "T09-V8" "POST /signin sans email verified retourne 401 EMAIL_NOT_VERIFIED" "WARN" "(P0) Voir B-05 Tache 2.1.9 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 10/9 -- 2.1.10 : Lockout Service (Anti Brute Force)

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.10 : Lockout Service (Anti Brute Force)"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 9"
echo "================================================"

# === Verification fichiers crees ===
# Test T10-F1: Existence fichier repo/packages/auth/src/services/lockout.service.ts
if [ -f "repo/packages/auth/src/services/lockout.service.ts" ]; then
  add_row "T10-F1" "Fichier lockout.service.ts existe" "PASS" "Cree"
else
  add_row "T10-F1" "Fichier lockout.service.ts existe" "FAIL" "Manquant"
fi
# Test T10-F2: Existence fichier repo/packages/auth/src/services/lockout.service.spec.ts
if [ -f "repo/packages/auth/src/services/lockout.service.spec.ts" ]; then
  add_row "T10-F2" "Fichier lockout.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T10-F2" "Fichier lockout.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T10-V1: 5 fails consecutifs -> lock 30min (P0)
echo "  Verifying T10-V1 : 5 fails consecutifs -> lock 30min..."
add_row "T10-V1" "5 fails consecutifs -> lock 30min" "WARN" "(P0) Voir B-05 Tache 2.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V2: 6e tentative pendant lock rejette + retourne retryAfter (P0)
echo "  Verifying T10-V2 : 6e tentative pendant lock rejette + retourne retryAfter..."
add_row "T10-V2" "6e tentative pendant lock rejette + retourne retryAfter" "WARN" "(P0) Voir B-05 Tache 2.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V3: Succes reset compteur (P0)
echo "  Verifying T10-V3 : Succes reset compteur..."
add_row "T10-V3" "Succes reset compteur" "WARN" "(P0) Voir B-05 Tache 2.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V4: Apres 30min, lock expire automatique (P0)
echo "  Verifying T10-V4 : Apres 30min, lock expire automatique..."
add_row "T10-V4" "Apres 30min, lock expire automatique" "WARN" "(P0) Voir B-05 Tache 2.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V5: Counter par IP : 50 fails IP -> block IP 1h (P0)
echo "  Verifying T10-V5 : Counter par IP : 50 fails IP -> block IP 1h..."
add_row "T10-V5" "Counter par IP : 50 fails IP -> block IP 1h" "WARN" "(P0) Voir B-05 Tache 2.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V6: Backoff exponential : 2eme lock 1h, 3eme lock 4h (P0)
echo "  Verifying T10-V6 : Backoff exponential : 2eme lock 1h, 3eme lock 4h..."
add_row "T10-V6" "Backoff exponential : 2eme lock 1h, 3eme lock 4h" "WARN" "(P0) Voir B-05 Tache 2.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V7: Audit + Kafka events (P0)
echo "  Verifying T10-V7 : Audit + Kafka events..."
add_row "T10-V7" "Audit + Kafka events" "WARN" "(P0) Voir B-05 Tache 2.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T10-V8: Email notification envoye user (P0)
echo "  Verifying T10-V8 : Email notification envoye user..."
add_row "T10-V8" "Email notification envoye user" "WARN" "(P0) Voir B-05 Tache 2.1.10 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 11/8 -- 2.1.11 : Account Recovery Service

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.11 : Account Recovery Service"
echo "Priorite : P0 | Effort : 5h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T11-F1: Existence fichier repo/apps/api/src/modules/auth/auth.controller.ts
if [ -f "repo/apps/api/src/modules/auth/auth.controller.ts" ]; then
  add_row "T11-F1" "Fichier auth.controller.ts existe" "PASS" "Cree"
else
  add_row "T11-F1" "Fichier auth.controller.ts existe" "FAIL" "Manquant"
fi
# Test T11-F2: Existence fichier repo/apps/api/src/modules/auth/auth.service.ts
if [ -f "repo/apps/api/src/modules/auth/auth.service.ts" ]; then
  add_row "T11-F2" "Fichier auth.service.ts existe" "PASS" "Cree"
else
  add_row "T11-F2" "Fichier auth.service.ts existe" "FAIL" "Manquant"
fi
# Test T11-F3: Existence fichier repo/packages/database/src/migrations/{date}-PasswordRecoveries.ts
if [ -f "repo/packages/database/src/migrations/{date}-PasswordRecoveries.ts" ]; then
  add_row "T11-F3" "Fichier {date}-PasswordRecoveries.ts existe" "PASS" "Cree"
else
  add_row "T11-F3" "Fichier {date}-PasswordRecoveries.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T11-V1: POST /forgot-password avec email valide envoie email (P0)
echo "  Verifying T11-V1 : POST /forgot-password avec email valide envoie email..."
add_row "T11-V1" "POST /forgot-password avec email valide envoie email" "WARN" "(P0) Voir B-05 Tache 2.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V2: POST /forgot-password email inexistant retourne meme reponse (P0)
echo "  Verifying T11-V2 : POST /forgot-password email inexistant retourne meme reponse..."
add_row "T11-V2" "POST /forgot-password email inexistant retourne meme reponse" "WARN" "(P0) Voir B-05 Tache 2.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V3: POST /reset-password token valide + new password reset (P0)
echo "  Verifying T11-V3 : POST /reset-password token valide + new password reset..."
add_row "T11-V3" "POST /reset-password token valide + new password reset" "WARN" "(P0) Voir B-05 Tache 2.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V4: Token expired (>1h) rejete (P0)
echo "  Verifying T11-V4 : Token expired (>1h) rejete..."
add_row "T11-V4" "Token expired (>1h) rejete" "WARN" "(P0) Voir B-05 Tache 2.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V5: Token already used rejete (P0)
echo "  Verifying T11-V5 : Token already used rejete..."
add_row "T11-V5" "Token already used rejete" "WARN" "(P0) Voir B-05 Tache 2.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V6: Apres reset : toutes sessions revoked (P0)
echo "  Verifying T11-V6 : Apres reset : toutes sessions revoked..."
add_row "T11-V6" "Apres reset : toutes sessions revoked" "WARN" "(P0) Voir B-05 Tache 2.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V7: Apres reset : email confirmation envoye (P0)
echo "  Verifying T11-V7 : Apres reset : email confirmation envoye..."
add_row "T11-V7" "Apres reset : email confirmation envoye" "WARN" "(P0) Voir B-05 Tache 2.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T11-V8: Tests E2E full flow (P0)
echo "  Verifying T11-V8 : Tests E2E full flow..."
add_row "T11-V8" "Tests E2E full flow" "WARN" "(P0) Voir B-05 Tache 2.1.11 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 12/5 -- 2.1.12 : Audit Auth Service

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.12 : Audit Auth Service"
echo "Priorite : P0 | Effort : 4h"
echo "Criteres a verifier : 5"
echo "================================================"

# === Verification fichiers crees ===
# Test T12-F1: Existence fichier repo/apps/api/src/modules/auth/services/audit-auth.service.ts
if [ -f "repo/apps/api/src/modules/auth/services/audit-auth.service.ts" ]; then
  add_row "T12-F1" "Fichier audit-auth.service.ts existe" "PASS" "Cree"
else
  add_row "T12-F1" "Fichier audit-auth.service.ts existe" "FAIL" "Manquant"
fi
# Test T12-F2: Existence fichier repo/apps/api/src/modules/auth/services/audit-auth.service.spec.ts
if [ -f "repo/apps/api/src/modules/auth/services/audit-auth.service.spec.ts" ]; then
  add_row "T12-F2" "Fichier audit-auth.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T12-F2" "Fichier audit-auth.service.spec.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T12-V1: 9 methods presents (P0)
echo "  Verifying T12-V1 : 9 methods presents..."
add_row "T12-V1" "9 methods presents" "WARN" "(P0) Voir B-05 Tache 2.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V2: 'logSignin' cree row audit_log (P0)
echo "  Verifying T12-V2 : 'logSignin' cree row audit_log..."
add_row "T12-V2" "'logSignin' cree row audit_log" "WARN" "(P0) Voir B-05 Tache 2.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V3: 'logSignin' publish Kafka event (P0)
echo "  Verifying T12-V3 : 'logSignin' publish Kafka event..."
add_row "T12-V3" "'logSignin' publish Kafka event" "WARN" "(P0) Voir B-05 Tache 2.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V4: Trace ID present dans audit_log + Kafka envelope (P0)
echo "  Verifying T12-V4 : Trace ID present dans audit_log + Kafka envelope..."
add_row "T12-V4" "Trace ID present dans audit_log + Kafka envelope" "WARN" "(P0) Voir B-05 Tache 2.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T12-V5: Tests 9+ scenarios passent (P0)
echo "  Verifying T12-V5 : Tests 9+ scenarios passent..."
add_row "T12-V5" "Tests 9+ scenarios passent" "WARN" "(P0) Voir B-05 Tache 2.1.12 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 13/8 -- 2.1.13 : Email Service : Nodemailer + Handlebars

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.13 : Email Service : Nodemailer + Handlebars"
echo "Priorite : P0 | Effort : 6h"
echo "Criteres a verifier : 8"
echo "================================================"

# === Verification fichiers crees ===
# Test T13-F1: Existence fichier repo/packages/comm/src/services/email.service.ts
if [ -f "repo/packages/comm/src/services/email.service.ts" ]; then
  add_row "T13-F1" "Fichier email.service.ts existe" "PASS" "Cree"
else
  add_row "T13-F1" "Fichier email.service.ts existe" "FAIL" "Manquant"
fi
# Test T13-F2: Existence fichier repo/packages/comm/src/services/email.service.spec.ts
if [ -f "repo/packages/comm/src/services/email.service.spec.ts" ]; then
  add_row "T13-F2" "Fichier email.service.spec.ts existe" "PASS" "Cree"
else
  add_row "T13-F2" "Fichier email.service.spec.ts existe" "FAIL" "Manquant"
fi
# Test T13-F3: Existence fichier repo/packages/comm/src/templates/_layout.hbs
if [ -f "repo/packages/comm/src/templates/_layout.hbs" ]; then
  add_row "T13-F3" "Fichier _layout.hbs existe" "PASS" "Cree"
else
  add_row "T13-F3" "Fichier _layout.hbs existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T13-V1: 'send(to, 'verify-email', 'fr', vars)' envoie email (P0)
echo "  Verifying T13-V1 : 'send(to, 'verify-email', 'fr', vars)' envoie email..."
add_row "T13-V1" "'send(to, 'verify-email', 'fr', vars)' envoie email" "WARN" "(P0) Voir B-05 Tache 2.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V2: Email recu visible dans Mailhog (P0)
echo "  Verifying T13-V2 : Email recu visible dans Mailhog..."
add_row "T13-V2" "Email recu visible dans Mailhog" "WARN" "(P0) Voir B-05 Tache 2.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V3: Templates 5 emails x 3 locales = 15 templates (P0)
echo "  Verifying T13-V3 : Templates 5 emails x 3 locales = 15 templates..."
add_row "T13-V3" "Templates 5 emails x 3 locales = 15 templates" "WARN" "(P0) Voir B-05 Tache 2.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V4: Layout Skalean applique (header/footer) (P0)
echo "  Verifying T13-V4 : Layout Skalean applique (header/footer)..."
add_row "T13-V4" "Layout Skalean applique (header/footer)" "WARN" "(P0) Voir B-05 Tache 2.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V5: Multipart : HTML + plain text (P0)
echo "  Verifying T13-V5 : Multipart : HTML + plain text..."
add_row "T13-V5" "Multipart : HTML + plain text" "WARN" "(P0) Voir B-05 Tache 2.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V6: Variables Handlebars interpolees (P0)
echo "  Verifying T13-V6 : Variables Handlebars interpolees..."
add_row "T13-V6" "Variables Handlebars interpolees" "WARN" "(P0) Voir B-05 Tache 2.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V7: RTL applique pour ar / ar-MA (P0)
echo "  Verifying T13-V7 : RTL applique pour ar / ar-MA..."
add_row "T13-V7" "RTL applique pour ar / ar-MA" "WARN" "(P0) Voir B-05 Tache 2.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T13-V8: Tests 5+ scenarios passent (P1)
echo "  Verifying T13-V8 : Tests 5+ scenarios passent..."
add_row "T13-V8" "Tests 5+ scenarios passent" "WARN" "(P1) Voir B-05 Tache 2.1.13 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 14/7 -- 2.1.14 : Rate Limiting Auth-Specifique

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.14 : Rate Limiting Auth-Specifique"
echo "Priorite : P0 | Effort : 3h"
echo "Criteres a verifier : 7"
echo "================================================"

# === Verification fichiers crees ===
# Test T14-F1: Existence fichier repo/apps/api/src/modules/auth/auth.controller.ts
if [ -f "repo/apps/api/src/modules/auth/auth.controller.ts" ]; then
  add_row "T14-F1" "Fichier auth.controller.ts existe" "PASS" "Cree"
else
  add_row "T14-F1" "Fichier auth.controller.ts existe" "FAIL" "Manquant"
fi
# Test T14-F2: Existence fichier repo/apps/api/src/modules/auth/throttler/auth-throttler.config.ts
if [ -f "repo/apps/api/src/modules/auth/throttler/auth-throttler.config.ts" ]; then
  add_row "T14-F2" "Fichier auth-throttler.config.ts existe" "PASS" "Cree"
else
  add_row "T14-F2" "Fichier auth-throttler.config.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T14-V1: 5 signin / minute OK, 6e -> 429 (P0)
echo "  Verifying T14-V1 : 5 signin / minute OK, 6e -> 429..."
add_row "T14-V1" "5 signin / minute OK, 6e -> 429" "WARN" "(P0) Voir B-05 Tache 2.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V2: 3 signup / heure OK, 4e -> 429 (P0)
echo "  Verifying T14-V2 : 3 signup / heure OK, 4e -> 429..."
add_row "T14-V2" "3 signup / heure OK, 4e -> 429" "WARN" "(P0) Voir B-05 Tache 2.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V3: 3 forgot-password / heure OK, 4e -> 429 (P0)
echo "  Verifying T14-V3 : 3 forgot-password / heure OK, 4e -> 429..."
add_row "T14-V3" "3 forgot-password / heure OK, 4e -> 429" "WARN" "(P0) Voir B-05 Tache 2.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V4: Refresh 30/min permis (legit cas frequents) (P0)
echo "  Verifying T14-V4 : Refresh 30/min permis (legit cas frequents)..."
add_row "T14-V4" "Refresh 30/min permis (legit cas frequents)" "WARN" "(P0) Voir B-05 Tache 2.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V5: Retry-After header retourne (P0)
echo "  Verifying T14-V5 : Retry-After header retourne..."
add_row "T14-V5" "Retry-After header retourne" "WARN" "(P0) Voir B-05 Tache 2.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V6: Logs warn emit (P0)
echo "  Verifying T14-V6 : Logs warn emit..."
add_row "T14-V6" "Logs warn emit" "WARN" "(P0) Voir B-05 Tache 2.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T14-V7: Tests E2E rate limit auth (P0)
echo "  Verifying T14-V7 : Tests E2E rate limit auth..."
add_row "T14-V7" "Tests E2E rate limit auth" "WARN" "(P0) Voir B-05 Tache 2.1.14 pour test detaille - critere a auto-tester via script ad-hoc"

```

---

## TACHE 15/6 -- 2.1.15 : Tests E2E Auth Complets (15+ Scenarios)

```bash
echo ""
echo "================================================"
echo "TACHE 2.1.15 : Tests E2E Auth Complets (15+ Scenarios)"
echo "Priorite : P0 | Effort : 8h"
echo "Criteres a verifier : 6"
echo "================================================"

# === Verification fichiers crees ===
# Test T15-F1: Existence fichier repo/e2e/api/auth/{15 .spec.ts}
if [ -f "repo/e2e/api/auth/{15 .spec.ts}" ]; then
  add_row "T15-F1" "Fichier {15 .spec.ts} existe" "PASS" "Cree"
else
  add_row "T15-F1" "Fichier {15 .spec.ts} existe" "FAIL" "Manquant"
fi
# Test T15-F2: Existence fichier repo/e2e/api/auth/fixtures/auth-helpers.ts
if [ -f "repo/e2e/api/auth/fixtures/auth-helpers.ts" ]; then
  add_row "T15-F2" "Fichier auth-helpers.ts existe" "PASS" "Cree"
else
  add_row "T15-F2" "Fichier auth-helpers.ts existe" "FAIL" "Manquant"
fi
# Test T15-F3: Existence fichier repo/e2e/api/auth/fixtures/mailhog-client.ts
if [ -f "repo/e2e/api/auth/fixtures/mailhog-client.ts" ]; then
  add_row "T15-F3" "Fichier mailhog-client.ts existe" "PASS" "Cree"
else
  add_row "T15-F3" "Fichier mailhog-client.ts existe" "FAIL" "Manquant"
fi

# === Verification criteres P0/P1/P2 ===
# Test T15-V1: 15 tests presents (P0)
echo "  Verifying T15-V1 : 15 tests presents..."
add_row "T15-V1" "15 tests presents" "WARN" "(P0) Voir B-05 Tache 2.1.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V2: Tous tests passent localement (P0)
echo "  Verifying T15-V2 : Tous tests passent localement..."
add_row "T15-V2" "Tous tests passent localement" "WARN" "(P0) Voir B-05 Tache 2.1.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V3: Tous tests passent CI (P0)
echo "  Verifying T15-V3 : Tous tests passent CI..."
add_row "T15-V3" "Tous tests passent CI" "WARN" "(P0) Voir B-05 Tache 2.1.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V4: Mailhog integration fonctionne (P0)
echo "  Verifying T15-V4 : Mailhog integration fonctionne..."
add_row "T15-V4" "Mailhog integration fonctionne" "WARN" "(P0) Voir B-05 Tache 2.1.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V5: Coverage : tous endpoints auth testes (P0)
echo "  Verifying T15-V5 : Coverage : tous endpoints auth testes..."
add_row "T15-V5" "Coverage : tous endpoints auth testes" "WARN" "(P0) Voir B-05 Tache 2.1.15 pour test detaille - critere a auto-tester via script ad-hoc"

# Test T15-V6: Reproducibility : run 5 fois consecutif passe (P1)
echo "  Verifying T15-V6 : Reproducibility : run 5 fois consecutif passe..."
add_row "T15-V6" "Reproducibility : run 5 fois consecutif passe" "WARN" "(P1) Voir B-05 Tache 2.1.15 pour test detaille - critere a auto-tester via script ad-hoc"

```

---


---


## VERIFICATIONS TRANSVERSALES SPRINT 5

### TR-BUILD : Build complet du sprint

```bash
echo ""
echo "================================================"
echo "VERIFICATIONS TRANSVERSALES SPRINT 5"
echo "================================================"

cd repo
echo "=== TR-BUILD : Build complet ==="
BUILD_OUT=$(pnpm turbo run build 2>&1)
BUILD_CODE=$?
if [ $BUILD_CODE -eq 0 ]; then
  add_row "TR-BUILD" "Build monorepo passe" "PASS" "Tous packages compiles"
else
  ERRORS=$(echo "$BUILD_OUT" | grep -c "error" || echo 0)
  add_row "TR-BUILD" "Build monorepo passe" "FAIL" "$ERRORS erreurs detectees"
fi
```

### TR-TYPECHECK : TypeScript strict 0 erreur

```bash
echo "=== TR-TYPECHECK : TypeScript strict ==="
TSC_OUT=$(pnpm tsc --noEmit 2>&1)
TSC_CODE=$?
if [ $TSC_CODE -eq 0 ]; then
  add_row "TR-TYPECHECK" "TypeScript compilation propre" "PASS" "0 erreur"
else
  TS_ERRORS=$(echo "$TSC_OUT" | grep -c "error TS")
  add_row "TR-TYPECHECK" "TypeScript compilation propre" "FAIL" "$TS_ERRORS erreurs TS"
fi
```

### TR-TESTS : Tests Vitest unitaires

```bash
echo "=== TR-TESTS : Tests Vitest ==="
VITEST_OUT=$(pnpm vitest run --coverage --reporter=json 2>/dev/null)
TESTS_PASSED=$(echo "$VITEST_OUT" | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
TESTS_TOTAL=$(echo "$VITEST_OUT" | jq '.numTotalTests // 0' 2>/dev/null || echo 0)

if [ "$TESTS_TOTAL" -gt 0 ] && [ "$TESTS_PASSED" -eq "$TESTS_TOTAL" ]; then
  add_row "TR-TESTS" "Tests unitaires PASS" "PASS" "$TESTS_PASSED/$TESTS_TOTAL"
elif [ "$TESTS_TOTAL" -gt 0 ]; then
  add_row "TR-TESTS" "Tests unitaires PASS" "FAIL" "$TESTS_PASSED/$TESTS_TOTAL passes"
else
  add_row "TR-TESTS" "Tests unitaires PASS" "WARN" "Aucun test detecte"
fi
```

### TR-COVERAGE : Couverture >= 85% (P1)

```bash
echo "=== TR-COVERAGE : Couverture tests ==="
COVERAGE=$(echo "$VITEST_OUT" | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "$COVERAGE >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Couverture tests >= 85%" "PASS" "${COVERAGE}%"
elif (( $(echo "$COVERAGE >= 70" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Couverture tests >= 85%" "WARN" "${COVERAGE}% (cible 85%, P1)"
else
  add_row "TR-COVERAGE" "Couverture tests >= 85%" "FAIL" "${COVERAGE}% trop faible"
fi
```

### TR-LINT : Biome lint propre

```bash
echo "=== TR-LINT : Biome lint ==="
LINT_OUT=$(pnpm lint 2>&1)
LINT_CODE=$?
if [ $LINT_CODE -eq 0 ]; then
  add_row "TR-LINT" "Biome lint propre" "PASS" "0 erreur"
else
  LINT_ERRORS=$(echo "$LINT_OUT" | grep -c "error" || echo 0)
  add_row "TR-LINT" "Biome lint propre" "WARN" "$LINT_ERRORS erreurs"
fi
```

### TR-NO-EMOJI : Aucune emoji dans le code (decision-006)

```bash
echo "=== TR-NO-EMOJI : Aucune emoji ==="
EMOJI_COUNT=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/apps repo/packages --include="*.ts" --include="*.tsx" --include="*.md" 2>/dev/null | wc -l)
if [ "$EMOJI_COUNT" -eq 0 ]; then
  add_row "TR-NO-EMOJI" "Aucune emoji code/docs" "PASS" "Conforme decision-006"
else
  add_row "TR-NO-EMOJI" "Aucune emoji code/docs" "FAIL" "$EMOJI_COUNT emojis detectees"
fi
```

### TR-CONSOLE : Aucun console.log (Pino logger obligatoire)

```bash
echo "=== TR-CONSOLE : Aucun console.log ==="
CONSOLE_LOGS=$(grep -rn "console\.log\|console\.error\|console\.warn" repo/apps repo/packages --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v ".spec.ts" | grep -v ".test.ts" | wc -l)
if [ "$CONSOLE_LOGS" -eq 0 ]; then
  add_row "TR-CONSOLE" "Aucun console.* (Pino obligatoire)" "PASS" "0 occurrence"
else
  add_row "TR-CONSOLE" "Aucun console.* (Pino obligatoire)" "FAIL" "$CONSOLE_LOGS occurrences"
fi
```

### TR-COMMITS : Conventional Commits

```bash
echo "=== TR-COMMITS : Conventional commits ==="
NON_CONVENTIONAL=$(git log --since="2 weeks ago" --pretty=format:"%s" -- repo/ | grep -vE "^(feat|fix|docs|style|refactor|test|chore|perf|ci|build)(\(.+\))?:" | wc -l)
if [ "$NON_CONVENTIONAL" -eq 0 ]; then
  add_row "TR-COMMITS" "Conventional Commits respectes" "PASS" "Tous commits conformes"
else
  add_row "TR-COMMITS" "Conventional Commits respectes" "WARN" "$NON_CONVENTIONAL commits non-conformes"
fi
```

### TR-TENANT : Multi-tenant filter present (sauf public/admin)

```bash
echo "=== TR-TENANT : Multi-tenant filter ==="
TENANT_FILES=$(grep -rl "tenant_id\|x-tenant-id\|TenantContext" repo/apps repo/packages --include="*.ts" 2>/dev/null | wc -l)
if [ "$TENANT_FILES" -ge 5 ]; then
  add_row "TR-TENANT" "Multi-tenant filter present" "PASS" "$TENANT_FILES fichiers"
else
  add_row "TR-TENANT" "Multi-tenant filter present" "WARN" "$TENANT_FILES fichiers (verifier coverage)"
fi
```

### TR-ZOD : Validation Zod (pas class-validator)

```bash
echo "=== TR-ZOD : Validation Zod ==="
CLASS_VALIDATOR=$(grep -rn "class-validator\|@IsString\|@IsEmail\|@IsNotEmpty" repo/apps repo/packages --include="*.ts" 2>/dev/null | wc -l)
if [ "$CLASS_VALIDATOR" -eq 0 ]; then
  add_row "TR-ZOD" "Validation Zod (no class-validator)" "PASS" "Conforme"
else
  add_row "TR-ZOD" "Validation Zod (no class-validator)" "FAIL" "$CLASS_VALIDATOR usages class-validator"
fi
```

cd ..

### TR-MIGRATIONS : Migrations DB Sprint 5

```bash
echo "=== TR-MIGRATIONS : Migrations DB ==="
MIGR_COUNT=$(pg_query "SELECT COUNT(*) FROM migrations WHERE name LIKE '%sprint05%' OR name LIKE '%Sprint05%'" || echo 0)
if [ "$MIGR_COUNT" -gt 0 ]; then
  add_row "TR-MIG" "Migrations Sprint 5 appliquees" "PASS" "$MIGR_COUNT migrations"
else
  add_row "TR-MIG" "Migrations Sprint 5 appliquees" "WARN" "Aucune migration detectee (verifier)"
fi
```

### TR-KAFKA : Topics Kafka actifs

```bash
echo "=== TR-KAFKA : Topics Kafka ==="
TOPICS_COUNT=$(docker exec insurtech-kafka kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null | grep "^insurtech\." | wc -l)
if [ "$TOPICS_COUNT" -ge 1 ]; then
  add_row "TR-KAFKA" "Topics insurtech.* configures" "PASS" "$TOPICS_COUNT topics"
else
  add_row "TR-KAFKA" "Topics insurtech.* configures" "WARN" "Aucun topic detecte"
fi
```



---

## GENERATION DU RAPPORT FINAL

```bash
echo ""
echo "================================================"
echo "GENERATION DU RAPPORT FINAL SPRINT 5"
echo "================================================"

TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
if [ "$TOTAL" -eq 0 ]; then
  TOTAL=1  # Avoid division by zero
fi
SCORE=$(echo "scale=2; ($PASS + $PASS_REPAIRED) * 100 / $TOTAL" | bc 2>/dev/null || echo 0)

cat >> "$REPORT_FILE" << EOF

## Tableau de Resultats Complet

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
$(echo -e "$TABLE_ROWS")

## Score Global

| Categorie | Compte | Pourcentage |
|-----------|--------|-------------|
| PASS      | $PASS  | $(echo "scale=1; $PASS * 100 / $TOTAL" | bc)% |
| PASS*     | $PASS_REPAIRED | $(echo "scale=1; $PASS_REPAIRED * 100 / $TOTAL" | bc)% |
| FAIL      | $FAIL  | $(echo "scale=1; $FAIL * 100 / $TOTAL" | bc)% |
| SKIP      | $SKIP  | $(echo "scale=1; $SKIP * 100 / $TOTAL" | bc)% |
| WARN      | $WARN  | $(echo "scale=1; $WARN * 100 / $TOTAL" | bc)% |
| **TOTAL** | $TOTAL | 100% |

**Score Global de Reussite** : $SCORE%

---

## Jalon GO/NO-GO Sprint 5

EOF

# Calcul statut final
if (( $(echo "$SCORE >= 95" | bc -l) )); then
  STATUT="GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO -- Sprint 5 valide, passage Sprint 6 autorise

Le sprint a passe les criteres requis. Cowork peut demarrer Sprint 6.

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 5 : GO ($SCORE%)"
  echo "================================================"
elif (( $(echo "$SCORE >= 85" | bc -l) )); then
  STATUT="GO CONDITIONNEL"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : GO CONDITIONNEL -- Score $SCORE% (cible 95%)

Le sprint passe le minimum mais necessite hot fixes :
- Identifier FAIL critiques (P0)
- Reparation manuelle dans la semaine
- Re-verification avant Sprint suivant

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 5 : GO CONDITIONNEL ($SCORE%)"
  echo "================================================"
else
  STATUT="NO-GO"
  cat >> "$REPORT_FILE" << EOF
**STATUT** : NO-GO -- Score $SCORE% trop bas (cible 85% minimum)

Le sprint **doit etre repris** :
- Lister tous FAIL P0
- Escalation Saad/Abla decision (cut scope OR delai)
- Reprise sprint avant Sprint 6

EOF
  echo ""
  echo "================================================"
  echo "SPRINT 5 : NO-GO ($SCORE%)"
  echo "================================================"
fi

cat >> "$REPORT_FILE" << EOF

---

## Decisions strategiques applicables

Voir `00-pilotage/decisions/`. Decisions critiques pour ce sprint :
- decision-006 : No-emoji policy ABSOLU
- decision-007 : AI-defere strategy (Mock/Real swap)
- decision-008 : Data residency Atlas Cloud Services Benguerir
- decision-002 : Multi-tenant 3 niveaux strict

---

## Prochaine etape

EOF

if [ "$STATUT" = "GO" ] || [ "$STATUT" = "GO CONDITIONNEL" ]; then
  echo "Si GO/GO CONDITIONNEL : commit cloture sprint" >> "$REPORT_FILE"
  echo '```bash' >> "$REPORT_FILE"
  echo "git add $REPORT_FILE" >> "$REPORT_FILE"
  echo "git commit -m \"chore(sprint-05): close sprint 5 -- $STATUT ($SCORE%)\"" >> "$REPORT_FILE"
  echo '```' >> "$REPORT_FILE"
fi

echo ""
echo "Rapport complet dans : $REPORT_FILE"
```

---

## INSTRUCTION FINALE A CLAUDE CODE / COWORK

Apres l'execution complete des verifications ci-dessus :

1. **Lis le contenu de `sprint05-verify-report.md`** integralement
2. **Identifie les FAIL critiques** (criteres P0) qui necessitent intervention manuelle
3. **Affiche un resume executif** :
   - Nombre total de criteres
   - Pourcentage PASS / PASS\* / FAIL / WARN
   - Liste des FAIL avec contexte technique
   - Recommandation : GO / GO CONDITIONNEL / NO-GO
4. **Si NO-GO** : ne pas demarrer le Sprint suivant, alerter Saad/Abla via Slack `#insurtech-dev`
5. **Si GO ou GO CONDITIONNEL** : produire le commit de cloture du sprint :

```bash
git add skalean-insurtech/sprint05-verify-report.md
git commit -m "chore(sprint-05): close sprint 5 with verification report

- Verification automatique executee
- Score global : <SCORE>%
- <PASS> criteres PASS, <PASS_REPAIRED> reparations auto, <FAIL> FAIL
- Statut : <GO|GO CONDITIONNEL|NO-GO>

Phase: 2 -- Securite
Sprint: 5 (Phase 2 / Sprint 1)
Reference B-05, C-05, V-05
Report: sprint05-verify-report.md"
```

6. **Documentation continue** : si decisions techniques prises pendant verification, ajouter notes dans `repo/docs/runbooks/sprint-05-lessons-learned.md`

---

**Fin de la verification V-05 v2.2 detaillee -- Sprint 5 (2.1) Auth Foundations (argon2id + JWT + MFA).**

**Total criteres taches** : 132 | **Total transversaux** : ~10 | **Effort sprint** : 80h
