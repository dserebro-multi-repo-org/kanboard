/**
 * Minimal contracts of the collaborators the filters need and that are not migrated yet
 * (`Core\DateParser`, `Model\ColorModel`). The real classes satisfy them structurally.
 */

/** Subset of `Kanboard\Core\DateParser` used by the date filters. */
export interface DateParserLike {
  /** ISO date (or relative expression) to the timestamp of the beginning of that day. */
  getTimestampFromIsoFormat(value: string): number | false;
  /** Date string in one of the configured formats (or a digits-only timestamp) to a timestamp, 0 when invalid. */
  getTimestamp(value: string): number | false | Promise<number | false>;
  /** Synchronous variant (real `DateParser.getTimestampSync`, requires a prior `preload()`). */
  getTimestampSync?(value: string): number | false;
}

/** Subset of `Kanboard\Model\ColorModel` used by the color filter. */
export interface ColorModelLike {
  /** Color id from a color id or a color name (case-insensitive); empty/unknown handling is the model's. */
  find(color: string): string;
}
