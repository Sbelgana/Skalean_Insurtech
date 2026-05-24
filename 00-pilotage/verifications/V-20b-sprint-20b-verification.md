# VERIFICATION SPRINT 20b v3.0 -- Phase 5 / Sprint 2bis : Sky AI Pre-Training
# Auto-reparation active + Rapport final MD detaille
# 12 taches, 70 criteres extraits B-20b v3.0
# AUCUNE EMOJI AUTORISEE

**Version** : v3.0 (verification detaillee NOUVEAU sprint)
**Phase** : 5 -- Vertical Repair
**Sprint** : 20b / 40 (cumul v3.0) -- aka "Sprint 20.5"
**Reference meta-prompt** : `B-20b-sprint-20b-sky-ai-pretraining.md` v3.0
**Reference orchestrateur** : `C-20b-sprint-20b-sky-ai-pretraining.md`
**Total criteres** : 70 criteres taches + 11 transversaux + 4 specifiques ML/Compliance

---

Tu es **Claude Code (ou Cowork)**. Execute verification COMPLETE Sprint 20b v3.0 apres 12 taches.

**Jalon critique** : Sky AI Diagnostic + Decision Engine = pre-requis dur Sprints 21 + 24. Sans V-20b GO, Sprints 21+24 ne peuvent pas demarrer en mode v3.0.

---

## PHASE DE PREPARATION

```bash
REPORT_FILE="sprint20b-verify-report.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
RUN_ID=$(date '+%Y%m%d-%H%M%S')

cat > "$REPORT_FILE" << EOF
# Rapport de Verification - Sprint 20b v3.0 : Sky AI Pre-Training

**Date** : $TIMESTAMP
**Run ID** : $RUN_ID
**Phase** : 5 -- Vertical Repair
**Sprint** : 20b (Phase 5 / Sprint 2bis)
**Reference B-20b v3.0** : 12 taches, 70 criteres
**Executeur** : Claude Code / Cowork

---
EOF

PASS=0; PASS_REPAIRED=0; FAIL=0; SKIP=0; WARN=0; TABLE_ROWS=""

add_row() {
  local id="$1" desc="$2" status="$3" details="$4"
  TABLE_ROWS="$TABLE_ROWS| $id | $desc | $status | $details |\n"
  case "$status" in
    PASS)    ((PASS++)) ;;
    "PASS*") ((PASS_REPAIRED++)) ;;
    FAIL)    ((FAIL++)) ;;
    SKIP)    ((SKIP++)) ;;
    WARN)    ((WARN++)) ;;
  esac
  echo "[$status] $id - $desc : $details"
}

DB_URL="${DATABASE_URL:-postgresql://insurtech_user:SecurePassword123!@localhost:5432/insurtech}"
MLFLOW_URL="${MLFLOW_TRACKING_URI:-https://mlflow.assurflow.ma}"
pg_query() { psql "$DB_URL" -t -c "$1" 2>/dev/null | tr -d ' \n'; }
```

---

## VERIFICATIONS PAR TACHE (12 taches)

---

## TACHE 1/12 -- 5.2.1 : Setup environnement ML + Atlas Cloud GPU

```bash
echo ""
echo "TACHE 5.2.1 : Setup ML + Atlas Cloud GPU"

# T01-F1 a F3 : Fichiers Docker
for f in Dockerfile.training Dockerfile.inference docker-compose.ml.yml; do
  [ -f "repo/infrastructure/ml/$f" ] && add_row "T01-F-$f" "$f present" "PASS" "" || add_row "T01-F-$f" "$f present" "FAIL" "Manquant"
done

# T01-V1 (P0) : GPU instances accessibles
GPU_AVAIL=$(docker exec ml-training nvidia-smi 2>/dev/null | grep -c "NVIDIA" || echo 0)
[ "$GPU_AVAIL" -ge 1 ] && add_row "T01-V1" "GPU accessibles" "PASS" "$GPU_AVAIL GPU" || add_row "T01-V1" "GPU accessibles" "FAIL" "Aucun GPU"

# T01-V2 (P0) : MLflow tracking accessible
MLFLOW_HEALTH=$(curl -s "$MLFLOW_URL/health" 2>/dev/null | grep -c "ok\|healthy" || echo 0)
[ "$MLFLOW_HEALTH" -ge 1 ] && add_row "T01-V2" "MLflow accessible" "PASS" "Health OK" || add_row "T01-V2" "MLflow accessible" "WARN" "A verifier"

# T01-V3 : 2 MLflow experiments
MLFLOW_EXPS=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/experiments/list" 2>/dev/null | grep -cE "sky-ai-diagnostic-cv|sky-ai-decision-engine-llm" || echo 0)
[ "$MLFLOW_EXPS" -ge 2 ] && add_row "T01-V3" "2 experiments MLflow" "PASS" "$MLFLOW_EXPS" || add_row "T01-V3" "2 experiments MLflow" "WARN" "$MLFLOW_EXPS / 2"
```

---

## TACHE 2/12 -- 5.2.2 : CRITIQUE ETL + anonymisation CNDP

```bash
echo ""
echo "TACHE 5.2.2 : CRITIQUE ETL + anonymisation CNDP"

# T02-F1 : Script ETL
SCRIPT="repo/data-pipelines/etl/extract-garage-saad-historical.py"
if [ -f "$SCRIPT" ]; then
  LINES=$(wc -l < "$SCRIPT")
  [ "$LINES" -ge 300 ] && add_row "T02-F1" "Script ETL >= 300 lignes" "PASS" "$LINES" || add_row "T02-F1" "Script ETL" "WARN" "$LINES lignes faible"
else
  add_row "T02-F1" "Script ETL" "FAIL" "MANQUANT CRITIQUE"
fi

# T02-F2 : Script anonymize
[ -f "repo/data-pipelines/etl/anonymize.py" ] && add_row "T02-F2" "Script anonymize.py" "PASS" "" || add_row "T02-F2" "Script anonymize.py" "FAIL" "Manquant"

# T02-V1 (P0 CRITIQUE) : >= 1500 sinistres
DATASET_PATH="/data/sky-ai/datasets/garage-saad"
SINISTRES_COUNT=$(python3 -c "import pandas as pd; df=pd.read_parquet('$DATASET_PATH'); print(len(df))" 2>/dev/null || echo 0)
if [ "${SINISTRES_COUNT:-0}" -ge 1500 ]; then
  add_row "T02-V1" "Sinistres >= 1500" "PASS" "$SINISTRES_COUNT"
elif [ "${SINISTRES_COUNT:-0}" -ge 1000 ]; then
  add_row "T02-V1" "Sinistres >= 1500" "WARN" "$SINISTRES_COUNT / 1500"
else
  add_row "T02-V1" "Sinistres >= 1500" "FAIL" "$SINISTRES_COUNT / 1500"
fi

# T02-V2 (P0 CRITIQUE LEGAL CNDP) : Anonymisation PII 100%
PII_FOUND=$(python3 -c "
import pandas as pd
import re
df = pd.read_parquet('$DATASET_PATH')
patterns = [r'[A-Z]{1,2}\d{6,7}', r'\+212[0-9]{9}', r'[a-zA-Z0-9._]+@[a-zA-Z0-9.-]+', r'\d{1,4}-[A-Z]{1,3}-\d{1,2}']
total = 0
for col in df.select_dtypes(include='object').columns:
    for p in patterns:
        total += df[col].astype(str).str.contains(p, regex=True, na=False).sum()
print(total)
" 2>/dev/null || echo "ERROR")

if [ "$PII_FOUND" = "0" ]; then
  add_row "T02-V2" "Anonymisation PII 100% CNDP" "PASS" "0 PII"
else
  add_row "T02-V2" "Anonymisation PII 100% CNDP" "FAIL" "$PII_FOUND PII LEGAL CNDP"
fi

# T02-V3 : Schema Parquet valide
SCHEMA_VALID=$(python3 -c "
import pandas as pd
df = pd.read_parquet('$DATASET_PATH')
required = ['sinistre_id', 'date_sinistre', 'vehicule_marque', 'verdict_severity', 'devis_total_mad', 'photos_paths']
missing = [c for c in required if c not in df.columns]
print('OK' if not missing else 'MISSING')
" 2>/dev/null || echo "ERROR")
[ "$SCHEMA_VALID" = "OK" ] && add_row "T02-V3" "Schema Parquet valide" "PASS" "" || add_row "T02-V3" "Schema Parquet valide" "FAIL" "$SCHEMA_VALID"
```

---

## TACHE 3/12 -- 5.2.3 : Feature engineering + split

```bash
echo ""
echo "TACHE 5.2.3 : Feature engineering + split"

SCRIPT="repo/data-pipelines/features/feature-engineering.py"
[ -f "$SCRIPT" ] && add_row "T03-F1" "Script feature-engineering" "PASS" "" || add_row "T03-F1" "Script feature-engineering" "FAIL" "Manquant"

# T03-V1 : Train >= 1050
SPLITS="/data/sky-ai/splits"
TRAIN=$(python3 -c "import pandas as pd; print(len(pd.read_parquet('$SPLITS/train.parquet')))" 2>/dev/null || echo 0)
[ "${TRAIN:-0}" -ge 1050 ] && add_row "T03-V1" "Train >= 1050" "PASS" "$TRAIN" || add_row "T03-V1" "Train >= 1050" "FAIL" "$TRAIN / 1050"

# T03-V2 : Val + Test >= 225 each
VAL=$(python3 -c "import pandas as pd; print(len(pd.read_parquet('$SPLITS/val.parquet')))" 2>/dev/null || echo 0)
TEST=$(python3 -c "import pandas as pd; print(len(pd.read_parquet('$SPLITS/test.parquet')))" 2>/dev/null || echo 0)
if [ "${VAL:-0}" -ge 225 ] && [ "${TEST:-0}" -ge 225 ]; then
  add_row "T03-V2" "Val + Test >= 225 each" "PASS" "$VAL / $TEST"
else
  add_row "T03-V2" "Val + Test >= 225 each" "FAIL" "val=$VAL test=$TEST"
fi

# T03-V3 : Distribution severity preservee stratifie
DIST_OK=$(python3 -c "
import pandas as pd, numpy as np
train = pd.read_parquet('$SPLITS/train.parquet')
val = pd.read_parquet('$SPLITS/val.parquet')
test = pd.read_parquet('$SPLITS/test.parquet')
td = train['verdict_severity'].value_counts(normalize=True).sort_index().values
vd = val['verdict_severity'].value_counts(normalize=True).sort_index().values
sd = test['verdict_severity'].value_counts(normalize=True).sort_index().values
max_diff = max(np.abs(td-vd).max(), np.abs(td-sd).max())
print('OK' if max_diff < 0.05 else f'DRIFT:{max_diff:.3f}')
" 2>/dev/null || echo "ERROR")
[ "$DIST_OK" = "OK" ] && add_row "T03-V3" "Distribution severity preservee" "PASS" "" || add_row "T03-V3" "Distribution severity preservee" "WARN" "$DIST_OK"

# T03-V4 : Embeddings text multilingue
EMBED_FILE=$(find $SPLITS -name "*embeddings*" 2>/dev/null | head -1)
[ -n "$EMBED_FILE" ] && add_row "T03-V4" "Embeddings text generes" "PASS" "" || add_row "T03-V4" "Embeddings text generes" "WARN" "A verifier"
```

---

## TACHE 4/12 -- 5.2.4 : CRITIQUE Modele Sky AI Diagnostic CV

```bash
echo ""
echo "TACHE 5.2.4 : CRITIQUE Modele Sky AI Diagnostic"

SCRIPT="repo/data-pipelines/training/train-sky-ai-diagnostic.py"
if [ -f "$SCRIPT" ]; then
  LINES=$(wc -l < "$SCRIPT")
  [ "$LINES" -ge 400 ] && add_row "T04-F1" "Script training >= 400 lignes" "PASS" "$LINES" || add_row "T04-F1" "Script training" "WARN" "$LINES lignes"
else
  add_row "T04-F1" "Script training" "FAIL" "Manquant"
fi

# T04-V1 (P0) : Training termine
STATUS=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/runs/search" -X POST -H "Content-Type: application/json" \
  -d '{"experiment_ids":["1"]}' 2>/dev/null | jq -r '.runs[0].info.status // "UNKNOWN"' 2>/dev/null || echo "ERROR")
case "$STATUS" in
  "FINISHED") add_row "T04-V1" "Training termine" "PASS" "FINISHED" ;;
  "RUNNING") add_row "T04-V1" "Training termine" "WARN" "RUNNING" ;;
  "FAILED") add_row "T04-V1" "Training termine" "FAIL" "FAILED" ;;
  *) add_row "T04-V1" "Training termine" "WARN" "$STATUS" ;;
esac

# T04-V2 (P0 CRITIQUE) : Severity accuracy >= 85%
ACC=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/runs/search" -X POST -H "Content-Type: application/json" \
  -d '{"experiment_ids":["1"]}' 2>/dev/null | jq -r '.runs[0].data.metrics[] | select(.key=="test_severity_accuracy") | .value' 2>/dev/null || echo 0)
ACC_PCT=$(echo "$ACC * 100" | bc -l 2>/dev/null || echo 0)
if (( $(echo "${ACC:-0} >= 0.85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T04-V2" "Severity accuracy >= 85%" "PASS" "${ACC_PCT}%"
elif (( $(echo "${ACC:-0} >= 0.75" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T04-V2" "Severity accuracy >= 85%" "WARN" "${ACC_PCT}% (cible 85%)"
else
  add_row "T04-V2" "Severity accuracy >= 85%" "FAIL" "${ACC_PCT}%"
fi

# T04-V3 (P0) : ONNX export OK
ONNX="/data/sky-ai/models/diagnostic/v1/model.onnx"
if [ -f "$ONNX" ]; then
  ONNX_SIZE=$(du -h "$ONNX" | awk '{print $1}')
  add_row "T04-V3" "Modele ONNX export" "PASS" "$ONNX_SIZE"
else
  add_row "T04-V3" "Modele ONNX export" "FAIL" "ONNX absent"
fi

# T04-V4 : Zones IoU >= 0.70
IOU=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/runs/search" -X POST -H "Content-Type: application/json" \
  -d '{"experiment_ids":["1"]}' 2>/dev/null | jq -r '.runs[0].data.metrics[] | select(.key=="test_zones_iou") | .value' 2>/dev/null || echo 0)
(( $(echo "${IOU:-0} >= 0.70" | bc -l 2>/dev/null || echo 0) )) && add_row "T04-V4" "Zones IoU >= 0.70" "PASS" "$IOU" || add_row "T04-V4" "Zones IoU >= 0.70" "WARN" "${IOU:-0}"

# T04-V5 : Parts recall@10 >= 75%
RECALL=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/runs/search" -X POST -H "Content-Type: application/json" \
  -d '{"experiment_ids":["1"]}' 2>/dev/null | jq -r '.runs[0].data.metrics[] | select(.key=="test_parts_recall_at_10") | .value' 2>/dev/null || echo 0)
(( $(echo "${RECALL:-0} >= 0.75" | bc -l 2>/dev/null || echo 0) )) && add_row "T04-V5" "Parts recall@10 >= 75%" "PASS" "$RECALL" || add_row "T04-V5" "Parts recall@10 >= 75%" "WARN" "${RECALL:-0}"
```

---

## TACHE 5/12 -- 5.2.5 : CRITIQUE Sky AI Decision Engine LLM

```bash
echo ""
echo "TACHE 5.2.5 : CRITIQUE Sky AI Decision Engine LLM"

# T05-F1 + F2 : Scripts
[ -f "repo/data-pipelines/training/train-sky-ai-decision-engine.py" ] && add_row "T05-F1" "Script training decision-engine" "PASS" "" || add_row "T05-F1" "Script training decision-engine" "FAIL" "Manquant"
[ -f "repo/data-pipelines/training/generate-synthetic-routing-data.py" ] && add_row "T05-F2" "Script synthetic data" "PASS" "" || add_row "T05-F2" "Script synthetic data" "FAIL" "Manquant"

# T05-V1 (P0) : Training 3 epochs
EPOCHS=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/runs/search" -X POST -H "Content-Type: application/json" \
  -d '{"experiment_ids":["2"]}' 2>/dev/null | jq -r '.runs[0].data.metrics[] | select(.key=="epoch") | .value' 2>/dev/null | sort -rn | head -1 || echo 0)
[ "${EPOCHS:-0}" -ge 3 ] && add_row "T05-V1" "Training 3 epochs completes" "PASS" "$EPOCHS" || add_row "T05-V1" "Training 3 epochs completes" "FAIL" "$EPOCHS / 3"

# T05-V2 (P0 CRITIQUE) : Routing accuracy >= 88%
ROUTING_ACC=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/runs/search" -X POST -H "Content-Type: application/json" \
  -d '{"experiment_ids":["2"]}' 2>/dev/null | jq -r '.runs[0].data.metrics[] | select(.key=="val_routing_accuracy") | .value' 2>/dev/null || echo 0)
RACC_PCT=$(echo "$ROUTING_ACC * 100" | bc -l 2>/dev/null || echo 0)
if (( $(echo "${ROUTING_ACC:-0} >= 0.88" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T05-V2" "Routing accuracy >= 88%" "PASS" "${RACC_PCT}%"
elif (( $(echo "${ROUTING_ACC:-0} >= 0.80" | bc -l 2>/dev/null || echo 0) )); then
  add_row "T05-V2" "Routing accuracy >= 88%" "WARN" "${RACC_PCT}% (cible 88%)"
else
  add_row "T05-V2" "Routing accuracy >= 88%" "FAIL" "${RACC_PCT}%"
fi

# T05-V3 (P0) : Fraud detection F1 >= 0.75
FRAUD_F1=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/runs/search" -X POST -H "Content-Type: application/json" \
  -d '{"experiment_ids":["2"]}' 2>/dev/null | jq -r '.runs[0].data.metrics[] | select(.key=="val_fraud_f1") | .value' 2>/dev/null || echo 0)
(( $(echo "${FRAUD_F1:-0} >= 0.75" | bc -l 2>/dev/null || echo 0) )) && add_row "T05-V3" "Fraud F1 >= 0.75" "PASS" "$FRAUD_F1" || add_row "T05-V3" "Fraud F1 >= 0.75" "WARN" "${FRAUD_F1:-0}"

# T05-V4 : GGUF export
GGUF="/data/sky-ai/models/decision-engine/v1/model.gguf"
if [ -f "$GGUF" ]; then
  GGUF_SIZE=$(du -h "$GGUF" | awk '{print $1}')
  add_row "T05-V4" "GGUF export" "PASS" "$GGUF_SIZE"
else
  add_row "T05-V4" "GGUF export" "FAIL" "GGUF absent"
fi

# T05-V5 (P0) : Latency P50 < 500ms
LATENCY=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/runs/search" -X POST -H "Content-Type: application/json" \
  -d '{"experiment_ids":["2"]}' 2>/dev/null | jq -r '.runs[0].data.metrics[] | select(.key=="inference_latency_p50_ms") | .value' 2>/dev/null || echo 9999)
(( $(echo "${LATENCY:-9999} < 500" | bc -l 2>/dev/null || echo 0) )) && add_row "T05-V5" "Latency P50 < 500ms" "PASS" "${LATENCY}ms" || add_row "T05-V5" "Latency P50 < 500ms" "FAIL" "${LATENCY}ms"
```

---

## TACHE 6/12 -- 5.2.6 : Package @insurtech/sky NestJS

```bash
echo ""
echo "TACHE 5.2.6 : Package @insurtech/sky NestJS"

# T06-F1 : Package
[ -d "repo/packages/sky" ] && add_row "T06-F1" "Package @insurtech/sky" "PASS" "" || add_row "T06-F1" "Package @insurtech/sky" "FAIL" "Manquant"

# T06-V1 : 3 services
SERVICES=(sky-ai-diagnostic.service.ts sky-ai-decision-engine.service.ts sky-ai-confidence-scoring.service.ts)
OK=0
for s in "${SERVICES[@]}"; do
  [ -f "repo/packages/sky/src/services/$s" ] && OK=$((OK + 1))
done
[ "$OK" -eq 3 ] && add_row "T06-V1" "3 services Sky AI" "PASS" "" || add_row "T06-V1" "3 services Sky AI" "FAIL" "$OK / 3"

# T06-V2 : 3 endpoints REST
EP=$(grep -rE "/api/v1/sky/diagnostic|/api/v1/sky/decision-engine|/api/v1/sky/health" repo/apps/api/src/modules/sky 2>/dev/null | wc -l)
[ "${EP:-0}" -ge 3 ] && add_row "T06-V2" "3 endpoints REST" "PASS" "" || add_row "T06-V2" "3 endpoints REST" "FAIL" "$EP / 3"

# T06-V3 (P0) : Inference end-to-end < 500ms
timing=$(curl -s -w "%{time_total}\n" -o /dev/null -X POST "http://localhost:3000/api/v1/sky/diagnostic/analyze" \
  -H "Content-Type: application/json" \
  -d '{"sinistreId":"test","photosUrls":["mock://test.jpg"],"vehicleMake":"Renault","vehicleModel":"Clio","vehicleYear":2020}' 2>/dev/null || echo 99)
MS=$(echo "$timing * 1000" | bc -l 2>/dev/null || echo 99999)
(( $(echo "${MS:-99999} < 500" | bc -l 2>/dev/null || echo 0) )) && add_row "T06-V3" "Inference < 500ms" "PASS" "${MS}ms" || add_row "T06-V3" "Inference < 500ms" "WARN" "${MS}ms"
```

---

## TACHE 7/12 -- 5.2.7 : Confidence scoring + thresholds

```bash
echo ""
echo "TACHE 5.2.7 : Confidence scoring + thresholds"

SERVICE="repo/packages/sky/src/services/sky-ai-confidence-scoring.service.ts"
[ -f "$SERVICE" ] && add_row "T07-F1" "Service confidence-scoring" "PASS" "" || add_row "T07-F1" "Service confidence-scoring" "FAIL" "Manquant"

# T07-V1 : Methodes
METHODS=(evaluateConfidence getDisplayMessage)
OK=0; for m in "${METHODS[@]}"; do grep -q "$m" "$SERVICE" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 2 ] && add_row "T07-V1" "Methodes confidence" "PASS" "" || add_row "T07-V1" "Methodes confidence" "FAIL" "$OK / 2"

# T07-V2 : Table thresholds
if pg_query "SELECT 1 FROM information_schema.tables WHERE table_name = 'sky_ai_thresholds_config'" | grep -q "1"; then
  add_row "T07-V2" "Table sky_ai_thresholds_config" "PASS" ""
else
  add_row "T07-V2" "Table sky_ai_thresholds_config" "FAIL" "Manquante"
fi

# T07-V3 : Thresholds 90/70 par defaut
grep -qE "0\.90|0\.70" "$SERVICE" 2>/dev/null && add_row "T07-V3" "Thresholds 90/70" "PASS" "" || add_row "T07-V3" "Thresholds 90/70" "WARN" "A verifier"
```

---

## TACHE 8/12 -- 5.2.8 : MCP tools Sky AI

```bash
echo ""
echo "TACHE 5.2.8 : MCP tools Sky AI"

MCP="repo/packages/sky/src/mcp/sky-mcp-server.ts"
[ -f "$MCP" ] && add_row "T08-F1" "MCP server" "PASS" "" || add_row "T08-F1" "MCP server" "FAIL" "Manquant"

# T08-V1 : 3 tools registered
TOOLS=(sky_ai_diagnostic_analyze sky_ai_decision_engine_recommend sky_ai_explain_decision)
OK=0; for t in "${TOOLS[@]}"; do grep -q "$t" "$MCP" 2>/dev/null && OK=$((OK + 1)); done
[ "$OK" -eq 3 ] && add_row "T08-V1" "3 MCP tools" "PASS" "" || add_row "T08-V1" "3 MCP tools" "FAIL" "$OK / 3"

# T08-V2 : SDK client
[ -d "repo/packages/sky-client" ] && add_row "T08-V2" "SDK @insurtech/sky-client" "PASS" "" || add_row "T08-V2" "SDK @insurtech/sky-client" "WARN" "A verifier"
```

---

## TACHE 9/12 -- 5.2.9 : Audit ACAPS

```bash
echo ""
echo "TACHE 5.2.9 : Audit ACAPS inferences"

# T09-V1 (P0 COMPLIANCE) : Colonnes sky_ai_* ajoutees
COLS=$(pg_query "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'compliance_acaps_audits' AND column_name LIKE 'sky_ai_%'")
[ "${COLS:-0}" -ge 4 ] && add_row "T09-V1" "Colonnes sky_ai_* (>=4)" "PASS" "$COLS" || add_row "T09-V1" "Colonnes sky_ai_*" "FAIL" "$COLS / 4"

# T09-V2 (P0) : Method logSkyAiInference
AUDIT="repo/packages/compliance/src/services/acaps-audit.service.ts"
if [ -f "$AUDIT" ] && grep -q "logSkyAiInference" "$AUDIT"; then
  add_row "T09-V2" "Method logSkyAiInference" "PASS" ""
else
  add_row "T09-V2" "Method logSkyAiInference" "FAIL" "Method manquante"
fi

# T09-V3 : Audit appele dans Sky AI services
AUDIT_CALLS=$(grep -rE "acapsAudit|logSkyAiInference" repo/packages/sky/src/services 2>/dev/null | wc -l)
[ "${AUDIT_CALLS:-0}" -ge 2 ] && add_row "T09-V3" "Audit appele dans Sky AI" "PASS" "$AUDIT_CALLS" || add_row "T09-V3" "Audit appele dans Sky AI" "FAIL" "$AUDIT_CALLS / 2"
```

---

## TACHE 10/12 -- 5.2.10 : Model registry + versioning + rollback

```bash
echo ""
echo "TACHE 5.2.10 : Model registry + rollback"

WORKFLOW="repo/.github/workflows/sky-ai-model-deploy.yml"
[ -f "$WORKFLOW" ] && add_row "T10-F1" "Workflow deploy" "PASS" "" || add_row "T10-F1" "Workflow deploy" "FAIL" "Manquant"

# T10-V1 : MLflow Registry models
MODELS=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/registered-models/list" 2>/dev/null | jq -r '.registered_models | length' 2>/dev/null || echo 0)
[ "${MODELS:-0}" -ge 2 ] && add_row "T10-V1" "Registry models (>=2)" "PASS" "$MODELS" || add_row "T10-V1" "Registry models" "WARN" "$MODELS / 2"

# T10-V2 : Auto-rollback
[ -f "$WORKFLOW" ] && grep -qE "rollback|drift" "$WORKFLOW" 2>/dev/null && add_row "T10-V2" "Auto-rollback logic" "PASS" "" || add_row "T10-V2" "Auto-rollback logic" "WARN" "A verifier"
```

---

## TACHE 11/12 -- 5.2.11 : Monitoring + drift detection

```bash
echo ""
echo "TACHE 5.2.11 : Monitoring + drift detection"

# T11-V1 : Prometheus metrics
METRICS=$(curl -s "http://localhost:3000/api/v1/sky/metrics" 2>/dev/null | grep -cE "sky_ai_inference_latency|sky_ai_confidence_distribution" || echo 0)
[ "${METRICS:-0}" -ge 2 ] && add_row "T11-V1" "Prometheus metrics (>=2)" "PASS" "$METRICS" || add_row "T11-V1" "Prometheus metrics" "WARN" "$METRICS / 2"

# T11-V2 : Grafana dashboard
[ -f "repo/infrastructure/grafana/sky-ai-production-monitoring.json" ] && add_row "T11-V2" "Grafana dashboard" "PASS" "" || add_row "T11-V2" "Grafana dashboard" "FAIL" "Manquant"

# T11-V3 : Drift detection
DRIFT=$(find repo -name "*drift*" -name "*.py" 2>/dev/null | wc -l)
[ "${DRIFT:-0}" -ge 1 ] && add_row "T11-V3" "Drift detection" "PASS" "$DRIFT scripts" || add_row "T11-V3" "Drift detection" "WARN" "Manquant"
```

---

## TACHE 12/12 -- 5.2.12 : Tests E2E 25+ + benchmarks

```bash
echo ""
echo "TACHE 5.2.12 : Tests E2E + benchmarks"

# T12-V1 : Tests E2E >= 25
cd repo
T12=$(pnpm vitest run --reporter=json packages/sky/test/ 2>/dev/null | jq '.numPassedTests // 0' 2>/dev/null || echo 0)
cd ..
if [ "${T12:-0}" -ge 25 ]; then
  add_row "T12-V1" "Tests E2E >= 25" "PASS" "$T12"
elif [ "${T12:-0}" -ge 18 ]; then
  add_row "T12-V1" "Tests E2E >= 25" "WARN" "$T12 / 25"
else
  add_row "T12-V1" "Tests E2E >= 25" "FAIL" "$T12 / 25"
fi

# T12-V2 : Benchmarks
BENCH=$(find repo/benchmarks/sky-ai -name "bench-*.ts" 2>/dev/null | wc -l)
[ "${BENCH:-0}" -ge 3 ] && add_row "T12-V2" "Benchmarks (>=3)" "PASS" "$BENCH" || add_row "T12-V2" "Benchmarks" "FAIL" "$BENCH / 3"

# T12-V3 : Fixtures 50 sinistres anonymized
FIXTURES="repo/packages/sky/test/fixtures/garage-saad-sample-50.json"
if [ -f "$FIXTURES" ]; then
  COUNT=$(jq 'length' "$FIXTURES" 2>/dev/null || echo 0)
  [ "${COUNT:-0}" -ge 50 ] && add_row "T12-V3" "Fixtures 50 sinistres" "PASS" "$COUNT" || add_row "T12-V3" "Fixtures 50 sinistres" "WARN" "$COUNT / 50"
else
  add_row "T12-V3" "Fixtures 50 sinistres" "FAIL" "Absentes"
fi
```

---

## VERIFICATIONS TRANSVERSALES SPRINT 20b

```bash
echo ""
echo "TRANSVERSAUX SPRINT 20b"

cd repo

# TR-BUILD
pnpm turbo run build --filter=@insurtech/sky 2>&1 > /tmp/build.log; BC=$?
[ $BC -eq 0 ] && add_row "TR-BUILD" "Build @insurtech/sky" "PASS" "" || add_row "TR-BUILD" "Build @insurtech/sky" "FAIL" "Erreurs"

# TR-TYPECHECK
pnpm tsc --noEmit 2>&1 > /tmp/tsc.log
TS_ERR=$(grep -c "error TS" /tmp/tsc.log)
[ "$TS_ERR" -eq 0 ] && add_row "TR-TYPECHECK" "TypeScript strict" "PASS" "" || add_row "TR-TYPECHECK" "TypeScript strict" "FAIL" "$TS_ERR"

# TR-COVERAGE >= 85%
COV=$(pnpm vitest run --coverage --reporter=json packages/sky/test/ 2>/dev/null | jq '.coverageMap.total.lines.pct // 0' 2>/dev/null || echo 0)
if (( $(echo "${COV:-0} >= 85" | bc -l 2>/dev/null || echo 0) )); then
  add_row "TR-COVERAGE" "Coverage >= 85%" "PASS" "${COV}%"
else
  add_row "TR-COVERAGE" "Coverage >= 85%" "WARN" "${COV}%"
fi

# TR-LINT
pnpm lint 2>&1 > /tmp/lint.log; LC=$?
[ $LC -eq 0 ] && add_row "TR-LINT" "Biome lint" "PASS" "" || add_row "TR-LINT" "Biome lint" "WARN" ""

cd ..

# TR-NO-EMOJI (TS + Python)
EMOJI=$(grep -rP "[\x{1F300}-\x{1F9FF}]|[\x{2600}-\x{27BF}]" repo/packages/sky repo/data-pipelines --include="*.ts" --include="*.py" --include="*.md" 2>/dev/null | wc -l)
[ "$EMOJI" -eq 0 ] && add_row "TR-NO-EMOJI" "0 emoji" "PASS" "decision-006" || add_row "TR-NO-EMOJI" "0 emoji" "FAIL" "$EMOJI"

# TR-CONSOLE
CONSOLE=$(grep -rn "console\.log\|console\.error" repo/packages/sky --include="*.ts" 2>/dev/null | grep -v ".spec.ts" | wc -l)
[ "$CONSOLE" -eq 0 ] && add_row "TR-CONSOLE" "0 console.*" "PASS" "" || add_row "TR-CONSOLE" "0 console.*" "FAIL" "$CONSOLE"

# TR-COMMITS
NON_CONV=$(git log --since="3 weeks ago" --pretty=format:"%s" -- repo/packages/sky repo/data-pipelines | grep -vE "^(feat|fix|docs|test|chore|refactor|perf)(\(.+\))?:" | wc -l)
[ "$NON_CONV" -eq 0 ] && add_row "TR-COMMITS" "Conventional commits" "PASS" "" || add_row "TR-COMMITS" "Conventional commits" "WARN" "$NON_CONV"
```

---

## VERIFICATIONS SPECIFIQUES ML/COMPLIANCE (4 criteres CRITIQUES)

```bash
echo ""
echo "VERIFICATIONS ML/COMPLIANCE"

# ML-1 (P0 CRITIQUE) : Data residency Atlas Cloud Maroc
ATLAS=$(curl -s "$MLFLOW_URL/api/2.0/mlflow/artifacts/list" 2>/dev/null | grep -cE "atlas-cloud|benguerir|maroc" || echo 0)
[ "${ATLAS:-0}" -ge 1 ] && add_row "ML-1" "Data residency Atlas Cloud" "PASS" "" || add_row "ML-1" "Data residency Atlas Cloud" "WARN" "Verif manuelle decision-008"

# ML-2 (P0 CRITIQUE LEGAL CNDP) : Anonymisation PII 100%
DATASETS_PII=$(python3 -c "
import pandas as pd, re, os
total = 0
for root, dirs, files in os.walk('/data/sky-ai/datasets'):
    for f in files:
        if f.endswith('.parquet'):
            df = pd.read_parquet(os.path.join(root, f))
            for col in df.select_dtypes(include='object').columns:
                for p in [r'[A-Z]{1,2}\d{6,7}', r'\+212[0-9]{9}', r'[a-zA-Z0-9._]+@[a-zA-Z0-9.-]+']:
                    total += df[col].astype(str).str.contains(p, regex=True, na=False).sum()
print(total)
" 2>/dev/null || echo "ERROR")

if [ "$DATASETS_PII" = "0" ]; then
  add_row "ML-2" "Anonymisation PII 100%" "PASS" "0 PII"
else
  add_row "ML-2" "Anonymisation PII 100%" "FAIL" "$DATASETS_PII PII LEGAL CNDP"
fi

# ML-3 (P0) : Audit ACAPS logs presence
ACAPS_LOGS=$(pg_query "SELECT COUNT(*) FROM compliance_acaps_audits WHERE sky_ai_service IS NOT NULL")
if [ "${ACAPS_LOGS:-0}" -ge 1 ]; then
  add_row "ML-3" "Audit ACAPS inferences logged" "PASS" "$ACAPS_LOGS logs"
else
  add_row "ML-3" "Audit ACAPS inferences logged" "WARN" "0 logs (production start ?)"
fi

# ML-4 (P0) : Threshold humain (< 70% escalation)
ESCALATION=$(grep -rE "escalation|escalate.*humain|confidence.*<.*0\.7|confidence.*<.*70" repo/packages/sky 2>/dev/null | wc -l)
[ "${ESCALATION:-0}" -ge 2 ] && add_row "ML-4" "Threshold humain enforce" "PASS" "$ESCALATION refs" || add_row "ML-4" "Threshold humain enforce" "FAIL" "Decision-013 absente"
```

---

## RAPPORT FINAL CONSOLIDE

```bash
TOTAL=$((PASS + PASS_REPAIRED + FAIL + SKIP + WARN))
SCORE_NUM=$((PASS + PASS_REPAIRED))
SCORE_PCT=$(echo "scale=1; $SCORE_NUM * 100 / $TOTAL" | bc -l 2>/dev/null || echo "0")

JALON="NO-GO"
DOWNSTREAM_STATUS="SPRINTS 21 + 24 BLOQUES"
if (( $(echo "$SCORE_PCT >= 95" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO"
  DOWNSTREAM_STATUS="SPRINTS 21 + 24 PEUVENT DEMARRER"
elif (( $(echo "$SCORE_PCT >= 85" | bc -l 2>/dev/null || echo 0) )); then
  JALON="GO CONDITIONNEL"
  DOWNSTREAM_STATUS="SPRINTS 21 + 24 MODE DEGRADE (Sky AI confidence faible -> escalation humain frequente)"
fi

cat >> "$REPORT_FILE" << EOF

## Synthese finale

| Categorie | Nombre |
|-----------|--------|
| PASS | $PASS |
| PASS* (repare) | $PASS_REPAIRED |
| FAIL | $FAIL |
| SKIP | $SKIP |
| WARN | $WARN |
| **TOTAL** | **$TOTAL** |

**Score** : $SCORE_PCT% ($SCORE_NUM / $TOTAL)
**Jalon Sprint 20b** : $JALON
**Impact downstream** : $DOWNSTREAM_STATUS

---

## Resultats detailles

| ID | Description | Statut | Details |
|----|-------------|--------|---------|
$(echo -e "$TABLE_ROWS")

---

## Decision

EOF

case "$JALON" in
  GO)
    cat >> "$REPORT_FILE" << EOF
**GO** -- Sprint 20b v3.0 valide. Sky AI operationnel.

Actions :
1. \`git tag -a "sprint-20b-complete-v3-sky-ai-pretraining" -m "Sprint 20b v3.0 -- score $SCORE_PCT%"\`
2. Deployer modeles production : Sky AI Diagnostic ONNX + Decision Engine GGUF
3. Lancer Sprint 21 (consume Sky AI Diagnostic Tache 5.3.2)
4. Lancer Sprint 24 (consume Sky AI Decision Engine Tache 5.6.2) en parallele
5. Monitoring production active (Grafana sky-ai-production-monitoring)
EOF
    ;;
  "GO CONDITIONNEL")
    cat >> "$REPORT_FILE" << EOF
**GO CONDITIONNEL** ($SCORE_PCT%) -- Sky AI degraded.

Actions :
1. Documenter dette \`dette-technique-sprint-20b.md\`
2. Re-training continu pendant Sprint 21/24
3. Augmenter threshold humain temporairement
4. Tag : \`git tag -a "sprint-20b-complete-v3-conditional" -m "Sprint 20b -- score $SCORE_PCT%"\`
5. Sprint 21 + Sprint 24 = commencer avec mocks fallback en cas faible confidence
EOF
    ;;
  NO-GO)
    cat >> "$REPORT_FILE" << EOF
**NO-GO** ($SCORE_PCT%) -- Sky AI non livrable.

Actions :
1. Escalation Saad + Abla (impact Demo Day -- Sprint 24 bloque)
2. Identifier FAIL P0 (T02-V2 anonymisation + T04-V2 accuracy + T05-V2 routing)
3. Re-executer taches FAIL priorite max
4. Re-V-20b dans 1 semaine
5. **NE PAS lancer Sprint 21 ni Sprint 24** (mocks v2.2 doivent rester)
6. Fallback decision-015 : Demo Day scope reduit sans Sky AI (IA generique Sprint 20 seulement)
EOF
    ;;
esac

echo ""
echo "================================================"
echo "RAPPORT : $REPORT_FILE"
echo "Score : $SCORE_PCT% / Jalon : $JALON"
echo "Downstream : $DOWNSTREAM_STATUS"
echo "================================================"

cat "$REPORT_FILE"
```

---

## NOTES IMPORTANTES POUR EXECUTION

1. **Sprint 20b CRITIQUE downstream** : Sans GO V-20b, Sprints 21 + 24 ne peuvent pas demarrer mode v3.0
2. **4 verifications CRITIQUES COMPLIANCE** : ML-1 (data residency Atlas Cloud) + ML-2 (anonymisation PII CNDP 100%) + ML-3 (audit ACAPS) + ML-4 (threshold humain decision-013)
3. **Tests baseline** : Sprint 20b ajoute 25+ tests / coverage @insurtech/sky >= 85%
4. **Auto-reparation** : limitee (modeles ML ne se reparent pas auto -- re-training necessaire)
5. **MLflow tracking obligatoire** : metriques exportees pour verification automatique
6. **Decision-008 data residency** = legalement non-negociable Maroc
7. **Loi 09-08 CNDP anonymisation** = legalement non-negociable
8. **Sprint 21 Tache 5.3.2 + Sprint 24 Tache 5.6.2/5.6.7** depend dur de Sprint 20b GO

---

**Fin verification V-20b v3.0 -- Sprint 20b (5.2bis) Sky AI Pre-Training.**

**Total criteres** : 70 + 11 transversaux + 4 ML/Compliance = 85 criteres
