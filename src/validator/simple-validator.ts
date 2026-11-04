/**
 * Hand-port of the `SimpleValidator` library (`libs/SimpleValidator`) used by every Kanboard
 * validator. Rules keep the PHP constructor argument order and semantics (including the PHP
 * loose comparisons) and the validator returns the very same error structure:
 * `{ field: [message, ...] }`.
 *
 * Rules that touch the database (`Unique`, `Exists`) and rules provided by callbacks are
 * asynchronous, so {@link Validator.execute} is asynchronous too.
 */

import { isNumeric } from '../helper/php.js';

export type Values = Record<string, unknown>;
export type ValidationErrors = Record<string, string[]>;
/** `[valid, errors]` tuple returned by every validator method (PHP `array($valid, $errors)`). */
export type ValidationResult<E = ValidationErrors> = [boolean, E];

export type MaybePromise<T> = T | Promise<T>;

/** Minimal query surface needed by the `Unique` / `Exists` rules (satisfied by `db.table(...)`). */
export interface ValidatorTable {
  eq(column: string, value: string | number | null): ValidatorTable;
  neq(column: string, value: string | number | null): ValidatorTable;
  exists(): Promise<boolean>;
}

/** Minimal database surface needed by the validators (satisfied by `Database`). */
export interface ValidatorDatabase {
  table(name: string): ValidatorTable;
}

export abstract class Rule {
  constructor(
    protected readonly field: string,
    protected readonly errorMessage: string,
  ) {}

  abstract execute(data: Values): MaybePromise<boolean>;

  getErrorMessage(): string {
    return this.errorMessage;
  }

  getField(): string {
    return this.field;
  }

  protected isFieldNotEmpty(data: Values, field: string = this.field): boolean {
    return hasValue(data, field);
  }
}

function hasValue(data: Values, field: string): boolean {
  if (!Object.prototype.hasOwnProperty.call(data, field)) {
    return false;
  }
  const value = data[field];
  return value !== undefined && value !== null && value !== '';
}

/** PHP 8 loose comparison `$a <=> $b` for scalars. */
function looseCompare(a: unknown, b: unknown): number {
  const left = typeof a === 'boolean' ? Number(a) : a;
  const right = typeof b === 'boolean' ? Number(b) : b;
  if ((typeof left === 'number' || isNumeric(left)) && (typeof right === 'number' || isNumeric(right))) {
    const diff = Number(left) - Number(right);
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }
  const l = String(left);
  const r = String(right);
  return l < r ? -1 : l > r ? 1 : 0;
}

/** PHP 8 loose equality `==` for scalars (used by `in_array` without strict mode). */
export function looseEquals(a: unknown, b: unknown): boolean {
  if (a === null || a === undefined) {
    return b === null || b === undefined || b === '' || b === false || b === 0;
  }
  if (b === null || b === undefined) {
    return looseEquals(b, a);
  }
  if (typeof a === 'boolean' || typeof b === 'boolean') {
    const toBool = (v: unknown): boolean => (typeof v === 'string' ? v !== '' && v !== '0' : Boolean(v));
    return toBool(a) === toBool(b);
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return isNumeric(a) && isNumeric(b) ? Number(a) === Number(b) : a === b;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b;
  }
  const [num, other] = typeof a === 'number' ? [a, b] : [b, a];
  if (typeof num === 'number' && typeof other === 'string') {
    return isNumeric(other) ? Number(other) === num : String(num) === other;
  }
  return false;
}

const inArray = (needle: unknown, haystack: readonly unknown[]): boolean => haystack.some((item) => looseEquals(needle, item));

const strLen = (value: unknown): number => [...String(value)].length;

export class Alpha extends Rule {
  execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || /^[A-Za-z]+$/.test(String(data[this.field]));
  }
}

export class AlphaNumeric extends Rule {
  execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || /^[A-Za-z0-9]+$/.test(String(data[this.field]));
  }
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Strict port of PHP `DateTime::createFromFormat` (no errors, no warnings). Returns the UTC
 * timestamp in seconds or `null` when the value does not match the format. Supports the
 * formats used by Kanboard (d j m n Y y H G h g i s A a M F D l U, escapes and separators).
 */
export function parseDateFormat(value: string, format: string): number | null {
  let pos = 0;
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let hour: number | null = null;
  let minute: number | null = null;
  let second: number | null = null;
  let meridian: 'am' | 'pm' | null = null;
  let stamp: number | null = null;
  let reset = false;

  const digits = (min: number, max: number): number | null => {
    let end = pos;
    while (end < value.length && end - pos < max && value[end] >= '0' && value[end] <= '9') {
      end++;
    }
    if (end - pos < min) {
      return null;
    }
    const n = Number(value.slice(pos, end));
    pos = end;
    return n;
  };
  const word = (names: readonly string[], short: boolean): number | null => {
    const rest = value.slice(pos).toLowerCase();
    for (let i = 0; i < names.length; i++) {
      const candidate = short ? names[i].slice(0, 3) : names[i];
      if (rest.startsWith(candidate)) {
        pos += candidate.length;
        return i;
      }
    }
    return null;
  };

  for (let f = 0; f < format.length; f++) {
    const c = format[f];
    let n: number | null;
    switch (c) {
      case 'd':
      case 'j':
        if ((n = digits(1, 2)) === null) return null;
        day = n;
        break;
      case 'm':
      case 'n':
        if ((n = digits(1, 2)) === null) return null;
        month = n;
        break;
      case 'M':
      case 'F':
        if ((n = word(MONTHS, c === 'M')) === null) return null;
        month = n + 1;
        break;
      case 'D':
      case 'l':
        if (word(DAYS, c === 'D') === null) return null;
        break;
      case 'Y':
        if ((n = digits(4, 4)) === null) return null;
        year = n;
        break;
      case 'y':
        if ((n = digits(2, 2)) === null) return null;
        year = n < 70 ? 2000 + n : 1900 + n;
        break;
      case 'H':
      case 'G':
        if ((n = digits(1, 2)) === null) return null;
        hour = n;
        break;
      case 'h':
      case 'g':
        if ((n = digits(1, 2)) === null || n > 12 || n < 1) return null;
        hour = n;
        break;
      case 'i':
        if ((n = digits(2, 2)) === null) return null;
        minute = n;
        break;
      case 's':
        if ((n = digits(2, 2)) === null) return null;
        second = n;
        break;
      case 'a':
      case 'A': {
        const m = value.slice(pos, pos + 2).toLowerCase();
        if (m !== 'am' && m !== 'pm') return null;
        meridian = m;
        pos += 2;
        break;
      }
      case 'U': {
        const m = /^-?\d+/.exec(value.slice(pos));
        if (!m) return null;
        stamp = Number(m[0]);
        pos += m[0].length;
        break;
      }
      case '!':
      case '|':
        reset = true;
        break;
      case '\\':
        f++;
        if (value[pos] !== format[f]) return null;
        pos++;
        break;
      case '?':
        if (pos >= value.length) return null;
        pos++;
        break;
      case '*': {
        while (pos < value.length && !/[\s,;:/.\-()]/.test(value[pos])) pos++;
        break;
      }
      default:
        if (value[pos] !== c) return null;
        pos++;
    }
  }

  if (pos !== value.length) {
    return null;
  }
  if (stamp !== null) {
    return stamp;
  }
  if (meridian !== null && hour !== null) {
    hour = (hour % 12) + (meridian === 'pm' ? 12 : 0);
  }

  const now = new Date();
  const timeParsed = hour !== null || minute !== null || second !== null;
  const y = year ?? (reset ? 1970 : now.getUTCFullYear());
  const mo = month ?? (reset ? 1 : now.getUTCMonth() + 1);
  const d = day ?? (reset ? 1 : now.getUTCDate());
  const h = hour ?? (timeParsed || reset ? 0 : now.getUTCHours());
  const mi = minute ?? (timeParsed || reset ? 0 : now.getUTCMinutes());
  const s = second ?? (timeParsed || reset ? 0 : now.getUTCSeconds());

  // PHP flags overflowing values ("The parsed date/time was invalid") as warnings.
  if (mo < 1 || mo > 12 || h > 23 || mi > 59 || s > 59 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) {
    return null;
  }
  const date = new Date(0);
  date.setUTCFullYear(y, mo - 1, d);
  date.setUTCHours(h, mi, s, 0);
  return Math.floor(date.getTime() / 1000);
}

export class DateRule extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly formats: readonly string[],
  ) {
    super(field, errorMessage);
  }

  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    return this.formats.some((format) => this.isValidDate(data[this.field], format));
  }

  isValidDate(value: unknown, format: string): boolean {
    const timestamp = parseDateFormat(String(value), format);
    return timestamp !== null && timestamp > 0;
  }
}

export class Email extends Rule {
  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    // Same validation method as Firefox (see the PHP source).
    const value = String(data[this.field]);
    const length = value.length;
    const alnum = (c: string): boolean => /^[A-Za-z0-9]$/.test(c);

    if (value[0] === '@' || value[length - 1] === '.') {
      return false;
    }

    let i = 0;
    for (; i < length && value[i] !== '@'; ++i) {
      const c = value[i];
      if (!(alnum(c) || ".!#$%&'*+-/=?^_`{|}~".includes(c))) {
        return false;
      }
    }

    // No domain name (or a one-character long one).
    if (++i >= length) return false;
    if (i + 1 === length) return false;
    // The domain name can't begin with a dot.
    if (value[i] === '.') return false;

    for (; i < length; ++i) {
      const c = value[i];
      if (c === '.') {
        if (value[i - 1] === '.') return false;
      } else if (!(alnum(c) || c === '-')) {
        return false;
      }
    }
    return true;
  }
}

export class Equals extends Rule {
  constructor(
    field1: string,
    protected readonly field2: string,
    errorMessage: string,
  ) {
    super(field1, errorMessage);
  }

  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    if (data[this.field2] === undefined || data[this.field2] === null) {
      return false;
    }
    return data[this.field] === data[this.field2];
  }
}

export class NotEquals extends Rule {
  constructor(
    field1: string,
    protected readonly field2: string,
    errorMessage: string,
  ) {
    super(field1, errorMessage);
  }

  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    if (data[this.field2] === undefined || data[this.field2] === null) {
      return true;
    }
    return data[this.field] !== data[this.field2];
  }
}

/** `Exists`: the value must be present in `table.key` (default key: the field itself). */
export class Exists extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly db: ValidatorDatabase,
    private readonly table: string,
    private key = '',
  ) {
    super(field, errorMessage);
  }

  async execute(data: Values): Promise<boolean> {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    if (this.key === '') {
      this.key = this.field;
    }
    return this.db.table(this.table).eq(this.key, data[this.field] as string | number).exists();
  }
}

/** `Unique`: no other row (different primary key) may hold the same value. */
export class Unique extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly db: ValidatorDatabase,
    private readonly table: string,
    private readonly primaryKey = 'id',
  ) {
    super(field, errorMessage);
  }

  async execute(data: Values): Promise<boolean> {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    let query = this.db.table(this.table).eq(this.field, data[this.field] as string | number);
    const pk = data[this.primaryKey];
    if (pk !== undefined && pk !== null) {
      query = query.neq(this.primaryKey, pk as string | number);
    }
    return !(await query.exists());
  }
}

export class GreaterThan extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly min: number,
  ) {
    super(field, errorMessage);
  }

  execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || looseCompare(data[this.field], this.min) > 0;
  }
}

export class GreaterThanOrEqual extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly min: number,
  ) {
    super(field, errorMessage);
  }

  execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || looseCompare(data[this.field], this.min) >= 0;
  }
}

export class InArray extends Rule {
  constructor(
    field: string,
    protected readonly array: readonly unknown[],
    errorMessage: string,
  ) {
    super(field, errorMessage);
  }

  execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || inArray(data[this.field], this.array);
  }
}

export class NotInArray extends InArray {
  override execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || !inArray(data[this.field], this.array);
  }
}

export class Integer extends Rule {
  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    const value = data[this.field];
    if (typeof value === 'string') {
      return /^\d+$/.test(value[0] === '-' ? value.slice(1) : value);
    }
    return typeof value === 'number' ? Number.isInteger(value) : typeof value === 'bigint';
  }
}

export class Ip extends Rule {
  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    const value = String(data[this.field]);
    const v4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(value);
    return v4 || (value.includes(':') && /^[0-9A-Fa-f:.]+$/.test(value) && isValidIpv6(value));
  }
}

function isValidIpv6(value: string): boolean {
  try {
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

export class Length extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly min: number,
    private readonly max: number,
  ) {
    super(field, errorMessage);
  }

  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    const length = strLen(data[this.field]);
    return length >= this.min && length <= this.max;
  }
}

export class MaxLength extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly max: number,
  ) {
    super(field, errorMessage);
  }

  execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || strLen(data[this.field]) <= this.max;
  }
}

export class MinLength extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly min: number,
  ) {
    super(field, errorMessage);
  }

  execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || strLen(data[this.field]) >= this.min;
  }
}

/** `NotEmpty`: when the key is present, its value must be neither null nor an empty string. */
export class NotEmpty extends Rule {
  execute(data: Values): boolean {
    if (Object.prototype.hasOwnProperty.call(data, this.field)) {
      return data[this.field] !== null && data[this.field] !== undefined && data[this.field] !== '';
    }
    return true;
  }
}

export class Numeric extends Rule {
  execute(data: Values): boolean {
    return !this.isFieldNotEmpty(data) || isNumeric(data[this.field]);
  }
}

export class Range extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly min: number,
    private readonly max: number,
  ) {
    super(field, errorMessage);
  }

  execute(data: Values): boolean {
    if (this.isFieldNotEmpty(data)) {
      const value = data[this.field];
      if (!isNumeric(value)) {
        return false;
      }
      if (Number(value) < this.min || Number(value) > this.max) {
        return false;
      }
    }
    return true;
  }
}

export class Required extends Rule {
  execute(data: Values): boolean {
    return this.isFieldNotEmpty(data);
  }
}

export class Timezone extends Rule {
  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    const value = String(data[this.field]);
    // Same list as PHP `timezone_identifiers_list()`: canonical, case sensitive identifiers.
    return value === 'UTC' || (Intl.supportedValuesOf('timeZone') as string[]).includes(value);
  }
}

export class Url extends Rule {
  execute(data: Values): boolean {
    if (!this.isFieldNotEmpty(data)) {
      return true;
    }
    const value = String(data[this.field]);
    // PHP FILTER_VALIDATE_URL: a scheme and, for hierarchical schemes, a host are required.
    const match = /^([A-Za-z][A-Za-z0-9+.-]*):(\/\/)?([^\s/?#]*)([^\s]*)$/.exec(value);
    if (!match || /[^\x21-\x7e]/.test(value)) {
      return false;
    }
    const [, scheme, slashes, host] = match;
    if (scheme === 'mailto' || scheme === 'news' || scheme === 'file' || scheme === 'urn') {
      return true;
    }
    if (!slashes || host === '') {
      return false;
    }
    const hostname = host.replace(/^[^@]*@/, '').replace(/:\d*$/, '');
    return /^(\[[0-9A-Fa-f:.]+\]|[A-Za-z0-9]([A-Za-z0-9_-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9_-]*[A-Za-z0-9])?)*\.?)$/.test(hostname);
  }
}

/** Callback rule: succeeds when the (possibly async) callback returns true. */
export class Callback extends Rule {
  constructor(
    field: string,
    errorMessage: string,
    private readonly callback: (value: unknown, data: Values) => MaybePromise<boolean>,
  ) {
    super(field, errorMessage);
  }

  async execute(data: Values): Promise<boolean> {
    return !this.isFieldNotEmpty(data) || this.callback(data[this.field], data);
  }
}

/** PHP-like names (`new Validators\Required(...)`), so ported rule lists read the same. */
export const Validators = {
  Alpha,
  AlphaNumeric,
  Callback,
  Date: DateRule,
  Email,
  Equals,
  Exists,
  GreaterThan,
  GreaterThanOrEqual,
  InArray,
  Integer,
  Ip,
  Length,
  MaxLength,
  MinLength,
  NotEmpty,
  NotEquals,
  NotInArray,
  Numeric,
  Range,
  Required,
  Timezone,
  URL: Url,
  Unique,
} as const;

export class Validator {
  private errors: ValidationErrors = {};

  constructor(
    private readonly data: Values,
    private readonly rules: readonly Rule[],
  ) {}

  /** Run every rule (none short-circuits), collecting the errors. */
  async execute(): Promise<boolean> {
    let result = true;
    for (const rule of this.rules) {
      if (!(await rule.execute(this.data))) {
        this.addError(rule.getField(), rule.getErrorMessage());
        result = false;
      }
    }
    return result;
  }

  addError(field: string, message: string): void {
    (this.errors[field] ??= []).push(message);
  }

  getErrors(): ValidationErrors {
    return this.errors;
  }
}
