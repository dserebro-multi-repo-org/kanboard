import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import type { Database } from '../db/database.js';
import { collaborator } from '../foundation/formatter-collaborators.js';
import type { FormatterCollaborators } from '../foundation/formatter-collaborators.js';
import '../service-provider/registry.js';

/** Shared accessors of the analytics (PHP `Core\Base` magic properties). */
export abstract class BaseAnalytic extends Base {
  constructor(container: Container) {
    super(container);
  }

  protected get db(): Database {
    return this.service('db');
  }

  protected collaborator<K extends keyof FormatterCollaborators>(key: K): FormatterCollaborators[K] {
    return collaborator(this.container, key);
  }
}
