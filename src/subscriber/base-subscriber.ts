import { Base } from '../core/container/base.js';
import type { EventSubscriber, SubscribedEvents } from '../core/event/dispatcher.js';

/**
 * Base class of event subscribers (port of `app/Subscriber/BaseSubscriber.php`).
 * Concrete subscribers are implemented in later milestones.
 */
export abstract class BaseSubscriber extends Base implements EventSubscriber {
  abstract getSubscribedEvents(): SubscribedEvents;
}
