import { 
  ProcessDefinition, 
  TaskDefinition, 
  ReactiveSystemDefinition 
} from './types/index';

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
      addProcess(process: any) {
        this.processes.push(process);
        return this;
      },
      addTask(task: any) {
        this.tasks.push(task);
        return this;
      },
      build(): ReactiveSystemDefinition {
        return {
          id: this.id,
          name: this.name,
          description: this.description,
          processes: this.processes,
          tasks: this.tasks,
          services: this.services,
          plugins: this.plugins,
          metadata: this.metadata
        };
      }
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
  private processes: ProcessDefinition[] = [];
  private tasks: TaskDefinition[] = [];
  private services: any[] = [];
  private plugins: any[] = [];
  private metadata: Record<string, any> = {};

  constructor(id: string) {
    this.id = id;
    this.name = id;
  }

  /**
   * Create a new reactive system builder
   */
  static create(id: string): ReactiveSystemBuilder {
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
  addProcess(process: ProcessDefinition): ReactiveSystemBuilder {
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
   * Build the reactive system
   */
  build(): ReactiveSystemDefinition {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      processes: this.processes,
      tasks: this.tasks,
      services: this.services,
      plugins: this.plugins,
      metadata: this.metadata
    };
  }
}
