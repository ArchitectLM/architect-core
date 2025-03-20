import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '../../src/models/event.js';
import { Runtime } from '../../src/models/runtime.js';
import { createRuntime } from '../../src/implementations/runtime.js';
import { ExtensionSystem } from '../../src/models/extension.js';
import { 
  EventSourcingPlugin, 
  createEventSourcingPlugin,
  EventStore,
  AggregateRoot,
  DomainEvent
} from '../../src/plugins/event-sourcing.js';
import { 
  OutboxPattern, 
  createOutboxPattern,
  OutboxRepository,
  OutboxEntry
} from '../../src/plugins/outbox-pattern.js';
import { 
  ContentBasedRouter, 
  createContentBasedRouter,
  RouteDefinition
} from '../../src/plugins/content-based-routing.js';

// Test aggregate implementation
class TestAggregate implements AggregateRoot {
  private _id: string;
  private _version: number = 0;
  private _state: { value: number } = { value: 0 };
  private _events: DomainEvent[] = [];

  constructor(id: string) {
    this._id = id;
  }

  get id(): string {
    return this._id;
  }

  get version(): number {
    return this._version;
  }

  get state(): { value: number } {
    return this._state;
  }

  applyEvent(event: DomainEvent): void {
    if (event.type === 'VALUE_INCREMENTED') {
      this._state.value += event.payload.amount;
    }
    this._version++;
    this._events.push(event);
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this._events];
  }

  clearUncommittedEvents(): void {
    this._events = [];
  }

  increment(amount: number): void {
    this.applyEvent({
      aggregateId: this._id,
      type: 'VALUE_INCREMENTED',
      payload: { amount },
      version: this._version + 1,
      timestamp: Date.now()
    });
  }
}

describe('Runtime Plugin Integration', () => {
  let eventBus: EventBus;
  let runtime: Runtime;
  let eventStore: EventStore;
  let outboxRepository: OutboxRepository;
  let eventSourcingPlugin: EventSourcingPlugin;
  let outboxPattern: OutboxPattern;
  let contentBasedRouter: ContentBasedRouter;
  let extensionSystem: ExtensionSystem;

  beforeEach(() => {
    // Setup mocks
    eventBus = {
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      publish: vi.fn(),
      applyBackpressure: vi.fn()
    };

    eventStore = {
      saveEvents: vi.fn().mockResolvedValue(undefined),
      getEvents: vi.fn().mockResolvedValue([]),
      getEventsByAggregateId: vi.fn().mockResolvedValue([])
    };

    outboxRepository = {
      saveEntry: vi.fn().mockResolvedValue(undefined),
      getUnprocessedEntries: vi.fn().mockResolvedValue([]),
      markAsProcessed: vi.fn().mockResolvedValue(undefined),
      getAllEntries: vi.fn().mockResolvedValue([]),
      purgeProcessedEntries: vi.fn().mockResolvedValue(undefined)
    };

    extensionSystem = {
      registerExtensionPoint: vi.fn(),
      registerExtension: vi.fn(),
      registerEventInterceptor: vi.fn(),
      executeExtensionPoint: vi.fn().mockImplementation(async (point, context) => context),
      interceptEvent: vi.fn().mockImplementation(event => event)
    };

    // Create plugins
    eventSourcingPlugin = createEventSourcingPlugin(eventBus, eventStore);
    outboxPattern = createOutboxPattern(eventBus, outboxRepository);
    contentBasedRouter = createContentBasedRouter(eventBus);

    // Create runtime with empty definitions for testing
    runtime = createRuntime({}, {}, { extensionSystem, eventBus });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Event Sourcing Integration', () => {
    it('should process commands through event sourcing and capture events in outbox', async () => {
      // Register the aggregate factory
      eventSourcingPlugin.registerAggregateFactory('TestAggregate', (id) => new TestAggregate(id));

      // Register command handler
      eventSourcingPlugin.registerCommandHandler('INCREMENT_VALUE', async (cmd) => {
        const aggregate = new TestAggregate(cmd.aggregateId);
        aggregate.increment(cmd.payload.amount);
        return aggregate;
      });

      // Initialize plugins
      eventSourcingPlugin.initialize();
      outboxPattern.initialize();

      // Send a command
      const command = {
        type: 'command.INCREMENT_VALUE',
        payload: {
          type: 'INCREMENT_VALUE',
          aggregateId: 'test-1',
          payload: { amount: 5 },
          timestamp: Date.now()
        }
      };

      await eventBus.publish('command.INCREMENT_VALUE', command);

      // Verify event was saved to event store
      expect(eventStore.saveEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            aggregateId: 'test-1',
            type: 'VALUE_INCREMENTED',
            payload: { amount: 5 }
          })
        ])
      );

      // Verify event was captured in outbox
      expect(outboxRepository.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'VALUE_INCREMENTED',
          payload: expect.objectContaining({ amount: 5 })
        })
      );
    });

    it('should handle command failures and capture errors in outbox', async () => {
      // Register a failing command handler
      eventSourcingPlugin.registerCommandHandler('FAILING_COMMAND', async () => {
        throw new Error('Command failed');
      });

      // Initialize plugins
      eventSourcingPlugin.initialize();
      outboxPattern.initialize();

      // Send a failing command
      const command = {
        type: 'command.FAILING_COMMAND',
        payload: {
          type: 'FAILING_COMMAND',
          aggregateId: 'test-1',
          payload: {},
          timestamp: Date.now()
        }
      };

      await eventBus.publish('command.FAILING_COMMAND', command);

      // Verify error was captured in outbox
      expect(outboxRepository.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'command.rejected',
          payload: expect.objectContaining({
            commandType: 'FAILING_COMMAND',
            reason: 'Command failed'
          })
        })
      );
    });
  });

  describe('Content-Based Routing Integration', () => {
    it('should route events based on content and capture routed events in outbox', async () => {
      // Register a route
      const route: RouteDefinition = {
        name: 'high-value-route',
        predicate: (event) => event.payload?.amount > 10,
        targetEventType: 'high-value-events'
      };
      contentBasedRouter.registerRoute(route);

      // Initialize plugins
      contentBasedRouter.initialize();
      outboxPattern.initialize();

      // Send events with different amounts
      const lowValueEvent = {
        type: 'value-event',
        payload: { amount: 5 }
      };

      const highValueEvent = {
        type: 'value-event',
        payload: { amount: 15 }
      };

      await eventBus.publish('value-event', lowValueEvent);
      await eventBus.publish('value-event', highValueEvent);

      // Verify only high value event was routed
      expect(eventBus.publish).toHaveBeenCalledWith('high-value-events', highValueEvent.payload);

      // Verify both events were captured in outbox
      expect(outboxRepository.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'value-event',
          payload: lowValueEvent.payload
        })
      );

      expect(outboxRepository.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'value-event',
          payload: highValueEvent.payload
        })
      );
    });

    it('should transform payloads during routing and capture transformed events', async () => {
      // Register a route with transformation
      const route: RouteDefinition = {
        name: 'transform-route',
        predicate: () => true,
        targetEventType: 'transformed-events',
        transformPayload: (payload) => ({
          ...payload,
          transformed: true,
          timestamp: Date.now()
        })
      };
      contentBasedRouter.registerRoute(route);

      // Initialize plugins
      contentBasedRouter.initialize();
      outboxPattern.initialize();

      // Send an event
      const originalEvent = {
        type: 'original-event',
        payload: { data: 'test' }
      };

      await eventBus.publish('original-event', originalEvent);

      // Verify transformed event was published
      expect(eventBus.publish).toHaveBeenCalledWith(
        'transformed-events',
        expect.objectContaining({
          data: 'test',
          transformed: true
        })
      );

      // Verify original event was captured in outbox
      expect(outboxRepository.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'original-event',
          payload: originalEvent.payload
        })
      );
    });
  });

  describe('Plugin Chain Integration', () => {
    it('should process events through multiple plugins in sequence', async () => {
      // Register aggregate factory and command handler
      eventSourcingPlugin.registerAggregateFactory('TestAggregate', (id) => new TestAggregate(id));
      eventSourcingPlugin.registerCommandHandler('INCREMENT_VALUE', async (cmd) => {
        const aggregate = new TestAggregate(cmd.aggregateId);
        aggregate.increment(cmd.payload.amount);
        return aggregate;
      });

      // Register a route for high-value increments
      const route: RouteDefinition = {
        name: 'high-increment-route',
        predicate: (event) => event.type === 'VALUE_INCREMENTED' && event.payload.amount > 10,
        targetEventType: 'high-increment-events'
      };
      contentBasedRouter.registerRoute(route);

      // Initialize all plugins
      eventSourcingPlugin.initialize();
      outboxPattern.initialize();
      contentBasedRouter.initialize();

      // Send a high-value increment command
      const command = {
        type: 'command.INCREMENT_VALUE',
        payload: {
          type: 'INCREMENT_VALUE',
          aggregateId: 'test-1',
          payload: { amount: 15 },
          timestamp: Date.now()
        }
      };

      await eventBus.publish('command.INCREMENT_VALUE', command);

      // Verify event was saved to event store
      expect(eventStore.saveEvents).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            aggregateId: 'test-1',
            type: 'VALUE_INCREMENTED',
            payload: { amount: 15 }
          })
        ])
      );

      // Verify event was captured in outbox
      expect(outboxRepository.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'VALUE_INCREMENTED',
          payload: expect.objectContaining({ amount: 15 })
        })
      );

      // Verify event was routed due to high value
      expect(eventBus.publish).toHaveBeenCalledWith(
        'high-increment-events',
        expect.objectContaining({
          amount: 15
        })
      );
    });

    it('should handle errors in plugin chain gracefully', async () => {
      // Register a failing command handler
      eventSourcingPlugin.registerCommandHandler('FAILING_COMMAND', async () => {
        throw new Error('Command failed');
      });

      // Register a route that should never be reached
      const route: RouteDefinition = {
        name: 'unreachable-route',
        predicate: () => true,
        targetEventType: 'unreachable-events'
      };
      contentBasedRouter.registerRoute(route);

      // Initialize all plugins
      eventSourcingPlugin.initialize();
      outboxPattern.initialize();
      contentBasedRouter.initialize();

      // Send a failing command
      const command = {
        type: 'command.FAILING_COMMAND',
        payload: {
          type: 'FAILING_COMMAND',
          aggregateId: 'test-1',
          payload: {},
          timestamp: Date.now()
        }
      };

      await eventBus.publish('command.FAILING_COMMAND', command);

      // Verify error was captured in outbox
      expect(outboxRepository.saveEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'command.rejected',
          payload: expect.objectContaining({
            commandType: 'FAILING_COMMAND',
            reason: 'Command failed'
          })
        })
      );

      // Verify no routing occurred
      expect(eventBus.publish).not.toHaveBeenCalledWith('unreachable-events', expect.anything());
    });
  });
}); 