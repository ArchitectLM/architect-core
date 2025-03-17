/**
 * Tests for the DeadLetterQueue implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeadLetterQueue } from '../src/implementations/dead-letter-queue.js';
import { ReactiveEventBus } from '../src/implementations/event-bus.js';
import { Event } from '../src/models/index.js';

describe('DeadLetterQueue', () => {
  let eventBus: ReactiveEventBus;
  let deadLetterQueue: DeadLetterQueue;

  beforeEach(() => {
    eventBus = new ReactiveEventBus();
    deadLetterQueue = new DeadLetterQueue(eventBus);
  });

  describe('GIVEN a dead letter queue', () => {
    describe('WHEN an event fails processing', () => {
      it('THEN the event should be added to the queue', () => {
        // Given an event
        const event: Event = {
          type: 'test-event',
          payload: { data: 'test' },
          timestamp: Date.now()
        };

        // When adding the event to the DLQ with an error
        const error = new Error('Processing failed');
        deadLetterQueue.addFailedEvent(event, error);

        // Then the event should be in the queue
        const queuedEvents = deadLetterQueue.getQueuedEvents();
        expect(queuedEvents).toHaveLength(1);
        expect(queuedEvents[0].event).toEqual(event);
        expect(queuedEvents[0].error).toEqual(error);
      });
    });

    describe('WHEN retrieving queued events', () => {
      it('THEN should return all queued events', () => {
        // Given multiple failed events
        const event1: Event = {
          type: 'event-1',
          payload: { data: '1' },
          timestamp: Date.now()
        };
        const event2: Event = {
          type: 'event-2',
          payload: { data: '2' },
          timestamp: Date.now()
        };

        // When adding them to the DLQ
        deadLetterQueue.addFailedEvent(event1, new Error('Error 1'));
        deadLetterQueue.addFailedEvent(event2, new Error('Error 2'));

        // Then both events should be in the queue
        const queuedEvents = deadLetterQueue.getQueuedEvents();
        expect(queuedEvents).toHaveLength(2);
        expect(queuedEvents[0].event.type).toBe('event-1');
        expect(queuedEvents[1].event.type).toBe('event-2');
      });
    });

    describe('WHEN replaying a specific event', () => {
      it('THEN the event should be republished and removed from the queue', async () => {
        // Given a failed event
        const event: Event = {
          type: 'test-event',
          payload: { data: 'test' },
          timestamp: Date.now()
        };
        deadLetterQueue.addFailedEvent(event, new Error('Processing failed'));

        // And a spy on the event bus publish method
        const publishSpy = vi.spyOn(eventBus, 'publish');

        // When replaying the event
        await deadLetterQueue.replayEvent(0);

        // Then the event should be republished
        expect(publishSpy).toHaveBeenCalledWith(event.type, event.payload);

        // And removed from the queue
        const queuedEvents = deadLetterQueue.getQueuedEvents();
        expect(queuedEvents).toHaveLength(0);
      });

      it('THEN should throw an error for invalid index', async () => {
        // When trying to replay an event with an invalid index
        // Then it should throw an error
        await expect(deadLetterQueue.replayEvent(999)).rejects.toThrow('Invalid event index');
      });
    });

    describe('WHEN replaying all events', () => {
      it('THEN all events should be republished and the queue cleared', async () => {
        // Given multiple failed events
        const event1: Event = {
          type: 'event-1',
          payload: { data: '1' },
          timestamp: Date.now()
        };
        const event2: Event = {
          type: 'event-2',
          payload: { data: '2' },
          timestamp: Date.now()
        };
        deadLetterQueue.addFailedEvent(event1, new Error('Error 1'));
        deadLetterQueue.addFailedEvent(event2, new Error('Error 2'));

        // And a spy on the event bus publish method
        const publishSpy = vi.spyOn(eventBus, 'publish');

        // When replaying all events
        await deadLetterQueue.replayAllEvents();

        // Then all events should be republished
        expect(publishSpy).toHaveBeenCalledTimes(2);
        expect(publishSpy).toHaveBeenCalledWith(event1.type, event1.payload);
        expect(publishSpy).toHaveBeenCalledWith(event2.type, event2.payload);

        // And the queue should be empty
        const queuedEvents = deadLetterQueue.getQueuedEvents();
        expect(queuedEvents).toHaveLength(0);
      });
    });

    describe('WHEN clearing the queue', () => {
      it('THEN all events should be removed', () => {
        // Given multiple failed events
        const event1: Event = {
          type: 'event-1',
          payload: { data: '1' },
          timestamp: Date.now()
        };
        const event2: Event = {
          type: 'event-2',
          payload: { data: '2' },
          timestamp: Date.now()
        };
        deadLetterQueue.addFailedEvent(event1, new Error('Error 1'));
        deadLetterQueue.addFailedEvent(event2, new Error('Error 2'));

        // When clearing the queue
        deadLetterQueue.clearQueue();

        // Then the queue should be empty
        const queuedEvents = deadLetterQueue.getQueuedEvents();
        expect(queuedEvents).toHaveLength(0);
      });
    });

    describe('WHEN setting up event interception', () => {
      it('THEN failed events should be automatically added to the queue', () => {
        // Given a handler that throws an error
        const errorHandler = vi.fn().mockImplementation(() => {
          throw new Error('Handler error');
        });

        // When subscribing to an event with error interception
        deadLetterQueue.subscribeWithDLQ('test-event', errorHandler);

        // And publishing an event that will fail processing
        const event = {
          type: 'test-event',
          payload: { data: 'test' }
        };
        eventBus.publish(event.type, event.payload);

        // Then the handler should have been called
        expect(errorHandler).toHaveBeenCalled();

        // And the event should be in the DLQ
        const queuedEvents = deadLetterQueue.getQueuedEvents();
        expect(queuedEvents).toHaveLength(1);
        expect(queuedEvents[0].event.type).toBe('test-event');
        expect(queuedEvents[0].error).toBeInstanceOf(Error);
        expect(queuedEvents[0].error.message).toBe('Handler error');
      });
    });
  });
}); 