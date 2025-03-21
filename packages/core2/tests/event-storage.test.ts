import { describe, it, expect, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime.js';
import { ReactiveRuntime } from '../src/implementations/runtime.js';
import { Event } from '../src/models/index.js';
import { ExtensionSystemImpl } from '../src/implementations/extension-system.js';
import { EventBusImpl } from '../src/implementations/event-bus.js';
import { InMemoryEventStorage } from '../src/implementations/event-storage.js';

describe('Event Storage', () => {
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

  describe('Event Persistence', () => {
    it('should persist events with generated id and timestamp', async () => {
      const event = { type: 'test', data: 'test' };
      await runtime.persistEvent(event);

      const startTime = Date.now() - 1000;
      const endTime = Date.now() + 1000;
      await runtime.replayEvents(startTime, endTime, ['test']);
      
      const metrics = await runtime.getEventMetrics('test');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].eventType).toBe('test');
    });

    it('should persist events with existing id and timestamp', async () => {
      const event = {
        id: 'test-id',
        type: 'test',
        data: 'test',
        timestamp: 1234567890
      };
      await runtime.persistEvent(event);

      const startTime = Date.now() - 1000;
      const endTime = Date.now() + 1000;
      await runtime.replayEvents(startTime, endTime, ['test']);
      
      const metrics = await runtime.getEventMetrics('test');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics[0].eventType).toBe('test');
    });

    it('should index events by correlation id', async () => {
      const correlationId = 'test-correlation';
      const event = {
        type: 'test',
        data: 'test',
        correlationId
      };
      await runtime.persistEvent(event);

      const correlatedEvents = await runtime.correlateEvents(correlationId);
      expect(correlatedEvents).toHaveLength(1);
      expect(correlatedEvents[0].correlationId).toBe(correlationId);
    });
  });

  describe('Event Retrieval', () => {
    it('should retrieve events by time range', async () => {
      const now = Date.now();
      const events = [
        { type: 'test1', data: 'test1', timestamp: now - 500 },
        { type: 'test2', data: 'test2', timestamp: now - 250 },
        { type: 'test3', data: 'test3', timestamp: now + 500 }
      ];

      for (const event of events) {
        await runtime.persistEvent(event);
      }

      const startTime = now - 1000;
      const endTime = now;
      await runtime.replayEvents(startTime, endTime);
      
      const metrics = await runtime.getEventMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.eventType === 'test1')).toBe(true);
      expect(metrics.some(m => m.eventType === 'test2')).toBe(true);
    });

    it('should filter events by type', async () => {
      const events = [
        { type: 'test1', data: 'test1' },
        { type: 'test2', data: 'test2' },
        { type: 'test1', data: 'test3' }
      ];

      for (const event of events) {
        await runtime.persistEvent(event);
      }

      const startTime = Date.now() - 1000;
      const endTime = Date.now() + 1000;
      await runtime.replayEvents(startTime, endTime, ['test1']);
      
      const metrics = await runtime.getEventMetrics('test1');
      expect(metrics).toBeDefined();
      expect(metrics.length).toBe(2);
    });
  });

  describe('Event Correlation', () => {
    it('should correlate events by correlation ID', async () => {
      const correlationId = 'test-correlation';
      const events = [
        { type: 'test1', data: 'test1', correlationId },
        { type: 'test2', data: 'test2', correlationId }
      ];

      for (const event of events) {
        await runtime.persistEvent(event);
      }

      const correlatedEvents = await runtime.correlateEvents(correlationId);
      expect(correlatedEvents).toHaveLength(2);
      expect(correlatedEvents.every(e => e.correlationId === correlationId)).toBe(true);
    });

    it('should handle non-existent correlation IDs', async () => {
      const correlatedEvents = await runtime.correlateEvents('non-existent');
      expect(correlatedEvents).toHaveLength(0);
    });
  });

  describe('Event Metrics', () => {
    it('should track event storage metrics', async () => {
      const events = [
        { type: 'test1', data: 'test1' },
        { type: 'test2', data: 'test2' },
        { type: 'test1', data: 'test3' }
      ];

      for (const event of events) {
        await runtime.persistEvent(event);
      }

      const metrics = await runtime.getEventMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.length).toBeGreaterThan(0);
      expect(metrics.some(m => m.eventType === 'test1')).toBe(true);
      expect(metrics.some(m => m.eventType === 'test2')).toBe(true);
    });
  });
}); 