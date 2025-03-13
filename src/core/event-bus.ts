/**
 * Event bus implementation
 */
import { Event, EventHandler, Subscription } from './types';

/**
 * Reactive event bus for asynchronous communication
 */
export class ReactiveEventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private wildcardHandlers: Set<EventHandler> = new Set();
  
  /**
   * Emit an event to all subscribers
   * 
   * @param event Event to emit
   */
  emit(event: Event): void {
    // Ensure event has a timestamp
    const eventWithTimestamp: Event = {
      ...event,
      timestamp: event.timestamp || new Date()
    };
    
    // Notify specific handlers
    const eventHandlers = this.handlers.get(event.type);
    if (eventHandlers) {
      for (const handler of eventHandlers) {
        try {
          handler(eventWithTimestamp);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      }
    }
    
    // Notify wildcard handlers
    for (const handler of this.wildcardHandlers) {
      try {
        handler(eventWithTimestamp);
      } catch (error) {
        console.error(`Error in wildcard handler for ${event.type}:`, error);
      }
    }
  }
  
  /**
   * Subscribe to events of a specific type
   * 
   * @param type Event type to subscribe to (use '*' for all events)
   * @param handler Event handler function
   * @returns Subscription object with unsubscribe method
   */
  subscribe(type: string, handler: EventHandler): Subscription {
    if (type === '*') {
      // Wildcard subscription
      this.wildcardHandlers.add(handler);
      
      return {
        unsubscribe: () => {
          this.wildcardHandlers.delete(handler);
        }
      };
    } else {
      // Specific event type subscription
      if (!this.handlers.has(type)) {
        this.handlers.set(type, new Set());
      }
      
      this.handlers.get(type)!.add(handler);
      
      return {
        unsubscribe: () => {
          const handlers = this.handlers.get(type);
          if (handlers) {
            handlers.delete(handler);
            if (handlers.size === 0) {
              this.handlers.delete(type);
            }
          }
        }
      };
    }
  }
  
  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }
} 