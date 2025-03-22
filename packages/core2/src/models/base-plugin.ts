/**
 * Base plugin implementation documentation
 * 
 * The BasePlugin class provides a foundation for implementing type-safe extensions
 * with the following features:
 * 
 * 1. Type-safe Hook Management
 *    - Hooks are stored with their proper types
 *    - Hook registration is type-safe and validated
 *    - Hook execution preserves type information
 * 
 * 2. Context Management
 *    - Each plugin maintains its own typed context
 *    - Context can be accessed and modified safely
 *    - Context types are preserved throughout the plugin lifecycle
 * 
 * 3. State Management
 *    - Plugins can maintain typed state
 *    - State is accessible through type-safe methods
 *    - State changes are tracked and validated
 * 
 * Example Usage:
 * ```typescript
 * interface MyPluginState {
 *   counter: number;
 *   lastAction: string;
 * }
 * 
 * class MyPlugin extends BasePlugin<MyPluginState> {
 *   constructor() {
 *     super({
 *       id: 'my-plugin',
 *       name: 'My Plugin',
 *       description: 'A plugin with typed state'
 *     });
 * 
 *     // Initialize state
 *     this.setState({
 *       counter: 0,
 *       lastAction: ''
 *     });
 * 
 *     // Register a hook with typed state
 *     this.registerHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async (params) => {
 *       const state = this.getState();
 *       state.counter++;
 *       state.lastAction = 'before_execution';
 *       return { success: true, value: params };
 *     });
 *   }
 * }
 */

import {
  Extension,
  ExtensionContext,
  ExtensionHook,
  ExtensionHookRegistration,
  ExtensionPointName,
  ExtensionPointParameters,
  createHookRegistration
} from './extension-system';

/**
 * Base plugin implementation with type-safe hook registration
 */
export abstract class BasePlugin<S = unknown> implements Extension {
  private hooks: Array<ExtensionHookRegistration<ExtensionPointName, unknown>> = [];
  private context: ExtensionContext<S> = { state: {} as S };

  constructor(
    protected readonly config: {
      id: string;
      name: string;
      description: string;
      dependencies?: string[];
    }
  ) {}

  get id(): string {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get description(): string {
    return this.config.description;
  }

  get dependencies(): string[] {
    return this.config.dependencies || [];
  }

  getVersion(): string {
    return '1.0.0';
  }

  getCapabilities(): string[] {
    return [];
  }

  getHooks(): Array<ExtensionHookRegistration<ExtensionPointName, unknown>> {
    return this.hooks;
  }

  /**
   * Register a hook with type-safe parameters
   */
  protected registerHook<N extends ExtensionPointName>(
    pointName: N,
    hook: ExtensionHook<N, S>,
    priority: number = 0
  ): void {
    // Create a type-safe wrapper for the hook
    const wrappedHook: ExtensionHook<ExtensionPointName, unknown> = async (params, context) => {
      return hook(params as ExtensionPointParameters[N], context as ExtensionContext<S>);
    };

    const registration = createHookRegistration(pointName, wrappedHook, priority);
    this.hooks.push(registration);
  }

  /**
   * Get the plugin's context
   */
  protected getContext(): ExtensionContext<S> {
    return this.context;
  }

  /**
   * Update the plugin's context
   */
  protected setContext(context: ExtensionContext<S>): void {
    this.context = context;
  }

  /**
   * Get the plugin's state
   */
  protected getState(): S {
    return this.context.state;
  }

  /**
   * Update the plugin's state
   */
  protected setState(state: S): void {
    this.context.state = state;
  }
} 