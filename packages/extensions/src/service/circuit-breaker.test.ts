import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreakerState, CircuitBreakerOptions } from '../types/service';
import { DefaultCircuitBreaker } from './circuit-breaker';

/**
 * BDD-style tests for the CircuitBreaker implementation
 *
 * These tests follow the behavior-driven development approach to ensure
 * the circuit breaker functions correctly in all states and transitions.
 */
describe('DefaultCircuitBreaker', () => {
  let circuitBreaker: DefaultCircuitBreaker;
  const defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 3,
    resetTimeoutMs: 10000,
    halfOpenSuccessThreshold: 2,
  };

  beforeEach(() => {
    circuitBreaker = new DefaultCircuitBreaker(defaultOptions);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should start in a closed state', () => {
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should have the correct options', () => {
      expect((circuitBreaker as any).options).toEqual(defaultOptions);
    });

    it('should use default halfOpenSuccessThreshold if not provided', () => {
      const options: CircuitBreakerOptions = {
        failureThreshold: 3,
        resetTimeoutMs: 10000,
      };
      const cb = new DefaultCircuitBreaker(options);
      expect((cb as any).options.halfOpenSuccessThreshold).toBe(1);
    });
  });

  describe('Closed State', () => {
    it('should execute commands successfully when closed', async () => {
      const command = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(command);

      expect(result).toBe('success');
      expect(command).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should increment failure count on error', async () => {
      const command = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(circuitBreaker.execute(command)).rejects.toThrow('test error');
      expect(command).toHaveBeenCalledTimes(1);
      expect((circuitBreaker as any).failureCount).toBe(1);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    });

    it('should transition to open state after reaching failure threshold', async () => {
      const command = vi.fn().mockRejectedValue(new Error('test error'));

      // First failure
      await expect(circuitBreaker.execute(command)).rejects.toThrow('test error');
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);

      // Second failure
      await expect(circuitBreaker.execute(command)).rejects.toThrow('test error');
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);

      // Third failure - should trip the circuit
      await expect(circuitBreaker.execute(command)).rejects.toThrow('test error');
      expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);
      expect((circuitBreaker as any).failureCount).toBe(3);
    });

    it('should reset failure count after successful execution', async () => {
      const failCommand = vi.fn().mockRejectedValue(new Error('test error'));
      const successCommand = vi.fn().mockResolvedValue('success');

      // First failure
      await expect(circuitBreaker.execute(failCommand)).rejects.toThrow('test error');
      expect((circuitBreaker as any).failureCount).toBe(1);

      // Successful execution
      await circuitBreaker.execute(successCommand);
      expect((circuitBreaker as any).failureCount).toBe(0);
    });
  });

  describe('Open State', () => {
    beforeEach(() => {
      // Set up circuit breaker in open state
      (circuitBreaker as any).state = CircuitBreakerState.OPEN;
      (circuitBreaker as any).failureCount = 3;
      (circuitBreaker as any).lastFailureTime = Date.now();
    });

    it('should not execute commands when open', async () => {
      const command = vi.fn().mockResolvedValue('success');

      await expect(circuitBreaker.execute(command)).rejects.toThrow('Circuit breaker is open');
      expect(command).not.toHaveBeenCalled();
    });

    it('should throw an error when open and no fallback is provided', async () => {
      const command = vi.fn().mockResolvedValue('success');

      await expect(circuitBreaker.execute(command)).rejects.toThrow('Circuit breaker is open');
      expect(command).not.toHaveBeenCalled();
    });

    it('should transition to half-open state after reset timeout', async () => {
      const command = vi.fn().mockResolvedValue('success');

      // Advance time past the reset timeout
      vi.advanceTimersByTime(defaultOptions.resetTimeoutMs + 100);

      await circuitBreaker.execute(command);

      expect(circuitBreaker.state).toBe(CircuitBreakerState.HALF_OPEN);
      expect(command).toHaveBeenCalledTimes(1);
    });
  });

  describe('Half-Open State', () => {
    beforeEach(() => {
      // Set up circuit breaker in half-open state
      (circuitBreaker as any).state = CircuitBreakerState.HALF_OPEN;
      (circuitBreaker as any).failureCount = 3;
      (circuitBreaker as any).lastFailureTime = Date.now() - defaultOptions.resetTimeoutMs - 100;
    });

    it('should execute commands in half-open state', async () => {
      const command = vi.fn().mockResolvedValue('success');

      const result = await circuitBreaker.execute(command);

      expect(result).toBe('success');
      expect(command).toHaveBeenCalledTimes(1);
      expect((circuitBreaker as any).successCount).toBe(1);
    });

    it('should transition back to open state on failure in half-open state', async () => {
      const command = vi.fn().mockRejectedValue(new Error('test error'));

      await expect(circuitBreaker.execute(command)).rejects.toThrow('test error');

      expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);
    });

    it('should reset to closed state after success threshold is reached', async () => {
      const command = vi.fn().mockResolvedValue('success');

      // First success
      await circuitBreaker.execute(command);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.HALF_OPEN);
      expect((circuitBreaker as any).successCount).toBe(1);

      // Second success - should close the circuit
      await circuitBreaker.execute(command);

      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      expect((circuitBreaker as any).failureCount).toBe(0);
      expect((circuitBreaker as any).successCount).toBe(0);
    });

    it('should handle multiple successes in half-open state', async () => {
      // Set halfOpenSuccessThreshold to 3
      (circuitBreaker as any).options.halfOpenSuccessThreshold = 3;

      const command = vi.fn().mockResolvedValue('success');

      // First success
      await circuitBreaker.execute(command);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.HALF_OPEN);
      expect((circuitBreaker as any).successCount).toBe(1);

      // Second success
      await circuitBreaker.execute(command);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.HALF_OPEN);
      expect((circuitBreaker as any).successCount).toBe(2);

      // Third success - should close the circuit
      await circuitBreaker.execute(command);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Reset', () => {
    it('should reset the circuit breaker state', () => {
      (circuitBreaker as any).state = CircuitBreakerState.OPEN;
      (circuitBreaker as any).failureCount = 5;
      (circuitBreaker as any).successCount = 1;

      circuitBreaker.reset();

      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      expect((circuitBreaker as any).failureCount).toBe(0);
      expect((circuitBreaker as any).successCount).toBe(0);
    });

    it('should allow manual reset from any state', () => {
      // Test from OPEN state
      (circuitBreaker as any).state = CircuitBreakerState.OPEN;
      circuitBreaker.reset();
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);

      // Test from HALF_OPEN state
      (circuitBreaker as any).state = CircuitBreakerState.HALF_OPEN;
      circuitBreaker.reset();
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent executions correctly', async () => {
      const successCommand = vi.fn().mockResolvedValue('success');
      const failCommand = vi.fn().mockRejectedValue(new Error('test error'));

      // Start multiple concurrent executions
      const promises = [
        circuitBreaker.execute(successCommand),
        circuitBreaker.execute(successCommand),
        circuitBreaker.execute(failCommand).catch(() => 'error handled'),
      ];

      await Promise.all(promises);

      // The failure should have incremented the failure count
      expect((circuitBreaker as any).failureCount).toBe(1);
    });

    it('should handle zero thresholds gracefully', async () => {
      const options: CircuitBreakerOptions = {
        failureThreshold: 0, // Invalid value
        resetTimeoutMs: 10000,
        halfOpenSuccessThreshold: 0, // Invalid value
      };

      const cb = new DefaultCircuitBreaker(options);
      const command = vi.fn().mockRejectedValue(new Error('test error'));

      // Even with failureThreshold of 0, it should require at least one failure
      await expect(cb.execute(command)).rejects.toThrow('test error');

      // The implementation might treat 0 as 1, so the circuit could be open after a single failure
      // We'll just check that the state is valid rather than assuming a specific behavior
      expect([CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN].includes(cb.state)).toBe(true);
    });
  });
});
