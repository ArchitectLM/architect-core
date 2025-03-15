/**
 * Tests for the Hybrid DSL Enhancements
 *
 * This file contains tests for enhanced features of the standardized API.
 */
import { describe, it, expect } from 'vitest';

import { System, Process, Task } from '../src/index';

describe('Standardized DSL API Enhancements', () => {
  describe('Process Validation', () => {
    it('should validate process transitions', () => {
      // Arrange & Act
      const process = Process.create('test-process')
        .withName('Test Process')
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
      expect(process.transitions).toHaveLength(2);
      expect(process.transitions[0].from).toBe('initial');
      expect(process.transitions[0].to).toBe('processing');
    });
  });

  describe('System Validation', () => {
    it('should validate system processes and tasks', () => {
      // Arrange
      const process = Process.create('test-process')
        .withName('Test Process')
        .withInitialState('initial')
        .addState('initial')
        .build();

      const task = Task.create('test-task')
        .withName('Test Task')
        .withImplementation(async () => {
          return { success: true };
        })
        .build();

      // Act & Assert
      const system = System.create('test-system')
        .withName('Test System')
        .addProcess(process)
        .addTask(task)
        .build();

      expect(system).toBeDefined();
      expect(system.processes).toContainEqual(process);
      expect(system.tasks).toContainEqual(task);
    });
  });

  describe('Error Handling', () => {
    it('should handle task execution errors', () => {
      // Arrange
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
      expect(task.errorHandler).toBeDefined();
    });
  });
});
