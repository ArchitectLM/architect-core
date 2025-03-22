/**
 * @file Models for the extension system
 * @module @architectlm/extensions
 */

/**
 * Local models for the extensions package
 * 
 * This file contains local definitions of models that are normally imported from @architectlm/core
 * to avoid build-time dependencies.
 */

/**
 * Event interface (local copy to avoid dependency on @architectlm/core)
 */
export interface Event<T = any> {
  /**
   * The type of the event
   */
  type: string;
  
  /**
   * The payload of the event
   */
  payload: T;
  
  /**
   * Timestamp when the event was created
   */
  timestamp: number;
  
  /**
   * Additional metadata for the event
   */
  metadata?: Record<string, any>;
}

/**
 * BackoffStrategy enum (local copy to avoid dependency on @architectlm/core)
 */
export enum BackoffStrategy {
  FIXED = 'fixed',
  LINEAR = 'linear',
  EXPONENTIAL = 'exponential',
  JITTER = 'jitter'
}

/**
 * Represents an extension point in the system
 */
export interface ExtensionPoint {
  /**
   * Unique name of the extension point
   */
  name: string;

  /**
   * Description of the extension point
   */
  description: string;

  /**
   * Array of handler functions for this extension point
   */
  handlers: ExtensionHookHandler[];

  /**
   * Optional metadata for the extension point
   */
  metadata?: Record<string, unknown>;
}

/**
 * Type for extension hook handlers
 */
export type ExtensionHookHandler = (
  context: unknown,
) => unknown | Promise<unknown>;

/**
 * Represents an extension in the system
 */
export interface Extension {
  /**
   * Unique name of the extension
   */
  name: string;

  /**
   * Description of the extension
   */
  description: string;

  /**
   * Map of extension point names to hook handlers
   */
  hooks: Record<string, ExtensionHookHandler>;

  /**
   * Optional metadata for the extension
   */
  metadata?: Record<string, unknown>;
}

/**
 * Type for event interceptors
 */
export type EventInterceptor = (event: Event) => Event;

/**
 * Represents a plugin in the system
 * A plugin is an extension that can also intercept events
 */
export interface Plugin extends Extension {
  /**
   * Optional array of event interceptors
   */
  eventInterceptors?: EventInterceptor[];
}

/**
 * Interface for the extension system
 */
export interface ExtensionSystem {
  /**
   * Register an extension point
   */
  registerExtensionPoint(extensionPoint: ExtensionPoint): void;

  /**
   * Check if an extension point exists
   */
  hasExtensionPoint(name: string): boolean;

  /**
   * Register an extension
   */
  registerExtension(extension: Extension): void;

  /**
   * Trigger an extension point
   * @returns The modified context after all extensions have been applied
   */
  triggerExtensionPoint(name: string, context: unknown): Promise<unknown>;

  /**
   * Register an event interceptor
   */
  registerEventInterceptor(interceptor: EventInterceptor): void;

  /**
   * Process an event through all registered interceptors
   */
  processEventThroughInterceptors(event: Event): Event;

  /**
   * Register a plugin
   */
  registerPlugin(plugin: Plugin): void;
}
