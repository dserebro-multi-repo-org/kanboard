import type { DateParserLike } from '../foundation/filter-collaborators.js';
import { BaseFilter } from './base-filter.js';

/** Shared base for date filters that need a date parser collaborator. */
export abstract class DateParserFilter extends BaseFilter {
  protected dateParser!: DateParserLike;

  setDateParser(dateParser: DateParserLike): this {
    this.dateParser = dateParser;
    return this;
  }
}
