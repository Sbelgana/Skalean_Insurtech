# TACHE 3.6.9 -- HR Employees + Contrats CDI/CDD/ANAPEC

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.9)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant 3.6.10 conges + 3.6.11 paie + Sprint 23 web-garage HR module)
**Effort** : 5h
**Dependances** : Sprint 6 multi-tenant + RLS, Sprint 7 RBAC, Sprint 10 Docs (PDF contrat), Sprint 5 auth_users (link FK)
**Densite cible** : 80-110 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache pose le module HR (Ressources Humaines) avec 2 entites Postgres critiques : `hr_employees` (dossiers employes garage : CIN MA, CNSS, gender, date naissance, hired_date, position, base_salary, photo) et `hr_contracts` (contrats de travail : type CDI/CDD/anapec/stage, dates, salary_components jsonb pour primes + indemnites, terms_pdf_id lien Docs Sprint 10, status active/terminated/expired). Implementation conforme au **Code du Travail Marocain (loi 65-99)** qui impose : (a) periode d'essai 3 mois maximum, (b) trois types contrats principaux (CDI Contrat Duree Indeterminee, CDD Contrat Duree Determinee max 1 renouvellement, ANAPEC subventionne par l'Agence Nationale de Promotion de l'Emploi pour jeunes diplomes), (c) duree legale travail 44h/semaine (depuis 2003), (d) declaration CNSS dans 8 jours apres embauche, (e) carte de travail obligatoire.

L'apport est triple. **Premierement**, 2 migrations Postgres avec contraintes CHECK strictes (CIN format MA `^[A-Z]{1,2}\d{1,6}$`, CNSS numero 9 chiffres, salaire >= SMIG 2 970 MAD 2026), validations Zod. **Deuxiemement**, 2 services : `employees.service.ts` (CRUD + termination workflow + reattachement user_id), `contracts.service.ts` (CRUD + transitions + check CDD max 1 renouvellement + duree max 18 mois cumules). **Troisiemement**, controller REST `/api/v1/hr/employees/*` avec 6 endpoints + RBAC `hr.employees.create/read/update/delete` + audit trail systematique + Kafka events `hr.employee_hired`, `hr.employee_terminated`, `hr.contract_signed`.

A l'issue de cette tache, un chef garage peut creer un employee `POST /hr/employees` (full_name "Rachid Bennani", CIN "BE123456", cnss_number "123456789"), creer son premier contrat CDI debut le 2026-06-01 avec base_salary 5000 MAD, periode_essai 3 mois. Tache 3.6.10 ajoutera les conges. Tache 3.6.11 generera les bulletins de paie automatiquement.

---

## 2. Contexte etendu

### 2.1 Specificites contrats MA

**CDI** : duree indeterminee, licenciement encadre (motif legitime + indemnite 1.5 mois par annee anciennete au-dela 5 ans), periode essai 3 mois cadres / 1.5 mois employes / 15 jours ouvriers.

**CDD** : duree determinee max 1 an renouvelable 1 fois (max 2 ans cumules), seulement pour cas legaux (remplacement, surcharge temporaire, travail saisonnier). Renouvellement abusif = requalification CDI.

**ANAPEC** : contrats subventionnes pour jeunes diplomes moins de 35 ans, subvention 1600 MAD/mois CNSS + AMO pendant 12-24 mois. Conditions strictes : tenir engagement non-licenciement, declaration ANAPEC.

**Stage** : 6 mois max, indemnite minimale 1600 MAD, pas de cotisation sociale obligatoire (mais recommandee).

### 2.2 SMIG 2026

Le **SMIG (Salaire Minimum Interprofessionnel Garanti)** MA 2026 est de **2 970 MAD/mois** (revaloration 2023 + indexation). Pour secteur agricole SMAG plus bas. Skalean InsurTech vise courtiers et garages = SMIG standard.

### 2.3 CIN format MA

Format officiel : 1 ou 2 lettres + 1 a 6 chiffres. Exemples : `BE123456`, `A1234`, `J567890`. Regex `^[A-Z]{1,2}\d{1,6}$`.

### 2.4 CNSS numero

9 chiffres. Format `^\d{9}$`. Verifiable via API CNSS (Sprint 35 integration future).

### 2.5 Trade-offs

**Trade-off 1 : Pas de signature electronique contrats Sprint 13**. PDF genere et stocke S3 (Sprint 10), signature ANRT differee Sprint 14 si necessaire.

**Trade-off 2 : Pas de paye complete Sprint 13**. Bulletins basiques Tache 3.6.11. Sprint 35+ paye avancee (CIMR retraite, primes complexes).

**Trade-off 3 : Pas de gestion mutuelle Sprint 13**. Sprint 35+ AMO complementaire.

### 2.6 Pieges techniques

1. **Piege : CIN duplicate cross-tenant**. Un MA citizen ne peut travailler chez deux garages simultanement. Pourtant on n'enforce pas UNIQUE global car privacy. Solution : UNIQUE per tenant + soft check sur termination check active employments.
2. **Piege : CNSS update apres declaration**. Modifier CNSS apres declaration officielle = procedure lourde. Solution : CNSS immutable apres `cnss_declared_at` (Sprint 35).
3. **Piege : Contract chevauchement dates**. 2 contrats actifs en meme temps pour meme employee = illegal. Solution : trigger Postgres CHECK overlap.
4. **Piege : Date naissance > now()**. Validation Zod.
5. **Piege : Termination avant hired_date**. Validation Zod.

---

## 3. Architecture

```
auth_users (Sprint 5)
   |
   v
hr_employees (1-1 optionnel via user_id)
   |
   v
hr_contracts (1-N, max 1 active simultanement)
   |
   v
   uses doc_documents (Sprint 10 contrat PDF)
   
Kafka events :
  hr.employee_hired
  hr.employee_terminated  
  hr.contract_signed
  hr.contract_terminated
  hr.contract_renewed
```

---

## 4. Livrables

- [ ] Migration `1715400000000-HrEmployees.ts`
- [ ] Migration `1715400100000-HrContracts.ts`
- [ ] Entities `hr-employee.entity.ts`, `hr-contract.entity.ts`
- [ ] Services `employees.service.ts`, `contracts.service.ts`
- [ ] DTO Zod 4 (create/update employee + create/update contract)
- [ ] Controller `employees.controller.ts` (6 endpoints)
- [ ] Permissions seed `hr.employees.*`, `hr.contracts.*`
- [ ] Kafka events publishing
- [ ] Package `@insurtech/hr`
- [ ] Tests 20 unit + 6 E2E

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/1715400000000-HrEmployees.ts                  (~80 lignes)
repo/packages/database/src/migrations/1715400100000-HrContracts.ts                   (~90 lignes)
repo/packages/hr/package.json                                                          (nouveau)
repo/packages/hr/src/index.ts                                                          (nouveau)
repo/packages/hr/src/hr.module.ts                                                       (nouveau, ~40 lignes)
repo/packages/hr/src/entities/hr-employee.entity.ts                                    (~80 lignes)
repo/packages/hr/src/entities/hr-contract.entity.ts                                     (~80 lignes)
repo/packages/hr/src/services/employees.service.ts                                       (~230 lignes)
repo/packages/hr/src/services/employees.service.spec.ts                                  (~250 lignes 13 tests)
repo/packages/hr/src/services/contracts.service.ts                                       (~220 lignes)
repo/packages/hr/src/services/contracts.service.spec.ts                                  (~210 lignes 9 tests)
repo/packages/hr/src/dto/create-employee.dto.ts                                          (~60 lignes Zod)
repo/packages/hr/src/dto/create-contract.dto.ts                                          (~60 lignes Zod)
repo/packages/hr/src/dto/terminate-employee.dto.ts                                        (~30 lignes Zod)
repo/packages/hr/src/utils/ma-validators.ts                                               (~70 lignes : CIN, CNSS, SMIG)
repo/packages/hr/src/events/hr-events.ts                                                   (~40 lignes Kafka topics)
repo/apps/api/src/modules/hr/hr.module.ts                                                   (nouveau, ~40 lignes)
repo/apps/api/src/modules/hr/controllers/employees.controller.ts                            (~180 lignes)
repo/apps/api/src/modules/hr/controllers/contracts.controller.ts                            (~140 lignes)
repo/apps/api/test/hr/employees.e2e-spec.ts                                                  (~240 lignes 6 tests)
repo/packages/auth/src/seeds/permissions/hr.ts                                                (nouveau)
```

---

## 6. Code patterns COMPLETS

### 6.1 Migration `1715400000000-HrEmployees.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrEmployees1715400000000 implements MigrationInterface {
  name = 'HrEmployees1715400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE hr_employees (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        user_id                  UUID REFERENCES auth_users(id) ON DELETE SET NULL,
        full_name                VARCHAR(255) NOT NULL,
        cin                      VARCHAR(16) NOT NULL,
        cnss_number              VARCHAR(16),
        gender                   VARCHAR(16) NOT NULL,
        date_of_birth            DATE NOT NULL,
        hired_date               DATE NOT NULL,
        department               VARCHAR(64),
        position                 VARCHAR(128),
        base_salary              NUMERIC(15,2) NOT NULL,
        family_children          INT NOT NULL DEFAULT 0,
        bank_iban                VARCHAR(64),
        phone                    VARCHAR(32),
        email                    VARCHAR(255),
        address                  TEXT,
        photo_url                TEXT,
        active                   BOOLEAN NOT NULL DEFAULT TRUE,
        terminated_date          DATE,
        termination_reason       VARCHAR(500),
        notes                    TEXT,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at               TIMESTAMPTZ,
        UNIQUE (tenant_id, cin),
        CONSTRAINT chk_cin_format CHECK (cin ~ '^[A-Z]{1,2}\\d{1,6}$'),
        CONSTRAINT chk_cnss_format CHECK (cnss_number IS NULL OR cnss_number ~ '^\\d{9}$'),
        CONSTRAINT chk_gender CHECK (gender IN ('M', 'F', 'undisclosed')),
        CONSTRAINT chk_dob_past CHECK (date_of_birth < CURRENT_DATE - INTERVAL '15 years'),
        CONSTRAINT chk_hired_after_birth CHECK (hired_date > date_of_birth + INTERVAL '15 years'),
        CONSTRAINT chk_salary_smig CHECK (base_salary >= 2970),
        CONSTRAINT chk_children_positive CHECK (family_children >= 0 AND family_children <= 20),
        CONSTRAINT chk_terminated_after_hired CHECK (terminated_date IS NULL OR terminated_date >= hired_date)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_hr_employees_tenant ON hr_employees(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_hr_employees_user ON hr_employees(user_id);`);
    await queryRunner.query(`CREATE INDEX idx_hr_employees_active ON hr_employees(active) WHERE active = TRUE;`);
    await queryRunner.query(`CREATE INDEX idx_hr_employees_department ON hr_employees(tenant_id, department);`);
    await queryRunner.query(`CREATE INDEX idx_hr_employees_name_search ON hr_employees USING GIN(to_tsvector('french', full_name));`);

    await queryRunner.query(`ALTER TABLE hr_employees ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_hr_employees ON hr_employees
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE hr_employees;`);
  }
}
```

### 6.2 Migration `1715400100000-HrContracts.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrContracts1715400100000 implements MigrationInterface {
  name = 'HrContracts1715400100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE hr_contract_type AS ENUM ('cdi', 'cdd', 'anapec', 'stage', 'freelance');
    `);
    await queryRunner.query(`
      CREATE TYPE hr_contract_status AS ENUM ('draft', 'active', 'terminated', 'expired', 'renewed');
    `);
    await queryRunner.query(`
      CREATE TABLE hr_contracts (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        employee_id              UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        contract_type            hr_contract_type NOT NULL,
        start_date               DATE NOT NULL,
        end_date                 DATE,
        monthly_salary           NUMERIC(15,2) NOT NULL,
        working_hours_week       INT NOT NULL DEFAULT 44,
        trial_period_months      INT NOT NULL DEFAULT 0,
        salary_components        JSONB,
        terms_pdf_doc_id         UUID,
        status                   hr_contract_status NOT NULL DEFAULT 'draft',
        signed_at                TIMESTAMPTZ,
        terminated_at            TIMESTAMPTZ,
        termination_reason       VARCHAR(500),
        renewal_count            INT NOT NULL DEFAULT 0,
        anapec_subsidy_amount    NUMERIC(15,2),
        created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_dates CHECK (end_date IS NULL OR end_date > start_date),
        CONSTRAINT chk_cdi_no_end CHECK (contract_type != 'cdi' OR end_date IS NULL),
        CONSTRAINT chk_cdd_has_end CHECK (contract_type != 'cdd' OR end_date IS NOT NULL),
        CONSTRAINT chk_cdd_max_2_years CHECK (
          contract_type != 'cdd' OR
          end_date IS NULL OR
          end_date - start_date <= 365 * 2
        ),
        CONSTRAINT chk_trial_period CHECK (
          (contract_type = 'cdi' AND trial_period_months BETWEEN 0 AND 3) OR
          (contract_type = 'cdd' AND trial_period_months BETWEEN 0 AND 1) OR
          contract_type IN ('anapec', 'stage', 'freelance')
        ),
        CONSTRAINT chk_working_hours CHECK (working_hours_week BETWEEN 1 AND 48),
        CONSTRAINT chk_salary_smig_contract CHECK (monthly_salary >= 2970),
        CONSTRAINT chk_renewal_max_cdd CHECK (
          contract_type != 'cdd' OR renewal_count <= 1
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_hr_contracts_tenant ON hr_contracts(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_hr_contracts_employee ON hr_contracts(employee_id);`);
    await queryRunner.query(`CREATE INDEX idx_hr_contracts_active ON hr_contracts(employee_id) WHERE status = 'active';`);
    await queryRunner.query(`CREATE INDEX idx_hr_contracts_dates ON hr_contracts(start_date, end_date);`);

    // Trigger : 1 contract active max par employee
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_single_active_contract()
      RETURNS TRIGGER AS $$
      DECLARE
        active_count INT;
      BEGIN
        IF NEW.status = 'active' THEN
          SELECT COUNT(*) INTO active_count
          FROM hr_contracts
          WHERE employee_id = NEW.employee_id
            AND status = 'active'
            AND id != NEW.id;
          IF active_count > 0 THEN
            RAISE EXCEPTION 'Employee % already has an active contract', NEW.employee_id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_single_active_contract
        BEFORE INSERT OR UPDATE ON hr_contracts
        FOR EACH ROW EXECUTE FUNCTION check_single_active_contract();
    `);

    await queryRunner.query(`ALTER TABLE hr_contracts ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_hr_contracts ON hr_contracts
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_single_active_contract ON hr_contracts;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_single_active_contract();`);
    await queryRunner.query(`DROP TABLE hr_contracts;`);
    await queryRunner.query(`DROP TYPE hr_contract_status;`);
    await queryRunner.query(`DROP TYPE hr_contract_type;`);
  }
}
```

### 6.3 Entity `hr-employee.entity.ts`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn,
  Unique, OneToMany,
} from 'typeorm';
import { HrContract } from './hr-contract.entity';

@Entity({ name: 'hr_employees' })
@Unique('uq_hr_employees_tenant_cin', ['tenant_id', 'cin'])
export class HrEmployee {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) tenant_id!: string;
  @Column({ type: 'uuid', nullable: true }) user_id!: string | null;
  @Column({ type: 'varchar', length: 255 }) full_name!: string;
  @Column({ type: 'varchar', length: 16 }) cin!: string;
  @Column({ type: 'varchar', length: 16, nullable: true }) cnss_number!: string | null;
  @Column({ type: 'varchar', length: 16 }) gender!: 'M' | 'F' | 'undisclosed';
  @Column({ type: 'date' }) date_of_birth!: Date;
  @Column({ type: 'date' }) hired_date!: Date;
  @Column({ type: 'varchar', length: 64, nullable: true }) department!: string | null;
  @Column({ type: 'varchar', length: 128, nullable: true }) position!: string | null;
  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: { to: (v: any) => v, from: (v: any) => v } })
  base_salary!: string;
  @Column({ type: 'int', default: 0 }) family_children!: number;
  @Column({ type: 'varchar', length: 64, nullable: true }) bank_iban!: string | null;
  @Column({ type: 'varchar', length: 32, nullable: true }) phone!: string | null;
  @Column({ type: 'varchar', length: 255, nullable: true }) email!: string | null;
  @Column({ type: 'text', nullable: true }) address!: string | null;
  @Column({ type: 'text', nullable: true }) photo_url!: string | null;
  @Column({ type: 'boolean', default: true }) active!: boolean;
  @Column({ type: 'date', nullable: true }) terminated_date!: Date | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) termination_reason!: string | null;
  @Column({ type: 'text', nullable: true }) notes!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
  @DeleteDateColumn({ type: 'timestamptz', nullable: true }) deleted_at!: Date | null;

  @OneToMany(() => HrContract, (c) => c.employee)
  contracts?: HrContract[];
}
```

### 6.4 Entity `hr-contract.entity.ts`

```typescript
import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { HrEmployee } from './hr-employee.entity';

export type HrContractType = 'cdi' | 'cdd' | 'anapec' | 'stage' | 'freelance';
export type HrContractStatus = 'draft' | 'active' | 'terminated' | 'expired' | 'renewed';

@Entity({ name: 'hr_contracts' })
@Index('idx_hr_contracts_employee', ['employee_id'])
export class HrContract {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ type: 'uuid' }) tenant_id!: string;
  @Column({ type: 'uuid' }) employee_id!: string;
  @ManyToOne(() => HrEmployee, (e) => e.contracts) @JoinColumn({ name: 'employee_id' }) employee?: HrEmployee;
  @Column({ type: 'enum', enum: ['cdi', 'cdd', 'anapec', 'stage', 'freelance'], enumName: 'hr_contract_type' })
  contract_type!: HrContractType;
  @Column({ type: 'date' }) start_date!: Date;
  @Column({ type: 'date', nullable: true }) end_date!: Date | null;
  @Column({ type: 'numeric', precision: 15, scale: 2, transformer: { to: (v: any) => v, from: (v: any) => v } })
  monthly_salary!: string;
  @Column({ type: 'int', default: 44 }) working_hours_week!: number;
  @Column({ type: 'int', default: 0 }) trial_period_months!: number;
  @Column({ type: 'jsonb', nullable: true })
  salary_components!: { prime_anciennete?: number; prime_rendement?: number; indemnite_transport?: number; [k: string]: number | undefined } | null;
  @Column({ type: 'uuid', nullable: true }) terms_pdf_doc_id!: string | null;
  @Column({ type: 'enum', enum: ['draft', 'active', 'terminated', 'expired', 'renewed'], default: 'draft' })
  status!: HrContractStatus;
  @Column({ type: 'timestamptz', nullable: true }) signed_at!: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) terminated_at!: Date | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) termination_reason!: string | null;
  @Column({ type: 'int', default: 0 }) renewal_count!: number;
  @Column({ type: 'numeric', precision: 15, scale: 2, nullable: true, transformer: { to: (v: any) => v, from: (v: any) => v } })
  anapec_subsidy_amount!: string | null;
  @CreateDateColumn({ type: 'timestamptz' }) created_at!: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at!: Date;
}
```

### 6.5 Utils `ma-validators.ts`

```typescript
// repo/packages/hr/src/utils/ma-validators.ts
// Skalean InsurTech v2.2 -- Validators MA-specific (CIN, CNSS, SMIG)
// Reference : B-13 Sprint 13 Tache 3.6.9
import { z } from 'zod';

/**
 * CIN MA : 1-2 lettres + 1-6 chiffres, uppercase
 * Exemples valides : BE123456, A1234, J567890, JM45678
 */
export const CinMaSchema = z
  .string()
  .min(2)
  .max(8)
  .regex(/^[A-Z]{1,2}\d{1,6}$/, { message: 'CIN must match MA format : 1-2 letters + 1-6 digits' });

export function normalizeCin(input: string): string {
  return input.toUpperCase().trim().replace(/\s+/g, '');
}

export function validateCin(input: string): { valid: boolean; normalized?: string; error?: string } {
  const normalized = normalizeCin(input);
  const result = CinMaSchema.safeParse(normalized);
  if (!result.success) return { valid: false, error: result.error.issues[0].message };
  return { valid: true, normalized };
}

/**
 * CNSS numero : exactement 9 chiffres
 */
export const CnssNumberSchema = z
  .string()
  .regex(/^\d{9}$/, { message: 'CNSS number must be exactly 9 digits' });

export function validateCnss(input: string): { valid: boolean; error?: string } {
  const result = CnssNumberSchema.safeParse(input.trim());
  return result.success ? { valid: true } : { valid: false, error: result.error.issues[0].message };
}

/**
 * SMIG 2026 : 2 970 MAD/mois standard (non-agricole).
 * Source : decret 2023 + indexation. A revisiter annuellement.
 */
export const SMIG_2026_MAD = 2970;

export function validateSalary(salary: number, smig = SMIG_2026_MAD): { valid: boolean; error?: string } {
  if (typeof salary !== 'number' || isNaN(salary)) {
    return { valid: false, error: 'Salary must be a number' };
  }
  if (salary < smig) {
    return { valid: false, error: `Salary ${salary} MAD is below SMIG ${smig} MAD/mois` };
  }
  if (salary > 1_000_000) {
    return { valid: false, error: 'Salary exceeds reasonable maximum (1M MAD/mois)' };
  }
  return { valid: true };
}

/**
 * IBAN MA format : MA + 2 chiffres cle + 24 chiffres BBAN = 28 caracteres total
 */
export const IbanMaSchema = z
  .string()
  .regex(/^MA\d{26}$/, { message: 'IBAN MA must be 28 characters : MA + 26 digits' });

export function validateIbanMa(input: string): { valid: boolean; error?: string } {
  const cleaned = input.replace(/\s/g, '').toUpperCase();
  const result = IbanMaSchema.safeParse(cleaned);
  return result.success ? { valid: true } : { valid: false, error: result.error.issues[0].message };
}
```

### 6.6 DTOs Zod

```typescript
// repo/packages/hr/src/dto/create-employee.dto.ts
import { z } from 'zod';
import { CinMaSchema, CnssNumberSchema, SMIG_2026_MAD } from '../utils/ma-validators';

export const CreateEmployeeSchema = z.object({
  user_id: z.string().uuid().optional(),
  full_name: z.string().min(2).max(255),
  cin: CinMaSchema,
  cnss_number: CnssNumberSchema.optional(),
  gender: z.enum(['M', 'F', 'undisclosed']),
  date_of_birth: z.coerce.date().refine((d) => {
    const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 15 && age <= 80;
  }, { message: 'Age must be 15-80 years' }),
  hired_date: z.coerce.date().refine((d) => d <= new Date(), { message: 'hired_date cannot be future' }),
  department: z.string().max(64).optional(),
  position: z.string().max(128).optional(),
  base_salary: z.coerce.number().min(SMIG_2026_MAD).max(1000000),
  family_children: z.coerce.number().int().min(0).max(20).default(0),
  bank_iban: z.string().max(64).optional(),
  phone: z.string().max(32).optional(),
  email: z.string().email().max(255).optional(),
  address: z.string().max(2000).optional(),
  photo_url: z.string().url().optional(),
});
export type CreateEmployeeDto = z.infer<typeof CreateEmployeeSchema>;

// repo/packages/hr/src/dto/create-contract.dto.ts
export const CreateContractSchema = z.object({
  employee_id: z.string().uuid(),
  contract_type: z.enum(['cdi', 'cdd', 'anapec', 'stage', 'freelance']),
  start_date: z.coerce.date(),
  end_date: z.coerce.date().optional(),
  monthly_salary: z.coerce.number().min(SMIG_2026_MAD),
  working_hours_week: z.coerce.number().int().min(1).max(48).default(44),
  trial_period_months: z.coerce.number().int().min(0).max(3).default(0),
  salary_components: z.object({
    prime_anciennete: z.number().min(0).optional(),
    prime_rendement: z.number().min(0).optional(),
    indemnite_transport: z.number().min(0).optional(),
  }).optional(),
  anapec_subsidy_amount: z.coerce.number().min(0).optional(),
}).refine((data) => {
  if (data.contract_type === 'cdi' && data.end_date) {
    return false;
  }
  if (data.contract_type === 'cdd' && !data.end_date) {
    return false;
  }
  return true;
}, { message: 'CDI cannot have end_date ; CDD must have end_date' });
export type CreateContractDto = z.infer<typeof CreateContractSchema>;

// repo/packages/hr/src/dto/terminate-employee.dto.ts
export const TerminateEmployeeSchema = z.object({
  terminated_date: z.coerce.date(),
  termination_reason: z.string().min(10).max(500),
});
export type TerminateEmployeeDto = z.infer<typeof TerminateEmployeeSchema>;
```

### 6.7 Service `employees.service.ts`

```typescript
import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { HrEmployee } from '../entities/hr-employee.entity';
import { CreateEmployeeDto } from '../dto/create-employee.dto';
import { TerminateEmployeeDto } from '../dto/terminate-employee.dto';
import { normalizeCin } from '../utils/ma-validators';

interface KafkaPublisher { publish(topic: string, payload: any): Promise<void>; }

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(
    @InjectRepository(HrEmployee) private readonly repo: Repository<HrEmployee>,
    private readonly kafka: KafkaPublisher,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateEmployeeDto): Promise<HrEmployee> {
    const cin = normalizeCin(dto.cin);
    // Check duplicate CIN
    const existing = await this.repo.findOne({ where: { tenant_id: tenantId, cin, deleted_at: IsNull() } });
    if (existing) {
      throw new ConflictException(`Employee with CIN ${cin} already exists in this tenant`);
    }
    const employee = this.repo.create({
      tenant_id: tenantId,
      user_id: dto.user_id ?? null,
      full_name: dto.full_name,
      cin,
      cnss_number: dto.cnss_number ?? null,
      gender: dto.gender,
      date_of_birth: dto.date_of_birth,
      hired_date: dto.hired_date,
      department: dto.department ?? null,
      position: dto.position ?? null,
      base_salary: String(dto.base_salary),
      family_children: dto.family_children ?? 0,
      bank_iban: dto.bank_iban ?? null,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      address: dto.address ?? null,
      photo_url: dto.photo_url ?? null,
      active: true,
    });
    const saved = await this.repo.save(employee);
    
    await this.kafka.publish('insurtech.events.hr.employee_hired', {
      tenant_id: tenantId,
      employee_id: saved.id,
      cin: saved.cin,
      hired_date: saved.hired_date,
      created_by_user_id: userId,
    });

    this.logger.log({
      action: 'hr_employee_created',
      tenant_id: tenantId,
      employee_id: saved.id,
      cin,
    });
    return saved;
  }

  async findOne(tenantId: string, id: string): Promise<HrEmployee> {
    const e = await this.repo.findOne({ where: { id, tenant_id: tenantId, deleted_at: IsNull() } });
    if (!e) throw new NotFoundException(`Employee ${id} not found`);
    return e;
  }

  async list(tenantId: string, filters: { department?: string; active?: boolean; search?: string; limit?: number; offset?: number }): Promise<{ employees: HrEmployee[]; total: number }> {
    const qb = this.repo.createQueryBuilder('e')
      .where('e.tenant_id = :t', { t: tenantId })
      .andWhere('e.deleted_at IS NULL');
    if (filters.department) qb.andWhere('e.department = :dep', { dep: filters.department });
    if (filters.active !== undefined) qb.andWhere('e.active = :a', { a: filters.active });
    if (filters.search) qb.andWhere('(e.full_name ILIKE :s OR e.cin ILIKE :s)', { s: `%${filters.search}%` });
    const total = await qb.getCount();
    const employees = await qb.orderBy('e.full_name', 'ASC').limit(filters.limit ?? 50).offset(filters.offset ?? 0).getMany();
    return { employees, total };
  }

  async update(tenantId: string, id: string, patch: Partial<CreateEmployeeDto>): Promise<HrEmployee> {
    const e = await this.findOne(tenantId, id);
    if (patch.cin && patch.cin !== e.cin) {
      const cin = normalizeCin(patch.cin);
      const conflict = await this.repo.findOne({ where: { tenant_id: tenantId, cin, deleted_at: IsNull() } });
      if (conflict && conflict.id !== id) throw new ConflictException(`CIN ${cin} already exists`);
      e.cin = cin;
    }
    Object.assign(e, patch, { cin: e.cin });
    return this.repo.save(e);
  }

  async terminate(tenantId: string, userId: string, id: string, dto: TerminateEmployeeDto): Promise<HrEmployee> {
    const e = await this.findOne(tenantId, id);
    if (!e.active) {
      throw new BadRequestException(`Employee ${id} is already terminated`);
    }
    if (dto.terminated_date < e.hired_date) {
      throw new BadRequestException('terminated_date cannot be before hired_date');
    }
    e.active = false;
    e.terminated_date = dto.terminated_date;
    e.termination_reason = dto.termination_reason;
    const saved = await this.repo.save(e);
    
    await this.kafka.publish('insurtech.events.hr.employee_terminated', {
      tenant_id: tenantId,
      employee_id: saved.id,
      cin: saved.cin,
      hired_date: saved.hired_date,
      terminated_date: saved.terminated_date,
      reason: saved.termination_reason,
      terminated_by_user_id: userId,
    });

    this.logger.log({
      action: 'hr_employee_terminated',
      tenant_id: tenantId,
      employee_id: id,
      terminated_date: saved.terminated_date,
    });
    return saved;
  }

  async softDelete(tenantId: string, id: string): Promise<void> {
    const e = await this.findOne(tenantId, id);
    e.deleted_at = new Date();
    e.active = false;
    await this.repo.save(e);
  }
}
```

### 6.8 Service `contracts.service.ts`

```typescript
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HrContract } from '../entities/hr-contract.entity';
import { CreateContractDto } from '../dto/create-contract.dto';

interface KafkaPublisher { publish(topic: string, payload: any): Promise<void>; }

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectRepository(HrContract) private readonly repo: Repository<HrContract>,
    private readonly kafka: KafkaPublisher,
  ) {}

  async create(tenantId: string, userId: string, dto: CreateContractDto): Promise<HrContract> {
    // Verify CDD max 2 years
    if (dto.contract_type === 'cdd' && dto.end_date) {
      const months = (dto.end_date.getTime() - dto.start_date.getTime()) / (30 * 24 * 3600 * 1000);
      if (months > 24) throw new BadRequestException('CDD duration cannot exceed 24 months (loi 65-99)');
    }

    // Verify no active contract overlap
    const active = await this.repo.findOne({
      where: { employee_id: dto.employee_id, tenant_id: tenantId, status: 'active' },
    });
    if (active) {
      throw new BadRequestException(`Employee already has active contract ${active.id}. Terminate first.`);
    }

    const c = this.repo.create({
      tenant_id: tenantId,
      employee_id: dto.employee_id,
      contract_type: dto.contract_type,
      start_date: dto.start_date,
      end_date: dto.end_date ?? null,
      monthly_salary: String(dto.monthly_salary),
      working_hours_week: dto.working_hours_week,
      trial_period_months: dto.trial_period_months,
      salary_components: dto.salary_components ?? null,
      anapec_subsidy_amount: dto.anapec_subsidy_amount ? String(dto.anapec_subsidy_amount) : null,
      status: 'draft',
    });
    const saved = await this.repo.save(c);
    this.logger.log({
      action: 'hr_contract_created',
      tenant_id: tenantId,
      contract_id: saved.id,
      type: dto.contract_type,
    });
    return saved;
  }

  async activate(tenantId: string, contractId: string): Promise<HrContract> {
    const c = await this.findOne(tenantId, contractId);
    if (c.status !== 'draft') throw new BadRequestException(`Cannot activate contract in status ${c.status}`);
    c.status = 'active';
    c.signed_at = new Date();
    const saved = await this.repo.save(c);
    
    await this.kafka.publish('insurtech.events.hr.contract_signed', {
      tenant_id: tenantId,
      contract_id: saved.id,
      employee_id: saved.employee_id,
      type: saved.contract_type,
      start_date: saved.start_date,
      end_date: saved.end_date,
      monthly_salary: saved.monthly_salary,
    });
    return saved;
  }

  async terminate(tenantId: string, userId: string, contractId: string, reason: string): Promise<HrContract> {
    const c = await this.findOne(tenantId, contractId);
    if (c.status !== 'active') throw new BadRequestException(`Cannot terminate contract in status ${c.status}`);
    if (reason.length < 10) throw new BadRequestException('Termination reason must be at least 10 chars');
    c.status = 'terminated';
    c.terminated_at = new Date();
    c.termination_reason = reason;
    const saved = await this.repo.save(c);

    await this.kafka.publish('insurtech.events.hr.contract_terminated', {
      tenant_id: tenantId,
      contract_id: saved.id,
      employee_id: saved.employee_id,
      reason,
      terminated_at: saved.terminated_at,
      terminated_by_user_id: userId,
    });
    return saved;
  }

  async renew(tenantId: string, contractId: string, newEndDate: Date): Promise<HrContract> {
    const c = await this.findOne(tenantId, contractId);
    if (c.contract_type !== 'cdd') throw new BadRequestException('Only CDD can be renewed (loi 65-99)');
    if (c.renewal_count >= 1) throw new BadRequestException('CDD can be renewed only once');
    if (c.status !== 'active') throw new BadRequestException(`Cannot renew contract in status ${c.status}`);
    
    c.end_date = newEndDate;
    c.renewal_count = c.renewal_count + 1;
    const totalMonths = (newEndDate.getTime() - c.start_date.getTime()) / (30 * 24 * 3600 * 1000);
    if (totalMonths > 24) throw new BadRequestException('Total CDD duration cannot exceed 24 months after renewal');
    const saved = await this.repo.save(c);

    await this.kafka.publish('insurtech.events.hr.contract_renewed', {
      tenant_id: tenantId,
      contract_id: saved.id,
      employee_id: saved.employee_id,
      new_end_date: newEndDate,
      renewal_count: saved.renewal_count,
    });
    return saved;
  }

  async findOne(tenantId: string, id: string): Promise<HrContract> {
    const c = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!c) throw new NotFoundException(`Contract ${id} not found`);
    return c;
  }

  async listByEmployee(tenantId: string, employeeId: string): Promise<HrContract[]> {
    return this.repo.find({
      where: { tenant_id: tenantId, employee_id: employeeId },
      order: { start_date: 'DESC' },
    });
  }
}
```

### 6.9 Controller `employees.controller.ts`

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, CurrentTenantId, CurrentUserId } from '@insurtech/auth';
import { EmployeesService, CreateEmployeeSchema, TerminateEmployeeSchema } from '@insurtech/hr';
import { ContractsService, CreateContractSchema } from '@insurtech/hr';

@Controller('api/v1/hr/employees')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly contracts: ContractsService,
  ) {}

  @Post()
  @Roles('hr.employees.create')
  async create(@CurrentTenantId() tenantId: string, @CurrentUserId() userId: string, @Body() body: unknown) {
    const dto = CreateEmployeeSchema.parse(body);
    return this.employees.create(tenantId, userId, dto);
  }

  @Get()
  @Roles('hr.employees.read')
  async list(@CurrentTenantId() tenantId: string, @Query() q: any) {
    return this.employees.list(tenantId, {
      department: q.department,
      active: q.active === 'true' ? true : q.active === 'false' ? false : undefined,
      search: q.search,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
  }

  @Get(':id')
  @Roles('hr.employees.read')
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.employees.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles('hr.employees.update')
  async update(@CurrentTenantId() tenantId: string, @Param('id') id: string, @Body() body: any) {
    return this.employees.update(tenantId, id, body);
  }

  @Post(':id/terminate')
  @Roles('hr.employees.update')
  async terminate(@CurrentTenantId() tenantId: string, @CurrentUserId() userId: string, @Param('id') id: string, @Body() body: unknown) {
    const dto = TerminateEmployeeSchema.parse(body);
    return this.employees.terminate(tenantId, userId, id, dto);
  }

  @Post(':id/contracts')
  @Roles('hr.contracts.create')
  async createContract(@CurrentTenantId() tenantId: string, @CurrentUserId() userId: string, @Param('id') employeeId: string, @Body() body: unknown) {
    const dto = CreateContractSchema.parse({ ...(body as object), employee_id: employeeId });
    return this.contracts.create(tenantId, userId, dto);
  }

  @Get(':id/contracts')
  @Roles('hr.contracts.read')
  async listContracts(@CurrentTenantId() tenantId: string, @Param('id') employeeId: string) {
    return this.contracts.listByEmployee(tenantId, employeeId);
  }

  @Delete(':id')
  @Roles('hr.employees.delete')
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    await this.employees.softDelete(tenantId, id);
    return { deleted: true, id };
  }
}
```

---

## 7. Tests

### 7.1 Tests `employees.service.spec.ts` (13 cas)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmployeesService } from './employees.service';
import { HrEmployee } from '../entities/hr-employee.entity';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('EmployeesService', () => {
  let svc: EmployeesService;
  let repo: any; let kafka: any;

  beforeEach(async () => {
    repo = {
      findOne: vi.fn(), find: vi.fn(), create: vi.fn((d) => d), save: vi.fn((d) => Promise.resolve({ ...d, id: 'gen-id' })),
      createQueryBuilder: vi.fn(() => ({
        where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), offset: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0), getMany: vi.fn().mockResolvedValue([]),
      })),
    };
    kafka = { publish: vi.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: getRepositoryToken(HrEmployee), useValue: repo },
        { provide: 'KafkaPublisher', useValue: kafka },
      ],
    })
    .overrideProvider(EmployeesService)
    .useValue(new EmployeesService(repo, kafka))
    .compile();
    svc = mod.get(EmployeesService);
  });

  it('create normalizes CIN to uppercase no spaces', async () => {
    repo.findOne.mockResolvedValue(null);
    const r = await svc.create('t', 'u', {
      full_name: 'Test', cin: 'be 123456 ', gender: 'M',
      date_of_birth: new Date('1990-01-01'), hired_date: new Date('2020-01-01'),
      base_salary: 5000, family_children: 0,
    } as any);
    expect(r.cin).toBe('BE123456');
  });

  it('create rejects duplicate CIN', async () => {
    repo.findOne.mockResolvedValue({ id: 'existing' });
    await expect(svc.create('t', 'u', {
      full_name: 'Test', cin: 'BE123456', gender: 'M',
      date_of_birth: new Date('1990-01-01'), hired_date: new Date('2020-01-01'),
      base_salary: 5000, family_children: 0,
    } as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('create publishes Kafka event', async () => {
    repo.findOne.mockResolvedValue(null);
    await svc.create('t', 'u', {
      full_name: 'Test', cin: 'A1', gender: 'M',
      date_of_birth: new Date('1990-01-01'), hired_date: new Date('2020-01-01'),
      base_salary: 5000, family_children: 0,
    } as any);
    expect(kafka.publish).toHaveBeenCalledWith('insurtech.events.hr.employee_hired', expect.objectContaining({
      tenant_id: 't',
    }));
  });

  it('findOne throws NotFound when not found', async () => {
    repo.findOne.mockResolvedValue(null);
    await expect(svc.findOne('t', 'unknown')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findOne returns employee', async () => {
    repo.findOne.mockResolvedValue({ id: 'e1', active: true });
    const r = await svc.findOne('t', 'e1');
    expect(r.id).toBe('e1');
  });

  it('terminate sets active=false', async () => {
    const employee = { id: 'e1', active: true, hired_date: new Date('2020-01-01') };
    repo.findOne.mockResolvedValue(employee);
    repo.save.mockImplementation((e: any) => Promise.resolve(e));
    const r = await svc.terminate('t', 'u', 'e1', { terminated_date: new Date('2026-01-01'), termination_reason: 'End of contract' });
    expect(r.active).toBe(false);
    expect(r.terminated_date).toEqual(new Date('2026-01-01'));
  });

  it('terminate rejects if already terminated', async () => {
    repo.findOne.mockResolvedValue({ id: 'e1', active: false });
    await expect(svc.terminate('t', 'u', 'e1', { terminated_date: new Date(), termination_reason: 'reason long enough' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('terminate rejects date < hired_date', async () => {
    repo.findOne.mockResolvedValue({ id: 'e1', active: true, hired_date: new Date('2026-01-01') });
    await expect(svc.terminate('t', 'u', 'e1', { terminated_date: new Date('2025-01-01'), termination_reason: 'reason ten chars' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('terminate publishes Kafka event', async () => {
    repo.findOne.mockResolvedValue({ id: 'e1', active: true, hired_date: new Date('2020-01-01') });
    repo.save.mockImplementation((e: any) => Promise.resolve(e));
    await svc.terminate('t', 'u', 'e1', { terminated_date: new Date('2026-01-01'), termination_reason: 'End of contract' });
    expect(kafka.publish).toHaveBeenCalledWith('insurtech.events.hr.employee_terminated', expect.any(Object));
  });

  it('list applies department filter', async () => {
    await svc.list('t', { department: 'Atelier' });
    const qb = repo.createQueryBuilder.mock.results[0].value;
    expect(qb.andWhere).toHaveBeenCalledWith('e.department = :dep', { dep: 'Atelier' });
  });

  it('list applies search ILIKE on full_name and CIN', async () => {
    await svc.list('t', { search: 'Bennani' });
    const qb = repo.createQueryBuilder.mock.results[0].value;
    expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), expect.objectContaining({ s: '%Bennani%' }));
  });

  it('update normalizes CIN on patch', async () => {
    repo.findOne.mockResolvedValue({ id: 'e1', cin: 'A1', active: true });
    repo.findOne.mockResolvedValueOnce({ id: 'e1', cin: 'A1', active: true });
    repo.findOne.mockResolvedValueOnce(null);                              // no conflict
    repo.save.mockImplementation((e: any) => Promise.resolve(e));
    const r = await svc.update('t', 'e1', { cin: 'b2' } as any);
    expect(r.cin).toBe('B2');
  });

  it('softDelete sets active=false and deleted_at', async () => {
    repo.findOne.mockResolvedValue({ id: 'e1', active: true });
    repo.save.mockImplementation((e: any) => Promise.resolve(e));
    await svc.softDelete('t', 'e1');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ active: false, deleted_at: expect.any(Date) }));
  });
});
```

---

## 8. Variables environnement

```env
HR_SMIG_MAD=2970
HR_DEFAULT_WORKING_HOURS=44
HR_CDD_MAX_MONTHS=24
HR_CDI_TRIAL_MAX_MONTHS=3
```

---

## 9. Commandes shell

```bash
pnpm --filter @insurtech/database migration:run
pnpm --filter @insurtech/hr test
pnpm --filter @insurtech/api test:e2e -- employees

curl -X POST http://localhost:4000/api/v1/hr/employees \
  -H "Authorization: Bearer $TOKEN" -H "x-tenant-id: $TENANT" \
  -H "Content-Type: application/json" \
  -d '{
    "full_name":"Rachid Bennani","cin":"BE123456","cnss_number":"123456789",
    "gender":"M","date_of_birth":"1985-06-15","hired_date":"2026-06-01",
    "department":"Atelier","position":"Mecanicien chef","base_salary":7500,"family_children":2,
    "phone":"+212600123456","email":"rachid@garage.ma"
  }'
```

---

## 10. Criteres validation V1-V22

### P0 (14)
- V1 : Migrations crees tables + enums + triggers
- V2 : RLS active hr_employees + hr_contracts
- V3 : Trigger single_active_contract empeche overlap
- V4 : CIN format MA `^[A-Z]{1,2}\d{1,6}$` valide
- V5 : CNSS format 9 digits valide
- V6 : Salary >= SMIG 2970 MAD rejette inferieur
- V7 : DOB > 15 ans rejected
- V8 : hired_date > date_of_birth + 15 ans
- V9 : CDI no end_date enforced
- V10 : CDD end_date enforced + max 24 mois
- V11 : Trial period max 3 mois CDI / 1 mois CDD
- V12 : Kafka events hr.employee_hired/terminated, hr.contract_signed/terminated/renewed
- V13 : Multi-tenant isolation
- V14 : RBAC hr.employees.* + hr.contracts.* enforced

### P1 (5)
- V15 : Search FTS GIN sur full_name
- V16 : Termination workflow + reason >= 10 chars
- V17 : CDD renewal max 1 fois
- V18 : ANAPEC subsidy field
- V19 : Coverage >= 85%

### P2 (3)
- V20 : IBAN MA validate format
- V21 : Tests E2E + RBAC
- V22 : Documentation API

---

## 11. Edge cases

1. **Employee re-hired** -> nouvel employee record, old reste avec deleted_at.
2. **CIN change officiel** -> rare, autorise via PATCH avec audit.
3. **Contract overlap mid-update** -> trigger PG bloque.
4. **CDD renewal 2eme fois** -> service reject.
5. **Salary update sur contract active** -> avenant (Sprint 35+).
6. **DOB date 1900-01-01** -> > 100 ans, autorise mais flag.
7. **Multi-children > 6** -> autorise mais IR plafonne 6 (Tache 3.6.11).
8. **Hired_date weekend** -> autorise.

---

## 12. Conformite Maroc

- **Loi 65-99 Code Travail** : CDD max 2 ans, periode essai, 44h/sem.
- **CNSS** : declaration obligatoire dans 8 jours (Sprint 35 integration API).
- **SMIG 2970 MAD/mois** (decret 2023 + indexation).
- **ANAPEC** : subvention jeunes diplomes (decret).
- **Loi 09-08 CNDP** : donnees personnelles (CIN, CNSS, DOB, salary) sensibles, data MA only.

---

## 13. Conventions

Multi-tenant, Zod, Pino, pnpm, TS strict, Vitest, RBAC, Kafka, decision-006, decision-008.

---

## 14. Validation pre-commit

```bash
pnpm --filter @insurtech/hr typecheck
pnpm --filter @insurtech/hr test:coverage
pnpm --filter @insurtech/database migration:run
```

---

## 15. Commit message

```bash
git commit -m "feat(sprint-13): HR employees + contrats CDI/CDD/ANAPEC + validations MA

Sprint 13 Tache 3.6.9 : 2 migrations + 2 entities + 2 services + controller +
validators MA (CIN, CNSS, SMIG, IBAN) + Kafka events.

Livrables :
- Migrations hr_employees + hr_contracts (enums, triggers, CHECK)
- HrEmployee + HrContract entities
- EmployeesService + ContractsService (CRUD + termination + renewal)
- ma-validators.ts (CIN, CNSS, SMIG, IBAN)
- 4 DTOs Zod
- EmployeesController + ContractsController REST + RBAC
- Kafka events hr.employee_hired/terminated, hr.contract_signed/renewed
- 28 tests (13+9+6 E2E)

Tests: 28
Coverage: 88%

Task: 3.6.9
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.9"
```

---

## 16. Workflow next step

Tache suivante : `task-3.6.10-hr-conges-workflow-approval.md`.

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Specifications complete des 5 types de contrats MA

#### A.1 CDI (Contrat a Duree Indeterminee)

**Reference legale** : Article 13 loi 65-99 + decrets application.

| Caracteristique | Specification |
|------------------|----------------|
| Duree | Indeterminee (pas de date fin) |
| Periode essai cadres | 3 mois max |
| Periode essai employes | 1.5 mois max |
| Periode essai ouvriers | 15 jours max |
| Renouvellement essai | 1x autorise (meme duree) |
| Licenciement | Motif legitime + procedure stricte (art 35) |
| Indemnite licenciement | 1.5 mois par an apres 5 ans anciennete |
| Preavis demission | 1 mois minimum (max 3 mois selon poste) |

#### A.2 CDD (Contrat a Duree Determinee)

**Reference** : Articles 16-22 loi 65-99.

| Caracteristique | Specification |
|------------------|----------------|
| Duree initiale max | 1 an |
| Renouvellement | 1x maximum |
| Duree totale max | 2 ans cumules |
| Periode essai | 1.5 mois max |
| Cas legaux autorises | Remplacement, surcharge temporaire, travail saisonnier, projet specifique |
| Indemnite fin contrat | 7.5% salaire brut total (sauf si CDI directement apres) |

**Requalification CDI** : si CDD prolonge au-dela 2 ans OU sans motif legal, requalification judiciaire automatique (art 17).

#### A.3 ANAPEC (Programme Idmaj subventionne)

**Reference** : Decret 2-12-636 + convention CNSS.

| Caracteristique | Specification |
|------------------|----------------|
| Eligibilite candidat | Moins de 35 ans, diplome >= BAC+2, premier emploi |
| Subvention employer | CNSS + AMO patronales prises en charge par ANAPEC |
| Montant subvention | ~1 600 MAD/mois pendant 12-24 mois |
| Duree contrat min | 12 mois |
| Duree contrat max | 24 mois |
| Condition non-licenciement | Engagement employeur conserver salarie 6 mois apres fin subvention |

#### A.4 Stage

**Reference** : Article 25 loi 65-99 + decret 2-13-235.

| Caracteristique | Specification |
|------------------|----------------|
| Duree max | 6 mois |
| Indemnite min | 1 600 MAD/mois (depuis 2023) |
| Convention tripartite | Stagiaire + Entreprise + Etablissement enseignement |
| Cotisations | Optionnelles (encouragees) |

#### A.5 Freelance / Consultant

Sprint 13 : `contract_type = 'freelance'` mais traitement special :
- Pas de cotisations CNSS/AMO (auto-entrepreneur ou societe consultant)
- Facturation honoraires (Sprint 12 Books invoice) au lieu de payslip
- Pas de paie generee automatique

### B. Champs additionnels Sprint 35 (preparation)

Future migrations Sprint 35 ajouteront a `hr_contracts` :
- `cimr_rate` (taux CIMR retraite complementaire 3-6%)
- `mutual_complementaire_id` (mutuelle sante complementaire)
- `transport_allowance` (indemnite transport mensuelle)
- `meal_vouchers_count` (tickets restaurant)
- `phone_allowance` (forfait telephone)
- `parking_card` (carte parking pro)
- `company_car_id` (vehicule fonction)

### C. Tests supplementaires (15 cas)

```typescript
describe('EmployeesService + ContractsService -- tests avances', () => {
  it('CIN avec espaces normalize -> uppercase no spaces', async () => {
    // 'be 123456 ' -> 'BE123456'
  });
  it('CIN lowercase -> uppercase', async () => { });
  it('CIN unique per tenant (allow same CIN cross-tenant)', async () => { });
  it('CNSS format strict 9 digits exact', async () => { });
  it('Salaire SMIG exact 2970 -> accept', async () => { });
  it('Salaire 2969 -> reject CHECK constraint', async () => { });
  it('DOB futur -> reject', async () => { });
  it('Hired before 15 ans (loi enfants) -> reject', async () => { });
  it('CDD with end_date null -> CHECK fail', async () => { });
  it('CDI with end_date -> CHECK fail', async () => { });
  it('CDD duration > 2 ans -> CHECK fail', async () => { });
  it('CDD renewal 2eme fois -> service reject', async () => { });
  it('Active contract overlap same employee -> trigger fail', async () => { });
  it('Family children 21 -> reject (CHECK <= 20)', async () => { });
  it('Termination date < hired_date -> reject', async () => { });
});
```

### D. Edge cases supplementaires (15 cas)

1. Embauche conjoint dans meme tenant -> autorise (CIN different).
2. Embauche personne avec ancien CIN deja inactive -> reactiver vs create new.
3. CIN avec lettres minuscules -> normalize upper.
4. CIN avec accents (rare) -> reject.
5. Salaire en centimes (4500.5 MAD) -> autorise.
6. Date naissance 1900 -> warning age > 100.
7. Embauche retroactive 2 ans -> autoriser mais flag (Sprint 35 audit).
8. CNSS number provisional -> autoriser empty puis declaration ulterieure.
9. ANAPEC subsidy expire mi-contrat -> Sprint 35 alert + update employer cost.
10. Contract CDI succede directement a CDD -> NO indemnite 7.5% (clause exempte).
11. Maternite pendant essai -> period essai suspendue (Sprint 35).
12. Demission pendant essai -> pas indemnite, preavis 8 jours.
13. Force majeure (catastrophe naturelle) -> rupture sans indemnite (art 35 bis).
14. Faute grave -> licenciement sans indemnite (art 39).
15. Demenagement tenant -> contracts conserves, change site dans metadata (Sprint 35).

### E. Conformite Maroc detaillee

- **Article 6** : embauche d'un mineur de moins de 15 ans interdite -> CHECK DOB.
- **Article 14** : Convention collective applicable si tenant >= 10 employees + secteur conventionne.
- **Article 15** : declaration prealable embauche INSEE Maroc (Sprint 35 integration).
- **Article 18** : duree max travail 44h/semaine, 10h/jour, 12h heures sup max/sem.
- **CNSS** : declaration 8 jours apres embauche obligatoire (penalite si retard).
- **DGI** : declaration salaires mensuelle <20 du mois suivant.
- **Inspection Travail** : registre du personnel obligatoire (Sprint 35 export PDF).

### F. Workflow Kafka events HR

```
hr.employee_hired       -> Comm: send welcome email
                        -> Books: create employee in ledger
                        -> Compliance: schedule CNSS declaration in 7 days
                        -> Analytics: ingest dim_employees

hr.employee_terminated  -> Comm: send termination notice
                        -> Books: compute indemnite + last payslip
                        -> Compliance: notify CNSS

hr.contract_signed      -> Docs: generate contract PDF
                        -> Signature: request employee signature
                        -> Comm: send contract PDF
                        
hr.contract_renewed     -> Compliance: record renewal (CDD 1x max)
                        -> Comm: send notice

hr.contract_terminated  -> Books: indemnite if applicable
                        -> Comm: certificate travail
```

### G. Validation pre-commit etendue

```bash
# 1. CHECK constraints verifiables
psql $DATABASE_URL -c "\d hr_employees"
psql $DATABASE_URL -c "\d hr_contracts"

# 2. Trigger anti-cycle stock OK
# 3. Trigger single_active_contract OK
psql $DATABASE_URL -c "SELECT tgname FROM pg_trigger WHERE tgrelid = 'hr_contracts'::regclass"

# 4. Permissions seed
grep "hr.employees" repo/packages/auth/src/seeds/permissions/hr.ts
grep "hr.contracts" repo/packages/auth/src/seeds/permissions/hr.ts
```

---

**Fin enrichissement task-3.6.9.**

**Fin task-3.6.9-hr-employees-contrats-cdi-cdd-anapec.md.**

## ANNEXE A -- Patterns transverses Sprint 13 (conventions communes)

### A.1 Multi-tenant strict (decision-002)

Toutes les operations Sprint 13 doivent inclure tenant_id filter strict :
- Postgres : trigger RLS app.current_tenant via SET LOCAL
- ClickHouse : tenant_id dans ORDER BY pour partition pruning  
- Kafka : tenant_id obligatoire dans event payload
- Redis cache keys : prefixe tenant_id pour isolation cross-tenant impossible
- AsyncLocalStorage Node : TenantContext propage tenant_id sans param explicite
- Tests obligatoires : multi-tenant isolation (2 tenants -> 2 datasets distincts)

### A.2 Zod validation runtime stricte

Pattern uniforme partout Sprint 13 :

```typescript
const Schema = z.object({
  tenant_id: z.string().uuid(),
  field: z.string().min(1).max(255),
  amount: z.coerce.number().min(0),
  date: z.coerce.date(),
});
type Type = z.infer<typeof Schema>;

// Au controller :
const dto = Schema.parse(body);  // throws ZodError -> 400 automatic
```

JAMAIS class-validator/yup/joi -- decision conventions strictes.

### A.3 Pino logger structures

Format obligatoire pour tous logs metier :

```typescript
this.logger.log({
  action: 'snake_case_action_name',
  tenant_id: tid,
  user_id: uid,
  resource_id: rid,
  duration_ms: durationMs,
  outcome: 'success' | 'failed',
  metadata: { ... },
});
```

Permet :
- Datadog/Sentry parsing automatique
- Correlation logs cross-services
- Audit trail tenant_id systematique
- Performance monitoring duration_ms aggregations

JAMAIS console.log dans code production. Toleré uniquement dans scripts CLI infrastructure/scripts/*.

### A.4 Kafka events topics standardises

Format strict : `insurtech.events.{vertical_or_horizontal}.{entity}.{action_past}`

Topics Sprint 13 utilises :
- `insurtech.events.stock.movement_recorded` (Tache 3.6.6)
- `insurtech.events.stock.low_stock` (Tache 3.6.7)
- `insurtech.events.hr.employee_hired` (Tache 3.6.9)
- `insurtech.events.hr.employee_terminated` (Tache 3.6.9)
- `insurtech.events.hr.contract_signed` (Tache 3.6.9)
- `insurtech.events.hr.contract_renewed` (Tache 3.6.9)
- `insurtech.events.hr.contract_terminated` (Tache 3.6.9)
- `insurtech.events.hr.leave_requested` (Tache 3.6.10)
- `insurtech.events.hr.leave_approved` (Tache 3.6.10)
- `insurtech.events.hr.leave_rejected` (Tache 3.6.10)
- `insurtech.events.hr.leave_cancelled` (Tache 3.6.10)
- `insurtech.events.hr.payslip_generated` (Tache 3.6.11)
- `insurtech.events.hr.payslip_validated` (Tache 3.6.11)
- `insurtech.events.hr.payslip_paid` (Tache 3.6.11)
- `insurtech.events.analytics.etl_completed` (Tache 3.6.2)
- `insurtech.events.repair.parts_consumed` (Sprint 22 future, consume Tache 3.6.8)

### A.5 Idempotency-Key obligatoire mutations sensibles

Endpoints concernes Sprint 13 :
- POST /api/v1/stock/movements/entry
- POST /api/v1/stock/movements/exit
- POST /api/v1/stock/movements/adjustment
- POST /api/v1/stock/inventory-count
- POST /api/v1/hr/payroll/generate-period
- POST /api/v1/hr/payroll/payslips/:id/validate
- POST /api/v1/hr/payroll/payslips/:id/mark-paid

Pattern :

```
Header : Idempotency-Key: <uuid-v4>
Server check : SELECT WHERE tenant_id AND idempotency_key
Si exists : retourner reponse precedente (409 + ID si conflict)
Sinon : execute + store key 24h Redis OR UNIQUE constraint Postgres
TTL 24h pour replay safe
```


## ANNEXE B -- Conformite Maroc detaillee (rappel Sprint 13)

### B.1 Lois et decrets applicables Sprint 13

#### Loi 09-08 du 18 fevrier 2009 (CNDP)

- **Article 3** : definition donnees personnelles -- CIN, CNSS, salaire, DOB, email, IBAN, photo concerned.
- **Article 7** : transfert hors Maroc INTERDIT sans autorisation CNDP -> decision-008 Atlas Cloud Benguerir.
- **Article 13** : consentement -- embauche + signup CRM = consentement implicite stockage.
- **Article 14** : droit acces/rectification/suppression -- Sprint 35 portail employee self-service.
- **Article 21** : declaration obligatoire CNDP pour traitements automatises -- Sprint 35.

#### Loi 65-99 du 11 septembre 2003 (Code du Travail)

- **Articles 6-7** : embauche mineur < 15 ans interdite -> CHECK constraint.
- **Articles 14-17** : duree travail 44h/sem, repos hebdomadaire 24h continues.
- **Article 13** : CDI -- periode essai 3 mois cadres / 1.5 mois employes / 15j ouvriers.
- **Articles 16-22** : CDD max 1 an renouvelable 1 fois (max 2 ans cumules).
- **Article 152** : conges maternite 14 semaines, dont 6 obligatoires apres accouchement.
- **Article 269** : conges paternite 3 jours dans le mois.
- **Articles 231-251** : conges payes 1.5j/mois travaille, min 18j/an, max 30j.
- **Article 232** : 1.5j additionnel par bloc 5 ans anciennete.
- **Articles 35-39** : licenciement motif legitime + procedure + indemnite 1.5 mois/an apres 5 ans anciennete.
- **Article 254** : maladie -- certificat medical obligatoire > 4 jours.
- **Articles 41-46** : SMIG/SMAG salaire minimum legal.

#### Decret 2-22-742 du 14 fevrier 2023 (CNSS)

- **Article 5** : taux 4.48% employee + 8.98% employer (prestations long terme).
- **Article 5 bis** : taux 6.40% employer allocations familiales.
- **Article 6** : plafond cotisable 6 000 MAD/mois = 72 000 MAD/an.
- **Article 12** : declaration BPC mensuelle obligatoire avant le 10 du mois suivant.
- **Article 15** : declaration prealable embauche 8 jours apres recrutement.

#### Loi 65-00 du 3 octobre 2002 (AMO)

- **Article 12** : taux 2.26% employee + 4.11% employer.
- **Article 13** : assiette ensemble elements remuneration, pas de plafond.
- **Article 21** : exoneration partielle famille (Sprint 35).

#### Loi 47-06 du 30 novembre 2007 (Impot sur le Revenu)

- **Article 28** : frais professionnels 25% plafonne 35 000 MAD/an.
- **Article 73** : bareme IR 6 tranches MA 2026 (0% / 10% / 20% / 30% / 34% / 38%).
- **Article 74** : charges famille 360 MAD/an x enfants (max 6).
- **Article 78** : retenue source obligatoire employeur, declaration Etat 9421 annuelle.

#### Loi 9-88 modifiee 38-14 (Obligations comptables)

- **Article 18** : conservation 10 ans pieces comptables.
- **Article 32 CGNC** : valorisation stocks FIFO ou CMP (LIFO INTERDIT MA).

#### Decret SMIG 2023

- SMIG non-agricole : 2 970 MAD/mois (depuis revalorisation 2023).
- SMAG agricole : 80% SMIG.
- Implementation : CHECK constraint base_salary >= 2970.

#### Loi 53-05 du 30 novembre 2007 (Signature electronique)

- **Article 9** : conservation 10 ans signatures qualifiees -> TTL ClickHouse fct_documents_signed.

### B.2 Implementation Sprint 13 conformite

| Convention | Implementation Sprint 13 |
|------------|---------------------------|
| Data residency MA | Atlas Cloud Benguerir DC1 + DC2 replica |
| Encryption at rest | AES-256-GCM via Atlas KMS |
| Encryption in transit | TLS 1.3 obligatoire prod |
| Audit log | Pino structured logs + audit_logs table (Sprint 12) |
| Conservation 10 ans | TTL ClickHouse + partition Postgres Sprint 35 |
| Right to forget | Sprint 35 portail employee + soft delete |


## ANNEXE C -- Performance SLO Sprint 13

### C.1 Latences ciblees par categorie

#### Endpoints CRUD basiques (Stock items, HR employees, Categories)
- POST/PATCH/DELETE : p50 80ms / p95 200ms / p99 400ms
- GET single : p50 60ms / p95 150ms / p99 300ms
- GET list (50 items) : p50 100ms / p95 250ms / p99 500ms

#### Endpoints transactionnels (Stock movements, HR payslips)
- POST entry (1 lot) : p50 100ms / p95 250ms / p99 500ms
- POST exit FIFO (5 lots) : p50 250ms / p95 500ms / p99 900ms
- POST exit FIFO (10 lots) : p50 450ms / p95 850ms / p99 1.4s
- POST payslip validate : p50 150ms / p95 350ms / p99 700ms

#### Endpoints aggregation (Reports, Dashboards)
- GET valorisation 100 items : p50 200ms / p95 400ms / p99 800ms
- GET valorisation 1000 items : p50 800ms / p95 1.5s / p99 2.5s
- GET inventory historique date 6 mois ago : p50 1.5s / p95 3s / p99 5s
- GET dashboards revenue 1 an : p50 350ms / p95 700ms / p99 1.5s
- GET dashboards activity heatmap : p50 250ms / p95 500ms / p99 1s

#### Endpoints batch (Payroll generation, Inventory count)
- POST payroll generate 10 employees : p50 1.5s / p95 3s / p99 5s
- POST payroll generate 50 employees : p50 5s / p95 8s / p99 12s
- POST payroll generate 200 employees : p50 18s / p95 30s / p99 45s
- POST inventory-count 100 items : p50 3s / p95 6s / p99 10s
- POST inventory-count 1000 items : p50 12s / p95 25s / p99 40s

#### Endpoints export (CSV, XML, PDF)
- GET valorisation export.csv 1000 items : p50 1s / p95 2s / p99 4s
- GET CNSS declaration XML : p50 300ms / p95 600ms / p99 1s
- GET IR declaration CSV : p50 800ms / p95 1.5s / p99 3s
- GET payslip PDF : p50 800ms / p95 1.5s / p99 3s

### C.2 Throughput ciblesSprint 13 vs Sprint 35

| Operation | Sprint 13 RPS | Sprint 35 hardening RPS |
|-----------|----------------|---------------------------|
| Stock CRUD | 50 req/s | 500 req/s |
| Stock movements | 30 req/s | 300 req/s |
| HR CRUD | 20 req/s | 100 req/s |
| HR payroll generate | 1 req/s | 10 req/s |
| Analytics dashboards | 100 req/s | 1000 req/s |
| ETL polling cycle | 1 cycle/5min | Real-time CDC Debezium |

### C.3 Availability targets

- Sprint 13 : 99.5% (heures ouvrables 8h-20h Casablanca)
- Sprint 35 hardening : 99.9% (24/7)
- Window maintenance : 1h/semaine fenetre 3am-4am Casablanca
- RTO (Recovery Time Objective) : 1h Sprint 13 / 15min Sprint 35
- RPO (Recovery Point Objective) : 5min Sprint 13 / 1min Sprint 35

### C.4 Storage growth Sprint 13

Estimation pour 100 tenants moyens (50 employees + 1000 items + 200 movements/jour) :
- Postgres : +50 GB/an
- ClickHouse : +30 GB/an (compression columnar 5x)
- S3 documents (PDF, photos) : +20 GB/an
- Redis cache : +5 GB peak (TTL eviction)
- Kafka logs : +10 GB/an (retention 7 jours)
- Total : ~115 GB/an pour 100 tenants

### C.5 Monitoring metrics Prometheus

Sprint 13 expose metriques :
- `etl_rows_synced_total{table}` (Tache 3.6.2)
- `etl_duration_seconds{table}` (histogram)
- `etl_errors_total{table}` (counter)
- `stock_movements_total{tenant_id,type}` (Tache 3.6.6)
- `stock_alerts_sent_total{tenant_id,channel}` (Tache 3.6.7)
- `hr_payslips_generated_total{tenant_id,period}` (Tache 3.6.11)
- `hr_payslips_total_amount_mad{tenant_id}` (gauge)
- `clickhouse_query_duration_seconds{method}` (Tache 3.6.3)
- `analytics_cache_hits_total{method}` (counter)
- `analytics_cache_misses_total{method}` (counter)

Dashboards Grafana Sprint 35 :
- ETL lag par table
- API latencies par endpoint
- Cache hit ratio
- Stock movements volume par tenant
- Paie performance generation


## ANNEXE D -- Edge cases + troubleshooting Sprint 13

### D.1 Edge cases multi-tenant

1. **Tenant cree apres seed initial** : ETL Tache 3.6.2 inclut auto via full sync dim_tenants. Premier sync analytics peut etre vide pour ce tenant.
2. **Tenant churned** : ETL marque churned_at, dashboards filtrent active. Sprint 35 : retention 6 mois apres churn pour audit.
3. **Tenant fusion (acquisitions)** : Sprint 35 outil consolidation tenant cible. Sprint 13 = non supporte.
4. **Tenant split (separation)** : Sprint 35 outil migration partielle. Sprint 13 = manual.
5. **Tenant data residency exception** : Sprint 35 multi-region MA + EU pour clients europeens. Sprint 13 = MA only.

### D.2 Edge cases temps + dates

1. **Timezone Casablanca DST** : MA n'observe pas DST depuis 2018 (UTC+1 toute annee). Stockage UTC, presentation locale.
2. **Periode fiscale chevauchant** : MA = annee civile (1 jan - 31 dec). Pas de fiscal year offset.
3. **Date debut activite tenant futur** : autoriser, ETL skip jusqu'a date.
4. **Date naissance employee tres ancien (> 100 ans)** : warning flag, pas reject.
5. **Period payslip futur** : autoriser (planification), warning si > +6 mois.
6. **Period payslip passe > 5 ans** : warning + audit log.
7. **Movements occurred_at futur > 30 min** : Zod reject (anti-fraud).
8. **Movements occurred_at retroactif > 90 jours** : warning + audit.

### D.3 Edge cases concurrence + race conditions

1. **2 concurrent exits same item FIFO** : SELECT FOR UPDATE serialise -> 1 succeed first, 2nd INSUFFICIENT_STOCK ou succeed selon stock.
2. **2 concurrent payroll generate same period** : UNIQUE (tenant, employee, period) -> 1 succeed, 2nd 409 IDEMPOTENCY.
3. **2 concurrent leave requests same employee dates** : trigger PG anti-overlap rejette.
4. **2 concurrent contract activate same employee** : trigger single_active_contract rejette.
5. **Idempotency replay simultane** : UNIQUE constraint Postgres = 1 first wins.
6. **Kafka consumer parallel processing same event** : group_id partition = 1 consumer par partition (idempotent au niveau handler).

### D.4 Edge cases financiers (paie, stock valorisation)

1. **Salaire SMIG exact 2970** : net positif obligatoire (cotisations + IR + AMO ne doivent pas mettre net negatif).
2. **Bracket IR boundary 30000 exact** : tranche 0% applique, IR = 0.
3. **Bracket IR boundary 30001** : bascule 10%, IR = 30001 * 0.10 - 3000 = 0.10 MAD.
4. **CNSS plafond 6000 exact** : cotisation = 268.80 (4.48% x 6000).
5. **Family children > 6** : capped a 6 (max legal art 74).
6. **AMO no plafond** : 100 000 MAD/mois brut -> 2 260 MAD AMO/mois.
7. **Frais pro plafond 35000/an** : seul brut > 11 666 MAD/mois est plafonne.
8. **FIFO consume lot avec qty < requested** : continue consume lot suivant.
9. **FIFO 0 lots disponibles** : INSUFFICIENT_STOCK error 400.
10. **Decimal precision rounding** : toFixed(2) pour MAD, toFixed(4) pour quantites.

### D.5 Troubleshooting common issues

#### Issue : ETL lag > 30 min
- Cause : ClickHouse insert lent / Postgres delta gros / Kafka consumer down
- Diagnostic : `GET /admin/analytics/etl-state` -> regarder last_synced_at
- Solution : `POST /admin/analytics/resync` force resync OU restart consumer

#### Issue : Dashboards 503 timeout
- Cause : ClickHouse query lente / cache Redis down
- Diagnostic : logs Pino query_duration_ms / Redis ping
- Solution : verify ClickHouse health / restart Redis / abort_signal 25s

#### Issue : Stock movement INSUFFICIENT_STOCK alors que stock visible
- Cause : autre transaction concurrent en cours (SELECT FOR UPDATE bloque)
- Diagnostic : `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query LIKE '%stock_lots%'`
- Solution : retry quelques secondes plus tard ; verifier pas de transaction longue duration

#### Issue : Payslip Books ecriture manquante
- Cause : Kafka consumer down apres payslip_validated emit
- Diagnostic : `SELECT * FROM hr_payslips WHERE id = X` -> status=validated mais pas dans journal_entries
- Solution : manual re-emit Kafka event OU appel direct Books.recordEntry avec idempotency-key

#### Issue : CNSS XML rejected Damancom
- Cause : format invalide (encoding, ICE, CIN normalisation)
- Diagnostic : valider XML schema XSD Damancom
- Solution : verifier tenant.cnss_employer_number + ICE + CIN normalize uppercase no spaces


## ANNEXE E -- Architecture + Roadmap Sprint 14+

### E.1 Architecture Sprint 13 detaillee

```
+-----------------------------------------------------------+
|                  Frontend (Sprint 17 / 23)                |
|  web-broker UI  +  web-garage UI  +  Sprint 19 portail   |
+----------------------------+------------------------------+
                             |
                             | HTTPS + JWT + x-tenant-id
                             v
+----------------------------+------------------------------+
|              API Gateway NestJS (apps/api)                |
|  + JwtAuthGuard + RolesGuard + TenantGuard + Throttle    |
+----------------------------+------------------------------+
                             |
       +---------------------+-------------------+
       v                     v                   v
   +-------+           +-----------+      +-----------+
   | CRM   |           |  Stock    |      |    HR     |
   +---+---+           +-----+-----+      +-----+-----+
       |                     |                  |
       +---------+-----------+------------------+
                 |
                 v
+----------------+-----------------+
| Postgres 16 OLTP Atlas DC1        |
| RLS multi-tenant strict           |
| Triggers anti-overlap/cycle       |
| Migrations TypeORM 0.3            |
+----------------+-----------------+
                 |
                 | ETL polling 5min (Tache 3.6.2)
                 v
+----------------+-----------------+
| ClickHouse 24.10 OLAP             |
| 5 fct_* + 2 dim_* + 1 dim_dates  |
| TTL 5-10 ans selon legal          |
+----------------+-----------------+
                 |
                 | Queries (AnalyticsService)
                 v
+----------------+-----------------+
| 6 Dashboards REST endpoints       |
+----------------------------------+

Side channels :
+ Redis cache (Sprint 9) : analytics cache + idempotency keys
+ Kafka 3.7 (Sprint 9) : events cross-module + consumers Books/Repair
+ S3 Atlas (Sprint 10) : documents, photos, bulletins PDF
+ SendGrid (Sprint 9) : emails notifications
+ Meta WhatsApp API (Sprint 9) : WA notifications
```

### E.2 Sprint 14+ Vertical Insure (Phase 4)

Sprint 14 demarre avec :
- Tous modules horizontaux ready as building blocks
- CRM contacts -> souscripteurs polices
- Pay -> primes paiements
- Books -> commissions courtier ecritures
- Docs -> polices PDF + signatures Barid
- Analytics -> dashboards Insure-specific (a creer)

Modules Insure prevus B-14 a B-19 :

| Sprint | Module | Effort |
|--------|--------|--------|
| B-14 | Insure foundation : polices + souscriptions + ACAPS reporting | 70h |
| B-15 | Insure sinistres : workflow + expertise + reglement | 75h |
| B-16 | Insure commissions courtier + reconciliation | 60h |
| B-17 | Web Broker UI : dashboards + CRM + souscriptions | 80h |
| B-18 | Web Customer Portal SEO + acquisition prospects | 70h |
| B-19 | Web Assure Portal + capture NPS Sprint 13 framework | 75h |

### E.3 Sprint 20+ Vertical Repair (Phase 5)

Sprint 20-23 consume Stock + HR Sprint 13 :
- Sprint 22 : Repair sinistres + parts_consumed -> consume Stock FIFO via Kafka
- Sprint 23 : Web Garage UI + dashboards Stock + HR + Repair
- Atelier mecanicien PWA mobile

### E.4 Sprint 24-30 Phase 6+ SaaS Front + Mobile + IA

Sprint 24-30 :
- B-24/25 : Web Insurtech Admin (super admin Skalean)
- B-26/27 : Web admin tenants
- B-28/29 : PWA mobile garage + assure
- B-30 : Skalean AI integration via Sprint 31 MCP (decision-005)

### E.5 Sprint 31-35 Hardening + Production

- B-31 : Agent Sky MCP tools (get_revenue_trend, get_stock_alerts, get_payslip)
- B-32 : Materialized views ClickHouse + cache HTTP layer
- B-33 : Backup/restore + disaster recovery DC2
- B-34 : Security audit + pentest + ANRT certification
- B-35 : Production hardening + observability complete


## ANNEXE F -- Cheatsheet permissions RBAC Sprint 13

### F.1 Permissions Stock (15 permissions)

```typescript
// repo/packages/auth/src/seeds/permissions/stock.ts
export const STOCK_PERMISSIONS = [
  // Categories
  'stock.categories.create',
  'stock.categories.read',
  'stock.categories.update',
  'stock.categories.delete',
  // Items
  'stock.items.create',
  'stock.items.read',
  'stock.items.update',
  'stock.items.delete',
  // Movements
  'stock.movements.create',
  'stock.movements.read',
  'stock.adjust',
  // Reports
  'stock.valorisation.read',
  'stock.alerts.read',
  'stock.alerts.snooze',
  // Admin
  'stock.admin.force_unlock',
];
```

### F.2 Permissions HR (20 permissions)

```typescript
// repo/packages/auth/src/seeds/permissions/hr.ts
export const HR_PERMISSIONS = [
  // Employees
  'hr.employees.create',
  'hr.employees.read',
  'hr.employees.read_own',           // employee voit son propre dossier
  'hr.employees.update',
  'hr.employees.delete',
  // Contracts
  'hr.contracts.create',
  'hr.contracts.read',
  'hr.contracts.update',
  'hr.contracts.terminate',
  // Leaves
  'hr.leaves.request',
  'hr.leaves.approve',
  'hr.leaves.cancel',
  'hr.leaves.read',
  'hr.leaves.read_own',
  // Payroll
  'hr.payroll.generate',
  'hr.payroll.validate',
  'hr.payroll.mark_paid',
  'hr.payslips.read',
  'hr.payslips.read_own',
  // Declarations
  'hr.declarations.read',
  'hr.declarations.export',
];
```

### F.3 Mapping roles -> permissions Sprint 13

| Role | Permissions Stock | Permissions HR |
|------|--------------------|------------------|
| SuperAdmin | All stock.* | All hr.* |
| BrokerAdmin | -- | hr.employees.* (employes courtage) |
| GarageAdmin | All stock.* + hr.* | All hr.* |
| GarageManager | stock.items.{r,u} + stock.movements.{c,r} + stock.alerts.* | hr.leaves.approve + hr.employees.read |
| GarageMechanic | stock.items.read + stock.movements.create | hr.employees.read_own + hr.payslips.read_own + hr.leaves.request |
| GarageStock | All stock.* | -- |
| Accountant | stock.valorisation.read + stock.reports.read | hr.payroll.* + hr.declarations.* |
| ComplianceOfficer | -- | hr.declarations.read |
| FinanceOfficer | stock.valorisation.read | hr.payroll.read + hr.payslips.read |
| ReadOnly | stock.items.read + stock.valorisation.read | hr.employees.read |

### F.4 Permissions Analytics (5)

```typescript
export const ANALYTICS_PERMISSIONS = [
  'analytics.dashboards.read',
  'analytics.exports.create',
  'analytics.admin.etl_resync',
  'analytics.admin.cache_invalidate',
  'analytics.developer.raw_query',     // Sprint 35
];
```

### F.5 Endpoints API summary Sprint 13 (44 endpoints)

#### Analytics (8)
- GET /api/v1/analytics/dashboards/revenue
- GET /api/v1/analytics/dashboards/conversion
- GET /api/v1/analytics/dashboards/activity
- GET /api/v1/analytics/dashboards/sinistre-rate
- GET /api/v1/analytics/dashboards/nps
- GET /api/v1/analytics/dashboards/funnel-tenant
- GET /api/v1/admin/analytics/etl-state
- POST /api/v1/admin/analytics/resync

#### Stock (15)
- POST/GET/PATCH/DELETE /api/v1/stock/items
- POST/GET /api/v1/stock/categories
- POST /api/v1/stock/movements/{entry,exit,adjustment}
- GET /api/v1/stock/items/:id/movements
- GET /api/v1/stock/alerts/low-stock
- GET /api/v1/stock/valorisation
- GET /api/v1/stock/valorisation/export.csv
- GET /api/v1/stock/reports/inventory
- POST /api/v1/stock/inventory-count

#### HR (21)
- POST/GET/PATCH/DELETE /api/v1/hr/employees
- POST /api/v1/hr/employees/:id/terminate
- POST/GET /api/v1/hr/employees/:id/contracts
- POST /api/v1/hr/contracts/:id/{activate,terminate,renew}
- POST /api/v1/hr/leaves/{request,approve,reject,cancel}
- GET /api/v1/hr/leaves/balance/:employeeId
- POST /api/v1/hr/payroll/{generate-period,payslips/:id/validate,payslips/:id/mark-paid}
- GET /api/v1/hr/payroll/payslips
- GET /api/v1/hr/payroll/payslips/:id/pdf
- GET /api/v1/hr/reports/declaration-cnss(/xml)
- GET /api/v1/hr/reports/declaration-ir(/csv)
- GET /api/v1/hr/dashboard


## ANNEXE G -- Testing strategy detaillee Sprint 13

### G.1 Test pyramid Sprint 13

```
                    /\
                   /  \   E2E + Integration (Tests Sprint 13)
                  /----\  35+ tests E2E + 8 integration concurrence
                 /      \
                /--------\ Service unit tests (mock repos)
               /          \ 200+ tests unit
              /------------\
             /              \ Pure logic tests (calculators, validators)
            /----------------\ 100+ tests (PayrollCalculator, LeaveBalance, FIFO)
```

### G.2 Coverage targets Sprint 13

| Module | Coverage target | Rationale |
|--------|-------------------|-----------|
| @insurtech/hr payroll-calculator | >= 95% | Critical legal computations IR/CNSS/AMO |
| @insurtech/hr leave-balance-calculator | >= 90% | Legal compliance (art 231-232) |
| @insurtech/stock valorisation | >= 90% | FIFO accuracy mandatory CGNC art 32 |
| @insurtech/stock movements | >= 90% | Concurrence + atomicity critical |
| @insurtech/analytics services | >= 85% | Standard cover |
| @insurtech/hr services | >= 85% | Standard |
| Controllers REST | >= 80% | E2E covers integration |

### G.3 Fixtures realistes Sprint 13

Seed script `seed-phase-3-fixtures.ts` produit :
- 5 tenants types (3 garages + 2 cabinets courtage)
- 50 employees total (10 per tenant)
- 50 contrats CDI actives
- 100+ conges historiques (50% paid + 30% sick + 20% maternity/paternity)
- 600 payslips (50 employees x 12 mois retroactifs)
- 1000 stock items + 5000 lots
- 30 000 stock movements (24000 entries + 6000 exits)
- 150 alertes historiques

Execution : `pnpm tsx infrastructure/scripts/seed-phase-3-fixtures.ts`
Idempotency : ON CONFLICT DO NOTHING (relancable safely).
Duree : ~60 secondes sur Atlas Cloud Benguerir DC1.

### G.4 Tests E2E parcours critiques

```typescript
// 35+ tests E2E groups :

describe('Group 1 : ClickHouse + ETL (5)', () => {
  // ping, schemas, dim_dates, ETL sync, idempotency
});

describe('Group 2 : Dashboards (8)', () => {
  // 6 endpoints + format + multi-tenant + cache
});

describe('Group 3 : Stock (12)', () => {
  // CRUD + FIFO multi-lots + alertes + inventory
});

describe('Group 4 : HR employees (5)', () => {
  // CIN MA + SMIG + CDD/CDI + termination
});

describe('Group 5 : HR conges (5)', () => {
  // Workflow + balance + maternity + sick certif
});

describe('Group 6 : HR paie (7)', () => {
  // CNSS + AMO + IR brackets + Books + declarations
});
```

### G.5 Tests integration concurrence

```typescript
// 100 concurrent exits FIFO same item -> 50 succeed + 50 fail INSUFFICIENT_STOCK
// 50 concurrent payroll generate -> 1 success + 49 IDEMPOTENCY_REPLAY
// 10 concurrent leave requests overlap -> trigger PG rejette
```

### G.6 Performance tests benchmark

```typescript
// Benchmark scenarios :
- 1000 stock items + 5000 lots -> valorisation < 3s
- 200 employees -> payroll generate-period < 30s
- 50 concurrent dashboard requests -> p95 < 1s
- ETL sync 100k transactions -> < 60s
- Inventory historique 6 mois -> < 5s
```

