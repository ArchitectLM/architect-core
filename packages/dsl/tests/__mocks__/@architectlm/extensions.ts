/**
 * Mock implementation of @architectlm/extensions
 */
import { vi } from 'vitest';

// Type definitions
export interface Extension {
  name: string;
  description: string;
  hooks: Record<string, any>;
}

export interface Plugin extends Extension {
  version: string;
  setup?: (extensionSystem: DefaultExtensionSystem) => void;
}

export interface PluginMetadata {
  version?: string;
  description?: string;
}

export interface ExtensionPoint {
  name: string;
  description?: string;
}

// Mock ExtensionSystem
export class DefaultExtensionSystem {
  private extensionPoints: Map<string, { name: string; description: string }>;
  private extensions: Map<string, any[]>;

  constructor() {
    this.extensionPoints = new Map();
    this.extensions = new Map();
  }

  hasExtensionPoint(name: string): boolean {
    return this.extensionPoints.has(name);
  }

  registerExtensionPoint(extensionPoint: ExtensionPoint | string, description = ''): this {
    const name = typeof extensionPoint === 'string' ? extensionPoint : extensionPoint.name;
    const desc = typeof extensionPoint === 'string' ? description : (extensionPoint.description || '');
    
    this.extensionPoints.set(name, { name, description: desc });
    return this;
  }

  registerExtension(extensionPointName: string, extension: any): this {
    if (!this.extensionPoints.has(extensionPointName)) {
      this.registerExtensionPoint(extensionPointName);
    }
    
    if (!this.extensions.has(extensionPointName)) {
      this.extensions.set(extensionPointName, []);
    }
    
    this.extensions.get(extensionPointName)?.push(extension);
    return this;
  }

  getExtensions(extensionPointName: string) {
    return this.extensions.get(extensionPointName) || [];
  }

  initialize() {
    // Mock implementation
    return this;
  }

  triggerExtensionPoint(name: string, context: any) {
    // Mock implementation
    return Promise.resolve(context);
  }
}

// Mock PluginManager
export class PluginManager {
  private plugins: Map<string, Plugin>;
  
  constructor(private extensionSystem?: DefaultExtensionSystem) {
    this.plugins = new Map();
    this.extensionSystem = extensionSystem || new DefaultExtensionSystem();
  }

  registerPlugin(plugin: Plugin, metadata: PluginMetadata = {}) {
    this.plugins.set(plugin.name, plugin);
    
    // If the plugin has a setup function, call it
    if (plugin.setup && this.extensionSystem) {
      plugin.setup(this.extensionSystem);
    }
    
    return this;
  }

  getPlugin(name: string) {
    return this.plugins.get(name);
  }

  getPlugins() {
    return this.plugins;
  }
}

// Factory functions
export function createExtensionSystem() {
  return new DefaultExtensionSystem();
}

export function createPluginManager(extensionSystem?: DefaultExtensionSystem) {
  return new PluginManager(extensionSystem);
}

// Mock for ReactiveEventBus from @architectlm/core
export class ReactiveEventBus {
  publish = vi.fn();
  subscribe = vi.fn();
  unsubscribe = vi.fn();
} 