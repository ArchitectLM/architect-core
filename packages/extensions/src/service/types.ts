/**
 * Types for service extensions
 */

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /**
   * Number of failures before opening the circuit
   */
  failureThreshold: number;

  /**
   * Time in milliseconds before attempting to close the circuit
   */
  resetTimeoutMs: number;

  /**
   * Number of consecutive successful calls needed to close the circuit
   */
  successThreshold: number;
}

/**
 * Circuit breaker interface
 */
export interface CircuitBreaker {
  /**
   * Current state of the circuit breaker
   */
  state: CircuitBreakerState;

  /**
   * Number of consecutive failures
   */
  failureCount: number;

  /**
   * Timestamp of the last failure
   */
  lastFailureTime: number;

  /**
   * Number of consecutive successes in half-open state
   */
  successCount: number;

  /**
   * Circuit breaker options
   */
  options: CircuitBreakerOptions;

  /**
   * Execute a command with circuit breaker protection
   * @param command Function to execute
   * @param fallback Optional fallback function to execute if the circuit is open
   * @returns Promise with the result of the command or fallback
   */
  execute<T>(command: () => Promise<T>, fallback?: () => Promise<T>): Promise<T>;

  /**
   * Handle successful execution
   */
  onSuccess(): void;

  /**
   * Handle failed execution
   */
  onFailure(): void;

  /**
   * Reset the circuit breaker to its initial state
   */
  reset(): void;
}

/**
 * Service integration options
 */
export interface ServiceIntegrationOptions {
  /**
   * Base URL for the service
   */
  baseUrl: string;

  /**
   * Default headers to include in all requests
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Default timeout in milliseconds
   */
  defaultTimeoutMs?: number;

  /**
   * Circuit breaker options
   */
  circuitBreaker?: CircuitBreakerOptions;

  /**
   * Retry options
   */
  retry?: {
    /**
     * Maximum number of retry attempts
     */
    maxAttempts: number;

    /**
     * Delay between retries in milliseconds
     */
    delayMs: number;

    /**
     * Backoff strategy: 'fixed', 'exponential', or 'linear'
     */
    backoff: 'fixed' | 'exponential' | 'linear';
  };
}

/**
 * Operation configuration for service integration
 */
export interface OperationConfig {
  /**
   * HTTP method
   */
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

  /**
   * Path relative to the base URL
   */
  path: string;

  /**
   * Timeout in milliseconds for this operation
   */
  timeout?: number;

  /**
   * Additional headers for this operation
   */
  headers?: Record<string, string>;

  /**
   * Whether to use circuit breaker for this operation
   */
  useCircuitBreaker?: boolean;

  /**
   * Whether to use retry for this operation
   */
  useRetry?: boolean;
}

/**
 * Service integration interface
 */
export interface ServiceIntegration {
  /**
   * Service integration options
   */
  options: ServiceIntegrationOptions;

  /**
   * Operation configurations
   */
  operations: Record<string, OperationConfig>;

  /**
   * Circuit breaker instance
   */
  circuitBreaker?: CircuitBreaker;

  /**
   * Execute an operation
   * @param operationName Name of the operation to execute
   * @param params Parameters for the operation
   * @returns Promise with the result of the operation
   */
  execute<T = any, P = any>(operationName: string, params?: P): Promise<T>;

  /**
   * Register a new operation
   * @param name Operation name
   * @param config Operation configuration
   */
  registerOperation(name: string, config: OperationConfig): void;
}
