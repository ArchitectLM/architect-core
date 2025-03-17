import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SystemLoader } from '../src/system-loader.js';
import { ComponentRegistry } from '../src/component-registry.js';
import { ComponentType, Component, SystemDefinition } from '../src/types.js';

describe('SystemLoader', () => {
  let registry: ComponentRegistry;
  let loader: SystemLoader;

  beforeEach(() => {
    registry = new ComponentRegistry();
    loader = new SystemLoader(registry);
  });

  describe('loadSystem', () => {
    it('should load a system definition', () => {
      // Arrange
      const orderSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        definition: { type: 'object' }
      };

      const createOrderCommand: Component = {
        type: ComponentType.COMMAND,
        name: 'CreateOrder',
        description: 'Create order command',
        input: { ref: 'OrderInput' },
        output: { ref: 'Order' }
      };

      const systemDef: SystemDefinition = {
        name: 'OrderSystem',
        description: 'Order processing system',
        components: {
          schemas: [{ ref: 'Order', required: true }],
          commands: [{ ref: 'CreateOrder', required: true }]
        }
      };

      registry.register(orderSchema);
      registry.register(createOrderCommand);

      // Act
      const system = loader.loadSystem(systemDef);

      // Assert
      expect(system).toBeDefined();
      expect(system.name).toBe('OrderSystem');
      expect(system.components.schemas).toHaveLength(1);
      expect(system.components.commands).toHaveLength(1);
      expect(system.loadedComponents.get('Order')).toEqual(orderSchema);
      expect(system.loadedComponents.get('CreateOrder')).toEqual(createOrderCommand);
    });

    it('should throw an error if a required component is missing', () => {
      // Arrange
      const systemDef: SystemDefinition = {
        name: 'OrderSystem',
        description: 'Order processing system',
        components: {
          schemas: [{ ref: 'Order', required: true }],
          commands: [{ ref: 'CreateOrder', required: true }]
        }
      };

      // Act & Assert
      expect(() => loader.loadSystem(systemDef)).toThrow('Required component Order not found');
    });

    it('should not throw an error if an optional component is missing', () => {
      // Arrange
      const orderSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        definition: { type: 'object' }
      };

      const systemDef: SystemDefinition = {
        name: 'OrderSystem',
        description: 'Order processing system',
        components: {
          schemas: [{ ref: 'Order', required: true }],
          commands: [{ ref: 'CreateOrder', required: false }]
        }
      };

      registry.register(orderSchema);

      // Act
      const system = loader.loadSystem(systemDef);

      // Assert
      expect(system).toBeDefined();
      expect(system.components.schemas).toHaveLength(1);
      expect(system.components.commands).toHaveLength(1);
      expect(system.loadedComponents.get('Order')).toEqual(orderSchema);
      expect(system.loadedComponents.get('CreateOrder')).toBeUndefined();
    });
  });

  describe('getComponent', () => {
    it('should get a component by name', async () => {
      // Arrange
      const orderSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        definition: { type: 'object' }
      };

      registry.register(orderSchema);

      // Act
      const component = await loader.getComponent('Order');

      // Assert
      expect(component).toEqual(orderSchema);
    });

    it('should throw an error if the component is not found', async () => {
      // Act & Assert
      await expect(loader.getComponent('NonExistent')).rejects.toThrow('Component NonExistent not found');
    });
  });

  describe('loadComponentFromPath', () => {
    it('should load a component from a file path', async () => {
      // Act
      const component = await loader.loadComponentFromPath('./tests/fixtures/Order.js');

      // Assert
      expect(component).toBeDefined();
      expect(component.name).toBe('Order');
    });

    it('should register the loaded component in the registry', async () => {
      // Act
      await loader.loadComponentFromPath('./tests/fixtures/Order.js');

      // Assert
      expect(registry.getComponent('Order')).toBeDefined();
    });

    it('should throw an error if the component file does not export a default component', async () => {
      // Act & Assert
      await expect(loader.loadComponentFromPath('./tests/fixtures/EmptyModule.js')).rejects.toThrow(
        'Component file ./tests/fixtures/EmptyModule.js does not export a default component'
      );
    });
  });

  describe('detectCircularDependencies', () => {
    it('should detect circular dependencies between components', () => {
      // Arrange
      const orderSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        relatedComponents: [{ ref: 'Customer', relationship: 'references' }],
        definition: { type: 'object' }
      };

      const customerSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Customer',
        description: 'Customer schema',
        relatedComponents: [{ ref: 'Order', relationship: 'references' }],
        definition: { type: 'object' }
      };

      registry.register(orderSchema);
      registry.register(customerSchema);

      // Act
      const circularDeps = loader.detectCircularDependencies('Order');

      // Assert
      expect(circularDeps).toHaveLength(1);
      expect(circularDeps[0]).toEqual(['Order', 'Customer', 'Order']);
    });

    it('should handle multiple circular dependencies', () => {
      // Arrange
      const orderSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        relatedComponents: [
          { ref: 'Customer', relationship: 'references' },
          { ref: 'Product', relationship: 'references' }
        ],
        definition: { type: 'object' }
      };

      const customerSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Customer',
        description: 'Customer schema',
        relatedComponents: [{ ref: 'Order', relationship: 'references' }],
        definition: { type: 'object' }
      };

      const productSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Product',
        description: 'Product schema',
        relatedComponents: [{ ref: 'Order', relationship: 'references' }],
        definition: { type: 'object' }
      };

      registry.register(orderSchema);
      registry.register(customerSchema);
      registry.register(productSchema);

      // Act
      const circularDeps = loader.detectCircularDependencies('Order');

      // Assert
      expect(circularDeps).toHaveLength(2);
      expect(circularDeps).toContainEqual(['Order', 'Customer', 'Order']);
      expect(circularDeps).toContainEqual(['Order', 'Product', 'Order']);
    });

    it('should return an empty array if no circular dependencies are found', () => {
      // Arrange
      const orderSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Order',
        description: 'Order schema',
        relatedComponents: [{ ref: 'Customer', relationship: 'references' }],
        definition: { type: 'object' }
      };

      const customerSchema: Component = {
        type: ComponentType.SCHEMA,
        name: 'Customer',
        description: 'Customer schema',
        definition: { type: 'object' }
      };

      registry.register(orderSchema);
      registry.register(customerSchema);

      // Act
      const circularDeps = loader.detectCircularDependencies('Order');

      // Assert
      expect(circularDeps).toHaveLength(0);
    });
  });
}); 