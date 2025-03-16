/**
 * Event Bus Implementation
 *
 * This file implements the reactive event bus using RxJS.
 */

import { Subject, Observable, filter, map, OperatorFunction } from 'rxjs';
import { Event } from '../models/index.js';

/**
 * ReactiveEventBus class that extends EventEmitter and adds Observable streams
 */
export class ReactiveEventBus {
  private eventSubject = new Subject<Event>();
  private subscriptions = new Map<string, Set<(event: Event) => void>>();

  /**
   * Publish an event to the bus
   */
  publish<T = any>(eventType: string, payload: T): void {
    const event: Event<T> = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };

    // Emit to subject for observable streams
    this.eventSubject.next(event);

    // Notify direct subscribers
    this.notifySubscribers(event);
  }

  /**
   * Subscribe to events of a specific type
   * @returns A function to unsubscribe
   */
  subscribe(eventType: string, handler: (event: Event) => void): () => void {
    // Handle wildcard subscriptions
    const isWildcard = eventType === '*';

    if (!isWildcard) {
      // Add to direct subscribers
      if (!this.subscriptions.has(eventType)) {
        this.subscriptions.set(eventType, new Set());
      }
      this.subscriptions.get(eventType)!.add(handler);
    } else {
      // For wildcard, subscribe to all events
      const subscription = this.eventSubject.subscribe(handler);
      return () => subscription.unsubscribe();
    }

    // Return unsubscribe function
    return () => {
      if (!isWildcard && this.subscriptions.has(eventType)) {
        this.subscriptions.get(eventType)!.delete(handler);
      }
    };
  }

  /**
   * Get an observable stream for events of a specific type
   */
  observe<T = any>(eventType: string): Observable<Event<T>> {
    if (eventType === '*') {
      return this.eventSubject.asObservable() as Observable<Event<T>>;
    }

    return this.eventSubject.pipe(filter(event => event.type === eventType)) as Observable<
      Event<T>
    >;
  }

  /**
   * Create a derived stream with operators
   */
  pipe<T = any, R = any>(
    eventType: string,
    ...operators: OperatorFunction<Event<T>, R>[]
  ): Observable<R> {
    return this.observe<T>(eventType).pipe(...operators);
  }

  /**
   * Get a stream of just the payload for a specific event type
   */
  observePayload<T = any>(eventType: string): Observable<T> {
    return this.observe<T>(eventType).pipe(map(event => event.payload));
  }

  /**
   * Notify all subscribers of an event
   */
  private notifySubscribers(event: Event): void {
    // Notify type-specific subscribers
    if (this.subscriptions.has(event.type)) {
      for (const handler of this.subscriptions.get(event.type)!) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      }
    }

    // Notify wildcard subscribers
    if (this.subscriptions.has('*')) {
      for (const handler of this.subscriptions.get('*')!) {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in wildcard event handler:`, error);
        }
      }
    }
  }
}
