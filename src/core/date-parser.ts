import { Base } from './container/base.js';
import type { Container } from './container/container.js';
import { createTimestampFromFormat, phpDate, phpMktime } from './php-date.js';

type Values = Record<string, unknown>;

/**
 * Date Parser (port of `app/Core/DateParser.php`).
 *
 * Config-driven formats come from the async `configModel`, so every method that depends on the
 * user format is `async` (the PHP originals were synchronous).
 */
export class DateParser extends Base {
  static readonly DATE_FORMAT = 'm/d/Y';
  static readonly TIME_FORMAT = 'H:i';

  /** Date format from settings. */
  async getUserDateFormat(): Promise<string> {
    return this.service('configModel').get('application_date_format', DateParser.DATE_FORMAT);
  }

  /** Date time format from settings. */
  async getUserDateTimeFormat(): Promise<string> {
    return `${await this.getUserDateFormat()} ${await this.getUserTimeFormat()}`;
  }

  /** Time format from settings. */
  async getUserTimeFormat(): Promise<string> {
    return this.service('configModel').get('application_time_format', DateParser.TIME_FORMAT);
  }

  /** List of time formats. */
  getTimeFormats(): string[] {
    return ['H:i', 'g:i a'];
  }

  /** List of date formats. */
  async getDateFormats(iso = false): Promise<string[]> {
    const isoFormats = ['Y-m-d', 'Y_m_d'];
    const userFormats = ['m/d/Y', 'd/m/Y', 'Y/m/d', 'd.m.Y'];
    const formats = [await this.getUserDateFormat(), ...(iso ? isoFormats : []), ...userFormats];
    return [...new Set(formats)];
  }

  /** List of datetime formats. */
  async getDateTimeFormats(iso = false): Promise<string[]> {
    const formats = [await this.getUserDateTimeFormat()];

    for (const date of await this.getDateFormats(iso)) {
      for (const time of this.getTimeFormats()) {
        formats.push(`${date} ${time}`);
      }
    }

    return [...new Set(formats)];
  }

  /** List of all date formats. */
  async getAllDateFormats(iso = false): Promise<string[]> {
    return [...(await this.getDateFormats(iso)), ...(await this.getDateTimeFormats(iso))];
  }

  /** Available formats (visible in settings). */
  getAvailableFormats(formats: string[]): Record<string, string> {
    const values: Record<string, string> = {};
    for (const format of formats) {
      values[format] = `${phpDate(format)} (${format})`;
    }
    return values;
  }

  /** Formats for date parsing. */
  async getParserFormats(): Promise<string[]> {
    return [
      await this.getUserDateFormat(),
      'Y-m-d',
      'Y_m_d',
      await this.getUserDateTimeFormat(),
      'Y-m-d H:i',
      'Y_m_d H:i',
    ];
  }

  /** Parse a date and return a unix timestamp, trying different date formats. */
  async getTimestamp(value: unknown): Promise<number> {
    if (isDigits(value)) {
      return parseInt(String(value), 10);
    }

    for (const format of await this.getParserFormats()) {
      const timestamp = this.getValidDate(String(value ?? ''), format);

      if (timestamp !== 0) {
        return timestamp;
      }
    }

    return 0;
  }

  /** A timestamp if the given date format is correct, otherwise 0. */
  private getValidDate(value: string, format: string): number {
    const timestamp = createTimestampFromFormat(format, value);
    return timestamp !== null && timestamp > 0 ? timestamp : 0;
  }

  /** True if the date is within the date range. */
  withinDateRange(date: Date, start: Date, end: Date): boolean {
    return date >= start && date <= end;
  }

  /** Total number of hours between 2 dates, rounded to 2 decimals. */
  getHours(d1: Date, d2: Date): number {
    const seconds = Math.abs(Math.floor(d1.getTime() / 1000) - Math.floor(d2.getTime() / 1000));
    return Math.round((seconds / 3600) * 100) / 100;
  }

  /** ISO-8601 date from user input. */
  async getIsoDate(value: unknown): Promise<string> {
    return phpDate('Y-m-d', await this.getTimestamp(value));
  }

  /** Timestamp (without time) from an ISO date format. */
  getTimestampFromIsoFormat(value: unknown): number {
    if (isDigits(value)) {
      return this.removeTimeFromTimestamp(parseInt(String(value), 10));
    }
    const parsed = Date.parse(String(value));
    return this.removeTimeFromTimestamp(Number.isNaN(parsed) ? 0 : Math.floor(parsed / 1000));
  }

  /** Remove the time from a timestamp. */
  removeTimeFromTimestamp(timestamp: number): number {
    const d = new Date(timestamp * 1000);
    return phpMktime(0, 0, 0, d.getMonth() + 1, d.getDate(), d.getFullYear());
  }

  /** Format date (form display). */
  format<T extends Values>(values: T, fields: string[], format: string): T {
    const result: Values = { ...values };
    for (const field of fields) {
      const v = result[field];
      if (v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0' && v !== false) {
        if (isDigits(v)) {
          result[field] = phpDate(format, parseInt(String(v), 10));
        }
      } else {
        result[field] = '';
      }
    }
    return result as T;
  }

  /** Convert date to timestamp. */
  async convert<T extends Values>(values: T, fields: string[], keepTime = false): Promise<T> {
    const result: Values = { ...values };
    for (const field of fields) {
      const v = result[field];
      if (v !== undefined && v !== null && v !== '' && v !== 0 && v !== '0' && v !== false) {
        const timestamp = await this.getTimestamp(v);
        result[field] = keepTime ? timestamp : this.removeTimeFromTimestamp(timestamp);
      }
    }
    return result as T;
  }
}

/** PHP `ctype_digit((string) $value)`. */
function isDigits(value: unknown): boolean {
  return /^[0-9]+$/.test(String(value ?? ''));
}

declare module './container/container.js' {
  interface ServiceRegistry {
    dateParser: DateParser;
  }
}

/** The `dateParser` service, or a fresh instance when the provider is not registered yet. */
export function getDateParser(container: Container): DateParser {
  return container.has('dateParser') ? container.get('dateParser') : new DateParser(container);
}
