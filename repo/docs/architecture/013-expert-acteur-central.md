# Decision 013 -- Expert Acteur Central Designe par Carrier (Workflow Sinistre)

**Date** : 2026-05-23
**Statut** : Acceptee
**Decideurs** : Saad (CTO), Abla (CEO)
**ADR mirror** : `repo/docs/architecture/ADR-013-expert-acteur-central.md`

---

## Contexte

L'architecture v2.2 du programme decrit le workflow sinistre auto MA comme suit (Sprint 21 task 5.3.3) :

> "Apres completion du diagnostic Tache 5.3.2, le sinistre est en etat awaiting_approval et un repair_devis doit etre envoye au(x) destinataire(s) -- si le sinistre a un insure_policy_id valide, envoyer l'ASSUREUR (mock Sprint 21, reel Sprint 32) en destinataire principal + COPY au customer ; sinon envoyer le CUSTOMER seul"

Plus encore, Sprint 24 (Flux Sinistre Client M8) se positionne comme :

> "premier flux MA ou client mobile (Sprint 18) declenche tout le processus reparation directement avec garage choisi (Skalean Atlas + partenaires Sprint 25). Workflow M8 : declaration assure (mobile) -> validation auto + manual broker -> dispatch garage choisi -> reception garage -> diagnostic + reparation -> livraison + reglement"

**Ces 2 descriptions contredisent la realite terrain marocaine.**

Saad (CTO + connaissance terrain via garage de son pere a Marrakech) a apporte 29 commentaires terrain dans la revision v2.0 (mai 2026) :

1. **"Le garagiste fait son devis et l'envoie par courriel a l'EXPERT designe par l'assurance, non pas au carrier, pour approbation"**
2. **"Les compagnies d'assurances ont leurs experts auto agrees pour les dossiers sinistres auto"**
3. **"C'est l'expert qui approuve ou rejete le devis"**
4. **"Un expert est toujours designe sur le dossier du sinistre et ce n'est pas le garagiste qui le designe, mais plutot le carrier"**
5. **"La compagnie d'assurance est toujours mise en CC pour les communications"**
6. **"Il faut tenir compte aussi des workflow des expert et le rajouter dans le dashboard"**

Ces corrections impactent profondement :
- Sprint 14 Insure Foundation (entites)
- Sprint 21 Sinistre Workflow (13 taches)
- Sprint 24 Flux Sinistre Client M8 (workflow)
- Sprint 7 RBAC (roles + permissions + workflow states)

## Probleme adresse

Comment corriger l'architecture du workflow sinistre pour :
- Refleter la realite terrain MA (expert designe par carrier, validation devis par expert)
- Etablir l'Expert comme acteur de plein droit avec app dediee
- Maintenir la coherence ACAPS (expert agree = exigence reglementaire)
- Differencier des concurrents qui ignorent l'expert dans leur architecture
- Capitaliser sur historique reel garage Saad (plusieurs annees devis valides par experts)

## Decision

**Adoption Expert comme acteur central de plein droit dans le workflow sinistre Assurflow**.

### Workflow sinistre v3.0 correct (vs v2.2 faux)

```
PHASE 1 -- DECLARATION
[CLIENT/ASSURE] declare sinistre via Assurflow Mobile
   |
   v
[CARRIER] notification immediate + ouverture dossier
   |
   v
[CARRIER] designe AUTOMATIQUEMENT un expert auto agree
       (selon rotation, specialite, charge geographique)

PHASE 2 -- REMORQUAGE (optionnel)
[CLIENT] choisit garage favori (rating/proximite)
[CLIENT] commande remorqueur via Assurflow Tow (1-click Uber-style)
   |
   v
[TOW DRIVER] accepte mission + photos avant/apres
   |
   v
Vehicule livre chez garage choisi

PHASE 3 -- DIAGNOSTIC + DEVIS
[GARAGE] recoit vehicule + dossier deja ouvert
[GARAGE] scan QR pare-brise -> police verifiee instantanement
[GARAGE] fait devis (Sky AI assistance Sprint 20)
   |
   v
[GARAGE] envoie devis a l'EXPERT designe (carrier en CC)
   |
   v
[EXPERT] recoit demande dans son app
[EXPERT] visite garage (24-48h vs 5j actuel)
[EXPERT] examine devis + photos + vehicule
[EXPERT] valide, modifie ligne par ligne, ou refuse
   |
   v
[EXPERT] signe rapport expertise (Barid eSign loi 43-20)
   |
   v
[EXPERT] envoie validation au CARRIER (qui etait en CC)

PHASE 4 -- VALIDATION PAIEMENT CARRIER
[CARRIER] recoit decision expert
[CARRIER] valide paiement selon workflow approval multi-niveau :
   - claims_manager < 5000 MAD
   - + finance 5000-20000 MAD
   - + director 20000-100000 MAD
   - + CFO > 100000 MAD
   |
   v
[CARRIER] declenche paiement direct vers garage
       (circuit garage agree = 90% des cas)

PHASE 5 -- REPARATION + LIVRAISON
[GARAGE] execute travaux + tracking step-by-step
[GARAGE] commande pieces via PartsHub (Sprint 21)
[GARAGE] notifications WhatsApp client (status seulement)
[GARAGE] QC + livraison + facture finale
   |
   v
[CARRIER] paye garage en 7 jours (vs 30-180 jours actuel)
[CLIENT] note services (garage + expert + remorqueur)
```

### Acteurs cle workflow

| Acteur | Responsabilite | Quand intervient |
|--------|----------------|------------------|
| **Client** | Declare sinistre + choisit garage + commande remorqueur + note services | Phase 1 + 2 + 5 |
| **Carrier** | Designe expert + valide paiement + paye garage | Phase 1 + 4 + 5 |
| **Tow Driver** | Accepte mission + remorque + photos before/after | Phase 2 (optionnel) |
| **Garage** | Diagnostique + envoie devis a expert + execute travaux + facture | Phase 3 + 5 |
| **Expert (CENTRAL)** | Recoit devis + visite + valide/modifie/refuse + signe rapport | Phase 3 |
| **PartsHub (module Garage)** | Commande pieces fournisseurs + livraison + paiement | Phase 5 |

### Etats workflow sinistre (RBAC Sprint 7)

```typescript
const SINISTRE_TRANSITIONS_V3: Record<string, string[]> = {
  // Phase 1 -- Declaration
  'declared': ['acknowledged', 'rejected'],
  'acknowledged': ['expert_designated_by_carrier', 'rejected'],
  
  // Phase 2 -- Remorquage (optionnel)
  'expert_designated_by_carrier': ['tow_requested', 'received_at_garage'],
  'tow_requested': ['tow_accepted', 'tow_rejected'],
  'tow_accepted': ['tow_in_progress'],
  'tow_in_progress': ['tow_delivered'],
  'tow_delivered': ['received_at_garage'],
  
  // Phase 3 -- Diagnostic + Devis (NOUVEAU vs v2.2)
  'received_at_garage': ['diagnostic_in_progress'],
  'diagnostic_in_progress': ['quote_drafted'],
  'quote_drafted': ['quote_sent_to_expert'],  // NOUVEAU
  'quote_sent_to_expert': ['expertise_in_progress'],  // NOUVEAU
  'expertise_in_progress': ['quote_validated_by_expert', 'quote_modified_by_expert', 'quote_rejected_by_expert'],  // NOUVEAU
  'quote_modified_by_expert': ['quote_resubmitted', 'quote_validated_by_expert'],  // NOUVEAU
  'quote_resubmitted': ['expertise_in_progress'],  // NOUVEAU
  
  // Phase 4 -- Validation paiement carrier
  'quote_validated_by_expert': ['payment_approval_pending'],
  'payment_approval_pending': ['payment_approved_by_carrier', 'payment_rejected_by_carrier'],  
  'payment_approved_by_carrier': ['reparation_started'],
  
  // Phase 5 -- Reparation
  'reparation_started': ['parts_ordered', 'reparation_in_progress'],
  'parts_ordered': ['parts_received'],  // PartsHub
  'parts_received': ['reparation_in_progress'],
  'reparation_in_progress': ['reparation_completed'],
  'reparation_completed': ['qc_check'],
  'qc_check': ['ready_for_delivery', 'reparation_in_progress'],
  'ready_for_delivery': ['delivered'],
  'delivered': ['payment_to_garage_processing'],
  'payment_to_garage_processing': ['closed'],
  'closed': []  // Terminal
};
```

### Entites DB additionnelles (Sprint 14 etendu)

| Entite | Description |
|--------|-------------|
| **insure_experts** | Catalogue experts agrees ACAPS + experts internes carriers (CIN, agrement ACAPS, specialite, geographie) |
| **insure_expert_assignments** | Designation expert par carrier sur dossier sinistre (expert_id, sinistre_id, carrier_id, designated_at, accepted_at, status) |
| **insure_expert_reports** | Rapport expertise digital avec timestamp + photos + decision (validated/modified/rejected) + commentaires |
| **insure_expert_signatures** | Signatures electroniques Barid eSign pour rapports experts (legal value loi 43-20) |

### Permissions additionnelles (Sprint 7 etendu)

```typescript
const EXPERT_PERMISSIONS = [
  // Expert
  'expertise.missions.read',          // Voir ses missions assignees
  'expertise.missions.accept',         // Accepter mission designee
  'expertise.missions.reject',         // Refuser mission (avec raison)
  'expertise.execute',                  // Executer expertise sur place garage
  'expertise.validate_quote',           // Valider devis garage
  'expertise.modify_quote',             // Modifier ligne par ligne
  'expertise.reject_quote',             // Rejeter devis (avec justification)
  'expertise.report.create',            // Creer rapport expertise
  'expertise.report.sign',              // Signer electroniquement (Barid)
  'expertise.honoraires.invoice',       // Facturer honoraires au carrier

  // Carrier expert manager
  'carrier.experts.designate',          // Designer expert sur dossier
  'carrier.experts.read_pool',          // Voir pool experts disponibles
  'carrier.experts.evaluate',           // Evaluer performance expert
];
```

### Roles expert (4 nouveaux roles)

| Role | Description | Niveau |
|------|-------------|--------|
| **expert_independent** | Expert individuel agree ACAPS | Tenant solo |
| **expert_firm_admin** | Gerant cabinet experts | Tenant firm |
| **expert_associate** | Expert associe au cabinet | Tenant firm |
| **expert_carrier_internal** | Expert salarie compagnie d'assurance | Tenant carrier |

### Cross-tenant authorization (1 nouveau type)

| Type | Description |
|------|-------------|
| **garage_to_expert_request** | Garage envoie devis a expert designe par carrier (carrier en CC). Time-bounded 30 jours apres designation. |

## Sprint impacts

| Sprint | Impact |
|--------|--------|
| **Sprint 7 (RBAC)** | Update workflow transitions + 4 roles expert + permissions expertise + carrier_expert_manager |
| **Sprint 14 (Insure Foundation)** | +3 entites experts (effort +10h) |
| **Sprint 21 (Sinistre Workflow)** | REDEFINI -- devis vers expert (pas carrier) + 6 taches PartsHub (effort +30h) |
| **Sprint 22.7 (NOUVEAU Expert App)** | App desktop + mobile pour experts (~70h) |
| **Sprint 24 (Flux Sinistre M8)** | REDEFINI -- 5 acteurs coordonnes incluant expert |
| **Sprint 25 (Cross-Tenant)** | +1 type garage_to_expert_request |
| **Sprint 26.5 (Carrier Portal)** | Carrier designe experts via app dediee |

## Strategie de mitigation pendant developpement

- Sprint 7 RBAC integre des maintenant les 4 roles expert + permissions expertise
- Sprint 7 PermissionsMatrix construit sur workflow correct
- Sprint 14 etendu avec 3 entites experts (specifications Sprint 7.5b)
- Sprint 21 redefini avec workflow correct (specifications Sprint 7.5b)
- Sprint 22.7 nouveau pour app expert dediee
- Tests E2E Sprint 24 validateurs : sinistre traverse 5 acteurs (Client/Tow/Garage/Expert/Carrier)

## Avantages

1. **Workflow realiste** : reflete vraiment ce qui se passe au MA dans le marche assurance auto
2. **Conformite ACAPS renforcee** : expert agree = exigence reglementaire couverte
3. **Differentiation forte** : aucun concurrent local n'a app expert dediee
4. **Pitch credibility** : carriers reconnaissent immediatement le workflow correct
5. **Reduction litiges** : expert valide devis = moins de disputes garage/carrier ulterieures
6. **Sky AI training amplifie** : historique devis valides par experts = dataset goldmine
7. **Cross-selling experts** : carriers peuvent eduquer leurs experts internes a utiliser Assurflow

## Inconvenients

1. **Effort Sprint 21 augmente** : 70h -> 100h (+ 6 taches PartsHub)
2. **Sprint 22.7 nouveau** : +70h sur le programme global
3. **Sprint 14 etendu** : +10h pour 3 entites experts
4. **Complexite RBAC** : 24 roles vs 12, matrice plus large
5. **Adoption experts** : need partnership avec experts agrees ACAPS pour acceptation pilote

Inconvenients juges acceptables car compenses par realite + differentiation strategique.

## Impact technique

- **Aucun code livre touche** : Sprint 1-7 livres conserves
- **Sprint 7.5a impact** : extension AuthRole +4 roles expert + 1 cross-tenant type + permissions catalog
- **Sprint 14 etendu** : 3 nouvelles entites TypeORM + migrations DB
- **Sprint 21 redefini** : workflow transitions + 6 taches PartsHub
- **Sprint 22.7 nouveau** : 2 apps frontend (desktop + mobile PWA)
- **Tests E2E** : scenarios Sprint 24 + Sprint 35 valident workflow 5 acteurs

## Communication

Cette decision est communiquee :
- A l'equipe technique : workflow sinistre v3.0 correct devient standard
- A l'equipe business : pitch carriers met en avant "expert reconnu" comme acteur central
- A ACAPS : dossier Programme Emergence mentionne workflow expert agree (reglementaire)
- A pool experts MA : partenariat pilote pour adoption Sprint 22.7
- A carriers : module designation experts dans Carrier Portal (Sprint 26.5)

---

**Decision finale** : OK pour adoption Expert acteur central designe par carrier. Workflow sinistre v3.0 corrige dans Sprint 14, 21, 22.7, 24, 25, 26.5.

**References** :
- decision-011-assurflow-rebrand.md (Assurflow Expert dans liste apps)
- decision-012-6-acteurs-ecosystem.md (Expert = acteur 6)
- decision-014-partshub-phase1.md (PartsHub dans Sprint 21 etendu)
- assurflow-analyse-strategique-v2.docx (corrections terrain Saad)
- B-7.5a-sprint-7.5a-assurflow-foundation.md (sprint d'execution)
- B-22.7-sprint-expert-app.md (a creer Sprint 7.5b)
