/**
 * Reactive System DSL Assembler
 * 
 * This module provides an assembler that transforms the reactive system DSL
 * into executable runtime objects. The assembler is responsible for validating the DSL,
 * creating runtime objects, and providing a runtime for executing the
 * assembled system.
 */

import { 
  ReactiveSystemDefinition, 
  ProcessDefinition, 
  StateDefinition, 
  TaskDefinition,
  TestDefinition
} from './reactive-system';
import { TaskImplementationFn, TestCase } from './types';
import { SystemConfig, ProcessInstance, TaskImplementation } from '../types';

/**
 * Assembled System
 */
export interface AssembledSystem {
  id: string;
  name?: string;
  description?: string;
  processes: Record<string, AssembledProcess>;
  tasks: Record<string, AssembledTask>;
  plugins?: Record<string, AssembledPlugin>;
  metadata?: Record<string, unknown>;
}

/**
 * Assembled Process
 */
export interface AssembledProcess {
  id: string;
  name?: string;
  description?: string;
  stateMachine: StateMachine;
  metadata?: Record<string, unknown>;
}

/**
 * Assembled Task
 */
export interface AssembledTask {
  id: string;
  name?: string;
  description?: string;
  implementation: TaskImplementationFn;
  tests?: Array<{
    name: string;
    type: 'unit' | 'integration' | 'e2e';
    run: () => Promise<boolean>;
  }>;
  metadata?: Record<string, unknown>;
}

/**
 * Assembled Plugin
 */
export interface AssembledPlugin {
  name: string;
  description?: string;
  tasks?: Record<string, AssembledTask>;
  services?: Record<string, any>;
  metadata?: Record<string, unknown>;
}

/**
 * State Machine
 */
export class StateMachine {
  private states: Map<string, State> = new Map();
  private initialState: string = '';

  constructor(public readonly id: string) {}

  /**
   * Add a state to the state machine
   */
  addState(state: State): void {
    this.states.set(state.name, state);
  }

  /**
   * Set the initial state
   */
  setInitialState(stateName: string): void {
    if (!this.states.has(stateName)) {
      throw new Error(`State '${stateName}' does not exist`);
    }
    this.initialState = stateName;
  }

  /**
   * Get a state by name
   */
  getState(name: string): State | undefined {
    return this.states.get(name);
  }

  /**
   * Get the initial state
   */
  getInitialState(): State {
    const state = this.states.get(this.initialState);
    if (!state) {
      throw new Error(`Initial state '${this.initialState}' does not exist`);
    }
    return state;
  }

  /**
   * Get all states
   */
  getAllStates(): State[] {
    return Array.from(this.states.values());
  }

  /**
   * Transition to a new state
   */
  async transition(currentState: string, event: string, context: any): Promise<string> {
    const state = this.states.get(currentState);
    if (!state) {
      throw new Error(`State '${currentState}' does not exist`);
    }

    const transition = state.getTransition(event);
    if (!transition) {
      throw new Error(`No transition found for event '${event}' in state '${currentState}'`);
    }

    // Check if the transition has a condition
    if (transition.condition && !(await transition.condition(context, {}))) {
      throw new Error(`Transition condition failed for event '${event}' in state '${currentState}'`);
    }

    return transition.target;
  }
}

/**
 * State
 */
export class State {
  private transitions: Map<string, Transition> = new Map();
  private tasks: string[] = [];

  constructor(public readonly name: string) {}

  /**
   * Add a transition to the state
   */
  addTransition(transition: Transition): void {
    this.transitions.set(transition.event, transition);
  }

  /**
   * Get a transition by event
   */
  getTransition(event: string): Transition | undefined {
    return this.transitions.get(event);
  }

  /**
   * Get all transitions
   */
  getAllTransitions(): Transition[] {
    return Array.from(this.transitions.values());
  }

  /**
   * Add a task to the state
   */
  addTask(taskId: string): void {
    this.tasks.push(taskId);
  }

  /**
   * Get all tasks
   */
  getTasks(): string[] {
    return this.tasks;
  }
}

/**
 * Transition
 */
export class Transition {
  constructor(
    public readonly event: string,
    public readonly target: string,
    public readonly condition?: TaskImplementationFn<any, boolean>
  ) {}
}

/**
 * Reactive System Assembler
 */
export class ReactiveSystemAssembler {
  /**
   * Assemble a reactive system definition into an executable system
   */
  assemble(definition: ReactiveSystemDefinition): AssembledSystem {
    // Create the assembled system
    const system: AssembledSystem = {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      processes: {},
      tasks: {},
      metadata: definition.metadata
    };

    // Assemble processes
    for (const process of definition.processes) {
      const assembledProcess = this.assembleProcess(process);
      system.processes[process.id] = assembledProcess;
    }

    // Assemble tasks
    for (const task of definition.tasks) {
      const assembledTask = this.assembleTask(task);
      system.tasks[task.id] = assembledTask;
    }

    // Assemble plugins
    if (definition.plugins) {
      system.plugins = {};
      for (const plugin of definition.plugins) {
        const assembledPlugin = this.assemblePlugin(plugin);
        system.plugins[plugin.name] = assembledPlugin;
      }
    }

    return system;
  }

  /**
   * Assemble a process definition
   */
  private assembleProcess(definition: ProcessDefinition): AssembledProcess {
    // Create a state machine
    const stateMachine = new StateMachine(definition.id);

    // Add states
    for (const stateDefinition of definition.states) {
      const state = new State(stateDefinition.name);

      // Add transitions
      for (const transitionDefinition of stateDefinition.transitions) {
        const transition = new Transition(
          transitionDefinition.event,
          transitionDefinition.target,
          transitionDefinition.condition
        );
        state.addTransition(transition);
      }

      // Add tasks
      if (stateDefinition.tasks) {
        for (const taskId of stateDefinition.tasks) {
          state.addTask(taskId);
        }
      }

      stateMachine.addState(state);
    }

    // Set initial state
    stateMachine.setInitialState(definition.initialState);

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      stateMachine,
      metadata: definition.metadata
    };
  }

  /**
   * Assemble a task definition
   */
  private assembleTask(definition: TaskDefinition): AssembledTask {
    // Use the implementation directly
    const implementation = definition.implementation || this.createDefaultImplementation();

    // Assemble tests
    const tests = definition.tests ? this.assembleTests(definition.tests) : [];

    return {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      implementation,
      tests,
      metadata: definition.metadata
    };
  }

  /**
   * Create a default implementation for tasks that don't have one
   */
  private createDefaultImplementation(): TaskImplementationFn {
    return async (input: any, context: any) => {
      console.log(`Executing task with default implementation. Input:`, input);
      return { success: true };
    };
  }

  /**
   * Assemble a plugin definition
   */
  private assemblePlugin(definition: any): AssembledPlugin {
    // This is a placeholder implementation
    return {
      name: definition.name,
      description: definition.description,
      metadata: definition.metadata
    };
  }

  /**
   * Assemble test definitions into runnable tests
   */
  private assembleTests(tests: TestDefinition[]): Array<{
    name: string;
    type: 'unit' | 'integration' | 'e2e';
    run: () => Promise<boolean>;
  }> {
    return tests.flatMap(test => {
      return test.testCases.map(testCase => ({
        name: testCase.name,
        type: test.type,
        run: async () => {
          try {
            // Run the test case
            const setup = testCase.setup();
            const result = await testCase.execute(setup);
            await testCase.verify(result, setup);
            return true;
          } catch (error) {
            console.error(`Test '${testCase.name}' failed:`, error);
            return false;
          }
        }
      }));
    });
  }
}

/**
 * Create a reactive system assembler
 */
export function createAssembler(): ReactiveSystemAssembler {
  return new ReactiveSystemAssembler();
} 