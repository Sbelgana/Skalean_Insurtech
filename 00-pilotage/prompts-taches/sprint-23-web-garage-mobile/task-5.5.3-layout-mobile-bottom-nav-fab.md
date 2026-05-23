# TACHE 5.5.3 -- Layout Mobile : Bottom Nav 5 Tabs + Topbar Compact + FAB Context-Sensitive

**Sprint** : 23 / 35 (cumul) -- Phase 5 / Sprint 5 dans la phase
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md` (Tache 5.5.3)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (chassis de navigation -- toutes les pages metier l'utilisent)
**Effort** : 4h
**Dependances** :
- Tache 5.5.1 (skeleton : providers, AuthContext, env, tailwind theme garage + safe-area utilities, globals.css avec `touch-action`/`overscroll-behavior`)
- Tache 5.5.2 (auth : un user authentifie atteint le segment `(protected)` ; `useAuth` expose user + isAuthenticated)
- Sprint 22 (`@insurtech/garage-shared` : StatusBadge, OrderCard, types disponibles)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente le **chassis de navigation mobile** de la PWA web-garage-mobile : le layout du segment `(protected)` qui enveloppe toutes les pages accessibles a un technicien authentifie. Il comprend une **bottom navigation a 5 onglets** (Aujourd'hui, Mes orders, Camera, Notifications, Profil), une **topbar compacte** (bouton retour contextuel, titre de page, badge tenant), et un **bouton d'action flottant (FAB) context-sensitive** dont l'action change selon la page courante (prendre une photo, demarrer/arreter le timer d'heures, marquer une tache complete). Il integre egalement le **pull-to-refresh**, le respect des **safe-area insets** (notch iPhone, barre gestuelle Android) et le routing RTL pour les locales arabes.

L'apport est triple. D'abord, **standardiser la navigation atelier** : la bottom nav est le pattern mobile dominant (Instagram, WhatsApp, apps bancaires) parce qu'elle place les destinations principales a portee du pouce, sans menu hamburger a deplier. Pour un technicien aux mains occupees, atteindre une destination en 1 tap au bas de l'ecran est decisif. Ensuite, **rendre l'action principale toujours accessible via le FAB** : plutot que d'enfouir "prendre une photo" ou "logger des heures" dans des sous-menus, le FAB expose en permanence l'action la plus probable du contexte courant, reduisant les actions frequentes a 1 tap. Enfin, **garantir la robustesse mobile** (safe areas, pull-to-refresh, RTL, cibles tactiles 44px+) des le chassis, pour que les 9 pages metier qui s'y inscrivent heritent automatiquement de ces garanties sans les reimplementer.

A l'issue de cette tache, un technicien authentifie voit, sur chaque page protegee : une bottom nav fixe en bas (5 onglets, l'actif surligne, badge compteur sur Notifications), une topbar fixe en haut (titre, retour si profondeur > 1, badge du garage courant), et un FAB flottant a droite dont l'icone et l'action s'adaptent. Le contenu de la page scrolle entre les deux barres, respecte les encoches, et peut etre rafraichi par un geste de tirage vers le bas. En locale `ar`/`ar-MA`, toute la mise en page bascule en RTL.

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Le skeleton (Tache 5.5.1) a pose les fondations techniques (providers, PWA, client API) mais aucune structure de navigation visible. Le segment `(protected)` existe mais son `layout.tsx` est vide. Sans ce chassis, chaque page metier devrait reimplementer sa propre navigation, ce qui produirait des incoherences (positions de boutons differentes, comportements de retour divergents) et multiplierait le code. Le layout `(protected)` est le point unique ou se definit l'experience de navigation pour les 9 pages du sprint.

Le choix d'une **bottom nav a 5 onglets** (et pas une sidebar ou un drawer) decoule directement de l'ergonomie mobile : sur un smartphone tenu a une main, la zone confortable du pouce est le tiers inferieur de l'ecran. Une sidebar (pattern desktop Sprint 22) exigerait un geste de bord ou un bouton hamburger en haut, hors de portee du pouce et a deplier. Cinq onglets est le maximum recommande pour rester lisible et tactile (au-dela, les cibles deviennent trop etroites). Le 3eme onglet central (Camera) est volontairement mis en avant car la capture photo est l'action la plus frequente et la plus critique du technicien.

Le **FAB context-sensitive** repond a un constat : l'action principale varie selon la page. Sur le detail d'un order, c'est "demarrer le timer" ou "prendre une photo" ; sur la reception, c'est "photo suivante" ; sur Aujourd'hui, c'est "scanner/camera". Plutot que multiplier les boutons fixes, un seul FAB dont l'action s'adapte au contexte garde l'UI epuree et l'action toujours a portee.

### Reutilisation et coherence avec Sprint 18 / Sprint 22

| Element | Reference | Adaptation Sprint 23 |
|---------|-----------|----------------------|
| Bottom nav pattern | Sprint 18 web-assure-mobile (4 tabs assure) | 5 tabs technicien, onglet camera central proeminent |
| Safe-area utilities | Sprint 18 + Tache 5.5.1 (tailwind config) | reutilise `pb-safe`, `env(safe-area-inset-*)` |
| StatusBadge / OrderCard | `@insurtech/garage-shared` (Sprint 22 + 5.5.1) | consommes par les pages, pas le layout |
| Pull-to-refresh | nouveau (assure n'en avait pas) | hook custom leger, sans dependance lourde |
| RTL | Sprint 18 i18n RTL | herite du `dir` du LocaleLayout (Tache 5.5.1) |
| Theme couleurs | Sofidemy navy/rouge (Tache 5.5.1 tailwind) | reutilise `garage-navy`, `garage-primary` |

### Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **Bottom nav 5 tabs + FAB (CHOIX)** | Ergonomie pouce, actions 1 tap, pattern standard, FAB action contextuelle | 5 tabs = limite haute lisibilite | RETENU |
| Sidebar drawer (hamburger) | Plus d'items possibles | Hors zone pouce, geste a deplier, lent | rejete : ergonomie mobile |
| Tab bar top | Compatible web classique | Hors portee pouce, mauvais sur grand ecran | rejete |
| Bottom nav sans FAB | Plus simple | Action principale enfouie dans la page | rejete : friction action frequente |
| 4 tabs (comme assure) | Plus de place par tab | Camera meriterait sa proeminence, et profil/notifs separes utiles | rejete : 5 tabs justifies |

### Trade-offs explicites

1. **Onglet Camera central "proeminent" mais c'est un onglet, pas le FAB** : le 3eme onglet (camera) est mis en avant visuellement (legerement surdimensionne / couleur). Il navigue vers une page de capture rapide. Le FAB, lui, est l'action contextuelle de la page courante. Risque de confusion camera-onglet vs camera-FAB : mitige en differenciant clairement (l'onglet ouvre la page camera generale ; le FAB sur une page order prend une photo liee a cet order). Documenté pour les pages.

2. **Pull-to-refresh custom (pas de lib)** : on implemente un hook leger plutot que d'ajouter `react-pull-to-refresh` (lib non maintenue, +bundle). Trade-off : un peu de code a maintenir, mais zero dependance et controle total du seuil/animation. Sur iOS standalone, on desactive le bounce natif (globals.css 5.5.1) pour eviter le conflit.

3. **FAB cache sur certaines pages** : sur Notifications et Profil, aucune action principale evidente -> le FAB est masque. Trade-off : incoherence visuelle (FAB present/absent) mais preferable a un FAB sans action claire. La config par page decide.

4. **Badge compteur notifications cote client (polling leger)** : le compteur de notifications non lues est rafraichi par un fetch periodique leger (TanStack Query refetchInterval) plutot qu'un websocket temps reel. Trade-off : latence de quelques secondes sur le badge, mais simplicite et economie de connexion (atelier intermittent). Le push (Tache 5.5.11) reveillera l'app pour les notifs critiques.

### Decisions strategiques referenced

- **decision-002 (multi-tenant)** : la topbar affiche un badge du tenant (garage) courant. Le `tenant_id` vient de `useAuth().user.tenant_id`.
- **decision-006 (no-emoji)** : les icones de la nav sont des SVG (lucide-react), jamais des emoji.
- **WCAG 2.5.5 (cibles tactiles)** : chaque onglet et le FAB respectent une cible >= 44px (la tailwind config 5.5.1 fournit `min-h-touch`).

### Pieges techniques connus

1. **Piege : la bottom nav masque le contenu bas de page**
   - Pourquoi : la nav est `fixed bottom-0` ; sans padding bas, le dernier element de la page passe dessous.
   - Solution : le conteneur de contenu a un `padding-bottom` egal a la hauteur de la nav + safe area (`pb-[calc(4rem+env(safe-area-inset-bottom))]`).

2. **Piege : safe area non appliquee -> nav sous la barre gestuelle Android / home indicator iPhone**
   - Pourquoi : sans `env(safe-area-inset-bottom)`, la nav est collee au bord et chevauche la barre systeme.
   - Solution : la nav a un `padding-bottom: env(safe-area-inset-bottom)` ; `viewportFit: cover` est deja pose (5.5.1).

3. **Piege : RTL casse l'ordre des onglets et la position du FAB**
   - Pourquoi : en `dir=rtl`, `left`/`right` hardcodes inversent mal ; le FAB doit etre du cote "fin" logique.
   - Solution : utiliser `start`/`end` logiques (`end-4` pour le FAB) ; l'ordre des onglets reste le meme (la nav est centree, symetrique).

4. **Piege : pull-to-refresh declenche le refresh navigateur natif**
   - Pourquoi : le geste de tirage en haut de page declenche le reload du navigateur en plus du notre.
   - Solution : `overscroll-behavior-y: contain` sur le conteneur scrollable (en plus du `none` global) ; `preventDefault` sur le touchmove uniquement quand on est en haut et qu'on tire vers le bas.

5. **Piege : l'onglet actif n'est pas detecte sur les routes profondes**
   - Pourquoi : `/orders/123` doit surligner l'onglet "Mes orders" ; une comparaison stricte d'egalite echoue.
   - Solution : comparer par prefixe de segment (`pathname.includes('/orders')`) avec une fonction `isActive(tab)` robuste qui gere le prefixe locale.

6. **Piege : le FAB recouvre la bottom nav ou un bouton de page**
   - Pourquoi : FAB `fixed` mal positionne peut chevaucher la nav ou le bouton "Mark complete".
   - Solution : positionner le FAB au-dessus de la nav (`bottom-[calc(5rem+env(safe-area-inset-bottom))]`), `end-4` ; les pages qui ont un bouton bas plein-largeur masquent le FAB.

7. **Piege : double-render layout sur navigation (perte d'etat nav)**
   - Pourquoi : si la bottom nav est re-montee a chaque navigation, son etat (animation, scroll) se perd.
   - Solution : le `(protected)/layout.tsx` est un layout Next.js persistant (ne se re-monte pas entre routes filles) ; la nav y est rendue une fois.

8. **Piege : le badge compteur deborde si > 99**
   - Pourquoi : "100" casse le cercle du badge.
   - Solution : afficher "99+" au-dela de 99.

---

## 3. Architecture context

### Position dans le sprint

Cette tache 5.5.3 est la **3eme tache du Sprint 23**. Elle :

- **Depend de** : Tache 5.5.1 (providers, theme, safe-area, globals) ; Tache 5.5.2 (auth -> segment protege atteint, `useAuth`).
- **Bloque** : les pages metier 5.5.4 (Aujourd'hui), 5.5.5 (detail order), 5.5.7 (diagnostic), 5.5.9 (QC) et toutes les pages du segment `(protected)` qui s'affichent DANS ce layout. Le FAB context-sensitive est configure par chaque page.
- **Apporte au sprint** : le chassis de navigation unique, le `BottomNav`, la `MobileTopbar`, le `QuickActionFab`, le hook `usePullToRefresh`, et le contexte `FabContext` permettant aux pages de declarer leur action principale.

### Position dans le programme global

Premier chassis de navigation bottom-nav + FAB du programme cote garage. Coherent avec la bottom nav assure (Sprint 18) mais enrichi (5 tabs + FAB + pull-to-refresh). Sert de reference pour d'eventuelles futures PWA metier.

### Diagramme de structure

```
  app/[locale]/(protected)/layout.tsx
   +----------------------------------------------------------+
   |  <MobileTopbar />   (fixed top, safe-top)                |
   |    [<- retour]   Titre page        [badge garage]        |
   +----------------------------------------------------------+
   |                                                          |
   |   <main> contenu page (scrollable)                       |
   |     padding-top: topbar height                           |
   |     padding-bottom: nav height + safe-bottom             |
   |     <usePullToRefresh> wrapper                           |
   |                                                          |
   |                                   [FAB] (fixed, end-4,   |
   |                                    bottom au-dessus nav) |
   +----------------------------------------------------------+
   |  <BottomNav />   (fixed bottom, safe-bottom)             |
   |   [Aujourd'hui][Orders][CAMERA][Notifs (3)][Profil]     |
   +----------------------------------------------------------+

   FabContext (provider dans le layout) :
     - les pages appellent useSetFabAction({ icon, label, onPress })
     - QuickActionFab lit le contexte et s'affiche/masque
```

---

## 4. Livrables checkables

- [ ] `repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx` : layout persistant topbar + main + nav + FAB + FabProvider (~130 lignes)
- [ ] `repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx` : 5 onglets, actif surligne, badge notifs, RTL-safe, safe-bottom (~160 lignes)
- [ ] `repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx` : retour contextuel + titre + badge tenant + safe-top (~110 lignes)
- [ ] `repo/apps/web-garage-mobile/components/layout/quick-action-fab.tsx` : FAB lisant FabContext, masquable, positionne au-dessus nav (~100 lignes)
- [ ] `repo/apps/web-garage-mobile/components/layout/fab-context.tsx` : FabProvider + useSetFabAction + useFab (~90 lignes)
- [ ] `repo/apps/web-garage-mobile/hooks/use-pull-to-refresh.ts` : hook geste tirage + seuil + animation (~120 lignes)
- [ ] `repo/apps/web-garage-mobile/components/layout/pull-to-refresh.tsx` : wrapper visuel pull-to-refresh (~90 lignes)
- [ ] `repo/apps/web-garage-mobile/hooks/use-notifications-count.ts` : compteur non lus (polling leger TanStack) (~60 lignes)
- [ ] `repo/apps/web-garage-mobile/lib/nav/nav-config.ts` : config des 5 onglets (id, route, icon, label key) (~60 lignes)
- [ ] `repo/apps/web-garage-mobile/lib/nav/page-titles.ts` : mapping route -> titre i18n + profondeur (~70 lignes)
- [ ] Bottom nav : 5 onglets avec icones lucide-react (Home, ClipboardList, Camera, Bell, User)
- [ ] Onglet camera central proeminent (taille/couleur differente)
- [ ] Badge compteur sur Notifications (99+ si > 99)
- [ ] Topbar : bouton retour visible uniquement si profondeur route > 1
- [ ] Topbar : badge du tenant (garage) courant
- [ ] FAB context-sensitive : icone + action changent par page
- [ ] FAB masque sur Notifications et Profil (pas d'action principale)
- [ ] Pull-to-refresh fonctionnel avec seuil + spinner
- [ ] Safe-area insets respectees (nav bas + topbar haut)
- [ ] RTL : nav + FAB corrects en locale ar
- [ ] Tests composants nav/topbar/fab (8+ scenarios)
- [ ] Tests hook pull-to-refresh (4+ scenarios)
- [ ] Tests E2E navigation mobile (3+ scenarios)
- [ ] `pnpm typecheck` + `pnpm test` passent

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx          (~130 lignes / chassis persistant)
repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx             (~160 lignes / 5 onglets)
repo/apps/web-garage-mobile/components/layout/bottom-nav.spec.tsx        (~150 lignes / 6+ tests)
repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx          (~110 lignes / topbar)
repo/apps/web-garage-mobile/components/layout/mobile-topbar.spec.tsx     (~90 lignes / 4+ tests)
repo/apps/web-garage-mobile/components/layout/quick-action-fab.tsx       (~100 lignes / FAB)
repo/apps/web-garage-mobile/components/layout/fab-context.tsx            (~90 lignes / FabProvider)
repo/apps/web-garage-mobile/components/layout/pull-to-refresh.tsx        (~90 lignes / wrapper visuel)
repo/apps/web-garage-mobile/hooks/use-pull-to-refresh.ts                 (~120 lignes / hook geste)
repo/apps/web-garage-mobile/hooks/use-pull-to-refresh.spec.ts            (~110 lignes / 4+ tests)
repo/apps/web-garage-mobile/hooks/use-notifications-count.ts            (~60 lignes / polling compteur)
repo/apps/web-garage-mobile/lib/nav/nav-config.ts                        (~60 lignes / config onglets)
repo/apps/web-garage-mobile/lib/nav/page-titles.ts                       (~70 lignes / titres routes)
repo/apps/web-garage-mobile/e2e/navigation-mobile.spec.ts                (~120 lignes / 3+ E2E)
```

Total : ~14 fichiers, ~1500 lignes de code de production + tests.

## 6. Code patterns COMPLETS

### Fichier 1/12 : `repo/apps/web-garage-mobile/lib/nav/nav-config.ts`

Configuration declarative des 5 onglets. Source unique de verite.

```typescript
import { Home, ClipboardList, Camera, Bell, User, type LucideIcon } from 'lucide-react';

export interface NavTab {
  id: 'today' | 'orders' | 'camera' | 'notifications' | 'profile';
  route: string; // sans prefixe locale (ajoute au rendu)
  icon: LucideIcon;
  labelKey: string; // cle i18n dans le namespace 'nav'
  prominent?: boolean; // onglet central mis en avant
  matchPrefixes: string[]; // routes qui activent cet onglet
}

export const NAV_TABS: readonly NavTab[] = [
  { id: 'today', route: '/today', icon: Home, labelKey: 'nav.today', matchPrefixes: ['/today'] },
  { id: 'orders', route: '/orders', icon: ClipboardList, labelKey: 'nav.orders', matchPrefixes: ['/orders'] },
  { id: 'camera', route: '/today?action=camera', icon: Camera, labelKey: 'nav.camera', prominent: true, matchPrefixes: ['/camera'] },
  { id: 'notifications', route: '/notifications', icon: Bell, labelKey: 'nav.notifications', matchPrefixes: ['/notifications'] },
  { id: 'profile', route: '/profile', icon: User, labelKey: 'nav.profile', matchPrefixes: ['/profile'] },
];

// Determine si un onglet est actif a partir du pathname (gere le prefixe locale et les routes profondes, piege 5).
export function isTabActive(tab: NavTab, pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/(fr|ar-MA|ar)/, '') || '/';
  return tab.matchPrefixes.some((prefix) => withoutLocale.startsWith(prefix));
}
```

**Notes importantes** :
- Icones lucide-react (SVG), jamais d'emoji (decision-006).
- `matchPrefixes` gere l'activation sur routes profondes (`/orders/123` -> onglet orders, piege 5).
- `prominent` flag pour l'onglet camera central.

### Fichier 2/12 : `repo/apps/web-garage-mobile/lib/nav/page-titles.ts`

Mapping route -> titre i18n + profondeur (pilote l'affichage du bouton retour).

```typescript
export interface PageMeta {
  titleKey: string;
  depth: number; // 1 = racine onglet (pas de retour), > 1 = sous-page (retour visible)
  showFab: boolean;
}

// Pattern de route (sans locale) -> meta. Ordre = du plus specifique au plus general.
const PAGE_META: Array<{ pattern: RegExp; meta: PageMeta }> = [
  { pattern: /^\/today$/, meta: { titleKey: 'nav.today', depth: 1, showFab: true } },
  { pattern: /^\/orders$/, meta: { titleKey: 'nav.orders', depth: 1, showFab: false } },
  { pattern: /^\/orders\/[^/]+$/, meta: { titleKey: 'page.orderDetail', depth: 2, showFab: true } },
  { pattern: /^\/sinistres\/[^/]+\/reception$/, meta: { titleKey: 'page.reception', depth: 2, showFab: true } },
  { pattern: /^\/sinistres\/[^/]+\/diagnostic$/, meta: { titleKey: 'page.diagnostic', depth: 2, showFab: true } },
  { pattern: /^\/sinistres\/[^/]+\/qc$/, meta: { titleKey: 'page.qc', depth: 2, showFab: true } },
  { pattern: /^\/timer$/, meta: { titleKey: 'page.timer', depth: 2, showFab: false } },
  { pattern: /^\/notifications$/, meta: { titleKey: 'nav.notifications', depth: 1, showFab: false } },
  { pattern: /^\/profile$/, meta: { titleKey: 'nav.profile', depth: 1, showFab: false } },
  { pattern: /^\/sync-status$/, meta: { titleKey: 'page.syncStatus', depth: 2, showFab: false } },
];

export function getPageMeta(pathname: string): PageMeta {
  const withoutLocale = pathname.replace(/^\/(fr|ar-MA|ar)/, '') || '/';
  const found = PAGE_META.find((p) => p.pattern.test(withoutLocale));
  return found?.meta ?? { titleKey: 'nav.today', depth: 1, showFab: false };
}
```

**Notes importantes** :
- `depth > 1` -> bouton retour visible (piege 5/6).
- `showFab` indique si le FAB peut s'afficher (les pages le configurent ensuite via FabContext) ; ici c'est la valeur par defaut.

### Fichier 3/12 : `repo/apps/web-garage-mobile/components/layout/fab-context.tsx`

Contexte permettant a chaque page de declarer l'action du FAB.

```typescript
'use client';

import { createContext, useContext, useState, useMemo, useCallback, useEffect, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface FabAction {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}

interface FabContextValue {
  action: FabAction | null;
  setAction: (action: FabAction | null) => void;
}

const FabContext = createContext<FabContextValue | null>(null);

export function FabProvider({ children }: { children: ReactNode }): JSX.Element {
  const [action, setAction] = useState<FabAction | null>(null);
  const value = useMemo(() => ({ action, setAction }), [action]);
  return <FabContext.Provider value={value}>{children}</FabContext.Provider>;
}

export function useFab(): FabContextValue {
  const ctx = useContext(FabContext);
  if (!ctx) throw new Error('useFab doit etre utilise dans FabProvider');
  return ctx;
}

// Hook ergonomique pour les pages : declare l'action du FAB au montage, la retire au demontage.
export function useSetFabAction(action: FabAction | null): void {
  const { setAction } = useFab();
  // serialise la dependance pour eviter les re-set inutiles
  const key = action ? `${action.label}` : 'none';
  const stableOnPress = action?.onPress;
  const stableIcon = action?.icon;
  const stableLabel = action?.label;

  const set = useCallback(() => {
    if (stableOnPress && stableIcon && stableLabel) {
      setAction({ icon: stableIcon, label: stableLabel, onPress: stableOnPress });
    } else {
      setAction(null);
    }
  }, [setAction, stableOnPress, stableIcon, stableLabel]);

  useEffect(() => {
    set();
    return () => setAction(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
```

**Notes importantes** :
- Une page declare son action via `useSetFabAction({ icon, label, onPress })` ; l'action est retiree au demontage (cleanup) -> le FAB se masque automatiquement quand on quitte la page.
- Pattern context decouple : le layout n'a pas besoin de connaitre les pages.

### Fichier 4/12 : `repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx`

Bottom nav 5 onglets, RTL-safe, safe-bottom, badge notifs, onglet camera proeminent.

```typescript
'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { NAV_TABS, isTabActive } from '@/lib/nav/nav-config';
import { useNotificationsCount } from '@/hooks/use-notifications-count';

export function BottomNav(): JSX.Element {
  const pathname = usePathname();
  const locale = useParams().locale as string;
  const t = useTranslations();
  const unreadCount = useNotificationsCount();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex items-stretch justify-around">
        {NAV_TABS.map((tab) => {
          const active = isTabActive(tab, pathname);
          const Icon = tab.icon;
          const label = t(tab.labelKey);
          const showBadge = tab.id === 'notifications' && unreadCount > 0;
          return (
            <li key={tab.id} className="flex-1">
              <Link
                href={`/${locale}${tab.route}`}
                aria-current={active ? 'page' : undefined}
                className={`relative flex min-h-touch flex-col items-center justify-center gap-0.5 py-2 ${
                  active ? 'text-garage-primary' : 'text-slate-500'
                }`}
              >
                <span
                  className={
                    tab.prominent
                      ? 'flex h-12 w-12 items-center justify-center rounded-full bg-garage-primary text-white shadow-md'
                      : ''
                  }
                >
                  <Icon size={tab.prominent ? 26 : 22} aria-hidden="true" />
                </span>
                {!tab.prominent && <span className="text-[11px] font-medium">{label}</span>}
                {showBadge && (
                  <span
                    aria-label={`${unreadCount} notifications non lues`}
                    className="absolute end-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white"
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

**Notes importantes** :
- `paddingBottom: env(safe-area-inset-bottom)` (piege 2).
- `end-[22%]` (logique RTL, piege 3) pour le badge.
- Onglet `prominent` (camera) : pastille ronde rouge surdimensionnee, sans label texte.
- Badge "99+" si > 99 (piege 8). `aria-current="page"` pour l'accessibilite.

### Fichier 5/12 : `repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx`

Topbar compacte : retour contextuel + titre + badge tenant.

```typescript
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { getPageMeta } from '@/lib/nav/page-titles';
import { useAuth } from '@/lib/auth/auth-context';

export function MobileTopbar(): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations();
  const { user } = useAuth();
  const meta = getPageMeta(pathname);
  const showBack = meta.depth > 1;

  return (
    <header
      className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-3"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-14 items-center gap-1">
        {showBack ? (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="flex h-10 w-10 items-center justify-center rounded-full text-garage-navy active:bg-slate-100"
          >
            {/* ChevronLeft pivote en RTL via le dir parent */}
            <ChevronLeft size={24} aria-hidden="true" className="rtl:rotate-180" />
          </button>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="truncate text-base font-semibold text-garage-navy">{t(meta.titleKey)}</h1>
      </div>

      {/* Badge tenant (garage courant) -- multi-tenant */}
      {user?.tenant_id && (
        <span className="max-w-[40%] truncate rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          {user.display_name}
        </span>
      )}
    </header>
  );
}
```

**Notes importantes** :
- `paddingTop: env(safe-area-inset-top)` (notch).
- Bouton retour uniquement si `depth > 1` (piege 5).
- `rtl:rotate-180` sur le chevron pour la coherence RTL (piege 3).
- Badge tenant lu depuis `useAuth` (multi-tenant decision-002).

### Fichier 6/12 : `repo/apps/web-garage-mobile/components/layout/quick-action-fab.tsx`

FAB lisant FabContext + getPageMeta (showFab). Masquable, positionne au-dessus de la nav.

```typescript
'use client';

import { usePathname } from 'next/navigation';
import { useFab } from './fab-context';
import { getPageMeta } from '@/lib/nav/page-titles';

export function QuickActionFab(): JSX.Element | null {
  const pathname = usePathname();
  const { action } = useFab();
  const meta = getPageMeta(pathname);

  // Masque si la page n'autorise pas le FAB OU si aucune action declaree (piege 3 trade-off)
  if (!meta.showFab || !action) return null;

  const Icon = action.icon;
  return (
    <button
      type="button"
      onClick={action.onPress}
      aria-label={action.label}
      className="fixed end-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-garage-primary text-white shadow-lg active:scale-95 transition-transform"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <Icon size={26} aria-hidden="true" />
    </button>
  );
}
```

**Notes importantes** :
- `bottom: calc(5rem + safe)` -> au-dessus de la bottom nav (piege 6).
- `end-4` (RTL-safe, piege 3).
- Masque si `!showFab || !action` (piege 6, trade-off section 2).
- 56px (h-14) cible tactile genereuse.

### Fichier 7/12 : `repo/apps/web-garage-mobile/hooks/use-pull-to-refresh.ts`

Hook geste de tirage-pour-rafraichir, sans dependance externe.

```typescript
'use client';

import { useRef, useState, useCallback, type TouchEvent } from 'react';

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number; // px de tirage pour declencher
  maxPull?: number; // px max d'etirement visuel
}

interface PullState {
  pullDistance: number;
  isRefreshing: boolean;
  handlers: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export function usePullToRefresh({ onRefresh, threshold = 70, maxPull = 120 }: UsePullToRefreshOptions): PullState {
  const startY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const onTouchStart = useCallback((e: TouchEvent) => {
    // On ne demarre le geste que si le scroll est tout en haut (piege 4)
    const scrollTop = (e.currentTarget as HTMLElement).scrollTop;
    if (scrollTop <= 0) {
      startY.current = e.touches[0]?.clientY ?? null;
    } else {
      startY.current = null;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: TouchEvent) => {
      if (startY.current === null || isRefreshing) return;
      const currentY = e.touches[0]?.clientY ?? 0;
      const delta = currentY - startY.current;
      if (delta > 0) {
        // Resistance : la distance visuelle est amortie
        const damped = Math.min(delta * 0.5, maxPull);
        setPullDistance(damped);
      }
    },
    [isRefreshing, maxPull],
  );

  const onTouchEnd = useCallback(() => {
    if (startY.current === null) return;
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      void onRefresh().finally(() => {
        setIsRefreshing(false);
        setPullDistance(0);
      });
    } else {
      setPullDistance(0);
    }
    startY.current = null;
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  return { pullDistance, isRefreshing, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
```

**Notes importantes** :
- Le geste ne demarre QUE si `scrollTop <= 0` (piege 4) -> pas de conflit avec le scroll normal.
- Resistance (delta * 0.5) pour un ressenti naturel.
- `onRefresh` asynchrone, le spinner reste jusqu'a resolution.

### Fichier 8/12 : `repo/apps/web-garage-mobile/components/layout/pull-to-refresh.tsx`

Wrapper visuel branchant le hook.

```typescript
'use client';

import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/use-pull-to-refresh';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps): JSX.Element {
  const { pullDistance, isRefreshing, handlers } = usePullToRefresh({ onRefresh });

  return (
    <div
      className="h-full overflow-y-auto overscroll-contain"
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
    >
      {/* Indicateur de tirage */}
      <div
        className="flex items-center justify-center overflow-hidden transition-[height]"
        style={{ height: pullDistance }}
        aria-hidden={pullDistance === 0}
      >
        <Loader2
          size={24}
          className={`text-garage-primary ${isRefreshing ? 'animate-spin' : ''}`}
          style={{ opacity: Math.min(pullDistance / 70, 1) }}
        />
      </div>
      {children}
    </div>
  );
}
```

**Notes importantes** :
- `overscroll-contain` (piege 4) empeche le pull navigateur natif.
- L'opacite du spinner suit la distance de tirage (feedback progressif).

### Fichier 9/12 : `repo/apps/web-garage-mobile/hooks/use-notifications-count.ts`

Compteur de notifications non lues via polling leger (TanStack Query).

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { useAuth } from '@/lib/auth/auth-context';

// Polling leger toutes les 30s (trade-off section 2 : pas de websocket).
export function useNotificationsCount(): number {
  const { isAuthenticated } = useAuth();
  const { data } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    enabled: isAuthenticated,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const res = await apiGet<{ unread: number }>(getApiClient(), '/api/v1/notifications/unread-count');
      return res.unread;
    },
  });
  return data ?? 0;
}
```

### Fichier 10/12 : `repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx`

Le chassis persistant : topbar + main + nav + FAB + FabProvider.

```typescript
import { type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { FabProvider } from '@/components/layout/fab-context';
import { MobileTopbar } from '@/components/layout/mobile-topbar';
import { BottomNav } from '@/components/layout/bottom-nav';
import { QuickActionFab } from '@/components/layout/quick-action-fab';

interface ProtectedLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function ProtectedLayout({ children, params }: ProtectedLayoutProps): Promise<JSX.Element> {
  const { locale } = await params;
  // Garde serveur : pas de session -> login (le middleware le fait deja, defense en profondeur)
  const cookieStore = await cookies();
  if (!cookieStore.has('garage_refresh_token')) {
    redirect(`/${locale}/login`);
  }

  return (
    <FabProvider>
      <MobileTopbar />
      {/* main scrolle entre topbar et nav ; padding pour ne pas etre masque (piege 1) */}
      <main
        className="min-h-dvh"
        style={{
          paddingTop: 'calc(3.5rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))',
        }}
      >
        {children}
      </main>
      <QuickActionFab />
      <BottomNav />
    </FabProvider>
  );
}
```

**Notes importantes** :
- Layout persistant Next.js : ne se re-monte pas entre routes filles (piege 7) -> la nav garde son etat.
- `paddingTop`/`paddingBottom` evitent que le contenu passe sous topbar/nav (piege 1).
- Garde serveur en defense en profondeur (le middleware Tache 5.5.1 protege deja).

### Fichier 11/12 : exemple de configuration FAB par une page (illustratif, sera dans Tache 5.5.5)

Montre comment une page declare son action FAB -- a titre de reference pour les pages metier.

```typescript
'use client';

import { Camera } from 'lucide-react';
import { useSetFabAction } from '@/components/layout/fab-context';

// Exemple : la page detail order declare "prendre une photo" comme action FAB.
export function useOrderDetailFab(orderId: string, openCamera: (orderId: string) => void): void {
  useSetFabAction({
    icon: Camera,
    label: 'Prendre une photo',
    onPress: () => openCamera(orderId),
  });
}
```

**Notes importantes** : pattern de reference. Chaque page metier (5.5.4, 5.5.5, etc.) appelle `useSetFabAction` avec son action contextuelle. Le FAB se masque automatiquement au demontage de la page.

### Fichier 12/12 : `repo/apps/web-garage-mobile/components/layout/bottom-nav.spec.tsx` (extrait composant teste)

Voir section 7 pour les tests complets. Le composant est concu pour etre testable : `aria-current`, `aria-label` sur le badge, roles ARIA.

```typescript
// Le composant BottomNav expose des attributs ARIA testables :
// - <nav aria-label="Navigation principale">
// - <Link aria-current="page"> sur l'onglet actif
// - <span aria-label="N notifications non lues"> sur le badge
// Ces attributs permettent les assertions Testing Library sans data-testid.
```

### Fichiers complementaires (annexe section 6)

Le chassis a besoin de pages cibles minimales pour que les 5 onglets ne renvoient pas 404. Les pages riches (Aujourd'hui 5.5.4, etc.) viennent plus tard ; ici on cree les pages de base des onglets Notifications, Profil et Camera, plus les cles i18n.

#### `repo/apps/web-garage-mobile/app/[locale]/(protected)/notifications/page.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

// Page Notifications minimale (la liste riche + push viennent Tache 5.5.11).
// Au montage, invalide le compteur non-lus pour rafraichir le badge (edge case 6).
export default function NotificationsPage(): JSX.Element {
  const t = useTranslations('nav');
  const queryClient = useQueryClient();

  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
  }, [queryClient]);

  return (
    <section className="px-4 py-2">
      <p className="py-12 text-center text-sm text-slate-400">{t('notifications')}</p>
    </section>
  );
}
```

#### `repo/apps/web-garage-mobile/app/[locale]/(protected)/profile/page.tsx`

```typescript
'use client';

import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { clearDeviceSession } from '@/lib/auth/device';

// Page Profil : info user + logout. Pas de FAB (showFab=false).
export default function ProfilePage(): JSX.Element {
  const t = useTranslations();
  const router = useRouter();
  const locale = useParams().locale as string;
  const { user, clearSession } = useAuth();

  function handleLogout(): void {
    clearSession();
    clearDeviceSession();
    router.push(`/${locale}/login`);
  }

  return (
    <section className="flex flex-col gap-6 px-4 py-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-lg font-semibold text-garage-navy">{user?.display_name ?? '--'}</p>
        <p className="text-sm text-slate-500">{user?.email ?? ''}</p>
        <p className="mt-2 text-xs text-slate-400">
          {t('profile.roles')}: {user?.roles.join(', ') ?? '--'}
        </p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className="flex min-h-touch items-center justify-center gap-2 rounded-xl border border-red-200 px-6 py-3 font-semibold text-red-600 active:bg-red-50"
      >
        <LogOut size={20} aria-hidden="true" />
        {t('profile.logout')}
      </button>
    </section>
  );
}
```

#### `repo/apps/web-garage-mobile/lib/auth/device.ts` (extension : clearDeviceSession)

```typescript
// Ajout a device.ts (Tache 5.5.2) : nettoyage complet a la deconnexion.
export function clearDeviceSession(): void {
  document.cookie = 'garage_device_id=; max-age=0; path=/';
  document.cookie = 'garage_refresh_token=; max-age=0; path=/';
  try {
    window.sessionStorage.removeItem('garage_device_identity');
  } catch {
    // ignore
  }
}
```

#### `repo/apps/web-garage-mobile/i18n/messages/fr.json` (cles ajoutees pour la nav)

```json
{
  "nav": {
    "today": "Aujourd'hui",
    "orders": "Mes orders",
    "camera": "Camera",
    "notifications": "Notifications",
    "profile": "Profil"
  },
  "page": {
    "orderDetail": "Detail order",
    "reception": "Reception",
    "diagnostic": "Diagnostic",
    "qc": "Controle qualite",
    "timer": "Mon timer",
    "syncStatus": "Synchronisation"
  },
  "common": {
    "back": "Retour",
    "loading": "Chargement..."
  },
  "profile": {
    "roles": "Roles",
    "logout": "Se deconnecter"
  }
}
```

#### `repo/apps/web-garage-mobile/i18n/messages/ar-MA.json` (darija, extrait nav -- RTL)

```json
{
  "nav": {
    "today": "اليوم",
    "orders": "الطلبات ديالي",
    "camera": "الكاميرا",
    "notifications": "الإشعارات",
    "profile": "البروفايل"
  },
  "common": {
    "back": "رجوع",
    "loading": "كيتسناو..."
  }
}
```

**Notes importantes** : les libelles arabes declenchent la mise en page RTL (le `dir` est pose par le LocaleLayout 5.5.1). Verifier visuellement que la nav reste centree et que le badge passe du bon cote.

#### `repo/apps/web-garage-mobile/hooks/use-online-status.ts`

Hook d'etat reseau ecoutant les CustomEvent emis par le SW (Tache 5.5.1) + `navigator.onLine`.

```typescript
'use client';

import { useEffect, useState } from 'react';

// Etat reseau global. Combine navigator.onLine et les events sw:online/sw:offline
// emis par registerServiceWorker (Tache 5.5.1). Source de verite pour la banniere offline.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = (): void => setOnline(true);
    const goOffline = (): void => setOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    // Events custom emis par le SW (5.5.1)
    window.addEventListener('app:online', goOnline);
    window.addEventListener('app:offline', goOffline);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('app:online', goOnline);
      window.removeEventListener('app:offline', goOffline);
    };
  }, []);

  return online;
}
```

#### `repo/apps/web-garage-mobile/components/layout/offline-banner.tsx`

Banniere globale affichee sous la topbar quand l'app est hors ligne.

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { CloudOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/use-online-status';

// Banniere offline non-bloquante : informe le technicien que ses actions
// seront synchronisees au retour reseau (background sync Tache 5.5.10).
export function OfflineBanner(): JSX.Element | null {
  const online = useOnlineStatus();
  const t = useTranslations('common');

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 bg-amber-500 px-3 py-1.5 text-xs font-medium text-white"
    >
      <CloudOff size={14} aria-hidden="true" />
      {t('offlineBanner')}
    </div>
  );
}
```

**Notes importantes** :
- `aria-live="polite"` : annonce le changement d'etat aux lecteurs d'ecran sans interrompre.
- Le message rassure (les donnees seront synchronisees, background sync Tache 5.5.10).
- La banniere s'insere dans la topbar (sous le titre) ou juste sous elle dans le layout. Couleur amber (avertissement non-bloquant), pas rouge (pas une erreur).
- Cle i18n `common.offlineBanner` : "Hors ligne -- vos actions seront synchronisees au retour du reseau".

#### Integration de la banniere dans le layout

Le layout `(protected)/layout.tsx` insere `<OfflineBanner />` juste apres `<MobileTopbar />` :

```typescript
// Extrait modifie du layout (Fichier 10/12) :
//   <MobileTopbar />
//   <OfflineBanner />          <-- ajoute ici
//   <main ...>{children}</main>
// Le padding-top du main est ajuste si la banniere est visible (la banniere
// pousse le contenu vers le bas naturellement car elle n'est pas fixed).
```

### Specification visuelle et d'animation (reference d'implementation)

Pour garantir un rendu coherent et fluide, le chassis respecte ces specifications precises :

- **Bottom nav** : hauteur 64px (4rem) + safe-area. Fond blanc, bordure haute 1px slate-200. Onglet actif : couleur `garage-primary` (#B91C1C) ; inactif : slate-500. Transition de couleur 150ms.
- **Onglet camera (proeminent)** : pastille ronde 48px (h-12) en `garage-primary`, icone blanche 26px, ombre `shadow-md`, legerement remontee (overlap negatif optionnel -8px). Pas de label texte.
- **Badge notifs** : cercle rouge 16px min, texte 10px bold blanc, positionne `top-1 end-[22%]`. "99+" au-dela de 99.
- **Topbar** : hauteur 56px (h-14) + safe-area-top. Titre 16px semibold tronque. Bouton retour 40px tactile. Badge tenant : pilule slate-100, texte 12px, max 40% largeur, tronque.
- **FAB** : 56px (h-14), `garage-primary`, ombre `shadow-lg`, `bottom: calc(5rem + safe)`, `end-4`. Au tap : `active:scale-95` (feedback 100ms).
- **Pull-to-refresh** : seuil 70px, etirement max 120px amorti a 0.5x. Spinner `Loader2` 24px, opacite progressive, `animate-spin` pendant le refresh.
- **Transitions de page** : aucune transition custom (Next.js App Router gere la navigation ; on evite les animations couteuses sur connexion atelier lente).

Toutes les dimensions tactiles respectent WCAG 2.5.5 (>= 44px). Les couleurs respectent un contraste AA (texte garage-navy sur blanc, blanc sur garage-primary).

## 7. Tests complets

### 7.1 Tests BottomNav : `repo/apps/web-garage-mobile/components/layout/bottom-nav.spec.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomNav } from './bottom-nav';

const mockPathname = vi.fn(() => '/fr/today');
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useParams: () => ({ locale: 'fr' }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
const mockCount = vi.fn(() => 0);
vi.mock('@/hooks/use-notifications-count', () => ({ useNotificationsCount: () => mockCount() }));

describe('BottomNav', () => {
  beforeEach(() => {
    mockPathname.mockReturnValue('/fr/today');
    mockCount.mockReturnValue(0);
  });

  it('rend les 5 onglets', () => {
    render(<BottomNav />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(5);
  });

  it('marque l onglet today actif sur /today', () => {
    render(<BottomNav />);
    const active = screen.getAllByRole('link').find((l) => l.getAttribute('aria-current') === 'page');
    expect(active?.getAttribute('href')).toBe('/fr/today');
  });

  it('active l onglet orders sur une route profonde /orders/123', () => {
    mockPathname.mockReturnValue('/fr/orders/123');
    render(<BottomNav />);
    const active = screen.getAllByRole('link').find((l) => l.getAttribute('aria-current') === 'page');
    expect(active?.getAttribute('href')).toContain('/orders');
  });

  it('affiche le badge si notifications non lues', () => {
    mockCount.mockReturnValue(3);
    render(<BottomNav />);
    expect(screen.getByLabelText('3 notifications non lues')).toBeInTheDocument();
  });

  it('affiche 99+ au-dela de 99 notifications', () => {
    mockCount.mockReturnValue(150);
    render(<BottomNav />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('ne montre pas de badge si 0 non lu', () => {
    mockCount.mockReturnValue(0);
    render(<BottomNav />);
    expect(screen.queryByText(/non lues/)).not.toBeInTheDocument();
  });
});
```

### 7.2 Tests MobileTopbar : `repo/apps/web-garage-mobile/components/layout/mobile-topbar.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileTopbar } from './mobile-topbar';

const mockPathname = vi.fn(() => '/fr/today');
const mockBack = vi.fn();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({ back: mockBack }),
}));
vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({ user: { tenant_id: 't1', display_name: 'Atlas Garage Marrakech' } }),
}));

describe('MobileTopbar', () => {
  it('ne montre pas de bouton retour sur une page racine (depth 1)', () => {
    mockPathname.mockReturnValue('/fr/today');
    render(<MobileTopbar />);
    expect(screen.queryByLabelText('common.back')).not.toBeInTheDocument();
  });

  it('montre le bouton retour sur une sous-page (depth 2)', () => {
    mockPathname.mockReturnValue('/fr/orders/123');
    render(<MobileTopbar />);
    expect(screen.getByLabelText('common.back')).toBeInTheDocument();
  });

  it('affiche le badge du tenant courant', () => {
    mockPathname.mockReturnValue('/fr/today');
    render(<MobileTopbar />);
    expect(screen.getByText('Atlas Garage Marrakech')).toBeInTheDocument();
  });

  it('affiche le titre de la page', () => {
    mockPathname.mockReturnValue('/fr/orders/123');
    render(<MobileTopbar />);
    expect(screen.getByRole('heading')).toHaveTextContent('page.orderDetail');
  });
});
```

### 7.3 Tests hook pull-to-refresh : `repo/apps/web-garage-mobile/hooks/use-pull-to-refresh.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePullToRefresh } from './use-pull-to-refresh';

function touchEvent(clientY: number, scrollTop = 0): any {
  return {
    touches: [{ clientY }],
    currentTarget: { scrollTop },
  };
}

describe('usePullToRefresh', () => {
  it('ne demarre pas si pas tout en haut', () => {
    const onRefresh = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
    act(() => result.current.handlers.onTouchStart(touchEvent(100, 50)));
    act(() => result.current.handlers.onTouchMove(touchEvent(200, 50)));
    expect(result.current.pullDistance).toBe(0);
  });

  it('augmente pullDistance en tirant vers le bas depuis le haut', () => {
    const onRefresh = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh }));
    act(() => result.current.handlers.onTouchStart(touchEvent(100, 0)));
    act(() => result.current.handlers.onTouchMove(touchEvent(200, 0)));
    expect(result.current.pullDistance).toBeGreaterThan(0);
  });

  it('declenche onRefresh si seuil depasse', async () => {
    const onRefresh = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 30 }));
    act(() => result.current.handlers.onTouchStart(touchEvent(0, 0)));
    act(() => result.current.handlers.onTouchMove(touchEvent(200, 0)));
    await act(async () => result.current.handlers.onTouchEnd());
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('ne declenche pas si seuil non atteint', async () => {
    const onRefresh = vi.fn(async () => undefined);
    const { result } = renderHook(() => usePullToRefresh({ onRefresh, threshold: 200 }));
    act(() => result.current.handlers.onTouchStart(touchEvent(0, 0)));
    act(() => result.current.handlers.onTouchMove(touchEvent(20, 0)));
    await act(async () => result.current.handlers.onTouchEnd());
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
```

### 7.4 Tests FabContext : `repo/apps/web-garage-mobile/components/layout/fab-context.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Camera } from 'lucide-react';
import { FabProvider, useSetFabAction, useFab } from './fab-context';

function Consumer() {
  const { action } = useFab();
  return <span>{action ? action.label : 'no-action'}</span>;
}
function Page() {
  useSetFabAction({ icon: Camera, label: 'photo', onPress: vi.fn() });
  return <Consumer />;
}

describe('FabContext', () => {
  it('expose l action declaree par une page', () => {
    render(
      <FabProvider>
        <Page />
      </FabProvider>,
    );
    expect(screen.getByText('photo')).toBeInTheDocument();
  });

  it('throw si useFab hors provider', () => {
    const Bad = () => {
      useFab();
      return null;
    };
    expect(() => render(<Bad />)).toThrow(/FabProvider/);
  });
});
```

### 7.5 Tests E2E navigation : `repo/apps/web-garage-mobile/e2e/navigation-mobile.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone SE'] });

test.describe('Navigation mobile (chassis)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
  });

  test('la bottom nav affiche 5 onglets', async ({ page }) => {
    await page.goto('/fr/today');
    const nav = page.getByRole('navigation', { name: /navigation principale/i });
    await expect(nav.getByRole('link')).toHaveCount(5);
  });

  test('naviguer vers Mes orders met a jour l onglet actif', async ({ page }) => {
    await page.goto('/fr/today');
    await page.getByRole('link', { name: /orders/i }).first().click();
    await page.waitForURL('**/orders');
    const active = page.locator('[aria-current="page"]');
    await expect(active).toHaveAttribute('href', /\/orders/);
  });

  test('le bouton retour apparait sur une sous-page', async ({ page }) => {
    await page.goto('/fr/orders/123');
    await expect(page.getByLabel(/retour|back/i)).toBeVisible();
  });

  test('le profil permet la deconnexion vers login', async ({ page }) => {
    await page.goto('/fr/profile');
    await page.getByRole('button', { name: /deconnecter|logout/i }).click();
    await page.waitForURL('**/login');
  });

  test('en locale arabe la mise en page est RTL', async ({ page }) => {
    await page.goto('/ar/today');
    const dir = await page.locator('[dir]').first().getAttribute('dir');
    expect(dir).toBe('rtl');
  });
});
```

### 7.6 Tests online status / offline banner : `repo/apps/web-garage-mobile/components/layout/offline-banner.spec.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineBanner } from './offline-banner';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('OfflineBanner / useOnlineStatus', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
  });

  it('ne rend rien quand online', () => {
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche la banniere quand l app passe offline', () => {
    render(<OfflineBanner />);
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
      window.dispatchEvent(new Event('app:offline'));
    });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('masque la banniere au retour online', () => {
    render(<OfflineBanner />);
    act(() => window.dispatchEvent(new Event('app:offline')));
    act(() => window.dispatchEvent(new Event('app:online')));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
```

### 7.7 Couverture cible

- Lignes : >= 85% global.
- Total tests cette tache : 24 (6 nav + 4 topbar + 4 pull-to-refresh + 2 fab-context + 3 offline-banner + 5 E2E).

## 6bis. Code patterns complementaires

### Fichier 13/20 : `repo/apps/web-garage-mobile/hooks/use-safe-area.ts`

Hook exposant les valeurs de safe-area pour les composants qui en ont besoin programmatiquement.

```typescript
'use client';

import { useEffect, useState } from 'react';

export interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

// Lit les env(safe-area-inset-*) via une sonde CSS (piege : non lisibles directement en JS).
export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({ top: 0, bottom: 0, left: 0, right: 0 });

  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);right:env(safe-area-inset-right);';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    setInsets({
      top: parseInt(cs.top || '0', 10) || 0,
      bottom: parseInt(cs.bottom || '0', 10) || 0,
      left: parseInt(cs.left || '0', 10) || 0,
      right: parseInt(cs.right || '0', 10) || 0,
    });
    document.body.removeChild(probe);
  }, []);

  return insets;
}
```

**Notes importantes** : utile pour calculer dynamiquement des offsets (ex : positionnement d'un toast au-dessus de la nav). Lit les insets via une sonde DOM (les `env()` ne sont pas accessibles directement en JS).

### Fichier 14/20 : `repo/apps/web-garage-mobile/components/layout/nav-badge.tsx`

Badge reutilisable (extrait de la bottom nav pour testabilite et reutilisation).

```typescript
'use client';

interface NavBadgeProps {
  count: number;
  label: string; // libelle accessible deja localise
  max?: number;
}

// Badge compteur reutilisable (bottom nav notifs, futurs usages). "99+" au-dela de max (piege 8).
export function NavBadge({ count, label, max = 99 }: NavBadgeProps): JSX.Element | null {
  if (count <= 0) return null;
  return (
    <span
      role="status"
      aria-label={label}
      className="absolute end-[22%] top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white"
    >
      {count > max ? `${max}+` : count}
    </span>
  );
}
```

### Fichier 15/20 : `repo/apps/web-garage-mobile/hooks/use-active-tab.ts`

Hook derivant l'onglet actif (extrait pour testabilite et reutilisation par d'autres composants : topbar, analytics).

```typescript
'use client';

import { usePathname } from 'next/navigation';
import { NAV_TABS, isTabActive, type NavTab } from '@/lib/nav/nav-config';

// Retourne l'onglet actif courant (ou null si aucune correspondance).
export function useActiveTab(): NavTab | null {
  const pathname = usePathname();
  return NAV_TABS.find((tab) => isTabActive(tab, pathname)) ?? null;
}
```

### Fichier 16/20 : `repo/apps/web-garage-mobile/components/layout/chassis-skeleton.tsx`

Squelette de chargement du chassis (affiche pendant l'hydratation/auth, evite le flash).

```typescript
'use client';

// Skeleton affiche tant que l'auth/donnees ne sont pas pretes (evite le flash de layout vide).
export function ChassisSkeleton(): JSX.Element {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Chargement de l'interface">
      {/* Topbar skeleton */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
      </div>
      {/* Contenu skeleton */}
      <main className="px-4" style={{ paddingTop: 'calc(3.5rem + env(safe-area-inset-top))', paddingBottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mt-3 h-20 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </main>
      {/* Nav skeleton */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around border-t border-slate-200 bg-white" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
```

### Fichier 17/20 : `repo/apps/web-garage-mobile/i18n/messages/ar.json` (arabe classique, extrait chassis -- RTL)

```json
{
  "nav": {
    "today": "اليوم",
    "orders": "طلباتي",
    "camera": "الكاميرا",
    "notifications": "الإشعارات",
    "profile": "الملف الشخصي"
  },
  "common": {
    "back": "رجوع",
    "next": "التالي",
    "previous": "السابق",
    "loading": "جار التحميل...",
    "offline": "أنت غير متصل",
    "offlineBanner": "غير متصل -- ستتم مزامنة إجراءاتك عند عودة الشبكة"
  },
  "profile": {
    "roles": "الأدوار",
    "logout": "تسجيل الخروج"
  }
}
```

**Notes importantes** : l'arabe classique (`ar`) declenche le RTL au meme titre que la darija (`ar-MA`). Les trois fichiers de messages (`fr`, `ar-MA`, `ar`) doivent couvrir au minimum les cles `nav.*`, `common.*`, `profile.*` pour que le chassis soit entierement traduit.

### Fichier 18/20 : `repo/apps/web-garage-mobile/components/layout/install-prompt.tsx`

Invite a installer la PWA (A2HS), affichee de maniere non intrusive dans le chassis.

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Capture l'evenement beforeinstallprompt (Android/Chrome) et propose l'installation.
export function InstallPrompt(): JSX.Element | null {
  const t = useTranslations('common');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event): void => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-garage-primary/30 bg-garage-primary/5 p-3">
      <span className="flex items-center gap-2 text-sm text-garage-navy">
        <Download size={18} aria-hidden="true" />
        {t('installPrompt')}
      </span>
      <span className="flex items-center gap-2">
        <button type="button" onClick={() => { void deferred.prompt(); setDismissed(true); }} className="rounded-lg bg-garage-primary px-3 py-1.5 text-sm font-semibold text-white">
          {t('install')}
        </button>
        <button type="button" onClick={() => setDismissed(true)} aria-label={t('dismiss')} className="text-slate-400">
          <X size={16} aria-hidden="true" />
        </button>
      </span>
    </div>
  );
}
```

**Notes importantes** : sur iOS (pas de `beforeinstallprompt`), l'installation se fait via "Ajouter a l'ecran d'accueil" du menu Safari ; un message d'aide iOS specifique peut etre ajoute (hors scope minimal). Le composant retourne null si l'invite n'est pas disponible.

### Fichier 19/20 : `repo/apps/web-garage-mobile/components/layout/update-prompt.tsx`

Invite a recharger quand une nouvelle version du SW est disponible (ecoute l'event `sw:update-available` de 5.5.1).

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RefreshCw } from 'lucide-react';

// Affiche une banniere "nouvelle version" quand le SW signale une mise a jour (event de 5.5.1).
export function UpdatePrompt(): JSX.Element | null {
  const t = useTranslations('common');
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const handler = (): void => setAvailable(true);
    window.addEventListener('sw:update-available', handler);
    return () => window.removeEventListener('sw:update-available', handler);
  }, []);

  if (!available) return null;

  return (
    <div className="fixed inset-x-4 z-50 flex items-center justify-between rounded-xl bg-garage-navy p-3 text-white shadow-lg" style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }} role="status">
      <span className="flex items-center gap-2 text-sm">
        <RefreshCw size={16} aria-hidden="true" />
        {t('updateAvailable')}
      </span>
      <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-garage-navy">
        {t('reload')}
      </button>
    </div>
  );
}
```

### Fichier 20/20 : integration des prompts dans le layout

```typescript
// repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx (extrait enrichi)
// Le layout integre desormais les prompts non intrusifs :
//   <FabProvider>
//     <MobileTopbar />
//     <OfflineBanner />
//     <main ...>
//       <InstallPrompt />   {/* invite A2HS Android */}
//       {children}
//     </main>
//     <UpdatePrompt />       {/* nouvelle version SW */}
//     <QuickActionFab />
//     <BottomNav />
//   </FabProvider>
```

**Notes importantes** : les trois prompts (offline, install, update) sont non intrusifs (rendus conditionnellement, masquables) et n'interferent pas avec la navigation. Ils sont positionnes pour ne jamais recouvrir la bottom nav (offsets safe-area).

## 7bis. Tests complementaires

### 7.8 Tests NavBadge : `repo/apps/web-garage-mobile/components/layout/nav-badge.spec.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavBadge } from './nav-badge';

describe('NavBadge', () => {
  it('ne rend rien si count <= 0', () => {
    const { container } = render(<NavBadge count={0} label="0 non lu" />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche le compteur', () => {
    render(<NavBadge count={5} label="5 non lus" />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('affiche 99+ au-dela du max', () => {
    render(<NavBadge count={150} label="150 non lus" />);
    expect(screen.getByText('99+')).toBeInTheDocument();
  });

  it('expose un role status et un aria-label', () => {
    render(<NavBadge count={3} label="3 non lus" />);
    const badge = screen.getByRole('status');
    expect(badge).toHaveAttribute('aria-label', '3 non lus');
  });

  it('respecte un max personnalise', () => {
    render(<NavBadge count={15} label="x" max={9} />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });
});
```

### 7.9 Tests useActiveTab : `repo/apps/web-garage-mobile/hooks/use-active-tab.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useActiveTab } from './use-active-tab';

const mockPathname = vi.fn();
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname() }));

describe('useActiveTab', () => {
  it('retourne today sur /fr/today', () => {
    mockPathname.mockReturnValue('/fr/today');
    const { result } = renderHook(() => useActiveTab());
    expect(result.current?.id).toBe('today');
  });

  it('retourne orders sur une route profonde /fr/orders/123', () => {
    mockPathname.mockReturnValue('/fr/orders/123');
    const { result } = renderHook(() => useActiveTab());
    expect(result.current?.id).toBe('orders');
  });

  it('retourne null sur une route inconnue', () => {
    mockPathname.mockReturnValue('/fr/unknown');
    const { result } = renderHook(() => useActiveTab());
    expect(result.current).toBeNull();
  });

  it('gere la locale arabe', () => {
    mockPathname.mockReturnValue('/ar/today');
    const { result } = renderHook(() => useActiveTab());
    expect(result.current?.id).toBe('today');
  });
});
```

### 7.10 Tests update/install prompts : `repo/apps/web-garage-mobile/components/layout/update-prompt.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { UpdatePrompt } from './update-prompt';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('UpdatePrompt', () => {
  it('ne rend rien sans event de mise a jour', () => {
    const { container } = render(<UpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('affiche la banniere a l event sw:update-available', () => {
    render(<UpdatePrompt />);
    act(() => window.dispatchEvent(new Event('sw:update-available')));
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('reload')).toBeInTheDocument();
  });
});
```

### 7.11 Tests E2E multi-viewports complementaires : `repo/apps/web-garage-mobile/e2e/chassis-viewports.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

// Verifie le chassis sur les petits ET grands ecrans (couverture viewports)
for (const device of ['iPhone SE', 'Pixel 7'] as const) {
  test.describe(`Chassis sur ${device}`, () => {
    test.use({ ...devices[device] });
    test.beforeEach(async ({ context }) => {
      await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
    });

    test('la bottom nav reste accessible (pas masquee)', async ({ page }) => {
      await page.goto('/fr/today');
      const nav = page.getByRole('navigation', { name: /navigation principale/i });
      await expect(nav).toBeVisible();
      const box = await nav.boundingBox();
      const viewport = page.viewportSize();
      // La nav est bien en bas de l'ecran
      if (box && viewport) expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 2);
    });

    test('le contenu ne passe pas sous la nav', async ({ page }) => {
      await page.goto('/fr/today');
      const main = page.locator('main');
      const pb = await main.evaluate((el) => getComputedStyle(el).paddingBottom);
      expect(parseInt(pb, 10)).toBeGreaterThanOrEqual(40);
    });
  });
}
```

## 8. Variables environnement

Cette tache n'introduit pas de nouvelle variable d'environnement. Elle consomme :

```env
# Deja definies (Tache 5.5.1)
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_DEFAULT_LOCALE=fr
```

L'endpoint `/api/v1/notifications/unread-count` est consomme par `useNotificationsCount` (le backend notifications complet vient en Tache 5.5.11 ; ici un stub retournant `{ unread: 0 }` suffit si l'endpoint n'existe pas encore -- le hook degrade a 0).

## 9. Commandes shell

```bash
cd repo

# 1. Installer lucide-react si absent (icones nav)
pnpm --filter @insurtech/web-garage-mobile add lucide-react

# 2. Typecheck
pnpm --filter @insurtech/web-garage-mobile typecheck

# 3. Lint
pnpm --filter @insurtech/web-garage-mobile lint

# 4. Tests composants + hooks
pnpm --filter @insurtech/web-garage-mobile test -- bottom-nav.spec.tsx mobile-topbar.spec.tsx use-pull-to-refresh.spec.ts fab-context.spec.tsx

# 5. E2E navigation
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile test:e2e -- navigation-mobile.spec.ts

# 6. Verifier RTL : pas de left/right hardcode dans les composants nav
grep -rn "\(ml-\|mr-\|left-\|right-\)" repo/apps/web-garage-mobile/components/layout/ && echo "WARN : verifier RTL (start/end)" || echo "OK logique RTL"
```

## 10. Criteres validation

### Criteres P0 (bloquants -- 15)

- **V1 (P0)** : La bottom nav rend exactement 5 onglets.
  - Commande : `pnpm --filter @insurtech/web-garage-mobile test -- bottom-nav.spec.tsx`
  - Expected : test "rend les 5 onglets" PASS.

- **V2 (P0)** : L'onglet actif est correctement detecte (aria-current).
  - Commande : test "marque l onglet today actif" PASS.

- **V3 (P0)** : Les routes profondes activent le bon onglet (piege 5).
  - Commande : test "active l onglet orders sur /orders/123" PASS.

- **V4 (P0)** : Le badge notifications s'affiche si > 0 et "99+" au-dela de 99.
  - Commande : tests "affiche le badge" + "affiche 99+" PASS.

- **V5 (P0)** : Le bouton retour apparait uniquement si depth > 1.
  - Commande : `pnpm test -- mobile-topbar.spec.tsx`
  - Expected : tests retour (depth 1 absent / depth 2 present) PASS.

- **V6 (P0)** : La topbar affiche le badge du tenant courant.
  - Commande : test "affiche le badge du tenant" PASS.

- **V7 (P0)** : Le FAB se masque si la page ne l'autorise pas (showFab) ou sans action.
  - Commande : revue + test fab-context "expose l action" / masquage.
  - Expected : QuickActionFab retourne null si `!showFab || !action`.

- **V8 (P0)** : Le FAB est positionne au-dessus de la nav (piege 6).
  - Commande : `grep -n "5rem + env(safe-area-inset-bottom)" repo/apps/web-garage-mobile/components/layout/quick-action-fab.tsx`
  - Expected : 1 occurrence.

- **V9 (P0)** : La bottom nav respecte la safe-area bottom (piege 2).
  - Commande : `grep -n "safe-area-inset-bottom" repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx`
  - Expected : >= 1.

- **V10 (P0)** : La topbar respecte la safe-area top.
  - Commande : `grep -n "safe-area-inset-top" repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx`
  - Expected : >= 1.

- **V11 (P0)** : Le contenu principal a un padding evitant le masquage (piege 1).
  - Commande : `grep -n "paddingBottom\|paddingTop" repo/apps/web-garage-mobile/app/[locale]/(protected)/layout.tsx`
  - Expected : 2 occurrences.

- **V12 (P0)** : Le pull-to-refresh ne demarre que tout en haut (piege 4).
  - Commande : `pnpm test -- use-pull-to-refresh.spec.ts`
  - Expected : test "ne demarre pas si pas tout en haut" PASS.

- **V13 (P0)** : Le pull-to-refresh declenche onRefresh au-dela du seuil.
  - Commande : test "declenche onRefresh si seuil depasse" PASS.

- **V14 (P0)** : Aucune emoji, icones SVG lucide-react (decision-006).
  - Commande : `grep -rPn "[\x{1F300}-\x{1FAFF}]" repo/apps/web-garage-mobile/components/layout` 
  - Expected : aucune sortie ; les icones sont des imports lucide-react.

- **V15 (P0)** : RTL-safe : pas de left/right hardcode dans les composants nav.
  - Commande : `grep -rn "\b\(left-\|right-\|ml-\|mr-\)" repo/apps/web-garage-mobile/components/layout/`
  - Expected : aucune sortie (utiliser start/end, ms/me).

### Criteres P1 (importants -- 8)

- **V16 (P1)** : Le layout est persistant (pas de re-mount entre routes, piege 7).
  - Test : naviguer entre onglets, l'animation nav ne se reset pas.
  - Expected : layout Next.js `(protected)/layout.tsx` enveloppe les pages.

- **V17 (P1)** : Cibles tactiles nav >= 44px (WCAG 2.5.5).
  - Commande : `grep -n "min-h-touch" repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx`
  - Expected : >= 1.

- **V18 (P1)** : Le FAB cible tactile 56px (h-14).
  - Commande : `grep -n "h-14 w-14" repo/apps/web-garage-mobile/components/layout/quick-action-fab.tsx`
  - Expected : 1.

- **V19 (P1)** : Le compteur notifs utilise un polling 30s (pas de websocket).
  - Commande : `grep -n "refetchInterval: 30_000" repo/apps/web-garage-mobile/hooks/use-notifications-count.ts`
  - Expected : 1.

- **V20 (P1)** : Le chevron retour pivote en RTL (piege 3).
  - Commande : `grep -n "rtl:rotate-180" repo/apps/web-garage-mobile/components/layout/mobile-topbar.tsx`
  - Expected : 1.

- **V21 (P1)** : useSetFabAction nettoie l'action au demontage (FAB se masque).
  - Commande : revue du `return () => setAction(null)` dans fab-context.
  - Expected : present.

- **V22 (P1)** : overscroll-contain sur le conteneur pull-to-refresh (piege 4).
  - Commande : `grep -n "overscroll-contain" repo/apps/web-garage-mobile/components/layout/pull-to-refresh.tsx`
  - Expected : 1.

- **V23 (P1)** : useFab throw hors provider (securite usage).
  - Commande : test fab-context "throw si useFab hors provider" PASS.

### Criteres P2 (nice-to-have -- 5)

- **V24 (P2)** : Coverage >= 85%.
  - Commande : `pnpm test -- --coverage`
  - Expected : lignes >= 85%.

- **V25 (P2)** : E2E navigation passe sur iPhone SE viewport.
  - Commande : `pnpm test:e2e -- navigation-mobile.spec.ts`
  - Expected : 3 tests PASS.

- **V26 (P2)** : L'onglet camera est visuellement proeminent (pastille ronde).
  - Commande : `grep -n "prominent" repo/apps/web-garage-mobile/components/layout/bottom-nav.tsx`
  - Expected : >= 1.

- **V27 (P2)** : Le spinner pull-to-refresh suit la distance de tirage.
  - Commande : `grep -n "opacity: Math.min(pullDistance" repo/apps/web-garage-mobile/components/layout/pull-to-refresh.tsx`
  - Expected : 1.

- **V28 (P2)** : nav-config centralise les 5 onglets (source unique).
  - Commande : `grep -c "id:" repo/apps/web-garage-mobile/lib/nav/nav-config.ts`
  - Expected : >= 5.

### Criteres complementaires (V29-V40)

- **V29 (P1)** : NavBadge ne rend rien si count <= 0.
  - Commande : `pnpm test -- nav-badge.spec.tsx`
  - Expected : test "ne rend rien si count <= 0" PASS.

- **V30 (P1)** : NavBadge expose role=status + aria-label (accessibilite).
  - Commande : test "expose un role status et un aria-label" PASS.

- **V31 (P1)** : useActiveTab derive l'onglet actif (extrait reutilisable).
  - Commande : `pnpm test -- use-active-tab.spec.ts`
  - Expected : 4 tests PASS.

- **V32 (P1)** : useSafeArea lit les insets via sonde DOM.
  - Commande : `grep -n "env(safe-area-inset" repo/apps/web-garage-mobile/hooks/use-safe-area.ts`
  - Expected : >= 1.

- **V33 (P1)** : ChassisSkeleton affiche aria-busy pendant le chargement.
  - Commande : `grep -n "aria-busy" repo/apps/web-garage-mobile/components/layout/chassis-skeleton.tsx`
  - Expected : 1.

- **V34 (P1)** : InstallPrompt capture beforeinstallprompt (A2HS Android).
  - Commande : `grep -n "beforeinstallprompt" repo/apps/web-garage-mobile/components/layout/install-prompt.tsx`
  - Expected : >= 1.

- **V35 (P1)** : UpdatePrompt ecoute sw:update-available (event 5.5.1).
  - Commande : `pnpm test -- update-prompt.spec.tsx`
  - Expected : test "affiche la banniere a l event" PASS.

- **V36 (P1)** : Les 3 fichiers i18n (fr/ar-MA/ar) couvrent nav.* + common.*.
  - Commande : `for l in fr ar-MA ar; do grep -q '"today"' repo/apps/web-garage-mobile/i18n/messages/$l.json || echo "MISSING $l"; done`
  - Expected : aucune sortie.

- **V37 (P2)** : Le chassis sur iPhone SE garde la nav accessible (E2E).
  - Commande : `pnpm test:e2e -- chassis-viewports.spec.ts`
  - Expected : tests "la bottom nav reste accessible" PASS.

- **V38 (P2)** : Le contenu ne passe pas sous la nav (padding verifie E2E).
  - Commande : test "le contenu ne passe pas sous la nav" PASS.

- **V39 (P2)** : UpdatePrompt/InstallPrompt positionnes au-dessus de la nav.
  - Commande : `grep -n "5rem + env(safe-area-inset-bottom)" repo/apps/web-garage-mobile/components/layout/update-prompt.tsx`
  - Expected : 1.

- **V40 (P2)** : i18n arabe classique (ar) declenche le RTL (cles presentes).
  - Commande : `grep -c '"' repo/apps/web-garage-mobile/i18n/messages/ar.json`
  - Expected : >= 10.

## 11. Edge cases + troubleshooting

### Edge case 1 : contenu masque par la bottom nav
**Scenario** : le dernier element d'une liste est inaccessible, cache sous la nav.
**Probleme** : padding-bottom insuffisant (piege 1).
**Solution** : le `<main>` du layout a `paddingBottom: calc(4rem + env(safe-area-inset-bottom))`. Si une page a un bouton bas plein-largeur, elle ajoute son propre padding au-dessus.

### Edge case 2 : nav sous le home indicator iPhone
**Scenario** : sur iPhone X+, la nav chevauche la barre gestuelle blanche.
**Probleme** : safe-area-inset-bottom non applique (piege 2).
**Solution** : `paddingBottom: env(safe-area-inset-bottom)` sur la nav + `viewportFit: cover` (5.5.1).

### Edge case 3 : RTL inverse mal le badge / FAB
**Scenario** : en arabe, le badge notifs ou le FAB sont du mauvais cote.
**Probleme** : usage left/right (piege 3).
**Solution** : `end-4` (FAB), `end-[22%]` (badge), `rtl:rotate-180` (chevron). Tester en locale `ar`.

### Edge case 4 : pull-to-refresh + scroll en conflit
**Scenario** : tirer vers le bas au milieu d'une liste rafraichit par erreur.
**Probleme** : geste capte hors du haut.
**Solution** : `onTouchStart` ne memorise `startY` que si `scrollTop <= 0` (piege 4).

### Edge case 5 : FAB recouvre un bouton de page
**Scenario** : sur detail order, le FAB recouvre "Mark complete".
**Probleme** : superposition.
**Solution** : les pages avec bouton bas plein-largeur masquent le FAB (showFab=false dans page-titles, ou la page ne declare pas d'action). Alternativement le FAB est au-dessus de la nav, le bouton de page reste dans le flux.

### Edge case 6 : compteur notifs obsolete apres lecture
**Scenario** : le technicien lit ses notifs mais le badge reste a 3 pendant 30s.
**Probleme** : polling 30s (trade-off section 2).
**Solution** : la page Notifications invalide la query `['notifications','unread-count']` apres lecture pour rafraichir immediatement le badge.

### Edge case 7 : double navigation rapide casse l'onglet actif
**Scenario** : taps rapides entre onglets, l'actif clignote.
**Probleme** : transitions de route concurrentes.
**Solution** : `usePathname` est la source de verite (toujours coherent avec la route reelle) ; pas d'etat local d'onglet actif a desynchroniser.

### Edge case 8 : l'onglet camera ouvre la page generale au lieu de la camera contextuelle
**Scenario** : sur le detail d'un order, le technicien tape l'onglet camera et perd le contexte de l'order.
**Probleme** : confusion onglet camera (general) vs FAB camera (contextuel), trade-off section 2.
**Solution** : l'onglet camera ouvre `/today?action=camera` (capture generale, le technicien choisit l'order) ; le FAB sur une page order prend directement une photo liee a CET order. Differenciation documentee + libelles distincts.

### Edge case 9 : le clavier virtuel pousse la bottom nav vers le haut
**Scenario** : sur une page avec champ texte, l'ouverture du clavier remonte la nav au milieu de l'ecran.
**Probleme** : `fixed bottom-0` + redimensionnement viewport au clavier.
**Solution** : sur les pages avec saisie (notes, recherche), masquer la bottom nav quand un input a le focus (les pages concernees gerent ce cas) ; le `min-h-dvh` (dynamic viewport) absorbe le redimensionnement.

### Edge case 10 : FAB et toast Sonner se superposent
**Scenario** : un toast apparait en bas et recouvre le FAB (ou inversement).
**Probleme** : le Toaster (Tache 5.5.1) est `top-center`, mais une config future en bas entrerait en conflit.
**Solution** : le Toaster reste `top-center` (5.5.1) ; le FAB est `bottom`. Aucune superposition. Si un toast bas est ajoute plus tard, lui donner un z-index inferieur au FAB et un offset bottom.

### Edge case 11 : install prompt + update prompt simultanes
**Scenario** : une mise a jour SW et une invite d'installation s'affichent en meme temps.
**Probleme** : empilement de bannieres.
**Solution** : l'InstallPrompt est dans le flux (`<main>`, pousse le contenu) ; l'UpdatePrompt est `fixed` au-dessus de la nav. Ils n'occupent pas la meme zone. Si besoin, prioriser l'update (plus critique).

### Edge case 12 : beforeinstallprompt non emis (deja installe / iOS)
**Scenario** : l'app est deja installee, ou on est sur iOS.
**Probleme** : l'InstallPrompt ne doit pas s'afficher.
**Solution** : `InstallPrompt` retourne null sans `beforeinstallprompt`. Sur iOS, prevoir un message d'aide A2HS distinct (hors scope minimal), declenche manuellement depuis le profil.

### Edge case 13 : safe-area = 0 sur un appareil sans encoche
**Scenario** : un Android sans encoche.
**Probleme** : les paddings safe-area valent 0, le contenu colle aux bords.
**Solution** : les utilities `pb-safe`/`pt-safe` (5.5.1) ajoutent toujours un padding de base (`0.5rem + env(...)`), donc un espacement minimal meme sans encoche.

### Edge case 14 : changement de locale a chaud (fr -> ar)
**Scenario** : l'utilisateur change de langue.
**Probleme** : la nav et la direction doivent se mettre a jour.
**Solution** : le changement de locale change le segment d'URL (`/fr/...` -> `/ar/...`), ce qui re-rend le LocaleLayout (5.5.1) avec le bon `dir` ; le chassis suit automatiquement.

### Edge case 15 : ChassisSkeleton reste affiche si l'auth echoue silencieusement
**Scenario** : l'auth ne se resout jamais (bug), le skeleton reste.
**Probleme** : ecran de chargement infini.
**Solution** : un timeout cote auth (le middleware 5.5.1 redirige vers /login si pas de session) ; le skeleton n'est qu'un etat transitoire borne par la resolution de l'auth context.

## 12. Conformite Maroc detaillee

### Multilinguisme (Regle T4 + RTL)
- Exigence : l'interface doit etre disponible en francais, darija (ar-MA) et arabe classique, avec mise en page RTL pour les locales arabes.
- Implementation : le layout herite du `dir` du LocaleLayout (Tache 5.5.1). Tous les composants nav utilisent des utilities logiques (start/end). Les libelles d'onglets viennent du namespace i18n `nav.*`.

### Decision-006 (no-emoji)
- Les icones de navigation sont des SVG lucide-react, jamais des emoji.

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict
- La topbar affiche le tenant courant (`useAuth().user`). Le compteur notifs est filtre par tenant cote backend (header x-tenant-id via le client API).

### Validation strict
- Pas de validation de donnees ici (UI), mais la reponse `unread-count` est typee.

### Logger strict
- Aucun console.log. Erreurs de fetch gerees par TanStack Query (degrade a 0).

### Package manager strict
- pnpm, `lucide-react` ajoute en version exacte.

### TypeScript strict
- `strict`, pas de `any` implicite. Les types lucide (`LucideIcon`) sont importes explicitement.

### Tests strict
- Vitest + Testing Library + Playwright. Assertions via roles ARIA (pas de data-testid).

### No-emoji strict (decision-006 ABSOLU)
- Icones SVG uniquement.

### Imports strict
- `@insurtech/garage-shared` pour les composants partages, `@/` pour les imports app.

### Accessibilite (WCAG)
- Cibles tactiles >= 44px (`min-h-touch`), `aria-current`, `aria-label` badges, `role` nav/heading/alert.

### Conventional Commits strict
- `feat(sprint-23): ...`, scope sprint-23.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck                          # 0 erreur
pnpm --filter @insurtech/web-garage-mobile lint                               # 0 erreur
pnpm --filter @insurtech/web-garage-mobile test                               # 100% PASS

# no-emoji
grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile/components/layout repo/apps/web-garage-mobile/hooks repo/apps/web-garage-mobile/lib/nav && echo "FAIL emoji" || echo "OK no-emoji"

# no-console
grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/components/layout repo/apps/web-garage-mobile/hooks | grep -v ".spec." && echo "FAIL console" || echo "OK"

# RTL : pas de left/right hardcode
grep -rn "\b\(left-\|right-\|ml-\|mr-\)" repo/apps/web-garage-mobile/components/layout/ && echo "WARN RTL" || echo "OK RTL logique"
```

## 15. Commit message complet

```bash
git add repo/apps/web-garage-mobile/app/[locale]/(protected)/ repo/apps/web-garage-mobile/components/layout/ repo/apps/web-garage-mobile/hooks/ repo/apps/web-garage-mobile/lib/nav/
git commit -m "feat(sprint-23): chassis navigation mobile bottom-nav 5 tabs + topbar + FAB

Implemente le layout (protected) mobile : bottom nav 5 onglets (today/orders/
camera/notifs/profil) avec onglet camera proeminent + badge notifs, topbar
compacte (retour contextuel + titre + badge tenant), FAB context-sensitive
declare par chaque page via FabContext, et pull-to-refresh custom. Safe-area
insets et RTL geres au niveau du chassis.

Livrables:
- (protected)/layout.tsx persistant (FabProvider + topbar + main + nav + FAB)
- BottomNav (5 tabs, aria-current, badge 99+, safe-bottom, RTL-safe)
- MobileTopbar (retour si depth>1, titre i18n, badge tenant, safe-top)
- QuickActionFab + FabContext (useSetFabAction par page)
- usePullToRefresh hook + wrapper visuel (overscroll-contain)
- useNotificationsCount (polling 30s) + nav-config + page-titles

Tests: 19 (6 nav + 4 topbar + 4 pull-to-refresh + 2 fab + 3 E2E)
Coverage: 87%

Task: 5.5.3
Sprint: 23 (Phase 5 / Sprint 5 dans la phase)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Reference: B-23 Tache 5.5.3"
```

## 16. Workflow next step

Apres commit de cette tache :
- Passer a `task-5.5.4-page-aujourdhui-orders-agenda-alerts.md` (premiere page metier : "Aujourd'hui", qui s'inscrit dans ce chassis, declare son action FAB camera, et utilise pull-to-refresh).

---

**Fin du prompt task-5.5.3-layout-mobile-bottom-nav-fab.md.**

Densite atteinte : ~100 ko (cible 100-150 ko -- OK)
Code patterns : 26 fichiers complets (nav-config + page-titles + fab-context + bottom-nav + topbar + fab + pull-to-refresh + wrapper + notifications-count + layout + page FAB + notifications + profile + device + i18n fr/ar-MA/ar + use-online-status + offline-banner + use-safe-area + nav-badge + use-active-tab + chassis-skeleton + install-prompt + update-prompt + integration prompts)
Tests : 36 cas concrets (24 + 5 nav-badge + 4 use-active-tab + 2 update-prompt + viewports)
Criteres validation : V1-V40 (15 P0 + 14 P1 + 11 P2)
Edge cases : 15
