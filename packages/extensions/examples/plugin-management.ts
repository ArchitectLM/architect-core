/**
 * @file Example of plugin management with the extension system
 * @module @architectlm/extensions/examples
 */

import { DefaultExtensionSystem, createExtensionSystem, Plugin, Extension, ExtensionEvent } from '../src/extension-system.js';
import { PluginManager, createPluginManager, PluginMetadata } from '../src/plugin-management.js';

/**
 * Create a logging plugin
 */
function createLoggingPlugin(): Plugin {
  return {
    name: 'logging-plugin',
    description: 'A plugin that logs events',
    hooks: {
      'log.info': (context: { message: string; data?: any }) => {
        console.log(`[INFO] ${context.message}`, context.data || '');
        return context;
      },
      'log.error': (context: { message: string; error?: Error; data?: any }) => {
        console.error(`[ERROR] ${context.message}`, context.error || '', context.data || '');
        return context;
      }
    },
    eventInterceptors: [
      {
        before: (event: ExtensionEvent) => {
          console.log(`[EVENT] Before ${event.type}`);
          return event;
        },
        after: (event: ExtensionEvent) => {
          console.log(`[EVENT] After ${event.type}`);
          return event;
        },
        error: (event: ExtensionEvent & { error: Error }) => {
          console.error(`[EVENT] Error in ${event.type}:`, event.error);
        }
      }
    ]
  };
}

/**
 * Create a metrics plugin that depends on the logging plugin
 */
function createMetricsPlugin(): Plugin {
  return {
    name: 'metrics-plugin',
    description: 'A plugin that collects metrics',
    hooks: {
      'metrics.record': (context: { name: string; value: number; tags?: Record<string, string> }) => {
        console.log(`Recording metric ${context.name} = ${context.value}`, context.tags || {});
        return context;
      }
    },
    setup: (extensionSystem: DefaultExtensionSystem) => {
      // Register a timer that periodically records metrics
      const timer = setInterval(() => {
        extensionSystem.triggerExtensionPoint('metrics.record', {
          name: 'system.uptime',
          value: process.uptime(),
          tags: { unit: 'seconds' }
        });
        
        // Also log the metric
        extensionSystem.triggerExtensionPoint('log.info', {
          message: 'Recorded uptime metric',
          data: { uptime: process.uptime() }
        });
      }, 5000);
      
      // Store the timer for cleanup
      (extensionSystem as any).metricsTimer = timer;
    }
  };
}

/**
 * Create a notification plugin
 */
function createNotificationPlugin(): Plugin {
  return {
    name: 'notification-plugin',
    description: 'A plugin that sends notifications',
    hooks: {
      'notification.send': (context: { message: string; type: 'info' | 'warning' | 'error' }) => {
        console.log(`[NOTIFICATION] ${context.type.toUpperCase()}: ${context.message}`);
        return context;
      }
    }
  };
}

/**
 * Example of plugin management
 */
async function example() {
  // Create the extension system
  const extensionSystem = createExtensionSystem() as DefaultExtensionSystem;
  
  // Create the plugin manager
  const pluginManager = createPluginManager(extensionSystem);
  
  // Register extension points
  extensionSystem.registerExtensionPoint({
    name: 'log.info',
    description: 'Log an informational message',
    handlers: []
  });
  
  extensionSystem.registerExtensionPoint({
    name: 'log.error',
    description: 'Log an error message',
    handlers: []
  });
  
  extensionSystem.registerExtensionPoint({
    name: 'metrics.record',
    description: 'Record a metric',
    handlers: []
  });
  
  extensionSystem.registerExtensionPoint({
    name: 'notification.send',
    description: 'Send a notification',
    handlers: []
  });
  
  // Register plugins
  console.log('Registering logging plugin...');
  pluginManager.registerPlugin(createLoggingPlugin(), {
    version: '1.0.0',
    author: 'Example Author'
  });
  
  console.log('Registering notification plugin...');
  pluginManager.registerPlugin(createNotificationPlugin(), {
    version: '1.0.0',
    author: 'Example Author'
  });
  
  // Register metrics plugin with dependency on logging plugin
  console.log('Registering metrics plugin...');
  pluginManager.registerPlugin(createMetricsPlugin(), {
    version: '1.0.0',
    author: 'Example Author',
    dependencies: {
      'logging-plugin': '1.0.0'
    }
  });
  
  // List all registered plugins
  console.log('\nRegistered plugins:');
  for (const [name, plugin] of pluginManager.getPlugins()) {
    console.log(`- ${name} (v${plugin.version}) by ${plugin.author || 'Unknown'}: ${plugin.description}`);
    
    const dependencies = pluginManager.getPluginDependencies(name);
    if (dependencies.length > 0) {
      console.log(`  Dependencies: ${dependencies.join(', ')}`);
    }
  }
  
  // Use the plugins
  console.log('\nUsing plugins:');
  
  // Log a message
  await extensionSystem.triggerExtensionPoint('log.info', {
    message: 'This is a test message'
  });
  
  // Record a metric
  await extensionSystem.triggerExtensionPoint('metrics.record', {
    name: 'test.metric',
    value: 42,
    tags: { environment: 'development' }
  });
  
  // Send a notification
  await extensionSystem.triggerExtensionPoint('notification.send', {
    message: 'This is a test notification',
    type: 'info'
  });
  
  // Disable a plugin
  console.log('\nDisabling notification plugin...');
  pluginManager.disablePlugin('notification-plugin');
  
  // Try to use the disabled plugin
  console.log('Trying to use disabled notification plugin:');
  await extensionSystem.triggerExtensionPoint('notification.send', {
    message: 'This notification should not be sent',
    type: 'warning'
  });
  
  // Enable the plugin again
  console.log('\nEnabling notification plugin...');
  pluginManager.enablePlugin('notification-plugin');
  
  // Use the re-enabled plugin
  console.log('Using re-enabled notification plugin:');
  await extensionSystem.triggerExtensionPoint('notification.send', {
    message: 'This notification should be sent',
    type: 'info'
  });
  
  // Try to disable a plugin with dependencies
  console.log('\nTrying to disable logging plugin (which has dependencies):');
  try {
    pluginManager.disablePlugin('logging-plugin');
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
  }
  
  // Create a plugin from an extension
  console.log('\nCreating a plugin from an extension:');
  const simpleExtension: Extension = {
    name: 'simple-extension',
    description: 'A simple extension',
    hooks: {
      'log.info': (context: { message: string }) => {
        console.log(`[SIMPLE] ${context.message}`);
        return context;
      }
    }
  };
  
  const simplePlugin = pluginManager.createPluginFromExtension(simpleExtension, {
    version: '1.0.0',
    author: 'Example Author'
  });
  
  console.log(`Created plugin: ${simplePlugin.name} (v${simplePlugin.version})`);
  
  // Use the simple plugin
  await extensionSystem.triggerExtensionPoint('log.info', {
    message: 'This message should be logged by both plugins'
  });
  
  // Clean up
  console.log('\nCleaning up...');
  clearInterval((extensionSystem as any).metricsTimer);
  
  console.log('Example completed.');
}

// Export the example and utility functions
export {
  createLoggingPlugin,
  createMetricsPlugin,
  createNotificationPlugin,
  example
}; 