import { isNumeric } from '../helper/php.js';
import type { DateParser } from '../core/date-parser.js';

/** `is_numeric($from) ? $from : removeTimeFromTimestamp(getTimestamp($from))` */
export async function toStart(dateParser: DateParser, from: number | string): Promise<number> {
  if (isNumeric(from)) return Number(from);
  return dateParser.removeTimeFromTimestamp(await dateParser.getTimestamp(from));
}

/** `is_numeric($to) ? $to : removeTimeFromTimestamp(strtotime('+1 day', getTimestamp($to)))` */
export async function toEnd(dateParser: DateParser, to: number | string): Promise<number> {
  if (isNumeric(to)) return Number(to);
  const timestamp = await dateParser.getTimestamp(to);
  return dateParser.removeTimeFromTimestamp(addOneDay(timestamp));
}

function addOneDay(timestamp: number): number {
  const d = new Date(timestamp * 1000);
  d.setDate(d.getDate() + 1);
  return Math.floor(d.getTime() / 1000);
}
