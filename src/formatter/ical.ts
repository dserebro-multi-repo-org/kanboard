import { phpDate } from '../core/php-date.js';

/**
 * Minimal iCalendar (RFC 5545) writer covering what `TaskICalFormatter` needs from the PHP library
 * `eluceo/ical` (Calendar, Event, Attendees, Organizer). Dates are unix timestamps.
 */

const CRLF = '\r\n';

/** Escape a TEXT value. */
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold a content line to 75 octets. */
function fold(line: string): string {
  const chunks: string[] = [];
  let current = '';
  let size = 0;

  for (const char of line) {
    const bytes = Buffer.byteLength(char);
    const max = chunks.length === 0 ? 75 : 74;
    if (size + bytes > max) {
      chunks.push(current);
      current = '';
      size = 0;
    }
    current += char;
    size += bytes;
  }

  chunks.push(current);
  return chunks.join(`${CRLF} `);
}

function quoteParam(value: string): string {
  return /[;:,]/.test(value) ? `"${value.replace(/"/g, "'")}"` : value;
}

function formatParams(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => `;${key}=${quoteParam(value)}`)
    .join('');
}

/** Event attendees. */
export class Attendees {
  readonly attendees: Array<{ email: string; params: Record<string, string> }> = [];

  add(email: string, params: Record<string, string> = {}): this {
    this.attendees.push({ email, params });
    return this;
  }

  toLines(): string[] {
    return this.attendees.map(({ email, params }) => `ATTENDEE${formatParams(params)}:${email}`);
  }
}

/** Event organizer. */
export class Organizer {
  constructor(
    readonly email: string,
    readonly params: Record<string, string> = {},
  ) {}

  toLine(): string {
    return `ORGANIZER${formatParams(this.params)}:${this.email}`;
  }
}

/** A calendar event (`VEVENT`). */
export class Event {
  private dtStart: number | null = null;
  private dtEnd: number | null = null;
  private created: number | null = null;
  private modified: number | null = null;
  private summary = '';
  private description = '';
  private descriptionHtml = '';
  private url = '';
  private noTime = false;
  private useTimezone = false;
  private attendees: Attendees | null = null;
  private organizer: Organizer | null = null;

  constructor(readonly uniqueId: string) {}

  setDtStart(timestamp: number): this {
    this.dtStart = timestamp;
    return this;
  }

  setDtEnd(timestamp: number): this {
    this.dtEnd = timestamp;
    return this;
  }

  setCreated(timestamp: number): this {
    this.created = timestamp;
    return this;
  }

  setModified(timestamp: number): this {
    this.modified = timestamp;
    return this;
  }

  setUseTimezone(useTimezone: boolean): this {
    this.useTimezone = useTimezone;
    return this;
  }

  setNoTime(noTime: boolean): this {
    this.noTime = noTime;
    return this;
  }

  setSummary(summary: string): this {
    this.summary = summary;
    return this;
  }

  setDescription(description: string): this {
    this.description = description;
    return this;
  }

  setDescriptionHTML(html: string): this {
    this.descriptionHtml = html;
    return this;
  }

  setUrl(url: string): this {
    this.url = url;
    return this;
  }

  setAttendees(attendees: Attendees): this {
    this.attendees = attendees;
    return this;
  }

  setOrganizer(organizer: Organizer): this {
    this.organizer = organizer;
    return this;
  }

  getSummary(): string {
    return this.summary;
  }

  private dateLine(name: string, timestamp: number): string {
    if (this.noTime) {
      return `${name};VALUE=DATE:${phpDate('Ymd', timestamp)}`;
    }
    if (this.useTimezone) {
      return `${name};TZID=${Intl.DateTimeFormat().resolvedOptions().timeZone}:${phpDate('Ymd\\THis', timestamp)}`;
    }
    return `${name}:${utc(timestamp)}`;
  }

  toLines(): string[] {
    const lines = ['BEGIN:VEVENT', `UID:${this.uniqueId}`, `DTSTAMP:${utc(Math.floor(Date.now() / 1000))}`];

    if (this.dtStart !== null) lines.push(this.dateLine('DTSTART', this.dtStart));
    if (this.dtEnd !== null) lines.push(this.dateLine('DTEND', this.dtEnd));
    if (this.created !== null) lines.push(`CREATED:${utc(this.created)}`);
    if (this.modified !== null) lines.push(`LAST-MODIFIED:${utc(this.modified)}`);
    lines.push(`SUMMARY:${escapeText(this.summary)}`);
    if (this.description !== '') lines.push(`DESCRIPTION:${escapeText(this.description)}`);
    if (this.descriptionHtml !== '') {
      lines.push(`X-ALT-DESC;FMTTYPE=text/html:${escapeText(this.descriptionHtml)}`);
    }
    if (this.url !== '') lines.push(`URL:${this.url}`);
    if (this.attendees !== null) lines.push(...this.attendees.toLines());
    if (this.organizer !== null) lines.push(this.organizer.toLine());
    lines.push('END:VEVENT');

    return lines;
  }
}

/** UTC date-time `YYYYMMDDTHHMMSSZ`. */
function utc(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/** The calendar (`VCALENDAR`). */
export class Calendar {
  private readonly components: Event[] = [];

  constructor(readonly prodId = '-//Kanboard//Kanboard//EN') {}

  addComponent(event: Event): this {
    this.components.push(event);
    return this;
  }

  getComponents(): Event[] {
    return [...this.components];
  }

  render(): string {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:${this.prodId}`,
      'X-PUBLISHED-TTL:PT1H',
      'CALSCALE:GREGORIAN',
      ...this.components.flatMap((event) => event.toLines()),
      'END:VCALENDAR',
    ];

    return lines.map(fold).join(CRLF) + CRLF;
  }
}
