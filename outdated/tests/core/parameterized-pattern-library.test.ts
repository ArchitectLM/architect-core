import { describe, it, expect, beforeEach } from 'vitest';
import { 
  PatternLibrary, 
  ParameterizedPattern,
  PatternParameter
} from '../../src/core/parameterized-pattern-library';

describe('Parameterized Pattern Library', () => {
  let patternLibrary: PatternLibrary;
  
  // Sample patterns for testing
  const checkoutPattern: ParameterizedPattern = {
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
    template: (params) => `
      {
        "process": {
          "id": "checkout-process",
          "name": "Checkout Process",
          "description": "Process for handling customer checkout",
          "steps": ${JSON.stringify(params.checkoutSteps)},
          "requiresAuth": ${params.requiresAuthentication},
          "paymentProviders": ${JSON.stringify(params.paymentProviders)}
        }
      }
    `,
    examples: [
      {
        description: 'Standard checkout with Stripe and PayPal',
        parameters: {
          paymentProviders: ['stripe', 'paypal'],
          requiresAuthentication: true,
          checkoutSteps: ['cart', 'shipping', 'payment', 'confirmation']
        },
        result: '{"process":{"id":"checkout-process","name":"Checkout Process","description":"Process for handling customer checkout","steps":["cart","shipping","payment","confirmation"],"requiresAuth":true,"paymentProviders":["stripe","paypal"]}}'
      }
    ]
  };
  
  const authPattern: ParameterizedPattern = {
    id: 'security/authentication',
    name: 'Authentication Pattern',
    description: 'A pattern for implementing authentication',
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
    template: (params) => `
      {
        "process": {
          "id": "auth-process",
          "name": "Authentication Process",
          "description": "Process for handling user authentication",
          "methods": ${JSON.stringify(params.methods)},
          "sessionDuration": ${params.sessionDuration},
          "requiresMFA": ${params.requiresMFA}
        }
      }
    `,
    examples: [
      {
        description: 'OAuth2 authentication with MFA',
        parameters: {
          methods: ['oauth2'],
          sessionDuration: 30,
          requiresMFA: true
        },
        result: '{"process":{"id":"auth-process","name":"Authentication Process","description":"Process for handling user authentication","methods":["oauth2"],"sessionDuration":30,"requiresMFA":true}}'
      }
    ]
  };
  
  beforeEach(() => {
    patternLibrary = new PatternLibrary();
  });
  
  describe('Pattern Registration and Retrieval', () => {
    it('should register and retrieve patterns', () => {
      // Register patterns
      patternLibrary.registerPattern(checkoutPattern);
      patternLibrary.registerPattern(authPattern);
      
      // Retrieve patterns
      const retrievedCheckout = patternLibrary.getPattern('e-commerce/checkout');
      const retrievedAuth = patternLibrary.getPattern('security/authentication');
      
      // Verify pattern properties
      expect(retrievedCheckout).toBeDefined();
      expect(retrievedCheckout?.id).toBe('e-commerce/checkout');
      expect(retrievedCheckout?.parameters.length).toBe(3);
      
      expect(retrievedAuth).toBeDefined();
      expect(retrievedAuth?.id).toBe('security/authentication');
      expect(retrievedAuth?.parameters.length).toBe(3);
    });
    
    it('should return undefined for non-existent patterns', () => {
      const nonExistentPattern = patternLibrary.getPattern('non-existent');
      expect(nonExistentPattern).toBeUndefined();
    });
  });
  
  describe('Parameter Validation', () => {
    beforeEach(() => {
      patternLibrary.registerPattern(checkoutPattern);
    });
    
    it('should validate required parameters', () => {
      // Missing required parameter
      expect(() => {
        patternLibrary.applyPattern('e-commerce/checkout', {});
      }).toThrow('Missing required parameter: paymentProviders');
      
      // With required parameter
      expect(() => {
        patternLibrary.applyPattern('e-commerce/checkout', {
          paymentProviders: ['stripe']
        });
      }).not.toThrow();
    });
    
    it('should apply default values for optional parameters', () => {
      const result = patternLibrary.applyPattern('e-commerce/checkout', {
        paymentProviders: ['stripe']
      });
      
      const parsed = JSON.parse(result);
      expect(parsed.process.requiresAuth).toBe(true); // Default value
      expect(parsed.process.steps).toEqual(['cart', 'shipping', 'payment', 'confirmation']); // Default value
    });
    
    it('should validate parameter types', () => {
      // Add a pattern with validation
      const patternWithValidation: ParameterizedPattern = {
        id: 'test/validation',
        name: 'Test Validation Pattern',
        description: 'A pattern for testing parameter validation',
        category: 'test',
        parameters: [
          {
            name: 'amount',
            type: 'number',
            description: 'Amount to process',
            required: true,
            validation: (value) => value > 0 && value < 1000
          }
        ],
        template: (params) => `{"amount": ${params.amount}}`,
        examples: []
      };
      
      patternLibrary.registerPattern(patternWithValidation);
      
      // Invalid value
      expect(() => {
        patternLibrary.applyPattern('test/validation', { amount: 0 });
      }).toThrow('Invalid value for parameter: amount');
      
      expect(() => {
        patternLibrary.applyPattern('test/validation', { amount: 1001 });
      }).toThrow('Invalid value for parameter: amount');
      
      // Valid value
      expect(() => {
        patternLibrary.applyPattern('test/validation', { amount: 500 });
      }).not.toThrow();
    });
  });
  
  describe('Pattern Application', () => {
    beforeEach(() => {
      patternLibrary.registerPattern(checkoutPattern);
      patternLibrary.registerPattern(authPattern);
    });
    
    it('should apply a pattern with parameters', () => {
      const result = patternLibrary.applyPattern('e-commerce/checkout', {
        paymentProviders: ['stripe', 'paypal'],
        requiresAuthentication: false,
        checkoutSteps: ['cart', 'payment', 'confirmation'] // Removed shipping
      });
      
      const parsed = JSON.parse(result);
      expect(parsed.process.id).toBe('checkout-process');
      expect(parsed.process.paymentProviders).toEqual(['stripe', 'paypal']);
      expect(parsed.process.requiresAuth).toBe(false);
      expect(parsed.process.steps).toEqual(['cart', 'payment', 'confirmation']);
    });
    
    it('should throw an error for non-existent patterns', () => {
      expect(() => {
        patternLibrary.applyPattern('non-existent', {});
      }).toThrow('Pattern not found: non-existent');
    });
  });
  
  describe('Parameter Substitution', () => {
    it('should substitute parameters in string templates', () => {
      // Add a pattern with string template
      const stringTemplatePattern: ParameterizedPattern = {
        id: 'test/string-template',
        name: 'String Template Pattern',
        description: 'A pattern with a string template',
        category: 'test',
        parameters: [
          {
            name: 'name',
            type: 'string',
            description: 'Name to use',
            required: true
          },
          {
            name: 'count',
            type: 'number',
            description: 'Count to use',
            required: true
          }
        ],
        template: 'Hello, ${name}! You have ${count} items.',
        examples: []
      };
      
      patternLibrary.registerPattern(stringTemplatePattern);
      
      const result = patternLibrary.applyPattern('test/string-template', {
        name: 'World',
        count: 42
      });
      
      expect(result).toBe('Hello, World! You have 42 items.');
    });
  });
  
  describe('Pattern Composition', () => {
    beforeEach(() => {
      patternLibrary.registerPattern(checkoutPattern);
      patternLibrary.registerPattern(authPattern);
    });
    
    it('should compose multiple patterns', () => {
      const composedPattern = patternLibrary.composePatterns([
        {
          id: 'e-commerce/checkout',
          parameters: {
            paymentProviders: ['stripe'],
            requiresAuthentication: true
          }
        },
        {
          id: 'security/authentication',
          parameters: {
            methods: ['oauth2', 'password'],
            requiresMFA: true
          }
        }
      ]);
      
      expect(composedPattern.id).toContain('composed');
      expect(composedPattern.components.length).toBe(2);
      expect(composedPattern.components[0].id).toBe('e-commerce/checkout');
      expect(composedPattern.components[1].id).toBe('security/authentication');
    });
    
    it('should apply a composed pattern', () => {
      // Create a composed pattern
      const composedPattern = patternLibrary.composePatterns([
        {
          id: 'e-commerce/checkout',
          parameters: {
            paymentProviders: ['stripe'],
            requiresAuthentication: true
          }
        },
        {
          id: 'security/authentication',
          parameters: {
            methods: ['oauth2'],
            requiresMFA: true
          }
        }
      ]);
      
      // Register the composed pattern
      patternLibrary.registerPattern(composedPattern);
      
      // Apply the composed pattern
      const result = patternLibrary.applyPattern(composedPattern.id, {});
      
      // The result should contain both patterns
      expect(result).toContain('checkout-process');
      expect(result).toContain('auth-process');
      expect(result).toContain('stripe');
      expect(result).toContain('oauth2');
      expect(result).toContain('requiresMFA');
    });
  });
}); 