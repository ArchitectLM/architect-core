/**
 * Runtime adapter for integrating the DSL with the core2 runtime
 */
import type { 
  ProcessDefinition, 
  TaskDefinition, 
  Runtime, 
  ExtensionSystem, 
  EventBus 
} from '@architectlm/core';

// Import the actual createRuntime function
import { createRuntime as createCore2Runtime } from '@architectlm/core';

import { DSL } from '../core/dsl.js';
import { ComponentType, SystemDefinition, WorkflowDefinition } from '../models/component.js';
import { createDefaultExtensionSystem } from './extension-system.js';
import { createDefaultEventBus } from './event-bus.js';

/**
 * Adapter for integrating the DSL with the runtime
 */
export class RuntimeAdapter {
  private dsl: DSL;

  constructor(dsl: DSL) {
    this.dsl = dsl;
  }

  /**
   * Get runtime configuration for a system
   */
  getRuntimeConfig(systemId: string): { 
    processDefinitions: Record<string, ProcessDefinition>;
    taskDefinitions: Record<string, TaskDefinition>;
  } {
    // Get the system definition
    const system = this.dsl.getComponent<SystemDefinition>(systemId);
    if (!system) {
      throw new Error(`System not found: ${systemId}`);
    }

    // Convert system workflows to process definitions
    const processDefinitions: Record<string, ProcessDefinition> = {};
    if (system.workflows) {
      system.workflows.forEach(workflow => {
        processDefinitions[workflow.name] = this.workflowToProcessDefinition(workflow);
      });
    }

    // Convert component implementations to task definitions
    const taskDefinitions: Record<string, TaskDefinition> = {};
    
    // Process commands
    if (system.components.commands) {
      system.components.commands.forEach(commandRef => {
        const command = this.dsl.getComponent(commandRef.ref);
        const implementation = this.dsl.getImplementation(commandRef.ref);
        
        if (command && implementation) {
          taskDefinitions[commandRef.ref] = this.commandToTaskDefinition(
            commandRef.ref, 
            command, 
            implementation
          );
        }
      });
    }

    return {
      processDefinitions,
      taskDefinitions
    };
  }

  /**
   * Create a runtime for a system
   */
  async createRuntime(
    systemId: string, 
    options: {
      extensionSystem?: ExtensionSystem;
      eventBus?: EventBus;
    } = {}
  ): Promise<Runtime> {
    // Get the runtime configuration
    const config = this.getRuntimeConfig(systemId);
    
    // Create or use provided extension system and event bus
    const extensionSystem = options.extensionSystem || createDefaultExtensionSystem();
    const eventBus = options.eventBus || createDefaultEventBus();
    
    // Create the runtime
    return createCore2Runtime(
      config.processDefinitions,
      config.taskDefinitions,
      { extensionSystem, eventBus }
    );
  }

  /**
   * Execute a command through the runtime
   */
  async executeCommand(runtime: Runtime, commandId: string, input: any): Promise<any> {
    return runtime.executeTask(commandId, input);
  }

  /**
   * Start a workflow process
   */
  async startWorkflow(runtime: Runtime, workflowId: string, data: any): Promise<any> {
    return runtime.createProcess(workflowId, data);
  }

  /**
   * Convert a workflow definition to a process definition
   */
  private workflowToProcessDefinition(workflow: WorkflowDefinition): ProcessDefinition {
    return {
      id: workflow.name,
      name: workflow.name,
      description: workflow.description,
      initialState: workflow.initialState,
      transitions: workflow.transitions
    };
  }

  /**
   * Convert a command and its implementation to a task definition
   */
  private commandToTaskDefinition(
    id: string,
    command: any,
    implementation: any
  ): TaskDefinition {
    return {
      id,
      name: command.id || id,
      description: command.description,
      handler: async (context: any) => {
        try {
          // Execute the implementation handler
          return await implementation.handler(context.input, context);
        } catch (error) {
          // Handle errors
          console.error(`Error executing task ${id}:`, error);
          throw error;
        }
      }
    };
  }
} 