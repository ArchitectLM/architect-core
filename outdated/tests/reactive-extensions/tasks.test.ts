/**
 * Task Implementation Tests
 * 
 * Tests for the task implementations in our reactive system with the separation
 * between static core and dynamic LLM extensions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarkImportantTaskImpl } from '../../src/reactive-extensions/tasks/mark-important';
import { FilterImportantTodosTaskImpl } from '../../src/reactive-extensions/tasks/filter-important-todos';

describe('Task Implementations', () => {
  describe('MarkImportantTaskImpl', () => {
    // Mock dependencies
    const mockTodoRepository = {
      findById: vi.fn(),
      update: vi.fn()
    };
    
    const mockEventEmitter = {
      emit: vi.fn()
    };
    
    // Create task implementation
    let task: MarkImportantTaskImpl;
    
    beforeEach(() => {
      // Clear all mocks before each test
      vi.clearAllMocks();
      
      // Create task implementation
      task = new MarkImportantTaskImpl(mockTodoRepository, mockEventEmitter);
    });
    
    it('should mark a todo as important with valid priority', async () => {
      // Arrange
      const todo = { id: '123', title: 'Test Todo', completed: false };
      const updatedTodo = { ...todo, priority: 'high' };
      mockTodoRepository.findById.mockResolvedValue(todo);
      mockTodoRepository.update.mockResolvedValue(updatedTodo);
      
      // Act
      const result = await task.execute({ todoId: '123', priority: 'high' });
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.todo).toEqual(updatedTodo);
      expect(mockTodoRepository.findById).toHaveBeenCalledWith('123');
      expect(mockTodoRepository.update).toHaveBeenCalledWith('123', { priority: 'high' });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith({
        type: 'TODO_MARKED_IMPORTANT',
        payload: { id: '123', priority: 'high' }
      });
    });
    
    it('should fail when todo is not found', async () => {
      // Arrange
      mockTodoRepository.findById.mockResolvedValue(null);
      
      // Act
      const result = await task.execute({ todoId: '123', priority: 'high' });
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Todo not found');
      expect(mockTodoRepository.findById).toHaveBeenCalledWith('123');
      expect(mockTodoRepository.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
    
    it('should fail with invalid priority', async () => {
      // Arrange
      const todo = { id: '123', title: 'Test Todo', completed: false };
      mockTodoRepository.findById.mockResolvedValue(todo);
      
      // Act
      const result = await task.execute({ todoId: '123', priority: 'invalid' });
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid priority');
      expect(mockTodoRepository.findById).toHaveBeenCalledWith('123');
      expect(mockTodoRepository.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
    
    it('should fail when todoId is missing', async () => {
      // Act
      const result = await task.execute({ priority: 'high' });
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('todoId is required');
      expect(mockTodoRepository.findById).not.toHaveBeenCalled();
      expect(mockTodoRepository.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
    
    it('should fail when priority is missing', async () => {
      // Act
      const result = await task.execute({ todoId: '123' });
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('priority is required');
      expect(mockTodoRepository.findById).not.toHaveBeenCalled();
      expect(mockTodoRepository.update).not.toHaveBeenCalled();
      expect(mockEventEmitter.emit).not.toHaveBeenCalled();
    });
  });
  
  describe('FilterImportantTodosTaskImpl', () => {
    // Create task implementation
    let task: FilterImportantTodosTaskImpl;
    
    beforeEach(() => {
      // Create task implementation
      task = new FilterImportantTodosTaskImpl();
    });
    
    it('should filter todos with low priority and above', async () => {
      // Arrange
      const todos = [
        { id: '1', title: 'Task 1', priority: 'low' },
        { id: '2', title: 'Task 2', priority: 'medium' },
        { id: '3', title: 'Task 3', priority: 'high' },
        { id: '4', title: 'Task 4', priority: 'low' },
        { id: '5', title: 'Task 5' } // No priority
      ];
      
      // Act
      const result = await task.execute({ todos, minPriority: 'low' });
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.output.filteredTodos).toHaveLength(4);
      expect(result.output.filteredTodos.map(t => t.id)).toContain('1');
      expect(result.output.filteredTodos.map(t => t.id)).toContain('2');
      expect(result.output.filteredTodos.map(t => t.id)).toContain('3');
      expect(result.output.filteredTodos.map(t => t.id)).toContain('4');
    });
    
    it('should filter todos with medium priority and above', async () => {
      // Arrange
      const todos = [
        { id: '1', title: 'Task 1', priority: 'low' },
        { id: '2', title: 'Task 2', priority: 'medium' },
        { id: '3', title: 'Task 3', priority: 'high' },
        { id: '4', title: 'Task 4', priority: 'low' },
        { id: '5', title: 'Task 5' } // No priority
      ];
      
      // Act
      const result = await task.execute({ todos, minPriority: 'medium' });
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.output.filteredTodos).toHaveLength(2);
      expect(result.output.filteredTodos.map(t => t.id)).toContain('2');
      expect(result.output.filteredTodos.map(t => t.id)).toContain('3');
    });
    
    it('should filter todos with high priority only', async () => {
      // Arrange
      const todos = [
        { id: '1', title: 'Task 1', priority: 'low' },
        { id: '2', title: 'Task 2', priority: 'medium' },
        { id: '3', title: 'Task 3', priority: 'high' },
        { id: '4', title: 'Task 4', priority: 'low' },
        { id: '5', title: 'Task 5' } // No priority
      ];
      
      // Act
      const result = await task.execute({ todos, minPriority: 'high' });
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.output.filteredTodos).toHaveLength(1);
      expect(result.output.filteredTodos[0].id).toBe('3');
    });
    
    it('should default to low priority if not specified', async () => {
      // Arrange
      const todos = [
        { id: '1', title: 'Task 1', priority: 'low' },
        { id: '2', title: 'Task 2', priority: 'medium' },
        { id: '3', title: 'Task 3', priority: 'high' },
        { id: '4', title: 'Task 4', priority: 'low' },
        { id: '5', title: 'Task 5' } // No priority
      ];
      
      // Act
      const result = await task.execute({ todos });
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.output.filteredTodos).toHaveLength(4);
    });
    
    it('should fail with invalid todos input', async () => {
      // Act
      const result = await task.execute({ todos: 'not an array' });
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('todos must be an array');
    });
    
    it('should fail with invalid priority value', async () => {
      // Arrange
      const todos = [
        { id: '1', title: 'Task 1', priority: 'low' },
        { id: '2', title: 'Task 2', priority: 'medium' },
        { id: '3', title: 'Task 3', priority: 'high' }
      ];
      
      // Act
      const result = await task.execute({ todos, minPriority: 'invalid' });
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain('minPriority must be one of');
    });
  });
});