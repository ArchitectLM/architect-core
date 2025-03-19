import { ChromaDBConnector } from '../src/vector-db/chroma-connector.js';
import { Component, VectorDBConfig, SearchOptions } from '../src/models.js';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from the root .env file
const rootEnvPath = path.resolve(process.cwd(), '../../.env');
dotenv.config({ path: rootEnvPath });

// Debug logging
console.log('Environment variables loaded from:', rootEnvPath);
console.log('API Key available:', !!process.env.OPENROUTER_API_KEY);

// Example DSL components from the actual codebase
export const ecommerceComponents: Component[] = [
  {
    type: 'workflow',
    name: 'OrderProcessingSystem',
    content: `/**
 * Order Processing System
 * 
 * Handles the end-to-end order processing workflow
 */
export default System.define('OrderProcessingSystem', {
  description: 'Handles the end-to-end order processing workflow',
  version: '1.0.0',
  tags: ['e-commerce', 'order-processing'],
  
  components: {
    schemas: [
      { ref: 'Order', required: true },
      { ref: 'OrderItem', required: true },
      { ref: 'Customer', required: true },
      { ref: 'Product', required: true },
      { ref: 'Payment', required: true },
      { ref: 'Shipment', required: true }
    ],
    
    commands: [
      { ref: 'CreateOrder', required: true },
      { ref: 'ProcessPayment', required: true },
      { ref: 'ShipOrder', required: true },
      { ref: 'CancelOrder', required: false }
    ],
    
    queries: [
      { ref: 'GetOrder', required: true },
      { ref: 'ListOrders', required: true },
      { ref: 'GetOrderHistory', required: false }
    ],
    
    events: [
      { ref: 'OrderCreated', required: true },
      { ref: 'PaymentProcessed', required: true },
      { ref: 'OrderShipped', required: true },
      { ref: 'OrderCancelled', required: false }
    ]
  },
  
  extensions: [
    { 
      ref: 'MonitoringExtension', 
      config: { metricsEndpoint: 'https://metrics.example.com' } 
    },
    { 
      ref: 'ValidationExtension', 
      config: { strictMode: true } 
    }
  ],
  
  plugins: {
    storage: { 
      ref: 'PostgresPlugin',
      config: {
        connectionString: 'postgresql://user:password@localhost:5432/orders',
        poolSize: 10
      }
    },
    messaging: { 
      ref: 'KafkaPlugin',
      config: {
        brokers: ['kafka-1:9092', 'kafka-2:9092'],
        clientId: 'order-processing-system'
      }
    },
    payment: { 
      ref: 'StripePlugin',
      config: {
        apiKey: 'sk_test_...',
        webhookSecret: 'whsec_...'
      }
    },
    shipping: { 
      ref: 'FedExPlugin',
      config: {
        apiKey: 'fedex_api_key',
        accountNumber: '123456789'
      }
    }
  },
  
  workflows: [
    {
      name: 'StandardOrderProcess',
      description: 'Standard flow for processing an order',
      steps: [
        { command: 'CreateOrder', next: 'ProcessPayment' },
        { command: 'ProcessPayment', next: 'ShipOrder', onFailure: 'CancelOrder' },
        { command: 'ShipOrder', end: true }
      ]
    },
    {
      name: 'ExpressOrderProcess',
      description: 'Express flow for processing an order with expedited shipping',
      steps: [
        { command: 'CreateOrder', next: 'ProcessPayment' },
        { command: 'ProcessPayment', next: 'ShipExpressOrder', onFailure: 'CancelOrder' },
        { command: 'ShipExpressOrder', end: true }
      ]
    }
  ]
});`,
    metadata: {
      path: 'examples/systems/OrderProcessingSystem.ts',
      description: 'Handles the end-to-end order processing workflow',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-commerce',
      tags: ['e-commerce', 'order-processing', 'system'],
    }
  },
  {
    type: 'schema',
    name: 'Order',
    content: `/**
 * Order schema component
 * 
 * Represents a customer order in the e-commerce system
 */
export default System.component('Order', {
  type: ComponentType.SCHEMA,
  description: 'Represents a customer order in the system',
  tags: ['order', 'commerce', 'core'],
  version: '1.0.0',
  authors: ['team-commerce'],
  
  definition: {
    type: 'object',
    properties: {
      id: { 
        type: 'string', 
        description: 'Unique order identifier' 
      },
      customerId: { 
        type: 'string', 
        description: 'Customer who placed the order' 
      },
      items: { 
        type: 'array', 
        items: { 
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Product identifier' },
            quantity: { type: 'number', description: 'Quantity ordered' },
            price: { type: 'number', description: 'Price per unit' }
          },
          required: ['productId', 'quantity', 'price']
        },
        description: 'Items included in this order' 
      },
      totalAmount: { 
        type: 'number', 
        description: 'Total order amount in the specified currency' 
      },
      currency: { 
        type: 'string', 
        description: 'Three-letter currency code (ISO 4217)' 
      },
      status: { 
        type: 'string', 
        enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'],
        description: 'Current status of the order' 
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the order was created'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'When the order was last updated'
      }
    },
    required: ['id', 'customerId', 'items', 'totalAmount', 'currency', 'status', 'createdAt']
  },
  
  examples: [
    {
      id: "order-123",
      customerId: "cust-456",
      items: [
        { productId: "prod-789", quantity: 2, price: 49.99 }
      ],
      totalAmount: 99.98,
      currency: "USD",
      status: "pending",
      createdAt: "2023-06-01T12:00:00Z",
      updatedAt: "2023-06-01T12:00:00Z"
    }
  ],
  
  relatedComponents: [
    { 
      ref: 'Customer', 
      relationship: 'references', 
      description: 'An order is placed by a customer' 
    },
    { 
      ref: 'OrderItem', 
      relationship: 'contains', 
      description: 'An order contains order items' 
    },
    { 
      ref: 'Product', 
      relationship: 'references', 
      description: 'Order items reference products' 
    }
  ]
});`,
    metadata: {
      path: 'examples/schemas/Order.ts',
      description: 'Represents a customer order in the system',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-commerce',
      tags: ['order', 'commerce', 'core', 'schema'],
    }
  },
  {
    type: 'command',
    name: 'CreateOrder',
    content: `/**
 * CreateOrder command component
 * 
 * Creates a new order in the e-commerce system
 */
export default System.component('CreateOrder', {
  type: ComponentType.COMMAND,
  description: 'Creates a new order in the system',
  tags: ['order', 'commerce', 'write'],
  version: '1.0.0',
  
  input: {
    ref: 'CreateOrderRequest',
    description: 'Request to create a new order'
  },
  output: {
    ref: 'Order',
    description: 'The created order'
  },
  
  plugins: {
    storage: {
      ref: 'PostgresPlugin',
      description: 'For persisting order data',
      operations: ['insert', 'update']
    },
    payment: {
      ref: 'StripePlugin',
      description: 'For processing payments',
      operations: ['createCharge']
    },
    messaging: {
      ref: 'KafkaPlugin',
      description: 'For publishing order events',
      operations: ['publish']
    }
  },
  
  extensionPoints: {
    beforeCreate: {
      description: 'Called before creating the order',
      parameters: ['order', 'context'],
      examples: ['validateInventory', 'applyDiscounts']
    },
    afterCreate: {
      description: 'Called after creating the order',
      parameters: ['order', 'context'],
      examples: ['sendConfirmation', 'updateAnalytics']
    }
  },
  
  produces: [
    {
      event: 'OrderCreated',
      description: 'Published when an order is successfully created'
    }
  ],
  
  relatedComponents: [
    { ref: 'Order', relationship: 'creates' },
    { ref: 'GetOrder', relationship: 'complementary' },
    { ref: 'ProcessPayment', relationship: 'next-step' }
  ]
});`,
    metadata: {
      path: 'examples/commands/CreateOrder.ts',
      description: 'Creates a new order in the system',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-commerce',
      tags: ['order', 'commerce', 'write', 'command'],
    }
  },
  {
    type: 'command',
    name: 'CreateOrderImplementation',
    content: `/**
 * Implementation for the CreateOrder command
 */
export default System.implement<CreateOrderRequest, Order>('CreateOrder', 
  async (input: CreateOrderRequest, context: Context): Promise<Order> => {
    const { storage, payment, messaging } = context.plugins;
    const { logger, extensions } = context;
    
    try {
      logger.info('Creating order', { customerId: input.customerId });
      
      // 1. Validate customer exists
      const [customer] = await storage.query(
        'SELECT * FROM customers WHERE id = $1',
        [input.customerId]
      );
      
      if (!customer) {
        throw new Error(\`Customer \${input.customerId} not found\`);
      }
      
      // 2. Get product details and calculate prices
      const productIds = input.items.map(item => item.productId);
      const products = await storage.query(
        'SELECT * FROM products WHERE id = ANY($1)',
        [productIds]
      );
      
      const productMap = products.reduce((map, product) => {
        map[product.id] = product;
        return map;
      }, {} as Record<string, any>);
      
      const items = input.items.map(item => {
        const product = productMap[item.productId];
        if (!product) {
          throw new Error(\`Product \${item.productId} not found\`);
        }
        
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.price
        };
      });
      
      const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      // 3. Call beforeCreate extension point
      const orderData = {
        customerId: input.customerId,
        items,
        totalAmount,
        currency: input.currency,
        status: 'pending'
      };
      
      const modifiedOrderData = await extensions.call('beforeCreate', orderData, context);
      
      // 4. Create the order
      const now = new Date().toISOString();
      const order = {
        id: \`order-\${Date.now()}-\${Math.floor(Math.random() * 1000)}\`,
        ...modifiedOrderData,
        createdAt: now,
        updatedAt: now
      };
      
      await storage.insert('orders', order);
      
      // 5. Call afterCreate extension point
      await extensions.call('afterCreate', order, context);
      
      // 6. Publish event
      await messaging.publish('orders', {
        type: 'OrderCreated',
        payload: order
      });
      
      logger.info('Order created successfully', { orderId: order.id });
      
      return order;
    } catch (error) {
      logger.error('Failed to create order', error);
      throw error;
    }
  },
  {
    complexity: 'medium',
    estimatedLatency: 'medium',
    sideEffects: ['database-write', 'event-publishing'],
    testCases: [
      {
        description: 'Successfully creates an order',
        input: {
          customerId: 'cust-123',
          items: [
            { productId: 'prod-456', quantity: 2 }
          ],
          currency: 'USD'
        },
        expectedOutput: {
          id: 'order-123456789',
          customerId: 'cust-123',
          items: [
            { productId: 'prod-456', quantity: 2, price: 49.99 }
          ],
          totalAmount: 99.98,
          currency: 'USD',
          status: 'pending',
          createdAt: '2023-06-01T12:00:00Z',
          updatedAt: '2023-06-01T12:00:00Z'
        },
        mockResponses: {
          'storage.query[0]': [{ id: 'cust-123', name: 'John Doe' }],
          'storage.query[1]': [{ id: 'prod-456', name: 'Test Product', price: 49.99 }]
        }
      },
      {
        description: 'Throws error when customer does not exist',
        input: {
          customerId: 'cust-999',
          items: [
            { productId: 'prod-456', quantity: 2 }
          ],
          currency: 'USD'
        },
        expectedOutput: new Error('Customer cust-999 not found'),
        mockResponses: {
          'storage.query[0]': []
        }
      }
    ]
  }
);`,
    metadata: {
      path: 'examples/implementations/CreateOrder.impl.ts',
      description: 'Implementation of the CreateOrder command',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-commerce',
      tags: ['order', 'commerce', 'implementation', 'command'],
    }
  },
  {
    type: 'extension',
    name: 'PaymentProcessingExtension',
    content: `/**
 * Payment Processing Extension
 * 
 * Provides payment processing capabilities with multiple provider support
 */
export default System.extension('PaymentProcessingExtension', {
  name: 'payment-processing',
  description: 'Handles payment processing with multiple provider support',
  version: '1.0.0',
  tags: ['payment', 'processing', 'extension'],

  extensionPoints: {
    'beforePaymentProcess': {
      description: 'Called before processing a payment',
      parameters: ['paymentData', 'context'],
      examples: ['validatePayment', 'applyFraudDetection']
    },
    'afterPaymentProcess': {
      description: 'Called after processing a payment',
      parameters: ['paymentResult', 'context'],
      examples: ['sendReceipt', 'updateAccountBalance']
    },
    'onPaymentError': {
      description: 'Called when a payment error occurs',
      parameters: ['error', 'context'],
      examples: ['logError', 'notifySupport']
    }
  },

  configuration: {
    providers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          apiKey: { type: 'string' },
          webhookSecret: { type: 'string' },
          environment: { type: 'string', enum: ['test', 'production'] }
        }
      }
    },
    defaultProvider: { type: 'string' },
    retryConfig: {
      type: 'object',
      properties: {
        maxAttempts: { type: 'number' },
        backoffFactor: { type: 'number' }
      }
    }
  },

  hooks: {
    'system.init': async (context) => {
      // Initialize payment providers
      const providers = context.config.providers || [];
      for (const provider of providers) {
        await context.registerPaymentProvider(provider);
      }
    },
    'order.beforeCreate': async (order, context) => {
      // Validate payment method
      if (!order.paymentMethod) {
        throw new Error('Payment method is required');
      }
      return order;
    }
  }
});`,
    metadata: {
      path: 'examples/extensions/PaymentProcessingExtension.ts',
      description: 'Handles payment processing with multiple provider support',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-payments',
      tags: ['payment', 'processing', 'extension', 'core'],
    }
  },
  {
    type: 'extension',
    name: 'AuthenticationExtension',
    content: `/**
 * Authentication Extension
 * 
 * Provides authentication and authorization capabilities
 */
export default System.extension('AuthenticationExtension', {
  name: 'authentication',
  description: 'Handles user authentication and authorization',
  version: '1.0.0',
  tags: ['auth', 'security', 'extension'],

  extensionPoints: {
    'beforeAuthenticate': {
      description: 'Called before authenticating a user',
      parameters: ['credentials', 'context'],
      examples: ['validateCredentials', 'checkRateLimit']
    },
    'afterAuthenticate': {
      description: 'Called after authenticating a user',
      parameters: ['user', 'context'],
      examples: ['generateToken', 'updateLastLogin']
    },
    'onAuthenticationError': {
      description: 'Called when authentication fails',
      parameters: ['error', 'context'],
      examples: ['logFailedAttempt', 'notifyUser']
    }
  },

  configuration: {
    providers: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['jwt', 'oauth2', 'basic'] },
          config: { type: 'object' }
        }
      }
    },
    sessionConfig: {
      type: 'object',
      properties: {
        duration: { type: 'number' },
        refreshToken: { type: 'boolean' }
      }
    },
    securityConfig: {
      type: 'object',
      properties: {
        passwordPolicy: { type: 'object' },
        mfaEnabled: { type: 'boolean' }
      }
    }
  },

  hooks: {
    'system.init': async (context) => {
      // Initialize auth providers
      const providers = context.config.providers || [];
      for (const provider of providers) {
        await context.registerAuthProvider(provider);
      }
    },
    'http.beforeRequest': async (request, context) => {
      // Validate authentication token
      const token = request.headers.authorization;
      if (!token) {
        throw new Error('Authentication required');
      }
      return request;
    }
  }
});`,
    metadata: {
      path: 'examples/extensions/AuthenticationExtension.ts',
      description: 'Handles user authentication and authorization',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-security',
      tags: ['auth', 'security', 'extension', 'core'],
    }
  },
  {
    type: 'extension',
    name: 'StripePaymentPlugin',
    content: `/**
 * Stripe Payment Plugin
 * 
 * Implements payment processing using Stripe
 */
export default System.plugin('StripePaymentPlugin', {
  name: 'stripe-payment',
  description: 'Payment processing implementation using Stripe',
  version: '1.0.0',
  tags: ['payment', 'stripe', 'plugin'],

  implements: ['PaymentProvider'],

  configuration: {
    apiKey: { type: 'string', required: true },
    webhookSecret: { type: 'string', required: true },
    environment: { type: 'string', enum: ['test', 'production'] }
  },

  operations: {
    createCharge: {
      description: 'Create a new charge',
      input: {
        amount: { type: 'number' },
        currency: { type: 'string' },
        source: { type: 'string' }
      },
      output: {
        id: { type: 'string' },
        status: { type: 'string' }
      }
    },
    refundCharge: {
      description: 'Refund a charge',
      input: {
        chargeId: { type: 'string' },
        amount: { type: 'number' }
      }
    }
  },

  hooks: {
    'payment.beforeProcess': async (payment, context) => {
      // Add Stripe-specific metadata
      return {
        ...payment,
        provider: 'stripe',
        idempotencyKey: payment.id
      };
    }
  }
});`,
    metadata: {
      path: 'examples/plugins/StripePaymentPlugin.ts',
      description: 'Payment processing implementation using Stripe',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-payments',
      tags: ['payment', 'stripe', 'plugin', 'integration'],
    }
  },
  {
    type: 'schema',
    name: 'SystemArchitecture',
    content: `/**
 * System Architecture Documentation
 * 
 * Defines the overall system architecture and component relationships
 */
export default System.component('SystemArchitecture', {
  type: ComponentType.DOCUMENTATION,
  description: 'System architecture documentation and component relationships',
  version: '1.0.0',
  tags: ['architecture', 'documentation', 'system'],

  architecture: {
    components: {
      core: [
        { name: 'OrderProcessingSystem', type: 'system' },
        { name: 'AuthenticationExtension', type: 'extension' },
        { name: 'PaymentProcessingExtension', type: 'extension' }
      ],
      extensions: [
        {
          name: 'AuthenticationExtension',
          provides: ['authentication', 'authorization'],
          extensionPoints: ['beforeAuthenticate', 'afterAuthenticate']
        },
        {
          name: 'PaymentProcessingExtension',
          provides: ['payment-processing'],
          extensionPoints: ['beforePaymentProcess', 'afterPaymentProcess']
        }
      ],
      plugins: [
        {
          name: 'StripePaymentPlugin',
          implements: ['PaymentProvider'],
          operations: ['createCharge', 'refundCharge']
        }
      ]
    },
    flows: {
      orderCreation: {
        description: 'Order creation and processing flow',
        steps: [
          { component: 'AuthenticationExtension', operation: 'authenticate' },
          { component: 'CreateOrder', operation: 'execute' },
          { component: 'PaymentProcessingExtension', operation: 'processPayment' },
          { component: 'OrderProcessingSystem', operation: 'finalizeOrder' }
        ]
      }
    },
    security: {
      authentication: {
        provider: 'AuthenticationExtension',
        methods: ['jwt', 'oauth2'],
        extensionPoints: ['beforeAuthenticate', 'afterAuthenticate']
      },
      authorization: {
        provider: 'AuthenticationExtension',
        policies: ['rbac', 'abac'],
        extensionPoints: ['checkPermissions']
      }
    },
    integrations: {
      payment: {
        providers: ['StripePaymentPlugin'],
        extensionPoints: ['beforePaymentProcess', 'afterPaymentProcess']
      },
      messaging: {
        provider: 'KafkaPlugin',
        topics: ['orders', 'payments', 'shipments']
      }
    }
  }
});`,
    metadata: {
      path: 'examples/documentation/SystemArchitecture.ts',
      description: 'System architecture documentation and component relationships',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-architecture',
      tags: ['architecture', 'documentation', 'system', 'core'],
    }
  },
  {
    type: 'schema',
    name: 'AISystemArchitecture',
    content: `/**
 * AI System Architecture Documentation
 * 
 * Comprehensive guide for working with LLM, Agents, and Vector DB
 */
export default System.component('AISystemArchitecture', {
  type: ComponentType.DOCUMENTATION,
  description: 'Guide for working with AI components including LLM, Agents, and Vector DB',
  version: '1.0.0',
  tags: ['ai', 'llm', 'vector-db', 'agents', 'documentation'],

  architecture: {
    components: {
      llm: {
        name: 'LLMService',
        description: 'Language Model Service for text generation and understanding',
        providers: ['OpenAI', 'Anthropic', 'OpenRouter'],
        capabilities: [
          'Text Generation',
          'Code Generation',
          'Query Understanding',
          'Context Processing'
        ],
        configuration: {
          modelName: 'string (e.g., "gpt-4", "claude-3")',
          temperature: 'number (0.0 - 1.0)',
          maxTokens: 'number',
          apiKey: 'string (from environment)',
          systemPrompt: 'string (role definition)'
        },
        extensionPoints: [
          'beforePromptGeneration',
          'afterResponseGeneration',
          'onError'
        ]
      },
      vectorDB: {
        name: 'VectorDBService',
        description: 'Vector Database for semantic search and retrieval',
        implementation: 'ChromaDB',
        features: [
          'Document Storage',
          'Semantic Search',
          'Metadata Filtering',
          'Similarity Scoring'
        ],
        configuration: {
          collectionName: 'string',
          embeddingDimension: 'number',
          distance: 'string (cosine, euclidean, etc.)',
          chunkSize: 'number (for text splitting)',
          overlapSize: 'number (for chunk overlap)'
        },
        operations: [
          'addDocuments',
          'search',
          'delete',
          'update',
          'filter'
        ]
      },
      agents: {
        name: 'AgentSystem',
        description: 'Autonomous agents for task execution',
        types: [
          {
            name: 'DSLAgent',
            purpose: 'DSL component generation and management',
            capabilities: [
              'Component Creation',
              'Code Generation',
              'Documentation',
              'Testing'
            ]
          },
          {
            name: 'SearchAgent',
            purpose: 'Intelligent search and retrieval',
            capabilities: [
              'Query Understanding',
              'Context Gathering',
              'Result Ranking'
            ]
          },
          {
            name: 'ValidationAgent',
            purpose: 'Content validation and quality assurance',
            capabilities: [
              'Schema Validation',
              'Code Review',
              'Security Checking'
            ]
          }
        ],
        tools: [
          {
            name: 'FileSystem',
            operations: ['read', 'write', 'search', 'delete']
          },
          {
            name: 'VectorDB',
            operations: ['query', 'insert', 'update']
          },
          {
            name: 'CodeAnalysis',
            operations: ['lint', 'test', 'validate']
          }
        ]
      }
    },
    workflows: {
      componentCreation: {
        description: 'Process of creating new DSL components',
        steps: [
          {
            name: 'Understanding',
            agent: 'DSLAgent',
            action: 'Analyze user request and gather requirements'
          },
          {
            name: 'ContextGathering',
            agent: 'SearchAgent',
            action: 'Search for relevant examples and documentation'
          },
          {
            name: 'Generation',
            agent: 'DSLAgent',
            action: 'Generate component code and documentation'
          },
          {
            name: 'Validation',
            agent: 'ValidationAgent',
            action: 'Validate generated content'
          }
        ]
      },
      semanticSearch: {
        description: 'Process of semantic search and retrieval',
        steps: [
          {
            name: 'QueryProcessing',
            agent: 'SearchAgent',
            action: 'Process and enhance search query'
          },
          {
            name: 'VectorSearch',
            service: 'VectorDBService',
            action: 'Perform semantic search'
          },
          {
            name: 'ResultRanking',
            agent: 'SearchAgent',
            action: 'Rank and filter results'
          }
        ]
      }
    },
    bestPractices: {
      llm: [
        'Use consistent system prompts for reliable behavior',
        'Implement retry logic with exponential backoff',
        'Cache responses for identical queries',
        'Monitor token usage and costs',
        'Validate outputs before using them'
      ],
      vectorDB: [
        'Optimize chunk size for your use case',
        'Implement regular reindexing strategy',
        'Use metadata for efficient filtering',
        'Monitor embedding quality',
        'Implement versioning for embeddings'
      ],
      agents: [
        'Define clear boundaries of responsibility',
        'Implement proper error handling',
        'Log all actions for debugging',
        'Use rate limiting for API calls',
        'Implement timeout mechanisms'
      ]
    },
    security: {
      llm: {
        considerations: [
          'API key management',
          'Prompt injection prevention',
          'Output sanitization',
          'Rate limiting',
          'Cost control'
        ]
      },
      vectorDB: {
        considerations: [
          'Access control',
          'Data encryption',
          'Backup strategy',
          'Version control',
          'Query monitoring'
        ]
      },
      agents: {
        considerations: [
          'Permission management',
          'Action logging',
          'Resource limits',
          'Input validation',
          'Output verification'
        ]
      }
    },
    monitoring: {
      metrics: [
        {
          name: 'LLM Response Time',
          type: 'histogram',
          labels: ['model', 'operation']
        },
        {
          name: 'Vector Search Latency',
          type: 'histogram',
          labels: ['collection', 'query_type']
        },
        {
          name: 'Agent Operation Duration',
          type: 'histogram',
          labels: ['agent', 'operation']
        },
        {
          name: 'Token Usage',
          type: 'counter',
          labels: ['model', 'operation']
        },
        {
          name: 'Error Rate',
          type: 'counter',
          labels: ['component', 'error_type']
        }
      ],
      alerts: [
        {
          name: 'High Latency',
          condition: 'response_time > threshold',
          severity: 'warning'
        },
        {
          name: 'Error Spike',
          condition: 'error_rate > threshold',
          severity: 'critical'
        },
        {
          name: 'Token Usage',
          condition: 'usage > budget',
          severity: 'warning'
        }
      ]
    },
    examples: {
      llmUsage: \`
// Example of using LLM service
const llmService = new LLMService({
  provider: 'OpenRouter',
  model: 'claude-3',
  temperature: 0.7
});

const response = await llmService.generate({
  prompt: 'Create a new order processing component',
  context: existingComponents,
  systemPrompt: 'You are a DSL component expert...'
});\`,
      vectorDBUsage: \`
// Example of using Vector DB
const vectorDB = new VectorDBService({
  collection: 'dsl-components',
  dimension: 384
});

// Add documents
await vectorDB.addDocuments({
  documents: components,
  metadata: metadata
});

// Search
const results = await vectorDB.search({
  query: 'payment processing workflow',
  filter: { type: 'component' },
  limit: 5
});\`,
      agentUsage: \`
// Example of using Agents
const dslAgent = new DSLAgent({
  tools: [fileSystem, vectorDB, codeAnalysis],
  llm: llmService
});

const result = await dslAgent.execute({
  task: 'Create a payment processing component',
  context: {
    existingComponents,
    requirements: {...}
  }
});\`
    }
  }
});`,
    metadata: {
      path: 'examples/documentation/AISystemArchitecture.ts',
      description: 'Guide for working with AI components including LLM, Agents, and Vector DB',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: '1.0.0',
      author: 'team-ai',
      tags: ['ai', 'llm', 'vector-db', 'agents', 'documentation', 'architecture', 'core'],
    }
  }
];

export async function seedVectorDB(connector: ChromaDBConnector) {
  console.log('Seeding example components...');
  for (const component of ecommerceComponents) {
    await connector.addDocument(component);
    console.log(`Added component: ${component.name}`);
  }
  
  // Test different types of queries
  const testQueries = [
    {
      name: "Order Creation Flow",
      query: "how to create and process a new order",
      description: "Testing workflow-related queries"
    },
    {
      name: "Schema Validation",
      query: "validate order data structure and fields",
      description: "Testing schema-related queries"
    },
    {
      name: "Payment Integration",
      query: "handle payment processing and validation",
      description: "Testing integration-related queries"
    },
    {
      name: "User Authentication",
      query: "authenticate user before order creation",
      description: "Testing security-related queries"
    },
    {
      name: "System Architecture",
      query: "overall system structure and components",
      description: "Testing high-level system queries"
    }
  ];
  
  console.log('\nTesting retrieval with different queries:');
  for (const test of testQueries) {
    console.log(`\n=== ${test.name} ===`);
    console.log(`Query: "${test.query}"`);
    console.log(`Description: ${test.description}`);
    
    const searchOptions: SearchOptions = {
      limit: 100,
      threshold: 0.7,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    };
    
    const results = await connector.search(test.query, searchOptions);
    
    console.log('\nRetrieved components:');
    results.forEach((result, index) => {
      const component = result.component;
      console.log(`\n${index + 1}. ${component.name} (${component.type})`);
      console.log(`Description: ${component.metadata.description}`);
      console.log('Tags:', component.metadata.tags?.join(', ') || []);
    });
  }
}

// Run the seeding script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Initializing ChromaDB connector...');
  
  const config: VectorDBConfig = {
    collectionName: 'dsl-components',
    embeddingDimension: 384,
    distance: 'cosine'
  };
  
  const connector = new ChromaDBConnector(config);
  await connector.initialize();
  
  seedVectorDB(connector).catch(console.error);
} 