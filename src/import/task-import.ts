import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import { Csv } from '../core/csv.js';
import { getDateParser, type DateParser } from '../core/date-parser.js';
import {
  e,
  explodeCsvField,
  EXTERNAL_LINK_TYPE_AUTO,
  ExternalLinkProviderNotFound,
  type CategoryImportModelLike,
  type ColorModelLike,
  type ColumnImportModelLike,
  type ExternalLinkManagerLike,
  type ExternalLinkValidatorLike,
  type ModelHelperLike,
  type SwimlaneImportModelLike,
  type TaskCreationModelLike,
  type TaskExternalLinkModelLike,
  type TaskTagModelLike,
  type UserImportModelLike,
} from '../foundation/export-import-collaborators.js';
import { t } from '../foundation/translator.js';
import { Validator, Validators } from '../validator/simple-validator.js';
import { isEmpty, removeEmptyFields, toFloat, toInt } from './php-cast.js';

type Row = Record<string, unknown>;

/** Task CSV import (port of `app/Import/TaskImport.php`). */
export class TaskImport extends Base {
  protected nbImportedTasks = 0;
  protected projectId = 0;
  protected readonly dateParser: DateParser;

  constructor(container: Container) {
    super(container);
    this.dateParser = getDateParser(container);
  }

  /** Set project id. */
  setProjectId(projectId: number): this {
    this.projectId = projectId;
    return this;
  }

  /** Number of successfully imported tasks. */
  getNumberOfImportedTasks(): number {
    return this.nbImportedTasks;
  }

  /** Get mapping between CSV and SQL columns. */
  getColumnMapping(): Record<string, string> {
    return {
      reference: e('Reference'),
      title: e('Title'),
      description: e('Description'),
      assignee: e('Assignee Username'),
      creator: e('Creator Username'),
      color: e('Color Name'),
      column: e('Column Name'),
      category: e('Category Name'),
      swimlane: e('Swimlane Name'),
      score: e('Complexity'),
      time_estimated: e('Time Estimated'),
      time_spent: e('Time Spent'),
      date_started: e('Start Date'),
      date_due: e('Due Date'),
      priority: e('Priority'),
      is_active: e('Status'),
      tags: e('Tags'),
      external_link: e('External Link'),
    };
  }

  /** Import a single row. */
  async importTask(row: Row, lineNumber: number): Promise<void> {
    const logger = this.service('logger');
    const method = 'Kanboard\\Import\\TaskImport::importTask';
    const task = await this.prepareTask(row);

    if (await this.validateCreation(task)) {
      const taskId = await this.dep<TaskCreationModelLike>('taskCreationModel').create(task);

      if (taskId !== false && taskId > 0) {
        logger.debug(`${method}: imported successfully line ${lineNumber}`);
        this.nbImportedTasks++;

        if (!isEmpty(row.tags)) {
          await this.dep<TaskTagModelLike>('taskTagModel').save(this.projectId, taskId, explodeCsvField(row.tags as string));
        }

        if (!isEmpty(row.external_link)) {
          await this.createExternalLink(taskId, row.external_link as string);
        }
      } else {
        logger.error(`${method}: creation error at line ${lineNumber}`);
      }
    } else {
      logger.error(`${method}: validation error at line ${lineNumber}`);
    }
  }

  /** Read a CSV file and import its tasks (the PHP controller wires Csv and importTask). */
  async importFile(filename: string, delimiter = ',', enclosure = '"'): Promise<this> {
    const csv = new Csv(delimiter, enclosure);
    csv.setColumnMapping(this.getColumnMapping());
    await csv.read(filename, (row, line) => this.importTask(row, line));
    return this;
  }

  /** Format row before validation. */
  async prepareTask(row: Row): Promise<Row> {
    const values: Row = {};
    values.project_id = this.projectId;
    values.reference = row.reference;
    values.title = row.title;
    values.description = row.description;
    values.is_active = Csv.getBooleanValue(row.is_active) === 1 ? 0 : 1;
    values.score = toInt(row.score);
    values.priority = toInt(row.priority);
    values.time_estimated = toFloat(row.time_estimated);
    values.time_spent = toFloat(row.time_spent);

    if (!isEmpty(row.assignee)) {
      values.owner_id = await this.dep<UserImportModelLike>('userModel').getIdByUsername(row.assignee as string);
    }

    if (!isEmpty(row.creator)) {
      values.creator_id = await this.dep<UserImportModelLike>('userModel').getIdByUsername(row.creator as string);
    }

    if (!isEmpty(row.color)) {
      values.color_id = await this.dep<ColorModelLike>('colorModel').find(row.color as string);
    }

    if (!isEmpty(row.column)) {
      values.column_id = await this.dep<ColumnImportModelLike>('columnModel').getColumnIdByTitle(this.projectId, row.column as string);
    }

    if (!isEmpty(row.category)) {
      values.category_id = await this.dep<CategoryImportModelLike>('categoryModel').getIdByName(this.projectId, row.category as string);
    }

    if (!isEmpty(row.swimlane)) {
      values.swimlane_id = await this.dep<SwimlaneImportModelLike>('swimlaneModel').getIdByName(this.projectId, row.swimlane as string);
    }

    if (!isEmpty(row.date_due)) {
      values.date_due = await this.dateParser.getTimestamp(row.date_due);
    }

    if (!isEmpty(row.date_started)) {
      values.date_started = await this.dateParser.getTimestamp(row.date_started);
    }

    this.removeEmpty(values, ['owner_id', 'creator_id', 'color_id', 'column_id', 'category_id', 'swimlane_id', 'date_due', 'date_started', 'priority']);

    return values;
  }

  /** Validate task creation. */
  protected async validateCreation(values: Row): Promise<boolean> {
    const validator = new Validator(values, [
      new Validators.Integer('project_id', t('This value must be an integer')),
      new Validators.Required('project_id', t('The project is required')),
      new Validators.Required('title', t('The title is required')),
      new Validators.MaxLength('title', t('The maximum length is %d characters', 65535), 65535),
      new Validators.MaxLength('reference', t('The maximum length is %d characters', 255), 255),
    ]);

    return validator.execute();
  }

  /** Create an external link attached to the task. */
  protected async createExternalLink(taskId: number, externalLink: string): Promise<void> {
    const logger = this.service('logger');
    const method = 'Kanboard\\Import\\TaskImport::createExternalLink';

    try {
      const provider = await this.dep<ExternalLinkManagerLike>('externalLinkManager')
        .setUserInputText(externalLink)
        .setUserInputType(EXTERNAL_LINK_TYPE_AUTO)
        .find();

      const link = provider.getLink();
      const dependencies = provider.getDependencies();
      const values: Row = {
        task_id: taskId,
        title: link.getTitle() || link.getUrl(),
        url: link.getUrl(),
        link_type: provider.getType(),
        dependency: Object.keys(dependencies)[0] ?? null,
      };

      const [valid, errors] = await this.dep<ExternalLinkValidatorLike>('externalLinkValidator').validateCreation(values);

      if (valid) {
        await this.dep<TaskExternalLinkModelLike>('taskExternalLinkModel').create(values);
      } else {
        logger.error(`${method}: ${JSON.stringify(errors)}`);
      }
    } catch (error) {
      if (error instanceof ExternalLinkProviderNotFound) {
        logger.error(`${method}: ${error.message}`);
        return;
      }
      throw error;
    }
  }

  private removeEmpty(values: Row, fields: string[]): void {
    const helper = this.dep<{ has(name: string): boolean; get<H>(name: string): H }>('helper');
    if (helper.has('model')) {
      helper.get<ModelHelperLike>('model').removeEmptyFields(values, fields);
    } else {
      removeEmptyFields(values, fields);
    }
  }

  protected dep<T>(name: string): T {
    return (this.container as unknown as Container<Record<string, unknown>>).get(name) as T;
  }
}
