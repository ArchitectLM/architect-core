/**
 * Circuit Breaker
 *
 * This module provides a circuit breaker implementation for service calls.
 * It helps prevent cascading failures by stopping calls to failing services
 * and allows for graceful degradation of functionality.
 */

import { CircuitBreaker, CircuitBreakerOptions, CircuitBreakerState } from '../types/service';
import { CircuitBreakerMetrics, CircuitBreakerMetricsOptions } from './circuit-breaker-metrics';

/**
 * Default circuit breaker implementation
 *
 * The circuit breaker pattern prevents a cascade of failures by stopping calls to a failing service.
 * It has three states:
 * - CLOSED: Normal operation, calls pass through to the service
 * - OPEN: Service is failing, calls are blocked and fail fast
 * - HALF_OPEN: Testing if service has recovered, limited calls allowed
 */
export class DefaultCircuitBreaker implements CircuitBreaker {
  state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly options: CircuitBreakerOptions;
  private readonly logger: Console;
  private readonly metrics?: CircuitBreakerMetrics;

  /**
   * Create a new circuit breaker
   *
   * @param options - Configuration options for the circuit breaker
   * @param logger - Optional logger instance (defaults to console)
   * @param metricsOptions - Optional metrics collection options
   */
  constructor(
    options: CircuitBreakerOptions,
    logger: Console = console,
    metricsOptions?: CircuitBreakerMetricsOptions
  ) {
    // Ensure minimum values for thresholds
    this.options = {
      ...options,
      failureThreshold: Math.max(1, options.failureThreshold || 1),
      halfOpenSuccessThreshold: Math.max(1, options.halfOpenSuccessThreshold || 1),
    };
    this.logger = logger;

    // Initialize metrics if options provided
    if (metricsOptions) {
      this.metrics = new CircuitBreakerMetrics(
        options.id || `circuit-breaker-${Date.now()}`,
        metricsOptions
      );
    }
  }

  /**
   * Execute a function with circuit breaker protection
   *
   * @param fn - The function to execute
   * @param fallback - Optional fallback function to call if circuit is open
   * @param operationName - Optional name of the operation for metrics
   * @returns The result of the function or fallback
   * @throws Error if circuit is open and no fallback is provided
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const startTime = Date.now();
    let usedFallback = false;
    let success = false;
    let error: string | undefined;

    try {
      // If circuit is open, check if it's time to try again
      if (this.state === CircuitBreakerState.OPEN) {
        const timeInOpen = Date.now() - this.lastFailureTime;
        if (timeInOpen >= this.options.resetTimeoutMs) {
          this.transitionState(CircuitBreakerState.HALF_OPEN);
          this.logger.info(
            `Circuit breaker transitioning from OPEN to HALF_OPEN after ${timeInOpen}ms`
          );
          this.successCount = 0;
        } else if (fallback) {
          this.logger.info(`Circuit breaker is OPEN, using fallback`);
          usedFallback = true;
          const result = await fallback();
          success = true;

          // Record metrics if enabled
          this.recordExecution(operationName, Date.now() - startTime, true, undefined, true);

          return result;
        } else {
          this.logger.warn(
            `Circuit breaker is OPEN, rejecting call (${Math.round((this.options.resetTimeoutMs - timeInOpen) / 1000)}s until retry)`
          );
          error = 'Circuit breaker is open';

          // Record metrics if enabled
          this.recordExecution(operationName, Date.now() - startTime, false, error, false);

          throw new Error(error);
        }
      }

      // Execute the function
      const result = await fn();
      success = true;
      this.success();

      // Record metrics if enabled
      this.recordExecution(operationName, Date.now() - startTime, true);

      return result;
    } catch (err) {
      this.failure();

      // Add circuit breaker context to the error
      const enhancedError = err instanceof Error ? err : new Error(String(err));
      (enhancedError as any).circuitBreakerState = this.state;
      (enhancedError as any).failureCount = this.failureCount;

      error = enhancedError.message;

      // If we have a fallback and the circuit is now open, use it
      if (fallback && this.state === CircuitBreakerState.OPEN) {
        this.logger.info(`Circuit breaker transitioned to OPEN, using fallback`);
        usedFallback = true;

        try {
          const result = await fallback();
          success = true;

          // Record metrics if enabled
          this.recordExecution(operationName, Date.now() - startTime, true, undefined, true);

          return result;
        } catch (fallbackErr) {
          // If fallback also fails, record that
          const fallbackError =
            fallbackErr instanceof Error ? fallbackErr : new Error(String(fallbackErr));

          // Record metrics if enabled
          this.recordExecution(
            operationName,
            Date.now() - startTime,
            false,
            `Fallback failed: ${fallbackError.message}`,
            true
          );

          throw fallbackError;
        }
      }

      // Record metrics if enabled
      this.recordExecution(operationName, Date.now() - startTime, false, error);

      throw enhancedError;
    }
  }

  /**
   * Handle success
   */
  success(): void {
    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;
      this.logger.info(
        `Circuit breaker success in HALF_OPEN state (${this.successCount}/${this.options.halfOpenSuccessThreshold})`
      );
      if (this.successCount >= this.options.halfOpenSuccessThreshold!) {
        this.logger.info(
          `Circuit breaker transitioning from HALF_OPEN to CLOSED after ${this.successCount} successes`
        );
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
      this.logger.warn(`Circuit breaker failure in HALF_OPEN state, transitioning back to OPEN`);
      this.transitionState(CircuitBreakerState.OPEN);
      return;
    }

    if (this.state === CircuitBreakerState.CLOSED) {
      this.failureCount++;
      if (this.failureCount >= this.options.failureThreshold) {
        this.logger.warn(
          `Circuit breaker transitioning from CLOSED to OPEN after ${this.failureCount} failures`
        );
        this.transitionState(CircuitBreakerState.OPEN);
      } else {
        this.logger.info(
          `Circuit breaker failure in CLOSED state (${this.failureCount}/${this.options.failureThreshold})`
        );
      }
    }
  }

  /**
   * Reset the circuit breaker
   */
  reset(): void {
    this.logger.info(`Circuit breaker reset to CLOSED state`);
    this.transitionState(CircuitBreakerState.CLOSED);
    this.failureCount = 0;
    this.successCount = 0;
  }

  /**
   * Get metrics summary if metrics are enabled
   */
  getMetrics() {
    return this.metrics?.getMetricsSummary();
  }

  /**
   * Get state change history if metrics are enabled
   */
  getStateChangeHistory() {
    return this.metrics?.getStateChangeHistory() || [];
  }

  /**
   * Get execution metrics history if metrics are enabled
   */
  getExecutionMetricsHistory() {
    return this.metrics?.getExecutionMetricsHistory() || [];
  }

  /**
   * Reset metrics if metrics are enabled
   */
  resetMetrics() {
    this.metrics?.reset();
  }

  /**
   * Private helper to transition state and record metrics
   */
  private transitionState(newState: CircuitBreakerState): void {
    const previousState = this.state;
    this.state = newState;

    // Record state change in metrics if enabled
    if (this.metrics) {
      this.metrics.recordStateChange(previousState, newState, this.failureCount, this.successCount);
    }
  }

  /**
   * Private helper to record execution metrics
   */
  private recordExecution(
    operationName: string | undefined,
    duration: number,
    success: boolean,
    error?: string,
    usedFallback?: boolean
  ): void {
    if (this.metrics) {
      this.metrics.recordExecution(operationName, duration, success, error, usedFallback);
    }
  }
}
