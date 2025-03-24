import { Extension, ExtensionHookRegistration, ExtensionPointName } from '../models/extension-system';

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
  id = 'validation-plugin';
  name = 'validation-plugin';
  description = 'Validates task inputs and process transitions';
  dependencies: string[] = [];

  // Hooks property for backward compatibility with tests
  hooks: Record<string, Function>;
  
  private taskValidations: Map<string, TaskValidationConfig> = new Map();
  private processValidations: Map<string, ProcessValidationConfig> = new Map();
  
  constructor() {
    // Initialize hooks property for backward compatibility
    this.hooks = {
      'task:beforeExecution': this.validateTaskHook.bind(this),
      'process:beforeTransition': this.validateProcessHook.bind(this),
      // For backward compatibility with tests that use process:beforeUpdate
      'process:beforeUpdate': this.validateProcessHook.bind(this)
    };
  }

  // Hook method for task validation
  private async validateTaskHook(context: any): Promise<any> {
    const taskId = context.taskType;
    const input = context.data || context.input; // Handle both formats
    
    // Skip validation if not configured for this task
    if (!this.taskValidations.has(taskId)) {
      return context;
    }
    
    const config = this.taskValidations.get(taskId)!;
    
    // Skip if validation is disabled
    if (config.disabled) {
      return context;
    }
    
    // Validate input
    const result = this.validateTaskInput(taskId, input);
    
    // Handle validation result
    if (!result.valid) {
      if (config.mode === 'strict') {
        throw new Error(`Validation failed for task ${taskId}: ${result.errors?.join(', ')}`);
      } else {
        // In warn mode, log warning but don't modify context
        console.warn(`Validation warning for task ${taskId}:`, result.errors);
        return context;
      }
    }
    
    return context;
  }

  // Hook method for process validation
  private async validateProcessHook(context: any): Promise<any> {
    const processType = context.processType;
    const event = context.event;
    const data = context.data;
    
    // Skip validation if not configured for this process
    if (!this.processValidations.has(processType)) {
      return context;
    }
    
    const config = this.processValidations.get(processType)!;
    
    // Skip if validation is disabled
    if (config.disabled) {
      return context;
    }
    
    // Skip if no validation for this transition
    if (!config.transitions[event]) {
      return context;
    }
    
    // Validate transition data
    const result = this.validateProcessTransition(processType, event, data);
    
    // Handle validation result
    if (!result.valid) {
      if (config.transitions[event].mode === 'strict') {
        throw new Error(`Validation failed for process ${processType} transition ${event}: ${result.errors?.join(', ')}`);
      } else {
        // In warn mode, log warning but don't modify context
        console.warn(`Validation warning for process ${processType} transition ${event}:`, result.errors);
        return context;
      }
    }
    
    return context;
  }
  
  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    return [
      {
        pointName: 'task:beforeExecution',
        hook: this.validateTaskHook.bind(this)
      },
      {
        pointName: 'process:beforeUpdate',
        hook: this.validateProcessHook.bind(this)
      }
    ];
  }
  
  getVersion(): string {
    return '1.0.0';
  }
  
  getCapabilities(): string[] {
    return ['input-validation', 'transition-validation', 'schema-validation'];
  }
  
  /**
   * Set validation rules for a task
   */
  setTaskValidation(taskId: string, config: TaskValidationConfig): void {
    // Set default mode if not specified
    const fullConfig: TaskValidationConfig = {
      mode: 'strict',
      disabled: false,
      ...config
    };
    
    this.taskValidations.set(taskId, fullConfig);
  }
  
  /**
   * Set validation rules for a process
   */
  setProcessValidation(processType: string, config: ProcessValidationConfig): void {
    // Set default disabled state if not specified
    const fullConfig: ProcessValidationConfig = {
      ...config,
      disabled: config.disabled ?? false,
      transitions: { ...config.transitions }
    };
    
    // Set default mode for transitions if not specified
    for (const [eventType, transitionConfig] of Object.entries(fullConfig.transitions)) {
      fullConfig.transitions[eventType] = {
        mode: 'strict',
        ...transitionConfig
      };
    }
    
    this.processValidations.set(processType, fullConfig);
  }
  
  /**
   * Validate a task input against its validation rules
   */
  validateTaskInput(taskId: string, input: any): ValidationResult {
    // Default to valid if no validation is configured
    if (!this.taskValidations.has(taskId)) {
      return { valid: true };
    }
    
    const config = this.taskValidations.get(taskId)!;
    
    // Skip if disabled
    if (config.disabled) {
      return { valid: true };
    }
    
    // Use custom validator if provided
    if (config.validator) {
      return config.validator(input);
    }
    
    // Use JSON Schema validation if provided
    if (config.schema) {
      return this.validateWithSchema(input, config.schema);
    }
    
    // Default to valid if no validation method is configured
    return { valid: true };
  }
  
  /**
   * Validate a process transition against its validation rules
   */
  validateProcessTransition(processType: string, event: string, data: any): ValidationResult {
    // Default to valid if no validation is configured
    if (!this.processValidations.has(processType)) {
      return { valid: true };
    }
    
    const config = this.processValidations.get(processType)!;
    
    // Skip if disabled
    if (config.disabled) {
      return { valid: true };
    }
    
    // Skip if no validation for this transition
    if (!config.transitions[event]) {
      return { valid: true };
    }
    
    const transitionConfig = config.transitions[event];
    
    // Use custom validator if provided
    if (transitionConfig.validator) {
      return transitionConfig.validator(data);
    }
    
    // Use JSON Schema validation if provided
    if (transitionConfig.schema) {
      return this.validateWithSchema(data, transitionConfig.schema);
    }
    
    // Default to valid if no validation method is configured
    return { valid: true };
  }
  
  /**
   * Clear validation rules for a specific task
   */
  clearTaskValidation(taskId: string): void {
    this.taskValidations.delete(taskId);
  }
  
  /**
   * Get detailed validation information for a specific task
   * This includes the schema, validation mode, and any custom validator presence
   */
  getValidationDetails(taskId: string): { 
    hasValidation: boolean; 
    schema?: JSONSchema; 
    hasCustomValidator: boolean; 
    mode: ValidationMode;
    disabled: boolean;
  } {
    const hasValidation = this.taskValidations.has(taskId);
    
    if (!hasValidation) {
      return {
        hasValidation: false,
        hasCustomValidator: false,
        mode: 'strict',
        disabled: false
      };
    }
    
    const config = this.taskValidations.get(taskId)!;
    
    return {
      hasValidation: true,
      schema: config.schema,
      hasCustomValidator: !!config.validator,
      mode: config.mode || 'strict',
      disabled: config.disabled || false
    };
  }
  
  /**
   * Validate data against a JSON Schema
   */
  private validateWithSchema(data: any, schema: JSONSchema): ValidationResult {
    // Very simple JSON Schema validation implementation
    // In a real implementation, you would use a library like ajv
    
    const errors: string[] = [];
    
    // Check type
    if (schema.type) {
      const expectedType = schema.type;
      // Determine data type as a string
      let actualType = 'unknown';
      
      if (Array.isArray(data)) {
        actualType = 'array';
      } else if (data === null) {
        actualType = 'null';
      } else {
        actualType = typeof data;
      }
      
      if (expectedType !== actualType) {
        errors.push(`Expected type ${expectedType}, but got ${actualType}`);
      }
    }
    
    // Check required properties for objects
    if (schema.type === 'object' && schema.required && schema.required.length > 0) {
      for (const requiredProp of schema.required) {
        if (!(requiredProp in data)) {
          errors.push(`Missing required property: ${requiredProp}`);
        }
      }
    }
    
    // Check properties for objects
    if (schema.type === 'object' && schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propName in data) {
          const propResult = this.validateWithSchema(data[propName], propSchema as JSONSchema);
          if (!propResult.valid && propResult.errors) {
            errors.push(...propResult.errors.map(err => `${propName}: ${err}`));
          }
        }
      }
    }
    
    // Check items for arrays
    if (schema.type === 'array' && schema.items && Array.isArray(data)) {
      data.forEach((item, index) => {
        const itemResult = this.validateWithSchema(item, schema.items as JSONSchema);
        if (!itemResult.valid && itemResult.errors) {
          errors.push(...itemResult.errors.map(err => `[${index}]: ${err}`));
        }
      });
    }
    
    // Check enum values
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push(`Value must be one of: ${schema.enum.join(', ')}`);
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
