import { describe, it, expect, beforeEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';
import { createTestDSL, createMockContext, createTestEventLog } from './actor-system-test-utils.js';

/**
 * Tests for Message Passing Between Actors
 * 
 * This test file demonstrates different patterns of message passing between
 * actors, including various payload types, message patterns, and communication
 * styles (tell, ask, publish-subscribe, etc.).
 */
describe('Message Passing Between Actors', () => {
  let dsl: DSL;
  let eventLog: ReturnType<typeof createTestEventLog>;
  
  beforeEach(() => {
    dsl = createTestDSL();
    eventLog = createTestEventLog();
  });

  describe('Basic Message Patterns', () => {
    it('should define actors with tell pattern (fire and forget)', () => {
      // Define sender actor
      const senderActor = dsl.component('SenderActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that sends messages',
        version: '1.0.0',
        messageHandlers: {
          sendMessage: {
            input: {
              properties: {
                message: { type: 'string' },
                recipient: { type: 'string' }
              },
              required: ['message', 'recipient']
            },
            output: { type: 'null' }
          }
        }
      });
      
      // Define receiver actor
      const receiverActor = dsl.component('ReceiverActor', {
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
          }
        }
      });
      
      // Implement the sender
      const senderImpl = dsl.implementation('SenderActorImpl', {
        targetComponent: 'SenderActor',
        description: 'Implementation of sender actor',
        version: '1.0.0',
        handlers: {
          sendMessage: async (input: any, context: any) => {
            // In a real implementation, this would use context.tell
            eventLog.recordEvent('SenderActor', 'sendMessage', {
              message: input.message,
              recipient: input.recipient
            });
            
            // Simulated tell operation
            return null;
          }
        }
      });
      
      // Implement the receiver
      const receiverImpl = dsl.implementation('ReceiverActorImpl', {
        targetComponent: 'ReceiverActor',
        description: 'Implementation of receiver actor',
        version: '1.0.0',
        handlers: {
          receiveMessage: async (input: any, context: any) => {
            eventLog.recordEvent('ReceiverActor', 'receiveMessage', {
              message: input.message,
              sender: input.sender
            });
            return null;
          }
        }
      });
      
      // Verify component definitions
      expect(senderActor.id).toBe('SenderActor');
      expect(receiverActor.id).toBe('ReceiverActor');
      expect(senderImpl.handlers.sendMessage).toBeDefined();
      expect(receiverImpl.handlers.receiveMessage).toBeDefined();
    });
    
    it('should define actors with ask pattern (request-response)', () => {
      // Define client actor
      const clientActor = dsl.component('ClientActor', {
        type: ComponentType.ACTOR,
        description: 'Client actor that makes requests',
        version: '1.0.0',
        messageHandlers: {
          makeRequest: {
            input: {
              properties: {
                query: { type: 'string' },
                serviceActor: { type: 'string' }
              },
              required: ['query', 'serviceActor']
            },
            output: {
              properties: {
                result: { type: 'object' }
              }
            }
          }
        }
      });
      
      // Define service actor
      const serviceActor = dsl.component('ServiceActor', {
        type: ComponentType.ACTOR,
        description: 'Service actor that handles requests',
        version: '1.0.0',
        messageHandlers: {
          handleRequest: {
            input: {
              properties: {
                query: { type: 'string' }
              },
              required: ['query']
            },
            output: {
              properties: {
                data: { type: 'object' },
                status: { type: 'string' }
              }
            }
          }
        }
      });
      
      // Implement the client
      const clientImpl = dsl.implementation('ClientActorImpl', {
        targetComponent: 'ClientActor',
        description: 'Implementation of client actor',
        version: '1.0.0',
        handlers: {
          makeRequest: async (input: any, context: any) => {
            // In a real implementation, this would use context.ask
            eventLog.recordEvent('ClientActor', 'makeRequest', {
              query: input.query,
              serviceActor: input.serviceActor
            });
            
            // Simulated ask operation
            // In real implementation: const result = await context.ask(input.serviceActor, 'handleRequest', { query: input.query });
            return { result: { data: { value: 42 }, status: 'success' } };
          }
        }
      });
      
      // Implement the service
      const serviceImpl = dsl.implementation('ServiceActorImpl', {
        targetComponent: 'ServiceActor',
        description: 'Implementation of service actor',
        version: '1.0.0',
        handlers: {
          handleRequest: async (input: any, context: any) => {
            eventLog.recordEvent('ServiceActor', 'handleRequest', {
              query: input.query
            });
            
            return {
              data: { value: 42 },
              status: 'success'
            };
          }
        }
      });
      
      // Verify component definitions
      expect(clientActor.id).toBe('ClientActor');
      expect(serviceActor.id).toBe('ServiceActor');
      expect(clientImpl.handlers.makeRequest).toBeDefined();
      expect(serviceImpl.handlers.handleRequest).toBeDefined();
    });
    
    it('should define actors with publish-subscribe pattern', () => {
      // Define publisher actor
      const publisherActor = dsl.component('PublisherActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that publishes events',
        version: '1.0.0',
        messageHandlers: {
          publishEvent: {
            input: {
              properties: {
                eventType: { type: 'string' },
                payload: { type: 'object' }
              },
              required: ['eventType', 'payload']
            },
            output: { type: 'null' }
          }
        }
      });
      
      // Define subscriber actor
      const subscriberActor = dsl.component('SubscriberActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that subscribes to events',
        version: '1.0.0',
        messageHandlers: {
          handleEvent: {
            input: {
              properties: {
                eventType: { type: 'string' },
                payload: { type: 'object' },
                timestamp: { type: 'string' }
              },
              required: ['eventType', 'payload']
            },
            output: { type: 'null' }
          },
          subscribe: {
            input: {
              properties: {
                eventTypes: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['eventTypes']
            },
            output: {
              properties: {
                success: { type: 'boolean' }
              }
            }
          }
        }
      });
      
      // Define a system with pub-sub support
      const pubSubSystem = dsl.system('PubSubSystem', {
        description: 'System with publish-subscribe support',
        version: '1.0.0',
        attributes: {
          messaging: {
            patterns: ['publish-subscribe'],
            eventBus: true
          }
        },
        components: {
          actors: [
            { ref: 'PublisherActor' },
            { ref: 'SubscriberActor' }
          ]
        }
      });
      
      // Verify component definitions
      expect(publisherActor.id).toBe('PublisherActor');
      expect(subscriberActor.id).toBe('SubscriberActor');
      expect(publisherActor.messageHandlers?.publishEvent).toBeDefined();
      expect(subscriberActor.messageHandlers?.handleEvent).toBeDefined();
      expect(subscriberActor.messageHandlers?.subscribe).toBeDefined();
      
      // Verify system supports pub-sub
      expect(pubSubSystem.attributes?.messaging?.patterns).toContain('publish-subscribe');
      expect(pubSubSystem.attributes?.messaging?.eventBus).toBe(true);
    });
  });

  describe('Complex Payload Types', () => {
    it('should support primitive data types', () => {
      // Define schema for message with primitives
      const primitiveSchema = dsl.component('PrimitivePayload', {
        type: ComponentType.SCHEMA,
        description: 'Schema with primitive types',
        version: '1.0.0',
        properties: {
          stringValue: { type: 'string' },
          numberValue: { type: 'number' },
          integerValue: { type: 'integer' },
          booleanValue: { type: 'boolean' },
          nullValue: { type: 'null' }
        }
      });
      
      // Define actor that handles primitive types
      const primitiveActor = dsl.component('PrimitiveActor', {
        type: ComponentType.ACTOR,
        description: 'Actor with primitive type handling',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: { ref: 'PrimitivePayload' },
            output: { type: 'object' }
          }
        }
      });
      
      // Verify definitions
      expect(primitiveSchema.id).toBe('PrimitivePayload');
      expect(primitiveActor.id).toBe('PrimitiveActor');
      expect(primitiveActor.messageHandlers?.process?.input).toEqual({ ref: 'PrimitivePayload' });
    });
    
    it('should support object data types', () => {
      // Define schema for nested object
      const addressSchema = dsl.component('Address', {
        type: ComponentType.SCHEMA,
        description: 'Address schema',
        version: '1.0.0',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          zipCode: { type: 'string' }
        },
        required: ['street', 'city']
      });
      
      const personSchema = dsl.component('Person', {
        type: ComponentType.SCHEMA,
        description: 'Person schema',
        version: '1.0.0',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' },
          email: { type: 'string' },
          address: { ref: 'Address' }
        },
        required: ['name']
      });
      
      // Define actor that handles object types
      const objectActor = dsl.component('ObjectActor', {
        type: ComponentType.ACTOR,
        description: 'Actor with object type handling',
        version: '1.0.0',
        messageHandlers: {
          processPerson: {
            input: { ref: 'Person' },
            output: { type: 'object' }
          }
        }
      });
      
      // Verify definitions
      expect(addressSchema.id).toBe('Address');
      expect(personSchema.id).toBe('Person');
      expect(objectActor.id).toBe('ObjectActor');
      expect(objectActor.messageHandlers?.processPerson?.input).toEqual({ ref: 'Person' });
    });
    
    it('should support array data types', () => {
      // Define schema for array type
      const itemSchema = dsl.component('Item', {
        type: ComponentType.SCHEMA,
        description: 'Item schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' }
        }
      });
      
      const itemArraySchema = dsl.component('ItemArray', {
        type: ComponentType.SCHEMA,
        description: 'Array of items',
        version: '1.0.0',
        properties: {
          items: {
            type: 'array',
            items: { ref: 'Item' }
          }
        }
      });
      
      // Define actor that handles array types
      const arrayActor = dsl.component('ArrayActor', {
        type: ComponentType.ACTOR,
        description: 'Actor with array type handling',
        version: '1.0.0',
        messageHandlers: {
          processItems: {
            input: { ref: 'ItemArray' },
            output: {
              properties: {
                totalItems: { type: 'integer' },
                totalValue: { type: 'number' }
              }
            }
          }
        }
      });
      
      // Verify definitions
      expect(itemSchema.id).toBe('Item');
      expect(itemArraySchema.id).toBe('ItemArray');
      expect(arrayActor.id).toBe('ArrayActor');
      expect(arrayActor.messageHandlers?.processItems?.input).toEqual({ ref: 'ItemArray' });
    });
    
    it('should support binary data types', () => {
      // Define schema for binary data
      const binarySchema = dsl.component('BinaryPayload', {
        type: ComponentType.SCHEMA,
        description: 'Schema for binary data',
        version: '1.0.0',
        properties: {
          filename: { type: 'string' },
          contentType: { type: 'string' },
          data: { type: 'string', format: 'binary' },
          size: { type: 'integer' }
        }
      });
      
      // Define actor that handles binary data
      const binaryActor = dsl.component('BinaryActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that processes binary data',
        version: '1.0.0',
        messageHandlers: {
          processBinary: {
            input: { ref: 'BinaryPayload' },
            output: { type: 'object' }
          }
        }
      });
      
      // Verify definitions
      expect(binarySchema.id).toBe('BinaryPayload');
      expect(binaryActor.id).toBe('BinaryActor');
      expect(binarySchema.properties?.data?.format).toBe('binary');
    });
  });

  describe('Message Transformation', () => {
    it('should support message transformation between actors', () => {
      // Define input and output schemas
      dsl.component('RawData', {
        type: ComponentType.SCHEMA,
        description: 'Raw input data',
        version: '1.0.0',
        properties: {
          value: { type: 'string' }
        }
      });
      
      dsl.component('ParsedData', {
        type: ComponentType.SCHEMA,
        description: 'Parsed data',
        version: '1.0.0',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          attributes: { type: 'object' }
        }
      });
      
      dsl.component('EnrichedData', {
        type: ComponentType.SCHEMA,
        description: 'Enriched data',
        version: '1.0.0',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          attributes: { type: 'object' },
          metadata: { type: 'object' },
          computed: { type: 'object' }
        }
      });
      
      // Define actors in a transformation chain
      const parserActor = dsl.component('ParserActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that parses raw data',
        version: '1.0.0',
        messageHandlers: {
          parse: {
            input: { ref: 'RawData' },
            output: { ref: 'ParsedData' }
          }
        }
      });
      
      const enricherActor = dsl.component('EnricherActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that enriches parsed data',
        version: '1.0.0',
        messageHandlers: {
          enrich: {
            input: { ref: 'ParsedData' },
            output: { ref: 'EnrichedData' }
          }
        }
      });
      
      const processorActor = dsl.component('ProcessorActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that processes the enriched data',
        version: '1.0.0',
        messageHandlers: {
          process: {
            input: { ref: 'EnrichedData' },
            output: { type: 'object' }
          }
        }
      });
      
      // Define a system with this transformation pipeline
      const transformationSystem = dsl.system('TransformationSystem', {
        description: 'System with data transformation pipeline',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'ParserActor' },
            { ref: 'EnricherActor' },
            { ref: 'ProcessorActor' }
          ]
        }
      });
      
      // Verify actors and pipeline
      expect(parserActor.id).toBe('ParserActor');
      expect(enricherActor.id).toBe('EnricherActor');
      expect(processorActor.id).toBe('ProcessorActor');
      
      expect(parserActor.messageHandlers?.parse?.output).toEqual({ ref: 'ParsedData' });
      expect(enricherActor.messageHandlers?.enrich?.input).toEqual({ ref: 'ParsedData' });
      
      expect(transformationSystem.components?.actors?.length).toBe(3);
    });
  });

  describe('Message Routing', () => {
    it('should support content-based message routing', () => {
      // Define a router actor
      const routerActor = dsl.component('RouterActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that routes messages based on content',
        version: '1.0.0',
        messageHandlers: {
          route: {
            input: {
              properties: {
                messageType: { type: 'string' },
                payload: { type: 'object' }
              },
              required: ['messageType', 'payload']
            },
            output: { type: 'null' }
          }
        }
      });
      
      // Define target actors
      const orderActor = dsl.component('OrderActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that handles orders',
        version: '1.0.0',
        messageHandlers: {
          processOrder: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      const paymentActor = dsl.component('PaymentActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that handles payments',
        version: '1.0.0',
        messageHandlers: {
          processPayment: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      const shippingActor = dsl.component('ShippingActor', {
        type: ComponentType.ACTOR,
        description: 'Actor that handles shipping',
        version: '1.0.0',
        messageHandlers: {
          processShipping: {
            input: { type: 'object' },
            output: { type: 'object' }
          }
        }
      });
      
      // Define a system with routing
      const routingSystem = dsl.system('RoutingSystem', {
        description: 'System with content-based routing',
        version: '1.0.0',
        components: {
          actors: [
            { ref: 'RouterActor' },
            { ref: 'OrderActor' },
            { ref: 'PaymentActor' },
            { ref: 'ShippingActor' }
          ]
        }
      });
      
      // Verify component definitions
      expect(routerActor.id).toBe('RouterActor');
      expect(orderActor.id).toBe('OrderActor');
      expect(paymentActor.id).toBe('PaymentActor');
      expect(shippingActor.id).toBe('ShippingActor');
      
      expect(routingSystem.components?.actors?.length).toBe(4);
    });
  });
}); 