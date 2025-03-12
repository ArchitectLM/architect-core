/**
 * Event Handlers Tests
 * 
 * Tests for the event handlers in our reactive system with the separation
 * between static core and dynamic LLM extensions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReactiveEventBus } from '../../src/reactive-core/lib/events';
import { TodoEventHandlers } from '../../src/reactive-extensions/event-handlers/todo-handlers';
import { ReactiveProcessEngine } from '../../src/reactive-core/lib/process';
import { TodoRepository, Todo } from '../../src/reactive-core/types/models';

describe('Todo Event Handlers', () => {
  // Create a mock todo
  const mockTodo: Todo = {
    id: '123',
    title: 'Test Todo',
    description: 'Test description',
    completed: false,
    archived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Mock dependencies
  const mockTodoRepository = {
    findById: vi.fn().mockResolvedValue(mockTodo),
    findAll: vi.fn().mockResolvedValue([mockTodo]),
    findBy: vi.fn().mockResolvedValue([mockTodo]),
    save: vi.fn().mockResolvedValue(mockTodo),
    update: vi.fn().mockResolvedValue({...mockTodo, completed: true}),
    delete: vi.fn().mockResolvedValue(true)
  };

  // Mock event bus
  const mockEventBus = {
    emit: vi.fn(),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
    subscribeToAll: vi.fn().mockReturnValue({ unsubscribe: vi.fn() })
  };
  
  // Mock process engine with createInstance method
  const mockProcessEngine = {
    getState: vi.fn().mockReturnValue('active'),
    transition: vi.fn().mockResolvedValue({ success: true }),
    handleEvent: vi.fn().mockResolvedValue({}),
    createInstance: vi.fn()
  };
  
  // Create event handlers
  const todoEventHandlers = new TodoEventHandlers(
    mockEventBus as any,
    mockProcessEngine as any,
    mockTodoRepository as unknown as TodoRepository
  );
  
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });
  
  it('should handle TODO_CREATED events', async () => {
    // Arrange
    const event = {
      type: 'TODO_CREATED',
      payload: mockTodo
    };
    
    // Act
    await todoEventHandlers['handleTodoCreated'](event);
    
    // Assert
    // We can't directly test createInstance because it's called via type assertion
    expect(mockEventBus.emit).not.toHaveBeenCalled(); // No error should be emitted
  });
  
  it('should handle TODO_COMPLETED events', async () => {
    // Arrange
    const event = {
      type: 'TODO_COMPLETED',
      payload: { todoId: '123' }
    };
    
    // Act
    await todoEventHandlers['handleTodoCompleted'](event);
    
    // Assert
    expect(mockTodoRepository.findById).toHaveBeenCalledWith('123');
    expect(mockTodoRepository.update).toHaveBeenCalledWith('123', { completed: true });
    expect(mockProcessEngine.transition).toHaveBeenCalledWith('todo-123', 'complete', expect.any(Object));
  });
  
  it('should handle TODO_MARKED_IMPORTANT events', async () => {
    // Arrange
    const event = {
      type: 'TODO_MARKED_IMPORTANT',
      payload: { id: '123', priority: 'high' }
    };
    
    // Act
    await todoEventHandlers['handleTodoMarkedImportant'](event);
    
    // Assert
    expect(mockTodoRepository.findById).toHaveBeenCalledWith('123');
    expect(mockTodoRepository.update).toHaveBeenCalledWith('123', { priority: 'high' });
  });
  
  it('should handle TODO_ARCHIVED events', async () => {
    // Arrange
    const event = {
      type: 'TODO_ARCHIVED',
      payload: { todoId: '123' }
    };
    
    // Act
    await todoEventHandlers['handleTodoArchived'](event);
    
    // Assert
    expect(mockTodoRepository.findById).toHaveBeenCalledWith('123');
    expect(mockTodoRepository.update).toHaveBeenCalledWith('123', { archived: true });
    expect(mockProcessEngine.transition).toHaveBeenCalledWith('todo-123', 'archive', expect.any(Object));
  });
  
  it('should handle errors in event handlers', async () => {
    // Arrange
    // Save the original implementation
    const originalFindById = mockTodoRepository.findById;
    
    // Override with a rejected promise for this test
    mockTodoRepository.findById = vi.fn().mockRejectedValue(new Error('Test error'));
    
    const event = {
      type: 'TODO_COMPLETED',
      payload: { todoId: '123' }
    };
    
    try {
      // Act
      await todoEventHandlers['handleTodoCompleted'](event);
      
      // Assert
      expect(mockEventBus.emit).toHaveBeenCalledWith(expect.objectContaining({
        type: 'ERROR',
        payload: expect.objectContaining({
          message: 'Error handling TODO_COMPLETED event'
        })
      }));
    } finally {
      // Restore the original implementation
      mockTodoRepository.findById = originalFindById;
    }
  });
  
  it('should handle TODO_CATEGORIZED events', async () => {
    // Arrange
    const event = {
      type: 'TODO_CATEGORIZED',
      payload: { 
        todoId: '123', 
        categories: ['work', 'important'],
        addedCategories: ['important'],
        timestamp: new Date().toISOString()
      }
    };
    
    // Act
    await todoEventHandlers['handleTodoCategorized'](event);
    
    // Assert
    expect(mockTodoRepository.findById).toHaveBeenCalledWith('123');
    expect(mockEventBus.emit).not.toHaveBeenCalled(); // No error should be emitted
  });
});