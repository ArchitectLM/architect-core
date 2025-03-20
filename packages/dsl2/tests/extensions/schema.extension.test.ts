import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the schema extension module
vi.mock('../../src/extensions/schema.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/schema.extension.js');
  return {
    ...actual,
    setupSchemaExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupSchemaExtension, 
  SchemaExtensionOptions
} from '../../src/extensions/schema.extension.js';

describe('Schema Extension', () => {
  let dsl: DSL;
  let schemaOptions: SchemaExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    schemaOptions = {
      autoCompile: true,
      strictMode: true,
      additionalProperties: false
    };
    
    // Setup extension
    setupSchemaExtension(dsl, schemaOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Schema Definition', () => {
    it('should enhance schema components with validation functionality', () => {
      // Define a schema component
      const userSchema = dsl.component('UserSchema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 2 },
          age: { type: 'number', minimum: 18 }
        },
        required: ['id', 'email', 'name']
      });
      
      // Extension should add validate method to the schema
      expect(typeof (userSchema as any).validate).toBe('function');
      
      // Extension should add getJsonSchema method
      expect(typeof (userSchema as any).getJsonSchema).toBe('function');
      
      // Should generate proper JSON Schema
      const jsonSchema = (userSchema as any).getJsonSchema();
      expect(jsonSchema).toMatchObject({
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string', minLength: 2 },
          age: { type: 'number', minimum: 18 }
        },
        required: ['id', 'email', 'name'],
        additionalProperties: false // from options
      });
    });
    
    it('should support advanced schema features like nested objects and arrays', () => {
      // Define a schema with nested objects and arrays
      const orderSchema = dsl.component('OrderSchema', {
        type: ComponentType.SCHEMA,
        description: 'Order schema with nested structures',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          customer: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string', format: 'email' }
            },
            required: ['id', 'name']
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'number', minimum: 1 },
                price: { type: 'number', minimum: 0 }
              },
              required: ['productId', 'quantity', 'price']
            },
            minItems: 1
          },
          total: { type: 'number' },
          status: { 
            type: 'string', 
            enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] 
          },
          createdAt: { type: 'string', format: 'date-time' }
        },
        required: ['id', 'customer', 'items', 'total', 'status']
      });
      
      // Get the JSON schema
      const jsonSchema = (orderSchema as any).getJsonSchema();
      
      // Verify basic structure
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.required).toContain('id');
      expect(jsonSchema.required).toContain('customer');
      expect(jsonSchema.required).toContain('items');
      
      // Verify nested object structure
      expect(jsonSchema.properties.customer.type).toBe('object');
      expect(jsonSchema.properties.customer.required).toContain('id');
      
      // Verify array structure
      expect(jsonSchema.properties.items.type).toBe('array');
      expect(jsonSchema.properties.items.minItems).toBe(1);
      expect(jsonSchema.properties.items.items.type).toBe('object');
      expect(jsonSchema.properties.items.items.required).toContain('productId');
    });
    
    it('should support schema inheritance and composition', () => {
      // Define base schema
      const personBaseSchema = dsl.component('PersonBase', {
        type: ComponentType.SCHEMA,
        description: 'Base schema for people',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' }
        },
        required: ['id', 'name']
      });
      
      // Define schema that extends the base schema
      const employeeSchema = dsl.component('Employee', {
        type: ComponentType.SCHEMA,
        description: 'Employee schema',
        version: '1.0.0',
        extends: 'PersonBase', // Inheritance
        properties: {
          department: { type: 'string' },
          position: { type: 'string' },
          salary: { type: 'number', minimum: 0 }
        },
        required: ['department', 'position']
      });
      
      // Get the JSON schema
      const jsonSchema = (employeeSchema as any).getJsonSchema();
      
      // Verify inheritance worked
      expect(jsonSchema.properties).toHaveProperty('id');
      expect(jsonSchema.properties).toHaveProperty('name');
      expect(jsonSchema.properties).toHaveProperty('email');
      expect(jsonSchema.properties).toHaveProperty('department');
      expect(jsonSchema.properties).toHaveProperty('position');
      expect(jsonSchema.properties).toHaveProperty('salary');
      
      // Verify required fields merged correctly
      expect(jsonSchema.required).toContain('id');
      expect(jsonSchema.required).toContain('name');
      expect(jsonSchema.required).toContain('department');
      expect(jsonSchema.required).toContain('position');
    });
  });

  describe('Schema Validation', () => {
    it('should validate data against schema definitions', () => {
      // Define a schema
      const productSchema = dsl.component('ProductSchema', {
        type: ComponentType.SCHEMA,
        description: 'Product schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', minLength: 3 },
          price: { type: 'number', minimum: 0 },
          category: { type: 'string' },
          tags: { 
            type: 'array', 
            items: { type: 'string' } 
          },
          inStock: { type: 'boolean' }
        },
        required: ['id', 'name', 'price']
      });
      
      // Valid product data
      const validProduct = {
        id: 'prod-123',
        name: 'Laptop',
        price: 999.99,
        category: 'Electronics',
        tags: ['computer', 'work'],
        inStock: true
      };
      
      // Invalid product data (missing required fields)
      const invalidProduct1 = {
        id: 'prod-124',
        price: 59.99
        // Missing required name field
      };
      
      // Invalid product data (wrong type)
      const invalidProduct2 = {
        id: 'prod-125',
        name: 'TV',
        price: 'expensive' // Should be a number
      };
      
      // Invalid product data (constraint violation)
      const invalidProduct3 = {
        id: 'prod-126',
        name: 'PC',
        price: -50 // Negative price not allowed
      };
      
      // Perform validations
      const validResult = (productSchema as any).validate(validProduct);
      const invalidResult1 = (productSchema as any).validate(invalidProduct1);
      const invalidResult2 = (productSchema as any).validate(invalidProduct2);
      const invalidResult3 = (productSchema as any).validate(invalidProduct3);
      
      // Check validation results
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);
      
      expect(invalidResult1.valid).toBe(false);
      expect(invalidResult1.errors).toContainEqual(expect.stringMatching(/name.*required/i));
      
      expect(invalidResult2.valid).toBe(false);
      expect(invalidResult2.errors).toContainEqual(expect.stringMatching(/price.*number/i));
      
      expect(invalidResult3.valid).toBe(false);
      expect(invalidResult3.errors).toContainEqual(expect.stringMatching(/price.*minimum/i));
    });
    
    it('should support validation with strict and non-strict modes', () => {
      // Define a schema
      const userProfileSchema = dsl.component('UserProfileSchema', {
        type: ComponentType.SCHEMA,
        description: 'User profile schema',
        version: '1.0.0',
        properties: {
          username: { type: 'string' },
          bio: { type: 'string', maxLength: 500 }
        },
        required: ['username']
      });
      
      // Data with additional properties
      const dataWithExtraFields = {
        username: 'johndoe',
        bio: 'Software developer',
        age: 30, // Extra field not in schema
        location: 'New York' // Extra field not in schema
      };
      
      // In strict mode (additionalProperties: false), this should fail
      const strictValidation = (userProfileSchema as any).validate(dataWithExtraFields, { 
        strict: true 
      });
      
      expect(strictValidation.valid).toBe(false);
      expect(strictValidation.errors).toContainEqual(
        expect.stringMatching(/additional properties/i)
      );
      
      // In non-strict mode, this should pass
      const nonStrictValidation = (userProfileSchema as any).validate(dataWithExtraFields, { 
        strict: false 
      });
      
      expect(nonStrictValidation.valid).toBe(true);
      expect(nonStrictValidation.errors).toHaveLength(0);
    });
    
    it('should validate data with complex nested structures', () => {
      // Define a schema with nested objects and arrays
      const orderSchema = dsl.component('ComplexOrderSchema', {
        type: ComponentType.SCHEMA,
        description: 'Order schema with nested structures',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          customer: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            },
            required: ['id', 'name']
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
        required: ['id', 'customer', 'items']
      });
      
      // Valid complex data
      const validOrder = {
        id: 'order-123',
        customer: {
          id: 'cust-456',
          name: 'John Doe'
        },
        items: [
          { productId: 'prod-789', quantity: 2 },
          { productId: 'prod-012', quantity: 1 }
        ]
      };
      
      // Invalid - missing customer name
      const invalidOrder1 = {
        id: 'order-123',
        customer: {
          id: 'cust-456'
          // Missing name
        },
        items: [
          { productId: 'prod-789', quantity: 2 }
        ]
      };
      
      // Invalid - empty items array
      const invalidOrder2 = {
        id: 'order-123',
        customer: {
          id: 'cust-456',
          name: 'John Doe'
        },
        items: [] // Empty array violates minItems: 1
      };
      
      // Invalid - negative quantity
      const invalidOrder3 = {
        id: 'order-123',
        customer: {
          id: 'cust-456',
          name: 'John Doe'
        },
        items: [
          { productId: 'prod-789', quantity: 0 } // Minimum is 1
        ]
      };
      
      // Perform validations
      const validResult = (orderSchema as any).validate(validOrder);
      const invalidResult1 = (orderSchema as any).validate(invalidOrder1);
      const invalidResult2 = (orderSchema as any).validate(invalidOrder2);
      const invalidResult3 = (orderSchema as any).validate(invalidOrder3);
      
      // Check validation results
      expect(validResult.valid).toBe(true);
      
      expect(invalidResult1.valid).toBe(false);
      expect(invalidResult1.errors).toContainEqual(
        expect.stringMatching(/customer.*name.*required/i)
      );
      
      expect(invalidResult2.valid).toBe(false);
      expect(invalidResult2.errors).toContainEqual(
        expect.stringMatching(/items.*minItems/i)
      );
      
      expect(invalidResult3.valid).toBe(false);
      expect(invalidResult3.errors).toContainEqual(
        expect.stringMatching(/items\[0\].*quantity.*minimum/i)
      );
    });
  });

  describe('Schema Compilation', () => {
    it('should automatically compile schemas when autoCompile is enabled', () => {
      // Mock the extension's compile method
      const compileMock = vi.fn();
      
      // Add the mock to our schema extension
      (dsl as any).extensions = {
        schema: {
          compileSchema: compileMock
        }
      };
      
      // Define a schema with autoCompile enabled in our options
      dsl.component('AutoCompiledSchema', {
        type: ComponentType.SCHEMA,
        description: 'Schema that should be auto-compiled',
        version: '1.0.0',
        properties: {
          name: { type: 'string' }
        }
      });
      
      // Verify compile was called
      expect(compileMock).toHaveBeenCalled();
    });
    
    it('should improve validation performance with compiled schemas', () => {
      // Define a schema component
      const largeSchema = dsl.component('LargeSchema', {
        type: ComponentType.SCHEMA,
        description: 'A large schema to test compilation performance',
        version: '1.0.0',
        properties: {
          // Create a large schema to make the difference noticeable
          field1: { type: 'string' },
          field2: { type: 'number' },
          field3: { type: 'boolean' },
          // ...more fields
          field20: { 
            type: 'object',
            properties: {
              nestedField1: { type: 'string' },
              nestedField2: { type: 'number' }
            }
          }
        }
      });
      
      // Data to validate
      const testData = { field1: 'test', field2: 123 };
      
      // Measure time for uncompiled validation
      (largeSchema as any).compiled = false;
      
      const startUncompiled = performance.now();
      for (let i = 0; i < 100; i++) {
        (largeSchema as any).validate(testData);
      }
      const endUncompiled = performance.now();
      const uncompiledTime = endUncompiled - startUncompiled;
      
      // Compile the schema
      (largeSchema as any).compile();
      (largeSchema as any).compiled = true;
      
      // Measure time for compiled validation
      const startCompiled = performance.now();
      for (let i = 0; i < 100; i++) {
        (largeSchema as any).validate(testData);
      }
      const endCompiled = performance.now();
      const compiledTime = endCompiled - startCompiled;
      
      // Verify compiled schema validates faster (or at least not slower)
      // Note: This is a bit flaky as a test, might need to be adjusted
      expect(compiledTime).toBeLessThanOrEqual(uncompiledTime * 1.1); // Allow 10% margin
    });
  });

  describe('Schema Utilities', () => {
    it('should provide methods to generate example data from schema', () => {
      // Define a schema
      const exampleSchema = dsl.component('ExampleSchema', {
        type: ComponentType.SCHEMA,
        description: 'Schema for generating examples',
        version: '1.0.0',
        properties: {
          id: { type: 'string', pattern: '^EX-[0-9]{4}$' },
          name: { type: 'string', minLength: 5, maxLength: 20 },
          age: { type: 'number', minimum: 18, maximum: 65 },
          email: { type: 'string', format: 'email' },
          tags: { 
            type: 'array', 
            items: { type: 'string' },
            minItems: 1,
            maxItems: 5
          },
          status: { 
            type: 'string', 
            enum: ['active', 'pending', 'inactive'] 
          }
        },
        required: ['id', 'name', 'email', 'status']
      });
      
      // Generate example data
      const example = (exampleSchema as any).generateExample();
      
      // Verify example matches schema
      expect(example).toBeDefined();
      expect(typeof example.id).toBe('string');
      expect(example.id).toMatch(/^EX-\d{4}$/);
      expect(typeof example.name).toBe('string');
      expect(example.name.length).toBeGreaterThanOrEqual(5);
      expect(example.name.length).toBeLessThanOrEqual(20);
      
      if (example.age !== undefined) {
        expect(typeof example.age).toBe('number');
        expect(example.age).toBeGreaterThanOrEqual(18);
        expect(example.age).toBeLessThanOrEqual(65);
      }
      
      expect(typeof example.email).toBe('string');
      // Should look like an email
      expect(example.email).toMatch(/@/);
      
      if (example.tags !== undefined) {
        expect(Array.isArray(example.tags)).toBe(true);
        expect(example.tags.length).toBeGreaterThanOrEqual(1);
        expect(example.tags.length).toBeLessThanOrEqual(5);
      }
      
      expect(['active', 'pending', 'inactive']).toContain(example.status);
      
      // Validate the example against the schema
      const validationResult = (exampleSchema as any).validate(example);
      expect(validationResult.valid).toBe(true);
    });
    
    it('should support generation of multiple examples', () => {
      // Define a schema
      const multiExampleSchema = dsl.component('MultiExampleSchema', {
        type: ComponentType.SCHEMA,
        description: 'Schema for generating multiple examples',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          value: { type: 'number' }
        },
        required: ['id', 'value']
      });
      
      // Generate multiple examples
      const examples = (multiExampleSchema as any).generateExamples(3);
      
      // Verify we got the right number
      expect(examples).toHaveLength(3);
      
      // Verify each example is valid
      examples.forEach(example => {
        expect(example.id).toBeDefined();
        expect(typeof example.id).toBe('string');
        expect(example.value).toBeDefined();
        expect(typeof example.value).toBe('number');
        
        const validationResult = (multiExampleSchema as any).validate(example);
        expect(validationResult.valid).toBe(true);
      });
      
      // Verify examples are different from each other
      const ids = examples.map(e => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3); // All IDs should be unique
    });
    
    it('should provide methods to convert between formats', () => {
      // Define a schema
      const conversionSchema = dsl.component('ConversionSchema', {
        type: ComponentType.SCHEMA,
        description: 'Schema for testing format conversions',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          age: { type: 'number' }
        }
      });
      
      // Get various formats
      const jsonSchema = (conversionSchema as any).toJsonSchema();
      const typeScript = (conversionSchema as any).toTypeScript();
      const openApi = (conversionSchema as any).toOpenApi();
      
      // Verify JSON Schema format
      expect(jsonSchema).toHaveProperty('type', 'object');
      expect(jsonSchema.properties).toHaveProperty('id');
      expect(jsonSchema.properties).toHaveProperty('name');
      expect(jsonSchema.properties).toHaveProperty('age');
      
      // Verify TypeScript interface
      expect(typeof typeScript).toBe('string');
      expect(typeScript).toContain('interface ConversionSchema');
      expect(typeScript).toContain('id: string');
      expect(typeScript).toContain('name: string');
      expect(typeScript).toContain('age: number');
      
      // Verify OpenAPI format
      expect(openApi).toHaveProperty('type', 'object');
      expect(openApi.properties).toHaveProperty('id');
      expect(openApi.properties.id).toHaveProperty('type', 'string');
    });
  });

  describe('System Integration', () => {
    it('should make schemas available to systems', () => {
      // Define some schemas
      dsl.component('Schema1', {
        type: ComponentType.SCHEMA,
        description: 'Schema 1',
        version: '1.0.0',
        properties: {
          field1: { type: 'string' }
        }
      });
      
      dsl.component('Schema2', {
        type: ComponentType.SCHEMA,
        description: 'Schema 2',
        version: '1.0.0',
        properties: {
          field2: { type: 'number' }
        }
      });
      
      // Define a system that uses these schemas
      const system = dsl.system('TestSystem', {
        description: 'Test system',
        version: '1.0.0',
        components: {
          schemas: [
            { ref: 'Schema1' },
            { ref: 'Schema2' }
          ]
        }
      });
      
      // Extension should add methods to access schemas
      expect(typeof (system as any).getSchemas).toBe('function');
      expect(typeof (system as any).validateAgainstSchema).toBe('function');
      
      // Get schemas from the system
      const schemas = (system as any).getSchemas();
      expect(schemas).toHaveLength(2);
      expect(schemas[0].id).toBe('Schema1');
      expect(schemas[1].id).toBe('Schema2');
      
      // Should be able to validate data against a system schema
      const validationResult = (system as any).validateAgainstSchema('Schema1', { field1: 'test' });
      expect(validationResult.valid).toBe(true);
    });
  });
}); 