import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../../src/app.js';
import { loadConfig } from '../../../src/config/index.js';
import { createContainer, runMigrations, type AppContainer } from '../../../src/service-provider/index.js';

let app: FastifyInstance;
let container: AppContainer;

beforeEach(async () => {
  container = createContainer(loadConfig({ DB_DRIVER: 'sqlite', DB_FILENAME: ':memory:' }, { rootDir: '/tmp/kb-test' }));
  await runMigrations(container);
  app = await buildApp({ container });
});

afterEach(async () => {
  await app.close();
  await container.get('db').close().catch(() => undefined);
});

describe('healthcheck', () => {
  it.each(['/healthcheck', '/healthcheck.php'])('%s reports OK', async (url) => {
    const res = await app.inject({ method: 'GET', url });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 200, message: 'Database connection is OK' });
  });

  it('returns 503 when the database is closed', async () => {
    await container.get('db').close();
    const res = await app.inject({ method: 'GET', url: '/healthcheck' });
    expect(res.statusCode).toBe(503);
    const body = res.json<{ status: number; message: string }>();
    expect(body.status).toBe(503);
    expect(body.message.length).toBeGreaterThan(0);
  });
});

describe('home page', () => {
  it('shows the settings, escaped', async () => {
    await container.get('settingModel').save({ application_url: 'http://x/"><script>alert(1)</script>' });
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('application_language');
    expect(res.body).toContain('application_timezone');
    expect(res.body).not.toContain('<script>alert(1)</script>');
    expect(res.body).toContain('&lt;script&gt;');
  });

  it('is reachable through controller/action parameters', async () => {
    const res = await app.inject({ method: 'GET', url: '/?controller=DashboardController&action=show' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Application settings');
  });
});

describe('routing', () => {
  it('returns 404 for unknown pages', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope/nothing' });
    expect(res.statusCode).toBe(404);
    const unknown = await app.inject({ method: 'GET', url: '/?controller=Ghost&action=boo' });
    expect(unknown.statusCode).toBe(404);
  });

  it('returns 404 for unsupported methods on unknown paths', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/whatever' });
    expect(res.statusCode).toBe(404);
  });

  it('answers the JSON-RPC stub with method-not-found', async () => {
    const res = await app.inject({ method: 'POST', url: '/jsonrpc.php', payload: { jsonrpc: '2.0', method: 'getVersion', id: 7 } });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ jsonrpc: string; error: { code: number }; id: number }>();
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error.code).toBe(-32601);
    expect(body.id).toBe(7);
  });

  it('answers malformed JSON on /jsonrpc.php with a JSON-RPC parse error', async () => {
    const res = await app.inject({ method: 'POST', url: '/jsonrpc.php', headers: { 'content-type': 'application/json' }, payload: 'garbage' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ error: { code: number }; id: unknown }>();
    expect(body.error.code).toBe(-32700);
    expect(body.id).toBeNull();
  });

  it('parses urlencoded form bodies and cookies', async () => {
    container.get('router').register('FormController', 'echo', ({ request, response }) => {
      response.json({ a: request.getRawFormValues()['a'], cookie: request.getCookie('sid') });
    });
    const res = await app.inject({
      method: 'POST',
      url: '/?controller=FormController&action=echo',
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: 'sid=abc' },
      payload: 'a=hello+world&b=2',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ a: 'hello world', cookie: 'abc' });
  });

  it('exposes the container on the app', () => {
    expect(app.container).toBe(container);
  });
});
