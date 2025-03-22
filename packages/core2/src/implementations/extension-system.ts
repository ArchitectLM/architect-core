import { v4 as uuidv4 } from 'uuid';
import {
  Extension,
  ExtensionContext,
  ExtensionHook,
  ExtensionPointName,
  ExtensionPointParameters,
  ExtensionSystem
} from '../models/extension-system';
import { Identifier, DomainError, Result } from '../models/core-types';

/**
 * In-memory implementation of the ExtensionSystem
 */
export class InMemoryExtensionSystem implements ExtensionSystem {
  /** Registered extensions */
  private extensions = new Map<Identifier, Extension>();
  
  /** Extension execution order (topologically sorted by dependencies) */
  private executionOrder: Identifier[] = [];
  
  /**
   * Register an extension
   * @param extension The extension to register
   */
  public registerExtension(extension: Extension): Result<void> {
    try {
      if (this.extensions.has(extension.id)) {
        return {
          success: false,
          error: new DomainError(
            `Extension with ID ${extension.id} is already registered`,
            { extensionId: extension.id }
          )
        };
      }
      
      // Validate dependencies
      if (extension.dependencies.length > 0) {
        const missingDependencies = extension.dependencies.filter(
          depId => !this.extensions.has(depId)
        );
        
        if (missingDependencies.length > 0) {
          return {
            success: false,
            error: new DomainError(
              `Dependencies not found for extension ${extension.id}`,
              { 
                extensionId: extension.id,
                missingDependencies
              }
            )
          };
        }
        
        // Check for circular dependencies
        for (const depId of extension.dependencies) {
          if (this.isDependentOn(depId, extension.id)) {
            return {
              success: false,
              error: new DomainError(
                `Circular dependency detected between ${extension.id} and ${depId}`,
                { 
                  extensionId: extension.id,
                  dependencyId: depId
                }
              )
            };
          }
        }
      }
      
      // Register the extension
      this.extensions.set(extension.id, extension);
      
      // Update execution order
      this.updateExecutionOrder();
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to register extension: ${String(error)}`)
      };
    }
  }
  
  /**
   * Unregister an extension
   * @param extensionId The ID of the extension to unregister
   */
  public unregisterExtension(extensionId: Identifier): Result<void> {
    try {
      if (!this.extensions.has(extensionId)) {
        return {
          success: false,
          error: new DomainError(
            `Extension with ID ${extensionId} is not registered`,
            { extensionId }
          )
        };
      }
      
      // Check if any registered extensions depend on this one
      const dependents = Array.from(this.extensions.values()).filter(
        ext => ext.dependencies.includes(extensionId)
      );
      
      if (dependents.length > 0) {
        return {
          success: false,
          error: new DomainError(
            `Cannot unregister extension ${extensionId} as it is depended on by other extensions`,
            { 
              extensionId,
              dependents: dependents.map(d => d.id)
            }
          )
        };
      }
      
      // Unregister the extension
      this.extensions.delete(extensionId);
      
      // Update execution order
      this.updateExecutionOrder();
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to unregister extension: ${String(error)}`)
      };
    }
  }
  
  /**
   * Get all registered extensions
   */
  public getExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }
  
  /**
   * Execute a specific extension point
   * @param pointName The name of the extension point
   * @param params The parameters for the extension point
   */
  public async executeExtensionPoint<N extends ExtensionPointName>(
    pointName: N,
    params: ExtensionPointParameters[N]
  ): Promise<Result<ExtensionPointParameters[N]>> {
    try {
      // Use type assertion to handle the complex type
      let currentParams = { ...params } as unknown as ExtensionPointParameters[N];
      const errors: Error[] = [];
      
      // Execute hooks in dependency order
      for (const extensionId of this.executionOrder) {
        const extension = this.extensions.get(extensionId);
        
        if (!extension) {
          continue;
        }
        
        // Find the hook for this extension point
        const hookRegistration = extension.getHooks().find(
          registration => registration.pointName === pointName
        );
        
        if (!hookRegistration) {
          continue;
        }
        
        try {
          // Create a context with empty state
          const context: ExtensionContext = {
            state: {},
            metadata: {}
          };
          
          // Execute the hook and get the result
          const result = await hookRegistration.hook(currentParams, context);
          
          if (!result.success) {
            errors.push(result.error);
            
            // For system error hooks, continue to collect all errors
            if (pointName !== 'system:error') {
              return result;
            }
          } else {
            // Update the params for the next hook
            currentParams = result.value as unknown as ExtensionPointParameters[N];
          }
        } catch (error) {
          const wrappedError = error instanceof Error
            ? error
            : new Error(`Error in extension hook: ${String(error)}`);
          
          errors.push(wrappedError);
          
          // For system error hooks, continue to collect all errors
          if (pointName !== 'system:error') {
            return {
              success: false,
              error: wrappedError
            };
          }
        }
      }
      
      // If we collected errors but didn't return early, create a composite error
      if (errors.length > 0) {
        return {
          success: false,
          error: new DomainError(
            `Multiple errors occurred during extension point execution`,
            { 
              extensionPoint: pointName,
              errorCount: errors.length
            },
            errors[0]
          )
        };
      }
      
      return { success: true, value: currentParams };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error 
          ? error 
          : new Error(`Failed to execute extension point: ${String(error)}`)
      };
    }
  }
  
  /**
   * Get extension by ID
   * @param extensionId The ID of the extension to retrieve
   */
  public getExtension(extensionId: Identifier): Extension | undefined {
    return this.extensions.get(extensionId);
  }
  
  /**
   * Check if an extension is registered
   * @param extensionId The ID of the extension to check
   */
  public hasExtension(extensionId: Identifier): boolean {
    return this.extensions.has(extensionId);
  }
  
  /**
   * Check if one extension depends on another (directly or indirectly)
   * @param extensionId The extension that might depend on the target
   * @param targetId The target extension
   */
  private isDependentOn(extensionId: Identifier, targetId: Identifier): boolean {
    const extension = this.extensions.get(extensionId);
    
    if (!extension) {
      return false;
    }
    
    // Direct dependency
    if (extension.dependencies.includes(targetId)) {
      return true;
    }
    
    // Check transitive dependencies
    for (const depId of extension.dependencies) {
      if (this.isDependentOn(depId, targetId)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Sort extensions topologically by dependencies
   */
  private updateExecutionOrder(): void {
    const visited = new Set<Identifier>();
    const order: Identifier[] = [];
    
    // Depth-first search for topological sort
    const visit = (extId: Identifier) => {
      if (visited.has(extId)) {
        return;
      }
      
      visited.add(extId);
      
      const extension = this.extensions.get(extId);
      
      if (extension) {
        // Visit dependencies first
        for (const depId of extension.dependencies) {
          visit(depId);
        }
        
        // Add this extension after its dependencies
        order.push(extId);
      }
    };
    
    // Start with extensions that have no dependencies
    const extensionsWithoutDeps = Array.from(this.extensions.values())
      .filter(ext => ext.dependencies.length === 0)
      .map(ext => ext.id);
    
    for (const extId of extensionsWithoutDeps) {
      visit(extId);
    }
    
    // Then handle remaining extensions
    for (const extId of this.extensions.keys()) {
      visit(extId);
    }
    
    // Update the execution order
    this.executionOrder = order;
  }
}

/**
 * Factory function to create a new ExtensionSystem
 */
export function createExtensionSystem(): ExtensionSystem {
  return new InMemoryExtensionSystem();
} 