import { Extension, ExtensionHook, ExtensionPointName, ExtensionPointParameters, ExtensionHookRegistration } from './extension-system';
import { Identifier, Metadata, Result } from './core-types';

/**
 * Plugin capability registration
 */
export interface PluginCapability<T = unknown> {
  /** Unique capability identifier */
  id: Identifier;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Implementation for this capability */
  implementation: T;
  
  /** Metadata for this capability */
  metadata?: Metadata;
}

/**
 * Base plugin state interface
 */
export interface PluginState {
  /** Unique identifier for the plugin instance */
  id: Identifier;
  
  /** Plugin configuration */
  config: Record<string, unknown>;
  
  /** Plugin persisted data */
  data: Record<string, unknown>;
  
  /** Plugin status information */
  status: {
    enabled: boolean;
    lastError?: Error;
    lastActionTimestamp?: number;
  };
}

/**
 * Plugin lifecycle events
 */
export interface PluginLifecycle {
  /**
   * Initialize the plugin
   * @param config Initial plugin configuration
   */
  initialize(config: Record<string, unknown>): Promise<Result<void>>;
  
  /**
   * Start the plugin after initialization
   */
  start(): Promise<Result<void>>;
  
  /**
   * Stop the plugin
   */
  stop(): Promise<Result<void>>;
  
  /**
   * Clean up resources before plugin is unloaded
   */
  cleanup(): Promise<Result<void>>;
}

/**
 * Base plugin interface
 */
export interface Plugin<TState extends PluginState = PluginState> extends Extension {
  /** Plugin lifecycle methods */
  lifecycle: PluginLifecycle;
  
  /** Get the current plugin state */
  getState(): TState;
  
  /** Update the plugin state */
  setState(state: Partial<TState>): Result<void>;
  
  /** Get a specific plugin capability */
  getCapability<T>(capabilityId: string): Result<PluginCapability<T>>;
  
  /** Check if the plugin has a specific capability */
  hasCapability(capabilityId: string): boolean;
  
  /** Register a new hook */
  registerHook<N extends ExtensionPointName>(
    pointName: N,
    hook: ExtensionHook<N, TState['data']>,
    priority: number
  ): Result<void>;
  
  /** Check plugin health */
  healthCheck(): Result<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, unknown>;
  }>;
}

/**
 * Base plugin options
 */
export interface PluginOptions {
  /** Plugin identifier */
  id: Identifier;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Initial plugin configuration */
  config?: Record<string, unknown>;
  
  /** Plugin dependencies */
  dependencies?: Identifier[];
  
  /** Plugin metadata */
  metadata?: Metadata;
}

/**
 * Plugin registry for managing plugins
 */
export interface PluginRegistry {
  /**
   * Register a plugin
   * @param plugin The plugin to register
   */
  registerPlugin(plugin: Plugin): Result<void>;
  
  /**
   * Unregister a plugin
   * @param pluginId The ID of the plugin to unregister
   */
  unregisterPlugin(pluginId: Identifier): Result<void>;
  
  /**
   * Get a plugin by ID
   * @param pluginId The ID of the plugin to retrieve
   */
  getPlugin<TState extends PluginState>(pluginId: Identifier): Result<Plugin<TState>>;
  
  /**
   * Get all registered plugins
   */
  getAllPlugins(): Plugin[];
  
  /**
   * Get plugins that provide a specific capability
   * @param capabilityId The capability ID to search for
   */
  getPluginsWithCapability(capabilityId: string): Plugin[];
}

/**
 * Abstract base plugin implementation
 */
export abstract class BasePlugin<TState extends PluginState = PluginState> implements Plugin<TState> {
  /** Unique extension identifier */
  id: Identifier;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Extensions this extension depends on */
  dependencies: Identifier[];
  
  /** Plugin state */
  protected state: TState;
  
  /** Registered extension hooks */
  private hooks = new Map<
    ExtensionPointName,
    Array<{
      hook: ExtensionHook<ExtensionPointName, TState['data']>;
      priority: number;
    }>
  >();
  
  /** Registered capabilities */
  private capabilities = new Map<string, PluginCapability>();
  
  /**
   * Create a new BasePlugin instance
   * @param options Plugin options
   */
  constructor(options: PluginOptions) {
    this.id = options.id;
    this.name = options.name;
    this.description = options.description;
    this.dependencies = options.dependencies || [];
    
    // Initialize state with default values
    this.state = {
      id: options.id,
      config: options.config || {},
      data: {},
      status: {
        enabled: false
      }
    } as TState;
  }
  
  /** Plugin lifecycle methods */
  lifecycle: PluginLifecycle = {
    initialize: async (config: Record<string, unknown>): Promise<Result<void>> => {
      try {
        this.setState({
          config: {
            ...this.state.config,
            ...config
          }
        } as Partial<TState>);
        
        return { success: true, value: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },
    
    start: async (): Promise<Result<void>> => {
      try {
        this.setState({
          status: {
            ...this.state.status,
            enabled: true,
            lastActionTimestamp: Date.now()
          }
        } as Partial<TState>);
        
        return { success: true, value: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },
    
    stop: async (): Promise<Result<void>> => {
      try {
        this.setState({
          status: {
            ...this.state.status,
            enabled: false,
            lastActionTimestamp: Date.now()
          }
        } as Partial<TState>);
        
        return { success: true, value: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },
    
    cleanup: async (): Promise<Result<void>> => {
      try {
        // Clean up resources
        return { success: true, value: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    }
  };
  
  /**
   * Get all hook registrations for this extension
   */
  getHooks(): ExtensionHookRegistration<ExtensionPointName, unknown>[] {
    const registrations: ExtensionHookRegistration<ExtensionPointName, unknown>[] = [];
    
    for (const [pointName, hooks] of this.hooks.entries()) {
      // Sort hooks by priority (higher priority first)
      const sortedHooks = [...hooks].sort((a, b) => b.priority - a.priority);
      
      for (const { hook, priority } of sortedHooks) {
        registrations.push({
          pointName,
          hook: hook as unknown as ExtensionHook<ExtensionPointName, unknown>,
          priority
        });
      }
    }
    
    return registrations;
  }
  
  /**
   * Get the version of this extension
   */
  getVersion(): string {
    return '1.0.0';
  }
  
  /**
   * Get capabilities provided by this extension
   */
  getCapabilities(): string[] {
    return Array.from(this.capabilities.keys());
  }
  
  /**
   * Get the current plugin state
   */
  getState(): TState {
    return this.state;
  }
  
  /**
   * Update the plugin state
   * @param partialState The parts of the state to update
   */
  setState(partialState: Partial<TState>): Result<void> {
    try {
      this.state = {
        ...this.state,
        ...partialState,
        // Preserve nested objects by merging them
        data: {
          ...this.state.data,
          ...(partialState.data || {})
        },
        status: {
          ...this.state.status,
          ...(partialState.status || {})
        }
      } as TState;
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Register a plugin capability
   * @param capability The capability to register
   */
  protected registerCapability<T>(capability: PluginCapability<T>): Result<void> {
    try {
      if (this.capabilities.has(capability.id)) {
        return {
          success: false,
          error: new Error(`Capability ${capability.id} is already registered`)
        };
      }
      
      this.capabilities.set(capability.id, capability);
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Get a specific plugin capability
   * @param capabilityId The ID of the capability to retrieve
   */
  getCapability<T>(capabilityId: string): Result<PluginCapability<T>> {
    const capability = this.capabilities.get(capabilityId) as PluginCapability<T>;
    
    if (!capability) {
      return {
        success: false,
        error: new Error(`Capability ${capabilityId} not found`)
      };
    }
    
    return { success: true, value: capability };
  }
  
  /**
   * Check if the plugin has a specific capability
   * @param capabilityId The ID of the capability to check
   */
  hasCapability(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }
  
  /**
   * Register a new hook
   * @param pointName The extension point to hook into
   * @param hook The hook implementation
   * @param priority The hook priority (higher executes first)
   */
  registerHook<N extends ExtensionPointName>(
    pointName: N,
    hook: ExtensionHook<N, TState['data']>,
    priority: number = 0
  ): Result<void> {
    try {
      // Create a type-safe wrapper for the hook
      const wrappedHook: ExtensionHook<ExtensionPointName, TState['data']> = async (params, context) => {
        return hook(params as ExtensionPointParameters[N], context);
      };

      // Get or create the hooks array for this point
      const hooks = this.hooks.get(pointName) || [];
      
      // Add the new hook with its priority
      hooks.push({ hook: wrappedHook, priority });
      
      // Update the hooks map
      this.hooks.set(pointName, hooks);
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Check plugin health
   */
  healthCheck(): Result<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, unknown>;
  }> {
    return {
      success: true,
      value: {
        status: this.state.status.lastError ? 'degraded' : 'healthy',
        details: {
          enabled: this.state.status.enabled,
          lastError: this.state.status.lastError?.message,
          lastActionTimestamp: this.state.status.lastActionTimestamp
        }
      }
    };
  }
} 