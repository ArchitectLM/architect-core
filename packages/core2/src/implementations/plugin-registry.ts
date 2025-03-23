import {
  Identifier,
  Result
} from '../models/core-types';
import { 
  Plugin, 
  PluginRegistry, 
  PluginState 
} from '../models/plugin-system';
import { ExtensionSystem } from '../models/extension-system';
import { BaseRegistry, DomainError } from '../utils';

/**
 * In-memory implementation of PluginRegistry
 */
export class InMemoryPluginRegistry extends BaseRegistry<Plugin<PluginState>, string> implements PluginRegistry {
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
      const registerResult = this.registerItem(pluginId, plugin);
      
      if (!registerResult.success) {
        return registerResult;
      }
      
      // Register with extension system if available
      if (this.extensionSystem) {
        const extensionResult = this.extensionSystem.registerExtension(plugin);
        if (!extensionResult.success) {
          // If extension registration fails, unregister the plugin
          this.unregisterItem(pluginId);
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
      const result = this.getItem(pluginId);
      if (!result.success) {
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

      return this.unregisterItem(pluginId);
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
      const result = this.getItem(pluginId);
      
      if (!result.success) {
        return {
          success: false,
          error: new DomainError(`Plugin with ID ${pluginId} not found`)
        };
      }

      return { 
        success: true, 
        value: result.value as unknown as Plugin<TState> 
      };
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
   * Get all registered plugins
   */
  public getAllPlugins(): Plugin[] {
    return this.getAllItems();
  }

  /**
   * Get plugins that provide a specific capability
   * @param capabilityId The capability ID to search for
   */
  public getPluginsWithCapability(capabilityId: string): Plugin[] {
    return this.filterItems(plugin => 
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