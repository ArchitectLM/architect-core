import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime.js';
import { createRuntime } from '../../src/implementations/runtime.js';
import { createExtensionSystem } from '../../src/implementations/extension-system.js';
import { createEventBus } from '../../src/implementations/event-bus.js';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index.js';
import { 
  createCircuitBreakerPlugin, 
  CircuitBreakerPlugin, 
  CircuitBreakerState 
} from '../../src/plugins/circuit-breaker.js';

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
    handler: async (context) => {
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
      // Execute task and make it fail twice
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Circuit should now be open
      const state = circuitBreakerPlugin.getCircuitState('unreliable-task');
      expect(state).toBe(CircuitBreakerState.OPEN);
    });
    
    it('should reject tasks when circuit is OPEN', async () => {
      // Cause the circuit to open
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Attempt to execute task with circuit open
      let circuitOpenError;
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: false });
      } catch (error) {
        circuitOpenError = error;
      }
      
      // Should get circuit open error, not the task failure error
      expect(circuitOpenError).toBeDefined();
      expect(circuitOpenError.message).toContain('Circuit is OPEN');
    });
    
    it('should transition to HALF_OPEN after reset timeout', async () => {
      // Cause the circuit to open
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Advance time past the reset timeout
      vi.advanceTimersByTime(1100);
      
      // Circuit should now be half-open
      const state = circuitBreakerPlugin.getCircuitState('unreliable-task');
      expect(state).toBe(CircuitBreakerState.HALF_OPEN);
    });
    
    it('should transition back to CLOSED after successful test request', async () => {
      // Cause the circuit to open
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Advance time to transition to half-open
      vi.advanceTimersByTime(1100);
      
      // Execute successful task in half-open state
      await runtime.executeTask('unreliable-task', { shouldFail: false });
      
      // Circuit should now be closed
      const state = circuitBreakerPlugin.getCircuitState('unreliable-task');
      expect(state).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should transition back to OPEN after failed test request', async () => {
      // Cause the circuit to open
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Advance time to transition to half-open
      vi.advanceTimersByTime(1100);
      
      // Execute failing task in half-open state
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Circuit should go back to open
      const state = circuitBreakerPlugin.getCircuitState('unreliable-task');
      expect(state).toBe(CircuitBreakerState.OPEN);
    });
  });
  
  describe('Circuit Breaker Management', () => {
    it('should create separate circuits for different tasks', async () => {
      // Add a second task definition
      const reliableTaskDefinition: TaskDefinition = {
        id: 'reliable-task',
        name: 'Reliable Task',
        description: 'A task that never fails',
        handler: async () => {
          return { result: 'Reliable result' };
        }
      };
      
      (runtime as any).taskDefinitions.set('reliable-task', reliableTaskDefinition);
      
      // Make unreliable task fail to threshold
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Unreliable task circuit should be open
      expect(circuitBreakerPlugin.getCircuitState('unreliable-task')).toBe(CircuitBreakerState.OPEN);
      
      // Reliable task should still work
      const result = await runtime.executeTask('reliable-task', {});
      expect(result).toBeDefined();
      
      // Reliable task circuit should be closed
      expect(circuitBreakerPlugin.getCircuitState('reliable-task')).toBe(CircuitBreakerState.CLOSED);
    });
    
    it('should allow manual reset of the circuit', async () => {
      // Cause the circuit to open
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Manually reset the circuit
      circuitBreakerPlugin.resetCircuit('unreliable-task');
      
      // Circuit should now be closed
      const state = circuitBreakerPlugin.getCircuitState('unreliable-task');
      expect(state).toBe(CircuitBreakerState.CLOSED);
      
      // Should be able to execute the task again
      const result = await runtime.executeTask('unreliable-task', { shouldFail: false });
      expect(result).toBeDefined();
    });
    
    it('should provide circuit analytics', async () => {
      // Execute a mix of successful and failed tasks
      await runtime.executeTask('unreliable-task', { shouldFail: false });
      
      try {
        await runtime.executeTask('unreliable-task', { shouldFail: true });
      } catch (error) { /* Expected error */ }
      
      // Get analytics
      const analytics = circuitBreakerPlugin.getCircuitAnalytics('unreliable-task');
      
      // Analytics should track success and failure counts
      expect(analytics).toBeDefined();
      expect(analytics.successCount).toBe(1);
      expect(analytics.failureCount).toBe(1);
      expect(analytics.lastFailure).toBeDefined();
    });
  });
}); 