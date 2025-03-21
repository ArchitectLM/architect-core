import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DSL } from '../../../src/core/dsl.js';
import { ComponentType } from '../../../src/models/component.js';

// Mock the integrations extension module
vi.mock('../../../src/extensions/integrations.extension.js', async () => {
  const actual = await vi.importActual('../../../src/extensions/integrations.extension.js');
  return {
    ...actual,
    setupIntegrationsExtension: vi.fn().mockImplementation((dsl, options) => {
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
  setupIntegrationsExtension, 
  IntegrationsExtensionOptions 
} from '../../../src/extensions/integrations.extension.js';

describe('Integrations Extension', () => {
  let dsl: DSL;
  let integrationsOptions: IntegrationsExtensionOptions;

  beforeEach(() => {
    dsl = new DSL();
    integrationsOptions = {
      webhooksEnabled: true,
      apisEnabled: true,
      eventBridgeEnabled: true
    };
    
    // Setup extension
    setupIntegrationsExtension(dsl, integrationsOptions);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Integrations Configuration', () => {
    it('should add integrations configuration to system definitions', () => {
      // Define a system component with integrations
      const system = dsl.system('IntegratedSystem', {
        description: 'System with comprehensive integrations',
        version: '1.0.0',
        components: {
          schemas: [],
          commands: []
        },
        integrations: {
          webhooks: {
            outgoing: [
              { event: 'OrderCreated', endpoint: '${config.partnerWebhookUrl}' }
            ],
            incoming: [
              { path: '/webhooks/inventory', handler: 'HandleInventoryWebhook' }
            ]
          },
          apis: {
            graphql: { enabled: true, introspection: '${config.environment !== "production"}' },
            rest: { enabled: true, versioning: 'url-path' }
          }
        }
      });
      
      // Extension should process and validate the integrations configuration
      expect(system.integrations).toBeDefined();
      expect(system.integrations.webhooks.outgoing).toHaveLength(1);
      expect(system.integrations.webhooks.incoming).toHaveLength(1);
      expect(system.integrations.apis.graphql.enabled).toBe(true);
      expect(system.integrations.apis.rest.enabled).toBe(true);
    });
    
    it('should support different API specifications', () => {
      // Define a system with comprehensive API configuration
      const apiSystem = dsl.system('ApiSystem', {
        description: 'System with diverse APIs',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        integrations: {
          apis: {
            rest: { 
              enabled: true,
              versioning: 'url-path',
              basePath: '/api',
              cors: {
                enabled: true,
                allowedOrigins: ['https://example.com'],
                allowedMethods: ['GET', 'POST', 'PUT', 'DELETE']
              },
              rateLimit: {
                enabled: true,
                requestsPerMinute: 60,
                burstLimit: 10
              }
            },
            graphql: {
              enabled: true,
              path: '/graphql',
              introspection: true,
              playground: true
            },
            grpc: {
              enabled: true,
              protoPath: './protos',
              services: ['UserService', 'OrderService']
            }
          }
        }
      });
      
      expect(apiSystem.integrations.apis.rest.versioning).toBe('url-path');
      expect(apiSystem.integrations.apis.rest.cors.enabled).toBe(true);
      expect(apiSystem.integrations.apis.graphql.playground).toBe(true);
      expect(apiSystem.integrations.apis.grpc.services).toContain('UserService');
    });
  });

  describe('Webhook Management', () => {
    it('should register outgoing webhooks based on system configuration', () => {
      // Define a system with outgoing webhooks
      const system = dsl.system('WebhookSystem', {
        description: 'System with webhooks',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        integrations: {
          webhooks: {
            outgoing: [
              { 
                event: 'OrderCreated', 
                endpoint: 'https://partner.example.com/webhooks/orders',
                format: 'json',
                headers: {
                  'X-Api-Key': '${config.partnerApiKey}'
                },
                retry: {
                  maxAttempts: 3,
                  backoffSeconds: 5
                }
              },
              {
                event: 'PaymentProcessed',
                endpoint: 'https://finance.example.com/webhooks',
                format: 'json'
              }
            ]
          }
        }
      });
      
      // Mock webhook registration 
      const registerOutgoingWebhookMock = vi.fn();
      (dsl as any).integrationsExtension = {
        ...(dsl as any).integrationsExtension,
        registerOutgoingWebhook: registerOutgoingWebhookMock
      };
      
      // Register webhooks based on system config
      (dsl as any).registerWebhooksForSystem(system);
      
      // Verify webhooks were registered
      expect(registerOutgoingWebhookMock).toHaveBeenCalledTimes(2);
      expect(registerOutgoingWebhookMock).toHaveBeenCalledWith(
        'OrderCreated',
        expect.objectContaining({
          endpoint: 'https://partner.example.com/webhooks/orders',
          retry: expect.objectContaining({ maxAttempts: 3 })
        })
      );
    });
    
    it('should handle incoming webhooks with registered handlers', async () => {
      // Define a component that handles webhooks
      const handleInventoryWebhook = dsl.component('HandleInventoryWebhook', {
        type: ComponentType.COMMAND,
        description: 'Handle inventory webhook from partner system',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' }
      });
      
      // Mock webhook handler implementation
      const webhookHandlerMock = vi.fn().mockResolvedValue({
        success: true,
        message: 'Webhook processed successfully'
      });
      
      dsl.implement('HandleInventoryWebhook', webhookHandlerMock);
      
      // Register the webhook endpoint
      (dsl as any).registerIncomingWebhook('/webhooks/inventory', 'HandleInventoryWebhook');
      
      // Simulate receiving a webhook
      const webhookPayload = {
        event: 'inventory_updated',
        productId: 'product-123',
        quantity: 50,
        timestamp: new Date().toISOString()
      };
      
      // Process the webhook
      const result = await (dsl as any).processIncomingWebhook('/webhooks/inventory', webhookPayload);
      
      // Verify the handler was called with the payload
      expect(webhookHandlerMock).toHaveBeenCalledWith(webhookPayload, expect.any(Object));
      expect(result.success).toBe(true);
    });
    
    it('should trigger outgoing webhooks when events occur', async () => {
      // Register an outgoing webhook
      (dsl as any).registerOutgoingWebhook('OrderCreated', {
        endpoint: 'https://partner.example.com/webhooks/orders',
        format: 'json',
        headers: { 'X-Api-Key': 'test-api-key' }
      });
      
      // Mock HTTP client for webhook delivery
      const sendWebhookMock = vi.fn().mockResolvedValue({
        status: 200,
        data: { received: true }
      });
      
      (dsl as any).integrationsExtension = {
        ...(dsl as any).integrationsExtension,
        sendWebhook: sendWebhookMock
      };
      
      // Define an event that triggers a webhook
      const orderCreatedEvent = {
        type: 'OrderCreated',
        data: {
          orderId: 'order-123',
          customerId: 'customer-123',
          total: 99.99,
          items: [{ productId: 'product-1', quantity: 2 }]
        },
        timestamp: new Date().toISOString()
      };
      
      // Trigger the event
      await (dsl as any).triggerEvent(orderCreatedEvent);
      
      // Verify webhook was sent
      expect(sendWebhookMock).toHaveBeenCalledWith(
        'https://partner.example.com/webhooks/orders',
        orderCreatedEvent,
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Api-Key': 'test-api-key' })
        })
      );
    });
  });

  describe('API Generation', () => {
    it('should generate REST API endpoints from commands and queries', () => {
      // Define some command and query components
      const createUserCommand = dsl.component('CreateUser', {
        type: ComponentType.COMMAND,
        description: 'Create a new user',
        version: '1.0.0',
        input: { ref: 'CreateUserInput' },
        output: { ref: 'User' },
        api: {
          rest: {
            method: 'POST',
            path: '/users',
            tags: ['Users'],
            responses: {
              '201': { description: 'User created successfully' },
              '400': { description: 'Invalid input' }
            }
          }
        }
      });
      
      const getUserQuery = dsl.component('GetUser', {
        type: ComponentType.QUERY,
        description: 'Get user by ID',
        version: '1.0.0',
        input: { 
          type: 'object',
          properties: {
            userId: { type: 'string' }
          }
        },
        output: { ref: 'User' },
        api: {
          rest: {
            method: 'GET',
            path: '/users/:userId',
            tags: ['Users'],
            responses: {
              '200': { description: 'User found' },
              '404': { description: 'User not found' }
            }
          }
        }
      });
      
      // Define a system with REST API enabled
      const apiSystem = dsl.system('ApiSystem', {
        description: 'System with REST API',
        version: '1.0.0',
        components: {
          commands: [{ ref: 'CreateUser' }],
          queries: [{ ref: 'GetUser' }]
        },
        integrations: {
          apis: {
            rest: {
              enabled: true,
              basePath: '/api/v1'
            }
          }
        }
      });
      
      // Mock API generation
      const generateRestApiMock = vi.fn().mockReturnValue({
        paths: {
          '/users': {
            post: { operationId: 'createUser', /* ... */ }
          },
          '/users/{userId}': {
            get: { operationId: 'getUser', /* ... */ }
          }
        }
      });
      
      (dsl as any).integrationsExtension = {
        ...(dsl as any).integrationsExtension,
        generateRestApi: generateRestApiMock
      };
      
      // Generate the API
      const openApiSpec = (dsl as any).generateRestApiForSystem(apiSystem);
      
      // Verify API was generated
      expect(generateRestApiMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'CreateUser' }),
          expect.objectContaining({ id: 'GetUser' })
        ]),
        expect.objectContaining({
          basePath: '/api/v1'
        })
      );
    });
    
    it('should generate GraphQL schema from types and operations', () => {
      // Define schema components for GraphQL types
      const userSchema = dsl.component('User', {
        type: ComponentType.SCHEMA,
        description: 'User schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['admin', 'user'] }
        },
        required: ['id', 'name', 'email'],
        graphql: {
          typeName: 'User',
          fields: {
            posts: { 
              type: '[Post]',
              description: 'User posts',
              resolver: 'getUserPosts'
            }
          }
        }
      });
      
      const postSchema = dsl.component('Post', {
        type: ComponentType.SCHEMA,
        description: 'Post schema',
        version: '1.0.0',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          content: { type: 'string' },
          authorId: { type: 'string' }
        },
        graphql: {
          typeName: 'Post',
          fields: {
            author: {
              type: 'User',
              description: 'Post author',
              resolver: 'getPostAuthor'
            }
          }
        }
      });
      
      // Define queries and mutations with GraphQL endpoints
      const getUsersQuery = dsl.component('GetUsers', {
        type: ComponentType.QUERY,
        description: 'Get users with optional filtering',
        version: '1.0.0',
        input: { 
          type: 'object',
          properties: {
            role: { type: 'string', nullable: true },
            limit: { type: 'number', nullable: true }
          }
        },
        output: { 
          type: 'array',
          items: { ref: 'User' }
        },
        graphql: {
          queryName: 'users',
          args: {
            role: { type: 'String' },
            limit: { type: 'Int', defaultValue: 10 }
          }
        }
      });
      
      const createPostCommand = dsl.component('CreatePost', {
        type: ComponentType.COMMAND,
        description: 'Create a new post',
        version: '1.0.0',
        input: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
            authorId: { type: 'string' }
          },
          required: ['title', 'content', 'authorId']
        },
        output: { ref: 'Post' },
        graphql: {
          mutationName: 'createPost',
          args: {
            input: { type: 'CreatePostInput!' }
          }
        }
      });
      
      // Define a system with GraphQL API enabled
      const graphqlSystem = dsl.system('GraphQLSystem', {
        description: 'System with GraphQL API',
        version: '1.0.0',
        components: {
          schemas: [{ ref: 'User' }, { ref: 'Post' }],
          queries: [{ ref: 'GetUsers' }],
          commands: [{ ref: 'CreatePost' }]
        },
        integrations: {
          apis: {
            graphql: {
              enabled: true,
              path: '/graphql',
              introspection: true
            }
          }
        }
      });
      
      // Mock GraphQL schema generation
      const generateGraphQLSchemaMock = vi.fn().mockReturnValue({
        typeDefs: '...',  // GraphQL schema SDL
        resolvers: { /* ... */ }
      });
      
      (dsl as any).integrationsExtension = {
        ...(dsl as any).integrationsExtension,
        generateGraphQLSchema: generateGraphQLSchemaMock
      };
      
      // Generate the GraphQL schema
      const graphqlSchema = (dsl as any).generateGraphQLSchemaForSystem(graphqlSystem);
      
      // Verify schema was generated
      expect(generateGraphQLSchemaMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'User' }),
          expect.objectContaining({ id: 'Post' })
        ]),
        expect.arrayContaining([
          expect.objectContaining({ id: 'GetUsers' })
        ]),
        expect.arrayContaining([
          expect.objectContaining({ id: 'CreatePost' })
        ]),
        expect.objectContaining({
          introspection: true
        })
      );
    });
  });

  describe('External Services Integration', () => {
    it('should create client adapters for external services', () => {
      // Define external service integrations
      const externalSystem = dsl.system('IntegrationSystem', {
        description: 'System with external integrations',
        version: '1.0.0',
        components: { schemas: [], commands: [] },
        integrations: {
          externalServices: [
            {
              name: 'paymentProcessor',
              type: 'rest',
              baseUrl: 'https://payments.example.com/api',
              auth: {
                type: 'apiKey',
                headerName: 'X-API-Key',
                key: '${config.paymentApiKey}'
              },
              operations: [
                { name: 'processPayment', method: 'POST', path: '/payments' },
                { name: 'getPayment', method: 'GET', path: '/payments/:id' },
                { name: 'refundPayment', method: 'POST', path: '/payments/:id/refund' }
              ]
            },
            {
              name: 'inventoryService',
              type: 'grpc',
              host: 'inventory.example.com:50051',
              protoFile: './protos/inventory.proto',
              services: ['InventoryService'],
              auth: {
                type: 'oauth2',
                tokenUrl: 'https://auth.example.com/token'
              }
            }
          ]
        }
      });
      
      // Mock client creation
      const createClientMock = vi.fn().mockReturnValue({
        processPayment: vi.fn(),
        getPayment: vi.fn(),
        refundPayment: vi.fn()
      });
      
      (dsl as any).integrationsExtension = {
        ...(dsl as any).integrationsExtension,
        createServiceClient: createClientMock
      };
      
      // Create clients for external services
      const clients = (dsl as any).createServiceClientsForSystem(externalSystem);
      
      // Verify clients were created
      expect(createClientMock).toHaveBeenCalledTimes(2);
      expect(createClientMock).toHaveBeenCalledWith(
        'paymentProcessor',
        expect.objectContaining({
          type: 'rest',
          baseUrl: 'https://payments.example.com/api'
        })
      );
      expect(createClientMock).toHaveBeenCalledWith(
        'inventoryService',
        expect.objectContaining({
          type: 'grpc',
          host: 'inventory.example.com:50051'
        })
      );
    });
    
    it('should expose operations from external service clients', async () => {
      // Define a service client
      const paymentClient = {
        processPayment: vi.fn().mockResolvedValue({
          id: 'payment-123',
          status: 'completed',
          amount: 99.99
        }),
        getPayment: vi.fn().mockResolvedValue({
          id: 'payment-123',
          status: 'completed',
          amount: 99.99
        }),
        refundPayment: vi.fn().mockResolvedValue({
          id: 'refund-123',
          status: 'completed',
          amount: 99.99
        })
      };
      
      // Register the client
      (dsl as any).serviceClients = {
        paymentProcessor: paymentClient
      };
      
      // Use the client in a command
      const processPaymentCommand = dsl.component('ProcessPayment', {
        type: ComponentType.COMMAND,
        description: 'Process a payment',
        version: '1.0.0',
        input: { type: 'object' },
        output: { type: 'object' }
      });
      
      // Implement the command using the external service
      const processPaymentImpl = vi.fn().mockImplementation(async (input, context) => {
        // Use the external service client
        const result = await context.services.paymentProcessor.processPayment({
          amount: input.amount,
          currency: input.currency,
          cardToken: input.cardToken
        });
        
        return {
          paymentId: result.id,
          status: result.status
        };
      });
      
      dsl.implement('ProcessPayment', processPaymentImpl);
      
      // Execute the command
      const result = await (processPaymentCommand as any).execute(
        {
          amount: 99.99,
          currency: 'USD',
          cardToken: 'tok_visa'
        },
        {
          services: (dsl as any).serviceClients
        }
      );
      
      // Verify the external service was called
      expect(paymentClient.processPayment).toHaveBeenCalledWith({
        amount: 99.99,
        currency: 'USD',
        cardToken: 'tok_visa'
      });
      
      // Verify the result
      expect(result.paymentId).toBe('payment-123');
      expect(result.status).toBe('completed');
    });
  });
}); 