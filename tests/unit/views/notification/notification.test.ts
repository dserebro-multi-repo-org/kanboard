import { beforeAll, describe, expect, it } from 'vitest';
import {
  prepareNotificationVars,
  prepareTaskCreateNotificationVars,
  prepareTaskOverdueNotificationVars,
} from '../../../../src/views/prepare/notification.js';
import { applyCase, loadCases, loadFixture, makeEnv, normalizeLoose, type Env } from '../notification-analytic-support.js';

let env: Env;
beforeAll(async () => {
  env = await makeEnv();
});

/** Golden tests: fixtures are the output of the original PHP templates (tests/unit/views/gen-notification-analytic.php). */
describe('notification templates (golden output of the PHP templates)', () => {
  for (const c of loadCases('notification')) {
    it(c.name, async () => {
      let vars = await applyCase(env, c);
      if (c.template === 'notification/task_create') vars = await prepareTaskCreateNotificationVars(env.helpers, vars);
      else if (c.template === 'notification/task_overdue') vars = await prepareTaskOverdueNotificationVars(env.helpers, vars);
      else vars = await prepareNotificationVars(env.helpers, vars);
      const actual = env.template.render(c.template, vars);
      expect(normalizeLoose(actual)).toBe(normalizeLoose(loadFixture('notification', c.name)));
    });
  }
});
