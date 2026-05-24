/**
 * IcalFeedController -- Sprint 8 Tache 8.13.
 *
 * 4 routes :
 *
 *   GET  /api/v1/booking/calendar/ical/:plainToken.ics   PUBLIC  (token auth)
 *        -> text/calendar RFC 5545 feed for the user's appointments
 *
 *   POST   /api/v1/booking/calendar/ical-tokens          AUTH (MANAGE)
 *   GET    /api/v1/booking/calendar/ical-tokens          AUTH (MANAGE)
 *   DELETE /api/v1/booking/calendar/ical-tokens/:id      AUTH (MANAGE)
 *
 *   GET  /api/v1/booking/calendar/ical-tokens/admin/all  AUTH (ADMIN)
 *
 * Public route returns 404 (not 401) on invalid token to keep token
 * existence opaque to scanners.
 *
 * Plain token is included in the response ONLY at creation -- listings
 * never re-expose it (we don't have it server-side anyway -- only the hash).
 *
 * Reference : B-08 Tache 3.2.7.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import { Permission, TenantContextService, type AuthRole } from '@insurtech/auth';
import { HierarchyResolver } from '@insurtech/auth';
import {
  CreateIcalTokenSchema,
  type CreateIcalTokenDto,
  type IcalTokenCreatedDto,
  type IcalTokenSummaryDto,
} from '@insurtech/booking';
import type { BookingIcalTokenEntity } from '@insurtech/database';
import type { FastifyReply } from 'fastify';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator.js';
import { RequireTenant } from '../../../common/decorators/require-tenant.decorator.js';
import { IcalFeedService } from '../services/ical-feed.service.js';
import { IcalTokenService } from '../services/ical-token.service.js';

@Controller('api/v1/booking/calendar')
export class IcalFeedController {
  private readonly logger = new Logger(IcalFeedController.name);
  private readonly hierarchy = new HierarchyResolver();

  constructor(
    private readonly feedService: IcalFeedService,
    private readonly tokenService: IcalTokenService,
    private readonly tenantContext: TenantContextService,
  ) {}

  // ==========================================================================
  // 1. Public feed endpoint (no auth, token-validated)
  //
  //    Path includes the `.ics` suffix so iCal clients negotiate content type
  //    correctly. The path parameter therefore is `:plainTokenIcs` and we
  //    strip the suffix server-side.
  // ==========================================================================

  @Get('ical/:plainTokenIcs')
  async getFeed(
    @Param('plainTokenIcs') plainTokenIcs: string,
    @Res({ passthrough: false }) res: FastifyReply,
  ): Promise<void> {
    if (!plainTokenIcs.endsWith('.ics')) {
      res.status(404).send('Calendar not found');
      return;
    }
    const plainToken = plainTokenIcs.slice(0, -4);
    const result = await this.feedService.generateFeed(plainToken);
    if (!result) {
      // Obscurity : 404 (not 401) for invalid / expired / revoked tokens.
      res.status(404).send('Calendar not found');
      return;
    }
    res.header('Content-Type', 'text/calendar; charset=utf-8');
    res.header('Cache-Control', 'private, max-age=900'); // 15 min
    res.header('Last-Modified', result.lastModified.toUTCString());
    res.status(200).send(result.content);
  }

  // ==========================================================================
  // 2. Authenticated token CRUD (per-user)
  // ==========================================================================

  @Post('ical-tokens')
  @HttpCode(HttpStatus.CREATED)
  @RequireTenant()
  @RequirePermission(Permission.BOOKING_ICAL_MANAGE)
  async create(
    @Body() rawBody: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<IcalTokenCreatedDto> {
    const parsed = CreateIcalTokenSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BOOKING_ICAL_INVALID_INPUT',
        message: 'Invalid input',
        issues: parsed.error.flatten(),
      });
    }
    // Non-admin users cannot request team / all_tenant scope.
    const dto: CreateIcalTokenDto = parsed.data;
    if (dto.scope === 'all_tenant' && !this.hasAdminPermission()) {
      throw new BadRequestException({
        code: 'BOOKING_ICAL_SCOPE_FORBIDDEN',
        message: 'Scope all_tenant requires BOOKING_ICAL_ADMIN',
      });
    }

    const { token, plainToken } = await this.tokenService.create(dto);
    const feedUrl = this.buildFeedUrl(headers, plainToken);
    return {
      id: token.id,
      name: token.name,
      scope: token.scope,
      feedUrl,
      expiresAt: token.expiresAt ? token.expiresAt.toISOString() : null,
      createdAt: token.createdAt.toISOString(),
    };
  }

  @Get('ical-tokens')
  @RequireTenant()
  @RequirePermission(Permission.BOOKING_ICAL_MANAGE)
  async list(): Promise<{ tokens: IcalTokenSummaryDto[] }> {
    const rows = await this.tokenService.findByUser();
    return { tokens: rows.map((r) => this.toSummary(r)) };
  }

  @Delete('ical-tokens/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireTenant()
  @RequirePermission(Permission.BOOKING_ICAL_MANAGE)
  async revoke(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.tokenService.revoke(id);
  }

  // ==========================================================================
  // 3. Admin-only listing (every token in tenant)
  // ==========================================================================

  @Get('ical-tokens/admin/all')
  @RequireTenant()
  @RequirePermission(Permission.BOOKING_ICAL_ADMIN)
  async adminListAll(): Promise<{ tokens: IcalTokenSummaryDto[] }> {
    const rows = await this.tokenService.findAllTenantTokens();
    return { tokens: rows.map((r) => this.toSummary(r)) };
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Derive the absolute feed URL from the incoming request. iCal clients
   * subscribe-by-URL, so we MUST return an absolute URL that they can hit
   * directly. We trust `x-forwarded-proto` + `x-forwarded-host` when present
   * (behind a reverse proxy) ; otherwise fall back to the `host` header.
   *
   * The CALENDAR_PUBLIC_BASE_URL env var, if set, overrides everything (for
   * setups where the request host differs from the public origin -- e.g.
   * internal ALB -> CloudFront).
   */
  private buildFeedUrl(
    headers: Record<string, string | string[] | undefined>,
    plainToken: string,
  ): string {
    const override = process.env['CALENDAR_PUBLIC_BASE_URL'];
    if (override && !override.startsWith('PLACEHOLDER_')) {
      return `${override.replace(/\/+$/, '')}/api/v1/booking/calendar/ical/${plainToken}.ics`;
    }
    const protoRaw =
      this.headerString(headers, 'x-forwarded-proto') ?? 'https';
    const proto = protoRaw.split(',')[0] ?? 'https';
    const hostRaw =
      this.headerString(headers, 'x-forwarded-host') ??
      this.headerString(headers, 'host') ??
      'localhost';
    const host = hostRaw.split(',')[0] ?? 'localhost';
    return `${proto}://${host}/api/v1/booking/calendar/ical/${plainToken}.ics`;
  }

  private headerString(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name.toLowerCase()] ?? headers[name];
    if (value === undefined) return undefined;
    return Array.isArray(value) ? value[0] : value;
  }

  private toSummary(row: BookingIcalTokenEntity): IcalTokenSummaryDto {
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      name: row.name,
      scope: row.scope,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      lastAccessedAt: row.lastAccessedAt ? row.lastAccessedAt.toISOString() : null,
      accessCount: row.accessCount,
      active: row.active,
      revokedAt: row.revokedAt ? row.revokedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private hasAdminPermission(): boolean {
    const ctx = this.tenantContext.getCurrentContext();
    const role = ctx?.userRole as AuthRole | undefined;
    if (!role) return false;
    if (ctx?.isSuperAdmin) return true;
    return this.hierarchy
      .getEffectivePermissions(role)
      .has(Permission.BOOKING_ICAL_ADMIN);
  }
}
