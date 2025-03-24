import { DomainEvent, Result } from '../../src/models/core-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Creates a test event with the given type and payload
 */
export function createTestEvent<T>(type: string, payload: T, options: {
  id?: string;
  timestamp?: number;
  correlationId?: string;
  metadata?: Record<string, any>;
} = {}): DomainEvent<T> {
  return {
    id: options.id || uuidv4(),
    type,
    timestamp: options.timestamp || Date.now(),
    payload,
    metadata: options.correlationId 
      ? { ...options.metadata, correlationId: options.correlationId }
      : options.metadata
  };
}

/**
 * Creates a batch of test events with the given type
 */
export function createTestEventBatch<T>(
  type: string, 
  payloads: T[], 
  baseTimestamp = Date.now(),
  correlationId?: string
): DomainEvent<T>[] {
  return payloads.map((payload, index) => createTestEvent(
    type,
    payload,
    {
      timestamp: baseTimestamp + index * 100,
      correlationId
    }
  ));
}

/**
 * Helper to poll until a condition is met or timeout
 */
export async function pollUntil(
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
 * Creates events spaced out over a time range
 */
export function createTimeRangeEvents(
  type: string, 
  count: number, 
  startTime: number, 
  endTime: number
): DomainEvent<{ index: number; timestamp: number }>[] {
  const timeStep = (endTime - startTime) / (count - 1);
  
  return Array.from({ length: count }).map((_, index) => {
    const timestamp = startTime + index * timeStep;
    return createTestEvent(
      type,
      { index, timestamp },
      { timestamp }
    );
  });
}

/**
 * Verifies that two events have the same core properties
 */
export function expectEventsEqual<T>(actual: DomainEvent<T>, expected: DomainEvent<T>): void {
  expect(actual.id).toBe(expected.id);
  expect(actual.type).toBe(expected.type);
  expect(actual.timestamp).toBe(expected.timestamp);
  expect(actual.payload).toEqual(expected.payload);
  
  // Check metadata if both have it defined
  if (actual.metadata && expected.metadata) {
    expect(actual.metadata).toEqual(expected.metadata);
  }
}

/**
 * Wait for promises to settle
 */
export async function flushPromises(): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
} 