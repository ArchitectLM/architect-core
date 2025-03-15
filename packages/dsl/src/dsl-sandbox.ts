/**
 * DSL Sandbox
 * 
 * This module provides a sandbox environment for executing DSL code.
 */

import { ReactiveSystem, ReactiveSystemBuilder } from './reactive-system';
import { ProcessBuilder } from './builders/process-builder';
import { TaskBuilder } from './builders/task-builder';

/**
 * Create a new DSL sandbox
 */
export function createDSLSandbox(): any {
  return {
    ReactiveSystem,
    ReactiveSystemBuilder,
    ProcessBuilder,
    TaskBuilder
  };
}
