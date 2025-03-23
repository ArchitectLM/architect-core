import { 
  ProcessDefinition,
  ProcessRegistry,
  ProcessTransition 
} from '../models/process-system';
import {
  Result
} from '../models/core-types';
import { BaseRegistry, DomainError } from '../utils';

/**
 * In-memory implementation of ProcessRegistry
 */
export class InMemoryProcessRegistry extends BaseRegistry<ProcessDefinition<string, unknown>, string> implements ProcessRegistry {
  /**
   * Register a process definition
   * @param definition The process definition to register
   */
  public registerProcess<TState extends string, TData>(
    definition: ProcessDefinition<TState, TData>
  ): Result<void> {
    try {
      if (!definition.type) {
        return {
          success: false,
          error: new DomainError(`Process definition must have a type property`)
        };
      }
      
      return this.registerItem(definition.type, definition as ProcessDefinition<string, unknown>);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Unregister a process definition
   * @param processType The process type to unregister
   */
  public unregisterProcess(processType: string): Result<void> {
    try {
      return this.unregisterItem(processType);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Get a process definition by type
   * @param processType The process type
   */
  public getProcessDefinition<TState extends string, TData>(
    processType: string
  ): Result<ProcessDefinition<TState, TData>> {
    try {
      const result = this.getItem(processType);
      
      if (!result.success) {
        return {
          success: false,
          error: new DomainError(`Process definition for type '${processType}' is not registered`)
        };
      }
      
      return {
        success: true,
        value: result.value as unknown as ProcessDefinition<TState, TData>
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };
    }
  }
  
  /**
   * Check if a process type is registered
   * @param processType The process type
   */
  public hasProcess(processType: string): boolean {
    return this.hasItem(processType);
  }
  
  /**
   * Get all registered process types
   */
  public getProcessTypes(): string[] {
    return this.getAllKeys();
  }

  /**
   * Get all registered process definitions
   */
  public getAllProcessDefinitions(): ProcessDefinition<string, unknown>[] {
    return this.getAllItems();
  }

  /**
   * Find a transition for a process type
   * @param processType The process type
   * @param fromState The source state
   * @param eventType The event type
   */
  public findTransition<TState extends string>(
    processType: string,
    fromState: TState,
    eventType: string
  ): ProcessTransition<TState> | undefined {
    try {
      const processDefResult = this.getProcessDefinition<TState, unknown>(processType);
      
      if (!processDefResult.success || !processDefResult.value) {
        return undefined;
      }
      
      const processDef = processDefResult.value;
      return processDef.transitions.find(
        t => t.from === fromState && t.event === eventType
      ) as ProcessTransition<TState> | undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Get a process definition by type and version
   * Helper method used by the ProcessManager
   * @param processType The type of process to get
   * @param version Optional version
   */
  public getProcessDefinitionByType<TState extends string, TData>(
    processType: string,
    version?: string
  ): Result<ProcessDefinition<TState, TData>> {
    const processDefResult = this.getProcessDefinition<TState, TData>(processType);
    
    if (!processDefResult.success || !processDefResult.value) {
      return {
        success: false,
        error: new DomainError(`Process definition for type ${processType} not found`)
      };
    }
    
    // If version is specified and doesn't match, return error
    if (version && processDefResult.value.version !== version) {
      return {
        success: false,
        error: new DomainError(`Process definition for type ${processType} version ${version} not found`)
      };
    }
    
    return processDefResult;
  }
}

/**
 * Factory function to create a new ProcessRegistry
 */
export function createProcessRegistry(): ProcessRegistry {
  return new InMemoryProcessRegistry();
} 