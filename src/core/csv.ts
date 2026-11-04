import { readFile, writeFile } from 'node:fs/promises';
import { isNumeric } from '../helper/php.js';
import { t } from '../foundation/translator.js';

export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = CsvCell[];

/** Receives a row keyed by SQL column name and the (1 based) line number. */
export type CsvRowCallback = (row: Record<string, string>, lineNumber: number) => void | Promise<void>;

/** Minimal writable target (`process.stdout`, a test buffer...). */
export interface CsvOutput {
  write(chunk: string): unknown;
}

const BOM = '\uFEFF';

/** CSV Writer/Reader (port of `app/Core/Csv.php`, PHP `fputcsv`/`fgetcsv` semantics). */
export class Csv {
  private columns: Record<string, string> | string[] = [];

  constructor(
    private readonly delimiter = ',',
    private readonly enclosure = '"',
  ) {}

  /** List of delimiters. */
  static getDelimiters(): Record<string, string> {
    return {
      ',': t('Comma'),
      ';': t('Semi-colon'),
      '\\t': t('Tab'),
      '|': t('Vertical bar'),
    };
  }

  /** List of enclosures. */
  static getEnclosures(): Record<string, string> {
    return {
      '"': t('Double Quote'),
      "'": t('Single Quote'),
      '': t('None'),
    };
  }

  /** Check boolean field value. */
  static getBooleanValue(value: unknown): number {
    if (value !== undefined && value !== null && value !== '' && value !== 0 && value !== '0' && value !== false) {
      const text = String(value).trim().toLowerCase();
      return text === '1' || text[0] === 't' || text[0] === 'y' ? 1 : 0;
    }

    return 0;
  }

  /** Write the CSV to an output (PHP wrote to `php://output`). */
  static output(rows: CsvRow[], addBOM = false, out: CsvOutput = process.stdout): void {
    out.write(new Csv().format(rows, addBOM));
  }

  /** Define column mapping between CSV and SQL columns. */
  setColumnMapping(columns: Record<string, string> | string[]): this {
    this.columns = columns;
    return this;
  }

  /** Read a CSV file; the first line (header) is skipped and empty rows ignored. */
  async read(filename: string, callback: CsvRowCallback): Promise<this> {
    return this.readString((await readFile(filename)).toString('utf8'), callback);
  }

  /** Same as {@link read} for in-memory content. */
  async readString(content: string, callback: CsvRowCallback): Promise<this> {
    let lineNumber = 0;

    for (const record of this.parse(content)) {
      const row = this.filterRow(record);

      if (Object.keys(row).length > 0 && lineNumber > 0) {
        await callback(this.associateColumns(row), lineNumber);
      }

      lineNumber++;
    }

    return this;
  }

  /** Write a CSV file. */
  async write(filename: string, rows: CsvRow[], addBOM = false): Promise<this> {
    await writeFile(filename, this.format(rows, addBOM));
    return this;
  }

  /** CSV content (the BOM, when requested, is the UTF-8 byte order mark). */
  format(rows: CsvRow[], addBOM = false): string {
    let out = addBOM ? BOM : '';

    for (const row of rows) {
      out += `${row.map((cell) => this.formatField(this.neutralizeFormula(cell))).join(this.delimiter)}\n`;
    }

    return out;
  }

  /** PHP `fputcsv` field handling (escape char is a backslash). */
  private formatField(value: CsvCell): string {
    const field = value === null || value === undefined ? '' : typeof value === 'boolean' ? (value ? '1' : '') : String(value);
    const enclosure = this.enclosure;

    if (enclosure === '') {
      return field;
    }

    const needsQuotes = [this.delimiter, enclosure, '\\', '\n', '\r', '\t', ' '].some((c) => c !== '' && field.includes(c));

    if (!needsQuotes) {
      return field;
    }

    let escaped = false;
    let result = '';
    for (const ch of field) {
      if (ch === '\\') {
        escaped = true;
      } else if (!escaped && ch === enclosure) {
        result += enclosure;
      } else {
        escaped = false;
      }
      result += ch;
    }

    return `${enclosure}${result}${enclosure}`;
  }

  /** Prevent spreadsheet applications from interpreting a CSV cell as a formula. */
  private neutralizeFormula(value: CsvCell): CsvCell {
    if (typeof value === 'string' && value !== '' && !isNumeric(value) && '=+-@\t\r\n'.includes(value[0] as string)) {
      return `'${value}`;
    }

    return value;
  }

  /** Associate columns header with row values. */
  private associateColumns(row: Record<number, string>): Record<string, string> {
    const line: Record<string, string> = {};
    const names = Array.isArray(this.columns) ? this.columns.map((_, index) => String(index)) : Object.keys(this.columns);

    names.forEach((sqlName, index) => {
      line[sqlName] = row[index] !== undefined ? row[index] : '';
    });

    return line;
  }

  /** `array_filter`: drops empty values (including "0"), keeps the keys. */
  private filterRow(record: Array<string | null>): Record<number, string> {
    const row: Record<number, string> = {};
    record.forEach((value, index) => {
      if (value !== null && value !== '' && value !== '0') {
        row[index] = value;
      }
    });
    return row;
  }

  /** `fgetcsv` loop of `SplFileObject` (READ_CSV): a blank line is `[null]`. */
  private *parse(content: string): Generator<Array<string | null>> {
    const { delimiter, enclosure } = this;
    const length = content.length;
    let pos = 0;

    while (pos < length) {
      const record: Array<string | null> = [];
      let blank = true;

      for (;;) {
        let field = '';
        let quoted = false;

        if (enclosure !== '' && content[pos] === enclosure) {
          quoted = true;
          blank = false;
          pos++;
          for (;;) {
            if (pos >= length) break;
            const ch = content[pos] as string;
            if (ch === '\\' && content[pos + 1] === enclosure) {
              field += ch + enclosure;
              pos += 2;
            } else if (ch === enclosure) {
              if (content[pos + 1] === enclosure) {
                field += enclosure;
                pos += 2;
              } else {
                pos++;
                break;
              }
            } else {
              field += ch;
              pos++;
            }
          }
        }

        while (pos < length && content[pos] !== delimiter && content[pos] !== '\n' && !(content[pos] === '\r' && content[pos + 1] === '\n')) {
          field += content[pos];
          pos++;
        }

        if (!quoted && field !== '') blank = false;
        record.push(field);

        if (pos < length && content[pos] === delimiter) {
          blank = false;
          pos++;
          continue;
        }

        if (content[pos] === '\r') pos++;
        if (content[pos] === '\n') pos++;
        break;
      }

      yield blank && record.length === 1 ? [null] : record;
    }
  }
}

