import { describe, it, expect, vi } from 'vitest';
import { createMockContext } from './actor-system-test-utils.js';
import { ActorContext } from '../../../src/models/component.js';

/**
 * Simple actor implementation for testing
 */
interface SimpleActor {
  initialize: (input: any, context: ActorContext) => Promise<any>;
  processMessage: (input: any, context: ActorContext) => Promise<any>;
}

/**
 * Demonstrates how to use the mock context utility
 */
describe('Mock Context Utility', () => {
  
  it('should create a context with the provided initial state', () => {
    const initialState = { 
      counter: 0,
      items: ['item1', 'item2'],
      config: { enabled: true }
    };
    
    const context = createMockContext(initialState);
    
    expect(context.state).toBeDefined();
    expect(context.state?.counter).toBe(0);
    expect(context.state?.items).toEqual(['item1', 'item2']);
    expect(context.state?.config.enabled).toBe(true);
  });

  it('should provide mocked flow functions', () => {
    const context = createMockContext();
    
    // Verify flow function returns mocked methods
    const flow = context.flow();
    expect(flow.sendToActor).toBeDefined();
    expect(flow.then).toBeDefined();
    expect(flow.execute).toBeDefined();
    
    // Verify they are mocks
    expect(vi.isMockFunction(flow.sendToActor)).toBe(true);
    expect(vi.isMockFunction(flow.then)).toBe(true);
    expect(vi.isMockFunction(flow.execute)).toBe(true);
  });

  it('should facilitate testing actor implementations', async () => {
    // Create a simple actor implementation
    const simpleActor: SimpleActor = {
      initialize: async (input, context) => {
        // Update state with input
        context.state = {
          ...context.state,
          initialized: true,
          config: input.config || {}
        };
        return { success: true };
      },
      
      processMessage: async (input, context) => {
        // Verify actor is initialized
        if (!context.state?.initialized) {
          throw new Error('Actor not initialized');
        }
        
        // Process the message
        const result = { 
          processed: true,
          message: input.message,
          timestamp: Date.now()
        };
        
        // Update state with non-null assertion since we checked initialized
        if (context.state) {
          context.state.lastProcessed = result;
        }
        
        return result;
      }
    };
    
    // Test with mock context
    const context = createMockContext();
    
    // Test initialization
    await simpleActor.initialize({ config: { timeout: 1000 } }, context);
    expect(context.state?.initialized).toBe(true);
    expect(context.state?.config.timeout).toBe(1000);
    
    // Test message processing
    const result = await simpleActor.processMessage({ message: 'test' }, context);
    expect(result.processed).toBe(true);
    expect(result.message).toBe('test');
    
    // Verify state was updated
    expect(context.state?.lastProcessed).toBeDefined();
    expect(context.state?.lastProcessed.message).toBe('test');
  });

  it('should allow for verifying actor interactions with dependencies', async () => {
    // Create an actor that calls other actors
    const coordinatorActor = {
      process: async (input: any, context: ActorContext) => {
        // Use flow to call dependent actors
        await context.flow()
          .sendToActor('validationActor', 'validate', { data: input.data })
          .then((validationResult: any) => {
            if (!validationResult.valid) {
              return { success: false, errors: validationResult.errors };
            }
            return context.flow()
              .sendToActor('processingActor', 'process', { 
                data: validationResult.data 
              });
          })
          .execute();
        
        return { success: true, message: 'Processing complete' };
      }
    };
    
    // Create mock context
    const context = createMockContext();
    
    // Get the flow mock from the context
    // Need to cast since the returned mock has additional mock properties
    const flowMock = context.flow() as ReturnType<typeof context.flow> & {
      mockImplementation: Function;
      mockReturnValue: Function;
    };
    
    // Setup the mocks
    (flowMock.sendToActor as any).mockImplementation(() => flowMock);
    (flowMock.then as any).mockImplementation((callback: Function) => {
      // Simulate validation success
      const validationResult = { valid: true, data: { id: 123, processed: true } };
      callback(validationResult);
      return flowMock;
    });
    
    // Test the coordinator actor
    const result = await coordinatorActor.process({ data: { id: 123 } }, context);
    
    // Verify result
    expect(result.success).toBe(true);
    
    // Verify interactions with dependencies
    expect(flowMock.sendToActor).toHaveBeenCalledTimes(2);
    expect(flowMock.sendToActor).toHaveBeenCalledWith('validationActor', 'validate', { data: { id: 123 } });
    expect(flowMock.sendToActor).toHaveBeenCalledWith('processingActor', 'process', { data: { id: 123, processed: true } });
  });
}); 