import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime, TaskExecution, TaskContext, TaskDefinition, InMemoryExtensionSystem, InMemoryEventStorage } from '../src/index';
import { InMemoryEventBus } from '../src/implementations/event-bus-impl';
import { RuntimeInstance } from '../src/implementations/runtime';
import { SimplePluginRegistry } from '../src/implementations/plugin-registry';
import { InMemoryTaskRegistry } from '../src/implementations/task-registry';
import { InMemoryTaskExecutor } from '../src/implementations/task-executor';
import { SimpleTaskScheduler } from '../src/implementations/task-scheduler';
import { SimpleProcessRegistry } from '../src/implementations/process-registry';
import { SimpleProcessManager } from '../src/implementations/process-manager';
import { Result } from '../src/models/core-types';
import { EventBus } from '../src/models/event-system';

describe('Task Dependencies and Sequencing', () => {
  let runtime: RuntimeInstance;
  let extensionSystem: InMemoryExtensionSystem;
  let eventBus: EventBus;
  let eventStorage: InMemoryEventStorage;
  const executionOrder: string[] = [];
  
  // Define tasks with dependencies
  const task1: TaskDefinition = {
    id: 'task1',
    name: 'Task 1',
    description: 'First task in sequence',
    handler: async (context: TaskContext) => {
      executionOrder.push('task1');
      return { success: true, value: { result: 'task1-result' } };
    }
  };
  
  const task2: TaskDefinition = {
    id: 'task2',
    name: 'Task 2',
    description: 'Second task in sequence',
    handler: async (context: TaskContext) => {
      executionOrder.push('task2');
      return { success: true, value: { result: 'task2-result' } };
    },
    dependencies: ['task1']
  };
  
  const task3: TaskDefinition = {
    id: 'task3',
    name: 'Task 3',
    description: 'Third task in sequence',
    handler: async (context: TaskContext) => {
      executionOrder.push('task3');
      return { success: true, value: { result: 'task3-result' } };
    },
    dependencies: ['task1', 'task2']
  };
  
  const longRunningTask: TaskDefinition = {
    id: 'long-running',
    name: 'Long Running Task',
    description: 'A task that takes a long time to complete',
    handler: async () => {
      return new Promise<Result<any>>(resolve => {
        setTimeout(() => {
          resolve({ success: true, value: { result: 'long-running-result' } });
        }, 1000);
      });
    }
  };
  
  const failingTask: TaskDefinition = {
    id: 'failing-task',
    name: 'Failing Task',
    description: 'A task that fails',
    handler: async () => {
      executionOrder.push('failing-task');
      return { success: false, error: new Error('Task failed') };
    }
  };

  beforeEach(() => {
    executionOrder.length = 0;
    extensionSystem = new InMemoryExtensionSystem();
    eventBus = new InMemoryEventBus();
    eventStorage = new InMemoryEventStorage();
    
    // Create task registry and register tasks
    const taskRegistry = new InMemoryTaskRegistry();
    taskRegistry.registerTask(task1);
    taskRegistry.registerTask(task2);
    taskRegistry.registerTask(task3);
    taskRegistry.registerTask(longRunningTask);
    
    // Create task executor with dependencies
    const taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus);
    const taskScheduler = new SimpleTaskScheduler(taskExecutor);
    
    // Create process registry and manager
    const processRegistry = new SimpleProcessRegistry();
    const processManager = new SimpleProcessManager(processRegistry, taskExecutor);
    
    // Create runtime instance
    runtime = new RuntimeInstance({
      eventBus,
      extensionSystem,
      pluginRegistry: new SimplePluginRegistry(),
      taskRegistry,
      taskExecutor,
      taskScheduler,
      processRegistry,
      processManager,
      eventStorage
    });
  });

  describe('Task Sequencing', () => {
    it('should execute dependent tasks in the correct order', async () => {
      // Execute tasks in reverse order to ensure dependencies are respected
      const task3Result = await runtime.executeTaskWithDependencies('task3', {}, ['task1', 'task2']);
      
      // Check execution order
      expect(executionOrder).toEqual(['task1', 'task2', 'task3']);
      expect(task3Result.success).toBe(true);
      if (task3Result.success) {
        expect(task3Result.value).toBeDefined();
      }
    });

    it('should pass results from previous tasks to dependent tasks', async () => {
      // Execute task with dependencies
      const result = await runtime.executeTaskWithDependencies('task3', {}, ['task1', 'task2']);
      
      // Task3 should have received the results from task1 and task2
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeDefined();
        expect(result.value.previousResults).toBeDefined();
        expect(result.value.previousResults).toHaveProperty('task1');
        expect(result.value.previousResults).toHaveProperty('task2');
      }
    });

    it('should handle failures in dependency chain', async () => {
      // Try to execute a task that depends on a failing task
      const result = await runtime.executeTaskWithDependencies(
        'dependent-on-failing', 
        {}, 
        ['failing-task']
      );
      
      // Check that only the failing task executed, not the dependent task
      expect(executionOrder).toEqual(['failing-task']);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Task failed');
      }
    });
  });

  describe('Parallel Execution', () => {
    it('should execute independent tasks in parallel', async () => {
      // Execute a task dependent on both independent tasks
      const result = await runtime.executeTaskWithDependencies(
        'collector', 
        {}, 
        ['independent1', 'independent2']
      );
      
      // Faster task should complete first
      expect(executionOrder[0]).toBe('independent2');
      expect(executionOrder[1]).toBe('independent1');
      expect(executionOrder[2]).toBe('collector');
      
      // Should have collected all results
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeDefined();
        expect(result.value.independentResults).toHaveProperty('independent1');
        expect(result.value.independentResults).toHaveProperty('independent2');
      }
    });
  });

  describe('Task Scheduling', () => {
    it('should schedule tasks for future execution', async () => {
      const handler = vi.fn();
      eventBus.subscribe('task:completed', handler);
      
      // Schedule a task to run in 25ms
      const scheduledTime = Date.now() + 25;
      const taskId = await runtime.taskScheduler.scheduleTask('task1', {}, scheduledTime);
      
      // Verify task was scheduled but not executed immediately
      expect(taskId).toBeDefined();
      expect(executionOrder.length).toBe(0);
      
      // Wait for task to execute
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify task executed
      expect(executionOrder).toEqual(['task1']);
      expect(handler).toHaveBeenCalled();
    });

    it('should execute tasks immediately if scheduled time is in the past', async () => {
      // Schedule for the past
      const pastTime = Date.now() - 1000;
      await runtime.taskScheduler.scheduleTask('task1', {}, pastTime);
      
      // Should execute immediately
      expect(executionOrder).toEqual(['task1']);
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel a running task', async () => {
      // Create a task that will be cancelled
      const task = await runtime.executeTask('cancellable', {});
      
      // Cancel the task
      if (task.success) {
        await runtime.taskExecutor.cancelTask(task.value.id);
      }
      
      // Verify task was cancelled
      expect(executionOrder).toEqual(['cancellable-cancelled']);
    });
  });

  describe('Task Metrics', () => {
    it('should track task execution metrics', async () => {
      // Execute a task
      await runtime.executeTask('task1', {});
      
      // Get metrics
      const metricsResult = await runtime.getMetrics();
      
      // Verify metrics
      expect(metricsResult.success).toBe(true);
      if (metricsResult.success) {
        const metrics = metricsResult.value;
        expect(metrics.tasks.total).toBeGreaterThan(0);
        expect(metrics.tasks.completed).toBeGreaterThan(0);
      }
    });
  });
}); 