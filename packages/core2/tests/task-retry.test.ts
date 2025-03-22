import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { TaskExecution, TaskContext, TaskDefinition, TaskRetryPolicy } from '../src/models/task-system';
import { EventBus } from '../src/models/event-system';
import { ExtensionSystem } from '../src/models/extension-system';
import { InMemoryEventStorage } from '../src/implementations/event-storage-impl';
import { createModernRuntime } from '../src/implementations/modern-factory';

describe('Task Retry and Error Handling', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystem;
  let eventBus: EventBus;
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
      initialDelay: 10, // Use small delay for tests
      maxDelay: 100,
      retryableErrorTypes: ['Error']
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
      initialDelay: 10,
      maxDelay: 100,
      retryableErrorTypes: ['RetryableError']
    }
  };

  beforeEach(async () => {
    taskExecutionCount = 0;
    
    runtime = createModernRuntime({
      persistEvents: true,
      runtimeOptions: {
        version: '1.0.0',
        namespace: 'test'
      }
    });

    // Register task definitions
    await runtime.taskRegistry.registerTask(taskWithRetryPolicy);
    await runtime.taskRegistry.registerTask(taskWithoutRetryPolicy);
    await runtime.taskRegistry.registerTask(taskWithErrorFilter);

    // Initialize and start the runtime
    await runtime.initialize({
      version: '1.0.0',
      namespace: 'test'
    });
    await runtime.start();
  });

  describe('Task Retry Behavior', () => {
    it('should retry a task up to the configured maximum attempts', async () => {
      const result = await runtime.executeTask('retry-task', {});
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.result).toEqual({ result: 'success', attempts: 3 });
        expect(result.value.attemptNumber).toBe(3);
        expect(taskExecutionCount).toBe(3);
      }
    });

    it('should not retry a task that does not have a retry policy', async () => {
      const result = await runtime.executeTask('no-retry-task', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Fatal failure');
      }
    });

    it('should only retry for specified error types', async () => {
      const result = await runtime.executeTask('error-filter-task', {});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('NonRetryableError');
      }
    });

    it('should emit events for task retry attempts', async () => {
      const retryAttemptHandler = vi.fn();
      runtime.eventBus.subscribe('task:retryAttempt', retryAttemptHandler);
      
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
            if (context.cancellationToken) {
              context.cancellationToken.onCancellationRequested(() => {
                clearTimeout(timeoutId);
                reject(new Error('Task was cancelled'));
              });
            }
          });
        }
      };
      
      // Add the task definition
      await runtime.taskRegistry.registerTask(longRunningTask);
      
      // Start the task
      const taskResult = await runtime.executeTask('long-running-task', {});
      
      // Cancel the task after a short delay
      setTimeout(() => {
        if (taskResult.success) {
          runtime.taskExecutor.cancelTask(taskResult.value.id);
        }
      }, 10);
      
      // Check that the task was cancelled
      const result = await taskResult;
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Task was cancelled');
      }
    });
  });

  describe('Task Metrics', () => {
    it('should track retry attempts in metrics', async () => {
      // Execute a task that will be retried
      await runtime.executeTask('retry-task', {});
      
      // Get metrics
      const metricsResult = await runtime.getMetrics();
      
      // Verify metrics
      expect(metricsResult.success).toBe(true);
      if (metricsResult.success) {
        const metrics = metricsResult.value;
        expect(metrics.tasks.total).toBeGreaterThan(0);
        expect(metrics.tasks.failed).toBe(2); // Two failed attempts before success
        expect(metrics.tasks.completed).toBe(1); // One successful completion
      }
    });
  });
}); 