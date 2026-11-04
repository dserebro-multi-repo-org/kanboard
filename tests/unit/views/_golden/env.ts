import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';
import type { Container } from '../../../../src/core/container/container.js';
import { Template } from '../../../../src/core/template/template.js';
import { Translator } from '../../../../src/core/translator/index.js';
import { UserMetadataKeys } from '../../../../src/helper/batch-b-support.js';
import type { HookHelper } from '../../../../src/helper/hook-helper.js';
import { prepareConfigVars, prepareAboutVars } from '../../../../src/views/prepare/config.js';
import { prepareDashboardLayoutVars, prepareDashboardOverviewVars } from '../../../../src/views/prepare/dashboard.js';
import { prepareHeaderVars } from '../../../../src/views/prepare/header.js';
import { prepareLayoutVars } from '../../../../src/views/prepare/layout.js';
import { prepareProjectHeaderVars } from '../../../../src/views/prepare/project_header.js';
import { makeBatchBContainer } from '../../helper/batch-b-fixture.js';
import { helpers, setService } from '../../helper/fixture.js';

/**
 * Environment of the per-template golden tests. A scenario (tests/unit/views/scenarios/*.json) describes a
 * template, its variables and the application state; `_php/render.php` renders it with the original PHP template
 * (fixtures/<fixture>), this module renders the Nunjucks port with the same state.
 */
export const VIEWS_DIR = path.resolve(import.meta.dirname);
export const FIXTURES_DIR = path.join(VIEWS_DIR, 'fixtures');

export interface Scenario {
  name: string;
  template: string;
  vars: Record<string, unknown>;
  fixture: string;
  prepare?: string[];
  board_view?: boolean;
  replace_first_style?: boolean;
  replace_strong?: Record<string, string>;
  freeze_date?: string;
  state?: {
    route?: [string, string];
    user?: Record<string, unknown> | null;
    config?: Record<string, string>;
    hooks?: { hook: string; template: string }[];
    notifications?: boolean;
    collapsed?: number[];
  };
}

export function loadScenarios(file: string): Scenario[] {
  return JSON.parse(fs.readFileSync(path.join(VIEWS_DIR, 'scenarios', file), 'utf8')) as Scenario[];
}

const ADMIN = { id: 1, username: 'admin', name: '', role: 'app-admin', email: '', avatar_path: '', theme: 'dark' };

/** Fake paginator (the Paginator class is not ported yet): same contract as `FakePaginator` of render.php. */
class FakePaginator {
  constructor(private readonly d: { collection: unknown[]; total: number; html: string }) {}
  isEmpty(): boolean {
    return this.d.collection.length === 0;
  }
  getCollection(): unknown[] {
    return this.d.collection;
  }
  getTotal(): number {
    return this.d.total;
  }
  order(label: string, column: string): string {
    return `<a href="#order-${column}">${label}</a>`;
  }
  toString(): string {
    return this.d.html;
  }
}

function convert(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(convert);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length === 1 && keys[0] === '$paginator') {
      const p = o['$paginator'] as { collection?: unknown[]; total?: number; html?: string };
      return new FakePaginator({ collection: (convert(p.collection ?? []) as unknown[]), total: p.total ?? 0, html: p.html ?? '' });
    }
    return Object.fromEntries(Object.entries(o).map(([k, val]) => [k, convert(val)]));
  }
  return v;
}

/** PHP `intval($a / $b)`: the division is done on doubles. */
function fdiv(a: bigint, b: number): bigint {
  return BigInt(Math.trunc(Number(a) / b));
}

/** Port of `User\Avatar\LetterAvatarProvider` (the avatar manager is not ported yet). */
function letterAvatar(user: { name?: string; username?: string }): string {
  const str = (user.name || user.username || '') + 'x';
  const seed = 131n;
  const max = 0x7fffffffffffffffn / 137n;
  let hash = 0n;
  for (const ch of str) {
    if (hash > max) hash = fdiv(hash, 137);
    hash = hash * seed + BigInt(ch.codePointAt(0) ?? 0);
  }
  const sat = [0.35, 0.5, 0.65];
  const light = [0.35, 0.5, 0.65];
  const hue = Number(hash % 359n) / 360;
  let h = fdiv(hash, 360);
  const s = sat[Number(h % 3n)] as number;
  h = fdiv(h, 3);
  const l = light[Number(h % 3n)] as number;
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rgb = [hue + 1 / 3, hue, hue - 1 / 3].map((c0) => {
    let c = c0;
    if (c < 0) c++;
    if (c > 1) c--;
    if (c < 1 / 6) c = p + (q - p) * 6 * c;
    else if (c < 0.5) c = q;
    else if (c < 2 / 3) c = p + (q - p) * 6 * (2 / 3 - c);
    else c = p;
    return Math.round(c * 255);
  });
  const name = (user.name || user.username || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const initials = (user.name || user.username || '')
    .split(' ')
    .slice(0, 2)
    .map((x) => Array.from(x)[0] ?? '')
    .join('')
    .toUpperCase();
  return `<div class="avatar-letter" style="background-color: rgb(${rgb.join(', ')})" title="${name}" role="img" aria-label="${name}">${initials}</div>`;
}

export interface ViewEnv {
  container: Container;
  template: Template;
  render(scenario: Scenario): Promise<string>;
  close(): Promise<void>;
}

const STUBS = path.join(VIEWS_DIR, 'stubs');

export async function makeViewEnv(): Promise<ViewEnv> {
  const { container, state } = await makeBatchBContainer();
  const config: Record<string, string> = {};
  const route: [string, string] = ['', ''];
  let notifications = false;

  setService(container, 'userSession', {
    getId: () => state.user?.id ?? 0,
    isLogged: () => state.user !== null,
    isAdmin: () => state.user?.role === 'app-admin',
    getRole: () => state.user?.role ?? '',
    getAll: () => state.user ?? {},
    getTheme: () => (state.user ? String(state.user['theme'] ?? 'light') : 'light'),
    hasSubtaskListActivated: () => true,
  });
  // Same answers as the PHP ApplicationAuthorization for the roles used by the scenarios.
  setService(container, 'applicationAuthorization', {
    isAllowed: (controller: string, action: string, role: string) => {
      if (role === 'app-admin') return true;
      if (controller === 'ProjectCreationController') return action === 'createPrivate';
      return false;
    },
  });
  setService(container, 'configModel', { get: async (key: string, def: unknown = '') => config[key] ?? def });
  setService(container, 'router', { getController: () => route[0], getAction: () => route[1], getPlugin: () => '' });
  setService(container, 'request', { isAjax: () => false, getMethod: () => 'GET', getServerVariable: () => '/index.php' });
  setService(container, 'colorModel', { getList: () => ({}), getCss: () => '/*colors*/' });
  setService(container, 'avatarManager', {
    render: (_id: unknown, username: string, name: string) => letterAvatar({ username, name }),
    renderDefault: () => '',
  });
  setService(container, 'userUnreadNotificationModel', { hasNotifications: async () => notifications });

  const helperRegistry = helpers(container);
  const template = new Template(helperRegistry, {
    pluginsDir: STUBS,
    translator: () => Translator.getInstance(),
    noCache: true,
  });
  for (const name of JSON.parse(fs.readFileSync(path.join(STUBS, 'overrides.json'), 'utf8')) as string[]) {
    template.setTemplateOverride(name, `stub:${name}`);
  }
  setService(container, 'template', template);

  const hooks = (container.get('hook') as unknown as { hooks: Map<string, unknown> }).hooks;

  return {
    container,
    template,
    async render(s: Scenario): Promise<string> {
      const st = s.state ?? {};
      state.user = st.user === null ? null : ({ ...ADMIN, ...(st.user ?? {}) } as typeof state.user);
      route[0] = st.route?.[0] ?? '';
      route[1] = st.route?.[1] ?? '';
      for (const k of Object.keys(config)) delete config[k];
      Object.assign(config, st.config ?? {});
      notifications = st.notifications === true;
      state.metadata.clear();
      for (const pid of st.collapsed ?? []) state.metadata.set(`${UserMetadataKeys.KEY_BOARD_COLLAPSED}${pid}`, 1);

      hooks.clear();
      container.get('memoryCache').flush();
      const hookHelper = helperRegistry.get<HookHelper>('hook');
      for (const h of st.hooks ?? []) hookHelper.attach(h.hook, h.template);

      let vars = convert(s.vars) as Record<string, unknown>;
      const extra: Record<string, unknown> = {};
      for (const p of s.prepare ?? []) {
        if (p === 'layout') Object.assign(extra, await prepareLayoutVars(helperRegistry));
        if (p === 'header') Object.assign(extra, await prepareHeaderVars(helperRegistry, container));
        if (p === 'project_header') {
          Object.assign(extra, await prepareProjectHeaderVars(helperRegistry, vars['project'] as { id: unknown }, s.board_view === true));
        }
        if (p === 'config') Object.assign(extra, await prepareConfigVars(helperRegistry, container));
        if (p === 'about') Object.assign(extra, prepareAboutVars(container, path.resolve(VIEWS_DIR, '../../../..')));
        if (p === 'dashboard_layout') Object.assign(extra, await prepareDashboardLayoutVars(helperRegistry));
        if (p === 'dashboard_overview') {
          const pp = vars['project_paginator'] as FakePaginator;
          Object.assign(extra, await prepareDashboardOverviewVars(helperRegistry, pp.getCollection() as { id: unknown }[]));
        }
      }
      vars = { ...extra, ...vars };
      if (s.freeze_date) vi.setSystemTime(new Date(`${s.freeze_date}T12:00:00Z`));
      return template.render(s.template, vars);
    },
    async close(): Promise<void> {
      await container.get('db').close();
    },
  };
}

/**
 * Golden comparison: PHP swallows the newline following `?>` and the Nunjucks port keeps template whitespace, so
 * both sides are compared with whitespace runs collapsed (and removed between tags). CSRF tokens are random.
 */
/** Normalisation shared by every golden comparison (see comment of `compareHtml`). */
export function canonical(html: string): string {
  return html
    .replace(/\r\n/g, '\n')
    .replace(/(csrf_token=)[0-9a-zA-Z]+/g, '$1TOKEN')
    .replace(/(name="csrf_token" value=")[0-9a-zA-Z]+/g, '$1TOKEN')
    .replace(/\s+/g, ' ')
    .replace(/> </g, '><')
    .trim();
}

export function expectedFixture(s: Scenario): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, s.fixture), 'utf8');
}
