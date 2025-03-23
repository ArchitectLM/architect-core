import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createCircuitBreakerPlugin, 
  CircuitBreakerPlugin, 
  CircuitBreakerState 
} from '../../src/plugins/circuit-breaker';

describe('Circuit Breaker Alternative Tests', () => {
  let circuitBreakerPlugin: CircuitBreakerPlugin;
  
  beforeEach(() => {
    // Reset mocks and create fresh instances for each test
    vi.useFakeTimers();
    
    // Create the plugin with low thresholds for testing
    circuitBreakerPlugin = createCircuitBreakerPlugin({
      failureThreshold: 2,      // Open after 2 failures
      resetTimeout: 1000,       // Reset after 1 second
      halfOpenMaxAttempts: 1    // Allow 1 test attempt in half-open state
    }) as CircuitBreakerPlugin;
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('Circuit Breaker State Transitions', () => {
    it('should start in CLOSED state', () => {
      const state = circuitBreakerPlugin.getCircuitState('test-task');
      expect(state).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should transition to OPEN after reaching failure threshold', async () => {
      const taskType = 'test-task';
      
      // Verify initial state
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
      
      // Simulate task failures by directly calling the error hook
      await circuitBreakerPlugin.onTaskError(
        { taskType, error: new Error('Task failed') },
        { state: {} }
      );
      
      // First failure should keep circuit closed
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
      
      // Second failure should open the circuit
      await circuitBreakerPlugin.onTaskError(
        { taskType, error: new Error('Task failed again') },
        { state: {} }
      );
      
      // Check circuit state and analytics
      const state = circuitBreakerPlugin.getCircuitState(taskType);
      const analytics = circuitBreakerPlugin.getCircuitAnalytics(taskType);
      
      console.log(`Final circuit state: ${state}`);
      console.log(`Failure count: ${analytics.failureCount}`);
      
      // Verify circuit is now open
      expect(state).toBe(CircuitBreakerState.OPEN);
      expect(analytics.failureCount).toBe(2);
    });
    
    it('should reject tasks when circuit is OPEN', async () => {
      const taskType = 'test-task';
      
      // Open the circuit with failures
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Verify circuit is open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
      
      // Attempt to execute task should be rejected
      const result = await circuitBreakerPlugin.beforeTaskExecution({ taskType }, { state: {} });
      
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Circuit is OPEN');
    });
    
    it('should transition to HALF_OPEN after reset timeout', async () => {
      const taskType = 'test-task';
      
      // Open the circuit with failures
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Verify circuit is open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
      
      // Advance time past the reset timeout
      vi.advanceTimersByTime(1100);
      
      // Trigger state check with beforeExecution
      await circuitBreakerPlugin.beforeTaskExecution({ taskType }, { state: {} });
      
      // Verify circuit is now half-open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.HALF_OPEN);
    });
    
    it('should transition back to CLOSED after successful test request', async () => {
      const taskType = 'test-task';
      
      // Open the circuit with failures
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Advance time and transition to half-open
      vi.advanceTimersByTime(1100);
      await circuitBreakerPlugin.beforeTaskExecution({ taskType }, { state: {} });
      
      // Verify circuit is half-open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Successful execution
      await circuitBreakerPlugin.afterTaskExecution({ taskType, result: 'success' }, { state: {} });
      
      // Verify circuit is closed
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('Circuit Breaker Management', () => {
    it('should create separate circuits for different tasks', async () => {
      const unreliableTask = 'unreliable-task';
      const reliableTask = 'reliable-task';
      
      // Open the circuit for the unreliable task
      await circuitBreakerPlugin.onTaskError({ taskType: unreliableTask, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType: unreliableTask, error: new Error('Failure 2') }, { state: {} });
      
      // Verify unreliable task circuit is open
      expect(circuitBreakerPlugin.getCircuitState(unreliableTask)).toBe(CircuitBreakerState.OPEN);
      
      // Reliable task circuit should still be closed
      expect(circuitBreakerPlugin.getCircuitState(reliableTask)).toBe(CircuitBreakerState.CLOSED);
      
      // Calling beforeTaskExecution on reliable task should succeed
      const result = await circuitBreakerPlugin.beforeTaskExecution({ taskType: reliableTask }, { state: {} });
      expect(result.success).toBe(true);
      
      // Calling beforeTaskExecution on unreliable task should fail
      const failResult = await circuitBreakerPlugin.beforeTaskExecution({ taskType: unreliableTask }, { state: {} });
      expect(failResult.success).toBe(false);
      expect(failResult.error?.message).toContain('Circuit is OPEN');
    });
    
    it('should allow manual reset of the circuit', async () => {
      const taskType = 'test-task';
      
      // Open the circuit
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Verify circuit is open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
      
      // Manually reset
      circuitBreakerPlugin.resetCircuit(taskType);
      
      // Circuit should be closed
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
      
      // Analytics should be reset
      const analytics = circuitBreakerPlugin.getCircuitAnalytics(taskType);
      expect(analytics.failureCount).toBe(0);
    });
    
    it('should provide circuit analytics', async () => {
      const taskType = 'test-task';
      
      // Initial analytics
      let analytics = circuitBreakerPlugin.getCircuitAnalytics(taskType);
      expect(analytics.successCount).toBe(0);
      expect(analytics.failureCount).toBe(0);
      
      // Record a success
      await circuitBreakerPlugin.afterTaskExecution({ taskType, result: 'success' }, { state: {} });
      
      // Record a failure
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failed') }, { state: {} });
      
      // Check updated analytics
      analytics = circuitBreakerPlugin.getCircuitAnalytics(taskType);
      expect(analytics.successCount).toBe(1);
      expect(analytics.failureCount).toBe(1);
      expect(analytics.lastSuccess).toBeDefined();
      expect(analytics.lastFailure).toBeDefined();
    });
  });
}); 