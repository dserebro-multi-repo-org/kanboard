import type { Container } from '../core/container/container.js';
import { arrayColumn } from '../foundation/array-helpers.js';
import { TABLES } from '../foundation/model-constants.js';
import { SWIMLANE_ACTIVE } from '../foundation/formatter-collaborators.js';
import type { Row } from '../foundation/model.js';
import { BaseFormatter } from './base-formatter.js';

/** Board Formatter (port of `Kanboard\Formatter\BoardFormatter`). */
export class BoardFormatter extends BaseFormatter {
  protected projectId = 0;

  constructor(container: Container) {
    super(container);
  }

  withProjectId(projectId: number): this {
    this.projectId = projectId;
    return this;
  }

  /** Apply the formatter: swimlanes, columns and tasks of the board. */
  async format(): Promise<Row[]> {
    const project = await this.collaborator('projectModel').getById(this.projectId);
    const swimlanes = await this.collaborator('swimlaneModel').getAllByStatus(this.projectId, SWIMLANE_ACTIVE);
    const columns = await this.collaborator('columnModel').getAllWithOpenedTaskCount(this.projectId);
    const taskCount: Record<string | number, Record<string | number, number>> = {};

    if (project['per_swimlane_task_limits']) {
      for (const row of await this.collaborator('taskModel').getOpenTaskCountBySwimlaneAndColumn(this.projectId)) {
        (taskCount[row['swimlane_id'] as number] ??= {})[row['column_id'] as number] = row['nb_open_tasks'] as number;
      }
    }

    if (swimlanes.length === 0 || columns.length === 0) {
      return [];
    }

    const query = this.requiredQuery;
    this.service('hook').reference('formatter:board:query', query);

    const tasks = await this.findRows(
      query.eq(`${TABLES.TASK}.project_id`, this.projectId).asc(`${TABLES.TASK}.position`),
    );
    const tags = await this.collaborator('taskTagModel').getTagsByTaskIds(arrayColumn<number>(tasks, 'id'));

    return this.service('boardSwimlaneFormatter')
      .withSwimlanes(swimlanes)
      .withColumns(columns)
      .withTasks(tasks)
      .withTags(tags)
      .withTaskCountBySwimlaneAndColumn(taskCount)
      .format();
  }
}
