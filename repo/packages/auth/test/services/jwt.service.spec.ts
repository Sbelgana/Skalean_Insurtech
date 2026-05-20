/**
 * Tests for @insurtech/auth/services/jwt.service (RS256).
 * Sprint 5 Tache 2.1.4
 *
 * Generates a fresh RSA 2048 key pair in beforeAll so tests are deterministic
 * and do not depend on any external secret file.
 */

import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { JwtService } from '../../src/services/jwt.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';
import {
  TokenAudienceError,
  TokenExpiredError,
  TokenInvalidError,
  TokenSignatureError,
} from '../../src/errors/token-errors.js';

describe('JwtService (RS256)', () => {
  let service: JwtService;
  let privateKey: string;
  let publicKey: string;
  const SAVED: Record<string, string | undefined> = {};
  const KEYS = ['JWT_PRIVATE_KEY', 'JWT_PUBLIC_KEY', 'JWT_ISSUER', 'JWT_AUDIENCE'];

  beforeAll(() => {
    const kp = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    privateKey = kp.privateKey;
    publicKey = kp.publicKey;
    for (const k of KEYS) SAVED[k] = process.env[k];
    process.env['JWT_PRIVATE_KEY'] = privateKey;
    process.env['JWT_PUBLIC_KEY'] = publicKey;
    process.env['JWT_ISSUER'] = 'skalean-insurtech-api';
    process.env['JWT_AUDIENCE'] = 'skalean-insurtech-app';

    service = new JwtService();
    service.onModuleInit();
  });

  afterAll(() => {
    for (const k of KEYS) {
      if (SAVED[k] === undefined) delete process.env[k];
      else process.env[k] = SAVED[k];
    }
  });

  describe('signAccessToken', () => {
    it('returns a 3-part dot-separated JWT', () => {
      const t = service.signAccessToken({
        sub: 'u1',
        tenant_id: 't1',
        email: 'a@b.com',
        role: AuthRole.BrokerUser,
        mfa_verified: true,
        sid: service.generateId(),
      });
      expect(t.split('.')).toHaveLength(3);
    });

    it('payload carries the expected claims', () => {
      const sid = service.generateId();
      const t = service.signAccessToken({
        sub: 'u1',
        tenant_id: 't1',
        email: 'e@e.com',
        role: AuthRole.BrokerAdmin,
        mfa_verified: false,
        sid,
      });
      const decoded = service.decodeUnsafe<{
        sub: string;
        iss: string;
        aud: string;
        role: string;
        mfa_verified: boolean;
        sid: string;
        jti: string;
      }>(t);
      expect(decoded?.sub).toBe('u1');
      expect(decoded?.iss).toBe('skalean-insurtech-api');
      expect(decoded?.aud).toBe('skalean-insurtech-app');
      expect(decoded?.role).toBe(AuthRole.BrokerAdmin);
      expect(decoded?.mfa_verified).toBe(false);
      expect(decoded?.sid).toBe(sid);
      expect(typeof decoded?.jti).toBe('string');
    });

    it('JWT header declares alg=RS256', () => {
      const t = service.signAccessToken({
        sub: 'u1',
        tenant_id: null,
        email: 'e@e.com',
        role: AuthRole.SuperAdminPlatform,
        mfa_verified: true,
        sid: service.generateId(),
      });
      const hdrSeg = t.split('.')[0] ?? '';
      const hdr = JSON.parse(Buffer.from(hdrSeg, 'base64url').toString('utf-8')) as {
        alg: string;
      };
      expect(hdr.alg).toBe('RS256');
    });
  });

  describe('verifyAccessToken', () => {
    it('round-trips the same payload', () => {
      const sid = service.generateId();
      const signed = service.signAccessToken({
        sub: 'u1',
        tenant_id: 't1',
        email: 'e@e.com',
        role: AuthRole.BrokerUser,
        mfa_verified: true,
        sid,
      });
      const verified = service.verifyAccessToken(signed);
      expect(verified.sub).toBe('u1');
      expect(verified.role).toBe(AuthRole.BrokerUser);
      expect(verified.sid).toBe(sid);
    });

    it('throws TokenExpiredError on expired token', () => {
      const expired = jwt.sign(
        {
          sub: 'u1',
          tenant_id: null,
          email: 'e@e.com',
          role: AuthRole.SuperAdminPlatform,
          mfa_verified: true,
          jti: 'jti1',
          sid: 'sid1',
          iss: 'skalean-insurtech-api',
          aud: 'skalean-insurtech-app',
          iat: 1000,
          nbf: 1000,
          exp: 1001,
        },
        privateKey,
        { algorithm: 'RS256', noTimestamp: true },
      );
      expect(() => service.verifyAccessToken(expired)).toThrow(TokenExpiredError);
    });

    it('throws TokenSignatureError on token signed with foreign key', () => {
      const otherKey = generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      }).privateKey;
      const wrongSig = jwt.sign(
        {
          sub: 'u1',
          tenant_id: null,
          email: 'e@e.com',
          role: AuthRole.BrokerAdmin,
          mfa_verified: false,
          jti: 'j',
          sid: 's',
          iss: 'skalean-insurtech-api',
          aud: 'skalean-insurtech-app',
          iat: Math.floor(Date.now() / 1000),
          nbf: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
        },
        otherKey,
        { algorithm: 'RS256', noTimestamp: true },
      );
      expect(() => service.verifyAccessToken(wrongSig)).toThrow(TokenSignatureError);
    });

    it('throws TokenAudienceError on wrong audience', () => {
      const wrong = jwt.sign(
        {
          sub: 'u1',
          tenant_id: null,
          email: 'e@e.com',
          role: AuthRole.BrokerUser,
          mfa_verified: true,
          jti: 'j',
          sid: 's',
          iss: 'skalean-insurtech-api',
          aud: 'wrong-aud',
          iat: Math.floor(Date.now() / 1000),
          nbf: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 900,
        },
        privateKey,
        { algorithm: 'RS256', noTimestamp: true },
      );
      expect(() => service.verifyAccessToken(wrong)).toThrow(TokenAudienceError);
    });

    it('throws TokenInvalidError on malformed token', () => {
      expect(() => service.verifyAccessToken('not-a-jwt')).toThrow(TokenInvalidError);
    });
  });

  describe('signRefreshToken + verifyRefreshToken', () => {
    it('round-trips refresh payload with token_family + generation', () => {
      const family = service.generateId();
      const signed = service.signRefreshToken({
        sub: 'u1',
        sid: 'sid1',
        token_family: family,
        generation: 1,
      });
      const verified = service.verifyRefreshToken(signed);
      expect(verified.sub).toBe('u1');
      expect(verified.token_family).toBe(family);
      expect(verified.generation).toBe(1);
    });
  });

  describe('decodeUnsafe', () => {
    it('returns payload without verifying', () => {
      const t = service.signAccessToken({
        sub: 'u1',
        tenant_id: null,
        email: 'e@e.com',
        role: AuthRole.Assure,
        mfa_verified: false,
        sid: service.generateId(),
      });
      const p = service.decodeUnsafe<{ sub: string }>(t);
      expect(p?.sub).toBe('u1');
    });

    it('returns null for malformed', () => {
      expect(service.decodeUnsafe('not.a.jwt')).toBeNull();
    });
  });

  describe('extractFromHeader', () => {
    it('parses Bearer header', () => {
      expect(service.extractFromHeader('Bearer abc.def.ghi')).toBe('abc.def.ghi');
    });

    it('returns null for non-Bearer', () => {
      expect(service.extractFromHeader('Basic xyz')).toBeNull();
    });
  });

  describe('generateId / generateUuid', () => {
    it('generateId returns 26-char ULID', () => {
      const id = service.generateId();
      expect(id).toHaveLength(26);
      expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    });

    it('generateUuid returns UUID v4', () => {
      const id = service.generateUuid();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });
});
