import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDomainEvent } from '../helpers/event-testing-utils';
import { createInMemoryEventBus } from '../../src/implementations/event-bus';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { EventBus } from '../../src/models/event-system';
import { DomainEvent } from '../../src/models/core-types';

describe('Event Bus Implementation', () => {
  let eventBus: EventBus;
  let extensionSystem = createExtensionSystem();

  beforeEach(() => {
    extensionSystem = createExtensionSystem();
    eventBus = createInMemoryEventBus(extensionSystem);
  });

  it('should allow subscribing to events', () => {
    const handler = vi.fn();
    const subscription = eventBus.subscribe('test-event', handler);
    
    expect(subscription).toBeDefined();
    expect(subscription.id).toBeDefined();
    expect(typeof subscription.unsubscribe).toBe('function');
  });

  it('should call handler when event is published', () => {
    const handler = vi.fn();
    eventBus.subscribe('test-event', handler);
    
    const event = createDomainEvent('test-event', { message: 'Hello' });
    eventBus.publish(event);
    
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('should only call handlers for matching event type', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    
    eventBus.subscribe('event1', handler1);
    eventBus.subscribe('event2', handler2);
    
    const event = createDomainEvent('event1', { message: 'Hello' });
    eventBus.publish(event);
    
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing from events', () => {
    const handler = vi.fn();
    const subscription = eventBus.subscribe('test-event', handler);
    
    // First publication should trigger handler
    const event1 = createDomainEvent('test-event', { message: 'First' });
    eventBus.publish(event1);
    expect(handler).toHaveBeenCalledTimes(1);
    
    // Unsubscribe
    subscription.unsubscribe();
    
    // Second publication should not trigger handler
    const event2 = createDomainEvent('test-event', { message: 'Second' });
    eventBus.publish(event2);
    expect(handler).toHaveBeenCalledTimes(1); // Still just 1 call
  });

  it('should allow integration with the extension system', () => {
    // Register test extension point
    extensionSystem.registerExtensionPoint('test.extension', {
      description: 'Test extension point',
      schema: {}
    });
    
    let extensionCalled = false;
    
    // Register extension handler
    extensionSystem.registerExtension({
      id: 'test.extension.handler',
      name: 'Test Extension',
      version: '1.0.0',
      hooks: {
        'test.extension': () => {
          extensionCalled = true;
          return { success: true, value: undefined };
        }
      }
    });
    
    // Subscribe to event that should trigger extension point
    eventBus.subscribe('test-event', async (event: DomainEvent<unknown>) => {
      await extensionSystem.executeHook('test.extension', event.payload);
    });
    
    // Publish event
    const event = createDomainEvent('test-event', { message: 'Hello' });
    eventBus.publish(event);
    
    // Extension should have been called
    expect(extensionCalled).toBe(true);
  });
}); 