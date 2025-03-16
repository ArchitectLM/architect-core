/**
 * Tests for the DefaultCircuitBreaker implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultCircuitBreaker } from '../src/implementations/circuit-breaker.js';
import { CircuitBreakerState } from '../src/models/index.js';

describe('DefaultCircuitBreaker', () => {
  let circuitBreaker: DefaultCircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new DefaultCircuitBreaker('test-breaker', {
      failureThreshold: 3,
      resetTimeout: 100, // Short timeout for testing
    });
  });

  describe('Basic Functionality', () => {
    it('should execute a function successfully when circuit is closed', async () => {
      // Given a circuit breaker in closed state
      const mockFn = vi.fn().mockResolvedValue('success');

      // When executing a function
      const result = await circuitBreaker.execute(mockFn);

      // Then the function should be called and return result
      expect(mockFn).toHaveBeenCalled();
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should handle function errors and increment failure count', async () => {
      // Given a circuit breaker and a function that fails
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));

      // When executing the function
      try {
        await circuitBreaker.execute(mockFn);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Then the error should be propagated
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('test error');
      }

      // And the circuit should still be closed (not enough failures yet)
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Circuit Opening', () => {
    it('should open circuit after failure threshold is reached', async () => {
      // Given a function that always fails
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));

      // When executing the function multiple times
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected error
        }
      }

      // Then the circuit should be open
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // And subsequent executions should fail immediately without calling the function
      mockFn.mockClear();
      try {
        await circuitBreaker.execute(mockFn);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Circuit breaker');
        expect(mockFn).not.toHaveBeenCalled();
      }
    });

    it('should reset failure count after successful execution', async () => {
      // Given a circuit breaker and a function that fails sometimes
      const mockFn = vi
        .fn()
        .mockRejectedValueOnce(new Error('test error'))
        .mockRejectedValueOnce(new Error('test error'))
        .mockResolvedValueOnce('success')
        .mockRejectedValueOnce(new Error('test error'))
        .mockRejectedValueOnce(new Error('test error'))
        .mockRejectedValueOnce(new Error('test error'));

      // When executing with some failures followed by success
      try {
        await circuitBreaker.execute(mockFn);
      } catch {}
      try {
        await circuitBreaker.execute(mockFn);
      } catch {}
      await circuitBreaker.execute(mockFn); // Success

      // Then the circuit should still be closed
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

      // When executing with more failures
      try {
        await circuitBreaker.execute(mockFn);
      } catch {}
      try {
        await circuitBreaker.execute(mockFn);
      } catch {}
      try {
        await circuitBreaker.execute(mockFn);
      } catch {}

      // Then the circuit should be open (failure count reached threshold again)
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('Half-Open State', () => {
    it('should transition to half-open state after reset timeout', async () => {
      // Given a circuit breaker that's been opened
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));

      // When executing enough times to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // When waiting for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Then the circuit should be half-open
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should close circuit after successful execution in half-open state', async () => {
      // Given a circuit breaker that's been opened
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));

      // When executing enough times to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch {}
      }

      // And waiting for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Then the circuit should be half-open
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      // When executing a successful function
      mockFn.mockResolvedValueOnce('success');
      const result = await circuitBreaker.execute(mockFn);

      // Then the result should be returned
      expect(result).toBe('success');

      // And the circuit should be closed
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reopen circuit after failure in half-open state', async () => {
      // Given a circuit breaker that's been opened
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));

      // When executing enough times to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch {}
      }

      // And waiting for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Then the circuit should be half-open
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);

      // When executing a failing function
      try {
        await circuitBreaker.execute(mockFn);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        // Expected error
      }

      // Then the circuit should be open again
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('Manual Control', () => {
    it('should allow manual reset', async () => {
      // Given a circuit breaker that's been opened
      const mockFn = vi.fn().mockRejectedValue(new Error('test error'));

      // When executing enough times to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch {}
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      // When manually resetting
      circuitBreaker.reset();

      // Then the circuit should be closed
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);

      // And the function should be executed again
      mockFn.mockClear();
      try {
        await circuitBreaker.execute(mockFn);
      } catch (error) {
        // Expected error
      }

      expect(mockFn).toHaveBeenCalled();
    });
  });
});
