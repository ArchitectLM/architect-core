/**
 * Default event bus implementation for the DSL runtime integration
 */
import type { 
  EventBus, 
  Event, 
  EventHandler,
  BackpressureStrategy 
} from '@architectlm/core';

/**
 * Simple event bus implementation
 */
class DefaultEventBus implements EventBus {
  private subscriptions: Map<string, Set<EventHandler>> = new Map();
  private backpressureStrategies: Map<string, BackpressureStrategy> = new Map();

  /**
   * Subscribe to events of a specific type
   */
  subscribe(eventType: string, handler: EventHandler): void {
    // Get or create the subscription set
    const handlers = this.subscriptions.get(eventType) || new Set<EventHandler>();
    handlers.add(handler);
    this.subscriptions.set(eventType, handlers);
  }

  /**
   * Unsubscribe from events of a specific type
   */
  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.subscriptions.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.subscriptions.delete(eventType);
      }
    }
  }

  /**
   * Publish an event
   */
  publish(eventType: string, payload: any): void {
    const handlers = this.subscriptions.get(eventType);
    if (!handlers || handlers.size === 0) {
      return; // No subscribers
    }

    // Create the event
    const event: Event = {
      type: eventType,
      payload,
      timestamp: Date.now()
    };

    // Apply backpressure strategy if configured
    const strategy = this.backpressureStrategies.get(eventType);
    if (strategy) {
      if (!strategy.shouldProcess(event)) {
        console.warn(`Event ${eventType} throttled by backpressure strategy`);
        return;
      }
    }

    // Notify all subscribers
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
      }
    });
  }

  /**
   * Apply a backpressure strategy to an event type
   */
  applyBackpressure(eventType: string, strategy: BackpressureStrategy): void {
    this.backpressureStrategies.set(eventType, strategy);
  }
}

/**
 * Create a default event bus
 */
export function createDefaultEventBus(): EventBus {
  return new DefaultEventBus();
} 