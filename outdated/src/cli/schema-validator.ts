/**
 * Schema Validator
 * 
 * Validates schema files against the core schema and any extensions.
 */

import { SchemaFiles } from './schema-loader';
import { ReactiveSystemSchema } from '../schema/validation';
import { extensionRegistry, ExtensionValidationResult } from '../schema/extensions';

/**
 * Validation issue
 */
export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
  source?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  success: boolean;
  issues: ValidationIssue[];
}

/**
 * Validates schema files against the core schema and any extensions
 * @param schemaFiles Schema files to validate
 * @returns Validation result
 */
export function validateSchema(schemaFiles: SchemaFiles): ValidationResult {
  const issues: ValidationIssue[] = [];
  
  // Validate each schema file
  for (const [filename, schema] of Object.entries(schemaFiles)) {
    try {
      // Determine if this is a system schema or a component schema
      if (isSystemSchema(schema)) {
        validateSystemSchema(schema, filename, issues);
      } else if (isProcessSchema(schema)) {
        validateProcessSchema(schema, filename, issues);
      } else if (isTaskSchema(schema)) {
        validateTaskSchema(schema, filename, issues);
      } else {
        // Unknown schema type
        issues.push({
          path: filename,
          message: 'Unknown schema type. Expected a system, process, or task schema.',
          severity: 'error',
          source: 'schema-validator'
        });
      }
    } catch (error) {
      // Add validation error
      issues.push({
        path: filename,
        message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
        source: 'schema-validator'
      });
    }
  }
  
  // Check for cross-file references
  const crossFileIssues = validateCrossFileReferences(schemaFiles);
  issues.push(...crossFileIssues);
  
  return {
    success: !issues.some(issue => issue.severity === 'error'),
    issues
  };
}

/**
 * Determines if a schema is a system schema
 * @param schema Schema to check
 * @returns True if the schema is a system schema
 */
function isSystemSchema(schema: any): boolean {
  return schema && 
         typeof schema === 'object' && 
         schema.id && 
         schema.name && 
         schema.version && 
         (schema.boundedContexts || schema.processes || schema.tasks);
}

/**
 * Determines if a schema is a process schema
 * @param schema Schema to check
 * @returns True if the schema is a process schema
 */
function isProcessSchema(schema: any): boolean {
  return schema && 
         typeof schema === 'object' && 
         schema.id && 
         schema.name && 
         schema.type && 
         (schema.tasks || schema.states);
}

/**
 * Determines if a schema is a task schema
 * @param schema Schema to check
 * @returns True if the schema is a task schema
 */
function isTaskSchema(schema: any): boolean {
  return schema && 
         typeof schema === 'object' && 
         schema.id && 
         schema.type && 
         (schema.input !== undefined || schema.output !== undefined);
}

/**
 * Validates a system schema
 * @param schema System schema to validate
 * @param filename Filename of the schema
 * @param issues Array to add validation issues to
 */
function validateSystemSchema(schema: any, filename: string, issues: ValidationIssue[]): void {
  try {
    // Validate against the core schema
    const parseResult = ReactiveSystemSchema.safeParse(schema);
    
    if (!parseResult.success) {
      // Add Zod validation errors
      const zodErrors = parseResult.error.errors;
      for (const error of zodErrors) {
        issues.push({
          path: `${filename}:${error.path.join('.')}`,
          message: error.message,
          severity: 'error',
          source: 'zod'
        });
      }
      return;
    }
    
    // Validate with extensions
    const extensions = getApplicableExtensions(schema);
    if (extensions.length > 0) {
      const extensionResult = extensionRegistry.validateWithExtensions(schema, ...extensions);
      addExtensionIssues(extensionResult, filename, issues);
    }
    
    // Additional custom validations
    validateSystemIntegrity(schema, filename, issues);
  } catch (error) {
    issues.push({
      path: filename,
      message: `System validation error: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'error',
      source: 'schema-validator'
    });
  }
}

/**
 * Validates a process schema
 * @param schema Process schema to validate
 * @param filename Filename of the schema
 * @param issues Array to add validation issues to
 */
function validateProcessSchema(schema: any, filename: string, issues: ValidationIssue[]): void {
  // Mock implementation - in a real system, we would validate against a process schema
  if (!schema.id) {
    issues.push({
      path: `${filename}:id`,
      message: 'Process must have an ID',
      severity: 'error',
      source: 'schema-validator'
    });
  }
  
  if (!schema.name) {
    issues.push({
      path: `${filename}:name`,
      message: 'Process must have a name',
      severity: 'error',
      source: 'schema-validator'
    });
  }
  
  if (!schema.type) {
    issues.push({
      path: `${filename}:type`,
      message: 'Process must have a type',
      severity: 'error',
      source: 'schema-validator'
    });
  }
  
  // Validate stateful processes
  if (schema.type === 'stateful') {
    if (!schema.states || !Array.isArray(schema.states) || schema.states.length === 0) {
      issues.push({
        path: `${filename}:states`,
        message: 'Stateful process must have at least one state',
        severity: 'error',
        source: 'schema-validator'
      });
    }
    
    if (!schema.transitions || !Array.isArray(schema.transitions)) {
      issues.push({
        path: `${filename}:transitions`,
        message: 'Stateful process must have transitions',
        severity: 'error',
        source: 'schema-validator'
      });
    } else {
      // Validate transitions
      for (let i = 0; i < schema.transitions.length; i++) {
        const transition = schema.transitions[i];
        if (!transition.from) {
          issues.push({
            path: `${filename}:transitions[${i}].from`,
            message: 'Transition must have a from state',
            severity: 'error',
            source: 'schema-validator'
          });
        }
        
        if (!transition.to) {
          issues.push({
            path: `${filename}:transitions[${i}].to`,
            message: 'Transition must have a to state',
            severity: 'error',
            source: 'schema-validator'
          });
        }
        
        if (transition.from && transition.to && schema.states) {
          if (!schema.states.includes(transition.from)) {
            issues.push({
              path: `${filename}:transitions[${i}].from`,
              message: `From state '${transition.from}' is not defined in states`,
              severity: 'error',
              source: 'schema-validator'
            });
          }
          
          if (!schema.states.includes(transition.to)) {
            issues.push({
              path: `${filename}:transitions[${i}].to`,
              message: `To state '${transition.to}' is not defined in states`,
              severity: 'error',
              source: 'schema-validator'
            });
          }
        }
      }
    }
  }
}

/**
 * Validates a task schema
 * @param schema Task schema to validate
 * @param filename Filename of the schema
 * @param issues Array to add validation issues to
 */
function validateTaskSchema(schema: any, filename: string, issues: ValidationIssue[]): void {
  // Mock implementation - in a real system, we would validate against a task schema
  if (!schema.id) {
    issues.push({
      path: `${filename}:id`,
      message: 'Task must have an ID',
      severity: 'error',
      source: 'schema-validator'
    });
  }
  
  if (!schema.type) {
    issues.push({
      path: `${filename}:type`,
      message: 'Task must have a type',
      severity: 'error',
      source: 'schema-validator'
    });
  }
}

/**
 * Validates cross-file references in the schema files
 * @param schemaFiles Schema files to validate
 * @returns Validation issues
 */
function validateCrossFileReferences(schemaFiles: SchemaFiles): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Find system schema
  const systemSchema = Object.values(schemaFiles).find(schema => isSystemSchema(schema));
  
  if (!systemSchema) {
    issues.push({
      path: 'schema',
      message: 'No system schema found',
      severity: 'error',
      source: 'schema-validator'
    });
    return issues;
  }
  
  // For now, we'll just check that a system schema exists
  // In a real implementation, we would validate cross-file references
  // between processes, tasks, and other schema elements
  
  return issues;
}

/**
 * Validates the integrity of a system schema
 * @param schema System schema to validate
 * @param filename Filename of the schema
 * @param issues Array to add validation issues to
 */
function validateSystemIntegrity(schema: any, filename: string, issues: ValidationIssue[]): void {
  // This is a simplified implementation to avoid linter errors
  // In a real implementation, we would validate the integrity of the system schema
  
  // Check if the system has a name and version
  if (!schema.name) {
    issues.push({
      path: `${filename}:name`,
      message: 'System must have a name',
      severity: 'error',
      source: 'schema-validator'
    });
  }
  
  if (!schema.version) {
    issues.push({
      path: `${filename}:version`,
      message: 'System must have a version',
      severity: 'error',
      source: 'schema-validator'
    });
  }
}

/**
 * Gets applicable extensions for a schema
 * @param schema Schema to get extensions for
 * @returns Array of extension IDs
 */
function getApplicableExtensions(schema: any): string[] {
  const extensions: string[] = [];
  
  // Check for e-commerce extension
  if (schema.ecommerce) {
    extensions.push('e-commerce');
  }
  
  // Add more extension detection logic here
  
  return extensions;
}

/**
 * Adds extension validation issues to the issues array
 * @param extensionResult Extension validation result
 * @param filename Filename of the schema
 * @param issues Array to add validation issues to
 */
function addExtensionIssues(extensionResult: ExtensionValidationResult, filename: string, issues: ValidationIssue[]): void {
  for (const issue of extensionResult.issues) {
    issues.push({
      path: `${filename}:${issue.path}`,
      message: issue.message,
      severity: issue.severity,
      source: `extension:${issue.extension}`
    });
  }
} 