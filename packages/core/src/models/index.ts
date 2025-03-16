/**
 * Core models for the reactive system
 */

// Event types
export interface Event<T = any> {
  type: string;
  payload: T;
  timestamp: number;
  metadata?: Record<string, any>;
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
  description?: string;
  states: ProcessState[];
  initialState: string;
  transitions: ProcessTransition[];
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
export interface TaskContext {
  emitEvent: (type: string, payload: any) => void;
  getProcess: (id: string) => ProcessInstance | undefined;
  getTaskResult: (taskId: string) => any;
  logger: {
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
  };
}

export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  implementation: (input: any, context: TaskContext) => Promise<any>;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  input: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: number;
  completedAt?: number;
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
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
}
