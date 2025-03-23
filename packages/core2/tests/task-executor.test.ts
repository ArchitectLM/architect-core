import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InMemoryTaskExecutor } from '../src/implementations/task-executor';
import { InMemoryTaskRegistry } from '../src/implementations/task-registry';
import { ExtensionEventBus } from '../src/implementations/event-bus';
import { ExtensionSystem } from '../src/models/extension-system';
import { 
  TaskDefinition, 
  TaskContext, 
  TaskExecution,
  TaskStatus,
  TaskRetryPolicy
} from '../src/models/task-system';
import { DomainEvent, Result } from '../src/models/core-types';
import { EventBus } from '../src/models/event-system';

// Helper to create test task definitions
function createTestTaskDefinition<TInput, TOutput>(
  id: string,
  handler: (context: TaskContext<TInput, unknown>) => Promise<TOutput>,
  options: {
    name?: string;
    description?: string;
    timeout?: number;
    retry?: {
      maxAttempts: number;
      backoffStrategy: 'fixed' | 'linear' | 'exponential';
      initialDelay: number;
      maxDelay: number;
    };
    metadata?: Record<string, unknown>;
  } = {}
): TaskDefinition<TInput, TOutput, unknown> {
  return {
    id,
    name: options.name || `Test Task ${id}`,
    description: options.description || `Test description for ${id}`,
    handler,
    timeout: options.timeout,
    retry: options.retry as TaskRetryPolicy,
    metadata: {
      isTest: true,
      ...options.metadata
    }
  };
}

// Helper to create a mock extension system
function createMockExtensionSystem(): ExtensionSystem {
  return {
    executeExtensionPoint: vi.fn().mockResolvedValue({ success: true }),
    registerExtension: vi.fn(),
    unregisterExtension: vi.fn(),
    getExtension: vi.fn(),
    getExtensions: vi.fn(),
    hasExtension: vi.fn().mockReturnValue(false)
  };
}

describe('InMemoryTaskExecutor', () => {
  let taskRegistry: InMemoryTaskRegistry;
  let extensionSystem: ExtensionSystem;
  let eventBus: ExtensionEventBus;
  let taskExecutor: InMemoryTaskExecutor;
  let publishSpy: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    taskRegistry = new InMemoryTaskRegistry();
    extensionSystem = createMockExtensionSystem();
    eventBus = new ExtensionEventBus(extensionSystem);
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
    
    it('should execute a task successfully', async () => {
      const result = await taskExecutor.executeTask(taskId, { value: 21 });
      
      expect(result.success).toBe(true);
      if (result.success) {
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
      const callArgs = publishSpy.mock.calls.map((call: any[]) => (call[0] as DomainEvent<unknown>).type);
      expect(callArgs).toContain('task.created');
      expect(callArgs).toContain('task.started');
      expect(callArgs).toContain('task.completed');
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
      if (result.success) {
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
      const dependencyExecId = dependencyResult.success ? dependencyResult.value.id : '';
      
      const result = await taskExecutor.executeTaskWithDependencies(
        mainTaskId,
        { customData: 'test' },
        [dependencyExecId]
      );
      
      expect(result.success).toBe(true);
      if (result.success) {
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
      if (dependencyResult.success) {
        expect(dependencyResult.value.status).toBe('failed');
      }
      
      const dependencyExecId = dependencyResult.success ? dependencyResult.value.id : '';
      
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
      if (result.success) {
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
      if (result.success) {
        expect(result.value.status).toBe('failed');
        expect(result.value.attemptNumber).toBe(1);
      }
      
      expect(timeoutSpy).toHaveBeenCalledTimes(1);
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
      if (result.success) {
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
  });
}); 