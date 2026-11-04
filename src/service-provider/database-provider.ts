import type { Container, ServiceProvider } from '../core/container/container.js';
import { registerDatabaseService } from '../db/register.js';
import { migrate, type MigrationResult } from '../db/migrate.js';
import { ConfigModel } from '../model/config-model.js';
import { SettingModel } from '../model/setting-model.js';
import './registry.js';

/**
 * Registers the database (`db`) and the models of the foundation (`settingModel`, `configModel`),
 * counterpart of `app/ServiceProvider/DatabaseProvider.php` and the model part of `ClassProvider`.
 * The connection is opened lazily; run {@link runMigrations} at startup (the PHP provider does it
 * while registering, which cannot be asynchronous here).
 */
export class DatabaseServiceProvider implements ServiceProvider {
  register(container: Container): void {
    registerDatabaseService(container);
    container.register('settingModel', (c) => new SettingModel(c));
    container.register('configModel', (c) => new ConfigModel(c));
  }
}

/** Execute the pending schema migrations when `DB_RUN_MIGRATIONS` is enabled. */
export async function runMigrations(container: Container): Promise<MigrationResult | null> {
  if (!container.get('config').DB_RUN_MIGRATIONS) {
    return null;
  }

  return migrate(container.get('db'));
}
