import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createDomainEvent } from '../helpers/event-testing-utils';
import { createInMemoryEventBus } from '../../src/implementations/event-bus';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { EventBus } from '../../src/models/event-system';
import { DomainEvent } from '../../src/models/core-types';
import { ExtensionSystem } from '../../src/models/extension-system';
import { createRuntime } from '../../src/implementations/factory';

describe('Event Bus Implementation', () => {
  let eventBus: EventBus;
  let extensionSystem: ExtensionSystem;
  let runtime: ReturnType<typeof createRuntime>;

  beforeEach(() => {
    // Create the extension system first
    extensionSystem = createExtensionSystem();
    
    // Create the event bus with the extension system
    eventBus = createInMemoryEventBus(extensionSystem);
    
    // Create a runtime with explicit components
    runtime = createRuntime({
      components: {
        extensionSystem,
        eventBus
      }
    });
  });

  afterEach(async () => {
    // Clean up subscriptions
    eventBus.clearAllSubscriptions();
  });

  it('should allow subscribing to events', () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const subscription = eventBus.subscribe('test-event', handler);
    
    expect(subscription).toBeDefined();
    expect(subscription.id).toBeDefined();
    expect(typeof subscription.unsubscribe).toBe('function');
  });

  it('should call handler when event is published', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    eventBus.subscribe('test-event', handler);
    
    const testPayload = { message: 'Hello' };
    const event = createDomainEvent('test-event', testPayload);
    await eventBus.publish(event);
    
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(testPayload);
  });

  it('should only call handlers for matching event type', async () => {
    const handler1 = vi.fn().mockResolvedValue(undefined);
    const handler2 = vi.fn().mockResolvedValue(undefined);
    
    eventBus.subscribe('event1', handler1);
    eventBus.subscribe('event2', handler2);
    
    const event = createDomainEvent('event1', { message: 'Hello' });
    await eventBus.publish(event);
    
    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();
  });

  it('should allow unsubscribing from events', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const subscription = eventBus.subscribe('test-event', handler);
    
    // First publication should trigger handler
    const event1 = createDomainEvent('test-event', { message: 'First' });
    await eventBus.publish(event1);
    expect(handler).toHaveBeenCalledTimes(1);
    
    // Unsubscribe
    subscription.unsubscribe();
    
    // Second publication should not trigger handler
    const event2 = createDomainEvent('test-event', { message: 'Second' });
    await eventBus.publish(event2);
    expect(handler).toHaveBeenCalledTimes(1); // Still just 1 call
  });

  it('should publish and receive event payloads correctly', async () => {
    // Setup a test subscription
    const receivedEvents: any[] = [];
    const subscription = eventBus.subscribe('test.event', async (payload) => {
      receivedEvents.push(payload);
      return Promise.resolve();
    });
    
    // Create and publish a test event
    const testMessage = { message: 'Hello World' };
    const event = createDomainEvent('test.event', testMessage);
    await eventBus.publish(event);
    
    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify event payload was received correctly
    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0]).toEqual(testMessage);
    
    // Cleanup
    subscription.unsubscribe();
  });

  it('should integrate with the extension system', async () => {
    // Register an extension point
    extensionSystem.registerExtensionPoint('test.extensionPoint');
    
    // Set up a flag to track if the extension was called
    let extensionPointCalled = false;
    
    // Register an extension that responds to the extension point
    extensionSystem.registerExtension({
      id: 'test.extension',
      name: 'Test Extension',
      description: 'A test extension',
      dependencies: [],
      getHooks: () => [{
        pointName: 'test.extensionPoint',
        hook: async () => {
          extensionPointCalled = true;
          return { success: true, value: undefined };
        }
      }],
      getVersion: () => '1.0.0',
      getCapabilities: () => []
    });
    
    // Subscribe to an event that will trigger the extension point
    eventBus.subscribe('test.triggerExtension', async (eventPayload) => {
      await extensionSystem.executeExtensionPoint('test.extensionPoint', eventPayload);
      return Promise.resolve();
    });
    
    // Publish an event that will trigger the extension
    const event = createDomainEvent('test.triggerExtension', { data: 'test data' });
    await eventBus.publish(event);
    
    // Wait for event processing and extension execution
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify the extension was called
    expect(extensionPointCalled).toBe(true);
  });
  
  it('should work with additional event bus functionality', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    
    // Test subscriberCount
    expect(eventBus.subscriberCount('test.count')).toBe(0);
    
    const subscription = eventBus.subscribe('test.count', handler);
    
    expect(eventBus.subscriberCount('test.count')).toBe(1);
    
    // Test hasSubscribers
    expect(eventBus.hasSubscribers('test.count')).toBe(true);
    expect(eventBus.hasSubscribers('nonexistent')).toBe(false);
    
    // Test clearSubscriptions
    eventBus.clearSubscriptions('test.count');
    expect(eventBus.subscriberCount('test.count')).toBe(0);
    
    // Verify unsubscription happened
    const event = createDomainEvent('test.count', { value: 1 });
    await eventBus.publish(event);
    expect(handler).not.toHaveBeenCalled();
  });
}); 