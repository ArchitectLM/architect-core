import { 
  EventStorage, 
  EventSource,
  Runtime,
  RuntimeOptions,
  ProcessDefinition,
  TaskDefinition,
  EventBus,
  ExtensionSystem,
  TaskRegistry,
  TaskExecutor,
  TaskScheduler,
  ProcessRegistry,
  ProcessManager,
  PluginRegistry,
  TaskExecutionResult,
  ProcessInstance,
  ProcessTransition,
  ProcessCheckpoint,
  Plugin,
  PluginState,
  Result,
  Identifier,
  DomainEvent,
  Metadata
} from '../models';

import { DomainError } from '../utils';
import { createInMemoryEventBus } from './event-bus';
import { createEventStorage } from './event-storage';
import { createExtensionSystem } from './extension-system';
import { RuntimeInstance } from './runtime';
import { v4 as uuidv4 } from 'uuid';
import { InMemoryTaskRegistry } from './task-registry';
import { InMemoryProcessRegistry } from './process-registry';
import { InMemoryTaskScheduler } from './task-scheduler';

/**
 * Configuration for creating a core runtime instance
 */
export interface CoreRuntimeConfig {
  /** Optional extension system implementation */
  extensionSystem?: ExtensionSystem;
  
  /** Optional event bus implementation */
  eventBus?: EventBus;
  
  /** Optional event storage implementation */
  eventStorage?: EventStorage;
  
  /** Whether to enable event persistence */
  enableEventPersistence?: boolean;
}

/**
 * Options for configuring a runtime instance
 */
export interface RuntimeFactoryOptions {
  /** Process definitions to register */
  processDefinitions?: Record<string, ProcessDefinition>;
  
  /** Task definitions to register */
  taskDefinitions?: Record<string, TaskDefinition>;
  
  /** Whether to persist events */
  persistEvents?: boolean;
  
  /** Custom components (use your own implementations) */
  components?: {
    eventBus?: EventBus;
    extensionSystem?: ExtensionSystem;
    eventStorage?: EventStorage;
    taskRegistry?: TaskRegistry;
    taskExecutor?: TaskExecutor;
    taskScheduler?: TaskScheduler;
    processRegistry?: ProcessRegistry;
    processManager?: ProcessManager;
    pluginRegistry?: PluginRegistry;
    eventSource?: EventSource;
  };
  
  /** Runtime initialization options */
  runtimeOptions?: RuntimeOptions;
}

/**
 * Create a runtime instance with all dependencies properly configured
 * @param options Configuration options for the runtime
 * @returns An initialized Runtime instance
 */
export function createRuntime(options: RuntimeFactoryOptions = {}): Runtime {
  try {
    // Create core components
    const extensionSystem = options.components?.extensionSystem ?? createExtensionSystem();
    const eventBus = options.components?.eventBus ?? createInMemoryEventBus(extensionSystem);
    const eventStorage = options.persistEvents 
      ? (options.components?.eventStorage ?? createEventStorage()) 
      : undefined;
    
    // Create runtime with adapters for backward compatibility
    const runtime = new RuntimeInstance({
      eventBus,
      extensionSystem,
      pluginRegistry: options.components?.pluginRegistry ?? ({} as PluginRegistry),
      taskRegistry: options.components?.taskRegistry ?? ({} as TaskRegistry),
      taskExecutor: options.components?.taskExecutor ?? ({} as TaskExecutor),
      taskScheduler: options.components?.taskScheduler ?? ({} as TaskScheduler),
      processRegistry: options.components?.processRegistry ?? ({} as ProcessRegistry),
      processManager: options.components?.processManager ?? ({} as ProcessManager),
      eventStorage,
      eventSource: options.components?.eventSource
    });

    // Register any provided process definitions
    if (options.processDefinitions) {
      for (const definition of Object.values(options.processDefinitions)) {
        try {
          runtime.processRegistry.registerProcess(definition);
        } catch (error) {
          console.warn(`Failed to register process definition: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    // Register any provided task definitions
    if (options.taskDefinitions) {
      for (const definition of Object.values(options.taskDefinitions)) {
        try {
          runtime.taskRegistry.registerTask(definition);
        } catch (error) {
          console.warn(`Failed to register task definition: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    
    return runtime as Runtime;
  } catch (error) {
    console.error('Failed to create runtime:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Create a simple runtime with core functionality and minimal dependencies
 * This is primarily used for testing and simple use cases.
 * 
 * @param config Configuration for the core runtime
 * @returns A RuntimeInstance with core functionality
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
  
  // For compatibility with tests, create a minimal runtime with placeholders
  return new RuntimeInstance({
    eventBus,
    extensionSystem,
    pluginRegistry: {} as PluginRegistry,
    taskRegistry: {} as TaskRegistry,
    taskExecutor: {} as TaskExecutor,
    taskScheduler: {} as TaskScheduler,
    processRegistry: {} as ProcessRegistry,
    processManager: {} as ProcessManager,
    eventStorage
  });
}

/**
 * Create an empty plugin registry
 */
export function createEmptyPluginRegistry(): PluginRegistry {
  const plugins = new Map<string, Plugin<PluginState>>();
  
  return {
    registerPlugin(plugin: Plugin<PluginState>): Result<void> {
      try {
        if (!plugin.id) {
          return {
            success: false,
            error: new DomainError(`Plugin must have an ID`)
          };
        }
        
        if (plugins.has(plugin.id)) {
          return {
            success: false,
            error: new DomainError(`Plugin with ID ${plugin.id} already exists`)
          };
        }
        
        plugins.set(plugin.id, plugin);
        return { success: true, value: undefined };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },
    
    unregisterPlugin(pluginId: string): Result<void> {
      try {
        if (!plugins.has(pluginId)) {
          return { 
            success: false, 
            error: new DomainError(`Plugin with ID ${pluginId} does not exist`)
          };
        }
        
        plugins.delete(pluginId);
        return { success: true, value: undefined };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },
    
    getPlugin<TState extends PluginState>(pluginId: Identifier): Result<Plugin<TState>> {
      try {
        const plugin = plugins.get(pluginId);
        
        if (!plugin) {
          return { 
            success: false, 
            error: new DomainError(`Plugin with ID ${pluginId} not found`)
          };
        }
        
        return { success: true, value: plugin as Plugin<TState> };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },
    
    getAllPlugins(): Plugin<PluginState>[] {
      return Array.from(plugins.values());
    },
    
    getPluginsWithCapability(capabilityId: string): Plugin<PluginState>[] {
      return Array.from(plugins.values()).filter(plugin => 
        plugin.hasCapability(capabilityId)
      );
    }
  };
}

/**
 * Create an empty task registry
 * @returns An empty task registry
 */
export function createEmptyTaskRegistry(): TaskRegistry {
  return new InMemoryTaskRegistry();
}

/**
 * Create an empty process registry
 * @returns An empty process registry
 */
export function createEmptyProcessRegistry(): ProcessRegistry {
  return new InMemoryProcessRegistry();
}

/**
 * Create an empty process manager (placeholder implementation)
 */
export function createEmptyProcessManager(): ProcessManager {
  return {
    async createProcess() {
      return {
        success: false,
        error: new DomainError('Not implemented')
      };
    },
    
    async getProcess() {
      return {
        success: false,
        error: new DomainError('Not implemented')
      };
    },
    
    async applyEvent() {
      return {
        success: false,
        error: new DomainError('Not implemented')
      };
    },
    
    async getProcessesByType() {
      return {
        success: false,
        error: new DomainError('Not implemented')
      };
    },
    
    async deleteProcess() {
      return {
        success: false,
        error: new DomainError('Not implemented')
      };
    },
    
    async isTransitionValid() {
      return {
        success: false,
        error: new DomainError('Not implemented')
      };
    },
    
    async saveCheckpoint() {
      return {
        success: false,
        error: new DomainError('Not implemented')
      };
    },
    
    async restoreFromCheckpoint() {
      return {
        success: false,
        error: new DomainError('Not implemented')
      };
    }
  };
}

/**
 * Create an empty task scheduler
 * @returns An empty task scheduler
 */
export function createEmptyTaskScheduler(): TaskScheduler {
  // Create a task registry and a basic task executor for the scheduler
  const taskRegistry = createEmptyTaskRegistry();
  const taskExecutor: TaskExecutor = {
    async executeTask() {
      return {
        success: false,
        error: new DomainError('Task execution not implemented')
      };
    },
    
    async executeTaskWithDependencies() {
      return {
        success: false,
        error: new DomainError('Task execution with dependencies not implemented')
      };
    },
    
    async cancelTask() {
      return {
        success: false,
        error: new DomainError('Task cancellation not implemented')
      };
    },
    
    async getTaskStatus() {
      return {
        success: false,
        error: new DomainError('Get task status not implemented')
      };
    }
  };
  
  return new InMemoryTaskScheduler(taskRegistry, taskExecutor);
} 