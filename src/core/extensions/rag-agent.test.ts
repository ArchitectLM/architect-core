import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineSystem } from '../system';
import { createRuntime } from '../runtime';
import { RAGAgentExtension, RAGAgentConfig } from './rag-agent';
import { ProcessSpec, TaskSpec, SystemSpec } from '../types';
import * as fs from 'fs';
import * as path from 'path';

// Mock LangChain and OpenAI
vi.mock('langchain/vectorstores/memory', () => ({
  Chroma: {
    fromDocuments: vi.fn().mockResolvedValue({
      asRetriever: vi.fn().mockReturnValue({
        getRelevantDocuments: vi.fn().mockResolvedValue([
          {
            pageContent: 'const orderProcess = Process.create("order-process")\n  .withDescription("Handles order processing")\n  .withInitialState("created")\n  .addState("created")\n  .addState("processing")\n  .addState("completed")\n  .addState("cancelled")\n  .addTransition({\n    from: "created",\n    to: "processing",\n    on: "START_PROCESSING"\n  })',
            metadata: { source: 'examples/order-processing.ts' }
          },
          {
            pageContent: 'const processOrderTask = Task.create("process-order")\n  .withDescription("Processes an order")\n  .withImplementation(async (input, context) => {\n    // Process the order\n    context.emitEvent("COMPLETE", { orderId: input.orderId });\n    return { processed: true };\n  })',
            metadata: { source: 'examples/order-processing.ts' }
          }
        ])
      }),
      similaritySearch: vi.fn().mockResolvedValue([
        {
          pageContent: 'const orderProcess = Process.create("order-process")\n  .withDescription("Handles order processing")\n  .withInitialState("created")\n  .addState("created")\n  .addState("processing")\n  .addState("completed")\n  .addState("cancelled")\n  .addTransition({\n    from: "created",\n    to: "processing",\n    on: "START_PROCESSING"\n  })',
          metadata: { source: 'examples/order-processing.ts' }
        },
        {
          pageContent: 'const processOrderTask = Task.create("process-order")\n  .withDescription("Processes an order")\n  .withImplementation(async (input, context) => {\n    // Process the order\n    context.emitEvent("COMPLETE", { orderId: input.orderId });\n    return { processed: true };\n  })',
          metadata: { source: 'examples/order-processing.ts' }
        }
      ])
    })
  }
}));

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedDocuments: vi.fn().mockResolvedValue([new Array(1536).fill(0.1)]),
    embedQuery: vi.fn().mockResolvedValue(new Array(1536).fill(0.1))
  })),
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: vi.fn().mockImplementation(async (messages) => {
      // Mock different responses based on the input
      if (messages.some(m => m.content.includes('OrderProcess'))) {
        return {
          content: JSON.stringify({
            id: 'order-process',
            description: 'Manages the lifecycle of customer orders',
            initialState: 'created',
            states: {
              created: { description: 'Order has been created' },
              paid: { description: 'Order has been paid' },
              shipped: { description: 'Order has been shipped' },
              delivered: { description: 'Order has been delivered' },
              cancelled: { description: 'Order has been cancelled' }
            },
            transitions: [
              { from: 'created', to: 'paid', on: 'PAYMENT_RECEIVED' },
              { from: 'paid', to: 'shipped', on: 'SHIP_ORDER' },
              { from: 'shipped', to: 'delivered', on: 'DELIVER_ORDER' },
              { from: ['created', 'paid'], to: 'cancelled', on: 'CANCEL_ORDER' }
            ]
          })
        };
      } else if (messages.some(m => m.content.includes('ProcessPayment'))) {
        return {
          content: JSON.stringify({
            id: 'process-payment',
            description: 'Processes a payment for an order',
            implementation: 'async (input, context) => { return { success: true, transactionId: "tx-123" }; }',
            inputSchema: { type: 'object', properties: { orderId: { type: 'string' }, amount: { type: 'number' } } },
            outputSchema: { type: 'object', properties: { success: { type: 'boolean' }, transactionId: { type: 'string' } } }
          })
        };
      } else {
        return {
          content: JSON.stringify({ id: 'mock-response', name: 'Mock Response' })
        };
      }
    })
  }))
}));

vi.mock('@langchain/core/messages', () => ({
  SystemMessage: vi.fn().mockImplementation((content) => ({ role: 'system', content })),
  HumanMessage: vi.fn().mockImplementation((content) => ({ role: 'human', content }))
}));

// Mock file system operations
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue('// Mock file content'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    readdir: vi.fn().mockResolvedValue(['file1.ts', 'file2.ts']),
    stat: vi.fn().mockResolvedValue({ isDirectory: () => false, isFile: () => true })
  },
  existsSync: vi.fn().mockReturnValue(true),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('// Mock file content')
}));

// Mock fs module
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue('mock file content'),
  readdir: vi.fn().mockResolvedValue(['file1.ts', 'file2.ts']),
  stat: vi.fn().mockResolvedValue({ isDirectory: () => false })
}));

// Mock path module
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  resolve: vi.fn((...args) => args.join('/')),
  basename: vi.fn((path) => path.split('/').pop()),
  extname: vi.fn((path) => '.ts')
}));

describe('RAGAgentExtension', () => {
  let agent: RAGAgentExtension;
  
  beforeEach(() => {
    // Create a new agent with test configuration
    const config: Partial<RAGAgentConfig> = {
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test-api-key',
      temperature: 0.5,
      codebasePath: './test',
      useInMemoryVectorStore: true
    };
    
    agent = new RAGAgentExtension(config);
    
    // Initialize the vectorStore for testing
    (agent as any).vectorStore = {
      similaritySearch: vi.fn().mockResolvedValue([
        {
          pageContent: 'const orderProcess = Process.create("order-process")',
          metadata: { source: 'examples/order-processing.ts' }
        }
      ])
    };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should initialize with default configuration', () => {
    const defaultAgent = new RAGAgentExtension();
    expect(defaultAgent).toBeDefined();
    expect(defaultAgent.name).toBe('rag-agent');
  });
  
  it('should initialize with custom configuration', () => {
    expect(agent).toBeDefined();
    expect(agent.name).toBe('rag-agent');
  });
  
  it('should initialize with runtime', async () => {
    const system = defineSystem({
      id: 'test-system',
      name: 'Test System',
      description: 'A test system',
      processes: {},
      tasks: {}
    });
    
    const runtime = createRuntime(system);
    
    // Mock the runtime.registerService method
    runtime.registerService = vi.fn();
    
    // Mock the indexCodebase method
    const indexCodebaseSpy = vi.spyOn(agent as any, 'indexCodebase').mockResolvedValue(undefined);
    
    await agent.initialize(runtime);
    
    expect(indexCodebaseSpy).toHaveBeenCalled();
    expect(runtime.registerService).toHaveBeenCalledWith('rag-agent', agent);
  });
  
  it('should generate a process definition', async () => {
    // Mock the retrieveRelevantExamples method
    vi.spyOn(agent as any, 'retrieveRelevantExamples').mockResolvedValue([
      {
        pageContent: 'const orderProcess = Process.create("order-process")',
        metadata: { source: 'examples/order-processing.ts' }
      }
    ]);
    
    // Mock the llm.invoke method
    vi.spyOn(agent as any, 'llm', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          id: 'test-process',
          name: 'Test Process',
          description: 'A test process',
          initialState: 'initial',
          states: {
            initial: { description: 'Initial state' },
            final: { description: 'Final state' }
          },
          transitions: [
            { from: 'initial', to: 'final', on: 'COMPLETE' }
          ]
        })
      })
    });
    
    const processSpec = {
      name: 'Test Process',
      description: 'A test process',
      states: ['initial', 'final'],
      events: ['COMPLETE']
    };
    
    const result = await agent.generateProcess(processSpec);
    
    expect(result).toBeDefined();
    expect(result.id).toBe('test-process');
    expect(result.name).toBe('Test Process');
    expect(result.states).toBeDefined();
    expect(Object.keys(result.states).length).toBe(2);
  });
  
  it('should generate a task definition', async () => {
    // Mock the retrieveRelevantExamples method
    vi.spyOn(agent as any, 'retrieveRelevantExamples').mockResolvedValue([
      {
        pageContent: 'const processOrderTask = Task.create("process-order")',
        metadata: { source: 'examples/order-processing.ts' }
      }
    ]);
    
    // Mock the llm.invoke method
    vi.spyOn(agent as any, 'llm', 'get').mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          id: 'test-task',
          name: 'Test Task',
          description: 'A test task',
          implementation: 'async (input, context) => { return { success: true }; }'
        })
      })
    });
    
    const taskSpec = {
      name: 'Test Task',
      description: 'A test task',
      input: { type: 'object' },
      output: { type: 'object' }
    };
    
    const result = await agent.generateTask(taskSpec);
    
    expect(result).toBeDefined();
    expect(result.id).toBe('test-task');
    expect(result.name).toBe('Test Task');
    expect(result.implementation).toBeDefined();
  });
  
  it('should retrieve relevant examples', async () => {
    const spec = {
      name: 'Test Process',
      description: 'A test process'
    };
    
    const result = await agent['retrieveRelevantExamples'](spec, 'process');
    
    expect(result).toBeDefined();
    expect(result.length).toBe(1);
    expect(result[0].metadata.source).toBe('examples/order-processing.ts');
  });
  
  it('should handle errors when retrieving examples', async () => {
    // Override the vectorStore mock to throw an error
    (agent as any).vectorStore.similaritySearch = vi.fn().mockRejectedValue(new Error('Test error'));
    
    const spec = {
      name: 'Test Process',
      description: 'A test process'
    };
    
    const result = await agent['retrieveRelevantExamples'](spec, 'process');
    
    expect(result).toBeDefined();
    expect(result.length).toBe(0);
  });
  
  it('should create an enhanced prompt with examples', async () => {
    const spec = {
      name: 'Test Process',
      description: 'A test process'
    };
    
    const examples = [
      {
        pageContent: 'const orderProcess = Process.create("order-process")',
        metadata: { source: 'examples/order-processing.ts' }
      }
    ];
    
    const result = await agent['createEnhancedPrompt'](spec, 'process', examples);
    
    expect(result).toBeDefined();
    expect(result).toContain('Test Process');
    expect(result).toContain('examples/order-processing.ts');
  });
}); 