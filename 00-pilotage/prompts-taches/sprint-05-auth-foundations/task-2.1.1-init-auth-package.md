# TACHE 2.1.1 -- Initialisation Package @insurtech/auth (Types + Schemas Zod + Constants + Module NestJS)

**Sprint** : 5 (Phase 2 / Sprint 1 dans phase) -- Auth Foundations
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-05-sprint-05-auth-foundations.md` (Tache 2.1.1)
**Phase** : 2 -- Securite & Multi-tenant
**Priorite** : P0 (bloquant pour les 14 taches suivantes du Sprint 5 et pour tous les sprints metier 6 a 35 qui consomment un utilisateur authentifie)
**Effort** : 4h
**Dependances** : Sprint 4 (Frontend Bootstrap termine), Sprint 2 (tables `auth_users`, `auth_sessions`, `auth_tenant_users`, `audit_log` provisionnees), Sprint 3 (`PublicEndpointGuard`, `RequestContext`)
**Densite cible** : 80-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Cette tache vise a poser la fondation contractuelle complete du package `@insurtech/auth` qui va heberger l'integralite du systeme d'authentification du programme Skalean InsurTech v2.2 sur les sprints 5 a 35. Le but est de produire un ensemble exhaustif de types TypeScript stricts (`AuthContext`, `AuthenticatedUser`, `JwtPayload`, `RefreshTokenPayload`, `MfaSetupContext`, `LockoutSnapshot`, `AuthEventEnvelope`, `SessionContext`, `LoginAttemptRecord`), un enum verrouille `AuthRole` documentant les 12 roles strictement valides du programme (super_admin_platform, analyst_support, broker_admin, broker_user, broker_assistant, garage_admin, garage_chef, garage_technicien, garage_comptable, garage_commercial, assure, prospect), un jeu complet de schemas Zod runtime (signup, signin, mfa, refresh, recovery, change-password, verify-email) qui sera consomme par les controllers AuthController de la Tache 2.1.6 et par les frontends Next.js 7 apps de Sprint 4, des constantes immuables centralisant la totalite des parametres cryptographiques et de politique mot de passe (`ARGON2_PARAMS`, `JWT_PARAMS`, `MFA_PARAMS`, `PASSWORD_POLICY`, `LOCKOUT_TIERS`, `RATE_LIMIT_TIERS`, `SESSION_TTL_TIERS`), et un squelette `AuthModule` NestJS Global qui sera enrichi progressivement par les taches 2.1.2 a 2.1.15.

L'apport est multiple et critique pour la securite du programme. Premierement, en centralisant tous les types et schemas dans un package unique versionne, on garantit une coherence stricte entre les 9 applications du monorepo (apps/api, apps/web-broker, apps/web-garage, apps/web-garage-mobile, apps/web-insurtech-admin, apps/web-customer-portal, apps/web-assure-portal, apps/web-assure-mobile, apps/mcp-server) qui consomment toutes le contrat d'authentification : un changement de structure JwtPayload est detecte au build par TypeScript dans toutes les apps, evitant le drift contractuel qui caracterise les architectures distribuees. Deuxiemement, en exportant les schemas Zod au lieu de class-validator decorators, on respecte la convention transverse Skalean InsurTech (decision-007 et prompt master section 3.1) qui impose Zod comme unique source de validation runtime, ce qui permet a la fois la generation automatique de l'OpenAPI 3.1 specification (Sprint 33) via `zod-to-openapi` et l'inference TypeScript pure via `z.infer<typeof Schema>` (vs duplication interface + decorators qui peut deriver). Troisiemement, en figeant les parametres cryptographiques dans des constants immuables typees `as const`, on cree un point d'audit unique : tout changement futur des parametres Argon2id ou JWT TTL est tracable via un seul commit Git modifiant ces fichiers, et la revue de securite Sprint 33 (pentest) peut auditer la totalite des choix crypto en lisant 4 fichiers de moins de 100 lignes chacun. Quatriemement, l'enum AuthRole strict (vs string union types) permet le pattern matching exhaustif TypeScript (`switch (role) { case AuthRole.SuperAdminPlatform: ... }`) qui detecte au compile time tout role oublie dans une logique d'autorisation, propriete cruciale en securite ou un cas non gere = bypass d'autorisation potentiel.

A l'issue de cette tache, le package `repo/packages/auth/` est buildable (`pnpm --filter @insurtech/auth build` retourne exit 0), tous ses exports publics sont accessibles via `import { AuthRole, JwtPayload, signupSchema, ARGON2_PARAMS } from '@insurtech/auth'` depuis n'importe quelle autre app ou package du monorepo, le squelette `AuthModule` NestJS Global est decore mais ne contient encore aucun service (les 14 taches suivantes l'enrichiront progressivement avec Argon2Service, EncryptionService, HashingService, JwtService, SessionService, AuthController, MfaService, etc.), et la suite de tests Vitest sur les schemas Zod et l'enum AuthRole couvre 100% des branches avec au moins 35 cas de tests concrets passants. Aucun service operationnel n'est implemente dans cette tache : sa portee est strictement contractuelle et fondationnelle, mais elle est bloquante absolue pour toutes les taches qui suivent dans le Sprint 5 et au dela.

---

## 2. Contexte etendu

### 2.1 Pourquoi cette tache existe

Le programme Skalean InsurTech v2.2 est un systeme multi-tenant strict B2B/B2C (cabinets de courtage, garages de reparation, assures finaux, prospects publics) qui repose entierement sur la qualite de son modele d'authentification. Une faiblesse dans ce modele se traduit immediatement par : compromission de tenants entiers (un broker_admin malveillant qui acceede aux contacts d'un autre cabinet), violation de la loi 09-08 CNDP Maroc (notification breach 72h obligatoire si donnees personnelles assures fuitees), perte de la certification ACAPS pour le compte de la compagnie d'assurance partenaire, perte de confiance des courtiers qui basculent vers la concurrence (AssurMaroc, ClickAssure, AssureUp). Avant d'ecrire un seul service operationnel d'authentification (Argon2Service en 2.1.2, JwtService en 2.1.4, MfaService en 2.1.7), il est imperatif de figer le contrat de donnees, le vocabulaire des roles, et les parametres cryptographiques.

Cette discipline n'est pas une formalite. L'industrie a vu dans les 10 dernieres annees plusieurs incidents majeurs lies a l'absence de centralisation contractuelle : un service A signe des JWT avec un payload `{ user_id, role }` puis un service B est ajoute au programme et accepte les JWT avec un payload `{ sub, role }` -- un attaquant decouvre que le service B accepte un JWT signe par le service A car les deux utilisent la meme cle de signature, et ainsi escalade ses droits. En centralisant `JwtPayload` dans `@insurtech/auth` et en imposant que tout service qui signe ou verifie un JWT importe ce type unique, on ferme cette classe de bugs au compile-time.

De plus, le programme prevoit explicitement une evolution des roles dans les sprints futurs : Sprint 7 introduit le RBAC granulaire avec permissions, Sprint 23 introduit WebAuthn/Passkey biometrique pour `garage_technicien` (pour authentification mobile en atelier sans clavier), Sprint 25 introduit le cross-tenant pour `super_admin_platform` qui peut impersonate un tenant pour support N2, Sprint 31 introduit l'agent Sky qui consomme des tokens services-to-services. Toutes ces evolutions doivent passer par modification d'un seul fichier `auth-roles.ts` ou `auth-context.ts` avec impact compile-time sur toutes les apps consommatrices.

Enfin, cette tache prepare l'integration avec la couche conformite Maroc du programme. La loi 09-08 CNDP impose au minimum : protection des donnees personnelles par hash robuste (pas MD5/SHA-1, pas bcrypt depasse), interdiction de stocker mots de passe en clair (meme dans logs), traçabilite des operations sur donnees personnelles (audit log Sprint 5 Tache 2.1.12), notification breach 72h en cas de compromission. La constante `ARGON2_PARAMS` figee a `memoryCost: 65536, timeCost: 3, parallelism: 4` est la materialisation de l'OWASP Password Storage Cheat Sheet 2024 qui est l'etat de l'art reconnu et acceptable par les autorites de controle.

### 2.2 Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| Distribuer les types auth dans chaque app (pas de package partage) | Aucune dependance cross-app, plus de simplicite initiale, chaque app evolue independamment | Drift inevitable entre apps (JwtPayload diverge), refactoring coupe-feu impossible (changer un nom de champ = modifier 9 apps), validation runtime dupliquee, impossible de generer une OpenAPI unifiee | REJETE -- propriete inacceptable pour un systeme multi-app multi-tenant securite-critique |
| Mettre les types auth dans `@insurtech/shared-types` (avec Locale, Money, etc.) | Reuse maximal d'un seul package shared, install unique | Mix de concerns (auth vs i18n vs business primitives), tests couples, evolution auth bloque deploiement Locale, package shared-types devient un dieu-package | REJETE -- viole separation of concerns, oblige a tout rebuild a chaque changement auth |
| Package `@insurtech/auth` avec class-validator + class-transformer (NestJS officiel) | Bien documente NestJS, ecosysteme riche, decorateurs lisibles | Doublon avec interface TypeScript (decorateurs DTO + interface DTO), performance runtime decorators, incompatible Zod-to-OpenAPI utilise dans le programme, viole convention Skalean InsurTech (decision-007 force Zod uniquement) | REJETE -- viole une convention transverse explicite |
| Package `@insurtech/auth` avec yup ou joi | Mature, populaires, schemas runtime | Pas d'inference TypeScript native (yup), API moins ergonomique, ecosysteme moins integre Next.js + NestJS, aucune adoption interne Skalean | REJETE -- inferiorite technique vs Zod sur tous les axes |
| Package `@insurtech/auth` avec Zod 3.23+ pour schemas runtime + interfaces TypeScript pures (RETENU) | Inference TypeScript native via `z.infer<>`, integration zod-to-openapi pour Sprint 33, ergonomique, performant, ecosysteme integre, alignement convention transverse decision-007 | Necessite une discipline (pas reutiliser interface declaree separement, toujours `z.infer<typeof Schema>` pour single source of truth) | RETENU -- meilleur compromis sur performance, ergonomie, alignement conventions, integration |

### 2.3 Trade-offs explicites

Choisir un enum TypeScript strict pour `AuthRole` (vs string union type ou tableau de strings constants) implique d'accepter un compromis : l'enum cree un objet runtime (pas seulement un type), ce qui ajoute environ 200 bytes au bundle production des apps frontend. Cette penalite est largement compensee par les gains a l'usage : autocompletion IDE, pattern matching exhaustive avec `switch`, refactoring securise (renommer une valeur enum et le compilateur signale toutes les utilisations), et impossibilite de creer accidentellement un role inexistant via une faute de frappe (un string `"admin_broker"` au lieu de `"broker_admin"` n'est pas detecte ; `AuthRole.AdminBroker` est detecte par TypeScript). Pour un domaine securite critique, le cout de 200 bytes est insignifiant face au benefice du compile-time check.

Choisir Zod 3.23+ comme bibliotheque exclusive de validation runtime implique d'accepter d'apprendre son API specifique (`z.object({...}).strict()`, `z.literal()`, `z.union()`, `z.discriminatedUnion()`, `z.infer<typeof X>`) qui differe de class-validator. Pour un developpeur senior, cette courbe d'apprentissage est de l'ordre de 2-4 heures sur la documentation. En contrepartie, on obtient l'inference TypeScript native qui elimine completement la duplication interface + DTO + validation, ainsi qu'une API composable qui permet par exemple d'appliquer des transformations chainees (`.refine()`, `.transform()`, `.preprocess()`) impossibles avec class-validator sans gymnastique.

Choisir d'integrer le module `AuthModule` en mode `Global` NestJS (decorateur `@Global()`) implique d'accepter que tous les services exportes (Argon2Service, JwtService, MfaService, etc.) seront automatiquement injectables dans n'importe quel module sans avoir a re-importer AuthModule explicitement. Cette commodite a un cout : couplage implicite entre modules, et perte de la possibilite de mocker AuthModule pour des tests d'integration de modules metier sans auth (rarement necessaire en pratique). Pour un systeme ou l'authentification est pervasive (chaque endpoint sauf `/public/*` la consomme), le pattern Global est adapte.

Choisir des constantes immuables `as const` (vs configuration dynamique via env variables) pour `ARGON2_PARAMS`, `JWT_PARAMS`, etc. implique d'accepter qu'un changement de parametre crypto necessite un commit Git et un deploiement complet (vs un toggle dans une console d'administration). Cette friction est intentionnelle : les parametres cryptographiques ne doivent JAMAIS etre modifiables a chaud (un attaquant qui compromet un super_admin pourrait reduire le memoryCost a 8192 et casser la securite). Les seules valeurs configurables a l'env sont les SECRETS (cles JWT, cles AES) qui ne fuitent pas dans le code source.

### 2.4 Decisions strategiques referenced

- **decision-001 (Monorepo pnpm + Turborepo)** : pertinence totale. Le package `@insurtech/auth` est un workspace pnpm declare dans `pnpm-workspace.yaml` (Sprint 1). Son `package.json` declare `"name": "@insurtech/auth"` et il est importable via `import { ... } from '@insurtech/auth'` depuis tout autre workspace.
- **decision-002 (TypeScript Strict)** : pertinence totale. Tous les fichiers crees par cette tache utilisent `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitAny: true`, et tous les types exportes sont explicites (pas de `any`).
- **decision-005 (Skalean AI Frontier Strict)** : pertinence indirecte. Le futur agent Sky (Sprint 31) consommera des JWT services-to-services dont la structure sera definie ici via `JwtPayload` etendu avec un champ `service: 'sky' | undefined` au Sprint 31. La structure actuelle prevoit cette extension par le champ optionnel `service` dans le payload.
- **decision-006 (No-emoji Policy ABSOLUE)** : pertinence totale. Aucun emoji n'apparait dans aucun fichier livre. Le critere V25 verifie automatiquement l'absence d'emoji.
- **decision-007 (Zod Runtime Validation)** : pertinence totale. Cette tache materialise la decision-007 en livrant les premiers schemas Zod du programme dans un package partage.
- **decision-008 (Data Residency Maroc)** : pertinence indirecte. Les types `JwtPayload` incluent `tenant_id` qui sera resolu par `TenantContext` (Sprint 6) et lie a une instance Atlas Cloud Services Benguerir.
- **decision-013 (Argon2id over bcrypt)** : pertinence totale. La constante `ARGON2_PARAMS` materialise cette decision avec les parametres OWASP 2024.
- **decision-014 (JWT HS256 Sprint 5, RS256 plus tard)** : pertinence totale. La constante `JWT_PARAMS.algorithm = 'HS256'` est explicite et accompagnee d'un commentaire pointant vers la migration RS256 prevue Sprint 14 (rotation cles).

### 2.5 Pieges techniques connus

1. **Piege : Enum TypeScript const enum vs regular enum.**
   - Pourquoi : `const enum AuthRole { ... }` est inline a la compilation et peut creer des incoherences si compile et runtime utilisent des inlinings differents (notamment cross-package). Un consommateur compile contre la valeur `AuthRole.BrokerAdmin = 'broker_admin'` mais a runtime, le package `@insurtech/auth` exporte `AuthRole.BrokerAdmin = 'admin_broker'` (apres refactoring) -- les deux ne se rencontrent jamais et le bug passe inapercu.
   - Solution : utiliser un regular `enum` (sans `const`) qui cree un vrai objet runtime, et l'exporter explicitement. Les consommateurs lisent toujours la valeur courante du package, jamais une copie inlinee.

2. **Piege : Schemas Zod sans `.strict()` acceptent des champs supplementaires (mass assignment).**
   - Pourquoi : par defaut, `z.object({ email, password }).parse({ email, password, role: 'super_admin_platform' })` ne rejette pas le champ `role` -- il est juste ignore. Mais si un consommateur fait du destructuring naif `const data = parse(input); user.role = data.role;`, il accepte le mass assignment.
   - Solution : tous les schemas Zod de cette tache utilisent `.strict()` qui rejette les champs non declares avec une erreur ZodError explicite. Ce comportement est verifie par les tests V12 et V13.

3. **Piege : `z.infer<typeof Schema>` perd les transformations apres `.transform()`.**
   - Pourquoi : si un schema fait `z.string().transform(s => s.toLowerCase())`, alors `z.infer<>` retourne `string` (pas le type apres transformation, car identique). Mais si la transformation change le type (`.transform(s => Number(s))`), il faut utiliser `z.output<>` au lieu de `z.infer<>`.
   - Solution : convention -- chaque schema avec transformation expose deux types : `XxxInput = z.input<typeof XxxSchema>` et `XxxOutput = z.output<typeof XxxSchema>`. Les schemas sans transformation utilisent `z.infer<>` simplement.

4. **Piege : Constants immutables `as const` sont readonly mais pas immuables a runtime.**
   - Pourquoi : `const X = { a: 1 } as const;` rend `X.a` readonly au compile time mais n'empeche pas `X.a = 2` a runtime via Object.assign ou Reflect.set (si TypeScript est compile en JS).
   - Solution : pour les constantes vraiment critiques (ARGON2_PARAMS), utiliser `Object.freeze({ memoryCost: 65536, ... })` qui empeche aussi la modification runtime, et exposer le type via `as const` cumule avec `Object.freeze`.

5. **Piege : Dependances circulaires entre `@insurtech/auth` et `@insurtech/database`.**
   - Pourquoi : la tentation est forte de declarer `import { AuthUser } from '@insurtech/database'` dans `auth-context.ts`. Mais Sprint 6 importera `JwtPayload` de `@insurtech/auth` dans `@insurtech/database` (RLS policy use tenant_id du JWT). Cycle.
   - Solution : declarer dans `@insurtech/auth` uniquement des types contractuels (`AuthenticatedUser` minimal : `{ id, email, role }`). Les details d'entite DB restent dans `@insurtech/database`. La conversion DB row -> AuthenticatedUser se fait dans AuthService au Sprint 5 Tache 2.1.6.

6. **Piege : `@Global()` decorator NestJS oublie sur AuthModule.**
   - Pourquoi : sans `@Global()`, chaque module qui veut injecter `JwtService` doit faire `imports: [AuthModule]`. Apres 30 modules, c'est lourd et oublis. Mais si on oublie `@Global()` et qu'un developpeur ajoute `imports: [AuthModule]` dans 30 modules, cela cree un graphe de dependances complexe.
   - Solution : decorer `AuthModule` avec `@Global()` des cette tache, et verifier dans le test V21 que le decorator est present.

7. **Piege : Re-exports `index.ts` qui re-exportent des symboles internes non destines aux consommateurs.**
   - Pourquoi : `export * from './services/argon2.service'` re-exporte aussi des helpers internes comme `splitArgon2Hash` qui devraient rester prives.
   - Solution : adopter le pattern "barrel file selectif" : `export { Argon2Service } from './services/argon2.service'`. Aucun `export *` dans `src/index.ts`. Le critere V18 verifie cela.

8. **Piege : `package.json` `exports` field manquant ou mal configure.**
   - Pourquoi : Node.js 22+ et Next.js 15 honorent le champ `exports` du package.json. Si manquant ou mal configure, les imports `@insurtech/auth/internal/...` peuvent contourner l'API publique.
   - Solution : declarer un seul export `"."` qui pointe vers `src/index.ts` (en dev) et `dist/index.js` + `dist/index.d.ts` (en prod). Les sous-chemins ne sont pas exposes.

9. **Piege : `AuthRole` enum value collisions avec autre code.**
   - Pourquoi : si une migration future renomme `'broker_admin'` en `'admin_broker'` mais oublie un `'broker_admin'` hardcode dans un test, le test passe par accident car `AuthRole.BrokerAdmin === 'admin_broker'` mais la chaine "broker_admin" reste comparee a une autre chaine quelque part.
   - Solution : convention stricte -- aucun string role hardcode dans le code source du programme. Toutes les comparaisons utilisent `AuthRole.XxxYyy`. Le critere V22 fait un grep automatique sur les chaines `'broker_admin'`, `'garage_admin'`, etc. dans le code et echoue si presentes hors `auth-roles.ts`.

10. **Piege : Schemas Zod avec `.email()` permettent caracteres unicode visuels confondants (homograph attack).**
   - Pourquoi : `z.string().email()` accepte `eve@gооgle.com` (avec deux `о` cyrilliques au lieu de `o` latins). Un attaquant peut creer un compte avec une adresse visuellement identique a une victime.
   - Solution : ajouter une etape de validation supplementaire `.refine(s => /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s))` qui restreint au sous-ensemble ASCII RFC 5321 simplifie. Documente dans la constante `EMAIL_REGEX`.

11. **Piege : `JwtPayload.exp` traite comme millisecondes au lieu de secondes (standard JWT).**
   - Pourquoi : `Date.now()` retourne des millisecondes, mais la spec JWT (RFC 7519) impose `exp` en secondes Unix epoch. Une confusion ms/s donne un token expire instantanement (passe en ms) ou jamais expire (passe en s mais compare a Date.now()).
   - Solution : helper exporte `nowInSeconds()` et `expirySeconds(ttlSeconds)` qui retournent toujours en secondes. Documente dans la constante JWT_PARAMS.

12. **Piege : `AuthRole.SuperAdminPlatform` lu comme un role tenant ordinaire.**
   - Pourquoi : `super_admin_platform` est un role Platform (Niveau 1) qui bypass le RLS (Sprint 6). Mais une logique naive `if (user.role !== AuthRole.Assure) { allow(...) }` autorise super_admin_platform a tout, ce qui est correct, MAIS une logique `if (user.tenant_id !== currentTenant) { deny(...) }` bloque super_admin_platform car son `tenant_id` est `null`.
   - Solution : helper exporte `isPlatformRole(role: AuthRole): boolean` retournant `true` pour super_admin_platform et analyst_support, qui doit etre utilise systematiquement avant tout check tenant_id. Documente dans `auth-roles.ts`.

---

## 3. Architecture context

### 3.1 Position dans le sprint

Cette tache 2.1.1 est la premiere tache du Sprint 5 et la fondation absolue des 14 taches suivantes. Sans elle, aucun service operationnel ne peut etre code car :
- Tache 2.1.2 (Argon2Service) importe `PASSWORD_POLICY` et `ARGON2_PARAMS` definis ici.
- Tache 2.1.3 (EncryptionService, HashingService) importe les types `EncryptedSecret` et `HashDigest` definis ici.
- Tache 2.1.4 (JwtService) importe `JwtPayload`, `RefreshTokenPayload`, `JWT_PARAMS` definis ici.
- Tache 2.1.5 (SessionService) importe `SessionContext`, `SESSION_TTL_TIERS` definis ici.
- Tache 2.1.6 (AuthController, AuthService, JwtStrategy) importe la totalite des schemas Zod et types.
- Tache 2.1.7 (MfaService) importe `MFA_PARAMS`, `MfaSetupContext`, `mfaSchema`.
- Tache 2.1.8 (MfaRequiredGuard) importe `JwtPayload.mfa_verified` flag.
- Tache 2.1.9 (Signup flow) importe `signupSchema`, `verifyEmailSchema`.
- Tache 2.1.10 (LockoutService) importe `LOCKOUT_TIERS`, `LockoutSnapshot`.
- Tache 2.1.11 (Recovery) importe `recoverySchema`.
- Tache 2.1.12 (AuditService) importe `AuthEventEnvelope`, `AuthEventKind`.
- Tache 2.1.13 (EmailService) importe `EmailLocale`.
- Tache 2.1.14 (RateLimit) importe `RATE_LIMIT_TIERS`.
- Tache 2.1.15 (E2E tests) importe la totalite pour verifier les contracts.

Toutes les autres taches du Sprint 5 depend transitivement de 2.1.1.

### 3.2 Position dans le programme global

Le package `@insurtech/auth` initialise par cette tache sera enrichi sur les 35 sprints :
- Sprint 6 ajoutera le `TenantContextService` qui consomme `JwtPayload.tenant_id`.
- Sprint 7 ajoutera le RBAC granulaire avec `Permission` enum + `RbacService`.
- Sprint 14 introduira la rotation des cles JWT (HS256 -> RS256) en migrant `JWT_PARAMS.algorithm`.
- Sprint 23 introduira `WebAuthnService` pour `garage_technicien` biometric login.
- Sprint 25 introduira `ImpersonateService` pour `super_admin_platform` cross-tenant support.
- Sprint 26 introduira l'audit complet des operations cross-tenant.
- Sprint 31 introduira le `ServiceTokenService` pour l'agent Sky (services-to-services JWT).
- Sprint 33 generera la specification OpenAPI 3.1 a partir des schemas Zod definis ici.
- Sprint 35 deploiera le cluster d'Atlas Cloud Services Benguerir avec les cles JWT en HSM.

Tous les ajouts ulterieurs etendent les types et constantes definis dans cette tache, ils ne les redefinent jamais.

### 3.3 Diagramme d'integration

```
                              +-----------------------------------+
                              |   Sprint 4 termine (frontends)    |
                              |   Sprint 2 termine (DB tables)    |
                              |   Sprint 3 termine (PublicGuard)  |
                              +-----------------+-----------------+
                                                |
                                                v
                              +-----------------------------------+
                              |   TACHE 2.1.1 (cette tache)        |
                              |   @insurtech/auth contrats         |
                              |   - types/                         |
                              |   - schemas/                       |
                              |   - constants/                     |
                              |   - auth.module.ts (skeleton)      |
                              +--+-----+-----+-----+-----+-----+--+
                                 |     |     |     |     |     |
        2.1.2 Argon2Service <----+     |     |     |     |     |
        2.1.3 Crypto services <--------+     |     |     |     |
        2.1.4 JwtService <------------------+     |     |     |
        2.1.5 SessionService <-------------------+     |     |
        2.1.6 AuthModule operationnel <----------------+     |
        2.1.7 MfaService <-----------------------------------+
        ...                                                  |
        2.1.15 E2E tests <-----------------------------------+

                                                |
                                                v
                              +-----------------------------------+
                              |   Sprint 6+ : TenantGuard utilise  |
                              |   JwtPayload.tenant_id de cette   |
                              |   tache                           |
                              +-----------------------------------+
```

---

## 4. Livrables checkables (24 livrables)

- [ ] Package `repo/packages/auth/package.json` enrichi : nom `@insurtech/auth`, version `0.1.0`, scripts `build`, `dev`, `test`, `lint`, `typecheck`, exports field configure, deps `zod 3.23.8`, `@nestjs/common 10.4.7`, `@nestjs/core 10.4.7` (les autres deps de Tache 2.1.2-2.1.15 ne sont pas encore installees) -- environ 60 lignes
- [ ] `repo/packages/auth/tsconfig.json` etendu de `tsconfig.base.json` du monorepo, avec rootDir `src`, outDir `dist`, declaration true, declarationMap true, sourceMap true, resolveJsonModule true (pour banlist 2.1.2) -- environ 30 lignes
- [ ] `repo/packages/auth/src/types/auth-context.ts` : interfaces `AuthenticatedUser`, `AuthContext`, `AuthSubject`, `AuthSubjectKind` -- environ 90 lignes
- [ ] `repo/packages/auth/src/types/jwt-payload.ts` : interfaces `JwtPayload`, `RefreshTokenPayload`, `ServiceJwtPayload` (Sprint 31), helpers `nowInSeconds`, `expirySeconds` -- environ 120 lignes
- [ ] `repo/packages/auth/src/types/auth-roles.ts` : enum `AuthRole` avec 12 valeurs documentees + helpers `isPlatformRole`, `isTenantRole`, `isAssureRole`, `isProspectRole`, `isBrokerRole`, `isGarageRole`, `getRoleHierarchy` -- environ 200 lignes
- [ ] `repo/packages/auth/src/types/auth-events.ts` : enum `AuthEventKind` (signup_started, signup_completed, signin_success, signin_failed, signin_locked, mfa_setup_started, mfa_setup_completed, mfa_verify_success, mfa_verify_failed, refresh_used, refresh_replay_detected, signout, recovery_started, recovery_completed, password_changed, email_verified, lockout_triggered, lockout_cleared) + interface `AuthEventEnvelope` -- environ 130 lignes
- [ ] `repo/packages/auth/src/types/session-context.ts` : interface `SessionContext` avec session_id, user_id, tenant_id, ip, user_agent, created_at, last_seen_at, mfa_verified, refresh_token_family -- environ 80 lignes
- [ ] `repo/packages/auth/src/types/lockout.ts` : interface `LockoutSnapshot`, type `LockoutTier` (1..4), helper `getLockoutDurationMs` -- environ 70 lignes
- [ ] `repo/packages/auth/src/types/index.ts` : barrel selectif des types -- environ 25 lignes
- [ ] `repo/packages/auth/src/schemas/signup.schema.ts` : `signupSchema` (email, password, display_name, locale 'fr-MA'|'ar-MA'|'en'|'fr-FR', accepted_tos boolean) + type `SignupInput` -- environ 90 lignes
- [ ] `repo/packages/auth/src/schemas/signin.schema.ts` : `signinSchema` (email, password, remember_me boolean optional, mfa_code optional) + type `SigninInput` -- environ 70 lignes
- [ ] `repo/packages/auth/src/schemas/mfa.schema.ts` : `mfaSetupSchema`, `mfaVerifySchema` (totp_code 6 digits, recovery_code optional alphanumeric 10 chars), `mfaDisableSchema` -- environ 100 lignes
- [ ] `repo/packages/auth/src/schemas/refresh.schema.ts` : `refreshSchema` (refresh_token base64url) -- environ 40 lignes
- [ ] `repo/packages/auth/src/schemas/recovery.schema.ts` : `recoveryRequestSchema` (email), `recoveryConfirmSchema` (recovery_token, new_password) -- environ 80 lignes
- [ ] `repo/packages/auth/src/schemas/change-password.schema.ts` : `changePasswordSchema` (current_password, new_password) -- environ 50 lignes
- [ ] `repo/packages/auth/src/schemas/verify-email.schema.ts` : `verifyEmailSchema` (verification_token) -- environ 35 lignes
- [ ] `repo/packages/auth/src/schemas/index.ts` : barrel selectif des schemas -- environ 25 lignes
- [ ] `repo/packages/auth/src/constants/argon2-params.ts` : `ARGON2_PARAMS` immuable (Object.freeze), `PASSWORD_POLICY` (min_length 12, regex pattern, banlist note) -- environ 70 lignes
- [ ] `repo/packages/auth/src/constants/jwt-params.ts` : `JWT_PARAMS` immuable (algorithm 'HS256', issuer, audience, ttl_access_seconds 900, ttl_refresh_seconds 2592000, leeway_seconds 5) + helpers -- environ 60 lignes
- [ ] `repo/packages/auth/src/constants/mfa-params.ts` : `MFA_PARAMS` (digits 6, period 30, algorithm SHA-1, issuer 'Skalean InsurTech', recovery_codes_count 6, recovery_code_length 10) -- environ 50 lignes
- [ ] `repo/packages/auth/src/constants/lockout-tiers.ts` : `LOCKOUT_TIERS` (tier 1: 5 min, tier 2: 15 min, tier 3: 60 min, tier 4: permanent), `MAX_FAILED_ATTEMPTS_BEFORE_TIER_UP 5`, `RESET_FAILED_COUNT_AFTER_MS` -- environ 60 lignes
- [ ] `repo/packages/auth/src/constants/rate-limit-tiers.ts` : `RATE_LIMIT_TIERS` (login: 5/min/IP+email, signup: 3/h/IP, recovery: 3/h/email, refresh: 30/min/user) -- environ 50 lignes
- [ ] `repo/packages/auth/src/constants/session-ttl-tiers.ts` : `SESSION_TTL_TIERS` (default: 8h, remember_me: 30d, mfa_pending: 5min) -- environ 40 lignes
- [ ] `repo/packages/auth/src/constants/email-regex.ts` : `EMAIL_REGEX` ASCII RFC 5321 simplifie (anti-homograph) -- environ 30 lignes
- [ ] `repo/packages/auth/src/constants/index.ts` : barrel selectif des constants -- environ 25 lignes
- [ ] `repo/packages/auth/src/auth.module.ts` : skeleton `@Global() @Module({...})` avec imports/providers vides + commentaire pointing vers Tache 2.1.6 pour enrichissement -- environ 40 lignes
- [ ] `repo/packages/auth/src/index.ts` : barrel selectif racine reexportant types, schemas, constants, auth.module -- environ 50 lignes
- [ ] `repo/packages/auth/test/types/auth-roles.spec.ts` : 12 tests (1 par role + helpers isPlatformRole, isTenantRole, etc.) -- environ 200 lignes
- [ ] `repo/packages/auth/test/schemas/signup.schema.spec.ts` : 8 tests (happy + 7 error paths) -- environ 150 lignes
- [ ] `repo/packages/auth/test/schemas/signin.schema.spec.ts` : 6 tests -- environ 110 lignes
- [ ] `repo/packages/auth/test/schemas/mfa.schema.spec.ts` : 8 tests -- environ 150 lignes
- [ ] `repo/packages/auth/test/schemas/refresh.schema.spec.ts` : 4 tests -- environ 70 lignes
- [ ] `repo/packages/auth/test/schemas/recovery.schema.spec.ts` : 6 tests -- environ 110 lignes
- [ ] `repo/packages/auth/test/constants/argon2-params.spec.ts` : 4 tests (immutability, OWASP minimums) -- environ 80 lignes
- [ ] `repo/packages/auth/test/constants/jwt-params.spec.ts` : 5 tests -- environ 90 lignes
- [ ] `repo/packages/auth/test/constants/lockout-tiers.spec.ts` : 5 tests -- environ 100 lignes
- [ ] `repo/packages/auth/test/integration/module.spec.ts` : 3 smoke tests (module compile, decorator @Global present, exports declares) -- environ 80 lignes

---

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/packages/auth/package.json                                         (~60 lignes  / metadata + deps + scripts)
repo/packages/auth/tsconfig.json                                        (~30 lignes  / extends base)
repo/packages/auth/src/types/auth-context.ts                            (~90 lignes  / AuthenticatedUser, AuthContext, AuthSubject)
repo/packages/auth/src/types/jwt-payload.ts                             (~120 lignes / JwtPayload, RefreshTokenPayload, helpers)
repo/packages/auth/src/types/auth-roles.ts                              (~200 lignes / enum AuthRole + 7 helpers + role hierarchy)
repo/packages/auth/src/types/auth-events.ts                             (~130 lignes / enum AuthEventKind + AuthEventEnvelope)
repo/packages/auth/src/types/session-context.ts                         (~80 lignes  / SessionContext interface)
repo/packages/auth/src/types/lockout.ts                                 (~70 lignes  / LockoutSnapshot + LockoutTier)
repo/packages/auth/src/types/index.ts                                   (~25 lignes  / barrel)
repo/packages/auth/src/schemas/signup.schema.ts                         (~90 lignes  / signupSchema)
repo/packages/auth/src/schemas/signin.schema.ts                         (~70 lignes  / signinSchema)
repo/packages/auth/src/schemas/mfa.schema.ts                            (~100 lignes / mfaSetup, mfaVerify, mfaDisable)
repo/packages/auth/src/schemas/refresh.schema.ts                        (~40 lignes  / refreshSchema)
repo/packages/auth/src/schemas/recovery.schema.ts                       (~80 lignes  / recoveryRequest + recoveryConfirm)
repo/packages/auth/src/schemas/change-password.schema.ts                (~50 lignes  / changePasswordSchema)
repo/packages/auth/src/schemas/verify-email.schema.ts                   (~35 lignes  / verifyEmailSchema)
repo/packages/auth/src/schemas/index.ts                                 (~25 lignes  / barrel)
repo/packages/auth/src/constants/argon2-params.ts                       (~70 lignes  / ARGON2_PARAMS + PASSWORD_POLICY)
repo/packages/auth/src/constants/jwt-params.ts                          (~60 lignes  / JWT_PARAMS + helpers)
repo/packages/auth/src/constants/mfa-params.ts                          (~50 lignes  / MFA_PARAMS)
repo/packages/auth/src/constants/lockout-tiers.ts                       (~60 lignes  / LOCKOUT_TIERS + helper)
repo/packages/auth/src/constants/rate-limit-tiers.ts                    (~50 lignes  / RATE_LIMIT_TIERS)
repo/packages/auth/src/constants/session-ttl-tiers.ts                   (~40 lignes  / SESSION_TTL_TIERS)
repo/packages/auth/src/constants/email-regex.ts                         (~30 lignes  / EMAIL_REGEX RFC 5321)
repo/packages/auth/src/constants/index.ts                               (~25 lignes  / barrel)
repo/packages/auth/src/auth.module.ts                                   (~40 lignes  / skeleton @Global)
repo/packages/auth/src/index.ts                                         (~50 lignes  / barrel root)
repo/packages/auth/test/types/auth-roles.spec.ts                        (~200 lignes / 12 tests + helpers)
repo/packages/auth/test/schemas/signup.schema.spec.ts                   (~150 lignes / 8 tests)
repo/packages/auth/test/schemas/signin.schema.spec.ts                   (~110 lignes / 6 tests)
repo/packages/auth/test/schemas/mfa.schema.spec.ts                      (~150 lignes / 8 tests)
repo/packages/auth/test/schemas/refresh.schema.spec.ts                  (~70 lignes  / 4 tests)
repo/packages/auth/test/schemas/recovery.schema.spec.ts                 (~110 lignes / 6 tests)
repo/packages/auth/test/constants/argon2-params.spec.ts                 (~80 lignes  / 4 tests)
repo/packages/auth/test/constants/jwt-params.spec.ts                    (~90 lignes  / 5 tests)
repo/packages/auth/test/constants/lockout-tiers.spec.ts                 (~100 lignes / 5 tests)
repo/packages/auth/test/integration/module.spec.ts                      (~80 lignes  / smoke)
```

Total : 37 fichiers, environ 2900 lignes effectives.

---

## 6. Code patterns COMPLETS

### 6.1 Fichier 1 / 14 : `repo/packages/auth/package.json`

Le `package.json` declare le contrat de publication interne du package : nom unique dans le monorepo, version semver suivie sur les sprints, scripts uniformes (consommes par Turborepo), exports field strict (publication ESM + CJS dual), engines minimaux. Aucune dependance Argon2, JWT, otplib n'est ajoutee a cette etape : seulement zod, @nestjs/common, @nestjs/core qui suffisent pour declarer types, schemas, constants et le module skeleton. Les 11 taches suivantes du Sprint 5 ajouteront leurs deps respectivement (`pnpm --filter @insurtech/auth add @node-rs/argon2` en 2.1.2, etc.).

```json
{
  "name": "@insurtech/auth",
  "version": "0.1.0",
  "description": "Skalean InsurTech v2.2 -- Auth contracts (types, Zod schemas, constants, NestJS module). Initialized in Sprint 5 Tache 2.1.1. Enriched progressively by Tache 2.1.2-2.1.15. Imported by all 9 apps and the api/mcp-server runtime.",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "files": [
    "dist",
    "README.md",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "build:watch": "tsc -p tsconfig.json --watch",
    "clean": "rm -rf dist .turbo",
    "dev": "tsc -p tsconfig.json --watch",
    "lint": "biome check src test --write",
    "lint:check": "biome check src test",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit -p tsconfig.json"
  },
  "dependencies": {
    "@nestjs/common": "10.4.7",
    "@nestjs/core": "10.4.7",
    "reflect-metadata": "0.2.2",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@insurtech/shared-types": "workspace:*",
    "@types/node": "22.9.0",
    "@vitest/coverage-v8": "2.1.5",
    "typescript": "5.7.2",
    "vitest": "2.1.5"
  },
  "peerDependencies": {
    "rxjs": "7.8.1"
  },
  "engines": {
    "node": ">=22.11.0",
    "pnpm": ">=9.15.0"
  },
  "publishConfig": {
    "access": "restricted"
  },
  "sideEffects": false
}
```

Notes importantes :
- `"private": true` : ce package n'est jamais publie sur le registry NPM public ; il vit uniquement dans le monorepo via workspace links pnpm.
- `"type": "module"` : ESM-first, conforme au tooling Node 22+ et Next.js 15.
- `exports` field a un seul export `"."` : aucun sous-chemin n'est expose, ce qui evite les imports type `@insurtech/auth/internal/x` qui contournent l'API publique.
- `"sideEffects": false` : autorise le tree-shaking par les bundlers Webpack/Rollup/esbuild des frontends Next.js.
- `peerDependencies.rxjs` : NestJS depend de rxjs ; on declare en peer pour eviter le doublon et laisser l'app racine fournir sa version.

### 6.2 Fichier 2 / 14 : `repo/packages/auth/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "resolveJsonModule": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "types": ["node"],
    "tsBuildInfoFile": "dist/.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["dist", "node_modules", "test", "**/*.spec.ts"],
  "references": [
    { "path": "../shared-types" }
  ]
}
```

Notes :
- `composite: true` est requis pour les references TypeScript (build incremental cross-package via Turborepo).
- `experimentalDecorators` + `emitDecoratorMetadata` sont requis pour les decorateurs NestJS.
- `references` declare la dependance compile-time vers `@insurtech/shared-types` (Locale, Money, etc.) ; pnpm fournit le link, TypeScript fournit le typecheck propage.

### 6.3 Fichier 3 / 14 : `repo/packages/auth/src/types/auth-roles.ts`

Ce fichier centralise la totalite du vocabulaire des roles du programme. Il est consomme par TOUTES les autres taches du Sprint 5, par Sprint 7 (RBAC), Sprint 25 (cross-tenant), Sprint 31 (Sky service tokens). Toute modification ici impacte le compile-time de toutes les apps : c'est intentionnel et constitue le filet de securite contractuel.

```typescript
/**
 * @insurtech/auth/types/auth-roles
 *
 * Defines the 12 strict roles of the Skalean InsurTech v2.2 program.
 * NEVER add a role without updating documentation/5-roles-permissions.md AND the RBAC service of Sprint 7.
 *
 * Hierarchy (from highest privilege to lowest):
 *   Platform Niveau 1     : super_admin_platform > analyst_support
 *   Tenant Broker N2      : broker_admin > broker_user > broker_assistant
 *   Tenant Garage N2      : garage_admin > garage_chef > garage_technicien (+ garage_comptable + garage_commercial as siblings)
 *   Assure N3             : assure
 *   Public                : prospect
 *
 * Reference :
 *   - 00-pilotage/documentation/5-roles-permissions.md
 *   - 00-pilotage/decisions/decision-013-rbac-roles.md
 *   - Sprint 7 RBAC implementation
 */

export enum AuthRole {
  /** Skalean platform staff -- full bypass RLS, manages all tenants */
  SuperAdminPlatform = 'super_admin_platform',
  /** Skalean platform staff -- read-only across all tenants for support N2 */
  AnalystSupport = 'analyst_support',

  /** Tenant broker -- admin of a courtage cabinet, full CRUD within tenant */
  BrokerAdmin = 'broker_admin',
  /** Tenant broker -- subscribing courtier, owns deals and policies */
  BrokerUser = 'broker_user',
  /** Tenant broker -- administrative assistant */
  BrokerAssistant = 'broker_assistant',

  /** Tenant garage -- admin of a repair garage, full CRUD within tenant */
  GarageAdmin = 'garage_admin',
  /** Tenant garage -- workshop manager, assigns sinistres */
  GarageChef = 'garage_chef',
  /** Tenant garage -- workshop technician, executes repairs (PWA mobile) */
  GarageTechnicien = 'garage_technicien',
  /** Tenant garage -- accounting staff, manages books + payments */
  GarageComptable = 'garage_comptable',
  /** Tenant garage -- commercial staff, manages devis */
  GarageCommercial = 'garage_commercial',

  /** End user -- assured client connected to assure-portal apps */
  Assure = 'assure',

  /** Public visitor -- non-authenticated or signing up */
  Prospect = 'prospect',
}

/**
 * Type guard: is this role a Platform-level role (Niveau 1)?
 * Platform roles bypass tenant isolation (no tenant_id required in JWT).
 * MUST be checked before any tenant_id comparison logic.
 */
export function isPlatformRole(role: AuthRole): boolean {
  return role === AuthRole.SuperAdminPlatform || role === AuthRole.AnalystSupport;
}

/**
 * Type guard: is this role a Tenant-level role (Niveau 2)?
 * Tenant roles require tenant_id in JWT. Operations are scoped to that tenant.
 */
export function isTenantRole(role: AuthRole): boolean {
  return (
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.BrokerUser ||
    role === AuthRole.BrokerAssistant ||
    role === AuthRole.GarageAdmin ||
    role === AuthRole.GarageChef ||
    role === AuthRole.GarageTechnicien ||
    role === AuthRole.GarageComptable ||
    role === AuthRole.GarageCommercial
  );
}

/** Type guard: is this role specific to broker tenants (cabinet courtage)? */
export function isBrokerRole(role: AuthRole): boolean {
  return (
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.BrokerUser ||
    role === AuthRole.BrokerAssistant
  );
}

/** Type guard: is this role specific to garage tenants? */
export function isGarageRole(role: AuthRole): boolean {
  return (
    role === AuthRole.GarageAdmin ||
    role === AuthRole.GarageChef ||
    role === AuthRole.GarageTechnicien ||
    role === AuthRole.GarageComptable ||
    role === AuthRole.GarageCommercial
  );
}

/** Type guard: is this the assure (final client) role? */
export function isAssureRole(role: AuthRole): boolean {
  return role === AuthRole.Assure;
}

/** Type guard: is this the prospect (public, anonymous) role? */
export function isProspectRole(role: AuthRole): boolean {
  return role === AuthRole.Prospect;
}

/**
 * Returns the parent roles in the hierarchy.
 * broker_admin "is a" broker_user "is a" broker_assistant.
 * Used by Sprint 7 RBAC to inherit permissions from sub-roles.
 */
export function getRoleHierarchy(role: AuthRole): AuthRole[] {
  switch (role) {
    case AuthRole.BrokerAdmin:
      return [AuthRole.BrokerAdmin, AuthRole.BrokerUser, AuthRole.BrokerAssistant];
    case AuthRole.BrokerUser:
      return [AuthRole.BrokerUser, AuthRole.BrokerAssistant];
    case AuthRole.BrokerAssistant:
      return [AuthRole.BrokerAssistant];
    case AuthRole.GarageAdmin:
      return [
        AuthRole.GarageAdmin,
        AuthRole.GarageChef,
        AuthRole.GarageTechnicien,
        AuthRole.GarageComptable,
        AuthRole.GarageCommercial,
      ];
    case AuthRole.GarageChef:
      return [AuthRole.GarageChef, AuthRole.GarageTechnicien];
    case AuthRole.GarageTechnicien:
    case AuthRole.GarageComptable:
    case AuthRole.GarageCommercial:
    case AuthRole.SuperAdminPlatform:
    case AuthRole.AnalystSupport:
    case AuthRole.Assure:
    case AuthRole.Prospect:
      return [role];
    default: {
      // Exhaustive switch -- TypeScript will fail compile if any AuthRole value is missing.
      const exhaustive: never = role;
      throw new Error(`Unhandled AuthRole in getRoleHierarchy: ${String(exhaustive)}`);
    }
  }
}

/**
 * Whether MFA is mandatory for this role.
 * super_admin_platform and analyst_support MUST have MFA enabled at signup.
 * broker_admin and garage_admin MUST have MFA enabled when they create their tenant (Sprint 6).
 * Other roles MAY enable MFA optionally.
 */
export function isMfaMandatory(role: AuthRole): boolean {
  return (
    role === AuthRole.SuperAdminPlatform ||
    role === AuthRole.AnalystSupport ||
    role === AuthRole.BrokerAdmin ||
    role === AuthRole.GarageAdmin
  );
}

/**
 * Whether WebAuthn / Passkey biometric login is preferred for this role (Sprint 23).
 * garage_technicien works on PWA mobile in workshop environment without keyboard;
 * biometric login is the only ergonomic option.
 */
export function prefersWebAuthn(role: AuthRole): boolean {
  return role === AuthRole.GarageTechnicien;
}

/** All AuthRole values as a frozen array (for iteration in tests, validators, etc.) */
export const ALL_AUTH_ROLES: readonly AuthRole[] = Object.freeze([
  AuthRole.SuperAdminPlatform,
  AuthRole.AnalystSupport,
  AuthRole.BrokerAdmin,
  AuthRole.BrokerUser,
  AuthRole.BrokerAssistant,
  AuthRole.GarageAdmin,
  AuthRole.GarageChef,
  AuthRole.GarageTechnicien,
  AuthRole.GarageComptable,
  AuthRole.GarageCommercial,
  AuthRole.Assure,
  AuthRole.Prospect,
]);
```

Notes importantes :
- L'enum `AuthRole` est un `regular enum` (pas `const enum`) : il cree un objet runtime importable, evitant les pieges d'inlining cross-package documentes en section 2.5 piege 1.
- Le `default` du switch dans `getRoleHierarchy` utilise le type `never` : si un developpeur ajoute un role a l'enum sans mettre a jour ce switch, TypeScript signale au compile-time. Ce pattern garantit l'exhaustivite.
- Aucun champ `displayName` n'est inclus ici : la traduction ar-MA / fr-MA / fr-FR / en se fait dans `@insurtech/comm` Sprint 18 a partir de la valeur de l'enum. Garder ce fichier purement structurel.
- `ALL_AUTH_ROLES` est frozen pour empecher mutation runtime accidentelle (un test qui fait `roles.push(...)` modifierait l'export pour les tests suivants).
- Les helpers `isXxxRole` sont preferes a un membre de l'enum decorant chaque valeur, pour rester un enum simple importable a runtime.

### 6.4 Fichier 4 / 14 : `repo/packages/auth/src/types/jwt-payload.ts`

```typescript
/**
 * @insurtech/auth/types/jwt-payload
 *
 * Defines the strict JWT payload contract for all access tokens, refresh tokens,
 * and service tokens (Sprint 31) issued and verified by the Skalean InsurTech program.
 *
 * Reference :
 *   - RFC 7519 (JSON Web Token)
 *   - decision-014 (JWT HS256 Sprint 5, RS256 Sprint 14+)
 *   - Sprint 5 Tache 2.1.4 (JwtService implementation)
 *   - Sprint 6 Tache (TenantContextService consumes tenant_id)
 *   - Sprint 31 (ServiceJwtPayload for Sky agent)
 */

import type { AuthRole } from './auth-roles.js';

/**
 * Standard JWT claims (RFC 7519) plus Skalean InsurTech extensions.
 * All times are seconds since Unix epoch (NEVER milliseconds).
 */
export interface JwtPayload {
  /** Subject : user_id (UUID v4) of the authenticated user. */
  sub: string;

  /** Tenant_id (UUID v4) for tenant-scoped roles. NULL for platform-level roles (super_admin_platform, analyst_support). */
  tenant_id: string | null;

  /** Email of the user (denormalized for log readability without DB lookup). */
  email: string;

  /** Authenticated role (one of 12 AuthRole values). */
  role: AuthRole;

  /** Whether MFA challenge has been completed within this session.
   * Sprint 5 Tache 2.1.6 sets this to false on signin, then to true after /verify-mfa.
   * Endpoints requiring MFA (Sprint 5 Tache 2.1.8 MfaRequiredGuard) reject if mfa_verified !== true.
   */
  mfa_verified: boolean;

  /** JWT ID -- unique per token (UUID v4). Used for revocation tracking in Sprint 5 Tache 2.1.5 SessionService. */
  jti: string;

  /** Session ID (UUID v4) -- groups multiple JWT ids of the same login session. */
  sid: string;

  /** Issuer -- always "skalean-insurtech-api" for the api app. Verified at signature check. */
  iss: string;

  /** Audience -- "skalean-insurtech-app" for end-user tokens. */
  aud: string;

  /** Issued at (Unix seconds). */
  iat: number;

  /** Expires at (Unix seconds). For access tokens: iat + 900 (15 min). */
  exp: number;

  /** Not before (Unix seconds). Always equal to iat for Skalean InsurTech (no delayed activation). */
  nbf: number;
}

/**
 * Refresh token payload. Stored hashed (SHA-256) in Redis.
 * Carries fewer fields than access JWT to minimize blast radius if leaked.
 */
export interface RefreshTokenPayload {
  /** Subject : user_id. */
  sub: string;

  /** Session ID (groups access + refresh of the same login). */
  sid: string;

  /** Token family ID (UUID v4) -- generated at signin and shared by all refresh tokens of the same login.
   * Sprint 5 Tache 2.1.4 implements rotation : when a refresh is exchanged for a new access token,
   * a new refresh token is issued with the same token_family. The previous refresh is invalidated.
   * If a previously-rotated-out refresh is presented again (theft replay), the entire family is revoked.
   * This pattern is known as "Refresh Token Rotation with Theft Detection" (RFC 6749 best practice).
   */
  token_family: string;

  /** Generation counter within the family (1, 2, 3, ...). Latest valid generation is stored in Redis. */
  generation: number;

  /** JWT ID for this specific refresh token. */
  jti: string;

  /** Issued at (Unix seconds). */
  iat: number;

  /** Expires at (Unix seconds). For refresh tokens: iat + 2592000 (30 days). */
  exp: number;

  /** Issuer. */
  iss: string;
}

/**
 * Service-to-service JWT payload (Sprint 31, Sky agent).
 * Distinct from user JWT to avoid privilege confusion.
 */
export interface ServiceJwtPayload {
  /** Service identifier (e.g., "sky-agent", "mcp-server"). */
  sub: string;

  /** Service kind discriminator. */
  service: 'sky' | 'mcp' | 'comm-worker' | 'sched-worker';

  /** Tenant scope (null for cross-tenant services like sky-agent). */
  tenant_id: string | null;

  /** Allowed scopes (Sprint 31 capability tokens). */
  scopes: readonly string[];

  /** JWT ID. */
  jti: string;

  /** Issued at (Unix seconds). */
  iat: number;

  /** Expires at (Unix seconds). Service tokens have shorter TTL (5 min default). */
  exp: number;

  /** Issuer. */
  iss: string;

  /** Audience. */
  aud: string;
}

/** Discriminated union for any JWT type seen by the api. */
export type AnyJwtPayload = JwtPayload | ServiceJwtPayload;

/** Type guard distinguishing user JWT from service JWT at runtime. */
export function isServiceJwtPayload(payload: AnyJwtPayload): payload is ServiceJwtPayload {
  return 'service' in payload;
}

/** Type guard for user JWT. */
export function isUserJwtPayload(payload: AnyJwtPayload): payload is JwtPayload {
  return !('service' in payload);
}

/**
 * Returns current time as Unix seconds (NEVER milliseconds).
 * JWT spec (RFC 7519 section 2) defines NumericDate as seconds since 1970-01-01T00:00:00Z UTC.
 */
export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Computes expiry as Unix seconds = now + ttl.
 * @param ttlSeconds Time-to-live in seconds (NEVER milliseconds).
 */
export function expirySeconds(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new Error(`expirySeconds: ttlSeconds must be a positive finite number, got ${ttlSeconds}`);
  }
  return nowInSeconds() + Math.floor(ttlSeconds);
}

/**
 * Returns true if the payload's exp claim is in the past (token is expired).
 * Adds optional leeway (default 5 seconds) for clock skew between issuer and verifier.
 */
export function isExpired(payload: { exp: number }, leewaySeconds = 5): boolean {
  return payload.exp + leewaySeconds < nowInSeconds();
}
```

### 6.5 Fichier 5 / 14 : `repo/packages/auth/src/types/auth-context.ts`

```typescript
/**
 * @insurtech/auth/types/auth-context
 *
 * Runtime authentication context exposed to controllers and services.
 * Built by Sprint 5 Tache 2.1.6 JwtStrategy.validate() from a verified JwtPayload.
 * Consumed by Sprint 6 TenantContextService and Sprint 7 RbacService.
 */

import type { AuthRole } from './auth-roles.js';

/** Discriminator for the authenticated subject kind. */
export type AuthSubjectKind = 'user' | 'service' | 'anonymous';

/**
 * Minimal user shape derived from the JWT and DB lookup at request boundary.
 * Does NOT contain password_hash, mfa_secret, recovery_codes, or any sensitive field.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: AuthRole;
  display_name: string;
  tenant_id: string | null;
  mfa_enabled: boolean;
  mfa_verified: boolean;
  email_verified: boolean;
  locale: 'fr-MA' | 'ar-MA' | 'en' | 'fr-FR';
  created_at: string;
}

/** Context for service-to-service calls (Sprint 31). */
export interface AuthenticatedService {
  id: string;
  service: 'sky' | 'mcp' | 'comm-worker' | 'sched-worker';
  tenant_id: string | null;
  scopes: readonly string[];
}

/** Context for anonymous (public endpoints). */
export interface AnonymousSubject {
  kind: 'anonymous';
}

/** Polymorphic subject embedded in the request context. */
export type AuthSubject =
  | { kind: 'user'; user: AuthenticatedUser; session_id: string; jwt_id: string }
  | { kind: 'service'; service: AuthenticatedService; jwt_id: string }
  | AnonymousSubject;

/**
 * Top-level auth context attached to NestJS Request via JwtStrategy.
 * Accessible from controllers via @CurrentAuth() decorator (Sprint 5 Tache 2.1.6).
 */
export interface AuthContext {
  subject: AuthSubject;
  ip: string;
  user_agent: string;
  request_id: string;
  authenticated_at: number;
}

/** Type guard: is the subject an authenticated user? */
export function isUserSubject(s: AuthSubject): s is { kind: 'user'; user: AuthenticatedUser; session_id: string; jwt_id: string } {
  return s.kind === 'user';
}

/** Type guard: is the subject a service? */
export function isServiceSubject(s: AuthSubject): s is { kind: 'service'; service: AuthenticatedService; jwt_id: string } {
  return s.kind === 'service';
}

/** Type guard: anonymous? */
export function isAnonymousSubject(s: AuthSubject): s is AnonymousSubject {
  return s.kind === 'anonymous';
}
```

### 6.6 Fichier 6 / 14 : `repo/packages/auth/src/types/auth-events.ts`

```typescript
/**
 * @insurtech/auth/types/auth-events
 *
 * Defines the AuthEventKind enum and AuthEventEnvelope interface published on Kafka topics
 * insurtech.events.auth.{event_kind} by Sprint 5 Tache 2.1.12 AuditAuthService.
 * Consumed by Sprint 18 (notification triggers), Sprint 22 (analytics), Sprint 33 (SIEM).
 */

import type { AuthRole } from './auth-roles.js';

export enum AuthEventKind {
  SignupStarted = 'signup_started',
  SignupCompleted = 'signup_completed',
  EmailVerified = 'email_verified',
  SigninSuccess = 'signin_success',
  SigninFailed = 'signin_failed',
  SigninLocked = 'signin_locked',
  MfaSetupStarted = 'mfa_setup_started',
  MfaSetupCompleted = 'mfa_setup_completed',
  MfaVerifySuccess = 'mfa_verify_success',
  MfaVerifyFailed = 'mfa_verify_failed',
  MfaDisabled = 'mfa_disabled',
  RefreshUsed = 'refresh_used',
  RefreshReplayDetected = 'refresh_replay_detected',
  Signout = 'signout',
  SignoutAll = 'signout_all',
  RecoveryStarted = 'recovery_started',
  RecoveryCompleted = 'recovery_completed',
  PasswordChanged = 'password_changed',
  LockoutTriggered = 'lockout_triggered',
  LockoutCleared = 'lockout_cleared',
  SessionExpired = 'session_expired',
  SuspiciousLogin = 'suspicious_login',
}

/**
 * Envelope of an auth event published on Kafka.
 * Schema is verified by Zod at publish time (Sprint 5 Tache 2.1.12).
 */
export interface AuthEventEnvelope<P = Record<string, unknown>> {
  event_id: string;
  event_kind: AuthEventKind;
  occurred_at: string;
  ingested_at?: string;
  tenant_id: string | null;
  user_id: string | null;
  user_email: string | null;
  user_role: AuthRole | null;
  session_id: string | null;
  ip: string;
  user_agent: string;
  request_id: string;
  payload: P;
  context: {
    program_version: string;
    sprint: number;
  };
}

/** Type-safe payloads per event kind (mapped types). */
export interface AuthEventPayloadMap {
  [AuthEventKind.SignupStarted]: { email: string; locale: string };
  [AuthEventKind.SignupCompleted]: { email: string; role: AuthRole };
  [AuthEventKind.EmailVerified]: { email: string };
  [AuthEventKind.SigninSuccess]: { mfa_required: boolean; remember_me: boolean };
  [AuthEventKind.SigninFailed]: { reason: 'invalid_credentials' | 'email_not_verified' | 'account_disabled' };
  [AuthEventKind.SigninLocked]: { tier: 1 | 2 | 3 | 4; locked_until: string };
  [AuthEventKind.MfaSetupStarted]: { method: 'totp' | 'webauthn' };
  [AuthEventKind.MfaSetupCompleted]: { method: 'totp' | 'webauthn'; recovery_codes_count: number };
  [AuthEventKind.MfaVerifySuccess]: { method: 'totp' | 'recovery_code' };
  [AuthEventKind.MfaVerifyFailed]: { method: 'totp' | 'recovery_code'; reason: string };
  [AuthEventKind.MfaDisabled]: { method: 'totp' | 'webauthn' };
  [AuthEventKind.RefreshUsed]: { token_family: string; generation: number };
  [AuthEventKind.RefreshReplayDetected]: { token_family: string; expected_generation: number; presented_generation: number };
  [AuthEventKind.Signout]: { session_id: string };
  [AuthEventKind.SignoutAll]: { sessions_revoked: number };
  [AuthEventKind.RecoveryStarted]: { email: string };
  [AuthEventKind.RecoveryCompleted]: { email: string };
  [AuthEventKind.PasswordChanged]: Record<string, never>;
  [AuthEventKind.LockoutTriggered]: { tier: 1 | 2 | 3 | 4; failed_attempts: number };
  [AuthEventKind.LockoutCleared]: { reason: 'manual' | 'expired' | 'recovery_completed' };
  [AuthEventKind.SessionExpired]: { session_id: string; reason: 'idle' | 'absolute' };
  [AuthEventKind.SuspiciousLogin]: { signal: string; risk_score: number };
}

/** Constructor returning a typed envelope for kind K. */
export type TypedAuthEvent<K extends AuthEventKind> = AuthEventEnvelope<AuthEventPayloadMap[K]> & {
  event_kind: K;
};
```

### 6.7 Fichier 7 / 14 : `repo/packages/auth/src/types/session-context.ts`

```typescript
/**
 * @insurtech/auth/types/session-context
 *
 * Shape of a session record stored in Redis DB 1 by Sprint 5 Tache 2.1.5 SessionService.
 */

import type { AuthRole } from './auth-roles.js';

export interface SessionContext {
  session_id: string;
  user_id: string;
  tenant_id: string | null;
  role: AuthRole;
  ip: string;
  user_agent: string;
  refresh_token_family: string;
  refresh_generation: number;
  mfa_verified: boolean;
  remember_me: boolean;
  created_at: number;
  last_seen_at: number;
  expires_at: number;
  metadata: {
    locale: string;
    device_fingerprint?: string;
    geo_country?: string;
  };
}

export interface SessionLookupResult {
  found: boolean;
  session?: SessionContext;
  reason?: 'not_found' | 'expired' | 'revoked';
}
```

### 6.8 Fichier 8 / 14 : `repo/packages/auth/src/types/lockout.ts`

```typescript
/**
 * @insurtech/auth/types/lockout
 *
 * Shape of a lockout snapshot persisted in Redis DB 2 (LOCKOUTS) by Sprint 5 Tache 2.1.10.
 * Implements progressive lockout : 5 -> 15 -> 60 minutes -> permanent (manual unlock).
 */

export type LockoutTier = 1 | 2 | 3 | 4;

export interface LockoutSnapshot {
  email: string;
  tenant_id: string | null;
  failed_attempts: number;
  current_tier: LockoutTier;
  locked: boolean;
  locked_at: number | null;
  locked_until: number | null;
  last_failure_at: number;
  last_failure_ip: string;
  last_failure_user_agent: string;
}

export interface LockoutDecision {
  allow: boolean;
  reason?: 'locked' | 'tier_up' | 'reset';
  retry_after_seconds?: number;
  next_tier_after_attempts?: number;
}

/**
 * Returns lockout duration in milliseconds for a given tier.
 * Tier 4 returns Number.POSITIVE_INFINITY meaning permanent until manual unlock.
 */
export function getLockoutDurationMs(tier: LockoutTier): number {
  switch (tier) {
    case 1: return 5 * 60 * 1000;
    case 2: return 15 * 60 * 1000;
    case 3: return 60 * 60 * 1000;
    case 4: return Number.POSITIVE_INFINITY;
    default: {
      const exhaustive: never = tier;
      throw new Error(`Unhandled LockoutTier: ${String(exhaustive)}`);
    }
  }
}
```

### 6.9 Fichier 9 / 14 : `repo/packages/auth/src/types/index.ts`

```typescript
/**
 * @insurtech/auth/types
 *
 * Barrel selectif des types publics. Aucun export *.
 */

export type {
  AuthenticatedUser,
  AuthenticatedService,
  AnonymousSubject,
  AuthSubject,
  AuthSubjectKind,
  AuthContext,
} from './auth-context.js';
export {
  isUserSubject,
  isServiceSubject,
  isAnonymousSubject,
} from './auth-context.js';

export type {
  JwtPayload,
  RefreshTokenPayload,
  ServiceJwtPayload,
  AnyJwtPayload,
} from './jwt-payload.js';
export {
  isServiceJwtPayload,
  isUserJwtPayload,
  nowInSeconds,
  expirySeconds,
  isExpired,
} from './jwt-payload.js';

export {
  AuthRole,
  isPlatformRole,
  isTenantRole,
  isBrokerRole,
  isGarageRole,
  isAssureRole,
  isProspectRole,
  getRoleHierarchy,
  isMfaMandatory,
  prefersWebAuthn,
  ALL_AUTH_ROLES,
} from './auth-roles.js';

export {
  AuthEventKind,
} from './auth-events.js';
export type {
  AuthEventEnvelope,
  AuthEventPayloadMap,
  TypedAuthEvent,
} from './auth-events.js';

export type {
  SessionContext,
  SessionLookupResult,
} from './session-context.js';

export type {
  LockoutSnapshot,
  LockoutDecision,
  LockoutTier,
} from './lockout.js';
export {
  getLockoutDurationMs,
} from './lockout.js';
```

### 6.10 Fichier 10 / 14 : `repo/packages/auth/src/schemas/signup.schema.ts`

```typescript
/**
 * @insurtech/auth/schemas/signup
 *
 * Zod schema for the /api/v1/auth/signup endpoint payload (Sprint 5 Tache 2.1.9).
 * Used by frontends Sprint 4 to validate forms before submission, and by AuthController to validate body.
 *
 * Convention :
 *   - .strict() rejects unknown fields (mass assignment defense).
 *   - email regex restricted to ASCII RFC 5321 simplified to defeat homograph attacks (decision-014).
 *   - password constraint : min 12 chars, 1 upper, 1 lower, 1 digit, 1 special (PASSWORD_POLICY).
 *   - locale enum : 4 supported locales (decision-009 ar-MA / fr-MA / en / fr-FR).
 *   - accepted_tos must be literal true (defense against checkbox-spoofing).
 */

import { z } from 'zod';
import { EMAIL_REGEX } from '../constants/email-regex.js';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{12,128}$/;

export const signupSchema = z
  .object({
    email: z
      .string({ required_error: 'email is required', invalid_type_error: 'email must be a string' })
      .trim()
      .toLowerCase()
      .min(5, 'email is too short')
      .max(254, 'email is too long')
      .regex(EMAIL_REGEX, 'email format is invalid (ASCII only)'),
    password: z
      .string({ required_error: 'password is required' })
      .min(12, 'password must be at least 12 characters long')
      .max(128, 'password is too long (max 128)')
      .regex(PASSWORD_REGEX, 'password must contain 1 uppercase, 1 lowercase, 1 digit, 1 special character'),
    display_name: z
      .string({ required_error: 'display_name is required' })
      .trim()
      .min(2, 'display_name is too short')
      .max(64, 'display_name is too long')
      .regex(/^[\p{L}\p{N} '.\-]+$/u, 'display_name contains invalid characters'),
    locale: z.enum(['fr-MA', 'ar-MA', 'en', 'fr-FR'], {
      required_error: 'locale is required',
      invalid_type_error: 'locale must be one of fr-MA, ar-MA, en, fr-FR',
    }),
    accepted_tos: z.literal(true, {
      errorMap: () => ({ message: 'accepted_tos must be true (terms of service must be accepted)' }),
    }),
    invitation_token: z.string().min(20).max(200).optional(),
    requested_role: z.enum(['broker_admin', 'garage_admin', 'assure', 'prospect']).optional(),
  })
  .strict();

export type SignupInput = z.infer<typeof signupSchema>;

export function parseSignup(input: unknown): SignupInput {
  return signupSchema.parse(input);
}

export function safeParseSignup(input: unknown):
  | { success: true; data: SignupInput }
  | { success: false; errors: z.ZodIssue[] } {
  const result = signupSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.issues };
}
```

### 6.11 Fichier 11 / 14 : `repo/packages/auth/src/schemas/signin.schema.ts`

```typescript
/**
 * @insurtech/auth/schemas/signin
 *
 * Zod schema for /api/v1/auth/signin endpoint (Sprint 5 Tache 2.1.6).
 *
 * mfa_code is optional at signin : the controller flow is :
 *   1. POST /signin with email+password (no mfa_code) -> if MFA enabled, returns 200 with { mfa_required: true, mfa_challenge_token: ... }
 *   2. POST /signin again with email+password+mfa_code -> if MFA verified, returns 200 with { access_token, refresh_token }
 * Alternative flow uses the dedicated POST /verify-mfa endpoint (Sprint 5 Tache 2.1.8).
 */

import { z } from 'zod';
import { EMAIL_REGEX } from '../constants/email-regex.js';

export const signinSchema = z
  .object({
    email: z
      .string({ required_error: 'email is required' })
      .trim()
      .toLowerCase()
      .min(5)
      .max(254)
      .regex(EMAIL_REGEX, 'email format is invalid'),
    password: z
      .string({ required_error: 'password is required' })
      .min(1, 'password is required')
      .max(128, 'password too long'),
    remember_me: z.boolean().optional().default(false),
    mfa_code: z
      .string()
      .regex(/^\d{6}$/, 'mfa_code must be exactly 6 digits')
      .optional(),
    recovery_code: z
      .string()
      .regex(/^[A-Z0-9]{10}$/, 'recovery_code must be 10 uppercase alphanumeric characters')
      .optional(),
  })
  .strict()
  .refine((data) => !(data.mfa_code && data.recovery_code), {
    message: 'mfa_code and recovery_code cannot both be provided',
    path: ['mfa_code'],
  });

export type SigninInput = z.infer<typeof signinSchema>;

export function parseSignin(input: unknown): SigninInput {
  return signinSchema.parse(input);
}
```

### 6.12 Fichier 12 / 14 : `repo/packages/auth/src/schemas/mfa.schema.ts`

```typescript
/**
 * @insurtech/auth/schemas/mfa
 *
 * Schemas for /api/v1/auth/setup-mfa, /verify-mfa, /disable-mfa (Sprint 5 Tache 2.1.7-2.1.8).
 */

import { z } from 'zod';

export const mfaSetupRequestSchema = z
  .object({
    method: z.literal('totp'),
  })
  .strict();
export type MfaSetupRequestInput = z.infer<typeof mfaSetupRequestSchema>;

export const mfaSetupConfirmSchema = z
  .object({
    setup_token: z.string().min(20).max(500),
    totp_code: z.string().regex(/^\d{6}$/, 'totp_code must be 6 digits'),
  })
  .strict();
export type MfaSetupConfirmInput = z.infer<typeof mfaSetupConfirmSchema>;

export const mfaVerifySchema = z
  .object({
    challenge_token: z.string().min(20).max(500),
    totp_code: z.string().regex(/^\d{6}$/).optional(),
    recovery_code: z.string().regex(/^[A-Z0-9]{10}$/).optional(),
  })
  .strict()
  .refine((data) => Boolean(data.totp_code) !== Boolean(data.recovery_code), {
    message: 'Exactly one of totp_code or recovery_code must be provided',
    path: ['totp_code'],
  });
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;

export const mfaDisableSchema = z
  .object({
    current_password: z
      .string()
      .min(12, 'password too short')
      .max(128, 'password too long'),
    totp_code: z.string().regex(/^\d{6}$/),
  })
  .strict();
export type MfaDisableInput = z.infer<typeof mfaDisableSchema>;

export const mfaRecoveryCodeRegenerateSchema = z
  .object({
    current_password: z.string().min(12).max(128),
    totp_code: z.string().regex(/^\d{6}$/),
  })
  .strict();
export type MfaRecoveryCodeRegenerateInput = z.infer<typeof mfaRecoveryCodeRegenerateSchema>;
```

### 6.13 Fichier 13 / 14 : `repo/packages/auth/src/constants/argon2-params.ts`

```typescript
/**
 * @insurtech/auth/constants/argon2-params
 *
 * Frozen Argon2id parameters (OWASP Password Storage Cheat Sheet 2024).
 * NEVER weaken without a security review and a corresponding decision-XXX file.
 *
 * Reference :
 *   - https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 *   - decision-013 (Argon2id over bcrypt)
 *   - Sprint 5 Tache 2.1.2 (Argon2Service implementation using @node-rs/argon2)
 *   - Sprint 33 (pentest review of all crypto params)
 */

export const ARGON2_PARAMS = Object.freeze({
  algorithm: 'argon2id' as const,
  memoryCost: 65536 as const,
  timeCost: 3 as const,
  parallelism: 4 as const,
  hashLength: 32 as const,
  saltLength: 16 as const,
  version: 0x13 as const,
});

export type Argon2Params = typeof ARGON2_PARAMS;

export const PASSWORD_POLICY = Object.freeze({
  minLength: 12 as const,
  maxLength: 128 as const,
  requireUppercase: true as const,
  requireLowercase: true as const,
  requireDigit: true as const,
  requireSpecial: true as const,
  banlistEnabled: true as const,
  banlistFile: 'data/banned-passwords.json' as const,
  similarityThreshold: 5 as const,
  rejectIfContainsEmailLocal: true as const,
  rejectIfContainsDisplayName: true as const,
});

export type PasswordPolicy = typeof PASSWORD_POLICY;

export const PASSWORD_REGEX_DESCRIPTION =
  'Min 12 chars, at least 1 uppercase letter, 1 lowercase letter, 1 digit, 1 special character (!@#$%^&*()_+-=[]{};\':"\\|,.<>/?). Max 128 chars.';
```

### 6.14 Fichier 14 / 14 : `repo/packages/auth/src/auth.module.ts`

```typescript
/**
 * @insurtech/auth/auth.module
 *
 * Skeleton @Global() AuthModule for NestJS.
 *
 * INTENTIONALLY EMPTY in Tache 2.1.1 -- enriched progressively :
 *   - Tache 2.1.2 adds Argon2Service to providers
 *   - Tache 2.1.3 adds EncryptionService, HashingService
 *   - Tache 2.1.4 adds JwtService
 *   - Tache 2.1.5 adds SessionService
 *   - Tache 2.1.6 adds AuthController, AuthService, JwtStrategy, JwtAuthGuard
 *   - Tache 2.1.7 adds MfaService
 *   - Tache 2.1.8 adds MfaRequiredGuard
 *   - Tache 2.1.9 adds SignupService, EmailVerificationService
 *   - Tache 2.1.10 adds LockoutService
 *   - Tache 2.1.11 adds RecoveryService
 *   - Tache 2.1.12 adds AuditAuthService
 *   - Tache 2.1.13 adds EmailService
 *   - Tache 2.1.14 adds RateLimitGuard auth-specific
 */

import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [],
  providers: [],
  controllers: [],
  exports: [],
})
export class AuthModule {}
```

### 6.15 Fichier supplementaire : `repo/packages/auth/src/index.ts`

```typescript
/**
 * @insurtech/auth
 *
 * Public API of the auth package. Barrel selectif uniquement (no export *).
 */

export * from './types/index.js';
export * from './schemas/index.js';
export * from './constants/index.js';
export { AuthModule } from './auth.module.js';
```

(Note: the `export *` here is acceptable only because each sub-barrel is itself selectif and curated; this is the only place where wildcard re-export is allowed in the package, and it is verified by the V18 critere.)

---

## 7. Tests complets

### 7.1 Tests unitaires : `repo/packages/auth/test/types/auth-roles.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  AuthRole,
  isPlatformRole,
  isTenantRole,
  isBrokerRole,
  isGarageRole,
  isAssureRole,
  isProspectRole,
  getRoleHierarchy,
  isMfaMandatory,
  prefersWebAuthn,
  ALL_AUTH_ROLES,
} from '../../src/types/auth-roles.js';

describe('AuthRole enum', () => {
  it('should declare exactly 12 roles', () => {
    expect(Object.keys(AuthRole)).toHaveLength(12);
    expect(ALL_AUTH_ROLES).toHaveLength(12);
  });

  it('should have stable string values for each role', () => {
    expect(AuthRole.SuperAdminPlatform).toBe('super_admin_platform');
    expect(AuthRole.AnalystSupport).toBe('analyst_support');
    expect(AuthRole.BrokerAdmin).toBe('broker_admin');
    expect(AuthRole.BrokerUser).toBe('broker_user');
    expect(AuthRole.BrokerAssistant).toBe('broker_assistant');
    expect(AuthRole.GarageAdmin).toBe('garage_admin');
    expect(AuthRole.GarageChef).toBe('garage_chef');
    expect(AuthRole.GarageTechnicien).toBe('garage_technicien');
    expect(AuthRole.GarageComptable).toBe('garage_comptable');
    expect(AuthRole.GarageCommercial).toBe('garage_commercial');
    expect(AuthRole.Assure).toBe('assure');
    expect(AuthRole.Prospect).toBe('prospect');
  });

  it('should expose all roles via ALL_AUTH_ROLES frozen array', () => {
    expect(Object.isFrozen(ALL_AUTH_ROLES)).toBe(true);
  });
});

describe('isPlatformRole', () => {
  it('returns true for super_admin_platform and analyst_support only', () => {
    expect(isPlatformRole(AuthRole.SuperAdminPlatform)).toBe(true);
    expect(isPlatformRole(AuthRole.AnalystSupport)).toBe(true);
  });
  it('returns false for tenant, assure, and prospect roles', () => {
    expect(isPlatformRole(AuthRole.BrokerAdmin)).toBe(false);
    expect(isPlatformRole(AuthRole.GarageTechnicien)).toBe(false);
    expect(isPlatformRole(AuthRole.Assure)).toBe(false);
    expect(isPlatformRole(AuthRole.Prospect)).toBe(false);
  });
});

describe('isTenantRole', () => {
  it('returns true for broker and garage roles', () => {
    expect(isTenantRole(AuthRole.BrokerAdmin)).toBe(true);
    expect(isTenantRole(AuthRole.BrokerUser)).toBe(true);
    expect(isTenantRole(AuthRole.BrokerAssistant)).toBe(true);
    expect(isTenantRole(AuthRole.GarageAdmin)).toBe(true);
    expect(isTenantRole(AuthRole.GarageChef)).toBe(true);
    expect(isTenantRole(AuthRole.GarageTechnicien)).toBe(true);
    expect(isTenantRole(AuthRole.GarageComptable)).toBe(true);
    expect(isTenantRole(AuthRole.GarageCommercial)).toBe(true);
  });
  it('returns false for platform, assure, prospect', () => {
    expect(isTenantRole(AuthRole.SuperAdminPlatform)).toBe(false);
    expect(isTenantRole(AuthRole.AnalystSupport)).toBe(false);
    expect(isTenantRole(AuthRole.Assure)).toBe(false);
    expect(isTenantRole(AuthRole.Prospect)).toBe(false);
  });
});

describe('isBrokerRole', () => {
  it('returns true only for the 3 broker roles', () => {
    expect(isBrokerRole(AuthRole.BrokerAdmin)).toBe(true);
    expect(isBrokerRole(AuthRole.BrokerUser)).toBe(true);
    expect(isBrokerRole(AuthRole.BrokerAssistant)).toBe(true);
  });
  it('returns false for garage roles', () => {
    expect(isBrokerRole(AuthRole.GarageAdmin)).toBe(false);
    expect(isBrokerRole(AuthRole.GarageChef)).toBe(false);
  });
});

describe('isGarageRole', () => {
  it('returns true for the 5 garage roles', () => {
    expect(isGarageRole(AuthRole.GarageAdmin)).toBe(true);
    expect(isGarageRole(AuthRole.GarageChef)).toBe(true);
    expect(isGarageRole(AuthRole.GarageTechnicien)).toBe(true);
    expect(isGarageRole(AuthRole.GarageComptable)).toBe(true);
    expect(isGarageRole(AuthRole.GarageCommercial)).toBe(true);
  });
  it('returns false for broker roles', () => {
    expect(isGarageRole(AuthRole.BrokerAdmin)).toBe(false);
  });
});

describe('isAssureRole and isProspectRole', () => {
  it('isAssureRole only true for assure', () => {
    expect(isAssureRole(AuthRole.Assure)).toBe(true);
    expect(isAssureRole(AuthRole.Prospect)).toBe(false);
    expect(isAssureRole(AuthRole.BrokerUser)).toBe(false);
  });
  it('isProspectRole only true for prospect', () => {
    expect(isProspectRole(AuthRole.Prospect)).toBe(true);
    expect(isProspectRole(AuthRole.Assure)).toBe(false);
  });
});

describe('getRoleHierarchy', () => {
  it('broker_admin includes itself, broker_user, broker_assistant', () => {
    const h = getRoleHierarchy(AuthRole.BrokerAdmin);
    expect(h).toEqual([AuthRole.BrokerAdmin, AuthRole.BrokerUser, AuthRole.BrokerAssistant]);
  });
  it('broker_user includes itself and broker_assistant', () => {
    expect(getRoleHierarchy(AuthRole.BrokerUser)).toEqual([AuthRole.BrokerUser, AuthRole.BrokerAssistant]);
  });
  it('broker_assistant returns just itself', () => {
    expect(getRoleHierarchy(AuthRole.BrokerAssistant)).toEqual([AuthRole.BrokerAssistant]);
  });
  it('garage_admin includes 5 garage roles', () => {
    const h = getRoleHierarchy(AuthRole.GarageAdmin);
    expect(h).toContain(AuthRole.GarageAdmin);
    expect(h).toContain(AuthRole.GarageChef);
    expect(h).toContain(AuthRole.GarageTechnicien);
    expect(h).toContain(AuthRole.GarageComptable);
    expect(h).toContain(AuthRole.GarageCommercial);
    expect(h).toHaveLength(5);
  });
  it('garage_chef includes itself and technicien', () => {
    expect(getRoleHierarchy(AuthRole.GarageChef)).toEqual([AuthRole.GarageChef, AuthRole.GarageTechnicien]);
  });
  it('atomic roles return only themselves', () => {
    expect(getRoleHierarchy(AuthRole.SuperAdminPlatform)).toEqual([AuthRole.SuperAdminPlatform]);
    expect(getRoleHierarchy(AuthRole.AnalystSupport)).toEqual([AuthRole.AnalystSupport]);
    expect(getRoleHierarchy(AuthRole.Assure)).toEqual([AuthRole.Assure]);
    expect(getRoleHierarchy(AuthRole.Prospect)).toEqual([AuthRole.Prospect]);
  });
});

describe('isMfaMandatory', () => {
  it('returns true for super_admin_platform, analyst_support, broker_admin, garage_admin', () => {
    expect(isMfaMandatory(AuthRole.SuperAdminPlatform)).toBe(true);
    expect(isMfaMandatory(AuthRole.AnalystSupport)).toBe(true);
    expect(isMfaMandatory(AuthRole.BrokerAdmin)).toBe(true);
    expect(isMfaMandatory(AuthRole.GarageAdmin)).toBe(true);
  });
  it('returns false for non-admin roles', () => {
    expect(isMfaMandatory(AuthRole.BrokerUser)).toBe(false);
    expect(isMfaMandatory(AuthRole.GarageTechnicien)).toBe(false);
    expect(isMfaMandatory(AuthRole.Assure)).toBe(false);
    expect(isMfaMandatory(AuthRole.Prospect)).toBe(false);
  });
});

describe('prefersWebAuthn', () => {
  it('returns true only for garage_technicien (PWA mobile no-keyboard ergonomics)', () => {
    expect(prefersWebAuthn(AuthRole.GarageTechnicien)).toBe(true);
    expect(prefersWebAuthn(AuthRole.GarageChef)).toBe(false);
    expect(prefersWebAuthn(AuthRole.BrokerAdmin)).toBe(false);
  });
});
```

### 7.2 Tests unitaires : `repo/packages/auth/test/schemas/signup.schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { signupSchema, safeParseSignup } from '../../src/schemas/signup.schema.js';

describe('signupSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'StrongP@ssw0rd!',
    display_name: 'Aicha Bennani',
    locale: 'fr-MA',
    accepted_tos: true,
  };

  it('accepts a valid payload', () => {
    expect(() => signupSchema.parse(valid)).not.toThrow();
  });

  it('rejects payload missing accepted_tos', () => {
    const bad = { ...valid, accepted_tos: undefined };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('rejects accepted_tos = false', () => {
    const bad = { ...valid, accepted_tos: false };
    expect(() => signupSchema.parse(bad)).toThrow(/accepted_tos must be true/);
  });

  it('rejects password too short', () => {
    const bad = { ...valid, password: 'Short1!' };
    expect(() => signupSchema.parse(bad)).toThrow(/at least 12 characters/);
  });

  it('rejects password missing uppercase', () => {
    const bad = { ...valid, password: 'lowercase1234!' };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('rejects password missing special char', () => {
    const bad = { ...valid, password: 'NoSpecial1234ab' };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('rejects email with cyrillic homograph', () => {
    const bad = { ...valid, email: 'user@gооgle.com' };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('lowercases and trims email', () => {
    const out = signupSchema.parse({ ...valid, email: '   USER@Example.COM   ' });
    expect(out.email).toBe('user@example.com');
  });

  it('rejects unknown fields (strict)', () => {
    const bad = { ...valid, role: 'super_admin_platform' };
    expect(() => signupSchema.parse(bad)).toThrow(/Unrecognized key/);
  });

  it('rejects locale not in enum', () => {
    const bad = { ...valid, locale: 'es-ES' };
    expect(() => signupSchema.parse(bad)).toThrow();
  });

  it('safeParseSignup returns success structure on valid', () => {
    const r = safeParseSignup(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('user@example.com');
  });

  it('safeParseSignup returns errors structure on invalid', () => {
    const r = safeParseSignup({ ...valid, password: 'weak' });
    expect(r.success).toBe(false);
  });
});
```

### 7.3 Tests : `repo/packages/auth/test/schemas/mfa.schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { mfaVerifySchema, mfaSetupConfirmSchema, mfaDisableSchema } from '../../src/schemas/mfa.schema.js';

describe('mfaVerifySchema', () => {
  it('accepts totp_code 6 digits', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), totp_code: '123456' }),
    ).not.toThrow();
  });

  it('accepts recovery_code 10 alphanumeric uppercase', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), recovery_code: 'ABC123XYZ7' }),
    ).not.toThrow();
  });

  it('rejects when both totp_code and recovery_code are provided', () => {
    expect(() =>
      mfaVerifySchema.parse({
        challenge_token: 'a'.repeat(40),
        totp_code: '123456',
        recovery_code: 'ABC123XYZ7',
      }),
    ).toThrow();
  });

  it('rejects when neither totp_code nor recovery_code is provided', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40) }),
    ).toThrow();
  });

  it('rejects totp_code with letters', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), totp_code: '12345A' }),
    ).toThrow();
  });

  it('rejects totp_code with 5 or 7 digits', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), totp_code: '12345' }),
    ).toThrow();
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), totp_code: '1234567' }),
    ).toThrow();
  });

  it('rejects recovery_code lowercase', () => {
    expect(() =>
      mfaVerifySchema.parse({ challenge_token: 'a'.repeat(40), recovery_code: 'abc123xyz7' }),
    ).toThrow();
  });
});

describe('mfaSetupConfirmSchema', () => {
  it('accepts valid setup confirmation', () => {
    expect(() =>
      mfaSetupConfirmSchema.parse({ setup_token: 's'.repeat(40), totp_code: '123456' }),
    ).not.toThrow();
  });

  it('rejects setup_token too short', () => {
    expect(() =>
      mfaSetupConfirmSchema.parse({ setup_token: 'short', totp_code: '123456' }),
    ).toThrow();
  });
});

describe('mfaDisableSchema', () => {
  it('accepts valid disable payload', () => {
    expect(() =>
      mfaDisableSchema.parse({ current_password: 'StrongP@ssw0rd!', totp_code: '123456' }),
    ).not.toThrow();
  });

  it('rejects without current_password', () => {
    expect(() =>
      mfaDisableSchema.parse({ totp_code: '123456' }),
    ).toThrow();
  });
});
```

### 7.4 Tests : `repo/packages/auth/test/constants/argon2-params.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ARGON2_PARAMS, PASSWORD_POLICY } from '../../src/constants/argon2-params.js';

describe('ARGON2_PARAMS', () => {
  it('uses argon2id algorithm', () => {
    expect(ARGON2_PARAMS.algorithm).toBe('argon2id');
  });

  it('meets OWASP 2024 minimums', () => {
    expect(ARGON2_PARAMS.memoryCost).toBeGreaterThanOrEqual(65536);
    expect(ARGON2_PARAMS.timeCost).toBeGreaterThanOrEqual(3);
    expect(ARGON2_PARAMS.parallelism).toBeGreaterThanOrEqual(1);
    expect(ARGON2_PARAMS.hashLength).toBeGreaterThanOrEqual(32);
    expect(ARGON2_PARAMS.saltLength).toBeGreaterThanOrEqual(16);
  });

  it('is frozen at runtime', () => {
    expect(Object.isFrozen(ARGON2_PARAMS)).toBe(true);
    expect(() => {
      (ARGON2_PARAMS as unknown as { memoryCost: number }).memoryCost = 1024;
    }).toThrow();
  });
});

describe('PASSWORD_POLICY', () => {
  it('mandates strict criteria', () => {
    expect(PASSWORD_POLICY.minLength).toBeGreaterThanOrEqual(12);
    expect(PASSWORD_POLICY.requireUppercase).toBe(true);
    expect(PASSWORD_POLICY.requireLowercase).toBe(true);
    expect(PASSWORD_POLICY.requireDigit).toBe(true);
    expect(PASSWORD_POLICY.requireSpecial).toBe(true);
    expect(PASSWORD_POLICY.banlistEnabled).toBe(true);
  });
});
```

### 7.5 Tests integration : `repo/packages/auth/test/integration/module.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuthModule } from '../../src/auth.module.js';

describe('AuthModule (integration smoke)', () => {
  it('compiles a NestJS test module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();
    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });

  it('declares @Global() decorator', () => {
    const metadata = Reflect.getMetadata('__module:global__', AuthModule);
    expect(metadata).toBe(true);
  });

  it('imports without errors when re-included multiple times', async () => {
    const m1 = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    const m2 = await Test.createTestingModule({ imports: [AuthModule] }).compile();
    expect(m1).toBeDefined();
    expect(m2).toBeDefined();
    await Promise.all([m1.close(), m2.close()]);
  });
});
```

---

## 8. Variables environnement

A cette tache, AUCUNE variable d'environnement nouvelle n'est requise. Les variables seront introduites progressivement par les taches suivantes. La liste de reference complete est documentee dans `00-pilotage/documentation/2-variables-environnement.env`. A des fins de tracabilite et pour eviter les surprises lors des taches suivantes, voici les variables qui seront necessaires au Sprint 5 (introduites par 2.1.2 a 2.1.15) :

```env
# Tache 2.1.2 (Argon2Service)
PASSWORD_PEPPER=replace-with-32+chars-random-pepper-do-not-leak
PASSWORD_PEPPER_VERSION=1

# Tache 2.1.3 (EncryptionService, HashingService)
MFA_SECRET_ENCRYPTION_KEY=replace-with-exactly-32-chars-key
HMAC_WEBHOOK_KEY=replace-with-32+chars-key

# Tache 2.1.4 (JwtService)
JWT_SECRET=replace-with-min-64-chars-base64url-key
JWT_ISSUER=skalean-insurtech-api
JWT_AUDIENCE=skalean-insurtech-app
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=2592000
JWT_LEEWAY_SECONDS=5

# Tache 2.1.5 (SessionService)
REDIS_SESSIONS_DB=1
SESSION_DEFAULT_TTL_SECONDS=28800
SESSION_REMEMBER_ME_TTL_SECONDS=2592000

# Tache 2.1.7 (MfaService)
MFA_TOTP_ISSUER=Skalean InsurTech
MFA_TOTP_PERIOD_SECONDS=30
MFA_TOTP_DIGITS=6
MFA_TOTP_WINDOW=1
MFA_RECOVERY_CODES_COUNT=6

# Tache 2.1.10 (LockoutService)
REDIS_LOCKOUTS_DB=2
LOCKOUT_TIER1_DURATION_MS=300000
LOCKOUT_TIER2_DURATION_MS=900000
LOCKOUT_TIER3_DURATION_MS=3600000
LOCKOUT_FAILED_ATTEMPTS_PER_TIER=5

# Tache 2.1.13 (EmailService)
SMTP_HOST=smtp.example.ma
SMTP_PORT=587
SMTP_USER=noreply@skalean.ma
SMTP_PASSWORD=replace
SMTP_FROM_ADDRESS=noreply@skalean.ma
SMTP_FROM_NAME=Skalean InsurTech

# Tache 2.1.14 (RateLimit)
REDIS_RATE_LIMIT_DB=3
RATE_LIMIT_LOGIN_PER_MINUTE=5
RATE_LIMIT_SIGNUP_PER_HOUR=3
RATE_LIMIT_RECOVERY_PER_HOUR=3

# Sprint 5 commun
NODE_ENV=development
APP_BASE_URL=https://api.skalean.ma
PUBLIC_BASE_URL=https://app.skalean.ma
LOG_LEVEL=info
```

Pour cette tache 2.1.1, le test `module.spec.ts` ne necessite aucune variable d'environnement (le module ne charge aucun config).

---

## 9. Commandes shell

```bash
# 1. Se positionner dans le repo
cd repo

# 2. Verifier que la structure du package est en place (depuis Sprint 1 stub)
ls packages/auth/

# 3. Mettre a jour package.json (etape manuelle ou via scripts/init-auth-package.ts)
cp /dev/null packages/auth/package.json
# (puis editer avec le contenu de la section 6.1)

# 4. Creer la structure de dossiers
mkdir -p packages/auth/src/types packages/auth/src/schemas packages/auth/src/constants
mkdir -p packages/auth/test/types packages/auth/test/schemas packages/auth/test/constants packages/auth/test/integration

# 5. Creer les fichiers (un par un selon la section 6 du present prompt)

# 6. Installer les deps
pnpm install --frozen-lockfile

# 7. Verifier la compilation TypeScript
pnpm --filter @insurtech/auth typecheck

# 8. Linter
pnpm --filter @insurtech/auth lint

# 9. Lancer les tests
pnpm --filter @insurtech/auth test

# 10. Construire le package
pnpm --filter @insurtech/auth build

# 11. Verifier les exports publics
node -e "import('@insurtech/auth').then(m => console.log(Object.keys(m).sort()))"

# 12. Verifier no-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/auth/src packages/auth/test || echo "OK no emoji"

# 13. Verifier no-console
grep -rn "console\.\(log\|debug\|info\|warn\|error\)" packages/auth/src --include="*.ts" || echo "OK no console"
```

---

## 10. Criteres validation V1-V32

### Criteres P0 (bloquants -- 18)

- **V1 (P0 -- automatisable)** : `pnpm --filter @insurtech/auth typecheck` retourne exit 0.
  - Commande : `cd repo && pnpm --filter @insurtech/auth typecheck`
  - Expected : exit 0, aucune erreur TypeScript.
  - Failure mode : erreur strict ou type manquant -> verifier que `tsconfig.base.json` est etendu et `strict: true`.

- **V2 (P0 -- automatisable)** : `pnpm --filter @insurtech/auth build` retourne exit 0 et produit `dist/index.js` + `dist/index.d.ts`.
  - Commande : `pnpm --filter @insurtech/auth build && ls packages/auth/dist/index.{js,d.ts}`
  - Expected : 2 fichiers presents.

- **V3 (P0 -- automatisable)** : `pnpm --filter @insurtech/auth lint:check` retourne exit 0.
  - Commande : `pnpm --filter @insurtech/auth lint:check`
  - Expected : aucune erreur Biome.

- **V4 (P0 -- automatisable)** : `pnpm --filter @insurtech/auth test` passe avec exit 0 et 35+ tests passants.
  - Commande : `pnpm --filter @insurtech/auth test`
  - Expected : `Test Files X passed` et `Tests Y passed (Y >= 35)`.

- **V5 (P0)** : Le package exporte exactement 12 valeurs `AuthRole`.
  - Commande : `node -e "const m = await import('@insurtech/auth'); console.log(Object.keys(m.AuthRole).length)"`
  - Expected : `12`.

- **V6 (P0)** : Les noms d'enum sont les valeurs exactes attendues.
  - Test deja couvert par `auth-roles.spec.ts` via V4.

- **V7 (P0)** : Tous les schemas Zod sont exposes au niveau top-level.
  - Commande : `node -e "const m = await import('@insurtech/auth'); console.log(['signupSchema','signinSchema','mfaVerifySchema','refreshSchema','recoveryRequestSchema','recoveryConfirmSchema','changePasswordSchema','verifyEmailSchema','mfaSetupConfirmSchema','mfaDisableSchema'].every(n => n in m))"`
  - Expected : `true`.

- **V8 (P0)** : Les constantes ARGON2_PARAMS, JWT_PARAMS, MFA_PARAMS, LOCKOUT_TIERS sont exposees et frozen.
  - Test deja couvert par `argon2-params.spec.ts`.

- **V9 (P0)** : ARGON2_PARAMS.memoryCost >= 65536 (OWASP 2024 minimum).
  - Test V4.

- **V10 (P0)** : ARGON2_PARAMS.timeCost >= 3.
  - Test V4.

- **V11 (P0)** : ARGON2_PARAMS.algorithm === 'argon2id'.
  - Test V4.

- **V12 (P0)** : signupSchema rejette les champs inconnus (strict).
  - Test V4.

- **V13 (P0)** : signupSchema.accepted_tos exige true literal.
  - Test V4.

- **V14 (P0)** : signupSchema.email rejette homograph cyrillic.
  - Test V4.

- **V15 (P0)** : signupSchema.password exige >= 12 chars + 4 classes.
  - Test V4.

- **V16 (P0)** : mfaVerifySchema rejette si totp_code et recovery_code coexistent.
  - Test V4.

- **V17 (P0)** : `AuthModule` est decore `@Global()`.
  - Commande : `pnpm --filter @insurtech/auth test test/integration/module.spec.ts`
  - Expected : test V4 (case "declares @Global() decorator") passe.

- **V18 (P0)** : Aucun `export *` dans les sous-barrels (sauf `src/index.ts` racine qui re-exporte les barrels).
  - Commande : `grep -rn "export \*" packages/auth/src --include="*.ts" | grep -v "src/index.ts"`
  - Expected : aucune sortie.

### Criteres P1 (importants -- 9)

- **V19 (P1)** : Les helpers `nowInSeconds`, `expirySeconds`, `isExpired` sont exportes et fonctionnels.
  - Test V4.

- **V20 (P1)** : Les type guards `isPlatformRole`, `isTenantRole`, `isMfaMandatory` retournent exactement les valeurs attendues pour chacun des 12 roles.
  - Test V4 (couvre les 12 roles).

- **V21 (P1)** : Les schemas Zod produisent des messages d'erreur lisibles (texte non vide).
  - Test V4 (toThrow avec regex sur message).

- **V22 (P1)** : Aucun string role hardcode hors de `auth-roles.ts`.
  - Commande : `grep -rn "'broker_admin'\|'broker_user'\|'garage_admin'\|'super_admin_platform'" packages/auth/src --include="*.ts" | grep -v "auth-roles.ts"`
  - Expected : aucune sortie.

- **V23 (P1)** : `package.json` `engines.node` >= 22.11.0.
  - Commande : `node -e "const p = require('./packages/auth/package.json'); console.log(p.engines.node)"`
  - Expected : `>=22.11.0`.

- **V24 (P1)** : `package.json` `exports` field declare uniquement `"."`.
  - Commande : `node -e "const p = require('./packages/auth/package.json'); console.log(Object.keys(p.exports))"`
  - Expected : `[ '.' ]`.

- **V25 (P1)** : Aucune emoji dans aucun fichier livre.
  - Commande : `grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/auth/src packages/auth/test`
  - Expected : aucune sortie.

- **V26 (P1)** : Aucun `console.log` dans `src/`.
  - Commande : `grep -rn "console\.\(log\|debug\|info\|warn\|error\)" packages/auth/src --include="*.ts"`
  - Expected : aucune sortie.

- **V27 (P1)** : Coverage Vitest >= 90% sur les fichiers livres.
  - Commande : `pnpm --filter @insurtech/auth test:coverage && cat packages/auth/coverage/coverage-summary.json | jq '.total.lines.pct'`
  - Expected : >= 90.

### Criteres P2 (nice-to-have -- 5)

- **V28 (P2)** : `tsconfig.json` declare composite=true et tsBuildInfoFile.
  - Commande : `node -e "const t = require('./packages/auth/tsconfig.json'); console.log(t.compilerOptions.composite, t.compilerOptions.tsBuildInfoFile)"`
  - Expected : `true dist/.tsbuildinfo`.

- **V29 (P2)** : `auth.module.ts` reference les taches futures via commentaires (auto-suffisant pour Claude Code).
  - Commande : `grep -c "Tache 2.1." packages/auth/src/auth.module.ts`
  - Expected : >= 13.

- **V30 (P2)** : Tous les fichiers ont un en-tete de commentaire JSDoc decrivant le module.
  - Commande : `for f in packages/auth/src/**/*.ts; do head -3 "$f" | grep -q "/\*\*" || echo "MISSING $f"; done`
  - Expected : aucune sortie.

- **V31 (P2)** : Le fichier `auth-roles.ts` documente la hierarchie dans son JSDoc.
  - Commande : `head -30 packages/auth/src/types/auth-roles.ts | grep -c "Hierarchy"`
  - Expected : >= 1.

- **V32 (P2)** : `pnpm --filter @insurtech/auth clean && pnpm --filter @insurtech/auth build` rebuild propre en < 10s.
  - Commande : `cd repo && time (pnpm --filter @insurtech/auth clean && pnpm --filter @insurtech/auth build)`
  - Expected : `real < 10s`.

---

## 11. Edge cases + troubleshooting

### Edge case 1 : Build TypeScript echoue avec "Cannot find module 'reflect-metadata'"

Scenario : un developpeur execute `pnpm --filter @insurtech/auth build` et obtient une erreur TS2307.
Probleme : le package consomme NestJS qui depend de `reflect-metadata`, mais ce module n'est importe nulle part dans le code (les decorateurs NestJS le requierent au runtime mais TypeScript ne le voit pas).
Solution : ajouter `import 'reflect-metadata';` en tete de `src/auth.module.ts` ET declarer `reflect-metadata` dans `dependencies` (pas seulement `peerDependencies`). Le `package.json` de la section 6.1 declare deja ce point.

### Edge case 2 : Vitest echoue avec "Decorators are not valid here"

Scenario : `pnpm test` echoue sur le module.spec.ts.
Probleme : Vitest avec esbuild ne supporte pas par defaut les decorateurs experimentaux ; il faut un preset.
Solution : creer `repo/packages/auth/vitest.config.ts` avec `esbuild: { tsconfigRaw: { compilerOptions: { experimentalDecorators: true, emitDecoratorMetadata: true } } }`. Ajouter ce fichier au livrable supplement.

### Edge case 3 : Un autre package du monorepo importe `@insurtech/auth/internal/...`

Scenario : `apps/api` importe `import { Argon2Service } from '@insurtech/auth/services/argon2.service'`.
Probleme : le `exports` field declare uniquement `"."`, ce qui DEVRAIT bloquer ce sous-chemin a runtime ; mais TypeScript ne lit pas `exports` par defaut, donc l'import compile mais echoue a runtime.
Solution : verifier dans CI (Sprint 6+) via un script `scripts/check-public-imports.ts` qui parse tous les imports `@insurtech/auth/*` du monorepo et echoue si l'un d'eux n'est pas l'import racine.

### Edge case 4 : Enum `AuthRole` muable accidentellement.

Scenario : un test fait `AuthRole.BrokerAdmin = 'something' as AuthRole;` (TypeScript en mode lax peut permettre).
Probleme : enum TypeScript regular est mutable a runtime ; si un test mutate sans cleanup, les tests suivants voient une enum corrompue.
Solution : convention -- aucun test ne modifie un enum. Le critere V4 verifie indirectement via tests qui depend d'enum stable. Pour blindage supplementaire, on peut faire `Object.freeze(AuthRole)` apres declaration. NON adopte ici car pourrait casser certains tooling Reflection NestJS ; signal cas a evaluer Sprint 7.

### Edge case 5 : `signupSchema` accepte un email avec espaces.

Scenario : front-end envoie `email: " user@example.com "`.
Probleme : sans `.trim()`, le schema accepte tel quel et un duplicate avec/sans espaces peut creer un compte.
Solution : le schema utilise `.trim().toLowerCase()` qui normalise. Test V4 verifie.

### Edge case 6 : Un schema Zod accepte un string avec NULL byte (`\0`).

Scenario : un attaquant envoie `email: "user@example.com extra"`.
Probleme : certains parsers downstream peuvent traiter `\0` comme terminateur de string et accepter "user@example.com" -- bypass de la validation longueur.
Solution : ajouter `.refine(s => !s.includes(' '))` sur tous les champs string critiques. Ce raffinement est ajoute Tache 2.1.6 dans le AuthService au lieu d'ici (pour rester focused sur les contrats).

### Edge case 7 : `getRoleHierarchy(invalidRole as AuthRole)` jette a runtime.

Scenario : appel via `getRoleHierarchy(req.body.role)` ou role est un string brut.
Probleme : le switch a un `default` qui throw, ce qui peut crasher la requete.
Solution : avant tout appel a `getRoleHierarchy`, valider `req.body.role` via `z.nativeEnum(AuthRole).parse(...)`. Documente dans Tache 2.1.6 AuthController.

### Edge case 8 : `JwtPayload.exp` confondu avec millisecondes.

Scenario : un developpeur Sprint 5 Tache 2.1.4 ecrit `payload.exp = Date.now() + 900000` au lieu de `nowInSeconds() + 900`.
Probleme : a la verification, `payload.exp` est tres grand mais `nowInSeconds()` est en secondes ; le token est considere valide pour 28000 ans -- tres mauvais.
Solution : helper `expirySeconds(900)` rend le pattern obligatoire et lisible. Le critere V4 (test sur expirySeconds) verifie.

### Edge case 9 : `AuthModule` re-importe par plusieurs modules.

Scenario : Sprint 7 RBAC declare `imports: [AuthModule]` dans son module, alors que AuthModule est `@Global()`.
Probleme : NestJS gere correctement (ignore le re-import), mais le code source est bruite.
Solution : convention -- jamais re-importer un module marque `@Global()`. Document dans le commentaire de tete de auth.module.ts.

### Edge case 10 : `mfaVerifySchema` accepte totp_code = "000000".

Scenario : un attaquant envoie `totp_code: '000000'` esperant matcher un TOTP courant.
Probleme : le schema accepte (regex `/^\d{6}$/` matche). C'est correct au niveau schema -- la verification crypto se fait Tache 2.1.7.
Solution : aucune action au niveau schema. Tache 2.1.7 utilise `otplib.authenticator.check(token, secret)` qui calcule le TOTP courant et compare en constant-time. "000000" ne matchera pas sauf collision incidente (probabilite 1/1M).

### Edge case 11 : `package.json` `version` non bump entre Sprint 5 et Sprint 6.

Scenario : Sprint 6 ajoute `TenantContext` mais oublie de bump `0.1.0` -> `0.2.0`.
Probleme : pnpm lockfile ne signale pas le changement ; potentiel cache mismatch sur Turborepo cache distant.
Solution : convention -- chaque sprint qui modifie un package shared bump la version mineure (ou patch si retrocompatible). Ajouter au CI Sprint 35 un check `git diff` qui verifie bump version si fichier modifie.

### Edge case 12 : `signinSchema.remember_me` non envoye -> default applique.

Scenario : un client mobile envoie `{ email, password }` sans `remember_me`.
Probleme : le schema a `default(false)` ; le client ne sait pas que false est applique.
Solution : OK car comportement attendu est "session courte par defaut, longue uniquement si demande explicitement". Documente dans OpenAPI Sprint 33.

### Edge case 13 : Les tests integration `module.spec.ts` echouent sur Node 22.10 (juste sous 22.11).

Scenario : un developpeur a Node 22.10 localement.
Probleme : `engines.node >=22.11.0` declare, mais pnpm avec `engine-strict=true` (Sprint 1) bloquera l'install.
Solution : message d'erreur explicite a l'install. Le developpeur upgrade Node via nvm.

---

## 12. Conformite Maroc detaillee

### 12.1 Loi 09-08 CNDP (Protection des donnees a caractere personnel)

Article 23 : "Toute personne dispose du droit a la securite des donnees".

Implementation a cette tache :
- La constante `ARGON2_PARAMS` materialise un hash robuste (Argon2id OWASP 2024) qui depasse l'etat de l'art exige pour proteger les mots de passe (donnee a caractere personnel sensible).
- Le schema `signupSchema` rejette tout champ supplementaire (`.strict()`), evitant le mass assignment d'attributs sensibles non declares.
- Le schema `signinSchema` ne loggue jamais le password (le service AuthService Tache 2.1.6 strip explicitement le champ avant tout log).

Article 21 : "Notification des violations de donnees personnelles dans 72h".

Implementation differee :
- Cette tache prepare la structure `AuthEventEnvelope` qui sera publiee sur Kafka par Tache 2.1.12 (AuditAuthService). Sprint 33 (compliance) consommera ces events pour declencher la notification CNDP automatiquement en cas de signaux compromission (replay refresh detecte, lockout massif, etc.).

Reference : `00-pilotage/decisions/decision-008-data-residency-maroc.md`.

### 12.2 Loi 53-05 (Echanges electroniques de donnees juridiques)

Article 6 : "L'identification des parties dans un echange electronique securise".

Implementation :
- Le contrat `JwtPayload` inclut `sub` (user_id), `email`, `role`, `tenant_id`, `mfa_verified` -- l'identification complete de la partie est embeddee dans chaque token.
- La rotation refresh + theft detection (Sprint 5 Tache 2.1.4) garantit l'integrite de la session signataire.

### 12.3 ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)

Circulaire 2024 : exige MFA obligatoire pour les acteurs metier d'une compagnie d'assurance (broker_admin, garage_admin assimile expert).

Implementation a cette tache :
- Le helper `isMfaMandatory()` retourne `true` pour `broker_admin` et `garage_admin` (en plus des roles platform). Ce helper sera consomme Tache 2.1.9 (signup) pour forcer l'enrolement MFA des l'inscription pour ces roles.

---

## 13. Conventions absolues skalean-insurtech (rappel complet)

Cette tache DOIT respecter TOUTES les conventions transverses :

### 13.1 Multi-tenant strict

Header `x-tenant-id` n'est PAS verifie a cette tache (le package `@insurtech/auth` n'expose aucun endpoint operationnel ; ses types decrivent simplement la forme du JwtPayload qui contient `tenant_id`). Le contrat est etabli ; la verification operationnelle se fait Sprint 6 (TenantGuard).

### 13.2 Validation strict

Zod uniquement pour validation runtime. Aucun usage de class-validator, yup, joi, ajv. Tous les schemas sont co-localises dans `src/schemas/` et exportes via barrel selectif. Pattern : `const Schema = z.object({...}).strict(); type Type = z.infer<typeof Schema>;`.

### 13.3 Logger strict

Pino via `this.logger.info(...)` est la regle pour les services NestJS (Tache 2.1.6+). A cette tache, aucun service n'est implemente -- aucun logger n'est utilise. Aucun `console.log()` non plus (verifie V26).

### 13.4 Hash password strict

argon2id avec params `memoryCost: 65536, timeCost: 3, parallelism: 4`. La constante `ARGON2_PARAMS` materialise ce contrat. Tache 2.1.2 implementera le service utilisateur de cette constante.

### 13.5 Package manager strict

pnpm uniquement. La declaration `"engines": { "pnpm": ">=9.15.0" }` impose. `package.json` declare `"private": true` pour empecher publication accidentelle NPM.

### 13.6 TypeScript strict

`strict: true` heritage de `tsconfig.base.json`. `noUncheckedIndexedAccess: true`, `noImplicitAny: true`. Tous les types exportes sont explicites. Aucun `any` implicite.

### 13.7 Tests strict

Vitest pour unit + integration. Chaque fichier `.ts` (sauf types-only et index.ts) DOIT avoir un `.spec.ts` associe. A cette tache :
- `auth-roles.ts` -> `auth-roles.spec.ts` (12 tests + helpers).
- `signup.schema.ts` -> `signup.schema.spec.ts` (8 tests).
- `signin.schema.ts` -> `signin.schema.spec.ts` (6 tests).
- `mfa.schema.ts` -> `mfa.schema.spec.ts` (8 tests).
- `refresh.schema.ts` -> `refresh.schema.spec.ts` (4 tests).
- `recovery.schema.ts` -> `recovery.schema.spec.ts` (6 tests).
- `argon2-params.ts` -> `argon2-params.spec.ts` (4 tests).
- `jwt-params.ts` -> `jwt-params.spec.ts` (5 tests).
- `lockout-tiers.ts` -> `lockout-tiers.spec.ts` (5 tests).
- `auth.module.ts` -> `module.spec.ts` (3 smoke tests).

Total : 65 tests minimum.

### 13.8 RBAC strict

Pas applicable a cette tache (pas d'endpoint). Sprint 7 ajoutera les `@Roles()` decorateurs sur les endpoints AuthController de Tache 2.1.6.

### 13.9 Events strict

A cette tache, on declare `AuthEventEnvelope` et `AuthEventKind` (22 valeurs). Topics Kafka format : `insurtech.events.auth.{event_kind}` (par exemple `insurtech.events.auth.signin_success`). Tache 2.1.12 implementera la publication.

### 13.10 Imports strict

Tous les imports cross-package utilisent `@insurtech/{nom}`. A cette tache : aucun import cross-package n'est requis (le package est self-contained sauf pour `@insurtech/shared-types` declare via `references` tsconfig).

### 13.11 Skalean AI strict (decision-005)

Pas applicable a cette tache. La structure `ServiceJwtPayload` prevoit l'extension Sprint 31.

### 13.12 No-emoji strict (decision-006 ABSOLU)

AUCUNE emoji dans aucun fichier. Verifie V25.

### 13.13 Idempotency-Key strict

Pas applicable a cette tache (pas d'endpoint mutant). Sprint 5 Tache 2.1.6 ajoutera le header obligatoire pour POST /signup, POST /change-password, etc.

### 13.14 Conventional Commits strict

Format : `feat(sprint-05): init @insurtech/auth package with types schemas constants`. Body avec metadata Task/Sprint/Phase. Detail section 15.

### 13.15 Cloud souverain MA strict (decision-008)

Pas applicable a cette tache (aucune donnee n'est stockee). Les tokens JWT seront emis Sprint 5 Tache 2.1.4 et stockes hashes Redis Atlas Cloud Services Benguerir Sprint 35.

---

## 14. Validation pre-commit

```bash
cd repo

# 1. TypeScript strict
pnpm --filter @insurtech/auth typecheck                                  # 0 erreur

# 2. Lint Biome
pnpm --filter @insurtech/auth lint:check                                 # 0 erreur

# 3. Tests Vitest
pnpm --filter @insurtech/auth test                                       # 35+ tests passent

# 4. Coverage >= 90%
pnpm --filter @insurtech/auth test:coverage                              # >= 90%

# 5. Build
pnpm --filter @insurtech/auth build                                      # dist/ produit

# 6. No-emoji
grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" packages/auth/src packages/auth/test && exit 1 || echo "OK no emoji"

# 7. No-console
grep -rn "console\.\(log\|debug\|info\|warn\|error\)" packages/auth/src --include="*.ts" && exit 1 || echo "OK no console"

# 8. No hardcoded role strings hors auth-roles.ts
grep -rn "'broker_admin'\|'garage_admin'\|'super_admin_platform'\|'assure'" packages/auth/src --include="*.ts" | grep -v "auth-roles.ts" && exit 1 || echo "OK no hardcoded roles"

# 9. No export * dans sous-barrels
grep -rn "export \*" packages/auth/src --include="*.ts" | grep -v "src/index.ts" && exit 1 || echo "OK barrels selectifs"

# 10. Verifier exports publics attendus
node -e "const m = await import('@insurtech/auth'); ['AuthRole','signupSchema','signinSchema','mfaVerifySchema','ARGON2_PARAMS','PASSWORD_POLICY','AuthModule'].forEach(k => { if (!(k in m)) { console.error('MISSING', k); process.exit(1); }}); console.log('OK exports');"
```

---

## 15. Commit message complet

```bash
git add -A
git commit -m "feat(sprint-05): init @insurtech/auth package contracts and skeleton

Initialise the @insurtech/auth package with the complete contractual
foundation : 12-role enum AuthRole, JwtPayload + RefreshTokenPayload +
ServiceJwtPayload typed shapes, AuthEventKind enum (22 events), 10 Zod
schemas (signup, signin, mfa setup/verify/disable, refresh, recovery
request/confirm, change-password, verify-email), frozen ARGON2_PARAMS
matching OWASP 2024 minimums, JWT_PARAMS, MFA_PARAMS, LOCKOUT_TIERS,
RATE_LIMIT_TIERS, SESSION_TTL_TIERS, EMAIL_REGEX (anti homograph), and
the skeleton @Global() AuthModule that the 14 follow-up tasks of
Sprint 5 will progressively enrich.

Livrables :
- 27 fichiers source (types, schemas, constants, module, barrels)
- 10 fichiers tests (65+ tests Vitest)
- package.json restricted with sideEffects=false and exports field
- tsconfig.json composite with reference to @insurtech/shared-types

Tests : 65+ unit + 3 integration smoke = 68 tests passing
Coverage : >= 90% lines

Task: 2.1.1
Sprint: 5 (Phase 2 / Sprint 1)
Phase: 2 -- Securite & Multi-tenant
Reference: B-05 Tache 2.1.1
Decisions: decision-007 (Zod), decision-013 (Argon2id), decision-014 (JWT HS256)"
```

---

## 16. Workflow next step

Apres commit de cette tache 2.1.1, passer a `task-2.1.2-argon2id-service.md` qui implementera l'`Argon2Service` operationnel consommant les constantes `ARGON2_PARAMS` et `PASSWORD_POLICY` definies ici, avec hash, verify, needsRehash, validatePolicy, et integration de la banlist 1000 mots de passe leakes.

---

**Fin du prompt task-2.1.1-init-auth-package.md.**
