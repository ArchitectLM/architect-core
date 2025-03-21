/**
 * Flow builder implementation for actor message chains
 */
import { ActorContext, FlowBuilder } from '../core/dsl.js';
import { DSL } from '../core/dsl.js';

/**
 * Create a flow builder instance
 */
export function createFlowBuilder(dsl: DSL, context: ActorContext): FlowBuilder {
  const operations: Array<(prevResult: any) => Promise<any>> = [];
  const errorHandlers: Array<(error: Error) => Promise<any>> = [];
  const finallyHandlers: Array<() => Promise<void>> = [];
  
  // Generate a unique flow ID for tracking
  const flowId = `flow-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  
  // Track flow execution metrics
  const metrics = {
    startTime: Date.now(),
    steps: 0,
    errors: 0
  };
  
  const builder: FlowBuilder = {
    sendToActor: (actorId: string, message: any) => {
      metrics.steps++;
      
      operations.push(async (prevResult: any) => {
        // Get actor implementation
        const actorImpl = dsl.getImplementation(actorId);
        if (!actorImpl) {
          metrics.errors++;
          throw new Error(`Actor ${actorId} not found or not implemented`);
        }
        
        // Extract message type and prepare input
        const { messageType, ...input } = message;
        if (!messageType) {
          metrics.errors++;
          throw new Error(`Message must include a messageType property`);
        }
        
        // Ensure handler exists
        if (typeof actorImpl[messageType] !== 'function') {
          metrics.errors++;
          throw new Error(`Message handler ${messageType} not found in actor ${actorId}`);
        }
        
        // Add tracing info to context
        const stepContext: ActorContext = {
          ...context,
          flowId,
          step: metrics.steps,
          actorId,
          messageType
        };
        
        try {
          // Call the handler
          return await actorImpl[messageType](input, stepContext);
        } catch (error) {
          metrics.errors++;
          throw error;
        }
      });
      
      return builder;
    },
    
    then: (callback: (result: any) => any) => {
      metrics.steps++;
      
      operations.push(async (prevResult: any) => {
        try {
          return callback(prevResult);
        } catch (error) {
          metrics.errors++;
          throw error;
        }
      });
      
      return builder;
    },
    
    catch: (errorHandler: (error: Error) => any) => {
      errorHandlers.push(async (error: Error) => {
        try {
          return await errorHandler(error);
        } catch (nestedError) {
          // If the error handler itself throws, we'll just pass it through
          return nestedError;
        }
      });
      
      return builder;
    },
    
    finally: (callback: () => void) => {
      finallyHandlers.push(async () => {
        try {
          callback();
        } catch (error) {
          console.error('Error in finally handler:', error);
        }
      });
      
      return builder;
    },
    
    execute: async () => {
      let result = null;
      
      try {
        for (const operation of operations) {
          result = await operation(result);
        }
        
        // Log flow completion metrics
        const executionTime = Date.now() - metrics.startTime;
        
        return result;
      } catch (error) {
        // Handle flow execution errors
        if (errorHandlers.length > 0) {
          // Process error handlers
          let handledResult = error;
          
          for (const handler of errorHandlers) {
            try {
              // Cast to Error since we're in a catch block
              handledResult = await handler(error instanceof Error ? error : new Error(String(error)));
              // If a handler returns a non-error value, we'll use that as the result
              if (!(handledResult instanceof Error)) {
                result = handledResult;
                break;
              }
            } catch (handlerError) {
              // If an error handler throws, we'll continue with the next handler
              handledResult = handlerError;
            }
          }
          
          // If all handlers returned errors, throw the last one
          if (handledResult instanceof Error) {
            throw handledResult;
          }
          
          // Otherwise use the handled result
          result = handledResult;
        } else {
          // No error handlers, re-throw
          throw error;
        }
      } finally {
        // Execute finally handlers
        for (const handler of finallyHandlers) {
          await handler();
        }
      }
      
      return result;
    }
  };
  
  return builder;
} 