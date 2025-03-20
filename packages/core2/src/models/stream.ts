import { EventBus } from './event.js';

export interface StreamSubscription<T> {
  unsubscribe(): void;
}

export interface StreamObserver<T> {
  next?: (value: T) => void;
  error?: (error: Error) => void;
  complete?: () => void;
}

export interface Stream<T> {
  subscribe(observer: StreamObserver<T> | ((value: T) => void)): StreamSubscription<T>;
  map<R>(fn: (value: T) => R): Stream<R>;
  filter(predicate: (value: T) => boolean): Stream<T>;
  reduce<R>(reducer: (acc: R, value: T) => R, initial: R): Promise<R>;
}

export function createStream<T>(eventType: string, eventBus: EventBus): Stream<T> {
  return new StreamImpl<T>(eventType, eventBus);
}

class StreamImpl<T> implements Stream<T> {
  private subscribers: Set<StreamObserver<T>> = new Set();
  private operators: ((value: any) => any)[] = [];

  constructor(private eventType: string, private eventBus: EventBus) {
    this.eventBus.subscribe(eventType, (event: any) => {
      this.handleEvent(event.payload);
    });
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

  map<R>(fn: (value: T) => R): Stream<R> {
    const newStream = new StreamImpl<R>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, (value: any) => fn(value as T)];
    return newStream;
  }

  filter(predicate: (value: T) => boolean): Stream<T> {
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, (value: any) => {
      if (!predicate(value as T)) {
        throw new Error('FILTER_REJECT');
      }
      return value;
    }];
    return newStream;
  }

  async reduce<R>(reducer: (acc: R, value: T) => R, initial: R): Promise<R> {
    return new Promise((resolve, reject) => {
      let result = initial;
      const subscription = this.subscribe({
        next: (value: T) => {
          try {
            result = reducer(result, value);
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

  private handleEvent(value: T): void {
    try {
      let processedValue = value;
      
      // Apply operators
      for (const operator of this.operators) {
        try {
          processedValue = operator(processedValue);
        } catch (error) {
          if (error instanceof Error && error.message === 'FILTER_REJECT') {
            return;
          }
          throw error;
        }
      }

      // Notify subscribers
      for (const subscriber of this.subscribers) {
        if (subscriber.next) {
          subscriber.next(processedValue);
        }
      }
    } catch (error) {
      for (const subscriber of this.subscribers) {
        if (subscriber.error) {
          subscriber.error(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  }
} 