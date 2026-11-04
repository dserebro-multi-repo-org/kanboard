import { Base } from '../core/container/base.js';
import type { HelperInterface } from '../foundation/helper.js';
import type { HelperRegistry } from '../foundation/helper.js';

/**
 * Base class of the template helpers (PHP `Kanboard\Core\Base` subclass living in `app/Helper`).
 *
 * HTML returning methods return plain strings that are already escaped as in PHP: the Nunjucks template layer
 * (src/core/template) must mark helper output as safe so it is not escaped a second time.
 */
export abstract class HelperBase extends Base implements HelperInterface {
  /** The helper registry (PHP `$this->helper`). */
  protected get helpers(): HelperRegistry {
    return this.service('helper');
  }

  /** Resolve a sibling helper by registry name (PHP `$this->helper->name`). */
  protected helper<H extends HelperInterface>(name: string): H {
    return this.helpers.get<H>(name);
  }
}
