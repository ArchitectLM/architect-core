import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../../src/models/component.js';

/**
 * Tests for Implementation Composition in Actor Systems
 * 
 * These tests cover:
 * - Behavior composition from multiple implementations
 * - Extension and override of base implementations
 * - Communication between composed implementations
 * - State management across implementation boundaries
 */
describe('Implementation Composition', () => {
  let dsl: DSL;
  let compositionLog: Array<{
    source: string;
    action: string;
    timestamp: number;
    data?: any;
  }> = [];
  
  beforeEach(() => {
    dsl = new DSL();
    compositionLog = [];
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should compose behaviors from multiple implementations correctly', async () => {
    // Define a base logging behavior component
    dsl.component('LoggingBehavior', {
      type: ComponentType.ACTOR,
      description: 'Logging behavior for actors',
      version: '1.0.0',
      messageHandlers: {
        log: {
          input: {
            properties: {
              level: { type: 'string' },
              message: { type: 'string' }
            },
            required: ['level', 'message']
          },
          output: { type: 'null' }
        }
      }
    });
    
    // Define a metrics behavior component
    dsl.component('MetricsBehavior', {
      type: ComponentType.ACTOR,
      description: 'Metrics collection behavior',
      version: '1.0.0',
      messageHandlers: {
        recordMetric: {
          input: {
            properties: {
              name: { type: 'string' },
              value: { type: 'number' }
            },
            required: ['name', 'value']
          },
          output: { type: 'null' }
        }
      }
    });
    
    // Define a service actor using both behaviors
    dsl.component('ServiceActor', {
      type: ComponentType.ACTOR,
      description: 'Service actor with composed behaviors',
      version: '1.0.0',
      behaviors: [
        { ref: 'LoggingBehavior' },
        { ref: 'MetricsBehavior' }
      ],
      messageHandlers: {
        handleRequest: {
          input: {
            properties: {
              requestId: { type: 'string' },
              payload: { type: 'object' }
            },
            required: ['requestId']
          },
          output: {
            properties: {
              success: { type: 'boolean' },
              result: { type: 'object' }
            }
          }
        }
      }
    });
    
    // Implement the logging behavior
    const loggingImpl = {
      log: async (input: any, context: ActorContext) => {
        const { level, message } = input;
        
        // Record the log in our test log
        compositionLog.push({
          source: 'LoggingBehavior',
          action: 'log',
          timestamp: Date.now(),
          data: { level, message }
        });
        
        // If context has state, add log to state for verification
        if (context.state) {
          context.state.logs = context.state.logs || [];
          context.state.logs.push({ level, message, timestamp: Date.now() });
        }
        
        return null;
      }
    };
    
    // Implement the metrics behavior
    const metricsImpl = {
      recordMetric: async (input: any, context: ActorContext) => {
        const { name, value } = input;
        
        // Record the metric in our test log
        compositionLog.push({
          source: 'MetricsBehavior',
          action: 'recordMetric',
          timestamp: Date.now(),
          data: { name, value }
        });
        
        // If context has state, add metric to state for verification
        if (context.state) {
          context.state.metrics = context.state.metrics || {};
          
          if (!context.state.metrics[name]) {
            context.state.metrics[name] = { count: 0, sum: 0, avg: 0, values: [] };
          }
          
          const metric = context.state.metrics[name];
          metric.count++;
          metric.sum += value;
          metric.avg = metric.sum / metric.count;
          metric.values.push({ value, timestamp: Date.now() });
        }
        
        return null;
      }
    };
    
    // Implement the service with both behaviors
    const serviceImpl = {
      handleRequest: async (input: any, context: ActorContext) => {
        const { requestId, payload } = input;
        const startTime = Date.now();
        
        // Use behavior: log request receipt
        if (context.behaviors?.LoggingBehavior?.log) {
          await context.behaviors.LoggingBehavior.log({ 
            level: 'info', 
            message: `Received request ${requestId}`
          }, context);
        }
        
        // Process the request (simplified)
        const result = { processed: true, requestId, ...payload };
        
        // Use behavior: record processing time
        if (context.behaviors?.MetricsBehavior?.recordMetric) {
          const processingTime = Date.now() - startTime;
          await context.behaviors.MetricsBehavior.recordMetric({
            name: 'request.processingTime',
            value: processingTime
          }, context);
        }
        
        // Log completion
        if (context.behaviors?.LoggingBehavior?.log) {
          await context.behaviors.LoggingBehavior.log({
            level: 'info',
            message: `Completed request ${requestId} in ${Date.now() - startTime}ms`
          }, context);
        }
        
        return { success: true, result };
      }
    };
    
    // Register implementations
    dsl.implementation('LoggingBehaviorImpl', {
      targetComponent: 'LoggingBehavior',
      description: 'Logging behavior implementation',
      version: '1.0.0',
      handlers: loggingImpl
    });
    
    dsl.implementation('MetricsBehaviorImpl', {
      targetComponent: 'MetricsBehavior',
      description: 'Metrics behavior implementation',
      version: '1.0.0',
      handlers: metricsImpl
    });
    
    dsl.implementation('ServiceActorImpl', {
      targetComponent: 'ServiceActor',
      description: 'Service actor implementation with behaviors',
      version: '1.0.0',
      handlers: serviceImpl
    });
    
    // Mock the runtime system that would compose these implementations
    const mockContext: ActorContext = {
      state: {},
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      behaviors: {
        LoggingBehavior: loggingImpl,
        MetricsBehavior: metricsImpl
      }
    };
    
    // Execute the service
    const result = await serviceImpl.handleRequest({
      requestId: 'test-123',
      payload: { action: 'test', data: { foo: 'bar' } }
    }, mockContext);
    
    // Verify the service used both behaviors properly
    expect(result.success).toBe(true);
    expect(result.result.processed).toBe(true);
    expect(result.result.requestId).toBe('test-123');
    
    // Verify logs were created
    expect(compositionLog.filter(entry => entry.action === 'log').length).toBe(2);
    expect(compositionLog[0].source).toBe('LoggingBehavior');
    expect(compositionLog[0].data.message).toContain('Received request');
    
    // Verify metrics were recorded
    expect(compositionLog.filter(entry => entry.action === 'recordMetric').length).toBe(1);
    expect(compositionLog[1].source).toBe('MetricsBehavior');
    expect(compositionLog[1].data.name).toBe('request.processingTime');
    
    // Verify state was shared
    expect(mockContext.state.logs).toHaveLength(2);
    expect(mockContext.state.metrics['request.processingTime']).toBeDefined();
  });
  
  it('should allow extending and overriding base implementations', async () => {
    // Define a base actor
    dsl.component('BaseActor', {
      type: ComponentType.ACTOR,
      description: 'Base actor with standard methods',
      version: '1.0.0',
      messageHandlers: {
        initialize: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        process: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        shutdown: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define an extended actor
    dsl.component('ExtendedActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that extends base actor',
      version: '1.0.0',
      extends: { ref: 'BaseActor' },
      messageHandlers: {
        // Override base method
        process: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        // Add new method
        enhancedProcess: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Base implementation
    const baseImpl = {
      initialize: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'BaseActor',
          action: 'initialize',
          timestamp: Date.now()
        });
        
        context.state = { 
          ...context.state,
          initialized: true, 
          initializationTime: Date.now() 
        };
        
        return { success: true, source: 'base' };
      },
      
      process: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'BaseActor',
          action: 'process',
          timestamp: Date.now(),
          data: input
        });
        
        return { processed: true, source: 'base', input };
      },
      
      shutdown: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'BaseActor',
          action: 'shutdown',
          timestamp: Date.now()
        });
        
        return { success: true, source: 'base' };
      }
    };
    
    // Extended implementation
    const extendedImpl = {
      // Override process method
      process: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'ExtendedActor',
          action: 'process',
          timestamp: Date.now(),
          data: input
        });
        
        // Call the base implementation if needed
        if (context.parent?.BaseActor?.process) {
          const baseResult = await context.parent.BaseActor.process(input, context);
          
          // Enhance the result
          return {
            ...baseResult,
            enhanced: true,
            source: 'extended'
          };
        }
        
        // Standalone implementation
        return { processed: true, enhanced: true, source: 'extended', input };
      },
      
      // Add new method
      enhancedProcess: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'ExtendedActor',
          action: 'enhancedProcess',
          timestamp: Date.now(),
          data: input
        });
        
        // Use base process and enhance it
        if (context.parent?.BaseActor?.process) {
          const baseResult = await context.parent.BaseActor.process(input, context);
          
          return {
            ...baseResult,
            extraEnhancement: true,
            metadata: {
              processedAt: Date.now(),
              processor: 'ExtendedActor'
            }
          };
        }
        
        return { success: false, error: 'Base implementation not available' };
      }
    };
    
    // Register implementations
    dsl.implementation('BaseActorImpl', {
      targetComponent: 'BaseActor',
      description: 'Base implementation',
      version: '1.0.0',
      handlers: baseImpl
    });
    
    dsl.implementation('ExtendedActorImpl', {
      targetComponent: 'ExtendedActor',
      description: 'Extended implementation',
      version: '1.0.0',
      handlers: extendedImpl
    });
    
    // Mock context that allows for extension and overriding
    const mockContext: ActorContext = {
      state: {},
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      parent: {
        BaseActor: baseImpl
      }
    };
    
    // Test initialization from the base
    const initResult = await baseImpl.initialize({}, mockContext);
    expect(initResult.success).toBe(true);
    expect(initResult.source).toBe('base');
    expect(mockContext.state.initialized).toBe(true);
    
    // Test overridden method
    const processResult = await extendedImpl.process({ data: 'test' }, mockContext);
    expect(processResult.processed).toBe(true);
    expect(processResult.source).toBe('extended');
    expect(processResult.enhanced).toBe(true);
    
    // Verify the base process was also called
    const baseProcessLog = compositionLog.find(
      entry => entry.source === 'BaseActor' && entry.action === 'process'
    );
    expect(baseProcessLog).toBeDefined();
    
    // Test the new method that calls the base
    const enhancedResult = await extendedImpl.enhancedProcess({ data: 'enhanced' }, mockContext);
    expect(enhancedResult.processed).toBe(true);
    expect(enhancedResult.extraEnhancement).toBe(true);
    expect(enhancedResult.metadata).toBeDefined();
    
    // Verify composition logs
    expect(compositionLog.length).toBe(4); // initialize, base process, extended process, enhancedProcess
    
    // Test shutdown from the base
    const shutdownResult = await baseImpl.shutdown({}, mockContext);
    expect(shutdownResult.success).toBe(true);
    expect(shutdownResult.source).toBe('base');
    
    // Final verification of the composition log
    expect(compositionLog.length).toBe(5); // +shutdown
    expect(compositionLog[4].action).toBe('shutdown');
  });
  
  it('should enable communication between composed implementations', async () => {
    // Define a validation actor
    dsl.component('ValidationActor', {
      type: ComponentType.ACTOR,
      description: 'Actor for data validation',
      version: '1.0.0',
      messageHandlers: {
        validateData: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define a processing actor
    dsl.component('ProcessingActor', {
      type: ComponentType.ACTOR,
      description: 'Actor for data processing',
      version: '1.0.0',
      messageHandlers: {
        processData: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define a coordinator actor that composes both
    dsl.component('CoordinatorActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that coordinates validation and processing',
      version: '1.0.0',
      behaviors: [
        { ref: 'ValidationActor' },
        { ref: 'ProcessingActor' }
      ],
      messageHandlers: {
        handleRequest: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Validation implementation
    const validationImpl = {
      validateData: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'ValidationActor',
          action: 'validateData',
          timestamp: Date.now(),
          data: input
        });
        
        // Simple validation logic
        const { data } = input;
        const errors = [];
        
        if (!data) {
          errors.push('Data is required');
        } else {
          if (data.name && typeof data.name !== 'string') {
            errors.push('Name must be a string');
          }
          
          if (data.quantity && typeof data.quantity !== 'number') {
            errors.push('Quantity must be a number');
          }
        }
        
        return {
          valid: errors.length === 0,
          errors,
          data
        };
      }
    };
    
    // Processing implementation
    const processingImpl = {
      processData: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'ProcessingActor',
          action: 'processData',
          timestamp: Date.now(),
          data: input
        });
        
        // Simple processing logic
        const { data } = input;
        
        // Keep track of processed items
        if (!context.state.processed) {
          context.state.processed = [];
        }
        
        const processedItem = {
          id: `ITEM-${Date.now()}`,
          originalData: data,
          processedAt: Date.now()
        };
        
        context.state.processed.push(processedItem);
        
        return {
          success: true,
          item: processedItem
        };
      }
    };
    
    // Coordinator implementation that uses both
    const coordinatorImpl = {
      handleRequest: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'CoordinatorActor',
          action: 'handleRequest',
          timestamp: Date.now(),
          data: input
        });
        
        // Step 1: Validate the data
        const validationResult = await context.behaviors.ValidationActor.validateData({
          data: input.data
        }, context);
        
        // If validation fails, return immediately
        if (!validationResult.valid) {
          return {
            success: false,
            stage: 'validation',
            errors: validationResult.errors
          };
        }
        
        // Step 2: Process the validated data
        const processingResult = await context.behaviors.ProcessingActor.processData({
          data: validationResult.data
        }, context);
        
        // Return the coordinated result
        return {
          success: true,
          stage: 'completed',
          processingResult: processingResult.item,
          validationResult
        };
      }
    };
    
    // Register implementations
    dsl.implementation('ValidationActorImpl', {
      targetComponent: 'ValidationActor',
      description: 'Validation implementation',
      version: '1.0.0',
      handlers: validationImpl
    });
    
    dsl.implementation('ProcessingActorImpl', {
      targetComponent: 'ProcessingActor',
      description: 'Processing implementation',
      version: '1.0.0',
      handlers: processingImpl
    });
    
    dsl.implementation('CoordinatorActorImpl', {
      targetComponent: 'CoordinatorActor',
      description: 'Coordinator implementation',
      version: '1.0.0',
      handlers: coordinatorImpl
    });
    
    // Mock context with behaviors
    const mockContext: ActorContext = {
      state: { processed: [] },
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      behaviors: {
        ValidationActor: validationImpl,
        ProcessingActor: processingImpl
      }
    };
    
    // Test successful path
    const successResult = await coordinatorImpl.handleRequest({
      data: {
        name: 'Test Item',
        quantity: 42
      }
    }, mockContext);
    
    // Verify successful processing
    expect(successResult.success).toBe(true);
    expect(successResult.stage).toBe('completed');
    expect(successResult.processingResult).toBeDefined();
    expect(successResult.validationResult.valid).toBe(true);
    
    // Verify composition log
    expect(compositionLog.length).toBe(3);
    expect(compositionLog[0].source).toBe('CoordinatorActor');
    expect(compositionLog[1].source).toBe('ValidationActor');
    expect(compositionLog[2].source).toBe('ProcessingActor');
    
    // Test failure path
    const failureResult = await coordinatorImpl.handleRequest({
      data: {
        name: 123, // Invalid type
        quantity: 'not a number' // Invalid type
      }
    }, mockContext);
    
    // Verify failed validation
    expect(failureResult.success).toBe(false);
    expect(failureResult.stage).toBe('validation');
    expect(failureResult.errors.length).toBe(2);
    
    // Verify composition log shows validation but not processing
    expect(compositionLog.length).toBe(5);
    expect(compositionLog[3].source).toBe('CoordinatorActor');
    expect(compositionLog[4].source).toBe('ValidationActor');
    
    // Check that processing was not called for invalid data
    const processingCalls = compositionLog.filter(
      entry => entry.source === 'ProcessingActor'
    );
    expect(processingCalls.length).toBe(1); // Only from the success case
  });
  
  it('should manage state properly across implementation boundaries', async () => {
    // Define a stateful actor
    dsl.component('StateActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with state management',
      version: '1.0.0',
      messageHandlers: {
        initializeState: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        getState: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        updateState: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Define an actor that extends state management
    dsl.component('EnhancedStateActor', {
      type: ComponentType.ACTOR,
      description: 'Actor with enhanced state management',
      version: '1.0.0',
      extends: { ref: 'StateActor' },
      messageHandlers: {
        // Add new methods
        saveSnapshot: {
          input: { type: 'object' },
          output: { type: 'object' }
        },
        restoreSnapshot: {
          input: { type: 'object' },
          output: { type: 'object' }
        }
      }
    });
    
    // Base implementation
    let persistedState: any = null;
    
    const stateActorImpl = {
      initializeState: async (input: any, context: ActorContext) => {
        const initialState = input.state || {
          items: [],
          metadata: {
            created: Date.now(),
            lastUpdated: Date.now()
          }
        };
        
        context.state = initialState;
        
        compositionLog.push({
          source: 'StateActor',
          action: 'initializeState',
          timestamp: Date.now(),
          data: { state: initialState }
        });
        
        return { success: true, state: initialState };
      },
      
      getState: async (input: any, context: ActorContext) => {
        compositionLog.push({
          source: 'StateActor',
          action: 'getState',
          timestamp: Date.now()
        });
        
        return { 
          state: context.state,
          timestamp: Date.now()
        };
      },
      
      updateState: async (input: any, context: ActorContext) => {
        const { updates } = input;
        
        compositionLog.push({
          source: 'StateActor',
          action: 'updateState',
          timestamp: Date.now(),
          data: { updates }
        });
        
        if (!context.state) {
          // Initialize if needed
          await this.initializeState({}, context);
        }
        
        // Apply updates
        const updatedState = {
          ...context.state,
          ...updates,
          metadata: {
            ...context.state.metadata,
            lastUpdated: Date.now()
          }
        };
        
        // Special case for arrays like items
        if (updates.items) {
          updatedState.items = [...context.state.items, ...updates.items];
        }
        
        context.state = updatedState;
        
        return {
          success: true,
          state: updatedState
        };
      }
    };
    
    // Enhanced implementation
    const enhancedStateImpl = {
      saveSnapshot: async (input: any, context: ActorContext) => {
        if (!context.parent?.StateActor?.getState) {
          throw new Error('Base implementation not available');
        }
        
        compositionLog.push({
          source: 'EnhancedStateActor',
          action: 'saveSnapshot',
          timestamp: Date.now()
        });
        
        // Get current state from base
        const { state } = await context.parent.StateActor.getState({}, context);
        
        // Save snapshot
        persistedState = {
          ...state,
          snapshotTime: Date.now()
        };
        
        return {
          success: true,
          snapshotId: `snapshot-${Date.now()}`,
          timestamp: persistedState.snapshotTime
        };
      },
      
      restoreSnapshot: async (input: any, context: ActorContext) => {
        if (!context.parent?.StateActor?.updateState || !persistedState) {
          throw new Error('Base implementation or snapshot not available');
        }
        
        compositionLog.push({
          source: 'EnhancedStateActor',
          action: 'restoreSnapshot',
          timestamp: Date.now()
        });
        
        // Restore state from snapshot
        const result = await context.parent.StateActor.updateState({
          updates: persistedState
        }, context);
        
        return {
          success: true,
          restored: result.success,
          snapshotTime: persistedState.snapshotTime,
          currentTime: Date.now()
        };
      }
    };
    
    // Register implementations
    dsl.implementation('StateActorImpl', {
      targetComponent: 'StateActor',
      description: 'State management implementation',
      version: '1.0.0',
      handlers: stateActorImpl
    });
    
    dsl.implementation('EnhancedStateActorImpl', {
      targetComponent: 'EnhancedStateActor',
      description: 'Enhanced state management implementation',
      version: '1.0.0',
      handlers: enhancedStateImpl
    });
    
    // Mock context for testing
    const mockContext: ActorContext = {
      state: null,
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any),
      parent: {
        StateActor: stateActorImpl
      }
    };
    
    // Initialize state
    await stateActorImpl.initializeState({}, mockContext);
    expect(mockContext.state).toBeDefined();
    expect(mockContext.state.items).toEqual([]);
    
    // Update state
    await stateActorImpl.updateState({
      updates: { 
        status: 'active',
        items: [{ id: 1, name: 'Item 1' }]
      }
    }, mockContext);
    
    expect(mockContext.state.status).toBe('active');
    expect(mockContext.state.items).toHaveLength(1);
    expect(mockContext.state.items[0].name).toBe('Item 1');
    
    // Save a snapshot
    const snapshotResult = await enhancedStateImpl.saveSnapshot({}, mockContext);
    expect(snapshotResult.success).toBe(true);
    expect(snapshotResult.snapshotId).toBeDefined();
    
    // Update state again
    await stateActorImpl.updateState({
      updates: { 
        status: 'processing',
        items: [{ id: 2, name: 'Item 2' }]
      }
    }, mockContext);
    
    expect(mockContext.state.status).toBe('processing');
    expect(mockContext.state.items).toHaveLength(2);
    
    // Restore from snapshot
    const restoreResult = await enhancedStateImpl.restoreSnapshot({}, mockContext);
    expect(restoreResult.success).toBe(true);
    
    // Verify state was restored
    expect(mockContext.state.status).toBe('active');
    expect(mockContext.state.items).toHaveLength(1);
    expect(mockContext.state.items[0].name).toBe('Item 1');
    
    // Verify composition log
    const stateActorEntries = compositionLog.filter(entry => entry.source === 'StateActor');
    const enhancedEntries = compositionLog.filter(entry => entry.source === 'EnhancedStateActor');
    
    expect(stateActorEntries.length).toBe(5); // init, 2 updates, getState, updateState from restore
    expect(enhancedEntries.length).toBe(2); // saveSnapshot, restoreSnapshot
  });
}); 