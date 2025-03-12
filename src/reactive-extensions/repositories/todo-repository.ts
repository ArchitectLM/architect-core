/**
 * Todo Repository
 * 
 * This module provides an implementation of the Todo repository.
 */

import { EventBus } from '../../reactive-core/types/events';
import { Todo, TodoRepository } from '../../reactive-core/types/models';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory Todo repository implementation
 */
export class InMemoryTodoRepository implements TodoRepository {
  /**
   * Todos
   */
  private todos: Map<string, Todo> = new Map();
  
  /**
   * Event bus
   */
  private eventBus: EventBus;
  
  /**
   * Constructor
   * @param eventBus Event bus
   */
  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }
  
  /**
   * Find a todo by ID
   * @param id Todo ID
   * @returns The todo or undefined if not found
   */
  async findById(id: string): Promise<Todo | undefined> {
    return this.todos.get(id);
  }
  
  /**
   * Find all todos
   * @returns All todos
   */
  async findAll(): Promise<Todo[]> {
    return Array.from(this.todos.values());
  }
  
  /**
   * Find todos by criteria
   * @param criteria Search criteria
   * @returns Matching todos
   */
  async findBy(criteria: Partial<Todo>): Promise<Todo[]> {
    return Array.from(this.todos.values()).filter(todo => {
      // Check each criteria
      for (const [key, value] of Object.entries(criteria)) {
        if (todo[key as keyof Todo] !== value) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * Save a todo
   * @param todo Todo to save
   * @returns The saved todo
   */
  async save(todo: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Promise<Todo> {
    // Generate an ID
    const id = uuidv4();
    
    // Create the todo
    const now = new Date().toISOString();
    const newTodo: Todo = {
      id,
      ...todo,
      completed: todo.completed ?? false,
      archived: todo.archived ?? false,
      createdAt: now,
      updatedAt: now
    };
    
    // Store the todo
    this.todos.set(id, newTodo);
    
    // Emit an event
    this.eventBus.emit({
      type: 'TODO_CREATED',
      payload: newTodo
    });
    
    return newTodo;
  }
  
  /**
   * Update a todo
   * @param id Todo ID
   * @param todo Todo data to update
   * @returns The updated todo
   */
  async update(id: string, todo: Partial<Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Todo> {
    // Get the todo
    const existingTodo = this.todos.get(id);
    if (!existingTodo) {
      throw new Error(`Todo not found: ${id}`);
    }
    
    // Update the todo
    const updatedTodo: Todo = {
      ...existingTodo,
      ...todo,
      updatedAt: new Date().toISOString()
    };
    
    // Store the todo
    this.todos.set(id, updatedTodo);
    
    // Emit an event
    this.eventBus.emit({
      type: 'TODO_UPDATED',
      payload: {
        id,
        changes: todo
      }
    });
    
    // If the todo was completed, emit a completed event
    if (todo.completed && !existingTodo.completed) {
      this.eventBus.emit({
        type: 'TODO_COMPLETED',
        payload: {
          todoId: id,
          timestamp: updatedTodo.updatedAt
        }
      });
    }
    
    // If the todo was archived, emit an archived event
    if (todo.archived && !existingTodo.archived) {
      this.eventBus.emit({
        type: 'TODO_ARCHIVED',
        payload: {
          todoId: id,
          timestamp: updatedTodo.updatedAt
        }
      });
    }
    
    return updatedTodo;
  }
  
  /**
   * Delete a todo
   * @param id Todo ID
   * @returns Whether the todo was deleted
   */
  async delete(id: string): Promise<boolean> {
    // Check if the todo exists
    if (!this.todos.has(id)) {
      return false;
    }
    
    // Delete the todo
    this.todos.delete(id);
    
    // Emit an event
    this.eventBus.emit({
      type: 'TODO_DELETED',
      payload: {
        id
      }
    });
    
    return true;
  }
}