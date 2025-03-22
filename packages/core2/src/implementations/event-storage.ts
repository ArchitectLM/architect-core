import { DomainEvent, Result } from '../models/core-types';
import { EventStorage } from '../models/event-system';

/**
 * In-memory event storage implementation
 */
export class InMemoryEventStorage implements EventStorage {
  private events: DomainEvent<any>[] = [];
  private eventIndex: Map<string, DomainEvent<any>> = new Map();
  private correlationIndex: Map<string, DomainEvent<any>[]> = new Map();

  async storeEvent<T>(event: DomainEvent<T>): Promise<Result<void>> {
    try {
      // Store event in array
      this.events.push(event);
      
      // Index by event ID
      this.eventIndex.set(event.id, event);
      
      // Index by correlation ID if present
      if (event.metadata?.correlationId) {
        const correlationId = event.metadata.correlationId as string;
        const correlatedEvents = this.correlationIndex.get(correlationId) || [];
        correlatedEvents.push(event);
        this.correlationIndex.set(correlationId, correlatedEvents);
      }
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async getEventsByType<T>(
    eventType: string,
    startTime?: number,
    endTime?: number
  ): Promise<Result<DomainEvent<T>[]>> {
    try {
      const filteredEvents = this.events.filter(event => {
        const matchesType = event.type === eventType;
        const matchesTimeRange = (!startTime || event.timestamp >= startTime) &&
                               (!endTime || event.timestamp <= endTime);
        return matchesType && matchesTimeRange;
      });

      return { success: true, value: filteredEvents as DomainEvent<T>[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async getEventsByCorrelationId<T>(
    correlationId: string
  ): Promise<Result<DomainEvent<T>[]>> {
    try {
      const correlatedEvents = this.correlationIndex.get(correlationId) || [];
      return { success: true, value: correlatedEvents as DomainEvent<T>[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  async getAllEvents<T>(
    startTime?: number,
    endTime?: number
  ): Promise<Result<DomainEvent<T>[]>> {
    try {
      const filteredEvents = this.events.filter(event => {
        return (!startTime || event.timestamp >= startTime) &&
               (!endTime || event.timestamp <= endTime);
      });

      return { success: true, value: filteredEvents as DomainEvent<T>[] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Clear all stored events
   */
  clear(): void {
    this.events = [];
    this.eventIndex.clear();
    this.correlationIndex.clear();
  }

  /**
   * Get the total number of stored events
   */
  getEventCount(): number {
    return this.events.length;
  }
}

/**
 * Creates a new in-memory event storage instance
 */
export function createEventStorage(): EventStorage {
  return new InMemoryEventStorage();
} 