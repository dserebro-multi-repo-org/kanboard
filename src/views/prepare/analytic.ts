import type { HelperRegistry } from '../../foundation/helper.js';
import type { ProjectHeaderHelper } from '../../helper/project-header-helper.js';
import type { ViewVars } from './notification.js';

/**
 * Vars of `analytic/layout`: `project_header` is the pre-resolved (async) `projectHeader.render(project,
 * 'TaskListController', 'show')`, only needed (and only computed) when the request is not ajax.
 */
export async function prepareAnalyticLayoutVars(helpers: HelperRegistry, vars: ViewVars): Promise<ViewVars> {
  if (vars['is_ajax']) return { ...vars, project_header: '' };
  const header = await helpers
    .get<ProjectHeaderHelper>('projectHeader')
    .render(vars['project'] as Record<string, unknown>, 'TaskListController', 'show');
  return { ...vars, project_header: header };
}
