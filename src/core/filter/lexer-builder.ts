import type { FilterInterface, FilterQuery } from './filter-interface.js';
import { Lexer } from './lexer.js';
import { OrCriteria } from './or-criteria.js';
import { QueryBuilder } from './query-builder.js';

/** Port of `Kanboard\Core\Filter\LexerBuilder`: parses a query string and applies the matching filters. */
export class LexerBuilder {
  protected lexer = new Lexer();
  protected query: FilterQuery | undefined;
  protected filters: Record<string, FilterInterface> = {};
  protected queryBuilder = new QueryBuilder();

  /** Register a filter for each of its attributes; `isDefault` makes it handle the free text. */
  withFilter(filter: FilterInterface, isDefault = false): this {
    for (const attribute of filter.getAttributes()) {
      this.filters[attribute] = filter;
      this.lexer.addToken(new RegExp(`^(${attribute}:)`, 'iu'), attribute);

      if (isDefault) {
        this.lexer.setDefaultToken(attribute);
      }
    }

    return this;
  }

  withQuery(query: FilterQuery): this {
    this.query = query;
    this.queryBuilder.withQuery(query);
    return this;
  }

  /** Parse the input and build the query. */
  build(input: string | null | undefined): QueryBuilder {
    const tokens = this.lexer.tokenize(input);

    for (const [token, values] of Object.entries(tokens)) {
      const filter = this.filters[token];

      if (filter !== undefined && Object.hasOwn(this.filters, token)) {
        this.applyFilters(filter, values);
      }
    }

    return this.queryBuilder;
  }

  protected applyFilters(filter: FilterInterface, values: string[]): void {
    if (values.length > 1) {
      const criteria = new OrCriteria();

      if (this.query !== undefined) {
        criteria.withQuery(this.query);
      }

      for (const value of values) {
        criteria.withFilter(filter.clone().withValue(value));
      }

      this.queryBuilder.withCriteria(criteria);
    } else if (values.length === 1) {
      this.queryBuilder.withFilter(filter.withValue(values[0] as string));
    }
  }

  /** Deep copy of the lexer, query and query builder (PHP `__clone`). */
  clone(): this {
    const copy = Object.create(Object.getPrototypeOf(this) as object) as this;
    Object.assign(copy, this);
    copy.lexer = this.lexer.clone();
    copy.query = this.query?.clone();
    copy.queryBuilder = this.queryBuilder.clone();
    return copy;
  }
}
