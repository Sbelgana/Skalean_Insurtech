# PATTERNS DE GENERATION DE CODE skalean-insurtech v2.0

**Version** : 2.0.0
**Date** : 2026-05-04
**Description** : Patterns de code recurrents que toute tache doit suivre pour garantir la coherence du projet
**AUCUNE EMOJI AUTORISEE**

**Changelog v2.0** :
- Ajout pattern 13 : Page publique web-customer-portal (sans auth, rate-limited, SEO-optimized)
- Ajout pattern 14 : PWA mobile capture camera + voix (web-assure-mobile)
- Ajout pattern 15 : Cross-tenant authorization client -> garage
- Ajout pattern 16 : Service backend KYC pre-approbation
- Ajout pattern 17 : Composant carte Mapbox garages agrees

---

## INTRODUCTION

Ce document fournit les patterns de reference pour les structures de code recurrentes du projet skalean-insurtech. Toute tache qui implemente un de ces patterns DOIT respecter exactement la structure decrite ici. Toute deviation doit etre explicitement justifiee dans la section "NOTES IMPORTANTES" du fichier task correspondant.

Les patterns couvrent :
- 1 a 12 (v1.0) : services NestJS, controllers REST, validation Zod, tests Vitest, migrations TypeORM, modules NestJS, integration Skalean AI, publishers Kafka, audit ACAPS, page Next.js authentifiee, test E2E Playwright
- 13 a 17 (v2.0) : page publique sans auth, PWA mobile, cross-tenant authorization, KYC pre-approbation, carte Mapbox

---

## PATTERN 1 -- SERVICE NESTJS STANDARD

(Inchange v1.0 -- voir documentation pour details. Resume :)

Tout service metier suit cette structure stricte :
- Repository TypeORM injecte
- KafkaPublisher injecte
- AcapsAuditService injecte
- Logger Pino injecte
- Multi-tenant filter sur chaque query
- Validation Zod en debut de methode
- Audit ACAPS sur create/update/delete
- Event Kafka publie sur action metier

(Voir code complet dans v1.0 -- structure inchangee)

---

## PATTERN 2 -- CONTROLLER REST NESTJS (mise a jour v2.0)

(Pattern 1 -- inchange pour endpoints authentifies)

**Variante v2.0 -- Controller pour endpoints authentifies Assure** :

```typescript
@ApiTags('assure/policies')
@ApiBearerAuth()
@Controller('api/v1/assure/policies')
@UseGuards(AuthGuard, TenantGuard, RolesGuard)
@Roles('assure')  // role specifique niveau 3
export class AssurePoliciesController {
  constructor(private readonly service: AssurePoliciesService) {}

  @Get()
  async getMyPolicies(@CurrentUser() user: CurrentUserContext) {
    return this.service.getPoliciesForUser(user.userId, user.tenantId);
  }
}
```

Points specifiques role Assure :
- Permissions limitees a `read` sur ses propres polices
- Permission `write` uniquement sur ses sinistres declares
- Aucun acces aux donnees d'autres tenants meme en lecture

---

## PATTERN 3 a 12 (inchanges v1.0)

(Voir documentation v1.0 pour details complets)

---

## PATTERN 13 NOUVEAU v2.0 -- PAGE PUBLIQUE WEB-CUSTOMER-PORTAL

Pour le portail prospect (web-customer-portal), les pages sont publiques. Pas d'authentification requise. Optimisees SEO et performance.

### Structure de page Next.js publique

```typescript
// apps/web-customer-portal/app/quote/[type]/page.tsx

import type { Metadata } from 'next';
import { generateStaticParams as generateStaticParamsForTypes } from '@/lib/insurance-types';
import { QuoteFormWizard } from '@/components/quote/QuoteFormWizard';
import { TestimonialsSection } from '@/components/marketing/TestimonialsSection';
import { TrustBadges } from '@/components/marketing/TrustBadges';

// SEO meta-tags dynamiques
export async function generateMetadata({
  params,
}: {
  params: { type: string };
}): Promise<Metadata> {
  const insuranceType = params.type;
  return {
    title: `Devis ${insuranceType} en ligne | Skalean Assurance Maroc`,
    description: `Comparez les meilleures offres d'assurance ${insuranceType} au Maroc en moins de 5 minutes. 5 assureurs leaders. Sans engagement.`,
    keywords: [
      `assurance ${insuranceType}`,
      'comparateur assurance maroc',
      'devis assurance en ligne',
      'wafa assurance',
      'atlanta sanad',
    ],
    openGraph: {
      title: `Devis ${insuranceType} | Skalean`,
      description: `Comparez 5 assureurs marocains en quelques minutes`,
      images: [`/og-images/quote-${insuranceType}.png`],
      locale: 'fr_MA',
      type: 'website',
    },
    alternates: {
      languages: {
        fr: `/fr/quote/${insuranceType}`,
        'ar-MA': `/ar-ma/quote/${insuranceType}`,
        ar: `/ar/quote/${insuranceType}`,
      },
    },
  };
}

// SSG pour les types fixes
export async function generateStaticParams() {
  return [
    { type: 'auto' },
    { type: 'habitation' },
    { type: 'sante' },
    { type: 'vie' },
  ];
}

// Server Component par defaut (Next.js App Router)
export default async function QuotePage({
  params,
}: {
  params: { type: string };
}) {
  return (
    <main className="min-h-screen">
      <section className="hero bg-gradient-skalean">
        <h1 className="text-4xl md:text-6xl font-bold">
          Devis Assurance {params.type} en quelques minutes
        </h1>
      </section>

      <QuoteFormWizard insuranceType={params.type} />

      <TrustBadges />

      <TestimonialsSection />
    </main>
  );
}
```

### Wizard formulaire prospect (sans auth)

```typescript
// apps/web-customer-portal/components/quote/QuoteFormWizard.tsx

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useProspectSession } from '@/hooks/useProspectSession';
import { ofetch } from 'ofetch';
import { trackEvent } from '@/lib/analytics';

const QuoteCriteriaSchema = z.object({
  insuranceType: z.enum(['auto', 'habitation', 'sante', 'vie']),
  age: z.number().int().min(18).max(100),
  city: z.string().min(2).max(100),
  vehicle: z
    .object({
      make: z.string(),
      model: z.string(),
      year: z.number().int(),
      plate: z.string().optional(),
    })
    .optional(),
  contactEmail: z.string().email(),
  contactPhone: z.string().regex(/^\+212[0-9]{9}$/),
  contactName: z.string().min(2).max(100),
  consents: z.object({
    dataProcessing: z.literal(true),
    marketing: z.boolean().default(false),
  }),
});

type QuoteCriteria = z.infer<typeof QuoteCriteriaSchema>;

export function QuoteFormWizard({ insuranceType }: { insuranceType: string }) {
  const [step, setStep] = useState(1);
  const { sessionToken, ensureSession } = useProspectSession();

  const form = useForm<QuoteCriteria>({
    resolver: zodResolver(QuoteCriteriaSchema),
    defaultValues: { insuranceType: insuranceType as any },
  });

  async function onSubmit(data: QuoteCriteria) {
    await ensureSession();

    // PII non stockee en DB persistante avant inscription -- session Redis TTL 30min
    const result = await ofetch('/api/v1/public/quote/start', {
      method: 'POST',
      body: { criteria: data, sessionToken },
      headers: {
        'x-session-token': sessionToken,
        'accept-language': document.documentElement.lang,
      },
    });

    trackEvent('prospect_quote_submitted', { insuranceType, sessionToken });

    // Redirige vers comparateur avec resultats
    window.location.href = `/quote/${insuranceType}/compare?id=${result.quoteRequestId}`;
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-3xl mx-auto">
      {step === 1 && <StepProfile form={form} onNext={() => setStep(2)} />}
      {step === 2 && <StepSpecificities form={form} onNext={() => setStep(3)} />}
      {step === 3 && <StepContact form={form} onSubmit={form.handleSubmit(onSubmit)} />}
    </form>
  );
}
```

### Endpoint backend public (sans auth)

```typescript
// apps/api/src/public-quote/public-quote.controller.ts

import { Controller, Post, Body, Headers, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { ZodValidationPipe } from '@insurtech/shared-utils';
import { PublicEndpointGuard } from './guards/public-endpoint.guard';
import { ProspectQuoteService } from './services/prospect-quote.service';
import { Public } from '@insurtech/auth';

const QuoteStartSchema = z.object({
  criteria: z.object({
    insuranceType: z.enum(['auto', 'habitation', 'sante', 'vie']),
    age: z.number().int().min(18).max(100),
    city: z.string(),
    vehicle: z.object({}).passthrough().optional(),
    contactEmail: z.string().email(),
    contactPhone: z.string(),
    contactName: z.string(),
    consents: z.object({
      dataProcessing: z.literal(true),
      marketing: z.boolean().default(false),
    }),
  }),
  sessionToken: z.string().min(32).max(64),
});

@Controller('api/v1/public/quote')
@UseGuards(PublicEndpointGuard)
export class PublicQuoteController {
  constructor(private readonly prospectQuote: ProspectQuoteService) {}

  @Post('start')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })  // 30/min/IP
  async startQuote(
    @Body(new ZodValidationPipe(QuoteStartSchema))
    dto: z.infer<typeof QuoteStartSchema>,
    @Headers('x-session-token') sessionToken: string,
    @Headers('user-agent') userAgent: string,
    @Headers('cf-connecting-ip') ipAddress: string,
  ) {
    return this.prospectQuote.startQuote({
      ...dto,
      ipAddress,
      userAgent,
    });
  }
}
```

### Service backend prospect

```typescript
// apps/api/src/public-quote/services/prospect-quote.service.ts

import { Injectable } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProspectQuoteRequestEntity } from '@insurtech/database';
import { ConsentValidator } from './consent-validator';
import { CotationMatchingService } from './cotation-matching.service';

@Injectable()
export class ProspectQuoteService {
  constructor(
    @InjectRepository(ProspectQuoteRequestEntity)
    private readonly repo: Repository<ProspectQuoteRequestEntity>,
    private readonly consents: ConsentValidator,
    private readonly cotationMatching: CotationMatchingService,
    private readonly logger: Logger,
  ) {}

  async startQuote(input: {
    criteria: any;
    sessionToken: string;
    ipAddress: string;
    userAgent: string;
  }) {
    // Validation consent obligatoire (loi 09-08 CNDP)
    if (!input.criteria.consents?.dataProcessing) {
      throw new BadRequestException('Consent dataProcessing required');
    }

    // PII volontaire en session Redis (TTL 30 min) avant inscription complete
    // La table prospect_quote_requests stocke uniquement criteres et contact pour suivi
    // Anonymisation auto apres 30 jours si non converti

    const quoteRequest = await this.repo.save({
      criteria: input.criteria,
      contactEmail: input.criteria.contactEmail,
      contactPhone: input.criteria.contactPhone,
      contactName: input.criteria.contactName,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      status: 'criteria_filled',
    });

    this.logger.log({
      msg: 'prospect_quote_started',
      quoteRequestId: quoteRequest.id,
      insuranceType: input.criteria.insuranceType,
      sessionToken: input.sessionToken,
    });

    // Lance cotation IA en background (parallele 5 assureurs)
    this.cotationMatching
      .triggerComparison(quoteRequest.id, input.criteria)
      .catch((err) =>
        this.logger.error({ msg: 'cotation_matching_failed', err, quoteRequestId: quoteRequest.id }),
      );

    return { quoteRequestId: quoteRequest.id };
  }
}
```

### Points obligatoires pattern 13

- Aucune authentification requise (`@Public()`)
- Rate limiting strict (30/min/IP)
- Validation Zod sur body
- Sessions Redis TTL 30 min (pas de PII persiste avant inscription)
- Consent `dataProcessing` obligatoire
- Logger Pino avec champs traceables (quote_request_id, session_token)
- Performance Lighthouse 95+ vise
- SEO meta-tags dynamiques avec Open Graph et hreflang
- Multi-langue (fr, ar-MA, ar) detecte automatiquement
- Anonymisation automatique apres 30 jours si non converti

---

## PATTERN 14 NOUVEAU v2.0 -- PWA MOBILE CAPTURE CAMERA + VOIX

Pour `web-assure-mobile`, optimise pour declaration sinistre rapide depuis mobile.

### Configuration PWA Next.js

```typescript
// apps/web-assure-mobile/next.config.mjs

import withPWA from 'next-pwa';

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.skalean-insurtech\.ma\/api\/v1\/assure\//,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-assure-cache',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
        networkTimeoutSeconds: 5,
      },
    },
    {
      urlPattern: /\.(png|jpg|jpeg|webp|svg)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images-cache',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

export default pwaConfig({
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
});
```

### Manifest PWA

```json
// apps/web-assure-mobile/public/manifest.json
{
  "name": "Mon Espace Skalean Assurance",
  "short_name": "Skalean",
  "description": "Suivi polices et declaration sinistre instantanee",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "theme_color": "#E95D2C",
  "background_color": "#1A2730",
  "lang": "fr",
  "dir": "ltr",
  "categories": ["finance", "productivity"],
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    {
      "name": "Declarer un sinistre",
      "short_name": "Sinistre",
      "url": "/sinistres/declarer",
      "icons": [{ "src": "/icons/sinistre-96.png", "sizes": "96x96" }]
    }
  ]
}
```

### Composant capture photo guide

```typescript
// apps/web-assure-mobile/components/sinistre/PhotoCapture.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';

const PHOTO_GUIDE_STEPS = [
  { id: 'front', label: 'Face avant du vehicule', icon: '/icons/photo-front.svg' },
  { id: 'rear', label: 'Face arriere du vehicule', icon: '/icons/photo-rear.svg' },
  { id: 'left', label: 'Cote gauche complet', icon: '/icons/photo-left.svg' },
  { id: 'right', label: 'Cote droit complet', icon: '/icons/photo-right.svg' },
  { id: 'damage_zoom', label: 'Zoom sur la zone endommagee', icon: '/icons/photo-zoom.svg' },
  { id: 'plate', label: 'Plaque immatriculation lisible', icon: '/icons/photo-plate.svg' },
] as const;

interface CapturedPhoto {
  stepId: typeof PHOTO_GUIDE_STEPS[number]['id'];
  blob: Blob;
  preview: string;
  geo?: { lat: number; lng: number };
}

export function PhotoCapture({ onComplete }: { onComplete: (photos: CapturedPhoto[]) => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    async function startCamera() {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },  // camera arriere prefere
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
    }
    startCamera();
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function capture() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.92),
    );

    // Compression cote client (~80% reduction taille pour upload rapide)
    const compressed = await imageCompression(new File([blob], 'photo.jpg'), {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 2048,
      useWebWorker: true,
    });

    // Geolocation (precision attendue 50m)
    const geo = await new Promise<GeolocationCoordinates | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 },
      );
    });

    const newPhoto: CapturedPhoto = {
      stepId: PHOTO_GUIDE_STEPS[currentStep].id,
      blob: compressed,
      preview: URL.createObjectURL(compressed),
      geo: geo ? { lat: geo.latitude, lng: geo.longitude } : undefined,
    };

    setPhotos([...photos, newPhoto]);

    if (currentStep < PHOTO_GUIDE_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete([...photos, newPhoto]);
    }
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover" />
      <canvas ref={canvasRef} className="hidden" />

      <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="text-white text-lg font-semibold">
          Photo {currentStep + 1} / {PHOTO_GUIDE_STEPS.length} : {PHOTO_GUIDE_STEPS[currentStep].label}
        </div>
      </div>

      <div className="absolute bottom-0 inset-x-0 p-6 flex justify-center">
        <button
          onClick={capture}
          className="w-20 h-20 rounded-full bg-white border-4 border-skalean-orange"
          aria-label={`Capturer photo ${PHOTO_GUIDE_STEPS[currentStep].label}`}
        />
      </div>
    </div>
  );
}
```

### Composant transcription voix darija

```typescript
// apps/web-assure-mobile/components/sinistre/VoiceDescription.tsx

'use client';

import { useState, useRef } from 'react';
import RecordRTC from 'recordrtc';

export function VoiceDescription({
  locale,
  onTranscript,
}: {
  locale: 'fr' | 'ar-MA' | 'ar';
  onTranscript: (text: string, audioBlob: Blob) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<RecordRTC | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    recorderRef.current = new RecordRTC(stream, {
      type: 'audio',
      mimeType: 'audio/webm',
      sampleRate: 16000,
      desiredSampRate: 16000,
      numberOfAudioChannels: 1,
    });

    recorderRef.current.startRecording();
    setIsRecording(true);

    const start = Date.now();
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - start) / 1000));
      if (Date.now() - start > 300_000) stopRecording();  // max 5 min
    }, 1000);
  }

  async function stopRecording() {
    if (!recorderRef.current) return;
    setIsRecording(false);

    await new Promise<void>((resolve) =>
      recorderRef.current!.stopRecording(() => resolve()),
    );

    const blob = recorderRef.current.getBlob();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Upload vers MCP tool voice-transcribe-ma
    const formData = new FormData();
    formData.append('audio', blob, 'description.webm');
    formData.append('locale', locale);

    const response = await fetch('/api/v1/assure/sinistres/transcribe', {
      method: 'POST',
      body: formData,
    });
    const { transcript } = await response.json();

    onTranscript(transcript, blob);
  }

  return (
    <div className="flex flex-col items-center p-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        className={`w-24 h-24 rounded-full transition-all ${
          isRecording ? 'bg-red-500 animate-pulse scale-110' : 'bg-skalean-orange'
        }`}
        aria-label={isRecording ? 'Arreter enregistrement' : 'Demarrer enregistrement'}
      />
      <div className="mt-4 text-center">
        {isRecording && (
          <div className="text-xl font-mono">
            {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
          </div>
        )}
        <p className="text-sm text-gray-600 mt-2">
          {isRecording
            ? 'Decrivez le sinistre... (max 5 min)'
            : 'Appuyez pour demarrer la description'}
        </p>
      </div>
    </div>
  );
}
```

### Points obligatoires pattern 14

- Manifest PWA valide avec icons 192/512 et purpose `any maskable`
- Service worker auto-registre via next-pwa
- Strategie cache : NetworkFirst pour API, CacheFirst pour images
- Camera arriere preferee (`facingMode: environment`) pour photos sinistre
- Compression cote client systematique (browser-image-compression)
- Geolocation HTML5 avec timeout 5s
- Voice recording max 5 min
- Sample rate 16kHz (optimal pour Skalean AI MCP voice-transcribe-ma)
- Lighthouse PWA score >= 90
- Offline shell minimal (page d'accueil + dernieres polices vues)
- Push notifications via VAPID

---

## PATTERN 15 NOUVEAU v2.0 -- CROSS-TENANT AUTHORIZATION CLIENT -> GARAGE

Quand le client choisit son garage agree, l'autorisation cross-tenant est creee entre le **tenant assure** et le **tenant garage** (et non broker -> garage).

### Service de creation autorisation

```typescript
// packages/assure-portal-services/src/garage-selection/garage-selection.service.ts

import { Injectable, ForbiddenException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  AssureSinistreDeclarationEntity,
  CrossTenantAuthorizationEntity,
  AssureurGaragesAgreesEntity,
  RepairSinistreEntity,
} from '@insurtech/database';
import { KafkaPublisher } from '@insurtech/shared-events';
import { AcapsAuditService } from '@insurtech/horizontal-compliance-acaps';
import { CommWaService } from '@insurtech/horizontal-comm-wa';

@Injectable()
export class GarageSelectionService {
  constructor(
    @InjectRepository(AssureSinistreDeclarationEntity)
    private readonly declarations: Repository<AssureSinistreDeclarationEntity>,
    @InjectRepository(CrossTenantAuthorizationEntity)
    private readonly authorizations: Repository<CrossTenantAuthorizationEntity>,
    @InjectRepository(AssureurGaragesAgreesEntity)
    private readonly garagesAgrees: Repository<AssureurGaragesAgreesEntity>,
    @InjectRepository(RepairSinistreEntity)
    private readonly repairSinistres: Repository<RepairSinistreEntity>,
    private readonly dataSource: DataSource,
    private readonly kafka: KafkaPublisher,
    private readonly acaps: AcapsAuditService,
    private readonly commWa: CommWaService,
    private readonly logger: Logger,
  ) {}

  async selectGarage(input: {
    assureUserId: string;
    assureTenantId: string;
    declarationId: string;
    selectedGarageAgreeId: string;
  }): Promise<{
    authorizationId: string;
    repairSinistreId: string;
    garageTenantId: string;
  }> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Verifier la declaration appartient bien au user
      const declaration = await manager.findOne(AssureSinistreDeclarationEntity, {
        where: {
          id: input.declarationId,
          userId: input.assureUserId,
          tenantId: input.assureTenantId,
        },
      });

      if (!declaration) {
        throw new ForbiddenException('Declaration not found or not owned by user');
      }

      if (declaration.status !== 'garage_selection_pending') {
        throw new ForbiddenException(
          `Cannot select garage in status ${declaration.status}`,
        );
      }

      // 2. Verifier le garage agree existe et est actif
      const garageAgree = await manager.findOne(AssureurGaragesAgreesEntity, {
        where: {
          id: input.selectedGarageAgreeId,
          isActive: true,
        },
      });

      if (!garageAgree || !garageAgree.garageTenantId) {
        throw new ForbiddenException('Garage agree not available or not linked');
      }

      // 3. Empecher self-tenant authorization
      if (garageAgree.garageTenantId === input.assureTenantId) {
        throw new ForbiddenException('Cannot authorize to same tenant');
      }

      // 4. Creer l'autorisation cross-tenant CLIENT -> GARAGE
      const authorization = await manager.save(CrossTenantAuthorizationEntity, {
        grantingTenantId: input.assureTenantId,
        receivingTenantId: garageAgree.garageTenantId,
        authorizationType: 'client_to_garage',  // colonne v2.0
        scope: {
          actions: ['read_sinistre_declaration', 'create_repair_sinistre', 'update_repair_sinistre'],
          resources: ['assure_sinistre_declarations', 'repair_sinistres', 'docs_documents'],
          relatedEntityType: 'assure_sinistre_declaration',
          relatedEntityId: input.declarationId,
        },
        relatedEntityType: 'assure_sinistre_declaration',
        relatedEntityId: input.declarationId,
        grantedByUserId: input.assureUserId,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),  // 90 jours
        metadata: {
          declaredAt: declaration.declaredAt,
          insurerReference: declaration.insurerReference,
          sinistreType: declaration.sinistreType,
        },
      });

      // 5. Creer l'entree repair_sinistres cote garage
      const repairSinistre = await manager.save(RepairSinistreEntity, {
        tenantId: garageAgree.garageTenantId,
        reference: `RS-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
        externalReference: declaration.insurerReference,
        contactId: null,  // sera rempli par garage lors reception
        vehicleVin: null,  // a confirmer par garage
        vehiclePlate: null,
        assureurId: garageAgree.assureurId,
        relatedAssureSinistreDeclarationId: input.declarationId,
        status: 'received',
        receivedAt: new Date(),
        metadata: {
          fromAssureClientFlow: true,
          assureUserId: input.assureUserId,
          authorizationId: authorization.id,
        },
      });

      // 6. Update declaration
      await manager.update(AssureSinistreDeclarationEntity, declaration.id, {
        status: 'garage_selected',
        selectedGarageAgreeId: input.selectedGarageAgreeId,
        selectedGarageTenantId: garageAgree.garageTenantId,
        garageSelectedAt: new Date(),
        crossTenantAuthorizationId: authorization.id,
        relatedRepairSinistreId: repairSinistre.id,
      });

      // 7. Audit ACAPS
      await this.acaps.record({
        tenantId: input.assureTenantId,
        userId: input.assureUserId,
        action: 'create',
        entityType: 'cross_tenant_authorization',
        entityId: authorization.id,
        fieldChanges: {
          authorizationType: 'client_to_garage',
          grantingTenantId: input.assureTenantId,
          receivingTenantId: garageAgree.garageTenantId,
          relatedEntityId: input.declarationId,
        },
      });

      // 8. Event Kafka
      await this.kafka.publish({
        topic: 'insurtech.events.crosstenant.client_garage.authorized',
        key: authorization.id,
        value: {
          authorizationId: authorization.id,
          assureTenantId: input.assureTenantId,
          assureUserId: input.assureUserId,
          garageTenantId: garageAgree.garageTenantId,
          declarationId: input.declarationId,
          repairSinistreId: repairSinistre.id,
          garageName: garageAgree.name,
          garageCity: garageAgree.city,
          occurredAt: new Date().toISOString(),
        },
      });

      // 9. Notifier le garage via WhatsApp
      await this.commWa.sendTemplate({
        tenantId: garageAgree.garageTenantId,
        toPhone: garageAgree.phoneNumber!,
        templateCode: 'new_sinistre_received',
        locale: 'fr',
        variables: {
          sinistreReference: repairSinistre.reference,
          insurerReference: declaration.insurerReference,
          sinistreType: declaration.sinistreType,
        },
      });

      this.logger.log({
        msg: 'cross_tenant_client_garage_authorized',
        authorizationId: authorization.id,
        assureUserId: input.assureUserId,
        garageTenantId: garageAgree.garageTenantId,
        declarationId: input.declarationId,
        repairSinistreId: repairSinistre.id,
      });

      return {
        authorizationId: authorization.id,
        repairSinistreId: repairSinistre.id,
        garageTenantId: garageAgree.garageTenantId,
      };
    });
  }

  async revokeAuthorization(input: {
    authorizationId: string;
    revokerUserId: string;
    reason: string;
  }) {
    const authorization = await this.authorizations.findOne({
      where: { id: input.authorizationId },
    });

    if (!authorization) throw new NotFoundException();

    await this.authorizations.update(input.authorizationId, {
      revokedAt: new Date(),
      revokedByUserId: input.revokerUserId,
      metadata: { ...authorization.metadata, revocationReason: input.reason },
    });

    await this.kafka.publish({
      topic: 'insurtech.events.crosstenant.client_garage.revoked',
      key: input.authorizationId,
      value: {
        authorizationId: input.authorizationId,
        revokedBy: input.revokerUserId,
        reason: input.reason,
        occurredAt: new Date().toISOString(),
      },
    });

    this.logger.log({
      msg: 'cross_tenant_client_garage_revoked',
      authorizationId: input.authorizationId,
      revokerUserId: input.revokerUserId,
    });
  }
}
```

### Guard cross-tenant pour acces garage aux donnees client

```typescript
// packages/auth/src/guards/cross-tenant-client-garage.guard.ts

import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrossTenantAuthorizationEntity } from '@insurtech/database';

@Injectable()
export class CrossTenantClientGarageGuard implements CanActivate {
  constructor(
    @InjectRepository(CrossTenantAuthorizationEntity)
    private readonly authorizations: Repository<CrossTenantAuthorizationEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const targetEntityId = request.params.declarationId || request.params.assureSinistreDeclarationId;

    if (!targetEntityId) return false;

    // Verifie qu'une autorisation active existe entre le tenant garage et l'entite ciblee
    const authorization = await this.authorizations
      .createQueryBuilder('auth')
      .where('auth.receivingTenantId = :tenantId', { tenantId: user.tenantId })
      .andWhere('auth.relatedEntityId = :entityId', { entityId: targetEntityId })
      .andWhere('auth.authorizationType = :type', { type: 'client_to_garage' })
      .andWhere('auth.revokedAt IS NULL')
      .andWhere('(auth.expiresAt IS NULL OR auth.expiresAt > NOW())')
      .getOne();

    if (!authorization) {
      throw new ForbiddenException('No valid cross-tenant authorization');
    }

    // Audit l'acces
    await this.auditAccess(authorization.id, user, request);

    return true;
  }

  private async auditAccess(authorizationId: string, user: any, request: any) {
    // Implementation cross_tenant_audit insertion
  }
}
```

### Points obligatoires pattern 15

- Transaction database obligatoire (5 ecritures liees)
- Verification appartenance declaration au user (pas autre user)
- Verification statut declaration (uniquement `garage_selection_pending`)
- Verification garage agree actif et linked a un tenant
- Empecher self-authorization (assure tenant != garage tenant)
- `authorization_type = 'client_to_garage'` strict (pas broker_to_garage)
- Scope explicite avec actions, resources, relatedEntityId
- TTL 90 jours par defaut (renewable si reparation longue)
- Audit ACAPS obligatoire
- Event Kafka publie
- Notification WhatsApp au garage immediat
- Guard `CrossTenantClientGarageGuard` filtre les acces garage aux donnees client

---

## PATTERN 16 NOUVEAU v2.0 -- SERVICE BACKEND KYC PRE-APPROBATION

```typescript
// packages/customer-portal-services/src/kyc/kyc-pre-approval.service.ts

import { Injectable, BadRequestException } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AssureDocumentUploadedEntity,
  AssureProvisionalPolicyEntity,
} from '@insurtech/database';
import { AgentsService } from '@insurtech/shared-skalean-ai-client';
import { S3Service } from '@insurtech/horizontal-storage';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class KycPreApprovalService {
  constructor(
    @InjectRepository(AssureDocumentUploadedEntity)
    private readonly documents: Repository<AssureDocumentUploadedEntity>,
    @InjectRepository(AssureProvisionalPolicyEntity)
    private readonly provisional: Repository<AssureProvisionalPolicyEntity>,
    private readonly agents: AgentsService,
    private readonly s3: S3Service,
    private readonly config: ConfigService,
    private readonly logger: Logger,
  ) {}

  async processKycPreApproval(input: {
    tenantId: string;
    userId: string;
    quoteRequestId: string;
    selectedQuoteResultId: string;
    uploadedDocumentIds: string[];
  }): Promise<{
    status: 'auto_approved' | 'manual_review' | 'rejected';
    score: number;
    provisionalPolicyId?: string;
    rejectionReason?: string;
  }> {
    const docs = await this.documents.find({
      where: { id: In(input.uploadedDocumentIds), tenantId: input.tenantId, userId: input.userId },
    });

    if (docs.length !== input.uploadedDocumentIds.length) {
      throw new BadRequestException('Some documents not found or unauthorized');
    }

    // 1. Extraire les donnees CIN (OCR via Skalean AI)
    const cinDocs = docs.filter((d) => d.documentType === 'cin_recto' || d.documentType === 'cin_verso');
    const kycExtractionResult = await this.agents.invoke({
      agentId: this.config.get('AGENT_KYC_CIN_EXTRACTION_ID'),
      input: {
        documents: cinDocs.map((d) => ({ id: d.id, type: d.documentType, storageKey: d.documentId })),
      },
      metadata: { tenantId: input.tenantId, userId: input.userId },
    });

    // 2. Calculer score eligibilite via agent fraud-souscription-v1
    const fraudScore = await this.agents.invoke({
      agentId: this.config.get('AGENT_FRAUD_SOUSCRIPTION_ID'),
      input: {
        cinExtracted: kycExtractionResult.output,
        contactProfile: {
          email: docs[0].metadata?.contactEmail,
          phone: docs[0].metadata?.contactPhone,
        },
        ipAddress: docs[0].metadata?.ipAddress,
      },
      metadata: { tenantId: input.tenantId, userId: input.userId },
    });

    const overallScore = fraudScore.output.eligibilityScore as number;

    // 3. Decision selon seuils
    const autoApprovalThreshold = this.config.get<number>('KYC_AUTO_APPROVAL_THRESHOLD')!;
    const manualReviewThreshold = this.config.get<number>('KYC_MANUAL_REVIEW_THRESHOLD')!;
    const autoRejectThreshold = this.config.get<number>('KYC_AUTO_REJECT_THRESHOLD')!;

    let status: 'auto_approved' | 'manual_review' | 'rejected';
    let provisionalPolicyId: string | undefined;
    let rejectionReason: string | undefined;

    if (overallScore < autoRejectThreshold) {
      status = 'rejected';
      rejectionReason = fraudScore.output.indicators?.join(', ') ?? 'High fraud risk detected';
      await this.documents.update({ id: In(input.uploadedDocumentIds) }, { status: 'rejected', rejectedReason: rejectionReason });
    } else if (overallScore < manualReviewThreshold) {
      status = 'manual_review';
      await this.documents.update({ id: In(input.uploadedDocumentIds) }, { status: 'manual_review' });
    } else {
      status = 'auto_approved';
      await this.documents.update({ id: In(input.uploadedDocumentIds) }, { status: 'auto_approved', aiConfidenceScore: overallScore });
      provisionalPolicyId = await this.generateProvisionalPolicy({
        ...input,
        score: overallScore,
      });
    }

    return { status, score: overallScore, provisionalPolicyId, rejectionReason };
  }

  private async generateProvisionalPolicy(input: any): Promise<string> {
    // Generation document provisoire + signature electronique
    // Voir pattern 12 (signature loi 43-20)
    return 'placeholder-provisional-id';
  }
}
```

### Points obligatoires pattern 16

- 2 agents Skalean AI : KYC extraction + fraud scoring
- Seuils configurables via env (auto_approval, manual_review, auto_reject)
- Documents linked via `tenantId` + `userId` (multi-tenant strict)
- Decision auto sur 3 etats (auto_approved, manual_review, rejected)
- Audit ACAPS sur chaque decision (le decorator EventSubscriber le fait auto)
- Document provisoire genere uniquement si auto_approved
- Logger Pino traceable

---

## PATTERN 17 NOUVEAU v2.0 -- COMPOSANT CARTE MAPBOX GARAGES AGREES

```typescript
// packages/shared-maps/src/components/GaragesMapPicker.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import Map, { Marker, Popup, NavigationControl, GeolocateControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Garage {
  id: string;
  name: string;
  city: string;
  latitude: number;
  longitude: number;
  rating?: number;
  distance?: number;
  capacityRemaining?: number;
}

interface GaragesMapPickerProps {
  garages: Garage[];
  initialCenter: { lat: number; lng: number };
  onSelect: (garage: Garage) => void;
  selectedId?: string;
}

const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN!;

export function GaragesMapPicker({
  garages,
  initialCenter,
  onSelect,
  selectedId,
}: GaragesMapPickerProps) {
  const [selectedGarage, setSelectedGarage] = useState<Garage | null>(null);

  return (
    <div className="relative w-full h-[60vh] md:h-[75vh] rounded-lg overflow-hidden">
      <Map
        mapboxAccessToken={MAPBOX_ACCESS_TOKEN}
        initialViewState={{
          longitude: initialCenter.lng,
          latitude: initialCenter.lat,
          zoom: 11,
        }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        attributionControl={false}
        reuseMaps
      >
        <NavigationControl position="top-right" />
        <GeolocateControl
          position="top-right"
          trackUserLocation
          showAccuracyCircle
          fitBoundsOptions={{ maxZoom: 13 }}
        />

        {garages.map((garage) => (
          <Marker
            key={garage.id}
            longitude={garage.longitude}
            latitude={garage.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedGarage(garage);
            }}
          >
            <div
              className={`cursor-pointer transition-all ${
                garage.id === selectedId ? 'scale-125' : ''
              }`}
            >
              <svg width="36" height="44" viewBox="0 0 36 44">
                <path
                  d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z"
                  fill={garage.id === selectedId ? '#E95D2C' : '#1A2730'}
                />
                <circle cx="18" cy="18" r="8" fill="white" />
                <text x="18" y="22" textAnchor="middle" fontSize="11" fontWeight="bold">
                  {garage.rating?.toFixed(1) ?? 'N'}
                </text>
              </svg>
            </div>
          </Marker>
        ))}

        {selectedGarage && (
          <Popup
            longitude={selectedGarage.longitude}
            latitude={selectedGarage.latitude}
            anchor="top"
            onClose={() => setSelectedGarage(null)}
            maxWidth="320px"
          >
            <div className="p-3">
              <h3 className="font-semibold text-base">{selectedGarage.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedGarage.city}
                {selectedGarage.distance && ` -- ${selectedGarage.distance.toFixed(1)} km`}
              </p>
              {selectedGarage.rating && (
                <p className="text-sm mt-1">
                  Note : {selectedGarage.rating.toFixed(1)} / 5
                </p>
              )}
              {selectedGarage.capacityRemaining !== undefined && (
                <p className="text-xs text-gray-500 mt-1">
                  {selectedGarage.capacityRemaining} creneaux disponibles aujourd'hui
                </p>
              )}
              <button
                onClick={() => onSelect(selectedGarage)}
                className="mt-3 w-full bg-skalean-orange text-white py-2 px-4 rounded font-medium"
              >
                Choisir ce garage
              </button>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
```

### Points obligatoires pattern 17

- `mapbox-gl` imports CSS obligatoire
- Token via env public (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`)
- Navigation control + Geolocate control natifs Mapbox
- Markers cliquables avec accessibility
- Popup detaillee avec metadata garage (rating, distance, capacity)
- Bouton CTA distinct pour selection finale
- Reuse maps activee pour performance
- Style adapte (couleurs Skalean orange #E95D2C, dark navy #1A2730)
- Attribution Mapbox obligatoire en production (retiree ici par lisibilite)

---

## REGLES TRANSVERSALES PATTERNS (mises a jour v2.0)

### R1 -- Aucune emoji nulle part (inchange)

### R2 -- Multilinguisme (etendu v2.0)

Toute chaine destinee a l'utilisateur passe par i18n. Pour les apps clientes, les 3 locales sont traitees en parite : aucune locale "premium" ou "secondaire". Le RTL est applique automatiquement pour `ar` et `ar-MA`.

### R3 -- Erreurs structurees (inchange)

### R4 -- Pas de business logic dans les controllers (inchange)

### R5 -- Tests obligatoires (inchange, etendu v2.0)

Pour les composants PWA, ajouter tests E2E :
- Installation PWA (manifest + service worker)
- Mode offline
- Capture camera (mock getUserMedia)
- Permission geolocation (mock)

### R6 -- Documentation Swagger automatique (inchange)

### R7 NOUVEAU v2.0 -- Cross-tenant authorizations strictes

Toute creation d'autorisation cross-tenant DOIT :
- Specifier `authorization_type` parmi : `client_to_garage`, `broker_readonly_garage`, `admin_temporary_access`
- Avoir un scope JSONB explicite avec `actions`, `resources`, `relatedEntityId`
- Avoir un `expiresAt` ou justifier par metadata pourquoi pas
- Etre auditee dans `cross_tenant_audit` a chaque acces

### R8 NOUVEAU v2.0 -- Endpoints publics avec rate limiting strict

Tout endpoint sous `/api/v1/public/*` DOIT :
- Decorateur `@Public()`
- Decorateur `@Throttle(...)` avec limite max 30/min/IP
- Validation Zod sur body
- Logger Pino avec champs traceables (session_token, ip_address)
- Aucune ecriture en DB persistante avant consent explicite

---


# PATTERNS NOUVEAUX v2.2

## Pattern 18 -- MCP Server Tool Definition (Sprint 30)

Pour exposer un tool metier a Skalean AI via MCP server (port 4001), definir tool avec metadata + JSON Schema input/output + permissions.

```typescript
// repo/apps/mcp-server/src/tools/get-policy-by-number.tool.ts
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

export const getPolicyByNumberTool: Tool = {
  name: 'get_policy_by_number',
  description: 'Retrieve insurance policy details by policy number',
  inputSchema: {
    type: 'object',
    properties: {
      policy_number: { type: 'string', pattern: '^P-\\d{4}-\\d{5}$' },
    },
    required: ['policy_number'],
  },
  // Capabilities required (Sprint 25 integration)
  required_capabilities: ['insure.policies.read'],
  // ABAC : if assure-context, only own policies
  abac_filter: 'assure_owns_policy',
};

// Tool execution handler with TenantContext propagation
export async function executeGetPolicyByNumber(
  args: { policy_number: string },
  ctx: McpToolContext,
): Promise<PolicyDto> {
  // 1. Verify capabilities
  if (!ctx.hasCapability('insure.policies.read')) {
    throw new McpToolError('CAPABILITY_NOT_AUTHORIZED', { 
      tenant_subtype: ctx.tenantSubtype,
      required: 'insure.policies.read',
    });
  }
  
  // 2. Lookup policy (RLS automatic via TenantContext set in middleware)
  const policy = await ctx.policiesService.findByNumber(args.policy_number);
  
  // 3. ABAC : if user_role=assure, verify ownership
  if (ctx.userRole === 'assure' && policy.owner_id !== ctx.userId) {
    throw new McpToolError('NOT_OWNER', { policy_number: args.policy_number });
  }
  
  // 4. Audit log MCP
  await ctx.auditLog.write({
    via_mcp: true,
    mcp_client_id: ctx.clientId,
    tool_name: 'get_policy_by_number',
    tool_input: args,
    capabilities_check_passed: true,
  });
  
  return policy;
}
```

**Notes** :
- Tools registry centralise : `repo/apps/mcp-server/src/tools/registry.ts` enregistre tous tools (15+ Sprint 30)
- Discovery endpoint `GET /mcp/v1/discover` retourne `tools` array avec inputSchema
- Streaming responses MCP : retourner `AsyncIterable<ToolResult>` pour gros payloads
- Idempotency-Key obligatoire pour write tools (Redis dedup 1h)

---

## Pattern 19 -- Sky Agent System Prompt + MCP Client (Sprint 31)

Pour creer un agent Sky multilingue qui consume tools MCP, definir system prompt par app + appel MCP avec agent loop.

```typescript
// repo/packages/sky/src/services/sky-agent.service.ts
@Injectable()
export class SkyAgentService {
  constructor(
    private mcpClient: McpClient,
    private skaleanAi: SkaleanAiClient,
    private logger: Logger,
  ) {}

  async chat(input: SkyChatInput): Promise<SkyChatStreamResult> {
    const { app_context, locale, conversation_id, user_message } = input;
    
    // 1. Load system prompt for app + locale
    const systemPrompt = await this.loadPrompt(app_context, locale);
    // Ex : 'web-broker-fr.md', 'web-customer-portal-ar-MA.md'
    
    // 2. Load conversation history
    const history = await this.conversationsService.getMessages(conversation_id);
    
    // 3. Get available tools from MCP discovery (filtered by user role)
    const tools = await this.mcpClient.discoverTools({
      filter: { app_context, user_role: input.userRole },
    });
    
    // 4. Agent loop : LLM -> tool calls -> tool results -> LLM
    let iterations = 0;
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: user_message },
    ];
    
    while (iterations < MAX_ITERATIONS) {
      const response = await this.skaleanAi.chat({
        model: 'skalean-conversational-v1',
        messages,
        tools, // Sky AI calls tools when needed
        stream: true,
      });
      
      if (!response.tool_calls || response.tool_calls.length === 0) {
        // Final response (no more tool calls)
        return this.streamResponse(response);
      }
      
      // Execute tool calls
      for (const toolCall of response.tool_calls) {
        const toolResult = await this.mcpClient.callTool({
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
          mcp_token: input.mcp_token, // user-context token
        });
        
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: JSON.stringify(toolResult),
        });
      }
      
      iterations++;
    }
    
    throw new SkyAgentError('MAX_ITERATIONS_EXCEEDED');
  }
  
  private async loadPrompt(app: string, locale: string): Promise<string> {
    // Dynamic load : prompts/{app}-{locale}.md
    return await fs.readFile(`prompts/${app}-${locale}.md`, 'utf8');
  }
}
```

**Notes** :
- 16 prompts (4 apps x 4 locales) -- voir Sprint 31 Tache 7.3.4
- Tools whitelist per app : `web-broker` peut appeler tools insure_*, `web-customer-portal` limite (tools publics + own_resources)
- Streaming responses : Vercel AI SDK `@ai-sdk/react` consume streams
- Confirmation modals avant write tools : `book_appointment`, `create_quote_draft`, `send_communication`

---

## Pattern 20 -- AI-Defere Swap (Mock -> Real -- decision-007)

Pour permettre swap one-line config Mock vs Real client AI (Sprint 20 -> Sprint 29).

```typescript
// repo/packages/repair/src/ia-estimation/ia-estimation.module.ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IaEstimationPhotosClient } from './interfaces/ia-estimation-client.interface';
import { MockIaEstimationClient } from './mock-ia-estimation-client';      // Sprint 20
import { SkaleanAiVisionClient } from './skalean-ai-vision-client';        // Sprint 29

@Module({
  providers: [
    {
      provide: IaEstimationPhotosClient,
      useFactory: (config: ConfigService) => {
        const provider = config.get('IA_ESTIMATION_PROVIDER'); // 'mock' | 'skalean_ai'
        
        switch (provider) {
          case 'mock':
            return new MockIaEstimationClient();
          
          case 'skalean_ai':
            return new SkaleanAiVisionClient(
              config.get('SKALEAN_AI_BASE_URL'),
              config.get('SKALEAN_AI_API_KEY'),
              { 
                circuitBreaker: { 
                  timeout: 30000, 
                  errorThreshold: 50,
                  fallback: () => new MockIaEstimationClient(), // fallback if real fails
                },
              },
            );
          
          case 'mixed':
            // Sprint 29 gradual rollout : 10% real / 90% mock
            return new MixedIaEstimationClient({
              real: new SkaleanAiVisionClient(...),
              mock: new MockIaEstimationClient(),
              realPercentage: config.get('IA_ESTIMATION_REAL_PERCENTAGE'), // 0-100
            });
          
          default:
            throw new Error(`Unknown IA_ESTIMATION_PROVIDER: ${provider}`);
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [IaEstimationPhotosClient],
})
export class IaEstimationModule {}
```

**Notes** :
- Interface contract `IaEstimationPhotosClient` strictement respectee par Mock + Real
- Sprint 29 : activation gradual `IA_ESTIMATION_REAL_PERCENTAGE=10 -> 50 -> 100`
- Rollback procedure < 60s : env var change `mock` -> redeploy
- Memes contracts pour autres AI : `SkyAgentService`, `DocumentGenerationService`, etc.

---

## Pattern 21 -- Circuit Breaker pour APIs Externes (Sprint 25 + 29 + 32)

Pour proteger l'app contre defaillances API externes (Skalean AI / connecteurs assureurs / Type 3 partner garages).

```typescript
// repo/packages/insure/src/connectors/wafa-assurance-connector.service.ts
import CircuitBreaker from 'opossum';

@Injectable()
export class WafaAssuranceConnectorService {
  private circuitBreaker: CircuitBreaker;
  
  constructor(
    private config: WafaConfig,
    private oauth2: WafaOAuth2Service,
    private logger: Logger,
  ) {
    this.circuitBreaker = new CircuitBreaker(this._fetchQuote.bind(this), {
      timeout: 15000,                    // 15s max per call
      errorThresholdPercentage: 50,      // open if >50% errors
      resetTimeout: 60000,               // try again after 60s
      rollingCountTimeout: 60000,        // window 60s for stats
      rollingCountBuckets: 10,           // 10 buckets of 6s
      name: 'wafa-fetch-quote',
      fallback: this._fetchQuoteFallback.bind(this),
    });
    
    // Listeners for monitoring
    this.circuitBreaker.on('open', () => this.logger.warn('Wafa circuit opened'));
    this.circuitBreaker.on('halfOpen', () => this.logger.info('Wafa circuit half-open'));
    this.circuitBreaker.on('close', () => this.logger.info('Wafa circuit closed'));
    this.circuitBreaker.on('fallback', (data) => this.logger.warn('Wafa fallback used', data));
  }
  
  async fetchQuote(payload: QuoteRequest): Promise<QuoteResponse> {
    return this.circuitBreaker.fire(payload);
  }
  
  private async _fetchQuote(payload: QuoteRequest): Promise<QuoteResponse> {
    const token = await this.oauth2.getAccessToken();
    const response = await fetch(`${this.config.baseUrl}/quotes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    
    if (!response.ok) {
      throw new ConnectorError('WAFA_API_ERROR', { status: response.status });
    }
    
    return await response.json();
  }
  
  private async _fetchQuoteFallback(payload: QuoteRequest): Promise<QuoteResponse> {
    // Fallback : utiliser lookup tables Sprint 14 (decision-010)
    this.logger.warn('Wafa unavailable, using lookup tables fallback');
    return await this.lookupTablesService.computeQuote(payload);
  }
}
```

**Notes** :
- Pattern utilise par : connecteurs assureurs (Sprint 32), Skalean AI (Sprint 29), Type 3 partners (Sprint 25)
- `fallback` permet degradation gracieuse (lookup tables vs real API, Mock vs Real AI)
- Stats accessibles via `this.circuitBreaker.stats` -- expose via `/health/connectors` (Sprint 34)
- Configuration adaptee per provider (Wafa moderne 15s, AXA legacy 30s)

---

# REGLES TRANSVERSALES SUPPLEMENTAIRES v2.2

### R9 NOUVEAU v2.2 -- Tools MCP : Idempotency-Key obligatoire write tools

Tout tool MCP `type: 'write'` (book_appointment, create_quote_draft, send_communication, etc.) DOIT :
- Header `Idempotency-Key` mandatory (UUID v4)
- Redis dedup 1h via `mcp:idempotency:{client_id}:{idempotency_key}`
- Confirmation modal frontend avant invocation (Sprint 31 Tache 7.3.9)
- Audit log MCP enrichi (`tool_input` + `tool_output` + `idempotency_key`)

### R10 NOUVEAU v2.2 -- Sky agent : confirmation modals write tools

Sky widget UI DOIT afficher modal confirmation user avant invoking write tool :
- Title : action descriptive ("Confirmer la prise de rendez-vous ?")
- Body : preview parameters extraits du tool_call
- Buttons : "Confirmer" + "Annuler"
- Si annule : Sky retourne message "Action annulee, dis-moi si tu veux autre chose"

### R11 NOUVEAU v2.2 -- AI-defere : interface contract strict

Tout interface AI client (`IaEstimationPhotosClient`, `DocumentGenerationClient`, etc.) :
- Doit avoir version Mock ET version Real (decision-007)
- Mock retourne data realistic deterministic (pas random pur)
- Real wrapped circuit breaker avec fallback Mock OR lookup tables
- Tests integration : Mock + Real coverage tous use cases

### R12 NOUVEAU v2.2 -- Cloud souverain Atlas Cloud Services

Production hosting toutes ressources :
- DB PostgreSQL : Atlas Cloud Services Database RDBMS Benguerir
- Object Storage : Atlas Cloud Services Object Storage Benguerir
- Compute : Atlas Cloud Services VM/Containers
- KMS : Atlas Cloud Services Key Management
- Monitoring : Atlas Cloud Services Monitoring + Datadog/Grafana Cloud APM

Voir decision-008 pour rationale complet.

---

**Fin du document `4-templates-generation.md` v2.2.**

**Patterns 1-12 inchanges (v1.0). Patterns 13-17 v2.0. Patterns 18-21 nouveaux v2.2 (MCP / Sky / AI-defere / Circuit breaker).**
