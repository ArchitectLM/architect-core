/**
 * Agent extension for the DSL
 * 
 * Provides agent-specific functionality and coordination between actors
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
 * Agent extension options
 */
export interface AgentExtensionOptions {
  /**
   * Whether to enable strict validation mode
   */
  strictValidation?: boolean;
  
  /**
   * Default configuration for agents
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
 * Agent Extension API
 */
export interface AgentExtension {
  /**
   * Create a new agent definition
   */
  createAgent(id: string, definition: Omit<ActorDefinition, 'id' | 'type'>): ActorDefinition;
  
  /**
   * Implement an agent's message handlers
   */
  implementAgent(agentId: string, implementation: ActorImplementation): void;
  
  /**
   * Create a flow builder for the given context
   */
  createFlow(context: ActorContext): FlowBuilder;
}

/**
 * Setup function for the agent extension
 */
export function setupAgentExtension(dsl: DSL, options: AgentExtensionOptions = {}): AgentExtension {
  // Default options
  const defaultOptions: AgentExtensionOptions = {
    strictValidation: true,
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

  const finalOptions = { ...defaultOptions, ...options };

  // Create extension API
  const extension: AgentExtension = {
    createAgent(id: string, definition: Omit<ActorDefinition, 'id' | 'type'>): ActorDefinition {
      const agentDef: ActorDefinition = {
        id,
        type: ComponentType.ACTOR,
        ...definition,
        config: {
          ...finalOptions.defaultConfig,
          ...definition.config
        }
      };

      // Register with DSL
      dsl.component(id, agentDef);

      return agentDef;
    },

    implementAgent(agentId: string, implementation: ActorImplementation): void {
      // Get agent definition
      const agentDef = dsl.getComponent<ActorDefinition>(agentId);
      if (!agentDef) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Validate implementation against definition
      validateAgentImplementation(agentDef, implementation);

      // Create wrapped implementation with enhanced context
      const wrappedImplementation: ActorImplementation = {};
      
      for (const [handlerName, handler] of Object.entries(implementation)) {
        wrappedImplementation[handlerName] = async (input: any, context: ActorContext) => {
          // Add flow builder to context
          const enhancedContext: ActorContext = {
            ...context,
            flow: () => extension.createFlow(context)
          };
          
          // If this agent uses state and context doesn't have state yet
          if (agentDef.config?.stateManagement?.persistence && !enhancedContext.state) {
            enhancedContext.state = {};
          }
          
          return handler(input, enhancedContext);
        };
      }

      // Register implementation with DSL
      dsl.implement<any, any>(agentId, wrappedImplementation.execute);
    },

    createFlow(context: ActorContext): FlowBuilder {
      return createFlowBuilder(dsl, context);
    }
  };

  // Create and register the extension
  const agentExtension = createExtension('agent', (dsl: DSL) => {
    // Add extension API to DSL instance
    (dsl as any).agentExtension = extension;
    
    // Return the extension API
    return extension;
  });

  // Register the extension factory
  defineExtension('agent', () => agentExtension);

  return extension;
}

/**
 * Validate agent implementation against definition
 */
function validateAgentImplementation(definition: ActorDefinition, implementation: ActorImplementation): void {
  // Validate all message handlers are implemented
  for (const [handlerName, handlerDef] of Object.entries(definition.messageHandlers)) {
    if (!implementation[handlerName]) {
      throw new Error(`Missing implementation for message handler: ${handlerName}`);
    }
  }

  // Validate no extra handlers are implemented
  for (const handlerName of Object.keys(implementation)) {
    if (!definition.messageHandlers[handlerName]) {
      throw new Error(`Extra message handler implemented: ${handlerName}`);
    }
  }
} 