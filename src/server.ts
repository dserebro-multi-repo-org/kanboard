import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { buildApp } from './app.js';
import { loadConfig } from './config/index.js';
import { createContainer, runMigrations } from './service-provider/index.js';

async function main(): Promise<void> {
  const config = loadConfig();
  mkdirSync(config.DATA_DIR, { recursive: true });
  if (config.DB_DRIVER === 'sqlite' && config.DB_FILENAME !== ':memory:' && !config.DB_FILENAME.startsWith('file:')) {
    mkdirSync(path.dirname(config.DB_FILENAME), { recursive: true });
  }

  const container = createContainer(config);
  await runMigrations(container);
  const app = await buildApp({ container, logger: true });

  let closing = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    app.log.info(`${signal} received, shutting down`);
    try {
      await app.close();
      await container.get('db').close();
      process.exit(0);
    } catch (error) {
      app.log.error(error);
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.HOST, port: config.PORT });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
