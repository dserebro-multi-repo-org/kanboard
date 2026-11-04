import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import type { FilterQuery } from '../core/filter/filter-interface.js';
import type { FormatterInterface } from '../core/filter/formatter-interface.js';
import type {
  AvatarHelperLike,
  FormatterCollaborators,
  ProjectRoleHelperLike,
  TextHelperLike,
  UrlHelperLike,
} from '../foundation/formatter-collaborators.js';
import { collaborator } from '../foundation/formatter-collaborators.js';
import type { Row } from '../foundation/model.js';
import '../service-provider/registry.js';
import './registry.js';

/** Port of `Kanboard\Formatter\BaseFormatter`: a formatter works on a query and returns the formatted result. */
export abstract class BaseFormatter extends Base implements FormatterInterface<Promise<unknown>> {
  protected query: FilterQuery | null = null;

  constructor(container: Container) {
    super(container);
  }

  /** Create an instance bound to a container (PHP `Base::getInstance`). */
  static getInstance<T extends BaseFormatter>(this: new (container: Container) => T, container: Container): T {
    return new this(container);
  }

  /** Set the query. */
  withQuery(query: FilterQuery): this {
    this.query = query;
    return this;
  }

  abstract format(): Promise<unknown>;

  /** The query set with {@link withQuery}; formatters that read the database require one. */
  protected get requiredQuery(): FilterQuery {
    if (this.query === null) {
      throw new Error(`${this.constructor.name}: no query defined, call withQuery() first`);
    }
    return this.query;
  }

  /** Run the query and return the rows. */
  protected async findRows(query: FilterQuery = this.requiredQuery): Promise<Row[]> {
    return (await query.findAll()) as Row[];
  }

  /** Collaborators of modules that are not migrated yet. */
  protected collaborator<K extends keyof FormatterCollaborators>(key: K): FormatterCollaborators[K] {
    return collaborator(this.container, key);
  }

  protected get urlHelper(): UrlHelperLike {
    return this.service('helper').get<UrlHelperLike>('url');
  }

  protected get textHelper(): TextHelperLike {
    return this.service('helper').get<TextHelperLike>('text');
  }

  protected get avatarHelper(): AvatarHelperLike {
    return this.service('helper').get<AvatarHelperLike>('avatar');
  }

  protected get projectRoleHelper(): ProjectRoleHelperLike {
    return this.service('helper').get<ProjectRoleHelperLike>('projectRole');
  }
}
