import type { SubscribedEvents } from '../core/event/dispatcher.js';
import { AppEvents, AuthEvents, SessionEvents, TaskEvents, UserProfileEvents } from '../event/events.js';
import { BaseSubscriber } from './base-subscriber.js';

/*
 * Typed stubs of the subscribers wired in `app/ServiceProvider/EventDispatcherProvider.php`.
 * They declare the events they subscribe to (identical to the PHP classes) but their handlers are
 * intentionally no-ops: the behaviour is ported by the milestones owning the related models.
 */

export class BootstrapSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return { [AppEvents.BOOTSTRAP]: 'execute' };
  }

  execute(): void {
    // Later milestone: load language, timezone and attach automatic action events.
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

  afterLogin(): void {}
  onLoginFailure(): void {}
  afterLogout(): void {}
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

  execute(): void {}
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

  execute(): void {}
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

  handleEvent(): void {}
}

export class TransitionSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return { [TaskEvents.MOVE_COLUMN]: 'execute' };
  }

  execute(): void {}
}

export class RecurringTaskSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return {
      [TaskEvents.MOVE_COLUMN]: 'onMove',
      [TaskEvents.CLOSE]: 'onClose',
    };
  }

  onMove(): void {}
  onClose(): void {}
}

export class LdapUserPhotoSubscriber extends BaseSubscriber {
  getSubscribedEvents(): SubscribedEvents {
    return { [UserProfileEvents.AFTER_SYNC]: 'syncUserPhoto' };
  }

  syncUserPhoto(): void {}
}
