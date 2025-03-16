/**
 * Extension Registry
 * 
 * Registry for schema extensions.
 */

import { z } from 'zod';

/**
 * Extension validation issue
 */
export interface ExtensionValidationIssue {
  /**
   * Path to the issue
   */
  path: string;
  
  /**
   * Issue message
   */
  message: string;
  
  /**
   * Issue severity
   */
  severity: 'error' | 'warning';
  
  /**
   * Extension that reported the issue
   */
  extension?: string;
}

/**
 * Extension validation result
 */
export interface ExtensionValidationResult {
  /**
   * Whether validation succeeded
   */
  success: boolean;
  
  /**
   * Validation issues
   */
  issues: ExtensionValidationIssue[];
}

/**
 * Schema extension
 */
export interface SchemaExtension {
  /**
   * Extension ID
   */
  id: string;
  
  /**
   * Extension name
   */
  name: string;
  
  /**
   * Extension description
   */
  description: string;

  /**
   * Extension version
   */
  version?: string;
  
  /**
   * Schema definitions
   */
  schemas?: Record<string, z.ZodType<any, any, any>>;
  
  /**
   * Schema refinements
   */
  refinements: Array<(schema: any) => any>;
  
  /**
   * Custom validators
   */
  validators: Array<(schema: any) => ExtensionValidationIssue[]>;
}

/**
 * Schema extension registry
 */
export class SchemaExtensionRegistry {
  /**
   * Registered extensions
   */
  private extensions: Map<string, SchemaExtension> = new Map();
  
  /**
   * Registers an extension
   * @param extension Extension to register
   */
  registerExtension(extension: SchemaExtension): void {
    this.extensions.set(extension.id, extension);
  }
  
  /**
   * Gets an extension by ID
   * @param id Extension ID
   * @returns The extension, or undefined if not found
   */
  getExtension(id: string): SchemaExtension | undefined {
    return this.extensions.get(id);
  }
  
  /**
   * Gets all registered extensions
   * @returns All registered extensions
   */
  getAllExtensions(): SchemaExtension[] {
    return Array.from(this.extensions.values());
  }
  
  /**
   * Creates an extended schema with the specified extensions
   * @param extensionId ID of extension to apply
   * @returns Extended schema
   */
  createExtendedSchema(extensionId: string): any {
    const extension = this.extensions.get(extensionId);
    if (!extension) {
      throw new Error(`Extension not found: ${extensionId}`);
    }
    
    // Create a base schema
    let baseSchema = z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      version: z.string().optional(),
      boundedContexts: z.record(z.string(), z.any()).optional(),
      processes: z.record(z.string(), z.any()).optional(),
      tasks: z.record(z.string(), z.any()).optional(),
      triggers: z.record(z.string(), z.any()).optional()
    });
    
    // Apply refinements
    let extendedSchema = baseSchema;
    for (const refinement of extension.refinements) {
      extendedSchema = refinement(extendedSchema);
    }
    
    return extendedSchema;
  }
  
  /**
   * Validates a schema with the specified extensions
   * @param schema Schema to validate
   * @param extensionIds IDs of extensions to apply
   * @returns Validation result
   */
  validateWithExtensions(schema: any, ...extensionIds: string[]): ExtensionValidationResult {
    const issues: ExtensionValidationIssue[] = [];
    
    for (const extensionId of extensionIds) {
      const extension = this.extensions.get(extensionId);
      if (!extension) {
        issues.push({
          path: '',
          message: `Extension not found: ${extensionId}`,
          severity: 'error',
          extension: 'extension-registry'
        });
        continue;
      }
      
      // Apply validators
      for (const validator of extension.validators) {
        const validatorIssues = validator(schema);
        for (const issue of validatorIssues) {
          issues.push({
            ...issue,
            extension: extensionId
          });
        }
      }
    }
    
    return {
      success: !issues.some(issue => issue.severity === 'error'),
      issues
    };
  }
}

/**
 * Global extension registry instance
 */
export const extensionRegistry = new SchemaExtensionRegistry();

/**
 * Test extension for demonstration
 */
export const testExtension: SchemaExtension = {
  id: 'test',
  name: 'Test Extension',
  description: 'A test extension for demonstration purposes',
  version: '1.0.0',
  schemas: {
    TestEntity: z.object({
      id: z.string(),
      name: z.string(),
      value: z.number()
    })
  },
  refinements: [
    (schema) => {
      // Add test extension properties to the schema
      return z.object({
        ...(schema as any).shape,
        testExtension: z.object({
          enabled: z.boolean().optional(),
          entities: z.record(z.string(), z.any()).optional()
        }).optional()
      });
    }
  ],
  validators: [
    (schema) => {
      const issues: ExtensionValidationIssue[] = [];
      
      if (schema.testExtension && !schema.testExtension.enabled) {
        issues.push({
          path: 'testExtension.enabled',
          message: 'Test extension is disabled',
          severity: 'warning'
        });
      }
      
      return issues;
    }
  ]
};

// Register the test extension
extensionRegistry.registerExtension(testExtension); 