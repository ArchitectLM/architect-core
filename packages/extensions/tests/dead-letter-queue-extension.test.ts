/**
 * Dead Letter Queue Extension Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeadLetterQueueExtension } from '../src/extensions/dead-letter-queue.js';
import { Event } from '../src/models.js';

describe('DeadLetterQueueExtension', () => {
  let extension: DeadLetterQueueExtension;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    extension = new DeadLetterQueueExtension();
    mockHandler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('Event Handling', () => {
    it('should store failed events in the queue', async () => {
      const event = { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() };
      const error = new Error('Test error');

      // Simulate event processing failure
      await extension.hooks['event-bus:error']({ event, error });

      const queuedEvents = extension.getQueuedEvents();
      expect(queuedEvents).toHaveLength(1);
      expect(queuedEvents[0].event).toEqual(event);
      expect(queuedEvents[0].error).toEqual(error);
      expect(queuedEvents[0].retryCount).toBe(0);
    });

    it('should increment retry count on subsequent failures', async () => {
      const event = { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() };
      const error = new Error('Test error');

      // Simulate multiple failures
      await extension.hooks['event-bus:error']({ event, error });
      await extension.hooks['event-bus:error']({ event, error });

      const queuedEvents = extension.getQueuedEvents();
      expect(queuedEvents).toHaveLength(2);
      expect(queuedEvents[1].retryCount).toBe(1);
    });
  });

  describe('Event Replay', () => {
    it('should replay a specific event from the queue', async () => {
      const event = { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() };
      const error = new Error('Test error');

      // Add event to queue
      await extension.hooks['event-bus:error']({ event, error });

      // Replay the event
      await extension.replayEvent(0);

      const queuedEvents = extension.getQueuedEvents();
      expect(queuedEvents).toHaveLength(0);
    });

    it('should replay all events from the queue', async () => {
      const events = [
        { type: 'test-event1', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { data: 2 }, timestamp: Date.now() + 100 }
      ];
      const error = new Error('Test error');

      // Add events to queue
      await extension.hooks['event-bus:error']({ event: events[0], error });
      await extension.hooks['event-bus:error']({ event: events[1], error });

      // Replay all events
      await extension.replayAllEvents();

      const queuedEvents = extension.getQueuedEvents();
      expect(queuedEvents).toHaveLength(0);
    });

    it('should throw error when replaying invalid event index', async () => {
      await expect(extension.replayEvent(0)).rejects.toThrow('Invalid event index');
    });
  });

  describe('Queue Management', () => {
    it('should clear the queue', async () => {
      const event = { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() };
      const error = new Error('Test error');

      // Add event to queue
      await extension.hooks['event-bus:error']({ event, error });

      // Clear queue
      extension.clearQueue();

      const queuedEvents = extension.getQueuedEvents();
      expect(queuedEvents).toHaveLength(0);
    });

    it('should get all queued events', async () => {
      const events = [
        { type: 'test-event1', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { data: 2 }, timestamp: Date.now() + 100 }
      ];
      const error = new Error('Test error');

      // Add events to queue
      await extension.hooks['event-bus:error']({ event: events[0], error });
      await extension.hooks['event-bus:error']({ event: events[1], error });

      const queuedEvents = extension.getQueuedEvents();
      expect(queuedEvents).toHaveLength(2);
      expect(queuedEvents.map(e => e.event)).toEqual(events);
    });
  });

  describe('Event Bus Integration', () => {
    it('should subscribe to events with DLQ error handling', async () => {
      const event = { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() };
      const error = new Error('Test error');

      // Subscribe with DLQ error handling
      const unsubscribe = extension.subscribeWithDLQ('test-event', () => {
        throw error;
      });

      // Process event
      await extension.hooks['event-bus:publish']({ eventType: 'test-event', event });

      const queuedEvents = extension.getQueuedEvents();
      expect(queuedEvents).toHaveLength(1);
      expect(queuedEvents[0].event).toEqual(event);
      expect(queuedEvents[0].error).toEqual(error);

      unsubscribe();
    });

    it('should not store events when handler succeeds', async () => {
      const event = { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() };

      // Subscribe with DLQ error handling
      const unsubscribe = extension.subscribeWithDLQ('test-event', () => {
        // Success - no error thrown
      });

      // Process event
      await extension.hooks['event-bus:publish']({ eventType: 'test-event', event });

      const queuedEvents = extension.getQueuedEvents();
      expect(queuedEvents).toHaveLength(0);

      unsubscribe();
    });
  });
}); 