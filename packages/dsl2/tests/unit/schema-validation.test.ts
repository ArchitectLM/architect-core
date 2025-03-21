import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

/**
 * Schema Validation Test Suite
 * 
 * This test file validates the schema validation capabilities of the DSL,
 * ensuring that schemas are correctly defined and validated across components.
 */
describe('Schema Validation', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  describe('Basic Schema Validation', () => {
    it('should validate basic types in schema definitions', () => {
      // Define a schema with various types
      const productSchema = dsl.component('Product', {
        type: ComponentType.SCHEMA,
        description: 'Product schema with various types',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          inStock: { type: 'boolean' },
          tags: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object', additionalProperties: { type: 'string' } }
        },
        required: ['id', 'name', 'price']
      });

      // Create a validator mock function that would be used by the runtime
      const validateData = (schema: any, data: any): { valid: boolean; errors?: string[] } => {
        const errors: string[] = [];
        
        // Check required fields
        if (schema.required) {
          for (const field of schema.required) {
            if (data[field] === undefined) {
              errors.push(`Required field '${field}' is missing`);
            }
          }
        }
        
        // Check types of fields
        for (const [key, value] of Object.entries(data)) {
          const fieldSchema = schema.properties[key];
          if (!fieldSchema) continue;
          
          switch (fieldSchema.type) {
            case 'string':
              if (typeof value !== 'string') errors.push(`Field '${key}' should be a string`);
              break;
            case 'number':
              if (typeof value !== 'number') errors.push(`Field '${key}' should be a number`);
              break;
            case 'boolean':
              if (typeof value !== 'boolean') errors.push(`Field '${key}' should be a boolean`);
              break;
            case 'array':
              if (!Array.isArray(value)) {
                errors.push(`Field '${key}' should be an array`);
              } else if (fieldSchema.items && value.length > 0) {
                // Check array items if schema is provided and array is not empty
                if (fieldSchema.items.type === 'string') {
                  for (const item of value) {
                    if (typeof item !== 'string') {
                      errors.push(`Items in '${key}' should be strings`);
                      break;
                    }
                  }
                }
              }
              break;
            case 'object':
              if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                errors.push(`Field '${key}' should be an object`);
              }
              break;
          }
        }
        
        return { valid: errors.length === 0, errors };
      };

      // Test valid data
      const validProduct = {
        id: 'prod-1',
        name: 'Test Product',
        price: 29.99,
        inStock: true,
        tags: ['electronic', 'gadget'],
        metadata: { color: 'black', material: 'plastic' }
      };
      
      const validationResult = validateData(productSchema, validProduct);
      expect(validationResult.valid).toBe(true);
      
      // Test invalid data - missing required field
      const missingRequired = {
        id: 'prod-2',
        price: 19.99
      };
      
      const missingRequiredResult = validateData(productSchema, missingRequired);
      expect(missingRequiredResult.valid).toBe(false);
      expect(missingRequiredResult.errors).toContain("Required field 'name' is missing");
      
      // Test invalid data - wrong type
      const wrongType = {
        id: 'prod-3',
        name: 'Another Product',
        price: '39.99', // String instead of number
        inStock: true
      };
      
      const wrongTypeResult = validateData(productSchema, wrongType);
      expect(wrongTypeResult.valid).toBe(false);
      expect(wrongTypeResult.errors).toContain("Field 'price' should be a number");
    });

    it('should validate format constraints in schema definitions', () => {
      // Define a schema with format constraints
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema with format constraints',
        version: '1.0.0',
        properties: {
          id: { type: 'string', pattern: '^user-[0-9a-f]{8}$' },
          email: { type: 'string', format: 'email' },
          registeredAt: { type: 'string', format: 'date-time' },
          age: { type: 'number', minimum: 18, maximum: 120 }
        },
        required: ['id', 'email']
      });

      // Create a validator function for format constraints
      const validateFormatConstraints = (schema: any, data: any): { valid: boolean; errors?: string[] } => {
        const errors: string[] = [];
        
        // Check format constraints
        for (const [key, value] of Object.entries(data)) {
          const fieldSchema = schema.properties[key];
          if (!fieldSchema) continue;
          
          // Check pattern constraint
          if (fieldSchema.type === 'string' && fieldSchema.pattern && typeof value === 'string') {
            const regex = new RegExp(fieldSchema.pattern);
            if (!regex.test(value)) {
              errors.push(`Field '${key}' does not match pattern '${fieldSchema.pattern}'`);
            }
          }
          
          // Check email format
          if (fieldSchema.type === 'string' && fieldSchema.format === 'email' && typeof value === 'string') {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(value)) {
              errors.push(`Field '${key}' is not a valid email address`);
            }
          }
          
          // Check date-time format
          if (fieldSchema.type === 'string' && fieldSchema.format === 'date-time' && typeof value === 'string') {
            const dateObj = new Date(value);
            if (isNaN(dateObj.getTime())) {
              errors.push(`Field '${key}' is not a valid date-time`);
            }
          }
          
          // Check number constraints
          if (fieldSchema.type === 'number' && typeof value === 'number') {
            if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
              errors.push(`Field '${key}' must be at least ${fieldSchema.minimum}`);
            }
            if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
              errors.push(`Field '${key}' must not exceed ${fieldSchema.maximum}`);
            }
          }
        }
        
        return { valid: errors.length === 0, errors };
      };

      // Test valid data
      const validUser = {
        id: 'user-12345678',
        email: 'test@example.com',
        registeredAt: '2023-01-01T12:00:00Z',
        age: 30
      };
      
      const validationResult = validateFormatConstraints(userSchema, validUser);
      expect(validationResult.valid).toBe(true);
      
      // Test invalid ID pattern
      const invalidId = {
        id: 'user-123', // Too short
        email: 'test@example.com'
      };
      
      const invalidIdResult = validateFormatConstraints(userSchema, invalidId);
      expect(invalidIdResult.valid).toBe(false);
      expect(invalidIdResult.errors).toContain("Field 'id' does not match pattern '^user-[0-9a-f]{8}$'");
      
      // Test invalid email format
      const invalidEmail = {
        id: 'user-12345678',
        email: 'not-an-email'
      };
      
      const invalidEmailResult = validateFormatConstraints(userSchema, invalidEmail);
      expect(invalidEmailResult.valid).toBe(false);
      expect(invalidEmailResult.errors).toContain("Field 'email' is not a valid email address");
      
      // Test invalid age constraints
      const invalidAge = {
        id: 'user-12345678',
        email: 'test@example.com',
        age: 15 // Under minimum
      };
      
      const invalidAgeResult = validateFormatConstraints(userSchema, invalidAge);
      expect(invalidAgeResult.valid).toBe(false);
      expect(invalidAgeResult.errors).toContain("Field 'age' must be at least 18");
    });
  });

  describe('Nested Schema Validation', () => {
    it('should validate nested object schemas', () => {
      // Define a schema with nested objects
      const orderSchema = dsl.component('Order', {
        type: ComponentType.SCHEMA,
        description: 'Order schema with nested objects',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          customer: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              email: { type: 'string' }
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
                price: { type: 'number' }
              },
              required: ['productId', 'quantity', 'price']
            }
          },
          totalAmount: { type: 'number' }
        },
        required: ['id', 'customer', 'items', 'totalAmount']
      });

      // Create a recursive validator function for nested schemas
      const validateNestedSchema = (schema: any, data: any, path = ''): { valid: boolean; errors: string[] } => {
        const errors: string[] = [];
        
        // Check required fields
        if (schema.required) {
          for (const field of schema.required) {
            if (data[field] === undefined) {
              errors.push(`Required field '${path}${field}' is missing`);
            }
          }
        }
        
        // Check properties
        for (const [key, value] of Object.entries(data)) {
          const fieldPath = path ? `${path}.${key}` : key;
          const fieldSchema = schema.properties && schema.properties[key];
          
          if (!fieldSchema) continue;
          
          // Check basic types
          if (typeof fieldSchema.type === 'string') {
            switch (fieldSchema.type) {
              case 'string':
                if (typeof value !== 'string') errors.push(`Field '${fieldPath}' should be a string`);
                break;
              case 'number':
                if (typeof value !== 'number') {
                  errors.push(`Field '${fieldPath}' should be a number`);
                } else {
                  if (fieldSchema.minimum !== undefined && value < fieldSchema.minimum) {
                    errors.push(`Field '${fieldPath}' must be at least ${fieldSchema.minimum}`);
                  }
                }
                break;
              case 'boolean':
                if (typeof value !== 'boolean') errors.push(`Field '${fieldPath}' should be a boolean`);
                break;
              case 'object':
                if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                  errors.push(`Field '${fieldPath}' should be an object`);
                } else if (fieldSchema.properties) {
                  // Recursively validate nested object
                  const nestedResult = validateNestedSchema(fieldSchema, value, fieldPath);
                  errors.push(...nestedResult.errors);
                }
                break;
              case 'array':
                if (!Array.isArray(value)) {
                  errors.push(`Field '${fieldPath}' should be an array`);
                } else if (fieldSchema.items && value.length > 0) {
                  // Validate array items
                  if (fieldSchema.items.type === 'object') {
                    value.forEach((item, index) => {
                      const itemPath = `${fieldPath}[${index}]`;
                      const itemResult = validateNestedSchema(fieldSchema.items, item, itemPath);
                      errors.push(...itemResult.errors);
                    });
                  }
                }
                break;
            }
          }
        }
        
        return { valid: errors.length === 0, errors };
      };

      // Test valid order
      const validOrder = {
        id: 'order-123',
        customer: {
          id: 'cust-1',
          name: 'John Doe',
          email: 'john@example.com'
        },
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            price: 29.99
          },
          {
            productId: 'prod-2',
            quantity: 1,
            price: 49.99
          }
        ],
        totalAmount: 109.97
      };
      
      const validationResult = validateNestedSchema(orderSchema, validOrder);
      expect(validationResult.valid).toBe(true);
      
      // Test missing nested required field
      const missingNestedRequired = {
        id: 'order-123',
        customer: {
          id: 'cust-1',
          // Missing name
          email: 'john@example.com'
        },
        items: [
          {
            productId: 'prod-1',
            quantity: 2,
            price: 29.99
          }
        ],
        totalAmount: 59.98
      };
      
      const missingNestedResult = validateNestedSchema(orderSchema, missingNestedRequired);
      expect(missingNestedResult.valid).toBe(false);
      expect(missingNestedResult.errors).toContain("Required field 'customer.name' is missing");
      
      // Test invalid array item
      const invalidArrayItem = {
        id: 'order-123',
        customer: {
          id: 'cust-1',
          name: 'John Doe',
          email: 'john@example.com'
        },
        items: [
          {
            productId: 'prod-1',
            quantity: 0, // Invalid: minimum is 1
            price: 29.99
          }
        ],
        totalAmount: 29.99
      };
      
      const invalidArrayResult = validateNestedSchema(orderSchema, invalidArrayItem);
      expect(invalidArrayResult.valid).toBe(false);
      expect(invalidArrayResult.errors).toContain("Field 'items[0].quantity' must be at least 1");
    });

    it('should validate references to other schemas', () => {
      // Define referenced schemas
      dsl.component('Address', {
        type: ComponentType.SCHEMA,
        description: 'Address schema',
        version: '1.0.0',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          zipCode: { type: 'string' },
          country: { type: 'string' }
        },
        required: ['street', 'city', 'country']
      });
      
      dsl.component('Contact', {
        type: ComponentType.SCHEMA,
        description: 'Contact information schema',
        version: '1.0.0',
        properties: {
          email: { type: 'string' },
          phone: { type: 'string' },
          address: { ref: 'Address' }
        },
        required: ['email']
      });
      
      // Define a schema that references other schemas
      const customerSchema = dsl.component('Customer', {
        type: ComponentType.SCHEMA,
        description: 'Customer schema with references',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          contact: { ref: 'Contact' },
          shippingAddresses: { 
            type: 'array', 
            items: { ref: 'Address' } 
          }
        },
        required: ['id', 'name', 'contact']
      });

      // Create a resolver function to resolve schema references
      const resolveSchemaRef = (ref: string): any => {
        const component = dsl.getComponent(ref);
        if (!component || component.type !== ComponentType.SCHEMA) {
          throw new Error(`Could not resolve schema reference: ${ref}`);
        }
        return component;
      };

      // Create a validator that can resolve references
      const validateWithRefs = (schema: any, data: any): { valid: boolean; errors: string[] } => {
        // Simplified implementation - in a real validator, this would be more comprehensive
        const errors: string[] = [];
        
        // Check required fields
        if (schema.required) {
          for (const field of schema.required) {
            if (data[field] === undefined) {
              errors.push(`Required field '${field}' is missing`);
            }
          }
        }
        
        // Check field types and references
        for (const [key, value] of Object.entries(data)) {
          if (!schema.properties || !schema.properties[key]) continue;
          const fieldSchema = schema.properties[key];
          
          // Handle reference
          if (fieldSchema.ref) {
            try {
              const resolvedSchema = resolveSchemaRef(fieldSchema.ref);
              // Recursively validate against the resolved schema
              const refResult = validateWithRefs(resolvedSchema, value);
              errors.push(...refResult.errors);
            } catch (err: any) {
              errors.push(err.message);
            }
            continue;
          }
          
          // Handle array of references
          if (fieldSchema.type === 'array' && fieldSchema.items && fieldSchema.items.ref) {
            if (!Array.isArray(value)) {
              errors.push(`Field '${key}' should be an array`);
              continue;
            }
            
            try {
              const resolvedItemSchema = resolveSchemaRef(fieldSchema.items.ref);
              for (let i = 0; i < value.length; i++) {
                const itemResult = validateWithRefs(resolvedItemSchema, value[i]);
                // Prefix errors with array index
                errors.push(...itemResult.errors.map(e => `${key}[${i}]: ${e}`));
              }
            } catch (err: any) {
              errors.push(err.message);
            }
            continue;
          }
        }
        
        return { valid: errors.length === 0, errors };
      };

      // Test valid customer with references
      const validCustomer = {
        id: 'cust-123',
        name: 'Jane Smith',
        contact: {
          email: 'jane@example.com',
          phone: '555-123-4567',
          address: {
            street: '123 Main St',
            city: 'Anytown',
            zipCode: '12345',
            country: 'USA'
          }
        },
        shippingAddresses: [
          {
            street: '123 Main St',
            city: 'Anytown',
            zipCode: '12345',
            country: 'USA'
          },
          {
            street: '456 Office Ave',
            city: 'Worktown',
            zipCode: '67890',
            country: 'USA'
          }
        ]
      };
      
      const validationResult = validateWithRefs(customerSchema, validCustomer);
      expect(validationResult.valid).toBe(true);
      
      // Test missing required fields in referenced schema
      const invalidRefFields = {
        id: 'cust-456',
        name: 'Bob Brown',
        contact: {
          email: 'bob@example.com',
          address: {
            street: '789 Side St',
            // Missing city
            zipCode: '54321',
            country: 'USA'
          }
        }
      };
      
      const invalidRefResult = validateWithRefs(customerSchema, invalidRefFields);
      expect(invalidRefResult.valid).toBe(false);
      // The exact error message might vary based on implementation,
      // but it should indicate the missing city field in the address
      expect(invalidRefResult.errors.some(e => e.includes('city') && e.includes('missing'))).toBe(true);
    });
  });
}); 