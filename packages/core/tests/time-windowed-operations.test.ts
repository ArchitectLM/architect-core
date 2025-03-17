/**
 * Tests for the TimeWindowedOperations implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimeWindowedOperations, WindowType } from '../src/implementations/time-windowed-operations.js';
import { ReactiveEventBus } from '../src/implementations/event-bus.js';
import { Event } from '../src/models/index.js';

describe('TimeWindowedOperations', () => {
  let eventBus: ReactiveEventBus;
  let timeWindowed: TimeWindowedOperations;
  
  // Mock time functions
  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new ReactiveEventBus();
    timeWindowed = new TimeWindowedOperations(eventBus);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('GIVEN a time-windowed operations handler', () => {
    describe('WHEN using a tumbling window', () => {
      it('THEN should collect events within the window and emit a single aggregated event', async () => {
        // Given a handler for a tumbling window
        const windowHandler = vi.fn();
        const windowSize = 1000; // 1 second window
        
        // When setting up a tumbling window
        timeWindowed.tumblingWindow({
          eventType: 'test-event',
          windowSize,
          handler: windowHandler
        });
        
        // And emitting events within the window
        eventBus.publish('test-event', { value: 1 });
        eventBus.publish('test-event', { value: 2 });
        eventBus.publish('test-event', { value: 3 });
        
        // And advancing time to just before the window closes
        vi.advanceTimersByTime(windowSize - 1);
        
        // Then the handler should not be called yet
        expect(windowHandler).not.toHaveBeenCalled();
        
        // When advancing time to close the window
        vi.advanceTimersByTime(1);
        
        // Then the handler should be called with all events
        expect(windowHandler).toHaveBeenCalledTimes(1);
        expect(windowHandler).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 1 } }),
            expect.objectContaining({ payload: { value: 2 } }),
            expect.objectContaining({ payload: { value: 3 } })
          ])
        );
      });
      
      it('THEN should start a new window after the previous one closes', async () => {
        // Given a handler for a tumbling window
        const windowHandler = vi.fn();
        const windowSize = 1000; // 1 second window
        
        // When setting up a tumbling window
        timeWindowed.tumblingWindow({
          eventType: 'test-event',
          windowSize,
          handler: windowHandler
        });
        
        // And emitting events within the first window
        eventBus.publish('test-event', { value: 1 });
        eventBus.publish('test-event', { value: 2 });
        
        // And advancing time to close the first window
        vi.advanceTimersByTime(windowSize);
        
        // Then the handler should be called with the first window's events
        expect(windowHandler).toHaveBeenCalledTimes(1);
        expect(windowHandler).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 1 } }),
            expect.objectContaining({ payload: { value: 2 } })
          ])
        );
        
        // When emitting events within the second window
        eventBus.publish('test-event', { value: 3 });
        eventBus.publish('test-event', { value: 4 });
        
        // And advancing time to close the second window
        vi.advanceTimersByTime(windowSize);
        
        // Then the handler should be called again with the second window's events
        expect(windowHandler).toHaveBeenCalledTimes(2);
        expect(windowHandler).toHaveBeenLastCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 3 } }),
            expect.objectContaining({ payload: { value: 4 } })
          ])
        );
      });
    });
    
    describe('WHEN using a sliding window', () => {
      it('THEN should collect events within the window and emit aggregated events as the window slides', async () => {
        // Given a handler for a sliding window
        const windowHandler = vi.fn();
        const windowSize = 1000; // 1 second window
        const slideInterval = 500; // 0.5 second slide
        
        // When setting up a sliding window
        timeWindowed.slidingWindow({
          eventType: 'test-event',
          windowSize,
          slideInterval,
          handler: windowHandler
        });
        
        // And emitting events
        eventBus.publish('test-event', { value: 1 }); // t=0
        
        // Advance time to t=250ms
        vi.advanceTimersByTime(250);
        eventBus.publish('test-event', { value: 2 }); // t=250
        
        // Advance time to t=500ms (first slide)
        vi.advanceTimersByTime(250);
        
        // Then the handler should be called with events from t=0 to t=500
        expect(windowHandler).toHaveBeenCalledTimes(1);
        expect(windowHandler).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 1 } }),
            expect.objectContaining({ payload: { value: 2 } })
          ])
        );
        
        // When emitting more events
        eventBus.publish('test-event', { value: 3 }); // t=500
        
        // Advance time to t=750ms
        vi.advanceTimersByTime(250);
        eventBus.publish('test-event', { value: 4 }); // t=750
        
        // Advance time to t=1000ms (second slide)
        vi.advanceTimersByTime(250);
        
        // Then the handler should be called with events from t=500 to t=1000
        expect(windowHandler).toHaveBeenCalledTimes(2);
        expect(windowHandler).toHaveBeenLastCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 1 } }),
            expect.objectContaining({ payload: { value: 2 } }),
            expect.objectContaining({ payload: { value: 3 } }),
            expect.objectContaining({ payload: { value: 4 } })
          ])
        );
        
        // Advance time to t=1500ms (third slide)
        vi.advanceTimersByTime(500);
        
        // Then the handler should be called with events from t=1000 to t=1500
        expect(windowHandler).toHaveBeenCalledTimes(3);
        expect(windowHandler).toHaveBeenLastCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 3 } }),
            expect.objectContaining({ payload: { value: 4 } })
          ])
        );
        
        // Advance time to t=2000ms (fourth slide)
        vi.advanceTimersByTime(500);
        
        // Then the handler should be called with events from t=1500 to t=2000
        expect(windowHandler).toHaveBeenCalledTimes(4);
        expect(windowHandler).toHaveBeenLastCalledWith([]);
      });
    });
    
    describe('WHEN using a session window', () => {
      it('THEN should collect events until a timeout occurs', async () => {
        // Given a handler for a session window
        const windowHandler = vi.fn();
        const timeout = 1000; // 1 second timeout
        
        // When setting up a session window
        timeWindowed.sessionWindow({
          eventType: 'test-event',
          timeout,
          handler: windowHandler
        });
        
        // And emitting events
        eventBus.publish('test-event', { value: 1 }); // t=0
        
        // Advance time to t=500ms
        vi.advanceTimersByTime(500);
        eventBus.publish('test-event', { value: 2 }); // t=500
        
        // Advance time to t=900ms
        vi.advanceTimersByTime(400);
        eventBus.publish('test-event', { value: 3 }); // t=900
        
        // Then the handler should not be called yet
        expect(windowHandler).not.toHaveBeenCalled();
        
        // Advance time to t=1900ms (1000ms after the last event)
        vi.advanceTimersByTime(1000);
        
        // Then the handler should be called with all events
        expect(windowHandler).toHaveBeenCalledTimes(1);
        expect(windowHandler).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 1 } }),
            expect.objectContaining({ payload: { value: 2 } }),
            expect.objectContaining({ payload: { value: 3 } })
          ])
        );
      });
    });
    
    describe('WHEN using a count window', () => {
      it('THEN should collect a specific number of events before emitting', async () => {
        // Given a handler for a count window
        const windowHandler = vi.fn();
        const count = 3;
        
        // When setting up a count window
        timeWindowed.countWindow({
          eventType: 'test-event',
          count,
          handler: windowHandler
        });
        
        // And emitting events
        eventBus.publish('test-event', { value: 1 });
        eventBus.publish('test-event', { value: 2 });
        
        // Then the handler should not be called yet
        expect(windowHandler).not.toHaveBeenCalled();
        
        // When emitting the final event to reach the count
        eventBus.publish('test-event', { value: 3 });
        
        // Then the handler should be called with all events
        expect(windowHandler).toHaveBeenCalledTimes(1);
        expect(windowHandler).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 1 } }),
            expect.objectContaining({ payload: { value: 2 } }),
            expect.objectContaining({ payload: { value: 3 } })
          ])
        );
        
        // When emitting more events
        eventBus.publish('test-event', { value: 4 });
        eventBus.publish('test-event', { value: 5 });
        
        // Then the handler should not be called again yet
        expect(windowHandler).toHaveBeenCalledTimes(1);
        
        // When emitting the final event to reach the count again
        eventBus.publish('test-event', { value: 6 });
        
        // Then the handler should be called again with the new events
        expect(windowHandler).toHaveBeenCalledTimes(2);
        expect(windowHandler).toHaveBeenLastCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { value: 4 } }),
            expect.objectContaining({ payload: { value: 5 } }),
            expect.objectContaining({ payload: { value: 6 } })
          ])
        );
      });
    });
  });
}); 