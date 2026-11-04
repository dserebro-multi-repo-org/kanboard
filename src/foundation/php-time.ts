const UNITS: Record<string, number> = {
  sec: 1,
  second: 1,
  min: 60,
  minute: 60,
  hour: 3600,
  day: 86400,
  week: 604800,
};

function startOfDay(date: Date): number {
  return Math.floor(new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 1000);
}

/**
 * Small subset of PHP `strtotime()`: digits (timestamp), `now`, `today`, `midnight`, `tomorrow`,
 * `yesterday`, `[+-]N unit(s)` and `last|next unit` relative expressions, `YYYY-MM-DD[ HH:MM[:SS]]` in local time and
 * anything `Date.parse` understands. Returns `false` when the expression is not understood.
 */
export function strtotime(input: string, now: Date = new Date()): number | false {
  const text = input.trim().toLowerCase();

  if (/^\d+$/.test(text)) return Number(text);
  if (text === 'now' || text === '') return Math.floor(now.getTime() / 1000);
  if (text === 'today' || text === 'midnight') return startOfDay(now);
  if (text === 'tomorrow') return startOfDay(now) + 86400;
  if (text === 'yesterday') return startOfDay(now) - 86400;

  const relative = /^(?:([+-]?\d+)|(last|next|previous))\s*(sec|second|min|minute|hour|day|week|month|year)s?(\s+ago)?$/.exec(text);
  if (relative !== null) {
    let amount = relative[1] !== undefined ? Number(relative[1]) : relative[2] === 'next' ? 1 : -1;
    if (relative[4] !== undefined) amount = -amount;
    const unit = relative[3] as string;

    if (unit === 'month' || unit === 'year') {
      const date = new Date(now.getTime());
      if (unit === 'month') date.setMonth(date.getMonth() + amount);
      else date.setFullYear(date.getFullYear() + amount);
      return Math.floor(date.getTime() / 1000);
    }

    return Math.floor(now.getTime() / 1000) + amount * (UNITS[unit] as number);
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ t](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(text);
  if (iso !== null) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), Number(iso[4] ?? 0), Number(iso[5] ?? 0), Number(iso[6] ?? 0));
    return Math.floor(date.getTime() / 1000);
  }

  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? false : Math.floor(parsed / 1000);
}
