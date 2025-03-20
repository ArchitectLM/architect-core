/**
 * Event Correlation Extension Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventCorrelationExtension } from '../src/extensions/event-correlation.js';
import { Event } from '../src/models.js';

describe('EventCorrelationExtension', () => {
  let extension: EventCorrelationExtension;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    extension = new EventCorrelationExtension({
      correlationTimeout: 1000,
      maxCorrelationSize: 10
    });
    mockHandler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('Correlation by Key', () => {
    it('should correlate events with matching keys', async () => {
      const events: Event[] = [
        { type: 'test-event1', payload: { key: '123', data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { key: '123', data: 2 }, timestamp: Date.now() + 100 }
      ];

      extension.correlateByKey('test-event1', 'test-event2', 'key', mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(events);
    });

    it('should not correlate events with different keys', async () => {
      const events: Event[] = [
        { type: 'test-event1', payload: { key: '123', data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { key: '456', data: 2 }, timestamp: Date.now() + 100 }
      ];

      extension.correlateByKey('test-event1', 'test-event2', 'key', mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should not correlate events outside timeout', async () => {
      const events: Event[] = [
        { type: 'test-event1', payload: { key: '123', data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { key: '123', data: 2 }, timestamp: Date.now() + 2000 }
      ];

      extension.correlateByKey('test-event1', 'test-event2', 'key', mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Correlation by Custom Matcher', () => {
    it('should correlate events matching custom criteria', async () => {
      const events: Event[] = [
        { type: 'test-event1', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { data: 2 }, timestamp: Date.now() + 100 }
      ];

      const matcher = (event1: Event, event2: Event) => 
        event1.payload.data + event2.payload.data === 3;

      extension.correlateByMatcher('test-event1', 'test-event2', matcher, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(events);
    });

    it('should not correlate events not matching criteria', async () => {
      const events: Event[] = [
        { type: 'test-event1', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { data: 3 }, timestamp: Date.now() + 100 }
      ];

      const matcher = (event1: Event, event2: Event) => 
        event1.payload.data + event2.payload.data === 3;

      extension.correlateByMatcher('test-event1', 'test-event2', matcher, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });

  describe('Rule Management', () => {
    it('should allow adding and removing correlation rules', async () => {
      const events: Event[] = [
        { type: 'test-event1', payload: { key: '123', data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { key: '123', data: 2 }, timestamp: Date.now() + 100 }
      ];

      const rule = extension.correlateByKey('test-event1', 'test-event2', 'key', mockHandler);

      // Process events with rule
      for (const event of events) {
        await extension.processEvent(event);
      }
      expect(mockHandler).toHaveBeenCalledTimes(1);

      // Remove rule
      extension.removeRule(rule);

      // Process events without rule
      for (const event of events) {
        await extension.processEvent(event);
      }
      expect(mockHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple correlation rules', async () => {
      const events: Event[] = [
        { type: 'test-event1', payload: { key: '123', data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { key: '123', data: 2 }, timestamp: Date.now() + 100 }
      ];

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      extension.correlateByKey('test-event1', 'test-event2', 'key', handler1);
      extension.correlateByKey('test-event1', 'test-event2', 'key', handler2);

      for (const event of events) {
        await extension.processEvent(event);
      }

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired correlations', async () => {
      const events: Event[] = [
        { type: 'test-event1', payload: { key: '123', data: 1 }, timestamp: Date.now() },
        { type: 'test-event2', payload: { key: '123', data: 2 }, timestamp: Date.now() + 2000 }
      ];

      extension.correlateByKey('test-event1', 'test-event2', 'key', mockHandler);

      // Process first event
      await extension.processEvent(events[0]);

      // Wait for timeout
      vi.advanceTimersByTime(2000);

      // Process second event
      await extension.processEvent(events[1]);

      expect(mockHandler).not.toHaveBeenCalled();
    });

    it('should respect max correlation size', async () => {
      const events: Event[] = Array.from({ length: 15 }, (_, i) => ({
        type: 'test-event1',
        payload: { key: `key-${i}`, data: i },
        timestamp: Date.now() + i * 100
      }));

      extension.correlateByKey('test-event1', 'test-event2', 'key', mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      // Should only store up to maxCorrelationSize (10) events
      expect(extension.getCorrelationSize()).toBeLessThanOrEqual(10);
    });
  });
}); 