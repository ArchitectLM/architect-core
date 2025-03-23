import { DomainEvent, Identifier, Metadata, Result, Timestamp } from './core-types';

/**
 * Process definition with states and transitions
 */
export interface ProcessDefinition<TState extends string = string, TData = unknown> {
  /**
   * Process type identifier
   */
  type: string;
  
  /**
   * Human-readable name
   */
  name: string;
  
  /**
   * Detailed description
   */
  description: string;

  /**
   * Valid process states
   */
  states: TState[];

  /**
   * Valid state transitions
   */
  transitions: ProcessTransition<TState>[];

  /**
   * Initial state
   */
  initialState: TState;

  /**
   * Final states
   */
  finalStates: TState[];
  
  /**
   * Process version
   */
  version?: string;
  
  /**
   * Entry actions when entering states
   */
  entryActions?: Partial<Record<TState, (data: TData) => Promise<TData>>>;
  
  /**
   * Exit actions when leaving states
   */
  exitActions?: Partial<Record<TState, (data: TData) => Promise<TData>>>;
  
  /**
   * Additional metadata
   */
  metadata?: Metadata;
}

/**
 * Process state transition definition
 */
export interface ProcessTransition<TState extends string = string> {
  /**
   * Source state
   */
  from: TState;
  
  /**
   * Target state
   */
  to: TState;
  
  /**
   * Event type that triggers this transition
   */
  event: string;
  
  /**
   * Optional guard condition for the transition
   */
  guard?: (data: unknown, event: unknown) => boolean;
}

/**
 * Process instance representation
 */
export interface ProcessInstance<TState extends string = string, TData = unknown> {
  /**
   * Process instance ID
   */
  id: Identifier;
  
  /**
   * Process type
   */
  type: string;
  
  /**
   * Current state
   */
  state: TState;
  
  /**
   * Process data
   */
  data: TData;
  
  /**
   * Creation timestamp
   */
  createdAt: Timestamp;
  
  /**
   * Last updated timestamp
   */
  updatedAt: Timestamp;
  
  /**
   * Process version
   */
  version?: string;
  
  /**
   * Process metadata
   */
  metadata?: Metadata;
  
  /**
   * Recovery information
   */
  recovery?: {
    checkpointId: Identifier;
    lastSavedAt: Timestamp;
  };
  
  /**
   * State history for auditing
   */
  history?: Array<{
    from: TState;
    to: TState;
    event: string;
    timestamp: Timestamp;
  }>;
}

/**
 * Process event with generic payload
 */
export interface ProcessEvent<T = unknown> {
  /** Event type */
  type: string;
  
  /** Process instance ID */
  processId: Identifier;
  
  /** Process type */
  processType: string;
  
  /** Previous state */
  fromState?: string;
  
  /** New state */
  toState?: string;
  
  /** Event payload */
  payload: T;
  
  /** When the event occurred */
  timestamp: Timestamp;
  
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Process checkpoint for recovery
 */
export interface ProcessCheckpoint<TData = unknown> {
  /** Checkpoint identifier */
  id: Identifier;
  
  /** Process instance ID */
  processId: Identifier;
  
  /** Process state at checkpoint */
  state: string;
  
  /** Process data at checkpoint */
  data: TData;
  
  /** When the checkpoint was created */
  createdAt: Timestamp;
  
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Process metrics for monitoring
 */
export interface ProcessMetrics {
  /** Process type */
  processType: string;
  
  /** Total number of instances */
  instanceCount: number;
  
  /** Distribution of processes across states */
  stateDistribution: Record<string, number>;
  
  /** Average time spent in each state */
  stateAverageDuration: Record<string, number>;
  
  /** Average total duration from creation to completion */
  averageDuration: number;
  
  /** Most recent process timestamp */
  lastProcessedTime: Timestamp;
}

/**
 * Process manager for creating and transitioning processes
 */
export interface ProcessManager {
  /**
   * Create a new process instance
   * @param processType The type of process to create
   * @param data The initial process data
   * @param options Optional creation parameters
   */
  createProcess<TData, TState extends string>(
    processType: string,
    data: TData,
    options?: { version?: string; metadata?: Metadata }
  ): Promise<Result<ProcessInstance<TState, TData>>>;

  /**
   * Apply an event to transition a process
   * @param processId The ID of the process to transition
   * @param eventType The event type that triggers the transition
   * @param payload The event payload
   */
  applyEvent<TData, TState extends string, TPayload>(
    processId: Identifier,
    eventType: string,
    payload: TPayload
  ): Promise<Result<ProcessInstance<TState, TData>>>;

  /**
   * Get a process instance by ID
   * @param processId The ID of the process to retrieve
   */
  getProcess<TData, TState extends string>(
    processId: Identifier
  ): Promise<Result<ProcessInstance<TState, TData>>>;

  /**
   * Get processes by type and state
   * @param processType The process type
   * @param state Optional state filter
   */
  getProcessesByType<TData, TState extends string>(
    processType: string,
    state?: TState
  ): Promise<Result<ProcessInstance<TState, TData>[]>>;

  /**
   * Delete a process instance
   * @param processId The process ID
   */
  deleteProcess(processId: Identifier): Promise<Result<void>>;

  /**
   * Check if a transition is valid
   * @param processId The process ID
   * @param eventType The event type
   */
  isTransitionValid(
    processId: Identifier,
    eventType: string
  ): Promise<Result<boolean>>;
  
  /**
   * Save a process checkpoint for later recovery
   * @param processId The ID of the process to checkpoint
   */
  saveCheckpoint<TData>(
    processId: Identifier
  ): Promise<Result<ProcessCheckpoint<TData>>>;
  
  /**
   * Restore a process from a checkpoint
   * @param processId The ID of the process to restore
   * @param checkpointId The ID of the checkpoint to restore from
   */
  restoreFromCheckpoint<TData, TState extends string>(
    processId: Identifier,
    checkpointId: Identifier
  ): Promise<Result<ProcessInstance<TState, TData>>>;
}

/**
 * Process registry for managing process definitions
 */
export interface ProcessRegistry {
  /**
   * Register a process definition
   * @param definition The process definition to register
   */
  registerProcess<TState extends string, TData>(
    definition: ProcessDefinition<TState, TData>
  ): Result<void>;

  /**
   * Unregister a process definition
   * @param processType The process type to unregister
   */
  unregisterProcess(processType: string): Result<void>;

  /**
   * Get a process definition by type
   * @param processType The process type
   */
  getProcessDefinition<TState extends string, TData>(
    processType: string
  ): Result<ProcessDefinition<TState, TData>>;

  /**
   * Check if a process type is registered
   * @param processType The process type
   */
  hasProcess(processType: string): boolean;

  /**
   * Get all registered process types
   */
  getProcessTypes(): string[];

  /**
   * Find a transition for a process type
   * @param processType The process type
   * @param fromState The source state
   * @param eventType The event type
   */
  findTransition<TState extends string>(
    processType: string,
    fromState: TState,
    eventType: string
  ): ProcessTransition<TState> | undefined;
  
  /**
   * Get all registered process definitions
   */
  getAllProcessDefinitions(): ProcessDefinition<string, unknown>[];
} 