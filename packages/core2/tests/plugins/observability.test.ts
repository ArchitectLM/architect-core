import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import { createRuntime } from '../../src/implementations/runtime';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { createEventBus } from '../../src/implementations/event-bus';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index';
import { 
  createObservabilityPlugin, 
  ObservabilityPlugin,
  MetricType,
  TraceSpan,
  LogLevel
} from '../../src/plugins/observability';

describe('Observability Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let observabilityPlugin: ObservabilityPlugin;
  
  // Mock current time for consistent testing
  const mockNow = new Date('2023-01-01T12:00:00Z').getTime();
  
  // Sample process definition
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing observability',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  // Task definitions for testing different scenarios
  const createTrackedTaskDefinition = (id: string, executionTime = 10): TaskDefinition => ({
    id,
    name: `${id} Task`,
    description: `A task for testing observability`,
    handler: vi.fn().mockImplementation(async (context) => {
      // Simulate some processing time
      await new Promise(resolve => setTimeout(resolve, executionTime));
      return { result: `${id} executed` };
    })
  });
  
  // Initialize tasks with different characteristics
  const fastTask = createTrackedTaskDefinition('fast-task', 10);
  const slowTask = createTrackedTaskDefinition('slow-task', 50);
  const errorTask = createTrackedTaskDefinition('error-task', 20);
  const memoryIntensiveTask = createTrackedTaskDefinition('memory-task', 30);
  
  beforeEach(() => {
    // Mock Date.now for consistent testing
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow);
    
    // Create fresh instances for each test
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the plugin with default settings
    observabilityPlugin = createObservabilityPlugin({
      enableMetrics: true,
      enableTracing: true,
      enableLogging: true,
      samplingRate: 1.0,
      logLevel: LogLevel.INFO
    }) as ObservabilityPlugin;
    
    // Register the plugin with the extension system
    extensionSystem.registerExtension(observabilityPlugin);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [fastTask.id]: fastTask,
      [slowTask.id]: slowTask,
      [errorTask.id]: errorTask,
      [memoryIntensiveTask.id]: memoryIntensiveTask
    };
    
    runtime = createRuntime(
      processDefinitions, 
      taskDefinitions, 
      { extensionSystem, eventBus }
    );
    
    // Reset mock function call counts
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  
  describe('Metrics Collection', () => {
    it('should track task execution metrics', async () => {
      // Execute tasks
      await runtime.executeTask(fastTask.id, { data: 'fast' });
      await runtime.executeTask(slowTask.id, { data: 'slow' });
      
      // Get metrics
      const metrics = observabilityPlugin.getMetrics();
      
      // Check task execution metrics
      expect(metrics['task.execution.count']).toBe(2);
      expect(metrics['task.execution.duration']).toBeDefined();
      expect(metrics['task.execution.duration'].sum).toBeGreaterThanOrEqual(60); // 10 + 50
      expect(metrics['task.execution.duration'].count).toBe(2);
      
      // Check task-specific metrics
      expect(metrics['task.execution.count.fast-task']).toBe(1);
      expect(metrics['task.execution.count.slow-task']).toBe(1);
    });
    
    it('should track error metrics', async () => {
      // Mock error task to throw
      errorTask.handler = vi.fn().mockRejectedValue(new Error('Task failed'));
      
      // Execute error task
      try {
        await runtime.executeTask(errorTask.id, { data: 'error' });
      } catch (error) {
        // Expected error
      }
      
      // Get metrics
      const metrics = observabilityPlugin.getMetrics();
      
      // Check error metrics
      expect(metrics['task.error.count']).toBe(1);
      expect(metrics['task.error.count.error-task']).toBe(1);
    });
    
    it('should track resource usage metrics', async () => {
      // Execute memory-intensive task
      await runtime.executeTask(memoryIntensiveTask.id, { data: 'memory' });
      
      // Get metrics
      const metrics = observabilityPlugin.getMetrics();
      
      // Check resource metrics
      expect(metrics['task.memory.usage']).toBeDefined();
      expect(metrics['task.memory.usage'].sum).toBeGreaterThan(0);
      expect(metrics['task.memory.usage'].count).toBe(1);
    });
    
    it('should support custom metrics', async () => {
      // Record custom metrics
      observabilityPlugin.recordMetric('custom.counter', 1, MetricType.COUNTER);
      observabilityPlugin.recordMetric('custom.gauge', 42, MetricType.GAUGE);
      observabilityPlugin.recordMetric('custom.histogram', 100, MetricType.HISTOGRAM);
      
      // Get metrics
      const metrics = observabilityPlugin.getMetrics();
      
      // Check custom metrics
      expect(metrics['custom.counter']).toBe(1);
      expect(metrics['custom.gauge']).toBe(42);
      expect(metrics['custom.histogram']).toBeDefined();
      expect(metrics['custom.histogram'].sum).toBe(100);
      expect(metrics['custom.histogram'].count).toBe(1);
    });
  });
  
  describe('Tracing', () => {
    it('should create trace spans for task execution', async () => {
      // Execute task
      await runtime.executeTask(fastTask.id, { data: 'fast' });
      
      // Get traces
      const traces = observabilityPlugin.getTraces();
      
      // Check trace creation
      expect(traces.length).toBeGreaterThan(0);
      
      // Find task execution span
      const taskSpan = traces.find(span => 
        span.name === 'task.execute' && 
        span.attributes['task.id'] === fastTask.id
      );
      
      expect(taskSpan).toBeDefined();
      expect(taskSpan?.duration).toBeGreaterThanOrEqual(10); // Execution time
      expect(taskSpan?.attributes['task.name']).toBe(fastTask.name);
    });
    
    it('should create nested trace spans', async () => {
      // Create a task that calls another task
      const parentTask: TaskDefinition = {
        id: 'parent-task',
        name: 'Parent Task',
        description: 'A task that calls another task',
        handler: async (context) => {
          // Call child task
          await runtime.executeTask(fastTask.id, { data: 'child' });
          return { result: 'parent completed' };
        }
      };
      
      // Register parent task
      (runtime as any).taskDefinitions[parentTask.id] = parentTask;
      
      // Execute parent task
      await runtime.executeTask(parentTask.id, { data: 'parent' });
      
      // Get traces
      const traces = observabilityPlugin.getTraces();
      
      // Find parent and child spans
      const parentSpan = traces.find(span => 
        span.name === 'task.execute' && 
        span.attributes['task.id'] === parentTask.id
      );
      
      const childSpan = traces.find(span => 
        span.name === 'task.execute' && 
        span.attributes['task.id'] === fastTask.id
      );
      
      expect(parentSpan).toBeDefined();
      expect(childSpan).toBeDefined();
      expect(childSpan?.parentId).toBe(parentSpan?.id);
    });
    
    it('should add context to trace spans', async () => {
      // Execute task with context
      await runtime.executeTask(fastTask.id, { 
        data: 'test',
        context: { 
          userId: 'user123',
          requestId: 'req456'
        }
      });
      
      // Get traces
      const traces = observabilityPlugin.getTraces();
      
      // Find task span
      const taskSpan = traces.find(span => 
        span.name === 'task.execute' && 
        span.attributes['task.id'] === fastTask.id
      );
      
      // Check context attributes
      expect(taskSpan?.attributes['context.userId']).toBe('user123');
      expect(taskSpan?.attributes['context.requestId']).toBe('req456');
    });
  });
  
  describe('Logging', () => {
    it('should log task execution events', async () => {
      // Execute task
      await runtime.executeTask(fastTask.id, { data: 'test' });
      
      // Get logs
      const logs = observabilityPlugin.getLogs();
      
      // Check for execution logs
      expect(logs.some(log => 
        log.level === LogLevel.INFO &&
        log.message.includes('Task execution started') &&
        log.context.taskId === fastTask.id
      )).toBe(true);
      
      expect(logs.some(log => 
        log.level === LogLevel.INFO &&
        log.message.includes('Task execution completed') &&
        log.context.taskId === fastTask.id
      )).toBe(true);
    });
    
    it('should log errors with appropriate level', async () => {
      // Mock error task to throw
      errorTask.handler = vi.fn().mockRejectedValue(new Error('Task failed'));
      
      // Execute error task
      try {
        await runtime.executeTask(errorTask.id, { data: 'error' });
      } catch (error) {
        // Expected error
      }
      
      // Get logs
      const logs = observabilityPlugin.getLogs();
      
      // Check for error logs
      expect(logs.some(log => 
        log.level === LogLevel.ERROR &&
        log.message.includes('Task execution failed') &&
        log.context.taskId === errorTask.id &&
        log.context.error instanceof Error
      )).toBe(true);
    });
    
    it('should support structured logging', async () => {
      // Log structured data
      observabilityPlugin.log(LogLevel.INFO, 'Structured log message', {
        userId: 'user123',
        action: 'test',
        metadata: {
          timestamp: Date.now(),
          version: '1.0'
        }
      });
      
      // Get logs
      const logs = observabilityPlugin.getLogs();
      
      // Check structured log
      const structuredLog = logs.find(log => 
        log.level === LogLevel.INFO &&
        log.message === 'Structured log message'
      );
      
      expect(structuredLog).toBeDefined();
      expect(structuredLog?.context.userId).toBe('user123');
      expect(structuredLog?.context.action).toBe('test');
      expect(structuredLog?.context.metadata).toBeDefined();
      expect(structuredLog?.context.metadata.timestamp).toBeDefined();
      expect(structuredLog?.context.metadata.version).toBe('1.0');
    });
  });
  
  describe('Sampling', () => {
    it('should respect sampling rate for metrics', async () => {
      // Create plugin with 50% sampling rate
      const sampledPlugin = createObservabilityPlugin({
        samplingRate: 0.5
      }) as ObservabilityPlugin;
      
      // Execute multiple tasks
      for (let i = 0; i < 10; i++) {
        await runtime.executeTask(fastTask.id, { data: `test${i}` });
      }
      
      // Get metrics
      const metrics = sampledPlugin.getMetrics();
      
      // Check that approximately 50% of executions were sampled
      const sampledCount = metrics['task.execution.count'] || 0;
      expect(sampledCount).toBeGreaterThan(0);
      expect(sampledCount).toBeLessThan(10);
    });
    
    it('should respect sampling rate for traces', async () => {
      // Create plugin with 50% sampling rate
      const sampledPlugin = createObservabilityPlugin({
        samplingRate: 0.5
      }) as ObservabilityPlugin;
      
      // Execute multiple tasks
      for (let i = 0; i < 10; i++) {
        await runtime.executeTask(fastTask.id, { data: `test${i}` });
      }
      
      // Get traces
      const traces = sampledPlugin.getTraces();
      
      // Check that approximately 50% of executions were traced
      expect(traces.length).toBeGreaterThan(0);
      expect(traces.length).toBeLessThan(10);
    });
  });
  
  describe('Export and Integration', () => {
    it('should support metric export', async () => {
      // Execute some tasks
      await runtime.executeTask(fastTask.id, { data: 'test' });
      
      // Export metrics
      const exportedMetrics = observabilityPlugin.exportMetrics();
      
      // Check export format
      expect(exportedMetrics).toBeDefined();
      expect(exportedMetrics.timestamp).toBeDefined();
      expect(exportedMetrics.metrics).toBeDefined();
      expect(Object.keys(exportedMetrics.metrics).length).toBeGreaterThan(0);
    });
    
    it('should support trace export', async () => {
      // Execute task
      await runtime.executeTask(fastTask.id, { data: 'test' });
      
      // Export traces
      const exportedTraces = observabilityPlugin.exportTraces();
      
      // Check export format
      expect(exportedTraces).toBeDefined();
      expect(exportedTraces.timestamp).toBeDefined();
      expect(exportedTraces.traces).toBeDefined();
      expect(exportedTraces.traces.length).toBeGreaterThan(0);
    });
    
    it('should support log export', async () => {
      // Generate some logs
      observabilityPlugin.log(LogLevel.INFO, 'Test log');
      
      // Export logs
      const exportedLogs = observabilityPlugin.exportLogs();
      
      // Check export format
      expect(exportedLogs).toBeDefined();
      expect(exportedLogs.timestamp).toBeDefined();
      expect(exportedLogs.logs).toBeDefined();
      expect(exportedLogs.logs.length).toBeGreaterThan(0);
    });
  });
}); 