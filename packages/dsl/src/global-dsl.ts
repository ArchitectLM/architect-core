/**
 * Global DSL
 * 
 * This module provides a global DSL for defining reactive systems.
 */

import { ReactiveSystem, ReactiveSystemBuilder } from './reactive-system';
import { ProcessBuilder } from './builders/process-builder';
import { TaskBuilder } from './builders/task-builder';

/**
 * Create a new global DSL
 */
export function createGlobalDSL(): any {
  return {
    ReactiveSystem,
    ReactiveSystemBuilder,
    ProcessBuilder,
    TaskBuilder
  };
}
