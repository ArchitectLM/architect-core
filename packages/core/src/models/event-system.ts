import { DomainEvent, Identifier, Metadata, Result } from './core-types';
import { BackpressureStrategy } from './backpressure';

/**
 * Event bus interface for publishing and subscribing to events
 */
export interface EventBus {
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
  unsubscribe<T>(eventType: string, handler: EventHandler<T>): void;
  
  /**
   * Unsubscribe using subscription ID
   * @param subscriptionId The ID of the subscription to remove
   */
  unsubscribeById(subscriptionId: Identifier): void;

  /**
   * Apply backpressure strategy to an event type
   * @param eventType The event type to apply backpressure to
   * @param strategy The backpressure strategy to apply
   */
  applyBackpressure(eventType: string, strategy: BackpressureStrategy): void;
  
  /**
   * Get events by correlation ID
   * @param correlationId The correlation ID to search for
   */
  correlate(correlationId: string): Promise<DomainEvent<unknown>[]>;

  /**
   * Enable event persistence with storage
   * @param storage The event storage to use for persistence
   */
  enablePersistence(storage: EventStorage): void;
  
  /**
   * Disable event persistence
   */
  disablePersistence(): void;

  /**
   * Add a global event filter
   * @param filter Filter function to determine which events to handle
   */
  addEventFilter(filter: (event: DomainEvent<unknown>) => boolean): void;

  /**
   * Add an event router function
   * @param router Function that maps events to additional topics
   */
  addEventRouter(router: (event: DomainEvent<unknown>) => string[]): void;

  /**
   * Check if there are any subscribers for a given event type
   * @param eventType The event type to check
   */
  hasSubscribers(eventType: string): boolean;
}

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
  metadata?: Record<string, unknown>;
}

/**
 * Event filter function type
 */
export type EventFilter<T> = (event: DomainEvent<T>) => boolean;

/**
 * Event handler function type
 */
export type EventHandler<T> = (payload: T) => Promise<void>;

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
 * Event storage interface for persisting and retrieving events
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
   * @param startTime Start of the time range (optional)
   * @param endTime End of the time range (optional)
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
   * @param startTime Start of the time range (optional)
   * @param endTime End of the time range (optional)
   */
  getAllEvents<T>(
    startTime?: number,
    endTime?: number
  ): Promise<Result<DomainEvent<T>[]>>;
}

/**
 * Event dispatcher interface for components that can dispatch events
 */
export type EventDispatcher = Pick<EventBus, 'publish' | 'publishAll'>;

/**
 * Event subscriber interface for components that can subscribe to events
 */
export type EventSubscriber = Pick<EventBus, 'subscribe' | 'subscribeWithFilter' | 'unsubscribe'>;

/**
 * Event factory for creating domain events
 */
export interface EventFactory {
  /**
   * Create a new domain event
   * @param type The event type
   * @param payload The event payload
   * @param metadata Additional metadata for the event
   */
  createEvent<T>(
    type: string,
    payload: T,
    metadata?: Record<string, unknown>
  ): DomainEvent<T>;

  /**
   * Create a correlated event (linked to previous events)
   * @param type The event type
   * @param payload The event payload
   * @param correlationId The correlation ID to use
   * @param metadata Additional metadata for the event
   */
  createCorrelatedEvent<T>(
    type: string,
    payload: T,
    correlationId: string,
    metadata?: Record<string, unknown>
  ): DomainEvent<T>;
}

/**
 * Event handler registry for managing task handlers
 */
export interface EventHandlerRegistry {
  /**
   * Register an event handler
   * @param eventType The event type to handle
   * @param handler The handler to register
   */
  registerHandler<T>(eventType: string, handler: EventHandler<T>): void;

  /**
   * Unregister an event handler
   * @param eventType The event type
   * @param handler The handler to unregister
   */
  unregisterHandler<T>(eventType: string, handler: EventHandler<T>): void;

  /**
   * Get all handlers for an event type
   * @param eventType The event type
   */
  getHandlers<T>(eventType: string): EventHandler<T>[];

  /**
   * Check if there are handlers for an event type
   * @param eventType The event type
   */
  hasHandlers(eventType: string): boolean;
}

/**
 * Event replay manager for replaying events
 */
export interface EventReplayManager {
  /**
   * Replay events within a time range
   * @param startTime Start of the time range
   * @param endTime End of the time range
   * @param eventTypes Optional filter for event types to replay
   */
  replayEvents(
    startTime: number,
    endTime: number,
    eventTypes?: string[]
  ): Promise<Result<void>>;

  /**
   * Replay events for a specific correlation ID
   * @param correlationId The correlation ID
   */
  replayCorrelatedEvents(correlationId: string): Promise<Result<void>>;
}

/**
 * Event metrics collector for monitoring events
 */
export interface EventMetricsCollector {
  /**
   * Record an event publication
   * @param eventType The event type
   */
  recordEventPublished(eventType: string): void;

  /**
   * Record an event subscription
   * @param eventType The event type
   */
  recordEventSubscribed(eventType: string): void;

  /**
   * Record an event handler execution
   * @param eventType The event type
   * @param duration The execution duration in ms
   * @param success Whether the execution was successful
   */
  recordHandlerExecution(
    eventType: string,
    duration: number,
    success: boolean
  ): void;

  /**
   * Get metrics for all events
   */
  getMetrics(): Record<string, any>;
}

/**
 * Event source interface for replaying events
 */
export interface EventSource {
  /**
   * Replay events of a specific type within a time range
   * @param eventType The type of events to replay (or '*' for all)
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  replayEvents(
    eventType: string,
    startTime: number,
    endTime: number
  ): Promise<Result<void>>;

  /**
   * Replay events for a specific correlation ID
   * @param correlationId The correlation ID to replay events for
   */
  replayCorrelatedEvents(
    correlationId: string
  ): Promise<Result<void>>;
} 