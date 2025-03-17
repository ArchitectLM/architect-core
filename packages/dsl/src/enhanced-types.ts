/**
 * Enhanced type definitions for the DSL API with improved type safety
 */

import { z } from 'zod';
import { BaseComponent, ComponentType, SchemaComponent, CommandComponent, QueryComponent, EventComponent, WorkflowComponent, ExtensionComponent, PluginComponent } from './types.js';

/**
 * Type mapping for component types to their specific interfaces
 */
export type ComponentTypeMap = {
  [ComponentType.SCHEMA]: SchemaComponent;
  [ComponentType.COMMAND]: CommandComponent;
  [ComponentType.QUERY]: QueryComponent;
  [ComponentType.EVENT]: EventComponent;
  [ComponentType.WORKFLOW]: WorkflowComponent;
  [ComponentType.EXTENSION]: ExtensionComponent;
  [ComponentType.PLUGIN]: PluginComponent;
};

/**
 * Get component interface by type
 */
export type ComponentByType<T extends ComponentType> = ComponentTypeMap[T];

/**
 * Type-safe component registry access
 */
export interface TypedComponentRegistry {
  /**
   * Get a component by name with type inference
   */
  getComponent<T extends ComponentType>(name: string, type: T): ComponentByType<T> | undefined;
  
  /**
   * Get all components of a specific type
   */
  getComponentsByType<T extends ComponentType>(type: T): ComponentByType<T>[];
}

/**
 * Zod schema for component validation
 */
export type ZodSchemaFor<T extends BaseComponent> = z.ZodType<T>;

/**
 * Type-safe validation result
 */
export interface ValidationResult<T extends BaseComponent> {
  isValid: boolean;
  errors: string[];
  component?: T;
}

/**
 * Type-safe component validator
 */
export interface ComponentValidator<T extends BaseComponent> {
  validate(component: T): ValidationResult<T>;
}

/**
 * Type-safe component compiler
 */
export interface ComponentCompiler<T extends BaseComponent, O = string> {
  compile(component: T): Promise<O>;
}

/**
 * Type-safe component transformer
 */
export interface ComponentTransformer<T extends BaseComponent, R = any> {
  transform(component: T, options?: Record<string, any>): Promise<R>;
}

/**
 * Type-safe event payload for component events
 */
export type ComponentEventPayload<T extends ComponentType> = {
  component: ComponentByType<T>;
};

/**
 * Type-safe event subscription for component events
 */
export interface TypedEventSubscription {
  subscribeToComponentEvent<T extends ComponentType>(
    eventType: string,
    componentType: T,
    handler: (payload: ComponentEventPayload<T>) => void
  ): () => void;
} 