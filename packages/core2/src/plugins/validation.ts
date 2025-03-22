import { Extension } from '../models/extension';

/**
 * JSON Schema type for validating inputs
 */
export interface JSONSchema {
  type: string;
  required?: string[];
  properties?: Record<string, any>;
  items?: JSONSchema;
  enum?: any[];
  [key: string]: any;
}

/**
 * Result of a validation operation
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validation mode determining how validation failures are handled
 */
export type ValidationMode = 'strict' | 'warn';

/**
 * Custom validator function signature
 */
export type ValidatorFunction = (input: any) => ValidationResult;

/**
 * Configuration for validating a task's input
 */
export interface TaskValidationConfig {
  /** JSON Schema for validation */
  schema?: JSONSchema;
  
  /** Custom validator function */
  validator?: ValidatorFunction;
  
  /** How to handle validation failures */
  mode?: ValidationMode;
  
  /** Whether validation is disabled for this task */
  disabled?: boolean;
}

/**
 * Configuration for a single transition validation
 */
export interface TransitionValidationConfig {
  /** JSON Schema for validation */
  schema?: JSONSchema;
  
  /** Custom validator function */
  validator?: ValidatorFunction;
  
  /** How to handle validation failures */
  mode?: ValidationMode;
}

/**
 * Configuration for validating a process's transitions
 */
export interface ProcessValidationConfig {
  /** Validation rules for each transition event */
  transitions: Record<string, TransitionValidationConfig>;
  
  /** Whether validation is disabled for this process */
  disabled?: boolean;
}

/**
 * Validation plugin for validating inputs and transitions
 */
export class ValidationPlugin implements Extension {
  name = 'validation-plugin';
  description = 'Validates task inputs and process transitions';
  
  private taskValidations: Map<string, TaskValidationConfig> = new Map();
  private processValidations: Map<string, ProcessValidationConfig> = new Map();
  
  hooks = {
    'task:beforeExecution': async (context: any) => {
      const taskId = context.taskType;
      const input = context.input;
      
      // Check if we have validation rules for this task
      if (!this.taskValidations.has(taskId)) {
        return context;
      }
      
      const config = this.taskValidations.get(taskId)!;
      
      // Skip validation if disabled
      if (config.disabled) {
        return context;
      }
      
      // Validate the input
      const result = this.validateTaskInput(taskId, input);
      
      // Handle validation result based on mode
      if (!result.valid) {
        if (config.mode === 'warn') {
          console.warn(`Validation warning for task ${taskId}:`, result.errors);
        } else {
          throw new Error(`Task input validation failed for ${taskId}: ${result.errors?.join(', ')}`);
        }
      }
      
      return context;
    },
    
    'process:beforeTransition': async (context: any) => {
      const processType = context.processType;
      const event = context.event;
      const data = context.data;
      
      // Check if we have validation rules for this process
      if (!this.processValidations.has(processType)) {
        return context;
      }
      
      const config = this.processValidations.get(processType)!;
      
      // Skip validation if disabled
      if (config.disabled) {
        return context;
      }
      
      // Check if we have rules for this transition
      if (!config.transitions[event]) {
        return context;
      }
      
      // Validate the transition
      const result = this.validateProcessTransition(processType, event, data);
      
      // Handle validation result based on mode
      if (!result.valid) {
        if (config.transitions[event].mode === 'warn') {
          console.warn(`Validation warning for process ${processType} transition ${event}:`, result.errors);
        } else {
          throw new Error(`Process transition validation failed for ${processType}.${event}: ${result.errors?.join(', ')}`);
        }
      }
      
      return context;
    }
  };
  
  /**
   * Set validation rules for a task
   */
  setTaskValidation(taskId: string, config: TaskValidationConfig): void {
    // Merge with existing config if any
    const existingConfig = this.taskValidations.get(taskId) || {};
    this.taskValidations.set(taskId, { ...existingConfig, ...config });
  }
  
  /**
   * Set validation rules for a process
   */
  setProcessValidation(processType: string, config: ProcessValidationConfig): void {
    // Merge with existing config if any
    const existingConfig = this.processValidations.get(processType) || { transitions: {} };
    
    // Merge transitions
    const mergedTransitions = {
      ...existingConfig.transitions,
      ...config.transitions
    };
    
    this.processValidations.set(processType, {
      ...existingConfig,
      ...config,
      transitions: mergedTransitions
    });
  }
  
  /**
   * Validate a task input against its validation rules
   */
  validateTaskInput(taskId: string, input: any): ValidationResult {
    const config = this.taskValidations.get(taskId);
    
    if (!config) {
      return { valid: true };
    }
    
    // Use custom validator if provided
    if (config.validator) {
      return config.validator(input);
    }
    
    // Use schema validation if provided
    if (config.schema) {
      return this.validateWithSchema(input, config.schema);
    }
    
    // No validation rules, so input is valid
    return { valid: true };
  }
  
  /**
   * Validate a process transition against its validation rules
   */
  validateProcessTransition(processType: string, event: string, data: any): ValidationResult {
    const config = this.processValidations.get(processType);
    
    if (!config || !config.transitions[event]) {
      return { valid: true };
    }
    
    const transitionConfig = config.transitions[event];
    
    // Use custom validator if provided
    if (transitionConfig.validator) {
      return transitionConfig.validator(data);
    }
    
    // Use schema validation if provided
    if (transitionConfig.schema) {
      return this.validateWithSchema(data, transitionConfig.schema);
    }
    
    // No validation rules, so transition is valid
    return { valid: true };
  }
  
  /**
   * Validate data against a JSON Schema
   */
  private validateWithSchema(data: any, schema: JSONSchema): ValidationResult {
    // Simple JSON Schema validation implementation
    // In a real implementation, you would use a library like Ajv
    
    const errors: string[] = [];
    
    // Check type
    if (schema.type) {
      const schemaType = schema.type;
      let actualType = typeof data;
      
      // Special handling for arrays and null
      if (Array.isArray(data)) actualType = 'array' as any;
      if (data === null) actualType = 'null' as any;
      
      if (schemaType !== actualType) {
        errors.push(`Expected type ${schemaType}, but got ${actualType}`);
      }
    }
    
    // Check required properties
    if (schema.type === 'object' && schema.required && schema.required.length > 0) {
      for (const prop of schema.required) {
        if (data === null || data === undefined || !(prop in data)) {
          errors.push(`Missing required property: ${prop}`);
        }
      }
    }
    
    // Check properties
    if (schema.type === 'object' && schema.properties && typeof data === 'object' && data !== null) {
      for (const [prop, propSchema] of Object.entries(schema.properties)) {
        if (prop in data) {
          const propResult = this.validateWithSchema(data[prop], propSchema);
          if (!propResult.valid) {
            errors.push(...propResult.errors!.map(err => `Property ${prop}: ${err}`));
          }
        }
      }
    }
    
    // Check enum values
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
    }
    
    // Check string length
    if (schema.type === 'string' && typeof data === 'string') {
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        errors.push(`String must be at least ${schema.minLength} characters long`);
      }
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        errors.push(`String must be at most ${schema.maxLength} characters long`);
      }
    }
    
    // Check number constraints
    if ((schema.type === 'number' || schema.type === 'integer') && typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) {
        errors.push(`Value must be >= ${schema.minimum}`);
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        errors.push(`Value must be <= ${schema.maximum}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

/**
 * Create a new validation plugin
 */
export function createValidationPlugin(): Extension {
  return new ValidationPlugin();
} 