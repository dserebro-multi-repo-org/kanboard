/**
 * PHP-compatible `sprintf()`. Supports argnum (`%1$s`), flags (`-`, `+`, `0`, space, `'c` custom padding),
 * width, precision and the specifiers `% b c d e E f F g G o s u x X`.
 * Like PHP 8 it throws when there are too few arguments or the specifier is unknown.
 */

const FORMAT = /%(?:(\d+)\$)?((?:[-+ 0]|'[\s\S])*)(\d+)?(?:\.(\d+))?([a-zA-Z%])/g;

function phpString(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (value === true) return '1';
  return String(value);
}

function phpInt(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : 0;
  if (value === null || value === undefined || value === false) return 0;
  if (value === true) return 1;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function phpFloat(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined || value === false) return 0;
  if (value === true) return 1;
  const parsed = parseFloat(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Round half away from zero like PHP and return a fixed notation string. */
export function toFixedPhp(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return value > 0 ? 'inf' : value < 0 ? '-inf' : 'nan';
  const negative = value < 0;
  const abs = Math.abs(value);
  let rounded: number;
  if (abs >= 1e21 || String(abs).includes('e')) {
    rounded = abs;
  } else {
    rounded = Number(`${Math.round(Number(`${abs}e${decimals}`))}e-${decimals}`);
  }
  const str = rounded.toFixed(decimals);
  return negative && Number(str) !== 0 ? `-${str}` : str;
}

export function sprintf(format: string, ...args: unknown[]): string {
  let next = 0;
  return format.replace(FORMAT, (_m, argnum: string | undefined, flags: string, width: string | undefined, precision: string | undefined, spec: string) => {
    if (spec === '%') return '%';

    let index: number;
    if (argnum !== undefined) {
      if (Number(argnum) === 0) throw new RangeError('Argument number specifier must be greater than zero');
      index = Number(argnum) - 1;
    } else {
      index = next++;
    }
    if (index >= args.length) {
      throw new TypeError(`${args.length + 1} arguments are required, ${index + 2} given`);
    }
    const arg = args[index];

    let left = false;
    let plus = false;
    let pad = ' ';
    for (let i = 0; i < flags.length; i++) {
      const f = flags[i];
      if (f === '-') left = true;
      else if (f === '+') plus = true;
      else if (f === '0') pad = '0';
      else if (f === ' ') pad = ' ';
      else if (f === "'") pad = flags[++i] ?? ' ';
    }
    const prec = precision === undefined ? undefined : Number(precision);

    let out: string;
    let numeric = true;
    switch (spec) {
      case 's':
        numeric = false;
        out = phpString(arg);
        if (prec !== undefined) out = out.slice(0, prec);
        break;
      case 'd':
      case 'i': {
        const n = phpInt(arg);
        out = (plus && n >= 0 ? '+' : '') + String(n);
        break;
      }
      case 'u': {
        const n = phpInt(arg);
        out = n < 0 ? (BigInt.asUintN(64, BigInt(n))).toString() : String(n);
        break;
      }
      case 'f':
      case 'F': {
        const n = phpFloat(arg);
        out = (plus && n >= 0 ? '+' : '') + toFixedPhp(n, prec ?? 6);
        break;
      }
      case 'e':
      case 'E': {
        const n = phpFloat(arg);
        const [mant, exp] = n.toExponential(prec ?? 6).split('e') as [string, string];
        out = `${plus && n >= 0 ? '+' : ''}${mant}e${exp[0]}${exp.slice(1)}`;
        if (spec === 'E') out = out.toUpperCase();
        break;
      }
      case 'g':
      case 'G': {
        const n = phpFloat(arg);
        const p = prec === undefined ? 6 : prec === 0 ? 1 : prec;
        out = String(Number(n.toPrecision(p)));
        if (spec === 'G') out = out.toUpperCase();
        if (plus && n >= 0) out = `+${out}`;
        break;
      }
      case 'x':
      case 'X':
      case 'o':
      case 'b': {
        const n = phpInt(arg);
        const radix = spec === 'o' ? 8 : spec === 'b' ? 2 : 16;
        out = (n < 0 ? BigInt.asUintN(64, BigInt(n)) : BigInt(n)).toString(radix);
        if (spec === 'X') out = out.toUpperCase();
        break;
      }
      case 'c':
        return String.fromCharCode(phpInt(arg) & 0xff);
      default:
        throw new RangeError(`Unknown format specifier "${spec}"`);
    }

    const w = width === undefined ? 0 : Number(width);
    if (out.length >= w) return out;
    const fill = pad.repeat(w - out.length);
    if (left) return out + (pad === '0' && numeric ? ' '.repeat(w - out.length) : fill);
    if (pad === '0' && numeric && /^[+-]/.test(out)) return out[0] + fill + out.slice(1);
    return fill + out;
  });
}
