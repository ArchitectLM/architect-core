import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestDefinition, TestStep, TestResult, TestContext } from './types';

// Mock test runner function (to be implemented in the actual code)
const runTest = vi.fn();

// Define step result type to fix linter errors
interface StepResult {
  success: boolean;
  result?: any;
  error?: Error;
}

// Define test step result type
interface TestStepResult {
  step: TestStep;
  success: boolean;
  result?: any;
  error?: Error;
}

// Define custom test step types for testing
interface CreateProcessStep {
  action: 'createProcess';
  input: any;
}

interface TransitionStep {
  action: 'transition';
  event: string;
  data?: any;
}

interface ExecuteTaskStep {
  action: 'executeTask';
  taskId: string;
  input: any;
}

interface VerifyStateStep {
  action: 'verifyState';
  state: string;
}

interface VerifyMockCalledStep {
  action: 'verifyMockCalled';
  service: string;
  method: string;
}

interface SetMockStep {
  action: 'setMock';
  service: string;
  method: string;
  implementation: Function;
}

interface EmitEventStep {
  action: 'emitEvent';
  type: string;
  payload: any;
}

interface ExecuteCodeStep {
  action: 'executeCode';
  code: (context: any, runtime: any) => any;
}

type MockTestStep = CreateProcessStep | TransitionStep | ExecuteTaskStep | 
                    VerifyStateStep | VerifyMockCalledStep | SetMockStep | 
                    EmitEventStep | ExecuteCodeStep;

describe('Test Utilities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('Test Runner', () => {
    it('should execute test steps in sequence', async () => {
      // Arrange
      const mockExecuteStep = vi.fn();
      mockExecuteStep
        .mockReturnValueOnce({ success: true, result: { state: 'created' } })
        .mockReturnValueOnce({ success: true, result: { state: 'processing' } })
        .mockReturnValueOnce({ success: true, result: { state: 'completed' } });
      
      const testDefinition: TestDefinition = {
        name: 'order-flow-test',
        steps: [
          { action: 'createProcess', input: { orderId: '12345' } },
          { action: 'transition', event: 'START_PROCESSING', data: { userId: 'user-1' } },
          { action: 'transition', event: 'COMPLETE', data: { completedBy: 'user-1' } }
        ]
      };
      
      // Mock implementation of runTest
      runTest.mockImplementation(async (test: TestDefinition) => {
        const results = test.steps.map(step => {
          const stepResult = mockExecuteStep(step) as StepResult;
          return {
            step,
            ...stepResult
          };
        });
        
        const success = results.every(r => r.success);
        
        return {
          testId: test.name,
          success,
          steps: results,
          duration: 100 // Mock duration
        };
      });
      
      // Act
      const result = await runTest(testDefinition);
      
      // Assert
      expect(result.success).toBe(true);
      expect(result.steps).toHaveLength(3);
      expect(mockExecuteStep).toHaveBeenCalledTimes(3);
      expect(result.steps[0].step).toEqual(testDefinition.steps[0]);
      expect(result.steps[1].step).toEqual(testDefinition.steps[1]);
      expect(result.steps[2].step).toEqual(testDefinition.steps[2]);
    });

    it('should handle test step failures', async () => {
      // Arrange
      const mockExecuteStep = vi.fn();
      mockExecuteStep
        .mockReturnValueOnce({ success: true, result: { state: 'created' } })
        .mockReturnValueOnce({ success: false, error: new Error('Transition failed') });
      
      const testDefinition: TestDefinition = {
        name: 'failing-test',
        steps: [
          { action: 'createProcess', input: { orderId: '12345' } },
          { action: 'transition', event: 'INVALID_EVENT' }
        ]
      };
      
      // Mock implementation of runTest
      runTest.mockImplementation(async (test: TestDefinition) => {
        const results: TestStepResult[] = [];
        
        for (const step of test.steps) {
          const stepResult = mockExecuteStep(step) as StepResult;
          results.push({
            step,
            ...stepResult
          });
          
          // Stop on failure if needed
          if (!stepResult.success) {
            break;
          }
        }
        
        const success = results.every(r => r.success);
        
        return {
          testId: test.name,
          success,
          steps: results,
          duration: 50 // Mock duration
        };
      });
      
      // Act
      const result = await runTest(testDefinition);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.steps).toHaveLength(2);
      expect(mockExecuteStep).toHaveBeenCalledTimes(2);
      expect(result.steps[1].success).toBe(false);
      expect(result.steps[1].error).toBeInstanceOf(Error);
    });
  });

  describe('Test Context', () => {
    it('should provide access to process state and services', () => {
      // Arrange
      const mockGetService = vi.fn().mockReturnValue({ getData: vi.fn() });
      const mockEmitEvent = vi.fn();
      const mockExecuteTask = vi.fn().mockResolvedValue({ result: 'success' });
      const mockTransitionProcess = vi.fn();
      const mockGetContext = vi.fn().mockReturnValue({ orderId: '12345', state: 'created' });
      const mockUpdateContext = vi.fn();
      const mockMockCalls = vi.fn().mockReturnValue([{ arg1: 'value1' }]);
      const mockSetMock = vi.fn();
      
      const testContext: TestContext = {
        processId: 'order-process',
        instanceId: 'instance-1',
        getService: mockGetService,
        emitEvent: mockEmitEvent,
        executeTask: mockExecuteTask,
        transitionProcess: mockTransitionProcess,
        getContext: mockGetContext,
        updateContext: mockUpdateContext,
        mockCalls: mockMockCalls,
        setMock: mockSetMock
      };
      
      // Act & Assert
      expect(testContext.processId).toBe('order-process');
      expect(testContext.instanceId).toBe('instance-1');
      
      const service = testContext.getService('database');
      expect(mockGetService).toHaveBeenCalledWith('database');
      
      testContext.emitEvent('TEST_EVENT', { data: 'test' });
      expect(mockEmitEvent).toHaveBeenCalledWith('TEST_EVENT', { data: 'test' });
      
      const taskPromise = testContext.executeTask('test-task', { input: 'data' });
      expect(mockExecuteTask).toHaveBeenCalledWith('test-task', { input: 'data' });
      
      const context = testContext.getContext();
      expect(mockGetContext).toHaveBeenCalled();
      expect(context).toEqual({ orderId: '12345', state: 'created' });
      
      const calls = testContext.mockCalls('service.method');
      expect(mockMockCalls).toHaveBeenCalledWith('service.method');
      expect(calls).toEqual([{ arg1: 'value1' }]);
    });
  });

  describe('Test Step Execution', () => {
    const mockRuntime = {
      createProcess: vi.fn(),
      getProcess: vi.fn(),
      transitionProcess: vi.fn(),
      executeTask: vi.fn(),
      emitEvent: vi.fn()
    };
    
    const mockContext = {
      instanceId: 'instance-1',
      mockCalls: vi.fn(),
      setMock: vi.fn(),
      emitEvent: vi.fn()
    };
    
    // Mock step executor (to be implemented in the actual code)
    const executeStep = vi.fn();
    
    beforeEach(() => {
      vi.resetAllMocks();
      
      // Setup mock return values
      mockRuntime.createProcess.mockReturnValue({ id: 'instance-1', state: 'created' });
      mockRuntime.getProcess.mockReturnValue({ id: 'instance-1', state: 'processing' });
      mockRuntime.transitionProcess.mockReturnValue({ id: 'instance-1', state: 'processing' });
      mockRuntime.executeTask.mockResolvedValue({ result: 'success' });
      
      // Setup mock implementations for each step type
      executeStep.mockImplementation((step: MockTestStep, context: any, runtime: any) => {
        switch (step.action) {
          case 'createProcess':
            return { 
              success: true, 
              result: runtime.createProcess(step.input.processId || 'default', step.input)
            };
            
          case 'transition':
            return { 
              success: true, 
              result: runtime.transitionProcess(context.instanceId, step.event, step.data)
            };
            
          case 'executeTask':
            return { 
              success: true, 
              result: runtime.executeTask(step.taskId, step.input)
            };
            
          case 'verifyState':
            const process = runtime.getProcess(context.instanceId);
            const stateMatches = process.state === step.state;
            return { 
              success: stateMatches, 
              result: process,
              error: stateMatches ? undefined : new Error(`Expected state ${step.state} but got ${process.state}`)
            };
            
          case 'verifyMockCalled':
            const calls = context.mockCalls(`${step.service}.${step.method}`);
            const wasCalled = calls.length > 0;
            return { 
              success: wasCalled, 
              result: calls,
              error: wasCalled ? undefined : new Error(`Expected mock ${step.service}.${step.method} to be called`)
            };
            
          case 'setMock':
            context.setMock(`${step.service}.${step.method}`, step.implementation);
            return { success: true };
            
          case 'emitEvent':
            context.emitEvent(step.type, step.payload);
            return { success: true };
            
          case 'executeCode':
            try {
              const result = step.code(context, runtime);
              return { success: true, result };
            } catch (error) {
              return { success: false, error };
            }
            
          default:
            return { success: false, error: new Error(`Unknown step action: ${(step as any).action}`) };
        }
      });
    });

    it('should execute createProcess step', () => {
      // Arrange
      const step: CreateProcessStep = { 
        action: 'createProcess', 
        input: { processId: 'order-process', data: { orderId: '12345' } } 
      };
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockRuntime.createProcess).toHaveBeenCalledWith('order-process', step.input);
      expect(result.result).toEqual({ id: 'instance-1', state: 'created' });
    });

    it('should execute transition step', () => {
      // Arrange
      const step: TransitionStep = { 
        action: 'transition', 
        event: 'PROCESS', 
        data: { userId: 'user-1' } 
      };
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockRuntime.transitionProcess).toHaveBeenCalledWith('instance-1', 'PROCESS', { userId: 'user-1' });
      expect(result.result).toEqual({ id: 'instance-1', state: 'processing' });
    });

    it('should execute executeTask step', async () => {
      // Arrange
      const step: ExecuteTaskStep = { 
        action: 'executeTask', 
        taskId: 'process-order', 
        input: { orderId: '12345' } 
      };
      
      // Mock executeTask to return a resolved promise with the result
      mockRuntime.executeTask.mockReturnValue(Promise.resolve({ result: 'success' }));
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockRuntime.executeTask).toHaveBeenCalledWith('process-order', { orderId: '12345' });
      
      // Since executeTask returns a promise, we need to check the resolved value
      await expect(result.result).resolves.toEqual({ result: 'success' });
    });

    it('should execute verifyState step with matching state', () => {
      // Arrange
      const step: VerifyStateStep = { 
        action: 'verifyState', 
        state: 'processing' 
      };
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockRuntime.getProcess).toHaveBeenCalledWith('instance-1');
      expect(result.result).toEqual({ id: 'instance-1', state: 'processing' });
    });

    it('should execute verifyState step with non-matching state', () => {
      // Arrange
      const step: VerifyStateStep = { 
        action: 'verifyState', 
        state: 'completed' 
      };
      
      mockRuntime.getProcess.mockReturnValueOnce({ id: 'instance-1', state: 'processing' });
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Expected state completed but got processing');
    });

    it('should execute verifyMockCalled step with called mock', () => {
      // Arrange
      const step: VerifyMockCalledStep = { 
        action: 'verifyMockCalled', 
        service: 'service',
        method: 'method'
      };
      
      mockContext.mockCalls.mockReturnValueOnce([{ arg: 'value' }]);
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockContext.mockCalls).toHaveBeenCalledWith('service.method');
      expect(result.result).toEqual([{ arg: 'value' }]);
    });

    it('should execute verifyMockCalled step with uncalled mock', () => {
      // Arrange
      const step: VerifyMockCalledStep = { 
        action: 'verifyMockCalled', 
        service: 'service',
        method: 'method'
      };
      
      mockContext.mockCalls.mockReturnValueOnce([]);
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Expected mock service.method to be called');
    });

    it('should execute setMock step', () => {
      // Arrange
      const mockImplementation = vi.fn();
      const step: SetMockStep = { 
        action: 'setMock', 
        service: 'service',
        method: 'method',
        implementation: mockImplementation
      };
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockContext.setMock).toHaveBeenCalledWith('service.method', mockImplementation);
    });

    it('should execute emitEvent step', () => {
      // Arrange
      const step: EmitEventStep = { 
        action: 'emitEvent', 
        type: 'TEST_EVENT',
        payload: { data: 'test' }
      };
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockContext.emitEvent).toHaveBeenCalledWith('TEST_EVENT', { data: 'test' });
    });

    it('should execute executeCode step with successful code', () => {
      // Arrange
      const mockCode = vi.fn().mockReturnValue({ custom: 'result' });
      const step: ExecuteCodeStep = { 
        action: 'executeCode', 
        code: mockCode
      };
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(true);
      expect(mockCode).toHaveBeenCalledWith(mockContext, mockRuntime);
      expect(result.result).toEqual({ custom: 'result' });
    });

    it('should execute executeCode step with failing code', () => {
      // Arrange
      const mockError = new Error('Code execution failed');
      const mockCode = vi.fn().mockImplementation(() => {
        throw mockError;
      });
      
      const step: ExecuteCodeStep = { 
        action: 'executeCode', 
        code: mockCode
      };
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(false);
      expect(mockCode).toHaveBeenCalledWith(mockContext, mockRuntime);
      expect(result.error).toBe(mockError);
    });

    it('should handle unknown step action', () => {
      // Arrange
      const step = { 
        action: 'unknownAction' 
      } as any;
      
      // Act
      const result = executeStep(step, mockContext, mockRuntime);
      
      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toContain('Unknown step action: unknownAction');
    });
  });
}); 