import type { Container } from '../core/container/container.js';
import { formatDate } from '../core/translator/date.js';

/**
 * Narrow contracts (and compiling stubs) of the collaborators the template helpers need that are not migrated yet.
 * Each helper resolves them with {@link optionalService}: a real service registered under the key wins, otherwise the
 * stub is used. Every stub is removed in M15 once the owning milestone provides the real service.
 */

export type TemplateParams = Record<string, unknown>;

/** Resolve a service that may not be registered yet, falling back to a stub. */
export function optionalService<T>(container: Container, key: string, fallback: () => T): T {
  const untyped = container as unknown as { has(key: string): boolean; get(key: string): unknown };
  return untyped.has(key) ? (untyped.get(key) as T) : fallback();
}

/** CSRF token provider (`Core\Security\Token::getCSRFToken`, needs the session: authentication/session milestone). */
export interface CsrfTokenInterface {
  getCSRFToken(): string;
}

export class CsrfTokenStub implements CsrfTokenInterface {
  getCSRFToken(): string {
    return '';
  }
}

/** Part of `Core\Http\Request` used by helpers (HTTP request wiring: controller milestones M8-M10). */
export interface HelperRequestInterface {
  isAjax(): boolean;
  getMethod(): string;
  /** PHP `getServerVariable()`; optional because the Node request has no `$_SERVER`. */
  getServerVariable?(name: string): string;
}

export class HelperRequestStub implements HelperRequestInterface {
  isAjax(): boolean {
    return false;
  }
  getMethod(): string {
    return '';
  }
}

/** Template service (`Core\Template::render`, src/core/template of this milestone). Output is already HTML. */
export interface TemplateRendererInterface {
  render(name: string, params?: TemplateParams): string;
}

export class TemplateRendererStub implements TemplateRendererInterface {
  render(name: string): string {
    throw new Error(`Template service is not available, cannot render "${name}".`);
  }
}

/** Markdown parser configured as in `TextHelper::markdown` (Parsedown port: markdown/core milestone). */
export interface MarkdownInterface {
  render(text: string, isPublicLink: boolean): string;
}

export class MarkdownStub implements MarkdownInterface {
  render(text: string): string {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return text === '' ? '' : `<p>${escaped.replace(/\r\n|\r|\n/g, '<br />\n')}</p>`;
  }
}

/** `Core\Session\FlashMessage` (session milestone). `getMessage` reads and clears the message. */
export interface FlashMessageInterface {
  getMessage(type: string): string;
  success(message: string): void;
  failure(message: string): void;
}

export class FlashMessageStub implements FlashMessageInterface {
  private readonly messages = new Map<string, string>();

  getMessage(type: string): string {
    const message = this.messages.get(type) ?? '';
    this.messages.delete(type);
    return message;
  }
  success(message: string): void {
    this.messages.set('success', message);
  }
  failure(message: string): void {
    this.messages.set('failure', message);
  }
}

/** `Model\ColorModel` subset (project/task models milestone). */
export interface ColorModelInterface {
  getList(): Record<string, string>;
  getCss(): string;
}

export class ColorModelStub implements ColorModelInterface {
  getList(): Record<string, string> {
    return {};
  }
  getCss(): string {
    return '';
  }
}

/** `Model\LanguageModel` subset (translator/locale milestone). */
export interface LanguageModelInterface {
  getJsLanguageCode(): string;
  isRtlLanguage(): boolean;
}

export class LanguageModelStub implements LanguageModelInterface {
  getJsLanguageCode(): string {
    return 'en';
  }
  isRtlLanguage(): boolean {
    return false;
  }
}

/** `Model\TimezoneModel` subset. */
export interface TimezoneModelInterface {
  getCurrentTimezone(): string;
}

export class TimezoneModelStub implements TimezoneModelInterface {
  getCurrentTimezone(): string {
    return 'UTC';
  }
}

/** `Core\Date\DateParser` subset (date milestone). */
export interface DateParserInterface {
  getUserDateFormat(): string;
  getUserDateTimeFormat(): string;
  getUserTimeFormat(): string;
  format(values: Record<string, unknown>, fields: readonly string[], format: string): Record<string, unknown>;
}

export class DateParserStub implements DateParserInterface {
  getUserDateFormat(): string {
    return 'm/d/Y';
  }
  getUserDateTimeFormat(): string {
    return 'm/d/Y H:i';
  }
  getUserTimeFormat(): string {
    return 'H:i';
  }
  format(values: Record<string, unknown>, fields: readonly string[], format: string): Record<string, unknown> {
    const result = { ...values };
    for (const field of fields) {
      const value = result[field];
      result[field] = value !== undefined && value !== null && value !== '' && value !== 0 && value !== '0' ? formatDate(format, Number(value)) : '';
    }
    return result;
  }
}

/** `Model\ProjectUserRoleModel` subset used by the layout (project role milestone). */
export interface ProjectUserRoleModelInterface {
  getActiveProjectsByUser(userId: number): Promise<Record<string, string>>;
}

export class ProjectUserRoleModelStub implements ProjectUserRoleModelInterface {
  getActiveProjectsByUser(): Promise<Record<string, string>> {
    return Promise.resolve({});
  }
}
