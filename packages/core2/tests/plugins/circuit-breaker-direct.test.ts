import { describe, it, expect, vi } from 'vitest';
import { 
  createCircuitBreakerPlugin, 
  CircuitBreakerPlugin, 
  CircuitBreakerState 
} from '../../src/plugins/circuit-breaker';

describe('Circuit Breaker Direct Tests', () => {
  let circuitBreaker: CircuitBreakerPlugin;
  
  beforeEach(() => {
    vi.useFakeTimers();
    
    // Create with low thresholds for testing
    circuitBreaker = createCircuitBreakerPlugin({
      failureThreshold: 2,
      resetTimeout: 1000,
      halfOpenMaxAttempts: 1
    }) as CircuitBreakerPlugin;
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  it('should transition to OPEN after failures', async () => {
    const taskType = 'test-task';
    
    // Initial state
    expect(circuitBreaker.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
    
    // Simulate two failures via onTaskError
    await circuitBreaker.onTaskError({ taskType }, { state: {} });
    await circuitBreaker.onTaskError({ taskType }, { state: {} });
    
    // Should be OPEN now
    expect(circuitBreaker.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
    
    // Analytics should reflect failures
    const analytics = circuitBreaker.getCircuitAnalytics(taskType);
    expect(analytics.failureCount).toBe(2);
    expect(analytics.lastFailure).toBeDefined();
  });
  
  it('should transition to HALF_OPEN after reset timeout', async () => {
    const taskType = 'test-task';
    
    // Simulate failures to open circuit
    await circuitBreaker.onTaskError({ taskType }, { state: {} });
    await circuitBreaker.onTaskError({ taskType }, { state: {} });
    
    // Should be OPEN
    expect(circuitBreaker.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
    
    // Advance time
    vi.advanceTimersByTime(1100);
    
    // Trigger a check by calling beforeTaskExecution
    await circuitBreaker.beforeTaskExecution({ taskType }, { state: {} });
    
    // Should transition to HALF_OPEN
    expect(circuitBreaker.getCircuitState(taskType)).toBe(CircuitBreakerState.HALF_OPEN);
  });
  
  it('should close circuit after successful execution in HALF_OPEN state', async () => {
    const taskType = 'test-task';
    
    // Simulate failures to open circuit
    await circuitBreaker.onTaskError({ taskType }, { state: {} });
    await circuitBreaker.onTaskError({ taskType }, { state: {} });
    
    // Should be OPEN
    expect(circuitBreaker.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
    
    // Advance time and transition to HALF_OPEN
    vi.advanceTimersByTime(1100);
    await circuitBreaker.beforeTaskExecution({ taskType }, { state: {} });
    
    // Should be HALF_OPEN
    expect(circuitBreaker.getCircuitState(taskType)).toBe(CircuitBreakerState.HALF_OPEN);
    
    // Simulate successful execution
    await circuitBreaker.afterTaskExecution({ taskType }, { state: {} });
    
    // Should be CLOSED
    expect(circuitBreaker.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
  });
}); 