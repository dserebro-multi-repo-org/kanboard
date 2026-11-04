import type { HelperRegistry } from '../../foundation/helper.js';
import type { DateHelper } from '../../helper/date-helper.js';

/**
 * Pre-resolve the async helper results needed by `src/views/event/*.njk`
 * (Nunjucks cannot await inside expressions).
 *
 * Adds `date_creation_formatted` = `dt.datetime(date_creation)` (PHP `$this->dt->datetime($date_creation)`),
 * used by every activity template that prints the event date. Templates not using it (`event/events`) ignore it.
 */
export async function prepareEventVars(
  helpers: HelperRegistry,
  vars: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...vars };
  if (vars['date_creation'] !== undefined && vars['date_creation'] !== null) {
    out['date_creation_formatted'] = await helpers.get<DateHelper>('dt').datetime(Number(vars['date_creation']));
  }
  return out;
}
