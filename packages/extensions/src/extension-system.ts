/**
 * @file Implementation of the extension system
 * @module @architectlm/extensions
 */

/**
 * Extension System Implementation
 * 
 * This module provides the core extension system that allows for pluggable
 * functionality through extensions and hooks.
 */

/**
 * Extension hook handler function type
 */
export type ExtensionHookHandler<T = unknown, R = unknown> = (context: T) => Promise<R> | R;

/**
 * Extension interface defining the structure of an extension
 */
export interface Extension {
  /**
   * The name of the extension
   */
  name: string;
  
  /**
   * A description of what the extension does
   */
  description: string;
  
  /**
   * Map of hook names to handler functions
   */
  hooks: Record<string, ExtensionHookHandler<any, any>>;
}

/**
 * Extension point interface defining a hook and its handlers
 */
export interface ExtensionPoint {
  /**
   * The name of the extension point
   */
  name: string;
  
  /**
   * Description of the extension point
   */
  description?: string;
  
  /**
   * Array of handler functions for this extension point
   */
  handlers: ExtensionHookHandler<any, any>[];
}

/**
 * Plugin interface for setting up extensions
 */
export interface Plugin extends Extension {
  /**
   * Optional array of event interceptors
   */
  eventInterceptors?: EventInterceptor[];
  
  /**
   * Function to set up the plugin with the extension system
   */
  setup?: (extensionSystem: DefaultExtensionSystem) => void;
}

/**
 * Event object passed to interceptors
 */
export interface ExtensionEvent {
  /**
   * The type/name of the hook being executed
   */
  type: string;
  
  /**
   * The context object for the hook
   */
  context: unknown;
  
  /**
   * Timestamp when the event was created
   */
  timestamp: number;
  
  /**
   * Error that occurred during hook execution (for error interceptors)
   */
  error?: Error;
}

/**
 * Event interceptor interface for hook execution
 */
export type EventInterceptor = 
  | ((event: ExtensionEvent) => ExtensionEvent) 
  | {
    /**
     * Function called before an event is processed
     */
    before?: (event: ExtensionEvent) => Promise<ExtensionEvent> | ExtensionEvent;
    
    /**
     * Function called after an event is processed
     */
    after?: (event: ExtensionEvent) => Promise<ExtensionEvent> | ExtensionEvent;
    
    /**
     * Function called when an error occurs during event processing
     */
    error?: (event: ExtensionEvent & { error: Error }) => Promise<void> | void;
  };

/**
 * Interface for the extension system
 */
export interface ExtensionSystem {
  /**
   * Register an extension point
   * @param extensionPoint The extension point to register
   */
  registerExtensionPoint(extensionPoint: ExtensionPoint): void;

  /**
   * Check if an extension point exists
   * @param name The name of the extension point
   */
  hasExtensionPoint(name: string): boolean;

  /**
   * Register an extension
   * @param extension The extension to register
   */
  registerExtension(extension: Extension): void;

  /**
   * Trigger an extension point with the given context
   * @param extensionPointName The name of the extension point to trigger
   * @param context The context to pass to the extension hooks
   * @returns The result of the extension hooks
   */
  triggerExtensionPoint<T = any, R = any>(extensionPointName: string, context: T): Promise<R>;

  /**
   * Register an event interceptor
   * @param interceptor The event interceptor to register
   */
  registerEventInterceptor(interceptor: EventInterceptor): void;

  /**
   * Process an event through all registered interceptors
   * @param event The event to process
   * @returns The processed event
   */
  processEventThroughInterceptors(event: ExtensionEvent): ExtensionEvent;

  /**
   * Register a plugin
   * @param plugin The plugin to register
   */
  registerPlugin(plugin: Plugin): void;
}

/**
 * Default implementation of the extension system
 */
export class DefaultExtensionSystem implements ExtensionSystem {
  private extensionPoints: Map<string, ExtensionPoint> = new Map();
  private extensions: Map<string, Extension> = new Map();
  private hooks: Map<string, Array<ExtensionHookHandler<any, any>>> = new Map();
  private eventInterceptors: EventInterceptor[] = [];

  /**
   * Register an extension point
   * @param extensionPoint The extension point to register
   */
  registerExtensionPoint(extensionPoint: ExtensionPoint): void {
    if (this.extensionPoints.has(extensionPoint.name)) {
      throw new Error(`Extension point '${extensionPoint.name}' is already registered`);
    }

    this.extensionPoints.set(extensionPoint.name, extensionPoint);
    this.hooks.set(extensionPoint.name, []);
  }

  /**
   * Check if an extension point exists
   * @param name The name of the extension point
   */
  hasExtensionPoint(name: string): boolean {
    return this.extensionPoints.has(name);
  }

  /**
   * Register an extension
   * @param extension The extension to register
   */
  registerExtension(extension: Extension): void {
    if (this.extensions.has(extension.name)) {
      throw new Error(`Extension '${extension.name}' is already registered`);
    }

    this.extensions.set(extension.name, extension);

    // Register all hooks provided by this extension
    for (const [extensionPointName, hook] of Object.entries(extension.hooks)) {
      if (!this.extensionPoints.has(extensionPointName)) {
        throw new Error(`Extension point '${extensionPointName}' is not registered`);
      }

      const hooks = this.hooks.get(extensionPointName) || [];
      hooks.push(hook);
      this.hooks.set(extensionPointName, hooks);
    }
  }

  /**
   * Trigger an extension point with the given context
   * @param extensionPointName The name of the extension point to trigger
   * @param context The context to pass to the extension hooks
   * @returns The result of the extension hooks
   */
  async triggerExtensionPoint<T = any, R = any>(extensionPointName: string, context: T): Promise<R> {
    if (!this.extensionPoints.has(extensionPointName)) {
      throw new Error(`Extension point '${extensionPointName}' is not registered`);
    }

    const hooks = this.hooks.get(extensionPointName) || [];
    let result: any = context;

    // Execute all hooks in sequence, passing the result of each hook to the next
    for (const hook of hooks) {
      result = await hook(result);
      
      // If a hook returns null or undefined, stop the chain and return the result
      if (result === null || result === undefined) {
        break;
      }
    }

    return result as R;
  }

  /**
   * Register an event interceptor
   * @param interceptor The event interceptor to register
   */
  registerEventInterceptor(interceptor: EventInterceptor): void {
    this.eventInterceptors.push(interceptor);
  }

  /**
   * Process an event through all registered interceptors
   * @param event The event to process
   * @returns The processed event
   */
  processEventThroughInterceptors(event: ExtensionEvent): ExtensionEvent {
    let processedEvent = event;

    // Apply 'before' interceptors
    for (const interceptor of this.eventInterceptors) {
      // Handle both function-style interceptors and object-style interceptors
      if (typeof interceptor === 'function') {
        processedEvent = interceptor(processedEvent);
      } else if (interceptor.before) {
        processedEvent = interceptor.before(processedEvent) as ExtensionEvent;
      }
    }

    // Apply 'after' interceptors in reverse order
    for (let i = this.eventInterceptors.length - 1; i >= 0; i--) {
      const interceptor = this.eventInterceptors[i];
      if (typeof interceptor !== 'function' && interceptor.after) {
        processedEvent = interceptor.after(processedEvent) as ExtensionEvent;
      }
    }

    return processedEvent;
  }

  /**
   * Register a plugin
   * @param plugin The plugin to register
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

    // Call the setup function if provided
    if (plugin.setup) {
      plugin.setup(this);
    }
  }

  /**
   * Get all registered extension points
   * @returns A map of all registered extension points
   */
  getExtensionPoints(): Map<string, ExtensionPoint> {
    return new Map(this.extensionPoints);
  }

  /**
   * Get all registered extensions
   * @returns A map of all registered extensions
   */
  getExtensions(): Extension[] {
    return [...this.extensions.values()];
  }

  /**
   * Get all hooks for an extension point
   * @param extensionPointName The name of the extension point
   * @returns The hooks for the extension point
   */
  getHooks(extensionPointName: string): Array<(context: unknown) => unknown> {
    return [...(this.hooks.get(extensionPointName) || [])];
  }

  /**
   * Get an extension by name
   * @param name The name of the extension to get
   * @returns The extension or undefined if not found
   */
  getExtension(name: string): Extension | undefined {
    return this.extensions.get(name);
  }
}

/**
 * Create a new extension system
 */
export function createExtensionSystem(): ExtensionSystem {
  return new DefaultExtensionSystem();
}
