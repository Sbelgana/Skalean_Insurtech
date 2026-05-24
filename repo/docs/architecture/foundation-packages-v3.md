# Foundation Packages v3.0 -- @insurtech/expertise + @insurtech/tow

**Sprint 7.5b deliverable** | **Decision references** : 011 + 012 + 013 + 014

---

## 1. Vue d'ensemble

Sprint 7.5b livre 2 packages skeleton + 3 entities DB foundation pour debloquer
les sprints metier Sprint 14 / 22.5 / 22.7 sans bloquer le scope Sprint 8-13.

| Package | Sprint impl | Responsable | Tables DB |
|---------|-------------|-------------|-----------|
| `@insurtech/expertise` | Sprint 14 + 22.7 | Expert workflow (decision-013) | insure_experts + insure_expert_assignments + insure_expert_reports |
| `@insurtech/tow` | Sprint 22.5 | Tow Uber-style (decision-012) | tow_missions + tow_drivers (creees Sprint 22.5) |

**Pattern skeleton** : services throw `NotImplementedError('method', 'Sprint N')` jusqu'au
sprint cible. Permet developpement parallele sans casser le build.

---

## 2. Architecture @insurtech/expertise

### 2.1 Types livres (Sprint 7.5b.1)

```typescript
// expert.types.ts
export interface Expert {
  readonly id: string;
  readonly tenantId: string;       // Expert OR Carrier tenant (JAMAIS Garage)
  readonly userId: string;
  readonly cin: string;
  readonly acapsRegistrationNumber: string;
  readonly speciality: ExpertSpeciality;       // 3 valeurs
  readonly acapsRegistrationDate: Date;
  readonly status: ExpertStatus;               // 4 valeurs
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

// expertise.types.ts (workflow)
export type ExpertAssignmentStatus =
  | 'designated' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

// expert-report.types.ts (Barid eSign loi 43-20)
export type ExpertReportStatus =
  | 'draft' | 'submitted' | 'signed' | 'archived' | 'rejected';
```

### 2.2 Services skeleton (Sprint 7.5b.8)

```typescript
class ExpertService {
  registerExpert(input)                 // Sprint 14
  listExperts(filters?)                 // Sprint 14
  designateExpertForSinistre(input)     // Sprint 14
}

class ExpertReportService {
  createReport(input)                   // Sprint 14
  signReport(input)                     // Sprint 10 (Barid eSign integration)
  getReportByAssignment(id)             // Sprint 14
}
```

### 2.3 Tables DB (Sprint 7.5b.5/6/7)

**insure_experts** (migration 1735000000013) :
- 8 colonnes : id + tenant_id + user_id + cin + acaps_registration_number + speciality + acaps_registration_date + status
- CHECK speciality (3 valeurs) + CHECK status (4 valeurs)
- UNIQUE acaps_registration_number + UNIQUE user_id
- RLS + FORCE RLS + 4 policies via app_can_access_tenant v3.0
- Indexes : tenant + status + speciality

**insure_expert_assignments** (migration 1735000000014) :
- Mission workflow expert (designated -> accepted/rejected -> completed/cancelled)
- FK expert_id + sinistre_id + designated_by_user_id
- RLS + 4 policies + trigger updated_at + grants

**insure_expert_reports** (migration 1735000000015) :
- Rapport PDF signe (Barid eSign loi 43-20)
- CHECK consistency : status='signed' requires signature_hash + signed_at non-null
- RLS + 4 policies + grants

---

## 3. Architecture @insurtech/tow

### 3.1 Types livres (Sprint 7.5b.2)

```typescript
// tow.types.ts
export type TowMissionStatus =
  | 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export type TowVehicleType =
  | 'car' | 'suv' | 'truck_light' | 'truck_heavy' | 'motorcycle';
export type TowRequestSource = 'assure' | 'broker' | 'garage';

// tow-mission.types.ts
export interface TowMission {
  readonly id: string;
  readonly tenantId: string;             // Tow tenant
  readonly requestSourceTenantId: string;
  readonly requestSource: TowRequestSource;
  readonly targetGarageTenantId?: string | null;  // si tower_to_garage_delivery
  readonly assignedDriverId?: string | null;
  readonly sinistreId?: string | null;
  readonly vehicleType: TowVehicleType;
  readonly pickupAddress: string;
  readonly pickupLatitude: number;
  readonly pickupLongitude: number;
  readonly status: TowMissionStatus;
  // ... timestamps + costs
}

// tow-driver.types.ts
export type TowDriverStatus = 'offline' | 'available' | 'busy' | 'suspended';
```

### 3.2 Services skeleton (Sprint 7.5b.9)

```typescript
class TowService {
  dispatchTow(input)                    // Sprint 22.5
  updateTowMissionStatus(input)         // Sprint 22.5
  listTowMissions(filters?)             // Sprint 22.5
}

class TowDriverService {
  registerDriver(input)                 // Sprint 22.5
  assignDriverToMission(input)          // Sprint 22.5
}
```

### 3.3 Tables DB

Sprint 22.5 creera `tow_missions` + `tow_drivers` (pas dans Sprint 7.5b scope --
seulement les types TypeScript foundation).

---

## 4. Cross-tenant authorization v3.0 (Sprint 7.5a.3)

Les 4 nouveaux types cross-tenant v3.0 servent ces packages :

| Type | From | To | Usage |
|------|------|----|----|
| `client_to_tower_dispatch` | Assure/Broker/Garage tenant | Tow tenant | TowService.dispatchTow |
| `tower_to_garage_delivery` | Tow tenant | Garage tenant | Sprint 22.5 livraison finale |
| `garage_to_expert_request` | Garage tenant | Expert tenant | Sprint 14 expert read devis |
| `garage_to_carrier_quote` | Garage tenant | Carrier tenant | Sprint 14 envoi devis CC |

Helper Postgres `app_can_access_tenant()` v3.0 (Sprint 7.5a.5) supporte ces 7 types.

---

## 5. Roadmap implementation

| Sprint | Scope | Effort | Decisions |
|--------|-------|--------|-----------|
| **7.5b** | Foundation packages (livre) | -- | 011/012/013/014 |
| **10** | Barid eSign signature integration (loi 43-20) | -- | 009 |
| **14** | Insure Foundation : ExpertService impl + designation workflow | 95h | 013 |
| **22.5** | Tow App Uber-style (driver PWA + dispatcher + WebSocket) | 75h | 012 |
| **22.7** | Expert App PWA (workflow validation devis + signature) | 70h | 013 |

---

## 6. Tests integration

### 6.1 RLS isolation (apps/api/test/integration/rls/)

`rls-cross-tenant-isolation-insure-experts.spec.ts` (6 tests PASS Sprint 7.5b) :
- TC-1 INSERT tenant A + SELECT tenant B retourne 0 rows
- TC-2 INSERT chaine expert -> assignment -> report tenant A + integrite + cross-tenant 0 rows
- TC-3 CHECK speciality rejette valeur invalide
- TC-4 CHECK status assignment rejette valeur invalide
- TC-5 UNIQUE acaps_registration_number empeche duplicates
- TC-6 CHECK signature consistency : status=signed requires signature_hash + signed_at

### 6.2 Unit tests packages

- packages/expertise : 6 (bootstrap) + 8 (services skeletons) = 14 specs PASS
- packages/tow : 6 (bootstrap) + 8 (services skeletons) = 14 specs PASS
- Total foundation : 28 unit tests + 6 integration tests = 34 nouveaux tests Sprint 7.5b

---

## 7. Conformite v3.0

- **decision-006 no-emoji** : zero emoji dans tous fichiers livres
- **decision-008 residence MA** : report_url ciblent Atlas Cloud Services Maroc
- **decision-009 signature loi 43-20** : ExpertReport.signReport via Barid eSign
- **decision-011 Assurflow** : marque produit conservee, namespace technique inchange
- **decision-012 ecosystem 6 acteurs** : Tow tenant + Expert tenant
- **decision-013 Expert ACAPS** : independence vs Garage materialisee + agrement obligatoire
- **decision-014 PartsHub** : pas concerne Sprint 7.5b

---

## 8. Liens

- `00-pilotage/decisions/013-expert-acteur-central.md`
- `00-pilotage/decisions/012-ecosysteme-6-acteurs.md`
- `00-pilotage/documentation/5-roles-permissions.md` v3.0
- `pause-5-validation-runtime.md` (recommandations infrastructure)
- `repo/packages/expertise/` source
- `repo/packages/tow/` source
- `repo/packages/database/src/migrations/1735000000013-15-*.ts` migrations DB
