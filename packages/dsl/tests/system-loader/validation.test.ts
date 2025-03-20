import { describe, it, expect } from 'vitest';
import { validateSystem } from '../../src/system-loader/validation.js';
import { SystemDefinition } from '../../src/types.js';

describe('System Validation', () => {
  describe('validateSystem', () => {
    it('should validate a valid system definition with no errors', () => {
      const systemDef: SystemDefinition = {
        name: 'TestSystem',
        description: 'A test system',
        components: {
          schemas: [
            { ref: 'User', required: true },
            { ref: 'Product' }
          ],
          commands: [
            { ref: 'CreateUser', required: true },
            { ref: 'UpdateUser' }
          ],
          events: [
            { ref: 'UserCreated' },
            { ref: 'UserUpdated' }
          ]
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toHaveLength(0);
    });

    it('should return an error for a system definition without a name', () => {
      const systemDef = {
        // name is missing
        description: 'A test system',
        components: {
          schemas: [
            { ref: 'User', required: true }
          ]
        }
      } as SystemDefinition;

      const errors = validateSystem(systemDef);
      expect(errors).toContain('System name is required');
    });

    it('should return an error for a system definition without components', () => {
      const systemDef = {
        name: 'TestSystem',
        description: 'A test system'
        // components are missing
      } as SystemDefinition;

      const errors = validateSystem(systemDef);
      expect(errors).toContain('System components are required');
    });

    it('should return an error for a schema reference without a ref property', () => {
      const systemDef: SystemDefinition = {
        name: 'TestSystem',
        components: {
          schemas: [
            { ref: 'User' },
            { required: true } as any // Missing ref
          ]
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toContain('Schema reference is missing a ref property');
    });

    it('should return an error for a command reference without a ref property', () => {
      const systemDef: SystemDefinition = {
        name: 'TestSystem',
        components: {
          commands: [
            { ref: 'CreateUser' },
            { required: true } as any // Missing ref
          ]
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toContain('Command reference is missing a ref property');
    });

    it('should return an error for an event reference without a ref property', () => {
      const systemDef: SystemDefinition = {
        name: 'TestSystem',
        components: {
          events: [
            { ref: 'UserCreated' },
            { required: true } as any // Missing ref
          ]
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toContain('Event reference is missing a ref property');
    });

    it('should return an error for a query reference without a ref property', () => {
      const systemDef: SystemDefinition = {
        name: 'TestSystem',
        components: {
          queries: [
            { ref: 'GetUser' },
            { required: true } as any // Missing ref
          ]
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toContain('Query reference is missing a ref property');
    });

    it('should return an error for a workflow reference without a ref property', () => {
      const systemDef: SystemDefinition = {
        name: 'TestSystem',
        components: {
          workflows: [
            { ref: 'UserRegistration' },
            { required: true } as any // Missing ref
          ]
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toContain('Workflow reference is missing a ref property');
    });

    it('should validate a system with multiple component types', () => {
      const systemDef: SystemDefinition = {
        name: 'ComplexSystem',
        description: 'A complex system with multiple component types',
        components: {
          schemas: [
            { ref: 'User' },
            { ref: 'Product' }
          ],
          commands: [
            { ref: 'CreateUser' },
            { ref: 'UpdateUser' }
          ],
          events: [
            { ref: 'UserCreated' },
            { ref: 'UserUpdated' }
          ],
          queries: [
            { ref: 'GetUser' },
            { ref: 'ListUsers' }
          ],
          workflows: [
            { ref: 'UserRegistration' },
            { ref: 'ProductPurchase' }
          ]
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toHaveLength(0);
    });

    it('should return multiple errors for a system with multiple issues', () => {
      const systemDef = {
        // name is missing
        components: {
          schemas: [
            { ref: 'User' },
            { required: true } as any // Missing ref
          ],
          commands: [
            { required: true } as any // Missing ref
          ]
        }
      } as SystemDefinition;

      const errors = validateSystem(systemDef);
      expect(errors).toContain('System name is required');
      expect(errors).toContain('Schema reference is missing a ref property');
      expect(errors).toContain('Command reference is missing a ref property');
      expect(errors.length).toBe(3);
    });

    it('should handle empty component arrays', () => {
      const systemDef: SystemDefinition = {
        name: 'EmptySystem',
        components: {
          schemas: [],
          commands: [],
          events: [],
          queries: [],
          workflows: []
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toHaveLength(0);
    });

    it('should handle undefined component arrays', () => {
      const systemDef: SystemDefinition = {
        name: 'PartialSystem',
        components: {
          schemas: [{ ref: 'User' }]
          // other component arrays are undefined
        }
      };

      const errors = validateSystem(systemDef);
      expect(errors).toHaveLength(0);
    });
  });
}); 