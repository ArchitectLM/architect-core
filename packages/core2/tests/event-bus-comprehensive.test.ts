import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExtensionEventBus } from '../src/implementations/event-bus';
import { InMemoryEventBus } from '../src/implementations/event-bus-impl';
import { BackpressureStrategy } from '../src/models/backpressure';
import { DomainEvent, Result } from '../src/models/core-types';
import { ExtensionPointNames } from '../src/models/extension-system';
import { EventStorage } from '../src/models/event-system';
import { 
  createTestEvent, 
  createMockEventHandler, 
  createMockEventFilter,
  createMockExtensionSystem,
  flushPromises
} from './helpers/event-testing-utils';

describe('EventBus Comprehensive Tests', () => {
  // Test both implementations to ensure consistency
  (['ExtensionEventBus', 'InMemoryEventBus'] as const).forEach(busType => {
    describe(`${busType}`, () => {
      let eventBus: ExtensionEventBus | InMemoryEventBus;
      let mockExtensionSystem: ReturnType<typeof createMockExtensionSystem>;
      
      // Disable initialization for testing to avoid external dependencies
      let originalEnsureMethod: any;
      
      beforeEach(() => {
        mockExtensionSystem = createMockExtensionSystem();
        
        // Store original method for restoration
        if (!originalEnsureMethod) {
          originalEnsureMethod = ExtensionEventBus.prototype['ensureExtensionPointsInitialized'];
        }
        
        // Mock the ensure method to avoid actual initialization
        ExtensionEventBus.prototype['ensureExtensionPointsInitialized'] = async function() {
          this['extensionPointsInitialized'] = true;
        };
        
        // Create the appropriate event bus instance
        if (busType === 'ExtensionEventBus') {
          eventBus = new ExtensionEventBus(mockExtensionSystem);
        } else {
          eventBus = new InMemoryEventBus(mockExtensionSystem);
        }
      });
      
      afterEach(() => {
        vi.clearAllMocks();
      });
      
      // Restore original method after all tests
      afterEach(() => {
        if (originalEnsureMethod) {
          ExtensionEventBus.prototype['ensureExtensionPointsInitialized'] = originalEnsureMethod;
        }
      });
      
      describe('Core Subscription Functionality', () => {
        it('should subscribe and unsubscribe to events', async () => {
          const eventType = 'test.event';
          const handler = createMockEventHandler();
          
          // Subscribe
          const subscription = eventBus.subscribe(eventType, handler);
          expect(eventBus.subscriberCount(eventType)).toBe(1);
          
          // Publish event
          const event = createTestEvent(eventType, { test: 'value' });
          await eventBus.publish(event);
          expect(handler).toHaveBeenCalledWith(event);
          
          // Unsubscribe
          subscription.unsubscribe();
          expect(eventBus.subscriberCount(eventType)).toBe(0);
          
          // Publish again - handler should not be called
          await eventBus.publish(event);
          expect(handler).toHaveBeenCalledTimes(1);
        });
        
        it('should handle multiple subscribers for the same event type', async () => {
          const eventType = 'test.event';
          const handler1 = createMockEventHandler();
          const handler2 = createMockEventHandler();
          
          // Subscribe handlers
          const subscription1 = eventBus.subscribe(eventType, handler1);
          const subscription2 = eventBus.subscribe(eventType, handler2);
          expect(eventBus.subscriberCount(eventType)).toBe(2);
          
          // Publish event
          const event = createTestEvent(eventType, { test: 'value' });
          await eventBus.publish(event);
          
          // Both handlers should be called
          expect(handler1).toHaveBeenCalledWith(event);
          expect(handler2).toHaveBeenCalledWith(event);
          
          // Unsubscribe one handler
          subscription1.unsubscribe();
          expect(eventBus.subscriberCount(eventType)).toBe(1);
          
          // Publish again - only second handler should be called
          await eventBus.publish(event);
          expect(handler1).toHaveBeenCalledTimes(1);
          expect(handler2).toHaveBeenCalledTimes(2);
        });
        
        it('should clear all subscriptions correctly', async () => {
          // Subscribe to multiple event types
          const handler1 = createMockEventHandler();
          const handler2 = createMockEventHandler();
          const handler3 = createMockEventHandler();
          
          eventBus.subscribe('event1', handler1);
          eventBus.subscribe('event2', handler2);
          eventBus.subscribe('event3', handler3);
          
          expect(eventBus.subscriberCount('event1')).toBe(1);
          expect(eventBus.subscriberCount('event2')).toBe(1);
          expect(eventBus.subscriberCount('event3')).toBe(1);
          
          // Clear one event type
          eventBus.clearSubscriptions('event1');
          expect(eventBus.subscriberCount('event1')).toBe(0);
          expect(eventBus.subscriberCount('event2')).toBe(1);
          expect(eventBus.subscriberCount('event3')).toBe(1);
          
          // Clear all subscriptions
          eventBus.clearAllSubscriptions();
          expect(eventBus.subscriberCount('event1')).toBe(0);
          expect(eventBus.subscriberCount('event2')).toBe(0);
          expect(eventBus.subscriberCount('event3')).toBe(0);
        });
      });
      
      describe('Filtered Subscriptions', () => {
        it('should apply filters correctly', async () => {
          const eventType = 'test.event';
          const handler = createMockEventHandler();
          const filter = createMockEventFilter((event: DomainEvent<any>) => 
            event.payload.pass === true
          );
          
          // Subscribe with filter
          eventBus.subscribeWithFilter(eventType, filter, handler);
          
          // Create events
          const matchingEvent = createTestEvent(eventType, { pass: true });
          const nonMatchingEvent = createTestEvent(eventType, { pass: false });
          
          // Publish both events
          await eventBus.publish(matchingEvent);
          await eventBus.publish(nonMatchingEvent);
          
          // Filter should have been called twice
          expect(filter).toHaveBeenCalledTimes(2);
          
          // Handler should only be called once, with matching event
          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith(matchingEvent);
          expect(handler).not.toHaveBeenCalledWith(nonMatchingEvent);
        });
      });
      
      describe('Once Subscriptions', () => {
        it('should call once subscriptions only once', async () => {
          const eventType = 'test.event';
          const handler = createMockEventHandler();
          
          // Subscribe with once option
          eventBus.subscribe(eventType, handler, { once: true });
          expect(eventBus.subscriberCount(eventType)).toBe(1);
          
          // Create events
          const event1 = createTestEvent(eventType, { data: 'first' });
          const event2 = createTestEvent(eventType, { data: 'second' });
          
          // Publish events
          await eventBus.publish(event1);
          await eventBus.publish(event2);
          
          // Handler should only be called once
          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith(event1);
          
          // Subscription should be automatically removed
          expect(eventBus.subscriberCount(eventType)).toBe(0);
        });
        
        it('should support once option with filtered subscriptions', async () => {
          const eventType = 'test.event';
          const handler = createMockEventHandler();
          const filter = createMockEventFilter((event: DomainEvent<any>) => 
            event.payload.pass === true
          );
          
          // Subscribe with filter and once option
          eventBus.subscribeWithFilter(eventType, filter, handler, { once: true });
          
          // Create events
          const nonMatchingEvent = createTestEvent(eventType, { pass: false });
          const matchingEvent = createTestEvent(eventType, { pass: true });
          const secondMatchingEvent = createTestEvent(eventType, { pass: true });
          
          // Publish events
          await eventBus.publish(nonMatchingEvent); // Should not match filter
          expect(eventBus.subscriberCount(eventType)).toBe(1); // Still subscribed
          
          await eventBus.publish(matchingEvent); // Should match and remove subscription
          expect(eventBus.subscriberCount(eventType)).toBe(0); // Subscription removed
          
          await eventBus.publish(secondMatchingEvent); // No more subscription
          
          // Handler should only be called once with the first matching event
          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith(matchingEvent);
        });
      });
      
      describe('Priority Ordering', () => {
        it('should execute handlers in priority order (highest first)', async () => {
          const eventType = 'test.event';
          const executionOrder: string[] = [];
          
          // Create handlers with different priorities
          const lowHandler = vi.fn().mockImplementation(async () => {
            executionOrder.push('low');
          });
          
          const mediumHandler = vi.fn().mockImplementation(async () => {
            executionOrder.push('medium');
          });
          
          const highHandler = vi.fn().mockImplementation(async () => {
            executionOrder.push('high');
          });
          
          // Subscribe with different priorities
          eventBus.subscribe(eventType, lowHandler, { priority: 1 });
          eventBus.subscribe(eventType, mediumHandler, { priority: 5 });
          eventBus.subscribe(eventType, highHandler, { priority: 10 });
          
          // Publish event
          const event = createTestEvent(eventType, { test: 'value' });
          await eventBus.publish(event);
          
          // Check execution order
          expect(executionOrder).toEqual(['high', 'medium', 'low']);
        });
      });
      
      describe('Extension Point Integration', () => {
        it('should execute extension points during event publishing', async () => {
          const eventType = 'test.event';
          const event = createTestEvent(eventType, { test: 'value' });
          const handler = createMockEventHandler();
          
          // Subscribe to event
          eventBus.subscribe(eventType, handler);
          
          // Publish event
          await eventBus.publish(event);
          
          // Handler should be called
          expect(handler).toHaveBeenCalledWith(event);
          
          // Extension points should be called
          const extensionExecute = mockExtensionSystem.executeExtensionPoint;
          expect(extensionExecute).toHaveBeenCalledTimes(2);
          
          // Check before publish call
          expect(extensionExecute).toHaveBeenNthCalledWith(
            1,
            ExtensionPointNames.EVENT_BEFORE_PUBLISH,
            {
              eventType: event.type,
              payload: event.payload
            }
          );
          
          // Check after publish call
          expect(extensionExecute).toHaveBeenNthCalledWith(
            2,
            ExtensionPointNames.EVENT_AFTER_PUBLISH,
            {
              eventId: event.id,
              eventType: event.type,
              payload: event.payload
            }
          );
        });
        
        it('should throw error if beforePublish hook fails', async () => {
          // Setup failing beforePublish hook
          const mockExtensionWithFailure = createMockExtensionSystem({
            beforePublishResult: {
              success: false,
              error: new Error('Before publish hook failed')
            }
          });
          
          // Create event bus with failing hook
          const failingEventBus = busType === 'ExtensionEventBus'
            ? new ExtensionEventBus(mockExtensionWithFailure)
            : new InMemoryEventBus(mockExtensionWithFailure);
          
          // Publish event
          const event = createTestEvent('test.event', { test: 'value' });
          await expect(failingEventBus.publish(event)).rejects
            .toThrow('Before publish hook failed');
        });
        
        it('should log warning but continue if afterPublish hook fails', async () => {
          // Spy on console.warn
          const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
          
          // Setup failing afterPublish hook
          const mockExtensionWithFailure = createMockExtensionSystem({
            afterPublishResult: {
              success: false,
              error: new Error('After publish hook failed')
            }
          });
          
          // Create event bus with failing hook
          const failingEventBus = busType === 'ExtensionEventBus'
            ? new ExtensionEventBus(mockExtensionWithFailure)
            : new InMemoryEventBus(mockExtensionWithFailure);
          
          // Publish event
          const event = createTestEvent('test.event', { test: 'value' });
          await failingEventBus.publish(event);
          
          // Check warning was logged
          expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('After publish hook failed')
          );
          
          // Restore console.warn
          warnSpy.mockRestore();
        });
      });
      
      describe('Event Routing', () => {
        it('should route events to additional channels', async () => {
          const sourceType = 'source.event';
          const targetType = 'target.event';
          const handler = createMockEventHandler();
          
          // Add router
          eventBus.addEventRouter((event) => [targetType]);
          
          // Subscribe to target channel
          eventBus.subscribe(targetType, handler);
          
          // Publish to source channel
          const event = createTestEvent(sourceType, { test: 'value' });
          await eventBus.publish(event);
          
          // Handler should be called with the event
          expect(handler).toHaveBeenCalledWith(event);
        });
        
        it('should respect priority order in routed events', async () => {
          const sourceType = 'source.event';
          const targetType = 'target.event';
          const executionOrder: string[] = [];
          
          // Add router
          eventBus.addEventRouter((event) => [targetType]);
          
          // Create handlers with different priorities
          const lowHandler = vi.fn().mockImplementation(async () => {
            executionOrder.push('low');
          });
          
          const highHandler = vi.fn().mockImplementation(async () => {
            executionOrder.push('high');
          });
          
          // Subscribe with different priorities
          eventBus.subscribe(targetType, lowHandler, { priority: 1 });
          eventBus.subscribe(targetType, highHandler, { priority: 10 });
          
          // Publish to source channel
          const event = createTestEvent(sourceType, { test: 'value' });
          await eventBus.publish(event);
          
          // Check execution order
          expect(executionOrder).toEqual(['high', 'low']);
        });
      });
      
      describe('Persistence Integration', () => {
        it('should store events when persistence is enabled', async () => {
          // Create mock event storage
          const mockStorage: EventStorage = {
            storeEvent: vi.fn().mockResolvedValue({ success: true, value: undefined }),
            getAllEvents: vi.fn(),
            getEventsByType: vi.fn(),
            getEventsByCorrelationId: vi.fn()
          };
          
          // Enable persistence
          eventBus.enablePersistence(mockStorage);
          
          // Publish event
          const event = createTestEvent('test.event', { test: 'value' });
          await eventBus.publish(event);
          
          // Check storage was called
          expect(mockStorage.storeEvent).toHaveBeenCalledWith(event);
          
          // Disable persistence
          eventBus.disablePersistence();
          
          // Publish another event
          const event2 = createTestEvent('test.event', { test: 'value2' });
          await eventBus.publish(event2);
          
          // Storage should not be called again
          expect(mockStorage.storeEvent).toHaveBeenCalledTimes(1);
        });
        
        it('should correlate events by correlation ID', async () => {
          const correlationId = 'correlation-123';
          const events = [
            createTestEvent('test.event1', { test: 'value1' }),
            createTestEvent('test.event2', { test: 'value2' })
          ];
          
          // Create mock event storage
          const mockStorage: EventStorage = {
            storeEvent: vi.fn().mockResolvedValue({ success: true, value: undefined }),
            getAllEvents: vi.fn(),
            getEventsByType: vi.fn(),
            getEventsByCorrelationId: vi.fn().mockResolvedValue({
              success: true,
              value: events
            })
          };
          
          // Enable persistence
          eventBus.enablePersistence(mockStorage);
          
          // Get correlated events
          const result = await eventBus.correlate(correlationId);
          
          // Check result
          expect(result).toEqual(events);
          expect(mockStorage.getEventsByCorrelationId).toHaveBeenCalledWith(correlationId);
        });
        
        it('should return empty array for correlation if no storage', async () => {
          // Don't enable persistence
          
          // Get correlated events
          const result = await eventBus.correlate('correlation-123');
          
          // Should return empty array
          expect(result).toEqual([]);
        });
      });
      
      describe('Backpressure Strategy', () => {
        it('should apply backpressure strategy', async () => {
          const eventType = 'test.event';
          
          // Create strategy spy functions
          const shouldAcceptSpy = vi.fn().mockReturnValue(true);
          const calculateDelaySpy = vi.fn().mockReturnValue(0);
          
          // Create strategy
          const strategy: BackpressureStrategy = {
            shouldAccept: shouldAcceptSpy,
            calculateDelay: calculateDelaySpy
          };
          
          // Apply strategy
          eventBus.applyBackpressure(eventType, strategy);
          
          // Subscribe to create some queue depth
          eventBus.subscribe(eventType, async () => {});
          eventBus.subscribe(eventType, async () => {});
          
          // Publish event
          const event = createTestEvent(eventType, { test: 'value' });
          await eventBus.publish(event);
          
          // Strategy should be called
          expect(shouldAcceptSpy).toHaveBeenCalledWith(2);
        });
        
        it('should delay publishing when shouldAccept returns false', async () => {
          const eventType = 'test.event';
          const delayMs = 50;
          let resolveDelay: Function;
          
          // Create a promise to track when setTimeout is called
          const delayPromise = new Promise<void>(resolve => {
            resolveDelay = resolve;
          });
          
          // Mock setTimeout
          const originalSetTimeout = global.setTimeout;
          const mockSetTimeout = vi.fn().mockImplementation((callback, ms) => {
            expect(ms).toBe(delayMs);
            resolveDelay();
            callback();
            return 0 as any;
          });
          
          global.setTimeout = mockSetTimeout as unknown as typeof global.setTimeout;
          
          try {
            // Create strategy
            const strategy: BackpressureStrategy = {
              shouldAccept: () => false, // Always apply backpressure
              calculateDelay: () => delayMs
            };
            
            // Apply strategy
            eventBus.applyBackpressure(eventType, strategy);
            
            // Subscribe to event
            const handler = createMockEventHandler();
            eventBus.subscribe(eventType, handler);
            
            // Publish event
            const event = createTestEvent(eventType, { test: 'value' });
            const publishPromise = eventBus.publish(event);
            
            // Wait for delay to be applied
            await delayPromise;
            
            // Complete publish
            await publishPromise;
            
            // Handler should still be called
            expect(handler).toHaveBeenCalledWith(event);
          } finally {
            // Restore setTimeout
            global.setTimeout = originalSetTimeout;
          }
        });
      });
      
      describe('Event Filtering', () => {
        it('should apply global event filters', async () => {
          const eventType = 'test.event';
          const handler = createMockEventHandler();
          
          // Subscribe to event
          eventBus.subscribe(eventType, handler);
          
          // Add global filter
          const filterSpy = vi.fn().mockImplementation(
            (event: DomainEvent<any>) => event.payload.allow !== false
          );
          eventBus.addEventFilter(filterSpy);
          
          // Create events
          const allowedEvent = createTestEvent(eventType, { allow: true });
          const disallowedEvent = createTestEvent(eventType, { allow: false });
          
          // Publish events
          await eventBus.publish(allowedEvent);
          await eventBus.publish(disallowedEvent);
          
          // Filter should be called twice
          expect(filterSpy).toHaveBeenCalledTimes(2);
          
          // Handler should only be called for allowed event
          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith(allowedEvent);
        });
        
        it('should support multiple global filters (AND logic)', async () => {
          const eventType = 'test.event';
          const handler = createMockEventHandler();
          
          // Subscribe to event
          eventBus.subscribe(eventType, handler);
          
          // Add global filters
          eventBus.addEventFilter((event) => event.payload.pass1 === true);
          eventBus.addEventFilter((event) => event.payload.pass2 === true);
          
          // Create events with different combinations
          const event1 = createTestEvent(eventType, { pass1: true, pass2: true });
          const event2 = createTestEvent(eventType, { pass1: true, pass2: false });
          const event3 = createTestEvent(eventType, { pass1: false, pass2: true });
          
          // Publish events
          await eventBus.publish(event1);
          await eventBus.publish(event2);
          await eventBus.publish(event3);
          
          // Handler should only be called for event1
          expect(handler).toHaveBeenCalledTimes(1);
          expect(handler).toHaveBeenCalledWith(event1);
        });
      });
      
      describe('Multiple Event Publishing', () => {
        it('should publish multiple events in order', async () => {
          const eventType = 'test.event';
          const receivedEvents: DomainEvent<any>[] = [];
          
          // Subscribe to event
          eventBus.subscribe(eventType, async (event) => {
            receivedEvents.push(event);
          });
          
          // Create events
          const events = [
            createTestEvent(eventType, { index: 1 }),
            createTestEvent(eventType, { index: 2 }),
            createTestEvent(eventType, { index: 3 })
          ];
          
          // Publish events
          await eventBus.publishAll(events);
          
          // Check that events were received in order
          expect(receivedEvents.length).toBe(3);
          expect(receivedEvents[0].payload.index).toBe(1);
          expect(receivedEvents[1].payload.index).toBe(2);
          expect(receivedEvents[2].payload.index).toBe(3);
        });
      });
    });
  });
}); 