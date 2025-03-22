/**
 * @file Example of integrating the extension system with the event bus
 * @module @architectlm/extensions/examples
 */

import { EventBusImpl } from "../../core2/src/implementations/event-bus.js";
import { Event } from "../src/models.js";
import {
  createExtensionSystem,
  DefaultExtensionSystem,
  Plugin,
  EventBusIntegrationExtension,
  createExtendedEventBus,
  EventBus
} from "../src/index.js";

/**
 * Create a logging plugin
 */
function createLoggingPlugin(): Plugin {
  return {
    name: 'logging-plugin',
    description: 'Logs all events',
    hooks: {
      'event.beforePublish': (context: { event: Event }) => {
        console.log(`[BEFORE] Event: ${context.event.type}`, context.event.payload);
        return context;
      },
      'event.afterPublish': (context: { event: Event; result: any }) => {
        console.log(`[AFTER] Event: ${context.event.type}`, context.event.payload);
        return context;
      }
    },
    eventInterceptors: [
      {
        before: (event) => {
          console.log(`[INTERCEPTOR] Processing event: ${event.type}`);
          return event;
        }
      }
    ]
  };
}

/**
 * Create a transformation plugin
 */
function createTransformationPlugin(): Plugin {
  return {
    name: 'transformation-plugin',
    description: 'Transforms certain events',
    hooks: {
      'event.beforePublish': (context: { event: Event }) => {
        // Only transform user events
        if (context.event.type.startsWith('user.')) {
          console.log(`[TRANSFORM] Transforming user event: ${context.event.type}`);
          
          // Add metadata to the event
          context.event.metadata = {
            ...context.event.metadata,
            transformed: true,
            transformedAt: new Date().toISOString()
          };
          
          // For login events, add user info
          if (context.event.type === 'user.login') {
            const payload = context.event.payload as any;
            context.event.payload = {
              ...payload,
              userInfo: {
                displayName: `User ${payload.userId}`,
                lastLogin: new Date().toISOString()
              }
            };
          }
        }
        return context;
      }
    }
  };
}

/**
 * Create a security plugin
 */
function createSecurityPlugin(): Plugin {
  return {
    name: 'security-plugin',
    description: 'Adds security checks to events',
    hooks: {
      'event.beforePublish': (context: { event: Event }) => {
        // Add security metadata to all events
        context.event.metadata = {
          ...context.event.metadata,
          security: {
            checked: true,
            timestamp: Date.now()
          }
        };
        return context;
      }
    }
  };
}

/**
 * Example of event bus integration
 */
function example() {
  // Create the extension system
  const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
  
  // Register extension points
  extensionSystem.registerExtensionPoint({
    name: 'event.beforePublish',
    description: 'Called before an event is published',
    handlers: []
  });
  
  extensionSystem.registerExtensionPoint({
    name: 'event.afterPublish',
    description: 'Called after an event is published',
    handlers: []
  });
  
  // Create a standard event bus
  const standardEventBus = new EventBusImpl();
  
  // Create an extended event bus with our integration
  const extendedEventBus = createExtendedEventBus(
    standardEventBus,
    extensionSystem,
    {
      processInterceptors: true,
      addMetadata: true,
      globalMetadata: {
        source: 'example-app',
        version: '1.0.0'
      },
      eventTypeToExtensionPoint: {
        'user.login': 'user.authenticate',
        'system.status': 'system.monitor'
      }
    }
  );
  
  // Register plugins
  console.log('Registering plugins...');
  extensionSystem.registerExtension(createLoggingPlugin());
  extensionSystem.registerExtension(createTransformationPlugin());
  extensionSystem.registerExtension(createSecurityPlugin());
  
  // Subscribe to events
  extendedEventBus.subscribe('user.login', (event) => {
    console.log('User login event received:', event);
  });
  
  extendedEventBus.subscribe('system.status', (event) => {
    console.log('System status event received:', event);
  });
  
  // Publish events
  console.log('\nPublishing user.login event...');
  extendedEventBus.publish('user.login', { userId: '123', timestamp: Date.now() });
  
  console.log('\nPublishing system.status event...');
  extendedEventBus.publish('system.status', { status: 'online', uptime: 3600 });
  
  // Demonstrate event with error handling
  console.log('\nPublishing event that will cause an error in a plugin...');
  try {
    // This will be caught by our error handling in the extension
    extensionSystem.registerExtension({
      name: 'error-plugin',
      description: 'A plugin that throws errors',
      hooks: {
        'event.beforePublish': () => {
          throw new Error('Simulated error in plugin');
        }
      }
    });
    
    extendedEventBus.publish('error.test', { test: true });
  } catch (error) {
    console.error('Error caught:', error);
  }
}

// Export the example and utility functions
export {
  createLoggingPlugin,
  createTransformationPlugin,
  createSecurityPlugin,
  example
};
