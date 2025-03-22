import { Identifier, Metadata, Result, Timestamp } from './core-types';

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
 * Task definition with generic input and output types
 */
export interface TaskDefinition<TInput = unknown, TOutput = unknown, TState = unknown> {
  /** Unique identifier for this task type */
  id: Identifier;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Implementation function */
  handler: (context: TaskContext<TInput, TState>) => Promise<TOutput>;
  
  /** Optional retry configuration */
  retry?: TaskRetryPolicy;
  
  /** Optional timeout in milliseconds */
  timeout?: number;
  
  /** Required resources for this task */
  resources?: string[];
  
  /** Task dependencies */
  dependencies?: Identifier[];
  
  /** Additional metadata */
  metadata?: Metadata;
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
    message: string;
    stack?: string;
    code?: string;
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

/**
 * Task scheduler for deferred execution
 */
export interface TaskScheduler {
  /**
   * Schedule a task for future execution
   * @param taskType The type of task to schedule
   * @param input The input for the task
   * @param scheduledTime When to execute the task
   */
  scheduleTask<TInput>(
    taskType: string,
    input: TInput,
    scheduledTime: Timestamp
  ): Promise<Result<Identifier>>;
  
  /**
   * Cancel a scheduled task
   * @param taskId The ID of the task to cancel
   */
  cancelScheduledTask(taskId: Identifier): Promise<Result<boolean>>;
  
  /**
   * Reschedule a task 
   * @param taskId The ID of the task to reschedule
   * @param newScheduledTime The new execution time
   */
  rescheduleTask(
    taskId: Identifier,
    newScheduledTime: Timestamp
  ): Promise<Result<boolean>>;
}

/**
 * Task executor for running tasks
 */
export interface TaskExecutor {
  /**
   * Execute a task immediately
   * @param taskType The type of task to execute
   * @param input The input for the task
   */
  executeTask<TInput, TOutput>(
    taskType: string,
    input: TInput
  ): Promise<Result<TaskExecution<TInput, TOutput>>>;
  
  /**
   * Cancel a running task
   * @param taskId The ID of the task to cancel
   */
  cancelTask(taskId: Identifier): Promise<Result<boolean>>;
  
  /**
   * Execute a task with dependencies
   * @param taskType The type of task to execute
   * @param input The input for the task
   * @param dependencies IDs of tasks that must complete first
   */
  executeTaskWithDependencies<TInput, TOutput>(
    taskType: string,
    input: TInput,
    dependencies: Identifier[]
  ): Promise<Result<TaskExecution<TInput, TOutput>>>;
}

/**
 * Task registry for managing task definitions
 */
export interface TaskRegistry {
  /**
   * Register a task definition
   * @param definition The task definition to register
   */
  registerTask<TInput, TOutput, TState>(
    definition: TaskDefinition<TInput, TOutput, TState>
  ): Result<void>;
  
  /**
   * Unregister a task definition
   * @param taskId The ID of the task definition to unregister
   */
  unregisterTask(taskId: string): Result<void>;
  
  /**
   * Get a task definition by ID
   * @param taskId The ID of the task definition to retrieve
   */
  getTaskDefinition<TInput, TOutput, TState>(
    taskId: string
  ): Result<TaskDefinition<TInput, TOutput, TState>>;
  
  /**
   * Check if a task definition exists
   * @param taskId The ID of the task definition to check
   */
  hasTaskDefinition(taskId: string): boolean;
  
  /**
   * Get all registered task definitions
   */
  getAllTaskDefinitions(): TaskDefinition<unknown, unknown, unknown>[];
} 