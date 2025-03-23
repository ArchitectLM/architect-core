/**
 * Core Implementations Module
 * 
 * This file exports all the concrete implementations of the core interfaces
 * defined in the models directory.
 */

// Event System
export { 
  ExtensionEventBusImpl, 
  InMemoryEventBus,
  createInMemoryEventBus
} from './event-bus';

export {
  InMemoryEventStorage,
  createEventStorage
} from './event-storage';

export {
  InMemoryEventSource,
  createEventSource
} from './event-source';

// Extension System
export {
  InMemoryExtensionSystem,
  createExtensionSystem
} from './extension-system';

// Cancellation Token
export {
  CancellationTokenImpl
} from './cancellation-token';

// Task System
export {
  InMemoryTaskRegistry,
  createTaskRegistry
} from './task-registry';

export {
  InMemoryTaskExecutor,
  createTaskExecutor
} from './task-executor';

export {
  SimpleTaskScheduler,
  createTaskScheduler
} from './task-scheduler';

// Process System
export {
  createProcessRegistry,
  InMemoryProcessRegistry,
} from './process-registry';

export {
  SimpleProcessManager,
  createProcessManager
} from './process-manager';

// Plugin System
export {
  createPluginRegistry,
  InMemoryPluginRegistry,
} from './plugin-registry';

// Runtime
export {
  RuntimeInstance
} from './runtime';

// Factory functions
export {
  createRuntime,
  createCoreRuntime,
  RuntimeFactoryOptions,
  CoreRuntimeConfig
} from './factory'; 