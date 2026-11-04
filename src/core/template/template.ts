/**
 * Template service, port of `app/Core/Template.php` on top of Nunjucks.
 *
 * ## Naming (identical to PHP)
 * - `task/show` or `kanboard:task/show` -> `<viewsDir>/task/show.njk` (core views, `src/views`)
 * - `myplugin:task/show` -> `<PLUGINS_DIR>/Myplugin/Template/task/show.njk` (`ucfirst(plugin)`)
 * - {@link Template.setTemplateOverride} redirects one name to another; overrides are honoured for
 *   `render()` AND for `{% include %}` / `{% extends %}` / `{% import %}` (the loader resolves names
 *   through the same function).
 *
 * ## Conventions used by every view (M7 onwards)
 * - Autoescape is ON. Anything not marked safe is HTML escaped.
 * - Helpers (`$this->helper->url->href()` in PHP) are exposed lazily through the {@link HelperRegistry}:
 *   `{{ helper.url.href(...) }}` and the shorthand `{{ url.href(...) }}` / `{{ text.e(x) }}` both work for
 *   every registered helper (name = registry name). A render variable with the same name wins over the
 *   shorthand; `helper.<name>` is always unambiguous.
 * - In PHP every `<?= ... ?>` is raw, and helpers return ready-made, already escaped HTML. Therefore string
 *   results of helper methods are wrapped as safe strings (see `safeHelperOutput`). Arrays/objects/numbers
 *   are returned untouched. Caveat: a safe string is an object, so compare with `==` (not `===`) in views.
 * - `markSafe(str)` marks a string as safe; filters `safe` (builtin) and `raw` (alias) do the same in views.
 * - Translation: globals and filters `t`, `e`, `tc`, `n`, `c`, `dt`. `t`/`e`/`tc` return safe strings (the
 *   translator already escapes the arguments, like PHP `t()`); `{{ 'Hello %s' | t(name) }}` also works.
 *   `tc(context, id, ...args)` ignores the context (kept for source compatibility).
 *   They delegate to the `translator` service when available (narrow {@link TranslatorLike}) and fall back
 *   to the identifier / plain formatting otherwise.
 */
import fs from 'node:fs';
import path from 'node:path';
import nunjucks from 'nunjucks';
import type { HelperRegistry } from '../../foundation/helper.js';
import { formatDate } from '../translator/date.js';

/** Narrow view of the Translator service used by the template layer. */
export interface TranslatorLike {
  translate(identifier: string, ...args: unknown[]): string;
  translateNoEscaping?(identifier: string, ...args: unknown[]): string;
  number?(value: number | string): string;
  currency?(amount: number | string): string;
}

export interface TemplateOptions {
  /** Directory of the core views. Default: `src/views` next to this module's tree. */
  viewsDir?: string;
  /** Directory containing plugins (`PLUGINS_DIR`). */
  pluginsDir: string;
  /** Lazy translator accessor (the service may be registered after the template service). */
  translator?: () => TranslatorLike | undefined;
  /** File extension of templates. Default `.njk`. */
  extension?: string;
  /** Mark string results of helper methods as safe (PHP echoes helper output raw). Default true. */
  safeHelperOutput?: boolean;
  /** Disable the compiled template cache (re-read files at each render). Default false. */
  noCache?: boolean;
  /** Timezone for `dt`. Default `UTC`. */
  timeZone?: string;
}

export const DEFAULT_VIEWS_DIR = path.resolve(import.meta.dirname, '..', '..', 'views');

/** Mark a string as safe HTML so autoescape does not escape it. */
export function markSafe(value: string): SafeString {
  return (nunjucks.runtime as unknown as { markSafe(v: string): SafeString }).markSafe(value);
}

/** Opaque safe string (nunjucks `SafeString`, a `String` subclass). */
export type SafeString = String; // eslint-disable-line @typescript-eslint/no-wrapper-object-types

interface EnvInternals {
  loaders: unknown[];
  globals: Record<string, unknown>;
}

export class TemplateNotFoundError extends Error {
  constructor(name: string) {
    super(`Template "${name}" not found`);
    this.name = 'TemplateNotFoundError';
  }
}

class KanboardLoader extends nunjucks.Loader {
  constructor(private readonly tpl: Template, private readonly noCache: boolean) {
    super();
  }

  getSource(name: string): nunjucks.LoaderSource {
    let file: string;
    try {
      file = this.tpl.getTemplateFile(name);
    } catch {
      return null as unknown as nunjucks.LoaderSource;
    }
    if (!fs.existsSync(file)) return null as unknown as nunjucks.LoaderSource;
    return { src: fs.readFileSync(file, 'utf8'), path: file, noCache: this.noCache };
  }
}

export class Template {
  private readonly overrides = new Map<string, string>();
  private readonly viewsDir: string;
  private readonly extension: string;
  private readonly env: nunjucks.Environment;
  private readonly helperProxies = new Map<string, unknown>();

  constructor(private readonly helpers: HelperRegistry, private readonly options: TemplateOptions) {
    this.viewsDir = options.viewsDir ?? DEFAULT_VIEWS_DIR;
    this.extension = options.extension ?? '.njk';
    this.env = new nunjucks.Environment(new KanboardLoader(this, options.noCache ?? false), {
      autoescape: true,
      throwOnUndefined: false,
    });
    this.installGlobals();
    this.installFilters();
  }

  /** The underlying Nunjucks environment (for extensions registered by plugins). */
  getEnvironment(): nunjucks.Environment {
    return this.env;
  }

  /** Render a template (PHP `render($name, $args)`). */
  render(name: string, vars: Record<string, unknown> = {}): string {
    return this.env.render(name, vars);
  }

  /** Render a template string (not file based); handy for tests and mails. */
  renderString(source: string, vars: Record<string, unknown> = {}): string {
    return this.env.renderString(source, vars);
  }

  /** Redirect `originalTemplate` to `newTemplate` (PHP `setTemplateOverride`). */
  setTemplateOverride(originalTemplate: string, newTemplate: string): void {
    this.overrides.set(originalTemplate, newTemplate);
    this.clearCache();
  }

  /** Absolute template filename for a (possibly namespaced, possibly overridden) name. */
  getTemplateFile(template: string): string {
    template = this.overrides.get(template) ?? template;
    let plugin = '';

    const idx = template.indexOf(':');
    if (idx !== -1) {
      plugin = template.slice(0, idx);
      template = template.slice(idx + 1);
    }

    const segments = template.split('/');
    if (template === '' || segments.some((s) => s === '..' || s === '') || /[\\\0]/.test(template) || /[\\/\0]|^\.\.?$/.test(plugin)) {
      throw new TemplateNotFoundError(template);
    }

    if (plugin !== 'kanboard' && plugin !== '') {
      const dir = plugin.charAt(0).toUpperCase() + plugin.slice(1);
      return path.join(this.options.pluginsDir, dir, 'Template', ...segments) + this.extension;
    }

    return path.join(this.viewsDir, ...segments) + this.extension;
  }

  /** Whether the template file exists. */
  exists(template: string): boolean {
    try {
      return fs.existsSync(this.getTemplateFile(template));
    } catch {
      return false;
    }
  }

  private clearCache(): void {
    for (const loader of (this.env as unknown as EnvInternals).loaders) {
      (loader as unknown as { cache: Record<string, unknown> }).cache = {};
    }
  }

  private helperAccessor(name: string): unknown {
    let proxy = this.helperProxies.get(name);
    if (proxy === undefined) {
      const instance = this.helpers.get(name) as unknown as Record<string | symbol, unknown>;
      proxy = this.options.safeHelperOutput === false ? instance : this.wrapHelper(instance);
      this.helperProxies.set(name, proxy);
    }
    return proxy;
  }

  private wrapHelper(instance: Record<string | symbol, unknown>): unknown {
    return new Proxy(instance, {
      get: (target, prop) => {
        const value = Reflect.get(target, prop, target) as unknown;
        if (typeof value !== 'function') return value;
        return (...args: unknown[]): unknown => {
          const result = (value as (...a: unknown[]) => unknown).apply(target, args);
          return typeof result === 'string' ? markSafe(result) : result;
        };
      },
    });
  }

  private installGlobals(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const lazy = (name: string): unknown => self.helperAccessor(name);

    // `helper.<name>`
    const helperNamespace = new Proxy({} as Record<string, unknown>, {
      get: (_t, prop) => (typeof prop === 'string' && self.helpers.has(prop) ? lazy(prop) : undefined),
      has: (_t, prop) => typeof prop === 'string' && self.helpers.has(prop),
    });

    const base: Record<string, unknown> = {
      helper: helperNamespace,
      t: (id: string, ...args: unknown[]) => self.t(id, args, true),
      e: (id: string, ...args: unknown[]) => self.t(id, args, false),
      tc: (_context: string, id: string, ...args: unknown[]) => self.t(id, args, true),
      n: (v: number | string) => self.n(v),
      c: (v: number | string) => self.c(v),
      dt: (format: string, value?: number | Date) => formatDate(format, value, self.options.timeZone ?? 'UTC'),
      markSafe,
    };

    // Shorthand: `{{ url.href() }}` resolves lazily through the registry. Explicit globals win.
    const internals = this.env as unknown as EnvInternals;
    internals.globals = new Proxy(internals.globals, {
      get: (target, prop, receiver) => {
        if (typeof prop === 'string') {
          if (prop in base) return base[prop];
          if (prop in target) return Reflect.get(target, prop, receiver) as unknown;
          if (self.helpers.has(prop)) return lazy(prop);
          return undefined;
        }
        return Reflect.get(target, prop, receiver) as unknown;
      },
      has: (target, prop) =>
        Reflect.has(target, prop) || (typeof prop === 'string' && (prop in base || self.helpers.has(prop))),
    });
  }

  private installFilters(): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.env.addFilter('raw', (v: unknown) => (v === null || v === undefined ? '' : markSafe(String(v))));
    this.env.addFilter('t', (id: string, ...args: unknown[]) => self.t(id, args, true));
    this.env.addFilter('e', (id: string, ...args: unknown[]) => self.t(id, args, false));
    this.env.addFilter('tc', (id: string, context: string, ...args: unknown[]) => {
      void context;
      return self.t(id, args, true);
    });
    this.env.addFilter('n', (v: number | string) => self.n(v));
    this.env.addFilter('c', (v: number | string) => self.c(v));
    this.env.addFilter('dt', (value: number | Date | undefined, format = 'Y-m-d') =>
      formatDate(format, value, self.options.timeZone ?? 'UTC'),
    );
  }

  private translator(): TranslatorLike | undefined {
    return this.options.translator?.();
  }

  private t(id: string, args: unknown[], escape: boolean): SafeString {
    const tr = this.translator();
    let out: string;
    if (tr === undefined) {
      out = args.length > 0 ? fallbackSprintf(id, args) : id;
    } else if (!escape && tr.translateNoEscaping !== undefined) {
      out = tr.translateNoEscaping(id, ...args);
    } else {
      out = tr.translate(id, ...args);
    }
    return markSafe(out);
  }

  private n(v: number | string): string {
    return this.translator()?.number?.(v) ?? String(v);
  }

  private c(v: number | string): string {
    return this.translator()?.currency?.(v) ?? String(v);
  }
}

function fallbackSprintf(format: string, args: unknown[]): string {
  let i = 0;
  return format.replace(/%[sd]/g, () => String(args[i++] ?? ''));
}
