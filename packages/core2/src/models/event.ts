import { BackpressureStrategy } from './backpressure.js';

export interface Event<T = any> {
  id?: string; // Optional unique identifier
  type: string;
  payload: T;
  timestamp: number;
  correlationId?: string; // Optional correlation identifier
  causationId?: string; // Optional causation identifier (event that caused this one)
  metadata?: {
    source?: string;
    version?: string;
    isReplay?: boolean;
    originalTimestamp?: number;
    routedFrom?: string;
    [key: string]: any;
  };
}

export type EventHandler = (event: Event) => void;
export type EventRouter = (event: Event) => string[];

export interface EventFilter {
  types?: string[]; // Event types to include
  excludeTypes?: string[]; // Event types to exclude
  fromTimestamp?: number; // Minimum timestamp
  toTimestamp?: number; // Maximum timestamp
  correlationIds?: string[]; // Include events with these correlation IDs
  metadataFilter?: Record<string, any>; // Filter by metadata properties
}

export interface EventStorage {
  saveEvent(event: Event): Promise<void>;
  getEvents(filter: EventFilter): Promise<Event[]>;
  getEventById(eventId: string): Promise<Event | undefined>;
  getEventsByCorrelationId(correlationId: string): Promise<Event[]>;
  clear?(): void; // Optional method for testing
}

export interface EventBus {
  // Core event pub/sub
  subscribe(eventType: string, handler: EventHandler): () => void; // Return unsubscribe function
  unsubscribe(eventType: string, handler: EventHandler): void;
  publish(eventType: string, payload: any, options?: { correlationId?: string; causationId?: string; metadata?: Record<string, any> }): void;
  
  // Backpressure
  applyBackpressure(eventType: string, strategy: BackpressureStrategy): void;
  
  // Event persistence
  enablePersistence(storage: EventStorage): void;
  disablePersistence(): void;
  
  // Event replay
  replay(filter: EventFilter): Promise<void>;
  
  // Routing and filtering
  addEventRouter(router: EventRouter): void; // Routes events to additional channels
  addEventFilter(filter: (event: Event) => boolean): void; // Global filter to exclude events
  
  // Utilities
  correlate(correlationId: string): Promise<Event[]>;
} 