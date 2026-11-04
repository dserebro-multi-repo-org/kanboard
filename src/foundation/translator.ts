import { Translator } from '../core/translator/translator.js';

/**
 * Minimal translation facade standing in for the PHP global `t()` function until the localisation
 * milestone provides the real translator (stub removed in M15). By default strings are returned untranslated,
 * `%s` / `%d` / `%%` placeholders are substituted and string arguments are HTML escaped like `Translator::translate()`.
 */
export interface TranslatorLike {
  translate(message: string, ...args: unknown[]): string;
}

/** PHP `htmlspecialchars()` with the default flags used by Kanboard (quotes escaped). */
export function htmlspecialchars(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Tiny `vsprintf` supporting `%s`, `%d`, `%f`, `%%` and positional `%1$s` placeholders. */
export function sprintf(format: string, args: readonly unknown[]): string {
  let next = 0;

  return format.replace(/%(?:(\d+)\$)?([sdf%])/g, (_match, position: string | undefined, type: string) => {
    if (type === '%') return '%';
    const index = position !== undefined ? Number.parseInt(position, 10) - 1 : next++;
    const value = args[index];
    if (type === 'd') return String(Math.trunc(Number(value ?? 0)) || 0);
    if (type === 'f') return Number(value ?? 0).toFixed(6);
    return value === undefined || value === null ? '' : String(value);
  });
}

/** Delegates to the real Translator singleton (which is en_US / identity until a locale is loaded). */
class DefaultTranslator implements TranslatorLike {
  translate(message: string, ...args: unknown[]): string {
    return Translator.getInstance().translate(message, ...args);
  }
}

let translator: TranslatorLike = new DefaultTranslator();

/** Install the real translator (or a test double). */
export function setTranslator(instance: TranslatorLike): void {
  translator = instance;
}

/** Translate a string (PHP `t()`). */
export function t(message: string, ...args: unknown[]): string {
  return translator.translate(message, ...args);
}
