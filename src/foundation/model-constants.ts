/**
 * Table names and status constants of the models that are not migrated yet. Filters (M6) refer to
 * them the way PHP code refers to `TaskModel::TABLE`, `TaskModel::STATUS_OPEN`, ... Each model
 * owns its constants once migrated; they are re-pointed here in M15 when the stubs are removed.
 */
export const TABLES = {
  PROJECT_ACTIVITY: 'project_activities',
  PROJECT: 'projects',
  PROJECT_GROUP_ROLE: 'project_has_groups',
  PROJECT_USER_ROLE: 'project_has_users',
  TASK: 'tasks',
  COMMENT: 'comments',
  CATEGORY: 'project_has_categories',
  COLUMN: 'columns',
  LINK: 'links',
  TASK_LINK: 'task_has_links',
  SUBTASK: 'subtasks',
  SWIMLANE: 'swimlanes',
  TAG: 'tags',
  TASK_TAG: 'task_has_tags',
  GROUP_MEMBER: 'group_has_users',
  USER: 'users',
} as const;

/** `TaskModel::STATUS_*` */
export const TASK_STATUS_OPEN = 1;
export const TASK_STATUS_CLOSED = 0;

/** `ProjectModel::TYPE_*` */
export const PROJECT_TYPE_PRIVATE = 1;
export const PROJECT_TYPE_TEAM = 0;

/** `SubtaskModel::STATUS_*` */
export const SUBTASK_STATUS_TODO = 0;
export const SUBTASK_STATUS_INPROGRESS = 1;
export const SUBTASK_STATUS_DONE = 2;
