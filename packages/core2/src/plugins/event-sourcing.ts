import { EventBus } from '../models/event-system';
import { v4 as uuidv4 } from 'uuid';

export interface DomainEvent {
  aggregateId: string;
  type: string;
  payload: any;
  version: number;
  timestamp: number;
}

export interface EventStoreEntry extends DomainEvent {
  id: string;
}

export interface Command {
  type: string;
  aggregateId: string;
  payload: any;
  timestamp: number;
}

export interface CommandHandler {
  (command: Command): Promise<AggregateRoot>;
}

export interface AggregateFactory {
  (id: string): AggregateRoot;
}

export interface AggregateRoot {
  id: string;
  version: number;
  applyEvent(event: DomainEvent): void;
  getUncommittedEvents(): DomainEvent[];
  clearUncommittedEvents(): void;
}

export interface AggregateSnapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: any;
  timestamp: number;
}

export interface EventStore {
  saveEvents(events: DomainEvent[]): Promise<void>;
  getEvents(): Promise<EventStoreEntry[]>;
  getEventsByAggregateId(aggregateId: string, fromVersion?: number): Promise<EventStoreEntry[]>;
  saveSnapshot?(snapshot: AggregateSnapshot): Promise<void>;
  getLatestSnapshot?(aggregateId: string): Promise<AggregateSnapshot | null>;
}

export interface EventSourcingPlugin {
  initialize(): void;
  registerCommandHandler(commandType: string, handler: CommandHandler): void;
  registerAggregateFactory(aggregateType: string, factory: AggregateFactory): void;
  loadAggregate<T extends AggregateRoot>(aggregateType: string, aggregateId: string): Promise<T>;
  loadAggregateFromSnapshot<T extends AggregateRoot>(aggregateType: string, aggregateId: string): Promise<T>;
  saveAggregate(aggregate: AggregateRoot): Promise<void>;
  getAllEvents(): Promise<EventStoreEntry[]>;
  createSnapshot(aggregate: AggregateRoot): Promise<void>;
}

export class EventSourcingPluginImpl implements EventSourcingPlugin {
  private commandHandlers: Map<string, CommandHandler> = new Map();
  private aggregateFactories: Map<string, AggregateFactory> = new Map();

  constructor(
    private eventBus: EventBus,
    private eventStore: EventStore
  ) {}

  initialize(): void {
    this.eventBus.subscribe('command.*', this.handleCommand.bind(this));
  }

  registerCommandHandler(commandType: string, handler: CommandHandler): void {
    this.commandHandlers.set(commandType, handler);
  }

  registerAggregateFactory(aggregateType: string, factory: AggregateFactory): void {
    this.aggregateFactories.set(aggregateType, factory);
  }

  async loadAggregate<T extends AggregateRoot>(aggregateType: string, aggregateId: string): Promise<T> {
    const factory = this.aggregateFactories.get(aggregateType);
    if (!factory) {
      throw new Error(`No factory registered for aggregate type ${aggregateType}`);
    }

    const aggregate = factory(aggregateId) as T;
    const events = await this.eventStore.getEventsByAggregateId(aggregateId);

    for (const event of events) {
      aggregate.applyEvent(event);
    }

    return aggregate;
  }

  async loadAggregateFromSnapshot<T extends AggregateRoot>(aggregateType: string, aggregateId: string): Promise<T> {
    if (!this.eventStore.getLatestSnapshot) {
      throw new Error('Event store does not support snapshots');
    }

    const factory = this.aggregateFactories.get(aggregateType);
    if (!factory) {
      throw new Error(`No factory registered for aggregate type ${aggregateType}`);
    }

    const snapshot = await this.eventStore.getLatestSnapshot(aggregateId);
    const aggregate = factory(aggregateId) as T;

    if (snapshot) {
      // Apply the snapshot state to the aggregate
      Object.assign(aggregate, { 
        _version: snapshot.version,
        _state: snapshot.state
      });

      // Load and apply events that occurred after the snapshot
      const events = await this.eventStore.getEventsByAggregateId(aggregateId, snapshot.version + 1);
      for (const event of events) {
        aggregate.applyEvent(event);
      }
    } else {
      // No snapshot exists, load all events
      const events = await this.eventStore.getEventsByAggregateId(aggregateId);
      for (const event of events) {
        aggregate.applyEvent(event);
      }
    }

    return aggregate;
  }

  async saveAggregate(aggregate: AggregateRoot): Promise<void> {
    const uncommittedEvents = aggregate.getUncommittedEvents();
    if (uncommittedEvents.length === 0) {
      return;
    }

    // Save events to the event store
    await this.eventStore.saveEvents(uncommittedEvents);

    // Publish events to the event bus
    for (const event of uncommittedEvents) {
      this.eventBus.publish({
        id: uuidv4(),
        type: event.type,
        timestamp: event.timestamp,
        payload: event
      });
    }

    // Clear uncommitted events
    aggregate.clearUncommittedEvents();
  }

  async getAllEvents(): Promise<EventStoreEntry[]> {
    return this.eventStore.getEvents();
  }

  async createSnapshot(aggregate: AggregateRoot): Promise<void> {
    if (!this.eventStore.saveSnapshot) {
      throw new Error('Event store does not support snapshots');
    }

    // Find the aggregate type by searching through all registered factories
    let aggregateType: string | undefined;
    for (const [type, factory] of this.aggregateFactories.entries()) {
      if (aggregate instanceof Object.getPrototypeOf(factory('dummy')).constructor) {
        aggregateType = type;
        break;
      }
    }

    if (!aggregateType) {
      throw new Error('Could not determine aggregate type');
    }

    // Create and save the snapshot
    const snapshot: AggregateSnapshot = {
      aggregateId: aggregate.id,
      aggregateType,
      version: aggregate.version,
      state: (aggregate as any)._state || (aggregate as any).state,
      timestamp: Date.now()
    };

    await this.eventStore.saveSnapshot(snapshot);
  }

  private async handleCommand(event: { type: string, payload: Command }): Promise<void> {
    const commandType = event.type.replace('command.', '');
    const command = event.payload;

    const handler = this.commandHandlers.get(commandType);
    if (!handler) {
      this.eventBus.publish({
        id: uuidv4(),
        type: 'command.rejected',
        timestamp: Date.now(),
        payload: {
          commandType,
          aggregateId: command.aggregateId,
          reason: `No handler registered for command type ${commandType}`
        }
      });
      return;
    }

    try {
      // Execute the command handler, which returns an aggregate with uncommitted events
      const aggregate = await handler(command);
      
      // Save the aggregate's events
      await this.saveAggregate(aggregate);
    } catch (error) {
      // Handle command errors
      this.eventBus.publish({
        id: uuidv4(),
        type: 'command.rejected',
        timestamp: Date.now(),
        payload: {
          commandType,
          aggregateId: command.aggregateId,
          reason: error instanceof Error ? error.message : String(error)
        }
      });
    }
  }
}

export function createEventSourcingPlugin(eventBus: EventBus, eventStore: EventStore): EventSourcingPlugin {
  return new EventSourcingPluginImpl(eventBus, eventStore);
} 