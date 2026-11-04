import type { SubscribedEvents } from '../core/event/dispatcher.js';
import { AppEvents, AuthEvents, SessionEvents, TaskEvents, UserProfileEvents } from '../event/events.js';
import { BaseSubscriber } from './base-subscriber.js';

/*
 * Typed stubs of the subscribers wired in `app/ServiceProvider/EventDispatcherProvider.php`.
 * They declare the events they subscribe to (identical to the PHP classes) but their handlers are
 * intentionally no-ops (removed in M15). Owning milestone of each behaviour:
 *   BootstrapSubscriber                                  M3 (automatic actions), M5 (user language/timezone), M7 (translations)
 *   AuthSubscriber, LdapUserPhotoSubscriber              M5
 *   ProjectDailySummarySubscriber, ProjectModificationDateSubscriber  M3
 *   NotificationSubscriber                               M13
 *   RecurringTaskSubscriber                              M13 (needs the M4 task model)
 *   TransitionSubscriber                                 M4 (task model), M13
 */

export class BootstrapSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return { [AppEvents.BOOTSTRAP]: 'execute' };
  }

  execute(): void {
    // TODO(M5/M7): load user language and timezone; TODO(M3): attach automatic action events.
  }
}

export class AuthSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return {
      [AuthEvents.SUCCESS]: 'afterLogin',
      [AuthEvents.FAILURE]: 'onLoginFailure',
      [SessionEvents.DESTROY]: 'afterLogout',
    };
  }

  afterLogin(): void {
    // TODO(M5): port behaviour.
  }
  onLoginFailure(): void {
    // TODO(M5): port behaviour.
  }
  afterLogout(): void {
    // TODO(M5): port behaviour.
  }
}

export class ProjectDailySummarySubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return {
      [TaskEvents.CREATE_UPDATE]: 'execute',
      [TaskEvents.CLOSE]: 'execute',
      [TaskEvents.OPEN]: 'execute',
      [TaskEvents.MOVE_COLUMN]: 'execute',
      [TaskEvents.MOVE_SWIMLANE]: 'execute',
    };
  }

  execute(): void {
    // TODO(M3): port behaviour.
  }
}

export class ProjectModificationDateSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return {
      [TaskEvents.CREATE_UPDATE]: 'execute',
      [TaskEvents.CLOSE]: 'execute',
      [TaskEvents.OPEN]: 'execute',
      [TaskEvents.MOVE_SWIMLANE]: 'execute',
      [TaskEvents.MOVE_COLUMN]: 'execute',
      [TaskEvents.MOVE_POSITION]: 'execute',
    };
  }

  execute(): void {
    // TODO(M3): port behaviour.
  }
}

export class NotificationSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return {
      [TaskEvents.USER_MENTION]: 'handleEvent',
      [TaskEvents.CREATE]: 'handleEvent',
      [TaskEvents.UPDATE]: 'handleEvent',
      [TaskEvents.CLOSE]: 'handleEvent',
      [TaskEvents.OPEN]: 'handleEvent',
      [TaskEvents.MOVE_COLUMN]: 'handleEvent',
      [TaskEvents.MOVE_PROJECT]: 'handleEvent',
      [TaskEvents.MOVE_POSITION]: 'handleEvent',
      [TaskEvents.MOVE_SWIMLANE]: 'handleEvent',
      [TaskEvents.ASSIGNEE_CHANGE]: 'handleEvent',
    };
  }

  handleEvent(): void {
    // TODO(M13): port behaviour.
  }
}

export class TransitionSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return { [TaskEvents.MOVE_COLUMN]: 'execute' };
  }

  execute(): void {
    // TODO(M4/M13): port behaviour.
  }
}

export class RecurringTaskSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return {
      [TaskEvents.MOVE_COLUMN]: 'onMove',
      [TaskEvents.CLOSE]: 'onClose',
    };
  }

  onMove(): void {
    // TODO(M13): port behaviour.
  }
  onClose(): void {
    // TODO(M13): port behaviour.
  }
}

export class LdapUserPhotoSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return { [UserProfileEvents.AFTER_SYNC]: 'syncUserPhoto' };
  }

  syncUserPhoto(): void {
    // TODO(M5): port behaviour.
  }
}
