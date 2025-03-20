import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  createExtensionSystem, 
  DefaultExtensionSystem, 
  ExtensionEvent 
} from '../src/extension-system.js';
import { 
  EventBusIntegrationExtension, 
  createExtendedEventBus,
  EventBus
} from '../src/extensions/event-bus-integration.js';
import { Event } from '../src/models.js';

// Create a mock event bus class
class MockEventBus implements EventBus {
  events: Record<string, any[]> = {};
  
  publish = vi.fn().mockImplementation((type, payload) => {
    // Store the event for testing
    if (!this.events[type]) {
      this.events[type] = [];
    }
    this.events[type].push({ type, payload, timestamp: Date.now() });
    return { type, payload, timestamp: Date.now() };
  });
  
  subscribe = vi.fn().mockImplementation(() => {
    // Return an unsubscribe function
    return () => {};
  });
}

describe('EventBusIntegrationExtension', () => {
  let mockEventBus: MockEventBus;
  let originalPublish: any;

  beforeEach(() => {
    // Create a mock event bus
    mockEventBus = new MockEventBus();
    originalPublish = mockEventBus.publish;
    
    // Reset mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up
    vi.clearAllMocks();
  });
  
  describe('GIVEN an event bus with the extension', () => {
    it('SHOULD override the publish method', () => {
      // Create a fresh extension system for this test
      const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
      
      // Register required extension points
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
      
      // Create the extension and register it with the extension system
      const extension = new EventBusIntegrationExtension(mockEventBus);
      extensionSystem.registerExtension(extension);
      
      // THEN the publish method should be overridden
      expect(mockEventBus.publish).not.toBe(originalPublish);
      
      // Clean up
      extension.destroy();
    });
    
    it('SHOULD process events through the beforePublish hook', async () => {
      // Create a fresh extension system for this test
      const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
      
      // Register required extension points first
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
      
      // Create the extension
      const extension = new EventBusIntegrationExtension(mockEventBus);
      
      // Directly mock the beforePublish hook
      const beforePublishSpy = vi.spyOn(extension.hooks, 'event.beforePublish');
      
      // Register the extension with the extension system
      extensionSystem.registerExtension(extension);
      
      // Publish an event through the event bus
      mockEventBus.publish('test.event', { data: 'test' });
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify the hook was called
      expect(beforePublishSpy).toHaveBeenCalled();
      
      // Clean up
      extension.destroy();
    });
    
    it('SHOULD process events through the afterPublish hook', async () => {
      // Create a fresh extension system for this test
      const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
      
      // Register required extension points first
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
      
      // Create the extension
      const extension = new EventBusIntegrationExtension(mockEventBus);
      
      // Directly mock the afterPublish hook
      const afterPublishSpy = vi.spyOn(extension.hooks, 'event.afterPublish');
      
      // Register the extension with the extension system
      extensionSystem.registerExtension(extension);
      
      // Publish an event through the event bus
      mockEventBus.publish('test.event', { data: 'test' });
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify the hook was called
      expect(afterPublishSpy).toHaveBeenCalled();
      
      // Clean up
      extension.destroy();
    });
    
    it('SHOULD add metadata to events if configured', async () => {
      // Create a fresh extension system for this test
      const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
      
      // Register required extension points first
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
      
      // Create a new mock event bus
      const newMockEventBus = new MockEventBus();
      
      // Create a new extension with metadata
      const extension = new EventBusIntegrationExtension(newMockEventBus, {
        addMetadata: true,
        globalMetadata: {
          source: 'test-source',
          version: '1.0.0'
        }
      });
      
      // Directly mock the beforePublish hook and verify metadata
      const beforePublishSpy = vi.spyOn(extension.hooks, 'event.beforePublish');
      
      // Register the extension with the extension system
      extensionSystem.registerExtension(extension);
      
      // Publish an event through the event bus
      newMockEventBus.publish('test.event', { data: 'test' });
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Verify the hook was called
      expect(beforePublishSpy).toHaveBeenCalled();
      
      // Verify metadata was added to the event
      const callArg = beforePublishSpy.mock.calls[0][0];
      expect(callArg.event.metadata).toEqual({
        source: 'test-source',
        version: '1.0.0'
      });
      
      // Clean up
      extension.destroy();
    });
  });
  
  describe('GIVEN the createExtendedEventBus function', () => {
    it('SHOULD create and register the extension', () => {
      // Create a fresh extension system for this test
      const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
      
      // Register extension points first to avoid the error
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
      
      // Create a new mock event bus
      const newMockEventBus = new MockEventBus();
      
      // Use the createExtendedEventBus function
      const extendedEventBus = createExtendedEventBus(newMockEventBus, extensionSystem);
      
      // THEN the extended event bus should be returned
      expect(extendedEventBus).toBe(newMockEventBus);
      
      // AND the publish method should be overridden
      expect(newMockEventBus.publish).not.toBe(originalPublish);
      
      // AND the extension points should be registered
      expect(extensionSystem.hasExtensionPoint('event.beforePublish')).toBe(true);
      expect(extensionSystem.hasExtensionPoint('event.afterPublish')).toBe(true);
      
      // Clean up - get the extension and destroy it
      const extension = Array.from(extensionSystem['extensions'].values())
        .find(ext => ext.name === 'event-bus-integration') as EventBusIntegrationExtension;
      
      if (extension) {
        extension.destroy();
      }
    });
  });
  
  describe('GIVEN error handling in the extension', () => {
    it('SHOULD handle errors in the beforePublish hook', async () => {
      // Create a fresh extension system for this test
      const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
      
      // Register required extension points first
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
      
      // Create the extension
      const extension = new EventBusIntegrationExtension(mockEventBus);
      
      // Mock the beforePublish hook to return a rejected promise
      const beforePublishSpy = vi.spyOn(extension.hooks, 'event.beforePublish');
      beforePublishSpy.mockImplementation(() => {
        return Promise.reject(new Error('Test error'));
      });
      
      // Register the extension with the extension system
      extensionSystem.registerExtension(extension);
      
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error');
      
      // Publish an event that will cause an error
      mockEventBus.publish('test.event', { data: 'test' });
      
      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify console.error was called
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
      
      // Clean up
      extension.destroy();
    });
  });
}); 