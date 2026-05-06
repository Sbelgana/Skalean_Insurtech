# META-PROMPT B-17 -- SPRINT 17 WEB CUSTOMER PORTAL (Vente en Ligne SEO)

**Version** : v2.2 (Option B -- post decision-010)
**Phase** : 4 -- Vertical Insure (Skalean Broker ERP)
**Sprint** : 17 / 35 (cumul) -- Phase 4 Sprint 4
**Position** : Apres Web Broker App, avant Web Assure Portal
**Numerotation taches** : 4.4.1 a 4.4.14
**Effort total** : ~80 heures developpement / 2 semaines
**Priorite** : P0 (vente en ligne directe = differentiator competitif Skalean MA)

---

## Objectif Global du Sprint

Construire l'application **web-customer-portal** (port 3004) Next.js 15 App Router : **portail public** vente assurance en ligne pour clients particuliers et entreprises. Premier portail vente en ligne d'assurance au Maroc avec comparateur multi-produits natif (Sprint 14 catalog), tarification instantanee (Sprint 14 lookup), pre-approbation KYC auto, paiement, generation provisional policy 7 jours TTL (Sprint 15), envoi a broker validation queue.

A la sortie de ce sprint :
- App web-customer-portal Next.js 15 publique (port 3004 dev / `souscrire.skalean-insurtech.ma` prod)
- Landing page SEO-optimized + product catalog public (no login required)
- Tarification simulator interactif : choisir branche + caracteristiques + voir prix instantane
- Comparateur multi-produits per branche (3-5 options affichees)
- Souscription form en 4 etapes : data personnelle + KYC + paiement + signature
- Pre-approbation KYC auto : CIN format check + risk basics
- Paiement integration Sprint 11 (CMI / mobile money)
- Provisional policy generation post-paiement (Sprint 15 service)
- Submission a broker validation queue (Sprint 15)
- SEO complet : metadata + sitemap + robots + structured data + OG images
- Multilingue fr / ar-MA / ar avec RTL
- Mobile-first responsive (60%+ trafic MA mobile)
- Tests Playwright E2E

---

## Frontiere du Sprint

**INCLUS** :
- Landing pages SEO publiques par branche
- Catalog public products (5 branches)
- Tarification simulator instantane
- Comparateur multi-produits
- Souscription wizard 4 etapes
- Pre-approbation KYC auto
- Integration Pay Sprint 11
- Generation Provisional Policy Sprint 15
- Submission Broker Queue Sprint 15
- SEO + sitemap + structured data
- I18n fr / ar-MA / ar + RTL
- Mobile-first responsive

**EXCLU** (sera ajoute aux sprints suivants) :
- Self-service post-souscription -- Sprint 18 (web-assure-portal)
- Comparateur cross-assureurs reels -- Sprint 32 (Phase 7 connecteurs)
- IA chatbot Agent Sky -- Sprint 31 (defere)
- Optimisation conversion A/B testing -- Phase 7+ post-pilote

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 14 : products catalog + tarification engine
2. Sortie Sprint 15 : ProvisionalPolicyService + BrokerValidationQueueService
3. Sortie Sprint 11 : Pay integration multi-providers
4. Sortie Sprint 16 : pattern Next.js 15 App Router stable

---

## Stack Imposee (Sprint 17)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router + Server Components + Streaming |
| react | 19.0.0 | with React Compiler |
| @hookform/resolvers + react-hook-form | wizard multi-step |
| @tanstack/react-query | 5.62.0 | client mutations |
| recharts | 2.13.x | comparateur visualisations |
| react-pdf | 9.x | preview provisional policy PDF |
| zod | 3.24.1 | validation schemas |
| @vercel/og | 0.6.x | OG images dynamic SEO |
| sitemap | 8.x | sitemap.xml generation |

Variables env publiques : `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_SITE_URL=https://souscrire.skalean-insurtech.ma`, `NEXT_PUBLIC_GA_TRACKING_ID` (Google Analytics).

---

## Vue d'Ensemble des 14 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 4.4.1 | App skeleton + public layout (no auth) + i18n + SEO foundation | 6h | P0 | Sprint 16 |
| 4.4.2 | Landing page racine : hero + 5 branches + benefits + footer | 5h | P0 | 4.4.1 |
| 4.4.3 | Pages branche : 5 landing pages (auto / sante / habitation / RC pro / voyage) | 7h | P0 | 4.4.2 |
| 4.4.4 | Tarification simulator : forms par branche + computation real-time | 7h | P0 | 4.4.3 |
| 4.4.5 | Comparateur multi-produits : 3-5 options + visualisation differences | 5h | P0 | 4.4.4 |
| 4.4.6 | Souscription Wizard etape 1 : data personnelle + adresse | 5h | P0 | 4.4.5 |
| 4.4.7 | Souscription Wizard etape 2 : KYC (CIN photo upload + verification basique) | 6h | P0 | 4.4.6 |
| 4.4.8 | Souscription Wizard etape 3 : paiement (integration Pay Sprint 11) | 6h | P0 | 4.4.7 |
| 4.4.9 | Souscription Wizard etape 4 : signature electronique provisional + confirmation | 5h | P0 | 4.4.8 |
| 4.4.10 | Provisional Policy generation + display + download PDF | 5h | P0 | 4.4.9 |
| 4.4.11 | SEO complet : metadata + sitemap.xml + robots.txt + structured data + OG images | 5h | P0 | 4.4.10 |
| 4.4.12 | I18n fr / ar-MA / ar + RTL + mobile-first responsive | 5h | P0 | 4.4.11 |
| 4.4.13 | Analytics tracking : Google Analytics + custom events conversion funnel | 4h | P0 | 4.4.12 |
| 4.4.14 | Tests E2E Playwright (15+) + Lighthouse perf scores | 9h | P0 | 4.4.13 |

**Total** : 80 heures.

---

# DETAIL DES 14 TACHES

---

## Tache 4.4.1 -- App Skeleton + Public Layout + SEO Foundation

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 6h / Depend de Sprint 16

**But** : Initialiser app `web-customer-portal` Next.js 15 publique (no auth required) avec SEO foundation : metadata API + robots + sitemap structure + OG images.

**Contexte** : Different de Sprint 16 (web-broker authenticate) : portail public optimise pour SEO et conversion. Pas de cookies/sessions sauf cart wizard. Performance critique (Lighthouse 90+ targets).

**Livrables checkables** :
- [ ] Folder `repo/apps/web-customer-portal/`
- [ ] App skeleton Next.js 15 + design tokens Sprint 4
- [ ] Layout public `app/layout.tsx` :
  - Header public (logo + locale switcher + login link "Deja client ?" -> redirect web-assure-portal Sprint 18)
  - Footer (about + links legaux + contact + reseaux sociaux)
- [ ] Metadata foundation `metadata.ts` : titre + description + OG + Twitter card defaults
- [ ] `app/robots.ts` : robots.txt dynamique
- [ ] `app/sitemap.ts` : sitemap.xml generation (toutes pages publiques + per locale)
- [ ] OG images : `app/opengraph-image.tsx` dynamique (Vercel OG)
- [ ] Structured data : `app/_components/jsonld.tsx` (schema.org/InsuranceAgency)
- [ ] Variables env public : `NEXT_PUBLIC_*`
- [ ] No cookies sauf cart wizard (sessionStorage + cookie wizard_token)
- [ ] Preconnect + DNS prefetch fonts/CDN
- [ ] Static optimization : Server Components default
- [ ] Tests : app demarre + sitemap accessible + robots.txt

**Pattern critique : metadata SEO + structured data**

```typescript
// repo/apps/web-customer-portal/app/[locale]/layout.tsx
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const { locale } = params;
  const messages = (await import(`@/messages/${locale}.json`)).default;

  return {
    title: {
      default: messages.seo.default_title,
      template: '%s | Skalean Insurtech',
    },
    description: messages.seo.default_description,
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL!),
    alternates: {
      canonical: `/${locale}`,
      languages: { 'fr': '/fr', 'ar-MA': '/ar-MA', 'ar': '/ar' },
    },
    openGraph: {
      type: 'website',
      locale: locale === 'ar-MA' ? 'ar_MA' : (locale === 'ar' ? 'ar_AR' : 'fr_MA'),
      url: process.env.NEXT_PUBLIC_SITE_URL,
      siteName: 'Skalean Insurtech',
      images: [{ url: '/opengraph-image.png', width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  };
}

// app/_components/jsonld.tsx (structured data schema.org)
export function InsuranceAgencyJsonLd() {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{
      __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'InsuranceAgency',
        name: 'Skalean Insurtech',
        url: process.env.NEXT_PUBLIC_SITE_URL,
        logo: `${process.env.NEXT_PUBLIC_SITE_URL}/logo.png`,
        address: { '@type': 'PostalAddress', streetAddress: '...', addressLocality: 'Casablanca', addressCountry: 'MA' },
        contactPoint: { '@type': 'ContactPoint', telephone: '+212...', contactType: 'customer service', areaServed: 'MA', availableLanguage: ['French', 'Arabic'] },
        sameAs: ['https://www.linkedin.com/...', 'https://www.facebook.com/...'],
      })
    }} />
  );
}
```

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/layout.tsx                                 # ~80 lignes
repo/apps/web-customer-portal/app/[locale]/layout.tsx                          # ~120 lignes
repo/apps/web-customer-portal/components/layout/public-header.tsx              # ~100 lignes
repo/apps/web-customer-portal/components/layout/public-footer.tsx              # ~120 lignes
repo/apps/web-customer-portal/app/robots.ts                                     # ~30 lignes
repo/apps/web-customer-portal/app/sitemap.ts                                    # ~80 lignes (dynamic generation)
repo/apps/web-customer-portal/app/opengraph-image.tsx                            # ~80 lignes (Vercel OG)
repo/apps/web-customer-portal/components/seo/jsonld.tsx                         # ~100 lignes (schema.org)
repo/apps/web-customer-portal/messages/{fr,ar-MA,ar}.json                       # 3 locales
```

**Notes implementation** :
- Pas de middleware auth -- portail public
- Mais cookie session_id pour wizard state preservation
- Server Components default : performance + SEO
- Client Components only pour interactivity (forms, tabs)
- Lighthouse targets : Performance 90+ / SEO 100 / Accessibility 90+

**Criteres validation** :
- V1 (P0) : App demarre port 3004
- V2 (P0) : Robots.txt accessible
- V3 (P0) : Sitemap.xml genere avec pages locales
- V4 (P0) : OG images preview Twitter/Facebook OK
- V5 (P0) : Structured data validates schema.org
- V6 (P0) : Locale routing /fr / /ar-MA / /ar
- V7 (P1) : Tests setup 6+ scenarios

---

## Tache 4.4.2 -- Landing Page Racine

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 5h / Depend de 4.4.1

**But** : Page racine `/[locale]/` : hero + 5 branches CTA + benefits + testimonials + FAQ + footer.

**Livrables checkables** :
- [ ] Page `app/[locale]/page.tsx` (Server Component)
- [ ] Sections :
  1. **Hero** : headline + sous-headline + CTA primary "Calculez votre prix" + visual
  2. **5 branches cards** : Auto / Sante / Habitation / RC Pro / Voyage avec icones + 1 phrase chacun + bouton "Decouvrir"
  3. **How it works** : 4 etapes visuelles (Choisir produit -> Calculer prix -> Souscrire -> Recevoir attestation)
  4. **Benefits** : 6 features cards (rapide, transparent, multi-canal, conforme, garanti, support 24/7)
  5. **Testimonials** : 3-5 quotes clients (placeholder Sprint 17 ; reels post-pilote Sprint 35)
  6. **FAQ** : accordion 8 questions communes (cas usage, paiement, garanties, etc.)
  7. **CTA final** : "Pret a souscrire ?" + bouton
  8. **Footer** : reuse Tache 4.4.1
- [ ] Animations : framer-motion entrance (subtle)
- [ ] Mobile-first : breakpoints sm/md/lg
- [ ] CTAs trackees (Tache 4.4.13 analytics)
- [ ] Internal linking : SEO intra-site
- [ ] Tests : render + responsive + a11y

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/page.tsx                            # ~150 lignes (Server Component)
repo/apps/web-customer-portal/components/home/hero-section.tsx                  # ~100 lignes
repo/apps/web-customer-portal/components/home/branches-grid.tsx                  # ~120 lignes
repo/apps/web-customer-portal/components/home/how-it-works.tsx                   # ~80 lignes
repo/apps/web-customer-portal/components/home/benefits-section.tsx                # ~100 lignes
repo/apps/web-customer-portal/components/home/testimonials.tsx                    # ~80 lignes
repo/apps/web-customer-portal/components/home/faq-accordion.tsx                   # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : Toutes 8 sections render
- V2 (P0) : CTAs trackees
- V3 (P0) : Mobile responsive
- V4 (P0) : Lighthouse Performance 90+
- V5 (P0) : Tests 6+ scenarios

---

## Tache 4.4.3 -- 5 Pages Branches

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 7h / Depend de 4.4.2

**But** : 5 landing pages dediees par branche (`/[locale]/auto`, `/sante`, `/habitation`, `/rc-pro`, `/voyage`) : SEO ciblee + content + CTA tarification.

**Livrables checkables** :
- [ ] 5 pages : `app/[locale]/{auto,sante,habitation,rc-pro,voyage}/page.tsx`
- [ ] Per page :
  - Hero specifique branche
  - Garanties detaillees per produit (depuis Sprint 14 catalog)
  - Comparison vs concurrents (advantages Skalean)
  - Cas d'usage / scenarios
  - Pricing examples (simulators preview)
  - FAQ specifique
  - CTA "Calculer mon prix" -> redirect simulator (Tache 4.4.4)
- [ ] SEO per page :
  - Metadata title + description specifiques
  - Keywords ciblees ("assurance auto Maroc en ligne", "comparateur sante MA", etc.)
  - Structured data Product schema.org
  - Internal links + breadcrumbs
- [ ] Static Generation (`generateStaticParams`) -- pages prerendered
- [ ] ISR : revalidate every hour si contenu change
- [ ] Tests par page

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/auto/page.tsx                       # ~150 lignes
repo/apps/web-customer-portal/app/[locale]/sante/page.tsx                       # ~150 lignes
repo/apps/web-customer-portal/app/[locale]/habitation/page.tsx                  # ~150 lignes
repo/apps/web-customer-portal/app/[locale]/rc-pro/page.tsx                       # ~150 lignes
repo/apps/web-customer-portal/app/[locale]/voyage/page.tsx                       # ~150 lignes
repo/apps/web-customer-portal/components/branche/{several reusable}.tsx         # ~400 lignes total
```

**Notes implementation** :
- ContentSecurityPolicy (CSP) headers : autoriser uniquement domains trusted
- Static prerender : tous pages branche generees au build
- Reutilise composants Tache 4.4.2 (FAQ, hero pattern)

**Criteres validation** :
- V1 (P0) : 5 pages render
- V2 (P0) : SEO metadata per page
- V3 (P0) : Static generation OK
- V4 (P0) : Internal linking
- V5 (P0) : Tests 10+ scenarios

---

## Tache 4.4.4 -- Tarification Simulator

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 7h / Depend de 4.4.3

**But** : Simulator interactif tarification : forms par branche + computation real-time consume Sprint 14 endpoint + display prix instantane.

**Livrables checkables** :
- [ ] Page `/[locale]/simulateur/[branche]` (5 simulators)
- [ ] Form Auto :
  - Vehicule : marque + modele + annee + valeur + categorie
  - Conducteur : age + anciennete permis + region
  - Garanties checkboxes : Vol / Incendie / Bris glace / Catastrophes naturelles
- [ ] Form Sante : age + nombre membres famille + couvertures option
- [ ] Form Habitation : type bien + surface + valeur biens + cambriolage option
- [ ] Form RC Pro : profession + chiffre affaires
- [ ] Form Voyage : destinations + duree + nombre voyageurs
- [ ] Computation real-time : `useDeferredValue` + debounce 500ms appel API `/api/v1/insure/quotes/preview` (Sprint 14 endpoint)
- [ ] Display prix : breakdown (base + garanties + TVA + total) + frequence (annuel/mensuel/trimestriel)
- [ ] CTA "Continuer souscription" -> redirect Tache 4.4.6 wizard etape 1 avec quote en sessionStorage
- [ ] Save quote : INSERT real quote DB (status='draft') -- permet broker suivi later
- [ ] Tests : forms + computation + branches

**Pattern critique : simulator avec computation real-time**

```typescript
// repo/apps/web-customer-portal/app/[locale]/simulateur/auto/page.tsx
'use client';
import { useState, useDeferredValue } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '@/lib/hooks/use-debounce';

const AutoFormSchema = z.object({
  vehicleValue: z.number().min(20000).max(2000000),
  vehicleAge: z.number().min(0).max(30),
  driverAge: z.number().min(18).max(80),
  region: z.enum(['casablanca', 'rabat', 'marrakech', 'tanger', 'autres']),
  noClaimYears: z.number().min(0).max(15),
  garanties: z.array(z.string()).default([]),
});

export default function AutoSimulator() {
  const form = useForm({ resolver: zodResolver(AutoFormSchema) });
  const formData = form.watch();
  const debouncedData = useDebounce(formData, 500);

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote-preview', 'auto', debouncedData],
    queryFn: async () => {
      const isComplete = debouncedData.vehicleValue && debouncedData.driverAge && debouncedData.region;
      if (!isComplete) return null;

      const response = await fetch('/api/v1/insure/quotes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branche: 'auto',
          souscripteurData: debouncedData,
          garanties: debouncedData.garanties,
        }),
      });
      return response.json();
    },
    enabled: !!debouncedData.vehicleValue,
  });

  function continueToWizard() {
    if (!quote) return;
    sessionStorage.setItem('current_quote', JSON.stringify({ branche: 'auto', data: formData, quote }));
    router.push(`/${locale}/souscription/etape-1`);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card>
        <CardHeader><CardTitle>Configurez votre devis Auto</CardTitle></CardHeader>
        <CardContent>{/* Form fields */}</CardContent>
      </Card>
      <Card className="sticky top-4 h-fit">
        <CardHeader><CardTitle>Votre prix instantane</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <Skeleton /> : quote ? (
            <PriceBreakdown breakdown={quote.breakdown} />
          ) : <p>Renseignez les champs pour voir votre prix</p>}
          <Button onClick={continueToWizard} disabled={!quote} className="w-full mt-4">
            Continuer la souscription
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/simulateur/{5 branches}/page.tsx     # ~750 lignes total
repo/apps/web-customer-portal/components/simulator/{several components}.tsx     # ~600 lignes total
repo/apps/web-customer-portal/lib/hooks/use-debounce.ts                          # ~30 lignes
```

**Criteres validation** :
- V1 (P0) : 5 simulators (1 par branche)
- V2 (P0) : Real-time computation debounced 500ms
- V3 (P0) : Quote breakdown display
- V4 (P0) : Save quote DB status=draft
- V5 (P0) : Continue redirect wizard
- V6 (P0) : Tests 10+ scenarios

---

## Tache 4.4.5 -- Comparateur Multi-Produits

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 5h / Depend de 4.4.4

**But** : Comparateur per branche : 3-5 produits options (Tiers / Tiers+ / Tous Risques pour auto) + visualisation differences side-by-side.

**Livrables checkables** :
- [ ] Page `/[locale]/comparer/[branche]`
- [ ] Form criteres user (similar simulator) -> request 5 quotes parallele (1 per produit branche)
- [ ] Display side-by-side cards : prix + garanties + exclusions + recommendation (highlighted "Best value")
- [ ] Toggle vue : Cards / Table detailed
- [ ] Filter / sort : par prix / par couverture
- [ ] CTA per card : "Souscrire ce produit" -> wizard Tache 4.4.6
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/comparer/[branche]/page.tsx           # ~150 lignes
repo/apps/web-customer-portal/components/compare/products-grid.tsx                # ~200 lignes
repo/apps/web-customer-portal/components/compare/products-table.tsx                # ~180 lignes
```

**Criteres validation** :
- V1 (P0) : 5 quotes parallel computation
- V2 (P0) : Side-by-side display
- V3 (P0) : Filter / sort
- V4 (P0) : Tests 5+ scenarios

---

## Tache 4.4.6 -- Souscription Wizard Etape 1 : Data Personnelle

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 5h / Depend de 4.4.5

**But** : Premier ecran wizard souscription : data personnelle + adresse (validation Zod stricte MA formats).

**Livrables checkables** :
- [ ] Page `/[locale]/souscription/etape-1`
- [ ] Form react-hook-form :
  - Type : Particulier ou Entreprise (radio)
  - Si Particulier : prenom + nom + CIN (format MA) + date naissance + telephone (E.164 +212) + email
  - Si Entreprise : raison sociale + ICE (15 chiffres + checksum) + RC + patente + representant legal
  - Adresse : pays MA + ville + codepostal + adresse complete
- [ ] Progress bar : etape 1/4
- [ ] Validation Zod stricte : CIN format, ICE checksum, phone E.164
- [ ] Save dans sessionStorage `wizard_state.step1` apres validation
- [ ] Auto-save brouillon : POST /api/v1/insure/wizards (preserve state si refresh)
- [ ] Bouton "Continuer" -> etape 2
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/souscription/etape-1/page.tsx          # ~150 lignes
repo/apps/web-customer-portal/components/wizard/wizard-progress.tsx                # ~50 lignes
repo/apps/web-customer-portal/components/wizard/personal-data-form.tsx             # ~200 lignes
repo/apps/web-customer-portal/lib/wizard/wizard-state.ts                            # session manager
```

**Criteres validation** :
- V1 (P0) : Form particulier + entreprise
- V2 (P0) : Validation Zod stricte
- V3 (P0) : CIN + ICE + phone formats valides
- V4 (P0) : Auto-save + reload state
- V5 (P0) : Tests 8+ scenarios

---

## Tache 4.4.7 -- Souscription Wizard Etape 2 : KYC

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 6h / Depend de 4.4.6

**But** : Etape 2 : KYC upload CIN photo recto/verso + verification basique (OCR future Sprint 30+, Sprint 17 = check format file + manual review fallback).

**Livrables checkables** :
- [ ] Page `/[locale]/souscription/etape-2`
- [ ] Upload zones : CIN recto + CIN verso (drag-drop ou click)
- [ ] Validation : taille < 5MB + format jpg/png/pdf + clarity check basique
- [ ] Si entreprise : upload Kbis + statuts + RIB
- [ ] Server-side : upload S3 multi-tenant (Sprint 10) + virus scan
- [ ] Pre-approbation auto (Sprint 17 basique) :
  - CIN format MA OK
  - Files uploaded
  - Pas anti-fraude flags Sprint 11
- [ ] Si pre-approbation OK : status='preapproved' + continue etape 3
- [ ] Si fail : status='manual_review' + message "Notre equipe verifiera"
- [ ] Sprint 30+ : OCR auto extraction via Skalean AI
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/souscription/etape-2/page.tsx          # ~150 lignes
repo/apps/web-customer-portal/components/wizard/kyc-upload.tsx                      # ~200 lignes
repo/apps/web-customer-portal/components/wizard/upload-zone.tsx                      # ~120 lignes (drag-drop)
```

**Criteres validation** :
- V1 (P0) : Upload zones drag-drop
- V2 (P0) : Validation files
- V3 (P0) : S3 upload reussit
- V4 (P0) : Pre-approbation logic
- V5 (P0) : Tests 8+ scenarios

---

## Tache 4.4.8 -- Souscription Wizard Etape 3 : Paiement

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 6h / Depend de 4.4.7

**But** : Etape 3 : choisir methode paiement + integrer Pay Sprint 11 + redirect provider + handle return URL.

**Livrables checkables** :
- [ ] Page `/[locale]/souscription/etape-3`
- [ ] Recap quote : prix + frequence + total
- [ ] Choix frequence : annuel / mensuel / trimestriel (avec frais conversion afficher)
- [ ] Choix methode : cartes (CMI) / mobile money (Inwi/Orange) / virement / cash kiosque
- [ ] Initialize Pay : POST /api/v1/pay/transactions/initiate
- [ ] Si redirect-based : 3D Secure ou portail provider -> redirect
- [ ] Page de retour `/souscription/paiement/return?transaction_id=...` -- handle success/fail/pending
- [ ] Polling status si pending : every 5s pendant 60s max
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/souscription/etape-3/page.tsx          # ~150 lignes
repo/apps/web-customer-portal/app/[locale]/souscription/paiement/return/page.tsx   # ~120 lignes
repo/apps/web-customer-portal/components/wizard/payment-methods.tsx                  # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Recap visible
- V2 (P0) : Methode payment selection
- V3 (P0) : Pay initiate + redirect
- V4 (P0) : Return handle success/fail
- V5 (P0) : Polling pending
- V6 (P0) : Tests 8+ scenarios

---

## Tache 4.4.9 -- Souscription Wizard Etape 4 : Signature + Confirmation

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 5h / Depend de 4.4.8

**But** : Etape 4 finale : signature electronique provisional policy + page confirmation finale.

**Livrables checkables** :
- [ ] Page `/[locale]/souscription/etape-4`
- [ ] Display provisional policy preview (PDF)
- [ ] Signature workflow Barid eSign Sprint 10 : embed signing widget OR redirect Barid + return
- [ ] Apres signature : provisional policy status='active' + soumission broker queue
- [ ] Page confirmation `/souscription/confirmation` :
  - Big "Felicitations" message
  - Recap : numero provisional + valid_until 7j + assure infos + prime
  - Bouton "Telecharger attestation provisoire PDF"
  - Message : "Notre equipe valide votre dossier sous 24h. Vous recevrez votre police definitive par email."
  - Email auto envoye avec attestation (Sprint 9 Comm)
  - Sms WhatsApp confirmation
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/[locale]/souscription/etape-4/page.tsx          # ~150 lignes
repo/apps/web-customer-portal/app/[locale]/souscription/confirmation/page.tsx     # ~180 lignes
repo/apps/web-customer-portal/components/wizard/signature-step.tsx                  # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Provisional policy preview
- V2 (P0) : Signature complete
- V3 (P0) : Submission broker queue
- V4 (P0) : Confirmation page complete
- V5 (P0) : Email + SMS confirmation envoyes
- V6 (P0) : Tests 6+ scenarios

---

## Tache 4.4.10 -- Provisional Policy Generation + Display + PDF

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 5h / Depend de 4.4.9

**But** : Generation provisional policy via Sprint 15 + display dans confirmation + download PDF.

**Livrables checkables** :
- [ ] API call Sprint 15 : POST /api/v1/insure/provisional/generate (apres etape 4)
- [ ] Display provisional infos : numero + valid dates + garanties basiques
- [ ] PDF preview : `react-pdf` viewer integration
- [ ] Download PDF : signed URL S3 (Sprint 10)
- [ ] QR code visible : verification publique Sprint 10
- [ ] Watermark "PROVISOIRE" affiche
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/components/wizard/provisional-display.tsx             # ~180 lignes
repo/apps/web-customer-portal/components/wizard/pdf-viewer.tsx                       # ~100 lignes
```

**Criteres validation** :
- V1 (P0) : Provisional generated
- V2 (P0) : Display complete
- V3 (P0) : PDF preview + download
- V4 (P0) : QR code + watermark visible
- V5 (P0) : Tests 5+ scenarios

---

## Tache 4.4.11 -- SEO Complet

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 5h / Depend de 4.4.10

**But** : Optimisation SEO finale : metadata exhaustive + sitemap dynamique + structured data per page + OG images dynamiques.

**Livrables checkables** :
- [ ] Metadata API per page (titre + description + keywords + OG)
- [ ] Sitemap.xml dynamique : toutes pages + priorities + changefreq
- [ ] Robots.txt : allow tous + sitemap reference
- [ ] Structured data per page :
  - Home : InsuranceAgency
  - Branche : Product + InsuranceProduct
  - Articles blog (Phase 7+) : Article
- [ ] OG images dynamiques per page (Vercel OG)
- [ ] Canonical URLs
- [ ] Hreflang per locale
- [ ] Performance : preload critical fonts + dns-prefetch
- [ ] Lighthouse audit : Performance 90+ / SEO 100 / Accessibility 90+
- [ ] Tests SEO

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/app/sitemap.ts                                     # update
repo/apps/web-customer-portal/components/seo/{several jsonld variants}.tsx        # ~300 lignes
repo/apps/web-customer-portal/app/{various pages}/opengraph-image.tsx              # OG images
```

**Criteres validation** :
- V1 (P0) : Metadata exhaustive
- V2 (P0) : Sitemap genere correctement
- V3 (P0) : Structured data validates
- V4 (P0) : Lighthouse SEO 100
- V5 (P0) : Tests SEO 8+ scenarios

---

## Tache 4.4.12 -- I18n + RTL + Mobile-First Responsive

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 5h / Depend de 4.4.11

**But** : I18n complete fr / ar-MA / ar + RTL CSS + mobile-first responsive (60%+ trafic MA mobile).

**Livrables checkables** :
- [ ] Messages 3 locales complete (~600 keys)
- [ ] RTL CSS appliquee ar/ar-MA
- [ ] Mobile breakpoints : sm 640px, md 768px, lg 1024px, xl 1280px
- [ ] Touch-friendly : tap targets 44px+ (a11y standard)
- [ ] Performance mobile : LCP < 2.5s, CLS < 0.1, INP < 200ms
- [ ] Tests responsive multiple viewports

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/messages/{fr,ar-MA,ar}.json                         # update
repo/apps/web-customer-portal/app/globals.css                                     # RTL CSS
```

**Criteres validation** :
- V1 (P0) : 3 locales complete
- V2 (P0) : RTL fonctionne ar/ar-MA
- V3 (P0) : Mobile responsive tous viewports
- V4 (P0) : Core Web Vitals greens
- V5 (P0) : Tests 8+ scenarios

---

## Tache 4.4.13 -- Analytics Tracking

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 4h / Depend de 4.4.12

**But** : Google Analytics 4 + custom events conversion funnel + GDPR/CNDP compliance (cookie banner).

**Livrables checkables** :
- [ ] Cookie banner CNDP-compliant : accept/refuse cookies analytics
- [ ] Google Analytics 4 setup (env GA_TRACKING_ID)
- [ ] Custom events conversion funnel :
  - landing_page_view
  - branche_page_view
  - simulator_started
  - simulator_completed
  - wizard_step_1/2/3/4_started
  - wizard_completed
  - provisional_generated
- [ ] Privacy : pas tracking sans consent
- [ ] Server-side analytics aussi (Sprint 13 ETL fct events)
- [ ] Tests : events fired correctly

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/components/analytics/cookie-banner.tsx              # ~150 lignes
repo/apps/web-customer-portal/components/analytics/ga-script.tsx                   # ~80 lignes
repo/apps/web-customer-portal/lib/analytics/track-event.ts                          # helpers
```

**Criteres validation** :
- V1 (P0) : Cookie banner CNDP
- V2 (P0) : GA4 fires on consent
- V3 (P0) : Custom events funnel
- V4 (P0) : Tests 6+ scenarios

---

## Tache 4.4.14 -- Tests E2E + Lighthouse

**Metadonnees** : Phase 4 / Sprint 17 / P0 / 9h / Depend de 4.4.13

**But** : Suite tests Playwright + Lighthouse audits performance.

**Livrables checkables** :

**Tests E2E (15+)** :
- [ ] Landing pages : 5 branches accessible (5)
- [ ] Simulators : 5 branches computation (5)
- [ ] Wizard 4 etapes flow complete (4)
- [ ] Cookie banner accept/refuse (2)
- [ ] SEO meta + sitemap (3)

**Lighthouse audits** :
- [ ] Performance > 90
- [ ] SEO = 100
- [ ] Accessibility > 90
- [ ] Best Practices > 95

**Fichiers crees / modifies** :
```
repo/apps/web-customer-portal/e2e/{15+ specs}.spec.ts
repo/apps/web-customer-portal/lighthouse-audit-config.json
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent
- V2 (P0) : CI green
- V3 (P0) : Lighthouse all green
- V4 (P0) : Reproducibility 5x

---

## Sortie du Sprint 17

A la fin de l'execution des 14 taches :

```
Web Customer Portal operational :
  - Next.js 15 portail public (port 3004)
  - Landing page + 5 pages branches SEO-optimized
  - 5 simulators tarification real-time
  - Comparateur multi-produits per branche
  - Souscription wizard 4 etapes
  - Pre-approbation KYC auto
  - Integration Pay Sprint 11
  - Provisional Policy Sprint 15 generation
  - Submission Broker Queue Sprint 15
  - SEO complet : metadata + sitemap + structured data + OG images
  - I18n fr / ar-MA / ar + RTL + mobile-first
  - GA4 analytics + custom events + CNDP cookie banner
  - 15+ tests Playwright E2E
  - Lighthouse Performance/SEO/A11y all green

Premier portail vente en ligne d'assurance complet au Maroc
```

**Sprint 18 (Web Assure Portal + Mobile PWA) demarre avec** :
- Pattern Next.js 15 stable
- Customer journey complete (souscription > provisional > validation broker > police definitive)
- Web-assure-portal pour assures post-souscription self-service

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-4.4.X-*.md` dans `00-pilotage/prompts-taches/sprint-17-web-customer-portal/`.

**Patterns code inline conserves** : metadata SEO + structured data schema.org InsuranceAgency, simulator avec computation real-time debounced.

**Reference** : Sprint 16 pattern Next.js 15 stable.

---

**Fin du meta-prompt B-17 v2.2 format Option B.**
