import type { AppConfig } from '../config/index.js';
import { Container, type ServiceProvider } from '../core/container/container.js';
import { MemoryCache } from '../core/cache/memory-cache.js';
import { EventDispatcher } from '../core/event/dispatcher.js';
import { EventManager } from '../core/event/event-manager.js';
import { Route } from '../core/http/route.js';
import { Router } from '../core/http/router.js';
import { createLogger } from '../core/log/logger.js';
import { Translator } from '../core/translator/translator.js';
import { Template } from '../core/template/template.js';
import { UserSessionStub } from '../foundation/user-session.js';
import { HelperRegistry } from '../foundation/helper.js';
import { registerHelpers } from '../helper/index.js';
import { NotificationTypeRegistry } from '../foundation/notification.js';
import { HookRegistry } from '../foundation/plugin.js';
import {
  AuthSubscriber,
  BootstrapSubscriber,
  LdapUserPhotoSubscriber,
  NotificationSubscriber,
  ProjectDailySummarySubscriber,
  ProjectModificationDateSubscriber,
  RecurringTaskSubscriber,
  TransitionSubscriber,
} from '../subscriber/stubs.js';
import { DatabaseServiceProvider } from './database-provider.js';
import './registry.js';

/**
 * Registers the framework services that do not need a database (counterpart of the PHP
 * `ClassProvider`, `EventDispatcherProvider`, `LoggingProvider`, `RouteProvider`... for the core).
 * The `config` service must already be set on the container, see {@link createContainer}.
 */
export class CoreServiceProvider implements ServiceProvider {
  register(container: Container): void {
    container.register('logger', (c) => {
      const config = c.get('config');
      return createLogger({ driver: config.LOG_DRIVER, logFile: config.LOG_FILE, debug: config.DEBUG });
    });

    container.register('translator', () => Translator.getInstance());
    container.register('eventManager', () => new EventManager());
    container.register('hook', () => new HookRegistry());
    container.register('memoryCache', () => new MemoryCache());
    container.register('helper', (c) => registerHelpers(new HelperRegistry(c)));
    container.register('userNotificationTypeModel', (c) => new NotificationTypeRegistry(c));
    container.register('projectNotificationTypeModel', (c) => new NotificationTypeRegistry(c));
    container.register('userSession', () => new UserSessionStub());
    container.register('route', (c) => new Route({ enabled: c.get('config').ENABLE_URL_REWRITE }));
    container.register('router', (c) => new Router(c.get('route')));

    container.register('dispatcher', (c) => {
      const config = c.get('config');
      const dispatcher = new EventDispatcher();
      dispatcher.addSubscriber(new BootstrapSubscriber(c));
      dispatcher.addSubscriber(new AuthSubscriber(c));
      dispatcher.addSubscriber(new ProjectDailySummarySubscriber(c));
      dispatcher.addSubscriber(new ProjectModificationDateSubscriber(c));
      dispatcher.addSubscriber(new NotificationSubscriber(c));
      dispatcher.addSubscriber(new TransitionSubscriber(c));
      dispatcher.addSubscriber(new RecurringTaskSubscriber(c));

      if (config.LDAP_AUTH && config.LDAP_USER_ATTRIBUTE_PHOTO !== '') {
        dispatcher.addSubscriber(new LdapUserPhotoSubscriber(c));
      }

      return dispatcher;
    });
  }
}

/** Create the application container with the configuration and the core services. */
export function createContainer(config: AppConfig): Container {
  const container = new Container();
  container.set('config', config);
  new CoreServiceProvider().register(container);
  new DatabaseServiceProvider().register(container);
  return container;
}
