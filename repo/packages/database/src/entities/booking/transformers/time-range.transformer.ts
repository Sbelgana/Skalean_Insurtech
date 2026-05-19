import type { ValueTransformer } from 'typeorm';

export interface TimeRange {
  start: Date;
  end: Date;
}

export class TimeRangeTransformer implements ValueTransformer {
  to(value: TimeRange | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (!(value.start instanceof Date) || !(value.end instanceof Date)) {
      throw new Error('TimeRangeTransformer: start and end must be Date instances');
    }
    if (value.start.getTime() >= value.end.getTime()) {
      throw new Error('TimeRangeTransformer: start must be strictly before end');
    }
    return `[${value.start.toISOString()},${value.end.toISOString()})`;
  }

  from(value: string | null | undefined): TimeRange | null {
    if (value === null || value === undefined) {
      return null;
    }
    const match = value.match(/^([\[(])(.+?),(.+?)([\])])$/);
    if (!match) {
      throw new Error(`TimeRangeTransformer: invalid tstzrange format "${value}"`);
    }
    const startStr = match[2]?.replace(/^"|"$/g, '').trim() ?? '';
    const endStr = match[3]?.replace(/^"|"$/g, '').trim() ?? '';
    const start = new Date(startStr);
    const end = new Date(endStr);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error(`TimeRangeTransformer: invalid date in range "${value}"`);
    }
    return { start, end };
  }
}
