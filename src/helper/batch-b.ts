import type { HelperRegistry } from '../foundation/helper.js';
import { AvatarHelper } from './avatar-helper.js';
import { BoardHelper } from './board-helper.js';
import { CommentHelper } from './comment-helper.js';
import { DateHelper } from './date-helper.js';
import { ProjectActivityHelper } from './project-activity-helper.js';
import { ProjectHeaderHelper } from './project-header-helper.js';
import { ProjectRoleHelper } from './project-role-helper.js';
import { SubtaskHelper } from './subtask-helper.js';
import { TaskHelper } from './task-helper.js';
import { UserHelper } from './user-helper.js';

/** Register the batch B helpers under the names used by `app/ServiceProvider/HelperProvider.php`. */
export function registerBatchBHelpers(registry: HelperRegistry): HelperRegistry {
  return registry
    .register('avatar', AvatarHelper)
    .register('board', BoardHelper)
    .register('comment', CommentHelper)
    .register('dt', DateHelper)
    .register('projectActivity', ProjectActivityHelper)
    .register('projectHeader', ProjectHeaderHelper)
    .register('projectRole', ProjectRoleHelper)
    .register('subtask', SubtaskHelper)
    .register('task', TaskHelper)
    .register('user', UserHelper);
}

export { AvatarHelper, BoardHelper, CommentHelper, DateHelper, ProjectActivityHelper, ProjectHeaderHelper, ProjectRoleHelper, SubtaskHelper, TaskHelper, UserHelper };
