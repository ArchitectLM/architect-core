import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryVectorDBAdapter } from '../src/memory-vector-db-adapter.js';
import { Component, ComponentType, ComponentImplementation } from '../src/types.js';

describe('MemoryVectorDBAdapter', () => {
  let adapter: MemoryVectorDBAdapter;
  
  // Sample components for testing
  const userComponent: Component = {
    type: ComponentType.SCHEMA,
    name: 'User',
    description: 'User schema',
    definition: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' }
      }
    }
  };
  
  const productComponent: Component = {
    type: ComponentType.SCHEMA,
    name: 'Product',
    description: 'Product schema',
    definition: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        price: { type: 'number' }
      }
    }
  };
  
  const createUserComponent: Component = {
    type: ComponentType.COMMAND,
    name: 'CreateUser',
    description: 'Create a new user',
    input: { ref: 'User' },
    output: { ref: 'User' },
    definition: {}
  };
  
  // Sample implementation for testing
  const createUserImplementation: ComponentImplementation = {
    componentName: 'CreateUser',
    implementation: (input: any) => ({ ...input, id: '123' }),
    metadata: {
      complexity: 'low',
      estimatedLatency: 'low'
    }
  };
  
  beforeEach(() => {
    // Create a fresh adapter for each test
    adapter = new MemoryVectorDBAdapter({
      name: 'test-db'
    });
  });
  
  describe('constructor', () => {
    it('should initialize with empty collections when no initial data is provided', () => {
      const emptyAdapter = new MemoryVectorDBAdapter({
        name: 'empty-db'
      });
      
      return Promise.all([
        emptyAdapter.getAllComponents().then(components => {
          expect(components).toHaveLength(0);
        }),
        emptyAdapter.getAllImplementations().then(implementations => {
          expect(implementations).toHaveLength(0);
        })
      ]);
    });
    
    it('should initialize with provided components and implementations', () => {
      const preloadedAdapter = new MemoryVectorDBAdapter({
        name: 'preloaded-db',
        initialComponents: [userComponent, productComponent],
        initialImplementations: [createUserImplementation]
      });
      
      return Promise.all([
        preloadedAdapter.getAllComponents().then(components => {
          expect(components).toHaveLength(2);
          expect(components.find(c => c.name === 'User')).toBeDefined();
          expect(components.find(c => c.name === 'Product')).toBeDefined();
        }),
        preloadedAdapter.getAllImplementations().then(implementations => {
          expect(implementations).toHaveLength(1);
          expect(implementations[0].componentName).toBe('CreateUser');
        })
      ]);
    });
  });
  
  describe('storeComponent', () => {
    it('should store a component and return its ID', async () => {
      const id = await adapter.storeComponent(userComponent);
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      
      const components = await adapter.getAllComponents();
      expect(components).toHaveLength(1);
      expect(components[0].name).toBe('User');
    });
    
    it('should overwrite an existing component with the same name', async () => {
      await adapter.storeComponent(userComponent);
      
      // Modify the component and store it again
      const updatedUser = {
        ...userComponent,
        description: 'Updated user schema'
      };
      
      await adapter.storeComponent(updatedUser);
      
      const components = await adapter.getAllComponents();
      expect(components).toHaveLength(1);
      expect(components[0].description).toBe('Updated user schema');
    });
  });
  
  describe('storeImplementation', () => {
    it('should store an implementation and return its ID', async () => {
      const id = await adapter.storeImplementation(createUserImplementation);
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      
      const implementations = await adapter.getAllImplementations();
      expect(implementations).toHaveLength(1);
      expect(implementations[0].componentName).toBe('CreateUser');
    });
    
    it('should overwrite an existing implementation for the same component', async () => {
      await adapter.storeImplementation(createUserImplementation);
      
      // Modify the implementation and store it again
      const updatedImplementation = {
        ...createUserImplementation,
        metadata: {
          ...createUserImplementation.metadata,
          complexity: 'medium'
        }
      };
      
      await adapter.storeImplementation(updatedImplementation);
      
      const implementations = await adapter.getAllImplementations();
      expect(implementations).toHaveLength(1);
      expect(implementations[0].metadata?.complexity).toBe('medium');
    });
  });
  
  describe('storeRelationship', () => {
    it('should store a relationship between components', async () => {
      // Store the components first
      const userId = await adapter.storeComponent(userComponent);
      const createUserId = await adapter.storeComponent(createUserComponent);
      
      // Store the relationship using the component IDs
      await adapter.storeRelationship(userId, createUserId, 'isUsedBy', 'User is used by CreateUser');
      
      // Get related components
      const relatedToUser = await adapter.getRelatedComponents(userComponent.name);
      
      expect(relatedToUser).toHaveLength(1);
      expect(relatedToUser[0].name).toBe('CreateUser');
    });
    
    it('should filter relationships by type', async () => {
      // Store the components
      const userId = await adapter.storeComponent(userComponent);
      const productId = await adapter.storeComponent(productComponent);
      const createUserId = await adapter.storeComponent(createUserComponent);
      
      // Store relationships using the component IDs
      await adapter.storeRelationship(userId, createUserId, 'isUsedBy');
      await adapter.storeRelationship(userId, productId, 'relatesTo');
      
      // Get related components filtered by relationship type
      const usedByComponents = await adapter.getRelatedComponents(userComponent.name, 'isUsedBy');
      
      expect(usedByComponents).toHaveLength(1);
      expect(usedByComponents[0].name).toBe('CreateUser');
    });
  });
  
  describe('searchComponents', () => {
    beforeEach(async () => {
      // Store some components for searching
      await adapter.storeComponent(userComponent);
      await adapter.storeComponent(productComponent);
      await adapter.storeComponent(createUserComponent);
    });
    
    it('should search components by name', async () => {
      const results = await adapter.searchComponents('User');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(c => c.name === 'User')).toBe(true);
    });
    
    it('should search components by description', async () => {
      const results = await adapter.searchComponents('Product schema');
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some(c => c.name === 'Product')).toBe(true);
    });
    
    it('should filter search results by component type', async () => {
      const results = await adapter.searchComponents('User', { type: ComponentType.SCHEMA });
      
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.every(c => c.type === ComponentType.SCHEMA)).toBe(true);
      expect(results.some(c => c.name === 'User')).toBe(true);
      expect(results.every(c => c.name !== 'CreateUser')).toBe(true);
    });
    
    it('should return empty array when no matches are found', async () => {
      const results = await adapter.searchComponents('NonExistentComponent');
      
      expect(results).toHaveLength(0);
    });
  });
  
  describe('getRelatedComponents', () => {
    beforeEach(async () => {
      // Store components
      const userId = await adapter.storeComponent(userComponent);
      const productId = await adapter.storeComponent(productComponent);
      const createUserId = await adapter.storeComponent(createUserComponent);
      
      // Store relationships using the component IDs
      await adapter.storeRelationship(userId, createUserId, 'isUsedBy');
      await adapter.storeRelationship(userId, productId, 'relatesTo');
    });
    
    it('should get all related components', async () => {
      const relatedComponents = await adapter.getRelatedComponents(userComponent.name);
      
      expect(relatedComponents).toHaveLength(2);
      expect(relatedComponents.some(c => c.name === 'CreateUser')).toBe(true);
      expect(relatedComponents.some(c => c.name === 'Product')).toBe(true);
    });
    
    it('should filter related components by relationship type', async () => {
      const relatedComponents = await adapter.getRelatedComponents(userComponent.name, 'isUsedBy');
      
      expect(relatedComponents).toHaveLength(1);
      expect(relatedComponents[0].name).toBe('CreateUser');
    });
    
    it('should return empty array when component has no relationships', async () => {
      const relatedComponents = await adapter.getRelatedComponents(productComponent.name);
      
      expect(relatedComponents).toHaveLength(0);
    });
    
    it('should return empty array when component does not exist', async () => {
      const relatedComponents = await adapter.getRelatedComponents('NonExistentComponent');
      
      expect(relatedComponents).toHaveLength(0);
    });
  });
  
  describe('clear', () => {
    it('should clear all stored data', async () => {
      // Store some data
      await adapter.storeComponent(userComponent);
      await adapter.storeImplementation(createUserImplementation);
      
      // Verify data is stored
      expect(await adapter.getAllComponents()).toHaveLength(1);
      expect(await adapter.getAllImplementations()).toHaveLength(1);
      
      // Clear the adapter
      await adapter.clear();
      
      // Verify data is cleared
      expect(await adapter.getAllComponents()).toHaveLength(0);
      expect(await adapter.getAllImplementations()).toHaveLength(0);
    });
  });
}); 