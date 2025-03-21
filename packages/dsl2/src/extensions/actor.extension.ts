/**
 * Actor extension for the DSL
 * 
 * Provides actor-specific functionality and validation
 */
import { createExtension, defineExtension } from './index.js';
import { DSL } from '../core/dsl.js';
import { 
  ComponentType, 
  ActorDefinition, 
  ActorImplementation,
  ActorContext,
  MessageHandlerDefinition,
  FlowBuilder
} from '../models/component.js';
import { createFlowBuilder } from './flow-builder.js';

/**
 * Actor extension options
 */
export interface ActorExtensionOptions {
  /**
   * Whether to enable strict validation mode
   */
  strictValidation?: boolean;
  
  /**
   * Default configuration for actors
   */
  defaultConfig?: {
    backpressure?: {
      strategy: 'drop' | 'buffer' | 'throttle';
      maxMailboxSize: number;
    };
    supervision?: {
      maxRetries: number;
      backoffStrategy: 'linear' | 'exponential';
      resetTimeout: number;
    };
  };
}

/**
 * Actor Extension API
 */
export interface ActorExtension {
  /**
   * Create a new actor definition
   */
  createActor(id: string, definition: Omit<ActorDefinition, 'id' | 'type'>): ActorDefinition;
  
  /**
   * Implement an actor's message handlers
   */
  implementActor(actorId: string, implementation: ActorImplementation): void;
  
  /**
   * Create a flow builder for the given context
   */
  createFlow(context: ActorContext): FlowBuilder;
}

/**
 * Setup function for the actor extension
 */
export function setupActorExtension(dsl: DSL, options: ActorExtensionOptions = {}): ActorExtension {
  // Default options
  const defaultOptions: ActorExtensionOptions = {
    strictValidation: false,
    defaultConfig: {
      backpressure: {
        strategy: 'buffer',
        maxMailboxSize: 1000
      },
      supervision: {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        resetTimeout: 5000
      }
    }
  };

  // Merge options
  const config = { ...defaultOptions, ...options };

  // Create the extension API
  const extension: ActorExtension = {
    createActor(id: string, definition: Omit<ActorDefinition, 'id' | 'type'>): ActorDefinition {
      // Create full actor definition
      const actorDef: ActorDefinition = {
        id,
        type: ComponentType.ACTOR,
        ...definition
      };

      // Validate actor definition
      validateActorDefinition(actorDef);

      // Register with DSL
      return dsl.component<ActorDefinition>(id, {
        type: ComponentType.ACTOR,
        ...definition
      });
    },

    implementActor(actorId: string, implementation: ActorImplementation): void {
      // Get actor definition
      const actorDef = dsl.getComponent<ActorDefinition>(actorId);
      if (!actorDef) {
        throw new Error(`Actor ${actorId} not found`);
      }

      // Validate implementation against definition
      validateActorImplementation(actorDef, implementation);

      // Create wrapped implementation with enhanced context
      const wrappedImplementation: ActorImplementation = {};
      
      for (const [handlerName, handler] of Object.entries(implementation)) {
        wrappedImplementation[handlerName] = async (input: any, context: ActorContext) => {
          // Add flow builder to context
          const enhancedContext: ActorContext = {
            ...context,
            flow: () => extension.createFlow(context)
          };
          
          // If this actor uses state and context doesn't have state yet
          if (actorDef.config?.stateManagement?.persistence && !enhancedContext.state) {
            enhancedContext.state = {};
          }
          
          return handler(input, enhancedContext);
        };
      }

      // Register implementation with DSL
      dsl.implement(actorId, wrappedImplementation.execute);
    },

    createFlow(context: ActorContext): FlowBuilder {
      return createFlowBuilder(dsl, context);
    }
  };

  // Create and register the extension
  const actorExtension = createExtension('actor', (dsl: DSL) => {
    // Add extension API to DSL instance
    (dsl as any).actorExtension = extension;
    
    // Return the extension API
    return extension;
  });

  // Register the extension factory
  defineExtension('actor', () => actorExtension);

  return extension;
}

/**
 * Validate an actor definition
 */
function validateActorDefinition(actor: ActorDefinition): void {
  if (!actor.messageHandlers || Object.keys(actor.messageHandlers).length === 0) {
    throw new Error(`Actor ${actor.id} must define at least one message handler`);
  }

  // Validate each message handler
  Object.entries(actor.messageHandlers).forEach(([name, handler]) => {
    validateMessageHandler(actor.id, name, handler);
  });

  // Validate tests if present
  if (actor.tests) {
    validateActorTests(actor);
  }
}

/**
 * Validate a message handler definition
 */
function validateMessageHandler(actorId: string, name: string, handler: MessageHandlerDefinition): void {
  if (!handler.description) {
    throw new Error(`Message handler ${name} in actor ${actorId} must have a description`);
  }

  if (!handler.input) {
    throw new Error(`Message handler ${name} in actor ${actorId} must define input schema`);
  }

  if (!handler.output) {
    throw new Error(`Message handler ${name} in actor ${actorId} must define output schema`);
  }
}

/**
 * Validate actor tests
 */
function validateActorTests(actor: ActorDefinition): void {
  if (!actor.tests) return;

  // Validate interface tests
  if (actor.tests.interface) {
    for (const test of actor.tests.interface) {
      if (!actor.messageHandlers[test.messageHandler]) {
        throw new Error(`Interface test "${test.name}" in actor ${actor.id} references non-existent message handler: ${test.messageHandler}`);
      }
    }
  }

  // Validate implementation tests
  if (actor.tests.implementation) {
    for (const test of actor.tests.implementation) {
      if (!actor.messageHandlers[test.messageHandler]) {
        throw new Error(`Implementation test "${test.name}" in actor ${actor.id} references non-existent message handler: ${test.messageHandler}`);
      }
    }
  }
}

/**
 * Validate an actor implementation
 */
function validateActorImplementation(actor: ActorDefinition, implementation: ActorImplementation): void {
  // Check for missing handlers
  const definedHandlers = Object.keys(actor.messageHandlers);
  const implementedHandlers = Object.keys(implementation);

  const missingHandlers = definedHandlers.filter(h => !implementedHandlers.includes(h));
  if (missingHandlers.length > 0) {
    throw new Error(`Actor implementation for ${actor.id} is missing handlers: ${missingHandlers.join(', ')}`);
  }

  // Check for extra handlers (excluding lifecycle methods)
  const extraHandlers = implementedHandlers
    .filter(h => !h.startsWith('_'))
    .filter(h => !definedHandlers.includes(h));

  if (extraHandlers.length > 0) {
    throw new Error(`Actor implementation for ${actor.id} contains undefined handlers: ${extraHandlers.join(', ')}`);
  }
} 