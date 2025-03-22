import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { createModernRuntime } from '../src/implementations/modern-factory';
import { DomainEvent, Result } from '../src/models/core-types';
import { InMemoryExtensionSystem } from '../src/implementations/extension-system';
import { ExtensionEventBus } from '../src/implementations/event-bus';
import { InMemoryEventStorage } from '../src/implementations/event-storage-impl';
import { createEventSource } from '../src/implementations/event-source';
import { EventSource } from '../src/models/event-system';

describe('Event Persistence and Correlation', () => {
  let runtime: Runtime;
  let eventBus: ExtensionEventBus;
  let storage: InMemoryEventStorage;
  let extensionSystem: InMemoryExtensionSystem;
  let eventSource: EventSource;

  beforeEach(() => {
    extensionSystem = new InMemoryExtensionSystem();
    eventBus = new ExtensionEventBus(extensionSystem);
    storage = new InMemoryEventStorage();
    eventSource = createEventSource(storage, eventBus);
    
    runtime = createModernRuntime({
      persistEvents: true,
      extensions: {
        processManagement: true,
        taskManagement: true,
        pluginManagement: true
      }
    });
  });

  describe('Event Persistence', () => {
    it('should persist events when published', async () => {
      eventBus.enablePersistence(storage);
      
      // Publish some events
      const events: DomainEvent<string>[] = [
        {
          id: 'test-id-1',
          type: 'test-event',
          timestamp: Date.now(),
          payload: 'test1'
        },
        {
          id: 'test-id-2',
          type: 'test-event',
          timestamp: Date.now(),
          payload: 'test2'
        },
        {
          id: 'test-id-3',
          type: 'other-event',
          timestamp: Date.now(),
          payload: 'test3'
        }
      ];
      
      for (const event of events) {
        await eventBus.publish(event);
      }
      
      // Check persisted events
      const result = await storage.getAllEvents();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.length).toBe(3);
        expect(result.value.filter((e: DomainEvent<unknown>) => e.type === 'test-event').length).toBe(2);
        expect(result.value.filter((e: DomainEvent<unknown>) => e.type === 'other-event').length).toBe(1);
      }
    });

    it('should not persist events when persistence is disabled', async () => {
      eventBus.enablePersistence(storage);
      
      // Publish an event while persistence is enabled
      const event1: DomainEvent<string> = {
        id: 'test-id-1',
        type: 'test-event',
        timestamp: Date.now(),
        payload: 'test1'
      };
      await eventBus.publish(event1);
      
      // Disable persistence and publish another event
      eventBus.disablePersistence();
      const event2: DomainEvent<string> = {
        id: 'test-id-2',
        type: 'test-event',
        timestamp: Date.now(),
        payload: 'test2'
      };
      await eventBus.publish(event2);
      
      // Check persisted events
      const result = await storage.getAllEvents();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.length).toBe(1);
        expect(result.value[0].payload).toBe('test1');
      }
    });
  });

  describe('Event Correlation', () => {
    it('should correlate events by correlation ID', async () => {
      eventBus.enablePersistence(storage);
      
      const correlationId = 'test-correlation-id';
      const events: DomainEvent<string>[] = [
        {
          id: 'test-id-1',
          type: 'event1',
          timestamp: Date.now(),
          payload: 'test1',
          metadata: { correlationId }
        },
        {
          id: 'test-id-2',
          type: 'event2',
          timestamp: Date.now(),
          payload: 'test2',
          metadata: { correlationId }
        },
        {
          id: 'test-id-3',
          type: 'event3',
          timestamp: Date.now(),
          payload: 'test3'
          // No correlation ID
        }
      ];
      
      for (const event of events) {
        await eventBus.publish(event);
      }
      
      // Get correlated events
      const correlatedEvents = await eventBus.correlate(correlationId);
      expect(correlatedEvents.length).toBe(2);
      expect(correlatedEvents.map((e: DomainEvent<unknown>) => e.type)).toContain('event1');
      expect(correlatedEvents.map((e: DomainEvent<unknown>) => e.type)).toContain('event2');
    });
  });

  describe('Event Replay', () => {
    it('should replay events within a time range', async () => {
      eventBus.enablePersistence(storage);
      
      const now = Date.now();
      const events: DomainEvent<string>[] = [
        {
          id: 'test-id-1',
          type: 'test-event',
          timestamp: now - 1000,
          payload: 'past'
        },
        {
          id: 'test-id-2',
          type: 'test-event',
          timestamp: now,
          payload: 'present'
        },
        {
          id: 'test-id-3',
          type: 'test-event',
          timestamp: now + 1000,
          payload: 'future'
        }
      ];
      
      for (const event of events) {
        await eventBus.publish(event);
      }
      
      // Replay events within a time window
      const handler = vi.fn();
      eventBus.subscribe('test-event', handler);
      
      const result = await eventSource.replayEvents('test-event', now - 500, now + 500);
      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(events[1]); // Only the 'present' event
    });
  });
}); 