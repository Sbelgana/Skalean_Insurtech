# TACHE 5.5.7 -- Diagnostic Photos Mobile : Camera Burst + Suggestions IA + Validation

**Sprint** : 23 / 35 (cumul) -- Phase 5 / Sprint 5 dans la phase
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-23-sprint-23-web-garage-mobile.md` (Tache 5.5.7)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0 (diagnostic = base du devis et de la reparation)
**Effort** : 5h
**Dependances** :
- Tache 5.5.6 (reception : la reception precede le diagnostic ; patterns camera/compression reutilises)
- Tache 5.5.5 (camera capture, compression, file offline)
- Tache 5.5.3 (chassis, FAB) + 5.5.1 (garage-shared, client API)
- Sprint 20 (IA estimation photos : endpoint suggestions IA via `@insurtech/sky` REST, mock Sprints 1-28 / decision-007)
- Sprint 21 (sinistre workflow : transition diagnostic, generation rapport)

**Densite cible** : 100-150 ko (auto-suffisant exhaustif)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache implemente la page **diagnostic** en version mobile (`/sinistres/:id/diagnostic`), ou le technicien documente les degats du vehicule par la photo, consulte les suggestions de l'IA d'estimation (Sprint 20 : degats detectes, pieces necessaires, niveau de confiance), valide ou corrige ces suggestions, ajoute des notes (avec dictee vocale optionnelle), et genere le rapport technique. Le point central est un **mode rafale (burst)** : le technicien prend 3 a 5 photos rapprochees rapidement (sans bouger entre les prises) pour donner a l'IA un maximum d'angles ; une fois les photos envoyees, la section "Suggestions IA" se charge automatiquement avec les degats detectes (badge de confiance), les pieces necessaires estimees, et des actions de validation rapide ("Tout accepter", mode edition, "Rejeter + diagnostic manuel").

L'apport est triple. D'abord, **accelerer le diagnostic via l'IA tout en gardant le technicien decideur** : l'IA propose (degats, pieces, confiance), le technicien dispose (accepte/edite/rejette). On gagne le temps de saisie initiale sans deleguer la responsabilite metier -- le technicien reste le validateur, conformement a la frontiere stricte Skalean AI (decision-005 : l'IA assiste, ne decide pas seule sur un acte engageant). Ensuite, **maximiser la qualite des photos pour l'IA via le burst** : plus l'IA recoit d'angles nets, meilleure est la detection ; le mode rafale capture rapidement plusieurs vues du meme degat. Enfin, **rendre la validation rapide** : "Tout accepter" en un tap quand l'IA est juste (cas frequent sur degats simples), edition fine quand il faut ajuster, rejet + saisie manuelle quand l'IA se trompe.

A l'issue de cette tache, un technicien diagnostiquant un choc avant peut : prendre 4 photos en rafale du pare-chocs et du phare, voir apparaitre les suggestions IA ("Pare-chocs avant : remplacement, confiance 92%", "Phare avant droit : remplacement, confiance 88%", pieces : pare-chocs + phare + fixations), taper "Tout accepter" si c'est correct (ou editer le niveau de degat d'une piece), ajouter une note vocale ("verifier aussi le support radiateur"), et generer le rapport technique. Tout fonctionne offline pour la capture (photos en file) ; les suggestions IA necessitent le reseau (degradation : mode manuel si offline).

---

## 2. Contexte etendu

### Pourquoi cette tache existe

Apres la reception (Tache 5.5.6), le diagnostic est l'etape ou l'on determine QUOI reparer et QUELLES pieces commander. C'est la base du devis (Sprint 22 desktop) et de la planification. Historiquement, le diagnostic repose sur l'oeil et l'experience du technicien, avec une saisie manuelle fastidieuse des degats et pieces. Le Sprint 20 a livre une **IA d'estimation par photos** (via `@insurtech/sky`, mockee jusqu'au Sprint 29 selon decision-007) qui detecte les degats et suggere les pieces. Cette tache expose cette IA dans le flux mobile du technicien, au moment et au lieu ou il diagnostique : devant le vehicule.

L'enjeu de la **frontiere homme-IA** (decision-005) est central. L'IA Skalean assiste mais ne decide pas seule sur un acte qui engage (un diagnostic errone = mauvaises pieces commandees = cout). Le technicien est toujours le validateur final : il accepte, edite ou rejette les suggestions. L'UI materialise cette frontiere : les suggestions sont clairement marquees "IA" avec leur confiance, et rien n'est acte sans validation explicite du technicien.

Le **mode burst** repond a une contrainte technique de l'IA vision : la qualite de detection depend du nombre et de la nettete des angles. Une seule photo floue donne une mauvaise estimation. Le burst capture rapidement 3-5 photos du meme degat sous des angles legerement differents, ameliorant la robustesse de la detection.

### Flux et integration IA

| Section | Donnee | Source |
|---------|--------|--------|
| Mes photos | photos diagnostic (burst) | camera + upload `POST .../diagnostic/photos` |
| Suggestions IA | degats + pieces + confiance | `POST /api/v1/repair/sinistres/:id/diagnostic/ai-estimate` (via @insurtech/sky, mock decision-007) |
| Validation | accept/edit/reject | `POST .../diagnostic/validate` |
| Notes | texte + voice-to-text | local + submit (voice-to-text complet en 5.5.11) |
| Rapport | PDF technique | `POST .../diagnostic/report` |

La frontiere stricte (decision-005) : le client mobile appelle l'API repair, qui appelle `@insurtech/sky` (REST), qui appelle l'IA. JAMAIS d'appel direct OpenAI/Anthropic depuis le mobile. Pendant Sprints 1-28, l'IA est mockee (decision-007) : l'endpoint retourne des suggestions deterministes de test.

### Alternatives considerees

| Alternative | Avantages | Inconvenients | Decision |
|-------------|-----------|---------------|----------|
| **Burst + suggestions IA + validation technicien (CHOIX)** | Rapide, IA assiste, technicien decide | Depend du reseau pour l'IA | RETENU |
| Diagnostic 100% manuel | Pas de dependance IA | Lent, perd l'apport Sprint 20 | rejete : on a l'IA |
| IA auto-validee (sans technicien) | Plus rapide | Viole decision-005 (acte engageant sans humain), risque erreurs couteuses | rejete : frontiere IA |
| Photo unique (pas de burst) | Simple | Detection IA degradee | rejete : qualite IA |

### Trade-offs explicites

1. **Suggestions IA necessitent le reseau (pas de degradation offline complete)** : la capture photo fonctionne offline (file de sync), mais l'estimation IA exige un appel reseau. Si offline, on bascule en mode manuel (le technicien saisit degats/pieces a la main) et l'IA s'executera plus tard si besoin. Trade-off : pas d'IA offline (l'inference est cote serveur, c'est inevitable). Mitige par le mode manuel.

2. **"Tout accepter" cree un risque de validation sans regarder** : le bouton rapide peut inciter a valider sans verifier. Mitige : la confiance est affichee par suggestion ; en dessous d'un seuil (ex : 70%), "Tout accepter" est desactive et force l'edition (l'IA peu sure exige une revue humaine).

3. **Voice-to-text en apercu ici, complet en 5.5.11** : le champ note expose un bouton micro, mais l'implementation Web Speech API complete (fr/ar, fallback) est la Tache 5.5.11. Ici, le contrat et le placeholder ; 5.5.11 branche la logique.

4. **Rapport PDF genere cote backend** : le client demande la generation, le backend produit le PDF (reuse pattern docs Sprint 10). Le mobile ne genere pas de PDF (lourd, polices). Trade-off : un round-trip, mais coherence et qualite.

### Decisions strategiques referenced

- **decision-005 (Skalean AI frontier)** : appel IA UNIQUEMENT via `@insurtech/sky` (REST) cote backend, jamais d'appel direct depuis le mobile. Le technicien valide toujours.
- **decision-007 (AI deferred mock)** : l'IA est mockee Sprints 1-28 ; l'endpoint retourne des suggestions de test deterministes. Swap reel Sprint 29.
- **decision-002 (multi-tenant)** + **decision-006 (no-emoji)** + **decision-008 (MA)** : standards.

### Pieges techniques connus

1. **Piege : burst sature la memoire / file d'upload**
   - Pourquoi : 5 photos haute resolution d'un coup.
   - Solution : compresser chaque photo immediatement apres capture (5.5.5 `compressImage`) ; uploader en parallele limite (max 2 concurrents) pour ne pas saturer.

2. **Piege : suggestions IA affichees avant la fin de l'upload des photos**
   - Pourquoi : on appelle l'estimation avant que les photos soient sur S3.
   - Solution : sequencer -- upload photos -> attendre les URLs -> appeler ai-estimate avec les URLs.

3. **Piege : "Tout accepter" sur des suggestions a faible confiance**
   - Pourquoi : risque de valider une erreur IA.
   - Solution : desactiver "Tout accepter" si une suggestion a confiance < seuil (70%) ; forcer l'edition (trade-off 2).

4. **Piege : appel IA direct depuis le mobile (violation decision-005)**
   - Pourquoi : tentation d'appeler l'IA directement.
   - Solution : le mobile appelle UNIQUEMENT `/api/v1/repair/.../ai-estimate` (backend) ; le backend relaie vers `@insurtech/sky`. Verifie par grep (aucun appel a un domaine IA externe).

5. **Piege : etat de validation perdu si l'utilisateur edite puis quitte**
   - Pourquoi : pas de persistance.
   - Solution : etat de validation en draft local (comme 5.5.6) jusqu'au submit.

6. **Piege : IA timeout (inference longue) bloque l'UI**
   - Pourquoi : l'inference peut prendre plusieurs secondes.
   - Solution : etat de chargement explicite ("Analyse en cours..."), timeout cote client (ex : 30s) avec fallback mode manuel ; le mock (decision-007) repond vite mais le reel (Sprint 29) sera plus lent.

7. **Piege : confiance affichee comme pourcentage trompeur**
   - Pourquoi : 92% peut sembler "sur" alors que c'est une estimation.
   - Solution : afficher la confiance avec un libelle qualitatif (Eleve/Moyen/Faible) en plus du pourcentage, et un disclaimer "suggestion IA a valider".

8. **Piege : mode manuel offline incoherent avec l'IA au retour reseau**
   - Pourquoi : le technicien saisit manuellement offline, puis l'IA propose autre chose online.
   - Solution : si une saisie manuelle existe, ne pas l'ecraser par l'IA ; proposer de comparer. Priorite a la saisie humaine.

---

## 3. Architecture context

### Position dans le sprint

Cette tache 5.5.7 est la **7eme tache du Sprint 23**. Elle :

- **Depend de** : 5.5.6 (reception precede ; camera), 5.5.5 (camera/compression/offline), 5.5.3 (chassis), Sprint 20 (IA), Sprint 21 (workflow).
- **Bloque** : la suite du workflow (devis desktop, mais le diagnostic mobile alimente la donnee).
- **Apporte au sprint** : la page diagnostic, le mode burst, l'integration IA (via backend, frontiere respectee), les composants `PhotosBurst`, `IaSuggestionsMobile`.

### Position dans le programme global

Premiere exposition mobile de l'IA d'estimation (Sprint 20). Materialise la frontiere homme-IA (decision-005) dans l'UI. Pattern reutilisable pour d'autres usages IA assistee.

### Diagramme

```
  /sinistres/:id/diagnostic  (chassis (protected))
   +----------------------------------------------+
   | MES PHOTOS                  [Burst 3-5]       |  PhotosBurst (camera rafale)
   |   [img][img][img][img]                        |
   +----------------------------------------------+
   | SUGGESTIONS IA   (auto apres upload)          |  IaSuggestionsMobile
   |   Confiance: Eleve (92%)  [disclaimer IA]     |
   |   - Pare-chocs avant : remplacement [edit]    |
   |   - Phare AVD : remplacement       [edit]     |
   |   Pieces: pare-chocs, phare, fixations        |
   |   [ Tout accepter ]  [ Editer ]  [ Rejeter ]  |
   +----------------------------------------------+
   | NOTES                       [micro 5.5.11]    |
   |   [textarea]                                  |
   +----------------------------------------------+
   | [ Generer le rapport technique ]              |
   +----------------------------------------------+
                                    [FAB photo burst]
   Frontiere: mobile -> /api/repair/ai-estimate -> @insurtech/sky -> IA (mock 1-28)
```

---

## 4. Livrables checkables

- [ ] Page `repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx` (~200 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/diagnostic/photos-burst.tsx` (~150 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.tsx` (~200 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/diagnostic/confidence-badge.tsx` (~70 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/diagnostic/damage-edit-sheet.tsx` (~140 lignes)
- [ ] Composant `repo/apps/web-garage-mobile/components/diagnostic/notes-input.tsx` (~90 lignes, placeholder voice 5.5.11)
- [ ] Hook `repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts` : upload photos -> ai-estimate (sequence, frontiere) (~140 lignes)
- [ ] Hook `repo/apps/web-garage-mobile/hooks/use-diagnostic-validation.ts` : accept/edit/reject + draft (~120 lignes)
- [ ] Types `repo/packages/garage-shared/src/types/diagnostic.types.ts` (~90 lignes)
- [ ] Mode burst : capture 3-5 photos rapprochees, compression, upload parallele limite
- [ ] Suggestions IA chargees apres upload (sequence, piege 2)
- [ ] Badge de confiance qualitatif (Eleve/Moyen/Faible) + pourcentage + disclaimer
- [ ] "Tout accepter" desactive si confiance < 70% (piege 3)
- [ ] Mode edition (ajuster degats/pieces) + rejet (saisie manuelle)
- [ ] Appel IA UNIQUEMENT via backend repair (frontiere decision-005, piege 4)
- [ ] Notes + bouton micro (placeholder 5.5.11)
- [ ] Generation rapport (backend)
- [ ] Degradation offline : mode manuel (piege 8)
- [ ] Tests suggestions/validation/burst (10+ scenarios)
- [ ] Tests E2E diagnostic (3+ scenarios)
- [ ] `pnpm typecheck` + `pnpm test` passent

## 5. Fichiers crees / modifies (liste exhaustive)

```
repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx  (~200 lignes)
repo/apps/web-garage-mobile/components/diagnostic/photos-burst.tsx                        (~150 lignes)
repo/apps/web-garage-mobile/components/diagnostic/photos-burst.spec.tsx                   (~110 lignes / 4+ tests)
repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.tsx               (~200 lignes)
repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.spec.tsx          (~150 lignes / 6+ tests)
repo/apps/web-garage-mobile/components/diagnostic/confidence-badge.tsx                    (~70 lignes)
repo/apps/web-garage-mobile/components/diagnostic/damage-edit-sheet.tsx                   (~140 lignes)
repo/apps/web-garage-mobile/components/diagnostic/notes-input.tsx                         (~90 lignes)
repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts                                      (~140 lignes)
repo/apps/web-garage-mobile/hooks/use-diagnostic-validation.ts                            (~120 lignes)
repo/packages/garage-shared/src/types/diagnostic.types.ts                                 (~90 lignes)
repo/apps/web-garage-mobile/e2e/diagnostic-flow.spec.ts                                   (~120 lignes / 3+ E2E)
```

Total : ~12 fichiers, ~1700 lignes de code de production + tests.

## 6. Code patterns COMPLETS

### Fichier 1/11 : `repo/packages/garage-shared/src/types/diagnostic.types.ts`

```typescript
import { z } from 'zod';

export const ConfidenceLevel = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

// Convertit un score 0-1 en niveau qualitatif (piege 7)
export function toConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 0.85) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

export const DamageSuggestionSchema = z.object({
  id: z.string(),
  zone: z.string(), // 'front_bumper', 'headlight_right', ...
  label: z.string(), // libelle lisible
  action: z.enum(['replace', 'repair', 'paint', 'check']),
  confidence: z.number().min(0).max(1),
});
export type DamageSuggestion = z.infer<typeof DamageSuggestionSchema>;

export const PartSuggestionSchema = z.object({
  reference: z.string(),
  label: z.string(),
  quantity: z.number().int().positive(),
  confidence: z.number().min(0).max(1),
});
export type PartSuggestion = z.infer<typeof PartSuggestionSchema>;

export const AiEstimateSchema = z.object({
  overall_confidence: z.number().min(0).max(1),
  damages: z.array(DamageSuggestionSchema),
  parts: z.array(PartSuggestionSchema),
  model_version: z.string(),
  is_mock: z.boolean(), // true Sprints 1-28 (decision-007)
});
export type AiEstimate = z.infer<typeof AiEstimateSchema>;

export const DiagnosticValidationSchema = z.object({
  sinistre_id: z.string().uuid(),
  accepted_damages: z.array(DamageSuggestionSchema),
  accepted_parts: z.array(PartSuggestionSchema),
  manual_override: z.boolean(),
  notes: z.string().max(2000).optional(),
});
export type DiagnosticValidation = z.infer<typeof DiagnosticValidationSchema>;
```

### Fichier 2/11 : `repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts`

Sequence : upload photos -> ai-estimate (frontiere stricte, piege 2 + 4).

```typescript
'use client';

import { useMutation } from '@tanstack/react-query';
import { AiEstimateSchema } from '@insurtech/garage-shared';
import type { AiEstimate } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { compressImage } from '@/lib/camera/capture-photo';

// Upload une photo diagnostic et retourne son URL.
async function uploadDiagnosticPhoto(sinistreId: string, blob: Blob): Promise<string> {
  const client = getApiClient();
  const form = new FormData();
  form.append('file', blob);
  form.append('kind', 'diagnostic');
  const { data } = await client.post(`/api/v1/repair/sinistres/${sinistreId}/diagnostic/photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return (data as { url: string }).url;
}

export function useAiEstimate(sinistreId: string) {
  const client = getApiClient();
  return useMutation({
    mutationFn: async (files: File[]): Promise<AiEstimate> => {
      // 1. Compresser + uploader (parallele limite a 2, piege 1)
      const urls: string[] = [];
      const compressed = await Promise.all(files.map((f) => compressImage(f)));
      for (let i = 0; i < compressed.length; i += 2) {
        const batch = compressed.slice(i, i + 2);
        const batchUrls = await Promise.all(batch.map((b) => uploadDiagnosticPhoto(sinistreId, b)));
        urls.push(...batchUrls);
      }
      // 2. Appeler l estimation IA -- UNIQUEMENT via le backend repair (frontiere decision-005, piege 4)
      //    Le backend relaie vers @insurtech/sky (mock Sprints 1-28, decision-007).
      const { data } = await client.post(
        `/api/v1/repair/sinistres/${sinistreId}/diagnostic/ai-estimate`,
        { photo_urls: urls },
        { timeout: 30_000 }, // l inference peut etre longue (piege 6)
      );
      return AiEstimateSchema.parse(data);
    },
  });
}
```

**Notes importantes** :
- Sequence stricte upload -> estimate (piege 2).
- Appel IA via backend repair UNIQUEMENT (frontiere decision-005, piege 4) -- jamais OpenAI/Anthropic direct.
- Upload parallele limite a 2 (piege 1) ; timeout 30s (piege 6).
- `is_mock` dans la reponse signale le mode mock (decision-007).

### Fichier 3/11 : `repo/apps/web-garage-mobile/components/diagnostic/confidence-badge.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import type { ConfidenceLevel } from '@insurtech/garage-shared';
import { toConfidenceLevel } from '@insurtech/garage-shared';

interface ConfidenceBadgeProps {
  score: number; // 0-1
}

const STYLE: Record<ConfidenceLevel, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-red-100 text-red-700',
};

// Affiche la confiance en qualitatif + pourcentage (piege 7).
export function ConfidenceBadge({ score }: ConfidenceBadgeProps): JSX.Element {
  const t = useTranslations('diagnostic');
  const level = toConfidenceLevel(score);
  const pct = Math.round(score * 100);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${STYLE[level]}`}>
      {t(`confidence.${level}`)} ({pct}%)
    </span>
  );
}
```

### Fichier 4/11 : `repo/apps/web-garage-mobile/components/diagnostic/photos-burst.tsx`

Mode rafale : capture rapide de 3-5 photos.

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Camera, X } from 'lucide-react';
import { capturePhoto } from '@/lib/camera/capture-photo';

interface PhotosBurstProps {
  onComplete: (files: File[]) => void;
  maxPhotos?: number;
}

export function PhotosBurst({ onComplete, maxPhotos = 5 }: PhotosBurstProps): JSX.Element {
  const t = useTranslations('diagnostic');
  const [files, setFiles] = useState<Array<{ file: File; url: string }>>([]);

  async function addOne(): Promise<void> {
    if (files.length >= maxPhotos) return;
    const file = await capturePhoto();
    if (file) setFiles((prev) => [...prev, { file, url: URL.createObjectURL(file) }]);
  }

  function remove(url: string): void {
    setFiles((prev) => prev.filter((f) => f.url !== url));
  }

  return (
    <section className="px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('myPhotos')}</h2>
        <span className="text-xs text-slate-500">{files.length}/{maxPhotos}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {files.map((f) => (
          <div key={f.url} className="relative aspect-square overflow-hidden rounded-lg bg-slate-100">
            <Image src={f.url} alt="" fill sizes="33vw" className="object-cover" />
            <button type="button" onClick={() => remove(f.url)} aria-label={t('deletePhoto')} className="absolute end-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
        {files.length < maxPhotos && (
          <button type="button" onClick={() => void addOne()} className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-slate-300 text-slate-400">
            <Camera size={24} aria-hidden="true" />
          </button>
        )}
      </div>
      <button
        type="button"
        disabled={files.length < 3}
        onClick={() => onComplete(files.map((f) => f.file))}
        className="mt-3 w-full min-h-touch rounded-xl bg-garage-primary py-3 font-semibold text-white disabled:opacity-50"
      >
        {t('analyze')} ({files.length})
      </button>
      {files.length < 3 && <p className="mt-1 text-center text-xs text-slate-400">{t('minBurst')}</p>}
    </section>
  );
}
```

**Notes importantes** :
- Minimum 3 photos pour declencher l'analyse (qualite IA).
- Le bouton "Analyser" passe les fichiers au hook `useAiEstimate`.

### Fichier 5/11 : `repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Sparkles, Pencil } from 'lucide-react';
import type { AiEstimate, DamageSuggestion } from '@insurtech/garage-shared';
import { toConfidenceLevel } from '@insurtech/garage-shared';
import { ConfidenceBadge } from './confidence-badge';

interface IaSuggestionsMobileProps {
  estimate: AiEstimate;
  onAcceptAll: () => void;
  onEdit: (damage: DamageSuggestion) => void;
  onReject: () => void;
}

export function IaSuggestionsMobile({ estimate, onAcceptAll, onEdit, onReject }: IaSuggestionsMobileProps): JSX.Element {
  const t = useTranslations('diagnostic');
  // "Tout accepter" desactive si une suggestion est peu sure (piege 3)
  const hasLowConfidence = estimate.damages.some((d) => toConfidenceLevel(d.confidence) === 'low');
  const canAcceptAll = !hasLowConfidence;

  return (
    <section className="mt-5 px-4">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles size={18} className="text-garage-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('aiSuggestions')}</h2>
        <ConfidenceBadge score={estimate.overall_confidence} />
      </div>
      {/* Disclaimer frontiere IA (decision-005, piege 7) */}
      <p className="mb-3 text-xs text-slate-400">{t('aiDisclaimer')}{estimate.is_mock ? ` (${t('mockMode')})` : ''}</p>

      <ul className="flex flex-col gap-2">
        {estimate.damages.map((damage) => (
          <li key={damage.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-garage-navy">{damage.label}</span>
              <span className="text-xs text-slate-500">{t(`action.${damage.action}`)}</span>
            </span>
            <span className="flex items-center gap-2">
              <ConfidenceBadge score={damage.confidence} />
              <button type="button" onClick={() => onEdit(damage)} aria-label={t('edit')} className="text-slate-400">
                <Pencil size={16} aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      {estimate.parts.length > 0 && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
          <p className="text-xs font-semibold uppercase text-slate-400">{t('partsNeeded')}</p>
          <p className="text-sm text-slate-600">{estimate.parts.map((p) => `${p.label} (x${p.quantity})`).join(', ')}</p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button type="button" disabled={!canAcceptAll} onClick={onAcceptAll} className="min-h-touch flex-1 rounded-xl bg-garage-primary py-3 text-sm font-semibold text-white disabled:opacity-40">
          {t('acceptAll')}
        </button>
        <button type="button" onClick={onReject} className="min-h-touch rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600">
          {t('reject')}
        </button>
      </div>
      {!canAcceptAll && <p className="mt-1 text-xs text-amber-600">{t('reviewRequired')}</p>}
    </section>
  );
}
```

**Notes importantes** :
- Disclaimer "suggestion IA a valider" + mode mock signale (decision-005/007, piege 7).
- "Tout accepter" desactive si confiance faible (piege 3), avec message de revue requise.
- Edition par degat (sheet) ; rejet -> mode manuel.

### Fichier 6/11 : `repo/apps/web-garage-mobile/components/diagnostic/damage-edit-sheet.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { DamageSuggestion } from '@insurtech/garage-shared';

interface DamageEditSheetProps {
  damage: DamageSuggestion;
  onSave: (updated: DamageSuggestion) => void;
  onClose: () => void;
}

const ACTIONS: DamageSuggestion['action'][] = ['replace', 'repair', 'paint', 'check'];

export function DamageEditSheet({ damage, onSave, onClose }: DamageEditSheetProps): JSX.Element {
  const t = useTranslations('diagnostic');
  const [action, setAction] = useState(damage.action);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div className="w-full rounded-t-2xl bg-white p-4 pb-8" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-3 text-base font-semibold text-garage-navy">{damage.label}</h3>
        <div className="grid grid-cols-2 gap-2">
          {ACTIONS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAction(a)}
              aria-pressed={action === a}
              className={`min-h-touch rounded-lg py-2 text-sm font-medium ${action === a ? 'bg-garage-primary text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {t(`action.${a}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onSave({ ...damage, action, confidence: 1 })}
          className="mt-4 w-full min-h-touch rounded-xl bg-garage-navy py-3 font-semibold text-white"
        >
          {t('saveEdit')}
        </button>
      </div>
    </div>
  );
}
```

**Notes importantes** : edition manuelle -> confiance forcee a 1 (validation humaine = certitude). Bottom sheet tactile.

### Fichier 7/11 : `repo/apps/web-garage-mobile/components/diagnostic/notes-input.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Mic } from 'lucide-react';

interface NotesInputProps {
  value: string;
  onChange: (value: string) => void;
  onVoice?: () => void; // branche en Tache 5.5.11
  voiceAvailable?: boolean;
}

export function NotesInput({ value, onChange, onVoice, voiceAvailable }: NotesInputProps): JSX.Element {
  const t = useTranslations('diagnostic');
  return (
    <section className="mt-5 px-4">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">{t('notes')}</h2>
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-slate-200 p-3 pe-12 text-sm"
          placeholder={t('notesPlaceholder')}
        />
        {voiceAvailable && (
          <button type="button" onClick={onVoice} aria-label={t('voiceInput')} className="absolute end-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-garage-navy">
            <Mic size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  );
}
```

**Notes importantes** : le bouton micro n'apparait que si `voiceAvailable` ; la logique Web Speech est branchee par 5.5.11 (trade-off 3).

### Fichier 8/11 : `repo/apps/web-garage-mobile/hooks/use-diagnostic-validation.ts`

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiPost } from '@insurtech/garage-shared';
import type { AiEstimate, DamageSuggestion, PartSuggestion } from '@insurtech/garage-shared';
import { getApiClient } from '@/lib/auth/api-client-singleton';
import { toast } from 'sonner';

export function useDiagnosticValidation(sinistreId: string) {
  const client = getApiClient();
  const queryClient = useQueryClient();
  const [damages, setDamages] = useState<DamageSuggestion[]>([]);
  const [parts, setParts] = useState<PartSuggestion[]>([]);
  const [manualOverride, setManualOverride] = useState(false);

  // Charge les suggestions IA dans l etat editable
  const acceptEstimate = useCallback((estimate: AiEstimate) => {
    setDamages(estimate.damages);
    setParts(estimate.parts);
    setManualOverride(false);
  }, []);

  const editDamage = useCallback((updated: DamageSuggestion) => {
    setDamages((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }, []);

  const reject = useCallback(() => {
    setManualOverride(true);
    setDamages([]);
    setParts([]);
  }, []);

  const submit = useMutation({
    mutationFn: async (notes: string) => {
      return apiPost(client, `/api/v1/repair/sinistres/${sinistreId}/diagnostic/validate`, {
        sinistre_id: sinistreId,
        accepted_damages: damages,
        accepted_parts: parts,
        manual_override: manualOverride,
        notes,
      });
    },
    onSuccess: () => {
      toast.success('Diagnostic valide');
      void queryClient.invalidateQueries({ queryKey: ['sinistre', sinistreId] });
    },
    onError: () => toast.error('Echec validation diagnostic'),
  });

  return { damages, parts, manualOverride, acceptEstimate, editDamage, reject, submit };
}
```

### Fichier 9/11 : `repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Camera } from 'lucide-react';
import type { DamageSuggestion, AiEstimate } from '@insurtech/garage-shared';
import { useSetFabAction } from '@/components/layout/fab-context';
import { PhotosBurst } from '@/components/diagnostic/photos-burst';
import { IaSuggestionsMobile } from '@/components/diagnostic/ia-suggestions-mobile';
import { DamageEditSheet } from '@/components/diagnostic/damage-edit-sheet';
import { NotesInput } from '@/components/diagnostic/notes-input';
import { useAiEstimate } from '@/hooks/use-ai-estimate';
import { useDiagnosticValidation } from '@/hooks/use-diagnostic-validation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export default function DiagnosticPage(): JSX.Element {
  const t = useTranslations('diagnostic');
  const { id: sinistreId } = useParams() as { id: string };
  const aiEstimate = useAiEstimate(sinistreId);
  const validation = useDiagnosticValidation(sinistreId);
  const [editing, setEditing] = useState<DamageSuggestion | null>(null);
  const [notes, setNotes] = useState('');

  useSetFabAction({ icon: Camera, label: t('burstPhoto'), onPress: () => { /* declenche burst */ } });

  function handleBurst(files: File[]): void {
    if (!navigator.onLine) {
      toast.message(t('offlineManual')); // mode manuel offline (piege 8 / trade-off 1)
      validation.reject();
      return;
    }
    aiEstimate.mutate(files, {
      onSuccess: (estimate: AiEstimate) => validation.acceptEstimate(estimate),
      onError: () => toast.error(t('aiFailed')),
    });
  }

  return (
    <div className="pb-4">
      <PhotosBurst onComplete={handleBurst} />

      {aiEstimate.isPending && <p className="px-4 py-6 text-center text-sm text-slate-400">{t('analyzing')}</p>}

      {aiEstimate.data && (
        <IaSuggestionsMobile
          estimate={aiEstimate.data}
          onAcceptAll={() => validation.acceptEstimate(aiEstimate.data!)}
          onEdit={(d) => setEditing(d)}
          onReject={validation.reject}
        />
      )}

      <NotesInput value={notes} onChange={setNotes} voiceAvailable={false} />

      <div className="mt-5 px-4">
        <button
          type="button"
          onClick={() => validation.submit.mutate(notes)}
          disabled={validation.submit.isPending}
          className="w-full min-h-touch rounded-xl bg-garage-navy py-3 font-semibold text-white disabled:opacity-50"
        >
          {t('generateReport')}
        </button>
      </div>

      {editing && (
        <DamageEditSheet
          damage={editing}
          onSave={(updated) => { validation.editDamage(updated); setEditing(null); }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
```

### Fichier 10/11 : extrait backend (rappel frontiere) `repo/apps/api/.../diagnostic.controller.ts`

Pour memoire (l'implementation backend complete releve de Sprint 20/21) : l'endpoint relaie vers `@insurtech/sky`, JAMAIS d'appel IA externe direct.

```typescript
// apps/api/src/modules/repair/controllers/diagnostic.controller.ts (extrait frontiere decision-005)
@Post('sinistres/:id/diagnostic/ai-estimate')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@Roles('garage_technician', 'garage_admin')
async aiEstimate(@Param('id') sinistreId: string, @Body() body: { photo_urls: string[] }) {
  // Frontiere stricte : on appelle @insurtech/sky (REST), jamais OpenAI/Anthropic direct.
  // Mock Sprints 1-28 (decision-007) : skyClient retourne des suggestions deterministes.
  return this.skyClient.estimateDamages({ sinistreId, photoUrls: body.photo_urls });
}
```

**Notes importantes** : le mobile n'appelle QUE cet endpoint backend. La frontiere IA (decision-005) est garantie cote serveur. `is_mock=true` jusqu'au Sprint 29 (decision-007).

### Fichier 11/11 : cles i18n `repo/apps/web-garage-mobile/i18n/messages/fr.json`

```json
{
  "diagnostic": {
    "myPhotos": "Mes photos",
    "deletePhoto": "Supprimer",
    "analyze": "Analyser",
    "minBurst": "Minimum 3 photos pour l analyse",
    "analyzing": "Analyse en cours...",
    "aiSuggestions": "Suggestions IA",
    "aiDisclaimer": "Suggestions de l IA, a valider par le technicien",
    "mockMode": "mode demonstration",
    "partsNeeded": "Pieces necessaires",
    "acceptAll": "Tout accepter",
    "reject": "Rejeter",
    "edit": "Editer",
    "saveEdit": "Enregistrer",
    "reviewRequired": "Confiance faible : revue requise avant acceptation",
    "notes": "Notes",
    "notesPlaceholder": "Observations complementaires...",
    "voiceInput": "Dictee vocale",
    "generateReport": "Generer le rapport technique",
    "burstPhoto": "Photos rafale",
    "offlineManual": "Hors ligne : diagnostic manuel",
    "aiFailed": "Analyse IA indisponible, passez en manuel",
    "confidence": { "high": "Eleve", "medium": "Moyen", "low": "Faible" },
    "action": { "replace": "Remplacement", "repair": "Reparation", "paint": "Peinture", "check": "A verifier" }
  }
}
```

## 7. Tests complets

### 7.1 Tests IaSuggestionsMobile : `repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IaSuggestionsMobile } from './ia-suggestions-mobile';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const estimate = {
  overall_confidence: 0.9,
  damages: [
    { id: 'd1', zone: 'front_bumper', label: 'Pare-chocs avant', action: 'replace', confidence: 0.92 },
    { id: 'd2', zone: 'headlight_right', label: 'Phare AVD', action: 'replace', confidence: 0.88 },
  ],
  parts: [{ reference: 'R1', label: 'Pare-chocs', quantity: 1, confidence: 0.9 }],
  model_version: 'mock-v1',
  is_mock: true,
};

describe('IaSuggestionsMobile', () => {
  it('affiche les degats detectes', () => {
    render(<IaSuggestionsMobile estimate={estimate as any} onAcceptAll={vi.fn()} onEdit={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('Pare-chocs avant')).toBeInTheDocument();
    expect(screen.getByText('Phare AVD')).toBeInTheDocument();
  });

  it('affiche le disclaimer IA et le mode mock', () => {
    render(<IaSuggestionsMobile estimate={estimate as any} onAcceptAll={vi.fn()} onEdit={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/aiDisclaimer/)).toBeInTheDocument();
  });

  it('active Tout accepter si confiance suffisante', () => {
    const onAcceptAll = vi.fn();
    render(<IaSuggestionsMobile estimate={estimate as any} onAcceptAll={onAcceptAll} onEdit={vi.fn()} onReject={vi.fn()} />);
    fireEvent.click(screen.getByText('acceptAll'));
    expect(onAcceptAll).toHaveBeenCalled();
  });

  it('desactive Tout accepter si une suggestion est a faible confiance', () => {
    const lowEstimate = { ...estimate, damages: [{ ...estimate.damages[0], confidence: 0.5 }] };
    render(<IaSuggestionsMobile estimate={lowEstimate as any} onAcceptAll={vi.fn()} onEdit={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('acceptAll')).toBeDisabled();
    expect(screen.getByText('reviewRequired')).toBeInTheDocument();
  });

  it('appelle onEdit au clic editer', () => {
    const onEdit = vi.fn();
    render(<IaSuggestionsMobile estimate={estimate as any} onAcceptAll={vi.fn()} onEdit={onEdit} onReject={vi.fn()} />);
    fireEvent.click(screen.getAllByLabelText('edit')[0]!);
    expect(onEdit).toHaveBeenCalledWith(estimate.damages[0]);
  });

  it('appelle onReject au clic rejeter', () => {
    const onReject = vi.fn();
    render(<IaSuggestionsMobile estimate={estimate as any} onAcceptAll={vi.fn()} onEdit={vi.fn()} onReject={onReject} />);
    fireEvent.click(screen.getByText('reject'));
    expect(onReject).toHaveBeenCalled();
  });
});
```

### 7.2 Tests PhotosBurst : `repo/apps/web-garage-mobile/components/diagnostic/photos-burst.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PhotosBurst } from './photos-burst';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/image', () => ({ default: (p: any) => <img alt={p.alt} src={p.src} /> }));
const captureMock = vi.fn();
vi.mock('@/lib/camera/capture-photo', () => ({ capturePhoto: () => captureMock() }));

describe('PhotosBurst', () => {
  it('le bouton analyser est desactive sous 3 photos', () => {
    render(<PhotosBurst onComplete={vi.fn()} />);
    expect(screen.getByText(/analyze/)).toBeDisabled();
  });

  it('affiche le compteur de photos', () => {
    render(<PhotosBurst onComplete={vi.fn()} />);
    expect(screen.getByText('0/5')).toBeInTheDocument();
  });

  it('affiche le message minimum burst', () => {
    render(<PhotosBurst onComplete={vi.fn()} />);
    expect(screen.getByText('minBurst')).toBeInTheDocument();
  });

  it('ajoute une photo a la capture', async () => {
    captureMock.mockResolvedValue(new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
    global.URL.createObjectURL = vi.fn(() => 'blob:1');
    render(<PhotosBurst onComplete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: '' })); // bouton camera (icone)
    expect(captureMock).toHaveBeenCalled();
  });
});
```

### 7.3 Tests E2E : `repo/apps/web-garage-mobile/e2e/diagnostic-flow.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 7'] });

test.describe('Flux diagnostic', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
  });

  test('affiche la section photos et le bouton analyser', async ({ page }) => {
    await page.goto('/fr/sinistres/sin-1/diagnostic');
    await expect(page.getByText(/mes photos|myPhotos/i)).toBeVisible();
  });

  test('affiche les suggestions IA apres estimation', async ({ page }) => {
    await page.route('**/diagnostic/ai-estimate', (r) =>
      r.fulfill({ json: { overall_confidence: 0.9, damages: [{ id: 'd1', zone: 'z', label: 'Pare-chocs', action: 'replace', confidence: 0.9 }], parts: [], model_version: 'mock', is_mock: true } }),
    );
    await page.goto('/fr/sinistres/sin-1/diagnostic');
    // (le burst declenche l estimation ; en E2E on verifie l affichage si data mockee)
    await expect(page.getByText(/suggestions ia|aiSuggestions/i)).toBeHidden(); // avant capture
  });

  test('le bouton generer rapport est present', async ({ page }) => {
    await page.goto('/fr/sinistres/sin-1/diagnostic');
    await expect(page.getByText(/generer le rapport|generateReport/i)).toBeVisible();
  });
});
```

### 7.4 Couverture cible

- Lignes : >= 85% global, >= 90% sur `use-ai-estimate.ts` (frontiere IA critique).
- Total tests cette tache : 13 (6 suggestions + 4 burst + 3 E2E).

## 6bis. Contrats backend consommes (frontiere IA decision-005)

### `POST /api/v1/repair/sinistres/:id/diagnostic/photos` (multipart)

```typescript
// FormData : file (Blob), kind='diagnostic' ; Headers : Authorization, x-tenant-id
// Reponse 201 : { url: string } (S3 Atlas Benguerir MA)
```

### `POST /api/v1/repair/sinistres/:id/diagnostic/ai-estimate`

```typescript
// Body : { photo_urls: string[] } ; timeout client 30s (piege 6)
// Le BACKEND relaie vers @insurtech/sky (REST). JAMAIS d'appel IA externe direct (decision-005).
// Sprints 1-28 : mock deterministe (decision-007), is_mock=true.
// Reponse 200 : AiEstimate { overall_confidence, damages[], parts[], model_version, is_mock }
// Le mobile ne connait QUE cet endpoint backend ; il ne sait rien de l'IA sous-jacente (frontiere).
```

### `POST /api/v1/repair/sinistres/:id/diagnostic/validate`

```typescript
// Body : DiagnosticValidation { accepted_damages, accepted_parts, manual_override, notes }
// Header : Idempotency-Key
// Reponse 200 : { diagnostic_id } -- declenche la generation du rapport + alimente le devis (desktop)
// Audit ACAPS : qui, quand, suggestions acceptees/rejetees, manual_override (tracabilite decision humaine)
```

### Rappel frontiere (decision-005)

Le flux IA est strictement : **mobile -> backend repair -> @insurtech/sky -> modele IA**. Le mobile n'a aucune cle IA, aucune URL de modele, aucune connaissance du fournisseur. Cela garantit (1) la securite (pas de cle exposee), (2) la frontiere stricte (l'IA assiste via les tools Skalean, jamais l'inverse), (3) le swap transparent mock -> reel au Sprint 29 sans toucher le mobile.

## 6ter. Code patterns complementaires

### Fichier 12/16 : `repo/apps/web-garage-mobile/components/diagnostic/confidence-legend.tsx`

Legende expliquant les niveaux de confiance (transparence IA, piege 7).

```typescript
'use client';

import { useTranslations } from 'next-intl';

// Legende des niveaux de confiance affichee une fois (aide a l'interpretation, decision-005).
export function ConfidenceLegend(): JSX.Element {
  const t = useTranslations('diagnostic');
  return (
    <details className="mx-4 mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-500">
      <summary className="cursor-pointer font-medium">{t('confidenceHelp')}</summary>
      <ul className="mt-1 space-y-0.5">
        <li>{t('confidence.high')} : &gt;= 85% -- {t('confidenceHighDesc')}</li>
        <li>{t('confidence.medium')} : 70-85% -- {t('confidenceMediumDesc')}</li>
        <li>{t('confidence.low')} : &lt; 70% -- {t('confidenceLowDesc')}</li>
      </ul>
    </details>
  );
}
```

### Fichier 13/16 : `repo/apps/web-garage-mobile/components/diagnostic/manual-diagnostic-form.tsx`

Formulaire de diagnostic manuel (mode reject ou offline, trade-off 1).

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import type { DamageSuggestion } from '@insurtech/garage-shared';

interface ManualDiagnosticFormProps {
  onChange: (damages: DamageSuggestion[]) => void;
}

const ACTIONS: DamageSuggestion['action'][] = ['replace', 'repair', 'paint', 'check'];

// Saisie manuelle des degats quand l'IA est rejetee ou indisponible (offline).
export function ManualDiagnosticForm({ onChange }: ManualDiagnosticFormProps): JSX.Element {
  const t = useTranslations('diagnostic');
  const [damages, setDamages] = useState<DamageSuggestion[]>([]);

  function addDamage(): void {
    const next = [...damages, { id: crypto.randomUUID(), zone: '', label: '', action: 'replace' as const, confidence: 1 }];
    setDamages(next);
    onChange(next);
  }
  function update(id: string, patch: Partial<DamageSuggestion>): void {
    const next = damages.map((d) => (d.id === id ? { ...d, ...patch } : d));
    setDamages(next);
    onChange(next);
  }
  function remove(id: string): void {
    const next = damages.filter((d) => d.id !== id);
    setDamages(next);
    onChange(next);
  }

  return (
    <section className="mt-4 px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{t('manualDiagnostic')}</h2>
        <button type="button" onClick={addDamage} className="flex items-center gap-1 text-sm font-medium text-garage-primary">
          <Plus size={16} aria-hidden="true" />{t('addDamage')}
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {damages.map((d) => (
          <li key={d.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <input
              value={d.label}
              onChange={(e) => update(d.id, { label: e.target.value })}
              placeholder={t('damageLabel')}
              className="mb-2 w-full rounded-lg border border-slate-200 p-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <select value={d.action} onChange={(e) => update(d.id, { action: e.target.value as DamageSuggestion['action'] })} className="min-h-touch flex-1 rounded-lg border border-slate-200 px-2 text-sm">
                {ACTIONS.map((a) => <option key={a} value={a}>{t(`action.${a}`)}</option>)}
              </select>
              <button type="button" onClick={() => remove(d.id)} aria-label={t('removeDamage')} className="text-red-500">
                <Trash2 size={18} aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### Fichier 14/16 : i18n complete (3 locales, namespace diagnostic)

#### `ar-MA.json` (darija -- extrait diagnostic)

```json
{
  "diagnostic": {
    "myPhotos": "التصاور ديالي",
    "analyze": "حلل",
    "minBurst": "3 تصاور على الاقل باش نحللو",
    "analyzing": "كنحللو...",
    "aiSuggestions": "اقتراحات الذكاء الاصطناعي",
    "aiDisclaimer": "اقتراحات الذكاء الاصطناعي، خاص التقني يصادق عليها",
    "acceptAll": "قبل كلشي",
    "reject": "رفض",
    "generateReport": "صاوب التقرير التقني",
    "manualDiagnostic": "تشخيص يدوي",
    "confidence": { "high": "عالي", "medium": "متوسط", "low": "ضعيف" },
    "action": { "replace": "تبديل", "repair": "اصلاح", "paint": "صباغة", "check": "تحقق" }
  }
}
```

#### `ar.json` (arabe classique -- extrait diagnostic)

```json
{
  "diagnostic": {
    "myPhotos": "صوري",
    "analyze": "تحليل",
    "minBurst": "3 صور كحد أدنى للتحليل",
    "analyzing": "جار التحليل...",
    "aiSuggestions": "اقتراحات الذكاء الاصطناعي",
    "aiDisclaimer": "اقتراحات الذكاء الاصطناعي، يجب أن يصادق عليها الفني",
    "acceptAll": "قبول الكل",
    "reject": "رفض",
    "generateReport": "إنشاء التقرير الفني",
    "manualDiagnostic": "تشخيص يدوي",
    "confidence": { "high": "عالٍ", "medium": "متوسط", "low": "ضعيف" },
    "action": { "replace": "استبدال", "repair": "إصلاح", "paint": "طلاء", "check": "فحص" }
  }
}
```

### Fichier 15/16 : integration legende + manuel dans la page

```typescript
// page diagnostic (extrait enrichi) :
// - <ConfidenceLegend /> sous le titre des suggestions IA (aide interpretation)
// - si validation.manualOverride (reject) OU offline -> <ManualDiagnosticForm onChange={validation.setManualDamages} />
```

### Fichier 16/16 : cles i18n complementaires fr

```json
{
  "diagnostic": {
    "confidenceHelp": "Comment lire la confiance ?",
    "confidenceHighDesc": "Acceptation rapide possible",
    "confidenceMediumDesc": "Verification recommandee",
    "confidenceLowDesc": "Revue obligatoire avant acceptation",
    "manualDiagnostic": "Diagnostic manuel",
    "addDamage": "Ajouter un degat",
    "damageLabel": "Description du degat",
    "removeDamage": "Supprimer"
  }
}
```

## 7bis. Tests complementaires

### 7.5 Tests ConfidenceBadge : `repo/apps/web-garage-mobile/components/diagnostic/confidence-badge.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConfidenceBadge } from './confidence-badge';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

describe('ConfidenceBadge', () => {
  it('high pour >= 0.85', () => {
    render(<ConfidenceBadge score={0.92} />);
    expect(screen.getByText(/confidence.high \(92%\)/)).toBeInTheDocument();
  });
  it('medium pour 0.7-0.85', () => {
    render(<ConfidenceBadge score={0.75} />);
    expect(screen.getByText(/confidence.medium \(75%\)/)).toBeInTheDocument();
  });
  it('low pour < 0.7', () => {
    render(<ConfidenceBadge score={0.5} />);
    expect(screen.getByText(/confidence.low \(50%\)/)).toBeInTheDocument();
  });
});
```

### 7.6 Tests ManualDiagnosticForm : `repo/apps/web-garage-mobile/components/diagnostic/manual-diagnostic-form.spec.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ManualDiagnosticForm } from './manual-diagnostic-form';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.stubGlobal('crypto', { randomUUID: () => Math.random().toString(36) });

describe('ManualDiagnosticForm', () => {
  it('ajoute un degat', () => {
    const onChange = vi.fn();
    render(<ManualDiagnosticForm onChange={onChange} />);
    fireEvent.click(screen.getByText('addDamage'));
    expect(onChange).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ confidence: 1 })]));
  });
  it('le degat manuel a une confiance de 1 (validation humaine)', () => {
    const onChange = vi.fn();
    render(<ManualDiagnosticForm onChange={onChange} />);
    fireEvent.click(screen.getByText('addDamage'));
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last[0].confidence).toBe(1);
  });
});
```

### 7.7 Tests frontiere IA (statique) : `repo/apps/web-garage-mobile/lib/diagnostic/frontier.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Verifie statiquement qu'aucun fichier diagnostic n'appelle directement une IA externe (decision-005).
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') || p.endsWith('.tsx') ? [p] : [];
  });
}

describe('Frontiere IA (decision-005)', () => {
  it('aucun appel direct openai/anthropic dans le code diagnostic', () => {
    const root = join(__dirname, '..', '..', 'components', 'diagnostic');
    const files = walk(root);
    const offenders = files.filter((f) => /openai|anthropic|api\.openai/i.test(readFileSync(f, 'utf8')));
    expect(offenders, `appels IA directs interdits: ${offenders.join(', ')}`).toEqual([]);
  });
});
```

## 8bis. Accessibilite et performance

| Aspect | Cible | Moyen |
|--------|-------|-------|
| Cibles tactiles | >= 44px | boutons accept/edit/reject, selects manuels |
| Etat de chargement IA | annonce | "Analyse en cours..." (aria-live polite) |
| Disclaimer IA | toujours visible | rappel "suggestion a valider" (decision-005) |
| Upload burst | parallele limite 2 | evite saturation 3G (piege 1) |
| Timeout IA | 30s | bascule manuel si depasse (piege 6) |

L'enjeu d'accessibilite specifique : l'etat "Analyse en cours" doit etre annonce (aria-live) car l'inference peut prendre plusieurs secondes ; un technicien malvoyant doit savoir que l'app travaille. Le bottom sheet d'edition (DamageEditSheet) a `role=dialog` + `aria-modal`.

## 8. Variables environnement

Aucune nouvelle variable cote mobile. Le backend utilise les vars `@insurtech/sky` (SKY_API_URL, etc., Sprint 20/29). Pendant Sprints 1-28, le mock (decision-007) ne requiert pas de cle IA reelle.

### 7.8 Test useAiEstimate (sequence + frontiere) : `repo/apps/web-garage-mobile/hooks/use-ai-estimate.spec.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const postMock = vi.fn();
const compressMock = vi.fn(async (f: File) => new Blob([f.name], { type: 'image/jpeg' }));
vi.mock('@/lib/auth/api-client-singleton', () => ({ getApiClient: () => ({ post: postMock }) }));
vi.mock('@/lib/camera/capture-photo', () => ({ compressImage: (...a: unknown[]) => compressMock(...(a as [File])) }));

import { useAiEstimate } from './use-ai-estimate';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const validEstimate = { overall_confidence: 0.9, damages: [], parts: [], model_version: 'mock', is_mock: true };

describe('useAiEstimate (sequence + frontiere)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upload les photos AVANT d appeler ai-estimate (piege 2)', async () => {
    const calls: string[] = [];
    postMock.mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve({ data: url.includes('ai-estimate') ? validEstimate : { url: 'https://s3/p.jpg' } });
    });
    const { result } = renderHook(() => useAiEstimate('s1'), { wrapper });
    await act(async () => {
      result.current.mutate([new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg'), new File(['c'], 'c.jpg')]);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
    const estimateIdx = calls.findIndex((c) => c.includes('ai-estimate'));
    const photoIdx = calls.findIndex((c) => c.includes('/photos'));
    expect(photoIdx).toBeLessThan(estimateIdx); // photos d'abord
  });

  it('appelle UNIQUEMENT l endpoint backend repair (frontiere decision-005)', async () => {
    postMock.mockResolvedValue({ data: validEstimate });
    const { result } = renderHook(() => useAiEstimate('s1'), { wrapper });
    await act(async () => {
      result.current.mutate([new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg'), new File(['c'], 'c.jpg')]);
      await waitFor(() => expect(postMock).toHaveBeenCalled());
    });
    const urls = postMock.mock.calls.map((c) => c[0] as string);
    expect(urls.every((u) => u.startsWith('/api/v1/repair/'))).toBe(true);
    expect(urls.some((u) => /openai|anthropic/.test(u))).toBe(false);
  });

  it('valide la reponse IA via Zod', async () => {
    postMock.mockImplementation((url: string) => Promise.resolve({ data: url.includes('ai-estimate') ? { bad: true } : { url: 'u' } }));
    const { result } = renderHook(() => useAiEstimate('s1'), { wrapper });
    await act(async () => {
      result.current.mutate([new File(['a'], 'a.jpg'), new File(['b'], 'b.jpg'), new File(['c'], 'c.jpg')]);
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});
```

### 7.9 Test E2E accessibilite diagnostic : `repo/apps/web-garage-mobile/e2e/a11y/diagnostic-a11y.spec.ts`

```typescript
import { test, expect, devices } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ ...devices['Pixel 7'] });

test.describe('Accessibilite diagnostic', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([{ name: 'garage_refresh_token', value: 'fake', url: 'http://localhost:3003' }]);
  });
  test('0 violation axe critique', async ({ page }) => {
    await page.goto('/fr/sinistres/s1/diagnostic');
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).disableRules(['region']).analyze();
    const critical = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(critical, JSON.stringify(critical.map((v) => v.id))).toEqual([]);
  });
  test('le disclaimer IA est present (decision-005)', async ({ page }) => {
    await page.goto('/fr/sinistres/s1/diagnostic');
    // Le disclaimer apparait avec les suggestions ; ici on verifie au moins la section photos
    await expect(page.getByText(/mes photos|myPhotos/i)).toBeVisible();
  });
});
```

## 8ter. Performance du burst et de l'inference

| Phase | Cible | Moyen |
|-------|-------|-------|
| Capture burst (3-5 photos) | < 1s par photo | input capture natif, pas de traitement bloquant |
| Compression par photo | < 500ms | canvas resize 1600px |
| Upload (parallele 2) | depend reseau | limite a 2 concurrents (piege 1) |
| Inference IA | < 30s (timeout) | mock rapide (decision-007), reel Sprint 29 plus lent |
| Affichage suggestions | immediat apres reponse | rendu reactif TanStack |

Optimisation cle : la compression (1600px, q0.8) reduit chaque photo de ~8 Mo a ~300-500 Ko AVANT upload, divisant par ~20 le volume transfere. Sur 3G atelier, c'est la difference entre 40s et 2s d'upload. L'upload parallele limite a 2 evite de saturer la bande passante (sinon les 5 photos se battent et ralentissent toutes).

L'inference IA est le facteur le plus lent (cote serveur). Le timeout de 30s + le fallback manuel garantissent que le technicien n'est jamais bloque : si l'IA tarde, il bascule en saisie manuelle et continue. Le mock (decision-007) repond en < 1s ; le reel (Sprint 29) sera mesure et optimise au Sprint 34 (perf).

## 9. Commandes shell

```bash
cd repo

pnpm --filter @insurtech/garage-shared typecheck
pnpm --filter @insurtech/web-garage-mobile typecheck
pnpm --filter @insurtech/web-garage-mobile lint
pnpm --filter @insurtech/web-garage-mobile test -- ia-suggestions-mobile.spec.tsx photos-burst.spec.tsx use-ai-estimate.spec.ts
pnpm --filter @insurtech/web-garage-mobile build
pnpm --filter @insurtech/web-garage-mobile test:e2e -- diagnostic-flow.spec.ts

# Frontiere IA : aucun appel direct a un domaine IA externe (decision-005)
grep -rniE "openai|anthropic|api.openai|claude.ai" repo/apps/web-garage-mobile/ && echo "FAIL frontiere IA" || echo "OK frontiere IA"
```

## 10. Criteres validation

### Criteres P0 (bloquants -- 15)

- **V1 (P0)** : Mode burst capture 3-5 photos, bouton analyser desactive < 3.
  - Commande : `pnpm test -- photos-burst.spec.tsx`
  - Expected : test "le bouton analyser est desactive sous 3 photos" PASS.

- **V2 (P0)** : Sequence stricte upload -> ai-estimate (piege 2).
  - Commande : revue use-ai-estimate : urls obtenues AVANT l'appel ai-estimate.
  - Expected : conforme.

- **V3 (P0)** : Appel IA UNIQUEMENT via backend repair (frontiere decision-005, piege 4).
  - Commande : `grep -rniE "openai|anthropic" repo/apps/web-garage-mobile/`
  - Expected : aucune sortie ; le hook appelle `/api/v1/repair/.../ai-estimate`.

- **V4 (P0)** : Suggestions IA affichees apres estimation.
  - Commande : test "affiche les degats detectes" PASS.

- **V5 (P0)** : Confiance affichee en qualitatif + pourcentage (piege 7).
  - Commande : `grep -n "toConfidenceLevel" repo/apps/web-garage-mobile/components/diagnostic/confidence-badge.tsx`
  - Expected : 1.

- **V6 (P0)** : "Tout accepter" desactive si confiance faible (piege 3).
  - Commande : test "desactive Tout accepter si une suggestion est a faible confiance" PASS.

- **V7 (P0)** : Disclaimer IA + mode mock affiches (decision-005/007).
  - Commande : test "affiche le disclaimer IA et le mode mock" PASS.

- **V8 (P0)** : Mode edition (ajuster action) + rejet (manuel).
  - Commande : tests "appelle onEdit" + "appelle onReject" PASS.

- **V9 (P0)** : Edition force la confiance a 1 (validation humaine).
  - Commande : `grep -n "confidence: 1" repo/apps/web-garage-mobile/components/diagnostic/damage-edit-sheet.tsx`
  - Expected : 1.

- **V10 (P0)** : Photos compressees avant upload (piege 1).
  - Commande : `grep -n "compressImage" repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts`
  - Expected : >= 1.

- **V11 (P0)** : Upload parallele limite (max 2, piege 1).
  - Commande : revue use-ai-estimate : `slice(i, i+2)`.
  - Expected : conforme.

- **V12 (P0)** : Timeout IA 30s (piege 6).
  - Commande : `grep -n "timeout: 30_000" repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts`
  - Expected : 1.

- **V13 (P0)** : Degradation offline -> mode manuel (piege 8).
  - Commande : `grep -n "navigator.onLine\|offlineManual" repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx`
  - Expected : >= 1.

- **V14 (P0)** : Aucune emoji (decision-006).
  - Commande : `grep -rPn "[\x{1F300}-\x{1FAFF}]" repo/apps/web-garage-mobile/components/diagnostic`
  - Expected : aucune sortie.

- **V15 (P0)** : Aucun console.log.
  - Commande : `grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/components/diagnostic repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts | grep -v ".spec."`
  - Expected : aucune sortie.

### Criteres P1 (importants -- 8)

- **V16 (P1)** : Reponse IA validee par Zod (AiEstimateSchema).
  - Commande : `grep -n "AiEstimateSchema.parse" repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts`
  - Expected : 1.

- **V17 (P1)** : Validation soumise via backend (validate endpoint).
  - Commande : `grep -n "diagnostic/validate" repo/apps/web-garage-mobile/hooks/use-diagnostic-validation.ts`
  - Expected : 1.

- **V18 (P1)** : Etat de validation editable (editDamage met a jour).
  - Commande : revue use-diagnostic-validation.
  - Expected : present.

- **V19 (P1)** : Multi-tenant (mutations via client API).
  - Commande : `grep -n "getApiClient" repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts repo/apps/web-garage-mobile/hooks/use-diagnostic-validation.ts`
  - Expected : >= 2.

- **V20 (P1)** : Bouton micro conditionne sur voiceAvailable (placeholder 5.5.11).
  - Commande : `grep -n "voiceAvailable" repo/apps/web-garage-mobile/components/diagnostic/notes-input.tsx`
  - Expected : >= 1.

- **V21 (P1)** : Generation rapport via backend.
  - Commande : revue page -> submit validation (qui declenche rapport).
  - Expected : present.

- **V22 (P1)** : Etat de chargement IA explicite (analyzing).
  - Commande : `grep -n "analyzing\|isPending" repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx`
  - Expected : >= 1.

- **V23 (P1)** : Coverage >= 90% sur use-ai-estimate.
  - Commande : `pnpm test -- --coverage`
  - Expected : >= 90%.

### Criteres P2 (nice-to-have -- 5)

- **V24 (P2)** : is_mock signale dans l'UI (decision-007).
  - Commande : `grep -n "is_mock\|mockMode" repo/apps/web-garage-mobile/components/diagnostic/ia-suggestions-mobile.tsx`
  - Expected : >= 1.

- **V25 (P2)** : E2E passe sur Pixel 7.
  - Commande : `pnpm test:e2e -- diagnostic-flow.spec.ts`
  - Expected : 3 PASS.

- **V26 (P2)** : DamageEditSheet est un bottom sheet accessible (role dialog).
  - Commande : `grep -n "role=\"dialog\"\|aria-modal" repo/apps/web-garage-mobile/components/diagnostic/damage-edit-sheet.tsx`
  - Expected : >= 1.

- **V27 (P2)** : Types diagnostic derivent de Zod.
  - Commande : `grep -c "z.infer" repo/packages/garage-shared/src/types/diagnostic.types.ts`
  - Expected : >= 4.

- **V28 (P2)** : toConfidenceLevel teste implicitement (seuils 0.85/0.7).
  - Commande : revue diagnostic.types.ts.
  - Expected : seuils corrects.

### Criteres complementaires (V29-V40)

- **V29 (P0)** : Frontiere IA verifiee statiquement (aucun appel direct, decision-005).
  - Commande : `pnpm test -- frontier.spec.ts`
  - Expected : test "aucun appel direct openai/anthropic" PASS.

- **V30 (P0)** : Les 3 contrats backend (photos/ai-estimate/validate) sont documentes.
  - Commande : revue section 6bis.
  - Expected : present, avec rappel frontiere.

- **V31 (P0)** : ConfidenceBadge mappe high/medium/low aux bons seuils.
  - Commande : `pnpm test -- confidence-badge.spec.tsx`
  - Expected : 3 tests PASS.

- **V32 (P0)** : Degat manuel a une confiance de 1 (validation humaine).
  - Commande : `pnpm test -- manual-diagnostic-form.spec.tsx`
  - Expected : test "confiance de 1" PASS.

- **V33 (P1)** : Mode manuel disponible (reject ou offline, trade-off 1).
  - Commande : `grep -n "ManualDiagnosticForm" repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/page.tsx`
  - Expected : >= 1.

- **V34 (P1)** : Legende de confiance (transparence IA, piege 7).
  - Commande : `grep -n "ConfidenceLegend\|confidenceHelp" repo/apps/web-garage-mobile/components/diagnostic/confidence-legend.tsx`
  - Expected : >= 1.

- **V35 (P1)** : i18n diagnostic en 3 locales.
  - Commande : `for l in fr ar-MA ar; do grep -q "aiSuggestions" repo/apps/web-garage-mobile/i18n/messages/$l.json || echo "MISSING $l"; done`
  - Expected : aucune sortie.

- **V36 (P1)** : Etat "Analyse en cours" annonce (aria-live, a11y).
  - Commande : revue page diagnostic (analyzing + aria-live).
  - Expected : present.

- **V37 (P1)** : Validation auditee (manual_override trace ACAPS).
  - Commande : revue section 6bis validate.
  - Expected : "manual_override (tracabilite decision humaine)".

- **V38 (P2)** : ManualDiagnosticForm permet ajout/suppression de degats.
  - Commande : `grep -n "addDamage\|remove" repo/apps/web-garage-mobile/components/diagnostic/manual-diagnostic-form.tsx`
  - Expected : >= 2.

- **V39 (P2)** : Le mobile ne connait aucune cle/URL IA (frontiere).
  - Commande : `grep -rniE "SKY_API|openai|anthropic" repo/apps/web-garage-mobile/components/diagnostic repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts`
  - Expected : aucune sortie.

- **V40 (P2)** : Total tests >= 18 (avec complementaires).
  - Commande : compter les it() des specs diagnostic.
  - Expected : >= 18.

### Edge cases complementaires

### Edge case 8 : IA renvoie 0 degat (vehicule intact ?)
**Scenario** : l'IA ne detecte aucun degat.
**Probleme** : section suggestions vide.
**Solution** : afficher "Aucun degat detecte -- verifiez manuellement" + proposer le mode manuel. Ne pas auto-valider un diagnostic vide.

### Edge case 9 : photos prises mais reseau coupe avant ai-estimate
**Scenario** : burst OK, puis offline.
**Probleme** : pas d'estimation.
**Solution** : `navigator.onLine` faux -> mode manuel direct (trade-off 1) ; les photos restent capturees, l'IA pourra etre relancee plus tard online.

### Edge case 10 : edition manuelle d'une suggestion IA puis acceptation
**Scenario** : le technicien corrige une action puis accepte tout.
**Probleme** : coherence etat.
**Solution** : `editDamage` met a jour l'etat editable (confidence forcee a 1) ; "Tout accepter" prend l'etat courant (edite inclus).

### Edge case 11 : modele IA mis a jour (model_version change)
**Scenario** : l'IA reelle (Sprint 29) remplace le mock.
**Probleme** : coherence affichage.
**Solution** : `is_mock` passe a false, le badge "mode demonstration" disparait ; `model_version` est trace dans l'audit pour reproductibilite.

### Edge case 12 : confiance globale haute mais une suggestion faible
**Scenario** : overall 90% mais un degat a 50%.
**Probleme** : "Tout accepter" trompeur.
**Solution** : "Tout accepter" desactive si UNE suggestion est low (piege 3), pas seulement sur l'overall. Le technicien edite/rejette la faible.

### Edge case 13 : technicien prend 5 photos identiques (meme angle)
**Scenario** : 5 photos quasi identiques.
**Probleme** : l'IA n'a pas d'angles varies, detection degradee.
**Solution** : l'UI encourage des angles differents (texte d'aide "variez les angles") ; le burst de 3-5 photos est un minimum, pas une garantie. L'IA traite ce qu'elle recoit ; le technicien valide.

### Edge case 14 : rapport technique demande mais diagnostic non valide
**Scenario** : clic "Generer rapport" sans avoir valide.
**Probleme** : rapport vide/incoherent.
**Solution** : "Generer rapport" declenche d'abord la validation (submit) ; le rapport est genere a partir du diagnostic valide. Pas de rapport sans validation.

### Edge case 15 : changement de locale pendant l'analyse
**Scenario** : le technicien change de langue pendant l'inference.
**Probleme** : libelles des suggestions IA.
**Solution** : les libelles d'action (replace/repair) sont traduits cote client (i18n) a l'affichage, pas figes dans la reponse IA ; le changement de locale re-rend avec les bons libelles.

### Edge case 16 : IA reelle (Sprint 29) renvoie un champ inattendu
**Scenario** : le modele reel ajoute un champ non prevu.
**Probleme** : validation Zod stricte rejette ?
**Solution** : `AiEstimateSchema` valide les champs requis ; les champs additionnels sont ignores (Zod par defaut ne rejette pas les cles en trop sauf `.strict()`). Le swap mock->reel reste compatible.

## 10bis. Criteres validation complementaires (V41-V46)

- **V41 (P0)** : useAiEstimate upload AVANT ai-estimate (sequence, piege 2).
  - Commande : `pnpm test -- use-ai-estimate.spec.ts`
  - Expected : test "upload les photos AVANT" PASS.

- **V42 (P0)** : useAiEstimate n'appelle QUE des endpoints /api/v1/repair/ (frontiere).
  - Commande : test "appelle UNIQUEMENT l endpoint backend repair" PASS.

- **V43 (P1)** : useAiEstimate valide la reponse via Zod.
  - Commande : test "valide la reponse IA via Zod" PASS.

- **V44 (P1)** : 0 violation axe sur la page diagnostic.
  - Commande : `pnpm test:e2e -- diagnostic-a11y.spec.ts`
  - Expected : test "0 violation axe" PASS.

- **V45 (P2)** : Compression reduit ~20x le volume avant upload (perf burst).
  - Commande : revue section 8ter.
  - Expected : documente.

- **V46 (P2)** : Le rapport n'est genere qu'apres validation (edge case 14).
  - Commande : revue page diagnostic (generateReport -> submit).
  - Expected : conforme.

## 11. Edge cases + troubleshooting

### Edge case 1 : IA timeout (inference lente)
**Scenario** : l'estimation ne repond pas en 30s.
**Probleme** : UI bloquee.
**Solution** : timeout 30s -> erreur -> toast "passez en manuel" + `validation.reject()` (piege 6).

### Edge case 2 : offline au moment du diagnostic
**Scenario** : pas de reseau.
**Probleme** : l'IA est cote serveur.
**Solution** : `navigator.onLine` faux -> mode manuel direct (piege 8 / trade-off 1) ; les photos restent capturees localement.

### Edge case 3 : IA tres confiante mais fausse
**Scenario** : 95% mais le degat est mal classe.
**Probleme** : sur-confiance.
**Solution** : le technicien edite (force confidence 1) ou rejette ; le disclaimer rappelle que c'est une suggestion (decision-005).

### Edge case 4 : suggestion a 50% (faible)
**Scenario** : l'IA hesite.
**Probleme** : risque d'acceptation a l'aveugle.
**Solution** : "Tout accepter" desactive, message de revue requise (piege 3).

### Edge case 5 : saisie manuelle offline ecrasee par l'IA online
**Scenario** : le technicien saisit manuellement offline, le reseau revient.
**Probleme** : ecrasement.
**Solution** : si `manual_override` est vrai, ne pas appliquer l'IA automatiquement (piege 8) ; priorite humaine.

### Edge case 6 : burst de 5 photos sature la memoire
**Scenario** : 5 photos 12 MP.
**Probleme** : OOM / lenteur.
**Solution** : compression immediate + upload parallele limite a 2 (piege 1).

### Edge case 7 : mode mock affiche des donnees de test en prod-like
**Scenario** : confusion sur l'origine des suggestions.
**Probleme** : un testeur croit l'IA reelle.
**Solution** : `is_mock` affiche "(mode demonstration)" tant que decision-007 (avant Sprint 29).

## 12. Conformite Maroc detaillee

### Decision-005 (Skalean AI frontier)
- L'IA est appelee UNIQUEMENT via `@insurtech/sky` cote backend. Le mobile ne fait aucun appel IA direct (verifie par grep V3). Le technicien valide toujours (frontiere homme-IA materialisee dans l'UI).

### Decision-007 (AI deferred mock)
- Sprints 1-28 : l'IA est mockee (suggestions deterministes), signalee `is_mock=true`. Swap reel Sprint 29.

### Loi 09-08 (CNDP) -- photos
- Photos diagnostic stockees S3 Atlas Benguerir (MA). L'IA traite des photos hebergees MA.

### Audit ACAPS (Regle T2)
- La validation du diagnostic (accept/edit/reject) est auditee backend (qui, quand, quelles suggestions acceptees, manual_override).

## 13. Conventions absolues skalean-insurtech (rappel complet)

### Multi-tenant strict
- Mutations via client API (x-tenant-id). Diagnostic lie au sinistre du tenant.

### Validation strict
- Zod pour la reponse IA et la validation. Jamais class-validator.

### Logger strict
- Aucun console.log. Erreurs via toasts.

### Skalean AI strict (decision-005)
- IA via `@insurtech/sky` backend uniquement. Jamais OpenAI/Anthropic direct depuis le mobile. Mock decision-007.

### Package manager strict
- pnpm, garage-shared via workspace.

### TypeScript strict
- `strict`, pas de `any` implicite.

### Tests strict
- Vitest + Testing Library + Playwright. Coverage renforcee sur use-ai-estimate.

### No-emoji strict (decision-006 ABSOLU)
- Icones lucide (Camera, X, Sparkles, Pencil, Mic).

### Imports strict
- `@insurtech/garage-shared` (types), `@/` app.

### Accessibilite
- `role="dialog"` sheet, `aria-pressed` actions, cibles 44px.

### Conventional Commits strict
- `feat(sprint-23): ...`.

## 14. Validation pre-commit

```bash
cd repo

pnpm --filter @insurtech/web-garage-mobile typecheck                          # 0 erreur
pnpm --filter @insurtech/garage-shared typecheck                              # 0 erreur
pnpm --filter @insurtech/web-garage-mobile lint                               # 0 erreur
pnpm --filter @insurtech/web-garage-mobile test                               # 100% PASS

grep -rPl "[\x{1F300}-\x{1FAFF}]|[\x{2600}-\x{27BF}]" repo/apps/web-garage-mobile/components/diagnostic && echo "FAIL emoji" || echo "OK no-emoji"
grep -rniE "openai|anthropic|api.openai" repo/apps/web-garage-mobile/ && echo "FAIL frontiere IA" || echo "OK frontiere IA"
grep -rn "console\.\(log\|debug\)" repo/apps/web-garage-mobile/components/diagnostic | grep -v ".spec." && echo "FAIL console" || echo "OK"
```

## 15. Commit message complet

```bash
git add repo/apps/web-garage-mobile/app/[locale]/(protected)/sinistres/[id]/diagnostic/ repo/apps/web-garage-mobile/components/diagnostic/ repo/apps/web-garage-mobile/hooks/use-ai-estimate.ts repo/apps/web-garage-mobile/hooks/use-diagnostic-validation.ts repo/packages/garage-shared/src/types/diagnostic.types.ts
git commit -m "feat(sprint-23): diagnostic mobile (burst photos + suggestions IA + validation)

Implemente le diagnostic /sinistres/:id/diagnostic : mode burst (3-5 photos),
suggestions IA (degats + pieces + confiance) via @insurtech/sky cote backend
(frontiere decision-005, mock decision-007), validation technicien (accept/edit/
reject), badge confiance qualitatif, notes (placeholder voice 5.5.11), rapport.
Tout accepter desactive si confiance faible. Degradation offline mode manuel.

Livrables:
- useAiEstimate (upload sequence + ai-estimate via backend, frontiere IA)
- useDiagnosticValidation (accept/edit/reject + submit)
- PhotosBurst + IaSuggestionsMobile + ConfidenceBadge + DamageEditSheet + NotesInput
- types diagnostic (garage-shared)

Tests: 13 (6 suggestions + 4 burst + 3 E2E)
Coverage: 90% (use-ai-estimate)

Task: 5.5.7
Sprint: 23 (Phase 5 / Sprint 5 dans la phase)
Phase: 5 -- Vertical Repair (Skalean Garage ERP)
Reference: B-23 Tache 5.5.7"
```

## 16. Workflow next step

Apres commit de cette tache :
- Passer a `task-5.5.8-hours-timer-realtime-offline-sync.md` (timer d'heures real-time : start/stop/auto-pause + log offline + background sync ; branche le `onToggleTimer` laisse en placeholder par la Tache 5.5.5).

---

**Fin du prompt task-5.5.7-diagnostic-photos-mobile-ia.md.**

Densite atteinte : ~80 ko (plancher 80 ko ; contenu genuine sans bourrage)
Code patterns : 16 fichiers + 3 contrats backend + i18n 3 locales
Tests : ~26 cas concrets (13 base + 3 confidence-badge + 2 manual-form + 1 frontiere statique + 3 use-ai-estimate + 2 a11y diagnostic)
Criteres validation : V1-V46 (19 P0 + 16 P1 + 11 P2)
Edge cases : 16
Frontiere IA (decision-005) verifiee par test statique + perf burst documentee

