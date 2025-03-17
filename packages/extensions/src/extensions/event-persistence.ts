import { Extension } from '../extension-system.js';
import { Event } from '../models.js';

/**
 * Extended Event interface with ID
 */
export interface StoredEvent extends Event {
  /** The unique ID of the stored event */
  id: string;
}

/**
 * Interface for event storage options
 */
export interface StorageOptions {
  /** Time-to-live in seconds */
  ttl?: number;
  /** Priority for the event */
  priority?: 'low' | 'normal' | 'high';
  /** Additional storage options */
  [key: string]: any;
}

/**
 * Interface for event query parameters
 */
export interface EventQuery {
  /** Filter by event types */
  eventTypes?: string[];
  /** Filter by minimum timestamp */
  fromTimestamp?: number;
  /** Filter by maximum timestamp */
  toTimestamp?: number;
  /** Maximum number of events to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  /** Additional query parameters */
  [key: string]: any;
}

/**
 * Interface for event query results
 */
export interface EventQueryResult {
  /** The events matching the query */
  events: StoredEvent[];
  /** Total count of events matching the query */
  totalCount: number;
  /** Whether there are more events matching the query */
  hasMore: boolean;
}

/**
 * Interface for event storage statistics
 */
export interface StorageStats {
  /** Total number of events in storage */
  totalEvents: number;
  /** Timestamp of the oldest event */
  oldestEventTimestamp?: number;
  /** Timestamp of the newest event */
  newestEventTimestamp?: number;
  /** Size of the storage in bytes */
  storageSize?: number;
  /** Additional statistics */
  [key: string]: any;
}

/**
 * Interface for event storage
 */
export interface EventStorage {
  /**
   * Store an event
   * @param event The event to store
   * @param options Optional storage options
   * @returns A promise that resolves with the storage result
   */
  storeEvent(event: Event, options?: StorageOptions): Promise<{ id: string }>;
  
  /**
   * Get an event by ID
   * @param id The event ID
   * @returns A promise that resolves with the event or null if not found
   */
  getEvent(id: string): Promise<StoredEvent | null>;
  
  /**
   * Query events based on criteria
   * @param query The query parameters
   * @returns A promise that resolves with the query results
   */
  queryEvents(query: EventQuery): Promise<EventQueryResult>;
  
  /**
   * Delete an event by ID
   * @param id The event ID
   * @returns A promise that resolves with true if deleted, false if not found
   */
  deleteEvent(id: string): Promise<boolean>;
  
  /**
   * Get storage statistics
   * @returns A promise that resolves with the storage statistics
   */
  getStorageStats(): Promise<StorageStats>;
}

/**
 * Interface for event cleanup configuration
 */
export interface CleanupConfig {
  /** Whether automatic cleanup is enabled */
  enabled: boolean;
  /** Maximum age of events in milliseconds */
  maxAge?: number;
  /** Maximum number of events to keep */
  maxEvents?: number;
  /** Cleanup interval in milliseconds */
  cleanupInterval: number;
}

/**
 * In-memory implementation of event storage
 */
export class InMemoryEventStorage implements EventStorage {
  private events: Map<string, StoredEvent> = new Map();
  private eventTtls: Map<string, number> = new Map();
  private nextId = 1;
  
  /**
   * Generate a unique ID for an event
   * @returns The generated ID
   */
  private generateId(): string {
    return `event-${this.nextId++}`;
  }
  
  /**
   * Check if an event has expired
   * @param id The event ID
   * @returns Whether the event has expired
   */
  private hasExpired(id: string): boolean {
    const expiry = this.eventTtls.get(id);
    return expiry !== undefined && expiry < Date.now();
  }
  
  /**
   * Clean up expired events
   */
  private cleanupExpired(): void {
    for (const [id] of this.events) {
      if (this.hasExpired(id)) {
        this.events.delete(id);
        this.eventTtls.delete(id);
      }
    }
  }
  
  async storeEvent(event: Event, options?: StorageOptions): Promise<{ id: string }> {
    this.cleanupExpired();
    
    const id = this.generateId();
    const eventWithId: StoredEvent = { ...event, id };
    
    this.events.set(id, eventWithId);
    
    // Set TTL if provided
    if (options?.ttl) {
      const expiryTime = Date.now() + (options.ttl * 1000);
      this.eventTtls.set(id, expiryTime);
    }
    
    return { id };
  }
  
  async getEvent(id: string): Promise<StoredEvent | null> {
    this.cleanupExpired();
    
    if (this.events.has(id) && !this.hasExpired(id)) {
      return this.events.get(id) || null;
    }
    
    return null;
  }
  
  async queryEvents(query: EventQuery): Promise<EventQueryResult> {
    this.cleanupExpired();
    
    let events = Array.from(this.events.values());
    
    // Apply filters
    if (query.eventTypes && query.eventTypes.length > 0) {
      events = events.filter(event => query.eventTypes!.includes(event.type));
    }
    
    if (query.fromTimestamp) {
      events = events.filter(event => event.timestamp >= query.fromTimestamp!);
    }
    
    if (query.toTimestamp) {
      events = events.filter(event => event.timestamp <= query.toTimestamp!);
    }
    
    // Sort by timestamp (newest first)
    events.sort((a, b) => b.timestamp - a.timestamp);
    
    const totalCount = events.length;
    
    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 10;
    
    events = events.slice(offset, offset + limit);
    
    return {
      events,
      totalCount,
      hasMore: offset + events.length < totalCount
    };
  }
  
  async deleteEvent(id: string): Promise<boolean> {
    this.cleanupExpired();
    
    if (this.events.has(id) && !this.hasExpired(id)) {
      this.events.delete(id);
      this.eventTtls.delete(id);
      return true;
    }
    
    return false;
  }
  
  async getStorageStats(): Promise<StorageStats> {
    this.cleanupExpired();
    
    const events = Array.from(this.events.values());
    
    let oldestTimestamp: number | undefined;
    let newestTimestamp: number | undefined;
    
    if (events.length > 0) {
      oldestTimestamp = Math.min(...events.map(e => e.timestamp));
      newestTimestamp = Math.max(...events.map(e => e.timestamp));
    }
    
    return {
      totalEvents: events.length,
      oldestEventTimestamp: oldestTimestamp,
      newestEventTimestamp: newestTimestamp,
      // Rough estimate of storage size
      storageSize: JSON.stringify(events).length
    };
  }
}

/**
 * Extension that provides event persistence capabilities
 */
export class EventPersistenceExtension implements Extension {
  name = 'event-persistence';
  description = 'Provides event persistence capabilities';
  
  private storage: EventStorage;
  private cleanupConfig?: CleanupConfig;
  private cleanupInterval?: NodeJS.Timeout;
  
  constructor(storage?: EventStorage, cleanupConfig?: CleanupConfig) {
    this.storage = storage || new InMemoryEventStorage();
    this.cleanupConfig = cleanupConfig;
    
    // Set up automatic cleanup if configured
    if (cleanupConfig?.enabled) {
      this.setupAutomaticCleanup();
    }
  }
  
  /**
   * Set up automatic cleanup of old events
   */
  private setupAutomaticCleanup(): void {
    if (!this.cleanupConfig) return;
    
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.cleanupOldEvents();
      } catch (error) {
        console.error('Error during automatic event cleanup:', error);
      }
    }, this.cleanupConfig.cleanupInterval);
  }
  
  /**
   * Clean up old events based on configuration
   */
  private async cleanupOldEvents(): Promise<void> {
    if (!this.cleanupConfig) return;
    
    const stats = await this.storage.getStorageStats();
    
    // Clean up by age
    if (this.cleanupConfig.maxAge && stats.oldestEventTimestamp) {
      const cutoffTime = Date.now() - this.cleanupConfig.maxAge;
      
      const oldEvents = await this.storage.queryEvents({
        toTimestamp: cutoffTime,
        limit: 1000 // Process in batches
      });
      
      for (const event of oldEvents.events) {
        await this.storage.deleteEvent(event.id);
      }
    }
    
    // Clean up by count
    if (this.cleanupConfig.maxEvents && stats.totalEvents > this.cleanupConfig.maxEvents) {
      const excessCount = stats.totalEvents - this.cleanupConfig.maxEvents;
      
      const oldestEvents = await this.storage.queryEvents({
        limit: excessCount,
        // Sort by oldest first (we'll need to reverse the default sort in the storage)
        // This is just a hint to the storage implementation
        sortDirection: 'asc',
        sortBy: 'timestamp'
      });
      
      for (const event of oldestEvents.events) {
        await this.storage.deleteEvent(event.id);
      }
    }
  }
  
  /**
   * Clean up resources when the extension is destroyed
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
  
  hooks = {
    'event.store': async (context: { event: Event; options?: StorageOptions }) => {
      const { event, options } = context;
      return this.storage.storeEvent(event, options);
    },
    
    'event.get': async (context: { id: string }) => {
      const { id } = context;
      return this.storage.getEvent(id);
    },
    
    'event.query': async (context: { query: EventQuery }) => {
      const { query } = context;
      return this.storage.queryEvents(query);
    },
    
    'event.delete': async (context: { id: string }) => {
      const { id } = context;
      return this.storage.deleteEvent(id);
    },
    
    'event.stats': async () => {
      return this.storage.getStorageStats();
    },
    
    'event.afterPublish': async (context: { event: Event; result: any }) => {
      const { event } = context;
      await this.storage.storeEvent(event);
      return context;
    }
  };
} 