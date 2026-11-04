import type { DateParserLike } from '../foundation/filter-collaborators.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\BaseDateRangeFilter`: `from..to` date ranges. */
export abstract class BaseDateRangeFilter extends BaseFilter {
  protected dateParser!: DateParserLike;

  setDateParser(dateParser: DateParserLike): this {
    this.dateParser = dateParser;
    return this;
  }

  protected applyDateFilter(field: string): void {
    const dates = this.stringValue.split('..');

    if (dates.length === 2) {
      const timestampFrom = Number(this.dateParser.getTimestamp(`${dates[0]} 00:00`));
      const timestampTo = Number(this.dateParser.getTimestamp(`${dates[1]} 00:00`));

      this.query.gte(field, timestampFrom);
      this.query.lte(field, timestampTo + 86399);
    }
  }
}
