/**
 * Basic example of using the extension system
 */
import {
  createExtensionSystem,
  ExtensionPoint,
  Extension,
  Plugin,
} from "../src/extension-system.js";

// Create a new extension system
const extensionSystem = createExtensionSystem();

// Register extension points
extensionSystem.registerExtensionPoint({
  name: "greeting",
  description: "Provides greeting functionality",
  handlers: []
});

extensionSystem.registerExtensionPoint({
  name: "farewell",
  description: "Provides farewell functionality",
  handlers: []
});

// Define an extension
const loggingExtension: Extension = {
  name: "logging.extension",
  description: "Logs application lifecycle events",
  hooks: {
    "app.beforeStart": (context) => {
      console.log("Application is about to start with context:", context);
    },
    "app.afterStart": (context) => {
      console.log("Application has started with context:", context);
    },
  },
};

// Register the extension
extensionSystem.registerExtension(loggingExtension);

// Define a plugin with both hooks and event interceptors
const analyticsPlugin: Plugin = {
  name: "analytics.plugin",
  description: "Tracks application events",
  hooks: {
    "app.beforeStart": () => {
      console.log("Analytics: Tracking application start");
    },
  },
  eventInterceptors: [
    (event) => {
      console.log("Analytics: Tracking event:", event.type);
      return {
        ...event,
        metadata: { ...event.metadata, tracked: true },
      };
    },
  ],
};

// Register the plugin
extensionSystem.registerPlugin(analyticsPlugin);

// Simulate application startup
console.log("Starting application...");
extensionSystem.triggerExtensionPoint("app.beforeStart", {
  startTime: Date.now(),
});

// Simulate some work
console.log("Application doing work...");

// Simulate application started
console.log("Application started!");
extensionSystem.triggerExtensionPoint("app.afterStart", { uptime: 0 });

// Simulate an event
const event = {
  type: "user.login",
  payload: { userId: "123" },
  timestamp: Date.now(),
};

// Process the event through interceptors
const processedEvent = extensionSystem.processEventThroughInterceptors(event);
console.log("Processed event:", processedEvent);

// Log extension events
extensionSystem.on("extension.event", (event) => {
  console.log(`Extension event: ${event.type}`);
  console.log(`Timestamp: ${new Date(event.timestamp).toISOString()}`);
  console.log(`Context:`, event.context);
});

// Trigger an extension point
const result = await extensionSystem.triggerExtensionPoint("user.login", {
  type: "user.login",
  context: { userId: "user123" },
  timestamp: Date.now()
});
