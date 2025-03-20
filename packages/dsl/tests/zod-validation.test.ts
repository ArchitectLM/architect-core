import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentType } from '../src/types.js';
import { 
  ZodComponentValidator,
  schemaComponentSchema,
  commandComponentSchema,
  ComponentValidatorFactory
} from '../src/zod-validation.js';

describe('Zod Validation', () => {
  describe('ZodComponentValidator', () => {
    describe('Schema Component Validation', () => {
      const validator = new ZodComponentValidator(schemaComponentSchema as any);
      
      it('should validate a valid schema component', () => {
        // Arrange
        const component = {
          type: ComponentType.SCHEMA,
          name: 'TestSchema',
          description: 'A test schema',
          version: '1.0.0',
          definition: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          }
        };
        
        // Act
        const result = validator.validate(component);
        
        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });
      
      it('should return errors for an invalid schema component', () => {
        // Arrange
        const component = {
          type: ComponentType.SCHEMA,
          name: '', // Empty name
          definition: {
            type: 'object',
            properties: {}
          }
        };
        
        // Act
        const result = validator.validate(component);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('name');
      });
      
      it('should validate version format', () => {
        // Arrange
        const component = {
          type: ComponentType.SCHEMA,
          name: 'TestSchema',
          version: 'invalid-version', // Invalid semver
          definition: {
            type: 'object',
            properties: {}
          }
        };
        
        // Act
        const result = validator.validate(component);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('Version must be in semver format');
      });
    });
    
    describe('Command Component Validation', () => {
      const validator = new ZodComponentValidator(commandComponentSchema as any);
      
      it('should validate a valid command component', () => {
        // Arrange
        const component = {
          type: ComponentType.COMMAND,
          name: 'TestCommand',
          input: { ref: 'InputSchema' },
          output: { ref: 'OutputSchema' },
          definition: {}
        };
        
        // Act
        const result = validator.validate(component);
        
        // Assert
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });
      
      it('should return errors for missing input', () => {
        // Arrange
        const component = {
          type: ComponentType.COMMAND,
          name: 'TestCommand',
          // Missing input
          output: { ref: 'OutputSchema' },
          definition: {}
        };
        
        // Act
        const result = validator.validate(component);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('input');
      });
      
      it('should return errors for missing output', () => {
        // Arrange
        const component = {
          type: ComponentType.COMMAND,
          name: 'TestCommand',
          input: { ref: 'InputSchema' },
          // Missing output
          definition: {}
        };
        
        // Act
        const result = validator.validate(component);
        
        // Assert
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0]).toContain('output');
      });
    });
  });
  
  describe('ComponentValidatorFactory', () => {
    beforeEach(() => {
      // Reset the validators
      ComponentValidatorFactory.initialize();
    });
    
    it('should provide a validator for schema components', () => {
      // Act
      const validator = ComponentValidatorFactory.getValidator(ComponentType.SCHEMA);
      
      // Assert
      expect(validator).toBeDefined();
    });
    
    it('should provide a validator for command components', () => {
      // Act
      const validator = ComponentValidatorFactory.getValidator(ComponentType.COMMAND);
      
      // Assert
      expect(validator).toBeDefined();
    });
    
    it('should throw an error for unregistered component types', () => {
      // Act & Assert
      expect(() => {
        ComponentValidatorFactory.getValidator(ComponentType.EVENT);
      }).toThrow();
    });
    
    it('should allow registering custom validators', () => {
      // Arrange
      const customValidator = new ZodComponentValidator(schemaComponentSchema as any);
      
      // Act
      ComponentValidatorFactory.registerValidator(ComponentType.EVENT, customValidator);
      const validator = ComponentValidatorFactory.getValidator(ComponentType.EVENT);
      
      // Assert
      expect(validator).toBe(customValidator);
    });
  });
}); 