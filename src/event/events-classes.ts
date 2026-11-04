import { Event } from '../core/event/event.js';
import { GenericEvent } from './generic-event.js';

/** Typed event classes ported from `app/Event`. */
export class TaskEvent extends GenericEvent {}
export class CommentEvent extends GenericEvent {}
export class SubtaskEvent extends GenericEvent {}
export class TaskFileEvent extends GenericEvent {}
export class ProjectFileEvent extends GenericEvent {}
export class TaskLinkEvent extends GenericEvent {}

export class TaskListEvent extends GenericEvent {
  setTasks(tasks: unknown[]): void {
    this.values['tasks'] = tasks;
  }
}

export class AuthSuccessEvent extends Event {
  constructor(private readonly authType: string) {
    super();
  }

  getAuthType(): string {
    return this.authType;
  }
}

export class AuthFailureEvent extends Event {
  constructor(private readonly username = '') {
    super();
  }

  getUsername(): string {
    return this.username;
  }
}

export class UserProfileSyncEvent extends Event {
  constructor(
    private readonly profile: Record<string, unknown>,
    private readonly user: unknown,
  ) {
    super();
  }

  getProfile(): Record<string, unknown> {
    return this.profile;
  }

  getUser(): unknown {
    return this.user;
  }
}
