/**
 * Reactive System DSL
 * 
 * This module defines a Domain-Specific Language (DSL) for creating reactive systems
 * with processes and tasks. The DSL provides a clear separation between the framework
 * and domain logic, making it easier to understand, test, and maintain.
 */

import { z } from 'zod';
import { TaskImplementationFn, TestCase } from './types';

// -----------------------------------------------------------------------------
// DSL Types
// -----------------------------------------------------------------------------

/**
 * Reactive System Definition
 */
export interface ReactiveSystemDefinition {
  id: string;
  name?: string;
  description?: string;
  processes: ProcessDefinition[];
  tasks: TaskDefinition[];
  plugins?: PluginDefinition[];
  metadata?: Record<string, unknown>;
}

/**
 * Process Definition
 */
export interface ProcessDefinition {
  id: string;
  name?: string;
  description?: string;
  initialState: string;
  states: StateDefinition[];
  metadata?: Record<string, unknown>;
}

/**
 * State Definition
 */
export interface StateDefinition {
  name: string;
  description?: string;
  isFinal?: boolean;
  transitions: TransitionDefinition[];
  tasks?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Transition Definition
 */
export interface TransitionDefinition {
  event: string;
  target: string;
  condition?: TaskImplementationFn<any, boolean>;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Task Definition
 */
export interface TaskDefinition {
  id: string;
  name?: string;
  description?: string;
  input?: Record<string, InputFieldDefinition>;
  output?: Record<string, OutputFieldDefinition>;
  implementation?: TaskImplementationFn;
  tests?: TestDefinition[];
  metadata?: Record<string, unknown>;
}

/**
 * Input Field Definition
 */
export interface InputFieldDefinition {
  type: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  enum?: unknown[];
  metadata?: Record<string, unknown>;
}

/**
 * Output Field Definition
 */
export interface OutputFieldDefinition {
  type: string;
  description?: string;
  required?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Test Definition
 */
export interface TestDefinition {
  name: string;
  description?: string;
  type: 'unit' | 'integration' | 'e2e';
  testCases: TestCase[];
  metadata?: Record<string, unknown>;
}

/**
 * Plugin Definition
 */
export interface PluginDefinition {
  name: string;
  description?: string;
  tasks?: TaskDefinition[];
  states?: StateDefinition[];
  services?: ServiceDefinition[];
  metadata?: Record<string, unknown>;
}

/**
 * Service Definition
 */
export interface ServiceDefinition {
  name: string;
  description?: string;
  interface?: string;
  mockImplementation?: any;
  metadata?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// DSL Builder Classes
// -----------------------------------------------------------------------------

/**
 * Reactive System Builder
 */
export class ReactiveSystemBuilder {
  private definition: Partial<ReactiveSystemDefinition> = {
    processes: [],
    tasks: [],
    plugins: []
  };

  /**
   * Create a new reactive system with the given ID
   */
  static define(id: string): ReactiveSystemBuilder {
    const builder = new ReactiveSystemBuilder();
    builder.definition.id = id;
    return builder;
  }

  /**
   * Set the system name
   */
  withName(name: string): this {
    this.definition.name = name;
    return this;
  }

  /**
   * Set the system description
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Add a process to the system
   */
  withProcess(id: string): ProcessBuilder {
    const processBuilder = new ProcessBuilder(this, id);
    return processBuilder;
  }

  /**
   * Add a task to the system
   */
  withTask(id: string): TaskBuilder {
    const taskBuilder = new TaskBuilder(this, id);
    return taskBuilder;
  }

  /**
   * Add a plugin to the system
   */
  withPlugin(plugin: PluginDefinition): this {
    if (!this.definition.plugins) {
      this.definition.plugins = [];
    }
    this.definition.plugins.push(plugin);
    return this;
  }

  /**
   * Add metadata to the system
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = {
      ...this.definition.metadata,
      ...metadata
    };
    return this;
  }

  /**
   * Add a process definition to the system
   * @internal
   */
  _addProcess(process: ProcessDefinition): this {
    if (!this.definition.processes) {
      this.definition.processes = [];
    }
    this.definition.processes.push(process);
    return this;
  }

  /**
   * Add a task definition to the system
   * @internal
   */
  _addTask(task: TaskDefinition): this {
    if (!this.definition.tasks) {
      this.definition.tasks = [];
    }
    this.definition.tasks.push(task);
    return this;
  }

  /**
   * Build the reactive system definition
   */
  build(): ReactiveSystemDefinition {
    if (!this.definition.id) {
      throw new Error('System ID is required');
    }

    if (!this.definition.processes || this.definition.processes.length === 0) {
      throw new Error('System must have at least one process');
    }

    return this.definition as ReactiveSystemDefinition;
  }
}

/**
 * Process Builder
 */
export class ProcessBuilder {
  private definition: Partial<ProcessDefinition> = {
    states: []
  };
  private parent: ReactiveSystemBuilder;
  private currentState?: StateBuilder;

  constructor(parent: ReactiveSystemBuilder, id: string) {
    this.parent = parent;
    this.definition.id = id;
  }

  /**
   * Set the process name
   */
  withName(name: string): this {
    this.definition.name = name;
    return this;
  }

  /**
   * Set the process description
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Set the initial state of the process
   */
  initialState(state: string): this {
    this.definition.initialState = state;
    return this;
  }

  /**
   * Add a state to the process
   */
  state(name: string): StateBuilder {
    // If we have a current state, add it to the definition
    if (this.currentState) {
      this.currentState._build();
    }

    // Create a new state builder
    this.currentState = new StateBuilder(this, name);
    return this.currentState;
  }

  /**
   * Add a task to the process
   * This is a convenience method that adds a task to the current state
   */
  withTask(taskId: string): this {
    if (this.currentState) {
      this.currentState.withTask(taskId);
    } else {
      throw new Error('Cannot add task: no current state');
    }
    return this;
  }

  /**
   * Add metadata to the process
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = {
      ...this.definition.metadata,
      ...metadata
    };
    return this;
  }

  /**
   * Add a state definition to the process
   * @internal
   */
  _addState(state: StateDefinition): this {
    if (!this.definition.states) {
      this.definition.states = [];
    }
    this.definition.states.push(state);
    return this;
  }

  /**
   * Build the process definition and add it to the parent system
   * @internal
   */
  _build(): ProcessDefinition {
    // If we have a current state, add it to the definition
    if (this.currentState) {
      this.currentState._build();
    }

    if (!this.definition.id) {
      throw new Error('Process ID is required');
    }

    if (!this.definition.initialState) {
      throw new Error('Process must have an initial state');
    }

    if (!this.definition.states || this.definition.states.length === 0) {
      throw new Error('Process must have at least one state');
    }

    const processDefinition = this.definition as ProcessDefinition;
    this.parent._addProcess(processDefinition);
    return processDefinition;
  }

  /**
   * Return to the parent system builder
   */
  build(): ReactiveSystemBuilder {
    this._build();
    return this.parent;
  }
}

/**
 * State Builder
 */
export class StateBuilder {
  private definition: Partial<StateDefinition> = {
    transitions: []
  };
  private parent: ProcessBuilder;

  constructor(parent: ProcessBuilder, name: string) {
    this.parent = parent;
    this.definition.name = name;
  }

  /**
   * Set the state description
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Mark the state as a final state
   */
  isFinal(): this {
    this.definition.isFinal = true;
    return this;
  }

  /**
   * Add a transition from this state
   */
  on(event: string): TransitionBuilder {
    return new TransitionBuilder(this, event);
  }

  /**
   * Add a task to be executed in this state
   */
  withTask(taskId: string): this {
    if (!this.definition.tasks) {
      this.definition.tasks = [];
    }
    this.definition.tasks.push(taskId);
    return this;
  }

  /**
   * Add metadata to the state
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = {
      ...this.definition.metadata,
      ...metadata
    };
    return this;
  }

  /**
   * Add a transition definition to the state
   * @internal
   */
  _addTransition(transition: TransitionDefinition): this {
    if (!this.definition.transitions) {
      this.definition.transitions = [];
    }
    this.definition.transitions.push(transition);
    return this;
  }

  /**
   * Build the state definition and add it to the parent process
   * @internal
   */
  _build(): StateDefinition {
    if (!this.definition.name) {
      throw new Error('State name is required');
    }

    const stateDefinition = this.definition as StateDefinition;
    this.parent._addState(stateDefinition);
    return stateDefinition;
  }

  /**
   * Return to the parent process builder
   */
  build(): ProcessBuilder {
    this._build();
    return this.parent;
  }

  /**
   * Add a new state to the process
   * This allows chaining state definitions
   */
  state(name: string): StateBuilder {
    this._build();
    return this.parent.state(name);
  }
}

/**
 * Transition Builder
 */
export class TransitionBuilder {
  private definition: Partial<TransitionDefinition> = {};
  private parent: StateBuilder;

  constructor(parent: StateBuilder, event: string) {
    this.parent = parent;
    this.definition.event = event;
  }

  /**
   * Set the target state for the transition
   */
  transitionTo(target: string): StateBuilder {
    this.definition.target = target;
    this._build();
    return this.parent;
  }

  /**
   * Set a condition for the transition
   */
  withCondition(condition: TaskImplementationFn<any, boolean>): this {
    this.definition.condition = condition;
    return this;
  }

  /**
   * Set the description for the transition
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Add metadata to the transition
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = {
      ...this.definition.metadata,
      ...metadata
    };
    return this;
  }

  /**
   * Build the transition definition and add it to the parent state
   * @internal
   */
  _build(): TransitionDefinition {
    if (!this.definition.event) {
      throw new Error('Transition event is required');
    }

    if (!this.definition.target) {
      throw new Error('Transition target is required');
    }

    const transitionDefinition = this.definition as TransitionDefinition;
    this.parent._addTransition(transitionDefinition);
    return transitionDefinition;
  }
}

/**
 * Task Builder
 */
export class TaskBuilder<Input = any, Output = any, Context = any> {
  private definition: Partial<TaskDefinition> = {
    input: {},
    output: {},
    tests: []
  };
  private parent: ReactiveSystemBuilder;
  private testCases: TestCase<Input, Output, Context>[] = [];

  constructor(parent: ReactiveSystemBuilder, id: string) {
    this.parent = parent;
    this.definition.id = id;
  }

  /**
   * Set the task name
   */
  withName(name: string): this {
    this.definition.name = name;
    return this;
  }

  /**
   * Set the task description
   */
  withDescription(description: string): this {
    this.definition.description = description;
    return this;
  }

  /**
   * Define the input schema for the task
   */
  input(schema: Record<string, InputFieldDefinition>): this {
    this.definition.input = schema;
    return this;
  }

  /**
   * Define the output schema for the task
   */
  output(schema: Record<string, OutputFieldDefinition>): this {
    this.definition.output = schema;
    return this;
  }

  /**
   * Set the implementation for the task
   */
  implementation(fn: TaskImplementationFn<Input, Output, Context>): this {
    this.definition.implementation = fn;
    return this;
  }

  /**
   * Add a test for the task
   */
  test(type: 'unit' | 'integration' | 'e2e', testCasesFn: (task: TaskImplementationFn<Input, Output, Context>) => TestCase<Input, Output, Context>[]): this {
    if (!this.definition.tests) {
      this.definition.tests = [];
    }
    
    // Store the test cases
    const testCases = testCasesFn(this.definition.implementation as TaskImplementationFn<Input, Output, Context>);
    this.testCases.push(...testCases);
    
    // Add the test definition
    this.definition.tests.push({
      name: `${this.definition.id}-${type}-test`,
      type,
      testCases
    });
    
    return this;
  }

  /**
   * Add metadata to the task
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.definition.metadata = {
      ...this.definition.metadata,
      ...metadata
    };
    return this;
  }

  /**
   * Build the task definition and add it to the parent system
   * @internal
   */
  _build(): TaskDefinition {
    if (!this.definition.id) {
      throw new Error('Task ID is required');
    }

    const taskDefinition = this.definition as TaskDefinition;
    this.parent._addTask(taskDefinition);
    return taskDefinition;
  }

  /**
   * Return to the parent system builder
   */
  build(): ReactiveSystemBuilder {
    this._build();
    return this.parent;
  }
}

// -----------------------------------------------------------------------------
// DSL Factory
// -----------------------------------------------------------------------------

/**
 * Reactive System DSL factory
 */
export const ReactiveSystem = {
  define: ReactiveSystemBuilder.define
}; 