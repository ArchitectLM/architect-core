/**
 * Hybrid DSL for Architect Framework
 * 
 * This module provides a Domain-Specific Language (DSL) for defining reactive systems
 * in the Architect Framework. It combines functional programming principles with a
 * builder pattern approach, offering flexibility and expressiveness.
 */

import { ReactiveSystem, BoundedContext, Process, Task, Transition } from '../schema/types';
import { validateSystem, validateSystemWithResult } from '../schema/validation';
import { ExtensionValidationResult } from '../schema/extensions/extension-registry';

// Type definitions for transformers
export type SystemTransformer = (system: ReactiveSystem) => ReactiveSystem;
export type ContextTransformer = (context: BoundedContext) => BoundedContext;
export type ProcessTransformer = (process: Process) => Process;
export type TaskTransformer = (task: Task) => Task;

/**
 * Interface for migration history entry
 */
export interface MigrationHistoryEntry {
  fromVersion: string;
  toVersion: string;
  timestamp: string;
  description?: string;
}

/**
 * Interface for enhanced validation issue with context
 */
export interface EnhancedValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
  context?: {
    actual?: any;
    expected?: any;
    systemId?: string;
    processId?: string;
    taskId?: string;
    contextId?: string;
    processName?: string;
    taskName?: string;
    contextName?: string;
    llmHint?: string;
    suggestion?: string;
    [key: string]: any;
  };
}

/**
 * Interface for enhanced validation result
 */
export interface EnhancedValidationResult {
  success: boolean;
  issues: EnhancedValidationIssue[];
  metadata?: {
    validatedAt: string;
    systemId: string;
    systemName?: string;
    format?: string;
    [key: string]: any;
  };
}

/**
 * Deep copy function to ensure immutability of objects
 */
export function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Compose multiple system transformers into a single transformer
 */
export function composeTransformers(...transformers: SystemTransformer[]): SystemTransformer {
  return (system: ReactiveSystem) => 
    transformers.reduce((acc, transformer) => transformer(acc), system);
}

/**
 * Validate that a version string follows semantic versioning format
 */
export function validateVersionFormat(version: string): boolean {
  const semverRegex = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  return semverRegex.test(version);
}

/**
 * Validate state transitions in a process
 */
export function validateStateTransitions(process: Process): void {
  if (process.type !== 'stateful' || !process.states || !process.transitions) {
    return; // Only validate stateful processes with states and transitions
  }

  const availableStates = process.states;
  
  for (const transition of process.transitions) {
    if (!availableStates.includes(transition.from)) {
      throw new Error(`Invalid state "${transition.from}" in transition. Available states: ${availableStates.join(', ')}`);
    }
    
    if (!availableStates.includes(transition.to)) {
      throw new Error(`Invalid state "${transition.to}" in transition. Available states: ${availableStates.join(', ')}`);
    }
  }
}

/**
 * Validate all state transitions in a system
 */
export function validateAllStateTransitions(system: ReactiveSystem): void {
  if (!system.processes) return;
  
  for (const [processId, process] of Object.entries(system.processes)) {
    try {
      validateStateTransitions(process);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`${error.message.replace('in transition', `in transition for process "${processId}"`)}`);
      }
      throw error;
    }
  }
}

/**
 * Migrate a system schema to a new version
 */
export function migrateSchema(
  system: ReactiveSystem, 
  targetVersion: string, 
  transformer?: SystemTransformer,
  validate: boolean = true
): ReactiveSystem {
  if (!validateVersionFormat(targetVersion)) {
    throw new Error(`Invalid version format "${targetVersion}". Version should follow semantic versioning (e.g., 1.0.0).`);
  }
  
  const sourceVersion = system.version || '1.0.0';
  
  // Create a new system with the updated version
  let migratedSystem = deepCopy(system);
  
  // Apply the transformer if provided
  if (transformer) {
    migratedSystem = transformer(migratedSystem);
  }
  
  // Update version information
  migratedSystem.version = targetVersion;
  migratedSystem.schemaVersion = targetVersion;
  
  // Add migration history
  const migrationEntry: MigrationHistoryEntry = {
    fromVersion: sourceVersion,
    toVersion: targetVersion,
    timestamp: new Date().toISOString()
  };
  
  migratedSystem.migrationHistory = [
    ...(migratedSystem.migrationHistory || []),
    migrationEntry
  ];
  
  // Validate the migrated system if requested
  if (validate) {
    validateAllStateTransitions(migratedSystem);
    const validationResult = validateSystemWithResult(migratedSystem);
    if (!validationResult.success) {
      throw new Error(`Migration validation failed: ${validationResult.errors.map(e => e.message).join(', ')}`);
    }
  }
  
  return migratedSystem;
}

/**
 * SystemBuilder class for building reactive systems in a fluent manner
 */
export class SystemBuilder {
  private system: ReactiveSystem;

  private constructor(id: string) {
    if (!id) {
      throw new Error('System ID cannot be empty. Please provide a valid identifier for the system.');
    }
    
    this.system = {
      id,
      name: id,
      version: '1.0.0',
      boundedContexts: {},
      processes: {},
      tasks: {}
    };
  }

  /**
   * Create a new SystemBuilder with the given ID
   */
  static create(id: string): SystemBuilder {
    return new SystemBuilder(id);
  }

  /**
   * Set the name of the system
   */
  withName(name: string): SystemBuilder {
    const newBuilder = new SystemBuilder(this.system.id);
    newBuilder.system = {
      ...deepCopy(this.system),
      name
    };
    return newBuilder;
  }

  /**
   * Set the description of the system
   */
  withDescription(description: string): SystemBuilder {
    const newBuilder = new SystemBuilder(this.system.id);
    newBuilder.system = {
      ...deepCopy(this.system),
      description
    };
    return newBuilder;
  }

  /**
   * Set the version of the system
   */
  withVersion(version: string): SystemBuilder {
    if (!validateVersionFormat(version)) {
      throw new Error(`Invalid version format "${version}". Version should follow semantic versioning (e.g., 1.0.0).`);
    }
    
    const newBuilder = new SystemBuilder(this.system.id);
    newBuilder.system = {
      ...deepCopy(this.system),
      version
    };
    return newBuilder;
  }

  /**
   * Add a bounded context to the system
   */
  withBoundedContext(id: string, nameOrTransformer: string | ContextTransformer): SystemBuilder {
    const newBuilder = new SystemBuilder(this.system.id);
    const newSystem = deepCopy(this.system);
    
    const context: BoundedContext = {
      id,
      name: typeof nameOrTransformer === 'string' ? nameOrTransformer : id,
      description: typeof nameOrTransformer === 'string' ? `${nameOrTransformer} bounded context` : `${id} bounded context`,
      processes: []
    };

    if (typeof nameOrTransformer !== 'string') {
      const transformedContext = nameOrTransformer(context);
      newSystem.boundedContexts = {
        ...newSystem.boundedContexts,
        [id]: transformedContext
      };
    } else {
      newSystem.boundedContexts = {
        ...newSystem.boundedContexts,
        [id]: context
      };
    }

    newBuilder.system = newSystem;
    return newBuilder;
  }

  /**
   * Add a process to the system
   */
  withProcess(id: string, contextId: string, nameOrTransformer: string | ProcessTransformer): SystemBuilder {
    const newBuilder = new SystemBuilder(this.system.id);
    const newSystem = deepCopy(this.system);
    
    if (!newSystem.boundedContexts?.[contextId]) {
      throw new Error(`Bounded context "${contextId}" does not exist. Please create the bounded context before adding processes to it.`);
    }

    const process: Process = {
      id,
      name: typeof nameOrTransformer === 'string' ? nameOrTransformer : id,
      contextId,
      type: 'stateless',
      triggers: [],
      tasks: []
    };

    if (typeof nameOrTransformer !== 'string') {
      const transformedProcess = nameOrTransformer(process);
      newSystem.processes = {
        ...newSystem.processes,
        [id]: transformedProcess
      };
    } else {
      newSystem.processes = {
        ...newSystem.processes,
        [id]: process
      };
    }

    // Add process to bounded context
    if (newSystem.boundedContexts[contextId]) {
      newSystem.boundedContexts[contextId].processes = [
        ...(newSystem.boundedContexts[contextId].processes || []),
        id
      ];
    }

    newBuilder.system = newSystem;
    return newBuilder;
  }

  /**
   * Add a stateful process to the system
   */
  withStatefulProcess(id: string, contextId: string, options: {
    name: string;
    states: string[];
    transitions: Array<{ from: string; to: string; on: string }>;
  }): SystemBuilder {
    const newBuilder = new SystemBuilder(this.system.id);
    const newSystem = deepCopy(this.system);
    
    if (!newSystem.boundedContexts?.[contextId]) {
      throw new Error(`Bounded context "${contextId}" does not exist. Please create the bounded context before adding processes to it.`);
    }

    const process: Process = {
      id,
      name: options.name,
      contextId,
      type: 'stateful',
      states: options.states,
      transitions: options.transitions.map(t => ({
        from: t.from,
        to: t.to,
        on: t.on
      })),
      triggers: [],
      tasks: []
    };

    // Validate state transitions
    const availableStates = options.states;
    for (const transition of options.transitions) {
      if (!availableStates.includes(transition.from)) {
        throw new Error(`Invalid state "${transition.from}" in transition for process "${id}". Available states: ${availableStates.join(', ')}`);
      }
      
      if (!availableStates.includes(transition.to)) {
        throw new Error(`Invalid state "${transition.to}" in transition for process "${id}". Available states: ${availableStates.join(', ')}`);
      }
    }

    newSystem.processes = {
      ...newSystem.processes,
      [id]: process
    };

    // Add process to bounded context
    if (newSystem.boundedContexts[contextId]) {
      newSystem.boundedContexts[contextId].processes = [
        ...(newSystem.boundedContexts[contextId].processes || []),
        id
      ];
    }

    newBuilder.system = newSystem;
    return newBuilder;
  }

  /**
   * Add a task to the system
   */
  withTask(id: string, labelOrTransformer: string | TaskTransformer): SystemBuilder {
    const newBuilder = new SystemBuilder(this.system.id);
    const newSystem = deepCopy(this.system);
    
    const task: Task = {
      id,
      label: typeof labelOrTransformer === 'string' ? labelOrTransformer : id,
      type: 'operation'
    };

    if (typeof labelOrTransformer !== 'string') {
      const transformedTask = labelOrTransformer(task);
      newSystem.tasks = {
        ...newSystem.tasks,
        [id]: transformedTask
      };
    } else {
      newSystem.tasks = {
        ...newSystem.tasks,
        [id]: task
      };
    }

    newBuilder.system = newSystem;
    return newBuilder;
  }

  /**
   * Add a task to a process
   */
  withProcessTask(processId: string, taskId: string): SystemBuilder {
    const newBuilder = new SystemBuilder(this.system.id);
    const newSystem = deepCopy(this.system);
    
    if (!newSystem.processes?.[processId]) {
      throw new Error(`Process "${processId}" does not exist. Please create the process before adding tasks to it.`);
    }
    
    if (!newSystem.tasks?.[taskId]) {
      throw new Error(`Task "${taskId}" does not exist. Please create the task before adding it to a process.`);
    }
    
    newSystem.processes[processId].tasks = [
      ...(newSystem.processes[processId].tasks || []),
      taskId
    ];
    
    newBuilder.system = newSystem;
    return newBuilder;
  }

  /**
   * Apply a transformer function to the system
   */
  transform(transformer: SystemTransformer): SystemBuilder {
    const newBuilder = new SystemBuilder(this.system.id);
    newBuilder.system = transformer(deepCopy(this.system));
    return newBuilder;
  }

  /**
   * Validate the system
   */
  validate(): EnhancedValidationResult {
    try {
      // Validate state transitions first
      validateAllStateTransitions(this.system);
      
      // Then validate the entire system
      const result = validateSystemWithResult(this.system);
      
      // Convert to enhanced validation result
      const enhancedResult: EnhancedValidationResult = {
        success: result.success,
        issues: result.errors.map(error => ({
          path: error.path,
          message: error.message,
          severity: 'error',
          context: {
            systemId: this.system.id,
            systemName: this.system.name
          }
        })),
        metadata: {
          validatedAt: new Date().toISOString(),
          systemId: this.system.id,
          systemName: this.system.name,
          format: 'structured-for-llm'
        }
      };
      
      return enhancedResult;
    } catch (error) {
      if (error instanceof Error) {
        return {
          success: false,
          issues: [{
            path: 'system',
            message: error.message,
            severity: 'error',
            context: {
              systemId: this.system.id,
              systemName: this.system.name,
              llmHint: 'Check the system structure for validation errors'
            }
          }],
          metadata: {
            validatedAt: new Date().toISOString(),
            systemId: this.system.id,
            systemName: this.system.name,
            format: 'structured-for-llm'
          }
        };
      }
      
      throw error;
    }
  }

  /**
   * Build the system
   */
  build(): ReactiveSystem {
    // Validate state transitions before returning
    validateAllStateTransitions(this.system);
    return deepCopy(this.system);
  }
}

/**
 * ProcessBuilder class for building processes in a fluent manner
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
    
    if (type === 'stateful') {
      this.process.states = [];
      this.process.transitions = [];
    }
  }

  /**
   * Set the type of the process
   */
  withType(type: 'stateful' | 'stateless'): ProcessBuilder {
    const newBuilder = new ProcessBuilder(this.process.id, this.process.name, this.process.contextId);
    newBuilder.process = {
      ...deepCopy(this.process),
      type
    };
    
    if (type === 'stateful' && !newBuilder.process.states) {
      newBuilder.process.states = [];
      newBuilder.process.transitions = [];
    }
    
    return newBuilder;
  }

  /**
   * Set the states of the process
   */
  withStates(states: string[]): ProcessBuilder {
    if (this.process.type !== 'stateful') {
      throw new Error('States can only be added to stateful processes. Set the process type to "stateful" first.');
    }
    
    const newBuilder = new ProcessBuilder(this.process.id, this.process.name, this.process.contextId, 'stateful');
    newBuilder.process = {
      ...deepCopy(this.process),
      states
    };
    return newBuilder;
  }

  /**
   * Add a transition to the process
   */
  withTransition(from: string, to: string, on: string): ProcessBuilder {
    if (this.process.type !== 'stateful') {
      throw new Error('Transitions can only be added to stateful processes. Set the process type to "stateful" first.');
    }
    
    // Validate states
    const availableStates = this.process.states || [];
    if (!availableStates.includes(from)) {
      throw new Error(`Invalid state "${from}" in transition. Available states: ${availableStates.join(', ')}`);
    }
    
    if (!availableStates.includes(to)) {
      throw new Error(`Invalid state "${to}" in transition. Available states: ${availableStates.join(', ')}`);
    }
    
    const newBuilder = new ProcessBuilder(this.process.id, this.process.name, this.process.contextId, 'stateful');
    newBuilder.process = {
      ...deepCopy(this.process),
      transitions: [
        ...(this.process.transitions || []),
        { from, to, on }
      ]
    };
    return newBuilder;
  }

  /**
   * Add a task to the process
   */
  withTask(taskId: string): ProcessBuilder {
    const newBuilder = new ProcessBuilder(this.process.id, this.process.name, this.process.contextId, this.process.type);
    newBuilder.process = {
      ...deepCopy(this.process),
      tasks: [
        ...(this.process.tasks || []),
        taskId
      ]
    };
    return newBuilder;
  }

  /**
   * Build the process
   */
  build(): Process {
    // Validate state transitions before returning
    if (this.process.type === 'stateful') {
      validateStateTransitions(this.process);
    }
    return deepCopy(this.process);
  }
}

/**
 * TaskBuilder class for building tasks in a fluent manner
 */
export class TaskBuilder {
  private task: Task;

  constructor(id: string) {
    this.task = {
      id,
      type: 'operation'
    };
  }

  /**
   * Set the label of the task
   */
  withLabel(label: string): TaskBuilder {
    const newBuilder = new TaskBuilder(this.task.id);
    newBuilder.task = {
      ...deepCopy(this.task),
      label
    };
    return newBuilder;
  }

  /**
   * Set the description of the task
   */
  withDescription(description: string): TaskBuilder {
    const newBuilder = new TaskBuilder(this.task.id);
    newBuilder.task = {
      ...deepCopy(this.task),
      description
    };
    return newBuilder;
  }

  /**
   * Set the type of the task
   */
  withType(type: "operation" | "condition" | "transformation" | "notification" | "external_call" | "state_transition"): TaskBuilder {
    const newBuilder = new TaskBuilder(this.task.id);
    newBuilder.task = {
      ...deepCopy(this.task),
      type
    };
    return newBuilder;
  }

  /**
   * Set the input parameters of the task
   */
  withInput(input: string[]): TaskBuilder {
    const newBuilder = new TaskBuilder(this.task.id);
    newBuilder.task = {
      ...deepCopy(this.task),
      input
    };
    return newBuilder;
  }

  /**
   * Set the output parameters of the task
   */
  withOutput(output: string[]): TaskBuilder {
    const newBuilder = new TaskBuilder(this.task.id);
    newBuilder.task = {
      ...deepCopy(this.task),
      output
    };
    return newBuilder;
  }

  /**
   * Build the final task
   */
  build(): Task {
    return deepCopy(this.task);
  }
}

// Functional API

/**
 * Create a new reactive system
 */
export function createSystem(id: string, name?: string, version?: string): ReactiveSystem {
  return {
    id,
    name: name || id,
    version: version || '1.0.0',
    boundedContexts: {},
    processes: {},
    tasks: {}
  };
}

/**
 * Add a bounded context to a system
 */
export function addBoundedContext(
  system: ReactiveSystem, 
  id: string, 
  name: string, 
  description?: string
): ReactiveSystem {
  const newSystem = deepCopy(system);
  
  newSystem.boundedContexts = {
    ...newSystem.boundedContexts,
    [id]: {
      id,
      name,
      description: description || `${name} bounded context`,
      processes: []
    }
  };
  
  return newSystem;
}

/**
 * Add a process to a system
 */
export function addProcess(
  system: ReactiveSystem, 
  id: string, 
  name: string, 
  contextId: string,
  type: 'stateful' | 'stateless' = 'stateless'
): ReactiveSystem {
  const newSystem = deepCopy(system);
  
  if (!newSystem.boundedContexts?.[contextId]) {
    throw new Error(`Bounded context '${contextId}' does not exist`);
  }
  
  newSystem.processes = {
    ...newSystem.processes,
    [id]: {
      id,
      name,
      contextId,
      type,
      triggers: [],
      tasks: []
    }
  };
  
  // Add process to bounded context
  if (newSystem.boundedContexts[contextId]) {
    newSystem.boundedContexts[contextId].processes = [
      ...(newSystem.boundedContexts[contextId].processes || []),
      id
    ];
  }
  
  return newSystem;
}

/**
 * Add a task to a system
 */
export function addTask(
  system: ReactiveSystem, 
  id: string, 
  type: "operation" | "condition" | "transformation" | "notification" | "external_call" | "state_transition", 
  label: string
): ReactiveSystem {
  const newSystem = deepCopy(system);
  
  newSystem.tasks = {
    ...newSystem.tasks,
    [id]: {
      id,
      type,
      label
    }
  };
  
  return newSystem;
}

/**
 * Add a task to a process
 */
export function addTaskToProcess(
  system: ReactiveSystem, 
  processId: string, 
  taskId: string
): ReactiveSystem {
  const newSystem = deepCopy(system);
  
  if (!newSystem.processes?.[processId]) {
    throw new Error(`Process '${processId}' does not exist`);
  }
  
  if (!newSystem.tasks?.[taskId]) {
    throw new Error(`Task '${taskId}' does not exist`);
  }
  
  // Add task to process
  if (newSystem.processes[processId]) {
    newSystem.processes[processId].tasks = [
      ...(newSystem.processes[processId].tasks || []),
      taskId
    ];
  }
  
  return newSystem;
}

/**
 * Functional composition utility
 */
export function pipe<T>(initial: T, ...fns: Array<(arg: T) => T>): T {
  return fns.reduce((acc, fn) => fn(acc), initial);
} 