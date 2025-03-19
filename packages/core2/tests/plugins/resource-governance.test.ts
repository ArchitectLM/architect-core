import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime.js';
import { createRuntime } from '../../src/implementations/runtime.js';
import { createExtensionSystem } from '../../src/implementations/extension-system.js';
import { createEventBus } from '../../src/implementations/event-bus.js';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index.js';
import { 
  createResourceGovernancePlugin, 
  ResourceGovernancePlugin,
  ResourceConfig,
  ResourceType,
  ResourcePolicy,
  ThrottlingStrategy
} from '../../src/plugins/resource-governance.js';

describe('Resource Governance Plugin', () => {
  let runtime: Runtime;
  let extensionSystem = createExtensionSystem();
  let eventBus = createEventBus();
  let resourceGovernancePlugin: ResourceGovernancePlugin;
  
  // Mock performance.now for consistent timing-related tests
  const mockNow = 1000;
  let nowValue = mockNow;
  
  // Mock memory usage
  const mockMemoryUsage = vi.fn().mockImplementation(() => ({
    heapUsed: 100 * 1024 * 1024, // 100MB
    heapTotal: 200 * 1024 * 1024, // 200MB
    rss: 300 * 1024 * 1024, // 300MB
    external: 50 * 1024 * 1024 // 50MB
  }));
  
  // Sample process definition
  const testProcessDefinition: ProcessDefinition = {
    id: 'test-process',
    name: 'Test Process',
    description: 'Process for testing resource governance',
    initialState: 'initial',
    transitions: [
      { from: 'initial', to: 'processing', on: 'START' },
      { from: 'processing', to: 'completed', on: 'COMPLETE' }
    ]
  };
  
  // Task definitions for testing different resource characteristics
  const createTaskDefinition = (id: string, executionTime = 10, memoryUsage = 10): TaskDefinition => ({
    id,
    name: `${id} Task`,
    description: `A task for testing resource governance`,
    metadata: {
      resourceRequirements: {
        cpu: executionTime / 10, // Simulate CPU intensity
        memory: memoryUsage // MB
      }
    },
    handler: vi.fn().mockImplementation(async (context) => {
      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, executionTime));
      // Simulate memory usage by creating a large object
      const largeArray = Array(memoryUsage * 1024).fill('x');
      return { result: `${id} executed`, size: largeArray.length };
    })
  });
  
  // Task types with different resource profiles
  const lightweightTask = createTaskDefinition('lightweight-task', 10, 5);
  const cpuIntensiveTask = createTaskDefinition('cpu-intensive-task', 100, 10);
  const memoryIntensiveTask = createTaskDefinition('memory-intensive-task', 30, 50);
  const balancedTask = createTaskDefinition('balanced-task', 50, 20);
  const excessiveTask = createTaskDefinition('excessive-task', 200, 150);
  
  beforeEach(() => {
    // Mock performance.now
    vi.spyOn(performance, 'now').mockImplementation(() => nowValue);
    vi.spyOn(process, 'memoryUsage').mockImplementation(mockMemoryUsage);
    
    // Create fresh instances for each test
    extensionSystem = createExtensionSystem();
    eventBus = createEventBus();
    
    // Create the resource governance plugin with default settings
    resourceGovernancePlugin = createResourceGovernancePlugin({
      resources: {
        [ResourceType.CPU]: {
          limit: 0.8, // 80% CPU utilization limit
          throttlingStrategy: ThrottlingStrategy.TIMEOUT
        },
        [ResourceType.MEMORY]: {
          limit: 200, // 200MB memory limit
          throttlingStrategy: ThrottlingStrategy.CIRCUIT_BREAKER
        }
      },
      policies: [
        {
          name: 'default-policy',
          description: 'Default resource policy',
          resourceLimits: {
            [ResourceType.CPU]: 0.8,
            [ResourceType.MEMORY]: 200
          },
          taskPriorities: {
            'lightweight-task': 10,
            'cpu-intensive-task': 5,
            'memory-intensive-task': 3,
            'balanced-task': 7,
            'excessive-task': 1
          },
          taskTimeouts: {
            'lightweight-task': 500,
            'cpu-intensive-task': 5000,
            'memory-intensive-task': 2000,
            'balanced-task': 3000,
            'excessive-task': 10000
          }
        }
      ],
      defaultPolicy: 'default-policy',
      enableRuntimeThrottling: true,
      monitoringInterval: 100
    }) as ResourceGovernancePlugin;
    
    // Register the plugin
    extensionSystem.registerExtension(resourceGovernancePlugin);
    
    // Create runtime with the extension system
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [lightweightTask.id]: lightweightTask,
      [cpuIntensiveTask.id]: cpuIntensiveTask,
      [memoryIntensiveTask.id]: memoryIntensiveTask,
      [balancedTask.id]: balancedTask,
      [excessiveTask.id]: excessiveTask
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
  
  describe('Resource Monitoring', () => {
    it('should monitor resource usage during task execution', async () => {
      // Execute task
      await runtime.executeTask(lightweightTask.id, { data: 'test' });
      
      // Get resource metrics
      const metrics = resourceGovernancePlugin.getResourceMetrics();
      
      // Check for CPU metrics
      expect(metrics.cpu).toBeDefined();
      expect(metrics.cpu.current).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.average).toBeGreaterThanOrEqual(0);
      expect(metrics.cpu.peak).toBeGreaterThanOrEqual(0);
      
      // Check for memory metrics
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.current).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.average).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.peak).toBeGreaterThanOrEqual(0);
    });
    
    it('should track resource usage per task', async () => {
      // Execute different tasks
      await runtime.executeTask(lightweightTask.id, { data: 'light' });
      await runtime.executeTask(cpuIntensiveTask.id, { data: 'cpu' });
      
      // Get task metrics
      const taskMetrics = resourceGovernancePlugin.getTaskResourceMetrics();
      
      // Check task-specific metrics
      expect(taskMetrics[lightweightTask.id]).toBeDefined();
      expect(taskMetrics[cpuIntensiveTask.id]).toBeDefined();
      expect(taskMetrics[lightweightTask.id].cpu.average).toBeLessThan(taskMetrics[cpuIntensiveTask.id].cpu.average);
    });
  });
  
  describe('Resource Throttling', () => {
    it('should throttle CPU-intensive tasks', async () => {
      // Mock high CPU usage
      resourceGovernancePlugin.getCurrentCpuUsage = vi.fn().mockReturnValue(0.9); // 90% CPU
      
      // Time the execution
      const startTime = Date.now();
      await runtime.executeTask(cpuIntensiveTask.id, { data: 'cpu' });
      const endTime = Date.now();
      
      // Execution should take longer due to throttling
      const duration = endTime - startTime;
      expect(duration).toBeGreaterThan(cpuIntensiveTask.handler.mock.results[0].value.resolveTime);
      
      // Check throttling counter
      const throttlingMetrics = resourceGovernancePlugin.getThrottlingMetrics();
      expect(throttlingMetrics.throttledTasks).toBeGreaterThan(0);
      expect(throttlingMetrics.throttlingEvents.cpu).toBeGreaterThan(0);
    });
    
    it('should apply circuit breaking for memory-intensive tasks', async () => {
      // Mock high memory usage
      resourceGovernancePlugin.getCurrentMemoryUsage = vi.fn().mockReturnValue(250); // 250MB, over the 200MB limit
      
      // Execute memory-intensive task, should be rejected
      await expect(runtime.executeTask(memoryIntensiveTask.id, { data: 'memory' }))
        .rejects.toThrow(/memory limit exceeded/i);
      
      // Check circuit breaker counter
      const throttlingMetrics = resourceGovernancePlugin.getThrottlingMetrics();
      expect(throttlingMetrics.rejectedTasks).toBeGreaterThan(0);
      expect(throttlingMetrics.throttlingEvents.memory).toBeGreaterThan(0);
    });
    
    it('should queue tasks when concurrency limit is reached', async () => {
      // Set concurrency limit to 1
      resourceGovernancePlugin.setConcurrencyLimit(1);
      
      // Start one long-running task
      const taskPromise = runtime.executeTask(cpuIntensiveTask.id, { data: 'cpu' });
      
      // Try to execute another task immediately
      const startTime = Date.now();
      const secondTaskPromise = runtime.executeTask(lightweightTask.id, { data: 'light' });
      
      // Both tasks should complete
      await Promise.all([taskPromise, secondTaskPromise]);
      const endTime = Date.now();
      
      // Second task should be queued and executed after the first one
      expect(endTime - startTime).toBeGreaterThan(cpuIntensiveTask.handler.mock.implementationFn().resolveTime);
      
      // Check queue metrics
      const queueMetrics = resourceGovernancePlugin.getQueueMetrics();
      expect(queueMetrics.queuedTasks).toBeGreaterThan(0);
      expect(queueMetrics.maxQueueLength).toBeGreaterThanOrEqual(1);
    });
  });
  
  describe('Resource Policies', () => {
    it('should apply task-specific resource limits', async () => {
      // Create a policy with task-specific limits
      resourceGovernancePlugin.createPolicy({
        name: 'custom-policy',
        description: 'Custom resource policy',
        resourceLimits: {
          [ResourceType.CPU]: 0.5,
          [ResourceType.MEMORY]: 100
        },
        taskResourceLimits: {
          [memoryIntensiveTask.id]: {
            [ResourceType.MEMORY]: 30 // Lower than the task normally uses
          }
        }
      });
      
      // Apply the policy
      resourceGovernancePlugin.applyPolicy('custom-policy');
      
      // Execute memory-intensive task, should be throttled
      resourceGovernancePlugin.getCurrentMemoryUsage = vi.fn().mockReturnValue(40); // 40MB
      
      // Should be rejected due to task-specific limit
      await expect(runtime.executeTask(memoryIntensiveTask.id, { data: 'memory' }))
        .rejects.toThrow(/memory limit exceeded/i);
      
      // But lightweight task should run fine
      await expect(runtime.executeTask(lightweightTask.id, { data: 'light' }))
        .resolves.toBeDefined();
    });
    
    it('should prioritize high-priority tasks during resource contention', async () => {
      // Set concurrency limit to 1
      resourceGovernancePlugin.setConcurrencyLimit(1);
      
      // Create a policy with priorities
      resourceGovernancePlugin.createPolicy({
        name: 'priority-policy',
        description: 'Priority-based policy',
        taskPriorities: {
          [lightweightTask.id]: 10, // Higher priority
          [balancedTask.id]: 5      // Lower priority
        }
      });
      
      // Apply the policy
      resourceGovernancePlugin.applyPolicy('priority-policy');
      
      // Queue multiple tasks
      const lowPriorityPromise = runtime.executeTask(balancedTask.id, { data: 'low' });
      const highPriorityPromise = runtime.executeTask(lightweightTask.id, { data: 'high' });
      const anotherLowPriorityPromise = runtime.executeTask(balancedTask.id, { data: 'another-low' });
      
      // Wait for all tasks to complete
      await Promise.all([lowPriorityPromise, highPriorityPromise, anotherLowPriorityPromise]);
      
      // Check execution order from the mock calls
      const executionOrder = resourceGovernancePlugin.getTaskExecutionOrder();
      
      // High priority task should be moved up in the queue
      expect(executionOrder.indexOf(lightweightTask.id)).toBeLessThan(
        executionOrder.indexOf(balancedTask.id + '-another-low')
      );
    });
  });
  
  describe('Task Timeouts', () => {
    it('should apply task timeouts as specified in the policy', async () => {
      // Apply timeout policy
      resourceGovernancePlugin.setTaskTimeout(cpuIntensiveTask.id, 50); // 50ms timeout
      
      // Modify task to take longer than timeout
      cpuIntensiveTask.handler = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms
        return { result: 'too long' };
      });
      
      // Execute task, should timeout
      await expect(runtime.executeTask(cpuIntensiveTask.id, { data: 'timeout' }))
        .rejects.toThrow(/task execution timeout/i);
      
      // Check timeout counter
      const timeoutMetrics = resourceGovernancePlugin.getTimeoutMetrics();
      expect(timeoutMetrics.timedOutTasks).toBeGreaterThan(0);
    });
  });
  
  describe('Adaptive Throttling', () => {
    it('should adapt throttling based on resource trends', async () => {
      // Enable adaptive throttling
      resourceGovernancePlugin.enableAdaptiveThrottling(true);
      
      // Mock increasing CPU usage over time
      let cpuUsage = 0.5; // Starting at 50%
      resourceGovernancePlugin.getCurrentCpuUsage = vi.fn().mockImplementation(() => {
        cpuUsage += 0.1; // Increase by 10% each time
        return cpuUsage;
      });
      
      // Execute multiple tasks to trigger adaptive throttling
      for (let i = 0; i < 5; i++) {
        try {
          await runtime.executeTask(lightweightTask.id, { data: `iteration-${i}` });
        } catch (error) {
          // Some tasks may be rejected, that's expected
        }
      }
      
      // Check that throttling became more aggressive
      const adaptiveMetrics = resourceGovernancePlugin.getAdaptiveThrottlingMetrics();
      expect(adaptiveMetrics.adaptations).toBeGreaterThan(0);
      expect(adaptiveMetrics.currentThrottlingLevel).toBeGreaterThan(adaptiveMetrics.initialThrottlingLevel);
    });
  });
  
  describe('Resource Reservation', () => {
    it('should reserve resources for critical tasks', async () => {
      // Set resource reservation for a critical task
      resourceGovernancePlugin.reserveResources(lightweightTask.id, {
        [ResourceType.CPU]: 0.2,
        [ResourceType.MEMORY]: 50
      });
      
      // Mock high resource usage
      resourceGovernancePlugin.getCurrentCpuUsage = vi.fn().mockReturnValue(0.75); // 75% CPU
      resourceGovernancePlugin.getCurrentMemoryUsage = vi.fn().mockReturnValue(150); // 150MB
      
      // Execute critical task, should run despite high resource usage
      await expect(runtime.executeTask(lightweightTask.id, { data: 'critical' }))
        .resolves.toBeDefined();
      
      // But non-critical task should be throttled
      await expect(runtime.executeTask(balancedTask.id, { data: 'non-critical' }))
        .rejects.toThrow(/resource limit exceeded/i);
      
      // Check reservation metrics
      const reservationMetrics = resourceGovernancePlugin.getReservationMetrics();
      expect(reservationMetrics.reservedResources[lightweightTask.id]).toBeDefined();
    });
  });
  
  describe('Plugin Integration', () => {
    it('should report resource metrics through event bus', async () => {
      // Spy on event bus
      const emitSpy = vi.spyOn(eventBus, 'emit');
      
      // Execute task
      await runtime.executeTask(lightweightTask.id, { data: 'event-test' });
      
      // Check for resource metrics events
      expect(emitSpy).toHaveBeenCalledWith(
        'resource:metrics',
        expect.objectContaining({
          cpu: expect.any(Object),
          memory: expect.any(Object),
          time: expect.any(Number)
        })
      );
    });
    
    it('should handle resource-related events from other components', async () => {
      // Spy on the plugin's event handler
      const handleResourceAlertSpy = vi.spyOn(resourceGovernancePlugin, 'handleResourceAlert');
      
      // Emit a resource alert event
      eventBus.emit('resource:alert', {
        type: ResourceType.MEMORY,
        level: 'warning',
        message: 'Memory usage approaching limit',
        value: 180, // MB
        limit: 200  // MB
      });
      
      // Check that the plugin handled the event
      expect(handleResourceAlertSpy).toHaveBeenCalled();
    });
  });
}); 