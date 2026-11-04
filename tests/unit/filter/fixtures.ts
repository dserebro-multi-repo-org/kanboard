import type { Database } from '../../../src/db/database.js';
import { migrate } from '../../../src/db/migrate.js';
import type { Table } from '../../../src/db/table.js';
import type { SqlValue } from '../../../src/db/types.js';
import type { ColorModelLike, DateParserLike } from '../../../src/foundation/filter-collaborators.js';
import { strtotime } from '../../../src/foundation/php-time.js';
import { memoryDb } from '../db/helpers.js';

/** In-memory SQLite database with the full Kanboard schema (the default `admin` user has id 1). */
export async function createDb(): Promise<Database> {
  const db = memoryDb();
  await migrate(db);
  return db;
}

export const now = (): number => Math.floor(Date.now() / 1000);

/** Create a project with its default column, return its id (`ProjectModel::create`). */
export async function addProject(db: Database, name: string): Promise<number> {
  const id = await db.table('projects').insertAndGetId({ name, is_active: 1 });
  if (id === false) throw new Error('cannot create project');
  await db.table('columns').insert({ title: 'Backlog', position: 1, project_id: id });
  await db.table('swimlanes').insert({ name: 'Default swimlane', position: 1, is_active: 1, project_id: id });
  return id;
}

export async function addUser(db: Database, username: string, name: string): Promise<number> {
  const id = await db.table('users').insertAndGetId({ username, name });
  if (id === false) throw new Error('cannot create user');
  return id;
}

/** Insert a task (`TaskCreationModel::create`), return its id. */
export async function addTask(db: Database, values: Record<string, SqlValue> & { title: string; project_id: number }): Promise<number> {
  const column = await db.table('columns').eq('project_id', values.project_id).findOneColumn<number>('id');
  const swimlane = await db.table('swimlanes').eq('project_id', values.project_id).findOneColumn<number>('id');
  const id = await db.table('tasks').insertAndGetId({
    color_id: 'yellow',
    column_id: column ?? 0,
    owner_id: 0,
    creator_id: 0,
    position: 1,
    is_active: 1,
    date_creation: now(),
    date_modification: now(),
    date_moved: now(),
    swimlane_id: swimlane ?? 0,
    ...values,
  });
  if (id === false) throw new Error('cannot create task');
  return id;
}

export async function addComment(db: Database, taskId: number, userId: number, comment: string): Promise<number> {
  const id = await db.table('comments').insertAndGetId({ task_id: taskId, user_id: userId, comment, date_creation: now(), date_modification: now() });
  if (id === false) throw new Error('cannot create comment');
  return id;
}

/** `ProjectActivityModel::createEvent` */
export async function addEvent(db: Database, projectId: number, taskId: number, creatorId: number): Promise<void> {
  await db.table('project_activities').insert({ date_creation: now(), event_name: 'task.create', creator_id: creatorId, project_id: projectId, task_id: taskId, data: '{}' });
}

/** `TaskFinderModel::getExtendedQuery()` */
export function extendedQuery(db: Database): Table {
  return db
    .table('tasks')
    .columns(
      '(SELECT COUNT(*) FROM comments WHERE task_id=tasks.id) AS nb_comments',
      '(SELECT COUNT(*) FROM task_has_files WHERE task_id=tasks.id) AS nb_files',
      '(SELECT COUNT(*) FROM subtasks WHERE subtasks.task_id=tasks.id) AS nb_subtasks',
      '(SELECT COUNT(*) FROM subtasks WHERE subtasks.task_id=tasks.id AND status=2) AS nb_completed_subtasks',
      '(SELECT COUNT(*) FROM task_has_links WHERE task_has_links.task_id = tasks.id) AS nb_links',
      '(SELECT COUNT(*) FROM task_has_external_links WHERE task_has_external_links.task_id = tasks.id) AS nb_external_links',
      "(SELECT DISTINCT 1 FROM task_has_links tl JOIN links l ON tl.link_id = l.id WHERE tl.task_id = tasks.id AND l.label = 'is a milestone of') AS is_milestone",
      ...['id', 'reference', 'title', 'description', 'date_creation', 'date_modification', 'date_completed', 'date_started', 'date_due', 'color_id', 'project_id', 'column_id', 'swimlane_id', 'owner_id', 'creator_id', 'position', 'is_active', 'score', 'category_id', 'priority', 'date_moved'].map((c) => `tasks.${c}`),
      'users.username AS assignee_username',
      'users.name AS assignee_name',
      'project_has_categories.name AS category_name',
      'columns.title AS column_name',
      'swimlanes.name AS swimlane_name',
      'projects.name AS project_name',
    )
    .join('users', 'id', 'owner_id', 'tasks')
    .left('users', 'uc', 'id', 'tasks', 'creator_id')
    .join('project_has_categories', 'id', 'category_id', 'tasks')
    .join('columns', 'id', 'column_id', 'tasks')
    .join('swimlanes', 'id', 'swimlane_id', 'tasks')
    .join('projects', 'id', 'project_id', 'tasks');
}

/** `ProjectActivityModel::getQuery()` */
export function activityQuery(db: Database): Table {
  return db
    .table('project_activities')
    .columns('project_activities.*', 'uc.username AS author_username', 'uc.name AS author_name', 'uc.email', 'uc.avatar_path')
    .join('tasks', 'id', 'task_id')
    .join('projects', 'id', 'project_id')
    .left('users', 'uc', 'id', 'project_activities', 'creator_id');
}

function removeTime(timestamp: number): number {
  const d = new Date(timestamp * 1000);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 1000);
}

/** Behaves like `Core\DateParser` for the formats the filters use (the real class is migrated separately). */
export const dateParser: DateParserLike = {
  getTimestampFromIsoFormat: (value) => removeTime(/^\d+$/.test(value) ? Number(value) : Number(strtotime(value))),
  getTimestamp: (value) => (/^\d+$/.test(value) ? Number(value) : Number(strtotime(value))),
};

export const colorModel: ColorModelLike = {
  find: (color) => color.toLowerCase().replace(' ', '_'),
};

export function ymd(date: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}
