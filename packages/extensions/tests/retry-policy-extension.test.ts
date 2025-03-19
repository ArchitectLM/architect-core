/**
 * Retry Policy Extension Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RetryPolicyExtension } from '../src/extensions/retry-policy.js';
import { Event } from '../src/models.js';

describe('RetryPolicyExtension', () => {
  let extension: RetryPolicyExtension;
  let mockOperation: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    extension = new RetryPolicyExtension({
      maxAttempts: 3,
      initialDelay: 100,
      maxDelay: 1000,
      backoffFactor: 2,
      jitter: true
    });
    mockOperation = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Retry Execution', () => {
    it('should succeed on first attempt', async () => {
      mockOperation.mockResolvedValueOnce('success');
      const result = await extension.execute(mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('should retry on failure until success', async () => {
      const error = new Error('Operation failed');
      mockOperation
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await extension.execute(mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should fail after max attempts', async () => {
      const error = new Error('Operation failed');
      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
      }

      await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Delay Calculation', () => {
    it('should apply exponential backoff with jitter', async () => {
      const error = new Error('Operation failed');
      mockOperation
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      await extension.execute(mockOperation);
      const endTime = Date.now();

      // First retry should be around 100ms (initial delay)
      // Second retry should be around 200ms (initial delay * backoff factor)
      const totalDelay = endTime - startTime;
      expect(totalDelay).toBeGreaterThanOrEqual(300);
      expect(totalDelay).toBeLessThan(400); // Including some jitter
    });

    it('should respect max delay', async () => {
      const error = new Error('Operation failed');
      mockOperation
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const startTime = Date.now();
      await extension.execute(mockOperation);
      const endTime = Date.now();

      const totalDelay = endTime - startTime;
      expect(totalDelay).toBeLessThan(2000); // Max delay is 1000ms
    });
  });

  describe('Error Classification', () => {
    it('should retry on retryable errors', async () => {
      const error = new Error('Retryable error');
      mockOperation
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await extension.execute(mockOperation);

      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(result).toBe('success');
    });

    it('should not retry on non-retryable errors', async () => {
      const error = new Error('Non-retryable error');
      mockOperation.mockRejectedValueOnce(error);

      await expect(extension.execute(mockOperation)).rejects.toThrow(error);
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should use custom error classifier', async () => {
      const customExtension = new RetryPolicyExtension({
        maxAttempts: 3,
        initialDelay: 100,
        maxDelay: 1000,
        backoffFactor: 2,
        jitter: true,
        isRetryableError: (error: Error) => error.message.includes('retry')
      });

      const retryableError = new Error('retry this error');
      const nonRetryableError = new Error('do not retry');

      mockOperation
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce('success');

      const result = await customExtension.execute(mockOperation);
      expect(mockOperation).toHaveBeenCalledTimes(2);
      expect(result).toBe('success');

      mockOperation.mockRejectedValueOnce(nonRetryableError);
      await expect(customExtension.execute(mockOperation)).rejects.toThrow(nonRetryableError);
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Event Bus Integration', () => {
    it('should publish retry events', async () => {
      const eventBus = {
        publish: vi.fn()
      };

      const error = new Error('Operation failed');
      mockOperation
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      await extension.execute(mockOperation, eventBus);

      expect(eventBus.publish).toHaveBeenCalledTimes(2);
      const firstRetryEvent = eventBus.publish.mock.calls[0][0];
      expect(firstRetryEvent).toMatchObject({
        type: 'retry-policy:retry',
        payload: {
          attempt: 1,
          error: {
            message: 'Operation failed'
          }
        }
      });

      const secondRetryEvent = eventBus.publish.mock.calls[1][0];
      expect(secondRetryEvent).toMatchObject({
        type: 'retry-policy:retry',
        payload: {
          attempt: 2,
          error: {
            message: 'Operation failed'
          }
        }
      });
    });

    it('should publish failure event after max attempts', async () => {
      const eventBus = {
        publish: vi.fn()
      };

      const error = new Error('Operation failed');
      for (let i = 0; i < 3; i++) {
        mockOperation.mockRejectedValueOnce(error);
      }

      await expect(extension.execute(mockOperation, eventBus)).rejects.toThrow(error);

      expect(eventBus.publish).toHaveBeenCalledTimes(3);
      const failureEvent = eventBus.publish.mock.calls[2][0];
      expect(failureEvent).toMatchObject({
        type: 'retry-policy:failure',
        payload: {
          attempt: 3,
          error: {
            message: 'Operation failed'
          }
        }
      });
    });
  });
}); 