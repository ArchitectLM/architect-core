import { vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { 
  TaskDefinition, 
  TaskContext, 
  TaskStatus, 
  TaskRetryPolicy,
  CancellationToken,
  TaskExecutionResult
} from '../../src/models/task-system';
import { ExtensionSystem } from '../../src/models/extension-system';
import { Result } from '../../src/models/core-types';
import { EventBus } from '../../src/models/event-system';
import { TaskHandler } from '../../src/models/task-system';

/**
 * Creates a test task definition with the given id, handler and options
 */
export function createTestTaskDefinition<TInput, TOutput>(
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
      retryableErrorTypes?: string[];
    };
    metadata?: Record<string, unknown>;
  } = {}
): TaskDefinition<TInput, TOutput> {
  // Create an adapter function that takes the input and creates a task context to pass to the original handler
  const handlerAdapter: TaskHandler<TInput, TOutput> = async (input: TInput) => {
    // Create a context object with the required properties
    const context: TaskContext<TInput, unknown> = {
      input,
      attemptNumber: 1,
      cancellationToken: createMockCancellationToken(),
      state: {} as unknown,
      metadata: {}
    };
    
    // Call the original handler with the context
    return handler(context);
  };

  // Construct retry policy if options.retry is provided
  const retryPolicy: TaskRetryPolicy | undefined = options.retry
    ? {
        maxAttempts: options.retry.maxAttempts,
        backoffStrategy: options.retry.backoffStrategy,
        initialDelay: options.retry.initialDelay,
        maxDelay: options.retry.maxDelay,
        retryableErrorTypes: options.retry.retryableErrorTypes
      }
    : undefined;

  return {
    type: id, // Use the provided id as the type
    handler: handlerAdapter,
    retryPolicy,
    metadata: options.metadata || {
      name: options.name || `Test Task ${id}`,
      description: options.description || `Test description for ${id}`,
      timeout: options.timeout
    }
  };
}

/**
 * Creates a mock extension system for testing
 */
export function createMockExtensionSystem(): Partial<ExtensionSystem> {
  return {
    executeExtensionPoint: vi.fn().mockResolvedValue({ success: true, value: undefined }),
    registerExtension: vi.fn(),
    unregisterExtension: vi.fn(),
    getExtensions: vi.fn().mockReturnValue([])
  };
}

/**
 * Creates a mock event bus for testing
 */
export function createMockEventBus(): Partial<EventBus> {
  return {
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockReturnValue({
      id: uuidv4(),
      eventType: 'test-event',
      unsubscribe: vi.fn()
    }),
    unsubscribe: vi.fn(),
    clearSubscriptions: vi.fn(),
    clearAllSubscriptions: vi.fn(),
    subscriberCount: vi.fn().mockReturnValue(0)
  };
}

/**
 * Creates a mock cancellation token
 */
export function createMockCancellationToken(isCancelled = false): CancellationToken {
  return {
    isCancellationRequested: isCancelled,
    onCancellationRequested: vi.fn(),
    throwIfCancellationRequested: vi.fn()
  };
}

/**
 * Helper to poll until a condition is met or timeout
 */
export async function pollUntil(
  condition: () => boolean | Promise<boolean>,
  interval = 10,
  timeout = 1000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

/**
 * Wait for promises to flush
 */
export async function flushPromises(): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
}

/**
 * Creates a task that resolves after a delay
 */
export function createDelayedTask<T>(result: T, delay: number): () => Promise<T> {
  return async () => {
    await new Promise(resolve => setTimeout(resolve, delay));
    return result;
  };
}

/**
 * Creates a task that fails with the given error
 */
export function createFailingTask(error: Error): () => Promise<never> {
  return async () => {
    throw error;
  };
}

/**
 * Creates a result object with the given success status
 */
export function createResult<T>(success: boolean, value?: T, error?: Error): Result<T> {
  if (success) {
    return { success, value: value as T };
  } else {
    return { success, error: error || new Error('Task failed') };
  }
}

/**
 * Creates a task that fails on initial attempts but succeeds after a specified number of failures
 * Useful for testing retry logic
 */
export function createRetryableTask<T>(
  result: T,
  options: {
    failureCount: number;
    errorMessage?: string;
    errorType?: string;
  }
): (context: TaskContext<any, unknown>) => Promise<T> {
  let attempts = 0;
  return async (context: TaskContext<any, unknown>) => {
    attempts++;
    
    if (attempts <= options.failureCount) {
      const error = new Error(options.errorMessage || `Failure attempt ${attempts}`);
      if (options.errorType) {
        error.name = options.errorType;
      }
      throw error;
    }
    
    return result;
  };
}

/**
 * Creates a task with dependencies tracking
 * Returns results including the execution order and previous task results
 */
export function createDependencyTestTask<TInput, TOutput>(
  id: string,
  expectedPrevResults: Record<string, unknown>,
  executionOrder: string[],
  output: TOutput
): (context: TaskContext<TInput, unknown>) => Promise<TOutput> {
  return async (context: TaskContext<TInput, unknown>) => {
    executionOrder.push(id);
    
    // Validate that the previous results match what we expect
    if (expectedPrevResults && context.previousResults) {
      const prevResultKeys = Object.keys(context.previousResults || {});
      
      // Verify expected keys exist
      for (const key of Object.keys(expectedPrevResults)) {
        if (!prevResultKeys.includes(key)) {
          throw new Error(`Expected previous result for ${key} but not found`);
        }
      }
    }
    
    return output;
  };
}

/**
 * Creates a mock task execution for testing
 */
export function createMockTaskExecution<TInput, TOutput>(
  options: {
    id?: string;
    taskType: string;
    status?: TaskStatus;
    input?: TInput;
    result?: TOutput;
    error?: Error;
    startedAt?: number;
    completedAt?: number;
    attemptNumber?: number;
    metadata?: Record<string, unknown>;
  }
): TaskExecutionResult<TInput, TOutput> {
  const now = Date.now();
  return {
    id: options.id || uuidv4(),
    taskType: options.taskType,
    status: options.status || 'pending',
    input: options.input as TInput,
    result: options.result as TOutput,
    error: options.error,
    createdAt: now - 100,
    startedAt: options.startedAt || (options.status !== 'pending' ? now - 50 : undefined),
    completedAt: options.completedAt || (options.status === 'completed' || options.status === 'failed' ? now : undefined),
    attemptNumber: options.attemptNumber || 1
  };
}

/**
 * Creates a mock task executor that returns predefined results
 * Useful for testing task scheduling and dependencies
 */
export interface MockTaskExecutor {
  executeTask: <TInput = unknown, TOutput = unknown>(
    taskType: string,
    input?: TInput
  ) => Promise<Result<TaskExecutionResult<TInput, TOutput>>>;
  
  executeTaskWithDependencies: <TInput = unknown, TOutput = unknown>(
    taskType: string,
    input?: TInput,
    dependencies?: string[]
  ) => Promise<Result<TaskExecutionResult<TInput, TOutput>>>;
}

export function createMockTaskExecutor(
  mockResults: Record<string, Result<TaskExecutionResult<any, any>>> = {}
): MockTaskExecutor {
  return {
    executeTask: async <TInput = unknown, TOutput = unknown>(
      taskType: string, 
      input?: TInput
    ): Promise<Result<TaskExecutionResult<TInput, TOutput>>> => {
      if (mockResults[taskType]) {
        return mockResults[taskType] as Result<TaskExecutionResult<TInput, TOutput>>;
      }
      
      // Default success result if not specified
      return {
        success: true,
        value: createMockTaskExecution<TInput, TOutput>({
          taskType,
          status: 'completed',
          input,
          result: { success: true } as unknown as TOutput
        })
      };
    },
    
    executeTaskWithDependencies: async <TInput = unknown, TOutput = unknown>(
      taskType: string, 
      input?: TInput, 
      dependencies?: string[]
    ): Promise<Result<TaskExecutionResult<TInput, TOutput>>> => {
      if (mockResults[`${taskType}-with-deps`]) {
        return mockResults[`${taskType}-with-deps`] as Result<TaskExecutionResult<TInput, TOutput>>;
      }
      
      if (dependencies && dependencies.some(id => mockResults[id] && !mockResults[id].success)) {
        return {
          success: false,
          error: new Error('Dependency execution failed')
        };
      }
      
      // Default success result if not specified
      return {
        success: true,
        value: createMockTaskExecution<TInput, TOutput>({
          taskType,
          status: 'completed',
          input,
          result: { success: true, withDependencies: true } as unknown as TOutput
        })
      };
    }
  };
}

/**
 * Helper function to create a task definition with the modern structure
 */
export function createTaskDefinition<TInput = unknown, TOutput = unknown>(
  definition: {
    id: string;
    name?: string;
    description?: string;
    handler: (context: any) => Promise<TOutput>;
    timeout?: number;
    retry?: TaskRetryPolicy;
    metadata?: Record<string, unknown>;
    dependencies?: string[];
  }
): TaskDefinition<TInput, TOutput> {
  // Create an adapter handler that converts context-based handlers to input-based ones
  const modernHandler: TaskHandler<TInput, TOutput> = async (input: TInput): Promise<TOutput> => {
    // Create a context object that matches the legacy API expectations
    const context = {
      input,
      taskId: 'task-execution-id',
      taskType: definition.id,
      attemptNumber: 1,
      previousResults: {},
      metadata: {},
      cancellationToken: createMockCancellationToken(),
      state: {}
    };
    
    return await definition.handler(context);
  };
  
  // Return a task definition that follows the current model
  return {
    type: definition.id, // Convert id to type
    handler: modernHandler,
    dependencies: definition.dependencies,
    retryPolicy: definition.retry,
    metadata: {
      ...(definition.metadata || {}),
      name: definition.name || definition.id,
      description: definition.description || `Task for ${definition.id}`
    }
  };
} 