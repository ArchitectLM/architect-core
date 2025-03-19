/**
 * Event Bus Extension
 * 
 * This extension provides a pub/sub event bus with support for
 * event filtering, transformation, and error handling.
 */

import { Extension, ExtensionPoint, ExtensionHookHandler } from '../models.js';
import { Event } from '../models.js';

/**
 * Event subscriber interface
 */
export interface EventSubscriber {
  handle: (event: Event) => Promise<void>;
}

/**
 * Event filter interface
 */
export interface EventFilter {
  matches: (event: Event) => boolean;
}

/**
 * Event transformer interface
 */
export interface EventTransformer {
  transform: (event: Event) => Promise<Event>;
}

/**
 * Event Bus Extension
 */
export class EventBusExtension implements Extension {
  name = 'event-bus';
  description = 'Provides pub/sub event bus with filtering and transformation';

  private subscribers: Map<string, Set<EventSubscriber>> = new Map();
  private filters: Map<string, EventFilter> = new Map();
  private transformers: Map<string, EventTransformer> = new Map();
  private observers: Set<(event: Event) => void> = new Set();

  hooks: Record<string, ExtensionHookHandler> = {
    'event-bus:publish': this.handleEventBusPublish.bind(this)
  };

  /**
   * Subscribe to events
   */
  subscribe(eventType: string, subscriber: EventSubscriber): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }
    this.subscribers.get(eventType)!.add(subscriber);
  }

  /**
   * Unsubscribe from events
   */
  unsubscribe(eventType: string, subscriber: EventSubscriber): void {
    const subscribers = this.subscribers.get(eventType);
    if (subscribers) {
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        this.subscribers.delete(eventType);
      }
    }
  }

  /**
   * Register an event filter
   */
  registerFilter(filterId: string, filter: EventFilter): void {
    this.filters.set(filterId, filter);
  }

  /**
   * Unregister an event filter
   */
  unregisterFilter(filterId: string): void {
    this.filters.delete(filterId);
  }

  /**
   * Register an event transformer
   */
  registerTransformer(transformerId: string, transformer: EventTransformer): void {
    this.transformers.set(transformerId, transformer);
  }

  /**
   * Unregister an event transformer
   */
  unregisterTransformer(transformerId: string): void {
    this.transformers.delete(transformerId);
  }

  /**
   * Observe all events
   */
  observe(observer: (event: Event) => void): void {
    this.observers.add(observer);
  }

  /**
   * Unobserve all events
   */
  unobserve(observer: (event: Event) => void): void {
    this.observers.delete(observer);
  }

  /**
   * Publish an event
   */
  async publish(event: Event): Promise<void> {
    // Apply filters
    for (const filter of this.filters.values()) {
      if (!filter.matches(event)) {
        return;
      }
    }

    // Apply transformers
    let transformedEvent = event;
    for (const transformer of this.transformers.values()) {
      transformedEvent = await transformer.transform(transformedEvent);
    }

    // Notify observers
    for (const observer of this.observers) {
      observer(transformedEvent);
    }

    // Notify subscribers
    const subscribers = this.subscribers.get(transformedEvent.type);
    if (subscribers) {
      const promises = Array.from(subscribers).map(subscriber =>
        subscriber.handle(transformedEvent).catch(error => {
          console.error(`Error handling event ${transformedEvent.type}:`, error);
        })
      );
      await Promise.all(promises);
    }
  }

  /**
   * Handle event bus publish
   */
  private async handleEventBusPublish(context: any): Promise<any> {
    const { event } = context;
    await this.publish(event);
    return context;
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.subscribers.clear();
    this.filters.clear();
    this.transformers.clear();
    this.observers.clear();
  }
} 