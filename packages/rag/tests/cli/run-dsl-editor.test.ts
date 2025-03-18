import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { ChromaDBConnector } from '../../src/vector-db/chroma-connector.js';
import { VectorDBConfig, Component } from '../../src/models.js';
import { ComponentType } from '@architectlm/dsl';
import { runDslEditor } from '../../src/cli/run-dsl-editor.js';
import * as path from 'path';
import * as fs from 'fs';
import { ChromaClient, Collection, Metadata } from 'chromadb';
import { extractAstFeatures, convertCodeToAst } from '../../src/utils/ast-converter.js';
import { LLMService } from '../../src/llm/llm-service.js';
import { vi } from 'vitest';
import { mockLLMService } from './mocks/llm-service.mock.js';
import { logger } from '../../src/utils/logger.js';
import { determineComponentType } from '../../src/utils/component-type-detector.js';

// Example components from DSL examples
const exampleComponents: Component[] = [
  {
    type: 'schema' as const,
    name: 'Order',
    content: `import { System } from '../../src/system-api.js';
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
});`,
    metadata: {
      path: 'schemas/order.schema.ts',
      description: 'Order data schema definition',
      tags: ['schema', 'order', 'commerce'],
      createdAt: Date.now(),
      author: 'system',
      version: '1.0.0'
    }
  },
  {
    type: 'command' as const,
    name: 'CreateOrder',
    content: `import { System } from '../../src/system-api.js';
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
});`,
    metadata: {
      path: 'commands/create-order.command.ts',
      description: 'Command for order creation',
      tags: ['command', 'order', 'commerce'],
      createdAt: Date.now(),
      author: 'system',
      version: '1.0.0'
    }
  }
];

const documentation: Component = {
  type: 'plugin' as const,
  name: 'Documentation',
  content: `# DSL Component Types

## Schema Components
Use \`System.component\` with \`ComponentType.SCHEMA\` to define data structures.

## Command Components
Use \`System.component\` with \`ComponentType.COMMAND\` to define business operations.

## Pipeline Components
Use \`System.define\` to create workflow definitions with multiple steps.

## Extension Components
Use \`System.component\` with \`ComponentType.EXTENSION\` to add system extensions.

## Plugin Components
Use \`System.component\` with \`ComponentType.PLUGIN\` for reusable functionality.`,
  metadata: {
    path: 'docs/components.md',
    description: 'DSL component types documentation',
    tags: ['documentation', 'guide'],
    createdAt: Date.now(),
    author: 'system',
    version: '1.0.0'
  }
};

// Debug interface
interface DebugInfo {
  dbStats: {
    totalComponents: number;
    componentTypes: Record<string, number>;
    lastUpdated: Date;
  };
  queryInfo: {
    userQuery: string;
    receivedData: {
      documentation?: any;
      extensions?: any[];
      plugins?: any[];
      systemMeta?: any;
    };
    promptSent: string;
    llmResponse: string;
    validationStatus: {
      isValid: boolean;
      errors?: string[];
    };
    dbStoreStatus: {
      success: boolean;
      error?: string;
    };
    finalStats: {
      processingTime: number;
      tokenUsage?: number;
      componentsCreated: number;
    };
  };
}

interface DebugCallback {
  (info: Partial<DebugInfo['queryInfo']>): void;
}

interface RunDslEditorOptions {
  debug?: boolean;
  onDebug?: DebugCallback;
}

interface ChromaMetadata {
  name: string;
  type: string;
  description: string;
  path: string;
  tags: string;
  createdAt: string;
  updatedAt: string;
  version: string;
  author: string;
}

// Real embedding function that generates embeddings based on AST features
const realEmbeddingFunction = {
  generate: async (texts: string[]): Promise<number[][]> => {
    return texts.map(text => {
      try {
        // Create a deterministic but well-distributed embedding
        const embedding = new Array(1536).fill(0);
        const textBytes = new TextEncoder().encode(text);
        
        // Use a sliding window to generate values
        for (let i = 0; i < 1536; i++) {
          let value = 0;
          for (let j = 0; j < textBytes.length; j++) {
            // Use a combination of the byte value and position to generate embedding values
            value += Math.sin(textBytes[j] * (i + 1) / 1536);
          }
          // Normalize to [-1, 1]
          embedding[i] = Math.tanh(value);
        }
        return embedding;
      } catch (error) {
        // Fallback to random embedding
        return Array(1536).fill(0).map(() => Math.random() * 2 - 1);
      }
    });
  }
};

async function getComponentTypeStats(collection: any) {
  const allComponents = await collection.get();
  return allComponents.metadatas.reduce((acc: Record<string, number>, metadata: any) => {
    if (!metadata) return acc;
    const type = metadata.type as string;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
}

// Mock LLMService
vi.mock('../../src/llm/llm-service', () => {
  return {
    LLMService: vi.fn().mockImplementation(() => mockLLMService)
  };
});

describe('run-dsl-editor E2E', () => {
  let chromaConnector: ChromaDBConnector;
  let debugInfo: DebugInfo;

  beforeEach(async () => {
    logger.level = 'error'; // Reduce noise in tests
    chromaConnector = new ChromaDBConnector({
      collectionName: 'test-components',
      embeddingDimension: 1536,
      distance: 'cosine',
      url: 'http://localhost:8000'
    });
    
    await chromaConnector.initialize();
    await chromaConnector.deleteAllDocuments();

    // Seed with example components
    for (const component of exampleComponents) {
      await chromaConnector.addDocument(component);
    }
  });

  afterEach(async () => {
    // Clean up test data
    await chromaConnector.deleteAllDocuments();
  });

  it('should process component creation request with debug info', async () => {
    // Get initial database statistics
    const components = await chromaConnector.search('', { 
      limit: 100, 
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });
    const componentTypes = components.reduce((acc: Record<string, number>, result) => {
      const type = result.component.type;
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    console.log('\n=== Initial Database State ===');
    console.log(JSON.stringify({
      totalComponents: components.length,
      componentTypes,
      lastUpdated: new Date().toISOString()
    }, null, 2));

    // Process the request
    const result = await runDslEditor('Create a command component for user authentication', chromaConnector);
    expect(result).toBeDefined();
    
    if (!result.success) {
      // If the error is due to rate limiting, skip the test
      if (result.error?.includes('Rate limit exceeded')) {
        console.log('Skipping test due to rate limit:', result.error);
        return;
      }
      // For other errors, fail the test
      throw new Error(result.error || 'Unknown error occurred');
    }

    // Add logging to help debug search issues
    console.log('\n=== Searching for authentication component ===');
    const newComponents = await chromaConnector.search('authentication', { 
      limit: 10, 
      threshold: 0.1,
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });
    console.log('Found components:', JSON.stringify(newComponents.map(c => ({
      type: c.component.type,
      name: c.component.name,
      score: c.score,
      distance: c.distance
    })), null, 2));

    // Verify the component was created with proper context
    expect(newComponents.length).toBeGreaterThan(0);
    expect(newComponents[0].component.type).toBe('command');
    expect(newComponents[0].component.content).toContain('System.component');
    expect(newComponents[0].component.content).toContain('ComponentType.COMMAND');
  }, { timeout: 30000 });

  it('should filter components by tags', async () => {
    // Clear the database first to ensure clean state
    await chromaConnector.deleteAllDocuments();

    // Create a documentation component
    const docResult = await runDslEditor('Create a documentation component for API reference', chromaConnector);
    expect(docResult.success).toBe(true);

    // Create a schema component
    const schemaResult = await runDslEditor('Create a schema component named Order with id, total and status fields', chromaConnector);
    expect(schemaResult.success).toBe(true);

    // Search for components with 'documentation' tag
    const documentationComponents = await chromaConnector.search('', { 
      limit: 100, 
      threshold: 0.7, 
      tags: ['documentation'],
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });
    expect(documentationComponents.length).toBe(1);
    expect(documentationComponents[0].component.metadata.tags).toContain('documentation');

    // Search for components with 'schema' tag
    const schemaComponents = await chromaConnector.search('', { 
      limit: 100, 
      threshold: 0.7, 
      tags: ['schema'],
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });
    expect(schemaComponents.length).toBe(1);
    expect(schemaComponents[0].component.metadata.tags).toContain('schema');

    // Search for components with multiple tags
    const multiTagComponents = await chromaConnector.search('', { 
      limit: 100, 
      threshold: 0.7, 
      tags: ['schema', 'commerce'],
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });
    expect(multiTagComponents.length).toBe(1);
    expect(multiTagComponents[0].component.metadata.tags).toContain('schema');
    expect(multiTagComponents[0].component.metadata.tags).toContain('commerce');

    // Search for components with non-existent tag
    const nonExistentTagComponents = await chromaConnector.search('', { 
      limit: 100, 
      threshold: 0.7, 
      tags: ['non-existent'],
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });
    expect(nonExistentTagComponents.length).toBe(0);
  });

  it('should handle validation errors', async () => {
    const input = '';
    const result = await runDslEditor(input, chromaConnector);
    
    expect(result).toBeDefined();
    expect(result.success).toBe(false);
    expect(result.error).toBe('No command provided');
  });

  it('should create and retrieve a schema component', async () => {
    // 1. Clear the database first to ensure clean state
    await chromaConnector.deleteAllDocuments();
    
    // 2. Create a component with unique identifiable name
    const uniqueName = `UserProfile_${Date.now()}`;
    const input = `Create a schema component named ${uniqueName} with name, email and age fields`;
    
    // 3. Execute the command
    const result = await runDslEditor(input, chromaConnector);
    expect(result.success).toBe(true);
    
    // 4. Verify by direct retrieval method instead of search
    const allComponents = await getAllComponentsOfType(chromaConnector, ComponentType.SCHEMA);
    const created = allComponents.find(c => c.name.includes(uniqueName));
    
    expect(created).toBeDefined();
    if (!created) {
      throw new Error('Component was not created');
    }
    
    expect(created.type).toBe(ComponentType.SCHEMA);
    expect(created.content).toContain('name');
    expect(created.content).toContain('email');
  });

  it('should create a workflow component', async () => {
    const input = 'Create a workflow component for user registration process';
    const result = await runDslEditor(input, chromaConnector);
    
    expect(result).toBeDefined();
    
    if (!result.success) {
      // If the error is due to rate limiting, skip the test
      if (result.error?.message?.includes('Rate limit exceeded')) {
        console.log('Skipping test due to rate limit:', result.error.message);
        return;
      }
      // For other errors, fail the test
      throw result.error;
    }

    if (!result.success || !result.component) {
      throw new Error('Failed to create workflow component');
    }
    
    const component = result.component as Component;
    expect(component.type).toBe(ComponentType.WORKFLOW);
    expect(component.content).toContain('System.component');
    expect(component.content).toContain('ComponentType.WORKFLOW');
    expect(component.content).toContain('steps');
  }, { timeout: 30000 });

  it('should include proper metadata in created components', async () => {
    const input = 'Create a command component for user login';
    const result = await runDslEditor(input, chromaConnector);
    
    expect(result).toBeDefined();
    
    if (!result.success) {
      // If the error is due to rate limiting, skip the test
      if (result.error?.message?.includes('Rate limit exceeded')) {
        console.log('Skipping test due to rate limit:', result.error.message);
        return;
      }
      // For other errors, fail the test
      throw result.error;
    }

    if (!result.success || !result.component) {
      throw new Error('Failed to create command component');
    }
    
    const component = result.component as Component;
    expect(component.metadata).toBeDefined();
    expect(component.metadata.description).toBeDefined();
    expect(component.metadata.path).toBeDefined();
    expect(component.metadata.createdAt).toBeDefined();
    expect(component.metadata.tags).toBeDefined();
    expect(Array.isArray(component.metadata.tags)).toBe(true);
  }, { timeout: 30000 });

  // Helper function
  async function getAllComponentsOfType(
    connector: ChromaDBConnector, 
    type: ComponentType
  ): Promise<Component[]> {
    const results = await connector.search('', {
      limit: 1000,
      threshold: -1,
      types: [type],
      includeMetadata: true,
      includeEmbeddings: false,
      orderBy: 'relevance',
      orderDirection: 'desc'
    });
    
    return results.map(r => r.component);
  }
}); 