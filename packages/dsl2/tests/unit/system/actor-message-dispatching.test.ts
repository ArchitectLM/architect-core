import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType, ActorContext } from '../../../src/models/component.js';

/**
 * Tests for Actor Message Dispatching and Communication Patterns
 * 
 * These tests cover:
 * - Message routing between actors
 * - Different message passing patterns (tell, ask, publish-subscribe)
 * - Message transformation and validation
 * - Error handling during message processing
 */
describe('Actor Message Dispatching', () => {
  let dsl: DSL;
  let messageLog: Array<{ from: string; to: string; type: string; payload: any }> = [];
  
  beforeEach(() => {
    dsl = new DSL();
    messageLog = [];
  });

  it('should dispatch messages between actors with different patterns', async () => {
    // Define sender actor
    dsl.component('SenderActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that sends messages',
      version: '1.0.0',
      messageHandlers: {
        sendTell: {
          input: {
            properties: {
              target: { type: 'string' },
              message: { type: 'string' }
            },
            required: ['target', 'message']
          },
          output: { type: 'object' }
        },
        sendAsk: {
          input: {
            properties: {
              target: { type: 'string' },
              question: { type: 'string' }
            },
            required: ['target', 'question']
          },
          output: { type: 'object' }
        },
        sendToMany: {
          input: {
            properties: {
              targets: { 
                type: 'array',
                items: { type: 'string' }
              },
              broadcast: { type: 'string' }
            },
            required: ['targets', 'broadcast']
          },
          output: { type: 'array' }
        }
      }
    });
    
    // Define receiver actor
    dsl.component('ReceiverActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that receives messages',
      version: '1.0.0',
      messageHandlers: {
        receiveMessage: {
          input: {
            properties: {
              message: { type: 'string' },
              sender: { type: 'string' }
            },
            required: ['message']
          },
          output: { type: 'null' }
        },
        answerQuestion: {
          input: {
            properties: {
              question: { type: 'string' },
              sender: { type: 'string' }
            },
            required: ['question']
          },
          output: { type: 'string' }
        },
        receiveBroadcast: {
          input: {
            properties: {
              broadcast: { type: 'string' },
              sender: { type: 'string' }
            },
            required: ['broadcast']
          },
          output: { type: 'object' }
        }
      }
    });
    
    // Define system
    const system = dsl.system('MessagingSystem', {
      description: 'System for testing messaging patterns',
      version: '1.0.0',
      components: {
        actors: [
          { ref: 'SenderActor' },
          { ref: 'ReceiverActor' }
        ]
      }
    });

    // Create mock actor references for the receiver
    const receiverRefs: Record<string, any> = {};
    
    // Basic receiver - responds to tell pattern (fire and forget)
    receiverRefs.basic = {
      tell: vi.fn().mockImplementation((messageType, payload) => {
        messageLog.push({
          from: 'SenderActor',
          to: 'ReceiverActor',
          type: messageType,
          payload
        });
        return Promise.resolve();
      })
    };
    
    // Interactive receiver - responds to ask pattern (request-response)
    receiverRefs.interactive = {
      ask: vi.fn().mockImplementation((messageType, payload) => {
        messageLog.push({
          from: 'SenderActor',
          to: 'ReceiverActor',
          type: messageType,
          payload
        });
        
        if (messageType === 'answerQuestion') {
          return Promise.resolve(`Answer to: ${payload.question}`);
        }
        return Promise.resolve(null);
      })
    };
    
    // Create sender actor context with actor references
    const senderContext: ActorContext = {
      self: { id: 'sender-1' },
      actorOf: vi.fn().mockImplementation((actorType) => {
        if (actorType === 'ReceiverActor') {
          return {
            tell: receiverRefs.basic.tell,
            ask: receiverRefs.interactive.ask
          };
        }
        throw new Error(`Unknown actor type: ${actorType}`);
      }),
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any)
    };
    
    // Mock sender implementations
    const senderImpl = {
      sendTell: async (input: any, context: ActorContext) => {
        const { target, message } = input;
        const targetActor = context.actorOf(target);
        
        // Fire and forget pattern
        await targetActor.tell('receiveMessage', {
          message,
          sender: context.self.id
        });
        
        return { sent: true, timestamp: Date.now() };
      },
      
      sendAsk: async (input: any, context: ActorContext) => {
        const { target, question } = input;
        const targetActor = context.actorOf(target);
        
        // Request-response pattern
        const answer = await targetActor.ask('answerQuestion', {
          question,
          sender: context.self.id
        });
        
        return { 
          sent: true, 
          answer,
          timestamp: Date.now()
        };
      },
      
      sendToMany: async (input: any, context: ActorContext) => {
        const { targets, broadcast } = input;
        const results = [];
        
        // Broadcasting pattern
        for (const target of targets) {
          const targetActor = context.actorOf(target);
          await targetActor.tell('receiveBroadcast', {
            broadcast,
            sender: context.self.id
          });
          
          results.push({
            target,
            delivered: true
          });
        }
        
        return results;
      }
    };
    
    // Register implementation
    dsl.implementation('SenderActorImpl', {
      targetComponent: 'SenderActor',
      description: 'Sender actor implementation',
      version: '1.0.0',
      handlers: senderImpl
    });
    
    // Test tell pattern (fire and forget)
    const tellResult = await senderImpl.sendTell({
      target: 'ReceiverActor',
      message: 'Hello, this is a one-way message'
    }, senderContext);
    
    expect(tellResult.sent).toBe(true);
    expect(receiverRefs.basic.tell).toHaveBeenCalledWith('receiveMessage', {
      message: 'Hello, this is a one-way message',
      sender: 'sender-1'
    });
    
    // Test ask pattern (request-response)
    const askResult = await senderImpl.sendAsk({
      target: 'ReceiverActor',
      question: 'What is the meaning of life?'
    }, senderContext);
    
    expect(askResult.sent).toBe(true);
    expect(askResult.answer).toBe('Answer to: What is the meaning of life?');
    expect(receiverRefs.interactive.ask).toHaveBeenCalledWith('answerQuestion', {
      question: 'What is the meaning of life?',
      sender: 'sender-1'
    });
    
    // Test broadcasting pattern
    const broadcastResult = await senderImpl.sendToMany({
      targets: ['ReceiverActor', 'ReceiverActor'], // Same target for simplicity
      broadcast: 'Important announcement!'
    }, senderContext);
    
    expect(broadcastResult).toHaveLength(2);
    expect(broadcastResult[0].delivered).toBe(true);
    expect(broadcastResult[1].delivered).toBe(true);
    expect(receiverRefs.basic.tell).toHaveBeenCalledWith('receiveBroadcast', {
      broadcast: 'Important announcement!',
      sender: 'sender-1'
    });
    
    // Verify message log
    expect(messageLog).toHaveLength(4); // 1 tell + 1 ask + 2 broadcasts
  });

  it('should handle message transformation and validation', async () => {
    // Define actors with message transformation
    dsl.component('ProducerActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that produces data',
      version: '1.0.0',
      messageHandlers: {
        produceData: {
          input: { type: 'object' },
          output: {
            properties: {
              id: { type: 'string' },
              data: { type: 'object' },
              timestamp: { type: 'number' }
            },
            required: ['id', 'data', 'timestamp']
          }
        }
      }
    });
    
    dsl.component('TransformerActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that transforms data',
      version: '1.0.0',
      messageHandlers: {
        transform: {
          input: {
            properties: {
              id: { type: 'string' },
              data: { type: 'object' },
              timestamp: { type: 'number' }
            },
            required: ['id', 'data']
          },
          output: {
            properties: {
              id: { type: 'string' },
              transformedData: { type: 'object' },
              processingTime: { type: 'number' }
            },
            required: ['id', 'transformedData']
          }
        }
      }
    });
    
    dsl.component('ConsumerActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that consumes transformed data',
      version: '1.0.0',
      messageHandlers: {
        consume: {
          input: {
            properties: {
              id: { type: 'string' },
              transformedData: { type: 'object' }
            },
            required: ['id', 'transformedData']
          },
          output: { type: 'boolean' }
        }
      }
    });
    
    // Define system
    const system = dsl.system('TransformationSystem', {
      description: 'System for testing message transformation',
      version: '1.0.0',
      components: {
        actors: [
          { ref: 'ProducerActor' },
          { ref: 'TransformerActor' },
          { ref: 'ConsumerActor' }
        ]
      }
    });
    
    // Mock implementations
    const producerImpl = {
      produceData: async (input: any, context: ActorContext) => {
        const id = `data-${Date.now()}`;
        return {
          id,
          data: { value: input.value || 100, source: 'producer' },
          timestamp: Date.now()
        };
      }
    };
    
    const transformerImpl = {
      transform: async (input: any, context: ActorContext) => {
        // Transform the data
        const startTime = Date.now();
        
        // Actual transformation logic
        const transformedData = {
          originalValue: input.data.value,
          processedValue: input.data.value * 2,
          source: input.data.source,
          transformedBy: 'transformer'
        };
        
        const endTime = Date.now();
        
        return {
          id: input.id,
          transformedData,
          processingTime: endTime - startTime
        };
      }
    };
    
    const consumerImpl = {
      consume: async (input: any, context: ActorContext) => {
        // Store the transformed data
        if (!context.state) {
          context.state = { consumed: [] };
        }
        
        context.state.consumed.push({
          id: input.id,
          data: input.transformedData,
          receivedAt: Date.now()
        });
        
        messageLog.push({
          from: 'TransformerActor',
          to: 'ConsumerActor',
          type: 'consume',
          payload: input
        });
        
        return true;
      }
    };
    
    // Register implementations
    dsl.implementation('ProducerActorImpl', {
      targetComponent: 'ProducerActor',
      description: 'Producer implementation',
      version: '1.0.0',
      handlers: producerImpl
    });
    
    dsl.implementation('TransformerActorImpl', {
      targetComponent: 'TransformerActor',
      description: 'Transformer implementation',
      version: '1.0.0',
      handlers: transformerImpl
    });
    
    dsl.implementation('ConsumerActorImpl', {
      targetComponent: 'ConsumerActor',
      description: 'Consumer implementation',
      version: '1.0.0',
      handlers: consumerImpl
    });
    
    // Mock actor references
    const transformerRef = {
      ask: vi.fn().mockImplementation(async (messageType, payload) => {
        if (messageType === 'transform') {
          return transformerImpl.transform(payload, { state: {} });
        }
        return null;
      })
    };
    
    const consumerRef = {
      tell: vi.fn().mockImplementation(async (messageType, payload) => {
        if (messageType === 'consume') {
          return consumerImpl.consume(payload, { state: {} });
        }
        return null;
      })
    };
    
    // Create processing flow context
    const flowContext: ActorContext = {
      state: {},
      actorOf: vi.fn().mockImplementation((actorType) => {
        if (actorType === 'TransformerActor') {
          return transformerRef;
        } else if (actorType === 'ConsumerActor') {
          return consumerRef;
        }
        throw new Error(`Unknown actor type: ${actorType}`);
      }),
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any)
    };
    
    // Execute the data processing flow
    const processDataFlow = async (input: any) => {
      // Step 1: Produce data
      const producedData = await producerImpl.produceData(input, flowContext);
      
      messageLog.push({
        from: 'Client',
        to: 'ProducerActor',
        type: 'produceData',
        payload: input
      });
      
      // Step 2: Transform the data
      const transformerActor = flowContext.actorOf('TransformerActor');
      const transformedData = await transformerActor.ask('transform', producedData);
      
      messageLog.push({
        from: 'ProducerActor',
        to: 'TransformerActor',
        type: 'transform',
        payload: producedData
      });
      
      // Step 3: Consume the transformed data
      const consumerActor = flowContext.actorOf('ConsumerActor');
      await consumerActor.tell('consume', transformedData);
      
      return {
        originalData: producedData,
        transformedData
      };
    };
    
    // Execute the flow
    const result = await processDataFlow({ value: 42 });
    
    // Verify the transformation chain
    expect(result.originalData.data.value).toBe(42);
    expect(result.transformedData.transformedData.processedValue).toBe(84);
    expect(result.transformedData.transformedData.transformedBy).toBe('transformer');
    
    // Verify message flow
    expect(messageLog).toHaveLength(3);
    expect(messageLog[0].from).toBe('Client');
    expect(messageLog[0].to).toBe('ProducerActor');
    expect(messageLog[1].from).toBe('ProducerActor');
    expect(messageLog[1].to).toBe('TransformerActor');
    expect(messageLog[2].from).toBe('TransformerActor');
    expect(messageLog[2].to).toBe('ConsumerActor');
  });

  it('should handle errors during message processing', async () => {
    // Define actors with error scenarios
    dsl.component('CommandActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that issues commands',
      version: '1.0.0',
      messageHandlers: {
        executeCommand: {
          input: {
            properties: {
              commandType: { type: 'string' },
              params: { type: 'object' }
            },
            required: ['commandType']
          },
          output: { type: 'object' }
        }
      }
    });
    
    dsl.component('ProcessorActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that processes commands and may fail',
      version: '1.0.0',
      messageHandlers: {
        process: {
          input: {
            properties: {
              commandType: { type: 'string' },
              params: { type: 'object' }
            },
            required: ['commandType']
          },
          output: { type: 'object' }
        }
      }
    });
    
    // Define system
    const system = dsl.system('CommandSystem', {
      description: 'System for testing error handling',
      version: '1.0.0',
      components: {
        actors: [
          { ref: 'CommandActor' },
          { ref: 'ProcessorActor' }
        ]
      }
    });
    
    // Define error types
    class ValidationError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
      }
    }
    
    class ProcessingError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'ProcessingError';
      }
    }
    
    // Mock implementations
    const commandActorImpl = {
      executeCommand: async (input: any, context: ActorContext) => {
        const { commandType, params } = input;
        
        try {
          // Validate command type
          if (!['CREATE', 'UPDATE', 'DELETE'].includes(commandType)) {
            throw new ValidationError(`Invalid command type: ${commandType}`);
          }
          
          // Forward to processor
          const processorActor = context.actorOf('ProcessorActor');
          const result = await processorActor.ask('process', { commandType, params });
          
          messageLog.push({
            from: 'CommandActor',
            to: 'ProcessorActor',
            type: 'process',
            payload: { commandType, params }
          });
          
          return {
            success: true,
            result
          };
        } catch (error) {
          // Handle and transform errors
          messageLog.push({
            from: 'CommandActor',
            to: 'Internal',
            type: 'error',
            payload: { error, commandType, params }
          });
          
          if (error instanceof ValidationError) {
            return {
              success: false,
              error: {
                type: 'VALIDATION_ERROR',
                message: error.message
              }
            };
          } else if (error instanceof ProcessingError) {
            return {
              success: false,
              error: {
                type: 'PROCESSING_ERROR',
                message: error.message
              }
            };
          } else {
            return {
              success: false,
              error: {
                type: 'UNEXPECTED_ERROR',
                message: (error as Error).message || 'Unknown error'
              }
            };
          }
        }
      }
    };
    
    const processorActorImpl = {
      process: async (input: any, context: ActorContext) => {
        const { commandType, params } = input;
        
        // Simulate processing with potential errors
        if (commandType === 'CREATE') {
          if (!params || !params.name) {
            throw new ValidationError('Name is required for CREATE command');
          }
          
          return {
            id: `item-${Date.now()}`,
            name: params.name,
            created: true
          };
        } else if (commandType === 'UPDATE') {
          if (!params || !params.id) {
            throw new ValidationError('ID is required for UPDATE command');
          }
          
          // Simulate item not found
          if (params.id === 'non-existent') {
            throw new ProcessingError(`Item with ID ${params.id} not found`);
          }
          
          return {
            id: params.id,
            updated: true,
            changes: params.changes || {}
          };
        } else if (commandType === 'DELETE') {
          if (!params || !params.id) {
            throw new ValidationError('ID is required for DELETE command');
          }
          
          // Simulate deletion error
          if (params.id === 'protected') {
            throw new ProcessingError(`Item with ID ${params.id} is protected and cannot be deleted`);
          }
          
          return {
            id: params.id,
            deleted: true
          };
        }
        
        throw new Error(`Unexpected command type: ${commandType}`);
      }
    };
    
    // Register implementations
    dsl.implementation('CommandActorImpl', {
      targetComponent: 'CommandActor',
      description: 'Command actor implementation',
      version: '1.0.0',
      handlers: commandActorImpl
    });
    
    dsl.implementation('ProcessorActorImpl', {
      targetComponent: 'ProcessorActor',
      description: 'Processor actor implementation',
      version: '1.0.0',
      handlers: processorActorImpl
    });
    
    // Mock processor reference
    const processorRef = {
      ask: vi.fn().mockImplementation(async (messageType, payload) => {
        return processorActorImpl.process(payload, { state: {} });
      })
    };
    
    // Create command context
    const commandContext: ActorContext = {
      state: {},
      actorOf: vi.fn().mockReturnValue(processorRef),
      flow: () => ({ sendToActor: () => ({}), then: () => ({}), execute: async () => ({}) } as any)
    };
    
    // Test successful command
    const successResult = await commandActorImpl.executeCommand({
      commandType: 'CREATE',
      params: { name: 'Test Item' }
    }, commandContext);
    
    expect(successResult.success).toBe(true);
    expect(successResult.result.created).toBe(true);
    expect(successResult.result.name).toBe('Test Item');
    
    // Test validation error in command actor
    const invalidCommandResult = await commandActorImpl.executeCommand({
      commandType: 'INVALID',
      params: {}
    }, commandContext);
    
    expect(invalidCommandResult.success).toBe(false);
    expect(invalidCommandResult.error.type).toBe('VALIDATION_ERROR');
    
    // Test validation error in processor actor
    const missingParamsResult = await commandActorImpl.executeCommand({
      commandType: 'UPDATE',
      params: {}
    }, commandContext);
    
    expect(missingParamsResult.success).toBe(false);
    expect(missingParamsResult.error.type).toBe('VALIDATION_ERROR');
    
    // Test processing error
    const processingErrorResult = await commandActorImpl.executeCommand({
      commandType: 'DELETE',
      params: { id: 'protected' }
    }, commandContext);
    
    expect(processingErrorResult.success).toBe(false);
    expect(processingErrorResult.error.type).toBe('PROCESSING_ERROR');
    expect(processingErrorResult.error.message).toContain('protected');
    
    // Verify error logging
    const errorLogs = messageLog.filter(msg => msg.type === 'error');
    expect(errorLogs.length).toBeGreaterThan(0);
  });
}); 