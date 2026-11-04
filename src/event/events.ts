/**
 * Event name constants, ported from the `EVENT_*` class constants of `app/Model/*Model.php`
 * and a few `app/Core` classes.
 */

export const TaskEvents = {
  MOVE_PROJECT: 'task.move.project',
  MOVE_COLUMN: 'task.move.column',
  MOVE_POSITION: 'task.move.position',
  MOVE_SWIMLANE: 'task.move.swimlane',
  UPDATE: 'task.update',
  CREATE: 'task.create',
  CLOSE: 'task.close',
  OPEN: 'task.open',
  CREATE_UPDATE: 'task.create_update',
  ASSIGNEE_CHANGE: 'task.assignee_change',
  OVERDUE: 'task.overdue',
  USER_MENTION: 'task.user.mention',
  DAILY_CRONJOB: 'task.cronjob.daily',
} as const;

export const SubtaskEvents = {
  UPDATE: 'subtask.update',
  CREATE: 'subtask.create',
  DELETE: 'subtask.delete',
  CREATE_UPDATE: 'subtask.create_update',
} as const;

export const CommentEvents = {
  UPDATE: 'comment.update',
  CREATE: 'comment.create',
  DELETE: 'comment.delete',
  USER_MENTION: 'comment.user.mention',
} as const;

export const TaskFileEvents = {
  CREATE: 'task.file.create',
  DESTROY: 'task.file.destroy',
} as const;

export const ProjectFileEvents = {
  CREATE: 'project.file.create',
  DESTROY: 'project.file.destroy',
} as const;

export const TaskLinkEvents = {
  CREATE_UPDATE: 'task_internal_link.create_update',
  DELETE: 'task_internal_link.delete',
} as const;

export const AuthEvents = {
  SUCCESS: 'auth.success',
  FAILURE: 'auth.failure',
} as const;

export const SessionEvents = {
  DESTROY: 'session.destroy',
} as const;

export const UserProfileEvents = {
  AFTER_SYNC: 'user_profile.after.sync',
} as const;

export const AppEvents = {
  BOOTSTRAP: 'app.bootstrap',
} as const;

/** Union of every well-known event name. */
export type KnownEventName =
  | (typeof TaskEvents)[keyof typeof TaskEvents]
  | (typeof SubtaskEvents)[keyof typeof SubtaskEvents]
  | (typeof CommentEvents)[keyof typeof CommentEvents]
  | (typeof TaskFileEvents)[keyof typeof TaskFileEvents]
  | (typeof ProjectFileEvents)[keyof typeof ProjectFileEvents]
  | (typeof TaskLinkEvents)[keyof typeof TaskLinkEvents]
  | (typeof AuthEvents)[keyof typeof AuthEvents]
  | (typeof SessionEvents)[keyof typeof SessionEvents]
  | (typeof UserProfileEvents)[keyof typeof UserProfileEvents]
  | (typeof AppEvents)[keyof typeof AppEvents];
