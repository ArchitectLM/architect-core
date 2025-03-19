/**
 * Event Bus Extension Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBusExtension } from '../src/extensions/event-bus.js';
import { Event } from '../src/models.js';

describe('EventBusExtension', () => {
  let extension: EventBusExtension;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    extension = new EventBusExtension();
    mockHandler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Publishing', () => {
    it('should publish event to all subscribers', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      extension.subscribe('test-event', mockHandler);
      await extension.publish(event);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(event);
    });

    it('should publish event to wildcard subscribers', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      extension.subscribe('*', mockHandler);
      await extension.publish(event);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(event);
    });

    it('should not publish to unsubscribed handlers', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      extension.subscribe('other-event', mockHandler);
      await extension.publish(event);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Event Subscription', () => {
    it('should allow multiple subscribers for same event type', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      const handler2 = vi.fn();
      extension.subscribe('test-event', mockHandler);
      extension.subscribe('test-event', handler2);
      await extension.publish(event);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should allow unsubscribing from events', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      const unsubscribe = extension.subscribe('test-event', mockHandler);
      unsubscribe();
      await extension.publish(event);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should handle subscription errors gracefully', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      const error = new Error('Handler error');
      mockHandler.mockRejectedValueOnce(error);
      extension.subscribe('test-event', mockHandler);

      await expect(extension.publish(event)).resolves.not.toThrow();
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Observation', () => {
    it('should observe events with type filter', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      const observer = vi.fn();
      extension.observe('test-event').subscribe(observer);
      await extension.publish(event);

      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(event);
    });

    it('should observe events with wildcard filter', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      const observer = vi.fn();
      extension.observe('*').subscribe(observer);
      await extension.publish(event);

      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(event);
    });

    it('should observe event payloads', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      const observer = vi.fn();
      extension.observePayload('test-event').subscribe(observer);
      await extension.publish(event);

      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(event.payload);
    });
  });

  describe('Event Stream Operations', () => {
    it('should pipe events through operators', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 }
      ];

      const observer = vi.fn();
      extension
        .observe('test-event')
        .pipe(
          (source) => source.filter(event => event.payload.data > 1)
        )
        .subscribe(observer);

      await extension.publish(events[0]);
      await extension.publish(events[1]);

      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(events[1]);
    });

    it('should handle multiple operators in pipe', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 },
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 200 }
      ];

      const observer = vi.fn();
      extension
        .observe('test-event')
        .pipe(
          (source) => source.filter(event => event.payload.data > 1),
          (source) => source.map(event => ({
            ...event,
            payload: { data: event.payload.data * 2 }
          }))
        )
        .subscribe(observer);

      await extension.publish(events[0]);
      await extension.publish(events[1]);
      await extension.publish(events[2]);

      expect(observer).toHaveBeenCalledTimes(2);
      expect(observer).toHaveBeenCalledWith({
        ...events[1],
        payload: { data: 4 }
      });
      expect(observer).toHaveBeenCalledWith({
        ...events[2],
        payload: { data: 6 }
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle publishing errors', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      const error = new Error('Publish error');
      extension.subscribe('test-event', () => {
        throw error;
      });

      await expect(extension.publish(event)).rejects.toThrow(error);
    });

    it('should handle subscription errors', async () => {
      const event: Event = {
        type: 'test-event',
        payload: { data: 1 },
        timestamp: Date.now()
      };

      const error = new Error('Subscription error');
      const observer = vi.fn().mockRejectedValueOnce(error);
      extension.observe('test-event').subscribe(observer);

      await expect(extension.publish(event)).resolves.not.toThrow();
      expect(observer).toHaveBeenCalledTimes(1);
    });
  });
}); 