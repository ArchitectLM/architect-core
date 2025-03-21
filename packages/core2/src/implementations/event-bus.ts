import { Event, EventBus, EventFilter, EventHandler, EventStorage } from '../models/event.js';
import { BackpressureStrategy } from '../models/backpressure.js';
import { InMemoryEventStorage } from './event-storage.js';

export class EventBusImpl implements EventBus {
  private subscribers: Map<string, Set<EventHandler>> = new Map();
  private wildcardSubscribers: Set<EventHandler> = new Set();
  private backpressureStrategies: Map<string, BackpressureStrategy> = new Map();
  private queueDepths: Map<string, number> = new Map();
  private eventRouters: Array<(event: Event) => string[]> = [];
  private eventFilters: Array<(event: Event) => boolean> = [];
  private storage: EventStorage | null = null;
  private metrics = {
    eventsPublished: 0,
    eventsDelivered: 0,
    subscriberCounts: new Map<string, number>(),
    eventCounts: new Map<string, number>(),
    eventLatencies: new Map<string, number[]>()
  };

  constructor(storage?: EventStorage) {
    if (storage) {
      this.storage = storage;
    }
  }

  subscribe(eventType: string, handler: EventHandler): () => void {
    if (eventType === '*') {
      this.wildcardSubscribers.add(handler);
    } else {
      if (!this.subscribers.has(eventType)) {
        this.subscribers.set(eventType, new Set());
      }
      this.subscribers.get(eventType)!.add(handler);
    }
    
    // Update metrics
    this.metrics.subscriberCounts.set(eventType, (this.metrics.subscriberCounts.get(eventType) || 0) + 1);

    return () => this.unsubscribe(eventType, handler);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    if (eventType === '*') {
      this.wildcardSubscribers.delete(handler);
    } else {
      const handlers = this.subscribers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    }
    
    // Update metrics
    const count = (this.metrics.subscriberCounts.get(eventType) || 1) - 1;
    if (count > 0) {
      this.metrics.subscriberCounts.set(eventType, count);
    } else {
      this.metrics.subscriberCounts.delete(eventType);
    }
  }

  applyBackpressure(eventType: string, strategy: BackpressureStrategy): void {
    this.backpressureStrategies.set(eventType, strategy);
    this.queueDepths.set(eventType, 0);
  }

  publish(eventType: string, payload: any, options: { correlationId?: string; causationId?: string; metadata?: Record<string, any> } = {}): void {
    const timestamp = Date.now();
    const event: Event = {
      id: `event-${timestamp}-${Math.random().toString(36).substring(2, 10)}`,
      type: eventType,
      payload,
      timestamp,
      correlationId: options.correlationId || crypto.randomUUID(),
      causationId: options.causationId,
      metadata: options.metadata || {}
    };

    // Apply global filters
    for (const filter of this.eventFilters) {
      if (!filter(event)) {
        return; // Event filtered out
      }
    }

    // Check backpressure for specific event type
    const strategy = this.backpressureStrategies.get(eventType);
    if (strategy) {
      const queueDepth = this.queueDepths.get(eventType) || 0;
      if (!strategy.shouldAccept(queueDepth)) {
        return;
      }
      this.queueDepths.set(eventType, queueDepth + 1);
    }

    // Update metrics
    this.metrics.eventsPublished++;
    const count = (this.metrics.eventCounts.get(eventType) || 0) + 1;
    this.metrics.eventCounts.set(eventType, count);

    // Persist event if storage is enabled
    if (this.storage) {
      this.storage.saveEvent(event).catch(error => {
        console.error(`Error persisting event ${event.id}:`, error);
      });
    }

    // Deliver to specific subscribers
    this.deliverToSubscribers(event, eventType);

    // Determine additional event types from routers
    const additionalEventTypes: string[] = [];
    for (const router of this.eventRouters) {
      additionalEventTypes.push(...router(event));
    }

    // Deliver to additional event types from routers
    for (const additionalType of additionalEventTypes) {
      this.deliverToSubscribers(event, additionalType);
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
  }

  private deliverToSubscribers(event: Event, eventType: string): void {
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      const startTime = performance.now();
      
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${eventType}:`, error);
        }
      }

      // Calculate latency
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      const latencies = this.metrics.eventLatencies.get(eventType) || [];
      latencies.push(latency);
      this.metrics.eventLatencies.set(eventType, latencies);
      
      this.metrics.eventsDelivered++;
    }
  }

  enablePersistence(storage: EventStorage): void {
    this.storage = storage;
  }

  disablePersistence(): void {
    this.storage = null;
  }

  async replay(filter: EventFilter): Promise<void> {
    if (!this.storage) {
      throw new Error('Event persistence is not enabled, cannot replay events');
    }

    // Publish a replay started event
    this.publish('replay:started', {
      filter,
      timestamp: Date.now()
    });

    try {
      // Get events from storage
      const events = await this.storage.getEvents(filter);

      // Sort by timestamp ascending
      events.sort((a, b) => a.timestamp - b.timestamp);

      // Replay each event through the event bus
      for (const event of events) {
        // Publish a copy of the event with a replay marker in metadata
        this.publish(event.type, event.payload, {
          correlationId: event.correlationId,
          causationId: event.causationId,
          metadata: {
            ...(event.metadata || {}),
            isReplay: true,
            originalEventId: event.id,
            originalTimestamp: event.timestamp
          }
        });
      }

      // Publish a replay completed event
      this.publish('replay:completed', { 
        filter,
        eventCount: events.length,
        endTimestamp: Date.now()
      });
    } catch (error) {
      // Publish a replay failed event
      this.publish('replay:failed', {
        filter,
        error,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  addEventRouter(router: (event: Event) => string[]): void {
    this.eventRouters.push(router);
  }

  addEventFilter(filter: (event: Event) => boolean): void {
    this.eventFilters.push(filter);
  }

  async correlate(correlationId: string): Promise<Event[]> {
    if (!this.storage) {
      throw new Error('Event persistence is not enabled, cannot correlate events');
    }
    return this.storage.getEventsByCorrelationId(correlationId);
  }

  getEventMetrics() {
    return { ...this.metrics };
  }

  getQueueDepth(eventType?: string): number {
    if (eventType) {
      return this.queueDepths.get(eventType) || 0;
    }
    
    // Sum all queue depths
    return Array.from(this.queueDepths.values()).reduce((total, depth) => total + depth, 0);
  }
}

export function createEventBus(storage?: EventStorage): EventBus {
  return new EventBusImpl(storage);
} 