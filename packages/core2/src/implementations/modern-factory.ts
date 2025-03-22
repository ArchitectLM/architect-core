import { 
  EventStorage, 
  EventSource,
  Runtime,
  RuntimeOptions,
} from '../models/index';

import { InMemoryEventBus } from './event-bus';
import { InMemoryEventStorage } from './event-storage-impl';
import { InMemoryEventSource } from './event-source';
import { InMemoryExtensionSystem } from './extension-system';
import { RuntimeInstance } from './runtime';
import { InMemoryTaskRegistry } from './task-registry';
import { InMemoryTaskExecutor } from './task-executor';
import { SimpleProcessRegistry } from './process-registry';
import { SimpleTaskScheduler } from './task-scheduler';
import { SimpleProcessManager } from './process-manager';
import { SimplePluginRegistry } from './plugin-registry';

/**
 * Options for configuring the modern runtime
 */
export interface ModernRuntimeOptions {
  /** Whether to persist events */
  persistEvents?: boolean;
  
  /** Configuration for extension points */
  extensions?: {
    /** Whether to enable process management */
    processManagement?: boolean;
    /** Whether to enable task management */
    taskManagement?: boolean;
    /** Whether to enable plugin management */
    pluginManagement?: boolean;
  };
  
  /** Runtime initialization options */
  runtimeOptions?: {
    /** Runtime version */
    version?: string;
    /** Runtime namespace */
    namespace?: string;
  };
}

/**
 * Create a modern runtime with all dependencies
 * @param options Runtime configuration options
 * @returns An initialized Runtime instance
 */
export function createModernRuntime(options: ModernRuntimeOptions = {}): Runtime {
  // Create core services
  const eventBus = new InMemoryEventBus();
  const extensionSystem = new InMemoryExtensionSystem();
  const taskRegistry = new InMemoryTaskRegistry();
  const taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus);
  const taskScheduler = new SimpleTaskScheduler(taskExecutor);
  const processRegistry = new SimpleProcessRegistry();
  const processManager = new SimpleProcessManager(processRegistry, taskExecutor);
  const pluginRegistry = new SimplePluginRegistry();
  
  // Event persistence (optional)
  let eventStorage: EventStorage | undefined;
  let eventSource: EventSource | undefined;
  
  if (options.persistEvents) {
    eventStorage = new InMemoryEventStorage();
    eventSource = new InMemoryEventSource(eventStorage, eventBus);
  }
  
  // Create runtime
  const runtime = new RuntimeInstance({
    eventBus,
    extensionSystem,
    pluginRegistry,
    taskRegistry,
    taskExecutor,
    taskScheduler,
    processRegistry,
    processManager,
    eventStorage,
    eventSource
  });
  
  // Initialize with options if provided
  if (options.runtimeOptions) {
    const runtimeOptions: RuntimeOptions = {
      version: options.runtimeOptions.version || '1.0.0',
      namespace: options.runtimeOptions.namespace || `modern-runtime-${Date.now()}`
    };
    
    runtime.initialize(runtimeOptions).catch(error => {
      console.error('Failed to initialize runtime:', error);
    });
  }
  
  return runtime;
} 