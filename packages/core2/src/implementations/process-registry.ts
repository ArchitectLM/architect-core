import { 
  ProcessDefinition, 
  ProcessRegistry 
} from '../models/process-system';
import {
  Identifier,
  Result,
  DomainError
} from '../models/core-types';

// Add this type to track process by name
interface ProcessDefinitionWithType extends ProcessDefinition<string, unknown> {
  processType: string;
}

/**
 * Simple in-memory implementation of ProcessRegistry
 */
export class SimpleProcessRegistry implements ProcessRegistry {
  private processes = new Map<Identifier, ProcessDefinitionWithType>();
  private processesByType = new Map<string, ProcessDefinitionWithType[]>();
  
  /**
   * Register a process definition
   * @param definition The process definition to register
   */
  public registerProcess<TState extends string, TData>(
    definition: ProcessDefinition<TState, TData>
  ): Result<void> {
    try {
      // Validate definition
      if (!definition.id) {
        return {
          success: false,
          error: new DomainError(
            'Process definition must have an ID',
            { definition }
          )
        };
      }
      
      if (!definition.initialState) {
        return {
          success: false,
          error: new DomainError(
            'Process definition must have an initial state',
            { definition }
          )
        };
      }
      
      // Check if already registered
      if (this.processes.has(definition.id)) {
        return {
          success: false,
          error: new DomainError(
            `Process definition with ID ${definition.id} is already registered`,
            { processId: definition.id }
          )
        };
      }
      
      // Use the name as the process type if not otherwise specified
      const processType = definition.name;
      
      // Store with the process type
      const defWithType: ProcessDefinitionWithType = {
        ...definition as unknown as ProcessDefinition<string, unknown>,
        processType
      };
      
      // Register the definition
      this.processes.set(definition.id, defWithType);
      
      // Add to process type index
      if (!this.processesByType.has(processType)) {
        this.processesByType.set(processType, []);
      }
      this.processesByType.get(processType)!.push(defWithType);
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to register process: ${String(error)}`)
      };
    }
  }
  
  /**
   * Unregister a process definition
   * @param processId The ID of the process definition to unregister
   */
  public unregisterProcess(processId: Identifier): Result<void> {
    try {
      const definition = this.processes.get(processId);
      
      if (!definition) {
        return {
          success: false,
          error: new DomainError(
            `Process definition with ID ${processId} is not registered`,
            { processId }
          )
        };
      }
      
      // Remove from processes map
      this.processes.delete(processId);
      
      // Remove from process type index
      const processType = definition.processType;
      const typeDefinitions = this.processesByType.get(processType);
      
      if (typeDefinitions) {
        const index = typeDefinitions.findIndex(def => def.id === processId);
        if (index !== -1) {
          typeDefinitions.splice(index, 1);
        }
        
        if (typeDefinitions.length === 0) {
          this.processesByType.delete(processType);
        }
      }
      
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to unregister process: ${String(error)}`)
      };
    }
  }
  
  /**
   * Get a process definition by ID
   * @param processId The ID of the process definition to retrieve
   */
  public getProcessDefinition<TState extends string, TData>(
    processId: Identifier
  ): Result<ProcessDefinition<TState, TData>> {
    try {
      const definition = this.processes.get(processId);
      
      if (!definition) {
        return {
          success: false,
          error: new DomainError(
            `Process definition with ID ${processId} not found`,
            { processId }
          )
        };
      }
      
      // Remove the processType property when returning
      const { processType, ...result } = definition;
      
      return { 
        success: true, 
        value: result as unknown as ProcessDefinition<TState, TData>
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to get process definition: ${String(error)}`)
      };
    }
  }
  
  /**
   * Check if a process definition exists
   * @param processId The ID of the process definition to check
   */
  public hasProcessDefinition(processId: Identifier): boolean {
    return this.processes.has(processId);
  }
  
  /**
   * Get all registered process definitions
   */
  public getAllProcessDefinitions(): ProcessDefinition<string, unknown>[] {
    // Remove the processType property from all definitions
    return Array.from(this.processes.values()).map(({ processType, ...def }) => def);
  }
  
  /**
   * Get a process definition by type and version
   * @param processType The type of process to retrieve
   * @param version Optional version
   */
  public getProcessDefinitionByType(
    processType: string,
    version?: string
  ): ProcessDefinition<string, unknown> | undefined {
    const definitions = this.processesByType.get(processType);
    
    if (!definitions || definitions.length === 0) {
      return undefined;
    }
    
    if (version) {
      const matched = definitions.find(def => def.version === version);
      
      if (matched) {
        // Remove the processType property when returning
        const { processType, ...result } = matched;
        return result;
      }
      
      return undefined;
    }
    
    // If no version specified, return the latest one
    const sorted = [...definitions].sort((a, b) => {
      const vA = a.version || '0.0.0';
      const vB = b.version || '0.0.0';
      
      // Simple semver comparison (could be improved)
      return vB.localeCompare(vA);
    });
    
    if (sorted.length > 0) {
      // Remove the processType property when returning
      const { processType, ...result } = sorted[0];
      return result;
    }
    
    return undefined;
  }
}

/**
 * Factory function to create a new ProcessRegistry
 */
export function createProcessRegistry(): ProcessRegistry {
  return new SimpleProcessRegistry();
} 