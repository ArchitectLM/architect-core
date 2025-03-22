import { DomainEvent, Result } from '../models/core-types';
import { EventBus, EventSource, EventStorage } from '../models/event-system';

/**
 * In-memory implementation of EventSource for replaying events
 */
export class InMemoryEventSource implements EventSource {
  private eventStorage: EventStorage;
  private eventBus: EventBus;
  
  /**
   * Create a new InMemoryEventSource
   * @param eventStorage The storage to retrieve events from
   * @param eventBus The bus to publish events to
   */
  constructor(eventStorage: EventStorage, eventBus: EventBus) {
    this.eventStorage = eventStorage;
    this.eventBus = eventBus;
  }
  
  /**
   * Replay events by type within a time range
   * @param eventType The type of events to replay
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  public async replayEvents<T>(
    eventType: string,
    startTime?: number,
    endTime?: number
  ): Promise<Result<void>> {
    try {
      // Get events from storage
      const eventsResult = await this.eventStorage.getEventsByType<T>(
        eventType,
        startTime,
        endTime
      );
      
      if (!eventsResult.success) {
        return eventsResult;
      }
      
      // Sort by timestamp to maintain order
      const sortedEvents = [...eventsResult.value].sort(
        (a, b) => a.timestamp - b.timestamp
      );
      
      // Mark events as replayed in metadata
      const eventsToReplay = sortedEvents.map(event => ({
        ...event,
        metadata: {
          ...(event.metadata || {}),
          replayed: true,
          replayTimestamp: Date.now()
        }
      }));
      
      // Publish all events to the bus
      await this.eventBus.publishAll(eventsToReplay);
      
      return { success: true, value: undefined };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to replay events: ${String(error)}`) 
      };
    }
  }
  
  /**
   * Replay events by correlation ID
   * @param correlationId The correlation ID to replay events for
   */
  public async replayByCorrelationId<T>(
    correlationId: string
  ): Promise<Result<void>> {
    try {
      // Get events by correlation ID
      const eventsResult = await this.eventStorage.getEventsByCorrelationId<T>(correlationId);
      
      if (!eventsResult.success) {
        return eventsResult;
      }
      
      // Sort by timestamp to maintain order
      const sortedEvents = [...eventsResult.value].sort(
        (a, b) => a.timestamp - b.timestamp
      );
      
      // Mark events as replayed in metadata
      const eventsToReplay = sortedEvents.map(event => ({
        ...event,
        metadata: {
          ...(event.metadata || {}),
          replayed: true,
          replayTimestamp: Date.now()
        }
      }));
      
      // Publish all events to the bus
      await this.eventBus.publishAll(eventsToReplay);
      
      return { success: true, value: undefined };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to replay events by correlation ID: ${String(error)}`) 
      };
    }
  }
}

/**
 * Create a new instance of InMemoryEventSource
 * @param eventStorage The storage to retrieve events from
 * @param eventBus The bus to publish events to
 */
export function createEventSource(
  eventStorage: EventStorage,
  eventBus: EventBus
): EventSource {
  return new InMemoryEventSource(eventStorage, eventBus);
} 