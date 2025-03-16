/**
 * Pattern Library System
 * 
 * This module provides functionality for managing and applying patterns
 * to system definitions. It leverages the parameterized pattern library
 * for enhanced pattern capabilities.
 */

import { 
  PatternLibrary as ParameterizedPatternLibrary,
  ParameterizedPattern,
  PatternParameter
} from './parameterized-pattern-library';

// Initialize the parameterized pattern library
const parameterizedPatternLibrary = new ParameterizedPatternLibrary();

// Register built-in patterns
function registerBuiltInPatterns() {
  // E-commerce checkout pattern
  parameterizedPatternLibrary.registerPattern({
    id: 'e-commerce/checkout',
    name: 'E-commerce Checkout Pattern',
    description: 'A pattern for implementing e-commerce checkout flows',
    category: 'e-commerce',
    parameters: [
      {
        name: 'paymentProviders',
        type: 'array',
        description: 'List of payment providers to support',
        required: true,
        defaultValue: ['stripe']
      },
      {
        name: 'requiresAuthentication',
        type: 'boolean',
        description: 'Whether checkout requires authentication',
        required: false,
        defaultValue: true
      },
      {
        name: 'checkoutSteps',
        type: 'array',
        description: 'Steps in the checkout process',
        required: false,
        defaultValue: ['cart', 'shipping', 'payment', 'confirmation']
      }
    ],
    template: (params) => {
      return JSON.stringify({
        processes: ['checkout-process'],
        tasks: ['process-payment'],
        paymentProviders: params.paymentProviders,
        checkoutFlow: {
          requiresAuth: params.requiresAuthentication,
          steps: params.checkoutSteps
        }
      });
    },
    examples: []
  });
  
  // Authentication pattern
  parameterizedPatternLibrary.registerPattern({
    id: 'authentication',
    name: 'Authentication Pattern',
    description: 'A pattern for implementing authentication flows',
    category: 'security',
    parameters: [
      {
        name: 'methods',
        type: 'array',
        description: 'Authentication methods to support',
        required: true,
        defaultValue: ['password']
      },
      {
        name: 'sessionDuration',
        type: 'number',
        description: 'Session duration in minutes',
        required: false,
        defaultValue: 60
      },
      {
        name: 'requiresMFA',
        type: 'boolean',
        description: 'Whether multi-factor authentication is required',
        required: false,
        defaultValue: false
      }
    ],
    template: (params) => {
      return JSON.stringify({
        processes: ['authentication-process'],
        tasks: ['verify-credentials'],
        authMethods: params.methods,
        sessionConfig: {
          duration: params.sessionDuration,
          requiresMFA: params.requiresMFA
        }
      });
    },
    examples: []
  });
}

// Register built-in patterns
registerBuiltInPatterns();

/**
 * Validates a pattern against the schema
 * @param pattern The pattern to validate
 * @returns Validation result
 */
export function validatePattern(pattern: any) {
  // Basic validation
  const valid = pattern && pattern.id && pattern.type;
  
  // If it's a parameterized pattern, use the parameterized pattern library
  if (pattern && pattern.parameters) {
    try {
      // Create a temporary pattern library to validate the pattern
      const tempLibrary = new ParameterizedPatternLibrary();
      tempLibrary.registerPattern(pattern as ParameterizedPattern);
      return { valid: true, errors: [] };
    } catch (error) {
      return { 
        valid: false, 
        errors: [error instanceof Error ? error.message : 'Invalid parameterized pattern'] 
      };
    }
  }
  
  return {
    valid,
    errors: valid ? [] : ['Invalid pattern structure']
  };
}

/**
 * Applies a pattern to a system definition
 * @param system The system to apply the pattern to
 * @param patternId The ID of the pattern to apply
 * @param params Parameters for the pattern
 * @returns The system with the pattern applied
 */
export function applyPattern(system: any, patternId: string, params: Record<string, any> = {}) {
  try {
    // Try to get the pattern from the parameterized pattern library
    const pattern = parameterizedPatternLibrary.getPattern(patternId);
    
    if (pattern) {
      // Apply the parameterized pattern
      const result = parameterizedPatternLibrary.applyPattern(patternId, params);
      
      // Parse the result and merge with the system
      const patternResult = JSON.parse(result);
      return mergeSystemWithPatternResult(system, patternResult);
    }
    
    // Fall back to the legacy pattern application
    return legacyApplyPattern(system, patternId, params);
  } catch (error) {
    console.error(`Error applying pattern ${patternId}:`, error);
    // Return the original system if there's an error
    return system;
  }
}

/**
 * Applies multiple patterns to a system
 * @param system The system to apply patterns to
 * @param patterns The patterns to apply
 * @returns The system with patterns applied
 */
export function applyPatterns(system: any, patterns: Array<{ id: string; params?: Record<string, any> }>) {
  // Apply each pattern sequentially
  return patterns.reduce((result, pattern) => {
    return applyPattern(result, pattern.id, pattern.params || {});
  }, system);
}

/**
 * Retrieves a pattern by ID
 * @param id The ID of the pattern to retrieve
 * @returns The pattern, or null if not found
 */
export function getPatternById(id: string) {
  // Try to get the pattern from the parameterized pattern library
  const parameterizedPattern = parameterizedPatternLibrary.getPattern(id);
  
  if (parameterizedPattern) {
    // Convert to the legacy pattern format
    return {
      id: parameterizedPattern.id,
      name: parameterizedPattern.name,
      type: parameterizedPattern.category,
      description: parameterizedPattern.description,
      version: '1.0.0',
      applicableDomains: ['any']
    };
  }
  
  // Fall back to the legacy pattern retrieval
  const patterns: Record<string, any> = {
    'e-commerce/checkout': {
      id: 'e-commerce/checkout',
      name: 'E-commerce Checkout Pattern',
      type: 'process-pattern',
      description: 'A pattern for implementing e-commerce checkout flows',
      version: '1.0.0',
      applicableDomains: ['e-commerce', 'retail']
    },
    'authentication': {
      id: 'authentication',
      name: 'Authentication Pattern',
      type: 'auth-pattern',
      description: 'A pattern for implementing authentication flows',
      version: '1.0.0'
    }
  };
  
  return patterns[id] || null;
}

/**
 * Composes multiple patterns
 * @param patterns The patterns to compose
 * @returns The composed pattern
 */
export function composePatterns(patterns: any[]) {
  try {
    // Convert to the format expected by the parameterized pattern library
    const components = patterns.map(pattern => ({
      id: pattern.id,
      parameters: pattern.params || {}
    }));
    
    // Compose the patterns
    const composedPattern = parameterizedPatternLibrary.composePatterns(components);
    
    // Register the composed pattern
    parameterizedPatternLibrary.registerPattern(composedPattern);
    
    // Return the composed pattern in the legacy format
    return {
      id: composedPattern.id,
      name: 'Composed Pattern',
      description: 'A pattern composed of multiple patterns',
      version: '1.0.0',
      composedOf: patterns.map(p => p.id)
    };
  } catch (error) {
    console.error('Error composing patterns:', error);
    
    // Fall back to the legacy pattern composition
    return {
      id: 'composed-pattern',
      name: 'Composed Pattern',
      description: 'A pattern composed of multiple patterns',
      version: '1.0.0',
      composedOf: patterns.map(p => p.id)
    };
  }
}

/**
 * Legacy pattern application for backward compatibility
 * @param system The system to apply the pattern to
 * @param patternId The ID of the pattern to apply
 * @param params Parameters for the pattern
 * @returns The system with the pattern applied
 * @private
 */
function legacyApplyPattern(system: any, patternId: string, params: Record<string, any> = {}) {
  // Apply different patterns based on ID
  if (patternId === 'e-commerce/checkout') {
    return {
      ...system,
      processes: [...(system.processes || []), 'checkout-process'],
      tasks: [...(system.tasks || []), 'process-payment'],
      paymentProviders: params.paymentProviders || ['default-provider']
    };
  }
  
  if (patternId === 'authentication') {
    return {
      ...system,
      processes: [...(system.processes || []), 'authentication-process'],
      tasks: [...(system.tasks || []), 'verify-credentials'],
      authMethods: params.methods || ['password']
    };
  }
  
  // Default pattern application
  return {
    ...system,
    appliedPatterns: [...(system.appliedPatterns || []), patternId]
  };
}

/**
 * Merges a system with a pattern result
 * @param system The system to merge with
 * @param patternResult The result of applying a pattern
 * @returns The merged system
 * @private
 */
function mergeSystemWithPatternResult(system: any, patternResult: any): any {
  const result = { ...system };
  
  // Merge arrays
  for (const key of Object.keys(patternResult)) {
    if (Array.isArray(patternResult[key])) {
      result[key] = [...(result[key] || []), ...patternResult[key]];
    } else if (typeof patternResult[key] === 'object' && patternResult[key] !== null) {
      // Recursively merge objects
      result[key] = {
        ...(result[key] || {}),
        ...patternResult[key]
      };
    } else {
      // For primitive values, just override
      result[key] = patternResult[key];
    }
  }
  
  // Add to applied patterns
  result.appliedPatterns = [...(result.appliedPatterns || []), patternResult.id || 'unknown-pattern'];
  
  return result;
}