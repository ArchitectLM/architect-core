/**
 * Structured Logger Extension Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StructuredLoggerExtension } from '../src/extensions/structured-logger.js';
import { Event } from '../src/models.js';

describe('StructuredLoggerExtension', () => {
  let extension: StructuredLoggerExtension;
  let mockConsole: {
    log: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockConsole = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn()
    };

    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(mockConsole.log);
    vi.spyOn(console, 'error').mockImplementation(mockConsole.error);
    vi.spyOn(console, 'warn').mockImplementation(mockConsole.warn);
    vi.spyOn(console, 'info').mockImplementation(mockConsole.info);
    vi.spyOn(console, 'debug').mockImplementation(mockConsole.debug);

    extension = new StructuredLoggerExtension({
      level: 'debug',
      format: 'json',
      includeTimestamp: true,
      includeContext: true
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Log Levels', () => {
    it('should log error messages', () => {
      const message = 'Test error message';
      const error = new Error('Test error');
      const context = { userId: '123', action: 'test' };

      extension.error(message, { error, context });

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const logCall = mockConsole.error.mock.calls[0][0];
      expect(logCall).toContain(message);
      expect(logCall).toContain('error');
      expect(logCall).toContain('userId');
      expect(logCall).toContain('action');
    });

    it('should log warning messages', () => {
      const message = 'Test warning message';
      const context = { userId: '123', action: 'test' };

      extension.warn(message, { context });

      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      const logCall = mockConsole.warn.mock.calls[0][0];
      expect(logCall).toContain(message);
      expect(logCall).toContain('warn');
      expect(logCall).toContain('userId');
      expect(logCall).toContain('action');
    });

    it('should log info messages', () => {
      const message = 'Test info message';
      const context = { userId: '123', action: 'test' };

      extension.info(message, { context });

      expect(mockConsole.info).toHaveBeenCalledTimes(1);
      const logCall = mockConsole.info.mock.calls[0][0];
      expect(logCall).toContain(message);
      expect(logCall).toContain('info');
      expect(logCall).toContain('userId');
      expect(logCall).toContain('action');
    });

    it('should log debug messages', () => {
      const message = 'Test debug message';
      const context = { userId: '123', action: 'test' };

      extension.debug(message, { context });

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      const logCall = mockConsole.debug.mock.calls[0][0];
      expect(logCall).toContain(message);
      expect(logCall).toContain('debug');
      expect(logCall).toContain('userId');
      expect(logCall).toContain('action');
    });
  });

  describe('Log Formatting', () => {
    it('should format logs as JSON when configured', () => {
      const message = 'Test message';
      const context = { userId: '123', action: 'test' };

      extension.info(message, { context });

      const logCall = mockConsole.info.mock.calls[0][0];
      expect(() => JSON.parse(logCall)).not.toThrow();
      const parsedLog = JSON.parse(logCall);
      expect(parsedLog).toMatchObject({
        level: 'info',
        message,
        context
      });
    });

    it('should include timestamp when configured', () => {
      const message = 'Test message';
      const context = { userId: '123', action: 'test' };

      extension.info(message, { context });

      const logCall = mockConsole.info.mock.calls[0][0];
      const parsedLog = JSON.parse(logCall);
      expect(parsedLog).toHaveProperty('timestamp');
      expect(new Date(parsedLog.timestamp).getTime()).not.toBeNaN();
    });
  });

  describe('Event Bus Integration', () => {
    it('should log event bus events', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      await extension.hooks['event-bus:publish']({ eventType: 'test-event', event });

      expect(mockConsole.debug).toHaveBeenCalledTimes(1);
      const logCall = mockConsole.debug.mock.calls[0][0];
      const parsedLog = JSON.parse(logCall);
      expect(parsedLog).toMatchObject({
        level: 'debug',
        event: {
          type: 'test-event',
          payload: { data: 1 }
        }
      });
    });

    it('should log event bus errors', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };
      const error = new Error('Test error');

      await extension.hooks['event-bus:error']({ event, error });

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      const logCall = mockConsole.error.mock.calls[0][0];
      const parsedLog = JSON.parse(logCall);
      expect(parsedLog).toMatchObject({
        level: 'error',
        event: {
          type: 'test-event',
          payload: { data: 1 }
        },
        error: {
          message: 'Test error'
        }
      });
    });
  });

  describe('Log Level Configuration', () => {
    it('should respect configured log level', () => {
      const logger = new StructuredLoggerExtension({
        level: 'warn'
      });

      logger.debug('Debug message');
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');

      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).toHaveBeenCalledTimes(1);
    });
  });
}); 