import { EventBus } from '../models/event-system';
import { BasePlugin, PluginOptions, PluginState, PluginLifecycle, PluginCapability } from '../models/plugin-system';
import { Result, DomainEvent } from '../models/core-types';
import { DomainError } from '../utils';
import { v4 as uuidv4 } from 'uuid';

export interface AggregateEvent {
  aggregateId: string;
  type: string;
  payload: any;
  version: number;
  timestamp: number;
}

export interface EventStoreEntry extends AggregateEvent {
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
  applyEvent(event: AggregateEvent): void;
  getUncommittedEvents(): AggregateEvent[];
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
  saveEvents(events: AggregateEvent[]): Promise<void>;
  getEvents(): Promise<Result<DomainEvent<AggregateEvent>[]>>;
  getEventsByAggregateId(aggregateId: string, fromVersion?: number): Promise<Result<DomainEvent<AggregateEvent>[]>>;
  saveSnapshot?(snapshot: AggregateSnapshot): Promise<void>;
  getLatestSnapshot?(aggregateId: string): Promise<AggregateSnapshot | null>;
}

interface EventSourcingData {
  initialized: boolean;
  lastError?: Error;
  commandHandlers: Map<string, CommandHandler>;
  aggregateFactories: Map<string, AggregateFactory>;
  [key: string]: unknown;
}

export interface EventSourcingPluginState extends PluginState {
  config: {
    enabled: boolean;
    snapshotThreshold: number;
    [key: string]: unknown;
  };
  data: EventSourcingData;
  status: {
    enabled: boolean;
    lastError?: Error;
    lastActionTimestamp?: number;
    health: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export class EventSourcingPlugin extends BasePlugin<EventSourcingPluginState> {
  constructor(
    private eventBus: EventBus,
    private eventStore: EventStore,
    options: PluginOptions
  ) {
    super(options);

    // Initialize plugin-specific state
    this.state = {
      id: options.id,
      config: {
        enabled: true,
        snapshotThreshold: 100,
        ...options.config
      },
      data: {
        initialized: false,
        commandHandlers: new Map<string, CommandHandler>(),
        aggregateFactories: new Map<string, AggregateFactory>()
      },
      status: {
        enabled: false,
        health: 'unhealthy'
      }
    };

    // Register event sourcing capabilities
    this.registerCapability({
      id: 'event-sourcing.command-handler',
      name: 'Command Handler Registration',
      description: 'Register command handlers for event sourcing',
      implementation: {
        registerHandler: this.registerCommandHandler.bind(this)
      }
    });

    this.registerCapability({
      id: 'event-sourcing.aggregate-factory',
      name: 'Aggregate Factory Registration',
      description: 'Register aggregate factories for event sourcing',
      implementation: {
        registerFactory: this.registerAggregateFactory.bind(this)
      }
    });

    this.registerCapability({
      id: 'event-sourcing.aggregate-management',
      name: 'Aggregate Management',
      description: 'Load and save aggregates with event sourcing',
      implementation: {
        loadAggregate: this.loadAggregate.bind(this),
        loadAggregateFromSnapshot: this.loadAggregateFromSnapshot.bind(this),
        saveAggregate: this.saveAggregate.bind(this),
        createSnapshot: this.createSnapshot.bind(this)
      }
    });
  }

  /**
   * Get the version of this plugin
   */
  getVersion(): string {
    return '1.0.0';
  }

  /** Plugin lifecycle methods */
  lifecycle: PluginLifecycle = {
    initialize: async (config: Record<string, unknown>): Promise<Result<void>> => {
      try {
        // Validate configuration
        const validationResult = this.validateConfig(config);
        if (!validationResult.success) {
          return validationResult;
        }

        // Subscribe to command events
        await this.eventBus.subscribe('command.*', this.handleCommand.bind(this));

        // Update state
        this.setState({
          config: {
            ...this.state.config,
            ...config
          },
          data: {
            ...this.state.data,
            initialized: true
          },
          status: {
            ...this.state.status,
            health: 'healthy'
          }
        });

        return { success: true, value: undefined };
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },

    start: async (): Promise<Result<void>> => {
      try {
        if (!this.state.data.initialized) {
          return {
            success: false,
            error: new DomainError('Plugin must be initialized before starting')
          };
        }

        this.setState({
          status: {
            ...this.state.status,
            enabled: true,
            lastActionTimestamp: Date.now()
          }
        });

        return { success: true, value: undefined };
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },

    stop: async (): Promise<Result<void>> => {
      try {
        this.setState({
          status: {
            ...this.state.status,
            enabled: false,
            lastActionTimestamp: Date.now()
          }
        });

        return { success: true, value: undefined };
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },

    cleanup: async (): Promise<Result<void>> => {
      try {
        // Unsubscribe from events
        this.eventBus.unsubscribe('command.*', this.handleCommand.bind(this));

        // Update state
        this.setState({
          status: {
            ...this.state.status,
            enabled: false,
            health: 'unhealthy'
          }
        });

        return { success: true, value: undefined };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    }
  };

  /**
   * Check plugin health
   */
  healthCheck(): Result<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: Record<string, unknown>;
  }> {
    return {
      success: true,
      value: {
        status: this.state.status.health,
        details: {
          enabled: this.state.status.enabled,
          initialized: this.state.data.initialized,
          lastError: this.state.status.lastError?.message,
          lastActionTimestamp: this.state.status.lastActionTimestamp,
          commandHandlers: this.state.data.commandHandlers.size,
          aggregateFactories: this.state.data.aggregateFactories.size
        }
      }
    };
  }

  protected validateConfig(config: Record<string, unknown>): Result<void> {
    if (typeof config.snapshotThreshold !== 'number' || config.snapshotThreshold < 0) {
      return {
        success: false,
        error: new DomainError('snapshotThreshold must be a positive number')
      };
    }
    return { success: true, value: undefined };
  }

  protected handleError(error: Error): void {
    this.setState({
      status: {
        ...this.state.status,
        health: 'degraded',
        lastError: error,
        lastActionTimestamp: Date.now()
      },
      data: {
        ...this.state.data,
        lastError: error
      }
    });
  }

  public registerCommandHandler(commandType: string, handler: CommandHandler): void {
    this.state.data.commandHandlers.set(commandType, handler);
  }

  public registerAggregateFactory(aggregateType: string, factory: AggregateFactory): void {
    this.state.data.aggregateFactories.set(aggregateType, factory);
  }

  public async loadAggregate<T extends AggregateRoot>(aggregateType: string, aggregateId: string): Promise<T> {
    try {
      const factory = this.state.data.aggregateFactories.get(aggregateType);
      if (!factory) {
        throw new DomainError(`No factory registered for aggregate type ${aggregateType}`);
      }

      const aggregate = factory(aggregateId) as T;
      const eventsResult = await this.eventStore.getEventsByAggregateId(aggregateId);

      if (!eventsResult.success || !eventsResult.value) {
        throw new DomainError(`Failed to load events: ${eventsResult.error?.message}`);
      }

      for (const event of eventsResult.value) {
        aggregate.applyEvent(event.payload);
      }

      return aggregate;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async loadAggregateFromSnapshot<T extends AggregateRoot>(aggregateType: string, aggregateId: string): Promise<T> {
    try {
      if (!this.eventStore.getLatestSnapshot) {
        throw new DomainError('Event store does not support snapshots');
      }

      const factory = this.state.data.aggregateFactories.get(aggregateType);
      if (!factory) {
        throw new DomainError(`No factory registered for aggregate type ${aggregateType}`);
      }

      const snapshot = await this.eventStore.getLatestSnapshot(aggregateId);
      const aggregate = factory(aggregateId) as T;

      if (snapshot) {
        Object.assign(aggregate, { 
          _version: snapshot.version,
          _state: snapshot.state
        });

        const eventsResult = await this.eventStore.getEventsByAggregateId(aggregateId, snapshot.version + 1);
        if (!eventsResult.success || !eventsResult.value) {
          throw new DomainError(`Failed to load events: ${eventsResult.error?.message}`);
        }

        for (const event of eventsResult.value) {
          aggregate.applyEvent(event.payload);
        }
      } else {
        const eventsResult = await this.eventStore.getEventsByAggregateId(aggregateId);
        if (!eventsResult.success || !eventsResult.value) {
          throw new DomainError(`Failed to load events: ${eventsResult.error?.message}`);
        }

        for (const event of eventsResult.value) {
          aggregate.applyEvent(event.payload);
        }
      }

      return aggregate;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async saveAggregate(aggregate: AggregateRoot): Promise<void> {
    try {
      const uncommittedEvents = aggregate.getUncommittedEvents();
      if (uncommittedEvents.length === 0) {
        return;
      }

      await this.eventStore.saveEvents(uncommittedEvents);

      for (const event of uncommittedEvents) {
        const domainEvent: DomainEvent<AggregateEvent> = {
          id: uuidv4(),
          type: `event.${event.type}`,
          timestamp: Date.now(),
          payload: event
        };
        await this.eventBus.publish(domainEvent);
      }

      aggregate.clearUncommittedEvents();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async getAllEvents(): Promise<DomainEvent<AggregateEvent>[]> {
    try {
      const eventsResult = await this.eventStore.getEvents();
      if (!eventsResult.success || !eventsResult.value) {
        throw new DomainError(`Failed to load events: ${eventsResult.error?.message}`);
      }
      return eventsResult.value;
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  public async createSnapshot(aggregate: AggregateRoot): Promise<void> {
    try {
      if (!this.eventStore.saveSnapshot) {
        throw new DomainError('Event store does not support snapshots');
      }

      let aggregateType: string | undefined;
      for (const [type, factory] of this.state.data.aggregateFactories.entries()) {
        const testAggregate = factory('dummy');
        if (aggregate.constructor === testAggregate.constructor) {
          aggregateType = type;
          break;
        }
      }

      if (!aggregateType) {
        throw new DomainError('Could not determine aggregate type');
      }

      const snapshot: AggregateSnapshot = {
        aggregateId: aggregate.id,
        aggregateType,
        version: aggregate.version,
        state: (aggregate as any)._state || (aggregate as any).state,
        timestamp: Date.now()
      };

      await this.eventStore.saveSnapshot(snapshot);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async handleCommand(event: DomainEvent<Command>): Promise<void> {
    try {
      const commandType = event.type.replace('command.', '');
      const command = event.payload;

      const handler = this.state.data.commandHandlers.get(commandType);
      if (!handler) {
        const rejectionEvent: DomainEvent<{ commandType: string; aggregateId: string; reason: string }> = {
          id: uuidv4(),
          type: 'command.rejected',
          timestamp: Date.now(),
          payload: {
            commandType,
            aggregateId: command.aggregateId,
            reason: `No handler registered for command type ${commandType}`
          }
        };
        await this.eventBus.publish(rejectionEvent);
        return;
      }

      const aggregate = await handler(command);
      await this.saveAggregate(aggregate);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
      const rejectionEvent: DomainEvent<{ commandType: string; aggregateId: string; reason: string }> = {
        id: uuidv4(),
        type: 'command.rejected',
        timestamp: Date.now(),
        payload: {
          commandType: event.type.replace('command.', ''),
          aggregateId: event.payload.aggregateId,
          reason: error instanceof Error ? error.message : String(error)
        }
      };
      await this.eventBus.publish(rejectionEvent);
    }
  }
}

export function createEventSourcingPlugin(
  eventBus: EventBus,
  eventStore: EventStore,
  options: PluginOptions
): EventSourcingPlugin {
  return new EventSourcingPlugin(eventBus, eventStore, options);
} 