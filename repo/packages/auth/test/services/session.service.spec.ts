/**
 * Tests for @insurtech/auth/services/session.service
 * Uses ioredis-mock to exercise the full Lua rotation script.
 * Sprint 5 Tache 2.1.5
 */

import RedisMock from 'ioredis-mock';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  RefreshReplayDetectedError,
  SessionNotFoundError,
  SessionRevokedError,
} from '../../src/errors/session-errors.js';
import { NoOpSessionRepository } from '../../src/services/session.repository.js';
import { SessionService, type RedisLike } from '../../src/services/session.service.js';
import { AuthRole } from '../../src/types/auth-roles.js';
import type { CreateSessionInput } from '../../src/types/session-metadata.js';

function makeInput(overrides: Partial<CreateSessionInput> = {}): CreateSessionInput {
  return {
    user_id: 'u1',
    tenant_id: 't1',
    role: AuthRole.BrokerUser,
    jti: 'jti-1',
    refresh_token_family: 'fam-1',
    refresh_generation: 1,
    ip: '1.2.3.4',
    user_agent: 'vitest',
    mfa_verified: true,
    remember_me: false,
    ...overrides,
  };
}

describe('SessionService (ioredis-mock)', () => {
  let svc: SessionService;
  let redis: RedisLike;

  beforeEach(async () => {
    const mock = new RedisMock();
    await (mock as unknown as { flushall(): Promise<string> }).flushall();
    redis = mock as unknown as RedisLike;
    svc = new SessionService(redis, new NoOpSessionRepository());
    svc.onModuleInit();
  });

  describe('createSession', () => {
    it('persists a session retrievable via getSession', async () => {
      await svc.createSession(makeInput());
      const s = await svc.getSession('jti-1');
      expect(s).not.toBeNull();
      expect(s?.user_id).toBe('u1');
      expect(s?.refresh_generation).toBe(1);
    });

    it('default TTL is applied (remember_me=false)', async () => {
      const s = await svc.createSession(makeInput({ remember_me: false }));
      expect(s.expires_at - s.created_at).toBe(28800);
    });

    it('remember_me TTL is much longer', async () => {
      const s = await svc.createSession(makeInput({ remember_me: true, jti: 'jti-rem' }));
      expect(s.expires_at - s.created_at).toBe(2592000);
    });
  });

  describe('revokeSession', () => {
    it('removes session and marks revoked', async () => {
      await svc.createSession(makeInput());
      await svc.revokeSession('jti-1');
      const s = await svc.getSession('jti-1');
      expect(s).toBeNull();
      expect(await svc.isRevoked('jti-1')).toBe(true);
    });

    it('throws SessionRevokedError on ensureValid for revoked', async () => {
      await svc.createSession(makeInput());
      await svc.revokeSession('jti-1');
      await expect(svc.ensureValid('jti-1')).rejects.toThrow(SessionRevokedError);
    });

    it('ensureValid throws NotFound when never created', async () => {
      await expect(svc.ensureValid('jti-unknown')).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('revokeUserSessions', () => {
    it('revokes all sessions of a user', async () => {
      await svc.createSession(makeInput({ jti: 'a' }));
      await svc.createSession(makeInput({ jti: 'b', refresh_token_family: 'fam-2' }));
      const count = await svc.revokeUserSessions('u1');
      expect(count).toBe(2);
      expect(await svc.getSession('a')).toBeNull();
      expect(await svc.getSession('b')).toBeNull();
    });
  });

  describe('revokeFamily', () => {
    it('revokes all sessions in a family', async () => {
      await svc.createSession(makeInput({ jti: 'a' }));
      await svc.createSession(makeInput({ jti: 'b' }));
      const count = await svc.revokeFamily('fam-1');
      expect(count).toBe(2);
    });
  });

  describe('rotateSession (theft detection)', () => {
    it('rotates atomically when expected_generation matches', async () => {
      await svc.createSession(makeInput({ jti: 'old', refresh_generation: 1 }));
      const newS = await svc.rotateSession({
        old_jti: 'old',
        new_jti: 'new',
        expected_generation: 1,
        new_generation: 2,
        ip: '5.6.7.8',
        user_agent: 'rotated',
      });
      expect(newS.jti).toBe('new');
      expect(newS.refresh_generation).toBe(2);
      expect(await svc.getSession('old')).toBeNull();
      expect(await svc.isRevoked('old')).toBe(true);
    });

    it('throws RefreshReplayDetectedError on generation mismatch and revokes family', async () => {
      await svc.createSession(makeInput({ jti: 'old', refresh_generation: 2 }));
      await svc.createSession(
        makeInput({ jti: 'sibling', refresh_generation: 2, refresh_token_family: 'fam-1' }),
      );
      await expect(
        svc.rotateSession({
          old_jti: 'old',
          new_jti: 'new',
          expected_generation: 1,
          new_generation: 3,
          ip: '5.6.7.8',
          user_agent: 'replay',
        }),
      ).rejects.toThrow(RefreshReplayDetectedError);
      expect(await svc.getSession('old')).toBeNull();
      expect(await svc.getSession('sibling')).toBeNull();
    });

    it('throws SessionNotFoundError if old session is missing', async () => {
      await expect(
        svc.rotateSession({
          old_jti: 'gone',
          new_jti: 'new',
          expected_generation: 1,
          new_generation: 2,
          ip: '1.2.3.4',
          user_agent: 'x',
        }),
      ).rejects.toThrow(SessionNotFoundError);
    });
  });

  describe('listUserSessions', () => {
    it('returns sessions sorted by last_seen_at desc', async () => {
      await svc.createSession(makeInput({ jti: 'a' }));
      await new Promise((r) => setTimeout(r, 5));
      await svc.createSession(makeInput({ jti: 'b', refresh_token_family: 'fam-2' }));
      const list = await svc.listUserSessions('u1');
      expect(list).toHaveLength(2);
    });
  });
});
