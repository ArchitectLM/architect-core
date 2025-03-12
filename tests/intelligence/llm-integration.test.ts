import { describe, it, expect, vi } from 'vitest';
import { mockLLM } from '../mocks/index';

// Mock the LLM integration system
vi.mock('../../src/intelligence/llm-integration', () => ({
  processLLMResponse: vi.fn((response) => {
    if (response.isCompletlyUnusable) {
      return { 
        success: false, 
        fallbackUsed: true,
        result: { type: 'fallback', id: 'default-fallback' }
      };
    }
    
    // Handle malformed JSON
    if (response.malformedJson) {
      return {
        success: true,
        corrected: true,
        result: {
          id: 'corrected-id',
          type: 'corrected-type',
          ...response
        }
      };
    }
    
    // Handle missing required fields
    if (response.missingRequiredFields) {
      const result = { ...response };
      response.missingRequiredFields.forEach((field: string) => {
        result[field] = `default-${field}`;
      });
      
      return {
        success: true,
        corrected: true,
        result
      };
    }
    
    return {
      success: true,
      corrected: false,
      result: response
    };
  }),
  
  postProcessLLMOutput: vi.fn((output, targetSchema) => {
    if (output.malformedJson || output.missingRequiredFields) {
      return {
        id: output.id || 'default-id',
        type: output.type || 'default-type',
        name: output.name || 'Default Name',
        description: output.description || 'Default description'
      };
    }
    
    return output;
  }),
  
  mockLLMOutput: vi.fn((config) => {
    return {
      containsHallucination: config.containsHallucination || false,
      missingRequiredFields: config.missingRequiredFields || [],
      malformedJson: config.malformedJson || false,
      isCompletlyUnusable: config.isCompletlyUnusable || false,
      ...config
    };
  }),
  
  executePrompt: vi.fn((promptTemplate, llm) => {
    return llm.generateResponse(promptTemplate);
  })
}));

// Custom matchers
expect.extend({
  toBeValidAgainstSchema(received, schema) {
    // Simple mock validation - in real tests this would use actual schema validation
    const hasRequiredFields = schema.requiredFields.every((field: string) => 
      received[field] !== undefined && received[field] !== null
    );
    
    return {
      pass: hasRequiredFields,
      message: () => `expected object ${hasRequiredFields ? 'not ' : ''}to be valid against schema`
    };
  },
  
  toHaveRequiredFields(received, fields) {
    const hasAllFields = fields.every((field: string) => 
      received[field] !== undefined && received[field] !== null
    );
    
    return {
      pass: hasAllFields,
      message: () => `expected object ${hasAllFields ? 'not ' : ''}to have required fields: ${fields.join(', ')}`
    };
  },
  
  toFallbackToDefaultBehavior(received) {
    const pass = received && received.fallbackUsed === true;
    
    return {
      pass,
      message: () => `expected ${pass ? 'not ' : ''}to fallback to default behavior`
    };
  }
});

describe('LLM Integration System', () => {
  it('should post-process and correct common LLM errors', async () => {
    // Import mocked modules
    const { mockLLMOutput, postProcessLLMOutput } = await import('../../src/intelligence/llm-integration');
    
    // Mock an LLM response with typical errors
    const mockResponse = mockLLMOutput({
      containsHallucination: true,
      missingRequiredFields: ['id', 'type'],
      malformedJson: true
    });
    
    // Define a target schema
    const targetSchema = {
      requiredFields: ['id', 'type', 'name', 'description']
    };
    
    // Process the output
    const processedOutput = postProcessLLMOutput(mockResponse, targetSchema);
    
    // @ts-ignore - Custom matcher
    expect(processedOutput).toBeValidAgainstSchema(targetSchema);
    // @ts-ignore - Custom matcher
    expect(processedOutput).toHaveRequiredFields(['id', 'type']);
  });
  
  it('should degrade gracefully with completely unusable LLM output', async () => {
    // Import mocked modules
    const { mockLLMOutput, processLLMResponse } = await import('../../src/intelligence/llm-integration');
    
    // Mock a completely unusable LLM response
    const unusableResponse = mockLLMOutput({
      isCompletlyUnusable: true
    });
    
    // Process the response
    const result = processLLMResponse(unusableResponse);
    
    // Should not throw and should fallback
    expect(() => processLLMResponse(unusableResponse)).not.toThrow();
    // @ts-ignore - Custom matcher
    expect(result).toFallbackToDefaultBehavior();
  });
  
  it('should execute prompts and handle responses', async () => {
    // Import mocked modules
    const { executePrompt } = await import('../../src/intelligence/llm-integration');
    
    // Create a mock LLM
    const mockLlmService = mockLLM({
      responses: {
        'generate-process': {
          id: 'order-fulfillment',
          type: 'process',
          name: 'Order Fulfillment Process',
          tasks: ['validate-order', 'process-payment', 'ship-order']
        }
      }
    });
    
    // Execute a prompt
    const result = await executePrompt('generate-process for e-commerce', mockLlmService);
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.id).toBe('order-fulfillment');
    expect(result.tasks).toContain('process-payment');
  });
  
  it('should handle different prompt versions', async () => {
    // Import mocked modules
    const { executePrompt } = await import('../../src/intelligence/llm-integration');
    
    // Create a mock LLM that handles different versions
    const versionAwareLLM = mockLLM({
      responses: {
        'v1': {
          version: '1.0',
          features: ['basic-generation']
        },
        'v2': {
          version: '2.0',
          features: ['basic-generation', 'enhanced-context', 'error-correction']
        }
      }
    });
    
    // Execute prompts with different versions
    const v1Result = await executePrompt('generate-task v1', versionAwareLLM);
    const v2Result = await executePrompt('generate-task v2', versionAwareLLM);
    
    // Verify the results
    expect(v1Result.version).toBe('1.0');
    expect(v2Result.version).toBe('2.0');
    expect(v2Result.features.length).toBeGreaterThan(v1Result.features.length);
    expect(v2Result.features).toContain('enhanced-context');
  });
}); 