import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStorage, createEventStorage } from '../src/implementations/event-storage';
import { DomainEvent, Result } from '../src/models/core-types';

describe('InMemoryEventStorage', () => {
  let storage: InMemoryEventStorage;

  beforeEach(() => {
    storage = new InMemoryEventStorage();
  });

  describe('Event Storage', () => {
    it('should store and retrieve events', async () => {
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { test: 'value' },
        metadata: {
          timestamp: Date.now(),
          correlationId: 'test-correlation'
        }
      };

      // Store event
      const storeResult = await storage.storeEvent(event);
      expect(storeResult.success).toBe(true);

      // Retrieve events by type
      const getResult = await storage.getEventsByType<{ test: string }>('test.event');
      expect(getResult.success).toBe(true);
      if (getResult.success) {
        expect(getResult.value).toHaveLength(1);
        expect(getResult.value[0]).toEqual(event);
      }
    });

    it('should handle storage errors gracefully', async () => {
      // Force an error by storing an invalid event
      const invalidEvent = null as unknown as DomainEvent<any>;
      const result = await storage.storeEvent(invalidEvent);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Event Retrieval', () => {
    it('should filter events by time range', async () => {
      const now = Date.now();
      const events = [
        {
          id: 'event-1',
          type: 'test.event',
          timestamp: now - 1000,
          payload: { test: 'old' },
          metadata: { timestamp: now - 1000 }
        },
        {
          id: 'event-2',
          type: 'test.event',
          timestamp: now,
          payload: { test: 'current' },
          metadata: { timestamp: now }
        },
        {
          id: 'event-3',
          type: 'test.event',
          timestamp: now + 1000,
          payload: { test: 'future' },
          metadata: { timestamp: now + 1000 }
        }
      ];

      // Store events
      for (const event of events) {
        await storage.storeEvent(event);
      }

      // Get events within time range
      const result = await storage.getEventsByType<{ test: string }>(
        'test.event',
        now - 500,
        now + 500
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].payload.test).toBe('current');
      }
    });

    it('should retrieve events by correlation ID', async () => {
      const correlationId = 'test-correlation';
      const events = [
        {
          id: 'event-1',
          type: 'test.event',
          timestamp: Date.now(),
          payload: { test: 'value1' },
          metadata: { correlationId }
        },
        {
          id: 'event-2',
          type: 'test.event',
          timestamp: Date.now(),
          payload: { test: 'value2' },
          metadata: { correlationId }
        }
      ];

      // Store events
      for (const event of events) {
        await storage.storeEvent(event);
      }

      // Get correlated events
      const result = await storage.getEventsByCorrelationId<{ test: string }>(correlationId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
        expect(result.value.map((e: DomainEvent<{ test: string }>) => e.payload.test))
          .toEqual(['value1', 'value2']);
      }
    });
  });

  describe('Storage Management', () => {
    it('should clear all stored events', async () => {
      // Store some events
      const event: DomainEvent<{ test: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { test: 'value' },
        metadata: { timestamp: Date.now() }
      };

      await storage.storeEvent(event);
      expect(storage.getEventCount()).toBe(1);

      // Clear storage
      storage.clear();
      expect(storage.getEventCount()).toBe(0);

      // Verify events are gone
      const result = await storage.getEventsByType<{ test: string }>('test.event');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(0);
      }
    });
  });
}); 