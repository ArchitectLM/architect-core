import { Identifier, Result, Timestamp } from './core-types';
import { EventBus, EventStorage, EventSource } from './event-system';
import { ExtensionSystem } from './extension-system';
import { PluginRegistry } from './plugin-system';
import { ProcessManager, ProcessRegistry } from './process-system';
import { TaskExecutor, TaskRegistry, TaskScheduler } from './task-system';

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
 * Core runtime interface that composes all domain components
 */
export interface Runtime {
  /** Unique runtime identifier */
  readonly id: Identifier;
  
  /** Runtime version */
  readonly version: string;
  
  /** Runtime namespace */
  readonly namespace: string;
  
  /** Event bus for pub/sub communication */
  readonly eventBus: EventBus;
  
  /** Extension system for plugins */
  readonly extensionSystem: ExtensionSystem;
  
  /** Plugin registry for managing plugins */
  readonly pluginRegistry: PluginRegistry;
  
  /** Task registry for managing task definitions */
  readonly taskRegistry: TaskRegistry;
  
  /** Task executor for running tasks */
  readonly taskExecutor: TaskExecutor;
  
  /** Task scheduler for deferred execution */
  readonly taskScheduler: TaskScheduler;
  
  /** Process registry for managing process definitions */
  readonly processRegistry: ProcessRegistry;
  
  /** Process manager for process instances */
  readonly processManager: ProcessManager;
  
  /** Event storage for persistence */
  readonly eventStorage?: EventStorage;
  
  /** Event source for replay */
  readonly eventSource?: EventSource;
  
  /**
   * Initialize the runtime
   * @param options Runtime configuration options
   */
  initialize(options: RuntimeOptions): Promise<Result<void>>;
  
  /**
   * Start the runtime
   */
  start(): Promise<Result<void>>;
  
  /**
   * Stop the runtime
   */
  stop(): Promise<Result<void>>;
  
  /**
   * Reset the runtime state
   */
  reset(): Promise<Result<void>>;
  
  /**
   * Get runtime health status
   */
  getHealth(): Promise<Result<SystemHealth>>;
  
  /**
   * Get runtime metrics
   */
  getMetrics(): Promise<Result<RuntimeMetrics>>;
  
  /**
   * Run a health check on all components
   */
  checkHealth(): Promise<Result<void>>;

  /**
   * Execute a task with the given type and input
   * @param taskType The type of task to execute
   * @param input The input data for the task
   * @returns A promise that resolves with the task execution result
   */
  executeTask(taskType: string, input: any): Promise<Result<any>>;

  /**
   * Execute a task with dependencies
   * @param taskType The type of task to execute
   * @param input The input data for the task
   * @param dependencies Array of task IDs that this task depends on
   * @returns A promise that resolves with the task execution result
   */
  executeTaskWithDependencies(taskType: string, input: any, dependencies: Identifier[]): Promise<Result<any>>;
} 