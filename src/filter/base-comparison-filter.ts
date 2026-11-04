import { BaseFilter } from './base-filter.js';

const OPERATORS: ReadonlyArray<readonly [string, 'lte' | 'gte' | 'lt' | 'gt']> = [
  ['<=', 'lte'],
  ['>=', 'gte'],
  ['<', 'lt'],
  ['>', 'gt'],
];

/** Port of `Kanboard\Filter\BaseComparisonFilter`: optional `<`, `<=`, `>`, `>=` prefix on the value. */
export abstract class BaseComparisonFilter extends BaseFilter {
  /** Strip the operator from the value and return the matching query method (`eq` by default). */
  protected parseOperator(): 'lte' | 'gte' | 'lt' | 'gt' | 'eq' {
    const value = this.stringValue;

    for (const [operator, method] of OPERATORS) {
      if (value.startsWith(operator)) {
        this.value = value.slice(operator.length);
        return method;
      }
    }

    return 'eq';
  }

  protected applyComparisonFilter(field: string): void {
    const method = this.parseOperator();
    this.query[method](field, this.value as string);
  }
}
