import type { HelperRegistry } from '../foundation/helper.js';
import { registerBatchAHelpers } from './batch-a.js';

export { registerBatchAHelpers } from './batch-a.js';
export { HelperBase } from './helper-base.js';
export {
  AppHelper,
  AssetHelper,
  FileHelper,
  FormHelper,
  HookHelper,
  LayoutHelper,
  MailHelper,
  ModalHelper,
  ModelHelper,
  TextHelper,
  UrlHelper,
} from './batch-a.js';

/**
 * Register every template helper (counterpart of `app/ServiceProvider/HelperProvider.php`).
 * Batch B (user, task, subtask, board, comment, date, avatar, projectActivity, projectHeader, projectRole) exports
 * `registerBatchBHelpers` from `./batch-b.ts`: add its import and call below when that file lands.
 */
export function registerHelpers(registry: HelperRegistry): HelperRegistry {
  registerBatchAHelpers(registry);
  return registry;
}
