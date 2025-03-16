/**
 * Reactive System DSL Plugin Architecture
 * 
 * This module defines a plugin architecture for extending the reactive system DSL
 * with new capabilities. Plugins can add new task types, state types, services,
 * and other extensions to the DSL.
 */

import { ReactiveSystemBuilder, TaskBuilder, ProcessBuilder, StateBuilder } from './reactive-system';
import { PluginDefinition, ServiceDefinition, TaskDefinition } from './reactive-system';

/**
 * Enhanced Plugin System
 * 
 * This extends the original plugin architecture with runtime hooks, service registration,
 * and initialization capabilities.
 */

/**
 * Hook types for plugin extension points
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
 * Service definition for plugins
 */
export interface PluginService {
  operations: Record<string, ServiceOperation>;
  [key: string]: any;
}

/**
 * Enhanced plugin interface
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
 * Plugin definition options
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
 * Define a new plugin
 */
export function definePlugin(options: PluginOptions): Plugin {
  return {
    id: options.id,
    name: options.name,
    description: options.description,
    hooks: options.hooks,
    services: options.services,
    initialize: options.initialize
  };
}

/**
 * Plugin manager for registering and managing plugins
 */
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private runtime: any;

  constructor(runtime: any) {
    this.runtime = runtime;
  }

  /**
   * Register a plugin with the system
   */
  registerPlugin(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id '${plugin.id}' is already registered`);
    }

    // Register hooks
    if (plugin.hooks) {
      for (const [hookName, hookFn] of Object.entries(plugin.hooks)) {
        if (hookFn) {
          this.runtime.registerHook(hookName, hookFn);
        }
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

    this.plugins.set(plugin.id, plugin);
  }

  /**
   * Get a registered plugin by id
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

// Keep the original plugin interface for backward compatibility
/**
 * Plugin interface for extending the DSL
 */
export interface ReactiveSystemPlugin {
  name: string;
  description?: string;
  extend(dsl: ReactiveSystemDSL): void;
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
  // Changed from private to protected to allow access in derived classes
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
      services: []
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
      mockImplementation: config.mockImplementation
    };
  }

  /**
   * Get the plugin definition
   */
  getPluginDefinition(): PluginDefinition {
    return this.plugin;
  }

  /**
   * Get all registered task types
   */
  getTaskTypes(): Record<string, any> {
    return this.taskTypes;
  }

  /**
   * Get all registered state types
   */
  getStateTypes(): Record<string, any> {
    return this.stateTypes;
  }

  /**
   * Get all registered services
   */
  getServices(): Record<string, ServiceDefinition> {
    return this.services;
  }
}

/**
 * Create a plugin for the reactive system DSL
 */
export function createPlugin(name: string, description?: string): ReactiveSystemPlugin {
  const dslExtension = new ReactiveSystemDSLExtension(name, description);
  
  return {
    name,
    description,
    extend: (dslInstance: ReactiveSystemDSL) => {
      // Register task types
      for (const [name, config] of Object.entries(dslExtension.getTaskTypes())) {
        dslInstance.registerTaskType(name, config);
      }

      // Register state types
      for (const [name, config] of Object.entries(dslExtension.getStateTypes())) {
        dslInstance.registerStateType(name, config);
      }

      // Register services
      for (const [name, config] of Object.entries(dslExtension.getServices())) {
        dslInstance.registerService(name, {
          interface: config.interface,
          mockImplementation: config.mockImplementation
        });
      }
    }
  };
}

/**
 * Example payment processing plugin
 */
export const PaymentProcessingPlugin: ReactiveSystemPlugin = {
  name: 'payment-processing',
  description: 'Plugin for payment processing capabilities',
  extend(dsl: ReactiveSystemDSL): void {
    // Register payment-specific task types
    dsl.registerTaskType('ProcessPayment', {
      defaultInput: {
        amount: { type: 'number', required: true },
        currency: { type: 'string', default: 'USD' },
        paymentMethod: { type: 'string', required: true }
      },
      defaultOutput: {
        success: { type: 'boolean', required: true },
        transactionId: { type: 'string', required: false },
        errorMessage: { type: 'string', required: false }
      },
      defaultImplementation: `
        async function processPayment(input, context) {
          const paymentService = context.services.payment;
          try {
            const result = await paymentService.processPayment({
              amount: input.amount,
              currency: input.currency,
              method: input.paymentMethod
            });
            
            if (result.success) {
              return {
                success: true,
                transactionId: result.transactionId
              };
            } else {
              return {
                success: false,
                errorMessage: result.errorMessage
              };
            }
          } catch (error) {
            context.logger.error('Payment processing failed', error);
            return {
              success: false,
              errorMessage: error.message
            };
          }
        }
      `
    });
    
    // Register payment-specific state types
    dsl.registerStateType('PaymentProcessing', {
      defaultTransitions: [
        { event: 'PaymentSucceeded', target: '{{successState}}' },
        { event: 'PaymentFailed', target: '{{failureState}}' }
      ],
      onEnter: `
        async function onEnter(context) {
          context.logger.info('Entering payment processing state');
          
          // Start payment processing
          const paymentTask = context.getTask('ProcessPayment');
          const result = await paymentTask.execute({
            amount: context.data.amount,
            currency: context.data.currency,
            paymentMethod: context.data.paymentMethod
          });
          
          if (result.success) {
            context.data.transactionId = result.transactionId;
            context.emitEvent('PaymentSucceeded', { transactionId: result.transactionId });
          } else {
            context.data.errorMessage = result.errorMessage;
            context.emitEvent('PaymentFailed', { errorMessage: result.errorMessage });
          }
        }
      `
    });
    
    // Register payment-specific services
    dsl.registerService('payment', {
      interface: `
        interface PaymentService {
          processPayment(options: {
            amount: number;
            currency: string;
            method: string;
            metadata?: Record<string, any>;
          }): Promise<{
            success: boolean;
            transactionId?: string;
            errorMessage?: string;
          }>;
          
          refundPayment(transactionId: string): Promise<{
            success: boolean;
            errorMessage?: string;
          }>;
        }
      `,
      mockImplementation: `
        class MockPaymentService implements PaymentService {
          async processPayment(options) {
            // Mock implementation for testing
            console.log('Processing payment:', options);
            
            // Simulate success for most payments
            if (options.amount > 0 && options.amount < 10000) {
              return { 
                success: true, 
                transactionId: 'mock-tx-' + Date.now() 
              };
            } else {
              return { 
                success: false, 
                errorMessage: 'Invalid amount' 
              };
            }
          }
          
          async refundPayment(transactionId) {
            // Mock implementation for testing
            console.log('Refunding payment:', transactionId);
            
            // Simulate success for most refunds
            if (transactionId.startsWith('mock-tx-')) {
              return { success: true };
            } else {
              return { 
                success: false, 
                errorMessage: 'Invalid transaction ID' 
              };
            }
          }
        }
      `
    });
  }
}; 