/**
 * Circuit Breaker Metrics
 *
 * This module provides metrics collection and monitoring capabilities for circuit breakers.
 * It tracks state changes, failure rates, recovery times, and other performance metrics.
 */

import { CircuitBreakerState } from '../types/service';

/**
 * Circuit breaker state change event
 */
export interface CircuitBreakerStateChangeEvent {
  circuitBreakerId: string;
  previousState: CircuitBreakerState;
  newState: CircuitBreakerState;
  timestamp: number;
  failureCount: number;
  successCount: number;
}

/**
 * Circuit breaker execution metrics
 */
export interface CircuitBreakerExecutionMetrics {
  circuitBreakerId: string;
  operationName?: string;
  timestamp: number;
  duration: number;
  success: boolean;
  state: CircuitBreakerState;
  error?: string;
  usedFallback?: boolean;
}

/**
 * Circuit breaker metrics summary
 */
export interface CircuitBreakerMetricsSummary {
  circuitBreakerId: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  stateTransitions: number;
  timeInState: {
    [CircuitBreakerState.CLOSED]: number;
    [CircuitBreakerState.OPEN]: number;
    [CircuitBreakerState.HALF_OPEN]: number;
  };
  currentState: CircuitBreakerState;
  failureRate: number;
  lastStateChangeTimestamp?: number;
  lastExecutionTimestamp?: number;
}

/**
 * Circuit breaker metrics options
 */
export interface CircuitBreakerMetricsOptions {
  maxEventsHistory?: number;
  enableDetailedMetrics?: boolean;
  metricsCallback?: (metrics: CircuitBreakerExecutionMetrics) => void;
  stateChangeCallback?: (event: CircuitBreakerStateChangeEvent) => void;
}

/**
 * Circuit breaker metrics collector
 */
export class CircuitBreakerMetrics {
  private readonly id: string;
  private readonly options: CircuitBreakerMetricsOptions;
  private stateChangeEvents: CircuitBreakerStateChangeEvent[] = [];
  private executionMetrics: CircuitBreakerExecutionMetrics[] = [];
  private currentState: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private stateStartTime: number = Date.now();
  private totalExecutions: number = 0;
  private successfulExecutions: number = 0;
  private failedExecutions: number = 0;
  private totalExecutionTime: number = 0;
  private stateTransitions: number = 0;
  private timeInState: { [key in CircuitBreakerState]: number } = {
    [CircuitBreakerState.CLOSED]: 0,
    [CircuitBreakerState.OPEN]: 0,
    [CircuitBreakerState.HALF_OPEN]: 0,
  };
  private lastExecutionTimestamp?: number;

  /**
   * Create a new circuit breaker metrics collector
   *
   * @param id - Unique identifier for the circuit breaker
   * @param options - Metrics collection options
   */
  constructor(id: string, options: CircuitBreakerMetricsOptions = {}) {
    this.id = id;
    this.options = {
      maxEventsHistory: options.maxEventsHistory || 100,
      enableDetailedMetrics: options.enableDetailedMetrics !== false,
      metricsCallback: options.metricsCallback,
      stateChangeCallback: options.stateChangeCallback,
    };
  }

  /**
   * Record a state change event
   *
   * @param previousState - Previous circuit breaker state
   * @param newState - New circuit breaker state
   * @param failureCount - Current failure count
   * @param successCount - Current success count
   */
  recordStateChange(
    previousState: CircuitBreakerState,
    newState: CircuitBreakerState,
    failureCount: number,
    successCount: number
  ): void {
    // Calculate time spent in previous state
    const now = Date.now();
    const timeInPreviousState = now - this.stateStartTime;
    this.timeInState[previousState] += timeInPreviousState;

    // Create state change event
    const event: CircuitBreakerStateChangeEvent = {
      circuitBreakerId: this.id,
      previousState,
      newState,
      timestamp: now,
      failureCount,
      successCount,
    };

    // Update internal state
    this.currentState = newState;
    this.stateStartTime = now;
    this.stateTransitions++;

    // Add to history, maintaining max size
    this.stateChangeEvents.push(event);
    if (this.stateChangeEvents.length > this.options.maxEventsHistory!) {
      this.stateChangeEvents.shift();
    }

    // Call callback if provided
    if (this.options.stateChangeCallback) {
      this.options.stateChangeCallback(event);
    }
  }

  /**
   * Record execution metrics
   *
   * @param operationName - Name of the operation being executed
   * @param duration - Execution duration in milliseconds
   * @param success - Whether the execution was successful
   * @param error - Error message if execution failed
   * @param usedFallback - Whether a fallback was used
   */
  recordExecution(
    operationName: string | undefined,
    duration: number,
    success: boolean,
    error?: string,
    usedFallback?: boolean
  ): void {
    const now = Date.now();

    // Update counters
    this.totalExecutions++;
    if (success) {
      this.successfulExecutions++;
    } else {
      this.failedExecutions++;
    }
    this.totalExecutionTime += duration;
    this.lastExecutionTimestamp = now;

    // Create metrics object
    const metrics: CircuitBreakerExecutionMetrics = {
      circuitBreakerId: this.id,
      operationName,
      timestamp: now,
      duration,
      success,
      state: this.currentState,
      error,
      usedFallback,
    };

    // Store detailed metrics if enabled
    if (this.options.enableDetailedMetrics) {
      this.executionMetrics.push(metrics);
      if (this.executionMetrics.length > this.options.maxEventsHistory!) {
        this.executionMetrics.shift();
      }
    }

    // Call callback if provided
    if (this.options.metricsCallback) {
      this.options.metricsCallback(metrics);
    }
  }

  /**
   * Get state change history
   */
  getStateChangeHistory(): CircuitBreakerStateChangeEvent[] {
    return [...this.stateChangeEvents];
  }

  /**
   * Get execution metrics history
   */
  getExecutionMetricsHistory(): CircuitBreakerExecutionMetrics[] {
    return [...this.executionMetrics];
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): CircuitBreakerMetricsSummary {
    // Calculate current time in state
    const timeInCurrentState = Date.now() - this.stateStartTime;
    const totalTimeInState = { ...this.timeInState };
    totalTimeInState[this.currentState] += timeInCurrentState;

    // Calculate failure rate
    const failureRate = this.totalExecutions > 0 ? this.failedExecutions / this.totalExecutions : 0;

    // Calculate average execution time
    const averageExecutionTime =
      this.totalExecutions > 0 ? this.totalExecutionTime / this.totalExecutions : 0;

    // Get last state change timestamp
    const lastStateChange =
      this.stateChangeEvents.length > 0
        ? this.stateChangeEvents[this.stateChangeEvents.length - 1].timestamp
        : undefined;

    return {
      circuitBreakerId: this.id,
      totalExecutions: this.totalExecutions,
      successfulExecutions: this.successfulExecutions,
      failedExecutions: this.failedExecutions,
      totalExecutionTime: this.totalExecutionTime,
      averageExecutionTime,
      stateTransitions: this.stateTransitions,
      timeInState: totalTimeInState,
      currentState: this.currentState,
      failureRate,
      lastStateChangeTimestamp: lastStateChange,
      lastExecutionTimestamp: this.lastExecutionTimestamp,
    };
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.stateChangeEvents = [];
    this.executionMetrics = [];
    this.totalExecutions = 0;
    this.successfulExecutions = 0;
    this.failedExecutions = 0;
    this.totalExecutionTime = 0;
    this.stateTransitions = 0;
    this.timeInState = {
      [CircuitBreakerState.CLOSED]: 0,
      [CircuitBreakerState.OPEN]: 0,
      [CircuitBreakerState.HALF_OPEN]: 0,
    };
    this.stateStartTime = Date.now();
    this.lastExecutionTimestamp = undefined;
  }
}
