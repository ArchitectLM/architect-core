import { Extension } from '../models/extension.js';

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

/**
 * Plugin that automatically retries failed task executions
 */
export class RetryPlugin implements Extension {
  name = 'retry-plugin';
  description = 'Automatically retries failed task executions with configurable backoff';
  
  private options: RetryPluginOptions;
  private taskOptions: Map<string, TaskRetryOptions> = new Map();
  private stats: Map<string, RetryStats> = new Map();
  
  constructor(options: RetryPluginOptions) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      retryableErrors: options.retryableErrors || [Error],
      backoffStrategy: options.backoffStrategy || BackoffStrategy.EXPONENTIAL,
      initialDelay: options.initialDelay || 100,
      maxDelay: options.maxDelay || 30000
    };
  }
  
  hooks = {
    'task:onError': async (context: any) => {
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
      if (!this.isErrorRetryable(error, taskOptions.retryableErrors)) {
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
    
    'task:afterExecution': async (context: any) => {
      // If this was a retry attempt and it succeeded, update stats
      if (context._retry) {
        this.updateStats(context.taskType, context._retry.retryCount, true);
      }
      
      return context;
    }
  };
  
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
    
    // Ensure delay doesn't exceed maximum
    return Math.min(delay, maxDelay);
  }
  
  /**
   * Record a retry attempt
   */
  private recordRetryAttempt(taskId: string): void {
    const stats = this.getRetryStats(taskId);
    stats.lastRetryTime = Date.now();
  }
  
  /**
   * Update task retry statistics
   */
  private updateStats(taskId: string, retryCount: number, success: boolean): void {
    const stats = this.getRetryStats(taskId);
    
    // Update retry count (in case we've bypassed the recordRetryAttempt)
    stats.retryCount = Math.max(stats.retryCount, retryCount);
    
    // Update success/failure counts
    if (retryCount > 0) {
      if (success) {
        stats.successAfterRetry++;
      } else {
        stats.failureAfterRetry++;
      }
    }
  }
}

/**
 * Create a new retry plugin
 */
export function createRetryPlugin(options: RetryPluginOptions): Extension {
  return new RetryPlugin(options);
} 