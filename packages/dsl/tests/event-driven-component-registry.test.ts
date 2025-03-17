import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactiveEventBus } from '@architectlm/core';
import { ComponentType } from '../src/types.js';
import { EventDrivenComponentRegistry, DSLEventType } from '../src/event-driven-component-registry.js';

describe('EventDrivenComponentRegistry', () => {
  let eventBus: ReactiveEventBus;
  let registry: EventDrivenComponentRegistry;
  
  beforeEach(() => {
    eventBus = new ReactiveEventBus();
    registry = new EventDrivenComponentRegistry(eventBus);
  });
  
  describe('Component Registration', () => {
    it('should register a component and emit an event', () => {
      // Spy on the event bus
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // Create a test component
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Register the component
      registry.registerComponent(component);
      
      // Verify the event was published
      expect(publishSpy).toHaveBeenCalledWith(
        DSLEventType.COMPONENT_REGISTERED,
        { component }
      );
      
      // Verify the component can be retrieved
      expect(registry.getComponent('TestSchema')).toEqual(component);
    });
    
    it('should update a component and emit an event', () => {
      // Spy on the event bus
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // Create a test component
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Register the component
      registry.registerComponent(component);
      
      // Update the component
      const updatedComponent = {
        ...component,
        description: 'An updated test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' }
          }
        }
      };
      
      // Update the component
      registry.updateComponent(updatedComponent);
      
      // Verify the event was published
      expect(publishSpy).toHaveBeenCalledWith(
        DSLEventType.COMPONENT_UPDATED,
        { component: updatedComponent }
      );
      
      // Verify the component was updated
      expect(registry.getComponent('TestSchema')).toEqual(updatedComponent);
    });
    
    it('should remove a component and emit an event', () => {
      // Spy on the event bus
      const publishSpy = vi.spyOn(eventBus, 'publish');
      
      // Create a test component
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Register the component
      registry.registerComponent(component);
      
      // Remove the component
      registry.removeComponent('TestSchema');
      
      // Verify the event was published
      expect(publishSpy).toHaveBeenCalledWith(
        DSLEventType.COMPONENT_REMOVED,
        { componentName: 'TestSchema' }
      );
      
      // Verify the component was removed
      expect(registry.getComponent('TestSchema')).toBeUndefined();
    });
  });
  
  describe('Event Handling', () => {
    it('should handle component registered events', () => {
      // Create a test component
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Publish a component registered event
      eventBus.publish(DSLEventType.COMPONENT_REGISTERED, { component });
      
      // Verify the component was registered
      expect(registry.getComponent('TestSchema')).toEqual(component);
    });
    
    it('should handle component updated events', () => {
      // Create a test component
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Register the component
      registry.registerComponent(component);
      
      // Create an updated component
      const updatedComponent = {
        ...component,
        description: 'An updated test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' }
          }
        }
      };
      
      // Publish a component updated event
      eventBus.publish(DSLEventType.COMPONENT_UPDATED, { component: updatedComponent });
      
      // Verify the component was updated
      expect(registry.getComponent('TestSchema')).toEqual(updatedComponent);
    });
    
    it('should handle component removed events', () => {
      // Create a test component
      const component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        description: 'A test schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };
      
      // Register the component
      registry.registerComponent(component);
      
      // Publish a component removed event
      eventBus.publish(DSLEventType.COMPONENT_REMOVED, { componentName: 'TestSchema' });
      
      // Verify the component was removed
      expect(registry.getComponent('TestSchema')).toBeUndefined();
    });
  });
  
  describe('Component Queries', () => {
    beforeEach(() => {
      // Register some test components
      registry.registerComponent({
        type: ComponentType.SCHEMA,
        name: 'UserSchema',
        description: 'User schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      });
      
      registry.registerComponent({
        type: ComponentType.SCHEMA,
        name: 'ProductSchema',
        description: 'Product schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' }
          }
        }
      });
      
      registry.registerComponent({
        type: ComponentType.COMMAND,
        name: 'CreateUser',
        description: 'Create a user',
        input: { ref: 'UserInput' },
        output: { ref: 'User' }
      });
    });
    
    it('should get all components', () => {
      const components = registry.getAllComponents();
      expect(components.length).toBe(3);
      expect(components.map(c => c.name)).toContain('UserSchema');
      expect(components.map(c => c.name)).toContain('ProductSchema');
      expect(components.map(c => c.name)).toContain('CreateUser');
    });
    
    it('should get components by type', () => {
      const schemas = registry.getComponentsByType(ComponentType.SCHEMA);
      expect(schemas.length).toBe(2);
      expect(schemas.map(c => c.name)).toContain('UserSchema');
      expect(schemas.map(c => c.name)).toContain('ProductSchema');
      
      const commands = registry.getComponentsByType(ComponentType.COMMAND);
      expect(commands.length).toBe(1);
      expect(commands[0].name).toBe('CreateUser');
    });
    
    it('should check if a component exists', () => {
      expect(registry.hasComponent('UserSchema')).toBe(true);
      expect(registry.hasComponent('NonExistentSchema')).toBe(false);
    });
  });
}); 