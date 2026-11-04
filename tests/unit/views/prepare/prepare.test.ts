import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { helpers } from '../../helper/fixture.js';
import { makeViewEnv, type ViewEnv } from '../_golden/env.js';
import { nl2br, prepareAboutVars, prepareConfigVars } from '../../../../src/views/prepare/config.js';
import { prepareDashboardLayoutVars, prepareDashboardOverviewVars } from '../../../../src/views/prepare/dashboard.js';
import { prepareHeaderVars } from '../../../../src/views/prepare/header.js';
import { prepareLayoutVars } from '../../../../src/views/prepare/layout.js';
import { prepareProjectHeaderVars } from '../../../../src/views/prepare/project_header.js';

let env: ViewEnv;
beforeAll(async () => {
  env = await makeViewEnv();
});
afterAll(async () => env.close());

describe('prepare helpers of the layout, header, config and dashboard views', () => {
  it('prepareLayoutVars resolves the custom stylesheet', async () => {
    expect(await prepareLayoutVars(helpers(env.container))).toEqual({ custom_css: '' });
  });

  it('prepareHeaderVars resolves notifications, personal project switch and logout flag', async () => {
    const vars = await prepareHeaderVars(helpers(env.container), env.container);
    expect(vars).toEqual({ has_notifications: false, is_private_project_enabled: true, disable_logout: false });
  });

  it('prepareProjectHeaderVars only reads the collapsed state on board views', async () => {
    const h = helpers(env.container);
    const vars = await prepareProjectHeaderVars(h, { id: 3 }, false);
    expect(vars.board_collapsed).toBe(false);
    expect(Object.keys(vars.project_access).sort()).toEqual(['analytic', 'custom_filter', 'export', 'project_view', 'task_creation', 'task_import']);
  });

  it('prepareDashboard* resolve per project access and the personal project switch', async () => {
    const h = helpers(env.container);
    expect(await prepareDashboardLayoutVars(h)).toEqual({ is_private_project_enabled: true });
    const vars = await prepareDashboardOverviewVars(h, [{ id: 1 }, { id: 2 }]);
    expect(Object.keys(vars.project_access)).toEqual(['1', '2']);
  });

  it('prepareConfigVars exposes the mail constants', async () => {
    const vars = await prepareConfigVars(helpers(env.container), env.container);
    expect(vars.mail_configuration).toBe(true);
    expect(typeof vars.mail_from).toBe('string');
  });

  it('prepareAboutVars describes the runtime and reads the LICENSE file', () => {
    const vars = prepareAboutVars(env.container, process.cwd());
    expect(vars.db_driver).toBe('sqlite');
    expect(vars.php_sapi).toBe('node');
    expect(vars.license_html).toContain('MIT License');
    expect(vars.license_html).toContain('<br />');
  });

  it('nl2br inserts a break before every newline', () => {
    expect(nl2br('a\nb\r\nc')).toBe('a<br />\nb<br />\r\nc');
  });
});
