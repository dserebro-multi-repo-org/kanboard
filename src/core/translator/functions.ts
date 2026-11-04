import { formatDate } from './date.js';
import { Translator } from './translator.js';

/** Translate a string, arguments are HTML escaped (PHP `t()`). */
export function t(identifier: string, ...args: unknown[]): string {
  return Translator.getInstance().translate(identifier, ...args);
}

/** Translate a string with no HTML escaping (PHP `e()`). */
export function e(identifier: string, ...args: unknown[]): string {
  return Translator.getInstance().translateNoEscaping(identifier, ...args);
}

/** Format a number using the loaded locale (PHP `n()`). */
export function n(value: number | string): string {
  return Translator.getInstance().number(value);
}

/** Format a currency amount using the loaded locale. */
export function c(amount: number | string): string {
  return Translator.getInstance().currency(amount);
}

/**
 * Date formatting with a PHP `date()` format (as used by DateHelper::date/time/datetime).
 * `value` is a unix timestamp in seconds or a Date.
 */
export function dt(format: string, value: number | Date = new Date(), timeZone = 'UTC'): string {
  return formatDate(format, value, timeZone);
}
