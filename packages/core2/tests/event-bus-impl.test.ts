import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { InMemoryEventBus } from '../src/implementations/event-bus-impl';
import { DomainEvent } from '../src/models/core-types';
import { EventHandler } from '../src/models/event-system';

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
    let eventHandler: any;
    let subscription: any;

    beforeEach(() => {
      eventHandler = vi.fn();
      subscription = eventBus.subscribe('test-event', eventHandler);
    });

    it('should have one subscriber for the event type', () => {
      expect(eventBus.subscriberCount('test-event')).toBe(1);
    });

    describe('when a matching event is published', () => {
      it('should call the handler with the event', async () => {
        const event = createTestEvent('test-event', { data: 'test' });
        await eventBus.publish(event);
        expect(eventHandler).toHaveBeenCalledWith(event);
      });
    });

    describe('when a non-matching event is published', () => {
      it('should not call the handler', async () => {
        const event = createTestEvent('other-event', { data: 'test' });
        await eventBus.publish(event);
        expect(eventHandler).not.toHaveBeenCalled();
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
          expect(eventHandler).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('Given an event bus with a filtered subscription', () => {
    let eventHandler: any;
    let eventFilter: any;

    beforeEach(() => {
      eventHandler = vi.fn();
      eventFilter = (event: DomainEvent<any>) => event.payload.data === 'pass';
      eventBus.subscribeWithFilter('test-event', eventFilter, eventHandler);
    });

    describe('when a matching event that passes the filter is published', () => {
      it('should call the handler', async () => {
        const event = createTestEvent('test-event', { data: 'pass' });
        await eventBus.publish(event);
        expect(eventHandler).toHaveBeenCalledWith(event);
      });
    });

    describe('when a matching event that does not pass the filter is published', () => {
      it('should not call the handler', async () => {
        const event = createTestEvent('test-event', { data: 'fail' });
        await eventBus.publish(event);
        expect(eventHandler).not.toHaveBeenCalled();
      });
    });
  });

  describe('Given an event bus with a once subscription', () => {
    let eventHandler: any;

    beforeEach(() => {
      eventHandler = vi.fn();
      eventBus.subscribe('test-event', eventHandler, {
        once: true
      });
    });

    describe('when a matching event is published twice', () => {
      beforeEach(async () => {
        const event1 = createTestEvent('test-event', { data: 'first' });
        const event2 = createTestEvent('test-event', { data: 'second' });
        await eventBus.publish(event1);
        await eventBus.publish(event2);
      });

      it('should call the handler only once', () => {
        expect(eventHandler).toHaveBeenCalledTimes(1);
        expect(eventHandler.mock.calls[0][0].payload.data).toBe('first');
      });

      it('should have zero subscribers after the first event', () => {
        expect(eventBus.subscriberCount('test-event')).toBe(0);
      });
    });
  });

  describe('Given an event bus with priority subscriptions', () => {
    let order: string[];
    
    beforeEach(() => {
      order = [];
      
      eventBus.subscribe('test-event', async () => {
        order.push('low');
      }, { priority: 1 });
      
      eventBus.subscribe('test-event', async () => {
        order.push('medium');
      }, { priority: 5 });
      
      eventBus.subscribe('test-event', async () => {
        order.push('high');
      }, { priority: 10 });
    });

    describe('when an event is published', () => {
      it('should call the handlers in priority order (highest first)', async () => {
        const event = createTestEvent('test-event', { data: 'test' });
        await eventBus.publish(event);
        expect(order).toEqual(['high', 'medium', 'low']);
      });
    });
  });

  describe('Given an event bus with multiple subscriptions', () => {
    let handler1: any;
    let handler2: any;
    let handler3: any;
    
    beforeEach(() => {
      handler1 = vi.fn();
      handler2 = vi.fn();
      handler3 = vi.fn();
      
      eventBus.subscribe('event1', handler1);
      eventBus.subscribe('event2', handler2);
      eventBus.subscribe('event3', handler3);
    });

    describe('when clearSubscriptions is called for one event type', () => {
      it('should remove all subscriptions for that event type', () => {
        eventBus.clearSubscriptions('event1');
        
        expect(eventBus.subscriberCount('event1')).toBe(0);
        expect(eventBus.subscriberCount('event2')).toBe(1);
        expect(eventBus.subscriberCount('event3')).toBe(1);
      });
    });

    describe('when clearAllSubscriptions is called', () => {
      it('should remove all subscriptions for all event types', () => {
        eventBus.clearAllSubscriptions();
        
        expect(eventBus.subscriberCount('event1')).toBe(0);
        expect(eventBus.subscriberCount('event2')).toBe(0);
        expect(eventBus.subscriberCount('event3')).toBe(0);
      });
    });
  });
}); 