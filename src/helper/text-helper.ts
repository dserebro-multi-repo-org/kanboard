import { MarkdownStub, optionalService, type MarkdownInterface } from '../foundation/helper-collaborators.js';
import { t } from '../core/translator/functions.js';
import { HelperBase } from './helper-base.js';
import { htmlspecialchars, isSet, phpEmpty, phpRound } from './php.js';

/** Port of `app/Helper/TextHelper.php`. */
export class TextHelper extends HelperBase {
  /** HTML escaping: `htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8', false)`. */
  e(value: unknown): string {
    return htmlspecialchars(value, false);
  }

  /** Join with HTML escaping. */
  implode(glue: string, list: readonly unknown[]): string {
    return list.map((value) => htmlspecialchars(value, false)).join(glue);
  }

  /** Markdown transformation (safe mode, breaks enabled, markup escaped per `MARKDOWN_ESCAPE_HTML`). */
  markdown(text: unknown, isPublicLink = false): string {
    const markdown = optionalService<MarkdownInterface>(this.container, 'markdown', () => new MarkdownStub());
    return markdown.render(phpEmpty(text) ? '' : String(text), isPublicLink);
  }

  /** Reply transformation (quote every line of a comment). */
  reply(username: string, text: string): string {
    const res = `${t('%s wrote: ', username)}\n> `;
    return res + text.split(/\r\n|\n|\r/).join('\n> ');
  }

  /** Format a file size (`0` for an empty size, else e.g. `33.71k`). */
  bytes(size: number, precision = 2): string | number {
    if (size == 0) return 0; // PHP `$size == 0`
    const base = Math.log(size) / Math.log(1024);
    const suffixes = ['', 'k', 'M', 'G', 'T'];
    return String(phpRound(1024 ** (base - Math.floor(base)), precision)) + (suffixes[Math.floor(base)] ?? '');
  }

  /** Whether needle is contained in the haystack. */
  contains(haystack: string, needle: string): boolean {
    return String(haystack).includes(needle);
  }

  /** Return an escaped value from a dictionary, or the default value when the key does not exist. */
  in(id: string | number, listing: Readonly<Record<string, unknown>> | readonly unknown[], defaultValue = '?'): string {
    if (isSet(listing, id)) {
      return this.e((listing as Record<string | number, unknown>)[id]);
    }
    return defaultValue;
  }
}
