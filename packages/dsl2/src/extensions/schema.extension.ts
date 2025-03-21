/**
 * Schema extension for the DSL
 * 
 * Adds validation and compilation capabilities to schema components.
 */
import { DSL, DSLExtension } from '../core/dsl.js';
import { ComponentType } from '../models/component.js';

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
 * Schema Extension Implementation
 */
export class SchemaExtension implements DSLExtension {
  id = 'schema';
  private dsl: DSL | null = null;
  private options: SchemaExtensionOptions = {};
  
  init(dsl: DSL, options: SchemaExtensionOptions = {}): void {
    this.dsl = dsl;
    
    // Default options
    const defaultOptions: SchemaExtensionOptions = {
      strictMode: false,
      additionalProperties: true,
      autoCompileEnabled: true,
      exampleFormat: 'json'
    };
    
    // Merge options
    this.options = { ...defaultOptions, ...options };
    
    // Register schema components
    const schemaComponents = dsl.getComponentsByType(ComponentType.SCHEMA);
    
    // Enhance each schema component
    schemaComponents.forEach(schema => {
      this.enhanceSchemaComponent(schema.id);
    });
    
    // Add extension methods to the DSL itself
    this.extendDsl(dsl);
    
    console.log('Schema extension initialized with options:', this.options);
  }

  cleanup(): void {
    this.dsl = null;
    console.log('Schema extension cleaned up');
  }
  
  /**
   * Enhance DSL with schema-specific methods
   */
  private extendDsl(dsl: DSL): void {
    // Add schema-specific methods to the DSL
    if (!(dsl as any).enhanceComponent) {
      (dsl as any).enhanceComponent = (componentId: string, methods: Record<string, any>) => {
        const component = dsl.getComponent(componentId);
        if (component) {
          Object.assign(component, methods);
        }
      };
    }
    
    // Add schema validation method directly to the DSL
    (dsl as any).validateAgainstSchema = (schemaId: string, data: any, options?: any) => {
      const schema = dsl.getComponent(schemaId);
      if (!schema) {
        throw new Error(`Schema not found: ${schemaId}`);
      }
      
      if (typeof (schema as any).validate !== 'function') {
        throw new Error(`Schema ${schemaId} does not have a validate method`);
      }
      
      return (schema as any).validate(data, options);
    };
  }
  
  /**
   * Enhances a schema component with validation capabilities
   */
  private enhanceSchemaComponent(schemaId: string): void {
    if (!this.dsl) return;
    
    const schema = this.dsl.getComponent(schemaId);
    if (!schema || schema.type !== ComponentType.SCHEMA) return;
    
    const enhancedMethods = {
      // Schema validation method
      validate: (data: any, validationOptions: {strict?: boolean} = {}): SchemaValidationResult => {
        // In a real implementation, this would use a JSON Schema validator like Ajv
        const result = this.validateSchema(schema, data, {
          ...this.options,
          strict: validationOptions.strict ?? this.options.strictMode
        });
        
        return result;
      },
      
      // Compile method
      compile: (): void => {
        // In a real implementation, this would compile the schema for faster validation
        console.log(`Compiling schema: ${schema.id}`);
        (schema as any).compiled = true;
      },
      
      // Get JSON Schema representation
      getJsonSchema: (): any => {
        // Convert our internal schema to JSON Schema format
        return {
          type: 'object',
          properties: (schema as any).properties || {},
          required: (schema as any).required || [],
          additionalProperties: this.options.additionalProperties
        };
      },
      
      // Generate example data
      generateExample: (): any => {
        // Generate sample data based on the schema
        return this.generateExampleFromSchema(schema);
      },
      
      // Generate multiple examples
      generateExamples: (count: number): any[] => {
        // Generate multiple different examples
        const examples = [];
        for (let i = 0; i < count; i++) {
          examples.push(this.generateExampleFromSchema(schema, i));
        }
        return examples;
      },
      
      // Convert to TypeScript
      toTypeScript: (): string => {
        // Generate TypeScript interface definitions
        return `interface ${schema.id} {\n  // Generated TypeScript properties\n  ${
          Object.entries((schema as any).properties || {})
            .map(([key, prop]) => `${key}: ${this.typeScriptTypeFromSchema(prop)}`)
            .join(';\n  ')
        }\n}`;
      },
      
      // Convert to OpenAPI
      toOpenApi: (): any => {
        // Convert to OpenAPI format
        return {
          type: 'object',
          properties: (schema as any).properties || {}
        };
      }
    };
    
    // Enhance the component with these methods
    (this.dsl as any).enhanceComponent(schemaId, enhancedMethods);
    
    // Auto-compile if enabled
    if (this.options.autoCompileEnabled) {
      enhancedMethods.compile();
    }
  }
  
  /**
   * Validates data against a schema
   */
  private validateSchema(
    schema: any, 
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
    if (schema.properties) {
      for (const [key, prop] of Object.entries(schema.properties)) {
        if (data[key] !== undefined) {
          const error = this.validateProperty(key, prop, data[key]);
          if (error) {
            errors.push(error);
          }
        }
      }
    }
    
    // Check for additional properties in strict mode
    if (options.strict && !options.additionalProperties) {
      const schemaKeys = new Set(Object.keys(schema.properties || {}));
      for (const key of Object.keys(data)) {
        if (!schemaKeys.has(key)) {
          errors.push(`Additional property '${key}' is not allowed`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      errorPath: errors.length > 0 ? errors[0].split(':')[0] : undefined,
      data: errors.length === 0 ? data : undefined
    };
  }
  
  /**
   * Validate a single property against its schema
   */
  private validateProperty(path: string, prop: any, value: any): string | null {
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
        if (prop.format === 'email' && !this.isValidEmail(value)) {
          return `${path}: Invalid email format`;
        }
        break;
        
      case 'number':
        if (typeof value !== 'number') {
          return `${path}: Expected number, got ${typeof value}`;
        }
        if (prop.minimum !== undefined && value < prop.minimum) {
          return `${path}: Number less than minimum ${prop.minimum}`;
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          return `${path}: Number greater than maximum ${prop.maximum}`;
        }
        break;
        
      case 'integer':
        if (typeof value !== 'number' || !Number.isInteger(value)) {
          return `${path}: Expected integer, got ${typeof value}`;
        }
        if (prop.minimum !== undefined && value < prop.minimum) {
          return `${path}: Integer less than minimum ${prop.minimum}`;
        }
        if (prop.maximum !== undefined && value > prop.maximum) {
          return `${path}: Integer greater than maximum ${prop.maximum}`;
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
        if (prop.minItems !== undefined && value.length < prop.minItems) {
          return `${path}: Array has fewer items than minimum ${prop.minItems}`;
        }
        if (prop.maxItems !== undefined && value.length > prop.maxItems) {
          return `${path}: Array has more items than maximum ${prop.maxItems}`;
        }
        if (prop.items) {
          for (let i = 0; i < value.length; i++) {
            const itemError = this.validateProperty(`${path}[${i}]`, prop.items, value[i]);
            if (itemError) {
              return itemError;
            }
          }
        }
        break;
        
      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return `${path}: Expected object, got ${typeof value}`;
        }
        if (prop.properties) {
          for (const [key, subProp] of Object.entries(prop.properties)) {
            if (value[key] !== undefined) {
              const propError = this.validateProperty(`${path}.${key}`, subProp, value[key]);
              if (propError) {
                return propError;
              }
            } else if ((prop.required || []).includes(key)) {
              return `${path}.${key}: Required property is missing`;
            }
          }
        }
        break;
        
      default:
        return `${path}: Unsupported type: ${prop.type}`;
    }
    
    return null;
  }
  
  /**
   * Simple email validation
   */
  private isValidEmail(email: string): boolean {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }
  
  /**
   * Generate example data for a schema
   */
  private generateExampleFromSchema(schema: any, seed: number = 0): any {
    const result: Record<string, any> = {};
    
    if (!schema.properties) return result;
    
    // Generate values for all properties
    for (const [key, prop] of Object.entries(schema.properties)) {
      result[key] = this.generateValueForProperty(prop, seed, key);
    }
    
    return result;
  }
  
  /**
   * Generate a value for a property based on its type
   */
  private generateValueForProperty(prop: any, seed: number = 0, path: string = ''): any {
    const seedStr = `${path}-${seed}`;
    const seedNum = Array.from(seedStr).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    switch (prop.type) {
      case 'string':
        if (prop.enum && prop.enum.length > 0) {
          return prop.enum[seedNum % prop.enum.length];
        }
        if (prop.format === 'email') {
          return `user${seedNum}@example.com`;
        }
        if (prop.format === 'date-time') {
          return new Date(Date.now() + seedNum * 86400000).toISOString();
        }
        if (prop.format === 'date') {
          return new Date(Date.now() + seedNum * 86400000).toISOString().split('T')[0];
        }
        
        // Generate string of appropriate length
        const minLength = prop.minLength || 5;
        const maxLength = prop.maxLength || 10;
        const length = minLength + (seedNum % (maxLength - minLength + 1));
        return `Example${seedNum.toString().substring(0, length)}`;
        
      case 'number':
      case 'integer':
        const min = prop.minimum !== undefined ? prop.minimum : 0;
        const max = prop.maximum !== undefined ? prop.maximum : 1000;
        const value = min + (seedNum % (max - min + 1));
        return prop.type === 'integer' ? Math.floor(value) : value;
        
      case 'boolean':
        return seedNum % 2 === 0;
        
      case 'array':
        const minItems = prop.minItems || 1;
        const maxItems = prop.maxItems || 3;
        const count = minItems + (seedNum % (maxItems - minItems + 1));
        const result = [];
        
        for (let i = 0; i < count; i++) {
          result.push(this.generateValueForProperty(prop.items, seed + i, `${path}[${i}]`));
        }
        
        return result;
        
      case 'object':
        const objResult: Record<string, any> = {};
        
        if (prop.properties) {
          for (const [key, subProp] of Object.entries(prop.properties)) {
            objResult[key] = this.generateValueForProperty(subProp, seed, `${path}.${key}`);
          }
        }
        
        return objResult;
        
      default:
        return null;
    }
  }
  
  /**
   * Convert schema type to TypeScript type
   */
  private typeScriptTypeFromSchema(prop: any): string {
    switch (prop.type) {
      case 'string':
        if (prop.enum && prop.enum.length > 0) {
          return prop.enum.map((v: string) => `'${v}'`).join(' | ');
        }
        return 'string';
        
      case 'number':
      case 'integer':
        return 'number';
        
      case 'boolean':
        return 'boolean';
        
      case 'array':
        if (prop.items) {
          return `${this.typeScriptTypeFromSchema(prop.items)}[]`;
        }
        return 'any[]';
        
      case 'object':
        if (prop.properties) {
          return `{ ${
            Object.entries(prop.properties)
              .map(([key, p]) => `${key}${(prop.required || []).includes(key) ? '' : '?'}: ${this.typeScriptTypeFromSchema(p)}`)
              .join('; ')
          } }`;
        }
        return 'Record<string, any>';
        
      default:
        return 'any';
    }
  }
}

/**
 * Setup function for the schema extension
 */
export function setupSchemaExtension(dsl: DSL, options: SchemaExtensionOptions = {}): void {
  const extension = new SchemaExtension();
  dsl.registerExtension(extension, options);
}