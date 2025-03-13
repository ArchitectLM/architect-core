/**
 * Agent Mode Example
 * 
 * This example demonstrates how to use the ArchitectLM Agent to generate
 * processes, tasks, and systems using AI.
 */

import { System, Process, Task, Test, createRuntime } from '../src';
import { createAgent, AgentConfig } from '../src/core/extensions/agent';

async function main() {
  console.log('ArchitectLM Agent Example');
  console.log('------------------------\n');

  // Create an agent with OpenAI configuration
  // Note: You need to provide your own API key
  const agentConfig: AgentConfig = {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
    temperature: 0.7
  };

  const agent = createAgent(agentConfig);

  // Initialize the agent (this would normally be done by the runtime)
  // Create a simple system for the runtime
  const system = System.create('example-system')
    .withName('Example System')
    .withDescription('A system for demonstrating the agent mode')
    .build();
    
  const runtime = createRuntime(system);

  await agent.initialize(runtime);

  console.log('Agent initialized successfully');

  try {
    // Example 1: Generate a process definition
    console.log('\n1. Generating a process definition...');
    const processSpec = {
      name: 'OrderProcess',
      description: 'Manages the lifecycle of customer orders',
      states: ['created', 'paid', 'shipped', 'delivered', 'cancelled'],
      events: ['CREATE_ORDER', 'PAYMENT_RECEIVED', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER'],
      domainConcepts: ['Order', 'Payment', 'Shipping', 'Customer'],
      businessRules: [
        'Orders must be paid before shipping',
        'Cancelled orders cannot be shipped',
        'Delivered orders cannot be cancelled'
      ]
    };

    const processDefinition = await agent.generateProcess(processSpec);
    console.log('Process generated successfully:');
    console.log(JSON.stringify(processDefinition, null, 2));

    // Example 2: Generate a task definition
    console.log('\n2. Generating a task definition...');
    const taskSpec = {
      name: 'ProcessPayment',
      description: 'Processes a payment for an order',
      input: {
        orderId: 'string',
        amount: 'number',
        paymentMethod: 'string'
      },
      output: {
        success: 'boolean',
        transactionId: 'string',
        message: 'string'
      },
      dependencies: ['PaymentService']
    };

    const taskDefinition = await agent.generateTask(taskSpec);
    console.log('Task generated successfully:');
    console.log(JSON.stringify(taskDefinition, null, 2));

    // Example 3: Generate a system configuration
    console.log('\n3. Generating a system configuration...');
    const systemSpec = {
      name: 'E-commerce System',
      description: 'A system for managing e-commerce operations',
      processes: [
        {
          name: 'OrderProcess',
          description: 'Manages the lifecycle of customer orders',
          states: ['created', 'paid', 'shipped', 'delivered', 'cancelled']
        },
        {
          name: 'InventoryProcess',
          description: 'Manages inventory levels',
          states: ['in-stock', 'low-stock', 'out-of-stock', 'restocking']
        }
      ],
      tasks: [
        {
          name: 'ProcessPayment',
          description: 'Processes a payment for an order'
        },
        {
          name: 'UpdateInventory',
          description: 'Updates inventory levels after an order'
        }
      ]
    };

    const systemConfig = await agent.generateSystem(systemSpec);
    console.log('System generated successfully:');
    console.log(JSON.stringify(systemConfig, null, 2));

    // Example 4: Generate tests for a component
    console.log('\n4. Generating tests for a component...');
    const tests = await agent.generateTests(processDefinition);
    console.log('Tests generated successfully:');
    console.log(JSON.stringify(tests, null, 2));

    // Example 5: Generate documentation for a component
    console.log('\n5. Generating documentation for a component...');
    const docs = await agent.generateDocs(processDefinition);
    console.log('Documentation generated successfully:');
    console.log(docs);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
main().catch(console.error); 