import type { HelperRegistry } from '../foundation/helper.js';
import { AppHelper } from './app-helper.js';
import { AssetHelper } from './asset-helper.js';
import { FileHelper } from './file-helper.js';
import { FormHelper } from './form-helper.js';
import { HookHelper } from './hook-helper.js';
import { LayoutHelper } from './layout-helper.js';
import { MailHelper } from './mail-helper.js';
import { ModalHelper } from './modal-helper.js';
import { ModelHelper } from './model-helper.js';
import { TextHelper } from './text-helper.js';
import { UrlHelper } from './url-helper.js';

/** Register the batch A helpers under the names used by `app/ServiceProvider/HelperProvider.php`. */
export function registerBatchAHelpers(registry: HelperRegistry): HelperRegistry {
  return registry
    .register('app', AppHelper)
    .register('asset', AssetHelper)
    .register('file', FileHelper)
    .register('form', FormHelper)
    .register('hook', HookHelper)
    .register('layout', LayoutHelper)
    .register('mail', MailHelper)
    .register('modal', ModalHelper)
    .register('model', ModelHelper)
    .register('text', TextHelper)
    .register('url', UrlHelper);
}

export { AppHelper, AssetHelper, FileHelper, FormHelper, HookHelper, LayoutHelper, MailHelper, ModalHelper, ModelHelper, TextHelper, UrlHelper };
