/**
 * Extension interfaces for ArchitectLM
 * 
 * This file defines the interfaces for optional extensions that can be added to the core system:
 * - Saga Coordinator: For distributed transactions
 * - Scheduler: For time-based operations
 * - Supervisor: For resilience and automatic recovery
 * - Load Manager: For back-pressure and circuit breaking
 */

import { Event, ProcessInstance, TaskImplementation, Runtime } from '../types';

/**
 * Saga Coordinator Extension
 * 
 * Manages distributed transactions across multiple processes and services.
 * Ensures consistency through compensating actions when failures occur.
 */
export interface SagaCoordinator {
  /**
   * Define a new saga with steps and compensations
   */
  defineSaga: (config: SagaDefinition) => SagaDefinition;
  
  /**
   * Start a new saga instance
   */
  startSaga: (sagaId: string, input: any) => Promise<SagaInstance>;
  
  /**
   * Get the status of a saga instance
   */
  getSagaStatus: (instanceId: string) => Promise<SagaInstance | undefined>;
  
  /**
   * Manually compensate a saga (rollback)
   */
  compensateSaga: (instanceId: string, reason?: string) => Promise<void>;
  
  /**
   * Register a handler for saga events
   */
  onSagaEvent: (eventType: SagaEventType, handler: (event: SagaEvent) => void) => void;
}

/**
 * Saga definition
 */
export interface SagaDefinition {
  id: string;
  name: string;
  description?: string;
  steps: SagaStep[];
  timeout?: number; // Timeout in milliseconds
  metadata?: Record<string, any>;
}

/**
 * Saga step definition
 */
export interface SagaStep {
  id: string;
  name: string;
  compensationAction?: string;
  metadata?: Record<string, any>;
}

/**
 * Saga instance representing a running saga
 */
export interface SagaInstance {
  id: string;
  sagaId: string;
  status: SagaStatus;
  steps: SagaStepExecution[];
  startedAt: Date;
  completedAt?: Date;
  context: any;
  error?: any;
}

/**
 * Saga step execution
 */
export interface SagaStepExecution {
  id: string;
  stepId: string;
  status: SagaStepStatus;
  startedAt?: Date;
  completedAt?: Date;
  result?: any;
  error?: any;
}

/**
 * Saga status
 */
export enum SagaStatus {
  CREATED = 'created',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated'
}

/**
 * Saga step status
 */
export enum SagaStepStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated'
}

/**
 * Saga event types
 */
export enum SagaEventType {
  SAGA_STARTED = 'saga-started',
  SAGA_COMPLETED = 'saga-completed',
  SAGA_FAILED = 'saga-failed',
  STEP_STARTED = 'step-started',
  STEP_COMPLETED = 'step-completed',
  STEP_FAILED = 'step-failed',
  COMPENSATION_STARTED = 'compensation-started',
  COMPENSATION_COMPLETED = 'compensation-completed',
  COMPENSATION_FAILED = 'compensation-failed'
}

/**
 * Saga event
 */
export interface SagaEvent {
  id: string;
  type: SagaEventType;
  timestamp: Date;
  sagaId: string;
  instanceId: string;
  stepId?: string;
  payload: any;
}

/**
 * Retry policy for saga steps
 */
export interface RetryPolicy {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential' | 'linear';
  initialDelayMs: number;
  maxDelayMs?: number;
  factor?: number; // For exponential backoff
}

/**
 * Scheduler Extension
 * 
 * Manages time-based operations and recurring tasks.
 */
export interface Scheduler {
  /**
   * Schedule a one-time task
   */
  scheduleTask: (config: ScheduledTaskConfig) => Promise<string>;
  
  /**
   * Schedule a recurring task
   */
  scheduleRecurringTask: (config: RecurringTaskConfig) => Promise<string>;
  
  /**
   * Cancel a scheduled task
   */
  cancelTask: (taskId: string) => Promise<boolean>;
  
  /**
   * Pause a scheduled task
   */
  pauseTask: (taskId: string) => Promise<boolean>;
  
  /**
   * Resume a paused task
   */
  resumeTask: (taskId: string) => Promise<boolean>;
  
  /**
   * Get all scheduled tasks
   */
  getTasks: (filter?: ScheduledTaskFilter) => Promise<ScheduledTask[]>;
  
  /**
   * Get a specific scheduled task
   */
  getTask: (taskId: string) => Promise<ScheduledTask | undefined>;
}

/**
 * Scheduled task configuration
 */
export interface ScheduledTaskConfig {
  taskId: string; // ID of the task to execute
  input?: any; // Input for the task
  executeAt: Date | number; // Date or timestamp when to execute
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Recurring task configuration
 */
export interface RecurringTaskConfig extends ScheduledTaskConfig {
  pattern: string; // Cron pattern or interval expression
  endAt?: Date | number; // When to stop recurring (optional)
  maxExecutions?: number; // Maximum number of executions (optional)
}

/**
 * Scheduled task instance
 */
export interface ScheduledTask {
  id: string;
  taskId: string;
  status: ScheduledTaskStatus;
  executeAt: Date;
  executedAt?: Date;
  nextExecutionAt?: Date; // For recurring tasks
  pattern?: string; // For recurring tasks
  remainingExecutions?: number; // For recurring tasks with maxExecutions
  input?: any;
  result?: any;
  error?: any;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * Scheduled task status
 */
export enum ScheduledTaskStatus {
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PAUSED = 'paused'
}

/**
 * Filter for scheduled tasks
 */
export interface ScheduledTaskFilter {
  status?: ScheduledTaskStatus | ScheduledTaskStatus[];
  taskId?: string | string[];
  from?: Date | number;
  to?: Date | number;
  recurring?: boolean;
}

/**
 * Supervisor Extension
 * 
 * Monitors processes and tasks for failures and provides automatic recovery.
 */
export interface Supervisor {
  /**
   * Register a process type for supervision
   */
  superviseProcess: (config: ProcessSupervisionConfig) => void;
  
  /**
   * Register a task type for supervision
   */
  superviseTask: (config: TaskSupervisionConfig) => void;
  
  /**
   * Get supervision status for a process instance
   */
  getProcessSupervisionStatus: (instanceId: string) => Promise<SupervisionStatus | undefined>;
  
  /**
   * Get supervision status for a task execution
   */
  getTaskSupervisionStatus: (executionId: string) => Promise<SupervisionStatus | undefined>;
  
  /**
   * Manually trigger recovery for a process
   */
  recoverProcess: (instanceId: string) => Promise<ProcessInstance>;
  
  /**
   * Manually trigger recovery for a task
   */
  recoverTask: (executionId: string) => Promise<any>;
  
  /**
   * Register a handler for supervision events
   */
  onSupervisionEvent: (eventType: SupervisionEventType, handler: (event: SupervisionEvent) => void) => void;
}

/**
 * Process supervision configuration
 */
export interface ProcessSupervisionConfig {
  processId: string;
  maxRecoveryAttempts?: number;
  checkInterval?: number; // Milliseconds
  recoveryStrategy?: 'retry-last-action' | 'restart' | 'custom';
  customRecoveryAction?: string;
}

/**
 * Task supervision configuration
 */
export interface TaskSupervisionConfig {
  taskId: string;
  maxRecoveryAttempts?: number;
  checkInterval?: number;
  recoveryStrategy?: 'retry' | 'custom';
  customRecoveryAction?: string;
}

/**
 * Recovery strategy
 */
export enum RecoveryStrategy {
  RETRY = 'RETRY', // Simply retry the operation
  RESET = 'RESET', // Reset to initial state
  COMPENSATE = 'COMPENSATE', // Trigger compensation
  CUSTOM = 'CUSTOM' // Use custom recovery function
}

/**
 * Supervision status
 */
export interface SupervisionStatus {
  id: string;
  targetId: string; // Process instance ID or task execution ID
  targetType: 'process' | 'task';
  status: SupervisionStatusType;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  lastCheckAt: Date;
  lastRecoveryAt?: Date;
  error?: any;
}

/**
 * Supervision status type
 */
export enum SupervisionStatusType {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  RECOVERING = 'recovering',
  RECOVERED = 'recovered',
  FAILED = 'failed'
}

/**
 * Supervision event types
 */
export enum SupervisionEventType {
  UNHEALTHY_DETECTED = 'unhealthy-detected',
  RECOVERY_STARTED = 'recovery-started',
  RECOVERY_SUCCEEDED = 'recovery-succeeded',
  RECOVERY_FAILED = 'recovery-failed',
  MAX_RECOVERY_ATTEMPTS_REACHED = 'max-recovery-attempts-reached'
}

/**
 * Supervision event
 */
export interface SupervisionEvent {
  id: string;
  type: SupervisionEventType;
  timestamp: Date;
  targetId: string;
  targetType: 'process' | 'task';
  status: SupervisionStatusType;
  recoveryAttempts: number;
  maxRecoveryAttempts: number;
  payload: any;
}

/**
 * Load Manager Extension
 * 
 * Manages system load and provides back-pressure mechanisms.
 */
export interface LoadManager {
  /**
   * Register a resource for load management
   */
  registerResource: (config: ResourceConfig) => void;
  
  /**
   * Check if a resource is available for use
   */
  isResourceAvailable: (resourceId: string) => Promise<boolean>;
  
  /**
   * Acquire a resource (increments usage count)
   */
  acquireResource: (resourceId: string, units?: number) => Promise<boolean>;
  
  /**
   * Release a resource (decrements usage count)
   */
  releaseResource: (resourceId: string, units?: number) => Promise<void>;
  
  /**
   * Get the current status of a resource
   */
  getResourceStatus: (resourceId: string) => Promise<ResourceStatus | undefined>;
  
  /**
   * Get the status of all resources
   */
  getAllResourceStatuses: () => Promise<Record<string, ResourceStatus>>;
  
  /**
   * Register a handler for load management events
   */
  onLoadEvent: (eventType: LoadEventType, handler: (event: LoadEvent) => void) => void;
}

/**
 * Resource configuration
 */
export interface ResourceConfig {
  id: string;
  type: ResourceType;
  capacity: number;
  thresholds: {
    warning?: number; // Percentage (0-100)
    critical?: number; // Percentage (0-100)
    circuit?: number; // Percentage at which circuit breaks (0-100)
  };
  resetTimeout?: number; // Milliseconds to wait before resetting circuit
  description?: string;
}

/**
 * Resource type
 */
export enum ResourceType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk',
  NETWORK = 'network',
  DATABASE = 'database',
  API = 'api',
  CUSTOM = 'custom'
}

/**
 * Resource status
 */
export interface ResourceStatus {
  id: string;
  type: ResourceType;
  capacity: number;
  used: number;
  available: number;
  usagePercentage: number;
  status: CircuitStatus;
  lastStatusChangeAt: Date;
  resetAt?: Date; // When circuit will reset (if broken)
}

/**
 * Circuit status
 */
export enum CircuitStatus {
  CLOSED = 'closed',
  WARNING = 'warning',
  CRITICAL = 'critical',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

/**
 * Load event types
 */
export enum LoadEventType {
  THRESHOLD_WARNING = 'threshold-warning',
  THRESHOLD_CRITICAL = 'threshold-critical',
  CIRCUIT_OPEN = 'circuit-open',
  CIRCUIT_HALF_OPEN = 'circuit-half-open',
  CIRCUIT_CLOSED = 'circuit-closed'
}

/**
 * Load event
 */
export interface LoadEvent {
  id: string;
  type: LoadEventType;
  timestamp: Date;
  resourceId: string;
  resourceType: ResourceType;
  capacity: number;
  used: number;
  available: number;
  usagePercentage: number;
  status: CircuitStatus;
  payload: any;
}

/**
 * Extension Configuration
 */
export interface ExtensionConfig {
  enabled: boolean;
}

/**
 * Service Integration Extension
 * 
 * Provides integration with external services like payment processors,
 * shipping providers, tax calculators, etc.
 */
export interface ServiceIntegrationExtension {
  /**
   * Register a service
   */
  registerService: <T = any>(id: string, config: ServiceConfig) => Service<T>;
  
  /**
   * Execute an operation on a service
   */
  executeOperation: <T = any, R = any>(serviceId: string, operationName: string, input: T) => Promise<R>;
  
  /**
   * Register a webhook handler for a service
   */
  registerWebhookHandler: (serviceId: string, config: WebhookHandlerConfig) => WebhookHandler;
  
  /**
   * Get a webhook handler for a service
   */
  getWebhookHandler: (serviceId: string) => WebhookHandler | undefined;
  
  /**
   * Process a webhook event
   */
  processWebhookEvent: (serviceId: string, event: WebhookEvent) => Promise<void>;
}

/**
 * Service configuration
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
 * Service type
 */
export enum ServiceType {
  PAYMENT_PROCESSOR = 'payment-processor',
  SHIPPING_PROVIDER = 'shipping-provider',
  TAX_CALCULATOR = 'tax-calculator',
  INVENTORY_MANAGER = 'inventory-manager',
  EMAIL_PROVIDER = 'email-provider',
  SMS_PROVIDER = 'sms-provider',
  ANALYTICS_PROVIDER = 'analytics-provider',
  CUSTOM = 'custom'
}

/**
 * Service operation
 */
export type ServiceOperation<T = any, R = any> = (input: T) => Promise<R>;

/**
 * Service instance
 */
export interface Service<T = any> {
  id: string;
  type: ServiceType | string;
  provider: string;
  config: Record<string, any>;
  operations: Record<string, ServiceOperation>;
  retryPolicy?: RetryPolicy;
  circuitBreaker?: CircuitBreaker;
  webhookHandler?: WebhookHandler;
}

/**
 * Webhook handler configuration
 */
export interface WebhookHandlerConfig {
  path: string;
  secret?: string;
  handlers: Record<string, WebhookEventHandler>;
}

/**
 * Webhook handler
 */
export interface WebhookHandler {
  path: string;
  secret?: string;
  handlers: Record<string, WebhookEventHandler>;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
  type: string;
  data: any;
}

/**
 * Webhook event handler
 */
export type WebhookEventHandler = (event: WebhookEvent) => void | Promise<void>;

/**
 * Circuit Breaker State
 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

/**
 * Circuit Breaker Options
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
   * Number of consecutive successful calls required to close the circuit
   */
  successThreshold: number;
}

/**
 * Circuit Breaker Interface
 */
export interface CircuitBreaker {
  /**
   * Execute a function with circuit breaker protection
   */
  execute<T>(fn: () => Promise<T>): Promise<T>;
  
  /**
   * Get the current state of the circuit breaker
   */
  getState(): CircuitBreakerState;
  
  /**
   * Reset the circuit breaker to closed state
   */
  reset(): void;
  
  /**
   * Handle successful execution
   */
  onSuccess(): void;
  
  /**
   * Handle failed execution
   */
  onFailure(): void;
}

/**
 * Service Integration Configuration
 */
export interface ServiceIntegrationConfig {
  enabled: boolean;
  defaultRetryPolicy?: RetryPolicy;
  defaultCircuitBreakerOptions?: CircuitBreakerOptions;
} 