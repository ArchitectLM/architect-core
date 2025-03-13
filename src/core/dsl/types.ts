/**
 * Reactive System DSL Types
 * 
 * This module defines the core types for the reactive system DSL.
 */

/**
 * Core types for the Reactive System DSL
 */

/**
 * Task implementation function type
 */
export type TaskImplementationFn<Input = any, Output = any, Context = any> = 
  (input: Input, context: Context) => Promise<Output> | Output;

/**
 * Test case definition
 */
export interface TestCase<Input = any, Output = any, Context = any> {
  name: string;
  description?: string;
  setup: () => { input: Input; context: Context; [key: string]: any };
  execute: (setup: ReturnType<TestCase['setup']>) => Promise<Output>;
  verify: (result: Output, setup: ReturnType<TestCase['setup']>) => void | Promise<void>;
}

/**
 * Retry policy for task execution
 */
export interface RetryPolicy {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts: number;
  
  /**
   * Delay between retry attempts in milliseconds
   * Can be a fixed number or a function that calculates the delay based on the attempt number
   */
  delay: number | ((attempt: number) => number);
  
  /**
   * Optional condition to determine if a retry should be attempted
   * If not provided, all errors will trigger a retry
   */
  retryCondition?: (error: Error) => boolean;
}
