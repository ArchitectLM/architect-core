/**
 * RAG-Enhanced Agent Example
 * 
 * This example demonstrates how to use the RAG-enhanced agent to generate
 * processes, tasks, and systems with context from the codebase.
 */

import { System, Process, Task, createRuntime } from '../src';
import { createRAGAgent, RAGAgentConfig, RAGAgentExtension } from '../src/core/extensions/rag-agent';
import { ProcessSpec, TaskSpec, SystemSpec, SystemFeedback, ValidationResult, TestResult, StaticAnalysisResult } from '../src/core/types';

// Define simplified specs for our examples
interface SimpleProcessSpec {
  name: string;
  description: string;
  states: string[];
  events: string[];
  domainConcepts: string[];
  businessRules: string[];
}

interface SimpleTaskSpec {
  name: string;
  description: string;
  input: Record<string, string>;
  output: Record<string, string>;
}

interface SimpleSystemSpec {
  name: string;
  description: string;
  components: string[];
  integrations: string[];
}

// Patch the RAGAgentExtension initialize method to work without registerService
const originalInitialize = RAGAgentExtension.prototype.initialize;
RAGAgentExtension.prototype.initialize = async function(runtime: any): Promise<void> {
  this.runtime = runtime;
  
  // Skip the registerService call if it doesn't exist
  if (typeof runtime.registerService === 'function') {
    runtime.registerService('rag-agent', this);
  } else {
    console.log('Note: runtime.registerService is not available, skipping service registration');
  }
  
  // Index the codebase
  await this.indexCodebase();
  
  console.log(`RAG Agent extension initialized with provider: ${this.config.provider}, model: ${this.config.model}`);
};

async function main() {
  console.log('Starting RAG-Enhanced Agent Example...');
  
  // Initialize the RAG agent with configuration
  const config: Partial<RAGAgentConfig> = {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: process.env.OPENAI_API_KEY || '',
    temperature: 0.7,
    codebasePath: './src',
    useInMemoryVectorStore: true
  };
  
  // Create the RAG agent
  const ragAgent = createRAGAgent(config);
  
  // Create a simple system
  const systemConfig = System.create('example-system')
    .withName('Example System')
    .withDescription('A system for demonstrating RAG-enhanced agent capabilities')
    .build();
  
  // Initialize the runtime and the agent
  const runtime = createRuntime(systemConfig);
  await ragAgent.initialize(runtime);
  
  console.log('\n--- Example: Generate a Process Definition ---');
  // Example 1: Generate a process definition
  const orderProcessSpec: SimpleProcessSpec = {
    name: 'OrderProcess',
    description: 'Manages orders from creation to fulfillment',
    states: ['created', 'processing', 'shipped', 'delivered', 'cancelled'],
    events: ['CREATE_ORDER', 'PROCESS_ORDER', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER'],
    domainConcepts: ['Order', 'Customer', 'Product', 'Payment'],
    businessRules: [
      'Orders must be paid before processing',
      'Cancelled orders cannot be shipped',
      'Delivered orders cannot be cancelled'
    ]
  };
  
  console.log('Generating process definition...');
  try {
    const orderProcess = await ragAgent.generateProcess(orderProcessSpec as unknown as ProcessSpec);
    console.log('Generated Process:', JSON.stringify(orderProcess, null, 2));
  } catch (error) {
    console.error('Error generating process:', error);
  }
  
  console.log('\n--- Example: Generate a Task Definition ---');
  // Example 2: Generate a task definition
  const processOrderSpec: SimpleTaskSpec = {
    name: 'ProcessOrder',
    description: 'Processes an order for shipment',
    input: {
      orderId: 'string',
      customerId: 'string',
      items: 'array',
      paymentStatus: 'string'
    },
    output: {
      success: 'boolean',
      processedAt: 'string',
      estimatedShippingDate: 'string'
    }
  };
  
  console.log('Generating task definition...');
  try {
    const processOrderTask = await ragAgent.generateTask(processOrderSpec as unknown as TaskSpec);
    console.log('Generated Task:', JSON.stringify(processOrderTask, null, 2));
  } catch (error) {
    console.error('Error generating task:', error);
  }
  
  console.log('\n--- Example: Generate a System Definition ---');
  // Example 3: Generate a system definition
  const ecommerceSystemSpec: SimpleSystemSpec = {
    name: 'EcommerceSystem',
    description: 'An e-commerce system for managing products, orders, and customers',
    components: ['OrderManagement', 'ProductCatalog', 'CustomerManagement', 'PaymentProcessing'],
    integrations: ['InventorySystem', 'ShippingProvider', 'PaymentGateway']
  };
  
  // Convert to the expected SystemSpec format
  const fullSystemSpec: SystemSpec = {
    name: ecommerceSystemSpec.name,
    description: ecommerceSystemSpec.description,
    processes: [],
    tasks: []
  };
  
  console.log('Generating system definition...');
  try {
    const ecommerceSystem = await ragAgent.generateSystem(fullSystemSpec);
    console.log('Generated System:', JSON.stringify(ecommerceSystem, null, 2));
  } catch (error) {
    console.error('Error generating system:', error);
  }
  
  console.log('\n--- Example: Generate Tests ---');
  // Example 4: Generate tests for the process
  console.log('Generating tests...');
  try {
    // Create a process definition object that matches the expected type
    const processDefinition = await ragAgent.generateProcess(orderProcessSpec as unknown as ProcessSpec);
    const tests = await ragAgent.generateTests(processDefinition);
    console.log('Generated Tests:', JSON.stringify(tests, null, 2));
  } catch (error) {
    console.error('Error generating tests:', error);
  }
  
  console.log('\n--- Example: Generate Documentation ---');
  // Example 5: Generate documentation
  console.log('Generating documentation...');
  try {
    // Create a process definition object that matches the expected type
    const processDefinition = await ragAgent.generateProcess(orderProcessSpec as unknown as ProcessSpec);
    const docs = await ragAgent.generateDocs(processDefinition);
    console.log('Generated Documentation:', docs);
  } catch (error) {
    console.error('Error generating documentation:', error);
  }
  
  console.log('\n--- Example: Analyze Feedback ---');
  // Example 6: Analyze feedback
  const feedback: SystemFeedback = {
    validation: [
      {
        component: 'OrderProcess',
        valid: false,
        errors: ['The process does not handle partial shipments. We need to add support for splitting orders into multiple shipments.']
      }
    ] as ValidationResult[],
    tests: [] as TestResult[],
    staticAnalysis: [] as StaticAnalysisResult[]
  };
  
  console.log('Analyzing feedback...');
  try {
    const analysis = await ragAgent.analyzeFeedback(feedback);
    console.log('Feedback Analysis:', JSON.stringify(analysis, null, 2));
  } catch (error) {
    console.error('Error analyzing feedback:', error);
  }
  
  console.log('\n--- Example Complete ---');
}

// Run the example
if (require.main === module) {
  main().catch(error => {
    console.error('Error in RAG agent example:', error);
    process.exit(1);
  });
}

export default main; 