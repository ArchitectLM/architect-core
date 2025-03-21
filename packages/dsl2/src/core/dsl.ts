/**
 * Core DSL implementation
 */
import { z } from 'zod';
import {
  ComponentDefinition,
  ComponentImplementation,
  ComponentRegistry,
  ComponentType,
  ImplementationRegistry,
  SchemaComponentDefinition,
  EventComponentDefinition,
  ActorDefinition,
  MessageHandlerDefinition,
  ActorConfigDefinition,
  SystemComponentReference,
  SchemaDefinition,
  ProcessDefinition,
  SystemDefinition,
  ActorTestSuite,
  InterfaceTest,
  ImplementationTest,
  ActorContext,
  FlowBuilder
} from '../models/component.js';

// Custom type for actor implementations
export type ActorImplementation = Record<string, (input: any, context: ActorContext) => Promise<any>>;

/**
 * DSL Extension interface
 */
export interface DSLExtension {
  id: string;
  init: (dsl: DSL, options?: any) => void;
  cleanup?: () => void;
}

/**
 * DSL core implementation
 */
export class DSL {
  private components: ComponentRegistry = new Map();
  private implementations: Map<string, ActorImplementation> = new Map();
  private extensions: Map<string, DSLExtension> = new Map();

  /**
   * Register a component
   */
  component<T extends ComponentDefinition>(id: string, definition: Omit<T, 'id'>): T {
    // Create the full component definition
    const component = {
      id,
      ...definition,
    } as T;

    // Validate the component
    this.validateComponent(component);

    // Store in registry
    this.components.set(id, component);

    return component;
  }

  /**
   * Register a component implementation
   */
  implement<I, O>(componentId: string, implementation: (input: I, context: ActorContext) => Promise<O>): void {
    // Get component type
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component ${componentId} is not defined`);
    }

    // For the unified model, all components are implemented as actors
    // Create a default message handler named "execute" for backward compatibility
    const actorImpl: ActorImplementation = {
      execute: implementation
    };

    this.implementations.set(componentId, actorImpl);
  }

  /**
   * Get a component by ID
   */
  getComponent<T extends ComponentDefinition = ComponentDefinition>(id: string): T | undefined {
    return this.components.get(id) as T | undefined;
  }

  /**
   * Get components by type
   */
  getComponentsByType<T extends ComponentDefinition = ComponentDefinition>(type: ComponentType): T[] {
    return Array.from(this.components.values())
      .filter(c => c.type === type) as T[];
  }

  /**
   * Get implementation for a component
   */
  getImplementation(componentId: string): ActorImplementation | undefined {
    return this.implementations.get(componentId);
  }

  /**
   * Validate a component definition
   */
  private validateComponent(component: ComponentDefinition): boolean {
    if (!component.id) {
      throw new Error('Component must have an ID');
    }
    
    if (!component.type) {
      throw new Error(`Component ${component.id} must have a type`);
    }
    
    if (!component.description) {
      throw new Error(`Component ${component.id} must have a description`);
    }
    
    if (!component.version) {
      throw new Error(`Component ${component.id} must have a version`);
    }
    
    return true;
  }

  /**
   * Register extension
   */
  registerExtension(extension: DSLExtension, options?: any): void {
    if (this.extensions.has(extension.id)) {
      throw new Error(`Extension with ID ${extension.id} is already registered`);
    }
    
    this.extensions.set(extension.id, extension);
    extension.init(this, options);
  }

  /**
   * Get all registered extensions
   */
  getExtensions(): DSLExtension[] {
    return Array.from(this.extensions.values());
  }

  /**
   * Get a specific extension by ID
   */
  getExtension(extensionId: string): any {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }
    return extension;
  }

  /**
   * Cleanup and remove an extension
   */
  removeExtension(extensionId: string): void {
    const extension = this.extensions.get(extensionId);
    if (extension && extension.cleanup) {
      extension.cleanup();
    }
    
    this.extensions.delete(extensionId);
  }
} 