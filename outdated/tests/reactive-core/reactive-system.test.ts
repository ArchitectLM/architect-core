/**
 * Reactive System Tests
 * 
 * This module tests the reactive system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReactiveSystemRuntime } from '../../src/reactive-core/lib/runtime';
import { TodoProcess } from '../../src/reactive-core/types/processes';
import { TodoTasks } from '../../src/reactive-core/types/tasks';
import { TodoFlows } from '../../src/reactive-core/types/flows';
import { InMemoryTodoRepository } from '../../src/reactive-extensions/repositories/todo-repository';
import { TodoProcessHandlers } from '../../src/reactive-extensions/processes/todo-process';
import { TodoEventHandlers } from '../../src/reactive-extensions/event-handlers/todo-handlers';
import { MarkImportantTaskImpl } from '../../src/reactive-extensions/tasks/mark-important';
import { FilterImportantTodosTaskImpl } from '../../src/reactive-extensions/tasks/filter-important-todos';
import { ReactiveEventBus } from '../../src/reactive-core/lib/events';

describe('Reactive System', () => {
  let runtime: ReactiveSystemRuntime;
  let todoRepository: InMemoryTodoRepository;
  let todoProcessHandlers: TodoProcessHandlers;
  let todoEventHandlers: TodoEventHandlers;
  let markImportantTask: MarkImportantTaskImpl;
  let filterImportantTodosTask: FilterImportantTodosTaskImpl;
  
  beforeEach(() => {
    // Create the runtime
    runtime = new ReactiveSystemRuntime({ debug: false });
    
    // Create the repository
    todoRepository = new InMemoryTodoRepository(runtime.getEventBus());
    
    // Create the process handlers
    todoProcessHandlers = new TodoProcessHandlers(runtime.getEventBus());
    
    // Create the task implementations
    markImportantTask = new MarkImportantTaskImpl(todoRepository, runtime.getEventBus());
    filterImportantTodosTask = new FilterImportantTodosTaskImpl();
    
    // Create the event handlers
    todoEventHandlers = new TodoEventHandlers(
      runtime.getEventBus(),
      runtime.getProcessEngine(),
      todoRepository
    );
    
    // Register the process
    runtime.registerProcess(TodoProcess, todoProcessHandlers);
    
    // Register the task implementations
    runtime.registerTaskImplementation(markImportantTask);
    runtime.registerTaskImplementation(filterImportantTodosTask);
    
    // Register a mock handle-error task
    runtime.registerTaskImplementation({
      taskId: 'handle-error',
      execute: async (input: any) => {
        return {
          success: true,
          output: {
            handled: true,
            errorType: input.errorType || 'unknown',
            message: input.message || 'Error handled'
          }
        };
      }
    });
    
    // Register the flows
    Object.values(TodoFlows).forEach(flow => {
      runtime.registerFlow(flow);
    });
  });
  
  afterEach(() => {
    // Shutdown the runtime
    runtime.shutdown();
  });
  
  describe('Todo Management', () => {
    it('should create a todo', async () => {
      // Create a todo
      const todo = await todoRepository.save({
        title: 'Test Todo',
        description: 'This is a test todo',
        completed: false,
        archived: false
      });
      
      // Check if the todo was created
      expect(todo).toBeDefined();
      expect(todo.id).toBeDefined();
      expect(todo.title).toBe('Test Todo');
      expect(todo.description).toBe('This is a test todo');
      expect(todo.completed).toBe(false);
      expect(todo.archived).toBe(false);
      
      // Check if a process instance was created
      const state = runtime.getProcessState(`todo-${todo.id}`);
      expect(state).toBe('active');
    });
    
    it('should mark a todo as important', async () => {
      // Create a todo
      const todo = await todoRepository.save({
        title: 'Important Todo',
        description: 'This is an important todo',
        completed: false,
        archived: false
      });
      
      // Mark the todo as important
      const result = await markImportantTask.execute({
        todoId: todo.id,
        priority: 'high'
      });
      
      // Check if the task was successful
      expect(result.success).toBe(true);
      expect(result.output?.updated).toBe(true);
      expect(result.output?.priority).toBe('high');
      
      // Check if the todo was updated
      const updatedTodo = await todoRepository.findById(todo.id);
      expect(updatedTodo).toBeDefined();
      expect(updatedTodo?.priority).toBe('high');
    });
    
    it('should filter important todos', async () => {
      // Create todos with different priorities
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
      
      // Get all todos
      const allTodos = await todoRepository.findAll();
      
      // Filter todos with medium priority and above
      const result = await filterImportantTodosTask.execute({
        todos: allTodos,
        minPriority: 'medium'
      });
      
      // Check if the task was successful
      expect(result.success).toBe(true);
      expect(result.output?.filteredTodos).toBeDefined();
      expect(result.output?.filteredTodos.length).toBe(2);
      
      // Check if the filtered todos have the correct priorities
      const filteredTodos = result.output?.filteredTodos || [];
      expect(filteredTodos.some(todo => todo.id === todo2.id)).toBe(true);
      expect(filteredTodos.some(todo => todo.id === todo3.id)).toBe(true);
      expect(filteredTodos.some(todo => todo.id === todo1.id)).toBe(false);
    });
    
    it('should complete a todo', async () => {
      // Create a todo
      const todo = await todoRepository.save({
        title: 'Todo to Complete',
        description: 'This todo will be completed',
        completed: false,
        archived: false
      });
      
      // Complete the todo
      await todoRepository.update(todo.id, {
        completed: true
      });
      
      // Check if the todo was updated
      const updatedTodo = await todoRepository.findById(todo.id);
      expect(updatedTodo).toBeDefined();
      expect(updatedTodo?.completed).toBe(true);
      
      // Check if the process state was updated
      // Note: This might take a moment due to event handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const state = runtime.getProcessState(`todo-${todo.id}`);
      expect(state).toBe('completed');
    });
    
    it('should archive a todo', async () => {
      // Create a todo
      const todo = await todoRepository.save({
        title: 'Todo to Archive',
        description: 'This todo will be archived',
        completed: false,
        archived: false
      });
      
      // Archive the todo
      await todoRepository.update(todo.id, {
        archived: true
      });
      
      // Check if the todo was updated
      const updatedTodo = await todoRepository.findById(todo.id);
      expect(updatedTodo).toBeDefined();
      expect(updatedTodo?.archived).toBe(true);
      
      // Check if the process state was updated
      // Note: This might take a moment due to event handling
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const state = runtime.getProcessState(`todo-${todo.id}`);
      expect(state).toBe('archived');
    });
  });
  
  describe('Flow Execution', () => {
    it('should execute the mark important flow', async () => {
      // Create a todo
      const todo = await todoRepository.save({
        title: 'Flow Todo',
        description: 'This todo will be marked as important via a flow',
        completed: false,
        archived: false
      });
      
      // Execute the flow
      const result = await runtime.executeFlow('mark-important-flow', {
        todoId: todo.id,
        priority: 'high'
      });
      
      // Check if the flow was successful
      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      
      // Check if the todo was updated
      const updatedTodo = await todoRepository.findById(todo.id);
      expect(updatedTodo).toBeDefined();
      expect(updatedTodo?.priority).toBe('high');
    });
  });
});