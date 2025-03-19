/**
 * Core models for the reactive system
 */

// Event types
export interface Event<T = any> {
  type: string;
  payload: T;
}

// Process types
export interface ProcessState {
  name: string;
  description?: string;
}

export interface ProcessTransition {
  from: string;
  to: string;
  on: string;
  description?: string;
  condition?: string;
}

export interface ProcessDefinition {
  id: string;
  name: string;
  description: string;
  initialState: string;
  transitions: ProcessTransition[];
  tasks: TaskDefinition[];
}

export interface ProcessInstance {
  id: string;
  definitionId: string;
  currentState: string;
  data: Record<string, any>;
  history: {
    state: string;
    timestamp: number;
    transition?: string;
  }[];
  createdAt: number;
  updatedAt: number;
}

// Task types
/**
 * Context object provided to task handlers during execution.
 * Contains utilities and information needed for task processing.
 */
export interface TaskContext {
  processId: string;
  taskId: string;
  input: any;
  eventBus: EventBus;
  logger: {
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
  };
  emitEvent: (type: string, payload: any) => void;
  getTaskResult: (taskId: string) => any;
  isCancelled: () => boolean;
}

/**
 * Definition of a task that can be executed by the runtime.
 * Tasks are the basic units of work in the system.
 */
export interface TaskDefinition {
  /**
   * Unique identifier for the task.
   */
  id: string;

  /**
   * Human-readable name of the task.
   */
  name: string;

  /**
   * Description of what the task does.
   */
  description?: string;

  /**
   * Async function that implements the task logic.
   * Receives a TaskContext object with utilities and information.
   * @param context - The task context containing utilities and information
   * @returns A promise that resolves to the task result
   */
  handler: (context: TaskContext) => Promise<any>;

  /**
   * Optional list of task IDs that this task depends on.
   * Results from dependent tasks can be accessed via context.getTaskResult().
   */
  dependencies?: string[];

  /**
   * Optional number of retries for the task.
   */
  retries?: number;
  
  /**
   * Maximum number of times to retry the task if it fails.
   * Defaults to 3 if not specified.
   */
  maxRetries?: number;
  
  /**
   * Delay in milliseconds between retry attempts.
   * Defaults to 1000ms if not specified.
   */
  retryDelay?: number;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  input: any;
  result?: any;
  error?: string;
  retryCount: number;
  processId?: string;
}

// Runtime types
export interface RuntimeOptions {
  logger?: {
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
  };
}

export interface Runtime {
  // Process management
  createProcess: (definitionId: string, data: any) => ProcessInstance;
  getProcess: (id: string) => ProcessInstance | undefined;
  transitionProcess: (id: string, event: string, payload?: any) => ProcessInstance;

  // Task management
  executeTask: (taskId: string, input: any) => Promise<any>;
  getTaskExecution: (id: string) => TaskExecution | undefined;
  cancelTask: (executionId: string) => void;

  // Event handling
  subscribe: (eventType: string, handler: (event: Event) => void) => () => void;
  publish: (eventType: string, payload: any) => void;
}

// Circuit breaker types
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenSuccessThreshold?: number;
}

export interface CircuitBreaker {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
  getState: () => CircuitBreakerState;
  reset: () => void;
}

// Retry policy types
export interface RetryOptions {
  maxAttempts: number;
  backoff: 'fixed' | 'exponential';
  initialDelay?: number;
  maxDelay?: number;
}

export interface RetryPolicy {
  execute: <T>(fn: () => Promise<T>, shouldRetry?: (error: Error) => boolean) => Promise<T>;
}

// Enhanced retry policy types have been moved to the extension system

// Core models
export interface Command<T = any> {
  type: string;
  payload: T;
}

export interface Extension {
  name: string;
  description: string;
  hooks: Record<string, ExtensionHookHandler>;
  cleanup(): Promise<void>;
}

export type ExtensionHookHandler = (context: any) => Promise<any>;

export interface ExtensionPoint {
  name: string;
  description: string;
  hooks: string[];
}

export interface EventBus {
  publish: (type: string, payload: any) => void;
  subscribe: (type: string, handler: (event: Event) => void) => () => void;
}
