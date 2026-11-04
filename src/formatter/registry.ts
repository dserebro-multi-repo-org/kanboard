import type { BoardColumnFormatter } from './board-column-formatter.js';
import type { BoardFormatter } from './board-formatter.js';
import type { BoardSwimlaneFormatter } from './board-swimlane-formatter.js';
import type { BoardTaskFormatter } from './board-task-formatter.js';
import type { GroupAutoCompleteFormatter } from './group-auto-complete-formatter.js';
import type { ProjectActivityEventFormatter } from './project-activity-event-formatter.js';
import type { ProjectApiFormatter } from './project-api-formatter.js';
import type { ProjectsApiFormatter } from './projects-api-formatter.js';
import type { SubtaskListFormatter } from './subtask-list-formatter.js';
import type { SubtaskTimeTrackingCalendarFormatter } from './subtask-time-tracking-calendar-formatter.js';
import type { TaskApiFormatter } from './task-api-formatter.js';
import type { TaskAutoCompleteFormatter } from './task-auto-complete-formatter.js';
import type { TaskICalFormatter } from './task-ical-formatter.js';
import type { TaskListFormatter } from './task-list-formatter.js';
import type { TaskListSubtaskAssigneeFormatter } from './task-list-subtask-assignee-formatter.js';
import type { TaskListSubtaskFormatter } from './task-list-subtask-formatter.js';
import type { TaskSuggestMenuFormatter } from './task-suggest-menu-formatter.js';
import type { TasksApiFormatter } from './tasks-api-formatter.js';
import type { UserAutoCompleteFormatter } from './user-auto-complete-formatter.js';
import type { UserMentionFormatter } from './user-mention-formatter.js';

/** Formatters registered as (non shared) services, like the PHP `FormatterProvider`. */
declare module '../core/container/container.js' {
  interface ServiceRegistry {
    boardColumnFormatter: BoardColumnFormatter;
    boardFormatter: BoardFormatter;
    boardSwimlaneFormatter: BoardSwimlaneFormatter;
    boardTaskFormatter: BoardTaskFormatter;
    groupAutoCompleteFormatter: GroupAutoCompleteFormatter;
    projectActivityEventFormatter: ProjectActivityEventFormatter;
    projectApiFormatter: ProjectApiFormatter;
    projectsApiFormatter: ProjectsApiFormatter;
    subtaskListFormatter: SubtaskListFormatter;
    subtaskTimeTrackingCalendarFormatter: SubtaskTimeTrackingCalendarFormatter;
    taskApiFormatter: TaskApiFormatter;
    tasksApiFormatter: TasksApiFormatter;
    taskAutoCompleteFormatter: TaskAutoCompleteFormatter;
    taskICalFormatter: TaskICalFormatter;
    taskListFormatter: TaskListFormatter;
    taskListSubtaskFormatter: TaskListSubtaskFormatter;
    taskListSubtaskAssigneeFormatter: TaskListSubtaskAssigneeFormatter;
    taskSuggestMenuFormatter: TaskSuggestMenuFormatter;
    userAutoCompleteFormatter: UserAutoCompleteFormatter;
    userMentionFormatter: UserMentionFormatter;
  }
}
