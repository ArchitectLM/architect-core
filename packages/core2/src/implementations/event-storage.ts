import { Event, EventFilter, EventStorage } from '../models/event.js';

export class InMemoryEventStorage implements EventStorage {
  private events: Event[] = [];
  private eventIndex: Map<string, Event> = new Map();
  private correlationIndex: Map<string, Set<string>> = new Map();

  async saveEvent(event: Event): Promise<void> {
    // Ensure event has required fields
    if (!event.id) {
      event.id = `event-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    }
    if (!event.timestamp) {
      event.timestamp = Date.now();
    }

    // Add to main storage
    this.events.push(event);
    
    // Update indexes
    this.eventIndex.set(event.id, event);
    
    if (event.correlationId) {
      if (!this.correlationIndex.has(event.correlationId)) {
        this.correlationIndex.set(event.correlationId, new Set());
      }
      this.correlationIndex.get(event.correlationId)!.add(event.id);
    }
  }

  async getEvents(filter: EventFilter): Promise<Event[]> {
    let filteredEvents = [...this.events];

    // Apply type filters
    if (filter.types && filter.types.length > 0) {
      filteredEvents = filteredEvents.filter(e => filter.types!.includes(e.type));
    }

    if (filter.excludeTypes && filter.excludeTypes.length > 0) {
      filteredEvents = filteredEvents.filter(e => !filter.excludeTypes!.includes(e.type));
    }

    // Apply timestamp filters
    if (filter.fromTimestamp !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.timestamp >= filter.fromTimestamp!);
    }

    if (filter.toTimestamp !== undefined) {
      filteredEvents = filteredEvents.filter(e => e.timestamp <= filter.toTimestamp!);
    }

    // Apply correlation ID filter
    if (filter.correlationIds && filter.correlationIds.length > 0) {
      const correlatedEventIds = new Set<string>();
      for (const correlationId of filter.correlationIds) {
        const eventIds = this.correlationIndex.get(correlationId);
        if (eventIds) {
          eventIds.forEach(id => correlatedEventIds.add(id));
        }
      }
      filteredEvents = filteredEvents.filter(e => correlatedEventIds.has(e.id!));
    }

    // Apply metadata filter
    if (filter.metadataFilter) {
      filteredEvents = filteredEvents.filter(e => {
        if (!e.metadata) return false;
        
        return Object.entries(filter.metadataFilter!).every(([key, value]) => 
          e.metadata![key] === value
        );
      });
    }

    // Sort by timestamp ascending
    return filteredEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  async getEventById(eventId: string): Promise<Event | undefined> {
    return this.eventIndex.get(eventId);
  }

  async getEventsByCorrelationId(correlationId: string): Promise<Event[]> {
    const eventIds = this.correlationIndex.get(correlationId);
    if (!eventIds) {
      return [];
    }
    
    return Array.from(eventIds)
      .map(id => this.eventIndex.get(id)!)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // Additional utility methods for testing and debugging
  clear(): void {
    this.events = [];
    this.eventIndex.clear();
    this.correlationIndex.clear();
  }

  getEventCount(): number {
    return this.events.length;
  }

  getCorrelationCount(): number {
    return this.correlationIndex.size;
  }
}

export function createEventStorage(): EventStorage {
  return new InMemoryEventStorage();
} 