import { Extension } from '../models/extension';
import { TaskExecution, TaskDefinition, TaskRetryPolicy } from '../models/index';
import { EventBus } from '../models/event';
import { ExtensionSystem } from '../models/extension';
import { CancellationToken } from '../models/index';
import { ExtensionContext } from '../models/extension';

/**
 * Backoff strategies for retry attempts
 */
export enum BackoffStrategy {
  /** Use the same delay for each retry */
  CONSTANT = 'constant',
  
  /** Increase delay linearly (e.g., delay * retry number) */
  LINEAR = 'linear',
  
  /** Increase delay exponentially (e.g., delay * 2^retry number) */
  EXPONENTIAL = 'exponential'
}

/**
 * Configuration for the retry plugin
 */
export interface RetryPluginOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  
  /** List of error types that should trigger a retry */
  retryableErrors: any[];
  
  /** Backoff strategy to use between retries */
  backoffStrategy: BackoffStrategy;
  
  /** Initial delay in milliseconds before the first retry */
  initialDelay: number;
  
  /** Maximum delay in milliseconds between retries */
  maxDelay: number;
}

/**
 * Task-specific retry configuration
 */
export interface TaskRetryOptions {
  /** Maximum number of retries for this task */
  maxRetries?: number;
  
  /** Disable retries for this task */
  disabled?: boolean;
  
  /** Error types that should trigger a retry for this task */
  retryableErrors?: any[];
  
  /** Backoff strategy for this task */
  backoffStrategy?: BackoffStrategy;
  
  /** Initial delay for this task */
  initialDelay?: number;
  
  /** Maximum delay for this task */
  maxDelay?: number;
}

/**
 * Statistics about retry attempts
 */
export interface RetryStats {
  /** Total number of retry attempts */
  retryCount: number;
  
  /** Number of successful task executions after retries */
  successAfterRetry: number;
  
  /** Number of task executions that failed after all retries */
  failureAfterRetry: number;
  
  /** Last error that occurred */
  lastError?: Error;
  
  /** Timestamp of last retry */
  lastRetryTime?: number;
}

/**
 * Internal retry context for task execution
 */
interface RetryContext {
  taskId: string;
  attemptNumber: number;
  retryCount: number;
}

export class RetryPlugin implements Extension {
  name = 'retry';
  description = 'Automatically retries failed task executions with configurable backoff';

  private options: RetryPluginOptions;
  private taskOptions: Map<string, TaskRetryOptions> = new Map();
  private stats: Map<string, RetryStats> = new Map();

  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem,
    options: Partial<RetryPluginOptions> = {}
  ) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryableErrors: options.retryableErrors ?? [Error],
      backoffStrategy: options.backoffStrategy ?? BackoffStrategy.EXPONENTIAL,
      initialDelay: options.initialDelay ?? 100,
      maxDelay: options.maxDelay ?? 30000
    };
  }

  getExtension(): Extension {
    return {
      name: this.name,
      description: this.description,
      hooks: this.hooks
    };
  }

  initialize(): void {
    // No initialization needed
  }

  hooks = {
    'task:onError': async (context: ExtensionContext) => {
      if (!context.taskType) {
        throw new Error('Task type is required for retry');
      }

      const taskId = context.taskType;
      const error = context.error;

      // Check if this is already a retry attempt
      const retryContext: RetryContext = context._retry || {
        taskId,
        attemptNumber: 1,
        retryCount: 0
      };

      // Get task-specific options
      const taskOptions = this.getTaskRetryOptions(taskId);

      // If retries are disabled for this task, don't retry
      if (taskOptions.disabled) {
        this.updateStats(taskId, 0, false);
        throw error;
      }

      // Check if error is retryable
      if (!this.isErrorRetryable(error as Error, taskOptions.retryableErrors)) {
        this.updateStats(taskId, retryContext.retryCount, false);
        throw error;
      }

      // Check if we've exceeded max retries
      if (retryContext.attemptNumber > taskOptions.maxRetries!) {
        this.updateStats(taskId, retryContext.retryCount, false);
        throw error;
      }

      // Get retry delay based on backoff strategy
      const delay = this.calculateBackoff(
        retryContext.attemptNumber,
        taskOptions.backoffStrategy!,
        taskOptions.initialDelay!,
        taskOptions.maxDelay!
      );

      // Execute beforeRetry extension point
      const beforeRetryContext = await this.extensionSystem.executeExtensionPoint('task:beforeExecution', {
        taskId,
        taskType: taskId,
        error,
        state: context.state,
        metadata: {
          retryContext,
          delay
        }
      });

      // Schedule retry
      await new Promise(resolve => setTimeout(resolve, delay));

      // Update retry context for next attempt
      const updatedContext = {
        ...context,
        _retry: {
          ...retryContext,
          attemptNumber: retryContext.attemptNumber + 1,
          retryCount: retryContext.retryCount + 1
        }
      };

      // Execute the task again (remove error to prevent infinite loop)
      delete updatedContext.error;
      delete updatedContext.skipExecution;

      // Record the retry in stats
      this.recordRetryAttempt(taskId);

      return updatedContext;
    },

    'task:afterCompletion': async (context: ExtensionContext) => {
      if (!context.taskType) {
        throw new Error('Task type is required for retry');
      }

      const taskId = context.taskType;
      
      // Update stats based on retry result
      this.updateStats(taskId, context._retry?.retryCount || 0, true);

      return context;
    }
  };

  /**
   * Execute a task with retry logic
   */
  async executeWithRetry(
    definition: TaskDefinition,
    execution: TaskExecution,
    input: any,
    cancellationToken: CancellationToken
  ): Promise<TaskExecution> {
    // Set retry options for this task
    if (definition.retry) {
      this.setTaskRetryOptions(execution.type, {
        maxRetries: definition.retry.maxAttempts,
        retryableErrors: definition.retry.retryableErrors,
        backoffStrategy: this.mapBackoffStrategy(definition.retry.backoffStrategy),
        initialDelay: definition.retry.backoffDelay,
        maxDelay: definition.retry.maxDelay
      });
    }

    // Execute task with retry context
    const context = await this.extensionSystem.executeExtensionPoint('task:onError', {
      taskId: execution.id,
      taskType: execution.type,
      data: input,
      state: {},
      metadata: {
        execution,
        cancellationToken
      }
    });

    return context.result as TaskExecution;
  }

  /**
   * Map TaskRetryPolicy backoff strategy to BackoffStrategy enum
   */
  private mapBackoffStrategy(strategy: TaskRetryPolicy['backoffStrategy']): BackoffStrategy {
    switch (strategy) {
      case 'linear':
        return BackoffStrategy.LINEAR;
      case 'exponential':
        return BackoffStrategy.EXPONENTIAL;
      case 'fixed':
        return BackoffStrategy.CONSTANT;
      default:
        return BackoffStrategy.EXPONENTIAL;
    }
  }

  /**
   * Set retry options for a specific task
   */
  setTaskRetryOptions(taskId: string, options: TaskRetryOptions): void {
    this.taskOptions.set(taskId, options);
  }

  /**
   * Get retry statistics for a task
   */
  getRetryStats(taskId: string): RetryStats {
    if (!this.stats.has(taskId)) {
      this.stats.set(taskId, {
        retryCount: 0,
        successAfterRetry: 0,
        failureAfterRetry: 0
      });
    }

    return this.stats.get(taskId)!;
  }

  /**
   * Get effective retry options for a task
   */
  private getTaskRetryOptions(taskId: string): Required<TaskRetryOptions> {
    const taskOptions = this.taskOptions.get(taskId) || {};

    // Merge with default options
    return {
      maxRetries: taskOptions.maxRetries ?? this.options.maxRetries,
      disabled: taskOptions.disabled ?? false,
      retryableErrors: taskOptions.retryableErrors ?? this.options.retryableErrors,
      backoffStrategy: taskOptions.backoffStrategy ?? this.options.backoffStrategy,
      initialDelay: taskOptions.initialDelay ?? this.options.initialDelay,
      maxDelay: taskOptions.maxDelay ?? this.options.maxDelay
    };
  }

  /**
   * Check if an error is retryable
   */
  private isErrorRetryable(error: Error, retryableErrors: any[]): boolean {
    return retryableErrors.some(errorType => error instanceof errorType);
  }

  /**
   * Calculate backoff delay based on strategy
   */
  private calculateBackoff(
    attempt: number,
    strategy: BackoffStrategy,
    initialDelay: number,
    maxDelay: number
  ): number {
    let delay: number;

    switch (strategy) {
      case BackoffStrategy.CONSTANT:
        delay = initialDelay;
        break;

      case BackoffStrategy.LINEAR:
        delay = initialDelay * attempt;
        break;

      case BackoffStrategy.EXPONENTIAL:
        delay = initialDelay * Math.pow(2, attempt - 1);
        break;

      default:
        delay = initialDelay;
    }

    // Cap the delay at maxDelay
    return Math.min(delay, maxDelay);
  }

  /**
   * Record a retry attempt
   */
  private recordRetryAttempt(taskId: string): void {
    const stats = this.getRetryStats(taskId);
    stats.retryCount++;
    stats.lastRetryTime = Date.now();
  }

  /**
   * Update retry statistics
   */
  private updateStats(taskId: string, retryCount: number, success: boolean): void {
    const stats = this.getRetryStats(taskId);
    if (success) {
      stats.successAfterRetry++;
    } else {
      stats.failureAfterRetry++;
    }
  }

  // Utility methods for testing and debugging
  clear(): void {
    this.taskOptions.clear();
    this.stats.clear();
  }
}

export function createRetryPlugin(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem,
  options: RetryPluginOptions
): RetryPlugin {
  return new RetryPlugin(eventBus, extensionSystem, options);
} 