/**
 * Base metadata interface for all DSL components
 */
export interface Metadata {
  name?: string;
  version?: string;
  description?: string;
  purpose?: string;
  domain?: string;
  tags?: string[];
  [key: string]: any;
}

/**
 * JSON Schema definition
 */
export interface Schema {
  type: string;
  required?: string[];
  properties?: Record<string, any>;
  items?: any;
  additionalProperties?: boolean | Record<string, any>;
  oneOf?: any[];
  anyOf?: any[];
  allOf?: any[];
  discriminator?: { propertyName: string; mapping?: Record<string, string> };
  [key: string]: any;
}

/**
 * Function definition
 */
export interface Function {
  meta: Metadata;
  implementation: (...args: any[]) => any;
}

/**
 * Backoff strategy for retry policies
 */
export enum BackoffStrategy {
  FIXED = 'fixed',
  EXPONENTIAL = 'exponential',
  LINEAR = 'linear',
  FIBONACCI = 'fibonacci',
  DECORRELATED_JITTER = 'decorrelated-jitter'
}

/**
 * Rate limiting strategy
 */
export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed-window',
  SLIDING_WINDOW = 'sliding-window',
  TOKEN_BUCKET = 'token-bucket'
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenSuccessThreshold?: number;
}

/**
 * Enhanced circuit breaker configuration with more advanced options
 */
export interface EnhancedCircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenSuccessThreshold?: number;
  isFailure?: string; // Reference to a predicate function
  onStateChange?: string; // Reference to a callback function
  onReset?: string; // Reference to a callback function
  onSuccess?: string; // Reference to a callback function
  onFailure?: string; // Reference to a callback function
}

/**
 * Basic retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  backoff: "fixed" | "exponential" | "linear";
  initialDelay?: number;
  maxDelay?: number;
}

/**
 * Enhanced retry configuration with advanced backoff strategies
 */
export interface EnhancedRetryConfig {
  maxAttempts: number;
  strategy: BackoffStrategy;
  initialDelay: number;
  maxDelay: number;
  factor?: number; // For LINEAR strategy
  onRetry?: string; // Reference to a function to call on retry
  shouldRetry?: string; // Reference to a predicate function
}

/**
 * Bulkhead configuration for limiting concurrency
 */
export interface BulkheadConfig {
  maxConcurrent: number;
  maxQueue?: number;
  timeout?: number;
}

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  strategy: RateLimitStrategy;
  limit: number;
  window?: number; // Time window in ms
  refillRate?: number; // For token bucket
  refillInterval?: number; // For token bucket
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  ttl: number; // Time to live in ms
  maxSize?: number; // Maximum number of items
  staleWhileRevalidate?: boolean;
}

/**
 * Dead letter queue configuration
 */
export interface DeadLetterQueueConfig {
  maxRetries?: number;
  retryDelay?: number;
  errorHandler?: string; // Reference to an error handler function
}

/**
 * Distributed tracing configuration
 */
export interface DistributedTracingConfig {
  serviceName: string;
  sampleRate?: number;
  propagationHeaders?: string[];
  exporterEndpoint?: string;
  tags?: Record<string, string>;
}

/**
 * Error classification configuration
 */
export interface ErrorClassificationConfig {
  retryableErrors?: string[]; // List of error types that are retryable
  fatalErrors?: string[]; // List of error types that should not be retried
  timeoutErrors?: string[]; // List of error types that are timeout-related
  networkErrors?: string[]; // List of error types that are network-related
  classifier?: string; // Reference to a classifier function
}

/**
 * Contextual policy configuration
 */
export interface ContextualPolicyConfig {
  policies: Record<string, ResilienceConfig>;
  selector: string; // Reference to a selector function
}

/**
 * Event transformation configuration
 */
export interface EventTransformationConfig {
  transformers: Record<string, string>; // Map of event types to transformer function references
  globalTransformer?: string; // Reference to a global transformer function
}

/**
 * Monitoring configuration
 */
export interface MonitoringConfig {
  metrics?: {
    enabled: boolean;
    prefix?: string;
    tags?: Record<string, string>;
  };
  logging?: {
    enabled: boolean;
    level?: string;
    format?: string;
  };
  alerting?: {
    enabled: boolean;
    thresholds?: Record<string, number>;
    handlers?: string[]; // References to alert handler functions
  };
}

/**
 * Resilience configuration
 */
export interface ResilienceConfig {
  circuitBreaker?: CircuitBreakerConfig;
  enhancedCircuitBreaker?: EnhancedCircuitBreakerConfig;
  retry?: RetryConfig;
  enhancedRetry?: EnhancedRetryConfig;
  bulkhead?: BulkheadConfig;
  rateLimit?: RateLimiterConfig;
  cache?: CacheConfig;
  deadLetterQueue?: DeadLetterQueueConfig;
  distributedTracing?: DistributedTracingConfig;
  errorClassification?: ErrorClassificationConfig;
  contextualPolicy?: ContextualPolicyConfig;
  eventTransformation?: EventTransformationConfig;
  monitoring?: MonitoringConfig;
  timeout?: number;
}

/**
 * Command definition
 */
export interface Command {
  meta: Metadata;
  input: string;
  output: string;
  implementation: (...args: any[]) => any;
  resilience?: ResilienceConfig;
}

/**
 * Pipeline step definition
 */
export interface PipelineStep {
  name: string;
  function: string;
  input?: string;
  output?: string;
  condition?: string;
  resilience?: ResilienceConfig;
}

/**
 * Error handling configuration for pipelines
 */
export interface ErrorHandling {
  fallback?: string;
  retryable?: string[];
  maxRetries?: number;
  deadLetterQueue?: string;
}

/**
 * Pipeline definition
 */
export interface Pipeline {
  description?: string;
  input: string;
  output: string;
  steps: PipelineStep[];
  errorHandling?: ErrorHandling;
  resilience?: ResilienceConfig;
}

/**
 * Extension point definition
 */
export interface ExtensionPoint {
  description?: string;
  parameters?: string[];
}

/**
 * Extension hook definition
 */
export interface ExtensionHook {
  meta?: Metadata;
  implementation: (...args: any[]) => any;
}

/**
 * Extension definition
 */
export interface Extension {
  meta: Metadata;
  hooks: Record<string, ExtensionHook>;
  configuration?: Record<string, any>;
}

/**
 * Complete DSL configuration
 */
export interface DSLConfig {
  meta: Metadata;
  schemas: Record<string, Schema>;
  functions: Record<string, Function>;
  commands: Record<string, Command>;
  pipelines: Record<string, Pipeline>;
  extensionPoints: Record<string, ExtensionPoint>;
  extensions?: Record<string, Extension>;
}
