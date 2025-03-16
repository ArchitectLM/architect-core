/**
 * Tests for RAG-Enhanced Agent Extension with ts-morph implementation
 * Using TDD/BDD approach
 */

import { RAGAgentExtension, RAGAgentConfig } from '../../../src/core/extensions/rag-agent';
import { ProcessDefinition, TaskDefinition } from '../../../src/core/types';

// Mock the fetch function
global.fetch = jest.fn();

describe('RAGAgentExtension with ts-morph', () => {
  let agent: RAGAgentExtension;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create a new agent with test configuration
    const config: Partial<RAGAgentConfig> = {
      provider: 'openrouter',
      model: 'test-model',
      apiKey: 'test-api-key',
      debug: true,
      useInMemoryVectorStore: true
    };
    
    agent = new RAGAgentExtension(config);
    
    // Mock the fetch implementation
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      text: jest.fn().mockResolvedValue(JSON.stringify({
        choices: [
          {
            message: {
              content: '```typescript\nconst process = ReactiveSystem.Process.create("test-process")\n  .withDescription("Test process")\n  .withInitialState("initial")\n  .addState("initial")\n  .addState("processing")\n  .addState("completed")\n  .addTransition({\n    from: "initial",\n    to: "processing",\n    on: "START"\n  })\n  .addTransition({\n    from: "processing",\n    to: "completed",\n    on: "COMPLETE"\n  });\n```'
            }
          }
        ]
      }))
    });
  });
  
  describe('Code extraction with ts-morph', () => {
    it('should extract code from markdown code blocks', async () => {
      // Access the private method using type assertion
      const extractMethod = (agent as any).extractCodeFromResponse.bind(agent);
      
      const response = '```typescript\nconst process = ReactiveSystem.Process.create("test-process");\n```';
      const result = extractMethod(response, 'typescript');
      
      expect(result).toContain('ReactiveSystem.Process.create');
      expect(result).not.toContain('```');
    });
    
    it('should remove import statements from extracted code', async () => {
      const extractMethod = (agent as any).extractCodeFromResponse.bind(agent);
      
      const response = '```typescript\nimport { Process } from "reactive-system";\nconst process = ReactiveSystem.Process.create("test-process");\n```';
      const result = extractMethod(response, 'typescript');
      
      expect(result).toContain('ReactiveSystem.Process.create');
      expect(result).not.toContain('import');
      expect(result).not.toContain('reactive-system');
    });
    
    it('should extract code after explanatory text', async () => {
      const extractMethod = (agent as any).extractCodeFromResponse.bind(agent);
      
      const response = 'Here is the implementation:\n\nconst process = ReactiveSystem.Process.create("test-process");';
      const result = extractMethod(response, 'typescript');
      
      expect(result).toContain('ReactiveSystem.Process.create');
      expect(result).not.toContain('Here is the implementation:');
    });
  });
  
  describe('Process code conversion with ts-morph', () => {
    it('should convert process code to ProcessDefinition using ts-morph', async () => {
      // Access the private method using type assertion
      const convertMethod = (agent as any).convertCodeToProcessDefinition.bind(agent);
      
      const code = 'const process = ReactiveSystem.Process.create("test-process")\n  .withDescription("Test process")\n  .withInitialState("initial")\n  .addState("initial")\n  .addState("processing")\n  .addTransition({\n    from: "initial",\n    to: "processing",\n    on: "START"\n  });';
      
      const result = convertMethod(code, 'test-process');
      
      expect(result).toHaveProperty('id', 'test-process');
      expect(result).toHaveProperty('description', 'Test process');
      expect(result).toHaveProperty('initialState', 'initial');
      expect(result.states).toHaveProperty('initial');
      expect(result.states).toHaveProperty('processing');
      expect(result.transitions).toHaveLength(1);
      expect(result.transitions[0]).toHaveProperty('from', ['initial']);
      expect(result.transitions[0]).toHaveProperty('to', 'processing');
      expect(result.transitions[0]).toHaveProperty('on', 'START');
    });
    
    it('should create a fallback ProcessDefinition when conversion fails', async () => {
      // Access the private method using type assertion
      const fallbackMethod = (agent as any).createFallbackProcessDefinition.bind(agent);
      
      const result = fallbackMethod('test-process', 'Conversion error');
      
      expect(result).toHaveProperty('id', 'test-process');
      expect(result).toHaveProperty('states');
      expect(result).toHaveProperty('transitions');
      expect(result).toHaveProperty('metadata.generatedFallback', true);
      expect(result).toHaveProperty('metadata.error', 'Conversion error');
    });
  });
  
  describe('Task code conversion with ts-morph', () => {
    it('should convert task code to TaskDefinition using ts-morph', async () => {
      // Access the private method using type assertion
      const convertMethod = (agent as any).convertCodeToTaskDefinition.bind(agent);
      
      const code = 'const task = ReactiveSystem.Task.create("test-task")\n  .withDescription("Test task")\n  .withInputSchema(z.object({\n    input: z.string()\n  }))\n  .withOutputSchema(z.object({\n    output: z.string()\n  }))\n  .withImplementation(async (input, context) => {\n    return { output: input.input };\n  });';
      
      const result = convertMethod(code, 'test-task');
      
      expect(result).toHaveProperty('id', 'test-task');
      expect(result).toHaveProperty('description', 'Test task');
      expect(result).toHaveProperty('inputSchema');
      expect(result).toHaveProperty('outputSchema');
      expect(result).toHaveProperty('implementation');
    });
    
    it('should create a fallback TaskDefinition when conversion fails', async () => {
      // Access the private method using type assertion
      const fallbackMethod = (agent as any).createFallbackTaskDefinition.bind(agent);
      
      const result = fallbackMethod('test-task', 'Conversion error');
      
      expect(result).toHaveProperty('id', 'test-task');
      expect(result).toHaveProperty('inputSchema');
      expect(result).toHaveProperty('outputSchema');
      expect(result).toHaveProperty('implementation');
      expect(result).toHaveProperty('metadata.generatedFallback', true);
      expect(result).toHaveProperty('metadata.error', 'Conversion error');
    });
  });
  
  describe('generateProcess method', () => {
    it('should generate a process definition from a specification', async () => {
      const processSpec = {
        name: 'OrderProcess',
        description: 'Manages orders from creation to fulfillment',
        states: ['created', 'processing', 'shipped', 'delivered', 'cancelled'],
        events: ['CREATE_ORDER', 'PROCESS_ORDER', 'SHIP_ORDER', 'DELIVER_ORDER', 'CANCEL_ORDER']
      };
      
      const result = await agent.generateProcess(processSpec);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('states');
      expect(result).toHaveProperty('initialState');
      expect(result).toHaveProperty('transitions');
    });
  });
  
  describe('generateTask method', () => {
    it('should generate a task definition from a specification', async () => {
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
      
      // Mock the response for task generation
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValue(JSON.stringify({
          choices: [
            {
              message: {
                content: '```typescript\nconst task = ReactiveSystem.Task.create("process-order")\n  .withDescription("Processes an order for shipment")\n  .withInputSchema(z.object({\n    orderId: z.string(),\n    customerId: z.string(),\n    items: z.array(z.any()),\n    paymentStatus: z.string()\n  }))\n  .withOutputSchema(z.object({\n    success: z.boolean(),\n    processedAt: z.string(),\n    estimatedShippingDate: z.string()\n  }))\n  .withImplementation(async (input, context) => {\n    return {\n      success: true,\n      processedAt: new Date().toISOString(),\n      estimatedShippingDate: new Date().toISOString()\n    };\n  });\n```'
              }
            }
          ]
        }))
      });
      
      const result = await agent.generateTask(taskSpec);
      
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('inputSchema');
      expect(result).toHaveProperty('outputSchema');
      expect(result).toHaveProperty('implementation');
    });
  });
}); 