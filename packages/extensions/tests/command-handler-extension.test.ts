/**
 * Command Handler Extension Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandHandlerExtension } from '../src/extensions/command-handler.js';
import { Event } from '../src/models.js';

describe('CommandHandlerExtension', () => {
  let extension: CommandHandlerExtension;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    extension = new CommandHandlerExtension();
    mockHandler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command Registration', () => {
    it('should register a command handler', () => {
      const commandType = 'test-command';
      extension.registerHandler(commandType, mockHandler);

      const handler = extension.getHandler(commandType);
      expect(handler).toBe(mockHandler);
    });

    it('should throw error when registering duplicate command handler', () => {
      const commandType = 'test-command';
      extension.registerHandler(commandType, mockHandler);

      expect(() => {
        extension.registerHandler(commandType, mockHandler);
      }).toThrow(`Handler already registered for command type: ${commandType}`);
    });

    it('should unregister a command handler', () => {
      const commandType = 'test-command';
      extension.registerHandler(commandType, mockHandler);

      extension.unregisterHandler(commandType);
      const handler = extension.getHandler(commandType);
      expect(handler).toBeUndefined();
    });
  });

  describe('Command Execution', () => {
    it('should execute command with registered handler', async () => {
      const commandType = 'test-command';
      const command = { type: commandType, payload: { data: 1 } };
      const result = { success: true };

      mockHandler.mockResolvedValue(result);
      extension.registerHandler(commandType, mockHandler);

      const executionResult = await extension.executeCommand(command);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(command);
      expect(executionResult).toBe(result);
    });

    it('should throw error when executing command without handler', async () => {
      const command = { type: 'test-command', payload: { data: 1 } };

      await expect(extension.executeCommand(command)).rejects.toThrow(
        'No handler registered for command type: test-command'
      );
    });

    it('should handle handler errors', async () => {
      const commandType = 'test-command';
      const command = { type: commandType, payload: { data: 1 } };
      const error = new Error('Handler error');

      mockHandler.mockRejectedValue(error);
      extension.registerHandler(commandType, mockHandler);

      await expect(extension.executeCommand(command)).rejects.toThrow(error);
    });
  });

  describe('Middleware Support', () => {
    it('should execute middleware in correct order', async () => {
      const commandType = 'test-command';
      const command = { type: commandType, payload: { data: 1 } };
      const result = { success: true };

      const middleware1 = vi.fn().mockImplementation(async (cmd, next) => {
        cmd.payload.data += 1;
        return next(cmd);
      });

      const middleware2 = vi.fn().mockImplementation(async (cmd, next) => {
        cmd.payload.data += 2;
        return next(cmd);
      });

      mockHandler.mockResolvedValue(result);
      extension.registerHandler(commandType, mockHandler);
      extension.use(middleware1);
      extension.use(middleware2);

      await extension.executeCommand(command);

      expect(middleware1).toHaveBeenCalledTimes(1);
      expect(middleware2).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith({
        type: commandType,
        payload: { data: 4 }
      });
    });

    it('should allow middleware to modify command', async () => {
      const commandType = 'test-command';
      const command = { type: commandType, payload: { data: 1 } };
      const result = { success: true };

      const middleware = vi.fn().mockImplementation(async (cmd, next) => {
        cmd.payload.modified = true;
        return next(cmd);
      });

      mockHandler.mockResolvedValue(result);
      extension.registerHandler(commandType, mockHandler);
      extension.use(middleware);

      await extension.executeCommand(command);

      expect(mockHandler).toHaveBeenCalledWith({
        type: commandType,
        payload: { data: 1, modified: true }
      });
    });

    it('should allow middleware to short-circuit execution', async () => {
      const commandType = 'test-command';
      const command = { type: commandType, payload: { data: 1 } };
      const shortCircuitResult = { shortCircuited: true };

      const middleware = vi.fn().mockResolvedValue(shortCircuitResult);
      mockHandler.mockResolvedValue({ success: true });
      extension.registerHandler(commandType, mockHandler);
      extension.use(middleware);

      const result = await extension.executeCommand(command);

      expect(middleware).toHaveBeenCalledTimes(1);
      expect(mockHandler).not.toHaveBeenCalled();
      expect(result).toBe(shortCircuitResult);
    });
  });

  describe('Event Bus Integration', () => {
    it('should publish command completion event', async () => {
      const commandType = 'test-command';
      const command = { type: commandType, payload: { data: 1 } };
      const result = { success: true };

      mockHandler.mockResolvedValue(result);
      extension.registerHandler(commandType, mockHandler);

      const eventBus = {
        publish: vi.fn()
      };

      await extension.executeCommand(command, eventBus);

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const event = eventBus.publish.mock.calls[0][0];
      expect(event).toMatchObject({
        type: 'command:completed',
        payload: {
          command,
          result
        }
      });
    });

    it('should publish command error event', async () => {
      const commandType = 'test-command';
      const command = { type: commandType, payload: { data: 1 } };
      const error = new Error('Handler error');

      mockHandler.mockRejectedValue(error);
      extension.registerHandler(commandType, mockHandler);

      const eventBus = {
        publish: vi.fn()
      };

      await expect(extension.executeCommand(command, eventBus)).rejects.toThrow(error);

      expect(eventBus.publish).toHaveBeenCalledTimes(1);
      const event = eventBus.publish.mock.calls[0][0];
      expect(event).toMatchObject({
        type: 'command:error',
        payload: {
          command,
          error: {
            message: error.message
          }
        }
      });
    });
  });
}); 