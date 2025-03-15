/**
 * Tests for the Hybrid DSL
 *
 * This file contains tests for the standardized API approach
 * using System.create(), Process.create(), and Task.create().
 */

import { describe, it, expect } from 'vitest';

import { System, Process, Task } from '../src/index';

describe('Standardized DSL API', () => {
  describe('System Creation', () => {
    it('should create a simple system', () => {
      // Arrange & Act
      const process = Process.create('test-process')
        .withName('Test Process')
        .withInitialState('initial')
        .addState('initial')
        .build();

      const system = System.create('test-system')
        .withName('Test System')
        .withDescription('A test system')
        .addProcess(process)
        .build();

      // Assert
      expect(system).toBeDefined();
      expect(system.id).toBe('test-system');
      expect(system.name).toBe('Test System');
      expect(system.description).toBe('A test system');
      expect(system.processes).toHaveLength(1);
    });

    it('should throw an error when creating a system without processes', () => {
      // Arrange & Act & Assert
      expect(() => {
        System.create('invalid-system').build();
      }).toThrow('System validation failed: System must have at least one process');
    });
  });

  describe('Process Creation', () => {
    it('should create a process with states and transitions', () => {
      // Arrange & Act
      const process = Process.create('test-process')
        .withName('Test Process')
        .withDescription('A test process')
        .withInitialState('initial')
        .addState('initial')
        .addState('processing')
        .addState('completed')
        .addTransition({
          from: 'initial',
          to: 'processing',
          on: 'START',
        })
        .addTransition({
          from: 'processing',
          to: 'completed',
          on: 'COMPLETE',
        })
        .build();

      // Assert
      expect(process).toBeDefined();
      expect(process.id).toBe('test-process');
      expect(process.name).toBe('Test Process');
      expect(process.description).toBe('A test process');
      expect(process.initialState).toBe('initial');
      expect(process.states).toContain('initial');
      expect(process.states).toContain('processing');
      expect(process.states).toContain('completed');
      expect(process.transitions).toHaveLength(2);
    });

    it('should create a process with a simple transition', () => {
      // Arrange & Act
      const process = Process.create('test-process')
        .withName('Test Process')
        .withInitialState('initial')
        .addState('initial')
        .addState('completed')
        .addSimpleTransition('initial', 'completed', 'COMPLETE')
        .build();

      // Assert
      expect(process.transitions).toHaveLength(1);
      expect(process.transitions[0].from).toBe('initial');
      expect(process.transitions[0].to).toBe('completed');
      expect(process.transitions[0].on).toBe('COMPLETE');
    });
  });

  describe('Task Creation', () => {
    it('should create a task with implementation', () => {
      // Arrange & Act
      const task = Task.create('test-task')
        .withName('Test Task')
        .withDescription('A test task')
        .withImplementation(async (input, context) => {
          return { success: true, input, context };
        })
        .build();

      // Assert
      expect(task).toBeDefined();
      expect(task.id).toBe('test-task');
      expect(task.name).toBe('Test Task');
      expect(task.description).toBe('A test task');
      expect(task.implementation).toBeDefined();
    });

    it('should create a task with error handler', () => {
      // Arrange & Act
      const task = Task.create('test-task')
        .withName('Test Task')
        .withImplementation(async () => {
          throw new Error('Test error');
        })
        .withErrorHandler(async error => {
          return { success: false, error: error.message };
        })
        .build();

      // Assert
      expect(task).toBeDefined();
      expect(task.errorHandler).toBeDefined();
    });
  });

  describe('System Integration', () => {
    it('should integrate processes and tasks in a system', () => {
      // Arrange
      const process = Process.create('test-process')
        .withName('Test Process')
        .withInitialState('initial')
        .addState('initial')
        .addState('completed')
        .addSimpleTransition('initial', 'completed', 'COMPLETE')
        .build();

      const task = Task.create('test-task')
        .withName('Test Task')
        .withImplementation(async () => {
          return { success: true };
        })
        .build();

      // Act
      const system = System.create('test-system')
        .withName('Test System')
        .addProcess(process)
        .addTask(task)
        .build();

      // Assert
      expect(system.processes).toContainEqual(process);
      expect(system.tasks).toContainEqual(task);
    });
  });
});
