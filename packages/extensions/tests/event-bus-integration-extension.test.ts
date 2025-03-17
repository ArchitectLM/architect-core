import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Event } from '../src/models.js';
import { 
  DefaultExtensionSystem, 
  createExtensionSystem,
  EventBusIntegrationExtension,
  createExtendedEventBus,
  EventBus
} from '../src/index.js';

/**
 * Mock event bus for testing
 */
class MockEventBus implements EventBus {
  private handlers: Map<string, Set<(event: Event) => void>> = new Map();
  publish = vi.fn();
  
  subscribe(eventType: string, handler: (event: Event) => void): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
    
    return () => {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }
  
  // Helper method to simulate event publishing for testing
  simulatePublish(event: Event): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }
}

describe('EventBusIntegrationExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let mockEventBus: MockEventBus;
  let extension: EventBusIntegrationExtension;

  beforeEach(() => {
    // Create and configure the extension system
    extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'event.beforePublish',
      description: 'Called before an event is published',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'event.afterPublish',
      description: 'Called after an event is published',
      handlers: []
    });
    
    // Create a mock event bus
    mockEventBus = new MockEventBus();
    
    // Create the extension
    extension = new EventBusIntegrationExtension(mockEventBus);
    
    // Register the extension
    extensionSystem.registerExtension(extension);
  });

  describe('GIVEN an event bus integration extension', () => {
    it('SHOULD override the event bus publish method', () => {
      // THEN the publish method should be overridden
      expect(mockEventBus.publish).not.toBeUndefined();
      expect(mockEventBus.publish).not.toBe(vi.fn());
    });
    
    it('SHOULD process events through the beforePublish hook', async () => {
      // Create a mock hook handler
      const beforePublishHandler = vi.fn().mockImplementation(context => context);
      
      // Register the hook handler
      extensionSystem.registerExtension({
        name: 'test-extension',
        description: 'Test extension',
        hooks: {
          'event.beforePublish': beforePublishHandler
        }
      });
      
      // WHEN publishing an event
      mockEventBus.publish('test-event', { data: 'test' });
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // THEN the beforePublish hook should be called
      expect(beforePublishHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            type: 'test-event',
            payload: { data: 'test' }
          })
        })
      );
    });
    
    it('SHOULD process events through the afterPublish hook', async () => {
      // Create a mock hook handler
      const afterPublishHandler = vi.fn().mockImplementation(context => context);
      
      // Register the hook handler
      extensionSystem.registerExtension({
        name: 'test-extension',
        description: 'Test extension',
        hooks: {
          'event.afterPublish': afterPublishHandler
        }
      });
      
      // WHEN publishing an event
      mockEventBus.publish('test-event', { data: 'test' });
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // THEN the afterPublish hook should be called
      expect(afterPublishHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            type: 'test-event',
            payload: { data: 'test' }
          }),
          result: expect.objectContaining({
            success: true
          })
        })
      );
    });
    
    it('SHOULD add metadata to events if configured', async () => {
      // Create a new extension with metadata options
      const metadataExtension = new EventBusIntegrationExtension(mockEventBus, {
        addMetadata: true,
        globalMetadata: {
          source: 'test',
          version: '1.0.0'
        }
      });
      
      // Register the extension
      extensionSystem.registerExtension(metadataExtension);
      
      // Create a mock hook handler to capture the event
      const beforePublishHandler = vi.fn().mockImplementation(context => context);
      
      // Register the hook handler
      extensionSystem.registerExtension({
        name: 'test-extension',
        description: 'Test extension',
        hooks: {
          'event.beforePublish': beforePublishHandler
        }
      });
      
      // WHEN publishing an event
      mockEventBus.publish('test-event', { data: 'test' });
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // THEN the event should have metadata
      expect(beforePublishHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          event: expect.objectContaining({
            metadata: expect.objectContaining({
              source: 'test',
              version: '1.0.0'
            })
          })
        })
      );
    });
  });

  describe('GIVEN the createExtendedEventBus function', () => {
    it('SHOULD create an extended event bus with the extension registered', () => {
      // Create a new mock event bus
      const newMockEventBus = new MockEventBus();
      
      // WHEN creating an extended event bus
      const extendedEventBus = createExtendedEventBus(
        newMockEventBus,
        extensionSystem
      );
      
      // THEN the event bus should be extended
      expect(extendedEventBus).toBe(newMockEventBus);
      expect(newMockEventBus.publish).not.toBe(vi.fn());
    });
    
    it('SHOULD register extension points if they do not exist', () => {
      // Create a new extension system without extension points
      const newExtensionSystem = createExtensionSystem() as DefaultExtensionSystem;
      
      // WHEN creating an extended event bus
      createExtendedEventBus(
        new MockEventBus(),
        newExtensionSystem
      );
      
      // THEN the extension points should be registered
      expect(newExtensionSystem.hasExtensionPoint('event.beforePublish')).toBe(true);
      expect(newExtensionSystem.hasExtensionPoint('event.afterPublish')).toBe(true);
    });
  });

  describe('GIVEN error handling in the extension', () => {
    it('SHOULD handle errors in the beforePublish hook', async () => {
      // Create a mock hook handler that throws an error
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Register the hook handler
      extensionSystem.registerExtension({
        name: 'error-extension',
        description: 'Error extension',
        hooks: {
          'event.beforePublish': errorHandler
        }
      });
      
      // Create a mock hook handler for afterPublish
      const afterPublishHandler = vi.fn().mockImplementation(context => context);
      
      // Register the hook handler
      extensionSystem.registerExtension({
        name: 'after-extension',
        description: 'After extension',
        hooks: {
          'event.afterPublish': afterPublishHandler
        }
      });
      
      // Mock console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // WHEN publishing an event
      mockEventBus.publish('test-event', { data: 'test' });
      
      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // THEN the error should be caught and logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // AND the afterPublish hook should be called with an error result
      expect(afterPublishHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          result: expect.objectContaining({
            success: false,
            error: expect.any(Error)
          })
        })
      );
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('GIVEN the destroy method', () => {
    it('SHOULD restore the original publish method', () => {
      // Store the overridden publish method
      const overriddenPublish = mockEventBus.publish;
      
      // WHEN destroying the extension
      extension.destroy();
      
      // THEN the original publish method should be restored
      expect(mockEventBus.publish).not.toBe(overriddenPublish);
      expect(mockEventBus.publish).toBe(vi.fn());
    });
  });
}); 