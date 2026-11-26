/**
 * Africa/Cairo calendar reporting boundaries (W5).
 *
 * "Last N days" means N Cairo calendar dates including today. The database
 * range starts at the first instant of the first Cairo date and ends at the
 * first instant of tomorrow in Cairo (exclusive), so requests are never
 * silently filtered by UTC day boundaries. Egyptian midnight can be skipped by
 * a DST transition; the earliest existing instant of that calendar date is
 * used instead of silently shifting to a different day.
 */

export const REPORTING_TIMEZONE = 'Africa/Cairo';
export const REPORTING_TIMEZONE_LABEL = 'بتوقيت القاهرة';
export const OVERVIEW_PERIODS = [7, 30, 90] as const;
export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

export type CairoDateParts = { year: number; month: number; day: number };

const formatter = new Intl.DateTimeFormat('en-US', {
  timeZone: REPORTING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function cairoPartsAt(epochMs: number): CairoDateParts & {
  hour: number;
  minute: number;
  second: number;
} {
  const parts = formatter.formatToParts(new Date(epochMs));
  const get = (type: string): number => {
    const value = parts.find((part) => part.type === type)?.value;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error('Cairo time conversion failed');
    return parsed;
  };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

export function cairoDateKey(parts: CairoDateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function addCairoDays(parts: CairoDateParts, days: number): CairoDateParts {
  const base = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
  };
}

function cairoOffsetMs(epochMs: number): number {
  const floored = Math.floor(epochMs / 1000) * 1000;
  const parts = cairoPartsAt(floored);
  return (
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ) - floored
  );
}

/** Earliest existing absolute instant belonging to the Cairo calendar date. */
export function cairoDayStart(parts: CairoDateParts): Date {
  const naive = Date.UTC(parts.year, parts.month - 1, parts.day, 0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const offsets = new Set<number>();
  for (const probe of [naive - 2 * dayMs, naive, naive + 2 * dayMs]) {
    offsets.add(cairoOffsetMs(probe));
  }
  const candidates: number[] = [];
  for (let hour = 0; hour <= 3; hour += 1) {
    for (const offset of offsets) {
      const candidate = naive + hour * 60 * 60 * 1000 - offset;
      const local = cairoPartsAt(candidate);
      if (
        local.year === parts.year &&
        local.month === parts.month &&
        local.day === parts.day
      ) {
        candidates.push(candidate);
      }
    }
  }
  if (candidates.length === 0) {
    throw new Error('Cairo day boundary could not be resolved');
  }
  return new Date(Math.min(...candidates));
}

export type CairoReportingRange = {
  days: number;
  start: Date;
  endExclusive: Date;
  startDate: string;
  endDate: string;
  dates: string[];
};

export function cairoReportingRange(now: Date, days: number): CairoReportingRange {
  if (!(OVERVIEW_PERIODS as readonly number[]).includes(days)) {
    throw new Error('Unsupported reporting period');
  }
  const today = cairoPartsAt(now.getTime());
  const startParts = addCairoDays(today, -(days - 1));
  const endParts = addCairoDays(today, 1);
  const dates: string[] = [];
  for (let index = 0; index < days; index += 1) {
    dates.push(cairoDateKey(addCairoDays(startParts, index)));
  }
  return {
    days,
    start: cairoDayStart(startParts),
    endExclusive: cairoDayStart(endParts),
    startDate: cairoDateKey(startParts),
    endDate: cairoDateKey(today),
    dates,
  };
}

export function parseOverviewPeriod(
  raw: string | string[] | undefined,
): OverviewPeriod {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? '', 10);
  return (OVERVIEW_PERIODS as readonly number[]).includes(parsed)
    ? (parsed as OverviewPeriod)
    : 7;
}
