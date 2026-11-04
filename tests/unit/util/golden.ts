import fs from 'node:fs';
import path from 'node:path';
import type { Template } from '../../../src/core/template/index.js';

/**
 * Golden-output helper for template tests. Renders `templateName` with `vars` and compares the result to the
 * fixture file `<fixtureDir>/<fixtureName>.html`. Run with `UPDATE_GOLDEN=1` to (re)write fixtures.
 * Whitespace-only differences at line ends and the trailing newline are ignored (set `exact: true` to disable).
 */
export function normalizeHtml(html: string): string {
  return html
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .trim();
}

export interface GoldenOptions {
  fixtureDir: string;
  fixtureName?: string;
  exact?: boolean;
}

export function renderGolden(
  template: Template,
  templateName: string,
  vars: Record<string, unknown>,
  options: GoldenOptions,
): { actual: string; expected: string; fixture: string } {
  const name = options.fixtureName ?? templateName.replace(/[:/]/g, '_');
  const fixture = path.join(options.fixtureDir, `${name}.html`);
  const actualRaw = template.render(templateName, vars);
  if (process.env['UPDATE_GOLDEN'] === '1') {
    fs.mkdirSync(options.fixtureDir, { recursive: true });
    fs.writeFileSync(fixture, actualRaw);
  }
  const expectedRaw = fs.readFileSync(fixture, 'utf8');
  const exact = options.exact === true;
  return {
    actual: exact ? actualRaw : normalizeHtml(actualRaw),
    expected: exact ? expectedRaw : normalizeHtml(expectedRaw),
    fixture,
  };
}
