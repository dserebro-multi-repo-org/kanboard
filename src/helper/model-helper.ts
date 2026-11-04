import { HelperBase } from './helper-base.js';
import { isSet, phpEmpty, toInt } from './php.js';

type Fields = Record<string, unknown>;

const has = (values: Fields, key: string): boolean => Object.prototype.hasOwnProperty.call(values, key);

/** Port of `app/Helper/ModelHelper.php`. All methods mutate `values` in place (PHP by-reference arrays). */
export class ModelHelper extends HelperBase {
  /** Remove keys from an array. */
  removeFields(values: Fields, keys: readonly string[]): void {
    for (const key of keys) {
      if (has(values, key)) delete values[key];
    }
  }

  /** Remove keys from an array if empty. */
  removeEmptyFields(values: Fields, keys: readonly string[]): void {
    for (const key of keys) {
      if (has(values, key) && phpEmpty(values[key])) delete values[key];
    }
  }

  /** Force fields to be at 0 if empty. */
  resetFields(values: Fields, keys: readonly string[]): void {
    for (const key of keys) {
      if (isSet(values, key) && phpEmpty(values[key])) values[key] = 0;
    }
  }

  /** Force some fields to be integer. */
  convertIntegerFields(values: Fields, keys: readonly string[]): void {
    for (const key of keys) {
      if (isSet(values, key)) values[key] = toInt(values[key]);
    }
  }

  /** Force some fields to be null if empty. */
  convertNullFields(values: Fields, keys: readonly string[]): void {
    for (const key of keys) {
      if (has(values, key) && phpEmpty(values[key])) values[key] = null;
    }
  }
}
