import { describe, it, expect, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime.js';
import { ReactiveRuntime } from '../src/implementations/runtime.js';
import { ProcessDefinition, ProcessInstance } from '../src/models/index.js';
import { ExtensionSystemImpl } from '../src/implementations/extension-system.js';
import { EventBusImpl } from '../src/implementations/event-bus.js';
import { InMemoryEventStorage } from '../src/implementations/event-storage.js';

describe('Process Definition Management', () => {
  let runtime: Runtime;
  let extensionSystem: ExtensionSystemImpl;
  let eventBus: EventBusImpl;
  let eventStorage: InMemoryEventStorage;

  beforeEach(() => {
    extensionSystem = new ExtensionSystemImpl();
    eventBus = new EventBusImpl();
    eventStorage = new InMemoryEventStorage();
    
    runtime = new ReactiveRuntime({}, {}, {
      extensionSystem,
      eventBus,
      eventStorage
    });
  });

  describe('Definition Registration', () => {
    it('should register a valid process definition', async () => {
      const definition: ProcessDefinition = {
        id: 'test.process',
        name: 'Test Process',
        description: 'A test process',
        initialState: 'created',
        transitions: [
          { from: 'created', to: 'running', on: 'start' },
          { from: 'running', to: 'completed', on: 'complete' }
        ]
      };

      const process = await runtime.createProcess('test.process', {});
      expect(process).toBeDefined();
      expect(process.type).toBe('test.process');
      expect(process.state).toBe('created');
    });

    it('should handle invalid process definitions', async () => {
      const invalidDefinitions: ProcessDefinition[] = [
        // Missing required fields
        {
          id: 'test.process',
          name: 'Test Process',
          description: 'A test process',
          initialState: 'created',
          transitions: []
        },
        // Invalid transitions
        {
          id: 'test.process',
          name: 'Test Process',
          description: 'A test process',
          initialState: 'created',
          transitions: [
            { from: 'created', to: 'running', on: 'start' },
            { from: 'running', to: 'created', on: 'reset' } // Creates a cycle
          ]
        },
        // Initial state not in transitions
        {
          id: 'test.process',
          name: 'Test Process',
          description: 'A test process',
          initialState: 'created',
          transitions: [
            { from: 'running', to: 'completed', on: 'complete' }
          ]
        }
      ];

      for (const definition of invalidDefinitions) {
        await expect(runtime.createProcess(definition.id, {})).rejects.toThrow();
      }
    });
  });

  describe('Process Instance Management', () => {
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

    beforeEach(async () => {
      await runtime.createProcess(validDefinition.id, {});
    });

    it('should transition process state', async () => {
      const process = await runtime.getProcess(validDefinition.id);
      expect(process?.state).toBe('created');

      const updated = await runtime.transitionProcess(process!.id, 'start');
      expect(updated.state).toBe('running');

      const completed = await runtime.transitionProcess(updated.id, 'complete');
      expect(completed.state).toBe('completed');
    });

    it('should handle invalid state transitions', async () => {
      const process = await runtime.getProcess(validDefinition.id);
      expect(process?.state).toBe('created');

      await expect(runtime.transitionProcess(process!.id, 'complete')).rejects.toThrow();
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
        name: 'Test Process',
        description: 'A test process',
        initialState: 'created',
        transitions: [
          { from: 'created', to: 'completed', on: 'complete' }
        ],
        version: '1.0'
      };

      const v2Definition: ProcessDefinition = {
        ...v1Definition,
        transitions: [
          { from: 'created', to: 'running', on: 'start' },
          { from: 'running', to: 'completed', on: 'complete' }
        ],
        version: '2.0'
      };

      const v1Process = await runtime.createProcess(v1Definition.id, {}, { version: '1.0' });
      expect(v1Process.version).toBe('1.0');

      const v2Process = await runtime.createProcess(v2Definition.id, {}, { version: '2.0' });
      expect(v2Process.version).toBe('2.0');
    });
  });
}); 