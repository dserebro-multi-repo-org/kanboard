import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import { collaborator } from '../foundation/formatter-collaborators.js';
import type { FormatterCollaborators } from '../foundation/formatter-collaborators.js';
import '../formatter/registry.js';
import '../service-provider/registry.js';
import './registry.js';

/** Shared helpers of the pagination classes (PHP `Core\Base` magic accessors). */
export abstract class BasePagination extends Base {
  constructor(container: Container) {
    super(container);
  }

  protected collaborator<K extends keyof FormatterCollaborators>(key: K): FormatterCollaborators[K] {
    return collaborator(this.container, key);
  }
}
