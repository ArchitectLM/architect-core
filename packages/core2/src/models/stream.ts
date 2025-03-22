import { EventBus } from './event';

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
  private operators: ((value: any) => any)[] = [];
  private isCompleted = false;

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

  map<R>(fn: (value: T) => R | Promise<R>): Stream<R> {
    const newStream = new StreamImpl<R>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: any) => await fn(value as T)];
    return newStream;
  }

  filter(predicate: (value: T) => boolean | Promise<boolean>): Stream<T> {
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, async (value: any) => {
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
    newStream.operators = [...this.operators, (value: any) => {
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
    newStream.operators = [...this.operators, (value: any) => {
      if (skipped < count) {
        skipped++;
        return undefined;
      }
      return value;
    }];
    return newStream;
  }

  distinct(): Stream<T> {
    const seen = new Set<T>();
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, (value: any) => {
      if (seen.has(value as T)) {
        return undefined;
      }
      seen.add(value as T);
      return value;
    }];
    return newStream;
  }

  debounce(ms: number): Stream<T> {
    let timeout: NodeJS.Timeout;
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, (value: any) => {
      clearTimeout(timeout);
      return new Promise(resolve => {
        timeout = setTimeout(() => resolve(value), ms);
      });
    }];
    return newStream;
  }

  throttle(ms: number): Stream<T> {
    let lastEmit = 0;
    const newStream = new StreamImpl<T>(this.eventType, this.eventBus);
    newStream.operators = [...this.operators, (value: any) => {
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
      let processedValue = value;
      
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

      // Notify subscribers
      for (const subscriber of this.subscribers) {
        if (subscriber.next) {
          await subscriber.next(processedValue);
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