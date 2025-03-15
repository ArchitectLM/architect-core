/**
 * Tests for Reactive System Validation
 *
 * This file contains tests for validating reactive systems using the standardized API.
 */
import { describe, it, expect } from 'vitest';

import { System, Process, Task } from '../src/index';

describe('Reactive System Validation', () => {
  describe('System Validation', () => {
    it('should validate that a system has at least one process', () => {
      // Arrange & Act & Assert
      expect(() => {
        System.create('test-system').withName('Test System').build();
      }).toThrow('System must have at least one process');
    });

    it('should validate that each process has an initial state', () => {
      // Arrange & Act & Assert
      expect(() => {
        // Create a process without an initial state
        const processBuilder = Process.create('test-process')
          .withName('Test Process')
          .addState('state1')
          .addState('state2');

        // Manually access the build method to bypass validation
        const process = Object.assign({}, processBuilder, { initialState: undefined });

        System.create('test-system').withName('Test System').addProcess(process).build();
      }).toThrow('System validation failed: Process "test-process" must have an initial state');
    });

    it('should validate that each process has at least one state', () => {
      // Arrange & Act & Assert
      expect(() => {
        const process = Process.create('test-process')
          .withName('Test Process')
          .withInitialState('initial')
          .build();

        System.create('test-system').withName('Test System').addProcess(process).build();
      }).toThrow('Process "test-process" must have at least one state');
    });

    it('should validate that process transitions reference valid states', () => {
      // Arrange & Act & Assert
      expect(() => {
        const process = Process.create('test-process')
          .withName('Test Process')
          .withInitialState('initial')
          .addState('initial')
          .addState('processing')
          .addTransition({
            from: 'initial',
            to: 'non-existent',
            on: 'START',
          })
          .build();

        System.create('test-system').withName('Test System').addProcess(process).build();
      }).toThrow(
        'System validation failed: Process "test-process" has a transition to non-existent state "non-existent"'
      );
    });
  });

  describe('Valid System Creation', () => {
    it('should successfully create a valid system', () => {
      // Arrange
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
      expect(system).toBeDefined();
      expect(system.id).toBe('test-system');
      expect(system.processes).toHaveLength(1);
      expect(system.tasks).toHaveLength(1);
    });
  });
});
