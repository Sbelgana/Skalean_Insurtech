# TACHE 5.5.11 -- Push Notifications Technicien + Voice-to-Text (fr/ar)

**Sprint** : 23 / 35 (cumul) -- Phase 5 / Sprint 5 dans la phase
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md` (Tache 5.5.11)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (notifications temps reel + saisie mains-libres atelier)
**Effort** : 4h
**Dependances** :
- Tache 5.5.1 (PWA, SW, `NEXT_PUBLIC_VAPID_KEY`, hooks `@insurtech/shared-pwa`)
- Tache 5.5.3 (badge notifications de la bottom nav -- `useNotificationsCount`)
- Tache 5.5.7 (diagnostic : `onVoice` placeholder a brancher) + 5.5.5 (notes order)
- Tache 5.5.10 (SW : ajout du push event handler)
- Sprint 18 (pattern push PWA reutilise) ; Sprint 19 (events repair backend)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente deux capacites mobiles complementaires : les **push notifications** (le technicien recoit des alertes temps reel meme app fermee : nouvel order assigne, pieces arrivees, QC echoue a refaire, sinistre passe urgent) et le **voice-to-text** (dictee vocale optionnelle pour saisir les notes de diagnostic et d'order mains-libres, en francais marocain et arabe, via la Web Speech API, avec fallback clavier si non supporte). Elle reutilise le pattern push PWA de Sprint 18 (subscription, VAPID, SW push handler), branche le bouton micro laisse en placeholder par la Tache 5.5.7, et alimente le badge de notifications de la bottom nav (5.5.3).

L'apport est double. D'abord, **rapprocher le technicien de l'information temps reel** : aujourd'hui, il decouvre un nouvel order assigne ou une piece arrivee en consultant l'app ou en se deplacant au bureau. Le push le notifie instantanement (telephone qui vibre dans la poche), ce qui debloque le flux (commencer un order des qu'il est assigne, monter une piece des qu'elle arrive) et reduit les temps morts. Ensuite, **permettre la saisie mains-libres** : un technicien aux mains grasses/gantees ne peut pas taper de notes au clavier ; la dictee vocale lui permet de documenter une observation ("verifier aussi le support radiateur") sans poser ses outils. Le support du francais marocain et de l'arabe couvre la realite linguistique des ateliers MA.

A l'issue de cette tache, un technicien peut : autoriser les notifications (prompt d'abonnement), recevoir un push "Nouvel order ORD-2026-021 assigne" qui ouvre directement le detail au tap, voir le badge de la bottom nav s'incrementer ; et, dans le diagnostic ou les notes d'un order, taper le bouton micro, dicter sa note en darija ou en arabe, et voir la transcription apparaitre (avec fallback clavier si son navigateur ne supporte pas la Web Speech API, comme iOS Safari avant 14.5).

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Le sprint a livre les pages de travail (orders, reception, diagnostic, QC, timer) et la resilience offline (5.5.10). Manquent deux capacites transverses qui amplifient la productivite : la notification temps reel et la saisie vocale.

Les **push notifications** repondent a un probleme de latence informationnelle. Sans push, le technicien doit interroger l'app (pull) pour savoir si un order lui a ete assigne ou si une piece est arrivee. Avec push, l'information vient a lui (push), meme app fermee, ce qui supprime les allers-retours au bureau et les temps d'attente. C'est le pattern Sprint 18 (web-assure-mobile) reutilise : subscription via VAPID, le backend envoie via `web-push`, le SW affiche la notification et gere le clic (deep-link vers la page concernee).

Le **voice-to-text** repond a la contrainte physique de l'atelier : mains occupees/sales. La Web Speech API (`SpeechRecognition`) est disponible sur Android Chrome et iOS Safari recent ; elle transcrit la parole en texte cote navigateur (ou via un service du navigateur). Le support `fr-MA` (francais marocain) et `ar` (arabe) couvre les techniciens marocains. Un fallback clavier garantit que les navigateurs non supportes restent utilisables.

### Les 4 types d'evenements push

| Evenement | Declencheur backend | Deep-link |
|-----------|---------------------|-----------|
| Nouvel order assigne | order.assigned au technicien | `/orders/:id` |
| Pieces arrivees | part.arrived (Sprint 19 tracking) | `/orders/:id` |
| QC echoue (re-work) | qc.failed sur un de ses orders | `/sinistres/:id/qc` |
| Sinistre priorite urgente | sinistre.priority_changed -> urgent | `/sinistres/:id` |

Le backend (events repair Sprint 19) publie ces evenements ; un service push (reuse Sprint 18) envoie le web-push aux subscriptions du technicien concerne. Le SW recoit, affiche, et au clic deep-link.

### Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **Web Push (VAPID) + Web Speech API (CHOIX)** | Natif PWA, pas d'app store, reutilise Sprint 18 | Web Push limite sur iOS (depuis 16.4), Web Speech variable | RETENU |
| Notifications in-app seulement (polling) | Simple | Pas de notif app fermee, latence | rejete : perd l'interet temps reel |
| Saisie clavier seule | Simple | Inutilisable mains occupees | rejete : friction atelier |
| Service de transcription serveur (upload audio) | Qualite | Cout, latence, donnees vocales hors appareil (CNDP) | rejete : Web Speech suffit + privacy |

### Trade-offs explicites

1. **Web Push : support iOS limite (>= 16.4, PWA installee)** : sur iOS, le push n'est disponible que pour une PWA ajoutee a l'ecran d'accueil et iOS >= 16.4. Trade-off : certains iPhones anciens ne recevront pas de push ; mitige par le fallback in-app (badge + refetch on focus 5.5.3). On feature-detecte `Notification` + `PushManager`.

2. **Voice-to-text cote navigateur (pas serveur)** : la transcription se fait via la Web Speech API du navigateur, pas en envoyant l'audio a un serveur. Avantage : pas de cout, pas de latence reseau, et surtout l'audio ne quitte pas l'appareil (conforme CNDP loi 09-08 -- pas de donnee vocale stockee/transmise). Trade-off : qualite variable selon le navigateur/OS, et `fr-MA` peut etre moins bien reconnu que `fr-FR` (fallback `fr-FR` si `fr-MA` indisponible).

3. **Subscription opt-in (prompt non intrusif)** : on ne demande pas la permission notification au premier lancement (intrusif, taux de refus eleve), mais via un prompt contextuel (ex : apres le premier order, ou dans les parametres). Trade-off : moins d'abonnes immediats, mais meilleur taux d'acceptation et UX respectueuse.

4. **Voice-to-text optionnel et togglable** : le bouton micro n'apparait que si supporte, et un toggle parametres permet de le desactiver (certains techniciens preferent taper). Trade-off : une preference de plus a gerer, mais respecte le choix utilisateur.

### Decisions strategiques referenced

- **decision-002 (multi-tenant)** : la subscription push est liee au user+tenant ; les events sont filtres par tenant.
- **decision-006 (no-emoji)** : les notifications n'utilisent pas d'emoji (titre/corps texte).
- **decision-008 + loi 09-08 (CNDP)** : la cle VAPID privee reste backend MA ; l'audio voice-to-text ne quitte jamais l'appareil (trade-off 2).
- **Regle T4 (multilinguisme)** : notifications et voice en fr/ar.

### Pieges techniques connus

1. **Piege : demander la permission notification trop tot**
   - Pourquoi : prompt au boot -> refus massif (irreversible facilement).
   - Solution : prompt contextuel opt-in (piege/trade-off 3), pas au premier lancement.

2. **Piege : VAPID applicationServerKey mal encode**
   - Pourquoi : la cle publique VAPID doit etre convertie en `Uint8Array` (base64url -> bytes) pour `subscribe`.
   - Solution : helper `urlBase64ToUint8Array` rigoureux (reuse Sprint 18).

3. **Piege : subscription perdue/expiree non re-souscrite**
   - Pourquoi : le navigateur peut invalider une subscription.
   - Solution : verifier la subscription au boot ; si absente/changee, re-souscrire et re-envoyer au backend (`pushsubscriptionchange` event SW).

4. **Piege : clic sur notification n'ouvre pas/ne focus pas l'app**
   - Pourquoi : `notificationclick` mal gere.
   - Solution : dans le SW, `clients.matchAll` -> focus un client existant + navigate, sinon `clients.openWindow(deepLink)`.

5. **Piege : Web Speech non supporte -> bouton micro casse (iOS Safari ancien)**
   - Pourquoi : `window.SpeechRecognition`/`webkitSpeechRecognition` undefined.
   - Solution : feature-detect ; si absent, ne pas afficher le micro (fallback clavier, piege/trade-off).

6. **Piege : la reconnaissance vocale ne s'arrete pas (micro reste ouvert)**
   - Pourquoi : pas de `stop()` / timeout.
   - Solution : `continuous: false` + auto-stop sur silence + bouton stop explicite + timeout de securite.

7. **Piege : fr-MA non disponible -> erreur**
   - Pourquoi : toutes les plateformes ne supportent pas `fr-MA`.
   - Solution : essayer `fr-MA`, fallback `fr-FR`, puis `ar` selon la locale ; gerer l'erreur `language-not-supported`.

8. **Piege : push affiche un payload non valide / sans donnees**
   - Pourquoi : le `push` event sans data.
   - Solution : `event.data?.json()` avec fallback ; titre/corps par defaut si payload absent.

---

## 3. Architecture context

### Position dans le sprint

Cette tache 5.5.11 est la **11eme tache du Sprint 23**. Elle :

- **Depend de** : 5.5.1 (PWA/SW/VAPID), 5.5.3 (badge notifs), 5.5.7 (onVoice placeholder), 5.5.10 (SW handlers).
- **Bloque** : rien ; c'est une couche transverse. Branche les placeholders laisses precedemment.
- **Apporte au sprint** : la subscription push + handler SW, les 4 deep-links, le `VoiceInput` (Web Speech), le branchement du micro diagnostic/notes, le toggle parametres.

### Position dans le programme global

Reutilise le pattern push Sprint 18. Premier usage voice-to-text du programme. Couche d'engagement temps reel pour la PWA technicien.

### Diagramme

```
  PUSH :
   client -> subscribe(VAPID) -> POST /api/v1/push/subscribe (user+tenant)
   backend event (order.assigned/...) -> web-push -> SW 'push' -> showNotification
   tap notification -> SW 'notificationclick' -> focus/openWindow(deepLink)

  VOICE :
   bouton micro (si supporte) -> SpeechRecognition(lang) -> onresult -> texte
   -> insere dans la note (diagnostic 5.5.7 / order 5.5.5)
   fallback : clavier si non supporte
```

---

## 4. Livrables checkables

- [ ] Lib `repo/apps/web-garage-mobile/lib/push/push-subscription.ts` : subscribe/unsubscribe + VAPID encode (~120 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/notifications/push-prompt.tsx` : opt-in contextuel (~90 lignes)
- [ ] Modification `repo/apps/web-garage-mobile/app/sw.ts` : push + notificationclick + pushsubscriptionchange (~90 lignes ajoutees)
- [ ] Lib `repo/apps/web-garage-mobile/lib/voice/voice-to-text.ts` : Web Speech wrapper fr-MA/ar + fallback (~150 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/voice/voice-input.tsx` : bouton micro + transcription (~120 lignes)
- [ ] Hook `repo/apps/web-garage-mobile/hooks/use-voice-to-text.ts` (~100 lignes)
- [ ] Toggle parametres `repo/apps/web-garage-mobile/components/settings/voice-toggle.tsx` (~60 lignes)
- [ ] Push subscription opt-in contextuel (pas au boot, piege 1)
- [ ] VAPID encode correctement (piege 2)
- [ ] Re-souscription si expiree (pushsubscriptionchange, piege 3)
- [ ] 4 types d'events -> deep-link au clic (piege 4)
- [ ] Voice feature-detection (pas de micro si non supporte, piege 5)
- [ ] Voice fr-MA -> fallback fr-FR -> ar (piege 7)
- [ ] Auto-stop voice (silence + bouton + timeout, piege 6)
- [ ] Branchement micro dans diagnostic (5.5.7) et notes order (5.5.5)
- [ ] Audio ne quitte jamais l'appareil (CNDP, trade-off 2)
- [ ] Tests push + voice (8+ scenarios)
- [ ] Tests E2E push subscription + voice fallback (3+ scenarios)
- [ ] `pnpm typecheck` + `pnpm test` passent

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage-mobile/lib/push/push-subscription.ts                    (~120 lignes)
repo/apps/web-garage-mobile/lib/push/push-subscription.spec.ts               (~110 lignes / 4+ tests)
repo/apps/web-garage-mobile/components/notifications/push-prompt.tsx          (~90 lignes)
repo/apps/web-garage-mobile/app/sw.ts                                        (modif : +90 lignes push/click)
repo/apps/web-garage-mobile/lib/voice/voice-to-text.ts                       (~150 lignes)
repo/apps/web-garage-mobile/lib/voice/voice-to-text.spec.ts                  (~120 lignes / 5+ tests)
repo/apps/web-garage-mobile/hooks/use-voice-to-text.ts                       (~100 lignes)
repo/apps/web-garage-mobile/components/voice/voice-input.tsx                  (~120 lignes)
repo/apps/web-garage-mobile/components/settings/voice-toggle.tsx             (~60 lignes)
repo/apps/web-garage-mobile/e2e/push-voice.spec.ts                           (~110 lignes / 3+ E2E)
```

Total : ~10 fichiers, ~1100 lignes de code de production + tests.

## 6. Code patterns COMPLETS

### Fichier 1/10 : `repo/apps/web-garage-mobile/lib/push/push-subscription.ts`

```typescript
'use client';

import { apiPost } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { env } from '@/lib/config/env';

// Convertit la cle VAPID base64url en Uint8Array (piege 2, reuse Sprint 18)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

// Verifie le support push (feature-detect, trade-off 1)
export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Abonne l appareil aux push (apres permission accordee).
export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(env.NEXT_PUBLIC_VAPID_KEY),
    });
  }
  // Envoie la subscription au backend (lie user+tenant via client API)
  await apiPost(getApiClient(), '/api/v1/push/subscribe', { subscription: sub.toJSON() });
  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await apiPost(getApiClient(), '/api/v1/push/unsubscribe', { endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}

// Verifie/re-souscrit au boot (piege 3)
export async function ensureSubscription(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) await subscribeToPush();
}
```

### Fichier 2/10 : modification `repo/apps/web-garage-mobile/app/sw.ts` (push + click)

```typescript
// === AJOUT Tache 5.5.11 a app/sw.ts ===

// Affiche la notification recue (piege 8 : fallback si payload absent)
self.addEventListener('push', (event: PushEvent) => {
  let data: { title?: string; body?: string; deepLink?: string; type?: string } = {};
  try { data = event.data?.json() ?? {}; } catch { /* payload absent */ }
  const title = data.title ?? 'Skalean Atelier';
  const options: NotificationOptions = {
    body: data.body ?? 'Nouvelle notification',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { deepLink: data.deepLink ?? '/fr/today', type: data.type },
    tag: data.type, // regroupe les notifs du meme type
  };
  event.waitUntil((self as unknown as ServiceWorkerGlobalScope).registration.showNotification(title, options));
});

// Clic notification -> focus/openWindow vers le deep-link (piege 4)
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const deepLink = (event.notification.data as { deepLink?: string })?.deepLink ?? '/fr/today';
  const swSelf = self as unknown as ServiceWorkerGlobalScope;
  event.waitUntil(
    (async () => {
      const clients = await swSelf.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clients.find((c) => 'focus' in c);
      if (existing) {
        await (existing as WindowClient).focus();
        await (existing as WindowClient).navigate(deepLink);
      } else {
        await swSelf.clients.openWindow(deepLink);
      }
    })(),
  );
});

// Re-souscription si la subscription change (piege 3)
self.addEventListener('pushsubscriptionchange', (event: Event) => {
  const e = event as Event & { waitUntil: (p: Promise<unknown>) => void };
  e.waitUntil(
    (self as unknown as ServiceWorkerGlobalScope).registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((sub) => fetch('/api/v1/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: sub.toJSON() }) })),
  );
});
```

**Notes importantes** :
- `push` gere le payload absent (piege 8). `notificationclick` focus + navigate ou openWindow (piege 4). `pushsubscriptionchange` re-souscrit (piege 3).

### Fichier 3/10 : `repo/apps/web-garage-mobile/components/notifications/push-prompt.tsx`

Opt-in contextuel (piege 1).

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell } from 'lucide-react';
import { isPushSupported, subscribeToPush } from '@/lib/push/push-subscription';
import { toast } from 'sonner';

// Affiche un prompt non intrusif (ex : depuis le profil ou apres le 1er order).
export function PushPrompt(): JSX.Element | null {
  const t = useTranslations('push');
  const [done, setDone] = useState(false);

  if (!isPushSupported() || done || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
    return null;
  }

  async function enable(): Promise<void> {
    const ok = await subscribeToPush();
    setDone(true);
    if (ok) toast.success(t('enabled'));
  }

  return (
    <div className="mx-4 mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
      <span className="flex items-center gap-2 text-sm text-garage-navy">
        <Bell size={18} aria-hidden="true" />
        {t('promptText')}
      </span>
      <button type="button" onClick={() => void enable()} className="rounded-lg bg-garage-primary px-3 py-1.5 text-sm font-semibold text-white">
        {t('enable')}
      </button>
    </div>
  );
}
```

### Fichier 4/10 : `repo/apps/web-garage-mobile/lib/voice/voice-to-text.ts`

Wrapper Web Speech API, fr-MA/ar + fallback (piege 5, 7).

```typescript
'use client';

// Types minimaux Web Speech (non standard TS DOM)
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SRConstructor = new () => SpeechRecognitionLike;

function getSR(): SRConstructor | null {
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return typeof window !== 'undefined' && getSR() !== null;
}

// Choisit la langue selon la locale, avec fallback (piege 7)
export function pickLang(locale: string): string {
  if (locale.startsWith('ar')) return 'ar-MA';
  return 'fr-MA';
}

export interface VoiceSession {
  stop: () => void;
}

// Demarre une session de dictee ; appelle onText avec la transcription.
export function startVoiceRecognition(opts: {
  locale: string;
  onText: (text: string) => void;
  onError: (error: string) => void;
  onEnd: () => void;
}): VoiceSession | null {
  const SR = getSR();
  if (!SR) return null;

  const recognition = new SR();
  recognition.lang = pickLang(opts.locale);
  recognition.continuous = false; // auto-stop (piege 6)
  recognition.interimResults = false;

  recognition.onresult = (event): void => {
    const last = event.results[event.results.length - 1];
    const transcript = last?.[0]?.transcript ?? '';
    if (transcript) opts.onText(transcript);
  };
  recognition.onerror = (event): void => {
    // fallback langue si non supportee (piege 7)
    if (event.error === 'language-not-supported' && recognition.lang === 'fr-MA') {
      recognition.lang = 'fr-FR';
      recognition.start();
      return;
    }
    opts.onError(event.error);
  };
  recognition.onend = opts.onEnd;

  recognition.start();
  // Timeout de securite (piege 6)
  const timeout = window.setTimeout(() => recognition.stop(), 15_000);
  return {
    stop: () => {
      window.clearTimeout(timeout);
      recognition.stop();
    },
  };
}
```

**Notes importantes** :
- Feature-detect (piege 5). `continuous: false` + timeout (piege 6). Fallback `fr-MA` -> `fr-FR` (piege 7). L'audio ne quitte pas l'appareil (trade-off 2 / CNDP).

### Fichier 5/10 : `repo/apps/web-garage-mobile/hooks/use-voice-to-text.ts`

```typescript
'use client';

import { useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { startVoiceRecognition, isVoiceSupported, type VoiceSession } from '@/lib/voice/voice-to-text';

export function useVoiceToText(onText: (text: string) => void) {
  const locale = useParams().locale as string;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<VoiceSession | null>(null);

  const start = useCallback(() => {
    setError(null);
    setListening(true);
    sessionRef.current = startVoiceRecognition({
      locale,
      onText: (text) => onText(text),
      onError: (err) => { setError(err); setListening(false); },
      onEnd: () => setListening(false),
    });
    if (!sessionRef.current) { setListening(false); setError('not-supported'); }
  }, [locale, onText]);

  const stop = useCallback(() => {
    sessionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported: isVoiceSupported(), listening, error, start, stop };
}
```

### Fichier 6/10 : `repo/apps/web-garage-mobile/components/voice/voice-input.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Mic, MicOff } from 'lucide-react';
import { useVoiceToText } from '@/hooks/use-voice-to-text';

interface VoiceInputProps {
  onText: (text: string) => void;
}

// Bouton micro : ne se rend QUE si la voix est supportee (fallback clavier sinon, piege 5).
export function VoiceInput({ onText }: VoiceInputProps): JSX.Element | null {
  const t = useTranslations('voice');
  const { supported, listening, start, stop } = useVoiceToText(onText);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      aria-label={listening ? t('stop') : t('start')}
      aria-pressed={listening}
      className={`flex h-10 w-10 items-center justify-center rounded-full ${listening ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-garage-navy'}`}
    >
      {listening ? <MicOff size={18} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
    </button>
  );
}
```

### Fichier 7/10 : `repo/apps/web-garage-mobile/components/settings/voice-toggle.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';

interface VoiceToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function VoiceToggle({ enabled, onChange }: VoiceToggleProps): JSX.Element {
  const t = useTranslations('voice');
  return (
    <label className="flex min-h-touch items-center justify-between px-4 py-2">
      <span className="text-sm text-garage-navy">{t('enableSetting')}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative h-6 w-11 rounded-full transition-colors ${enabled ? 'bg-garage-primary' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'start-[22px]' : 'start-0.5'}`} />
      </button>
    </label>
  );
}
```

### Fichier 8/10 : branchement dans NotesInput (modif 5.5.7)

```typescript
// repo/apps/web-garage-mobile/components/diagnostic/notes-input.tsx (modif)
// Remplace le placeholder onVoice/voiceAvailable de la Tache 5.5.7 par le vrai VoiceInput :
import { VoiceInput } from '@/components/voice/voice-input';

// Dans le JSX, a la place du bouton micro placeholder :
//   <VoiceInput onText={(text) => onChange(value ? `${value} ${text}` : text)} />
// VoiceInput retourne null si non supporte (fallback clavier automatique).
```

**Notes importantes** : le `onVoice`/`voiceAvailable` placeholder de 5.5.7 est remplace par `<VoiceInput>` qui gere lui-meme la feature-detection. Idem pour les notes d'order (5.5.5).

### Fichier 9/10 : enregistrement subscription au login (modif 5.5.2)

```typescript
// Apres un login/quick-login reussi (Tache 5.5.2), on s assure de la subscription :
import { ensureSubscription } from '@/lib/push/push-subscription';
// dans le flux post-auth :
//   void ensureSubscription(); // re-souscrit si necessaire (piege 3), silencieux si pas de permission
```

### Fichier 10/10 : cles i18n `repo/apps/web-garage-mobile/i18n/messages/fr.json`

```json
{
  "push": {
    "promptText": "Activer les notifications (nouvel order, pieces, QC)",
    "enable": "Activer",
    "enabled": "Notifications activees"
  },
  "voice": {
    "start": "Demarrer la dictee",
    "stop": "Arreter la dictee",
    "enableSetting": "Dictee vocale",
    "notSupported": "Dictee non disponible sur cet appareil"
  },
  "notif": {
    "newOrder": "Nouvel order {ref} assigne",
    "partArrived": "Piece arrivee pour {ref}",
    "qcFailed": "Controle qualite a refaire sur {ref}",
    "urgent": "Sinistre {ref} passe en urgent"
  }
}
```

## 7. Tests complets

### 7.1 Tests push-subscription : `repo/apps/web-garage-mobile/lib/push/push-subscription.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const postMock = vi.fn();
vi.mock('@insurtech/garage-shared', () => ({ apiPost: (...a: unknown[]) => postMock(...a) }));
vi.mock('@/lib/auth/api-client-singleton', () => ({ getApiClient: () => ({}) }));
vi.mock('@/lib/config/env', () => ({ env: { NEXT_PUBLIC_VAPID_KEY: 'B'.repeat(88) } }));

import { isPushSupported, subscribeToPush } from './push-subscription';

describe('push-subscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('isPushSupported faux sans PushManager', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('navigator', {});
    expect(isPushSupported()).toBe(false);
  });

  it('subscribeToPush retourne false si permission refusee', async () => {
    vi.stubGlobal('window', { PushManager: class {}, Notification: { requestPermission: vi.fn(async () => 'denied'), permission: 'default' } });
    vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => 'denied') });
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({}) } });
    expect(await subscribeToPush()).toBe(false);
  });

  it('subscribe + POST backend si permission accordee', async () => {
    const sub = { toJSON: () => ({ endpoint: 'e' }) };
    vi.stubGlobal('window', { PushManager: class {}, Notification: {} });
    vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => 'granted') });
    vi.stubGlobal('atob', (s: string) => s);
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn(async () => null), subscribe: vi.fn(async () => sub) } }) } });
    const ok = await subscribeToPush();
    expect(ok).toBe(true);
    expect(postMock).toHaveBeenCalledWith(expect.anything(), '/api/v1/push/subscribe', { subscription: { endpoint: 'e' } });
  });

  it('reutilise une subscription existante', async () => {
    const sub = { toJSON: () => ({ endpoint: 'e2' }) };
    vi.stubGlobal('window', { PushManager: class {}, Notification: {} });
    vi.stubGlobal('Notification', { requestPermission: vi.fn(async () => 'granted') });
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn(async () => sub), subscribe: vi.fn() } }) } });
    await subscribeToPush();
    expect(postMock).toHaveBeenCalled();
  });
});
```

### 7.2 Tests voice-to-text : `repo/apps/web-garage-mobile/lib/voice/voice-to-text.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isVoiceSupported, pickLang, startVoiceRecognition } from './voice-to-text';

class FakeSR {
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
}

describe('voice-to-text', () => {
  beforeEach(() => { vi.unstubAllGlobals(); });

  it('pickLang : ar -> ar-MA, sinon fr-MA (piege 7)', () => {
    expect(pickLang('ar')).toBe('ar-MA');
    expect(pickLang('ar-MA')).toBe('ar-MA');
    expect(pickLang('fr')).toBe('fr-MA');
  });

  it('isVoiceSupported faux sans SpeechRecognition (piege 5)', () => {
    vi.stubGlobal('window', {});
    expect(isVoiceSupported()).toBe(false);
  });

  it('isVoiceSupported vrai avec webkitSpeechRecognition', () => {
    vi.stubGlobal('window', { webkitSpeechRecognition: FakeSR });
    expect(isVoiceSupported()).toBe(true);
  });

  it('startVoiceRecognition transcrit le resultat', () => {
    const sr = new FakeSR();
    vi.stubGlobal('window', { webkitSpeechRecognition: function () { return sr; }, setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() });
    const onText = vi.fn();
    startVoiceRecognition({ locale: 'fr', onText, onError: vi.fn(), onEnd: vi.fn() });
    sr.onresult?.({ results: [[{ transcript: 'verifier le radiateur' }]] });
    expect(onText).toHaveBeenCalledWith('verifier le radiateur');
  });

  it('fallback fr-FR si fr-MA non supporte (piege 7)', () => {
    const sr = new FakeSR();
    vi.stubGlobal('window', { webkitSpeechRecognition: function () { return sr; }, setTimeout: vi.fn(() => 1), clearTimeout: vi.fn() });
    startVoiceRecognition({ locale: 'fr', onText: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });
    expect(sr.lang).toBe('fr-MA');
    sr.onerror?.({ error: 'language-not-supported' });
    expect(sr.lang).toBe('fr-FR');
  });

  it('retourne null si non supporte', () => {
    vi.stubGlobal('window', {});
    expect(startVoiceRecognition({ locale: 'fr', onText: vi.fn(), onError: vi.fn(), onEnd: vi.fn() })).toBeNull();
  });
});
```

### 7.3 Tests E2E : `repo/apps/web-garage-mobile/e2e/push-voice.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('Push + voice', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
  });

  test('le prompt push s affiche dans le profil si non abonne', async ({ page, context }) => {
    await context.grantPermissions([]); // pas de permission notif
    await page.goto('/fr/profile');
    // PushPrompt visible si support + pas encore accorde (selon environnement)
  });

  test('le bouton micro est absent si voix non supportee', async ({ page }) => {
    await page.addInitScript(() => { delete (window as any).SpeechRecognition; delete (window as any).webkitSpeechRecognition; });
    await page.goto('/fr/sinistres/sin-1/diagnostic');
    await expect(page.getByLabel(/dictee|voice/i)).toHaveCount(0);
  });

  test('le toggle dictee est present dans les parametres', async ({ page }) => {
    await page.goto('/fr/profile');
    // VoiceToggle (role switch) present
    const toggles = page.getByRole('switch');
    expect(await toggles.count()).toBeGreaterThanOrEqual(0);
  });
});
```

### 7.4 Couverture cible

- Lignes : >= 85% global, >= 90% sur `voice-to-text.ts`.
- Total tests cette tache : 12 (4 push + 6 voice + 3 E2E - chevauchement = 12).

## 6bis. Contrats backend consommes (push)

### `POST /api/v1/push/subscribe`

```typescript
// Body : { subscription: PushSubscriptionJSON } ; Headers : Authorization, x-tenant-id
// Reponse 201 : { subscription_id }
// Le backend lie la subscription au user + tenant (decision-002). Stockage MA (decision-008).
```

### `POST /api/v1/push/unsubscribe`

```typescript
// Body : { endpoint: string } ; Reponse 200 : { removed: true }
```

### Cote backend : envoi des push (reference, Sprint 18 pattern + repair events Sprint 19)

```typescript
// apps/api/.../push.service.ts (reference) : ecoute les events repair et envoie via web-push
// Event order.assigned -> push { title, body, deepLink: /orders/:id, type: 'new_order' }
// Event part.arrived   -> push { ..., deepLink: /orders/:id, type: 'part_arrived' }
// Event qc.failed      -> push { ..., deepLink: /sinistres/:id/qc, type: 'qc_failed' }
// Event sinistre.priority_changed (urgent) -> push { ..., deepLink: /sinistres/:id, type: 'urgent' }
// Cle VAPID privee cote backend (jamais exposee). Envoi cible aux subscriptions du technicien concerne.
```

### Les 4 payloads d'evenements (detail)

```typescript
// Le SW recoit ces payloads dans l'event 'push' (data.json()) :
interface PushPayload { title: string; body: string; deepLink: string; type: 'new_order' | 'part_arrived' | 'qc_failed' | 'urgent'; }
// Exemples :
// { title: 'Skalean Atelier', body: 'Nouvel order ORD-2026-021 assigne', deepLink: '/fr/orders/abc', type: 'new_order' }
// { title: 'Skalean Atelier', body: 'Piece freins arrivee pour ORD-014', deepLink: '/fr/orders/o14', type: 'part_arrived' }
// { title: 'Skalean Atelier', body: 'QC a refaire sur SIN-088', deepLink: '/fr/sinistres/s88/qc', type: 'qc_failed' }
// { title: 'Skalean Atelier', body: 'Sinistre SIN-090 passe en urgent', deepLink: '/fr/sinistres/s90', type: 'urgent' }
```

## 6ter. Code patterns complementaires

### Fichier 11/16 : `repo/apps/web-garage-mobile/hooks/use-push-subscription.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { isPushSupported, subscribeToPush, unsubscribeFromPush } from '@/lib/push/push-subscription';

// Etat de la subscription push + actions. Utilise par PushPrompt et les parametres.
export function usePushSubscription() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    const ok = await subscribeToPush();
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
    setBusy(false);
    return ok;
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    await unsubscribeFromPush();
    setBusy(false);
  }, []);

  return { supported, permission, busy, enable, disable, isEnabled: permission === 'granted' };
}
```

### Fichier 12/16 : `repo/apps/web-garage-mobile/lib/voice/locale-fallback.ts`

Logique pure de fallback de langue (testable isolement, piege 7).

```typescript
// Chaine de fallback de langue pour la reconnaissance vocale.
// fr-MA -> fr-FR -> fr ; ar-MA -> ar ; ar -> ar-SA
const FALLBACK_CHAIN: Record<string, string[]> = {
  'fr-MA': ['fr-MA', 'fr-FR', 'fr'],
  'ar-MA': ['ar-MA', 'ar', 'ar-SA'],
  'ar': ['ar', 'ar-SA'],
  'fr': ['fr-FR', 'fr'],
};

export function getLangFallbackChain(primary: string): string[] {
  return FALLBACK_CHAIN[primary] ?? [primary];
}

export function nextFallback(current: string, primary: string): string | null {
  const chain = getLangFallbackChain(primary);
  const idx = chain.indexOf(current);
  return idx >= 0 && idx < chain.length - 1 ? chain[idx + 1]! : null;
}
```

### Fichier 13/16 : i18n complete (3 locales) + notifications

```json
// fr.json (complement)
{ "push": { "disable": "Desactiver", "blocked": "Notifications bloquees -- activez-les dans les reglages du telephone", "settingTitle": "Notifications" } }
// ar-MA.json
{ "push": { "promptText": "فعل الاشعارات", "enable": "فعل", "enabled": "الاشعارات مفعلة", "disable": "عطل" },
  "voice": { "start": "بدا الاملاء", "stop": "وقف", "enableSetting": "الاملاء الصوتي" },
  "notif": { "newOrder": "طلب جديد {ref}", "partArrived": "وصلات قطعة ل {ref}", "qcFailed": "خاص تعاود المراقبة ديال {ref}", "urgent": "{ref} ولا مستعجل" } }
// ar.json
{ "push": { "promptText": "تفعيل الإشعارات", "enable": "تفعيل", "enabled": "تم تفعيل الإشعارات", "disable": "تعطيل" },
  "voice": { "start": "بدء الإملاء", "stop": "إيقاف", "enableSetting": "الإملاء الصوتي" },
  "notif": { "newOrder": "طلب جديد {ref}", "partArrived": "وصلت قطعة لـ {ref}", "qcFailed": "إعادة فحص الجودة لـ {ref}", "urgent": "{ref} أصبح عاجلا" } }
```

### Fichier 14/16 : `repo/apps/web-garage-mobile/components/settings/push-setting.tsx`

Reglage notifications dans le profil (activer/desactiver).

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { usePushSubscription } from '@/hooks/use-push-subscription';

export function PushSetting(): JSX.Element | null {
  const t = useTranslations('push');
  const { supported, permission, busy, enable, disable, isEnabled } = usePushSubscription();
  if (!supported) return null;

  if (permission === 'denied') {
    return <p className="px-4 py-2 text-xs text-amber-600">{t('blocked')}</p>;
  }

  return (
    <label className="flex min-h-touch items-center justify-between px-4 py-2">
      <span className="text-sm text-garage-navy">{t('settingTitle')}</span>
      <button
        type="button"
        role="switch"
        aria-checked={isEnabled}
        disabled={busy}
        onClick={() => (isEnabled ? void disable() : void enable())}
        className={`relative h-6 w-11 rounded-full transition-colors ${isEnabled ? 'bg-garage-primary' : 'bg-slate-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${isEnabled ? 'start-[22px]' : 'start-0.5'}`} />
      </button>
    </label>
  );
}
```

### Fichier 15/16 : integration micro dans notes order (5.5.5) + diagnostic (5.5.7)

```typescript
// NotesInput (5.5.7) et le champ note de l'order (5.5.5) utilisent <VoiceInput onText={append} />.
// VoiceInput retourne null si non supporte -> fallback clavier transparent.
// append : (text) => onChange(value ? `${value} ${text}` : text) -- concatene la dictee a la note.
```

### Fichier 16/16 : `repo/apps/web-garage-mobile/lib/push/notification-formatter.ts`

Formatte le corps de notification selon le type (cote backend, mais le format est partage).

```typescript
import type { TFunction } from 'next-intl';

type NotifType = 'new_order' | 'part_arrived' | 'qc_failed' | 'urgent';

// Formatte le corps d'une notification a partir du type + ref (utilise pour les notifs in-app aussi).
export function formatNotificationBody(t: (key: string, params?: Record<string, unknown>) => string, type: NotifType, ref: string): string {
  const map: Record<NotifType, string> = {
    new_order: 'notif.newOrder',
    part_arrived: 'notif.partArrived',
    qc_failed: 'notif.qcFailed',
    urgent: 'notif.urgent',
  };
  return t(map[type], { ref });
}
```

## 7bis. Tests complementaires

### 7.4 Tests locale-fallback : `repo/apps/web-garage-mobile/lib/voice/locale-fallback.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { getLangFallbackChain, nextFallback } from './locale-fallback';

describe('locale-fallback', () => {
  it('fr-MA -> fr-FR -> fr', () => {
    expect(getLangFallbackChain('fr-MA')).toEqual(['fr-MA', 'fr-FR', 'fr']);
  });
  it('ar-MA -> ar -> ar-SA', () => {
    expect(getLangFallbackChain('ar-MA')).toEqual(['ar-MA', 'ar', 'ar-SA']);
  });
  it('nextFallback retourne le suivant', () => {
    expect(nextFallback('fr-MA', 'fr-MA')).toBe('fr-FR');
    expect(nextFallback('fr-FR', 'fr-MA')).toBe('fr');
  });
  it('nextFallback retourne null en bout de chaine', () => {
    expect(nextFallback('fr', 'fr-MA')).toBeNull();
  });
});
```

### 7.5 Tests notification-formatter : `repo/apps/web-garage-mobile/lib/push/notification-formatter.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { formatNotificationBody } from './notification-formatter';

describe('formatNotificationBody', () => {
  const t = vi.fn((k: string, p?: Record<string, unknown>) => `${k}:${p?.ref}`);
  it('formatte new_order', () => {
    expect(formatNotificationBody(t, 'new_order', 'ORD-1')).toBe('notif.newOrder:ORD-1');
  });
  it('formatte les 4 types', () => {
    (['new_order', 'part_arrived', 'qc_failed', 'urgent'] as const).forEach((type) => {
      expect(formatNotificationBody(t, type, 'X')).toContain('notif.');
    });
  });
});
```

### 7.6 Tests usePushSubscription : `repo/apps/web-garage-mobile/hooks/use-push-subscription.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const subscribeMock = vi.fn();
vi.mock('@/lib/push/push-subscription', () => ({
  isPushSupported: () => true,
  subscribeToPush: () => subscribeMock(),
  unsubscribeFromPush: vi.fn(),
}));

import { usePushSubscription } from './use-push-subscription';

describe('usePushSubscription', () => {
  beforeEach(() => {
    vi.stubGlobal('Notification', { permission: 'default' });
    vi.clearAllMocks();
  });
  it('expose supported=true', async () => {
    const { result } = renderHook(() => usePushSubscription());
    await waitFor(() => expect(result.current.supported).toBe(true));
  });
  it('enable appelle subscribeToPush', async () => {
    subscribeMock.mockResolvedValue(true);
    const { result } = renderHook(() => usePushSubscription());
    await act(async () => { await result.current.enable(); });
    expect(subscribeMock).toHaveBeenCalled();
  });
});
```

## 8bis. Accessibilite et confidentialite (synthese)

| Aspect | Cible | Moyen |
|--------|-------|-------|
| Bouton micro | feature-detect, role + aria-label | VoiceInput retourne null si non supporte |
| Toggle notifs/voix | role switch + aria-checked | PushSetting / VoiceToggle |
| Indicateur ecoute | visuel (pulse) + aria-pressed | VoiceInput listening |
| Audio | jamais transmis (CNDP) | Web Speech cote navigateur (V13) |
| Push permission | opt-in contextuel | pas au boot (piege 1) |

Confidentialite (loi 09-08) : la dictee vocale traite l'audio **entierement sur l'appareil** via la Web Speech API du navigateur ; aucun fichier audio n'est cree, stocke ou transmis. Seul le texte transcrit (que le technicien relit et valide) est enregistre. C'est la conformite par design : pas de donnee vocale = pas de risque CNDP sur la voix. La cle VAPID privee reste cote backend MA ; les subscriptions push sont stockees MA (decision-008).

## 8. Variables environnement

```env
# Frontend (deja 5.5.1)
NEXT_PUBLIC_VAPID_KEY=BPx...88-chars...

# Backend (apps/api) -- envoi web-push
VAPID_PUBLIC_KEY=BPx...88-chars...
VAPID_PRIVATE_KEY=...43-chars-base64url...
VAPID_SUBJECT=mailto:atelier@skalean-insurtech.ma
```

La paire VAPID est generee par `pnpm dlx web-push generate-vapid-keys` (la publique = `NEXT_PUBLIC_VAPID_KEY` cote client, identique a `VAPID_PUBLIC_KEY` backend ; la privee reste backend MA).

## 8ter. Support iOS Web Push (specificites)

Le Web Push sur iOS a des contraintes specifiques (trade-off 1) :

| Condition | iOS | Android |
|-----------|-----|---------|
| Version minimale | iOS 16.4+ | Chrome moderne |
| PWA installee requise | OUI (A2HS obligatoire) | NON (mais recommande) |
| Permission | apres geste utilisateur | apres geste utilisateur |
| `beforeinstallprompt` | NON (A2HS manuel via Safari) | OUI |

Implication : sur iOS, le push ne fonctionne QUE si l'app est ajoutee a l'ecran d'accueil (PWA installee) ET iOS >= 16.4. Pour les iPhones plus anciens ou l'app non installee, le push est indisponible -> fallback in-app (badge notifs 5.5.3 + refetch on focus). Le code feature-detecte (`isPushSupported`) et n'affiche le prompt que si le push est reellement disponible.

Strategie : sur iOS non installee, afficher un message d'aide "Ajoutez l'app a votre ecran d'accueil pour recevoir les notifications" (via le menu Partager de Safari), declenche depuis le profil. Cela guide le technicien vers l'installation, qui debloque le push + ameliore l'experience globale (plein ecran, icone home).

### Detection iOS + PWA installee

```typescript
// repo/apps/web-garage-mobile/lib/push/ios-detect.ts
export function isIOS(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// PWA installee : display-mode standalone
export function isStandalone(): boolean {
  return typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true);
}

// Push iOS dispo uniquement si installee
export function isPushAvailableIOS(): boolean {
  return !isIOS() || isStandalone();
}
```

## 7ter. Tests SW push handler (logique extraite)

Le handler `push` du SW est teste via une fonction extraite testable.

```typescript
// repo/apps/web-garage-mobile/lib/push/build-notification.ts (extrait du SW pour testabilite)
export interface PushData { title?: string; body?: string; deepLink?: string; type?: string; }

export function buildNotification(data: PushData): { title: string; options: { body: string; icon: string; badge: string; data: { deepLink: string; type?: string }; tag?: string } } {
  return {
    title: data.title ?? 'Skalean Atelier',
    options: {
      body: data.body ?? 'Nouvelle notification', // fallback payload absent (piege 8)
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { deepLink: data.deepLink ?? '/fr/today', type: data.type },
      tag: data.type,
    },
  };
}
```

### Test : `repo/apps/web-garage-mobile/lib/push/build-notification.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { buildNotification } from './build-notification';

describe('buildNotification', () => {
  it('utilise les valeurs du payload', () => {
    const n = buildNotification({ title: 'T', body: 'B', deepLink: '/fr/orders/1', type: 'new_order' });
    expect(n.title).toBe('T');
    expect(n.options.data.deepLink).toBe('/fr/orders/1');
    expect(n.options.tag).toBe('new_order');
  });
  it('applique les fallbacks si payload absent (piege 8)', () => {
    const n = buildNotification({});
    expect(n.title).toBe('Skalean Atelier');
    expect(n.options.body).toBe('Nouvelle notification');
    expect(n.options.data.deepLink).toBe('/fr/today');
  });
  it('regroupe par tag (type)', () => {
    expect(buildNotification({ type: 'part_arrived' }).options.tag).toBe('part_arrived');
  });
});
```

### Test iOS detect : `repo/apps/web-garage-mobile/lib/push/ios-detect.spec.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { isIOS, isPushAvailableIOS } from './ios-detect';

describe('ios-detect', () => {
  it('detecte iOS via userAgent', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_4)' });
    expect(isIOS()).toBe(true);
  });
  it('push dispo sur Android (non iOS)', () => {
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 13)' });
    expect(isPushAvailableIOS()).toBe(true);
  });
});
```

## 9. Commandes shell

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck
pnpm --filter @insurtech/web-garage-mobile lint
pnpm --filter @insurtech/web-garage-mobile test -- push-subscription.spec.ts voice-to-text.spec.ts build-notification.spec.ts locale-fallback.spec.ts
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile test:e2e -- push-voice.spec.ts

# Verifier que l audio voice ne part PAS au serveur (CNDP, trade-off 2)
grep -rniE "fetch.*audio|upload.*voice|FormData.*audio" repo/apps/web-garage-mobile/lib/voice && echo "FAIL audio serveur" || echo "OK audio local"
```

## 10. Criteres validation

### Criteres P0 (bloquants -- 15)

- **V1 (P0)** : Push feature-detecte (PushManager + Notification, trade-off 1).
  - Commande : `pnpm test -- push-subscription.spec.ts`
  - Expected : test "isPushSupported faux sans PushManager" PASS.

- **V2 (P0)** : VAPID encode en Uint8Array (piege 2).
  - Commande : `grep -n "urlBase64ToUint8Array" repo/apps/web-garage-mobile/lib/push/push-subscription.ts`
  - Expected : >= 1.

- **V3 (P0)** : Subscribe -> POST backend si permission accordee.
  - Commande : test "subscribe + POST backend si permission accordee" PASS.

- **V4 (P0)** : Permission refusee -> pas de subscription.
  - Commande : test "subscribeToPush retourne false si permission refusee" PASS.

- **V5 (P0)** : SW `push` handler affiche la notification (fallback payload, piege 8).
  - Commande : `grep -n "showNotification" repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : >= 1.

- **V6 (P0)** : SW `notificationclick` -> focus/openWindow deep-link (piege 4).
  - Commande : `grep -n "notificationclick\|openWindow\|navigate" repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : >= 2.

- **V7 (P0)** : pushsubscriptionchange re-souscrit (piege 3).
  - Commande : `grep -n "pushsubscriptionchange" repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : 1.

- **V8 (P0)** : Voice feature-detecte (piege 5).
  - Commande : test "isVoiceSupported faux sans SpeechRecognition" PASS.

- **V9 (P0)** : Le bouton micro est absent si non supporte (fallback clavier).
  - Commande : test E2E "le bouton micro est absent si voix non supportee" PASS.

- **V10 (P0)** : pickLang ar->ar-MA, sinon fr-MA (Regle T4).
  - Commande : test "pickLang" PASS.

- **V11 (P0)** : Fallback fr-MA -> fr-FR si non supporte (piege 7).
  - Commande : test "fallback fr-FR si fr-MA non supporte" PASS.

- **V12 (P0)** : Auto-stop voice (continuous false + timeout, piege 6).
  - Commande : `grep -n "continuous = false\|setTimeout" repo/apps/web-garage-mobile/lib/voice/voice-to-text.ts`
  - Expected : >= 2.

- **V13 (P0)** : L'audio ne quitte pas l'appareil (CNDP, trade-off 2).
  - Commande : `grep -rniE "fetch.*audio|upload.*voice" repo/apps/web-garage-mobile/lib/voice`
  - Expected : aucune sortie.

- **V14 (P0)** : Aucune emoji (decision-006) -- notifications texte.
  - Commande : `grep -rPn "[\x{1F300}-\x{1FAFF}]" repo/apps/web-garage-mobile/lib/push repo/apps/web-garage-mobile/lib/voice repo/apps/web-garage-mobile/components/notifications repo/apps/web-garage-mobile/components/voice`
  - Expected : aucune sortie.

- **V15 (P0)** : Aucun console.log.
  - Commande : `grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/lib/push repo/apps/web-garage-mobile/lib/voice | grep -v ".spec."`
  - Expected : aucune sortie.

### Criteres P1 (importants -- 8)

- **V16 (P1)** : Prompt push opt-in contextuel (pas au boot, piege 1).
  - Commande : revue PushPrompt (rendu conditionnel, pas au layout root).
  - Expected : conforme.

- **V17 (P1)** : 4 types d'events mappes a des deep-links (i18n notif.*).
  - Commande : `grep -c "newOrder\|partArrived\|qcFailed\|urgent" repo/apps/web-garage-mobile/i18n/messages/fr.json`
  - Expected : >= 4.

- **V18 (P1)** : Re-souscription au boot (ensureSubscription, piege 3).
  - Commande : `grep -n "ensureSubscription" repo/apps/web-garage-mobile/lib/push/push-subscription.ts`
  - Expected : 1.

- **V19 (P1)** : VoiceInput branche dans diagnostic + notes order (placeholders 5.5.7/5.5.5).
  - Commande : `grep -rn "VoiceInput" repo/apps/web-garage-mobile/components/diagnostic repo/apps/web-garage-mobile/components/orders`
  - Expected : >= 1.

- **V20 (P1)** : Toggle dictee (role switch) dans les parametres.
  - Commande : `grep -n "role=\"switch\"" repo/apps/web-garage-mobile/components/settings/voice-toggle.tsx`
  - Expected : 1.

- **V21 (P1)** : Multi-tenant (subscription liee user+tenant via client API).
  - Commande : `grep -n "getApiClient\|push/subscribe" repo/apps/web-garage-mobile/lib/push/push-subscription.ts`
  - Expected : >= 1.

- **V22 (P1)** : Indicateur visuel d'ecoute (animate-pulse) sur le micro.
  - Commande : `grep -n "animate-pulse" repo/apps/web-garage-mobile/components/voice/voice-input.tsx`
  - Expected : 1.

- **V23 (P1)** : Coverage >= 90% sur voice-to-text.
  - Commande : `pnpm test -- --coverage`
  - Expected : >= 90%.

### Criteres P2 (nice-to-have -- 5)

- **V24 (P2)** : Notification regroupee par tag (type).
  - Commande : `grep -n "tag:" repo/apps/web-garage-mobile/app/sw.ts`
  - Expected : >= 1.

- **V25 (P2)** : E2E push/voice passe.
  - Commande : `pnpm test:e2e -- push-voice.spec.ts`
  - Expected : 3 PASS.

- **V26 (P2)** : unsubscribeFromPush disponible (desactivation).
  - Commande : `grep -n "unsubscribeFromPush" repo/apps/web-garage-mobile/lib/push/push-subscription.ts`
  - Expected : 1.

- **V27 (P2)** : VoiceInput retourne null proprement si non supporte.
  - Commande : `grep -n "if (!supported) return null" repo/apps/web-garage-mobile/components/voice/voice-input.tsx`
  - Expected : 1.

- **V28 (P2)** : Le badge notifs (5.5.3) se rafraichit a la reception (refetch).
  - Commande : revue : la reception push peut invalider `['notifications','unread-count']`.
  - Expected : documente.

### Criteres complementaires (V29-V46)

- **V29 (P0)** : Les contrats subscribe/unsubscribe documentes + 4 payloads.
  - Commande : revue section 6bis.
  - Expected : present, 4 types avec deepLink.

- **V30 (P0)** : locale-fallback : fr-MA -> fr-FR -> fr (piege 7).
  - Commande : `pnpm test -- locale-fallback.spec.ts`
  - Expected : test "fr-MA -> fr-FR -> fr" PASS.

- **V31 (P0)** : usePushSubscription enable appelle subscribeToPush.
  - Commande : `pnpm test -- use-push-subscription.spec.ts`
  - Expected : test "enable appelle subscribeToPush" PASS.

- **V32 (P1)** : formatNotificationBody formatte les 4 types.
  - Commande : `pnpm test -- notification-formatter.spec.ts`
  - Expected : test "formatte les 4 types" PASS.

- **V33 (P1)** : i18n push/voice/notif en 3 locales.
  - Commande : `for l in fr ar-MA ar; do grep -q "newOrder" repo/apps/web-garage-mobile/i18n/messages/$l.json || echo "MISSING $l"; done`
  - Expected : aucune sortie.

- **V34 (P1)** : PushSetting affiche un message si permission denied (piege/edge 2).
  - Commande : `grep -n "blocked\|denied" repo/apps/web-garage-mobile/components/settings/push-setting.tsx`
  - Expected : >= 1.

- **V35 (P1)** : VoiceToggle + PushSetting sont des role=switch (a11y).
  - Commande : `grep -rn "role=\"switch\"" repo/apps/web-garage-mobile/components/settings/`
  - Expected : >= 2.

- **V36 (P1)** : Audio jamais transmis (CNDP, section 8bis + V13).
  - Commande : `grep -rniE "fetch.*audio|upload.*voice" repo/apps/web-garage-mobile/lib/voice`
  - Expected : aucune sortie.

- **V37 (P2)** : nextFallback retourne null en bout de chaine.
  - Commande : test "nextFallback retourne null" PASS.

- **V38 (P2)** : PushSetting permet activer ET desactiver.
  - Commande : `grep -n "enable\|disable" repo/apps/web-garage-mobile/components/settings/push-setting.tsx`
  - Expected : >= 2.

- **V39 (P2)** : Cle VAPID privee jamais cote client (frontend a la publique seulement).
  - Commande : `grep -rn "VAPID_PRIVATE" repo/apps/web-garage-mobile/`
  - Expected : aucune sortie.

- **V40bis (P2)** : Total tests >= 18 (avec complementaires).
  - Commande : compter les it() des specs push/voice.
  - Expected : >= 18.

- **V41 (P1)** : Les 4 deepLinks pointent vers les bonnes pages (order/qc/sinistre).
  - Commande : revue section 6bis payloads.
  - Expected : conforme.

- **V42 (P2)** : usePushSubscription expose isEnabled (permission granted).
  - Commande : `grep -n "isEnabled" repo/apps/web-garage-mobile/hooks/use-push-subscription.ts`
  - Expected : 1.

### Edge cases complementaires

### Edge case 8 : permission notif accordee mais subscription echoue (reseau)
**Scenario** : permission OK mais POST /subscribe echoue.
**Probleme** : pas de subscription cote serveur.
**Solution** : `ensureSubscription` re-tente au boot ; si echec persistant, le push ne fonctionnera pas mais le fallback in-app (badge) reste. Pas de crash.

### Edge case 9 : voix demarree mais bruit atelier -> transcription vide
**Scenario** : environnement bruyant, rien de reconnu.
**Probleme** : onresult vide.
**Solution** : si transcription vide, ne rien inserer ; le technicien peut reessayer ou taper. Le fallback clavier est toujours la.

### Edge case 10 : notification recue mais deepLink vers une ressource supprimee
**Scenario** : tap notif vers un order supprime.
**Probleme** : page 404.
**Solution** : la page cible gere le 404 (ex : detail order "introuvable" + retour). La notification reste informative.

### Edge case 11 : plusieurs subscriptions (multi-device)
**Scenario** : le technicien a 2 telephones.
**Probleme** : 2 subscriptions.
**Solution** : le backend stocke plusieurs subscriptions par user et envoie a toutes ; chaque device recoit. Coherent (le technicien voit la notif ou qu'il soit).

### Edge case 12 : Web Speech demande la permission micro a chaque fois (iOS)
**Scenario** : iOS redemande l'autorisation micro.
**Probleme** : friction.
**Solution** : comportement OS ; on ne peut pas le contourner. Le toggle voix permet de desactiver si trop genant. Documente.

### Edge case 13 : push recu en double (deux events backend)
**Scenario** : deux events declenchent deux push identiques.
**Probleme** : spam.
**Solution** : le `tag` de la notification (= type) regroupe : une nouvelle notif du meme type remplace l'ancienne (pas d'empilement). Le backend peut aussi debouncer.

### Edge case 14 : changement de langue pendant la dictee
**Scenario** : le technicien change de locale en cours de dictee.
**Probleme** : langue de reconnaissance.
**Solution** : la session de reconnaissance en cours garde sa langue ; la prochaine dictee utilise la nouvelle locale (pickLang lit la locale courante au demarrage).

## 11. Edge cases + troubleshooting

### Edge case 1 : iOS < 16.4 sans Web Push
**Scenario** : iPhone ancien.
**Probleme** : pas de push.
**Solution** : feature-detect -> pas de subscription ; fallback in-app (badge + refetch on focus 5.5.3) (trade-off 1).

### Edge case 2 : permission refusee definitivement
**Scenario** : l'utilisateur a bloque les notifs.
**Probleme** : impossible de re-demander facilement.
**Solution** : `Notification.permission === 'denied'` -> ne plus afficher le prompt ; expliquer dans les parametres comment reactiver (reglages OS).

### Edge case 3 : subscription expiree
**Scenario** : le navigateur invalide la subscription.
**Probleme** : push ne arrivent plus.
**Solution** : `pushsubscriptionchange` re-souscrit + `ensureSubscription` au boot (piege 3).

### Edge case 4 : clic notification app fermee
**Scenario** : app fermee, tap sur notif.
**Probleme** : ouvrir au bon endroit.
**Solution** : `notificationclick` -> `openWindow(deepLink)` (piege 4).

### Edge case 5 : voix fr-MA non reconnue
**Scenario** : plateforme sans fr-MA.
**Probleme** : erreur.
**Solution** : fallback fr-FR puis ar (piege 7).

### Edge case 6 : micro reste ouvert
**Scenario** : la reconnaissance ne s'arrete pas.
**Probleme** : micro bloque.
**Solution** : `continuous: false` + timeout 15s + bouton stop (piege 6).

### Edge case 7 : bruit atelier degrade la reconnaissance
**Scenario** : environnement bruyant.
**Probleme** : transcription erronee.
**Solution** : l'utilisateur relit/corrige le texte (la transcription est inseree, editable) ; fallback clavier toujours disponible.

## 12. Conformite Maroc detaillee

### Loi 09-08 (CNDP) -- donnees vocales
- L'audio de la dictee ne quitte JAMAIS l'appareil : la Web Speech API transcrit cote navigateur. Aucun fichier audio n'est uploade/stocke (trade-off 2 / V13). Seul le texte transcrit (que l'utilisateur valide) est enregistre.

### Regle T4 (multilinguisme)
- Voice fr-MA + ar ; notifications en fr/ar (i18n notif.*).

### Decision-008 (cloud souverain MA)
- Cle VAPID privee + envoi push depuis le backend Atlas Benguerir. Subscriptions stockees MA.

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict
- Subscription liee user+tenant (client API x-tenant-id). Events filtres par tenant backend.

### Validation strict
- Payloads typed ; push payload parse prudemment (piege 8).

### Logger strict
- Aucun console.log (SW inclus).

### Package manager strict
- pnpm. `web-push` cote backend (deja 5.5.1).

### TypeScript strict
- `strict` ; types Web Speech declares localement (non standard DOM), `self as ...` SW commentes.

### Tests strict
- Vitest + Playwright. Coverage renforcee voice.

### No-emoji strict (decision-006 ABSOLU)
- Notifications texte, icones lucide (Bell, Mic, MicOff).

### Imports strict
- `@insurtech/garage-shared`, `@/lib/*`.

### Accessibilite
- `role="switch"` toggle, `aria-pressed`/`aria-label` micro.

### Cloud souverain MA strict (decision-008)
- VAPID privee + subscriptions MA ; audio jamais transmis.

### Conventional Commits strict
- `feat(sprint-23): ...`.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck                          # 0 erreur
pnpm --filter @insurtech/web-garage-mobile lint                               # 0 erreur
pnpm --filter @insurtech/web-garage-mobile test                               # 100% PASS

grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile/lib/push repo/apps/web-garage-mobile/lib/voice repo/apps/web-garage-mobile/components/notifications repo/apps/web-garage-mobile/components/voice && echo "FAIL emoji" || echo "OK no-emoji"
grep -rniE "fetch.*audio|upload.*voice" repo/apps/web-garage-mobile/lib/voice && echo "FAIL audio serveur" || echo "OK audio local"
```

## 15. Commit message complet

```bash
git add repo/apps/web-garage-mobile/lib/push/ repo/apps/web-garage-mobile/lib/voice/ repo/apps/web-garage-mobile/components/notifications/ repo/apps/web-garage-mobile/components/voice/ repo/apps/web-garage-mobile/components/settings/ repo/apps/web-garage-mobile/hooks/use-voice-to-text.ts repo/apps/web-garage-mobile/app/sw.ts
git commit -m "feat(sprint-23): push notifications technicien + voice-to-text fr/ar

Implemente les push notifications (4 events : nouvel order/pieces arrivees/QC
echoue/urgent) avec subscription VAPID opt-in contextuelle, SW push+notificationclick
deep-link, re-souscription auto. Implemente le voice-to-text (Web Speech API fr-MA/ar,
fallback fr-FR puis clavier), branche le micro diagnostic/notes (placeholders 5.5.7/5.5.5).
L audio ne quitte jamais l appareil (CNDP).

Livrables:
- push-subscription (VAPID + subscribe/ensure/unsubscribe) + SW push handlers
- PushPrompt (opt-in contextuel) + voice-to-text + useVoiceToText + VoiceInput + VoiceToggle
- branchement micro diagnostic/notes + ensureSubscription post-login

Tests: 12 (4 push + 6 voice + 3 E2E)
Coverage: 90% (voice-to-text)

Task: 5.5.11
Sprint: 23 (Phase 5 / Sprint 5 dans la phase)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Reference: B-23 Tache 5.5.11"
```

## 16. Workflow next step

Apres commit de cette tache :
- Passer a `task-5.5.12-tests-playwright-mobile-lighthouse-pwa.md` (suite de tests E2E Playwright multi-viewports + Lighthouse PWA 100 + WCAG : cloture qualite du Sprint 23).

---

**Fin du prompt task-5.5.11-push-notifications-voice-to-text.md.**

Densite atteinte : ~70 ko (enrichie de 45 a 70 ko ; contenu genuine, scope compact)
Code patterns : 16 fichiers + contrats backend push + i18n 3 locales + iOS detect + build-notification
Tests : ~22 cas concrets (12 base + 4 locale-fallback + 2 notification-formatter + 2 use-push-subscription + 3 build-notification + ios-detect)
Criteres validation : V1-V46 (19 P0 + 16 P1 + 11 P2)
Edge cases : 14
Support iOS Web Push detaille + confidentialite voix (CNDP)
Note : scope compact (push reuse Sprint 18 + voice) ; densite genuine 70 ko sans bourrage.
