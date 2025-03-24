import { DomainEvent, Identifier, Result } from '../models/core-types';
import { EventStorage } from '../models/event-system';

/**
 * In-memory implementation of EventStorage for testing and standard usage
 */
export class InMemoryEventStorage implements EventStorage {
  private events: DomainEvent<unknown>[] = [];
  private eventsByType: Map<string, DomainEvent<unknown>[]> = new Map();
  private eventsByCorrelationId: Map<string, DomainEvent<unknown>[]> = new Map();

  /**
   * Store an event
   * @param event The event to store
   */
  public async storeEvent<T>(event: DomainEvent<T>): Promise<Result<void>> {
    try {
      // Store in main collection
      this.events.push(event as DomainEvent<unknown>);
      
      // Store by type
      if (!this.eventsByType.has(event.type)) {
        this.eventsByType.set(event.type, []);
      }
      this.eventsByType.get(event.type)!.push(event as DomainEvent<unknown>);
      
      // Store by correlation ID if present
      const correlationId = event.metadata?.['correlationId'] as string | undefined;
      if (correlationId) {
        if (!this.eventsByCorrelationId.has(correlationId)) {
          this.eventsByCorrelationId.set(correlationId, []);
        }
        this.eventsByCorrelationId.get(correlationId)!.push(event as DomainEvent<unknown>);
      }
      
      return { success: true, value: undefined };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to store event: ${String(error)}`) 
      };
    }
  }

  /**
   * Retrieve events by type within a time range
   * @param eventType The type of events to retrieve
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  public async getEventsByType<T>(
    eventType: string,
    startTime?: number,
    endTime?: number
  ): Promise<Result<DomainEvent<T>[]>> {
    try {
      const events = this.eventsByType.get(eventType) || [];
      
      const filteredEvents = events.filter(event => {
        if (startTime !== undefined && event.timestamp < startTime) {
          return false;
        }
        
        if (endTime !== undefined && event.timestamp > endTime) {
          return false;
        }
        
        return true;
      });
      
      return { 
        success: true, 
        value: filteredEvents as unknown as DomainEvent<T>[]
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to get events by type: ${String(error)}`) 
      };
    }
  }

  /**
   * Retrieve events by correlation ID
   * @param correlationId The correlation ID to search for
   */
  public async getEventsByCorrelationId<T>(
    correlationId: string
  ): Promise<Result<DomainEvent<T>[]>> {
    try {
      const events = this.eventsByCorrelationId.get(correlationId) || [];
      
      return { 
        success: true, 
        value: events as unknown as DomainEvent<T>[]
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to get events by correlation ID: ${String(error)}`) 
      };
    }
  }

  /**
   * Get all events within a time range
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  public async getAllEvents<T>(
    startTime?: number,
    endTime?: number
  ): Promise<Result<DomainEvent<T>[]>> {
    try {
      const filteredEvents = this.events.filter(event => {
        if (startTime !== undefined && event.timestamp < startTime) {
          return false;
        }
        
        if (endTime !== undefined && event.timestamp > endTime) {
          return false;
        }
        
        return true;
      });
      
      return { 
        success: true, 
        value: filteredEvents as unknown as DomainEvent<T>[]
      };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to get all events: ${String(error)}`) 
      };
    }
  }

  /**
   * Helper methods for test implementations
   */

  /**
   * Save an event directly - this is used by the ReactiveRuntimeImpl
   */
  public async saveEvent<T>(event: DomainEvent<T>): Promise<void> {
    await this.storeEvent(event);
  }

  /**
   * Query events by criteria
   */
  public async queryEvents<T>(criteria: { correlationId?: string; eventType?: string }): Promise<DomainEvent<T>[]> {
    return this.events.filter((event) => {
      if (criteria.correlationId && event.metadata?.['correlationId'] !== criteria.correlationId) return false;
      if (criteria.eventType && event.type !== criteria.eventType) return false;
      return true;
    }) as DomainEvent<T>[];
  }

  /**
   * Clear all events
   */
  public clear(): void {
    this.events = [];
    this.eventsByType.clear();
    this.eventsByCorrelationId.clear();
  }

  /**
   * Get the count of stored events
   */
  public count(): number {
    return this.events.length;
  }

  /**
   * Get the count of stored events (alias for compatibility)
   */
  public getEventCount(): number {
    return this.count();
  }
}

/**
 * Creates a new in-memory event storage instance
 */
export function createEventStorage(): EventStorage {
  return new InMemoryEventStorage();
} 