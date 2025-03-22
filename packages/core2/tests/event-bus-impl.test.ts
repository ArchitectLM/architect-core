import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { InMemoryEventBus } from '../src/implementations/event-bus';
import { DomainEvent, EventHandler } from '../src/models/index';

// Helper to create test events
function createTestEvent<T>(type: string, payload: T): DomainEvent<T> {
  return {
    id: uuidv4(),
    type,
    timestamp: Date.now(),
    payload
  };
}

describe('InMemoryEventBus', () => {
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
  });

  describe('Given an event bus with no subscriptions', () => {
    it('should have zero subscribers for any event type', () => {
      expect(eventBus.subscriberCount('test-event')).toBe(0);
    });

    describe('when an event is published', () => {
      it('should not throw an error', async () => {
        const event = createTestEvent('test-event', { data: 'test' });
        await expect(eventBus.publish(event)).resolves.toBeUndefined();
      });
    });
  });

  describe('Given an event bus with a subscription', () => {
    let handlerSpy: EventHandler<unknown>;
    let subscription: { unsubscribe: () => void };

    beforeEach(() => {
      handlerSpy = vi.fn().mockResolvedValue(undefined);
      subscription = eventBus.subscribe('test-event', handlerSpy);
    });

    it('should have one subscriber for the event type', () => {
      expect(eventBus.subscriberCount('test-event')).toBe(1);
    });

    describe('when a matching event is published', () => {
      it('should call the handler with the event', async () => {
        const event = createTestEvent('test-event', { data: 'test' });
        await eventBus.publish(event);
        expect(handlerSpy).toHaveBeenCalledWith(event);
      });
    });

    describe('when a non-matching event is published', () => {
      it('should not call the handler', async () => {
        const event = createTestEvent('other-event', { data: 'test' });
        await eventBus.publish(event);
        expect(handlerSpy).not.toHaveBeenCalled();
      });
    });

    describe('when the subscription is cancelled', () => {
      beforeEach(() => {
        subscription.unsubscribe();
      });

      it('should have zero subscribers for the event type', () => {
        expect(eventBus.subscriberCount('test-event')).toBe(0);
      });

      describe('when a matching event is published', () => {
        it('should not call the handler', async () => {
          const event = createTestEvent('test-event', { data: 'test' });
          await eventBus.publish(event);
          expect(handlerSpy).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('Given an event bus with a filtered subscription', () => {
    let handlerSpy: EventHandler<any>;
    let filter: (event: DomainEvent<any>) => boolean;

    beforeEach(() => {
      handlerSpy = vi.fn().mockResolvedValue(undefined);
      // Only pass events with even data values
      filter = (event) => typeof event.payload.data === 'number' && event.payload.data % 2 === 0;
      eventBus.subscribeWithFilter('test-event', filter, handlerSpy);
    });

    describe('when a matching event that passes the filter is published', () => {
      it('should call the handler', async () => {
        const event = createTestEvent('test-event', { data: 2 });
        await eventBus.publish(event);
        expect(handlerSpy).toHaveBeenCalledWith(event);
      });
    });

    describe('when a matching event that does not pass the filter is published', () => {
      it('should not call the handler', async () => {
        const event = createTestEvent('test-event', { data: 1 });
        await eventBus.publish(event);
        expect(handlerSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given an event bus with a once subscription', () => {
    let handlerSpy: EventHandler<unknown>;

    beforeEach(() => {
      handlerSpy = vi.fn().mockResolvedValue(undefined);
      eventBus.subscribe('test-event', handlerSpy, { once: true });
    });

    describe('when a matching event is published twice', () => {
      it('should call the handler only once', async () => {
        const event1 = createTestEvent('test-event', { data: 'test1' });
        const event2 = createTestEvent('test-event', { data: 'test2' });
        
        await eventBus.publish(event1);
        expect(handlerSpy).toHaveBeenCalledWith(event1);
        expect(handlerSpy).toHaveBeenCalledTimes(1);
        
        await eventBus.publish(event2);
        expect(handlerSpy).not.toHaveBeenCalledWith(event2);
        expect(handlerSpy).toHaveBeenCalledTimes(1);
      });

      it('should have zero subscribers after the first event', async () => {
        const event = createTestEvent('test-event', { data: 'test' });
        await eventBus.publish(event);
        expect(eventBus.subscriberCount('test-event')).toBe(0);
      });
    });
  });

  describe('Given an event bus with priority subscriptions', () => {
    let firstHandlerSpy: EventHandler<unknown>;
    let secondHandlerSpy: EventHandler<unknown>;
    let thirdHandlerSpy: EventHandler<unknown>;
    
    // Track the execution order
    let executionOrder: number[];

    beforeEach(() => {
      executionOrder = [];

      firstHandlerSpy = vi.fn().mockImplementation(async () => {
        executionOrder.push(1);
      });
      
      secondHandlerSpy = vi.fn().mockImplementation(async () => {
        executionOrder.push(2);
      });
      
      thirdHandlerSpy = vi.fn().mockImplementation(async () => {
        executionOrder.push(3);
      });
      
      // Register with different priorities (higher executed first)
      eventBus.subscribe('test-event', secondHandlerSpy, { priority: 5 });
      eventBus.subscribe('test-event', thirdHandlerSpy, { priority: 1 });
      eventBus.subscribe('test-event', firstHandlerSpy, { priority: 10 });
    });

    describe('when an event is published', () => {
      it('should call the handlers in priority order (highest first)', async () => {
        const event = createTestEvent('test-event', { data: 'test' });
        await eventBus.publish(event);
        
        expect(firstHandlerSpy).toHaveBeenCalled();
        expect(secondHandlerSpy).toHaveBeenCalled();
        expect(thirdHandlerSpy).toHaveBeenCalled();
        
        // Should be in order of priority: first (10), second (5), third (1)
        expect(executionOrder).toEqual([1, 2, 3]);
      });
    });
  });

  describe('Given an event bus with multiple subscriptions', () => {
    let handlerSpy1: EventHandler<unknown>;
    let handlerSpy2: EventHandler<unknown>;

    beforeEach(() => {
      handlerSpy1 = vi.fn().mockResolvedValue(undefined);
      handlerSpy2 = vi.fn().mockResolvedValue(undefined);
      eventBus.subscribe('event-type-1', handlerSpy1);
      eventBus.subscribe('event-type-2', handlerSpy2);
    });

    describe('when clearSubscriptions is called for one event type', () => {
      beforeEach(() => {
        eventBus.clearSubscriptions('event-type-1');
      });

      it('should remove all subscriptions for that event type', () => {
        expect(eventBus.subscriberCount('event-type-1')).toBe(0);
        expect(eventBus.subscriberCount('event-type-2')).toBe(1);
      });
    });

    describe('when clearAllSubscriptions is called', () => {
      beforeEach(() => {
        eventBus.clearAllSubscriptions();
      });

      it('should remove all subscriptions for all event types', () => {
        expect(eventBus.subscriberCount('event-type-1')).toBe(0);
        expect(eventBus.subscriberCount('event-type-2')).toBe(0);
      });
    });
  });
}); 