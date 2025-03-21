/**
 * Saga Actor Extension for the DSL
 * 
 * Provides saga pattern functionality built on top of actors
 */
import { createExtension, defineExtension } from './index.js';
import { DSL } from '../core/dsl.js';
import { 
  ComponentType, 
  ActorDefinition,
  ActorImplementation
} from '../models/component.js';

/**
 * Compensation strategy enum
 */
export enum CompensationStrategy {
  /**
   * Compensate steps in reverse order
   */
  BACKWARD = 'backward',
  
  /**
   * Compensate all steps in parallel
   */
  PARALLEL = 'parallel'
}

/**
 * Saga step interface
 */
export interface SagaStep {
  name: string;
  actor: string;
  handler: string;
  compensation: {
    actor: string;
    handler: string;
    input?: {
      mapping: Record<string, string>;
    };
  };
  input?: {
    mapping: Record<string, string>;
  };
  output?: {
    mapping: Record<string, string>;
  };
}

/**
 * Saga definition interface
 */
export interface SagaDefinition {
  id: string;
  type: ComponentType;
  description: string;
  version: string;
  correlationProperty: string;
  steps: SagaStep[];
  compensationStrategy?: CompensationStrategy;
}

/**
 * Saga instance interface
 */
export interface SagaInstance {
  id: string;
  status: 'new' | 'running' | 'completed' | 'failed';
  execute: (data?: any) => Promise<SagaExecutionResult>;
  getState: () => { status: string; data: any };
}

/**
 * Saga execution result interface
 */
export interface SagaExecutionResult {
  sagaId: string;
  status: 'completed' | 'failed';
  steps?: SagaStepResult[];
  error?: string;
  data: Record<string, any>;
}

/**
 * Saga step result interface
 */
export interface SagaStepResult {
  name: string;
  status: 'completed' | 'failed' | 'compensated';
  result?: any;
  error?: string;
}

/**
 * Saga actor extension options
 */
export interface SagaActorExtensionOptions {
  /**
   * Whether to enable transaction logging
   */
  enableTransactionLogging?: boolean;
  
  /**
   * Default compensation strategy
   */
  defaultCompensationStrategy?: CompensationStrategy;
}

/**
 * Saga Actor Extension API
 */
export interface SagaActorExtension {
  /**
   * Create a new saga definition
   */
  createSaga(id: string, definition: Omit<SagaDefinition, 'id' | 'type'>): SagaDefinition;
  
  /**
   * Start a new saga instance
   */
  startSaga(sagaId: string, initialData?: any): Promise<SagaInstance>;
}

/**
 * Setup function for the saga actor extension
 */
export function setupSagaActorExtension(dsl: DSL, options: SagaActorExtensionOptions = {}): SagaActorExtension {
  // Default options
  const defaultOptions: SagaActorExtensionOptions = {
    enableTransactionLogging: true,
    defaultCompensationStrategy: CompensationStrategy.BACKWARD
  };

  // Merge options
  const config = { ...defaultOptions, ...options };

  // Create the extension API
  const extension: SagaActorExtension = {
    createSaga(id: string, definition: Omit<SagaDefinition, 'id' | 'type'>): SagaDefinition {
      // Create full saga definition
      const sagaDef: SagaDefinition = {
        id,
        type: ComponentType.SAGA,
        compensationStrategy: config.defaultCompensationStrategy,
        ...definition
      };

      // Validate saga definition
      validateSagaDefinition(sagaDef);

      // Register with DSL
      const saga = dsl.component(id, {
        type: ComponentType.SAGA,
        compensationStrategy: config.defaultCompensationStrategy,
        ...definition
      }) as SagaDefinition;
      
      // Create internal actor to handle saga coordination
      const actorId = `${id}_Actor`;
      
      // Define message handlers for the internal actor
      const messageHandlers: Record<string, any> = {
        // Handler to start the saga
        startSaga: {
          input: { type: 'object' },
          output: { 
            type: 'object',
            properties: {
              sagaId: { type: 'string' },
              status: { type: 'string' }
            }
          }
        },
        // Handler to execute the saga
        executeSaga: {
          input: { 
            type: 'object'
          },
          output: { 
            type: 'object',
            properties: {
              sagaId: { type: 'string' },
              status: { type: 'string' },
              steps: { type: 'array' },
              data: { type: 'object' }
            }
          }
        },
        // Handler to get current saga state
        getSagaState: {
          input: { type: 'object' },
          output: { 
            type: 'object',
            properties: {
              status: { type: 'string' },
              data: { type: 'object' }
            }
          }
        }
      };
      
      // Define the internal actor
      const actorDef: ActorDefinition = dsl.component(actorId, {
        type: ComponentType.ACTOR,
        description: `Internal actor for saga ${id}`,
        version: sagaDef.version,
        state: {
          type: 'object',
          properties: {
            sagaId: { type: 'string' },
            status: { type: 'string', default: 'new' },
            sagaData: { type: 'object' },
            completedSteps: { type: 'array', items: { type: 'string' } },
            stepResults: { type: 'object' },
            error: { type: 'string' }
          }
        },
        messageHandlers
      }) as ActorDefinition;
      
      // Implement the internal actor
      const actorImplementation: ActorImplementation = {
        // Start saga implementation
        startSaga: async (input, context) => {
          // Generate a unique saga ID
          const sagaId = `${id}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
          
          // Initialize saga state
          context.state = {
            sagaId,
            status: 'new',
            sagaData: input || {},
            completedSteps: [],
            stepResults: {}
          };
          
          return {
            sagaId: context.state.sagaId,
            status: context.state.status
          };
        },
        
        // Execute saga implementation
        executeSaga: async (input, context) => {
          try {
            // Update saga state to running
            context.state.status = 'running';
            
            // Update saga data with input if provided
            if (input && Object.keys(input).length > 0) {
              context.state.sagaData = { ...context.state.sagaData, ...input };
            }
            
            // Execute each step in sequence
            const stepResults: SagaStepResult[] = [];
            
            for (const step of sagaDef.steps) {
              try {
                // Prepare input data with mapping if defined
                let stepInput = { ...context.state.sagaData };
                if (step.input && step.input.mapping) {
                  const mappedInput = {};
                  for (const [targetKey, sourceKey] of Object.entries(step.input.mapping)) {
                    mappedInput[targetKey] = context.state.sagaData[sourceKey];
                  }
                  stepInput = mappedInput;
                }
                
                // Get the actor implementation
                const actorImpl = dsl.getImplementation(step.actor);
                if (!actorImpl || typeof actorImpl[step.handler] !== 'function') {
                  throw new Error(`Actor ${step.actor} or handler ${step.handler} not found`);
                }
                
                // Call the actor handler
                const stepResult = await actorImpl[step.handler](stepInput, {});
                
                // Update saga data based on output mapping if defined
                if (step.output && step.output.mapping) {
                  for (const [targetKey, sourceKey] of Object.entries(step.output.mapping)) {
                    context.state.sagaData[targetKey] = stepResult[sourceKey];
                  }
                } else {
                  // Default mapping - merge all results
                  context.state.sagaData = { ...context.state.sagaData, ...stepResult };
                }
                
                // Record successful step
                context.state.completedSteps.push(step.name);
                context.state.stepResults[step.name] = stepResult;
                
                // Add to results
                stepResults.push({
                  name: step.name,
                  status: 'completed',
                  result: stepResult
                });
              } catch (error) {
                // Step failed, need to compensate
                stepResults.push({
                  name: step.name,
                  status: 'failed',
                  error: error.message
                });
                
                // Perform compensation based on strategy
                await performCompensation(
                  dsl, 
                  sagaDef, 
                  context.state.completedSteps,
                  context.state.stepResults,
                  context.state.sagaData
                );
                
                // Update completed steps with compensation status
                for (const completedStep of context.state.completedSteps) {
                  const resultIndex = stepResults.findIndex(r => r.name === completedStep);
                  if (resultIndex >= 0) {
                    stepResults[resultIndex].status = 'compensated';
                  }
                }
                
                // Update saga state
                context.state.status = 'failed';
                context.state.error = error.message;
                
                // Return failed result
                return {
                  sagaId: context.state.sagaId,
                  status: 'failed',
                  error: error.message,
                  steps: stepResults,
                  data: context.state.sagaData
                };
              }
            }
            
            // All steps completed successfully
            context.state.status = 'completed';
            
            return {
              sagaId: context.state.sagaId,
              status: 'completed',
              steps: stepResults,
              data: context.state.sagaData
            };
          } catch (error) {
            // Saga execution failed with unexpected error
            context.state.status = 'failed';
            context.state.error = `Unexpected error: ${error.message}`;
            
            return {
              sagaId: context.state.sagaId,
              status: 'failed',
              error: context.state.error,
              data: context.state.sagaData
            };
          }
        },
        
        // Get saga state implementation
        getSagaState: async (input, context) => {
          return {
            status: context.state.status,
            data: context.state.sagaData
          };
        }
      };
      
      // Register actor implementation
      dsl.implement(actorId, actorImplementation);
      
      return saga;
    },
    
    async startSaga(sagaId: string, initialData?: any): Promise<SagaInstance> {
      // Get saga definition
      const saga = dsl.getComponent(sagaId) as SagaDefinition;
      if (!saga || saga.type !== ComponentType.SAGA) {
        throw new Error(`Saga ${sagaId} not found`);
      }
      
      // Get the internal actor implementation
      const actorId = `${sagaId}_Actor`;
      const actorImpl = dsl.getImplementation(actorId);
      if (!actorImpl) {
        throw new Error(`Saga actor ${actorId} not found`);
      }
      
      // Initialize saga state
      const context = { state: {} };
      const startResult = await actorImpl.startSaga(initialData || {}, context);
      
      // Create and return a saga instance
      return {
        id: startResult.sagaId,
        status: 'new',
        
        // Execute method for saga
        execute: async (data?: any) => {
          return actorImpl.executeSaga(data || {}, context);
        },
        
        // Get current saga state
        getState: () => {
          return {
            status: context.state.status,
            data: context.state.sagaData
          };
        }
      };
    }
  };

  // Create and register the extension
  const sagaActorExtension = createExtension('saga-actor', (dsl: DSL) => {
    // Add extension API to DSL instance
    (dsl as any).sagaActorExtension = extension;
    
    // Return the extension API
    return extension;
  });

  // Register the extension factory
  defineExtension('saga-actor', () => sagaActorExtension);

  return extension;
}

/**
 * Validate a saga definition
 */
function validateSagaDefinition(saga: SagaDefinition): void {
  if (!saga.correlationProperty) {
    throw new Error(`Saga ${saga.id} must define a correlationProperty`);
  }
  
  if (!saga.steps || saga.steps.length === 0) {
    throw new Error(`Saga ${saga.id} must define at least one step`);
  }
  
  // Validate each step
  for (const [index, step] of saga.steps.entries()) {
    if (!step.name) {
      throw new Error(`Step ${index} must have a name`);
    }
    
    if (!step.actor) {
      throw new Error(`Step ${step.name} must define an actor`);
    }
    
    if (!step.handler) {
      throw new Error(`Step ${step.name} must define a handler`);
    }
    
    // Validate compensation
    if (!step.compensation) {
      throw new Error(`Step ${step.name} must define compensation`);
    }
    
    if (!step.compensation.actor) {
      throw new Error(`Compensation for step ${step.name} must define an actor`);
    }
    
    if (!step.compensation.handler) {
      throw new Error(`Compensation for step ${step.name} must define a handler`);
    }
  }
}

/**
 * Perform compensation for a failed saga
 */
async function performCompensation(
  dsl: DSL,
  saga: SagaDefinition,
  completedSteps: string[],
  stepResults: Record<string, any>,
  sagaData: Record<string, any>
): Promise<void> {
  // Get steps that need compensation
  const stepsToCompensate = [...completedSteps].reverse();
  
  // Handle different compensation strategies
  if (saga.compensationStrategy === CompensationStrategy.PARALLEL) {
    // Compensate all steps in parallel
    await Promise.all(stepsToCompensate.map(stepName => 
      compensateStep(dsl, saga, stepName, stepResults, sagaData)
    ));
  } else {
    // Default: compensate steps in reverse order
    for (const stepName of stepsToCompensate) {
      await compensateStep(dsl, saga, stepName, stepResults, sagaData);
    }
  }
}

/**
 * Compensate a single saga step
 */
async function compensateStep(
  dsl: DSL,
  saga: SagaDefinition,
  stepName: string,
  stepResults: Record<string, any>,
  sagaData: Record<string, any>
): Promise<void> {
  // Find the step definition
  const step = saga.steps.find(s => s.name === stepName);
  if (!step) {
    throw new Error(`Step ${stepName} not found in saga definition`);
  }
  
  // Get the step result
  const stepResult = stepResults[stepName];
  if (!stepResult) {
    throw new Error(`No result found for step ${stepName}`);
  }
  
  // Get the compensation actor and handler
  const actorImpl = dsl.getImplementation(step.compensation.actor);
  if (!actorImpl || typeof actorImpl[step.compensation.handler] !== 'function') {
    throw new Error(`Compensation actor ${step.compensation.actor} or handler ${step.compensation.handler} not found`);
  }
  
  // Prepare compensation input
  let compensationInput = { ...sagaData };
  
  // If compensation has input mapping
  if (step.compensation.input && step.compensation.input.mapping) {
    const mappedInput = {};
    for (const [targetKey, sourceKey] of Object.entries(step.compensation.input.mapping)) {
      mappedInput[targetKey] = sagaData[sourceKey];
    }
    compensationInput = mappedInput;
  }
  
  // Execute compensation
  try {
    await actorImpl[step.compensation.handler](compensationInput, {});
  } catch (error) {
    // Log compensation error but continue with other compensations
    console.error(`Compensation failed for step ${stepName}: ${error.message}`);
  }
} 