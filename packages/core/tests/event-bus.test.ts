/**
 * Tests for the ReactiveEventBus implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { filter, map, firstValueFrom, take } from 'rxjs';
import { ReactiveEventBus } from '../src/implementations/event-bus.js';
import { Event } from '../src/models/index.js';

describe('ReactiveEventBus', () => {
  let eventBus: ReactiveEventBus;

  beforeEach(() => {
    eventBus = new ReactiveEventBus();
  });

  describe('Basic Functionality', () => {
    it('should publish and subscribe to events', async () => {
      // Given a subscriber
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('test-event', handler);

      // When publishing an event
      const payload = { message: 'Hello' };
      eventBus.publish('test-event', payload);

      // Then the handler should be called with the event
      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].type).toBe('test-event');
      expect(handler.mock.calls[0][0].payload).toEqual(payload);

      // Cleanup
      unsubscribe();
    });

    it('should not receive events of different types', async () => {
      // Given a subscriber for a specific event type
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('test-event', handler);

      // When publishing a different event type
      const payload = { message: 'Hello' };
      eventBus.publish('other-event', payload);

      // Then the handler should not be called
      expect(handler).not.toHaveBeenCalled();

      // Cleanup
      unsubscribe();
    });

    it('should allow unsubscribing from events', async () => {
      // Given a subscriber that unsubscribes
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('test-event', handler);
      unsubscribe();

      // When publishing an event
      const payload = { message: 'Hello' };
      eventBus.publish('test-event', payload);

      // Then the handler should not be called
      expect(handler).not.toHaveBeenCalled();
    });

    it('should support wildcard subscriptions', async () => {
      // Given a wildcard subscriber
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe('*', handler);

      // When publishing events of different types
      const payload1 = { message: 'Hello 1' };
      const payload2 = { message: 'Hello 2' };
      eventBus.publish('test-event-1', payload1);
      eventBus.publish('test-event-2', payload2);

      // Then the handler should be called for both events
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler.mock.calls[0][0].type).toBe('test-event-1');
      expect(handler.mock.calls[0][0].payload).toEqual(payload1);
      expect(handler.mock.calls[1][0].type).toBe('test-event-2');
      expect(handler.mock.calls[1][0].payload).toEqual(payload2);

      // Cleanup
      unsubscribe();
    });
  });

  describe('Observable Streams', () => {
    it('should create observable streams for events', async () => {
      // Given an observable for a specific event type
      const results: number[] = [];
      const observable = eventBus.observe('number-event');

      // When subscribing to the observable
      const subscription = observable.subscribe(event => {
        results.push(event.payload.value);
      });

      // And publishing events
      eventBus.publish('number-event', { value: 1 });
      eventBus.publish('number-event', { value: 2 });
      eventBus.publish('number-event', { value: 3 });

      // Then the subscriber should receive all events
      expect(results).toEqual([1, 2, 3]);

      // Cleanup
      subscription.unsubscribe();
    });

    it('should allow operators to be piped into event streams', async () => {
      // Given an observable with operators
      const results: number[] = [];

      // When using pipe to transform events
      const subscription = eventBus
        .observe('number-event')
        .pipe(
          map(event => event.payload.value * 2),
          take(3)
        )
        .subscribe(value => {
          results.push(value);
        });

      // And publishing events
      eventBus.publish('number-event', { value: 1 });
      eventBus.publish('number-event', { value: 2 });
      eventBus.publish('number-event', { value: 3 });
      eventBus.publish('number-event', { value: 4 }); // Should be ignored due to take(3)

      // Then the subscriber should receive transformed events
      expect(results).toEqual([2, 4, 6]);

      // Cleanup
      subscription.unsubscribe();
    });

    it('should observe just the payload of events', async () => {
      // Given an observable for payloads
      const results: any[] = [];
      const observable = eventBus.observePayload('data-event');

      // When subscribing to the observable
      const subscription = observable.subscribe(payload => {
        results.push(payload);
      });

      // And publishing events
      eventBus.publish('data-event', { id: 1, name: 'Item 1' });
      eventBus.publish('data-event', { id: 2, name: 'Item 2' });

      // Then the subscriber should receive just the payloads
      expect(results).toEqual([
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]);

      // Cleanup
      subscription.unsubscribe();
    });
  });

  describe('Error Handling', () => {
    it('should continue processing events even if a handler throws an error', async () => {
      // Given a handler that throws an error
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler error');
      });

      // And a normal handler
      const normalHandler = vi.fn();

      // When subscribing both handlers
      const unsubscribe1 = eventBus.subscribe('test-event', errorHandler);
      const unsubscribe2 = eventBus.subscribe('test-event', normalHandler);

      // Spy on console.error to prevent actual error output during tests
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // When publishing an event
      const payload = { message: 'Hello' };

      // Then it should not throw and the normal handler should still be called
      expect(() => {
        eventBus.publish('test-event', payload);
      }).not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Cleanup
      unsubscribe1();
      unsubscribe2();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Performance', () => {
    it('should handle a high volume of events', async () => {
      // Given a counter for received events
      let count = 0;
      const unsubscribe = eventBus.subscribe('perf-event', () => {
        count++;
      });

      // When publishing many events
      const NUM_EVENTS = 1000;
      for (let i = 0; i < NUM_EVENTS; i++) {
        eventBus.publish('perf-event', { index: i });
      }

      // Then all events should be processed
      expect(count).toBe(NUM_EVENTS);

      // Cleanup
      unsubscribe();
    });
  });
});
