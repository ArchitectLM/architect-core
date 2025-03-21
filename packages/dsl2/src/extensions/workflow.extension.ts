/**
 * Workflow extension for the DSL
 * 
 * Provides workflow functionality built on top of actors
 */
import { createExtension, defineExtension } from './index.js';
import { DSL } from '../core/dsl.js';
import { 
  ComponentType, 
  ActorDefinition,
  ActorImplementation
} from '../models/component.js';

/**
 * Workflow state interface
 */
export interface WorkflowState {
  description: string;
  transitions: WorkflowTransition[];
  final?: boolean;
}

/**
 * Workflow transition interface
 */
export interface WorkflowTransition {
  event: string;
  target: string;
  actor?: string;
  handler?: string;
  condition?: string;
  input?: {
    mapping: Record<string, string>;
  };
  output?: {
    mapping: Record<string, string>;
  };
}

/**
 * Workflow definition interface
 */
export interface WorkflowDefinition {
  id: string;
  type: ComponentType;
  description: string;
  version: string;
  initialState: string;
  states: Record<string, WorkflowState>;
}

/**
 * Workflow instance interface
 */
export interface WorkflowInstance {
  id: string;
  state: string;
  trigger: (event: string, data?: any) => Promise<{ state: string; data: any }>;
  getState: () => { state: string; data: any };
}

/**
 * Workflow extension options
 */
export interface WorkflowExtensionOptions {
  /**
   * Whether to enable strict validation mode
   */
  strictValidation?: boolean;
  
  /**
   * Default configuration for workflows
   */
  defaultConfig?: {
    maxTransitionTime?: number;
    errorHandling?: {
      retryCount: number;
      retryDelay: number;
    };
  };
}

/**
 * Workflow Extension API
 */
export interface WorkflowExtension {
  /**
   * Create a new workflow definition
   */
  createWorkflow(id: string, definition: Omit<WorkflowDefinition, 'id' | 'type'>): WorkflowDefinition;
  
  /**
   * Create a workflow instance
   */
  createWorkflowInstance(workflowId: string, initialData?: any): Promise<WorkflowInstance>;
}

/**
 * Setup function for the workflow extension
 */
export function setupWorkflowExtension(dsl: DSL, options: WorkflowExtensionOptions = {}): WorkflowExtension {
  // Default options
  const defaultOptions: WorkflowExtensionOptions = {
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
  const extension: WorkflowExtension = {
    createWorkflow(id: string, definition: Omit<WorkflowDefinition, 'id' | 'type'>): WorkflowDefinition {
      // Create full workflow definition
      const workflowDef: WorkflowDefinition = {
        id,
        type: ComponentType.WORKFLOW,
        ...definition
      };

      // Validate workflow definition
      validateWorkflowDefinition(workflowDef);

      // Register with DSL
      const workflow = dsl.component(id, {
        type: ComponentType.WORKFLOW,
        ...definition
      }) as WorkflowDefinition;
      
      // Create internal actor to handle workflow state and transitions
      const actorId = `${id}_Actor`;
      
      // Define message handlers for the internal actor
      const messageHandlers: Record<string, any> = {
        // Handler to start the workflow
        startWorkflow: {
          input: { type: 'object' },
          output: { 
            type: 'object',
            properties: {
              state: { type: 'string' },
              data: { type: 'object' }
            }
          }
        },
        // Handler to trigger workflow transitions
        triggerEvent: {
          input: { 
            type: 'object',
            properties: {
              event: { type: 'string', description: 'Event to trigger' },
              data: { type: 'object', description: 'Event data' }
            },
            required: ['event']
          },
          output: { 
            type: 'object',
            properties: {
              state: { type: 'string' },
              data: { type: 'object' }
            }
          }
        },
        // Handler to get current state
        getWorkflowState: {
          input: { type: 'object' },
          output: { 
            type: 'object',
            properties: {
              state: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      };
      
      // Define the internal actor
      const actorDef: ActorDefinition = dsl.component(actorId, {
        type: ComponentType.ACTOR,
        description: `Internal actor for workflow ${id}`,
        version: workflowDef.version,
        state: {
          type: 'object',
          properties: {
            currentState: { type: 'string', default: workflowDef.initialState },
            workflowData: { type: 'object' },
            history: { 
              type: 'array', 
              items: { 
                type: 'object',
                properties: {
                  from: { type: 'string' },
                  to: { type: 'string' },
                  event: { type: 'string' },
                  timestamp: { type: 'string' }
                }
              }
            }
          }
        },
        messageHandlers
      }) as ActorDefinition;
      
      // Implement the internal actor
      const actorImplementation: ActorImplementation = {
        // Start workflow implementation
        startWorkflow: async (input, context) => {
          // Initialize workflow state
          context.state = {
            currentState: workflowDef.initialState,
            workflowData: input || {},
            history: []
          };
          
          return {
            state: context.state.currentState,
            data: context.state.workflowData
          };
        },
        
        // Trigger event implementation
        triggerEvent: async (input, context) => {
          const { event, data = {} } = input;
          const currentState = context.state.currentState;
          
          // Find the state definition
          const stateDefinition = workflowDef.states[currentState];
          if (!stateDefinition) {
            throw new Error(`Invalid workflow state: ${currentState}`);
          }
          
          // Find matching transition for the event
          const transition = stateDefinition.transitions.find(t => t.event === event);
          if (!transition) {
            throw new Error(`No transition found for event ${event} in state ${currentState}`);
          }
          
          // If transition involves an actor, call the actor
          if (transition.actor && transition.handler) {
            try {
              // Prepare input data with mapping if defined
              let actorInput = { ...data };
              if (transition.input && transition.input.mapping) {
                actorInput = {};
                for (const [targetKey, sourceKey] of Object.entries(transition.input.mapping)) {
                  actorInput[targetKey] = context.state.workflowData[sourceKey];
                }
                // Merge with incoming data
                actorInput = { ...actorInput, ...data };
              }
              
              // Get the actor implementation
              const actorImpl = dsl.getImplementation(transition.actor);
              if (!actorImpl || typeof actorImpl[transition.handler] !== 'function') {
                throw new Error(`Actor ${transition.actor} or handler ${transition.handler} not found`);
              }
              
              // Call the actor handler
              const result = await actorImpl[transition.handler](actorInput, {});
              
              // Update workflow data based on output mapping if defined
              if (transition.output && transition.output.mapping) {
                for (const [targetKey, sourceKey] of Object.entries(transition.output.mapping)) {
                  context.state.workflowData[targetKey] = result[sourceKey];
                }
              } else {
                // Default mapping - merge all results
                context.state.workflowData = { ...context.state.workflowData, ...result };
              }
            } catch (error) {
              throw new Error(`Error executing actor ${transition.actor}.${transition.handler}: ${error.message}`);
            }
          }
          
          // Record transition in history
          context.state.history.push({
            from: currentState,
            to: transition.target,
            event,
            timestamp: new Date().toISOString()
          });
          
          // Update current state
          context.state.currentState = transition.target;
          
          // Return the new state and data
          return {
            state: context.state.currentState,
            data: context.state.workflowData
          };
        },
        
        // Get workflow state implementation
        getWorkflowState: async (input, context) => {
          return {
            state: context.state.currentState,
            data: context.state.workflowData
          };
        }
      };
      
      // Register actor implementation
      dsl.implement(actorId, actorImplementation);
      
      return workflow;
    },
    
    async createWorkflowInstance(workflowId: string, initialData?: any): Promise<WorkflowInstance> {
      // Get workflow definition
      const workflow = dsl.getComponent(workflowId) as WorkflowDefinition;
      if (!workflow || workflow.type !== ComponentType.WORKFLOW) {
        throw new Error(`Workflow ${workflowId} not found`);
      }
      
      // Get the internal actor implementation
      const actorId = `${workflowId}_Actor`;
      const actorImpl = dsl.getImplementation(actorId);
      if (!actorImpl) {
        throw new Error(`Workflow actor ${actorId} not found`);
      }
      
      // Create a new instance ID
      const instanceId = `${workflowId}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Initialize workflow state
      const context = { state: {} };
      await actorImpl.startWorkflow(initialData || {}, context);
      
      // Create and return a workflow instance
      return {
        id: instanceId,
        state: workflow.initialState,
        
        // Trigger method for workflow events
        trigger: async (event: string, data?: any) => {
          return actorImpl.triggerEvent({ event, data: data || {} }, context);
        },
        
        // Get current workflow state
        getState: () => {
          return {
            state: context.state.currentState,
            data: context.state.workflowData
          };
        }
      };
    }
  };

  // Create and register the extension
  const workflowExtension = createExtension('workflow', (dsl: DSL) => {
    // Add extension API to DSL instance
    (dsl as any).workflowExtension = extension;
    
    // Return the extension API
    return extension;
  });

  // Register the extension factory
  defineExtension('workflow', () => workflowExtension);

  return extension;
}

/**
 * Validate a workflow definition
 */
function validateWorkflowDefinition(workflow: WorkflowDefinition): void {
  if (!workflow.initialState) {
    throw new Error(`Workflow ${workflow.id} must define an initialState`);
  }
  
  if (!workflow.states || Object.keys(workflow.states).length === 0) {
    throw new Error(`Workflow ${workflow.id} must define at least one state`);
  }
  
  // Check that initial state exists
  if (!workflow.states[workflow.initialState]) {
    throw new Error(`Initial state ${workflow.initialState} not found in workflow states`);
  }
  
  // Validate each state
  let hasFinalState = false;
  
  for (const [stateId, state] of Object.entries(workflow.states)) {
    if (!state.description) {
      throw new Error(`State ${stateId} must have a description`);
    }
    
    // Check transitions
    if (!state.final && (!state.transitions || state.transitions.length === 0)) {
      throw new Error(`Non-final state ${stateId} must define at least one transition`);
    }
    
    // Validate transitions
    if (state.transitions) {
      for (const transition of state.transitions) {
        if (!transition.event) {
          throw new Error(`Transition in state ${stateId} must define an event`);
        }
        
        if (!transition.target) {
          throw new Error(`Transition for event ${transition.event} in state ${stateId} must define a target state`);
        }
        
        // Check that target state exists
        if (!workflow.states[transition.target]) {
          throw new Error(`Target state ${transition.target} not found in workflow states`);
        }
        
        // Validate actor and handler references
        if (transition.actor && !transition.handler) {
          throw new Error(`Transition for event ${transition.event} in state ${stateId} defines an actor but no handler`);
        }
        
        if (transition.handler && !transition.actor) {
          throw new Error(`Transition for event ${transition.event} in state ${stateId} defines a handler but no actor`);
        }
      }
    }
    
    if (state.final) {
      hasFinalState = true;
    }
  }
  
  // Ensure workflow has at least one final state
  if (!hasFinalState) {
    throw new Error(`Workflow ${workflow.id} must have at least one final state`);
  }
} 