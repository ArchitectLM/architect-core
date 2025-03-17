import { describe, it, expect, beforeEach } from 'vitest';
import { Component, ComponentType } from '../src/types.js';
import { 
  SchemaComponentValidator, 
  CommandComponentValidator, 
  ComponentValidatorFactory,
  componentValidatorFactory
} from '../src/component-validation.js';

describe('Component Validation', () => {
  describe('SchemaComponentValidator', () => {
    const validator = new SchemaComponentValidator();
    
    it('should validate a valid schema component', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' }
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
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: {
          type: 'object'
          // Missing properties
        }
      };
      
      // Act
      const result = validator.validate(component);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('properties');
    });
    
    it('should validate component type', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND, // Wrong type
        name: 'TestSchema',
        definition: {
          type: 'object',
          properties: {}
        }
      } as any;
      
      // Act
      const result = validator.validate(component);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('type must be');
    });
  });
  
  describe('CommandComponentValidator', () => {
    const validator = new CommandComponentValidator();
    
    it('should validate a valid command component', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'TestCommand',
        input: { ref: 'InputSchema' },
        output: { ref: 'OutputSchema' }
      };
      
      // Act
      const result = validator.validate(component);
      
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });
    
    it('should return errors for missing input/output', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'TestCommand'
      } as any;
      
      // Act
      const result = validator.validate(component);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain('input');
      expect(result.errors[1]).toContain('output');
    });
    
    it('should return errors for input/output without refs', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'TestCommand',
        input: {} as any,
        output: {} as any
      };
      
      // Act
      const result = validator.validate(component);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(2);
      expect(result.errors[0]).toContain('input must reference');
      expect(result.errors[1]).toContain('output must reference');
    });
  });
  
  describe('ComponentValidatorFactory', () => {
    let factory: ComponentValidatorFactory;
    
    beforeEach(() => {
      factory = new ComponentValidatorFactory();
    });
    
    it('should validate a schema component', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: {
          type: 'object',
          properties: {
            id: { type: 'string' }
          }
        }
      };
      
      // Act
      const result = factory.validate(component);
      
      // Assert
      expect(result.isValid).toBe(true);
    });
    
    it('should validate a command component', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.COMMAND,
        name: 'TestCommand',
        input: { ref: 'InputSchema' },
        output: { ref: 'OutputSchema' }
      };
      
      // Act
      const result = factory.validate(component);
      
      // Assert
      expect(result.isValid).toBe(true);
    });
    
    it('should validate component name format', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: '123InvalidName', // Invalid name starting with a number
        definition: {
          type: 'object',
          properties: {}
        }
      };
      
      // Act
      const result = factory.validate(component);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('name must start with a letter');
    });
    
    it('should validate component version format', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        version: 'invalid-version', // Invalid semver
        definition: {
          type: 'object',
          properties: {}
        }
      };
      
      // Act
      const result = factory.validate(component);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('semver format');
    });
  });
  
  describe('componentValidatorFactory singleton', () => {
    it('should be available as a singleton', () => {
      // Assert
      expect(componentValidatorFactory).toBeDefined();
      expect(componentValidatorFactory).toBeInstanceOf(ComponentValidatorFactory);
    });
    
    it('should validate components', () => {
      // Arrange
      const component: Component = {
        type: ComponentType.SCHEMA,
        name: 'TestSchema',
        definition: {
          type: 'object',
          properties: {}
        }
      };
      
      // Act
      const result = componentValidatorFactory.validate(component);
      
      // Assert
      expect(result.isValid).toBe(true);
    });
  });
}); 