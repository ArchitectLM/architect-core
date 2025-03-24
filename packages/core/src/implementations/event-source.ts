import { Result, EventBus, EventSource, EventStorage } from '../models';

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
  public async replayEvents(
    eventType: string,
    startTime?: number,
    endTime?: number
  ): Promise<Result<void>> {
    try {
      // Get events from storage
      const eventsResult = await this.eventStorage.getEventsByType(
        eventType,
        startTime,
        endTime
      );
      
      if (!eventsResult.success || !eventsResult.value) {
        return eventsResult.success 
          ? { success: false, error: new Error('No events found or empty result value') }
          : { success: false, error: eventsResult.error };
      }
      
      // Sort by timestamp to maintain order
      const sortedEvents = [...eventsResult.value].sort(
        (a, b) => a.timestamp - b.timestamp
      );
      
      if (sortedEvents.length === 0) {
        return { success: true, value: undefined };
      }
      
      // Mark events as replayed in metadata but preserve all original properties
      const eventsToReplay = sortedEvents.map(event => ({
        ...event,
        metadata: {
          ...(event.metadata || {}),
          replayed: true,
          replayTimestamp: Date.now()
        }
      }));
      
      // Publish events individually to ensure handlers can process each one
      for (const event of eventsToReplay) {
        await this.eventBus.publish(event);
      }
      
      return { success: true, value: undefined };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error };
      } else {
        const newError = new Error(`Failed to replay events: ${String(error)}`);
        // Store the original error using a more type-safe approach
        Object.defineProperty(newError, 'cause', { value: error });
        return { 
          success: false, 
          error: newError
        };
      }
    }
  }
  
  /**
   * Replay events by correlation ID
   * @param correlationId The correlation ID to replay events for
   */
  public async replayCorrelatedEvents(
    correlationId: string
  ): Promise<Result<void>> {
    try {
      // Get events by correlation ID
      const eventsResult = await this.eventStorage.getEventsByCorrelationId(correlationId);
      
      if (!eventsResult.success || !eventsResult.value) {
        return eventsResult.success 
          ? { success: false, error: new Error('No events found or empty result value') }
          : { success: false, error: eventsResult.error };
      }
      
      // Sort by timestamp to maintain order
      const sortedEvents = [...eventsResult.value].sort(
        (a, b) => a.timestamp - b.timestamp
      );
      
      if (sortedEvents.length === 0) {
        return { success: true, value: undefined };
      }
      
      // Mark events as replayed in metadata
      const eventsToReplay = sortedEvents.map(event => ({
        ...event,
        metadata: {
          ...(event.metadata || {}),
          replayed: true,
          replayTimestamp: Date.now()
        }
      }));
      
      // Publish events individually to ensure handlers can process each one
      for (const event of eventsToReplay) {
        await this.eventBus.publish(event);
      }
      
      return { success: true, value: undefined };
    } catch (error) {
      if (error instanceof Error) {
        return { success: false, error };
      } else {
        const newError = new Error(`Failed to replay events by correlation ID: ${String(error)}`);
        // Store the original error using a more type-safe approach
        Object.defineProperty(newError, 'cause', { value: error });
        return { 
          success: false, 
          error: newError
        };
      }
    }
  }

  /**
   * Helper method to replay all events within a time range
   * This is an extension beyond the required interface
   * @param startTime Start of the time range
   * @param endTime End of the time range
   */
  public async replayAllEvents(
    startTime?: number,
    endTime?: number
  ): Promise<Result<void>> {
    return this.replayEvents('*', startTime, endTime);
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