export * from './interfaces/plugin';
export * from './builders/process-builder';
export * from './builders/task-builder';
export * from './builders/state-builder';
export * from './reactive-system';
export * from './types';

/**
 * Process class
 */
export class Process {
  /**
   * Create a new process
   */
  static create(id: string): any {
    const { ProcessBuilder } = require('./builders/process-builder');
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
    const { TaskBuilder } = require('./builders/task-builder');
    return TaskBuilder.create(id);
  }
}
