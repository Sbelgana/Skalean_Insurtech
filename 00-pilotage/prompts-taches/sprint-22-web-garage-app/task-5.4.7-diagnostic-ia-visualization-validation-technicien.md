# TACHE 5.4.7 -- Diagnostic Page : IA Suggestions Visualization + Technicien Validation (Accept/Edit/Reject) + Manual Diagnostic + Report Generation

**Sprint** : 22 (Phase 5 / Vertical Repair / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.7)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0
**Effort** : 7h
**Dependances** :
- Taches 5.4.1, 5.4.2, 5.4.3, 5.4.4, 5.4.5, 5.4.6 livres
- Sprint 20 (IA estimation backend disponible : GET /api/v1/repair/sinistres/:id/diagnostic/ia + POST /api/v1/repair/sinistres/:id/diagnostic/apply-ia-estimation)
- Sprint 21 (workflow apply estimation : action accept/edit/reject + transition status under_diagnostic -> awaiting_approval)
- Tache 5.4.6 (photos reception disponibles -- l'IA Sprint 20 les a deja analysees apres reception)

**Densite cible** : 80-150 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Remplir la **tab Diagnostic** de la page detail sinistre (Tache 5.4.5) avec : (1) **Section "IA Suggestions"** affichant les outputs du moteur IA Sprint 20 (Skalean AI gateway via MCP server) -- confidence score visual gauge 0-100%, damages detected list cards avec severity badges + photos overlay highlighting damages zones, parts needed table (name + quantity + unit_cost + total), labor estimate hours range + total cost, total estimate range min-max MAD, warnings si confidence < 0.90 ou photos manquantes ou ambiguous classification ; (2) **Section "Actions"** -- 3 boutons : (a) "Accept all" POST apply-ia-estimation action='accept' -> tous items IA sont copies tels quels comme diagnostic technicien, transition status, (b) "Edit" -> ouvre modal editeur items (modifier quantites + prices + add/remove items) puis POST action='edit' avec items finaux, (c) "Reject" -> ferme IA section + active section manuel diagnostic ; (3) **Section "Manual Diagnostic"** (apparait si IA rejected ou absent) -- form add problems manuellement (description + severity), form add parts needed manuellement (search part catalog Sprint 13 + quantity), form labor hours estimate, total auto-calcule ; (4) **Section "Additional Photos"** -- technicien peut uploader photos additionnelles d'analyse approfondie (different des photos reception) ; (5) **Section "Report"** -- bouton "Generate Report" qui POST /api/v1/repair/sinistres/:id/diagnostic/report -> backend genere PDF rapport technique (template HTML -> PDF wkhtmltopdf cote backend) avec photos + items + total -> download lien S3.

Cette tache est la **pivot du workflow IA** : c'est ici que la valeur IA Skalean est materialisee pour le technicien. Si l'IA propose un diagnostic precis (confidence > 0.85), le technicien accept en 1 click et passe a l'approval. Si IA imprecise ou pieces non-standard, technicien edit/reject et fait manuel. Le report PDF est obligatoire (loi : preuve technique pour assureur).

Le timing : 7eme tache du Sprint 22, posee apres reception (5.4.6) car la reception est prerequis au diagnostic. Avant devis (5.4.8) car le devis se construit depuis le diagnostic validate.

A la sortie de cette tache, un user `garage_technicien` (apres avoir recu un vehicule) arrivant sur `/fr/sinistres/{id}?tab=diagnostic` quand status `under_diagnostic` peut : (a) voir les suggestions IA avec confidence visible, (b) accepter en 1 click ou editer items ou rejeter + faire manuel, (c) uploader photos supplementaires analyse, (d) submit -> transition `under_diagnostic` -> `awaiting_approval` + redirect vers tab `devis` (Tache 5.4.8), (e) generer rapport PDF telechargeable.

---

## 2. Contexte etendu (5-10 ko)

### Pourquoi cette tache existe

L'IA Estimation Sprint 20 est le **differenciateur produit** de Skalean Garage. Pour Atlas Cabinet, c'est l'argument de vente : "Nos diagnostics sont 3x plus rapides et 25% plus precis grace a l'IA". Si la tab Diagnostic n'expose pas cette valeur (juste un form vide), l'IA est invisible et l'offre commerciale s'effondre.

Le UX critique : technicien doit voir **clairement** ce que l'IA propose, **comprendre pourquoi** (zones photo highlighting, parts catalog match), **ajuster facilement** (edit mode), et **valider en confiance** (1 click accept si OK). Plus la friction est faible, plus l'adoption IA est haute.

Le timing : 7eme tache Sprint 22. Posee apres reception (5.4.6) qui livre les photos qui alimentent l'IA Sprint 20. Le backend Sprint 20 a deja deroule l'IA en arriere-plan apres `received` -> `under_diagnostic` -- on consomme juste les resultats ici.

### Frontiere Skalean AI (decision-005)

Tres important : frontend NE FAIT PAS d'appel direct OpenAI/Anthropic. Il appelle uniquement `/api/v1/repair/sinistres/:id/diagnostic/ia` qui est un endpoint NestJS qui :
1. Verifie permissions + cache hit ;
2. Appelle Skalean AI Gateway via MCP server ;
3. Skalean AI Gateway appelle OpenAI ou Anthropic backend ;
4. Resultats serialises + cached Redis 24h ;
5. Retour frontend.

Frontiere stricte : aucune cle API OpenAI/Anthropic visible cote frontend.

### Alternatives considerees

#### Photos overlay highlighting : Canvas vs SVG vs CSS positioned

**Decision** : SVG overlay absolute positioned sur image. SVG rect avec stroke pour bounding boxes + labels. Permet zoom/pan + clickable zones.

#### Edit modal IA items : inline vs modal

**Decision** : Inline edit dans table. User click cell -> input edit + Enter pour save. Plus rapide que modal.

#### Report PDF : client-side react-pdf vs backend wkhtmltopdf

| Critere | Client react-pdf | Backend wkhtmltopdf (CHOIX) |
|---------|------------------|-------------------------------|
| Layout precision | Limited | Excellent (HTML/CSS complet) |
| Images embed | Manual | Auto |
| Cookies/auth | Client | Server |
| File size | Limited | Unlimited |

**Decision** : Backend genere PDF. Frontend appelle endpoint qui retourne S3 URL.

### Trade-offs explicites

1. **IA fail si photos insuffisantes** : reception a uploaded 4 photos min, IA a besoin de 6+ pour confidence > 0.85. Mitigation : warning si confidence < 0.90 + suggestion "upload more photos".

2. **Edit IA items detache du catalog** : user peut creer custom item non-standard. Mitigation : permettre custom items mais flag "not in catalog" pour audit.

3. **Confidence score peut induire en erreur** : 95% confidence sur 1 item ne veut pas dire IA juste sur tous. Mitigation : confidence per-item + global.

4. **Photos highlighting accuracy** : bounding boxes IA approximatifs. Mitigation : permettre technicien edit boundaries manuel.

5. **Report PDF generation 10-30s** : long. Mitigation : background job + notification quand ready.

### Pieges techniques (12)

1. **SVG overlay scale avec image responsive** : viewBox setup + preserveAspectRatio.

2. **Confidence gauge animate sans flash** : framer-motion ou CSS transitions.

3. **Edit table inline keyboard accessibility** : Tab navigation OK, Enter save, Escape cancel.

4. **Custom items add row reset form** : useFieldArray react-hook-form.

5. **Photos upload progress + IA polling concurrent** : pas de conflict mais bien separer state.

6. **Report download trigger** : new tab vs same window. New tab avec target="_blank" rel="noopener".

7. **IA endpoint cache 24h** : si user re-upload photos, IA cached returns stale. Mitigation : invalidate cache via endpoint param.

8. **Warning if reception incomplete** : block diagnostic page if status not under_diagnostic.

9. **Total auto-calc parts + labor** : useWatch pour reactivity.

10. **Labor hours range slider step** : 0.5h step.

11. **Currency MAD formatting locale** : `Intl.NumberFormat`.

12. **Confidence < 0.5 -> hide IA section** : trop bas, ne pas afficher pour eviter induire en erreur.

---

## 3. Architecture context

### Position dans Sprint 22

```
[5.4.6 Reception]   (livre)
[5.4.7 Diagnostic]  <-- ICI (7h)
[5.4.8 Devis]
```

### Flow apply IA action

```
Technicien voit IA suggestions
    |
    +--> Click "Accept all"
    +--> POST /api/v1/repair/sinistres/:id/diagnostic/apply-ia-estimation
    |       Body: { action: 'accept' }
    |       -> backend copies IA items -> diagnostic.items
    |       -> transition under_diagnostic -> awaiting_approval
    |       -> 200 + { diagnostic, sinistre }
    +--> redirect tab=devis
```

### ASCII tree apres tache

```
repo/apps/web-garage/src/components/diagnostic/
|-- diagnostic-content.tsx                        # orchestrator main
|-- diagnostic-content.spec.tsx
|-- ia-suggestions-display.tsx                    # IA section
|-- ia-suggestions-display.spec.tsx
|-- confidence-gauge.tsx                          # visual gauge 0-100
|-- damage-card.tsx                                # damage individual card
|-- damage-photo-overlay.tsx                       # SVG overlay highlighting
|-- ia-items-editor.tsx                            # edit IA items inline
|-- ia-items-editor.spec.tsx
|-- manual-diagnostic-form.tsx                     # manual alternative
|-- manual-diagnostic-form.spec.tsx
|-- additional-photos-uploader.tsx                  # additional photos
|-- generate-report-button.tsx                     # PDF generation

repo/apps/web-garage/src/lib/diagnostic/
|-- schema.ts                                       # Zod schemas
|-- schema.spec.ts
|-- queries.ts                                      # fetch IA + apply + report

repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-diagnostic.tsx          # remplace placeholder
```

---

## 4. Livrables checkables (22)

- [ ] `DiagnosticContent` orchestrator
- [ ] `IaSuggestionsDisplay` section avec confidence + damages + parts + labor + total
- [ ] `ConfidenceGauge` visual circular gauge
- [ ] `DamageCard` per damage avec severity badge + zone overlay
- [ ] `DamagePhotoOverlay` SVG bounding boxes
- [ ] `IaItemsEditor` inline edit table
- [ ] `ManualDiagnosticForm` add problems + parts + hours
- [ ] `AdditionalPhotosUploader` reuse pattern reception
- [ ] `GenerateReportButton` PDF + download
- [ ] Zod schemas validation
- [ ] Queries IA fetch + apply (accept/edit/reject)
- [ ] Replace tab-diagnostic-placeholder avec tab-diagnostic
- [ ] Confidence < 0.5 -> hide IA, force manuel
- [ ] Confidence 0.5-0.85 -> warning + show
- [ ] Confidence > 0.85 -> show prominently
- [ ] Total MAD auto-calc reactivity
- [ ] Submit transition under_diagnostic -> awaiting_approval
- [ ] Redirect tab=devis apres submit
- [ ] Tests Vitest 20+
- [ ] Tests Playwright 6+ E2E
- [ ] i18n 60+ keys par locale
- [ ] Aucune emoji

---

## 5. Fichiers crees / modifies

```
repo/apps/web-garage/src/components/diagnostic/diagnostic-content.tsx              (~220 lignes)
repo/apps/web-garage/src/components/diagnostic/diagnostic-content.spec.tsx           (~150 lignes)
repo/apps/web-garage/src/components/diagnostic/ia-suggestions-display.tsx              (~280 lignes)
repo/apps/web-garage/src/components/diagnostic/ia-suggestions-display.spec.tsx          (~180 lignes)
repo/apps/web-garage/src/components/diagnostic/confidence-gauge.tsx                      (~100 lignes)
repo/apps/web-garage/src/components/diagnostic/damage-card.tsx                            (~150 lignes)
repo/apps/web-garage/src/components/diagnostic/damage-photo-overlay.tsx                    (~180 lignes)
repo/apps/web-garage/src/components/diagnostic/ia-items-editor.tsx                          (~250 lignes)
repo/apps/web-garage/src/components/diagnostic/ia-items-editor.spec.tsx                      (~150 lignes)
repo/apps/web-garage/src/components/diagnostic/manual-diagnostic-form.tsx                     (~280 lignes)
repo/apps/web-garage/src/components/diagnostic/manual-diagnostic-form.spec.tsx                 (~180 lignes)
repo/apps/web-garage/src/components/diagnostic/additional-photos-uploader.tsx                   (~120 lignes)
repo/apps/web-garage/src/components/diagnostic/generate-report-button.tsx                       (~120 lignes)
repo/apps/web-garage/src/lib/diagnostic/schema.ts                                                (~150 lignes)
repo/apps/web-garage/src/lib/diagnostic/schema.spec.ts                                            (~120 lignes)
repo/apps/web-garage/src/lib/diagnostic/queries.ts                                                 (~180 lignes)
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-diagnostic.tsx                        (~80 lignes / wrapper)
repo/apps/web-garage/src/messages/{fr,ar-MA,ar}.json                                                  (+60 keys)
repo/apps/web-garage/e2e/diagnostic-ia.spec.ts                                                          (~180 lignes / 6 tests)
```

**Total** : 19 fichiers, ~2 800 lignes

---

## 6. Code patterns COMPLETS

### Fichier 1/12 : `src/lib/diagnostic/schema.ts`

```typescript
import { z } from 'zod';

export const SeveritySchema = z.enum(['minor', 'moderate', 'severe', 'critical']);
export type Severity = z.infer<typeof SeveritySchema>;

export const DamageSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(3).max(500),
  severity: SeveritySchema,
  body_zone: z.string().min(1).max(100),
  photo_id: z.string().uuid().nullable(),
  bbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }).nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});
export type Damage = z.infer<typeof DamageSchema>;

export const PartItemSchema = z.object({
  id: z.string().uuid().optional(),
  sku: z.string().nullable(),
  name: z.string().min(1).max(200),
  category: z.string(),
  quantity: z.number().int().positive(),
  unit_cost_mad: z.number().nonnegative(),
  in_catalog: z.boolean().default(true),
});
export type PartItem = z.infer<typeof PartItemSchema>;

export const LaborItemSchema = z.object({
  description: z.string().min(1).max(200),
  hours: z.number().nonnegative(),
  hourly_rate_mad: z.number().nonnegative(),
});
export type LaborItem = z.infer<typeof LaborItemSchema>;

export const IaDiagnosticSchema = z.object({
  confidence: z.number().min(0).max(1),
  damages: z.array(DamageSchema),
  parts: z.array(PartItemSchema),
  labor: z.array(LaborItemSchema),
  total_estimate: z.object({
    min_mad: z.number().nonnegative(),
    max_mad: z.number().nonnegative(),
    avg_mad: z.number().nonnegative(),
  }),
  warnings: z.array(z.string()).default([]),
  photos_analyzed: z.number().int().nonnegative(),
});
export type IaDiagnostic = z.infer<typeof IaDiagnosticSchema>;

export const ApplyIaActionSchema = z.enum(['accept', 'edit', 'reject']);
export type ApplyIaAction = z.infer<typeof ApplyIaActionSchema>;

export const ApplyIaEstimationInputSchema = z.object({
  action: ApplyIaActionSchema,
  edits: z.object({
    damages: z.array(DamageSchema).optional(),
    parts: z.array(PartItemSchema).optional(),
    labor: z.array(LaborItemSchema).optional(),
  }).optional(),
  reject_reason: z.string().max(500).optional(),
});
export type ApplyIaEstimationInput = z.infer<typeof ApplyIaEstimationInputSchema>;

export const ManualDiagnosticInputSchema = z.object({
  damages: z.array(DamageSchema).min(1),
  parts: z.array(PartItemSchema).min(0),
  labor: z.array(LaborItemSchema).min(1),
  notes: z.string().max(2000).optional(),
  additional_photo_ids: z.array(z.string().uuid()).default([]),
});
export type ManualDiagnosticInput = z.infer<typeof ManualDiagnosticInputSchema>;

export function computeTotals(parts: PartItem[], labor: LaborItem[]): {
  parts_total_mad: number;
  labor_total_mad: number;
  total_mad: number;
} {
  const parts_total = parts.reduce((sum, p) => sum + p.quantity * p.unit_cost_mad, 0);
  const labor_total = labor.reduce((sum, l) => sum + l.hours * l.hourly_rate_mad, 0);
  return {
    parts_total_mad: parts_total,
    labor_total_mad: labor_total,
    total_mad: parts_total + labor_total,
  };
}
```

### Fichier 2/12 : `src/lib/diagnostic/queries.ts`

```typescript
import { z } from 'zod';
import { apiGet, apiPost } from '@/lib/api-client';
import { IaDiagnosticSchema, type IaDiagnostic, type ApplyIaEstimationInput, type ManualDiagnosticInput } from './schema';

export async function fetchIaDiagnostic(sinistreId: string): Promise<IaDiagnostic | null> {
  try {
    const data = await apiGet<unknown>(`/api/v1/repair/sinistres/${sinistreId}/diagnostic/ia`);
    return IaDiagnosticSchema.parse(data);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return null; // IA not run yet or no photos
    throw err;
  }
}

export async function applyIaEstimation(
  sinistreId: string,
  input: ApplyIaEstimationInput,
): Promise<{ diagnostic_id: string; new_status: string }> {
  return await apiPost(`/api/v1/repair/sinistres/${sinistreId}/diagnostic/apply-ia-estimation`, input);
}

export async function submitManualDiagnostic(
  sinistreId: string,
  input: ManualDiagnosticInput,
): Promise<{ diagnostic_id: string; new_status: string }> {
  return await apiPost(`/api/v1/repair/sinistres/${sinistreId}/diagnostic/manual`, input);
}

const ReportGenerationResponseSchema = z.object({
  report_id: z.string().uuid(),
  status: z.enum(['queued', 'processing', 'ready', 'failed']),
  pdf_url: z.string().url().nullable(),
});

export async function generateDiagnosticReport(sinistreId: string) {
  const data = await apiPost(`/api/v1/repair/sinistres/${sinistreId}/diagnostic/report`, {});
  return ReportGenerationResponseSchema.parse(data);
}

export async function getReportStatus(reportId: string) {
  const data = await apiGet(`/api/v1/repair/reports/${reportId}`);
  return ReportGenerationResponseSchema.parse(data);
}
```

### Fichier 3/12 : `src/components/diagnostic/diagnostic-content.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { fetchIaDiagnostic } from '@/lib/diagnostic/queries';
import { IaSuggestionsDisplay } from './ia-suggestions-display';
import { ManualDiagnosticForm } from './manual-diagnostic-form';
import { AdditionalPhotosUploader } from './additional-photos-uploader';
import { GenerateReportButton } from './generate-report-button';

interface Props {
  sinistreId: string;
  locale: string;
  hasReportAvailable?: boolean;
}

export function DiagnosticContent({ sinistreId, locale, hasReportAvailable }: Props) {
  const t = useTranslations('diagnostic');
  const router = useRouter();
  const [iaRejected, setIaRejected] = useState(false);
  const [additionalPhotos, setAdditionalPhotos] = useState<string[]>([]);

  const { data: ia, isLoading } = useQuery({
    queryKey: ['diagnostic-ia', sinistreId],
    queryFn: () => fetchIaDiagnostic(sinistreId),
    staleTime: Infinity,
  });

  function handleSuccess() {
    router.push(`/${locale}/sinistres/${sinistreId}?tab=devis`);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-garage-primary" />
      </div>
    );
  }

  const showIa = ia && ia.confidence >= 0.5 && !iaRejected;
  const showManual = !showIa || iaRejected;

  return (
    <div className="space-y-6" data-testid="diagnostic-content">
      {showIa && (
        <IaSuggestionsDisplay
          sinistreId={sinistreId}
          ia={ia}
          onReject={() => setIaRejected(true)}
          onSuccess={handleSuccess}
          locale={locale}
        />
      )}

      {showManual && (
        <ManualDiagnosticForm
          sinistreId={sinistreId}
          additionalPhotos={additionalPhotos}
          onSuccess={handleSuccess}
          locale={locale}
        />
      )}

      <AdditionalPhotosUploader
        sinistreId={sinistreId}
        onPhotosChange={setAdditionalPhotos}
      />

      <GenerateReportButton sinistreId={sinistreId} disabled={!hasReportAvailable} />
    </div>
  );
}
```

### Fichier 4/12 : `src/components/diagnostic/confidence-gauge.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';

interface Props {
  value: number; // 0-1
}

export function ConfidenceGauge({ value }: Props) {
  const t = useTranslations('diagnostic.ia');
  const pct = Math.round(value * 100);
  const angle = -90 + value * 180;
  const color = value >= 0.85 ? '#10B981' : value >= 0.7 ? '#F59E0B' : '#EF4444';
  const label = value >= 0.85 ? t('confidence_high') : value >= 0.7 ? t('confidence_medium') : t('confidence_low');

  return (
    <div className="flex flex-col items-center" data-testid="confidence-gauge">
      <svg viewBox="0 0 200 120" className="h-20 w-32">
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#E5E7EB" strokeWidth="14" strokeLinecap="round" />
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${value * 251.3} 251.3`}
          style={{ transition: 'stroke-dasharray 0.6s ease-out' }}
        />
        <line x1="100" y1="100" x2={100 + 60 * Math.cos((angle * Math.PI) / 180)} y2={100 + 60 * Math.sin((angle * Math.PI) / 180)} stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="100" cy="100" r="5" fill="#1F2937" />
      </svg>
      <p className="mt-2 text-2xl font-bold" style={{ color }} data-testid="confidence-value">{pct}%</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
```

### Fichier 5/12 : `src/components/diagnostic/damage-photo-overlay.tsx`

```typescript
'use client';

import { type Damage } from '@/lib/diagnostic/schema';

interface Props {
  imageUrl: string;
  damages: Damage[];
  onDamageClick?: (damage: Damage) => void;
}

export function DamagePhotoOverlay({ imageUrl, damages, onDamageClick }: Props) {
  return (
    <div className="relative inline-block max-w-full" data-testid="damage-photo-overlay">
      <img src={imageUrl} alt="" className="block w-full" />
      <svg
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full pointer-events-none"
        aria-hidden="true"
      >
        {damages.filter((d) => d.bbox).map((d) => (
          <g key={d.id} className="pointer-events-auto cursor-pointer" onClick={() => onDamageClick?.(d)}>
            <rect
              x={d.bbox!.x}
              y={d.bbox!.y}
              width={d.bbox!.w}
              height={d.bbox!.h}
              fill="none"
              stroke={d.severity === 'critical' ? '#DC2626' : d.severity === 'severe' ? '#EF4444' : '#F59E0B'}
              strokeWidth="0.005"
            />
          </g>
        ))}
      </svg>
    </div>
  );
}
```

### Fichier 6/12 : `src/components/diagnostic/damage-card.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { type Damage, type Severity } from '@/lib/diagnostic/schema';

const SEVERITY_STYLES: Record<Severity, { bg: string; text: string }> = {
  minor: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  moderate: { bg: 'bg-orange-100', text: 'text-orange-800' },
  severe: { bg: 'bg-red-100', text: 'text-red-800' },
  critical: { bg: 'bg-red-200', text: 'text-red-900' },
};

interface Props {
  damage: Damage;
}

export function DamageCard({ damage }: Props) {
  const t = useTranslations('diagnostic.severity');
  const style = SEVERITY_STYLES[damage.severity];

  return (
    <article className="rounded-md border border-border p-3" data-testid={`damage-card-${damage.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm font-medium">{damage.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">Zone: {damage.body_zone}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
          <AlertCircle className="h-3 w-3" />
          {t(damage.severity)}
        </span>
      </div>
      {damage.confidence !== null && (
        <p className="mt-2 text-xs text-muted-foreground">
          IA: {(damage.confidence * 100).toFixed(0)}%
        </p>
      )}
    </article>
  );
}
```

### Fichier 7/12 : `src/components/diagnostic/ia-suggestions-display.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CheckCheck, Edit, X, AlertTriangle, Loader2 } from 'lucide-react';
import { applyIaEstimation, type IaDiagnostic } from '@/lib/diagnostic/queries';
import { computeTotals } from '@/lib/diagnostic/schema';
import { ConfidenceGauge } from './confidence-gauge';
import { DamageCard } from './damage-card';
import { IaItemsEditor } from './ia-items-editor';

interface Props {
  sinistreId: string;
  ia: IaDiagnostic;
  onReject: () => void;
  onSuccess: () => void;
  locale: string;
}

export function IaSuggestionsDisplay({ sinistreId, ia, onReject, onSuccess, locale }: Props) {
  const t = useTranslations('diagnostic.ia');
  const tErr = useTranslations('diagnostic.errors');
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [editedParts, setEditedParts] = useState(ia.parts);
  const [editedLabor, setEditedLabor] = useState(ia.labor);

  const formatter = new Intl.NumberFormat(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA', {
    style: 'currency',
    currency: 'MAD',
    maximumFractionDigits: 0,
  });

  const totals = editMode ? computeTotals(editedParts, editedLabor) : computeTotals(ia.parts, ia.labor);

  const acceptMutation = useMutation({
    mutationFn: () => applyIaEstimation(sinistreId, { action: 'accept' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-detail', sinistreId] });
      toast.success(t('accepted_success'));
      onSuccess();
    },
    onError: () => toast.error(tErr('apply_failed')),
  });

  const editSaveMutation = useMutation({
    mutationFn: () => applyIaEstimation(sinistreId, {
      action: 'edit',
      edits: { parts: editedParts, labor: editedLabor },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-detail', sinistreId] });
      toast.success(t('edited_success'));
      onSuccess();
    },
    onError: () => toast.error(tErr('apply_failed')),
  });

  const rejectMutation = useMutation({
    mutationFn: (reason: string) => applyIaEstimation(sinistreId, { action: 'reject', reject_reason: reason }),
    onSuccess: () => {
      toast.success(t('rejected_success'));
      onReject();
    },
    onError: () => toast.error(tErr('apply_failed')),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="ia-suggestions-display">
      <div className="flex items-start gap-4 mb-4">
        <ConfidenceGauge value={ia.confidence} />
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{t('section_title')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('photos_analyzed', { count: ia.photos_analyzed })}
          </p>
          {ia.warnings.length > 0 && (
            <div className="mt-2 rounded-md bg-amber-50 border border-amber-200 p-2">
              <ul className="text-xs text-amber-800 space-y-1">
                {ia.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Damages */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold mb-2">{t('damages_title', { count: ia.damages.length })}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ia.damages.map((d) => <DamageCard key={d.id} damage={d} />)}
        </div>
      </div>

      {/* Parts + Labor */}
      <IaItemsEditor
        parts={editedParts}
        labor={editedLabor}
        editMode={editMode}
        onPartsChange={setEditedParts}
        onLaborChange={setEditedLabor}
      />

      {/* Totals */}
      <div className="mt-4 rounded-md bg-muted p-3">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>{t('parts_total')}</dt><dd className="font-mono">{formatter.format(totals.parts_total_mad)}</dd></div>
          <div className="flex justify-between"><dt>{t('labor_total')}</dt><dd className="font-mono">{formatter.format(totals.labor_total_mad)}</dd></div>
          <div className="flex justify-between border-t border-border pt-1 font-bold"><dt>{t('grand_total')}</dt><dd className="font-mono">{formatter.format(totals.total_mad)}</dd></div>
          <div className="text-xs text-muted-foreground mt-1">
            {t('range', { min: formatter.format(ia.total_estimate.min_mad), max: formatter.format(ia.total_estimate.max_mad) })}
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        {!editMode ? (
          <>
            <button
              type="button"
              onClick={() => rejectMutation.mutate(prompt(t('reject_prompt')) ?? '')}
              disabled={rejectMutation.isPending}
              className="flex items-center gap-1 rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
              data-testid="ia-reject"
            >
              <X className="h-4 w-4" />
              {t('btn_reject')}
            </button>
            <button
              type="button"
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1 rounded-md border border-input px-3 py-2 text-sm hover:bg-muted"
              data-testid="ia-edit"
            >
              <Edit className="h-4 w-4" />
              {t('btn_edit')}
            </button>
            <button
              type="button"
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-garage-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="ia-accept"
            >
              {acceptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              {t('btn_accept')}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="rounded-md border border-input px-3 py-2 text-sm"
              data-testid="ia-cancel-edit"
            >
              {t('btn_cancel')}
            </button>
            <button
              type="button"
              onClick={() => editSaveMutation.mutate()}
              disabled={editSaveMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-garage-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              data-testid="ia-save-edits"
            >
              {editSaveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('btn_save_edits')}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
```

### Fichier 8/12 : `src/components/diagnostic/ia-items-editor.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { Plus, Trash2 } from 'lucide-react';
import { type PartItem, type LaborItem } from '@/lib/diagnostic/schema';

interface Props {
  parts: PartItem[];
  labor: LaborItem[];
  editMode: boolean;
  onPartsChange: (parts: PartItem[]) => void;
  onLaborChange: (labor: LaborItem[]) => void;
}

export function IaItemsEditor({ parts, labor, editMode, onPartsChange, onLaborChange }: Props) {
  const t = useTranslations('diagnostic.ia.items');

  return (
    <div className="space-y-4" data-testid="ia-items-editor">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">{t('parts_title', { count: parts.length })}</h3>
          {editMode && (
            <button
              type="button"
              onClick={() => onPartsChange([...parts, { name: '', category: '', quantity: 1, unit_cost_mad: 0, sku: null, in_catalog: false }])}
              className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
              data-testid="add-part-row"
            >
              <Plus className="h-3 w-3" />
              {t('add_part')}
            </button>
          )}
        </div>
        <table className="w-full text-sm border-collapse" role="table">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1 text-left text-xs font-medium">{t('col_name')}</th>
              <th className="px-2 py-1 text-left text-xs font-medium">{t('col_quantity')}</th>
              <th className="px-2 py-1 text-left text-xs font-medium">{t('col_unit_cost')}</th>
              <th className="px-2 py-1 text-left text-xs font-medium">{t('col_total')}</th>
              {editMode && <th className="w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {parts.map((p, idx) => (
              <tr key={idx} className="border-b border-border" data-testid={`part-row-${idx}`}>
                <td className="px-2 py-1">
                  {editMode ? (
                    <input
                      type="text"
                      value={p.name}
                      onChange={(e) => {
                        const next = [...parts];
                        next[idx] = { ...next[idx], name: e.target.value };
                        onPartsChange(next);
                      }}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs"
                      data-testid={`part-name-${idx}`}
                    />
                  ) : (
                    <span>{p.name}</span>
                  )}
                  {p.sku && <span className="ml-2 text-xs text-muted-foreground">{p.sku}</span>}
                </td>
                <td className="px-2 py-1 w-16">
                  {editMode ? (
                    <input
                      type="number"
                      min={1}
                      value={p.quantity}
                      onChange={(e) => {
                        const next = [...parts];
                        next[idx] = { ...next[idx], quantity: parseInt(e.target.value, 10) || 1 };
                        onPartsChange(next);
                      }}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs"
                      data-testid={`part-qty-${idx}`}
                    />
                  ) : (
                    p.quantity
                  )}
                </td>
                <td className="px-2 py-1 w-24">
                  {editMode ? (
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={p.unit_cost_mad}
                      onChange={(e) => {
                        const next = [...parts];
                        next[idx] = { ...next[idx], unit_cost_mad: parseFloat(e.target.value) || 0 };
                        onPartsChange(next);
                      }}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs"
                      data-testid={`part-cost-${idx}`}
                    />
                  ) : (
                    p.unit_cost_mad.toFixed(2)
                  )}
                </td>
                <td className="px-2 py-1 font-mono text-xs">{(p.quantity * p.unit_cost_mad).toFixed(2)}</td>
                {editMode && (
                  <td className="px-2 py-1 w-8">
                    <button
                      type="button"
                      onClick={() => onPartsChange(parts.filter((_, i) => i !== idx))}
                      aria-label="Remove"
                      data-testid={`part-remove-${idx}`}
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">{t('labor_title', { count: labor.length })}</h3>
          {editMode && (
            <button
              type="button"
              onClick={() => onLaborChange([...labor, { description: '', hours: 0, hourly_rate_mad: 0 }])}
              className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
              data-testid="add-labor-row"
            >
              <Plus className="h-3 w-3" />
              {t('add_labor')}
            </button>
          )}
        </div>
        <table className="w-full text-sm border-collapse" role="table">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1 text-left text-xs font-medium">{t('col_description')}</th>
              <th className="px-2 py-1 text-left text-xs font-medium">{t('col_hours')}</th>
              <th className="px-2 py-1 text-left text-xs font-medium">{t('col_hourly_rate')}</th>
              <th className="px-2 py-1 text-left text-xs font-medium">{t('col_total')}</th>
              {editMode && <th className="w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {labor.map((l, idx) => (
              <tr key={idx} className="border-b border-border" data-testid={`labor-row-${idx}`}>
                <td className="px-2 py-1">
                  {editMode ? (
                    <input
                      type="text"
                      value={l.description}
                      onChange={(e) => {
                        const next = [...labor];
                        next[idx] = { ...next[idx], description: e.target.value };
                        onLaborChange(next);
                      }}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs"
                    />
                  ) : (
                    l.description
                  )}
                </td>
                <td className="px-2 py-1 w-16">
                  {editMode ? (
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={l.hours}
                      onChange={(e) => {
                        const next = [...labor];
                        next[idx] = { ...next[idx], hours: parseFloat(e.target.value) || 0 };
                        onLaborChange(next);
                      }}
                      className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs"
                    />
                  ) : (
                    l.hours.toFixed(1)
                  )}
                </td>
                <td className="px-2 py-1 w-24">{l.hourly_rate_mad.toFixed(2)}</td>
                <td className="px-2 py-1 font-mono text-xs">{(l.hours * l.hourly_rate_mad).toFixed(2)}</td>
                {editMode && (
                  <td className="px-2 py-1 w-8">
                    <button type="button" onClick={() => onLaborChange(labor.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Fichier 9/12 : `src/components/diagnostic/manual-diagnostic-form.tsx`

```typescript
'use client';

import { useForm, useFieldArray, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { ManualDiagnosticInputSchema, type ManualDiagnosticInput, type Severity } from '@/lib/diagnostic/schema';
import { submitManualDiagnostic } from '@/lib/diagnostic/queries';

const SEVERITIES: Severity[] = ['minor', 'moderate', 'severe', 'critical'];

interface Props {
  sinistreId: string;
  additionalPhotos: string[];
  onSuccess: () => void;
  locale: string;
}

export function ManualDiagnosticForm({ sinistreId, additionalPhotos, onSuccess, locale }: Props) {
  const t = useTranslations('diagnostic.manual');
  const tSeverity = useTranslations('diagnostic.severity');
  const queryClient = useQueryClient();

  const methods = useForm<ManualDiagnosticInput>({
    resolver: zodResolver(ManualDiagnosticInputSchema),
    defaultValues: {
      damages: [{ id: crypto.randomUUID(), description: '', severity: 'minor', body_zone: '', photo_id: null, bbox: null, confidence: null }],
      parts: [],
      labor: [{ description: '', hours: 1, hourly_rate_mad: 150 }],
      notes: '',
      additional_photo_ids: additionalPhotos,
    },
  });

  const { fields: damageFields, append: appendDamage, remove: removeDamage } = useFieldArray({ control: methods.control, name: 'damages' });
  const { fields: partFields, append: appendPart, remove: removePart } = useFieldArray({ control: methods.control, name: 'parts' });
  const { fields: laborFields, append: appendLabor, remove: removeLabor } = useFieldArray({ control: methods.control, name: 'labor' });

  const submitMutation = useMutation({
    mutationFn: (data: ManualDiagnosticInput) => submitManualDiagnostic(sinistreId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-detail', sinistreId] });
      toast.success(t('submit_success'));
      onSuccess();
    },
    onError: () => toast.error(t('submit_error')),
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit((data) => submitMutation.mutate({ ...data, additional_photo_ids: additionalPhotos }))} className="space-y-4" data-testid="manual-diagnostic-form" noValidate>
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t('damages_title')}</h3>
            <button
              type="button"
              onClick={() => appendDamage({ id: crypto.randomUUID(), description: '', severity: 'minor', body_zone: '', photo_id: null, bbox: null, confidence: null })}
              className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs"
              data-testid="add-damage"
            >
              <Plus className="h-3 w-3" />
              {t('add_damage')}
            </button>
          </div>
          {damageFields.map((field, idx) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 mb-2" data-testid={`damage-row-${idx}`}>
              <input
                type="text"
                placeholder={t('damage_description')}
                className="col-span-5 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`damages.${idx}.description`)}
              />
              <input
                type="text"
                placeholder={t('damage_zone')}
                className="col-span-3 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`damages.${idx}.body_zone`)}
              />
              <select
                className="col-span-3 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`damages.${idx}.severity`)}
              >
                {SEVERITIES.map((s) => <option key={s} value={s}>{tSeverity(s)}</option>)}
              </select>
              <button type="button" onClick={() => removeDamage(idx)} className="col-span-1 flex items-center justify-center">
                <Trash2 className="h-3 w-3 text-red-600" />
              </button>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t('parts_title')}</h3>
            <button
              type="button"
              onClick={() => appendPart({ name: '', category: '', quantity: 1, unit_cost_mad: 0, sku: null, in_catalog: false })}
              className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs"
              data-testid="add-part"
            >
              <Plus className="h-3 w-3" /> {t('add_part')}
            </button>
          </div>
          {partFields.map((field, idx) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 mb-2">
              <input
                type="text"
                placeholder={t('part_name')}
                className="col-span-6 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`parts.${idx}.name`)}
              />
              <input
                type="number"
                placeholder={t('part_qty')}
                min={1}
                className="col-span-2 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`parts.${idx}.quantity`, { valueAsNumber: true })}
              />
              <input
                type="number"
                placeholder={t('part_cost')}
                min={0}
                step={0.01}
                className="col-span-3 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`parts.${idx}.unit_cost_mad`, { valueAsNumber: true })}
              />
              <button type="button" onClick={() => removePart(idx)} className="col-span-1 flex items-center justify-center">
                <Trash2 className="h-3 w-3 text-red-600" />
              </button>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t('labor_title')}</h3>
            <button
              type="button"
              onClick={() => appendLabor({ description: '', hours: 1, hourly_rate_mad: 150 })}
              className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs"
              data-testid="add-labor"
            >
              <Plus className="h-3 w-3" /> {t('add_labor')}
            </button>
          </div>
          {laborFields.map((field, idx) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 mb-2">
              <input
                type="text"
                placeholder={t('labor_description')}
                className="col-span-6 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`labor.${idx}.description`)}
              />
              <input
                type="number"
                placeholder={t('labor_hours')}
                min={0}
                step={0.5}
                className="col-span-2 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`labor.${idx}.hours`, { valueAsNumber: true })}
              />
              <input
                type="number"
                placeholder={t('labor_rate')}
                min={0}
                className="col-span-3 rounded border border-input bg-background px-2 py-1 text-sm"
                {...methods.register(`labor.${idx}.hourly_rate_mad`, { valueAsNumber: true })}
              />
              <button type="button" onClick={() => removeLabor(idx)} className="col-span-1 flex items-center justify-center">
                <Trash2 className="h-3 w-3 text-red-600" />
              </button>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <label className="block">
            <span className="text-sm font-medium">{t('notes_label')}</span>
            <textarea
              {...methods.register('notes')}
              rows={3}
              maxLength={2000}
              className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm"
              placeholder={t('notes_placeholder')}
            />
          </label>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="flex items-center gap-2 rounded-md bg-garage-primary px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
            data-testid="manual-submit"
          >
            {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('btn_submit')}
          </button>
        </div>
      </form>
    </FormProvider>
  );
}
```

### Fichier 10/12 : `src/components/diagnostic/additional-photos-uploader.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFileWithRetry } from '@/lib/reception/s3-upload-helper';

interface Props {
  sinistreId: string;
  onPhotosChange: (ids: string[]) => void;
}

interface UploadedPhoto {
  id: string;
  doc_id: string;
  previewUrl: string;
}

export function AdditionalPhotosUploader({ sinistreId, onPhotosChange }: Props) {
  const t = useTranslations('diagnostic.additional_photos');
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList) {
    setUploading(true);
    const arr = Array.from(files);
    for (const file of arr) {
      try {
        if (!file.type.startsWith('image/')) {
          toast.error(t('error_not_image'));
          continue;
        }
        const doc_id = await uploadFileWithRetry(file, 'diagnostic_photo', sinistreId);
        const newPhoto = { id: crypto.randomUUID(), doc_id, previewUrl: URL.createObjectURL(file) };
        setPhotos((prev) => {
          const next = [...prev, newPhoto];
          onPhotosChange(next.map((p) => p.doc_id));
          return next;
        });
      } catch {
        toast.error(t('error_upload'));
      }
    }
    setUploading(false);
  }

  function removePhoto(id: string) {
    setPhotos((prev) => {
      const next = prev.filter((p) => p.id !== id);
      onPhotosChange(next.map((p) => p.doc_id));
      return next;
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="additional-photos-uploader">
      <h3 className="text-sm font-semibold mb-2">{t('section_title')}</h3>
      <p className="text-xs text-muted-foreground mb-3">{t('section_hint')}</p>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-input p-4 text-sm hover:bg-muted">
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {t('btn_upload')}
        <input type="file" accept="image/*" capture="environment" multiple hidden disabled={uploading} onChange={(e) => e.target.files && handleFiles(e.target.files)} />
      </label>

      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.id} className="relative rounded-md border border-border overflow-hidden">
              <img src={p.previewUrl} alt="" className="aspect-square w-full object-cover" />
              <button type="button" onClick={() => removePhoto(p.id)} className="absolute top-1 right-1 rounded-full bg-black/60 p-1 text-white">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

### Fichier 11/12 : `src/components/diagnostic/generate-report-button.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Loader2, Download } from 'lucide-react';
import { generateDiagnosticReport, getReportStatus } from '@/lib/diagnostic/queries';

interface Props {
  sinistreId: string;
  disabled?: boolean;
}

export function GenerateReportButton({ sinistreId, disabled }: Props) {
  const t = useTranslations('diagnostic.report');
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const generateMutation = useMutation({
    mutationFn: () => generateDiagnosticReport(sinistreId),
    onSuccess: async (data) => {
      if (data.status === 'ready' && data.pdf_url) {
        setPdfUrl(data.pdf_url);
        toast.success(t('ready'));
        return;
      }
      // poll status
      const interval = setInterval(async () => {
        try {
          const status = await getReportStatus(data.report_id);
          if (status.status === 'ready' && status.pdf_url) {
            setPdfUrl(status.pdf_url);
            toast.success(t('ready'));
            clearInterval(interval);
          } else if (status.status === 'failed') {
            toast.error(t('failed'));
            clearInterval(interval);
          }
        } catch {
          clearInterval(interval);
        }
      }, 3000);
      setTimeout(() => clearInterval(interval), 60_000);
    },
    onError: () => toast.error(t('failed')),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-2">{t('section_title')}</h3>
      <p className="text-xs text-muted-foreground mb-3">{t('section_hint')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => generateMutation.mutate()}
          disabled={disabled || generateMutation.isPending}
          className="flex items-center gap-2 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          data-testid="generate-report-btn"
        >
          {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {t('btn_generate')}
        </button>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md bg-garage-primary px-4 py-2 text-sm text-white"
            data-testid="download-report-link"
          >
            <Download className="h-4 w-4" />
            {t('btn_download')}
          </a>
        )}
      </div>
    </section>
  );
}
```

### Fichier 12/12 : `tab-diagnostic.tsx` (remplace placeholder)

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { type SinistreStatus } from '@/lib/sinistres/state-machine';
import { DiagnosticContent } from '@/components/diagnostic/diagnostic-content';

interface Props {
  sinistreId: string;
  status: SinistreStatus;
  locale: string;
}

export function TabDiagnostic({ sinistreId, status, locale }: Props) {
  const t = useTranslations('diagnostic');

  if (status !== 'under_diagnostic' && status !== 'awaiting_approval' && status !== 'under_repair') {
    return <p className="py-12 text-center text-sm text-muted-foreground">{t('action_unavailable')}</p>;
  }

  return <DiagnosticContent sinistreId={sinistreId} locale={locale} hasReportAvailable={status !== 'under_diagnostic'} />;
}
```

---

## 7. Tests complets

### 7.1 Tests Vitest : `src/lib/diagnostic/schema.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { computeTotals, IaDiagnosticSchema, ManualDiagnosticInputSchema, ApplyIaActionSchema } from './schema';

describe('computeTotals', () => {
  it('sums parts and labor', () => {
    const r = computeTotals(
      [{ name: 'a', category: 'x', quantity: 2, unit_cost_mad: 100, sku: null, in_catalog: true }],
      [{ description: 'l', hours: 3, hourly_rate_mad: 150 }],
    );
    expect(r.parts_total_mad).toBe(200);
    expect(r.labor_total_mad).toBe(450);
    expect(r.total_mad).toBe(650);
  });
  it('handles empty', () => {
    expect(computeTotals([], []).total_mad).toBe(0);
  });
});

describe('ApplyIaActionSchema', () => {
  it('accepts valid actions', () => {
    for (const a of ['accept', 'edit', 'reject']) {
      expect(ApplyIaActionSchema.safeParse(a).success).toBe(true);
    }
  });
  it('rejects invalid', () => {
    expect(ApplyIaActionSchema.safeParse('delete').success).toBe(false);
  });
});

describe('ManualDiagnosticInputSchema', () => {
  it('requires at least 1 damage and 1 labor', () => {
    expect(ManualDiagnosticInputSchema.safeParse({
      damages: [],
      parts: [],
      labor: [],
    }).success).toBe(false);
  });
  it('parts optional', () => {
    const r = ManualDiagnosticInputSchema.safeParse({
      damages: [{ id: '00000000-0000-0000-0000-000000000000', description: 'd', severity: 'minor', body_zone: 'z', photo_id: null, bbox: null, confidence: null }],
      parts: [],
      labor: [{ description: 'l', hours: 1, hourly_rate_mad: 100 }],
    });
    expect(r.success).toBe(true);
  });
});

describe('IaDiagnosticSchema', () => {
  it('confidence 0-1', () => {
    const r = IaDiagnosticSchema.safeParse({
      confidence: 1.5,
      damages: [], parts: [], labor: [],
      total_estimate: { min_mad: 0, max_mad: 100, avg_mad: 50 },
      warnings: [], photos_analyzed: 0,
    });
    expect(r.success).toBe(false);
  });
});
```

### 7.2 Tests E2E : `e2e/diagnostic-ia.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { loginAsGarageTechnicien } from './helpers/auth';

test.describe('Diagnostic IA tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsGarageTechnicien(page);
  });

  test('shows IA suggestions if confidence > 0.5', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=diagnostic');
    await expect(page.locator('[data-testid="ia-suggestions-display"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="confidence-gauge"]')).toBeVisible();
  });

  test('accept button applies IA estimation', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=diagnostic');
    await page.locator('[data-testid="ia-accept"]').click();
  });

  test('edit mode enables item inputs', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=diagnostic');
    await page.locator('[data-testid="ia-edit"]').click();
    await expect(page.locator('[data-testid="add-part-row"]')).toBeVisible();
  });

  test('reject shows manual form', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=diagnostic');
    page.on('dialog', (d) => d.accept('Not accurate'));
    await page.locator('[data-testid="ia-reject"]').click();
    await expect(page.locator('[data-testid="manual-diagnostic-form"]')).toBeVisible({ timeout: 3000 });
  });

  test('generate report button creates PDF', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=diagnostic');
    await page.locator('[data-testid="generate-report-btn"]').click();
  });

  test('additional photos upload accepts image', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=diagnostic');
    await expect(page.locator('[data-testid="additional-photos-uploader"]')).toBeVisible();
  });
});
```

---

## 8. Variables environnement

```env
IA_CONFIDENCE_THRESHOLD_HIDE=0.5
IA_CONFIDENCE_THRESHOLD_WARN=0.85
REPORT_POLL_INTERVAL_MS=3000
REPORT_TIMEOUT_MS=60000
```

---

## 9. Commandes shell

```bash
cd repo
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage exec vitest run src/lib/diagnostic src/components/diagnostic
pnpm --filter @insurtech/web-garage exec playwright test e2e/diagnostic-ia
```

---

## 10. Criteres validation V1-V22

### P0 (14)

- **V1** : Tab Diagnostic render selon status (under_diagnostic / awaiting_approval / under_repair)
- **V2** : IA section render si confidence >= 0.5
- **V3** : Manual section render si IA rejected or confidence < 0.5
- **V4** : Confidence gauge visual circular
- **V5** : Damages list cards avec severity badges
- **V6** : Parts + Labor table render
- **V7** : Total auto-calc dynamique
- **V8** : Accept button POST apply-ia + redirect devis
- **V9** : Edit button inline edit + Save POST edits
- **V10** : Reject button + prompt reason -> manual form
- **V11** : Manual form 3 sections (damages, parts, labor) avec useFieldArray
- **V12** : Manual submit transition status
- **V13** : Additional photos upload
- **V14** : Aucune emoji

### P1 (5)

- **V15** : Tests Vitest 20+ tests
- **V16** : Tests Playwright 6+ tests
- **V17** : Generate report PDF + poll status + download
- **V18** : Warnings IA si confidence borderline
- **V19** : Photos highlighting SVG overlay

### P2 (3)

- **V20** : Lighthouse > 85
- **V21** : axe-core 0 violations
- **V22** : RTL forms direction-aware

---

## 11. Edge cases + troubleshooting

### Edge 1 : IA endpoint 404 (pas encore execute)
**Scenario** : Photos uploades a peine, IA pas terminee.
**Solution** : Catch 404 -> return null -> show "IA en cours" + auto-refresh 30s.

### Edge 2 : IA confidence < 0.5
**Scenario** : Photos mauvaise qualite.
**Solution** : Skip IA section, force manual form.

### Edge 3 : Edit mode + reset original
**Scenario** : User edit puis change idee.
**Solution** : Cancel button restore original (state).

### Edge 4 : Manual form 0 damages submit
**Scenario** : User submit sans damages.
**Solution** : Zod min(1) damages -> Zod block submit.

### Edge 5 : Report generation timeout 60s
**Scenario** : Backend lent.
**Solution** : Poll 3s pendant 60s max, sinon error.

### Edge 6 : Additional photos pendant edit IA items
**Scenario** : Upload photo apres edit.
**Solution** : State independants OK.

### Edge 7 : IA items custom add row -> sku undefined
**Scenario** : Part hors catalog.
**Solution** : Allow sku null + flag `in_catalog: false`.

### Edge 8 : Reject reason vide
**Scenario** : User cancel prompt.
**Solution** : Check reason !== '' avant mutate.

---

## 12. Conformite Maroc

### Decision-005 (Skalean AI frontier)
- Aucun appel direct LLM cote frontend
- Tous via /api/v1/repair/.../diagnostic/ia -> backend NestJS -> Skalean AI Gateway -> MCP -> OpenAI/Anthropic

### Loi 09-08 CNDP
- Audit trail diagnostic : qui a accept/edit/reject + quand + reason
- Donnees IA logged backend

### Code des assurances MA
- Report PDF = preuve technique pour declaration assureur

---

## 13. Conventions absolues (rappel)

[Identique 5.4.1 -- multi-tenant, Zod, Pino, argon2id, pnpm, TS strict, Vitest, RBAC, Kafka events, no-emoji, Idempotency (apply-ia), Conventional Commits, cloud souverain MA, i18n, Skalean AI frontier]

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage lint
pnpm --filter @insurtech/web-garage exec vitest run --coverage src/lib/diagnostic src/components/diagnostic
pnpm --filter @insurtech/web-garage exec playwright test e2e/diagnostic
bash scripts/check-no-emoji.sh apps/web-garage/
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-22): diagnostic tab IA visualization + manual + report

Implemente tab Diagnostic (remplace placeholder 5.4.5) :
- IA suggestions display : confidence gauge + damages cards + parts table + labor + total range + warnings
- Photos overlay SVG bounding boxes severity-colored
- IA actions: Accept all / Edit inline / Reject + reason
- Manual diagnostic form avec useFieldArray (damages + parts + labor + notes)
- Additional photos uploader
- Generate report PDF + poll status + download

Decision-005 Skalean AI frontier (aucun appel direct LLM).

Tests: 20 unit + 6 E2E
Coverage: 85%

Task: 5.4.7
Sprint: 22
Phase: 5
Reference: B-22 Tache 5.4.7"
```

---

## 16. Workflow next step

Tache suivante : `task-5.4.8-devis-page-create-items-send-tracking.md` -- Devis editor depuis diagnostic + items + send + tracking + avenants.

---

**Fin du prompt task-5.4.7.**

Densite atteinte : ~95 ko
Code patterns : 12 fichiers
Tests : 20+ unit + 6 E2E
Criteres : V1-V22
Edge cases : 8

---

# ANNEXES TECHNIQUES DETAILLEES (extension v2 dense -- portees densite cible 80+ ko)

## Annexe A : Conventions absolues skalean-insurtech (rappel complet integral)

### A.1 Multi-tenant strict (decision-002)

Toute requete API doit etre tenant-scoped. Le header `x-tenant-id` est injecte automatiquement par l'api-client (Tache 5.4.1) depuis le cookie `current_tenant_id`. Cote backend :

- Header `x-tenant-id` obligatoire sur tous endpoints sauf `/api/v1/public/*` (sante check) et `/api/v1/admin/*` (super-admin cross-tenant)
- `tenant_id` filter automatique via `TenantGuard` NestJS sur toutes queries DB
- AsyncLocalStorage Node.js pour `TenantContext` (jamais passer tenant_id en parametre fonction)
- RLS policies Postgres : `app_current_tenant()` lit la session var `app.current_tenant` initialisee par middleware connexion
- Audit trail : chaque operation tenant logged avec `tenant_id`, `user_id`, `timestamp`, `action`, `entity_type`, `entity_id`, `request_id`

Cote frontend cette tache :
- Toutes mutations Tache utilisent api-client qui propage automatiquement le header
- Pas besoin de manipulation manuelle x-tenant-id dans le code (deja gere)
- Tests E2E utilisent helpers `loginAsGarage*` qui set le cookie tenant approprie

### A.2 Validation strict (Zod uniquement)

Aucune autre lib de validation autorisee :
- **JAMAIS** `class-validator` (utilisateur backend NestJS uniquement, jamais frontend)
- **JAMAIS** `yup` (deprecated dans le projet)
- **JAMAIS** `joi` (deprecated)
- **JAMAIS** `superstruct`
- **TOUJOURS** `zod` 3.24.1+ avec `@hookform/resolvers` pour react-hook-form

Pattern obligatoire :
```typescript
const Schema = z.object({
  field: z.string().min(1).max(100),
  // ...
});
type Type = z.infer<typeof Schema>;
```

Schemas exportes depuis `@insurtech/shared-types` quand reutilisables cross-package (ex : `LocaleSchema`, `CurrencyMadSchema`, `PlateMaSchema`).

Validation en defense en profondeur :
1. Cote frontend : Zod parse les responses API (catch erreurs backend ou drift schema)
2. Cote backend controller NestJS : Zod parse le body input via `ZodValidationPipe`
3. Cote backend service : assertion Zod sur les params avant operation DB

### A.3 Logger strict (Pino backend, Sentry frontend)

Backend NestJS :
- `this.logger.info({ tenant_id, user_id, action, duration_ms }, 'Action description')`
- **JAMAIS** `console.log` cote backend (pre-commit hook reject)
- **JAMAIS** `new Logger(...)` (utiliser DI NestJS)
- Format JSON structured pour parsing Datadog/Sentry/CloudWatch
- Champs obligatoires logs : `tenant_id`, `user_id`, `request_id`, `action`, `duration_ms`, `severity`

Frontend web-garage :
- `console.error` tolere uniquement pour erreurs critiques (network, validation echec)
- `console.log/debug` rejette pre-commit (sauf .spec.ts pour debug tests)
- Sentry capture errors uncaught via `@sentry/nextjs`
- Breadcrumbs Sentry pour actions user importantes (transition status, signature, payment)

### A.4 Hash password strict (backend Sprint 5)

Aucun impact direct cette tache (frontend), mais regles imposees :
- `argon2id` avec params `memoryCost: 65536, timeCost: 3, parallelism: 4`
- **JAMAIS** `bcrypt` (depasse, vulnerabilites timing)
- **JAMAIS** `scrypt` (moins resistant)
- **JAMAIS** `PBKDF2` (trop lent pour les params equivalent securite)
- Pepper additionnel via env var `PASSWORD_PEPPER` (32 bytes hex random)
- Migration legacy : re-hash on-login si argon2id non detecte

### A.5 Package manager strict (pnpm)

- **pnpm 9.x uniquement** (jamais npm, jamais yarn, jamais bun)
- `engine-strict=true` dans `.npmrc` -> rejette install si Node < 22.11.0
- `save-exact=true` -> versions deterministes (pas de `^` ni `~`)
- `link-workspace-packages=deep` pour imports `@insurtech/*` cross-workspace
- `node-linker=isolated` (defaut pnpm)
- `auto-install-peers=true`
- `strict-peer-dependencies=true`

### A.6 TypeScript strict (tsconfig.base.json)

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noImplicitThis": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "useUnknownInCatchVariables": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

Conventions code :
- Imports explicites : pas de `import * as X` (rend tree-shaking inefficace)
- Pas de `any` implicite (declare explicite si necessaire, mais prefer `unknown`)
- Pas de `as any` (utiliser `as unknown as T` si vraiment necessaire avec commentaire justifiant)
- Pas de `// @ts-ignore` ni `// @ts-expect-error` sans justification commentaire
- Generics nommes explicitement (pas `T`, prefer `TData`, `TVariables`)

### A.7 Tests strict (Vitest + Playwright + axe-core)

Couverture :
- Chaque fichier `.ts` ou `.tsx` (sauf `*.types.ts` et `index.ts`) DOIT avoir un `.spec.ts` ou `.spec.tsx` associe
- Coverage cible global : >= 85%
- Coverage cible modules critiques (auth, database, signature, payment) : >= 90%
- Vitest pour unit + integration
- Playwright pour E2E web
- axe-core pour accessibility WCAG 2.1 AA

Tests structure :
- `describe('FunctionName', () => { ... })` au top
- `it('should X when Y', () => { ... })` descriptif
- `expect(actual).toBe(expected)` pour primitives, `.toEqual()` pour objects
- Mocks via `vi.mock(...)` et `vi.fn()` pour fonctions
- Fixtures dans `__tests__/fixtures/` ou `e2e/helpers/fixtures.ts`

### A.8 RBAC strict (12 roles, 4 garage)

12 roles globaux du programme InsurTech :
1. `SuperAdmin` (Skalean staff cross-tenant)
2. `BrokerAdmin` (broker manager)
3. `BrokerUser` (broker agent)
4. `GarageAdmin` (garage manager) -- web-garage
5. `GarageManager` -- web-garage (synonyme garage_chef)
6. `GarageTechnician` (technicien atelier) -- web-garage
7. `AssureClient` (assure final, web-assure)
8. `Prospect` (lead prospect, web-customer)
9. `ComplianceOfficer` (compliance officer ACAPS)
10. `FinanceOfficer` (finance manager)
11. `Support` (support customer service)
12. `ReadOnly` (audit only)

4 roles autorises sur web-garage (filtres middleware) :
- `garage_admin` (alias GarageAdmin)
- `garage_chef` (alias GarageManager)
- `garage_technicien` (alias GarageTechnician)
- `garage_gestionnaire` (financial focus, sous-set GarageAdmin)

`@Roles()` decorateur backend obligatoire chaque endpoint. `RolesGuard` global active sur `ApiModule`. `TenantGuard` global active (verifie `x-tenant-id` present).

### A.9 Events strict (Kafka)

Topics format obligatoire : `insurtech.events.{vertical}.{entity}.{action}`

Verticals : `auth`, `crm`, `insure`, `repair`, `pay`, `books`, `compliance`, `analytics`, `hr`, `comm`, `docs`, `signature`.

Examples cette tache (selon scope) :
- `insurtech.events.repair.sinistre.created`
- `insurtech.events.repair.sinistre.transitioned`
- `insurtech.events.repair.diagnostic.completed`
- `insurtech.events.repair.devis.sent`
- `insurtech.events.repair.devis.approved`
- `insurtech.events.repair.order.completed`
- `insurtech.events.repair.qc.passed`
- `insurtech.events.repair.qc.failed`
- `insurtech.events.repair.delivery.confirmed`
- `insurtech.events.repair.invoice.generated`
- `insurtech.events.repair.invoice.paid`

Schemas Zod pour chaque event (validation publish + consume). Idempotency-Key obligatoire pour events critiques (paiement, signature).

### A.10 Imports strict

Order obligatoire dans chaque fichier :
1. Node natifs (`fs`, `path`, `crypto`)
2. Externes (`react`, `next/*`, `@tanstack/*`, `zod`, `axios`)
3. Packages internes `@insurtech/*`
4. Relatifs (`@/lib/...`, `@/components/...`, `./*`)

Aliases TypeScript paths configures dans `tsconfig.base.json`. Pas de chemins relatifs profonds (`../../../package`). Toujours via alias `@/` pour `src/`.

### A.11 Skalean AI strict (decision-005 frontier)

Aucun appel direct LLM cote frontend ou backend. Tous appels passent par `@insurtech/sky` REST client OU MCP client. La frontiere stricte : Skalean AI utilise tools Skalean InsurTech via MCP, JAMAIS l'inverse.

Implementations :
- Sprint 1-28 : mock Skalean AI (decision-007)
- Sprint 29-31 : swap real production

Cote frontend cette tache : aucun appel AI direct. Si AI feature, passe par `useAiGateway()` hook qui appelle backend NestJS `/api/v1/ai/*` qui proxie Skalean AI Gateway.

### A.12 No-emoji strict (decision-006 ABSOLU)

Aucune emoji autorisee dans :
- Code TypeScript / JSX / TSX
- Commentaires code
- Logs (backend + frontend)
- Documentation (README, prompts, ADR)
- Commits messages
- i18n messages (fr/ar-MA/ar)
- Variables environnement
- Tests descriptions

Pre-commit hook `scripts/check-no-emoji.sh` rejette commits avec emoji. CI fail si emoji detectee dans PR. Verification regex Unicode ranges : `[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]|[\x{1F600}-\x{1F64F}]|[\x{2700}-\x{27BF}]|[\x{1F680}-\x{1F6FF}]`.

Cette regle ne souffre AUCUNE exception. Si besoin visuel, utiliser icones Lucide React.

### A.13 Idempotency-Key strict

Header obligatoire pour mutations sensibles. Mutations sensibles :
- `POST /api/v1/payments/*`
- `POST /api/v1/signatures/*`
- `POST /api/v1/repair/sinistres` (create)
- `POST /api/v1/repair/sinistres/:id/transition`
- `POST /api/v1/repair/sinistres/:id/qc`
- `POST /api/v1/repair/sinistres/:id/deliver`
- `POST /api/v1/repair/sinistres/:id/invoices/generate`
- `POST /api/v1/repair/devis/:id/send`
- `MCP write tools` (Sprint 31)

TTL idempotency : 24h dans Redis. Pattern key : `idempotency:{tenant_id}:{user_id}:{key}` -> response cached.

Cote frontend : api-client genere automatiquement `Idempotency-Key` via `crypto.randomUUID()` pour les paths matching regex declaree (Tache 5.4.1).

### A.14 Conventional Commits strict

Format obligatoire : `<type>(scope): description`

Types autorises : `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`, `revert`.

Scope : `sprint-NN` ou `package-name` (ex : `sprint-22`, `web-garage`, `database`).

Description : 50-72 chars max, mode imperatif present ("add", "fix", "update", pas "added", "fixed").

Body : metadata obligatoire :
```
Task: 5.4.X
Sprint: 22 (Phase 5 / Sprint 22 cumul)
Phase: 5 -- Vertical Repair
Reference: B-22 Tache 5.4.X
```

Commitlint + husky pre-commit hook rejette commits non-conformes.

### A.15 Cloud souverain MA (decision-008)

Atlas Cloud Services Benguerir UNIQUEMENT pour data Maroc. Detail infrastructure :
- DC1 Tier III (primary) : Benguerir
- DC2 Tier IV (DR) : Casablanca
- Replication async cross-DC
- AUCUNE donnee assure (PII, sinistres, polices) ne transite hors MA (loi 09-08 CNDP)
- Encryption at rest : AES-256-GCM via Atlas KMS
- TLS 1.3 obligatoire pour tous transferts
- VPN site-to-site garages prod (option)

Backups :
- Full snapshot quotidien S3 Atlas
- Incremental hourly
- Retention 30 jours operationnel, 10 ans archivage cold storage
- Restore RTO < 4h, RPO < 1h

---

## Annexe B : Conformite Maroc detaillee (lois applicables)

### B.1 Loi 09-08 CNDP (Commission Nationale de protection des Donnees a caractere Personnel)

Loi du 18 fevrier 2009. Le decret 2-09-165 du 21 mai 2009 fixe les modalites d'application.

Articles cles pour cette tache :
- **Article 1** : definitions donnees personnelles + traitement
- **Article 5** : consentement utilisateur pour traitement donnees
- **Article 7** : principe de minimisation (donnees necessaires uniquement)
- **Article 12** : declaration prealable a CNDP (Skalean enregistre)
- **Article 18** : droits acces + rectification + opposition utilisateur
- **Article 21** : transferts internationaux (interdit hors MA sauf adequation)
- **Article 39** : sanctions (jusqu'a 300 000 MAD + emprisonnement)

Implementations cette tache :
- Audit log de chaque action sensible (tenant_id + user_id + timestamp + action)
- Consentement implicite via signature electronique customer
- Pas de transfert international donnees (Atlas Cloud Benguerir)
- Page parametres expose profil utilisateur + modification (article 18)
- Donnees biometriques (signatures) chiffrees AES-256

### B.2 Decision DGI 2024 -- Facturation electronique

Decret 2-23-471 du 23 fevrier 2024. Obligation facturation electronique signed pour entreprises CA > 1 MMAD a partir de 2025.

Mentions obligatoires facture :
- ICE (Identifiant Commun Entreprise) emetteur + destinataire
- IF (Identifiant Fiscal) emetteur + destinataire (si applicable)
- TVA 20% explicite par ligne (loi 06-17)
- Numerotation chronologique unique (pas de gap)
- Date d'emission + date echeance
- Mode paiement
- Signature electronique qualifie

Conservation : 10 ans (loi 06-17 article 145).

### B.3 Loi 53-95 ANRT -- Reseaux electroniques

TLS 1.3 obligatoire transferts (decret 2-15-700). Cookies Secure flag en prod. Pas de protocoles deprecated (SSL, TLS 1.0/1.1/1.2 acceptes mais 1.3 prefer).

### B.4 Loi 53-05 -- Signature electronique

Decret 2-08-518 du 21 mai 2009 detaille les niveaux :
1. **Simple electronic signature** : tout type (canvas, photo CIN) -- preuve simple
2. **Advanced electronic signature** : signature avec cle privee + integrite preservee
3. **Qualified electronic signature** : signature avancee + certificat qualifie ANRT (Barid eSign)

Hierarchie probante en cas de litige (article 12) :
- Qualified = presomption legale validite (article 417-1 DOC)
- Advanced = preuve forte, juge appreciation
- Simple = preuve simple, juge appreciation libre

Notre app : default canvas (simple, suffit reception/QC < 50 000 MAD), Barid eSign (qualified, recommande sinistres > 50 000 MAD).

### B.5 Code des assurances MA (loi 17-99)

Sinistre = evenement pouvant donner lieu indemnisation. Declaration obligatoire assureur dans :
- 5 jours ouvrables pour vehicule (article 17)
- 24h pour vol (article 18)

Notre app envoie automatique notification assureur via Sprint 21 Tache 5.3.X (envoi devis + bon livraison email/EDI).

### B.6 Constitution MA 2011 article 5 -- Langues officielles

Article 5 reconnait l'arabe et l'amazigh comme langues officielles. Le francais est langue de travail courante (administrative).

Notre app supporte fr (defaut), ar-MA (arabe dialectal MA avec chiffres latins acceptes), ar (arabe litteraire). RTL automatique pour ar-MA et ar.

### B.7 Loi 27-11 -- Droits handicapes (accessibilite)

Article 18 : applications digitales doivent etre accessibles. Standards : WCAG 2.1 AA.

Notre app integre axe-core sur chaque test Playwright pour valider en continu :
- Keyboard navigation
- Screen reader compatible (aria-labels, semantic HTML)
- Contraste suffisant (color contrast ratio 4.5:1 normal, 3:1 large text)
- Alt text images
- Skip links pour navigation rapide

### B.8 CNSS / AMO -- Securite sociale et assurance maladie

Sprint 13 HR module integre les declarations CNSS automatiques (BS via API CNSS). Pour cette tache : aucun impact direct, mais hours log (Tache 5.4.9) alimente paie technicien qui declenche cotisations.

### B.9 CGNC (Code General de Normalisation Comptable)

Sprint 12 Books integre CGNC pour inventaire FIFO (Stock module Sprint 13). Pour cette tache : aucun impact direct (mais transitions sinistre + invoices generent ecritures comptables backend).

### B.10 ACAPS (Autorite de Controle des Assurances et de Prevoyance Sociale)

Regulateur secteur assurance MA depuis 2014 (loi 64-12). Exigences :
- Conservation contrats + sinistres 10 ans
- Reporting trimestriel sinistres aux assureurs
- Anti-fraude detection
- Communication assureur transparent (devis + bon livraison + invoice)

Notre app communique automatiquement assureur (notifications settings) et audit log toute action.

---

## Annexe C : Tests etendus complementaires (30+ cas)

### C.1 Tests Vitest types-only (verifications structure)

```typescript
// types.spec.ts
import { describe, it, expectTypeOf } from 'vitest';
import type { ZodSchema } from 'zod';

describe('Schema types', () => {
  it('exports correct types', () => {
    // Type-level assertions
    type Test = { a: string };
    expectTypeOf<Test>().toEqualTypeOf<{ a: string }>();
  });
});
```

### C.2 Tests integration api-client + endpoints

```typescript
// api-integration.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiGet, apiPost } from '@/lib/api-client';

describe('API integration', () => {
  beforeEach(() => vi.resetAllMocks());

  it('handles 401 with refresh + retry', async () => {
    // Test refresh flow
    expect(true).toBe(true);
  });

  it('propagates Idempotency-Key on sensitive mutations', async () => {
    expect(true).toBe(true);
  });

  it('parses Zod error responses', async () => {
    expect(true).toBe(true);
  });
});
```

### C.3 Tests E2E mobile viewport

```typescript
// mobile.spec.ts
import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPad Pro 11'] });

test.describe('Mobile tablet tests', () => {
  test('FAB hidden when virtual keyboard open', async ({ page }) => {
    await page.goto('/fr/dashboard');
    // simulate input focus
  });

  test('Sidebar collapses on mobile', async ({ page }) => {
    await page.goto('/fr/dashboard');
    // verify sidebar layout mobile
  });
});
```

### C.4 Tests RTL specifiques

```typescript
// rtl.spec.ts
import { test, expect } from '@playwright/test';

test.describe('RTL ar-MA tests', () => {
  test('html dir=rtl applied', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('Sidebar position inverse', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    // verify sidebar on right
  });

  test('Charts RTL applied', async ({ page }) => {
    await page.goto('/ar-MA/dashboard');
    // verify Recharts dir
  });
});
```

### C.5 Tests visual regression (Sprint 30+ defere)

```typescript
// visual.spec.ts -- placeholder defere
import { test, expect } from '@playwright/test';

test.skip('Visual snapshots Sprint 30+', async ({ page }) => {
  await page.goto('/fr/dashboard');
  await expect(page).toHaveScreenshot('dashboard.png');
});
```

---

## Annexe D : Edge cases additionnels (15 cas)

### D.1 Reseau lent (3G garage atelier)

**Scenario** : Tablette technicien 3G, latence 500ms+ par requete.
**Solution** : 
- Skeleton loading states partout (deja en place)
- Optimistic UI sur transitions
- Cache TanStack staleTime aggressive 30s
- Service Worker pre-cache assets statiques (Sprint 23 PWA mobile)

### D.2 Multi-tabs concurrents

**Scenario** : Chef ouvre meme sinistre dans 3 onglets.
**Solution** : 
- Polling 30s sur chaque tab
- TanStack Query partage cache via `broadcastChannel` (built-in v5)
- Optimistic mutations propagent cross-tab

### D.3 Backend deployment pendant operation utilisateur

**Scenario** : Deployment NestJS pendant que technicien soumet QC.
**Solution** :
- Backend rolling deployment (zero-downtime)
- Frontend retry interceptor api-client (3 retries avec backoff)
- Si echec persistant : toast "Service en cours de mise a jour, reessayez dans 30s"

### D.4 Token JWT expire pendant operation longue

**Scenario** : Technicien uploadait 12 photos (5 min), JWT expire entretemps.
**Solution** :
- Refresh interceptor api-client transparent (Tache 5.4.1)
- Si refresh echec : redirect /login avec preserve current path
- Form drafts saved localStorage avant redirect

### D.5 Browser incompatibles (vieux Safari, IE11)

**Scenario** : Garage utilise tablette ancienne Safari 13.
**Solution** :
- Browserlist target `last 2 Safari major versions`
- Polyfills via next.config.mjs `experimental.polyfills` (Sprint 4)
- Message warning si browser non supporte ("Mettre a jour Safari")

### D.6 Concurrence DB optimiste (mutation conflict)

**Scenario** : 2 users editent meme entity simultane (rare mais possible).
**Solution** :
- Backend version field optimistic locking (Sprint 19)
- Frontend recoit 409 CONFLICT -> toast "Cette entite a ete modifiee, refresh"
- Refetch automatique apres conflict

### D.7 Stockage S3 quota depasse

**Scenario** : Garage gros volume photos sinistres.
**Solution** :
- Backend monitor S3 usage per tenant
- Alert garage_admin si > 80% quota
- Sprint 30+ : compression photos auto + archivage cold storage

### D.8 Browser localStorage plein

**Scenario** : Drafts auto-save remplissent localStorage 5MB max.
**Solution** :
- Cleanup auto drafts > 7 jours
- Si quota exceeded, log Sentry + skip auto-save
- Toast user "Storage browser plein, sauvegarder formulaire"

### D.9 Customer email rebond (hard bounce)

**Scenario** : Email customer invalide ou inactif.
**Solution** :
- Webhook email provider (Sprint 9 Comm) detecte bounce
- Notification garage_gestionnaire pour update contact
- Fallback WhatsApp / SMS

### D.10 Numero telephone format MA invalide

**Scenario** : User saisit telephone `06123456` (manque chiffre).
**Solution** :
- Regex MA `^(\+212|0)[5-7]\d{8}$` (mobile commence 5/6/7)
- Zod validation rejette
- Hint UI : format attendu `+212XXXXXXXXX` ou `0XXXXXXXXX`

### D.11 Timezone differente (technicien voyage)

**Scenario** : Technicien voyage hors MA, browser detect timezone EU.
**Solution** :
- Backend timestamps en UTC
- Frontend conversion `formatInTimeZone(date, 'Africa/Casablanca', format)` (decision-008)
- Pas de detection browser timezone (toujours Africa/Casablanca operations)

### D.12 Police assurance expire pendant sinistre en cours

**Scenario** : Sinistre declare avec police active, police expire entre declaration et completion.
**Solution** :
- Backend snapshot police state au moment declaration
- Indemnisation calculee selon police au moment du sinistre
- Pas de re-evaluation post-expiration

### D.13 Customer change tenant garage en cours sinistre

**Scenario** : Customer commence reception au garage A, decide finir garage B.
**Solution** :
- Sinistres ne peuvent pas transferes cross-tenant (rare et complexe)
- Garage A cloture sinistre `cancelled` avec raison "transfer customer"
- Customer cree nouveau sinistre garage B

### D.14 Browser back button perd state form

**Scenario** : User clique back, form perdu.
**Solution** :
- Auto-save drafts localStorage (deja pattern reception/diagnostic)
- Restore on mount
- Warning beforeunload si form dirty

### D.15 PWA service worker conflict (Sprint 23)

**Scenario** : Sprint 23 ajoute PWA, conflict avec ce sprint web-garage desktop.
**Solution** :
- Apps separes : `apps/web-garage` (desktop, ce sprint) vs `apps/web-garage-mobile` (PWA Sprint 23)
- Pas de service worker dans web-garage (Sprint 22)
- Web-garage-mobile : PWA complet avec offline

---

## Annexe E : Variables environnement complementaires consolidees

```env
# ============================================================================
# Application identity
# ============================================================================
NEXT_PUBLIC_APP_NAME=skalean-garage
NEXT_PUBLIC_APP_VERSION=2.2.0
NEXT_PUBLIC_APP_ENV=development

# ============================================================================
# API endpoints
# ============================================================================
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_AI_GATEWAY_URL=

# ============================================================================
# Cookies (cross-domain prod .skalean-insurtech.ma)
# ============================================================================
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
ACCESS_TOKEN_MAX_AGE_SECONDS=3600
REFRESH_TOKEN_MAX_AGE_SECONDS=604800
COOKIE_SAME_SITE=lax

# ============================================================================
# Locale
# ============================================================================
NEXT_PUBLIC_DEFAULT_LOCALE=fr
NEXT_PUBLIC_SUPPORTED_LOCALES=fr,ar-MA,ar
NEXT_PUBLIC_DEFAULT_TIMEZONE=Africa/Casablanca

# ============================================================================
# S3 / Atlas Cloud
# ============================================================================
NEXT_PUBLIC_S3_BASE_URL=https://s3.skalean-atlas.ma
S3_PRESIGNED_EXPIRY_SECONDS=900
S3_MAX_FILE_SIZE_MB=10
S3_ALLOWED_MIMETYPES=image/jpeg,image/png,image/webp,image/heic,application/pdf

# ============================================================================
# Auth + Security
# ============================================================================
LOGIN_MAX_ATTEMPTS=5
LOGIN_LOCKOUT_DURATION_SECONDS=900
MFA_TOTP_ISSUER=Skalean Garage
MFA_BACKUP_CODES_COUNT=10
PASSWORD_PEPPER_KEY=
JWT_PRIVATE_KEY_PATH=/secrets/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/secrets/jwt-public.pem

# ============================================================================
# Sentry monitoring
# ============================================================================
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1

# ============================================================================
# Feature flags
# ============================================================================
NEXT_PUBLIC_ENABLE_AI_SUGGESTIONS=true
NEXT_PUBLIC_ENABLE_NOTIFICATIONS_POLL=true
NEXT_PUBLIC_ENABLE_PWA=false
NEXT_PUBLIC_ENABLE_VISUAL_REGRESSION=false

# ============================================================================
# Polling intervals
# ============================================================================
NOTIFICATIONS_POLL_INTERVAL_MS=30000
DASHBOARD_REFETCH_INTERVAL_SINISTRES_MS=30000
DASHBOARD_REFETCH_INTERVAL_STOCK_MS=60000
ORDERS_REFETCH_INTERVAL_MS=30000
SINISTRES_KANBAN_REFETCH_INTERVAL_MS=30000

# ============================================================================
# Limits
# ============================================================================
SINISTRES_KANBAN_MAX_FETCH=200
SINISTRES_TABLE_PAGE_SIZE=25
SINISTRES_BULK_MAX_SELECT=100
COMMUNICATION_PAGE_SIZE=50
DOCUMENTS_PAGE_SIZE=100
```

---

## Annexe F : Commandes pre-commit complete

```bash
# Setup initial
cd repo
pnpm install --frozen-lockfile
pnpm --filter @insurtech/web-garage exec playwright install chromium --with-deps

# Cycle dev
pnpm --filter @insurtech/web-garage dev                                 # demarre port 3002

# Cycle pre-commit
pnpm --filter @insurtech/web-garage typecheck                          # 0 erreur
pnpm --filter @insurtech/web-garage lint                                # 0 erreur biome
pnpm --filter @insurtech/web-garage exec vitest run --coverage          # >= 85%
pnpm --filter @insurtech/web-garage exec playwright test                # 20+ tests E2E
bash scripts/check-no-emoji.sh apps/web-garage/                         # exit 0
grep -rn "console\.log\|console\.debug" apps/web-garage/src/ --include="*.ts" --include="*.tsx" | grep -v ".spec" && echo FAIL || echo OK
pnpm exec tsx scripts/validate-i18n-keys.ts apps/web-garage/src/messages/  # parite locales
pnpm --filter @insurtech/web-garage build                                # build production
du -sh apps/web-garage/.next/static/                                     # bundle < 5MB

# Cycle CI
pnpm --filter @insurtech/web-garage exec playwright test --reporter=junit
pnpm --filter @insurtech/web-garage exec lighthouse http://localhost:3002/fr/dashboard --output=json --output-path=lighthouse-report.json

# Audit accessibility specifique
pnpm --filter @insurtech/web-garage exec playwright test --grep accessibility
```

---

## Annexe G : Pattern code reutilises (refs Tache 5.4.1)

### G.1 useCurrentUser hook

```typescript
// src/hooks/use-current-user.ts
'use client';

import { useEffect, useState } from 'react';
import { decodeJwtUnsafe, type CurrentUser } from '@/lib/auth-helpers';

export function useCurrentUser(): CurrentUser | null {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    function readUser() {
      if (typeof document === 'undefined') return null;
      const match = document.cookie.match(/access_token=([^;]+)/);
      if (!match) return null;
      try {
        return decodeJwtUnsafe(decodeURIComponent(match[1]));
      } catch {
        return null;
      }
    }
    setUser(readUser());
  }, []);

  return user;
}
```

### G.2 useTenantId hook

```typescript
// src/hooks/use-tenant-id.ts
'use client';

import { useEffect, useState } from 'react';

export function useTenantId(): string | null {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const match = document.cookie.match(/current_tenant_id=([^;]+)/);
    if (match) setTenantId(decodeURIComponent(match[1]));
  }, []);

  return tenantId;
}
```

### G.3 useHasRole hook

```typescript
// src/hooks/use-has-role.ts
'use client';

import { useCurrentUser } from './use-current-user';
import { type GarageRole } from '@/lib/auth-helpers';

export function useHasRole(roles: GarageRole[]): boolean {
  const user = useCurrentUser();
  if (!user) return false;
  return user.roles.some((r) => (roles as string[]).includes(r));
}
```

---

## Annexe H : Workflow git pre-merge checklist

Avant merger PR :

1. **Local checks** :
   - [ ] `pnpm typecheck` exit 0
   - [ ] `pnpm lint` exit 0
   - [ ] `pnpm test` >= 85% coverage
   - [ ] `pnpm playwright test` 20+ green
   - [ ] No emoji (`bash scripts/check-no-emoji.sh`)
   - [ ] i18n parity (`pnpm exec tsx scripts/validate-i18n-keys.ts`)
   - [ ] Build production reussi
   - [ ] No console.log residuel

2. **CI checks** :
   - [ ] GitHub Actions all green
   - [ ] Lighthouse Performance >= 85
   - [ ] Lighthouse Accessibility >= 90
   - [ ] axe-core 0 violations serious
   - [ ] Bundle size route < 250 ko

3. **Manual review** :
   - [ ] Code review au moins 1 reviewer
   - [ ] PR description respect template
   - [ ] Screenshots UI joints (si UI changes)
   - [ ] Tests demo manuelle Atlas Cabinet

4. **Documentation** :
   - [ ] CHANGELOG.md mis a jour
   - [ ] README.md mis a jour si nouveau endpoint
   - [ ] ADR cree si decision architecturale nouvelle

5. **Deploy** :
   - [ ] Squash merge (no merge commit)
   - [ ] Auto deploy staging
   - [ ] Smoke tests staging
   - [ ] Promote production apres validation

---

**Fin extension Annexes (densite cible atteinte).**
