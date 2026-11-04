import { createHash } from 'node:crypto';
import { Base } from '../core/container/base.js';
import type { Container } from '../core/container/container.js';
import { getToken } from '../core/security/token.js';
import type { Database } from '../db/database.js';
import type { Table } from '../db/table.js';
import type { DbRow } from '../db/types.js';
import type { BaseModelContract } from '../foundation/model.js';

/**
 * Row convention shared by all models: every table has an integer primary key `id`.
 * A model declares the shape of its table with an interface extending it (loose columns are
 * still allowed through `DbRow` when the query builder is used with custom SELECTs):
 *
 * ```ts
 * interface TaskRow extends BaseRow { title: string; project_id: number }
 * class TaskModel extends BaseModel<TaskRow> { getTable() { return 'tasks'; } }
 * ```
 */
export interface BaseRow {
  id: number;
}

/**
 * Base class of the models (the PHP models extend `Core\Base` and use `$this->db`).
 * Subclasses provide the table name (PHP `const TABLE`) and use {@link db} / {@link table}
 * to build queries. All database access is asynchronous.
 */
export abstract class BaseModel<R extends object = DbRow> extends Base implements BaseModelContract {
  constructor(container: Container) {
    super(container);
  }

  /** Name of the main table. */
  abstract getTable(): string;

  /** Shortcut of `$this->db`. */
  protected get db(): Database {
    return this.service('db');
  }

  /** Query helper on the main table, or on another table when `name` is given. */
  protected table<T extends object = R>(name: string = this.getTable()): Table<T> {
    return this.db.table<T>(name);
  }

  /** Create (or fetch) an instance of the model bound to a container. */
  static getInstance<M extends BaseModel>(this: new (container: Container) => M, container: Container): M {
    return new this(container);
  }

  /** Generate a unique, random token (60 hexadecimal characters by default). */
  generateToken(length = 30): string {
    return getToken(length);
  }

  /** Hexadecimal digest of a string, `sha256` by default. */
  protected hash(value: string, algorithm = 'sha256'): string {
    return createHash(algorithm).update(value).digest('hex');
  }
}
