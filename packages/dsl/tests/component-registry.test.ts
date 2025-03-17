import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ComponentRegistry } from '../src/component-registry.js';
import { ComponentType, Component } from '../src/types.js';

describe('ComponentRegistry', () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = new ComponentRegistry();
  });

  describe('register', () => {
    it('should register a component', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Represents a customer order in the system',
        tags: ['order', 'commerce', 'core'],
        version: '1.0.0',
        authors: ['team-commerce'],
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique order identifier' }
          }
        },
        examples: [
          {
            id: 'order-123'
          }
        ]
      };

      // Act
      registry.register(component);

      // Assert
      expect(registry.getComponent('Order')).toEqual(component);
    });

    it('should throw an error when registering a component with a duplicate name', () => {
      // Arrange
      const component1: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        definition: { type: 'object' }
      };

      const component2: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Another order schema',
        definition: { type: 'object' }
      };

      // Act & Assert
      registry.register(component1);
      expect(() => registry.register(component2)).toThrow('Component with name Order already exists');
    });
  });

  describe('getComponent', () => {
    it('should return a component by name', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        definition: { type: 'object' }
      };
      registry.register(component);

      // Act
      const result = registry.getComponent('Order');

      // Assert
      expect(result).toEqual(component);
    });

    it('should return undefined for a non-existent component', () => {
      // Act
      const result = registry.getComponent('NonExistent');

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe('findComponents', () => {
    it('should find components by type', () => {
      // Arrange
      const schema1: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        definition: { type: 'object' }
      };

      const schema2: Component = {
        type: ComponentType.SCHEMA,
        name: 'Customer',
        description: 'Customer schema',
        definition: { type: 'object' }
      };

      const command: Component = {
        type: ComponentType.COMMAND,
        name: 'CreateOrder',
        description: 'Create order command',
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      };

      registry.register(schema1);
      registry.register(schema2);
      registry.register(command);

      // Act
      const schemas = registry.findComponents({ type: ComponentType.SCHEMA });
      const commands = registry.findComponents({ type: ComponentType.COMMAND });

      // Assert
      expect(schemas).toHaveLength(2);
      expect(schemas[0].name).toBe('Order');
      expect(schemas[1].name).toBe('Customer');
      expect(commands).toHaveLength(1);
      expect(commands[0].name).toBe('CreateOrder');
    });

    it('should find components by tags', () => {
      // Arrange
      const component1: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        tags: ['order', 'commerce'],
        definition: { type: 'object' }
      };

      const component2: Component = {
        type: ComponentType.SCHEMA,
        name: 'Product',
        description: 'Product schema',
        tags: ['product', 'commerce'],
        definition: { type: 'object' }
      };

      registry.register(component1);
      registry.register(component2);

      // Act
      const orderComponents = registry.findComponents({ tags: ['order'] });
      const commerceComponents = registry.findComponents({ tags: ['commerce'] });

      // Assert
      expect(orderComponents).toHaveLength(1);
      expect(orderComponents[0].name).toBe('Order');
      expect(commerceComponents).toHaveLength(2);
      expect(commerceComponents.map(c => c.name)).toContain('Order');
      expect(commerceComponents.map(c => c.name)).toContain('Product');
    });

    it('should find components by multiple criteria', () => {
      // Arrange
      const schema1: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        tags: ['order', 'commerce'],
        definition: { type: 'object' }
      };

      const schema2: Component = {
        type: ComponentType.SCHEMA,
        name: 'Product',
        description: 'Product schema',
        tags: ['product', 'commerce'],
        definition: { type: 'object' }
      };

      const command: Component = {
        type: ComponentType.COMMAND,
        name: 'CreateOrder',
        description: 'Create order command',
        tags: ['order', 'commerce'],
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      };

      registry.register(schema1);
      registry.register(schema2);
      registry.register(command);

      // Act
      const result = registry.findComponents({
        type: ComponentType.SCHEMA,
        tags: ['commerce']
      });

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map(c => c.name)).toContain('Order');
      expect(result.map(c => c.name)).toContain('Product');
    });
  });

  describe('serialize and deserialize', () => {
    it('should serialize and deserialize the registry', () => {
      // Arrange
      const component1: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        definition: { type: 'object' }
      };

      const component2: Component = {
        type: ComponentType.COMMAND,
        name: 'CreateOrder',
        description: 'Create order command',
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      };

      registry.register(component1);
      registry.register(component2);

      // Act
      const serialized = registry.serialize();
      const newRegistry = ComponentRegistry.deserialize(serialized);

      // Assert
      expect(newRegistry.getComponent('Order')).toEqual(component1);
      expect(newRegistry.getComponent('CreateOrder')).toEqual(component2);
    });
  });
}); 