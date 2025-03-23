import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionEventBus } from '../src/implementations/event-bus';
import { InMemoryExtensionSystem } from '../src/implementations/extension-system';
import { DomainEvent } from '../src/models/core-types';
import { Extension, ExtensionContext, ExtensionHookRegistration, ExtensionPointName, ExtensionPointNames } from '../src/models/extension-system';
import { createModernRuntime } from '../src/implementations/modern-factory';
import { Runtime } from '../src/models/runtime';

/**
 * Test extension implementation for event bus integration
 */
class EventBusExtension implements Extension {
  id: string;
  name: string;
  description: string;
  dependencies: string[];
  private hooks: ExtensionHookRegistration<ExtensionPointName, unknown>[] = [];
  
  // Track calls for verification
  beforePublishCalls = 0;
  afterPublishCalls = 0;
  lastEvent: any = null;
  
  constructor(id: string = 'event-bus-extension') {
    this.id = id;
    this.name = 'Event Bus Test Extension';
    this.description = 'Extension for testing event bus integration';
    this.dependencies = [];
    
    // Register hooks for event lifecycle
    this.hooks.push({
      pointName: ExtensionPointNames.EVENT_BEFORE_PUBLISH,
      hook: async (params, context) => {
        this.beforePublishCalls++;
        this.lastEvent = params;
        return { success: true, value: params };
      },
      priority: 10
    });
    
    this.hooks.push({
      pointName: ExtensionPointNames.EVENT_AFTER_PUBLISH,
      hook: async (params, context) => {
        this.afterPublishCalls++;
        this.lastEvent = params;
        return { success: true, value: params };
      },
      priority: 10
    });
  }
  
  getHooks(): ExtensionHookRegistration<ExtensionPointName, unknown>[] {
    return this.hooks;
  }
  
  getVersion(): string {
    return '1.0.0';
  }
  
  getCapabilities(): string[] {
    return ['event-processing'];
  }
  
  // Add a method to reset counters
  resetCounters(): void {
    this.beforePublishCalls = 0;
    this.afterPublishCalls = 0;
    this.lastEvent = null;
  }
}

describe('Extension System and Event Bus Integration', () => {
  let extensionSystem: InMemoryExtensionSystem;
  let eventBus: ExtensionEventBus;
  let extension: EventBusExtension;
  
  beforeEach(() => {
    extensionSystem = new InMemoryExtensionSystem();
    eventBus = new ExtensionEventBus(extensionSystem);
    extension = new EventBusExtension();
  });
  
  describe('Standalone Integration Tests', () => {
    it('should execute extension hooks during event publishing', async () => {
      // Register the extension
      const result = extensionSystem.registerExtension(extension);
      expect(result.success).toBe(true);
      
      // Create a test event
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { test: 'value' }
      };
      
      // Create a handler to verify event is received
      const handler = vi.fn();
      eventBus.subscribe('test.event', handler);
      
      // Publish the event
      await eventBus.publish(event);
      
      // Verify handler was called
      expect(handler).toHaveBeenCalledWith(event);
      
      // Verify extension hooks were called
      expect(extension.beforePublishCalls).toBe(1);
      expect(extension.afterPublishCalls).toBe(1);
      
      // Verify event data in hooks
      expect(extension.lastEvent).toHaveProperty('eventId', event.id);
      expect(extension.lastEvent).toHaveProperty('eventType', event.type);
    });
    
    it('should handle errors in extension hooks gracefully', async () => {
      // Create an extension that fails in the before hook
      const failingExtension = new EventBusExtension('failing-extension');
      
      // Override hooks to simulate failure
      failingExtension.getHooks()[0].hook = async () => ({
        success: false,
        error: new Error('Intentional hook failure')
      });
      
      // Register the extension
      extensionSystem.registerExtension(failingExtension);
      
      // Create a test event
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { test: 'value' }
      };
      
      // Attempt to publish (should throw)
      await expect(eventBus.publish(event)).rejects.toThrow('Intentional hook failure');
      
      // The after hook should not be called
      expect(failingExtension.afterPublishCalls).toBe(0);
    });
  });
  
  describe('Runtime Integration Tests', () => {
    let runtime: Runtime;
    
    beforeEach(() => {
      runtime = createModernRuntime();
    });
    
    it('should properly initialize extension system and event bus in runtime', async () => {
      // First verify that components exist in runtime
      expect(runtime.eventBus).toBeDefined();
      expect(runtime.extensionSystem).toBeDefined();
      
      // Register extension with runtime extension system
      const result = runtime.extensionSystem.registerExtension(extension);
      expect(result.success).toBe(true);
      
      // Create a test event
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { test: 'value' }
      };
      
      // Create a handler
      const handler = vi.fn();
      runtime.eventBus.subscribe('test.event', handler);
      
      // Publish the event
      await runtime.eventBus.publish(event);
      
      // Verify handler was called
      expect(handler).toHaveBeenCalledWith(event);
      
      // Verify extension hooks were called
      expect(extension.beforePublishCalls).toBe(1);
      expect(extension.afterPublishCalls).toBe(1);
    });
    
    it('should propagate extension system initialization to event bus', async () => {
      // Initialize runtime
      await runtime.initialize({
        version: '1.0.0',
        namespace: 'test'
      });
      
      // Register extension with runtime extension system
      runtime.extensionSystem.registerExtension(extension);
      
      // Start runtime
      await runtime.start();

      // Reset the extension counters before publishing to ensure accurate count
      extension.resetCounters();
      
      // Create a test event
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { test: 'value' }
      };
      
      // Create a handler
      const handler = vi.fn();
      runtime.eventBus.subscribe('test.event', handler);
      
      // Publish the event
      await runtime.eventBus.publish(event);
      
      // Verify handler was called
      expect(handler).toHaveBeenCalledWith(event);
      
      // Verify extension hooks were called - note that we expect exactly one call
      // after resetting the counters
      expect(extension.beforePublishCalls).toBe(1);
      expect(extension.afterPublishCalls).toBe(1);
    });
  });
}); 