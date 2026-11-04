import { CompiledQuery } from 'kysely';
import type { AppContainer } from '../service-provider/index.js';

export interface HealthcheckResult {
  status: number;
  message: string;
}

/** Port of `healthcheck.php`: touches the database with `SELECT 1`. */
export async function checkHealth(container: AppContainer): Promise<HealthcheckResult> {
  try {
    await container.get('db').getConnection().executeQuery(CompiledQuery.raw('SELECT 1'));
    return { status: 200, message: 'Database connection is OK' };
  } catch (error) {
    return { status: 503, message: error instanceof Error ? error.message : String(error) };
  }
}
