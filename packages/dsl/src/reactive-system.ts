import { ProcessDefinition, TaskDefinition, ReactiveSystemDefinition } from './types/index';
import { Plugin } from './plugin';

// Extended ProcessDefinition with tasks property
interface ExtendedProcessDefinition extends ProcessDefinition {
  tasks?: string[];
}

/**
 * Reactive system
 */
export class ReactiveSystem {
  private static processes: Record<string, any> = {};
  private static tasks: Record<string, any> = {};

  /**
   * Define a new reactive system
   */
  static define(id: string): any {
    return {
      id,
      name: id,
      description: '',
      processes: [],
      tasks: [],
      services: [],
      plugins: [],
      metadata: {},
      withProcess(processId: string) {
        const process = {
          id: processId,
          name: processId,
          description: '',
          _initialState: '',
          states: [] as Array<{ id: string; name: string }>,
          transitions: [],
          addState(stateId: string) {
            this.states.push({ id: stateId, name: stateId });
            return this;
          },
          setInitialState(stateId: string) {
            this._initialState = stateId;
            return this;
          },
          get initialState() {
            return this._initialState;
          },
          build() {
            return this;
          },
        };
        this.processes.push(process);
        return process;
      },
      addProcess(process: any) {
        this.processes.push(process);
        return this;
      },
      addTask(task: any) {
        this.tasks.push(task);
        return this;
      },
      build(): ReactiveSystemDefinition {
        // Validate the system
        if (this.processes.length === 0) {
          throw new Error('System must have at least one process');
        }

        // Validate each process
        for (const process of this.processes) {
          if (!process.initialState) {
            throw new Error(`Process "${process.id}" must have an initial state`);
          }
          if (process.states.length === 0) {
            throw new Error(`Process "${process.id}" must have at least one state`);
          }
        }

        return {
          id: this.id,
          name: this.name,
          description: this.description,
          processes: this.processes,
          tasks: this.tasks,
          services: this.services,
          plugins: this.plugins,
          metadata: this.metadata,
        };
      },
    };
  }

  /**
   * Register a process
   */
  static registerProcess(process: any): void {
    ReactiveSystem.processes[process.id] = process;
  }

  /**
   * Register a task
   */
  static registerTask(task: any): void {
    ReactiveSystem.tasks[task.id] = task;
  }

  /**
   * Get a process by id
   */
  static getProcess(id: string): any {
    return ReactiveSystem.processes[id];
  }

  /**
   * Get a task by id
   */
  static getTask(id: string): any {
    return ReactiveSystem.tasks[id];
  }
}

/**
 * Reactive system builder
 */
export class ReactiveSystemBuilder {
  private id: string;
  private name: string;
  private description?: string;
  private processes: ExtendedProcessDefinition[] = [];
  private tasks: TaskDefinition[] = [];
  private services: any[] = [];
  private plugins: any[] = [];
  private metadata: Record<string, any> = {};

  constructor(id: string = 'default-system') {
    this.id = id;
    this.name = id;
  }

  /**
   * Create a new reactive system builder
   */
  static create(id: string): ReactiveSystemBuilder {
    if (!id) {
      throw new Error('System ID cannot be empty');
    }
    return new ReactiveSystemBuilder(id);
  }

  /**
   * Set the name of the reactive system
   */
  withName(name: string): ReactiveSystemBuilder {
    this.name = name;
    return this;
  }

  /**
   * Set the description of the reactive system
   */
  withDescription(description: string): ReactiveSystemBuilder {
    this.description = description;
    return this;
  }

  /**
   * Add a process to the reactive system
   */
  addProcess(process: ExtendedProcessDefinition): ReactiveSystemBuilder {
    this.processes.push(process);
    return this;
  }

  /**
   * Add a task to the reactive system
   */
  addTask(task: TaskDefinition): ReactiveSystemBuilder {
    this.tasks.push(task);
    return this;
  }

  /**
   * Add a plugin to the reactive system
   */
  withPlugin(plugin: Plugin): ReactiveSystemBuilder {
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Validate the system
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check if system has processes
    if (this.processes.length === 0) {
      errors.push('System must have at least one process');
    }

    // Validate processes
    for (const process of this.processes) {
      // Check if process has an initial state
      if (!process.initialState) {
        errors.push(`Process "${process.id}" must have an initial state`);
      }

      // Check if process has states
      if (!process.states || process.states.length === 0) {
        errors.push(`Process "${process.id}" must have at least one state`);
      }

      // Check if transitions reference valid states
      if (process.transitions) {
        for (const transition of process.transitions) {
          if (process.states && !process.states.includes(transition.from)) {
            errors.push(
              `Process "${process.id}" has a transition from non-existent state "${transition.from}"`
            );
          }
          if (process.states && !process.states.includes(transition.to)) {
            errors.push(
              `Process "${process.id}" has a transition to non-existent state "${transition.to}"`
            );
          }
        }
      }

      // Check if tasks exist
      if (process.tasks) {
        for (const taskId of process.tasks) {
          const taskExists = this.tasks.some(task => task.id === taskId);
          if (!taskExists) {
            errors.push(`Process "${process.id}" references non-existent task "${taskId}"`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build the reactive system
   */
  build(): ReactiveSystemDefinition {
    // Validate the system
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`System validation failed: ${validation.errors.join(', ')}`);
    }

    return {
      id: this.id,
      name: this.name,
      description: this.description,
      processes: this.processes,
      tasks: this.tasks,
      services: this.services,
      plugins: this.plugins,
      metadata: this.metadata,
    };
  }
}
