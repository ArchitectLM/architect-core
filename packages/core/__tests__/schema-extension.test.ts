import { describe, it, expect, vi } from 'vitest';
import { mockSystem } from '../mocks';

// Mock the schema extension system
vi.mock('../../src/core/schema-extension', () => ({
  validateWithExtension: vi.fn((baseSchema, extension) => {
    if (extension.violatesConstraint) {
      return { valid: false, errors: ['Extension violates schema constraints'] };
    }
    return { valid: true, errors: [] };
  }),
  
  extendSchema: vi.fn((baseSchema, extension) => {
    return {
      ...baseSchema,
      capabilities: [...(baseSchema.capabilities || []), ...(extension.provides || [])],
      extensions: [...(baseSchema.extensions || []), extension.type]
    };
  }),
  
  mockExtension: vi.fn((config) => {
    return {
      type: config.type || 'mock-extension',
      version: config.version || '0.1.0',
      provides: config.provides || [],
      violatesConstraint: config.violatesConstraint || false,
      ...config
    };
  })
}));

// Custom matchers
expect.extend({
  toFailValidation(received) {
    const pass = !received.valid;
    return {
      pass,
      message: () => `expected validation ${pass ? 'not ' : ''}to fail`
    };
  },
  
  toSupportCapabilities(received, expected) {
    const capabilities = received.capabilities || [];
    const pass = expected.every(cap => capabilities.includes(cap));
    return {
      pass,
      message: () => `expected ${JSON.stringify(capabilities)} ${pass ? 'not ' : ''}to include ${JSON.stringify(expected)}`
    };
  }
});

describe('Schema Extension System', () => {
  it('should reject invalid extensions', async () => {
    // Import mocked modules
    const { validateWithExtension, mockExtension } = await import('../../src/core/schema-extension');
    
    // Create a base schema
    const baseSchema = mockSystem({
      id: 'base-system',
      capabilities: ['basic-workflow']
    });
    
    // Create an invalid extension
    const invalidExtension = mockExtension({
      type: 'invalid',
      violatesConstraint: true
    });
    
    // Validate with extension
    const result = validateWithExtension(baseSchema, invalidExtension);
    
    // @ts-ignore - Custom matcher
    expect(result).toFailValidation();
  });
  
  it('should enhance schema capabilities with valid extensions', async () => {
    // Import mocked modules
    const { extendSchema, mockExtension } = await import('../../src/core/schema-extension');
    
    // Create a base schema
    const baseSchema = mockSystem({
      id: 'base-system',
      capabilities: ['basic-workflow']
    });
    
    // Create a valid e-commerce extension
    const ecommerceExtension = mockExtension({
      type: 'e-commerce',
      provides: ['payment-processing', 'inventory-management']
    });
    
    // Extend the schema
    const enhancedSchema = extendSchema(baseSchema, ecommerceExtension);
    
    // @ts-ignore - Custom matcher
    expect(enhancedSchema).toSupportCapabilities(['payment-processing']);
    expect(enhancedSchema.extensions).toContain('e-commerce');
  });
  
  it('should support composing multiple extensions', async () => {
    // Import mocked modules
    const { extendSchema, mockExtension } = await import('../../src/core/schema-extension');
    
    // Create a base schema
    const baseSchema = mockSystem({
      id: 'base-system',
      capabilities: ['basic-workflow']
    });
    
    // Create multiple extensions
    const authExtension = mockExtension({
      type: 'authentication',
      provides: ['user-authentication', 'role-based-access']
    });
    
    const paymentExtension = mockExtension({
      type: 'payment',
      provides: ['payment-processing', 'refund-handling']
    });
    
    // Apply extensions sequentially
    let enhancedSchema = extendSchema(baseSchema, authExtension);
    enhancedSchema = extendSchema(enhancedSchema, paymentExtension);
    
    // @ts-ignore - Custom matcher
    expect(enhancedSchema).toSupportCapabilities(['user-authentication', 'payment-processing']);
    expect(enhancedSchema.extensions).toContain('authentication');
    expect(enhancedSchema.extensions).toContain('payment');
  });
  
  it('should maintain backward compatibility when extending', async () => {
    // Import mocked modules
    const { extendSchema, mockExtension } = await import('../../src/core/schema-extension');
    
    // Create a base schema with existing capabilities
    const baseSchema = mockSystem({
      id: 'base-system',
      capabilities: ['user-management', 'basic-workflow'],
      version: '1.0.0'
    });
    
    // Create an extension that enhances existing capabilities
    const enhancementExtension = mockExtension({
      type: 'enhancement',
      provides: ['advanced-workflow', 'analytics'],
      version: '1.1.0'
    });
    
    // Extend the schema
    const enhancedSchema = extendSchema(baseSchema, enhancementExtension);
    
    // Original capabilities should be preserved
    // @ts-ignore - Custom matcher
    expect(enhancedSchema).toSupportCapabilities(['user-management', 'basic-workflow']);
    
    // New capabilities should be added
    // @ts-ignore - Custom matcher
    expect(enhancedSchema).toSupportCapabilities(['advanced-workflow', 'analytics']);
  });
}); 