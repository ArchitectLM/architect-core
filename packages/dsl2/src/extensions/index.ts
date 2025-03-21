/**
 * DSL Extension Framework
 * 
 * This module provides the core infrastructure for registering and managing
 * extensions for the DSL.
 */
import { DSL, DSLExtension } from '../core/dsl.js';
import { ComponentType } from '../models/component.js';

/**
 * Registry of available extensions
 */
export const extensionRegistry = new Map<string, ExtensionFactory>();

/**
 * ExtensionFactory type definition
 */
export type ExtensionFactory = (options?: any) => DSLExtension;

/**
 * Defines a new extension for the DSL
 * 
 * @param id Unique identifier for the extension
 * @param factory Factory function that creates the extension instance
 * @returns The extension factory function
 */
export function defineExtension(id: string, factory: ExtensionFactory): ExtensionFactory {
  if (extensionRegistry.has(id)) {
    throw new Error(`Extension already defined: ${id}`);
  }
  
  extensionRegistry.set(id, factory);
  return factory;
}

/**
 * Gets an extension factory by ID
 * 
 * @param id Extension ID
 * @returns The extension factory function or undefined if not found
 */
export function getExtension(id: string): ExtensionFactory | undefined {
  return extensionRegistry.get(id);
}

/**
 * Registers an extension with a DSL instance
 * 
 * @param dsl The DSL instance
 * @param id Extension ID
 * @param options Extension options
 */
export function registerExtension(dsl: DSL, id: string, options?: any): void {
  const factory = extensionRegistry.get(id);
  if (!factory) {
    throw new Error(`Extension not found: ${id}`);
  }
  
  const extension = factory(options);
  dsl.registerExtension(extension, options);
}

/**
 * Utility function to create an extension
 * 
 * @param id Extension ID
 * @param initFn Function to initialize the extension
 * @param cleanupFn Optional function to clean up the extension
 * @returns DSL extension object
 */
export function createExtension(
  id: string,
  initFn: (dsl: DSL, options?: any) => void,
  cleanupFn?: () => void
): DSLExtension {
  return {
    id,
    init: initFn,
    cleanup: cleanupFn
  };
}

/**
 * Utility function to register all extensions from a system definition
 * 
 * @param dsl The DSL instance
 * @param systemId System ID
 */
export function registerSystemExtensions(dsl: DSL, systemId: string): void {
  const system = dsl.getComponent(systemId);
  if (!system || system.type !== ComponentType.SYSTEM) {
    throw new Error(`System not found: ${systemId}`);
  }
  
  // Register extensions specified in the system definition
  const systemDefinition = system as any;
  if (systemDefinition.extensions) {
    systemDefinition.extensions.forEach((ext: any) => {
      registerExtension(dsl, ext.ref, ext.config);
    });
  }
}

/**
 * Returns a list of all registered extension IDs
 * 
 * @returns Array of extension IDs
 */
export function listExtensions(): string[] {
  return Array.from(extensionRegistry.keys());
}

/**
 * Removes an extension definition
 * 
 * @param id Extension ID
 */
export function removeExtensionDefinition(id: string): void {
  if (!extensionRegistry.has(id)) {
    throw new Error(`Extension not found: ${id}`);
  }
  
  extensionRegistry.delete(id);
}

// Export extension modules
export * from './actor.extension.js';
export * from './process.extension.js';
export * from './command.extension.js';
export * from './query.extension.js';
export * from './schema.extension.js';
export * from './workflow.extension.js';  // Export the new workflow extension
export * from './saga.actor.extension.js'; // Export the new saga actor extension 