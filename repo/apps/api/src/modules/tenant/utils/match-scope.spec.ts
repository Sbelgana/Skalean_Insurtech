/**
 * Tests matchesScope helper.
 *
 * Reference : Sprint 6 / Tache 2.2.6.
 */

import { describe, expect, it } from 'vitest';
import { matchesScope } from './match-scope.js';

describe('matchesScope', () => {
  it('1. exact match returns true', () => {
    expect(matchesScope(['read.sinistre'], 'read.sinistre')).toBe(true);
  });

  it('2. exact mismatch returns false', () => {
    expect(matchesScope(['read.sinistre'], 'write.sinistre')).toBe(false);
  });

  it('3. full wildcard *.* matches anything', () => {
    expect(matchesScope(['*.*'], 'read.sinistre')).toBe(true);
    expect(matchesScope(['*.*'], 'write.devis')).toBe(true);
    expect(matchesScope(['*.*'], 'delete.tenant.archive')).toBe(true);
  });

  it('4. read.* matches all read actions', () => {
    expect(matchesScope(['read.*'], 'read.sinistre')).toBe(true);
    expect(matchesScope(['read.*'], 'read.devis')).toBe(true);
    expect(matchesScope(['read.*'], 'read.facture.draft')).toBe(true);
  });

  it('5. read.* does NOT match write actions', () => {
    expect(matchesScope(['read.*'], 'write.sinistre')).toBe(false);
  });

  it('6. multiple scope entries OR-matched', () => {
    expect(matchesScope(['read.sinistre', 'write.devis'], 'write.devis')).toBe(true);
  });

  it('7. read.sinistre does NOT match read.sinistre.own (length strict)', () => {
    expect(matchesScope(['read.sinistre'], 'read.sinistre.own')).toBe(false);
  });

  it('8. read.sinistre.* matches read.sinistre.own', () => {
    expect(matchesScope(['read.sinistre.*'], 'read.sinistre.own')).toBe(true);
  });

  it('9. empty scope returns false', () => {
    expect(matchesScope([], 'read.sinistre')).toBe(false);
  });

  it('10. wildcard middle position *.sinistre', () => {
    expect(matchesScope(['*.sinistre'], 'read.sinistre')).toBe(true);
    expect(matchesScope(['*.sinistre'], 'write.sinistre')).toBe(true);
    expect(matchesScope(['*.sinistre'], 'read.devis')).toBe(false);
  });

  it('11. action with extra qualifier matches partial wildcard scope', () => {
    expect(matchesScope(['read.sinistre.own.shared'], 'read.sinistre.own.shared')).toBe(true);
    expect(matchesScope(['read.sinistre.own'], 'read.sinistre.own.shared')).toBe(false);
  });

  it('12. analyst_support read-all scope', () => {
    expect(matchesScope(['read.*'], 'read.tenant')).toBe(true);
    expect(matchesScope(['read.*'], 'read.user.profile')).toBe(true);
    expect(matchesScope(['read.*'], 'write.tenant')).toBe(false);
  });

  it('13. broker_to_garage_assignment scope realistic', () => {
    const scope = ['read.sinistre', 'write.devis', 'write.facture', 'read.police'];
    expect(matchesScope(scope, 'read.sinistre')).toBe(true);
    expect(matchesScope(scope, 'write.devis')).toBe(true);
    expect(matchesScope(scope, 'delete.sinistre')).toBe(false);
    expect(matchesScope(scope, 'write.police')).toBe(false);
  });

  it('14. assure_to_garage_visit scope', () => {
    const scope = ['read.police', 'read.sinistre.own'];
    expect(matchesScope(scope, 'read.police')).toBe(true);
    expect(matchesScope(scope, 'read.sinistre.own')).toBe(true);
    expect(matchesScope(scope, 'read.sinistre.other')).toBe(false);
  });

  it('15. multi_tenant_user_access super admin scope', () => {
    expect(matchesScope(['*.*'], 'read.sinistre')).toBe(true);
    expect(matchesScope(['*.*'], 'write.tenant.suspend')).toBe(true);
    expect(matchesScope(['*.*'], 'delete.user')).toBe(true);
  });

  it('16. wildcard tail accepts arbitrary depth', () => {
    expect(matchesScope(['read.*'], 'read.a.b.c.d.e')).toBe(true);
  });
});
