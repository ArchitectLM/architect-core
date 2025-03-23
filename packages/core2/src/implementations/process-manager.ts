import { v4 as uuidv4 } from 'uuid';
import {
  ProcessCheckpoint,
  ProcessDefinition,
  ProcessInstance,
  ProcessManager,
  ProcessRegistry,
  ProcessTransition,
  Identifier,
  Metadata,
  Result,
  Timestamp,
  TaskExecutor
} from '../models';
import { DomainError } from '../utils';
import { ExtensionSystem, ExtensionPointNames, ExtensionPointParameters } from '../models/extension-system';

/**
 * InMemoryProcessRegistry interface for getProcessDefinitionByType
 */
interface InMemoryProcessRegistry extends ProcessRegistry {
  getProcessDefinitionByType<TState extends string, TData>(
    processType: string, 
    version?: string
  ): Result<ProcessDefinition<TState, TData>>;
}

/**
 * In-memory implementation of ProcessManager
 */
export class InMemoryProcessManager implements ProcessManager {
  private processRegistry: ProcessRegistry;
  private taskExecutor: TaskExecutor;
  private extensionSystem?: ExtensionSystem;
  private processes = new Map<Identifier, ProcessInstance<string, unknown>>();
  private checkpoints = new Map<Identifier, ProcessCheckpoint<unknown>>();
  
  /**
   * Create a new InMemoryProcessManager
   * @param processRegistry Registry of process definitions
   * @param taskExecutor Executor for running tasks
   * @param extensionSystem Extension system for executing extension points
   */
  constructor(processRegistry: ProcessRegistry, taskExecutor: TaskExecutor, extensionSystem?: ExtensionSystem) {
    this.processRegistry = processRegistry;
    this.taskExecutor = taskExecutor;
    this.extensionSystem = extensionSystem;
  }
  
  /**
   * Create a new process instance
   * @param processType The type of process to create
   * @param data Initial process data
   * @param options Optional creation parameters
   */
  public async createProcess<TData, TState extends string>(
    processType: string,
    data: TData,
    options: { version?: string; metadata?: Metadata } = {}
  ): Promise<Result<ProcessInstance<TState, TData>>> {
    try {
      // Get the process definition
      const definitionResult = this.getProcessDefinitionByType<TState, TData>(processType, options.version);
      
      if (!definitionResult.success || !definitionResult.value) {
        return {
          success: false,
          error: definitionResult.error || new Error(`Process definition for ${processType} not found`)
        };
      }
      
      const definition = definitionResult.value;
      
      // Validate the initial state exists in the definition
      if (!definition.initialState) {
        return {
          success: false,
          error: new DomainError(`Process definition does not have an initial state`)
        };
      }

      // Execute the extension point for process creation, if available
      if (this.extensionSystem) {
        const extensionResult = await this.extensionSystem.executeExtensionPoint<
          ExtensionPointParameters[typeof ExtensionPointNames.PROCESS_CREATED],
          ExtensionPointParameters[typeof ExtensionPointNames.PROCESS_CREATED]
        >(
          ExtensionPointNames.PROCESS_CREATED,
          {
            processType,
            data
          }
        );

        // If we got a successful result from the extension point, use the modified data
        if (extensionResult && extensionResult.success && extensionResult.value) {
          data = extensionResult.value.data as TData;
        }
      }
      
      // Create the process instance
      const processId = uuidv4();
      const now = Date.now();
      
      const process: ProcessInstance<TState, TData> = {
        id: processId,
        type: processType,
        state: definition.initialState as TState,
        data,
        createdAt: now,
        updatedAt: now,
        version: definition.version,
        metadata: options.metadata || {}
      };
      
      // Store the process
      this.processes.set(processId, process as ProcessInstance<string, unknown>);
      
      // Run entry actions for the initial state if defined
      if (definition.entryActions && definition.entryActions[definition.initialState]) {
        const entryAction = definition.entryActions[definition.initialState];
        if (entryAction) {
          try {
            process.data = await entryAction(data) as TData;
            process.updatedAt = Date.now();
          } catch (error) {
            console.error(`Error in entry action for state ${definition.initialState}:`, error);
          }
        }
      }
      
      return { success: true, value: process };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to create process: ${String(error)}`)
      };
    }
  }
  
  /**
   * Get a process instance by ID
   * @param processId The ID of the process to retrieve
   */
  public async getProcess<TData, TState extends string>(
    processId: Identifier
  ): Promise<Result<ProcessInstance<TState, TData>>> {
    try {
      const process = this.processes.get(processId);
      
      if (!process) {
        return {
          success: false,
          error: new DomainError(`Process with ID ${processId} not found`)
        };
      }
      
      return { 
        success: true, 
        value: process as ProcessInstance<TState, TData> 
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to get process: ${String(error)}`)
      };
    }
  }
  
  /**
   * Apply an event to transition a process
   * @param processId The ID of the process to transition
   * @param eventType The event type that triggers the transition
   * @param payload The event payload
   */
  public async applyEvent<TData, TState extends string, TPayload>(
    processId: Identifier,
    eventType: string,
    payload: TPayload
  ): Promise<Result<ProcessInstance<TState, TData>>> {
    try {
      // Get the process
      const processResult = await this.getProcess<TData, TState>(processId);
      
      if (!processResult.success || !processResult.value) {
        return processResult;
      }
      
      const process = processResult.value;
      
      // Get the process definition - use getProcessDefinitionByType instead of direct registry call
      const definitionResult = this.getProcessDefinitionByType<TState, TData>(
        process.type,
        process.version
      );
      
      if (!definitionResult.success || !definitionResult.value) {
        return {
          success: false,
          error: new DomainError(`Process definition for type ${process.type} not found`)
        };
      }
      
      const definition = definitionResult.value;
      
      // Find the transition for this event
      const transition = definition.transitions.find(t => 
        t.from === process.state && t.event === eventType
      );
      
      if (!transition) {
        return {
          success: false,
          error: new DomainError(`No transition found for event ${eventType} from state ${process.state}`)
        };
      }
      
      const oldState = process.state;
      
      // Run exit actions for the current state if defined
      if (definition.exitActions && definition.exitActions[process.state]) {
        const exitAction = definition.exitActions[process.state];
        if (exitAction) {
          try {
            process.data = await exitAction(process.data) as TData;
          } catch (error) {
            console.error(`Error in exit action for state ${process.state}:`, error);
          }
        }
      }
      
      // Update the process state
      process.state = transition.to as TState;
      process.updatedAt = Date.now();
      
      // Store transition metadata
      process.metadata = {
        ...process.metadata,
        lastTransition: {
          from: oldState,
          to: process.state,
          event: eventType,
          timestamp: process.updatedAt
        }
      };
      
      // Run entry actions for the new state if defined
      if (definition.entryActions && definition.entryActions[process.state]) {
        const entryAction = definition.entryActions[process.state];
        if (entryAction) {
          try {
            process.data = await entryAction(process.data) as TData;
            process.updatedAt = Date.now();
          } catch (error) {
            console.error(`Error in entry action for state ${process.state}:`, error);
          }
        }
      }
      
      // Update the process in storage
      this.processes.set(processId, process as ProcessInstance<string, unknown>);
      
      return { success: true, value: process };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to apply event: ${String(error)}`)
      };
    }
  }
  
  /**
   * Get processes by type and state
   * @param processType The process type
   * @param state Optional state filter
   */
  public async getProcessesByType<TData, TState extends string>(
    processType: string,
    state?: TState
  ): Promise<Result<ProcessInstance<TState, TData>[]>> {
    try {
      const matches: ProcessInstance<TState, TData>[] = [];
      
      for (const process of this.processes.values()) {
        if (process.type === processType) {
          if (state && process.state !== state) {
            continue;
          }
          
          matches.push(process as unknown as ProcessInstance<TState, TData>);
        }
      }
      
      return { success: true, value: matches };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to get processes by type: ${String(error)}`)
      };
    }
  }
  
  /**
   * Delete a process instance
   * @param processId The process ID
   */
  public async deleteProcess(processId: Identifier): Promise<Result<void>> {
    try {
      if (!this.processes.has(processId)) {
        return {
          success: false,
          error: new DomainError(`Process with ID ${processId} not found`)
        };
      }
      
      this.processes.delete(processId);
      return { success: true, value: undefined };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to delete process: ${String(error)}`)
      };
    }
  }
  
  /**
   * Check if a transition is valid
   * @param processId The process ID
   * @param eventType The event type
   */
  public async isTransitionValid(
    processId: Identifier,
    eventType: string
  ): Promise<Result<boolean>> {
    try {
      const processResult = await this.getProcess(processId);
      
      if (!processResult.success || !processResult.value) {
        return { success: true, value: false };
      }
      
      const process = processResult.value;
      
      const definitionResult = this.getProcessDefinitionByType(
        process.type,
        process.version
      );
      
      if (!definitionResult.success || !definitionResult.value) {
        return { success: true, value: false };
      }
      
      const definition = definitionResult.value;
      
      // Find the transition for this event
      const transition = definition.transitions.find(t => 
        t.from === process.state && t.event === eventType
      );
      
      return { success: true, value: !!transition };
    } catch (error) {
      return { success: true, value: false };
    }
  }
  
  /**
   * Save a process checkpoint for later recovery
   * @param processId The ID of the process to checkpoint
   */
  public async saveCheckpoint<TData>(
    processId: Identifier
  ): Promise<Result<ProcessCheckpoint<TData>>> {
    try {
      const processResult = await this.getProcess<TData, string>(processId);
      
      if (!processResult.success || !processResult.value) {
        return {
          success: false,
          error: processResult.error
        };
      }
      
      const process = processResult.value;
      
      // Create checkpoint
      const checkpointId = uuidv4();
      const now = Date.now();
      const checkpoint: ProcessCheckpoint<TData> = {
        id: checkpointId,
        processId,
        state: process.state,
        data: process.data,
        createdAt: now,
        metadata: {
          version: process.version,
          processType: process.type,
          originalMetadata: { ...process.metadata }
        }
      };
      
      // Save the checkpoint
      this.checkpoints.set(checkpointId, checkpoint as ProcessCheckpoint<unknown>);
      
      // Update process metadata
      process.metadata = {
        ...process.metadata,
        latestCheckpoint: checkpointId
      };
      
      // Update the process
      this.processes.set(processId, process as ProcessInstance<string, unknown>);
      
      return { success: true, value: checkpoint };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to save checkpoint: ${String(error)}`)
      };
    }
  }
  
  /**
   * Restore a process from a checkpoint
   * @param processId The ID of the process to restore
   * @param checkpointId The ID of the checkpoint to restore from
   */
  public async restoreFromCheckpoint<TData, TState extends string>(
    processId: Identifier,
    checkpointId: Identifier
  ): Promise<Result<ProcessInstance<TState, TData>>> {
    try {
      // Get the checkpoint
      const checkpoint = this.checkpoints.get(checkpointId) as ProcessCheckpoint<TData>;
      
      if (!checkpoint) {
        return {
          success: false,
          error: new DomainError(`Checkpoint with ID ${checkpointId} not found`)
        };
      }
      
      // Check if the checkpoint belongs to this process
      if (checkpoint.processId !== processId) {
        return {
          success: false,
          error: new DomainError(`Checkpoint ${checkpointId} does not belong to process ${processId}`)
        };
      }
      
      // Get existing process
      const existingProcess = this.processes.get(processId);
      
      // Get the process type from the checkpoint metadata
      const processType = checkpoint.metadata?.processType as string;
      const version = checkpoint.metadata?.version as string;
      
      if (!processType) {
        return {
          success: false,
          error: new DomainError(`Checkpoint ${checkpointId} has invalid metadata: missing process type`)
        };
      }
      
      // Restore the process
      const now = Date.now();
      const process: ProcessInstance<TState, TData> = {
        id: processId,
        type: processType,
        state: checkpoint.state as TState,
        data: checkpoint.data,
        createdAt: existingProcess?.createdAt || now,
        updatedAt: now,
        version: version,
        recovery: {
          checkpointId,
          lastSavedAt: checkpoint.createdAt
        },
        metadata: {
          // First, restore original metadata from checkpoint if available
          ...(checkpoint.metadata?.originalMetadata || {}),
          // Then add restoration information
          restoredFrom: checkpointId,
          restoredAt: now
        }
      };
      
      // Update the process
      this.processes.set(processId, process as ProcessInstance<string, unknown>);
      
      return { success: true, value: process };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error
          ? error
          : new Error(`Failed to restore from checkpoint: ${String(error)}`)
      };
    }
  }
  
  /**
   * Get a process definition by type and optional version
   * @param processType The type of process to get
   * @param version Optional version
   */
  private getProcessDefinitionByType<TState extends string, TData>(
    processType: string,
    version?: string
  ): Result<ProcessDefinition<TState, TData>> {
    // Use the InMemoryProcessRegistry's method if it exists
    if ('getProcessDefinitionByType' in this.processRegistry) {
      return (this.processRegistry as InMemoryProcessRegistry)
        .getProcessDefinitionByType<TState, TData>(processType, version);
    }
    
    // Fallback: get the definition directly from the registry
    const processDefResult = this.processRegistry.getProcessDefinition<TState, TData>(processType);
    
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
 * Factory function to create a new ProcessManager
 */
export function createProcessManager(processRegistry: ProcessRegistry, taskExecutor: TaskExecutor): ProcessManager {
  return new InMemoryProcessManager(processRegistry, taskExecutor);
} 