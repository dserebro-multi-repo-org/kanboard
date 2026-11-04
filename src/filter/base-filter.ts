import type { FilterQuery, FilterValue } from '../core/filter/filter-interface.js';

/** PHP `(string) $value` for the scalar values filters receive. */
export function phpString(value: unknown): string {
  if (value === null || value === undefined || value === false) return '';
  if (value === true) return '1';
  return String(value);
}

/** `is_int($value) || ctype_digit((string) $value)` */
export function isIntegerLike(value: unknown): boolean {
  return (typeof value === 'number' && Number.isInteger(value)) || /^[0-9]+$/.test(phpString(value));
}

/** PHP `empty($value)` for filter values. */
export function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === false || value === '' || value === 0 || value === '0' || (Array.isArray(value) && value.length === 0);
}

/** Port of `Kanboard\Filter\BaseFilter`. */
export abstract class BaseFilter {
  protected query!: FilterQuery;
  protected value: FilterValue;

  constructor(value: FilterValue = null) {
    this.value = value;
  }

  /** Create a filter with a value (PHP `static::getInstance`). */
  static getInstance<T extends BaseFilter>(this: new (value?: FilterValue) => T, value: FilterValue = null): T {
    return new this(value);
  }

  withQuery(query: FilterQuery): this {
    this.query = query;
    return this;
  }

  withValue(value: FilterValue): this {
    this.value = value;
    return this;
  }

  /** Shallow copy (PHP `clone`). */
  clone(): this {
    const copy = Object.create(Object.getPrototypeOf(this) as object) as this;
    return Object.assign(copy, this);
  }

  /** Value as a string (PHP string coercion). */
  protected get stringValue(): string {
    return phpString(this.value);
  }
}
