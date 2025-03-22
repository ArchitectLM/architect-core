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
 * ```
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
}

/**
 * Base extension point name
 */
export const ExtensionPointNames = {
  // Task lifecycle events
  TASK_BEFORE_EXECUTION: 'task:beforeExecution',
  TASK_AFTER_EXECUTION: 'task:afterExecution',
  TASK_EXECUTION_ERROR: 'task:onError',
  
  // Process lifecycle events
  PROCESS_BEFORE_CREATE: 'process:beforeCreate',
  PROCESS_AFTER_CREATE: 'process:afterCreate',
  PROCESS_BEFORE_TRANSITION: 'process:beforeTransition',
  PROCESS_AFTER_TRANSITION: 'process:afterTransition',
  
  // System lifecycle events
  SYSTEM_INIT: 'system:init',
  SYSTEM_SHUTDOWN: 'system:shutdown',
  SYSTEM_ERROR: 'system:error',
  
  // Event lifecycle events
  EVENT_BEFORE_PUBLISH: 'event:beforePublish',
  EVENT_AFTER_PUBLISH: 'event:afterPublish',
  EVENT_BEFORE_REPLAY: 'event:beforeReplay',
  EVENT_AFTER_REPLAY: 'event:afterReplay'
} as const;

/**
 * Extension point name type
 */
export type ExtensionPointName = typeof ExtensionPointNames[keyof typeof ExtensionPointNames];

/**
 * Type-safe extension point parameters
 */
export type ExtensionPointParameters = {
  [ExtensionPointNames.TASK_BEFORE_EXECUTION]: {
    taskId: string;
    taskType: string;
    input: unknown;
  };
  [ExtensionPointNames.TASK_AFTER_EXECUTION]: {
    taskId: string;
    taskType: string;
    input: unknown;
    result: unknown;
    executionTime: number;
  };
  [ExtensionPointNames.TASK_EXECUTION_ERROR]: {
    taskId: string;
    taskType: string;
    input: unknown;
    error: Error;
  };
  [ExtensionPointNames.PROCESS_BEFORE_CREATE]: {
    processType: string;
    data: unknown;
  };
  [ExtensionPointNames.PROCESS_AFTER_CREATE]: {
    processId: string;
    processType: string;
    data: unknown;
  };
  [ExtensionPointNames.PROCESS_BEFORE_TRANSITION]: {
    processId: string;
    processType: string;
    fromState: string;
    toState: string;
    event: string;
  };
  [ExtensionPointNames.PROCESS_AFTER_TRANSITION]: {
    processId: string;
    processType: string;
    fromState: string;
    toState: string;
    event: string;
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
  [ExtensionPointNames.EVENT_BEFORE_PUBLISH]: {
    eventType: string;
    payload: unknown;
  };
  [ExtensionPointNames.EVENT_AFTER_PUBLISH]: {
    eventId: string;
    eventType: string;
    payload: unknown;
  };
  [ExtensionPointNames.EVENT_BEFORE_REPLAY]: {
    eventType: string;
    fromTimestamp: number;
    toTimestamp: number;
  };
  [ExtensionPointNames.EVENT_AFTER_REPLAY]: {
    eventType: string;
    eventCount: number;
    fromTimestamp: number;
    toTimestamp: number;
  };
};

/**
 * Type-safe extension point with parameters and context
 */
export type ExtensionPoint<
  N extends ExtensionPointName,
  S = unknown
> = {
  name: N;
  params: ExtensionPointParameters[N];
  context: ExtensionContext<S>;
};

/**
 * Type-safe extension hook function
 */
export type ExtensionHook<
  N extends ExtensionPointName,
  S = unknown
> = (
  params: ExtensionPointParameters[N],
  context: ExtensionContext<S>
) => Promise<Result<ExtensionPointParameters[N]>>;

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
 * Extension system for managing extensions and hooks
 */
export interface ExtensionSystem {
  /**
   * Register an extension
   * @param extension The extension to register
   */
  registerExtension(extension: Extension): Result<void>;
  
  /**
   * Unregister an extension
   * @param extensionId The ID of the extension to unregister
   */
  unregisterExtension(extensionId: string): Result<void>;
  
  /**
   * Get all registered extensions
   */
  getExtensions(): Extension[];
  
  /**
   * Execute a specific extension point
   * @param pointName The name of the extension point
   * @param params The parameters for the extension point
   */
  executeExtensionPoint<N extends ExtensionPointName>(
    pointName: N,
    params: ExtensionPointParameters[N]
  ): Promise<Result<ExtensionPointParameters[N]>>;
  
  /**
   * Get extension by ID
   * @param extensionId The ID of the extension to retrieve
   */
  getExtension(extensionId: string): Extension | undefined;
  
  /**
   * Check if an extension is registered
   * @param extensionId The ID of the extension to check
   */
  hasExtension(extensionId: string): boolean;
}

/**
 * Type-safe hook registration helper
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

/**
 * Concrete implementation of the extension system
 */
export class ExtensionSystemImpl implements ExtensionSystem {
  private extensions = new Map<string, Extension>();
  private hooks = new Map<ExtensionPointName, Array<ExtensionHookRegistration<ExtensionPointName, unknown>>>();

  registerExtension(extension: Extension): Result<void> {
    try {
      if (this.extensions.has(extension.id)) {
        return {
          success: false,
          error: new Error(`Extension ${extension.id} is already registered`)
        };
      }

      // Register the extension
      this.extensions.set(extension.id, extension);

      // Register all hooks from the extension
      const extensionHooks = extension.getHooks();
      for (const hook of extensionHooks) {
        const hooks = this.hooks.get(hook.pointName) || [];
        hooks.push(hook);
        this.hooks.set(hook.pointName, hooks);
      }

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  unregisterExtension(extensionId: string): Result<void> {
    try {
      const extension = this.extensions.get(extensionId);
      if (!extension) {
        return {
          success: false,
          error: new Error(`Extension ${extensionId} not found`)
        };
      }

      // Remove all hooks from this extension
      const extensionHooks = extension.getHooks();
      for (const hook of extensionHooks) {
        const hooks = this.hooks.get(hook.pointName) || [];
        const filteredHooks = hooks.filter(h => h.hook !== hook.hook);
        this.hooks.set(hook.pointName, filteredHooks);
      }

      // Remove the extension
      this.extensions.delete(extensionId);

      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  getExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  async executeExtensionPoint<N extends ExtensionPointName>(
    pointName: N,
    params: ExtensionPointParameters[N]
  ): Promise<Result<ExtensionPointParameters[N]>> {
    try {
      // Get all hooks for this extension point
      const hooks = this.hooks.get(pointName) || [];
      
      // Sort hooks by priority (higher priority first)
      const sortedHooks = [...hooks].sort((a, b) => (b.priority || 0) - (a.priority || 0));
      
      // Execute hooks in sequence
      let currentParams = params;
      for (const { hook } of sortedHooks) {
        // First cast to unknown, then to the specific hook type
        const typedHook = (hook as unknown) as ExtensionHook<N, unknown>;
        const result = await typedHook(currentParams, { state: {} });
        if (!result.success) {
          return result;
        }
        // The result value should match the input type for this extension point
        currentParams = result.value as ExtensionPointParameters[N];
      }

      return { success: true, value: currentParams };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  getExtension(extensionId: string): Extension | undefined {
    return this.extensions.get(extensionId);
  }

  hasExtension(extensionId: string): boolean {
    return this.extensions.has(extensionId);
  }
} 