import type { HelperRegistry } from '../../foundation/helper.js';
import type { BoardHelper } from '../../helper/board-helper.js';
import type { UserHelper } from '../../helper/user-helper.js';

/** Pre-resolved variables of `project_header/dropdown.njk` (and `project_header/header.njk`). */
export interface ProjectHeaderVars {
  /** `board.isCollapsed(project.id)` (false unless `boardView`). */
  board_collapsed: boolean;
  /** `user.hasProjectAccess(controller, action, project.id)` for every entry of the dropdown. */
  project_access: {
    task_creation: boolean;
    custom_filter: boolean;
    analytic: boolean;
    export: boolean;
    task_import: boolean;
    project_view: boolean;
  };
}

export async function prepareProjectHeaderVars(
  helpers: HelperRegistry,
  project: { id: unknown },
  boardView: boolean,
): Promise<ProjectHeaderVars> {
  const user = helpers.get<UserHelper>('user');
  const id = project.id;
  return {
    board_collapsed: boardView ? await helpers.get<BoardHelper>('board').isCollapsed(id) : false,
    project_access: {
      task_creation: await user.hasProjectAccess('TaskCreationController', 'show', id),
      custom_filter: await user.hasProjectAccess('CustomFilterController', 'index', id),
      analytic: await user.hasProjectAccess('AnalyticController', 'taskDistribution', id),
      export: await user.hasProjectAccess('ExportController', 'tasks', id),
      task_import: await user.hasProjectAccess('TaskImportController', 'tasks', id),
      project_view: await user.hasProjectAccess('ProjectViewController', 'show', id),
    },
  };
}
