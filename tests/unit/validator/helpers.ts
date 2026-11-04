import { expect } from 'vitest';
import { parseDateFormat } from '../../../src/validator/simple-validator.js';
import type { ValidationResult, ValidatorDatabase, ValidatorTable, Values } from '../../../src/validator/simple-validator.js';
import type { DateParserLike, IdList } from '../../../src/foundation/validator-collaborators.js';

/** Colors registered by `ColorModel` (subset is enough: only the keys matter). */
export const COLORS: IdList = { yellow: 'Yellow', blue: 'Blue', green: 'Green', purple: 'Purple', red: 'Red', orange: 'Orange' };
export const colorModel = { getList: () => ({ ...COLORS }) };

type Row = Record<string, unknown>;

/** In-memory fake of the query surface used by the `Unique` / `Exists` rules. */
export class FakeDb implements ValidatorDatabase {
  readonly tables: Record<string, Row[]>;

  constructor(tables: Record<string, Row[]> = {}) {
    this.tables = tables;
  }

  table(name: string): ValidatorTable {
    const rows = this.tables[name] ?? [];
    const filters: Array<(row: Row) => boolean> = [];
    const query: ValidatorTable = {
      eq: (column, value) => {
        filters.push((row) => row[column] === value);
        return query;
      },
      neq: (column, value) => {
        filters.push((row) => row[column] !== value);
        return query;
      },
      exists: async () => rows.some((row) => filters.every((filter) => filter(row))),
    };
    return query;
  }
}

/** DateParser configured with the default user formats (`m/d/Y`, `m/d/Y H:i`). */
export const dateParser: DateParserLike = {
  getDateFormats: (iso = false) => ['m/d/Y', ...(iso ? ['Y-m-d', 'Y_m_d'] : []), 'm/d/Y', 'd/m/Y', 'Y/m/d', 'd.m.Y'],
  getTimeFormats: () => ['H:i', 'g:i a'],
  getParserFormats: () => ['m/d/Y', 'Y-m-d', 'Y_m_d', 'm/d/Y H:i', 'Y-m-d H:i', 'Y_m_d H:i'],
  getTimestamp(value) {
    if (/^\d+$/.test(String(value))) {
      return Number(value);
    }
    for (const format of this.getParserFormats()) {
      const timestamp = parseDateFormat(String(value), format);
      if (timestamp !== null && timestamp > 0) {
        return timestamp;
      }
    }
    return 0;
  },
};

/** Equivalent of `$result[0]` in the PHP tests. */
export const valid = (result: ValidationResult<unknown>): boolean => result[0];

/** Assert the validity flag (`$result[0]`) of every `[values, expectedValid]` case. */
export async function expectAll(method: (values: Values) => Promise<ValidationResult<unknown>>, cases: Array<[Values, boolean]>): Promise<void> {
  for (const [values, expected] of cases) {
    expect(valid(await method(values)), JSON.stringify(values)).toBe(expected);
  }
}
