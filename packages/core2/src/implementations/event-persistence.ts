import { Event, EventFilter, EventStorage, EventRouter } from '../models/event.js';
import { EventBus } from '../models/event.js';
import { v4 as uuidv4 } from 'uuid';

export class EventPersistenceSystem {
  private storage: EventStorage;
  private isEnabled = false;
  private routers: EventRouter[] = [];
  private replayInProgress = false;

  constructor(
    private eventBus: EventBus
  ) {}

  enablePersistence(storage: EventStorage): void {
    this.storage = storage;
    this.isEnabled = true;
  }

  disablePersistence(): void {
    this.isEnabled = false;
  }

  addEventRouter(router: EventRouter): void {
    this.routers.push(router);
  }

  removeEventRouter(router: EventRouter): void {
    const index = this.routers.indexOf(router);
    if (index !== -1) {
      this.routers.splice(index, 1);
    }
  }

  async persistEvent(event: Event): Promise<void> {
    if (!this.isEnabled) return;

    // Add metadata if not present
    if (!event.metadata) {
      event.metadata = {};
    }

    // Ensure event has required fields
    if (!event.id) {
      event.id = uuidv4();
    }
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Save event to storage
    await this.storage.saveEvent(event);

    // Route event to additional channels
    const additionalChannels = this.routeEvent(event);
    for (const channel of additionalChannels) {
      this.eventBus.publish(channel, event.payload, {
        metadata: {
          ...event.metadata,
          routedFrom: event.type
        }
      });
    }
  }

  async replayEvents(filter: EventFilter): Promise<void> {
    if (this.replayInProgress) {
      throw new Error('Event replay already in progress');
    }

    try {
      this.replayInProgress = true;

      // Emit replay started event
      this.eventBus.publish('replay:started', {
        filter,
        timestamp: Date.now()
      });

      // Get events from storage
      const events = await this.storage.getEvents(filter);

      // Sort events by timestamp
      events.sort((a, b) => a.timestamp - b.timestamp);

      // Replay each event
      for (const event of events) {
        // Add replay metadata
        const replayEvent: Event = {
          ...event,
          metadata: {
            ...event.metadata,
            isReplay: true,
            originalTimestamp: event.timestamp
          }
        };

        // Publish event
        this.eventBus.publish(event.type, event.payload, {
          metadata: replayEvent.metadata
        });
      }

      // Emit replay completed event
      this.eventBus.publish('replay:completed', {
        filter,
        eventCount: events.length,
        timestamp: Date.now()
      });
    } finally {
      this.replayInProgress = false;
    }
  }

  async correlateEvents(correlationId: string): Promise<Event[]> {
    if (!this.isEnabled) {
      throw new Error('Event persistence is not enabled');
    }

    return this.storage.getEventsByCorrelationId(correlationId);
  }

  private routeEvent(event: Event): string[] {
    const channels: string[] = [];
    
    for (const router of this.routers) {
      const additionalChannels = router(event);
      channels.push(...additionalChannels);
    }

    return channels;
  }

  // Utility methods for testing
  clear(): void {
    if ('clear' in this.storage) {
      (this.storage as any).clear();
    }
  }
}

export function createEventPersistenceSystem(eventBus: EventBus): EventPersistenceSystem {
  return new EventPersistenceSystem(eventBus);
} 