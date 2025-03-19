/**
 * Time Windowed Operations Extension Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TimeWindowedOperationsExtension } from '../src/extensions/time-windowed-operations.js';
import { Event } from '../src/models.js';

describe('TimeWindowedOperationsExtension', () => {
  let extension: TimeWindowedOperationsExtension;
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    extension = new TimeWindowedOperationsExtension();
    mockHandler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.clearAllMocks();
  });

  describe('Tumbling Window', () => {
    it('should group events within time window', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 },
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 200 }
      ];

      extension.tumblingWindow('test-event', 500, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      // Advance time past window
      vi.advanceTimersByTime(600);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(events);
    });

    it('should create new window after time expires', async () => {
      const events1: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 }
      ];

      const events2: Event[] = [
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 600 },
        { type: 'test-event', payload: { data: 4 }, timestamp: Date.now() + 700 }
      ];

      extension.tumblingWindow('test-event', 500, mockHandler);

      // Process first window
      for (const event of events1) {
        await extension.processEvent(event);
      }
      vi.advanceTimersByTime(600);

      // Process second window
      for (const event of events2) {
        await extension.processEvent(event);
      }
      vi.advanceTimersByTime(600);

      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenCalledWith(events1);
      expect(mockHandler).toHaveBeenCalledWith(events2);
    });
  });

  describe('Sliding Window', () => {
    it('should create overlapping windows', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 },
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 200 }
      ];

      extension.slidingWindow('test-event', 500, 200, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
        vi.advanceTimersByTime(200);
      }

      expect(mockHandler).toHaveBeenCalledTimes(3);
      expect(mockHandler).toHaveBeenCalledWith([events[0]]);
      expect(mockHandler).toHaveBeenCalledWith([events[0], events[1]]);
      expect(mockHandler).toHaveBeenCalledWith([events[0], events[1], events[2]]);
    });

    it('should remove old events from window', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 },
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 200 },
        { type: 'test-event', payload: { data: 4 }, timestamp: Date.now() + 600 }
      ];

      extension.slidingWindow('test-event', 500, 200, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
        vi.advanceTimersByTime(200);
      }

      expect(mockHandler).toHaveBeenCalledTimes(4);
      expect(mockHandler).toHaveBeenCalledWith([events[0]]);
      expect(mockHandler).toHaveBeenCalledWith([events[0], events[1]]);
      expect(mockHandler).toHaveBeenCalledWith([events[0], events[1], events[2]]);
      expect(mockHandler).toHaveBeenCalledWith([events[1], events[2], events[3]]);
    });
  });

  describe('Session Window', () => {
    it('should group events within session timeout', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 },
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 200 }
      ];

      extension.sessionWindow('test-event', 500, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      // Wait for session timeout
      vi.advanceTimersByTime(600);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(events);
    });

    it('should create new session after timeout', async () => {
      const events1: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 }
      ];

      const events2: Event[] = [
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 600 },
        { type: 'test-event', payload: { data: 4 }, timestamp: Date.now() + 700 }
      ];

      extension.sessionWindow('test-event', 500, mockHandler);

      // Process first session
      for (const event of events1) {
        await extension.processEvent(event);
      }
      vi.advanceTimersByTime(600);

      // Process second session
      for (const event of events2) {
        await extension.processEvent(event);
      }
      vi.advanceTimersByTime(600);

      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenCalledWith(events1);
      expect(mockHandler).toHaveBeenCalledWith(events2);
    });
  });

  describe('Count Window', () => {
    it('should group events by count', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 },
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 200 }
      ];

      extension.countWindow('test-event', 2, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith([events[0], events[1]]);
    });

    it('should create multiple windows when count exceeds size', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 },
        { type: 'test-event', payload: { data: 3 }, timestamp: Date.now() + 200 },
        { type: 'test-event', payload: { data: 4 }, timestamp: Date.now() + 300 }
      ];

      extension.countWindow('test-event', 2, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenCalledWith([events[0], events[1]]);
      expect(mockHandler).toHaveBeenCalledWith([events[2], events[3]]);
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on unsubscribe', async () => {
      const events: Event[] = [
        { type: 'test-event', payload: { data: 1 }, timestamp: Date.now() },
        { type: 'test-event', payload: { data: 2 }, timestamp: Date.now() + 100 }
      ];

      const unsubscribe = extension.tumblingWindow('test-event', 500, mockHandler);

      for (const event of events) {
        await extension.processEvent(event);
      }

      unsubscribe();
      vi.advanceTimersByTime(600);

      expect(mockHandler).not.toHaveBeenCalled();
    });
  });
}); 