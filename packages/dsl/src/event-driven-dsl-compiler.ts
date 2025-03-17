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
      this.eventBus.publish({
        type: DSLEventType.COMPONENT_REGISTERED,
        payload: {
          component
        },
        timestamp: Date.now()
      });
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
      this.eventBus.publish({
        type: DSLEventType.COMPONENT_UPDATED,
        payload: {
          component
        },
        timestamp: Date.now()
      });
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
      this.eventBus.publish({
        type: DSLEventType.COMPONENT_REMOVED,
        payload: {
          name
        },
        timestamp: Date.now()
      });
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
   * @returns The compiled code
   */
  async compileComponent(name: string): Promise<string> {
    try {
      // Get the component
      const component = this.componentRegistry.getComponent(name);
      
      if (!component) {
        throw new Error(`Component '${name}' not found`);
      }
      
      // Compile the component
      const code = await this.internalCompileComponent(component);
      
      // Run plugin hooks
      const modifiedCode = await this.dslPluginSystem.runComponentCompilationHooks(component, code);
      
      // Publish an event
      this.eventBus.publish({
        type: DSLEventType.COMPONENT_COMPILED,
        payload: {
          name,
          result: modifiedCode
        },
        timestamp: Date.now()
      });
      
      return modifiedCode;
    } catch (error) {
      this.handleError(`Failed to compile component '${name}'`, error);
      return '';
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
      this.eventBus.publish({
        type: DSLEventType.COMPONENT_VALIDATED,
        payload: {
          name,
          result: modifiedResult
        },
        timestamp: Date.now()
      });
      
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
      this.eventBus.publish({
        type: DSLEventType.COMPONENT_TRANSFORMED,
        payload: {
          name,
          result: transformationResult
        },
        timestamp: Date.now()
      });
      
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
    this.eventBus.publish({
      type: DSLEventType.ERROR,
      payload: {
        message,
        error: error instanceof Error ? error.message : String(error),
        component
      },
      timestamp: Date.now()
    });
    
    // Rethrow the error
    throw error;
  }
} 