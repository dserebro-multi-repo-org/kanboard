/** PSR-3 log levels. */
export const LogLevel = {
  EMERGENCY: 'emergency',
  ALERT: 'alert',
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  NOTICE: 'notice',
  INFO: 'info',
  DEBUG: 'debug',
} as const;

export type LogLevelName = (typeof LogLevel)[keyof typeof LogLevel];
export type LogContext = Record<string, unknown>;

/** Same priorities as `Kanboard\Core\Log\Logger::getLevelPriority()`. Unknown levels count as debug. */
export function getLevelPriority(level: string): number {
  switch (level) {
    case LogLevel.EMERGENCY:
      return 600;
    case LogLevel.ALERT:
      return 550;
    case LogLevel.CRITICAL:
      return 500;
    case LogLevel.ERROR:
      return 400;
    case LogLevel.WARNING:
      return 300;
    case LogLevel.NOTICE:
      return 250;
    case LogLevel.INFO:
      return 200;
    default:
      return 100;
  }
}

/** Syslog severities (RFC 5424). */
export function getSyslogPriority(level: string): number {
  switch (level) {
    case LogLevel.EMERGENCY:
      return 0;
    case LogLevel.ALERT:
      return 1;
    case LogLevel.CRITICAL:
      return 2;
    case LogLevel.ERROR:
      return 3;
    case LogLevel.WARNING:
      return 4;
    case LogLevel.NOTICE:
      return 5;
    case LogLevel.INFO:
      return 6;
    default:
      return 7;
  }
}
