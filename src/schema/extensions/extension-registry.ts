/**
 * Schema Extension Registry
 * 
 * This module provides a registry for schema extensions, allowing
 * domain-specific extensions to be registered and applied to the base schema.
 */

import { z } from 'zod';
import { ReactiveSystemSchema } from '../validation';

/**
 * Schema extension interface
 */
export interface SchemaExtension {
  /**
   * Unique identifier for the extension
   */
  id: string;
  
  /**
   * Name of the extension
   */
  name: string;
  
  /**
   * Description of the extension
   */
  description: string;
  
  /**
   * Version of the extension
   */
  version: string;
  
  /**
   * Schemas defined by the extension
   */
  schemas: Record<string, z.ZodType<any>>;
  
  /**
   * Refinements to apply to the base schema
   * These functions should modify or enhance the schema
   */
  refinements: Array<(schema: any) => any>;
  
  /**
   * Validators to apply to systems using the extension
   */
  validators: Array<(system: any) => Array<{
    path: string;
    message: string;
    severity: 'error' | 'warning';
  }>>;
}

/**
 * Validation result with extension information
 */
export interface ExtensionValidationResult {
  /**
   * Whether validation succeeded
   */
  success: boolean;
  
  /**
   * Validation errors and warnings
   */
  issues: Array<{
    /**
     * Path to the issue
     */
    path: string;
    
    /**
     * Error message
     */
    message: string;
    
    /**
     * Severity of the issue
     */
    severity: 'error' | 'warning';
    
    /**
     * Extension that reported the issue
     */
    extension: string;
  }>;
}

/**
 * Registry for schema extensions
 */
export class SchemaExtensionRegistry {
  /**
   * Map of extension ID to extension
   */
  private extensions: Record<string, SchemaExtension> = {};
  
  /**
   * Registers an extension with the registry
   * @param extension The extension to register
   */
  registerExtension(extension: SchemaExtension): void {
    this.extensions[extension.id] = extension;
  }
  
  /**
   * Gets an extension by ID
   * @param id The ID of the extension to get
   * @returns The extension, or undefined if not found
   */
  getExtension(id: string): SchemaExtension | undefined {
    return this.extensions[id];
  }
  
  /**
   * Gets all registered extensions
   * @returns Array of all registered extensions
   */
  getAllExtensions(): SchemaExtension[] {
    return Object.values(this.extensions);
  }
  
  /**
   * Creates an extended schema with the specified extensions applied
   * @param extensionIds IDs of the extensions to apply
   * @returns The extended schema
   */
  createExtendedSchema(...extensionIds: string[]): z.ZodType<any> {
    // Start with the base schema
    let extendedSchema: any = ReactiveSystemSchema;
    
    // Apply each extension
    for (const id of extensionIds) {
      const extension = this.getExtension(id);
      if (!extension) {
        throw new Error(`Extension not found: ${id}`);
      }
      
      // Apply refinements
      for (const refinement of extension.refinements) {
        try {
          // Apply the refinement
          extendedSchema = refinement(extendedSchema);
        } catch (error) {
          console.error(`Error applying refinement for extension ${id}:`, error);
          throw new Error(`Failed to apply refinement for extension ${id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
    
    return extendedSchema;
  }
  
  /**
   * Validates a system against all registered extensions
   * @param system The system to validate
   * @param extensionIds IDs of the extensions to validate against
   * @returns Validation result
   */
  validateWithExtensions(system: any, ...extensionIds: string[]): ExtensionValidationResult {
    const issues: Array<{
      path: string;
      message: string;
      severity: 'error' | 'warning';
      extension: string;
    }> = [];
    
    // Apply validators from each extension
    for (const id of extensionIds) {
      const extension = this.getExtension(id);
      if (!extension) {
        throw new Error(`Extension not found: ${id}`);
      }
      
      for (const validator of extension.validators) {
        try {
          const validationResults = validator(system);
          for (const result of validationResults) {
            issues.push({
              ...result,
              extension: extension.id
            });
          }
        } catch (error) {
          console.error(`Error running validator for extension ${id}:`, error);
          issues.push({
            path: '',
            message: `Validator error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error',
            extension: extension.id
          });
        }
      }
    }
    
    // Check if there are any errors (not just warnings)
    const hasErrors = issues.some(issue => issue.severity === 'error');
    
    return {
      success: !hasErrors,
      issues
    };
  }
}

/**
 * Global extension registry instance
 */
export const extensionRegistry = new SchemaExtensionRegistry(); 