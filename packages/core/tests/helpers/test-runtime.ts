import { Runtime, RuntimeOptions, SystemHealth } from '../../src/models/runtime';
import { Result, DomainEvent, Identifier } from '../../src/models/core-types';
import { EventBus, EventStorage, EventSource, EventHandler, Subscription } from '../../src/models/event-system';
import { ProcessManager, ProcessRegistry, ProcessInstance } from '../../src/models/process-system';
import { TaskExecutor, TaskRegistry, TaskScheduler, TaskExecutionResult } from '../../src/models/task-system';
import { ExtensionSystem } from '../../src/models/extension-system';
import { PluginRegistry } from '../../src/models/plugin-system';

/**
 * Extended Runtime interface that exposes internal components
 * for testing purposes. This doesn't directly extend Runtime because
 * the return types in the actual implementation differ from the interface.
 */
export interface TestRuntime {
  // Access to core components for testing
  eventBus: EventBus;
  eventStorage?: EventStorage;
  eventSource?: EventSource;
  extensionSystem: ExtensionSystem;
  processRegistry: ProcessRegistry;
  processManager: ProcessManager;
  taskRegistry: TaskRegistry;
  taskExecutor: TaskExecutor;
  taskScheduler: TaskScheduler;
  pluginRegistry: PluginRegistry;
  
  // Runtime properties
  version?: string;
  namespace?: string;
  
  // Runtime methods adapted for implementation
  createProcess<TData = Record<string, unknown>, TState extends string = string>(
    processType: string, 
    data: TData
  ): Promise<Result<ProcessInstance<TState, TData>>>;
  
  transitionProcess<TData = Record<string, unknown>, TState extends string = string>(
    processId: Identifier,
    eventType: string,
    payload?: Record<string, unknown>
  ): Promise<Result<ProcessInstance<TState, TData>>>;
  
  executeTask<TInput = Record<string, unknown>, TOutput = unknown>(
    taskType: string, 
    input: TInput
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>>;
  
  executeTaskWithDependencies<TInput = Record<string, unknown>, TOutput = unknown>(
    taskType: string, 
    input: TInput, 
    dependencies: string[]
  ): Promise<Result<TaskExecutionResult<TInput, TOutput>>>;
  
  // Event methods
  subscribe<T = unknown>(
    eventType: string, 
    handler: EventHandler<T>
  ): Subscription;
  
  publish<T = unknown>(
    event: DomainEvent<T>
  ): Promise<void>;
  
  persistEvent<T = unknown>(
    event: DomainEvent<T>
  ): Promise<void>;
  
  replayEvents(
    startTime: number, 
    endTime: number, 
    eventTypes?: string[]
  ): Promise<void>;
  
  correlateEvents(
    correlationId: string
  ): Promise<DomainEvent<unknown>[]>;
  
  // Metrics methods
  getProcessMetrics(): Promise<any>;
  getTaskMetrics(): Promise<any>;
  getEventMetrics(): Promise<any>;
  getHealthStatus(): Promise<SystemHealth>;
  
  // Additional methods for lifecycle management
  getHealth(): Promise<Result<SystemHealth>>;
  shutdown(): Promise<void>;
  restart(): Promise<void>;
  initialize(options?: Record<string, unknown>): Promise<void>;
  
  // Scheduling methods
  scheduleTask<TInput = unknown>(
    taskType: string,
    input: TInput,
    scheduledTime: number
  ): Promise<Result<string>>;
  
  // Plugin methods
  registerPlugin(plugin: any): Promise<Result<void>>;
  unregisterPlugin(pluginId: string): Promise<Result<void>>;
  
  // Extension methods
  registerExtension(extension: any): Promise<Result<void>>;
  unregisterExtension(extensionId: string): Promise<Result<void>>;
}

/**
 * Cast a runtime to a TestRuntime
 * Use this carefully and only in test code!
 */
export function asTestRuntime(runtime: Runtime): TestRuntime {
  // This cast is unsafe but necessary for testing
  return runtime as unknown as TestRuntime;
} 