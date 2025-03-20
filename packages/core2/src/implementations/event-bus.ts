import { Event, EventHandler, EventBus } from '../models/event.js';
import { BackpressureStrategy } from '../models/backpressure.js';

export class EventBusImpl implements EventBus {
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private wildcardSubscribers: Set<EventHandler> = new Set();
  private backpressureStrategies: Map<string, BackpressureStrategy> = new Map();
  private queueDepths: Map<string, number> = new Map();

  subscribe(eventType: string, handler: EventHandler): void {
    if (eventType === '*') {
      this.wildcardSubscribers.add(handler);
    } else {
      if (!this.subscribers.has(eventType)) {
        this.subscribers.set(eventType, new Set());
      }
      this.subscribers.get(eventType)!.add(handler);
    }
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    if (eventType === '*') {
      this.wildcardSubscribers.delete(handler);
    } else {
      const handlers = this.subscribers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
      }
    }
  }

  applyBackpressure(eventType: string, strategy: BackpressureStrategy): void {
    this.backpressureStrategies.set(eventType, strategy);
    this.queueDepths.set(eventType, 0);
  }

  publish(eventType: string, payload: any): void {
    const event: Event = {
      type: eventType,
      payload,
      timestamp: Date.now()
    };

    // Check backpressure for specific event type
    const strategy = this.backpressureStrategies.get(eventType);
    if (strategy) {
      const queueDepth = this.queueDepths.get(eventType) || 0;
      if (!strategy.shouldAccept(queueDepth)) {
        return;
      }
      this.queueDepths.set(eventType, queueDepth + 1);
    }

    // Check backpressure for wildcard
    const wildcardStrategy = this.backpressureStrategies.get('*');
    if (wildcardStrategy) {
      const wildcardQueueDepth = this.queueDepths.get('*') || 0;
      if (!wildcardStrategy.shouldAccept(wildcardQueueDepth)) {
        return;
      }
      this.queueDepths.set('*', wildcardQueueDepth + 1);
    }

    // Deliver to specific subscribers
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      }
    }

    // Deliver to wildcard subscribers
    for (const handler of this.wildcardSubscribers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`Error in wildcard event handler for ${eventType}:`, error);
      }
    }

    // Decrement queue depths after processing
    if (strategy) {
      const queueDepth = this.queueDepths.get(eventType) || 0;
      this.queueDepths.set(eventType, Math.max(0, queueDepth - 1));
    }
    if (wildcardStrategy) {
      const wildcardQueueDepth = this.queueDepths.get('*') || 0;
      this.queueDepths.set('*', Math.max(0, wildcardQueueDepth - 1));
    }
  }
}

export function createEventBus(): EventBus {
  return new EventBusImpl();
} 