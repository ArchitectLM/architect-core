import { describe, it, expect, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { createRuntime } from '../src/implementations/factory';
import { ProcessDefinition } from '../src/models/process-system';
import { InMemoryProcessRegistry } from '../src/implementations/process-registry';
import { InMemoryProcessManager } from '../src/implementations/process-manager';
import { InMemoryTaskRegistry } from '../src/implementations/task-registry';
import { InMemoryTaskExecutor } from '../src/implementations/task-executor';
import { createInMemoryEventBus } from '../src/implementations/event-bus';
import { createExtensionSystem } from '../src/implementations/extension-system';

// Define the process data type
interface TestProcessData {
  counter?: number;
}

describe('Process Definition', () => {
  let runtime: Runtime;

  // Define process with correct field names
  const processDefinition: ProcessDefinition = {
    type: 'test-process',
    name: 'Test Process', 
    description: 'A test process definition',
    initialState: 'created',
    states: ['created', 'running', 'completed'],
    finalStates: ['completed'],
    version: '1.0.0',
    transitions: [
      { from: 'created', to: 'running', event: 'start' },
      { from: 'running', to: 'completed', event: 'complete' }
    ]
  };

  beforeEach(async () => {
    // Create required components
    const extensionSystem = createExtensionSystem();
    const eventBus = createInMemoryEventBus(extensionSystem);
    const processRegistry = new InMemoryProcessRegistry();
    const taskRegistry = new InMemoryTaskRegistry();
    const taskExecutor = new InMemoryTaskExecutor(taskRegistry, eventBus);
    const processManager = new InMemoryProcessManager(processRegistry, taskExecutor);
    
    // Create runtime with proper components
    runtime = createRuntime({
      persistEvents: true,
      components: {
        extensionSystem,
        eventBus,
        processRegistry,
        processManager,
        taskRegistry,
        taskExecutor
      },
      runtimeOptions: {
        version: '1.0.0',
        namespace: 'test'
      }
    });

    await runtime.initialize?.({
      version: '1.0.0',
      namespace: 'test'
    });
    await runtime.start?.();
    
    // Register the process definition
    const registerResult = await runtime.processRegistry?.registerProcess(processDefinition);
    expect(registerResult?.success).toBe(true);
  });

  it('should create a process with correct initial state', async () => {
    // Create a process
    const createResult = await runtime.processManager?.createProcess(
      processDefinition.type,
      {}
    );
    
    expect(createResult?.success).toBe(true);
    
    if (createResult?.success && createResult.value) {
      const process = createResult.value;
      
      expect(process.id).toBeDefined();
      expect(process.type).toBe(processDefinition.type);
      expect(process.state).toBe('created');
      expect(process.version).toBe('1.0.0');
    }
  });
  
  it('should transition processes through states', async () => {
    // Create a process
    const createResult = await runtime.processManager?.createProcess(
      processDefinition.type,
      {}
    );
    
    expect(createResult?.success).toBe(true);
    if (!createResult?.success || !createResult.value) return;
    
    const processId = createResult.value.id;
    
    // Apply the first transition (created -> running)
    const startResult = await runtime.processManager?.applyEvent(
      processId,
      'start',
      {}
    );
    
    expect(startResult?.success).toBe(true);
    if (startResult?.success && startResult.value) {
      expect(startResult.value.state).toBe('running');
    }
    
    // Apply the second transition (running -> completed)
    const completeResult = await runtime.processManager?.applyEvent(
      processId,
      'complete',
      {}
    );
    
    expect(completeResult?.success).toBe(true);
    if (completeResult?.success && completeResult.value) {
      expect(completeResult.value.state).toBe('completed');
    }
  });
  
  it('should reject invalid transitions', async () => {
    // Create a process
    const createResult = await runtime.processManager?.createProcess(
      processDefinition.type,
      {}
    );
    
    expect(createResult?.success).toBe(true);
    if (!createResult?.success || !createResult.value) return;
    
    const processId = createResult.value.id;
    
    // Try to apply an invalid transition (created -> completed)
    const invalidTransitionResult = await runtime.processManager?.applyEvent(
      processId,
      'complete',
      {}
    );
    
    expect(invalidTransitionResult?.success).toBe(false);
  });
}); 