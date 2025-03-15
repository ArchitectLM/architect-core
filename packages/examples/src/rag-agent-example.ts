/**
 * RAG-Enhanced Agent Example with ts-morph
 * 
 * This example demonstrates how to use the RAG-Enhanced Agent extension
 * with ts-morph for safer code extraction and processing.
 */

import { createRAGAgent, RAGAgentConfig } from '../src/core/extensions/rag-agent';
import { createRuntime } from '../src/core/implementations/runtime';

/**
 * Main function to run the example
 */
async function main() {
  console.log('--- RAG-Enhanced Agent Example with ts-morph ---');
  
  // Create a configuration for the RAG agent
  const config: Partial<RAGAgentConfig> = {
    provider: 'openrouter',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    apiKey: process.env.OPENROUTER_API_KEY || '',
    baseUrl: 'https://openrouter.ai/api/v1',
    temperature: 0.7,
    maxTokens: 4000,
    codebasePath: './src',
    useInMemoryVectorStore: true,
    debug: true,
    systemPrompt: `You are an expert TypeScript developer specializing in the ArchitectLM framework.
Your task is to generate code using the ArchitectLM DSL.

When generating code:
1. DO NOT use import statements
2. DO NOT wrap your code in markdown code blocks
3. ONLY return the exact code that defines the requested component
4. Use the ReactiveSystem.Process.create() and ReactiveSystem.Task.create() methods directly
5. Follow the examples provided exactly

Your code should be ready to run with minimal modifications.`
  };
  
  // Create the RAG agent
  const ragAgent = createRAGAgent(config);
  
  // Create a runtime
  const runtime = createRuntime({}, {}, {});
  
  // Initialize the RAG agent
  await ragAgent.initialize(runtime);
  
  console.log('RAG-Enhanced Agent started and indexed the codebase');
  
  // Example: Generate a Process Definition
  console.log('\n--- Example: Generate a Process Definition ---');
  console.log('Generating process...');
  
  try {
    const processSpec = {
      name: 'OrderProcess',
      description: 'Manages orders from creation to fulfillment',
      domainConcepts: ['Order', 'Customer', 'Product', 'Payment'],
      businessRules: [
        'Orders must be paid before processing',
        'Cancelled orders cannot be shipped',
        'Delivered orders cannot be cancelled'
      ],
      states: ['created', 'processing', 'shipped', 'delivered', 'cancelled'],
      events: ['CREATE_ORDER', 'PROCESS_ORDER', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER']
    };
    
    const processDefinition = await ragAgent.generateProcess(processSpec);
    console.log(JSON.stringify(processDefinition, null, 2));
  } catch (error) {
    console.error('Error generating process:', error);
  }
  
  // Example: Generate a Task Definition
  console.log('\n--- Example: Generate a Task Definition ---');
  console.log('Generating task definition...');
  
  try {
    const taskSpec = {
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
    
    const taskDefinition = await ragAgent.generateTask(taskSpec);
    console.log(JSON.stringify(taskDefinition, null, 2));
  } catch (error) {
    console.error('Error generating task:', error);
  }
  
  // Example: Generate a System Definition
  console.log('\n--- Example: Generate a System Definition ---');
  console.log('Generating system definition...');
  
  try {
    const systemSpec = {
      name: 'EcommerceSystem',
      description: 'An e-commerce system for managing products, orders, and customers',
      processes: [],
      tasks: []
    };
    
    const systemDefinition = await ragAgent.generateSystem(systemSpec);
    console.log(JSON.stringify(systemDefinition, null, 2));
  } catch (error) {
    console.error('Error generating system:', error);
  }
  
  // Example: Generate Tests
  console.log('\n--- Example: Generate Tests ---');
  console.log('Generating tests...');
  
  try {
    // Use the process definition we generated earlier
    const processSpec = {
      name: 'OrderProcess',
      description: 'Manages orders from creation to fulfillment',
      states: ['created', 'processing', 'shipped', 'delivered', 'cancelled'],
      events: ['CREATE_ORDER', 'PROCESS_ORDER', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER']
    };
    
    const processDefinition = await ragAgent.generateProcess(processSpec);
    const tests = await ragAgent.generateTests(processDefinition);
    console.log(JSON.stringify(tests, null, 2));
  } catch (error) {
    console.error('Error generating tests:', error);
  }
  
  // Example: Generate Documentation
  console.log('\n--- Example: Generate Documentation ---');
  console.log('Generating documentation...');
  
  try {
    // Use the process definition we generated earlier
    const processSpec = {
      name: 'OrderProcess',
      description: 'Manages orders from creation to fulfillment',
      states: ['created', 'processing', 'shipped', 'delivered', 'cancelled'],
      events: ['CREATE_ORDER', 'PROCESS_ORDER', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER']
    };
    
    const processDefinition = await ragAgent.generateProcess(processSpec);
    const docs = await ragAgent.generateDocs(processDefinition);
    console.log(docs);
  } catch (error) {
    console.error('Error generating documentation:', error);
  }
  
  // Example: Analyze Feedback
  console.log('\n--- Example: Analyze Feedback ---');
  console.log('Analyzing feedback...');
  
  try {
    const feedback = {
      validation: [
        {
          component: 'OrderProcess',
          valid: false,
          errors: [
            'The process does not handle partial shipments. We need to add support for splitting orders into multiple shipments.'
          ]
        }
      ],
      tests: [],
      staticAnalysis: []
    };
    
    const fixes = await ragAgent.analyzeFeedback(feedback);
    console.log(JSON.stringify(fixes, null, 2));
  } catch (error) {
    console.error('Error analyzing feedback:', error);
  }
  
  console.log('\n--- Example Complete ---');
}

// Run the example
main().catch(error => {
  console.error('Error running example:', error);
  process.exit(1);
}); 