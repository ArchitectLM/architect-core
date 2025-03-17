/**
 * Mock implementation of event-driven-dsl-compiler
 */
import { vi } from 'vitest';
import { BaseComponent } from '../../src/types.js';
import { ReactiveEventBus } from '@architectlm/core';
import { DSLExtensionSystem } from '../../src/dsl-extension-system.js';
import { DSLPluginSystem } from '../../src/dsl-plugin-system.js';

/**
 * DSL event types
 */
export enum DSLEventType {
  COMPONENT_REGISTERED = 'DSL_COMPONENT_REGISTERED',
  COMPONENT_UPDATED = 'DSL_COMPONENT_UPDATED',
  COMPONENT_REMOVED = 'DSL_COMPONENT_REMOVED',
  COMPONENT_COMPILED = 'DSL_COMPONENT_COMPILED',
  COMPONENT_VALIDATED = 'DSL_COMPONENT_VALIDATED',
  COMPONENT_TRANSFORMED = 'DSL_COMPONENT_TRANSFORMED',
  ERROR = 'DSL_ERROR'
}

/**
 * Mock EventDrivenComponentRegistry
 */
export class EventDrivenComponentRegistry {
  private components: Map<string, BaseComponent>;
  
  constructor(private eventBus: ReactiveEventBus) {
    this.components = new Map();
  }
  
  registerComponent(component: BaseComponent): void {
    this.components.set(component.name, component);
    this.eventBus.publish('dsl.component.registered', {
      component,
      timestamp: Date.now()
    });
    
    // Also publish with the enum value for backward compatibility
    this.eventBus.publish(DSLEventType.COMPONENT_REGISTERED, {
      component
    });
  }
  
  updateComponent(component: BaseComponent): void {
    this.components.set(component.name, component);
    this.eventBus.publish('dsl.component.updated', {
      component,
      timestamp: Date.now()
    });
  }
  
  removeComponent(name: string): void {
    this.components.delete(name);
    this.eventBus.publish('dsl.component.removed', {
      name,
      timestamp: Date.now()
    });
  }
  
  getComponent(name: string): BaseComponent | undefined {
    return this.components.get(name);
  }
  
  getAllComponents(): BaseComponent[] {
    return Array.from(this.components.values());
  }
}

/**
 * Mock ComponentCache
 */
export class ComponentCache<T> {
  private cache: Map<string, { value: T, type: string, timestamp: number }>;
  
  constructor(options: any = {}) {
    this.cache = new Map();
  }
  
  get(component: BaseComponent, type: string): T | undefined {
    const key = `${component.name}:${type}`;
    const entry = this.cache.get(key);
    return entry?.value;
  }
  
  set(component: BaseComponent, value: T, type: string): void {
    const key = `${component.name}:${type}`;
    this.cache.set(key, { value, type, timestamp: Date.now() });
  }
  
  clear(): void {
    this.cache.clear();
  }
}

/**
 * Mock EventDrivenDSLCompiler
 */
export class EventDrivenDSLCompiler {
  private eventBus: ReactiveEventBus;
  private dslExtensionSystem: DSLExtensionSystem;
  private dslPluginSystem: DSLPluginSystem;
  private componentRegistry: EventDrivenComponentRegistry;
  private componentCache: ComponentCache<string>;
  
  constructor(options: {
    eventBus: ReactiveEventBus;
    dslExtensionSystem: DSLExtensionSystem;
    dslPluginSystem: DSLPluginSystem;
    cacheOptions?: any;
  }) {
    this.eventBus = options.eventBus;
    this.dslExtensionSystem = options.dslExtensionSystem;
    this.dslPluginSystem = options.dslPluginSystem;
    this.componentRegistry = new EventDrivenComponentRegistry(this.eventBus);
    this.componentCache = new ComponentCache<string>(options.cacheOptions);
  }
  
  async registerComponent(component: BaseComponent): Promise<void> {
    await this.dslPluginSystem.runComponentRegistrationHooks(component);
    this.componentRegistry.registerComponent(component);
  }
  
  async updateComponent(component: BaseComponent): Promise<void> {
    await this.dslPluginSystem.runComponentRegistrationHooks(component);
    this.componentRegistry.updateComponent(component);
  }
  
  removeComponent(name: string): void {
    this.componentRegistry.removeComponent(name);
  }
  
  getComponent(name: string): BaseComponent | undefined {
    return this.componentRegistry.getComponent(name);
  }
  
  getAllComponents(): BaseComponent[] {
    return this.componentRegistry.getAllComponents();
  }
  
  async compileComponent(name: string): Promise<string> {
    const component = this.getComponent(name);
    if (!component) {
      throw new Error(`Component not found: ${name}`);
    }
    
    const code = await this.internalCompileComponent(component);
    
    this.eventBus.publish(DSLEventType.COMPONENT_COMPILED, {
      name,
      result: code
    });
    
    return code;
  }
  
  async validateComponent(name: string): Promise<{ isValid: boolean; errors: string[] }> {
    const component = this.getComponent(name);
    if (!component) {
      throw new Error(`Component '${name}' not found`);
    }
    
    const result = await this.internalValidateComponent(component);
    
    this.eventBus.publish(DSLEventType.COMPONENT_VALIDATED, {
      name,
      result
    });
    
    return result;
  }
  
  private async internalCompileComponent(component: BaseComponent): Promise<string> {
    return '// Compiled code';
  }
  
  private async internalValidateComponent(component: BaseComponent): Promise<{ isValid: boolean; errors: string[] }> {
    return { isValid: true, errors: [] };
  }
} 