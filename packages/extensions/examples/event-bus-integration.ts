/**
 * Example of integrating the extension system with the event bus
 */
import { ReactiveEventBus, Event } from "@architectlm/core";
import {
  createExtensionSystem,
  ExtensionSystem,
  Plugin,
} from "../src/index.js";

/**
 * Extended event bus that integrates with the extension system
 */
class ExtendedEventBus extends ReactiveEventBus {
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

// Create a new extension system
const extensionSystem = createExtensionSystem();

// Create an extended event bus
const eventBus = new ExtendedEventBus(extensionSystem);

// Define a logging plugin
const loggingPlugin: Plugin = {
  name: "logging.plugin",
  description: "Logs all events",
  hooks: {},
  eventInterceptors: [
    (event) => {
      console.log(`[LOG] Event: ${event.type}`, event.payload);
      return event;
    },
  ],
};

// Define a transformation plugin
const transformationPlugin: Plugin = {
  name: "transformation.plugin",
  description: "Transforms certain events",
  hooks: {},
  eventInterceptors: [
    (event) => {
      // Only transform user events
      if (event.type.startsWith("user.")) {
        console.log(`[TRANSFORM] Transforming user event: ${event.type}`);
        return {
          ...event,
          metadata: { ...event.metadata, transformed: true },
        };
      }
      return event;
    },
  ],
};

// Register the plugins
extensionSystem.registerPlugin(loggingPlugin);
extensionSystem.registerPlugin(transformationPlugin);

// Subscribe to events
eventBus.subscribe("user.login", (event) => {
  console.log("User login event received:", event);
});

eventBus.subscribe("system.status", (event) => {
  console.log("System status event received:", event);
});

// Publish events
console.log("Publishing user.login event...");
eventBus.publish("user.login", { userId: "123", timestamp: Date.now() });

console.log("Publishing system.status event...");
eventBus.publish("system.status", { status: "online", uptime: 3600 });
