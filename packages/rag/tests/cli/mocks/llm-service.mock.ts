import { Component } from '../../../src/models.js';
import { ComponentType as DslComponentType } from '@architectlm/dsl';

// Map RAG component type to DSL component type
const typeMap: Record<string, DslComponentType> = {
  'plugin': DslComponentType.PLUGIN,
  'command': DslComponentType.COMMAND,
  'event': DslComponentType.EVENT,
  'query': DslComponentType.QUERY,
  'schema': DslComponentType.SCHEMA,
  'workflow': DslComponentType.WORKFLOW,
  'extension': DslComponentType.EXTENSION,
};

export const mockLLMService = {
  getRelevantContext: async (request: string, componentType: string) => {
    // Return relevant examples based on component type
    if (componentType === 'schema') {
      return `Example Schema:
import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

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
});`;
    } else if (componentType === 'command') {
      return `Example Command:
import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

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
});`;
    } else if (componentType === 'plugin') {
      return `Example Plugin:
import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

export default System.component('ValidationPlugin', {
  type: ComponentType.PLUGIN,
  description: 'System validation plugin',
  tags: ['system', 'validation'],
  version: '1.0.0',
  authors: ['system'],
  
  operations: [
    {
      name: 'validate',
      description: 'Validates a component',
      input: { ref: 'Component', required: true },
      output: { ref: 'ValidationResult', required: true }
    }
  ],
  
  definition: {
    type: 'object',
    properties: {
      rules: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }
});`;
    } else if (componentType === 'workflow') {
      return `Example Workflow:
import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

export default System.component('UserRegistrationWorkflow', {
  type: ComponentType.WORKFLOW,
  description: 'User registration workflow',
  tags: ['workflow', 'user', 'registration'],
  version: '1.0.0',
  authors: ['system'],
  
  steps: [
    {
      name: 'validateInput',
      ref: 'ValidateUserDataCommand',
      description: 'Validates user registration data'
    },
    {
      name: 'createUser',
      ref: 'CreateUserCommand',
      description: 'Creates the user account'
    },
    {
      name: 'sendWelcomeEmail',
      ref: 'SendWelcomeEmailCommand',
      description: 'Sends welcome email to the user'
    }
  ],
  
  definition: {
    type: 'object',
    properties: {
      userId: { type: 'string' }
    }
  }
});`;
    }
    return 'Mock context';
  },

  generateComponent: async (request: string, type: string): Promise<Component> => {
    const dslType = typeMap[type];
    if (!dslType) {
      throw new Error(`Unsupported component type: ${type}`);
    }

    switch (type) {
      case 'schema':
        return {
          type: 'schema',
          name: 'UserProfileSchema',
          content: `import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

export default System.component('UserProfileSchema', {
  type: ComponentType.SCHEMA,
  description: 'User profile data schema',
  tags: ['schema', 'user', 'profile'],
  version: '1.0.0',
  authors: ['system'],
  
  definition: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'User full name' },
      email: { type: 'string', description: 'User email address' },
      age: { type: 'number', description: 'User age' }
    },
    required: ['name', 'email']
  },
  
  examples: [{
    name: "John Doe",
    email: "john@example.com",
    age: 30
  }]
});`,
          metadata: {
            path: 'schemas/user-profile.schema.ts',
            description: 'User profile data schema',
            tags: ['schema', 'user', 'profile'],
            createdAt: Date.now(),
            author: 'system',
            version: '1.0.0'
          }
        };

      case 'command':
        return {
          type: 'command',
          name: 'CreateUserCommand',
          content: `import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

export default System.component('CreateUserCommand', {
  type: ComponentType.COMMAND,
  description: 'Command to create a new user',
  tags: ['command', 'user', 'creation'],
  version: '1.0.0',
  authors: ['system'],
  
  input: {
    ref: 'UserSchema',
    description: 'User data to create'
  },
  output: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      userId: { type: 'string' }
    }
  },
  
  plugins: {
    storage: {
      ref: 'PostgresPlugin',
      description: 'For persisting user data',
      operations: ['insert']
    }
  },
  
  extensionPoints: {
    beforeCreate: {
      description: 'Called before creating the user',
      parameters: ['user', 'context']
    }
  },
  
  produces: [
    {
      event: 'UserCreated',
      description: 'Published when a user is successfully created'
    }
  ],
  
  relatedComponents: [
    { ref: 'UserSchema', relationship: 'uses' }
  ]
});`,
          metadata: {
            path: 'commands/create-user.command.ts',
            description: 'Command for user creation',
            tags: ['command', 'user', 'creation'],
            createdAt: Date.now(),
            author: 'system',
            version: '1.0.0'
          }
        };

      case 'plugin':
        return {
          type: 'plugin',
          name: 'ValidationPlugin',
          content: `import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

export default System.component('ValidationPlugin', {
  type: ComponentType.PLUGIN,
  description: 'System validation plugin',
  tags: ['system', 'validation'],
  version: '1.0.0',
  authors: ['system'],
  
  operations: [
    {
      name: 'validate',
      description: 'Validates a component',
      input: { ref: 'Component', required: true },
      output: { ref: 'ValidationResult', required: true }
    }
  ],
  
  definition: {
    type: 'object',
    properties: {
      rules: {
        type: 'array',
        items: { type: 'string' }
      }
    }
  }
});`,
          metadata: {
            path: 'plugins/validation.plugin.ts',
            description: 'System validation plugin',
            tags: ['plugin', 'system', 'validation'],
            createdAt: Date.now(),
            author: 'system',
            version: '1.0.0'
          }
        };

      case 'workflow':
        return {
          type: 'workflow',
          name: 'UserRegistrationWorkflow',
          content: `import { System } from '../../src/system-api.js';
import { ComponentType } from '../../src/types.js';

export default System.component('UserRegistrationWorkflow', {
  type: ComponentType.WORKFLOW,
  description: 'User registration workflow',
  tags: ['workflow', 'user', 'registration'],
  version: '1.0.0',
  authors: ['system'],
  
  steps: [
    {
      name: 'validateInput',
      ref: 'ValidateUserDataCommand',
      description: 'Validates user registration data'
    },
    {
      name: 'createUser',
      ref: 'CreateUserCommand',
      description: 'Creates the user account'
    },
    {
      name: 'sendWelcomeEmail',
      ref: 'SendWelcomeEmailCommand',
      description: 'Sends welcome email to the user'
    }
  ],
  
  definition: {
    type: 'object',
    properties: {
      userId: { type: 'string' }
    }
  }
});`,
          metadata: {
            path: 'workflows/user-registration.workflow.ts',
            description: 'User registration workflow',
            tags: ['workflow', 'user', 'registration'],
            createdAt: Date.now(),
            author: 'system',
            version: '1.0.0'
          }
        };

      default:
        throw new Error(`Unsupported component type: ${type}`);
    }
  }
};