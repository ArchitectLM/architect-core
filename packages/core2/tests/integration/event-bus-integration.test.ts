import { describe, it, expect, beforeEach } from 'vitest';
import { createRuntime } from '../../src/implementations/factory';
import { createDomainEvent } from '../helpers/event-testing-utils';
import { createExtensionSystem } from '../../src/implementations/extension-system';
import { createInMemoryEventBus } from '../../src/implementations/event-bus';
import { ExtensionSystem } from '../../src/models/extension-system';
import { EventBus } from '../../src/models/event-system';

/**
 * Focused integration test for event bus and extension system
 */
describe('Event Bus Integration', () => {
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
  
  it('should publish and subscribe to events', async () => {
    // Setup a test subscription
    const receivedEvents: any[] = [];
    const subscription = eventBus.subscribe('test.event', async (event) => {
      // Important: The event handler receives the payload directly, not the entire event
      receivedEvents.push(event);
    });
    
    // Create and publish a test event
    const testMessage = { message: 'Hello World' };
    const event = createDomainEvent('test.event', testMessage);
    await eventBus.publish(event);
    
    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify event was received - we get payload directly, not the event itself
    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0]).toEqual(testMessage);
    
    // Cleanup
    subscription.unsubscribe();
  });
  
  it('should integrate with extension system', async () => {
    // Set up a flag to track if the extension was called
    let extensionPointCalled = false;
    
    // Register an extension point
    extensionSystem.registerExtensionPoint('test.extensionPoint');
    
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
    eventBus.subscribe('test.triggerExtension', async (eventPayload: any) => {
      // In actual implementation, the handler gets the payload directly
      await extensionSystem.executeExtensionPoint('test.extensionPoint', eventPayload);
    });
    
    // Publish an event that will trigger the extension
    const event = createDomainEvent('test.triggerExtension', { data: 'test data' });
    await eventBus.publish(event);
    
    // Wait for event processing and extension execution
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify the extension was called
    expect(extensionPointCalled).toBe(true);
  });
}); 