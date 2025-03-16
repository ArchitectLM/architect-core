/**
 * Basic example of using the extension system
 */
import {
  createExtensionSystem,
  ExtensionPoint,
  Extension,
  Plugin,
} from "../src/index.js";

// Create a new extension system
const extensionSystem = createExtensionSystem();

// Define extension points
const beforeStartPoint: ExtensionPoint = {
  name: "app.beforeStart",
  description: "Called before the application starts",
};

const afterStartPoint: ExtensionPoint = {
  name: "app.afterStart",
  description: "Called after the application starts",
};

// Register extension points
extensionSystem.registerExtensionPoint(beforeStartPoint);
extensionSystem.registerExtensionPoint(afterStartPoint);

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
