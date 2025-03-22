import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { createModernRuntime } from '../src/implementations/modern-factory';
import { BasePlugin } from '../src/models/plugin-system';
import { ExtensionPointNames } from '../src/models/extension-system';
import { ProcessDefinition } from '../src/models/process-system';
import { DomainEvent } from '../src/models/core-types';

describe('Runtime Behavior', () => {
  let runtime: Runtime;

  beforeEach(() => {
    runtime = createModernRuntime();
  });

  describe('Given a runtime instance', () => {
    it('should initialize with default configuration', () => {
      expect(runtime.version).toBeDefined();
      expect(runtime.namespace).toBeDefined();
      expect(runtime.eventBus).toBeDefined();
      expect(runtime.extensionSystem).toBeDefined();
      expect(runtime.taskRegistry).toBeDefined();
      expect(runtime.taskExecutor).toBeDefined();
      expect(runtime.processRegistry).toBeDefined();
      expect(runtime.pluginRegistry).toBeDefined();
    });

    it('should handle runtime lifecycle events', async () => {
      const startResult = await runtime.start();
      expect(startResult.success).toBe(true);

      const stopResult = await runtime.stop();
      expect(stopResult.success).toBe(true);
    });
  });

  describe('Given a process definition', () => {
    const validDefinition: ProcessDefinition = {
      id: 'test.process',
      name: 'Test Process',
      description: 'A test process',
      initialState: 'created',
      transitions: [
        { from: 'created', to: 'running', on: 'start' },
        { from: 'running', to: 'completed', on: 'complete' }
      ]
    };

    it('should create and manage process instances', async () => {
      // Register process definition
      const registerResult = runtime.processRegistry.registerProcess(validDefinition);
      expect(registerResult.success).toBe(true);

      // Create process
      const createResult = await runtime.processManager.createProcess(validDefinition.id, {});
      expect(createResult.success).toBe(true);
      if (createResult.success) {
        const process = createResult.value;
        expect(process.type).toBe(validDefinition.id);
        expect(process.state).toBe('created');

        // Transition process
        const transitionResult = await runtime.processManager.applyEvent(process.id, 'start', {});
        expect(transitionResult.success).toBe(true);
        if (transitionResult.success) {
          expect(transitionResult.value.state).toBe('running');

          // Complete process
          const completeResult = await runtime.processManager.applyEvent(transitionResult.value.id, 'complete', {});
          expect(completeResult.success).toBe(true);
          if (completeResult.success) {
            expect(completeResult.value.state).toBe('completed');
          }
        }
      }
    });

    it('should handle invalid state transitions', async () => {
      const registerResult = runtime.processRegistry.registerProcess(validDefinition);
      expect(registerResult.success).toBe(true);

      const createResult = await runtime.processManager.createProcess(validDefinition.id, {});
      expect(createResult.success).toBe(true);
      if (createResult.success) {
        const process = createResult.value;
        const transitionResult = await runtime.processManager.applyEvent(process.id, 'complete', {});
        expect(transitionResult.success).toBe(false);
      }
    });

    it('should maintain process data across transitions', async () => {
      const registerResult = runtime.processRegistry.registerProcess(validDefinition);
      expect(registerResult.success).toBe(true);

      const processData = { test: 'data' };
      const createResult = await runtime.processManager.createProcess(validDefinition.id, processData);
      expect(createResult.success).toBe(true);
      if (createResult.success) {
        const process = createResult.value;
        expect(process.data).toEqual(processData);

        const transitionResult = await runtime.processManager.applyEvent(process.id, 'start', {});
        expect(transitionResult.success).toBe(true);
        if (transitionResult.success) {
          expect(transitionResult.value.data).toEqual(processData);
        }
      }
    });
  });

  describe('Given an extension system', () => {
    it('should register and execute extension points', async () => {
      class TestExtension extends BasePlugin {
        constructor() {
          super({
            id: 'test-extension',
            name: 'Test Extension',
            description: 'A test extension'
          });
        }
      }

      const extension = new TestExtension();
      const registerResult = await runtime.extensionSystem.registerExtension(extension);
      expect(registerResult.success).toBe(true);

      const handler = vi.fn().mockImplementation((params) => {
        return { success: true, value: params };
      });

      extension.registerHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, handler);

      const result = await runtime.extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should handle extension failures gracefully', async () => {
      class FailingExtension extends BasePlugin {
        constructor() {
          super({
            id: 'failing-extension',
            name: 'Failing Extension',
            description: 'An extension that fails'
          });
          
          this.registerHook(ExtensionPointNames.TASK_BEFORE_EXECUTION, async () => ({
            success: false,
            error: new Error('Test failure')
          }));
        }
      }

      const extension = new FailingExtension();
      const registerResult = await runtime.extensionSystem.registerExtension(extension);
      expect(registerResult.success).toBe(true);
      
      const result = await runtime.extensionSystem.executeExtensionPoint(
        ExtensionPointNames.TASK_BEFORE_EXECUTION,
        {
          taskId: 'test-task',
          taskType: 'test',
          input: 'test'
        }
      );
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Test failure');
      }
    });
  });

  describe('Given an event system', () => {
    it('should publish and subscribe to events', async () => {
      const handler = vi.fn();
      const subscription = runtime.eventBus.subscribe('test.event', handler);
      
      const event: DomainEvent<{ data: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { data: 'test' }
      };

      await runtime.eventBus.publish(event);
      expect(handler).toHaveBeenCalledWith(event);
      
      subscription.unsubscribe();
      await runtime.eventBus.publish(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle event persistence and replay', async () => {
      const event: DomainEvent<{ data: string }> = {
        id: 'test-event',
        type: 'test.event',
        timestamp: Date.now(),
        payload: { data: 'test' }
      };

      if (runtime.eventStorage) {
        await runtime.eventStorage.storeEvent(event);

        const startTime = Date.now() - 1000;
        const endTime = Date.now() + 1000;
        if (runtime.eventSource) {
          await runtime.eventSource.replayEvents('test.event', startTime, endTime);
        }
      }
    });

    it('should correlate events', async () => {
      const correlationId = 'test-correlation';
      const events: DomainEvent<{ data: string }>[] = [
        {
          id: 'test-event-1',
          type: 'test.event1',
          timestamp: Date.now(),
          payload: { data: 'test1' },
          metadata: { correlationId }
        },
        {
          id: 'test-event-2',
          type: 'test.event2',
          timestamp: Date.now(),
          payload: { data: 'test2' },
          metadata: { correlationId }
        }
      ];

      if (runtime.eventStorage) {
        for (const event of events) {
          await runtime.eventStorage.storeEvent(event);
        }

        const correlatedEvents = await runtime.eventBus.correlate(correlationId);
        expect(correlatedEvents).toHaveLength(2);
        expect(correlatedEvents.every(e => e.metadata?.correlationId === correlationId)).toBe(true);
      }
    });
  });
}); 