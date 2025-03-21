import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime, TaskExecution, TaskContext, TaskDefinition, ReactiveRuntime, ExtensionSystemImpl, EventBusImpl, InMemoryEventStorage } from '../src/index.js';

describe('Task Dependencies and Sequencing', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBusImpl;
  let eventStorage: InMemoryEventStorage;
  const executionOrder: string[] = [];
  
  // Define tasks with dependencies
  const task1: TaskDefinition = {
    id: 'task1',
    name: 'Task 1',
    description: 'First task in sequence',
    handler: async (context: TaskContext) => {
      executionOrder.push('task1');
      return { result: 'task1-result' };
    }
  };
  
  const task2: TaskDefinition = {
    id: 'task2',
    name: 'Task 2',
    description: 'Second task in sequence',
    handler: async (context: TaskContext) => {
      executionOrder.push('task2');
      return { result: 'task2-result', previousResult: context.previousResult };
    },
    dependencies: ['task1']
  };
  
  const task3: TaskDefinition = {
    id: 'task3',
    name: 'Task 3',
    description: 'Third task in sequence',
    handler: async (context: TaskContext) => {
      executionOrder.push('task3');
      return { result: 'task3-result', previousResults: context.previousResults };
    },
    dependencies: ['task1', 'task2']
  };
  
  const longRunningTask: TaskDefinition = {
    id: 'long-running',
    name: 'Long Running Task',
    description: 'A task that takes a long time to complete',
    handler: async () => {
      return new Promise(resolve => {
        setTimeout(() => {
          executionOrder.push('long-running');
          resolve({ result: 'long-running-result' });
        }, 50);
      });
    }
  };
  
  const failingTask: TaskDefinition = {
    id: 'failing-task',
    name: 'Failing Task',
    description: 'A task that fails',
    handler: async () => {
      executionOrder.push('failing-task');
      throw new Error('Task failed');
    }
  };

  beforeEach(() => {
    executionOrder.length = 0;
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    eventStorage = new InMemoryEventStorage();
    
    runtime = new ReactiveRuntime({}, {
      [task1.id]: task1,
      [task2.id]: task2,
      [task3.id]: task3
    }, {
      extensionSystem,
      eventBus,
      eventStorage
    });
  });

  describe('Task Sequencing', () => {
    it('should execute dependent tasks in the correct order', async () => {
      // Execute tasks in reverse order to ensure dependencies are respected
      const task3Result = await runtime.executeTaskWithDependencies('task3', {}, ['task1', 'task2']);
      
      // Check execution order
      expect(executionOrder).toEqual(['task1', 'task2', 'task3']);
      expect(task3Result.status).toBe('completed');
    });

    it('should pass results from previous tasks to dependent tasks', async () => {
      // Execute task with dependencies
      const result = await runtime.executeTaskWithDependencies('task3', {}, ['task1', 'task2']);
      
      // Task3 should have received the results from task1 and task2
      expect(result.result.previousResults).toBeDefined();
      expect(result.result.previousResults).toHaveProperty('task1');
      expect(result.result.previousResults).toHaveProperty('task2');
    });

    it('should handle failures in dependency chain', async () => {
      // Try to execute a task that depends on a failing task
      await expect(runtime.executeTaskWithDependencies(
        'dependent-on-failing', 
        {}, 
        ['failing-task']
      )).rejects.toThrow('Task failed');
      
      // Check that only the failing task executed, not the dependent task
      expect(executionOrder).toEqual(['failing-task']);
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
      expect(result.result.independentResults).toHaveProperty('independent1');
      expect(result.result.independentResults).toHaveProperty('independent2');
    });
  });

  describe('Task Scheduling', () => {
    it('should schedule tasks for future execution', async () => {
      const handler = vi.fn();
      runtime.subscribe('task:completed', handler);
      
      // Schedule a task to run in 25ms
      const scheduledTime = Date.now() + 25;
      const taskId = await runtime.scheduleTask('task1', {}, scheduledTime);
      
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
      await runtime.scheduleTask('task1', {}, pastTime);
      
      // Should execute immediately
      expect(executionOrder).toEqual(['task1']);
    });
  });

  describe('Task Cancellation', () => {
    it('should cancel a running task', async () => {
      // Create a task that will be cancelled
      const task = await runtime.executeTask('cancellable', {});
      
      // Cancel the task
      await runtime.cancelTask(task.id);
      
      // Verify task was cancelled
      expect(executionOrder).toEqual(['cancellable-cancelled']);
    });
  });

  describe('Task Metrics', () => {
    it('should track task execution metrics', async () => {
      // Execute a task
      await runtime.executeTask('task1', {});
      
      // Get metrics
      const metrics = await runtime.getTaskMetrics();
      
      // Verify metrics
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.taskId === 'task1')).toBe(true);
    });
  });
}); 