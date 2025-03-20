/**
 * Schema Extension Implementation Tests
 * 
 * These tests verify the actual implementation of the schema extension
 * with real validation, compilation, and utility functions.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';
import { 
  setupSchemaExtension, 
  SchemaExtensionOptions,
  schemaExtension
} from '../../src/extensions/schema.extension.js';

describe('Schema Extension Implementation', () => {
  let dsl: DSL;
  let options: SchemaExtensionOptions;

  beforeEach(() => {
    // Create a fresh DSL instance
    dsl = new DSL();
    
    // Define extension options
    options = {
      strictMode: true,
      additionalProperties: false,
      autoCompileEnabled: true,
      exampleFormat: 'json'
    };
    
    // Initialize the extension
    setupSchemaExtension(dsl, options);
  });

  afterEach(() => {
    // Clean up
  });

  describe('Schema Validation', () => {
    it('should validate simple values correctly', () => {
      // Create a schema for testing
      const personSchema = dsl.component('TestPerson', {
        type: ComponentType.SCHEMA,
        description: 'Test person schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          age: { type: 'number', minimum: 18 }
        },
        required: ['name', 'age']
      });
      
      // Valid data
      const valid = {
        name: 'John Doe',
        age: 25
      };
      
      // Invalid - missing required field
      const invalid1 = {
        name: 'Jane Doe'
      };
      
      // Invalid - wrong type
      const invalid2 = {
        name: 'Bob Smith',
        age: '30' // should be number
      };
      
      // Invalid - below minimum
      const invalid3 = {
        name: 'Young Person',
        age: 15
      };
      
      // Run validation
      const validResult = (personSchema as any).validate(valid);
      const invalidResult1 = (personSchema as any).validate(invalid1);
      const invalidResult2 = (personSchema as any).validate(invalid2);
      const invalidResult3 = (personSchema as any).validate(invalid3);
      
      // Check results
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      expect(invalidResult1.valid).toBe(false);
      expect(invalidResult1.errors).toContainEqual(expect.stringContaining('age'));
      
      expect(invalidResult2.valid).toBe(false);
      expect(invalidResult2.errors).toContainEqual(expect.stringContaining('number'));
      
      expect(invalidResult3.valid).toBe(false);
      expect(invalidResult3.errors).toContainEqual(expect.stringContaining('minimum'));
    });
    
    it('should handle nested object validation', () => {
      // Create a schema with nested objects
      const orderSchema = dsl.component('TestOrder', {
        type: ComponentType.SCHEMA,
        description: 'Test order schema',
        version: '1.0.0',
        properties: {
          orderId: { type: 'string' },
          customer: { 
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            },
            required: ['id']
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'number', minimum: 1 }
              },
              required: ['productId', 'quantity']
            },
            minItems: 1
          }
        },
        required: ['orderId', 'customer', 'items']
      });
      
      // Valid data
      const valid = {
        orderId: 'ORD-123',
        customer: {
          id: 'CUST-456',
          name: 'John Doe'
        },
        items: [
          { productId: 'PROD-789', quantity: 2 }
        ]
      };
      
      // Invalid - missing nested required field
      const invalid1 = {
        orderId: 'ORD-123',
        customer: {
          name: 'John Doe'  // missing id
        },
        items: [
          { productId: 'PROD-789', quantity: 2 }
        ]
      };
      
      // Invalid - empty array
      const invalid2 = {
        orderId: 'ORD-123',
        customer: {
          id: 'CUST-456',
          name: 'John Doe'
        },
        items: []  // should have at least one item
      };
      
      // Run validation
      const validResult = (orderSchema as any).validate(valid);
      const invalidResult1 = (orderSchema as any).validate(invalid1);
      const invalidResult2 = (orderSchema as any).validate(invalid2);
      
      // Check results
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      expect(invalidResult1.valid).toBe(false);
      expect(invalidResult1.errors).toContainEqual(expect.stringContaining('customer.id'));
      
      expect(invalidResult2.valid).toBe(false);
      expect(invalidResult2.errors).toContainEqual(expect.stringContaining('items'));
    });
    
    it('should respect strictMode option', () => {
      // Create a schema
      const userSchema = dsl.component('TestUser', {
        type: ComponentType.SCHEMA,
        description: 'Test user schema',
        version: '1.0.0',
        properties: {
          username: { type: 'string' },
          email: { type: 'string' }
        },
        required: ['username']
      });
      
      // Data with extra fields
      const dataWithExtra = {
        username: 'johndoe',
        email: 'john@example.com',
        extraField: 'should not be allowed in strict mode'
      };
      
      // Test with strict mode (default from our options)
      const strictResult = (userSchema as any).validate(dataWithExtra);
      
      // Test with strict mode off for this specific validation
      const nonStrictResult = (userSchema as any).validate(dataWithExtra, { strict: false });
      
      // Check results
      expect(strictResult.valid).toBe(false);
      expect(strictResult.errors).toContainEqual(expect.stringContaining('extraField'));
      
      expect(nonStrictResult.valid).toBe(true);
      expect(nonStrictResult.errors).toHaveLength(0);
    });
  });

  describe('Schema Utilities', () => {
    it('should generate example data matching the schema', () => {
      // Create a schema with various types
      const productSchema = dsl.component('TestProduct', {
        type: ComponentType.SCHEMA,
        description: 'Test product schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number', minimum: 0 },
          inStock: { type: 'boolean' },
          tags: { 
            type: 'array', 
            items: { type: 'string' } 
          },
          dimensions: {
            type: 'object',
            properties: {
              width: { type: 'number' },
              height: { type: 'number' },
              depth: { type: 'number' }
            }
          }
        },
        required: ['id', 'name', 'price']
      });
      
      // Generate an example
      const example = (productSchema as any).generateExample();
      
      // Verify the example matches the schema structure
      expect(example).toBeDefined();
      expect(typeof example.id).toBe('string');
      expect(typeof example.name).toBe('string');
      expect(typeof example.price).toBe('number');
      expect(example.price).toBeGreaterThanOrEqual(0);
      
      if (example.inStock !== undefined) {
        expect(typeof example.inStock).toBe('boolean');
      }
      
      if (example.tags !== undefined) {
        expect(Array.isArray(example.tags)).toBe(true);
        if (example.tags.length > 0) {
          expect(typeof example.tags[0]).toBe('string');
        }
      }
      
      if (example.dimensions !== undefined) {
        expect(typeof example.dimensions).toBe('object');
        if (example.dimensions.width !== undefined) {
          expect(typeof example.dimensions.width).toBe('number');
        }
      }
      
      // Verify the example passes validation
      const validationResult = (productSchema as any).validate(example);
      expect(validationResult.valid).toBe(true);
    });
    
    it('should convert schemas to TypeScript', () => {
      // Create a schema
      const addressSchema = dsl.component('TestAddress', {
        type: ComponentType.SCHEMA,
        description: 'Test address schema',
        version: '1.0.0',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          zipCode: { type: 'string' },
          country: { type: 'string' }
        },
        required: ['street', 'city', 'country']
      });
      
      // Convert to TypeScript
      const tsInterface = (addressSchema as any).toTypeScript();
      
      // Check the result
      expect(tsInterface).toContain('interface TestAddress');
      expect(tsInterface).toContain('street: string');
      expect(tsInterface).toContain('city: string');
      expect(tsInterface).toContain('zipCode: string');
      expect(tsInterface).toContain('country: string');
    });
    
    it('should convert schemas to JSON Schema', () => {
      // Create a schema
      const contactSchema = dsl.component('TestContact', {
        type: ComponentType.SCHEMA,
        description: 'Test contact schema',
        version: '1.0.0',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' }
        },
        required: ['name', 'email']
      });
      
      // Convert to JSON Schema
      const jsonSchema = (contactSchema as any).getJsonSchema();
      
      // Check the result
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toBeDefined();
      expect(jsonSchema.properties.name).toBeDefined();
      expect(jsonSchema.properties.email).toBeDefined();
      expect(jsonSchema.properties.phone).toBeDefined();
      expect(jsonSchema.required).toContain('name');
      expect(jsonSchema.required).toContain('email');
      expect(jsonSchema.additionalProperties).toBe(false); // from our options
    });
  });

  describe('Extension Registration', () => {
    it('should register the schema extension via factory function', () => {
      // New DSL instance
      const newDsl = new DSL();
      
      // Create the extension
      const extension = schemaExtension({
        strictMode: false,
        additionalProperties: true
      });
      
      // Register it
      newDsl.registerExtension(extension);
      
      // Create a schema
      const testSchema = newDsl.component('RegisteredSchema', {
        type: ComponentType.SCHEMA,
        description: 'Schema created after extension registration',
        version: '1.0.0',
        properties: {
          field1: { type: 'string' },
          field2: { type: 'number' }
        }
      });
      
      // Check extension methods were properly added
      expect(typeof (testSchema as any).validate).toBe('function');
      expect(typeof (testSchema as any).getJsonSchema).toBe('function');
      expect(typeof (testSchema as any).toTypeScript).toBe('function');
      expect(typeof (testSchema as any).generateExample).toBe('function');
    });
  });
}); 