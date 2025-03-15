/**
 * Circuit Breaker
 *
 * This module provides a circuit breaker implementation for service calls.
 */

import { CircuitBreaker, CircuitBreakerOptions, CircuitBreakerState } from '../types/service';

/**
 * Default circuit breaker implementation
 */
export class DefaultCircuitBreaker implements CircuitBreaker {
  state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: CircuitBreakerOptions) {
    this.options = {
      ...options,
      halfOpenSuccessThreshold: options.halfOpenSuccessThreshold || 1,
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await fn();
      this.success();
      return result;
    } catch (error) {
      this.failure();
      throw error;
    }
  }

  /**
   * Handle success
   */
  success(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenSuccessThreshold!) {
        this.reset();
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      this.failureCount = 0;
    }
  }

  /**
   * Handle failure
   */
  failure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      return;
    }

    if (this.state === CircuitBreakerState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.options.failureThreshold) {
        this.state = CircuitBreakerState.OPEN;
      }
    }
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}
