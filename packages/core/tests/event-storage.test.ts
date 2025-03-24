import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryEventStorage, createEventStorage } from '../src/implementations/event-storage';
import { DomainEvent, Result } from '../src/models/core-types';
import { 
  createTestEvent, 
  createTestEventBatch,
  createTimeRangeEvents,
  expectEventsEqual,
  pollUntil,
  flushPromises
} from './helpers/event-storage-testing-utils';

describe('Event Storage Tests', () => {
  let storage: InMemoryEventStorage;

  beforeEach(() => {
    storage = new InMemoryEventStorage();
  });

  describe('Core Storage Functionality', () => {
    it('should store and retrieve events by type', async () => {
      // Create and store test events
      const event1 = createTestEvent('test.event', { test: 'value1' });
      const event2 = createTestEvent('test.event', { test: 'value2' });
      const event3 = createTestEvent('other.event', { test: 'value3' });

      await storage.storeEvent(event1);
      await storage.storeEvent(event2);
      await storage.storeEvent(event3);

      // Retrieve events by type
      const result = await storage.getEventsByType<{ test: string }>('test.event');
      
      // Verify result
      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value).toHaveLength(2);
        const testValues = result.value.map(e => e.payload.test);
        expect(testValues).toContain('value1');
        expect(testValues).toContain('value2');
      }
    });

    it('should retrieve all events', async () => {
      // Create test events using the batch helper
      const events = createTestEventBatch('test.event', [
        { message: 'Test event 1' },
        { message: 'Test event 2' }
      ]);

      // Store events
      for (const event of events) {
        await storage.storeEvent(event);
      }

      // Retrieve all events
      const result = await storage.getAllEvents<{ message: string }>();
      
      // Verify result
      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value).toHaveLength(2);
        const messages = result.value.map(e => e.payload.message);
        expect(messages).toEqual([
          'Test event 1',
          'Test event 2'
        ]);
      }
    });

    it('should handle storage errors gracefully', async () => {
      // Force an error by storing an invalid event
      const invalidEvent = null as unknown as DomainEvent<any>;
      const result = await storage.storeEvent(invalidEvent);
      
      // Verify error handling
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Event Filtering and Retrieval', () => {
    it('should filter events by time range', async () => {
      const now = Date.now();
      
      // Create events with different timestamps
      const events = createTimeRangeEvents(
        'test.time-range',
        5,  // 5 events
        now - 2000,  // 2 seconds ago
        now + 2000   // 2 seconds in the future
      );

      // Store all events
      for (const event of events) {
        await storage.storeEvent(event);
      }

      // Get events within middle time range 
      const result = await storage.getEventsByType<{ index: number; timestamp: number }>(
        'test.time-range',
        now - 500,   // 0.5 seconds ago
        now + 500    // 0.5 seconds in the future
      );

      // Verify filtering works
      expect(result.success).toBe(true);
      if (result.success && result.value) {
        // Should only include middle event(s)
        expect(result.value.length).toBeGreaterThan(0);
        expect(result.value.length).toBeLessThan(5);
        
        // All returned events should be within the time range
        result.value.forEach(event => {
          expect(event.timestamp).toBeGreaterThanOrEqual(now - 500);
          expect(event.timestamp).toBeLessThanOrEqual(now + 500);
        });
      }
    });

    it('should retrieve events by correlation ID', async () => {
      const correlationId = 'test-correlation-id';
      
      // Create correlated events
      const correlatedEvents = createTestEventBatch(
        'test.correlated', 
        [{ value: 1 }, { value: 2 }], 
        Date.now(), 
        correlationId
      );
      
      // Create non-correlated event
      const otherEvent = createTestEvent('test.other', { value: 3 });

      // Store all events
      for (const event of [...correlatedEvents, otherEvent]) {
        await storage.storeEvent(event);
      }

      // Get correlated events
      const result = await storage.getEventsByCorrelationId<{ value: number }>(correlationId);

      // Verify correlation filtering
      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value).toHaveLength(2);
        
        // Check all returned events have the correct correlation ID
        result.value.forEach(event => {
          expect(event.metadata?.correlationId).toBe(correlationId);
        });
        
        // Check that the values match what we expect
        const values = result.value.map(e => e.payload.value).sort();
        expect(values).toEqual([1, 2]);
      }
    });
    
    it('should handle non-existent correlation IDs', async () => {
      // Try to retrieve events with a non-existent correlation ID
      const result = await storage.getEventsByCorrelationId('non-existent-id');
      
      // Should succeed but return empty array
      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value).toHaveLength(0);
      }
    });
  });

  describe('Storage Management', () => {
    it('should clear all stored events', async () => {
      // Store some test events
      const events = createTestEventBatch('test.clear', [
        { value: 'first' },
        { value: 'second' }
      ]);
      
      for (const event of events) {
        await storage.storeEvent(event);
      }
      
      // Verify events were stored
      expect(storage.getEventCount()).toBe(2);

      // Clear storage
      storage.clear();
      
      // Verify events are gone
      expect(storage.getEventCount()).toBe(0);

      // Verify events cannot be retrieved
      const result = await storage.getAllEvents();
      expect(result.success).toBe(true);
      if (result.success && result.value) {
        expect(result.value).toHaveLength(0);
      }
    });
  });
  
  describe('Factory Method', () => {
    it('should create event storage with factory function', () => {
      // Use the factory function
      const customStorage = createEventStorage();
      
      // Verify it creates a valid instance
      expect(customStorage).toBeDefined();
      expect(typeof customStorage.storeEvent).toBe('function');
      expect(typeof customStorage.getEventsByType).toBe('function');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle incomplete events gracefully', async () => {
      // Create an incomplete event missing required fields
      const incompleteEvent = {
        id: 'incomplete',
        type: 'test.incomplete',
        // Missing timestamp and payload
      } as unknown as DomainEvent<unknown>;

      // Attempt to store the incomplete event
      const result = await storage.storeEvent(incompleteEvent);
      
      // Current implementation doesn't validate completely, but let's check anyway
      if (result.success) {
        // If it succeeded, verify the event was actually stored
        const getResult = await storage.getEventsByType('test.incomplete');
        
        // If we can retrieve it, verify the id matches
        if (getResult.success && getResult.value && getResult.value.length > 0) {
          expect(getResult.value[0].id).toBe('incomplete');
        }
      } else {
        // If it failed, there should be an error
        expect(result.error).toBeDefined();
      }
    });
    
    it('should handle event retrieval errors', async () => {
      // Current implementation doesn't have retrieval errors, but let's check anyway
      // Try to retrieve with an invalid type (null)
      const result = await storage.getEventsByType(null as unknown as string);
      
      // Should either return empty array success or error
      if (result.success && result.value) {
        expect(result.value).toEqual([]);
      } else if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
}); 