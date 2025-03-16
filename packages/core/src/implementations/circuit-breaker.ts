/**
 * Circuit Breaker Implementation
 *
 * This file implements the circuit breaker pattern for resilience.
 */

import { CircuitBreakerState, CircuitBreakerOptions, CircuitBreaker } from '../models/index.js';

/**
 * Default circuit breaker options
 */
const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  halfOpenSuccessThreshold: 1,
};

/**
 * CircuitBreaker implementation for resilience
 */
export class DefaultCircuitBreaker implements CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private resetTimeoutId?: NodeJS.Timeout;

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions = DEFAULT_OPTIONS
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitBreakerState.OPEN) {
      const now = Date.now();
      const timeElapsedSinceLastFailure = now - this.lastFailureTime;

      // Check if reset timeout has elapsed
      if (timeElapsedSinceLastFailure >= this.options.resetTimeout) {
        // Transition to half-open state
        this.transitionToHalfOpen();
      } else {
        // Circuit is still open, fail fast
        throw new Error(`Circuit breaker '${this.name}' is open`);
      }
    }

    try {
      // Execute the function
      const result = await fn();

      // Handle success
      this.onSuccess();

      return result;
    } catch (error) {
      // Handle failure
      this.onFailure();

      // Re-throw the original error
      throw error;
    }
  }

  /**
   * Get the current state of the circuit breaker
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;

    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = undefined;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;

      // Check if we've reached the success threshold to close the circuit
      if (this.successCount >= (this.options.halfOpenSuccessThreshold || 1)) {
        this.transitionToClosed();
      }
    } else {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // Any failure in half-open state should open the circuit again
      this.transitionToOpen();
    } else {
      // Increment failure count
      this.failureCount++;

      // Check if we've reached the failure threshold
      if (this.failureCount >= this.options.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    this.state = CircuitBreakerState.OPEN;
    this.successCount = 0;

    // Schedule transition to half-open after reset timeout
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }

    this.resetTimeoutId = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.options.resetTimeout);
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitBreakerState.HALF_OPEN;
    this.successCount = 0;
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
}
