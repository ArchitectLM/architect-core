import { v4 as uuidv4 } from 'uuid';
import {
  Extension,
  ExtensionContext,
  ExtensionHook,
  ExtensionHookRegistration,
  ExtensionPointName,
  ExtensionPointParameters,
  ExtensionSystem
} from '../models/extension-system';
import { Identifier } from '../models/core-types';
import { DomainError, Result } from '../utils';
import { DomainEvent } from '../models/core-types';

interface RegisteredHook {
  extensionId: string;
  hook: Function;
  priority: number;
}

/**
 * Implementation of ExtensionSystem interface
 */
export class ExtensionSystemImpl implements ExtensionSystem {
  private extensions = new Map<string, Extension>();
  private extensionPoints = new Set<ExtensionPointName>();
  private hooksByPoint = new Map<ExtensionPointName, RegisteredHook[]>();
  private contextData: Record<string, unknown> = {};

  /**
   * Register an extension point
   */
  registerExtensionPoint(name: ExtensionPointName): void {
    this.extensionPoints.add(name);
    
    // Initialize hooks array for this point if it doesn't exist
    if (!this.hooksByPoint.has(name)) {
      this.hooksByPoint.set(name, []);
    }
  }

  /**
   * Set the context data for extension hooks
   * @param context Context object to pass to extension hooks
   */
  public setContext(context: { [key: string]: any }): void {
    this.contextData = context;
  }

  /**
   * Execute an extension point
   */
  async executeExtensionPoint<T, R>(
    name: ExtensionPointName,
    params: T
  ): Promise<Result<R>> {
    try {
      // Create context for hooks
      const extensionContext: ExtensionContext = {
        state: {},
        metadata: { contextData: this.contextData },
        data: this.contextData // Add data property for backward compatibility
      };

      // Ensure extension point exists
      if (!this.extensionPoints.has(name)) {
        this.registerExtensionPoint(name);
      }

      // Get hooks for this extension point
      const hooks = this.hooksByPoint.get(name) || [];
      
      // Sort hooks by priority (higher first)
      const sortedHooks = [...hooks].sort((a, b) => b.priority - a.priority);
      
      // No hooks registered for this point
      if (sortedHooks.length === 0) {
        return { success: true, value: params as unknown as R };
      }
      
      // Execute hooks in sequence, passing modified params
      let currentParams = params;
      
      for (const { hook, extensionId } of sortedHooks) {
        const result = await hook(currentParams, extensionContext);
        
        // If hook failed, return the error
        if (!result.success) {
          return { 
            success: false, 
            error: result.error || new Error('Hook execution failed')
          };
        }
        
        // Use the result value for next hook
        currentParams = result.value;
      }
      
      // Return the final result
      return { success: true, value: currentParams as unknown as R };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Check if all dependencies for an extension are satisfied
   */
  private areDependenciesSatisfied(extension: Extension): Result<void> {
    // Check each dependency
    for (const depId of extension.dependencies) {
      if (!this.extensions.has(depId)) {
        return {
          success: false,
          error: new Error(`Extension ${extension.id} has missing dependency: ${depId}`)
        };
      }
    }
    
    return { success: true, value: undefined };
  }

  /**
   * Register an extension
   */
  registerExtension(extension: Extension): Result<void> {
    try {
      // Check if already registered
      if (this.extensions.has(extension.id)) {
        return {
          success: false,
          error: new Error(`Extension ${extension.id} is already registered`)
        };
      }
      
      // Check dependencies
      const depsCheck = this.areDependenciesSatisfied(extension);
      if (!depsCheck.success) {
        return depsCheck;
      }
      
      // Store the extension
      this.extensions.set(extension.id, extension);
      
      // Register all hooks
      const hooks = extension.getHooks();
      for (const { pointName, hook, priority = 0 } of hooks) {
        // Create extension point if it doesn't exist
        if (!this.extensionPoints.has(pointName)) {
          this.registerExtensionPoint(pointName);
        }
        
        // Get hooks for this point
        const pointHooks = this.hooksByPoint.get(pointName)!;
        
        // Add the hook
        pointHooks.push({
          extensionId: extension.id,
          hook,
          priority
        });
      }
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Unregister an extension
   */
  unregisterExtension(extensionId: string): Result<void> {
    try {
      // Check if extension exists
      if (!this.extensions.has(extensionId)) {
        return {
          success: false,
          error: new Error(`Extension ${extensionId} not found`)
        };
      }
      
      // Remove extension
      this.extensions.delete(extensionId);
      
      // Remove all hooks for this extension
      for (const [pointName, hooks] of this.hooksByPoint.entries()) {
        const remainingHooks = hooks.filter(h => h.extensionId !== extensionId);
        this.hooksByPoint.set(pointName, remainingHooks);
      }
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }

  /**
   * Get all registered extension points
   */
  getExtensionPoints(): ExtensionPointName[] {
    return Array.from(this.extensionPoints);
  }

  /**
   * Get all registered extensions
   */
  getExtensions(): string[] {
    return Array.from(this.extensions.keys());
  }

  /**
   * Get all handlers for a specific extension point
   */
  getExtensionHandlers(
    extensionPointName: ExtensionPointName
  ): { extensionId: string; handler: Function }[] {
    // If the extension point doesn't exist, return empty array
    if (!this.hooksByPoint.has(extensionPointName)) {
      return [];
    }
    
    // Map registered hooks to the expected format
    return this.hooksByPoint.get(extensionPointName)!.map(({ extensionId, hook }) => ({
      extensionId,
      handler: hook
    }));
  }
}

/**
 * InMemoryExtensionSystem extends ExtensionSystemImpl with no added functionality
 * This exists primarily for backward compatibility with tests
 */
export class InMemoryExtensionSystem extends ExtensionSystemImpl {
  constructor() {
    super();
  }
}

/**
 * Create a new extension system
 */
export function createExtensionSystem(): ExtensionSystem {
  return new ExtensionSystemImpl();
} 