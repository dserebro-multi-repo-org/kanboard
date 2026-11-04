import { inspect } from 'node:util';
import { LogLevel, type LogContext } from './levels.js';

/** PSR-3 like logger contract. */
export interface LoggerInterface {
  emergency(message: string, context?: LogContext): void;
  alert(message: string, context?: LogContext): void;
  critical(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  warning(message: string, context?: LogContext): void;
  notice(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  log(level: string, message: string, context?: LogContext): void;
}

/** A log destination with its own minimum level. */
export interface LogDriver extends LoggerInterface {
  setLevel(level: string): void;
  getLevel(): string;
  dump(variable: unknown): void;
}

export type LogFormat = 'text' | 'json';

/** Replace `{key}` placeholders by context values (PSR-3 interpolation). */
export function interpolate(message: string, context: LogContext = {}): string {
  return message.replace(/\{([A-Za-z0-9_.]+)\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(context, key)) return match;
    const value = context[key];
    if (typeof value === 'string') return value;
    if (value === null || value === undefined) return String(value);
    if (typeof value === 'object') return inspect(value, { breakLength: Infinity, depth: 4 });
    return String(value as number | boolean | bigint | symbol);
  });
}

/** `YYYY-MM-DD HH:MM:SS` in local time, like PHP `date('Y-m-d H:i:s')`. */
export function formatDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Base class of the drivers, port of `app/Core/Log/Base.php`. */
export abstract class BaseLogDriver implements LogDriver {
  private level: string = LogLevel.DEBUG;
  /** Output format: PHP compatible text line, or one JSON object per line. */
  protected format: LogFormat = 'text';
  /** Clock, overridable for tests. */
  protected now: () => Date = () => new Date();

  abstract log(level: string, message: string, context?: LogContext): void;

  setLevel(level: string): void {
    this.level = level;
  }

  getLevel(): string {
    return this.level;
  }

  setFormat(format: LogFormat): this {
    this.format = format;
    return this;
  }

  emergency(message: string, context?: LogContext): void {
    this.log(LogLevel.EMERGENCY, message, context);
  }
  alert(message: string, context?: LogContext): void {
    this.log(LogLevel.ALERT, message, context);
  }
  critical(message: string, context?: LogContext): void {
    this.log(LogLevel.CRITICAL, message, context);
  }
  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, message, context);
  }
  warning(message: string, context?: LogContext): void {
    this.log(LogLevel.WARNING, message, context);
  }
  notice(message: string, context?: LogContext): void {
    this.log(LogLevel.NOTICE, message, context);
  }
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /** Log any value at debug level (PHP `var_export`). */
  dump(variable: unknown): void {
    this.log(LogLevel.DEBUG, inspect(variable, { depth: 6, breakLength: Infinity }));
  }

  protected interpolate(message: string, context: LogContext = {}): string {
    return interpolate(message, context);
  }

  /** `[2024-01-01 10:00:00] [level] message\n` or a JSON line when format is `json`. */
  protected formatMessage(level: string, message: string, context: LogContext = {}): string {
    if (this.format === 'json') {
      return `${JSON.stringify({
        time: this.now().toISOString(),
        level,
        message: this.interpolate(message, context),
        context: safeContext(context),
      })}\n`;
    }
    return `[${formatDate(this.now())}] [${level}] ${this.interpolate(message, context)}\n`;
  }
}

function safeContext(context: LogContext): LogContext {
  const out: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    out[key] = value instanceof Error ? { name: value.name, message: value.message, stack: value.stack } : value;
  }
  return out;
}
