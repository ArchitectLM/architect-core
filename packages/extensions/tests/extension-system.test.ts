import { describe, it, expect, vi, beforeEach } from "vitest";
import { Event } from "@architectlm/core";
import {
  ExtensionSystem,
  ExtensionPoint,
  Extension,
  createExtensionSystem,
  DefaultExtensionSystem,
  EventInterceptor,
} from "../src/index.js";

describe("Extension System", () => {
  let extensionSystem: ExtensionSystem;

  beforeEach(() => {
    extensionSystem = createExtensionSystem();
  });

  describe("GIVEN an extension system", () => {
    describe("WHEN registering an extension point", () => {
      it("THEN it should be available for extensions to hook into", () => {
        // Define an extension point
        const beforeProcessPayment: ExtensionPoint<{
          amount: number;
          currency: string;
        }> = {
          name: "beforeProcessPayment",
          description: "Called before processing a payment",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(beforeProcessPayment);

        // Verify the extension point is registered
        expect(extensionSystem.hasExtensionPoint("beforeProcessPayment")).toBe(
          true,
        );
      });
    });

    describe("WHEN registering an extension", () => {
      it("THEN it should be called when the extension point is triggered", async () => {
        // Define an extension point
        const beforeProcessPayment: ExtensionPoint<{
          amount: number;
          currency: string;
        }> = {
          name: "beforeProcessPayment",
          description: "Called before processing a payment",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(beforeProcessPayment);

        // Create a mock implementation for the extension
        const mockHandler = vi.fn().mockImplementation((data) => {
          return { ...data, validated: true };
        });

        // Define an extension
        const paymentValidator: Extension = {
          name: "paymentValidator",
          description: "Validates payment data before processing",
          hooks: {
            beforeProcessPayment: mockHandler,
          },
        };

        // Register the extension
        extensionSystem.registerExtension(paymentValidator);

        // Trigger the extension point
        const paymentData = { amount: 100, currency: "USD" };
        const result = await extensionSystem.triggerExtensionPoint(
          "beforeProcessPayment",
          paymentData,
        );

        // Verify the extension was called
        expect(mockHandler).toHaveBeenCalledWith(paymentData);
        expect(result).toEqual({
          amount: 100,
          currency: "USD",
          validated: true,
        });
      });
    });

    describe("WHEN multiple extensions are registered for the same extension point", () => {
      it("THEN they should be called in registration order", async () => {
        // Define an extension point
        const beforeProcessPayment: ExtensionPoint<{
          amount: number;
          currency: string;
        }> = {
          name: "beforeProcessPayment",
          description: "Called before processing a payment",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(beforeProcessPayment);

        // Create mock implementations for the extensions
        const mockValidator = vi.fn().mockImplementation((data) => {
          return { ...data, validated: true };
        });

        const mockEnricher = vi.fn().mockImplementation((data) => {
          return { ...data, enriched: true };
        });

        // Define extensions
        const paymentValidator: Extension = {
          name: "paymentValidator",
          description: "Validates payment data before processing",
          hooks: {
            beforeProcessPayment: mockValidator,
          },
        };

        const paymentEnricher: Extension = {
          name: "paymentEnricher",
          description: "Enriches payment data before processing",
          hooks: {
            beforeProcessPayment: mockEnricher,
          },
        };

        // Register the extensions
        extensionSystem.registerExtension(paymentValidator);
        extensionSystem.registerExtension(paymentEnricher);

        // Trigger the extension point
        const paymentData = { amount: 100, currency: "USD" };
        const result = await extensionSystem.triggerExtensionPoint(
          "beforeProcessPayment",
          paymentData,
        );

        // Verify the extensions were called in order
        expect(mockValidator).toHaveBeenCalledWith(paymentData);
        expect(mockEnricher).toHaveBeenCalledWith({
          ...paymentData,
          validated: true,
        });
        expect(result).toEqual({
          amount: 100,
          currency: "USD",
          validated: true,
          enriched: true,
        });
      });
    });

    describe("WHEN an extension throws an error", () => {
      it("THEN the error should be propagated", async () => {
        // Define an extension point
        const beforeProcessPayment: ExtensionPoint<{
          amount: number;
          currency: string;
        }> = {
          name: "beforeProcessPayment",
          description: "Called before processing a payment",
        };

        // Register the extension point
        extensionSystem.registerExtensionPoint(beforeProcessPayment);

        // Create a mock implementation that throws an error
        const mockHandler = vi.fn().mockImplementation(() => {
          throw new Error("Validation failed");
        });

        // Define an extension
        const paymentValidator: Extension = {
          name: "paymentValidator",
          description: "Validates payment data before processing",
          hooks: {
            beforeProcessPayment: mockHandler,
          },
        };

        // Register the extension
        extensionSystem.registerExtension(paymentValidator);

        // Trigger the extension point and expect it to throw
        const paymentData = { amount: 100, currency: "USD" };
        await expect(
          extensionSystem.triggerExtensionPoint(
            "beforeProcessPayment",
            paymentData,
          ),
        ).rejects.toThrow("Validation failed");
      });
    });
  });

  describe("GIVEN an extension system with event interceptors", () => {
    describe("WHEN registering an event interceptor", () => {
      it("THEN it should be called when an event is published", () => {
        // Define an event interceptor
        const logEventInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            console.log(`Event intercepted: ${event.type}`);
            return event;
          });

        // Register the event interceptor
        extensionSystem.registerEventInterceptor(logEventInterceptor);

        // Create an event
        const event: Event = {
          type: "payment.processed",
          payload: { amount: 100, currency: "USD" },
          timestamp: Date.now(),
        };

        // Process the event through interceptors
        const processedEvent =
          extensionSystem.processEventThroughInterceptors(event);

        // Verify the interceptor was called
        expect(logEventInterceptor).toHaveBeenCalledWith(event);
        expect(processedEvent).toEqual(event);
      });
    });

    describe("WHEN multiple event interceptors are registered", () => {
      it("THEN they should be called in registration order", () => {
        // Define event interceptors
        const logEventInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            return { ...event, logged: true };
          });

        const enrichEventInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            return { ...event, enriched: true };
          });

        // Register the event interceptors
        extensionSystem.registerEventInterceptor(logEventInterceptor);
        extensionSystem.registerEventInterceptor(enrichEventInterceptor);

        // Create an event
        const event: Event = {
          type: "payment.processed",
          payload: { amount: 100, currency: "USD" },
          timestamp: Date.now(),
        };

        // Process the event through interceptors
        const processedEvent =
          extensionSystem.processEventThroughInterceptors(event);

        // Verify the interceptors were called in order
        expect(logEventInterceptor).toHaveBeenCalledWith(event);
        expect(enrichEventInterceptor).toHaveBeenCalledWith({
          ...event,
          logged: true,
        });
        expect(processedEvent).toEqual({
          ...event,
          logged: true,
          enriched: true,
        });
      });
    });

    describe("WHEN an event interceptor modifies an event", () => {
      it("THEN the modified event should be passed to the next interceptor", () => {
        // Define event interceptors
        const addMetadataInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            return {
              ...event,
              metadata: { ...event.metadata, processed: true },
            };
          });

        const logEventInterceptor = vi
          .fn()
          .mockImplementation((event: Event) => {
            return event;
          });

        // Register the event interceptors
        extensionSystem.registerEventInterceptor(addMetadataInterceptor);
        extensionSystem.registerEventInterceptor(logEventInterceptor);

        // Create an event
        const event: Event = {
          type: "payment.processed",
          payload: { amount: 100, currency: "USD" },
          timestamp: Date.now(),
          metadata: { source: "payment-service" },
        };

        // Process the event through interceptors
        extensionSystem.processEventThroughInterceptors(event);

        // Verify the second interceptor received the modified event
        expect(logEventInterceptor).toHaveBeenCalledWith({
          ...event,
          metadata: { ...event.metadata, processed: true },
        });
      });
    });
  });

  describe("GIVEN a registered plugin", () => {
    describe("WHEN matching event is processed", () => {
      it("THEN plugin intercepts the event", () => {
        // Define a plugin with an event interceptor
        const paymentPlugin = {
          name: "paymentPlugin",
          description: "Handles payment events",
          eventInterceptors: [
            vi.fn().mockImplementation((event: Event) => {
              if (event.type.startsWith("payment.")) {
                return {
                  ...event,
                  metadata: { ...event.metadata, plugin: "paymentPlugin" },
                };
              }
              return event;
            }),
          ],
          hooks: {},
        };

        // Register the plugin
        extensionSystem.registerPlugin(paymentPlugin);

        // Create a payment event
        const paymentEvent: Event = {
          type: "payment.processed",
          payload: { amount: 100, currency: "USD" },
          timestamp: Date.now(),
          metadata: {},
        };

        // Process the event through interceptors
        const processedEvent =
          extensionSystem.processEventThroughInterceptors(paymentEvent);

        // Verify the plugin intercepted the event
        expect(processedEvent.metadata).toEqual({ plugin: "paymentPlugin" });

        // Create a non-payment event
        const otherEvent: Event = {
          type: "user.created",
          payload: { id: "123", name: "John" },
          timestamp: Date.now(),
          metadata: {},
        };

        // Process the event through interceptors
        const processedOtherEvent =
          extensionSystem.processEventThroughInterceptors(otherEvent);

        // Verify the plugin didn't modify the non-payment event
        expect(processedOtherEvent.metadata).toEqual({});
      });
    });
  });
});

describe("DefaultExtensionSystem", () => {
  let extensionSystem: DefaultExtensionSystem;

  beforeEach(() => {
    extensionSystem = new DefaultExtensionSystem();
  });

  describe("GIVEN a new extension system", () => {
    describe("WHEN checking for a non-existent extension point", () => {
      it("THEN should return false", () => {
        expect(extensionSystem.hasExtensionPoint("non.existent")).toBe(false);
      });
    });

    describe("WHEN registering an extension point", () => {
      it("THEN should add the extension point", () => {
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };

        extensionSystem.registerExtensionPoint(extensionPoint);

        expect(extensionSystem.hasExtensionPoint("test.point")).toBe(true);
      });

      it("THEN should throw when registering a duplicate extension point", () => {
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };

        extensionSystem.registerExtensionPoint(extensionPoint);

        expect(() => {
          extensionSystem.registerExtensionPoint(extensionPoint);
        }).toThrow(/Extension point.*already exists/);
      });
    });

    describe("WHEN registering an extension", () => {
      it("THEN should throw when registering for a non-existent extension point", () => {
        const extension: Extension = {
          name: "test.extension",
          description: "Test extension",
          hooks: {
            "non.existent.point": () => {},
          },
        };

        expect(() => {
          extensionSystem.registerExtension(extension);
        }).toThrow(/Extension point.*does not exist/);
      });

      it("THEN should register the extension for an existing extension point", () => {
        // Register an extension point
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };
        extensionSystem.registerExtensionPoint(extensionPoint);

        // Create a mock hook handler
        const mockHookHandler = vi.fn();

        // Register an extension
        const extension: Extension = {
          name: "test.extension",
          description: "Test extension",
          hooks: {
            "test.point": mockHookHandler,
          },
        };
        extensionSystem.registerExtension(extension);

        // Trigger the extension point
        extensionSystem.triggerExtensionPoint("test.point", { data: "test" });

        // Verify the hook handler was called
        expect(mockHookHandler).toHaveBeenCalledWith({ data: "test" });
      });

      it("THEN should throw when registering a duplicate extension", () => {
        // Register an extension point
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };
        extensionSystem.registerExtensionPoint(extensionPoint);

        // Register an extension
        const extension: Extension = {
          name: "test.extension",
          description: "Test extension",
          hooks: {
            "test.point": () => {},
          },
        };
        extensionSystem.registerExtension(extension);

        // Try to register the same extension again
        expect(() => {
          extensionSystem.registerExtension(extension);
        }).toThrow(/Extension.*already exists/);
      });
    });

    describe("WHEN registering an event interceptor", () => {
      it("THEN should process events through the interceptor", () => {
        // Create a mock interceptor
        const mockInterceptor: EventInterceptor = vi
          .fn()
          .mockImplementation((event) => {
            return {
              ...event,
              metadata: { ...event.metadata, intercepted: true },
            };
          });

        // Register the interceptor
        extensionSystem.registerEventInterceptor(mockInterceptor);

        // Create a test event
        const testEvent = {
          type: "test-event",
          payload: { data: "test" },
          timestamp: Date.now(),
        };

        // Process the event
        const processedEvent =
          extensionSystem.processEventThroughInterceptors(testEvent);

        // Verify the interceptor was called
        expect(mockInterceptor).toHaveBeenCalledWith(testEvent);

        // Verify the event was processed
        expect(processedEvent.metadata).toHaveProperty("intercepted", true);
      });

      it("THEN should process events through multiple interceptors in order", () => {
        // Create mock interceptors
        const mockInterceptor1: EventInterceptor = vi
          .fn()
          .mockImplementation((event) => {
            return {
              ...event,
              metadata: { ...event.metadata, interceptor1: true },
            };
          });

        const mockInterceptor2: EventInterceptor = vi
          .fn()
          .mockImplementation((event) => {
            return {
              ...event,
              metadata: { ...event.metadata, interceptor2: true },
            };
          });

        // Register the interceptors
        extensionSystem.registerEventInterceptor(mockInterceptor1);
        extensionSystem.registerEventInterceptor(mockInterceptor2);

        // Create a test event
        const testEvent = {
          type: "test-event",
          payload: { data: "test" },
          timestamp: Date.now(),
        };

        // Process the event
        const processedEvent =
          extensionSystem.processEventThroughInterceptors(testEvent);

        // Verify the interceptors were called in order
        expect(mockInterceptor1).toHaveBeenCalledWith(testEvent);
        expect(mockInterceptor2).toHaveBeenCalled();

        // Verify the event was processed by both interceptors
        expect(processedEvent.metadata).toHaveProperty("interceptor1", true);
        expect(processedEvent.metadata).toHaveProperty("interceptor2", true);
      });
    });

    describe("WHEN registering a plugin", () => {
      it("THEN should register both hooks and event interceptors", () => {
        // Register an extension point
        const extensionPoint: ExtensionPoint = {
          name: "test.point",
          description: "Test extension point",
        };
        extensionSystem.registerExtensionPoint(extensionPoint);

        // Create a mock hook handler
        const mockHookHandler = vi.fn();

        // Create a mock event interceptor
        const mockInterceptor: EventInterceptor = vi
          .fn()
          .mockImplementation((event) => {
            return {
              ...event,
              metadata: { ...event.metadata, intercepted: true },
            };
          });

        // Define a plugin
        const plugin = {
          name: "test.plugin",
          description: "Test plugin",
          hooks: {
            "test.point": mockHookHandler,
          },
          eventInterceptors: [mockInterceptor],
        };

        // Register the plugin
        extensionSystem.registerPlugin(plugin);

        // Trigger the extension point
        extensionSystem.triggerExtensionPoint("test.point", { data: "test" });

        // Create a test event
        const testEvent = {
          type: "test-event",
          payload: { data: "test" },
          timestamp: Date.now(),
        };

        // Process the event
        const processedEvent =
          extensionSystem.processEventThroughInterceptors(testEvent);

        // Verify the hook handler was called
        expect(mockHookHandler).toHaveBeenCalledWith({ data: "test" });

        // Verify the interceptor was called
        expect(mockInterceptor).toHaveBeenCalledWith(testEvent);

        // Verify the event was processed
        expect(processedEvent.metadata).toHaveProperty("intercepted", true);
      });
    });
  });
});
