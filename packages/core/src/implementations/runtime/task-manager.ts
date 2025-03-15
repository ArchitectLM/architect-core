/**
 * Task Manager for ArchitectLM
 * 
 * This class is responsible for executing tasks and handling task-related operations.
 */

import { 
  TaskDefinition, 
  TaskOptions, 
  TaskContext,
  TaskImplementation,
  RetryPolicy
} from '../../models';

/**
 * Task middleware interface
 */
export interface TaskMiddleware {
  before?: (taskId: string, input: any, context: TaskContext) => Promise<void> | void;
  after?: (taskId: string, input: any, output: any, context: TaskContext, error?: Error) => Promise<void> | void;
}

/**
 * Extended task options with middleware
 */
export interface ExtendedTaskOptions extends TaskOptions {
  middleware?: TaskMiddleware;
}

/**
 * Task execution result
 */
interface TaskExecutionResult<TOutput = any> {
  success: boolean;
  result?: TOutput;
  error?: Error;
  duration: number;
}

/**
 * Task Manager class
 */
export class TaskManager {
  private tasks: Record<string, TaskDefinition>;
  private services: Record<string, any>;
  
  /**
   * Create a new TaskManager
   */
  constructor(
    tasks: Record<string, TaskDefinition>,
    services: Record<string, any> = {}
  ) {
    this.tasks = tasks;
    this.services = services;
  }
  
  /**
   * Execute a task
   */
  async executeTask<TInput = any, TOutput = any>(
    taskId: string,
    input: TInput,
    context: Partial<TaskContext> = {},
    options: TaskOptions = {}
  ): Promise<TOutput> {
    const taskDefinition = this.tasks[taskId];
    if (!taskDefinition) {
      throw new Error(`Task definition not found: ${taskId}`);
    }
    
    // Validate input if schema is provided
    if (taskDefinition.inputSchema) {
      const result = taskDefinition.inputSchema.safeParse(input);
      if (!result.success) {
        throw new Error(`Invalid input: ${result.error.message}`);
      }
    }
    
    // Create task context
    const taskContext: TaskContext = {
      emitEvent: context.emitEvent || (() => {}),
      getState: context.getState || (() => ({})),
      logger: context.logger || {
        info: console.info,
        warn: console.warn,
        error: console.error,
        debug: console.debug
      },
      metadata: context.metadata || {}
    };
    
    // Apply timeout
    const timeout = options.timeout || taskDefinition.timeout;
    
    // Apply retry policy
    const retry = taskDefinition.retry ? {
      ...taskDefinition.retry,
      ...(options.retry || {})
    } : undefined;
    
    // Get middleware if provided
    const extendedOptions = options as ExtendedTaskOptions;
    const middleware = extendedOptions.middleware;
    
    // Execute the task with retry logic
    let attempts = 0;
    let lastError: Error | null = null;
    
    const maxAttempts = retry?.maxAttempts || 0;
    
    while (attempts <= maxAttempts) {
      try {
        // Execute before middleware if provided
        if (middleware?.before) {
          await middleware.before(taskId, input, taskContext);
        }
        
        // Execute the task
        const result = await this.executeTaskWithTimeout<TInput, TOutput>(
          taskDefinition.implementation as TaskImplementation<TInput, TOutput>,
          input,
          taskContext,
          timeout
        );
        
        // Validate output if schema is provided
        if (taskDefinition.outputSchema) {
          const validationResult = taskDefinition.outputSchema.safeParse(result);
          if (!validationResult.success) {
            throw new Error(`Invalid output: ${validationResult.error.message}`);
          }
        }
        
        // Call success handler if provided
        if (taskDefinition.successHandler) {
          await taskDefinition.successHandler(result, input, taskContext);
        }
        
        // Execute after middleware if provided
        if (middleware?.after) {
          await middleware.after(taskId, input, result, taskContext);
        }
        
        return result;
      } catch (error) {
        lastError = error as Error;
        attempts++;
        
        // Call error handler if provided
        if (taskDefinition.errorHandler) {
          await taskDefinition.errorHandler(error as Error, input, taskContext);
        }
        
        // Execute after middleware with error if provided
        if (middleware?.after) {
          await middleware.after(taskId, input, null, taskContext, error as Error);
        }
        
        // If we've reached the maximum number of attempts, throw the error
        if (attempts > maxAttempts) {
          throw error;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateRetryDelay(attempts, retry);
        
        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // This should never happen, but TypeScript requires a return statement
    throw lastError || new Error('Task execution failed');
  }
  
  /**
   * Execute a task with a timeout
   */
  private async executeTaskWithTimeout<TInput = any, TOutput = any>(
    implementation: TaskImplementation<TInput, TOutput>,
    input: TInput,
    context: TaskContext,
    timeout?: number
  ): Promise<TOutput> {
    if (!timeout) {
      return implementation(input, context);
    }
    
    // Create a promise that resolves with the task result
    const taskPromise = implementation(input, context);
    
    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Task execution timed out after ${timeout}ms`));
      }, timeout);
    });
    
    // Race the task promise against the timeout promise
    return Promise.race([taskPromise, timeoutPromise]);
  }
  
  /**
   * Calculate the delay for a retry attempt
   */
  private calculateRetryDelay(attempt: number, retry?: RetryPolicy): number {
    if (!retry) {
      return 0;
    }
    
    let delay = retry.delayMs;
    
    // Apply backoff strategy
    if (retry.backoff === 'exponential') {
      delay = retry.delayMs * Math.pow(2, attempt - 1);
    } else if (retry.backoff === 'linear') {
      delay = retry.delayMs * attempt;
    }
    
    // Apply maximum delay if specified
    if (retry.maxDelayMs && delay > retry.maxDelayMs) {
      delay = retry.maxDelayMs;
    }
    
    // Apply jitter if specified
    if (retry.jitter) {
      const jitterFactor = 0.5 + Math.random() * 0.5; // Random factor between 0.5 and 1
      delay = Math.floor(delay * jitterFactor);
    }
    
    return delay;
  }
  
  /**
   * Register a service
   */
  registerService(name: string, service: any): void {
    this.services[name] = service;
  }
  
  /**
   * Get a service
   */
  getService<T = any>(name: string): T {
    return this.services[name] as T;
  }
}
