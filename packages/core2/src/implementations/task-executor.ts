import { v4 as uuidv4 } from 'uuid';
import { 
  TaskExecutor, 
  TaskExecution, 
  TaskRegistry,
  TaskDefinition,
  TaskContext,
  CancellationToken,
  TaskStatus
} from '../models/task-system';
import { Identifier, Result, DomainEvent } from '../models/core-types';
import { EventBus } from '../models/event-system';

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
  promise: Promise<Result<TaskExecution<TInput, TOutput>>>;
  resolve: (result: Result<TaskExecution<TInput, TOutput>>) => void;
  reject: (error: Error) => void;
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
  async executeTask<TInput, TOutput>(
    taskType: string,
    input: TInput
  ): Promise<Result<TaskExecution<TInput, TOutput>>> {
    try {
      const definition = await this.getTaskDefinition<TInput, TOutput>(taskType);
      if (!definition.success) {
        return definition;
      }

      const execution = this.createExecutionRecord<TInput, TOutput>(taskType, input);
      await this.emitTaskEvent('task.created', execution);

      const cancellationToken = new CancellationTokenImpl();
      const result = await this.executeWithRetry(
        definition.value,
        execution,
        cancellationToken
      );

      return { success: true, value: result };
    } catch (error) {
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
  async cancelTask(taskId: Identifier): Promise<Result<boolean>> {
    try {
      const runningTask = this.runningTasks.get(taskId);
      if (!runningTask) {
        return {
          success: false,
          error: new Error(`Task ${taskId} not found or not running`)
        };
      }

      runningTask.cancellationToken.cancel();
      this.runningTasks.delete(taskId);

      await this.emitTaskEvent('task.cancelled', runningTask.execution);
      return { success: true, value: true };
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
   * @param input The input for the task
   * @param dependencies IDs of tasks that must complete first
   */
  async executeTaskWithDependencies<TInput, TOutput>(
    taskType: string,
    input: TInput,
    dependencies: Identifier[]
  ): Promise<Result<TaskExecution<TInput, TOutput>>> {
    try {
      const execution = this.createExecutionRecord<TInput, TOutput>(taskType, input, dependencies);
      return this.executeTask(taskType, input);
    } catch (error) {
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

  private async getTaskDefinition<TInput, TOutput>(
    taskType: string
  ): Promise<Result<TaskDefinition<TInput, TOutput, unknown>>> {
    const definition = this.taskRegistry.getTaskDefinition<TInput, TOutput, unknown>(taskType);
    if (!definition.success) {
      return {
        success: false,
        error: new Error(`Task type ${taskType} not found`)
      };
    }
    return definition;
  }

  private createExecutionRecord<TInput, TOutput>(
    taskType: string,
    input: TInput,
    dependencies?: Identifier[]
  ): TaskExecution<TInput, TOutput> {
    return {
      id: uuidv4(),
      taskType,
      status: 'pending' as TaskStatus,
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
    await this.eventBus.publish({
      id: uuidv4(),
      type: eventType,
      timestamp: Date.now(),
      payload: {
        execution,
        taskType: execution.taskType,
        taskId: execution.id
      }
    });
  }

  private async executeWithRetry<TInput, TOutput>(
    definition: TaskDefinition<TInput, TOutput>,
    execution: TaskExecution<TInput, TOutput>,
    cancellationToken: CancellableToken
  ): Promise<TaskExecution<TInput, TOutput>> {
    let lastError: Error | undefined;
    let currentAttempt = execution.attemptNumber;

    while (currentAttempt <= (definition.retry?.maxAttempts || 1)) {
      try {
        cancellationToken.throwIfCancellationRequested();
        
        execution.status = 'running' as TaskStatus;
        execution.startedAt = Date.now();
        execution.attemptNumber = currentAttempt;

        await this.emitTaskEvent('task.started', execution);

        const context: TaskContext<TInput, unknown> = {
          input: execution.input,
          metadata: definition.metadata || {},
          cancellationToken,
          attemptNumber: currentAttempt,
          state: {}
        };

        const result = await definition.handler(context);
        execution.status = 'completed' as TaskStatus;
        execution.completedAt = Date.now();
        execution.result = result;

        await this.emitTaskEvent('task.completed', execution);
        return execution;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        execution.status = 'failed' as TaskStatus;
        execution.error = lastError;
        execution.completedAt = Date.now();

        await this.emitTaskEvent('task.failed', execution);

        if (currentAttempt >= (definition.retry?.maxAttempts || 1)) {
          break;
        }

        const delay = this.calculateRetryDelay(definition.retry, currentAttempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        currentAttempt++;
      }
    }

    return execution;
  }

  private calculateRetryDelay(
    retryPolicy: { backoffStrategy: string; initialDelay: number; maxDelay: number } | undefined,
    attempt: number
  ): number {
    if (!retryPolicy) {
      return 0;
    }

    const { backoffStrategy, initialDelay, maxDelay } = retryPolicy;
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
  }
}

/**
 * Factory function to create a new TaskExecutor
 */
export function createTaskExecutor(taskRegistry: TaskRegistry, eventBus: EventBus): TaskExecutor {
  return new InMemoryTaskExecutor(taskRegistry, eventBus);
} 