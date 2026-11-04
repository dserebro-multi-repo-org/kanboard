/** Controller / action pair (plus optional plugin) a path resolves to. */
export interface RouteTarget {
  controller: string;
  action: string;
  plugin: string;
}

/** Result of {@link Route.findRoute}: the target plus the parameters captured from `:name` segments. */
export interface RouteMatch extends RouteTarget {
  params: Record<string, string>;
}

interface PathEntry extends RouteTarget {
  items: string[];
  count: number;
}

interface UrlEntry {
  path: string;
  params: Set<string>;
}

export const DEFAULT_CONTROLLER = 'DashboardController';
export const DEFAULT_ACTION = 'show';

/** PHP `urlencode()` compatible encoding. */
export function phpUrlEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*~]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%20/g, '+');
}

/** PHP `urldecode()` compatible decoding (`+` is a space, malformed escapes are left untouched). */
export function phpUrlDecode(value: string): string {
  const withSpaces = value.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(withSpaces);
  } catch {
    return withSpaces;
  }
}

/**
 * URL rewriting table, port of `app/Core/Http/Route.php`. Routes are patterns such as
 * `board/:project_id` mapped to a controller/action, optionally owned by a plugin.
 *
 * As in PHP, routes are only registered once the table has been enabled (PHP: when
 * `ENABLE_URL_REWRITE` is on). Pass `{ enabled: true }` or call {@link enable}.
 */
export class Route {
  private activated: boolean;
  private readonly paths: PathEntry[] = [];
  private readonly urls = new Map<string, Map<string, Map<string, UrlEntry[]>>>();

  constructor(options: { enabled?: boolean } = {}) {
    this.activated = options.enabled ?? false;
  }

  enable(): this {
    this.activated = true;
    return this;
  }

  isEnabled(): boolean {
    return this.activated;
  }

  addRoute(path: string, controller: string, action: string, plugin = ''): this {
    if (!this.activated) return this;

    const normalized = path.replace(/^\/+/, '');
    const items = normalized.split('/');

    this.paths.push({ items, count: items.length, controller, action, plugin });

    const byController = this.urls.get(plugin) ?? new Map<string, Map<string, UrlEntry[]>>();
    const byAction = byController.get(controller) ?? new Map<string, UrlEntry[]>();
    const entries = byAction.get(action) ?? [];
    entries.push({ path: normalized, params: new Set(Object.keys(this.findParams(items))) });
    byAction.set(action, entries);
    byController.set(controller, byAction);
    this.urls.set(plugin, byController);

    return this;
  }

  /** Whether a registered rewrite route matches the path (no dashboard fallback). */
  hasRoute(path: string): boolean {
    const items = path.replace(/^\/+/, '').split('/');
    return this.paths.some(
      (route) => route.count === items.length && route.items.every((item, i) => item.startsWith(':') || item === (items[i] ?? '')),
    );
  }

  /**
   * Find the route matching a path. Falls back to `DashboardController::show` when nothing matches
   * (with empty params).
   */
  findRoute(path: string): RouteMatch {
    const items = path.replace(/^\/+/, '').split('/');
    const count = items.length;

    for (const route of this.paths) {
      if (route.count !== count) continue;

      const params: Record<string, string> = {};
      let i = 0;
      for (; i < count; i++) {
        const routeItem = route.items[i] ?? '';
        const item = items[i] ?? '';
        if (routeItem.startsWith(':')) {
          params[routeItem.slice(1)] = phpUrlDecode(item);
        } else if (routeItem !== item) {
          break;
        }
      }

      if (i === count) {
        return { controller: route.controller, action: route.action, plugin: route.plugin, params };
      }
    }

    return { controller: DEFAULT_CONTROLLER, action: DEFAULT_ACTION, plugin: '', params: {} };
  }

  /**
   * Build the pretty URL for a controller/action with the given parameters, or `''` when no route matches.
   * A `plugin` entry in `params` is used as plugin name when `plugin` is empty.
   */
  findUrl(controller: string, action: string, params: Readonly<Record<string, string | number>> = {}, plugin = ''): string {
    let pluginName = plugin;
    let values: Record<string, string | number> = { ...params };

    if (pluginName === '' && 'plugin' in values) {
      pluginName = String(values['plugin']);
      const { plugin: _removed, ...rest } = values;
      values = rest;
    }

    const entries = this.urls.get(pluginName)?.get(controller)?.get(action);
    if (entries === undefined) return '';

    for (const route of entries) {
      const keys = Object.keys(values);
      if (!keys.every((key) => route.params.has(key))) continue;
      if (keys.length !== route.params.size) continue;

      return route.path
        .split('/')
        .map((item) => (item.startsWith(':') ? phpUrlEncode(String(values[item.slice(1)])) : item))
        .join('/');
    }

    return '';
  }

  /** Names of the `:param` placeholders found in path segments. */
  findParams(items: readonly string[]): Record<string, true> {
    const params: Record<string, true> = {};
    for (const item of items) {
      if (item !== '' && item.startsWith(':')) {
        params[item.slice(1)] = true;
      }
    }
    return params;
  }
}
