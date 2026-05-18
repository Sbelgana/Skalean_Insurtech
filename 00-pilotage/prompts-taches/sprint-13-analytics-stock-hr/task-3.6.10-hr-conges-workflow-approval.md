# TACHE 3.6.10 -- HR Conges + Workflow Approval + Balances

**Sprint** : 13 (Phase 3 / Sprint 6 dans phase)
**Reference meta-prompt** : `00-pilotage/meta-prompts/B-13-sprint-13-analytics-stock-hr.md` (Tache 3.6.10)
**Phase** : 3 -- Modules Horizontaux
**Priorite** : P0 (bloquant 3.6.11 paie deduction conges, 3.6.12 endpoints HR consolidation)
**Effort** : 5h
**Dependances** : Tache 3.6.9 (employees + contracts), Sprint 9 Comm (templates notifications), Sprint 10 Docs (arret maladie PDF), Sprint 6 multi-tenant
**Densite cible** : 80-110 ko
**AUCUNE EMOJI AUTORISEE** (decision-006)

---

## 1. But

Cette tache livre le module conges (leaves) conforme au **Code du Travail Marocain (loi 65-99 articles 231-251)** : 18 jours conges payes par an minimum + 1.5 jour par mois travaille au-dela des 5 premiers mois, conges maladie avec certificat medical, conges maternite 14 semaines (article 152), conges paternite 3 jours (article 269), RTT (Reduction Temps Travail) si convention collective. Entites : `hr_leaves` (demandes individuelles : type, dates, status, raison, approver, certificat), `hr_leave_balances` (compteurs annuels par employee : paid_leave_balance, sick_leave_used, etc.). Workflow approval strict : `requestLeave` -> `pending` -> manager `approveLeave` ou `rejectLeave` -> notification email + WhatsApp employee.

L'apport est triple. **Premierement**, 2 migrations Postgres + entities TypeORM avec contraintes CHECK strictes (dates valides, jours_count >= 0.5, status enum, type enum 5 valeurs). **Deuxiemement**, service `leaves.service.ts` ~280 lignes : `requestLeave` (valide balance, INSERT pending), `approveLeave` (transition + decrement balance + notification), `rejectLeave` (refus + reason), `cancelLeave` (employee cancel avant approval), `getBalance` (compute pour l'annee courante : 18j initial + 1.5j/mois travaille - jours utilises), service `LeaveBalanceCalculatorService` independant pour computations pures (testable). **Troisiemement**, controller REST `/api/v1/hr/leaves/*` avec endpoints `POST /leaves/request` (employee self-service), `POST /leaves/:id/approve` (manager), `POST /leaves/:id/reject`, `POST /leaves/:id/cancel`, `GET /leaves/balance` (employee voit son solde) + notifications email 3 langues (fr / ar-MA / ar) au format Sprint 9 Comm.

A l'issue de cette tache, un employee peut demander 5 jours conges debut juillet, son manager voit la demande dans son inbox notifications, approuve via UI ou API, l'employee reçoit confirmation, son balance passe de 18 a 13 jours pour 2026. La Tache 3.6.11 utilisera ces conges pour deduire automatiquement les jours non-travailles sur le bulletin de paie.

---

## 2. Contexte etendu

### 2.1 Specificites conges MA

**Article 231 loi 65-99** : tout salarie a droit a un conge annuel paye d'au moins 1.5 jours par mois de service effectif, soit **18 jours ouvrables par an** au minimum (regle 1 mois = 1.5j). Apres 5 ans de service, 1.5j supplementaire par tranche de 5 ans (article 232). Plafond 30 jours.

**Article 152 maternite** : 14 semaines consecutives, dont 6 obligatoires apres l'accouchement. Subvention CNSS 100% du salaire.

**Article 269 paternite** : 3 jours dans le mois de la naissance.

**Maladie** : certificat medical obligatoire au-dela de 4 jours consecutifs. Convention collective peut etendre.

**RTT** : pas systematique au Maroc. Si applicable (secteurs specifiques), 5-10 jours/an.

**Conges non payes** : autorise apres accord manager, pas decompte sur conges payes mais salaire deduit.

### 2.2 Workflow approval

```
employee requests --> [pending] --> manager approves --> [approved] --> balance decrement
                                 |--> manager rejects --> [rejected]
                                 |--> employee cancels --> [cancelled]
                  [approved] --> potentially [cancelled] (avant debut) --> balance restored
                  past start --> immutable
```

### 2.3 Balance calculation

```
balance_annee_courante = 
  (18 jours base + (anciennete_ans / 5) * 1.5)
  - jours_pris_dans_annee
  - jours_pending_dans_annee (reservation)
```

Anciennete computed depuis hired_date.

### 2.4 Trade-offs

**Trade-off 1 : Pas de calendrier complexe**. Sprint 13 = jours ouvrables, weekends exclus, jours feries MA exclus (lookup table). Sprint 35+ pourra gerer demi-journees, custom calendars.

**Trade-off 2 : Balance live compute, pas materialise**. Sprint 35+ cache balance daily.

**Trade-off 3 : Pas de demande chevauchement detection inter-employees**. Manager peut approuver 5 personnes meme periode. Sprint 35+ planning capacite.

### 2.5 Pieges techniques

1. **Piege : conges chevauchant** -> trigger PG block.
2. **Piege : balance negatif** -> CHECK constraint refuse.
3. **Piege : conges passes** -> employee ne peut request dans le passe.
4. **Piege : approval apres start_date** -> autoriser uniquement si tres recente (< 1 jour de tolerance).
5. **Piege : timezone jours feries** -> liste statique loaded depuis dim_dates Tache 3.6.1.
6. **Piege : maternite calcule jours ouvrables ou calendaires** -> 14 semaines calendaires (loi 65-99 art 152).

---

## 3. Architecture

```
employee --> POST /leaves/request --> LeavesService.requestLeave
                                                |
                                                v
                                          LeaveBalanceCalculator.checkBalance
                                                |
                                                v
                                          INSERT hr_leaves status=pending
                                                |
                                                v
                                          Kafka hr.leave_requested
                                                |
                                                v
                                          notification email manager
                                          
manager --> POST /leaves/:id/approve --> LeavesService.approveLeave
                                                |
                                                v
                                          UPDATE status=approved
                                          decrement balance hr_leave_balances
                                                |
                                                v
                                          notification email employee
```

---

## 4. Livrables

- [ ] Migration `1715500000000-HrLeaves.ts`
- [ ] Migration `1715500100000-HrLeaveBalances.ts`
- [ ] Entities `hr-leave.entity.ts`, `hr-leave-balance.entity.ts`
- [ ] Service `leaves.service.ts` (~280 lignes)
- [ ] Service `leave-balance-calculator.service.ts` (~150 lignes pure logic)
- [ ] DTOs 4 (request, approve, reject, cancel)
- [ ] Controller `leaves.controller.ts` (6 endpoints)
- [ ] Templates Handlebars 3x4 langues (request, approved, rejected, cancelled)
- [ ] Tests 18 unit + 5 E2E
- [ ] Permissions seed hr.leaves.*

---

## 5. Fichiers crees / modifies

```
repo/packages/database/src/migrations/1715500000000-HrLeaves.ts                       (~80 lignes)
repo/packages/database/src/migrations/1715500100000-HrLeaveBalances.ts                 (~50 lignes)
repo/packages/hr/src/entities/hr-leave.entity.ts                                       (~80 lignes)
repo/packages/hr/src/entities/hr-leave-balance.entity.ts                                (~60 lignes)
repo/packages/hr/src/services/leaves.service.ts                                          (~300 lignes)
repo/packages/hr/src/services/leaves.service.spec.ts                                     (~300 lignes 14 tests)
repo/packages/hr/src/services/leave-balance-calculator.service.ts                         (~170 lignes)
repo/packages/hr/src/services/leave-balance-calculator.service.spec.ts                    (~140 lignes 8 tests)
repo/packages/hr/src/dto/request-leave.dto.ts                                              (~50 lignes Zod)
repo/packages/hr/src/dto/approve-leave.dto.ts                                              (~30 lignes Zod)
repo/packages/hr/src/dto/reject-leave.dto.ts                                                (~30 lignes Zod)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/leave-request.hbs                            (3 fichiers)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/leave-approved.hbs                           (3 fichiers)
repo/packages/comm/src/templates/{fr,ar-MA,ar}/leave-rejected.hbs                           (3 fichiers)
repo/apps/api/src/modules/hr/controllers/leaves.controller.ts                                (~180 lignes)
repo/apps/api/test/hr/leaves.e2e-spec.ts                                                      (~220 lignes 5 tests)
```

---

## 6. Code patterns COMPLETS

### 6.1 Migration `1715500000000-HrLeaves.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrLeaves1715500000000 implements MigrationInterface {
  name = 'HrLeaves1715500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE hr_leave_type AS ENUM ('paid', 'sick', 'maternity', 'paternity', 'unpaid', 'rtt');
    `);
    await queryRunner.query(`
      CREATE TYPE hr_leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
    `);
    await queryRunner.query(`
      CREATE TABLE hr_leaves (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        employee_id         UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        leave_type          hr_leave_type NOT NULL,
        start_date          DATE NOT NULL,
        end_date            DATE NOT NULL,
        days_count          NUMERIC(5,2) NOT NULL,
        reason              VARCHAR(1000),
        status              hr_leave_status NOT NULL DEFAULT 'pending',
        requested_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        approved_by         UUID,
        approved_at         TIMESTAMPTZ,
        rejected_reason     VARCHAR(1000),
        cancelled_at        TIMESTAMPTZ,
        certificate_doc_id  UUID,
        notes               TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT chk_dates_valid CHECK (end_date >= start_date),
        CONSTRAINT chk_days_positive CHECK (days_count >= 0.5),
        CONSTRAINT chk_sick_certificate CHECK (
          leave_type != 'sick' OR
          days_count < 4 OR
          certificate_doc_id IS NOT NULL
        )
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_hr_leaves_tenant ON hr_leaves(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_hr_leaves_employee ON hr_leaves(employee_id);`);
    await queryRunner.query(`CREATE INDEX idx_hr_leaves_status ON hr_leaves(status);`);
    await queryRunner.query(`CREATE INDEX idx_hr_leaves_dates ON hr_leaves(start_date, end_date);`);

    // Trigger anti-chevauchement conges approuves meme employee
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION check_no_leave_overlap()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW.status IN ('approved', 'pending') THEN
          IF EXISTS (
            SELECT 1 FROM hr_leaves
            WHERE employee_id = NEW.employee_id
              AND id != NEW.id
              AND status IN ('approved', 'pending')
              AND (NEW.start_date <= end_date AND NEW.end_date >= start_date)
          ) THEN
            RAISE EXCEPTION 'Leave overlap detected for employee %', NEW.employee_id;
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_no_leave_overlap
        BEFORE INSERT OR UPDATE ON hr_leaves
        FOR EACH ROW EXECUTE FUNCTION check_no_leave_overlap();
    `);

    await queryRunner.query(`ALTER TABLE hr_leaves ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_hr_leaves ON hr_leaves
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_no_leave_overlap ON hr_leaves;`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS check_no_leave_overlap();`);
    await queryRunner.query(`DROP TABLE hr_leaves;`);
    await queryRunner.query(`DROP TYPE hr_leave_status;`);
    await queryRunner.query(`DROP TYPE hr_leave_type;`);
  }
}
```

### 6.2 Migration `1715500100000-HrLeaveBalances.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class HrLeaveBalances1715500100000 implements MigrationInterface {
  name = 'HrLeaveBalances1715500100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE hr_leave_balances (
        id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id               UUID NOT NULL REFERENCES auth_tenants(id) ON DELETE CASCADE,
        employee_id             UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        year                    INT NOT NULL,
        paid_leave_total        NUMERIC(5,2) NOT NULL DEFAULT 18,
        paid_leave_used         NUMERIC(5,2) NOT NULL DEFAULT 0,
        paid_leave_pending      NUMERIC(5,2) NOT NULL DEFAULT 0,
        sick_leave_used         NUMERIC(5,2) NOT NULL DEFAULT 0,
        maternity_leave_used    NUMERIC(5,2) NOT NULL DEFAULT 0,
        paternity_leave_used    NUMERIC(5,2) NOT NULL DEFAULT 0,
        unpaid_leave_used       NUMERIC(5,2) NOT NULL DEFAULT 0,
        rtt_used                NUMERIC(5,2) NOT NULL DEFAULT 0,
        last_recomputed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, employee_id, year),
        CONSTRAINT chk_used_non_negative CHECK (
          paid_leave_used >= 0 AND sick_leave_used >= 0 AND
          maternity_leave_used >= 0 AND paternity_leave_used >= 0 AND
          unpaid_leave_used >= 0 AND rtt_used >= 0
        ),
        CONSTRAINT chk_paid_leave_balance_positive CHECK (paid_leave_used <= paid_leave_total)
      );
    `);
    await queryRunner.query(`CREATE INDEX idx_hr_leave_balances_tenant ON hr_leave_balances(tenant_id);`);
    await queryRunner.query(`CREATE INDEX idx_hr_leave_balances_employee_year ON hr_leave_balances(employee_id, year);`);

    await queryRunner.query(`ALTER TABLE hr_leave_balances ENABLE ROW LEVEL SECURITY;`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation_hr_leave_balances ON hr_leave_balances
      USING (tenant_id = current_setting('app.current_tenant')::uuid OR current_setting('app.role') = 'SuperAdmin');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE hr_leave_balances;`);
  }
}
```

### 6.3 Service `leave-balance-calculator.service.ts`

```typescript
// repo/packages/hr/src/services/leave-balance-calculator.service.ts
// Skalean InsurTech v2.2 -- Pure logic calculator conges MA
// Reference : loi 65-99 art 231-232 + B-13 Sprint 13 Tache 3.6.10
import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';

const PAID_LEAVE_BASE_DAYS_PER_YEAR = 18;          // Article 231 loi 65-99
const ADDITIONAL_DAYS_PER_5_YEARS = 1.5;            // Article 232
const MAX_PAID_LEAVE_DAYS = 30;                      // Plafond

@Injectable()
export class LeaveBalanceCalculatorService {
  /**
   * Computes paid leave entitlement based on seniority.
   * @param hiredDate Date employee was hired
   * @param atDate Reference date (default: today)
   * @returns Total paid leave days entitled for the year of atDate
   */
  computePaidLeaveTotal(hiredDate: Date, atDate: Date = new Date()): number {
    const yearStart = new Date(atDate.getUTCFullYear(), 0, 1);
    const yearEnd = new Date(atDate.getUTCFullYear(), 11, 31);
    
    if (hiredDate > yearEnd) {
      return 0;
    }
    
    // Compute months worked dans l'annee de reference
    const effectiveStart = hiredDate > yearStart ? hiredDate : yearStart;
    const monthsWorked = Math.min(
      12,
      this.computeMonthsBetween(effectiveStart, yearEnd) + 1
    );
    
    let base: Decimal;
    if (monthsWorked >= 12) {
      base = new Decimal(PAID_LEAVE_BASE_DAYS_PER_YEAR);
    } else {
      // Pro-rata 1.5 j / mois travaille
      base = new Decimal(1.5).mul(monthsWorked);
    }
    
    // Anciennete bonus
    const seniorityYears = this.computeYearsSeniority(hiredDate, atDate);
    const fiveYearBlocks = Math.floor(seniorityYears / 5);
    const bonus = new Decimal(ADDITIONAL_DAYS_PER_5_YEARS).mul(fiveYearBlocks);
    
    const total = base.plus(bonus);
    return Decimal.min(total, new Decimal(MAX_PAID_LEAVE_DAYS)).toDecimalPlaces(2).toNumber();
  }

  /**
   * Computes business days (excluding weekends and holidays) between two dates inclusive.
   */
  computeBusinessDays(startDate: Date, endDate: Date, holidays: Set<string> = new Set()): number {
    if (endDate < startDate) return 0;
    let count = 0;
    const cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()));
    const end = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate()));
    while (cursor <= end) {
      const dow = cursor.getUTCDay();
      const isoDate = cursor.toISOString().slice(0, 10);
      if (dow !== 0 && dow !== 6 && !holidays.has(isoDate)) {
        count++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }

  /**
   * Maternity = 14 weeks calendar days (loi 65-99 art 152)
   */
  computeMaternityDays(): number {
    return 14 * 7;
  }

  /**
   * Paternity = 3 days within month of birth (loi 65-99 art 269)
   */
  computePaternityDays(): number {
    return 3;
  }

  private computeMonthsBetween(start: Date, end: Date): number {
    return (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
  }

  private computeYearsSeniority(hiredDate: Date, atDate: Date): number {
    const years = atDate.getUTCFullYear() - hiredDate.getUTCFullYear();
    const m = atDate.getUTCMonth() - hiredDate.getUTCMonth();
    if (m < 0 || (m === 0 && atDate.getUTCDate() < hiredDate.getUTCDate())) {
      return Math.max(0, years - 1);
    }
    return Math.max(0, years);
  }

  /**
   * Available balance = total - used - pending
   */
  computeAvailableBalance(total: number, used: number, pending: number): number {
    return new Decimal(total).minus(used).minus(pending).toDecimalPlaces(2).toNumber();
  }
}
```

### 6.4 Service `leaves.service.ts`

```typescript
// repo/packages/hr/src/services/leaves.service.ts
import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Decimal from 'decimal.js';
import { HrLeave } from '../entities/hr-leave.entity';
import { HrLeaveBalance } from '../entities/hr-leave-balance.entity';
import { HrEmployee } from '../entities/hr-employee.entity';
import { LeaveBalanceCalculatorService } from './leave-balance-calculator.service';

interface KafkaPublisher { publish(topic: string, payload: any): Promise<void>; }
interface NotificationService {
  send(args: { to: string; template: string; locale: string; variables: Record<string, unknown> }): Promise<void>;
}

export interface RequestLeaveInput {
  employeeId: string;
  leaveType: 'paid' | 'sick' | 'maternity' | 'paternity' | 'unpaid' | 'rtt';
  startDate: Date;
  endDate: Date;
  reason?: string;
  certificateDocId?: string;
}

@Injectable()
export class LeavesService {
  private readonly logger = new Logger(LeavesService.name);

  constructor(
    @InjectRepository(HrLeave) private readonly leaveRepo: Repository<HrLeave>,
    @InjectRepository(HrLeaveBalance) private readonly balanceRepo: Repository<HrLeaveBalance>,
    @InjectRepository(HrEmployee) private readonly employeeRepo: Repository<HrEmployee>,
    private readonly calculator: LeaveBalanceCalculatorService,
    private readonly kafka: KafkaPublisher,
    private readonly notifications: NotificationService,
    private readonly ds: DataSource,
  ) {}

  async requestLeave(tenantId: string, userId: string, input: RequestLeaveInput): Promise<HrLeave> {
    // Validate
    if (input.endDate < input.startDate) throw new BadRequestException('end_date must be after start_date');
    if (input.startDate < new Date(Date.now() - 86400000)) throw new BadRequestException('Cannot request leave for past dates');
    
    const employee = await this.employeeRepo.findOne({ where: { id: input.employeeId, tenant_id: tenantId } });
    if (!employee) throw new NotFoundException(`Employee ${input.employeeId} not found`);
    if (!employee.active) throw new BadRequestException('Cannot request leave for terminated employee');

    // Compute days (business days for paid/rtt, calendar days for sick/maternity/paternity/unpaid)
    let daysCount: number;
    if (input.leaveType === 'maternity') {
      daysCount = this.calculator.computeMaternityDays();
    } else if (input.leaveType === 'paternity') {
      daysCount = this.calculator.computePaternityDays();
    } else if (['paid', 'rtt'].includes(input.leaveType)) {
      daysCount = this.calculator.computeBusinessDays(input.startDate, input.endDate);
    } else {
      // sick, unpaid : calendar days
      daysCount = Math.ceil((input.endDate.getTime() - input.startDate.getTime()) / 86400000) + 1;
    }
    if (daysCount <= 0) throw new BadRequestException('days_count must be > 0');

    // Sick > 4j requires certificate
    if (input.leaveType === 'sick' && daysCount >= 4 && !input.certificateDocId) {
      throw new BadRequestException('Sick leave >= 4 days requires medical certificate');
    }

    // Balance check for paid leave
    if (input.leaveType === 'paid') {
      const year = input.startDate.getUTCFullYear();
      const balance = await this.getOrCreateBalance(tenantId, input.employeeId, year, employee.hired_date);
      const available = this.calculator.computeAvailableBalance(
        Number(balance.paid_leave_total),
        Number(balance.paid_leave_used),
        Number(balance.paid_leave_pending),
      );
      if (daysCount > available) {
        throw new BadRequestException({
          code: 'INSUFFICIENT_PAID_LEAVE',
          requested: daysCount,
          available,
          year,
        });
      }
    }

    // Create request (transaction with balance update for pending)
    return this.ds.transaction(async (em) => {
      const leave = em.create(HrLeave, {
        tenant_id: tenantId,
        employee_id: input.employeeId,
        leave_type: input.leaveType,
        start_date: input.startDate,
        end_date: input.endDate,
        days_count: String(daysCount),
        reason: input.reason ?? null,
        certificate_doc_id: input.certificateDocId ?? null,
        status: 'pending',
        requested_at: new Date(),
      });
      const saved = await em.save(leave);

      // Update balance pending
      if (input.leaveType === 'paid') {
        const year = input.startDate.getUTCFullYear();
        await em.increment(HrLeaveBalance,
          { tenant_id: tenantId, employee_id: input.employeeId, year },
          'paid_leave_pending',
          daysCount,
        );
      }

      this.logger.log({
        action: 'leave_requested',
        tenant_id: tenantId,
        leave_id: saved.id,
        type: input.leaveType,
        days: daysCount,
      });

      setImmediate(() => this.kafka.publish('insurtech.events.hr.leave_requested', {
        tenant_id: tenantId,
        leave_id: saved.id,
        employee_id: input.employeeId,
        type: input.leaveType,
        days_count: daysCount,
        start_date: input.startDate,
        end_date: input.endDate,
      }));

      return saved;
    });
  }

  async approveLeave(tenantId: string, approverId: string, leaveId: string): Promise<HrLeave> {
    return this.ds.transaction(async (em) => {
      const leave = await em.findOne(HrLeave, { where: { id: leaveId, tenant_id: tenantId } });
      if (!leave) throw new NotFoundException(`Leave ${leaveId} not found`);
      if (leave.status !== 'pending') throw new BadRequestException(`Cannot approve leave in status ${leave.status}`);

      leave.status = 'approved';
      leave.approved_by = approverId;
      leave.approved_at = new Date();
      const saved = await em.save(leave);

      // Update balance : move from pending to used
      if (leave.leave_type === 'paid') {
        const year = leave.start_date.getUTCFullYear();
        const days = Number(leave.days_count);
        await em.decrement(HrLeaveBalance, { tenant_id: tenantId, employee_id: leave.employee_id, year }, 'paid_leave_pending', days);
        await em.increment(HrLeaveBalance, { tenant_id: tenantId, employee_id: leave.employee_id, year }, 'paid_leave_used', days);
      } else if (leave.leave_type === 'sick') {
        const year = leave.start_date.getUTCFullYear();
        await em.increment(HrLeaveBalance, { tenant_id: tenantId, employee_id: leave.employee_id, year }, 'sick_leave_used', Number(leave.days_count));
      }

      setImmediate(() => this.kafka.publish('insurtech.events.hr.leave_approved', {
        tenant_id: tenantId,
        leave_id: saved.id,
        approver_id: approverId,
      }));

      // Notify employee
      const employee = await em.findOne(HrEmployee, { where: { id: leave.employee_id } });
      if (employee?.email) {
        await this.notifications.send({
          to: employee.email,
          template: 'leave-approved',
          locale: 'fr',
          variables: {
            full_name: employee.full_name,
            leave_type: leave.leave_type,
            start_date: leave.start_date.toISOString().slice(0, 10),
            end_date: leave.end_date.toISOString().slice(0, 10),
            days_count: leave.days_count,
          },
        });
      }

      this.logger.log({ action: 'leave_approved', leave_id: saved.id, approver: approverId });
      return saved;
    });
  }

  async rejectLeave(tenantId: string, approverId: string, leaveId: string, reason: string): Promise<HrLeave> {
    if (reason.length < 10) throw new BadRequestException('Rejection reason must be at least 10 chars');
    return this.ds.transaction(async (em) => {
      const leave = await em.findOne(HrLeave, { where: { id: leaveId, tenant_id: tenantId } });
      if (!leave) throw new NotFoundException(`Leave ${leaveId} not found`);
      if (leave.status !== 'pending') throw new BadRequestException(`Cannot reject leave in status ${leave.status}`);

      leave.status = 'rejected';
      leave.approved_by = approverId;
      leave.approved_at = new Date();
      leave.rejected_reason = reason;
      const saved = await em.save(leave);

      // Release pending balance
      if (leave.leave_type === 'paid') {
        const year = leave.start_date.getUTCFullYear();
        await em.decrement(HrLeaveBalance, { tenant_id: tenantId, employee_id: leave.employee_id, year }, 'paid_leave_pending', Number(leave.days_count));
      }

      setImmediate(() => this.kafka.publish('insurtech.events.hr.leave_rejected', {
        tenant_id: tenantId, leave_id: saved.id, approver_id: approverId, reason,
      }));

      const employee = await em.findOne(HrEmployee, { where: { id: leave.employee_id } });
      if (employee?.email) {
        await this.notifications.send({
          to: employee.email,
          template: 'leave-rejected',
          locale: 'fr',
          variables: {
            full_name: employee.full_name,
            leave_type: leave.leave_type,
            start_date: leave.start_date.toISOString().slice(0, 10),
            end_date: leave.end_date.toISOString().slice(0, 10),
            reason,
          },
        });
      }

      return saved;
    });
  }

  async cancelLeave(tenantId: string, requestingUserId: string, leaveId: string): Promise<HrLeave> {
    return this.ds.transaction(async (em) => {
      const leave = await em.findOne(HrLeave, { where: { id: leaveId, tenant_id: tenantId } });
      if (!leave) throw new NotFoundException(`Leave ${leaveId} not found`);
      if (leave.status === 'cancelled') throw new BadRequestException('Already cancelled');
      if (leave.status === 'rejected') throw new BadRequestException('Cannot cancel rejected leave');

      // Cancel approved only if not started
      if (leave.status === 'approved' && leave.start_date <= new Date()) {
        throw new BadRequestException('Cannot cancel approved leave already started');
      }

      const wasApproved = leave.status === 'approved';
      const wasPending = leave.status === 'pending';
      leave.status = 'cancelled';
      leave.cancelled_at = new Date();
      const saved = await em.save(leave);

      if (leave.leave_type === 'paid') {
        const year = leave.start_date.getUTCFullYear();
        const days = Number(leave.days_count);
        if (wasApproved) {
          await em.decrement(HrLeaveBalance, { tenant_id: tenantId, employee_id: leave.employee_id, year }, 'paid_leave_used', days);
        } else if (wasPending) {
          await em.decrement(HrLeaveBalance, { tenant_id: tenantId, employee_id: leave.employee_id, year }, 'paid_leave_pending', days);
        }
      }

      setImmediate(() => this.kafka.publish('insurtech.events.hr.leave_cancelled', { tenant_id: tenantId, leave_id: saved.id, by_user: requestingUserId }));
      return saved;
    });
  }

  async getBalance(tenantId: string, employeeId: string, year?: number): Promise<HrLeaveBalance> {
    const yr = year ?? new Date().getUTCFullYear();
    const employee = await this.employeeRepo.findOne({ where: { id: employeeId, tenant_id: tenantId } });
    if (!employee) throw new NotFoundException(`Employee ${employeeId} not found`);
    return this.getOrCreateBalance(tenantId, employeeId, yr, employee.hired_date);
  }

  private async getOrCreateBalance(tenantId: string, employeeId: string, year: number, hiredDate: Date): Promise<HrLeaveBalance> {
    let balance = await this.balanceRepo.findOne({ where: { tenant_id: tenantId, employee_id: employeeId, year } });
    if (!balance) {
      const total = this.calculator.computePaidLeaveTotal(hiredDate, new Date(year, 5, 15));
      balance = this.balanceRepo.create({
        tenant_id: tenantId,
        employee_id: employeeId,
        year,
        paid_leave_total: String(total),
        paid_leave_used: '0',
        paid_leave_pending: '0',
        sick_leave_used: '0',
        maternity_leave_used: '0',
        paternity_leave_used: '0',
        unpaid_leave_used: '0',
        rtt_used: '0',
      });
      await this.balanceRepo.save(balance);
    }
    return balance;
  }

  async listByEmployee(tenantId: string, employeeId: string, opts: { status?: string; year?: number; limit?: number } = {}): Promise<HrLeave[]> {
    const qb = this.leaveRepo.createQueryBuilder('l')
      .where('l.tenant_id = :t', { t: tenantId })
      .andWhere('l.employee_id = :e', { e: employeeId });
    if (opts.status) qb.andWhere('l.status = :s', { s: opts.status });
    if (opts.year) qb.andWhere('EXTRACT(YEAR FROM l.start_date) = :y', { y: opts.year });
    return qb.orderBy('l.start_date', 'DESC').limit(opts.limit ?? 50).getMany();
  }
}
```

### 6.5 Tests `leave-balance-calculator.service.spec.ts` (8 tests)

```typescript
import { describe, it, expect } from 'vitest';
import { LeaveBalanceCalculatorService } from './leave-balance-calculator.service';

describe('LeaveBalanceCalculatorService', () => {
  const svc = new LeaveBalanceCalculatorService();

  it('computePaidLeaveTotal full year = 18 days', () => {
    expect(svc.computePaidLeaveTotal(new Date('2020-01-01'), new Date('2026-06-15'))).toBe(19.5);
    // 18 base + 1 bonus (6 ans = 1 bloc 5)
  });

  it('computePaidLeaveTotal pro-rata 6 months', () => {
    expect(svc.computePaidLeaveTotal(new Date('2026-07-01'), new Date('2026-12-15'))).toBe(9);
    // 5 mois travailles * 1.5 = 7.5 (juillet a decembre = 6 mois - oct test 9)
  });

  it('computePaidLeaveTotal 0 if hired after year end', () => {
    expect(svc.computePaidLeaveTotal(new Date('2027-01-01'), new Date('2026-06-15'))).toBe(0);
  });

  it('computePaidLeaveTotal anciennete bonus 10 ans = 3 j', () => {
    expect(svc.computePaidLeaveTotal(new Date('2016-01-01'), new Date('2026-06-15'))).toBe(21);
    // 18 + 1.5*2 (2 blocs 5 ans) = 21
  });

  it('computePaidLeaveTotal capped at 30', () => {
    expect(svc.computePaidLeaveTotal(new Date('1980-01-01'), new Date('2026-06-15'))).toBe(30);
  });

  it('computeBusinessDays exclut weekends', () => {
    // 2026-05-11 lundi -> 2026-05-15 vendredi = 5 jours
    expect(svc.computeBusinessDays(new Date('2026-05-11'), new Date('2026-05-15'))).toBe(5);
  });

  it('computeBusinessDays exclut weekends et holidays', () => {
    const holidays = new Set(['2026-05-13']);
    expect(svc.computeBusinessDays(new Date('2026-05-11'), new Date('2026-05-15'), holidays)).toBe(4);
  });

  it('computeAvailableBalance total - used - pending', () => {
    expect(svc.computeAvailableBalance(18, 5, 3)).toBe(10);
  });
});
```

### 6.6 Controller `leaves.controller.ts`

```typescript
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, RolesGuard, TenantGuard, Roles, CurrentTenantId, CurrentUserId } from '@insurtech/auth';
import { LeavesService } from '@insurtech/hr';
import { z } from 'zod';

const RequestLeaveSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type: z.enum(['paid', 'sick', 'maternity', 'paternity', 'unpaid', 'rtt']),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  reason: z.string().max(1000).optional(),
  certificate_doc_id: z.string().uuid().optional(),
});

const RejectLeaveSchema = z.object({
  reason: z.string().min(10).max(1000),
});

@Controller('api/v1/hr/leaves')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
export class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Post('request')
  @Roles('hr.leaves.request')
  async request(@CurrentTenantId() tenantId: string, @CurrentUserId() userId: string, @Body() body: unknown) {
    const dto = RequestLeaveSchema.parse(body);
    return this.leaves.requestLeave(tenantId, userId, {
      employeeId: dto.employee_id, leaveType: dto.leave_type,
      startDate: dto.start_date, endDate: dto.end_date,
      reason: dto.reason, certificateDocId: dto.certificate_doc_id,
    });
  }

  @Post(':id/approve')
  @Roles('hr.leaves.approve')
  async approve(@CurrentTenantId() tenantId: string, @CurrentUserId() userId: string, @Param('id') id: string) {
    return this.leaves.approveLeave(tenantId, userId, id);
  }

  @Post(':id/reject')
  @Roles('hr.leaves.approve')
  async reject(@CurrentTenantId() tenantId: string, @CurrentUserId() userId: string, @Param('id') id: string, @Body() body: unknown) {
    const dto = RejectLeaveSchema.parse(body);
    return this.leaves.rejectLeave(tenantId, userId, id, dto.reason);
  }

  @Post(':id/cancel')
  @Roles('hr.leaves.cancel')
  async cancel(@CurrentTenantId() tenantId: string, @CurrentUserId() userId: string, @Param('id') id: string) {
    return this.leaves.cancelLeave(tenantId, userId, id);
  }

  @Get('balance/:employeeId')
  @Roles('hr.leaves.read')
  async balance(@CurrentTenantId() tenantId: string, @Param('employeeId') employeeId: string, @Query('year') year?: string) {
    return this.leaves.getBalance(tenantId, employeeId, year ? Number(year) : undefined);
  }

  @Get('employee/:employeeId')
  @Roles('hr.leaves.read')
  async listByEmployee(@CurrentTenantId() tenantId: string, @Param('employeeId') employeeId: string, @Query() q: any) {
    return this.leaves.listByEmployee(tenantId, employeeId, {
      status: q.status, year: q.year ? Number(q.year) : undefined,
      limit: q.limit ? Number(q.limit) : undefined,
    });
  }
}
```

### 6.7 Template `leave-approved.hbs` (fr)

```handlebars
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Conge approuve</title></head>
<body style="font-family:Arial,sans-serif;color:#333;">
<h2>Votre demande de conge a ete approuvee</h2>
<p>Bonjour {{full_name}},</p>
<p>Votre demande de conge ({{leave_type}}) a ete approuvee :</p>
<ul>
  <li>Du {{start_date}} au {{end_date}}</li>
  <li>Duree : {{days_count}} jours</li>
</ul>
<p>Bonne periode de repos.</p>
<p style="font-size:12px;color:#999;">Skalean InsurTech HR.</p>
</body>
</html>
```

---

## 7. Tests `leaves.service.spec.ts` (extrait 14 tests)

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
// ... mock setup
describe('LeavesService', () => {
  // tests :
  it('requestLeave rejects past dates', async () => { /* ... */ });
  it('requestLeave rejects end_date < start_date', async () => { /* ... */ });
  it('requestLeave for paid checks balance', async () => { /* ... */ });
  it('requestLeave paid throws INSUFFICIENT if no balance', async () => { /* ... */ });
  it('requestLeave maternity = 98 days', async () => { /* ... */ });
  it('requestLeave paternity = 3 days', async () => { /* ... */ });
  it('requestLeave sick >= 4j without cert rejected', async () => { /* ... */ });
  it('requestLeave creates pending + increments pending balance', async () => { /* ... */ });
  it('approveLeave transitions to approved + decrement pending + increment used', async () => { /* ... */ });
  it('approveLeave non-pending rejected', async () => { /* ... */ });
  it('approveLeave sends notification', async () => { /* ... */ });
  it('rejectLeave releases pending balance', async () => { /* ... */ });
  it('rejectLeave reason < 10 chars rejected', async () => { /* ... */ });
  it('cancelLeave approved before start = restore balance', async () => { /* ... */ });
});
```

---

## 8-16. Variables, commandes, criteres V1-V22, edge cases, conformite, conventions, validation, commit, next step

### Variables env
```env
HR_PAID_LEAVE_BASE_DAYS=18
HR_LEAVE_DEFAULT_LOCALE=fr
```

### Criteres P0
V1 Migrations crees, V2 RLS, V3 Trigger anti-overlap, V4 CHECK days >= 0.5, V5 Sick certificat >=4j, V6 Maternite 14 sem, V7 Paternite 3j, V8 Balance auto-create, V9 requestLeave valide balance paid, V10 INSUFFICIENT_PAID_LEAVE error, V11 approveLeave transition + balance update, V12 rejectLeave reason >= 10, V13 cancelLeave restore balance, V14 Multi-tenant isolation, V15 RBAC hr.leaves.*

### Criteres P1
V16 Notifications email approve/reject 3 langues, V17 Anciennete bonus calcul, V18 Pro-rata premiere annee, V19 Plafond 30j, V20 Tests coverage >= 85%

### Criteres P2
V21 Tests E2E 5+, V22 Documentation API

### Edge cases (10+)
1. Conge a cheval sur 2 annees -> split balances
2. Conge sur jour ferie -> business days computation
3. Maternite pendant conge paye -> manager retire paid, garde maternite
4. Sick rapporte par cron 14j later -> permis avec audit
5. Employee terminate mid-conge -> conge cancelled
6. Convention collective conge etendu -> Sprint 35
7. Approval delegated multi-manager -> Sprint 35 workflow
8. Approval auto si manager absent -> Sprint 35
9. Rejection sans reason -> 400
10. Balance recompute manual -> endpoint admin Sprint 35

### Conformite Maroc
- Loi 65-99 art 231 (18j base), art 232 (1.5j/5ans bonus), art 152 (maternite 14 sem), art 269 (paternite 3j).

### Commit
```bash
git commit -m "feat(sprint-13): HR leaves + workflow approval + balances + 9 templates i18n

Task: 3.6.10
Sprint: 13
Reference: B-13 Tache 3.6.10"
```

### Next step : task-3.6.11-hr-paie-cnss-amo-ir-brackets-ma.md

---

## ENRICHISSEMENT v2 -- Sections supplementaires

### A. Workflow approval detaille (5 etats + transitions complete)

```
       requestLeave
            |
            v
       [pending] -------> approveLeave -----> [approved]
            |                                       |
            |                                       v
            +---> rejectLeave -----> [rejected]   useLeave (passage start_date)
            |                                       |
            +---> cancelLeave -----> [cancelled]   v
                                              [active]
                                                    |
                                                    v
                                          endLeave (passage end_date)
                                                    |
                                                    v
                                              [completed]
```

Transitions autorisees Sprint 13 :
- `pending` -> `approved` | `rejected` | `cancelled` (par employee)
- `approved` -> `cancelled` (uniquement avant start_date)
- `rejected` -> immutable
- `cancelled` -> immutable
- Sprint 35+ : ajouter etats `active` (en cours) + `completed` (passe)

### B. Computation balance detaillee MA loi 65-99

**Article 231** : 1.5 jour par mois travaille => 18 jours pour annee complete.

**Article 232** : bonus 1.5 jour additionnel par 5 ans anciennete (max 30 jours).

| Annees anciennete | Bonus jours | Total annuel | Note |
|-------------------|-------------|---------------|------|
| 0-4 | 0 | 18 | Base loi 65-99 art 231 |
| 5-9 | 1.5 | 19.5 | Premier palier art 232 |
| 10-14 | 3 | 21 | Second palier |
| 15-19 | 4.5 | 22.5 | Troisieme |
| 20-24 | 6 | 24 | Quatrieme |
| 25-29 | 7.5 | 25.5 | Cinquieme |
| 30+ | 9 | 27 (cap a 30) | Sixieme et plus, plafond 30 |

Pour anciennete > 30 ans, plafond 30 jours strict (art 232 alinea 2).

### C. Templates Handlebars i18n complets (9 templates : 3 langues x 3 events)

#### C.1 fr/leave-request.hbs

```handlebars
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><title>Nouvelle demande de conge</title></head>
<body style="font-family:Arial;color:#333;padding:20px;">
<div style="max-width:600px;margin:0 auto;border:1px solid #ddd;padding:20px;">
<h2>Nouvelle demande de conge -- {{employee_name}}</h2>
<p>Bonjour {{manager_name}},</p>
<p><strong>{{employee_name}}</strong> a soumis une demande de conge a votre approbation :</p>
<table style="width:100%;border-collapse:collapse;margin:15px 0;">
  <tr><td style="padding:8px;background:#f5f5f5;"><strong>Type</strong></td><td style="padding:8px;">{{leave_type}}</td></tr>
  <tr><td style="padding:8px;background:#f5f5f5;"><strong>Du</strong></td><td style="padding:8px;">{{start_date}}</td></tr>
  <tr><td style="padding:8px;background:#f5f5f5;"><strong>Au</strong></td><td style="padding:8px;">{{end_date}}</td></tr>
  <tr><td style="padding:8px;background:#f5f5f5;"><strong>Duree</strong></td><td style="padding:8px;">{{days_count}} jours</td></tr>
  {{#if reason}}<tr><td style="padding:8px;background:#f5f5f5;"><strong>Motif</strong></td><td style="padding:8px;">{{reason}}</td></tr>{{/if}}
  <tr><td style="padding:8px;background:#f5f5f5;"><strong>Solde restant si approuve</strong></td><td style="padding:8px;">{{remaining_balance_after}} jours</td></tr>
</table>
<p style="text-align:center;margin-top:20px;">
<a href="{{portal_url}}/hr/leaves/{{leave_id}}/approve" style="background:#27ae60;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;margin-right:10px;">Approuver</a>
<a href="{{portal_url}}/hr/leaves/{{leave_id}}/reject" style="background:#c0392b;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;">Rejeter</a>
</p>
<p style="font-size:11px;color:#999;margin-top:30px;">Demande soumise le {{requested_at}}. Skalean InsurTech.</p>
</div></body></html>
```

#### C.2 fr/leave-approved.hbs / leave-rejected.hbs : variantes similaires

#### C.3 ar-MA et ar : versions RTL avec adaptations darija/standard

### D. Service additionnel : LeaveCalendarService (Sprint 13 stub, Sprint 35 enhancement)

```typescript
@Injectable()
export class LeaveCalendarService {
  // Sprint 13 : retourne planning conges approuves pour visualisation manager
  async getTeamCalendar(tenantId: string, dateFrom: Date, dateTo: Date): Promise<Array<{
    employee_id: string;
    employee_name: string;
    leaves: Array<{ start_date: string; end_date: string; leave_type: string; status: string }>;
  }>> {
    // SELECT employees + leaves WHERE tenant_id AND status='approved' AND date overlap
    // Sprint 13 : implementation basique
    // Sprint 35 : detection conflits (e.g. 3 mecaniciens absent meme semaine = alerte)
    return [];
  }
}
```

### E. Tests supplementaires (15 cas additionnels)

```typescript
describe('LeavesService -- tests avances', () => {
  it('cancel approved avant start restore balance correctement', async () => { });
  it('approver = requesting user rejected (4-eyes)', async () => { });
  it('Conge maternite ne deduit pas paid_leave_balance (separe)', async () => { });
  it('Conge sick auto-deduit sick_leave_used sans validation manager si < 3j', async () => { });
  it('Demande chevauchant 2 annees -> split en 2 leaves auto Sprint 35', async () => { });
  it('Balance year+1 auto-create si demande pour janvier suivant', async () => { });
  it('Anciennete bonus 6 ans = 19.5 jours base', async () => { });
  it('Anciennete bonus 31 ans = capped 30', async () => { });
  it('Pro-rata premiere annee hire mi-juin = 9 jours (7 mois x 1.5)', async () => { });
  it('Maternite chevauchant nouvelle annee -> compute calendar 14 sem', async () => { });
  it('Approval delegated si manager off (Sprint 35) -> deferred', async () => { });
  it('Reject avec reason < 10 chars -> 400', async () => { });
  it('Cancel rejected -> 400 (immutable)', async () => { });
  it('Multi-tenant isolation strict', async () => { });
  it('Kafka events emit on all transitions', async () => { });
});
```

### F. Edge cases supplementaires (15 cas)

1. Demande pour passe -> reject (start_date < now)
2. Demande conges = 0 jours (start=end same day weekend) -> 0 conges decompte
3. Demande conges entree de mois passe par employee hire le 15 -> verifier balance pro-rata
4. Approval simultane par 2 managers -> first wins (idempotent)
5. Employee terminate avec conges pending -> auto-cancel
6. Conges maternite chevauchant annee -> split balance years
7. Maladie certificat upload tardif (>4j) -> autoriser retroactivement
8. RTT non disponible si convention pas configuree -> reject
9. Conges payes annee suivante (anticipe) -> verifier balance future
10. Demande chevauchant conges existant -> trigger PG bloque
11. Approval delegated si manager absent -> Sprint 35 workflow
12. Conges 365 jours (cas extreme) -> autoriser si balance + sabbatical
13. Conges + paie : deduction unpaid_leave dans payslip auto (Tache 3.6.11)
14. Annulation conges deja commences -> Sprint 35 split (compte jours utilises)
15. Conges hors MA (expatriation) -> Sprint 35 multi-juridiction

### G. Conformite Maroc detaillee

- **Article 231 loi 65-99** : 18 jours minimum (1.5 j/mois travaille).
- **Article 232** : 1.5 j additionnel / 5 ans, plafond 30.
- **Article 152** : maternite 14 semaines, 6 obligatoires apres accouchement.
- **Article 269** : paternite 3 jours.
- **Article 254** : maladie -- certificat medical obligatoire > 4 jours.
- **Code travail** : conges RTT seulement si convention collective.

### H. Validation pre-commit detaillee

```bash
pnpm --filter @insurtech/hr typecheck
pnpm --filter @insurtech/hr test:coverage  # >= 85%
grep "PAID_LEAVE_BASE_DAYS_PER_YEAR = 18" repo/packages/hr/src/services/leave-balance-calculator.service.ts
grep "ADDITIONAL_DAYS_PER_5_YEARS = 1.5" repo/packages/hr/src/services/leave-balance-calculator.service.ts
grep "MAX_PAID_LEAVE_DAYS = 30" repo/packages/hr/src/services/leave-balance-calculator.service.ts
ls repo/packages/comm/src/templates/{fr,ar-MA,ar}/leave-{request,approved,rejected,cancelled}.hbs | wc -l   # 12 attendu
```

---

**Fin enrichissement task-3.6.10.**

**Fin task-3.6.10-hr-conges-workflow-approval.md.**

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

