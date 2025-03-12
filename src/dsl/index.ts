/**
 * Hybrid DSL for Architect Framework
 * 
 * This module provides a hybrid DSL that combines functional programming principles
 * with a builder pattern approach for defining reactive systems.
 */

import { z } from 'zod';
import type { 
  ReactiveSystem, 
  BoundedContext, 
  Process, 
  Task, 
  Trigger, 
  Transition 
} from '../schema/types';
import { extensionRegistry } from '../schema/extensions/extension-registry';

/**
 * Type for a function that transforms a system
 */
type SystemTransformer = (system: ReactiveSystem) => ReactiveSystem;

/**
 * Type for a function that transforms a bounded context
 */
type ContextTransformer = (context: BoundedContext) => BoundedContext;

/**
 * Type for a function that transforms a process
 */
type ProcessTransformer = (process: Process) => Process;

/**
 * Type for a function that transforms a task
 */
type TaskTransformer = (task: Task) => Task;

/**
 * Creates a deep copy of an object to ensure immutability
 */
function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Composes multiple system transformers into a single transformer
 */
function composeTransformers(...transformers: SystemTransformer[]): SystemTransformer {
  return (system: ReactiveSystem) => 
    transformers.reduce((acc, transformer) => transformer(acc), deepCopy(system));
}

/**
 * System builder class that provides a fluent interface for building systems
 */
export class SystemBuilder {
  private system: ReactiveSystem;
  private transformers: SystemTransformer[] = [];

  /**
   * Creates a new system builder
   */
  private constructor(id: string, name: string, version: string) {
    this.system = {
      id,
      name,
      version,
      boundedContexts: {},
      processes: {},
      tasks: {}
    };
  }

  /**
   * Creates a new system builder
   */
  static create(id: string): SystemBuilder {
    return new SystemBuilder(id, id, '1.0.0');
  }

  /**
   * Sets the name of the system
   */
  withName(name: string): SystemBuilder {
    this.transformers.push(system => ({
      ...system,
      name
    }));
    return this;
  }

  /**
   * Sets the description of the system
   */
  withDescription(description: string): SystemBuilder {
    this.transformers.push(system => ({
      ...system,
      description
    }));
    return this;
  }

  /**
   * Sets the version of the system
   */
  withVersion(version: string): SystemBuilder {
    this.transformers.push(system => ({
      ...system,
      version
    }));
    return this;
  }

  /**
   * Adds a bounded context to the system
   */
  withBoundedContext(id: string, nameOrTransformer: string | ContextTransformer): SystemBuilder {
    if (typeof nameOrTransformer === 'string') {
      // Simple case: just provide a name
      this.transformers.push(system => ({
        ...system,
        boundedContexts: {
          ...system.boundedContexts,
          [id]: {
            id,
            name: nameOrTransformer,
            description: `${nameOrTransformer} bounded context`,
            processes: []
          }
        }
      }));
    } else {
      // Advanced case: provide a transformer function
      this.transformers.push(system => {
        const baseContext: BoundedContext = {
          id,
          name: id,
          description: `${id} bounded context`,
          processes: []
        };
        
        const transformedContext = nameOrTransformer(baseContext);
        
        return {
          ...system,
          boundedContexts: {
            ...system.boundedContexts,
            [id]: transformedContext
          }
        };
      });
    }
    
    return this;
  }

  /**
   * Adds a process to the system
   */
  withProcess(id: string, contextId: string, nameOrTransformer: string | ProcessTransformer): SystemBuilder {
    if (typeof nameOrTransformer === 'string') {
      // Simple case: just provide a name
      this.transformers.push(system => {
        // Ensure the context exists
        if (!system.boundedContexts?.[contextId]) {
          throw new Error(`Bounded context '${contextId}' does not exist`);
        }
        
        const baseProcess: Process = {
          id,
          name: nameOrTransformer,
          contextId,
          type: 'stateless',
          triggers: [],
          tasks: []
        };
        
        return {
          ...system,
          processes: {
            ...system.processes,
            [id]: baseProcess
          },
          boundedContexts: {
            ...system.boundedContexts,
            [contextId]: {
              ...system.boundedContexts[contextId],
              processes: [...(system.boundedContexts[contextId].processes || []), id]
            }
          }
        };
      });
    } else {
      // Advanced case: provide a transformer function
      this.transformers.push(system => {
        // Ensure the context exists
        if (!system.boundedContexts?.[contextId]) {
          throw new Error(`Bounded context '${contextId}' does not exist`);
        }
        
        const baseProcess: Process = {
          id,
          name: id,
          contextId,
          type: 'stateless',
          triggers: [],
          tasks: []
        };
        
        const transformedProcess = nameOrTransformer(baseProcess);
        
        return {
          ...system,
          processes: {
            ...system.processes,
            [id]: transformedProcess
          },
          boundedContexts: {
            ...system.boundedContexts,
            [contextId]: {
              ...system.boundedContexts[contextId],
              processes: [...(system.boundedContexts[contextId].processes || []), id]
            }
          }
        };
      });
    }
    
    return this;
  }

  /**
   * Adds a stateful process to the system
   */
  withStatefulProcess(
    id: string, 
    contextId: string, 
    config: {
      name: string;
      states: string[];
      transitions?: Array<{
        from: string;
        to: string;
        on: string;
        description?: string;
      }>;
    }
  ): SystemBuilder {
    this.transformers.push(system => {
      // Ensure the context exists
      if (!system.boundedContexts?.[contextId]) {
        throw new Error(`Bounded context '${contextId}' does not exist`);
      }
      
      const baseProcess: Process = {
        id,
        name: config.name,
        contextId,
        type: 'stateful',
        triggers: [],
        tasks: [],
        states: config.states,
        transitions: config.transitions || []
      };
      
      return {
        ...system,
        processes: {
          ...system.processes,
          [id]: baseProcess
        },
        boundedContexts: {
          ...system.boundedContexts,
          [contextId]: {
            ...system.boundedContexts[contextId],
            processes: [...(system.boundedContexts[contextId].processes || []), id]
          }
        }
      };
    });
    
    return this;
  }

  /**
   * Adds a task to the system
   */
  withTask(id: string, nameOrTransformer: string | TaskTransformer): SystemBuilder {
    if (typeof nameOrTransformer === 'string') {
      // Simple case: just provide a name
      this.transformers.push(system => {
        const baseTask: Task = {
          id,
          type: 'operation',
          label: nameOrTransformer
        };
        
        return {
          ...system,
          tasks: {
            ...system.tasks,
            [id]: baseTask
          }
        };
      });
    } else {
      // Advanced case: provide a transformer function
      this.transformers.push(system => {
        const baseTask: Task = {
          id,
          type: 'operation'
        };
        
        const transformedTask = nameOrTransformer(baseTask);
        
        return {
          ...system,
          tasks: {
            ...system.tasks,
            [id]: transformedTask
          }
        };
      });
    }
    
    return this;
  }

  /**
   * Adds a task to a process
   */
  withProcessTask(processId: string, taskId: string): SystemBuilder {
    this.transformers.push(system => {
      // Ensure the process exists
      if (!system.processes?.[processId]) {
        throw new Error(`Process '${processId}' does not exist`);
      }
      
      // Ensure the task exists
      if (!system.tasks?.[taskId]) {
        throw new Error(`Task '${taskId}' does not exist`);
      }
      
      return {
        ...system,
        processes: {
          ...system.processes,
          [processId]: {
            ...system.processes[processId],
            tasks: [...(system.processes[processId].tasks || []), taskId]
          }
        }
      };
    });
    
    return this;
  }

  /**
   * Adds an extension to the system
   */
  withExtension(extensionId: string, config: Record<string, any>): SystemBuilder {
    this.transformers.push(system => {
      const extension = extensionRegistry.getExtension(extensionId);
      if (!extension) {
        throw new Error(`Extension '${extensionId}' does not exist`);
      }
      
      return {
        ...system,
        [extensionId]: config
      };
    });
    
    return this;
  }

  /**
   * Applies a custom transformer to the system
   */
  transform(transformer: SystemTransformer): SystemBuilder {
    this.transformers.push(transformer);
    return this;
  }

  /**
   * Builds the system by applying all transformers
   */
  build(): ReactiveSystem {
    const result = composeTransformers(...this.transformers)(this.system);
    // Freeze the object to prevent mutations
    return Object.freeze(result);
  }

  /**
   * Validates the system and returns validation issues
   */
  validate(): { success: boolean; issues: Array<{ path: string; message: string; severity: 'error' | 'warning' }> } {
    const system = this.build();
    
    // Basic validation
    const issues: Array<{ path: string; message: string; severity: 'error' | 'warning' }> = [];
    
    // Check for required fields
    if (!system.id) {
      issues.push({ path: 'id', message: 'System ID is required', severity: 'error' });
    }
    
    if (!system.name) {
      issues.push({ path: 'name', message: 'System name is required', severity: 'error' });
    }
    
    if (!system.version) {
      issues.push({ path: 'version', message: 'System version is required', severity: 'error' });
    }
    
    // Check for process references in bounded contexts
    if (system.boundedContexts) {
      for (const [contextId, context] of Object.entries(system.boundedContexts)) {
        for (const processId of context.processes || []) {
          if (!system.processes?.[processId]) {
            issues.push({
              path: `boundedContexts.${contextId}.processes`,
              message: `Process '${processId}' referenced in bounded context '${contextId}' does not exist`,
              severity: 'error'
            });
          }
        }
      }
    }
    
    // Check for task references in processes
    if (system.processes) {
      for (const [processId, process] of Object.entries(system.processes)) {
        for (const taskId of process.tasks || []) {
          if (!system.tasks?.[taskId]) {
            issues.push({
              path: `processes.${processId}.tasks`,
              message: `Task '${taskId}' referenced in process '${processId}' does not exist`,
              severity: 'error'
            });
          }
        }
      }
    }
    
    // TODO: Add more validation rules
    
    return {
      success: !issues.some(issue => issue.severity === 'error'),
      issues
    };
  }
}

/**
 * Process builder class for more fluent process definition
 */
export class ProcessBuilder {
  private process: Process;
  
  constructor(id: string, name: string, contextId: string, type: 'stateful' | 'stateless' = 'stateless') {
    this.process = {
      id,
      name,
      contextId,
      type,
      triggers: [],
      tasks: []
    };
  }
  
  withType(type: 'stateful' | 'stateless'): ProcessBuilder {
    this.process = {
      ...this.process,
      type
    };
    return this;
  }
  
  withStates(states: string[]): ProcessBuilder {
    if (this.process.type !== 'stateful') {
      throw new Error('States can only be added to stateful processes');
    }
    
    this.process = {
      ...this.process,
      states
    };
    return this;
  }
  
  withTransition(from: string, to: string, on: string, description?: string): ProcessBuilder {
    if (this.process.type !== 'stateful') {
      throw new Error('Transitions can only be added to stateful processes');
    }
    
    const transition: Transition = {
      from,
      to,
      on,
      description
    };
    
    this.process = {
      ...this.process,
      transitions: [...(this.process.transitions || []), transition]
    };
    return this;
  }
  
  withTask(taskId: string): ProcessBuilder {
    this.process = {
      ...this.process,
      tasks: [...this.process.tasks, taskId]
    };
    return this;
  }
  
  withTrigger(trigger: Trigger): ProcessBuilder {
    this.process = {
      ...this.process,
      triggers: [...this.process.triggers, trigger]
    };
    return this;
  }
  
  build(): Process {
    return Object.freeze(this.process);
  }
}

/**
 * Task builder class for more fluent task definition
 */
export class TaskBuilder {
  private task: Task;
  
  constructor(id: string, type: Task['type'] = 'operation') {
    this.task = {
      id,
      type
    };
  }
  
  withLabel(label: string): TaskBuilder {
    this.task = {
      ...this.task,
      label
    };
    return this;
  }
  
  withDescription(description: string): TaskBuilder {
    this.task = {
      ...this.task,
      description
    };
    return this;
  }
  
  withInput(input: string | string[]): TaskBuilder {
    this.task = {
      ...this.task,
      input
    };
    return this;
  }
  
  withOutput(output: string | string[]): TaskBuilder {
    this.task = {
      ...this.task,
      output
    };
    return this;
  }
  
  build(): Task {
    return Object.freeze(this.task);
  }
}

/**
 * Helper functions for functional composition
 */

/**
 * Creates a new system
 */
export function createSystem(id: string, name: string, version: string): ReactiveSystem {
  return Object.freeze({
    id,
    name,
    version,
    boundedContexts: {},
    processes: {},
    tasks: {}
  });
}

/**
 * Adds a bounded context to a system
 */
export function addBoundedContext(
  system: ReactiveSystem, 
  id: string, 
  name: string, 
  description?: string
): ReactiveSystem {
  return Object.freeze({
    ...system,
    boundedContexts: {
      ...system.boundedContexts,
      [id]: {
        id,
        name,
        description: description || `${name} bounded context`,
        processes: []
      }
    }
  });
}

/**
 * Adds a process to a system
 */
export function addProcess(
  system: ReactiveSystem,
  id: string,
  name: string,
  contextId: string,
  type: 'stateful' | 'stateless' = 'stateless'
): ReactiveSystem {
  // Ensure the context exists
  if (!system.boundedContexts?.[contextId]) {
    throw new Error(`Bounded context '${contextId}' does not exist`);
  }
  
  return Object.freeze({
    ...system,
    processes: {
      ...system.processes,
      [id]: {
        id,
        name,
        contextId,
        type,
        triggers: [],
        tasks: []
      }
    },
    boundedContexts: {
      ...system.boundedContexts,
      [contextId]: {
        ...system.boundedContexts[contextId],
        processes: [...(system.boundedContexts[contextId].processes || []), id]
      }
    }
  });
}

/**
 * Adds a task to a system
 */
export function addTask(
  system: ReactiveSystem,
  id: string,
  type: Task['type'] = 'operation',
  label?: string
): ReactiveSystem {
  return Object.freeze({
    ...system,
    tasks: {
      ...system.tasks,
      [id]: {
        id,
        type,
        label
      }
    }
  });
}

/**
 * Adds a task to a process
 */
export function addTaskToProcess(
  system: ReactiveSystem,
  processId: string,
  taskId: string
): ReactiveSystem {
  // Ensure the process exists
  if (!system.processes?.[processId]) {
    throw new Error(`Process '${processId}' does not exist`);
  }
  
  // Ensure the task exists
  if (!system.tasks?.[taskId]) {
    throw new Error(`Task '${taskId}' does not exist`);
  }
  
  return Object.freeze({
    ...system,
    processes: {
      ...system.processes,
      [processId]: {
        ...system.processes[processId],
        tasks: [...(system.processes[processId].tasks || []), taskId]
      }
    }
  });
}

/**
 * Adds an extension to a system
 */
export function addExtension(
  system: ReactiveSystem,
  extensionId: string,
  config: Record<string, any>
): ReactiveSystem {
  const extension = extensionRegistry.getExtension(extensionId);
  if (!extension) {
    throw new Error(`Extension '${extensionId}' does not exist`);
  }
  
  return Object.freeze({
    ...system,
    [extensionId]: config
  });
}

/**
 * Composes multiple functions that transform a system
 */
export function pipe<T>(initial: T, ...fns: Array<(arg: T) => T>): T {
  return fns.reduce((acc, fn) => fn(acc), initial);
} 