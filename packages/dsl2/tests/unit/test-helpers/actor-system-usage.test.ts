import { describe, it, expect, beforeEach } from 'vitest';
import { createMockActorSystem, createMockContext } from './actor-system-test-utils.js';

/**
 * Demonstrates how to use the mock actor system utility
 */
describe('Mock Actor System', () => {
  let actorSystem: ReturnType<typeof createMockActorSystem>;
  
  beforeEach(() => {
    actorSystem = createMockActorSystem();
  });

  it('should allow registration of actors', () => {
    // Define some test actors
    const greeterActor = {
      greet: async (input: any, context: any) => {
        return { greeting: `Hello, ${input.name}!` };
      }
    };
    
    const calculatorActor = {
      add: async (input: any, context: any) => {
        return { result: input.a + input.b };
      },
      subtract: async (input: any, context: any) => {
        return { result: input.a - input.b };
      }
    };
    
    // Register actors
    actorSystem.registerActor('greeter', greeterActor);
    actorSystem.registerActor('calculator', calculatorActor);
    
    // Verify registration
    const registeredActors = actorSystem.getRegisteredActors();
    expect(registeredActors.length).toBe(2);
    expect(registeredActors).toContain('greeter');
    expect(registeredActors).toContain('calculator');
  });

  it('should send messages between actors and record them', async () => {
    // Define a sender actor
    const senderActor = {
      sendGreeting: async (input: any, context: any) => {
        // This would use the context flow in real implementation
        // but here we'll use the actor system directly
        const response = await actorSystem.sendMessage(
          'sender',
          'receiver',
          'receiveGreeting',
          { greeting: `Hello from ${input.sender}` }
        );
        
        return { sent: true, receiverResponse: response };
      }
    };
    
    // Define a receiver actor
    const receiverActor = {
      receiveGreeting: async (input: any, context: any) => {
        return { 
          received: true, 
          greeting: input.greeting,
          message: 'Thank you for your message'
        };
      }
    };
    
    // Register both actors
    actorSystem.registerActor('sender', senderActor);
    actorSystem.registerActor('receiver', receiverActor);
    
    // Send a message
    const result = await senderActor.sendGreeting({ sender: 'TestUser' }, createMockContext());
    
    // Verify result
    expect(result.sent).toBe(true);
    expect(result.receiverResponse.received).toBe(true);
    expect(result.receiverResponse.greeting).toBe('Hello from TestUser');
    
    // Check message log
    const messageLog = actorSystem.getMessageLog();
    expect(messageLog.length).toBe(1);
    expect(messageLog[0].from).toBe('sender');
    expect(messageLog[0].to).toBe('receiver');
    expect(messageLog[0].pattern).toBe('receiveGreeting');
    expect(messageLog[0].message.greeting).toBe('Hello from TestUser');
  });

  it('should handle complex message flows', async () => {
    // Define a coordinator actor
    const coordinatorActor = {
      handleRequest: async (input: any, context: any) => {
        // Step 1: Validate the input
        const validationResult = await actorSystem.sendMessage(
          'coordinator',
          'validator',
          'validate',
          { data: input.data }
        );
        
        if (!validationResult.valid) {
          return { success: false, errors: validationResult.errors };
        }
        
        // Step 2: Process the validated data
        const processingResult = await actorSystem.sendMessage(
          'coordinator',
          'processor',
          'process',
          { data: validationResult.data }
        );
        
        // Step 3: Store the results
        const storageResult = await actorSystem.sendMessage(
          'coordinator',
          'storage',
          'store',
          { result: processingResult.result }
        );
        
        return {
          success: true,
          processedResult: processingResult.result,
          storageId: storageResult.id
        };
      }
    };
    
    // Define helper actors
    const validatorActor = {
      validate: async (input: any, context: any) => {
        // Simple validation
        if (!input.data) {
          return { valid: false, errors: ['Data is required'] };
        }
        
        if (input.data.value < 0) {
          return { valid: false, errors: ['Value must be positive'] };
        }
        
        return { valid: true, data: input.data };
      }
    };
    
    const processorActor = {
      process: async (input: any, context: any) => {
        // Process the data
        const processed = {
          ...input.data,
          processed: true,
          timestamp: Date.now()
        };
        
        return { success: true, result: processed };
      }
    };
    
    const storageActor = {
      store: async (input: any, context: any) => {
        // Mock storage
        const id = `item-${Date.now()}`;
        return { success: true, id };
      }
    };
    
    // Register all actors
    actorSystem.registerActor('coordinator', coordinatorActor);
    actorSystem.registerActor('validator', validatorActor);
    actorSystem.registerActor('processor', processorActor);
    actorSystem.registerActor('storage', storageActor);
    
    // Test successful flow
    const successResult = await coordinatorActor.handleRequest({
      data: { value: 42, name: 'Test Item' }
    }, createMockContext());
    
    // Verify successful result
    expect(successResult.success).toBe(true);
    expect(successResult.processedResult.value).toBe(42);
    expect(successResult.processedResult.processed).toBe(true);
    expect(successResult.storageId).toBeDefined();
    
    // Test validation failure
    const failureResult = await coordinatorActor.handleRequest({
      data: { value: -1, name: 'Invalid Item' }
    }, createMockContext());
    
    // Verify failure result
    expect(failureResult.success).toBe(false);
    expect(failureResult.errors).toContain('Value must be positive');
    
    // Check message log
    const messageLog = actorSystem.getMessageLog();
    expect(messageLog.length).toBe(5); // 3 messages for success, 1 for failure
    
    // Reset the system
    actorSystem.reset();
    expect(actorSystem.getRegisteredActors().length).toBe(0);
    expect(actorSystem.getMessageLog().length).toBe(0);
  });

  it('should handle error cases', async () => {
    // Register one actor
    actorSystem.registerActor('testActor', {
      testMessage: async (input: any, context: any) => {
        return { success: true };
      }
    });
    
    // Test sending to non-existent actor
    try {
      await actorSystem.sendMessage(
        'testActor',
        'nonExistentActor',
        'someMessage',
        {}
      );
      expect(true).toBe(false); // This should never execute
    } catch (err) {
      expect((err as Error).message).toContain('Actor not found');
    }
    
    // Test sending non-existent message
    try {
      await actorSystem.sendMessage(
        'testActor',
        'testActor',
        'nonExistentMessage',
        {}
      );
      expect(true).toBe(false); // This should never execute
    } catch (err) {
      expect((err as Error).message).toContain('Message handler not found');
    }
  });
}); 