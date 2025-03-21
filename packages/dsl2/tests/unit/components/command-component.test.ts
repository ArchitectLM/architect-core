import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

describe('Command Component', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  it('should define a command component with input/output schemas', () => {
    const command = dsl.component('CreateUser', {
      type: ComponentType.COMMAND,
      description: 'Create a new user',
      version: '1.0.0',
      input: { ref: 'CreateUserInput' },
      output: { ref: 'User' },
      produces: [{ event: 'UserCreated', description: 'Event emitted when user is created' }]
    });

    expect(command).toBeDefined();
    expect(command.id).toBe('CreateUser');
    expect(command.type).toBe(ComponentType.COMMAND);
    expect(command.input).toEqual({ ref: 'CreateUserInput' });
    expect(command.output).toEqual({ ref: 'User' });
    expect(command.produces).toHaveLength(1);
    expect(command.produces[0].event).toBe('UserCreated');
  });

  it('should implement a command with business logic', async () => {
    // First define the command
    dsl.component('CreateProduct', {
      type: ComponentType.COMMAND,
      description: 'Create a new product',
      version: '1.0.0',
      input: { ref: 'CreateProductInput' },
      output: { ref: 'Product' }
    });

    // Then implement it
    const implementation = async (input: any, context: any) => {
      return {
        id: 'prod-123',
        name: input.name,
        price: input.price,
        createdAt: new Date().toISOString()
      };
    };

    const impl = dsl.implement('CreateProduct', implementation);
    
    expect(impl).toBeDefined();
    expect(typeof impl).toBe('function');
    
    // Test the implementation
    const result = await implementation({ name: 'Test Product', price: 29.99 }, {});
    expect(result.id).toBe('prod-123');
    expect(result.name).toBe('Test Product');
    expect(result.price).toBe(29.99);
  });

  it('should support command validation through input schema', () => {
    // Define input schema for validation
    dsl.component('OrderInput', {
      type: ComponentType.SCHEMA,
      description: 'Order input schema',
      version: '1.0.0',
      properties: {
        customerId: { type: 'string' },
        items: { 
          type: 'array', 
          items: { 
            type: 'object',
            properties: {
              productId: { type: 'string' },
              quantity: { type: 'number', minimum: 1 }
            },
            required: ['productId', 'quantity']
          }
        },
        shippingAddress: { type: 'object' }
      },
      required: ['customerId', 'items']
    });
    
    // Define the command with the input schema
    const createOrder = dsl.component('CreateOrder', {
      type: ComponentType.COMMAND,
      description: 'Create a new order',
      version: '1.0.0',
      input: { ref: 'OrderInput' },
      output: { ref: 'Order' },
      validation: {
        enabled: true,
        mode: 'strict'
      }
    });
    
    expect(createOrder).toBeDefined();
    expect(createOrder.input).toEqual({ ref: 'OrderInput' });
    expect(createOrder.validation).toBeDefined();
    expect(createOrder.validation?.enabled).toBe(true);
    expect(createOrder.validation?.mode).toBe('strict');
  });

  it('should throw an error when implementing an undefined command', () => {
    const implementation = async (input: any, context: any) => {
      return { success: true };
    };

    expect(() => dsl.implement('NonExistentCommand', implementation))
      .toThrow(/component not found/i);
  });
}); 