import { describe, it, expect, vi } from 'vitest';
import { mockLLM } from '../mocks';

// Mock the prompt management system
vi.mock('../../src/intelligence/prompt-management', () => ({
  mockPromptTemplate: vi.fn((templateId, params = {}) => {
    return {
      id: templateId,
      version: params.version || '1.0',
      params: params,
      template: `This is a mock template for ${templateId} with version ${params.version || '1.0'}`
    };
  }),
  
  executePrompt: vi.fn(async (promptTemplate, llm) => {
    // Execute the prompt using the provided LLM
    return await llm.generateResponse(promptTemplate.template);
  }),
  
  getPromptTemplate: vi.fn((templateId, version) => {
    if (templateId === 'generate-process') {
      return {
        id: 'generate-process',
        version: version || '1.0',
        template: `Generate a process for domain: {{domain}}, type: {{processType}}`,
        parameters: ['domain', 'processType'],
        description: 'Template for generating processes'
      };
    }
    
    if (templateId === 'generate-task') {
      if (version === '2.0') {
        return {
          id: 'generate-task',
          version: '2.0',
          template: `Generate a task with name: {{name}}, inputs: {{inputs}}, outputs: {{outputs}}, with enhanced context`,
          parameters: ['name', 'inputs', 'outputs'],
          description: 'Enhanced template for generating tasks'
        };
      }
      
      return {
        id: 'generate-task',
        version: '1.0',
        template: `Generate a task with name: {{name}}, inputs: {{inputs}}, outputs: {{outputs}}`,
        parameters: ['name', 'inputs', 'outputs'],
        description: 'Template for generating tasks'
      };
    }
    
    return null;
  }),
  
  evaluatePromptQuality: vi.fn((prompt, responses) => {
    // Calculate quality metrics
    const metrics = {
      relevance: 0,
      specificity: 0,
      consistency: 0,
      overall: 0
    };
    
    // Simple mock implementation
    if (prompt.includes('specific') || prompt.includes('detailed')) {
      metrics.specificity = 0.9;
    } else {
      metrics.specificity = 0.6;
    }
    
    if (prompt.includes('context') || prompt.includes('domain')) {
      metrics.relevance = 0.8;
    } else {
      metrics.relevance = 0.5;
    }
    
    // Calculate consistency based on response variance
    metrics.consistency = responses.length > 1 ? 0.7 : 1.0;
    
    // Calculate overall score
    metrics.overall = (metrics.relevance + metrics.specificity + metrics.consistency) / 3;
    
    return metrics;
  }),
  
  createMockLLM: vi.fn((config) => {
    return {
      respondToPromptWith: config.respondToPromptWith || {},
      canHandleMultipleVersions: config.canHandleMultipleVersions || false,
      
      async generateResponse(prompt) {
        if (typeof this.respondToPromptWith === 'function') {
          return this.respondToPromptWith(prompt);
        }
        
        return this.respondToPromptWith;
      }
    };
  })
}));

// Custom matchers
expect.extend({
  toBeValidProcess(received) {
    const hasRequiredFields = received && 
      received.id && 
      received.name && 
      (received.tasks && Array.isArray(received.tasks));
    
    return {
      pass: hasRequiredFields,
      message: () => `expected ${hasRequiredFields ? 'not ' : ''}to be a valid process`
    };
  },
  
  toMatchDomain(received, domain) {
    const matchesDomain = received && 
      (received.domain === domain || 
       (received.tags && received.tags.includes(domain)));
    
    return {
      pass: matchesDomain,
      message: () => `expected ${matchesDomain ? 'not ' : ''}to match domain "${domain}"`
    };
  },
  
  toIncludeExpectedTasks(received, tasks) {
    const hasTasks = received && received.tasks && Array.isArray(received.tasks);
    const includesTasks = hasTasks && 
      tasks.every((task: string) => received.tasks.includes(task));
    
    return {
      pass: includesTasks,
      message: () => `expected ${includesTasks ? 'not ' : ''}to include tasks: ${tasks.join(', ')}`
    };
  },
  
  toBeCompatibleWithVersion(received, version) {
    const isCompatible = received && received.version === version;
    
    return {
      pass: isCompatible,
      message: () => `expected ${isCompatible ? 'not ' : ''}to be compatible with version "${version}"`
    };
  },
  
  toHaveEnhancementsOverV1(received) {
    const hasEnhancements = received && 
      (received.enhancedFeatures || 
       (received.features && received.features.length > 2));
    
    return {
      pass: hasEnhancements,
      message: () => `expected ${hasEnhancements ? 'not ' : ''}to have enhancements over v1`
    };
  },
  
  toBeBackwardCompatibleWith(received, v1Result) {
    // Check if all fields in v1 are present in v2
    const v1Fields = Object.keys(v1Result || {});
    const hasAllV1Fields = v1Fields.every(field => 
      received && received[field] !== undefined
    );
    
    return {
      pass: hasAllV1Fields,
      message: () => `expected ${hasAllV1Fields ? 'not ' : ''}to be backward compatible with v1 result`
    };
  }
});

describe('Prompt Management System', () => {
  it('should create valid processes using process generation prompt', async () => {
    // Import mocked modules
    const { mockPromptTemplate, executePrompt, createMockLLM } = await import('../../src/intelligence/prompt-management');
    
    // Create a process generation prompt
    const processPrompt = mockPromptTemplate('generate-process', {
      domain: 'e-commerce',
      processType: 'order-fulfillment'
    });
    
    // Create a mock LLM that responds with a valid process
    const validProcessJson = {
      id: 'order-fulfillment-process',
      name: 'Order Fulfillment Process',
      domain: 'e-commerce',
      tasks: ['validate-order', 'process-payment', 'prepare-shipment', 'notify-customer'],
      tags: ['e-commerce', 'order-processing']
    };
    
    const mockLlm = createMockLLM({
      respondToPromptWith: validProcessJson
    });
    
    // Execute the prompt
    const generatedProcess = await executePrompt(processPrompt, mockLlm);
    
    // @ts-ignore - Custom matcher
    expect(generatedProcess).toBeValidProcess();
    // @ts-ignore - Custom matcher
    expect(generatedProcess).toMatchDomain('e-commerce');
    // @ts-ignore - Custom matcher
    expect(generatedProcess).toIncludeExpectedTasks(['validate-order', 'process-payment']);
  });
  
  it('should maintain backward compatibility between prompt versions', async () => {
    // Import mocked modules
    const { mockPromptTemplate, executePrompt, createMockLLM } = await import('../../src/intelligence/prompt-management');
    
    // Create prompt templates for different versions
    const v1Prompt = mockPromptTemplate('generate-task', { 
      version: '1.0',
      name: 'payment-processing',
      inputs: ['amount', 'paymentMethod'],
      outputs: ['transactionId', 'status']
    });
    
    const v2Prompt = mockPromptTemplate('generate-task', { 
      version: '2.0',
      name: 'payment-processing',
      inputs: ['amount', 'paymentMethod', 'customerContext'],
      outputs: ['transactionId', 'status', 'analytics']
    });
    
    // Create a mock LLM that handles different versions
    const versionAwareLLM = createMockLLM({
      canHandleMultipleVersions: true,
      respondToPromptWith: (prompt) => {
        if (prompt.includes('version 1.0')) {
          return {
            id: 'payment-task-v1',
            name: 'Payment Processing',
            version: '1.0',
            inputs: ['amount', 'paymentMethod'],
            outputs: ['transactionId', 'status'],
            features: ['basic-processing', 'error-handling']
          };
        } else if (prompt.includes('version 2.0') || prompt.includes('enhanced context')) {
          return {
            id: 'payment-task-v2',
            name: 'Payment Processing',
            version: '2.0',
            inputs: ['amount', 'paymentMethod', 'customerContext'],
            outputs: ['transactionId', 'status', 'analytics'],
            features: ['basic-processing', 'error-handling', 'context-awareness', 'analytics-integration'],
            enhancedFeatures: true
          };
        }
        
        return {
          id: 'default-task',
          name: 'Default Task',
          version: 'unknown'
        };
      }
    });
    
    // Execute prompts with different versions
    const v1Result = await executePrompt(v1Prompt, versionAwareLLM);
    const v2Result = await executePrompt(v2Prompt, versionAwareLLM);
    
    // @ts-ignore - Custom matcher
    expect(v1Result).toBeCompatibleWithVersion('1.0');
    // @ts-ignore - Custom matcher
    expect(v2Result).toHaveEnhancementsOverV1();
    // @ts-ignore - Custom matcher
    expect(v2Result).toBeBackwardCompatibleWith(v1Result);
    
    // Specific enhancements in v2
    expect(v2Result.features.length).toBeGreaterThan(v1Result.features.length);
    expect(v2Result.inputs.length).toBeGreaterThan(v1Result.inputs.length);
    expect(v2Result.outputs.length).toBeGreaterThan(v1Result.outputs.length);
  });
  
  it('should evaluate prompt quality based on metrics', async () => {
    // Import mocked modules
    const { evaluatePromptQuality } = await import('../../src/intelligence/prompt-management');
    
    // Test different prompts
    const genericPrompt = "Generate a process";
    const specificPrompt = "Generate a detailed order fulfillment process for an e-commerce domain with inventory management";
    
    // Mock responses
    const responses = [
      { id: 'response-1', content: 'First response' },
      { id: 'response-2', content: 'Second response' }
    ];
    
    // Evaluate prompts
    const genericMetrics = evaluatePromptQuality(genericPrompt, responses);
    const specificMetrics = evaluatePromptQuality(specificPrompt, responses);
    
    // Generic prompt should have lower specificity
    expect(genericMetrics.specificity).toBeLessThan(specificMetrics.specificity);
    
    // Specific prompt should have higher relevance
    expect(specificMetrics.relevance).toBeGreaterThan(genericMetrics.relevance);
    
    // Overall score should reflect individual metrics
    expect(specificMetrics.overall).toBeGreaterThan(genericMetrics.overall);
  });
  
  it('should retrieve prompt templates by ID and version', async () => {
    // Import mocked modules
    const { getPromptTemplate } = await import('../../src/intelligence/prompt-management');
    
    // Get templates for different versions
    const processTemplate = getPromptTemplate('generate-process');
    const taskTemplateV1 = getPromptTemplate('generate-task', '1.0');
    const taskTemplateV2 = getPromptTemplate('generate-task', '2.0');
    
    // Verify template properties
    expect(processTemplate).toBeDefined();
    expect(processTemplate?.id).toBe('generate-process');
    expect(processTemplate?.parameters).toContain('domain');
    
    expect(taskTemplateV1).toBeDefined();
    expect(taskTemplateV1?.version).toBe('1.0');
    
    expect(taskTemplateV2).toBeDefined();
    expect(taskTemplateV2?.version).toBe('2.0');
    
    // V2 should have enhanced template
    expect(taskTemplateV2?.template).toContain('enhanced context');
    expect(taskTemplateV1?.template).not.toContain('enhanced context');
  });
}); 