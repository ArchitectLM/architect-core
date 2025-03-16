/**
 * Runtime implementations for ArchitectLM
 * 
 * This file exports the runtime implementations.
 */

import { 
  ProcessDefinition, 
  TaskDefinition, 
  Runtime 
} from '../../models';
import { ProcessManager } from './process-manager';
import { TaskManager } from './task-manager';
import { ReactiveRuntime, RuntimeOptions } from './reactive-runtime';
import { Plugin } from '../../dsl/plugin';

/**
 * Create a new runtime
 */
export function createRuntime(
  processes: Record<string, ProcessDefinition>,
  tasks: Record<string, TaskDefinition>,
  options: RuntimeOptions = {}
): ReactiveRuntime {
  return new ReactiveRuntime(processes, tasks, options);
}

/**
 * Create a new runtime with plugins
 */
export function createRuntimeWithPlugins(
  processes: Record<string, ProcessDefinition>,
  tasks: Record<string, TaskDefinition>,
  plugins: Plugin[],
  options: RuntimeOptions = {}
): ReactiveRuntime {
  return new ReactiveRuntime(
    processes,
    tasks,
    { ...options, plugins }
  );
}

export { 
  ReactiveRuntime, 
  ProcessManager, 
  TaskManager 
}; 