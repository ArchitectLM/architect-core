import { DomainEvent, Identifier, Metadata, Result } from './core-types';
import { BackpressureStrategy } from './backpressure';

/**
 * Event subscription options
 */
export interface SubscriptionOptions {
  /** Subscription name for debugging and monitoring */
  name?: string;
  
  /** Priority of the subscription (higher is processed first) */
  priority?: number;
  
  /** Whether to run the handler only once and then unsubscribe */
  once?: boolean;
  
  /** Metadata for the subscription */
  metadata?: Metadata;
}

/**
 * Event filter function type
 */
export type EventFilter<T> = (event: DomainEvent<T>) => boolean;

/**
 * Event handler function type
 */
export type EventHandler<T> = (event: DomainEvent<T>) => Promise<void>;

/**
 * Event bus subscription that can be cancelled
 */
export interface Subscription {
  /** Unique subscription identifier */
  id: Identifier;
  
  /** Event type being subscribed to */
  eventType: string;
  
  /** Unsubscribe from this event */
  unsubscribe(): void;
}

/**
 * Event dispatcher for publishing events
 */
export interface EventDispatcher {
  /**
   * Publish an event to all subscribers
   * @param event The event to publish
   */
  publish<T>(event: DomainEvent<T>): Promise<void>;
  
  /**
   * Publish multiple events in order
   * @param events Array of events to publish
   */
  publishAll<T>(events: DomainEvent<T>[]): Promise<void>;
}

/**
 * Event subscriber for receiving events
 */
export interface EventSubscriber {
  /**
   * Subscribe to an event type
   * @param eventType The type of event to subscribe to
   * @param handler The event handler function
   * @param options Optional subscription configuration
   */
  subscribe<T>(
    eventType: string,
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Subscription;
  
  /**
   * Subscribe to an event type with a filter
   * @param eventType The type of event to subscribe to
   * @param filter Filter function to determine which events to handle
   * @param handler The event handler function
   * @param options Optional subscription configuration
   */
  subscribeWithFilter<T>(
    eventType: string,
    filter: EventFilter<T>,
    handler: EventHandler<T>,
    options?: SubscriptionOptions
  ): Subscription;
}

/**
 * Complete event bus combining dispatcher and subscriber capabilities
 */
export interface EventBus extends EventDispatcher, EventSubscriber {
  /**
   * Remove all subscriptions for a specific event type
   * @param eventType The event type to clear subscriptions for
   */
  clearSubscriptions(eventType: string): void;
  
  /**
   * Remove all subscriptions
   */
  clearAllSubscriptions(): void;
  
  /**
   * Get the count of subscribers for an event type
   * @param eventType The event type to check
   */
  subscriberCount(eventType: string): number;

  /**
   * Unsubscribe a specific handler from an event type
   * @param eventType The event type to unsubscribe from
   * @param handler The handler to unsubscribe
   */
  unsubscribe(eventType: string, handler: EventHandler<any>): void;

  /**
   * Apply backpressure strategy to an event type
   * @param eventType The event type to apply backpressure to
   * @param strategy The backpressure strategy to apply
   */
  applyBackpressure(eventType: string, strategy: BackpressureStrategy): void;

  /**
   * Enable event persistence with the provided storage
   * @param storage The event storage to use
   */
  enablePersistence(storage: EventStorage): void;

  /**
   * Disable event persistence
   */
  disablePersistence(): void;

  /**
   * Add an event router to route events to additional channels
   * @param router The event router function
   */
  addEventRouter(router: (event: DomainEvent<any>) => string[]): void;

  /**
   * Add a global event filter
   * @param filter The filter function
   */
  addEventFilter(filter: (event: DomainEvent<any>) => boolean): void;

  /**
   * Get events by correlation ID
   * @param correlationId The correlation ID to search for
   */
  correlate(correlationId: string): Promise<DomainEvent<any>[]>;
}

/**
 * Event storage for persistence and replay
 */
export interface EventStorage {
  /**
   * Store an event
   * @param event The event to store
   */
  storeEvent<T>(event: DomainEvent<T>): Promise<Result<void>>;
  
  /**
   * Retrieve events by type within a time range
   * @param eventType The type of events to retrieve
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  getEventsByType<T>(
    eventType: string,
    startTime?: number,
    endTime?: number
  ): Promise<Result<DomainEvent<T>[]>>;
  
  /**
   * Retrieve events by correlation ID
   * @param correlationId The correlation ID to search for
   */
  getEventsByCorrelationId<T>(
    correlationId: string
  ): Promise<Result<DomainEvent<T>[]>>;
  
  /**
   * Get all events within a time range
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  getAllEvents<T>(
    startTime?: number,
    endTime?: number
  ): Promise<Result<DomainEvent<T>[]>>;
}

/**
 * Event source for replayable event streams
 */
export interface EventSource {
  /**
   * Replay events by type within a time range
   * @param eventType The type of events to replay
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  replayEvents<T>(
    eventType: string,
    startTime?: number,
    endTime?: number
  ): Promise<Result<void>>;
  
  /**
   * Replay events by correlation ID
   * @param correlationId The correlation ID to replay events for
   */
  replayByCorrelationId<T>(
    correlationId: string
  ): Promise<Result<void>>;
} 