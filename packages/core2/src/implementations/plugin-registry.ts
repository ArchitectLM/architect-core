import {
  DomainError,
  Identifier,
  Metadata,
  Result
} from '../models/core-types';
import { 
  Plugin, 
  PluginRegistry, 
  PluginState 
} from '../models/plugin-system';
import { ExtensionSystem } from '../models/extension-system';

/**
 * In-memory implementation of PluginRegistry
 */
export class InMemoryPluginRegistry implements PluginRegistry {
  private plugins = new Map<string, Plugin<PluginState>>();
  private extensionSystem?: ExtensionSystem;

  /**
   * Set the extension system instance
   * @param extensionSystem The extension system to use
   */
  public setExtensionSystem(extensionSystem: ExtensionSystem): void {
    this.extensionSystem = extensionSystem;
  }

  /**
   * Register a plugin definition
   * @param plugin The plugin to register
   */
  public registerPlugin(plugin: Plugin): Result<void> {
    try {
      if (!plugin.getState().id) {
        return {
          success: false,
          error: new DomainError('Plugin must have an ID')
        };
      }

      const pluginId = plugin.getState().id;
      if (this.plugins.has(pluginId)) {
        return {
          success: false,
          error: new DomainError(`Plugin with ID ${pluginId} already registered`)
        };
      }

      // Register the plugin
      this.plugins.set(pluginId, plugin);
      
      // Register with extension system if available
      if (this.extensionSystem) {
        const extensionResult = this.extensionSystem.registerExtension(plugin);
        if (!extensionResult.success) {
          // If extension registration fails, unregister the plugin
          this.plugins.delete(pluginId);
          return extensionResult;
        }
      }

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to register plugin: ${String(error)}`)
      };
    }
  }

  /**
   * Unregister a plugin by ID
   * @param pluginId The ID of the plugin to unregister
   */
  public unregisterPlugin(pluginId: Identifier): Result<void> {
    try {
      if (!this.plugins.has(pluginId)) {
        return {
          success: false,
          error: new DomainError(`Plugin with ID ${pluginId} not found`)
        };
      }

      // Unregister from extension system if available
      if (this.extensionSystem) {
        const extensionResult = this.extensionSystem.unregisterExtension(pluginId);
        if (!extensionResult.success) {
          return extensionResult;
        }
      }

      this.plugins.delete(pluginId);
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to unregister plugin: ${String(error)}`)
      };
    }
  }

  /**
   * Get a plugin definition by ID
   * @param pluginId The ID of the plugin to retrieve
   */
  public getPlugin<TState extends PluginState>(pluginId: Identifier): Result<Plugin<TState>> {
    try {
      const plugin = this.plugins.get(pluginId);

      if (!plugin) {
        return {
          success: false,
          error: new DomainError(`Plugin with ID ${pluginId} not found`)
        };
      }

      return { success: true, value: plugin as unknown as Plugin<TState> };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to get plugin: ${String(error)}`)
      };
    }
  }

  /**
   * Check if a plugin is registered
   * @param pluginId The ID of the plugin to check
   */
  public hasPlugin(pluginId: Identifier): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get all registered plugins
   */
  public getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins by category
   * @param category The category to filter by
   */
  public getPluginsByCategory(category: string): Plugin[] {
    return this.getAllPlugins().filter(plugin => 
      plugin.getState().data['category'] === category
    );
  }

  /**
   * Get plugins that provide a specific capability
   * @param capabilityId The capability ID to search for
   */
  public getPluginsWithCapability(capabilityId: string): Plugin[] {
    return this.getAllPlugins().filter(plugin => 
      plugin.hasCapability(capabilityId)
    );
  }
}

/**
 * Factory function to create a new PluginRegistry
 */
export function createPluginRegistry(): PluginRegistry {
  return new InMemoryPluginRegistry();
} 