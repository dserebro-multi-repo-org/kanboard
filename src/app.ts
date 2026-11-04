import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import Fastify, { type FastifyInstance } from 'fastify';
import { loadConfig, type AppConfig } from './config/index.js';
import { errorHandler, registerRoutes } from './core/controller/router-plugin.js';
import { createContainer, type AppContainer } from './service-provider/index.js';

export interface BuildAppOptions {
  /** Configuration (default: `loadConfig()` from the environment). Ignored when `container` is given. */
  config?: AppConfig;
  /** Pre-built container (tests); migrations must already have been run by the caller. */
  container?: AppContainer;
  /** Enable Fastify request logging. */
  logger?: boolean;
}

/** Fastify 5 application factory. Does not listen, does not run migrations. */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const container = options.container ?? createContainer(options.config ?? loadConfig());

  // trustProxy stays off: forwarded headers are handled by the framework Request helper.
  const app = Fastify({ logger: options.logger ?? false, trustProxy: false });
  app.decorate('container', container);
  app.decorateRequest('container', null as unknown as AppContainer);
  app.addHook('onRequest', async (req) => {
    req.container = container;
  });

  await app.register(formbody);
  await app.register(cookie);
  errorHandler(app);
  registerRoutes(app, container);
  return app;
}
