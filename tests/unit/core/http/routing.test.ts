import { describe, expect, it, vi } from 'vitest';
import { Request, Response, Route, Router, phpUrlDecode, phpUrlEncode, type HttpReplyLike } from '../../../../src/core/http/index.js';

function req(url: string, query: Record<string, string> = {}, headers: Record<string, string> = {}): Request {
  return new Request({ method: 'GET', url, headers, query });
}

describe('Route', () => {
  const route = new Route({ enabled: true });
  route
    .addRoute('/board/:project_id', 'BoardViewController', 'show')
    .addRoute('task/:task_id/comment/:comment_id', 'CommentController', 'edit')
    .addRoute('/hello/world', 'PluginController', 'index', 'hello')
    .addRoute('/', 'DashboardController', 'show');

  it('is inactive until enabled (PHP semantics)', () => {
    const disabled = new Route();
    disabled.addRoute('a/:b', 'C', 'd');
    expect(disabled.findRoute('a/1').controller).toBe('DashboardController');
    expect(disabled.enable().isEnabled()).toBe(true);
  });

  it('finds routes and captures params', () => {
    expect(route.findRoute('board/12')).toEqual({ controller: 'BoardViewController', action: 'show', plugin: '', params: { project_id: '12' } });
    expect(route.findRoute('/task/3/comment/a%20b').params).toEqual({ task_id: '3', comment_id: 'a b' });
    expect(route.findRoute('hello/world')).toMatchObject({ controller: 'PluginController', plugin: 'hello' });
  });

  it('falls back to the dashboard', () => {
    expect(route.findRoute('unknown/path/here')).toEqual({ controller: 'DashboardController', action: 'show', plugin: '', params: {} });
    expect(route.findRoute('board')).toMatchObject({ controller: 'DashboardController' });
  });

  it('does not match when a static segment differs', () => {
    expect(route.findRoute('boards/1').controller).toBe('DashboardController');
  });

  it('builds URLs', () => {
    expect(route.findUrl('BoardViewController', 'show', { project_id: 5 })).toBe('board/5');
    expect(route.findUrl('BoardViewController', 'show', { project_id: 'a b' })).toBe('board/a+b');
    expect(route.findUrl('BoardViewController', 'show', {})).toBe('');
    expect(route.findUrl('BoardViewController', 'show', { project_id: 1, extra: 2 })).toBe('');
    expect(route.findUrl('CommentController', 'edit', { task_id: 1, comment_id: 2 })).toBe('task/1/comment/2');
    expect(route.findUrl('PluginController', 'index', {}, 'hello')).toBe('hello/world');
    expect(route.findUrl('PluginController', 'index', { plugin: 'hello' })).toBe('hello/world');
    expect(route.findUrl('Nope', 'x')).toBe('');
  });

  it('findParams lists placeholders', () => {
    expect(route.findParams(['a', ':b', '', ':c'])).toEqual({ b: true, c: true });
  });

  it('php url coding helpers', () => {
    expect(phpUrlEncode("a b~'!")).toBe('a+b%7E%27%21');
    expect(phpUrlDecode('a+b%20c')).toBe('a b c');
    expect(phpUrlDecode('%E0%A4%A')).toBe('%E0%A4%A');
  });
});

describe('Router', () => {
  const makeRouter = (baseDir = ''): Router => {
    const route = new Route({ enabled: true }).addRoute('board/:project_id', 'BoardViewController', 'show');
    return new Router(route, { baseDir });
  };

  it('extracts the path without query string and base dir', () => {
    const router = makeRouter('/kb/');
    expect(router.getPath(req('/kb/board/3?x=1', { x: '1' }))).toBe('board/3');
    expect(makeRouter().getPath(req('/board/3'))).toBe('board/3');
    expect(makeRouter().getPath(req('/'))).toBe('');
  });

  it('dispatches explicit controller/action/plugin parameters', () => {
    const router = makeRouter();
    const target = router.dispatch(req('/?controller=taskViewController&action=show&plugin=myplugin', { controller: 'taskViewController', action: 'show', plugin: 'myplugin' }));
    expect(target).toEqual({ controller: 'TaskViewController', action: 'show', plugin: 'Myplugin' });
    expect(router.getController()).toBe('TaskViewController');
    expect(router.getAction()).toBe('show');
    expect(router.getPlugin()).toBe('Myplugin');
  });

  it('sanitizes bad identifiers', () => {
    const router = makeRouter();
    const target = router.dispatch(req('/', { controller: '../etc', action: 'a-b', plugin: 'x/y' }));
    expect(target).toEqual({ controller: 'DashboardController', action: 'show', plugin: '' });
    expect(router.sanitize('ok_1')).toBe('ok_1');
    expect(router.sanitize('no way', 'd')).toBe('d');
  });

  it('dispatches through the rewrite table and sets params', () => {
    const router = makeRouter();
    const request = req('/board/9?x=1', { x: '1' });
    expect(router.dispatch(request)).toEqual({ controller: 'BoardViewController', action: 'show', plugin: '' });
    expect(request.getIntegerParam('project_id')).toBe(9);
  });

  it('falls back to the dashboard default', () => {
    const router = makeRouter();
    expect(router.dispatch(req('/nothing/here'))).toEqual({ controller: 'DashboardController', action: 'show', plugin: '' });
  });

  it('maps targets to handlers, including plugins', () => {
    const router = makeRouter();
    const handler = vi.fn();
    const pluginHandler = vi.fn();
    router.registerRoute('board/:project_id', 'BoardViewController', 'show', handler);
    router.register('PluginController', 'index', pluginHandler, 'hello');
    router.dispatch(req('/board/1'));
    expect(router.getHandler()).toBe(handler);
    expect(router.getHandler({ controller: 'pluginController', action: 'index', plugin: 'hello' })).toBe(pluginHandler);
    expect(router.getHandler({ controller: 'PluginController', action: 'index', plugin: '' })).toBeUndefined();
  });
});

describe('Response', () => {
  function makeReply() {
    const calls = { code: 0, headers: {} as Record<string, string>, sent: [] as unknown[] };
    const reply: HttpReplyLike = {
      code: (c) => void (calls.code = c),
      header: (k, v) => void (calls.headers[k] = v),
      send: (p) => void calls.sent.push(p),
    };
    return { calls, reply };
  }

  it('sends json with no cache headers', () => {
    const { calls, reply } = makeReply();
    const response = new Response(reply);
    response.json({ ok: true }, 201);
    expect(calls.code).toBe(201);
    expect(calls.headers['Content-Type']).toBe('application/json');
    expect(calls.headers['Pragma']).toBe('no-cache');
    expect(calls.sent).toEqual(['{"ok":true}']);
    expect(response.isResponseAlreadySent()).toBe(true);
  });

  it('sends html, text and status only', () => {
    const a = makeReply();
    new Response(a.reply).html('<p>x</p>');
    expect(a.calls.headers['Content-Type']).toBe('text/html; charset=utf-8');
    expect(a.calls.code).toBe(200);
    const b = makeReply();
    new Response(b.reply).text('plain', 404);
    expect(b.calls.code).toBe(404);
    const c = makeReply();
    new Response(c.reply).status(204);
    expect(c.calls.sent).toEqual([undefined]);
  });

  it('redirects with Location, or X-Ajax-Redirect for ajax requests', () => {
    const a = makeReply();
    new Response(a.reply, { request: req('/') }).redirect('/dashboard');
    expect(a.calls.code).toBe(302);
    expect(a.calls.headers['Location']).toBe('/dashboard');

    const b = makeReply();
    new Response(b.reply, { request: req('/', {}, { 'x-requested-with': 'XMLHttpRequest' }) }).redirect('/dashboard');
    expect(b.calls.headers['X-Ajax-Redirect']).toBe('/dashboard');
    expect(b.calls.headers['Location']).toBeUndefined();
    expect(b.calls.code).toBe(200);

    const c = makeReply();
    new Response(c.reply, { request: req('/', {}, { 'x-requested-with': 'XMLHttpRequest' }) }).redirect('/x', true);
    expect(c.calls.headers['X-Ajax-Redirect']).toBe('self');
  });

  it('builds security headers', () => {
    const { calls, reply } = makeReply();
    const https = new Request({ method: 'GET', url: '/', headers: {}, protocol: 'https' });
    new Response(reply, { request: https })
      .withSecurityHeaders()
      .withXframe()
      .withStrictTransportSecurity()
      .withContentSecurityPolicy({ 'default-src': " 'self' ", 'img-src': '*' })
      .withCache(60, 'abc')
      .html('');
    expect(calls.headers['X-Content-Type-Options']).toBe('nosniff');
    expect(calls.headers['X-Frame-Options']).toBe('DENY');
    expect(calls.headers['Strict-Transport-Security']).toBe('max-age=31536000');
    expect(calls.headers['Content-Security-Policy']).toBe("default-src 'self'; img-src *; ");
    expect(calls.headers['Cache-Control']).toBe('public, max-age=60');
    expect(calls.headers['ETag']).toBe('"abc"');
  });

  it('does not send HSTS over plain http and supports downloads', () => {
    const { calls, reply } = makeReply();
    const response = new Response(reply, { request: req('/') });
    response.withStrictTransportSecurity().withFileDownload('a.txt');
    expect(response.getHeaders()['Strict-Transport-Security']).toBeUndefined();
    response.binary(Buffer.from('x'));
    expect(calls.headers['Content-Disposition']).toBe('attachment; filename="a.txt"');
    expect(calls.headers['Content-Type']).toBe('application/octet-stream');
    expect(response.getStatusCode()).toBe(200);
  });
});
