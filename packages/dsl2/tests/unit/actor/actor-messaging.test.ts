import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

describe('Actor Messaging', () => {
  let dsl: DSL;

  beforeEach(() => {
    dsl = new DSL();
  });

  it('should send messages between actors', async () => {
    // Define actors
    dsl.component('SenderActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that sends messages',
      version: '1.0.0',
      messageHandlers: {
        sendMessage: {
          input: {
            type: 'object',
            properties: {
              recipient: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['recipient', 'content']
          },
          output: { type: 'object' }
        }
      }
    });

    dsl.component('ReceiverActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that receives messages',
      version: '1.0.0',
      messageHandlers: {
        receiveMessage: {
          input: {
            type: 'object',
            properties: {
              sender: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['sender', 'content']
          },
          output: { type: 'object' }
        }
      }
    });

    // Mock actor references
    const receiverRef = { id: 'receiver-1', tell: vi.fn().mockResolvedValue({ delivered: true }) };
    const actorContext = { 
      self: { id: 'sender-1' },
      actorOf: vi.fn().mockReturnValue(receiverRef)
    };

    // Mock sender implementation
    const senderImpl = {
      sendMessage: async (msg: any, ctx: any) => {
        const { recipient, content } = msg;
        const targetActor = ctx.actorOf(recipient);
        const response = await targetActor.tell('receiveMessage', {
          sender: ctx.self.id,
          content
        });
        return { 
          sent: true,
          response
        };
      }
    };

    // Mock receiver implementation
    const receiverImpl = {
      receiveMessage: async (msg: any, ctx: any) => {
        return {
          received: true,
          from: msg.sender,
          content: msg.content,
          timestamp: new Date().toISOString()
        };
      }
    };

    // Register implementations
    dsl.implementActor('SenderActor', senderImpl);
    dsl.implementActor('ReceiverActor', receiverImpl);

    // Execute the message send
    const result = await senderImpl.sendMessage(
      { recipient: 'ReceiverActor', content: 'Hello!' },
      actorContext
    );

    // Verify message flow
    expect(actorContext.actorOf).toHaveBeenCalledWith('ReceiverActor');
    expect(receiverRef.tell).toHaveBeenCalledWith('receiveMessage', {
      sender: 'sender-1',
      content: 'Hello!'
    });
    expect(result.sent).toBe(true);
    expect(result.response).toEqual({ delivered: true });
  });

  it('should support request-response pattern', async () => {
    // Define actors
    dsl.component('ClientActor', {
      type: ComponentType.ACTOR,
      description: 'Client actor',
      version: '1.0.0',
      messageHandlers: {
        makeRequest: {
          input: {
            type: 'object',
            properties: {
              service: { type: 'string' },
              request: { type: 'object' }
            },
            required: ['service', 'request']
          },
          output: { type: 'object' }
        }
      }
    });

    dsl.component('ServiceActor', {
      type: ComponentType.ACTOR,
      description: 'Service actor',
      version: '1.0.0',
      messageHandlers: {
        handleRequest: {
          input: {
            type: 'object',
            properties: {
              request: { type: 'object' }
            },
            required: ['request']
          },
          output: { type: 'object' }
        }
      }
    });

    // Mock service response
    const serviceResponse = { 
      status: 'success', 
      data: { id: 123, name: 'Test Result' } 
    };

    // Mock actor references
    const serviceRef = { 
      id: 'service-1', 
      ask: vi.fn().mockResolvedValue(serviceResponse) 
    };
    
    const actorContext = { 
      self: { id: 'client-1' },
      actorOf: vi.fn().mockReturnValue(serviceRef)
    };

    // Mock client implementation
    const clientImpl = {
      makeRequest: async (msg: any, ctx: any) => {
        const { service, request } = msg;
        const serviceActor = ctx.actorOf(service);
        // Using ask for request-response
        const response = await serviceActor.ask('handleRequest', {
          request
        });
        return { 
          requestId: `req-${Date.now()}`,
          result: response
        };
      }
    };

    // Execute the request
    const result = await clientImpl.makeRequest(
      { 
        service: 'ServiceActor', 
        request: { action: 'getData', params: { id: 123 } } 
      },
      actorContext
    );

    // Verify request flow
    expect(actorContext.actorOf).toHaveBeenCalledWith('ServiceActor');
    expect(serviceRef.ask).toHaveBeenCalledWith('handleRequest', {
      request: { action: 'getData', params: { id: 123 } }
    });
    expect(result.result).toEqual(serviceResponse);
  });

  it('should handle messaging patterns with wildcards', async () => {
    // Define an actor with wildcard message handling
    dsl.component('RouterActor', {
      type: ComponentType.ACTOR,
      description: 'Actor that routes messages',
      version: '1.0.0',
      messageHandlers: {
        'route.*': {
          input: { type: 'object' },
          output: { type: 'object' },
          pattern: true
        }
      }
    });

    // Mock implementation
    const routeHandlers = {
      'route.user': async (msg: any) => ({ target: 'UserService', msg }),
      'route.order': async (msg: any) => ({ target: 'OrderService', msg }),
      'route.payment': async (msg: any) => ({ target: 'PaymentService', msg })
    };

    const routerImpl = {
      handleMessage: async (pattern: string, msg: any, ctx: any) => {
        if (pattern in routeHandlers) {
          return routeHandlers[pattern as keyof typeof routeHandlers](msg);
        }
        throw new Error(`Unhandled pattern: ${pattern}`);
      }
    };

    // Mock tell function that will invoke the handler with pattern
    const mockTell = (pattern: string, msg: any) => {
      return routerImpl.handleMessage(pattern, msg, {});
    };

    // Test the router with different patterns
    const userResult = await mockTell('route.user', { userId: '123' });
    const orderResult = await mockTell('route.order', { orderId: 'ORD-456' });
    const paymentResult = await mockTell('route.payment', { amount: 99.99 });

    expect(userResult.target).toBe('UserService');
    expect(userResult.msg.userId).toBe('123');
    
    expect(orderResult.target).toBe('OrderService');
    expect(orderResult.msg.orderId).toBe('ORD-456');
    
    expect(paymentResult.target).toBe('PaymentService');
    expect(paymentResult.msg.amount).toBe(99.99);
  });
}); 