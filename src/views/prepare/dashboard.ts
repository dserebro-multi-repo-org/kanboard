import type { HelperRegistry } from '../../foundation/helper.js';
import type { AppHelper } from '../../helper/app-helper.js';
import type { UserHelper } from '../../helper/user-helper.js';

/** Pre-resolved variables of `dashboard/layout.njk`. */
export interface DashboardLayoutVars {
  /** `app.config('disable_private_project', 0) == 0` */
  is_private_project_enabled: boolean;
}

export async function prepareDashboardLayoutVars(helpers: HelperRegistry): Promise<DashboardLayoutVars> {
  const disablePrivateProject = await helpers.get<AppHelper>('app').config<number | string>('disable_private_project', 0);
  return { is_private_project_enabled: disablePrivateProject == 0 || disablePrivateProject === '' };
}

/** Pre-resolved variables of `dashboard/overview.njk`. */
export interface DashboardOverviewVars {
  /** project id => `user.hasProjectAccess('ProjectViewController', 'show', id)` */
  project_access: Record<string, boolean>;
}

/** @param projects the collection of the project paginator (`project_paginator.getCollection()`) */
export async function prepareDashboardOverviewVars(
  helpers: HelperRegistry,
  projects: ReadonlyArray<{ id: unknown }>,
): Promise<DashboardOverviewVars> {
  const user = helpers.get<UserHelper>('user');
  const access: Record<string, boolean> = {};
  for (const project of projects) {
    access[String(project.id)] = await user.hasProjectAccess('ProjectViewController', 'show', project.id);
  }
  return { project_access: access };
}
