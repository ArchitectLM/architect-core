/**
 * LLM Post-Processing System
 * 
 * This module provides functionality for processing and normalizing LLM responses
 * to ensure they conform to expected schemas and formats.
 */

/**
 * LLM response processing result
 */
export interface LLMResponse {
  raw: any;
  normalized?: any;
  errors: string[];
  warnings: string[];
  metadata: {
    processingTime: number;
    corrections: string[];
    isComplete: boolean;
  };
}

/**
 * Post-processor for LLM outputs
 */
export class LLMPostProcessor {
  /**
   * Normalize an LLM output against a schema
   */
  normalizeOutput(output: any, schema: any): LLMResponse {
    const startTime = Date.now();
    const response: LLMResponse = {
      raw: output,
      errors: [],
      warnings: [],
      metadata: {
        processingTime: 0,
        corrections: [],
        isComplete: false
      }
    };
    
    try {
      // Handle completely invalid outputs
      if (output === null || output === undefined) {
        response.errors.push('LLM output is null or undefined');
        return this.finalizeResponse(response, startTime);
      }
      
      // Handle non-object outputs
      if (typeof output !== 'object') {
        response.errors.push(`LLM output is not an object (received ${typeof output})`);
        return this.finalizeResponse(response, startTime);
      }
      
      // Attempt to normalize against schema
      const normalized = this.applySchema(output, schema);
      response.normalized = normalized;
      
      // Check for missing required fields
      const missingFields = this.checkRequiredFields(normalized, schema);
      if (missingFields.length > 0) {
        response.warnings.push(`Missing required fields: ${missingFields.join(', ')}`);
        
        // Attempt to fix missing fields
        missingFields.forEach(field => {
          response.normalized = this.applyDefaultValue(response.normalized, field, schema);
          response.metadata.corrections.push(`Added default value for ${field}`);
        });
      }
      
      // Apply content filtering
      response.normalized = this.filterContent(response.normalized);
      
      // Mark as complete if no errors
      response.metadata.isComplete = response.errors.length === 0;
      
    } catch (error) {
      response.errors.push(`Processing error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return this.finalizeResponse(response, startTime);
  }
  
  /**
   * Apply schema to normalize output
   */
  private applySchema(output: any, schema: any): any {
    // This is a simplified implementation - in a real system,
    // you would use a schema validation library like Zod, Joi, or Ajv
    
    const normalized = { ...output };
    
    // Apply type coercion for primitive types
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([key, propSchema]: [string, any]) => {
        if (key in output) {
          const value = output[key];
          
          // Type coercion
          if (propSchema.type === 'string' && typeof value !== 'string') {
            normalized[key] = String(value);
          } else if (propSchema.type === 'number' && typeof value !== 'number') {
            const num = Number(value);
            if (!isNaN(num)) {
              normalized[key] = num;
            }
          } else if (propSchema.type === 'boolean' && typeof value !== 'boolean') {
            normalized[key] = Boolean(value);
          }
          
          // Enum validation
          if (propSchema.enum && !propSchema.enum.includes(normalized[key])) {
            normalized[key] = propSchema.enum[0]; // Default to first enum value
          }
        }
      });
    }
    
    return normalized;
  }
  
  /**
   * Check for missing required fields
   */
  private checkRequiredFields(output: any, schema: any): string[] {
    const missingFields: string[] = [];
    
    if (schema.required && Array.isArray(schema.required)) {
      schema.required.forEach((field: string) => {
        if (!(field in output) || output[field] === null || output[field] === undefined) {
          missingFields.push(field);
        }
      });
    }
    
    return missingFields;
  }
  
  /**
   * Apply default value for a missing field
   */
  private applyDefaultValue(output: any, field: string, schema: any): any {
    const result = { ...output };
    
    // Find the field schema
    const fieldSchema = schema.properties?.[field];
    if (!fieldSchema) return result;
    
    // Apply default value based on type
    if ('default' in fieldSchema) {
      result[field] = fieldSchema.default;
    } else if (fieldSchema.type === 'string') {
      result[field] = '';
    } else if (fieldSchema.type === 'number') {
      result[field] = 0;
    } else if (fieldSchema.type === 'boolean') {
      result[field] = false;
    } else if (fieldSchema.type === 'array') {
      result[field] = [];
    } else if (fieldSchema.type === 'object') {
      result[field] = {};
    }
    
    return result;
  }
  
  /**
   * Filter content for inappropriate or harmful content
   */
  private filterContent(output: any): any {
    // This is a placeholder for content filtering logic
    // In a real system, you would implement more sophisticated filtering
    
    // Simple example: filter out potentially harmful fields
    const result = { ...output };
    
    // Remove any fields that might contain SQL injection or script tags
    Object.entries(result).forEach(([key, value]) => {
      if (typeof value === 'string') {
        if (value.includes('<script>') || value.includes('DROP TABLE') || value.includes('DELETE FROM')) {
          result[key] = '[FILTERED]';
        }
      }
    });
    
    return result;
  }
  
  /**
   * Finalize the response with timing information
   */
  private finalizeResponse(response: LLMResponse, startTime: number): LLMResponse {
    response.metadata.processingTime = Date.now() - startTime;
    return response;
  }
}

/**
 * Create a schema-based LLM post-processor
 */
export function createLLMPostProcessor(): LLMPostProcessor {
  return new LLMPostProcessor();
} 