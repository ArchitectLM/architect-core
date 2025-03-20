import { ChromaDBConnector } from '../vector-db/chroma-connector.js';
import { VectorDBConfig, Component as RagComponent } from '../models.js';
import { 
  ComponentValidatorFactory, 
  ComponentType as DslComponentType, 
  Component as DslComponent 
} from '@architectlm/dsl';
import { 
  createExtensionSystem, 
  DefaultExtensionSystem,
  ExtensionPoint 
} from '@architectlm/extensions';
import { bulkheadExtension } from '../extensions/bulkhead.js';
import { ComponentType } from '../models';

// Initialize extension system
const extensionSystem = createExtensionSystem();

// Register necessary extension points first
const extensionPoints: ExtensionPoint[] = [
  {
    name: 'bulkhead.create',
    description: 'Called when creating a new bulkhead',
    handlers: []
  },
  {
    name: 'bulkhead.execute',
    description: 'Called when executing through a bulkhead',
    handlers: []
  },
  {
    name: 'bulkhead.rejected',
    description: 'Called when a request is rejected by the bulkhead',
    handlers: []
  },
  {
    name: 'bulkhead.configure',
    description: 'Called when configuring a bulkhead',
    handlers: []
  }
];

// Register all extension points first
extensionPoints.forEach(point => {
  try {
    extensionSystem.registerExtensionPoint(point);
    console.log(`Registered extension point: ${point.name}`);
  } catch (error) {
    console.error(`Failed to register extension point ${point.name}:`, error);
  }
});

// Then register the bulkhead extension
try {
  extensionSystem.registerExtension(bulkheadExtension);
  console.log('Registered bulkhead extension');
} catch (error) {
  console.error('Failed to register bulkhead extension:', error);
  // Continue with seeding even if extension registration fails
}

/**
 * Map RAG component type to DSL component type
 */
function mapComponentType(type: string): DslComponentType {
  switch (type) {
    case 'schema':
      return DslComponentType.SCHEMA;
    case 'command':
      return DslComponentType.COMMAND;
    case 'query':
      return DslComponentType.QUERY;
    case 'event':
      return DslComponentType.EVENT;
    case 'workflow':
      return DslComponentType.WORKFLOW;
    case 'extension':
      return DslComponentType.EXTENSION;
    case 'plugin':
      return DslComponentType.PLUGIN;
    default:
      throw new Error(`Unsupported component type: ${type}`);
  }
}

/**
 * Map RAG component to DSL component
 */
function mapToDslComponent(ragComponent: RagComponent): DslComponent {
  const type = mapComponentType(ragComponent.type);
  
  // Create base component properties
  const baseProps = {
    type,
    name: ragComponent.name,
    description: ragComponent.metadata.description,
    version: ragComponent.metadata.version,
    tags: ragComponent.metadata.tags,
    authors: ragComponent.metadata.author ? [ragComponent.metadata.author] : undefined,
    path: ragComponent.metadata.path,
  };

  // Create type-specific component
  switch (type) {
    case DslComponentType.SCHEMA:
      return {
        ...baseProps,
        definition: {
          type: 'object',
          properties: {},
          required: [],
        },
      } as DslComponent;

    case DslComponentType.COMMAND:
      return {
        ...baseProps,
        input: { ref: '', required: true },
        output: { ref: '', required: true },
        definition: {},
      } as DslComponent;

    case DslComponentType.QUERY:
      return {
        ...baseProps,
        input: { ref: '', required: true },
        output: { ref: '', required: true },
        definition: {},
      } as DslComponent;

    case DslComponentType.EVENT:
      return {
        ...baseProps,
        payload: { ref: '', required: true },
        definition: {},
      } as DslComponent;

    case DslComponentType.WORKFLOW:
      return {
        ...baseProps,
        steps: [],
        definition: {},
      } as DslComponent;

    case DslComponentType.EXTENSION:
      return {
        ...baseProps,
        hooks: {},
        definition: {},
      } as DslComponent;

    case DslComponentType.PLUGIN:
      return {
        ...baseProps,
        operations: [],
        definition: {},
      } as DslComponent;

    default:
      throw new Error(`Unsupported component type: ${type}`);
  }
}

async function seedDSLExamples() {
  try {
    console.log('Initializing ChromaDB for DSL examples...');
    
    const config: VectorDBConfig = {
      collectionName: 'dsl-components',
      embeddingDimension: 384,
      distance: 'cosine',
    };
    
    const chroma = new ChromaDBConnector(config);
    await chroma.initialize();
    console.log('ChromaDB initialized successfully');

    // Delete existing documents
    try {
      await chroma.deleteAllDocuments();
      console.log('Cleared existing documents');
    } catch (error) {
      console.log('No existing documents to delete or error during deletion:', error);
      // Continue with seeding even if deletion fails
    }

    console.log("Seeding DSL examples...\n");

    // Add schema component
    const orderSchema = {
      type: 'schema',
      name: "Order",
      content: `System.component('Order', {
  type: ComponentType.Schema,
  description: 'Represents a customer order',
  properties: {
    id: { type: 'string', required: true },
    customerId: { type: 'string', required: true },
    items: { type: 'array', items: { type: 'object' }, required: true },
    total: { type: 'number', required: true },
    status: { type: 'string', enum: ['pending', 'processing', 'completed', 'cancelled'] }
  }
})`,
      metadata: {
        path: "examples/schemas/Order.ts",
        description: "Order schema definition with validation rules",
        tags: ["schema", "order", "validation"]
      }
    };

    const orderSchemaId = await chroma.addDocument(orderSchema);
    console.log(`Added schema component: Order`);
    console.log(`Added with ID: ${orderSchemaId}`);
    console.log("Successfully verified document:");
    console.log(`- Name: ${orderSchema.name}`);
    console.log(`- Type: ${orderSchema.type}`);
    console.log(`- Path: ${orderSchema.metadata?.path || 'N/A'}`);
    console.log(`- Description: ${orderSchema.metadata?.description || 'N/A'}\n`);

    // Add command component
    const createOrderCommand = {
      type: 'command',
      name: "CreateOrder",
      content: `System.component('CreateOrder', {
  type: ComponentType.Command,
  description: 'Creates a new order',
  schema: 'Order',
  handler: async (order) => {
    // Validate order
    // Save to database
    // Return created order
  }
})`,
      metadata: {
        path: "examples/commands/CreateOrder.ts",
        description: "Command to create a new order",
        tags: ["command", "order", "create"]
      }
    };

    const createOrderId = await chroma.addDocument(createOrderCommand);
    console.log(`Added command component: CreateOrder`);
    console.log(`Added with ID: ${createOrderId}`);
    console.log("Successfully verified document:");
    console.log(`- Name: ${createOrderCommand.name}`);
    console.log(`- Type: ${createOrderCommand.type}`);
    console.log(`- Path: ${createOrderCommand.metadata?.path || 'N/A'}`);
    console.log(`- Description: ${createOrderCommand.metadata?.description || 'N/A'}\n`);

    // Add event component
    const orderCreatedEvent = {
      type: 'event',
      name: "OrderCreated",
      content: `System.component('OrderCreated', {
  type: ComponentType.Event,
  description: 'Event emitted when an order is created',
  schema: 'Order',
  handler: async (order) => {
    // Send notifications
    // Update analytics
  }
})`,
      metadata: {
        path: "examples/events/OrderCreated.ts",
        description: "Event emitted when an order is created",
        tags: ["event", "order", "created"]
      }
    };

    const orderCreatedId = await chroma.addDocument(orderCreatedEvent);
    console.log(`Added event component: OrderCreated`);
    console.log(`Added with ID: ${orderCreatedId}`);
    console.log("Successfully verified document:");
    console.log(`- Name: ${orderCreatedEvent.name}`);
    console.log(`- Type: ${orderCreatedEvent.type}`);
    console.log(`- Path: ${orderCreatedEvent.metadata?.path || 'N/A'}`);
    console.log(`- Description: ${orderCreatedEvent.metadata?.description || 'N/A'}\n`);

    // Add query component
    const getOrderQuery = {
      type: 'query',
      name: "GetOrder",
      content: `System.component('GetOrder', {
  type: ComponentType.Query,
  description: 'Retrieves an order by ID',
  schema: 'Order',
  handler: async (id) => {
    // Fetch from database
    // Return order
  }
})`,
      metadata: {
        path: "examples/queries/GetOrder.ts",
        description: "Query to retrieve an order by ID",
        tags: ["query", "order", "get"]
      }
    };

    const getOrderId = await chroma.addDocument(getOrderQuery);
    console.log(`Added query component: GetOrder`);
    console.log(`Added with ID: ${getOrderId}`);
    console.log("Successfully verified document:");
    console.log(`- Name: ${getOrderQuery.name}`);
    console.log(`- Type: ${getOrderQuery.type}`);
    console.log(`- Path: ${getOrderQuery.metadata?.path || 'N/A'}`);
    console.log(`- Description: ${getOrderQuery.metadata?.description || 'N/A'}\n`);

    // Add workflow component
    const orderProcessingWorkflow = {
      type: 'workflow',
      name: "OrderProcessingWorkflow",
      content: `System.component('OrderProcessingWorkflow', {
    type: ComponentType.WORKFLOW,
    description: 'Workflow for processing orders',
    // ... rest of the content ...
  })`,
      metadata: {
        path: "examples/workflows/OrderProcessingWorkflow.ts",
        description: "Workflow for processing orders",
        tags: ["workflow", "order", "processing"]
      }
    };

    const orderProcessingId = await chroma.addDocument(orderProcessingWorkflow);
    console.log(`Added workflow component: OrderProcessingWorkflow`);

    // Log component details
    console.log(`- Name: ${orderProcessingWorkflow.name}`);
    console.log(`- Type: ${orderProcessingWorkflow.type}`);
    console.log(`- Path: ${orderProcessingWorkflow.metadata?.path || 'N/A'}`);
    console.log(`- Description: ${orderProcessingWorkflow.metadata?.description || 'N/A'}\n`);

    console.log("DSL examples seeded successfully");
  } catch (error) {
    console.error("Error seeding DSL examples:", error);
    throw error;
  }
}

// Run the seeding script
seedDSLExamples().catch(console.error); 