# META-PROMPT PHASE B SPRINT 20b v3.0 -- Sky AI Pre-Training (Diagnostic + Decision Engine)
# Phase B = taches detaillees pour Cowork avec patterns code + pipelines ML + datasets
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (NOUVEAU sprint v3.0 -- pre-requis Sprints 21 + 24)
**Phase** : 5 -- Vertical Repair (intercalaire entre Sprint 20 IA Estimation et Sprint 21 Sinistre Workflow)
**Sprint** : 20b / 40 (cumul v3.0) -- aka "Sprint 20.5" dans references C-21/C-24
**Reference orchestrateur** : `C-20b-sprint-20b-sky-ai-pretraining.md`
**Reference verification** : `V-20b-sprint-20b-verification.md`
**Numerotation taches** : 5.2.1 a 5.2.12
**Effort total** : ~85 heures developpement / 2.5 semaines (incluant entrainement modeles)
**Apport metier** : Sky AI Diagnostic + Decision Engine pre-trained sur dataset garage Saad (1500+ sinistres) -- asset unique Maroc

---

## POSITION DANS LA PHASE

Sprint 20b (5.2bis) intercalaire entre Sprint 20 (IA Estimation generique) et Sprint 21 (Sinistre Workflow). Pre-requis dur pour :
- Sprint 21 Tache 5.3.2 : Diagnostic Sky AI (vs IA generique v2.2)
- Sprint 24 Tache 5.6.2 : Carrier FNOL Review + Sky AI Decision Engine routing
- Sprint 24 Tache 5.6.7 : Garage reception + Sky AI diagnostic

---

## DEPENDANCES

**Entrees consommees** :
- Sprint 20 (IA Estimation Photos) -- pipeline computer vision generique
- Dataset garage Saad : 1500+ sinistres reels archives (asset unique decision-business strategique)
- Decision-008 (data residency Maroc) : Atlas Cloud Services Benguerir + Anthropic Claude/OpenAI API ne sortent PAS du Maroc -> on heberge modeles ML on-premise ou Atlas Cloud
- Sprint 14 (Insure Foundation) -- types policies pour Decision Engine context

**Sorties produites** (consumed downstream) :
- **Sky AI Diagnostic Model** : computer vision pre-trained sur photos sinistres Maroc -> consumed Sprint 21 Tache 5.3.2 + Sprint 24 Tache 5.6.7
- **Sky AI Decision Engine** : routing carrier (tow_needed + expert_priority + suggested_garage_ids + estimated_severity + fraud_risk) -> consumed Sprint 24 Tache 5.6.2
- **Sky AI Confidence Scoring** : confidence_score % visible dans rapports -> consumed Sprint 21 + Sprint 24
- Package `@insurtech/sky` (NOUVEAU) exposant 2 services + SDK client
- Dataset training cleaned + anonymise (asset reutilisable)

---

## DECISIONS STRATEGIQUES APPLICABLES

- **decision-008-data-residency-maroc** : modeles ML hebergés Atlas Cloud Services Benguerir + Anthropic Claude API (call API valide -- pas de fine-tuning) OU OpenAI Azure Maroc region si disponible
- **decision-011-assurflow-rebrand** : naming Sky AI (vs Skalean AI generique) -- specialise Vertical Insurtech
- **decision-013-expert-acteur-central** : Sky AI Decision Engine **recommande**, expert humain **valide** (jamais Sky AI ne signe seul)
- **decision-006-no-emoji** : 0 emoji absolu
- **Asset garage Saad** : 1500+ sinistres reels Casablanca + Mohammedia (depuis 2020) = **avantage competitif majeur** vs concurrents qui n'ont pas de data Maroc

---

## REGLES ABSOLUES skalean-insurtech v3.0

(Identique B-14/B-21/B-24 + specificites ML)

**Specifique Sprint 20b v3.0** :
- **Python 3.11+** pour pipelines ML (extraction + preprocessing + training)
- **TypeScript** pour service NestJS exposant Sky AI via REST + MCP
- **TensorFlow 2.15+** ou **PyTorch 2.2+** pour computer vision (selon choix Tache 5.2.4)
- **Hugging Face Transformers** pour LLM fine-tuning (Decision Engine)
- **MLflow** pour experiment tracking + model registry
- **Anonymisation customer PII** OBLIGATOIRE : avant entrainement, supprimer (nom + CIN + phone + email + plaque immatriculation + adresse exacte) -- conformite CNDP loi 09-08
- **Data Maroc only** : aucune donnee training ne sort de Atlas Cloud Services Benguerir
- **Confidence threshold** : Sky AI > 90% confiance = recommandation displayed / 70-90% = recommandation avec warning / < 70% = pas de recommandation, escalation humain
- **Audit ACAPS** : chaque inference Sky AI logge dans `compliance_acaps_audits` (10 ans retention) avec input + output + confidence_score

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

---

### Tache 5.2.1 : Setup environnement ML + Atlas Cloud Services GPU

**Metadonnees** : P0 | 6h | Depend de : Sprint 20

**But** : Provision GPU instances Atlas Cloud Services Benguerir + setup environnement Python ML + MLflow tracking server.

**Actions principales** :
- Provision 2 GPU instances Atlas Cloud Services :
  - Training : NVIDIA A100 80GB (1 instance, ~24h training jobs)
  - Inference : NVIDIA T4 16GB (2 instances load-balanced, production serving)
- Configuration MLflow tracking server URL `https://mlflow.assurflow.ma`
- Dockerfile + docker-compose pour environnement Python ML reproductible :
  ```dockerfile
  FROM nvidia/cuda:12.2-cudnn8-runtime-ubuntu22.04
  RUN apt-get update && apt-get install -y python3.11 python3-pip
  RUN pip install torch==2.2.0 torchvision==0.17.0 transformers==4.38.0 \
                  mlflow==2.10.0 pandas==2.2.0 scikit-learn==1.4.0 \
                  pillow==10.2.0 opencv-python==4.9.0 \
                  pydantic==2.6.0 fastapi==0.110.0
  ```
- Setup MLflow experiments :
  - `sky-ai-diagnostic-cv` (computer vision photos sinistres)
  - `sky-ai-decision-engine-llm` (LLM routing recommendations)

**Fichiers cibles principaux** :
- `repo/infrastructure/ml/Dockerfile.training`
- `repo/infrastructure/ml/Dockerfile.inference`
- `repo/infrastructure/ml/docker-compose.ml.yml`
- `repo/infrastructure/scripts/provision-atlas-gpu.sh`

**Criteres P0** :
- V1 : GPU instances provisionnees + accessibles
- V2 : MLflow tracking server accessible
- V3 : Dockerfile build sans erreur
- V4 : Test GPU disponible (`nvidia-smi` dans container)

**Commit** :
```bash
git commit -m "feat(sprint-20b): setup environnement ml + atlas cloud gpu

Task: 5.2.1
Sprint: 20b (Phase 5 / Sprint 2bis)
Phase: 5 -- Vertical Repair
Decisions: decision-008 data residency maroc"
```

---

### Tache 5.2.2 : ETL extraction donnees garage Saad (1500+ sinistres)

**Metadonnees** : P0 | 8h | Depend de : 5.2.1

**But** : Pipeline ETL extraction donnees historiques garage Saad depuis archives (Excel + photos + PDF rapports + factures) -> dataset structured JSON/Parquet.

**Actions principales** :
- Script Python `repo/data-pipelines/etl/extract-garage-saad-historical.py` (~400 lignes) :
  - Source 1 : Excel archives 2020-2025 (1500+ rows sinistres)
  - Source 2 : Dossier photos `/data/garage-saad/photos/{sinistre_id}/*.jpg` (~12000 photos)
  - Source 3 : Dossier rapports PDF `/data/garage-saad/rapports/{sinistre_id}.pdf` (1500 rapports)
  - Source 4 : Dossier factures PDF `/data/garage-saad/factures/{sinistre_id}.pdf`
- Schema dataset target (Parquet partitionne par annee) :
  ```python
  schema = {
    'sinistre_id': 'string',                    # ANONYMISE (UUID, pas reel)
    'date_sinistre': 'datetime',
    'vehicule_marque': 'string',                # Renault, Peugeot, Dacia, etc.
    'vehicule_modele': 'string',                # Clio, 208, Logan, etc.
    'vehicule_annee': 'int',
    'vehicule_carburant': 'string',             # essence, diesel, hybrid
    'type_sinistre': 'string',                  # collision, fire, theft, weather
    'zone_geographique': 'string',              # Casablanca-Mohammedia, Rabat, etc. (zone seulement, pas adresse exacte)
    'description_sinistre_anonymized': 'string',
    'photos_paths': 'list<string>',             # S3 paths anonymizes
    'photos_count': 'int',
    'diagnostic_garage': 'string',              # text libre garage
    'pieces_a_remplacer': 'list<dict>',         # [{piece, qty, price_unit}]
    'main_oeuvre_hours': 'float',
    'devis_total_mad': 'float',
    'reparation_realisee': 'bool',
    'duree_reparation_jours': 'int',
    'cout_final_mad': 'float',
    'verdict_severity': 'string',               # minor, major, total_loss
    'satisfaction_customer': 'int',             # 1-5
    'fraud_detected': 'bool'                    # 0/1
  }
  ```
- Anonymisation OBLIGATOIRE (script `anonymize.py`) :
  - Replace customer name -> `customer_{hash}`
  - Replace CIN -> NULL
  - Replace phone -> NULL
  - Replace email -> NULL
  - Replace plaque immatriculation -> `XXX-XX-XX`
  - Replace adresse exacte -> garde zone (Casablanca / Mohammedia) seulement
  - Replace dates exactes -> garde mois + annee seulement
- Output Parquet partitionne `s3://atlas-cloud/sky-ai/datasets/garage-saad/year={YYYY}/`

**Criteres P0** :
- V1 : >= 1500 sinistres extraits
- V2 : Anonymisation 100% complete (CIN/phone/email/plaque = 0 occurrence)
- V3 : Photos copies S3 avec paths anonymizes
- V4 : Schema valide (Parquet)

**Commit** :
```bash
git commit -m "feat(sprint-20b): etl extraction donnees garage saad + anonymisation

Task: 5.2.2
Sprint: 20b (Phase 5 / Sprint 2bis)
Decisions: decision-008 + loi 09-08 cndp"
```

---

### Tache 5.2.3 : Feature engineering + train/val/test split

**Metadonnees** : P0 | 6h | Depend de : 5.2.2

**But** : Feature engineering (encoders + transformations) + split train (70%) / validation (15%) / test (15%) stratifie par severity + type sinistre.

**Actions principales** :
- Script `repo/data-pipelines/features/feature-engineering.py` (~350 lignes) :
  - Encoders categoriels : marque (One-Hot) + modele (target encoding) + type_sinistre (One-Hot) + zone (One-Hot)
  - Transformations numeriques : vehicule_annee -> age + devis_total -> log_transform
  - Features derivees : photos_count + description_length + nb_pieces_replace + ratio_main_oeuvre
  - Embedding text descriptions (sentence-transformers `paraphrase-multilingual-mpnet-base-v2` -- support darija)
- Split stratifie 70/15/15 sur `verdict_severity` + `type_sinistre` (preserver distribution)
- Output : 3 datasets Parquet (`train.parquet`, `val.parquet`, `test.parquet`)
- Metadata JSON : feature schema + stats descriptives + class balance

**Criteres P0** :
- V1 : Train >= 1050 rows, Val >= 225, Test >= 225
- V2 : Distribution severity preservee dans splits
- V3 : Embeddings text generes correctement
- V4 : 0 valeur manquante (post-imputation)

**Commit** :
```bash
git commit -m "feat(sprint-20b): feature engineering + train/val/test split stratifie

Task: 5.2.3
Sprint: 20b (Phase 5 / Sprint 2bis)"
```

---

### Tache 5.2.4 : Modele Sky AI Diagnostic (Computer Vision)

**Metadonnees** : P0 | 12h | Depend de : 5.2.3

**But** : Fine-tuning modele computer vision pour diagnostic photos sinistres : detection zones endommagees + estimation severity + suggestion pieces a remplacer.

**Actions principales** :
- Architecture : **EfficientNet-B4** pre-trained ImageNet -> fine-tuning sur photos garage Saad
- Multi-task learning (3 heads) :
  - Head 1 : Severity classification (minor / major / total_loss)
  - Head 2 : Damage zones detection (12 zones : avant-gauche / avant-centre / avant-droit / arriere-gauche / etc.)
  - Head 3 : Parts replacement prediction (50 pieces les plus communes -- multi-label)
- Training config :
  - Epochs : 50 (avec early stopping patience=5)
  - Batch size : 32
  - Optimizer : AdamW + LR 1e-4 + cosine annealing scheduler
  - Loss : cross_entropy (severity) + binary_cross_entropy (zones + parts)
  - Augmentation : flip + rotation + brightness + contrast (Albumentations)
- Cibles performance :
  - Severity accuracy >= 85% (vs baseline random 33% = +52pp)
  - Zones IoU >= 0.70
  - Parts recall@10 >= 75% (les 10 pieces les plus probables incluent >= 75% des vraies pieces)
- Tracking MLflow : metriques + hyperparams + model artifact
- Export ONNX pour serving production (T4 GPU)

**Fichiers cibles** :
- `repo/data-pipelines/training/train-sky-ai-diagnostic.py` (~500 lignes)
- `repo/data-pipelines/training/models/sky_ai_diagnostic.py` (architecture)
- `s3://atlas-cloud/sky-ai/models/diagnostic/v1/model.onnx`

**Criteres P0** :
- V1 : Training termine sans crash
- V2 : Severity accuracy test >= 85%
- V3 : Modele ONNX export OK
- V4 : MLflow tracking complet

**Commit** :
```bash
git commit -m "feat(sprint-20b): modele sky ai diagnostic computer vision finetuning

Task: 5.2.4
Sprint: 20b (Phase 5 / Sprint 2bis)
Decisions: decision-011 sky ai vertical assurflow"
```

---

### Tache 5.2.5 : Modele Sky AI Decision Engine (LLM Fine-Tuning)

**Metadonnees** : P0 | 14h | Depend de : 5.2.4

**But** : Fine-tuning LLM pour Decision Engine : input contexte sinistre + customer history + carrier policies -> output routing recommandations (tow_needed + expert_priority + suggested_garage_ids + estimated_severity + fraud_risk_score).

**Actions principales** :
- Base model : **Mistral 7B Instruct v0.2** (open source, supporte francais + arabe)
- Fine-tuning approach : **LoRA** (Low-Rank Adaptation) + PEFT
  - r=16, alpha=32, dropout=0.05
  - Target modules : `q_proj`, `k_proj`, `v_proj`, `o_proj`
- Training data : 1500 sinistres garage Saad -> formatted as instruction tuning JSONL :
  ```jsonl
  {"instruction": "Analyse ce sinistre et recommande routing", "input": "Sinistre: collision Casablanca. Vehicule: Renault Clio 2021. Photos: 5 photos avant. Description customer: 'collision en stationnement avec vehicule en marche arriere'. Customer history: 0 sinistre. Policy: tous-risques.", "output": "{\"tow_needed\": false, \"expert_priority\": \"standard\", \"suggested_garage_ids\": [\"garage_1\", \"garage_2\"], \"estimated_severity\": \"minor\", \"fraud_risk_score\": 0.05, \"reasoning\": \"Vehicule roulant, degats apparents legers, customer first-claim, no fraud red flags\"}"}
  ```
- Generation training data : utiliser GPT-4 pour generer 5000 synthetic samples basees sur 1500 reels (data augmentation)
- Training config :
  - Epochs : 3
  - Batch size : 4 (gradient accumulation 4 -> effective 16)
  - LR : 2e-4
  - Quantization : 4-bit (qLoRA)
- Cibles :
  - Routing accuracy >= 88%
  - Fraud detection F1 >= 0.75
- Inference latency target : < 500ms (P50)
- Export GGUF format pour serving via vLLM ou Ollama

**Fichiers cibles** :
- `repo/data-pipelines/training/train-sky-ai-decision-engine.py` (~600 lignes)
- `repo/data-pipelines/training/generate-synthetic-routing-data.py` (~250 lignes)
- `s3://atlas-cloud/sky-ai/models/decision-engine/v1/model.gguf`

**Criteres P0** :
- V1 : Training termine + 3 epochs completes
- V2 : Routing accuracy validation >= 88%
- V3 : Fraud detection F1 >= 0.75
- V4 : Inference latency < 500ms

**Commit** :
```bash
git commit -m "feat(sprint-20b): modele sky ai decision engine llm finetuning lora

Task: 5.2.5
Sprint: 20b (Phase 5 / Sprint 2bis)
Decisions: decision-011 + decision-008"
```

---

### Tache 5.2.6 : Package @insurtech/sky NestJS service

**Metadonnees** : P0 | 8h | Depend de : 5.2.5

**But** : Package NestJS exposant Sky AI via API REST + types TypeScript + client SDK.

**Actions principales** :

Structure package `repo/packages/sky/` :
```
packages/sky/
  package.json
  src/
    index.ts
    types/
      sky-ai-diagnostic.types.ts
      sky-ai-decision-engine.types.ts
    schemas/
      diagnostic.schema.ts
      decision-engine.schema.ts
    services/
      sky-ai-diagnostic.service.ts        # Computer vision
      sky-ai-decision-engine.service.ts   # LLM routing
      sky-ai-confidence-scoring.service.ts
    clients/
      onnx-runtime.client.ts              # ONNX inference Diagnostic
      vllm.client.ts                       # vLLM inference Decision Engine
```

**Pattern code `sky-ai-diagnostic.service.ts`** :
```typescript
@Injectable()
export class SkyAiDiagnosticService {
  constructor(
    @Inject('ONNX_RUNTIME') private readonly onnxRuntime: OnnxRuntimeClient,
    private readonly logger: PinoLogger,
    private readonly acapsAudit: AcapsAuditService
  ) {
    this.logger.setContext(SkyAiDiagnosticService.name);
  }

  async analyzeDamage(input: {
    sinistreId: string;
    photosUrls: string[];
    vehicleMake: string;
    vehicleModel: string;
    vehicleYear: number;
  }): Promise<{
    severity: 'minor' | 'major' | 'total_loss';
    damageZones: Array<{ zone: string; confidence: number }>;
    partsToReplace: Array<{ part: string; confidence: number }>;
    overallConfidence: number;
  }> {
    this.logger.info({ action: 'analyzeDamage', sinistreId: input.sinistreId });

    // 1. Download photos
    const photos = await Promise.all(input.photosUrls.map(url => this.downloadPhoto(url)));

    // 2. Preprocess (resize 384x384 + normalize)
    const preprocessed = photos.map(p => this.preprocessPhoto(p));

    // 3. ONNX inference
    const predictions = await this.onnxRuntime.predict('sky_ai_diagnostic', preprocessed);

    // 4. Post-process + confidence scoring
    const result = this.postProcessPredictions(predictions);

    // 5. Audit ACAPS log
    await this.acapsAudit.logSkyAiInference({
      service: 'sky_ai_diagnostic',
      sinistreId: input.sinistreId,
      input: { vehicleMake: input.vehicleMake, vehicleModel: input.vehicleModel, photosCount: photos.length },
      output: result,
      confidence: result.overallConfidence
    });

    return result;
  }
}
```

**Pattern code `sky-ai-decision-engine.service.ts`** :
```typescript
@Injectable()
export class SkyAiDecisionEngineService {
  async recommendRouting(input: {
    sinistreId: string;
    description: string;
    vehicleInfo: VehicleInfo;
    customerHistory: CustomerHistory;
    policyDetails: PolicyDetails;
    photosUrls: string[];
  }): Promise<{
    towNeeded: boolean;
    expertPriority: 'urgent' | 'standard' | 'low';
    suggestedGarageIds: string[];
    suggestedExpertIds: string[];
    estimatedSeverity: 'minor' | 'major' | 'total_loss';
    fraudRiskScore: number;
    reasoning: string;
    confidence: number;
  }> {
    // 1. Build prompt context
    const prompt = this.buildRoutingPrompt(input);

    // 2. vLLM inference (Mistral 7B fine-tuned)
    const llmResponse = await this.vllmClient.generate({
      model: 'sky-ai-decision-engine-v1',
      prompt,
      max_tokens: 512,
      temperature: 0.1
    });

    // 3. Parse JSON output + validate Zod schema
    const parsed = RoutingRecommendationSchema.parse(JSON.parse(llmResponse.text));

    // 4. Confidence scoring (basé sur logprobs LLM)
    const confidence = this.computeConfidence(llmResponse.logprobs);

    // 5. Audit ACAPS log
    await this.acapsAudit.logSkyAiInference({
      service: 'sky_ai_decision_engine',
      sinistreId: input.sinistreId,
      input: { description: input.description, customerHistory: input.customerHistory },
      output: parsed,
      confidence
    });

    return { ...parsed, confidence };
  }
}
```

**Endpoints REST** `repo/apps/api/src/modules/sky/sky.controller.ts` :
- `POST /api/v1/sky/diagnostic/analyze` (input photos + vehicle -> output severity + zones + parts)
- `POST /api/v1/sky/decision-engine/recommend` (input sinistre context -> output routing)
- `GET /api/v1/sky/health` (health check + models loaded)
- `GET /api/v1/sky/metrics` (inference latency + throughput)

**Commit** :
```bash
git commit -m "feat(sprint-20b): package @insurtech/sky nestjs service + endpoints rest

Task: 5.2.6
Sprint: 20b (Phase 5 / Sprint 2bis)
Decisions: decision-011 sky ai naming"
```

---

### Tache 5.2.7 : Confidence scoring + threshold rules

**Metadonnees** : P0 | 4h | Depend de : 5.2.6

**But** : Service confidence scoring centralisé + regles thresholds (> 90% display / 70-90% warning / < 70% pas de recommendation, escalation humain).

**Actions principales** :
- Service `sky-ai-confidence-scoring.service.ts` :
  - `evaluateConfidence(skyAiOutput)` -> `{ tier: 'high'/'medium'/'low', recommendation_action: 'display'/'warn'/'escalate' }`
  - `getDisplayMessage(tier, language)` -> message i18n (fr/ar/darija) explication user
- Configuration thresholds par carrier (override default 90/70) -> table `sky_ai_thresholds_config`
- Tests 8+

**Commit** :
```bash
git commit -m "feat(sprint-20b): confidence scoring + threshold rules + escalation humain

Task: 5.2.7"
```

---

### Tache 5.2.8 : MCP tools Sky AI (Cowork integration)

**Metadonnees** : P0 | 6h | Depend de : 5.2.7

**But** : Exposer Sky AI Diagnostic + Decision Engine comme MCP tools pour integration Cowork orchestrator.

**Actions principales** :
- MCP tools registration dans `repo/packages/sky/src/mcp/sky-mcp-server.ts` :
  - Tool 1 : `sky_ai_diagnostic_analyze` (input schema + output schema)
  - Tool 2 : `sky_ai_decision_engine_recommend` (input schema + output schema)
  - Tool 3 : `sky_ai_explain_decision` (input decision_id -> output reasoning detaillee)
- SDK client `@insurtech/sky-client` pour autres packages (Sprint 21 / Sprint 24)
- Documentation `repo/docs/sky-ai-mcp-integration.md`

**Commit** :
```bash
git commit -m "feat(sprint-20b): mcp tools sky ai integration cowork

Task: 5.2.8"
```

---

### Tache 5.2.9 : Audit ACAPS pour inferences Sky AI

**Metadonnees** : P0 | 4h | Depend de : 5.2.8

**But** : Chaque inference Sky AI loggee dans `compliance_acaps_audits` (10 ans retention) pour audit ACAPS + traceability.

**Actions** :
- Migration ajout colonnes `compliance_acaps_audits.sky_ai_service` + `sky_ai_input_hash` + `sky_ai_output` + `sky_ai_confidence`
- Service `AcapsAuditService.logSkyAiInference()` centralise audit
- Audit obligatoire dans Diagnostic + Decision Engine services
- Tests 6+

**Commit** :
```bash
git commit -m "feat(sprint-20b): audit acaps pour inferences sky ai

Task: 5.2.9
Decisions: loi conformite acaps + 10 ans retention"
```

---

### Tache 5.2.10 : Model registry + versioning + rollback

**Metadonnees** : P0 | 4h | Depend de : 5.2.9

**But** : Model registry MLflow + versioning automatique + rollback procedure si performance degrade.

**Actions** :
- MLflow Model Registry stages : staging / production / archived
- CI/CD GitHub Actions : `repo/.github/workflows/sky-ai-model-deploy.yml`
  - Deploy staging on merge feature branch
  - Promote to production on tag release
  - Auto-rollback si production metrics dropdown > 5%
- Tests 4+

**Commit** :
```bash
git commit -m "feat(sprint-20b): model registry mlflow + versioning + rollback ci/cd

Task: 5.2.10"
```

---

### Tache 5.2.11 : Inference monitoring + drift detection

**Metadonnees** : P0 | 4h | Depend de : 5.2.10

**But** : Monitoring production + drift detection (data drift + concept drift) + alertes.

**Actions** :
- Prometheus metrics : `sky_ai_inference_latency_p50/p95/p99` + `sky_ai_confidence_distribution` + `sky_ai_inference_count`
- Grafana dashboard `sky-ai-production-monitoring.json`
- Drift detection : Evidently AI library -> jobs daily comparant prod data distribution vs training reference
- Alertes Slack `#sky-ai-alerts` si drift detected ou latency > 1s
- Tests 4+

**Commit** :
```bash
git commit -m "feat(sprint-20b): inference monitoring prometheus + grafana + drift detection

Task: 5.2.11"
```

---

### Tache 5.2.12 : Tests E2E Sky AI 25+ + benchmarks

**Metadonnees** : P0 | 9h | Depend de : 5.2.11

**But** : Tests E2E 25+ scenarios + benchmarks performance + fixtures dataset garage Saad pour tests reproductibles.

**Actions** :
- Tests E2E happy path : analyze damage + recommend routing + explain decision
- Tests confidence thresholds (high/medium/low tiers)
- Tests audit ACAPS log present
- Tests inference latency (< 500ms P50 / < 1s P95)
- Tests load 50 inferences parallel
- Benchmarks suite `repo/benchmarks/sky-ai/` :
  - `bench-diagnostic-latency.ts`
  - `bench-decision-engine-throughput.ts`
  - `bench-confidence-calibration.ts`
- Fixtures dataset garage Saad anonymized echantillon 50 sinistres pour tests reproductibles
- Coverage Sprint 20b >= 85%

**Commit** :
```bash
git commit -m "test(sprint-20b): tests e2e 25+ + benchmarks sky ai performance

Task: 5.2.12
Sprint: 20b (Phase 5 / Sprint 2bis)"
```

---

## SYNTHESE -- Cloture Sprint 20b

```bash
# 12 commits Sprint 20b
git log --since="3 weeks ago" --pretty=format:"%s" -- repo/ | grep "Task: 5.2" | wc -l
# Attendu : 12

# 0 emoji
grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/sky repo/data-pipelines --include="*.ts" --include="*.py" --include="*.md" | wc -l
# Attendu : 0

# Lancer V-20b
cat skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-20b-sprint-20b-verification.md

# Si V-20b GO (>= 95%)
git tag -a "sprint-20b-complete-v3-sky-ai-pretraining" -m "Sprint 20b v3.0 Sky AI Pre-Training complete

- Diagnostic computer vision (severity 85%+ accuracy)
- Decision Engine LLM routing (88%+ accuracy)
- Dataset 1500+ sinistres garage Saad pre-trained
- Package @insurtech/sky NestJS + MCP tools
- Audit ACAPS + monitoring production
- Score V-20b >= 95% -- GO"

git push origin sprint-20b-complete-v3-sky-ai-pretraining
```

---

## METRIQUES DE VALIDATION

| Metrique | Cible | Mesure |
|----------|-------|--------|
| 12 commits Sprint 20b | 12/12 | git log Task: 5.2.* |
| Sinistres extraits dataset | >= 1500 | wc -l garage-saad-historical.parquet |
| Anonymisation PII | 100% | grep -r "CIN\|phone\|email" datasets/ |
| Severity accuracy test | >= 85% | MLflow metrics |
| Routing accuracy validation | >= 88% | MLflow metrics |
| Inference latency P50 | < 500ms | Prometheus |
| Audit ACAPS log presence | 100% inferences | pg_query count |
| Coverage @insurtech/sky | >= 85% | Vitest coverage |
| Tests E2E | >= 25 | Vitest run |
| Drift detection alerts | Configures | Grafana dashboard |

---

## CONFORMITE InsurTech Maroc v3.0

- **decision-008 data residency** : GPU instances + modeles + datasets restent Atlas Cloud Services Benguerir (jamais hors Maroc)
- **Loi 09-08 CNDP** : anonymisation 100% PII avant entrainement (CIN/phone/email/plaque/adresse exacte)
- **Audit ACAPS** : chaque inference logged 10 ans retention
- **decision-011 naming** : Sky AI (specialise vertical insurtech, vs Skalean AI generique)
- **decision-013** : Sky AI **recommande**, expert humain **valide** -- jamais Sky AI ne decide finalement seul
- **Threshold humain** : si confidence < 70% -> escalation humain obligatoire

---

## RISQUES + MITIGATIONS

1. **Dataset 1500 sinistres trop petit pour computer vision** -> mitigation : augmentation (Albumentations) + transfer learning EfficientNet pre-trained + synthetic data generation
2. **Drift production (vehicules nouvelles annees)** -> mitigation : monitoring drift Evidently AI + re-training quarterly
3. **Latence inference > 500ms** -> mitigation : ONNX optimization + GPU T4 + batch inference
4. **Hallucinations LLM Decision Engine** -> mitigation : Zod schema validation strict + confidence threshold + fallback rules-based si confidence < 70%
5. **Fraud detection biais (faux positifs Casablanca vs Mohammedia)** -> mitigation : fairness audit + stratification training + monitoring

---

## NOTES IMPORTANTES POUR EXECUTION

1. **Sprint 20b NOUVEAU v3.0** : n'existait pas v2.2, intercalaire critique Sprints 21 + 24
2. **Asset garage Saad = avantage competitif Maroc** -- dataset unique 1500+ sinistres reels depuis 2020
3. **Atlas Cloud Services Benguerir** = hebergement obligatoire (decision-008)
4. **Sky AI naming** decision-011 (vs Skalean AI generique)
5. **Threshold humain** : > 70% confidence sinon escalation -- NE PAS forcer recommandation Sky AI faible
6. **Audit ACAPS** : compliance loi non-negociable sur chaque inference
7. **MLflow Model Registry** : versioning strict + rollback automatique
8. **Cowork integration MCP** Tache 5.2.8 = critique pour Sprint 21 + Sprint 24 calls
9. **NE JAMAIS modifier 00-pilotage/** -- uniquement repo/

---

**Fin meta-prompt B-20b v3.0 -- Sprint 20b (5.2bis) Sky AI Pre-Training (Diagnostic + Decision Engine).**

**Total taches** : 12 | **Effort** : ~85h | **Apport** : Asset Sky AI pre-trained sur 1500+ sinistres garage Saad (avantage competitif Maroc)
