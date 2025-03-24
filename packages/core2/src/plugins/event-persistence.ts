import { 
  Extension, 
  ExtensionSystem, 
  ExtensionPoint, 
  ExtensionHook, 
  ExtensionContext 
} from '../models/extension-system';
import { EventBus, EventStorage } from '../models/event-system';
import { v4 as uuidv4 } from 'uuid';
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

// Type guard for DomainEvent
function isDomainEvent(obj: unknown): obj is DomainEvent<any> {
  return typeof obj === 'object' && 
         obj !== null && 
         'id' in obj && 
         'type' in obj && 
         'timestamp' in obj &&
         'payload' in obj;
}

export class EventPersistencePlugin implements Extension {
  id = 'event-persistence';
  name = 'event-persistence';
  description = 'Handles event persistence, replay, and correlation';
  dependencies: string[] = [];

  private options: Required<EventPersistenceOptions>;
  private extensionHooks: Array<{ 
    pointName: string; 
    hook: ExtensionHook<any, any>; 
    priority: number 
  }> = [];

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
    
    // Initialize hooks
    this.initHooks();
  }
  
  private initHooks(): void {
    // Event before replay hook
    this.extensionHooks.push({
      pointName: 'event:beforeReplay',
      hook: async (params: unknown) => {
        const context = params as ReplayContext;
        
        if (!context) {
          return { success: false, error: new Error('Invalid context') };
        }
        
        return { 
          success: true, 
          value: context 
        };
      },
      priority: 10
    });

    // Event after replay hook
    this.extensionHooks.push({
      pointName: 'event:afterReplay',
      hook: async (params: unknown) => {
        if (!params || typeof params !== 'object') {
          return { success: false, error: new Error('Invalid parameters') };
        }
        
        const event = params as DomainEvent<any>;
        
        if (isDomainEvent(event)) {
          // Persist event
          try {
            await this.persistEvent(event);
            return { success: true, value: event };
          } catch (error) {
            return { 
              success: false, 
              error: error instanceof Error ? error : new Error('Unknown error during persistence') 
            };
          }
        }
        
        return { success: true, value: params };
      },
      priority: 10
    });
  }

  // Required Extension interface methods
  getHooks(): Array<{ pointName: string; hook: ExtensionHook<any, any>; priority?: number }> {
    return this.extensionHooks;
  }
  
  getVersion(): string {
    return '1.0.0';
  }
  
  getCapabilities(): string[] {
    return ['event-persistence', 'event-replay', 'event-correlation'];
  }

  async persistEvent(event: DomainEvent<any>): Promise<void> {
    // Store event
    const result = await this.options.storage.storeEvent(event);
    if (!result.success && result.error) {
      throw new Error(`Failed to store event: ${result.error.message}`);
    }

    // Clean up old events if needed
    await this.cleanupOldEvents();
  }

  async replayEvents(fromTimestamp: number, toTimestamp: number, eventTypes?: string[]): Promise<void> {
    // Execute beforeReplay extension point
    const replayContextResult = await this.extensionSystem.executeExtensionPoint<ReplayContext, ReplayContext>('event:beforeReplay', {
      fromTimestamp,
      toTimestamp,
      eventTypes
    });

    // Get events from storage
    const result = await this.options.storage.getAllEvents<any>(fromTimestamp, toTimestamp);
    if (!result.success) {
      throw new Error(`Failed to retrieve events for replay: ${result.error?.message || 'Unknown error'}`);
    }

    if (!result.value) {
      throw new Error('No events returned from storage');
    }

    const events = result.value.filter(event => !eventTypes || eventTypes.includes(event.type));

    if (events.length === 0) {
      console.log('No events found for replay in the specified time range');
      return;
    }

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
        ...event, // Preserve original ID and other properties
        metadata: {
          ...(event.metadata || {}),
          isReplay: true,
          originalTimestamp: event.timestamp,
          replayTimestamp: Date.now()
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
    const correlationContextResult = await this.extensionSystem.executeExtensionPoint<CorrelationContext, CorrelationContext>('event:beforeCorrelation', {
      correlationId
    });

    // Get correlated events from storage
    const result = await this.options.storage.getEventsByCorrelationId<any>(correlationId);
    if (!result.success) {
      throw new Error(`Failed to retrieve correlated events: ${result.error?.message || 'Unknown error'}`);
    }

    if (!result.value) {
      return [];
    }

    return result.value;
  }

  private async cleanupOldEvents(): Promise<void> {
    const now = Date.now();
    const cutoffTime = now - this.options.retentionPeriod;

    // Get events older than retention period
    const result = await this.options.storage.getAllEvents<any>(0, cutoffTime);
    if (!result.success) {
      console.error(`Failed to retrieve old events: ${result.error?.message || 'Unknown error'}`);
      return;
    }
    
    if (!result.value) {
      console.warn('No events returned from storage during cleanup');
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