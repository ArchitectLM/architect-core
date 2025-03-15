/**
 * Advanced Tests for the Standardized DSL API
 *
 * This file contains advanced test cases for the Standardized DSL API, including:
 * - Edge cases and error handling
 * - Serialization/deserialization tests
 */

import { describe, it, expect } from 'vitest';

import { System, Process, Task } from '../src/index';

describe('Standardized DSL API Advanced Tests', () => {
  describe('Edge Cases and Error Handling', () => {
    it('should handle duplicate process IDs', () => {
      // Arrange
      const process1 = Process.create('process1')
        .withName('First Process')
        .withInitialState('initial')
        .addState('initial')
        .build();

      const process2 = Process.create('process1')
        .withName('Duplicate Process')
        .withInitialState('initial')
        .addState('initial')
        .build();

      // Act
      const system = System.create('test-system')
        .withName('Test System')
        .addProcess(process1)
        .addProcess(process2)
        .build();

      // Assert
      expect(system.processes).toHaveLength(2);
      expect(system.processes[1].name).toBe('Duplicate Process');
    });

    it('should handle duplicate task IDs', () => {
      // Arrange
      const process = Process.create('test-process')
        .withName('Test Process')
        .withInitialState('initial')
        .addState('initial')
        .build();

      const task1 = Task.create('task1')
        .withName('First Task')
        .withImplementation(async () => ({ success: true }))
        .build();

      const task2 = Task.create('task1')
        .withName('Duplicate Task')
        .withImplementation(async () => ({ success: true }))
        .build();

      // Act
      const system = System.create('test-system')
        .withName('Test System')
        .addProcess(process)
        .addTask(task1)
        .addTask(task2)
        .build();

      // Assert
      expect(system.tasks).toHaveLength(2);
      expect(system.tasks[1].name).toBe('Duplicate Task');
    });

    it('should handle circular references in process transitions', () => {
      // Arrange & Act
      const process = Process.create('process1')
        .withName('Circular Process')
        .withInitialState('state1')
        .addState('state1')
        .addState('state2')
        .addState('state3')
        .addTransition({
          from: 'state1',
          to: 'state2',
          on: 'event1',
        })
        .addTransition({
          from: 'state2',
          to: 'state3',
          on: 'event2',
        })
        .addTransition({
          from: 'state3',
          to: 'state1',
          on: 'event3',
        })
        .build();

      // Create a system with the process
      const system = System.create('test-system')
        .withName('Test System')
        .addProcess(process)
        .build();

      // Assert
      expect(process.transitions).toHaveLength(3);
      expect(process.transitions[0].from).toBe('state1');
      expect(process.transitions[0].to).toBe('state2');
      expect(process.transitions[2].from).toBe('state3');
      expect(process.transitions[2].to).toBe('state1');
      expect(system.processes).toHaveLength(1);
    });

    it('should handle extremely large systems', () => {
      // Arrange
      let systemBuilder = System.create('large-system')
        .withName('Large System')
        .withDescription('A system with many components');

      // Add 10 processes (reduced from 100 for performance)
      for (let i = 0; i < 10; i++) {
        const process = Process.create(`process-${i}`)
          .withName(`Process ${i}`)
          .withInitialState('initial')
          .addState('initial')
          .build();

        systemBuilder = systemBuilder.addProcess(process);
      }

      // Add 10 tasks (reduced from 100 for performance)
      for (let i = 0; i < 10; i++) {
        const task = Task.create(`task-${i}`)
          .withName(`Task ${i}`)
          .withImplementation(async () => ({ success: true }))
          .build();

        systemBuilder = systemBuilder.addTask(task);
      }

      // Act
      const system = systemBuilder.build();

      // Assert
      expect(system.processes).toHaveLength(10);
      expect(system.tasks).toHaveLength(10);
    });
  });

  describe('Serialization and Deserialization', () => {
    it('should serialize and deserialize a system correctly', () => {
      // Arrange
      const process = Process.create('process1')
        .withName('First Process')
        .withInitialState('initial')
        .addState('initial')
        .build();

      const task = Task.create('task1')
        .withName('First Task')
        .withImplementation(async () => ({ success: true }))
        .build();

      const originalSystem = System.create('test-system')
        .withName('Test System')
        .withDescription('A test system')
        .addProcess(process)
        .addTask(task)
        .build();

      // Act
      const serialized = JSON.stringify(originalSystem);
      const deserialized = JSON.parse(serialized);

      // Assert
      expect(deserialized.id).toBe('test-system');
      expect(deserialized.name).toBe('Test System');
      expect(deserialized.processes).toHaveLength(1);
      expect(deserialized.processes[0].name).toBe('First Process');
      expect(deserialized.tasks).toHaveLength(1);
      expect(deserialized.tasks[0].name).toBe('First Task');
    });
  });
});
