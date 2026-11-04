export { createTestContainer } from '../export/helpers.js';

/** Logger spy registered as the `logger` service replacement. */
export function spyLogger(): { debug: string[]; error: string[]; instance: { debug(m: string): void; error(m: string): void } } {
  const debug: string[] = [];
  const error: string[] = [];
  return { debug, error, instance: { debug: (m) => void debug.push(m), error: (m) => void error.push(m) } };
}
