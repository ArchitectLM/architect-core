/**
 * Event Bus
 * 
 * This module provides an implementation of the event bus for the reactive system.
 * The event bus is responsible for emitting events and notifying subscribers.
 */

import { BaseEvent, EventBus, Subscription } from '../types/events';

/**
 * Event bus implementation
 */
export class ReactiveEventBus implements EventBus {
  /**
   * Event handlers
   */
  private handlers: Map<string, Array<(event: BaseEvent) => void>> = new Map();
  
  /**
   * Wildcard handlers
   */
  private wildcardHandlers: Array<(event: BaseEvent) => void> = [];
  
  /**
   * Emit an event
   * @param event The event to emit
   */
  emit<T extends BaseEvent>(event: T): void {
    // Log the event
    console.log(`[EventBus] Emitting event: ${event.type}`, event.payload);
    
    // Call specific handlers
    const eventHandlers = this.handlers.get(event.type);
    if (eventHandlers) {
      eventHandlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`[EventBus] Error in handler for event ${event.type}:`, error);
          // Emit error event
          this.emit({
            type: 'ERROR',
            payload: {
              message: `Error in handler for event ${event.type}`,
              error: error instanceof Error ? error.message : String(error),
              originalEvent: event
            }
          });
        }
      });
    }
    
    // Call wildcard handlers
    this.wildcardHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`[EventBus] Error in wildcard handler for event ${event.type}:`, error);
        // Emit error event
        this.emit({
          type: 'ERROR',
          payload: {
            message: `Error in wildcard handler for event ${event.type}`,
            error: error instanceof Error ? error.message : String(error),
            originalEvent: event
          }
        });
      }
    });
  }
  
  /**
   * Subscribe to an event
   * @param eventType The event type to subscribe to
   * @param handler The handler to call when the event is emitted
   * @returns A subscription that can be used to unsubscribe
   */
  subscribe<T extends BaseEvent>(eventType: string, handler: (event: T) => void): Subscription {
    // Get or create handlers for this event type
    const eventHandlers = this.handlers.get(eventType) || [];
    
    // Add the handler
    eventHandlers.push(handler as (event: BaseEvent) => void);
    
    // Update the handlers map
    this.handlers.set(eventType, eventHandlers);
    
    // Return a subscription
    return {
      unsubscribe: () => {
        const handlers = this.handlers.get(eventType);
        if (handlers) {
          const index = handlers.indexOf(handler as (event: BaseEvent) => void);
          if (index !== -1) {
            handlers.splice(index, 1);
            if (handlers.length === 0) {
              this.handlers.delete(eventType);
            } else {
              this.handlers.set(eventType, handlers);
            }
          }
        }
      }
    };
  }
  
  /**
   * Subscribe to all events
   * @param handler The handler to call when any event is emitted
   * @returns A subscription that can be used to unsubscribe
   */
  subscribeToAll<T extends BaseEvent>(handler: (event: T) => void): Subscription {
    // Add the handler
    this.wildcardHandlers.push(handler as (event: BaseEvent) => void);
    
    // Return a subscription
    return {
      unsubscribe: () => {
        const index = this.wildcardHandlers.indexOf(handler as (event: BaseEvent) => void);
        if (index !== -1) {
          this.wildcardHandlers.splice(index, 1);
        }
      }
    };
  }
  
  /**
   * Subscribe to an event once
   * @param eventType The event type to subscribe to
   * @param handler The handler to call when the event is emitted
   * @returns A subscription that can be used to unsubscribe
   */
  once<T extends BaseEvent>(eventType: string, handler: (event: T) => void): Subscription {
    // Create a wrapper handler that unsubscribes after the first call
    const wrapperHandler = (event: T) => {
      // Unsubscribe
      subscription.unsubscribe();
      
      // Call the handler
      handler(event);
    };
    
    // Subscribe
    const subscription = this.subscribe(eventType, wrapperHandler);
    
    // Return the subscription
    return subscription;
  }
  
  /**
   * Remove all subscriptions
   */
  removeAllSubscriptions(): void {
    this.handlers.clear();
    this.wildcardHandlers = [];
  }
  
  /**
   * For backward compatibility
   */
  on<T extends BaseEvent>(eventType: string, handler: (event: T) => void): Subscription {
    return this.subscribe(eventType, handler);
  }
  
  /**
   * For backward compatibility
   */
  onAny<T extends BaseEvent>(handler: (event: T) => void): Subscription {
    return this.subscribeToAll(handler);
  }
}