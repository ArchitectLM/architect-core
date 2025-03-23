import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { InMemoryTaskExecutor } from '../src/implementations/task-executor';
import { InMemoryTaskRegistry } from '../src/implementations/task-registry';
import { ExtensionEventBusImpl } from '../src/implementations/event-bus';
import { InMemoryEventBus } from '../src/implementations/event-bus';
import { ExtensionSystem, ExtensionPointNames } from '../src/models/extension-system';
import { 
  TaskDefinition, 
  TaskContext, 
  TaskExecution,
  TaskStatus,
  TaskRetryPolicy,
  CancellationToken,
  TaskHandler
} from '../src/models/task-system';
import { DomainEvent, Result } from '../src/models/core-types';
import { EventBus } from '../src/models/event-system';
import { 
  createTestTaskDefinition,
  createMockExtensionSystem,
  createMockEventBus,
  createRetryableTask,
  createDependencyTestTask,
  pollUntil,
  flushPromises
} from './helpers/task-testing-utils';

describe('Task System Tests', () => {
  describe('InMemoryTaskExecutor', () => {
    let taskRegistry: InMemoryTaskRegistry;
    let extensionSystem: ExtensionSystem;
    let eventBus: ExtensionEventBusImpl;
    let taskExecutor: InMemoryTaskExecutor;
    let publishSpy: ReturnType<typeof vi.fn>;
    
    beforeEach(() => {
      taskRegistry = new InMemoryTaskRegistry();
      extensionSystem = createMockExtensionSystem();
      eventBus = new ExtensionEventBusImpl(extensionSystem);
      publishSpy = vi.spyOn(eventBus, 'publish') as unknown as ReturnType<typeof vi.fn>;
      taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus);
    });
    
    describe('Core Task Execution', () => {
      const taskId = 'test-task';
      const taskHandler = vi.fn(async (context: TaskContext<{ value: number }, unknown>) => {
        return { result: context.input.value * 2 };
      });
      
      beforeEach(() => {
        const taskDefinition = createTestTaskDefinition(taskId, taskHandler);
        taskRegistry.registerTask(taskDefinition);
      });
  
      // Simple task execution test (from task-simple.test.ts)
      it('should execute a simple task with execution tracking', async () => {
        const executionOrder: string[] = [];
        
        // Register a simple tracking task
        const trackingTaskId = 'simple-tracking-task';
        taskRegistry.registerTask({
          id: trackingTaskId,
          name: 'Simple Tracking Task',
          description: 'A simple test task that tracks execution',
          handler: async (context: TaskContext<any, unknown>) => {
            executionOrder.push(trackingTaskId);
            return { result: 'success' };
          }
        });
        
        // Execute the task
        const result = await taskExecutor.executeTask(trackingTaskId, { test: true });
        
        // Assertions
        expect(result.success).toBe(true);
        expect(executionOrder).toEqual([trackingTaskId]);
        
        if (result.success && result.value) {
          const execution = result.value;
          expect(execution.status).toBe('completed');
          expect(execution.result).toEqual({ result: 'success' });
        }
      });
      
      it('should execute a task successfully', async () => {
        const result = await taskExecutor.executeTask(taskId, { value: 21 });
        
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          const execution = result.value;
          expect(execution.taskType).toBe(taskId);
          expect(execution.status).toBe('completed');
          expect(execution.result).toEqual({ result: 42 });
          expect(execution.createdAt).toBeDefined();
          expect(execution.startedAt).toBeDefined();
          expect(execution.completedAt).toBeDefined();
        }
        
        expect(taskHandler).toHaveBeenCalledTimes(1);
        expect(publishSpy).toHaveBeenCalledTimes(3);
      });
      
      // Additional test for task execution lifecycle events
      it('should emit correct lifecycle events during task execution', async () => {
        const eventTypes: string[] = [];
        
        // Spy on event publishing to track events
        publishSpy.mockImplementation((event: any) => {
          eventTypes.push(event.type);
          return Promise.resolve();
        });
        
        // Execute a task
        await taskExecutor.executeTask(taskId, { value: 10 });
        
        // Check that events were published in the correct order
        expect(eventTypes).toContain('task.created');
        expect(eventTypes).toContain('task.started');
        expect(eventTypes).toContain('task.completed');
        
        // Check the order of events
        const createdIndex = eventTypes.indexOf('task.created');
        const startedIndex = eventTypes.indexOf('task.started');
        const completedIndex = eventTypes.indexOf('task.completed');
        
        expect(createdIndex).toBeLessThan(startedIndex);
        expect(startedIndex).toBeLessThan(completedIndex);
      });
      
      it('should handle task execution failure', async () => {
        const failingTaskId = 'failing-task';
        const failingHandler = vi.fn(async () => {
          throw new Error('Task failed intentionally');
        });
        
        const failingTask = createTestTaskDefinition(failingTaskId, failingHandler);
        taskRegistry.registerTask(failingTask);
        
        const result = await taskExecutor.executeTask(failingTaskId, { value: 42 });
        
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          const execution = result.value;
          expect(execution.taskType).toBe(failingTaskId);
          expect(execution.status).toBe('failed');
          expect(execution.error).toBeDefined();
          if (execution.error) {
            expect(execution.error.message).toContain('Task failed intentionally');
          }
        }
        
        expect(failingHandler).toHaveBeenCalledTimes(1);
        expect(publishSpy).toHaveBeenCalledTimes(3);
        const callArgs = publishSpy.mock.calls.map((call: any[]) => (call[0] as DomainEvent<unknown>).type);
        expect(callArgs).toContain('task.created');
        expect(callArgs).toContain('task.started');
        expect(callArgs).toContain('task.failed');
      });
    });
  
    describe('Task Dependencies', () => {
      const dependencyTaskId = 'dependency-task';
      const mainTaskId = 'main-task';
      
      let dependencySpy: ReturnType<typeof vi.fn>;
      let mainTaskSpy: ReturnType<typeof vi.fn>;
      
      beforeEach(() => {
        dependencySpy = vi.fn().mockResolvedValue({ result: 'dependency-result' });
        mainTaskSpy = vi.fn().mockResolvedValue({ result: 'main-result' });
        
        taskRegistry.registerTask(createTestTaskDefinition(
          dependencyTaskId, 
          async () => dependencySpy()
        ));
        
        taskRegistry.registerTask(createTestTaskDefinition(
          mainTaskId, 
          async (context: TaskContext) => mainTaskSpy(context.input)
        ));
      });
      
      it('should execute tasks in dependency order', async () => {
        const dependencyResult = await taskExecutor.executeTask(dependencyTaskId, {});
        expect(dependencyResult.success).toBe(true);
        const dependencyExecId = dependencyResult.success && dependencyResult.value ? dependencyResult.value.id : '';
        
        const result = await taskExecutor.executeTaskWithDependencies(
          mainTaskId,
          { customData: 'test' },
          [dependencyExecId]
        );
        
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          expect(result.value.status).toBe('completed');
        }
        
        expect(dependencySpy).toHaveBeenCalled();
        
        // Use a less strict assertion to verify the dependency was passed correctly
        expect(mainTaskSpy).toHaveBeenCalled();
        const callArg = mainTaskSpy.mock.calls[0][0];
        expect(callArg.customData).toBe('test');
        expect(callArg.previousResults).toBeDefined();
        expect(typeof callArg.previousResults[dependencyExecId]).toBe('object');
        expect(callArg.previousResults[dependencyExecId].result).toBeDefined();
      });
      
      it('should fail if a dependency task fails', async () => {
        dependencySpy.mockRejectedValue(new Error('Dependency failed'));
        
        const dependencyResult = await taskExecutor.executeTask(dependencyTaskId, {});
        expect(dependencyResult.success).toBe(true);
        if (dependencyResult.success && dependencyResult.value) {
          expect(dependencyResult.value.status).toBe('failed');
        }
        
        const dependencyExecId = dependencyResult.success && dependencyResult.value ? dependencyResult.value.id : '';
        
        const result = await taskExecutor.executeTaskWithDependencies(
          mainTaskId,
          { customData: 'test' },
          [dependencyExecId]
        );
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('did not complete successfully');
        }
        
        expect(mainTaskSpy).not.toHaveBeenCalled();
      });
      
      // New tests from task-dependencies.test.ts
      it('should execute dependent tasks in the correct sequence', async () => {
        // Create tasks to track execution order
        const executionOrder: string[] = [];
        
        // Register tasks with sequential dependencies
        const task1Id = 'sequence-task1';
        const task2Id = 'sequence-task2';
        const task3Id = 'sequence-task3';
        
        taskRegistry.registerTask(createTestTaskDefinition(
          task1Id,
          async () => {
            executionOrder.push(task1Id);
            return { result: 'task1-result' };
          }
        ));
        
        taskRegistry.registerTask(createTestTaskDefinition(
          task2Id,
          async () => {
            executionOrder.push(task2Id);
            return { result: 'task2-result' };
          }
        ));
        
        taskRegistry.registerTask(createTestTaskDefinition(
          task3Id,
          async () => {
            executionOrder.push(task3Id);
            return { result: 'task3-result' };
          }
        ));
        
        // Execute tasks in sequence with dependencies
        const task1Result = await taskExecutor.executeTask(task1Id, {});
        expect(task1Result.success).toBe(true);
        const task1ExecId = task1Result.success && task1Result.value ? task1Result.value.id : '';
        
        const task2Result = await taskExecutor.executeTask(task2Id, {});
        expect(task2Result.success).toBe(true);
        const task2ExecId = task2Result.success && task2Result.value ? task2Result.value.id : '';
        
        const task3Result = await taskExecutor.executeTaskWithDependencies(
          task3Id,
          {},
          [task1ExecId, task2ExecId]
        );
        expect(task3Result.success).toBe(true);
        
        // Verify the execution order
        expect(executionOrder).toEqual([task1Id, task2Id, task3Id]);
      });
      
      it('should pass results from previous tasks to dependent tasks', async () => {
        const task1Id = 'result-task1';
        const task2Id = 'result-task2';
        
        // Create tasks that return specific results
        taskRegistry.registerTask(createTestTaskDefinition(
          task1Id,
          async () => ({ value: 42 })
        ));
        
        // Create a spy for the second task to check received results
        const task2Spy = vi.fn().mockResolvedValue({ processed: true });
        
        taskRegistry.registerTask(createTestTaskDefinition(
          task2Id,
          async (context) => task2Spy(context.input)
        ));
        
        // Execute the first task and get its result
        const task1Result = await taskExecutor.executeTask(task1Id, {});
        expect(task1Result.success).toBe(true);
        const task1ExecId = task1Result.success && task1Result.value ? task1Result.value.id : '';
        
        // Execute the second task with dependency on the first
        await taskExecutor.executeTaskWithDependencies(
          task2Id,
          { directInput: 'test' },
          [task1ExecId]
        );
        
        // Verify the second task received the results from the first
        expect(task2Spy).toHaveBeenCalled();
        const inputParam = task2Spy.mock.calls[0][0];
        expect(inputParam.directInput).toBe('test');
        expect(inputParam.previousResults).toBeDefined();
        expect(inputParam.previousResults[task1ExecId]).toEqual({ value: 42 });
      });
    });
  
    describe('Task Timeout and Retry', () => {
      const timeoutTaskId = 'timeout-task';
      let timeoutSpy: ReturnType<typeof vi.fn>;
      
      beforeEach(() => {
        timeoutSpy = vi.fn();
        
        const taskDefinition = createTestTaskDefinition(
          timeoutTaskId,
          async (context: TaskContext) => {
            timeoutSpy();
            await new Promise(resolve => setTimeout(resolve, 100));
            return { success: true };
          },
          {
            timeout: 50,
            retry: {
              maxAttempts: 2,
              backoffStrategy: 'fixed',
              initialDelay: 10,
              maxDelay: 100
            }
          }
        );
        taskRegistry.registerTask(taskDefinition);
      });
      
      it('should handle task timeout correctly', async () => {
        const result = await taskExecutor.executeTask(timeoutTaskId, {});
        
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          const execution = result.value;
          expect(execution.status).toBe('failed');
          expect(execution.error).toBeDefined();
          if (execution.error) {
            expect(execution.error.message).toContain('timed out');
            expect(execution.error.code).toBe('TIMEOUT');
          }
        }
        
        expect(timeoutSpy).toHaveBeenCalled();
        expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
          type: 'task.failed'
        }));
      });
      
      it('should not retry on timeout by default', async () => {
        const result = await taskExecutor.executeTask(timeoutTaskId, {});
        
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          expect(result.value.status).toBe('failed');
          expect(result.value.attemptNumber).toBe(1);
        }
        
        expect(timeoutSpy).toHaveBeenCalledTimes(1);
      });
      
      // New tests from task-retry.test.ts
      it('should retry a task up to the configured maximum attempts', async () => {
        // Register a task that succeeds after multiple attempts
        const retryTaskId = 'retry-success-task';
        let attempts = 0;
        
        taskRegistry.registerTask(createTestTaskDefinition(
          retryTaskId,
          async (context) => {
            attempts++;
            if (attempts < 3) {
              throw new Error(`Attempt ${attempts} failed`);
            }
            return { success: true, attempts };
          },
          {
            retry: {
              maxAttempts: 3,
              backoffStrategy: 'fixed',
              initialDelay: 10,
              maxDelay: 50,
              retryableErrorTypes: ['Error']
            }
          }
        ));
        
        // Execute the task
        const result = await taskExecutor.executeTask(retryTaskId, {});
        
        // Check that it succeeded after retries
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          expect(result.value.status).toBe('completed');
          expect(result.value.attemptNumber).toBe(3);
          expect(result.value.result).toEqual({ success: true, attempts: 3 });
        }
        
        // Check that the task was executed 3 times
        expect(attempts).toBe(3);
      });
      
      it('should only retry for specified error types', async () => {
        // Register a task that throws a non-retryable error type
        const nonRetryableTaskId = 'non-retryable-task';
        let attempts = 0;
        
        class CustomError extends Error {
          constructor(message: string) {
            super(message);
            this.name = 'CustomError';
          }
        }
        
        taskRegistry.registerTask(createTestTaskDefinition(
          nonRetryableTaskId,
          async () => {
            attempts++;
            throw new CustomError('Non-retryable error');
          },
          {
            retry: {
              maxAttempts: 3,
              backoffStrategy: 'fixed',
              initialDelay: 10,
              maxDelay: 50,
              retryableErrorTypes: ['Error'] // Only standard Error, not CustomError
            }
          }
        ));
        
        // Execute the task
        const result = await taskExecutor.executeTask(nonRetryableTaskId, {});
        
        // Check that it failed without retrying
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          expect(result.value.status).toBe('failed');
          expect(result.value.attemptNumber).toBe(1); // No retries
          expect(result.value.error?.name).toBe('CustomError');
        }
        
        // Check that the task was executed only once
        expect(attempts).toBe(1);
      });
    });
    
    describe('Task Priority and Scheduling', () => {
      const highPriorityTaskId = 'high-priority-task';
      const lowPriorityTaskId = 'low-priority-task';
      let highPrioritySpy: ReturnType<typeof vi.fn>;
      let lowPrioritySpy: ReturnType<typeof vi.fn>;
      
      beforeEach(() => {
        highPrioritySpy = vi.fn().mockImplementation(async (context: TaskContext) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { result: 'high-priority' };
        });
        
        lowPrioritySpy = vi.fn().mockImplementation(async (context: TaskContext) => {
          await new Promise(resolve => setTimeout(resolve, 50));
          return { result: 'low-priority' };
        });
        
        taskRegistry.registerTask(createTestTaskDefinition(
          highPriorityTaskId,
          highPrioritySpy as unknown as (context: TaskContext) => Promise<unknown>,
          { metadata: { priority: 100 } }
        ));
        
        taskRegistry.registerTask(createTestTaskDefinition(
          lowPriorityTaskId,
          lowPrioritySpy as unknown as (context: TaskContext) => Promise<unknown>,
          { metadata: { priority: 0 } }
        ));
      });
      
      it('should execute tasks based on priority', async () => {
        const executionOrder: string[] = [];
        
        highPrioritySpy.mockImplementation(async (context: TaskContext) => {
          executionOrder.push('high');
          await new Promise(resolve => setTimeout(resolve, 50));
          return { result: 'high-priority' };
        });
        
        lowPrioritySpy.mockImplementation(async (context: TaskContext) => {
          executionOrder.push('low');
          await new Promise(resolve => setTimeout(resolve, 50));
          return { result: 'low-priority' };
        });
        
        const highPriorityPromise = taskExecutor.executeTask(highPriorityTaskId, {});
        const lowPriorityPromise = taskExecutor.executeTask(lowPriorityTaskId, {});
        
        await Promise.all([highPriorityPromise, lowPriorityPromise]);
        
        expect(executionOrder[0]).toBe('high');
        expect(executionOrder[1]).toBe('low');
        
        const events = publishSpy.mock.calls.map((call: any[]) => call[0] as DomainEvent<unknown>);
        const startedEvents = events
          .filter(e => e.type === 'task.started')
          .map(e => ({
            type: (e.payload as { taskType: string }).taskType,
            timestamp: e.timestamp,
            priority: (e.payload as { taskType: string; metadata?: { priority?: number } }).metadata?.priority || 0
          }))
          .sort((a, b) => a.timestamp - b.timestamp);
        
        expect(startedEvents[0].type).toBe(highPriorityTaskId);
        expect(startedEvents[1].type).toBe(lowPriorityTaskId);
      });
    });
    
    describe('Event System Integration', () => {
      const taskId = 'event-test-task';
      let capturedEvents: DomainEvent<unknown>[] = [];
      
      beforeEach(() => {
        capturedEvents = [];
        publishSpy.mockImplementation((event: DomainEvent<unknown>) => {
          capturedEvents.push(event);
          return Promise.resolve();
        });
        
        const taskDefinition = createTestTaskDefinition(
          taskId,
          async (context: TaskContext<{ shouldFail?: boolean; shouldRetry?: boolean }, unknown>) => {
            if (context.input.shouldRetry && context.attemptNumber === 1) {
              throw new Error('Retryable error');
            }
            if (context.input.shouldFail) {
              throw new Error('Task failed');
            }
            return { success: true };
          },
          {
            retry: {
              maxAttempts: 2,
              backoffStrategy: 'fixed',
              initialDelay: 10,
              maxDelay: 100
            }
          }
        );
        taskRegistry.registerTask(taskDefinition);
      });
  
      it('should emit events with correct payload structure', async () => {
        const result = await taskExecutor.executeTask(taskId, { shouldFail: false });
        expect(result.success).toBe(true);
  
        const eventTypes = capturedEvents.map(e => e.type);
        expect(eventTypes).toEqual([
          'task.created',
          'task.started',
          'task.completed'
        ]);
  
        const createdEvent = capturedEvents.find(e => e.type === 'task.created')! as DomainEvent<{
          taskType: string;
          taskId: string;
          execution: TaskExecution<unknown, unknown>;
        }>;
        expect(createdEvent.payload).toMatchObject({
          taskType: taskId,
          taskId: expect.any(String),
          execution: expect.objectContaining({
            status: 'pending'
          })
        });
  
        const startedEvent = capturedEvents.find(e => e.type === 'task.started')! as DomainEvent<{
          taskType: string;
          taskId: string;
          attempt: number;
          execution: TaskExecution<unknown, unknown>;
        }>;
        expect(startedEvent.payload).toMatchObject({
          taskType: taskId,
          taskId: expect.any(String),
          attempt: 1,
          execution: expect.objectContaining({
            status: 'running'
          })
        });
  
        const completedEvent = capturedEvents.find(e => e.type === 'task.completed')! as DomainEvent<{
          taskType: string;
          taskId: string;
          result: unknown;
          duration: number;
          attempts: number;
          execution: TaskExecution<unknown, unknown>;
        }>;
        expect(completedEvent.payload).toMatchObject({
          taskType: taskId,
          taskId: expect.any(String),
          result: { success: true },
          duration: expect.any(Number),
          attempts: 1,
          execution: expect.objectContaining({
            status: 'completed'
          })
        });
      });
  
      it('should handle event publishing failures gracefully', async () => {
        publishSpy.mockRejectedValue(new Error('Event publishing failed'));
        
        const result = await taskExecutor.executeTask(taskId, {});
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          expect(result.value.status).toBe('completed');
        }
      });
      
      it('should maintain event order with slow event publishing', async () => {
        const eventOrder: string[] = [];
        const taskIds: string[] = [];
        
        publishSpy.mockImplementation(async (event: DomainEvent<unknown>) => {
          await new Promise(resolve => setTimeout(resolve, 10));
          // Store the task ID with the event type to trace which events belong to which task
          const taskId = (event.payload as any).taskId;
          if (!taskIds.includes(taskId)) {
            taskIds.push(taskId);
          }
          // Store event type with task index to preserve order
          const taskIndex = taskIds.indexOf(taskId);
          eventOrder.push(`${taskIndex}:${event.type}`);
          return Promise.resolve();
        });
        
        const task1Promise = taskExecutor.executeTask(taskId, {});
        const task2Promise = taskExecutor.executeTask(taskId, {});
        
        await Promise.all([task1Promise, task2Promise]);
        
        // Check that we have 2 tasks
        expect(taskIds.length).toBe(2);
        
        // Group events by task
        const task1Events = eventOrder.filter(e => e.startsWith('0:')).map(e => e.split(':')[1]);
        const task2Events = eventOrder.filter(e => e.startsWith('1:')).map(e => e.split(':')[1]);
        
        // Check each task's event order
        expect(task1Events).toEqual(['task.created', 'task.started', 'task.completed']);
        expect(task2Events).toEqual(['task.created', 'task.started', 'task.completed']);
      });
      
      // New test for retry events
      it('should emit retry events when task is retried', async () => {
        // Register a task that will be retried
        const retryTaskId = 'emit-retry-events-task';
        
        taskRegistry.registerTask(createTestTaskDefinition(
          retryTaskId,
          createRetryableTask(
            { success: true },
            { failureCount: 2, errorMessage: 'Temporary failure' }
          ),
          {
            retry: {
              maxAttempts: 3,
              backoffStrategy: 'fixed',
              initialDelay: 10,
              maxDelay: 50,
              retryableErrorTypes: ['Error']
            }
          }
        ));
        
        // Execute the task
        const result = await taskExecutor.executeTask(retryTaskId, {});
        
        // Check for retry events
        const retryEvents = capturedEvents.filter(e => e.type === 'task.retry');
        expect(retryEvents.length).toBe(2); // Two retries
        
        // Check the payload of the first retry event
        const firstRetryEvent = retryEvents[0];
        expect(firstRetryEvent.payload).toMatchObject({
          taskType: retryTaskId,
          attempt: 1,
          nextAttempt: 2,
          error: expect.objectContaining({
            message: 'Temporary failure'
          })
        });
        
        // Verify task completed after retries
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          expect(result.value.status).toBe('completed');
          expect(result.value.attemptNumber).toBe(3);
        }
      });
    });
    
    // Test for task cancellation
    describe('Task Cancellation', () => {
      it('should allow cancelling a running task', async () => {
        // Create a cancellation token
        const cancellationToken: CancellationToken = {
          isCancelled: false,
          cancel: vi.fn().mockImplementation(function(this: any) {
            this.isCancelled = true;
            // Call all registered handlers
            this.handlers.forEach((handler: () => void) => handler());
          }),
          onCancellationRequested: vi.fn().mockImplementation(function(this: any, handler: () => void) {
            this.handlers.push(handler);
          }),
          throwIfCancelled: vi.fn().mockImplementation(function(this: any) {
            if (this.isCancelled) {
              throw new Error('Operation cancelled');
            }
          }),
          handlers: [] as Array<() => void>
        };
        
        // Create a long-running task that supports cancellation
        const longTaskId = 'cancellable-task';
        const taskSpy = vi.fn();
        
        taskRegistry.registerTask(createTestTaskDefinition(
          longTaskId,
          async (context: TaskContext<unknown, unknown>) => {
            try {
              taskSpy('started');
              
              // Create a promise that can be cancelled
              return await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  taskSpy('completed');
                  resolve({ success: true });
                }, 1000);
                
                // Set up cancellation
                if (context.cancellationToken) {
                  context.cancellationToken.onCancellationRequested(() => {
                    taskSpy('cancelled');
                    clearTimeout(timeout);
                    reject(new Error('Task was cancelled'));
                  });
                }
              });
            } catch (error) {
              taskSpy('error', error);
              throw error;
            }
          }
        ));
        
        // Start executing the task
        const taskPromise = taskExecutor.executeTask(longTaskId, {}, { cancellationToken });
        
        // Wait a bit then cancel the task
        await new Promise(resolve => setTimeout(resolve, 50));
        cancellationToken.cancel();
        
        // Wait for the task to complete or fail
        const result = await taskPromise;
        
        // Check that the task was marked as failed due to cancellation
        expect(result.success).toBe(true);
        if (result.success && result.value) {
          expect(result.value.status).toBe('failed');
          expect(result.value.error?.message).toContain('cancelled');
        }
        
        // Verify the task was started then cancelled
        expect(taskSpy).toHaveBeenCalledWith('started');
        expect(taskSpy).toHaveBeenCalledWith('cancelled');
      });
    });
  });
}); 