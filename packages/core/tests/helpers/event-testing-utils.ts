import { vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent, Result, Identifier } from '../../src/models/core-types';
import { EventHandler, EventFilter, EventBus, SubscriptionOptions, Subscription } from '../../src/models/event-system';
import { ExtensionSystem } from '../../src/models/extension-system';

/**
 * Create a test event with the given type and payload
 */
export function createTestEvent<T>(type: string, payload: T): DomainEvent<T> {
  return {
    id: uuidv4(),
    type,
    timestamp: Date.now(),
    payload,
    metadata: {},
    correlationId: uuidv4()
  };
}

/**
 * Create a mock event handler for testing
 */
export function createMockEventHandler<T>(): {
  handler: EventHandler<T>;
  mockClear: () => void;
  getCallCount: () => number;
  getEvents: () => T[];
} {
  const events: T[] = [];
  const handlerFn = vi.fn(async (payload: T) => {
    events.push(payload);
    return Promise.resolve();
  });

  return {
    handler: handlerFn,
    mockClear: () => {
      handlerFn.mockClear();
      events.length = 0;
    },
    getCallCount: () => handlerFn.mock.calls.length,
    getEvents: () => [...events]
  };
}

/**
 * Create a mock event filter for testing
 */
export function createMockEventFilter<T>(
  predicate: (event: DomainEvent<T>) => boolean
): EventFilter<T> {
  return (event: DomainEvent<T>) => predicate(event);
}

/**
 * Create a mock extension system for testing
 */
export function createMockExtensionSystem(): Partial<ExtensionSystem> {
  return {
    registerExtension: vi.fn().mockReturnValue({ success: true, value: undefined }),
    unregisterExtension: vi.fn().mockReturnValue({ success: true, value: undefined }),
    executeExtensionPoint: vi.fn().mockResolvedValue({ success: true, value: undefined }),
    getExtensions: vi.fn().mockReturnValue([]),
    registerExtensionPoint: vi.fn()
  };
}

/**
 * Wait for all microtasks to complete
 */
export async function flushPromises(): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
}

/**
 * Create a standard domain event object from type and payload
 */
export function createDomainEvent<T = unknown>(
  eventType: string,
  payload: T,
  options?: {
    id?: string;
    timestamp?: number;
    correlationId?: string;
    metadata?: Record<string, unknown>;
  }
): DomainEvent<T> {
  return {
    id: options?.id || uuidv4(),
    type: eventType,
    timestamp: options?.timestamp || Date.now(),
    payload,
    correlationId: options?.correlationId || uuidv4(),
    metadata: options?.metadata || {}
  };
}

/**
 * Creates an adapter for event bus to support both publishing patterns:
 * - Legacy: eventBus.publish(eventType, payload)
 * - Modern: eventBus.publish(domainEvent)
 */
export function createEventBusAdapter(eventBus: EventBus): {
  publish<T = unknown>(eventTypeOrEvent: string | DomainEvent<T>, payload?: T): Promise<void>;
  subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): Subscription;
} {
  return {
    async publish<T = unknown>(eventTypeOrEvent: string | DomainEvent<T>, payload?: T): Promise<void> {
      // If first parameter is a string, convert to DomainEvent
      if (typeof eventTypeOrEvent === 'string') {
        if (payload === undefined) {
          throw new Error('Payload is required when using string event type');
        }
        const event = createDomainEvent(eventTypeOrEvent, payload);
        return eventBus.publish(event);
      } else {
        // Otherwise, assume it's already a DomainEvent
        return eventBus.publish(eventTypeOrEvent);
      }
    },
    
    subscribe<T = unknown>(eventType: string, handler: EventHandler<T>): Subscription {
      return eventBus.subscribe(eventType, handler);
    }
  };
}

/**
 * Helper to wait for an event to be published
 */
export async function waitForEvent<T = unknown>(
  eventBus: EventBus,
  eventType: string,
  predicate?: (event: T) => boolean,
  timeout = 1000
): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let timeoutId: NodeJS.Timeout;
    const events: T[] = [];
    
    const subscription = eventBus.subscribe<T>(eventType, async (payload) => {
      events.push(payload);
      
      // If predicate is provided, check if any event matches
      if (predicate) {
        const matchingEvent = events.find(predicate);
        if (matchingEvent) {
          clearTimeout(timeoutId);
          subscription.unsubscribe();
          resolve(matchingEvent);
        }
      } else if (events.length > 0) {
        // If no predicate, return the first event
        clearTimeout(timeoutId);
        subscription.unsubscribe();
        resolve(events[0]);
      }
    });
    
    // Set timeout to resolve with null if no matching event is received
    timeoutId = setTimeout(() => {
      subscription.unsubscribe();
      resolve(null);
    }, timeout);
  });
}

/**
 * Poll until a condition is met with events
 */
export async function pollUntilEventCondition(
  condition: () => boolean | Promise<boolean>,
  interval = 10,
  timeout = 1000
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}

/**
 * Subscribe with a filter adapter for compatibility with different event bus implementations
 */
export function subscribeWithCompatibilityFilter<T>(
  eventBus: EventBus,
  eventType: string, 
  filter: (event: DomainEvent<T>) => boolean, 
  handler: EventHandler<T>
): Subscription {
  // Create an adapter handler that applies the filter
  const adapterHandler: EventHandler<T> = async (payload) => {
    // For modern event bus implementations, we need to recreate an event object
    // to pass to the filter, since it expects a DomainEvent but the handler
    // only receives the payload
    const syntheticEvent: DomainEvent<T> = {
      id: uuidv4(),
      type: eventType,
      timestamp: Date.now(),
      payload,
      correlationId: uuidv4(),
      metadata: {}
    };

    // Only call the handler if the filter matches
    if (filter(syntheticEvent)) {
      await handler(payload);
    }
  };

  // Subscribe with the adapter handler
  return eventBus.subscribe(eventType, adapterHandler);
} 