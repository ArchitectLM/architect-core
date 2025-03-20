import { ChromaDBConnector } from '../vector-db/chroma-connector.js';
import { VectorDBConfig, Component as RagComponent, ComponentType as RagComponentType } from '../models.js';
import { ComponentValidatorFactory, ComponentType as DslComponentType, Component as DslComponent } from '@architectlm/dsl';

/**
 * Map RAG component type to DSL component type
 */
function mapComponentType(type: RagComponentType): DslComponentType {
  switch (type) {
    case RagComponentType.Schema:
      return DslComponentType.SCHEMA;
    case RagComponentType.Command:
      return DslComponentType.COMMAND;
    case RagComponentType.Query:
      return DslComponentType.QUERY;
    case RagComponentType.Event:
      return DslComponentType.EVENT;
    case RagComponentType.Pipeline:
      return DslComponentType.WORKFLOW;
    case RagComponentType.Extension:
      return DslComponentType.EXTENSION;
    case RagComponentType.Function:
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
        operations: [
          {
            name: ragComponent.name,
            description: ragComponent.metadata.description || 'No description provided',
            input: { ref: '', required: true },
            output: { ref: '', required: true }
          }
        ],
        definition: {},
      } as DslComponent;

    default:
      throw new Error(`Unsupported component type: ${type}`);
  }
}

async function seedChromaDB() {
  try {
    console.log('Initializing ChromaDB...');
    
    const config: VectorDBConfig = {
      collectionName: 'dsl-components',
      embeddingDimension: 384,
      distance: 'cosine',
    };
    
    const chromaConnector = new ChromaDBConnector(config);
    await chromaConnector.initialize();
    console.log('ChromaDB initialized successfully');

    // Delete all existing documents
    console.log('\nDeleting existing documents...');
    try {
      await chromaConnector.deleteAllDocuments();
      console.log('All existing documents deleted');
    } catch (error) {
      console.log('No existing documents to delete');
    }

    // Example components to seed
    const examples: RagComponent[] = [
      {
        id: 'validate-order',
        name: 'validateOrder',
        type: RagComponentType.Function,
        content: `
function validateOrder(order: Order): ValidationResult {
  const errors: string[] = [];
  
  // Validate items
  if (!order.items || order.items.length === 0) {
    errors.push('Order must have at least one item');
  }
  
  // Validate customer info
  if (!order.customerInfo) {
    errors.push('Customer information is required');
  } else {
    if (!order.customerInfo.email) {
      errors.push('Customer email is required');
    }
    if (!order.customerInfo.shippingAddress) {
      errors.push('Shipping address is required');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}`,
        metadata: {
          path: 'src/functions/validateOrder.ts',
          description: 'Validates an order before processing',
          createdAt: Date.now(),
          author: 'system',
          tags: ['validation', 'order', 'ecommerce']
        }
      },
      {
        id: 'process-payment',
        name: 'processPayment',
        type: RagComponentType.Function,
        content: `
async function processPayment(order: Order, paymentInfo: PaymentInfo): Promise<PaymentResult> {
  try {
    // Calculate total with discounts
    const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const finalTotal = applyDiscounts(total, order.discounts);
    
    // Process payment with payment provider
    const paymentResult = await paymentProvider.processPayment({
      amount: finalTotal,
      currency: order.currency,
      paymentMethod: paymentInfo.method,
      paymentDetails: paymentInfo.details
    });
    
    return {
      success: true,
      transactionId: paymentResult.id,
      amount: finalTotal
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}`,
        metadata: {
          path: 'src/functions/processPayment.ts',
          description: 'Processes payment for an order with support for multiple payment methods',
          createdAt: Date.now(),
          author: 'system',
          tags: ['payment', 'order', 'ecommerce']
        }
      },
      {
        id: 'order-schema',
        name: 'OrderSchema',
        type: RagComponentType.Schema,
        content: `
interface Order {
  id: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  customerInfo: {
    email: string;
    shippingAddress: Address;
    billingAddress?: Address;
  };
  discounts?: Array<{
    code: string;
    amount: number;
    type: 'percentage' | 'fixed';
  }>;
  currency: string;
  status: 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: number;
  updatedAt: number;
}`,
        metadata: {
          path: 'src/schemas/Order.ts',
          description: 'Defines the structure of an order in the e-commerce system',
          createdAt: Date.now(),
          author: 'system',
          tags: ['schema', 'order', 'ecommerce']
        }
      }
    ];

    // Add examples to ChromaDB
    console.log('\nSeeding ChromaDB with examples...');
    const validator = new ComponentValidatorFactory();
    
    for (const example of examples) {
      console.log(`\nAdding ${example.type} component: ${example.name}`);
      
      // Map to DSL component for validation
      const dslComponent = mapToDslComponent(example);
      const result = validator.getValidator(dslComponent.type)?.validate(dslComponent);
      
      if (!result?.isValid) {
        console.log(`Skipping invalid component ${example.name}:`, result?.errors);
        continue;
      }
      
      const id = await chromaConnector.addDocument(example);
      console.log(`Added with ID: ${id}`);
      
      // Verify the document was added
      const component = await chromaConnector.getDocument(id);
      if (component) {
        console.log('Successfully verified document:');
        console.log('- Name:', component.name);
        console.log('- Type:', component.type);
        console.log('- Path:', component.metadata?.path || 'N/A');
        console.log('- Description:', component.metadata?.description || 'N/A');
      } else {
        console.log('Failed to verify document!');
      }
    }
    console.log('\nChromaDB seeded successfully');

  } catch (error) {
    console.error('Error seeding ChromaDB:', error);
    process.exit(1);
  }
}

// Run the seeding script
seedChromaDB().catch(console.error); 