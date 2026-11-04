import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../../../src/config/index.js';
import type { Template } from '../../../src/core/template/index.js';
import type { Container } from '../../../src/core/container/container.js';
import { createContainer, runMigrations } from '../../../src/service-provider/index.js';
import type { HelperRegistry } from '../../../src/foundation/helper.js';
import { renderGolden } from '../util/golden.js';

export interface GoldenCase {
  name: string;
  template: string;
  vars: Record<string, unknown>;
  router?: [string, string];
}

/**
 * Normalise HTML for comparison with PHP output: PHP eats the newline after `?>` while Nunjucks keeps it, so
 * insignificant whitespace is collapsed (also around tags). Random/volatile values are masked: CSRF token and
 * the date placeholder (today's date), and the avatar letter markup.
 */
export function canonical(html: string): string {
  return html
    .replace(/(name="csrf_token" value=")[^"]*"/g, '$1TOKEN"')
    // Avatar inner markup comes from the avatarManager collaborator (a foundation stub until a later milestone).
    .replace(/(<div class="avatar avatar-\d+ [^"]*">)<div class="avatar-letter"[^>]*>[^<]*<\/div>/g, '$1')
    .replace(/placeholder="[^"]*"/g, 'placeholder="DATE"')
    .replace(/\s+/g, ' ')
    .replace(/\s*([<>])\s*/g, '$1')
    .trim();
}

export function loadCases(dir: string): GoldenCase[] {
  return JSON.parse(fs.readFileSync(path.join(dir, 'cases.json'), 'utf8')) as GoldenCase[];
}

export async function makeViewContext(): Promise<{ container: Container; template: Template; helpers: HelperRegistry }> {
  const container = createContainer(
    loadConfig({ DB_DRIVER: 'sqlite', DB_FILENAME: ':memory:', DB_RUN_MIGRATIONS: 'true' }, { rootDir: path.resolve('/srv/kb-view-test') }),
  );
  await runMigrations(container);
  return { container, template: container.get('template'), helpers: container.get('helper') };
}

export function setRouter(container: Container, controller: string, action: string): void {
  const router = container.get('router') as unknown as Record<string, string>;
  router['currentControllerName'] = controller;
  router['currentActionName'] = action;
}

export function compareToPhp(template: Template, c: GoldenCase, vars: Record<string, unknown>, dir: string): { actual: string; expected: string } {
  const { actual, expected } = renderGolden(template, c.template, vars, { fixtureDir: path.join(dir, 'fixtures'), fixtureName: c.name });
  return { actual: canonical(actual), expected: canonical(expected) };
}
