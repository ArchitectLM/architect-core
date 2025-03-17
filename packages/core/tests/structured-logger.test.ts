/**
 * Tests for the StructuredLogger implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StructuredLogger, LogLevel } from '../src/implementations/structured-logger.js';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;
  let consoleInfoSpy: any;
  let consoleDebugSpy: any;

  beforeEach(() => {
    // Create a new logger with default settings
    logger = new StructuredLogger({ 
      name: 'test-logger',
      level: LogLevel.TRACE, // Ensure TRACE level is enabled
      includeTimestamp: true
    });

    // Spy on console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console methods
    vi.restoreAllMocks();
  });

  describe('GIVEN a structured logger', () => {
    describe('WHEN logging at different levels', () => {
      it('THEN should log at the appropriate level', () => {
        // When logging at different levels
        logger.error('Error message');
        logger.warn('Warning message');
        logger.info('Info message');
        logger.debug('Debug message');
        logger.trace('Trace message');

        // Then the appropriate console methods should be called
        expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
        expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
        // Both debug and trace use console.debug
        expect(consoleDebugSpy).toHaveBeenCalledTimes(2);
      });

      it('THEN should respect the configured log level', () => {
        // Given a logger with INFO level
        const infoLogger = new StructuredLogger({ 
          name: 'info-logger',
          level: LogLevel.INFO
        });

        // When logging at different levels
        infoLogger.error('Error message');
        infoLogger.warn('Warning message');
        infoLogger.info('Info message');
        infoLogger.debug('Debug message');
        infoLogger.trace('Trace message');

        // Then only levels >= INFO should be logged
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(consoleInfoSpy).toHaveBeenCalled();
        expect(consoleDebugSpy).not.toHaveBeenCalled();
      });
    });

    describe('WHEN logging with context', () => {
      it('THEN should include the context in the log message', () => {
        // When logging with context
        logger.info('User logged in', { userId: '123', role: 'admin' });

        // Then the context should be included in the log message
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('User logged in'),
          expect.objectContaining({
            context: expect.objectContaining({
              userId: '123',
              role: 'admin'
            })
          })
        );
      });
    });

    describe('WHEN creating a child logger', () => {
      it('THEN should inherit settings from the parent', () => {
        // When creating a child logger
        const childLogger = logger.child({ component: 'auth-service' });

        // And logging with the child logger
        childLogger.info('User authenticated');

        // Then the log should include the parent context and the child context
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('User authenticated'),
          expect.objectContaining({
            context: expect.objectContaining({
              component: 'auth-service'
            })
          })
        );
      });

      it('THEN should merge contexts when logging with additional context', () => {
        // Given a child logger with context
        const childLogger = logger.child({ component: 'auth-service' });

        // When logging with additional context
        childLogger.info('User authenticated', { userId: '123', method: 'oauth' });

        // Then the log should include all context properties
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('User authenticated'),
          expect.objectContaining({
            context: expect.objectContaining({
              component: 'auth-service',
              userId: '123',
              method: 'oauth'
            })
          })
        );
      });
    });

    describe('WHEN configuring output format', () => {
      it('THEN should include timestamps when configured', () => {
        // Given a logger with timestamps enabled
        const timestampLogger = new StructuredLogger({ 
          name: 'timestamp-logger',
          includeTimestamp: true
        });

        // When logging a message
        timestampLogger.info('Test message');

        // Then the log should include a timestamp
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('Test message'),
          expect.objectContaining({
            timestamp: expect.any(String)
          })
        );
      });

      it('THEN should not include timestamps when disabled', () => {
        // Given a logger with timestamps disabled
        const noTimestampLogger = new StructuredLogger({ 
          name: 'no-timestamp-logger',
          includeTimestamp: false
        });

        // When logging a message
        noTimestampLogger.info('Test message');

        // Then the log should not include a timestamp
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('Test message'),
          expect.not.objectContaining({
            timestamp: expect.any(String)
          })
        );
      });
    });
  });
}); 