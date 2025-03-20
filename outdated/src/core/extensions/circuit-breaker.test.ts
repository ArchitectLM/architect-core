import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerState, CircuitBreakerOptions } from './types';

/**
 * BDD-style tests for the CircuitBreaker implementation
 * 
 * These tests follow the behavior-driven development approach to ensure
 * the circuit breaker functions correctly in all states and transitions.
 */
describe('CircuitBreaker', () => {
  // Mock implementation for testing
  class TestCircuitBreaker implements CircuitBreaker {
    state: CircuitBreakerState = CircuitBreakerState.CLOSED;
    failureCount: number = 0;
    lastFailureTime: number = 0;
    successCount: number = 0;
    
    constructor(public options: CircuitBreakerOptions) {}
    
    async execute<T>(command: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
      if (this.state === CircuitBreakerState.OPEN) {
        if (Date.now() - this.lastFailureTime > this.options.resetTimeoutMs) {
          this.state = CircuitBreakerState.HALF_OPEN;
        } else if (fallback) {
          return fallback();
        } else {
          throw new Error('Circuit is open');
        }
      }
      
      try {
        const result = await command();
        this.onSuccess();
        return result;
      } catch (error) {
        this.onFailure();
        if (fallback) {
          return fallback();
        }
        throw error;
      }
    }
    
    onSuccess(): void {
      this.successCount++;
      if (this.state === CircuitBreakerState.HALF_OPEN && this.successCount >= this.options.successThreshold) {
        this.reset();
      }
    }
    
    onFailure(): void {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.state === CircuitBreakerState.CLOSED && this.failureCount >= this.options.failureThreshold) {
        this.state = CircuitBreakerState.OPEN;
      } else if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.state = CircuitBreakerState.OPEN;
      }
    }
    
    reset(): void {
      this.state = CircuitBreakerState.CLOSED;
      this.failureCount = 0;
      this.successCount = 0;
    }
  }
  
  let circuitBreaker: TestCircuitBreaker;
  const defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 3,
    resetTimeoutMs: 10000,
    successThreshold: 2
  };
  
  beforeEach(() => {
    circuitBreaker = new TestCircuitBreaker(defaultOptions);
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });
  
  describe('Initial State', () => {
    it('should start in a closed state', () => {
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.failureCount).toBe(0);
    });
    
    it('should have the correct options', () => {
      expect(circuitBreaker.options).toEqual(defaultOptions);
    });
  });
  
  describe('Closed State', () => {
    it('should execute commands successfully when closed', async () => {
      const command = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(command);
      
      expect(result).toBe('success');
      expect(command).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.successCount).toBe(1);
    });
    
    it('should increment failure count on error', async () => {
      const command = vi.fn().mockRejectedValue(new Error('test error'));
      const fallback = vi.fn().mockResolvedValue('fallback');
      
      const result = await circuitBreaker.execute(command, fallback);
      
      expect(result).toBe('fallback');
      expect(command).toHaveBeenCalledTimes(1);
      expect(fallback).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.failureCount).toBe(1);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should transition to open state after reaching failure threshold', async () => {
      const command = vi.fn().mockRejectedValue(new Error('test error'));
      const fallback = vi.fn().mockResolvedValue('fallback');
      
      // First failure
      await circuitBreaker.execute(command, fallback);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      
      // Second failure
      await circuitBreaker.execute(command, fallback);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      
      // Third failure - should trip the circuit
      await circuitBreaker.execute(command, fallback);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);
      expect(circuitBreaker.failureCount).toBe(3);
    });
  });
  
  describe('Open State', () => {
    beforeEach(() => {
      // Set up circuit breaker in open state
      circuitBreaker.state = CircuitBreakerState.OPEN;
      circuitBreaker.failureCount = 3;
      circuitBreaker.lastFailureTime = Date.now();
    });
    
    it('should not execute commands when open', async () => {
      const command = vi.fn().mockResolvedValue('success');
      const fallback = vi.fn().mockResolvedValue('fallback');
      
      const result = await circuitBreaker.execute(command, fallback);
      
      expect(result).toBe('fallback');
      expect(command).not.toHaveBeenCalled();
      expect(fallback).toHaveBeenCalledTimes(1);
    });
    
    it('should throw an error when open and no fallback is provided', async () => {
      const command = vi.fn().mockResolvedValue('success');
      
      await expect(circuitBreaker.execute(command)).rejects.toThrow('Circuit is open');
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
      circuitBreaker.state = CircuitBreakerState.HALF_OPEN;
      circuitBreaker.failureCount = 3;
      circuitBreaker.lastFailureTime = Date.now() - defaultOptions.resetTimeoutMs - 100;
    });
    
    it('should execute commands in half-open state', async () => {
      const command = vi.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(command);
      
      expect(result).toBe('success');
      expect(command).toHaveBeenCalledTimes(1);
      expect(circuitBreaker.successCount).toBe(1);
    });
    
    it('should transition back to open state on failure in half-open state', async () => {
      const command = vi.fn().mockRejectedValue(new Error('test error'));
      const fallback = vi.fn().mockResolvedValue('fallback');
      
      await circuitBreaker.execute(command, fallback);
      
      expect(circuitBreaker.state).toBe(CircuitBreakerState.OPEN);
      expect(fallback).toHaveBeenCalledTimes(1);
    });
    
    it('should reset to closed state after success threshold is reached', async () => {
      const command = vi.fn().mockResolvedValue('success');
      
      // First success
      await circuitBreaker.execute(command);
      expect(circuitBreaker.state).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Second success - should close the circuit
      await circuitBreaker.execute(command);
      
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.successCount).toBe(0);
    });
  });
  
  describe('Reset', () => {
    it('should reset the circuit breaker state', () => {
      circuitBreaker.state = CircuitBreakerState.OPEN;
      circuitBreaker.failureCount = 5;
      circuitBreaker.successCount = 1;
      
      circuitBreaker.reset();
      
      expect(circuitBreaker.state).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.failureCount).toBe(0);
      expect(circuitBreaker.successCount).toBe(0);
    });
  });
}); 