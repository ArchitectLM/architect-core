/**
 * DSL Extension System
 * 
 * This module provides an extension system for the DSL, allowing for extensibility
 * through extension points for validation, compilation, and transformation.
 */

import { ExtensionSystem } from '@architectlm/extensions';
import { BaseComponent } from './types.js';

/**
 * DSL extension points
 */
export const DSL_EXTENSION_POINTS = {
  VALIDATE_COMPONENT: 'dsl:validate-component',
  COMPILE_COMPONENT: 'dsl:compile-component',
  TRANSFORM_COMPONENT: 'dsl:transform-component'
};

/**
 * Context for component validation
 */
export interface ValidationContext {
  /**
   * The component being validated
   */
  component: BaseComponent;
  
  /**
   * The validation result
   */
  validationResult: {
    isValid: boolean;
    errors: string[];
  };
  
  /**
   * Additional options for validation
   */
  options?: Record<string, any>;
}

/**
 * Context for component compilation
 */
export interface CompilationContext {
  /**
   * The component being compiled
   */
  component: BaseComponent;
  
  /**
   * The generated code
   */
  code: string;
  
  /**
   * Additional options for compilation
   */
  options?: Record<string, any>;
}

/**
 * Context for component transformation
 */
export interface TransformationContext {
  /**
   * The component being transformed
   */
  component: BaseComponent;
  
  /**
   * The transformed component
   */
  transformedComponent: any;
  
  /**
   * Additional options for transformation
   */
  options?: Record<string, any>;
}

/**
 * DSL Extension System
 * 
 * Provides extension points for DSL component processing
 */
export class DSLExtensionSystem {
  private extensionSystem: ExtensionSystem;
  
  /**
   * Creates a new DSL extension system
   * @param extensionSystem The extension system to use
   */
  constructor(extensionSystem: ExtensionSystem) {
    this.extensionSystem = extensionSystem;
  }
  
  /**
   * Initializes the DSL extension system
   */
  initialize(): void {
    // Register extension points if they don't already exist
    if (!this.extensionSystem.hasExtensionPoint(DSL_EXTENSION_POINTS.VALIDATE_COMPONENT)) {
      this.extensionSystem.registerExtensionPoint({
        name: DSL_EXTENSION_POINTS.VALIDATE_COMPONENT,
        description: 'Validates a DSL component'
      });
    }
    
    if (!this.extensionSystem.hasExtensionPoint(DSL_EXTENSION_POINTS.COMPILE_COMPONENT)) {
      this.extensionSystem.registerExtensionPoint({
        name: DSL_EXTENSION_POINTS.COMPILE_COMPONENT,
        description: 'Compiles a DSL component'
      });
    }
    
    if (!this.extensionSystem.hasExtensionPoint(DSL_EXTENSION_POINTS.TRANSFORM_COMPONENT)) {
      this.extensionSystem.registerExtensionPoint({
        name: DSL_EXTENSION_POINTS.TRANSFORM_COMPONENT,
        description: 'Transforms a DSL component'
      });
    }
  }
  
  /**
   * Validates a component
   * @param component The component to validate
   * @param context The validation context
   * @returns The updated validation context
   */
  async validateComponent(
    component: BaseComponent,
    context: ValidationContext
  ): Promise<ValidationContext> {
    // Trigger the validation extension point
    return this.extensionSystem.triggerExtensionPoint(
      DSL_EXTENSION_POINTS.VALIDATE_COMPONENT,
      context
    ) as Promise<ValidationContext>;
  }
  
  /**
   * Compiles a component
   * @param component The component to compile
   * @param context The compilation context
   * @returns The updated compilation context
   */
  async compileComponent(
    component: BaseComponent,
    context: CompilationContext
  ): Promise<CompilationContext> {
    // Trigger the compilation extension point
    return this.extensionSystem.triggerExtensionPoint(
      DSL_EXTENSION_POINTS.COMPILE_COMPONENT,
      context
    ) as Promise<CompilationContext>;
  }
  
  /**
   * Transforms a component
   * @param component The component to transform
   * @param context The transformation context
   * @returns The updated transformation context
   */
  async transformComponent(
    component: BaseComponent,
    context: TransformationContext
  ): Promise<TransformationContext> {
    // Trigger the transformation extension point
    return this.extensionSystem.triggerExtensionPoint(
      DSL_EXTENSION_POINTS.TRANSFORM_COMPONENT,
      context
    ) as Promise<TransformationContext>;
  }
} 