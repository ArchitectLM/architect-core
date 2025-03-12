/**
 * Todo Reactive System Example
 * 
 * This example demonstrates how to use the reactive system to build a simple Todo application.
 */

import { 
  ReactiveSystemRuntime,
  ReactiveTypes
} from '../src';

import { InMemoryTodoRepository } from '../src/reactive-extensions/repositories/todo-repository';
import { TodoProcessHandlers } from '../src/reactive-extensions/processes/todo-process';
import { TodoEventHandlers } from '../src/reactive-extensions/event-handlers/todo-handlers';
import { MarkImportantTaskImpl } from '../src/reactive-extensions/tasks/mark-important';
import { FilterImportantTodosTaskImpl } from '../src/reactive-extensions/tasks/filter-important-todos';
import { TodoProcess } from '../src/reactive-core/types/processes';
import { TodoFlows } from '../src/reactive-core/types/flows';

async function runExample() {
  console.log('Starting Todo Reactive System Example');
  
  // Create the runtime
  const runtime = new ReactiveSystemRuntime({ debug: true });
  
  // Create the repository
  const todoRepository = new InMemoryTodoRepository(runtime.getEventBus());
  
  // Create the process handlers
  const todoProcessHandlers = new TodoProcessHandlers(runtime.getEventBus());
  
  // Create the task implementations
  const markImportantTask = new MarkImportantTaskImpl(todoRepository, runtime.getEventBus());
  const filterImportantTodosTask = new FilterImportantTodosTaskImpl();
  
  // Create the event handlers
  const todoEventHandlers = new TodoEventHandlers(
    runtime.getEventBus(),
    runtime.getProcessEngine(),
    todoRepository
  );
  
  // Register the process
  runtime.registerProcess(TodoProcess, todoProcessHandlers);
  
  // Register the task implementations
  runtime.registerTaskImplementation(markImportantTask);
  runtime.registerTaskImplementation(filterImportantTodosTask);
  
  // Register the flows
  Object.values(TodoFlows).forEach(flow => {
    runtime.registerFlow(flow);
  });
  
  try {
    // Create some todos
    console.log('\nCreating todos...');
    const todo1 = await todoRepository.save({
      title: 'Low Priority Todo',
      description: 'This is a low priority todo',
      priority: 'low',
      completed: false,
      archived: false
    });
    
    const todo2 = await todoRepository.save({
      title: 'Medium Priority Todo',
      description: 'This is a medium priority todo',
      priority: 'medium',
      completed: false,
      archived: false
    });
    
    const todo3 = await todoRepository.save({
      title: 'High Priority Todo',
      description: 'This is a high priority todo',
      priority: 'high',
      completed: false,
      archived: false
    });
    
    console.log(`Created todos: ${todo1.id}, ${todo2.id}, ${todo3.id}`);
    
    // Execute the mark important flow
    console.log('\nExecuting mark important flow...');
    const markResult = await runtime.executeFlow('mark-important-flow', {
      todoId: todo1.id,
      priority: 'high'
    });
    
    console.log('Mark important flow result:', markResult);
    
    // Get all todos
    console.log('\nFetching all todos...');
    const allTodos = await todoRepository.findAll();
    console.log('All todos:', allTodos);
    
    // Filter important todos
    console.log('\nFiltering important todos...');
    const filterResult = await filterImportantTodosTask.execute({
      todos: allTodos,
      minPriority: 'high'
    });
    
    console.log('Filter result:', filterResult);
    console.log('Important todos:', filterResult.output?.filteredTodos);
    
    // Complete a todo
    console.log('\nCompleting a todo...');
    await todoRepository.update(todo2.id, {
      completed: true
    });
    
    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check process state
    console.log('\nChecking process states...');
    console.log(`Todo 1 state: ${runtime.getProcessState(`todo-${todo1.id}`)}`);
    console.log(`Todo 2 state: ${runtime.getProcessState(`todo-${todo2.id}`)}`);
    console.log(`Todo 3 state: ${runtime.getProcessState(`todo-${todo3.id}`)}`);
    
    // Archive a todo
    console.log('\nArchiving a todo...');
    await todoRepository.update(todo3.id, {
      archived: true
    });
    
    // Wait for event processing
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check process state again
    console.log('\nChecking process states again...');
    console.log(`Todo 1 state: ${runtime.getProcessState(`todo-${todo1.id}`)}`);
    console.log(`Todo 2 state: ${runtime.getProcessState(`todo-${todo2.id}`)}`);
    console.log(`Todo 3 state: ${runtime.getProcessState(`todo-${todo3.id}`)}`);
    
  } catch (error) {
    console.error('Error in example:', error);
  } finally {
    // Shutdown the runtime
    runtime.shutdown();
    console.log('\nTodo Reactive System Example completed');
  }
}

// Run the example
runExample().catch(console.error);