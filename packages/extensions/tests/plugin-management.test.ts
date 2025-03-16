import { describe, it, expect, vi, beforeEach } from "vitest";
import { Event } from "@architectlm/core";
import {
  ExtensionSystem,
  createExtensionSystem,
  ExtensionPoint,
  Plugin,
  EventInterceptor,
} from "../src/index.js";

describe("Plugin Management", () => {
  let extensionSystem: ExtensionSystem;

  beforeEach(() => {
    extensionSystem = createExtensionSystem();
  });

  describe("GIVEN an extension system", () => {
    describe("WHEN registering a plugin", () => {
      it("THEN the plugin should be registered with its hooks", () => {
        // Define an extension point
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(extensionPoint);

        // Create a mock hook handler
        const mockHookHandler = vi.fn();

        // Define a plugin
        const plugin: Plugin = {
          name: "test.plugin",
          description: "Test plugin",
          hooks: {
            "test.point": mockHookHandler,
          },
        };

        // Register the plugin
        extensionSystem.registerPlugin(plugin);

        // Trigger the extension point
        extensionSystem.triggerExtensionPoint("test.point", { data: "test" });

        // Verify the hook handler was called
        expect(mockHookHandler).toHaveBeenCalledWith({ data: "test" });
      });

      it("THEN the plugin should be registered with its event interceptors", () => {
        // Create a mock event interceptor
        const mockInterceptor: EventInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            return {
              ...event,
              metadata: { ...event.metadata, intercepted: true },
            };
          });

        // Define a plugin with an event interceptor
        const plugin: Plugin = {
          name: "test.plugin",
          description: "Test plugin",
          hooks: {},
          eventInterceptors: [mockInterceptor],
        };

        // Register the plugin
        extensionSystem.registerPlugin(plugin);

        // Create a test event
        const testEvent: Event = {
          type: "test-event",
          payload: { data: "test" },
          timestamp: Date.now(),
        };

        // Process the event through interceptors
        extensionSystem.processEventThroughInterceptors(testEvent);

        // Verify the interceptor was called
        expect(mockInterceptor).toHaveBeenCalledWith(testEvent);
      });
    });

    describe("WHEN registering multiple plugins", () => {
      it("THEN all plugins should be registered and their hooks should be called", async () => {
        // Define an extension point
        const testPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(testPoint);

        // Create mock hook handlers
        const mockHookHandler1 = vi.fn();
        const mockHookHandler2 = vi.fn();

        // Define plugins
        const plugin1: Plugin = {
          name: "test.plugin1",
          description: "Test plugin 1",
          hooks: {
            "test.point": mockHookHandler1,
          },
        };

        const plugin2: Plugin = {
          name: "test.plugin2",
          description: "Test plugin 2",
          hooks: {
            "test.point": mockHookHandler2,
          },
        };

        // Register the plugins
        extensionSystem.registerPlugin(plugin1);
        extensionSystem.registerPlugin(plugin2);

        // Trigger the extension point
        const context = { data: "test" };
        await extensionSystem.triggerExtensionPoint("test.point", context);

        // Verify both hook handlers were called with the context
        expect(mockHookHandler1).toHaveBeenCalledWith(context);
        expect(mockHookHandler2).toHaveBeenCalledWith(context);
      });

      it("THEN all plugins' event interceptors should be called in order", () => {
        // Create mock event interceptors
        const mockInterceptor1: EventInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            return {
              ...event,
              metadata: { ...event.metadata, interceptor1: true },
            };
          });

        const mockInterceptor2: EventInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            return {
              ...event,
              metadata: { ...event.metadata, interceptor2: true },
            };
          });

        // Define plugins with event interceptors
        const plugin1: Plugin = {
          name: "test.plugin1",
          description: "Test plugin 1",
          hooks: {},
          eventInterceptors: [mockInterceptor1],
        };

        const plugin2: Plugin = {
          name: "test.plugin2",
          description: "Test plugin 2",
          hooks: {},
          eventInterceptors: [mockInterceptor2],
        };

        // Register the plugins
        extensionSystem.registerPlugin(plugin1);
        extensionSystem.registerPlugin(plugin2);

        // Create a test event
        const testEvent: Event = {
          type: "test-event",
          payload: { data: "test" },
          timestamp: Date.now(),
        };

        // Process the event through interceptors
        extensionSystem.processEventThroughInterceptors(testEvent);

        // Verify the interceptors were called in order
        expect(mockInterceptor1).toHaveBeenCalledWith(testEvent);
        expect(mockInterceptor2).toHaveBeenCalled();

        // The second interceptor should receive the event after it's been processed by the first
        const firstCallArg = mockInterceptor2.mock.calls[0][0];
        expect(firstCallArg.metadata).toHaveProperty("interceptor1", true);
      });
    });
  });
});
