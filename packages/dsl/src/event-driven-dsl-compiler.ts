/**
 * Event-Driven DSL Compiler
 * 
 * This module provides an event-driven compiler for the DSL, leveraging the extension system,
 * plugin system, and event bus to provide a flexible and extensible compilation process.
 */

import { ReactiveEventBus } from '@architectlm/core';
import { BaseComponent } from './types.js';
import { DSLExtensionSystem, ValidationContext, CompilationContext, TransformationContext } from './dsl-extension-system.js';
import { DSLPluginSystem } from './dsl-plugin-system.js';
import { EventDrivenComponentRegistry } from './event-driven-component-registry.js';
import { ComponentCache } from './component-cache.js';

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
 * Options for the event-driven DSL compiler
 */
export interface EventDrivenDSLCompilerOptions {
  /**
   * The event bus to use for publishing events
   */
  eventBus: ReactiveEventBus;
  
  /**
   * The DSL extension system to use
   */
  dslExtensionSystem: DSLExtensionSystem;
  
  /**
   * The DSL plugin system to use
   */
  dslPluginSystem: DSLPluginSystem;
  
  /**
   * Cache options
   */
  cacheOptions?: {
    /**
     * Whether to enable caching
     */
    enabled?: boolean;
    
    /**
     * Maximum time to live for cache entries in milliseconds
     */
    ttl?: number;
    
    /**
     * Maximum number of entries in the cache
     */
    maxEntries?: number;
    
    /**
     * Whether to use sliding expiration (reset TTL on access)
     */
    slidingExpiration?: boolean;
  };
}

/**
 * Event-driven DSL compiler
 * 
 * Provides an event-driven interface for compiling DSL components
 */
export class EventDrivenDSLCompiler {
  private eventBus: ReactiveEventBus;
  private dslExtensionSystem: DSLExtensionSystem;
  private dslPluginSystem: DSLPluginSystem;
  private componentRegistry: EventDrivenComponentRegistry;
  private componentCache: ComponentCache<string>;
  private cacheEnabled: boolean;
  
  /**
   * Creates a new event-driven DSL compiler
   * @param options The compiler options
   */
  constructor(options: EventDrivenDSLCompilerOptions) {
    this.eventBus = options.eventBus;
    this.dslExtensionSystem = options.dslExtensionSystem;
    this.dslPluginSystem = options.dslPluginSystem;
    this.componentRegistry = new EventDrivenComponentRegistry(this.eventBus);
    
    // Initialize the extension system
    this.dslExtensionSystem.initialize();
    
    // Initialize the cache
    this.cacheEnabled = options.cacheOptions?.enabled !== false;
    this.componentCache = new ComponentCache<string>({
      ttl: options.cacheOptions?.ttl,
      maxEntries: options.cacheOptions?.maxEntries,
      slidingExpiration: options.cacheOptions?.slidingExpiration
    });
  }
  
  /**
   * Registers a component
   * @param component The component to register
   */
  async registerComponent(component: BaseComponent): Promise<void> {
    try {
      // Run plugin hooks
      await this.dslPluginSystem.runComponentRegistrationHooks(component);
      
      // Register the component
      this.componentRegistry.registerComponent(component);
      
      // Publish an event
      this.eventBus.publish(
        DSLEventType.COMPONENT_REGISTERED,
        {
          component
        }
      );
    } catch (error) {
      this.handleError('Failed to register component', error, component);
    }
  }
  
  /**
   * Updates a component
   * @param component The component to update
   */
  async updateComponent(component: BaseComponent): Promise<void> {
    try {
      // Run plugin hooks
      await this.dslPluginSystem.runComponentRegistrationHooks(component);
      
      // Update the component
      this.componentRegistry.updateComponent(component);
      
      // Publish an event
      this.eventBus.publish(
        DSLEventType.COMPONENT_UPDATED,
        {
          component
        }
      );
    } catch (error) {
      this.handleError('Failed to update component', error, component);
    }
  }
  
  /**
   * Removes a component
   * @param name The name of the component to remove
   */
  removeComponent(name: string): void {
    try {
      // Get the component
      const component = this.componentRegistry.getComponent(name);
      
      if (!component) {
        throw new Error(`Component '${name}' not found`);
      }
      
      // Remove the component
      this.componentRegistry.removeComponent(name);
      
      // Publish an event
      this.eventBus.publish(
        DSLEventType.COMPONENT_REMOVED,
        {
          name
        }
      );
    } catch (error) {
      this.handleError(`Failed to remove component '${name}'`, error);
    }
  }
  
  /**
   * Gets a component
   * @param name The name of the component to get
   * @returns The component, or undefined if not found
   */
  getComponent(name: string): BaseComponent | undefined {
    return this.componentRegistry.getComponent(name);
  }
  
  /**
   * Gets all components
   * @returns All registered components
   */
  getAllComponents(): BaseComponent[] {
    return this.componentRegistry.getAllComponents();
  }
  
  /**
   * Compiles a component
   * @param name The name of the component to compile
   * @returns The compiled component code
   */
  async compileComponent(name: string): Promise<string> {
    try {
      const component = this.getComponent(name);
      if (!component) {
        throw new Error(`Component not found: ${name}`);
      }
      
      // Check if the component is in the cache
      if (this.cacheEnabled) {
        const cachedCode = this.componentCache.get(component, 'compiled');
        if (cachedCode) {
          // Publish an event for the cached compilation
          this.eventBus.publish(
            DSLEventType.COMPONENT_COMPILED,
            {
              component,
              code: cachedCode,
              fromCache: true
            }
          );
          
          return cachedCode;
        }
      }
      
      // Compile the component
      const code = await this.internalCompileComponent(component);
      
      // Cache the compiled code
      if (this.cacheEnabled) {
        this.componentCache.set(component, code, 'compiled');
      }
      
      // Publish an event
      this.eventBus.publish(
        DSLEventType.COMPONENT_COMPILED,
        {
          component,
          code,
          fromCache: false
        }
      );
      
      return code;
    } catch (error) {
      this.handleError('Failed to compile component', error, this.getComponent(name));
      throw error;
    }
  }
  
  /**
   * Validates a component
   * @param name The name of the component to validate
   * @returns The validation result
   */
  async validateComponent(name: string): Promise<{ isValid: boolean; errors: string[] }> {
    try {
      // Get the component
      const component = this.componentRegistry.getComponent(name);
      
      if (!component) {
        throw new Error(`Component '${name}' not found`);
      }
      
      // Validate the component
      const validationResult = await this.internalValidateComponent(component);
      
      // Run plugin hooks
      const modifiedResult = await this.dslPluginSystem.runComponentValidationHooks(
        component,
        validationResult
      );
      
      // Publish an event
      this.eventBus.publish(
        DSLEventType.COMPONENT_VALIDATED,
        {
          component,
          validationResult
        }
      );
      
      return modifiedResult;
    } catch (error) {
      this.handleError(`Failed to validate component '${name}'`, error);
      return { isValid: false, errors: [`Failed to validate component '${name}': ${error}`] };
    }
  }
  
  /**
   * Transforms a component
   * @param name The name of the component to transform
   * @param transformationOptions Options for the transformation
   * @returns The transformed component
   */
  async transformComponent(
    name: string,
    transformationOptions: Record<string, any>
  ): Promise<any> {
    try {
      // Get the component
      const component = this.componentRegistry.getComponent(name);
      
      if (!component) {
        throw new Error(`Component '${name}' not found`);
      }
      
      // Create transformation context
      const context: TransformationContext = {
        component,
        transformedComponent: { ...component },
        options: transformationOptions
      };
      
      // Transform the component
      const transformationResult = await this.dslExtensionSystem.transformComponent(component, context);
      
      // Publish an event
      this.eventBus.publish(
        DSLEventType.COMPONENT_TRANSFORMED,
        {
          component,
          transformedComponent: context.transformedComponent
        }
      );
      
      return transformationResult;
    } catch (error) {
      this.handleError(`Failed to transform component '${name}'`, error);
      return null;
    }
  }
  
  /**
   * Internal method to compile a component
   * @param component The component to compile
   * @returns The compiled code
   */
  private async internalCompileComponent(component: BaseComponent): Promise<string> {
    // Create compilation context
    const context: CompilationContext = {
      component,
      code: '',
      options: {}
    };
    
    // Use the extension system to compile the component
    const result = await this.dslExtensionSystem.compileComponent(component, context);
    return result.code;
  }
  
  /**
   * Internal method to validate a component
   * @param component The component to validate
   * @returns The validation result
   */
  private async internalValidateComponent(
    component: BaseComponent
  ): Promise<{ isValid: boolean; errors: string[] }> {
    // Create validation context
    const context: ValidationContext = {
      component,
      validationResult: { isValid: true, errors: [] },
      options: {}
    };
    
    // Use the extension system to validate the component
    const result = await this.dslExtensionSystem.validateComponent(component, context);
    return result.validationResult;
  }
  
  /**
   * Handles an error
   * @param message The error message
   * @param error The error object
   * @param component The component that caused the error (optional)
   */
  private handleError(message: string, error: any, component?: BaseComponent): void {
    console.error(message, error);
    
    // Publish an error event
    this.eventBus.publish(
      DSLEventType.ERROR,
      {
        message,
        error: error instanceof Error ? error.message : String(error),
        component
      }
    );
    
    // Rethrow the error
    throw error;
  }
  
  /**
   * Invalidates the cache for a component
   * @param name The name of the component
   */
  invalidateCache(name: string): void {
    const component = this.getComponent(name);
    if (component) {
      this.componentCache.remove(component, 'compiled');
      this.componentCache.remove(component, 'validated');
      this.componentCache.remove(component, 'transformed');
    }
  }
  
  /**
   * Clears the entire cache
   */
  clearCache(): void {
    this.componentCache.clear();
  }
  
  /**
   * Gets cache statistics
   * @returns Cache statistics
   */
  getCacheStats(): { size: number } {
    return {
      size: this.componentCache.size()
    };
  }
} 