import type { AppConfig } from '../config/index.js';
import type { Container } from '../core/container/container.js';
import type { MemoryCache } from '../core/cache/memory-cache.js';
import type { EventDispatcher } from '../core/event/dispatcher.js';
import type { EventManager } from '../core/event/event-manager.js';
import type { Route } from '../core/http/route.js';
import type { Router } from '../core/http/router.js';
import type { Logger } from '../core/log/logger.js';
import type { Database } from '../db/database.js';
import type { UserSessionInterface } from '../foundation/user-session.js';
import type { ConfigModel } from '../model/config-model.js';
import type { SettingModel } from '../model/setting-model.js';
import type { HelperRegistry } from '../foundation/helper.js';
import type { NotificationTypeRegistry } from '../foundation/notification.js';
import type { HookRegistry } from '../foundation/plugin.js';

/**
 * Services provided by the core service providers. Later modules extend the registry the same way:
 *
 * ```ts
 * declare module '../core/container/container.js' {
 *   interface ServiceRegistry { taskModel: TaskModel }
 * }
 * ```
 */
declare module '../core/container/container.js' {
  interface ServiceRegistry {
    config: AppConfig;
    logger: Logger;
    dispatcher: EventDispatcher;
    eventManager: EventManager;
    hook: HookRegistry;
    memoryCache: MemoryCache;
    route: Route;
    router: Router;
    helper: HelperRegistry;
    userNotificationTypeModel: NotificationTypeRegistry;
    projectNotificationTypeModel: NotificationTypeRegistry;
    userSession: UserSessionInterface;
    db: Database;
    settingModel: SettingModel;
    configModel: ConfigModel;
  }
}

/** The application container type. */
export type AppContainer = Container;
