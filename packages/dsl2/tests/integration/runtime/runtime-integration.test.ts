import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { RuntimeAdapter } from '../../../src/runtime/adapter.js';

// Mock runtime object for testing
const mockRuntime = {
  createProcess: vi.fn().mockResolvedValue({ id: 'process-123', state: 'initial' }),
  getProcess: vi.fn(),
  transitionProcess: vi.fn(),
  executeTask: vi.fn().mockResolvedValue({ result: 'task-executed' }),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  publish: vi.fn()
};

// Mock the core2 runtime
vi.mock('@architectlm/core', async () => {
  return {
    createRuntime: vi.fn().mockReturnValue(mockRuntime)
  };
});

describe('Runtime Integration', () => {
  let dsl: DSL;
  let adapter: RuntimeAdapter;

  beforeEach(() => {
    dsl = new DSL();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Runtime Creation', () => {
    it('should create a runtime adapter with DSL instance', () => {
      adapter = new RuntimeAdapter(dsl);
      expect(adapter).toBeDefined();
    });

    it('should create a runtime with default options', async () => {
      adapter = new RuntimeAdapter(dsl);
      const runtime = await adapter.createRuntime('TestSystem');
      
      expect(runtime).toBeDefined();
      expect(runtime).toBe(mockRuntime);
    });

    it('should create a runtime with custom options', async () => {
      adapter = new RuntimeAdapter(dsl);
      
      const customExtensionSystem = { name: 'CustomExtensionSystem' };
      const customEventBus = { name: 'CustomEventBus' };
      
      const runtime = await adapter.createRuntime('TestSystem', {
        extensionSystem: customExtensionSystem as any,
        eventBus: customEventBus as any
      });
      
      expect(runtime).toBeDefined();
      expect(runtime).toBe(mockRuntime);
    });
  });

  describe('Runtime Operations', () => {
    beforeEach(() => {
      adapter = new RuntimeAdapter(dsl);
    });

    it('should execute tasks through the runtime', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      
      // Since we're mocking the runtime and not setting up real components,
      // we can just test the mock call directly
      const result = await runtime.executeTask('TestTask', { data: 'test' });
      
      expect(mockRuntime.executeTask).toHaveBeenCalledWith('TestTask', { data: 'test' });
      expect(result).toEqual({ result: 'task-executed' });
    });

    it('should handle task execution errors', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      
      // Set up mock to throw an error
      const error = new Error('Task execution failed');
      mockRuntime.executeTask.mockRejectedValueOnce(error);
      
      await expect(runtime.executeTask('FailingTask', { data: 'test' }))
        .rejects.toThrow('Task execution failed');
      
      expect(mockRuntime.executeTask).toHaveBeenCalledWith('FailingTask', { data: 'test' });
    });

    it('should create processes through the runtime', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      const processData = { data: 'test' };
      
      const process = await runtime.createProcess('TestProcess', processData);
      
      expect(mockRuntime.createProcess).toHaveBeenCalledWith('TestProcess', processData);
      expect(process).toEqual({ id: 'process-123', state: 'initial' });
    });

    it('should handle process creation errors', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      const processData = { data: 'test' };
      
      // Set up mock to throw an error
      const error = new Error('Process creation failed');
      mockRuntime.createProcess.mockRejectedValueOnce(error);
      
      await expect(runtime.createProcess('FailingProcess', processData))
        .rejects.toThrow('Process creation failed');
      
      expect(mockRuntime.createProcess).toHaveBeenCalledWith('FailingProcess', processData);
    });

    it('should transition processes through the runtime', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      
      // Set up mock response for transitionProcess
      mockRuntime.transitionProcess.mockResolvedValue({
        id: 'process-123',
        state: 'completed',
        data: { data: 'test' }
      });
      
      const transitionedProcess = await runtime.transitionProcess('process-123', 'COMPLETED');
      
      expect(mockRuntime.transitionProcess).toHaveBeenCalledWith('process-123', 'COMPLETED');
      expect(transitionedProcess).toEqual({
        id: 'process-123',
        state: 'completed',
        data: { data: 'test' }
      });
    });

    it('should handle process transition errors', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      
      // Set up mock to throw an error
      const error = new Error('Process transition failed');
      mockRuntime.transitionProcess.mockRejectedValueOnce(error);
      
      await expect(runtime.transitionProcess('process-123', 'INVALID_EVENT'))
        .rejects.toThrow('Process transition failed');
      
      expect(mockRuntime.transitionProcess).toHaveBeenCalledWith('process-123', 'INVALID_EVENT');
    });

    it('should get processes through the runtime', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      
      // Set up mock response for getProcess
      mockRuntime.getProcess.mockResolvedValue({
        id: 'process-123',
        state: 'initial',
        data: { data: 'test' }
      });
      
      const process = await runtime.getProcess('process-123');
      
      expect(mockRuntime.getProcess).toHaveBeenCalledWith('process-123');
      expect(process).toEqual({
        id: 'process-123',
        state: 'initial',
        data: { data: 'test' }
      });
    });

    it('should handle get process errors', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      
      // Set up mock to throw an error
      const error = new Error('Process not found');
      mockRuntime.getProcess.mockRejectedValueOnce(error);
      
      await expect(runtime.getProcess('non-existent-process'))
        .rejects.toThrow('Process not found');
      
      expect(mockRuntime.getProcess).toHaveBeenCalledWith('non-existent-process');
    });
  });

  describe('Event Handling', () => {
    beforeEach(() => {
      adapter = new RuntimeAdapter(dsl);
    });

    it('should subscribe to events', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      const handler = vi.fn();
      const eventType = 'TEST_EVENT';
      
      runtime.subscribe(eventType, handler);
      
      expect(mockRuntime.subscribe).toHaveBeenCalledWith(eventType, handler);
    });

    it('should unsubscribe from events', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      const handler = vi.fn();
      const eventType = 'TEST_EVENT';
      
      runtime.unsubscribe(eventType, handler);
      
      expect(mockRuntime.unsubscribe).toHaveBeenCalledWith(eventType, handler);
    });

    it('should publish events', async () => {
      const runtime = await adapter.createRuntime('TestSystem');
      const eventType = 'TEST_EVENT';
      const payload = { data: 'test' };
      
      runtime.publish(eventType, payload);
      
      expect(mockRuntime.publish).toHaveBeenCalledWith(eventType, payload);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      adapter = new RuntimeAdapter(dsl);
    });

    it('should handle errors when creating runtime with invalid system ID', async () => {
      // Mock implementation to throw an error
      vi.spyOn(adapter, 'getRuntimeConfig' as any).mockImplementation(() => {
        throw new Error('System not found');
      });
      
      await expect(adapter.createRuntime('NonExistentSystem'))
        .rejects.toThrow('System not found');
    });
  });
}); 