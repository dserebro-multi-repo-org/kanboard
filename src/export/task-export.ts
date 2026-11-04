import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import { getDateParser, type DateParser } from '../core/date-parser.js';
import type { DbRow } from '../db/types.js';
import { e, type ColorModelLike, type TaskTagModelLike } from '../foundation/export-import-collaborators.js';
import { TABLES, TASK_STATUS_OPEN } from '../foundation/model-constants.js';
import { toEnd, toStart } from './date-range.js';
import type { ExportRow } from './subtask-export.js';

/** Task export (port of `app/Export/TaskExport.php`). */
export class TaskExport extends Base {
  protected readonly dateParser: DateParser;

  constructor(container: Container) {
    super(container);
    this.dateParser = getDateParser(container);
  }

  /** Get tasks as a CSV compatible array (first row: the columns). */
  async export(projectId: number, from: number | string, to: number | string): Promise<ExportRow[]> {
    const tasks = await this.getTasks(projectId, from, to);
    const taskIds = tasks.map((task) => task.id as number);
    const tags = await this.dep<TaskTagModelLike>('taskTagModel').getTagsByTaskIds(taskIds);
    const colors = await this.dep<ColorModelLike>('colorModel').getList();
    const results: ExportRow[] = [this.getColumns()];

    for (const task of tasks) {
      results.push(Object.values(await this.format(task, colors, tags)) as ExportRow);
    }

    return results;
  }

  /** Fetch tasks and return the prepared query result. */
  protected async getTasks(projectId: number, from: number | string, to: number | string): Promise<DbRow[]> {
    const start = await toStart(this.dateParser, from);
    const end = await toEnd(this.dateParser, to);
    const { TASK, USER, PROJECT, CATEGORY, COLUMN, SWIMLANE } = TABLES;

    return this.service('db')
      .table(TASK)
      .columns(
        `${TASK}.id`,
        `${TASK}.reference`,
        `${PROJECT}.name AS project_name`,
        `${TASK}.is_active`,
        `${CATEGORY}.name AS category_name`,
        `${SWIMLANE}.name AS swimlane_name`,
        `${COLUMN}.title AS column_title`,
        `${TASK}.position`,
        `${TASK}.color_id`,
        `${TASK}.date_due`,
        'uc.username AS creator_username',
        'uc.name AS creator_name',
        `${USER}.username AS assignee_username`,
        `${USER}.name AS assignee_name`,
        `${TASK}.score`,
        `${TASK}.title`,
        `${TASK}.date_creation`,
        `${TASK}.date_modification`,
        `${TASK}.date_completed`,
        `${TASK}.date_started`,
        `${TASK}.time_estimated`,
        `${TASK}.time_spent`,
        `${TASK}.priority`,
      )
      .join(USER, 'id', 'owner_id', TASK)
      .left(USER, 'uc', 'id', TASK, 'creator_id')
      .join(CATEGORY, 'id', 'category_id', TASK)
      .join(COLUMN, 'id', 'column_id', TASK)
      .join(SWIMLANE, 'id', 'swimlane_id', TASK)
      .join(PROJECT, 'id', 'project_id', TASK)
      .gte(`${TASK}.date_creation`, start)
      .lte(`${TASK}.date_creation`, end)
      .eq(`${TASK}.project_id`, projectId)
      .asc(`${TASK}.id`)
      .findAll();
  }

  /** Format the output of a task array. */
  protected async format(
    task: DbRow,
    colors: Record<string, string>,
    tags: Record<string | number, Array<{ name: string }>>,
  ): Promise<DbRow> {
    task.is_active = Number(task.is_active) === TASK_STATUS_OPEN ? e('Open') : e('Closed');
    task.color_id = colors[task.color_id as string];
    task.score = task.score || 0;
    task.tags = '';

    const formatted = this.dateParser.format(
      task,
      ['date_due', 'date_modification', 'date_creation', 'date_started', 'date_completed'],
      await this.dateParser.getUserDateTimeFormat(),
    );

    const taskTags = tags[formatted.id as number];
    if (taskTags !== undefined) {
      formatted.tags = taskTags.map((tag) => tag.name).join(', ');
    }

    return formatted;
  }

  /** Get column titles. */
  protected getColumns(): string[] {
    return [
      e('Task Id'),
      e('Reference'),
      e('Project'),
      e('Status'),
      e('Category'),
      e('Swimlane'),
      e('Column'),
      e('Position'),
      e('Color'),
      e('Due date'),
      e('Creator'),
      e('Creator Name'),
      e('Assignee Username'),
      e('Assignee Name'),
      e('Complexity'),
      e('Title'),
      e('Creation date'),
      e('Modification date'),
      e('Completion date'),
      e('Start date'),
      e('Time estimated'),
      e('Time spent'),
      e('Priority'),
      e('Tags'),
    ];
  }

  protected dep<T>(name: string): T {
    return (this.container as unknown as Container<Record<string, unknown>>).get(name) as T;
  }
}
