import type { Container, ServiceProvider } from '../core/container/container.js';
import { BoardColumnFormatter } from './board-column-formatter.js';
import { BoardFormatter } from './board-formatter.js';
import { BoardSwimlaneFormatter } from './board-swimlane-formatter.js';
import { BoardTaskFormatter } from './board-task-formatter.js';
import { GroupAutoCompleteFormatter } from './group-auto-complete-formatter.js';
import { ProjectActivityEventFormatter } from './project-activity-event-formatter.js';
import { ProjectApiFormatter } from './project-api-formatter.js';
import { ProjectsApiFormatter } from './projects-api-formatter.js';
import { SubtaskListFormatter } from './subtask-list-formatter.js';
import { SubtaskTimeTrackingCalendarFormatter } from './subtask-time-tracking-calendar-formatter.js';
import { TaskApiFormatter } from './task-api-formatter.js';
import { TaskAutoCompleteFormatter } from './task-auto-complete-formatter.js';
import { TaskICalFormatter } from './task-ical-formatter.js';
import { TaskListFormatter } from './task-list-formatter.js';
import { TaskListSubtaskAssigneeFormatter } from './task-list-subtask-assignee-formatter.js';
import { TaskListSubtaskFormatter } from './task-list-subtask-formatter.js';
import { TaskSuggestMenuFormatter } from './task-suggest-menu-formatter.js';
import { TasksApiFormatter } from './tasks-api-formatter.js';
import { UserAutoCompleteFormatter } from './user-auto-complete-formatter.js';
import { UserMentionFormatter } from './user-mention-formatter.js';
import './registry.js';

/** Registers the formatters as factories: every `get()` returns a fresh instance (PHP `FormatterProvider`). */
export class FormatterServiceProvider implements ServiceProvider {
  register(container: Container): void {
    container.factory('boardColumnFormatter', (c) => new BoardColumnFormatter(c));
    container.factory('boardFormatter', (c) => new BoardFormatter(c));
    container.factory('boardSwimlaneFormatter', (c) => new BoardSwimlaneFormatter(c));
    container.factory('boardTaskFormatter', (c) => new BoardTaskFormatter(c));
    container.factory('groupAutoCompleteFormatter', (c) => new GroupAutoCompleteFormatter(c));
    container.factory('projectActivityEventFormatter', (c) => new ProjectActivityEventFormatter(c));
    container.factory('projectApiFormatter', (c) => new ProjectApiFormatter(c));
    container.factory('projectsApiFormatter', (c) => new ProjectsApiFormatter(c));
    container.factory('subtaskListFormatter', (c) => new SubtaskListFormatter(c));
    container.factory('subtaskTimeTrackingCalendarFormatter', (c) => new SubtaskTimeTrackingCalendarFormatter(c));
    container.factory('taskApiFormatter', (c) => new TaskApiFormatter(c));
    container.factory('tasksApiFormatter', (c) => new TasksApiFormatter(c));
    container.factory('taskAutoCompleteFormatter', (c) => new TaskAutoCompleteFormatter(c));
    container.factory('taskICalFormatter', (c) => new TaskICalFormatter(c));
    container.factory('taskListFormatter', (c) => new TaskListFormatter(c));
    container.factory('taskListSubtaskFormatter', (c) => new TaskListSubtaskFormatter(c));
    container.factory('taskListSubtaskAssigneeFormatter', (c) => new TaskListSubtaskAssigneeFormatter(c));
    container.factory('taskSuggestMenuFormatter', (c) => new TaskSuggestMenuFormatter(c));
    container.factory('userAutoCompleteFormatter', (c) => new UserAutoCompleteFormatter(c));
    container.factory('userMentionFormatter', (c) => new UserMentionFormatter(c));
  }
}
