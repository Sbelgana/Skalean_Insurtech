/**
 * @insurtech/auth/services/jwt
 *
 * Signs and verifies JWT (access + refresh) using RS256 asymmetric crypto.
 *
 * Reference :
 *   - RFC 7519 (JWT), RFC 7515 (JWS)
 *   - RFC 8017 (PKCS#1 RSA)
 *   - decision-014 (RS256 Sprint 5, key rotation Sprint 14)
 *   - Sprint 5 Tache 2.1.4
 *
 * Configuration via env :
 *   - JWT_PRIVATE_KEY : RSA private key (PEM, base64-encoded or literal multi-line)
 *   - JWT_PUBLIC_KEY  : RSA public key (PEM)
 *   - JWT_ISSUER, JWT_AUDIENCE (optional, default skalean-insurtech-api/app)
 *
 * Sprint 5 ships a single RSA key pair. Sprint 14 introduces a JWKS endpoint
 * with kid headers for graceful 90-day rotation.
 */

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { SignOptions, VerifyOptions } from 'jsonwebtoken';

// CJS/ESM interop : Node 22+ runtime only resolves the default export of
// jsonwebtoken. Named imports for the error classes fail with
// "does not provide an export named X". We resolve them through the default.
const JsonWebTokenError = jwt.JsonWebTokenError;
const NotBeforeError = jwt.NotBeforeError;
const JwtTokenExpiredError = jwt.TokenExpiredError;
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import { JWT_PARAMS } from '../constants/jwt-params.js';
import {
  TokenAudienceError,
  TokenExpiredError,
  TokenInvalidError,
  TokenIssuerError,
  TokenNotBeforeError,
  TokenSignatureError,
} from '../errors/token-errors.js';
import type { JwtPayload, RefreshTokenPayload } from '../types/jwt-payload.js';
import { nowInSeconds } from '../types/jwt-payload.js';
import type { SignedJwt } from '../types/token-pair.js';
import {
  assertRequiredClaims,
  decodeSegmentJson,
  parseAuthHeader,
  REQUIRED_ACCESS_CLAIMS,
  REQUIRED_REFRESH_CLAIMS,
  splitJwtSegments,
} from './jwt.helpers.js';

const ALGORITHM = 'RS256' as const;

@Injectable()
export class JwtService implements OnModuleInit {
  private readonly logger = new Logger(JwtService.name);
  private privateKey: string | null = null;
  private publicKey: string | null = null;
  private issuer: string = JWT_PARAMS.issuer;
  private audience: string = JWT_PARAMS.audience;

  onModuleInit(): void {
    const privKeyRaw = process.env['JWT_PRIVATE_KEY'];
    const pubKeyRaw = process.env['JWT_PUBLIC_KEY'];
    if (!privKeyRaw) {
      throw new Error('JwtService: JWT_PRIVATE_KEY env var is required (RSA PEM)');
    }
    if (!pubKeyRaw) {
      throw new Error('JwtService: JWT_PUBLIC_KEY env var is required (RSA PEM)');
    }
    this.privateKey = this.normalizePem(privKeyRaw, 'PRIVATE KEY');
    this.publicKey = this.normalizePem(pubKeyRaw, 'PUBLIC KEY');
    this.issuer = process.env['JWT_ISSUER'] ?? JWT_PARAMS.issuer;
    this.audience = process.env['JWT_AUDIENCE'] ?? JWT_PARAMS.audience;
    this.logger.log({
      action: 'jwt_init',
      algorithm: ALGORITHM,
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  /**
   * Accepts PEM either as a literal multi-line string OR base64-encoded single line
   * (convenient for env vars). Detects format heuristically.
   */
  private normalizePem(raw: string, kind: 'PRIVATE KEY' | 'PUBLIC KEY'): string {
    const trimmed = raw.trim();
    if (trimmed.includes('-----BEGIN')) return trimmed;
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
      if (decoded.includes('-----BEGIN')) return decoded.trim();
    } catch {
      // fall through
    }
    throw new Error(
      `JwtService: JWT_${kind === 'PRIVATE KEY' ? 'PRIVATE_KEY' : 'PUBLIC_KEY'} not a recognized PEM (literal or base64)`,
    );
  }

  /**
   * Signs an access token. Caller provides minimal claims ; service fills jti, iss, aud, iat, exp, nbf.
   */
  signAccessToken(
    input: Omit<JwtPayload, 'jti' | 'iss' | 'aud' | 'iat' | 'exp' | 'nbf'>,
  ): SignedJwt {
    if (this.privateKey === null) throw new Error('JwtService not initialized');
    const iat = nowInSeconds();
    const ttl = JWT_PARAMS.ttl_access_seconds;
    const payload: JwtPayload = {
      sub: input.sub,
      tenant_id: input.tenant_id,
      email: input.email,
      role: input.role,
      mfa_verified: input.mfa_verified,
      sid: input.sid,
      jti: ulid(),
      iss: this.issuer,
      aud: this.audience,
      iat,
      nbf: iat,
      exp: iat + ttl,
    };
    return jwt.sign(payload as object, this.privateKey, {
      algorithm: ALGORITHM,
    } satisfies SignOptions) as SignedJwt;
  }

  signRefreshToken(input: Omit<RefreshTokenPayload, 'jti' | 'iss' | 'iat' | 'exp'>): SignedJwt {
    if (this.privateKey === null) throw new Error('JwtService not initialized');
    const iat = nowInSeconds();
    const ttl = JWT_PARAMS.ttl_refresh_seconds;
    const payload: RefreshTokenPayload = {
      sub: input.sub,
      sid: input.sid,
      token_family: input.token_family,
      generation: input.generation,
      jti: ulid(),
      iss: this.issuer,
      iat,
      exp: iat + ttl,
    };
    return jwt.sign(payload as object, this.privateKey, {
      algorithm: ALGORITHM,
    } satisfies SignOptions) as SignedJwt;
  }

  verifyAccessToken(token: string): JwtPayload {
    if (this.publicKey === null) throw new Error('JwtService not initialized');
    return this.verifyToken<JwtPayload>(token, this.publicKey, REQUIRED_ACCESS_CLAIMS, {
      audience: this.audience,
      issuer: this.issuer,
    });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    if (this.publicKey === null) throw new Error('JwtService not initialized');
    return this.verifyToken<RefreshTokenPayload>(token, this.publicKey, REQUIRED_REFRESH_CLAIMS, {
      issuer: this.issuer,
    });
  }

  private verifyToken<T>(
    token: string,
    publicKey: string,
    requiredClaims: readonly string[],
    expected: { audience?: string; issuer?: string },
  ): T {
    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(token, publicKey, {
        algorithms: [ALGORITHM],
        clockTolerance: JWT_PARAMS.leeway_seconds,
        ...(expected.audience ? { audience: expected.audience } : {}),
        ...(expected.issuer ? { issuer: expected.issuer } : {}),
      } satisfies VerifyOptions);
    } catch (err: unknown) {
      this.translateJwtError(err);
    }
    if (typeof decoded! !== 'object' || decoded === null) {
      throw new TokenInvalidError('payload is not an object');
    }
    assertRequiredClaims(decoded as Record<string, unknown>, requiredClaims);
    return decoded as T;
  }

  private translateJwtError(err: unknown): never {
    if (err instanceof JwtTokenExpiredError) {
      throw new TokenExpiredError(
        Math.floor(err.expiredAt.getTime() / 1000),
        nowInSeconds(),
      );
    }
    if (err instanceof NotBeforeError) {
      throw new TokenNotBeforeError(Math.floor(err.date.getTime() / 1000), nowInSeconds());
    }
    if (err instanceof JsonWebTokenError) {
      const msg = err.message.toLowerCase();
      if (msg.includes('audience')) throw new TokenAudienceError(this.audience, undefined);
      if (msg.includes('issuer')) throw new TokenIssuerError(this.issuer, undefined);
      if (msg.includes('signature') || msg.includes('invalid key')) {
        throw new TokenSignatureError();
      }
      throw new TokenInvalidError(err.message);
    }
    throw new TokenInvalidError('unknown verification error');
  }

  /**
   * Decodes a JWT WITHOUT verifying its signature.
   * USE ONLY FOR DEBUG / LOGS. Never trust the returned payload for authorization.
   */
  decodeUnsafe<T = Record<string, unknown>>(token: string): T | null {
    try {
      const { payload } = splitJwtSegments(token);
      return decodeSegmentJson<T>(payload);
    } catch {
      return null;
    }
  }

  /** Extracts the bearer token from an Authorization header. Returns null on malformed. */
  extractFromHeader(header: string | undefined | null): string | null {
    return parseAuthHeader(header);
  }

  /** Generates a ULID for use as jti, sid, or token_family. */
  generateId(): string {
    return ulid();
  }

  /** Generates a UUID v4 alternative (kept for callers expecting RFC 4122). */
  generateUuid(): string {
    return randomUUID();
  }
}
