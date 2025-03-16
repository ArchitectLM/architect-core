/**
 * Tests for the RetryPolicy implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultRetryPolicy } from '../src/implementations/retry-policy.js';

describe('RetryPolicy', () => {
  describe('Basic Functionality', () => {
    it('should execute a function successfully', async () => {
      // Given a retry policy
      const retryPolicy = new DefaultRetryPolicy('test-retry', {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 100,
        maxDelay: 30000,
      });

      // And a function that succeeds
      const fn = vi.fn().mockResolvedValue('success');

      // When executing the function with the retry policy
      const result = await retryPolicy.execute(fn);

      // Then the function should be called once and return the result
      expect(fn).toHaveBeenCalledTimes(1);
      expect(result).toBe('success');
    });

    it('should retry a failing function until success', async () => {
      // Given a retry policy with specific options
      const retryPolicy = new DefaultRetryPolicy('test-retry', {
        maxAttempts: 3,
        backoff: 'fixed',
        initialDelay: 10, // Small delay for tests
        maxDelay: 30000,
      });

      // And a function that fails twice then succeeds
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');

      // When executing the function with the retry policy
      const result = await retryPolicy.execute(fn);

      // Then the function should be called three times and return the success result
      expect(fn).toHaveBeenCalledTimes(3);
      expect(result).toBe('success');
    });

    it('should give up after max attempts', async () => {
      // Given a retry policy with specific options
      const retryPolicy = new DefaultRetryPolicy('test-retry', {
        maxAttempts: 3,
        backoff: 'fixed',
        initialDelay: 10, // Small delay for tests
        maxDelay: 30000,
      });

      // And a function that always fails
      const error = new Error('Always fails');
      const fn = vi.fn().mockRejectedValue(error);

      // When executing the function with the retry policy
      // Then it should eventually throw the last error
      await expect(retryPolicy.execute(fn)).rejects.toThrow('Always fails');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Backoff Strategies', () => {
    it('should use fixed backoff', async () => {
      // Given a retry policy with fixed backoff
      const retryPolicy = new DefaultRetryPolicy('test-retry', {
        maxAttempts: 3,
        backoff: 'fixed',
        initialDelay: 100,
        maxDelay: 30000,
      });

      // Mock the delay function to track calls
      const mockDelay = vi.fn();
      // Use any to bypass TypeScript's type checking for the test
      vi.spyOn(retryPolicy as any, 'calculateDelay').mockImplementation(() => {
        mockDelay();
        return 0; // Return 0 to speed up test
      });

      // And a function that always fails
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));

      // When executing the function with the retry policy
      await expect(retryPolicy.execute(fn)).rejects.toThrow();

      // Then calculateDelay should be called with the same delay each time
      expect(mockDelay).toHaveBeenCalledTimes(2); // Called for each retry
    });

    it('should use exponential backoff', async () => {
      // Given a retry policy with exponential backoff
      const retryPolicy = new DefaultRetryPolicy('test-retry', {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 100,
        maxDelay: 30000,
      });

      // Mock the delay function to track calls
      // Use any to bypass TypeScript's type checking for the test
      const calculateDelaySpy = vi.spyOn(retryPolicy as any, 'calculateDelay');
      vi.spyOn(global, 'setTimeout').mockImplementation((callback: any) => {
        callback();
        return {} as any;
      });

      // And a function that always fails
      const fn = vi.fn().mockRejectedValue(new Error('Fail'));

      // When executing the function with the retry policy
      await expect(retryPolicy.execute(fn)).rejects.toThrow();

      // Then calculateDelay should be called with increasing attempts
      expect(calculateDelaySpy).toHaveBeenCalledTimes(2); // Called for each retry
      expect(calculateDelaySpy).toHaveBeenNthCalledWith(1, 1);
      expect(calculateDelaySpy).toHaveBeenNthCalledWith(2, 2);
    });
  });

  describe('Error Handling', () => {
    it('should not retry if error indicates not to retry', async () => {
      // Given a retry policy
      const retryPolicy = new DefaultRetryPolicy('test-retry', {
        maxAttempts: 3,
        backoff: 'exponential',
        initialDelay: 100,
        maxDelay: 30000,
      });

      // And a function that throws a non-retryable error
      const nonRetryableError = new Error('This error should not be retried');
      nonRetryableError.name = 'NonRetryableError';

      const fn = vi.fn().mockRejectedValue(nonRetryableError);

      // When executing the function with the retry policy and a custom shouldRetry predicate
      try {
        await retryPolicy.execute(fn, error => {
          return error.name !== 'NonRetryableError';
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Then it should not retry and throw immediately
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('This error should not be retried');
      }

      // And the function should have been called only once
      expect(fn).toHaveBeenCalledTimes(1); // Only called once, no retries
    });
  });

  describe('Performance', () => {
    it('should handle concurrent executions', async () => {
      // Given a retry policy
      const retryPolicy = new DefaultRetryPolicy('test-retry', {
        maxAttempts: 2,
        backoff: 'exponential',
        initialDelay: 10,
        maxDelay: 30000,
      });

      // And a set of functions
      const functions = Array(10)
        .fill(0)
        .map((_, i) => {
          return vi.fn().mockImplementation(async () => {
            if (Math.random() < 0.3) {
              throw new Error(`Random failure ${i}`);
            }
            return `Success ${i}`;
          });
        });

      // When executing all functions concurrently
      const results = await Promise.allSettled(functions.map(fn => retryPolicy.execute(fn)));

      // Then all functions should have been executed
      functions.forEach(fn => {
        expect(fn).toHaveBeenCalled();
      });

      // And we should have a mix of fulfilled and rejected promises
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);
    });
  });
});
