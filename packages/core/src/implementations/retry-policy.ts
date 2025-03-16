/**
 * Retry Policy Implementation
 *
 * This file implements the retry policy pattern for resilience.
 */

import { RetryOptions, RetryPolicy } from '../models/index.js';

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  backoff: 'exponential',
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
};

/**
 * RetryPolicy implementation for resilience
 */
export class DefaultRetryPolicy implements RetryPolicy {
  constructor(
    private readonly name: string,
    private readonly options: RetryOptions = DEFAULT_OPTIONS
  ) {}

  /**
   * Execute a function with retry policy
   * @param fn The function to execute
   * @param shouldRetry Optional predicate to determine if an error should be retried
   */
  async execute<T>(fn: () => Promise<T>, shouldRetry?: (error: Error) => boolean): Promise<T> {
    let lastError: Error | undefined;
    let attemptsMade = 0;

    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        // Execute the function
        return await fn();
      } catch (error) {
        // Store the error
        lastError = error as Error;
        attemptsMade = attempt;

        // If this is the last attempt, don't delay
        if (attempt === this.options.maxAttempts) {
          break;
        }

        // Check if we should retry this error
        if (shouldRetry && !shouldRetry(lastError)) {
          // Don't retry if the predicate returns false
          break;
        }

        // Calculate delay based on backoff strategy
        const delay = this.calculateDelay(attempt);

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // If we get here, all attempts failed
    throw new Error(
      `Retry policy '${this.name}' failed after ${attemptsMade} attempts: ${lastError?.message}`
    );
  }

  /**
   * Calculate delay based on backoff strategy
   */
  private calculateDelay(attempt: number): number {
    const initialDelay = this.options.initialDelay || 1000;
    const maxDelay = this.options.maxDelay || 30000;

    let delay: number;

    if (this.options.backoff === 'exponential') {
      // Exponential backoff: initialDelay * 2^(attempt-1)
      delay = initialDelay * Math.pow(2, attempt - 1);
    } else {
      // Fixed backoff: initialDelay
      delay = initialDelay;
    }

    // Add some jitter to prevent thundering herd
    const jitter = Math.random() * 0.2 - 0.1; // ±10% jitter
    delay = delay * (1 + jitter);

    // Cap at max delay
    return Math.min(delay, maxDelay);
  }
}
