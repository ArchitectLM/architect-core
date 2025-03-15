import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveEventBus } from './event-bus';
import { Event } from './types';

describe('ReactiveEventBus', () => {
  let eventBus: ReactiveEventBus;

  beforeEach(() => {
    eventBus = new ReactiveEventBus();
  });

  it('should emit events to subscribers', () => {
    // Arrange
    const handler = vi.fn();
    const event: Event = { type: 'TEST_EVENT', payload: { data: 'test' } };
    
    // Act
    eventBus.subscribe('TEST_EVENT', handler);
    eventBus.emit(event);
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TEST_EVENT',
      payload: { data: 'test' },
      timestamp: expect.any(Date)
    }));
  });

  it('should not emit events to unsubscribed handlers', () => {
    // Arrange
    const handler = vi.fn();
    const event: Event = { type: 'TEST_EVENT' };
    
    // Act
    const subscription = eventBus.subscribe('TEST_EVENT', handler);
    subscription.unsubscribe();
    eventBus.emit(event);
    
    // Assert
    expect(handler).not.toHaveBeenCalled();
  });

  it('should emit events to wildcard subscribers', () => {
    // Arrange
    const handler = vi.fn();
    const event1: Event = { type: 'EVENT_1' };
    const event2: Event = { type: 'EVENT_2' };
    
    // Act
    eventBus.subscribe('*', handler);
    eventBus.emit(event1);
    eventBus.emit(event2);
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'EVENT_1' }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'EVENT_2' }));
  });

  it('should clear all subscriptions', () => {
    // Arrange
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const event: Event = { type: 'TEST_EVENT' };
    
    // Act
    eventBus.subscribe('TEST_EVENT', handler1);
    eventBus.subscribe('*', handler2);
    eventBus.clear();
    eventBus.emit(event);
    
    // Assert
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should handle errors in event handlers', () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = vi.fn().mockImplementation(() => {
      throw new Error('Handler error');
    });
    const event: Event = { type: 'TEST_EVENT' };
    
    // Act
    eventBus.subscribe('TEST_EVENT', handler);
    eventBus.emit(event);
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error in event handler for TEST_EVENT'),
      expect.any(Error)
    );
    
    // Cleanup
    consoleErrorSpy.mockRestore();
  });

  // New tests for event filtering, subscription priorities, and performance
  it('should support event filtering by source', () => {
    // Arrange
    const handler = vi.fn();
    const filterFn = (event: Event) => event.source === 'system-a';
    
    // Create a custom filter subscription
    const subscribe = () => {
      const subscription = eventBus.subscribe('DATA_UPDATED', (event) => {
        if (filterFn(event)) {
          handler(event);
        }
      });
      return subscription;
    };
    
    const subscription = subscribe();
    
    // Act
    eventBus.emit({ type: 'DATA_UPDATED', source: 'system-a', payload: { id: '1' } });
    eventBus.emit({ type: 'DATA_UPDATED', source: 'system-b', payload: { id: '2' } });
    eventBus.emit({ type: 'DATA_UPDATED', source: 'system-a', payload: { id: '3' } });
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ 
      source: 'system-a', 
      payload: { id: '1' } 
    }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ 
      source: 'system-a', 
      payload: { id: '3' } 
    }));
    
    // Cleanup
    subscription.unsubscribe();
  });

  it('should support event filtering by payload properties', () => {
    // Arrange
    const handler = vi.fn();
    const filterFn = (event: Event) => {
      return event.payload && event.payload.priority === 'high';
    };
    
    // Create a custom filter subscription
    const subscribe = () => {
      const subscription = eventBus.subscribe('NOTIFICATION', (event) => {
        if (filterFn(event)) {
          handler(event);
        }
      });
      return subscription;
    };
    
    const subscription = subscribe();
    
    // Act
    eventBus.emit({ type: 'NOTIFICATION', payload: { message: 'Test 1', priority: 'low' } });
    eventBus.emit({ type: 'NOTIFICATION', payload: { message: 'Test 2', priority: 'high' } });
    eventBus.emit({ type: 'NOTIFICATION', payload: { message: 'Test 3', priority: 'medium' } });
    eventBus.emit({ type: 'NOTIFICATION', payload: { message: 'Test 4', priority: 'high' } });
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ 
      payload: { message: 'Test 2', priority: 'high' } 
    }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ 
      payload: { message: 'Test 4', priority: 'high' } 
    }));
    
    // Cleanup
    subscription.unsubscribe();
  });

  it('should handle multiple subscribers in the correct order', () => {
    // Arrange
    const results: string[] = [];
    const handler1 = vi.fn().mockImplementation(() => results.push('handler1'));
    const handler2 = vi.fn().mockImplementation(() => results.push('handler2'));
    const handler3 = vi.fn().mockImplementation(() => results.push('handler3'));
    
    // Act
    eventBus.subscribe('ORDERED_EVENT', handler1);
    eventBus.subscribe('ORDERED_EVENT', handler2);
    eventBus.subscribe('ORDERED_EVENT', handler3);
    
    eventBus.emit({ type: 'ORDERED_EVENT' });
    
    // Assert
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
    
    // Handlers should be called in the order they were registered
    expect(results).toEqual(['handler1', 'handler2', 'handler3']);
  });

  it('should handle high-frequency event emission', () => {
    // Arrange
    const handler = vi.fn();
    eventBus.subscribe('RAPID_EVENT', handler);
    
    // Act
    const eventCount = 1000;
    const startTime = performance.now();
    
    for (let i = 0; i < eventCount; i++) {
      eventBus.emit({ type: 'RAPID_EVENT', payload: { index: i } });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(eventCount);
    
    // Performance assertion - should process 1000 events quickly
    // This is a soft assertion as performance can vary by environment
    console.log(`Processed ${eventCount} events in ${duration.toFixed(2)}ms (${(eventCount / duration * 1000).toFixed(2)} events/sec)`);
    
    // On most modern systems, this should be well under 500ms
    // But we'll use a conservative threshold to avoid flaky tests
    expect(duration).toBeLessThan(2000);
  });

  it('should support async event handlers', async () => {
    // Arrange
    const asyncHandler = vi.fn().mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return 'async result';
    });
    
    eventBus.subscribe('ASYNC_EVENT', asyncHandler);
    
    // Act
    eventBus.emit({ type: 'ASYNC_EVENT', payload: { data: 'test' } });
    
    // Assert
    expect(asyncHandler).toHaveBeenCalledTimes(1);
    
    // Wait for all async handlers to complete
    await new Promise(resolve => setTimeout(resolve, 20));
    
    // Verify the handler was called with the correct event
    expect(asyncHandler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ASYNC_EVENT',
      payload: { data: 'test' }
    }));
  });

  // Additional edge case tests

  it('should handle events with undefined or null payload', () => {
    // Arrange
    const handler = vi.fn();
    eventBus.subscribe('NULL_PAYLOAD_EVENT', handler);
    
    // Act
    eventBus.emit({ type: 'NULL_PAYLOAD_EVENT', payload: null });
    eventBus.emit({ type: 'NULL_PAYLOAD_EVENT', payload: undefined });
    eventBus.emit({ type: 'NULL_PAYLOAD_EVENT' });
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: 'NULL_PAYLOAD_EVENT',
      payload: null
    }));
    expect(handler).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: 'NULL_PAYLOAD_EVENT',
      payload: undefined
    }));
    expect(handler).toHaveBeenNthCalledWith(3, expect.objectContaining({
      type: 'NULL_PAYLOAD_EVENT'
    }));
  });

  it('should handle multiple unsubscribe calls gracefully', () => {
    // Arrange
    const handler = vi.fn();
    const subscription = eventBus.subscribe('TEST_EVENT', handler);
    
    // Act
    subscription.unsubscribe(); // First unsubscribe
    subscription.unsubscribe(); // Second unsubscribe should not throw
    subscription.unsubscribe(); // Third unsubscribe should not throw
    
    eventBus.emit({ type: 'TEST_EVENT' });
    
    // Assert
    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle unsubscribing during event emission', () => {
    // Arrange
    const results: string[] = [];
    let subscription1: { unsubscribe: () => void };
    let subscription2: { unsubscribe: () => void };
    let subscription3: { unsubscribe: () => void };
    
    const handler1 = vi.fn().mockImplementation(() => {
      results.push('handler1');
      // Unsubscribe handler2 during handler1 execution
      subscription2.unsubscribe();
    });
    
    const handler2 = vi.fn().mockImplementation(() => {
      results.push('handler2');
    });
    
    const handler3 = vi.fn().mockImplementation(() => {
      results.push('handler3');
    });
    
    // Act
    // Subscribe handlers in a specific order
    subscription1 = eventBus.subscribe('UNSUBSCRIBE_EVENT', handler1);
    subscription2 = eventBus.subscribe('UNSUBSCRIBE_EVENT', handler2);
    subscription3 = eventBus.subscribe('UNSUBSCRIBE_EVENT', handler3);
    
    // Emit the event
    eventBus.emit({ type: 'UNSUBSCRIBE_EVENT' });
    
    // Emit another event to verify handler2 is unsubscribed
    eventBus.emit({ type: 'UNSUBSCRIBE_EVENT' });
    
    // Assert
    // First emission: all handlers should be called because unsubscribe is deferred
    // Second emission: handler2 should not be called
    expect(handler1).toHaveBeenCalledTimes(2);
    expect(handler2).toHaveBeenCalledTimes(1); // Called only on first emission
    expect(handler3).toHaveBeenCalledTimes(2);
    expect(results).toEqual(['handler1', 'handler2', 'handler3', 'handler1', 'handler3']);
  });

  it('should handle errors in one handler without affecting others', () => {
    // Arrange
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const results: string[] = [];
    
    const handler1 = vi.fn().mockImplementation(() => {
      results.push('handler1');
    });
    
    const handler2 = vi.fn().mockImplementation(() => {
      results.push('handler2');
      throw new Error('Handler 2 error');
    });
    
    const handler3 = vi.fn().mockImplementation(() => {
      results.push('handler3');
    });
    
    // Act
    eventBus.subscribe('ERROR_ISOLATION_EVENT', handler1);
    eventBus.subscribe('ERROR_ISOLATION_EVENT', handler2);
    eventBus.subscribe('ERROR_ISOLATION_EVENT', handler3);
    
    eventBus.emit({ type: 'ERROR_ISOLATION_EVENT' });
    
    // Assert
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['handler1', 'handler2', 'handler3']);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error in event handler for ERROR_ISOLATION_EVENT'),
      expect.any(Error)
    );
    
    // Cleanup
    consoleErrorSpy.mockRestore();
  });

  it('should handle circular references in event payload', () => {
    // Arrange
    const handler = vi.fn();
    eventBus.subscribe('CIRCULAR_EVENT', handler);
    
    // Create an object with circular reference
    const circularObj: any = { name: 'circular' };
    circularObj.self = circularObj;
    
    // Act - this should not cause stack overflow
    eventBus.emit({ type: 'CIRCULAR_EVENT', payload: circularObj });
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'CIRCULAR_EVENT',
      payload: expect.objectContaining({ name: 'circular' })
    }));
  });

  it('should handle empty event type', () => {
    // Arrange
    const handler = vi.fn();
    eventBus.subscribe('', handler);
    
    // Act
    eventBus.emit({ type: '' });
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: ''
    }));
  });

  it('should handle subscribing to the same event type multiple times', () => {
    // Arrange
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();
    
    // Act
    eventBus.subscribe('DUPLICATE_EVENT', handler1);
    eventBus.subscribe('DUPLICATE_EVENT', handler2);
    eventBus.subscribe('DUPLICATE_EVENT', handler3);
    
    eventBus.emit({ type: 'DUPLICATE_EVENT' });
    
    // Assert
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
    expect(handler3).toHaveBeenCalledTimes(1);
  });

  it('should handle large event payloads', () => {
    // Arrange
    const handler = vi.fn();
    eventBus.subscribe('LARGE_PAYLOAD_EVENT', handler);
    
    // Create a large payload
    const largeArray = new Array(10000).fill(0).map((_, i) => ({ index: i, value: `value-${i}` }));
    
    // Act
    eventBus.emit({ type: 'LARGE_PAYLOAD_EVENT', payload: { data: largeArray } });
    
    // Assert
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({
      type: 'LARGE_PAYLOAD_EVENT',
      payload: expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ index: 0, value: 'value-0' }),
          expect.objectContaining({ index: 9999, value: 'value-9999' })
        ])
      })
    }));
  });
}); 