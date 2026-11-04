/**
 * Minimal re-implementation of PHP `date()` and `DateTime::createFromFormat()` (local time zone),
 * covering the format characters used by Kanboard. Timestamps are unix seconds.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December',
];

const pad = (n: number, len = 2): string => String(n).padStart(len, '0');

function isoWeek(d: Date): { week: number; year: number } {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return { week: Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7), year: t.getUTCFullYear() };
}

function offsetString(d: Date, colon: boolean): string {
  const off = -d.getTimezoneOffset();
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  return `${sign}${pad(Math.floor(abs / 60))}${colon ? ':' : ''}${pad(abs % 60)}`;
}

/** PHP `date($format, $timestamp)`. Timestamp defaults to now. */
export function phpDate(format: string, timestamp: number = Math.floor(Date.now() / 1000)): string {
  const d = new Date(timestamp * 1000);
  let out = '';
  for (let i = 0; i < format.length; i++) {
    const c = format[i] as string;
    const h = d.getHours();
    switch (c) {
      case 'd': out += pad(d.getDate()); break;
      case 'D': out += DAYS[d.getDay()]!.slice(0, 3); break;
      case 'j': out += d.getDate(); break;
      case 'l': out += DAYS[d.getDay()]; break;
      case 'N': out += d.getDay() || 7; break;
      case 'S': {
        const day = d.getDate();
        out += day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
        break;
      }
      case 'w': out += d.getDay(); break;
      case 'z': out += Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 1)) / 86400000); break;
      case 'W': out += pad(isoWeek(d).week); break;
      case 'F': out += MONTHS[d.getMonth()]; break;
      case 'm': out += pad(d.getMonth() + 1); break;
      case 'M': out += MONTHS[d.getMonth()]!.slice(0, 3); break;
      case 'n': out += d.getMonth() + 1; break;
      case 't': out += new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); break;
      case 'L': out += new Date(d.getFullYear(), 1, 29).getMonth() === 1 ? '1' : '0'; break;
      case 'o': out += isoWeek(d).year; break;
      case 'Y': out += d.getFullYear(); break;
      case 'y': out += pad(d.getFullYear() % 100); break;
      case 'a': out += h < 12 ? 'am' : 'pm'; break;
      case 'A': out += h < 12 ? 'AM' : 'PM'; break;
      case 'g': out += h % 12 === 0 ? 12 : h % 12; break;
      case 'G': out += h; break;
      case 'h': out += pad(h % 12 === 0 ? 12 : h % 12); break;
      case 'H': out += pad(h); break;
      case 'i': out += pad(d.getMinutes()); break;
      case 's': out += pad(d.getSeconds()); break;
      case 'u': out += '000000'; break;
      case 'v': out += '000'; break;
      case 'e': out += Intl.DateTimeFormat().resolvedOptions().timeZone; break;
      case 'I': out += new Date(d.getFullYear(), 0, 1).getTimezoneOffset() !== d.getTimezoneOffset() ? '1' : '0'; break;
      case 'O': out += offsetString(d, false); break;
      case 'P': out += offsetString(d, true); break;
      case 'T': out += offsetString(d, true); break;
      case 'Z': out += -d.getTimezoneOffset() * 60; break;
      case 'U': out += timestamp; break;
      case '\\': i++; if (i < format.length) out += format[i]; break;
      default: out += c;
    }
  }
  return out;
}

/** PHP `mktime($h, $i, $s, $m, $d, $y)` in local time. */
export function phpMktime(hour: number, minute: number, second: number, month: number, day: number, year: number): number {
  return Math.floor(new Date(year, month - 1, day, hour, minute, second).getTime() / 1000);
}

/**
 * PHP `DateTime::createFromFormat()` followed by the "no errors and no warnings" check done by
 * Kanboard: returns the unix timestamp, or `null` when the value does not match the format strictly.
 */
export function createTimestampFromFormat(format: string, value: string): number | null {
  const now = new Date();
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let hour: number | null = null;
  let minute: number | null = null;
  let second: number | null = null;
  let meridian: 'am' | 'pm' | null = null;
  let hour12 = false;
  let unix: number | null = null;
  let reset = false;

  let pos = 0;
  const num = (min: number, max: number): number | null => {
    let end = pos;
    while (end < value.length && end - pos < max && /[0-9]/.test(value[end] as string)) end++;
    if (end - pos < min) return null;
    const n = parseInt(value.slice(pos, end), 10);
    pos = end;
    return n;
  };
  const name = (list: string[], short: boolean): number | null => {
    const rest = value.slice(pos).toLowerCase();
    for (let idx = 0; idx < list.length; idx++) {
      const full = list[idx]!.toLowerCase();
      const cand = short ? full.slice(0, 3) : full;
      if (rest.startsWith(cand)) {
        pos += cand.length;
        return idx;
      }
    }
    return null;
  };

  for (let i = 0; i < format.length; i++) {
    const c = format[i] as string;
    let n: number | null;
    switch (c) {
      case 'd': case 'j': n = num(c === 'd' ? 2 : 1, 2); if (n === null) return null; day = n; break;
      case 'm': case 'n': n = num(c === 'm' ? 2 : 1, 2); if (n === null) return null; month = n; break;
      case 'Y': n = num(4, 4); if (n === null) return null; year = n; break;
      case 'y': n = num(2, 2); if (n === null) return null; year = n < 70 ? 2000 + n : 1900 + n; break;
      case 'H': case 'G': n = num(c === 'H' ? 2 : 1, 2); if (n === null) return null; hour = n; hour12 = false; break;
      case 'h': case 'g': n = num(c === 'h' ? 2 : 1, 2); if (n === null) return null; hour = n; hour12 = true; break;
      case 'i': n = num(2, 2); if (n === null) return null; minute = n; break;
      case 's': n = num(2, 2); if (n === null) return null; second = n; break;
      case 'a': case 'A': {
        const m = value.slice(pos, pos + 2).toLowerCase();
        if (m !== 'am' && m !== 'pm') return null;
        meridian = m;
        pos += 2;
        break;
      }
      case 'M': n = name(MONTHS, true); if (n === null) return null; month = n + 1; break;
      case 'F': n = name(MONTHS, false); if (n === null) return null; month = n + 1; break;
      case 'D': if (name(DAYS, true) === null) return null; break;
      case 'l': if (name(DAYS, false) === null) return null; break;
      case 'U': {
        const m = /^-?\d+/.exec(value.slice(pos));
        if (!m) return null;
        unix = parseInt(m[0], 10);
        pos += m[0].length;
        break;
      }
      case 'u': case 'v': {
        const m = /^\d{1,6}/.exec(value.slice(pos));
        if (!m) return null;
        pos += m[0].length;
        break;
      }
      case '!': case '|':
        reset = true;
        break;
      case '?': pos++; break;
      case '*': while (pos < value.length && !/[\s,;:/.\-()]/.test(value[pos] as string)) pos++; break;
      case '+': pos = value.length; break;
      case '\\': i++; if (value[pos] !== format[i]) return null; pos++; break;
      default:
        if (value[pos] !== c) return null;
        pos++;
    }
  }
  if (pos < value.length) return null; // trailing data

  if (unix !== null) return unix;

  if (hour12 && hour !== null) {
    if (hour < 1 || hour > 12) return null;
    hour = hour % 12;
    if (meridian === 'pm') hour += 12;
  } else if (meridian !== null && hour === null) {
    return null;
  }

  const anyTime = hour !== null || minute !== null || second !== null;
  const defaults = (v: number | null, current: number, zero: number): number => (v !== null ? v : reset || anyTime ? zero : current);
  const y = year ?? (reset ? 1970 : now.getFullYear());
  const mo = month ?? (reset ? 1 : now.getMonth() + 1);
  const d = day ?? (reset ? 1 : now.getDate());
  const h = defaults(hour, now.getHours(), 0);
  const mi = defaults(minute, now.getMinutes(), 0);
  const s = defaults(second, now.getSeconds(), 0);

  if (mo < 1 || mo > 12 || d < 1 || d > new Date(y, mo, 0).getDate() || h > 23 || mi > 59 || s > 59) return null;

  return Math.floor(new Date(y, mo - 1, d, h, mi, s).getTime() / 1000);
}
