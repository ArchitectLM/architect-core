import { vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { DomainEvent, Result } from '../../src/models/core-types';
import { EventHandler, EventFilter } from '../../src/models/event-system';
import { ExtensionSystem, ExtensionPointNames } from '../../src/models/extension-system';

/**
 * Create a test event with the specified type and payload
 * @param type The event type
 * @param payload The event payload
 * @returns A new DomainEvent instance
 */
export function createTestEvent<T>(type: string, payload: T): DomainEvent<T> {
  return {
    id: uuidv4(),
    type,
    timestamp: Date.now(),
    payload
  };
}

/**
 * Create a mock event handler that can be used in tests
 * @returns A mock event handler function
 */
export function createMockEventHandler<T = any>(): EventHandler<T> & { mock: ReturnType<typeof vi.fn> } {
  const handler = vi.fn() as any;
  return handler;
}

/**
 * Create a mock event filter that can be used in tests
 * @param predicate The predicate function to use for filtering
 * @returns A mock event filter function
 */
export function createMockEventFilter<T = any>(
  predicate: (event: DomainEvent<T>) => boolean
): EventFilter<T> & { mock: ReturnType<typeof vi.fn> } {
  const filter = vi.fn().mockImplementation(predicate) as any;
  return filter;
}

/**
 * Create a mock extension system for testing
 * @param options Options for configuring the mock behavior
 * @returns A mock extension system
 */
export function createMockExtensionSystem(options: {
  successfulHooks?: boolean;
  beforePublishResult?: Result<any>;
  afterPublishResult?: Result<any>;
} = {}): ExtensionSystem {
  const {
    successfulHooks = true,
    beforePublishResult = { success: true, value: undefined },
    afterPublishResult = { success: true, value: undefined }
  } = options;

  return {
    registerExtension: vi.fn().mockReturnValue({ success: true, value: undefined }),
    unregisterExtension: vi.fn().mockReturnValue({ success: true, value: undefined }),
    getExtensions: vi.fn().mockReturnValue([]),
    executeExtensionPoint: vi.fn().mockImplementation((pointName, params) => {
      if (pointName === ExtensionPointNames.EVENT_BEFORE_PUBLISH) {
        return Promise.resolve(beforePublishResult);
      }
      if (pointName === ExtensionPointNames.EVENT_AFTER_PUBLISH) {
        return Promise.resolve(afterPublishResult);
      }
      if (pointName === ExtensionPointNames.SYSTEM_INIT) {
        return Promise.resolve({ success: true, value: { initialized: true } });
      }
      return Promise.resolve({ success: successfulHooks, value: undefined });
    }),
    getExtension: vi.fn(),
    hasExtension: vi.fn()
  };
}

/**
 * Wait for all promises to resolve
 * Useful in tests where multiple async operations need to complete
 */
export async function flushPromises(): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(resolve, 0);
  });
} 