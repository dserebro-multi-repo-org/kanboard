import { beforeAll, describe, expect, it } from 'vitest';
import { prepareAnalyticLayoutVars } from '../../../../src/views/prepare/analytic.js';
import { applyCase, loadCases, loadFixture, makeEnv, normalizeLoose, type Env } from '../notification-analytic-support.js';

let env: Env;
beforeAll(async () => {
  env = await makeEnv();
});

/** Golden tests: fixtures are the output of the original PHP templates (tests/unit/views/gen-notification-analytic.php). */
describe('analytic templates (golden output of the PHP templates)', () => {
  for (const c of loadCases('analytic')) {
    it(c.name, async () => {
      let vars = await applyCase(env, c);
      if (c.template === 'analytic/layout') {
        // projectHeader.render needs the project models (not migrated): replace the helper by a stub like the PHP generator.
        env.helpers.set('projectHeader', {
          container: env.container,
          render: async () => c.project_header_html ?? '',
        } as never);
        vars = await prepareAnalyticLayoutVars(env.helpers, vars);
      }
      const actual = env.template.render(c.template, vars);
      expect(normalizeLoose(actual)).toBe(normalizeLoose(loadFixture('analytic', c.name)));
    });
  }
});
