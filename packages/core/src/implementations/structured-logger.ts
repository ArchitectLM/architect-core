/**
 * Structured Logger Implementation
 * 
 * This module provides a structured logging system with support for log levels,
 * context, and child loggers.
 */

/**
 * Log levels in order of severity (highest to lowest)
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /**
   * Logger name
   */
  name: string;

  /**
   * Minimum log level to output
   * @default LogLevel.INFO
   */
  level?: LogLevel;

  /**
   * Whether to include timestamps in log output
   * @default true
   */
  includeTimestamp?: boolean;

  /**
   * Base context to include with all log messages
   */
  context?: Record<string, any>;
}

/**
 * Structured logger implementation
 */
export class StructuredLogger {
  private name: string;
  private level: LogLevel;
  private includeTimestamp: boolean;
  private context: Record<string, any>;

  /**
   * Create a new structured logger
   * 
   * @param options Logger configuration options
   */
  constructor(options: LoggerOptions) {
    this.name = options.name;
    this.level = options.level ?? LogLevel.INFO;
    this.includeTimestamp = options.includeTimestamp ?? true;
    this.context = options.context ?? {};
  }

  /**
   * Create a child logger with additional context
   * 
   * @param context Additional context to include with all log messages
   * @returns A new logger instance with the combined context
   */
  child(context: Record<string, any>): StructuredLogger {
    return new StructuredLogger({
      name: this.name,
      level: this.level,
      includeTimestamp: this.includeTimestamp,
      context: { ...this.context, ...context }
    });
  }

  /**
   * Log an error message
   * 
   * @param message The message to log
   * @param context Additional context for this specific log message
   */
  error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log a warning message
   * 
   * @param message The message to log
   * @param context Additional context for this specific log message
   */
  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   * 
   * @param message The message to log
   * @param context Additional context for this specific log message
   */
  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   * 
   * @param message The message to log
   * @param context Additional context for this specific log message
   */
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log a trace message
   * 
   * @param message The message to log
   * @param context Additional context for this specific log message
   */
  trace(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Internal method to log a message at a specific level
   * 
   * @param level The log level
   * @param message The message to log
   * @param context Additional context for this specific log message
   */
  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    // Skip if the log level is higher than the configured level
    if (level > this.level) {
      return;
    }

    // Format the log message
    const formattedMessage = `[${this.name}] ${message}`;

    // Build the log metadata
    const metadata: Record<string, any> = {
      level: LogLevel[level],
      context: { ...this.context, ...(context || {}) }
    };

    // Add timestamp if enabled
    if (this.includeTimestamp) {
      metadata.timestamp = new Date().toISOString();
    }

    // Output the log message to the appropriate console method
    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, metadata);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, metadata);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, metadata);
        break;
      case LogLevel.DEBUG:
        console.debug(formattedMessage, metadata);
        break;
      case LogLevel.TRACE:
        console.debug(formattedMessage, metadata);
        break;
      default:
        console.log(formattedMessage, metadata);
    }
  }
} 