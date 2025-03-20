import { describe, it, expect, vi } from 'vitest';
import { Stream, createStream } from '../src/models/stream.js';
import { EventBus } from '../src/models/event.js';

describe('Stream Processing', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = createEventBus();
  });

  describe('Stream Creation', () => {
    it('should create a stream from events', async () => {
      const stream = createStream<number>('TEST_EVENT', eventBus);
      const results: number[] = [];

      stream.subscribe(value => results.push(value));
      eventBus.publish('TEST_EVENT', 1);
      eventBus.publish('TEST_EVENT', 2);

      expect(results).toEqual([1, 2]);
    });

    it('should handle multiple subscribers', async () => {
      const stream = createStream<number>('TEST_EVENT', eventBus);
      const results1: number[] = [];
      const results2: number[] = [];

      stream.subscribe(value => results1.push(value));
      stream.subscribe(value => results2.push(value));
      eventBus.publish('TEST_EVENT', 1);

      expect(results1).toEqual([1]);
      expect(results2).toEqual([1]);
    });
  });

  describe('Stream Operators', () => {
    it('should map values', async () => {
      const stream = createStream<number>('TEST_EVENT', eventBus);
      const results: number[] = [];

      stream
        .map(x => x * 2)
        .subscribe(value => results.push(value));
      
      eventBus.publish('TEST_EVENT', 1);
      eventBus.publish('TEST_EVENT', 2);

      expect(results).toEqual([2, 4]);
    });

    it('should filter values', async () => {
      const stream = createStream<number>('TEST_EVENT', eventBus);
      const results: number[] = [];

      stream
        .filter(x => x > 2)
        .subscribe(value => results.push(value));
      
      eventBus.publish('TEST_EVENT', 1);
      eventBus.publish('TEST_EVENT', 2);
      eventBus.publish('TEST_EVENT', 3);

      expect(results).toEqual([3]);
    });

    it('should chain operators', async () => {
      const stream = createStream<number>('TEST_EVENT', eventBus);
      const results: number[] = [];

      stream
        .map(x => x * 2)
        .filter(x => x > 4)
        .subscribe(value => results.push(value));
      
      eventBus.publish('TEST_EVENT', 1);
      eventBus.publish('TEST_EVENT', 2);
      eventBus.publish('TEST_EVENT', 3);

      expect(results).toEqual([6]);
    });

    it('should handle errors in operators', async () => {
      const stream = createStream<number>('TEST_EVENT', eventBus);
      const errorHandler = vi.fn();
      const results: number[] = [];

      stream
        .map(x => {
          if (x === 2) throw new Error('Test error');
          return x * 2;
        })
        .subscribe({
          next: value => results.push(value),
          error: errorHandler
        });
      
      eventBus.publish('TEST_EVENT', 1);
      eventBus.publish('TEST_EVENT', 2);
      eventBus.publish('TEST_EVENT', 3);

      expect(results).toEqual([2]);
      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Stream Reduction', () => {
    it('should reduce values', async () => {
      const stream = createStream<number>('TEST_EVENT', eventBus);
      const result = await stream.reduce((acc, x) => acc + x, 0);
      
      eventBus.publish('TEST_EVENT', 1);
      eventBus.publish('TEST_EVENT', 2);
      eventBus.publish('TEST_EVENT', 3);

      expect(result).toBe(6);
    });

    it('should handle empty streams', async () => {
      const stream = createStream<number>('TEST_EVENT', eventBus);
      const result = await stream.reduce((acc, x) => acc + x, 0);
      expect(result).toBe(0);
    });
  });
}); 