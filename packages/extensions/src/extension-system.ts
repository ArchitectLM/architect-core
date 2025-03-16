/**
 * @file Implementation of the extension system
 * @module @architectlm/extensions
 */

import { Event } from "@architectlm/core";
import {
  ExtensionSystem,
  ExtensionPoint,
  Extension,
  EventInterceptor,
  Plugin,
} from "./models.js";

/**
 * Default implementation of the extension system
 */
export class DefaultExtensionSystem implements ExtensionSystem {
  private extensionPoints: Map<string, ExtensionPoint> = new Map();
  private extensions: Map<string, Extension> = new Map();
  private extensionHooks: Map<string, Set<Extension>> = new Map();
  private eventInterceptors: EventInterceptor[] = [];

  /**
   * Register an extension point
   */
  registerExtensionPoint(extensionPoint: ExtensionPoint): void {
    if (this.extensionPoints.has(extensionPoint.name)) {
      throw new Error(
        `Extension point '${extensionPoint.name}' already exists`,
      );
    }

    this.extensionPoints.set(extensionPoint.name, extensionPoint);
    this.extensionHooks.set(extensionPoint.name, new Set());
  }

  /**
   * Check if an extension point exists
   */
  hasExtensionPoint(name: string): boolean {
    return this.extensionPoints.has(name);
  }

  /**
   * Register an extension
   */
  registerExtension(extension: Extension): void {
    if (this.extensions.has(extension.name)) {
      throw new Error(`Extension '${extension.name}' already exists`);
    }

    // Validate that all extension points exist
    for (const extensionPointName of Object.keys(extension.hooks)) {
      if (!this.extensionPoints.has(extensionPointName)) {
        throw new Error(
          `Extension point '${extensionPointName}' does not exist`,
        );
      }
    }

    this.extensions.set(extension.name, extension);

    // Register hooks for each extension point
    for (const [extensionPointName, hookHandler] of Object.entries(
      extension.hooks,
    )) {
      const hooks = this.extensionHooks.get(extensionPointName);
      if (hooks) {
        hooks.add(extension);
      }
    }
  }

  /**
   * Trigger an extension point with the given context
   */
  async triggerExtensionPoint(
    name: string,
    context: unknown,
  ): Promise<unknown> {
    if (!this.hasExtensionPoint(name)) {
      return context; // Return the original context if extension point doesn't exist
    }

    const hooks = this.extensionHooks.get(name);
    if (!hooks) {
      return context; // Return the original context if no hooks are registered
    }

    let modifiedContext = { ...context };

    for (const extension of hooks) {
      const hookHandler = extension.hooks[name];
      if (hookHandler) {
        // Apply the hook and update the context with the result
        const result = await hookHandler(modifiedContext);
        if (result !== undefined) {
          modifiedContext = result;
        }
      }
    }

    return modifiedContext;
  }

  /**
   * Register an event interceptor
   */
  registerEventInterceptor(interceptor: EventInterceptor): void {
    this.eventInterceptors.push(interceptor);
  }

  /**
   * Process an event through all registered interceptors
   */
  processEventThroughInterceptors(event: Event): Event {
    let processedEvent = { ...event };

    for (const interceptor of this.eventInterceptors) {
      processedEvent = interceptor(processedEvent);
    }

    return processedEvent;
  }

  /**
   * Register a plugin
   */
  registerPlugin(plugin: Plugin): void {
    // Register the plugin as an extension
    this.registerExtension(plugin);

    // Register event interceptors if any
    if (plugin.eventInterceptors) {
      for (const interceptor of plugin.eventInterceptors) {
        this.registerEventInterceptor(interceptor);
      }
    }
  }
}

/**
 * Create a new extension system
 */
export function createExtensionSystem(): ExtensionSystem {
  return new DefaultExtensionSystem();
}
