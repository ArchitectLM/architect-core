/**
 * @file Plugin management implementation for the extension system
 * @module @architectlm/extensions
 */

import { DefaultExtensionSystem, Plugin, Extension, EventInterceptor } from './extension-system.js';

/**
 * Interface for plugin metadata
 */
export interface PluginMetadata {
  /** The plugin name */
  name: string;
  /** The plugin version */
  version: string;
  /** The plugin author */
  author?: string;
  /** The plugin description */
  description?: string;
  /** The plugin dependencies */
  dependencies?: Record<string, string>;
  /** Whether the plugin is enabled */
  enabled: boolean;
  /** When the plugin was registered */
  registeredAt: number;
}

/**
 * Interface for plugin registry
 */
export interface PluginRegistry {
  /** Get all registered plugins */
  getPlugins(): Map<string, Plugin & PluginMetadata>;
  /** Get a plugin by name */
  getPlugin(name: string): (Plugin & PluginMetadata) | undefined;
  /** Register a plugin */
  registerPlugin(plugin: Plugin, metadata?: Partial<PluginMetadata>): void;
  /** Unregister a plugin */
  unregisterPlugin(name: string): boolean;
  /** Enable a plugin */
  enablePlugin(name: string): boolean;
  /** Disable a plugin */
  disablePlugin(name: string): boolean;
  /** Check if a plugin is enabled */
  isPluginEnabled(name: string): boolean;
  /** Check if a plugin exists */
  hasPlugin(name: string): boolean;
  /** Get plugin dependencies */
  getPluginDependencies(name: string): string[];
  /** Check if plugin dependencies are satisfied */
  arePluginDependenciesSatisfied(name: string): boolean;
}

/**
 * Plugin manager for the extension system
 */
export class PluginManager implements PluginRegistry {
  private plugins: Map<string, Plugin & PluginMetadata> = new Map();
  private extensionSystem: DefaultExtensionSystem;
  
  /**
   * Create a new plugin manager
   * @param extensionSystem The extension system to manage plugins for
   */
  constructor(extensionSystem: DefaultExtensionSystem) {
    this.extensionSystem = extensionSystem;
  }
  
  /**
   * Get all registered plugins
   * @returns A map of all registered plugins
   */
  getPlugins(): Map<string, Plugin & PluginMetadata> {
    return new Map(this.plugins);
  }
  
  /**
   * Get a plugin by name
   * @param name The name of the plugin
   * @returns The plugin or undefined if not found
   */
  getPlugin(name: string): (Plugin & PluginMetadata) | undefined {
    return this.plugins.get(name);
  }
  
  /**
   * Register a plugin
   * @param plugin The plugin to register
   * @param metadata Optional metadata for the plugin
   */
  registerPlugin(plugin: Plugin, metadata?: Partial<PluginMetadata>): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    
    // Create plugin metadata
    const pluginMetadata: PluginMetadata = {
      name: plugin.name,
      version: metadata?.version || '1.0.0',
      author: metadata?.author,
      description: plugin.description,
      dependencies: metadata?.dependencies || {},
      enabled: metadata?.enabled !== false,
      registeredAt: Date.now()
    };
    
    // Combine plugin and metadata
    const pluginWithMetadata = { ...plugin, ...pluginMetadata };
    
    // Check dependencies
    if (!this.arePluginDependenciesSatisfied(plugin.name, pluginMetadata.dependencies)) {
      throw new Error(`Plugin '${plugin.name}' has unsatisfied dependencies`);
    }
    
    // Store the plugin
    this.plugins.set(plugin.name, pluginWithMetadata);
    
    // Register with extension system if enabled
    if (pluginMetadata.enabled) {
      this.extensionSystem.registerExtension(plugin);
      
      // Register event interceptors if any
      if (plugin.eventInterceptors) {
        for (const interceptor of plugin.eventInterceptors) {
          this.extensionSystem.registerEventInterceptor(interceptor);
        }
      }
      
      // Call the setup function if provided
      if (plugin.setup) {
        plugin.setup(this.extensionSystem);
      }
    }
  }
  
  /**
   * Unregister a plugin
   * @param name The name of the plugin to unregister
   * @returns Whether the plugin was unregistered
   */
  unregisterPlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      return false;
    }
    
    // Check if other plugins depend on this one
    for (const [pluginName, pluginInfo] of this.plugins.entries()) {
      if (pluginName !== name && pluginInfo.dependencies) {
        if (Object.keys(pluginInfo.dependencies).includes(name)) {
          throw new Error(`Cannot unregister plugin '${name}' because plugin '${pluginName}' depends on it`);
        }
      }
    }
    
    // Remove the plugin
    this.plugins.delete(name);
    
    // TODO: Ideally, we would also unregister the extension and event interceptors,
    // but the current extension system doesn't support this directly.
    // This would require enhancing the extension system.
    
    return true;
  }
  
  /**
   * Enable a plugin
   * @param name The name of the plugin to enable
   * @returns Whether the plugin was enabled
   */
  enablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin || plugin.enabled) {
      return false;
    }
    
    // Check dependencies
    if (!this.arePluginDependenciesSatisfied(name)) {
      throw new Error(`Cannot enable plugin '${name}' because it has unsatisfied dependencies`);
    }
    
    // Update enabled status
    plugin.enabled = true;
    
    // Register with extension system
    this.extensionSystem.registerExtension(plugin);
    
    // Register event interceptors if any
    if (plugin.eventInterceptors) {
      for (const interceptor of plugin.eventInterceptors) {
        this.extensionSystem.registerEventInterceptor(interceptor);
      }
    }
    
    // Call the setup function if provided
    if (plugin.setup) {
      plugin.setup(this.extensionSystem);
    }
    
    return true;
  }
  
  /**
   * Disable a plugin
   * @param name The name of the plugin to disable
   * @returns Whether the plugin was disabled
   */
  disablePlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin || !plugin.enabled) {
      return false;
    }
    
    // Check if other plugins depend on this one
    for (const [pluginName, pluginInfo] of this.plugins.entries()) {
      if (pluginName !== name && pluginInfo.dependencies && pluginInfo.enabled) {
        if (Object.keys(pluginInfo.dependencies).includes(name)) {
          throw new Error(`Cannot disable plugin '${name}' because enabled plugin '${pluginName}' depends on it`);
        }
      }
    }
    
    // Update enabled status
    plugin.enabled = false;
    
    // TODO: Ideally, we would also unregister the extension and event interceptors,
    // but the current extension system doesn't support this directly.
    // This would require enhancing the extension system.
    
    return true;
  }
  
  /**
   * Check if a plugin is enabled
   * @param name The name of the plugin
   * @returns Whether the plugin is enabled
   */
  isPluginEnabled(name: string): boolean {
    const plugin = this.plugins.get(name);
    return plugin ? plugin.enabled : false;
  }
  
  /**
   * Check if a plugin exists
   * @param name The name of the plugin
   * @returns Whether the plugin exists
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }
  
  /**
   * Get plugin dependencies
   * @param name The name of the plugin
   * @returns The names of the plugins that this plugin depends on
   */
  getPluginDependencies(name: string): string[] {
    const plugin = this.plugins.get(name);
    if (!plugin || !plugin.dependencies) {
      return [];
    }
    
    return Object.keys(plugin.dependencies);
  }
  
  /**
   * Check if plugin dependencies are satisfied
   * @param name The name of the plugin
   * @param dependencies Optional dependencies to check instead of the plugin's dependencies
   * @returns Whether all dependencies are satisfied
   */
  arePluginDependenciesSatisfied(name: string, dependencies?: Record<string, string>): boolean {
    const depsToCheck = dependencies || this.plugins.get(name)?.dependencies;
    if (!depsToCheck) {
      return true;
    }
    
    for (const [depName, depVersion] of Object.entries(depsToCheck)) {
      const dependency = this.plugins.get(depName);
      
      // Check if dependency exists and is enabled
      if (!dependency || !dependency.enabled) {
        return false;
      }
      
      // TODO: Add version compatibility checking
      // For now, we just check if the dependency exists
    }
    
    return true;
  }
  
  /**
   * Create a plugin from an extension
   * @param extension The extension to convert to a plugin
   * @param metadata Optional metadata for the plugin
   * @returns The created plugin
   */
  createPluginFromExtension(extension: Extension, metadata?: Partial<PluginMetadata>): Plugin & PluginMetadata {
    const plugin: Plugin = {
      ...extension,
      eventInterceptors: []
    };
    
    this.registerPlugin(plugin, metadata);
    return this.plugins.get(plugin.name)!;
  }
  
  /**
   * Add an event interceptor to a plugin
   * @param pluginName The name of the plugin
   * @param interceptor The event interceptor to add
   * @returns Whether the interceptor was added
   */
  addInterceptorToPlugin(pluginName: string, interceptor: EventInterceptor): boolean {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return false;
    }
    
    // Initialize eventInterceptors if it doesn't exist
    if (!plugin.eventInterceptors) {
      plugin.eventInterceptors = [];
    }
    
    // Add the interceptor
    plugin.eventInterceptors.push(interceptor);
    
    // Register with extension system if plugin is enabled
    if (plugin.enabled) {
      this.extensionSystem.registerEventInterceptor(interceptor);
    }
    
    return true;
  }
}

/**
 * Create a new plugin manager
 * @param extensionSystem The extension system to manage plugins for
 * @returns A new plugin manager
 */
export function createPluginManager(extensionSystem: DefaultExtensionSystem): PluginManager {
  return new PluginManager(extensionSystem);
} 