import { DomainEvent, Identifier, Metadata, Result, Timestamp } from './core-types';

/**
 * Task status representing the lifecycle of a task
 */
export type TaskStatus = 
  | 'pending'
  | 'scheduled'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Defines how a task should be retried
 */
export interface TaskRetryPolicy {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  
  /** Delay strategy between retries */
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  
  /** Initial delay in milliseconds */
  initialDelay: number;
  
  /** Maximum delay between retries in milliseconds */
  maxDelay: number;
  
  /** Types of errors that should trigger a retry */
  retryableErrorTypes?: string[];
  
  /** Whether to retry on timeout errors */
  retryOnTimeout?: boolean;
  
  /** For exponential backoff, the exponent to use */
  exponent?: number;
}

/**
 * Cancellation token for stopping task execution
 */
export interface CancellationToken {
  /** Whether cancellation has been requested */
  readonly isCancellationRequested: boolean;
  
  /** Register a callback to be invoked on cancellation */
  onCancellationRequested(callback: () => void): void;
  
  /** Throws if cancellation has been requested */
  throwIfCancellationRequested(): void;
}

/**
 * Context available during task execution
 */
export interface TaskContext<TInput = unknown, TState = unknown> {
  /** Task input data */
  input: TInput;
  
  /** Current execution attempt number (1-based) */
  attemptNumber: number;
  
  /** Previous error if this is a retry attempt */
  previousError?: Error;
  
  /** Token for detecting cancellation */
  cancellationToken: CancellationToken;
  
  /** Extension state */
  state: TState;
  
  /** Additional metadata */
  metadata: Metadata;
}

/**
 * Task definition interface
 */
export interface TaskDefinition<TInput = unknown, TOutput = unknown> {
  /**
   * Task type identifier
   */
  type: string;

  /**
   * Task execution handler
   */
  handler: TaskHandler<TInput, TOutput>;

  /**
   * Task dependencies
   */
  dependencies?: string[];

  /**
   * Task retry policy
   */
  retryPolicy?: TaskRetryPolicy;
  
  /**
   * Task description
   */
  description?: string;
  
  /**
   * Task version
   */
  version?: string;
  
  /**
   * Task metadata
   */
  metadata?: Metadata;
}

/**
 * Task handler function type
 */
export type TaskHandler<TInput = unknown, TOutput = unknown> = 
  (input: TInput) => Promise<TOutput>;

/**
 * Task execution result interface
 */
export interface TaskExecutionResult<TInput = unknown, TOutput = unknown> {
  /**
   * Task ID
   */
  id: Identifier;

  /**
   * Task type
   */
  taskType: string;

  /**
   * Task execution status
   */
  status: TaskStatus;

  /**
   * Task input parameters
   */
  input: TInput;

  /**
   * Task creation timestamp
   */
  createdAt: number;

  /**
   * Current attempt number
   */
  attemptNumber: number;

  /**
   * Task start timestamp
   */
  startedAt?: number;

  /**
   * Task completion timestamp
   */
  completedAt?: number;

  /**
   * Task result value (if completed)
   */
  result?: TOutput;

  /**
   * Task error (if failed)
   */
  error?: Error;
}

/**
 * Task executor interface for executing tasks
 */
export interface TaskExecutor {
  /**
   * Execute a task
   * @param taskType The type of task to execute
   * @param input The task input parameters
   */
  executeTask<TInput = unknown, TOutput = unknown>(
    taskType: string, 
    input: TInput
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>>;

  /**
   * Execute a task with dependencies
   * @param taskType The type of task to execute
   * @param input The task input parameters
   * @param dependencies The dependency task types
   */
  executeTaskWithDependencies<TInput = unknown, TOutput = unknown>(
    taskType: string,
    input: TInput,
    dependencies: string[]
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>>;

  /**
   * Cancel a running task
   * @param taskId The ID of the task to cancel
   */
  cancelTask(taskId: Identifier): Promise<Result<void>>;

  /**
   * Get the status of a task
   * @param taskId The ID of the task
   */
  getTaskStatus<TInput = unknown, TOutput = unknown>(
    taskId: Identifier
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>>;
}

/**
 * Task registry interface for registering task handlers
 */
export interface TaskRegistry {
  /**
   * Register a task definition
   * @param taskDefinition The task definition to register
   */
  registerTask<TInput = unknown, TOutput = unknown>(
    taskDefinition: TaskDefinition<TInput, TOutput>
  ): void;

  /**
   * Unregister a task
   * @param taskType The type of task to unregister
   */
  unregisterTask(taskType: string): void;

  /**
   * Get a task definition by type
   * @param taskType The task type
   */
  getTask<TInput = unknown, TOutput = unknown>(
    taskType: string
  ): TaskDefinition<TInput, TOutput> | undefined;

  /**
   * Get a task definition by type with a Result wrapper
   * @param taskType The task type
   */
  getTaskDefinition<TInput = unknown, TOutput = unknown>(
    taskType: string
  ): Promise<Result<TaskDefinition<TInput, TOutput>>>;

  /**
   * Check if a task type is registered
   * @param taskType The task type to check
   */
  hasTask(taskType: string): boolean;

  /**
   * Get all registered task types
   */
  getTaskTypes(): string[];
}

/**
 * Task scheduler interface for scheduling tasks
 */
export interface TaskScheduler {
  /**
   * Schedule a task to run at a specific time
   * @param taskType The type of task to schedule
   * @param input The task input parameters
   * @param scheduledTime The time to run the task
   */
  scheduleTask<TInput = unknown>(
    taskType: string,
    input: TInput,
    scheduledTime: number
  ): Promise<Identifier>;

  /**
   * Schedule a recurring task
   * @param taskType The type of task to schedule
   * @param input The task input parameters
   * @param cronExpression The cron expression for recurrence
   */
  scheduleRecurringTask<TInput = unknown>(
    taskType: string,
    input: TInput,
    cronExpression: string
  ): Promise<Identifier>;

  /**
   * Cancel a scheduled task
   * @param scheduleId The ID of the scheduled task
   */
  cancelScheduledTask(scheduleId: Identifier): Promise<boolean>;

  /**
   * Get all scheduled tasks
   */
  getScheduledTasks(): Promise<Array<{
    id: Identifier;
    taskType: string;
    input: Record<string, unknown>;
    scheduledTime: number;
    recurring: boolean;
    cronExpression?: string;
  }>>;
}

/**
 * Task execution record
 */
export interface TaskExecution<TInput = unknown, TOutput = unknown> {
  /** Unique task execution identifier */
  id: Identifier;
  
  /** Task type identifier */
  taskType: string;
  
  /** Current execution status */
  status: TaskStatus;
  
  /** Input data */
  input: TInput;
  
  /** Result data if completed successfully */
  result?: TOutput;
  
  /** Error information if failed */
  error?: {
    /** Error message */
    message: string;
    /** Error name property (required for Error objects) */
    name: string;
    /** Optional stack trace */
    stack?: string;
    /** Optional error code */
    code?: string;
    /** Additional error details */
    details?: unknown;
  };
  
  /** When the task was created */
  createdAt: Timestamp;
  
  /** When the task started executing */
  startedAt?: Timestamp;
  
  /** When the task completed (successfully or not) */
  completedAt?: Timestamp;
  
  /** Execution attempt number */
  attemptNumber: number;
  
  /** Related task executions */
  relations?: {
    dependsOn: Identifier[];
    waitingFor?: Identifier[];
    triggeredBy?: Identifier;
  };
  
  /** Additional metadata */
  metadata?: Metadata;
} 