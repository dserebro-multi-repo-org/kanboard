import type { Container } from '../../core/container/container.js';
import type { HelperRegistry } from '../../foundation/helper.js';
import type { AppHelper } from '../../helper/app-helper.js';
import type { UserHelper } from '../../helper/user-helper.js';

/** Pre-resolved variables of `header.njk` and the `header/*` templates. */
export interface HeaderVars {
  /** `user.hasNotifications()` */
  has_notifications: boolean;
  /** `app.config('disable_private_project', 0) == 0` */
  is_private_project_enabled: boolean;
  /** The `DISABLE_LOGOUT` constant. */
  disable_logout: boolean;
}

export async function prepareHeaderVars(helpers: HelperRegistry, container: Container): Promise<HeaderVars> {
  const disablePrivateProject = await helpers.get<AppHelper>('app').config<number | string>('disable_private_project', 0);
  return {
    has_notifications: await helpers.get<UserHelper>('user').hasNotifications(),
    // PHP loose comparison `== 0` (also true for '' and '0')
    is_private_project_enabled: disablePrivateProject == 0 || disablePrivateProject === '',
    disable_logout: Boolean(container.get('config').DISABLE_LOGOUT),
  };
}
