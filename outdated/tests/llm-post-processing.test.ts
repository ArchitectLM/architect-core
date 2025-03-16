import { describe, it, expect, vi } from 'vitest';

// Define interfaces and mock classes for testing
interface LLMResponse {
  text: string;
  metadata?: Record<string, any>;
}

interface ProcessingOptions {
  extractJson?: boolean;
  normalizeWhitespace?: boolean;
  removePrefix?: string;
  removeSuffix?: string;
  extractPattern?: RegExp;
  formatters?: Array<(text: string) => string>;
}

class ResponseProcessor {
  process(response: LLMResponse, options: ProcessingOptions = {}): LLMResponse {
    let processedText = response.text;
    
    // Apply extractors
    if (options.extractPattern) {
      const match = processedText.match(options.extractPattern);
      if (match && match[1]) {
        processedText = match[1];
      }
    }
    
    // Apply transformers
    if (options.normalizeWhitespace) {
      processedText = this.normalizeWhitespace(processedText);
    }
    
    if (options.removePrefix && processedText.startsWith(options.removePrefix)) {
      processedText = processedText.substring(options.removePrefix.length);
    }
    
    if (options.removeSuffix && processedText.endsWith(options.removeSuffix)) {
      processedText = processedText.substring(0, processedText.length - options.removeSuffix.length);
    }
    
    // Apply custom formatters
    if (options.formatters) {
      for (const formatter of options.formatters) {
        processedText = formatter(processedText);
      }
    }
    
    // Extract JSON if requested
    let metadata = response.metadata ? { ...response.metadata } : {};
    if (options.extractJson) {
      try {
        const jsonData = this.extractJson(processedText);
        if (jsonData) {
          processedText = jsonData.text || processedText;
          metadata = { ...metadata, ...jsonData.metadata };
        }
      } catch (error) {
        // JSON extraction failed, keep original text
        metadata = { 
          ...metadata, 
          jsonExtractionError: (error as Error).message 
        };
      }
    }
    
    return {
      text: processedText,
      metadata
    };
  }
  
  private normalizeWhitespace(text: string): string {
    // Replace multiple spaces with a single space
    return text.replace(/\s+/g, ' ').trim();
  }
  
  private extractJson(text: string): { text: string, metadata: Record<string, any> } | null {
    // Look for JSON objects in the text
    const jsonRegex = /```json\s*({[\s\S]*?})\s*```|({[\s\S]*?})/g;
    const matches = [...text.matchAll(jsonRegex)];
    
    if (matches.length === 0) {
      return null;
    }
    
    // Extract the first valid JSON object
    for (const match of matches) {
      const jsonStr = (match[1] || match[2]).trim();
      try {
        const jsonData = JSON.parse(jsonStr);
        
        // Remove the JSON from the text
        let newText = text.replace(match[0], '').trim();
        
        return {
          text: newText,
          metadata: jsonData
        };
      } catch (e) {
        // Not valid JSON, try the next match
        continue;
      }
    }
    
    // If we get here, we found potential JSON matches but none were valid
    throw new Error('Failed to parse any JSON in the text');
  }
}

class SchemaValidator {
  validate<T>(data: any, schema: Record<string, any>): { valid: boolean, data?: T, errors?: string[] } {
    const errors: string[] = [];
    
    // Simple schema validation
    for (const [key, type] of Object.entries(schema)) {
      if (type === 'required' && (data[key] === undefined || data[key] === null)) {
        errors.push(`Missing required field: ${key}`);
      } else if (data[key] !== undefined) {
        if (typeof type === 'string' && typeof data[key] !== type) {
          errors.push(`Field ${key} should be of type ${type}, got ${typeof data[key]}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      data: errors.length === 0 ? data as T : undefined,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

describe('LLM Post-Processing System', () => {
  describe('Basic Text Processing', () => {
    it('should normalize whitespace in responses', () => {
      const processor = new ResponseProcessor();
      
      const response: LLMResponse = {
        text: '  This   is  a   test   response  with   extra   spaces.  '
      };
      
      const processed = processor.process(response, { normalizeWhitespace: true });
      
      expect(processed.text).toBe('This is a test response with extra spaces.');
    });
    
    it('should remove prefixes and suffixes', () => {
      const processor = new ResponseProcessor();
      
      const response: LLMResponse = {
        text: 'AI: Here is the answer you requested. Thanks for asking!'
      };
      
      const processed = processor.process(response, { 
        removePrefix: 'AI: ',
        removeSuffix: ' Thanks for asking!'
      });
      
      expect(processed.text).toBe('Here is the answer you requested.');
    });
    
    it('should extract text using regex patterns', () => {
      const processor = new ResponseProcessor();
      
      const response: LLMResponse = {
        text: 'The answer is: [42]. Please let me know if you need anything else.'
      };
      
      const processed = processor.process(response, { 
        extractPattern: /The answer is: \[(.*?)\]/
      });
      
      expect(processed.text).toBe('42');
    });
  });
  
  describe('JSON Extraction', () => {
    it('should extract JSON from code blocks', () => {
      const processor = new ResponseProcessor();
      
      const response: LLMResponse = {
        text: 'Here is the data you requested:\n\n```json\n{"name": "John", "age": 30}\n```\n\nLet me know if you need anything else.'
      };
      
      const processed = processor.process(response, { extractJson: true });
      
      expect(processed.text).toBe('Here is the data you requested:\n\n\n\nLet me know if you need anything else.');
      expect(processed.metadata).toHaveProperty('name', 'John');
      expect(processed.metadata).toHaveProperty('age', 30);
    });
    
    it('should extract JSON without code blocks', () => {
      const processor = new ResponseProcessor();
      
      const response: LLMResponse = {
        text: 'Here is the data: {"name": "John", "age": 30} Let me know if you need anything else.'
      };
      
      const processed = processor.process(response, { extractJson: true });
      
      expect(processed.text).toBe('Here is the data:  Let me know if you need anything else.');
      expect(processed.metadata).toHaveProperty('name', 'John');
      expect(processed.metadata).toHaveProperty('age', 30);
    });
    
    it('should handle invalid JSON gracefully', () => {
      const processor = new ResponseProcessor();
      
      // Create a spy on the extractJson method to force it to throw an error
      const extractJsonSpy = vi.spyOn(processor as any, 'extractJson');
      extractJsonSpy.mockImplementation(() => {
        throw new Error('Invalid JSON format');
      });
      
      const response: LLMResponse = {
        text: 'Here is the data: {"name": "John", "age": 30, "missing": "closing brace"'
      };
      
      const processed = processor.process(response, { extractJson: true });
      
      // Should keep original text when JSON is invalid
      expect(processed.text).toBe('Here is the data: {"name": "John", "age": 30, "missing": "closing brace"');
      expect(processed.metadata).toHaveProperty('jsonExtractionError');
      expect(processed.metadata?.jsonExtractionError).toBe('Invalid JSON format');
      
      // Restore the original implementation
      extractJsonSpy.mockRestore();
    });
  });
  
  describe('Custom Formatters', () => {
    it('should apply custom formatters to responses', () => {
      const processor = new ResponseProcessor();
      
      const response: LLMResponse = {
        text: 'this is a test response.'
      };
      
      const capitalizeFormatter = (text: string) => {
        return text.charAt(0).toUpperCase() + text.slice(1);
      };
      
      const addPeriodFormatter = (text: string) => {
        return text.endsWith('.') ? text : text + '.';
      };
      
      const processed = processor.process(response, { 
        formatters: [capitalizeFormatter, addPeriodFormatter]
      });
      
      expect(processed.text).toBe('This is a test response.');
    });
  });
  
  describe('Schema Validation', () => {
    it('should validate extracted data against a schema', () => {
      const processor = new ResponseProcessor();
      const validator = new SchemaValidator();
      
      const response: LLMResponse = {
        text: '```json\n{"name": "John", "age": 30, "email": "john@example.com"}\n```'
      };
      
      const processed = processor.process(response, { extractJson: true });
      
      // Define a schema for user data
      const userSchema = {
        name: 'string',
        age: 'number',
        email: 'string'
      };
      
      const validationResult = validator.validate(processed.metadata, userSchema);
      
      expect(validationResult.valid).toBe(true);
      expect(validationResult.data).toHaveProperty('name', 'John');
      expect(validationResult.data).toHaveProperty('age', 30);
    });
    
    it('should detect schema validation errors', () => {
      const processor = new ResponseProcessor();
      const validator = new SchemaValidator();
      
      const response: LLMResponse = {
        text: '```json\n{"name": "John", "age": "thirty"}\n```'
      };
      
      const processed = processor.process(response, { extractJson: true });
      
      // Define a schema for user data
      const userSchema = {
        name: 'string',
        age: 'number',
        email: 'required'
      };
      
      const validationResult = validator.validate(processed.metadata, userSchema);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.errors).toContain('Field age should be of type number, got string');
      expect(validationResult.errors).toContain('Missing required field: email');
    });
  });
  
  describe('Complex Processing Pipelines', () => {
    it('should handle multiple processing steps in sequence', () => {
      const processor = new ResponseProcessor();
      
      const response: LLMResponse = {
        text: '  AI Assistant:  Here is the data you requested:\n\n```json\n{"result": "success", "data": {"items": [1, 2, 3]}}\n```\n\nThank you for using our service!  '
      };
      
      const processed = processor.process(response, {
        removePrefix: 'AI Assistant:',
        removeSuffix: 'Thank you for using our service!',
        normalizeWhitespace: true,
        extractJson: true
      });
      
      expect(processed.text).toBe('Here is the data you requested:');
      expect(processed.metadata).toHaveProperty('result', 'success');
      expect(processed.metadata?.data).toHaveProperty('items');
      expect(processed.metadata?.data.items).toEqual([1, 2, 3]);
    });
  });
}); 