import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../src/core/dsl.js';
import { ComponentType } from '../../src/models/component.js';

// Mock the workflow extension module
vi.mock('../../src/extensions/workflow.extension.js', async () => {
  const actual = await vi.importActual('../../src/extensions/workflow.extension.js');
  return {
    ...actual,
    setupWorkflowExtension: vi.fn().mockImplementation((dsl, options) => {
      // Mock implementation for testing
      if (!dsl.registry) {
        (dsl as any).registry = {
          getComponentsByType: vi.fn().mockReturnValue([]),
          getComponentById: vi.fn()
        };
      }
    })
  };
});

// Import after mocking
import { 
  setupWorkflowExtension, 
  WorkflowExtensionOptions
} from '../../src/extensions/workflow.extension.js';

describe('Workflow Extension', () => {
  let dsl: DSL;
  let workflowOptions: WorkflowExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    workflowOptions = {
      enablePersistence: true,
      historySize: 50,
      autoValidateTransitions: true
    };
    
    // Setup extension
    setupWorkflowExtension(dsl, workflowOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Workflow Definition', () => {
    it('should enhance workflow components with execution methods', () => {
      // Define a simple workflow
      const orderWorkflow = dsl.component('OrderWorkflow', {
        type: ComponentType.WORKFLOW,
        description: 'Order processing workflow',
        version: '1.0.0',
        initialState: 'created',
        transitions: [
          {
            from: 'created',
            to: 'processing',
            action: 'processOrder',
            conditions: ['paymentVerified']
          },
          {
            from: 'processing',
            to: 'shipped',
            action: 'shipOrder'
          },
          {
            from: 'shipped',
            to: 'delivered',
            action: 'deliverOrder'
          },
          {
            from: 'created',
            to: 'cancelled',
            action: 'cancelOrder'
          }
        ]
      });
      
      // Extension should add start method to workflow
      expect(typeof (orderWorkflow as any).start).toBe('function');
      
      // Extension should add transition method
      expect(typeof (orderWorkflow as any).transition).toBe('function');
      
      // Extension should add getAvailableTransitions method
      expect(typeof (orderWorkflow as any).getAvailableTransitions).toBe('function');
      
      // Extension should add getCurrentState method
      expect(typeof (orderWorkflow as any).getCurrentState).toBe('function');
      
      // Extension should add getHistory method
      expect(typeof (orderWorkflow as any).getHistory).toBe('function');
    });
    
    it('should support complex workflow definitions with nested states', () => {
      // Define a workflow with nested states
      const complexWorkflow = dsl.component('ComplexWorkflow', {
        type: ComponentType.WORKFLOW,
        description: 'Complex workflow with nested states',
        version: '1.0.0',
        initialState: 'idle',
        states: {
          idle: {
            description: 'Workflow is waiting to start',
            onEnter: 'logEntry',
            onExit: 'logExit'
          },
          processing: {
            description: 'Workflow is processing',
            nested: {
              initialState: 'validate',
              states: {
                validate: { description: 'Validating input' },
                compute: { description: 'Computing results' },
                finalize: { description: 'Finalizing process' }
              },
              transitions: [
                { from: 'validate', to: 'compute', action: 'startComputation' },
                { from: 'compute', to: 'finalize', action: 'finalizeResults' }
              ]
            }
          },
          completed: {
            description: 'Workflow has completed successfully',
            final: true
          },
          failed: {
            description: 'Workflow has failed',
            final: true
          }
        },
        transitions: [
          { from: 'idle', to: 'processing', action: 'startProcessing' },
          { from: 'processing', to: 'completed', action: 'complete' },
          { from: 'processing', to: 'failed', action: 'fail' }
        ]
      });
      
      // Should have methods for working with complex workflows
      expect(typeof (complexWorkflow as any).start).toBe('function');
      expect(typeof (complexWorkflow as any).getNestedState).toBe('function');
      expect(typeof (complexWorkflow as any).transitionNested).toBe('function');
      
      // Should be able to get states and transitions
      const allStates = (complexWorkflow as any).getAllStates();
      const allTransitions = (complexWorkflow as any).getAllTransitions();
      
      expect(allStates).toContain('idle');
      expect(allStates).toContain('processing');
      expect(allStates).toContain('processing.validate');
      expect(allStates).toContain('processing.compute');
      
      expect(allTransitions).toContainEqual(
        expect.objectContaining({ from: 'idle', to: 'processing' })
      );
      expect(allTransitions).toContainEqual(
        expect.objectContaining({ from: 'processing.validate', to: 'processing.compute' })
      );
    });
  });

  describe('Workflow Execution', () => {
    it('should allow starting a workflow instance and tracking state', () => {
      // Define a workflow
      const simpleWorkflow = dsl.component('SimpleWorkflow', {
        type: ComponentType.WORKFLOW,
        description: 'Simple test workflow',
        version: '1.0.0',
        initialState: 'start',
        transitions: [
          { from: 'start', to: 'middle', action: 'goToMiddle' },
          { from: 'middle', to: 'end', action: 'goToEnd' }
        ]
      });
      
      // Start a workflow instance
      const instance = (simpleWorkflow as any).start({ id: 'instance-1' });
      
      // Verify initial state
      expect(instance.getCurrentState()).toBe('start');
      
      // Verify available transitions
      const availableTransitions = instance.getAvailableTransitions();
      expect(availableTransitions).toHaveLength(1);
      expect(availableTransitions[0].to).toBe('middle');
      expect(availableTransitions[0].action).toBe('goToMiddle');
      
      // Perform a transition
      instance.transition('goToMiddle', { data: 'test' });
      
      // Verify new state
      expect(instance.getCurrentState()).toBe('middle');
      
      // Verify history is tracked
      const history = instance.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].from).toBe('start');
      expect(history[0].to).toBe('middle');
      expect(history[0].action).toBe('goToMiddle');
      expect(history[0].timestamp).toBeDefined();
      
      // Verify history has the data payload
      expect(history[0].data).toEqual({ data: 'test' });
    });
    
    it('should validate transitions and prevent invalid ones', () => {
      // Define a workflow with conditions
      const conditionalWorkflow = dsl.component('ConditionalWorkflow', {
        type: ComponentType.WORKFLOW,
        description: 'Workflow with conditional transitions',
        version: '1.0.0',
        initialState: 'pending',
        transitions: [
          { 
            from: 'pending', 
            to: 'approved', 
            action: 'approve',
            conditions: ['hasPermission', 'amountWithinLimit']
          },
          { 
            from: 'pending', 
            to: 'rejected', 
            action: 'reject' 
          }
        ]
      });
      
      // Mock condition handlers
      const hasPermission = vi.fn().mockReturnValue(true);
      const amountWithinLimit = vi.fn().mockReturnValue(false);
      
      // Register condition handlers
      (conditionalWorkflow as any).registerCondition('hasPermission', hasPermission);
      (conditionalWorkflow as any).registerCondition('amountWithinLimit', amountWithinLimit);
      
      // Start a workflow instance
      const instance = (conditionalWorkflow as any).start({ id: 'conditional-1', amount: 5000 });
      
      // Try to execute transition with failing condition
      expect(() => {
        instance.transition('approve', { userId: 'user-123', amount: 5000 });
      }).toThrow(/condition failed/i);
      
      // Verify state hasn't changed
      expect(instance.getCurrentState()).toBe('pending');
      
      // Verify condition functions were called with context
      expect(hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({ 
          userId: 'user-123', 
          amount: 5000 
        }),
        expect.anything()
      );
      
      expect(amountWithinLimit).toHaveBeenCalledWith(
        expect.objectContaining({ 
          userId: 'user-123', 
          amount: 5000 
        }),
        expect.anything()
      );
      
      // Make the condition pass
      amountWithinLimit.mockReturnValue(true);
      
      // Try the transition again
      instance.transition('approve', { userId: 'user-123', amount: 5000 });
      
      // Verify state has changed
      expect(instance.getCurrentState()).toBe('approved');
    });
    
    it('should execute action handlers during transitions', () => {
      // Define a workflow with actions
      const actionWorkflow = dsl.component('ActionWorkflow', {
        type: ComponentType.WORKFLOW,
        description: 'Workflow with actions',
        version: '1.0.0',
        initialState: 'new',
        transitions: [
          { from: 'new', to: 'processing', action: 'process' },
          { from: 'processing', to: 'completed', action: 'complete' }
        ]
      });
      
      // Mock action handlers
      const processMock = vi.fn();
      const completeMock = vi.fn();
      
      // Register action handlers
      (actionWorkflow as any).registerAction('process', processMock);
      (actionWorkflow as any).registerAction('complete', completeMock);
      
      // Start a workflow instance
      const instance = (actionWorkflow as any).start({ id: 'action-1' });
      
      // Execute transition
      instance.transition('process', { data: 'process-data' });
      
      // Verify action was called with context
      expect(processMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: 'process-data' }),
        expect.objectContaining({
          from: 'new',
          to: 'processing',
          action: 'process'
        })
      );
      
      // Execute another transition
      instance.transition('complete', { data: 'complete-data' });
      
      // Verify second action was called
      expect(completeMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: 'complete-data' }),
        expect.objectContaining({
          from: 'processing',
          to: 'completed',
          action: 'complete'
        })
      );
    });
    
    it('should handle parallel workflow execution', async () => {
      // Define a workflow for parallel execution testing
      const parallelWorkflow = dsl.component('ParallelWorkflow', {
        type: ComponentType.WORKFLOW,
        description: 'Workflow with parallel branches',
        version: '1.0.0',
        initialState: 'start',
        parallelSupport: true,
        transitions: [
          { from: 'start', to: 'processing', action: 'beginProcess' },
          { from: 'processing', to: 'verification', action: 'verify', parallel: true },
          { from: 'processing', to: 'notification', action: 'notify', parallel: true },
          { from: 'verification', to: 'completed', action: 'verificationComplete' },
          { from: 'notification', to: 'completed', action: 'notificationComplete' },
          { from: 'completed', to: 'end', action: 'finish', join: true }
        ]
      });
      
      // Mock action handlers with async behavior
      const beginProcessMock = vi.fn().mockResolvedValue(undefined);
      const verifyMock = vi.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 50));
      });
      const notifyMock = vi.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 30));
      });
      const verificationCompleteMock = vi.fn().mockResolvedValue(undefined);
      const notificationCompleteMock = vi.fn().mockResolvedValue(undefined);
      const finishMock = vi.fn().mockResolvedValue(undefined);
      
      // Register action handlers
      (parallelWorkflow as any).registerAction('beginProcess', beginProcessMock);
      (parallelWorkflow as any).registerAction('verify', verifyMock);
      (parallelWorkflow as any).registerAction('notify', notifyMock);
      (parallelWorkflow as any).registerAction('verificationComplete', verificationCompleteMock);
      (parallelWorkflow as any).registerAction('notificationComplete', notificationCompleteMock);
      (parallelWorkflow as any).registerAction('finish', finishMock);
      
      // Start a workflow instance
      const instance = (parallelWorkflow as any).start({ id: 'parallel-1' });
      
      // Begin the process
      await instance.transition('beginProcess');
      expect(instance.getCurrentState()).toBe('processing');
      
      // Start parallel branches
      const verifyPromise = instance.transition('verify');
      const notifyPromise = instance.transition('notify');
      
      // Wait for both branches to complete their transitions
      await verifyPromise;
      await notifyPromise;
      
      // Both branches should be active
      expect(instance.getActiveStates()).toContain('verification');
      expect(instance.getActiveStates()).toContain('notification');
      
      // Complete verification branch
      await instance.transition('verificationComplete', null, { branch: 'verification' });
      
      // Complete notification branch
      await instance.transition('notificationComplete', null, { branch: 'notification' });
      
      // Both branches should be in 'completed' state
      expect(instance.getActiveStates()).toEqual(['completed', 'completed']);
      
      // Join branches and finish
      await instance.transition('finish');
      
      // Final state should be 'end'
      expect(instance.getCurrentState()).toBe('end');
      
      // Verify all actions were called
      expect(beginProcessMock).toHaveBeenCalled();
      expect(verifyMock).toHaveBeenCalled();
      expect(notifyMock).toHaveBeenCalled();
      expect(verificationCompleteMock).toHaveBeenCalled();
      expect(notificationCompleteMock).toHaveBeenCalled();
      expect(finishMock).toHaveBeenCalled();
    });
  });

  describe('Workflow Persistence', () => {
    it('should persist workflow state and allow restoration', () => {
      // Define a workflow
      const persistableWorkflow = dsl.component('PersistableWorkflow', {
        type: ComponentType.WORKFLOW,
        description: 'Workflow that can be persisted',
        version: '1.0.0',
        initialState: 'step1',
        transitions: [
          { from: 'step1', to: 'step2', action: 'toStep2' },
          { from: 'step2', to: 'step3', action: 'toStep3' },
          { from: 'step3', to: 'complete', action: 'complete' }
        ]
      });
      
      // Start a workflow instance
      const instance = (persistableWorkflow as any).start({ id: 'persist-1', data: 'initial' });
      
      // Make some transitions
      instance.transition('toStep2', { data: 'step2-data' });
      instance.transition('toStep3', { data: 'step3-data' });
      
      // Verify current state
      expect(instance.getCurrentState()).toBe('step3');
      
      // Get the serialized state
      const serializedState = instance.serialize();
      
      // Verify serialized state has the expected structure
      expect(serializedState).toBeDefined();
      expect(serializedState.id).toBe('persist-1');
      expect(serializedState.currentState).toBe('step3');
      expect(serializedState.context).toEqual(expect.objectContaining({ data: 'initial' }));
      expect(serializedState.history).toHaveLength(2);
      expect(serializedState.history[0].action).toBe('toStep2');
      expect(serializedState.history[1].action).toBe('toStep3');
      
      // Create a new instance from the serialized state
      const restoredInstance = (persistableWorkflow as any).restore(serializedState);
      
      // Verify restored state
      expect(restoredInstance.getCurrentState()).toBe('step3');
      expect(restoredInstance.getContext()).toEqual(expect.objectContaining({ data: 'initial' }));
      expect(restoredInstance.getHistory()).toHaveLength(2);
      
      // Continue execution from restored state
      restoredInstance.transition('complete', { finalData: true });
      
      // Verify continued execution
      expect(restoredInstance.getCurrentState()).toBe('complete');
      expect(restoredInstance.getHistory()).toHaveLength(3);
      expect(restoredInstance.getHistory()[2].action).toBe('complete');
    });
  });

  describe('Workflow Observability', () => {
    it('should allow observing workflow state changes', () => {
      // Define a workflow
      const observableWorkflow = dsl.component('ObservableWorkflow', {
        type: ComponentType.WORKFLOW,
        description: 'Workflow that can be observed',
        version: '1.0.0',
        initialState: 'pending',
        transitions: [
          { from: 'pending', to: 'active', action: 'activate' },
          { from: 'active', to: 'completed', action: 'complete' }
        ]
      });
      
      // Create observer mocks
      const stateChangeObserver = vi.fn();
      const transitionStartObserver = vi.fn();
      const transitionEndObserver = vi.fn();
      
      // Start a workflow instance
      const instance = (observableWorkflow as any).start({ id: 'observable-1' });
      
      // Register observers
      instance.onStateChange(stateChangeObserver);
      instance.onTransitionStart(transitionStartObserver);
      instance.onTransitionEnd(transitionEndObserver);
      
      // Execute transition
      instance.transition('activate', { activatedBy: 'user-123' });
      
      // Verify observers were called
      expect(transitionStartObserver).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'pending',
          to: 'active',
          action: 'activate'
        }),
        expect.objectContaining({ activatedBy: 'user-123' })
      );
      
      expect(stateChangeObserver).toHaveBeenCalledWith(
        'active',
        'pending',
        expect.objectContaining({
          action: 'activate'
        })
      );
      
      expect(transitionEndObserver).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'pending',
          to: 'active',
          action: 'activate',
          success: true
        }),
        expect.objectContaining({ activatedBy: 'user-123' })
      );
      
      // Reset mocks
      stateChangeObserver.mockClear();
      transitionStartObserver.mockClear();
      transitionEndObserver.mockClear();
      
      // Execute another transition
      instance.transition('complete');
      
      // Verify observers were called again
      expect(stateChangeObserver).toHaveBeenCalledWith(
        'completed',
        'active',
        expect.objectContaining({
          action: 'complete'
        })
      );
    });
  });

  describe('System Integration', () => {
    it('should integrate workflows with system definitions', () => {
      // Define some workflows
      dsl.component('Workflow1', {
        type: ComponentType.WORKFLOW,
        description: 'Workflow 1',
        version: '1.0.0',
        initialState: 'start',
        transitions: [
          { from: 'start', to: 'end', action: 'finish' }
        ]
      });
      
      dsl.component('Workflow2', {
        type: ComponentType.WORKFLOW,
        description: 'Workflow 2',
        version: '1.0.0',
        initialState: 'start',
        transitions: [
          { from: 'start', to: 'middle', action: 'step1' },
          { from: 'middle', to: 'end', action: 'step2' }
        ]
      });
      
      // Define a system that uses these workflows
      const system = dsl.system('TestSystem', {
        description: 'Test system',
        version: '1.0.0',
        components: {
          workflows: [
            { ref: 'Workflow1' },
            { ref: 'Workflow2' }
          ]
        }
      });
      
      // Extension should add methods to access and use workflows
      expect(typeof (system as any).getWorkflows).toBe('function');
      expect(typeof (system as any).startWorkflow).toBe('function');
      
      // Get workflows from the system
      const workflows = (system as any).getWorkflows();
      expect(workflows).toHaveLength(2);
      expect(workflows[0].id).toBe('Workflow1');
      expect(workflows[1].id).toBe('Workflow2');
      
      // Should be able to start a workflow from the system
      const workflowInstance = (system as any).startWorkflow('Workflow1', { systemData: true });
      expect(workflowInstance).toBeDefined();
      expect(workflowInstance.getCurrentState()).toBe('start');
      
      // Transition the workflow
      workflowInstance.transition('finish');
      expect(workflowInstance.getCurrentState()).toBe('end');
    });
  });
}); 