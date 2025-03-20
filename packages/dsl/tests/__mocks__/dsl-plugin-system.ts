/**
 * Mock implementation of dsl-plugin-system
 */
import { vi } from 'vitest';
import { BaseComponent } from '../../src/types.js';
import { PluginManager } from '@architectlm/extensions';

/**
 * Mock DSLPlugin interface
 */
export interface DSLPlugin {
  name: string;
  version: string;
  description: string;
  supportedComponentTypes: string[];
  hooks: Record<string, any>;
  onComponentRegistration?: (component: BaseComponent) => void | Promise<void>;
  onComponentCompilation?: (component: BaseComponent, code: string) => string | Promise<string>;
  onComponentValidation?: (
    component: BaseComponent, 
    validationResult: { isValid: boolean; errors: string[] }
  ) => { isValid: boolean; errors: string[] } | Promise<{ isValid: boolean; errors: string[] }>;
}

/**
 * Mock DSLPluginSystem
 */
export class DSLPluginSystem {
  private pluginManager: PluginManager;
  private plugins: Map<string, DSLPlugin>;
  
  constructor(pluginManager?: PluginManager) {
    this.pluginManager = pluginManager || { 
      registerPlugin: vi.fn(),
      getPlugins: vi.fn().mockReturnValue(new Map())
    } as unknown as PluginManager;
    this.plugins = new Map();
  }
  
  registerPlugin(plugin: DSLPlugin): void {
    this.plugins.set(plugin.name, plugin);
    this.pluginManager.registerPlugin(plugin, {
      version: plugin.version,
      description: plugin.description
    });
  }
  
  getAllPlugins(): DSLPlugin[] {
    return Array.from(this.plugins.values());
  }
  
  getPluginsForComponentType(componentType: string): DSLPlugin[] {
    return this.getAllPlugins().filter(plugin => 
      plugin.supportedComponentTypes.includes(componentType)
    );
  }
  
  async runComponentRegistrationHooks(component: BaseComponent): Promise<void> {
    const plugins = this.getPluginsForComponentType(component.type);
    
    for (const plugin of plugins) {
      if (plugin.onComponentRegistration) {
        await plugin.onComponentRegistration(component);
      }
    }
  }
  
  async runComponentCompilationHooks(component: BaseComponent, code: string): Promise<string> {
    const plugins = this.getPluginsForComponentType(component.type);
    let result = code;
    
    for (const plugin of plugins) {
      if (plugin.onComponentCompilation) {
        result = await plugin.onComponentCompilation(component, result);
      }
    }
    
    return result;
  }
  
  async runComponentValidationHooks(
    component: BaseComponent, 
    validationResult: { isValid: boolean; errors: string[] }
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const plugins = this.getPluginsForComponentType(component.type);
    let result = validationResult;
    
    for (const plugin of plugins) {
      if (plugin.onComponentValidation) {
        result = await plugin.onComponentValidation(component, result);
      }
    }
    
    return result;
  }
}

/**
 * Factory function for creating a DSLPluginSystem
 */
export function createDSLPluginSystem(pluginManager?: PluginManager): DSLPluginSystem {
  return new DSLPluginSystem(pluginManager);
} 