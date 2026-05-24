# ORCHESTRATEUR SPRINT 20b v3.0 -- Phase 5 / Sprint 2bis : Sky AI Pre-Training
# 12 taches sequentielles + verification finale
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (NOUVEAU sprint v3.0 -- pre-requis Sprints 21 + 24)
**Phase** : 5 -- Vertical Repair
**Sprint** : 20b / 40 (cumul v3.0) -- aka "Sprint 20.5"
**Reference meta-prompt** : `B-20b-sprint-20b-sky-ai-pretraining.md`
**Reference verification** : `V-20b-sprint-20b-verification.md`
**Numerotation taches** : 5.2.1 a 5.2.12
**Effort total** : ~85 heures developpement / 2.5 semaines (incluant entrainement modeles)
**Apport metier** : Sky AI Diagnostic + Decision Engine pre-trained sur 1500+ sinistres garage Saad -- asset unique competitif Maroc

---

Tu es **Claude Code (ou Cowork)**. Execute **TOUTES les 12 taches** du Sprint 20b v3.0 **UNE PAR UNE** dans l'ordre defini, puis lance V-20b.

**Cet orchestrateur extrait le contenu detaille depuis B-20b v3.0** -- pour code Python ML complet + patterns NestJS + datasets schemas, lire B-20b reference dans chaque tache.

**STRATEGIE NOUVEAU v3.0** : Sprint 20b intercalaire entre Sprint 20 (IA generique) et Sprint 21 (Sinistre Workflow). Construit l'avantage competitif majeur : Sky AI pre-trained sur asset unique 1500+ sinistres reels Maroc.

---

## OBJECTIF DU SPRINT 20b v3.0

Sprint 20b (5.2bis) -- Sky AI Pre-Training. Voir B-20b v3.0 pour contexte detaille.

Construire 2 modeles ML pre-trained + package NestJS exposant Sky AI :
1. **Sky AI Diagnostic** (Computer Vision EfficientNet-B4) : analyse photos sinistres -> severity + zones + parts replacement
2. **Sky AI Decision Engine** (LLM Mistral 7B LoRA fine-tuned) : routing carrier recommendations (tow needed + expert priority + suggested garages + estimated severity + fraud risk)

Pre-training sur dataset garage Saad (1500+ sinistres reels Casablanca + Mohammedia depuis 2020) **anonymise** conformite loi 09-08 CNDP.

---

## STRUCTURE DES FICHIERS

```
skalean-insurtech/00-pilotage/prompts-taches/sprint-20b-sky-ai-pretraining/
  task-5.2.1-prompt.md   # Setup environnement ML + Atlas Cloud GPU
  task-5.2.2-prompt.md   # ETL extraction donnees garage Saad + anonymisation
  task-5.2.3-prompt.md   # Feature engineering + train/val/test split
  task-5.2.4-prompt.md   # Modele Sky AI Diagnostic (Computer Vision EfficientNet-B4)
  task-5.2.5-prompt.md   # Modele Sky AI Decision Engine (LLM Mistral 7B LoRA)
  task-5.2.6-prompt.md   # Package @insurtech/sky NestJS service
  task-5.2.7-prompt.md   # Confidence scoring + threshold rules
  task-5.2.8-prompt.md   # MCP tools Sky AI (Cowork integration)
  task-5.2.9-prompt.md   # Audit ACAPS pour inferences Sky AI
  task-5.2.10-prompt.md  # Model registry MLflow + versioning + rollback
  task-5.2.11-prompt.md  # Inference monitoring Prometheus + drift detection
  task-5.2.12-prompt.md  # Tests E2E 25+ + benchmarks performance
```

**Verification** : `V-20b-sprint-20b-verification.md`
**Decisions cles** : 008 (data residency Maroc) + 011 (Sky AI naming) + 013 (expert valide pas Sky AI seul) + asset garage Saad

---

## REGLES D'EXECUTION CRITIQUES

Sequentielle obligatoire (compile + tests + lint + commit avant tache suivante).

### Si une tache echoue : 3 tentatives reparation puis FAIL + continuer.

### Verification finale : V-20b automatique apres 12 taches.

---

## REGLES ABSOLUES skalean-insurtech v3.0

(Identique batch + specificites ML :)

**Specifique Sprint 20b v3.0** :
- **Python 3.11+** pour pipelines ML (Tache 5.2.1 a 5.2.5)
- **TypeScript / NestJS** pour service production (Tache 5.2.6+)
- **Anonymisation PII OBLIGATOIRE** : CIN + phone + email + plaque + adresse exacte = 0 occurrence dans datasets training
- **Atlas Cloud Services Benguerir** : modeles + datasets restent Maroc (decision-008)
- **Confidence threshold** : > 90% display / 70-90% warning / < 70% escalation humain
- **Audit ACAPS** : chaque inference logged 10 ans retention
- **Sky AI naming** decision-011 (vs Skalean AI generique platform)

---

## CONTEXTE PHASE 5 -- Vertical Repair

### Position du Sprint 2bis dans la Phase 5

Sprint 20b (5.2bis) -- **Sky AI Pre-Training** -- intercalaire entre :
- Sprint 20 (5.2) IA Estimation Photos (pipeline computer vision generique)
- Sprint 21 (5.3) Sinistre Workflow (consume Sky AI Diagnostic Tache 5.3.2)
- Sprint 24 (5.6) Flux 5 Acteurs (consume Sky AI Decision Engine Tache 5.6.2)

### Modules concernes

@insurtech/sky (NOUVEAU package v3.0), @insurtech/compliance (audit ACAPS), apps/api, data-pipelines/ (NOUVEAU repo subdirectory)

### Apport metier

**Asset competitif majeur Maroc** : Sky AI pre-trained sur donnees reelles vs concurrents IA generiques. Garage Saad 1500+ sinistres = donnees Maroc-specific (vehicules / zones / patterns).

---

## EXECUTION SEQUENTIELLE DES 12 TACHES

---

### Tache 1 / 12 : Setup environnement ML + Atlas Cloud GPU

**Metadonnees** : P0 | 6h | Depend de : Sprint 20

**But** : Provision GPU instances Atlas Cloud Services + setup environnement Python ML + MLflow tracking.

**Commande de lecture** :
```bash
cat skalean-insurtech/00-pilotage/prompts-taches/sprint-20b-sky-ai-pretraining/task-5.2.1-prompt.md
```

**Actions principales attendues** :
- 2 GPU instances Atlas Cloud Services (training A100 + inference T4)
- MLflow tracking server `https://mlflow.assurflow.ma`
- Dockerfile + docker-compose ML reproductible
- Experiments MLflow : sky-ai-diagnostic-cv + sky-ai-decision-engine-llm

**Fichiers cibles principaux** :
  - `repo/infrastructure/ml/Dockerfile.training`
  - `repo/infrastructure/ml/Dockerfile.inference`
  - `repo/infrastructure/ml/docker-compose.ml.yml`
  - `repo/infrastructure/scripts/provision-atlas-gpu.sh`

**Criteres P0 cles** :
  - V1 (P0) : GPU instances provisionnees + accessibles
  - V2 (P0) : MLflow tracking server accessible
  - V3 (P0) : Dockerfile build sans erreur
  - V4 (P0) : nvidia-smi disponible dans container

**Validation** :
```bash
docker compose -f repo/infrastructure/ml/docker-compose.ml.yml up -d
docker exec ml-training nvidia-smi
curl https://mlflow.assurflow.ma/health
```

**Commit** :
```bash
git add -A
git commit -m "feat(sprint-20b): setup environnement ml + atlas cloud gpu

Task: 5.2.1
Sprint: 20b (Phase 5 / Sprint 2bis)
Phase: 5 -- Vertical Repair
Decisions: decision-008 data residency maroc"
```

---

### Tache 2 / 12 : ETL extraction donnees garage Saad + anonymisation

**Metadonnees** : P0 | 8h | Depend de : 5.2.1

**But** : Pipeline ETL extraction 1500+ sinistres garage Saad archives (Excel + photos + PDFs) -> dataset Parquet anonymise conformite CNDP.

**Actions principales attendues** :
- Script Python `repo/data-pipelines/etl/extract-garage-saad-historical.py` (~400 lignes)
- 4 sources : Excel + photos S3 + rapports PDF + factures PDF
- Schema dataset Parquet partitionne par annee (voir B-20b Tache 5.2.2)
- Script anonymisation `anonymize.py` -- CIN/phone/email/plaque/adresse exacte -> NULL ou hash
- Output `s3://atlas-cloud/sky-ai/datasets/garage-saad/year={YYYY}/`

**Criteres P0 cles** :
  - V1 (P0 CRITIQUE) : >= 1500 sinistres extraits
  - V2 (P0 CRITIQUE) : Anonymisation 100% complete (PII = 0 occurrence)
  - V3 (P0) : Photos S3 copies avec paths anonymizes
  - V4 (P0) : Schema Parquet valide

**Commit** :
```bash
git commit -m "feat(sprint-20b): etl extraction donnees garage saad + anonymisation cndp

Task: 5.2.2
Sprint: 20b (Phase 5 / Sprint 2bis)
Decisions: decision-008 + loi 09-08 cndp"
```

---

### Tache 3 / 12 : Feature engineering + train/val/test split

**Metadonnees** : P0 | 6h | Depend de : 5.2.2

**But** : Feature engineering complete (encoders + transformations + embeddings text multilingue) + split stratifie 70/15/15.

**Actions principales** :
- Script `repo/data-pipelines/features/feature-engineering.py` (~350 lignes)
- Encoders : One-Hot (marque, type, zone) + target encoding (modele)
- Embeddings text : sentence-transformers `paraphrase-multilingual-mpnet-base-v2` (supporte darija)
- Split stratifie sur severity + type_sinistre
- Output : train.parquet (>= 1050) + val.parquet (>= 225) + test.parquet (>= 225)

**Commit** :
```bash
git commit -m "feat(sprint-20b): feature engineering + train/val/test split stratifie

Task: 5.2.3
Sprint: 20b (Phase 5 / Sprint 2bis)"
```

---

### Tache 4 / 12 : Modele Sky AI Diagnostic (Computer Vision)

**Metadonnees** : P0 | 12h | Depend de : 5.2.3

**But** : Fine-tuning EfficientNet-B4 pour diagnostic photos sinistres -- multi-task (severity + zones + parts).

**Actions principales** :
- Script `repo/data-pipelines/training/train-sky-ai-diagnostic.py` (~500 lignes)
- Architecture : EfficientNet-B4 pre-trained ImageNet + 3 heads
- Training : 50 epochs (early stopping) + AdamW + augmentation Albumentations
- Cibles : severity accuracy >= 85% / zones IoU >= 0.70 / parts recall@10 >= 75%
- Export ONNX pour serving GPU T4
- Tracking MLflow

**Criteres P0 cles** :
  - V1 (P0) : Training termine sans crash
  - V2 (P0 CRITIQUE) : Severity accuracy test >= 85%
  - V3 (P0) : Modele ONNX export OK
  - V4 (P0) : MLflow artifacts trackes

**Validation** :
```bash
python repo/data-pipelines/training/train-sky-ai-diagnostic.py --config configs/diagnostic-v1.yaml
mlflow models serve --model-uri models:/sky_ai_diagnostic/Production
```

**Commit** :
```bash
git commit -m "feat(sprint-20b): modele sky ai diagnostic computer vision finetuning

Task: 5.2.4
Sprint: 20b (Phase 5 / Sprint 2bis)
Decisions: decision-011 sky ai vertical"
```

---

### Tache 5 / 12 : Modele Sky AI Decision Engine (LLM)

**Metadonnees** : P0 | 14h | Depend de : 5.2.4

**But** : Fine-tuning Mistral 7B LoRA pour routing carrier recommendations.

**Actions principales** :
- Script `repo/data-pipelines/training/train-sky-ai-decision-engine.py` (~600 lignes)
- Base : Mistral 7B Instruct v0.2 (open source, francais + arabe)
- LoRA r=16 alpha=32 + qLoRA 4-bit
- Data augmentation : GPT-4 synthese 5000 samples + 1500 reels = 6500 train data
- Cibles : routing accuracy >= 88% / fraud F1 >= 0.75 / latency P50 < 500ms
- Export GGUF pour vLLM serving

**Criteres P0 cles** :
  - V1 (P0) : Training 3 epochs completes
  - V2 (P0 CRITIQUE) : Routing accuracy >= 88%
  - V3 (P0) : Fraud detection F1 >= 0.75
  - V4 (P0) : Latency P50 < 500ms

**Commit** :
```bash
git commit -m "feat(sprint-20b): modele sky ai decision engine llm finetuning lora

Task: 5.2.5
Sprint: 20b (Phase 5 / Sprint 2bis)
Decisions: decision-011 + decision-008"
```

---

### Tache 6 / 12 : Package @insurtech/sky NestJS service

**Metadonnees** : P0 | 8h | Depend de : 5.2.5

**But** : Package NestJS exposant Sky AI via API REST + types TypeScript + SDK client.

**Actions principales** :
- Structure package `repo/packages/sky/`
- 3 services : SkyAiDiagnosticService + SkyAiDecisionEngineService + SkyAiConfidenceScoringService
- Clients : OnnxRuntimeClient (Diagnostic) + VllmClient (Decision Engine)
- Endpoints REST `/api/v1/sky/diagnostic/analyze` + `/api/v1/sky/decision-engine/recommend` + `/api/v1/sky/health`
- Patterns code complets voir B-20b Tache 5.2.6

**Criteres P0 cles** :
  - V1 (P0) : Package @insurtech/sky build sans erreur
  - V2 (P0) : 3 endpoints REST fonctionnels
  - V3 (P0) : Inference end-to-end < 500ms P50

**Commit** :
```bash
git commit -m "feat(sprint-20b): package @insurtech/sky nestjs + endpoints rest

Task: 5.2.6
Sprint: 20b (Phase 5 / Sprint 2bis)
Decisions: decision-011"
```

---

### Tache 7 / 12 : Confidence scoring + threshold rules

**Metadonnees** : P0 | 4h | Depend de : 5.2.6

**But** : Service confidence scoring centralise + regles threshold (90% display / 70-90% warn / <70% escalation humain).

**Actions** :
- Service `sky-ai-confidence-scoring.service.ts`
- Configuration `sky_ai_thresholds_config` table par carrier
- Messages i18n (fr/ar/darija)

**Commit** :
```bash
git commit -m "feat(sprint-20b): confidence scoring + threshold rules + escalation humain

Task: 5.2.7"
```

---

### Tache 8 / 12 : MCP tools Sky AI (Cowork integration)

**Metadonnees** : P0 | 6h | Depend de : 5.2.7

**But** : Sky AI Diagnostic + Decision Engine exposes comme MCP tools pour Cowork orchestrator.

**Actions** :
- MCP server `repo/packages/sky/src/mcp/sky-mcp-server.ts`
- 3 tools : `sky_ai_diagnostic_analyze` + `sky_ai_decision_engine_recommend` + `sky_ai_explain_decision`
- SDK `@insurtech/sky-client`

**Commit** :
```bash
git commit -m "feat(sprint-20b): mcp tools sky ai integration cowork

Task: 5.2.8"
```

---

### Tache 9 / 12 : Audit ACAPS pour inferences Sky AI

**Metadonnees** : P0 | 4h | Depend de : 5.2.8

**But** : Chaque inference Sky AI logged dans `compliance_acaps_audits` 10 ans retention.

**Actions** :
- Migration colonnes `sky_ai_*` dans compliance_acaps_audits
- Service AcapsAuditService.logSkyAiInference() centralise
- Audit obligatoire Diagnostic + Decision Engine

**Commit** :
```bash
git commit -m "feat(sprint-20b): audit acaps pour inferences sky ai

Task: 5.2.9
Decisions: loi conformite acaps 10 ans retention"
```

---

### Tache 10 / 12 : Model registry MLflow + versioning + rollback

**Metadonnees** : P0 | 4h | Depend de : 5.2.9

**But** : MLflow Model Registry stages (staging/production/archived) + CI/CD deploy + auto-rollback.

**Actions** :
- MLflow Model Registry config
- GitHub Actions `.github/workflows/sky-ai-model-deploy.yml`
- Auto-rollback si production metrics drop > 5%

**Commit** :
```bash
git commit -m "feat(sprint-20b): model registry mlflow + versioning + rollback ci/cd

Task: 5.2.10"
```

---

### Tache 11 / 12 : Inference monitoring + drift detection

**Metadonnees** : P0 | 4h | Depend de : 5.2.10

**But** : Monitoring production Prometheus + Grafana + Evidently AI drift detection.

**Actions** :
- Prometheus metrics : sky_ai_inference_latency / confidence_distribution / count
- Grafana dashboard `sky-ai-production-monitoring.json`
- Drift detection jobs daily
- Alertes Slack `#sky-ai-alerts`

**Commit** :
```bash
git commit -m "feat(sprint-20b): inference monitoring prometheus + drift detection

Task: 5.2.11"
```

---

### Tache 12 / 12 : Tests E2E 25+ + benchmarks performance

**Metadonnees** : P0 | 9h | Depend de : 5.2.11

**But** : Tests E2E 25+ scenarios + benchmarks + fixtures dataset 50 sinistres anonymized reproductibles.

**Actions** :
- Tests happy path : analyze damage + recommend routing + explain decision
- Tests confidence thresholds (3 tiers)
- Tests audit ACAPS log presence
- Tests latency (< 500ms P50 / < 1s P95)
- Tests load 50 parallel inferences
- Benchmarks `repo/benchmarks/sky-ai/`
- Fixtures dataset 50 sinistres anonymized

**Commit** :
```bash
git commit -m "test(sprint-20b): tests e2e 25+ + benchmarks sky ai performance

Task: 5.2.12
Sprint: 20b (Phase 5 / Sprint 2bis)"
```

---

## SYNTHESE -- Cloture Sprint 20b v3.0

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

- Diagnostic computer vision (85%+ accuracy)
- Decision Engine LLM routing (88%+ accuracy)
- 1500+ sinistres garage Saad pre-trained
- Package @insurtech/sky + MCP tools
- Audit ACAPS + monitoring production
- Score V-20b >= 95% -- GO"

git push origin sprint-20b-complete-v3-sky-ai-pretraining
```

---

## RESUME DU WORKFLOW

```
[Demarrage Sprint 20b v3.0]
   |
   v
[Tache 5.2.1 : Setup ML + Atlas Cloud GPU]
   |
   v
[Tache 5.2.2 : ETL extraction + anonymisation 1500+ sinistres]
   |
   v
[Tache 5.2.3 : Feature engineering + split]
   |
   v
[Tache 5.2.4 : Modele Sky AI Diagnostic CV (12h training)]
   |
   v
[Tache 5.2.5 : Modele Sky AI Decision Engine LLM (14h training)]
   |
   v
[Tache 5.2.6 : Package @insurtech/sky NestJS service]
   |
   v
[Taches 5.2.7-8 : Confidence + MCP tools]
   |
   v
[Tache 5.2.9 : Audit ACAPS]
   |
   v
[Taches 5.2.10-11 : Model registry + monitoring]
   |
   v
[Tache 5.2.12 : Tests E2E 25+]
   |
   v
[V-20b verification automatique]
   |
   v
[Score >= 95%] -> GO -> tag -> Sprint 21 consume Sky AI Diagnostic + Sprint 24 consume Decision Engine
```

**Duree totale** : 85 heures (incluant ~26h training jobs en background).

**Modules affectes** : @insurtech/sky (NOUVEAU), @insurtech/compliance (audit ACAPS), apps/api, data-pipelines/ (NOUVEAU)

**Apport metier principal** : Asset competitif Sky AI pre-trained sur donnees reelles Maroc (avantage vs concurrents IA generiques).

**Prerequis Sprint 21** : Sprint 20b GO complet (Sky AI Diagnostic ONNX deployed staging)
**Prerequis Sprint 24** : Sprint 20b GO complet (Sky AI Decision Engine deployed staging)

**Sprint suivant** : Sprint 21 Sinistre Workflow.

---

## COMMANDES DE LANCEMENT

### Prerequis (Sprint 20 GO)
```bash
ls skalean-insurtech/sprint20-verify-report.md
grep '^Statut.*GO' skalean-insurtech/sprint20-verify-report.md
```

### Lancement Sprint 20b
```bash
claude-code \
  --orchestrator skalean-insurtech/00-pilotage/meta-prompts/phase-C-orchestration/C-20b-sprint-20b-sky-ai-pretraining.md \
  --reference-prompt skalean-insurtech/00-pilotage/meta-prompts/phase-B-tasks/B-20b-sprint-20b-sky-ai-pretraining.md \
  --verification skalean-insurtech/00-pilotage/meta-prompts/phase-V-verification/V-20b-sprint-20b-verification.md
```

### Suivi temps reel
```bash
# Logs training MLflow
tail -f mlruns/0/{run_id}/artifacts/training.log

# Suivi GPU
watch -n 5 nvidia-smi

# Progress commits
git log --oneline --since="3 weeks ago" -- repo/ | grep "Sprint: 20b"
```

### Apres completion
```bash
cat skalean-insurtech/sprint20b-verify-report.md
mlflow models serve --model-uri models:/sky_ai_diagnostic/Production --port 5001
```

---

## NOTES IMPORTANTES POUR COWORK

1. **Lire B-20b v3.0 complet** AVANT generation prompts (pipelines ML + datasets specifiques)
2. **Asset garage Saad 1500+ sinistres** = avantage competitif majeur Maroc -- preserver donnees
3. **Anonymisation 100% PII** AVANT entrainement (CIN/phone/email/plaque/adresse) -- loi 09-08 CNDP
4. **Atlas Cloud Services Benguerir** : modeles + datasets RESTENT Maroc (decision-008)
5. **Sky AI naming** decision-011 (specialise vertical insurtech, vs Skalean AI generique)
6. **Threshold humain > 70%** : Sky AI **recommande**, expert **valide** (decision-013) -- jamais Sky AI seul
7. **Audit ACAPS** : compliance loi non-negociable sur chaque inference (10 ans retention)
8. **Training jobs longs** (12h + 14h) : planifier en parallele si possible, sinon serie 26h total
9. **MLflow Model Registry** : staging avant production + auto-rollback si drift
10. **NE JAMAIS modifier 00-pilotage/** -- uniquement repo/ et data-pipelines/

---

**Fin orchestrateur C-20b v3.0 -- Sprint 20b (5.2bis) Sky AI Pre-Training.**

**Total taches** : 12 | **Effort** : ~85h | **Apport** : Asset Sky AI pre-trained competitif Maroc
