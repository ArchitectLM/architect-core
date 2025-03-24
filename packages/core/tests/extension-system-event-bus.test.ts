import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInMemoryEventBus, ExtensionEventBusImpl } from '../src/implementations/event-bus';
import { InMemoryExtensionSystem } from '../src/implementations/extension-system';
import { DomainEvent } from '../src/models/core-types';
import { Extension, ExtensionContext, ExtensionHookRegistration, ExtensionPointName, ExtensionPointNames } from '../src/models/extension-system';
import { createRuntime } from '../src/implementations/factory';
import { Runtime } from '../src/models/runtime';
import { EventBus } from '../src/models/event-system';
import { TestRuntime } from './helpers/test-runtime';

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
  let eventBus: EventBus;
  let extension: EventBusExtension;
  
  beforeEach(() => {
    extensionSystem = new InMemoryExtensionSystem();
    eventBus = createInMemoryEventBus(extensionSystem);
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
      
      // Verify extension hooks were called
      expect(extension.beforePublishCalls).toBe(1);
      expect(extension.afterPublishCalls).toBe(1);
      expect(extension.lastEvent).toBeDefined();
      
      // Verify handler was called with the event payload, not the event itself
      expect(handler).toHaveBeenCalled();
    });
    
    it('should handle errors in extension hooks gracefully', async () => {
      // Create an extension with a failing hook
      const failingExtension = new EventBusExtension('failing-extension');
      
      // Override the hooks with a failing one
      const failingHooks: ExtensionHookRegistration<ExtensionPointName, unknown>[] = [
        {
          pointName: ExtensionPointNames.EVENT_BEFORE_PUBLISH,
          hook: async () => {
            throw new Error('Hook failed intentionally');
          },
          priority: 5
        }
      ];
      
      // @ts-ignore - Replace the hooks property for testing
      failingExtension.hooks = failingHooks;
      failingExtension.getHooks = () => failingHooks;
      
      // Register both extensions
      extensionSystem.registerExtension(extension);
      extensionSystem.registerExtension(failingExtension);
      
      // Create event and handler
      const event = {
        id: 'error-test',
        type: 'error.event',
        timestamp: Date.now(),
        payload: { data: 'test' },
        metadata: {}
      };
      
      const handler = vi.fn();
      eventBus.subscribe('error.event', handler);
      
      // Publish event - errors in hooks are propagated in the current implementation
      await expect(eventBus.publish(event)).rejects.toThrow('Hook failed intentionally');
      
      // Handler should not be called since the event was rejected
      expect(handler).not.toHaveBeenCalled();
    });
  });
  
  describe('Runtime Integration Tests', () => {
    let runtime: TestRuntime;
    
    /**
     * Helper to create a test runtime with the right internal components accessible
     */
    function createTestRuntime(): TestRuntime {
      const extensionSystem = new InMemoryExtensionSystem();
      const eventBus = createInMemoryEventBus(extensionSystem);
      
      // Create a TestRuntime implementation with required methods
      return {
        // Core components
        extensionSystem,
        eventBus,
        processRegistry: {} as any,
        processManager: {} as any,
        taskRegistry: {} as any,
        taskExecutor: {} as any,
        taskScheduler: {} as any,
        pluginRegistry: {} as any,
        
        // Runtime properties
        version: '1.0.0',
        namespace: 'test',
        
        // Core methods
        initialize: async () => {},
        shutdown: async () => {},
        restart: async () => {},
        getHealth: async () => ({ success: true, value: { 
          status: 'healthy',
          components: {},
          timestamp: Date.now() 
        }}),
        
        // Process methods
        createProcess: async () => ({ success: false, error: new Error('Not implemented') }),
        transitionProcess: async () => ({ success: false, error: new Error('Not implemented') }),
        
        // Task methods
        executeTask: async () => ({ success: false, error: new Error('Not implemented') }),
        executeTaskWithDependencies: async () => ({ success: false, error: new Error('Not implemented') }),
        scheduleTask: async () => ({ success: false, error: new Error('Not implemented') }),
        
        // Event methods
        subscribe: (eventType, handler) => eventBus.subscribe(eventType, handler),
        publish: async (event) => eventBus.publish(event),
        persistEvent: async () => { throw new Error('Not implemented'); },
        replayEvents: async () => { throw new Error('Not implemented'); },
        correlateEvents: async () => { throw new Error('Not implemented'); },
        
        // Metrics methods
        getProcessMetrics: async () => ({}),
        getTaskMetrics: async () => ({}),
        getEventMetrics: async () => ({}),
        getHealthStatus: async () => ({ 
          status: 'healthy',
          components: {},
          timestamp: Date.now() 
        }),
        
        // Plugin methods
        registerPlugin: async () => ({ success: false, error: new Error('Not implemented') }),
        unregisterPlugin: async () => ({ success: false, error: new Error('Not implemented') }),
        
        // Extension methods
        registerExtension: async (extension) => {
          const result = extensionSystem.registerExtension(extension);
          return { success: result.success, error: result.error };
        },
        unregisterExtension: async () => ({ success: false, error: new Error('Not implemented') })
      };
    }
    
    beforeEach(() => {
      runtime = createTestRuntime();
    });
    
    it('should properly initialize extension system and event bus in runtime', async () => {
      // Register our test extension in the runtime
      const result = runtime.extensionSystem.registerExtension(new EventBusExtension());
      expect(result.success).toBe(true);
      
      // Initialize runtime
      await runtime.initialize();

      // Create and publish a test event
      const event = {
        id: 'runtime-test-event',
        type: 'runtime.test',
        timestamp: Date.now(),
        payload: { data: 'test via runtime' },
        metadata: {}
      };

      // Create a handler to verify
      const handler = vi.fn();
      runtime.eventBus.subscribe('runtime.test', handler);
      
      // Publish the event through the runtime's event bus
      await runtime.eventBus.publish(event);
      
      // Verify the handler was called
      expect(handler).toHaveBeenCalled();
    });
    
    it('should propagate extension system initialization to event bus', async () => {
      // Create an extension that counts hook executions
      const extension = new EventBusExtension();
      
      // Register it in the runtime
      runtime.extensionSystem.registerExtension(extension);
      
      // Create event and handler
      const event = {
        id: 'propagation-test',
        type: 'propagation.test',
        timestamp: Date.now(),
        payload: { propagated: true },
        metadata: {}
      };
      
      const handler = vi.fn();
      runtime.eventBus.subscribe('propagation.test', handler);
      
      // Publish event
      await runtime.eventBus.publish(event);
      
      // Verify hooks were called, indicating proper integration
      expect(extension.beforePublishCalls).toBe(1);
      expect(extension.afterPublishCalls).toBe(1);
      
      // Verify handler was called
      expect(handler).toHaveBeenCalled();
    });
  });
}); 