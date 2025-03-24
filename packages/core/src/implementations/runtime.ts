import { v4 as uuidv4 } from 'uuid';
import {
  Runtime,
  RuntimeOptions,
  SystemHealth,
  ComponentHealth,
  RuntimeMetrics,
  EventHandler,
  Subscription
} from '../models/runtime';
import {
  DomainEvent,
  Identifier,
  Result,
  DomainError
} from '../models/core-types';
import {
  EventBus,
  EventStorage,
  EventSource
} from '../models/event-system';
import {
  ExtensionSystem,
  Extension
} from '../models/extension-system';
import {
  TaskRegistry,
  TaskExecutor,
  TaskScheduler
} from '../models/task-system';
import {
  ProcessRegistry,
  ProcessManager,
  ProcessInstance
} from '../models/process-system';
import {
  Plugin,
  PluginRegistry
} from '../models/plugin-system';
import { createInMemoryEventBus } from './event-bus';
import { createExtensionSystem } from './extension-system';
import { createEventStorage } from './event-storage';

/**
 * Core runtime configuration
 */
export interface CoreRuntimeConfig {
  /** Whether to enable event persistence */
  enableEventPersistence?: boolean;
  
  /** Custom event storage implementation */
  eventStorage?: EventStorage;
  
  /** Custom extension system implementation */
  extensionSystem?: ExtensionSystem;
  
  /** Custom event bus implementation */
  eventBus?: EventBus;
}

/**
 * Runtime configuration interface for constructor
 */
export interface RuntimeConfig {
  eventBus: EventBus;
  extensionSystem: ExtensionSystem;
  taskRegistry: TaskRegistry;
  taskExecutor: TaskExecutor;
  taskScheduler?: TaskScheduler;
  processRegistry: ProcessRegistry;
  processManager: ProcessManager;
  pluginRegistry: PluginRegistry;
  eventStorage?: EventStorage;
  eventSource?: EventSource;
}

/**
 * Complete runtime implementation with all core services
 * 
 * This is the main entry point for using the core functionality.
 * It provides access to all services and manages their lifecycle.
 */
export class RuntimeInstance implements Runtime {
  /** Unique runtime identifier */
  public readonly id: Identifier;
  
  /** Runtime version */
  private _version: string;
  
  /** Runtime namespace */
  private _namespace: string;
  
  /** Event bus for pub/sub communication */
  public readonly eventBus: EventBus;
  
  /** Extension system for plugins */
  public readonly extensionSystem: ExtensionSystem;
  
  /** Plugin registry for managing plugins */
  public readonly pluginRegistry: PluginRegistry;
  
  /** Task registry for managing task definitions */
  public readonly taskRegistry: TaskRegistry;
  
  /** Task executor for running tasks */
  public readonly taskExecutor: TaskExecutor;
  
  /** Task scheduler for deferred execution */
  public readonly taskScheduler: TaskScheduler;
  
  /** Process registry for managing process definitions */
  public readonly processRegistry: ProcessRegistry;
  
  /** Process manager for process instances */
  public readonly processManager: ProcessManager;
  
  /** Event storage for persistence */
  public readonly eventStorage?: EventStorage;
  
  /** Event source for replay */
  public readonly eventSource?: EventSource;
  
  /** Registered plugins map */
  private readonly plugins: Map<string, Plugin> = new Map();
  
  /** Runtime state */
  private state: 'initializing' | 'running' | 'stopped' | 'error' = 'initializing';
  
  /** Getter for version */
  public get version(): string {
    return this._version;
  }
  
  /** Getter for namespace */
  public get namespace(): string {
    return this._namespace;
  }
  
  /**
   * Create a new Runtime instance with the provided components
   */
  constructor(config: {
    eventBus: EventBus;
    extensionSystem: ExtensionSystem;
    pluginRegistry: PluginRegistry;
    taskRegistry: TaskRegistry;
    taskExecutor: TaskExecutor;
    taskScheduler: TaskScheduler;
    processRegistry: ProcessRegistry;
    processManager: ProcessManager;
    eventStorage?: EventStorage;
    eventSource?: EventSource;
  }) {
    this.id = uuidv4();
    this._version = '1.0.0';
    this._namespace = 'default';
    
    this.eventBus = config.eventBus;
    this.extensionSystem = config.extensionSystem;
    this.pluginRegistry = config.pluginRegistry;
    this.taskRegistry = config.taskRegistry;
    this.taskExecutor = config.taskExecutor;
    this.taskScheduler = config.taskScheduler;
    this.processRegistry = config.processRegistry;
    this.processManager = config.processManager;
    this.eventStorage = config.eventStorage;
    this.eventSource = config.eventSource;
    
    // If event storage is provided, enable persistence
    if (this.eventStorage) {
      this.eventBus.enablePersistence(this.eventStorage);
    }
  }
  
  /**
   * Create a new process instance
   */
  public async createProcess<TData = Record<string, unknown>, TState extends string = string>(
    processType: string, 
    data: TData
  ): Promise<ProcessInstance<TState, TData>> {
    const result = await this.processManager.createProcess(processType, data);
    if (!result.success || !result.value) {
      throw new Error(`Failed to create process: ${result.error?.message || 'Unknown error'}`);
    }
    return result.value as ProcessInstance<TState, TData>;
  }
  
  /**
   * Transition a process to a new state
   */
  public async transitionProcess<TData = Record<string, unknown>, TState extends string = string>(
    processId: string, 
    eventType: string, 
    payload?: Record<string, unknown>
  ): Promise<ProcessInstance<TState, TData>> {
    // Use the applyEvent method which is the correct method on ProcessManager
    const result = await this.processManager.applyEvent<TData, TState, Record<string, unknown>>(
      processId, 
      eventType, 
      payload || {}
    );
    
    if (!result.success || !result.value) {
      throw new Error(`Failed to transition process: ${result.error?.message || 'Unknown error'}`);
    }
    return result.value;
  }
  
  /**
   * Execute a task
   */
  public async executeTask<TInput = Record<string, unknown>, TOutput = unknown>(
    taskType: string, 
    input: TInput
  ): Promise<TOutput> {
    const result = await this.taskExecutor.executeTask(taskType, input);
    if (!result.success) {
      throw new Error(`Failed to execute task: ${result.error?.message || 'Unknown error'}`);
    }
    return result.value as TOutput;
  }
  
  /**
   * Execute a task with dependencies
   */
  public async executeTaskWithDependencies<TInput = Record<string, unknown>, TOutput = unknown>(
    taskType: string, 
    input: TInput, 
    dependencies: string[]
  ): Promise<TOutput> {
    // Execute dependencies first
    const dependencyResults: Record<string, any> = {};
    for (const depTaskType of dependencies) {
      dependencyResults[depTaskType] = await this.executeTask(depTaskType, input);
    }
    
    // Execute the task with dependency results
    const enrichedInput = {
      ...input as object,
      previousResults: dependencyResults
    };
    
    return this.executeTask(taskType, enrichedInput as TInput);
  }
  
  /**
   * Subscribe to events
   */
  public subscribe<T = unknown>(
    eventType: string, 
    handler: EventHandler<T>
  ): Subscription {
    return this.eventBus.subscribe(eventType, handler);
  }
  
  /**
   * Publish an event
   */
  public publish<T = unknown>(
    eventType: string, 
    payload: T
  ): void {
    const event: DomainEvent<T> = {
      id: uuidv4(),
      type: eventType,
      timestamp: Date.now(),
      payload,
      metadata: {}
    };
    
    // Fire and forget
    this.eventBus.publish(event).catch(error => {
      console.error('Error publishing event:', error);
    });
  }
  
  /**
   * Persist an event
   */
  public async persistEvent<T = unknown>(
    event: DomainEvent<T>
  ): Promise<void> {
    if (!this.eventStorage) {
      throw new Error('Event storage is not available');
    }
    
    await this.eventStorage.storeEvent(event);
  }
  
  /**
   * Replay events in a time range
   */
  public async replayEvents(
    startTime: number, 
    endTime: number, 
    eventTypes?: string[]
  ): Promise<void> {
    if (!this.eventSource) {
      throw new Error('Event source is not available');
    }
    
    if (eventTypes && eventTypes.length > 0) {
      for (const eventType of eventTypes) {
        await this.eventSource.replayEvents(eventType, startTime, endTime);
      }
    } else {
      await this.eventSource.replayEvents('*', startTime, endTime);
    }
  }
  
  /**
   * Correlate events by ID
   */
  public async correlateEvents(
    correlationId: string
  ): Promise<DomainEvent<unknown>[]> {
    return this.eventBus.correlate(correlationId);
  }
  
  /**
   * Get process metrics
   */
  public async getProcessMetrics(): Promise<RuntimeMetrics['processes']> {
    return {
      total: 0,
      active: 0,
      completed: 0,
      stateDistribution: {}
    };
  }
  
  /**
   * Get task metrics
   */
  public async getTaskMetrics(): Promise<RuntimeMetrics['tasks']> {
    return {
      total: 0,
      running: 0,
      completed: 0,
      failed: 0,
      scheduled: 0
    };
  }
  
  /**
   * Get event metrics
   */
  public async getEventMetrics(): Promise<RuntimeMetrics['events']> {
    return {
      total: 0,
      byType: {},
      rate: 0
    };
  }
  
  /**
   * Get health status
   */
  public async getHealthStatus(): Promise<SystemHealth> {
    const now = Date.now();
    
    return {
      status: 'healthy',
      components: {},
      timestamp: now
    };
  }

  /**
   * Register a plugin
   * @param plugin The plugin to register
   */
  async registerPlugin(plugin: Plugin): Promise<Result<void>> {
    try {
      // Check for duplicate registration
      if (this.plugins.has(plugin.id)) {
        return {
          success: false,
          error: new Error(`Plugin ${plugin.id} is already registered`)
        };
      }

      // Register plugin with extension system
      const extensionResult = this.extensionSystem.registerExtension(plugin);
      if (!extensionResult.success) {
        return extensionResult;
      }

      // Initialize plugin
      const initResult = await plugin.lifecycle.initialize({});
      if (!initResult.success) {
        return initResult;
      }

      // Store plugin
      this.plugins.set(plugin.id, plugin);

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Unregister a plugin
   * @param pluginId The ID of the plugin to unregister
   */
  async unregisterPlugin(pluginId: string): Promise<Result<void>> {
    try {
      const plugin = this.plugins.get(pluginId);
      if (!plugin) {
        return {
          success: false,
          error: new Error(`Plugin ${pluginId} not found`)
        };
      }

      // Stop plugin
      const stopResult = await plugin.lifecycle.stop();
      if (!stopResult.success) {
        return stopResult;
      }

      // Clean up plugin
      const cleanupResult = await plugin.lifecycle.cleanup();
      if (!cleanupResult.success) {
        return cleanupResult;
      }

      // Unregister from extension system
      const extensionResult = this.extensionSystem.unregisterExtension(pluginId);
      if (!extensionResult.success) {
        return extensionResult;
      }

      // Remove plugin
      this.plugins.delete(pluginId);

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Start the runtime
   */
  async start(): Promise<Result<void>> {
    try {
      // Start all plugins
      for (const plugin of this.plugins.values()) {
        const startResult = await plugin.lifecycle.start();
        if (!startResult.success) {
          return startResult;
        }
      }
      
      this.state = 'running';
      return { success: true, value: undefined };
    } catch (error) {
      this.state = 'error';
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Stop the runtime
   */
  async stop(): Promise<Result<void>> {
    try {
      // Stop all plugins in reverse order
      const plugins = Array.from(this.plugins.values()).reverse();
      for (const plugin of plugins) {
        const stopResult = await plugin.lifecycle.stop();
        if (!stopResult.success) {
          return stopResult;
        }
      }
      
      this.state = 'stopped';
      return { success: true, value: undefined };
    } catch (error) {
      this.state = 'error';
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get a plugin by ID
   * @param pluginId The ID of the plugin to retrieve
   */
  getPlugin<T extends Plugin>(pluginId: string): T | undefined {
    return this.plugins.get(pluginId) as T | undefined;
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Initialize the runtime with the provided options
   */
  public async initialize(options: {
    version: string;
    namespace: string;
    [key: string]: any;
  }): Promise<Result<void>> {
    try {
      this._version = options.version;
      this._namespace = options.namespace;
      
      // Set the context in the extension system
      this.extensionSystem.setContext({
        version: this._version,
        namespace: this._namespace,
        runtimeId: this.id,
        data: {
          ...options
        }
      });
      
      // Initialize extension system and propagate to event bus
      const result = await this.extensionSystem.executeExtensionPoint(
        'system.init',
        {
          version: this._version,
          namespace: this._namespace,
          config: options
        }
      );
      
      if (!result.success) {
        this.state = 'error';
        return {
          success: false,
          error: result.error || new Error('Failed to initialize extension system')
        };
      }
      
      this.state = 'running';
      return { success: true, value: undefined };
    } catch (error) {
      this.state = 'error';
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
}

/**
 * Factory function to create a new Runtime from components
 */
export function createRuntime(options: {
  eventBus: EventBus;
  extensionSystem: ExtensionSystem;
  pluginRegistry: PluginRegistry;
  taskRegistry: TaskRegistry;
  taskExecutor: TaskExecutor;
  taskScheduler: TaskScheduler;
  processRegistry: ProcessRegistry;
  processManager: ProcessManager;
  eventStorage?: EventStorage;
  eventSource?: EventSource;
}): Runtime {
  return new RuntimeInstance(options);
}

/**
 * Core runtime factory function for simple initialization - matches the original CoreRuntime API
 */
export function createCoreRuntime(config: CoreRuntimeConfig = {}): RuntimeInstance {
  // Initialize extension system
  const extensionSystem = config.extensionSystem ?? createExtensionSystem();

  // Initialize event storage if enabled
  const eventStorage = config.enableEventPersistence 
    ? (config.eventStorage ?? createEventStorage()) 
    : undefined;

  // Initialize event bus
  const eventBus = config.eventBus ?? createInMemoryEventBus(extensionSystem);
  
  // For compatibility with tests, create a minimal runtime
  // Note: In a real application, you would need to provide all required dependencies
  return new RuntimeInstance({
    eventBus,
    extensionSystem,
    // Create empty interface implementations for placeholders
    pluginRegistry: {
      registerPlugin: () => ({ success: true, value: undefined }),
      unregisterPlugin: () => ({ success: true, value: undefined }),
      getPlugin: () => ({ success: false, error: new Error("Plugin registry not implemented") }),
      getAllPlugins: () => [],
      getPluginsWithCapability: () => []
    },
    taskRegistry: {
      registerTask: () => { /* No-op */ },
      unregisterTask: () => { /* No-op */ },
      getTask: () => undefined,
      getTaskDefinition: async () => ({ success: false, error: new Error("Task registry not implemented") }),
      hasTask: () => false,
      getTaskTypes: () => []
    },
    taskExecutor: {
      executeTask: async () => ({ success: false, error: new Error("Task executor not implemented") }),
      executeTaskWithDependencies: async () => ({ success: false, error: new Error("Task executor not implemented") }),
      cancelTask: async () => ({ success: true, value: undefined }),
      getTaskStatus: async () => ({ success: false, error: new Error("Task executor not implemented") })
    },
    taskScheduler: {
      scheduleTask: async () => "scheduled-task-placeholder",
      scheduleRecurringTask: async () => "recurring-task-placeholder",
      cancelScheduledTask: async () => true,
      getScheduledTasks: async () => []
    },
    processRegistry: {
      registerProcess: () => ({ success: true, value: undefined }),
      unregisterProcess: () => ({ success: true, value: undefined }),
      getProcessDefinition: () => ({ success: false, error: new Error("Process registry not implemented") }),
      hasProcess: () => false,
      getProcessTypes: () => [],
      findTransition: () => undefined,
      getAllProcessDefinitions: () => []
    },
    processManager: {
      createProcess: async () => ({ success: false, error: new Error("Process manager not implemented") }),
      applyEvent: async () => ({ success: false, error: new Error("Process manager not implemented") }),
      getProcess: async () => ({ success: false, error: new Error("Process manager not implemented") }),
      getProcessesByType: async () => ({ success: true, value: [] }),
      deleteProcess: async () => ({ success: true, value: undefined }),
      isTransitionValid: async () => ({ success: true, value: false }),
      saveCheckpoint: async () => ({ success: false, error: new Error("Process manager not implemented") }),
      restoreFromCheckpoint: async () => ({ success: false, error: new Error("Process manager not implemented") })
    },
    eventStorage
  });
} 