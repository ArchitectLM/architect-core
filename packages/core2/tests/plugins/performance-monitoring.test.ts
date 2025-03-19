import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime.js';
import { createRuntime } from '../../src/implementations/runtime.js';
import { createExtensionSystem } from '../../src/implementations/extension-system.js';
import { createEventBus } from '../../src/implementations/event-bus.js';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index.js';
import { createPerformanceMonitoringPlugin, PerformanceMetrics, PerformanceMonitoringPlugin } from '../../src/plugins/performance-monitoring.js';

describe('Performance Monitoring Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let performancePlugin: PerformanceMonitoringPlugin;
  
  // Sample process and task definitions
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing performance monitoring',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  const fastTaskDefinition: TaskDefinition = {
    id: 'fast-task',
    name: 'Fast Task',
    description: 'A fast task for performance testing',
    handler: async (context) => {
      // Simulate a fast task
      return { result: 'Fast task completed' };
    }
  };
  
  const slowTaskDefinition: TaskDefinition = {
    id: 'slow-task',
    name: 'Slow Task',
    description: 'A slow task for performance testing',
    handler: async (context) => {
      // Simulate a slow task
      await new Promise(resolve => setTimeout(resolve, 50));
      return { result: 'Slow task completed' };
    }
  };
  
  beforeEach(() => {
    // Reset mocks and create fresh instances for each test
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    // Create the extension system and event bus
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the plugin
    performancePlugin = createPerformanceMonitoringPlugin() as PerformanceMonitoringPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(performancePlugin);
    
    // Register the event interceptor
    extensionSystem.registerEventInterceptor(performancePlugin.eventInterceptor);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [fastTaskDefinition.id]: fastTaskDefinition,
      [slowTaskDefinition.id]: slowTaskDefinition 
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
  
  describe('Task Execution Metrics', () => {
    it('should track execution time for tasks', async () => {
      // Execute a fast task
      await runtime.executeTask('fast-task', { test: true });
      
      // Execute a slow task
      vi.advanceTimersByTime(50);
      await runtime.executeTask('slow-task', { test: true });
      
      // Get metrics from the plugin
      const metrics = performancePlugin.getMetrics();
      
      // Expect metrics to contain data for both tasks
      expect(metrics.taskExecutionTime).toHaveProperty('fast-task');
      expect(metrics.taskExecutionTime).toHaveProperty('slow-task');
      
      // The slow task should take longer than the fast task
      expect(metrics.taskExecutionTime['slow-task'].average).toBeGreaterThan(
        metrics.taskExecutionTime['fast-task'].average
      );
    });
    
    it('should track task success and failure counts', async () => {
      // Execute successful tasks
      await runtime.executeTask('fast-task', { test: true });
      await runtime.executeTask('fast-task', { test: true });
      
      // Create a failing task
      const failingTaskDefinition: TaskDefinition = {
        id: 'failing-task',
        name: 'Failing Task',
        description: 'A task that fails',
        handler: async () => {
          throw new Error('Task failed');
        }
      };
      
      // Add failing task to runtime
      (runtime as any).taskDefinitions.set('failing-task', failingTaskDefinition);
      
      // Execute failing task and catch the error
      try {
        await runtime.executeTask('failing-task', { test: true });
      } catch (error) {
        // Expected error
      }
      
      // Get metrics from the plugin
      const metrics = performancePlugin.getMetrics();
      
      // Check task counts
      expect(metrics.completedTaskCount).toBe(2);
      expect(metrics.failedTaskCount).toBe(1);
    });
  });
  
  describe('Event Processing Metrics', () => {
    it('should track event processing counts', () => {
      // Publish several events
      runtime.publish('TEST_EVENT_1', { test: true });
      runtime.publish('TEST_EVENT_2', { test: true });
      runtime.publish('TEST_EVENT_1', { test: true });
      
      // Get metrics
      const metrics = performancePlugin.getMetrics();
      
      // Check event counts
      expect(metrics.eventCounts).toHaveProperty('TEST_EVENT_1');
      expect(metrics.eventCounts).toHaveProperty('TEST_EVENT_2');
      expect(metrics.eventCounts['TEST_EVENT_1']).toBe(2);
      expect(metrics.eventCounts['TEST_EVENT_2']).toBe(1);
    });
  });
  
  describe('Metrics API', () => {
    it('should provide a getMetrics method', () => {
      expect(typeof performancePlugin.getMetrics).toBe('function');
      
      const metrics = performancePlugin.getMetrics();
      
      // Check that the metrics object has the expected structure
      expect(metrics).toHaveProperty('taskExecutionTime');
      expect(metrics).toHaveProperty('eventCounts');
      expect(metrics).toHaveProperty('completedTaskCount');
      expect(metrics).toHaveProperty('failedTaskCount');
      expect(metrics).toHaveProperty('activeTaskCount');
    });
    
    it('should reset metrics when requested', async () => {
      // Generate some metrics
      await runtime.executeTask('fast-task', { test: true });
      runtime.publish('TEST_EVENT', { test: true });
      
      // Get metrics and verify they're non-empty
      const metricsBeforeReset = performancePlugin.getMetrics();
      expect(metricsBeforeReset.completedTaskCount).toBe(1);
      expect(metricsBeforeReset.eventCounts['TEST_EVENT']).toBe(1);
      
      // Reset metrics
      performancePlugin.resetMetrics();
      
      // Get metrics again and verify they're reset
      const metricsAfterReset = performancePlugin.getMetrics();
      expect(metricsAfterReset.completedTaskCount).toBe(0);
      expect(Object.keys(metricsAfterReset.eventCounts).length).toBe(0);
    });
  });
}); 