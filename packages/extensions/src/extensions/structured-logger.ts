/**
 * Structured Logger Extension
 * 
 * This extension provides structured logging capabilities with support
 * for different log levels, formatting, and event bus integration.
 */

import { Extension, ExtensionPoint, ExtensionHookHandler } from '../models.js';
import { Event } from '../models.js';

/**
 * Log levels
 */
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

/**
 * Logger options
 */
export interface LoggerOptions {
  /**
   * Minimum log level to output
   */
  minLevel: LogLevel;

  /**
   * Whether to include timestamps
   */
  includeTimestamp?: boolean;

  /**
   * Whether to format logs as JSON
   */
  formatAsJson?: boolean;

  /**
   * Custom formatter function
   */
  formatter?: (level: LogLevel, message: string, context?: any) => string;
}

/**
 * Structured Logger Extension
 */
export class StructuredLoggerExtension implements Extension {
  name = 'structured-logger';
  description = 'Provides structured logging capabilities';

  private options: LoggerOptions;
  private logLevels: Record<LogLevel, number> = {
    [LogLevel.ERROR]: 0,
    [LogLevel.WARN]: 1,
    [LogLevel.INFO]: 2,
    [LogLevel.DEBUG]: 3
  };

  hooks: Record<string, ExtensionHookHandler> = {
    'event-bus:publish': this.handleEventBusPublish.bind(this)
  };

  constructor(options: Partial<LoggerOptions> = {}) {
    this.options = {
      minLevel: options.minLevel || LogLevel.INFO,
      includeTimestamp: options.includeTimestamp ?? true,
      formatAsJson: options.formatAsJson ?? false,
      formatter: options.formatter
    };
  }

  /**
   * Log an error message
   */
  error(message: string, context?: any): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: any): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: any): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: any): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log a message at the specified level
   */
  private log(level: LogLevel, message: string, context?: any): void {
    if (this.logLevels[level] > this.logLevels[this.options.minLevel]) {
      return;
    }

    let logMessage: string;

    if (this.options.formatter) {
      logMessage = this.options.formatter(level, message, context);
    } else if (this.options.formatAsJson) {
      logMessage = this.formatJson(level, message, context);
    } else {
      logMessage = this.formatText(level, message, context);
    }

    console.log(logMessage);
  }

  /**
   * Format log as JSON
   */
  private formatJson(level: LogLevel, message: string, context?: any): string {
    const logEntry = {
      level,
      message,
      timestamp: this.options.includeTimestamp ? new Date().toISOString() : undefined,
      ...context
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Format log as text
   */
  private formatText(level: LogLevel, message: string, context?: any): string {
    const parts = [
      this.options.includeTimestamp ? `[${new Date().toISOString()}]` : '',
      `[${level}]`,
      message
    ];

    if (context) {
      parts.push(JSON.stringify(context));
    }

    return parts.filter(Boolean).join(' ');
  }

  /**
   * Handle event bus publish
   */
  private async handleEventBusPublish(context: any): Promise<any> {
    const { event, error } = context;

    // Log event
    this.info('Event published', {
      type: event.type,
      payload: event.payload
    });

    // Log error if present
    if (error) {
      this.error('Event processing error', {
        type: event.type,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return context;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // No cleanup needed
  }
} 