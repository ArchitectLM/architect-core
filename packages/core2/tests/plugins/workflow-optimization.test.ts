import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import { createRuntime } from '../../src/implementations/runtime';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { createEventBus } from '../../src/implementations/event-bus';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index';
import { 
  createWorkflowOptimizationPlugin, 
  WorkflowOptimizationPlugin,
  OptimizationStrategy,
  OptimizationType,
  WorkflowMetrics,
  OptimizationSuggestion
} from '../../src/plugins/workflow-optimization';

describe('Workflow Optimization Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let workflowOptimizationPlugin: WorkflowOptimizationPlugin;
  
  // Mock performance.now for consistent timing-related tests
  const mockNow = 1000;
  let nowValue = mockNow;
  
  // Sample process definition with multiple paths
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing workflow optimization',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'validation', on: 'VALIDATE' },
      { from: 'validation', to: 'completed', on: 'COMPLETE' },
      { from: 'validation', to: 'error', on: 'ERROR' }
    ]
  };
  
  // Task definitions for testing different optimization scenarios
  const createTaskDefinition = (id: string, executionTime = 10, dependencies: string[] = []): TaskDefinition => ({
    id,
    name: `${id} Task`,
    description: `A task for testing workflow optimization`,
    handler: vi.fn().mockImplementation(async (context) => {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, executionTime));
      return { result: `${id} executed` };
    })
  });
  
  // Task types with different characteristics
  const dataPreparationTask = createTaskDefinition('data-prep', 20);
  const validationTask = createTaskDefinition('validation', 10, ['data-prep']);
  const processingTask = createTaskDefinition('processing', 30, ['data-prep']);
  const aggregationTask = createTaskDefinition('aggregation', 15, ['processing']);
  const reportingTask = createTaskDefinition('reporting', 25, ['aggregation']);
  
  beforeEach(() => {
    // Mock performance.now
    vi.spyOn(performance, 'now').mockImplementation(() => nowValue);
    
    // Create fresh instances for each test
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the workflow optimization plugin with default settings
    workflowOptimizationPlugin = createWorkflowOptimizationPlugin({
      enabledStrategies: [
        OptimizationStrategy.PARALLELIZATION,
        OptimizationStrategy.CACHING,
        OptimizationStrategy.BATCHING,
        OptimizationStrategy.PRIORITIZATION
      ],
      optimizationThreshold: 0.1, // 10% improvement threshold
      analysisWindow: 1000, // 1 second window for analysis
      maxSuggestions: 5,
      enableAutoOptimization: true
    }) as WorkflowOptimizationPlugin;
    
    // Register the plugin
    extensionSystem.registerExtension(workflowOptimizationPlugin);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [dataPreparationTask.id]: dataPreparationTask,
      [validationTask.id]: validationTask,
      [processingTask.id]: processingTask,
      [aggregationTask.id]: aggregationTask,
      [reportingTask.id]: reportingTask
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
  
  describe('Workflow Analysis', () => {
    it('should analyze workflow execution patterns', async () => {
      // Execute tasks in sequence
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      await runtime.executeTask(validationTask.id, { data: 'test' });
      await runtime.executeTask(processingTask.id, { data: 'test' });
      
      // Get workflow metrics
      const metrics = workflowOptimizationPlugin.getWorkflowMetrics();
      
      // Check basic metrics
      expect(metrics.totalExecutions).toBe(3);
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
      expect(metrics.totalDependencies).toBeGreaterThan(0);
    });
    
    it('should identify bottlenecks in workflow execution', async () => {
      // Execute tasks multiple times to gather data
      for (let i = 0; i < 3; i++) {
        await runtime.executeTask(dataPreparationTask.id, { data: `test${i}` });
        await runtime.executeTask(validationTask.id, { data: `test${i}` });
        await runtime.executeTask(processingTask.id, { data: `test${i}` });
      }
      
      // Get bottleneck analysis
      const bottlenecks = workflowOptimizationPlugin.analyzeBottlenecks();
      
      // Check for identified bottlenecks
      expect(bottlenecks.length).toBeGreaterThan(0);
      expect(bottlenecks[0].taskId).toBeDefined();
      expect(bottlenecks[0].impact).toBeGreaterThan(0);
      expect(bottlenecks[0].suggestions).toBeDefined();
    });
  });
  
  describe('Optimization Suggestions', () => {
    it('should generate optimization suggestions based on execution patterns', async () => {
      // Execute tasks to gather execution data
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      await runtime.executeTask(validationTask.id, { data: 'test' });
      await runtime.executeTask(processingTask.id, { data: 'test' });
      
      // Get optimization suggestions
      const suggestions = workflowOptimizationPlugin.getOptimizationSuggestions();
      
      // Check suggestion properties
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBeDefined();
      expect(suggestions[0].description).toBeDefined();
      expect(suggestions[0].potentialImprovement).toBeGreaterThan(0);
    });
    
    it('should prioritize suggestions based on impact', async () => {
      // Execute tasks multiple times
      for (let i = 0; i < 5; i++) {
        await runtime.executeTask(dataPreparationTask.id, { data: `test${i}` });
        await runtime.executeTask(validationTask.id, { data: `test${i}` });
      }
      
      // Get prioritized suggestions
      const suggestions = workflowOptimizationPlugin.getOptimizationSuggestions();
      
      // Check suggestion prioritization
      expect(suggestions.length).toBeLessThanOrEqual(5); // maxSuggestions
      expect(suggestions[0].potentialImprovement).toBeGreaterThanOrEqual(
        suggestions[suggestions.length - 1].potentialImprovement
      );
    });
  });
  
  describe('Parallelization Optimization', () => {
    it('should identify opportunities for parallel task execution', async () => {
      // Execute tasks in sequence
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      await runtime.executeTask(validationTask.id, { data: 'test' });
      await runtime.executeTask(processingTask.id, { data: 'test' });
      
      // Get parallelization suggestions
      const suggestions = workflowOptimizationPlugin.getOptimizationSuggestions()
        .filter(s => s.type === OptimizationType.PARALLELIZATION);
      
      // Check for parallelization opportunities
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].description).toContain('parallel');
    });
    
    it('should optimize task execution order for parallelization', async () => {
      // Enable auto-optimization
      workflowOptimizationPlugin.enableAutoOptimization(true);
      
      // Execute tasks
      const startTime = Date.now();
      await Promise.all([
        runtime.executeTask(dataPreparationTask.id, { data: 'test1' }),
        runtime.executeTask(validationTask.id, { data: 'test2' })
      ]);
      const endTime = Date.now();
      
      // Check execution time improvement
      const metrics = workflowOptimizationPlugin.getWorkflowMetrics();
      expect(endTime - startTime).toBeLessThan(
        dataPreparationTask.handler.mock.results[0].value.resolveTime +
        validationTask.handler.mock.results[0].value.resolveTime
      );
    });
  });
  
  describe('Caching Optimization', () => {
    it('should identify cacheable tasks', async () => {
      // Execute tasks with similar inputs
      await runtime.executeTask(dataPreparationTask.id, { data: 'test1' });
      await runtime.executeTask(dataPreparationTask.id, { data: 'test1' });
      
      // Get caching suggestions
      const suggestions = workflowOptimizationPlugin.getOptimizationSuggestions()
        .filter(s => s.type === OptimizationType.CACHING);
      
      // Check for caching opportunities
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].description).toContain('cache');
    });
    
    it('should implement caching for repeated task executions', async () => {
      // Enable caching
      workflowOptimizationPlugin.enableCaching(true);
      
      // Execute same task twice
      const firstStart = Date.now();
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      const firstEnd = Date.now();
      
      const secondStart = Date.now();
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      const secondEnd = Date.now();
      
      // Second execution should be faster
      expect(secondEnd - secondStart).toBeLessThan(firstEnd - firstStart);
      
      // Check cache metrics
      const cacheMetrics = workflowOptimizationPlugin.getCacheMetrics();
      expect(cacheMetrics.hits).toBeGreaterThan(0);
      expect(cacheMetrics.missRate).toBeLessThan(1);
    });
  });
  
  describe('Batching Optimization', () => {
    it('should identify batchable tasks', async () => {
      // Execute multiple similar tasks
      for (let i = 0; i < 5; i++) {
        await runtime.executeTask(validationTask.id, { data: `test${i}` });
      }
      
      // Get batching suggestions
      const suggestions = workflowOptimizationPlugin.getOptimizationSuggestions()
        .filter(s => s.type === OptimizationType.BATCHING);
      
      // Check for batching opportunities
      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].description).toContain('batch');
    });
    
    it('should optimize task execution through batching', async () => {
      // Enable batching
      workflowOptimizationPlugin.enableBatching(true);
      
      // Queue multiple tasks
      const tasks = Array(5).fill(null).map((_, i) => 
        runtime.executeTask(validationTask.id, { data: `test${i}` })
      );
      
      // Execute all tasks
      const startTime = Date.now();
      await Promise.all(tasks);
      const endTime = Date.now();
      
      // Check execution time improvement
      const metrics = workflowOptimizationPlugin.getWorkflowMetrics();
      expect(endTime - startTime).toBeLessThan(
        validationTask.handler.mock.results[0].value.resolveTime * 5
      );
      
      // Check batch metrics
      const batchMetrics = workflowOptimizationPlugin.getBatchMetrics();
      expect(batchMetrics.batchesCreated).toBeGreaterThan(0);
      expect(batchMetrics.averageBatchSize).toBeGreaterThan(1);
    });
  });
  
  describe('Task Prioritization', () => {
    it('should optimize task execution order based on dependencies', async () => {
      // Enable prioritization
      workflowOptimizationPlugin.enablePrioritization(true);
      
      // Queue tasks in non-optimal order
      const tasks = [
        runtime.executeTask(reportingTask.id, { data: 'test' }),
        runtime.executeTask(dataPreparationTask.id, { data: 'test' }),
        runtime.executeTask(processingTask.id, { data: 'test' })
      ];
      
      // Execute tasks
      const startTime = Date.now();
      await Promise.all(tasks);
      const endTime = Date.now();
      
      // Check execution order
      const executionOrder = workflowOptimizationPlugin.getTaskExecutionOrder();
      expect(executionOrder.indexOf(dataPreparationTask.id)).toBeLessThan(
        executionOrder.indexOf(reportingTask.id)
      );
    });
    
    it('should prioritize critical path tasks', async () => {
      // Enable critical path optimization
      workflowOptimizationPlugin.enableCriticalPathOptimization(true);
      
      // Execute tasks
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      await runtime.executeTask(validationTask.id, { data: 'test' });
      await runtime.executeTask(processingTask.id, { data: 'test' });
      
      // Get critical path analysis
      const criticalPath = workflowOptimizationPlugin.getCriticalPath();
      
      // Check critical path identification
      expect(criticalPath.length).toBeGreaterThan(0);
      expect(criticalPath[0].taskId).toBeDefined();
      expect(criticalPath[0].impact).toBeGreaterThan(0);
    });
  });
  
  describe('Performance Monitoring', () => {
    it('should track optimization effectiveness', async () => {
      // Execute tasks before optimization
      const beforeStart = Date.now();
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      await runtime.executeTask(validationTask.id, { data: 'test' });
      const beforeEnd = Date.now();
      
      // Enable optimizations
      workflowOptimizationPlugin.enableAutoOptimization(true);
      
      // Execute tasks after optimization
      const afterStart = Date.now();
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      await runtime.executeTask(validationTask.id, { data: 'test' });
      const afterEnd = Date.now();
      
      // Check performance improvement
      const beforeDuration = beforeEnd - beforeStart;
      const afterDuration = afterEnd - afterStart;
      expect(afterDuration).toBeLessThan(beforeDuration);
      
      // Check optimization metrics
      const optimizationMetrics = workflowOptimizationPlugin.getOptimizationMetrics();
      expect(optimizationMetrics.improvementPercentage).toBeGreaterThan(0);
      expect(optimizationMetrics.optimizedExecutions).toBeGreaterThan(0);
    });
  });
  
  describe('Plugin Integration', () => {
    it('should emit optimization events through event bus', async () => {
      // Spy on event bus
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // Execute tasks to trigger optimization
      await runtime.executeTask(dataPreparationTask.id, { data: 'test' });
      await runtime.executeTask(validationTask.id, { data: 'test' });
      
      // Check for optimization events
      expect(publishSpy).toHaveBeenCalledWith(
        'workflow:optimization',
        expect.objectContaining({
          type: expect.any(String),
          metrics: expect.any(Object),
          suggestions: expect.any(Array)
        })
      );
    });
    
    it('should handle workflow-related events from other components', async () => {
      // Spy on the plugin's event handler
      const handleWorkflowEventSpy = vi.spyOn(workflowOptimizationPlugin, 'handleWorkflowEvent');
      
      // Publish a workflow event
      eventBus.publish('workflow:event', {
        type: 'task_completed',
        taskId: dataPreparationTask.id,
        duration: 100,
        result: { success: true }
      });
      
      // Check that the plugin handled the event
      expect(handleWorkflowEventSpy).toHaveBeenCalled();
    });
  });
}); 