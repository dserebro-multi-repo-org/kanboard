import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Request, type HttpRequestLike } from '../http/request.js';
import { Response } from '../http/response.js';
import type { AppContainer } from '../../service-provider/index.js';
import { checkHealth } from '../../controller/healthcheck-controller.js';
import { renderHome } from '../../controller/home-controller.js';
import { AccessForbiddenException, PageNotFoundException } from './exceptions.js';

declare module 'fastify' {
  interface FastifyInstance {
    container: AppContainer;
  }
  interface FastifyRequest {
    container: AppContainer;
  }
}

/** Adapt a Fastify request to the framework {@link Request} (Fastify `trustProxy` must stay off). */
// TODO: pass a session-backed `csrfValidator` once the Security/Token CSRF store is ported.
export function createRequest(req: FastifyRequest, container: AppContainer): Request {
  const config = container.get('config');
  const like: HttpRequestLike = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    ip: req.ip,
    query: req.query,
    body: req.body,
    cookies: req.cookies,
    protocol: req.protocol,
  };
  return new Request(like, {
    reverseProxyUserHeader: config.REVERSE_PROXY_USER_HEADER,
    reverseProxyEmailHeader: config.REVERSE_PROXY_EMAIL_HEADER,
    reverseProxyFullnameHeader: config.REVERSE_PROXY_FULLNAME_HEADER,
  });
}

/** Adapt a Fastify reply to the framework {@link Response}. */
export function createResponse(reply: FastifyReply, request: Request): Response {
  return new Response(reply, { request });
}

/** Register the built-in handlers on the router (controller/action style). */
function registerHandlers(container: AppContainer): void {
  const router = container.get('router');
  router.register('DashboardController', 'show', async ({ response }) => {
    response.html(await renderHome(container));
  });
  router.register('HealthcheckController', 'status', async ({ response }) => {
    const result = await checkHealth(container);
    response.json(result, result.status);
  });
}

/**
 * Route registration layer replacing `app/Core/Controller` and `index.php` / `jsonrpc.php`:
 * explicit routes (healthcheck, JSON-RPC stub) plus a catch-all that resolves
 * `?controller=..&action=..` or the URL rewrite table through the {@link Router}.
 */
export function registerRoutes(app: FastifyInstance, container: AppContainer): void {
  registerHandlers(container);
  const router = container.get('router');

  const health = async (_req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const result = await checkHealth(container);
    return reply.code(result.status).send(result);
  };
  app.get('/healthcheck', health);
  app.get('/healthcheck.php', health);

  // JSON-RPC API: implemented in a later milestone.
  app.post('/jsonrpc.php', async (req, reply) => {
    const body = req.body as { id?: unknown } | null;
    const id = body !== null && typeof body === 'object' && !Array.isArray(body) && body.id !== undefined ? body.id : null;
    return reply.code(200).send({ jsonrpc: '2.0', error: { code: -32601, message: 'Method not found: JSON-RPC API is not implemented yet' }, id });
  });

  const dispatch = async (req: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const request = createRequest(req, container);
    const response = createResponse(reply, request);
    const target = router.dispatch(request);
    // The Router falls back to the dashboard for unknown rewrite paths; only the root URL may do so here.
    const path = router.getPath(request);
    const unknownPath = request.getStringParam('controller') === '' && path !== '' && !router.getRoute().hasRoute(path);
    const handler = unknownPath ? undefined : router.getHandler(target);
    if (handler === undefined) {
      throw new PageNotFoundException('Page not found');
    }
    await handler({ request, response });
    if (!response.isResponseAlreadySent()) {
      reply.code(204).send();
    }
    return reply;
  };
  app.route({ method: ['GET', 'POST'], url: '/', handler: dispatch });
  app.route({ method: ['GET', 'POST'], url: '/*', handler: dispatch });
}

/** Map errors to HTTP responses. */
export function errorHandler(app: FastifyInstance): void {
  app.setNotFoundHandler((_req, reply) => reply.code(404).type('text/plain; charset=utf-8').send('Page not found'));
  app.setErrorHandler((error: Error, req, reply) => {
    const code = (error as Error & { code?: string }).code;
    if (req.url.split('?')[0] === '/jsonrpc.php' && code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      return reply.code(200).send({ jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null });
    }
    let status = 500;
    let message = 'Internal Server Error';
    if (error instanceof PageNotFoundException) {
      status = 404;
      message = error.message || 'Page not found';
    } else if (error instanceof AccessForbiddenException) {
      status = 403;
      message = error.message || 'Forbidden';
    } else if ((error as Error & { statusCode?: number }).statusCode !== undefined && (error as Error & { statusCode?: number }).statusCode! < 500) {
      status = (error as Error & { statusCode?: number }).statusCode!;
      message = error.message;
    } else {
      req.log.error(error);
      if (req.container?.get('config').DEBUG) message = error.message;
    }
    return reply.code(status).type('text/plain; charset=utf-8').send(message);
  });
}
