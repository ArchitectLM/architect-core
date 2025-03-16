/**
 * Service integration types
 */

/**
 * Service integration options
 */
export interface ServiceIntegrationOptions {
  defaultRetryPolicy?: RetryPolicy;
  defaultCircuitBreakerOptions?: CircuitBreakerOptions;
}

/**
 * Service integration
 */
export interface ServiceIntegration {
  registerService: <T = any>(id: string, config: ServiceConfig) => Service<T>;
  executeOperation: <T = any, R = any>(
    serviceId: string,
    operationName: string,
    input: T
  ) => Promise<R>;
  registerWebhookHandler: (serviceId: string, config: WebhookHandlerConfig) => WebhookHandler;
  getWebhookHandler: (serviceId: string) => WebhookHandler | undefined;
  processWebhookEvent: (serviceId: string, event: WebhookEvent) => Promise<void>;
}

/**
 * Service types
 */

/**
 * Service type
 */
export enum ServiceType {
  REST = 'rest',
  GRAPHQL = 'graphql',
  GRPC = 'grpc',
  WEBSOCKET = 'websocket',
  CUSTOM = 'custom',
}

/**
 * Service operation
 */
export type ServiceOperation<TInput = any, TOutput = any> = (input: TInput) => Promise<TOutput>;

/**
 * Webhook handler config
 */
export interface WebhookHandlerConfig {
  path: string;
  secret?: string;
  handlers: Record<string, (event: WebhookEvent) => Promise<void>>;
}

/**
 * Webhook handler
 */
export interface WebhookHandler {
  path: string;
  secret?: string;
  handlers: Record<string, (event: WebhookEvent) => Promise<void>>;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
  type: string;
  payload: any;
  headers?: Record<string, string>;
  timestamp: Date;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  backoff: 'fixed' | 'linear' | 'exponential';
  factor?: number;
  maxDelayMs?: number;
}

/**
 * Service config
 */
export interface ServiceConfig {
  type: ServiceType;
  provider: string;
  config: Record<string, any>;
  operations?: Record<string, ServiceOperation>;
  retryPolicy?: RetryPolicy;
  circuitBreakerOptions?: CircuitBreakerOptions;
  webhookHandler?: WebhookHandlerConfig;
}

/**
 * Service
 */
export interface Service<T = any> {
  id: string;
  type: ServiceType;
  provider: string;
  config: Record<string, any>;
  operations: Record<string, ServiceOperation>;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreaker;
  webhookHandler?: WebhookHandler;
  client?: T;
}

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenSuccessThreshold?: number;
  id?: string; // Optional identifier for the circuit breaker
}

/**
 * Circuit breaker state
 */
export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open',
}

/**
 * Circuit breaker
 */
export interface CircuitBreaker {
  state: CircuitBreakerState;
  execute<T>(fn: () => Promise<T>): Promise<T>;
  success(): void;
  failure(): void;
  reset(): void;
}
