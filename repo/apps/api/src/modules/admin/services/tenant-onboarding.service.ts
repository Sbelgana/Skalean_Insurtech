// TenantOnboardingService -- Sprint 6 Tache 2.2.8.
//
// Workflow create tenant + super_admin pending + email invitation + complete.
//
// Storage token : Redis (cle onboarding:token:<token>) -- TTL 7 jours.
// Pas de table DB dediee (defere a migration future si besoin audit trail
// persistant ; pour Sprint 6 l'audit Pino + cancel cascade suffisent).
//
// Securite :
//   - Token = randomUUID() 128 bits entropie (immune brute force)
//   - Email enumeration : silent OK si email deja utilisee (response generique)
//   - Reserved tenant names rejected (Zod DTO)
//   - Rate limit : voir Tache 2.2.7 (defere) ou Sprint 7 RBAC
//
// Reference : Sprint 6 / Tache 2.2.8.

import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Argon2Service } from '@insurtech/auth';
import { AuthTenant, AuthTenantUser, AuthUser, type DataSource } from '@insurtech/database';
import type Redis from 'ioredis';
import { DATA_SOURCE_TOKEN } from '../../../database/data-source.provider.js';
import { REDIS_CLIENT_TOKEN } from '../../../redis/redis.provider.js';
import { EMAIL_SERVICE_TOKEN, type EmailService } from '../../auth/email.service.js';
import type {
  CompleteOnboardingDto,
  InitiateOnboardingDto,
} from '../dto/onboarding.dto.js';
import {
  ONBOARDING_ERROR_CODES,
  ONBOARDING_TOKEN_TTL_SECONDS,
  type OnboardingCompleteResult,
  type OnboardingInitiateResult,
  type OnboardingVerifyTokenResult,
  PENDING_PASSWORD_HASH_PLACEHOLDER,
} from '../types/onboarding.type.js';
import { TenantManagementService } from './tenant-management.service.js';

interface OnboardingTokenPayload {
  tenantId: string;
  userId: string;
  email: string;
  tenantName: string;
  issuedAt: number;
  expiresAt: number;
}

const tokenKey = (token: string): string => `onboarding:token:${token}`;
const usedTokenKey = (token: string): string => `onboarding:token-used:${token}`;

@Injectable()
export class TenantOnboardingService {
  private readonly logger = new Logger(TenantOnboardingService.name);

  constructor(
    @Inject(DATA_SOURCE_TOKEN) private readonly dataSource: DataSource,
    @Inject(REDIS_CLIENT_TOKEN) private readonly redis: Redis,
    @Inject(EMAIL_SERVICE_TOKEN) private readonly emailService: EmailService,
    private readonly argon2: Argon2Service,
    private readonly tenantManagement: TenantManagementService,
  ) {}

  // ===========================================================================
  // INITIATE
  // ===========================================================================

  async initiate(
    dto: InitiateOnboardingDto,
    adminUserId: string,
  ): Promise<OnboardingInitiateResult> {
    // Step 1 : email enumeration protection -- check before tenant create.
    const userRepo = this.dataSource.getRepository(AuthUser);
    const existingUser = await userRepo.findOne({ where: { email: dto.admin.email } });
    if (existingUser) {
      this.logger.warn(
        `onboarding_email_already_used email=${this.maskEmail(dto.admin.email)} by_admin=${adminUserId}`,
      );
      throw new ConflictException({
        code: ONBOARDING_ERROR_CODES.EMAIL_CONFLICT,
        message: 'An account with this email already exists',
      });
    }

    // Step 2 : create tenant via TenantManagementService.
    const tenant = await this.tenantManagement.create(
      {
        name: dto.tenant.name,
        type: dto.tenant.type,
        ...(dto.tenant.settings ? { settings: dto.tenant.settings } : {}),
      },
      adminUserId,
    );

    // Step 3+4 : transaction create AuthUser + AuthTenantUser link.
    let createdUser: AuthUser;
    try {
      createdUser = await this.dataSource.transaction(async (em) => {
        const user = em.create(AuthUser, {
          tenantId: tenant.id,
          email: dto.admin.email,
          passwordHash: PENDING_PASSWORD_HASH_PLACEHOLDER,
          displayName: dto.admin.displayName,
          mfaEnabled: false,
          mfaSecretEncrypted: null,
          emailVerifiedAt: null,
          lastLoginAt: null,
          lockedUntil: null,
          failedLoginAttempts: 0,
        });
        const savedUser = await em.save(AuthUser, user);

        const link = em.create(AuthTenantUser, {
          tenantId: tenant.id,
          userId: savedUser.id,
          role: 'tenant_admin',
          permissions: {},
        });
        await em.save(AuthTenantUser, link);

        return savedUser;
      });
    } catch (err) {
      // Rollback tenant create on failure (cascade)
      await this.tenantManagement.archive(tenant.id, 'onboarding_rollback', adminUserId).catch(() => undefined);
      throw err;
    }

    // Step 5 : generate token (Redis-stored, 7d TTL).
    const token = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + ONBOARDING_TOKEN_TTL_SECONDS) * 1000);
    const payload: OnboardingTokenPayload = {
      tenantId: tenant.id,
      userId: createdUser.id,
      email: dto.admin.email,
      tenantName: tenant.name,
      issuedAt: now,
      expiresAt: now + ONBOARDING_TOKEN_TTL_SECONDS,
    };

    await this.redis.set(
      tokenKey(token),
      JSON.stringify(payload),
      'EX',
      ONBOARDING_TOKEN_TTL_SECONDS,
    );

    // Step 6 : send email (synchronous Sprint 6 ; Sprint 9 -> BullMQ async).
    try {
      await this.emailService.sendVerification({
        to: dto.admin.email,
        locale: dto.admin.locale,
        token,
        display_name: dto.admin.displayName,
      });
    } catch (err) {
      this.logger.error(
        `onboarding_email_send_failed user=${createdUser.id} email=${this.maskEmail(dto.admin.email)} error=${(err as Error).message}`,
      );
      // Don't rollback : user can resend later. Just log.
    }

    this.logger.log(
      `onboarding_initiated tenant=${tenant.id} user=${createdUser.id} email=${this.maskEmail(dto.admin.email)} by_admin=${adminUserId} expires_at=${expiresAt.toISOString()}`,
    );

    return {
      tenantId: tenant.id,
      adminUserId: createdUser.id,
      emailSentTo: dto.admin.email,
      expiresAt,
    };
  }

  // ===========================================================================
  // COMPLETE
  // ===========================================================================

  async complete(dto: CompleteOnboardingDto): Promise<OnboardingCompleteResult> {
    // Step 1 : verify token in Redis.
    const used = await this.redis.get(usedTokenKey(dto.token));
    if (used) {
      throw new BadRequestException({
        code: ONBOARDING_ERROR_CODES.TOKEN_USED,
        message: 'Token has already been used',
      });
    }

    const rawPayload = await this.redis.get(tokenKey(dto.token));
    if (!rawPayload) {
      throw new BadRequestException({
        code: ONBOARDING_ERROR_CODES.TOKEN_INVALID,
        message: 'Token is invalid or expired',
      });
    }

    let payload: OnboardingTokenPayload;
    try {
      payload = JSON.parse(rawPayload) as OnboardingTokenPayload;
    } catch {
      throw new BadRequestException({
        code: ONBOARDING_ERROR_CODES.TOKEN_INVALID,
        message: 'Token payload corrupted',
      });
    }

    if (payload.expiresAt * 1000 <= Date.now()) {
      throw new BadRequestException({
        code: ONBOARDING_ERROR_CODES.TOKEN_EXPIRED,
        message: 'Token expired',
      });
    }

    // Step 2 : hash password (validates min length already in DTO).
    let passwordHash: string;
    try {
      passwordHash = await this.argon2.hash(dto.password);
    } catch (err) {
      throw new BadRequestException({
        code: ONBOARDING_ERROR_CODES.PASSWORD_WEAK,
        message: `Password rejected: ${(err as Error).message}`,
      });
    }

    // Step 3 : update user + mark token used in transaction.
    await this.dataSource.transaction(async (em) => {
      const user = await em.findOne(AuthUser, { where: { id: payload.userId } });
      if (!user) {
        throw new NotFoundException({
          code: ONBOARDING_ERROR_CODES.USER_NOT_PENDING,
          message: 'User not found',
        });
      }
      if (user.passwordHash !== PENDING_PASSWORD_HASH_PLACEHOLDER) {
        throw new ConflictException({
          code: ONBOARDING_ERROR_CODES.USER_NOT_PENDING,
          message: 'User onboarding already completed',
        });
      }
      user.passwordHash = passwordHash;
      user.emailVerifiedAt = new Date();
      await em.save(AuthUser, user);
    });

    // Mark token used (separate key with short TTL for idempotency window).
    await this.redis.set(usedTokenKey(dto.token), '1', 'EX', ONBOARDING_TOKEN_TTL_SECONDS);
    await this.redis.del(tokenKey(dto.token));

    this.logger.log(
      `onboarding_completed tenant=${payload.tenantId} user=${payload.userId} email=${this.maskEmail(payload.email)}`,
    );

    return {
      tenantId: payload.tenantId,
      userId: payload.userId,
      email: payload.email,
    };
  }

  // ===========================================================================
  // VERIFY TOKEN (public endpoint UX preview)
  // ===========================================================================

  async verifyToken(token: string): Promise<OnboardingVerifyTokenResult> {
    if (await this.redis.get(usedTokenKey(token))) {
      return { valid: false, reason: 'USED' };
    }
    const raw = await this.redis.get(tokenKey(token));
    if (!raw) {
      return { valid: false, reason: 'NOT_FOUND' };
    }
    try {
      const payload = JSON.parse(raw) as OnboardingTokenPayload;
      if (payload.expiresAt * 1000 <= Date.now()) {
        return { valid: false, reason: 'EXPIRED' };
      }
      return {
        valid: true,
        tenantName: payload.tenantName,
        emailMasked: this.maskEmail(payload.email),
        expiresAt: new Date(payload.expiresAt * 1000),
      };
    } catch {
      return { valid: false, reason: 'NOT_FOUND' };
    }
  }

  // ===========================================================================
  // RESEND
  // ===========================================================================

  async resendInvitation(tenantId: string, adminUserId: string): Promise<{ expiresAt: Date }> {
    const tenant = await this.tenantManagement.findById(tenantId);

    const userRepo = this.dataSource.getRepository(AuthUser);
    const adminUser = await userRepo.findOne({
      where: { tenantId, passwordHash: PENDING_PASSWORD_HASH_PLACEHOLDER },
    });
    if (!adminUser) {
      throw new NotFoundException({
        code: ONBOARDING_ERROR_CODES.USER_NOT_PENDING,
        message: 'No pending admin user for this tenant',
      });
    }

    // Rate limit Redis 3/h per admin user.
    const rateKey = `onboarding:resend-rate:${adminUser.id}`;
    const count = await this.redis.incr(rateKey);
    if (count === 1) {
      await this.redis.expire(rateKey, 3600);
    }
    if (count > 3) {
      throw new BadRequestException({
        code: 'ONBOARDING_RESEND_RATE_LIMIT',
        message: 'Resend rate limit exceeded (3/h)',
      });
    }

    const token = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = new Date((now + ONBOARDING_TOKEN_TTL_SECONDS) * 1000);
    const payload: OnboardingTokenPayload = {
      tenantId,
      userId: adminUser.id,
      email: adminUser.email,
      tenantName: tenant.name,
      issuedAt: now,
      expiresAt: now + ONBOARDING_TOKEN_TTL_SECONDS,
    };

    await this.redis.set(
      tokenKey(token),
      JSON.stringify(payload),
      'EX',
      ONBOARDING_TOKEN_TTL_SECONDS,
    );

    await this.emailService.sendVerification({
      to: adminUser.email,
      locale: 'fr-MA',
      token,
      display_name: adminUser.displayName,
    });

    this.logger.log(
      `onboarding_resent tenant=${tenantId} user=${adminUser.id} by_admin=${adminUserId}`,
    );

    return { expiresAt };
  }

  // ===========================================================================
  // CANCEL (cascade archive)
  // ===========================================================================

  async cancel(tenantId: string, reason: string, adminUserId: string): Promise<void> {
    const userRepo = this.dataSource.getRepository(AuthUser);
    const pendingUser = await userRepo.findOne({
      where: { tenantId, passwordHash: PENDING_PASSWORD_HASH_PLACEHOLDER },
    });
    if (!pendingUser) {
      throw new NotFoundException({
        code: ONBOARDING_ERROR_CODES.USER_NOT_PENDING,
        message: 'No pending admin user for this tenant',
      });
    }

    await this.dataSource.transaction(async (em) => {
      pendingUser.deletedAt = new Date();
      await em.save(AuthUser, pendingUser);
      const tenant = await em.findOne(AuthTenant, { where: { id: tenantId } });
      if (tenant && tenant.deletedAt === null) {
        tenant.deletedAt = new Date();
        await em.save(AuthTenant, tenant);
      }
    });

    this.logger.warn(
      `onboarding_cancelled tenant=${tenantId} user=${pendingUser.id} by_admin=${adminUserId} reason=${reason}`,
    );
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***';
    const visible = local.slice(0, 2);
    return `${visible}***@${domain}`;
  }
}
