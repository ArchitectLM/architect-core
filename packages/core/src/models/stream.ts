import { EventBus } from './event-system';
import { DomainEvent } from './core-types';

export interface StreamSubscription<T> {
  unsubscribe(): void;
}

export interface StreamObserver<T> {
  next?: (value: T) => void | Promise<void>;
  error?: (error: Error) => void | Promise<void>;
  complete?: () => void | Promise<void>;
}

export interface Stream<T> {
  subscribe(observer: StreamObserver<T> | ((value: T) => void)): StreamSubscription<T>;
  map<R>(fn: (value: T) => R | Promise<R>): Stream<R>;
  filter(predicate: (value: T) => boolean | Promise<boolean>): Stream<T>;
  reduce<R>(reducer: (acc: R, value: T) => R | Promise<R>, initial: R): Promise<R>;
  complete(): void;
  take(count: number): Stream<T>;
  skip(count: number): Stream<T>;
  distinct(): Stream<T>;
  debounce(ms: number): Stream<T>;
  throttle(ms: number): Stream<T>;
}

export function createStream<T>(eventType: string, eventBus: EventBus): Stream<T> {
  return new StreamImpl<T>(eventType, eventBus);
}

class StreamImpl<T> implements Stream<T> {
  private subscribers: Set<StreamObserver<T>> = new Set();
  private operators: Array<(value: unknown) => Promise<unknown>> = [];
  private isCompleted = false;

  constructor(private eventType: string, private eventBus: EventBus) {
    this.eventBus.subscribe(eventType, async (payload: unknown) => {
      // Extract payload from DomainEvent object if needed
      const eventData = this.isDomainEvent(payload) ? payload.payload : payload;
      await this.handleEvent(eventData as T);
      return;
    });
  }

  // Type guard to check if an object is a DomainEvent
  private isDomainEvent(obj: unknown): obj is DomainEvent<unknown> {
    return obj !== null && 
      typeof obj === 'object' && 
      'type' in obj && 
      'payload' in obj &&
      'timestamp' in obj;
  }

  subscribe(observer: StreamObserver<T> | ((value: T) => void)): StreamSubscription<T> {
    const normalizedObserver = typeof observer === 'function' 
      ? { next: observer }
      : observer;

    this.subscribers.add(normalizedObserver);

    return {
      unsubscribe: () => {
        this.subscribers.delete(normalizedObserver);
      }
    };
  }

  map<R>(fn: (value: T) => R | Promise<R>): Stream<R> {
    const newStream = new StreamImpl<R>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: unknown) => await fn(value as T)];
    return newStream;
  }

  filter(predicate: (value: T) => boolean | Promise<boolean>): Stream<T> {
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: unknown) => {
      const shouldKeep = await predicate(value as T);
      return shouldKeep ? value : undefined;
    }];
    return newStream;
  }

  async reduce<R>(reducer: (acc: R, value: T) => R | Promise<R>, initial: R): Promise<R> {
    return new Promise((resolve, reject) => {
      let result = initial;
      const subscription = this.subscribe({
        next: async (value: T) => {
          try {
            result = await reducer(result, value);
          } catch (error) {
            reject(error as Error);
          }
        },
        error: reject,
        complete: () => resolve(result)
      });

      // Complete after a short delay to allow events to be processed
      setTimeout(() => {
        subscription.unsubscribe();
        resolve(result);
      }, 0);
    });
  }

  complete(): void {
    this.isCompleted = true;
    for (const subscriber of this.subscribers) {
      if (subscriber.complete) {
        subscriber.complete();
      }
    }
  }

  take(count: number): Stream<T> {
    let taken = 0;
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: unknown) => {
      if (taken >= count) {
        this.complete();
        return undefined;
      }
      taken++;
      return value;
    }];
    return newStream;
  }

  skip(count: number): Stream<T> {
    let skipped = 0;
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: unknown) => {
      if (skipped < count) {
        skipped++;
        return undefined;
      }
      return value;
    }];
    return newStream;
  }

  distinct(): Stream<T> {
    const seen = new Set<unknown>();
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: unknown) => {
      // We need to use JSON.stringify for complex objects to ensure proper comparison
      const serialized = JSON.stringify(value);
      if (seen.has(serialized)) {
        return undefined;
      }
      seen.add(serialized);
      return value;
    }];
    return newStream;
  }

  debounce(ms: number): Stream<T> {
    let timeout: NodeJS.Timeout;
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: unknown) => {
      return new Promise<unknown>(resolve => {
        clearTimeout(timeout);
        timeout = setTimeout(() => resolve(value), ms);
      });
    }];
    return newStream;
  }

  throttle(ms: number): Stream<T> {
    let lastEmit = 0;
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: unknown) => {
      const now = Date.now();
      if (now - lastEmit < ms) {
        return undefined;
      }
      lastEmit = now;
      return value;
    }];
    return newStream;
  }

  private async handleEvent(value: T): Promise<void> {
    if (this.isCompleted) return;

    try {
      let processedValue: unknown = value;
      
      // Apply operators
      for (const operator of this.operators) {
        try {
          processedValue = await operator(processedValue);
          if (processedValue === undefined) {
            return;
          }
        } catch (error) {
          throw error;
        }
      }

      // Notify subscribers with the properly typed value
      for (const subscriber of this.subscribers) {
        if (subscriber.next) {
          // Safe to cast back to T as that's the contract of our operators
          await subscriber.next(processedValue as T);
        }
      }
    } catch (error) {
      for (const subscriber of this.subscribers) {
        if (subscriber.error) {
          await subscriber.error(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }
} 