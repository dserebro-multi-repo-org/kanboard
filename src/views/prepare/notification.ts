import type { HelperRegistry } from '../../foundation/helper.js';
import type { AppHelper } from '../../helper/app-helper.js';
import type { DateHelper } from '../../helper/date-helper.js';
import type { UrlHelper } from '../../helper/url-helper.js';

export type ViewVars = Record<string, unknown>;

/**
 * Pre-resolve the async helper results used by every `notification/*` template (Nunjucks cannot await):
 * - `application_url`: `app.config('application_url')`, used by `notification/footer` (and `task_overdue`);
 * - the url helper base URL is loaded so `url.absoluteLink()` can build absolute links.
 */
export async function prepareNotificationVars(helpers: HelperRegistry, vars: ViewVars): Promise<ViewVars> {
  await helpers.get<UrlHelper>('url').loadBase();
  const applicationUrl = await helpers.get<AppHelper>('app').config('application_url');
  return { ...vars, application_url: applicationUrl };
}

/** Vars of `notification/task_create`: adds `date_creation_formatted` and `date_due_formatted` (`dt.datetime`). */
export async function prepareTaskCreateNotificationVars(helpers: HelperRegistry, vars: ViewVars): Promise<ViewVars> {
  const base = await prepareNotificationVars(helpers, vars);
  const task = (vars['task'] ?? {}) as Record<string, unknown>;
  const dt = helpers.get<DateHelper>('dt');
  return {
    ...base,
    date_creation_formatted: await dt.datetime(Number(task['date_creation'])),
    date_due_formatted: task['date_due'] ? await dt.datetime(Number(task['date_due'])) : '',
  };
}

/** Vars of `notification/task_overdue`: every `tasks[]` entry gets `date_due_formatted` (`dt.datetime`). */
export async function prepareTaskOverdueNotificationVars(helpers: HelperRegistry, vars: ViewVars): Promise<ViewVars> {
  const base = await prepareNotificationVars(helpers, vars);
  const dt = helpers.get<DateHelper>('dt');
  const tasks: Record<string, unknown>[] = [];
  for (const task of (vars['tasks'] ?? []) as Record<string, unknown>[]) {
    tasks.push({ ...task, date_due_formatted: await dt.datetime(Number(task['date_due'])) });
  }
  return { ...base, tasks };
}
