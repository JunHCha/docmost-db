import { BadRequestException } from '@nestjs/common';
import { resolveDateWindow } from './filter-engine';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('resolveDateWindow', () => {
  const now = new Date('2026-07-13T10:30:00Z'); // a Monday

  it('turns a plain date string into a UTC day window', () => {
    const [start, end] = resolveDateWindow('2026-07-01', now);
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(DAY_MS);
  });

  it('resolves exact mode like a date string', () => {
    const [start] = resolveDateWindow(
      { mode: 'exact', date: '2026-07-13T15:00:00Z' },
      now,
    );
    expect(start.toISOString()).toBe('2026-07-13T00:00:00.000Z');
  });

  it('resolves relative anchors against today', () => {
    const [todayStart, todayEnd] = resolveDateWindow(
      { mode: 'relative', preset: 'today' },
      now,
    );
    expect(todayStart.toISOString()).toBe('2026-07-13T00:00:00.000Z');
    expect(todayEnd.toISOString()).toBe('2026-07-14T00:00:00.000Z');

    const [tomorrowStart] = resolveDateWindow(
      { mode: 'relative', preset: 'tomorrow' },
      now,
    );
    expect(tomorrowStart.toISOString()).toBe('2026-07-14T00:00:00.000Z');
  });

  it('resolves thisWeek starting Monday', () => {
    const [start, end] = resolveDateWindow(
      { mode: 'range', preset: 'thisWeek' },
      now,
    );
    expect(start.toISOString()).toBe('2026-07-13T00:00:00.000Z');
    expect((end.getTime() - start.getTime()) / DAY_MS).toBe(7);
  });

  it('resolves thisMonth/nextMonth calendar windows', () => {
    const [start, end] = resolveDateWindow(
      { mode: 'range', preset: 'thisMonth' },
      now,
    );
    expect(start.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('rejects garbage', () => {
    expect(() => resolveDateWindow('not-a-date', now)).toThrow(
      BadRequestException,
    );
    expect(() => resolveDateWindow({ mode: 'nope' } as any, now)).toThrow(
      BadRequestException,
    );
  });
});
