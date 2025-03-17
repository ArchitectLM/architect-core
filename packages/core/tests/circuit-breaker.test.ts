/**
 * Tests for the DefaultCircuitBreaker implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DefaultCircuitBreaker } from '../src/implementations/circuit-breaker.js';
import { CircuitBreakerState } from '../src/models/index.js';

describe('DefaultCircuitBreaker', () => {
  let circuitBreaker: DefaultCircuitBreaker;
  
  beforeEach(() => {
    vi.useFakeTimers();
    circuitBreaker = new DefaultCircuitBreaker('test-breaker', {
      failureThreshold: 3,
      resetTimeout: 5000,
      halfOpenSuccessThreshold: 1
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('State Transitions', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should transition to OPEN state after reaching failure threshold', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Trigger failures
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected error
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
    
    it('should transition to HALF_OPEN state after reset timeout', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Trigger failures to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected error
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      // Fast forward time to trigger reset timeout
      vi.advanceTimersByTime(5000);
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });
    
    it('should transition back to CLOSED state after successful operation in HALF_OPEN state', async () => {
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Operation failed'))
        .mockRejectedValueOnce(new Error('Operation failed'))
        .mockRejectedValueOnce(new Error('Operation failed'))
        .mockResolvedValueOnce('Success');
      
      // Trigger failures to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected error
        }
      }
      
      // Fast forward time to trigger reset timeout
      vi.advanceTimersByTime(5000);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Now make the operation succeed
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('Success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should transition back to OPEN state after failed operation in HALF_OPEN state', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Trigger failures to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected error
        }
      }
      
      // Fast forward time to trigger reset timeout
      vi.advanceTimersByTime(5000);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Operation still fails
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected error
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });
  
  describe('Operation Execution', () => {
    it('should execute operation when circuit is CLOSED', async () => {
      const mockOperation = vi.fn().mockResolvedValue('Success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('Success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
    
    it('should throw error when circuit is OPEN', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Trigger failures to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected error
        }
      }
      
      // Now the circuit should be open
      mockOperation.mockClear();
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow("Circuit breaker 'test-breaker' is open");
      expect(mockOperation).not.toHaveBeenCalled();
    });
  });
  
  describe('Manual Control', () => {
    it('should allow manual reset', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Operation failed'));
      
      // Trigger failures to open the circuit
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockOperation);
        } catch (error) {
          // Expected error
        }
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
      
      // Manually reset the circuit breaker
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      
      // The operation should be executed again
      mockOperation.mockClear();
      try {
        await circuitBreaker.execute(mockOperation);
      } catch (error) {
        // Expected error
      }
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });
  });
});
