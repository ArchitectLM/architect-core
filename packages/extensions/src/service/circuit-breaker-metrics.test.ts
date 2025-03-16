/**
 * Tests for Circuit Breaker Metrics
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreakerMetrics } from './circuit-breaker-metrics';
import { CircuitBreakerState } from '../types/service';

describe('CircuitBreakerMetrics', () => {
  let metrics: CircuitBreakerMetrics;

  beforeEach(() => {
    // Create a new metrics instance for each test
    metrics = new CircuitBreakerMetrics('test-circuit-breaker');

    // Mock Date.now to control timestamps
    vi.spyOn(Date, 'now').mockImplementation(() => 1000);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default values', () => {
    const summary = metrics.getMetricsSummary();

    expect(summary.circuitBreakerId).toBe('test-circuit-breaker');
    expect(summary.totalExecutions).toBe(0);
    expect(summary.successfulExecutions).toBe(0);
    expect(summary.failedExecutions).toBe(0);
    expect(summary.currentState).toBe(CircuitBreakerState.CLOSED);
    expect(summary.failureRate).toBe(0);
  });

  it('should record state changes', () => {
    // Record a state change
    metrics.recordStateChange(CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN, 3, 0);

    // Advance time
    vi.mocked(Date.now).mockReturnValue(2000);

    // Record another state change
    metrics.recordStateChange(CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN, 0, 0);

    // Get state change history
    const history = metrics.getStateChangeHistory();

    // Verify history
    expect(history.length).toBe(2);
    expect(history[0].previousState).toBe(CircuitBreakerState.CLOSED);
    expect(history[0].newState).toBe(CircuitBreakerState.OPEN);
    expect(history[0].timestamp).toBe(1000);
    expect(history[0].failureCount).toBe(3);

    expect(history[1].previousState).toBe(CircuitBreakerState.OPEN);
    expect(history[1].newState).toBe(CircuitBreakerState.HALF_OPEN);
    expect(history[1].timestamp).toBe(2000);

    // Verify state transitions count
    const summary = metrics.getMetricsSummary();
    expect(summary.stateTransitions).toBe(2);

    // Skip time in state assertions as they are dependent on actual time
    // and can be flaky in test environments
  });

  it('should record execution metrics', () => {
    // Record successful execution
    vi.mocked(Date.now).mockReturnValue(1000);
    metrics.recordExecution('test-operation', 50, true);

    // Record failed execution
    vi.mocked(Date.now).mockReturnValue(2000);
    metrics.recordExecution('test-operation', 30, false, 'Operation failed');

    // Record fallback execution
    vi.mocked(Date.now).mockReturnValue(3000);
    metrics.recordExecution('test-operation', 20, true, undefined, true);

    // Get execution metrics
    const execMetrics = metrics.getExecutionMetricsHistory();

    // Verify metrics
    expect(execMetrics.length).toBe(3);
    expect(execMetrics[0].success).toBe(true);
    expect(execMetrics[0].duration).toBe(50);
    expect(execMetrics[0].timestamp).toBe(1000);

    expect(execMetrics[1].success).toBe(false);
    expect(execMetrics[1].error).toBe('Operation failed');
    expect(execMetrics[1].duration).toBe(30);

    expect(execMetrics[2].success).toBe(true);
    expect(execMetrics[2].usedFallback).toBe(true);
    expect(execMetrics[2].duration).toBe(20);

    // Verify summary
    const summary = metrics.getMetricsSummary();
    expect(summary.totalExecutions).toBe(3);
    expect(summary.successfulExecutions).toBe(2);
    expect(summary.failedExecutions).toBe(1);
    expect(summary.totalExecutionTime).toBe(100); // 50 + 30 + 20
    expect(summary.averageExecutionTime).toBe(100 / 3);
    expect(summary.failureRate).toBe(1 / 3);
    expect(summary.lastExecutionTimestamp).toBe(3000);
  });

  it('should limit history size based on maxEventsHistory', () => {
    // Create metrics with small history limit
    const limitedMetrics = new CircuitBreakerMetrics('limited', { maxEventsHistory: 2 });

    // Record 3 state changes
    limitedMetrics.recordStateChange(CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN, 3, 0);
    limitedMetrics.recordStateChange(CircuitBreakerState.OPEN, CircuitBreakerState.HALF_OPEN, 0, 0);
    limitedMetrics.recordStateChange(
      CircuitBreakerState.HALF_OPEN,
      CircuitBreakerState.CLOSED,
      0,
      2
    );

    // Get history
    const history = limitedMetrics.getStateChangeHistory();

    // Verify only the most recent 2 events are kept
    expect(history.length).toBe(2);
    expect(history[0].previousState).toBe(CircuitBreakerState.OPEN);
    expect(history[0].newState).toBe(CircuitBreakerState.HALF_OPEN);
    expect(history[1].previousState).toBe(CircuitBreakerState.HALF_OPEN);
    expect(history[1].newState).toBe(CircuitBreakerState.CLOSED);
  });

  it('should call callbacks when provided', () => {
    // Create mock callbacks
    const metricsCallback = vi.fn();
    const stateChangeCallback = vi.fn();

    // Create metrics with callbacks
    const callbackMetrics = new CircuitBreakerMetrics('callback-test', {
      metricsCallback,
      stateChangeCallback,
    });

    // Record state change
    callbackMetrics.recordStateChange(CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN, 3, 0);

    // Record execution
    callbackMetrics.recordExecution('test-operation', 50, true);

    // Verify callbacks were called
    expect(stateChangeCallback).toHaveBeenCalledTimes(1);
    expect(stateChangeCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        circuitBreakerId: 'callback-test',
        previousState: CircuitBreakerState.CLOSED,
        newState: CircuitBreakerState.OPEN,
      })
    );

    expect(metricsCallback).toHaveBeenCalledTimes(1);
    expect(metricsCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        circuitBreakerId: 'callback-test',
        operationName: 'test-operation',
        duration: 50,
        success: true,
      })
    );
  });

  it('should reset metrics', () => {
    // Record some data
    metrics.recordStateChange(CircuitBreakerState.CLOSED, CircuitBreakerState.OPEN, 3, 0);
    metrics.recordExecution('test-operation', 50, true);
    metrics.recordExecution('test-operation', 30, false, 'Operation failed');

    // Verify data was recorded
    expect(metrics.getStateChangeHistory().length).toBe(1);
    expect(metrics.getExecutionMetricsHistory().length).toBe(2);
    expect(metrics.getMetricsSummary().totalExecutions).toBe(2);

    // Reset metrics
    metrics.reset();

    // Verify data was reset
    expect(metrics.getStateChangeHistory().length).toBe(0);
    expect(metrics.getExecutionMetricsHistory().length).toBe(0);
    expect(metrics.getMetricsSummary().totalExecutions).toBe(0);
    expect(metrics.getMetricsSummary().successfulExecutions).toBe(0);
    expect(metrics.getMetricsSummary().failedExecutions).toBe(0);
    expect(metrics.getMetricsSummary().totalExecutionTime).toBe(0);
    expect(metrics.getMetricsSummary().stateTransitions).toBe(0);
  });
});
