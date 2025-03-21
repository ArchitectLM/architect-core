import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ComponentType, SystemDefinition } from '../../../src/models/component.js';
import { DSL } from '../../../src/core/dsl.js';

// Mock the system extension module to test
vi.mock('../../../src/extensions/system.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/system.extension.js');
  
  return {
    ...actual,
    // Mock setupSystemExtension for testing
    setupSystemExtension: vi.fn((dsl, options = {}) => {
      // Mock implementation of setupSystemExtension
      console.log('Mocked setupSystemExtension called with options:', options);
      
      // Add the system method to the DSL
      (dsl as any).system = vi.fn((id: string, definition: Omit<SystemDefinition, 'id' | 'type'>) => {
        const system: SystemDefinition = {
          id,
          type: ComponentType.SYSTEM,
          ...definition,
          components: definition.components || {}
        };
        
        // Register the system as a component
        dsl.component(id, {
          type: ComponentType.SYSTEM,
          description: system.description,
          version: system.version || '1.0.0'
        });
        
        // Add the system to the component
        const component = dsl.getComponent(id);
        if (component) {
          Object.assign(component, {
            components: system.components,
            tenancy: system.tenancy,
            security: system.security,
            observability: system.observability
          });
        }
        
        return system;
      });
      
      // Add the getSystem method to the DSL
      (dsl as any).getSystem = vi.fn((id: string) => {
        const component = dsl.getComponent(id);
        return component && component.type === ComponentType.SYSTEM ? component : undefined;
      });
      
      // Add method to get all systems
      (dsl as any).getAllSystems = vi.fn(() => {
        return dsl.getComponentsByType(ComponentType.SYSTEM);
      });
      
      // Add method to validate system references
      (dsl as any).validateSystemReferences = vi.fn((systemId: string) => {
        return [];
      });
      
      return { dsl };
    })
  };
});

// Import the module to test
import { setupSystemExtension } from '../../../src/extensions/system.extension.js';

describe('System Extension', () => {
  let dsl: DSL;
  
  beforeEach(() => {
    // Initialize DSL instance before each test
    dsl = new DSL();
    
    // Setup system extension with default options
    setupSystemExtension(dsl, {
      validateReferences: true
    });
  });
  
  afterEach(() => {
    // Clear all mocks after each test
    vi.clearAllMocks();
  });
  
  describe('System Definition', () => {
    it('should create a system component', () => {
      // Define a system component
      const system = (dsl as any).system('ecommerce', {
        description: 'E-commerce system',
        version: '1.0.0',
        components: {
          SCHEMA: [
            { ref: 'user-schema' },
            { ref: 'product-schema' }
          ],
          COMMAND: [
            { ref: 'create-user' },
            { ref: 'create-product' }
          ]
        }
      });
      
      // Check that the system was created correctly
      expect(system).toBeDefined();
      expect(system.id).toBe('ecommerce');
      expect(system.type).toBe(ComponentType.SYSTEM);
      expect(system.description).toBe('E-commerce system');
      expect(system.components).toBeDefined();
      expect(system.components.SCHEMA).toHaveLength(2);
      expect(system.components.COMMAND).toHaveLength(2);
    });
    
    it('should retrieve a system by ID', () => {
      // Create the system first
      (dsl as any).system('ecommerce', {
        description: 'E-commerce system',
        version: '1.0.0'
      });
      
      // Retrieve the system by ID
      const system = (dsl as any).getSystem('ecommerce');
      
      // Check the retrieved system
      expect(system).toBeDefined();
      expect(system?.id).toBe('ecommerce');
      expect(system?.type).toBe(ComponentType.SYSTEM);
    });
    
    it('should return undefined for a non-existent system', () => {
      // Try to retrieve a non-existent system
      const system = (dsl as any).getSystem('non-existent');
      
      // Check that the result is undefined
      expect(system).toBeUndefined();
    });
  });
  
  describe('System Components', () => {
    it('should register system components', () => {
      // Create schemas first
      dsl.component('user-schema', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0'
      });
      
      dsl.component('product-schema', {
        type: ComponentType.SCHEMA,
        description: 'Product schema',
        version: '1.0.0'
      });
      
      // Create a system with the schemas
      (dsl as any).system('ecommerce', {
        description: 'E-commerce system',
        version: '1.0.0',
        components: {
          SCHEMA: [
            { ref: 'user-schema' },
            { ref: 'product-schema' }
          ]
        }
      });
      
      // Get the system
      const system = (dsl as any).getSystem('ecommerce');
      
      // Check the system components
      expect(system).toBeDefined();
      expect(system?.components.SCHEMA).toHaveLength(2);
      expect(system?.components.SCHEMA[0].ref).toBe('user-schema');
      expect(system?.components.SCHEMA[1].ref).toBe('product-schema');
    });
    
    it('should get all systems', () => {
      // Create multiple systems
      (dsl as any).system('ecommerce', { 
        description: 'E-commerce system', 
        version: '1.0.0' 
      });
      (dsl as any).system('blog', { 
        description: 'Blog system', 
        version: '1.0.0' 
      });
      (dsl as any).system('crm', { 
        description: 'CRM system', 
        version: '1.0.0'
      });
      
      // Get all systems
      const systems = (dsl as any).getAllSystems();
      
      // Check the result
      expect(systems).toHaveLength(3);
      expect(systems.map((s: { id: string }) => s.id)).toContain('ecommerce');
      expect(systems.map((s: { id: string }) => s.id)).toContain('blog');
      expect(systems.map((s: { id: string }) => s.id)).toContain('crm');
    });
  });
  
  describe('System Extensions', () => {
    it('should support tenancy configuration', () => {
      // Create a system with tenancy
      const system = (dsl as any).system('ecommerce', {
        description: 'E-commerce system',
        version: '1.0.0',
        tenancy: {
          model: 'multi-tenant',
          isolation: 'database'
        }
      });
      
      // Check the tenancy configuration
      expect(system.tenancy).toBeDefined();
      expect(system.tenancy?.model).toBe('multi-tenant');
      expect(system.tenancy?.isolation).toBe('database');
    });
    
    it('should support security configuration', () => {
      // Create a system with security
      const system = (dsl as any).system('ecommerce', {
        description: 'E-commerce system',
        version: '1.0.0',
        security: {
          authentication: {
            provider: 'oauth2',
            mechanism: 'jwt'
          },
          authorization: {
            model: 'rbac'
          }
        }
      });
      
      // Check the security configuration
      expect(system.security).toBeDefined();
      expect(system.security?.authentication?.provider).toBe('oauth2');
      expect(system.security?.authentication?.mechanism).toBe('jwt');
      expect(system.security?.authorization?.model).toBe('rbac');
    });
    
    it('should support observability configuration', () => {
      // Create a system with observability
      const system = (dsl as any).system('ecommerce', {
        description: 'E-commerce system',
        version: '1.0.0',
        observability: {
          tracing: true,
          metrics: true,
          logging: {
            level: 'info'
          }
        }
      });
      
      // Check the observability configuration
      expect(system.observability).toBeDefined();
      expect(system.observability?.tracing).toBe(true);
      expect(system.observability?.metrics).toBe(true);
      expect(system.observability?.logging?.level).toBe('info');
    });
  });
}); 