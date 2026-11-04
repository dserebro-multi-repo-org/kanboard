import { describe, expect, it, vi } from 'vitest';
import { Container } from '../../../src/core/container/index.js';
import { Request, Response, Route, Router, type HttpReplyLike } from '../../../src/core/http/index.js';
import { Hook } from '../../../src/core/plugin/index.js';
import {
  AccessForbiddenException,
  BaseController,
  HelperRegistry,
  HookRegistry,
  NotificationTypeRegistry,
  PageNotFoundException,
  controllerHandler,
  type HelperInterface,
  type NotificationInterface,
  type PluginInterface,
} from '../../../src/foundation/index.js';

const container = new Container();

describe('HelperRegistry', () => {
  class UrlHelper implements HelperInterface {
    static created = 0;
    constructor(readonly container: Container) {
      UrlHelper.created++;
    }
  }

  it('registers lazily and caches', () => {
    const helpers = new HelperRegistry(container);
    helpers.register('url', UrlHelper);
    expect(UrlHelper.created).toBe(0);
    const a = helpers.get<UrlHelper>('url');
    expect(helpers.get('url')).toBe(a);
    expect(a.container).toBe(container);
    expect(UrlHelper.created).toBe(1);
    expect(helpers.has('url')).toBe(true);
    expect(helpers.names()).toEqual(['url']);
  });

  it('supports factories, instances and unknown names', () => {
    const helpers = new HelperRegistry(container);
    helpers.registerFactory('f', (c) => ({ container: c }));
    expect(helpers.get('f').container).toBe(container);
    const instance: HelperInterface = { container };
    helpers.set('s', instance);
    expect(helpers.get('s')).toBe(instance);
    expect(() => helpers.get('nope')).toThrow(/not defined/);
  });
});

describe('BaseController', () => {
  function makeEnv() {
    const sent: unknown[] = [];
    const reply: HttpReplyLike = { code: () => undefined, header: () => undefined, send: (p) => void sent.push(p) };
    const request = new Request({ method: 'GET', url: '/', headers: {}, query: { id: '4' } });
    const response = new Response(reply);
    return { request, response, sent };
  }

  class TaskController extends BaseController {
    show(): string {
      return `task ${this.request.getIntegerParam('id')}`;
    }
    html(): void {
      this.response.html('<b>ok</b>');
    }
    forbidden(): void {
      this.assertAllowed(false, 'nope');
    }
    missing(): void {
      this.assertFound(null, 'gone');
    }
    found(): number {
      return this.assertFound(5);
    }
    _private(): string {
      return 'x';
    }
  }

  it('dispatches public actions', async () => {
    const { request, response, sent } = makeEnv();
    const controller = new TaskController(container, request, response);
    expect(await controller.handle('show')).toBe('task 4');
    await controller.handle('html');
    expect(sent).toEqual(['<b>ok</b>']);
    expect(await controller.handle('found')).toBe(5);
  });

  it('refuses unknown, reserved and private actions', async () => {
    const { request, response } = makeEnv();
    const controller = new TaskController(container, request, response);
    for (const action of ['nope', 'handle', 'constructor', '_private', 'bad name', 'assertAllowed', 'toString', '__proto__']) {
      await expect(controller.handle(action)).rejects.toBeInstanceOf(PageNotFoundException);
    }
  });

  it('maps assertions to exceptions', async () => {
    const { request, response } = makeEnv();
    const controller = new TaskController(container, request, response);
    await expect(controller.handle('forbidden')).rejects.toBeInstanceOf(AccessForbiddenException);
    await expect(controller.handle('missing')).rejects.toBeInstanceOf(PageNotFoundException);
  });

  it('exception helpers', () => {
    const e = PageNotFoundException.getInstance('x');
    expect(e).toBeInstanceOf(PageNotFoundException);
    expect(e.message).toBe('x');
    expect(e.name).toBe('PageNotFoundException');
    expect(e.isWithoutLayout()).toBe(false);
    expect(e.withoutLayout().isWithoutLayout()).toBe(true);
  });

  it('plugs into the router through controllerHandler', async () => {
    const { request, response } = makeEnv();
    const router = new Router(new Route({ enabled: true }));
    router.register('TaskController', 'show', controllerHandler(container, TaskController, 'show'));
    const handler = router.getHandler({ controller: 'TaskController', action: 'show', plugin: '' });
    expect(await handler?.({ request, response })).toBe('task 4');
  });
});

describe('HookRegistry', () => {
  it('merges, lists, first and reference', () => {
    const hooks = new HookRegistry();
    expect(hooks).toBeInstanceOf(Hook);
    expect(hooks.exists('h')).toBe(false);
    hooks.on('h', () => ({ a: 1 }));
    hooks.on('h', (n: number) => ({ b: n }));
    expect(hooks.exists('h')).toBe(true);
    expect(hooks.getListeners('h')).toHaveLength(2);
    expect(hooks.merge('h', { z: 0 } as Record<string, unknown>, [5])).toEqual({ z: 0, a: 1, b: 5 });
    expect(hooks.first('h')).toEqual({ a: 1 });
    expect(hooks.first('none')).toBeNull();
  });

  it('mergeList, reference and emit', () => {
    const hooks = new HookRegistry();
    hooks.on('list', () => ['a', 'b']);
    hooks.on('list', () => []);
    hooks.on('list', () => ['c']);
    expect(hooks.mergeList('list', ['z'])).toEqual(['z', 'a', 'b', 'c']);

    hooks.on('ref', (o: { n: number }) => void o.n++);
    expect(hooks.reference('ref', { n: 1 })).toEqual({ n: 2 });

    const spy = vi.fn((x: number) => x * 2);
    hooks.on('emit', spy);
    expect(hooks.emit('emit', 21)).toEqual([42]);
    expect(spy).toHaveBeenCalledWith(21);
  });
});

describe('NotificationTypeRegistry', () => {
  class Web implements NotificationInterface {
    constructor(readonly container: Container) {}
    notifyUser(): void {}
    notifyProject(): void {}
  }

  it('registers, filters and lazily instantiates types', () => {
    const registry = new NotificationTypeRegistry(container);
    registry.setType('web', 'Web', Web).setType('hidden', 'Hidden', Web, true);
    expect(registry.getTypes()).toEqual({ web: 'Web' });
    expect(registry.getHiddenTypes()).toEqual(['hidden']);
    expect(registry.filterTypes(['web', 'email', 'hidden'])).toEqual(['web', 'hidden']);
    const instance = registry.getType('web');
    expect(instance).toBeInstanceOf(Web);
    expect(registry.getType('web')).toBe(instance);
    expect(() => registry.getType('email')).toThrow(/not defined/);
  });
});

describe('PluginInterface', () => {
  it('can be implemented', () => {
    const plugin: PluginInterface = {
      initialize: () => undefined,
      getPluginName: () => 'P',
      getPluginDescription: () => '',
      getPluginAuthor: () => '',
      getPluginVersion: () => '1.0.0',
      getPluginHomepage: () => '',
      getCompatibleVersion: () => '>=1.2.0',
      getClasses: () => ({}),
      getHelpers: () => ({}),
    };
    expect(plugin.getPluginName()).toBe('P');
  });
});
