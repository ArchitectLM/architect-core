// Original exports - using namespaced imports to avoid conflicts
import * as SchemaTypes from './schema/types';
import * as SchemaValidation from './schema/validation';
import * as ProcessValidation from './schema/process-validation';

// Re-export schema modules
export { SchemaTypes, SchemaValidation, ProcessValidation };

// Reactive Core - using namespaced exports to avoid conflicts
import * as ReactiveTypes from './reactive-core/types';
import { ReactiveSystemRuntime } from './reactive-core/lib/runtime';
import { ReactiveEventBus } from './reactive-core/lib/events';
import { ReactiveProcessEngine } from './reactive-core/lib/process';
import { ReactiveFlowEngine } from './reactive-core/lib/flow';

// Reactive Extensions
import { InMemoryTodoRepository } from './reactive-extensions/repositories/todo-repository';
import { TodoProcessHandlers } from './reactive-extensions/processes/todo-process';
import { MarkImportantTaskImpl } from './reactive-extensions/tasks/mark-important';
import { FilterImportantTodosTaskImpl } from './reactive-extensions/tasks/filter-important-todos';
import { TodoEventHandlers } from './reactive-extensions/event-handlers/todo-handlers';

// Export reactive system components
export {
  ReactiveTypes,
  ReactiveSystemRuntime,
  ReactiveEventBus,
  ReactiveProcessEngine,
  ReactiveFlowEngine,
  InMemoryTodoRepository,
  TodoProcessHandlers,
  MarkImportantTaskImpl,
  FilterImportantTodosTaskImpl,
  TodoEventHandlers
};

export const VERSION = '0.1.0';
