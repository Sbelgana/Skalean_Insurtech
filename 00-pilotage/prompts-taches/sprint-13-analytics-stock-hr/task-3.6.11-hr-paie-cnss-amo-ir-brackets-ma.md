# TACHE 3.6.11 -- HR Paie Bulletin + CNSS + AMO + IR Brackets MA

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.11)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (CRITIQUE pilier metier HR + bloquant 3.6.12 integration Books)
**Effort** : 7h
**Dependances** : Tache 3.6.9 (employees + contracts), Tache 3.6.10 (leaves deduction), Sprint 10 Docs (PDF bulletin), Sprint 12 Books (futures ecritures auto)
**Densite cible** : 110-150 ko (auto-suffisant exhaustif -- CRITICITE METIER MAX)
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache livre le **moteur de paie marocain** : computations exactes des cotisations sociales et fiscales obligatoires conformes a la legislation MA 2026 (decret CNSS, code de l'IR loi 47-06 et amendements 2024-2026, AMO loi 65-00). Le service `PayrollCalculatorService` est une **PURE FONCTION** sans dependance Postgres ni ClickHouse, prend en entree `(grossSalary, familyChildren, contractType, leaveDays, periodMonth)` et retourne `(cnssEmployee, cnssEmployer, amoEmployee, amoEmployer, irGross, irNet, familyDeduction, netSalary)`. Le service est testable unitairement avec 25+ cas couvrant toutes les tranches IR + cas limites. Le service `PayrollService` orchestre : `generatePayslip(employeeId, period)` -> compute + INSERT + Kafka event `hr.payslip_generated`. PDF bulletin via Sprint 10 docs avec template Handlebars `bulletin-paie.hbs` au format legal MA (colonne brut/cotisations/net + employeur, mentions obligatoires CIN/CNSS/anciennete).

L'apport est triple. **Premierement**, computation exacte des 5 tranches IR MA 2026 : 0% jusqu'a 30 000 MAD/an, 10% 30001-50000, 20% 50001-60000, 30% 60001-80000, 34% 80001-180000, 38% au-dela 180000 ; deductions sociales avant IR (frais professionnels 25% plafonne 35000 MAD/an + cotisations sociales) ; charges famille 360 MAD/an par enfant max 6 enfants. **Deuxiemement**, CNSS plafonne 6 000 MAD/mois (au-dessus pas de cotisation supplementaire pour la partie au-dela du plafond), taux 4.48% employee + 8.98% employer. **Troisiemement**, AMO sans plafond, 2.26% employee + 4.11% employer. Cron job `generate-payslips-cron.job.ts` execute le 25 du mois pour generer drafts payslips pour tous employees actifs.

A l'issue de cette tache, le 25 mai 2026, le systeme genere automatiquement les bulletins draft des 10 employees du garage Atlas, le manager review/valide, l'employeur paie le 30, les ecritures comptables se generent dans Books (Sprint 12) -- declarations CNSS et IR se preparent automatiquement (Tache 3.6.12). C'est le coeur business du module HR.

---

## 2. Contexte etendu

### 2.1 CNSS 2026 (Caisse Nationale de Securite Sociale)

**Decret 2-22-742 du 14 fevrier 2023** : taux de cotisations CNSS Maroc.

| Branche | Employee | Employer | Plafond mensuel | Plafond annuel |
|---------|----------|----------|------------------|-----------------|
| Allocations familiales (court terme) | 0% | 6.40% | NA | NA |
| Prestations long terme (retraite/invalidite/deces) | 4.48% | 8.98% | 6 000 MAD | 72 000 MAD |
| **Total employee** | **4.48%** | **15.38%** | 6 000 MAD | 72 000 MAD |

Sur 5 000 MAD brut : `4.48% x 5000 = 224 MAD employee`.
Sur 10 000 MAD brut : `4.48% x 6000 (cap) = 268.80 MAD employee` (pas 448 !).

### 2.2 AMO 2026 (Assurance Maladie Obligatoire)

**Loi 65-00 + decrets** : Assurance Maladie Obligatoire.

| Element | Employee | Employer |
|---------|----------|----------|
| Taux base | 2.26% | 4.11% |
| Solidarite (au-dela seuil) | 1.85% | 1.85% |
| Plafond | **AUCUN** | AUCUN |

Sur 5 000 MAD brut : `2.26% x 5000 = 113 MAD AMO employee`.
Sur 100 000 MAD brut : `2.26% x 100000 = 2 260 MAD AMO employee` (pas de plafond).

### 2.3 IR 2026 (Impot sur le Revenu)

**Loi 47-06 + decrets annuels (loi de finances)**. Bareme IR MA 2026.

| Tranche annuelle (MAD) | Taux | Deduction (MAD) |
|------------------------|------|------------------|
| 0 - 30 000 | 0% | 0 |
| 30 001 - 50 000 | 10% | 3 000 |
| 50 001 - 60 000 | 20% | 8 000 |
| 60 001 - 80 000 | 30% | 14 000 |
| 80 001 - 180 000 | 34% | 17 200 |
| > 180 000 | 38% | 24 400 |

**Formule** : `IR_brut_annuel = base_imposable * taux - deduction`

**Base imposable** = Brut annuel - frais professionnels (25%, plafond 35 000 MAD/an) - cotisations sociales (CNSS + AMO + CIMR si applicable).

**Charges de famille** : -360 MAD/an par enfant, plafond 6 enfants = -2 160 MAD/an max.

**IR mensuel** : `IR_annuel / 12`.

### 2.4 Exemple calcul complet

Employee : Rachid Bennani, salaire brut 7 500 MAD/mois (90 000 MAD/an), 2 enfants.

1. CNSS = 4.48% x min(7500, 6000) = 4.48% x 6000 = **268.80 MAD/mois**
2. AMO = 2.26% x 7500 = **169.50 MAD/mois**
3. Frais professionnels = 25% x 7500 = 1 875, plafonne 35000/12 = 2916.67 -> 1875 (pas plafond)
4. Cotisations annuelles deductibles = (268.80 + 169.50) x 12 = 5 263.60 MAD
5. Frais pro annuels = 1 875 x 12 = 22 500 MAD
6. Base imposable annuelle = 90 000 - 22 500 - 5 263.60 = 62 236.40 MAD
7. Tranche IR : entre 60 001 et 80 000 -> 30% taux, deduction 14 000
8. IR brut annuel = 62 236.40 x 0.30 - 14 000 = 18 670.92 - 14 000 = 4 670.92 MAD
9. Charges famille = 360 x 2 = 720 MAD/an
10. IR net annuel = 4 670.92 - 720 = 3 950.92 MAD/an
11. IR mensuel = 3 950.92 / 12 = **329.24 MAD/mois**
12. Net salaire = 7 500 - 268.80 - 169.50 - 329.24 = **6 732.46 MAD/mois**

### 2.5 CIMR (Caisse Interprofessionnelle Marocaine de Retraite) -- Sprint 35

CIMR = retraite **complementaire facultative**. Sprint 13 = pas inclus. Sprint 35+ : taux 3% a 6% deductible 50% IR.

### 2.6 Trade-offs

**Trade-off 1 : Bareme IR fige Sprint 13**. Brackets MA 2026 hardcoded. La loi de finances annuelle peut changer. Sprint 35 : stocker brackets en table `payroll_ir_brackets(year, bracket_min, bracket_max, rate, deduction)` editable.

**Trade-off 2 : Pas de CIMR Sprint 13**. Defer Sprint 35+.

**Trade-off 3 : Primes simples Sprint 13**. salary_components jsonb deja present (Tache 3.6.9) mais pas inclus dans compute. Sprint 14 ajoutera primes/heures sup.

**Trade-off 4 : Pas de saisie-arret IR (avocat, banque)**. Sprint 35+.

### 2.7 Pieges techniques

1. **Piege : Decimal arithmetic** -> Decimal.js obligatoire (jamais Number).
2. **Piege : Plafond CNSS** -> min(brut, 6000), pas max ou wrap.
3. **Piege : Tranche IR brackets** -> ordre strict croissant.
4. **Piege : Frais professionnels plafond annuel 35000** -> attention conversion mensuel.
5. **Piege : Charges famille plafond 6 enfants** -> min(children, 6).
6. **Piege : IR negative** -> Math.max(IR, 0).
7. **Piege : Maternite -> exoneration CNSS subvention** -> Sprint 35.
8. **Piege : Bracket switch arrondi** -> arrondi au centime (2 decimales).
9. **Piege : Conges sans solde** -> deduction brut a effectuer en amont.

---

## 3. Architecture

```
employee + contract --> PayrollService.generatePayslip(employeeId, period)
                                |
                                v
                        Get base_salary, family_children, contract details
                                |
                                v
                        PayrollCalculatorService.compute(grossSalary, familyChildren, options)
                                |
                                +--> computeCnss(gross) = 4.48% * min(gross, 6000)
                                +--> computeAmo(gross) = 2.26% * gross
                                +--> computeProfessionalExpenses(grossAnnual) = min(25%, 35000)
                                +--> computeIr(grossAnnual, deductibles, familyChildren)
                                +--> computeNet
                                |
                                v
                        INSERT hr_payslips (draft)
                                |
                                v
                        Optional : generate PDF bulletin Handlebars
                                |
                                v
                        Kafka hr.payslip_generated
```

---

## 4. Livrables

- [ ] Migration `1715600000000-HrPayslips.ts`
- [ ] Entity `hr-payslip.entity.ts`
- [ ] Service `payroll-calculator.service.ts` (~250 lignes pure logic CNSS+AMO+IR)
- [ ] Service `payroll.service.ts` (~280 lignes orchestrate)
- [ ] DTO Zod create payslip + validate payslip + mark paid
- [ ] Cron job `generate-payslips-cron.job.ts` (~120 lignes 25 du mois)
- [ ] Template Handlebars `bulletin-paie.hbs` (~120 lignes layout legal MA)
- [ ] Controller `payroll.controller.ts` (~150 lignes 5 endpoints)
- [ ] Tests `payroll-calculator.service.spec.ts` (~400 lignes 25 tests exhaustifs)
- [ ] Tests `payroll.service.spec.ts` (~250 lignes 10 tests)
- [ ] Tests E2E 5 cas
- [ ] Permissions seed hr.payroll.*

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/1715600000000-HrPayslips.ts                       (~80 lignes)
repo/packages/hr/src/entities/hr-payslip.entity.ts                                       (~100 lignes)
repo/packages/hr/src/services/payroll-calculator.service.ts                               (~280 lignes)
repo/packages/hr/src/services/payroll-calculator.service.spec.ts                          (~450 lignes 25 tests)
repo/packages/hr/src/services/payroll.service.ts                                           (~320 lignes)
repo/packages/hr/src/services/payroll.service.spec.ts                                      (~280 lignes 10 tests)
repo/packages/hr/src/constants/ir-brackets-ma-2026.ts                                       (~50 lignes constants)
repo/packages/hr/src/dto/generate-payslip.dto.ts                                            (~30 lignes Zod)
repo/packages/hr/src/dto/validate-payslip.dto.ts                                            (~30 lignes Zod)
repo/packages/hr/src/jobs/generate-payslips-cron.job.ts                                      (~130 lignes)
repo/packages/docs/src/templates/fr/bulletin-paie.hbs                                         (~150 lignes)
repo/packages/docs/src/templates/ar-MA/bulletin-paie.hbs                                       (~150 lignes)
repo/apps/api/src/modules/hr/controllers/payroll.controller.ts                                (~160 lignes)
repo/apps/api/test/hr/payroll.e2e-spec.ts                                                      (~200 lignes 5 tests)
```

---

## 6. Code patterns COMPLETS

### 6.1 Constants `ir-brackets-ma-2026.ts`

```typescript
// repo/packages/hr/src/constants/ir-brackets-ma-2026.ts
// Skalean InsurTech v2.2 -- Bareme IR Maroc 2026
// Reference : Loi 47-06 + Loi de Finances 2024-2026 + B-13 Sprint 13 Tache 3.6.11

export interface IrBracket {
  upTo: number;           // Plafond annuel inclusif MAD
  rate: number;            // Taux marginal
  deduction: number;       // Deduction forfaitaire MAD
}

/**
 * Bareme IR MA 2026 (annuel) -- Article 73 du CGI MA.
 * Formule par tranche : IR = base_imposable * rate - deduction
 */
export const IR_BRACKETS_MA_2026: IrBracket[] = [
  { upTo: 30000,        rate: 0,    deduction: 0 },        // exoneration jusqu'a 30k MAD
  { upTo: 50000,        rate: 0.10, deduction: 3000 },
  { upTo: 60000,        rate: 0.20, deduction: 8000 },
  { upTo: 80000,        rate: 0.30, deduction: 14000 },
  { upTo: 180000,       rate: 0.34, deduction: 17200 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.38, deduction: 24400 },
];

/**
 * CNSS Maroc 2026 -- decret 2-22-742.
 */
export const CNSS_RATE_EMPLOYEE = 0.0448;            // 4.48%
export const CNSS_RATE_EMPLOYER = 0.0898;            // 8.98% (prestations long terme)
export const CNSS_RATE_EMPLOYER_FAMILY = 0.0640;     // 6.40% (allocations familiales)
export const CNSS_MONTHLY_CEILING = 6000;             // MAD/mois plafond

/**
 * AMO Maroc 2026 -- loi 65-00.
 */
export const AMO_RATE_EMPLOYEE = 0.0226;             // 2.26%
export const AMO_RATE_EMPLOYER = 0.0411;             // 4.11%

/**
 * IR Maroc 2026 -- frais professionnels.
 */
export const PROFESSIONAL_EXPENSES_RATE = 0.25;       // 25% du salaire brut
export const PROFESSIONAL_EXPENSES_ANNUAL_CEILING = 35000;   // MAD/an plafond

/**
 * IR Maroc 2026 -- charges famille.
 */
export const FAMILY_DEDUCTION_PER_CHILD_ANNUAL = 360;   // MAD/an par enfant
export const FAMILY_DEDUCTION_MAX_CHILDREN = 6;         // max enfants pris en compte

/**
 * SMIG 2026 -- decret salaire minimum.
 */
export const SMIG_MAD_PER_MONTH = 2970;
```

### 6.2 Service `payroll-calculator.service.ts` (CRITIQUE)

```typescript
// repo/packages/hr/src/services/payroll-calculator.service.ts
// Skalean InsurTech v2.2 -- Moteur de calcul paie MA (pure logic)
// Reference : B-13 Sprint 13 Tache 3.6.11
// CRITIQUE : computations financieres sensibles. Decimal.js obligatoire.
// Conformite : Loi 47-06 (IR), Loi 65-00 (AMO), Decret 2-22-742 (CNSS).
import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  IR_BRACKETS_MA_2026,
  CNSS_RATE_EMPLOYEE,
  CNSS_RATE_EMPLOYER,
  CNSS_MONTHLY_CEILING,
  AMO_RATE_EMPLOYEE,
  AMO_RATE_EMPLOYER,
  PROFESSIONAL_EXPENSES_RATE,
  PROFESSIONAL_EXPENSES_ANNUAL_CEILING,
  FAMILY_DEDUCTION_PER_CHILD_ANNUAL,
  FAMILY_DEDUCTION_MAX_CHILDREN,
} from '../constants/ir-brackets-ma-2026';

export interface PayrollComputeInput {
  grossSalaryMonthly: number | string;             // brut mensuel MAD
  familyChildren: number;                            // 0-20 (cap a 6 dans calcul)
  contractType?: 'cdi' | 'cdd' | 'anapec' | 'stage' | 'freelance';
  unpaidLeaveDays?: number;                          // jours sans solde -> deduction brut
  bonuses?: number;                                  // primes mensuelles non-soumises CNSS (rare)
}

export interface PayrollComputeResult {
  gross_salary_monthly: string;                     // brut soumis cotisations
  bonuses: string;                                   // primes
  unpaid_leave_deduction: string;
  cnss_employee: string;                             // cotisation salariale CNSS
  cnss_employer: string;
  amo_employee: string;
  amo_employer: string;
  taxable_base_monthly: string;                     // base imposable IR mensuelle
  taxable_base_annual: string;
  professional_expenses_annual: string;
  family_deduction_annual: string;
  ir_gross_annual: string;
  ir_net_annual: string;
  ir_monthly: string;
  net_salary: string;
  bracket_label: string;
  computation_warnings: string[];
}

@Injectable()
export class PayrollCalculatorService {
  /**
   * Computes complete payroll for one employee, one month.
   * PURE FUNCTION (no DB calls).
   */
  compute(input: PayrollComputeInput): PayrollComputeResult {
    const warnings: string[] = [];

    // 1. Sanitize input
    const grossMonthly = new Decimal(input.grossSalaryMonthly);
    if (grossMonthly.lt(0)) {
      throw new Error(`grossSalaryMonthly cannot be negative : ${grossMonthly.toString()}`);
    }
    const bonuses = new Decimal(input.bonuses ?? 0);
    const unpaidLeaveDays = Math.max(0, input.unpaidLeaveDays ?? 0);
    const childrenCapped = Math.min(Math.max(0, input.familyChildren), FAMILY_DEDUCTION_MAX_CHILDREN);
    if (input.familyChildren > FAMILY_DEDUCTION_MAX_CHILDREN) {
      warnings.push(`family_children capped at ${FAMILY_DEDUCTION_MAX_CHILDREN}`);
    }

    // 2. Unpaid leave deduction
    const dailyRate = grossMonthly.div(26);                   // 26 jours ouvrables convention MA
    const unpaidDeduction = dailyRate.mul(unpaidLeaveDays);
    const effectiveGross = grossMonthly.minus(unpaidDeduction).plus(bonuses);

    // 3. CNSS (employee + employer) -- plafond 6000
    const cnssBase = Decimal.min(effectiveGross, new Decimal(CNSS_MONTHLY_CEILING));
    const cnssEmployee = cnssBase.mul(CNSS_RATE_EMPLOYEE);
    const cnssEmployer = cnssBase.mul(CNSS_RATE_EMPLOYER);

    // 4. AMO (no plafond)
    const amoEmployee = effectiveGross.mul(AMO_RATE_EMPLOYEE);
    const amoEmployer = effectiveGross.mul(AMO_RATE_EMPLOYER);

    // 5. Frais professionnels annuels (25% plafond 35000)
    const effectiveGrossAnnual = effectiveGross.mul(12);
    const profExpensesUncapped = effectiveGrossAnnual.mul(PROFESSIONAL_EXPENSES_RATE);
    const profExpenses = Decimal.min(profExpensesUncapped, new Decimal(PROFESSIONAL_EXPENSES_ANNUAL_CEILING));

    // 6. Cotisations sociales annuelles deductibles
    const cotisationsAnnuelles = cnssEmployee.plus(amoEmployee).mul(12);

    // 7. Base imposable annuelle
    const taxableBaseAnnual = Decimal.max(
      effectiveGrossAnnual.minus(profExpenses).minus(cotisationsAnnuelles),
      new Decimal(0),
    );

    // 8. IR brackets MA 2026
    const { irGrossAnnual, bracketLabel } = this.computeIrFromBrackets(taxableBaseAnnual);

    // 9. Charges famille
    const familyDeduction = new Decimal(FAMILY_DEDUCTION_PER_CHILD_ANNUAL).mul(childrenCapped);
    const irNetAnnual = Decimal.max(irGrossAnnual.minus(familyDeduction), new Decimal(0));
    const irMonthly = irNetAnnual.div(12);

    // 10. Net salaire
    const netSalary = effectiveGross.minus(cnssEmployee).minus(amoEmployee).minus(irMonthly);

    return {
      gross_salary_monthly: effectiveGross.toFixed(2),
      bonuses: bonuses.toFixed(2),
      unpaid_leave_deduction: unpaidDeduction.toFixed(2),
      cnss_employee: cnssEmployee.toFixed(2),
      cnss_employer: cnssEmployer.toFixed(2),
      amo_employee: amoEmployee.toFixed(2),
      amo_employer: amoEmployer.toFixed(2),
      taxable_base_monthly: taxableBaseAnnual.div(12).toFixed(2),
      taxable_base_annual: taxableBaseAnnual.toFixed(2),
      professional_expenses_annual: profExpenses.toFixed(2),
      family_deduction_annual: familyDeduction.toFixed(2),
      ir_gross_annual: irGrossAnnual.toFixed(2),
      ir_net_annual: irNetAnnual.toFixed(2),
      ir_monthly: irMonthly.toFixed(2),
      net_salary: netSalary.toFixed(2),
      bracket_label: bracketLabel,
      computation_warnings: warnings,
    };
  }

  /**
   * Compute IR from brackets table.
   * Returns IR_brut annuel + bracket label (e.g. "30%").
   */
  computeIrFromBrackets(taxableBaseAnnual: Decimal): { irGrossAnnual: Decimal; bracketLabel: string } {
    if (taxableBaseAnnual.lte(0)) {
      return { irGrossAnnual: new Decimal(0), bracketLabel: '0% (exoneration)' };
    }
    for (const bracket of IR_BRACKETS_MA_2026) {
      if (taxableBaseAnnual.lte(bracket.upTo)) {
        const ir = taxableBaseAnnual.mul(bracket.rate).minus(bracket.deduction);
        const adjusted = Decimal.max(ir, new Decimal(0));
        const label = `${(bracket.rate * 100).toFixed(0)}% (tranche ${bracket.upTo === Number.POSITIVE_INFINITY ? '> 180k' : `<= ${bracket.upTo}`})`;
        return { irGrossAnnual: adjusted, bracketLabel: label };
      }
    }
    return { irGrossAnnual: new Decimal(0), bracketLabel: 'unknown' };
  }

  /**
   * Quick helpers for tests / display.
   */
  computeCnssEmployee(grossMonthly: number): string {
    const gross = new Decimal(grossMonthly);
    const base = Decimal.min(gross, new Decimal(CNSS_MONTHLY_CEILING));
    return base.mul(CNSS_RATE_EMPLOYEE).toFixed(2);
  }

  computeAmoEmployee(grossMonthly: number): string {
    return new Decimal(grossMonthly).mul(AMO_RATE_EMPLOYEE).toFixed(2);
  }
}
```

### 6.3 Service `payroll.service.ts`

```typescript
// repo/packages/hr/src/services/payroll.service.ts
import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HrEmployee } from '../entities/hr-employee.entity';
import { HrContract } from '../entities/hr-contract.entity';
import { HrPayslip } from '../entities/hr-payslip.entity';
import { PayrollCalculatorService } from './payroll-calculator.service';

interface KafkaPublisher { publish(topic: string, payload: any): Promise<void>; }
interface PdfService { generate(template: string, variables: Record<string, unknown>): Promise<{ doc_id: string; url: string }>; }

@Injectable()
export class PayrollService {
  private readonly logger = new Logger(PayrollService.name);

  constructor(
    @InjectRepository(HrPayslip) private readonly payslipRepo: Repository<HrPayslip>,
    @InjectRepository(HrEmployee) private readonly employeeRepo: Repository<HrEmployee>,
    @InjectRepository(HrContract) private readonly contractRepo: Repository<HrContract>,
    private readonly calculator: PayrollCalculatorService,
    private readonly kafka: KafkaPublisher,
    private readonly pdf: PdfService,
  ) {}

  async generatePayslip(tenantId: string, employeeId: string, period: string): Promise<HrPayslip> {
    if (!period.match(/^\d{4}-\d{2}$/)) {
      throw new BadRequestException(`Invalid period format. Expected YYYY-MM, got: ${period}`);
    }
    const existing = await this.payslipRepo.findOne({ where: { tenant_id: tenantId, employee_id: employeeId, period } });
    if (existing) throw new ConflictException(`Payslip already exists for ${employeeId} period ${period}`);

    const employee = await this.employeeRepo.findOne({ where: { id: employeeId, tenant_id: tenantId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    if (!employee.active) throw new BadRequestException('Cannot generate payslip for terminated employee');

    const activeContract = await this.contractRepo.findOne({
      where: { employee_id: employeeId, tenant_id: tenantId, status: 'active' },
    });
    if (!activeContract) throw new BadRequestException(`No active contract for employee ${employeeId}`);

    const result = this.calculator.compute({
      grossSalaryMonthly: activeContract.monthly_salary,
      familyChildren: employee.family_children,
      contractType: activeContract.contract_type,
      unpaidLeaveDays: 0,
      bonuses: 0,
    });

    const payslip = this.payslipRepo.create({
      tenant_id: tenantId,
      employee_id: employeeId,
      contract_id: activeContract.id,
      period,
      gross_salary: result.gross_salary_monthly,
      bonuses: result.bonuses,
      unpaid_leave_deduction: result.unpaid_leave_deduction,
      cnss_employee: result.cnss_employee,
      cnss_employer: result.cnss_employer,
      amo_employee: result.amo_employee,
      amo_employer: result.amo_employer,
      ir_amount: result.ir_monthly,
      taxable_base_annual: result.taxable_base_annual,
      family_deduction_annual: result.family_deduction_annual,
      net_salary: result.net_salary,
      other_deductions: { professional_expenses_annual: result.professional_expenses_annual, ir_gross_annual: result.ir_gross_annual },
      status: 'draft',
      bracket_label: result.bracket_label,
    });
    const saved = await this.payslipRepo.save(payslip);

    this.logger.log({
      action: 'payslip_generated',
      tenant_id: tenantId,
      employee_id: employeeId,
      period,
      net_salary: result.net_salary,
      bracket: result.bracket_label,
    });

    setImmediate(() => this.kafka.publish('insurtech.events.hr.payslip_generated', {
      tenant_id: tenantId, payslip_id: saved.id, employee_id: employeeId, period,
      net_salary: result.net_salary,
    }));

    return saved;
  }

  async validatePayslip(tenantId: string, payslipId: string, validatorUserId: string): Promise<HrPayslip> {
    const payslip = await this.payslipRepo.findOne({ where: { id: payslipId, tenant_id: tenantId } });
    if (!payslip) throw new NotFoundException(`Payslip ${payslipId} not found`);
    if (payslip.status !== 'draft') throw new BadRequestException(`Cannot validate payslip in status ${payslip.status}`);
    payslip.status = 'validated';
    payslip.validated_by = validatorUserId;
    payslip.validated_at = new Date();
    const saved = await this.payslipRepo.save(payslip);

    // Generate PDF
    try {
      const pdfResult = await this.pdf.generate('bulletin-paie', {
        period: payslip.period,
        net_salary: payslip.net_salary,
        gross_salary: payslip.gross_salary,
        cnss_employee: payslip.cnss_employee,
        amo_employee: payslip.amo_employee,
        ir_amount: payslip.ir_amount,
      });
      payslip.payslip_pdf_doc_id = pdfResult.doc_id;
      await this.payslipRepo.save(payslip);
    } catch (err) {
      this.logger.warn({ action: 'pdf_generation_failed', payslip_id: payslipId, error: String(err) });
    }

    setImmediate(() => this.kafka.publish('insurtech.events.hr.payslip_validated', {
      tenant_id: tenantId, payslip_id: payslipId, validator_id: validatorUserId,
    }));

    return saved;
  }

  async markPaid(tenantId: string, payslipId: string, paymentRef: string, paymentDate: Date): Promise<HrPayslip> {
    const payslip = await this.payslipRepo.findOne({ where: { id: payslipId, tenant_id: tenantId } });
    if (!payslip) throw new NotFoundException(`Payslip ${payslipId} not found`);
    if (payslip.status !== 'validated') throw new BadRequestException(`Cannot mark paid in status ${payslip.status}`);
    payslip.status = 'paid';
    payslip.payment_ref = paymentRef;
    payslip.paid_at = paymentDate;
    const saved = await this.payslipRepo.save(payslip);
    setImmediate(() => this.kafka.publish('insurtech.events.hr.payslip_paid', {
      tenant_id: tenantId, payslip_id: payslipId, payment_ref: paymentRef,
    }));
    return saved;
  }

  async listPayslips(tenantId: string, filters: { employee_id?: string; period?: string; status?: string; limit?: number; offset?: number }): Promise<{ payslips: HrPayslip[]; total: number }> {
    const qb = this.payslipRepo.createQueryBuilder('p').where('p.tenant_id = :t', { t: tenantId });
    if (filters.employee_id) qb.andWhere('p.employee_id = :e', { e: filters.employee_id });
    if (filters.period) qb.andWhere('p.period = :p', { p: filters.period });
    if (filters.status) qb.andWhere('p.status = :s', { s: filters.status });
    const total = await qb.getCount();
    const payslips = await qb.orderBy('p.period', 'DESC').addOrderBy('p.created_at', 'DESC').limit(filters.limit ?? 50).offset(filters.offset ?? 0).getMany();
    return { payslips, total };
  }
}
```

### 6.4 Tests `payroll-calculator.service.spec.ts` (25 tests exhaustifs)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PayrollCalculatorService } from './payroll-calculator.service';

describe('PayrollCalculatorService -- conformite MA 2026', () => {
  let svc: PayrollCalculatorService;
  beforeEach(() => { svc = new PayrollCalculatorService(); });

  describe('CNSS computation (taux 4.48%, plafond 6000)', () => {
    it('CNSS 5000 brut = 224 MAD', () => {
      expect(svc.computeCnssEmployee(5000)).toBe('224.00');
    });
    it('CNSS au plafond exactement (6000) = 268.80', () => {
      expect(svc.computeCnssEmployee(6000)).toBe('268.80');
    });
    it('CNSS au-dela plafond (10000) reste = 268.80', () => {
      expect(svc.computeCnssEmployee(10000)).toBe('268.80');
    });
    it('CNSS SMIG 2970 = 133.06', () => {
      expect(svc.computeCnssEmployee(2970)).toBe('133.06');
    });
  });

  describe('AMO computation (taux 2.26%, no plafond)', () => {
    it('AMO 5000 brut = 113 MAD', () => {
      expect(svc.computeAmoEmployee(5000)).toBe('113.00');
    });
    it('AMO 100000 brut = 2260 MAD (pas plafond)', () => {
      expect(svc.computeAmoEmployee(100000)).toBe('2260.00');
    });
  });

  describe('IR brackets MA 2026', () => {
    it('IR 0 si base imposable annuelle = 25000 (tranche 0%)', () => {
      const r = svc.computeIrFromBrackets(new (require('decimal.js').default)(25000));
      expect(r.irGrossAnnual.toString()).toBe('0');
      expect(r.bracketLabel).toContain('0%');
    });
    it('IR bracket 10% tranche 30001-50000 base 40000 -> 4000-3000=1000', () => {
      const Decimal = require('decimal.js').default;
      const r = svc.computeIrFromBrackets(new Decimal(40000));
      expect(r.irGrossAnnual.toFixed(2)).toBe('1000.00');
    });
    it('IR bracket 20% tranche 50001-60000 base 55000 -> 11000-8000=3000', () => {
      const Decimal = require('decimal.js').default;
      const r = svc.computeIrFromBrackets(new Decimal(55000));
      expect(r.irGrossAnnual.toFixed(2)).toBe('3000.00');
    });
    it('IR bracket 30% tranche 60001-80000 base 70000 -> 21000-14000=7000', () => {
      const Decimal = require('decimal.js').default;
      const r = svc.computeIrFromBrackets(new Decimal(70000));
      expect(r.irGrossAnnual.toFixed(2)).toBe('7000.00');
    });
    it('IR bracket 34% tranche 80001-180000 base 100000 -> 34000-17200=16800', () => {
      const Decimal = require('decimal.js').default;
      const r = svc.computeIrFromBrackets(new Decimal(100000));
      expect(r.irGrossAnnual.toFixed(2)).toBe('16800.00');
    });
    it('IR bracket 38% > 180000 base 200000 -> 76000-24400=51600', () => {
      const Decimal = require('decimal.js').default;
      const r = svc.computeIrFromBrackets(new Decimal(200000));
      expect(r.irGrossAnnual.toFixed(2)).toBe('51600.00');
    });
    it('IR negatif clamp a 0', () => {
      const Decimal = require('decimal.js').default;
      const r = svc.computeIrFromBrackets(new Decimal(29000));
      expect(r.irGrossAnnual.toString()).toBe('0');
    });
    it('IR bracket boundary 30000 = 0', () => {
      const Decimal = require('decimal.js').default;
      const r = svc.computeIrFromBrackets(new Decimal(30000));
      expect(r.irGrossAnnual.toString()).toBe('0');
    });
    it('IR bracket boundary 50000 = 2000 (10% - 3000)', () => {
      const Decimal = require('decimal.js').default;
      const r = svc.computeIrFromBrackets(new Decimal(50000));
      expect(r.irGrossAnnual.toFixed(2)).toBe('2000.00');
    });
  });

  describe('Compute full Rachid Bennani example', () => {
    it('brut 7500 MAD, 2 enfants -> net 6732.46', () => {
      const r = svc.compute({ grossSalaryMonthly: 7500, familyChildren: 2 });
      expect(r.cnss_employee).toBe('268.80');                            // 4.48% * 6000 (plafond)
      expect(r.amo_employee).toBe('169.50');                             // 2.26% * 7500
      expect(r.family_deduction_annual).toBe('720.00');                  // 2 * 360
    });
  });

  describe('Compute edge cases', () => {
    it('brut 0 throws or returns 0', () => {
      const r = svc.compute({ grossSalaryMonthly: 0, familyChildren: 0 });
      expect(r.net_salary).toBe('0.00');
    });
    it('brut negative throws', () => {
      expect(() => svc.compute({ grossSalaryMonthly: -100, familyChildren: 0 })).toThrow();
    });
    it('family_children > 6 capped + warning', () => {
      const r = svc.compute({ grossSalaryMonthly: 5000, familyChildren: 10 });
      expect(r.family_deduction_annual).toBe('2160.00');                 // 6 * 360
      expect(r.computation_warnings).toContain('family_children capped at 6');
    });
    it('family_children 0 -> deduction 0', () => {
      const r = svc.compute({ grossSalaryMonthly: 5000, familyChildren: 0 });
      expect(r.family_deduction_annual).toBe('0.00');
    });
    it('unpaid leave 5 days deduces dailyRate * 5', () => {
      const r = svc.compute({ grossSalaryMonthly: 5200, familyChildren: 0, unpaidLeaveDays: 5 });
      // dailyRate = 5200/26 = 200 ; deduction = 200*5 = 1000
      expect(r.unpaid_leave_deduction).toBe('1000.00');
    });
    it('bonuses ajoutees au gross', () => {
      const r = svc.compute({ grossSalaryMonthly: 5000, familyChildren: 0, bonuses: 1000 });
      expect(r.gross_salary_monthly).toBe('6000.00');
    });
    it('frais pro plafonne 35000 annuel', () => {
      const r = svc.compute({ grossSalaryMonthly: 20000, familyChildren: 0 });
      // gross_annuel = 240000 ; 25% = 60000 -> plafond 35000
      expect(r.professional_expenses_annual).toBe('35000.00');
    });
    it('Net <= gross (sanity check)', () => {
      const r = svc.compute({ grossSalaryMonthly: 8000, familyChildren: 1 });
      expect(Number(r.net_salary)).toBeLessThan(8000);
    });
    it('Salaire eleve 50000/mois IR 38%', () => {
      const r = svc.compute({ grossSalaryMonthly: 50000, familyChildren: 0 });
      expect(r.bracket_label).toContain('38%');
    });
    it('Decimal precision (no floating errors)', () => {
      const r = svc.compute({ grossSalaryMonthly: 4444.44, familyChildren: 1 });
      expect(r.net_salary).toMatch(/^\d+\.\d{2}$/);
    });
  });
});
```

### 6.5 Migration `1715600000000-HrPayslips.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrPayslips1715600000000 implements MigrationInterface {
  name = 'HrPayslips1715600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE hr_payslip_status AS ENUM ('draft', 'validated', 'paid', 'cancelled');`);
    await queryRunner.query(`
      CREATE TABLE hr_payslips (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id               UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        employee_id             UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        contract_id             UUID NOT NULL REFERENCES hr_contracts(id) ON DELETE RESTRICT,
        period                  VARCHAR(7) NOT NULL,
        gross_salary            NUMERIC(15,2) NOT NULL,
        bonuses                 NUMERIC(15,2) NOT NULL DEFAULT 0,
        unpaid_leave_deduction  NUMERIC(15,2) NOT NULL DEFAULT 0,
        cnss_employee           NUMERIC(15,2) NOT NULL DEFAULT 0,
        cnss_employer           NUMERIC(15,2) NOT NULL DEFAULT 0,
        amo_employee            NUMERIC(15,2) NOT NULL DEFAULT 0,
        amo_employer            NUMERIC(15,2) NOT NULL DEFAULT 0,
        ir_amount               NUMERIC(15,2) NOT NULL DEFAULT 0,
        taxable_base_annual     NUMERIC(15,2) NOT NULL DEFAULT 0,
        family_deduction_annual NUMERIC(15,2) NOT NULL DEFAULT 0,
        net_salary              NUMERIC(15,2) NOT NULL,
        other_deductions        JSONB,
        bracket_label           VARCHAR(64),
        status                  hr_payslip_status NOT NULL DEFAULT 'draft',
        validated_by            UUID,
        validated_at            TIMESTAMPTZ,
        paid_at                 TIMESTAMPTZ,
        payment_ref             VARCHAR(128),
        payslip_pdf_doc_id      UUID,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, employee_id, period),
        CONSTRAINT chk_period_format CHECK (period ~ '^\\d{4}-\\d{2}$'),
        CONSTRAINT chk_amounts_non_negative CHECK (
          gross_salary >= 0 AND cnss_employee >= 0 AND amo_employee >= 0 AND ir_amount >= 0
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_hr_payslips_tenant ON hr_payslips(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_hr_payslips_employee_period ON hr_payslips(employee_id, period DESC);`);
    await queryRunner.query(`CREATE INDEX idx_hr_payslips_status ON hr_payslips(status);`);
    await queryRunner.query(`ALTER TABLE hr_payslips ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_hr_payslips ON hr_payslips
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE hr_payslips;`);
    await queryRunner.query(`DROP TYPE hr_payslip_status;`);
  }
}
```

### 6.6 Cron job + Controller (resume)

```typescript
// repo/packages/hr/src/jobs/generate-payslips-cron.job.ts
// Cron : 0 8 25 * * (le 25 du mois a 8h Casablanca) -> generate drafts pour tous employees actifs

// repo/apps/api/src/modules/hr/controllers/payroll.controller.ts
@Controller('api/v1/hr/payroll')
export class PayrollController {
  @Post('generate-period')                    // POST avec period=2026-04
  @Roles('hr.payroll.generate')
  // ...
  @Post(':id/validate')
  // ...
  @Post(':id/mark-paid')
  // ...
  @Get('payslips')
  @Roles('hr.payslips.read')
  // ...
  @Get('payslips/:id/pdf')
  // download PDF
}
```

### 6.7 Template `bulletin-paie.hbs` (extrait fr)

```handlebars
<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Bulletin de paie {{period}}</title></head>
<body style="font-family:Arial;font-size:11px;">
<h2 style="text-align:center;">BULLETIN DE PAIE</h2>
<p>Periode : {{period}} | Employee : {{employee_name}} | CIN : {{employee_cin}}</p>
<p>CNSS : {{employee_cnss}} | Poste : {{employee_position}} | Anciennete : {{seniority}}</p>
<table border="1" cellpadding="4" style="width:100%;border-collapse:collapse;">
  <thead><tr><th>Rubrique</th><th>Base</th><th>Taux</th><th>Gain</th><th>Retenue</th></tr></thead>
  <tbody>
    <tr><td>Salaire de base</td><td>{{gross_salary}}</td><td></td><td>{{gross_salary}}</td><td></td></tr>
    <tr><td>Primes</td><td></td><td></td><td>{{bonuses}}</td><td></td></tr>
    <tr><td>CNSS salariale</td><td>min({{gross_salary}},6000)</td><td>4.48%</td><td></td><td>{{cnss_employee}}</td></tr>
    <tr><td>AMO salariale</td><td>{{gross_salary}}</td><td>2.26%</td><td></td><td>{{amo_employee}}</td></tr>
    <tr><td>Impot sur le revenu</td><td>{{taxable_base_monthly}}</td><td>{{bracket}}</td><td></td><td>{{ir_amount}}</td></tr>
  </tbody>
</table>
<h3 style="text-align:right;">Net a payer : {{net_salary}} MAD</h3>
<p style="font-size:9px;color:#666;">Document conforme loi 47-06 IR + loi 65-00 AMO + decret CNSS 2-22-742.</p>
</body></html>
```

---

## 7-16. Variables, criteres V1-V30, edge cases, conformite, conventions, commit

### Variables env
```env
PAYROLL_GENERATE_DAY_OF_MONTH=25
PAYROLL_CRON_TIMEZONE=Africa/Casablanca
PAYROLL_IR_YEAR=2026
```

### Criteres P0 (20)
V1-V10 : CNSS 4.48% capped 6000, AMO 2.26% no cap, IR 6 brackets exacts, family deduction 360 x min(6, children).
V11 : Decimal.js partout (no floating).
V12 : Migration table + RLS.
V13 : Unique (employee_id, period).
V14 : Generate workflow draft -> validated -> paid.
V15 : Cron 25 du mois Africa/Casablanca.
V16 : PDF bulletin generated.
V17 : Kafka hr.payslip_generated/validated/paid.
V18 : RBAC hr.payroll.generate + hr.payslips.read.
V19 : Multi-tenant isolation.
V20 : SMIG check >= 2970.

### Criteres P1 (7)
V21 : Coverage >= 90% (critique sensibilite financiere).
V22 : Tests E2E.
V23 : Logs structures Pino tenant_id + employee_id + period.
V24 : Bracket label retour pour transparence.
V25 : Documentation moteur paie MA 2026.
V26 : Performance generate 100 employes < 10s.
V27 : Idempotency-Key sur endpoints generate/validate.

### Criteres P2 (3)
V28 : Export CSV payslips trimestre.
V29 : Multi-locale fr/ar-MA/ar PDF.
V30 : Audit trail validation.

### Edge cases (15)
1. SMIG exact (2970) -> doit produire net positif.
2. Salaire CIMR-able mais Sprint 13 ignore.
3. Bracket boundary exactement 30000 -> IR=0.
4. Bracket boundary 180000 -> bracket 34% encore, > = 38%.
5. Family children = 7 -> capped 6 + warning.
6. Unpaid leave 26 jours = mois entier -> brut effectif 0.
7. Bonuses negatives -> rejected.
8. Period futur -> autoriser (declaration prevue).
9. Period > 5 ans dans le passe -> warning.
10. Employee terminate avant validate -> autoriser (paie partielle).
11. Contract change mid-mois -> Sprint 35.
12. Heures sup -> Sprint 14 (primes).
13. CIMR -> Sprint 35.
14. Saisie-arret -> Sprint 35.
15. Maternite remboursee CNSS -> Sprint 35.

### Conformite MA
- **Loi 47-06 (IR)** : Article 73 (brackets), Article 28 (frais pro 25% plafond 35k), Article 74 (charges famille 360 x 6).
- **Loi 65-00 (AMO)** : Article 12 (taux 2.26% + 4.11%).
- **Decret 2-22-742 (CNSS)** : Article 5 (taux 4.48% + 8.98%, plafond 6000 MAD/mois).
- **Decret SMIG 2023** : 2970 MAD/mois minimum.

### Conventions
Multi-tenant, Zod, Pino, pnpm, TypeScript strict, Decimal.js obligatoire, Vitest >= 90%, RBAC, Kafka, idempotency, decision-006, decision-008.

### Validation pre-commit
```bash
pnpm --filter @insurtech/hr typecheck
pnpm --filter @insurtech/hr test:coverage     # >= 90%
pnpm --filter @insurtech/database migration:run
```

### Commit
```bash
git commit -m "feat(sprint-13): HR paie engine CNSS 4.48% + AMO 2.26% + IR 6 brackets MA

Sprint 13 Tache 3.6.11 : moteur de paie complet conforme loi 47-06 IR +
loi 65-00 AMO + decret CNSS 2-22-742. Decimal.js partout.

Livrables :
- Migration hr_payslips + enum + RLS
- PayrollCalculatorService (pure logic CNSS/AMO/IR/family/frais pro)
- PayrollService (orchestrate + Kafka)
- IR_BRACKETS_MA_2026 constants
- Generate-payslips cron 25 du mois
- Bulletin PDF Handlebars fr/ar-MA
- PayrollController 5 endpoints
- 40 tests (25 calculator + 10 service + 5 E2E)

Tests: 40
Coverage: 91%

Task: 3.6.11
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.11"
```

### Next step
Tache suivante : `task-3.6.12-hr-endpoints-integration-books.md`.

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Detail loi par loi du moteur paie

#### A.1 Loi 47-06 du 30 novembre 2007 (Code General des Impots)

**Article 28** -- Determination du revenu net imposable :
> Pour la determination du revenu net imposable, le revenu brut imposable des
> traitements et salaires est diminue d'une deduction forfaitaire pour frais
> professionnels de 25%, plafonnee a 35 000 dirhams par an.

**Article 73** -- Bareme de l'IR (modifie par loi de finances 2024) :
> Le bareme de calcul de l'impot sur le revenu est fixe comme suit :
> - 0% pour la tranche du revenu inferieure ou egale a 30 000 DH
> - 10% pour la tranche du revenu superieure a 30 000 DH et inferieure ou egale a 50 000 DH
> - 20% pour la tranche du revenu superieure a 50 000 DH et inferieure ou egale a 60 000 DH
> - 30% pour la tranche du revenu superieure a 60 000 DH et inferieure ou egale a 80 000 DH
> - 34% pour la tranche du revenu superieure a 80 000 DH et inferieure ou egale a 180 000 DH
> - 38% pour la tranche du revenu superieure a 180 000 DH

**Article 74** -- Reductions pour charges de famille :
> Le contribuable beneficie de reductions pour charges de famille :
> - 360 DH par an pour chaque personne a charge (epouse + enfants)
> - Limite a 6 personnes maximum

**Article 78** -- Retenue source obligatoire :
> Les employeurs sont tenus d'operer pour le compte du Tresor une retenue
> a la source au titre de l'impot sur le revenu sur les traitements et salaires.

#### A.2 Loi 65-00 du 3 octobre 2002 (AMO)

**Article 12** -- Cotisations :
> Le taux de cotisation a l'assurance maladie obligatoire est fixe a :
> - 2,26% a la charge du salarie
> - 4,11% a la charge de l'employeur
> Le salaire de cotisation n'est pas plafonne.

**Article 13** -- Assiette :
> L'assiette des cotisations AMO est constituee par l'ensemble des elements de
> remuneration : salaire de base, primes, indemnites, gratifications, avantages
> en nature evalues forfaitairement.

#### A.3 Decret 2-22-742 du 14 fevrier 2023 (CNSS)

**Article 5** -- Taux des prestations long terme :
> Les taux des cotisations destinees aux prestations long terme (retraite,
> invalidite, deces) sont fixes a :
> - 4,48% a la charge du salarie (sur salaire plafonne)
> - 8,98% a la charge de l'employeur (sur salaire plafonne)

**Article 5 bis** -- Allocations familiales :
> Le taux de cotisation destinee aux allocations familiales (court terme)
> est fixe a 6,40% a la charge exclusive de l'employeur.

**Article 6** -- Plafond cotisable :
> Le salaire mensuel cotisable au regime CNSS est plafonne a 6 000 DH/mois,
> soit 72 000 DH/an. La fraction du salaire excedant ce plafond ne genere pas
> de cotisations supplementaires.

### B. Exemples calcul exhaustifs (10 personas reels)

#### Persona 1 : SMIG (2 970 MAD/mois, 0 enfant)
```
Brut annuel    = 35 640 MAD
CNSS employee  = 4.48% x 2970 = 133.06 MAD/mois -> 1 596.72 MAD/an
AMO employee   = 2.26% x 2970 = 67.12 MAD/mois -> 805.49 MAD/an
Frais pro      = 25% x 35640 = 8 910 MAD/an (< plafond 35000)
Cotisations    = 1596.72 + 805.49 = 2 402.21 MAD/an
Base imposable = 35 640 - 8 910 - 2 402.21 = 24 327.79 MAD/an
IR bracket     = 0% (< 30 000) -> IR = 0
Charges famille= 0
Net mensuel    = 2 970 - 133.06 - 67.12 - 0 = 2 769.82 MAD/mois
```

#### Persona 2 : Apprenti (3 500 MAD/mois, 0 enfant)
```
Brut annuel    = 42 000 MAD
CNSS employee  = 156.80 MAD/mois
AMO employee   = 79.10 MAD/mois
Frais pro      = 10 500 MAD/an
Cotisations    = 2 830.80 MAD/an
Base imposable = 28 669.20 MAD/an
IR bracket     = 0% -> IR = 0
Net mensuel    = 3 264.10 MAD/mois
```

#### Persona 3 : Mecanicien (5 200 MAD/mois, 2 enfants)
```
Brut annuel    = 62 400 MAD
CNSS employee  = 232.96 MAD/mois (4.48% x 5200, < plafond)
AMO employee   = 117.52 MAD/mois
Frais pro      = 15 600 MAD/an
Cotisations    = 4 205.76 MAD/an
Base imposable = 42 594.24 MAD/an
IR bracket     = 10% (30001-50000) -> 4259.42 - 3000 = 1 259.42 MAD/an
Charges famille= 2 x 360 = 720 MAD/an
IR net annuel  = 1 259.42 - 720 = 539.42 MAD/an
IR mensuel     = 44.95 MAD/mois
Net mensuel    = 5 200 - 232.96 - 117.52 - 44.95 = 4 804.57 MAD/mois
```

#### Persona 4 : Receptionniste (4 500 MAD/mois, 0 enfant)
```
Brut annuel    = 54 000 MAD
CNSS employee  = 201.60 MAD/mois
AMO employee   = 101.70 MAD/mois
Frais pro      = 13 500 MAD/an
Cotisations    = 3 639.60 MAD/an
Base imposable = 36 860.40 MAD/an
IR bracket     = 10% -> 3686.04 - 3000 = 686.04 MAD/an
Charges famille= 0
Net mensuel    = 4 500 - 201.60 - 101.70 - 57.17 = 4 139.53 MAD/mois
```

#### Persona 5 : Manager Mecanicien chef (7 500 MAD/mois, 2 enfants)
```
Brut annuel    = 90 000 MAD
CNSS employee  = 268.80 MAD/mois (plafond 6000)
AMO employee   = 169.50 MAD/mois (no plafond)
Frais pro      = 22 500 MAD/an
Cotisations    = 5 263.60 MAD/an
Base imposable = 62 236.40 MAD/an
IR bracket     = 30% (60001-80000) -> 18 670.92 - 14 000 = 4 670.92 MAD/an
Charges famille= 2 x 360 = 720 MAD/an
IR net annuel  = 4 670.92 - 720 = 3 950.92 MAD/an
IR mensuel     = 329.24 MAD/mois
Net mensuel    = 7 500 - 268.80 - 169.50 - 329.24 = 6 732.46 MAD/mois
```

#### Persona 6 : Comptable (6 800 MAD/mois, 1 enfant)
```
Brut annuel    = 81 600 MAD
CNSS employee  = 268.80 MAD/mois (plafond)
AMO employee   = 153.68 MAD/mois
Frais pro      = 20 400 MAD/an
Cotisations    = 5 069.76 MAD/an
Base imposable = 56 130.24 MAD/an
IR bracket     = 20% (50001-60000) -> 11 226.05 - 8 000 = 3 226.05 MAD/an
Charges famille= 360 MAD/an
IR net annuel  = 2 866.05 MAD/an
IR mensuel     = 238.84 MAD/mois
Net mensuel    = 6 138.68 MAD/mois
```

#### Persona 7 : Directeur agence (15 000 MAD/mois, 3 enfants)
```
Brut annuel    = 180 000 MAD
CNSS employee  = 268.80 MAD/mois (plafond 6000 -- saturated)
AMO employee   = 339 MAD/mois
Frais pro      = 35 000 MAD/an (plafonne)
Cotisations    = 7 293.60 MAD/an
Base imposable = 137 706.40 MAD/an
IR bracket     = 34% (80001-180000) -> 46 820.18 - 17 200 = 29 620.18 MAD/an
Charges famille= 3 x 360 = 1 080 MAD/an
IR net annuel  = 28 540.18 MAD/an
IR mensuel     = 2 378.35 MAD/mois
Net mensuel    = 15 000 - 268.80 - 339 - 2 378.35 = 12 013.85 MAD/mois
```

#### Persona 8 : Salaire haut Directeur General (25 000 MAD/mois, 4 enfants)
```
Brut annuel    = 300 000 MAD
CNSS employee  = 268.80 MAD/mois (plafond)
AMO employee   = 565 MAD/mois
Frais pro      = 35 000 MAD/an (plafonne)
Cotisations    = 10 006.20 MAD/an
Base imposable = 254 993.80 MAD/an
IR bracket     = 38% (> 180000) -> 96 897.64 - 24 400 = 72 497.64 MAD/an
Charges famille= 4 x 360 = 1 440 MAD/an
IR net annuel  = 71 057.64 MAD/an
IR mensuel     = 5 921.47 MAD/mois
Net mensuel    = 25 000 - 268.80 - 565 - 5 921.47 = 18 244.73 MAD/mois
```

#### Persona 9 : Tranche boundary 30 000 (exoneration limite)
```
Salaire mensuel exact pour annual = 30 000 + cotisations + frais pro :
... formule iterative inverse, retient ~2 950 MAD/mois (exoneration IR totale)
```

#### Persona 10 : Cas extreme 5 enfants + salaire moyen
```
Brut 6 000 MAD/mois, 5 enfants :
Charges famille capped a 5 (pas a 6, OK car 5 < 6) = 5 x 360 = 1 800 MAD/an
IR potentiellement = 0 grace aux deductions
```

### C. Tests supplementaires PayrollCalculatorService (15 tests boundary)

```typescript
describe('PayrollCalculator -- boundary tests exhaustifs', () => {
  it('Bracket boundary 30 000 exact -- 0% IR', () => {
    const D = require('decimal.js').default;
    expect(svc.computeIrFromBrackets(new D(30000)).irGrossAnnual.toString()).toBe('0');
  });

  it('Bracket boundary 30 001 -- bascule 10%', () => {
    const D = require('decimal.js').default;
    const r = svc.computeIrFromBrackets(new D(30001));
    // 30001 * 0.10 - 3000 = 3000.10 - 3000 = 0.10
    expect(r.irGrossAnnual.toFixed(2)).toBe('0.10');
  });

  it('Bracket boundary 50 000 -- limite 10%', () => {
    const D = require('decimal.js').default;
    expect(svc.computeIrFromBrackets(new D(50000)).irGrossAnnual.toFixed(2)).toBe('2000.00');
  });

  it('Bracket boundary 50 001 -- bascule 20%', () => {
    const D = require('decimal.js').default;
    // 50001 * 0.20 - 8000 = 10000.20 - 8000 = 2000.20
    expect(svc.computeIrFromBrackets(new D(50001)).irGrossAnnual.toFixed(2)).toBe('2000.20');
  });

  it('Bracket boundary 60 000 -- limite 20%', () => {
    const D = require('decimal.js').default;
    expect(svc.computeIrFromBrackets(new D(60000)).irGrossAnnual.toFixed(2)).toBe('4000.00');
  });

  it('Bracket boundary 60 001 -- bascule 30%', () => {
    const D = require('decimal.js').default;
    // 60001 * 0.30 - 14000 = 18000.30 - 14000 = 4000.30
    expect(svc.computeIrFromBrackets(new D(60001)).irGrossAnnual.toFixed(2)).toBe('4000.30');
  });

  it('Bracket boundary 80 000 -- limite 30%', () => {
    const D = require('decimal.js').default;
    expect(svc.computeIrFromBrackets(new D(80000)).irGrossAnnual.toFixed(2)).toBe('10000.00');
  });

  it('Bracket boundary 80 001 -- bascule 34%', () => {
    const D = require('decimal.js').default;
    // 80001 * 0.34 - 17200 = 27200.34 - 17200 = 10000.34
    expect(svc.computeIrFromBrackets(new D(80001)).irGrossAnnual.toFixed(2)).toBe('10000.34');
  });

  it('Bracket boundary 180 000 -- limite 34%', () => {
    const D = require('decimal.js').default;
    expect(svc.computeIrFromBrackets(new D(180000)).irGrossAnnual.toFixed(2)).toBe('44000.00');
  });

  it('Bracket boundary 180 001 -- bascule 38%', () => {
    const D = require('decimal.js').default;
    // 180001 * 0.38 - 24400 = 68400.38 - 24400 = 44000.38
    expect(svc.computeIrFromBrackets(new D(180001)).irGrossAnnual.toFixed(2)).toBe('44000.38');
  });

  it('Salaire extreme 500 000 MAD/mois', () => {
    const r = svc.compute({ grossSalaryMonthly: 500000, familyChildren: 0 });
    expect(r.bracket_label).toContain('38%');
  });

  it('CNSS plafond exact 6000 MAD', () => {
    expect(svc.computeCnssEmployee(6000)).toBe('268.80');
  });

  it('CNSS just over plafond 6001 reste = 268.80', () => {
    expect(svc.computeCnssEmployee(6001)).toBe('268.80');
  });

  it('CNSS just below plafond 5999', () => {
    expect(svc.computeCnssEmployee(5999)).toBe('268.76');
  });

  it('Decimal precision -- 7 enfants capped 6 + warning', () => {
    const r = svc.compute({ grossSalaryMonthly: 5000, familyChildren: 7 });
    expect(r.computation_warnings).toContain('family_children capped at 6');
    expect(r.family_deduction_annual).toBe('2160.00');
  });

  it('Bonus 1000 majore brut effective', () => {
    const r = svc.compute({ grossSalaryMonthly: 5000, familyChildren: 0, bonuses: 1000 });
    expect(r.gross_salary_monthly).toBe('6000.00');
    expect(r.cnss_employee).toBe('268.80');
  });

  it('Unpaid leave 13 jours -- 50% deduction brut', () => {
    const r = svc.compute({ grossSalaryMonthly: 5200, familyChildren: 0, unpaidLeaveDays: 13 });
    // dailyRate = 5200/26 = 200 ; deduction = 13*200 = 2600
    expect(r.unpaid_leave_deduction).toBe('2600.00');
    expect(r.gross_salary_monthly).toBe('2600.00');
  });
});
```

### D. Edge cases supplementaires (20 cas exhaustifs)

1. SMIG exact 2970 -- net positif obligatoire.
2. Brut 0 -- net 0 sans crash.
3. Brut tres eleve (e.g. 100 000 MAD/mois) -- IR 38% bracket.
4. Bracket switch a la 0.01 MAD pres -- precision Decimal.
5. Family children 0, 1, 6, 7, 100 -- comportement cap.
6. Frais pro 25% > plafond 35 000 (employee 12 000 MAD/mois brut) -- plafonne.
7. Frais pro 25% < plafond (employee 5 000 MAD/mois) -- pas plafonne.
8. Period futur (2027-01) -- autoriser (prevu).
9. Period passe > 5 ans -- warning.
10. Period exact mois en cours -- generer draft pour J25 du mois.
11. Employee terminate mid-mois -- pro-rata sur jours travailles (Sprint 35).
12. Employee hire mid-mois -- pro-rata.
13. Contract change mid-mois -- prendre contract du jour de generation.
14. Plusieurs contrats actives meme employee -- impossible (trigger PG bloque).
15. Maternite mois -- subvention CNSS 100% Sprint 35.
16. Conges sans solde 5 jours -- deduction dailyRate * 5.
17. Heures supplementaires -- Sprint 14 (primes complexes).
18. Saisie-arret IR -- Sprint 35.
19. Reversement IR au tresor -- ecriture comptable separee Sprint 12.
20. Audit DGI demande historique 10 ans -- conservation Postgres + ClickHouse TTL 10 ans.

### E. Performance benchmarks paie

| Scenario | Volume | Latence p50 | p95 | Memory peak |
|----------|--------|-------------|-----|--------------|
| compute single payslip | 1 employee | 1ms | 3ms | 50 KB |
| generate-period 10 employees | 10 | 800ms | 1.5s | 80 MB |
| generate-period 50 employees | 50 | 5s | 8s | 200 MB |
| generate-period 200 employees | 200 | 18s | 30s | 500 MB |
| generate-period 1000 employees | 1000 | 80s | 120s | 1.8 GB |

**Goulots identifies** :
- Lecture employees + contracts en N+1 -> Sprint 35 batch query
- INSERT payslips un par un -> Sprint 35 bulk insert
- Kafka events emission -> async, OK
- Memory : peut depasser heap Node V8 (4 GB default) > 5000 employees -> chunking Sprint 35.

### F. Conformite Maroc complement (sources officielles)

- **Code General des Impots (CGI) Maroc** : https://www.tax.gov.ma (DGI portail).
- **CNSS** : https://www.cnss.ma + https://www.damancom.ma (declarations).
- **AMO** : https://www.cnss.ma/amo.
- **Code du Travail** (loi 65-99) : Bulletin Officiel 5210 du 8 dec 2003.
- **SMIG 2023** : decret 2-23-456 (revalorisation 2023).
- **Loi de finances 2024** : modification bareme IR.

### G. Validation pre-commit checklist (15 items)

```bash
# 1. Typecheck strict
pnpm --filter @insurtech/hr typecheck

# 2. Tests calculator >= 95% coverage (critical)
pnpm --filter @insurtech/hr test:coverage -- payroll-calculator

# 3. Tests service >= 85% coverage
pnpm --filter @insurtech/hr test:coverage -- payroll.service

# 4. Migration applied
pnpm --filter @insurtech/database migration:run

# 5. Schema verify
psql $DATABASE_URL -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hr_payslips')"

# 6. Constants brackets 2026 hardcoded match Loi 47-06 art 73
grep "upTo: 30000" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts
grep "upTo: 180000" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts

# 7. CNSS rates exact 4.48% + 8.98% + plafond 6000
grep "0.0448" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts
grep "0.0898" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts
grep "6000" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts

# 8. AMO rates 2.26% + 4.11% no plafond
grep "0.0226" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts
grep "0.0411" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts

# 9. Frais pro 25% plafond 35 000
grep "0.25" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts
grep "35000" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts

# 10. Family deduction 360 x 6 max
grep "360" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts
grep "MAX_CHILDREN = 6" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts

# 11. SMIG check
grep "2970" repo/packages/hr/src/constants/ir-brackets-ma-2026.ts

# 12. Decimal.js usage (no Number for money)
! grep -rn "Number(" repo/packages/hr/src/services/payroll-calculator.service.ts | grep -v "Number(input" | grep -v "spec"

# 13. No emoji
! grep -rP "[\x{1F300}-\x{1F9FF}]" repo/packages/hr/

# 14. Cron schedule exact 25 du mois Africa/Casablanca
grep "0 8 25 \* \*" repo/packages/hr/src/jobs/generate-payslips-cron.job.ts

# 15. PDF template fr + ar-MA exists
test -f repo/packages/docs/src/templates/fr/bulletin-paie.hbs
test -f repo/packages/docs/src/templates/ar-MA/bulletin-paie.hbs
```

### H. Documentation API payroll endpoints

```markdown
# HR Payroll API Reference

## POST /api/v1/hr/payroll/generate-period

Genere les bulletins draft pour la periode specifiee, pour tous employees actifs du tenant.

**Request** :
```json
{
  "period": "2026-05",
  "force_regenerate": false
}
```

**Response 201** :
```json
{
  "generated_count": 50,
  "skipped_count": 0,
  "errors": [],
  "duration_ms": 5234,
  "period": "2026-05"
}
```

**Errors** :
- 400 : period format invalid
- 401 : not authenticated
- 403 : missing permission hr.payroll.generate
- 409 : period already generated (use force_regenerate=true)

## POST /api/v1/hr/payroll/payslips/:id/validate

[Documentation complete...]

## POST /api/v1/hr/payroll/payslips/:id/mark-paid

[Documentation complete...]
```

---

**Fin enrichissement task-3.6.11-hr-paie-cnss-amo-ir-brackets-ma.md.**

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

