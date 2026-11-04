import { phpUrlEncode } from '../core/http/route.js';

/** Small PHP compatibility helpers shared by the template helpers (output must stay byte-identical to PHP). */

export type Values = Readonly<Record<string, unknown>>;

/** PHP `(string) $value` for scalars. */
export function toPhpString(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (value === true) return '1';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : value > 0 ? 'INF' : value < 0 ? '-INF' : 'NAN';
  if (Array.isArray(value)) return 'Array';
  return String(value);
}

/** PHP `isset()` of an array/object entry: present and not null. */
export function isSet(values: unknown, key: string | number): boolean {
  if (values === null || typeof values !== 'object') return false;
  const entry = (values as Record<string | number, unknown>)[key];
  return entry !== undefined && entry !== null;
}

/** PHP `empty()`. */
export function phpEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === '' || value === '0') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

/** PHP truthiness (`if ($value)`). */
export function phpTruthy(value: unknown): boolean {
  return !phpEmpty(value);
}

/** PHP `is_numeric`. */
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return true;
  return typeof value === 'string' && /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/.test(value);
}

/** PHP 8 loose comparison (`==`) for scalars. */
export function looseEquals(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) a = '';
  if (b === null || b === undefined) b = '';
  if (typeof a === 'boolean' || typeof b === 'boolean') return phpTruthy(a) === phpTruthy(b);
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (typeof a === 'string' && typeof b === 'string') {
    if (isNumeric(a) && isNumeric(b)) return Number(a) === Number(b);
    return a === b;
  }
  const [num, str] = typeof a === 'number' ? [a, String(b)] : [b as number, String(a)];
  if (isNumeric(str)) return Number(str) === num;
  return String(num) === str;
}

/** PHP `in_array($needle, $haystack)` (loose). */
export function inArray(needle: unknown, haystack: unknown): boolean {
  const list = Array.isArray(haystack) ? haystack : typeof haystack === 'object' && haystack !== null ? Object.values(haystack) : [];
  return list.some((item) => looseEquals(item, needle));
}

/** PHP `(int) $value`. */
export function toInt(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const match = /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?/.exec(value);
    return match === null ? 0 : Math.trunc(Number(match[0].trim()));
  }
  if (Array.isArray(value)) return value.length > 0 ? 1 : 0;
  return 0;
}

/** PHP `round()` (half away from zero, with pre-rounding like PHP < 8.4). */
export function phpRound(value: number, precision = 0): number {
  const factor = 10 ** precision;
  const scaled = Number((Math.abs(value) * factor).toPrecision(15));
  const rounded = Math.floor(scaled + 0.5) / factor;
  return value < 0 ? -rounded : rounded;
}

/** HTML 4.01 named entities (the table `htmlspecialchars(..., double_encode=false)` validates against). */
const HTML401_ENTITIES = new Set(
  (
    'quot amp lt gt nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 ' +
    'acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig ' +
    'Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave ' +
    'Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave ' +
    'iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml ' +
    'OElig oelig Scaron scaron Yuml fnof circ tilde Alpha Beta Gamma Delta Epsilon Zeta Eta Theta Iota Kappa Lambda Mu Nu Xi ' +
    'Omicron Pi Rho Sigma Tau Upsilon Phi Chi Psi Omega alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu ' +
    'xi omicron pi rho sigmaf sigma tau upsilon phi chi psi omega thetasym upsih piv ensp emsp thinsp zwnj zwj lrm rlm ndash ' +
    'mdash lsquo rsquo sbquo ldquo rdquo bdquo dagger Dagger bull hellip permil prime Prime lsaquo rsaquo oline frasl euro ' +
    'image weierp real trade alefsym larr uarr rarr darr harr crarr lArr uArr rArr dArr hArr forall part exist empty nabla ' +
    'isin notin ni prod sum minus lowast radic prop infin ang and or cap cup int there4 sim cong asymp ne equiv le ge sub sup ' +
    'nsub sube supe oplus otimes perp sdot lceil rceil lfloor rfloor lang rang loz spades clubs hearts diams'
  ).split(' '),
);

const ENTITY_AT_START = /^&(?:([a-zA-Z][a-zA-Z0-9]*)|#([0-9]+)|#[xX]([0-9a-fA-F]+));/;

/**
 * PHP `htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8', $doubleEncode)`.
 * With `doubleEncode = false` valid existing entities (HTML 4.01 names, numeric) are kept.
 */
export function htmlspecialchars(value: unknown, doubleEncode = true): string {
  const input = toPhpString(value);
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input[i] as string;
    switch (ch) {
      case '&': {
        if (!doubleEncode) {
          const match = ENTITY_AT_START.exec(input.slice(i, i + 40));
          if (match !== null) {
            const valid =
              match[1] !== undefined
                ? HTML401_ENTITIES.has(match[1])
                : Number.parseInt(match[2] ?? match[3] ?? '', match[2] !== undefined ? 10 : 16) <= 0x10ffff;
            if (valid) {
              out += match[0];
              i += match[0].length - 1;
              break;
            }
          }
        }
        out += '&amp;';
        break;
      }
      case '<':
        out += '&lt;';
        break;
      case '>':
        out += '&gt;';
        break;
      case '"':
        out += '&quot;';
        break;
      case "'":
        out += '&#039;';
        break;
      default:
        out += ch;
    }
  }
  return out;
}

/** PHP `http_build_query($data, '', $separator)` (RFC 1738 encoding, nulls skipped, booleans as 1/0). */
export function httpBuildQuery(data: Values, separator = '&'): string {
  const parts: string[] = [];

  const add = (prefix: string, value: unknown): void => {
    if (value === null || value === undefined) return;
    if (typeof value === 'object') {
      const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
      for (const [key, item] of entries) add(`${prefix}%5B${phpUrlEncode(key)}%5D`, item);
      return;
    }
    const scalar = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
    parts.push(`${prefix}=${phpUrlEncode(scalar)}`);
  };

  for (const [key, value] of Object.entries(data)) add(phpUrlEncode(key), value);
  return parts.join(separator);
}

function jsonString(value: string, hexApos: boolean): string {
  let out = '"';
  for (let i = 0; i < value.length; i++) {
    const ch = value[i] as string;
    const code = value.charCodeAt(i);
    if (ch === '"') out += '\\"';
    else if (ch === '\\') out += '\\\\';
    else if (ch === '/') out += '\\/';
    else if (ch === '\b') out += '\\b';
    else if (ch === '\f') out += '\\f';
    else if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (ch === "'" && hexApos) out += '\\u0027';
    else if (code < 0x20 || code > 0x7e) out += `\\u${code.toString(16).padStart(4, '0')}`;
    else out += ch;
  }
  return `${out}"`;
}

/**
 * PHP `json_encode($value, $hexApos ? JSON_HEX_APOS : 0)`: escapes `/`, non ASCII characters as `\uXXXX`
 * and encodes empty arrays/objects as `[]` (an empty PHP array is always a list).
 */
export function jsonEncode(value: unknown, hexApos = false): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '0';
  if (typeof value === 'string') return jsonString(value, hexApos);
  // Nunjucks safe strings (`t()` results in views) are String objects: encode them like PHP strings.
  if (value instanceof String) return jsonString(String(value), hexApos);
  if (Array.isArray(value)) return `[${value.map((item) => jsonEncode(item, hexApos)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return '[]';
  return `{${entries.map(([key, item]) => `${jsonString(key, hexApos)}:${jsonEncode(item, hexApos)}`).join(',')}}`;
}

/** `get_file_extension()` of `app/functions.php`: lower-cased `pathinfo()` extension. */
export function getFileExtension(filename: string): string {
  const base = filename.replace(/\/+$/, '').split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot === -1 ? '' : base.slice(dot + 1).toLowerCase();
}
