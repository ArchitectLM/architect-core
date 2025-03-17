/**
 * Tests for the EventCorrelation implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventCorrelation, CorrelationRule } from '../src/implementations/event-correlation.js';
import { ReactiveEventBus } from '../src/implementations/event-bus.js';
import { Event } from '../src/models/index.js';

describe('EventCorrelation', () => {
  let eventBus: ReactiveEventBus;
  let correlation: EventCorrelation;
  
  beforeEach(() => {
    vi.useFakeTimers();
    eventBus = new ReactiveEventBus();
    correlation = new EventCorrelation(eventBus);
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('GIVEN an event correlation handler', () => {
    describe('WHEN correlating events with a simple rule', () => {
      it('THEN should detect correlated events and trigger the handler', () => {
        // Given a correlation handler
        const correlationHandler = vi.fn();
        
        // And a correlation rule
        const rule: CorrelationRule = {
          id: 'test-correlation',
          eventTypes: ['event-a', 'event-b'],
          timeWindow: 1000, // 1 second
          correlationKey: 'userId',
          handler: correlationHandler
        };
        
        // When setting up the correlation
        correlation.addRule(rule);
        
        // And emitting correlated events
        eventBus.publish('event-a', { userId: '123', action: 'login' });
        eventBus.publish('event-b', { userId: '123', action: 'purchase' });
        
        // Then the handler should be called with the correlated events
        expect(correlationHandler).toHaveBeenCalledTimes(1);
        expect(correlationHandler).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { userId: '123', action: 'login' } }),
            expect.objectContaining({ payload: { userId: '123', action: 'purchase' } })
          ])
        );
      });
      
      it('THEN should not correlate events with different correlation keys', () => {
        // Given a correlation handler
        const correlationHandler = vi.fn();
        
        // And a correlation rule
        const rule: CorrelationRule = {
          id: 'test-correlation',
          eventTypes: ['event-a', 'event-b'],
          timeWindow: 1000, // 1 second
          correlationKey: 'userId',
          handler: correlationHandler
        };
        
        // When setting up the correlation
        correlation.addRule(rule);
        
        // And emitting events with different correlation keys
        eventBus.publish('event-a', { userId: '123', action: 'login' });
        eventBus.publish('event-b', { userId: '456', action: 'purchase' });
        
        // Then the handler should not be called
        expect(correlationHandler).not.toHaveBeenCalled();
      });
      
      it('THEN should not correlate events outside the time window', () => {
        // Given a correlation handler
        const correlationHandler = vi.fn();
        
        // And a correlation rule
        const rule: CorrelationRule = {
          id: 'test-correlation',
          eventTypes: ['event-a', 'event-b'],
          timeWindow: 1000, // 1 second
          correlationKey: 'userId',
          handler: correlationHandler
        };
        
        // When setting up the correlation
        correlation.addRule(rule);
        
        // And emitting the first event
        eventBus.publish('event-a', { userId: '123', action: 'login' });
        
        // And advancing time beyond the window
        vi.advanceTimersByTime(1500);
        
        // And emitting the second event
        eventBus.publish('event-b', { userId: '123', action: 'purchase' });
        
        // Then the handler should not be called
        expect(correlationHandler).not.toHaveBeenCalled();
      });
    });
    
    describe('WHEN correlating events with a complex rule', () => {
      it('THEN should detect correlated events with a custom matcher', () => {
        // Given a correlation handler
        const correlationHandler = vi.fn();
        
        // And a correlation rule with a custom matcher
        const rule: CorrelationRule = {
          id: 'complex-correlation',
          eventTypes: ['order-created', 'payment-processed', 'order-shipped'],
          timeWindow: 5000, // 5 seconds
          matcher: (events) => {
            // Check if we have all required events
            const orderEvent = events.find(e => e.type === 'order-created');
            const paymentEvent = events.find(e => e.type === 'payment-processed');
            const shippingEvent = events.find(e => e.type === 'order-shipped');
            
            if (!orderEvent || !paymentEvent || !shippingEvent) {
              return false;
            }
            
            // Check if the order IDs match
            const orderId = orderEvent.payload.orderId;
            return (
              paymentEvent.payload.orderId === orderId &&
              shippingEvent.payload.orderId === orderId
            );
          },
          handler: correlationHandler
        };
        
        // When setting up the correlation
        correlation.addRule(rule);
        
        // And emitting correlated events
        eventBus.publish('order-created', { orderId: 'order-123', items: ['item1', 'item2'] });
        eventBus.publish('payment-processed', { orderId: 'order-123', amount: 100 });
        eventBus.publish('order-shipped', { orderId: 'order-123', trackingNumber: 'track-456' });
        
        // Then the handler should be called with the correlated events
        expect(correlationHandler).toHaveBeenCalledTimes(1);
        expect(correlationHandler).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ payload: { orderId: 'order-123', items: ['item1', 'item2'] } }),
            expect.objectContaining({ payload: { orderId: 'order-123', amount: 100 } }),
            expect.objectContaining({ payload: { orderId: 'order-123', trackingNumber: 'track-456' } })
          ])
        );
      });
      
      it('THEN should not correlate events that do not match the custom matcher', () => {
        // Given a correlation handler
        const correlationHandler = vi.fn();
        
        // And a correlation rule with a custom matcher
        const rule: CorrelationRule = {
          id: 'complex-correlation',
          eventTypes: ['order-created', 'payment-processed', 'order-shipped'],
          timeWindow: 5000, // 5 seconds
          matcher: (events) => {
            // Check if we have all required events
            const orderEvent = events.find(e => e.type === 'order-created');
            const paymentEvent = events.find(e => e.type === 'payment-processed');
            const shippingEvent = events.find(e => e.type === 'order-shipped');
            
            if (!orderEvent || !paymentEvent || !shippingEvent) {
              return false;
            }
            
            // Check if the order IDs match
            const orderId = orderEvent.payload.orderId;
            return (
              paymentEvent.payload.orderId === orderId &&
              shippingEvent.payload.orderId === orderId
            );
          },
          handler: correlationHandler
        };
        
        // When setting up the correlation
        correlation.addRule(rule);
        
        // And emitting events with mismatched order IDs
        eventBus.publish('order-created', { orderId: 'order-123', items: ['item1', 'item2'] });
        eventBus.publish('payment-processed', { orderId: 'order-456', amount: 100 }); // Different order ID
        eventBus.publish('order-shipped', { orderId: 'order-123', trackingNumber: 'track-456' });
        
        // Then the handler should not be called
        expect(correlationHandler).not.toHaveBeenCalled();
      });
    });
    
    describe('WHEN removing a correlation rule', () => {
      it('THEN should no longer correlate events for that rule', () => {
        // Given a correlation handler
        const correlationHandler = vi.fn();
        
        // And a correlation rule
        const rule: CorrelationRule = {
          id: 'test-correlation',
          eventTypes: ['event-a', 'event-b'],
          timeWindow: 1000, // 1 second
          correlationKey: 'userId',
          handler: correlationHandler
        };
        
        // When setting up the correlation
        correlation.addRule(rule);
        
        // And removing the rule
        correlation.removeRule('test-correlation');
        
        // And emitting events that would have been correlated
        eventBus.publish('event-a', { userId: '123', action: 'login' });
        eventBus.publish('event-b', { userId: '123', action: 'purchase' });
        
        // Then the handler should not be called
        expect(correlationHandler).not.toHaveBeenCalled();
      });
    });
  });
}); 