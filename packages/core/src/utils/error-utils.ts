/**
 * Error utilities for the core system
 */

/**
 * Domain-specific error class
 * Used for business logic and domain-related errors
 */
export class DomainError extends Error {
  /** Error code */
  public code?: string;
  
  /** Additional context */
  public context?: Record<string, unknown>;
  
  /**
   * Create a new DomainError
   * @param message Error message
   * @param code Optional error code
   * @param context Optional context information
   */
  constructor(message: string, code?: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.context = context;
  }
}

/**
 * Create a standardized error result object
 * @param error The error object or message
 * @returns A standardized result with error
 */
export function createErrorResult<T>(error: Error | string): Result<T> {
  return {
    success: false,
    error: typeof error === 'string' ? new DomainError(error) : error
  };
}

/**
 * Create a standardized success result object
 * @param value The value to return
 * @returns A standardized result with value
 */
export function createSuccessResult<T>(value: T): Result<T> {
  return {
    success: true,
    value
  };
}

/**
 * Result type for operations that can succeed or fail
 */
export interface Result<T> {
  /** Whether the operation was successful */
  success: boolean;
  
  /** The result value if success is true */
  value?: T;
  
  /** The error if success is false */
  error?: Error;
}

/**
 * Try to execute a function and wrap the result in a Result object
 * @param fn The function to execute
 * @returns A Result object
 */
export function tryExecute<T>(fn: () => T): Result<T> {
  try {
    const value = fn();
    return createSuccessResult(value);
  } catch (error) {
    return createErrorResult<T>(
      error instanceof Error ? error : new Error(String(error))
    );
  }
}

/**
 * Try to execute an async function and wrap the result in a Result object
 * @param fn The async function to execute
 * @returns A Promise resolving to a Result object
 */
export async function tryExecuteAsync<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    const value = await fn();
    return createSuccessResult(value);
  } catch (error) {
    return createErrorResult<T>(
      error instanceof Error ? error : new Error(String(error))
    );
  }
} 