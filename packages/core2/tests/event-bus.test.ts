import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Event } from '../src/models/event.js';
import { EventBus, createEventBus } from '../src/implementations/event-bus.js';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = createEventBus();
  });

  describe('subscribe and publish', () => {
    it('should allow subscribing to events', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('TEST_EVENT', handler);
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should deliver events to subscribers', () => {
      const handler = vi.fn();
      eventBus.subscribe('TEST_EVENT', handler);
      
      const payload = { data: 'test' };
      eventBus.publish('TEST_EVENT', payload);
      
      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0][0] as Event;
      expect(event.type).toBe('TEST_EVENT');
      expect(event.payload).toEqual(payload);
    });

    it('should allow unsubscribing from events', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('TEST_EVENT', handler);
      
      unsubscribe();
      eventBus.publish('TEST_EVENT', {});
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should only deliver events to matching subscribers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      eventBus.subscribe('EVENT_1', handler1);
      eventBus.subscribe('EVENT_2', handler2);
      
      eventBus.publish('EVENT_1', {});
      
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should support wildcard subscriptions', () => {
      const handler = vi.fn();
      eventBus.subscribe('*', handler);
      
      eventBus.publish('EVENT_1', { id: 1 });
      eventBus.publish('EVENT_2', { id: 2 });
      
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[0][0].type).toBe('EVENT_1');
      expect(handler.mock.calls[1][0].type).toBe('EVENT_2');
    });
  });

  describe('error handling', () => {
    it('should continue delivery even if a handler throws', () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();
      
      eventBus.subscribe('ERROR_EVENT', errorHandler);
      eventBus.subscribe('ERROR_EVENT', normalHandler);
      
      expect(() => eventBus.publish('ERROR_EVENT', {})).not.toThrow();
      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(normalHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('factory function', () => {
    it('should create a new EventBus instance', () => {
      const bus = createEventBus();
      expect(bus).toBeDefined();
    });
  });
}); 