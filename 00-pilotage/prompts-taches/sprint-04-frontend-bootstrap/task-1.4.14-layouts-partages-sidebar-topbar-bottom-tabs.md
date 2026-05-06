# TACHE 1.4.14 -- Layouts Partages (Sidebar + Topbar + BottomTabs) Par Type App

**Sprint** : 4 (Phase 1 / Sprint 4 dans phase, dernier de Phase 1 Bootstrap)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-04-sprint-04-frontend-bootstrap.md` (Tache 1.4.14)
**Phase** : 1 -- Bootstrap
**Priorite** : P0
**Effort** : 6h
**Dependances** : 1.4.13 (OpenAPI client genere -- types user/role utilises pour role-based filter sidebar), 1.4.11 (multilingue next-intl pour LocaleSwitcher dans Topbar/MarketingHeader), 1.4.8 (shared-ui setup avec Radix primitives Sheet, DropdownMenu, Avatar, Tooltip), 1.4.1-1.4.7 (8 apps stubs prets a consommer les layouts)
**Densite cible** : 100-150 ko (auto-suffisant exhaustif, aucune lecture annexe necessaire)
**AUCUNE EMOJI AUTORISEE** (decision-006 strictement appliquee)

---

## 1. But (0.5-1 ko)

Implementer dans le package `@insurtech/shared-ui` quatre layouts partages adaptes aux quatre archetypes d'applications du programme Skalean InsurTech : `<DashboardLayout>` pour les apps power-user (web-broker port 3001, web-garage port 3002, web-insurtech-admin port 3000), `<SelfServiceLayout>` pour l'app self-service grand public assure (web-assure-portal port 3005), `<MobileLayout>` pour les apps mobile PWA tactiles (web-garage-mobile port 3003, web-assure-mobile port 3006), et `<PublicLayout>` pour l'app marketing public SEO (web-customer-portal port 3004). Ces quatre layouts partagent un meme socle de composants reutilisables -- `<Sidebar>` collapsible avec sections groupees et filtrage role-based, `<Topbar>` avec slots configurables (breadcrumb, actions, UserMenu, NotificationBell, ThemeToggle, LocaleSwitcher), `<BottomTabs>` mobile avec 4-5 onglets et safe-area-inset, `<UserMenu>` dropdown avatar Radix, `<NotificationBell>` placeholder enrichi Sprint 9, `<Breadcrumb>` auto-genere depuis `usePathname`, `<ThemeToggle>` tri-state next-themes, `<MarketingHeader>` transparent-on-scroll, `<MarketingFooter>` complet conformite Maroc -- ainsi qu'un store Zustand `useSidebarOpen` persiste localStorage pour partager l'etat collapse/expand entre composants.

Le sprint 4 doit livrer ces layouts en mode "bootstrap" (squelette structurel sans logique metier), prets a etre consommes par les 8 apps via `import { DashboardLayout } from '@insurtech/shared-ui'` dans leur fichier `app/[locale]/layout.tsx`. Le filtrage role-based de la sidebar reste un placeholder (Sprint 7 RBAC enrichira) ; le NotificationBell est un placeholder (Sprint 9 connectera SSE/WebSocket) ; la command palette (Cmd+K) est un placeholder (Sprint 30 implementera). A la sortie de cette tache, les commandes `pnpm --filter @insurtech/web-broker dev`, `pnpm --filter @insurtech/web-assure-portal dev`, `pnpm --filter @insurtech/web-garage-mobile dev`, `pnpm --filter @insurtech/web-customer-portal dev` rendent leur layout respectif sans erreur, la sidebar bascule en drawer Radix Sheet sous le breakpoint `md` (768 px), les BottomTabs sont visibles uniquement sous `md`, le safe-area-inset-bottom iOS est applique sur `<MobileLayout>`, la persistance localStorage du collapse sidebar est validee (`skalean-sidebar-open: true|false`), les tests Vitest unitaires (18-22 specs) et Playwright e2e (8 apps) passent, et l'audit accessibilite Axe (Sprint 4 baseline) ne remonte aucune violation critique sur les layouts. Cette tache est cross-cutting et bloque la tache 1.4.15 (pages placeholder) qui consommera ces layouts pour structurer ses pages 404/500/loading.

---

## 2. Contexte etendu (8-12 ko)

### Pourquoi cette tache existe

L'ecosysteme InsurTech de Skalean comporte 8 applications frontend Next.js 15 destinees a 4 audiences distinctes avec des contraintes UX radicalement differentes. Mutualiser les layouts dans `@insurtech/shared-ui` est imperatif pour : (1) eviter la duplication de code (8 layouts dupliques = 8 endroits ou corriger un bug), (2) garantir la coherence visuelle Skalean Sofidemy cross-app (une evolution palette/typographie Sprint 18 doit se propager automatiquement), (3) accelerer les sprints metier suivants (Sprint 5 Auth, Sprint 8 CRM, Sprint 17 Souscription) qui consomment juste `<DashboardLayout>` sans reflechir au chrome.

Les quatre archetypes de layouts repondent a quatre profils utilisateurs distincts :

**Archetype 1 -- DashboardLayout (broker, garage, admin)** : utilisateurs power-user qui passent 4-8h/jour sur l'app. Ecrans desktop 1920x1080 ou 1440x900 majoritaires. Sidebar gauche permanente avec navigation hierarchique (sections groupees : CRM, Souscription, Sinistres, Reporting). Topbar avec breadcrumb pour orientation, actions contextuelles (boutons "Nouveau contact", "Exporter"), UserMenu, notifications. Densite informationnelle elevee (tableaux, graphiques). Footer minimaliste (copyright + version build). Sur mobile (cas rare mais possible : courtier en deplacement consulte un dossier), sidebar devient drawer Radix Sheet declenche par hamburger.

**Archetype 2 -- SelfServiceLayout (assure-portal)** : assures finaux non technophiles, 65% des utilisateurs > 45 ans (etude Skalean 2025). Pas de sidebar (cognitive overload). Topbar simple (logo + locale + user). Contenu centre `max-w-3xl` pour lecture confortable. Boutons larges (`h-12` minimum tactile-friendly meme desktop). Police base 18px (au lieu 16px standard). Footer minimaliste. UX inspiree des portails self-service bancaires (BMCE, AWB) familiers a la cible.

**Archetype 3 -- MobileLayout (garage-mobile, assure-mobile)** : techniciens garage en intervention sur site (terrain) + assures declarant un sinistre depuis voie publique. Smartphone tactile, 1 main souvent occupee (prise photos accident). Topbar minimal (logo + locale + user, hauteur 56px). Contenu pleine largeur (pas de marges desktop). Bottom tabs 4-5 onglets pour navigation pouce-friendly (atteignables one-handed). Safe-area-inset-bottom iOS (notch iPhone X+) imperatif. Pas de sidebar du tout. PWA installable home screen (manifest separe Tache 1.4.9).

**Archetype 4 -- PublicLayout (customer-portal)** : prospects non authentifies recherchant assurance auto / habitation / sante. SEO critique (Sprint 18 cible Lighthouse SEO 95+). Marketing header (logo + nav links + CTA "Devis gratuit"). Contenu pleine largeur avec hero. Footer marketing complet (sections : Apropos, Produits, Partenaires, Mentions legales, Conformite Maroc CNDP/ACAPS/Loi 09-08, Contact). Pas d'authentification (pas de UserMenu). Header transparent sur hero, devient solide au scroll (effet glassmorphism Tailwind 4 backdrop-blur).

### Alternatives considerees

#### Layouts dans shared-ui vs duplications par app

| Critere | Shared-ui (CHOIX) | Duplique par app (rejete) |
|---------|-------------------|---------------------------|
| DRY principle | Respecte (1 source) | Viole (8 copies) |
| Maintenance bug fix | 1 PR | 8 PRs |
| Coherence visuelle | Garantie | Drift inevitable |
| Bundle size | Code partage minified once | Duplique 8x (chaque bundle) |
| Couplage build | Tighter (dependance shared-ui) | Decouple |
| Time-to-bootstrap | Plus rapide (import 1 ligne) | Plus lent (copy-paste) |
| Tests | Tests unitaires partages | 8x duplication tests |
| Storybook | Centralise (Sprint 4 Tache 1.4.16 P1) | Disperse |

**Decision** : shared-ui. Les layouts sont parmi les composants les plus stables (1-2 evolutions/an). Couplage acceptable car shared-ui = workspace package (pas une dependance externe versionnee).

#### Sidebar collapsible state -- Zustand vs Context vs URL param

| Critere | Zustand persist (CHOIX) | React Context | URL ?sidebar=open |
|---------|-------------------------|---------------|-------------------|
| Persistance cross-tab | localStorage shared | sessionStorage manuel | URL state non shared |
| Persistance reload page | Oui (localStorage) | Non | Oui (URL) |
| Re-render boundaries | Composants subscribed | Tous descendants Provider | Re-render route segment |
| API simplicite | useStore() hook | useContext() | useSearchParams() + router.push |
| SSR hydration | skipHydration handle | Mismatch potential | Aucun (URL = SSR-safe) |
| Bundle size | +4 ko | 0 (built-in) | 0 |
| Test friendly | createStore mock | wrapper Provider | URLSearchParams mock |
| Multi-store coordination | Trivial | Boilerplate | Limite |

**Decision** : Zustand persist. Choisi pour persistance localStorage cross-reload (UX fluide quand le courtier reload), API simplicite (`const { isOpen, toggle } = useSidebarOpen()`), et coherence avec `tenant-store` et `ui-store` deja en Zustand (1.4.1).

#### Drawer mobile -- Radix Sheet vs custom slide vs vaul (Drawer)

| Critere | Radix Sheet (CHOIX) | Custom slide CSS | vaul (drawer) |
|---------|---------------------|------------------|---------------|
| Accessibilite WAI-ARIA | Conforme natif | Manuel | Conforme |
| Focus trap | Auto | Manuel | Auto |
| Esc to close | Auto | Manuel | Auto |
| Click outside close | Auto | Manuel | Auto |
| Animation | Smooth (Framer-like) | Manuel | Smooth bottom-sheet |
| Direction | Top/Right/Bottom/Left | Custom | Bottom-only typique |
| Bundle size | ~12 ko (deja inclus shadcn/ui) | 0 | +8 ko |
| Maturite | Stable v1.x | DIY | v0.9 jeune |
| Dark mode | Variables CSS | Manuel | Variables CSS |

**Decision** : Radix Sheet. Deja installe via shadcn/ui Tache 1.4.8, accessibilite garantie (focus trap, ARIA dialog), Esc/click-outside automatiques, animations Tailwind 4 `data-[state=open]:animate-in` natives.

#### BottomTabs -- composant custom vs Radix Tabs vs cmdk

| Critere | Custom Skalean (CHOIX) | Radix Tabs | cmdk |
|---------|------------------------|------------|------|
| Navigation pages (vs panneaux) | Routing Next.js Link | Tabs interne | Command palette |
| ARIA tablist+tab+tabpanel | Manuel | Auto | N/A |
| Active state via pathname | Auto | Pas natif | N/A |
| Badge count | Custom slot | Custom slot | N/A |
| Safe-area-inset support | Custom CSS env() | Pas natif | N/A |
| Bundle size | ~3 ko | +8 ko | +14 ko |
| Pour usage navigation app | Adapte | Adapte panneaux | Inadapte |

**Decision** : composant custom Skalean. Radix Tabs est concu pour panneaux internes (tablist/tabpanel coherent), pas pour navigation routing. On implemente ARIA `role="tablist"` + `role="tab"` manuellement pour conformite WCAG.

#### Theme toggle -- next-themes vs custom localStorage

| Critere | next-themes (CHOIX) | Custom |
|---------|---------------------|--------|
| Tri-state light/dark/system | Natif | Manuel |
| FOUC prevention | Script blocking head injecte | Manuel |
| MediaQuery system theme | Auto | Manuel |
| SSR safe | Oui (mounted flag pattern) | Manuel |
| API React | useTheme() hook | useState + useEffect |
| Bundle size | ~5 ko | 0 |
| Maturite | Stable v0.4 | DIY |

**Decision** : next-themes 0.4.4. Standard de fait Next.js, gere prevention FOUC via script blocking dans `<head>` (deja inclus 1.4.1 ThemeProvider), `useTheme()` hook propre.

#### Breadcrumb auto-generation vs manuel par page

| Critere | Auto from pathname (CHOIX) | Manuel par page |
|---------|---------------------------|------------------|
| Boilerplate | Aucun | breadcrumbItems prop chaque page |
| Coherence | Garantie | Drift possible |
| i18n des segments | Mapping centralise | Par page |
| Cas custom (id dynamique) | Override prop optionnel | Naturel |
| SEO | Schema.org BreadcrumbList | Idem |

**Decision** : auto from pathname avec override prop optionnel. `usePathname()` -> `/fr/contacts/123` -> `[Accueil, Contacts, 123]`. Si la page veut customiser (e.g. afficher le nom du contact au lieu de l'ID), prop `items` override.

### Trade-offs explicites

1. **Sidebar collapse state localStorage shared cross-app** : `skalean-sidebar-open` est partage entre web-broker, web-garage, web-insurtech-admin (tous DashboardLayout, meme domaine cookie scope si subdomain wildcard). Si user collapse sidebar broker, garage demarre collapse aussi. Acceptable : meme persona (courtier passe broker -> admin tenant), preference coherente. Si non desire, namespace par app : `skalean-broker-sidebar-open`.

2. **NotificationBell placeholder Sprint 9** : Sprint 4 livre seulement icone `<Bell />` lucide-react + badge `<span>3</span>` dur. Sprint 9 (Notifications) connectera SSE `/api/v1/notifications/stream` et Zustand `useNotifications()` pour count realtime. Acceptable : Sprint 4 = bootstrap visuel, pas data live.

3. **Role-based filter sidebar Sprint 7 placeholder** : prop `userRoles?: Role[]` accepte mais pas utilise (Sprint 4 affiche tous items). Sprint 7 (RBAC) connectera `useSession().user.roles` next-auth pour filtrer items. Mitigation : signature stable `<Sidebar items={...} userRoles={...}>` pour eviter breaking change Sprint 7.

4. **Command palette (Cmd+K) Sprint 30 placeholder** : Topbar slot `commandPalette?: ReactNode` reserve mais inutilise. Sprint 30 (Productivity power-user) implementera `<CommandPalette />` avec cmdk lib. Trade-off : reserver l'API maintenant evite refactor Sprint 30.

5. **MobileLayout pas de sidebar du tout** : choix UX delibere. Garage technicien terrain n'a pas le confort visuel pour une sidebar drawer (ecran 5-6 pouces, gants, soleil). BottomTabs 4-5 onglets couvrent 95% navigation. Si besoin futur d'acces ecran "Plus" pour items secondaires, BottomTabs item "..." (More) ouvre un drawer bottom Radix.

6. **PublicLayout pas d'authentification** : customer-portal est SSG/ISR (Sprint 18 SEO public). Pas de session, pas de UserMenu. Si visiteur souhaite acceder a son espace, lien CTA "Mon espace assure" -> redirige vers `web-assure-portal` (port 3005, domaine `assure.skalean-insurtech.ma`). Decoupe stricte.

7. **Footer marketing different selon archetype** : DashboardLayout footer minimaliste (1 ligne copyright + build hash), PublicLayout footer complet (4 colonnes sections + conformite Maroc). Trade-off accepte : 2 composants footer differents (`<DashboardFooter>`, `<MarketingFooter>`) plutot qu'un footer configurable lourd a maintenir.

8. **ThemeToggle absent PublicLayout** : customer-portal SSG = HTML stale, theme system inadapte (visiteur eclair pas le temps). PublicLayout charte Skalean Sofidemy applique en force, pas de bascule. Decision UX strategie SEO.

9. **Sidebar items grouped en sections** : SidebarSection[]= {title, items}. Permet groupement "Operations / Sinistres / Reporting" avec separateurs visuels. Si pas de groupement souhaite, passer une seule section sans `title`.

10. **BottomTabs limite 5 max** : convention UX mobile (Apple HIG, Material Design). Au-dela, scrollable horizontal anti-pattern. Les apps mobile garage (Mes interventions / Recherche / Mon profil / Plus) et assure (Accueil / Mes contrats / Sinistres / Mon profil / Plus) tiennent en 4-5.

### Decisions strategiques referenced

- **decision-001 (monorepo pnpm + Turbo)** : layouts dans `packages/shared-ui/src/layouts/`, exports via `packages/shared-ui/src/index.ts`. Apps consomment via `import { DashboardLayout } from '@insurtech/shared-ui'` (workspace protocol).
- **decision-006 (NO EMOJI ABSOLU)** : zero emoji dans layouts/composants/messages JSON/README. Icones via lucide-react (`<Bell />`, `<Sun />`, `<Moon />`, `<ChevronRight />`, `<Menu />`, `<X />`). CI verifie `scripts/check-no-emoji.sh`.
- **decision-008 (cloud souverain MA Atlas Cloud Benguerir)** : pas d'images externes dans MarketingFooter (logos partenaires charges depuis CDN Skalean local). Conformite SDP residence donnees.
- **decision-009 (multilinguisme MA)** : LocaleSwitcher integre Topbar/MarketingHeader, switch fr / ar-MA / ar (arabe classique RTL). Layout flip automatique `dir="rtl"` declenche par `<html dir>` route segment, layouts utilisent `ms-*` (margin-start) au lieu `ml-*` pour bidirectionnalite.
- **decision-014 (conformite Maroc CNDP / Loi 09-08 / ACAPS)** : MarketingFooter mention obligatoire ACAPS supervision + lien CNDP RGPD + politique cookies. UserMenu logout efface session + cookies + tenant store (Loi 09-08 droit oubli partiel).

### Pieges techniques connus (12 minimum)

1. **Sidebar persist hydration mismatch Zustand** : avec `persist` middleware, le state initial cote serveur (vide / `isOpen: true` default) differe du client (rehydrate `false` localStorage). Console warning React. Solution : `skipHydration: true` dans Zustand persist + `useEffect` rehydrate manuel apres mount, OU rendre layout cote client `'use client'` avec sidebar invisible jusqu'a hydration (FOUC accepte 50ms).

2. **next-themes flicker SSR -> CSR** : entre HTML stream initial (sans classe `.dark`) et hydration client (lit cookie/localStorage `.dark`), flash light->dark visible. Solution : script `next-themes` blocking inline dans `<head>` injecte la classe AVANT hydration React. Provider `next-themes` standard fait deja ca via `<ThemeProvider attribute="class" enableSystem>` Tache 1.4.1.

3. **Radix Sheet Portal SSR** : Radix Portal teleporte le drawer dans `document.body`. SSR Next.js streaming peut avoir `document` undefined moment du render. Solution : `'use client'` sur composant utilisant Sheet, OU `<SheetPrimitive.Portal>` avec fallback.

4. **safe-area-inset-bottom iOS dans dev (browser desktop)** : `env(safe-area-inset-bottom)` retourne 0 sur Chrome desktop dev. Test mobile iOS Safari real device requis. Solution : ajouter une marge minimale fallback `padding-bottom: max(env(safe-area-inset-bottom), 0.5rem)`.

5. **viewport-fit cover meta tag** : pour que `env(safe-area-inset-*)` retourne valeurs reelles iOS, `<meta name="viewport" content="viewport-fit=cover, ...">` requis dans MobileLayout. Sans ca, iOS treat content classique avec marges noires notch. Configure dans `app/[locale]/layout.tsx` MobileLayout root.

6. **BottomTabs hidden md+ vs hidden lg+** : breakpoint Tailwind `md` = 768px (tablette portrait). En tablette landscape 1024px (lg), preference DashboardLayout. Decision : MobileLayout avec BottomTabs visible `md:hidden` (cache des 768px+) -- l'app mobile est concue pour smartphone uniquement, tablette utilise l'app desktop equivalent.

7. **active state pathname locale prefix** : `usePathname()` retourne `/fr/contacts/123`. Pour comparer avec item.href `/contacts`, il faut stripper le prefix locale. Solution : helper `stripLocale(pathname, locale)` ou utiliser `next-intl/navigation` `usePathname()` qui strip auto.

8. **Sidebar drawer mobile state coordination** : sur mobile, sidebar = drawer. Ouvrir drawer != collapse desktop. `useSidebarOpen()` doit distinguer modes : desktop (collapse persiste localStorage) vs mobile (drawer ephemere session). Solution : 2 states distincts `isCollapsed` (desktop) et `isDrawerOpen` (mobile), useMediaQuery `(min-width: 768px)` pour discriminer comportement.

9. **next-themes mounted flag pattern** : `useTheme()` retourne `theme: undefined` au premier render SSR (puisque cookie pas encore lu). Si on rend `<Sun />` ou `<Moon />` selon theme, mismatch hydration. Solution : `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []); if (!mounted) return null;` (placeholder skeleton pendant 1 frame).

10. **MarketingHeader transparent on scroll detection** : `<MarketingHeader>` doit detecter scroll Y > 100px pour passer transparent -> solid. `window.scrollY` indisponible SSR. Solution : `useEffect` + `addEventListener('scroll', ...)` avec throttle requestAnimationFrame, cleanup proper.

11. **UserMenu dropdown mobile full-screen** : Radix DropdownMenu rend en popup. Sur mobile, popup tronque par viewport. Solution : utiliser Radix Sheet (drawer bottom) sur mobile, DropdownMenu sur desktop, switch via useMediaQuery. Acceptable Sprint 4 = DropdownMenu partout (degrade UX mobile mais fonctionnel).

12. **Breadcrumb i18n segments dynamiques** : `/fr/contacts/123` -> breadcrumb "Accueil > Contacts > 123". Le segment "123" n'a pas de traduction (c'est un UUID/ID). Solution : breadcrumb component prend prop `dynamicSegments?: Record<string, string>` pour mapper id -> nom (ex: `{ '123': 'Mohammed Alami' }`) renseigne par la page apres fetch contact.

13. **Locale switch reload layout state** : passer fr -> ar declenche redirect `/fr/page` -> `/ar/page`. Layout entier remonte. Sidebar collapsed state preserve (Zustand persist localStorage). Theme preserve (next-themes cookie). Mais Topbar breadcrumb retraduit. Acceptable.

14. **Footer marketing year copyright stale SSG** : `<footer>{new Date().getFullYear()}</footer>` evalue au build time SSG. En 2026 build janvier, footer dit "2026". En 2027, footer dit toujours "2026" jusqu'au prochain build. Solution : `'use client'` + `useEffect` recalc, OU build CI nightly (preferable SEO).

15. **ARIA tablist semantique** : BottomTabs avec `role="tablist"` et items `role="tab"` requiert `aria-selected="true|false"` et `aria-controls={tabpanel-id}`. Comme c'est navigation routing (pas tabpanel interne), semantique discutable. Alternative : `role="navigation"` + `aria-label="Bottom navigation"` plus correct semantiquement. Decision : `role="navigation"` + `aria-current="page"` sur item actif.

16. **Sidebar focus trap drawer mobile** : quand drawer Sheet ouvert mobile, Tab key doit rester piege dans drawer. Radix Sheet fait deja ca (focus-trap-react interne). Verifier que Esc ferme drawer (handler Radix natif). Verifier que clic outside ferme drawer (modal=true par defaut).

17. **Theme toggle disabled SSG public** : sur PublicLayout customer-portal SSG, ThemeToggle absent (decision design). Si malgre tout developeur l'inclut, `useTheme()` retourne theme system. SSG = HTML stale generated build. Acceptable mais confusion UX.

18. **Hamburger animation delay** : transition `<Menu />` -> `<X />` quand sidebar ouvert/ferme. Sans animation, swap brutal. Solution : Tailwind `transition-transform duration-200` sur conteneur icone, `rotate-90` quand ouvert.

19. **Logo Skalean Sofidemy SVG inline** : MarketingHeader/Topbar logo. SVG inline (pas `<img src>`) pour eviter requete HTTP supplementaire + theming via `currentColor`. Stocke dans `packages/shared-ui/src/assets/logo-skalean.svg` exporte component `<LogoSkalean />`.

20. **NotificationBell badge count overflow** : si count > 99, "99+" affiche. Solution : `count > 99 ? '99+' : count.toString()`. Width fixe badge `min-w-[1.25rem]` pour eviter layout shift.

---

## 3. Architecture context (3-5 ko)

### Position dans Sprint 4

`task-1.4.14` est cross-cutting et depend de la majorite des taches deja terminees dans le sprint :

```
Sprint 4 -- Frontend Bootstrap (16 taches)

[1.4.1 web-broker]      [1.4.2 web-garage]      [1.4.4 web-admin]
        |                       |                       |
        +-----------------------+-----------------------+
                                |
                                v
                  [1.4.14 layouts shared-ui]      <-- DashboardLayout cible

[1.4.6 web-assure-portal]                        [1.4.5 web-customer-portal]
        |                                                  |
        v                                                  v
  [1.4.14 SelfServiceLayout]                  [1.4.14 PublicLayout]

[1.4.3 web-garage-mobile]   [1.4.7 web-assure-mobile]
        |                          |
        +--------------------------+
                    |
                    v
        [1.4.14 MobileLayout]      <-- BottomTabs cible

[1.4.8 shared-ui base]   [1.4.11 i18n]   [1.4.13 OpenAPI client]
        |                       |                       |
        +-----------------------+-----------------------+
                                |
                                v
                  [1.4.14 layouts depend de tous ces 3]

[1.4.14 layouts] -> bloque [1.4.15 placeholder pages] -> bloque [1.4.16 E2E]
```

Sequence concrete Jour 4-5 du sprint :
- Jour 4 matin : implementation `useSidebarOpen` Zustand store + `<Sidebar>` composant + tests (1.5h).
- Jour 4 apres-midi : `<Topbar>` + `<UserMenu>` + `<NotificationBell>` + `<Breadcrumb>` + `<ThemeToggle>` + tests (2h).
- Jour 5 matin : `<DashboardLayout>` + `<SelfServiceLayout>` + `<MobileLayout>` + `<BottomTabs>` + `<PublicLayout>` + `<MarketingHeader>` + `<MarketingFooter>` + tests (2h).
- Jour 5 apres-midi : integration 8 apps + E2E Playwright + audit Axe (0.5h).

### Position dans le programme

Cette tache cross-cutting est consommee par tous les sprints metier suivants :

- Sprint 5 (Auth) : connecte `<UserMenu>` au callback `signOut()` next-auth, branche pages `/login` `/logout`.
- Sprint 7 (RBAC) : enrichit `<Sidebar>` filtrage `items.filter(i => intersects(user.roles, i.requiredRoles))`.
- Sprint 8 (CRM) : ajoute items sidebar `[{ label: 'Contacts', href: '/contacts', icon: Users }]` dans web-broker.
- Sprint 9 (Notifications) : connecte `<NotificationBell>` SSE `/api/v1/notifications/stream` + Zustand store realtime count.
- Sprint 17 (Souscription) : ajoute items sidebar Souscription / Devis / Polices dans broker.
- Sprint 18 (Customer Portal SEO) : enrichit `<MarketingHeader>` avec mega menu produits, `<MarketingFooter>` blog/sitemap.
- Sprint 22 (Sinistres) : ajoute items sidebar Sinistres + breadcrumb auto pour `/claims/[id]`.
- Sprint 27 (Dashboards) : ajoute widgets dans `<DashboardLayout>` content area.
- Sprint 30 (Productivity) : implemente `<CommandPalette>` cmdk dans Topbar slot reserve.
- Sprint 31 (Reporting ACAPS) : ajoute item sidebar Reporting + role filter regulator.

### Diagramme ASCII des layouts

```
DashboardLayout                    SelfServiceLayout              MobileLayout                  PublicLayout
+---------------+                  +-----------------+            +-------------+               +---------------+
| Topbar (64px) |                  | Topbar simple   |            | Topbar mini |               | MarketingHdr  |
| breadcrumb    |                  | logo locale user|            | logo locale |               | logo nav CTA  |
| user theme    |                  +-----------------+            +-------------+               +---------------+
+----+----------+                  |                 |            |             |               | Hero          |
|Side|          |                  |  max-w-3xl      |            | Content     |               |               |
|bar | Content  |                  |  centre         |            | full        |               | Content       |
|    |          |                  |  big buttons    |            | width       |               | sections      |
|    |          |                  |  base 18px      |            |             |               |               |
|    |          |                  |                 |            +-------------+               |               |
|    |          |                  +-----------------+            |BottomTabs   |               +---------------+
+----+----------+                  | Footer min      |            |4-5 tabs     |               | MarketingFtr  |
| Footer min    |                  +-----------------+            |safe-area    |               | sections      |
+---------------+                                                 +-------------+               | conformite MA |
                                                                                                +---------------+
broker / garage                    assure-portal                  garage-mobile                 customer-portal
admin                              (port 3005)                    assure-mobile                 (port 3004)
(3001/3002/3000)                                                  (3003/3006)
```

**Dependance graph composants** :

```
DashboardLayout
  -- Sidebar (collapsible)
       -- SidebarSection[]
            -- SidebarItem (icon, label, badge, role)
       -- useSidebarOpen (Zustand)
  -- Topbar
       -- Breadcrumb (auto pathname)
       -- UserMenu (Radix Avatar + DropdownMenu)
            -- ThemeToggle (next-themes)
            -- LocaleSwitcher (1.4.11)
       -- NotificationBell (placeholder Sprint 9)
  -- DashboardFooter (minimal)

SelfServiceLayout
  -- Topbar (simple variant)
  -- DashboardFooter (minimal)

MobileLayout
  -- TopbarMobile (logo + locale + user, height 56px)
  -- BottomTabs
       -- TabItem[] (icon, label, badge)
       -- safe-area-inset-bottom

PublicLayout
  -- MarketingHeader
       -- transparent-on-hero scroll detection
       -- LocaleSwitcher
       -- CTA "Devis gratuit"
  -- MarketingFooter
       -- 4 sections (Apropos / Produits / Partenaires / Mentions)
       -- conformite Maroc CNDP / ACAPS / Loi 09-08
       -- social links
       -- copyright dynamique
```

---

## 4. Livrables checkables (20+ deliverables)

- [ ] **L1** : `repo/packages/shared-ui/src/layouts/DashboardLayout.tsx` (~150 lignes) compose Sidebar + Topbar + content + DashboardFooter, props `{ user?, sidebarItems, breadcrumbItems?, topbarActions?, children }`, responsive desktop + drawer mobile.
- [ ] **L2** : `repo/packages/shared-ui/src/layouts/SelfServiceLayout.tsx` (~120 lignes) Topbar simple + content `max-w-3xl mx-auto` + DashboardFooter minimal, base font 18px (`text-lg` Tailwind), pas de sidebar.
- [ ] **L3** : `repo/packages/shared-ui/src/layouts/MobileLayout.tsx` (~150 lignes) TopbarMobile + content + BottomTabs + safe-area-inset-bottom, viewport-fit cover, mobile-first.
- [ ] **L4** : `repo/packages/shared-ui/src/layouts/PublicLayout.tsx` (~120 lignes) MarketingHeader + content + MarketingFooter, no auth, SEO-friendly.
- [ ] **L5** : `repo/packages/shared-ui/src/components/Sidebar.tsx` (~200 lignes) collapsible Zustand state, items grouped sections, role filter (placeholder Sprint 7), active state via `usePathname`, ARIA navigation, keyboard accessible.
- [ ] **L6** : `repo/packages/shared-ui/src/components/Topbar.tsx` (~150 lignes) sticky top, blur backdrop, height 64px, slots configurables (breadcrumb / actions / userMenu / notificationBell / themeToggle / localeSwitcher / commandPalette).
- [ ] **L7** : `repo/packages/shared-ui/src/components/BottomTabs.tsx` (~120 lignes) 4-5 tabs, items prop, active state, badge optionnel, safe-area-inset-bottom, visible `md:hidden` only.
- [ ] **L8** : `repo/packages/shared-ui/src/components/UserMenu.tsx` (~100 lignes) Radix Avatar + DropdownMenu, profile + logout + langue + theme + role display.
- [ ] **L9** : `repo/packages/shared-ui/src/components/NotificationBell.tsx` (~80 lignes) Bell icon + badge count placeholder Sprint 9, dropdown panel placeholder.
- [ ] **L10** : `repo/packages/shared-ui/src/components/Breadcrumb.tsx` (~100 lignes) auto-genere depuis `usePathname`, separator ChevronRight, home icon, last item current page non-clickable, ARIA breadcrumb.
- [ ] **L11** : `repo/packages/shared-ui/src/components/ThemeToggle.tsx` (~60 lignes) tri-state next-themes, Sun/Moon/Monitor icons, dropdown menu, persist preference.
- [ ] **L12** : `repo/packages/shared-ui/src/hooks/useSidebarOpen.ts` (~50 lignes) Zustand store persist localStorage `skalean-sidebar-open`, expose `isOpen / setOpen / toggle / isDrawerOpen / setDrawerOpen`.
- [ ] **L13** : `repo/packages/shared-ui/src/components/MarketingHeader.tsx` (~100 lignes) logo + nav + CTA + locale, transparent on hero scroll detection.
- [ ] **L14** : `repo/packages/shared-ui/src/components/MarketingFooter.tsx` (~150 lignes) 4 sections + conformite Maroc + social + copyright + language switch.
- [ ] **L15** : `repo/packages/shared-ui/src/components/DashboardFooter.tsx` (~50 lignes) minimaliste copyright + version build.
- [ ] **L16** : `repo/packages/shared-ui/src/index.ts` enrichi exports nouveaux composants/layouts/hooks.
- [ ] **L17** : Tests Vitest 18-22 specs cible coverage 90%+ sur layouts/composants.
- [ ] **L18** : Tests Playwright e2e `repo/e2e/web/layouts.spec.ts` valide rendu 8 apps avec layout correct.
- [ ] **L19** : Audit Axe accessibility baseline 0 violation critique sur layouts.
- [ ] **L20** : Documentation `repo/packages/shared-ui/README.md` section Layouts decrit chaque layout + props + exemple usage.
- [ ] **L21** : Storybook stories (P1 Tache 1.4.16) `repo/packages/shared-ui/src/layouts/*.stories.tsx` 4 fichiers.
- [ ] **L22** : Integration validee dans 8 apps : `app/[locale]/layout.tsx` chaque app importe et utilise le layout adapte.

---

## 5. Procedure pas a pas (10-15 ko)

### Etape 1 : Creation hook Zustand `useSidebarOpen`

```bash
cd repo/packages/shared-ui
mkdir -p src/hooks
touch src/hooks/useSidebarOpen.ts
```

Contenu (voir Section 6 fichier 12 pour code complet). Utilise `zustand` + `zustand/middleware` `persist` storage `localStorage` cle `skalean-sidebar-open`. Expose `isOpen` (desktop collapse), `setOpen`, `toggle`, `isDrawerOpen` (mobile drawer ephemere session, pas persist), `setDrawerOpen`.

### Etape 2 : Composants atomiques

Creer dans cet ordre (dependances) :

```bash
mkdir -p src/components
touch src/components/ThemeToggle.tsx          # autonome
touch src/components/Breadcrumb.tsx           # autonome (usePathname only)
touch src/components/NotificationBell.tsx     # autonome placeholder
touch src/components/UserMenu.tsx             # depend ThemeToggle + LocaleSwitcher
touch src/components/Sidebar.tsx              # depend useSidebarOpen
touch src/components/Topbar.tsx               # depend Breadcrumb + UserMenu + NotificationBell + ThemeToggle + LocaleSwitcher
touch src/components/BottomTabs.tsx           # autonome
touch src/components/MarketingHeader.tsx      # depend LocaleSwitcher
touch src/components/MarketingFooter.tsx      # autonome
touch src/components/DashboardFooter.tsx      # autonome minimal
```

### Etape 3 : Layouts compositions

```bash
mkdir -p src/layouts
touch src/layouts/DashboardLayout.tsx
touch src/layouts/SelfServiceLayout.tsx
touch src/layouts/MobileLayout.tsx
touch src/layouts/PublicLayout.tsx
```

### Etape 4 : Exports index.ts

```typescript
// packages/shared-ui/src/index.ts
export { DashboardLayout } from './layouts/DashboardLayout';
export { SelfServiceLayout } from './layouts/SelfServiceLayout';
export { MobileLayout } from './layouts/MobileLayout';
export { PublicLayout } from './layouts/PublicLayout';
export { Sidebar, type SidebarItem, type SidebarSection } from './components/Sidebar';
export { Topbar } from './components/Topbar';
export { BottomTabs, type TabItem } from './components/BottomTabs';
export { UserMenu } from './components/UserMenu';
export { NotificationBell } from './components/NotificationBell';
export { Breadcrumb, type BreadcrumbItem } from './components/Breadcrumb';
export { ThemeToggle } from './components/ThemeToggle';
export { MarketingHeader } from './components/MarketingHeader';
export { MarketingFooter } from './components/MarketingFooter';
export { DashboardFooter } from './components/DashboardFooter';
export { useSidebarOpen } from './hooks/useSidebarOpen';
```

### Etape 5 : Integration apps

Dans `repo/apps/web-broker/src/app/[locale]/layout.tsx` :

```tsx
import { DashboardLayout } from '@insurtech/shared-ui';
import { brokerSidebarItems } from '@/config/sidebar-items';

export default async function BrokerLocaleLayout({ children, params }) {
  const { locale } = await params;
  return (
    <DashboardLayout sidebarItems={brokerSidebarItems}>
      {children}
    </DashboardLayout>
  );
}
```

Dans `repo/apps/web-assure-portal/src/app/[locale]/layout.tsx` : `<SelfServiceLayout>`.
Dans `repo/apps/web-garage-mobile/src/app/[locale]/layout.tsx` : `<MobileLayout tabs={garageTabs}>`.
Dans `repo/apps/web-assure-mobile/src/app/[locale]/layout.tsx` : `<MobileLayout tabs={assureTabs}>`.
Dans `repo/apps/web-customer-portal/src/app/[locale]/layout.tsx` : `<PublicLayout>`.
Dans `repo/apps/web-garage/src/app/[locale]/layout.tsx` : `<DashboardLayout>` + items garage.
Dans `repo/apps/web-insurtech-admin/src/app/[locale]/layout.tsx` : `<DashboardLayout>` + items admin.

### Etape 6 : Configuration sidebar items par app

Creer `repo/apps/web-broker/src/config/sidebar-items.ts` :

```typescript
import { Users, FileText, AlertCircle, BarChart3, Settings } from 'lucide-react';
import type { SidebarSection } from '@insurtech/shared-ui';

export const brokerSidebarItems: SidebarSection[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Contacts', href: '/contacts', icon: Users, requiredRoles: ['broker_admin', 'broker_user'] },
      { label: 'Devis', href: '/quotes', icon: FileText, requiredRoles: ['broker_admin', 'broker_user'] },
    ],
  },
  {
    title: 'Sinistres',
    items: [
      { label: 'Declarations', href: '/claims', icon: AlertCircle, requiredRoles: ['broker_admin'] },
    ],
  },
  {
    title: 'Pilotage',
    items: [
      { label: 'Tableaux de bord', href: '/dashboards', icon: BarChart3, requiredRoles: ['broker_admin'] },
      { label: 'Parametres', href: '/settings', icon: Settings, requiredRoles: ['broker_admin'] },
    ],
  },
];
```

Sprint 4 : items places en placeholder pour visualiser la sidebar mais routes 404 (Tache 1.4.15 ajoute pages stubs `/contacts/page.tsx` etc).

### Etape 7 : Tests Vitest

Creer dans `repo/packages/shared-ui/src/components/__tests__/`, `repo/packages/shared-ui/src/layouts/__tests__/`, `repo/packages/shared-ui/src/hooks/__tests__/`. Utiliser `@testing-library/react`, `@testing-library/jest-dom`, `vi.mock('next/navigation')` pour `usePathname`, `vi.mock('next-themes')` pour `useTheme`, `vi.mock('next-intl')` pour `useTranslations`.

### Etape 8 : Test Playwright e2e

Creer `repo/e2e/web/layouts.spec.ts` (voir Section 7). Demarre les 8 apps via Turbo, navigue vers chaque app, verifie presence du chrome correct (sidebar broker, bottom tabs garage-mobile, marketing header customer-portal). Testez aussi : sidebar collapse persist, drawer mobile open/close, BottomTabs hidden md+, locale switch preserve sidebar state.

### Etape 9 : Audit accessibilite Axe

```bash
pnpm --filter @insurtech/web-broker exec playwright test e2e/axe.spec.ts
```

Page de chaque layout testee, verification 0 violation critique (`impact: 'critical'`). Violations mineures (`minor`/`moderate`) acceptables Sprint 4 (corrigees Sprint 18).

### Etape 10 : Build production validation

```bash
pnpm --filter @insurtech/shared-ui build
pnpm --filter '@insurtech/web-*' build
```

Verifier no warnings hydration, no missing exports, bundle size shared-ui layouts ~25 ko gzipped acceptable.

---

## 6. Code complet (60-90 ko)

### Fichier 1/14 : `packages/shared-ui/src/hooks/useSidebarOpen.ts` (~50 lignes)

```typescript
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SidebarState {
  isOpen: boolean;
  isDrawerOpen: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
  hasHydrated: boolean;
  setHydrated: (h: boolean) => void;
}

export const useSidebarOpen = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      isDrawerOpen: false,
      hasHydrated: false,
      setOpen: (open) => set({ isOpen: open }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setDrawerOpen: (open) => set({ isDrawerOpen: open }),
      toggleDrawer: () => set((state) => ({ isDrawerOpen: !state.isDrawerOpen })),
      setHydrated: (h) => set({ hasHydrated: h }),
    }),
    {
      name: 'skalean-sidebar-open',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ isOpen: state.isOpen }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

if (typeof window !== 'undefined') {
  void useSidebarOpen.persist.rehydrate();
}
```

### Fichier 2/14 : `packages/shared-ui/src/components/Sidebar.tsx` (~200 lignes)

```typescript
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight, Menu, X, type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { useSidebarOpen } from '../hooks/useSidebarOpen';

export interface SidebarItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
  requiredRoles?: string[];
  external?: boolean;
}

export interface SidebarSection {
  title?: string;
  items: SidebarItem[];
}

interface SidebarProps {
  sections: SidebarSection[];
  userRoles?: string[];
  logo?: React.ReactNode;
  className?: string;
}

function stripLocale(pathname: string, locale: string): string {
  const prefix = `/${locale}`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname;
}

function filterByRole(sections: SidebarSection[], userRoles?: string[]): SidebarSection[] {
  if (!userRoles || userRoles.length === 0) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) => !item.requiredRoles || item.requiredRoles.some((r) => userRoles.includes(r)),
      ),
    }))
    .filter((section) => section.items.length > 0);
}

function SidebarContent({
  sections,
  userRoles,
  logo,
  collapsed,
  onItemClick,
}: {
  sections: SidebarSection[];
  userRoles?: string[];
  logo?: React.ReactNode;
  collapsed: boolean;
  onItemClick?: () => void;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('navigation');
  const filteredSections = React.useMemo(() => filterByRole(sections, userRoles), [sections, userRoles]);
  const localPathname = stripLocale(pathname, locale);

  return (
    <nav
      role="navigation"
      aria-label={t('sidebarLabel', { default: 'Navigation principale' })}
      className="flex h-full flex-col"
    >
      <div className="flex h-16 shrink-0 items-center border-b px-4">
        {logo && !collapsed && <div className="flex-1 truncate">{logo}</div>}
        {logo && collapsed && <div className="mx-auto">{logo}</div>}
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        {filteredSections.map((section, sIdx) => (
          <div key={sIdx} className="mb-6">
            {section.title && !collapsed && (
              <h3 className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </h3>
            )}
            <ul className="space-y-1 px-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = localPathname === item.href || localPathname.startsWith(item.href + '/');
                const link = (
                  <Link
                    href={`/${locale}${item.href}`}
                    onClick={onItemClick}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      'hover:bg-accent hover:text-accent-foreground',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive && 'bg-accent text-accent-foreground',
                      collapsed && 'justify-center px-2',
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.badge !== undefined && (
                      <span className="ms-auto rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}

export function Sidebar({ sections, userRoles, logo, className }: SidebarProps) {
  const { isOpen, toggle, isDrawerOpen, setDrawerOpen, hasHydrated } = useSidebarOpen();

  return (
    <TooltipProvider delayDuration={300}>
      <aside
        className={cn(
          'hidden md:flex flex-col border-e bg-background transition-[width] duration-200',
          hasHydrated && isOpen ? 'w-64' : 'w-16',
          className,
        )}
      >
        <SidebarContent sections={sections} userRoles={userRoles} logo={logo} collapsed={hasHydrated && !isOpen} />
        <div className="border-t p-2">
          <button
            type="button"
            onClick={toggle}
            aria-label={isOpen ? 'Reduire la sidebar' : 'Etendre la sidebar'}
            className="flex w-full items-center justify-center rounded-md p-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {isOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Ouvrir le menu"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="start" className="w-72 p-0">
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
          <SidebarContent
            sections={sections}
            userRoles={userRoles}
            logo={logo}
            collapsed={false}
            onItemClick={() => setDrawerOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
```

### Fichier 3/14 : `packages/shared-ui/src/components/Topbar.tsx` (~150 lignes)

```typescript
'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import { cn } from '../lib/cn';
import { useSidebarOpen } from '../hooks/useSidebarOpen';

export interface TopbarProps {
  breadcrumb?: React.ReactNode;
  actions?: React.ReactNode;
  userMenu?: React.ReactNode;
  notificationBell?: React.ReactNode;
  themeToggle?: React.ReactNode;
  localeSwitcher?: React.ReactNode;
  commandPalette?: React.ReactNode;
  variant?: 'solid' | 'transparent' | 'blur';
  showHamburger?: boolean;
  className?: string;
}

export function Topbar({
  breadcrumb,
  actions,
  userMenu,
  notificationBell,
  themeToggle,
  localeSwitcher,
  commandPalette,
  variant = 'blur',
  showHamburger = true,
  className,
}: TopbarProps) {
  const { setDrawerOpen } = useSidebarOpen();

  return (
    <header
      role="banner"
      className={cn(
        'sticky top-0 z-40 flex h-16 items-center gap-4 border-b px-4 md:px-6',
        variant === 'solid' && 'bg-background',
        variant === 'transparent' && 'bg-transparent',
        variant === 'blur' && 'bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60',
        className,
      )}
    >
      {showHamburger && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      <div className="flex-1 min-w-0">
        {breadcrumb && (
          <div className="hidden md:block truncate" aria-label="Fil d'ariane">
            {breadcrumb}
          </div>
        )}
      </div>

      {commandPalette && <div className="hidden lg:block">{commandPalette}</div>}

      {actions && <div className="hidden md:flex items-center gap-2">{actions}</div>}

      <div className="flex items-center gap-1 md:gap-2">
        {localeSwitcher}
        {themeToggle}
        {notificationBell}
        {userMenu}
      </div>
    </header>
  );
}
```

### Fichier 4/14 : `packages/shared-ui/src/components/BottomTabs.tsx` (~120 lignes)

```typescript
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { type LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';

export interface TabItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: number | string;
}

interface BottomTabsProps {
  tabs: TabItem[];
  className?: string;
}

function stripLocale(pathname: string, locale: string): string {
  const prefix = `/${locale}`;
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length) || '/' : pathname;
}

export function BottomTabs({ tabs, className }: BottomTabsProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const localPathname = stripLocale(pathname, locale);

  if (tabs.length < 2 || tabs.length > 5) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[BottomTabs] Recommended 2-5 tabs, got', tabs.length);
    }
  }

  return (
    <nav
      role="navigation"
      aria-label="Navigation principale mobile"
      className={cn(
        'md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background',
        'pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1',
        'shadow-[0_-1px_3px_rgba(0,0,0,0.05)]',
        className,
      )}
    >
      <ul className="flex items-stretch justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = localPathname === tab.href || localPathname.startsWith(tab.href + '/');
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={`/${locale}${tab.href}`}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col items-center justify-center gap-0.5 px-2 py-2 min-h-[3.5rem]',
                  'text-xs font-medium transition-colors',
                  'hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
                  isActive ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  {tab.badge !== undefined && (
                    <span
                      aria-label={`${tab.badge} non lus`}
                      className="absolute -top-1 -end-2 min-w-[1.25rem] h-5 rounded-full bg-destructive px-1 text-[10px] leading-5 font-semibold text-destructive-foreground text-center"
                    >
                      {typeof tab.badge === 'number' && tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </span>
                <span className="truncate max-w-full">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

### Fichier 5/14 : `packages/shared-ui/src/components/UserMenu.tsx` (~100 lignes)

```typescript
'use client';

import * as React from 'react';
import { LogOut, User as UserIcon, Settings, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn } from '../lib/cn';

export interface UserMenuUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
  roles?: string[];
}

interface UserMenuProps {
  user: UserMenuUser;
  onLogout?: () => void | Promise<void>;
  onProfile?: () => void;
  onSettings?: () => void;
  className?: string;
}

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .map((p) => p.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function UserMenu({ user, onLogout, onProfile, onSettings, className }: UserMenuProps) {
  const t = useTranslations('userMenu');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('label', { default: 'Menu utilisateur' })}
          className={cn(
            'inline-flex items-center gap-2 rounded-full',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Avatar className="h-9 w-9">
            <AvatarImage src={user.avatarUrl} alt={user.fullName} />
            <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="font-semibold truncate">{user.fullName}</span>
          <span className="text-xs text-muted-foreground truncate">{user.email}</span>
          {user.roles && user.roles.length > 0 && (
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" aria-hidden="true" />
              {user.roles.join(', ')}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {onProfile && (
          <DropdownMenuItem onClick={onProfile}>
            <UserIcon className="me-2 h-4 w-4" />
            {t('profile', { default: 'Mon profil' })}
          </DropdownMenuItem>
        )}
        {onSettings && (
          <DropdownMenuItem onClick={onSettings}>
            <Settings className="me-2 h-4 w-4" />
            {t('settings', { default: 'Parametres' })}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive focus:text-destructive focus:bg-destructive/10"
        >
          <LogOut className="me-2 h-4 w-4" />
          {t('logout', { default: 'Se deconnecter' })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Fichier 6/14 : `packages/shared-ui/src/components/NotificationBell.tsx` (~80 lignes)

```typescript
'use client';

import * as React from 'react';
import { Bell } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from '../lib/cn';

interface NotificationBellProps {
  unreadCount?: number;
  className?: string;
}

export function NotificationBell({ unreadCount = 0, className }: NotificationBellProps) {
  const t = useTranslations('notifications');
  const display = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('label', { default: 'Notifications' })}
          className={cn(
            'relative inline-flex h-10 w-10 items-center justify-center rounded-md',
            'hover:bg-accent transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              aria-label={`${unreadCount} notifications non lues`}
              className="absolute top-1 end-1 min-w-[1.25rem] h-5 rounded-full bg-destructive px-1 text-[10px] leading-5 font-semibold text-destructive-foreground text-center"
            >
              {display}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>{t('title', { default: 'Notifications' })}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-6 text-center text-sm text-muted-foreground">
          {t('empty', { default: 'Pas de notifications. Sprint 9 ajoutera les notifications temps reel.' })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Fichier 7/14 : `packages/shared-ui/src/components/Breadcrumb.tsx` (~100 lignes)

```typescript
'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../lib/cn';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  dynamicSegments?: Record<string, string>;
  className?: string;
}

function autoBuild(
  pathname: string,
  locale: string,
  dynamicSegments: Record<string, string>,
  homeLabel: string,
): BreadcrumbItem[] {
  const prefix = `/${locale}`;
  const path = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname;
  const segments = path.split('/').filter(Boolean);
  const items: BreadcrumbItem[] = [{ label: homeLabel, href: `/${locale}` }];
  let acc = `/${locale}`;
  segments.forEach((seg, idx) => {
    acc += `/${seg}`;
    const label = dynamicSegments[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    items.push({ label, href: idx < segments.length - 1 ? acc : undefined });
  });
  return items;
}

export function Breadcrumb({ items, dynamicSegments = {}, className }: BreadcrumbProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('breadcrumb');
  const computedItems = items ?? autoBuild(pathname, locale, dynamicSegments, t('home', { default: 'Accueil' }));

  return (
    <nav aria-label={t('label', { default: 'Fil d\'ariane' })} className={cn('flex items-center', className)}>
      <ol className="flex items-center flex-wrap gap-1 text-sm">
        {computedItems.map((item, idx) => {
          const isLast = idx === computedItems.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1">
              {idx === 0 && <Home className="h-3.5 w-3.5 me-1" aria-hidden="true" />}
              {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" aria-hidden="true" />}
              {isLast || !item.href ? (
                <span aria-current="page" className="font-medium text-foreground truncate max-w-[200px]">
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:underline truncate max-w-[200px]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

### Fichier 8/14 : `packages/shared-ui/src/components/ThemeToggle.tsx` (~60 lignes)

```typescript
'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const t = useTranslations('theme');

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="h-10 w-10" aria-hidden="true" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('label', { default: 'Changer de theme' })}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Sun className="h-5 w-5 dark:hidden" aria-hidden="true" />
          <Moon className="h-5 w-5 hidden dark:inline" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme('light')} aria-current={theme === 'light' ? 'true' : undefined}>
          <Sun className="me-2 h-4 w-4" /> {t('light', { default: 'Clair' })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} aria-current={theme === 'dark' ? 'true' : undefined}>
          <Moon className="me-2 h-4 w-4" /> {t('dark', { default: 'Sombre' })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} aria-current={theme === 'system' ? 'true' : undefined}>
          <Monitor className="me-2 h-4 w-4" /> {t('system', { default: 'Systeme' })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Fichier 9/14 : `packages/shared-ui/src/layouts/DashboardLayout.tsx` (~150 lignes)

```typescript
import * as React from 'react';
import { Sidebar, type SidebarSection } from '../components/Sidebar';
import { Topbar } from '../components/Topbar';
import { Breadcrumb, type BreadcrumbItem } from '../components/Breadcrumb';
import { UserMenu, type UserMenuUser } from '../components/UserMenu';
import { NotificationBell } from '../components/NotificationBell';
import { ThemeToggle } from '../components/ThemeToggle';
import { DashboardFooter } from '../components/DashboardFooter';
import { LogoSkalean } from '../components/LogoSkalean';

export interface DashboardLayoutProps {
  sidebarItems: SidebarSection[];
  user?: UserMenuUser;
  userRoles?: string[];
  breadcrumbItems?: BreadcrumbItem[];
  topbarActions?: React.ReactNode;
  localeSwitcher?: React.ReactNode;
  unreadNotifications?: number;
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function DashboardLayout({
  sidebarItems,
  user,
  userRoles,
  breadcrumbItems,
  topbarActions,
  localeSwitcher,
  unreadNotifications = 0,
  onLogout,
  children,
}: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        sections={sidebarItems}
        userRoles={userRoles}
        logo={<LogoSkalean className="h-8 w-auto" />}
      />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar
          breadcrumb={<Breadcrumb items={breadcrumbItems} />}
          actions={topbarActions}
          userMenu={user ? <UserMenu user={user} onLogout={onLogout} /> : null}
          notificationBell={<NotificationBell unreadCount={unreadNotifications} />}
          themeToggle={<ThemeToggle />}
          localeSwitcher={localeSwitcher}
          variant="blur"
          showHamburger={true}
        />
        <main role="main" className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
        <DashboardFooter />
      </div>
    </div>
  );
}
```

### Fichier 10/14 : `packages/shared-ui/src/layouts/SelfServiceLayout.tsx` (~120 lignes)

```typescript
import * as React from 'react';
import { Topbar } from '../components/Topbar';
import { UserMenu, type UserMenuUser } from '../components/UserMenu';
import { ThemeToggle } from '../components/ThemeToggle';
import { DashboardFooter } from '../components/DashboardFooter';
import { LogoSkalean } from '../components/LogoSkalean';

export interface SelfServiceLayoutProps {
  user?: UserMenuUser;
  localeSwitcher?: React.ReactNode;
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function SelfServiceLayout({
  user,
  localeSwitcher,
  onLogout,
  children,
}: SelfServiceLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-lg">
      <Topbar
        breadcrumb={
          <div className="flex items-center gap-3">
            <LogoSkalean className="h-9 w-auto" />
            <span className="hidden sm:inline font-semibold text-lg">Mon espace assure</span>
          </div>
        }
        userMenu={user ? <UserMenu user={user} onLogout={onLogout} /> : null}
        themeToggle={<ThemeToggle />}
        localeSwitcher={localeSwitcher}
        variant="solid"
        showHamburger={false}
      />
      <main role="main" className="flex-1 w-full mx-auto max-w-3xl px-4 py-8 md:py-12">
        {children}
      </main>
      <DashboardFooter />
    </div>
  );
}
```

### Fichier 11/14 : `packages/shared-ui/src/layouts/MobileLayout.tsx` (~150 lignes)

```typescript
import * as React from 'react';
import { BottomTabs, type TabItem } from '../components/BottomTabs';
import { UserMenu, type UserMenuUser } from '../components/UserMenu';
import { LogoSkalean } from '../components/LogoSkalean';

export interface MobileLayoutProps {
  tabs: TabItem[];
  user?: UserMenuUser;
  localeSwitcher?: React.ReactNode;
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
}

export function MobileLayout({ tabs, user, localeSwitcher, onLogout, children }: MobileLayoutProps) {
  return (
    <div
      className="flex min-h-screen flex-col bg-background"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <header
        role="banner"
        className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-3"
      >
        <LogoSkalean className="h-7 w-auto" />
        <div className="flex items-center gap-1">
          {localeSwitcher}
          {user && <UserMenu user={user} onLogout={onLogout} />}
        </div>
      </header>
      <main
        role="main"
        className="flex-1 overflow-auto px-3 py-4"
        style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>
      <BottomTabs tabs={tabs} />
    </div>
  );
}
```

### Fichier 12/14 : `packages/shared-ui/src/layouts/PublicLayout.tsx` (~120 lignes)

```typescript
import * as React from 'react';
import { MarketingHeader } from '../components/MarketingHeader';
import { MarketingFooter } from '../components/MarketingFooter';

export interface PublicLayoutProps {
  localeSwitcher?: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  children: React.ReactNode;
}

export function PublicLayout({
  localeSwitcher,
  ctaHref = '/quote',
  ctaLabel = 'Devis gratuit',
  children,
}: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MarketingHeader localeSwitcher={localeSwitcher} ctaHref={ctaHref} ctaLabel={ctaLabel} />
      <main role="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
```

### Fichier 13/14 : `packages/shared-ui/src/components/MarketingHeader.tsx` (~100 lignes)

```typescript
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { LogoSkalean } from './LogoSkalean';
import { cn } from '../lib/cn';

interface MarketingHeaderProps {
  localeSwitcher?: React.ReactNode;
  ctaHref: string;
  ctaLabel: string;
}

const navLinks = [
  { key: 'auto', href: '/auto' },
  { key: 'habitation', href: '/habitation' },
  { key: 'sante', href: '/sante' },
  { key: 'compare', href: '/comparateur' },
  { key: 'about', href: '/apropos' },
  { key: 'contact', href: '/contact' },
];

export function MarketingHeader({ localeSwitcher, ctaHref, ctaLabel }: MarketingHeaderProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const locale = useLocale();
  const t = useTranslations('publicNav');

  React.useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setScrolled(window.scrollY > 80));
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header
      role="banner"
      className={cn(
        'sticky top-0 z-40 transition-all duration-200',
        scrolled
          ? 'bg-background/90 backdrop-blur-md border-b shadow-sm'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <div className="mx-auto max-w-7xl flex h-16 items-center justify-between px-4 md:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <LogoSkalean className="h-8 w-auto" />
        </Link>
        <nav role="navigation" aria-label={t('label', { default: 'Menu principal' })} className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link
              key={l.key}
              href={`/${locale}${l.href}`}
              className="px-3 py-2 text-sm font-medium rounded-md hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t(l.key, { default: l.key })}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {localeSwitcher}
          <Link
            href={`/${locale}${ctaHref}`}
            className="hidden sm:inline-flex items-center justify-center h-10 px-4 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {ctaLabel}
          </Link>
          <button
            type="button"
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
            aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="flex flex-col p-2">
            {navLinks.map((l) => (
              <Link
                key={l.key}
                href={`/${locale}${l.href}`}
                className="px-4 py-3 rounded-md hover:bg-accent text-sm font-medium"
                onClick={() => setMobileOpen(false)}
              >
                {t(l.key, { default: l.key })}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
```

### Fichier 14/14 : `packages/shared-ui/src/components/MarketingFooter.tsx` (~150 lignes)

```typescript
import * as React from 'react';
import Link from 'next/link';
import { Facebook, Linkedin, Youtube, Mail, Phone, MapPin } from 'lucide-react';
import { LogoSkalean } from './LogoSkalean';

interface FooterSection {
  title: string;
  links: { label: string; href: string }[];
}

const sections: FooterSection[] = [
  {
    title: 'A propos',
    links: [
      { label: 'Notre mission', href: '/apropos' },
      { label: 'Notre equipe', href: '/equipe' },
      { label: 'Carrieres', href: '/carrieres' },
      { label: 'Presse', href: '/presse' },
    ],
  },
  {
    title: 'Produits',
    links: [
      { label: 'Assurance auto', href: '/auto' },
      { label: 'Assurance habitation', href: '/habitation' },
      { label: 'Assurance sante', href: '/sante' },
      { label: 'Comparateur', href: '/comparateur' },
    ],
  },
  {
    title: 'Partenaires',
    links: [
      { label: 'Compagnies', href: '/partenaires' },
      { label: 'Reseau garages', href: '/garages' },
      { label: 'Courtiers', href: '/courtiers' },
      { label: 'Devenir partenaire', href: '/devenir-partenaire' },
    ],
  },
  {
    title: 'Mentions legales',
    links: [
      { label: 'Conditions generales', href: '/cgu' },
      { label: 'Politique de confidentialite (CNDP / Loi 09-08)', href: '/confidentialite' },
      { label: 'Politique de cookies', href: '/cookies' },
      { label: 'Mentions ACAPS', href: '/mentions-acaps' },
    ],
  },
];

export function MarketingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer role="contentinfo" className="border-t bg-muted/30 mt-12">
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2">
            <LogoSkalean className="h-9 w-auto" />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              Skalean Sofidemy InsurTech -- premiere plateforme assurtech souveraine du Maroc, hebergee
              Atlas Cloud Benguerir, conforme CNDP / ACAPS / Loi 09-08.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a href="https://facebook.com/skalean" aria-label="Facebook" className="text-muted-foreground hover:text-foreground">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://linkedin.com/company/skalean" aria-label="LinkedIn" className="text-muted-foreground hover:text-foreground">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="https://youtube.com/@skalean" aria-label="YouTube" className="text-muted-foreground hover:text-foreground">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>
          {sections.map((section) => (
            <nav key={section.title} aria-label={section.title}>
              <h3 className="font-semibold text-sm mb-3">{section.title}</h3>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 pt-6 border-t grid md:grid-cols-3 gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>Casablanca, Maroc -- Atlas Cloud Benguerir</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" />
            <a href="tel:+212522000000" className="hover:text-foreground">+212 522 00 00 00</a>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0" />
            <a href="mailto:contact@skalean-insurtech.ma" className="hover:text-foreground">contact@skalean-insurtech.ma</a>
          </div>
        </div>
        <div className="mt-6 pt-6 border-t flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>(c) {year} Skalean Sofidemy InsurTech. Tous droits reserves. Societe agreee ACAPS.</p>
          <p>
            Cabinet de courtage en assurance supervise par l'<a href="https://www.acaps.ma" className="underline hover:text-foreground">ACAPS</a> --
            Donnees personnelles : <a href="https://www.cndp.ma" className="underline hover:text-foreground">CNDP</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
```

---

## 7. Tests Vitest + Playwright (15-25 ko)

### Test 1 : `DashboardLayout.spec.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardLayout } from '../DashboardLayout';
import { Users } from 'lucide-react';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/contacts' }));
vi.mock('next-intl', () => ({
  useLocale: () => 'fr',
  useTranslations: () => (k: string, opts?: { default?: string }) => opts?.default ?? k,
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));

describe('DashboardLayout', () => {
  const sections = [{ title: 'Ops', items: [{ label: 'Contacts', href: '/contacts', icon: Users }] }];
  it('renders Sidebar + Topbar + content', () => {
    render(<DashboardLayout sidebarItems={sections}><div>page-content</div></DashboardLayout>);
    expect(screen.getByText('page-content')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
  it('renders sidebar in mobile drawer trigger', () => {
    render(<DashboardLayout sidebarItems={sections}><div /></DashboardLayout>);
    expect(screen.getByLabelText('Ouvrir le menu')).toBeInTheDocument();
  });
  it('renders breadcrumb auto', () => {
    render(<DashboardLayout sidebarItems={sections}><div /></DashboardLayout>);
    expect(screen.getByLabelText(/ariane/i)).toBeInTheDocument();
  });
  it('filters items by role', () => {
    const protectedSections = [{ items: [{ label: 'Admin', href: '/admin', icon: Users, requiredRoles: ['admin'] }] }];
    const { rerender } = render(<DashboardLayout sidebarItems={protectedSections} userRoles={['user']}><div /></DashboardLayout>);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    rerender(<DashboardLayout sidebarItems={protectedSections} userRoles={['admin']}><div /></DashboardLayout>);
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
  });
});
```

### Test 2 : `SelfServiceLayout.spec.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SelfServiceLayout } from '../SelfServiceLayout';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr', useTranslations: () => (k: string, o?: any) => o?.default ?? k }));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme: vi.fn() }) }));

describe('SelfServiceLayout', () => {
  it('renders without sidebar', () => {
    render(<SelfServiceLayout><div>content</div></SelfServiceLayout>);
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /sidebar|principale/i })).not.toBeInTheDocument();
  });
  it('applies large base font (text-lg)', () => {
    const { container } = render(<SelfServiceLayout><div /></SelfServiceLayout>);
    expect(container.firstChild).toHaveClass('text-lg');
  });
  it('content max-w-3xl centered', () => {
    render(<SelfServiceLayout><div data-testid="ct" /></SelfServiceLayout>);
    const main = screen.getByRole('main');
    expect(main.className).toContain('max-w-3xl');
  });
});
```

### Test 3 : `MobileLayout.spec.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MobileLayout } from '../MobileLayout';
import { Home, Search, User } from 'lucide-react';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr', useTranslations: () => (k: string, o?: any) => o?.default ?? k }));

describe('MobileLayout', () => {
  const tabs = [
    { label: 'Accueil', href: '/', icon: Home },
    { label: 'Recherche', href: '/search', icon: Search },
    { label: 'Profil', href: '/profile', icon: User },
  ];
  it('renders BottomTabs', () => {
    render(<MobileLayout tabs={tabs}><div>page</div></MobileLayout>);
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('page')).toBeInTheDocument();
  });
  it('main has bottom padding for tabs + safe area', () => {
    render(<MobileLayout tabs={tabs}><div /></MobileLayout>);
    const main = screen.getByRole('main');
    expect(main.style.paddingBottom).toContain('env(safe-area-inset-bottom)');
  });
});
```

### Test 4 : `PublicLayout.spec.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PublicLayout } from '../PublicLayout';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr' }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr', useTranslations: () => (k: string, o?: any) => o?.default ?? k }));

describe('PublicLayout', () => {
  it('renders MarketingHeader and Footer', () => {
    render(<PublicLayout><div>hero</div></PublicLayout>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByText('hero')).toBeInTheDocument();
  });
  it('does not render UserMenu (no auth)', () => {
    render(<PublicLayout><div /></PublicLayout>);
    expect(screen.queryByLabelText(/menu utilisateur/i)).not.toBeInTheDocument();
  });
  it('footer has ACAPS and CNDP mentions', () => {
    render(<PublicLayout><div /></PublicLayout>);
    expect(screen.getByText(/ACAPS/i)).toBeInTheDocument();
    expect(screen.getByText(/CNDP/i)).toBeInTheDocument();
  });
});
```

### Test 5 : `Sidebar.spec.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar } from '../Sidebar';
import { Users, Settings } from 'lucide-react';
import { useSidebarOpen } from '../../hooks/useSidebarOpen';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/contacts' }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr', useTranslations: () => (k: string, o?: any) => o?.default ?? k }));

describe('Sidebar', () => {
  beforeEach(() => {
    useSidebarOpen.setState({ isOpen: true, isDrawerOpen: false, hasHydrated: true });
  });
  const sections = [
    { title: 'Ops', items: [{ label: 'Contacts', href: '/contacts', icon: Users }] },
    { title: 'Admin', items: [{ label: 'Settings', href: '/settings', icon: Settings, requiredRoles: ['admin'] }] },
  ];
  it('renders sections and items', () => {
    render(<Sidebar sections={sections} />);
    expect(screen.getAllByText('Contacts').length).toBeGreaterThan(0);
  });
  it('marks active item via aria-current', () => {
    render(<Sidebar sections={sections} />);
    const link = screen.getAllByText('Contacts')[0].closest('a')!;
    expect(link).toHaveAttribute('aria-current', 'page');
  });
  it('filters by user roles', () => {
    render(<Sidebar sections={sections} userRoles={['user']} />);
    expect(screen.queryAllByText('Settings').length).toBe(0);
  });
  it('toggles collapse', () => {
    render(<Sidebar sections={sections} />);
    const btn = screen.getByLabelText(/Reduire la sidebar/i);
    fireEvent.click(btn);
    expect(useSidebarOpen.getState().isOpen).toBe(false);
  });
});
```

### Test 6 : `Topbar.spec.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Topbar } from '../Topbar';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string, o?: any) => o?.default ?? k }));

describe('Topbar', () => {
  it('renders provided slots', () => {
    render(
      <Topbar
        breadcrumb={<span>bc</span>}
        actions={<button>action</button>}
        userMenu={<span>um</span>}
        notificationBell={<span>nb</span>}
      />,
    );
    expect(screen.getByText('um')).toBeInTheDocument();
    expect(screen.getByText('nb')).toBeInTheDocument();
  });
  it('is sticky top-0', () => {
    render(<Topbar />);
    expect(screen.getByRole('banner')).toHaveClass('sticky');
    expect(screen.getByRole('banner')).toHaveClass('top-0');
  });
  it('shows hamburger when showHamburger=true', () => {
    render(<Topbar showHamburger />);
    expect(screen.getByLabelText('Ouvrir le menu')).toBeInTheDocument();
  });
});
```

### Test 7 : `BottomTabs.spec.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BottomTabs } from '../BottomTabs';
import { Home, Bell, User } from 'lucide-react';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/notifications' }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr' }));

describe('BottomTabs', () => {
  const tabs = [
    { label: 'Accueil', href: '/', icon: Home },
    { label: 'Notifs', href: '/notifications', icon: Bell, badge: 3 },
    { label: 'Profil', href: '/profile', icon: User },
  ];
  it('renders 3 tabs', () => {
    render(<BottomTabs tabs={tabs} />);
    expect(screen.getAllByRole('link')).toHaveLength(3);
  });
  it('marks active tab via aria-current', () => {
    render(<BottomTabs tabs={tabs} />);
    const active = screen.getByText('Notifs').closest('a')!;
    expect(active).toHaveAttribute('aria-current', 'page');
  });
  it('renders badge', () => {
    render(<BottomTabs tabs={tabs} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
  it('caps badge at 99+', () => {
    render(<BottomTabs tabs={[{ label: 'X', href: '/x', icon: Home, badge: 150 }]} />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });
  it('has md:hidden class', () => {
    render(<BottomTabs tabs={tabs} />);
    expect(screen.getByRole('navigation')).toHaveClass('md:hidden');
  });
});
```

### Test 8 : `UserMenu.spec.tsx`

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { UserMenu } from '../UserMenu';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string, o?: any) => o?.default ?? k }));

describe('UserMenu', () => {
  const user = { id: '1', fullName: 'Mohammed Alami', email: 'm@x.ma', roles: ['broker_admin'] };
  it('renders avatar with initials', () => {
    render(<UserMenu user={user} />);
    expect(screen.getByText('MA')).toBeInTheDocument();
  });
  it('opens dropdown and shows logout', async () => {
    const onLogout = vi.fn();
    render(<UserMenu user={user} onLogout={onLogout} />);
    fireEvent.click(screen.getByLabelText(/menu utilisateur/i));
    const logout = await screen.findByText(/se deconnecter/i);
    fireEvent.click(logout);
    expect(onLogout).toHaveBeenCalled();
  });
  it('displays role', async () => {
    render(<UserMenu user={user} />);
    fireEvent.click(screen.getByLabelText(/menu utilisateur/i));
    expect(await screen.findByText(/broker_admin/i)).toBeInTheDocument();
  });
});
```

### Test 9 : `Breadcrumb.spec.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Breadcrumb } from '../Breadcrumb';

vi.mock('next/navigation', () => ({ usePathname: () => '/fr/contacts/123' }));
vi.mock('next-intl', () => ({ useLocale: () => 'fr', useTranslations: () => (k: string, o?: any) => o?.default ?? k }));

describe('Breadcrumb', () => {
  it('auto-builds from pathname', () => {
    render(<Breadcrumb />);
    expect(screen.getByText('Accueil')).toBeInTheDocument();
    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });
  it('uses dynamicSegments override', () => {
    render(<Breadcrumb dynamicSegments={{ '123': 'Mohammed Alami' }} />);
    expect(screen.getByText('Mohammed Alami')).toBeInTheDocument();
  });
  it('last item is non-clickable (aria-current)', () => {
    render(<Breadcrumb />);
    const last = screen.getByText('123');
    expect(last).toHaveAttribute('aria-current', 'page');
    expect(last.tagName).toBe('SPAN');
  });
});
```

### Test 10 : `ThemeToggle.spec.tsx`

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ThemeToggle } from '../ThemeToggle';

const setTheme = vi.fn();
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'light', setTheme }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string, o?: any) => o?.default ?? k }));

describe('ThemeToggle', () => {
  it('exposes 3 theme options', async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByLabelText(/theme/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/theme/i));
    expect(await screen.findByText(/clair/i)).toBeInTheDocument();
    expect(screen.getByText(/sombre/i)).toBeInTheDocument();
    expect(screen.getByText(/systeme/i)).toBeInTheDocument();
  });
  it('calls setTheme', async () => {
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByLabelText(/theme/i)).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText(/theme/i));
    fireEvent.click(await screen.findByText(/sombre/i));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });
});
```

### Test 11 : `useSidebarOpen.spec.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useSidebarOpen } from '../useSidebarOpen';

describe('useSidebarOpen', () => {
  beforeEach(() => {
    useSidebarOpen.setState({ isOpen: true, isDrawerOpen: false, hasHydrated: false });
    localStorage.clear();
  });
  it('toggles isOpen', () => {
    expect(useSidebarOpen.getState().isOpen).toBe(true);
    useSidebarOpen.getState().toggle();
    expect(useSidebarOpen.getState().isOpen).toBe(false);
  });
  it('persists to localStorage', () => {
    useSidebarOpen.getState().setOpen(false);
    const stored = localStorage.getItem('skalean-sidebar-open');
    expect(stored).toContain('"isOpen":false');
  });
  it('drawer is independent of collapse', () => {
    useSidebarOpen.getState().setDrawerOpen(true);
    expect(useSidebarOpen.getState().isDrawerOpen).toBe(true);
    expect(useSidebarOpen.getState().isOpen).toBe(true);
  });
});
```

### Test 12 : Playwright e2e `repo/e2e/web/layouts.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const apps = [
  { name: 'broker', port: 3001, expect: 'sidebar' },
  { name: 'garage', port: 3002, expect: 'sidebar' },
  { name: 'admin', port: 3000, expect: 'sidebar' },
  { name: 'assure-portal', port: 3005, expect: 'self-service' },
  { name: 'garage-mobile', port: 3003, expect: 'mobile' },
  { name: 'assure-mobile', port: 3006, expect: 'mobile' },
  { name: 'customer-portal', port: 3004, expect: 'public' },
];

for (const app of apps) {
  test(`${app.name} renders correct layout`, async ({ page }) => {
    await page.goto(`http://localhost:${app.port}/fr`);
    if (app.expect === 'sidebar') {
      await expect(page.getByRole('navigation', { name: /principale/i }).first()).toBeVisible();
    }
    if (app.expect === 'self-service') {
      await expect(page.getByText('Mon espace assure')).toBeVisible();
    }
    if (app.expect === 'mobile') {
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.locator('nav[aria-label*="mobile"]')).toBeVisible();
    }
    if (app.expect === 'public') {
      await expect(page.getByText('ACAPS')).toBeVisible();
      await expect(page.getByText('CNDP')).toBeVisible();
    }
  });
}

test('Sidebar collapse persists across reload (broker)', async ({ page }) => {
  await page.goto('http://localhost:3001/fr');
  await page.getByLabel(/Reduire la sidebar/i).click();
  await page.reload();
  const stored = await page.evaluate(() => localStorage.getItem('skalean-sidebar-open'));
  expect(stored).toContain('"isOpen":false');
});

test('Drawer mobile open/close (broker)', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('http://localhost:3001/fr');
  await page.getByLabel('Ouvrir le menu').first().click();
  await expect(page.locator('[role="dialog"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
});

test('BottomTabs hidden md+ (garage-mobile)', async ({ page }) => {
  await page.goto('http://localhost:3003/fr');
  await page.setViewportSize({ width: 1280, height: 800 });
  const tabs = page.locator('nav[aria-label*="mobile"]');
  await expect(tabs).toBeHidden();
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(tabs).toBeVisible();
});

test('Locale switch preserves layout state', async ({ page }) => {
  await page.goto('http://localhost:3001/fr');
  await page.getByLabel(/Reduire la sidebar/i).click();
  await page.goto('http://localhost:3001/ar-MA');
  const stored = await page.evaluate(() => localStorage.getItem('skalean-sidebar-open'));
  expect(stored).toContain('"isOpen":false');
});
```

---

## 8. Definition of Done (1-2 ko)

- [ ] 14 fichiers code livres (4 layouts + 9 composants + 1 hook).
- [ ] 11 specs Vitest passent (`pnpm --filter @insurtech/shared-ui test`).
- [ ] Coverage shared-ui >= 90% statements (Vitest --coverage).
- [ ] Tests Playwright e2e 8 apps passent (`pnpm exec playwright test e2e/web/layouts.spec.ts`).
- [ ] 8 apps integrent leur layout (verifier dans `apps/web-*/src/app/[locale]/layout.tsx`).
- [ ] `pnpm --filter @insurtech/shared-ui build` reussit sans erreur typescript.
- [ ] Audit Axe baseline 0 violation critique.
- [ ] Documentation README shared-ui section Layouts mise a jour.
- [ ] No emoji audit (`scripts/check-no-emoji.sh`).
- [ ] Sidebar collapse state persiste localStorage cross-reload.
- [ ] BottomTabs visible uniquement <md, hidden md+.
- [ ] safe-area-inset iOS applique MobileLayout.
- [ ] Locale switch fr -> ar-MA flip RTL sans layout shift critique.
- [ ] Lighthouse a11y score >= 90 sur chaque layout.
- [ ] PR review : 2 reviewers (frontend lead + UX lead).

---

## 9. Risques & Mitigations (1-2 ko)

| Risque | Probabilite | Impact | Mitigation |
|--------|-------------|--------|------------|
| Hydration mismatch Zustand persist | Moyenne | Console warnings + flicker | `skipHydration: true` + `hasHydrated` flag, render placeholder pendant 1 frame |
| FOUC theme dark/light | Moyenne | Flash visible | next-themes script blocking head injecte |
| Radix Sheet SSR Portal undefined | Faible | Error build | `'use client'` sur composants utilisant Sheet |
| safe-area-inset-bottom 0 desktop dev | Haute | Tests dev pas representatifs | `max(env(...), 0.5rem)` fallback + tests iOS Simulator |
| Locale switch bouge layout RTL | Moyenne | Layout shift CLS Lighthouse | utiliser `ms-*` `me-*` (margin-start/end) au lieu de `ml-*` `mr-*` |
| BottomTabs > 5 tabs UX deteriore | Faible | Mobile sat overflow | warning console dev + revue UX |
| Sidebar items role filter Sprint 7 inadequate | Haute (Sprint 7) | Refactor signature | API stable `userRoles?: string[]` placeholder |
| Marketing footer year stale SSG | Moyenne | Annee gelee build | `'use client'` recalc OR build CI nightly |
| ThemeToggle absent SSG public | Faible | UX inconsistante | decision-design assume |
| MarketingHeader scroll handler memory leak | Faible | Memory growth | cleanup `removeEventListener` + cancelAnimationFrame |

---

## 10. Criteres validation (28+ V) (3-4 ko)

### P0 (15 criteres)

- **V1** : `<DashboardLayout>` rendable avec sidebar + topbar + content + footer.
- **V2** : `<SelfServiceLayout>` rendable sans sidebar, content max-w-3xl centre, base font 18px.
- **V3** : `<MobileLayout>` rendable avec topbar mini + BottomTabs + safe area.
- **V4** : `<PublicLayout>` rendable avec MarketingHeader + content + MarketingFooter, no auth.
- **V5** : Sidebar collapse/expand toggle visible, classe `w-64 <-> w-16`.
- **V6** : Sidebar drawer mobile <md (Radix Sheet), hidden desktop md+.
- **V7** : BottomTabs visible <md only (`md:hidden` class verifie via test).
- **V8** : `useSidebarOpen` Zustand store partage state cross-component.
- **V9** : Topbar sticky top-0 + backdrop-blur applique (variant=blur).
- **V10** : Hamburger menu visible <md, declenche drawer Sheet.
- **V11** : ThemeToggle tri-state (light/dark/system) fonctionnel via next-themes.
- **V12** : LocaleSwitcher integre Topbar/MarketingHeader (consume props slot).
- **V13** : UserMenu dropdown Radix Avatar + DropdownMenu, logout fonctionnel callback.
- **V14** : Breadcrumb auto-genere depuis `usePathname` (3 segments minimum testes).
- **V15** : NotificationBell placeholder bell icon + badge count rendu.

### P1 (8 criteres)

- **V16** : Safe-area-inset-bottom iOS notch padding applique MobileLayout main.
- **V17** : Role-based sidebar filter actif avec prop `userRoles?: string[]` (Sprint 7 enrichira).
- **V18** : ARIA accessibility complet (role navigation, aria-current, aria-label, focus-trap drawer).
- **V19** : Keyboard navigation Tab/Enter/Space/Esc fonctionnels (sidebar, drawer, dropdown, hamburger).
- **V20** : Focus-visible ring visible sur tous elements interactifs.
- **V21** : Sidebar collapse persiste localStorage `skalean-sidebar-open` cross-reload.
- **V22** : Theme persiste via next-themes (cookie + localStorage).
- **V23** : Hover transitions duration <200ms (`transition-colors duration-200`).

### P2 (7 criteres)

- **V24** : Sidebar variants modes implementes (mini icon-only / full / drawer mobile).
- **V25** : Topbar variants implementes (transparent / solid / blur via prop).
- **V26** : BottomTabs variants supportes (4 tabs / 5 tabs).
- **V27** : MarketingFooter sections customizables (4 sections par defaut, prop override possible).
- **V28** : MarketingHeader transparent on hero, solid on scroll detection (>80px scrollY).
- **V29** : Command palette slot reserve dans Topbar (Sprint 30 implementera cmdk).
- **V30** : Audit Axe baseline 0 violation critique sur 4 layouts.

---

## 11. Edge Cases (10+ scenarios) (2-3 ko)

1. **Sidebar collapse vs drawer mobile** : 2 etats independants (`isOpen` desktop persist, `isDrawerOpen` mobile session). Eviter : rendre drawer ouvert au reload mobile.
2. **BottomTabs hidden md+** : viewport >= 768px cache BottomTabs (`md:hidden`). User redimensionne fenetre dynamiquement, BottomTabs apparait/disparait fluide.
3. **safe-area-inset-bottom iOS notch** : `pb-[max(env(safe-area-inset-bottom),0.5rem)]` sur BottomTabs container. Test simulator iOS.
4. **Sidebar persist localStorage hydration** : Zustand `skipHydration: true` + `hasHydrated` flag evite mismatch SSR/CSR. Sidebar invisible 1 frame puis se reveille.
5. **Role-based filter Sprint 7 placeholder** : prop `userRoles` ignoree visuellement Sprint 4 si vide -> tous items visibles. Sprint 7 connecte `useSession()` next-auth.
6. **Locale switch fr -> ar (RTL)** : `<html dir="rtl">` flip Tailwind utilities `ms-*`/`me-*`. Sidebar passe a droite, BottomTabs ordre inverse, Breadcrumb ChevronRight rotate-180.
7. **next-themes flicker SSR -> CSR** : script blocking inline dans `<head>` evite flash. Mounted flag pattern dans ThemeToggle pour Sun/Moon icon.
8. **Breadcrumb i18n segments dynamiques** : `/fr/contacts/abc-123-uuid` -> "Accueil > Contacts > abc-123-uuid". Page fait `<Breadcrumb dynamicSegments={{ 'abc-123-uuid': 'Mohammed Alami' }} />` apres fetch.
9. **UserMenu dropdown mobile full-screen** : Radix DropdownMenu rend popup <320px width. Mobile portrait 360px OK. Edge cas tres petit ecran (320px iPhone SE) : dropdown coupe. Acceptable Sprint 4.
10. **NotificationBell badge count realtime Sprint 9** : Sprint 4 prop `unreadCount` dur. Sprint 9 connecte `useNotifications().unreadCount` SSE.
11. **ThemeToggle preference vs system** : user choisit "system", change theme OS dark/light, app suit auto via `prefers-color-scheme`. User choisit "light/dark" explicit, ignore OS.
12. **Layout transition smooth** : sidebar collapse `transition-[width] duration-200`, drawer slide animations Radix Sheet `data-[state=open]:animate-in slide-in-from-left`.
13. **Logo Skalean RTL** : SVG `<LogoSkalean>` ne flip pas en RTL (logo conserve orientation). Texte associe ("Skalean") en RTL flip naturel CSS.
14. **MarketingFooter copyright year SSG stale** : build janvier 2026 = "2026". Build CI nightly (Sprint 18) recalc auto.
15. **BottomTabs badge count overflow** : `badge: 150` -> "99+". Width fixe `min-w-[1.25rem]` evite layout shift.

---

## 12. Conformite Reglementaire (1-2 ko)

### WCAG 2.1 AA Accessibility

- **Keyboard navigation** : tous elements interactifs (sidebar items, hamburger, dropdown, toggle) accessible Tab/Enter/Space/Esc.
- **ARIA roles** : `role="navigation"` (sidebar, BottomTabs, MarketingHeader nav), `role="banner"` (Topbar/MarketingHeader), `role="main"` (content), `role="contentinfo"` (footer), `aria-current="page"` items actifs, `aria-label` boutons icon-only, `aria-expanded` hamburger, `aria-haspopup` dropdown.
- **Focus-visible** : ring outline 2px primary sur tous elements focus, visible meme dark mode.
- **Contrast** : palette Skalean Sofidemy WCAG AA verifiee (Orange #E95D2C sur Navy #1A2730 = 5.2:1, Sky Blue #B0CEE2 sur white = 4.6:1).
- **Touch targets** : min 44x44px (BottomTabs items 56px, hamburger 40x40 acceptable mais 44 visee Sprint 18).

### Loi 09-08 / CNDP (Maroc protection donnees)

- **UserMenu logout** : callback `onLogout` doit clear session next-auth + cookies HttpOnly + tenant store + localStorage `skalean-*`. Sprint 5 (Auth) implementera. Droit oubli partiel (suppression session active).
- **MarketingFooter mention CNDP** : lien obligatoire vers `/confidentialite` page politique RGPD/CNDP. Mention "Donnees personnelles : CNDP".
- **Politique cookies** : link `/cookies` dans footer mentions legales. Sprint 18 implementera bandeau consentement.

### ACAPS (Autorite Controle Assurances Securite Sociale Maroc)

- **MarketingFooter mention ACAPS** : "Cabinet de courtage en assurance supervise par l'ACAPS" + lien `acaps.ma`. Conforme circulaire ACAPS 2024 sur transparence intermediaires.
- **Logo ACAPS** : Sprint 18 ajoutera logo officiel ACAPS dans footer (apres validation autorisation usage).

---

## 13. Conventions (14 conventions complete) (1-2 ko)

1. **No emoji absolu** : zero emoji dans code/messages/JSON/README. Icones via lucide-react uniquement.
2. **TypeScript strict** : `strict: true`, `noUncheckedIndexedAccess: true`. Pas de `any` (sauf type imports vendor).
3. **Composants 'use client'** : seulement si interactivity (hooks, events). Layouts compose Server Components quand possible.
4. **CSS variables Tailwind 4** : couleurs via `bg-background`, `text-foreground`, `border-border` (jamais Tailwind colors `bg-orange-500` direct).
5. **RTL via margin-start/end** : `ms-4` `me-4` au lieu `ml-4` `mr-4`. `ps-4` `pe-4` au lieu `pl-4` `pr-4`.
6. **Naming components** : PascalCase. Hooks `useXxx`. Types `XxxProps`, `XxxItem`.
7. **Imports order** : 1) React, 2) Next.js, 3) tiers (next-intl, next-themes, lucide-react, zustand), 4) `@insurtech/*`, 5) `./relative`.
8. **ARIA labels FR** : `aria-label="Ouvrir le menu"` (pas EN). Translatable via `useTranslations` quand integre app.
9. **Forwarded ref** : composants atomiques (Button, Input) `forwardRef`. Composants compose (Layouts) pas necessaire.
10. **Props extension HTML** : `Component & React.ComponentPropsWithoutRef<'div'>` pour pass-through className/id/data-*.
11. **Default exports interdits** : named exports only. Facilite refactor + auto-import ide.
12. **No magic numbers** : breakpoints via Tailwind (md = 768), couleurs via CSS variables.
13. **Tests files colocates** : `__tests__/` dossier a cote (pas global `tests/`).
14. **Stories Storybook colocates** : `*.stories.tsx` a cote du composant (Tache 1.4.16 P1).

---

## 14. Gates qualite (1 ko)

- **Lint** : `pnpm --filter @insurtech/shared-ui lint` 0 errors, 0 warnings.
- **Typecheck** : `pnpm --filter @insurtech/shared-ui typecheck` 0 errors.
- **Tests unit** : `pnpm --filter @insurtech/shared-ui test` 11/11 specs pass, coverage >= 90%.
- **Tests e2e** : `pnpm exec playwright test e2e/web/layouts.spec.ts` 12+ tests pass cross-app.
- **Build** : `pnpm --filter @insurtech/shared-ui build` reussit, bundle size <= 50 ko gzipped.
- **Audit Axe** : 0 violation `impact: 'critical'`, <= 5 violations `impact: 'serious'`.
- **Lighthouse a11y** : score >= 90 sur 4 layouts (test via `pnpm lh:layouts`).
- **No emoji** : `scripts/check-no-emoji.sh packages/shared-ui/` exit 0.
- **CI workflow** : `.github/workflows/shared-ui.yml` PR gate (lint + typecheck + test + build).

---

## 15. Effort & dependances (0.5 ko)

**Effort detaille** : 6h total
- Hook Zustand `useSidebarOpen` + tests : 0.5h
- Composants atomiques (Sidebar, Topbar, BottomTabs, UserMenu, NotificationBell, Breadcrumb, ThemeToggle) + tests : 2.5h
- Layouts (DashboardLayout, SelfServiceLayout, MobileLayout, PublicLayout) + tests : 1.5h
- MarketingHeader + MarketingFooter + tests : 0.5h
- Integration 8 apps + e2e Playwright : 0.5h
- Audit Axe + Lighthouse + Storybook (P1) : 0.5h

**Dependances upstream** : 1.4.8 (shared-ui base), 1.4.11 (i18n), 1.4.13 (OpenAPI client types user/role), 1.4.1-1.4.7 (8 apps stubs).
**Dependances downstream** : 1.4.15 (placeholder pages consomment layouts), 1.4.16 (E2E + Storybook).

---

## 16. Acceptance Tests (1 ko)

```bash
# 1. Tests unitaires shared-ui
pnpm --filter @insurtech/shared-ui test
# Expected: 11+ specs PASS

# 2. Coverage
pnpm --filter @insurtech/shared-ui test -- --coverage
# Expected: >= 90% statements

# 3. Build production
pnpm --filter @insurtech/shared-ui build
# Expected: 0 errors, dist/ generated

# 4. Demarrage 8 apps
pnpm dev
# Expected: 8 apps demarrent sur ports 3000-3006

# 5. Tests Playwright
pnpm exec playwright test e2e/web/layouts.spec.ts
# Expected: 12+ tests PASS

# 6. Axe accessibility
pnpm exec playwright test e2e/axe.spec.ts
# Expected: 0 violations critical

# 7. Lighthouse layouts
pnpm lh:layouts
# Expected: a11y >= 90 each app

# 8. No emoji
bash scripts/check-no-emoji.sh packages/shared-ui/
# Expected: exit 0

# 9. Manual QA mobile
# Open http://localhost:3003/fr in iOS Simulator iPhone 15 Pro
# Expected: BottomTabs visible, safe-area-inset-bottom respect notch

# 10. Manual QA desktop
# Open http://localhost:3001/fr in Chrome desktop
# Expected: Sidebar collapsible, drawer hidden, breadcrumb auto
```

---

## 17. Documentation a livrer (0.5-1 ko)

- **README.md shared-ui** : section "Layouts" decrit chaque layout + props + exemple d'usage. Section "Components" decrit Sidebar/Topbar/BottomTabs/UserMenu/NotificationBell/Breadcrumb/ThemeToggle/MarketingHeader/MarketingFooter avec props et exemples.
- **Storybook stories (P1 Tache 1.4.16)** : 4 fichiers `DashboardLayout.stories.tsx`, `SelfServiceLayout.stories.tsx`, `MobileLayout.stories.tsx`, `PublicLayout.stories.tsx`. 1 story par variant (default, with-data, dark-theme, RTL).
- **CHANGELOG shared-ui** : entree "1.4.0 - Sprint 4 layouts (DashboardLayout, SelfServiceLayout, MobileLayout, PublicLayout) + 9 composants reutilisables".
- **ADR-0014** : `00-pilotage/decisions/ADR-0014-layouts-archetypes-shared-ui.md` justifie 4 archetypes layouts vs N apps duplique. Liens vers cette tache.
- **Migration guide** : 8 apps doivent ajouter `import { DashboardLayout } from '@insurtech/shared-ui'` dans `app/[locale]/layout.tsx`. Diff before/after dans README.

---

**Fin tache 1.4.14.** Layouts partages livres. Apps consomment via 1 ligne import. Sidebar drawer mobile + BottomTabs safe-area + RTL + theme tri-state operationnels. Sprint 7 enrichira filtrage role-based, Sprint 9 NotificationBell realtime, Sprint 18 SEO MarketingHeader/Footer, Sprint 30 command palette. Bloque debloquage tache 1.4.15 (pages placeholder + 404/500) qui consommera ces layouts.
