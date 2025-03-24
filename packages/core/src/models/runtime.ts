import { DomainEvent, Identifier, Result, Timestamp, Metadata } from './core-types';
import { EventBus, EventStorage, EventSource, EventHandler, Subscription } from './event-system';
import { ExtensionSystem } from './extension-system';
import { PluginRegistry } from './plugin-system';
import { TaskExecutor, TaskRegistry, TaskScheduler, TaskExecutionResult } from './task-system';
import { ProcessRegistry, ProcessManager, ProcessInstance, ProcessDefinition } from './process-system';

/**
 * Runtime configuration options
 */
export interface RuntimeOptions {
  /** System version */
  version: string;
  
  /** Namespace for this runtime instance */
  namespace?: string;
  
  /** Metadata for the runtime */
  metadata?: Record<string, unknown>;
  
  /** Plugin configuration */
  pluginConfig?: Record<string, Record<string, unknown>>;
}

/**
 * Health status of a runtime component
 */
export interface ComponentHealth {
  /** Component status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /** Status message */
  message?: string;
  
  /** Status details */
  details?: Record<string, unknown>;
  
  /** Last check timestamp */
  lastChecked: Timestamp;
}

/**
 * System-wide health check result
 */
export interface SystemHealth {
  /** Overall system status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  
  /** Component health statuses */
  components: Record<string, ComponentHealth>;
  
  /** Health check timestamp */
  timestamp: Timestamp;
}

/**
 * Runtime metrics snapshot
 */
export interface RuntimeMetrics {
  /** Tasks metrics */
  tasks: {
    /** Total tasks count */
    total: number;
    
    /** Running tasks count */
    running: number;
    
    /** Completed tasks count */
    completed: number;
    
    /** Failed tasks count */
    failed: number;
    
    /** Scheduled tasks count */
    scheduled: number;
    
    /** Average execution time */
    averageExecutionTime?: number;
  };
  
  /** Process metrics */
  processes: {
    /** Total processes count */
    total: number;
    
    /** Active processes count */
    active: number;
    
    /** Completed processes count */
    completed: number;
    
    /** Process state distribution */
    stateDistribution: Record<string, number>;
  };
  
  /** Event metrics */
  events: {
    /** Total events count */
    total: number;
    
    /** Events by type count */
    byType: Record<string, number>;
    
    /** Events rate (events per second) */
    rate: number;
  };
  
  /** Resource usage */
  resources: {
    /** CPU usage percentage */
    cpu?: number;
    
    /** Memory usage in bytes */
    memory?: number;
    
    /** Disk usage in bytes */
    disk?: number;
    
    /** Network usage in bytes */
    network?: number;
  };
  
  /** Snapshot timestamp */
  timestamp: Timestamp;
}

/**
 * Runtime interface for process and task management
 */
export interface Runtime {
  /**
   * Runtime version
   */
  readonly version?: string;

  /**
   * Runtime namespace
   */
  readonly namespace?: string;

  /**
   * Event bus for pub/sub communication
   */
  readonly eventBus?: EventBus;

  /**
   * Extension system for plugins
   */
  readonly extensionSystem?: ExtensionSystem;

  /**
   * Plugin registry for managing plugins
   */
  readonly pluginRegistry?: PluginRegistry;

  /**
   * Task registry for managing task definitions
   */
  readonly taskRegistry?: TaskRegistry;

  /**
   * Task executor for running tasks
   */
  readonly taskExecutor?: TaskExecutor;

  /**
   * Task scheduler for deferred execution
   */
  readonly taskScheduler?: TaskScheduler;

  /**
   * Process registry for managing process definitions
   */
  readonly processRegistry?: ProcessRegistry;

  /**
   * Process manager for process instances
   */
  readonly processManager?: ProcessManager;

  /**
   * Event storage for persistence
   */
  readonly eventStorage?: EventStorage;

  /**
   * Event source for replay
   */
  readonly eventSource?: EventSource;

  /**
   * Initialize the runtime with provided options
   */
  initialize?(options: RuntimeOptions): Promise<Result<void>>;

  /**
   * Start the runtime
   */
  start?(): Promise<Result<void>>;

  /**
   * Stop the runtime
   */
  stop?(): Promise<Result<void>>;

  /**
   * Create a new process instance
   * @param processType The process type
   * @param data The process data
   */
  createProcess<TData = Record<string, unknown>, TState extends string = string>(
    processType: string, 
    data: TData
  ): Promise<ProcessInstance<TState, TData>>;
  
  /**
   * Transition a process instance to a new state
   * @param processId The process ID
   * @param eventType The event type that triggers the transition
   * @param payload Additional payload for the transition
   */
  transitionProcess<TData = Record<string, unknown>, TState extends string = string>(
    processId: Identifier,
    eventType: string,
    payload?: Record<string, unknown>
  ): Promise<ProcessInstance<TState, TData>>;
  
  /**
   * Execute a task
   * @param taskType The task type
   * @param input The task input
   */
  executeTask<TInput = Record<string, unknown>, TOutput = unknown>(
    taskType: string, 
    input: TInput
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>>;
  
  /**
   * Execute a task with dependencies
   * @param taskType The task type
   * @param input The task input
   * @param dependencies The task dependencies
   */
  executeTaskWithDependencies<TInput = Record<string, unknown>, TOutput = unknown>(
    taskType: string, 
    input: TInput, 
    dependencies: string[]
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>>;
  
  /**
   * Subscribe to events
   * @param eventType The event type
   * @param handler The event handler
   */
  subscribe<T = unknown>(
    eventType: string, 
    handler: EventHandler<T>
  ): Subscription;
  
  /**
   * Publish an event
   * @param eventType The event type
   * @param payload The event payload
   */
  publish<T = unknown>(
    eventType: string, 
    payload: T
  ): void;
  
  /**
   * Persist an event
   * @param event The event to persist
   */
  persistEvent<T = unknown>(
    event: DomainEvent<T>
  ): Promise<void>;
  
  /**
   * Replay events from a time range
   * @param startTime The start time
   * @param endTime The end time
   * @param eventTypes Optional event types to filter
   */
  replayEvents(
    startTime: number, 
    endTime: number, 
    eventTypes?: string[]
  ): Promise<void>;
  
  /**
   * Correlate events by correlation ID
   * @param correlationId The correlation ID
   */
  correlateEvents(
    correlationId: string
  ): Promise<DomainEvent<unknown>[]>;
  
  /**
   * Get process metrics
   */
  getProcessMetrics(): Promise<RuntimeMetrics['processes']>;
  
  /**
   * Get task metrics
   */
  getTaskMetrics(): Promise<RuntimeMetrics['tasks']>;
  
  /**
   * Get event metrics
   */
  getEventMetrics(): Promise<RuntimeMetrics['events']>;
  
  /**
   * Get health status
   */
  getHealthStatus(): Promise<SystemHealth>;
}

/**
 * Re-export EventHandler and Subscription from event-system
 */
export { EventHandler, Subscription }; 