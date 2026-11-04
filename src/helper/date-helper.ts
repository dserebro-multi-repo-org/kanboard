import { formatDate } from '../core/translator/date.js';
import { sprintf } from '../core/translator/sprintf.js';
import { t } from '../core/translator/functions.js';
import { empty, BatchBHelper } from './batch-b-support.js';

/**
 * Equivalent of PHP `date_default_timezone_set()` for the date helpers (the PHP application sets it per user in
 * the bootstrap subscriber, M5). UTC by default.
 */
let defaultTimezone = 'UTC';

export function setDefaultTimezone(timezone: string): void {
  defaultTimezone = timezone;
}

export function getDefaultTimezone(): string {
  return defaultTimezone;
}

/** Offset (ms) of a time zone at the given instant. */
function timezoneOffsetMs(timestampMs: number, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const map: Record<string, number> = {};
  for (const part of fmt.formatToParts(new Date(timestampMs))) {
    if (part.type !== 'literal') map[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(map.year as number, (map.month as number) - 1, map.day as number, map.hour as number, map.minute as number, map.second as number);
  return asUtc - Math.floor(timestampMs / 1000) * 1000;
}

/** Wall-clock components interpreted in the default time zone to a unix timestamp. */
function localToTimestamp(y: number, mo: number, d: number, h: number, mi: number, s: number): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi, s);
  let ts = guess - timezoneOffsetMs(guess, defaultTimezone);
  ts = guess - timezoneOffsetMs(ts, defaultTimezone);
  return Math.floor(ts / 1000);
}

/**
 * Subset of PHP `strtotime()` covering the formats stored by Kanboard (`Y-m-d`, `Y-m-d H:i[:s]`, ISO 8601,
 * `m/d/Y [H:i[:s]]`). Returns `false` when the string cannot be parsed.
 */
export function strtotime(value: string): number | false {
  const text = value.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(text);
  if (m !== null) {
    const parts = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0)] as const;
    const zone = m[7];
    if (zone === undefined) return localToTimestamp(...parts);
    const sign = zone.startsWith('-') ? -1 : 1;
    const digits = zone.replace(/[^0-9]/g, '');
    const offset = zone.toUpperCase() === 'Z' ? 0 : sign * (Number(digits.slice(0, 2)) * 3600 + Number(digits.slice(2, 4)) * 60);
    return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]) / 1000) - offset;
  }

  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (m !== null) {
    return localToTimestamp(Number(m[3]), Number(m[1]), Number(m[2]), Number(m[4] ?? 0), Number(m[5] ?? 0), Number(m[6] ?? 0));
  }

  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? false : Math.floor(parsed / 1000);
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Port of `app/Helper/DateHelper.php` (registered as `dt`). */
export class DateHelper extends BatchBHelper {
  /** Get formatted time. */
  async time(value: number): Promise<string> {
    return formatDate(await this.service('configModel').get('application_time_format', 'H:i'), value, defaultTimezone);
  }

  /** Get formatted date. */
  async date(value: unknown): Promise<string> {
    if (empty(value)) {
      return '';
    }

    let timestamp: number;
    if (!/^[0-9]+$/.test(String(value))) {
      timestamp = strtotime(String(value)) || 0;
    } else {
      timestamp = Number(value);
    }

    return formatDate(await this.service('configModel').get('application_date_format', 'm/d/Y'), timestamp, defaultTimezone);
  }

  /** Get formatted datetime. */
  async datetime(value: number): Promise<string> {
    return formatDate(await this.collab('dateParser').getUserDateTimeFormat(), value, defaultTimezone);
  }

  /** Get duration in seconds into human format. */
  duration(seconds: number): string | number {
    if (Number(seconds) === 0) {
      return 0;
    }

    const total = Math.abs(Math.trunc(Number(seconds)));
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    return `${days} ${t('days')}, ${hours} ${t('hours')}, ${minutes} ${t('minutes')}, ${secs} ${t('seconds')}`;
  }

  /** Get duration in hours into human format. */
  durationHours(hours: number): string {
    return sprintf('%0.2f %s', hours, t('hours'));
  }

  /**
   * Get the age of an item in quasi human readable format: <1h, NNh, NNd.
   * `now` defaults to the current unix timestamp.
   */
  age(timestamp: number, now: number | null = null): string {
    const current = now ?? Math.floor(Date.now() / 1000);
    const diff = current - timestamp;

    if (diff < 900) {
      return t('<15m');
    }
    if (diff < 1800) {
      return t('<30m');
    } else if (diff < 3600) {
      return t('<1h');
    } else if (diff < 86400) {
      return '~' + t('%dh', diff / 3600);
    }

    return t('%dd', (current - timestamp) / 86400);
  }

  /** Get all hours for day. */
  getDayHours(): Record<string, string> {
    const values: Record<string, string> = {};

    for (let hour = 0; hour <= 23; hour++) {
      for (const minute of [0, 30]) {
        const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        values[time] = time;
      }
    }

    return values;
  }

  /** Get all days of a week (1 = Monday). */
  getWeekDays(): Record<number, string> {
    const values: Record<number, string> = {};

    for (let day = 1; day <= 7; day++) {
      values[day] = this.getWeekDay(day);
    }

    return values;
  }

  /** Get the (English) day name from the day number (1 = Monday). */
  getWeekDay(day: number): string {
    // PHP: date('l', strtotime('next Monday +N days')): always Monday plus N days.
    return DAY_NAMES[(((day - 1) % 7) + 7) % 7] as string;
  }
}
