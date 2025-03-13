/**
 * Process Builder - Fluent API for defining processes
 */
import { z } from 'zod';
import { ProcessDefinition, ProcessState, Transition } from '../types';

/**
 * Builder class for creating process definitions with a fluent interface
 */
export class ProcessBuilder<
  TState extends string = string,
  TEvent extends string = string,
  TContext = any
> {
  private definition: Partial<ProcessDefinition<TState, TEvent, TContext>> = {
    states: [],
    transitions: []
  };

  /**
   * Create a new process with the given ID
   * @example
   * const orderProcess = Process.create('order-process')
   *   .withDescription('Handles order fulfillment')
   *   .withInitialState('created');
   */
  static create<S extends string = string, E extends string = string, C = any>(
    id: string
  ): ProcessBuilder<S, E, C> {
    const builder = new ProcessBuilder<S, E, C>();
    builder.definition.id = id;
    return builder;
  }

  /**
   * Add a description to help understand the process purpose
   * @example
   * .withDescription('Handles customer subscription lifecycle')
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Set the initial state of the process
   * @example
   * .withInitialState('created')
   */
  withInitialState(state: TState): this {
    this.definition.initialState = state;
    return this;
  }

  /**
   * Add a state to the process
   * @example
   * // Basic state
   * .addState('created')
   * 
   * // With configuration
   * .addState('processing', {
   *   description: 'Order is being processed',
   *   onEnter: async (context) => { console.log('Entering processing state'); }
   * })
   * 
   * // Parallel state
   * .addState('processing', { type: 'parallel' })
   * 
   * // Child state with parent
   * .addState('processing.payment', { parent: 'processing' })
   */
  addState(name: TState, config: Omit<ProcessState<TContext>, 'name'> = {}): this {
    // Ensure states is an array
    if (!Array.isArray(this.definition.states)) {
      this.definition.states = [];
    }

    // Create the state
    const state: ProcessState<TContext> = {
      name,
      ...config
    };
    
    // Validate parent state if specified
    if (state.parent) {
      const parentState = (this.definition.states as Array<ProcessState<TContext>>).find(
        s => s.name === state.parent
      );
      
      if (!parentState) {
        throw new Error(`Parent state '${state.parent}' not found. Make sure to define parent states before child states.`);
      }
      
      // Ensure parent is a parallel state if it has children
      if (parentState.type !== 'parallel') {
        parentState.type = 'parallel';
      }
    }
    
    // Convert isFinal to type if needed
    if (state.isFinal && !state.type) {
      state.type = 'final';
    }

    // Add the state
    (this.definition.states as Array<ProcessState<TContext>>).push(state);

    return this;
  }

  /**
   * Add multiple states at once
   * @example
   * .addStates(['created', 'processing', 'completed', 'cancelled'])
   */
  addStates(states: TState[]): this {
    for (const state of states) {
      this.addState(state);
    }
    return this;
  }

  /**
   * Add a transition between states
   * @example
   * .addTransition({
   *   from: 'created',
   *   to: 'processing',
   *   on: 'START_PROCESSING',
   *   guard: (context) => context.items.length > 0
   * })
   */
  addTransition(transition: Transition<TState, TEvent, TContext>): this {
    if (!this.definition.transitions) {
      this.definition.transitions = [];
    }

    this.definition.transitions.push(transition);
    return this;
  }

  /**
   * Add a simple transition between states
   * @example
   * .addSimpleTransition('created', 'processing', 'START_PROCESSING')
   */
  addSimpleTransition(from: TState | TState[] | '*', to: TState, on: TEvent): this {
    return this.addTransition({ from, to, on });
  }

  /**
   * Add metadata to the process
   * @example
   * .withMetadata({
   *   version: '1.0.0',
   *   owner: 'order-team',
   *   tags: ['critical', 'core']
   * })
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = {
      ...this.definition.metadata,
      ...metadata
    };
    return this;
  }

  /**
   * Add a schema for validating process context
   * @example
   * .withContextSchema(z.object({
   *   orderId: z.string(),
   *   items: z.array(z.object({
   *     productId: z.string(),
   *     quantity: z.number().positive()
   *   }))
   * }))
   */
  withContextSchema<T extends TContext>(schema: z.ZodType<T>): ProcessBuilder<TState, TEvent, T> {
    (this.definition as any).contextSchema = schema;
    return this as any;
  }

  /**
   * Add LLM-specific metadata to help with generation and understanding
   * @example
   * .withLLMMetadata({
   *   domainConcepts: ['order', 'fulfillment', 'inventory'],
   *   businessRules: ['Orders must be paid before processing']
   * })
   */
  withLLMMetadata(metadata: {
    domainConcepts?: string[];
    businessRules?: string[];
    designPatterns?: string[];
    relatedProcesses?: string[];
  }): this {
    this.definition.llmMetadata = {
      ...this.definition.llmMetadata,
      ...metadata
    };
    return this;
  }

  /**
   * Builds the complete process definition
   */
  build(): ProcessDefinition<TState, TEvent, TContext> {
    // Validate the definition before returning
    if (!this.definition.id) {
      throw new Error('Process ID is required');
    }

    if (!Array.isArray(this.definition.states) || this.definition.states.length === 0) {
      throw new Error('Process must have at least one state');
    }

    if (!this.definition.transitions || this.definition.transitions.length === 0) {
      throw new Error('Process must have at least one transition');
    }

    // Set default initial state if not provided
    if (!this.definition.initialState) {
      const firstState = (this.definition.states as Array<ProcessState<TContext>>)[0];
      this.definition.initialState = firstState.name as TState;
    }

    // Validate initial state is in states array
    const stateNames = (this.definition.states as Array<ProcessState<TContext>>).map(s => s.name);
    if (!stateNames.includes(this.definition.initialState as string)) {
      throw new Error('Initial state must be one of the defined states');
    }

    // Validate transitions reference valid states
    this.validateTransitions();

    return this.definition as ProcessDefinition<TState, TEvent, TContext>;
  }

  /**
   * Validate transitions against available states
   */
  private validateTransitions(): void {
    if (!this.definition.transitions) return;

    const stateNames = (this.definition.states as Array<ProcessState<TContext>>).map(s => s.name);
    const transitionMap = new Map<string, Set<string>>();

    for (const transition of this.definition.transitions) {
      // Validate event type
      if (!transition.on) {
        throw new Error('Transition must have an event type');
      }

      // Validate from state
      if (Array.isArray(transition.from)) {
        // Check for mixing wildcard with specific states
        if (transition.from.includes('*' as TState) && transition.from.length > 1) {
          throw new Error('Cannot mix wildcard with specific states in transition source');
        }

        for (const fromState of transition.from) {
          if (fromState !== '*' && !stateNames.includes(fromState as string)) {
            throw new Error(`Transition from state "${fromState}" is not defined in the process states`);
          }

          // Check for duplicate transitions
          this.checkDuplicateTransition(transitionMap, fromState as string, transition.on as string);
        }
      } else if (transition.from !== '*' && !stateNames.includes(transition.from as string)) {
        throw new Error(`Transition from state "${transition.from}" is not defined in the process states`);
      } else {
        // Check for duplicate transitions
        this.checkDuplicateTransition(transitionMap, transition.from as string, transition.on as string);
      }

      // Validate to state
      if (!stateNames.includes(transition.to as string)) {
        throw new Error(`Transition references undefined state: ${transition.to}`);
      }
    }
  }

  /**
   * Check for duplicate transitions from the same state with the same event
   */
  private checkDuplicateTransition(
    transitionMap: Map<string, Set<string>>,
    fromState: string,
    eventType: string
  ): void {
    if (!transitionMap.has(fromState)) {
      transitionMap.set(fromState, new Set<string>());
    }

    const events = transitionMap.get(fromState)!;
    if (events.has(eventType)) {
      throw new Error(`Duplicate transition event: ${eventType} from state: ${fromState}`);
    }

    events.add(eventType);
  }
}

/**
 * Process factory for creating process definitions
 */
export const Process = {
  create: ProcessBuilder.create
}; 