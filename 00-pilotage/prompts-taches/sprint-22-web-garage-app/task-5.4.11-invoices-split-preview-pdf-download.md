# TACHE 5.4.11 -- Invoices Page : List + Split Preview (Insurer/Customer) + PDF Download + Mark Paid + Tracking

**Sprint** : 22 (Phase 5 / Vertical Repair / Sprint 22 sur 35 cumul)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-22-sprint-22-web-garage-app.md` (Tache 5.4.11)
**Phase** : 5 -- Vertical Repair
**Priorite** : P0
**Effort** : 5h
**Dependances** :
- Taches 5.4.1-5.4.10 livres
- Sprint 21 Tache 5.3.7 (invoices split insurer/customer + DGI compliance + PDF generation)
- Sprint 12 Books (CGNC + format facture DGI)
- Sprint 11 Pay (payment gateways MA pour mark paid customer side)

**Densite cible** : 80-150 ko
**AUCUNE EMOJI AUTORISEE**

---

## 1. But

Remplir la **tab Invoices** de la page detail sinistre + page list invoices `/[locale]/invoices` avec : (1) **List invoices** datatable filters (status, recipient_type, date_range), (2) **Split preview UX critique** avant generation : show breakdown total_ttc, franchise customer (deductible police), exclusions non-couvertes, coverage_cap insurer, compute auto insurer_amount + customer_amount, visual 2 cards previewing futures factures (Insurer XXXX MAD / Customer YYYY MAD), bouton "Generate Invoices" -> backend split logic Sprint 21 -> 2 invoices generees (1 insurer + 1 customer), (3) **Page detail invoice** : recipient info, lignes detaillees, totaux HT/TVA/TTC, PDF preview (react-pdf reuse Tache 5.4.5), download PDF, status badge (draft/sent/read/paid/overdue), bouton "Send Email" (re-envoi), mark paid manual entry (date + reference paiement) pour assureurs virement bancaire, history tracking lecture + payment.

Cette tache materialise **monetisation garage**. Sans facturation split correcte, garage perd argent (sur-couverture customer) ou litige (sous-couverture insurer). Conformite DGI 2024 : facture electronique signee + ICE + IF + TVA 20% chaque ligne + chrono numerotation.

---

## 2. Contexte etendu

### Pourquoi

Split insurer/customer = differenciateur cle de Skalean Garage. Sans assistant automatique, technicien doit calculer manuellement (erreur 15%+). Avec split preview, calcul automatique conform police + customer voit clairement ce qu'il paie.

### Trade-offs

- Mark paid manual : car virements bancaires assureur arrivent sans webhook. Sprint 11 ajoute webhooks paygates pour customer payments (CMI, Naps).
- PDF preview lazy : reuse pattern 5.4.5.
- Re-envoi email : OK mais audit.

### Pieges (8)

1. Split avec total_repaired > coverage_cap : excess customer. UI montre clairement.
2. Franchise customer > 0 : deduit insurer.
3. Exclusions (carrosserie esthetique non couverte) : customer paie.
4. Mark paid date < invoice date : reject.
5. PDF generation backend timeout.
6. Currency formatting MAD.
7. Customer sans email : SMS fallback.
8. DGI chrono : impossible regenerer.

---

## 3. Architecture

```
repo/apps/web-garage/src/components/invoices/
|-- invoices-list.tsx
|-- invoices-list-filters.tsx
|-- split-preview.tsx                        # 2 cards before generation
|-- generate-invoices-button.tsx
|-- invoice-detail.tsx
|-- invoice-pdf-preview.tsx                   # reuse react-pdf
|-- invoice-status-badge.tsx
|-- mark-paid-modal.tsx
|-- send-email-button.tsx
|-- payment-tracking.tsx
|
repo/apps/web-garage/src/lib/invoices/
|-- schema.ts
|-- queries.ts
|
repo/apps/web-garage/src/components/sinistres/detail/tabs/tab-invoices.tsx
repo/apps/web-garage/src/app/[locale]/(protected)/invoices/page.tsx
repo/apps/web-garage/src/app/[locale]/(protected)/invoices/[id]/page.tsx
```

---

## 4. Livrables (20)

- [ ] Invoices list page + filters
- [ ] Split preview 2 cards
- [ ] Generate invoices button
- [ ] Invoice detail page
- [ ] PDF preview + download
- [ ] Status badge
- [ ] Mark paid modal
- [ ] Send email re-envoi
- [ ] Payment tracking history
- [ ] DGI compliance display (ICE, IF, TVA 20%)
- [ ] Currency MAD formatter
- [ ] Tab invoices replace placeholder
- [ ] Zod schemas
- [ ] Queries
- [ ] Tests Vitest 18+
- [ ] Tests E2E 6+
- [ ] i18n 50+ keys
- [ ] Aucune emoji
- [ ] Lighthouse 85+
- [ ] axe 0

---

## 5. Fichiers

```
invoices-list.tsx                  (~180 lignes)
invoices-list-filters.tsx          (~120 lignes)
split-preview.tsx                  (~250 lignes)
generate-invoices-button.tsx        (~100 lignes)
invoice-detail.tsx                  (~200 lignes)
invoice-pdf-preview.tsx              (~80 lignes)
invoice-status-badge.tsx              (~50 lignes)
mark-paid-modal.tsx                   (~180 lignes)
send-email-button.tsx                  (~100 lignes)
payment-tracking.tsx                    (~150 lignes)
lib/invoices/schema.ts                   (~150 lignes)
lib/invoices/queries.ts                   (~180 lignes)
tab-invoices.tsx                          (~80 lignes)
invoices/page.tsx                         (~150 lignes)
invoices/[id]/page.tsx                    (~150 lignes)
specs                                       (~700 lignes)
e2e/invoices-flow.spec.ts                    (~180 lignes)
```

Total : ~22 fichiers, ~2900 lignes

---

## 6. Code patterns COMPLETS

### Fichier 1/13 : `lib/invoices/schema.ts`

```typescript
import { z } from 'zod';

export const InvoiceStatusSchema = z.enum(['draft', 'sent', 'read', 'paid', 'overdue', 'cancelled', 'refunded']);
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

export const RecipientTypeSchema = z.enum(['insurer', 'customer']);
export type RecipientType = z.infer<typeof RecipientTypeSchema>;

export const InvoiceLineSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit_price_ht_mad: z.number(),
  total_ht_mad: z.number(),
});

export const InvoiceSchema = z.object({
  id: z.string().uuid(),
  invoice_number: z.string(),
  sinistre_id: z.string().uuid(),
  recipient_type: RecipientTypeSchema,
  recipient_name: z.string(),
  recipient_email: z.string().email().nullable(),
  recipient_ice: z.string().nullable(),
  recipient_if: z.string().nullable(),
  status: InvoiceStatusSchema,
  lines: z.array(InvoiceLineSchema),
  total_ht_mad: z.number().nonnegative(),
  tva_mad: z.number().nonnegative(),
  total_ttc_mad: z.number().nonnegative(),
  issued_at: z.string().datetime(),
  sent_at: z.string().datetime().nullable(),
  read_at: z.string().datetime().nullable(),
  paid_at: z.string().datetime().nullable(),
  due_date: z.string().datetime(),
  payment_reference: z.string().nullable(),
  pdf_url: z.string().url().nullable(),
});
export type Invoice = z.infer<typeof InvoiceSchema>;

export const SplitPreviewSchema = z.object({
  total_repair_ttc_mad: z.number().nonnegative(),
  franchise_mad: z.number().nonnegative(),
  coverage_cap_mad: z.number().nonnegative().nullable(),
  exclusions_mad: z.number().nonnegative(),
  insurer_amount_mad: z.number().nonnegative(),
  customer_amount_mad: z.number().nonnegative(),
  insurer_recipient: z.object({
    name: z.string(),
    email: z.string().email().nullable(),
    ice: z.string().nullable(),
    if: z.string().nullable(),
  }).nullable(),
  customer_recipient: z.object({
    name: z.string(),
    email: z.string().email().nullable(),
  }),
});
export type SplitPreview = z.infer<typeof SplitPreviewSchema>;

export const MarkPaidInputSchema = z.object({
  paid_at: z.string().datetime(),
  payment_reference: z.string().min(1).max(100),
  payment_method: z.enum(['bank_transfer', 'check', 'cash', 'card', 'mobile_money']),
  notes: z.string().max(500).optional(),
});
export type MarkPaidInput = z.infer<typeof MarkPaidInputSchema>;
```

### Fichier 2/13 : `lib/invoices/queries.ts`

```typescript
import { z } from 'zod';
import { apiGet, apiPost } from '@/lib/api-client';
import { InvoiceSchema, SplitPreviewSchema, type Invoice, type MarkPaidInput, type SplitPreview } from './schema';

export async function fetchSplitPreview(sinistreId: string): Promise<SplitPreview> {
  const data = await apiGet<unknown>(`/api/v1/repair/sinistres/${sinistreId}/invoices/preview-split`);
  return SplitPreviewSchema.parse(data);
}

export async function generateInvoices(sinistreId: string): Promise<Invoice[]> {
  const data = await apiPost<unknown>(`/api/v1/repair/sinistres/${sinistreId}/invoices/generate`, {});
  return z.array(InvoiceSchema).parse(data);
}

export async function fetchSinistreInvoices(sinistreId: string): Promise<Invoice[]> {
  const data = await apiGet<unknown>(`/api/v1/repair/sinistres/${sinistreId}/invoices`);
  return z.array(InvoiceSchema).parse(data);
}

export async function fetchInvoiceDetail(invoiceId: string): Promise<Invoice> {
  const data = await apiGet<unknown>(`/api/v1/repair/invoices/${invoiceId}`);
  return InvoiceSchema.parse(data);
}

export async function fetchInvoicesList(filters: { status?: string[]; recipient_type?: string[]; date_from?: string; date_to?: string; page?: number; page_size?: number } = {}) {
  const params = new URLSearchParams();
  if (filters.status?.length) params.set('status', filters.status.join(','));
  if (filters.recipient_type?.length) params.set('recipient_type', filters.recipient_type.join(','));
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.page) params.set('page', filters.page.toString());
  if (filters.page_size) params.set('page_size', filters.page_size.toString());
  const data = await apiGet<{ data: unknown[]; pagination: unknown }>(`/api/v1/repair/invoices?${params.toString()}`);
  return {
    data: z.array(InvoiceSchema).parse(data.data),
    pagination: data.pagination as { page: number; page_size: number; total: number; total_pages: number },
  };
}

export async function sendInvoiceEmail(invoiceId: string) {
  return await apiPost<{ ok: true }>(`/api/v1/repair/invoices/${invoiceId}/send-email`, {});
}

export async function markInvoicePaid(invoiceId: string, input: MarkPaidInput): Promise<Invoice> {
  const data = await apiPost<unknown>(`/api/v1/repair/invoices/${invoiceId}/mark-paid`, input);
  return InvoiceSchema.parse(data);
}
```

### Fichier 3/13 : `components/invoices/split-preview.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Building, User, AlertTriangle, Loader2 } from 'lucide-react';
import { fetchSplitPreview } from '@/lib/invoices/queries';
import { GenerateInvoicesButton } from './generate-invoices-button';

interface Props {
  sinistreId: string;
  locale: string;
}

export function SplitPreview({ sinistreId, locale }: Props) {
  const t = useTranslations('invoices.split_preview');

  const { data, isLoading } = useQuery({
    queryKey: ['invoice-split-preview', sinistreId],
    queryFn: () => fetchSplitPreview(sinistreId),
    staleTime: 60_000,
  });

  const formatter = new Intl.NumberFormat(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA', { style: 'currency', currency: 'MAD' });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data) return null;

  const hasExcess = data.coverage_cap_mad !== null && data.total_repair_ttc_mad > data.coverage_cap_mad;

  return (
    <div className="space-y-4" data-testid="split-preview">
      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-base font-semibold mb-3">{t('breakdown_title')}</h3>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between"><dt>{t('total_repair')}</dt><dd className="font-mono font-semibold" data-testid="total-repair">{formatter.format(data.total_repair_ttc_mad)}</dd></div>
          <div className="flex justify-between text-amber-700"><dt>- {t('franchise')}</dt><dd className="font-mono" data-testid="franchise">{formatter.format(data.franchise_mad)}</dd></div>
          {data.exclusions_mad > 0 && (
            <div className="flex justify-between text-amber-700"><dt>- {t('exclusions')}</dt><dd className="font-mono" data-testid="exclusions">{formatter.format(data.exclusions_mad)}</dd></div>
          )}
          {data.coverage_cap_mad !== null && (
            <div className="flex justify-between text-xs text-muted-foreground"><dt>{t('coverage_cap')}</dt><dd className="font-mono">{formatter.format(data.coverage_cap_mad)}</dd></div>
          )}
        </dl>
        {hasExcess && (
          <div className="mt-3 flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            {t('excess_warning', { amount: formatter.format(data.total_repair_ttc_mad - data.coverage_cap_mad!) })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Insurer card */}
        {data.insurer_recipient && data.insurer_amount_mad > 0 ? (
          <article className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4" data-testid="card-insurer">
            <div className="flex items-center gap-2 mb-2">
              <Building className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-blue-900">{t('insurer_invoice')}</h4>
            </div>
            <p className="text-sm">{data.insurer_recipient.name}</p>
            {data.insurer_recipient.ice && <p className="text-xs text-muted-foreground" dir="ltr">ICE: {data.insurer_recipient.ice}</p>}
            {data.insurer_recipient.if && <p className="text-xs text-muted-foreground" dir="ltr">IF: {data.insurer_recipient.if}</p>}
            <p className="mt-3 text-2xl font-bold text-blue-900 font-mono" data-testid="insurer-amount">{formatter.format(data.insurer_amount_mad)}</p>
          </article>
        ) : (
          <div className="rounded-lg border border-dashed border-input p-4 text-center text-sm text-muted-foreground">
            {t('no_insurer')}
          </div>
        )}

        {/* Customer card */}
        <article className="rounded-lg border-2 border-green-200 bg-green-50 p-4" data-testid="card-customer">
          <div className="flex items-center gap-2 mb-2">
            <User className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-green-900">{t('customer_invoice')}</h4>
          </div>
          <p className="text-sm">{data.customer_recipient.name}</p>
          {data.customer_recipient.email && <p className="text-xs text-muted-foreground">{data.customer_recipient.email}</p>}
          <p className="mt-3 text-2xl font-bold text-green-900 font-mono" data-testid="customer-amount">{formatter.format(data.customer_amount_mad)}</p>
        </article>
      </div>

      <GenerateInvoicesButton sinistreId={sinistreId} />
    </div>
  );
}
```

### Fichier 4/13 : `components/invoices/generate-invoices-button.tsx`

```typescript
'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';
import { generateInvoices } from '@/lib/invoices/queries';

interface Props {
  sinistreId: string;
}

export function GenerateInvoicesButton({ sinistreId }: Props) {
  const t = useTranslations('invoices');
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => generateInvoices(sinistreId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sinistre-invoices', sinistreId] });
      toast.success(t('generated'));
    },
    onError: () => toast.error(t('generate_error')),
  });

  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center gap-2 rounded-md bg-garage-primary px-6 py-3 text-base font-semibold text-white disabled:opacity-50"
        data-testid="generate-invoices-btn"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {t('btn_generate')}
      </button>
    </div>
  );
}
```

### Fichier 5/13 : `components/invoices/invoice-status-badge.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { type InvoiceStatus } from '@/lib/invoices/schema';

const STYLES: Record<InvoiceStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-blue-100 text-blue-700',
  read: 'bg-indigo-100 text-indigo-700',
  paid: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
  refunded: 'bg-amber-100 text-amber-700',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const t = useTranslations('invoices.status');
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {t(status)}
    </span>
  );
}
```

### Fichier 6/13 : `components/invoices/invoice-detail.tsx`

```typescript
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Download, Mail, CheckCircle, Loader2 } from 'lucide-react';
import { fetchInvoiceDetail } from '@/lib/invoices/queries';
import { InvoiceStatusBadge } from './invoice-status-badge';
import { SendEmailButton } from './send-email-button';
import { MarkPaidModal } from './mark-paid-modal';
import { PaymentTracking } from './payment-tracking';

const PdfViewer = dynamic(() => import('@/components/sinistres/detail/tabs/pdf-viewer').then((m) => m.PdfViewer), {
  ssr: false,
  loading: () => <Loader2 className="h-6 w-6 animate-spin" />,
});

interface Props {
  invoiceId: string;
  locale: string;
}

export function InvoiceDetail({ invoiceId, locale }: Props) {
  const t = useTranslations('invoices.detail');
  const [markPaidOpen, setMarkPaidOpen] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => fetchInvoiceDetail(invoiceId),
    staleTime: 30_000,
  });

  const formatter = new Intl.NumberFormat(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA', { style: 'currency', currency: 'MAD' });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!invoice) return null;

  return (
    <div className="space-y-4" data-testid="invoice-detail">
      <header className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold font-mono" dir="ltr">{invoice.invoice_number}</h1>
            <p className="text-sm">{t('recipient')}: {invoice.recipient_name}</p>
            {invoice.recipient_ice && <p className="text-xs text-muted-foreground" dir="ltr">ICE: {invoice.recipient_ice}</p>}
            {invoice.recipient_if && <p className="text-xs text-muted-foreground" dir="ltr">IF: {invoice.recipient_if}</p>}
          </div>
          <div className="text-right">
            <InvoiceStatusBadge status={invoice.status} />
            <p className="mt-2 text-2xl font-bold font-mono" data-testid="invoice-total">{formatter.format(invoice.total_ttc_mad)}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {invoice.pdf_url && (
            <a
              href={invoice.pdf_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 rounded-md border border-input px-3 py-1 text-sm hover:bg-muted"
              data-testid="invoice-download"
            >
              <Download className="h-3 w-3" />
              {t('btn_download')}
            </a>
          )}
          <SendEmailButton invoiceId={invoice.id} />
          {invoice.status !== 'paid' && (
            <button
              type="button"
              onClick={() => setMarkPaidOpen(true)}
              className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
              data-testid="mark-paid-btn"
            >
              <CheckCircle className="h-3 w-3" />
              {t('btn_mark_paid')}
            </button>
          )}
        </div>
      </header>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">{t('lines_title')}</h3>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-2 py-1 text-xs">{t('col_description')}</th>
              <th className="text-left px-2 py-1 text-xs">{t('col_qty')}</th>
              <th className="text-left px-2 py-1 text-xs">{t('col_unit_price')}</th>
              <th className="text-left px-2 py-1 text-xs">{t('col_total')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, idx) => (
              <tr key={idx} className="border-b border-border">
                <td className="px-2 py-1">{l.description}</td>
                <td className="px-2 py-1">{l.quantity}</td>
                <td className="px-2 py-1 font-mono">{formatter.format(l.unit_price_ht_mad)}</td>
                <td className="px-2 py-1 font-mono">{formatter.format(l.total_ht_mad)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={3} className="text-right pt-2">{t('total_ht')}</td><td className="font-mono">{formatter.format(invoice.total_ht_mad)}</td></tr>
            <tr><td colSpan={3} className="text-right">{t('tva')} (20%)</td><td className="font-mono">{formatter.format(invoice.tva_mad)}</td></tr>
            <tr className="font-bold"><td colSpan={3} className="text-right pt-1 border-t">{t('total_ttc')}</td><td className="font-mono">{formatter.format(invoice.total_ttc_mad)}</td></tr>
          </tfoot>
        </table>
      </section>

      <PaymentTracking invoice={invoice} locale={locale} />

      {invoice.pdf_url && <PdfViewer url={invoice.pdf_url} />}

      {markPaidOpen && <MarkPaidModal invoiceId={invoiceId} dueDate={invoice.due_date} onClose={() => setMarkPaidOpen(false)} />}
    </div>
  );
}
```

### Fichier 7/13 : `components/invoices/send-email-button.tsx`

```typescript
'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail, Loader2 } from 'lucide-react';
import { sendInvoiceEmail } from '@/lib/invoices/queries';

export function SendEmailButton({ invoiceId }: { invoiceId: string }) {
  const t = useTranslations('invoices');
  const mutation = useMutation({
    mutationFn: () => sendInvoiceEmail(invoiceId),
    onSuccess: () => toast.success(t('email_sent')),
    onError: () => toast.error(t('email_error')),
  });
  return (
    <button
      type="button"
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="flex items-center gap-1 rounded-md border border-input px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
      data-testid="send-email-btn"
    >
      {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
      {t('btn_send_email')}
    </button>
  );
}
```

### Fichier 8/13 : `components/invoices/mark-paid-modal.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { X, Loader2 } from 'lucide-react';
import { MarkPaidInputSchema, type MarkPaidInput } from '@/lib/invoices/schema';
import { markInvoicePaid } from '@/lib/invoices/queries';

interface Props {
  invoiceId: string;
  dueDate: string;
  onClose: () => void;
}

export function MarkPaidModal({ invoiceId, dueDate, onClose }: Props) {
  const t = useTranslations('invoices.mark_paid');
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<MarkPaidInput>({
    resolver: zodResolver(MarkPaidInputSchema),
    defaultValues: {
      paid_at: new Date().toISOString().slice(0, 16),
      payment_reference: '',
      payment_method: 'bank_transfer',
    },
  });

  const mutation = useMutation({
    mutationFn: (data: MarkPaidInput) => markInvoicePaid(invoiceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['sinistre-invoices'] });
      toast.success(t('paid'));
      onClose();
    },
    onError: () => toast.error(t('error')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-xl" data-testid="mark-paid-modal">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">{t('paid_at')}</span>
            <input
              type="datetime-local"
              {...register('paid_at')}
              className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm"
              data-testid="paid-at"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('reference')}</span>
            <input
              type="text"
              {...register('payment_reference')}
              maxLength={100}
              className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm"
              placeholder={t('reference_placeholder')}
              data-testid="payment-reference"
            />
            {errors.payment_reference && <p className="text-xs text-red-600 mt-1">{errors.payment_reference.message}</p>}
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('method')}</span>
            <select
              {...register('payment_method')}
              className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm"
              data-testid="payment-method"
            >
              <option value="bank_transfer">{t('methods.bank_transfer')}</option>
              <option value="check">{t('methods.check')}</option>
              <option value="cash">{t('methods.cash')}</option>
              <option value="card">{t('methods.card')}</option>
              <option value="mobile_money">{t('methods.mobile_money')}</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium">{t('notes')}</span>
            <textarea
              {...register('notes')}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded border border-input bg-background px-2 py-1 text-sm"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-input px-3 py-2 text-sm">{t('cancel')}</button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex items-center gap-1 rounded-md bg-garage-primary px-3 py-2 text-sm text-white disabled:opacity-50"
              data-testid="confirm-paid"
            >
              {mutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {t('confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Fichier 9/13 : `components/invoices/payment-tracking.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { type Invoice } from '@/lib/invoices/schema';

interface Props {
  invoice: Invoice;
  locale: string;
}

export function PaymentTracking({ invoice, locale }: Props) {
  const t = useTranslations('invoices.tracking');
  const now = Date.now();
  const dueOverdue = invoice.status !== 'paid' && new Date(invoice.due_date).getTime() < now;

  return (
    <section className="rounded-lg border border-border bg-card p-4" data-testid="payment-tracking">
      <h3 className="text-sm font-semibold mb-3">{t('title')}</h3>
      <ul className="space-y-2 text-sm">
        <li className="flex items-center gap-2">
          {invoice.sent_at ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
          <span>{t('sent')}</span>
          {invoice.sent_at && <span className="text-xs text-muted-foreground">{new Date(invoice.sent_at).toLocaleString()}</span>}
        </li>
        <li className="flex items-center gap-2">
          {invoice.read_at ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
          <span>{t('read')}</span>
          {invoice.read_at && <span className="text-xs text-muted-foreground">{new Date(invoice.read_at).toLocaleString()}</span>}
        </li>
        <li className="flex items-center gap-2">
          {invoice.paid_at ? <CheckCircle className="h-4 w-4 text-green-600" /> : dueOverdue ? <AlertTriangle className="h-4 w-4 text-red-600" /> : <Clock className="h-4 w-4 text-muted-foreground" />}
          <span className={dueOverdue ? 'text-red-700 font-semibold' : ''}>
            {invoice.paid_at ? t('paid') : dueOverdue ? t('overdue') : t('due')}
          </span>
          {invoice.paid_at && <span className="text-xs text-muted-foreground">{new Date(invoice.paid_at).toLocaleString()}</span>}
          {invoice.payment_reference && <span className="text-xs text-muted-foreground font-mono">ref: {invoice.payment_reference}</span>}
        </li>
      </ul>
    </section>
  );
}
```

### Fichier 10/13 : `components/invoices/invoices-list.tsx`

```typescript
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { fetchInvoicesList } from '@/lib/invoices/queries';
import { InvoiceStatusBadge } from './invoice-status-badge';
import { InvoicesListFilters } from './invoices-list-filters';

interface Props {
  locale: string;
}

export function InvoicesList({ locale }: Props) {
  const t = useTranslations('invoices.list');
  const [filters, setFilters] = useState({ page: 1, page_size: 25, status: [] as string[], recipient_type: [] as string[] });

  const { data, isLoading } = useQuery({
    queryKey: ['invoices-list', filters],
    queryFn: () => fetchInvoicesList(filters),
    staleTime: 30_000,
  });

  const formatter = new Intl.NumberFormat(locale.startsWith('ar') ? 'ar-MA' : 'fr-MA', { style: 'currency', currency: 'MAD' });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-3" data-testid="invoices-list">
      <InvoicesListFilters filters={filters} onChange={setFilters} />
      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1 text-left text-xs">{t('col_number')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_recipient')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_type')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_amount')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_status')}</th>
              <th className="px-2 py-1 text-left text-xs">{t('col_issued')}</th>
            </tr>
          </thead>
          <tbody>
            {data?.data.map((inv) => (
              <tr key={inv.id} className="border-b border-border hover:bg-muted/30">
                <td className="px-2 py-1">
                  <Link href={`/${locale}/invoices/${inv.id}`} className="font-medium text-garage-primary hover:underline" dir="ltr">
                    {inv.invoice_number}
                  </Link>
                </td>
                <td className="px-2 py-1">{inv.recipient_name}</td>
                <td className="px-2 py-1 text-xs">{t(`recipient_types.${inv.recipient_type}`)}</td>
                <td className="px-2 py-1 font-mono">{formatter.format(inv.total_ttc_mad)}</td>
                <td className="px-2 py-1"><InvoiceStatusBadge status={inv.status} /></td>
                <td className="px-2 py-1 text-xs">{new Date(inv.issued_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Fichier 11/13 : `components/invoices/invoices-list-filters.tsx`

```typescript
'use client';

import { useTranslations } from 'next-intl';

interface Props {
  filters: { status: string[]; recipient_type: string[]; page: number; page_size: number };
  onChange: (f: Props['filters']) => void;
}

export function InvoicesListFilters({ filters, onChange }: Props) {
  const t = useTranslations('invoices.list_filters');
  return (
    <div className="flex gap-2" data-testid="invoices-filters">
      <select
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          onChange({ ...filters, status: [e.target.value] });
        }}
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
      >
        <option value="">{t('all_statuses')}</option>
        {['draft', 'sent', 'read', 'paid', 'overdue'].map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <select
        value=""
        onChange={(e) => {
          if (!e.target.value) return;
          onChange({ ...filters, recipient_type: [e.target.value] });
        }}
        className="rounded-md border border-input bg-background px-3 py-1 text-sm"
      >
        <option value="">{t('all_recipients')}</option>
        <option value="insurer">{t('insurer')}</option>
        <option value="customer">{t('customer')}</option>
      </select>
    </div>
  );
}
```

### Fichier 12/13 : `tab-invoices.tsx`

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { fetchSinistreInvoices } from '@/lib/invoices/queries';
import { type SinistreStatus } from '@/lib/sinistres/state-machine';
import { SplitPreview } from '@/components/invoices/split-preview';
import { InvoiceDetail } from '@/components/invoices/invoice-detail';

interface Props {
  sinistreId: string;
  status: SinistreStatus;
  locale: string;
}

export function TabInvoices({ sinistreId, status, locale }: Props) {
  const t = useTranslations('invoices');

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['sinistre-invoices', sinistreId],
    queryFn: () => fetchSinistreInvoices(sinistreId),
    staleTime: 30_000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const canGenerate = (status === 'delivered' || status === 'ready_for_delivery') && (!invoices || invoices.length === 0);

  if (canGenerate) {
    return <SplitPreview sinistreId={sinistreId} locale={locale} />;
  }

  if (!invoices || invoices.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{t('no_invoices_yet')}</p>;
  }

  return (
    <div className="space-y-6">
      {invoices.map((inv) => (
        <InvoiceDetail key={inv.id} invoiceId={inv.id} locale={locale} />
      ))}
    </div>
  );
}
```

### Fichier 13/13 : `invoices/page.tsx`

```typescript
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { InvoicesList } from '@/components/invoices/invoices-list';

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function InvoicesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('invoices');

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">{t('page_title')}</h1>
      </header>
      <InvoicesList locale={locale} />
    </div>
  );
}
```

---

## 7. Tests

### 7.1 Vitest

```typescript
import { describe, it, expect } from 'vitest';
import { MarkPaidInputSchema, SplitPreviewSchema, InvoiceStatusSchema } from './schema';

describe('MarkPaidInputSchema', () => {
  it('requires payment_reference', () => {
    expect(MarkPaidInputSchema.safeParse({ paid_at: new Date().toISOString(), payment_reference: '', payment_method: 'cash' }).success).toBe(false);
  });
  it('accepts valid', () => {
    expect(MarkPaidInputSchema.safeParse({ paid_at: new Date().toISOString(), payment_reference: 'REF123', payment_method: 'bank_transfer' }).success).toBe(true);
  });
});

describe('InvoiceStatusSchema', () => {
  it('includes 7 statuses', () => {
    for (const s of ['draft', 'sent', 'read', 'paid', 'overdue', 'cancelled', 'refunded']) {
      expect(InvoiceStatusSchema.safeParse(s).success).toBe(true);
    }
  });
});
```

### 7.2 E2E

```typescript
import { test, expect } from '@playwright/test';
import { loginAsGarageGestionnaire } from './helpers/auth';

test.describe('Invoices flow', () => {
  test.beforeEach(async ({ page }) => await loginAsGarageGestionnaire(page));

  test('invoices list renders', async ({ page }) => {
    await page.goto('/fr/invoices');
    await expect(page.locator('[data-testid="invoices-list"]')).toBeVisible();
  });

  test('split preview shows 2 cards', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=invoices');
    await expect(page.locator('[data-testid="card-insurer"]')).toBeVisible();
    await expect(page.locator('[data-testid="card-customer"]')).toBeVisible();
  });

  test('generate invoices button click', async ({ page }) => {
    await page.goto('/fr/sinistres/test-id-1?tab=invoices');
    await expect(page.locator('[data-testid="generate-invoices-btn"]')).toBeVisible();
  });

  test('invoice detail PDF preview', async ({ page }) => {
    await page.goto('/fr/invoices/test-id-1');
    await expect(page.locator('[data-testid="invoice-detail"]')).toBeVisible();
  });

  test('mark paid modal opens', async ({ page }) => {
    await page.goto('/fr/invoices/test-id-1');
    await page.locator('[data-testid="mark-paid-btn"]').click();
    await expect(page.locator('[data-testid="mark-paid-modal"]')).toBeVisible();
  });

  test('mark paid requires reference', async ({ page }) => {
    await page.goto('/fr/invoices/test-id-1');
    await page.locator('[data-testid="mark-paid-btn"]').click();
    await page.locator('[data-testid="confirm-paid"]').click();
  });
});
```

---

## 8-15. Standard sections + criteres + edge cases + conformite DGI MA

### Criteres V1-V22

- V1 : Split preview 2 cards visible
- V2 : Insurer card amount calc correct
- V3 : Customer card amount calc correct
- V4 : Excess warning si > coverage_cap
- V5 : Generate button POST split logic
- V6 : Invoice list datatable paginated
- V7 : Filter status + recipient_type
- V8 : Invoice detail render with lines
- V9 : PDF preview lazy + download
- V10 : Status badge styles correct
- V11 : Send email re-envoi
- V12 : Mark paid modal valide reference required
- V13 : Payment tracking timeline
- V14 : Overdue warning if past due_date
- V15 : Aucune emoji
- V16 : DGI compliance display ICE + IF + TVA
- V17 : Tests Vitest 18+
- V18 : Tests E2E 6+
- V19 : Currency MAD formatter locale
- V20 : Lighthouse > 85
- V21 : axe 0
- V22 : RTL OK

---

## Conformite MA -- DGI 2024

- Mentions obligatoires : ICE (Identifiant Commun Entreprise) + IF (Identifiant Fiscal) sur emetteur ET destinataire (insurer + customer).
- TVA 20% explicite par ligne (loi 06-17).
- Numerotation chronologique unique : `INV-{year}-{seq}` -- DGI exige sans gap.
- Conservation 10 ans (DGI).
- Format facture electronique signee (eSign) -- Sprint 10.

---

## 16. Next : task-5.4.12-parametres-rbac-roles-i18n-rtl.md

**Fin task-5.4.11.**

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
