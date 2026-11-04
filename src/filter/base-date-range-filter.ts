import type { DateParserLike } from '../foundation/filter-collaborators.js';
import { BaseFilter } from './base-filter.js';

/** Port of `Kanboard\Filter\BaseDateRangeFilter`: `from..to` date ranges. */
export abstract class BaseDateRangeFilter extends BaseFilter {
  protected dateParser!: DateParserLike;

  setDateParser(dateParser: DateParserLike): this {
    this.dateParser = dateParser;
    return this;
  }

  private timestamp(value: string): number {
    const parser = this.dateParser;
    if (parser.getTimestampSync !== undefined) return Number(parser.getTimestampSync(value));
    const result = parser.getTimestamp(value);
    return result instanceof Promise ? 0 : Number(result);
  }

  protected applyDateFilter(field: string): void {
    const dates = this.stringValue.split('..');

    if (dates.length === 2) {
      const timestampFrom = this.timestamp(`${dates[0]} 00:00`);
      const timestampTo = this.timestamp(`${dates[1]} 00:00`);

      this.query.gte(field, timestampFrom);
      this.query.lte(field, timestampTo + 86399);
    }
  }
}
