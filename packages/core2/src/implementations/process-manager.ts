import { v4 as uuidv4 } from 'uuid';
import {
  ProcessCheckpoint,
  ProcessDefinition,
  ProcessInstance,
  ProcessManager,
  ProcessRegistry,
  ProcessTransition
} from '../models/process-system';
import {
  DomainError,
  Identifier,
  Metadata,
  Result,
  Timestamp
} from '../models/core-types';
import { TaskExecutor } from '../models/task-system';

/**
 * SimpleProcessRegistry interface for getProcessDefinitionByType
 */
interface SimpleProcessRegistry extends ProcessRegistry {
  getProcessDefinitionByType(processType: string, version?: string): ProcessDefinition | undefined;
}

/**
 * Simple implementation of ProcessManager
 */
export class SimpleProcessManager implements ProcessManager {
  private processRegistry: ProcessRegistry;
  private taskExecutor: TaskExecutor;
  private processes = new Map<Identifier, ProcessInstance<string, unknown>>();
  private checkpoints = new Map<Identifier, ProcessCheckpoint<unknown>>();
  
  /**
   * Create a new SimpleProcessManager
   * @param processRegistry Registry of process definitions
   * @param taskExecutor Executor for running tasks
   */
  constructor(processRegistry: ProcessRegistry, taskExecutor: TaskExecutor) {
    this.processRegistry = processRegistry;
    this.taskExecutor = taskExecutor;
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
      const definitionResult = this.getProcessDefinitionByType(processType, options.version);
      
      if (!definitionResult.success) {
        return definitionResult;
      }
      
      const definition = definitionResult.value;
      
      // Validate the initial state exists in the definition
      if (!definition.initialState) {
        return {
          success: false,
          error: new DomainError(
            `Process definition ${definition.id} does not have an initial state`,
            { 
              processType,
              definitionId: definition.id 
            }
          )
        };
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
          error: new DomainError(
            `Process with ID ${processId} not found`,
            { processId }
          )
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
      
      if (!processResult.success) {
        return processResult;
      }
      
      const process = processResult.value;
      
      // Get the process definition
      const definitionResult = this.processRegistry.getProcessDefinition<TState, TData>(
        process.type
      );
      
      if (!definitionResult.success) {
        return {
          success: false,
          error: new DomainError(
            `Process definition for type ${process.type} not found`,
            { 
              processId,
              processType: process.type 
            }
          )
        };
      }
      
      const definition = definitionResult.value;
      
      // Find the transition for this event
      const transition = definition.transitions.find(t => 
        t.from === process.state && t.on === eventType
      );
      
      if (!transition) {
        return {
          success: false,
          error: new DomainError(
            `No transition found for event ${eventType} from state ${process.state}`,
            { 
              processId,
              currentState: process.state,
              eventType 
            }
          )
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
   * Save a process checkpoint for later recovery
   * @param processId The ID of the process to checkpoint
   */
  public async saveCheckpoint<TData>(
    processId: Identifier
  ): Promise<Result<ProcessCheckpoint<TData>>> {
    try {
      const processResult = await this.getProcess<TData, string>(processId);
      
      if (!processResult.success) {
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
          processType: process.type
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
          error: new DomainError(
            `Checkpoint with ID ${checkpointId} not found`,
            { checkpointId }
          )
        };
      }
      
      // Get existing process
      const existingProcess = this.processes.get(processId);
      
      // Get the process type from the checkpoint metadata
      const processType = checkpoint.metadata?.processType as string || '';
      const version = checkpoint.metadata?.version as string;
      
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
          ...(existingProcess?.metadata || {}),
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
    // Use the SimpleProcessRegistry's method if it exists
    if ('getProcessDefinitionByType' in this.processRegistry) {
      const definition = (this.processRegistry as SimpleProcessRegistry)
        .getProcessDefinitionByType(processType, version);
      
      if (!definition) {
        return {
          success: false,
          error: new DomainError(
            `Process definition for type ${processType} not found`,
            { 
              processType,
              version 
            }
          )
        };
      }
      
      return { 
        success: true, 
        value: definition as ProcessDefinition<TState, TData> 
      };
    }
    
    // Fallback: search through all definitions
    const definitions = this.processRegistry.getAllProcessDefinitions()
      .filter(def => def.name === processType);
    
    if (definitions.length === 0) {
      return {
        success: false,
        error: new DomainError(
          `Process definition for type ${processType} not found`,
          { 
            processType,
            version 
          }
        )
      };
    }
    
    if (version) {
      const versionedDef = definitions.find(def => def.version === version);
      
      if (!versionedDef) {
        return {
          success: false,
          error: new DomainError(
            `Process definition for type ${processType} version ${version} not found`,
            { 
              processType,
              version 
            }
          )
        };
      }
      
      return { 
        success: true, 
        value: versionedDef as ProcessDefinition<TState, TData> 
      };
    }
    
    // Sort by version, descending
    const sorted = [...definitions].sort((a, b) => {
      const vA = a.version || '0.0.0';
      const vB = b.version || '0.0.0';
      
      return vB.localeCompare(vA);
    });
    
    return { 
      success: true, 
      value: sorted[0] as ProcessDefinition<TState, TData> 
    };
  }
}

/**
 * Factory function to create a new ProcessManager
 */
export function createProcessManager(processRegistry: ProcessRegistry, taskExecutor: TaskExecutor): ProcessManager {
  return new SimpleProcessManager(processRegistry, taskExecutor);
} 