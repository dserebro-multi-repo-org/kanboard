import { BaseLogDriver, type LogDriver, type LoggerInterface } from './driver.js';
import { FileDriver, StderrDriver, StdoutDriver, SyslogDriver, SystemDriver } from './drivers.js';
import { getLevelPriority, LogLevel, type LogContext } from './levels.js';

/**
 * Aggregates log drivers and forwards a message to each driver whose minimum level is reached
 * (port of `app/Core/Log/Logger.php`).
 */
export class Logger implements LoggerInterface {
  private readonly drivers: LogDriver[] = [];

  getLevelPriority(level: string): number {
    return getLevelPriority(level);
  }

  /** Add a driver (PHP `setLogger`). */
  setLogger(driver: LogDriver): this {
    this.drivers.push(driver);
    return this;
  }

  getLoggers(): readonly LogDriver[] {
    return this.drivers;
  }

  log(level: string, message: string, context: LogContext = {}): void {
    for (const driver of this.drivers) {
      if (this.getLevelPriority(level) >= this.getLevelPriority(driver.getLevel())) {
        driver.log(level, message, context);
      }
    }
  }

  dump(variable: unknown): void {
    for (const driver of this.drivers) {
      if (this.getLevelPriority(LogLevel.DEBUG) >= this.getLevelPriority(driver.getLevel())) {
        driver.dump(variable);
      }
    }
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
}

export interface CreateLoggerOptions {
  driver: 'syslog' | 'stdout' | 'stderr' | 'system' | 'file';
  logFile?: string;
  debug?: boolean;
  format?: 'text' | 'json';
}

/**
 * Build a Logger like `app/ServiceProvider/LoggingProvider.php`: one driver selected by
 * `LOG_DRIVER`, level `debug` when `DEBUG` is on, `info` otherwise.
 */
export function createLogger(options: CreateLoggerOptions): Logger {
  const logger = new Logger();
  const format = options.format ? { format: options.format } : {};
  let driver: BaseLogDriver;

  switch (options.driver) {
    case 'syslog':
      driver = new SyslogDriver({ ident: 'kanboard' });
      break;
    case 'stdout':
      driver = new StdoutDriver(format);
      break;
    case 'stderr':
      driver = new StderrDriver(format);
      break;
    case 'file':
      driver = new FileDriver(options.logFile ?? 'debug.log', format);
      break;
    case 'system':
    default:
      driver = new SystemDriver(format);
      break;
  }

  driver.setLevel(options.debug ? LogLevel.DEBUG : LogLevel.INFO);
  return logger.setLogger(driver);
}
