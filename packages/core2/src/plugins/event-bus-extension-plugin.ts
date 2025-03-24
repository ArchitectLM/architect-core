import { BasePlugin } from '../models/plugin-system';
import { Runtime } from '../models/runtime';
import { ExtensionPointNames, Extension, ExtensionHookRegistration, ExtensionPointName } from '../models/extension-system';
import { Result } from '../models/core-types';

/**
 * EventBusExtensionPlugin registers event bus extension points
 * in the extension system and ensures proper integration between
 * the two systems.
 */
export class EventBusExtensionPlugin extends BasePlugin {
  constructor() {
    super({
      id: 'core:event-bus-extensions',
      name: 'Event Bus Extensions',
      description: 'Registers event bus extension points',
      dependencies: []
    });
  }

  /**
   * Initialize the plugin
   * @param runtime Runtime instance
   */
  async initialize(runtime: Runtime): Promise<Result<void>> {
    try {
      // Register event bus extensions
      const extension = new EventBusExtensionPoint();
      
      // Make sure extensionSystem exists before using it
      if (!runtime.extensionSystem) {
        return {
          success: false,
          error: new Error('Extension system is not available')
        };
      }
      
      const result = runtime.extensionSystem.registerExtension(extension);
      
      if (!result.success) {
        return result;
      }
      
      // Execute system:init extension point to ensure it's registered
      await runtime.extensionSystem?.executeExtensionPoint(
        ExtensionPointNames.SYSTEM_INIT,
        {
          version: runtime.version,
          config: {}
        }
      );
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to initialize event bus extension plugin: ${String(error)}`)
      };
    }
  }
}

/**
 * Extension that defines all event bus extension points
 */
class EventBusExtensionPoint implements Extension {
  id = 'core:event-bus-extension-points';
  name = 'Event Bus Extension Points';
  description = 'Defines extension points for event bus interactions';
  dependencies: string[] = [];
  
  /**
   * Get the hooks for this extension
   */
  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    // This extension provides the extension points themselves
    // but doesn't implement any hooks
    return [];
  }
  
  /**
   * Get the extension version
   */
  getVersion(): string {
    return '1.0.0';
  }
  
  /**
   * Get the extension capabilities
   */
  getCapabilities(): string[] {
    return [
      'event:beforePublish',
      'event:afterPublish',
      'event:beforeReplay',
      'event:afterReplay'
    ];
  }
}

/**
 * Create a new EventBusExtensionPlugin
 */
export function createEventBusExtensionPlugin(): EventBusExtensionPlugin {
  return new EventBusExtensionPlugin();
} 