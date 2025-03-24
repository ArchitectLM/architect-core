import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { createInMemoryEventBus } from '../../src/implementations/event-bus';
import { ExtensionSystem } from '../../src/models/extension-system';
import { EventBus } from '../../src/models/event-system';
import { createPerformanceMonitoringPlugin, PerformanceMonitoringPlugin } from '../../src/plugins/performance-monitoring';

// Extend the PerformanceMonitoringPlugin to match the Extension interface
class ExtendedPerformanceMonitoringPlugin extends PerformanceMonitoringPlugin {
  id = 'performance-monitoring';
  dependencies = [];
  
  getHooks() {
    return [];
  }
  
  getVersion() {
    return '1.0.0';
  }
  
  getCapabilities() {
    return ['performance-monitoring'];
  }
}

describe('Performance Monitoring Plugin', () => {
  let extensionSystem: ExtensionSystem;
  let eventBus: EventBus;
  let performancePlugin: ExtendedPerformanceMonitoringPlugin;
  
  beforeEach(() => {
    // Reset mocks and create fresh instances for each test
    vi.useFakeTimers({ shouldAdvanceTime: true });
    
    // Create the extension system and event bus
    extensionSystem = createExtensionSystem();
    eventBus = createInMemoryEventBus(extensionSystem);
    
    // Create the plugin and register it
    performancePlugin = new ExtendedPerformanceMonitoringPlugin();
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(performancePlugin);
    
    // Register the event interceptor with the event bus
    if (typeof (eventBus as any).addEventFilter === 'function') {
      (eventBus as any).addEventFilter((event: any) => {
        performancePlugin.eventInterceptor(event);
        return true; // Continue processing the event
      });
    }
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('Task Execution Metrics', () => {
    it('should track execution time for tasks', async () => {
      // Directly call the hooks instead of through runtime
      const startTime1 = performance.now();
      
      await performancePlugin.hooks['task:beforeExecution']({
        taskType: 'fast-task',
        _metrics: { startTime: startTime1 }
      });
      
      await performancePlugin.hooks['task:afterExecution']({
        taskType: 'fast-task',
        _metrics: { startTime: startTime1 }
      });
      
      // Execute a slow task
      vi.advanceTimersByTime(50);
      const startTime2 = performance.now();
      
      await performancePlugin.hooks['task:beforeExecution']({
        taskType: 'slow-task',
        _metrics: { startTime: startTime2 }
      });
      
      await performancePlugin.hooks['task:afterExecution']({
        taskType: 'slow-task',
        _metrics: { startTime: startTime2 - 50 }
      });
      
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
      // Execute successful tasks by calling hooks directly
      await performancePlugin.hooks['task:beforeExecution']({
        taskType: 'fast-task'
      });
      
      await performancePlugin.hooks['task:afterExecution']({
        taskType: 'fast-task'
      });
      
      await performancePlugin.hooks['task:beforeExecution']({
        taskType: 'fast-task'
      });
      
      await performancePlugin.hooks['task:afterExecution']({
        taskType: 'fast-task'
      });
      
      // Simulate a failing task
      await performancePlugin.hooks['task:beforeExecution']({
        taskType: 'failing-task'
      });
      
      await performancePlugin.hooks['task:onError']({
        taskType: 'failing-task',
        error: new Error('Task failed')
      });
      
      // Get metrics from the plugin
      const metrics = performancePlugin.getMetrics();
      
      // Check task counts
      expect(metrics.completedTaskCount).toBe(2);
      expect(metrics.failedTaskCount).toBe(1);
    });
  });
  
  describe('Event Processing Metrics', () => {
    it('should track event processing counts', () => {
      // Directly call the event interceptor
      performancePlugin.eventInterceptor({ 
        id: '1',
        type: 'TEST_EVENT_1', 
        payload: { test: true },
        timestamp: Date.now()
      });
      performancePlugin.eventInterceptor({ 
        id: '2',
        type: 'TEST_EVENT_2', 
        payload: { test: true },
        timestamp: Date.now()
      });
      performancePlugin.eventInterceptor({ 
        id: '3',
        type: 'TEST_EVENT_1', 
        payload: { test: true },
        timestamp: Date.now()
      });
      
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
      await performancePlugin.hooks['task:beforeExecution']({
        taskType: 'fast-task'
      });
      
      await performancePlugin.hooks['task:afterExecution']({
        taskType: 'fast-task'
      });
      
      performancePlugin.eventInterceptor({ 
        id: '1',
        type: 'TEST_EVENT', 
        payload: { test: true },
        timestamp: Date.now()
      });
      
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