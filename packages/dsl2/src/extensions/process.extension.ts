/**
 * Process extension for the DSL
 * 
 * Provides process-specific functionality and validation
 */
import { createExtension, defineExtension } from './index.js';
import { DSL } from '../core/dsl.js';
import { 
  ComponentType, 
  ProcessDefinition,
  ProcessState,
  ActorMessageAction,
  ProcessActionBase
} from '../models/component.js';

/**
 * Process extension options
 */
export interface ProcessExtensionOptions {
  /**
   * Whether to enable strict validation mode
   */
  strictValidation?: boolean;
  
  /**
   * Default configuration for processes
   */
  defaultConfig?: {
    maxTransitionTime?: number;
    errorHandling?: {
      retryCount: number;
      retryDelay: number;
    };
  };

  enablePersistence?: boolean;
  historySize?: number;
  autoValidateTransitions?: boolean;
}

/**
 * Process state handler type
 */
export type ProcessStateHandler = (context: any) => Promise<{ event: string; [key: string]: any }>;

/**
 * Process state handlers implementation
 */
export interface ProcessStateHandlers {
  [state: string]: ProcessStateHandler;
}

/**
 * Process Extension API
 */
export interface ProcessExtension {
  /**
   * Create a new process definition
   */
  createProcess(id: string, definition: Omit<ProcessDefinition, 'id' | 'type'>): ProcessDefinition;
  
  /**
   * Implement process state handlers
   */
  implementStateHandlers(processId: string, handlers: ProcessStateHandlers): void;
}

/**
 * Setup function for the process extension
 */
export function setupProcessExtension(dsl: DSL, options: ProcessExtensionOptions = {}): ProcessExtension {
  // Default options
  const defaultOptions: ProcessExtensionOptions = {
    strictValidation: false,
    defaultConfig: {
      maxTransitionTime: 30000,
      errorHandling: {
        retryCount: 3,
        retryDelay: 1000
      }
    }
  };

  // Merge options
  const config = { ...defaultOptions, ...options };

  // Create the extension API
  const extension: ProcessExtension = {
    createProcess(id: string, definition: Omit<ProcessDefinition, 'id' | 'type'>): ProcessDefinition {
      // Create full process definition
      const processDef: ProcessDefinition = {
        id,
        type: ComponentType.PROCESS,
        ...definition
      };

      // Validate process definition
      validateProcessDefinition(processDef);

      // Register with DSL
      return dsl.component<ProcessDefinition>(id, {
        type: ComponentType.PROCESS,
        ...definition
      });
    },

    implementStateHandlers(processId: string, handlers: ProcessStateHandlers): void {
      // Get process definition
      const processDef = dsl.getComponent<ProcessDefinition>(processId);
      if (!processDef) {
        throw new Error(`Process ${processId} not found`);
      }

      // Validate handlers against process states
      validateStateHandlers(processDef, handlers);

      // Convert state handlers to actor implementation
      const implementation = createActorImplementation(processDef, handlers);

      // Register implementation with DSL
      dsl.implementActor(processId, implementation);
    }
  };

  // Create and register the extension
  const processExtension = createExtension('process', (dsl: DSL) => {
    // Add extension API to DSL instance
    (dsl as any).processExtension = extension;
    
    // Return the extension API
    return extension;
  });

  // Register the extension factory
  defineExtension('process', () => processExtension);

  return extension;
}

/**
 * Validate a process definition
 */
function validateProcessDefinition(process: ProcessDefinition): void {
  if (!process.states || Object.keys(process.states).length === 0) {
    throw new Error(`Process ${process.id} must define at least one state`);
  }

  // Validate each state
  const stateIds = Object.keys(process.states);
  let hasFinalState = false;

  for (const [stateId, state] of Object.entries(process.states)) {
    validateState(process.id, stateId, state, stateIds);
    if (state.final) {
      hasFinalState = true;
    }
  }

  // Ensure at least one final state
  if (!hasFinalState) {
    throw new Error(`Process ${process.id} must have at least one final state`);
  }
}

/**
 * Validate a process state
 */
function validateState(processId: string, stateId: string, state: ProcessState, validStateIds: string[]): void {
  if (!state.description) {
    throw new Error(`State ${stateId} in process ${processId} must have a description`);
  }

  // Validate actions if present
  if (state.actions) {
    state.actions.forEach((action, index) => {
      validateAction(processId, stateId, action, index);
    });
  }

  // Validate transitions if present and not a final state
  if (state.transitions && !state.final) {
    state.transitions.forEach((transition, index) => {
      if (!transition.to) {
        throw new Error(`Transition ${index} in state ${stateId} must specify target state`);
      }
      if (!validStateIds.includes(transition.to)) {
        throw new Error(`State ${stateId} in process ${processId} has transition to undefined state: ${transition.to}`);
      }
    });
  }
}

/**
 * Validate a process action
 */
function validateAction(processId: string, stateId: string, action: ProcessActionBase, index: number): void {
  if (!action.type) {
    throw new Error(`Action ${index} in state ${stateId} must have a type`);
  }

  if (action.type === 'actorMessage') {
    const msgAction = action as ActorMessageAction;
    if (!msgAction.actor) {
      throw new Error(`Actor message action in state ${stateId} must specify actor`);
    }
    if (!msgAction.message) {
      throw new Error(`Actor message action in state ${stateId} must specify message`);
    }
  }
}

/**
 * Validate process state handlers
 */
function validateStateHandlers(process: ProcessDefinition, handlers: ProcessStateHandlers): void {
  // Check for handlers for non-existent states
  const validStateIds = Object.keys(process.states);
  const handlerStateIds = Object.keys(handlers);

  const invalidStates = handlerStateIds.filter(id => !validStateIds.includes(id));
  if (invalidStates.length > 0) {
    throw new Error(`Process ${process.id} has handlers for non-existent states: ${invalidStates.join(', ')}`);
  }

  // Non-final states should have handlers
  const nonFinalStates = validStateIds.filter(id => !process.states[id].final);
  const missingHandlers = nonFinalStates.filter(id => !handlers[id]);
  if (missingHandlers.length > 0) {
    throw new Error(`Process ${process.id} is missing handlers for states: ${missingHandlers.join(', ')}`);
  }
}

/**
 * Create an actor implementation from state handlers
 */
function createActorImplementation(process: ProcessDefinition, handlers: ProcessStateHandlers): any {
  return {
    execute: async (input: any, context: any) => {
      const currentState = input.state || 'initial';
      const state = process.states[currentState];
      
      if (!state) {
        throw new Error(`Invalid state: ${currentState}`);
      }

      if (state.final) {
        return { state: currentState, completed: true };
      }

      const handler = handlers[currentState];
      if (!handler) {
        throw new Error(`No handler for state: ${currentState}`);
      }

      // Execute state handler
      const result = await handler(context);

      // Find matching transition
      const transition = state.transitions?.find(t => t.on === result.event);
      if (!transition) {
        throw new Error(`No transition found for event: ${result.event}`);
      }

      return {
        state: transition.to,
        event: result.event,
        data: result
      };
    }
  };
}

export interface ProcessState {
  name: string;
  description?: string;
  transitions?: ProcessTransition[];
  onEnter?: ProcessAction;
  onExit?: ProcessAction;
  final?: boolean;
}

export interface ProcessTransition {
  to: string;
  on: string;
  guard?: ProcessGuard;
  action?: ProcessAction;
}

export interface ProcessGuard {
  condition: string | ((context: any) => boolean);
}

export interface ProcessAction {
  task?: string;
  script?: string | ((context: any) => Promise<void>);
} 