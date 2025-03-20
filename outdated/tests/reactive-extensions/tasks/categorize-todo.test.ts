/**
 * Categorize Todo Task Tests
 * 
 * Tests for the categorize-todo task implementation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CategorizeTodoTaskImpl } from '../../../src/reactive-extensions/tasks/categorize-todo';
import { Todo } from '../../../src/reactive-core/types/models';

describe('Categorize Todo Task', () => {
  // Create a mock todo
  const mockTodo: Todo = {
    id: '123',
    title: 'Test Todo',
    description: 'Test description',
    completed: false,
    archived: false,
    categories: ['existing'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Mock dependencies
  const mockTodoRepository = {
    findById: vi.fn().mockResolvedValue(mockTodo),
    findAll: vi.fn().mockResolvedValue([mockTodo]),
    findBy: vi.fn().mockResolvedValue([mockTodo]),
    save: vi.fn().mockResolvedValue(mockTodo),
    update: vi.fn().mockResolvedValue({...mockTodo, categories: ['existing', 'new']}),
    delete: vi.fn().mockResolvedValue(true)
  };

  // Mock event bus
  const mockEventBus = {
    emit: vi.fn(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    subscribeToAll: vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
  };
  
  // Create task implementation
  const categorizeTodoTask = new CategorizeTodoTaskImpl(
    mockTodoRepository as any,
    mockEventBus as any
  );
  
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });
  
  it('should categorize a todo successfully', async () => {
    // Arrange
    const input = {
      todoId: '123',
      categories: ['new']
    };
    
    // Act
    const result = await categorizeTodoTask.execute(input);
    
    // Assert
    expect(result.success).toBe(true);
    expect(result.output).toEqual({
      updated: true,
      categories: ['existing', 'new']
    });
    expect(mockTodoRepository.findById).toHaveBeenCalledWith('123');
    expect(mockTodoRepository.update).toHaveBeenCalledWith('123', {
      categories: ['existing', 'new']
    });
    expect(mockEventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'TODO_CATEGORIZED',
      payload: expect.objectContaining({
        todoId: '123',
        categories: ['existing', 'new'],
        addedCategories: ['new']
      })
    }));
  });
  
  it('should fail if todo is not found', async () => {
    // Arrange
    mockTodoRepository.findById.mockResolvedValueOnce(undefined);
    
    const input = {
      todoId: 'non-existent',
      categories: ['new']
    };
    
    // Act
    const result = await categorizeTodoTask.execute(input);
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('Todo not found');
    expect(mockTodoRepository.update).not.toHaveBeenCalled();
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });
  
  it('should fail if categories is empty', async () => {
    // Arrange
    const input = {
      todoId: '123',
      categories: []
    };
    
    // Act
    const result = await categorizeTodoTask.execute(input);
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('categories must be a non-empty array');
    expect(mockTodoRepository.findById).not.toHaveBeenCalled();
    expect(mockTodoRepository.update).not.toHaveBeenCalled();
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });
  
  it('should handle repository errors gracefully', async () => {
    // Arrange
    mockTodoRepository.update.mockRejectedValueOnce(new Error('Database error'));
    
    const input = {
      todoId: '123',
      categories: ['new']
    };
    
    // Act
    const result = await categorizeTodoTask.execute(input);
    
    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('Database error');
    expect(mockTodoRepository.findById).toHaveBeenCalled();
    expect(mockTodoRepository.update).toHaveBeenCalled();
    expect(mockEventBus.emit).not.toHaveBeenCalled();
  });
}); 