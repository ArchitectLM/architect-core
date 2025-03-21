import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Runtime } from '../src/models/runtime.js';
import { ReactiveRuntime } from '../src/implementations/runtime.js';
import { Event } from '../src/models/index.js';
import { ExtensionSystemImpl } from '../src/implementations/extension-system.js';
import { EventBusImpl } from '../src/implementations/event-bus.js';
import { InMemoryEventStorage } from '../src/implementations/event-storage.js';
import { BackpressureStrategy } from '../src/models/backpressure.js';

describe('Event Management', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBusImpl;
  let eventStorage: InMemoryEventStorage;

  beforeEach(() => {
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    eventStorage = new InMemoryEventStorage();
    
    runtime = new ReactiveRuntime({}, {}, {
      extensionSystem,
      eventBus,
      eventStorage
    });
  });

  describe('Event Publishing and Subscription', () => {
    it('should publish and subscribe to specific event types', async () => {
      const handler = vi.fn();
      const unsubscribe = runtime.subscribe('test.event', handler);
      
      runtime.publish('test.event', { data: 'test' });
      expect(handler).toHaveBeenCalledWith({ data: 'test' });
      
      unsubscribe();
      runtime.publish('test.event', { data: 'ignored' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple subscribers for the same event type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      runtime.subscribe('test.event', handler1);
      runtime.subscribe('test.event', handler2);
      
      runtime.publish('test.event', { data: 'test' });
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should handle event persistence', async () => {
      const event = { type: 'test.event', data: 'test' };
      await runtime.persistEvent(event);

      const startTime = Date.now() - 1000;
      const endTime = Date.now() + 1000;
      await runtime.replayEvents(startTime, endTime, ['test.event']);
    });
  });

  describe('Event Correlation', () => {
    it('should correlate events by correlation ID', async () => {
      const correlationId = 'test-correlation';
      const events = [
        { type: 'test.event1', data: 'test1', correlationId },
        { type: 'test.event2', data: 'test2', correlationId }
      ];

      for (const event of events) {
        await runtime.persistEvent(event);
      }

      const correlatedEvents = await runtime.correlateEvents(correlationId);
      expect(correlatedEvents).toHaveLength(2);
      expect(correlatedEvents.map(e => e.type)).toEqual(['test.event1', 'test.event2']);
    });
  });

  describe('Event Replay', () => {
    it('should replay events within a time range', async () => {
      const now = Date.now();
      const events = [
        { type: 'test.event1', data: 'test1', timestamp: now - 500 },
        { type: 'test.event2', data: 'test2', timestamp: now - 250 },
        { type: 'test.event3', data: 'test3', timestamp: now + 500 }
      ];

      for (const event of events) {
        await runtime.persistEvent(event);
      }

      const handler = vi.fn();
      runtime.subscribe('test.event1', handler);
      runtime.subscribe('test.event2', handler);

      await runtime.replayEvents(now - 1000, now);
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should filter replayed events by type', async () => {
      const now = Date.now();
      const events = [
        { type: 'test.event1', data: 'test1', timestamp: now - 500 },
        { type: 'test.event2', data: 'test2', timestamp: now - 250 },
        { type: 'test.event3', data: 'test3', timestamp: now + 500 }
      ];

      for (const event of events) {
        await runtime.persistEvent(event);
      }

      const handler = vi.fn();
      runtime.subscribe('test.event1', handler);

      await runtime.replayEvents(now - 1000, now, ['test.event1']);
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Event Metrics', () => {
    it('should track event metrics', async () => {
      const event = { type: 'test.event', data: 'test' };
      await runtime.persistEvent(event);

      const metrics = await runtime.getEventMetrics('test.event');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].eventType).toBe('test.event');
    });
  });

  describe('EventBusImpl', () => {
    let eventBus: EventBusImpl;
    let storage: InMemoryEventStorage;

    beforeEach(() => {
      storage = new InMemoryEventStorage();
      eventBus = new EventBusImpl(storage);
    });

    describe('subscribe and unsubscribe', () => {
      it('should subscribe to specific event types', () => {
        const handler = vi.fn();
        const unsubscribe = eventBus.subscribe('test.event', handler);
        
        eventBus.publish('test.event', { data: 'test' });
        expect(handler).toHaveBeenCalledTimes(1);
        
        unsubscribe();
        eventBus.publish('test.event', { data: 'test' });
        expect(handler).toHaveBeenCalledTimes(1);
      });

      it('should subscribe to wildcard events', () => {
        const handler = vi.fn();
        const unsubscribe = eventBus.subscribe('*', handler);
        
        eventBus.publish('test.event1', { data: 'test1' });
        eventBus.publish('test.event2', { data: 'test2' });
        expect(handler).toHaveBeenCalledTimes(2);
        
        unsubscribe();
        eventBus.publish('test.event3', { data: 'test3' });
        expect(handler).toHaveBeenCalledTimes(2);
      });

      it('should handle multiple subscribers for the same event type', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();
        
        eventBus.subscribe('test.event', handler1);
        eventBus.subscribe('test.event', handler2);
        
        eventBus.publish('test.event', { data: 'test' });
        expect(handler1).toHaveBeenCalledTimes(1);
        expect(handler2).toHaveBeenCalledTimes(1);
      });
    });

    describe('publish', () => {
      it('should publish events with required fields', () => {
        const handler = vi.fn();
        eventBus.subscribe('test.event', handler);
        
        eventBus.publish('test.event', { data: 'test' });
        
        const event = handler.mock.calls[0][0];
        expect(event.id).toBeDefined();
        expect(event.timestamp).toBeDefined();
        expect(event.type).toBe('test.event');
        expect(event.payload).toEqual({ data: 'test' });
        expect(event.correlationId).toBeDefined();
      });

      it('should apply event filters', () => {
        const handler = vi.fn();
        eventBus.subscribe('test.event', handler);
        
        eventBus.addEventFilter(event => event.payload.data !== 'filtered');
        
        eventBus.publish('test.event', { data: 'test' });
        eventBus.publish('test.event', { data: 'filtered' });
        
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].payload.data).toBe('test');
      });

      it('should route events to additional channels', () => {
        const handler = vi.fn();
        eventBus.subscribe('routed.event', handler);
        
        eventBus.addEventRouter(event => ['routed.event']);
        
        eventBus.publish('test.event', { data: 'test' });
        
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].type).toBe('routed.event');
      });
    });

    describe('event persistence', () => {
      it('should persist events when storage is enabled', async () => {
        eventBus.enablePersistence(storage);
        
        eventBus.publish('test.event', { data: 'test' });
        
        const events = await storage.getEvents({});
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe('test.event');
      });

      it('should not persist events when storage is disabled', async () => {
        eventBus.disablePersistence();
        
        eventBus.publish('test.event', { data: 'test' });
        
        const events = await storage.getEvents({});
        expect(events).toHaveLength(0);
      });
    });

    describe('event replay', () => {
      it('should replay events matching the filter', async () => {
        eventBus.enablePersistence(storage);
        
        // Publish some test events
        eventBus.publish('test.event1', { data: 'test1' });
        eventBus.publish('test.event2', { data: 'test2' });
        eventBus.publish('test.event1', { data: 'test3' });
        
        const handler = vi.fn();
        eventBus.subscribe('test.event1', handler);
        
        // Replay only test.event1 events
        await eventBus.replay({ types: ['test.event1'] });
        
        expect(handler).toHaveBeenCalledTimes(2);
        expect(handler.mock.calls[0][0].payload.data).toBe('test1');
        expect(handler.mock.calls[1][0].payload.data).toBe('test3');
      });

      it('should emit replay start and complete events', async () => {
        eventBus.enablePersistence(storage);
        
        const startHandler = vi.fn();
        const completeHandler = vi.fn();
        
        eventBus.subscribe('replay:started', startHandler);
        eventBus.subscribe('replay:completed', completeHandler);
        
        await eventBus.replay({});
        
        expect(startHandler).toHaveBeenCalledTimes(1);
        expect(completeHandler).toHaveBeenCalledTimes(1);
      });
    });

    describe('event correlation', () => {
      it('should correlate events by correlation ID', async () => {
        eventBus.enablePersistence(storage);
        
        const correlationId = 'test-correlation';
        eventBus.publish('test.event1', { data: 'test1' }, { correlationId });
        eventBus.publish('test.event2', { data: 'test2' }, { correlationId });
        
        const events = await eventBus.correlate(correlationId);
        expect(events).toHaveLength(2);
        expect(events.every(e => e.correlationId === correlationId)).toBe(true);
      });
    });

    describe('backpressure', () => {
      it('should apply backpressure strategy', () => {
        const strategy: BackpressureStrategy = {
          shouldAccept: vi.fn().mockReturnValue(false),
          calculateDelay: vi.fn().mockReturnValue(0)
        };
        
        eventBus.applyBackpressure('test.event', strategy);
        
        eventBus.publish('test.event', { data: 'test' });
        
        expect(strategy.shouldAccept).toHaveBeenCalled();
      });
    });

    describe('metrics', () => {
      it('should track event metrics', () => {
        const handler = vi.fn();
        eventBus.subscribe('test.event', handler);
        
        eventBus.publish('test.event', { data: 'test' });
        eventBus.publish('test.event', { data: 'test' });
        
        const metrics = eventBus.getEventMetrics();
        expect(metrics.eventsPublished).toBe(2);
        expect(metrics.eventsDelivered).toBe(2);
        expect(metrics.eventCounts.get('test.event')).toBe(2);
      });
    });
  });
}); 