/**
 * Tests for Runtime Core
 * 
 * These tests verify that the runtime core can:
 * 1. Load a system from a DSL/JSON definition
 * 2. Register task implementations
 * 3. Execute tasks
 * 4. Handle process state transitions
 * 5. Respond to events
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReactiveSystemRuntime } from '../../src/runtime/runtime-core';
import type { ReactiveSystem, Trigger } from '../../src/schema/types';

// Mock task implementations
const mockTaskImplementations = {
  'validate-todo': vi.fn(async (input: any) => {
    const isValid = Boolean(input.title && input.title.length > 0);
    return { isValid, errors: isValid ? [] : ['Title is required'] };
  }),
  'save-todo': vi.fn(async (input: any) => {
    return { id: 'todo-123', success: true };
  }),
  'update-todo': vi.fn(async (input: any) => {
    return { success: true };
  }),
  'delete-todo': vi.fn(async (input: any) => {
    return { success: true };
  })
};

// Sample triggers
const sampleTriggers: Trigger[] = [
  {
    type: "user_event",
    name: "todo-created",
    description: "Triggered when a new todo is created"
  },
  {
    type: "user_event",
    name: "todo-completed",
    description: "Triggered when a todo is marked as completed"
  }
];

// Sample system definition
const sampleSystem: ReactiveSystem = {
  id: 'todo-system',
  name: 'Todo System',
  version: '1.0.0',
  description: 'A simple todo management system',
  boundedContexts: {
    'todos': {
      id: 'todos',
      name: 'Todo Management',
      description: 'Manages todo items and lists',
      processes: ['manage-todos']
    }
  },
  processes: {
    'manage-todos': {
      id: 'manage-todos',
      name: 'Manage Todos',
      type: 'stateful',
      contextId: 'todos',
      triggers: sampleTriggers,
      tasks: ['validate-todo', 'save-todo', 'update-todo', 'delete-todo'],
      states: ['active', 'completed', 'archived'],
      transitions: [
        { from: 'active', to: 'completed', on: 'complete' },
        { from: 'completed', to: 'active', on: 'reactivate' },
        { from: 'active', to: 'archived', on: 'archive' },
        { from: 'completed', to: 'archived', on: 'archive' },
        { from: 'archived', to: 'active', on: 'restore' }
      ]
    }
  },
  tasks: {
    'validate-todo': {
      id: 'validate-todo',
      type: 'operation',
      label: 'Validate Todo',
      description: 'Validates todo data',
      input: ['title', 'description', 'dueDate'],
      output: ['isValid', 'errors']
    },
    'save-todo': {
      id: 'save-todo',
      type: 'operation',
      label: 'Save Todo',
      description: 'Saves todo to database',
      input: ['todo'],
      output: ['id', 'success']
    },
    'update-todo': {
      id: 'update-todo',
      type: 'operation',
      label: 'Update Todo',
      description: 'Updates todo in database',
      input: ['todoId', 'updates'],
      output: ['success']
    },
    'delete-todo': {
      id: 'delete-todo',
      type: 'operation',
      label: 'Delete Todo',
      description: 'Deletes todo from database',
      input: ['todoId'],
      output: ['success']
    }
  }
};

describe('ReactiveSystemRuntime', () => {
  let runtime: ReactiveSystemRuntime;

  beforeEach(() => {
    // Reset mock functions
    Object.values(mockTaskImplementations).forEach(mock => mock.mockClear());
    
    // Create a new runtime instance for each test
    runtime = new ReactiveSystemRuntime(sampleSystem);
  });

  describe('initialization', () => {
    it('should load a system definition', () => {
      expect(runtime.getSystemId()).toBe('todo-system');
      expect(runtime.getSystemVersion()).toBe('1.0.0');
    });

    it('should register processes from the system definition', () => {
      expect(runtime.hasProcess('manage-todos')).toBe(true);
    });

    it('should register tasks from the system definition', () => {
      expect(runtime.hasTask('validate-todo')).toBe(true);
      expect(runtime.hasTask('save-todo')).toBe(true);
      expect(runtime.hasTask('update-todo')).toBe(true);
      expect(runtime.hasTask('delete-todo')).toBe(true);
    });
  });

  describe('task execution', () => {
    beforeEach(() => {
      // Register mock task implementations
      Object.entries(mockTaskImplementations).forEach(([taskId, implementation]) => {
        runtime.registerTaskImplementation(taskId, implementation);
      });
    });

    it('should execute a task with valid input', async () => {
      const result = await runtime.executeTask('validate-todo', { title: 'Test Todo' });
      
      expect(mockTaskImplementations['validate-todo']).toHaveBeenCalledWith({ title: 'Test Todo' });
      expect(result).toEqual({ isValid: true, errors: [] });
    });

    it('should execute a task with invalid input', async () => {
      const result = await runtime.executeTask('validate-todo', { title: '' });
      
      expect(mockTaskImplementations['validate-todo']).toHaveBeenCalledWith({ title: '' });
      expect(result).toEqual({ isValid: false, errors: ['Title is required'] });
    });

    it('should throw an error when executing a non-existent task', async () => {
      await expect(runtime.executeTask('non-existent-task', {}))
        .rejects.toThrow('Task non-existent-task not found');
    });

    it('should throw an error when executing a task without an implementation', async () => {
      // Create a new runtime without registering implementations
      const newRuntime = new ReactiveSystemRuntime(sampleSystem);
      
      await expect(newRuntime.executeTask('validate-todo', { title: 'Test' }))
        .rejects.toThrow('No implementation found for task validate-todo');
    });
  });

  describe('process state management', () => {
    it('should initialize processes with their initial state', () => {
      expect(runtime.getProcessState('manage-todos')).toBe('active');
    });

    it('should transition process state on valid events', () => {
      runtime.sendEvent('complete', { processId: 'manage-todos' });
      expect(runtime.getProcessState('manage-todos')).toBe('completed');
      
      runtime.sendEvent('reactivate', { processId: 'manage-todos' });
      expect(runtime.getProcessState('manage-todos')).toBe('active');
    });

    it('should not transition on invalid events', () => {
      runtime.sendEvent('invalid-event', { processId: 'manage-todos' });
      expect(runtime.getProcessState('manage-todos')).toBe('active');
    });

    it('should throw an error for non-existent processes', () => {
      expect(() => runtime.getProcessState('non-existent-process'))
        .toThrow('Process non-existent-process not found');
      
      expect(() => runtime.sendEvent('complete', { processId: 'non-existent-process' }))
        .toThrow('Process non-existent-process not found');
    });
  });

  describe('event handling', () => {
    it('should trigger event handlers when events are sent', () => {
      const handler = vi.fn();
      runtime.on('todo-created', handler);
      
      runtime.sendEvent('todo-created', { todoId: 'todo-123' });
      
      expect(handler).toHaveBeenCalledWith({ todoId: 'todo-123' });
    });

    it('should not trigger handlers for other events', () => {
      const handler = vi.fn();
      runtime.on('todo-created', handler);
      
      runtime.sendEvent('todo-completed', { todoId: 'todo-123' });
      
      expect(handler).not.toHaveBeenCalled();
    });
  });
}); 