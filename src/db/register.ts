import type { Container } from '../core/container/container.js';
import { Database } from './database.js';

/**
 * Register (or re-register, which drops the cached instance and so reconnects on next use)
 * the lazy `db` service. In debug mode every statement is sent to the logger.
 */
export function registerDatabaseService(container: Container): void {
  container.register('db', (c) => {
    const config = c.get('config');
    const db = Database.connect(config);

    if (config.DEBUG) {
      const logger = c.get('logger');
      db.withLogging((entry) => logger.debug(`${entry.sql} [${entry.durationMs.toFixed(2)}ms]`));
    }

    return db;
  });
}
