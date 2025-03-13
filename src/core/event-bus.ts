/**
 * Event bus implementation
 */
import { Event, EventHandler, Subscription } from './types';

/**
 * Reactive Event Bus implementation
 * Provides a pub/sub mechanism for event-driven communication
 */
export class ReactiveEventBus {
  private subscriptions: Map<string, Set<EventHandler>> = new Map();
  private isEmitting: boolean = false;
  private pendingUnsubscribes: Array<{ type: string, handler: EventHandler }> = [];

  /**
   * Subscribe to events of a specific type
   * @param type Event type to subscribe to (use '*' for all events)
   * @param handler Function to call when event is emitted
   * @returns Subscription object with unsubscribe method
   */
  subscribe(type: string, handler: EventHandler): Subscription {
    if (!this.subscriptions.has(type)) {
      this.subscriptions.set(type, new Set());
    }
    
    this.subscriptions.get(type)!.add(handler);
    
    return {
      unsubscribe: () => {
        if (this.isEmitting) {
          // If we're currently emitting events, defer the unsubscribe
          this.pendingUnsubscribes.push({ type, handler });
        } else {
          this.removeSubscription(type, handler);
        }
      }
    };
  }

  /**
   * Remove a subscription
   * @param type Event type
   * @param handler Event handler
   */
  private removeSubscription(type: string, handler: EventHandler): void {
    const handlers = this.subscriptions.get(type);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(type);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   * @param event Event to emit
   */
  emit(event: Event): void {
    // Ensure event has required properties
    const normalizedEvent: Event = {
      ...event,
      timestamp: event.timestamp || new Date()
    };
    
    this.isEmitting = true;
    
    try {
      // Call specific handlers
      this.notifyHandlers(normalizedEvent.type, normalizedEvent);
      
      // Call wildcard handlers
      if (normalizedEvent.type !== '*') {
        this.notifyHandlers('*', normalizedEvent);
      }
    } finally {
      this.isEmitting = false;
      
      // Process any pending unsubscribes
      while (this.pendingUnsubscribes.length > 0) {
        const { type, handler } = this.pendingUnsubscribes.shift()!;
        this.removeSubscription(type, handler);
      }
    }
  }

  /**
   * Clear all subscriptions
   */
  clear(): void {
    this.subscriptions.clear();
    this.pendingUnsubscribes = [];
  }

  /**
   * Notify all handlers for a specific event type
   * @param type Event type
   * @param event Event object
   */
  private notifyHandlers(type: string, event: Event): void {
    const handlers = this.subscriptions.get(type);
    if (!handlers) return;
    
    // Create a copy of handlers to avoid issues if handlers are added/removed during iteration
    const handlersArray = Array.from(handlers);
    
    for (const handler of handlersArray) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${type}:`, error);
      }
    }
  }
} 