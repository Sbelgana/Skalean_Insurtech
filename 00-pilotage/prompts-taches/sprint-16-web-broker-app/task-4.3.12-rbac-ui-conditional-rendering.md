# TACHE 4.3.12 -- RBAC UI : Conditional Rendering Features Per Role + Permission Helpers

**Sprint** : 16 (Phase 4 / Sprint 3 dans phase Vertical Insure)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-16-sprint-16-web-broker-app.md` (Tache 4.3.12)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Priorite** : P0
**Effort** : 4h
**Dependances** : task-4.3.11 (Parametres + Profile pages), Sprint 7 (RBAC backend : 12 roles + 85 permissions + PermissionGuard NestJS), Sprint 5 (Auth JWT + refresh)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Implementer la couche **RBAC UI** (Role-Based Access Control cote interface) pour l'application `web-broker` Next.js 15 sur le port 3001. Cette tache fournit les **hooks React**, **components conditionnels** et **HOCs** permettant d'afficher ou masquer dynamiquement des elements d'interface selon le role et les permissions de l'utilisateur authentifie. Trois roles broker sont supportes (broker_admin avec acces complet, broker_user limite operationnel, broker_assistant lecture+create restreint), pour un total de 29 permissions effectivement consommees par l'UI broker (sous-ensemble des 85 permissions du catalogue Sprint 7).

L'objectif precis est de poser une **API ergonomique et type-safe** : `usePermission('crm.contacts.delete')` retourne un boolean, `<HasPermission permission="...">` cache ses enfants si manque, `<RequirePermission>` redirige vers `/403`, le tout fonde sur un decodage JWT client-side via la lib `jose` (verification signature deja faite cote serveur, ici on extrait juste les claims). La couche UI sert d'optimisation UX (cacher ce qui est inutile) -- la **defense en profondeur reste cote backend** : le `PermissionGuard` NestJS du Sprint 7 rejette toute requete 403 meme si l'UI envoie. Aucune logique securite reelle ne repose sur l'UI.

A la sortie de cette tache, les developpeurs peuvent wrapper n'importe quel composant avec `<HasPermission>` ou `<HasRole>`, l'app affiche correctement les 3 scenarios de role distincts (broker_admin voit Parametres + Cancel Policy + Invite Users ; broker_user voit Validate Queue + Delete Contact mais pas Parametres ; broker_assistant voit lecture seule sans delete), un curl bypass UI sur backend echoue toujours en 403 (audit-trace Sprint 7), 25 tests Vitest passent + 10 tests Playwright E2E couvrent les 3 roles avec scenarios reels. Cette tache bloque 4.3.13 (i18n complete) et fournit les helpers reutilises tels quels par Sprint 17 (customer-portal), Sprint 22 (garage app), Sprint 27 (admin-portal).

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

Le programme Skalean InsurTech adopte une architecture **multi-tenant RBAC granulaire** definie au Sprint 7 (taches 2.3.1 a 2.3.5) : 12 roles transverses sur l'ensemble des verticales (broker, garage, assure, admin, agent ACAPS, expert sinistre, etc.) et 85 permissions atomiques nommees selon convention `{vertical}.{ressource}.{action}` (e.g. `crm.contacts.delete`, `insure.policies.cancel`, `repair.sinistres.read`). Sprint 7 livre cote backend : table `roles`, table `permissions`, table `role_permissions` (matrice many-to-many), table `user_roles` (assignation utilisateur dans contexte tenant), guard NestJS `@RequirePermissions('crm.contacts.delete')` qui rejette en 403 si manque, et inclusion des permissions dans le JWT access_token sous claim `permissions: string[]`.

Cote frontend, le besoin est triple :

1. **UX coherente** : un broker_assistant qui ne peut pas supprimer un contact ne doit pas voir le bouton "Delete" -- sinon il clique, le backend rejette, il a une mauvaise experience. Cacher les boutons inutiles **ameliore la decouvrabilite** des fonctionnalites disponibles.

2. **Performance** : eviter de fetcher des donnees auxquelles l'utilisateur n'a pas droit (e.g. ne pas appeler `GET /tenant/users` si pas `tenant.users.read`). Reduire les appels API inutiles et les 403 logges en boucle.

3. **Coherence multi-app** : les 8 apps frontend (broker, garage, assure, customer-portal, admin) doivent partager **le meme pattern RBAC**. Cette tache pose le pattern canonique reutilise tel quel partout, evitant 8x reinvention de roue.

L'app `web-broker` etant la premiere a livrer (Sprint 16, soit avant garage Sprint 22 et admin Sprint 27), elle joue le **role de patron canonique**. La structure de hooks + components definie ici sera copiee verbatim dans les 4 autres apps frontend metier. Toute deviation declenche refactor cross-app couteux (cf. decision-001 monorepo + decision-006 patterns shares).

### Distinction critique : UI security vs Backend security

**L'UI ne fait JAMAIS d'autorisation reelle.** C'est une regle de defense en profondeur fondamentale dont la violation est un anti-pattern de securite critique (cf. OWASP Top 10 A01:2021 Broken Access Control).

Schema des deux couches :

```
+----------------------------------------------------------+
|  Couche 1 : UI Conditional Rendering (cette tache 4.3.12) |
|  - Optimisation UX (cacher boutons inutiles)              |
|  - Reduction appels API (gain perf)                       |
|  - JAMAIS source de verite securite                       |
|  - Trustable uniquement si Couche 2 valide aussi          |
+----------------------------------------------------------+
                            |
                            v JWT envoye
+----------------------------------------------------------+
|  Couche 2 : Backend Permission Guard (Sprint 7)            |
|  - SOURCE DE VERITE authoritative                          |
|  - Rejette 403 si user manque permission                   |
|  - Audit-log toute tentative refusee (decision-021)        |
|  - Resistante au tampering client (signature JWT verif)    |
+----------------------------------------------------------+
```

Si un utilisateur malicieux modifie son JWT cote client (impossible sans la cle de signature mais imaginons), il pourrait techniquement faire afficher les boutons cacher. Cependant des qu'il clique, la requete part vers le backend avec le JWT manipule -- la verification de signature `jwt.verify(token, secret)` cote serveur echoue, retour 401 immediat. Si le JWT est valide mais que la permission n'y est pas, `PermissionGuard` Sprint 7 retourne 403 avec audit-log `permission_denied` (table `audit_events`, decision-021).

Le test V8 critique de cette tache : `curl -X DELETE /api/v1/crm/contacts/:id -H "Authorization: Bearer ${broker_assistant_token}"` doit retourner **403** meme si l'UI bypass via DevTools.

### Alternatives considerees

#### Approche A : Hooks + Context (CHOIX)

L'approche retenue : un Context React `PermissionContext` parse le JWT une seule fois au mount de l'app (cote client uniquement, le SSR n'a pas acces aux cookies httpOnly via `Document.cookie` -- on lit le JWT via une route API `/api/auth/me`), expose les permissions effectives dans le context, et les hooks `usePermission(p)` lisent ce context.

| Critere | Hooks + Context (CHOIX) | Approche alternative |
|---------|-------------------------|------------------------|
| Performance render | O(1) lookup Set | Recalcul a chaque render |
| Type safety | Permission union typee exhaustive | String litterale risquee |
| Testabilite | Mock Context facile | Mock global lourd |
| SSR compatibility | Client-only acceptable (donnees sensibles) | Hydration mismatch risk |
| Reusabilite cross-app | Pattern standard React | Coupling specifique |

#### Approche B : Zustand store global (rejete)

| Critere | Zustand store | Reason rejected |
|---------|---------------|------------------|
| Pattern dominant | Etat global moins React-idiomatique | Context plus standard |
| Persistance | localStorage = leak permissions sur shared device | Securite : pas de persist hors session |
| Boilerplate | Plus de code (store, action, getters) | Moins ergonomique |

Bien que zustand soit utilise pour `tenant-store.ts` et `ui-store.ts` (Sprint 4 task 1.4.1), les permissions sont **derivees du JWT** (source unique), donc le store ajouterait de la duplication d'etat. Context React + parsing JWT a chaque mount = source de verite unique alignee avec le cycle de vie d'authentification.

#### Approche C : Server Components only (rejete)

| Critere | Server Components | Reason rejected |
|---------|-------------------|------------------|
| Hooks support | Pas de hooks dans RSC | Limite |
| Conditional render | `if (await hasPermission()) { ... }` simple | Pas reactif |
| Re-render sur change | Refetch page complete obligatoire | UX lourde |
| Forms client-side | Forms = client component obligatoire | Incompatible |

Decision : **hybride** -- les conditional rendering majeurs (sidebar items) peuvent etre RSC (`async` component avec `await getServerPermissions()`), mais les boutons inline dans des formulaires/dialogs sont client components avec hooks. Le hook `usePermission` couvre 90% des cas.

#### Approche D : OPA (Open Policy Agent) policies (rejete)

| Critere | OPA | Reason rejected |
|---------|-----|------------------|
| Sophistication | Politiques Rego complexes | Overkill pour MVP |
| Latence | RPC OPA par check | Pas adapte UI inline |
| Maturite team | Apprentissage Rego | Pas dans roadmap 2026 |

OPA est utilise potentiellement cote backend pour des politiques complexes Sprint 28+ mais pas pour UI. RBAC simple roles+permissions suffit largement.

### Trade-offs explicites

1. **Permissions inline dans JWT** : Le JWT contient `permissions: string[]` (jusqu'a 30-40 entries pour broker_admin). Taille JWT inflated ~2 ko, acceptable pour HTTP/2. Alternative rejetee : permissions fetched separement via `/api/auth/me` = saut reseau supplementaire chaque page load.

2. **Pas de cache cross-session** : Les permissions ne sont JAMAIS stockees en localStorage (decision securite -- shared device risk). Recalculees a chaque mount via JWT decode. Cout : ~5ms parsing JWT, negligeable.

3. **JWT decode sans signature verify cote client** : La lib `jose` permet `decodeJwt(token)` qui extrait le payload SANS verifier la signature. C'est sain : la signature est verifiee par le backend a chaque requete. Cote client, on fait confiance au JWT pour l'**affichage** uniquement -- jamais pour l'autorisation reelle.

4. **3 roles broker scope** : Cette tache definit le mapping pour les 3 roles broker (admin/user/assistant). Les 9 autres roles du catalogue Sprint 7 (garage_owner, garage_mechanic, customer_individual, customer_company, expert_sinistre, agent_acaps, agent_skalean, super_admin_skalean, partner_partner) seront mappes dans leurs apps respectives (Sprint 22 garage, Sprint 27 admin).

5. **No emoji absolu (decision-006)** : Les messages d'erreur 403 page n'utilisent **aucun emoji** -- accents francais et caracteres arabes OK uniquement. Texte tonalite institutionnelle conforme contexte ACAPS.

6. **Permission denied UI accessible WCAG 2.1 AA** : La page 403 utilise `<div role="alert" aria-live="polite">` pour annoncer aux screen readers, focus management automatique sur l'heading, contraste 4.5:1 minimum.

7. **Locale-aware error messages** : Les messages 403 sont localises fr/ar-MA/ar avec keys `errors.permission_denied.title`, `errors.permission_denied.description`. Sprint 16 task 4.3.13 livrera la traduction complete -- ici on prepare la structure.

8. **Pas de telemetry permission_denied UI** : On ne loggue PAS un evenement Sentry chaque fois qu'un bouton est cache (volume tres eleve, pas d'interet operationnel). Seulement les 403 backend (audit-log Sprint 7) sont audites. Une visite de la page `/403` peut etre tracee en `pageview` standard.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : Les hooks RBAC vivent dans `repo/apps/web-broker/lib/auth/` et peuvent etre potentiellement extracts vers `repo/packages/shared-auth/` si reutilisation cross-app justifiee (probablement au Sprint 22 quand garage app reproduit le pattern).

- **decision-006 (NO EMOJI ABSOLU)** : Verification linter custom CI sur tous les fichiers UI (page 403, components auth, etc.).

- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : N/A pour cette tache (pas de stockage externe).

- **decision-009 (multilinguisme MA fr/ar-MA/ar)** : Messages page 403 localises trois locales.

- **decision-021 (audit-log immuable Tamper-evident)** : Toute tentative 403 backend ecrite en append-only table `audit_events` avec hash chain. UI ne loggue rien (cote client = non fiable).

### Conformite reglementaire MA

**Loi 09-08 CNDP (Protection donnees personnelles)** :
- Article 23 : "Le traitement doit etre proportionne aux finalites" -- RBAC granulaire = principe de proportionnalite materialise techniquement. Chaque utilisateur a strictement le minimum de permissions necessaires a sa fonction (least privilege).
- Article 11 : "Information du droit d'acces" -- l'utilisateur peut consulter ses permissions effectives via page `/profile/security` (lien vers liste read-only) -- preparation pour transparence.

**ACAPS (Autorite de Controle des Assurances et de la Prevoyance Sociale)** :
- Reglement 2018 sur courtiers : tracabilite des decisions metier = audit-log Sprint 7 permission decisions inspectable lors d'un audit ACAPS.
- Decisions affectant police d'assurance (cancel/suspend/transfer) auditables au niveau role : seul broker_admin peut canceler, garantissant que les decisions strategiques sont restreintes aux personnes autorisees.

**Loi 31-08 (Protection consommateurs)** :
- Article relative a transparence : l'utilisateur peut consulter ses permissions actuelles -- materialise par lien `/profile/security` qui affichera la liste (Sprint 16 task 4.3.11 livre la page, ici on prepare les hooks pour la liste).

**Loi 53-05 (Echange electronique de donnees juridiques)** :
- MFA + RBAC = authentification forte au sens Article 6. La combinaison "ce que je sais" (password) + "ce que j'ai" (TOTP) + "ce qu'on m'autorise" (RBAC granulaire) etablit niveau d'assurance eleve.

**WCAG 2.1 AA** :
- Page 403 conforme : `<h1>` clair (`role="heading" aria-level="1"`), texte 16px minimum, contraste 4.5:1, focus visible, navigation clavier complete, screen reader announce via `aria-live="polite"`.

### Pieges techniques connus (12+)

1. **JWT corrupted ou expire** : Si le decode echoue (token tampered ou expire), le hook `useUserPermissions` doit retourner `{ permissions: [], role: null }` sans crash. UI affiche tout cache (defaut secure). Utilisateur redirige vers `/login` automatiquement par le middleware d'auth.

2. **Permission unknown / typo** : Si developpeur ecrit `usePermission('crm.contact.delete')` (singular au lieu de pluriel), aucun warning compile-time. Solution : type union exhaustive `Permission = 'crm.contacts.delete' | 'crm.contacts.write' | ...` valide par TypeScript, plus check runtime warn en dev `console.warn` si permission n'existe pas dans le catalogue.

3. **Role changed mid-session** : Si admin change le role d'un user en cours de session, le JWT actuel reste valide jusqu'a expiration (15min defaut). UI continue d'afficher anciens features autorises. Solution : refresh token rotation Sprint 5 + invalidation explicite via endpoint `/auth/refresh` qui regenere JWT avec permissions actuelles. UI peut auto-refresh toutes les 5min via TanStack Query.

4. **HasPermission deeply nested** : Wrapper multiple `<HasPermission>` les uns dans les autres = O(n) lookups acceptables (Set check O(1) par niveau). Pas de probleme performance.

5. **Hydration mismatch SSR vs client** : Le JWT n'est pas accessible cote SSR (httpOnly cookie). Render SSR = "tout cache" par defaut. Hydration client decode JWT, affiche items autorises -- flash visible 50-100ms. Solution : skeleton placeholder pendant hydration + `suppressHydrationWarning` cible sur les wrapper components conditionnels.

6. **JWT expire pendant action** : User clique "Delete" alors que JWT vient d'expirer. Backend rejette 401. Solution : refresh token Sprint 5 auto-retry une fois, sinon redirect /login.

7. **Refresh token rotation** : A chaque refresh, nouveau JWT avec eventuellement nouvelles permissions (si role change). Le `PermissionContext` doit re-decoder le JWT et invalider le state precedent. Listener sur cookies change ou polling avec staleTime.

8. **Multiple roles same user impossible** : Le modele Sprint 7 stipule **un seul role per user per tenant** (mutually exclusive). Si user multi-tenant, role peut differer par tenant -- gere par tenant_id dans le JWT claim `tenant_id`.

9. **Permissions cached stale apres role change tenant** : Si user switch tenant (Sprint 16 task 4.3.3 tenant switcher), nouveau JWT avec permissions du tenant cible. Le `PermissionContext` doit recompute au tenant switch.

10. **Locale-aware error messages** : Page 403 doit etre traduite. Utiliser `useTranslations('errors.permission_denied')` next-intl.

11. **HOC withPermission render legacy** : Pattern HOC `withPermission(Component, 'crm.contacts.delete')` legacy pour code pre-hooks. Doit forward refs proprement via `React.forwardRef`.

12. **Server-side double-check obligatoire** : Test V8 critique = curl bypass UI doit echouer. Documenter dans README + commenter dans code que `<HasPermission>` n'est PAS securite.

13. **Permission catalog drift** : Si backend ajoute une permission mais le frontend type union n'est pas mis a jour, TypeScript ne sait pas. Solution : generate types automatiquement depuis schema OpenAPI ou source unique de verite `permissions-catalog.ts` partage backend+frontend (probablement Sprint 17+).

14. **Custom fields admin** : La permission `tenant.custom_fields.write` (Sprint 7) gate les forms admin de creation custom fields. Pattern : champs visible si broker_admin sinon read-only.

15. **Commission rate field** : Lors de validation broker queue (Sprint 16 task 4.3.9), le champ "Commission rate" est gate par `insure.broker_queue.commission_set` (sous-permission). Pattern : input editable si permission sinon disabled.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 16

`task-4.3.12` est la **douzieme tache sur 14** du Sprint 16 et depend de l'avancement complet des pages :

```
Sprint 16 -- Web Broker App (14 taches)

[4.3.1 App skeleton + middleware]
        |
[4.3.2 Auth pages]
        |
[4.3.3 Layout + sidebar + topbar]
        |
[4.3.4 Dashboard]
        |
[4.3.5 Contacts] -> [4.3.6 Companies] -> [4.3.7 Deals]
        |
[4.3.8 Polices] -> [4.3.9 Broker Queue] -> [4.3.10 Sinistres]
        |
[4.3.11 Parametres + Profile]
        |
[4.3.12 RBAC UI -- CETTE TACHE]   <-- Bloque toutes les pages avec features role-conditional
        |
[4.3.13 I18n complete]
        |
[4.3.14 Tests E2E + a11y]
```

Sequence d'integration : les 11 taches precedentes ont livre les pages avec features brutes (tous boutons visibles tous utilisateurs). Cette tache 4.3.12 ajoute **par-dessus** la couche RBAC qui cache conditionnellement. C'est intentionnel : permet aux dev de tester d'abord les flows complets en mode admin-superuser, puis d'ajouter RBAC en fin de sprint sans bloquer le developpement parallele.

### Position dans le programme

- **Sprint 7 livre RBAC backend** : 12 roles, 85 permissions, matrice, PermissionGuard, JWT claims.
- **Sprint 16 task 4.3.12** : RBAC UI pour broker app -- pattern canonique.
- **Sprint 17 task 4.4.X** : reutilisation pattern dans customer-portal.
- **Sprint 22 task 5.X.X** : reutilisation pattern dans garage app.
- **Sprint 27 task 6.X.X** : reutilisation pattern dans admin-portal (avec 9 autres roles).

Pattern canonique pose ici reutilise verbatim 4x dans les sprints suivants. Economie temps cumulee : ~16h (4h x 4 apps si refait a zero).

### Diagramme ASCII de la structure RBAC UI

```
repo/apps/web-broker/
|
|-- src/
|   |-- lib/auth/
|   |   |-- permissions-catalog.ts          # ~200 lignes : 85 permissions + types Permission union + descriptions
|   |   |-- roles-catalog.ts                # ~80 lignes : 12 roles types + role -> permissions mapping
|   |   |-- use-permissions.tsx             # ~150 lignes : useUserPermissions hook + decode JWT via jose
|   |   |-- use-permission.tsx              # ~80 lignes : usePermission + useRole + useIsAdmin
|   |   |-- has-permission-context.tsx      # ~120 lignes : Context provider parsed JWT once
|   |   |-- with-permission.tsx             # ~80 lignes : HOC legacy escape hatch
|   |   |-- permission-utils.ts             # ~120 lignes : hasAnyPermission, hasAllPermissions, isSubsetOfRole
|   |
|   |-- components/auth/
|   |   |-- has-permission.tsx              # ~80 lignes : <HasPermission> + fallback
|   |   |-- has-role.tsx                    # ~80 lignes : <HasRole>
|   |   |-- require-permission.tsx          # ~100 lignes : redirect /403
|   |   |-- require-role.tsx                # ~80 lignes : redirect /403
|   |   |-- permission-denied.tsx           # ~60 lignes : 403 friendly page component
|   |
|   |-- app/[locale]/(protected)/
|   |   |-- 403/page.tsx                    # ~40 lignes : page denied avec PermissionDenied component
|   |
|   |-- middleware-rbac.ts                  # ~80 lignes : extension middleware tache 4.3.1 -- gate /parametres/*
|
|-- test/
|   |-- lib/auth/
|   |   |-- use-permissions.spec.tsx        # 6 tests
|   |   |-- use-permission.spec.tsx         # 5 tests
|   |   |-- permissions-catalog.spec.ts     # 3 tests
|   |   |-- permission-utils.spec.ts        # 4 tests
|   |
|   |-- components/auth/
|   |   |-- has-permission.spec.tsx         # 5 tests
|   |   |-- has-role.spec.tsx               # 3 tests
|   |
|-- e2e/web/
|   |-- rbac-broker-admin.spec.ts            # 4 tests
|   |-- rbac-broker-user.spec.ts             # 3 tests
|   |-- rbac-broker-assistant.spec.ts        # 3 tests
```

### Diagramme JWT decode flow

```
                    +--------------------+
                    | Cookie httpOnly    |
                    | access_token (JWT) |
                    +--------------------+
                            |
                            | (lecture par /api/auth/me)
                            v
                    +--------------------+
                    | Next.js API route   |
                    | /api/auth/me        |
                    | retourne { jwt }    |
                    +--------------------+
                            |
                            v
                +------------------------------+
                | PermissionContext (mount)     |
                | jose.decodeJwt(token)         |
                | extract { user_id, tenant_id, |
                |   role, permissions: [] }     |
                +------------------------------+
                            |
                            v
                    +------------------+
                    | React Context     |
                    | value provided    |
                    +------------------+
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
      usePermission     useRole     useIsAdmin
              |             |             |
              v             v             v
      <HasPermission>  <HasRole>  conditional rendering
```

### Provider chain rendue avec PermissionProvider

```tsx
<html lang="fr" dir="ltr">
  <body>
    <ThemeProvider>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <Providers>
          <QueryClientProvider>
            <SentryErrorBoundary>
              <TenantContextSync>
                <PermissionProvider>     <-- AJOUT TACHE 4.3.12
                  {children}
                </PermissionProvider>
              </TenantContextSync>
            </SentryErrorBoundary>
          </QueryClientProvider>
        </Providers>
      </NextIntlClientProvider>
    </ThemeProvider>
  </body>
</html>
```

---

## 4. Livrables checkables (28 deliverables)

- [ ] **L1** : `repo/apps/web-broker/src/lib/auth/permissions-catalog.ts` (~200 lignes) -- catalogue exhaustif des 85 permissions Sprint 7 avec type union `Permission`, struct description par permission (nom, vertical, ressource, action, niveau sensibilite low/medium/high/critical), helpers `isValidPermission(s)`, `getAllPermissions()`.

- [ ] **L2** : `repo/apps/web-broker/src/lib/auth/roles-catalog.ts` (~80 lignes) -- catalogue des 12 roles type union `Role`, struct description (nom code, label fr/ar-MA/ar, scope tenant, role_level enum admin/user/assistant/external), mapping ROLE_PERMISSIONS partiel pour les 3 roles broker (admin/user/assistant) -- les 9 autres roles seront ajoutes dans leurs apps respectives.

- [ ] **L3** : `repo/apps/web-broker/src/lib/auth/use-permissions.tsx` (~150 lignes) -- hook `useUserPermissions(): { userId, tenantId, role, permissions, isLoading, isAuthenticated }` decodant JWT via `jose.decodeJwt`, fetch via `/api/auth/me` TanStack Query staleTime 5min, refetchOnWindowFocus pour invalidate au tenant switch.

- [ ] **L4** : `repo/apps/web-broker/src/lib/auth/use-permission.tsx` (~80 lignes) -- hooks atomiques `usePermission(p: Permission): boolean`, `useRole(r: Role | Role[]): boolean`, `useIsAdmin(): boolean` (shortcut broker_admin), `useHasAnyPermission(perms: Permission[]): boolean`, `useHasAllPermissions(perms: Permission[]): boolean`.

- [ ] **L5** : `repo/apps/web-broker/src/lib/auth/has-permission-context.tsx` (~120 lignes) -- Context Provider `PermissionProvider` parse JWT une seule fois au mount, expose via `usePermissionContext()` les permissions dans un `Set<Permission>` pour O(1) lookups, listener sur tenant change pour refetch.

- [ ] **L6** : `repo/apps/web-broker/src/components/auth/has-permission.tsx` (~80 lignes) -- component `<HasPermission permission="..." fallback={...}>` conditionnel, props : `permission: Permission`, `fallback?: ReactNode` (defaut null), `children: ReactNode`. Render fallback ou null si manque permission, sinon children.

- [ ] **L7** : `repo/apps/web-broker/src/components/auth/has-role.tsx` (~80 lignes) -- component `<HasRole role="broker_admin">` ou `<HasRole role={['broker_admin', 'broker_user']}>` accept role unique ou array (any match).

- [ ] **L8** : `repo/apps/web-broker/src/components/auth/require-permission.tsx` (~100 lignes) -- component `<RequirePermission permission="...">` redirige `useRouter().push('/403')` si manque permission au mount, sinon render children. Utilise dans dialogs/dialogs critiques.

- [ ] **L9** : `repo/apps/web-broker/src/components/auth/require-role.tsx` (~80 lignes) -- variante role redirect `/403`.

- [ ] **L10** : `repo/apps/web-broker/src/components/auth/permission-denied.tsx` (~60 lignes) -- component reutilisable affichant message friendly + retour dashboard + lien support + locale-aware.

- [ ] **L11** : `repo/apps/web-broker/src/app/[locale]/(protected)/403/page.tsx` (~40 lignes) -- page route `/403` Server Component qui render `<PermissionDenied />` avec metadata title localisee.

- [ ] **L12** : `repo/apps/web-broker/src/middleware-rbac.ts` (~80 lignes) -- extension middleware tache 4.3.1 : gate routes `/parametres/*` requiert role broker_admin, sinon redirect `/{locale}/403`. Decode JWT via jose (Edge Runtime compatible).

- [ ] **L13** : `repo/apps/web-broker/src/lib/auth/with-permission.tsx` (~80 lignes) -- HOC legacy `withPermission(Component, permission)` pour code legacy pre-hooks, forward refs proprement, displayName preserve pour debugging.

- [ ] **L14** : `repo/apps/web-broker/src/lib/auth/permission-utils.ts` (~120 lignes) -- utilitaires pures `hasAnyPermission(userPerms, required)`, `hasAllPermissions(userPerms, required)`, `isSubsetOfRole(userRole, otherRole)`, `permissionsForRole(role): Permission[]`.

- [ ] **L15** : Integration sidebar conditional : modifier `repo/apps/web-broker/src/components/layout/sidebar.tsx` Sprint 16 task 4.3.3 pour wrapper items avec `<HasPermission>` :
  - Parametres : `tenant.settings.read` (broker_admin only)
  - Broker Queue : `insure.broker_queue.read`
  - Sinistres : `repair.sinistres.read`

- [ ] **L16** : Integration action buttons conditional :
  - Page contacts : "Delete" gate `crm.contacts.delete`, "Bulk action" gate `crm.contacts.bulk_action`, "Export CSV" gate `crm.export`
  - Page polices : "Cancel" gate `insure.policies.cancel`, "Suspend" gate `insure.policies.suspend`, "Transfer" gate `insure.policies.transfer`
  - Page broker queue : "Validate" gate `insure.broker_queue.validate`, "Reject" gate `insure.broker_queue.reject`, "Escalate" gate `insure.broker_queue.escalate`
  - Page parametres : "Invite user" gate `tenant.users.invite`

- [ ] **L17** : Integration form fields conditional :
  - Custom fields admin form : gate `tenant.custom_fields.write`
  - Commission rate field broker queue validate : gate `insure.broker_queue.commission_set`

- [ ] **L18** : `repo/apps/web-broker/src/app/providers.tsx` (modifie Sprint 4 task 1.4.1) -- ajouter `<PermissionProvider>` dans la chain providers.

- [ ] **L19** : Tests unitaires Vitest `repo/apps/web-broker/test/lib/auth/use-permissions.spec.tsx` (6 tests) : decode JWT correct, JWT expire return null, JWT corrupted return null, missing token return null, tenant switch refetch, permissions extraction.

- [ ] **L20** : Tests unitaires Vitest `use-permission.spec.tsx` (5 tests) : usePermission true if granted, false if missing, useRole array support any-match, useIsAdmin shortcut, multiple hooks composability.

- [ ] **L21** : Tests unitaires Vitest `permissions-catalog.spec.ts` (3 tests) : 85 permissions all typed, isValidPermission rejects unknown, getAllPermissions returns full list.

- [ ] **L22** : Tests unitaires Vitest `permission-utils.spec.ts` (4 tests) : hasAnyPermission, hasAllPermissions, isSubsetOfRole, permissionsForRole.

- [ ] **L23** : Tests components Vitest `has-permission.spec.tsx` (5 tests) : renders children when granted, renders fallback when missing, renders null when no fallback + missing, nested HasPermission, performance multiple instances.

- [ ] **L24** : Tests components Vitest `has-role.spec.tsx` (3 tests) : single role match, array role any-match, no-match render null.

- [ ] **L25** : Tests E2E Playwright `rbac-broker-admin.spec.ts` (4 tests) : login -> sees Parametres in sidebar, sees Cancel Policy button, sees Invite User, can access /parametres.

- [ ] **L26** : Tests E2E Playwright `rbac-broker-user.spec.ts` (3 tests) : login -> NO Parametres in sidebar, sees Delete Contact, NO Cancel Policy button.

- [ ] **L27** : Tests E2E Playwright `rbac-broker-assistant.spec.ts` (3 tests) : login -> NO Parametres, NO Delete Contact, NO Cancel Policy + curl bypass test backend rejette 403.

- [ ] **L28** : Validation : `pnpm --filter @insurtech/web-broker typecheck` 0 erreur, tests Vitest 100% pass, tests Playwright 100% pass, lint 0 erreur, manual QA 3 roles sur 3 fonctionnel.

---

## 5. Stack technique (1-2 ko)

| Composant | Version | Role |
|-----------|---------|------|
| `jose` | 5.9.6 | Decode JWT client-side (decodeJwt sans signature verify) |
| `@tanstack/react-query` | 5.62.7 | Fetch /api/auth/me + refresh on tenant switch |
| React 19 | 19.0.0 | Context API + use hook |
| Next.js 15 | 15.1.0 | App Router + middleware Edge Runtime |
| shadcn/ui Tooltip | 1.1.x | DisabledTooltip pour fallback bouton inactif |
| shadcn/ui Alert | 1.1.x | Permission denied alert |
| `next-intl` | 3.26.3 | Locale-aware permission denied messages |
| TypeScript | 5.7.2 | Type union exhaustive Permission |

Variables env :
- `NEXT_PUBLIC_AUTH_ME_PATH=/api/auth/me` (route API qui retourne JWT decodee)
- `NEXT_PUBLIC_JWT_REFRESH_INTERVAL_MS=300000` (5 min)

---

## 6. Catalogue 85 Permissions Sprint 7 (3-4 ko)

Reference exhaustive du catalogue de permissions defini Sprint 7 task 2.3.1. Convention de nommage : `{vertical}.{ressource}.{action}` ou `{ressource}.{action}` pour les permissions transverses.

### Vertical CRM (12 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `crm.contacts.read` | Voir contacts du tenant | low |
| `crm.contacts.write` | Creer / modifier contacts | medium |
| `crm.contacts.delete` | Supprimer contacts | high |
| `crm.contacts.bulk_action` | Bulk tag/assign/delete | high |
| `crm.companies.read` | Voir societes | low |
| `crm.companies.write` | Creer / modifier societes | medium |
| `crm.companies.delete` | Supprimer societes | high |
| `crm.deals.read` | Voir deals pipeline | low |
| `crm.deals.write` | Creer / modifier deals | medium |
| `crm.deals.move_stage` | Deplacer deal entre stages | medium |
| `crm.deals.delete` | Supprimer deal | high |
| `crm.export` | Export CSV donnees CRM | high |

### Vertical Insure (15 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `insure.quotes.read` | Voir devis | low |
| `insure.quotes.write` | Creer / modifier devis | medium |
| `insure.quotes.send` | Envoyer devis client | medium |
| `insure.policies.read` | Voir polices | low |
| `insure.policies.write` | Creer polices | medium |
| `insure.policies.cancel` | Resilier police | critical |
| `insure.policies.suspend` | Suspendre temporairement | high |
| `insure.policies.transfer` | Transfer titulaire | critical |
| `insure.avenants.create` | Creer avenant | medium |
| `insure.broker_queue.read` | Voir queue validation | low |
| `insure.broker_queue.validate` | Valider dossier souscription | high |
| `insure.broker_queue.reject` | Rejeter dossier | high |
| `insure.broker_queue.escalate` | Escalader vers super admin | high |
| `insure.broker_queue.reassign` | Reassigner dossier autre user | high |
| `insure.broker_queue.commission_set` | Definir taux commission | critical |

### Vertical Repair (10 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `repair.sinistres.read` | Voir sinistres lies polices | low |
| `repair.sinistres.declare` | Declarer sinistre (assure/garage uniquement) | medium |
| `repair.sinistres.assign_garage` | Assigner garage | high |
| `repair.sinistres.validate_expertise` | Valider expertise | high |
| `repair.sinistres.approve_payment` | Approuver indemnisation | critical |
| `repair.sinistres.export_acaps` | Export reglementaire ACAPS | high |
| `repair.devis.read` | Voir devis reparation | low |
| `repair.devis.validate` | Valider devis reparation | high |
| `repair.parts.read` | Catalogue pieces detachees | low |
| `repair.parts.order` | Commander pieces | medium |

### Vertical Books (Comptabilite, 12 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `books.invoices.read` | Voir factures | low |
| `books.invoices.write` | Creer / modifier factures | medium |
| `books.invoices.delete` | Supprimer facture | critical |
| `books.invoices.validate` | Valider facture comptable | high |
| `books.payments.read` | Voir paiements | low |
| `books.payments.record` | Enregistrer paiement | medium |
| `books.commissions.read` | Voir commissions broker | low |
| `books.commissions.calculate` | Calculer commissions | high |
| `books.commissions.payout` | Verser commissions | critical |
| `books.taxes.read` | Voir taxes (TVA, ACAPS) | low |
| `books.reports.read` | Voir rapports comptables | low |
| `books.export` | Export comptable | high |

### Vertical Communications (8 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `comm.messages.read` | Voir messages | low |
| `comm.messages.send` | Envoyer messages | medium |
| `comm.campaigns.read` | Voir campagnes | low |
| `comm.campaigns.write` | Creer campagnes marketing | high |
| `comm.campaigns.send` | Lancer campagne | critical |
| `comm.templates.read` | Voir templates | low |
| `comm.templates.write` | Modifier templates | medium |
| `comm.notifications.read` | Voir notifications | low |

### Vertical Docs (6 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `docs.documents.read` | Voir documents | low |
| `docs.documents.upload` | Uploader documents | medium |
| `docs.documents.delete` | Supprimer documents | high |
| `docs.documents.sign` | Signature electronique | critical |
| `docs.templates.read` | Voir templates docs | low |
| `docs.templates.write` | Modifier templates docs | high |

### Vertical Tenant (Gestion tenant, 10 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `tenant.settings.read` | Voir parametres tenant | medium |
| `tenant.settings.write` | Modifier parametres tenant | critical |
| `tenant.users.read` | Voir liste users | medium |
| `tenant.users.invite` | Inviter user | high |
| `tenant.users.remove` | Retirer user | critical |
| `tenant.users.change_role` | Changer role user | critical |
| `tenant.custom_fields.read` | Voir custom fields | low |
| `tenant.custom_fields.write` | Creer / modifier custom fields | high |
| `tenant.pipelines.read` | Voir pipelines | low |
| `tenant.pipelines.write` | Modifier pipelines | medium |

### Vertical Analytics (5 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `analytics.dashboard.read` | Voir dashboard analytics | low |
| `analytics.reports.read` | Voir rapports | low |
| `analytics.reports.create` | Creer rapports custom | medium |
| `analytics.export` | Export analytics | medium |
| `analytics.cross_tenant` | Vue cross-tenant (super admin) | critical |

### Vertical HR (5 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `hr.employees.read` | Voir employes | low |
| `hr.employees.write` | Modifier employes | high |
| `hr.payroll.read` | Voir paie | high |
| `hr.payroll.process` | Traiter paie | critical |
| `hr.absences.read` | Voir absences | low |

### Vertical Audit (2 permissions)

| Permission | Description | Niveau |
|-----------|-------------|--------|
| `audit.events.read` | Voir audit log | high |
| `audit.events.export` | Export audit ACAPS | critical |

**Total : 85 permissions** (12 CRM + 15 Insure + 10 Repair + 12 Books + 8 Comm + 6 Docs + 10 Tenant + 5 Analytics + 5 HR + 2 Audit = 85).

---

## 7. Matrice RBAC 3 Roles Broker (2-3 ko)

Matrice complete des 29 permissions effectivement consommees par l'UI broker, en croisement avec les 3 roles broker_admin / broker_user / broker_assistant. Issue de Sprint 7 task 2.3.2 (permissions-matrix-role-hierarchy).

| Permission | broker_admin | broker_user | broker_assistant |
|-----------|:------------:|:-----------:|:----------------:|
| `crm.contacts.read` | YES | YES | YES |
| `crm.contacts.write` | YES | YES | YES (only own) |
| `crm.contacts.delete` | YES | YES | NO |
| `crm.contacts.bulk_action` | YES | YES | NO |
| `crm.companies.read` | YES | YES | YES |
| `crm.companies.write` | YES | YES | YES (only own) |
| `crm.companies.delete` | YES | NO | NO |
| `crm.deals.read` | YES | YES | YES (only own) |
| `crm.deals.write` | YES | YES | YES (only own) |
| `crm.deals.move_stage` | YES | YES | YES (only own) |
| `crm.deals.delete` | YES | YES | NO |
| `crm.export` | YES | YES | NO |
| `insure.policies.read` | YES | YES | YES |
| `insure.policies.write` | YES | YES | NO |
| `insure.policies.cancel` | YES | NO | NO |
| `insure.policies.suspend` | YES | YES | NO |
| `insure.policies.transfer` | YES | NO | NO |
| `insure.broker_queue.read` | YES | YES | NO |
| `insure.broker_queue.validate` | YES | YES | NO |
| `insure.broker_queue.reject` | YES | YES | NO |
| `insure.broker_queue.escalate` | YES | NO | NO |
| `insure.broker_queue.reassign` | YES | NO | NO |
| `insure.broker_queue.commission_set` | YES | NO | NO |
| `repair.sinistres.read` | YES | YES | YES |
| `repair.sinistres.export_acaps` | YES | NO | NO |
| `tenant.settings.read` | YES | NO | NO |
| `tenant.settings.write` | YES | NO | NO |
| `tenant.users.read` | YES | NO | NO |
| `tenant.users.invite` | YES | NO | NO |
| `tenant.custom_fields.write` | YES | NO | NO |
| `books.commissions.read` | YES | YES | NO |
| `books.invoices.read` | YES | YES | YES |
| `comm.messages.send` | YES | YES | YES |
| `docs.documents.upload` | YES | YES | YES |
| `analytics.dashboard.read` | YES | YES | YES (limited) |

**Lecture matrice** :
- **broker_admin** : ~30 permissions, equivalent "manager cabinet courtage". Decisions strategiques (cancel/transfer/escalate). Acces parametres tenant (settings/users/custom_fields).
- **broker_user** : ~20 permissions, equivalent "commercial senior". Operations courantes (validate/reject queue, edit polices, delete contacts) mais pas decisions critiques (cancel/transfer/commission_set).
- **broker_assistant** : ~10 permissions, equivalent "assistant administratif/junior". Lecture quasi-complete + create limite a ses propres entites. Pas de delete, pas d'acces queue validation.

**Principe least privilege materialise** : chaque role a strictement ce qu'il faut pour faire son metier. Aucune permission accordee "au cas ou".

**Mutual exclusivity** : un utilisateur a **un seul role par tenant** (Sprint 7 contrainte DB). Si user appartient a 2 tenants distincts, il peut avoir broker_admin dans tenant A et broker_user dans tenant B.

**Heritage role hierarchique** : Sprint 7 task 2.3.2 stipule un heritage implicite : broker_admin includes broker_user includes broker_assistant. En pratique, l'union est calculee a partir du fichier role-permissions.yml seed (pas via heritage runtime) pour eviter complexite. Les permissions sont **denormalisees** dans la table `role_permissions`.

---

## 8. Pattern critique : Decode JWT + Context Provider (5-6 ko)

Le coeur de la couche RBAC UI est le decodage du JWT et l'exposition via Context React. Voici l'implementation complete des fichiers principaux.

### 8.1 permissions-catalog.ts

```typescript
// repo/apps/web-broker/src/lib/auth/permissions-catalog.ts

/**
 * Catalogue exhaustif des 85 permissions definies au Sprint 7.
 *
 * Convention de nommage : {vertical}.{ressource}.{action}
 *
 * Niveau de sensibilite :
 * - low      : lecture donnees non-sensibles
 * - medium   : modification donnees, actions reversibles
 * - high     : actions impactantes (delete, export)
 * - critical : decisions strategiques (cancel police, payment, role change)
 */

export const PERMISSIONS = {
  // CRM (12)
  CRM_CONTACTS_READ: 'crm.contacts.read',
  CRM_CONTACTS_WRITE: 'crm.contacts.write',
  CRM_CONTACTS_DELETE: 'crm.contacts.delete',
  CRM_CONTACTS_BULK_ACTION: 'crm.contacts.bulk_action',
  CRM_COMPANIES_READ: 'crm.companies.read',
  CRM_COMPANIES_WRITE: 'crm.companies.write',
  CRM_COMPANIES_DELETE: 'crm.companies.delete',
  CRM_DEALS_READ: 'crm.deals.read',
  CRM_DEALS_WRITE: 'crm.deals.write',
  CRM_DEALS_MOVE_STAGE: 'crm.deals.move_stage',
  CRM_DEALS_DELETE: 'crm.deals.delete',
  CRM_EXPORT: 'crm.export',

  // INSURE (15)
  INSURE_QUOTES_READ: 'insure.quotes.read',
  INSURE_QUOTES_WRITE: 'insure.quotes.write',
  INSURE_QUOTES_SEND: 'insure.quotes.send',
  INSURE_POLICIES_READ: 'insure.policies.read',
  INSURE_POLICIES_WRITE: 'insure.policies.write',
  INSURE_POLICIES_CANCEL: 'insure.policies.cancel',
  INSURE_POLICIES_SUSPEND: 'insure.policies.suspend',
  INSURE_POLICIES_TRANSFER: 'insure.policies.transfer',
  INSURE_AVENANTS_CREATE: 'insure.avenants.create',
  INSURE_BROKER_QUEUE_READ: 'insure.broker_queue.read',
  INSURE_BROKER_QUEUE_VALIDATE: 'insure.broker_queue.validate',
  INSURE_BROKER_QUEUE_REJECT: 'insure.broker_queue.reject',
  INSURE_BROKER_QUEUE_ESCALATE: 'insure.broker_queue.escalate',
  INSURE_BROKER_QUEUE_REASSIGN: 'insure.broker_queue.reassign',
  INSURE_BROKER_QUEUE_COMMISSION_SET: 'insure.broker_queue.commission_set',

  // REPAIR (10)
  REPAIR_SINISTRES_READ: 'repair.sinistres.read',
  REPAIR_SINISTRES_DECLARE: 'repair.sinistres.declare',
  REPAIR_SINISTRES_ASSIGN_GARAGE: 'repair.sinistres.assign_garage',
  REPAIR_SINISTRES_VALIDATE_EXPERTISE: 'repair.sinistres.validate_expertise',
  REPAIR_SINISTRES_APPROVE_PAYMENT: 'repair.sinistres.approve_payment',
  REPAIR_SINISTRES_EXPORT_ACAPS: 'repair.sinistres.export_acaps',
  REPAIR_DEVIS_READ: 'repair.devis.read',
  REPAIR_DEVIS_VALIDATE: 'repair.devis.validate',
  REPAIR_PARTS_READ: 'repair.parts.read',
  REPAIR_PARTS_ORDER: 'repair.parts.order',

  // BOOKS (12)
  BOOKS_INVOICES_READ: 'books.invoices.read',
  BOOKS_INVOICES_WRITE: 'books.invoices.write',
  BOOKS_INVOICES_DELETE: 'books.invoices.delete',
  BOOKS_INVOICES_VALIDATE: 'books.invoices.validate',
  BOOKS_PAYMENTS_READ: 'books.payments.read',
  BOOKS_PAYMENTS_RECORD: 'books.payments.record',
  BOOKS_COMMISSIONS_READ: 'books.commissions.read',
  BOOKS_COMMISSIONS_CALCULATE: 'books.commissions.calculate',
  BOOKS_COMMISSIONS_PAYOUT: 'books.commissions.payout',
  BOOKS_TAXES_READ: 'books.taxes.read',
  BOOKS_REPORTS_READ: 'books.reports.read',
  BOOKS_EXPORT: 'books.export',

  // COMM (8)
  COMM_MESSAGES_READ: 'comm.messages.read',
  COMM_MESSAGES_SEND: 'comm.messages.send',
  COMM_CAMPAIGNS_READ: 'comm.campaigns.read',
  COMM_CAMPAIGNS_WRITE: 'comm.campaigns.write',
  COMM_CAMPAIGNS_SEND: 'comm.campaigns.send',
  COMM_TEMPLATES_READ: 'comm.templates.read',
  COMM_TEMPLATES_WRITE: 'comm.templates.write',
  COMM_NOTIFICATIONS_READ: 'comm.notifications.read',

  // DOCS (6)
  DOCS_DOCUMENTS_READ: 'docs.documents.read',
  DOCS_DOCUMENTS_UPLOAD: 'docs.documents.upload',
  DOCS_DOCUMENTS_DELETE: 'docs.documents.delete',
  DOCS_DOCUMENTS_SIGN: 'docs.documents.sign',
  DOCS_TEMPLATES_READ: 'docs.templates.read',
  DOCS_TEMPLATES_WRITE: 'docs.templates.write',

  // TENANT (10)
  TENANT_SETTINGS_READ: 'tenant.settings.read',
  TENANT_SETTINGS_WRITE: 'tenant.settings.write',
  TENANT_USERS_READ: 'tenant.users.read',
  TENANT_USERS_INVITE: 'tenant.users.invite',
  TENANT_USERS_REMOVE: 'tenant.users.remove',
  TENANT_USERS_CHANGE_ROLE: 'tenant.users.change_role',
  TENANT_CUSTOM_FIELDS_READ: 'tenant.custom_fields.read',
  TENANT_CUSTOM_FIELDS_WRITE: 'tenant.custom_fields.write',
  TENANT_PIPELINES_READ: 'tenant.pipelines.read',
  TENANT_PIPELINES_WRITE: 'tenant.pipelines.write',

  // ANALYTICS (5)
  ANALYTICS_DASHBOARD_READ: 'analytics.dashboard.read',
  ANALYTICS_REPORTS_READ: 'analytics.reports.read',
  ANALYTICS_REPORTS_CREATE: 'analytics.reports.create',
  ANALYTICS_EXPORT: 'analytics.export',
  ANALYTICS_CROSS_TENANT: 'analytics.cross_tenant',

  // HR (5)
  HR_EMPLOYEES_READ: 'hr.employees.read',
  HR_EMPLOYEES_WRITE: 'hr.employees.write',
  HR_PAYROLL_READ: 'hr.payroll.read',
  HR_PAYROLL_PROCESS: 'hr.payroll.process',
  HR_ABSENCES_READ: 'hr.absences.read',

  // AUDIT (2)
  AUDIT_EVENTS_READ: 'audit.events.read',
  AUDIT_EVENTS_EXPORT: 'audit.events.export',
} as const;

/**
 * Type union exhaustive des permissions valides.
 * Permet TypeScript inference + autocompletion + erreur compile si typo.
 */
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/**
 * Niveau sensibilite par permission.
 */
export type PermissionSensitivity = 'low' | 'medium' | 'high' | 'critical';

export const PERMISSION_METADATA: Record<Permission, {
  sensitivity: PermissionSensitivity;
  vertical: string;
  description: string;
}> = {
  'crm.contacts.read': { sensitivity: 'low', vertical: 'crm', description: 'Voir contacts du tenant' },
  'crm.contacts.write': { sensitivity: 'medium', vertical: 'crm', description: 'Creer / modifier contacts' },
  'crm.contacts.delete': { sensitivity: 'high', vertical: 'crm', description: 'Supprimer contacts' },
  'crm.contacts.bulk_action': { sensitivity: 'high', vertical: 'crm', description: 'Bulk tag/assign/delete' },
  'crm.companies.read': { sensitivity: 'low', vertical: 'crm', description: 'Voir societes' },
  'crm.companies.write': { sensitivity: 'medium', vertical: 'crm', description: 'Creer / modifier societes' },
  'crm.companies.delete': { sensitivity: 'high', vertical: 'crm', description: 'Supprimer societes' },
  'crm.deals.read': { sensitivity: 'low', vertical: 'crm', description: 'Voir deals pipeline' },
  'crm.deals.write': { sensitivity: 'medium', vertical: 'crm', description: 'Creer / modifier deals' },
  'crm.deals.move_stage': { sensitivity: 'medium', vertical: 'crm', description: 'Deplacer deal entre stages' },
  'crm.deals.delete': { sensitivity: 'high', vertical: 'crm', description: 'Supprimer deal' },
  'crm.export': { sensitivity: 'high', vertical: 'crm', description: 'Export CSV donnees CRM' },
  // ... (les 73 autres permissions avec metadata complete dans le fichier reel)
} as Record<Permission, { sensitivity: PermissionSensitivity; vertical: string; description: string }>;

/**
 * Retourne toutes les permissions valides du catalogue.
 */
export function getAllPermissions(): Permission[] {
  return Object.values(PERMISSIONS);
}

/**
 * Type guard : verifie si une string est une permission valide du catalogue.
 * Utile pour valider input dynamique (JWT decode, API response).
 */
export function isValidPermission(value: string): value is Permission {
  return getAllPermissions().includes(value as Permission);
}

/**
 * Retourne la sensibilite d'une permission donnee.
 * Utile pour decisions UX (ex: confirm dialog double si critical).
 */
export function getPermissionSensitivity(permission: Permission): PermissionSensitivity {
  return PERMISSION_METADATA[permission]?.sensitivity ?? 'medium';
}

/**
 * Filtre permissions par vertical (CRM, Insure, etc.).
 */
export function getPermissionsByVertical(vertical: string): Permission[] {
  return Object.entries(PERMISSION_METADATA)
    .filter(([_, meta]) => meta.vertical === vertical)
    .map(([perm]) => perm as Permission);
}
```

### 8.2 roles-catalog.ts

```typescript
// repo/apps/web-broker/src/lib/auth/roles-catalog.ts

import { PERMISSIONS, type Permission } from './permissions-catalog';

/**
 * Catalogue des 12 roles transverses programme.
 * Cette app web-broker materialise uniquement les 3 roles broker.
 * Les 9 autres roles seront materialises dans leurs apps respectives.
 */

export const ROLES = {
  // Broker roles (Sprint 16 web-broker)
  BROKER_ADMIN: 'broker_admin',
  BROKER_USER: 'broker_user',
  BROKER_ASSISTANT: 'broker_assistant',

  // Garage roles (Sprint 22 web-garage)
  GARAGE_OWNER: 'garage_owner',
  GARAGE_MECHANIC: 'garage_mechanic',

  // Customer roles (Sprint 17 web-customer + web-assure)
  CUSTOMER_INDIVIDUAL: 'customer_individual',
  CUSTOMER_COMPANY: 'customer_company',

  // External experts
  EXPERT_SINISTRE: 'expert_sinistre',
  AGENT_ACAPS: 'agent_acaps',

  // Skalean internal
  AGENT_SKALEAN: 'agent_skalean',
  SUPER_ADMIN_SKALEAN: 'super_admin_skalean',

  // Partner
  PARTNER_PARTNER: 'partner_partner',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Roles broker materialises dans cette app (sous-ensemble).
 */
export type BrokerRole = 'broker_admin' | 'broker_user' | 'broker_assistant';

export function isBrokerRole(role: string): role is BrokerRole {
  return ['broker_admin', 'broker_user', 'broker_assistant'].includes(role);
}

/**
 * Mapping role -> permissions pour les 3 roles broker.
 * Source de verite duplique du backend Sprint 7 (denormalisation acceptee).
 */
export const ROLE_PERMISSIONS: Record<BrokerRole, Permission[]> = {
  broker_admin: [
    PERMISSIONS.CRM_CONTACTS_READ,
    PERMISSIONS.CRM_CONTACTS_WRITE,
    PERMISSIONS.CRM_CONTACTS_DELETE,
    PERMISSIONS.CRM_CONTACTS_BULK_ACTION,
    PERMISSIONS.CRM_COMPANIES_READ,
    PERMISSIONS.CRM_COMPANIES_WRITE,
    PERMISSIONS.CRM_COMPANIES_DELETE,
    PERMISSIONS.CRM_DEALS_READ,
    PERMISSIONS.CRM_DEALS_WRITE,
    PERMISSIONS.CRM_DEALS_MOVE_STAGE,
    PERMISSIONS.CRM_DEALS_DELETE,
    PERMISSIONS.CRM_EXPORT,
    PERMISSIONS.INSURE_POLICIES_READ,
    PERMISSIONS.INSURE_POLICIES_WRITE,
    PERMISSIONS.INSURE_POLICIES_CANCEL,
    PERMISSIONS.INSURE_POLICIES_SUSPEND,
    PERMISSIONS.INSURE_POLICIES_TRANSFER,
    PERMISSIONS.INSURE_BROKER_QUEUE_READ,
    PERMISSIONS.INSURE_BROKER_QUEUE_VALIDATE,
    PERMISSIONS.INSURE_BROKER_QUEUE_REJECT,
    PERMISSIONS.INSURE_BROKER_QUEUE_ESCALATE,
    PERMISSIONS.INSURE_BROKER_QUEUE_REASSIGN,
    PERMISSIONS.INSURE_BROKER_QUEUE_COMMISSION_SET,
    PERMISSIONS.REPAIR_SINISTRES_READ,
    PERMISSIONS.REPAIR_SINISTRES_EXPORT_ACAPS,
    PERMISSIONS.TENANT_SETTINGS_READ,
    PERMISSIONS.TENANT_SETTINGS_WRITE,
    PERMISSIONS.TENANT_USERS_READ,
    PERMISSIONS.TENANT_USERS_INVITE,
    PERMISSIONS.TENANT_CUSTOM_FIELDS_WRITE,
    PERMISSIONS.BOOKS_COMMISSIONS_READ,
    PERMISSIONS.BOOKS_INVOICES_READ,
    PERMISSIONS.ANALYTICS_DASHBOARD_READ,
  ],

  broker_user: [
    PERMISSIONS.CRM_CONTACTS_READ,
    PERMISSIONS.CRM_CONTACTS_WRITE,
    PERMISSIONS.CRM_CONTACTS_DELETE,
    PERMISSIONS.CRM_CONTACTS_BULK_ACTION,
    PERMISSIONS.CRM_COMPANIES_READ,
    PERMISSIONS.CRM_COMPANIES_WRITE,
    PERMISSIONS.CRM_DEALS_READ,
    PERMISSIONS.CRM_DEALS_WRITE,
    PERMISSIONS.CRM_DEALS_MOVE_STAGE,
    PERMISSIONS.CRM_DEALS_DELETE,
    PERMISSIONS.CRM_EXPORT,
    PERMISSIONS.INSURE_POLICIES_READ,
    PERMISSIONS.INSURE_POLICIES_WRITE,
    PERMISSIONS.INSURE_POLICIES_SUSPEND,
    PERMISSIONS.INSURE_BROKER_QUEUE_READ,
    PERMISSIONS.INSURE_BROKER_QUEUE_VALIDATE,
    PERMISSIONS.INSURE_BROKER_QUEUE_REJECT,
    PERMISSIONS.REPAIR_SINISTRES_READ,
    PERMISSIONS.BOOKS_COMMISSIONS_READ,
    PERMISSIONS.BOOKS_INVOICES_READ,
    PERMISSIONS.ANALYTICS_DASHBOARD_READ,
  ],

  broker_assistant: [
    PERMISSIONS.CRM_CONTACTS_READ,
    PERMISSIONS.CRM_CONTACTS_WRITE,
    PERMISSIONS.CRM_COMPANIES_READ,
    PERMISSIONS.CRM_COMPANIES_WRITE,
    PERMISSIONS.CRM_DEALS_READ,
    PERMISSIONS.CRM_DEALS_WRITE,
    PERMISSIONS.CRM_DEALS_MOVE_STAGE,
    PERMISSIONS.INSURE_POLICIES_READ,
    PERMISSIONS.REPAIR_SINISTRES_READ,
    PERMISSIONS.BOOKS_INVOICES_READ,
    PERMISSIONS.ANALYTICS_DASHBOARD_READ,
  ],
};

/**
 * Retourne permissions par role.
 */
export function permissionsForRole(role: BrokerRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/**
 * Labels localises (utilise pour UI).
 */
export const ROLE_LABELS: Record<BrokerRole, { fr: string; arMA: string; ar: string }> = {
  broker_admin: {
    fr: 'Administrateur cabinet',
    arMA: 'مسؤول المكتب',
    ar: 'مدير المكتب',
  },
  broker_user: {
    fr: 'Commercial',
    arMA: 'مكلف بالمبيعات',
    ar: 'مستخدم تجاري',
  },
  broker_assistant: {
    fr: 'Assistant administratif',
    arMA: 'مساعد إداري',
    ar: 'مساعد إداري',
  },
};
```

### 8.3 has-permission-context.tsx (Context Provider)

```typescript
// repo/apps/web-broker/src/lib/auth/has-permission-context.tsx
'use client';

import { createContext, useContext, useMemo, useEffect, useState, type ReactNode } from 'react';
import { decodeJwt, type JWTPayload } from 'jose';
import { useQuery } from '@tanstack/react-query';
import { type Permission, isValidPermission } from './permissions-catalog';
import { type BrokerRole, isBrokerRole } from './roles-catalog';

/**
 * Structure du JWT decode.
 * Le backend Sprint 5 emet un JWT avec ces claims standards.
 */
interface DecodedJwt extends JWTPayload {
  sub: string;              // user_id
  tenant_id: string;
  role: BrokerRole | string; // role code
  permissions: string[];    // array of permission codes
  exp: number;              // expiration timestamp
  iat: number;              // issued at
}

interface PermissionContextValue {
  userId: string | null;
  tenantId: string | null;
  role: BrokerRole | null;
  permissions: Set<Permission>;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

/**
 * Fetch /api/auth/me retourne le JWT actuel (cookie httpOnly server-readable).
 * Cette route Next.js API agit en proxy sur backend Sprint 5.
 */
async function fetchCurrentJwt(): Promise<string | null> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.access_token ?? null;
  } catch (err) {
    console.error('[PermissionContext] Failed to fetch /api/auth/me', err);
    return null;
  }
}

/**
 * Decode JWT et valide la structure.
 * Si JWT corrupted ou expire, retourne null.
 */
function parseJwt(token: string | null): DecodedJwt | null {
  if (!token) return null;

  try {
    const decoded = decodeJwt(token) as DecodedJwt;

    // Validation expire
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < now) {
      console.warn('[PermissionContext] JWT expired');
      return null;
    }

    // Validation structure minimale
    if (!decoded.sub || !decoded.tenant_id || !decoded.role) {
      console.warn('[PermissionContext] JWT missing required claims');
      return null;
    }

    return decoded;
  } catch (err) {
    console.error('[PermissionContext] JWT decode failed', err);
    return null;
  }
}

/**
 * PermissionProvider : Context Provider parsant le JWT et exposant les permissions.
 *
 * Place dans la chain providers root (app/providers.tsx) APRES TenantContextSync
 * pour permettre invalidation au tenant switch.
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
  const {
    data: jwt,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['auth', 'current-jwt'],
    queryFn: fetchCurrentJwt,
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000,   // 10 min
    refetchOnWindowFocus: true, // Re-fetch si tab regain focus (catch role change)
    retry: 1,
  });

  const decoded = useMemo(() => parseJwt(jwt ?? null), [jwt]);

  const value = useMemo<PermissionContextValue>(() => {
    if (!decoded) {
      return {
        userId: null,
        tenantId: null,
        role: null,
        permissions: new Set<Permission>(),
        isAuthenticated: false,
        isLoading,
        error: error instanceof Error ? error : null,
        refresh: async () => {
          await refetch();
        },
      };
    }

    // Filtre permissions valides du catalogue (ignore unknown)
    const validPermissions = (decoded.permissions ?? []).filter(isValidPermission);
    const role = isBrokerRole(decoded.role) ? decoded.role : null;

    return {
      userId: decoded.sub,
      tenantId: decoded.tenant_id,
      role,
      permissions: new Set<Permission>(validPermissions as Permission[]),
      isAuthenticated: true,
      isLoading,
      error: null,
      refresh: async () => {
        await refetch();
      },
    };
  }, [decoded, isLoading, error, refetch]);

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/**
 * Hook bas-niveau pour acceder au context.
 * Throw si utilise hors Provider (developer error).
 */
export function usePermissionContext(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error('usePermissionContext must be used within <PermissionProvider>');
  }
  return ctx;
}
```

### 8.4 use-permissions.tsx (Hook utilisateur principal)

```typescript
// repo/apps/web-broker/src/lib/auth/use-permissions.tsx
'use client';

import { useMemo } from 'react';
import { usePermissionContext } from './has-permission-context';
import { type Permission } from './permissions-catalog';
import { type BrokerRole } from './roles-catalog';

/**
 * Retourne l'ensemble des donnees du user authentifie.
 *
 * Utilisation :
 * ```
 * const { userId, role, permissions, isAuthenticated } = useUserPermissions();
 * ```
 */
export function useUserPermissions() {
  const ctx = usePermissionContext();
  return {
    userId: ctx.userId,
    tenantId: ctx.tenantId,
    role: ctx.role,
    permissions: ctx.permissions,
    isAuthenticated: ctx.isAuthenticated,
    isLoading: ctx.isLoading,
    error: ctx.error,
    refresh: ctx.refresh,
  };
}

/**
 * Retourne les permissions sous forme d'array trie (pour affichage profile).
 */
export function useUserPermissionsList(): Permission[] {
  const { permissions } = useUserPermissions();
  return useMemo(() => Array.from(permissions).sort(), [permissions]);
}

/**
 * Retourne le role et son label localise.
 */
export function useCurrentRole(): { role: BrokerRole | null; label: string } {
  const { role } = useUserPermissions();
  // label resolu dans le component appelant via ROLE_LABELS[role][locale]
  return { role, label: role ?? 'unknown' };
}
```

### 8.5 use-permission.tsx (Hooks atomiques)

```typescript
// repo/apps/web-broker/src/lib/auth/use-permission.tsx
'use client';

import { useMemo } from 'react';
import { usePermissionContext } from './has-permission-context';
import { type Permission } from './permissions-catalog';
import { type BrokerRole } from './roles-catalog';

/**
 * Verifie si le user actuel a une permission specifique.
 *
 * Utilisation :
 * ```tsx
 * const canDelete = usePermission('crm.contacts.delete');
 * if (canDelete) { ... }
 * ```
 *
 * Retourne false si :
 * - User non authentifie
 * - JWT corrupted / expire
 * - Permission non presente dans le set utilisateur
 */
export function usePermission(permission: Permission): boolean {
  const { permissions, isAuthenticated } = usePermissionContext();
  return useMemo(() => {
    if (!isAuthenticated) return false;
    return permissions.has(permission);
  }, [permissions, permission, isAuthenticated]);
}

/**
 * Verifie si le user a au moins une des permissions listees (OR logique).
 *
 * Utilisation :
 * ```tsx
 * const canManageContact = useHasAnyPermission(['crm.contacts.write', 'crm.contacts.delete']);
 * ```
 */
export function useHasAnyPermission(perms: Permission[]): boolean {
  const { permissions, isAuthenticated } = usePermissionContext();
  return useMemo(() => {
    if (!isAuthenticated) return false;
    return perms.some((p) => permissions.has(p));
  }, [permissions, perms, isAuthenticated]);
}

/**
 * Verifie si le user a TOUTES les permissions listees (AND logique).
 *
 * Utilisation :
 * ```tsx
 * const canFullManage = useHasAllPermissions([
 *   'crm.contacts.write',
 *   'crm.contacts.delete',
 *   'crm.contacts.bulk_action'
 * ]);
 * ```
 */
export function useHasAllPermissions(perms: Permission[]): boolean {
  const { permissions, isAuthenticated } = usePermissionContext();
  return useMemo(() => {
    if (!isAuthenticated) return false;
    return perms.every((p) => permissions.has(p));
  }, [permissions, perms, isAuthenticated]);
}

/**
 * Verifie si le user a un role specifique ou un des roles listes.
 *
 * Utilisation :
 * ```tsx
 * const isAdminOrUser = useRole(['broker_admin', 'broker_user']);
 * const isAdmin = useRole('broker_admin');
 * ```
 */
export function useRole(role: BrokerRole | BrokerRole[]): boolean {
  const { role: currentRole, isAuthenticated } = usePermissionContext();
  return useMemo(() => {
    if (!isAuthenticated || !currentRole) return false;
    if (Array.isArray(role)) {
      return role.includes(currentRole);
    }
    return currentRole === role;
  }, [currentRole, role, isAuthenticated]);
}

/**
 * Shortcut : verifie si le user est broker_admin.
 *
 * Utilisation :
 * ```tsx
 * const isAdmin = useIsAdmin();
 * ```
 */
export function useIsAdmin(): boolean {
  return useRole('broker_admin');
}

/**
 * Shortcut : verifie si le user est broker_assistant (limited).
 */
export function useIsAssistant(): boolean {
  return useRole('broker_assistant');
}
```

---

## 9. Components Conditional Rendering (5-6 ko)

### 9.1 has-permission.tsx

```typescript
// repo/apps/web-broker/src/components/auth/has-permission.tsx
'use client';

import { type ReactNode } from 'react';
import { usePermission } from '@/lib/auth/use-permission';
import { type Permission } from '@/lib/auth/permissions-catalog';

interface HasPermissionProps {
  /** Permission a verifier. Type-safe via union des 85 permissions. */
  permission: Permission;
  /**
   * Render alternatif si user n'a pas la permission.
   * Si non fourni, retourne null (cache complete).
   */
  fallback?: ReactNode;
  /** Contenu affiche si user a la permission. */
  children: ReactNode;
  /**
   * Si true, render children meme si permission manquante mais en mode disabled.
   * Utile pour tooltips informationnels au lieu de cache complet.
   * Defaut : false.
   */
  showAsDisabled?: boolean;
}

/**
 * Affiche conditionnellement les children selon la permission utilisateur.
 *
 * ATTENTION : C'est UNIQUEMENT pour optimisation UX (cacher boutons inutiles).
 * Le backend Sprint 7 fait l'autorisation reelle. Ne JAMAIS s'y fier pour securite.
 *
 * Utilisation simple :
 * ```tsx
 * <HasPermission permission="crm.contacts.delete">
 *   <Button onClick={handleDelete}>Delete</Button>
 * </HasPermission>
 * ```
 *
 * Avec fallback :
 * ```tsx
 * <HasPermission
 *   permission="insure.policies.cancel"
 *   fallback={<DisabledTooltip text="Reserve aux administrateurs" />}
 * >
 *   <CancelPolicyButton />
 * </HasPermission>
 * ```
 *
 * Mode disabled (children rendu en grise) :
 * ```tsx
 * <HasPermission permission="crm.contacts.bulk_action" showAsDisabled>
 *   <BulkActionsMenu />
 * </HasPermission>
 * ```
 */
export function HasPermission({
  permission,
  fallback = null,
  children,
  showAsDisabled = false,
}: HasPermissionProps) {
  const granted = usePermission(permission);

  if (granted) {
    return <>{children}</>;
  }

  if (showAsDisabled) {
    return (
      <div aria-disabled="true" className="pointer-events-none opacity-50" data-permission-denied={permission}>
        {children}
      </div>
    );
  }

  return <>{fallback}</>;
}

/**
 * Variante : render children si user a au moins une des permissions.
 */
export function HasAnyPermission({
  permissions,
  fallback = null,
  children,
}: {
  permissions: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { useHasAnyPermission } = require('@/lib/auth/use-permission');
  const granted = useHasAnyPermission(permissions);
  return granted ? <>{children}</> : <>{fallback}</>;
}

/**
 * Variante : render children si user a TOUTES les permissions.
 */
export function HasAllPermissions({
  permissions,
  fallback = null,
  children,
}: {
  permissions: Permission[];
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { useHasAllPermissions } = require('@/lib/auth/use-permission');
  const granted = useHasAllPermissions(permissions);
  return granted ? <>{children}</> : <>{fallback}</>;
}
```

### 9.2 has-role.tsx

```typescript
// repo/apps/web-broker/src/components/auth/has-role.tsx
'use client';

import { type ReactNode } from 'react';
import { useRole } from '@/lib/auth/use-permission';
import { type BrokerRole } from '@/lib/auth/roles-catalog';

interface HasRoleProps {
  /** Role unique ou array de roles (any-match). */
  role: BrokerRole | BrokerRole[];
  /** Render alternatif si user n'a pas le role. Defaut null. */
  fallback?: ReactNode;
  /** Contenu affiche si user a le role. */
  children: ReactNode;
}

/**
 * Affiche conditionnellement les children selon le role utilisateur.
 *
 * Utilisation :
 * ```tsx
 * <HasRole role="broker_admin">
 *   <AdminPanel />
 * </HasRole>
 *
 * <HasRole role={['broker_admin', 'broker_user']}>
 *   <DeleteButton />
 * </HasRole>
 *
 * <HasRole role="broker_admin" fallback={<UpgradeMessage />}>
 *   <ParametresLink />
 * </HasRole>
 * ```
 */
export function HasRole({ role, fallback = null, children }: HasRoleProps) {
  const granted = useRole(role);
  return granted ? <>{children}</> : <>{fallback}</>;
}

/**
 * Shortcut : affiche children uniquement si broker_admin.
 */
export function AdminOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return <HasRole role="broker_admin" fallback={fallback}>{children}</HasRole>;
}

/**
 * Shortcut : affiche children pour broker_admin OU broker_user (pas assistant).
 */
export function StaffOnly({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  return (
    <HasRole role={['broker_admin', 'broker_user']} fallback={fallback}>
      {children}
    </HasRole>
  );
}
```

### 9.3 require-permission.tsx

```typescript
// repo/apps/web-broker/src/components/auth/require-permission.tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { usePermission } from '@/lib/auth/use-permission';
import { usePermissionContext } from '@/lib/auth/has-permission-context';
import { type Permission } from '@/lib/auth/permissions-catalog';
import { Skeleton } from '@/components/ui/skeleton';

interface RequirePermissionProps {
  /** Permission requise. */
  permission: Permission;
  /** Path vers lequel rediriger si manque. Defaut /403. */
  redirectTo?: string;
  /** Children rendu si permission OK. */
  children: ReactNode;
  /** Si true, affiche loading skeleton pendant verification JWT. */
  showLoadingState?: boolean;
}

/**
 * Wrapper redirige vers /403 si user n'a pas la permission.
 *
 * Utilisation :
 * ```tsx
 * <RequirePermission permission="insure.policies.cancel">
 *   <CancelPolicyDialog />
 * </RequirePermission>
 * ```
 *
 * Note : Combine cette protection UI avec backend PermissionGuard Sprint 7.
 */
export function RequirePermission({
  permission,
  redirectTo = '/403',
  children,
  showLoadingState = true,
}: RequirePermissionProps) {
  const router = useRouter();
  const granted = usePermission(permission);
  const { isLoading, isAuthenticated } = usePermissionContext();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !granted) {
      router.push(redirectTo);
    }
  }, [granted, isLoading, isAuthenticated, redirectTo, router]);

  if (isLoading && showLoadingState) {
    return (
      <div className="flex flex-col gap-4 p-8" aria-busy="true" aria-label="Verification permissions">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!granted) {
    // Render placeholder pendant redirect (evite flash content)
    return null;
  }

  return <>{children}</>;
}
```

### 9.4 require-role.tsx

```typescript
// repo/apps/web-broker/src/components/auth/require-role.tsx
'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/lib/auth/use-permission';
import { usePermissionContext } from '@/lib/auth/has-permission-context';
import { type BrokerRole } from '@/lib/auth/roles-catalog';

interface RequireRoleProps {
  role: BrokerRole | BrokerRole[];
  redirectTo?: string;
  children: ReactNode;
}

/**
 * Wrapper redirige vers /403 si user n'a pas le role.
 *
 * Utilisation :
 * ```tsx
 * <RequireRole role="broker_admin">
 *   <ParametresTenantPage />
 * </RequireRole>
 * ```
 */
export function RequireRole({ role, redirectTo = '/403', children }: RequireRoleProps) {
  const router = useRouter();
  const granted = useRole(role);
  const { isLoading, isAuthenticated } = usePermissionContext();

  useEffect(() => {
    if (!isLoading && isAuthenticated && !granted) {
      router.push(redirectTo);
    }
  }, [granted, isLoading, isAuthenticated, redirectTo, router]);

  if (isLoading) return null;
  if (!granted) return null;

  return <>{children}</>;
}
```

### 9.5 permission-denied.tsx

```typescript
// repo/apps/web-broker/src/components/auth/permission-denied.tsx
'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useUserPermissions } from '@/lib/auth/use-permissions';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface PermissionDeniedProps {
  /** Permission requise (affichee pour debug si dev). */
  requiredPermission?: string;
  /** Path retour. Defaut /dashboard. */
  backTo?: string;
}

/**
 * Component reutilisable page 403 friendly + locale-aware.
 * Conforme WCAG 2.1 AA : aria-live alert + focus management + contraste.
 */
export function PermissionDenied({ requiredPermission, backTo = '/dashboard' }: PermissionDeniedProps) {
  const t = useTranslations('errors.permission_denied');
  const { role } = useUserPermissions();
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus management WCAG : focus heading au mount pour annonce screen reader
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center"
      role="alert"
      aria-live="polite"
    >
      <AlertCircle className="mb-4 h-16 w-16 text-destructive" aria-hidden="true" />

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-4 text-3xl font-bold focus:outline-none"
      >
        {t('title')}
      </h1>

      <p className="mb-2 max-w-md text-muted-foreground">{t('description')}</p>

      {role && (
        <p className="mb-6 text-sm text-muted-foreground">
          {t('current_role', { role })}
        </p>
      )}

      {process.env.NODE_ENV === 'development' && requiredPermission && (
        <div className="mb-6 rounded border border-dashed border-yellow-500 bg-yellow-50 p-3 text-sm text-yellow-900">
          <strong>DEV ONLY:</strong> Permission requise : <code>{requiredPermission}</code>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="default">
          <Link href={backTo}>{t('back_to_dashboard')}</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="mailto:support@skalean-insurtech.ma">{t('contact_support')}</a>
        </Button>
      </div>
    </div>
  );
}
```

### 9.6 Page /403

```typescript
// repo/apps/web-broker/src/app/[locale]/(protected)/403/page.tsx

import { type Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PermissionDenied } from '@/components/auth/permission-denied';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'errors.permission_denied' });
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default function PermissionDeniedPage() {
  return <PermissionDenied />;
}
```

### 9.7 with-permission.tsx (HOC legacy)

```typescript
// repo/apps/web-broker/src/lib/auth/with-permission.tsx
'use client';

import { forwardRef, type ComponentType, type ForwardedRef, type ReactNode } from 'react';
import { usePermission } from './use-permission';
import { type Permission } from './permissions-catalog';

/**
 * HOC legacy pour wrapper composants pre-hooks.
 *
 * Preferer <HasPermission> ou usePermission hook dans le nouveau code.
 *
 * Utilisation :
 * ```tsx
 * const DeleteButtonProtected = withPermission(DeleteButton, 'crm.contacts.delete');
 * ```
 */
export function withPermission<P extends object>(
  Component: ComponentType<P>,
  permission: Permission,
  fallback: ReactNode = null
) {
  const WrappedComponent = forwardRef<unknown, P>((props, ref) => {
    const granted = usePermission(permission);
    if (!granted) return <>{fallback}</>;
    // @ts-expect-error : forward ref dynamic
    return <Component ref={ref} {...props} />;
  });

  WrappedComponent.displayName = `withPermission(${Component.displayName ?? Component.name ?? 'Component'})`;

  return WrappedComponent;
}
```

### 9.8 permission-utils.ts

```typescript
// repo/apps/web-broker/src/lib/auth/permission-utils.ts

import { type Permission } from './permissions-catalog';
import { type BrokerRole, ROLE_PERMISSIONS } from './roles-catalog';

/**
 * Verifie si userPerms contient au moins une des required.
 */
export function hasAnyPermission(userPerms: Set<Permission>, required: Permission[]): boolean {
  return required.some((p) => userPerms.has(p));
}

/**
 * Verifie si userPerms contient TOUTES les required.
 */
export function hasAllPermissions(userPerms: Set<Permission>, required: Permission[]): boolean {
  return required.every((p) => userPerms.has(p));
}

/**
 * Verifie si roleA permissions est subset de roleB.
 * Utile pour comparer hierarchie (broker_assistant subset of broker_user subset of broker_admin).
 */
export function isSubsetOfRole(roleA: BrokerRole, roleB: BrokerRole): boolean {
  const permsA = new Set(ROLE_PERMISSIONS[roleA]);
  const permsB = new Set(ROLE_PERMISSIONS[roleB]);
  for (const p of permsA) {
    if (!permsB.has(p)) return false;
  }
  return true;
}

/**
 * Retourne le set de permissions pour un role donne.
 */
export function permissionsSetForRole(role: BrokerRole): Set<Permission> {
  return new Set(ROLE_PERMISSIONS[role]);
}

/**
 * Diff entre 2 roles : permissions de roleA absentes de roleB.
 */
export function diffRolePermissions(roleA: BrokerRole, roleB: BrokerRole): Permission[] {
  const permsB = new Set(ROLE_PERMISSIONS[roleB]);
  return ROLE_PERMISSIONS[roleA].filter((p) => !permsB.has(p));
}

/**
 * Compte les permissions d'un role par niveau de sensibilite.
 */
export function countPermissionsBySensitivity(role: BrokerRole): Record<string, number> {
  const { PERMISSION_METADATA } = require('./permissions-catalog');
  const result: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const p of ROLE_PERMISSIONS[role]) {
    const sensitivity = PERMISSION_METADATA[p]?.sensitivity ?? 'medium';
    result[sensitivity]++;
  }
  return result;
}

/**
 * Pour audit / UI display : liste les permissions manquantes pour un role cible.
 */
export function missingPermissionsForRole(
  userPerms: Set<Permission>,
  targetRole: BrokerRole
): Permission[] {
  return ROLE_PERMISSIONS[targetRole].filter((p) => !userPerms.has(p));
}

/**
 * Verifie si le role peut elevation vers targetRole (le user actuel a-t-il
 * suffisamment pour creer un user avec ce role ? -- seulement broker_admin peut).
 */
export function canElevateToRole(currentRole: BrokerRole | null, targetRole: BrokerRole): boolean {
  if (currentRole !== 'broker_admin') return false;
  // Admin peut creer tous roles (admin, user, assistant)
  return true;
}
```

---

## 10. Middleware RBAC + Integration sidebar (3-4 ko)

### 10.1 middleware-rbac.ts (extension Sprint 16 task 4.3.1)

```typescript
// repo/apps/web-broker/src/middleware-rbac.ts
import { NextResponse, type NextRequest } from 'next/server';
import { decodeJwt } from 'jose';

/**
 * Extension du middleware d'auth Sprint 4 / Sprint 16 task 4.3.1.
 * Ajoute le check role pour routes sensibles.
 *
 * Routes role-gated :
 * - /{locale}/parametres/* : broker_admin uniquement
 * - /{locale}/broker-queue/escalate : broker_admin uniquement
 *
 * Note Edge Runtime : utilise `jose` (compatible Edge), pas jsonwebtoken (Node only).
 */

const ROLE_GATED_ROUTES: { pattern: RegExp; requiredRole: string; description: string }[] = [
  {
    pattern: /^\/(fr|ar-MA|ar)\/parametres(\/.*)?$/,
    requiredRole: 'broker_admin',
    description: 'Settings tenant access',
  },
];

interface JwtPayload {
  sub?: string;
  role?: string;
  tenant_id?: string;
  exp?: number;
}

export function checkRoleGatedRoute(request: NextRequest): NextResponse | null {
  const pathname = request.nextUrl.pathname;
  const accessToken = request.cookies.get('access_token')?.value;

  for (const route of ROLE_GATED_ROUTES) {
    if (route.pattern.test(pathname)) {
      // Route role-gated detectee
      if (!accessToken) {
        const locale = pathname.split('/')[1] ?? 'fr';
        return NextResponse.redirect(new URL(`/${locale}/login?redirect=${encodeURIComponent(pathname)}`, request.url));
      }

      try {
        const decoded = decodeJwt(accessToken) as JwtPayload;

        // Check expire
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
          const locale = pathname.split('/')[1] ?? 'fr';
          return NextResponse.redirect(new URL(`/${locale}/login?reason=expired`, request.url));
        }

        // Check role
        if (decoded.role !== route.requiredRole) {
          const locale = pathname.split('/')[1] ?? 'fr';
          console.warn(
            `[middleware-rbac] Role insufficient for ${pathname}: ${decoded.role} vs ${route.requiredRole}`
          );
          return NextResponse.redirect(new URL(`/${locale}/403`, request.url));
        }

        // Role OK : continue
        return null;
      } catch (err) {
        // JWT corrupted : redirect login
        const locale = pathname.split('/')[1] ?? 'fr';
        return NextResponse.redirect(new URL(`/${locale}/login?reason=invalid_token`, request.url));
      }
    }
  }

  return null; // Aucune route gated matche : continue normalement
}
```

### 10.2 Integration sidebar (modification task 4.3.3)

```typescript
// repo/apps/web-broker/src/components/layout/sidebar.tsx (extrait modifie)
'use client';

import { useTranslations } from 'next-intl';
import { HasPermission } from '@/components/auth/has-permission';
import { HasRole, AdminOnly } from '@/components/auth/has-role';
import { SidebarItem } from './sidebar-item';
import {
  HomeIcon,
  UsersIcon,
  Building2Icon,
  HandshakeIcon,
  FileTextIcon,
  ClipboardListIcon,
  AlertTriangleIcon,
  SettingsIcon,
  UserIcon,
} from 'lucide-react';

export function Sidebar() {
  const t = useTranslations('nav');

  return (
    <aside className="flex h-full flex-col gap-1 border-r bg-background p-3" aria-label={t('main_navigation')}>
      {/* Toujours visible */}
      <SidebarItem href="/dashboard" label={t('dashboard')} icon={HomeIcon} />

      <HasPermission permission="crm.contacts.read">
        <SidebarItem href="/contacts" label={t('contacts')} icon={UsersIcon} />
      </HasPermission>

      <HasPermission permission="crm.companies.read">
        <SidebarItem href="/companies" label={t('companies')} icon={Building2Icon} />
      </HasPermission>

      <HasPermission permission="crm.deals.read">
        <SidebarItem href="/deals" label={t('deals')} icon={HandshakeIcon} />
      </HasPermission>

      <HasPermission permission="insure.policies.read">
        <SidebarItem href="/polices" label={t('polices')} icon={FileTextIcon} />
      </HasPermission>

      <HasPermission permission="insure.broker_queue.read">
        <SidebarItem href="/broker-queue" label={t('broker_queue')} icon={ClipboardListIcon} />
      </HasPermission>

      <HasPermission permission="repair.sinistres.read">
        <SidebarItem href="/sinistres" label={t('sinistres')} icon={AlertTriangleIcon} />
      </HasPermission>

      {/* Parametres : broker_admin only */}
      <AdminOnly>
        <SidebarItem href="/parametres" label={t('parametres')} icon={SettingsIcon} />
      </AdminOnly>

      {/* Profile : toujours visible */}
      <SidebarItem href="/profile" label={t('profile')} icon={UserIcon} />
    </aside>
  );
}
```

### 10.3 Integration action buttons (extraits)

```typescript
// Page contacts : Delete button
import { HasPermission } from '@/components/auth/has-permission';

<HasPermission
  permission="crm.contacts.delete"
  fallback={
    <Button variant="destructive" disabled title="Vous n'avez pas la permission de supprimer">
      Supprimer
    </Button>
  }
>
  <Button variant="destructive" onClick={handleDelete}>
    Supprimer
  </Button>
</HasPermission>

// Page polices : Cancel policy (sensitive)
<HasPermission permission="insure.policies.cancel">
  <Button variant="destructive" onClick={() => setShowCancelDialog(true)}>
    Resilier police
  </Button>
</HasPermission>

// Page broker-queue : Validate
<HasPermission permission="insure.broker_queue.validate">
  <Button variant="default" onClick={handleValidate}>
    Valider dossier
  </Button>
</HasPermission>

// Page broker-queue : Escalate (admin only)
<HasRole role="broker_admin">
  <Button variant="outline" onClick={handleEscalate}>
    Escalader
  </Button>
</HasRole>

// Page parametres : Invite user
<HasPermission permission="tenant.users.invite">
  <Button onClick={() => setShowInviteDialog(true)}>
    Inviter un utilisateur
  </Button>
</HasPermission>

// Form field : Commission rate input (during validate)
<HasPermission
  permission="insure.broker_queue.commission_set"
  fallback={
    <Input value={defaultCommissionRate} disabled aria-describedby="commission-locked-tooltip" />
  }
>
  <Input value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} />
</HasPermission>
```

---

## 11. Tests Unitaires Vitest (3-4 ko)

### 11.1 use-permissions.spec.tsx

```typescript
// repo/apps/web-broker/test/lib/auth/use-permissions.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PermissionProvider } from '@/lib/auth/has-permission-context';
import { useUserPermissions } from '@/lib/auth/use-permissions';

// Mock fetch /api/auth/me
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <PermissionProvider>{children}</PermissionProvider>
    </QueryClientProvider>
  );
}

// Helper : generate fake JWT
function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake_signature`;
}

describe('useUserPermissions', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('decodes valid JWT and returns user data', async () => {
    const jwt = makeJwt({
      sub: 'user-123',
      tenant_id: 'tenant-abc',
      role: 'broker_admin',
      permissions: ['crm.contacts.read', 'crm.contacts.delete', 'tenant.settings.write'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: jwt }),
    });

    const { result } = renderHook(() => useUserPermissions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    expect(result.current.userId).toBe('user-123');
    expect(result.current.tenantId).toBe('tenant-abc');
    expect(result.current.role).toBe('broker_admin');
    expect(result.current.permissions.size).toBe(3);
    expect(result.current.permissions.has('crm.contacts.delete')).toBe(true);
  });

  it('returns empty state if JWT expired', async () => {
    const expiredJwt = makeJwt({
      sub: 'user-1',
      tenant_id: 't-1',
      role: 'broker_user',
      permissions: ['crm.contacts.read'],
      exp: Math.floor(Date.now() / 1000) - 3600,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: expiredJwt }),
    });

    const { result } = renderHook(() => useUserPermissions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.role).toBe(null);
    expect(result.current.permissions.size).toBe(0);
  });

  it('returns empty state if JWT corrupted', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'corrupted.jwt.token' }),
    });

    const { result } = renderHook(() => useUserPermissions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns empty state if /api/auth/me returns 401', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useUserPermissions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('filters out unknown permissions from catalog', async () => {
    const jwt = makeJwt({
      sub: 'u-1',
      tenant_id: 't-1',
      role: 'broker_user',
      permissions: ['crm.contacts.read', 'unknown.fake.permission', 'crm.deals.write'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: jwt }),
    });

    const { result } = renderHook(() => useUserPermissions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    expect(result.current.permissions.has('crm.contacts.read' as any)).toBe(true);
    expect(result.current.permissions.has('crm.deals.write' as any)).toBe(true);
    expect(result.current.permissions.size).toBe(2); // unknown filtre
  });

  it('exposes refresh function that refetches JWT', async () => {
    const jwt = makeJwt({
      sub: 'u-1',
      tenant_id: 't-1',
      role: 'broker_user',
      permissions: ['crm.contacts.read'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: jwt }),
    });

    const { result } = renderHook(() => useUserPermissions(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));

    expect(typeof result.current.refresh).toBe('function');
    await result.current.refresh();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
```

### 11.2 use-permission.spec.tsx

```typescript
// repo/apps/web-broker/test/lib/auth/use-permission.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PermissionProvider } from '@/lib/auth/has-permission-context';
import { usePermission, useRole, useIsAdmin, useHasAnyPermission, useHasAllPermissions } from '@/lib/auth/use-permission';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake_signature`;
}

function setupContext(role: string, permissions: string[]) {
  const jwt = makeJwt({
    sub: 'u-1',
    tenant_id: 't-1',
    role,
    permissions,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: jwt }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <PermissionProvider>{children}</PermissionProvider>
    </QueryClientProvider>
  );
}

describe('usePermission', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns true when user has the permission', async () => {
    const wrapper = setupContext('broker_admin', ['crm.contacts.delete']);
    const { result } = renderHook(() => usePermission('crm.contacts.delete'), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('returns false when user lacks the permission', async () => {
    const wrapper = setupContext('broker_assistant', ['crm.contacts.read']);
    const { result } = renderHook(() => usePermission('crm.contacts.delete'), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('returns false when not authenticated', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: any) => (
      <QueryClientProvider client={queryClient}>
        <PermissionProvider>{children}</PermissionProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(() => usePermission('crm.contacts.read'), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('useRole', () => {
  beforeEach(() => mockFetch.mockReset());

  it('matches single role', async () => {
    const wrapper = setupContext('broker_admin', []);
    const { result } = renderHook(() => useRole('broker_admin'), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('matches role from array (any-match)', async () => {
    const wrapper = setupContext('broker_user', []);
    const { result } = renderHook(() => useRole(['broker_admin', 'broker_user']), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('returns false when role not in array', async () => {
    const wrapper = setupContext('broker_assistant', []);
    const { result } = renderHook(() => useRole(['broker_admin', 'broker_user']), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('useIsAdmin', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns true for broker_admin', async () => {
    const wrapper = setupContext('broker_admin', []);
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('returns false for broker_user', async () => {
    const wrapper = setupContext('broker_user', []);
    const { result } = renderHook(() => useIsAdmin(), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });
});

describe('useHasAnyPermission / useHasAllPermissions', () => {
  beforeEach(() => mockFetch.mockReset());

  it('useHasAnyPermission returns true if any matches', async () => {
    const wrapper = setupContext('broker_user', ['crm.contacts.read']);
    const { result } = renderHook(
      () => useHasAnyPermission(['crm.contacts.delete', 'crm.contacts.read']),
      { wrapper }
    );
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('useHasAllPermissions returns false if any missing', async () => {
    const wrapper = setupContext('broker_user', ['crm.contacts.read']);
    const { result } = renderHook(
      () => useHasAllPermissions(['crm.contacts.read', 'crm.contacts.delete']),
      { wrapper }
    );
    await waitFor(() => expect(result.current).toBe(false));
  });
});
```

### 11.3 permissions-catalog.spec.ts

```typescript
// repo/apps/web-broker/test/lib/auth/permissions-catalog.spec.ts
import { describe, it, expect } from 'vitest';
import {
  PERMISSIONS,
  getAllPermissions,
  isValidPermission,
  getPermissionSensitivity,
  getPermissionsByVertical,
} from '@/lib/auth/permissions-catalog';

describe('permissions-catalog', () => {
  it('contains exactly 85 permissions', () => {
    expect(getAllPermissions()).toHaveLength(85);
  });

  it('isValidPermission rejects unknown', () => {
    expect(isValidPermission('crm.contacts.delete')).toBe(true);
    expect(isValidPermission('fake.permission.xyz')).toBe(false);
    expect(isValidPermission('')).toBe(false);
  });

  it('getPermissionSensitivity returns valid level', () => {
    expect(getPermissionSensitivity('crm.contacts.delete')).toBe('high');
    expect(getPermissionSensitivity('insure.policies.cancel')).toBe('critical');
    expect(getPermissionSensitivity('crm.contacts.read')).toBe('low');
  });

  it('all permission codes follow {vertical}.{resource}.{action} convention', () => {
    for (const p of getAllPermissions()) {
      const parts = p.split('.');
      expect(parts.length).toBeGreaterThanOrEqual(2);
      expect(parts.length).toBeLessThanOrEqual(3);
    }
  });

  it('getPermissionsByVertical returns subset', () => {
    const crmPerms = getPermissionsByVertical('crm');
    expect(crmPerms.length).toBeGreaterThan(0);
    expect(crmPerms.every((p) => p.startsWith('crm.'))).toBe(true);
  });
});
```

### 11.4 permission-utils.spec.ts

```typescript
// repo/apps/web-broker/test/lib/auth/permission-utils.spec.ts
import { describe, it, expect } from 'vitest';
import {
  hasAnyPermission,
  hasAllPermissions,
  isSubsetOfRole,
  permissionsSetForRole,
  diffRolePermissions,
} from '@/lib/auth/permission-utils';

describe('permission-utils', () => {
  it('hasAnyPermission returns true if any present', () => {
    const userPerms = new Set(['crm.contacts.read', 'crm.deals.read'] as any);
    expect(hasAnyPermission(userPerms as any, ['crm.contacts.delete', 'crm.contacts.read'])).toBe(true);
  });

  it('hasAllPermissions returns false if any missing', () => {
    const userPerms = new Set(['crm.contacts.read'] as any);
    expect(hasAllPermissions(userPerms as any, ['crm.contacts.read', 'crm.contacts.delete'])).toBe(false);
  });

  it('isSubsetOfRole : assistant subset of user subset of admin', () => {
    expect(isSubsetOfRole('broker_assistant', 'broker_user')).toBe(true);
    expect(isSubsetOfRole('broker_user', 'broker_admin')).toBe(true);
    expect(isSubsetOfRole('broker_admin', 'broker_assistant')).toBe(false);
  });

  it('permissionsSetForRole returns proper set', () => {
    const adminSet = permissionsSetForRole('broker_admin');
    expect(adminSet.has('insure.policies.cancel' as any)).toBe(true);

    const assistantSet = permissionsSetForRole('broker_assistant');
    expect(assistantSet.has('insure.policies.cancel' as any)).toBe(false);
  });

  it('diffRolePermissions reveals admin-only permissions', () => {
    const diff = diffRolePermissions('broker_admin', 'broker_user');
    expect(diff).toContain('insure.policies.cancel');
    expect(diff).toContain('tenant.settings.write');
  });
});
```

### 11.5 has-permission.spec.tsx

```typescript
// repo/apps/web-broker/test/components/auth/has-permission.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PermissionProvider } from '@/lib/auth/has-permission-context';
import { HasPermission } from '@/components/auth/has-permission';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake_signature`;
}

function renderWithRole(role: string, permissions: string[], ui: React.ReactNode) {
  const jwt = makeJwt({
    sub: 'u-1',
    tenant_id: 't-1',
    role,
    permissions,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: jwt }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PermissionProvider>{ui}</PermissionProvider>
    </QueryClientProvider>
  );
}

describe('<HasPermission>', () => {
  beforeEach(() => mockFetch.mockReset());

  it('renders children when user has permission', async () => {
    renderWithRole(
      'broker_admin',
      ['crm.contacts.delete'],
      <HasPermission permission="crm.contacts.delete">
        <button>Delete</button>
      </HasPermission>
    );

    await waitFor(() => expect(screen.queryByText('Delete')).toBeInTheDocument());
  });

  it('renders fallback when user lacks permission', async () => {
    renderWithRole(
      'broker_assistant',
      ['crm.contacts.read'],
      <HasPermission permission="crm.contacts.delete" fallback={<span>No access</span>}>
        <button>Delete</button>
      </HasPermission>
    );

    await waitFor(() => expect(screen.queryByText('No access')).toBeInTheDocument());
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('renders null when no fallback + lacks permission', async () => {
    const { container } = renderWithRole(
      'broker_assistant',
      [],
      <HasPermission permission="crm.contacts.delete">
        <button>Delete</button>
      </HasPermission>
    );

    await waitFor(() => {
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
    });
  });

  it('renders disabled version with showAsDisabled prop', async () => {
    renderWithRole(
      'broker_assistant',
      [],
      <HasPermission permission="crm.contacts.delete" showAsDisabled>
        <button>Delete</button>
      </HasPermission>
    );

    await waitFor(() => {
      const wrapper = screen.queryByText('Delete')?.parentElement;
      expect(wrapper).toHaveAttribute('aria-disabled', 'true');
    });
  });

  it('handles nested HasPermission correctly', async () => {
    renderWithRole(
      'broker_admin',
      ['crm.contacts.read', 'crm.contacts.delete'],
      <HasPermission permission="crm.contacts.read">
        <div>
          <HasPermission permission="crm.contacts.delete">
            <button>Nested Delete</button>
          </HasPermission>
        </div>
      </HasPermission>
    );

    await waitFor(() => expect(screen.queryByText('Nested Delete')).toBeInTheDocument());
  });
});
```

### 11.6 has-role.spec.tsx

```typescript
// repo/apps/web-broker/test/components/auth/has-role.spec.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PermissionProvider } from '@/lib/auth/has-permission-context';
import { HasRole } from '@/components/auth/has-role';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

function makeJwt(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fake_signature`;
}

function renderWithRole(role: string, ui: React.ReactNode) {
  const jwt = makeJwt({
    sub: 'u-1',
    tenant_id: 't-1',
    role,
    permissions: [],
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: jwt }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PermissionProvider>{ui}</PermissionProvider>
    </QueryClientProvider>
  );
}

describe('<HasRole>', () => {
  beforeEach(() => mockFetch.mockReset());

  it('renders children for matching single role', async () => {
    renderWithRole(
      'broker_admin',
      <HasRole role="broker_admin">
        <div>Admin Panel</div>
      </HasRole>
    );
    await waitFor(() => expect(screen.queryByText('Admin Panel')).toBeInTheDocument());
  });

  it('renders children for any role in array', async () => {
    renderWithRole(
      'broker_user',
      <HasRole role={['broker_admin', 'broker_user']}>
        <div>Staff Area</div>
      </HasRole>
    );
    await waitFor(() => expect(screen.queryByText('Staff Area')).toBeInTheDocument());
  });

  it('renders fallback for non-matching role', async () => {
    renderWithRole(
      'broker_assistant',
      <HasRole role="broker_admin" fallback={<span>Restricted</span>}>
        <div>Admin Panel</div>
      </HasRole>
    );
    await waitFor(() => expect(screen.queryByText('Restricted')).toBeInTheDocument());
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });
});
```

---

## 12. Tests E2E Playwright (3-4 ko)

### 12.1 Setup helpers + auth fixtures

```typescript
// repo/e2e/web/fixtures/rbac-helpers.ts
import { type Page } from '@playwright/test';

export interface BrokerTestUser {
  email: string;
  password: string;
  role: 'broker_admin' | 'broker_user' | 'broker_assistant';
}

export const TEST_USERS: Record<string, BrokerTestUser> = {
  admin: {
    email: 'admin-test@broker.skalean-insurtech.ma',
    password: 'Test@AdminPass123',
    role: 'broker_admin',
  },
  user: {
    email: 'user-test@broker.skalean-insurtech.ma',
    password: 'Test@UserPass123',
    role: 'broker_user',
  },
  assistant: {
    email: 'assistant-test@broker.skalean-insurtech.ma',
    password: 'Test@AssistantPass123',
    role: 'broker_assistant',
  },
};

export async function loginAs(page: Page, user: BrokerTestUser) {
  await page.goto('/fr/login');
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="password"]', user.password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

export async function expectSidebarItems(page: Page, expected: string[], notExpected: string[]) {
  for (const label of expected) {
    await page.locator(`aside a:has-text("${label}")`).first().waitFor({ state: 'visible' });
  }
  for (const label of notExpected) {
    await page.locator(`aside a:has-text("${label}")`).first().waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {
      throw new Error(`Sidebar item "${label}" should not be visible for this role`);
    });
  }
}
```

### 12.2 rbac-broker-admin.spec.ts

```typescript
// repo/e2e/web/rbac-broker-admin.spec.ts
import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS, expectSidebarItems } from './fixtures/rbac-helpers';

test.describe('RBAC broker_admin role', () => {
  test('admin sees Parametres in sidebar', async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await expectSidebarItems(
      page,
      ['Tableau de bord', 'Contacts', 'Societes', 'Deals', 'Polices', 'File de validation', 'Sinistres', 'Parametres', 'Profil'],
      []
    );
  });

  test('admin can access /parametres page', async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await page.goto('/fr/parametres');
    await expect(page).toHaveURL(/.*parametres$/);
    await expect(page.locator('h1')).toContainText(/parametres/i);
  });

  test('admin sees Cancel Policy button on policy detail', async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    // Naviguer vers une police seed test
    await page.goto('/fr/polices/SEED-POLICY-001');
    await expect(page.locator('button:has-text("Resilier")')).toBeVisible();
  });

  test('admin sees Invite User button on parametres', async ({ page }) => {
    await loginAs(page, TEST_USERS.admin);
    await page.goto('/fr/parametres');
    await page.click('button:has-text("Utilisateurs")');
    await expect(page.locator('button:has-text("Inviter")')).toBeVisible();
  });
});
```

### 12.3 rbac-broker-user.spec.ts

```typescript
// repo/e2e/web/rbac-broker-user.spec.ts
import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS } from './fixtures/rbac-helpers';

test.describe('RBAC broker_user role', () => {
  test('user does NOT see Parametres in sidebar', async ({ page }) => {
    await loginAs(page, TEST_USERS.user);
    await expect(page.locator('aside a:has-text("Parametres")')).not.toBeVisible();
  });

  test('user accessing /parametres directly is redirected to /403', async ({ page }) => {
    await loginAs(page, TEST_USERS.user);
    await page.goto('/fr/parametres');
    await page.waitForURL(/\/403/);
    await expect(page.locator('h1')).toContainText(/(acces refuse|interdit|denied)/i);
  });

  test('user sees Delete Contact button but NOT Cancel Policy', async ({ page }) => {
    await loginAs(page, TEST_USERS.user);
    await page.goto('/fr/contacts');
    await expect(page.locator('button:has-text("Supprimer")').first()).toBeVisible();

    await page.goto('/fr/polices/SEED-POLICY-001');
    await expect(page.locator('button:has-text("Resilier")')).not.toBeVisible();
  });
});
```

### 12.4 rbac-broker-assistant.spec.ts

```typescript
// repo/e2e/web/rbac-broker-assistant.spec.ts
import { test, expect, request } from '@playwright/test';
import { loginAs, TEST_USERS } from './fixtures/rbac-helpers';

test.describe('RBAC broker_assistant role', () => {
  test('assistant does NOT see Parametres or Broker Queue in sidebar', async ({ page }) => {
    await loginAs(page, TEST_USERS.assistant);
    await expect(page.locator('aside a:has-text("Parametres")')).not.toBeVisible();
    await expect(page.locator('aside a:has-text("File de validation")')).not.toBeVisible();
  });

  test('assistant does NOT see Delete Contact button', async ({ page }) => {
    await loginAs(page, TEST_USERS.assistant);
    await page.goto('/fr/contacts');
    await expect(page.locator('button:has-text("Supprimer")').first()).not.toBeVisible();
  });

  test('assistant does NOT see Cancel Policy nor Validate Queue buttons', async ({ page }) => {
    await loginAs(page, TEST_USERS.assistant);
    await page.goto('/fr/polices/SEED-POLICY-001');
    await expect(page.locator('button:has-text("Resilier")')).not.toBeVisible();
    await expect(page.locator('button:has-text("Suspendre")')).not.toBeVisible();
  });

  test('backend rejects 403 if assistant bypasses UI to delete contact', async ({ page, context }) => {
    await loginAs(page, TEST_USERS.assistant);
    // Recuperer cookies de session
    const cookies = await context.cookies();
    const accessTokenCookie = cookies.find((c) => c.name === 'access_token');
    expect(accessTokenCookie).toBeDefined();

    // Tentative bypass : appel direct API DELETE sans passer par UI
    const apiContext = await request.newContext({
      baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
      extraHTTPHeaders: {
        Authorization: `Bearer ${accessTokenCookie!.value}`,
      },
    });
    const response = await apiContext.delete('/api/v1/crm/contacts/SEED-CONTACT-001');
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error?.code).toMatch(/permission_denied|forbidden/i);
  });
});
```

---

## 13. Criteres validation V1-V25 (3-4 ko)

| ID | Niveau | Description |
|----|--------|-------------|
| V1 | P0 | `useUserPermissions()` retourne `{ userId, tenantId, role, permissions: Set<Permission> }` apres mount avec JWT valide |
| V2 | P0 | `usePermission(p)` retourne true si user a la permission, false sinon |
| V3 | P0 | `useRole(r)` supporte string unique ET array (any-match), retourne boolean correct |
| V4 | P0 | `useIsAdmin()` shortcut equivalent `useRole('broker_admin')` |
| V5 | P0 | `<HasPermission permission="...">` cache children si manque permission |
| V6 | P0 | `<HasPermission fallback={...}>` render fallback si manque |
| V7 | P0 | `<HasPermission>` render null si pas de fallback + manque |
| V8 | P0 | `<HasRole>` supporte array roles avec any-match logic |
| V9 | P0 | `<RequirePermission>` redirect `/403` si manque permission au mount |
| V10 | P0 | `<RequireRole>` redirect `/403` si manque role |
| V11 | P0 | Page `/403` render `<PermissionDenied />` localise avec WCAG 2.1 AA conformity |
| V12 | P0 | Catalogue `permissions-catalog.ts` exporte exactement 85 permissions typees |
| V13 | P0 | Mapping `ROLE_PERMISSIONS` couvre 3 roles broker (admin/user/assistant) avec bonnes permissions |
| V14 | P0 | JWT corrupted -> `isAuthenticated: false` sans crash |
| V15 | P0 | JWT expire -> `isAuthenticated: false` sans crash |
| V16 | P0 | Sidebar items conditional : Parametres visible broker_admin only, Broker Queue visible admin+user, Sinistres visible all |
| V17 | P0 | Action buttons conditional : Delete Contact visible admin+user, Cancel Policy visible admin only, Validate Queue visible admin+user |
| V18 | P0 | Backend rejette curl bypass UI : `curl -X DELETE /api/v1/crm/contacts/:id -H "Authorization: Bearer ${assistant_token}"` retourne 403 |
| V19 | P0 | Middleware-rbac.ts redirige `/parametres/*` vers `/403` si role != broker_admin |
| V20 | P0 | Tenant switch : refresh JWT + invalidate permission context (refetchOnWindowFocus) |
| V21 | P1 | Tests Vitest 25+ passent (use-permissions 6 + use-permission 8 + catalog 5 + utils 5 + components has-* 8 = 32) |
| V22 | P1 | Tests Playwright E2E 10+ passent (admin 4 + user 3 + assistant 4 = 11) |
| V23 | P1 | HOC `withPermission` forward refs proprement et preserve displayName pour debugging |
| V24 | P1 | Hook `useUserPermissionsList()` retourne array trie pour affichage profile/security |
| V25 | P1 | `permission-utils.ts` exporte `isSubsetOfRole`, `diffRolePermissions`, `missingPermissionsForRole` testes |
| V26 | P2 | Accessibilite : page 403 focus management heading au mount (tabIndex -1) |
| V27 | P2 | Accessibilite : `aria-live="polite"` annonce screen reader changement permission denied |
| V28 | P2 | Performance : `Set<Permission>` O(1) lookup verifie via benchmark < 1ms pour 100 checks |
| V29 | P2 | DevX : warning `console.warn` en dev si `usePermission('typo')` permission inexistante du catalogue |

---

## 14. Edge cases (10 EC) (2-3 ko)

### EC-01 : JWT corrupted (tampered ou format invalide)

**Scenario** : Utilisateur modifie son cookie `access_token` (impossible avec httpOnly mais imaginons DevTools). Le JWT n'est plus parseable par `jose.decodeJwt`.

**Comportement attendu** : Hook `useUserPermissions` retourne `isAuthenticated: false`, permissions vide. UI render comme si user non-loge. Middleware d'auth redirige `/login` au prochain navigation.

**Test** : V14 -- `parseJwt('corrupted.jwt.token')` retourne null sans throw.

### EC-02 : Permission unknown / typo dans le code

**Scenario** : Developpeur ecrit `usePermission('crm.contact.delete')` (singular au lieu de pluriel). TypeScript compile-time error grace au type union exhaustive.

**Comportement attendu** : Build fail compile-time. Si forced (`as any`), runtime warn `console.warn` en dev mode.

**Test** : V29 -- assertion test compile-time TypeScript + warn dev.

### EC-03 : Role changed mid-session (admin demote user)

**Scenario** : Pendant que broker_user est connecte, admin change son role en broker_assistant. Le JWT actuel garde le role broker_user jusqu'a expiration (15min defaut).

**Comportement attendu** : Refresh token rotation Sprint 5 emet nouveau JWT a l'expiration avec role mis a jour. `refetchOnWindowFocus` declenche refetch automatique a la prochaine action.

**Mitigation** : Permettre admin de forcer logout user (Sprint 7 endpoint `/users/:id/revoke-sessions`).

### EC-04 : HasPermission deeply nested

**Scenario** : Imbrication multiple de `<HasPermission>` pour combinations AND.

```tsx
<HasPermission permission="crm.contacts.read">
  <HasPermission permission="crm.contacts.write">
    <HasPermission permission="crm.contacts.delete">
      <BulkDeleteButton />
    </HasPermission>
  </HasPermission>
</HasPermission>
```

**Comportement attendu** : O(n) lookups, chaque niveau Set check O(1). Performance acceptable (< 1ms total).

**Alternative** : `<HasAllPermissions permissions={['crm.contacts.read', 'crm.contacts.write', 'crm.contacts.delete']}>` plus lisible.

### EC-05 : Hydration mismatch SSR vs client

**Scenario** : Server render n'a pas acces au JWT (cookie httpOnly). SSR render "tout cache" par defaut. Client hydration decode JWT et reveal items.

**Comportement attendu** : Flash visible 50-100ms. Skeleton placeholder pendant le mount + `suppressHydrationWarning` selectif evite warnings React.

**Mitigation acceptable** : Le temps de hydration etant tres court (< 200ms), l'UX reste fluide. Si critique pour SEO, considerer Server Component avec `await getServerPermissions()` -- mais Sprint 16 reste client-side.

### EC-06 : JWT expire pendant action utilisateur

**Scenario** : User clique "Delete Contact" 15min apres login. JWT expire. Backend retourne 401.

**Comportement attendu** : API client intercepteur (Sprint 4 task 1.4.1) detecte 401, declenche refresh token rotation, retry l'action une fois. Si refresh echoue, redirect `/login`.

### EC-07 : Refresh token rotation avec permissions modifiees

**Scenario** : User a perdu une permission entre l'ancien et le nouveau JWT (admin l'a retire). Le nouveau JWT a moins de permissions.

**Comportement attendu** : `PermissionProvider` recoit le nouveau JWT (refetchOnWindowFocus ou refresh explicit), recompute permissions set. UI re-render avec nouveau set -- boutons disparaissent dynamiquement.

### EC-08 : Multiple roles same user (impossible)

**Scenario** : Tentative de stocker plusieurs roles dans le JWT claim `role` (e.g. `['broker_admin', 'broker_user']`).

**Comportement attendu** : Le contrat backend Sprint 7 stipule **un seul role per user per tenant**. Si le JWT contient un array, le code prend le premier element ou rejette. Le mecanisme **multi-role** se materialise via `permissions` array (union des roles).

**Note** : Si user multi-tenant, role peut differer par tenant. Le tenant_id dans JWT determine quel role est actif.

### EC-09 : Permissions cached stale apres tenant switch

**Scenario** : User switch de tenant A (role broker_admin) vers tenant B (role broker_user). Le JWT du tenant B contient le role broker_user.

**Comportement attendu** : Le tenant switcher Sprint 16 task 4.3.3 declenche `/api/auth/switch-tenant` qui emet nouveau JWT. Le `PermissionProvider` listener sur la mutation TanStack Query invalide le cache `['auth', 'current-jwt']` et refetch.

### EC-10 : Locale-aware error messages

**Scenario** : Page 403 doit afficher message localise fr/ar-MA/ar selon URL.

**Comportement attendu** : Component `PermissionDenied` utilise `useTranslations('errors.permission_denied')` qui consume les fichiers `messages/{fr,ar-MA,ar}.json` Sprint 16 task 4.3.13. Texte direction-aware (RTL pour ar/ar-MA).

**Keys traductions** :
- `errors.permission_denied.title` : "Acces refuse" / "ممنوع الدخول" / "غير مسموح بالوصول"
- `errors.permission_denied.description` : "Vous n'avez pas les droits..." / "..."
- `errors.permission_denied.current_role` : "Votre role actuel : {role}"
- `errors.permission_denied.back_to_dashboard` : "Retour au tableau de bord"
- `errors.permission_denied.contact_support` : "Contacter le support"

---

## 15. Conformite reglementaire MA (2-3 ko)

### Loi 09-08 CNDP (Protection donnees personnelles)

**Article 23 -- Principe de proportionnalite** :
> "Les donnees a caractere personnel doivent etre adequates, pertinentes et non excessives au regard des finalites pour lesquelles elles sont collectees..."

**Application RBAC UI** :
- Chaque utilisateur a strictement les permissions minimales necessaires a sa fonction.
- Materialise via `ROLE_PERMISSIONS` mapping limite -- broker_assistant a 10 permissions vs broker_admin 30.
- Acces aux donnees CRM/Insure proportionne au role.

**Article 11 -- Droit d'acces** :
> "La personne concernee a le droit d'obtenir... la communication des donnees la concernant..."

**Application RBAC UI** :
- Page `/profile/security` (Sprint 16 task 4.3.11) affiche liste permissions effectives via `useUserPermissionsList()`.
- L'utilisateur peut consulter en transparence ce a quoi il a acces (transparence droit acces).

### ACAPS (Autorite de Controle des Assurances)

**Reglement 2018 sur courtiers d'assurance** :
- Article 12 : tracabilite des decisions metier obligatoire.
- Application : audit-log Sprint 7 capture chaque decision RBAC backend (permission_granted/permission_denied).
- L'auditeur ACAPS peut consulter qui a effectue quelles actions sur quelles polices, avec quel role.

**Article 18 -- Separation des taches** :
- Application : broker_admin (decisions strategiques cancel/transfer) separe de broker_user (operations quotidiennes) separe de broker_assistant (lecture+create limite).
- Empeche un seul utilisateur d'effectuer une operation critique sans validation.

### Loi 31-08 (Protection consommateurs)

**Transparence droits d'acces** :
- L'utilisateur peut consulter ses permissions actuelles dans `/profile/security`.
- Materialise via `useUserPermissionsList()` retournant array trie + traduction labels.

### Loi 53-05 (Echange electronique de donnees juridiques)

**Article 6 -- Authentification forte** :
- MFA (Sprint 5 + 4.3.11) + RBAC granulaire = authentification forte au sens reglementaire.
- Niveau d'assurance Eleve (eIDAS-equivalent) pour les actions critiques (cancel police).

**Article 13 -- Tracabilite signature electronique** :
- Action `docs.documents.sign` (permission critical) auditee en append-only.
- Limited a roles autorises (broker_admin pour signatures broker, expert_sinistre pour signatures sinistres).

### WCAG 2.1 AA (Accessibilite)

**Critere 1.4.3 -- Contraste minimum** :
- Page 403 contraste 4.5:1 verifie (text destructive sur background light/dark).
- Bouton retour : contraste 4.5:1 sur background hover.

**Critere 2.1.1 -- Clavier complet** :
- Navigation page 403 entierement au clavier (Tab focus heading, links accessibles).

**Critere 2.4.3 -- Ordre de focus logique** :
- Focus auto sur heading principal au mount via `tabIndex={-1}` + `useEffect`.
- Tab order : heading -> description -> buttons (Back / Support).

**Critere 4.1.3 -- Status messages** :
- `<div role="alert" aria-live="polite">` annonce changement permission denied aux screen readers.

---

## 16. Conventions completes (20+ section) (2-3 ko)

### CN-01 -- Nommage permission code
`{vertical}.{resource}.{action}` -- snake_case, lowercase. Ex: `crm.contacts.delete`, `insure.policies.cancel`, `tenant.users.invite`.

### CN-02 -- Nommage role code
`{scope}_{level}` -- snake_case. Ex: `broker_admin`, `broker_user`, `broker_assistant`. Scope = vertical metier (broker/garage/customer), level = admin/user/assistant/owner.

### CN-03 -- Hooks naming pattern
`use{Action}` ou `use{Resource}`. Ex: `usePermission`, `useRole`, `useIsAdmin`, `useUserPermissions`. Toujours camelCase.

### CN-04 -- Components naming pattern
`<HasX>` pour conditional render. `<RequireX>` pour redirect-based protection. `<XDenied>` pour error UI. PascalCase.

### CN-05 -- Type union Permission
Type exhaustive via `as const` sur object constant. Permet TypeScript autocomplete + erreur compile sur typo.

### CN-06 -- Catalogue source de verite
`permissions-catalog.ts` est SOURCE DE VERITE frontend. Doit etre synchro avec backend Sprint 7 seed. Idealement genere automatiquement depuis OpenAPI Sprint 17+.

### CN-07 -- Set<Permission> pour lookups
Utiliser `Set<Permission>` (O(1) has) plutot que `Permission[]` (O(n) includes) pour les checks dans hooks.

### CN-08 -- Defense en profondeur obligatoire
Tout `<HasPermission>` UI doit avoir un equivalent backend `@RequirePermissions` Sprint 7. Code review check.

### CN-09 -- Pas de cache localStorage
Permissions JAMAIS stockees en localStorage (shared device risk). Recalculees via JWT decode a chaque mount.

### CN-10 -- Pas de signature verify cote client
`jose.decodeJwt()` extract payload SANS verifier signature. Verification = backend uniquement.

### CN-11 -- Locale-aware error messages
Toute page d'erreur RBAC (403, 401) doit etre traduite fr/ar-MA/ar avec keys dans `messages/*.json`.

### CN-12 -- Accessibilite WCAG AA
Page 403 : `role="alert"`, `aria-live="polite"`, focus management heading, contraste 4.5:1.

### CN-13 -- Tests coverage minimum
Hooks : 6+ tests par hook (granted/missing/auth/unauth/empty/edge). Components : 3+ tests (renders OK / fallback / null). E2E : 1 scenario par role broker.

### CN-14 -- Linter check unused permission
ESLint custom rule (Sprint 17+) : detecte `usePermission('xxx')` ou xxx n'existe pas dans catalogue.

### CN-15 -- Naming HOC
`with{Permission|Role}` -- `withPermission`, `withRole`. ForwardRef obligatoire pour compat lib refs.

### CN-16 -- Redirect path conventions
`/403` pour permission/role denied. `/401` pour auth expired (avant redirect /login). `/404` pour route inexistante.

### CN-17 -- Middleware Edge Runtime compat
`middleware-rbac.ts` doit utiliser uniquement APIs Edge-compatible (`jose` OK, `jsonwebtoken` NOT OK car Node-only).

### CN-18 -- Async refresh on focus
`refetchOnWindowFocus: true` sur query JWT capture role changes mid-session sans polling.

### CN-19 -- Skeleton loading pendant verification
`<RequirePermission showLoadingState={true}>` affiche skeleton (pas spinner) pendant verification.

### CN-20 -- Audit-log uniquement backend
Frontend ne loggue PAS d'audit RBAC (volume eleve, non-fiable). Seul backend Sprint 7 ecrit `audit_events`.

### CN-21 -- Tooltip pour buttons disabled
Si bouton cache via `<HasPermission fallback={<DisabledTooltip text="...">}>`, le tooltip informe pourquoi.

### CN-22 -- No emoji absolu (decision-006)
Aucun emoji dans messages d'erreur, labels, tooltips. Accents fr et caracteres ar OK.

### CN-23 -- HasPermission au-dessus de Router
`<HasPermission>` se place dans le contenu JSX. `<RequirePermission>` peut wrapper page entiere.

### CN-24 -- Pages publiques exception
Pages auth (login/signup/forgot-password) ne sont PAS wrapped dans `<PermissionProvider>` car pas de user authentifie. Le provider est dans `(protected)` layout.

### CN-25 -- Permission sensitivity affichage dev
En dev mode uniquement, afficher badge sensitivity (`critical`/`high`/etc.) a cote du nom permission dans profile -> debug + decouvrabilite.

---

## 17. Anti-patterns a EVITER (1-2 ko)

### AP-01 : Trust UI for security decisions

**Mauvais** :
```tsx
<HasPermission permission="crm.contacts.delete">
  <Button onClick={() => api.delete(contactId)}>Delete</Button>
</HasPermission>
```

**Bon** : UI cache le bouton ET backend valide aussi. Si user bypass UI, backend rejette 403. La couche UI est UX only.

### AP-02 : Stocker permissions en localStorage

**Mauvais** : `localStorage.setItem('permissions', JSON.stringify(perms))` -- leak sur shared device.

**Bon** : Stockage en memoire React Context uniquement. Recalcule a chaque mount.

### AP-03 : Verifier signature JWT cote client

**Mauvais** : `jose.jwtVerify(token, secretKey)` cote client -- secretKey ne doit JAMAIS quitter le backend.

**Bon** : `jose.decodeJwt(token)` extrait payload sans verifier signature. Signature verifiee backend uniquement.

### AP-04 : Hardcoder roles dans business logic

**Mauvais** :
```tsx
if (user.role === 'broker_admin' || user.role === 'broker_user') {
  // show delete button
}
```

**Bon** :
```tsx
const canDelete = usePermission('crm.contacts.delete');
if (canDelete) { /* ... */ }
```

Pourquoi : Si on ajoute un 4eme role broker (e.g. `broker_supervisor`), la logique hardcoded casse. Permission-based scale.

### AP-05 : `if (role === ...)` au lieu de `useRole`

**Mauvais** : `const { role } = useUserPermissions(); if (role === 'broker_admin') ...`

**Bon** : `const isAdmin = useIsAdmin();`

Pourquoi : useRole supporte array et fait memoization.

### AP-06 : Permissions inline strings

**Mauvais** : `usePermission('crm.contats.delete')` -- typo non detectee.

**Bon** : Type union `Permission` TypeScript catch erreur compile-time.

### AP-07 : Re-fetch permissions tous les renders

**Mauvais** : `useEffect(() => { fetchPermissions() }, [/* no deps */])` -- infinite loop.

**Bon** : TanStack Query staleTime 5min + refetchOnWindowFocus capture changes sans surcharge.

### AP-08 : Component sans memo pour permissions

**Mauvais** : Recalculer permission a chaque render parent.

**Bon** : Hooks utilisent `useMemo` pour eviter recompute. Set lookup O(1) deja optimal.

---

## 18. Notes implementation et debug (1-2 ko)

### Comment debugger une permission qui ne passe pas

1. Verifier dans DevTools : Application -> Cookies -> `access_token` present.
2. Decoder le JWT manuel : <https://jwt.io> et coller le token (payload only, pas la signature).
3. Verifier le claim `permissions: []` contient bien la permission attendue.
4. Si manquante : Soit role mappant cote backend Sprint 7 incorrect, soit role utilisateur dans `user_roles` table incorrect.
5. Si presente mais UI cache : Verifier `PermissionProvider` est bien dans la chain providers + dev console pour warnings.

### Comment tester localement les 3 roles

```bash
# Backend Sprint 7 seed 3 users test
cd repo/apps/api
pnpm run seed:test-users

# Frontend
cd repo/apps/web-broker
pnpm dev

# Login admin
# email: admin-test@broker.skalean-insurtech.ma
# password: Test@AdminPass123

# Login user
# email: user-test@broker.skalean-insurtech.ma
# password: Test@UserPass123

# Login assistant
# email: assistant-test@broker.skalean-insurtech.ma
# password: Test@AssistantPass123
```

### Comment ajouter une nouvelle permission

1. Ajouter dans `permissions-catalog.ts` PERMISSIONS const + PERMISSION_METADATA.
2. Mettre a jour `ROLE_PERMISSIONS` mapping pour les roles concernes.
3. Backend Sprint 7 : ajouter dans seed `role_permissions` table.
4. Utiliser dans UI : `usePermission('new.permission.code')` + wrapper `<HasPermission>`.
5. Tester : Vitest spec catalogue + Playwright E2E si workflow critique.

### Future evolution (Sprint 22+)

- Code-gen automatique du `permissions-catalog.ts` depuis OpenAPI backend (eviter drift).
- Extraction vers `@insurtech/shared-auth` package npm si reutilise cross-app.
- Dynamic permissions (custom roles tenant-specific) -- Phase 7+.
- Attribute-Based Access Control (ABAC) en complement -- Phase 8+.

---

**Fin de tache 4.3.12 -- RBAC UI : Conditional Rendering Features Per Role + Permission Helpers**

Document genere conforme decision-006 (NO EMOJI), v2.2 Option B Sprint 16, dependances Sprint 7 RBAC backend.
