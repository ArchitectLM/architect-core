import { Extension } from '../models/extension';
import { EventBus, EventStorage } from '../models/event-system';
import { ExtensionSystem } from '../models/extension';
import { v4 as uuidv4 } from 'uuid';
import { ExtensionPoint, ExtensionHook, ExtensionContext } from '../models/extension';
import { DomainEvent, Result } from '../models/core-types';

interface EventPersistenceOptions {
  storage: EventStorage;
  maxEvents?: number;
  retentionPeriod?: number; // in milliseconds
}

interface ReplayContext {
  fromTimestamp: number;
  toTimestamp: number;
  eventTypes?: string[];
  events?: DomainEvent<any>[];
}

interface CorrelationContext {
  correlationId: string;
  events?: DomainEvent<any>[];
}

export class EventPersistencePlugin implements Extension {
  name = 'event-persistence';
  description = 'Handles event persistence, replay, and correlation';

  private options: Required<EventPersistenceOptions>;

  constructor(
    private eventBus: EventBus,
    private extensionSystem: ExtensionSystem,
    options: EventPersistenceOptions
  ) {
    this.options = {
      storage: options.storage,
      maxEvents: options.maxEvents || 10000,
      retentionPeriod: options.retentionPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
    };
  }

  getExtension(): Extension {
    return {
      name: this.name,
      description: this.description,
      hooks: this.hooks
    };
  }

  hooks: Partial<Record<ExtensionPoint, ExtensionHook>> = {
    'event:beforeReplay': async (context: ExtensionContext) => {
      const event = context.data as DomainEvent<any>;
      
      // Add metadata if not present
      event.metadata = event.metadata || {};

      // Ensure required metadata fields
      event.id = event.id || uuidv4();
      event.timestamp = event.timestamp || Date.now();
      event.metadata.source = event.metadata.source || 'event-persistence';

      return {
        ...context,
        data: event
      };
    },

    'event:afterReplay': async (context: ExtensionContext) => {
      const event = context.data as DomainEvent<any>;
      
      // Persist event
      await this.persistEvent(event);

      return context;
    }
  };

  async persistEvent(event: DomainEvent<any>): Promise<void> {
    // Store event
    const result = await this.options.storage.storeEvent(event);
    if (!result.success) {
      throw new Error(`Failed to store event: ${result.error.message}`);
    }

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
    const result = await this.options.storage.getAllEvents<any>(fromTimestamp, toTimestamp);
    if (!result.success) {
      throw new Error(`Failed to retrieve events for replay: ${result.error.message}`);
    }

    const events = result.value.filter(event => !eventTypes || eventTypes.includes(event.type));

    // Publish replay start event
    await this.eventBus.publish({
      id: uuidv4(),
      type: 'event:replayStarted',
      timestamp: Date.now(),
      payload: {
        fromTimestamp,
        toTimestamp,
        eventTypes,
        eventCount: events.length
      }
    });

    // Replay events in order
    for (const event of events) {
      await this.eventBus.publish({
        ...event,
        metadata: {
          ...event.metadata,
          isReplay: true,
          originalTimestamp: event.timestamp
        }
      });
    }

    // Publish replay completion event
    await this.eventBus.publish({
      id: uuidv4(),
      type: 'event:replayCompleted',
      timestamp: Date.now(),
      payload: {
        fromTimestamp,
        toTimestamp,
        eventTypes,
        eventCount: events.length
      }
    });
  }

  async correlateEvents(correlationId: string): Promise<DomainEvent<any>[]> {
    // Execute beforeCorrelation extension point
    const correlationContext = await this.extensionSystem.executeExtensionPoint<CorrelationContext>('event:beforeCorrelation', {
      correlationId
    });

    // Get correlated events from storage
    const result = await this.options.storage.getEventsByCorrelationId<any>(correlationId);
    if (!result.success) {
      throw new Error(`Failed to retrieve correlated events: ${result.error.message}`);
    }

    return result.value;
  }

  private async cleanupOldEvents(): Promise<void> {
    const now = Date.now();
    const cutoffTime = now - this.options.retentionPeriod;

    // Get events older than retention period
    const result = await this.options.storage.getAllEvents<any>(0, cutoffTime);
    if (!result.success) {
      console.error(`Failed to retrieve old events: ${result.error.message}`);
      return;
    }
    
    // Note: The EventStorage interface doesn't have a delete method,
    // so we'll need to implement a different cleanup strategy
    // For now, we'll just log a warning
    console.warn(`Found ${result.value.length} events older than retention period`);
  }

  // Utility methods for testing and debugging
  clear(): void {
    // No-op since we don't maintain any state
  }
}

export function createEventPersistencePlugin(
  eventBus: EventBus,
  extensionSystem: ExtensionSystem,
  options: EventPersistenceOptions
): EventPersistencePlugin {
  return new EventPersistencePlugin(eventBus, extensionSystem, options);
} 