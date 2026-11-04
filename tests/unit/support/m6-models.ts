import type { Database } from '../../../src/db/database.js';
import type { FilterQuery } from '../../../src/core/filter/filter-interface.js';
import type { Row } from '../../../src/foundation/model.js';
import type { LooseContainer } from './m6-container.js';

/** Request double backed by a plain object. */
export function fakeRequest(params: Record<string, string | number> = {}) {
  return {
    getStringParam: (name: string, defaultValue = ''): string => (params[name] !== undefined ? String(params[name]) : defaultValue),
    getIntegerParam: (name: string, defaultValue = 0): number => {
      const value = params[name];
      return value !== undefined && /^\d+$/.test(String(value)) ? Number(value) : defaultValue;
    },
  };
}

async function all(db: Database, sql: string, values: unknown[] = []): Promise<Row[]> {
  return (await db.exec(sql, values)).rows as Row[];
}

/**
 * Register minimal, database backed implementations of the not yet migrated models
 * (project, swimlane, column, task, tag, subtask, user...) under their PHP container keys.
 */
export function installModels(container: LooseContainer, db: Database): void {
  const extendedQuery = (): FilterQuery =>
    db
      .table('tasks')
      .select('tasks.*, projects.name AS project_name')
      .join('projects', 'id', 'project_id') as unknown as FilterQuery;

  container.set('projectModel', {
    getById: async (id: number) => (await db.table('projects').eq('id', id).findOne()) as Row,
    getQueryColumnStats: (ids: number[]) =>
      (ids.length === 0 ? db.table('projects').addCondition('1 = 0') : db.table('projects').in('id', ids)) as unknown as FilterQuery,
  });

  container.set('swimlaneModel', {
    getAllByStatus: async (projectId: number, status: number) =>
      (await db.table('swimlanes').eq('project_id', projectId).eq('is_active', status).asc('position').findAll()) as Row[],
  });

  container.set('columnModel', {
    getAllWithOpenedTaskCount: async (projectId: number) => {
      const columns = (await db.table('columns').eq('project_id', projectId).asc('position').findAll()) as Row[];
      for (const column of columns) {
        column['nb_open_tasks'] = await db.table('tasks').eq('column_id', column['id'] as number).eq('is_active', 1).count();
        column['nb_closed_tasks'] = await db.table('tasks').eq('column_id', column['id'] as number).eq('is_active', 0).count();
      }
      return columns;
    },
    getAll: async (projectId: number) => (await db.table('columns').eq('project_id', projectId).asc('position').findAll()) as Row[],
    getList: async (projectId: number) => {
      const list: Record<number, string> = {};
      for (const row of (await db.table('columns').eq('project_id', projectId).asc('position').findAll()) as Row[]) {
        list[row['id'] as number] = row['title'] as string;
      }
      return list;
    },
  });

  container.set('taskModel', {
    getOpenTaskCountBySwimlaneAndColumn: (projectId: number) =>
      all(
        db,
        'SELECT swimlane_id, column_id, COUNT(*) AS nb_open_tasks FROM tasks WHERE project_id=? AND is_active=1 GROUP BY swimlane_id, column_id',
        [projectId],
      ),
  });

  container.set('taskFinderModel', {
    getExtendedQuery: extendedQuery,
    getUserQuery: (userId: number) =>
      extendedQuery()
        .addCondition(
          '(tasks.owner_id = ? OR tasks.id IN (SELECT task_id FROM subtasks WHERE user_id = ? AND status < 2))',
          userId,
          userId,
        )
        .addCondition('tasks.column_id IN (SELECT id FROM columns WHERE hide_in_dashboard = 0)')
        .eq('tasks.is_active', 1),
    getAll: async (projectId: number) => (await db.table('tasks').eq('project_id', projectId).eq('is_active', 1).findAll()) as Row[],
    countByColumnId: (projectId: number, columnId: number) =>
      db.table('tasks').eq('project_id', projectId).eq('column_id', columnId).eq('is_active', 1).count(),
  });

  container.set('taskTagModel', {
    getTagsByTaskIds: async (taskIds: number[]) => {
      const result: Record<number, Row[]> = {};
      if (taskIds.length === 0) return result;
      const rows = await all(
        db,
        `SELECT tags.id, tags.name, task_has_tags.task_id, tags.color_id FROM task_has_tags JOIN tags ON tags.id=task_has_tags.tag_id WHERE task_has_tags.task_id IN (${taskIds.map(() => '?').join(',')}) ORDER BY tags.id`,
        taskIds,
      );
      for (const row of rows) {
        (result[row['task_id'] as number] ??= []).push(row);
      }
      return result;
    },
  });

  container.set('subtaskModel', {
    getStatusList: () => ({ 0: 'Todo', 1: 'In progress', 2: 'Done' }),
    getAllByTaskIds: (ids: number[]) =>
      ids.length === 0 ? Promise.resolve([]) : all(db, `SELECT * FROM subtasks WHERE task_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ids),
    getAllByTaskIdsAndAssignee: (ids: number[], userId: number) =>
      ids.length === 0
        ? Promise.resolve([])
        : all(db, `SELECT * FROM subtasks WHERE user_id=? AND status < 2 AND task_id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, [userId, ...ids]),
  });

  container.set('userModel', {
    getQuery: () => db.table('users') as unknown as FilterQuery,
    getByUsername: async (username: string) => (await db.table('users').eq('username', username).findOne()) ?? false,
  });

  container.set('projectUserRoleModel', {
    getActiveProjectsByUser: async (userId: number) => {
      const list: Record<number, string> = {};
      for (const row of await all(
        db,
        'SELECT projects.id, projects.name FROM project_has_users JOIN projects ON projects.id=project_has_users.project_id WHERE project_has_users.user_id=? AND projects.is_active=1 ORDER BY projects.name',
        [userId],
      )) {
        list[row['id'] as number] = row['name'] as string;
      }
      return list;
    },
    getAssignableUsersList: async (projectId: number) => {
      const list: Record<number, string> = { 0: 'Unassigned' };
      for (const row of await all(
        db,
        'SELECT users.id, users.username FROM project_has_users JOIN users ON users.id=project_has_users.user_id WHERE project_id=? ORDER BY users.username',
        [projectId],
      )) {
        list[row['id'] as number] = row['username'] as string;
      }
      return list;
    },
  });

  container.set('projectPermissionModel', {
    getActiveProjectIds: async (userId: number) =>
      (
        await all(
          db,
          'SELECT project_id FROM project_has_users JOIN projects ON projects.id=project_id WHERE user_id=? AND projects.is_active=1',
          [userId],
        )
      ).map((row) => row['project_id'] as number),
  });

  container.set('transitionModel', {
    getTimeSpentByTask: async (taskId: number) => {
      const result: Record<number, number> = {};
      for (const row of await all(db, 'SELECT src_column_id, SUM(time_spent) AS t FROM transitions WHERE task_id=? GROUP BY src_column_id', [taskId])) {
        result[row['src_column_id'] as number] = Number(row['t']);
      }
      return result;
    },
  });
}
