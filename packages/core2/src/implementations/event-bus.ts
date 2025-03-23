import { v4 as uuidv4 } from 'uuid';
import { 
  EventBus, 
  EventFilter, 
  EventHandler, 
  Subscription, 
  SubscriptionOptions,
  EventStorage,
  EventDispatcher,
  EventSubscriber
} from '../models/event-system';
import { BackpressureStrategy } from '../models/backpressure';
import { DomainEvent, Identifier, Result } from '../models/core-types';
import { ExtensionSystem, ExtensionPointNames, ExtensionPointParameters } from '../models/extension-system';
import { InMemoryExtensionSystem } from './extension-system';

/**
 * Concrete implementation of the EventBus interface that integrates with the extension system
 */
export class ExtensionEventBusImpl implements EventBus {
  /** Map of event type to subscriptions */
  private subscriptions = new Map<string, Set<{
    id: Identifier;
    handler: EventHandler<unknown>;
    filter?: EventFilter<unknown>;
    options: SubscriptionOptions;
  }>>();
  
  /** Map of subscription ID to event type for faster lookups */
  private subscriptionIdToType = new Map<Identifier, string>();

  /** Event storage for persistence */
  private storage?: EventStorage;

  /** Global event filters */
  private globalFilters: Array<(event: DomainEvent<unknown>) => boolean> = [];

  /** Event routers */
  private eventRouters: Array<(event: DomainEvent<unknown>) => string[]> = [];

  /** Backpressure strategies by event type */
  private backpressureStrategies = new Map<string, BackpressureStrategy>();

  /** Extension point initialization state */
  private extensionPointsInitialized = false;

  constructor(private readonly extensionSystem: ExtensionSystem) {}

  /**
   * Ensure that extension points are properly initialized
   * This should be called before the first event is published
   */
  private async ensureExtensionPointsInitialized(): Promise<void> {
    if (this.extensionPointsInitialized) {
      return;
    }

    // Defensive check to ensure the extension system is properly initialized
    try {
      // Execute a simple extension point call to validate the extension system
      const validateResult = await this.extensionSystem.executeExtensionPoint(
        ExtensionPointNames.SYSTEM_INIT,
        {
          version: '1.0.0',
          config: {}
        }
      );

      // If validateResult is undefined, it means the extension system is not properly initialized
      if (!validateResult) {
        console.warn('Extension system did not return a result - it may not be properly initialized');
      }

      this.extensionPointsInitialized = true;
    } catch (error) {
      console.warn('Failed to initialize extension points:', error instanceof Error ? error.message : String(error));
      // Don't throw here to ensure that the event bus can still work without extension points
      this.extensionPointsInitialized = false;
    }
  }

  /**
   * Subscribe to events of a given type
   */
  public subscribe<T>(
    eventType: string, 
    handler: EventHandler<T>, 
    options: SubscriptionOptions = {}
  ): Subscription {
    const subscriptionId = uuidv4();
    const subscriptions = this.getOrCreateEventTypeSubscriptions(eventType);
    
    subscriptions.add({
      id: subscriptionId,
      handler: handler as EventHandler<unknown>,
      options
    });
    
    this.subscriptionIdToType.set(subscriptionId, eventType);
    
    return {
      id: subscriptionId,
      eventType,
      unsubscribe: () => this.unsubscribeById(subscriptionId)
    };
  }
  
  /**
   * Subscribe to events of a given type with a filter
   */
  public subscribeWithFilter<T>(
    eventType: string, 
    filter: EventFilter<T>, 
    handler: EventHandler<T>, 
    options: SubscriptionOptions = {}
  ): Subscription {
    const subscriptionId = uuidv4();
    const subscriptions = this.getOrCreateEventTypeSubscriptions(eventType);
    
    subscriptions.add({
      id: subscriptionId,
      handler: handler as EventHandler<unknown>,
      filter: filter as EventFilter<unknown>,
      options
    });
    
    this.subscriptionIdToType.set(subscriptionId, eventType);
    
    return {
      id: subscriptionId,
      eventType,
      unsubscribe: () => this.unsubscribeById(subscriptionId)
    };
  }
  
  /**
   * Safely execute an extension point with error handling
   * @param pointName The extension point name
   * @param params The parameters for the extension point
   * @returns Result of the extension point execution or null if failed
   */
  private async safeExecuteExtensionPoint<N extends keyof ExtensionPointParameters>(
    pointName: N,
    params: ExtensionPointParameters[N]
  ): Promise<Result<ExtensionPointParameters[N]> | null> {
    try {
      await this.ensureExtensionPointsInitialized();
      
      // If extension points initialization failed, skip extension point execution
      if (!this.extensionPointsInitialized) {
        return null;
      }

      // Cast the point name to string for the extension system
      const result = await this.extensionSystem.executeExtensionPoint(
        pointName as unknown as string, 
        params
      );
      return result;
    } catch (error) {
      console.warn(`Failed to execute extension point ${String(pointName)}:`, error instanceof Error ? error.message : String(error));
      return null;
    }
  }
  
  /**
   * Publish an event to all subscribers
   * @param event The event to publish
   */
  public async publish<T>(event: DomainEvent<T>): Promise<void> {
    // Apply global filters
    if (this.globalFilters.some(filter => !filter(event))) {
      return;
    }

    // Execute before publish hooks
    const beforeResult = await this.safeExecuteExtensionPoint(
      ExtensionPointNames.EVENT_BEFORE_PUBLISH,
      {
        eventType: event.type,
        payload: event.payload
      }
    );

    // Only fail if we got a result and it failed
    if (beforeResult && !beforeResult.success) {
      throw beforeResult.error;
    }

    // If interceptor modified the payload, use the new payload
    let eventToPublish = event;
    if (beforeResult && beforeResult.success && beforeResult.value) {
      eventToPublish = {
        ...event,
        payload: beforeResult.value.payload as T
      };
    }

    // Get subscribers for this event type
    const subscribers = this.subscriptions.get(eventToPublish.type) || new Set();

    // Apply backpressure if configured
    const strategy = this.backpressureStrategies.get(eventToPublish.type);
    if (strategy) {
      const queueDepth = this.subscriberCount(eventToPublish.type);
      if (!strategy.shouldAccept(queueDepth)) {
        await new Promise(resolve => setTimeout(resolve, strategy.calculateDelay()));
      }
    }

    // Keep track of once handlers that will be removed after execution
    const onceHandlers = new Set<EventHandler<unknown>>();

    // Sort subscribers by priority (highest first) and filter them
    const sortedSubscribers = Array.from(subscribers)
      .filter(sub => !sub.filter || sub.filter(eventToPublish))
      .sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));
    
    // Collect once handlers that need to be removed
    sortedSubscribers.forEach(sub => {
      if (sub.options.once) {
        onceHandlers.add(sub.handler);
      }
    });

    // Execute handlers
    for (const subscriber of sortedSubscribers) {
      try {
        await subscriber.handler(eventToPublish.payload);
      } catch (error) {
        console.error(`Error in event handler for ${eventToPublish.type}:`, error);
      }
    }

    // Remove 'once' handlers
    if (onceHandlers.size > 0) {
      for (const handler of onceHandlers) {
        this.unsubscribe(eventToPublish.type, handler);
      }
    }

    // Route event to additional topics if routers are defined
    for (const router of this.eventRouters) {
      try {
        const additionalTopics = router(eventToPublish);
        for (const topic of additionalTopics) {
          if (topic !== eventToPublish.type) {
            await this.publish({
              ...eventToPublish,
              type: topic
            });
          }
        }
      } catch (error) {
        console.error('Error in event router:', error);
      }
    }

    // Persist the event if storage is configured
    if (this.storage) {
      try {
        await this.storage.storeEvent(eventToPublish);
      } catch (error) {
        console.error('Error persisting event:', error);
      }
    }

    // Execute after publish hooks
    await this.safeExecuteExtensionPoint(
      ExtensionPointNames.EVENT_AFTER_PUBLISH,
      {
        eventType: eventToPublish.type,
        payload: eventToPublish.payload,
        eventId: eventToPublish.id
      }
    );
  }

  /**
   * Publish multiple events in order
   * @param events Array of events to publish
   */
  public async publishAll<T>(events: DomainEvent<T>[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * Remove all subscriptions for a specific event type
   * @param eventType The event type to clear subscriptions for
   */
  public clearSubscriptions(eventType: string): void {
    this.subscriptions.delete(eventType);
  }

  /**
   * Remove all subscriptions
   */
  public clearAllSubscriptions(): void {
    this.subscriptions.clear();
    this.subscriptionIdToType.clear();
  }

  /**
   * Get the count of subscribers for an event type
   * @param eventType The event type to check
   */
  public subscriberCount(eventType: string): number {
    const subscribers = this.subscriptions.get(eventType);
    return subscribers ? subscribers.size : 0;
  }

  /**
   * Unsubscribe using subscription ID
   * @param subscriptionId The ID of the subscription to remove
   */
  public unsubscribeById(subscriptionId: Identifier): void {
    const eventType = this.subscriptionIdToType.get(subscriptionId);
    if (!eventType) return;
    
    const subscribers = this.subscriptions.get(eventType);
    if (!subscribers) return;
    
    // Find and remove the subscription with the matching ID
    const subscription = Array.from(subscribers).find(s => s.id === subscriptionId);
    if (subscription) {
      subscribers.delete(subscription);
      this.subscriptionIdToType.delete(subscriptionId);
    }
  }
  
  /**
   * Unsubscribe a specific handler from an event type
   * @param eventType The event type to unsubscribe from
   * @param handler The handler to unsubscribe
   */
  public unsubscribe<T>(eventType: string, handler: EventHandler<T>): void {
    const subscribers = this.subscriptions.get(eventType);
    if (!subscribers) return;

    // Find all subscriptions with the matching handler and remove them
    const subscriptionsToRemove = Array.from(subscribers).filter(s => s.handler === handler);
    
    for (const subscription of subscriptionsToRemove) {
      subscribers.delete(subscription);
      this.subscriptionIdToType.delete(subscription.id);
    }
  }

  /**
   * Gets existing subscription set or creates a new one
   * @param eventType The event type
   */
  private getOrCreateEventTypeSubscriptions(eventType: string): Set<{
    id: Identifier;
    handler: EventHandler<unknown>;
    filter?: EventFilter<unknown>;
    options: SubscriptionOptions;
  }> {
    const existing = this.subscriptions.get(eventType);
    if (existing) {
      return existing;
    }
    
    const newSet = new Set<{
      id: Identifier;
      handler: EventHandler<unknown>;
      filter?: EventFilter<unknown>;
      options: SubscriptionOptions;
    }>();
    
    this.subscriptions.set(eventType, newSet);
    return newSet;
  }

  /**
   * Apply backpressure strategy to an event type
   * @param eventType The event type to apply backpressure to
   * @param strategy The backpressure strategy to apply
   */
  public applyBackpressure(eventType: string, strategy: BackpressureStrategy): void {
    this.backpressureStrategies.set(eventType, strategy);
  }

  /**
   * Enable event persistence with storage
   * @param storage The event storage to use for persistence
   */
  public enablePersistence(storage: EventStorage): void {
    this.storage = storage;
  }

  /**
   * Disable event persistence
   */
  public disablePersistence(): void {
    this.storage = undefined;
  }

  /**
   * Add a global event filter
   * @param filter Filter function to determine which events to handle
   */
  public addEventFilter(filter: (event: DomainEvent<unknown>) => boolean): void {
    this.globalFilters.push(filter);
  }

  /**
   * Add an event router function
   * @param router Function that maps events to additional topics
   */
  public addEventRouter(router: (event: DomainEvent<unknown>) => string[]): void {
    this.eventRouters.push(router);
  }

  /**
   * Get events by correlation ID
   * @param correlationId The correlation ID to search for
   */
  public async correlate(correlationId: string): Promise<DomainEvent<unknown>[]> {
    if (!this.storage) {
      return [];
    }

    const result = await this.storage.getEventsByCorrelationId<unknown>(correlationId);
    // Ensure we don't return undefined
    return result.success && result.value ? result.value : [];
  }

  /**
   * Check if there are any subscribers for a given event type
   * @param eventType The event type to check
   */
  public hasSubscribers(eventType: string): boolean {
    const subscribers = this.subscriptions.get(eventType);
    return !!subscribers && subscribers.size > 0;
  }
}

/**
 * In-memory event bus implementation that adds additional methods for testing
 */
export class InMemoryEventBus implements EventBus {
  // Use composition for better flexibility
  private eventBusDelegate: ExtensionEventBusImpl;

  /**
   * Create a new in-memory event bus with minimal extension system
   */
  constructor(extensionSystem?: ExtensionSystem) {
    // If no extension system is provided, create a minimal in-memory one
    this.eventBusDelegate = new ExtensionEventBusImpl(extensionSystem || new InMemoryExtensionSystem());
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>, options?: SubscriptionOptions): Subscription {
    return this.eventBusDelegate.subscribe(eventType, handler, options);
  }

  /**
   * Subscribe to an event type with a filter
   */
  subscribeWithFilter<T>(eventType: string, filter: EventFilter<T>, handler: EventHandler<T>, options?: SubscriptionOptions): Subscription {
    return this.eventBusDelegate.subscribeWithFilter(eventType, filter, handler, options);
  }

  /**
   * Publish an event with simplified interface for testing
   * @param eventOrType Either a full event object or an event type string
   * @param payload Optional payload if eventOrType is a string
   */
  async publish<T>(eventOrType: DomainEvent<T> | string, payload?: T): Promise<void> {
    if (typeof eventOrType === 'string') {
      // Create a simplified event when only type and payload are provided
      const event: DomainEvent<T> = {
        id: uuidv4(),
        type: eventOrType,
        timestamp: Date.now(),
        payload: payload as unknown as T,
        metadata: {}
      };
      await this.eventBusDelegate.publish(event);
    } else {
      await this.eventBusDelegate.publish(eventOrType);
    }
  }

  /**
   * Publish multiple events in order
   * @param events Array of events to publish
   */
  async publishAll<T>(events: DomainEvent<T>[]): Promise<void> {
    await this.eventBusDelegate.publishAll(events);
  }

  /**
   * Remove all subscriptions for a specific event type
   */
  clearSubscriptions(eventType: string): void {
    this.eventBusDelegate.clearSubscriptions(eventType);
  }

  /**
   * Remove all subscriptions
   */
  clearAllSubscriptions(): void {
    this.eventBusDelegate.clearAllSubscriptions();
  }

  /**
   * Get the count of subscribers for an event type
   */
  subscriberCount(eventType: string): number {
    return this.eventBusDelegate.subscriberCount(eventType);
  }

  /**
   * Unsubscribe a specific handler from an event type
   */
  unsubscribe<T>(eventType: string, handler: EventHandler<T>): void {
    this.eventBusDelegate.unsubscribe(eventType, handler);
  }

  /**
   * Unsubscribe using subscription ID
   */
  unsubscribeById(subscriptionId: Identifier): void {
    this.eventBusDelegate.unsubscribeById(subscriptionId);
  }

  /**
   * Configure backpressure for an event type
   */
  applyBackpressure(eventType: string, strategy: BackpressureStrategy): void {
    this.eventBusDelegate.applyBackpressure(eventType, strategy);
  }

  /**
   * Enable event persistence with storage
   */
  enablePersistence(storage: EventStorage): void {
    this.eventBusDelegate.enablePersistence(storage);
  }

  /**
   * Disable event persistence
   */
  disablePersistence(): void {
    this.eventBusDelegate.disablePersistence();
  }

  /**
   * Get events by correlation ID
   */
  async correlate(correlationId: string): Promise<DomainEvent<unknown>[]> {
    return this.eventBusDelegate.correlate(correlationId);
  }

  /**
   * Synchronous version of publish for testing
   * @param eventType The event type
   * @param payload The event payload
   */
  publishSync<T>(eventType: string, payload: T): void {
    const event: DomainEvent<T> = {
      id: uuidv4(),
      type: eventType,
      timestamp: Date.now(),
      payload,
      metadata: {}
    };
    
    // Fire and forget - this is intentionally not awaited
    this.eventBusDelegate.publish(event).catch(error => {
      console.error(`Error in sync publish for ${eventType}:`, error);
    });
  }

  /**
   * Add a global event filter
   * @param filter Filter function to determine which events to handle
   */
  addEventFilter(filter: (event: DomainEvent<unknown>) => boolean): void {
    this.eventBusDelegate.addEventFilter(filter);
  }

  /**
   * Add an event router function
   * @param router Function that maps events to additional topics
   */
  addEventRouter(router: (event: DomainEvent<unknown>) => string[]): void {
    this.eventBusDelegate.addEventRouter(router);
  }

  /**
   * Check if there are any subscribers for a given event type
   * @param eventType The event type to check
   */
  hasSubscribers(eventType: string): boolean {
    return this.eventBusDelegate.hasSubscribers(eventType);
  }
}

/**
 * Implementation that preserves existing behavior for backward compatibility
 */
export class EventBusImpl extends InMemoryEventBus {
  constructor(extensionSystem?: ExtensionSystem) {
    super(extensionSystem);
  }
}

/**
 * Create an extension-aware event bus
 * @param extensionSystem Extension system to use for extension points
 */
export function createEventBus(extensionSystem: ExtensionSystem): EventBus {
  return new ExtensionEventBusImpl(extensionSystem);
}

/**
 * Create an in-memory event bus for testing
 * @param extensionSystem Optional extension system
 */
export function createInMemoryEventBus(extensionSystem?: ExtensionSystem): EventBus {
  return new InMemoryEventBus(extensionSystem);
}