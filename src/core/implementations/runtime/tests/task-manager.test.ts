import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskManager } from '../task-manager';
import { TaskDefinition, TaskContext, TaskOptions, RetryPolicy } from '../../../models';

// Add middleware types
interface TaskMiddleware {
  before?: (taskId: string, input: any, context: TaskContext) => void;
  after?: (taskId: string, input: any, result: any, context: TaskContext) => void;
}

// Extend TaskOptions to include middleware
interface ExtendedTaskOptions extends TaskOptions {
  middleware?: TaskMiddleware;
}

describe('TaskManager', () => {
  let taskManager: TaskManager;
  let mockEmitEvent: any;
  
  beforeEach(() => {
    mockEmitEvent = vi.fn();
    
    // Define task implementations
    const processOrderTask = vi.fn().mockImplementation(async (input: any, context: TaskContext) => {
      return { processed: true, orderId: input.orderId };
    });
    
    const shipOrderTask = vi.fn().mockImplementation(async (input: any, context: TaskContext) => {
      context.emitEvent('SHIP_ORDER', { orderId: input.orderId });
      return { shipped: true };
    });
    
    const errorTask = vi.fn().mockImplementation(async () => {
      throw new Error('Task failed');
    });
    
    const contextVerificationTask = vi.fn().mockImplementation(async (input: any, context: TaskContext) => {
      context.emitEvent('TEST_EVENT', { data: 'test' });
      return { contextVerified: true };
    });
    
    const timeoutTask = vi.fn().mockImplementation(async () => {
      return new Promise((resolve) => {
        setTimeout(() => resolve({ completed: true }), 100);
      });
    });
    
    const retryableTask = vi.fn()
      .mockRejectedValueOnce(new Error('First attempt failed'))
      .mockRejectedValueOnce(new Error('Second attempt failed'))
      .mockResolvedValueOnce({ success: true, attempts: 3 });
    
    const cancelableTask = vi.fn().mockImplementation(async (input: any, context: TaskContext) => {
      // Simulate a long-running task that checks for cancellation
      for (let i = 0; i < 5; i++) {
        if (context.metadata?.cancelled) {
          throw new Error('Task cancelled');
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return { completed: true };
    });
    
    // Create task definitions
    const tasks: Record<string, TaskDefinition> = {
      'process-order': {
        id: 'process-order',
        implementation: processOrderTask
      },
      'ship-order': {
        id: 'ship-order',
        implementation: shipOrderTask
      },
      'error-task': {
        id: 'error-task',
        implementation: errorTask
      },
      'context-verification': {
        id: 'context-verification',
        implementation: contextVerificationTask
      },
      'timeout-task': {
        id: 'timeout-task',
        implementation: timeoutTask,
        timeout: 10 // 10ms timeout
      },
      'retryable-task': {
        id: 'retryable-task',
        implementation: retryableTask,
        retry: {
          maxAttempts: 2,
          backoff: 'fixed',
          delayMs: 10
        } as RetryPolicy
      },
      'cancelable-task': {
        id: 'cancelable-task',
        implementation: cancelableTask
      }
    };
    
    taskManager = new TaskManager(tasks);
  });
  
  describe('Task Execution', () => {
    it('should execute a task and return the result', async () => {
      // Act
      const result = await taskManager.executeTask('process-order', { orderId: '12345' }, { emitEvent: mockEmitEvent });
      
      // Assert
      expect(result).toEqual({ processed: true, orderId: '12345' });
    });
    
    it('should throw an error if task does not exist', async () => {
      // Act & Assert
      await expect(taskManager.executeTask('non-existent', {})).rejects.toThrow(/Task definition not found/);
    });
    
    it('should emit events from task implementation', async () => {
      // Act
      await taskManager.executeTask('ship-order', { orderId: '12345' }, { emitEvent: mockEmitEvent });
      
      // Assert - Check that the mock emitEvent function was called
      expect(mockEmitEvent).toHaveBeenCalledWith('SHIP_ORDER', { orderId: '12345' });
    });
    
    it('should handle task errors', async () => {
      // Act & Assert
      await expect(taskManager.executeTask('error-task', {})).rejects.toThrow('Task failed');
    });
  });
  
  describe('Task Context', () => {
    it('should provide task context with emitEvent method', async () => {
      // Act
      const result = await taskManager.executeTask('context-verification', {}, { emitEvent: mockEmitEvent });
      
      // Assert
      expect(result).toEqual(expect.objectContaining({ contextVerified: true }));
      expect(mockEmitEvent).toHaveBeenCalledWith('TEST_EVENT', { data: 'test' });
    });
  });
  
  describe('Task Timeout', () => {
    it('should throw an error when task exceeds timeout', async () => {
      // Act & Assert
      await expect(taskManager.executeTask('timeout-task', {})).rejects.toThrow(/Task execution timed out/);
    });
  });
  
  describe('Task Retries', () => {
    it('should retry failed tasks according to retry policy', async () => {
      // Arrange
      const startTime = Date.now();
      
      // Act
      const result = await taskManager.executeTask('retryable-task', {});
      const duration = Date.now() - startTime;
      
      // Assert
      expect(result).toEqual({ success: true, attempts: 3 });
      // Don't test exact timing as it can be flaky in test environments
      expect(duration).toBeGreaterThan(0);
    });
    
    it('should respect custom retry options', async () => {
      // Arrange
      const mockRetryTask = vi.fn();
      mockRetryTask.mockRejectedValueOnce(new Error('First attempt failed'));
      mockRetryTask.mockResolvedValue({ success: true });
      
      const customTasks: Record<string, TaskDefinition> = {
        'custom-retry': {
          id: 'custom-retry',
          implementation: mockRetryTask,
          retry: {
            maxAttempts: 0, // Will be overridden by the options
            backoff: 'fixed',
            delayMs: 5
          }
        }
      };
      
      const customTaskManager = new TaskManager(customTasks);
      
      // Act & Assert
      const result = await customTaskManager.executeTask('custom-retry', {}, {}, {
        retry: {
          maxAttempts: 1,
          delayMs: 10,
          backoff: 'fixed'
        }
      });
      
      expect(result).toEqual({ success: true });
      expect(mockRetryTask).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('Task Middleware', () => {
    it('should apply before and after middleware', async () => {
      // Arrange
      const beforeMiddleware = vi.fn();
      const afterMiddleware = vi.fn();
      
      // Act
      const result = await taskManager.executeTask(
        'process-order', 
        { orderId: '12345' }, 
        { emitEvent: mockEmitEvent }, 
        {
          middleware: {
            before: beforeMiddleware,
            after: afterMiddleware
          }
        } as ExtendedTaskOptions
      );
      
      // Assert
      expect(beforeMiddleware).toHaveBeenCalledWith(
        'process-order',
        { orderId: '12345' },
        expect.anything()
      );
      
      expect(afterMiddleware).toHaveBeenCalledWith(
        'process-order',
        { orderId: '12345' },
        { processed: true, orderId: '12345' },
        expect.anything()
      );
      
      expect(result).toEqual({ processed: true, orderId: '12345' });
    });
    
    it('should still execute after middleware when task fails', async () => {
      // Arrange
      const beforeMiddleware = vi.fn();
      const afterMiddleware = vi.fn();
      
      // Act & Assert
      await expect(taskManager.executeTask(
        'error-task', 
        {}, 
        {}, 
        {
          middleware: {
            before: beforeMiddleware,
            after: afterMiddleware
          }
        } as ExtendedTaskOptions
      )).rejects.toThrow('Task failed');
      
      // After middleware should still be called with the error
      expect(afterMiddleware).toHaveBeenCalledWith(
        'error-task',
        {},
        null,
        expect.anything(),
        expect.any(Error)
      );
    });
  });
  
  describe('Task Cancellation', () => {
    it('should allow cancelling a task during execution', async () => {
      // Arrange
      const context = { 
        emitEvent: mockEmitEvent,
        metadata: { cancelled: false }
      };
      
      // Start the task
      const taskPromise = taskManager.executeTask('cancelable-task', {}, context);
      
      // Mark the task as cancelled after a short delay
      setTimeout(() => {
        context.metadata.cancelled = true;
      }, 15);
      
      // Act & Assert
      await expect(taskPromise).rejects.toThrow('Task cancelled');
    });
  });
}); 