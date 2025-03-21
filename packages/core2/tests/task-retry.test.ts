import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime, TaskExecution, TaskContext, TaskDefinition, TaskRetryPolicy, ReactiveRuntime, ExtensionSystemImpl, EventBusImpl, InMemoryEventStorage } from '../src/index.js';

describe('Task Retry and Error Handling', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBusImpl;
  let eventStorage: InMemoryEventStorage;
  let taskExecutionCount: number;
  
  // Sample definitions for testing
  const taskWithRetryPolicy: TaskDefinition = {
    id: 'retry-task',
    name: 'Task with Retry',
    description: 'A task that will be retried upon failure',
    handler: async (context: TaskContext) => {
      taskExecutionCount++;
      if (taskExecutionCount <= 2) {
        throw new Error('Temporary failure');
      }
      return { result: 'success', attempts: taskExecutionCount };
    },
    retry: {
      maxAttempts: 3,
      backoffStrategy: 'linear',
      backoffDelay: 10, // Use small delay for tests
      retryableErrors: ['Error']
    }
  };

  const taskWithoutRetryPolicy: TaskDefinition = {
    id: 'no-retry-task',
    name: 'Task without Retry',
    description: 'A task that will not be retried upon failure',
    handler: async (context: TaskContext) => {
      throw new Error('Fatal failure');
    }
  };

  const taskWithErrorFilter: TaskDefinition = {
    id: 'error-filter-task',
    name: 'Task with Error Filter',
    description: 'A task that only retries specific errors',
    handler: async (context: TaskContext) => {
      if (context.attemptNumber === 1) {
        throw new Error('RetryableError');
      } else if (context.attemptNumber === 2) {
        throw new Error('NonRetryableError');
      }
      return { result: 'success' };
    },
    retry: {
      maxAttempts: 3,
      backoffStrategy: 'linear',
      backoffDelay: 10,
      retryableErrors: ['RetryableError']
    }
  };

  beforeEach(() => {
    taskExecutionCount = 0;
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    eventStorage = new InMemoryEventStorage();
    
    runtime = new ReactiveRuntime({}, {
      [taskWithRetryPolicy.id]: taskWithRetryPolicy,
      [taskWithoutRetryPolicy.id]: taskWithoutRetryPolicy,
      [taskWithErrorFilter.id]: taskWithErrorFilter
    }, {
      extensionSystem,
      eventBus,
      eventStorage
    });
  });

  describe('Task Retry Behavior', () => {
    it('should retry a task up to the configured maximum attempts', async () => {
      const execution = await runtime.executeTask('retry-task', {});
      
      expect(execution.status).toBe('completed');
      expect(execution.result).toEqual({ result: 'success', attempts: 3 });
      expect(execution.attempts).toBe(3);
      expect(taskExecutionCount).toBe(3);
    });

    it('should not retry a task that does not have a retry policy', async () => {
      await expect(runtime.executeTask('no-retry-task', {}))
        .rejects.toThrow('Fatal failure');
    });

    it('should only retry for specified error types', async () => {
      await expect(runtime.executeTask('error-filter-task', {}))
        .rejects.toThrow('NonRetryableError');
    });

    it('should emit events for task retry attempts', async () => {
      const retryAttemptHandler = vi.fn();
      runtime.subscribe('task:retryAttempt', retryAttemptHandler);
      
      await runtime.executeTask('retry-task', {});
      
      expect(retryAttemptHandler).toHaveBeenCalledTimes(2);
      expect(retryAttemptHandler.mock.calls[0][0].payload.attemptNumber).toBe(1);
      expect(retryAttemptHandler.mock.calls[1][0].payload.attemptNumber).toBe(2);
    });
  });

  describe('Task Cancellation', () => {
    it('should allow cancelling a running task', async () => {
      // Create a long-running task with a delay
      const longRunningTask: TaskDefinition = {
        id: 'long-running-task',
        name: 'Long Running Task',
        description: 'A task that runs for a long time',
        handler: async (context: TaskContext) => {
          // This will create a promise that can be cancelled
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              resolve({ result: 'completed' });
            }, 1000); // 1 second
            
            // Store the timeout ID so it can be cleared if cancelled
            context.cancellationToken?.onCancel(() => {
              clearTimeout(timeoutId);
              reject(new Error('Task was cancelled'));
            });
          });
        }
      };
      
      // Add the task definition
      const task = await runtime.executeTask('long-running-task', {});
      
      // Cancel the task after a short delay
      setTimeout(() => {
        runtime.cancelTask(task.id);
      }, 10);
      
      // Check that the task was cancelled
      await expect(runtime.executeTask('long-running-task', {})).rejects.toThrow('Task was cancelled');
    });
  });

  describe('Task Metrics', () => {
    it('should track retry attempts in metrics', async () => {
      // Execute a task that will be retried
      await runtime.executeTask('retry-task', {});
      
      // Get metrics
      const metrics = await runtime.getTaskMetrics();
      
      // Verify metrics
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      const retryMetrics = metrics.find(m => m.taskId === 'retry-task');
      expect(retryMetrics).toBeDefined();
      expect(retryMetrics?.retryCount).toBe(2);
    });
  });
}); 