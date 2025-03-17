import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createExtensionSystem,
  ExtensionPoint,
  Plugin,
  EventInterceptor,
  DefaultExtensionSystem,
  Extension,
  ExtensionEvent
} from "../src/index.js";

describe("Plugin Management", () => {
  let extensionSystem: DefaultExtensionSystem;

  beforeEach(() => {
    extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
  });

  describe("GIVEN an extension system", () => {
    describe("WHEN registering a plugin", () => {
      it("THEN the plugin should be registered with its hooks", () => {
        // Define an extension point
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          handlers: [],
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(extensionPoint);

        // Create a mock hook handler
        const mockHookHandler = vi.fn().mockImplementation(context => context);

        // Define an extension
        const extension: Extension = {
          name: "test.extension",
          description: "Test extension",
          hooks: {
            "test.point": mockHookHandler
          }
        };

        // Register the extension directly
        extensionSystem.registerExtension(extension);

        // Trigger the extension point
        extensionSystem.triggerExtensionPoint("test.point", { data: "test" });

        // Verify the hook handler was called
        expect(mockHookHandler).toHaveBeenCalledWith({ data: "test" });
      });

      it("THEN event interceptors should be registered", () => {
        // Create a mock event interceptor
        const beforeFn = vi.fn().mockImplementation(event => event);
        
        // Fix: Create a proper EventInterceptor object with a before method
        const mockInterceptor: EventInterceptor = {
          before: beforeFn
        };

        // Register the event interceptor directly
        extensionSystem.registerEventInterceptor(mockInterceptor);

        // Create a test event
        const testEvent: ExtensionEvent = {
          type: "test-event",
          context: { data: "test" },
          timestamp: Date.now(),
        };

        // Process the event through interceptors
        extensionSystem.processEventThroughInterceptors(testEvent);

        // Verify the interceptor was called
        expect(beforeFn).toHaveBeenCalledWith(testEvent);
      });
    });

    describe("WHEN registering multiple extensions", () => {
      it("THEN all extensions should be registered and their hooks should be called", async () => {
        // Define an extension point
        const testPoint: ExtensionPoint = {
          name: "test.point",
          handlers: [],
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(testPoint);

        // Create mock hook handlers
        const mockHookHandler1 = vi.fn().mockImplementation(context => context);
        const mockHookHandler2 = vi.fn().mockImplementation(context => context);

        // Define extensions
        const extension1: Extension = {
          name: "test.extension1",
          description: "Test extension 1",
          hooks: {
            "test.point": mockHookHandler1
          }
        };

        const extension2: Extension = {
          name: "test.extension2",
          description: "Test extension 2",
          hooks: {
            "test.point": mockHookHandler2
          }
        };

        // Register the extensions directly
        extensionSystem.registerExtension(extension1);
        extensionSystem.registerExtension(extension2);

        // Trigger the extension point
        const context = { data: "test" };
        await extensionSystem.triggerExtensionPoint("test.point", context);

        // Verify both hook handlers were called with the context
        expect(mockHookHandler1).toHaveBeenCalledWith(context);
        expect(mockHookHandler2).toHaveBeenCalledWith(context);
      });

      it("THEN all event interceptors should be called in order", () => {
        // Create mock event interceptors
        const beforeFn1 = vi.fn().mockImplementation(event => ({
          ...event,
          interceptor1: true
        }));
        
        const beforeFn2 = vi.fn().mockImplementation(event => ({
          ...event,
          interceptor2: true
        }));
        
        // Fix: Create proper EventInterceptor objects with before methods
        const mockInterceptor1: EventInterceptor = {
          before: beforeFn1
        };

        const mockInterceptor2: EventInterceptor = {
          before: beforeFn2
        };

        // Register the event interceptors directly
        extensionSystem.registerEventInterceptor(mockInterceptor1);
        extensionSystem.registerEventInterceptor(mockInterceptor2);

        // Create a test event
        const testEvent: ExtensionEvent = {
          type: "test-event",
          context: { data: "test" },
          timestamp: Date.now(),
        };

        // Process the event through interceptors
        extensionSystem.processEventThroughInterceptors(testEvent);

        // Verify the interceptors were called in order
        expect(beforeFn1).toHaveBeenCalledWith(testEvent);
        expect(beforeFn2).toHaveBeenCalled();

        // The second interceptor should receive the event after it's been processed by the first
        const firstCallArg = beforeFn2.mock.calls[0][0];
        expect(firstCallArg).toHaveProperty("interceptor1", true);
      });
    });
  });
});
