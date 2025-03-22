import { EventBus, EventStorage } from '../models/event-system';
import { ExtensionSystem } from '../models/extension-system';
import { Plugin, PluginRegistry } from '../models/plugin-system';
import { Result } from '../models/core-types';
import { ExtensionEventBus, createEventBus } from '../implementations/event-bus';
import { ExtensionSystemImpl } from '../models/extension-system';
import { InMemoryEventStorage, createEventStorage } from '../implementations/event-storage';

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
 * Core runtime that coordinates event, extension, and plugin systems
 */
export class CoreRuntime {
  private readonly eventBus: EventBus;
  private readonly extensionSystem: ExtensionSystem;
  private readonly eventStorage?: EventStorage;
  private readonly plugins: Map<string, Plugin> = new Map();

  constructor(config: CoreRuntimeConfig = {}) {
    // Initialize extension system
    this.extensionSystem = config.extensionSystem || new ExtensionSystemImpl();

    // Initialize event storage if enabled
    if (config.enableEventPersistence) {
      this.eventStorage = config.eventStorage || createEventStorage();
    }

    // Initialize event bus
    this.eventBus = config.eventBus || createEventBus(this.extensionSystem);
    if (this.eventStorage) {
      this.eventBus.enablePersistence(this.eventStorage);
    }
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

      return { success: true, value: undefined };
    } catch (error) {
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

      return { success: true, value: undefined };
    } catch (error) {
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
   * Get the event bus
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * Get the extension system
   */
  getExtensionSystem(): ExtensionSystem {
    return this.extensionSystem;
  }

  /**
   * Get the event storage if enabled
   */
  getEventStorage(): EventStorage | undefined {
    return this.eventStorage;
  }
}

/**
 * Creates a new core runtime instance
 */
export function createCoreRuntime(config: CoreRuntimeConfig = {}): CoreRuntime {
  return new CoreRuntime(config);
} 