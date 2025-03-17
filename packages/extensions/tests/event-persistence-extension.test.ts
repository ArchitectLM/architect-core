import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultExtensionSystem } from '../src/extension-system.js';
import { Event } from '../src/models.js';

// This will be implemented next
import { 
  EventPersistenceExtension, 
  EventStorage,
  StorageOptions,
  EventQuery
} from '../src/extensions/event-persistence.js';

describe('EventPersistenceExtension', () => {
  let extensionSystem: DefaultExtensionSystem;
  let persistenceExtension: EventPersistenceExtension;
  let mockStorage: EventStorage;

  beforeEach(() => {
    // Create mock event storage
    mockStorage = {
      storeEvent: vi.fn().mockResolvedValue({ id: 'event-123' }),
      getEvent: vi.fn().mockResolvedValue({
        id: 'event-123',
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: {}
      }),
      queryEvents: vi.fn().mockResolvedValue({
        events: [],
        totalCount: 0,
        hasMore: false
      }),
      deleteEvent: vi.fn().mockResolvedValue(true),
      getStorageStats: vi.fn().mockResolvedValue({
        totalEvents: 100,
        oldestEventTimestamp: Date.now() - 86400000,
        newestEventTimestamp: Date.now(),
        storageSize: 1024 * 1024
      })
    };

    // Create and configure the extension system
    extensionSystem = new DefaultExtensionSystem();
    
    // Register extension points
    extensionSystem.registerExtensionPoint({
      name: 'event.store',
      description: 'Stores an event',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'event.get',
      description: 'Gets an event by ID',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'event.query',
      description: 'Queries events based on criteria',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'event.delete',
      description: 'Deletes an event',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'event.stats',
      description: 'Gets storage statistics',
      handlers: []
    });
    
    extensionSystem.registerExtensionPoint({
      name: 'event.afterPublish',
      description: 'Called after an event is published',
      handlers: []
    });
    
    // Create the persistence extension
    persistenceExtension = new EventPersistenceExtension(mockStorage);
    
    // Register the extension
    extensionSystem.registerExtension(persistenceExtension);
  });

  describe('GIVEN an event is published', () => {
    it('SHOULD automatically store the event', async () => {
      // Create an event
      const event: Event = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: {}
      };
      
      // WHEN the event is published
      const context = { event, result: { success: true } };
      await extensionSystem.triggerExtensionPoint('event.afterPublish', context);
      
      // THEN the event should be stored
      expect(mockStorage.storeEvent).toHaveBeenCalledWith(event);
    });
  });

  describe('GIVEN a request to store an event', () => {
    it('SHOULD store the event and return the result', async () => {
      // Create an event
      const event: Event = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: {}
      };
      
      // WHEN storing the event
      const context = { event };
      const result = await extensionSystem.triggerExtensionPoint('event.store', context);
      
      // THEN the event should be stored
      expect(mockStorage.storeEvent).toHaveBeenCalledWith(event);
      expect(result).toEqual({ id: 'event-123' });
    });
    
    it('SHOULD apply storage options if provided', async () => {
      // Create an event
      const event: Event = {
        type: 'test-event',
        payload: { data: 'test-data' },
        timestamp: Date.now(),
        metadata: {}
      };
      
      // Create storage options
      const options: StorageOptions = {
        ttl: 3600, // 1 hour
        priority: 'high'
      };
      
      // WHEN storing the event with options
      const context = { event, options };
      await extensionSystem.triggerExtensionPoint('event.store', context);
      
      // THEN the event should be stored with options
      expect(mockStorage.storeEvent).toHaveBeenCalledWith(event, options);
    });
  });

  describe('GIVEN a request to get an event', () => {
    it('SHOULD retrieve the event by ID', async () => {
      // WHEN getting an event
      const context = { id: 'event-123' };
      const result = await extensionSystem.triggerExtensionPoint('event.get', context);
      
      // THEN the event should be retrieved
      expect(mockStorage.getEvent).toHaveBeenCalledWith('event-123');
      expect(result).toHaveProperty('type', 'test-event');
      expect(result).toHaveProperty('payload.data', 'test-data');
    });
  });

  describe('GIVEN a request to query events', () => {
    it('SHOULD query events based on criteria', async () => {
      // Create a query
      const query: EventQuery = {
        eventTypes: ['test-event', 'another-event'],
        fromTimestamp: Date.now() - 3600000, // 1 hour ago
        toTimestamp: Date.now(),
        limit: 10,
        offset: 0
      };
      
      // Mock the query result
      const queryResult = {
        events: [
          {
            id: 'event-123',
            type: 'test-event',
            payload: { data: 'test-data' },
            timestamp: Date.now() - 1000,
            metadata: {}
          },
          {
            id: 'event-124',
            type: 'another-event',
            payload: { data: 'more-data' },
            timestamp: Date.now() - 2000,
            metadata: {}
          }
        ],
        totalCount: 2,
        hasMore: false
      };
      
      mockStorage.queryEvents.mockResolvedValue(queryResult);
      
      // WHEN querying events
      const context = { query };
      const result = await extensionSystem.triggerExtensionPoint('event.query', context);
      
      // THEN the events should be queried
      expect(mockStorage.queryEvents).toHaveBeenCalledWith(query);
      expect(result).toEqual(queryResult);
    });
  });

  describe('GIVEN a request to delete an event', () => {
    it('SHOULD delete the event by ID', async () => {
      // WHEN deleting an event
      const context = { id: 'event-123' };
      const result = await extensionSystem.triggerExtensionPoint('event.delete', context);
      
      // THEN the event should be deleted
      expect(mockStorage.deleteEvent).toHaveBeenCalledWith('event-123');
      expect(result).toBe(true);
    });
  });

  describe('GIVEN a request for storage statistics', () => {
    it('SHOULD return storage statistics', async () => {
      // WHEN requesting storage statistics
      const result = await extensionSystem.triggerExtensionPoint('event.stats', {});
      
      // THEN the storage statistics should be returned
      expect(mockStorage.getStorageStats).toHaveBeenCalled();
      expect(result).toHaveProperty('totalEvents', 100);
      expect(result).toHaveProperty('storageSize');
    });
  });

  describe('GIVEN a configuration for automatic event cleanup', () => {
    it('SHOULD set up automatic cleanup based on configuration', () => {
      // Create a new extension with cleanup configuration
      const cleanupConfig = {
        enabled: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        maxEvents: 10000,
        cleanupInterval: 24 * 60 * 60 * 1000 // 1 day
      };
      
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      
      // WHEN creating the extension with cleanup config
      const newExtension = new EventPersistenceExtension(mockStorage, cleanupConfig);
      
      // THEN automatic cleanup should be set up
      expect(setIntervalSpy).toHaveBeenCalledWith(
        expect.any(Function),
        cleanupConfig.cleanupInterval
      );
      
      // Clean up
      setIntervalSpy.mockRestore();
    });
  });
}); 