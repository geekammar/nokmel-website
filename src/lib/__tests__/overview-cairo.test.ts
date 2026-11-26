import { describe, expect, test } from 'vitest';
import {
  addCairoDays,
  cairoDateKey,
  cairoDayStart,
  cairoPartsAt,
  cairoReportingRange,
  parseOverviewPeriod,
} from '@/lib/overview/cairo';

function cairoWallClock(date: Date): string {
  const parts = cairoPartsAt(date.getTime());
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')} ${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
}

describe('Cairo reporting boundaries', () => {
  test('last 7/30/90 days are Cairo calendar dates including today', () => {
    const now = new Date('2026-11-26T15:30:00Z');
    const weekly = cairoReportingRange(now, 7);
    expect(weekly.startDate).toBe('2026-11-20');
    expect(weekly.endDate).toBe('2026-11-26');
    expect(weekly.dates).toHaveLength(7);
    expect(weekly.dates[0]).toBe('2026-11-20');
    expect(weekly.dates[6]).toBe('2026-11-26');
    expect(cairoWallClock(weekly.start)).toBe('2026-11-20 00:00');
    expect(cairoWallClock(weekly.endExclusive)).toBe('2026-11-27 00:00');

    expect(cairoReportingRange(now, 30).dates).toHaveLength(30);
    expect(cairoReportingRange(now, 90).dates).toHaveLength(90);
    expect(cairoReportingRange(now, 30).startDate).toBe('2026-10-28');
    expect(cairoReportingRange(now, 90).startDate).toBe('2026-08-29');
  });

  test('range start excludes requests before Cairo midnight', () => {
    const now = new Date('2026-11-26T00:30:00+02:00');
    const range = cairoReportingRange(now, 7);
    expect(cairoWallClock(range.start)).toBe('2026-11-20 00:00');
    expect(range.start.toISOString()).toBe('2026-11-19T22:00:00.000Z');
  });

  test('a DST-skipped Cairo midnight uses the earliest existing instant of that date', () => {
    const parts = { year: 2025, month: 4, day: 25 };
    const start = cairoDayStart(parts);
    expect(start.toISOString()).toBe('2025-04-24T22:00:00.000Z');
    expect(cairoWallClock(start)).toBe('2025-04-25 01:00');
  });

  test('autumn DST boundary keeps the correct Cairo date', () => {
    const now = new Date('2025-10-30T21:30:00Z');
    const range = cairoReportingRange(now, 7);
    expect(range.endDate).toBe('2025-10-30');
    expect(cairoWallClock(range.endExclusive)).toBe('2025-10-31 00:00');
    expect(range.endExclusive.toISOString()).toBe('2025-10-30T22:00:00.000Z');
  });

  test('calendar day arithmetic is DST-independent', () => {
    expect(addCairoDays({ year: 2025, month: 4, day: 25 }, -1)).toEqual({
      year: 2025,
      month: 4,
      day: 24,
    });
    expect(addCairoDays({ year: 2025, month: 12, day: 31 }, 1)).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
    expect(cairoDateKey({ year: 2026, month: 2, day: 3 })).toBe('2026-02-03');
  });

  test('period parser accepts only supported values', () => {
    expect(parseOverviewPeriod('7')).toBe(7);
    expect(parseOverviewPeriod('30')).toBe(30);
    expect(parseOverviewPeriod('90')).toBe(90);
    expect(parseOverviewPeriod('31')).toBe(7);
    expect(parseOverviewPeriod(undefined)).toBe(7);
    expect(parseOverviewPeriod(['30', '90'])).toBe(30);
  });
});
