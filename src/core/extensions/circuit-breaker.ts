/**
 * Circuit Breaker Pattern Implementation
 * 
 * This file implements the Circuit Breaker pattern for service calls to prevent
 * cascading failures and provide resilience to the system.
 */

import { CircuitBreaker, CircuitBreakerOptions, CircuitBreakerState } from './types';

/**
 * Default implementation of the Circuit Breaker pattern
 */
export class DefaultCircuitBreaker implements CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  
  constructor(private options: CircuitBreakerOptions) {}
  
  /**
   * Execute a function with circuit breaker protection
   * @param fn The function to execute
   * @returns The result of the function
   * @throws Error if the circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === CircuitBreakerState.OPEN) {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime > this.options.resetTimeoutMs) {
        // Move to half-open state
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is open');
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
   * Handle successful execution
   */
  onSuccess(): void {
    // If in half-open state, increment success count
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      
      // If success threshold is reached, close the circuit
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.failureCount = 0;
      }
    } else if (this.state === CircuitBreakerState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }
  
  /**
   * Handle failed execution
   */
  onFailure(): void {
    // Increment failure count
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    // If failure threshold is reached, open the circuit
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
    }
  }
  
  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
  }
} 