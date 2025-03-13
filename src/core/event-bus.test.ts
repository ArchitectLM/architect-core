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
}); 