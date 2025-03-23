import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import { createRuntime } from '../../src/implementations/runtime';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { createEventBus } from '../../src/implementations/event-bus';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index';
import { 
  createCircuitBreakerPlugin, 
  CircuitBreakerPlugin, 
  CircuitBreakerState 
} from '../../src/plugins/circuit-breaker';

describe('Circuit Breaker Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let circuitBreakerPlugin: CircuitBreakerPlugin;
  
  // Sample process and task definitions
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing circuit breaker',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  const unreliableTaskDefinition: TaskDefinition = {
    id: 'unreliable-task',
    name: 'Unreliable Task',
    description: 'A task that fails frequently',
    handler: async (context: any) => {
      if (context.shouldFail) {
        throw new Error('Task failed');
      }
      return { result: 'Task completed' };
    }
  };
  
  beforeEach(() => {
    // Reset mocks and create fresh instances for each test
    vi.useFakeTimers();
    
    // Create the extension system and event bus
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the plugin with low thresholds for testing
    circuitBreakerPlugin = createCircuitBreakerPlugin({
      failureThreshold: 2,      // Open after 2 failures
      resetTimeout: 1000,       // Reset after 1 second
      halfOpenMaxAttempts: 1    // Allow 1 test attempt in half-open state
    }) as CircuitBreakerPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(circuitBreakerPlugin);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [unreliableTaskDefinition.id]: unreliableTaskDefinition
    };
    
    runtime = createRuntime(
      processDefinitions, 
      taskDefinitions, 
      { extensionSystem, eventBus }
    );
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('Circuit Breaker State Transitions', () => {
    it('should start in CLOSED state', () => {
      const state = circuitBreakerPlugin.getCircuitState('unreliable-task');
      expect(state).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should transition to OPEN after reaching failure threshold', async () => {
      const taskType = 'unreliable-task';
      
      // Directly call onTaskError to simulate task failures
      await circuitBreakerPlugin.onTaskError(
        { taskType, error: new Error('Task failed') }, 
        { state: {} }
      );
      
      // Check state after first failure
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
      
      // Second failure should trigger circuit open
      await circuitBreakerPlugin.onTaskError(
        { taskType, error: new Error('Task failed again') }, 
        { state: {} }
      );
      
      // Circuit should now be open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
    });
    
    it('should reject tasks when circuit is OPEN', async () => {
      const taskType = 'unreliable-task';
      
      // Cause the circuit to open with multiple failures
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Verify circuit is open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
      
      // Attempt to execute task with circuit open
      const result = await circuitBreakerPlugin.beforeTaskExecution({ taskType }, { state: {} });
      
      // Should reject with circuit open error
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Circuit is OPEN');
    });
    
    it('should transition to HALF_OPEN after reset timeout', async () => {
      const taskType = 'unreliable-task';
      
      // Cause the circuit to open
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Verify circuit is open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
      
      // Advance time past the reset timeout
      vi.advanceTimersByTime(1100);
      
      // Trigger state check by calling beforeTaskExecution
      await circuitBreakerPlugin.beforeTaskExecution({ taskType }, { state: {} });
      
      // Circuit should now be half-open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.HALF_OPEN);
    });
    
    it('should transition back to CLOSED after successful test request', async () => {
      const taskType = 'unreliable-task';
      
      // Cause the circuit to open
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Advance time to transition to half-open
      vi.advanceTimersByTime(1100);
      
      // Trigger transition to half-open
      await circuitBreakerPlugin.beforeTaskExecution({ taskType }, { state: {} });
      
      // Simulate successful execution
      await circuitBreakerPlugin.afterTaskExecution({ taskType, result: 'success' }, { state: {} });
      
      // Circuit should now be closed
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should transition back to OPEN after failed test request', async () => {
      const taskType = 'unreliable-task';
      
      // Cause the circuit to open
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Advance time to transition to half-open
      vi.advanceTimersByTime(1100);
      
      // Trigger transition to half-open
      await circuitBreakerPlugin.beforeTaskExecution({ taskType }, { state: {} });
      
      // Verify circuit is half-open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.HALF_OPEN);
      
      // Simulate failed execution
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failed test request') }, { state: {} });
      
      // Circuit should go back to open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
    });
  });
  
  describe('Circuit Breaker Management', () => {
    it('should create separate circuits for different tasks', async () => {
      const unreliableTaskType = 'unreliable-task';
      const reliableTaskType = 'reliable-task';
      
      // Make unreliable task circuit open
      await circuitBreakerPlugin.onTaskError({ taskType: unreliableTaskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType: unreliableTaskType, error: new Error('Failure 2') }, { state: {} });
      
      // Verify unreliable task circuit is open
      expect(circuitBreakerPlugin.getCircuitState(unreliableTaskType)).toBe(CircuitBreakerState.OPEN);
      
      // Verify reliable task circuit is still closed
      expect(circuitBreakerPlugin.getCircuitState(reliableTaskType)).toBe(CircuitBreakerState.CLOSED);
      
      // Simulate successful reliable task execution
      await circuitBreakerPlugin.afterTaskExecution({ taskType: reliableTaskType, result: 'success' }, { state: {} });
      
      // Should still be able to execute reliable task
      const result = await circuitBreakerPlugin.beforeTaskExecution({ taskType: reliableTaskType }, { state: {} });
      expect(result.success).toBe(true);
    });
    
    it('should allow manual reset of the circuit', async () => {
      const taskType = 'unreliable-task';
      
      // Cause the circuit to open
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 1') }, { state: {} });
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure 2') }, { state: {} });
      
      // Verify circuit is open
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.OPEN);
      
      // Manually reset the circuit
      circuitBreakerPlugin.resetCircuit(taskType);
      
      // Verify circuit is closed
      expect(circuitBreakerPlugin.getCircuitState(taskType)).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should provide circuit analytics', async () => {
      const taskType = 'unreliable-task';
      
      // Record a failure
      await circuitBreakerPlugin.onTaskError({ taskType, error: new Error('Failure') }, { state: {} });
      
      // Record a success
      await circuitBreakerPlugin.afterTaskExecution({ taskType, result: 'success' }, { state: {} });
      
      // Get analytics
      const analytics = circuitBreakerPlugin.getCircuitAnalytics(taskType);
      
      // Analytics should track success and failure counts
      expect(analytics).toBeDefined();
      expect(analytics.successCount).toBe(1);
      expect(analytics.failureCount).toBe(1);
      expect(analytics.lastFailure).toBeDefined();
      expect(analytics.lastSuccess).toBeDefined();
    });
  });
}); 