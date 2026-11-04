import type { Container } from '../core/container/container.js';

/** A database row as returned by the query layer. */
export type Row = Record<string, unknown>;

/**
 * Contract every model implements (port of `Kanboard\Model\*Model` classes extending `BaseModel`).
 * Models are lazily created by the container, receive it in their constructor and expose the
 * table they operate on.
 */
export interface ModelInterface {
  /** Name of the main table (PHP `const TABLE`). */
  getTable(): string;
}

/**
 * Contract of the concrete `BaseModel` written by the database task (`src/model/base-model.ts`).
 * Later milestones depend on this shape only; the DB task provides the implementation.
 */
export interface BaseModelContract extends ModelInterface {
  readonly container: Container;
  /** Generate a unique, 32 characters long, random token (PHP `BaseModel::generateToken`). */
  generateToken?(): string;
}

/** Constructor signature of a model class, as registered in the container. */
export type ModelConstructor<M extends ModelInterface = ModelInterface> = new (container: Container) => M;

/** Event payload keys shared by creation / modification events. */
export type EventData = Record<string, unknown>;
