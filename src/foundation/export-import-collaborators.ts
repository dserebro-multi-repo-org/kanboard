/**
 * Contracts of the not-yet-migrated collaborators of `app/Export/*` and `app/Import/*`
 * (models, helpers, external link manager). The real classes satisfy them structurally; they are looked up in the
 * container under their PHP service names and may be sync or async. Stubs are removed in M15.
 */
import { sprintf, t } from './translator.js';

type MaybePromise<T> = T | Promise<T>;
type Row = Record<string, unknown>;

/** PHP `e()`: translate without escaping the arguments. */
export function e(message: string, ...args: unknown[]): string {
  return args.length === 0 ? t(message) : sprintf(message, args);
}

/** PHP `explode_csv_field()`: comma separated list, trimmed, empty items dropped. */
export function explodeCsvField(value: string): string[] {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '' && item !== '0');
}

export interface SubtaskModelLike {
  getStatusList(): MaybePromise<Record<string | number, string>>;
}

export interface TaskTagModelLike {
  getTagsByTaskIds(taskIds: number[]): MaybePromise<Record<string | number, Array<{ name: string }>>>;
  save(projectId: number, taskId: number, tags: string[]): MaybePromise<boolean>;
}

export interface ColorModelLike {
  getList(): MaybePromise<Record<string, string>>;
  /** Color id from an id or a name. */
  find(color: string): MaybePromise<string>;
}

export interface TransitionModelLike {
  getAllByProjectAndDate(projectId: number, from: number | string, to: number | string): MaybePromise<Row[]>;
}

export interface TaskCreationModelLike {
  create(values: Row): MaybePromise<number | false>;
}

export interface UserImportModelLike {
  getIdByUsername(username: string): MaybePromise<number | false | null | undefined>;
  create(values: Row): MaybePromise<number | false>;
}

export interface ColumnImportModelLike {
  getColumnIdByTitle(projectId: number, title: string): MaybePromise<number | false | null | undefined>;
}

export interface CategoryImportModelLike {
  getIdByName(projectId: number, name: string): MaybePromise<number | false | null | undefined>;
}

export interface SwimlaneImportModelLike {
  getIdByName(projectId: number, name: string): MaybePromise<number | false | null | undefined>;
}

/** `ModelHelper::removeEmptyFields()`: drops the listed fields when empty (mutates and returns). */
export interface ModelHelperLike {
  removeEmptyFields(values: Row, fields: string[]): void;
}

export interface ExternalLinkDescription {
  getTitle(): string;
  getUrl(): string;
}

export interface ExternalLinkProviderLike {
  getLink(): ExternalLinkDescription;
  getDependencies(): Record<string, string>;
  getType(): string;
}

/** `ExternalLinkProviderNotFound`. */
export class ExternalLinkProviderNotFound extends Error {
  constructor(message = 'Unable to find an external link provider for the given input') {
    super(message);
    this.name = 'ExternalLinkProviderNotFound';
  }
}

export interface ExternalLinkManagerLike {
  setUserInputText(text: string): this;
  setUserInputType(type: string): this;
  find(): MaybePromise<ExternalLinkProviderLike>;
}

/** `ExternalLinkManager::TYPE_AUTO`. */
export const EXTERNAL_LINK_TYPE_AUTO = 'auto';

export interface ExternalLinkValidatorLike {
  validateCreation(values: Row): MaybePromise<[boolean, Record<string, string[]>]>;
}

export interface TaskExternalLinkModelLike {
  create(values: Row): MaybePromise<number | false>;
}

export interface UserNotificationTypeModelLike {
  saveSelectedTypes(userId: number, types: string[]): MaybePromise<unknown>;
}

/** `MailNotification::TYPE` / `WebNotification::TYPE`. */
export const MAIL_NOTIFICATION_TYPE = 'email';
export const WEB_NOTIFICATION_TYPE = 'web';
