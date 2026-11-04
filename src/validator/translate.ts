import { Translator, escapeHtml } from '../core/translator/translator.js';

/**
 * Minimal port of the `t()` translation helper for the validator layer.
 *
 * The validators only ever need the en_US catalogue, where the translated string is the
 * message key itself, so translation reduces to a `sprintf` of the key. The real translator
 * arrives with the i18n milestone and can replace this module without touching the validators.
 */

/** PHP style `sprintf` supporting `%d`, `%s`, `%f`, `%%` and positional (`%1$s`) arguments. */
export function sprintf(format: string, ...args: unknown[]): string {
  let next = 0;
  return format.replace(/%(?:(\d+)\$)?([dsf%])/g, (_match, position: string | undefined, type: string) => {
    if (type === '%') {
      return '%';
    }
    const index = position === undefined ? next++ : Number(position) - 1;
    const value = args[index];
    switch (type) {
      case 'd':
        return String(Math.trunc(Number(value)) || 0);
      case 'f':
        return Number(value).toFixed(6);
      default:
        return String(value ?? '');
    }
  });
}

/** Translate a message through the real Translator (identity for en_US); only the arguments are HTML escaped. */
export function t(message: string, ...args: unknown[]): string {
  return Translator.getInstance().translateNoEscaping(message, ...args.map(escapeHtml));
}
