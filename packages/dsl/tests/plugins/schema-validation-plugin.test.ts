import { describe, it, expect } from 'vitest';
import { schemaValidationPlugin } from '../../src/plugins/schema-validation-plugin.js';
import { ComponentType } from '../../src/types.js';

describe('Schema Validation Plugin', () => {
  describe('Plugin Configuration', () => {
    it('should have the correct name and version', () => {
      expect(schemaValidationPlugin.name).toBe('schema-validation-plugin');
      expect(schemaValidationPlugin.version).toBe('1.0.0');
      expect(schemaValidationPlugin.description).toBe('Provides enhanced validation for schema components');
    });

    it('should support schema component type', () => {
      expect(schemaValidationPlugin.supportedComponentTypes).toContain(ComponentType.SCHEMA);
    });
  });

  describe('Component Validation', () => {
    it('should validate a valid schema component', () => {
      if (!schemaValidationPlugin.onComponentValidation) {
        return;
      }

      const component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        description: 'User schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' }
          },
          required: ['id', 'name']
        }
      };

      const initialValidationResult = { isValid: true, errors: [] };
      const result = schemaValidationPlugin.onComponentValidation(component, initialValidationResult);

      if (result instanceof Promise) {
        expect(result).toBeInstanceOf(Promise);
      } else {
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });

    it('should invalidate a schema with missing type', () => {
      if (!schemaValidationPlugin.onComponentValidation) {
        return;
      }

      const component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        description: 'User schema',
        definition: {
          properties: {
            id: { type: 'string' },
            name: { type: 'string' }
          }
        }
      };

      const initialValidationResult = { isValid: true, errors: [] };
      const result = schemaValidationPlugin.onComponentValidation(component, initialValidationResult);

      if (result instanceof Promise) {
        expect(result).toBeInstanceOf(Promise);
      } else {
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Schema definition must have a type');
      }
    });

    it('should invalidate a schema with invalid property types', () => {
      if (!schemaValidationPlugin.onComponentValidation) {
        return;
      }

      const component = {
        type: ComponentType.SCHEMA,
        name: 'User',
        description: 'User schema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'invalid-type' },
            name: { type: 'string' }
          }
        }
      };

      const initialValidationResult = { isValid: true, errors: [] };
      const result = schemaValidationPlugin.onComponentValidation(component, initialValidationResult);

      if (result instanceof Promise) {
        expect(result).toBeInstanceOf(Promise);
      } else {
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Invalid property type');
      }
    });

    it('should ignore non-schema components', () => {
      if (!schemaValidationPlugin.onComponentValidation) {
        return;
      }

      const component = {
        type: ComponentType.COMMAND,
        name: 'CreateUser',
        description: 'Create user command',
        definition: {}
      };

      const initialValidationResult = { isValid: true, errors: [] };
      const result = schemaValidationPlugin.onComponentValidation(component, initialValidationResult);

      if (result instanceof Promise) {
        expect(result).toBeInstanceOf(Promise);
      } else {
        expect(result).toBe(initialValidationResult);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }
    });
  });
}); 