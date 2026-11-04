import { DateParserFilter } from './date-parser-filter.js';

const OPERATORS: ReadonlyArray<readonly [string, 'lte' | 'gte' | 'lt' | 'gt']> = [
  ['<=', 'lte'],
  ['>=', 'gte'],
  ['<', 'lt'],
  ['>', 'gt'],
];

/** Port of `Kanboard\Filter\BaseDateFilter`: date comparison with an optional operator prefix. */
export abstract class BaseDateFilter extends DateParserFilter {
  /** Strip the operator from the value and return the matching query method, `''` when there is none. */
  protected parseOperator(): 'lte' | 'gte' | 'lt' | 'gt' | '' {
    const value = this.stringValue;

    for (const [operator, method] of OPERATORS) {
      if (value.startsWith(operator)) {
        this.value = value.slice(operator.length);
        return method;
      }
    }

    return '';
  }

  protected applyDateFilter(field: string): void {
    const method = this.parseOperator();
    const timestamp = Number(this.dateParser.getTimestampFromIsoFormat(this.stringValue));

    if (method !== '') {
      this.query[method](field, this.getTimestampFromOperator(method, timestamp));
    } else {
      this.query.gte(field, timestamp);
      this.query.lte(field, timestamp + 86399);
    }
  }

  protected getTimestampFromOperator(method: string, timestamp: number): number {
    switch (method) {
      case 'lte':
        return timestamp + 86399;
      case 'lt':
        return timestamp;
      case 'gte':
        return timestamp;
      case 'gt':
        return timestamp + 86400;
    }

    return timestamp;
  }
}
