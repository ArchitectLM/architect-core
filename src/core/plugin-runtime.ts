/**
 * Plugin-Enabled Runtime
 * 
 * This module provides a runtime implementation with enhanced plugin support.
 */

import { createRuntime } from './runtime';
import { Plugin, PluginManager } from './dsl/plugin';
import { 
  SystemConfig, 
  ProcessDefinition, 
  TaskDefinition, 
  Runtime,
  ProcessInstance,
  Event,
  EventHandler,
  Subscription,
  ProcessOptions,
  TaskOptions,
  Extension
} from './types';

/**
 * Hook function type for runtime hooks
 */
export type HookFunction = (...args: any[]) => void | Promise<void>;

/**
 * Plugin-enabled runtime that extends the base Runtime interface
 */
export class PluginRuntime implements Runtime {
  private baseRuntime: Runtime;
  private hooks: Map<string, HookFunction[]> = new Map();
  private pluginManager: PluginManager;
  private services: Map<string, any> = new Map();

  constructor(baseRuntime: Runtime) {
    this.baseRuntime = baseRuntime;
    this.pluginManager = new PluginManager(this);
  }

  // Runtime interface implementation - delegate to base runtime
  createProcess<TContext = any>(
    processId: string, 
    input: TContext, 
    options?: ProcessOptions
  ): ProcessInstance {
    return this.baseRuntime.createProcess(processId, input, options);
  }

  getProcess(instanceId: string): ProcessInstance | undefined {
    return this.baseRuntime.getProcess(instanceId);
  }

  transitionProcess<TEvent extends string = string, TPayload = any>(
    instanceId: string, 
    event: TEvent | Event<TEvent, TPayload>
  ): ProcessInstance {
    return this.baseRuntime.transitionProcess(instanceId, event);
  }

  async executeTask<Input = any, Output = any>(
    taskId: string, 
    input: Input, 
    options?: TaskOptions
  ): Promise<Output> {
    return this.baseRuntime.executeTask(taskId, input, options);
  }

  emitEvent<TEvent extends string = string, TPayload = any>(
    event: TEvent | Event<TEvent, TPayload>, 
    payload?: TPayload
  ): void {
    this.baseRuntime.emitEvent(event, payload);
  }

  subscribeToEvent<TEvent extends string = string, TPayload = any>(
    type: TEvent | '*', 
    handler: EventHandler<TEvent, TPayload>
  ): Subscription {
    return this.baseRuntime.subscribeToEvent(type, handler);
  }

  registerExtension(extension: Extension): void {
    this.baseRuntime.registerExtension(extension);
  }

  getExtension<T extends Extension>(name: string): T | undefined {
    return this.baseRuntime.getExtension<T>(name);
  }

  getService<T>(name: string): T {
    if (this.services.has(name)) {
      return this.services.get(name);
    }
    return this.baseRuntime.getService(name);
  }

  registerService<T>(name: string, service: T): void {
    if (this.services.has(name)) {
      throw new Error(`Service with name '${name}' is already registered`);
    }
    this.services.set(name, service);
  }

  getTaskDefinition(taskId: string): TaskDefinition | undefined {
    return this.baseRuntime.getTaskDefinition(taskId);
  }

  getProcessDefinition(processId: string): ProcessDefinition | undefined {
    return this.baseRuntime.getProcessDefinition(processId);
  }

  // Additional methods required by Runtime interface
  getAllProcesses(): ProcessInstance[] {
    return (this.baseRuntime as any).getAllProcesses();
  }

  getProcessesByType(processId: string): ProcessInstance[] {
    return (this.baseRuntime as any).getProcessesByType(processId);
  }

  getProcessesByState(state: string): ProcessInstance[] {
    return (this.baseRuntime as any).getProcessesByState(state);
  }

  getAvailableTasks(): string[] {
    return (this.baseRuntime as any).getAvailableTasks();
  }

  getAvailableProcesses(): string[] {
    return (this.baseRuntime as any).getAvailableProcesses();
  }

  // Additional methods for the plugin system
  registerHook(name: string, fn: HookFunction): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    this.hooks.get(name)!.push(fn);
  }

  async triggerHook(name: string, ...args: any[]): Promise<void> {
    const hookFunctions = this.hooks.get(name);
    if (hookFunctions) {
      for (const fn of hookFunctions) {
        await fn(...args);
      }
    }
  }

  registerPlugin(plugin: Plugin): void {
    this.pluginManager.registerPlugin(plugin);
  }

  async shutdown(): Promise<void> {
    await this.triggerHook('onSystemShutdown');
  }
}

/**
 * Create a plugin-enabled runtime
 */
export function createPluginRuntime(
  config: SystemConfig | Record<string, ProcessDefinition>,
  tasks?: Record<string, TaskDefinition>,
  plugins: Plugin[] = []
): PluginRuntime {
  // Create the base runtime
  const baseRuntime = createRuntime(config, tasks);
  
  // Create the plugin-enabled runtime
  const pluginRuntime = new PluginRuntime(baseRuntime);
  
  // Register plugins
  for (const plugin of plugins) {
    pluginRuntime.registerPlugin(plugin);
  }
  
  // Trigger system startup hook after plugins are registered
  pluginRuntime.triggerHook('onSystemStartup');
  
  return pluginRuntime;
} 