import { describe, it, expect, beforeEach } from 'vitest';
import { Runtime } from '../src/models/runtime';
import { createModernRuntime } from '../src/implementations/modern-factory';
import { ProcessDefinition, ProcessInstance } from '../src/models/process-system';

// Define the process data type
interface TestProcessData {
  counter?: number;
}

describe('Process Definition', () => {
  let runtime: Runtime;

  // Use the same value for both id and name to make sure they match
  const processType = 'test-process';
  
  const processDefinition: ProcessDefinition = {
    id: processType,
    name: processType, // This is used as the process type by the registry
    description: 'A test process definition',
    initialState: 'created',
    version: '1.0.0',
    transitions: [
      { from: 'created', to: 'running', on: 'start' },
      { from: 'running', to: 'completed', on: 'complete' }
    ]
  };

  beforeEach(async () => {
    // Create and initialize runtime
    runtime = createModernRuntime({
      persistEvents: true,
      runtimeOptions: {
        version: '1.0.0',
        namespace: 'test'
      }
    });

    await runtime.initialize({
      version: '1.0.0',
      namespace: 'test'
    });
    await runtime.start();
    
    // Register the process definition
    const registerResult = await runtime.processRegistry.registerProcess(processDefinition);
    expect(registerResult.success).toBe(true);
  });

  it('should create a process with correct initial state', async () => {
    // Test process creation using process manager - use the name as the process type
    const processResult = await runtime.processManager.createProcess(processDefinition.name, {});
    expect(processResult.success).toBe(true);
    
    if (processResult.success) {
      const process = processResult.value;
      expect(process.type).toBe(processDefinition.name);
      expect(process.state).toBe(processDefinition.initialState);
    }
  });
  
  it('should transition a process through states', async () => {
    // Create a process
    const createResult = await runtime.processManager.createProcess<TestProcessData, string>(
      processDefinition.name, 
      { counter: 1 }
    );
    expect(createResult.success).toBe(true);
    
    if (createResult.success) {
      const process = createResult.value;
      expect(process.state).toBe('created');
      expect(process.data.counter).toBe(1);
      
      // Transition to running - note that the payload isn't used to update the data
      const startResult = await runtime.processManager.applyEvent<TestProcessData, string, TestProcessData>(
        process.id, 
        'start',
        { counter: 2 }
      );
      
      expect(startResult.success).toBe(true);
      
      if (startResult.success) {
        const runningProcess = startResult.value;
        expect(runningProcess.state).toBe('running');
        expect(runningProcess.data.counter).toBe(1); // Data is not changed by the transition
        
        // Transition to completed
        const completeResult = await runtime.processManager.applyEvent<TestProcessData, string, TestProcessData>(
          runningProcess.id,
          'complete',
          { counter: 3 }
        );
        
        expect(completeResult.success).toBe(true);
        
        if (completeResult.success) {
          const completedProcess = completeResult.value;
          expect(completedProcess.state).toBe('completed');
          expect(completedProcess.data.counter).toBe(1); // Data is not changed by the transition
        }
      }
    }
  });
  
  it('should handle invalid transitions', async () => {
    // Create a process
    const createResult = await runtime.processManager.createProcess(processDefinition.name, {});
    expect(createResult.success).toBe(true);
    
    if (createResult.success) {
      const process = createResult.value;
      
      // Try to apply invalid event (complete from created state)
      const invalidResult = await runtime.processManager.applyEvent(
        process.id,
        'complete',
        {}
      );
      
      expect(invalidResult.success).toBe(false);
      if (!invalidResult.success) {
        expect(invalidResult.error).toBeDefined();
      }
    }
  });
}); 