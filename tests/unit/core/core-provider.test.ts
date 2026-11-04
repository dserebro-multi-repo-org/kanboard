import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/config/index.js';
import { createContainer } from '../../../src/service-provider/index.js';
import { TaskEvents } from '../../../src/event/index.js';
import { GenericEvent } from '../../../src/event/index.js';

const rootDir = path.resolve('/srv/kb-provider-test');

describe('CoreServiceProvider', () => {
  it('provides lazy singletons', () => {
    const container = createContainer(loadConfig({ LOG_DRIVER: 'stdout' }, { rootDir }));
    expect(container.get('config').LOG_DRIVER).toBe('stdout');
    expect(container.get('logger')).toBe(container.get('logger'));
    expect(container.get('router').getRoute()).toBe(container.get('route'));
    expect(container.get('route').isEnabled()).toBe(false);
    expect(container.get('eventManager').getAll()[TaskEvents.CREATE]).toBe('Task creation');
    expect(container.get('helper').has('x')).toBe(false);
    expect(container.get('hook').exists('x')).toBe(false);
    expect(container.get('memoryCache').get('x')).toBeNull();
    expect(container.get('userNotificationTypeModel')).not.toBe(container.get('projectNotificationTypeModel'));
  });

  it('wires subscribers and enables url rewrite from config', () => {
    const container = createContainer(loadConfig({ ENABLE_URL_REWRITE: 'true' }, { rootDir }));
    expect(container.get('route').isEnabled()).toBe(true);
    const dispatcher = container.get('dispatcher');
    expect(dispatcher.hasListeners('app.bootstrap')).toBe(true);
    expect(dispatcher.hasListeners('user_profile.after.sync')).toBe(false);
    dispatcher.dispatch(new GenericEvent(), TaskEvents.CREATE);
  });

  it('adds the LDAP photo subscriber only when configured', () => {
    const container = createContainer(loadConfig({ LDAP_AUTH: 'true', LDAP_USER_ATTRIBUTE_PHOTO: 'jpegPhoto' }, { rootDir }));
    expect(container.get('dispatcher').hasListeners('user_profile.after.sync')).toBe(true);
  });
});
