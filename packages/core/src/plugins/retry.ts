import { Extension } from '../models/extension-system';
import { TaskExecution, TaskDefinition, TaskRetryPolicy } from '../models/index';
import { EventBus } from '../models/event-system';
import { ExtensionSystem } from '../models/extension-system';
import { CancellationToken } from '../models/index';
import { ExtensionContext } from '../models/extension-system';
import { ExtensionHookRegistration } from '../models/extension-system';
import { ExtensionPointName } from '../models/extension-system';
import { Result } from '../models/core-types';

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
  id = 'retry';
  name = 'retry';
  description = 'Automatically retries failed task executions with configurable backoff';
  dependencies: string[] = [];
  
  private options: RetryPluginOptions;
  private taskOptions: Map<string, TaskRetryOptions> = new Map();
  private stats: Map<string, RetryStats> = new Map();
  
  // Add hooks property for tests to access
  hooks: Record<string, any> = {};
  
  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem,
    options: Partial<RetryPluginOptions> = {}
  ) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryableErrors: options.retryableErrors ?? [],
      backoffStrategy: options.backoffStrategy ?? BackoffStrategy.EXPONENTIAL,
      initialDelay: options.initialDelay ?? 1000,
      maxDelay: options.maxDelay ?? 30000
    };

    // Initialize hooks for tests to access
    this.hooks = {
      'task:onError': async (context: any) => {
        if (!context.taskType) {
          throw new Error('Task type is required for retry');
        }
  
        const taskId = context.taskType as string;
        const error = context.error;
  
        // Check if this is already a retry attempt
        const retryContext = context._retry || {
          taskId,
          attemptNumber: 1,
          retryCount: 0
        };
  
        // Get retry options for this task
        const retryOptions = this.getTaskRetryOptions(taskId);
  
        // Check if we've already hit the retry limit
        if (retryContext.attemptNumber > retryOptions.maxRetries) {
          // We've already retried too many times, don't retry again
          this.updateStats(taskId, retryContext.retryCount, false);
          throw new Error(`Max retries (${retryOptions.maxRetries}) exceeded for task ${taskId}`);
        }
  
        // Check if retries are disabled for this task
        if (retryOptions.disabled) {
          throw new Error(`Retries disabled for task ${taskId}`);
        }
  
        // Check if the error is retryable
        if (!this.isErrorRetryable(error as Error, retryOptions.retryableErrors)) {
          throw new Error(`Non-retryable error for task ${taskId}: ${error}`);
        }
  
        // Calculate backoff delay
        const delay = this.calculateBackoff(
          retryContext.attemptNumber,
          retryOptions.backoffStrategy,
          retryOptions.initialDelay,
          retryOptions.maxDelay
        );
  
        // Wait for the backoff delay
        await new Promise(resolve => setTimeout(resolve, delay));
  
        // Record the retry in stats
        this.recordRetryAttempt(taskId);
  
        // Return updated context for next attempt
        return {
          ...context,
          _retry: {
            ...retryContext,
            attemptNumber: retryContext.attemptNumber + 1,
            retryCount: retryContext.retryCount + 1
          }
        };
      },
      'task:afterCompletion': async (context: any) => {
        if (!context.taskType) {
          throw new Error('Task type is required for retry');
        }
  
        const taskId = context.taskType as string;
        
        // Update stats based on retry result
        this.updateStats(taskId, context._retry?.retryCount || 0, true);
  
        return context;
      }
    };
  }
  
  // Extension interface methods
  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    return [
      {
        pointName: 'task:onError' as ExtensionPointName,
        hook: async (params: unknown) => {
          const context = params as any;
          if (!context.data?.taskType) {
            throw new Error('Task type is required for retry');
          }
  
          const taskId = context.data.taskType as string;
          const error = context.data.error;
  
          // Check if this is already a retry attempt
          const retryContext = context.data?._retry || {
            taskId,
            attemptNumber: 1,
            retryCount: 0
          };
  
          // Get retry options for this task
          const retryOptions = this.getTaskRetryOptions(taskId);
  
          // Check if we've already hit the retry limit
          if (retryContext.attemptNumber > retryOptions.maxRetries) {
            // We've already retried too many times, don't retry again
            this.updateStats(taskId, retryContext.retryCount, false);
            return {
              success: false,
              error: new Error(`Max retries (${retryOptions.maxRetries}) exceeded for task ${taskId}`)
            };
          }
  
          // Check if retries are disabled for this task
          if (retryOptions.disabled) {
            return {
              success: false,
              error: new Error(`Retries disabled for task ${taskId}`)
            };
          }
  
          // Check if the error is retryable
          if (!this.isErrorRetryable(error as Error, retryOptions.retryableErrors)) {
            return {
              success: false,
              error: new Error(`Non-retryable error for task ${taskId}: ${error}`)
            };
          }
  
          // Calculate backoff delay
          const delay = this.calculateBackoff(
            retryContext.attemptNumber,
            retryOptions.backoffStrategy,
            retryOptions.initialDelay,
            retryOptions.maxDelay
          );
  
          // Wait for the backoff delay
          await new Promise(resolve => setTimeout(resolve, delay));
  
          // Update retry context for next attempt
          const updatedContext = {
            ...context,
            data: {
              ...context.data,
              _retry: {
                ...retryContext,
                attemptNumber: retryContext.attemptNumber + 1,
                retryCount: retryContext.retryCount + 1
              }
            }
          };
  
          // Record the retry in stats
          this.recordRetryAttempt(taskId);
  
          return { success: true, value: updatedContext };
        }
      },
      {
        pointName: 'task:afterCompletion' as ExtensionPointName,
        hook: async (params: unknown) => {
          const context = params as any;
          if (!context.data?.taskType) {
            throw new Error('Task type is required for retry');
          }
  
          const taskId = context.data.taskType as string;
          
          // Update stats based on retry result
          if (context.data?._retry) {
            this.updateStats(taskId, context.data._retry.retryCount || 0, true);
          }
  
          return { success: true, value: context };
        }
      }
    ];
  }
  
  getExtension(): Extension {
    return this;
  }
  
  getVersion(): string {
    return '1.0.0';
  }
  
  getCapabilities(): string[] {
    return ['retry', 'task-resilience'];
  }

  /**
   * Execute a task with retry logic
   */
  async executeWithRetry(
    definition: TaskDefinition,
    execution: TaskExecution,
    input: any,
    cancellationToken: CancellationToken
  ): Promise<TaskExecution> {
    // Set retry options for this task if they exist
    const taskType = (execution as any).type || (definition as any).type;
    
    // Check if definition has retry options
    if ((definition as any).retry) {
      this.setTaskRetryOptions(taskType, {
        maxRetries: (definition as any).retry.maxAttempts,
        retryableErrors: (definition as any).retry.retryableErrors,
        backoffStrategy: this.mapBackoffStrategy((definition as any).retry.backoffStrategy),
        initialDelay: (definition as any).retry.backoffDelay,
        maxDelay: (definition as any).retry.maxDelay
      });
    }

    // Execute task with retry context
    const context = await this.extensionSystem.executeExtensionPoint('task:onError', {
      taskId: execution.id,
      taskType: taskType,
      data: input,
      state: {},
      metadata: {
        execution,
        cancellationToken
      }
    });

    // Return the execution from the context value or the original execution if not found
    return (context as any).value?.execution || execution;
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
  options: Partial<RetryPluginOptions> = { retryableErrors: [Error] }
): RetryPlugin {
  // Ensure retryableErrors has a default value
  const fullOptions = {
    maxRetries: options.maxRetries ?? 3,
    retryableErrors: options.retryableErrors ?? [Error],
    backoffStrategy: options.backoffStrategy ?? BackoffStrategy.EXPONENTIAL,
    initialDelay: options.initialDelay ?? 1000,
    maxDelay: options.maxDelay ?? 30000
  };
  
  return new RetryPlugin(eventBus, extensionSystem, fullOptions);
} 