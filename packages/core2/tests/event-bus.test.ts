import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionEventBus, createEventBus } from '../src/implementations/event-bus';
import { ExtensionSystem, ExtensionPointNames } from '../src/models/extension-system';
import { DomainEvent, Identifier } from '../src/models/core-types';
import { BackpressureStrategy } from '../src/models/backpressure';

// Disable initialization for testing
const originalEnsureExtensionPointsInitialized = ExtensionEventBus.prototype['ensureExtensionPointsInitialized'];
ExtensionEventBus.prototype['ensureExtensionPointsInitialized'] = async function() {
  // Do nothing - this will prevent the initialization call in tests
  this['extensionPointsInitialized'] = true;
};

describe('ExtensionEventBus', () => {
  let eventBus: ExtensionEventBus;
  let mockExtensionSystem: ExtensionSystem;

  beforeEach(() => {
    // Reset the mock
    vi.clearAllMocks();

    mockExtensionSystem = {
      registerExtension: vi.fn(),
      unregisterExtension: vi.fn(),
      getExtensions: vi.fn().mockReturnValue([]),
      executeExtensionPoint: vi.fn(),
      getExtension: vi.fn(),
      hasExtension: vi.fn()
    };

    eventBus = new ExtensionEventBus(mockExtensionSystem);
  });

  afterAll(() => {
    // Restore original method
    ExtensionEventBus.prototype['ensureExtensionPointsInitialized'] = originalEnsureExtensionPointsInitialized;
  });

  describe('Core Event Bus Functionality', () => {
    it('should publish and subscribe to events', async () => {
      const eventType = 'test.event';
      const handler = vi.fn();
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: eventType,
        timestamp: Date.now(),
        payload: { test: 'value' }
      };

      // Mock extension system responses for before and after publish
      (mockExtensionSystem.executeExtensionPoint as jest.Mock)
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined });

      // Subscribe to events
      const subscription = eventBus.subscribe(eventType, handler);
      expect(eventBus.subscriberCount(eventType)).toBe(1);

      // Publish event
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
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: eventType,
        timestamp: Date.now(),
        payload: { test: 'value' }
      };

      // Mock extension system responses for each publish (2 times)
      (mockExtensionSystem.executeExtensionPoint as jest.Mock)
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined });

      // Subscribe two handlers
      const subscription1 = eventBus.subscribe(eventType, handler1);
      const subscription2 = eventBus.subscribe(eventType, handler2);
      expect(eventBus.subscriberCount(eventType)).toBe(2);

      // Publish event
      await eventBus.publish(event);
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
  });

  describe('Extension Point Integration', () => {
    it('should execute before and after publish hooks', async () => {
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { test: 'value' }
      };

      // Mock extension system responses
      (mockExtensionSystem.executeExtensionPoint as jest.Mock)
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined });

      await eventBus.publish(event);

      // Expect exactly 2 calls (before and after)
      expect(mockExtensionSystem.executeExtensionPoint).toHaveBeenCalledTimes(2);
      
      // First call should be for before publish
      expect(mockExtensionSystem.executeExtensionPoint).toHaveBeenNthCalledWith(
        1,
        ExtensionPointNames.EVENT_BEFORE_PUBLISH,
        {
          eventType: event.type,
          payload: event.payload
        }
      );
      
      // Second call should be for after publish
      expect(mockExtensionSystem.executeExtensionPoint).toHaveBeenNthCalledWith(
        2,
        ExtensionPointNames.EVENT_AFTER_PUBLISH,
        {
          eventId: event.id,
          eventType: event.type,
          payload: event.payload
        }
      );
    });

    it('should handle hook failures gracefully', async () => {
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { test: 'value' }
      };

      // Mock extension system to fail on before publish
      (mockExtensionSystem.executeExtensionPoint as jest.Mock)
        .mockResolvedValueOnce({ 
          success: false, 
          error: new Error('Hook failed') 
        });

      await expect(eventBus.publish(event)).rejects.toThrow('Hook failed');
    });
  });

  describe('Event Filtering and Routing', () => {
    it('should handle filtered subscriptions', async () => {
      const eventType = 'test.event';
      const handler = vi.fn();
      const filter = (event: DomainEvent<{ test: string }>) => event.payload.test === 'value';
      
      // Mock extension system responses for each publish (2 times)
      (mockExtensionSystem.executeExtensionPoint as jest.Mock)
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined });
      
      const event1: DomainEvent<{ test: string }> = {
        id: 'test-event-1',
        type: eventType,
        timestamp: Date.now(),
        payload: { test: 'value' }
      };

      const event2: DomainEvent<{ test: string }> = {
        id: 'test-event-2',
        type: eventType,
        timestamp: Date.now(),
        payload: { test: 'other' }
      };

      // Subscribe with filter
      eventBus.subscribeWithFilter(eventType, filter, handler);

      // Publish events
      await eventBus.publish(event1);
      await eventBus.publish(event2);

      // Handler should only be called for matching events
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event1);
    });

    it('should route events to additional channels', async () => {
      const sourceType = 'source.event';
      const targetType = 'target.event';
      const handler = vi.fn();
      
      // Mock extension system responses
      (mockExtensionSystem.executeExtensionPoint as jest.Mock)
        .mockResolvedValueOnce({ success: true, value: undefined })
        .mockResolvedValueOnce({ success: true, value: undefined });
      
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: sourceType,
        timestamp: Date.now(),
        payload: { test: 'value' }
      };

      // Add event router
      eventBus.addEventRouter((event) => [targetType]);

      // Subscribe to target channel
      eventBus.subscribe(targetType, handler);

      // Publish event
      await eventBus.publish(event);

      // Handler should be called with the event
      expect(handler).toHaveBeenCalledWith(event);
    });
  });

  describe('Backpressure Handling', () => {
    it('should apply backpressure strategy', async () => {
      const eventType = 'test.event';
      const strategy: BackpressureStrategy = {
        shouldAccept: (queueDepth: number) => queueDepth < 10,
        calculateDelay: () => 100
      };

      eventBus.applyBackpressure(eventType, strategy);
      // Note: Actual backpressure behavior is tested in the implementation tests
    });
  });
}); 