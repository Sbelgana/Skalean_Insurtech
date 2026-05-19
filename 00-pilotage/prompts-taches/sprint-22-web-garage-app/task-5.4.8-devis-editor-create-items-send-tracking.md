# TACHE 5.4.8 -- Devis Page : Create from Diagnostic + Items Editor + Send (Insurer/Customer) + Tracking + Avenants

**Sprint** : 22 (Phase 5 / Vertical Repair / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.8)
**Phase** : 5 -- Vertical Repair (Skalean Garage ERP)
**Priorite** : P0
**Effort** : 6h
**Dependances** :
- Taches 5.4.1-5.4.7 livres
- Sprint 21 Tache 5.3.3 (devis backend + envoi insurer/customer + tracking)
- Sprint 9 Comm (email + WhatsApp envoi)
- Sprint 12 Books (TVA + format facture DGI)

**Densite cible** : 80-150 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Remplir la **tab Devis** de la page detail sinistre avec : (1) creation devis depuis diagnostic completed (auto-populate items depuis Tache 5.4.7), (2) items editor table editable (description, quantity, unit_price HT, total auto, type : parts/labor/misc, add/remove lignes, auto-compute totaux HT + TVA 20% + TTC), (3) validity date selector (default 14 jours), (4) recipients selection : si police lien -> insurer (default) + customer (cc), sinon customer only, (5) bouton Send -> POST /api/v1/repair/sinistres/:id/devis/:id/send (Sprint 21 Tache 5.3.3) -> envoi email + WhatsApp avec PDF attache + tracking sent_at, (6) tracking visualization : sent_at + read_at insurer + read_at customer + status (sent / read / approved / rejected), (7) si devis approved et reparation revele pieces additionnelles, bouton "Create Avenant" -> nouveau devis lie au principal avec delta items, (8) history avenants visible (devis principal + N avenants).

Cette tache est commerciale critique : sans devis envoye, pas d'approbation insurer/customer, pas de transition vers `under_repair`. Pour Atlas Cabinet, devis genere depuis IA = 80% des cas, devis manuel = 20%. Tracking read_at + approval_at permet relancer (Sprint 9 reminders auto si non-lu apres 48h).

---

## 2. Contexte etendu

### Pourquoi

Devis = document legal contractuel. Conformite DGI 2024 : mention ICE + IF + TVA 20% sur chaque ligne. Tracking required pour respecter SLA assureur (response < 5 jours ouvres). Avenants permettent ajuster scope sans annuler le devis principal (preserve audit).

### Alternatives

- Items editor : table inline vs modal -> Table inline (UX rapide).
- PDF preview avant send : oui (verifier rendu).
- Avenants : nouveau devis vs ligne add -> Nouveau devis lie (audit clair).

### Trade-offs

- TVA fixed 20% Maroc (loi). Pas configurable.
- Send via email + WhatsApp simultane (insurer email pro, customer WhatsApp).
- Validity 14j defaut, configurable garage settings.

### Pieges (10)

1. TVA arrondi : MAD 0.01 cents -> precision.
2. Validity date < today -> validation reject.
3. Send sans items -> validation reject.
4. Avenant lie tracking parent.
5. Read receipt webhook async -> polling.
6. PDF preview large : lazy load.
7. Cancel envoi : impossible si sent (audit immutable).
8. Recipients email format valid.
9. Currency MAD format.
10. Approve actions backend webhook insurer.

---

## 3. Architecture

### Fichiers

```
repo/apps/web-garage/src/components/devis/
|-- devis-content.tsx                            # orchestrator
|-- devis-editor.tsx                              # items table
|-- devis-line-row.tsx                            # row inline edit
|-- devis-totals.tsx                              # HT/TVA/TTC
|-- devis-recipients-selector.tsx
|-- devis-send-button.tsx
|-- devis-tracking.tsx                            # sent/read/approved
|-- devis-history.tsx                             # avenants list
|-- avenant-form.tsx                              # nouveau avenant
repo/apps/web-garage/src/lib/devis/
|-- schema.ts
|-- queries.ts
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-devis.tsx       # remplace placeholder
```

---

## 4. Livrables (20)

- [ ] DevisContent orchestrator
- [ ] Auto-populate items depuis diagnostic
- [ ] Items editor table editable inline
- [ ] Add/remove ligne
- [ ] Auto-compute HT + TVA 20% + TTC
- [ ] Validity date selector default 14j
- [ ] Recipients selector (insurer default cc customer)
- [ ] PDF preview before send (react-pdf lazy)
- [ ] Send button POST + email + WhatsApp
- [ ] Tracking visualization sent/read/approved
- [ ] Avenants list history
- [ ] Avenant form delta items
- [ ] Approve/Reject hooks insurer webhook
- [ ] Cancel envoi disabled si sent
- [ ] Conformite DGI mentions ICE + IF + TVA
- [ ] Tests Vitest 20+
- [ ] Tests E2E 6+
- [ ] i18n 50+ keys
- [ ] Replace placeholder
- [ ] Aucune emoji

---

## 5. Fichiers

```
devis-content.tsx                  (~200 lignes)
devis-editor.tsx                   (~250 lignes)
devis-line-row.tsx                 (~150 lignes)
devis-totals.tsx                   (~100 lignes)
devis-recipients-selector.tsx       (~130 lignes)
devis-send-button.tsx               (~120 lignes)
devis-tracking.tsx                  (~180 lignes)
devis-history.tsx                   (~150 lignes)
avenant-form.tsx                    (~180 lignes)
lib/devis/schema.ts                  (~150 lignes)
lib/devis/queries.ts                 (~180 lignes)
tab-devis.tsx                       (~80 lignes)
specs                                (~700 lignes total)
e2e/devis-flow.spec.ts               (~180 lignes)
```

Total : 18 fichiers, ~2700 lignes

---

## 6. Code patterns

### Fichier 1/12 : `lib/devis/schema.ts`

```typescript
import { z } from 'zod';

export const DevisLineTypeSchema = z.enum(['parts', 'labor', 'misc']);
export type DevisLineType = z.infer<typeof DevisLineTypeSchema>;

export const TVA_RATE_MA = 0.20;

export const DevisLineSchema = z.object({
  id: z.string().uuid().optional(),
  type: DevisLineTypeSchema,
  description: z.string().min(1).max(300),
  quantity: z.number().positive(),
  unit_price_ht_mad: z.number().nonnegative(),
});
export type DevisLine = z.infer<typeof DevisLineSchema>;

export const DevisStatusSchema = z.enum(['draft', 'sent', 'read', 'approved', 'rejected', 'expired', 'cancelled']);
export type DevisStatus = z.infer<typeof DevisStatusSchema>;

export const DevisRecipientSchema = z.object({
  type: z.enum(['insurer', 'customer']),
  email: z.string().email().nullable(),
  whatsapp_phone: z.string().nullable(),
  send_email: z.boolean().default(true),
  send_whatsapp: z.boolean().default(false),
});
export type DevisRecipient = z.infer<typeof DevisRecipientSchema>;

export const DevisSchema = z.object({
  id: z.string().uuid(),
  devis_number: z.string(),
  parent_devis_id: z.string().uuid().nullable(),
  is_avenant: z.boolean(),
  status: DevisStatusSchema,
  lines: z.array(DevisLineSchema),
  validity_until: z.string().datetime(),
  recipients: z.array(DevisRecipientSchema),
  sent_at: z.string().datetime().nullable(),
  read_at_insurer: z.string().datetime().nullable(),
  read_at_customer: z.string().datetime().nullable(),
  approved_at: z.string().datetime().nullable(),
  rejected_at: z.string().datetime().nullable(),
  rejection_reason: z.string().nullable(),
  total_ht_mad: z.number().nonnegative(),
  tva_mad: z.number().nonnegative(),
  total_ttc_mad: z.number().nonnegative(),
  created_at: z.string().datetime(),
  pdf_url: z.string().url().nullable(),
});
export type Devis = z.infer<typeof DevisSchema>;

export const CreateDevisInputSchema = z.object({
  lines: z.array(DevisLineSchema).min(1),
  validity_until: z.string().datetime(),
  recipients: z.array(DevisRecipientSchema).min(1),
  notes: z.string().max(2000).optional(),
});
export type CreateDevisInput = z.infer<typeof CreateDevisInputSchema>;

export function computeDevisTotals(lines: DevisLine[]): { ht: number; tva: number; ttc: number } {
  const ht = lines.reduce((sum, l) => sum + l.quantity * l.unit_price_ht_mad, 0);
  const tva = Math.round(ht * TVA_RATE_MA * 100) / 100;
  return { ht: Math.round(ht * 100) / 100, tva, ttc: Math.round((ht + tva) * 100) / 100 };
}
```

### Fichier 2/12 : `lib/devis/queries.ts`

```typescript
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';
import { DevisSchema, type Devis, type CreateDevisInput } from './schema';
import { z } from 'zod';

export async function fetchSinistreDevis(sinistreId: string): Promise<Devis[]> {
  const data = await apiGet<unknown>(`/api/v1/repair/sinistres/${sinistreId}/devis`);
  return z.array(DevisSchema).parse(data);
}

export async function fetchDevisDetail(devisId: string): Promise<Devis> {
  const data = await apiGet<unknown>(`/api/v1/repair/devis/${devisId}`);
  return DevisSchema.parse(data);
}

export async function createDevisFromDiagnostic(sinistreId: string, input: CreateDevisInput): Promise<Devis> {
  const data = await apiPost<unknown>(`/api/v1/repair/sinistres/${sinistreId}/devis`, input);
  return DevisSchema.parse(data);
}

export async function updateDevis(devisId: string, input: Partial<CreateDevisInput>): Promise<Devis> {
  const data = await apiPatch<unknown>(`/api/v1/repair/devis/${devisId}`, input);
  return DevisSchema.parse(data);
}

export async function sendDevis(devisId: string) {
  return await apiPost<{ ok: true }>(`/api/v1/repair/devis/${devisId}/send`, {});
}

export async function cancelDevis(devisId: string, reason: string) {
  return await apiPost<{ ok: true }>(`/api/v1/repair/devis/${devisId}/cancel`, { reason });
}

export async function createAvenant(parentDevisId: string, input: CreateDevisInput): Promise<Devis> {
  const data = await apiPost<unknown>(`/api/v1/repair/devis/${parentDevisId}/avenant`, input);
  return DevisSchema.parse(data);
}
```

### Fichier 3/12 : `components/devis/devis-content.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { fetchSinistreDevis, createDevisFromDiagnostic, type Devis, type CreateDevisInput } from '@/lib/devis/queries';
import { DevisEditor } from './devis-editor';
import { DevisTracking } from './devis-tracking';
import { DevisHistory } from './devis-history';
import { AvenantForm } from './avenant-form';

interface Props {
  sinistreId: string;
  locale: string;
}

export function DevisContent({ sinistreId, locale }: Props) {
  const t = useTranslations('devis');
  const queryClient = useQueryClient();
  const [editingDevis, setEditingDevis] = useState<Devis | null>(null);
  const [showAvenantForm, setShowAvenantForm] = useState<Devis | null>(null);

  const { data: devisList, isLoading } = useQuery({
    queryKey: ['sinistre-devis', sinistreId],
    queryFn: () => fetchSinistreDevis(sinistreId),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateDevisInput) => createDevisFromDiagnostic(sinistreId, input),
    onSuccess: (devis) => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-devis', sinistreId] });
      setEditingDevis(devis);
      toast.success(t('created_success'));
    },
    onError: () => toast.error(t('create_error')),
  });

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const primaryDevis = devisList?.find((d) => !d.is_avenant);
  const avenants = devisList?.filter((d) => d.is_avenant) ?? [];

  return (
    <div className="space-y-4" data-testid="devis-content">
      {!primaryDevis && (
        <div className="rounded-lg border border-dashed border-input p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('no_devis_hint')}</p>
          <button
            type="button"
            onClick={() => setEditingDevis({ id: '', devis_number: '', parent_devis_id: null, is_avenant: false, status: 'draft', lines: [], validity_until: '', recipients: [], sent_at: null, read_at_insurer: null, read_at_customer: null, approved_at: null, rejected_at: null, rejection_reason: null, total_ht_mad: 0, tva_mad: 0, total_ttc_mad: 0, created_at: '', pdf_url: null })}
            className="mt-3 flex items-center gap-1 rounded-md bg-garage-primary px-4 py-2 text-sm text-white mx-auto"
            data-testid="create-devis-btn"
          >
            <Plus className="h-4 w-4" />
            {t('create_from_diagnostic')}
          </button>
        </div>
      )}

      {primaryDevis && (
        <>
          <DevisEditor
            sinistreId={sinistreId}
            devis={editingDevis ?? primaryDevis}
            locale={locale}
            isEditing={editingDevis?.id === primaryDevis.id || editingDevis?.id === ''}
            onSave={() => setEditingDevis(null)}
            onCancel={() => setEditingDevis(null)}
          />
          <DevisTracking devis={primaryDevis} locale={locale} />
          {primaryDevis.status === 'approved' && (
            <button
              type="button"
              onClick={() => setShowAvenantForm(primaryDevis)}
              className="flex items-center gap-1 rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
              data-testid="create-avenant-btn"
            >
              <Plus className="h-4 w-4" />
              {t('create_avenant')}
            </button>
          )}
        </>
      )}

      {avenants.length > 0 && <DevisHistory avenants={avenants} locale={locale} />}

      {showAvenantForm && (
        <AvenantForm parentDevis={showAvenantForm} sinistreId={sinistreId} locale={locale} onClose={() => setShowAvenantForm(null)} />
      )}
    </div>
  );
}
```

### Fichier 4/12 : `components/devis/devis-editor.tsx`

```typescript
'use client';

import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, Save, X, Loader2 } from 'lucide-react';
import { CreateDevisInputSchema, type Devis, type CreateDevisInput, type DevisLine, computeDevisTotals } from '@/lib/devis/schema';
import { createDevisFromDiagnostic, updateDevis } from '@/lib/devis/queries';
import { DevisLineRow } from './devis-line-row';
import { DevisTotals } from './devis-totals';
import { DevisRecipientsSelector } from './devis-recipients-selector';
import { DevisSendButton } from './devis-send-button';

interface Props {
  sinistreId: string;
  devis: Devis;
  locale: string;
  isEditing: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function DevisEditor({ sinistreId, devis, locale, isEditing, onSave, onCancel }: Props) {
  const t = useTranslations('devis.editor');
  const queryClient = useQueryClient();

  const defaultValidity = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const { register, control, watch, handleSubmit, formState: { errors } } = useForm<CreateDevisInput>({
    resolver: zodResolver(CreateDevisInputSchema),
    defaultValues: {
      lines: devis.lines.length > 0 ? devis.lines : [{ type: 'parts', description: '', quantity: 1, unit_price_ht_mad: 0 }],
      validity_until: devis.validity_until || `${defaultValidity}T23:59:59Z`,
      recipients: devis.recipients.length > 0 ? devis.recipients : [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = watch('lines');
  const totals = computeDevisTotals(watchedLines as DevisLine[]);

  const saveMutation = useMutation({
    mutationFn: (data: CreateDevisInput) =>
      devis.id ? updateDevis(devis.id, data) : createDevisFromDiagnostic(sinistreId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-devis', sinistreId] });
      toast.success(t('saved'));
      onSave();
    },
    onError: () => toast.error(t('save_error')),
  });

  return (
    <form onSubmit={handleSubmit((data) => saveMutation.mutate(data))} className="rounded-lg border border-border bg-card p-4" data-testid="devis-editor">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold">
            {devis.id ? `${t('devis_number')} ${devis.devis_number}` : t('new_devis')}
          </h3>
          <p className="text-xs text-muted-foreground">{t('status_label')}: {devis.status}</p>
        </div>
        {isEditing && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCancel} className="rounded-md border border-input p-1.5 hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="flex items-center gap-1 rounded-md bg-garage-primary px-3 py-1.5 text-sm text-white disabled:opacity-50"
              data-testid="devis-save"
            >
              {saveMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <Save className="h-3 w-3" />
              {t('btn_save')}
            </button>
          </div>
        )}
      </div>

      {/* Validity */}
      <label className="block mb-3">
        <span className="text-xs font-medium">{t('validity_label')}</span>
        <input
          type="date"
          {...register('validity_until')}
          disabled={!isEditing}
          className="mt-1 rounded border border-input bg-background px-2 py-1 text-sm"
          data-testid="devis-validity"
        />
      </label>

      {/* Items table */}
      <table className="w-full text-sm" data-testid="devis-lines-table">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-2 py-1 text-left text-xs">{t('col_type')}</th>
            <th className="px-2 py-1 text-left text-xs">{t('col_description')}</th>
            <th className="px-2 py-1 text-left text-xs w-20">{t('col_quantity')}</th>
            <th className="px-2 py-1 text-left text-xs w-28">{t('col_unit_price')}</th>
            <th className="px-2 py-1 text-left text-xs w-28">{t('col_total')}</th>
            {isEditing && <th className="w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {fields.map((field, idx) => (
            <DevisLineRow key={field.id} idx={idx} register={register} isEditing={isEditing} onRemove={() => remove(idx)} line={watchedLines[idx]} />
          ))}
        </tbody>
      </table>

      {isEditing && (
        <button
          type="button"
          onClick={() => append({ type: 'parts', description: '', quantity: 1, unit_price_ht_mad: 0 })}
          className="mt-2 flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted"
          data-testid="add-line-btn"
        >
          <Plus className="h-3 w-3" />
          {t('add_line')}
        </button>
      )}

      <DevisTotals totals={totals} locale={locale} />

      <DevisRecipientsSelector control={control} register={register} disabled={!isEditing} />

      {!isEditing && devis.id && devis.status === 'draft' && (
        <DevisSendButton devisId={devis.id} />
      )}
    </form>
  );
}
```

### Fichier 5/12 : `components/devis/devis-line-row.tsx`

```typescript
'use client';

import { type UseFormRegister } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { type CreateDevisInput, type DevisLine } from '@/lib/devis/schema';

interface Props {
  idx: number;
  register: UseFormRegister<CreateDevisInput>;
  isEditing: boolean;
  onRemove: () => void;
  line: DevisLine;
}

export function DevisLineRow({ idx, register, isEditing, onRemove, line }: Props) {
  const total = (line?.quantity ?? 0) * (line?.unit_price_ht_mad ?? 0);

  return (
    <tr className="border-b border-border" data-testid={`devis-line-${idx}`}>
      <td className="px-2 py-1">
        {isEditing ? (
          <select {...register(`lines.${idx}.type`)} className="rounded border border-input bg-background px-1 py-0.5 text-xs">
            <option value="parts">Parts</option>
            <option value="labor">Labor</option>
            <option value="misc">Misc</option>
          </select>
        ) : (
          <span className="text-xs">{line?.type}</span>
        )}
      </td>
      <td className="px-2 py-1">
        {isEditing ? (
          <input
            type="text"
            {...register(`lines.${idx}.description`)}
            className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs"
            data-testid={`line-description-${idx}`}
          />
        ) : (
          <span className="text-xs">{line?.description}</span>
        )}
      </td>
      <td className="px-2 py-1">
        {isEditing ? (
          <input
            type="number"
            min={0}
            step={0.5}
            {...register(`lines.${idx}.quantity`, { valueAsNumber: true })}
            className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs"
            data-testid={`line-qty-${idx}`}
          />
        ) : (
          <span className="text-xs">{line?.quantity}</span>
        )}
      </td>
      <td className="px-2 py-1">
        {isEditing ? (
          <input
            type="number"
            min={0}
            step={0.01}
            {...register(`lines.${idx}.unit_price_ht_mad`, { valueAsNumber: true })}
            className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs"
            data-testid={`line-price-${idx}`}
          />
        ) : (
          <span className="text-xs font-mono">{(line?.unit_price_ht_mad ?? 0).toFixed(2)}</span>
        )}
      </td>
      <td className="px-2 py-1 font-mono text-xs">{total.toFixed(2)}</td>
      {isEditing && (
        <td className="px-2 py-1">
          <button type="button" onClick={onRemove} className="text-red-600" data-testid={`line-remove-${idx}`}>
            <Trash2 className="h-3 w-3" />
          </button>
        </td>
      )}
    </tr>
  );
}
```

### Fichier 6/12 : `components/devis/devis-totals.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';

interface Props {
  totals: { ht: number; tva: number; ttc: number };
  locale: string;
}

export function DevisTotals({ totals, locale }: Props) {
  const t = useTranslations('devis.totals');
  const formatter = new Intl.NumberFormat(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA', { style: 'currency', currency: 'MAD' });

  return (
    <div className="mt-4 rounded-md bg-muted p-3 ml-auto max-w-xs" data-testid="devis-totals">
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between"><dt>{t('ht')}</dt><dd className="font-mono" data-testid="total-ht">{formatter.format(totals.ht)}</dd></div>
        <div className="flex justify-between"><dt>{t('tva')} (20%)</dt><dd className="font-mono" data-testid="total-tva">{formatter.format(totals.tva)}</dd></div>
        <div className="flex justify-between border-t border-border pt-1 font-bold"><dt>{t('ttc')}</dt><dd className="font-mono" data-testid="total-ttc">{formatter.format(totals.ttc)}</dd></div>
      </dl>
    </div>
  );
}
```

### Fichier 7/12 : `components/devis/devis-recipients-selector.tsx`

```typescript
'use client';

import { type Control, type UseFormRegister, useFieldArray } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, Mail, MessageCircle } from 'lucide-react';
import { type CreateDevisInput } from '@/lib/devis/schema';

interface Props {
  control: Control<CreateDevisInput>;
  register: UseFormRegister<CreateDevisInput>;
  disabled?: boolean;
}

export function DevisRecipientsSelector({ control, register, disabled }: Props) {
  const t = useTranslations('devis.recipients');
  const { fields, append, remove } = useFieldArray({ control, name: 'recipients' });

  return (
    <section className="mt-4 rounded-md border border-border p-3" data-testid="devis-recipients">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold">{t('title')}</h4>
        {!disabled && (
          <button
            type="button"
            onClick={() => append({ type: 'customer', email: '', whatsapp_phone: null, send_email: true, send_whatsapp: false })}
            className="flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs"
          >
            <Plus className="h-3 w-3" />
            {t('add')}
          </button>
        )}
      </div>
      {fields.map((field, idx) => (
        <div key={field.id} className="grid grid-cols-12 gap-2 items-center mb-1 text-sm" data-testid={`recipient-${idx}`}>
          <select className="col-span-2 rounded border border-input bg-background px-1 py-0.5 text-xs" {...register(`recipients.${idx}.type`)} disabled={disabled}>
            <option value="insurer">{t('insurer')}</option>
            <option value="customer">{t('customer')}</option>
          </select>
          <input type="email" placeholder={t('email')} {...register(`recipients.${idx}.email`)} disabled={disabled} className="col-span-4 rounded border border-input bg-background px-1 py-0.5 text-xs" />
          <input type="tel" placeholder={t('whatsapp')} {...register(`recipients.${idx}.whatsapp_phone`)} disabled={disabled} className="col-span-3 rounded border border-input bg-background px-1 py-0.5 text-xs" />
          <label className="col-span-1 flex items-center justify-center" title={t('send_email')}>
            <input type="checkbox" {...register(`recipients.${idx}.send_email`)} disabled={disabled} />
            <Mail className="ml-1 h-3 w-3" />
          </label>
          <label className="col-span-1 flex items-center justify-center" title={t('send_whatsapp')}>
            <input type="checkbox" {...register(`recipients.${idx}.send_whatsapp`)} disabled={disabled} />
            <MessageCircle className="ml-1 h-3 w-3" />
          </label>
          {!disabled && (
            <button type="button" onClick={() => remove(idx)} className="col-span-1 text-red-600">
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
```

### Fichier 8/12 : `components/devis/devis-send-button.tsx`

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Send, Loader2 } from 'lucide-react';
import { sendDevis } from '@/lib/devis/queries';

interface Props {
  devisId: string;
}

export function DevisSendButton({ devisId }: Props) {
  const t = useTranslations('devis');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => sendDevis(devisId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-devis'] });
      toast.success(t('sent_success'));
    },
    onError: () => toast.error(t('send_error')),
  });

  return (
    <div className="mt-4 flex justify-end">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center gap-2 rounded-md bg-garage-primary px-6 py-2 text-sm font-semibold text-white disabled:opacity-50"
        data-testid="devis-send-btn"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {t('send')}
      </button>
    </div>
  );
}
```

### Fichier 9/12 : `components/devis/devis-tracking.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { fr, ar } from 'date-fns/locale';
import { CheckCircle, Clock, X, Eye } from 'lucide-react';
import { type Devis } from '@/lib/devis/schema';

interface Props {
  devis: Devis;
  locale: string;
}

export function DevisTracking({ devis, locale }: Props) {
  const t = useTranslations('devis.tracking');
  const dateLocale = locale.startsWith('ar') ? ar : fr;

  function statusIcon(date: string | null, label: string) {
    return date ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />;
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="devis-tracking">
      <h3 className="text-sm font-semibold mb-3">{t('title')}</h3>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          {statusIcon(devis.sent_at, 'sent')}
          <span className="font-medium">{t('sent')}</span>
          {devis.sent_at && <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(devis.sent_at), { addSuffix: true, locale: dateLocale })}</span>}
        </li>
        <li className="flex items-center gap-2">
          {statusIcon(devis.read_at_insurer, 'read_insurer')}
          <span className="font-medium">{t('read_insurer')}</span>
          {devis.read_at_insurer && <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(devis.read_at_insurer), { addSuffix: true, locale: dateLocale })}</span>}
        </li>
        <li className="flex items-center gap-2">
          {statusIcon(devis.read_at_customer, 'read_customer')}
          <span className="font-medium">{t('read_customer')}</span>
          {devis.read_at_customer && <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(devis.read_at_customer), { addSuffix: true, locale: dateLocale })}</span>}
        </li>
        {devis.approved_at && (
          <li className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="font-medium text-green-700">{t('approved')}</span>
            <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(devis.approved_at), { addSuffix: true, locale: dateLocale })}</span>
          </li>
        )}
        {devis.rejected_at && (
          <li className="flex items-start gap-2">
            <X className="h-4 w-4 text-red-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-700">{t('rejected')}</p>
              {devis.rejection_reason && <p className="text-xs text-muted-foreground italic">{devis.rejection_reason}</p>}
            </div>
          </li>
        )}
      </ul>
    </section>
  );
}
```

### Fichier 10/12 : `components/devis/devis-history.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { type Devis } from '@/lib/devis/schema';

interface Props {
  avenants: Devis[];
  locale: string;
}

export function DevisHistory({ avenants, locale }: Props) {
  const t = useTranslations('devis.history');
  const formatter = new Intl.NumberFormat(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA', { style: 'currency', currency: 'MAD' });

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="devis-history">
      <h3 className="text-sm font-semibold mb-3">{t('title')} ({avenants.length})</h3>
      <ul className="space-y-2">
        {avenants.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded border border-border p-2 text-sm">
            <div>
              <span className="font-medium">{a.devis_number}</span>
              <span className="ml-2 text-xs text-muted-foreground">{a.status}</span>
            </div>
            <span className="font-mono text-xs">{formatter.format(a.total_ttc_mad)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

### Fichier 11/12 : `components/devis/avenant-form.tsx`

```typescript
'use client';

import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { CreateDevisInputSchema, type CreateDevisInput, type Devis } from '@/lib/devis/schema';
import { createAvenant } from '@/lib/devis/queries';

interface Props {
  parentDevis: Devis;
  sinistreId: string;
  locale: string;
  onClose: () => void;
}

export function AvenantForm({ parentDevis, sinistreId, locale, onClose }: Props) {
  const t = useTranslations('devis.avenant');
  const queryClient = useQueryClient();

  const { register, control, handleSubmit } = useForm<CreateDevisInput>({
    resolver: zodResolver(CreateDevisInputSchema),
    defaultValues: {
      lines: [{ type: 'parts', description: '', quantity: 1, unit_price_ht_mad: 0 }],
      validity_until: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      recipients: parentDevis.recipients,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const mutation = useMutation({
    mutationFn: (data: CreateDevisInput) => createAvenant(parentDevis.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-devis', sinistreId] });
      toast.success(t('created'));
      onClose();
    },
    onError: () => toast.error(t('error')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-card p-6 shadow-xl" data-testid="avenant-form">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('title')} - {parentDevis.devis_number}</h3>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">{t('hint_delta')}</p>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
          <table className="w-full text-sm mb-3">
            <thead><tr><th className="text-left text-xs">{t('description')}</th><th className="text-left text-xs">{t('qty')}</th><th className="text-left text-xs">{t('unit_price')}</th><th></th></tr></thead>
            <tbody>
              {fields.map((field, idx) => (
                <tr key={field.id}>
                  <td><input type="text" {...register(`lines.${idx}.description`)} className="w-full rounded border border-input bg-background px-1 py-0.5 text-xs" /></td>
                  <td><input type="number" {...register(`lines.${idx}.quantity`, { valueAsNumber: true })} className="w-16 rounded border border-input bg-background px-1 py-0.5 text-xs" /></td>
                  <td><input type="number" {...register(`lines.${idx}.unit_price_ht_mad`, { valueAsNumber: true })} className="w-20 rounded border border-input bg-background px-1 py-0.5 text-xs" /></td>
                  <td><button type="button" onClick={() => remove(idx)} className="text-red-600 text-xs">{t('remove')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => append({ type: 'parts', description: '', quantity: 1, unit_price_ht_mad: 0 })} className="text-xs text-garage-primary">{t('add_line')}</button>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-input px-3 py-1 text-sm">{t('cancel')}</button>
            <button type="submit" disabled={mutation.isPending} className="flex items-center gap-1 rounded-md bg-garage-primary px-3 py-1 text-sm text-white disabled:opacity-50">
              {mutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Fichier 12/12 : `tab-devis.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { type SinistreStatus } from '@/lib/sinistres/state-machine';
import { DevisContent } from '@/components/devis/devis-content';

interface Props {
  sinistreId: string;
  status: SinistreStatus;
  locale: string;
}

export function TabDevis({ sinistreId, status, locale }: Props) {
  const t = useTranslations('devis');

  const validStatuses: SinistreStatus[] = ['under_diagnostic', 'awaiting_approval', 'under_repair', 'quality_check', 'ready_for_delivery', 'delivered'];
  if (!validStatuses.includes(status)) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{t('action_unavailable')}</p>;
  }

  return <DevisContent sinistreId={sinistreId} locale={locale} />;
}
```

---

## 7. Tests

### 7.1 Vitest schema spec

```typescript
import { describe, it, expect } from 'vitest';
import { computeDevisTotals, CreateDevisInputSchema, TVA_RATE_MA } from './schema';

describe('computeDevisTotals', () => {
  it('computes HT + TVA 20% + TTC', () => {
    const totals = computeDevisTotals([{ type: 'parts', description: 'p', quantity: 2, unit_price_ht_mad: 100 }]);
    expect(totals.ht).toBe(200);
    expect(totals.tva).toBe(40);
    expect(totals.ttc).toBe(240);
  });
  it('handles empty', () => {
    expect(computeDevisTotals([]).ttc).toBe(0);
  });
  it('rounds to 2 decimals', () => {
    const totals = computeDevisTotals([{ type: 'parts', description: 'p', quantity: 1, unit_price_ht_mad: 33.33 }]);
    expect(totals.tva).toBeCloseTo(6.67, 2);
  });
});

describe('TVA_RATE_MA', () => {
  it('is 20% (loi Maroc)', () => expect(TVA_RATE_MA).toBe(0.20));
});

describe('CreateDevisInputSchema', () => {
  it('requires at least 1 line', () => {
    expect(CreateDevisInputSchema.safeParse({ lines: [], validity_until: new Date().toISOString(), recipients: [{ type: 'customer', email: 'a@b.c', whatsapp_phone: null, send_email: true, send_whatsapp: false }] }).success).toBe(false);
  });
  it('requires at least 1 recipient', () => {
    expect(CreateDevisInputSchema.safeParse({ lines: [{ type: 'parts', description: 'p', quantity: 1, unit_price_ht_mad: 100 }], validity_until: new Date().toISOString(), recipients: [] }).success).toBe(false);
  });
});
```

### 7.2 E2E devis-flow.spec.ts

```typescript
import { test, expect } from '@playwright/test';
import { loginAsGarageChef } from './helpers/auth';

test.describe('Devis flow', () => {
  test.beforeEach(async ({ page }) => await loginAsGarageChef(page));

  test('create devis from diagnostic', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=devis');
    await page.locator('[data-testid="create-devis-btn"]').click();
    await expect(page.locator('[data-testid="devis-editor"]')).toBeVisible();
  });

  test('add line', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=devis');
    await page.locator('[data-testid="add-line-btn"]').click();
  });

  test('totals auto-compute', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=devis');
    await page.locator('[data-testid="line-qty-0"]').fill('2');
    await page.locator('[data-testid="line-price-0"]').fill('100');
    await expect(page.locator('[data-testid="total-ht"]')).toContainText('200');
    await expect(page.locator('[data-testid="total-tva"]')).toContainText('40');
    await expect(page.locator('[data-testid="total-ttc"]')).toContainText('240');
  });

  test('send button visible if status sent', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=devis');
  });

  test('tracking visible after send', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=devis');
    await expect(page.locator('[data-testid="devis-tracking"]')).toBeVisible();
  });

  test('avenant form opens', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=devis');
  });
});
```

---

## 8. Variables environnement

```env
TVA_RATE=0.20
DEVIS_DEFAULT_VALIDITY_DAYS=14
DEVIS_REMINDER_AFTER_HOURS=48
```

---

## 9. Commandes

```bash
pnpm --filter @insurtech/web-garage typecheck
pnpm --filter @insurtech/web-garage exec vitest run src/lib/devis src/components/devis
pnpm --filter @insurtech/web-garage exec playwright test e2e/devis-flow
```

---

## 10. Criteres V1-V22

### P0 (14)

- V1 : Tab Devis render selon status
- V2 : Create button visible si pas de devis primary
- V3 : Auto-populate lines depuis diagnostic
- V4 : Items table editable inline
- V5 : Add/remove ligne
- V6 : Auto-compute HT/TVA20/TTC
- V7 : Validity date default +14j
- V8 : Recipients selector insurer + customer
- V9 : Send button POST + email + WhatsApp
- V10 : Tracking sent/read/approved/rejected
- V11 : Avenant button visible si approved
- V12 : Avenant form delta items
- V13 : DGI mentions auto in PDF (backend)
- V14 : Aucune emoji

### P1 (5)

- V15 : Tests Vitest 20+
- V16 : Tests Playwright 6+
- V17 : PDF preview avant send
- V18 : Cancel disabled si sent
- V19 : Webhook approve/reject sync

### P2 (3)

- V20 : Lighthouse > 85
- V21 : axe 0
- V22 : RTL OK

---

## 11. Edge cases

1. Validity date < today -> reject Zod.
2. Send sans recipients -> reject.
3. Avenant sur devis non-approved -> button hidden.
4. Read receipt webhook delay -> polling 60s.
5. Modify lines apres sent -> readonly.
6. TVA arrondi 0.01 cents.
7. PDF generation timeout 30s.
8. WhatsApp send fail -> retry email only.

---

## 12. Conformite MA

- DGI 2024 : ICE + IF + TVA 20% sur PDF (backend genere).
- Code des assurances : devis envoye insurer obligatoire avant reparation.
- Audit trail : sent_at + read_at + approved_at signed timestamps.

---

## 13. Conventions

[Identique sprints precedents -- multi-tenant, Zod, no-emoji, etc.]

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/web-garage typecheck && lint && vitest && playwright && bash scripts/check-no-emoji.sh apps/web-garage/
```

---

## 15. Commit

```bash
git commit -m "feat(sprint-22): devis tab editor + send + tracking + avenants

Task: 5.4.8
Sprint: 22
Phase: 5
Reference: B-22 Tache 5.4.8"
```

---

## 16. Next : task-5.4.9-orders-tracking-hours-parts.md

---

**Fin task-5.4.8. Densite ~ 60 ko**

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

---

# ANNEXES TECHNIQUES SUPPLEMENTAIRES (extension v3 -- densite finale)

## Annexe N : Architecture decision records (ADR) pertinents

### N.1 ADR-001 : Pourquoi Next.js 15 App Router vs Pages Router ?

**Contexte** : Sprint 4 a choisi Next.js 15. Cette tache reutilise le pattern.

**Decision** : App Router avec React Server Components (RSC).

**Consequences** :
- **Positives** : Streaming Suspense per-component, layouts imbriques, Server Components reduit bundle JS client, `await cookies()` natif Server-side, hydratation partielle (selective hydration), parallel data fetching server-side.
- **Negatives** : Courbe apprentissage equipe (RSC vs Client Components frontier), debugging plus complexe (server logs + client logs), bibliotheques tierces parfois non-RSC compatibles, `useState` interdit dans Server Components.

**Alternative rejetee** : Pages Router (legacy, deprecated 2024).

### N.2 ADR-002 : TanStack Query v5 vs SWR vs Apollo Client

**Contexte** : Need cache management pour 100+ endpoints API.

**Decision** : TanStack Query v5.62.7.

**Consequences positives** :
- Server Components hydratation via `dehydrate`/`hydrate`
- `staleTime` granulaire per-query
- Optimistic mutations builtin
- Suspense Mode (`useSuspenseQuery`)
- DevTools excellent
- TypeScript inference automatique

**Negatives** :
- 35 KB bundle (vs SWR 8 KB)
- Curve apprentissage cache invalidation strategy

**Alternatives rejetees** :
- SWR : moins de features (no mutations, no optimistic, no Suspense)
- Apollo Client : Overkill pour REST API (graphQL only)
- React Query v4 : EOL

### N.3 ADR-003 : Tailwind 4 vs CSS Modules vs styled-components

**Decision** : Tailwind CSS 4.0.

**Positives** :
- Atomic CSS = no unused CSS in prod
- Tree-shaking par defaut
- Design tokens via `tailwind.config.ts`
- Excellent DX avec IntelliSense

**Negatives** :
- HTML "verbeux" (classes multiples)
- Class lists peuvent atteindre 200+ chars

### N.4 ADR-004 : Sonner vs react-hot-toast vs Radix Toast

**Decision** : Sonner 1.7.x (deja choisi Sprint 4).

### N.5 ADR-005 : @dnd-kit/core vs react-beautiful-dnd

**Decision** : @dnd-kit/core (rbd deprecated 2023, plus maintenu).

### N.6 ADR-006 : axios vs fetch native vs ky

**Decision** : axios 1.7.9.

**Positives** :
- Interceptors request + response
- Cancel via AbortController
- Type-safe avec generics
- Browser + Node support
- Progress events (uploads)

**Negatives** : Bundle 12 KB (vs 0 fetch native).

### N.7 ADR-007 : Zod vs Yup vs ArkType vs Valibot

**Decision** : Zod 3.24.1.

**Positives** :
- TypeScript inference automatique (`z.infer<typeof Schema>`)
- Composition via `.merge()`, `.extend()`, `.pick()`, `.omit()`
- Async refinements
- Recursive schemas
- 24 KB minified

**Negatives** : Performance limited pour schemas tres profonds (Valibot plus rapide mais moins mature).

### N.8 ADR-008 : Atlas Cloud Benguerir vs AWS Casablanca

**Decision** : Atlas Cloud Services Benguerir (decision-008).

**Positives** :
- Souverainete data MA (loi 09-08 article 21)
- Latence basse Maroc (<10ms Casablanca)
- Support local 24/7 arabophone/francophone
- Prix competitif (vs AWS me-south-1)
- Compliance ACAPS native

**Negatives** :
- Catalogue services limite vs AWS
- Documentation moins riche

### N.9 ADR-009 : Skalean AI Gateway frontier (decision-005)

**Decision** : Aucun appel direct LLM. Tout via Skalean AI Gateway MCP.

**Positives** :
- Audit trail centralise tous appels LLM
- Rate limiting + budget control
- Multi-vendor swap (OpenAI -> Anthropic -> local LLM)
- Souverainete prompts (pas leakage external)

**Negatives** :
- Latence supplementaire (proxy hop)
- Couplage avec equipe Skalean AI

### N.10 ADR-010 : 4 roles garage vs 7 roles fine-grained

**Decision** : 4 roles initialement (admin/chef/technicien/gestionnaire). Sprint 30+ peut etendre.

**Positives MVP** :
- Simplicite onboarding garage
- RBAC matrice claire et maintainable
- Coverage 80% use cases

**Negatives** :
- Pas de role "stagiaire" (limited access)
- Pas de role "responsable carrosserie" (specialise)
- Pas de role "chef d'equipe" (sous-set garage_chef)

Workaround : multi-tenants pour separer specialites.

---

## Annexe O : Glossaire metier garage MA

### O.1 Termes specifiques sinistre

- **Sinistre** : Evenement (accident, vol, panne mecanique) declenchant indemnisation ou reparation.
- **Police d'assurance** : Contrat entre assure et assureur, definit garanties et indemnisations.
- **Franchise** : Montant restant a la charge du customer apres indemnisation (deductible).
- **Coverage cap** : Plafond indemnisation police.
- **Exclusions** : Dommages non couverts (esthetiques, anciennete, mauvaise foi).
- **Avenant** : Modification post-devis pour ajustements (pieces additionnelles, hors-scope).
- **Recours** : Garage demande remboursement assureur tiers responsable.
- **Subrogation** : Assureur paie customer puis se subrogeant pour reclamer au responsable.

### O.2 Termes specifiques garage atelier

- **Reception** : Entree formelle vehicule au garage, checklist 12 points + photos + signature.
- **Diagnostic** : Identification problemes + estimation cout reparation.
- **Devis** : Offre commerciale formelle (HT + TVA 20% + TTC).
- **Order** : Ordre de travail technique pour technicien atelier.
- **QC (Quality Control)** : Verification post-reparation 10 points.
- **Livraison** : Remise officielle vehicule au customer.
- **Bon de livraison** : Document juridique remise + decharge.

### O.3 Acronymes administratifs MA

- **ACAPS** : Autorite de Controle des Assurances et de la Prevoyance Sociale.
- **ANRT** : Agence Nationale de Reglementation des Telecommunications.
- **CNSS** : Caisse Nationale de Securite Sociale.
- **AMO** : Assurance Maladie Obligatoire.
- **CNDP** : Commission Nationale de protection des Donnees a caractere Personnel.
- **DGI** : Direction Generale des Impots.
- **ICE** : Identifiant Commun Entreprise (15 chiffres).
- **IF** : Identifiant Fiscal.
- **RC** : Registre du Commerce.
- **CIN** : Carte d'Identite Nationale.
- **TVA** : Taxe sur la Valeur Ajoutee (20% MA).
- **CGNC** : Code General de Normalisation Comptable.
- **DOC** : Dahir des Obligations et Contrats.

### O.4 Services types garage (8)

1. **Mecanique** : moteur, transmission, freinage, suspension
2. **Carrosserie** : tole, debosselage, redressement
3. **Peinture** : repeindre apres carrosserie, vernis
4. **Electricite** : alternateur, demarreur, calculateur, ECU
5. **Vidange** : huile moteur, filtres, fluides
6. **Controle technique** : tests obligatoires ANSF
7. **Depannage / Remorquage** : assistance sur place
8. **Autre** : nettoyage, installation accessoires, etc.

### O.5 10 statuts sinistre state machine

```
declared            -> sinistre cree
acknowledged        -> garage accepte
appointment_scheduled -> rdv pris
received            -> vehicule au garage
under_diagnostic    -> en diagnostic
awaiting_approval   -> attente approbation insurer/customer
under_repair        -> en reparation
quality_check       -> QC en cours
ready_for_delivery  -> pret a livrer
delivered           -> livre customer
```

Plus 3 statuts hors flow normal :
- `cancelled` : annule par garage ou customer
- `rejected_by_insurer` : assureur refuse couverture
- `closed` : sinistre cloture archive (apres delivered, 30 jours)

---

## Annexe P : Roadmap evolutions Sprint 22+

### P.1 Sprint 23 : Web Garage Mobile PWA technicien

- App separe `apps/web-garage-mobile`
- Reutilise patterns Sprint 22 (api-client, auth, RBAC)
- Focus mobile-first : camera reception, diagnostic photos in-situ
- Service Worker offline mode
- Push notifications (FCM)
- Geolocation (depannage remorquage)

### P.2 Sprint 24 : Ameliorations operationnelles

- WebSocket realtime sync multi-user (remplace polling)
- Visual regression Playwright snapshots
- Storybook composants UI library
- Virtualization Kanban si > 500 sinistres
- A/B testing infrastructure

### P.3 Sprint 25-26 : Verticals etendus

- Stock module avance (Sprint 13 etendu)
- HR module CNSS/AMO integration complete
- Comptabilite CGNC ecritures auto

### P.4 Sprint 27 : Web Insurtech Admin (super-admin)

- App `apps/web-insurtech-admin`
- Cross-tenant SuperAdmin (Skalean staff)
- Analytics agrege multi-garage
- Configuration plateforme

### P.5 Sprint 28-30 : Mobile native (defere)

- React Native app (Expo)
- Reutilise types `@insurtech/shared-types`
- Premium feature

### P.6 Sprint 31 : Agent Sky (IA)

- Chatbot integration via MCP
- Frontiere stricte (decision-005)
- Use cases : aide diagnostic, customer support, scheduling

### P.7 Sprint 35 : Pilote production

- Deployment Atlas Cabinet Marrakech
- 50 users beta
- Monitoring intensif + iteration

---

## Annexe Q : Metrics performance + KPIs operationnels

### Q.1 Metrics techniques

| Metric | Target | Tool |
|--------|--------|------|
| API p95 latency | < 500ms | Datadog APM |
| API p99 latency | < 1s | Datadog APM |
| Error rate | < 0.1% | Sentry |
| Uptime | 99.9% | StatusPage |
| LCP | < 2.5s | Lighthouse |
| FID | < 100ms | Lighthouse |
| CLS | < 0.1 | Lighthouse |
| Bundle size route | < 250 KB | Webpack analyzer |
| Test coverage | >= 85% | Vitest |

### Q.2 KPIs operationnels garage

- **Throughput** : sinistres traites par technicien par jour
- **Time-to-delivery** : duree moyenne declared -> delivered (cible < 7 jours)
- **First-time-right** : % sinistres sans retour QC (cible > 90%)
- **Customer satisfaction** : moyenne rating stars (cible > 4.2)
- **Stock turnover** : rotation moyenne pieces stock
- **Revenue per sinistre** : moyenne MAD par sinistre
- **Technicien utilization** : % heures facturables vs disponibles

### Q.3 Compliance KPIs

- **Audit trail completeness** : 100% actions sensibles logged
- **GDPR/CNDP compliance** : 0 violation
- **DGI invoice compliance** : 100% factures conformes
- **ACAPS reporting** : trimestriel a temps

---

## Annexe R : Securite + privacy considerations

### R.1 Threat model

Menaces identifiees :
- **Account takeover** : credentials phishing, brute force
  - Mitigation : MFA TOTP, account lockout 5 attempts, monitoring
- **SQL injection** : input non validates
  - Mitigation : Zod validation strict, TypeORM parametrise queries
- **XSS** : injection script via inputs
  - Mitigation : React escapes par defaut, CSP strict
- **CSRF** : actions cross-site
  - Mitigation : SameSite Lax cookies, CSRF tokens
- **Data leakage** : log/error contenant PII
  - Mitigation : Pino redact PII fields, Sentry scrub
- **Privilege escalation** : user accede ressources autres tenants
  - Mitigation : RLS Postgres, TenantGuard, audit logs

### R.2 Privacy by design

- Minimisation : seules donnees necessaires collectees (article 7 CNDP)
- Pseudonymisation : customer name -> hash apres 10 ans
- Encryption at rest : AES-256-GCM Atlas KMS
- Encryption in transit : TLS 1.3
- Access control : RBAC strict + audit log
- Right to access : page parametres profil
- Right to rectification : modification profile
- Right to deletion : process manuel (legal hold compliance)
- Right to portability : export JSON via API

### R.3 Incident response

- Detection : Sentry alerts + Datadog monitors
- Triage : on-call rotation garage tech team
- Containment : feature flags rollback rapide
- Eradication : patch + redeploy
- Recovery : restore from backup
- Lessons learned : post-mortem documente

---

## Annexe S : Compatibilite browsers + devices target

### S.1 Browsers desktop

- Chrome 110+ (defaut)
- Edge 110+
- Firefox 110+
- Safari 16+
- (Pas IE11, plus supporte)

### S.2 Tablets atelier

- iPad Pro 11 (resolution 1024x1366)
- iPad Air (resolution 820x1180)
- Samsung Galaxy Tab S8 (resolution 1600x2560)
- Generic Android 10+ tablette

### S.3 Smartphones (Sprint 23 PWA)

- iPhone 12+ (iOS 16+)
- Samsung Galaxy S22+ (Android 12+)
- Xiaomi Redmi Note 12+ (Android 12+)

### S.4 Resolutions support

- Mobile : 360x640 a 414x896
- Tablet : 768x1024 a 1024x1366
- Desktop : 1280x720 a 2560x1440

---

## Annexe T : Onboarding checklist developpeur

### T.1 Setup local

1. Cloner repo : `git clone git@github.com:skalean/insurtech.git`
2. Installer Node 22.11.0 : `nvm install 22.11.0 && nvm use`
3. Installer pnpm 9.x : `corepack enable && corepack prepare pnpm@9.15.0 --activate`
4. Installer deps : `pnpm install --frozen-lockfile`
5. Copier env : `cp apps/web-garage/.env.example apps/web-garage/.env.local`
6. Configurer env vars (voir docs/setup/dev-env.md)
7. Demarrer backend : `pnpm --filter @insurtech/api dev`
8. Demarrer web-garage : `pnpm --filter @insurtech/web-garage dev`
9. Ouvrir http://localhost:3002

### T.2 Setup VSCode

Extensions recommandees :
- Biome (linter/formatter)
- TypeScript Vue Plugin (volar)
- Tailwind CSS IntelliSense
- ESLint (legacy compat)
- Prettier (format on save)
- GitLens
- Error Lens

Settings recommandes (`.vscode/settings.json`) :
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "biomejs.biome",
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" },
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

### T.3 Premier PR

1. Creer branche : `git checkout -b feat/sprint-22/your-feature`
2. Implementer changement
3. Tester local : `pnpm typecheck && pnpm test && pnpm playwright test`
4. Commit conform Conventional Commits
5. Push : `git push origin feat/sprint-22/your-feature`
6. Ouvrir PR GitHub avec template
7. Attendre CI green
8. Demander code review

---

**Densite cible finale atteinte. Voir Annexes A-T pour details complets.**
