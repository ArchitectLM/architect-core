/**
 * Global DSL Type Declarations
 * 
 * This file provides TypeScript type definitions for the global DSL objects
 * that are available in DSL files without explicit imports.
 */

import { ProcessBuilder } from '../../src/core/builders/process-builder';
import { TaskBuilder } from '../../src/core/builders/task-builder';
import { ReactiveSystemBuilder } from '../../src/core/dsl/reactive-system';

declare global {
  /**
   * Global Process object for creating process definitions
   */
  const Process: {
    create: <S extends string = string, E extends string = string, C = Record<string, unknown>>(
      id: string
    ) => ProcessBuilder<S, E, C>;
  };

  /**
   * Global Task object for creating task definitions
   */
  const Task: {
    create: <I = any, O = any>(id: string) => TaskBuilder<I, O>;
  };

  /**
   * Global ReactiveSystem object for creating system definitions
   */
  const ReactiveSystem: {
    define: (id: string) => ReturnType<typeof ReactiveSystemBuilder.define>;
    getProcess: (id: string) => any;
    getTask: (id: string) => any;
    getSystem: (id: string) => any;
  };
}

export {}; 