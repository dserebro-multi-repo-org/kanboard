/** Minimal PHP `date()` formatter used by the template-facing `dt()` helper. */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number, len = 2): string => String(n).padStart(len, '0');

interface Parts {
  year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number; offsetMin: number;
}

function getParts(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
  const map: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) if (p.type !== 'literal') map[p.type] = Number(p.value);
  const asUtc = Date.UTC(map.year!, map.month! - 1, map.day!, map.hour!, map.minute!, map.second!);
  const offsetMin = Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  return {
    year: map.year!, month: map.month!, day: map.day!, hour: map.hour!, minute: map.minute!, second: map.second!,
    weekday: new Date(Date.UTC(map.year!, map.month! - 1, map.day!)).getUTCDay(), offsetMin,
  };
}

const isLeap = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
const daysInMonth = (y: number, m: number): number => [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]!;

function dayOfYear(p: Parts): number {
  let d = p.day - 1;
  for (let m = 1; m < p.month; m++) d += daysInMonth(p.year, m);
  return d;
}

function isoWeek(p: Parts): { week: number; year: number } {
  const d = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  return { week: Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7), year: d.getUTCFullYear() };
}

function offset(min: number, colon: boolean): string {
  const sign = min < 0 ? '-' : '+';
  const abs = Math.abs(min);
  return `${sign}${pad(Math.floor(abs / 60))}${colon ? ':' : ''}${pad(abs % 60)}`;
}

function suffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  return ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
}

/** Format a unix timestamp (seconds) or Date like PHP `date($format, $timestamp)`. */
export function formatDate(format: string, value: number | Date = new Date(), timeZone = 'UTC'): string {
  const date = value instanceof Date ? value : new Date(value * 1000);
  const p = getParts(date, timeZone);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  let out = '';
  for (let i = 0; i < format.length; i++) {
    const c = format[i]!;
    switch (c) {
      case 'd': out += pad(p.day); break;
      case 'D': out += DAYS[p.weekday]!.slice(0, 3); break;
      case 'j': out += p.day; break;
      case 'l': out += DAYS[p.weekday]; break;
      case 'N': out += p.weekday || 7; break;
      case 'S': out += suffix(p.day); break;
      case 'w': out += p.weekday; break;
      case 'z': out += dayOfYear(p); break;
      case 'W': out += pad(isoWeek(p).week); break;
      case 'F': out += MONTHS[p.month - 1]; break;
      case 'm': out += pad(p.month); break;
      case 'M': out += MONTHS[p.month - 1]!.slice(0, 3); break;
      case 'n': out += p.month; break;
      case 't': out += daysInMonth(p.year, p.month); break;
      case 'L': out += isLeap(p.year) ? 1 : 0; break;
      case 'o': out += isoWeek(p).year; break;
      case 'Y': out += p.year; break;
      case 'y': out += pad(p.year % 100); break;
      case 'a': out += p.hour < 12 ? 'am' : 'pm'; break;
      case 'A': out += p.hour < 12 ? 'AM' : 'PM'; break;
      case 'g': out += h12; break;
      case 'G': out += p.hour; break;
      case 'h': out += pad(h12); break;
      case 'H': out += pad(p.hour); break;
      case 'i': out += pad(p.minute); break;
      case 's': out += pad(p.second); break;
      case 'u': out += '000000'; break;
      case 'v': out += pad(date.getUTCMilliseconds(), 3); break;
      case 'e': out += timeZone; break;
      case 'T': out += p.offsetMin === 0 ? 'UTC' : offset(p.offsetMin, false); break;
      case 'P': out += offset(p.offsetMin, true); break;
      case 'p': out += p.offsetMin === 0 ? 'Z' : offset(p.offsetMin, true); break;
      case 'O': out += offset(p.offsetMin, false); break;
      case 'Z': out += p.offsetMin * 60; break;
      case 'c': out += formatDate('Y-m-d\\TH:i:sP', date, timeZone); break;
      case 'r': out += formatDate('D, d M Y H:i:s O', date, timeZone); break;
      case 'U': out += Math.floor(date.getTime() / 1000); break;
      case '\\': i++; if (i < format.length) out += format[i]; break;
      default: out += c;
    }
  }
  return out;
}
