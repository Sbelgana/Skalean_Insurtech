# META-PROMPT B-28 -- SPRINT 28 ADMIN REPORTS + COMPLIANCE (FIN Phase 6)

**Version** : v2.2 (Option B -- DERNIER sprint Phase 6)
**Phase** : 6 -- Admin Platform
**Sprint** : 28 / 35 (cumul) -- Phase 6 Sprint 3 (DERNIER)
**Position** : Apres Tenants Management Advance, FIN Phase 6
**Numerotation taches** : 6.3.1 a 6.3.12
**Effort total** : ~70 heures developpement / 2 semaines
**Priorite** : P0 (compliance reports critique pour ACAPS + DGI + AMC + CNDP)

---

## Objectif Global du Sprint

Implementer **UI compliance reports + exports + monitoring** consume backends Books Sprint 12 (ACAPS reports + SAFT-MA + AMC). Sprint 28 livre **interface super_admin pour orchestrer compliance MA** : ACAPS exports trimestriels/annuels + SAFT-MA exports DGI + AML monitoring + audit reports avances + dashboard compliance global.

A la sortie de ce sprint :
- ACAPS reports UI : trimestriel portefeuille + sinistres + annuel solvabilite (consume Sprint 12 backend)
- SAFT-MA exports UI : XML controles fiscaux DGI
- AML monitoring dashboard : alerts + review workflow
- Audit reports avances : cross-tenant + period + role-based filtering
- Compliance dashboard global : DGI + ACAPS + AMC + CNDP statuses
- Reports schedules + auto-generation + send to regulators (email)
- **Phase 6 COMPLETE** : 3/3 sprints livres
- Documentation : compliance MA officielle

---

## Frontiere du Sprint

**INCLUS** :
- ACAPS reports UI complete (trimestriel + annuel)
- SAFT-MA exports UI
- AML monitoring dashboard + alerts review
- Audit reports avances cross-tenant
- Compliance dashboard global
- Reports schedules automation
- Documentation compliance officielle
- **Phase 6 closure**

**EXCLU** (sera ajoute aux sprints suivants) :
- IA-powered fraud detection avance -- Sprint 30+ defere
- Multi-region compliance (Tunisie/Algerie expansion) -- Phase 7+
- Real-time AML monitoring streaming -- Phase 7+

---

## Lectures Prealables Obligatoires

1. Sortie Sprint 12 : Books + Compliance backends (ACAPS + SAFT-MA + AML)
2. Sortie Sprint 26 : admin foundation
3. Sortie Sprint 27 : tenants management advance
4. Documentation legale MA : ACAPS reports formats + DGI SAFT-MA schema
5. Loi 09-08 (CNDP) + Loi 43-05 (AMC) + Loi 17-99 (ACAPS)

---

## Stack Imposee (Sprint 28)

| Composant | Version | Notes |
|-----------|---------|-------|
| next | 15.0.4 | App Router |
| @tanstack/react-query | 5.62.0 | mutations |
| recharts | 2.13.x | dashboards compliance |
| react-pdf | 9.x | reports preview |
| xml2js | 0.6.2 | SAFT-MA XML preview |
| zod | 3.24.1 | validation |

---

## Vue d'Ensemble des 12 Taches

| # | Tache | Effort | Priorite | Depend de |
|---|-------|--------|----------|-----------|
| 6.3.1 | ACAPS reports UI : trimestriel portefeuille + sinistres + annuel solvabilite | 7h | P0 | Sprint 27 |
| 6.3.2 | SAFT-MA exports UI : preview + download + send DGI | 6h | P0 | 6.3.1 |
| 6.3.3 | AML monitoring dashboard : alerts + review + clearance workflow | 7h | P0 | 6.3.2 |
| 6.3.4 | Audit reports avances : cross-tenant + period + role-based + export | 6h | P0 | 6.3.3 |
| 6.3.5 | Compliance dashboard global : 4 regulators statuses + alerts | 6h | P0 | 6.3.4 |
| 6.3.6 | Reports schedules : auto-generation + send to regulators (email) | 6h | P0 | 6.3.5 |
| 6.3.7 | Compliance documents browser : 5 ans archive + search avance | 5h | P0 | 6.3.6 |
| 6.3.8 | Tenant compliance scorecard : maturity per tenant | 5h | P0 | 6.3.7 |
| 6.3.9 | Notifications regulators : workflow signaling per regulator + acknowledgments | 4h | P0 | 6.3.8 |
| 6.3.10 | Endpoints REST + permissions enrichies + KMS encrypted exports | 5h | P0 | 6.3.9 |
| 6.3.11 | Documentation compliance MA officielle + onboarding regulators | 4h | P0 | 6.3.10 |
| 6.3.12 | Tests E2E (15+) + WCAG + Lighthouse + Phase 6 closure | 9h | P0 | 6.3.11 |

**Total** : 70 heures.

---

# DETAIL DES 12 TACHES

---

## Tache 6.3.1 -- ACAPS Reports UI

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 7h / Depend de Sprint 27

**But** : Pages UI ACAPS reports : trimestriel portefeuille polices + sinistres + annuel solvabilite (consume Sprint 12 backend).

**Livrables checkables** :
- [ ] Page `/compliance/acaps` :
  - 3 onglets : Trimestriel polices / Trimestriel sinistres / Annuel solvabilite
  - Pour chaque type :
    - Selection period (trimestre / annee)
    - Tenant filter (per broker OR all aggregated)
    - Bouton "Generate Report" : trigger Sprint 12 backend
    - Preview PDF + Excel
    - Bouton "Submit to ACAPS" : send via portal email + audit
    - History : reports envoyes + acknowledgments
- [ ] Trimestriel portefeuille polices :
  - Polices actives per branche (auto / habitation / sante / etc.)
  - Souscriptions / resiliations / renouvellements
  - Chiffre d'affaires
- [ ] Trimestriel sinistres :
  - Sinistres declares + regles + en cours
  - Total sinistres MAD per branche
  - Ratio S/P (Sinistre/Prime)
- [ ] Annuel solvabilite :
  - Provisions techniques per branche
  - Marge solvabilite calculee
  - Ratio couverture
- [ ] Format ACAPS specific : Excel xlsm avec formules conformes circulaires ACAPS
- [ ] Workflow :
  - Generate draft -> super_admin review
  - Approuver -> mark sent + email ACAPS
  - Tracking acknowledgment ACAPS
- [ ] Permissions : `admin.compliance.acaps.read/generate/send`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/acaps/page.tsx                 # ~250 lignes
repo/apps/web-insurtech-admin/components/compliance/acaps-{quarterly-policies,quarterly-sinistres,annual-solvency}.tsx  # 3 composants ~600 lignes
repo/apps/web-insurtech-admin/components/compliance/report-preview.tsx                              # ~150 lignes
repo/apps/web-insurtech-admin/components/compliance/report-history.tsx                                # ~120 lignes
```

**Notes implementation** :
- Frequency reporting ACAPS :
  - Trimestriel : 30 jours apres fin trimestre
  - Annuel : 30 mars annee N+1
- Format Excel xlsm : Sprint 12 backend deja prepare
- Penalties si non-respect deadlines : ACAPS peut suspendre licences

**Criteres validation** :
- V1 (P0) : 3 types reports
- V2 (P0) : Generate + preview
- V3 (P0) : Send workflow + tracking
- V4 (P0) : Permissions
- V5 (P0) : Tests 8+ scenarios

---

## Tache 6.3.2 -- SAFT-MA Exports UI

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 6h / Depend de 6.3.1

**But** : Page SAFT-MA exports XML controles fiscaux DGI (Direction Generale Impots MA).

**Contexte** : SAFT-MA = Standard Audit File Tax format obligatoire MA depuis 2024. Format XML fournissant donnees comptables structurees pour controles fiscaux DGI.

**Livrables checkables** :
- [ ] Page `/compliance/saft-ma` :
  - Selection period (mois / trimestre / annee)
  - Tenant filter (per tenant OR aggregated)
  - Bouton "Generate SAFT-MA XML"
  - Preview XML structured (xml2js render readable)
  - Validation schema XML conform
  - Download XML file
  - Send DGI : email portal officiel
- [ ] Workflow validation :
  - Generate -> validate XSD (Sprint 12 backend)
  - Errors si non conform : highlight + corrections
  - Generate -> super_admin review approve -> envoie DGI
- [ ] History : SAFT-MA exports + send dates + acknowledgments
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/saft-ma/page.tsx                  # ~200 lignes
repo/apps/web-insurtech-admin/components/compliance/saft-ma-preview.tsx                              # ~200 lignes
repo/apps/web-insurtech-admin/components/compliance/saft-ma-validator.tsx                              # ~150 lignes
```

**Notes implementation** :
- DGI demande SAFT-MA mensuel (entreprises > 50M MAD CA) ou annuel sinon
- Validation XSD : essentielle, DGI rejette si non-conforme
- Inclus : ledger entries + customers + suppliers + products + journal headers

**Criteres validation** :
- V1 (P0) : Generate XML
- V2 (P0) : Validation XSD
- V3 (P0) : Preview readable
- V4 (P0) : Download + send DGI
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.3.3 -- AML Monitoring Dashboard

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 7h / Depend de 6.3.2

**But** : Dashboard AML (Anti-Money Laundering) monitoring : alerts auto + review workflow + clearance pour AMC (Autorite Marocaine Anti-Money Laundering).

**Livrables checkables** :
- [ ] Page `/compliance/aml` :
  - **Alerts panel** : list alerts auto (consume Sprint 12 backend AML rules)
    - Transactions > 100k MAD per occurrence
    - Patterns suspects : multiples small payments rapidly
    - PEP (Politically Exposed Person) match
    - High-risk countries connections
    - Unusual activity per customer profile
  - **Review workflow** :
    - Status : pending_review / under_investigation / cleared / suspicious_activity_report (SAR)
    - Assign analyst (Skalean compliance team)
    - Documentation requirements : evidence collection
    - Decision : clear OR generate SAR
  - **SAR generation** : si suspicious -> generate Suspicious Activity Report PDF + send AMC
- [ ] Migration : table `aml_alerts` (consume Sprint 12 backend) :
  - id, source_tenant_id, source_resource_type, source_resource_id, alert_type, severity (low/med/high/critical), status, assigned_analyst, evidence_documents, decision, decision_at, sar_generated, sar_doc_id
- [ ] Cron daily : check unaddressed alerts > 5 jours -> escalate super_admin
- [ ] Permissions : `admin.compliance.aml.review/clear/sar_generate`
- [ ] Tests

**Pattern critique : AML alert severity classification**

```typescript
// repo/packages/admin/src/services/aml-alerts-classifier.service.ts
export class AmlAlertsClassifierService {
  classify(alert: AmlAlert): AlertSeverity {
    // Critical : immediate review required
    if (alert.alert_type === 'pep_match' && alert.confidence > 0.85) return 'critical';
    if (alert.alert_type === 'sanctions_list_match') return 'critical';
    if (alert.alert_type === 'large_cash_transaction' && alert.amount_mad > 500000) return 'critical';

    // High : review within 48h
    if (alert.alert_type === 'unusual_pattern' && alert.deviations > 3) return 'high';
    if (alert.alert_type === 'high_risk_country') return 'high';
    if (alert.alert_type === 'large_cash_transaction' && alert.amount_mad > 100000) return 'high';

    // Medium : review within 7 days
    if (alert.alert_type === 'velocity_increase') return 'medium';
    if (alert.alert_type === 'customer_profile_mismatch') return 'medium';

    // Low : informational
    return 'low';
  }

  getEscalationDeadline(severity: AlertSeverity): number {
    switch (severity) {
      case 'critical': return 24;     // hours
      case 'high': return 48;
      case 'medium': return 168;       // 7 days
      case 'low': return 720;          // 30 days
    }
  }
}
```

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/aml/page.tsx                          # ~250 lignes
repo/apps/web-insurtech-admin/components/compliance/aml-alerts-panel.tsx                                  # ~200 lignes
repo/apps/web-insurtech-admin/components/compliance/aml-review-workflow.tsx                                 # ~250 lignes
repo/apps/web-insurtech-admin/components/compliance/sar-generator.tsx                                       # ~150 lignes
repo/packages/admin/src/services/aml-alerts-classifier.service.ts                                            # ~150 lignes
repo/packages/admin/src/services/sar-generator.service.ts                                                     # ~200 lignes
```

**Notes implementation** :
- AMC = Autorite Marocaine Anti-Money Laundering (loi 43-05)
- SAR (Suspicious Activity Report) : obligation legale 7 jours post-detection
- Penalties non-respect : amendes severes + prison
- Sprint 30+ enrichira detection IA-powered

**Criteres validation** :
- V1 (P0) : Alerts panel
- V2 (P0) : Severity classification
- V3 (P0) : Review workflow + audit
- V4 (P0) : SAR generation + send
- V5 (P0) : Cron escalation
- V6 (P0) : Tests 10+ scenarios

---

## Tache 6.3.4 -- Audit Reports Avances

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 6h / Depend de 6.3.3

**But** : Reports audit avances : cross-tenant + period + role-based + multiple export formats.

**Livrables checkables** :
- [ ] Page `/compliance/audit-reports` :
  - Selection : tenant_filter + period + user_role + action_types + export_format
  - Generate report
  - Aggregations : counts per type action + top users actifs + tenants top access
  - Patterns suspects : login failures + privilege escalations + unauthorized attempts
  - Export : CSV + Excel + PDF (rapport executif)
- [ ] Templates rapport :
  - **Audit executif** (PDF) : 5-page summary KPIs + alerts + recommendations
  - **Audit detail** (Excel) : data raw cas par cas
  - **Audit forensic** (PDF) : zoom investigation specifique (e.g. "tous actions user X 30j")
- [ ] Schedules : auto-generate audit executif mensuel pour super_admin + Skalean board review
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/audit-reports/page.tsx                  # ~200 lignes
repo/apps/web-insurtech-admin/components/compliance/audit-aggregations.tsx                                  # ~250 lignes
repo/packages/docs/src/templates/{fr,en}/audit-{executive,forensic}.hbs                                       # 4 templates
repo/packages/admin/src/services/audit-reports-generator.service.ts                                            # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : 3 templates rapport
- V2 (P0) : Aggregations correctes
- V3 (P0) : Multi-format exports
- V4 (P0) : Scheduled monthly
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.3.5 -- Compliance Dashboard Global

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 6h / Depend de 6.3.4

**But** : Dashboard compliance global : statuses 4 regulators + alerts proactives.

**Livrables checkables** :
- [ ] Page `/compliance/dashboard` :
  - **4 cards regulators** :
    - **ACAPS** : reports trimestriel/annuel statuses + next deadlines + ratio S/P
    - **DGI** : SAFT-MA last submission + tax obligations
    - **AMC** : AML alerts pending + SAR pending + analyst workload
    - **CNDP** : data residency status + privacy requests pending
  - **Alerts panel global** : top critical compliance items
  - **Maturity scoring** : 0-100 per regulator (objectif 90+)
  - **Calendar regulators** : view 12 mois next reports + deadlines
- [ ] Real-time refresh
- [ ] Color coding : green (compliant) / yellow (warning) / red (action required)
- [ ] Permissions : `admin.compliance.dashboard.read`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/dashboard/page.tsx                       # ~200 lignes
repo/apps/web-insurtech-admin/components/compliance/{4 regulator cards}.tsx                                  # ~600 lignes
repo/apps/web-insurtech-admin/components/compliance/regulators-calendar.tsx                                   # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : 4 cards regulators
- V2 (P0) : Color coding
- V3 (P0) : Maturity scoring
- V4 (P0) : Calendar 12 mois
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.3.6 -- Reports Schedules + Auto-Send

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 6h / Depend de 6.3.5

**But** : Workflow reports schedules : auto-generation + send aux regulators (email officiel) + acknowledgments tracking.

**Livrables checkables** :
- [ ] Migration : table `compliance_report_schedules` :
  - id, regulator (enum 'acaps' | 'dgi' | 'amc' | 'cndp'), report_type, frequency (cron expression), recipients (jsonb : emails), auto_send (boolean : si pre-validated by super_admin), last_run_at, next_run_at
- [ ] Service `compliance-scheduler.service.ts` :
  - Cron orchestrator : check schedules + trigger generation + auto-send si configured
  - Notifications super_admin si manual review required
- [ ] UI configuration : page `/compliance/schedules` :
  - List schedules + enable/disable + edit config
  - History runs : success/failure
- [ ] Default schedules :
  - ACAPS trimestriel : 30 du mois post-trimestre 9h00
  - ACAPS annuel : 30 mars 9h00
  - DGI SAFT-MA : 15 du mois 9h00
  - AMC AML monthly : 5 du mois 9h00
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-ComplianceReportSchedules.ts                                   # ~50 lignes
repo/packages/admin/src/services/compliance-scheduler.service.ts                                              # ~250 lignes
repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/schedules/page.tsx                          # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : Schedules configurables
- V2 (P0) : Cron orchestrator
- V3 (P0) : Auto-send + manual review fallback
- V4 (P0) : History runs
- V5 (P0) : Tests 6+ scenarios

---

## Tache 6.3.7 -- Compliance Documents Browser

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 5h / Depend de 6.3.6

**But** : Browser archive 5 ans documents compliance + search avance.

**Livrables checkables** :
- [ ] Page `/compliance/archive` :
  - DataTable : documents tous types (ACAPS reports + SAFT-MA + SAR + audit reports + signed contracts archives)
  - Filters : type + regulator + tenant + period + status
  - Search free text dans filenames + metadata
  - Preview PDF inline + download
  - Download bulk multiple documents (zip)
- [ ] Storage S3 documents archive : 5 ans retention legale (loi 43-20)
- [ ] Soft delete apres 5 ans (cron)
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/archive/page.tsx                           # ~200 lignes
repo/apps/web-insurtech-admin/components/compliance/documents-archive-table.tsx                                 # ~200 lignes
```

**Criteres validation** :
- V1 (P0) : Browser + filters
- V2 (P0) : Search free
- V3 (P0) : Preview + download
- V4 (P0) : Bulk download
- V5 (P0) : Tests 5+ scenarios

---

## Tache 6.3.8 -- Tenant Compliance Scorecard

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 5h / Depend de 6.3.7

**But** : Scorecard compliance maturity per tenant : track progression + gaps.

**Livrables checkables** :
- [ ] Page `/compliance/tenants-scorecard` :
  - DataTable : tenants + scores 4 regulators + global score + trends (previous month)
  - Filter + sort by score
  - Click tenant -> detail compliance items + recommendations
- [ ] Computation scoring :
  - Documents required uploaded : ICE + RC + patente etc.
  - Reports submitted on-time
  - AML reviews timely processed
  - CNDP requirements respected
- [ ] Service `tenant-compliance-scoring.service.ts`
- [ ] Cron weekly : recompute scores + alerts si drop > 10 points
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/app/[locale]/(protected)/compliance/tenants-scorecard/page.tsx                  # ~200 lignes
repo/packages/admin/src/services/tenant-compliance-scoring.service.ts                                            # ~250 lignes
```

**Criteres validation** :
- V1 (P0) : Scoring algorithm
- V2 (P0) : DataTable + filters
- V3 (P0) : Detail per tenant
- V4 (P0) : Cron weekly
- V5 (P0) : Tests 5+ scenarios

---

## Tache 6.3.9 -- Notifications Regulators

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 4h / Depend de 6.3.8

**But** : Workflow signaling regulators + acknowledgments tracking.

**Livrables checkables** :
- [ ] Templates email regulators officials :
  - ACAPS : envoi reports + accusation reception
  - DGI : envoi SAFT-MA
  - AMC : envoi SAR
  - CNDP : breach notification (si requis)
- [ ] Migration : table `regulator_communications` :
  - id, regulator, communication_type, document_doc_id, sent_at, acknowledged_at, acknowledgment_ref, status (enum)
- [ ] Service `regulator-communications.service.ts`
- [ ] Tests

**Fichiers crees / modifies** :
```
repo/packages/database/src/migrations/{date}-RegulatorCommunications.ts                                          # ~40 lignes
repo/packages/admin/src/services/regulator-communications.service.ts                                              # ~150 lignes
repo/packages/comm/src/templates/{fr}/regulator-{acaps,dgi,amc,cndp}-{4 templates}.hbs                            # 16 templates
```

**Criteres validation** :
- V1 (P0) : 4 regulators communications
- V2 (P0) : Tracking acknowledgments
- V3 (P0) : Tests 4+ scenarios

---

## Tache 6.3.10 -- Endpoints REST + Permissions + KMS

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 5h / Depend de 6.3.9

**But** : Consolidation endpoints + permissions enrichies + KMS encryption pour exports sensibles.

**Livrables checkables** :
- [ ] Endpoints livres dans taches precedentes (consolidation)
- [ ] KMS encryption : SAFT-MA + SAR documents encrypted-at-rest S3
- [ ] Permissions ajoutees catalog Sprint 7 :
  - `admin.compliance.acaps.read/generate/send`
  - `admin.compliance.saft-ma.read/generate/send`
  - `admin.compliance.aml.review/clear/sar_generate`
  - `admin.compliance.audit_reports.generate`
  - `admin.compliance.dashboard.read`
  - `admin.compliance.schedules.manage`
  - `admin.compliance.documents.read`
  - `admin.compliance.scoring.read`
- [ ] Tests RBAC

**Fichiers crees / modifies** :
```
repo/packages/auth/src/rbac/permissions.enum.ts                                                                  # update
repo/packages/admin/src/services/kms-compliance-encryption.service.ts                                              # ~120 lignes
```

**Criteres validation** :
- V1 (P0) : 15+ permissions
- V2 (P0) : KMS encryption documents sensibles
- V3 (P0) : Tests 6+ scenarios

---

## Tache 6.3.11 -- Documentation Compliance MA Officielle

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 4h / Depend de 6.3.10

**But** : Documentation officielle compliance MA + onboarding regulators (preparation Phase 7 pilote).

**Livrables checkables** :
- [ ] Documents :
  - `repo/docs/compliance-acaps-guide.md` : ACAPS reporting complete + delays + workflows
  - `repo/docs/compliance-dgi-guide.md` : SAFT-MA + tax obligations
  - `repo/docs/compliance-amc-guide.md` : AML detection + SAR procedures
  - `repo/docs/compliance-cndp-guide.md` : data privacy + retention + breach notifications
  - `repo/docs/compliance-pilot-readiness.md` : checklist Phase 7 pilote
- [ ] Diagrams Mermaid workflows
- [ ] Liens references legales officielles MA

**Fichiers crees / modifies** :
```
repo/docs/compliance-acaps-guide.md                                                                              # ~300 lignes
repo/docs/compliance-dgi-guide.md                                                                                 # ~250 lignes
repo/docs/compliance-amc-guide.md                                                                                 # ~250 lignes
repo/docs/compliance-cndp-guide.md                                                                                 # ~200 lignes
repo/docs/compliance-pilot-readiness.md                                                                             # ~150 lignes
```

**Criteres validation** :
- V1 (P0) : 5 documents complets
- V2 (P0) : Diagrams clairs
- V3 (P0) : Phase 7 pilote ready

---

## Tache 6.3.12 -- Tests E2E + Phase 6 Closure

**Metadonnees** : Phase 6 / Sprint 28 / P0 / 9h / Depend de 6.3.11

**But** : Suite tests E2E + WCAG + Lighthouse + Phase 6 closure officielle.

**Livrables checkables** :

**Tests E2E (15+)** :
- [ ] ACAPS reports 3 types (3)
- [ ] SAFT-MA generate + validate + send (2)
- [ ] AML alerts review + SAR generation (3)
- [ ] Audit reports generation (2)
- [ ] Compliance dashboard (1)
- [ ] Reports schedules (1)
- [ ] Documents archive browser (1)
- [ ] Tenant compliance scorecard (1)
- [ ] Regulator communications (1)

**WCAG 2.1 AA + Lighthouse green**

**Phase 6 Closure document `repo/docs/phase-6-completion.md`** :
- 3 sprints livres : Admin Foundation / Tenants Management / Admin Reports + Compliance
- 36 taches detaillees Phase 6 (12+12+12)
- Skalean Admin Platform **production-ready**
- Compliance MA complete : ACAPS + DGI + AMC + CNDP
- Pilot ready Sprint 35

**Fichiers crees / modifies** :
```
repo/apps/web-insurtech-admin/e2e/sprint-28/{15+ specs}.spec.ts
repo/docs/phase-6-completion.md                                                                                     # closure
```

**Criteres validation** :
- V1 (P0) : 15+ tests passent
- V2 (P0) : Lighthouse green
- V3 (P0) : WCAG AA
- V4 (P0) : CI green
- V5 (P0) : Documentation Phase 6 closure

---

## Sortie du Sprint 28

A la fin de l'execution des 12 taches :

```
Admin Reports + Compliance operational :
  - ACAPS reports UI (trimestriel polices + sinistres + annuel solvabilite)
  - SAFT-MA exports XML DGI conform validation XSD
  - AML monitoring dashboard + alerts severity classification + SAR generation
  - Audit reports avances : executif + detail + forensic
  - Compliance dashboard global 4 regulators + maturity scoring
  - Reports schedules + auto-generation + auto-send
  - Compliance documents archive 5 ans + search avance
  - Tenant compliance scorecard + cron weekly recompute
  - Regulator communications + acknowledgments tracking
  - KMS encryption documents sensibles
  - Documentation compliance MA officielle (5 guides)

15+ tests E2E + WCAG + Lighthouse

PHASE 6 COMPLETE : 3/3 sprints livres
```

**PHASE 6 RECAP** :

| Sprint | Module | Status |
|--------|--------|--------|
| B-26 | Admin Foundation | OK |
| B-27 | Tenants Management UI Advance | OK |
| B-28 | Admin Reports + Compliance | OK |

**Sprint 29 (Phase 7 Hardening + Integrations + Pilote) demarre avec** :
- Skalean Admin Platform complete operational
- Compliance MA all 4 regulators ready
- Phase 7 : Skalean AI integrations + Pentest + Performance + Pilote Marrakech

---

## Specifications Format Tache (pour Generation par Cowork)

Cowork genere `task-6.3.X-*.md` dans `00-pilotage/prompts-taches/sprint-28-admin-reports-compliance/`.

**Patterns code inline conserves** : AML alert severity classification avec types specifiques (PEP / sanctions / large cash / unusual patterns).

**Reference** : Sprint 12 Books backend + Sprint 26-27 admin platform.

---

**Fin du meta-prompt B-28 v2.2 format Option B. PHASE 6 COMPLETE.**
