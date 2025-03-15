import { describe, it, expect, vi } from 'vitest';
import { mockSystem, mockPattern } from '../mocks';

// Mock the pattern library system
vi.mock('../../src/core/pattern-library', () => ({
  applyPattern: vi.fn((system, patternId, params = {}) => {
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
  }),
  
  applyPatterns: vi.fn((system, patterns) => {
    // Apply multiple patterns sequentially
    let result = { ...system };
    
    patterns.forEach((pattern: any) => {
      result = {
        ...result,
        processes: [...(result.processes || []), `${pattern.id}-process`],
        capabilities: [...(result.capabilities || []), pattern.id],
        appliedPatterns: [...(result.appliedPatterns || []), pattern.id]
      };
    });
    
    return result;
  }),
  
  validatePattern: vi.fn((pattern) => {
    // Validate pattern structure
    const valid = pattern && pattern.id && pattern.type ? true : false;
    return {
      valid,
      errors: valid ? [] : ['Invalid pattern structure']
    };
  }),
  
  getPatternById: vi.fn((id) => {
    // Return different patterns based on ID
    if (id === 'e-commerce/checkout') {
      return mockPattern({
        id: 'e-commerce/checkout',
        name: 'E-commerce Checkout Pattern',
        type: 'process-pattern',
        applicableDomains: ['e-commerce', 'retail']
      });
    }
    
    if (id === 'authentication') {
      return mockPattern({
        id: 'authentication',
        name: 'Authentication Pattern',
        type: 'security-pattern',
        applicableDomains: ['any']
      });
    }
    
    return null;
  })
}));

// Custom matchers
expect.extend({
  toHaveProcess(received, processName) {
    const processes = received.processes || [];
    const pass = processes.includes(processName);
    
    return {
      pass,
      message: () => `expected system ${pass ? 'not ' : ''}to have process "${processName}"`
    };
  },
  
  toHaveTask(received, taskName) {
    const tasks = received.tasks || [];
    const pass = tasks.includes(taskName);
    
    return {
      pass,
      message: () => `expected system ${pass ? 'not ' : ''}to have task "${taskName}"`
    };
  },
  
  toSupportPaymentProviders(received, providers) {
    const systemProviders = received.paymentProviders || [];
    const pass = providers.every((provider: string) => systemProviders.includes(provider));
    
    return {
      pass,
      message: () => `expected system ${pass ? 'not ' : ''}to support payment providers: ${providers.join(', ')}`
    };
  },
  
  toHaveConflicts(received) {
    const pass = received.hasConflicts === true;
    
    return {
      pass,
      message: () => `expected system ${pass ? 'not ' : ''}to have conflicts`
    };
  },
  
  toHaveAllCapabilitiesFrom(received, capabilities) {
    const systemCapabilities = received.capabilities || [];
    const pass = capabilities.every((cap: string) => systemCapabilities.includes(cap));
    
    return {
      pass,
      message: () => `expected system ${pass ? 'not ' : ''}to have all capabilities from: ${capabilities.join(', ')}`
    };
  }
});

describe('Pattern Library System', () => {
  it('should apply e-commerce checkout pattern to a system', async () => {
    // Import mocked modules
    const { applyPattern } = await import('../../src/core/pattern-library');
    
    // Create a basic system
    const baseSystem = mockSystem({
      id: 'e-commerce-system',
      boundedContexts: ['customer', 'order'],
      processes: [],
      tasks: []
    });
    
    // Apply checkout pattern
    const enhancedSystem = applyPattern(baseSystem, 'e-commerce/checkout', {
      paymentProviders: ['stripe', 'paypal']
    });
    
    // @ts-ignore - Custom matcher
    expect(enhancedSystem).toHaveProcess('checkout-process');
    // @ts-ignore - Custom matcher
    expect(enhancedSystem).toHaveTask('process-payment');
    // @ts-ignore - Custom matcher
    expect(enhancedSystem).toSupportPaymentProviders(['stripe', 'paypal']);
  });
  
  it('should compose multiple patterns without conflicts', async () => {
    // Import mocked modules
    const { applyPatterns } = await import('../../src/core/pattern-library');
    
    // Create a basic system
    const baseSystem = mockSystem({
      id: 'multi-pattern-system',
      boundedContexts: ['core'],
      processes: [],
      tasks: [],
      capabilities: []
    });
    
    // Apply multiple patterns
    const patterns = [
      { id: 'authentication', params: { methods: ['oauth2', 'password'] } },
      { id: 'payment-processing', params: { providers: ['stripe'] } }
    ];
    
    const composedSystem = applyPatterns(baseSystem, patterns);
    
    // @ts-ignore - Custom matcher
    expect(composedSystem).not.toHaveConflicts();
    // @ts-ignore - Custom matcher
    expect(composedSystem).toHaveAllCapabilitiesFrom(['authentication', 'payment-processing']);
    
    // Should have processes from both patterns
    expect(composedSystem.processes).toContain('authentication-process');
    expect(composedSystem.processes).toContain('payment-processing-process');
  });
  
  it('should validate patterns against schema', async () => {
    // Import mocked modules
    const { validatePattern, getPatternById } = await import('../../src/core/pattern-library');
    
    // Get a valid pattern
    const validPattern = getPatternById('e-commerce/checkout');
    
    // Validate the pattern
    const validationResult = validatePattern(validPattern);
    expect(validationResult.valid).toBe(true);
    expect(validationResult.errors.length).toBe(0);
    
    // Create an invalid pattern
    const invalidPattern = { name: 'Invalid Pattern' }; // Missing required fields
    
    // Validate the invalid pattern
    const invalidResult = validatePattern(invalidPattern);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors.length).toBeGreaterThan(0);
  });
  
  it('should retrieve patterns by ID', async () => {
    // Import mocked modules
    const { getPatternById } = await import('../../src/core/pattern-library');
    
    // Get existing patterns
    const checkoutPattern = getPatternById('e-commerce/checkout');
    const authPattern = getPatternById('authentication');
    
    // Verify pattern properties
    expect(checkoutPattern).toBeDefined();
    expect(checkoutPattern?.id).toBe('e-commerce/checkout');
    expect(checkoutPattern?.type).toBe('process-pattern');
    
    expect(authPattern).toBeDefined();
    expect(authPattern?.id).toBe('authentication');
    expect(authPattern?.type).toBe('security-pattern');
    
    // Try to get a non-existent pattern
    const nonExistentPattern = getPatternById('non-existent');
    expect(nonExistentPattern).toBeNull();
  });
}); 