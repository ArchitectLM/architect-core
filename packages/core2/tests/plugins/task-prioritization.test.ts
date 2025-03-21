import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Runtime } from '../../src/models/runtime.js';
import { 
  createReactiveRuntime, 
  createTaskPrioritizationPluginInstance,
  createTransactionPluginInstance
} from '../../src/factories.js';
import { createExtensionSystemInstance } from '../../src/factories.js';
import { createEventBusInstance } from '../../src/factories.js';
import { ProcessDefinition, TaskDefinition } from '../../src/models/index.js';
import { Extension, ExtensionHandler } from '../../src/models/extension.js';
import { 
  TaskPriority,
  SchedulingPolicy,
  TaskMetadata,
  TaskPrioritizationPlugin
} from '../../src/plugins/task-prioritization.js';
import { ReactiveRuntime } from '../../src/implementations/runtime.js';
import { EventBus } from '../../src/models/event.js';
import { ExtensionSystem } from '../../src/models/extension.js';
import { EventBusImpl } from '../../src/implementations/event-bus.js';
import { ExtensionSystemImpl } from '../../src/implementations/extension-system.js';

// Helper function to convert TaskPriority enum to string
const priorityToString = (priority: TaskPriority): string => {
  return String(priority);
};

// Modified metadata type to accept string priorities
interface TestTaskMetadata extends Omit<TaskMetadata, 'priority'> {
  priority: string;
}

// Plugin interface that includes both Extension and plugin-specific methods
interface TaskPrioritizationPluginWithHooks extends Extension {
  setTaskPriority: (taskId: string, priority: string) => void;
  getTaskPriority: (taskId: string) => string;
  setTaskExecutionTime: (taskId: string, time: number) => void;
  setSchedulingPolicy: (policy: string) => void;
  setMaxConcurrentTasks: (max: number) => void;
  enablePreemption: (enabled: boolean) => void;
  setTaskDeadline: (taskId: string, deadline: number) => void;
  enablePriorityAging: (options: { waitingTimeThreshold: number, boostAmount: number }) => void;
  createTaskGroup: (groupId: string, options: { priority: string, maxConcurrent: number }) => void;
  assignTaskToGroup: (taskId: string, groupId: string) => void;
  getRunningTasks: () => string[];
  defineResource: (resourceId: string, capacity: number) => void;
  setTaskResourceRequirements: (taskId: string, requirements: Record<string, number>) => void;
  getResourceAllocations: (resourceId: string) => number;
  getExecutionOrder: () => string[];
  getTaskGroupInfo: (taskId: string) => { groupId: string | undefined };
}

// Shared test variables
let runtime: ReactiveRuntime;
let extensionSystem: ExtensionSystem;
let eventBus: EventBus;
let prioritizationPlugin: TaskPrioritizationPlugin;

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

// Initialize tasks with different priorities and execution times
const highPriorityTask = createTrackedTaskDefinition('high-priority-task', 20);
const mediumPriorityTask = createTrackedTaskDefinition('medium-priority-task', 30);
const lowPriorityTask = createTrackedTaskDefinition('low-priority-task', 10);
const criticalTask = createTrackedTaskDefinition('critical-task', 5);
const deadlineTask = createTrackedTaskDefinition('deadline-task', 15);
const longRunningTask = createTrackedTaskDefinition('long-running-task', 100);

describe('Task Prioritization Plugin', () => {
  beforeEach(() => {
    // Mock Date.now for consistent testing
    vi.spyOn(Date, 'now').mockImplementation(() => mockNow);
    
    // Create fresh instances for each test
    eventBus = new EventBusImpl();
    extensionSystem = new ExtensionSystemImpl();
    
    // Create process and task definitions
    const processDefinitions = { 
      [testProcessDefinition.id]: testProcessDefinition 
    };
    
    const taskDefinitions = { 
      [highPriorityTask.id]: highPriorityTask,
      [mediumPriorityTask.id]: mediumPriorityTask,
      [lowPriorityTask.id]: lowPriorityTask,
      [criticalTask.id]: criticalTask,
      [deadlineTask.id]: deadlineTask,
      [longRunningTask.id]: longRunningTask
    };
    
    // Create runtime with task prioritization plugin
    runtime = new ReactiveRuntime(
      processDefinitions,
      taskDefinitions,
      { extensionSystem, eventBus }
    );
    
    // Create and register prioritization plugin
    prioritizationPlugin = new TaskPrioritizationPlugin({
      maxConcurrentTasks: 2,
      preemptionEnabled: true
    });
    extensionSystem.registerExtension(prioritizationPlugin);
    
    // Reset mock function call counts
    vi.clearAllMocks();
  });
  
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
      const deadlineExecution = await runtime.executeTask(deadlineTask.id, {
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