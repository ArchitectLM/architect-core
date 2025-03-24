import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryEventBus } from '../src/implementations/event-bus';
import { BackpressureStrategy } from '../src/models/backpressure';
import { DomainEvent } from '../src/models/core-types';

describe('Backpressure Mechanisms', () => {
  let eventBus: InMemoryEventBus;

  beforeEach(() => {
    eventBus = new InMemoryEventBus();
  });

  describe('Event Bus with Backpressure', () => {
    it('should apply backpressure to event publishing', async () => {
      const strategy: BackpressureStrategy = {
        shouldAccept: (queueDepth) => queueDepth < 2,
        calculateDelay: () => 100
      };
      eventBus.applyBackpressure('TEST_EVENT', strategy);

      const handler = vi.fn();
      eventBus.subscribe('TEST_EVENT', handler);

      const events: DomainEvent<string>[] = [
        {
          id: 'test-id-1',
          type: 'TEST_EVENT',
          timestamp: Date.now(),
          payload: '1'
        },
        {
          id: 'test-id-2',
          type: 'TEST_EVENT',
          timestamp: Date.now(),
          payload: '2'
        },
        {
          id: 'test-id-3',
          type: 'TEST_EVENT',
          timestamp: Date.now(),
          payload: '3'
        }
      ];

      for (const event of events) {
        await eventBus.publish(event);
      }

      expect(handler).toHaveBeenCalledTimes(3); // All events should be processed with delay
    });

    it('should handle backpressure per event type', async () => {
      const strategy1: BackpressureStrategy = {
        shouldAccept: (queueDepth) => queueDepth < 2,
        calculateDelay: () => 100
      };
      const strategy2: BackpressureStrategy = {
        shouldAccept: (queueDepth) => queueDepth < 3,
        calculateDelay: () => 100
      };

      eventBus.applyBackpressure('EVENT_1', strategy1);
      eventBus.applyBackpressure('EVENT_2', strategy2);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('EVENT_1', handler1);
      eventBus.subscribe('EVENT_2', handler2);

      const events: DomainEvent<string>[] = [
        {
          id: 'test-id-1',
          type: 'EVENT_1',
          timestamp: Date.now(),
          payload: '1'
        },
        {
          id: 'test-id-2',
          type: 'EVENT_1',
          timestamp: Date.now(),
          payload: '2'
        },
        {
          id: 'test-id-3',
          type: 'EVENT_1',
          timestamp: Date.now(),
          payload: '3'
        },
        {
          id: 'test-id-4',
          type: 'EVENT_2',
          timestamp: Date.now(),
          payload: '1'
        },
        {
          id: 'test-id-5',
          type: 'EVENT_2',
          timestamp: Date.now(),
          payload: '2'
        },
        {
          id: 'test-id-6',
          type: 'EVENT_2',
          timestamp: Date.now(),
          payload: '3'
        },
        {
          id: 'test-id-7',
          type: 'EVENT_2',
          timestamp: Date.now(),
          payload: '4'
        }
      ];

      for (const event of events) {
        await eventBus.publish(event);
      }

      expect(handler1).toHaveBeenCalledTimes(3); // All EVENT_1 events should be processed with delay
      expect(handler2).toHaveBeenCalledTimes(4); // All EVENT_2 events should be processed with delay
    });

    it('should handle backpressure with multiple subscribers', async () => {
      const strategy: BackpressureStrategy = {
        shouldAccept: (queueDepth) => queueDepth < 2,
        calculateDelay: () => 100
      };
      eventBus.applyBackpressure('TEST_EVENT', strategy);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('TEST_EVENT', handler1);
      eventBus.subscribe('TEST_EVENT', handler2);

      const events: DomainEvent<string>[] = [
        {
          id: 'test-id-1',
          type: 'TEST_EVENT',
          timestamp: Date.now(),
          payload: '1'
        },
        {
          id: 'test-id-2',
          type: 'TEST_EVENT',
          timestamp: Date.now(),
          payload: '2'
        },
        {
          id: 'test-id-3',
          type: 'TEST_EVENT',
          timestamp: Date.now(),
          payload: '3'
        }
      ];

      const startTime = Date.now();
      for (const event of events) {
        await eventBus.publish(event);
      }
      const endTime = Date.now();

      expect(handler1).toHaveBeenCalledTimes(3);
      expect(handler2).toHaveBeenCalledTimes(3);
      expect(endTime - startTime).toBeGreaterThan(100); // Should have delayed due to backpressure
    });
  });
}); 