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
import { ComponentType, SystemDefinition, WorkflowDefinition, ActorDefinition } from '../models/component.js';
import { createDefaultExtensionSystem } from './extension-system.js';
import { createDefaultEventBus } from './event-bus.js';

/**
 * Actor runtime interface for testing purposes
 */
export interface ActorRef {
  id: string;
  send: (messageType: string, payload: any) => Promise<any>;
  status: () => string;
  stop: () => Promise<void>;
  restart: () => Promise<void>;
}

/**
 * Actor system interface for testing purposes
 */
export interface ActorSystem {
  id: string;
  actors: ActorRef[];
  getActor: (actorId: string) => ActorRef;
  createActor: (actorId: string) => ActorRef;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  stopAll: () => Promise<void>;
  restartActor: (actorId: string) => Promise<void>;
  metrics: () => any;
  sendMessage: (actorId: string, messageType: string, payload: any) => Promise<any>;
}

/**
 * Adapter for integrating the DSL with the runtime
 */
export class RuntimeAdapter {
  private dsl: DSL;
  private systems: Map<string, ActorSystem>;

  constructor(dsl: DSL) {
    this.dsl = dsl;
    this.systems = new Map();
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
    
    // Use type assertion to access workflows since it might not be defined in the interface
    const workflows = (system as any).workflows; 
    if (workflows && Array.isArray(workflows)) {
      workflows.forEach((workflow: WorkflowDefinition) => {
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
   * Create an actor system from a system definition that contains actors
   * For testing purposes, this is a simplified version that doesn't use actual runtime
   */
  public createActorSystem(systemId: string, options: any = {}): ActorSystem {
    // Get system definition
    const systemDef = this.dsl.getComponentById(systemId) as SystemDefinition;
    if (!systemDef) {
      throw new Error(`System "${systemId}" not found`);
    }

    if (systemDef.type !== ComponentType.SYSTEM) {
      throw new Error(`Component "${systemId}" is not a system`);
    }

    // Check if system has actors
    if (!systemDef.components.actors || systemDef.components.actors.length === 0) {
      throw new Error(`System ${systemId} does not contain any actors`);
    }

    // Create actor references for each actor in the system
    const actorRefs: ActorRef[] = systemDef.components.actors.map(actorRef => {
      const actorId = actorRef.ref;
      const actorDef = this.dsl.getComponentById(actorId) as ActorDefinition;
      
      if (!actorDef) {
        throw new Error(`Actor "${actorId}" referenced in system "${systemId}" not found`);
      }

      return this.createActorRef(actorId, actorDef);
    });

    // Create the actor system
    const actorSystem: ActorSystem = {
      id: systemId,
      actors: actorRefs,
      
      getActor: (actorId: string): ActorRef => {
        const actor = actorRefs.find(a => a.id === actorId);
        if (!actor) {
          throw new Error(`Actor "${actorId}" not found in system "${systemId}"`);
        }
        return actor;
      },
      
      createActor: (actorId: string): ActorRef => {
        // Check if actor definition exists
        const actorDef = this.dsl.getComponentById(actorId) as ActorDefinition;
        if (!actorDef) {
          throw new Error(`Actor "${actorId}" not found`);
        }
        
        // Create actor reference
        const actorRef = this.createActorRef(actorId, actorDef);
        actorRefs.push(actorRef);
        
        return actorRef;
      },
      
      start: async (): Promise<void> => {
        // Start all actors
        for (const actor of actorRefs) {
          if (actor.status() === 'stopped') {
            await actor.restart();
          }
        }
      },
      
      stop: async (): Promise<void> => {
        // Stop all actors
        for (const actor of actorRefs) {
          if (actor.status() !== 'stopped') {
            await actor.stop();
          }
        }
      },
      
      stopAll: async (): Promise<void> => {
        await actorSystem.stop();
      },
      
      restartActor: async (actorId: string): Promise<void> => {
        const actor = actorSystem.getActor(actorId);
        await actor.restart();
      },
      
      metrics: (): any => {
        // Simple metrics for the actor system
        return {
          activeActors: actorRefs.filter(a => a.status() !== 'stopped').length,
          messagesProcessed: 0, // In a real implementation, we would track this
          deadLetters: 0        // In a real implementation, we would track this
        };
      },
      
      sendMessage: async (actorId: string, messageType: string, payload: any): Promise<any> => {
        try {
          const actor = actorSystem.getActor(actorId);
          return await actor.send(messageType, payload);
        } catch (err) {
          // In a real implementation, this would go to the dead letter queue
          if (options.monitoring?.deadLetters) {
            options.monitoring.deadLetters({
              target: actorId,
              message: messageType,
              payload,
              error: err
            });
          }
          throw err;
        }
      }
    };

    // Store the actor system
    this.systems.set(systemId, actorSystem);
    
    return actorSystem;
  }

  private createActorRef(actorId: string, actorDef: ActorDefinition): ActorRef {
    // Get actor implementation
    const actorImpl = this.dsl.getImplementation(actorId);
    
    if (!actorImpl) {
      throw new Error(`Implementation for actor "${actorId}" not found`);
    }
    
    // Actor state
    let actorStatus = 'idle';
    let actorContext: any = {};
    
    // Initialize actor state if state management is enabled
    if (actorDef.config?.stateManagement?.persistence) {
      actorContext.state = {};
    }
    
    // Create actor reference
    const actorRef: ActorRef = {
      id: actorId,
      
      send: async (messageType: string, payload: any): Promise<any> => {
        // Check if actor is stopped
        if (actorStatus === 'stopped') {
          throw new Error(`Cannot send message to actor "${actorId}" in stopped state`);
        }
        
        // Check if message handler exists
        if (!actorDef.messageHandlers[messageType]) {
          throw new Error(`Message handler '${messageType}' not defined in actor ${actorId}`);
        }
        
        if (!actorImpl[messageType]) {
          throw new Error(`Message handler '${messageType}' not implemented in actor ${actorId}`);
        }
        
        // Execute message handler
        try {
          const result = await actorImpl[messageType](payload, actorContext);
          return result;
        } catch (err) {
          // Set actor to failed state
          actorStatus = 'failed';
          throw err;
        }
      },
      
      status: (): string => {
        return actorStatus;
      },
      
      stop: async (): Promise<void> => {
        // Execute stop handler if it exists
        if (actorImpl._stop) {
          await actorImpl._stop(actorContext);
        }
        
        actorStatus = 'stopped';
      },
      
      restart: async (): Promise<void> => {
        // Execute restart handler if it exists
        if (actorImpl._start) {
          await actorImpl._start(actorContext);
        }
        
        actorStatus = 'idle';
      }
    };
    
    return actorRef;
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