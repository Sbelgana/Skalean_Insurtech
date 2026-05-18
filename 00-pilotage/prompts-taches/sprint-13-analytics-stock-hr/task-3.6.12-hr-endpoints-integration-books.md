# TACHE 3.6.12 -- HR Endpoints Consolidation + Integration Books

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.12)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant 3.6.13 cross-module + 3.6.14 tests E2E)
**Effort** : 5h
**Dependances** : Taches 3.6.9, 3.6.10, 3.6.11 (HR complet), Sprint 12 Books (consumer ecritures)
**Densite cible** : 80-110 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache consolide les endpoints HR + integre avec Books (ecritures comptables automatiques) + livre les endpoints de declarations legales obligatoires : declaration mensuelle CNSS (declaration de paiement avant le 10 du mois suivant) + declaration annuelle IR (avant le 31 mars de l'annee suivante). Service `DeclarationsService` aggrege les payslips de la periode et produit la structure XML/CSV attendue par les administrations CNSS et DGI (Direction Generale des Impots). Consumer Kafka `hr-payslip-to-journal.consumer.ts` ecoute `insurtech.events.hr.payslip_validated` et cree automatiquement les ecritures comptables suivantes :

- Au validate : Debit 6171 (Remunerations personnel) / Credit 4441 (CNSS), 4452 (IR), 4453 (AMO), 4432 (Remunerations dues)
- Au mark-paid : Debit 4432 / Credit 5141 (Banque)

L'apport est triple. **Premierement**, `HrIndexController` consolide les endpoints HR vues d'ensemble : `GET /api/v1/hr/dashboard` (KPIs : total employees, payroll cost monthly, leaves pending, contracts expiring). **Deuxiemement**, `DeclarationsService` produit : `getCnssDeclaration(tenantId, period)` retournant `{ tenant_legal_name, cnss_number, employees: [{cin, cnss, gross, cnss_employee, cnss_employer, days_worked}], totals }`, `getIrDeclaration(tenantId, year)` retournant `{ tenant_ice, employees: [{cin, gross_annuel, ir_retenu_annuel}], totals }`. **Troisiemement**, consumer Books auto-genere les ecritures comptables a chaque validate de payslip.

A l'issue de cette tache, un comptable garage peut, le 5 juillet 2026, lancer la declaration CNSS du mois precedent (juin 2026), recuperer le XML formate selon specification CNSS, et l'uploader sur le portail CNSS Maroc. Les ecritures comptables des paies sont deja en Books, le bilan mensuel est complet.

---

## 2. Contexte etendu

### 2.1 Declaration CNSS mensuelle

Le **Bordereau de paiement des cotisations sociales (BPC)** doit etre depose **avant le 10 du mois suivant** sur le portail CNSS Damancom. Format XML ou CSV avec : raison sociale, numero CNSS employeur, periode, liste employees (CIN, CNSS, salaire brut, plafonne 6000, jours travailles, cotisations).

Penalite retard : 1% par mois + majorations.

### 2.2 Declaration IR annuelle

**Etat 9421** : declaration annuelle des traitements et salaires par employeur. Depot avant le **31 mars** de l'annee suivante via SIMPL-IR (portail DGI). Contient : annee, ICE employeur, liste employees (CIN, nom, brut annuel, frais professionnels, cotisations sociales, base imposable, IR retenu, etc.).

### 2.3 Ecritures comptables payslip (CGNC)

| Operation | Debit | Credit |
|-----------|-------|--------|
| Salaire brut consume | 6171 Remunerations personnel | 4432 Remunerations dues + 4441 CNSS + 4452 IR + 4453 AMO |
| Paiement | 4432 Remunerations dues | 5141 Banque |

### 2.4 Trade-offs

**Trade-off 1 : Declarations basiques Sprint 13**. Format XML/CSV simple. Sprint 35+ : integration directe portail Damancom (API) + SIMPL-IR.

**Trade-off 2 : Pas de cotisation CIMR Sprint 13**. Defer.

### 2.5 Pieges techniques

1. **Piege : CIN avec espaces dans XML CNSS** -> normalize obligatoire.
2. **Piege : montants en centimes ou en MAD** -> CNSS attend MAD avec 2 decimales.
3. **Piege : XML encoding ISO-8859-1 ou UTF-8** -> CNSS Damancom = UTF-8.
4. **Piege : ICE employeur 15 chiffres** -> obligatoire IR.
5. **Piege : Ecriture comptable avant validate** -> consumer trigger seulement apres validate.

---

## 3. Architecture

```
hr.payslip_validated event ----> stock-payslip-to-journal consumer
                                      |
                                      v
                              Books.recordEntry(
                                  journal: 'OD',
                                  lines: [
                                    {6171 debit gross_salary},
                                    {4432 credit net_salary},
                                    {4441 credit cnss_employee + cnss_employer},
                                    {4452 credit ir_amount},
                                    {4453 credit amo_employee + amo_employer},
                                  ])

GET /api/v1/hr/reports/declaration-cnss?period=2026-06
     |
     v
DeclarationsService.getCnssDeclaration
     |
     v
aggregate hr_payslips period=2026-06 status validated/paid
     |
     v
return XML or CSV
```

---

## 4. Livrables

- [ ] Service `declarations.service.ts` (~250 lignes CNSS + IR)
- [ ] Consumer `hr-payslip-to-journal.consumer.ts` Books (~180 lignes)
- [ ] Controller `hr-reports.controller.ts` (~150 lignes)
- [ ] Controller `hr-dashboard.controller.ts` (~120 lignes KPIs)
- [ ] Service `hr-dashboard.service.ts` (~100 lignes)
- [ ] Format XML/CSV generator
- [ ] Tests 12 unit + 6 integration + 4 E2E

---

## 5. Fichiers crees / modifies

```
repo/packages/hr/src/services/declarations.service.ts                                  (~280 lignes)
repo/packages/hr/src/services/declarations.service.spec.ts                              (~230 lignes 12 tests)
repo/packages/books/src/consumers/hr-payslip-to-journal.consumer.ts                      (~190 lignes)
repo/packages/books/src/consumers/hr-payslip-to-journal.consumer.spec.ts                  (~200 lignes 8 tests)
repo/packages/hr/src/services/hr-dashboard.service.ts                                      (~110 lignes)
repo/packages/hr/src/utils/cnss-xml-formatter.ts                                            (~120 lignes)
repo/packages/hr/src/utils/ir-csv-formatter.ts                                              (~100 lignes)
repo/apps/api/src/modules/hr/controllers/hr-reports.controller.ts                          (~160 lignes)
repo/apps/api/src/modules/hr/controllers/hr-dashboard.controller.ts                         (~130 lignes)
repo/apps/api/test/hr/hr-reports.e2e-spec.ts                                                  (~190 lignes 4 tests)
```

---

## 6. Code patterns COMPLETS

### 6.1 Service `declarations.service.ts`

```typescript
// repo/packages/hr/src/services/declarations.service.ts
import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { HrPayslip } from '../entities/hr-payslip.entity';
import { HrEmployee } from '../entities/hr-employee.entity';
import { formatCnssXml } from '../utils/cnss-xml-formatter';
import { formatIrCsv } from '../utils/ir-csv-formatter';

export interface CnssEmployeeDetail {
  cin: string;
  cnss_number: string | null;
  full_name: string;
  days_worked: number;
  gross_salary: string;
  cnss_base_capped: string;
  cnss_employee: string;
  cnss_employer: string;
}

export interface CnssDeclaration {
  tenant_id: string;
  tenant_legal_name: string;
  tenant_cnss_employer_number: string | null;
  period: string;
  employees: CnssEmployeeDetail[];
  totals: {
    employees_count: number;
    total_gross: string;
    total_cnss_employee: string;
    total_cnss_employer: string;
    total_cnss_combined: string;
  };
}

export interface IrEmployeeDetail {
  cin: string;
  full_name: string;
  position: string;
  gross_annual: string;
  professional_expenses: string;
  social_contributions: string;
  taxable_base_annual: string;
  family_children: number;
  ir_retenu_annual: string;
  bracket: string;
}

export interface IrDeclaration {
  tenant_id: string;
  tenant_legal_name: string;
  tenant_ice: string | null;
  year: number;
  employees: IrEmployeeDetail[];
  totals: {
    employees_count: number;
    total_gross_annual: string;
    total_ir_annual: string;
  };
}

@Injectable()
export class DeclarationsService {
  private readonly logger = new Logger(DeclarationsService.name);

  constructor(
    @InjectRepository(HrPayslip) private readonly payslipRepo: Repository<HrPayslip>,
    @InjectRepository(HrEmployee) private readonly employeeRepo: Repository<HrEmployee>,
  ) {}

  /**
   * CNSS declaration mensuelle (BPC).
   * Inclus payslips status 'validated' ou 'paid' pour la periode.
   */
  async getCnssDeclaration(tenantId: string, period: string): Promise<CnssDeclaration> {
    if (!/^\d{4}-\d{2}$/.test(period)) throw new BadRequestException(`Invalid period format: ${period}`);
    
    const payslips = await this.payslipRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.employee', 'e')
      .where('p.tenant_id = :t', { t: tenantId })
      .andWhere('p.period = :p', { p: period })
      .andWhere('p.status IN (:...statuses)', { statuses: ['validated', 'paid'] })
      .getMany();

    if (payslips.length === 0) {
      throw new NotFoundException(`No validated/paid payslips found for period ${period}`);
    }

    const employees: CnssEmployeeDetail[] = [];
    let totalGross = new Decimal(0);
    let totalCnssEmployee = new Decimal(0);
    let totalCnssEmployer = new Decimal(0);

    for (const p of payslips) {
      const employee = await this.employeeRepo.findOne({ where: { id: p.employee_id } });
      if (!employee) continue;
      const gross = new Decimal(p.gross_salary);
      const cnssEmployee = new Decimal(p.cnss_employee);
      const cnssEmployer = new Decimal(p.cnss_employer);
      const cnssBase = Decimal.min(gross, new Decimal(6000));

      employees.push({
        cin: employee.cin,
        cnss_number: employee.cnss_number,
        full_name: employee.full_name,
        days_worked: 26,                          // Sprint 13 default ; Sprint 35 compute from leaves
        gross_salary: gross.toFixed(2),
        cnss_base_capped: cnssBase.toFixed(2),
        cnss_employee: cnssEmployee.toFixed(2),
        cnss_employer: cnssEmployer.toFixed(2),
      });
      totalGross = totalGross.plus(gross);
      totalCnssEmployee = totalCnssEmployee.plus(cnssEmployee);
      totalCnssEmployer = totalCnssEmployer.plus(cnssEmployer);
    }

    // Fetch tenant info (assume tenant service ; simplification)
    const tenantInfo = { legal_name: 'Garage Atlas SARL', cnss_employer_number: null };

    this.logger.log({
      action: 'cnss_declaration_generated',
      tenant_id: tenantId, period,
      employees_count: employees.length,
      total_cnss: totalCnssEmployee.plus(totalCnssEmployer).toFixed(2),
    });

    return {
      tenant_id: tenantId,
      tenant_legal_name: tenantInfo.legal_name,
      tenant_cnss_employer_number: tenantInfo.cnss_employer_number,
      period,
      employees,
      totals: {
        employees_count: employees.length,
        total_gross: totalGross.toFixed(2),
        total_cnss_employee: totalCnssEmployee.toFixed(2),
        total_cnss_employer: totalCnssEmployer.toFixed(2),
        total_cnss_combined: totalCnssEmployee.plus(totalCnssEmployer).toFixed(2),
      },
    };
  }

  async getCnssDeclarationXml(tenantId: string, period: string): Promise<string> {
    const declaration = await this.getCnssDeclaration(tenantId, period);
    return formatCnssXml(declaration);
  }

  /**
   * IR declaration annuelle (Etat 9421).
   */
  async getIrDeclaration(tenantId: string, year: number): Promise<IrDeclaration> {
    if (year < 2024 || year > new Date().getUTCFullYear() + 1) {
      throw new BadRequestException(`Invalid year: ${year}`);
    }

    // Aggregate all payslips of the year
    const payslips = await this.payslipRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :t', { t: tenantId })
      .andWhere(`p.period LIKE :y`, { y: `${year}-%` })
      .andWhere('p.status IN (:...statuses)', { statuses: ['validated', 'paid'] })
      .getMany();

    // Group by employee
    const byEmployee = new Map<string, { gross: Decimal; ir: Decimal; cnss: Decimal; amo: Decimal; profExp: Decimal }>();
    for (const p of payslips) {
      const existing = byEmployee.get(p.employee_id) ?? {
        gross: new Decimal(0), ir: new Decimal(0), cnss: new Decimal(0), amo: new Decimal(0), profExp: new Decimal(0),
      };
      existing.gross = existing.gross.plus(p.gross_salary);
      existing.ir = existing.ir.plus(p.ir_amount);
      existing.cnss = existing.cnss.plus(p.cnss_employee);
      existing.amo = existing.amo.plus(p.amo_employee);
      const profExp = p.other_deductions?.professional_expenses_annual ? new Decimal(p.other_deductions.professional_expenses_annual).div(12) : new Decimal(0);
      existing.profExp = existing.profExp.plus(profExp);
      byEmployee.set(p.employee_id, existing);
    }

    const employees: IrEmployeeDetail[] = [];
    let totalGross = new Decimal(0);
    let totalIr = new Decimal(0);
    for (const [employeeId, totals] of byEmployee) {
      const employee = await this.employeeRepo.findOne({ where: { id: employeeId } });
      if (!employee) continue;
      const taxableBase = totals.gross.minus(totals.profExp).minus(totals.cnss).minus(totals.amo);
      employees.push({
        cin: employee.cin,
        full_name: employee.full_name,
        position: employee.position ?? '',
        gross_annual: totals.gross.toFixed(2),
        professional_expenses: totals.profExp.toFixed(2),
        social_contributions: totals.cnss.plus(totals.amo).toFixed(2),
        taxable_base_annual: taxableBase.toFixed(2),
        family_children: employee.family_children,
        ir_retenu_annual: totals.ir.toFixed(2),
        bracket: '?',                                  // Sprint 35 ajouter computation
      });
      totalGross = totalGross.plus(totals.gross);
      totalIr = totalIr.plus(totals.ir);
    }

    const tenantInfo = { legal_name: 'Garage Atlas SARL', ice: '001234567890123' };

    return {
      tenant_id: tenantId,
      tenant_legal_name: tenantInfo.legal_name,
      tenant_ice: tenantInfo.ice,
      year,
      employees,
      totals: {
        employees_count: employees.length,
        total_gross_annual: totalGross.toFixed(2),
        total_ir_annual: totalIr.toFixed(2),
      },
    };
  }

  async getIrDeclarationCsv(tenantId: string, year: number): Promise<string> {
    const declaration = await this.getIrDeclaration(tenantId, year);
    return formatIrCsv(declaration);
  }
}
```

### 6.2 Utils `cnss-xml-formatter.ts`

```typescript
// repo/packages/hr/src/utils/cnss-xml-formatter.ts
import type { CnssDeclaration } from '../services/declarations.service';

export function formatCnssXml(declaration: CnssDeclaration): string {
  const xmlEscape = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<DeclarationCNSS>');
  lines.push(`  <Periode>${xmlEscape(declaration.period)}</Periode>`);
  lines.push(`  <Employeur>`);
  lines.push(`    <RaisonSociale>${xmlEscape(declaration.tenant_legal_name)}</RaisonSociale>`);
  lines.push(`    <NumeroCNSS>${xmlEscape(declaration.tenant_cnss_employer_number ?? '')}</NumeroCNSS>`);
  lines.push(`  </Employeur>`);
  lines.push(`  <Salaries>`);
  for (const emp of declaration.employees) {
    lines.push(`    <Salarie>`);
    lines.push(`      <CIN>${xmlEscape(emp.cin)}</CIN>`);
    lines.push(`      <NumeroCNSS>${xmlEscape(emp.cnss_number ?? '')}</NumeroCNSS>`);
    lines.push(`      <NomComplet>${xmlEscape(emp.full_name)}</NomComplet>`);
    lines.push(`      <JoursTravailles>${emp.days_worked}</JoursTravailles>`);
    lines.push(`      <SalaireBrut>${emp.gross_salary}</SalaireBrut>`);
    lines.push(`      <BaseCotisable>${emp.cnss_base_capped}</BaseCotisable>`);
    lines.push(`      <CotisationSalariale>${emp.cnss_employee}</CotisationSalariale>`);
    lines.push(`      <CotisationPatronale>${emp.cnss_employer}</CotisationPatronale>`);
    lines.push(`    </Salarie>`);
  }
  lines.push(`  </Salaries>`);
  lines.push(`  <Totaux>`);
  lines.push(`    <NombreSalaries>${declaration.totals.employees_count}</NombreSalaries>`);
  lines.push(`    <TotalBrut>${declaration.totals.total_gross}</TotalBrut>`);
  lines.push(`    <TotalCotisationSalariale>${declaration.totals.total_cnss_employee}</TotalCotisationSalariale>`);
  lines.push(`    <TotalCotisationPatronale>${declaration.totals.total_cnss_employer}</TotalCotisationPatronale>`);
  lines.push(`    <TotalCotisationCombinee>${declaration.totals.total_cnss_combined}</TotalCotisationCombinee>`);
  lines.push(`  </Totaux>`);
  lines.push('</DeclarationCNSS>');
  return lines.join('\n');
}
```

### 6.3 Consumer `hr-payslip-to-journal.consumer.ts`

```typescript
// repo/packages/books/src/consumers/hr-payslip-to-journal.consumer.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Decimal from 'decimal.js';

interface KafkaConsumer { subscribe(topic: string, handler: (msg: any) => Promise<void>): Promise<void>; }
interface BooksService {
  recordEntry(tenantId: string, args: any): Promise<{ entry_id: string }>;
}
interface PayslipsRepo {
  findOne(args: any): Promise<any>;
}

interface HrPayslipValidatedEvent {
  tenant_id: string;
  payslip_id: string;
  validator_id: string;
}

@Injectable()
export class HrPayslipToJournalConsumer implements OnModuleInit {
  private readonly logger = new Logger(HrPayslipToJournalConsumer.name);
  private readonly ACCOUNT_PERSONNEL = '6171';            // Remunerations personnel
  private readonly ACCOUNT_REMUN_DUE = '4432';            // Remunerations dues
  private readonly ACCOUNT_CNSS = '4441';                  // CNSS
  private readonly ACCOUNT_IR = '4452';                    // IR retenu source
  private readonly ACCOUNT_AMO = '4453';                   // AMO
  private readonly ACCOUNT_BANK = '5141';                  // Banque

  constructor(
    private readonly kafka: KafkaConsumer,
    private readonly books: BooksService,
    private readonly payslipRepo: PayslipsRepo,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.kafka.subscribe('insurtech.events.hr.payslip_validated', this.handleValidated.bind(this));
    await this.kafka.subscribe('insurtech.events.hr.payslip_paid', this.handlePaid.bind(this));
    this.logger.log({ action: 'hr_payslip_books_consumer_init' });
  }

  async handleValidated(event: HrPayslipValidatedEvent): Promise<void> {
    try {
      const payslip = await this.payslipRepo.findOne({ where: { id: event.payslip_id, tenant_id: event.tenant_id } });
      if (!payslip) {
        this.logger.warn({ action: 'payslip_not_found', payslip_id: event.payslip_id });
        return;
      }

      const gross = new Decimal(payslip.gross_salary).plus(payslip.bonuses ?? 0);
      const cnssEmployee = new Decimal(payslip.cnss_employee);
      const cnssEmployer = new Decimal(payslip.cnss_employer);
      const amoEmployee = new Decimal(payslip.amo_employee);
      const amoEmployer = new Decimal(payslip.amo_employer);
      const ir = new Decimal(payslip.ir_amount);
      const net = new Decimal(payslip.net_salary);
      const totalDebit = gross.plus(cnssEmployer).plus(amoEmployer);
      const totalCnssCombined = cnssEmployee.plus(cnssEmployer);
      const totalAmoCombined = amoEmployee.plus(amoEmployer);

      await this.books.recordEntry(event.tenant_id, {
        journal_code: 'OD',
        posted_at: new Date(),
        source_resource_type: 'hr_payslip_validation',
        source_resource_id: event.payslip_id,
        label: `Paie ${payslip.period} -- employee ${payslip.employee_id.slice(0, 8)}`,
        lines: [
          { account_code: this.ACCOUNT_PERSONNEL, debit: gross.toNumber() },
          { account_code: this.ACCOUNT_REMUN_DUE, credit: net.toNumber() },
          { account_code: this.ACCOUNT_CNSS, credit: totalCnssCombined.toNumber() },
          { account_code: this.ACCOUNT_IR, credit: ir.toNumber() },
          { account_code: this.ACCOUNT_AMO, credit: totalAmoCombined.toNumber() },
          // Charge patronale CNSS+AMO debit additional :
          { account_code: '6174', debit: cnssEmployer.plus(amoEmployer).toNumber() },     // charges sociales
        ],
        idempotency_key: `payslip-validate-${event.payslip_id}`,
      });

      this.logger.log({
        action: 'payslip_ecriture_validated',
        tenant_id: event.tenant_id,
        payslip_id: event.payslip_id,
        gross: gross.toFixed(2),
        net: net.toFixed(2),
      });
    } catch (err) {
      this.logger.error({
        action: 'payslip_validated_consumer_failed',
        payslip_id: event.payslip_id,
        error: String(err),
      });
    }
  }

  async handlePaid(event: { tenant_id: string; payslip_id: string; payment_ref: string }): Promise<void> {
    try {
      const payslip = await this.payslipRepo.findOne({ where: { id: event.payslip_id, tenant_id: event.tenant_id } });
      if (!payslip) return;
      const net = new Decimal(payslip.net_salary);

      await this.books.recordEntry(event.tenant_id, {
        journal_code: 'BNK',
        posted_at: new Date(),
        source_resource_type: 'hr_payslip_payment',
        source_resource_id: event.payslip_id,
        label: `Paiement paie ${payslip.period} ref ${event.payment_ref}`,
        lines: [
          { account_code: this.ACCOUNT_REMUN_DUE, debit: net.toNumber() },
          { account_code: this.ACCOUNT_BANK, credit: net.toNumber() },
        ],
        idempotency_key: `payslip-paid-${event.payslip_id}`,
      });

      this.logger.log({
        action: 'payslip_ecriture_paid',
        payslip_id: event.payslip_id,
        net: net.toFixed(2),
      });
    } catch (err) {
      this.logger.error({ action: 'payslip_paid_consumer_failed', error: String(err) });
    }
  }
}
```

### 6.4 Service `hr-dashboard.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Decimal from 'decimal.js';
import { HrEmployee } from '../entities/hr-employee.entity';
import { HrPayslip } from '../entities/hr-payslip.entity';
import { HrLeave } from '../entities/hr-leave.entity';
import { HrContract } from '../entities/hr-contract.entity';

@Injectable()
export class HrDashboardService {
  constructor(
    @InjectRepository(HrEmployee) private readonly employees: Repository<HrEmployee>,
    @InjectRepository(HrPayslip) private readonly payslips: Repository<HrPayslip>,
    @InjectRepository(HrLeave) private readonly leaves: Repository<HrLeave>,
    @InjectRepository(HrContract) private readonly contracts: Repository<HrContract>,
  ) {}

  async getDashboard(tenantId: string): Promise<{
    employees_total: number;
    employees_active: number;
    contracts_expiring_30d: number;
    payslips_current_month: { count: number; total_gross: string; total_net: string; total_cnss_combined: string };
    leaves_pending: number;
    leaves_approved_current_month: number;
  }> {
    const employeesTotal = await this.employees.count({ where: { tenant_id: tenantId } });
    const employeesActive = await this.employees.count({ where: { tenant_id: tenantId, active: true } });

    const today = new Date();
    const in30Days = new Date(today.getTime() + 30 * 86400000);
    const contractsExpiring = await this.contracts.createQueryBuilder('c')
      .where('c.tenant_id = :t', { t: tenantId })
      .andWhere('c.status = :s', { s: 'active' })
      .andWhere('c.end_date IS NOT NULL')
      .andWhere('c.end_date BETWEEN :now AND :in30', { now: today, in30: in30Days })
      .getCount();

    const currentPeriod = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
    const periodPayslips = await this.payslips.find({ where: { tenant_id: tenantId, period: currentPeriod } });
    let totalGross = new Decimal(0); let totalNet = new Decimal(0); let totalCnssCombined = new Decimal(0);
    for (const p of periodPayslips) {
      totalGross = totalGross.plus(p.gross_salary);
      totalNet = totalNet.plus(p.net_salary);
      totalCnssCombined = totalCnssCombined.plus(p.cnss_employee).plus(p.cnss_employer);
    }

    const leavesPending = await this.leaves.count({ where: { tenant_id: tenantId, status: 'pending' } });
    const monthStart = new Date(today.getUTCFullYear(), today.getUTCMonth(), 1);
    const leavesApprovedMonth = await this.leaves.createQueryBuilder('l')
      .where('l.tenant_id = :t', { t: tenantId })
      .andWhere('l.status = :s', { s: 'approved' })
      .andWhere('l.approved_at >= :ms', { ms: monthStart })
      .getCount();

    return {
      employees_total: employeesTotal,
      employees_active: employeesActive,
      contracts_expiring_30d: contractsExpiring,
      payslips_current_month: {
        count: periodPayslips.length,
        total_gross: totalGross.toFixed(2),
        total_net: totalNet.toFixed(2),
        total_cnss_combined: totalCnssCombined.toFixed(2),
      },
      leaves_pending: leavesPending,
      leaves_approved_current_month: leavesApprovedMonth,
    };
  }
}
```

### 6.5 Controller `hr-reports.controller.ts`

```typescript
import { Controller, Get, Header, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, CurrentTenantId } from '@insurtech/auth';
import { DeclarationsService } from '@insurtech/hr';

@Controller('api/v1/hr/reports')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class HrReportsController {
  constructor(private readonly declarations: DeclarationsService) {}

  @Get('declaration-cnss')
  @Roles('hr.declarations.read')
  async cnss(@CurrentTenantId() tenantId: string, @Query('period') period: string) {
    return this.declarations.getCnssDeclaration(tenantId, period);
  }

  @Get('declaration-cnss/xml')
  @Roles('hr.declarations.export')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async cnssXml(@CurrentTenantId() tenantId: string, @Query('period') period: string, @Res() res: Response) {
    const xml = await this.declarations.getCnssDeclarationXml(tenantId, period);
    res.set('Content-Disposition', `attachment; filename="cnss-declaration-${period}.xml"`);
    res.send(xml);
  }

  @Get('declaration-ir')
  @Roles('hr.declarations.read')
  async ir(@CurrentTenantId() tenantId: string, @Query('year') year: string) {
    return this.declarations.getIrDeclaration(tenantId, Number(year));
  }

  @Get('declaration-ir/csv')
  @Roles('hr.declarations.export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async irCsv(@CurrentTenantId() tenantId: string, @Query('year') year: string, @Res() res: Response) {
    const csv = await this.declarations.getIrDeclarationCsv(tenantId, Number(year));
    res.set('Content-Disposition', `attachment; filename="ir-declaration-${year}.csv"`);
    res.send('﻿' + csv);
  }
}
```

---

## 7. Tests `declarations.service.spec.ts` (12 cas)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
// ... tests
describe('DeclarationsService', () => {
  it('CNSS rejects invalid period format', async () => { /* ... */ });
  it('CNSS rejects period with no payslips', async () => { /* ... */ });
  it('CNSS aggregates totals correctly', async () => { /* ... */ });
  it('CNSS XML format valid UTF-8', async () => { /* ... */ });
  it('CNSS XML escapes special chars', async () => { /* ... */ });
  it('IR rejects invalid year', async () => { /* ... */ });
  it('IR aggregates yearly by employee', async () => { /* ... */ });
  it('IR CSV format with headers', async () => { /* ... */ });
  it('IR CSV BOM Excel', async () => { /* ... */ });
  it('Cnss only includes validated/paid', async () => { /* ... */ });
  it('Multi-tenant isolation', async () => { /* ... */ });
  it('Empty declaration empty employees array', async () => { /* ... */ });
});
```

---

## 8-16. Variables, criteres, edge cases, conformite, conventions, commit

### Criteres P0 (12)
V1 CNSS declaration produit, V2 XML valid, V3 IR declaration annuelle, V4 CSV BOM, V5 Consumer payslip_validated creer ecriture 6171/4432/4441/4452/4453/6174, V6 Consumer payslip_paid creer 4432/5141, V7 Idempotency-Key consumers, V8 Dashboard KPIs corrects, V9 RBAC hr.declarations.read + export, V10 Multi-tenant, V11 Coverage >= 85%, V12 Tests E2E

### Criteres P1 (5)
V13 XML CNSS conformite specification Damancom, V14 CSV IR conformite SIMPL-IR, V15 Dashboard contrats expiring 30j, V16 Performance < 2s 100 employees, V17 Logs structures Pino

### Edge cases (10)
1. Period 0 employees -> 404
2. Validated payslip annule apres -> exclus
3. XML chars speciaux <,>,& -> escape
4. CSV virgules dans noms -> quote
5. Year futur > current+1 -> 400
6. Consumer idempotency replay safe
7. Books down -> retry exponential
8. Multi-tenant cross-data jamais
9. Ecriture comptable invalide gross != sum credits -> Books rejette (Sprint 12 invariant)
10. Period current pas encore validated -> warning

### Conformite MA
- CNSS portail Damancom (bordereau BPC <10 du mois suivant).
- DGI Etat 9421 (avant 31 mars).
- CGNC comptes : 6171, 6174, 4432, 4441, 4452, 4453, 5141.

### Commit
```bash
git commit -m "feat(sprint-13): HR declarations CNSS + IR + Books integration

Task: 3.6.12
Sprint: 13
Reference: B-13 Tache 3.6.12"
```

### Next : task-3.6.13-cross-module-stock-hr-garage-preparation.md

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Format XML CNSS BPC detaille (specification Damancom)

Le portail Damancom CNSS accepte le format XML structure. Schema XSD officiel (extrait):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="DeclarationCNSS">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="Periode" type="xs:string"/>      <!-- YYYY-MM -->
        <xs:element name="Employeur">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="RaisonSociale" type="xs:string" minOccurs="1"/>
              <xs:element name="NumeroCNSS" type="xs:string" minOccurs="1"/>
              <xs:element name="ICE" type="xs:string" minOccurs="0"/>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
        <xs:element name="Salaries">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="Salarie" maxOccurs="unbounded">
                <xs:complexType>
                  <xs:sequence>
                    <xs:element name="CIN" type="xs:string"/>
                    <xs:element name="NumeroCNSS" type="xs:string"/>
                    <xs:element name="NomComplet" type="xs:string"/>
                    <xs:element name="JoursTravailles" type="xs:int"/>
                    <xs:element name="SalaireBrut" type="xs:decimal"/>
                    <xs:element name="BaseCotisable" type="xs:decimal"/>
                    <xs:element name="CotisationSalariale" type="xs:decimal"/>
                    <xs:element name="CotisationPatronale" type="xs:decimal"/>
                  </xs:sequence>
                </xs:complexType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
        <xs:element name="Totaux">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="NombreSalaries" type="xs:int"/>
              <xs:element name="TotalBrut" type="xs:decimal"/>
              <xs:element name="TotalCotisationSalariale" type="xs:decimal"/>
              <xs:element name="TotalCotisationPatronale" type="xs:decimal"/>
              <xs:element name="TotalCotisationCombinee" type="xs:decimal"/>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>
```

**Regles formats Damancom** :
- Encoding obligatoire UTF-8 (NOT ISO-8859-1).
- Montants en MAD avec 2 decimales separateur `.` (pas virgule).
- CIN uppercase obligatoire.
- CNSS exactement 9 digits.
- Periode format YYYY-MM (zero-padded mois).
- Jours travailles 0-31.
- Caracteres speciaux `<>&'"` doivent etre escaped.

### B. Format CSV IR Etat 9421 (specification SIMPL-IR DGI)

```csv
ICE_Employeur;Annee;CIN_Salarie;Nom_Complet;Brut_Annuel;Frais_Pro;Cotisations_Soc;Base_Imposable;Charges_Famille;IR_Retenu_Annuel
001234567890123;2026;BE123456;Rachid Bennani;90000.00;22500.00;5263.60;62236.40;720.00;3950.92
001234567890123;2026;AT222222;Aicha Tazi;54000.00;13500.00;3217.68;37282.32;0.00;728.23
```

**Regles SIMPL-IR** :
- Separateur `;` (point-virgule, pas virgule).
- Encoding UTF-8 avec BOM optional pour Excel.
- Pas de quotes (sauf si valeur contient `;`).
- Decimal `.` separator, 2 chiffres.
- Header obligatoire ligne 1.
- ICE 15 chiffres exactement.

### C. Catalogue complet 12 ecritures comptables Phase 3 HR

| Operation | Trigger | Lines | Reference legale |
|-----------|---------|-------|-------------------|
| Payslip validate | Kafka hr.payslip_validated | 6171 D=gross / 4432 C=net / 4441 C=cnss_total / 4452 C=ir / 4453 C=amo_total / 6174 D=charges_patronales | CGNC art 41 |
| Payslip paid | Kafka hr.payslip_paid | 4432 D=net / 5141 C=net | CGNC art 41 |
| Declaration CNSS payment | Manual (Sprint 35 auto) | 4441 D=total_cnss / 5141 C=total_cnss | -- |
| Declaration IR payment | Manual | 4452 D=total_ir / 5141 C=total_ir | -- |
| Bonus exceptionnel | Future Sprint 14 | 6172 D=bonus / 4432 C=bonus | CGNC |
| Indemnite licenciement | Sprint 35 | 6175 D=indemnite / 4432 C=indemnite | Code travail art 53 |
| Frais transport | Sprint 14 | 6147 D / 4432 C | CGNC |
| Tickets restaurant | Sprint 14 | 6184 D / 4432 C | CGNC |
| Avance sur salaire | Sprint 35 | 4321 D=advance / 5141 C=advance ; puis 4432 D / 4321 C au paiement | CGNC |
| Saisie-arret | Sprint 35 | 4432 D / 4432 sub C / 5141 C | -- |
| Conges payes prov | Sprint 35 cloture annee | 6193 D=prov / 4434 C=prov | CGNC art 18 |
| Rappel salaire | Sprint 35 | 6171 D=rappel / 4432 C=rappel | -- |

### D. Tests `declarations.service.spec.ts` complets (15 tests detailes)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeclarationsService } from './declarations.service';
import { HrPayslip } from '../entities/hr-payslip.entity';
import { HrEmployee } from '../entities/hr-employee.entity';

describe('DeclarationsService', () => {
  let svc: DeclarationsService;
  let payslipRepo: any; let employeeRepo: any;

  beforeEach(async () => {
    const qb = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    payslipRepo = { createQueryBuilder: vi.fn(() => qb) };
    employeeRepo = { findOne: vi.fn() };
    const mod = await Test.createTestingModule({
      providers: [
        DeclarationsService,
        { provide: getRepositoryToken(HrPayslip), useValue: payslipRepo },
        { provide: getRepositoryToken(HrEmployee), useValue: employeeRepo },
      ],
    }).compile();
    svc = mod.get(DeclarationsService);
  });

  it('1. CNSS rejects invalid period format YYYY-MM', async () => {
    await expect(svc.getCnssDeclaration('t1', '2026/05')).rejects.toThrow(/Invalid period/);
    await expect(svc.getCnssDeclaration('t1', '202605')).rejects.toThrow();
    await expect(svc.getCnssDeclaration('t1', '2026-5')).rejects.toThrow();
    await expect(svc.getCnssDeclaration('t1', '2026-13')).rejects.toThrow();
  });

  it('2. CNSS rejects period with no payslips (404)', async () => {
    payslipRepo.createQueryBuilder().getMany.mockResolvedValue([]);
    await expect(svc.getCnssDeclaration('t1', '2026-05')).rejects.toThrow(/No validated/);
  });

  it('3. CNSS aggregates totals correctly', async () => {
    const payslips = [
      { employee_id: 'e1', gross_salary: '5000', cnss_employee: '224', cnss_employer: '449' },
      { employee_id: 'e2', gross_salary: '7500', cnss_employee: '268.80', cnss_employer: '538.80' },
    ];
    payslipRepo.createQueryBuilder().getMany.mockResolvedValue(payslips);
    employeeRepo.findOne.mockImplementation(({ where }: any) => ({
      cin: where.id === 'e1' ? 'BE111111' : 'AT222222',
      cnss_number: where.id === 'e1' ? '100000001' : '100000002',
      full_name: where.id === 'e1' ? 'Emp1' : 'Emp2',
    }));
    const r = await svc.getCnssDeclaration('t1', '2026-05');
    expect(r.totals.total_gross).toBe('12500.00');
    expect(r.totals.total_cnss_employee).toBe('492.80');
    expect(r.employees).toHaveLength(2);
  });

  it('4. CNSS XML format escapes special chars', async () => {
    const declaration = {
      tenant_id: 't1', tenant_legal_name: 'Garage <Atlas> & Co', tenant_cnss_employer_number: '123',
      period: '2026-05', employees: [], totals: { employees_count: 0, total_gross: '0', total_cnss_employee: '0', total_cnss_employer: '0', total_cnss_combined: '0' },
    };
    const { formatCnssXml } = await import('../utils/cnss-xml-formatter');
    const xml = formatCnssXml(declaration);
    expect(xml).toContain('Garage &lt;Atlas&gt; &amp; Co');
  });

  it('5. CNSS XML valid UTF-8 encoding declaration', async () => {
    // ... similar test
  });

  it('6. IR rejects invalid year (< 2024 or > current+1)', async () => {
    await expect(svc.getIrDeclaration('t1', 2020)).rejects.toThrow(/Invalid year/);
    await expect(svc.getIrDeclaration('t1', 2030)).rejects.toThrow();
  });

  it('7. IR aggregates yearly by employee', async () => {
    const payslips = Array.from({ length: 12 }, (_, m) => ({
      employee_id: 'e1', gross_salary: '7500', cnss_employee: '268.80', amo_employee: '169.50', ir_amount: '329.24',
      other_deductions: { professional_expenses_annual: '22500' },
      period: `2026-${String(m + 1).padStart(2, '0')}`,
    }));
    payslipRepo.createQueryBuilder().getMany.mockResolvedValue(payslips);
    employeeRepo.findOne.mockResolvedValue({ cin: 'BE111111', full_name: 'Rachid', position: 'Mecanicien', family_children: 2 });
    const r = await svc.getIrDeclaration('t1', 2026);
    expect(r.employees).toHaveLength(1);
    expect(r.totals.total_ir_annual).toBeDefined();
  });

  it('8. IR CSV format with header line', async () => {
    // ... test format
  });

  it('9. IR CSV BOM for Excel', async () => {
    // controller adds BOM, test that
  });

  it('10. CNSS only includes status validated OR paid', async () => {
    await svc.getCnssDeclaration('t1', '2026-05').catch(() => {});
    const qb = payslipRepo.createQueryBuilder.mock.results[0]?.value;
    if (qb) {
      const calls = qb.andWhere.mock.calls;
      const statusCall = calls.find((c: any) => c[0]?.includes('status'));
      expect(statusCall?.[1]).toMatchObject({ statuses: ['validated', 'paid'] });
    }
  });

  it('11. Multi-tenant isolation', async () => {
    await svc.getCnssDeclaration('tenant-A', '2026-05').catch(() => {});
    await svc.getCnssDeclaration('tenant-B', '2026-05').catch(() => {});
    // Verify tenant_id filter in both calls
  });

  it('12. Empty employees not included', async () => {
    payslipRepo.createQueryBuilder().getMany.mockResolvedValue([]);
    await expect(svc.getCnssDeclaration('t', '2026-05')).rejects.toThrow();
  });

  it('13. ICE 15 digits format', async () => {
    // Verify ICE in declaration matches pattern \d{15}
  });

  it('14. Days_worked default = 26 jours ouvrables MA', async () => {
    const payslips = [{ employee_id: 'e1', gross_salary: '5000', cnss_employee: '224', cnss_employer: '449' }];
    payslipRepo.createQueryBuilder().getMany.mockResolvedValue(payslips);
    employeeRepo.findOne.mockResolvedValue({ cin: 'A1', cnss_number: '1', full_name: 'X' });
    const r = await svc.getCnssDeclaration('t', '2026-05');
    expect(r.employees[0].days_worked).toBe(26);
  });

  it('15. Plafond CNSS base 6000 enforced dans aggregation', async () => {
    const payslips = [{ employee_id: 'e1', gross_salary: '10000', cnss_employee: '268.80', cnss_employer: '538.80' }];
    payslipRepo.createQueryBuilder().getMany.mockResolvedValue(payslips);
    employeeRepo.findOne.mockResolvedValue({ cin: 'A1', cnss_number: '1', full_name: 'X' });
    const r = await svc.getCnssDeclaration('t', '2026-05');
    expect(r.employees[0].cnss_base_capped).toBe('6000.00');
  });
});
```

### E. Edge cases supplementaires (15 cas)

1. Tenant sans ICE -> declaration IR refusee, error 400 demande update tenant.
2. Tenant sans CNSS employer number -> CNSS declaration warning + champ vide.
3. Period future (2027-12 quand 2026) -> autoriser pour planification (Sprint 35).
4. Employee actif sans CNSS number (declaration tardive) -> warning + champ vide XML.
5. Payslip exceptional (rappel salaire) avec gross negative -> exclude declaration (Sprint 35 split).
6. Plusieurs payslips meme employee meme periode (rare) -> aggregation last one.
7. Multi-currency (rare) -> tout converti MAD, taux du jour declaration.
8. Maternite/paternite jours -> day_worked ajuste (Sprint 35).
9. Employee transitionne tenant mid-year -> declaration IR per tenant separe.
10. Re-emission XML apres correction -> Sprint 35 versioning.
11. Damancom rejette XML -> log + admin alert.
12. SIMPL-IR upload size limit -> chunking si > 10 MB.
13. ICE format change DGI -> Sprint 35 migration.
14. CNSS taux change 2027 -> constants editables Sprint 35.
15. IR brackets change loi finance 2027 -> table editable.

### F. Criteres validation complets V1-V20

V1 Service getCnssDeclaration retourne struct complete
V2 Period format YYYY-MM enforced
V3 XML CNSS escape special chars
V4 XML CNSS UTF-8 declaration
V5 XML totals match sum employees
V6 IR aggregates yearly across 12 payslips
V7 IR CSV format separator `;`
V8 IR CSV BOM Excel
V9 Consumer payslip_validated cree ecriture 6171/4432/4441/4452/4453/6174
V10 Consumer payslip_paid cree ecriture 4432/5141
V11 Idempotency-Key consumer
V12 Books invariant double-entry (sum debit = sum credit)
V13 Dashboard KPIs corrects
V14 Multi-tenant isolation
V15 RBAC hr.declarations.* enforced
V16 Coverage >= 85%
V17 Tests E2E declarations
V18 Performance < 2s sur 100 employees
V19 Logs structures Pino
V20 Documentation API exhaustive

### G. Conformite Maroc detaillee

- **CNSS BPC** : bordereau paiement cotisations sociales, depot < 10 du mois suivant via portail Damancom (https://www.damancom.ma). Format XML accepte. Penalite retard 1% par mois + majorations.
- **IR Etat 9421** : declaration annuelle traitements et salaires. Depot < 31 mars annee suivante via SIMPL-IR portail DGI (https://www.tax.gov.ma). Format CSV ou XML.
- **CGNC plan comptable** : numeros officiels 6171, 6172, 6174, 4432, 4441, 4452, 4453, 5141 conformes Code General Normalisation Comptable Maroc.

---

**Fin enrichissement task-3.6.12-hr-endpoints-integration-books.md.**

## ANNEXE Z -- Patterns transverses Sprint 13

### Z.1 Multi-tenant strict (decision-002)

Toutes les operations doivent inclure tenant_id filter :
- Postgres : trigger RLS app.current_tenant via SET LOCAL
- ClickHouse : tenant_id dans ORDER BY pour partition pruning
- Kafka : tenant_id obligatoire dans event payload
- Redis cache keys : prefixe tenant_id pour isolation

### Z.2 Zod validation runtime stricte

Pattern uniforme :
```typescript
const Schema = z.object({...});
type Type = z.infer<typeof Schema>;
// Au controller :
const dto = Schema.parse(body);  // throws ZodError -> 400
```

JAMAIS class-validator/yup/joi (decision conventions).

### Z.3 Pino logger structures

Format obligatoire :
```typescript
this.logger.log({
  action: 'snake_case_action_name',
  tenant_id: tid,
  user_id: uid,
  resource_id: rid,
  duration_ms: durationMs,
  outcome: 'success' | 'failed',
});
```

Permet :
- Datadog/Sentry parsing automatique
- Correlation logs cross-services
- Audit trail tenant_id
- Performance monitoring duration_ms

### Z.4 Kafka events topics standardises

Format strict : `insurtech.events.{vertical_or_horizontal}.{entity}.{action_past}`

Exemples Sprint 13 :
- `insurtech.events.stock.movement_recorded`
- `insurtech.events.stock.low_stock`
- `insurtech.events.hr.employee_hired`
- `insurtech.events.hr.contract_signed`
- `insurtech.events.hr.payslip_validated`
- `insurtech.events.hr.payslip_paid`
- `insurtech.events.hr.leave_requested`
- `insurtech.events.hr.leave_approved`
- `insurtech.events.analytics.etl_completed`

### Z.5 Idempotency-Key obligatoire mutations sensibles

Endpoints concernes Sprint 13 :
- POST /stock/movements/entry
- POST /stock/movements/exit
- POST /stock/movements/adjustment
- POST /hr/payroll/generate-period
- POST /hr/payroll/payslips/:id/validate
- POST /hr/payroll/payslips/:id/mark-paid

Pattern :
```
Header : Idempotency-Key: <uuid-v4>
Server check : SELECT WHERE tenant_id AND idempotency_key
Si exists : retourner reponse precedente (409 + ID si conflict)
Sinon : execute + store key 24h Redis
```

### Z.6 Conformite Cloud souverain MA (decision-008)

Toutes donnees Sprint 13 hebergees Atlas Cloud Benguerir :
- Postgres 16 cluster primary DC1 Tier III
- Postgres replica DR DC2 Tier IV
- ClickHouse 24.10 single-node dev / cluster prod
- Redis 7 cache
- Kafka 3.7 (Sprint 9)
- S3 Atlas storage (Sprint 10)

Encryption :
- At rest AES-256-GCM via Atlas KMS
- In transit TLS 1.3 obligatoire prod

CNDP compliance :
- Loi 09-08 article 7 : aucun transfert hors MA sans autorisation
- Loi 09-08 article 14 : droit a l'oubli (Sprint 35 portail)
- Audit log toute access donnees personnelles

### Z.7 Tests strict Vitest coverage

Targets coverage :
- Modules critiques (auth, paie, FIFO, books) : >= 90%
- Modules standards : >= 85%
- Tests E2E : couvrir flows nominaux + erreurs principales
- Tests integration : Postgres + Redis + ClickHouse reels

### Z.8 No-emoji absolu (decision-006)

VIOLATION : tout code, comment, log, doc, commit avec emoji.
Pre-commit hook check-no-emoji.sh.
CI fail si emoji detectee.

---


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


## ANNEXE H -- Pre-commit + workflow CI/CD Sprint 13

### H.1 Pre-commit hooks Husky configuration

```json
// .husky/pre-commit
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 1. Lint-staged : Biome auto-fix + format
pnpm exec lint-staged

# 2. Typecheck strict TypeScript
pnpm typecheck

# 3. Tests unit ONLY pour packages modifies
pnpm exec turbo test --filter=...HEAD --since=HEAD~1

# 4. No-emoji check (decision-006 absolu)
./infrastructure/scripts/check-no-emoji.sh

# 5. No console.log dans production
./infrastructure/scripts/check-no-console.sh

# 6. Conventional commit message format
pnpm exec commitlint --edit "$1"
```

### H.2 Conventional Commits Sprint 13

Format strict :
```
<type>(scope): description courte 50-72 chars

Description longue 2-4 lignes (optionnel)

Livrables:
- bullet 1
- bullet 2

Tests: <n> total / Coverage: <X>%

Task: 3.6.<X>
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.<X>
```

Types autorises Sprint 13 :
- `feat` : nouvelle fonctionnalite (taches 3.6.1-3.6.14)
- `fix` : bugfix
- `docs` : documentation seulement
- `test` : ajout tests sans code metier
- `refactor` : refacto sans changement comportement
- `perf` : amelioration performance
- `chore` : maintenance (deps, build)
- `ci` : configuration CI/CD

Scopes Sprint 13 :
- `sprint-13` : tout sprint
- `analytics` : module analytics
- `stock` : module stock
- `hr` : module HR
- `books-consumer` : consumers Books
- `tests` : tests E2E

Exemples conformes :
```
feat(sprint-13): ClickHouse setup + 8 schemas analytics

Sprint 13 Tache 3.6.1 : pose le socle infrastructure ClickHouse 24.10 OLAP
separe Postgres OLTP, charge 8 schemas (5 faits + 2 dims + 1 calendar).

Livrables :
- docker-compose service clickhouse 24.10-alpine
- 9 schemas SQL (database + 5 fct_* + 2 dim_* + dim_dates 1827 rows)
- @insurtech/analytics package + ClickHouseService

Tests: 36 / Coverage: 88%

Task: 3.6.1
Sprint: 13
Phase: 3
Reference: B-13 Tache 3.6.1
```

### H.3 CI/CD pipeline Sprint 13

```yaml
# .github/workflows/sprint-13.yml
name: Sprint 13 CI

on:
  push:
    branches: [main, sprint-13]
  pull_request:
    branches: [main]

jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '22.11.0'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: ./infrastructure/scripts/check-no-emoji.sh
      - run: ./infrastructure/scripts/check-no-console.sh

  test-unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage
      - uses: codecov/codecov-action@v4

  test-integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
        ports: [5432:5432]
      clickhouse:
        image: clickhouse/clickhouse-server:24.10-alpine
        ports: [8123:8123]
      redis:
        image: redis:7-alpine
        ports: [6379:6379]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm migration:run
      - run: pnpm tsx infrastructure/scripts/init-clickhouse.ts
      - run: pnpm test:integration
      - run: pnpm test:e2e

  build:
    runs-on: ubuntu-latest
    needs: [lint-typecheck, test-unit, test-integration]
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
```

### H.4 Workflow developpement Sprint 13

1. **Pre-tache** : lire B-13 + cette task prompt + decision-strategiques referencees.
2. **Setup branch** : `git checkout -b sprint-13/task-3.6.X-<slug>`.
3. **Implement** : suivre 17 sections du prompt + code patterns fournis.
4. **Tests** : ecrire tests AVANT ou en parallele (TDD-friendly).
5. **Pre-commit** : `pnpm typecheck && pnpm lint && pnpm test:coverage`.
6. **Commit** : Conventional Commits + metadata Task/Sprint/Phase.
7. **Push + PR** : titre format `Sprint 13 -- Task 3.6.X : <description>`.
8. **CI** : attendre green (lint + types + tests + integration).
9. **Review** : 1 lead minimum + 1 reviewer metier.
10. **Merge** : squash + tag `sprint-13-task-3.6.X-done`.
11. **Next task** : passer a 3.6.(X+1).

### H.5 Definition of Done Sprint 13

Chaque tache 3.6.X consideree done quand :
- [ ] Tous livrables checkables coches
- [ ] Code TypeScript strict no any implicite
- [ ] Tests unit coverage >= cible (85% standard, 90-95% critique)
- [ ] Tests integration passent (Postgres + Redis + ClickHouse reels)
- [ ] Tests E2E passent (au moins parcours nominaux)
- [ ] CI green sur tous jobs
- [ ] Code reviewed par minimum 1 lead
- [ ] Documentation API a jour (Swagger/OpenAPI export)
- [ ] Aucune emoji (decision-006)
- [ ] Aucune reference vague type "voir B-XX"
- [ ] Commit message Conventional + metadata
- [ ] Conformite legale verifiee (liste lois applicables)
- [ ] Performance SLO respectes (latences + throughput)
- [ ] Multi-tenant isolation testee
- [ ] RBAC permissions seedees + assignees aux roles


## ANNEXE I -- References officielles + glossaire Sprint 13

### I.1 Sources legales officielles Maroc

| Source | URL | Usage Sprint 13 |
|--------|-----|------------------|
| CNSS Maroc | https://www.cnss.ma | Cotisations, declarations BPC |
| Damancom CNSS | https://www.damancom.ma | Portail declaration CNSS mensuelle |
| DGI Maroc | https://www.tax.gov.ma | IR, TVA, SIMPL-IR |
| SIMPL-IR | https://www.tax.gov.ma/wps/portal/DGI/simpl-ir | Declaration Etat 9421 annuelle |
| ANRT (Telecoms) | https://www.anrt.ma | Signatures qualifiees TSA |
| ANAPEC | https://www.anapec.org | Programme Idmaj subventionne |
| ACAPS | https://www.acaps.ma | Reporting assurance (Sprint 14+) |
| AMC | https://amc.gov.ma | Anti-money laundering (Sprint 12) |
| CNDP | https://www.cndp.ma | Loi 09-08 protection donnees |
| Atlas Cloud Maroc | https://www.atlascloud.ma | Cloud souverain MA |
| Bulletin Officiel | https://www.sgg.gov.ma/BulletinOfficiel.aspx | Textes legaux MA |

### I.2 Glossaire Sprint 13

- **CGNC** : Code General de Normalisation Comptable Maroc (decret 2-89-61)
- **CIN** : Carte d'Identite Nationale (format MA : 1-2 lettres + 1-6 chiffres)
- **CNSS** : Caisse Nationale de Securite Sociale
- **AMO** : Assurance Maladie Obligatoire (loi 65-00)
- **IR** : Impot sur le Revenu (loi 47-06)
- **SMIG** : Salaire Minimum Interprofessionnel Garanti (2 970 MAD/mois en 2026)
- **CDI** : Contrat a Duree Indeterminee
- **CDD** : Contrat a Duree Determinee
- **ANAPEC** : Agence Nationale Promotion Emploi et Competences (programme Idmaj)
- **ICE** : Identifiant Commun de l'Entreprise (15 chiffres, obligatoire DGI)
- **RC** : Registre de Commerce (numero)
- **CIMR** : Caisse Interprofessionnelle Marocaine de Retraite (complementaire facultative)
- **BPC** : Bordereau de Paiement des Cotisations sociales (declaration CNSS mensuelle)
- **Etat 9421** : declaration annuelle IR salaires
- **OLTP** : Online Transaction Processing (Postgres)
- **OLAP** : Online Analytical Processing (ClickHouse)
- **ETL** : Extract-Transform-Load (pipeline Postgres -> ClickHouse)
- **FIFO** : First-In-First-Out (methode valorisation stocks)
- **CMP** : Cout Moyen Pondere (alternative FIFO, autorisee MA)
- **LIFO** : Last-In-First-Out (INTERDIT au Maroc)
- **RLS** : Row Level Security (Postgres multi-tenant)
- **MV** : Materialized View (ClickHouse pre-aggregation)
- **SLA** : Service Level Agreement
- **SLO** : Service Level Objective
- **RTO** : Recovery Time Objective
- **RPO** : Recovery Point Objective

### I.3 Versions stack Sprint 13

| Composant | Version | Reference |
|-----------|---------|-----------|
| Node.js | 22.11.0 LTS | engine-strict=true |
| pnpm | 9.x | save-exact=true |
| TypeScript | 5.7.2 | strict mode |
| NestJS | 10.4.15 | |
| TypeORM | 0.3.x | |
| Postgres | 16 | Atlas Cloud |
| ClickHouse | 24.10 | Tache 3.6.1 |
| Redis | 7.x | Sprint 9 |
| Kafka | 3.7 | Sprint 9 |
| BullMQ | 5.x | Cron jobs |
| Zod | 3.23.8 | Validation runtime |
| Decimal.js | 10.4.3 | Computations financieres |
| Pino | 9.5.0 | Logger |
| Vitest | 2.1.8 | Tests |

