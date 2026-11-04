import { appendFileSync } from 'node:fs';
import { BaseLogDriver, type LogFormat } from './driver.js';
import { getSyslogPriority, type LogContext } from './levels.js';

/** Function receiving a fully formatted line (including trailing newline). */
export type LineWriter = (line: string) => void;

export interface DriverOptions {
  format?: LogFormat;
  /** Override where lines are written (tests, custom sinks). */
  writer?: LineWriter;
}

/** Writes formatted lines to stdout (`app/Core/Log/Stdout.php`). */
export class StdoutDriver extends BaseLogDriver {
  private readonly writer: LineWriter;

  constructor(options: DriverOptions = {}) {
    super();
    this.writer = options.writer ?? ((line) => void process.stdout.write(line));
    if (options.format) this.format = options.format;
  }

  log(level: string, message: string, context: LogContext = {}): void {
    this.writer(this.formatMessage(level, message, context));
  }
}

/** Writes formatted lines to stderr (`app/Core/Log/Stderr.php`). */
export class StderrDriver extends BaseLogDriver {
  private readonly writer: LineWriter;

  constructor(options: DriverOptions = {}) {
    super();
    this.writer = options.writer ?? ((line) => void process.stderr.write(line));
    if (options.format) this.format = options.format;
  }

  log(level: string, message: string, context: LogContext = {}): void {
    this.writer(this.formatMessage(level, message, context));
  }
}

/** Appends formatted lines to a file (`app/Core/Log/File.php`). Throws when the file is not writable. */
export class FileDriver extends BaseLogDriver {
  constructor(
    private readonly filename: string,
    options: DriverOptions = {},
  ) {
    super();
    if (options.format) this.format = options.format;
  }

  log(level: string, message: string, context: LogContext = {}): void {
    try {
      appendFileSync(this.filename, this.formatMessage(level, message, context));
    } catch (error) {
      throw new Error('Unable to write to the log file.', { cause: error });
    }
  }
}

/**
 * Equivalent of PHP `error_log()` (`app/Core/Log/System.php`): the "system" log of a Node process is stderr.
 * Output format is `[level] message`.
 */
export class SystemDriver extends BaseLogDriver {
  private readonly writer: LineWriter;

  constructor(options: DriverOptions = {}) {
    super();
    this.writer = options.writer ?? ((line) => void process.stderr.write(line));
    if (options.format) this.format = options.format;
  }

  log(level: string, message: string, context: LogContext = {}): void {
    if (this.format === 'json') {
      this.writer(this.formatMessage(level, message, context));
      return;
    }
    this.writer(`[${level}] ${this.interpolate(message, context)}\n`);
  }
}

/** Sends a syslog datagram payload, e.g. `<14>ident[123]: message`. */
export type SyslogTransport = (payload: string, severity: number) => void;

export interface SyslogOptions {
  ident?: string;
  /** Syslog facility number, default 1 (LOG_USER). */
  facility?: number;
  /** Defaults to writing the RFC 3164 formatted line to stderr (Node has no native syslog binding). */
  transport?: SyslogTransport;
}

/** Syslog driver (`app/Core/Log/Syslog.php`) with a pluggable transport. */
export class SyslogDriver extends BaseLogDriver {
  private readonly ident: string;
  private readonly facility: number;
  private readonly transport: SyslogTransport;

  constructor(options: SyslogOptions = {}) {
    super();
    this.ident = options.ident ?? 'kanboard';
    this.facility = options.facility ?? 1;
    this.transport = options.transport ?? ((payload) => void process.stderr.write(`${payload}\n`));
  }

  getSyslogPriority(level: string): number {
    return getSyslogPriority(level);
  }

  log(level: string, message: string, context: LogContext = {}): void {
    const severity = this.getSyslogPriority(level);
    const pri = this.facility * 8 + severity;
    this.transport(`<${pri}>${this.ident}[${process.pid}]: ${this.interpolate(message, context)}`, severity);
  }
}
