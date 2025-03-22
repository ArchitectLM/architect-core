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
import { DomainEvent, Identifier, Metadata, Result } from '../models/core-types';
import { ExtensionSystem, ExtensionPointNames, ExtensionPointParameters } from '../models/extension-system';

/**
 * Subscription implementation with internal handler
 */
interface SubscriptionImpl<T = unknown> extends Subscription {
  /** Event handler */
  handler: EventHandler<T>;
  
  /** Event filter */
  filter?: EventFilter<T>;
  
  /** Subscription options */
  options: Required<SubscriptionOptions>;
}

/**
 * Concrete implementation of the EventBus interface that integrates with the extension system
 */
export class ExtensionEventBus implements EventBus, EventDispatcher, EventSubscriber {
  /** Map of event type to subscriptions */
  private subscriptions = new Map<string, Set<{
    id: Identifier;
    handler: EventHandler<any>;
    filter?: EventFilter<any>;
    options: SubscriptionOptions;
  }>>();
  
  /** Map of subscription ID to event type for faster lookups */
  private subscriptionIdToType = new Map<Identifier, string>();

  /** Event storage for persistence */
  private storage?: EventStorage;

  /** Global event filters */
  private globalFilters: ((event: DomainEvent<any>) => boolean)[] = [];

  /** Event routers */
  private eventRouters: ((event: DomainEvent<any>) => string[])[] = [];

  /** Backpressure strategies by event type */
  private backpressureStrategies = new Map<string, BackpressureStrategy>();

  constructor(private readonly extensionSystem: ExtensionSystem) {}

  /**
   * Subscribe to an event type
   * @param eventType The type of event to subscribe to
   * @param handler The event handler function
   * @param options Optional subscription configuration
   */
  public subscribe<T>(
    eventType: string,
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): Subscription {
    const subscriptionId = uuidv4();
    const subscribers = this.subscriptions.get(eventType) || new Set();
    
    subscribers.add({
      id: subscriptionId,
      handler,
      options
    });
    
    this.subscriptions.set(eventType, subscribers);

    return {
      id: subscriptionId,
      eventType,
      unsubscribe: () => this.unsubscribe(eventType, handler)
    };
  }
  
  /**
   * Subscribe to an event type with a filter
   * @param eventType The type of event to subscribe to
   * @param filter Filter function to determine which events to handle
   * @param handler The event handler function
   * @param options Optional subscription configuration
   */
  public subscribeWithFilter<T>(
    eventType: string,
    filter: EventFilter<T>,
    handler: EventHandler<T>,
    options: SubscriptionOptions = {}
  ): Subscription {
    const subscriptionId = uuidv4();
    const subscribers = this.subscriptions.get(eventType) || new Set();
    
    subscribers.add({
      id: subscriptionId,
      handler,
      filter,
      options
    });
    
    this.subscriptions.set(eventType, subscribers);

    return {
      id: subscriptionId,
      eventType,
      unsubscribe: () => this.unsubscribe(eventType, handler)
    };
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
    const beforeResult = await this.extensionSystem.executeExtensionPoint(
      ExtensionPointNames.EVENT_BEFORE_PUBLISH,
      {
        eventType: event.type,
        payload: event.payload
      }
    );

    if (!beforeResult.success) {
      throw beforeResult.error;
    }

    // Get subscribers for this event type
    const subscribers = this.subscriptions.get(event.type) || new Set();

    // Apply backpressure if configured
    const strategy = this.backpressureStrategies.get(event.type);
    if (strategy) {
      const queueDepth = this.subscriberCount(event.type);
      if (!strategy.shouldAccept(queueDepth)) {
        await new Promise(resolve => setTimeout(resolve, strategy.calculateDelay()));
      }
    }

    // Execute handlers in parallel
    const handlerPromises = Array.from(subscribers)
      .filter(sub => !sub.filter || sub.filter(event))
      .map(sub => sub.handler(event));

    await Promise.all(handlerPromises);

    // Store event if persistence is enabled
    if (this.storage) {
      await this.storage.storeEvent(event);
    }

    // Execute after publish hooks
    await this.extensionSystem.executeExtensionPoint(
      ExtensionPointNames.EVENT_AFTER_PUBLISH,
      {
        eventId: event.id,
        eventType: event.type,
        payload: event.payload
      }
    );

    // Route event to additional channels
    const channels = this.eventRouters.flatMap(router => router(event));
    for (const channel of channels) {
      const channelSubscribers = this.subscriptions.get(channel) || new Set();
      const channelHandlerPromises = Array.from(channelSubscribers)
        .filter(sub => !sub.filter || sub.filter(event))
        .map(sub => sub.handler(event));
      await Promise.all(channelHandlerPromises);
    }
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
  }
  
  /**
   * Get the count of subscribers for an event type
   * @param eventType The event type to check
   */
  public subscriberCount(eventType: string): number {
    return (this.subscriptions.get(eventType) || new Set()).size;
  }
  
  /**
   * Unsubscribe a specific handler from an event type
   * @param eventType The event type to unsubscribe from
   * @param handler The handler to unsubscribe
   */
  public unsubscribe(eventType: string, handler: EventHandler<any>): void {
    const subscribers = this.subscriptions.get(eventType);
    if (subscribers) {
      for (const sub of subscribers) {
        if (sub.handler === handler) {
          subscribers.delete(sub);
          break;
        }
      }
    }
  }
  
  /**
   * Get or create an array of subscriptions for an event type
   * @param eventType The event type to get subscriptions for
   */
  private getOrCreateEventTypeSubscriptions(eventType: string): Set<{
    id: Identifier;
    handler: EventHandler<any>;
    filter?: EventFilter<any>;
    options: SubscriptionOptions;
  }> {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    return this.subscriptions.get(eventType)!;
  }
  
  /**
   * Get default options with fallbacks for missing values
   * @param options The provided options
   */
  private getDefaultOptions(options: SubscriptionOptions): Required<SubscriptionOptions> {
    return {
      name: options.name || 'unnamed',
      priority: options.priority || 0,
      once: options.once || false,
      metadata: options.metadata || {}
    };
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
   * Enable event persistence with the provided storage
   * @param storage The event storage to use
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
   * Add an event router to route events to additional channels
   * @param router The event router function
   */
  public addEventRouter(router: (event: DomainEvent<any>) => string[]): void {
    this.eventRouters.push(router);
  }

  /**
   * Add a global event filter
   * @param filter The filter function
   */
  public addEventFilter(filter: (event: DomainEvent<any>) => boolean): void {
    this.globalFilters.push(filter);
  }

  /**
   * Get events by correlation ID
   * @param correlationId The correlation ID to search for
   */
  public async correlate(correlationId: string): Promise<DomainEvent<any>[]> {
    if (!this.storage) {
      return [];
    }

    const result = await this.storage.getEventsByCorrelationId(correlationId);
    return result.success ? result.value : [];
  }
}

/**
 * Creates a new event bus instance
 */
export function createEventBus(extensionSystem: ExtensionSystem): EventBus {
  return new ExtensionEventBus(extensionSystem);
}