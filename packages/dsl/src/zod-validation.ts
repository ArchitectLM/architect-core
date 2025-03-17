/**
 * Zod schema validation for DSL components
 */

import { z } from 'zod';
import { BaseComponent, ComponentType, Component } from './types.js';
import { ValidationResult, ZodSchemaFor, ComponentValidator } from './enhanced-types.js';

/**
 * Base Zod schema for all components
 */
export const baseComponentSchema = z.object({
  type: z.nativeEnum(ComponentType),
  name: z.string().min(1, "Component name cannot be empty"),
  description: z.string().optional(),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Version must be in semver format (e.g., 1.0.0)").optional(),
  tags: z.array(z.string()).optional(),
  authors: z.array(z.string()).optional(),
  relatedComponents: z.array(
    z.object({
      ref: z.string(),
      relationship: z.string(),
      description: z.string().optional()
    })
  ).optional(),
  path: z.string().optional(),
  examples: z.array(z.any()).optional()
});

/**
 * Schema component Zod schema
 */
export const schemaComponentSchema = baseComponentSchema.extend({
  type: z.literal(ComponentType.SCHEMA),
  definition: z.object({
    type: z.string(),
    properties: z.record(z.any()).optional(),
    required: z.array(z.string()).optional()
  }).passthrough()
});

/**
 * Command component Zod schema
 */
export const commandComponentSchema = baseComponentSchema.extend({
  type: z.literal(ComponentType.COMMAND),
  input: z.object({
    ref: z.string(),
    required: z.boolean().optional(),
    description: z.string().optional()
  }),
  output: z.object({
    ref: z.string(),
    required: z.boolean().optional(),
    description: z.string().optional()
  }),
  plugins: z.record(z.object({
    ref: z.string(),
    description: z.string().optional(),
    operations: z.array(z.string()).optional()
  })).optional(),
  extensionPoints: z.record(z.object({
    description: z.string(),
    parameters: z.array(z.string()).optional(),
    examples: z.array(z.string()).optional()
  })).optional(),
  produces: z.array(z.object({
    event: z.string(),
    description: z.string().optional()
  })).optional()
});

/**
 * Generic component validator using Zod
 */
export class ZodComponentValidator<T extends BaseComponent> implements ComponentValidator<T> {
  private schema: ZodSchemaFor<T>;

  constructor(schema: ZodSchemaFor<T>) {
    this.schema = schema;
  }

  validate(component: T): ValidationResult<T> {
    try {
      this.schema.parse(component);
      return {
        isValid: true,
        errors: [],
        component
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(err => {
            const path = err.path.join('.');
            return `${path ? path + ': ' : ''}${err.message}`;
          }),
          component
        };
      }
      return {
        isValid: false,
        errors: ['Unknown validation error'],
        component
      };
    }
  }
}

/**
 * Factory for creating component validators
 */
export class ComponentValidatorFactory {
  private static validators: Map<ComponentType, ComponentValidator<any>> = new Map();

  /**
   * Initialize default validators
   */
  static initialize(): void {
    this.validators.set(
      ComponentType.SCHEMA, 
      new ZodComponentValidator(schemaComponentSchema as any)
    );
    this.validators.set(
      ComponentType.COMMAND, 
      new ZodComponentValidator(commandComponentSchema as any)
    );
    // Add more validators for other component types
  }

  /**
   * Get a validator for a component type
   */
  static getValidator<T extends BaseComponent>(type: ComponentType): ComponentValidator<T> {
    const validator = this.validators.get(type);
    if (!validator) {
      throw new Error(`No validator registered for component type: ${type}`);
    }
    return validator as ComponentValidator<T>;
  }

  /**
   * Register a custom validator
   */
  static registerValidator<T extends BaseComponent>(
    type: ComponentType, 
    validator: ComponentValidator<T>
  ): void {
    this.validators.set(type, validator);
  }
}

// Initialize validators
ComponentValidatorFactory.initialize(); 