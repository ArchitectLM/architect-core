/**
 * Global DSL Functions
 * 
 * This module provides functions to set up and reset global DSL objects
 * that can be used in DSL files without explicit imports.
 */

import { ProcessBuilder } from '../builders/process-builder';
import { TaskBuilder } from '../builders/task-builder';
import { ReactiveSystemBuilder } from './reactive-system';
import { registerProcess, registerTask, registerSystem, getProcess, getTask, getSystem } from './dsl-registry';

/**
 * Set up global DSL objects
 */
export function setupGlobalDSL(): void {
  // Define global Process object
  (global as any).Process = {
    create: <S extends string = string, E extends string = string, C = Record<string, unknown>>(
      id: string
    ) => {
      const process = ProcessBuilder.create<S, E, C>(id);
      const originalBuild = process.build;
      
      // Override the build method to automatically register the process
      process.build = function() {
        const builtProcess = originalBuild.call(this);
        registerProcess(id, builtProcess);
        return builtProcess;
      };
      
      return process;
    }
  };
  
  // Define global Task object
  (global as any).Task = {
    create: <I = any, O = any>(id: string) => {
      const task = TaskBuilder.create<I, O>(id);
      const originalBuild = task.build;
      
      // Override the build method to automatically register the task
      task.build = function() {
        const builtTask = originalBuild.call(this);
        registerTask(id, builtTask);
        return builtTask;
      };
      
      return task;
    }
  };
  
  // Define global ReactiveSystem object
  (global as any).ReactiveSystem = {
    define: (id: string) => {
      const system = ReactiveSystemBuilder.define(id);
      const originalBuild = system.build;
      
      // Override the build method to automatically register the system
      system.build = function() {
        const builtSystem = originalBuild.call(this);
        registerSystem(id, builtSystem);
        return builtSystem;
      };
      
      return system;
    },
    getProcess,
    getTask,
    getSystem
  };
}

/**
 * Reset global DSL objects
 */
export function resetGlobalDSL(): void {
  delete (global as any).Process;
  delete (global as any).Task;
  delete (global as any).ReactiveSystem;
} 