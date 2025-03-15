/**
 * Hybrid DSL for ArchitectLM
 *
 * This file provides both a builder pattern and functional approach
 * for defining systems, processes, and tasks.
 */

// Type definitions
export interface System {
  id: string;
  name: string;
  description?: string;
  version?: string;
  boundedContexts?: Record<string, BoundedContext>;
  processes?: Record<string, Process>;
  tasks?: Record<string, Task>;
}

export interface BoundedContext {
  id: string;
  name: string;
  description?: string;
  processes?: string[];
}

export interface Process {
  id: string;
  name: string;
  description?: string;
  contextId: string;
  type?: 'stateful' | 'stateless';
  states?: string[];
  transitions?: Transition[];
  tasks?: string[];
}

export interface Transition {
  from: string;
  to: string;
  on: string;
  condition?: string;
}

export interface Task {
  id: string;
  label?: string;
  description?: string;
  type?: string;
  input?: string[];
  output?: string[];
}

export interface ValidationResult {
  success: boolean;
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

// Builder classes
export class SystemBuilder {
  private system: System;

  constructor(id: string) {
    this.system = {
      id,
      name: id,
      boundedContexts: {},
      processes: {},
      tasks: {},
    };
  }

  static create(id: string): SystemBuilder {
    return new SystemBuilder(id);
  }

  withName(name: string): SystemBuilder {
    this.system.name = name;
    return this;
  }

  withDescription(description: string): SystemBuilder {
    this.system.description = description;
    return this;
  }

  withVersion(version: string): SystemBuilder {
    this.system.version = version;
    return this;
  }

  withBoundedContext(
    id: string,
    nameOrConfig: string | ((context: BoundedContext) => BoundedContext)
  ): SystemBuilder {
    const context: BoundedContext = {
      id,
      name: typeof nameOrConfig === 'string' ? nameOrConfig : id,
      processes: [],
    };

    if (typeof nameOrConfig === 'function') {
      this.system.boundedContexts![id] = nameOrConfig(context);
    } else {
      this.system.boundedContexts![id] = context;
    }

    return this;
  }

  withProcess(
    id: string,
    contextId: string,
    nameOrConfig: string | ((process: Process) => Process)
  ): SystemBuilder {
    if (!this.system.boundedContexts?.[contextId]) {
      throw new Error(`Bounded context "${contextId}" does not exist`);
    }

    const process: Process = {
      id,
      name: typeof nameOrConfig === 'string' ? nameOrConfig : id,
      contextId,
      tasks: [],
    };

    if (typeof nameOrConfig === 'function') {
      this.system.processes![id] = nameOrConfig(process);
    } else {
      this.system.processes![id] = process;
    }

    this.system.boundedContexts[contextId].processes = [
      ...(this.system.boundedContexts[contextId].processes || []),
      id,
    ];

    return this;
  }

  withStatefulProcess(
    id: string,
    contextId: string,
    config: {
      name?: string;
      description?: string;
      states: string[];
      transitions: Array<{ from: string; to: string; on: string; condition?: string }>;
    }
  ): SystemBuilder {
    if (!this.system.boundedContexts?.[contextId]) {
      throw new Error(`Bounded context "${contextId}" does not exist`);
    }

    this.system.processes![id] = {
      id,
      name: config.name || id,
      description: config.description,
      contextId,
      type: 'stateful',
      states: config.states,
      transitions: config.transitions,
      tasks: [],
    };

    this.system.boundedContexts[contextId].processes = [
      ...(this.system.boundedContexts[contextId].processes || []),
      id,
    ];

    return this;
  }

  withTask(id: string, labelOrConfig: string | ((task: Task) => Task)): SystemBuilder {
    const task: Task = {
      id,
      label: typeof labelOrConfig === 'string' ? labelOrConfig : id,
    };

    if (typeof labelOrConfig === 'function') {
      this.system.tasks![id] = labelOrConfig(task);
    } else {
      this.system.tasks![id] = task;
    }

    return this;
  }

  withProcessTask(processId: string, taskId: string): SystemBuilder {
    if (!this.system.processes?.[processId]) {
      throw new Error(`Process "${processId}" does not exist`);
    }

    if (!this.system.tasks?.[taskId]) {
      throw new Error(`Task "${taskId}" does not exist`);
    }

    this.system.processes[processId].tasks = [
      ...(this.system.processes[processId].tasks || []),
      taskId,
    ];

    return this;
  }

  transform(fn: (system: System) => System): SystemBuilder {
    this.system = fn(this.system);
    return this;
  }

  validate(): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Check for processes referencing non-existent tasks
    if (this.system.processes) {
      Object.entries(this.system.processes).forEach(([processId, process]) => {
        if (process.tasks) {
          process.tasks.forEach(taskId => {
            if (!this.system.tasks?.[taskId]) {
              issues.push({
                path: `processes.${processId}.tasks`,
                message: `Process "${processId}" references non-existent task "${taskId}"`,
                severity: 'error',
              });
            }
          });
        }
      });
    }

    return {
      success: issues.length === 0,
      issues,
    };
  }

  build(): System {
    return this.system;
  }
}

export class ProcessBuilder {
  private process: Process;

  constructor(
    id: string,
    name: string,
    contextId: string,
    type: 'stateful' | 'stateless' = 'stateful'
  ) {
    this.process = {
      id,
      name,
      contextId,
      type,
      tasks: [],
    };

    if (type === 'stateful') {
      this.process.states = [];
      this.process.transitions = [];
    }
  }

  withType(type: 'stateful' | 'stateless'): ProcessBuilder {
    this.process.type = type;
    return this;
  }

  withDescription(description: string): ProcessBuilder {
    this.process.description = description;
    return this;
  }

  withStates(states: string[]): ProcessBuilder {
    if (this.process.type !== 'stateful') {
      throw new Error('States can only be added to stateful processes');
    }
    this.process.states = states;
    return this;
  }

  withTransition(from: string, to: string, on: string, condition?: string): ProcessBuilder {
    if (this.process.type !== 'stateful') {
      throw new Error('Transitions can only be added to stateful processes');
    }
    this.process.transitions = [...(this.process.transitions || []), { from, to, on, condition }];
    return this;
  }

  withTask(taskId: string): ProcessBuilder {
    this.process.tasks = [...(this.process.tasks || []), taskId];
    return this;
  }

  build(): Process {
    return this.process;
  }
}

export class TaskBuilder {
  private task: Task;

  constructor(id: string) {
    this.task = {
      id,
    };
  }

  withLabel(label: string): TaskBuilder {
    this.task.label = label;
    return this;
  }

  withDescription(description: string): TaskBuilder {
    this.task.description = description;
    return this;
  }

  withType(type: string): TaskBuilder {
    this.task.type = type;
    return this;
  }

  withInput(input: string[]): TaskBuilder {
    this.task.input = input;
    return this;
  }

  withOutput(output: string[]): TaskBuilder {
    this.task.output = output;
    return this;
  }

  build(): Task {
    return this.task;
  }
}

// Functional approach
export function createSystem(id: string, name?: string): System {
  return {
    id,
    name: name || id,
    boundedContexts: {},
    processes: {},
    tasks: {},
  };
}

export function addBoundedContext(system: System, id: string, name: string): System {
  return {
    ...system,
    boundedContexts: {
      ...(system.boundedContexts || {}),
      [id]: {
        id,
        name,
        processes: [],
      },
    },
  };
}

export function addProcess(system: System, id: string, contextId: string, name: string): System {
  if (!system.boundedContexts?.[contextId]) {
    throw new Error(`Bounded context "${contextId}" does not exist`);
  }

  return {
    ...system,
    boundedContexts: {
      ...system.boundedContexts,
      [contextId]: {
        ...system.boundedContexts[contextId],
        processes: [...(system.boundedContexts[contextId].processes || []), id],
      },
    },
    processes: {
      ...(system.processes || {}),
      [id]: {
        id,
        name,
        contextId,
        tasks: [],
      },
    },
  };
}

export function addTask(system: System, id: string, label: string): System {
  return {
    ...system,
    tasks: {
      ...(system.tasks || {}),
      [id]: {
        id,
        label,
      },
    },
  };
}

export function addTaskToProcess(system: System, processId: string, taskId: string): System {
  if (!system.processes?.[processId]) {
    throw new Error(`Process "${processId}" does not exist`);
  }

  if (!system.tasks?.[taskId]) {
    throw new Error(`Task "${taskId}" does not exist`);
  }

  return {
    ...system,
    processes: {
      ...system.processes,
      [processId]: {
        ...system.processes[processId],
        tasks: [...(system.processes[processId].tasks || []), taskId],
      },
    },
  };
}

export function pipe<T>(...fns: Array<(arg: T) => T>): (arg: T) => T {
  return (arg: T) => fns.reduce((result, fn) => fn(result), arg);
}
