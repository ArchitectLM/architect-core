import { Identifier, Metadata, Result, Timestamp } from './core-types';

/**
 * Process transition definition
 */
export interface ProcessTransition<TState extends string = string> {
  /** Source state */
  from: TState;
  
  /** Target state */
  to: TState;
  
  /** Event that triggers this transition */
  on: string;
  
  /** Optional guard condition for the transition */
  guard?: (data: unknown, event: unknown) => boolean;
}

/**
 * Process definition with generic state type
 */
export interface ProcessDefinition<TState extends string = string, TData = unknown> {
  /** Unique process identifier */
  id: Identifier;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Initial state for new processes */
  initialState: TState;
  
  /** Possible state transitions */
  transitions: ProcessTransition<TState>[];
  
  /** Process version */
  version?: string;
  
  /** Entry actions when entering states */
  entryActions?: Partial<Record<TState, (data: TData) => Promise<TData>>>;
  
  /** Exit actions when leaving states */
  exitActions?: Partial<Record<TState, (data: TData) => Promise<TData>>>;
  
  /** Additional metadata */
  metadata?: Metadata;
}

/**
 * Process instance with generic state and data types
 */
export interface ProcessInstance<
  TState extends string = string,
  TData = unknown
> {
  /** Unique instance identifier */
  id: Identifier;
  
  /** Process type */
  type: string;
  
  /** Current state */
  state: TState;
  
  /** Process data */
  data: TData;
  
  /** When the process was created */
  createdAt: Timestamp;
  
  /** When the process was last updated */
  updatedAt: Timestamp;
  
  /** Process version */
  version?: string;
  
  /** Recovery information */
  recovery?: {
    checkpointId: Identifier;
    lastSavedAt: Timestamp;
  };
  
  /** Additional metadata */
  metadata?: Metadata;
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
   * @param data Initial process data
   * @param options Optional creation parameters
   */
  createProcess<TData, TState extends string>(
    processType: string,
    data: TData,
    options?: { version?: string; metadata?: Metadata }
  ): Promise<Result<ProcessInstance<TState, TData>>>;
  
  /**
   * Get a process instance by ID
   * @param processId The ID of the process to retrieve
   */
  getProcess<TData, TState extends string>(
    processId: Identifier
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
   * @param processId The ID of the process definition to unregister
   */
  unregisterProcess(processId: Identifier): Result<void>;
  
  /**
   * Get a process definition by ID
   * @param processId The ID of the process definition to retrieve
   */
  getProcessDefinition<TState extends string, TData>(
    processId: Identifier
  ): Result<ProcessDefinition<TState, TData>>;
  
  /**
   * Check if a process definition exists
   * @param processId The ID of the process definition to check
   */
  hasProcessDefinition(processId: Identifier): boolean;
  
  /**
   * Get all registered process definitions
   */
  getAllProcessDefinitions(): ProcessDefinition<string, unknown>[];
} 