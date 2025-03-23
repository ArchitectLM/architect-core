import { vi, describe, it, expect, beforeEach } from 'vitest';
import { 
  EventBus 
} from '../../src/models/event-system';
import {
  AggregateRoot, 
  Command, 
  DomainEvent, 
  EventSourcingPlugin, 
  EventStore, 
  EventStoreEntry,
  createEventSourcingPlugin
} from '../../src/plugins/event-sourcing';
import { TestAggregate } from '../helpers/test-aggregate';

describe('Event Sourcing Plugin', () => {
  let eventBus: EventBus;
  let eventStore: EventStore;
  let plugin: EventSourcingPlugin;

  beforeEach(() => {
    eventBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
      applyBackpressure: vi.fn()
    } as any;

    eventStore = {
      saveEvents: vi.fn().mockResolvedValue(undefined),
      getEvents: vi.fn().mockResolvedValue([]),
      getEventsByAggregateId: vi.fn().mockResolvedValue([])
    };

    plugin = createEventSourcingPlugin(eventBus, eventStore);
  });

  describe('Plugin Initialization', () => {
    it('should subscribe to command events on initialization', () => {
      plugin.initialize();
      expect(eventBus.subscribe).toHaveBeenCalledWith('command.*', expect.any(Function));
    });
  });

  describe('Command Handling', () => {
    it('should process commands and save resulting events', async () => {
      const command: Command = {
        type: 'INCREMENT_VALUE',
        aggregateId: 'aggregate-1',
        payload: { amount: 5 },
        timestamp: Date.now()
      };

      plugin.registerCommandHandler('INCREMENT_VALUE', async (cmd) => {
        const aggregate = new TestAggregate(cmd.aggregateId);
        aggregate.increment(cmd.payload.amount);
        return aggregate;
      });

      plugin.initialize();

      // Extract the command handler
      const commandHandler = (eventBus.subscribe as jest.Mock).mock.calls[0][1];
      await commandHandler({ type: 'command.INCREMENT_VALUE', payload: command });

      expect(eventStore.saveEvents).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({
          aggregateId: 'aggregate-1',
          type: 'VALUE_INCREMENTED',
          payload: { amount: 5 },
          version: 1
        })
      ]));

      expect(eventBus.publish).toHaveBeenCalledWith('event.VALUE_INCREMENTED', expect.objectContaining({
        aggregateId: 'aggregate-1',
        payload: { amount: 5 },
        version: 1
      }));
    });

    it('should handle command validation and rejections', async () => {
      const command: Command = {
        type: 'INVALID_COMMAND',
        aggregateId: 'aggregate-1',
        payload: {},
        timestamp: Date.now()
      };

      plugin.registerCommandHandler('INVALID_COMMAND', async () => {
        throw new Error('Invalid command');
      });

      plugin.initialize();

      // Extract the command handler
      const commandHandler = (eventBus.subscribe as jest.Mock).mock.calls[0][1];
      await commandHandler({ type: 'command.INVALID_COMMAND', payload: command });

      expect(eventStore.saveEvents).not.toHaveBeenCalled();
      expect(eventBus.publish).toHaveBeenCalledWith('command.rejected', expect.objectContaining({
        commandType: 'INVALID_COMMAND',
        aggregateId: 'aggregate-1',
        reason: 'Invalid command'
      }));
    });
  });

  describe('Aggregate Reconstitution', () => {
    it('should reconstitute an aggregate from its event history', async () => {
      // Setup previous events
      const eventHistory: EventStoreEntry[] = [
        {
          id: 'event-1',
          aggregateId: 'aggregate-1',
          type: 'VALUE_INCREMENTED',
          payload: { amount: 5 },
          version: 1,
          timestamp: Date.now() - 10000
        },
        {
          id: 'event-2',
          aggregateId: 'aggregate-1',
          type: 'VALUE_INCREMENTED',
          payload: { amount: 3 },
          version: 2,
          timestamp: Date.now() - 5000
        },
        {
          id: 'event-3',
          aggregateId: 'aggregate-1',
          type: 'VALUE_DECREMENTED',
          payload: { amount: 2 },
          version: 3,
          timestamp: Date.now() - 1000
        }
      ];

      (eventStore.getEventsByAggregateId as jest.Mock).mockResolvedValue(eventHistory);

      // Register aggregate factory
      plugin.registerAggregateFactory('TestAggregate', (id) => new TestAggregate(id));

      // Load the aggregate
      const aggregate = await plugin.loadAggregate<TestAggregate>('TestAggregate', 'aggregate-1');

      // Verify the aggregate state was properly reconstituted
      expect(aggregate).toBeInstanceOf(TestAggregate);
      expect(aggregate.id).toBe('aggregate-1');
      expect(aggregate.version).toBe(3);
      expect((aggregate as TestAggregate).state.value).toBe(6); // 5 + 3 - 2
    });

    it('should handle aggregate not found', async () => {
      (eventStore.getEventsByAggregateId as jest.Mock).mockResolvedValue([]);

      // Register aggregate factory
      plugin.registerAggregateFactory('TestAggregate', (id) => new TestAggregate(id));

      // Try to load a non-existent aggregate
      const aggregate = await plugin.loadAggregate<TestAggregate>('TestAggregate', 'nonexistent-id');

      // Should return a new aggregate with default state
      expect(aggregate).toBeInstanceOf(TestAggregate);
      expect(aggregate.id).toBe('nonexistent-id');
      expect(aggregate.version).toBe(0);
      expect((aggregate as TestAggregate).state.value).toBe(0);
    });
  });

  describe('Event Store Operations', () => {
    it('should save events to the event store', async () => {
      const aggregate = new TestAggregate('aggregate-2');
      aggregate.increment(10);
      aggregate.increment(5);

      await plugin.saveAggregate(aggregate);

      expect(eventStore.saveEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            aggregateId: 'aggregate-2',
            type: 'VALUE_INCREMENTED',
            payload: { amount: 10 },
            version: 1
          }),
          expect.objectContaining({
            aggregateId: 'aggregate-2',
            type: 'VALUE_INCREMENTED',
            payload: { amount: 5 },
            version: 2
          })
        ])
      );

      // Events should be published to the event bus
      expect(eventBus.publish).toHaveBeenCalledWith(
        'event.VALUE_INCREMENTED',
        expect.objectContaining({
          aggregateId: 'aggregate-2',
          payload: { amount: 10 },
          version: 1
        })
      );
      expect(eventBus.publish).toHaveBeenCalledWith(
        'event.VALUE_INCREMENTED',
        expect.objectContaining({
          aggregateId: 'aggregate-2',
          payload: { amount: 5 },
          version: 2
        })
      );

      // Uncommitted events should be cleared
      expect(aggregate.getUncommittedEvents()).toHaveLength(0);
    });

    it('should retrieve all events from the event store', async () => {
      const mockEvents = [
        { id: 'event-1', type: 'VALUE_INCREMENTED', aggregateId: 'agg-1' },
        { id: 'event-2', type: 'VALUE_DECREMENTED', aggregateId: 'agg-2' }
      ];
      
      (eventStore.getEvents as jest.Mock).mockResolvedValue(mockEvents);
      
      const events = await plugin.getAllEvents();
      
      expect(eventStore.getEvents).toHaveBeenCalled();
      expect(events).toEqual(mockEvents);
    });

    it('should handle concurrent modifications with optimistic concurrency', async () => {
      // Setup a scenario where another process has modified the aggregate
      const currentEvents: EventStoreEntry[] = [
        {
          id: 'event-1',
          aggregateId: 'aggregate-3',
          type: 'VALUE_INCREMENTED',
          payload: { amount: 5 },
          version: 1,
          timestamp: Date.now() - 10000
        }
      ];

      // When loading the aggregate, return the current events
      (eventStore.getEventsByAggregateId as jest.Mock).mockResolvedValue(currentEvents);

      // When saving, simulate a concurrency conflict
      (eventStore.saveEvents as jest.Mock).mockRejectedValueOnce(new Error('Concurrency conflict'));

      // Register aggregate factory
      plugin.registerAggregateFactory('TestAggregate', (id) => new TestAggregate(id));

      // Load the aggregate
      const aggregate = await plugin.loadAggregate<TestAggregate>('TestAggregate', 'aggregate-3');
      
      // Modify the aggregate
      (aggregate as TestAggregate).increment(10);

      // Try to save, should fail due to concurrency issue
      await expect(plugin.saveAggregate(aggregate)).rejects.toThrow('Concurrency conflict');

      // The aggregate's uncommitted events should still be there
      expect(aggregate.getUncommittedEvents()).toHaveLength(1);
    });
  });

  describe('Snapshot Support', () => {
    it('should create a snapshot of an aggregate state', async () => {
      // Setup mock for saving snapshots
      const saveSnapshot = vi.fn().mockResolvedValue(undefined);
      const getLatestSnapshot = vi.fn().mockResolvedValue(null);
      
      eventStore.saveSnapshot = saveSnapshot;
      eventStore.getLatestSnapshot = getLatestSnapshot;

      // Register aggregate factory
      plugin.registerAggregateFactory('TestAggregate', (id) => new TestAggregate(id));

      // Create and modify an aggregate
      const aggregate = new TestAggregate('aggregate-4');
      (aggregate as TestAggregate).increment(5);
      (aggregate as TestAggregate).increment(10);
      (aggregate as TestAggregate).decrement(3);

      // Save the aggregate first
      await plugin.saveAggregate(aggregate);

      // Create a snapshot
      await plugin.createSnapshot(aggregate);

      // Verify the snapshot was saved
      expect(saveSnapshot).toHaveBeenCalledWith({
        aggregateId: 'aggregate-4',
        aggregateType: 'TestAggregate',
        version: 3,
        state: { value: 12 },
        timestamp: expect.any(Number)
      });
    });

    it('should load an aggregate from a snapshot plus newer events', async () => {
      // Setup mock snapshot
      const mockSnapshot = {
        aggregateId: 'aggregate-5',
        aggregateType: 'TestAggregate',
        version: 3,
        state: { value: 8 },
        timestamp: Date.now() - 5000
      };

      // Events that occurred after the snapshot
      const newerEvents: EventStoreEntry[] = [
        {
          id: 'event-4',
          aggregateId: 'aggregate-5',
          type: 'VALUE_INCREMENTED',
          payload: { amount: 2 },
          version: 4,
          timestamp: Date.now() - 3000
        },
        {
          id: 'event-5',
          aggregateId: 'aggregate-5',
          type: 'VALUE_DECREMENTED',
          payload: { amount: 1 },
          version: 5,
          timestamp: Date.now() - 1000
        }
      ];

      // Setup mocks
      const getLatestSnapshot = vi.fn().mockResolvedValue(mockSnapshot);
      eventStore.getLatestSnapshot = getLatestSnapshot;
      
      (eventStore.getEventsByAggregateId as jest.Mock).mockImplementation(
        (aggregateId: string, fromVersion?: number) => {
          if (fromVersion && fromVersion > 3) {
            return Promise.resolve(newerEvents);
          }
          return Promise.resolve([]);
        }
      );

      // Register aggregate factory
      plugin.registerAggregateFactory('TestAggregate', (id) => new TestAggregate(id));

      // Load the aggregate using snapshots
      const aggregate = await plugin.loadAggregateFromSnapshot('TestAggregate', 'aggregate-5');

      // Verify the aggregate was reconstituted correctly
      expect(aggregate).toBeInstanceOf(TestAggregate);
      expect(aggregate.id).toBe('aggregate-5');
      expect(aggregate.version).toBe(5);
      expect((aggregate as TestAggregate).state.value).toBe(9); // 8 + 2 - 1
    });
  });
}); 