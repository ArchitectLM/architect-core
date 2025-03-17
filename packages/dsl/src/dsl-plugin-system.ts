/**
 * DSL Plugin System
 * 
 * This module provides a plugin system for the DSL, allowing for extensibility
 * through plugins that can hook into various stages of component processing.
 */

import { Plugin, PluginManager } from '@architectlm/extensions';
import { BaseComponent, ComponentType } from './types.js';

/**
 * Interface for DSL plugins
 */
export interface DSLPlugin extends Plugin {
  /**
   * The name of the plugin
   */
  name: string;

  /**
   * The version of the plugin
   */
  version: string;
  
  /**
   * The description of the plugin
   */
  description: string;
  
  /**
   * The component types that this plugin supports
   */
  supportedComponentTypes: ComponentType[];
  
  /**
   * Hooks for the plugin
   */
  hooks: Record<string, any>;

  /**
   * Hook called when a component is registered
   * @param component The component being registered
   */
  onComponentRegistration?: (component: BaseComponent) => void | Promise<void>;
  
  /**
   * Hook called when a component is compiled
   * @param component The component being compiled
   * @param code The generated code
   * @returns The modified code, or the original code if no modifications are made
   */
  onComponentCompilation?: (component: BaseComponent, code: string) => string | Promise<string>;
  
  /**
   * Hook called when a component is validated
   * @param component The component being validated
   * @param validationResult The initial validation result
   * @returns The modified validation result, or the original result if no modifications are made
   */
  onComponentValidation?: (
    component: BaseComponent, 
    validationResult: { isValid: boolean; errors: string[] }
  ) => { isValid: boolean; errors: string[] } | Promise<{ isValid: boolean; errors: string[] }>;
}

/**
 * DSL Plugin System
 * 
 * Manages DSL plugins and provides hooks for component processing
 */
export class DSLPluginSystem {
  private pluginManager: PluginManager;
  
  /**
   * Creates a new DSL plugin system
   * @param pluginManager The plugin manager to use
   */
  constructor(pluginManager: PluginManager) {
    this.pluginManager = pluginManager;
  }
  
  /**
   * Registers a DSL plugin
   * @param plugin The plugin to register
   */
  registerPlugin(plugin: DSLPlugin): void {
    this.pluginManager.registerPlugin(plugin, {
      version: plugin.version,
      description: plugin.description
    });
  }
  
  /**
   * Gets all registered plugins
   * @returns All registered plugins
   */
  getAllPlugins(): DSLPlugin[] {
    const pluginsMap = this.pluginManager.getPlugins();
    return Array.from(pluginsMap.values()).filter(plugin => 
      'supportedComponentTypes' in plugin && 
      'onComponentValidation' in plugin
    ) as unknown as DSLPlugin[];
  }
  
  /**
   * Gets plugins that support a specific component type
   * @param componentType The component type to filter by
   * @returns Plugins that support the specified component type
   */
  getPluginsForComponentType(componentType: ComponentType): DSLPlugin[] {
    return this.getAllPlugins().filter(plugin => 
      plugin.supportedComponentTypes.includes(componentType)
    );
  }
  
  /**
   * Runs the component registration hooks for all plugins that support the component type
   * @param component The component being registered
   */
  async runComponentRegistrationHooks(component: BaseComponent): Promise<void> {
    const plugins = this.getPluginsForComponentType(component.type);
    
    for (const plugin of plugins) {
      if (plugin.onComponentRegistration) {
        await plugin.onComponentRegistration(component);
      }
    }
  }
  
  /**
   * Runs the component compilation hooks for all plugins that support the component type
   * @param component The component being compiled
   * @param code The generated code
   * @returns The modified code
   */
  async runComponentCompilationHooks(component: BaseComponent, code: string): Promise<string> {
    const plugins = this.getPluginsForComponentType(component.type);
    let modifiedCode = code;
    
    for (const plugin of plugins) {
      if (plugin.onComponentCompilation) {
        modifiedCode = await plugin.onComponentCompilation(component, modifiedCode);
      }
    }
    
    return modifiedCode;
  }
  
  /**
   * Runs the component validation hooks for all plugins that support the component type
   * @param component The component being validated
   * @param validationResult The initial validation result
   * @returns The modified validation result
   */
  async runComponentValidationHooks(
    component: BaseComponent, 
    validationResult: { isValid: boolean; errors: string[] }
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const plugins = this.getPluginsForComponentType(component.type);
    let modifiedResult = validationResult;
    
    for (const plugin of plugins) {
      if (plugin.onComponentValidation) {
        modifiedResult = await plugin.onComponentValidation(component, modifiedResult);
      }
    }
    
    return modifiedResult;
  }
}

/**
 * Creates a new DSL plugin system
 * @param pluginManager Optional plugin manager to use
 * @returns A new DSL plugin system
 */
export function createDSLPluginSystem(pluginManager?: PluginManager): DSLPluginSystem {
  if (pluginManager) {
    return new DSLPluginSystem(pluginManager);
  }
  
  // Import dynamically to avoid circular dependency
  const { createPluginManager } = require('@architectlm/extensions');
  return new DSLPluginSystem(createPluginManager());
} 