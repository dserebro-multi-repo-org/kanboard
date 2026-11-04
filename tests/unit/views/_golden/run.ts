import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { canonical, expectedFixture, loadScenarios, makeViewEnv, type ViewEnv } from './env.js';

/** Register one golden test per scenario of `scenarios/<file>`. */
export function goldenSuite(title: string, file: string): void {
  describe(title, () => {
    let env: ViewEnv;
    beforeAll(async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      env = await makeViewEnv();
    });
    afterAll(async () => {
      vi.useRealTimers();
      await env.close();
    });

    for (const scenario of loadScenarios(file)) {
      it(`${scenario.template} (${scenario.name}) matches the PHP output`, async () => {
        const actual = await env.render(scenario);
        const a = canonical(actual);
        const e = canonical(expectedFixture(scenario));
        if (a !== e) {
          let i = 0;
          while (i < a.length && a[i] === e[i]) i++;
          expect(`...${a.slice(Math.max(0, i - 60), i + 120)}`).toBe(`...${e.slice(Math.max(0, i - 60), i + 120)}`);
        }
        expect(a).toBe(e);
      });
    }
  });
}
