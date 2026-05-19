import { describe, it, expect } from 'vitest';
import { getTenantCacheKey, getGlobalKey, getTenantScanPattern } from './key-naming.js';

describe('getTenantCacheKey', () => {
  it('should build canonical pattern', () => {
    expect(getTenantCacheKey('cache', 'police', 'tenant-uuid', 'police-uuid')).toBe(
      'cache:police:tenant-uuid:police-uuid',
    );
  });

  it('should support sub-key', () => {
    expect(getTenantCacheKey('cache', 'police', 'tenant-uuid', 'police-uuid', 'sub')).toBe(
      'cache:police:tenant-uuid:police-uuid:sub',
    );
  });

  it('should throw if less than 3 parts', () => {
    expect(() => getTenantCacheKey('cache', 'police')).toThrow(/at least 3 parts/);
  });

  it('should throw if part contains separator', () => {
    expect(() => getTenantCacheKey('cache:bad', 'police', 'tenant')).toThrow(/must not contain/);
  });

  it('should throw on empty part', () => {
    expect(() => getTenantCacheKey('cache', '', 'tenant')).toThrow(/Invalid key part/);
  });
});

describe('getGlobalKey', () => {
  it('should build queue key', () => {
    expect(getGlobalKey('queue', 'wa-send', 'waiting')).toBe('queue:wa-send:waiting');
  });

  it('should require at least 2 parts', () => {
    expect(() => getGlobalKey('queue')).toThrow(/at least 2 parts/);
  });
});

describe('getTenantScanPattern', () => {
  it('should build wildcard for tenant scope', () => {
    expect(getTenantScanPattern('cache', 'police', 'tenant-uuid')).toBe(
      'cache:police:tenant-uuid:*',
    );
  });

  it('should support entity wildcard', () => {
    expect(getTenantScanPattern('cache', '*', 'tenant-uuid')).toBe('cache:*:tenant-uuid:*');
  });
});
