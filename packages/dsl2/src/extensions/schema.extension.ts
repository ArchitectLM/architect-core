/**
 * Schema extension for the DSL
 * 
 * Adds validation and compilation capabilities to schema components.
 */
import { createExtension, defineExtension } from './index.js';
import { DSL } from '../core/dsl.js';
import { ComponentType, SchemaComponentDefinition } from '../models/component.js';

/**
 * Schema extension options
 */
export interface SchemaExtensionOptions {
  /**
   * Whether to enable strict validation mode by default
   */
  strictMode?: boolean;
  
  /**
   * Whether to allow additional properties by default
   */
  additionalProperties?: boolean;
  
  /**
   * Whether to automatically compile schemas
   */
  autoCompileEnabled?: boolean;
  
  /**
   * Format for examples generation
   */
  exampleFormat?: 'json' | 'typescript' | 'openapi';
}

/**
 * Result of schema validation
 */
export interface SchemaValidationResult {
  /**
   * Whether the validation passed
   */
  valid: boolean;
  
  /**
   * List of validation errors
   */
  errors: string[];
  
  /**
   * Path to the property with error (if applicable)
   */
  errorPath?: string;
  
  /**
   * Original validated data if valid
   */
  data?: any;
}

/**
 * Setup function for the schema extension
 */
export function setupSchemaExtension(dsl: DSL, options: SchemaExtensionOptions = {}): void {
  // Default options
  const defaultOptions: SchemaExtensionOptions = {
    strictMode: false,
    additionalProperties: true,
    autoCompileEnabled: true,
    exampleFormat: 'json'
  };
  
  // Merge options
  const config = { ...defaultOptions, ...options };
  
  // Register schema components
  const schemaComponents = dsl.getComponentsByType<SchemaComponentDefinition>(ComponentType.SCHEMA);
  
  // Enhance each schema component
  schemaComponents.forEach(schema => {
    extendSchemaComponent(schema, config);
    
    // Auto-compile if enabled
    if (config.autoCompileEnabled) {
      (schema as any).compile();
    }
  });
  
  // Add observer for new schema components
  // This would be implemented with a proper observer pattern
  // For now, this is a placeholder
  console.log('Schema extension initialized with options:', config);
}

/**
 * Extends a schema component with validation capabilities
 */
function extendSchemaComponent(schema: SchemaComponentDefinition, options: SchemaExtensionOptions): void {
  // Add validation method
  (schema as any).validate = function(data: any, validationOptions: {strict?: boolean} = {}): SchemaValidationResult {
    // In a real implementation, this would use a JSON Schema validator like Ajv
    // For this example, we'll implement a simple validation
    const isValid = validateSchema(schema, data, {
      ...options,
      strict: validationOptions.strict ?? options.strictMode
    });
    
    if (isValid.valid) {
      return {
        valid: true,
        errors: [],
        data
      };
    } else {
      return {
        valid: false,
        errors: isValid.errors,
        errorPath: isValid.errorPath
      };
    }
  };
  
  // Add compile method
  (schema as any).compile = function(): void {
    // In a real implementation, this would compile the schema for faster validation
    console.log(`Compiling schema: ${schema.id}`);
    (schema as any).compiled = true;
  };
  
  // Add method to get JSON Schema representation
  (schema as any).getJsonSchema = function(): any {
    // In a real implementation, this would convert the internal schema to JSON Schema
    return {
      type: 'object',
      properties: schema.properties,
      required: schema.required,
      additionalProperties: options.additionalProperties
    };
  };
  
  // Add method to generate example data
  (schema as any).generateExample = function(): any {
    // In a real implementation, this would generate example data based on the schema
    return generateExampleFromSchema(schema);
  };
  
  // Add method to generate multiple examples
  (schema as any).generateExamples = function(count: number): any[] {
    // Generate multiple different examples
    const examples = [];
    for (let i = 0; i < count; i++) {
      examples.push(generateExampleFromSchema(schema, i));
    }
    return examples;
  };
  
  // Add method to convert to TypeScript
  (schema as any).toTypeScript = function(): string {
    // In a real implementation, this would generate TypeScript interfaces
    return `interface ${schema.id} {\n  // Generated TypeScript properties\n  ${
      Object.entries(schema.properties)
        .map(([key, prop]) => `${key}: ${typeScriptTypeFromSchema(prop)}`)
        .join(';\n  ')
    }\n}`;
  };
  
  // Add method to convert to OpenAPI
  (schema as any).toOpenApi = function(): any {
    // In a real implementation, this would convert to OpenAPI format
    return {
      type: 'object',
      properties: schema.properties
    };
  };
}

/**
 * Simple schema validation logic (placeholder)
 */
function validateSchema(
  schema: SchemaComponentDefinition, 
  data: any,
  options: { strict?: boolean; additionalProperties?: boolean }
): SchemaValidationResult {
  // Check if data is an object
  if (typeof data !== 'object' || data === null) {
    return { 
      valid: false, 
      errors: ['Data must be an object'] 
    };
  }
  
  const errors: string[] = [];
  
  // Check required fields
  if (schema.required) {
    for (const field of schema.required) {
      if (data[field] === undefined) {
        errors.push(`Field '${field}' is required`);
      }
    }
  }
  
  // Check property types
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (data[key] !== undefined) {
      const error = validateProperty(key, prop, data[key]);
      if (error) {
        errors.push(error);
      }
    }
  }
  
  // Check for additional properties in strict mode
  if (options.strict && !options.additionalProperties) {
    const schemaKeys = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(data)) {
      if (!schemaKeys.has(key)) {
        errors.push(`Additional property '${key}' is not allowed`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    errorPath: errors.length > 0 ? errors[0].split(':')[0] : undefined
  };
}

/**
 * Validate a single property against its schema
 */
function validateProperty(path: string, prop: any, value: any): string | null {
  switch (prop.type) {
    case 'string':
      if (typeof value !== 'string') {
        return `${path}: Expected string, got ${typeof value}`;
      }
      if (prop.minLength && value.length < prop.minLength) {
        return `${path}: String shorter than minimum length ${prop.minLength}`;
      }
      if (prop.maxLength && value.length > prop.maxLength) {
        return `${path}: String longer than maximum length ${prop.maxLength}`;
      }
      if (prop.pattern && !new RegExp(prop.pattern).test(value)) {
        return `${path}: String does not match pattern ${prop.pattern}`;
      }
      break;
      
    case 'number':
      if (typeof value !== 'number') {
        return `${path}: Expected number, got ${typeof value}`;
      }
      if (prop.minimum !== undefined && value < prop.minimum) {
        return `${path}: Number smaller than minimum ${prop.minimum}`;
      }
      if (prop.maximum !== undefined && value > prop.maximum) {
        return `${path}: Number larger than maximum ${prop.maximum}`;
      }
      break;
      
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${path}: Expected boolean, got ${typeof value}`;
      }
      break;
      
    case 'array':
      if (!Array.isArray(value)) {
        return `${path}: Expected array, got ${typeof value}`;
      }
      if (prop.minItems && value.length < prop.minItems) {
        return `${path}: Array has fewer items than minimum ${prop.minItems}`;
      }
      if (prop.maxItems && value.length > prop.maxItems) {
        return `${path}: Array has more items than maximum ${prop.maxItems}`;
      }
      // Check array items if item schema is provided
      if (prop.items) {
        for (let i = 0; i < value.length; i++) {
          const itemError = validateProperty(`${path}[${i}]`, prop.items, value[i]);
          if (itemError) {
            return itemError;
          }
        }
      }
      break;
      
    case 'object':
      if (typeof value !== 'object' || value === null) {
        return `${path}: Expected object, got ${typeof value}`;
      }
      // Check nested properties if provided
      if (prop.properties) {
        for (const [key, nestedProp] of Object.entries(prop.properties)) {
          if (value[key] !== undefined) {
            const nestedError = validateProperty(`${path}.${key}`, nestedProp, value[key]);
            if (nestedError) {
              return nestedError;
            }
          } else if (prop.required && prop.required.includes(key)) {
            return `${path}.${key}: Required property is missing`;
          }
        }
      }
      break;
    
    default:
      return null; // Allow unknown types
  }
  
  return null; // Validation passed
}

/**
 * Generate example data based on schema definition
 */
function generateExampleFromSchema(schema: SchemaComponentDefinition, seed = 0): any {
  const result: Record<string, any> = {};
  
  // Generate a value for each property in the schema
  for (const [key, prop] of Object.entries(schema.properties)) {
    result[key] = generateValueForProperty(prop, seed, key);
  }
  
  return result;
}

/**
 * Generate a value for a schema property
 */
function generateValueForProperty(prop: any, seed = 0, path = ''): any {
  const seedValue = seed + path.length; // Simple seed variation
  
  switch (prop.type) {
    case 'string':
      if (prop.enum) {
        // Select from enum values
        return prop.enum[seedValue % prop.enum.length];
      }
      if (prop.format === 'email') {
        return `user${seedValue}@example.com`;
      }
      if (prop.format === 'uri' || prop.format === 'url') {
        return `https://example.com/resource-${seedValue}`;
      }
      if (prop.pattern) {
        // This would need a more sophisticated implementation to generate values matching patterns
        return `pattern-${seedValue}`;
      }
      // Default string
      return `example-${path}-${seedValue}`;
      
    case 'number':
      if (prop.minimum !== undefined && prop.maximum !== undefined) {
        return prop.minimum + (seedValue % (prop.maximum - prop.minimum + 1));
      }
      if (prop.minimum !== undefined) {
        return prop.minimum + seedValue;
      }
      if (prop.maximum !== undefined) {
        return Math.min(seedValue, prop.maximum);
      }
      return seedValue;
      
    case 'boolean':
      return (seedValue % 2) === 0;
      
    case 'array':
      const count = prop.minItems ? prop.minItems : Math.min(2 + (seedValue % 3), prop.maxItems || 5);
      const result = [];
      for (let i = 0; i < count; i++) {
        result.push(prop.items ? generateValueForProperty(prop.items, seed + i, `${path}[${i}]`) : `item-${i}`);
      }
      return result;
      
    case 'object':
      if (prop.properties) {
        const obj: Record<string, any> = {};
        for (const [key, nestedProp] of Object.entries(prop.properties)) {
          obj[key] = generateValueForProperty(nestedProp, seed, `${path}.${key}`);
        }
        return obj;
      }
      return { example: true };
      
    default:
      return null;
  }
}

/**
 * Convert a schema type to TypeScript type
 */
function typeScriptTypeFromSchema(prop: any): string {
  switch (prop.type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      return `Array<${prop.items ? typeScriptTypeFromSchema(prop.items) : 'any'}>`;
    case 'object':
      if (prop.properties) {
        return `{ ${
          Object.entries(prop.properties)
            .map(([key, p]) => `${key}: ${typeScriptTypeFromSchema(p)}`)
            .join('; ')
        } }`;
      }
      return 'Record<string, any>';
    default:
      return 'any';
  }
}

// Define the extension
export const schemaExtension = defineExtension('schema', (options?: SchemaExtensionOptions) => {
  return createExtension(
    'schema',
    (dsl, extOptions) => setupSchemaExtension(dsl, extOptions || options),
    () => console.log('Schema extension cleaned up')
  );
});