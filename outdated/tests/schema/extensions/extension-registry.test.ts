/**
 * Tests for the Schema Extension Registry
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { SchemaExtensionRegistry, SchemaExtension } from '../../../src/schema/extensions/extension-registry';

describe('Schema Extension Registry', () => {
  let registry: SchemaExtensionRegistry;
  
  // Sample extension for testing
  const testExtension: SchemaExtension = {
    id: 'test-extension',
    name: 'Test Extension',
    description: 'A test extension',
    version: '1.0.0',
    schemas: {
      TestEntity: z.object({
        id: z.string(),
        name: z.string(),
        value: z.number()
      })
    },
    refinements: [
      (schema: any) => {
        // Create a new schema that includes the test extension
        return z.object({
          ...schema.shape, // Include all properties from the original schema
          testExtension: z.object({
            entities: z.record(z.string(), z.lazy(() => testExtension.schemas.TestEntity))
          }).optional()
        });
      }
    ],
    validators: [
      (system) => {
        const results: Array<{
          path: string;
          message: string;
          severity: 'error' | 'warning';
        }> = [];
        
        // Skip validation if extension is not used
        if (!system.testExtension) {
          return results;
        }
        
        // Add a sample validation
        if (system.testExtension.entities && Object.keys(system.testExtension.entities).length === 0) {
          results.push({
            path: 'testExtension.entities',
            message: 'No test entities defined',
            severity: 'warning'
          });
        }
        
        return results;
      }
    ]
  };
  
  beforeEach(() => {
    registry = new SchemaExtensionRegistry();
  });
  
  describe('Extension Registration and Retrieval', () => {
    it('should register and retrieve extensions', () => {
      // Register the extension
      registry.registerExtension(testExtension);
      
      // Retrieve the extension
      const retrievedExtension = registry.getExtension('test-extension');
      
      // Verify extension properties
      expect(retrievedExtension).toBeDefined();
      expect(retrievedExtension?.id).toBe('test-extension');
      expect(retrievedExtension?.name).toBe('Test Extension');
      expect(retrievedExtension?.version).toBe('1.0.0');
    });
    
    it('should return undefined for non-existent extensions', () => {
      const nonExistentExtension = registry.getExtension('non-existent');
      expect(nonExistentExtension).toBeUndefined();
    });
    
    it('should get all registered extensions', () => {
      // Register multiple extensions
      registry.registerExtension(testExtension);
      registry.registerExtension({
        ...testExtension,
        id: 'another-extension',
        name: 'Another Extension'
      });
      
      // Get all extensions
      const allExtensions = registry.getAllExtensions();
      
      // Verify extensions
      expect(allExtensions.length).toBe(2);
      expect(allExtensions.map(ext => ext.id)).toContain('test-extension');
      expect(allExtensions.map(ext => ext.id)).toContain('another-extension');
    });
  });
  
  describe('Schema Extension', () => {
    it('should create an extended schema', () => {
      // Register the extension
      registry.registerExtension(testExtension);
      
      // Create an extended schema
      const extendedSchema = registry.createExtendedSchema('test-extension');
      
      // Verify the schema
      expect(extendedSchema).toBeDefined();
      
      // Test validation with the extended schema
      const validSystem = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        description: 'A test system',
        boundedContexts: {},
        processes: {},
        tasks: {},
        testExtension: {
          entities: {
            'entity-1': {
              id: 'entity-1',
              name: 'Test Entity',
              value: 42
            }
          }
        }
      };
      
      const parseResult = extendedSchema.safeParse(validSystem);
      expect(parseResult.success).toBe(true);
    });
    
    it('should throw an error for non-existent extensions', () => {
      expect(() => {
        registry.createExtendedSchema('non-existent');
      }).toThrow('Extension not found: non-existent');
    });
  });
  
  describe('Validation with Extensions', () => {
    it('should validate a system with extensions', () => {
      // Register the extension
      registry.registerExtension(testExtension);
      
      // Valid system
      const validSystem = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        testExtension: {
          entities: {
            'entity-1': {
              id: 'entity-1',
              name: 'Test Entity',
              value: 42
            }
          }
        }
      };
      
      // Validate the system
      const validationResult = registry.validateWithExtensions(validSystem, 'test-extension');
      
      // Verify validation result
      expect(validationResult.success).toBe(true);
      expect(validationResult.issues.length).toBe(0);
    });
    
    it('should report validation issues', () => {
      // Register the extension
      registry.registerExtension(testExtension);
      
      // System with issues
      const systemWithIssues = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0',
        testExtension: {
          entities: {} // Empty entities should trigger a warning
        }
      };
      
      // Validate the system
      const validationResult = registry.validateWithExtensions(systemWithIssues, 'test-extension');
      
      // Verify validation result
      expect(validationResult.success).toBe(true); // Warnings don't affect success
      expect(validationResult.issues.length).toBe(1);
      expect(validationResult.issues[0].path).toBe('testExtension.entities');
      expect(validationResult.issues[0].severity).toBe('warning');
      expect(validationResult.issues[0].extension).toBe('test-extension');
    });
    
    it('should handle multiple extensions', () => {
      // Register multiple extensions
      registry.registerExtension(testExtension);
      registry.registerExtension({
        ...testExtension,
        id: 'another-extension',
        name: 'Another Extension',
        validators: [
          (system) => {
            return [{
              path: 'system',
              message: 'Test validation from another extension',
              severity: 'warning'
            }];
          }
        ]
      });
      
      // System to validate
      const system = {
        id: 'test-system',
        name: 'Test System',
        version: '1.0.0'
      };
      
      // Validate with multiple extensions
      const validationResult = registry.validateWithExtensions(
        system,
        'test-extension',
        'another-extension'
      );
      
      // Verify validation result
      expect(validationResult.success).toBe(true);
      expect(validationResult.issues.length).toBe(1);
      expect(validationResult.issues[0].extension).toBe('another-extension');
    });
  });
}); 