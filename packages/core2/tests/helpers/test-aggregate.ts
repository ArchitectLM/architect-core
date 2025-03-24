import { AggregateRoot, AggregateEvent } from '../../src/plugins/event-sourcing';

/**
 * Test aggregate implementation for event sourcing tests
 */
export class TestAggregate implements AggregateRoot {
  private _id: string;
  private _version: number = 0;
  private _state: { value: number } = { value: 0 };
  private _events: AggregateEvent[] = [];

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

  applyEvent(event: AggregateEvent): void {
    if (event.type === 'VALUE_INCREMENTED') {
      this._state.value += event.payload.amount;
    } else if (event.type === 'VALUE_DECREMENTED') {
      this._state.value -= event.payload.amount;
    }
    this._version = event.version;
  }

  getUncommittedEvents(): AggregateEvent[] {
    return [...this._events];
  }

  clearUncommittedEvents(): void {
    this._events = [];
  }

  // Commands
  increment(amount: number): void {
    const event: AggregateEvent = {
      aggregateId: this._id,
      type: 'VALUE_INCREMENTED',
      payload: { amount },
      version: this._version + 1,
      timestamp: Date.now()
    };
    
    this._events.push(event);
    this.applyEvent(event);
  }

  decrement(amount: number): void {
    const event: AggregateEvent = {
      aggregateId: this._id,
      type: 'VALUE_DECREMENTED',
      payload: { amount },
      version: this._version + 1,
      timestamp: Date.now()
    };
    
    this._events.push(event);
    this.applyEvent(event);
  }
} 