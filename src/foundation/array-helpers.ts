import type { Row } from './model.js';

/** PHP `isset()` semantic on a row value: present and not null. */
function isSet(value: unknown): boolean {
  return value !== undefined && value !== null;
}

/**
 * Attach to every row of `input` the related rows found in `relations[row[column]]` under the key
 * `relation` (`[]` when there is no match). Port of `array_merge_relation()` (mutates the rows).
 */
export function arrayMergeRelation(
  input: Row[],
  relations: Record<string | number, unknown>,
  relation: string,
  column: string,
): void {
  for (const row of input) {
    const key = row[column];
    if (isSet(key) && isSet(relations[key as string | number])) {
      row[relation] = relations[key as string | number];
    } else {
      row[relation] = [];
    }
  }
}

/** Group rows by the value of a column (port of `array_column_index()`). */
export function arrayColumnIndex(input: Row[], column: string): Record<string, Row[]> {
  const result: Record<string, Row[]> = {};

  for (const row of input) {
    const key = row[column];
    if (isSet(key)) {
      (result[String(key)] ??= []).push(row);
    }
  }

  return result;
}

/** Index rows by the value of a column, the first row wins (port of `array_column_index_unique()`). */
export function arrayColumnIndexUnique(input: Row[], column: string): Record<string, Row> {
  const result: Record<string, Row> = {};

  for (const row of input) {
    const key = row[column];
    if (isSet(key) && result[String(key)] === undefined) {
      result[String(key)] = row;
    }
  }

  return result;
}

/** Sum the values of a column, rows without the column are ignored (port of `array_column_sum()`). */
export function arrayColumnSum(input: Row[], column: string): number {
  let sum = 0;

  for (const row of input) {
    const value = row[column];
    if (isSet(value)) {
      const number = Number(value);
      sum += Number.isNaN(number) ? 0 : number;
    }
  }

  return sum;
}

/** Values of a column (PHP `array_column`), rows without the column are skipped. */
export function arrayColumn<T = unknown>(input: Row[], column: string): T[] {
  return input.filter((row) => row[column] !== undefined).map((row) => row[column] as T);
}
