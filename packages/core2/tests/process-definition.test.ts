import { describe, it, expect, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { ReactiveRuntime } from '../src/implementations/runtime';
import { ProcessDefinition, ProcessInstance } from '../src/models/index';
import { ExtensionSystemImpl } from '../src/implementations/extension-system';
import { EventBusImpl } from '../src/implementations/event-bus';
import { InMemoryEventStorage } from '../src/implementations/event-storage';
import { createProcessManagementPlugin } from '../src/plugins/process-management';
import { ExtensionPoint } from '../src/models/extension';

describe('Process Definition Management', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBusImpl;
  let eventStorage: InMemoryEventStorage;

  const validDefinition: ProcessDefinition = {
    id: 'test.process',
    name: 'Test Process',
    description: 'A test process',
    initialState: 'created',
    version: '1.0.0',
    transitions: [
      { from: 'created', to: 'running', on: 'start' },
      { from: 'running', to: 'completed', on: 'complete' }
    ]
  };

  beforeEach(() => {
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    eventStorage = new InMemoryEventStorage();

    // Register extension points
    extensionSystem.registerExtensionPoint('system:init' as ExtensionPoint);
    extensionSystem.registerExtensionPoint('system:initialized' as ExtensionPoint);
    extensionSystem.registerExtensionPoint('task:beforeExecution' as ExtensionPoint);
    extensionSystem.registerExtensionPoint('task:afterCompletion' as ExtensionPoint);
    
    // Create runtime with the valid process definition
    runtime = new ReactiveRuntime(
      { [validDefinition.id]: validDefinition },
      {},
      {
        extensionSystem,
        eventBus,
        eventStorage
      }
    );
  });

  describe('Definition Registration', () => {
    it('should register a valid process definition', async () => {
      const process = await runtime.createProcess(validDefinition.id, {});
      expect(process).toBeDefined();
      expect(process.type).toBe(validDefinition.id);
      expect(process.state).toBe(validDefinition.initialState);
      expect(process.version).toBe(validDefinition.version);
    });

    it('should handle invalid process definitions', async () => {
      const invalidDefinitions = [
        // Missing required fields
        {
          id: 'invalid.process.1',
          name: 'Invalid Process 1',
          description: 'Missing transitions',
          initialState: 'created',
          version: '1.0.0',
          transitions: []
        },
        // Invalid transitions
        {
          id: 'invalid.process.2',
          name: 'Invalid Process 2',
          description: 'Invalid transitions',
          initialState: 'created',
          version: '1.0.0',
          transitions: [
            { from: 'created', to: 'running', on: 'start' },
            { from: 'running', to: 'created', on: 'reset' } // Creates a cycle
          ]
        },
        // Initial state not in transitions
        {
          id: 'invalid.process.3',
          name: 'Invalid Process 3',
          description: 'Invalid initial state',
          initialState: 'created',
          version: '1.0.0',
          transitions: [
            { from: 'running', to: 'completed', on: 'complete' }
          ]
        }
      ];

      for (const definition of invalidDefinitions) {
        const testExtensionSystem = new ExtensionSystemImpl();
        const testEventBus = new EventBusImpl();
        const testEventStorage = new InMemoryEventStorage();

        // Register extension points
        testExtensionSystem.registerExtensionPoint('system:init' as ExtensionPoint);
        testExtensionSystem.registerExtensionPoint('system:initialized' as ExtensionPoint);
        testExtensionSystem.registerExtensionPoint('task:beforeExecution' as ExtensionPoint);
        testExtensionSystem.registerExtensionPoint('task:afterCompletion' as ExtensionPoint);

        const testRuntime = new ReactiveRuntime(
          { [definition.id]: definition },
          {},
          {
            extensionSystem: testExtensionSystem,
            eventBus: testEventBus,
            eventStorage: testEventStorage
          }
        );

        await expect(testRuntime.createProcess(definition.id, {}))
          .rejects.toThrow();
      }
    });
  });

  describe('Process Instance Management', () => {
    it('should transition process state', async () => {
      const process = await runtime.createProcess(validDefinition.id, {});
      expect(process.state).toBe('created');

      const updated = await runtime.transitionProcess(process.id, 'start');
      expect(updated.state).toBe('running');

      const completed = await runtime.transitionProcess(updated.id, 'complete');
      expect(completed.state).toBe('completed');
    });

    it('should handle invalid state transitions', async () => {
      const process = await runtime.createProcess(validDefinition.id, {});
      expect(process.state).toBe('created');

      await expect(runtime.transitionProcess(process.id, 'complete'))
        .rejects.toThrow('Invalid transition');
    });

    it('should maintain process data across transitions', async () => {
      const processData = { test: 'data' };
      const process = await runtime.createProcess(validDefinition.id, processData);
      
      const updated = await runtime.transitionProcess(process.id, 'start');
      expect(updated.data).toEqual(processData);
    });
  });

  describe('Process Versioning', () => {
    it('should handle process version changes', async () => {
      const v1Definition: ProcessDefinition = {
        id: 'test.process',
        name: 'Test Process V1',
        description: 'Version 1 of test process',
        initialState: 'created',
        version: '1.0.0',
        transitions: [
          { from: 'created', to: 'completed', on: 'complete' }
        ]
      };

      const v2Definition: ProcessDefinition = {
        id: 'test.process',
        name: 'Test Process V2',
        description: 'Version 2 of test process',
        initialState: 'created',
        version: '2.0.0',
        transitions: [
          { from: 'created', to: 'running', on: 'start' },
          { from: 'running', to: 'completed', on: 'complete' }
        ]
      };

      // Create separate runtimes for each version
      const v1ExtensionSystem = new ExtensionSystemImpl();
      const v1EventBus = new EventBusImpl();
      const v1EventStorage = new InMemoryEventStorage();

      const v2ExtensionSystem = new ExtensionSystemImpl();
      const v2EventBus = new EventBusImpl();
      const v2EventStorage = new InMemoryEventStorage();

      // Register extension points for both runtimes
      [v1ExtensionSystem, v2ExtensionSystem].forEach(es => {
        es.registerExtensionPoint('system:init' as ExtensionPoint);
        es.registerExtensionPoint('system:initialized' as ExtensionPoint);
        es.registerExtensionPoint('task:beforeExecution' as ExtensionPoint);
        es.registerExtensionPoint('task:afterCompletion' as ExtensionPoint);
      });

      const v1Runtime = new ReactiveRuntime(
        { [v1Definition.id]: v1Definition },
        {},
        {
          extensionSystem: v1ExtensionSystem,
          eventBus: v1EventBus,
          eventStorage: v1EventStorage
        }
      );

      const v2Runtime = new ReactiveRuntime(
        { [v2Definition.id]: v2Definition },
        {},
        {
          extensionSystem: v2ExtensionSystem,
          eventBus: v2EventBus,
          eventStorage: v2EventStorage
        }
      );

      const v1Process = await v1Runtime.createProcess(v1Definition.id, {}, { version: '1.0.0' });
      expect(v1Process.version).toBe('1.0.0');

      const v2Process = await v2Runtime.createProcess(v2Definition.id, {}, { version: '2.0.0' });
      expect(v2Process.version).toBe('2.0.0');

      // Test transitions for each version
      await expect(v1Runtime.transitionProcess(v1Process.id, 'complete')).resolves.toBeDefined();
      await expect(v2Runtime.transitionProcess(v2Process.id, 'start')).resolves.toBeDefined();
    });
  });
}); 