import { DEFAULT_ACTION, DEFAULT_CONTROLLER, Route, type RouteTarget } from './route.js';
import type { Request } from './request.js';
import type { Response } from './response.js';

/** Context handed to route handlers. */
export interface RouteContext {
  request: Request;
  response: Response;
}

/** A controller action. */
export type RouteHandler = (context: RouteContext) => unknown | Promise<unknown>;

export interface RouterOptions {
  /** URL path prefix of the application (PHP `$this->helper->url->dir()`), e.g. `/kanboard/` or `''`. */
  baseDir?: string;
}

const NAME_PATTERN = /^[a-zA-Z_0-9]+$/;

function ucfirst(value: string): string {
  return value === '' ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

function handlerKey(plugin: string, controller: string, action: string): string {
  return `${plugin}\u0000${controller}\u0000${action}`;
}

/**
 * Port of `app/Core/Http/Router.php`: resolves the current request to a plugin / controller / action
 * triple (from the `controller`, `action`, `plugin` query parameters or from the rewrite table) and
 * maps those triples to handlers registered with {@link register}.
 */
export class Router {
  static readonly DEFAULT_CONTROLLER = DEFAULT_CONTROLLER;
  static readonly DEFAULT_METHOD = DEFAULT_ACTION;

  private currentPluginName = '';
  private currentControllerName = '';
  private currentActionName = '';
  private readonly handlers = new Map<string, RouteHandler>();
  private readonly baseDir: string;

  constructor(
    private readonly route: Route = new Route(),
    options: RouterOptions = {},
  ) {
    this.baseDir = options.baseDir ?? '';
  }

  getRoute(): Route {
    return this.route;
  }

  getPlugin(): string {
    return this.currentPluginName;
  }

  getController(): string {
    return this.currentControllerName;
  }

  getAction(): string {
    return this.currentActionName;
  }

  /** Register the handler of a controller action (names are normalized like in `dispatch()`). */
  register(controller: string, action: string, handler: RouteHandler, plugin = ''): this {
    const target = this.normalize({ controller, action, plugin });
    this.handlers.set(handlerKey(target.plugin, target.controller, target.action), handler);
    return this;
  }

  /** Register a handler and its pretty URL in one call. */
  registerRoute(path: string, controller: string, action: string, handler: RouteHandler, plugin = ''): this {
    this.route.addRoute(path, controller, action, plugin);
    return this.register(controller, action, handler, plugin);
  }

  /** Handler of the given (or current) target. */
  getHandler(target: RouteTarget = { controller: this.currentControllerName, action: this.currentActionName, plugin: this.currentPluginName }): RouteHandler | undefined {
    const normalized = this.normalize(target);
    return this.handlers.get(handlerKey(normalized.plugin, normalized.controller, normalized.action));
  }

  /** Path of the request relative to the application base directory, without query string or leading slash. */
  getPath(request: Pick<Request, 'getUri' | 'getQueryString'>): string {
    let path = request.getUri().substring(this.baseDir.length);
    const query = request.getQueryString();

    if (query !== '') {
      path = path.substring(0, path.length - query.length - 1);
    }

    return path.startsWith('/') ? path.substring(1) : path;
  }

  /**
   * Resolve the request: explicit `controller`/`action`/`plugin` parameters win, otherwise the
   * rewrite table is consulted and its captured parameters are merged into the request.
   */
  dispatch(request: Pick<Request, 'getStringParam' | 'getUri' | 'getQueryString' | 'setParams'>): RouteTarget {
    let controller = request.getStringParam('controller');
    let action = request.getStringParam('action');
    let plugin = request.getStringParam('plugin');

    if (controller === '') {
      const match = this.route.findRoute(this.getPath(request));
      request.setParams(match.params);
      controller = match.controller;
      action = match.action;
      plugin = match.plugin;
    }

    const target = this.normalize({ controller, action, plugin });
    this.currentControllerName = target.controller;
    this.currentActionName = target.action;
    this.currentPluginName = target.plugin;
    return target;
  }

  /** Keep only safe identifiers, `default` otherwise (prevents arbitrary class/method lookups). */
  sanitize(value: string, defaultValue = ''): string {
    return NAME_PATTERN.test(value) ? value : defaultValue;
  }

  private normalize(target: RouteTarget): RouteTarget {
    return {
      controller: ucfirst(this.sanitize(target.controller, DEFAULT_CONTROLLER)),
      action: this.sanitize(target.action, DEFAULT_ACTION),
      plugin: ucfirst(this.sanitize(target.plugin)),
    };
  }
}
