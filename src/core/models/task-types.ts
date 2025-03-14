/**
 * Task Types for ArchitectLM
 */
import { z } from 'zod';

/**
 * Task context provided to task implementations
 */
export interface TaskContext {
  emitEvent: (type: string, payload?: any) => void; // Emit an event
  getState: () => any;                             // Get current state
  logger: {                                        // Logging utilities
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
    debug: (message: string, data?: any) => void;
  };
  metadata?: Record<string, unknown>;              // Additional metadata
}

/**
 * Task implementation function
 */
export type TaskImplementation<TInput = any, TOutput = any> = 
  (input: TInput, context: TaskContext) => Promise<TOutput> | TOutput;

/**
 * Error handler for tasks
 */
export type TaskErrorHandler<TInput = any> = 
  (error: Error, input: TInput, context: TaskContext) => Promise<void> | void;

/**
 * Success handler for tasks
 */
export type TaskSuccessHandler<TInput = any, TOutput = any> = 
  (result: TOutput, input: TInput, context: TaskContext) => Promise<void> | void;

/**
 * Retry policy for tasks
 */
export interface RetryPolicy {
  maxAttempts: number;                            // Maximum number of retry attempts
  backoff: 'fixed' | 'exponential' | 'linear';    // Backoff strategy
  delayMs: number;                                // Base delay in milliseconds
  maxDelayMs?: number;                            // Maximum delay in milliseconds
  jitter?: boolean;                               // Whether to add jitter to delays
}

/**
 * Task definition
 */
export interface TaskDefinition<TInput = any, TOutput = any> {
  id: string;                                     // Unique task identifier
  description?: string;                           // Task description
  implementation: TaskImplementation<TInput, TOutput>; // Task implementation function
  inputSchema?: z.ZodType<TInput>;                // Schema for input validation
  outputSchema?: z.ZodType<TOutput>;              // Schema for output validation
  errorHandler?: TaskErrorHandler<TInput>;        // Error handler
  successHandler?: TaskSuccessHandler<TInput, TOutput>; // Success handler
  timeout?: number;                               // Timeout in milliseconds
  retry?: RetryPolicy;                            // Retry policy
  metadata?: Record<string, unknown>;             // Additional metadata
  
  // LLM-specific metadata to help with generation and understanding
  llmMetadata?: {
    purpose?: string;                             // Purpose of this task
    examples?: Array<{                            // Example inputs and outputs
      input: TInput;
      output: TOutput;
      description?: string;
    }>;
    relatedTasks?: string[];                      // Other tasks this one interacts with
  };
}

/**
 * Task options for executing a task
 */
export interface TaskOptions {
  timeout?: number;                               // Override default timeout
  retry?: Partial<RetryPolicy>;                   // Override default retry policy
  metadata?: Record<string, unknown>;             // Additional metadata
} 