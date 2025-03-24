import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createInMemoryEventBus, ExtensionEventBusImpl } from '../../src/implementations/event-bus';
import { createDomainEvent } from '../helpers/event-testing-utils';
import { DomainEvent } from '../../src/models/core-types';
import { EventStorage, EventHandler, EventBus } from '../../src/models/event-system';
import { 
  createTestEvent, 
  createMockExtensionSystem,
  flushPromises
} from '../helpers/event-testing-utils';
import { InMemoryExtensionSystem, createExtensionSystem } from '../../src/implementations/extension-system';
import { ExtensionSystem } from '../../src/models/extension-system';
import { createRuntime } from '../../src/implementations/factory';

// Helper to poll until a condition is met or timeout
const pollUntil = async (
  condition: () => boolean | Promise<boolean>,
  interval = 10,
  timeout = 1000
): Promise<boolean> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
};

describe('Event Bus', () => {
  describe('Basic Integration Tests', () => {
    let eventBus: EventBus;
    let extensionSystem: ExtensionSystem;
    let runtime: ReturnType<typeof createRuntime>;

    beforeEach(() => {
      // Create the extension system first
      extensionSystem = createExtensionSystem();
      
      // Create the event bus with the extension system
      eventBus = createInMemoryEventBus(extensionSystem);
      
      // Create a runtime with explicit components
      runtime = createRuntime({
        components: {
          extensionSystem,
          eventBus
        }
      });
    });

    afterEach(async () => {
      // Clean up subscriptions
      eventBus.clearAllSubscriptions();
    });

    it('should allow subscribing to events', () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const subscription = eventBus.subscribe('test-event', handler);
      
      expect(subscription).toBeDefined();
      expect(subscription.id).toBeDefined();
      expect(typeof subscription.unsubscribe).toBe('function');
    });

    it('should call handler when event is published', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      eventBus.subscribe('test-event', handler);
      
      const testPayload = { message: 'Hello' };
      const event = createDomainEvent('test-event', testPayload);
      await eventBus.publish(event);
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(testPayload);
    });

    it('should only call handlers for matching event type', async () => {
      const handler1 = vi.fn().mockResolvedValue(undefined);
      const handler2 = vi.fn().mockResolvedValue(undefined);
      
      eventBus.subscribe('event1', handler1);
      eventBus.subscribe('event2', handler2);
      
      const event = createDomainEvent('event1', { message: 'Hello' });
      await eventBus.publish(event);
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should allow unsubscribing from events', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      const subscription = eventBus.subscribe('test-event', handler);
      
      // First publication should trigger handler
      const event1 = createDomainEvent('test-event', { message: 'First' });
      await eventBus.publish(event1);
      expect(handler).toHaveBeenCalledTimes(1);
      
      // Unsubscribe
      subscription.unsubscribe();
      
      // Second publication should not trigger handler
      const event2 = createDomainEvent('test-event', { message: 'Second' });
      await eventBus.publish(event2);
      expect(handler).toHaveBeenCalledTimes(1); // Still just 1 call
    });

    it('should publish and receive event payloads correctly', async () => {
      // Setup a test subscription
      const receivedEvents: any[] = [];
      const subscription = eventBus.subscribe('test.event', async (payload) => {
        receivedEvents.push(payload);
      });
      
      // Create and publish a test event
      const testMessage = { message: 'Hello World' };
      const event = createDomainEvent('test.event', testMessage);
      await eventBus.publish(event);
      
      // Wait for event processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify event payload was received correctly
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0]).toEqual(testMessage);
      
      // Cleanup
      subscription.unsubscribe();
    });

    it('should integrate with the extension system', async () => {
      // Register an extension point
      extensionSystem.registerExtensionPoint('test.extensionPoint');
      
      // Set up a flag to track if the extension was called
      let extensionPointCalled = false;
      
      // Register an extension that responds to the extension point
      extensionSystem.registerExtension({
        id: 'test.extension',
        name: 'Test Extension',
        description: 'A test extension',
        dependencies: [],
        getHooks: () => [{
          pointName: 'test.extensionPoint',
          hook: async () => {
            extensionPointCalled = true;
            return { success: true, value: undefined };
          }
        }],
        getVersion: () => '1.0.0',
        getCapabilities: () => []
      });
      
      // Subscribe to an event that will trigger the extension point
      eventBus.subscribe('test.triggerExtension', async (eventPayload) => {
        await extensionSystem.executeExtensionPoint('test.extensionPoint', eventPayload);
      });
      
      // Publish an event that will trigger the extension
      const event = createDomainEvent('test.triggerExtension', { data: 'test data' });
      await eventBus.publish(event);
      
      // Wait for event processing and extension execution
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify the extension was called
      expect(extensionPointCalled).toBe(true);
    });
    
    it('should work with additional event bus functionality', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      
      // Test subscriberCount
      expect(eventBus.subscriberCount('test.count')).toBe(0);
      
      const subscription = eventBus.subscribe('test.count', handler);
      
      expect(eventBus.subscriberCount('test.count')).toBe(1);
      
      // Test hasSubscribers
      expect(eventBus.hasSubscribers('test.count')).toBe(true);
      expect(eventBus.hasSubscribers('nonexistent')).toBe(false);
      
      // Test clearSubscriptions
      eventBus.clearSubscriptions('test.count');
      expect(eventBus.subscriberCount('test.count')).toBe(0);
      
      // Verify unsubscription happened
      const event = createDomainEvent('test.count', { value: 1 });
      await eventBus.publish(event);
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // Test both implementations to ensure consistency
  describe('Implementation Tests', () => {
    (['ExtensionEventBusImpl', 'InMemoryEventBus'] as const).forEach(busType => {
      describe(`${busType}`, () => {
        let eventBus: EventBus;
        let mockExtensionSystem: ExtensionSystem;
        
        beforeEach(() => {
          mockExtensionSystem = createMockExtensionSystem() as unknown as ExtensionSystem;
          
          if (busType === 'ExtensionEventBusImpl') {
            eventBus = new ExtensionEventBusImpl(mockExtensionSystem);
          } else {
            eventBus = createInMemoryEventBus(new InMemoryExtensionSystem());
          }
        });
        
        afterEach(() => {
          // Clean up subscriptions
          if (eventBus) {
            eventBus.clearAllSubscriptions();
          }
        });
        
        describe('Basic Subscription and Publishing', () => {
          it('should subscribe and receive published events', async () => {
            const eventType = 'test.event';
            const handler = vi.fn();
            const payload = { test: 'value' };
            const event = createTestEvent(eventType, payload);
    
            // Mock extension system responses if needed
            if (busType === 'ExtensionEventBusImpl') {
              (mockExtensionSystem.executeExtensionPoint as any)
                .mockResolvedValueOnce({ success: true, value: undefined })
                .mockResolvedValueOnce({ success: true, value: undefined });
            }
    
            // Subscribe to events
            const subscription = eventBus.subscribe(eventType, handler);
            expect(eventBus.subscriberCount(eventType)).toBe(1);
    
            // Publish event
            await eventBus.publish(event);
            
            // Use polling for async event handling
            await pollUntil(() => handler.mock.calls.length > 0);
            
            // Modern event bus passes the payload, not the event
            expect(handler).toHaveBeenCalledWith(payload);
    
            // Unsubscribe
            subscription.unsubscribe();
            expect(eventBus.subscriberCount(eventType)).toBe(0);
    
            // Publish again - handler should not be called
            await eventBus.publish(event);
            await flushPromises();
            expect(handler).toHaveBeenCalledTimes(1);
          });
    
          it('should handle multiple subscribers for the same event type', async () => {
            const eventType = 'test.event';
            const handler1 = vi.fn();
            const handler2 = vi.fn();
            const payload = { test: 'value' };
            const event = createTestEvent(eventType, payload);
    
            // Mock extension system responses if needed
            if (busType === 'ExtensionEventBusImpl') {
              (mockExtensionSystem.executeExtensionPoint as any)
                .mockResolvedValueOnce({ success: true, value: undefined })
                .mockResolvedValueOnce({ success: true, value: undefined });
            }
    
            // Subscribe two handlers
            const subscription1 = eventBus.subscribe(eventType, handler1);
            const subscription2 = eventBus.subscribe(eventType, handler2);
            expect(eventBus.subscriberCount(eventType)).toBe(2);
    
            // Publish event
            await eventBus.publish(event);
            
            // Use polling for async event handling
            await pollUntil(() => handler1.mock.calls.length > 0 && handler2.mock.calls.length > 0);
            
            // Modern event bus passes the payload, not the event
            expect(handler1).toHaveBeenCalledWith(payload);
            expect(handler2).toHaveBeenCalledWith(payload);
    
            // Unsubscribe one handler
            subscription1.unsubscribe();
            expect(eventBus.subscriberCount(eventType)).toBe(1);
    
            // Clear event handlers
            await eventBus.clearSubscriptions(eventType);
            expect(eventBus.subscriberCount(eventType)).toBe(0);
          });
        });
        
        describe('Event Filtering', () => {
          it('should filter events based on exact type match', async () => {
            const handler = vi.fn();
            
            // Subscribe to specific event type
            eventBus.subscribe('test.one', handler);
            
            // Publish events with different types
            const payload1 = { value: 1 };
            const payload2 = { value: 2 };
            
            await eventBus.publish(createTestEvent('test.one', payload1));
            await eventBus.publish(createTestEvent('test.two', payload2));
            
            // Wait for events to be processed
            await pollUntil(() => handler.mock.calls.length >= 1);
            
            // Should receive only test.one events
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0][0]).toEqual(payload1);
          });
        });
        
        describe('Error Handling', () => {
          it('should handle errors in event handlers', async () => {
            const successHandler = vi.fn();
            const errorHandler = vi.fn().mockImplementation(() => {
              throw new Error('Handler error');
            });
            
            // Subscribe handlers
            eventBus.subscribe('test.event', successHandler);
            eventBus.subscribe('test.event', errorHandler);
            
            const payload = { value: 'test' };
            
            // Publish event - the error in one handler should not prevent others
            await eventBus.publish(createTestEvent('test.event', payload));
            
            // Wait for handlers to execute
            await flushPromises();
            
            // Success handler should still be called with payload
            expect(successHandler).toHaveBeenCalledTimes(1);
            expect(successHandler).toHaveBeenCalledWith(payload);
          });
        });
        
        describe('Event Metadata', () => {
          it('should maintain correlation IDs when specified', async () => {
            const handler = vi.fn();
            const correlationId = uuidv4();
            
            // Subscribe handler
            eventBus.subscribe('test.event', handler);
            
            // Create correlated events
            const event1 = createTestEvent('test.event', { value: 1 });
            event1.correlationId = correlationId;
            
            const event2 = createTestEvent('test.event', { value: 2 });
            event2.correlationId = correlationId;
            
            // Publish both events
            await eventBus.publish(event1);
            await eventBus.publish(event2);
            
            // Wait for events to be processed
            await pollUntil(() => handler.mock.calls.length >= 2);
            
            // Both payloads should have been sent to handler
            expect(handler).toHaveBeenCalledTimes(2);
            expect(handler.mock.calls[0][0]).toEqual({ value: 1 });
            expect(handler.mock.calls[1][0]).toEqual({ value: 2 });
          });
        });
        
        describe('Persistence Features', () => {
          it('should support event persistence when configured', async () => {
            // Skip if not implemented
            if (typeof (eventBus as any).enablePersistence === 'function') {
              const mockStorage: EventStorage = {
                storeEvent: vi.fn().mockResolvedValue({ success: true, value: undefined }),
                getEventsByType: vi.fn().mockResolvedValue({ success: true, value: [] }),
                getEventsByCorrelationId: vi.fn().mockResolvedValue({ success: true, value: [] }),
                getAllEvents: vi.fn().mockResolvedValue({ success: true, value: [] })
              };
              
              // Enable persistence
              (eventBus as any).enablePersistence(mockStorage);
              
              // Publish an event
              const event = createTestEvent('test.persist', { value: 'persisted' });
              await eventBus.publish(event);
              
              // Event should be stored
              expect(mockStorage.storeEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: 'test.persist',
                payload: { value: 'persisted' }
              }));
              
              // Disable persistence
              (eventBus as any).disablePersistence();
              
              // Publish another event
              const event2 = createTestEvent('test.persist2', { value: 'not-persisted' });
              await eventBus.publish(event2);
              
              // No additional storage calls
              expect(mockStorage.storeEvent).toHaveBeenCalledTimes(1);
            } else {
              // Skip test for implementations without persistence
              expect(true).toBe(true);
            }
          });
        });
      });
    });
  });
}); 