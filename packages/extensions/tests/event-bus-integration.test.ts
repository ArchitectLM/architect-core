import { describe, it, expect, vi, beforeEach } from "vitest";
import { Event } from "../src/models.js";
import { EventBusImpl } from "../../core2/src/implementations/event-bus.js";
import { ExtensionSystem, EventInterceptor } from "../src/models.js";
import { createExtensionSystem } from "../src/extension-system.js";

/**
 * Extended event bus that integrates with the extension system
 */
class ExtendedEventBus extends EventBusImpl {
  private extensionSystem: ExtensionSystem;

  constructor(extensionSystem: ExtensionSystem) {
    super();
    this.extensionSystem = extensionSystem;
  }

  /**
   * Override the publish method to process events through interceptors
   */
  override publish<T>(eventType: string, payload: T): void {
    const event: Event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
    };

    // Process the event through interceptors
    const processedEvent =
      this.extensionSystem.processEventThroughInterceptors(event);

    // Publish the processed event
    super.publish(processedEvent.type, processedEvent.payload);
  }
}

describe("Event Bus Integration", () => {
  let extensionSystem: ExtensionSystem;
  let eventBus: ExtendedEventBus;

  beforeEach(() => {
    extensionSystem = createExtensionSystem();
    eventBus = new ExtendedEventBus(extensionSystem);
  });

  describe("GIVEN an extended event bus with extension system", () => {
    describe("WHEN publishing an event", () => {
      it("THEN the event should be processed through interceptors", () => {
        // Create a mock event interceptor
        const mockInterceptor: EventInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            return {
              ...event,
              metadata: { ...event.metadata, intercepted: true },
            };
          });

        // Register the interceptor
        extensionSystem.registerEventInterceptor(mockInterceptor);

        // Create a mock subscriber
        const mockSubscriber = vi.fn();

        // Subscribe to the event
        eventBus.subscribe("test-event", mockSubscriber);

        // Publish an event
        eventBus.publish("test-event", { data: "test" });

        // Verify the interceptor was called
        expect(mockInterceptor).toHaveBeenCalled();

        // Verify the subscriber was called with the processed event
        expect(mockSubscriber).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "test-event",
            payload: { data: "test" },
          }),
        );
      });
    });

    describe("WHEN a plugin is registered", () => {
      it("THEN its event interceptors should be applied to events", () => {
        // Create a mock plugin
        const mockPlugin = {
          name: "testPlugin",
          description: "Test plugin",
          hooks: {},
          eventInterceptors: [
            vi.fn().mockImplementation((event: Event) => {
              return {
                ...event,
                metadata: { ...event.metadata, plugin: "testPlugin" },
              };
            }),
          ],
        };

        // Register the plugin
        extensionSystem.registerPlugin(mockPlugin);

        // Create a mock subscriber
        const mockSubscriber = vi.fn();

        // Subscribe to the event
        eventBus.subscribe("test-event", mockSubscriber);

        // Publish an event
        eventBus.publish("test-event", { data: "test" });

        // Verify the plugin's interceptor was called
        expect(mockPlugin.eventInterceptors[0]).toHaveBeenCalled();

        // Verify the subscriber was called with the processed event
        expect(mockSubscriber).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "test-event",
            payload: { data: "test" },
          }),
        );
      });
    });
  });
});
