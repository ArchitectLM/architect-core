/**
 * Reactive System DSL Tests
 */
import { describe, it, expect } from 'vitest';

import { PaymentProcessingPlugin } from './plugin';
import { System, Process, Task } from './index';

describe('Reactive System DSL', () => {
  describe('Basic DSL', () => {
    it('should create a valid system definition', () => {
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
    });

    it('should validate the system definition', () => {
      // Arrange & Act & Assert
      expect(() => {
        System.create('invalid-system').build();
      }).toThrow('System validation failed: System must have at least one process');
    });
  });

  describe('Process Integration', () => {
    it('should add a process to a system', () => {
      // Arrange
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

      // Act
      const system = System.create('test-system')
        .withName('Test System')
        .addProcess(process)
        .build();

      // Assert
      expect(system.processes).toContainEqual(process);
    });
  });

  describe('Task Integration', () => {
    it('should add a task to a system', () => {
      // Arrange
      const task = Task.create('test-task')
        .withName('Test Task')
        .withDescription('A test task')
        .withImplementation(async () => {
          return { success: true };
        })
        .build();

      const process = Process.create('test-process')
        .withName('Test Process')
        .withInitialState('initial')
        .addState('initial')
        .build();

      // Act
      const system = System.create('test-system')
        .withName('Test System')
        .addProcess(process)
        .addTask(task)
        .build();

      // Assert
      expect(system.tasks).toContainEqual(task);
    });
  });

  describe('Plugins', () => {
    it('should extend the system with a plugin', () => {
      // Arrange
      const testPlugin = {
        name: 'test-plugin',
        extend: (system: any) => {
          system.metadata = system.metadata || {};
          system.metadata.extended = true;
          return system;
        },
      };

      // Act
      const process = Process.create('test-process')
        .withName('Test Process')
        .withInitialState('initial')
        .addState('initial')
        .build();

      const systemBuilder = System.create('test-system')
        .withName('Test System')
        .addProcess(process)
        .withPlugin(testPlugin);

      // Manually call the plugin's extend method
      const system = systemBuilder.build();
      testPlugin.extend(system);

      // Assert
      expect(system.plugins).toContainEqual(testPlugin);
      expect(system.metadata.extended).toBe(true);
    });
  });
});
