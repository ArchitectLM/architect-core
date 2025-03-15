/**
 * Plugin system for extending the DSL
 */

import { ReactiveSystemBuilder } from './reactive-system';
import { ProcessBuilder } from './builders/process-builder';
import { TaskBuilder } from './builders/task-builder';
import { StateBuilder } from './builders/state-builder';
import { PluginDefinition, ServiceDefinition, TaskDefinition } from './types/index';

/**
 * Plugin interface
 */
export interface Plugin {
  id: string;
  name: string;
  description?: string;
  hooks?: Record<string, Function>;
  services?: Record<string, { operations: Record<string, Function> }>;
  initialize?: (runtime: any) => void;
}

/**
 * Define a plugin
 */
export function definePlugin(config: {
  id: string;
  name: string;
  description?: string;
  hooks?: Record<string, Function>;
  services?: Record<string, { operations: Record<string, Function> }>;
  initialize?: (runtime: any) => void;
}): Plugin {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    hooks: config.hooks,
    services: config.services,
    initialize: config.initialize,
  };
}

/**
 * Plugin manager for registering and managing plugins
 */
export class PluginManager {
  private runtime: any;
  private plugins: Map<string, Plugin> = new Map();

  constructor(runtime: any) {
    this.runtime = runtime;
  }

  /**
   * Register a plugin with the runtime
   */
  registerPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id ${plugin.id} already registered`);
    }

    this.plugins.set(plugin.id, plugin);

    // Register hooks
    if (plugin.hooks) {
      for (const [hookName, hookFn] of Object.entries(plugin.hooks)) {
        this.runtime.registerHook(hookName, hookFn);
      }
    }

    // Register services
    if (plugin.services) {
      for (const [serviceName, service] of Object.entries(plugin.services)) {
        this.runtime.registerService(serviceName, service);
      }
    }

    // Initialize plugin
    if (plugin.initialize) {
      plugin.initialize(this.runtime);
    }
  }

  /**
   * Get a plugin by id
   */
  getPlugin(id: string): Plugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }
}

/**
 * DSL extension interface
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
  getPluginDefinition(): PluginDefinition;
}

/**
 * DSL extension implementation
 */
export class ReactiveSystemDSLExtension implements ReactiveSystemDSL {
  protected taskTypes: Record<string, any> = {};
  protected stateTypes: Record<string, any> = {};
  protected services: Record<string, ServiceDefinition> = {};
  private plugin: PluginDefinition;

  constructor(name: string, description?: string) {
    this.plugin = {
      name,
      description,
      tasks: [],
      states: [],
      services: [],
    };
  }

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
  ): void {
    this.taskTypes[name] = config;
  }

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
  ): void {
    this.stateTypes[name] = config;
  }

  /**
   * Register a service
   */
  registerService(
    name: string,
    config: {
      interface?: string;
      mockImplementation?: string;
    }
  ): void {
    this.services[name] = {
      name,
      interface: config.interface,
      mockImplementation: config.mockImplementation,
    };
  }

  /**
   * Get the plugin definition
   */
  getPluginDefinition(): PluginDefinition {
    return this.plugin;
  }
}

/**
 * Example Payment Processing Plugin
 */
export const PaymentProcessingPlugin = {
  name: 'payment-processing',
  description: 'Plugin for payment processing functionality',
  extend: (dsl: ReactiveSystemDSL) => {
    // Register payment task types
    dsl.registerTaskType('payment.authorize', {
      defaultInput: { amount: 0, currency: 'USD' },
      defaultOutput: { authorized: false, transactionId: '' },
      defaultImplementation:
        'return { authorized: true, transactionId: "tx_" + Math.random().toString(36).substring(2, 15) };',
    });

    dsl.registerTaskType('payment.capture', {
      defaultInput: { transactionId: '' },
      defaultOutput: { captured: false, receipt: '' },
      defaultImplementation:
        'return { captured: true, receipt: "receipt_" + Math.random().toString(36).substring(2, 15) };',
    });

    // Register payment service
    dsl.registerService('paymentGateway', {
      interface:
        'interface PaymentGateway { authorize(amount: number): Promise<string>; capture(transactionId: string): Promise<string>; }',
      mockImplementation:
        'return { authorize: async () => "tx_mock", capture: async () => "receipt_mock" };',
    });
  },
};
