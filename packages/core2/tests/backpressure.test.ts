import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '../src/models/event.js';
import { BackpressureStrategy, ThresholdBackpressure } from '../src/models/backpressure.js';
import { createEventBusInstance } from '../src/factories.js';

describe('Backpressure Mechanisms', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = createEventBusInstance();
  });

  describe('Threshold Backpressure', () => {
    it('should accept events below threshold', () => {
      const strategy = new ThresholdBackpressure(10, 100);
      expect(strategy.shouldAccept(5)).toBe(true);
    });

    it('should reject events above threshold', () => {
      const strategy = new ThresholdBackpressure(10, 100);
      expect(strategy.shouldAccept(15)).toBe(false);
    });

    it('should return configured delay', () => {
      const strategy = new ThresholdBackpressure(10, 100);
      expect(strategy.calculateDelay()).toBe(100);
    });
  });

  describe('Event Bus with Backpressure', () => {
    it('should apply backpressure to event publishing', () => {
      const strategy = new ThresholdBackpressure(2, 100);
      eventBus.applyBackpressure('TEST_EVENT', strategy);

      const handler = vi.fn();
      eventBus.subscribe('TEST_EVENT', handler);

      // Publish events up to threshold
      eventBus.publish('TEST_EVENT', 1);
      eventBus.publish('TEST_EVENT', 2);
      eventBus.publish('TEST_EVENT', 3);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle backpressure per event type', () => {
      const strategy1 = new ThresholdBackpressure(2, 100);
      const strategy2 = new ThresholdBackpressure(3, 100);

      eventBus.applyBackpressure('EVENT_1', strategy1);
      eventBus.applyBackpressure('EVENT_2', strategy2);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('EVENT_1', handler1);
      eventBus.subscribe('EVENT_2', handler2);

      // Publish events
      eventBus.publish('EVENT_1', 1);
      eventBus.publish('EVENT_1', 2);
      eventBus.publish('EVENT_1', 3);
      eventBus.publish('EVENT_2', 1);
      eventBus.publish('EVENT_2', 2);
      eventBus.publish('EVENT_2', 3);
      eventBus.publish('EVENT_2', 4);

      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(3);
    });

    it('should handle backpressure with wildcard subscriptions', () => {
      const strategy = new ThresholdBackpressure(2, 100);
      eventBus.applyBackpressure('*', strategy);

      const handler = vi.fn();
      eventBus.subscribe('*', handler);

      // Publish events
      eventBus.publish('EVENT_1', 1);
      eventBus.publish('EVENT_2', 2);
      eventBus.publish('EVENT_3', 3);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it('should handle backpressure with multiple subscribers', () => {
      const strategy = new ThresholdBackpressure(2, 100);
      eventBus.applyBackpressure('TEST_EVENT', strategy);

      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.subscribe('TEST_EVENT', handler1);
      eventBus.subscribe('TEST_EVENT', handler2);

      // Publish events
      eventBus.publish('TEST_EVENT', 1);
      eventBus.publish('TEST_EVENT', 2);
      eventBus.publish('TEST_EVENT', 3);

      expect(handler1).toHaveBeenCalledTimes(2);
      expect(handler2).toHaveBeenCalledTimes(2);
    });
  });
}); 