import { Extension } from '../models/extension.js';
import { Event, EventStorage, EventFilter, EventRouter } from '../models/event.js';
import { EventBus } from '../models/event.js';
import { ExtensionSystem } from '../models/extension.js';
import { v4 as uuidv4 } from 'uuid';

interface EventPersistenceOptions {
  storage: EventStorage;
  maxEvents?: number;
  retentionPeriod?: number; // in milliseconds
  routers?: EventRouter[];
}

interface ReplayContext {
  fromTimestamp: number;
  toTimestamp: number;
  eventTypes?: string[];
  events?: Event[];
}

interface CorrelationContext {
  correlationId: string;
  events?: Event[];
}

export class EventPersistencePlugin implements Extension {
  name = 'event-persistence';
  description = 'Handles event persistence, replay, and correlation';

  private options: Required<EventPersistenceOptions>;
  private routers: EventRouter[] = [];

  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem,
    options: EventPersistenceOptions
  ) {
    this.options = {
      storage: options.storage,
      maxEvents: options.maxEvents || 10000,
      retentionPeriod: options.retentionPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
      routers: options.routers || []
    };
    this.routers = this.options.routers;
  }

  hooks = {
    'event:beforePublish': async (context: any) => {
      const { event } = context;
      
      // Add metadata if not present
      event.metadata = event.metadata || {};

      // Ensure required metadata fields
      event.metadata.id = event.metadata.id || uuidv4();
      event.metadata.timestamp = event.metadata.timestamp || Date.now();
      event.metadata.source = event.metadata.source || 'event-persistence';

      // Route event if routers are configured
      if (this.routers.length > 0) {
        const routes = await this.routeEvent(event);
        event.metadata.routes = routes;
      }

      return {
        ...context,
        event
      };
    },

    'event:afterPublish': async (context: any) => {
      const { event } = context;
      
      // Persist event
      await this.persistEvent(event);

      return context;
    }
  };

  async persistEvent(event: Event): Promise<void> {
    // Store event
    await this.options.storage.saveEvent(event);

    // Clean up old events if needed
    await this.cleanupOldEvents();
  }

  async replayEvents(fromTimestamp: number, toTimestamp: number, eventTypes?: string[]): Promise<void> {
    // Execute beforeReplay extension point
    const replayContext = await this.extensionSystem.executeExtensionPoint<ReplayContext>('event:beforeReplay', {
      fromTimestamp,
      toTimestamp,
      eventTypes
    });

    // Get events from storage
    const filter: EventFilter = {
      fromTimestamp,
      toTimestamp,
      types: eventTypes
    };

    const events = await this.options.storage.getEvents(filter);
    if (!events) {
      throw new Error('Failed to retrieve events for replay');
    }

    // Publish replay start event
    this.eventBus.publish('event:replayStarted', {
      fromTimestamp,
      toTimestamp,
      eventTypes,
      eventCount: events.length
    });

    // Replay events in order
    for (const event of events) {
      const metadata = event.metadata || {};
      await this.eventBus.publish(event.type, event.payload, {
        metadata: {
          ...metadata,
          isReplay: true,
          originalTimestamp: metadata.timestamp
        }
      });
    }

    // Publish replay completion event
    this.eventBus.publish('event:replayCompleted', {
      fromTimestamp,
      toTimestamp,
      eventTypes,
      eventCount: events.length
    });
  }

  async correlateEvents(correlationId: string): Promise<Event[]> {
    // Execute beforeCorrelation extension point
    const correlationContext = await this.extensionSystem.executeExtensionPoint<CorrelationContext>('event:beforeCorrelation', {
      correlationId
    });

    // Get correlated events from storage
    const events = await this.options.storage.getEventsByCorrelationId(correlationId);
    if (!events) {
      throw new Error('Failed to retrieve correlated events');
    }

    return events;
  }

  addEventRouter(router: EventRouter): void {
    this.routers.push(router);
  }

  removeEventRouter(router: EventRouter): void {
    this.routers = this.routers.filter(r => r !== router);
  }

  private async routeEvent(event: Event): Promise<string[]> {
    const routes: string[] = [];
    
    for (const router of this.routers) {
      const routeResults = await router(event);
      routes.push(...routeResults);
    }

    return routes;
  }

  private async cleanupOldEvents(): Promise<void> {
    const now = Date.now();
    const cutoffTime = now - this.options.retentionPeriod;

    // Get events older than retention period
    const oldEvents = await this.options.storage.getEvents({
      toTimestamp: cutoffTime
    });
    
    // Note: The EventStorage interface doesn't have a delete method,
    // so we'll need to implement a different cleanup strategy
    // For now, we'll just log a warning
    console.warn(`Found ${oldEvents.length} events older than retention period`);
  }

  // Utility methods for testing and debugging
  getRouters(): EventRouter[] {
    return [...this.routers];
  }

  clear(): void {
    this.routers = [];
  }
}

export function createEventPersistencePlugin(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem,
  options: EventPersistenceOptions
): EventPersistencePlugin {
  return new EventPersistencePlugin(eventBus, extensionSystem, options);
} 