import { v4 as uuidv4 } from 'uuid';
import { 
  TaskExecutor, 
  TaskExecution, 
  TaskRegistry,
  TaskDefinition,
  TaskContext,
  CancellationToken,
  TaskStatus,
  TaskExecutionResult
} from '../models/task-system';
import { Identifier, Result, DomainEvent } from '../models/core-types';
import { EventBus } from '../models/event-system';

// Define task statuses as const to avoid casting
const TASK_STATUS = {
  PENDING: 'pending' as const,
  SCHEDULED: 'scheduled' as const,
  RUNNING: 'running' as const,
  COMPLETED: 'completed' as const,
  FAILED: 'failed' as const,
  CANCELLED: 'cancelled' as const
};

/**
 * Extended cancellation token interface that can be cancelled
 */
interface CancellableToken extends CancellationToken {
  cancel(): void;
}

/**
 * Implementation of CancellationToken for task execution
 */
class CancellationTokenImpl implements CancellableToken {
  private _isCancelled = false;
  private readonly callbacks: (() => void)[] = [];

  /**
   * Check if cancellation was requested
   */
  get isCancellationRequested(): boolean {
    return this._isCancelled;
  }

  /**
   * Register a callback to be called when cancellation is requested
   */
  onCancellationRequested(callback: () => void): void {
    if (this._isCancelled) {
      callback();
    } else {
      this.callbacks.push(callback);
    }
  }

  /**
   * Throw an error if cancellation has been requested
   */
  throwIfCancellationRequested(): void {
    if (this._isCancelled) {
      throw new Error('Task was cancelled');
    }
  }

  /**
   * Request cancellation
   */
  cancel(): void {
    this._isCancelled = true;
    this.callbacks.forEach(callback => callback());
  }
}

/**
 * Execution tracking information
 */
interface RunningTask<TInput, TOutput> {
  execution: TaskExecution<TInput, TOutput>;
  cancellationToken: CancellableToken;
  promise?: Promise<Result<TaskExecution<TInput, TOutput>>>;
  resolve: (result: Result<TaskExecution<TInput, TOutput>>) => void;
  reject: (error: Error) => void;
}

/**
 * Helper function to convert a TaskExecution to TaskExecutionResult
 */
function executionToResult<TInput, TOutput>(execution: TaskExecution<TInput, TOutput>): TaskExecutionResult<TInput, TOutput> {
  return {
    id: execution.id,
    taskType: execution.taskType,
    status: execution.status,
    input: execution.input,
    result: execution.result,
    error: execution.error,
    createdAt: execution.createdAt,
    startedAt: execution.startedAt,
    completedAt: execution.completedAt,
    attemptNumber: execution.attemptNumber
  };
}

/**
 * In-memory implementation of TaskExecutor
 * Executes tasks with proper error handling, cancellation support, and dependency tracking
 */
export class InMemoryTaskExecutor implements TaskExecutor {
  private runningTasks = new Map<Identifier, RunningTask<unknown, unknown>>();
  private taskExecutions = new Map<Identifier, TaskExecution<unknown, unknown>>();
  
  constructor(
    private taskRegistry: TaskRegistry,
    private eventBus: EventBus
  ) {}

  /**
   * Execute a task immediately
   * @param taskType The type of task to execute
   * @param input The input for the task
   */
  async executeTask<TInput = unknown, TOutput = unknown>(
    taskType: string,
    input: TInput
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>> {
    try {
      // Get the task definition
      const task = this.taskRegistry.getTask<TInput, TOutput>(taskType);
      if (!task) {
        return {
          success: false,
          error: new Error(`Task type ${taskType} not found`)
        };
      }

      // Create execution record
      const execution = this.createExecutionRecord<TInput, TOutput>(taskType, input);
      this.taskExecutions.set(execution.id, execution as unknown as TaskExecution<unknown, unknown>);

      // Create cancellation token
      const cancellationToken = new CancellationTokenImpl();

      // Create deferred promise
      let resolve!: (result: Result<TaskExecution<TInput, TOutput>>) => void;
      let reject!: (error: Error) => void;
      
      const promise = new Promise<Result<TaskExecution<TInput, TOutput>>>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      // Store running task info
      const runningTask: RunningTask<TInput, TOutput> = {
        execution,
        cancellationToken,
        promise,
        resolve,
        reject
      };

      this.runningTasks.set(execution.id, runningTask as RunningTask<unknown, unknown>);

      // Execute task
      this.executeWithRetry(task, execution, cancellationToken)
        .then(result => {
          this.taskExecutions.set(result.id, result as unknown as TaskExecution<unknown, unknown>);
          this.runningTasks.delete(result.id);
          resolve({ success: true, value: result });
        })
        .catch(error => {
          const failedExecution = {
            ...execution,
            status: TASK_STATUS.FAILED,
            error: createErrorObject(error)
          };
          this.taskExecutions.set(failedExecution.id, failedExecution as unknown as TaskExecution<unknown, unknown>);
          this.runningTasks.delete(failedExecution.id);
          resolve({
            success: false,
            error,
            value: failedExecution
          });
        });

      // Wait for task to complete and convert to TaskExecutionResult
      const result = await promise;
      return {
        success: result.success,
        error: result.error,
        value: result.value ? executionToResult(result.value) : undefined
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Cancel a running task
   * @param taskId The ID of the task to cancel
   */
  async cancelTask(taskId: Identifier): Promise<Result<void>> {
    try {
      const runningTask = this.getRunningTask(taskId);
      
      if (!runningTask) {
        return {
          success: false,
          error: new Error(`Task with ID ${taskId} is not running`)
        };
      }

      // Cancel the task
      runningTask.cancellationToken.cancel();
      
      // Update execution status
      const execution = runningTask.execution;
      execution.status = TASK_STATUS.CANCELLED;
      execution.completedAt = Date.now();
      
      this.taskExecutions.set(execution.id, execution as unknown as TaskExecution<unknown, unknown>);
      
      // Emit event
      await this.emitTaskEvent('task:cancelled', execution);
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Execute a task with dependencies
   * @param taskType The type of task to execute
   * @param input The task input parameters
   * @param dependencies The dependency task IDs
   */
  async executeTaskWithDependencies<TInput = unknown, TOutput = unknown>(
    taskType: string,
    input: TInput,
    dependencies: string[]
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>> {
    try {
      // First, check if all dependencies are completed
      const dependencyResults: Record<string, any> = {};
      let allDependenciesSuccessful = true;
      
      for (const dependencyId of dependencies) {
        const dependencyStatus = await this.getTaskStatus(dependencyId);
        
        if (!dependencyStatus.success || !dependencyStatus.value) {
          return {
            success: false,
            error: new Error(`Dependency task ${dependencyId} not found`)
          };
        }
        
        const dependency = dependencyStatus.value;
        
        if (dependency.status !== TASK_STATUS.COMPLETED) {
          allDependenciesSuccessful = false;
          break;
        }
        
        // Store dependency result for task context
        dependencyResults[dependencyId] = dependency.result;
      }
      
      if (!allDependenciesSuccessful) {
        return {
          success: false,
          error: new Error('Not all dependencies completed successfully')
        };
      }
      
      // Get the task definition
      const task = this.taskRegistry.getTask<TInput, TOutput>(taskType);
      if (!task) {
        return {
          success: false,
          error: new Error(`Task type ${taskType} not found`)
        };
      }
      
      // Create execution record with dependencies
      const execution = this.createExecutionRecord<TInput, TOutput>(taskType, input, dependencies);
      this.taskExecutions.set(execution.id, execution as unknown as TaskExecution<unknown, unknown>);
      
      // Create cancellation token
      const cancellationToken = new CancellationTokenImpl();
      
      // Create deferred promise
      let resolve!: (result: Result<TaskExecution<TInput, TOutput>>) => void;
      let reject!: (error: Error) => void;
      
      const promise = new Promise<Result<TaskExecution<TInput, TOutput>>>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      // Store running task info
      const runningTask: RunningTask<TInput, TOutput> = {
        execution,
        cancellationToken,
        promise,
        resolve,
        reject
      };

      this.runningTasks.set(execution.id, runningTask as RunningTask<unknown, unknown>);

      // Execute task
      this.executeWithRetry(task, execution, cancellationToken)
        .then(result => {
          this.taskExecutions.set(result.id, result as unknown as TaskExecution<unknown, unknown>);
          this.runningTasks.delete(result.id);
          resolve({ success: true, value: result });
        })
        .catch(error => {
          const failedExecution = {
            ...execution,
            status: TASK_STATUS.FAILED,
            error: createErrorObject(error)
          };
          this.taskExecutions.set(failedExecution.id, failedExecution as unknown as TaskExecution<unknown, unknown>);
          this.runningTasks.delete(failedExecution.id);
          resolve({
            success: false,
            error,
            value: failedExecution
          });
        });

      // Wait for task to complete and convert to TaskExecutionResult
      const result = await promise;
      return {
        success: result.success,
        error: result.error,
        value: result.value ? executionToResult(result.value) : undefined
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get a running task by ID
   */
  getRunningTask<TInput, TOutput>(taskId: Identifier): RunningTask<TInput, TOutput> | undefined {
    return this.runningTasks.get(taskId) as RunningTask<TInput, TOutput> | undefined;
  }

  /**
   * Check if a task is currently running
   */
  isTaskRunning(taskId: Identifier): boolean {
    return this.runningTasks.has(taskId);
  }

  /**
   * Get the number of currently running tasks
   */
  get runningTaskCount(): number {
    return this.runningTasks.size;
  }

  /**
   * Get the status of a task
   * @param taskId The ID of the task
   */
  async getTaskStatus<TInput = unknown, TOutput = unknown>(
    taskId: Identifier
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>> {
    try {
      const execution = this.taskExecutions.get(taskId) as TaskExecution<TInput, TOutput> | undefined;
      
      if (!execution) {
        return {
          success: false,
          error: new Error(`Task with ID ${taskId} not found`)
        };
      }
      
      return { 
        success: true, 
        value: executionToResult(execution)
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  private async getTaskDefinition<TInput, TOutput>(
    taskType: string
  ): Promise<Result<TaskDefinition<TInput, TOutput>>> {
    try {
      const definitionResult = await this.taskRegistry.getTaskDefinition<TInput, TOutput>(taskType);
      return definitionResult;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(`Task type ${taskType} not found`)
      };
    }
  }

  private createExecutionRecord<TInput, TOutput>(
    taskType: string,
    input: TInput,
    dependencies?: Identifier[]
  ): TaskExecution<TInput, TOutput> {
    return {
      id: uuidv4(),
      taskType,
      status: TASK_STATUS.PENDING,
      input,
      createdAt: Date.now(),
      attemptNumber: 1,
      ...(dependencies && { relations: { dependsOn: dependencies } })
    };
  }

  private async emitTaskEvent<TInput, TOutput>(
    eventType: string,
    execution: TaskExecution<TInput, TOutput>
  ): Promise<void> {
    // Create the event
    const event: DomainEvent<unknown> = {
      id: uuidv4(),
      type: eventType,
      timestamp: Date.now(),
      payload: {
        taskId: execution.id,
        taskType: execution.taskType,
        execution: { ...execution }, // Create a copy to avoid reference issues
        // Add specific fields based on event type
        ...(eventType === 'task.started' && { attempt: execution.attemptNumber }),
        ...(eventType === 'task.completed' && { 
          result: execution.result,
          duration: execution.completedAt && execution.startedAt 
            ? execution.completedAt - execution.startedAt
            : 0,
          attempts: execution.attemptNumber
        }),
        ...(eventType === 'task.failed' && {
          error: execution.error,
          attemptNumber: execution.attemptNumber
        }),
        ...(eventType === 'task.cancelled' && {
          cancelledAt: execution.completedAt
        })
      }
    };

    try {
      // We need to ensure sequential publishing of events for the same task
      await this.eventBus.publish(event);
    } catch (error) {
      // Log the error but don't fail the task execution
      console.error(`Failed to emit task event ${eventType} for task ${execution.id}:`, error);
    }
  }

  private async executeWithRetry<TInput, TOutput>(
    definition: ExtendedTaskDefinition<TInput, TOutput>,
    execution: TaskExecution<TInput, TOutput>,
    cancellationToken: CancellableToken
  ): Promise<TaskExecution<TInput, TOutput>> {
    let lastError: Error | undefined;
    let currentAttempt = execution.attemptNumber;
    
    // Get max attempts from either retry or retryPolicy
    const maxAttempts = definition.retry?.maxAttempts || 
                         definition.retryPolicy?.maxAttempts || 
                         1;

    while (currentAttempt <= maxAttempts) {
      try {
        cancellationToken.throwIfCancellationRequested();
        
        execution.status = TASK_STATUS.RUNNING;
        execution.startedAt = Date.now();
        execution.attemptNumber = currentAttempt;

        await this.emitTaskEvent('task.started', execution);
        
        // Create context for the task
        const context: TaskContext<TInput, unknown> = {
          input: execution.input,
          attemptNumber: currentAttempt,
          previousError: lastError,
          cancellationToken,
          state: {} as Record<string, unknown>,
          metadata: definition.metadata || {},
        };

        // Create a timeout promise if a timeout is defined
        // Timeout can come from either the definition's timeout property or retryPolicy
        const timeout = definition.timeout || 0;
        let taskPromise: Promise<TOutput>;
        
        try {
          // Call the handler with the input directly, not the context
          taskPromise = definition.handler(execution.input);
        } catch (error) {
          throw error;
        }
        
        // Apply timeout if defined
        if (timeout > 0) {
          taskPromise = Promise.race([
            taskPromise,
            new Promise<TOutput>((_, reject) => {
              setTimeout(() => {
                reject(new Error(`Task execution timed out after ${timeout}ms`));
              }, timeout);
            })
          ]);
        }

        try {
          const result = await taskPromise;
          execution.status = TASK_STATUS.COMPLETED;
          execution.completedAt = Date.now();
          execution.result = result;

          await this.emitTaskEvent('task.completed', execution);
          return execution;
        } catch (error) {
          // Check if this is a timeout error
          const isTimeout = error instanceof Error && 
            error.message.includes('Task execution timed out');
          
          lastError = error instanceof Error ? error : new Error(String(error));
          execution.status = TASK_STATUS.FAILED;
          execution.error = {
            message: lastError.message,
            name: lastError.name,
            stack: lastError.stack,
            code: isTimeout ? 'TIMEOUT' : lastError.name,
            details: lastError
          };
          execution.completedAt = Date.now();

          await this.emitTaskEvent('task.failed', execution);

          // Timeout errors are not retried by default unless specifically configured
          const retryableTypes = definition.retry?.retryableErrorTypes || 
                                definition.retryPolicy?.retryableErrorTypes || 
                                [];
          const retryOnTimeout = definition.retryPolicy?.retryOnTimeout || false;
          
          if (isTimeout && !retryOnTimeout && !retryableTypes.includes('TIMEOUT')) {
            return execution;  // Exit retry loop on timeout
          }

          // At this point, lastError should always be defined since we're in the catch block
          // Check if we should retry based on max attempts
          let shouldRetry = currentAttempt < maxAttempts;
          
          // Check if error type is retryable if filter is specified
          if (shouldRetry && definition.retry?.retryableErrorTypes && definition.retry.retryableErrorTypes.length > 0) {
            const errorName = lastError.name;
            const errorMessage = lastError.message;
            // Check if the error is in the list of retryable errors
            shouldRetry = definition.retry.retryableErrorTypes.some(errorType => 
              errorName === errorType || errorMessage.includes(errorType)
            );
            
            // If error isn't retryable, don't retry even if we haven't hit max attempts
            if (!shouldRetry) {
              break; // Exit the retry loop immediately
            }
          }

          if (shouldRetry) {
            // Emit retry attempt event before trying again
            await this.eventBus.publish({
              id: uuidv4(),
              type: 'task:retryAttempt',
              timestamp: Date.now(),
              payload: {
                taskId: execution.id,
                taskType: execution.taskType,
                attemptNumber: currentAttempt,
                error: lastError,
                nextAttempt: currentAttempt + 1
              }
            });

            const delay = this.calculateRetryDelay(definition.retry, currentAttempt);
            await new Promise(resolve => setTimeout(resolve, delay));
            currentAttempt++;
          } else {
            // No more retries, return the failed execution
            break;
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        execution.status = TASK_STATUS.FAILED;
        execution.error = {
          message: lastError.message,
          name: lastError.name,
          stack: lastError.stack,
          code: typeof error === 'object' && error !== null && 'code' in error ? 
            (error as { code?: string }).code : undefined,
          details: lastError
        };
        execution.completedAt = Date.now();

        await this.emitTaskEvent('task.failed', execution);

        // Check if we should retry based on max attempts
        let shouldRetry = currentAttempt < maxAttempts;
        
        // Check if error type is retryable if filter is specified
        if (shouldRetry && definition.retry?.retryableErrorTypes && definition.retry.retryableErrorTypes.length > 0) {
          const errorName = lastError.name;
          const errorMessage = lastError.message;
          shouldRetry = definition.retry.retryableErrorTypes.some(errorType => 
            errorName === errorType || errorMessage.includes(errorType)
          );
          
          if (!shouldRetry) {
            break; // Exit the retry loop immediately
          }
        }

        if (shouldRetry) {
          // Emit retry attempt event before trying again
          await this.eventBus.publish({
            id: uuidv4(),
            type: 'task:retryAttempt',
            timestamp: Date.now(),
            payload: {
              taskId: execution.id,
              taskType: execution.taskType,
              attemptNumber: currentAttempt,
              error: lastError,
              nextAttempt: currentAttempt + 1
            }
          });

          const delay = this.calculateRetryDelay(definition.retry, currentAttempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          currentAttempt++;
        } else {
          // No more retries, return the failed execution
          break;
        }
      }
    }

    // If we've exhausted retries, ensure the execution is marked as failed
    execution.status = TASK_STATUS.FAILED;
    return execution;
  }

  private calculateRetryDelay(
    policy: ExtendedTaskDefinition['retry'] | TaskDefinition['retryPolicy'],
    attempt: number
  ): number {
    // Default delay if no policy is provided
    if (!policy) {
      return 0;
    }
    
    // Handle both types of retry policy formats
    if ('backoffStrategy' in policy) {
      // Handle standard retryPolicy format
      const { backoffStrategy, initialDelay, maxDelay } = policy;
      let delay = initialDelay;

      switch (backoffStrategy) {
        case 'linear':
          delay *= attempt;
          break;
        case 'exponential':
          delay *= Math.pow(2, attempt - 1);
          break;
        // 'fixed' strategy uses initialDelay as is
      }

      return Math.min(delay, maxDelay);
    } else {
      // Handle legacy retry format - use simple exponential backoff
      const initialDelay = 1000; // 1 second default
      const maxDelay = 30000;   // 30 seconds max
      const delay = initialDelay * Math.pow(2, attempt - 1);
      return Math.min(delay, maxDelay);
    }
  }
}

/**
 * Factory function to create a new TaskExecutor
 */
export function createTaskExecutor(taskRegistry: TaskRegistry, eventBus: EventBus): TaskExecutor {
  return new InMemoryTaskExecutor(taskRegistry, eventBus);
}

// Helper function to create a properly structured error object
function createErrorObject(error: unknown): TaskExecution<unknown, unknown>['error'] {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      code: isErrorWithCode(error) ? error.code : undefined,
      details: error
    };
  }
  
  return {
    message: String(error),
    name: 'UnknownError',
    details: error
  };
}

// Type guard for errors with code property
function isErrorWithCode(error: unknown): error is { code?: string } {
  return error !== null && 
         typeof error === 'object' && 
         'code' in error &&
         (typeof (error as { code: unknown }).code === 'string' || 
          (error as { code: unknown }).code === undefined);
}

// Extension of the TaskDefinition type to include additional properties our implementation uses
interface ExtendedTaskDefinition<TInput = unknown, TOutput = unknown> extends TaskDefinition<TInput, TOutput> {
  // Optional timeout in milliseconds
  timeout?: number;
  // Alias for retryPolicy to maintain compatibility
  retry?: {
    maxAttempts: number;
    retryableErrorTypes?: string[];
  };
} 