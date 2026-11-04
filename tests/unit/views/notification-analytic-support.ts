import fs from 'node:fs';
import path from 'node:path';
import type { Container } from '../../../src/core/container/container.js';
import { Template } from '../../../src/core/template/index.js';
import type { HelperRegistry } from '../../../src/foundation/helper.js';
import type { UrlHelper } from '../../../src/helper/url-helper.js';
import { makeContainer } from '../helper/fixture.js';

export const VIEWS_TEST_DIR = import.meta.dirname;

export interface GoldenCase {
  name: string;
  template: string;
  vars: Record<string, unknown>;
  config?: Record<string, string>;
  router?: { controller: string; action: string };
  paginator?: PaginatorCase;
  project_header_html?: string;
  override?: Record<string, string>;
}

export interface PaginatorCase {
  controller: string;
  action: string;
  params: Record<string, string | number>;
  collection: Record<string, unknown>[];
  max: number;
  order: string;
  direction: string;
  page: number;
}

export function loadCases(dir: string): GoldenCase[] {
  return JSON.parse(fs.readFileSync(path.join(VIEWS_TEST_DIR, dir, 'cases.json'), 'utf8')) as GoldenCase[];
}

export function loadFixture(dir: string, name: string): string {
  return fs.readFileSync(path.join(VIEWS_TEST_DIR, dir, 'fixtures', `${name}.html`), 'utf8');
}

/**
 * Whitespace-insensitive comparison form. PHP swallows the newline after `?>` and Nunjucks tags leave their own
 * line behind, so the whitespace layout differs while the HTML is the same: collapse every whitespace run and drop
 * whitespace between tags. `&#39;` (Nunjucks) and `&#039;` (PHP htmlspecialchars) are the same character.
 */
export function normalizeLoose(html: string): string {
  return html
    .replace(/&#0?39;/g, '&#039;')
    .replace(/name="csrf_token" value="[^"]*"/g, 'name="csrf_token" value="TOKEN"') // random per request
    .replace(/placeholder="[^"]*"/g, 'placeholder="FORMAT"') // formatted "now"

    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .replace(/ >/g, '>')
    .replace(/ <\//g, '</')
    .trim();
}

export interface Env {
  container: Container;
  helpers: HelperRegistry;
  template: Template;
}

/** Container (in-memory sqlite) plus a Template whose plugin dir holds the `stub:` templates. */
export async function makeEnv(): Promise<Env> {
  const container = await makeContainer(true);
  const helpers = container.get('helper');
  const template = new Template(helpers, {
    pluginsDir: path.join(VIEWS_TEST_DIR, '_plugins'),
    translator: () => container.get('translator'),
  });
  return { container, helpers, template };
}

export async function applyCase(env: Env, c: GoldenCase): Promise<Record<string, unknown>> {
  await env.container.get('configModel').save({ application_url: '', ...(c.config ?? {}) });
  env.container.get('memoryCache').flush(); // ConfigModel caches the settings table
  if (c.router) {
    const { controller, action } = c.router;
    env.container.get('router').dispatch({
      getStringParam: (n: string) => (n === 'controller' ? controller : n === 'action' ? action : ''),
      getUri: () => '',
      getQueryString: () => '',
      setParams: () => undefined,
    });
  }
  for (const [from, to] of Object.entries(c.override ?? {})) env.template.setTemplateOverride(from, to);
  const vars = { ...c.vars };
  if (c.paginator) vars['paginator'] = makePaginator(env.helpers, c.paginator);
  return vars;
}

/** Test double of `Core\Paginator` (not migrated yet): same `order()` / `isEmpty()` / `getCollection()` / `toHtml()`. */
export function makePaginator(helpers: HelperRegistry, p: PaginatorCase) {
  const url = helpers.get<UrlHelper>('url');
  return {
    isEmpty: () => p.collection.length === 0,
    getCollection: () => p.collection,
    toHtml: () => '',
    order(label: string, column: string): string {
      let prefix = '';
      let direction = 'ASC';
      if (p.order === column) {
        prefix = p.direction === 'DESC' ? '&#9660; ' : '&#9650; ';
        direction = p.direction === 'DESC' ? 'ASC' : 'DESC';
      }
      return (
        prefix +
        url.link(label, p.controller, p.action, { ...p.params, page: p.page, order: column, direction }, false, 'js-modal-replace')
      );
    },
  };
}
