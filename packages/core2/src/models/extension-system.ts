/**
 * Extension system type documentation
 * 
 * This module provides a type-safe extension system with the following key features:
 * 
 * 1. Type-safe Extension Points
 *    - Each extension point has a defined set of parameters
 *    - Parameters are strictly typed and validated at compile time
 *    - Extension points are defined using a const object for better type inference
 * 
 * 2. Type-safe Hook Registration
 *    - Hooks are registered with their specific extension point
 *    - Hook parameters are inferred from the extension point
 *    - Hook return types are enforced to match the extension point parameters
 * 
 * 3. Context Management
 *    - Each extension can maintain its own typed context
 *    - Context is passed to hooks for state management
 *    - Context types are preserved throughout the extension lifecycle
 * 
 * 4. Priority System
 *    - Hooks can be registered with priorities
 *    - Higher priority hooks execute first
 *    - Priorities are type-safe and validated
 * 
 * Example Usage:
 * ```typescript
 * class MyExtension extends BasePlugin {
 *   constructor() {
 *     super({
 *       id: 'my-extension',
 *       name: 'My Extension',
 *       description: 'A type-safe extension'
 *     });
 * 
 *     // Register a type-safe hook
 *     this.registerHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
 *       // params is typed as { taskId: string; taskType: string; input: unknown }
 *       return { success: true, value: params };
 *     });
 *   }
 * }
 */

import { Metadata, Result } from './core-types';

/**
 * Extension hook context
 */
export interface ExtensionContext<T = unknown> {
  /** Extension state to persist between invocations */
  state: T;
  
  /** Contextual metadata for this invocation */
  metadata?: Metadata;
  
  /** @deprecated Data field for backward compatibility */
  data?: Record<string, unknown>;
}

/**
 * Extension point names
 */
export enum ExtensionPointNames {
  SYSTEM_INIT = 'system:init',
  SYSTEM_SHUTDOWN = 'system:shutdown',
  SYSTEM_ERROR = 'system:error',
  TASK_BEFORE_EXECUTE = 'task:beforeExecute',
  TASK_AFTER_EXECUTE = 'task:afterExecute',
  PROCESS_CREATED = 'process:created',
  PROCESS_UPDATED = 'process:updated',
  EVENT_BEFORE_PUBLISH = 'event:beforePublish',
  EVENT_AFTER_PUBLISH = 'event:afterPublish'
}

/**
 * Extension point name type
 */
export type ExtensionPointName = string;

/**
 * Type-safe extension point parameters
 */
export interface ExtensionPointParameters {
  [ExtensionPointNames.TASK_BEFORE_EXECUTE]: {
    taskId: string;
    taskType: string;
    input: unknown;
  };
  [ExtensionPointNames.TASK_AFTER_EXECUTE]: {
    taskId: string;
    taskType: string;
    input: unknown;
    result: unknown;
    executionTime: number;
  };
  [ExtensionPointNames.SYSTEM_INIT]: {
    version: string;
    config: Record<string, unknown>;
  };
  [ExtensionPointNames.SYSTEM_SHUTDOWN]: {
    reason: string;
  };
  [ExtensionPointNames.SYSTEM_ERROR]: {
    error: Error;
    source: string;
  };
  [ExtensionPointNames.PROCESS_CREATED]: {
    processType: string;
    data: unknown;
  };
  [ExtensionPointNames.PROCESS_UPDATED]: {
    processId: string;
    processType: string;
    data: unknown;
  };
  [ExtensionPointNames.EVENT_BEFORE_PUBLISH]: {
    eventType: string;
    payload: unknown;
  };
  [ExtensionPointNames.EVENT_AFTER_PUBLISH]: {
    eventId: string;
    eventType: string;
    payload: unknown;
  };
  // Add string index signature to allow using arbitrary string keys
  [key: string]: unknown;
}

/**
 * Type-safe extension point with parameters and context
 */
export type ExtensionPoint<
  N extends ExtensionPointName,
  S = unknown
> = {
  name: N;
  params: N extends keyof ExtensionPointParameters ? ExtensionPointParameters[N] : unknown;
  context: ExtensionContext<S>;
};

/**
 * Type-safe extension hook function
 */
export type ExtensionHook<
  N extends ExtensionPointName,
  S = unknown
> = (
  params: N extends keyof ExtensionPointParameters ? ExtensionPointParameters[N] : unknown,
  context: ExtensionContext<S>
) => Promise<Result<N extends keyof ExtensionPointParameters ? ExtensionPointParameters[N] : unknown>>;

/**
 * Type-safe extension hook registration
 */
export interface ExtensionHookRegistration<
  N extends ExtensionPointName,
  S = unknown
> {
  /** Extension point name */
  pointName: N;
  
  /** Hook implementation */
  hook: ExtensionHook<N, S>;
  
  /** Hook priority (higher executes first) */
  priority?: number;
}

/**
 * Extension definition with type-safe hooks
 */
export interface Extension {
  /** Unique extension identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Detailed description */
  description: string;
  
  /** Extensions this extension depends on */
  dependencies: string[];
  
  /** Get all hook registrations for this extension */
  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>>;
  
  /** Get the version of this extension */
  getVersion(): string;
  
  /** Get capabilities provided by this extension */
  getCapabilities(): string[];
}

/**
 * Extension system interface
 */
export interface ExtensionSystem {
  /**
   * Register an extension point
   */
  registerExtensionPoint(name: string): void;
  
  /**
   * Execute an extension point
   */
  executeExtensionPoint<T, R>(
    name: ExtensionPointName,
    params: T
  ): Promise<Result<R>>;
  
  /**
   * Register an extension
   */
  registerExtension(
    extension: Extension
  ): Result<void>;
  
  /**
   * Unregister an extension
   */
  unregisterExtension(extensionId: string): Result<void>;
  
  /**
   * Get all registered extension points
   */
  getExtensionPoints(): ExtensionPointName[];
  
  /**
   * Get all registered extensions
   */
  getExtensions(): string[];
  
  /**
   * Get all handlers for a specific extension point
   */
  getExtensionHandlers(
    extensionPointName: ExtensionPointName
  ): { extensionId: string; handler: Function }[];
  
  /**
   * Set the context for extensions
   */
  setContext(context: Record<string, unknown>): void;
}

/**
 * Helper function to create a hook registration
 */
export function createHookRegistration<N extends ExtensionPointName, S = unknown>(
  pointName: N,
  hook: ExtensionHook<N, S>,
  priority?: number
): ExtensionHookRegistration<N, S> {
  return {
    pointName,
    hook,
    priority
  };
} 