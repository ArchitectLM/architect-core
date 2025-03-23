import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStorage } from '../src/implementations/event-storage-impl';
import { DomainEvent } from '../src/models/core-types';

// Helper to create test events
function createTestEvent<T>(type: string, payload: T): DomainEvent<T> {
  return {
    id: `test-${Date.now()}`,
    type,
    timestamp: Date.now(),
    payload
  };
}

describe('InMemoryEventStorage', () => {
  let eventStorage: InMemoryEventStorage;

  beforeEach(() => {
    eventStorage = new InMemoryEventStorage();
  });

  describe('Core Storage Functionality', () => {
    it('should store and retrieve events by type', async () => {
      const event1 = createTestEvent('test', { message: 'Test event 1' });
      const event2 = createTestEvent('test', { message: 'Test event 2' });
      const event3 = createTestEvent('other', { message: 'Other event' });

      await eventStorage.storeEvent(event1);
      await eventStorage.storeEvent(event2);
      await eventStorage.storeEvent(event3);

      const result = await eventStorage.getEventsByType<{ message: string }>('test');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
        expect(result.value.map(e => (e.payload as { message: string }).message)).toEqual(['Test event 1', 'Test event 2']);
      }
    });

    it('should retrieve events by correlation ID', async () => {
      const correlationId = 'test-correlation';
      const event1 = createTestEvent('test', { message: 'Test event 1' });
      const event2 = createTestEvent('test', { message: 'Test event 2' });
      const event3 = createTestEvent('other', { message: 'Other event' });

      event1.metadata = { correlationId };
      event2.metadata = { correlationId };

      await eventStorage.storeEvent(event1);
      await eventStorage.storeEvent(event2);
      await eventStorage.storeEvent(event3);

      const result = await eventStorage.getEventsByCorrelationId<{ message: string }>(correlationId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
        expect(result.value.map(e => (e.payload as { message: string }).message)).toEqual(['Test event 1', 'Test event 2']);
      }
    });

    it('should retrieve all events', async () => {
      const event1 = createTestEvent('test', { message: 'Test event 1' });
      const event2 = createTestEvent('other', { message: 'Test event 2' });

      await eventStorage.storeEvent(event1);
      await eventStorage.storeEvent(event2);

      const result = await eventStorage.getAllEvents<{ message: string }>();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(2);
        expect(result.value.map(e => (e.payload as { message: string }).message)).toEqual(['Test event 1', 'Test event 2']);
      }
    });
  });

  describe('Storage Management', () => {
    it('should clear all events', async () => {
      const event = createTestEvent('test', { message: 'Test event' });
      await eventStorage.storeEvent(event);
      
      expect(eventStorage.getEventCount()).toBe(1);
      
      eventStorage.clear();
      expect(eventStorage.getEventCount()).toBe(0);
      
      const result = await eventStorage.getAllEvents();
      if (result.success) {
        expect(result.value).toHaveLength(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid event storage', async () => {
      const invalidEvent = {
        id: 'test',
        type: 'test',
        timestamp: Date.now(),
        // Missing payload, but the implementation doesn't validate this
      } as unknown as DomainEvent<unknown>;

      // The current implementation doesn't validate events, so this should succeed
      const result = await eventStorage.storeEvent(invalidEvent);
      expect(result.success).toBe(true);
      
      // Verify the event was actually stored
      const allEvents = await eventStorage.getAllEvents();
      expect(allEvents.success).toBe(true);
      if (allEvents.success) {
        const storedEvent = allEvents.value.find(e => e.id === 'test');
        expect(storedEvent).toBeDefined();
      }
    });

    it('should handle non-existent correlation IDs', async () => {
      const result = await eventStorage.getEventsByCorrelationId('non-existent');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toHaveLength(0);
      }
    });
  });
}); 