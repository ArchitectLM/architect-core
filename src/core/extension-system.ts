/**
 * Extension System
 * 
 * This module provides functionality for extending the core schema with
 * domain-specific extensions.
 */

/**
 * Schema extension definition
 */
export interface SchemaExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  domain: string;
  schemas: Record<string, any>;
  validators: Record<string, (entity: any) => { valid: boolean; errors: string[] }>;
  transformers: Record<string, (entity: any) => any>;
  metadata?: Record<string, any>;
}

/**
 * Registry for schema extensions
 */
export class ExtensionRegistry {
  private extensions: Map<string, SchemaExtension> = new Map();
  
  /**
   * Register an extension
   */
  registerExtension(extension: SchemaExtension): void {
    // Validate extension
    this.validateExtension(extension);
    
    // Register extension
    this.extensions.set(extension.id, extension);
  }
  
  /**
   * Get an extension by ID
   */
  getExtension(id: string): SchemaExtension | undefined {
    return this.extensions.get(id);
  }
  
  /**
   * Get all extensions for a domain
   */
  getExtensionsForDomain(domain: string): SchemaExtension[] {
    return Array.from(this.extensions.values())
      .filter(ext => ext.domain === domain);
  }
  
  /**
   * Get all registered extensions
   */
  getAllExtensions(): SchemaExtension[] {
    return Array.from(this.extensions.values());
  }
  
  /**
   * Validate an extension before registration
   */
  private validateExtension(extension: SchemaExtension): void {
    // Check required fields
    if (!extension.id || !extension.name || !extension.version || !extension.domain) {
      throw new Error('Extension must have id, name, version, and domain');
    }
    
    // Check for conflicts with existing extensions
    const existing = this.getExtension(extension.id);
    if (existing) {
      throw new Error(`Extension with id ${extension.id} already registered`);
    }
  }
}

/**
 * Manager for applying extensions to schemas
 */
export class ExtensionManager {
  /**
   * Create a new extension manager
   */
  constructor(private registry: ExtensionRegistry) {}
  
  /**
   * Extend a schema with extensions
   */
  extendSchema(baseSchema: any, extensionIds: string[]): any {
    let extendedSchema = { ...baseSchema };
    
    // Apply extensions in order
    for (const extensionId of extensionIds) {
      const extension = this.registry.getExtension(extensionId);
      if (!extension) {
        throw new Error(`Extension ${extensionId} not found`);
      }
      
      // Merge schemas
      extendedSchema = this.mergeSchemas(extendedSchema, extension.schemas);
    }
    
    return extendedSchema;
  }
  
  /**
   * Validate an entity with extensions
   */
  validateWithExtensions(
    entity: any, 
    entityType: string, 
    extensionIds: string[]
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    // Apply validators from each extension
    for (const extensionId of extensionIds) {
      const extension = this.registry.getExtension(extensionId);
      if (!extension) continue;
      
      const validator = extension.validators[entityType];
      if (validator) {
        const result = validator(entity);
        if (!result.valid) {
          errors.push(...result.errors.map(err => `[${extension.name}] ${err}`));
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Transform an entity with extensions
   */
  transformWithExtensions(
    entity: any, 
    entityType: string, 
    extensionIds: string[]
  ): any {
    let transformed = { ...entity };
    
    // Apply transformers from each extension
    for (const extensionId of extensionIds) {
      const extension = this.registry.getExtension(extensionId);
      if (!extension) continue;
      
      const transformer = extension.transformers[entityType];
      if (transformer) {
        transformed = transformer(transformed);
      }
    }
    
    return transformed;
  }
  
  /**
   * Merge schemas from an extension into a base schema
   */
  private mergeSchemas(baseSchema: any, extensionSchemas: Record<string, any>): any {
    const result = { ...baseSchema };
    
    // If base schema doesn't have schemas property, add it
    if (!result.schemas) {
      result.schemas = {};
    }
    
    // Merge extension schemas into base schemas
    Object.entries(extensionSchemas).forEach(([key, schema]) => {
      if (result.schemas[key]) {
        // Merge existing schema
        result.schemas[key] = this.mergeSchemaObjects(result.schemas[key], schema);
      } else {
        // Add new schema
        result.schemas[key] = schema;
      }
    });
    
    return result;
  }
  
  /**
   * Merge two schema objects
   */
  private mergeSchemaObjects(base: any, extension: any): any {
    const result = { ...base };
    
    // Merge properties
    if (extension.properties) {
      result.properties = {
        ...result.properties,
        ...extension.properties
      };
    }
    
    // Merge required fields
    if (extension.required && Array.isArray(extension.required)) {
      result.required = [
        ...(result.required || []),
        ...extension.required.filter((field: string) => !(result.required || []).includes(field))
      ];
    }
    
    // Merge enums (if both are arrays)
    if (extension.enum && Array.isArray(extension.enum) && 
        result.enum && Array.isArray(result.enum)) {
      result.enum = [
        ...result.enum,
        ...extension.enum.filter((value: any) => !result.enum.includes(value))
      ];
    }
    
    return result;
  }
} 