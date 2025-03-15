export * from './interfaces/plugin';
export * from './builders/process-builder';
export * from './builders/task-builder';
export * from './builders/state-builder';
export * from './reactive-system';
export * from './types';

import { ProcessBuilder } from './builders/process-builder';
import { TaskBuilder } from './builders/task-builder';
import { ReactiveSystemBuilder } from './reactive-system';
import { createRuntime as createReactiveRuntime } from './runtime';

/**
 * Process class
 */
export class Process {
  /**
   * Create a new process
   */
  static create(id: string): any {
    return ProcessBuilder.create(id);
  }
}

/**
 * Task class
 */
export class Task {
  /**
   * Create a new task
   */
  static create<TInput = any, TOutput = any>(id: string): any {
    return TaskBuilder.create(id);
  }
}

/**
 * System class
 */
export class System {
  /**
   * Create a new system
   */
  static create(id: string): any {
    return ReactiveSystemBuilder.create(id);
  }
}

/**
 * Create a runtime for a system
 */
export function createRuntime(system: any): any {
  return createReactiveRuntime(system);
}
