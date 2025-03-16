/**
 * Reactive System DSL Plugin Interfaces
 * 
 * This module defines the interfaces for the plugin system.
 */

/**
 * Plugin hook types
 */
export type PluginHooks = {
  beforeTaskExecution?: (task: any, input: any) => void | Promise<void>;
  afterTaskExecution?: (task: any, input: any, output: any) => void | Promise<void>;
  beforeProcessTransition?: (process: any, event: any) => void | Promise<void>;
  afterProcessTransition?: (process: any, event: any) => void | Promise<void>;
  onSystemStartup?: () => void | Promise<void>;
  onSystemShutdown?: () => void | Promise<void>;
  [key: string]: ((...args: any[]) => void | Promise<void>) | undefined;
};

/**
 * Service operation type
 */
export type ServiceOperation = (...args: any[]) => any | Promise<any>;

/**
 * Plugin service interface
 */
export interface PluginService {
  operations: Record<string, ServiceOperation>;
  [key: string]: any;
}

/**
 * Plugin interface
 */
export interface Plugin {
  id: string;
  name: string;
  description?: string;
  hooks?: PluginHooks;
  services?: Record<string, PluginService>;
  initialize?: (runtime: any) => void | Promise<void>;
}

/**
 * Plugin options for creating a new plugin
 */
export interface PluginOptions {
  id: string;
  name: string;
  description?: string;
  hooks?: PluginHooks;
  services?: Record<string, PluginService>;
  initialize?: (runtime: any) => void | Promise<void>;
}

/**
 * Reactive System DSL interface for plugins
 */
export interface ReactiveSystemDSL {
  /**
   * Register a task type
   */
  registerTaskType(
    name: string, 
    config: {
      defaultInput?: Record<string, any>;
      defaultOutput?: Record<string, any>;
      defaultImplementation?: string;
    }
  ): void;

  /**
   * Register a state type
   */
  registerStateType(
    name: string,
    config: {
      defaultTransitions?: Array<{
        event: string;
        target: string;
        condition?: string;
      }>;
      onEnter?: string;
      onExit?: string;
    }
  ): void;

  /**
   * Register a service
   */
  registerService(
    name: string,
    config: {
      interface?: string;
      mockImplementation?: string;
    }
  ): void;

  /**
   * Get the plugin definition
   */
  getPluginDefinition(): any;
}
