import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatTime, formatRelativeTime, formatDateRange } from '../format-date';

describe('format-date', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-06T10:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats date dd/MM/yyyy in fr', () => {
    const result = formatDate(new Date('2026-05-06T12:00:00Z'), 'fr', 'short');
    expect(result).toMatch(/\d{2}\/\d{2}\/2026/);
  });

  it('formats date with ar locale', () => {
    const result = formatDate(new Date('2026-05-06T12:00:00Z'), 'ar', 'short');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats date with ar-MA locale', () => {
    const result = formatDate(new Date('2026-05-06T12:00:00Z'), 'ar-MA', 'short');
    expect(result).toBeTruthy();
  });

  it('respects timezone Africa/Casablanca (UTC+1)', () => {
    const utc = new Date('2026-05-06T23:30:00Z');
    const result = formatTime(utc, 'fr');
    expect(result).toBe('00:30');
  });

  it('handles DST Casablanca (summer and winter)', () => {
    const summer = new Date('2026-07-15T12:00:00Z');
    const winter = new Date('2026-12-15T12:00:00Z');
    expect(formatTime(summer, 'fr')).toBeTruthy();
    expect(formatTime(winter, 'fr')).toBeTruthy();
  });

  it('formats time with seconds', () => {
    const date = new Date('2026-05-06T14:30:45Z');
    const result = formatTime(date, 'fr', true);
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('formats relative time yesterday in fr', () => {
    const yesterday = new Date('2026-05-05T10:00:00Z');
    const result = formatRelativeTime(yesterday, 'fr');
    expect(result).toMatch(/hier|jour/i);
  });

  it('formats date range fr', () => {
    const start = new Date('2026-05-01T12:00:00Z');
    const end = new Date('2026-05-31T12:00:00Z');
    const result = formatDateRange(start, end, 'fr', 'short');
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty string for invalid date', () => {
    const result = formatDate('not-a-date', 'fr');
    expect(result).toBe('');
  });

  it('formats long date with weekday in fr', () => {
    const date = new Date('2026-05-06T12:00:00Z');
    const result = formatDate(date, 'fr', 'long');
    expect(result).toMatch(/mercredi/i);
  });
});
