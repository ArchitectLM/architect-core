/**
 * DSL Types
 * 
 * This is a stub for the types from the DSL package.
 */

export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  initialDelayMs: number;
  maxDelayMs?: number;
  factor?: number;
}
