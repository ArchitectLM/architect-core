import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime';
import { 
  createRuntime,
  createTaskPrioritizationPluginInstance,
  createTransactionPluginInstance,
  createExtensionSystemInstance,
  createEventBusInstance
} from '../../src/factories';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index';
import { Extension } from '../../src/models/extension';
import { 
  TaskPriority,
  SchedulingPolicy,
  TaskMetadata,
  TaskPrioritizationPlugin
} from '../../src/plugins/task-prioritization';
import { EventBus } from '../../src/models/event';
import { ExtensionSystem } from '../../src/models/extension';

// Plugin interface that includes both Extension and plugin-specific methods
interface TaskPrioritizationPluginWithHooks extends Extension {
  setTaskPriority: (taskId: string, priority: TaskPriority) => void;
  getTaskPriority: (taskId: string) => TaskPriority;
  setTaskExecutionTime: (taskId: string, time: number) => void;
  setSchedulingPolicy: (policy: SchedulingPolicy) => void;
  setMaxConcurrentTasks: (max: number) => void;
  enablePreemption: (enabled: boolean) => void;
  setTaskDeadline: (taskId: string, deadline: number) => void;
  enablePriorityAging: (options: { waitingTimeThreshold: number, boostAmount: number }) => void;
  createTaskGroup: (groupId: string, options: { priority: TaskPriority, maxConcurrent: number }) => void;
  assignTaskToGroup: (taskId: string, groupId: string) => void;
  getRunningTasks: () => string[];
  defineResource: (resourceId: string, capacity: number) => void;
  setTaskResourceRequirements: (taskId: string, requirements: Record<string, number>) => void;
  getResourceAllocations: (resourceId: string) => number;
  getExecutionOrder: () => string[];
  getTaskGroupInfo: (taskId: string) => { groupId: string | undefined };
}

// Shared test variables
let runtime: Runtime;
let extensionSystem: ExtensionSystem;
let eventBus: EventBus;
let prioritizationPlugin: TaskPrioritizationPluginWithHooks;

// Mock current time for testing
const mockNow = new Date('2023-01-01T12:00:00Z').getTime();

// Sample process definition
const testProcessDefinition: ProcessDefinition = {
  id: 'test-process',
  name: 'Test Process',
  description: 'Process for testing task prioritization',
  initialState: 'initial',
  transitions: [
    { from: 'initial', to: 'processing', on: 'START' },
    { from: 'processing', to: 'completed', on: 'COMPLETE' }
  ]
};

// Task definitions for testing different priorities
const createTrackedTaskDefinition = (id: string, executionTime = 10): TaskDefinition => ({
  id,
  name: `${id} Task`,
  description: `A task for testing prioritization`,
  handler: vi.fn().mockImplementation(async (context) => {
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, executionTime));
    
    return { result: `${id} executed` };
  })
});

// Create task definitions with different priorities
const highPriorityTask = createTrackedTaskDefinition('high-priority', 5);
const mediumPriorityTask = createTrackedTaskDefinition('medium-priority', 10);
const lowPriorityTask = createTrackedTaskDefinition('low-priority', 15);

beforeEach(() => {
  // Reset mocks and create fresh instances for each test
  vi.resetAllMocks();
  vi.spyOn(Date, 'now').mockImplementation(() => mockNow);
  
  // Create the extension system and event bus
  extensionSystem = createExtensionSystemInstance();
  eventBus = createEventBusInstance();
  
  // Create the plugin with default options
  prioritizationPlugin = createTaskPrioritizationPluginInstance({
    defaultPriority: TaskPriority.NORMAL,
    defaultPolicy: SchedulingPolicy.PRIORITY,
    maxConcurrentTasks: 2,
    enablePreemption: true
  }) as unknown as TaskPrioritizationPluginWithHooks;
  
  // Register the plugin with the extension system
  extensionSystem.registerExtension(prioritizationPlugin);
  
  // Create runtime with the extension system and task definitions
  const processDefinitions = { 
    [testProcessDefinition.id]: testProcessDefinition 
  };
  
  const taskDefinitions = { 
    [highPriorityTask.id]: highPriorityTask,
    [mediumPriorityTask.id]: mediumPriorityTask,
    [lowPriorityTask.id]: lowPriorityTask
  };
  
  runtime = createRuntime(
    processDefinitions, 
    taskDefinitions, 
    { extensionSystem, eventBus }
  );
});

describe('Task Prioritization Plugin', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  
  describe('Priority-Based Execution', () => {
    it('should execute tasks in priority order when all submitted at once', async () => {
      // Submit tasks with different priorities
      const highPriorityExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { priority: TaskPriority.HIGH }
      });
      const mediumPriorityExecution = await runtime.executeTask(mediumPriorityTask.id, {
        metadata: { priority: TaskPriority.NORMAL }
      });
      const lowPriorityExecution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { priority: TaskPriority.LOW }
      });

      // Should have executed in priority order: high, medium, low
      expect(prioritizationPlugin.getExecutionOrder()).toEqual([
        highPriorityExecution.id,
        mediumPriorityExecution.id,
        lowPriorityExecution.id
      ]);
    });
    
    it('should respect the critical priority level', async () => {
      // Submit high priority task first
      const highPriorityExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { priority: TaskPriority.HIGH }
      });

      // Then submit critical priority task
      const criticalExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { priority: TaskPriority.CRITICAL }
      });

      // Critical task should execute before high priority, even though it was submitted later
      const executionOrder = prioritizationPlugin.getExecutionOrder();
      expect(executionOrder.indexOf(criticalExecution.id)).toBeLessThan(
        executionOrder.indexOf(highPriorityExecution.id)
      );
    });
  });
  
  describe('Scheduling Policies', () => {
    it('should support FIFO scheduling policy', async () => {
      // Set FIFO scheduling policy
      prioritizationPlugin.setSchedulingPolicy(SchedulingPolicy.FIFO);

      // Submit tasks in order: high, medium, low
      const highPriorityExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { priority: TaskPriority.HIGH }
      });
      const mediumPriorityExecution = await runtime.executeTask(mediumPriorityTask.id, {
        metadata: { priority: TaskPriority.NORMAL }
      });
      const lowPriorityExecution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { priority: TaskPriority.LOW }
      });

      // Should execute in submission order
      expect(prioritizationPlugin.getExecutionOrder()).toEqual([
        highPriorityExecution.id,
        mediumPriorityExecution.id,
        lowPriorityExecution.id
      ]);
    });
    
    it('should support SJF scheduling policy', async () => {
      // Set SJF scheduling policy
      prioritizationPlugin.setSchedulingPolicy(SchedulingPolicy.SJF);

      // Submit tasks with different execution times
      const lowPriorityExecution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { executionTime: 10 }
      });
      const highPriorityExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { executionTime: 20 }
      });
      const mediumPriorityExecution = await runtime.executeTask(mediumPriorityTask.id, {
        metadata: { executionTime: 30 }
      });

      // Should execute in order of execution time (shortest first)
      expect(prioritizationPlugin.getExecutionOrder()).toEqual([
        lowPriorityExecution.id,    // Shortest (10ms)
        highPriorityExecution.id,   // Medium (20ms)
        mediumPriorityExecution.id  // Longest (30ms)
      ]);
    });
    
    it('should support deadline-based scheduling policy', async () => {
      // Set deadline-based scheduling policy
      prioritizationPlugin.setSchedulingPolicy(SchedulingPolicy.DEADLINE);

      const now = Date.now();
      const deadlineExecution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { deadline: now + 30 }
      });
      const highPriorityExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { deadline: now + 50 }
      });
      const mediumPriorityExecution = await runtime.executeTask(mediumPriorityTask.id, {
        metadata: { deadline: now + 100 }
      });

      // Should execute in order of deadlines (earliest first)
      expect(prioritizationPlugin.getExecutionOrder()).toEqual([
        deadlineExecution.id,      // Earliest deadline (now + 30ms)
        highPriorityExecution.id,  // Medium deadline (now + 50ms)
        mediumPriorityExecution.id // Latest deadline (now + 100ms)
      ]);
    });
  });
  
  describe('Concurrency Management', () => {
    it('should limit the number of concurrent tasks', async () => {
      // Set max concurrent tasks to 2
      prioritizationPlugin.setMaxConcurrentTasks(2);

      // Submit 3 tasks
      const task1Execution = await runtime.executeTask(highPriorityTask.id, {});
      const task2Execution = await runtime.executeTask(mediumPriorityTask.id, {});
      const task3Execution = await runtime.executeTask(lowPriorityTask.id, {});

      // Only 2 tasks should be executing at a time
      expect(prioritizationPlugin.getExecutionOrder().length).toBe(2);

      // Complete the first task
      await runtime.executeTask(highPriorityTask.id, {});

      // Third task should now be executing
      expect(prioritizationPlugin.getExecutionOrder()).toContain(task3Execution.id);
    });
    
    it('should handle task waiting and resumption', async () => {
      // Set max concurrent tasks to 1
      prioritizationPlugin.setMaxConcurrentTasks(1);

      // Submit low priority task first
      const lowPriorityExecution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { priority: TaskPriority.LOW }
      });

      // Then submit high priority task
      const highPriorityExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { priority: TaskPriority.HIGH }
      });

      // Check execution order
      expect(prioritizationPlugin.getExecutionOrder()).toEqual([lowPriorityExecution.id, highPriorityExecution.id]);

      // Complete all tasks
      await runtime.executeTask(lowPriorityTask.id, {});
      await runtime.executeTask(highPriorityTask.id, {});
    });
  });
  
  describe('Preemption', () => {
    it('should support preemptive scheduling for high priority tasks', async () => {
      // Enable preemption
      prioritizationPlugin.enablePreemption(true);

      // Submit long-running low priority task
      const longLowPriorityExecution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { 
          priority: TaskPriority.LOW,
          executionTime: 1000,
          preemptible: true
        }
      });

      // Submit high priority task
      const highPriorityExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { priority: TaskPriority.HIGH }
      });

      // High priority task should preempt low priority task
      const executionOrder = prioritizationPlugin.getExecutionOrder();
      expect(executionOrder).toContain(longLowPriorityExecution.id);
      expect(executionOrder).toContain(highPriorityExecution.id);
      expect(executionOrder.indexOf(highPriorityExecution.id)).toBeLessThan(
        executionOrder.indexOf(longLowPriorityExecution.id)
      );
    });
    
    it('should only preempt tasks with significantly lower priority', async () => {
      // Enable preemption
      prioritizationPlugin.enablePreemption(true);

      // Submit high priority task
      const highPriorityExecution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { 
          priority: TaskPriority.HIGH,
          executionTime: 1000,
          preemptible: true
        }
      });

      // Submit medium priority task
      const mediumPriorityExecution = await runtime.executeTask(mediumPriorityTask.id, {
        metadata: { priority: TaskPriority.NORMAL }
      });

      // Medium should not interrupt anything
      const executionOrder = prioritizationPlugin.getExecutionOrder();
      expect(executionOrder.indexOf(mediumPriorityExecution.id)).toBeGreaterThan(
        executionOrder.indexOf(highPriorityExecution.id)
      );
    });
  });
  
  describe('Dynamic Priority Adjustment', () => {
    it('should support dynamic priority boosting', async () => {
      // Enable priority aging
      prioritizationPlugin.enablePriorityAging({
        waitingTimeThreshold: 100,
        boostAmount: 1
      });

      // Submit low priority task that will be boosted
      const lowPriorityExecution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { priority: TaskPriority.LOW }
      });

      // Wait for priority boost
      await new Promise(resolve => setTimeout(resolve, 150));

      // Submit medium priority task
      const mediumPriorityExecution = await runtime.executeTask(mediumPriorityTask.id, {
        metadata: { priority: TaskPriority.NORMAL }
      });

      // Low priority should execute first because it was already running
      const executionOrder = prioritizationPlugin.getExecutionOrder();
      expect(executionOrder[0]).toBe(lowPriorityExecution.id);
      expect(executionOrder[1]).toBe(mediumPriorityExecution.id);
    });
  });
  
  describe('Task Grouping and Affinity', () => {
    it('should support task group scheduling', async () => {
      // Create database task group with concurrency limit
      prioritizationPlugin.createTaskGroup('database', {
        priority: TaskPriority.HIGH,
        maxConcurrent: 1
      });

      // Submit multiple database tasks
      const dbTask1Execution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { groupId: 'database' }
      });
      const dbTask2Execution = await runtime.executeTask(mediumPriorityTask.id, {
        metadata: { groupId: 'database' }
      });
      const cpuTask1Execution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { groupId: 'cpu' }
      });

      // Two tasks should be running, but only one database task
      const runningTasks = prioritizationPlugin.getRunningTasks();
      expect(runningTasks.length).toBeGreaterThanOrEqual(2);

      const runningDbTasks = runningTasks.filter(taskId => 
        prioritizationPlugin.getTaskGroupInfo(taskId).groupId === 'database'
      );
      expect(runningDbTasks.length).toBe(1);
    });
    
    it('should support resource affinity scheduling', async () => {
      // Define resource capacities
      prioritizationPlugin.defineResource('cpu', 2);
      prioritizationPlugin.defineResource('memory', 1);

      // Submit tasks with resource requirements
      const cpuTask1Execution = await runtime.executeTask(highPriorityTask.id, {
        metadata: { resourceAffinity: ['cpu'] }
      });
      const cpuTask2Execution = await runtime.executeTask(mediumPriorityTask.id, {
        metadata: { resourceAffinity: ['cpu'] }
      });
      const memoryTaskExecution = await runtime.executeTask(lowPriorityTask.id, {
        metadata: { resourceAffinity: ['memory'] }
      });

      // Should have 3 running tasks (2 CPU and 1 memory)
      const runningTasks = prioritizationPlugin.getRunningTasks();
      expect(runningTasks.length).toBe(3);

      // Wait for all tasks to complete
      await Promise.all([
        runtime.executeTask(highPriorityTask.id, {}),
        runtime.executeTask(mediumPriorityTask.id, {}),
        runtime.executeTask(lowPriorityTask.id, {})
      ]);
    });
  });
}); 